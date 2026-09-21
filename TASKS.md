# Open tasks

Things deliberately left unfinished, with enough context to pick them up cold.

---

## 1. The farm-spot auto-blacklist ratchets until nothing is left to farm

**Status:** root cause fixed in v39 / v21 / v45. Two follow-ups left (below).
Priority: was high — it disabled farming outright.

### What happens

`listBlacklist()` on Dexon currently shows ~55 entries. Nearly every one reads

> `Dexon couldn't reach this spot (stuck 180s without arriving)`

and their timestamps are 180 seconds apart, one after another. That spacing is the
whole story: the timeout fires, a new spot is picked, that one times out too, and
the search walks straight down the candidate list burning it as it goes. Nothing
ever expires, so the damage only accumulates. Given enough uptime it blacklists
every spot in the game and the party stands still.

### Where it lives

- `Ranger.js` — `checkFarmEconomics()`, the `UNREACHABLE_TIMEOUT_MS` (3 min) branch.
  This is the one doing the damage.
- `Ranger.js` — `hasReachedFarmSpot()` and `ARRIVAL_RADIUS` (100 units) decide
  whether he "arrived".
- `Ranger.js` — `handleReturnHome()` issues the `smart_move` that is supposedly failing.
- `Priest.js` ~L468 and `Mage.js` ~L425 send the same verdict to Dexon as
  `blacklist_spot`; Dexon owns the list, they only report.

### Root cause (found 2026-09-20 — supersedes the guesses that were here)

**The timer is not measuring what its name says.** `checkFarmEconomics()` runs in
`maintenanceLoop()` (`Ranger.js` ~L770). Travel runs in `mainLoop()` (~L652).
They are two independent `setTimeout` chains. The timeout measures *wall-clock
since the spot was assigned* — not time spent trying to travel, and not failed
route attempts. It fires whether or not `smart_move` was ever called.

And `mainLoop()` has eight early exits ahead of the movement branch, each of
which means no travel is attempted on that tick:

| `mainLoop()` guard | how long it can hold |
| --- | --- |
| `is_disabled(character)` | as long as the condition lasts |
| `state.sellingOff` | a round trip to Ernis and back (v37 inventory relief) |
| `state.waitingForMerchant` | up to `MERCHANT_WAIT_TIMEOUT_MS` = 90s |
| `checkPotionEmergency()` | until potions are sorted |
| `dragold.tick() === 'block'` | a shard hop, repeatedly |
| `character.map === "jail"` | until the jailer is reached |
| `shouldHandleEvents()` | **as long as any event is live** |
| `!CONFIG.movement.enabled` | forever |

`shouldHandleEvents()` is the big one: it takes the branch *instead of* movement,
and it is true whenever `holidayseason` is on without the buff, or any of
dragold / mrgreen / mrpumpkin / wabbit is live. None of that is rare.

Whichever guard holds, the sequence is the same: three minutes pass, the current
spot is blacklisted "couldn't reach", `runFarmSearch()` picks the next one,
`arrivalState.assignedAt` resets, three minutes later that one goes too. That is
exactly the observed ladder — uniform 180-second intervals, every entry reading
"couldn't reach", marching straight down the candidate list. **The spots were
never the problem, and in most of these cases `smart_move` was never called.**

Note the movement branch also only runs when `!get_nearest_monster({type: home})`,
so a visible home-type mob suppresses travel too.

### Secondary: travel failures are swallowed

`handleReturnHome()` in all three scripts (`Ranger.js` ~L1167, `Priest.js` ~L1169,
`Mage.js` ~L898) calls `smart_move(destination)` fire-and-forget — no `await`, no
`.catch()`. A rejection becomes an unhandled promise rejection and vanishes;
`smart.moving` goes false; the next tick re-issues it. If the destination is
genuinely unroutable this is a silent hot loop that looks identical, from the
outside, to "walking there slowly".

`Merchant.js` already solves this: `travelTo()` (~L512) awaits `smart_move`,
catches the rejection, falls back to `town()`, and retries the real route from
there — written because a seasonal map can lose its route out once the event
ends. Porting it gives the other three both the fallback and, more valuably, an
actual error message instead of silence.

### The fix — done (Ranger v39, Priest v21, Mage v45)

1. **The unit changed.** The verdict now fires on `travelState.failures >=
   TRAVEL.maxAttempts` (3), counted only when a travel attempt actually ran and
   failed. `UNREACHABLE_TIMEOUT_MS` is gone from all three scripts. No attempt,
   no count, no blacklist — so a shard hop, a live event, a potion run or a
   vendor trip can no longer condemn a spot nobody walked to.
2. **`travelTo()` ported** into all three scripts from `Merchant.js`. It awaits
   `smart_move`, catches the rejection, falls back through `town()`, and retries
   the real route from there. `travelState.inFlight` keeps the synchronous tick
   loops from stacking concurrent attempts on an async helper, and
   `travelWatchdog()` orphans an attempt that outlives `attemptTimeoutMs`
   (3 min) — `attemptId` makes the orphan's late resolution a no-op — so a
   `smart_move` that never settles is counted as the failure it is rather than
   hiding behind the guard forever.
3. **The town fallback is capped** at 3 failed attempts, each of which has
   already been through `town()` once. Then the spot is judged.
4. **The verdict records what happened**: number of attempts, the rejection
   reason, and how close he got — measured *before* `town()` relocates him,
   since "142 units short on winterland" is the diagnostic and "where town is"
   is not. Stored on the blacklist entry under `details`, and carried across
   the party link so a healer's report arrives with the same fields.

Fixed in passing: `handleReturnHome()` compared `distance(character, destination)`
without checking the map, so matching coordinates on the wrong map read as
"arrived" and travel never happened.

### Still open

- **Expire blacklist entries.** They are still permanent once written. Now that
  the verdict is earned they are far rarer, but a spot blocked by a temporary
  condition stays condemned forever.
- **Separate lifetimes for the two verdicts.** A routing failure and a
  net-negative-xp result share one blacklist and one expiry policy; they should
  not.
- **Clear the existing damage.** The ~55 entries already in storage were all
  written by the old clock and none of them mean anything. `clearBlacklist()`
  from the console wipes them; the coded lists are unaffected.

### Ruled out

`ARRIVAL_RADIUS` being too tight is unlikely to matter: `handleReturnHome()`
keeps moving until within **20** units while `hasReachedFarmSpot()` accepts
**100**, so if `smart_move` ever returns he counts as arrived. The earlier
"he may already be there" theory is much weaker than the loop decoupling above.

### What is in place meanwhile (v38)

`Ranger.js` has two coded lists just above `spotKey()`:

- `PERMANENT_WHITELIST` — `crab@main`, `arcticbee@winterland`, `snake@main`.
  Can never be blacklisted; incoming reports are refused, and entries already in
  storage are dropped the next time the list is read, so the three the ratchet
  already ate come back on their own. If scoring somehow rejects everything,
  these are used unscored rather than farming nothing.
- `PERMANENT_BLACKLIST` — `gscorpion@desertland`, `mrpumpkin@halloween`,
  `mummy@level3`, `ghost@halloween`, `mummy@level4`. Never scored at all.

`clearBlacklist()` was added as a console helper for wiping stored entries
(the coded lists are unaffected).

This guarantees the party always has somewhere to farm. It does not stop the
ratchet from eating everything else.

---

## 2. Adopt the measured town NPC spot in the main party's scripts

**Status:** not started, and deliberately not applied. `Codex/FamilyFleet.js`
uses it; `Ranger.js`, `Priest.js`, `Mage.js` and `Merchant.js` do not. The
operator asked for it to be recorded rather than rolled out.

### The spot

    { map: 'main', x: -179, y: -72 }

One position that reaches Lucas (scrolls), Cue (upgrade/compound), Gabriel
(basics, and selling) and Ponty (secondhands) simultaneously, with the whole
player-stand cluster inside the vision box. Measured and tested live by the
other session against game data 17083 - verified working, not derived:

| Action                        | Result                        | Distance |
|-------------------------------|-------------------------------|----------|
| `buy('helmet')` - Gabriel     | OK                            | 129.4    |
| `buy('scroll0')` - Lucas      | OK                            | 286.0    |
| `upgrade(h, s)` - Cue         | OK, rolled success            | 150.6    |
| `socket.emit('secondhands')`  | replied, 225 items            | 286.1    |
| stands visible                | 6 of 6                        | box 340 x 164 |

It is the centre of the smallest circle enclosing all four, radius 286.05.
Lucas and Ponty are 572.1 apart and form the diameter. **If the NPC set
changes, recompute the SEC rather than nudging the point** - the binding pair
may change.

Interaction range is bounded but not pinned: confirmed working at 286, and
independently at 370.01. So this sits with at least 84 units of slack. The
exact cutoff would take a walk-out from Lucas retrying `buy('scroll0', 1)`.

### Where it would go

- `Merchant.js` - `CONFIG.stand.candidates` / `scoutGoToScanSpot`, and the
  arbitrage approach logic. The merchant is the one that buys scrolls,
  upgrades and reads Ponty, so it gains the most.
- `Ranger.js` / `Priest.js` / `Mage.js` - potion runs and the vendor trip in
  `runInventoryRelief`, which currently walks to Ernis at (-35, -162).

### Two traps to carry across with it

1. **`character.x` / `character.y` are not world coordinates** on the top
   window - measured at (1147, 416) while the character stood at (-123, -52).
   Use `real_x` / `real_y`. NPC entities have `.x === .real_x`, so G-derived
   geometry never exposes this and it stays invisible until something
   cross-checks. **This has already cost this project once**: the phantom
   1,307-unit trade range in the merchant came from reading position off the
   top window's character object. Audit every `character.x` in the four
   scripts before moving any of them to this spot.
2. **Vision is a box, not a radius.** `character.vision` is `[700, 500]` and
   the test is `|dx| <= 700 && |dy| <= 500`. A stand 690 east is visible; one
   510 north is not. Any distance check against vision is wrong in both
   directions. `FamilyFleet.js` has `inVision()` written correctly - lift it
   rather than rewriting it.

Also worth knowing: the `190` in `interaction_context_range` is a UI gate for
whether the NPC panel renders, **not** a transaction range. Lucas sold at 286
with no panel open. Do not use 190 for anything transactional.

---

## 3. ~~The same scan-buffer staleness exists in MerchantScout.js and Merchant.js~~ — DONE

**Status:** ported to both, `d6036f9`..`HEAD`. Merchant.js is `v32`; it stays
off the live slot by its own deployment marker until arbitrage testing resumes.

Three fixes went across, all of them in live-gold paths:

1. **Settling measured the wrong thing.** Both counted *every* buffered shard,
   so an unsent backlog made the two-passes-agree test pass on the second pass
   before the new shard had been looked at once — and the scout posted whatever
   it happened to be holding. Settling exists to let a freshly landed client
   stream its entity list in; a count that includes four other shards cannot
   measure that. Now counts the current shard only.
2. **Sweeps accumulated instead of replacing.** Neither cleared a shard's stands
   between visits, so a stand that closed was merged forward and re-reported as
   live on every return. The bridge stores what it is sent — it has no way to
   detect a ghost. Now `reset…CurrentShardStands()` before each sweep.
3. **The post-gap wait was unclamped**, so a wall clock moving backwards under
   an NTP correction made it a number `setTimeout` cannot hold.

And one that was **only** in MerchantScout.js:

4. **The Ponty price probe.** It read `['price','cost','g','value','gold']` off
   the payload. There is no price field — the client computes it — and `g` is a
   perfectly plausible key for an item's **base** value. Ponty charges 1.2× base,
   so a payload carrying `g` would have under-quoted every listing by 20%,
   silently, in the direction that looks like a bargain. Now always derived.

`Merchant.js` never had that one: `scoutItemPrice` already derived from
`calculate_item_value × secondhands_mult`.

### Still not ported: the town spot

`MerchantScout.js` has it; `Merchant.js` does not, and neither does any of the
three party scripts. That is task 2, and it is still deliberately unstarted.
---

## 4. Measure a real sweep time, and justify or drop the 30-second hop floor

**Status:** not started. The one number in the docs is measured, but it is
measured on a different script from the one the fleet will run.

`Merchant.js` gates hops with nothing but "settle until loaded" and a
7-second `minPostGapMs`. That is what produced the **2.4 minute** sweep of 11
shards in `Codex/README.md`, and it is a real measurement.

`Codex/MerchantScout.js` carries `minHopIntervalMs: 30000`, enforced and
persisted through `SS.get('lastHop')`. Eleven shards therefore cannot sweep
faster than **5.5 minutes** on that script, before any scan, settle, post or
page load. It has never been run, so nobody has seen the real figure.

### The floor is settled — do not treat it as a cost to remove

`minHopIntervalMs: 30000` is a **deliberate design decision by the operator**,
not an unexplained constant. `change_server()` reloads the page, and a roamer
sweeping continuously does that thousands of times across a multi-day run. The
family member who will run these scouts raised the browser or game client
degrading or crashing under that load, and halving the hop rate is the agreed
mitigation.

So it is not a freshness knob. The sweep-time cost is known and accepted, and
anything built on top should inherit the floor rather than reason its way
around it.

One genuine follow-on, offered as consistency rather than as an argument:
`Merchant.js` has **no** hop floor, and it hops both to scout and to execute
arbitrage — an arbitrage trade with buyer and seller on different shards is
three hops on its own. If the crash concern is real, that script is the more
exposed of the two, and the mitigation is currently only on the one that has
never run.

### What is still worth measuring

**The real sweep time, and its spread.** Stamp `Date.now()` into CODE storage
on arrival and log the delta when the roamer returns to its starting shard.
The per-shard spread is the more useful half: a sweep that is 2 minutes of
scanning plus 4 minutes of one pathological shard wants a different fix from
one that is evenly slow. This is worth knowing regardless of the floor,
because the answer sets how stale our own rows are in the merge.

~~Worth doing before `FamilyFleet.js`'s roaming merchant is built, since the
floor is a choice that script has not made yet — its `hopTo` does not exist.~~

**Update:** `hopTo` now exists, and FamilyFleet made the opposite choice
deliberately: `CONFIG.hop.minIntervalMs` is **one hour**, not 30 seconds. It is
a merchant that also farms the account's gear economy, not a dedicated scout,
so it is not trying to sweep at all — coverage comes from the three parked
rangers. The crash concern the 30-second floor mitigates does not arise at one
hop an hour.

---

## 5. FamilyFleet: what it does not know yet

**Status:** the script is complete and tested (495 assertions) but has never
been run against the live game. These are the questions the tests cannot
answer, in the order they will bite.

### 5.0a First deploy on a NEW account — what was blocking it

Two hard deadlocks, both found by asking what a character with no gold and no
gear actually does on its first tick. Neither was reachable by any test in the
suite, because every fixture started a character that had already been farming.

**The potion deadlock.** `hpot1` is 100 gold and `buyTo` is 500, so a full
restock of both kinds is 100,000 gold. `buy` refused the whole order, the
character came back from town with nothing, `potionsLow()` was still true, and
the next tick sent it straight back. It never farmed, so it never earned the
gold for the potions it kept going to town to buy. Fixed two ways: buy what the
purse allows rather than all-or-nothing, and a trip that bought nothing sets
`potionsUnaffordable` so the ladder farms instead of retrying for
`potions.retryMs` (10 min).

**The empty-screen deadlock.** `farmTick` walked to the map's `(0, 0)` and then
looked for monsters in vision. On `main` that is the town end — goos are not
visible from there, so a character that arrived with an empty screen stood at
the origin indefinitely. That is every character's first tick on a new account.
`goToMonster()` now asks the game to route to the monster's spawn first, and
falls back to the old coordinate route if the client refuses that form.

Both are covered by tests 40–40c, which are the only ones in the suite that
start from nothing.

### 5.0 Rehearsing it on the wrong account

`CONFIG.safety.dryRun` exists for this. With it on, everything that spends,
sells, destroys, moves an item between bank and bag, or changes shard is
**logged instead of done** — while scanning, posting, reading Ponty and walking
all still happen, because a run that never arrives cannot show what it would do
on arrival.

This matters most for `sellSurplus`, whose rule is "anything the plan does not
want". The plan is a **ranger's**, so on a mixed account that rule covers
another class's gear. A dry run prints the list before any of it is real.

### 5a. ~~What a failed upgrade costs~~ — ANSWERED

**A failed upgrade destroys the item.** Confirmed by the operator.

Failure takes the item *and its progress*, so producing one at level N consumes
`1 / (p1 × … × pN)` fresh items. But **items are not the binding constraint —
gold is.** Expected total gold to produce one finished item from raw, computed
from the game's own scroll prices against its odds tables:

| slot | tier 1 | tier 2 | tier 3 |
|---|---|---|---|
| helmet | `helmet+6` 32k | `fury+4` 11.1M | `fury+8` **3B** |
| mainhand | `firebow+5` 501k | `firebow+9` 732.7M | `firebow+10` **49B** |
| chest | `coat+6` 32k | `coat+9` 19.1M | `tshirt9+4` 250k |
| offhand | `t2quiver+5` 3.6M | `t2quiver+7` 76.4M | `alloyquiver+9` **5B** |
| cape | `bcape+4` 250k | `ecape+7` 6.1M | `ecape+9` 980.6M |
| pants | `pants+6` 32k | `pants+9` 19.1M | `pants+10` **1B** |
| shoes | `shoes+6` 32k | `wingedboots+8` 10.8M | `wingedboots+10` **13B** |
| gloves | `gloves+6` 32k | `supermittens+5` 24.4M | `supermittens+6` 81.3M |
| earrings | `dexearring+1` 6k | `dexearring+4` 14.1M | `dexearring+5` 283M |
| belt | `dexbelt+1` 6k | `dexbelt+3` 858k | `dexbelt+5` 283M |
| orb | `orbg+1` 6k | `orbofdex+3` 3.4M | `orbofdex+5` **2B** |

Tier 1 is small change. Tier 2 is a serious project. **Tier 3 is not reachable
at all** — and no level cap was ever what stopped it. The merchant runs out of
gold and holds, which is correct and needs no help.

So `upgradeMaxLevel` is **gone**. What remains:

- `minUpgradeChance` **0.1** — lowered from 0.35, because the ratchet changed
  what a failure costs: every staked item has already been refused by all three
  rangers, so the loss is a scroll, not gear anyone was using.
- `maxScrollSpend` **2M** — denominated in the thing that actually runs out.
  Scroll price steps hard with item **grade**, and grade is per *item*, not per
  level: `fury` and `supermittens` are grade 2 from +0, so every attempt on them
  is a 1.6M `scroll2`. `cscroll2` is 9.2M — against a 10M floor that is the
  whole float on one roll of a 20% dice.

Nothing in the plan needs a scroll above grade 2, so Crun on `level2` stays out
of reach and `MAX_SCROLL_GRADE = 2` covers the whole plan.

### 5a-iii. The ratchet: one level, then hand it back

The merchant advances a staked item by **one level per bank window**, deposits
it, and does not take it back that visit. The rangers see it on their next three
windows and either take it or leave it; if it is still there, that is a fresh
decline and licence for one more level.

One level rather than a run to the target, because the decline that authorised
the stake was a verdict on the item **at the level the rangers saw**. A `fury+4`
nobody wanted says nothing about a `fury+5`, and pushing straight to +8 spends
seven more stakes on one verdict.

Two supporting fixes:

- **`copiesWanted` is per character, and three plan items fill two slots each.**
  `dexearring`, `dexring` and `suckerpunch` need **six**, not three. Reading
  `copiesWanted` straight had the bank call itself full at half stocked.
- **Surplus beyond the whole set is taken on sight**, with no cycle waited: a
  stack three copies larger than every slot on every character could hold needs
  no verdict, because no arrangement of them is wanted. Raw material below every
  tier target also needs none — nobody is wearing it.

### 5a-ii. "Offered and declined", and why the rota is the evidence

The copy count alone is a weak guard: it stalls tier progression whenever the
count is *exactly* right, which is the normal state, since three copies is what
the plan aims for.

The operator's answer falls out of the bank rota. Windows are :00 :05 :10 for
the rangers and **:15 for the merchant**, so between any two merchant visits
every ranger has had a window and has run `bankWithdrawUpgrades`, which takes
anything beating what it wears. An item still sitting there on the merchant's
next visit has been **offered to all three and declined by all three** — they
judged their own gear equal or better. Surplus demonstrated, not counted.

Two things have to hold, and both are checked rather than assumed:

1. **The merchant really is last.** `rotaSupportsDecline()` tests it; a roster
   edit that moves it logs loudly at startup and falls back to the copy count.
2. **The rangers were actually online.** A ranger that was offline never
   declined anything, and its silence would read as a verdict. The bridge
   already answers this for free — its reply lists live parked scouts by name —
   so a cycle only counts when all three appeared in it.

**What it cannot cover:** a ranger that is online and scanning but whose *bank
run* failed — no path, or a window eaten by a full bag. That reads as a decline
and is not one. `declineCycles` is the answer: set it to 2 and the same failure
has to happen twice running.

Compounding moved to the merchant outright, for the same reason. A compound
destroys all three on failure, and a ranger deciding that from its own bag is
deciding it half-blind: it cannot see the other two characters' holdings, the
bank between windows, or whether its three are the account's only three.

### 5b. ~~Ponty's price field~~ — ANSWERED, and it was a live bug

**There is no price field.** Ponty's socket payload carries none; the client
computes what it paints. Established during the standalone ALData work and
already written down in `Codex/_al_template.html`.

`normalisePonty` was probing `['price','cost','g','value','gold']` for one.
`g` is a perfectly plausible key for an item's **base** value — and Ponty
charges `g × buy_to_sell × secondhands_mult`, which is 1.2× base. A payload
carrying `g` would have under-quoted every listing by 20%, silently, in the
direction that looks like a bargain. The probe is gone; the price is always
derived.

Level 0 needs no page function at all (`g × 0.6 × 2`, verified four ways).
Levelled items still need the client's own routine, because level alone does
not determine the multiplier — Rugged Pants +1 is 1.43× base, Rugged Helmet +2
is 3.08×, Stinger +4 only 2.21×. Those stay unpriced when the routine cannot be
found, which `pontyBuy` reports as a count of skipped listings.

### 5c. ~~Does `sell` work at 129 units?~~ — ANSWERED

**Yes.** Both `buy` and `sell` work at Gabriel's 129.4 from the town spot, so
`sellSurplus` sells without walking, like everything else this character does.

`buy_from_pont` is still guarded on `typeof` — absent, it logs once and the
merchant carries on reading rather than throwing every rotation.

### 5e. What `character.home` actually looks like

`CONFIG.merchant.kissHomeOnly` is **on**: the anniversary kiss only fires on the
home shard, as the game records it. `homeShard()` reads `character.home` and
handles a string (`"USIV"`, `"US-IV"`) or an object (`{region, name}`), but the
real shape has **not** been confirmed against the live client.

It **fails closed**. If home cannot be read the kiss is skipped, because "we
could not tell" is not "we are home". So a wrong read presents as the kiss never
firing, with `anniversary: skipping X - cannot read character.home` in the log —
never as it firing everywhere.

One line in the console on a live character settles it:
`[character.home, typeof character.home, character.server, parent.server_region + parent.server_identifier]`.

### 5d. Not built, deliberately: `set_home` / Bean

`CONFIG.hop.trySetHome` and `setHomeCooldownMs` exist and **nothing reads
them.** Home is the gate hop sickness tests against, so moving it is the only
real cure — but `set_home` has a 36-hour cooldown, which cannot follow an
hourly rotation, and a roaming merchant has no single shard that being "home"
would help. On top of that the merchant is under level 60, where the condition
is never applied at all.

So the machinery would run and change nothing. Left as config with no reader,
which is visible, rather than as code that looks like a feature.

