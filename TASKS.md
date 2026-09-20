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

