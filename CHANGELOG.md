# Merchant.js changelog

Meltymerch (Merchant) - CODE slot `CH_aLtHealaSgKdmOsDWpNl8scE9NhXk`

Moved out of the Merchant.js header on 2026-09-21, because a slot that grows
without limit eventually stops evaluating and says nothing about it: v37 at
244,398 chars ran, v38 at 247,463 was accepted by `save_code` and then silently
never evaluated - the runner came up with `character` defined and every script
function undefined, with nothing in the console. The changelog had reached 9,255
chars of that budget, so the file was one ordinary commit from failing whatever
the commit did. It lives here now, and the header carries a pointer instead.

CORRECTED 2026-09-28: the number that failure produced, "roughly 240 KiB
(245,760 chars)", is NOT the ceiling. Measured in Meltymerch's live CODE context,
`typeof arbStockUnskip` and `typeof idleRestock` both return `function`, and
those two names exist only in v63 (257,241 chars) and v64 (260,646). So a build
6% past the supposed cap evaluates and runs, and v38's failure had some other
cause or some other threshold. Two lessons, and the second is the useful one.
The cap is unknown, not 245,760 - do not quote that figure as a limit. And
because it is unknown, the only safe procedure after a deploy is still to
FEATURE-DETECT something the new build alone has: an over-size slot fails by
running the old code silently, which is indistinguishable from a successful
deploy if you check the version string. -> CLAUDE.md, "Deploying a code slot"

Keeping this file lean is therefore still worth doing, on the same reasoning that
moved it here - it just is not a countdown to a known number.

Newest first. Entries through v62 are verbatim from the header they replaced;
v63 onward were written here directly, since the header stopped accumulating.

## v93

Opportunistic mluck on the whole party.

The merchant now buffs any party member who happens to be within range 320,
on any trip, without ever stopping, diverting or waiting to do it. The ranger's
own requested mluck trip is unchanged and still moves the merchant.

**The old list did two jobs and that was the bug.** `CONFIG.mluck.targets` was
`['Dexon']`, and it gated BOTH who could pull a trip and who ever got buffed. So
the priest and mage were never candidates at all. Measured on Dexon's client
2026-10-10, before the change:

| | mluck from | min left | strong |
|---|---|---|---|
| Dexon | **Meltymerch** | 52 | true |
| FatherToken | `earthMer` | 41 | false |
| MageofOz | `earthMer` | 40 | false |

A passing stranger's merchant was doing the job for two thirds of the party.
`tryCastMluck` would already have cast on them - `needsRefresh` is true whenever
`s.mluck.f` is not our name - so nothing but that one list stood in the way.

`targets` keeps its original job and its original value. A name in it can send a
`location` message and make the merchant move, divert and wait (-> summonAndWait),
which is exactly what the operator asked NOT to happen for the other two. The new
pass reads `CONFIG.partyMembers` instead.

**Why it hangs off maintenanceLoop.** That loop is the only timer in this file
that never moves the character. Putting the pass there makes "must not divert a
trip" structural rather than a rule to be remembered: the pass looks at who is in
range right now, casts if so, and otherwise does nothing until the next tick.
Out of range is not a problem to be solved, it is "not this tick" - there is no
pathing, no summon and no wait anywhere in it.

Measured from `G.skills.mluck`, game version 17665, 2026-10-10: level 40, mp 10,
range 320, cooldown 100ms, duration 3,600,000ms. Against Meltymerch's level 66
and 1,578 mp, cost is not a consideration - presence is the only variable.

**One cast per tick, and a 10s per-name cooloff.** The cooloff is not politeness,
it is the fix for a starvation bug the harness caught and reading did not. The
server does not apply the buff instantly, so a pass that casts one per tick
starting from the top of the list would re-read the first member as still
unbuffed, cast again, and NEVER reach the other two. `castCooloffMs` stamps every
attempt, win or lose, so the party rotates. Set it to 0 and the old behaviour
comes back.

**Refreshing our own buff is new, and deliberately instrumented rather than
asserted.** `tryCastMluck` has always refused to touch a buff that is already
ours at any remaining time, which is why the ranger still had to ask for a trip
as the hour ran out - and removing that ask is the point of this change. But
WHETHER A RECAST ACTUALLY RESETS `ms` IS NOT MEASURED on this account: the
server's apply path could not be read. So `refreshOursBelowMs` (30 min) drives
the refresh and the pass logs the before and after `ms` of every one, in-game and
in `parent.MLUCK_OPP().verified`, as `RESET WORKS` or `NO RESET`. If it turns out
to be a no-op, set `refreshOursBelowMs: 0` and the pass reverts to buffing only
what is not already ours, with no other change. Do not quote the refresh as
working until a `verified` row says so.

**Taking over a stranger's buff is attempted, not predicted.** The pass is
deliberately NOT gated on `buff.strong`. Whether a strong buff from another
merchant can be overwritten is unmeasured, so the cast goes out and the server
decides; a refusal parks that one name for `retryAfterFailMs` (5 min) and logs
the reason rather than retrying every 2s.

The one await is bounded with `arbNoHang`, this file's own idiom. **Merchant.js
still has no `noHang()`** - the pass sits inside maintenanceLoop's self-chain,
where an unbounded await that never settles would end the chain permanently and
silently, which is exactly what v71 did with `noHang` itself.

Read it with `parent.MLUCK_OPP()`: per-target visibility, range, buff source,
minutes left, the decision and why, plus counters and the refresh evidence.
Published onto `parent` because these declarations are lexical inside the file's
IIFE and a `parent.`-prefixed eval cannot see the bare name - the v90 lesson.

Harness: 61 assertions, including that no movement helper is reachable from the
pass, that an unsettled cast resolves in ~5s instead of hanging, that six ticks
reach all three members, and the live 2026-10-10 snapshot above resolving to
"skip Dexon, take over both strangers". The harness derives its config from
Merchant.js rather than restating it, after an earlier version of it omitted
`castCooloffMs` and reported a bug the shipped code did not have.

## v92

Ranger plan targets changed, craft materials protected and banked.

**THE RANGER MAINHAND IS bowofthedead, NOT firebow.** Measured 2026-10-10:

| | attack | range | crit |
|---|---|---|---|
| firebow+9 (was tier 2) | 97 | 135 | 0 |
| firebow+10 (was tier 3) | 115 | 160 | 0 |
| **bowofthedead+7** (now tier 2) | 82 | 121 | 2.45 |
| **bowofthedead+9** (now tier 3) | 104 | 151 | 3.15 |

Two things in there are easy to miss and are recorded on the table itself. The
grade break is at 5 for bowofthedead against 8 for firebow, so +7 and +9 both
sit inside grade 1 where cost per level is already raised - this is not the
cheap end of the curve firebow+7 would have been. And bowofthedead carries
speed -12, which firebow does not.

**GLOVES ARE thundergrips+7 FOR NOW.** supermittens remains the tier-3 target
and remains the better item under the DAMAGE-FIRST rule - at +5 it is
apiercing 47 / frequency 3 against thundergrips' 0 / 2 - but it is DROP-ONLY:
no craft recipe, no token price, no NPC source. thundergrips is craftable, so
it is the reachable item in that slot, exactly as frankypants is in pants
rather than an off-plan substitute. Tier 3 was deliberately left alone.

**CONFIG.materials.keepAndBank NOW ACTUALLY BANKS.** It has been documented
since it was created as "never vendored and banked on sight", but
isKeptMaterial() was only ever read by the two sell guards - nothing banked
anything, so essenceofether has been protected-but-never-banked the whole
time. This adds the missing half.

Kept materials RIDE an existing bank trip and never cause one: they are
collected after the `!toBank.length` early return, so a pile of stormfeather
cannot pull the merchant off arbitrage for a walk of its own.

**AND THEY GO IN ONE COMBINED, DESCENDING PASS.** The first cut of this stored
materials first and gear second, from two lists captured beforehand - which
silently breaks the guarantee the original loop's "highest index first" comment
exists to provide, because bank_store nulls a slot and every index behind it
shifts. The second list would have been pointing at the wrong items. One list,
sorted once.

New names: stormfeather, ashleaf, embercore, essenceoffire, joining
essenceofether. They cover the inputs for both pieces being chased -
thundergrips (mrngloves+6, 80 stormfeather, 12 essenceofether) and emberhood
(mmhat+5, embercore, 8 essenceoffire, 20 ashleaf).

**WHAT WAS DELIBERATELY NOT DONE.** ashleaf, embercore and essenceoffire go on
pontyBuy ONLY - not standBuy, so they are never chased on a player stand.
stormfeather is protected but NOT bought at all: the operator holds 1,963 and
farms them easily. And none of the four went into NO_TRADE_ITEM_NAMES, which
would have been the stricter protection: that set is applied at flip ingestion
and forbids BUYING as well as selling, which would have killed the Ponty buys
in the same stroke. The residual exposure - arbitrage flipping one - was
weighed and accepted rather than overlooked.

20 assertions. The load-bearing ones are that materials alone never trigger a
trip, that every item still lands when gear and materials are interleaved in
the inventory, and that the priest table was untouched by the gloves edit -
`supermittens` at level 5 appeared in both tables, so a careless anchor would
have changed both.

## v91

A pasted buy now freezes the rotation, and will cross a shard to reach the
listing.

**THE RACE, WHICH WAS REAL AND SILENT.** v89 and v90 took only the move lock -
and only indirectly, by way of `moveTo`. That stops other MOVEMENT. It does not
stop the scout, whose shard hop is gated on `state.busy` and `PROBE.hold`,
neither of which a buy ever touched. So the rotation could fire
`change_server` while the merchant was walking to a stand, reload the page, and
destroy an in-flight purchase with nothing logged anywhere. The gate's own
comment already spelled out the consequence: "A probe is measuring. Never hop -
a hop reloads the page."

`sbBuyNow` now takes `PROBE.hold` for the whole walk and releases it in a
`finally`, so a throw, a refusal at the stand or a death cannot leave the
merchant frozen off its rotation for the rest of the session. An operator hold
that was already on is left on rather than cleared.

**CROSSING A SHARD, WHICH v90 REFUSED TO DO.** It refused for a good reason -
`arbProbeGo()` calls `change_server`, the page reloads, and the pasted command
dies with it. The fix is to stop treating the buy as a single call: the row is
stashed in CODE storage, which survives the reload (the same mechanism
`probe_hold` already leans on for exactly this reason), the hop fires, and
`sbPendingResume()` picks it up on the other side.

Four rules keep a stored purchase from becoming a liability:

- **The record is cleared BEFORE it is acted on, never after.** A buy that
  throws must not leave something armed that fires again on the next load. A
  stored purchase that retries forever is worse than one quietly dropped.
- **It will not hop twice** chasing one listing (`pendingMaxHops`).
- **Landing on the wrong shard drops it** instead of hopping again, which is how
  a merchant would otherwise bounce between shards indefinitely.
- **Ten minutes and it expires.** By then the listing has very likely moved, and
  `sbVerify` would refuse it at the stand anyway.

One more, less obvious: if the stash cannot be WRITTEN, it does not hop at all.
Hopping with nowhere to record the intent is how you lose the command and the
knowledge of what it was for.

New knobs under `CONFIG.standBuy`: `pendingMs` 600000, `pendingResumeMs` 9000,
`pendingMaxHops` 1.

Built on top of commit `30cfcc2` rather than beside it - see the note under v90
about the version number.

16 assertions. The load-bearing ones are the two that are easy not to think of:
that the hold is taken BEFORE the approach rather than on arrival, and that a
failed resume leaves nothing armed behind it.

## v90

PROBE_API is now bound in the CODE scope too, which is where it gets pasted.

v89 published the API on `parent` alone. Inside the maincode iframe
`window !== parent`, and the eval box - the one place these commands are meant
to be typed - runs there. So every single pasted command answered:

```
eval ReferenceError: PROBE_API is not defined
```

including every `copy buy` string the watchlist page produced. The feature
shipped unusable in its intended spot and the tests did not catch it, because
they exercised `sbBuyNow` directly and never the name it is reached by.

MEASURED 2026-10-10 in Meltymerch's live context, which is what settled it:

| expression | result |
|---|---|
| `typeof PROBE_API` | **undefined** |
| `typeof window.PROBE_API` | **undefined** |
| `typeof parent.PROBE_API` | object, with `buyNow` on it |
| `window === parent` | **false** |

The parent assignment STAYS - /hub and any top-window console reach it there,
and dropping it would break the other direction. This adds
`window.PROBE_API = parent.PROBE_API` so the short name resolves in the CODE
scope as well. Both names are the same object, so there is no second copy to
drift.

**A NOTE ON THIS VERSION NUMBER.** v90 names two separate things. The operator
committed `30cfcc2` independently, bumping the header to v90 and adding
`voidthread` and `essenceofether` to `pontyBuy.items`; the PROBE_API fix
described above was built against v89 at the same time and also called itself
v90. Both are in the file. v91 was then rebased onto `30cfcc2` so the two
pontyBuy items survive - a straight overwrite would have reverted them
silently, which is exactly the stale-base failure CLAUDE.md warns about under
"Handing code to the other chat".

The page half is fixed in the same pass: `buyCommand()` in
`Codex/_al_template.html` now emits the **parent-prefixed** form. That is
deliberate and should not be tidied back - `parent.PROBE_API` resolves in both
scopes, because where `window` is already the top, `parent === window`. One
string therefore works against a merchant that only published to parent and
one that also binds the short name.

THE REUSABLE PART: a feature can be fully tested and still be unreachable. Nine
assertions covered what `sbBuyNow` does and none covered how it is named, so
the gap sat exactly where the tests were not looking. 8 new assertions now
cover the publish block itself, in a fixture where `window !== parent` - and
one of them exists only to prove the fixture has not collapsed the two scopes,
since that is the entire bug.

## v89

A per-row buy override, pasted from the watchlist page.

The Codex market tab now renders a **copy buy** button on every ordinary gold
listing, and the string it copies is one call:

```js
PROBE_API.buyNow({shard:"USI",seller:"Alpha",map:"main",x:13,y:-34,
                  slot:"trade3",name:"firebow",level:2,price:1000000,q:1})
```

Paste it into Meltymerch and he walks to that stand and buys that slot. The
point is the gap it closes: the automatic pass only ever bought what was on
`CONFIG.standBuy.items` under `maxPrice`, so a listing the operator could see
and wanted had no route to a purchase short of editing config and waiting for
the next scan.

**An override overrides - but it says what it is overriding.** `sbBuyNow` keeps
`sbVerify` (the listing is re-read at the stand, and a price that moved or a
slot that emptied is refused) and deliberately skips `sbCap` and `sbGate`,
logging each one it walked past:

- over the per-item cap -> `override: 4000000 is over the 500000 cap for
  firebow - buying anyway`
- a gate the automatic pass would have failed -> `override: the automatic pass
  would have stopped here (gold floor) - buying anyway`

A silent override and a buy that happened to be in policy are
indistinguishable afterwards, which is the whole reason for those two lines.
`CONFIG.standBuy.dryRun` is still honoured: it is the operator's own switch,
not a safety rail this is bypassing.

**It will not cross shards by itself.** The command carries `shard`, and on a
mismatch it refuses BEFORE walking and names the hop, because `arbProbeGo()`
reloads the page - a hop fired from a pasted command would take the paste with
it.

**Arrival is judged by the inventory, not by the reply.** `trade_buy` can
reject and still deliver; a refusal with the item present reports the buy and
notes the mismatch, and nothing arriving while gold left says `CHECK THIS`
rather than a tidy failure.

The page half is inert without this build - the button copies a call to
`PROBE_API.buyNow`, which does not exist before v89.

10 assertions over sbBuyNow: the happy path walks/verifies/buys the named slot,
a wrong shard refuses before walking and names the hop, a listing that changed
is refused, an unreachable seller is reported rather than skipped, both
override paths buy and log, dryRun still blocks, a refusal that delivered is
trusted, missing gold with no item is flagged, and an incomplete row is refused
with guidance.

## v88

The scout now reports what a barter stand wants.

Stands can be posted for goods instead of gold. Those slots carry `want` -
`{name, q, level?}` - and no price. The scout was dropping it, so the whole
Codex watchlist believed the information did not exist.

**A FIXED WHITELIST IS A SLOW LEAK.** `scoutScanStands()` rebuilt every slot
from seven named fields:

```js
slots[k] = { name, price, b, q, level, p, stat_type };
```

Anything the game adds afterwards is silently dropped on the way through, and
barter listings are exactly that. The symptom was a perfectly uniform field
census on the bridge - all seven fields present on all 741 slots - against a
ragged one from the game feed, which is what a rebuild looks like next to a
pass-through. `want` now rides along; a slot without one reports null, which is
what every slot looked like before.

MEASURED 2026-10-10, and the measurement is the point:

| source | slots | unpriced | carrying `want` |
|---|---|---|---|
| ALData | 2,223 | 62 | **62** |
| game `pull_merchants` | 643 | 23 | **23** |
| bridge (before this) | 632 | 632 | **0** |

Both upstream sources carry it on precisely the unpriced slots. Only our own
copy lacked it. Real asks from the live feed: a vhammer for 66 cave_amber, a
vhammer+3 for one scroll3, 50 slice_strawberry for 30 slice_honey.

**HOW THE WRONG CONCLUSION GOT DRAWN**, because it is the reusable part. The
watchlist's Item Trades tab shipped saying "pull_merchants does not publish what
the owner wants in exchange". That came from inventorying the BRIDGE copy and
generalising to every source - the one source that had been through this
whitelist. Checking either upstream feed would have shown it in a single call.
A field census taken downstream of your own normaliser measures the normaliser,
not the feed.

`cache_item(item, true)` strips only grace/o/oo/src, so `want` reaches
`entities[].slots` intact; nothing else was in the way. The bridge stores
`slots` verbatim and needed no change.

7 assertions over scoutScanStands: want preserved with and without a level,
quantity defaulting to 1, a malformed or absent want reported as null rather
than throwing, an ordinary gold listing unchanged, equipment slots and NPCs
still excluded, and the result surviving a JSON round trip - which is what the
POST to /scan actually does to it.

## v87

The summon wait now actually waits. Observed: Meltymerch asks a party member to
come to him, publishes his coordinates, and then wanders off before they get
there - ending in "<name> never arrived - giving up on remaining actions this
trip", which reads like the recipient's fault and is not.

**summonAndWait never took the move lock.** It published a position and polled
for 60 s without holding `state.travelling`, so every other loop in the file -
the scout, the stand, gear progression, arbitrage, the maintenance beat - was
free to walk him off the spot he had just sent. It now holds the lock for the
whole wait and releases it in a `finally`, so a death or an early arrival
cannot wedge it. The lock ceiling is 180 s against a 60 s wait, comfortably
inside the break-open threshold.

**It also cancels whatever was already walking him**, with a `stop()` before
reading the position - otherwise the coordinates published are a point he is
still moving away from. The loser of that race sees an interrupted move and
backs off; its retry fails fast on the lock, which travelTo already treats as
"not a broken trip".

**And a drift check, because the lock is not quite enough.** The lock stops
anything routing through `moveTo()`; it cannot stop a raw `move()` elsewhere,
knockback, or a move that was already in flight. So the poll notices when he is
more than `driftUnits` (60) from the spot he published, or on another map, and
re-publishes rather than letting them walk to an empty patch of ground.

New knobs under `CONFIG.summon`: `waitMs` 60000, `pollMs` 1000, `driftUnits` 60.

9 assertions. The load-bearing one samples `moveLockHeld()` on a timer DURING
the wait rather than checking it before and after - the bug was entirely about
what is true in the middle, and a before/after assertion would have passed over
v86 unchanged. The others cover the lock being released afterwards and after a
death, the stop, publishing once from where he actually stands, re-publishing
on drift but not on a 20-unit shuffle, and both outcomes.

## v86

v85's recall was actively harmful and is fixed here. Observed live: the merchant
left main for the party and ended up stuck on **mtunnel**, nowhere near the
route.

```
[town] recall on main from 294,-347 - about 2.3s better than walking
[town] recall cancelled - already walking, carrying on
Searching for a path...   Path found!   Lost the path...
Still can't reach spookytown after town() - Meltymerch is stuck on mtunnel
```

Three faults, all mine, all in the gating rather than the mechanism.

**The floor was far too low.** `margin: 40` units is 0.6 s at speed 67, so a hop
worth 2.3 s passed. It is now `minSaveSec`, a floor in SECONDS, default 5. That
cleanly separates the two legs worth taking (17.5 s and 21.5 s) from noise.

**It priced mid-route, where the comparison is invalid.** Straight-line distance
to the goal is not monotonic along a real route - the pathfinder walks AWAY from
the goal to get round terrain, and the western approach to the corridor is the
extreme case - so small positive readings are noise, not savings. Worse, a
teleport mid-route forces a `path_lost` re-plan, and main has THREE separate
mtunnel doors for a confused re-plan to wander into. The watcher now only
watches for the map to CHANGE and decides once per map, which is the only moment
the straight-line comparison is actually valid for. `rageNav.busy` is a hard
interlock on top of that.

**It priced legs it was not standing on**, using a BFS of the door graph to
guess which door we would leave by. That chain need not match smart_move's, and
the walk-along then drove raw `move()` toward a door the route was never going
to use. `townGoal` is now same-map only and `townNextDoor` is deleted.

What survives is the part that was right: 3 s channel, cancelled by a single
monster hit, `town()` reporting success either way so arrival is judged by
position, and the walk-along making a cancelled attempt free. The two legs still
caught are the two biggest - arriving on main 1,836 units from the town spot
(+21.5 s) and arriving on spookytown 2,408 units from the corridor (+17.5 s).
The forgone case is the corridor -> halloween-door leg on the way home, worth
12 s, which is not worth guessing a door chain for.

18 assertions, plus the 12 rage ones. New: the gate declines off-map, the
outbound spookytown hop is priced at 17.5 s, a hop during `rageNav.busy` is
refused, exactly ONE recall fires on the whole trip home, and a regression for
the precise 2.3 s hop that caused this - 548 units from the town spot, which
v85 took and v86 must refuse.

The lesson worth keeping: v85 shipped with 18 green assertions and was wrong in
production within the hour. Every one of them tested the hop in isolation, at a
standing start. None simulated a route whose distance-to-goal went UP on the way
- which is the normal case, not the exotic one.

## v85

The 3 second town recall, taken on the legs where it beats walking. About
33.5 s off every trip home from the combat party's corridor.

**It was never used as a shortcut.** v84 called `town()` in three places, all of
them failure fallbacks after a walk had already thrown. Nothing ever chose it.

**The numbers.** spookytown has no door to main - the chain is
spookytown -> halloween -> main, entering main at spawn 15, `(1600,-524)`,
almost diagonally opposite the town spot. Meltymerch at speed 67:

| leg | walk | town() | saving |
|---|---|---|---|
| spookytown corridor -> halloween door | 2,452u / 36.6s | 24.6s | **+12.0s** |
| halloween entry -> main door | 1,283u / 19.1s | 21.2s | **-2.1s** |
| main entry -> town spot | 1,836u / 27.4s | 5.9s | **+21.5s** |
| whole trip home | **83.1s** | **49.7s** | **+33.5s** |

Straight-line, so those are floors: the walking legs curve around terrain and
the recall leg does not.

**Gated per leg, not by `smart.use_town`.** smart_move does support a town edge,
but it pushes it into the pathfinder as a single graph step with no cost
attached, so the planner cannot see that it costs 3 s - it would take the
halloween leg too and hand back 2.1 s. (It is also a persistent global on the
`smart` object, not an argument; smart_move reads only x, y, map and to from
what it is passed.) `townWorthIt()` compares real distances instead: recall when
`here > spawn_to_goal + 3s*speed + margin`. On main that breakeven is 394 units,
which rules out every in-town errand hop - Ponty at 116, Ernis at 166, the town
spot at 193 from spawn.

**Two things the server source settled, both load-bearing.**

A SINGLE monster hit cancels the channel: in the monster-attacks-player branch
`target.c = {}` sits OUTSIDE the lethal-damage check. And the client cannot tell
- `town()` waits only for `character.c.town` to clear, which happens on
cancellation too, then returns `{success:true}` either way. Arrival is decided
by looking at where the character actually is, never by that promise.

The server LETS YOU WALK while channeling - its move handler gates on
`can_walk()`, which tests `is_disabled()` and not `c.town` - but smart_move will
not, because its step loop requires `!is_transporting(character)`. So the
walk-along is driven with raw `move()`. The operator's design, and it makes a
cancelled channel free: instead of 3 s standing still the merchant is
3 s * speed further along the road it was going to walk anyway. It does not
change the success case - the teleport still fires at 3 s and discards the
walking - which is why the gate still earns its keep.

**THE DESIGN WAS WRONG FIRST TIME, and the correction is the useful part.** The
first build staged the trip leg by leg over a BFS of the door graph, on my
belief that one cross-map smart_move would walk straight past the main-entry
hop because it only becomes visible after arriving on main. The operator said
that firing the skill should not cancel a smart_move already in flight. He was
right, on three counts checked in the client source:

- `town()` and `use("town")` reach `request("town","town")` and touch nothing on
  the `smart` object; `smart.moving` and `smart.plot` are untouched.
- the step loop gates on `!is_transporting(character)`, so it merely PAUSES for
  the channel rather than failing.
- after the teleport the next plot point fails `can_move_to()` from the spawn,
  so the loop takes its `path_lost` branch and re-issues `smart_move` to the
  same destination with the same `on_done` - it re-plans itself and the original
  promise still resolves.

So `townTravel` now lets ONE smart_move own the route and runs a watcher
alongside it that re-prices the hop every `watchMs` and takes it when the gate
turns true - before departure, and again on each map as it is entered. That
keeps smart_move's own route choice, which the staging version was overriding
with a door BFS for no good reason. `townNextDoor` survives only to PRICE a leg
we are not yet standing on, never to route one. A cancelled hop leaves the
character still worth-it, so attempts are bounded by `minGapMs` and
`maxPerMap`. `CONFIG.town.enabled = false` restores v84 behaviour exactly, with
a test asserting it.

18 assertions, plus the 12 rage ones re-run. They check against the measured
savings rather than just truthiness, assert the hop reports false while `town()`
reports success, assert a cancelled attempt still gained ground, and assert
smart_move is called exactly ONCE for the whole trip - which is what would have
caught the staging design had it been written first.

Two harness faults worth recording, both of which produced green or misleading
runs over code that was wrong. The first set `channelMs` to 60 to keep tests
fast, which also made the gate price the channel at 4 units instead of 201 and
bless the losing leg: the stub's duration and the gate's cost have to be
separate numbers. The second simulated the whole cross-map trip in ~10 ms, so
the 400 ms watcher never observed main and only one recall fired - a stub has to
take long enough for the thing being tested to get a turn.

## v84

The pathing the combat party needed, and the merchant was a version behind on
all of it. v83 shipped the rage module as it stood BEFORE the trio's v79/v80
fixes, so every fault those found was still live here - including the one that
would have stopped him reaching the party at all.

**He still had the v78 per-edge `can_move` check in the BFS.** The trio dropped
it in v79; the merchant never got that commit. Its comment in this file asserted
that verifying every edge was correct, which is the stale-documentation trap:
the text read as a finding and was actually a bug with a rationale attached.

**The guard had no hysteresis.** `rageGuard` tested `rageHit(x, y, cfg.margin)`
- the same margin the planner aims for - so arriving at a correctly-planned
destination counted as a breach: stop, shove out, travel walks back, forever.
Measured on the combat party before it was fixed there: 11 stop/xmove pairs in
5 seconds, hp full and `targets` 0, twenty consecutive `smart_move` calls dying
as `{"reason":"interrupted"}` with the character never moving. Now `guardMargin`,
default 0 - detect on the real rectangle, escape out to margin.

**The effective clearance was 55, not 30.** `rageRoute` excludes cells within
`margin + step`, and 30 + 25 = 55. The corridor's entrance is a pinch measured at
14-18 units wide, so "no safe route" was literally true every time. Now
margin 4 + step 5 = 9, and step 25 -> 5 because a 10-unit grid cannot resolve a
14-unit gap at any margin. `maxCells` 24,000 -> 200,000 so the doubling loop
cannot quietly push the step back up and undo it.

**The search ran off the map.** `can_move` answers for points outside the
geometry, so the flood walked into the void and spent its budget there: 400,000
expansions on a map holding ~19,000 cells. Clamped to `G.geometry` the same
search exhausts honestly in 12,164. That one was wrong on every map, not just
spookytown.

Also added: `rageWaypoints` and `CONFIG.movement.approaches`, carrying the
operator's hand-drawn western approach to the corridor, tried before the search
and refused if any of its own points sit inside a rectangle.

WHY HE NEEDS ANY OF IT. The combat party now farms booboo parked at (290,-990),
inside the corridor between the mummy and booboo rectangles, and the corridor is
reachable only through that pinch. `travelToRecipient` goes to the recipient's
live position and then closes to attack range for `send_item`, so potion
delivery and item pickup both put him in there. mluck reaches 320 and would
often not need the trip, but the deliveries do.

All twelve shared nav functions - `rageCfg`, `rageBoxes`, `rageHit`,
`rageClips`, `rageEscape`, `rageRoute`, `rageWaypoints`, `rageWalk`,
`rageGuard`, `safeMove`, `safeSmartMove`, `rageStaging` - are now byte-identical
to Ranger v80, checked by hash rather than by eye. The divergence found here is
the argument for doing that check every time this module is touched in one file.

12 assertions green against the merchant's own extracted module, the same suite
the trio runs minus the two that are specific to the ranger's pull queue.

## v83

Two unrelated things the merchant did not know about.

**Rage boxes.** `G.maps[map].monsters[i]` can carry a `rage` rectangle beside its
`boundary`; stepping inside aggros the whole pack AND applies the monster's own
rage multiplier, 1.5 on spookytown. Measured 2026-10-09 in the live client: mummy
boundary `[31,-1571,480,-1293]` with rage `[-124,-1631,614,-1130]`, a halo 130-165
units larger, and both booboo packs with rage identical to their boundary.
stoneworm, mrgreen and jr carry no rage field at all.

This matters to a merchant because of where the combat party now stands. The
booboo/mummy achievement farm parks on the corridor BETWEEN the two rectangles,
so every errand that walks to a party member - item pickup, mluck, potion
delivery - is a walk toward a character sitting beside a rage box. The nudge in
`travelToRecipient` was the sharp edge: it moves to the recipient's own
coordinates, which can be inside one.

Only the navigation half of the rage module ships here - the merchant never
pulls, so `ragePullTick`, `rageHoldFire` and the rest are deliberately absent
rather than merely unused. That is not tidiness: referencing an undeclared
identifier THROWS in this CODE context rather than evaluating to undefined (see
CLAUDE.md, "Helpers that may not exist"), and the pull half reads `home` and
`destination`, neither of which exists in this file. The trimmed module is
exercised by a harness in a merchant-shaped sandbox with no `home`, no
`destination`, no `CONFIG.party` and no `CONFIG.achievements`, for exactly that
reason.

Three guards, and the first covers almost everything because the movement layer
is already well factored: `moveTo` is the single choke point every trip funnels
through, so `smart_move` there became `safeSmartMove`. The `travelToRecipient`
nudge became `safeMove`. `rageGuard` runs in `maintenanceLoop` as the net for
arriving inside one some other way. Routes come from a four-connected BFS with
the rectangles treated as solid and every explored EDGE verified by `can_move`,
simplified so each leg is straight-line clear and then walked with `xmove` -
`smart_move`'s pathfinder knows nothing about rage boxes and the interior is
ordinary open ground, so it will cut the corner through one. All of it no-ops on
a map with no rage boxes, which is every map but spookytown today.

**essenceofether is kept and banked.** It gates EIGHT craft recipes - windbelt,
scribeorb, moonshardearring and reunionbow at 4 each, gloampendant 6, stormquiver
8, thundergrips 12, starcloak 40 - and the party has no reliable source: booboo
drop it at 0.5% behind a rage box, cutebee at 0.3709% but one spawn per 480,000
bees, and glitch and lglitch are not in the deployed client data at all, only
their drop tables. rgoo in Goo Brawl at 1-in-10,784 is the only tap currently
reachable. Vendoring one throws away a gate, not a material.

`sellTrash` was already safe - it only vendors `CONFIG.selling.whitelist`, which
essenceofether was never on. The exposure was `sellAggressivelyIfLowOnSpace`,
which vendors nearly anything not explicitly protected. New
`CONFIG.materials.keepAndBank` with `isKeptMaterial()`, checked at BOTH disposal
sites beside the existing `isExchangeable` guard, and folded into
`bankExchangeables` so it is banked on every bank arrival - that function is
already hooked on `travelToBank`, which is the one choke point every bank visit
in the file passes through, so it needs no trip of its own.

14 assertions green.

## v82

The merchant kept walking to Ponty for items that were not there, hopping away
and asking again about twenty seconds later.

`arbNoteFailure` returns before writing for any NPC target, and `arbFailBlocked`
returns false for one. That rule is correct and stays: Ponty carries 300+ rows
per shard, so shelving HIM would close most of the pipeline, and an NPC listing
going is a fact about the listing rather than about the vendor. The gap was that
nothing recorded the LISTING either, so the flip finder re-proposed the identical
row from the same cached scan on its very next pass.

Measured 2026-10-06 from the bridge ledger: 187 Ponty abandons in 24h across
SEVEN distinct items - `ftrinket+0` 63 times, `ololipop+0` 51, `cryptkey+0` 34,
`snakeoil+0` 32 - a 96.3% repeat rate, median 22 seconds between retries of the
same item (min 12, p90 31). Roughly 68 minutes of the day spent hopping for
absent stock, and because only one trade runs at a time it blocked every other
candidate while it did. Those same items are also the window's top three profit
earners, so these are real flips being lost to a race, not phantoms.

The other half is the feed: `/ponty` rows measured 363-941s old (median 440s)
against stock that rotates faster, so planning off a seven-minute-old snapshot is
the normal case. Neither fault alone loops - stale data without the memory gap
fails once and moves on.

Adds `arb_gone`, keyed `shard|vendor|item+level` with a TTL of
`CONFIG.arbitrage.goneForgetMs` (12 minutes, chosen to outlast the scan that
produced the dead row). Written on the `item_gone` path, checked in the flip
filter beside the two existing suppression tests. Keyed by VENDOR as well as
shard, so the same item from a player stand on that shard remains available -
keying on the item alone would have suppressed good offers.

Abandon records now also carry `buyShard`, `item` and `level`. Without them the
ledger could not say which shard a Ponty failure happened on, which is why the
repeat loop stayed invisible until it was counted by item name alone.

Also corrects stale figures in the mage tier-3 comment, deferred by the operator
on 2026-10-05: gstaff+9 is 153 attack / 140 range against sparkstaff+9's 140 /
130. Both numbers in the old text were low and the gap is 13, not 12.5. Measured
with `calculate_item_properties`. The comment's conclusions are unaffected.

NOTE: v80 and v81 have no entries here. v80 moved Dexon's tier-2 chest to
`mrnarmor+7` and v81 the mage's to `mmarmor+7`; both are described in comments at
those rows but were never written up here.

## v79

Six fallback prices had been set to the item's vendor `g`, and two of those sat
below it. That is the one direction that costs items.

A fallback BELOW the real value does not make the planner cautious - it makes it
confident. `pickBestValueStep` weighs the copy against the scroll, so a cheap
copy justifies a cheap scroll and a low success rate, and the step goes ahead.
Set `zapper` at its g of 6,400,000 and the planner happily compounds a ring that
has a live 2,000,000,000 buy order against it. That is the starkillers failure
with a different item id.

Measured against the live market, 2026-10-04:

      item          was (= vendor g)      now            basis
      zapper               6,400,000    2,000,000,000    +0 buy order
      mpxgloves           34,000,000    3,000,000,000    +0 buy order
      suckerpunch          2,000,000    2,000,000,000    +0 ask, with a 30-deep
                                                         bid at 1,100,000,000
      fury                 6,400,000      300,000,000    +0 buy order, 10 deep
      mpxamulet           56,000,000      300,000,000    +0 buy order
      firebow                100,000          267,000    +0 ask

What it changes in practice: `zapper`, `mpxgloves` and `suckerpunch` now hand
over at +0 instead of rolling to +1, +4 and +2, and `fury` stops at +2 instead
of +6. For items worth two and three billion, +0 is the right answer.

`firebow` reaches +8 either way, so that one is only an honesty fix - and its
fallback is nearly unreachable anyway, since it is on PONTY_PRICED_ITEMS and the
Ponty price is computed rather than observed.

DUPLICATE KEY. Both tables carried `mshield` twice - 720,001 and then 720,000.
A duplicate key in an object literal is silently taken by the last writer, so
the first was dead and nothing anywhere could show it: the evaluated object has
one `mshield`, and only the source text has two. The values were a gold apart so
nothing moved, but the next one might not be.

The harness now parses the table out of the SOURCE TEXT rather than reading the
evaluated object, precisely because the object cannot show a shadowed key, and
asserts no entry equals its item's vendor g. Against the previous version those
two guards fail 5 times - one for the duplicate, four for the g-copies.

WHY g IS NEVER THE ANSWER. It is a vendor number and it is wrong by orders of
magnitude exactly where the money is: `tshirt9`'s g is 120 against a real
2,000,000,000, `zapper`'s is 6,400,000 against a live 2,000,000,000 bid. A note
to that effect now sits above the table.

## v78

Split the price table in two, and carried the same split plus two real fixes
into UpgradeCompound.js v5.

OVERRIDE AND FALLBACK ARE DIFFERENT THINGS, and v77 conflated them.
`GEAR_VALUE_OVERRIDES` held seven derived numbers AND was the first thing
checked, so there was nowhere to put an operator decision that would not be
mixed in with values this script had worked out for itself. Now:

  GEAR_VALUE_OVERRIDES   empty, yours. Beats every other source, market included.
  GEAR_VALUE_FALLBACK    the derived numbers. Consulted LAST, after Ponty and
                         after a pair of agreeing market anchors.

The behavioural change: a live anchor now BEATS the flat values. gcape, sbelt
and tshirt9 at 2,000,000,000 were set "for now", which is fallback semantics -
a floor that keeps the planner working while the market is silent, not a claim
about what the item is worth today. If you want one of them to hold against the
market, put it in GEAR_VALUE_OVERRIDES and it will.

Divergent anchors still fall THROUGH to the fallback rather than handing the
item over, so a parking price no longer costs progress on an item whose value
is otherwise known.

ecape = 126,000, and it is a derivation rather than a quote. The market cannot
price this item: the three live anchors back-solve to +0 bases of 1, 548,887
and 29,473,137 - seven orders of magnitude apart - because from a base of even
100,000 the expected cost to reach +9 is 1.14 BILLION, so the +9s on the market
sit far below their own build cost and came from luck, not from anybody rolling
them. Inverting a chain of 1.8% and 6.6% steps amplifies any error without
limit.

The drop table answers it instead. ecape and rabbitsfoot come out of the SAME
container, `basketofeggs` (g 20,000, e 1), at weights 1 and 0.001 of a 5.721
total - so ecape is exactly one thousandth of rabbitsfoot whatever a basket
costs, and rabbitsfoot is already set at 126,000,000 from the funtoken route.
Cross-check: pricing the basket at its own Ponty value (24,000) implies
rabbitsfoot 137,304,000 against the funtoken figure of 126,000,000, 9% apart by
two completely unrelated routes. At 126,000 ecape runs to +8 and stops on
wants_offering, clearing both T2 targets (+7) and one short of T3 (+9).

UpgradeCompound.js v5 - TWO REAL DEFECTS, and one I was wrong about.

1. `ucPlan` divided by an unclamped probability. `ucUpgradeChance` caps at
   min(base + 0.36, base * 3) with NO clamp to 1 - correct, because the server
   rolls Math.random() < probability and anything at or above 1 just means
   certain - but ucPlan then divided by it. Measured on mmhat: without the
   clamp E[+2] comes back 9,880,919 against inputs of 10,000,198, a level
   cheaper than the copy going into it. It also biases the choice toward
   offerings, since offerings are exactly what push p past 1.

2. The planner could choose `offeringp` and `offeringx`, which are RETIRED -
   both carry "ignore": true in design/items.js, which is the measured reason
   no NPC stocks them. Verified by mutation: hand the planner the full offering
   list and it picks offeringp immediately. ucSource then resolves it to
   market, ucAcquire fails, and the run stops partway up a ladder it had
   already printed as a plan. UC_OFFERINGS keeps all four entries because that
   array is indexed by grade and the chance maths needs them; the new
   UC_PLANNABLE_OFFERINGS is what the planner iterates.

3. NOT a defect, recorded so it is not "fixed" later: UC plans with every grace
   term at zero, which is right - a hypothetical +0 copy has no grace - and at
   roll time it calls the game's own calculation mode (`upgrade(..., true)`)
   for the exact chance with grace included, and gates MIN_CHANCE on that. The
   igrade/igrace sign error fixed in Merchant v77 has no equivalent here.

UC also gains PRICE_FALLBACK with the same eight values, consulted after Ponty,
the fresh ask, the historical ask and the NPC price. PRICE_OVERRIDES stays
empty. Keep the two tables in step - a value that differs between the files
means the merchant and the tool that takes over from it disagree about what the
same item is worth.

Still different between the two, deliberately: Merchant values the copy at its
CURRENT level from the live market when anyone is trading it there
(gvCarriedValue), while UC always uses the recurrence walked up from +0. UC is
not wrong - it never had the carried-value bug - but the two can put different
numbers on the same +6 copy.

HARNESSES. v78test.js, 61 assertions; reverting to override-first semantics
fails 3. uc5test.js, 23 assertions; removing the clamp fails 1, handing the
planner the retired offerings fails 1, dropping the fallback tier fails 2.

## v77

Tier-2/tier-3 gear steps are now planned with the copy's own value in the
arithmetic, and hand the item over instead of gambling once the cheapest move
needs something no NPC sells. Four separate defects came out of building it.

THE ORIGINAL DEFECT. `pickBestUpgradeStep` and `pickBestCompoundStep` minimise
`cost / chance`, where `cost` is scroll + offering ONLY. The copy going into the
roll is not in the arithmetic at all, so a 1,000-gold scroll on a 100,000,000
item scores as the cheapest move available - which it is, if the item is free.
This is what was lost with the starkillers. The fix is the recurrence
UpgradeCompound.js already used:

    upgrade    C(L+1) = (    C + scroll + offering) / p
    compound   C(L+1) = (3 * C + scroll + offering) / p

Adding the stake to the numerator shifts the optimum toward a higher success
rate, because the constant amplifies what p buys. That is the whole behavioural
difference, and it is why a dear copy now buys scroll2 where a cheap one takes
scroll1.

DEFECT 2 - GRACE USED THE WRONG VARIABLE, WITH THE WRONG SIGN. The server adds
`item_def.igrace` to grace, not `igrade`, and igrace is a PENALTY assigned at
boot in `server_functions.js`: igrade 0 -> +1, igrade 1 -> -1, igrade 2 -> -2.
`getUpgradeChance` added `+ igrade`, so every igrade-1 item - which is any item
whose `grades[0]` is 0, mmhat included - scored grace 1 where the server scores
0, and every chance came back optimistic. Wrong direction for a function whose
output decides whether to gamble a nine-figure item.

Worth knowing WHERE it bit, because it is not everywhere. In the no-offering
branch the server subtracts `0.4 / (new_level - 0.999)^2` from grace, and for
these probability tables that subtraction cancels the whole grace term at every
level - so on offering-free steps the mix-up was invisible. It bit on
offering-bearing steps, where grace is added straight onto the product. Measured
on mmhat +8 against a grade-2 offering: 0.100733 before, 0.092400 after, an 9%
overstatement. The effect was to over-credit offerings, making them look worth
buying sooner than they are. The player and server grace pools
(`player.p.ugrace`, `S.ugrace`, `player.p.ograce`) are real and non-zero in play
but unreadable from the client, so they stay at zero - the conservative floor,
and the same choice UpgradeCompound.js makes deliberately.

DEFECT 3 - THE STAKE IS THE COPY IN HAND, NOT A FRESH ONE. The first cut of
`pickBestValueStep` fed the +0 price in as `inputs` at every level. A +7 copy
embodies every roll that got it there, so that repeats the original omission one
level up: the offering never looks worth buying because it is being weighed
against a fraction of the real stake. `gvCarriedValue` now supplies the worth of
the copy at its CURRENT level - the live market at that level when anybody is
trading it, since that is the actual replacement cost, otherwise the recurrence
walked up from +0. Before the fix mmhat ran to +9 unopposed; after it, the
ladder is 10,500,000 -> 10,540,211 -> 10,907,434 -> 11,646,206 -> 16,036,569 ->
24,980,976 -> 57,040,722, and +6 is where it stops.

DEFECT 4 - UpgradeCompound.js DIVIDES BY AN UNCLAMPED PROBABILITY. Not fixed
here, because it is the other file, but recorded so it does not get ported in
later. The game's own cap lets probability exceed 1 - the server rolls
`Math.random() < probability`, so anything >= 1 simply means certain - and
`ucPlan` divides by it, reporting a next level CHEAPER than the copy going into
it. Merchant.js's `getUpgradeChance` already clamps, and `pickBestValueStep`
clamps again rather than relying on that staying true.

THE STOPS, and why they are not errors. The operator's rule, 2026-10-04: take it
as far as the cheap offering-free optimum goes, then hand over to
UpgradeCompound.js or a manual roll. Three reasons:

  wants_offering            the cheapest move includes an offering
  scroll_not_npc_buyable    needs grade 3+, which no NPC sells
  value_unknown             no override, no Ponty price, no agreeing anchors

Lucas stocks grades 0-2 of both scroll lines; grade 3 and 4 exist in `G.items`
and nobody sells either. Held items are BANKED rather than merely skipped -
`gearHeldKeys` is rebuilt every pass, so an item that becomes priceable again
simply stops being held, and nothing needs un-banking.

Deliberately INDEPENDENT of `CONFIG.gearTripwire.mode`, which stays 'off'. The
tripwire's four reasons are a separate judgement that has never run in enforce
mode, and turning on the operator's banking rule must not quietly turn on
`buy_beats_build`, `no_improvement` and `inputs_unobtainable` with it.

VALUATION. `gvBaseValue` is override, then Ponty for the seven items he
reliably restocks, then the live market, then nothing. It reuses `gtQuote`,
which already returns cheapest ask AND best bid - a standing buy order is as
real an anchor as an ask, since somebody is holding gold against it - and takes
the dearer of them, because the question is replacement cost. Two anchors more
than 3x apart mean at least one is a parking price with no way to tell which, so
neither is trusted and the item hands over with the divergence logged. The band
is loose on purpose: real `g`-to-paid gaps reach 13x (starkillers' `g` is
7,800,000 against ~100,000,000 paid), so this is here to catch 80x, not 2x.

TIER ROUTING. Tier-1 levels keep the original materials-only economics, where
the scroll dominates and a loss costs little. At and above the tier-1 target -
and for every item tier 1 never mentions - the new path takes over. NOTE that
`GEAR_PROGRESSION`'s tier-1 objects are still EMPTY; the lists live in
MerchantComments.md under #earring1 / #earring1-2 / #earring1-3 and have never
been pasted in, so today `usesValuePlanning` answers true for everything. It
starts splitting the moment tier 1 is populated: 11 of the 37 plan items are
shared with tier 1 and would then route by level. Cross-class disagreement
resolves by PARTY_CLASSES order, the same priority the stand path uses for
shared-name arrivals; only `intamulet` currently differs (priest 2, mage 1 -> 2).

mageshood IS NOT AN OBTAINABLE ITEM, and was the mage helmet at both T2 and T3.
The id is valid - `G.items.mageshood` is Mage's Hood, tier 2, g 640,000 - but
`design/items.js` authors `"ignore": true` on it, and that flag is consumed by
the game's OWN progression engine (`js/progression/engine.js`: `if (d.ignore ||
d.cash || d.expires || d.event) return;`), by the item codex listing
(`js/html.js`), and by the docs URL set (`seo_paths.js`). A search of the
deployed data returns count 1 for mageshood - the definition, matched on `skin`
alone - against count 9 for a control (`firestaff`, which surfaces craft,
dismantle, two drops, two monsters and two positions). No drop table, no craft,
no dismantle, no NPC, no token route. It is defined so existing copies keep
working, and cannot be acquired.

Replaced with `mmhat` (Hat of the Hunter Mage, tier 2.125, class mage,
rpiercing 40, grades [0,7,10,12]) at the same +7 and +9 targets, and swapped in
`pontyBuy.items` and `standBuy.items` too. mmhat is obtainable: 7 monstertokens
(`tokens.monstertoken.mmhat`) or a `glitch`/`lglitch` drop. 46 of 637 items
carry `ignore: true`; mageshood was the only one in the gear plan, but
`offeringp` and `offeringx` are also retired - which is the measured reason no
NPC sells them, and why `BUYABLE_OFFERING_INDICES = [0, 2]` is correct rather
than lucky.

Note that `grades[0]` is 0 for both mmhat and mageshood, so `level >= 0` is
always true and the grade is NEVER 0 for either: scroll0 is not usable on them
at any level, and the ladder starts at scroll1. mmhat is grade 1 to +6, grade 2
from +7, grade 3 from +10.

HARNESS. `v77test.js`, 50 assertions, driven off the shipped text by brace-
matching rather than a copy that can drift. Mutation-tested: reverting the grace
fix fails 1, feeding the base price as the stake fails 12, raising
NPC_MAX_SCROLL_GRADE to 3 fails 1, dropping the wants_offering stop fails 2, and
disabling the divergence gate fails 3.

SIZE. 339,170 chars, up from v76's 325,287. The cap is still unknown - see the
header of this file - so FEATURE-DETECT after deploying rather than reading the
version string: `typeof gvCarriedValue` and `typeof pickBestValueStep` should
both return `function`.

## v76

Exchangeable items are never sold, and are banked when he is already at the
bank. The operator's rule, 2026-10-03.

An exchangeable item is one that can be traded for a random reward -
`G.items[name].e`, which holds the QUANTITY the exchange consumes rather than a
boolean, so the test is field presence and not truthiness. `design/items.js`
labels the field in its own header: `// "e" Exchangable`. The set is DERIVED
from `G.items` rather than listed, so a game update that adds one is covered
without a redeploy.

WHY THIS IS A RULE AND NOT A PRICE CHECK. Two exchangeables were sitting on
`CONFIG.selling.whitelist`, which means `sellTrash()` was vendoring them on
sight: `seashell` (NPC 800, e=20) and `gem0` (Raw Emerald, NPC 240,000, e=1).

`gem0`'s exchange table in `design/drops.js` pays out 100,000-6,400,000 in
gold, a `weaponbox` or `armorbox`, `scroll1` x10, `cscroll1` x4, and at 0.641%
an `offering`. Counting ONLY the pure-gold rows - no valuation assumptions
needed for those - the exchange averages 262,779 against the 240,000 vendor
price, and every box, scroll and offering is upside on top. So the NPC price is
not a floor to measure against; it is the worst available exit, and a
value-based guard waves `gem0` through precisely BECAUSE 240,000 looks like
real money. That is the same shape as the `slice_blueberry` entry from
2026-09-22 and the `tracker` note in PROTECTED_ITEM_NAMES: a vendor price tells
you nothing about what an item is for.

The whitelist is deliberately left exactly as the operator wrote it. The guard
outranks it instead, so `gem0` and `seashell` can stay listed without being
sold, and removing them by hand is not a prerequisite for the rule holding.

SEED + DERIVED, UNIONED. A derived-only set that read an empty or missing
`G.items` would be EMPTY, and an empty protection set protects nothing - the
failure is silent and costs 240,000 a gem. So the 45 names measured 2026-10-03
against `design/items.js` are hardcoded as a floor and the derived half extends
it; neither can shrink the other. The cache is only written once the derived
half actually read something, so a failed read does not freeze the gap in for
the rest of the session.

FIVE SELL PATHS, ALL OF THEM. `sellTrash`, the aggressive low-space dump,
`ssVendorBound` (so it never reaches the player stand either), the four
arbitrage feed-ingestion filters, and `arbProbeNpcSell`. The arbitrage guards go
at INGESTION for the reason NO_TRADE_ITEM_NAMES already documents: a name
filtered out of the buys/sells feed cannot reach any caller. The hand-run probe
is guarded too - it deliberately sells a real item, which is exactly why a
measurement is not an exemption.

BANKED, BUT NEVER TRAVELLED FOR. The second half of the operator's rule was
explicit: bank them when he is at the bank anyway, do not spend a trip on it.
`bankExchangeables()` therefore refuses to move - it returns 0 unless
`character.map` is already the bank map - and the only thing that calls it is a
new arrival wrapper around `travelToBank`. Every bank visit in the script goes
through `travelToBank` (the ponty and stand-buy runs, the fully-progressed gear
sweep, arbitrage's stock retrieval and its abandoned-stock banking), which makes
it the one choke point where "at the bank for some other reason" is true. The
original body is now `travelToBankRaw`; all seven call sites are unchanged.

`character.bank` is checked as well as the map, because `bank_store()` rejects
with `not_in_bank` until it populates, and it populates on arrival rather than
with the map change - `arbStockRetrieve` already carries a branch for "at the
bank but character.bank is empty". An empty read here is a quiet return, not an
error; the next bank visit picks the goods up.

THE WRAPPER CANNOT THROW, and this is the part that would have bitten.
`travelToBank` is awaited in boolean position at every call site -
`if (!(await travelToBank()))` - so a rejection escaping the sweep would not
return false, it would blow up the caller. That is CLAUDE.md's Form A, the one
that left three rangers standing next to monsters for hours. Hence the
try/catch, and hence the catch LOGS: a silent default is indistinguishable from
a working one.

Slot pressure is mostly imaginary here - `bank_store()` with no pack argument
prefers a slot it can stack into and nearly every exchangeable is stackable
(`gem0` is `s:true`), so a sweep usually merges into a stack it already owns.
`storage_full` ends the sweep rather than retrying and the goods stay in
inventory. Locked items (`l === 'l'`) are left alone and logged, since that is
the operator's own hands-off marker and silently relocating one is worse than
leaving it; arbitrage-held names are left to `arbBankItem`, which owns that exit
and keeps the registry straight.

Measured while writing this, and it affects nothing in the file but is worth
recording next to the note above: `save_code_api` in the current server source
has no length validation at all - the code goes straight into a MongoDB
document, whose own BSON ceiling is 16 MB. So if there is a practical ceiling it
is not an explicit check there. That is a source read and not a live
measurement, so it does not retire the feature-detect rule; v76 is 325,270
chars against 260,646 for the largest build CONFIRMED by feature detection to
evaluate, which makes feature-detecting after this deploy more important than
usual, not less.

222/222 across three harnesses: 101 new, 83 for v73's stand buy, 38 for v74.
The new harness runs the five sell paths for real against a stubbed inventory,
so a guard that is present but unreachable still fails.

Two harness corrections, both mine and neither a code change. The v76 harness
counted `await travelToBank()` call sites against the raw source and found 8
where there are 7, because v76's own doc comment quotes the call shape - it now
counts against a comment-stripped copy. And v73's harness supplies
`isExchangeable` to its extracted stand-buy block: in the real file that is a
hoisted top-level declaration and so is in scope, but the harness slices the
block out on its own.

## v75

Mage tier-3 mainhand corrected to `sparkstaff@9`. The row said `gstaff` by
mistake - the operator's slip, caught when MageofOz was equipped with a Spark
Staff and the plan disagreed.

Both are two-handed `great_staff`, so `offhand: null` was right either way and
nothing else in the row moves. The comment above it, which named Blaster
specifically, is rewritten rather than left to contradict the entry.

Blaster is the stronger weapon at the same level - 139 attack / 131 range at +9
against sparkstaff's 126.5 / 122.5 - so this is not a correction of a weaker
choice. It is a correction of an expensive one: Blaster's grade thresholds are
`[0,0,9,10]` against sparkstaff's `[0,5,10,12]`, so it sits in an expensive band
from level zero, and it costs 1,240,000 against 224,000. Measured live
2026-10-02: MageofOz is on `sparkstaff+6` at 104 attack / 109 range, which
already beats a fully upgraded tier-2 `firestaff+9` at 84.5 / 87.5, and carries
blast, which firestaff does not.

REBASED MID-EDIT. The operator added `feather0` to `pontyBuy.items` (a08f076,
ad04ad6) while this change was being prepared. The editor's own base hash caught
it before anything was written, the two ops applied unchanged against the new
base - different region - and that edit is preserved.

THE BUY LISTS, which this commit deliberately did not touch. Dropping `gstaff`
from the plan left it on `pontyBuy.items` and `standBuy.items` while no longer
being gear, and left `sparkstaff` as gear on neither list. Those lists belong to
the operator, so a code change does not get to edit them; the drift was reported
instead. The operator closed it himself in 216ccb5, swapping `gstaff` for
`sparkstaff` on both, and `standBuy.items` is once again exactly the
gear-plan/Ponty intersection at 23 ids.

That round trip is why the harness assertion which caught this was SOFTENED
rather than deleted. The hard check is now "nothing on standBuy is outside the
Ponty list", which is always a mistake. Gear-plan membership is REPORTED as drift
in both directions - what is on the list and should not be, and what should be on
it and is not. It printed the `gstaff` drift when the plan changed and printed
"no drift" once the lists were fixed, which is the behaviour wanted: asserting
the seeded equality forever would fail after every legitimate plan edit, and a
suite that fails for legitimate reasons gets ignored.

Tier 2 is untouched and still reads `firestaff@9` with `offhand: wbook0@4`. That
is now incoherent with a tier 3 the mage has already passed, and with a
two-handed weapon he cannot pair an offhand with. Left for the operator.

316,448 -> 316,929 chars. 121/121 across both harnesses, re-run against the
operator's follow-up commit.

## v74

A purchase now forces a rescan, so the posted scan never advertises what we just
took.

There was nothing to suppress. The report already came last - after the Ponty buy
and after the stand buy - and there is exactly one post per visit. The flaw was
that it posted the buffer captured BEFORE the buying, and that order is right,
because the buy needs the data. So the report advertised the exact slot we had
just emptied, with our own name on the scan.

What that costs. Any reader of that post - the bridge, ALData, FamilyFleet, or
this merchant's own `arbProbeFindFlips` while the row is still inside
`sellMaxAgeSec` - plans a trip for an item already sitting in our bank.
`arbStillThere()` catches it at the till, so no gold is at risk: the buy leg
verifies the listing and abandons. But the trip is spent, and on another shard the
hop goes with it. It is the cheapest possible class of bug to fix and the most
annoying to watch.

`scoutRescanAfterBuy(reason, alsoPonty)` runs between the buying and the report
whenever either pass actually bought something: back to the scan spot, drop this
shard's stands, read them again, and let the report post THAT. Both buy paths
already walk back to the scan spot, so the travel is normally a no-op.

The Ponty leg is separate on purpose. Ponty's stock is its own buffer
(`bucket.ponty`) and a stand rescan does not touch it, so a Ponty purchase needs
its own re-read. It calls `scoutPontyQuery()` directly and NOT
`scoutPontyCheck()`, because the latter buys - a rescan that bought again would be
a loop. `scoutPontyCheck()` now returns what it bought so the caller can tell
whether that re-read is needed. If Ponty does not answer, the previous stock is
kept rather than cleared, and the log says so instead of implying a fresh read.

It fails safe twice. `CONFIG.scout.rescanAfterBuy` set false turns the whole thing
off and the behaviour is exactly v73's. And if the walk back to the scan spot
fails, it does NOT re-read from wherever it is standing - a settle scan taken at
the seller's feet would be a worse lie than the stale one. It says "posting the
pre-purchase scan" and lets the old buffer go out.

123/123 across both harnesses. Two of those assertions had to be corrected rather
than the code: a `try { await sbBuyPass(` pattern that stopped matching when the
result moved into a variable, and a "does not call scoutPontyCheck" regex that
searched from the first occurrence of the NAME anywhere in the file, including the
`-> ` pointer comments, so it was measuring the wrong span.

313,240 -> 316,436 chars. Same deploy rule as v73: feature-detect, in this case
`typeof scoutRescanAfterBuy === 'function'`.

## v73

Gear-plan pieces are now bought off other players' stands, not just off Ponty.

The operator's rule, 2026-10-02: for the ids that are on BOTH the gear plan and
the Ponty buy list, buy from a player's stand whenever the listed price is
1,000,000 or less. `CONFIG.standBuy.items` is seeded with that intersection,
computed from the file rather than typed: 23 of `pontyBuy.items`' 43 ids appear in
`GEAR_PROGRESSION`. The other 20 - boxes, cake slices, scrolls, offerings,
tracker, leather, funtoken, anniversarygift - are not gear and are deliberately
absent. The list is edited exactly like the Ponty one, and it is rebuilt from
CONFIG on every pass, so a console change takes effect on the next scan.

WHY THIS IS NOT ARBITRAGE. Arbitrage buys to resell, so it will not look at a
listing without a matching buy order clearing `minProfit`. A wingedboots at 50,000
that nobody is bidding on is invisible to it, which is precisely the listing worth
having. This buys to KEEP: the only test is the price, the piece goes to the bank,
and the spend stays out of the arbitrage ledger under its own `standbuy_log` key
so a gear purchase can never be read as a flip.

WHY IT HANGS OFF BOTH SCANS. `scoutSettleScan()` already reads every stand into
`scout.shards` from the live entity list, seconds old, so unlike the arbitrage
finders there is no freshness question and no bridge dependency. It is called from
two places: the shard-rotation cycle in `scoutVisitNextShard`, and `scoutHeldScan`
for the parked case. Since `CONFIG.scout.parked` is now true by standing
preference, hooking only the first would have produced a feature that never ran -
the same shape of mistake as v71's `noHang`, caught here by asking which path
actually executes rather than which one reads as the main one.

WHAT IT WILL NOT DO. It never buys from `CONFIG.partyMembers`, the mule, or this
character - the operator's standing "never stage either leg using my own
characters", applied to a feature that has only one leg. It never touches a buy
order (`slot.b`). It re-reads the slot off the live entity after arriving and
refuses a price that moved UP, taking one that moved down. A nonsense or missing
`maxPrice` caps at 0 and refuses to buy rather than reading as "no ceiling" - the
failure mode of guessing wrong here is paying a stranger's asking price.

Bounded at `maxPerPass: 3` sellers, because unlike Ponty every purchase costs a
walk there and back; the rest are still listed on the next scan. A listing that
falls through is skipped for 20 minutes so the walk is not repeated. `dryRun`
rehearses the whole pass, approach and price check included, stopping short of
`trade_buy`.

No cap on copies. Bank contents cannot be read from outside the bank, so an
inventory count would be wrong the moment the first copy is banked. The 50,000,000
gold floor is the real brake, per the operator's accepted overbuying risk.

85/85 in the harness, which provides nothing the real CODE context does not and
asserts statically that the new block contains no `noHang(` call site.

SIZE. 297,392 -> 313,240 chars. The cap is still unknown (see the note at the top
of this file) and the failure mode is silent: an over-size slot runs the OLD build
with nothing in the console. After deploying, feature-detect
`typeof sbStatus === 'function'`, not the version string.

## v72

The Ponty arbitrage buy never ran. Merchant.js never had `noHang()`.

v71 called `noHang()` twice in the Ponty buy path - once to bound
`get_secondhands()` and once to bound `buy_secondhand()`. This file does not have
that helper. It shipped in Ranger v51 / Priest v26 / Mage v50 and was never
ported here, AND THIS FILE ALREADY SAID SO, in two separate comments: the mover
note ("has no noHang(), so a never-settling await would wedge every mover for
good") and the self-chained-loop note ("Merchant.js never got noHang() - that
shipped in Ranger v51"). I wrote the call anyway, directly below a line that
correctly guards `get_secondhands` with `typeof`.

Referencing an undeclared identifier THROWS. The throw landed in
`arbPontyLive()`'s own `catch`, which turned it into
`{ rows: null, why: 'noHang is not defined' }`, which `arbPontyBuy()` turned into
`could not read Ponty: noHang is not defined` with `retry: true`. Three attempts,
then `arbFinish(..., 'abandoned', { disposition: 'nothing_spent' })`. So no gold
was ever at risk and nothing looked broken from the ledger's side - arbitrage
simply never bought from Ponty, which is exactly the feature v71 existed to add.
This is Form B from the conventions, verbatim: a catch swallowing a
ReferenceError and returning a plausible lie. Form A would have been louder.

Measured in Meltymerch's live CODE context, 2026-10-01: `typeof noHang` is
`"undefined"`. The operator saw it as one log line,
`[arb] Ponty buy: could not read Ponty: noHang is not defined - retrying`.

THE FIX IS LOCAL. `arbNoHang(p, label, ms)` is built on the `Promise.race` idiom
this file already uses twice - for the party link and for the scout bridge - so
the timeout the code was written to have is kept without taking a dependency on
the party scripts. Do not swap `noHang()` back in; there is a comment above it
saying so.

ALSO FIXED, same bug class, and this one predates v71: `sfx(data.sound)` in the
timestamped game-log listener. `sfx` is not in the CODE context either (measured
alongside the rest), so any `game_log` message carrying a sound threw, and
`addLogEntry` on the very next statement never ran - the log silently dropped
those entries. `sfx` DOES exist on the top window, and that block already reaches
through `parent` for `socket` and `draw_trigger`, so it is now
`parent.sfx(data.sound)` and the sound survives.

HOW THIS GOT PAST 36 PASSING TESTS, which is the part worth remembering. The v71
harness defined the helper itself, at line 20: `noHang: async (p) => p`. It
supplied the one thing the real context lacks, so the happy-path purchase test
passed against a context that does not exist. A harness is only as good as its
fidelity to the real context, and a stub for a missing helper converts a hard
failure into a green tick.

`m72test.js` deliberately does NOT define `noHang`, and adds two static checks
that would have caught this on day one: no bare `noHang(` call site survives
anywhere in the file (comments and strings stripped first - the first version of
that check produced three false hits from block-comment continuation lines), and
`arbNoHang` is really called at both sites. Thirteen pass, including
`arbPontyLive` reporting a timeout instead of wedging when `get_secondhands`
never settles, which is the case the bound exists for.

The sweep generalised: every identifier Merchant.js calls but does not define - 39
of them - was checked with `typeof` against the live merchant context. Only
`noHang` and `sfx` came back undefined. Worth re-running after any version that
borrows code from the party scripts, because that is how both of these arrived.

## v71

Arbitrage can actually buy from Ponty, and no NPC is ever shelved again.

Two operator rules, 2026-09-30: Ponty - no NPC - may ever be blacklisted; an
individual attempt may be given up on when the item has gone; and the executor
should be able to buy from him.

WHAT WAS WRONG. `arbProbePontyRows()` has always pushed Ponty's stock onto the BUY
side of the flip search, tagged `npc: true, target: 'Ponty', slot: null`, and
nothing downstream filtered it: the `pick` filter tests affordability, item caps,
`arbIsUsed`, `arbFailBlocked` and the never-list, but never `buyIsNpc`. The buy leg
then ran `trade_buy(pEntity(t.buyFrom), t.buySlot, t.qty)`, which needs a loaded
player stand and a trade slot. Measured 2026-09-30: `pEntity('Ponty')` resolves to
entity id `$Ponty` with `npc: true` and ZERO slots, and the trade record carries
`buySlot: null` with `buyX`/`buyY` null. So every Ponty flip was planned,
travelled toward and abandoned in `at_buy`, and `buyIsNpc` was written into the
record and read by nothing.

It was not theoretical. `arb_fails` held four entries and all four were Ponty -
USV n=5, EUIII n=5, USIV n=3, ASIAI n=2. Fifteen abandoned trades, and the only
shelved counterparties on record. Nothing was spent (every one abandoned with
`disposition: 'nothing_spent'`) but at `neverTradeAfter` (8) the name is promoted
permanently, so he was three failures per shard from blacklisting the single
counterparty that cannot move, cannot log off and never runs out of stock.

NO NPC IS SHELVED. `arbIsNpcTarget()` is DERIVED from `G.npcs` - all 132 names and
ids, so it covers Lucas, Garwyn, Crun and anything the game adds later, not a
hardcoded 'Ponty'. `arbNoteFailure`, `arbNeverHold` and `arbNeverPromote` all
refuse an NPC, and the two READ gates - `arbNeverBlocked` and `arbFailBlocked` -
refuse one too, because entries written before this version are still in CODE
storage and a deploy does not clear them. An empty read of `G.npcs` falls back to
{'Ponty'} rather than to an empty set: failing open there would re-open the hole.

THE NPC BUY LEG. `at_buy` branches before its approach-and-verify path, because
Ponty has no position to walk to, no slot to verify and no entity to trade with.
`arbPontyBuy()` instead:
  - checks `scoutPontyDistance() <= 500`, the same gate the scout uses, since the
    town spot is already inside it (47.4 units, 346.1 worst case);
  - takes a LIVE `get_secondhands()` read, because a rid is per listing per shard
    and the bridge's cached `/ponty` rows carry none;
  - re-matches on name AND level AND special - a +2 does not fill a +0 flip;
  - RE-PRICES from the live row via `scoutItemPrice()` and refuses anything more
    than `npcPriceDrift` (2%) above what was planned, since the plan came from a
    cached scan and his price is a function of the item, so drift means a
    different listing;
  - re-checks the gold floor at the live price;
  - buys one listing with `buy_secondhand(rid)` and verifies by gold delta AND by
    the item arriving. Gold gone with nothing arrived logs CHECK THIS in red.

A Ponty row is ONE item, so a multi-quantity flip is trimmed to x1 rather than
committing to sell a quantity we do not hold. No `arbMarkUsed`: there is no slot
to mark, the listing is consumed by the purchase itself, and marking the NAME
would refuse everything else he stocks for `usedCooldownMs`.

Failures are classified rather than counted alike. `item_gone` - the normal one,
somebody else took the listing between the scan and the trip - a price that
drifted, `no_space` and the gold floor all give up on that attempt immediately,
which is exactly the operator's rule. Out of range, a failed read and `cooldown`
are retried up to three times. Nothing shelves the counterparty either way.

Verified with a 36-case node harness: the NPC predicate against G.npcs, all three
write paths and both read paths refusing an NPC while still shelving a player, a
pre-v71 stored Ponty entry not blocking, the happy purchase, level and special
mismatches, item_gone, price drift inside and outside tolerance, the gold floor at
the live price, out of range, off main, a failed read, no_space, cooldown, the
gold-without-item case, and the x4 trim. The harness caught two of my own errors,
one of which mattered: my stubbed `parent` had no `calculate_item_value`, so
`scoutItemPrice()` returned null, the re-pricing fell back to the planned figure,
and the drift test was passing without exercising the drift path at all.

## v70

He buys the gear list off Ponty while he is already standing there.

The operator's rule, 2026-09-30: pick up a named list of tier-3 gear whenever it
turns up in Ponty's stock during the ordinary scan cycle, at any level, without
leaving the cycle to do it. Stop only on three-or-fewer free inventory slots or
on-hand gold below 50,000,000. Bank what is bought if the bank has room; keep it
if it does not. The list is edited by hand and will grow.

Where it hooks in, and why there. `scoutPontyCheck()` already stands in range and
reads Ponty every `pontyEveryMs`: both the read and the purchase are gated by the
server on `simple_distance(G.maps.main.ref.secondhands, player) > 500`
(node/server.js, `socket.on("secondhands")` and `socket.on("sbuy")`), and the town
scan spot measures 47.4 units from him, 346.1 worst case. So nothing walks
anywhere - the buying happens in the gap where the scan already happens.

The hop waits by construction rather than by a flag. `scoutVisitNextShard()` does
the scan and then returns so the hop falls on a LATER tick, and the buy pass is
awaited inside that scan. There is no "hold the hop" state to get out of step
with, which is the failure mode a separate flag would have introduced.

One real change was needed to make a purchase possible at all: `scoutPontyQuery()`
threw away the `rid`. It is per listing per shard, `buy_secondhand()` needs it, and
the bridge's cached `/ponty` rows cannot supply one - so a purchase can only ever
be made from a live read. It is carried through now, and a row without a rid is
refused rather than attempted.

Price is not a seller's asking price: Ponty charges
`calculate_item_value(item) * G.multipliers.secondhands_mult` - 2x the item's own
value, 3x for a cash item - so it is a property of the item and its level.
`scoutItemPrice()` already computes exactly that for the scan report, so the gate
and the report agree. Every purchase is then verified by gold delta AND by the
item arriving in the bag, because an estimate that drifts from the charge is how a
gold floor quietly stops meaning anything. A buy that reports a refusal but
arrives anyway is trusted and logged; one that takes gold without arriving is
logged in red.

Both stops are tested before EVERY purchase, not once per pass, because one buy
can cross either line. Rows are taken cheapest-first, so a budget near the floor
buys the most pieces instead of spending itself on whichever listing came back
first. `maxPrice` is an optional per-item ceiling, empty by default.

Bank space cannot be read from the town spot - `character.bank` is null anywhere
but inside the bank - so `pontyStash()` tries and treats a refusal as "no room",
which is the operator's rule by a shorter route. It runs after the buying is
finished, never between two purchases, and returns to the scan spot afterwards.

`CONFIG.pontyBuy.items` is a plain array rebuilt into a Set on every pass, so
adding an id from the console takes effect on the next shard with no redeploy.
Duplicates are harmless - the operator's own list had `wingedboots` twice, and it
dedupes to 23. `pontyStatus()` prints the list, both gates as they stand, any
price caps, and the last ten purchases from a log kept in CODE storage.

Verified with a 32-case node harness over the extracted functions: the dedupe, any
level bought, unwanted and rid-less rows refused, cheapest-first ordering, the
gold floor at the pass boundary and mid-pass, the slot floor at exactly 3, the
price cap, banking, a full bank, an unreachable bank, the 'low' mode, item_gone,
the disabled and empty-list cases, and the purchase log. The harness also caught
one arithmetic error in my own test expectations rather than in the code.

## v69

A reroute has to be to someone else.

The operator reported the merchant continually rerouting to the same merchant for
arbitrage, when it should have stopped and banked. Measured on the live character
2026-09-29: an `ascale` x36 trade had been in `at_sell` for 28.8 minutes with
`attempts` reading 0.

The loop, exactly:

1. `arbApproach('Mercantor', hint)` walks to the buyer's last known spot. The
   merchant was standing on it - main (538, 1126) against a hint of (538.03,
   1125.88) - and `pEntity('Mercantor')` returned null. The stand was not there.
2. `arbFindBuyerFor` was asked for another exit and returned **Mercantor**, from a
   stand row the bridge was still serving at 120s old, comfortably inside
   `sellMaxAgeSec`. (That row carried `x: 0, y: 0`, so it was not even a better
   position - the placeholder the feed emits when it has none.)
3. The reroute branch logged "buyer changed - rerouting to Mercantor", set
   `t.attempts = 0`, and returned.
4. Back to 1, every tick, indefinitely. The three-strike exit two lines below
   could never be reached, so the goods were never banked and the stranding
   breaker never counted anything.

Four changes, and the first is the fix:

- **The attempt is counted always, and before the search.** A reroute no longer
  resets the counter. `arbAdvance` resets it in exactly one place now - when the
  buy leg completes and the sell leg begins, which is a genuinely new leg.
- **`t.tried` remembers every (shard|buyer|slot) this trade has failed against**,
  and `arbFindBuyerFor` skips them. That is what makes a reroute a reroute rather
  than a retry wearing a different log line. It is a third question, distinct from
  `arbIsUsed` ("did we consume this order") and `arbFailBlocked` ("do we keep
  losing against this counterparty").
- **`arbFindBuyerFor` now consults `arbFailBlocked` too.** The planner has always
  refused shelved counterparties; this search never did, so a counterparty the
  planner would not touch was still offered as the way out. `arbNoteFailure` is
  also called at the moment the approach fails rather than only when the trade
  reaches a terminal state - which, in this bug, it never did.
- **Two bounds over the top.** `maxSellAttempts` (4) caps the attempts for one
  trade across every buyer, and `sellDeadlineMs` (15 min) bounds it in wall-clock
  time from `t.sellSince`, because an attempt counter only bounds the paths that
  increment it. Either one ends in `stranded`, which banks the goods and closes
  the books.

Two smaller defects found while reading the same path:

- A reroute kept the **previous** buyer's coordinates, so the approach to the new
  buyer would walk to the old one's spot and fail there. The candidate now carries
  `map/x/y`, and a row with no usable position clears the hint instead, which fails
  immediately rather than after a walk.
- An order for 2 was a valid exit for 36. `trade_sell` is one call for the whole
  quantity, so a short order is a failed attempt, not a partial sale. Orders
  smaller than the holding are skipped and counted in the log.

Verified with a node harness (17 cases) driving `arbAdvance` against the measured
rows and an absent Mercantor: one tick counts the attempt, records the dead end,
shelves the counterparty and goes to `stranded`; the next banks the goods. A
genuine alternative is still taken, with the counter carried rather than reset and
its position carried too; a run of absent buyers terminates at four; twenty minutes
held strands on the deadline alone; a buyer who is actually there still sells; and
an order for 2 is not offered for 36. The harness also caught an undeclared
`tooSmall` counter, which in the CODE context would have thrown inside the one
function the trade depends on for its exit.

## v68

The relay cursor survives a hop, so ten minutes of answered requests stop coming
back.

The operator reported the merchant forgetting that he had already given mluck and
already delivered potions, and doing both again after a server hop. One root cause
and two failed defences, all measured 2026-09-29 rather than read.

`plCursor` lived only in memory. `change_server` reloads the page, the scout
rotation hops several times an hour, and the bridge serves every message with
`seq > since` for MESSAGE_TTL (10 minutes). So each hop asked for `since=0` and
was handed back the whole backlog, which the handler then acted on. Measured: 15
`location` rows waiting for Meltymerch, every one carrying `needsMluck: true`
from before the buff was cast, while Dexon's mluck - from Meltymerch - still had
52 minutes left. It is now persisted in CODE storage and restored before the
first poll, advanced only after a batch is handled, and reset to 0 if the bridge's
own cursor ever goes backwards (a bridge restart renumbers from 0, and a stale
high cursor would starve the merchant in silence).

The delivery watermark added in v58 was supposed to catch the potion half. It
never fired once. `plPoll` read `m.ts` and converted from epoch seconds, on the
stated premise that "the bridge stamps every message with `ts` from time.time()".
A live probe of the running bridge says otherwise: a `/msg` row carries `seq`,
`at`, `frm`, `id`, `payload`, where `at` is an ISO-8601 string, and NO row carries
`ts` at all. So `_plts` was never set, every `reqAt` fell back to `Date.now()`,
and a ten-minute-old replay always looked newer than the delivery that had
already satisfied it. Both fields are read now. This is the second time an
unverified claim about the bridge's shape sat in a comment and cost a real bug;
the comment now says what was measured and when.

mluck had no watermark at all - deliveries had one and buffs did not. There is one
now, the same shape: `pl_mlucked_<name>`, stamped after a successful cast, and a
`location` request sent before that stamp is refused as answered. It is also
seeded from an observed buff, since `s.mluck.ms` is the remaining time and mluck
lasts an hour, so a buff cast before this key existed can still be dated exactly.
A recipient that states its own need still outranks the record every time: only a
sender with no `needsMluck` at all - a pre-v62 Ranger - is held off by
`CONFIG.mluck.refreshWithinMs` (10 minutes before expiry).

`MERCHANT_BUILD` is bumped too, and is expected to be bumped from here on. It sat
at `'v57 / arb.5'` through ten releases, and a live probe of the merchant during
this diagnosis reported v57 while the deployed build was v67 - a wrong answer to
the first question anyone asks. Feature-detection caught it, which is the
procedure that works, but the string should not have needed catching.

Verified by extracting the changed functions into a node harness (18 cases) rather
than by reading them: the persisted cursor survives a simulated reload and asks
for `since=6399`; a replayed mluck request and a replayed `low_potions` request
are both refused with a reason; genuinely later requests of both kinds are still
served; a hintless request is held off at 5 minutes and honoured at 55; a bridge
whose seq goes backwards resets the cursor; and a poll that fails mid-batch leaves
the cursor where it was. The harness also caught `plSaveCursor` swallowing a
failed write in silence, which would have brought the whole replay back with
nothing in the log - it now says so in red.

## v67

mluck is need-driven, and never a reason to summon.

The operator reported the merchant repeatedly travelling to Dexon to buff him and
then summoning him when the buff did not land - with more than 50 minutes still
on the mluck he already had. Four defects, all downstream of one line:

    const wantsMluck = CONFIG.mluck.targets.includes(recipientName);

That tests membership of a config list, not need. It was unconditionally true for
Dexon on every visit, whatever the visit was for and whatever his buff said.

1. The `location` handler enqueued an mluck job for ANY `location` message from a
   name in `CONFIG.mluck.targets`. `Ranger.js` sends that same message for pickup
   as well as for mluck, so every pickup ask created a phantom buff job - and an
   mluck job is a whole batch here: a shard hop, a trip, a stop.
2. `visitOneStop` derived the mluck task from the config rather than from a queued
   job, so a delivery-only visit carried one too.
3. `attemptActions` only cleared the flag when the target was in mluck range, so
   arriving out of range left "mluck outstanding" set on a live buff.
4. `stillNeeded` counted mluck, so that stale flag reached `summonAndWait` - which
   is what pulled Dexon off the farm spot for up to 60 seconds.

MEASURED 2026-09-28 in Dexon's live CODE context, and this is what corrected a
wrong first diagnosis of "the log says it is requesting, but nothing is sent":

| probe | value |
| --- | --- |
| `mluckState()` | `{ok: false, why: "Meltymerch is not in the party"}` |
| `character.s.mluck` | `{f: "Meltymerch", minsLeft: 42}` |
| `pickupCooldownMs` | 15000 |
| `lowInventorySlots` | 3 |

So `needsUpdate` was false throughout and the mluck branch was sending nothing at
all. The pickup branch was the only sender, four times a minute while the pack sat
low. A 3.3-minute watch of the mluck gate saw zero sends and was read as "nothing
is requesting anything" - it simply contained no pack-full event. Watch the thing
the user described, not the thing you suspect.

The fix is in two halves, deliberately, because either one alone leaves a hole.
`Ranger.js` v62 puts `needsMluck` on the location message so a pickup ask stops
reading as a buff ask, which stops the trip. This file stops the summon and stops
the phantom task, which holds even against a pre-v62 sender. `mluckWanted()`
replaces the membership test and is evaluated AFTER `travelToRecipient`, because
before the trip we are usually on another shard, `get_player()` is null, and the
sender's hint would decide by default every time.

`mluck` is now absent from both `stillNeeded` and `stillMissing`. A summon costs
the recipient up to 60 seconds off their spot, which is worth it for potions they
have run out of or a pack they cannot empty, and never for a buff: mluck reaches
320 units against this character's ~10 attack range, so a cast that did not land
from here means the recipient is far enough away that their next request brings us
back anyway. -> MerchantComments.md#mluck-intent

## v66

Restores `rabbitsfoot` as the priest's orb target at tier 2 and tier 3, reverting
that half of v65.

v65 moved it to `orbofint` on the reasoning that `rabbitsfoot` gives luck 15 and
no combat stat, where `orbofint` gives int 13 at +3 - damage per slot. That is the
right weighting for a slot doing a combat job and the wrong one here: the priest
is the intended chest-opener by tier 3, luck raises loot quality, and the orb is
where that build lives. The evidence was already in v65's own output and was read
as noise - `lmace` carries luck 6 and `mshield+6` carries luck 14, which is a
pattern, not a coincidence, across a kit that was assembled on purpose.

The other three v65 corrections stand: they were slots where the plan pointed at
something measurably worse than what is already worn.

Investigating the remaining luck items - `ringofluck`, `mearring`, `ringhs` - is
deferred by the operator until the fleet is closer to tier 3 on gear.

## v65

Four `GEAR_PROGRESSION` targets pointed at items worse than what the character
already has equipped. Measured 2026-09-28 with the client's own
`calculate_item_properties` over all 28 off-plan equipped slots. Twenty of them
the plan gets right - that is where the party's missing piercing and frequency
live. These did not:

| plan target | what is worn instead |
| --- | --- |
| `pants@9` - stat 15, armor 12, res 9 | `frankypants+6` - stat 9, armor 68, res 54, vit 6, speed 1 |
| `hhelmet@6` - stat 9, armor 58, res 61 | `xhelmet+4` - stat 8, armor 62, res 66 |

`frankypants` is also roughly 10x cheaper to bring to a useful level once
destroyed items are counted: `pants` is tier 1 on the 1,000-gold scroll but needs
+9, while `frankypants` is tier 3 on the 1,600,000 scroll and is already owned at
+6. Ranger and mage tier-2 pants become `frankypants@6`, ranger tier 3 becomes
`frankypants@7`, priest tier-2 helmet becomes `xhelmet@6` to match the `xhelmet@8`
that tier 3 already asked for.

Priest pants stay `starkillers@8`. That one really is better - rpiercing 105,
crit 3 - and is only absent because the item is hard to obtain, which is a
sourcing problem rather than a wrong target.

The orb change in this version was wrong and is reverted in v66.

## v64

Top up potions while parked, instead of only when a request arrives.

MEASURED 2026-09-27: `buy_with_gold` has exactly one call site, inside
`ensureStock`, and `ensureStock` has exactly two, both inside the delivery batch
and both gated on a queued job. So standing at the town spot next to Ernis with
an empty queue bought nothing, however long he stood there - and he sat on 176
`hpot1` against a `deliveryAmount` of 1000. The next hp request would have had to
wait out a shopping trip, from whatever shard arbitrage had taken him to.

`CONFIG.idleRestock` and `idleRestock()`, called from `arbLoop` under the same
`!ARB.cur && !ARB.busy && !state.busy` gate `ssTick` already uses, and ahead of it
because restocking is cheap and someone may be about to ask. It calls
`ensureStock` rather than `buy_with_gold` so the buy-and-verify path stays in one
place, and `atTownSpot()` is already true there, so `ensureStock`'s travel branch
never fires and this cannot move him.

Gated on `atTownSpot()` rather than the home shard on purpose: Ernis is on `main`
on every shard and gold travels with the character, so an arbitrage stop tops up
as well as being home does. The throttle timestamp lives in CODE storage because
a shard hop reloads the page, which would reset an in-memory timer and turn this
into a per-tick check; it is written even when nothing was bought, so a failing
buy retries on the cadence rather than on every tick.
-> MerchantComments.md#idleRestock

## v63

Flips before the backlog, and the stock-recovery loop stopped.

MEASURED: 68 identical "vitearring is not in the bank" ledger notes in 59
minutes, median gap 28 seconds - one per 30-second look, each with a bank trip
behind it, and the flip finder never reached at all.

1. FLIPS FIRST, backlog second. v61 ran the backlog first on the reasoning that
   it commits no gold. True, and not the deciding question: a flip is perishable -
   the spreads measured on 2026-09-27 had been seen 7 and 48 seconds before they
   were priced - while a banked row keeps indefinitely. With a single trade slot,
   putting a 45-row queue at one row per 10-19 minutes ahead of every flip is a
   full stop rather than a delay. -> MerchantComments.md#flips-before-backlog
2. `arbStockForget` now writes a durable tombstone. It only pruned the in-memory
   cache, and `arbStockLoad` rebuilds from `/trades` on every successful read
   while the bridge still says `abandoned` - so the drop was undone on the next
   look. That is the loop. The bridge is RIGHT to keep saying abandoned, since
   that is what happened to the trade, and rewriting its status would book a close
   that never occurred; so the correction is local and the ledger stays honest.
   `arbStockSkipList()` and `arbStockUnskip(id)` mirror the never-trade helpers.
   -> MerchantComments.md#stock-tombstones
3. The note fires once per row instead of once per look, which the tombstone is
   what makes possible.

## v62

Stock recovery sells only at a profit after tax. v61 chose on `arbNetFromSale` -
beat what a vendor pays - which is the right test for deciding whether to VENDOR
something and the wrong one for deciding whether to SELL it. Every `offeringp`
row it touched closed at a loss:

| trade | item | qty | spend | received | net | v62 |
| --- | --- | --- | --- | --- | --- | --- |
| `tmuhppkqw2xv8` | offeringp | 2 | 9,999,520 | 9,945,000 | **-54,520** | refused |
| `tmuhzgi7yi4sw` | offeringp | 13 | 65,000,000 | 63,375,000 | **-1,625,000** | refused |
| `tmuia1tkq1fqe` | offeringp | 12 | 60,000,000 | 59,670,000 | **-330,000** | refused |
| `tmuhsyl26ur7h` | spidersilk | 8 | 2,399,340 | 3,120,000 | **+720,660** | taken |
| `tmuhfjxmfe0l1` | spidersilk | 15 | 4,499,412 | 5,850,000 | **+1,350,588** | taken |

CORRECTION to this entry as first committed: it listed a fourth row,
`tmujbszy28u02` (slice_blueberry, +2,035,500), as a recovery. It was not one -
its trail is `open` then `closed` 23 seconds later then `banked`, with NO
`abandoned` event, so it was an ordinary same-shard flip credited to the wrong
feature. The two spidersilk rows above are real recoveries that closed after
that commit. So the honest v61 tally is FIVE recoveries netting **+61,728**, not
three losses out of four - losses of -2,009,520 against gains of +2,071,248,
roughly break-even rather than the clear loss the first draft claimed.

The correction strengthens the case rather than weakening it, because the split
is not random: the three losses are all `offeringp`, and both gains are all
`spidersilk`, which is exactly the line v62 draws. `offeringp` cost 5,000,000 a
unit and the best buyer's 5,100,000 is 4,972,500 after tax, so every unit
realised -27,500 while showing +4,684,500 against a vendor's 288,000.
`spidersilk` cost 299,961 a unit against a 390,000 net, so it clears its basis by
90,039. The vendor bar cannot tell those two apart; profit over basis separates
them perfectly.

The formula also reproduces the realised numbers exactly, which is the strongest
check available: 4,499,412 / 15 = 299,960.8 basis, 400,000 x 0.975 = 390,000 net,
(390,000 - 299,960.8) x 15 = **1,350,588** - the gold actually received. Same for
the 8-unit row at 720,660 and for all three refusals.

The vendor comparison is structurally wrong here because stock gets abandoned
precisely WHEN it was bought above the market that now exists - so the population
this feature walks over is biased towards exactly the rows that cannot be sold at
a profit.

The gate is now profit after tax against what the goods actually cost:

    const basisUnit = (s.qty > 0) ? (s.spend || 0) / s.qty : (s.spend || 0);
    const profit = Math.floor((dec.net - basisUnit) * qty);
    if (profit < cfg.minProfit) continue;

The basis is per UNIT because `qty` is capped by what the buyer wants, which is
routinely less than the row holds - charging the whole row's spend against a
partial sale would refuse good trades. `overVendor` is still computed and
carried, but only for the log line, so the comparison that drove v61 stays
visible without driving anything. `expectProfit` is now the profit rather than
the vendor edge, and the vendor check survives ahead of it: a buyer paying less
than a vendor is still refused outright.

MEASURED before shipping, against 48 banked rows that had a live buyer:

| gate | rows it would sell | realised outcome |
| --- | --- | --- |
| v61, beats vendor | 29 | **-29,373,824** |
| v62, profit after tax | 9 | **+15,109,489** |

So this is not a narrowing that strands the stock - it is the difference between
liquidating the position at a 29M loss and taking 15M off it. The 20 rows it now
refuses are held rather than dumped: `slice_nightberry` bought at 900,000 a unit
against a 243,750 net, `slice_citrus` at 750,000 against 243,750. Those only
become sellable if the market comes back, which is the correct reason to wait.

`minProfit` (100,000) still applies ON TOP: a row can clear its basis and still
be refused for not being worth a shard hop. Verified - at a 5,000 basis a 6,000
buyer yields +10,200 and is refused, a 20,000 buyer yields +174,000 and is taken.

Covered by 33 assertions (8 new): a below-basis sale refused even though it beats
the vendor, a profit below the floor still refused, a real profit above the floor
taken, per-unit basis honoured when the buyer wants fewer than the row holds, and
`expectProfit` carrying the profit rather than the vendor edge.

SIZE: 254,261 chars. v61 ran at 253,248 despite the recorded 245,760 cap, so the
practical limit is higher than CHANGELOG has claimed since v38 - that entry
should not be read as a hard 245,760 boundary. Still unreclaimed; comments remain
about a third of this file.

## v61

The executor recovers its own abandoned stock. It used to buy, fail to sell,
bank the goods and forget them: `arbBankItem()` banks an unsold item and the
next line `arbHeldDrop()`s it, and `arbHeldNames()` prunes anything not in the
bag, so a banked holding left every structure the executor consults. Measured
2026-09-27: 21 bank items had a buyer within the last ten minutes paying more
after tax than a vendor, worth **481,474,704** over vendor value, and three
items - `scroll3`, `slice_blueberry`, `offeringp` - were 446M of that. None of
it was visible to the script.

**The bridge was already the registry.** `Ledger.state()` replays events per
trade id and derives `abandoned = [r for r in rows if r["status"] ==
"abandoned"]` plus `abandonedSpend`, and `GET /trades` returns it. Each row
carries `item`, `level`, `qty` and the real `spend`. So there is no new local
manifest: `arbStockLoad()` asks the bridge what it abandoned and caches the
answer in CODE storage, which means a hop costs no round trip and a bridge
outage degrades to the last known list rather than to nothing. The bank is the
verification, never the source - `character.bank` only populates while standing
in it.

**Closing one out needed no new event type.** The bridge validates against
`LEDGER_EVENTS = ("open","closed","abandoned","banked","adjust","note")` and
refuses anything else, so a `stock_sold` event would have been rejected. It is
not needed. `arbStockPlan()` KEEPS THE ORIGINAL TRADE ID, `arbFinish()` already
emits `closed` against `t.id`, and the replay is a fold with last-write-wins on
status - so the row that was abandoned becomes closed, carries received/net, and
leaves `abandonedSpend` on its own. Reusing the id is also what makes the number
honest: the basis is the gold really spent, so `net = received - spend` is the
true P&L on the original decision rather than a windfall. A hand-written snippet
using `spend: 0` would have made `arbBankShare` bank half the entire receipt.

**New phase `fetch`, ahead of `holding`.** The goods are in the bank, not the
bag, so `arbStockFetch()` walks to the bank, withdraws by name AND level, and
`arbHeldAdd()`s the result to shield it from both NPC sell paths. Everything
after that is the machine that already existed: hop, `arbApproach`, re-verify
the slot and its `rid`, sell through `arbGoldDelta` so the gold is measured
rather than assumed, reroute if the buyer repriced. A short count sells what is
actually there; a missing item gets a `note` and is dropped from the list rather
than walking to the bank for a ghost on every tick.

**`arbLookForWork` unwinds stock before buying more.** It commits no gold and it
is the only thing that turns dead stock back into liquid. Cheap when there is
none: `arbStockLoad()` is cached and returns an empty list without touching the
market, so the 30-second beat pays nothing extra for the feature.

**A failed stock sale does not trip the stranding breaker.** `t.fromStock` makes
the stranded phase read `arbStrandings()` rather than `arbStrandings(1)`. That
breaker exists to stop gold being converted into stock; re-banking goods that
were already banked converts nothing, and without the flag retries would have
disabled arbitrage outright.

`stockRecovery.minProfit` is 100,000, deliberately far below the buy-side
500,000: the goods are already paid for, so the only question is whether the
sale beats the cost of a shard hop. Against the measured board that floor skips
9 of 24 items worth 1.9M combined while keeping three worth 446M.

Covered by 25 assertions run against the extracted function bodies: the
abandoned-only filter, the outage fallback, vendor-beats-player, minProfit,
level mismatch, blacklisted buyer, stale row, a sell slot misread as a buyer,
best-edge selection across buyers, and every field of the plan including the
preserved id.

SIZE: 253,248 chars, which is 7,488 OVER the 245,760 cap and 5,785 above the
247,463 that v38 reached when `save_code` accepted it and the runner then never
evaluated it. This entry is recorded as built; whether it can be deployed as-is
is a separate question from whether it is correct. Comments are 32% of this file
(77,557 chars), so the space exists - it has not been reclaimed here.

## v60

He stops walking away from the town spot, which is what "when scouting and at
the town spot the merchant should not be moving" asked for.

**The scan gate was measuring the wrong thing.** `scoutGoToScanSpot` returned
early only `if (character.map === CONFIG.stand.map && distance(character, spot)
<= 60)` against `CONFIG.stand.candidates[0]` at (100,0). The town spot is 288.1
units from there, so that test was false every single time and he walked off the
town spot on every scout cycle, with `goToTownSpot` pulling him back for the NPCs
- the oscillation that got reported.

The file already had the right gate and was already using it one function away.
`scoutHeldScan` asks `mInTown()`: can I see the whole `standRegion` from here.
Vision is a BOX - `character.vision` is `[700, 500]`, tested `|dx| <= 700 &&
|dy| <= 500` - and against `standRegion {minX:-250, maxX:260, minY:-210,
maxY:190}` the town spot's worst corner is 439 in x and 262 in y. It PASSES,
with 261 and 238 units to spare, so the reading taken there is complete and the
walk bought nothing. Any position in x -440..450, y -310..290 passes. The note
at MerchantComments.md#the-gate-is-now-can already said the gate should be "can
I see the whole stand region, not am I within 60 of the first stand candidate";
that was applied to `scoutHeldScan` and never carried across. It is carried
across now.

**Two server rules make standing still worth more than the walk.** From
`node/logic/market_patron.js`, `qualify()` counts `p.moving` as a blocker - a
moving merchant does not qualify for Merrit AT ALL - and `anchor_tolerance` is
4, so moving more than 4 units from an anchored session invalidates it. Every
288-unit round trip was resetting Merrit progress, not merely costing time.

**The town spot is now stand candidate[0], and it is the better spot.** Measured
against the real config in `design/npcs.js` (`citizen22.market`): its `areas` are
`[[-240,-120,240,144],[-88,144,88,360]]` and the town spot (-179,-72) is inside
the first one, so it qualifies. On `npc_clearance` (40) it is far safer than what
it replaces - the nearest non-movable NPC to the town spot is `basics` at 129.4,
where (100,0) has `bean` at 42.8 and `secondhands` at 47.4 and clears the
threshold by only 2.8 units. The other five candidates stay as fallbacks, since
`stand_clearance` (10) and the 10x15 front box depend on other players' stands
and cannot be checked ahead of time.

Note the stand handler itself has no position check at all - `socket.on("merchant")`
just sets `player.p.stand` - so "valid zone" is entirely about whether Merrit
visits, never about whether the stand opens.

Slot size 244,495 chars - 1,265 under the cap, and 137 SMALLER than v59. Three
comment blocks that were duplicated verbatim in MerchantComments.md were trimmed
to pointers to pay for the two changes above; the prose is unchanged in the doc.

## v59

Three movement fixes. The reported symptom was "the move to town spot fails
while in motion to it and performs the backup".

**The Ponty walk is gone, and it was never necessary.** The server answers
`secondhands` for anyone within 500 of Ponty - `simple_distance(...) > 500` gives
`game_response "distance"` and nothing else. Ponty stands at (106,-47). Every
spot this merchant parks at was already inside that gate: stand candidates
47.4-295.2, the town spot 286.1, the town spot plus its full 60 radius 346.1.
The old guard walked on `!atTownSpot()`, and `scoutPontyCheck`'s ONLY caller made
that true on every single cycle - `scoutVisitNextShard` runs `scoutGoToScanSpot`
first, which lands on stand candidate[0] (100,0), 47.4 from Ponty rather than the
town spot. So it walked 47 units to enter a range it was already 453 units
inside, and that second `smart_move()` rejected whatever move was in flight.
Dead code with a live side effect. Out of range it now SKIPS; `scoutPontyDue()`
keeps the scan due and the caller repositions next cycle. The note this replaces
claimed the walk was "kept for anywhere else, because anywhere else means the
merchant is mid-errand" - mid-errand is precisely when it did the damage.

**The move lock is real now.** `travelBegin()` only ever incremented a counter,
while its own comment and `moveNudge`'s both already claimed it "holds the lock".
Eighteen call sites reach `moveTo`/`moveTown`/`moveNudge` from independently
self-chained loops, and a second `smart_move()` rejects the first - so two loops
that both wanted to move turned a healthy trip into a spurious failure, and
`travelTo` then ran its `town()` backup for a trip that was never broken. The
loser now fails fast with a tagged `move_busy` error; `travelTo` recognises the
tag and returns false silently instead of logging red and recalling to town.
MEASURED 2026-09-27: `state.travelling` was already 1 when an unrelated
town-spot move was issued.

It is TIME-BOUNDED on purpose. Only `travelEnd()` ever cleared that counter and
Merchant.js never got `noHang()`, so one await that never settled would have
wedged every mover in the file for good - silently, which is strictly worse than
the stand suppression a stuck counter used to cause. `moveLockHeld()` breaks a
lock older than `CONFIG.moveLockMaxMs` (3 min) open and logs when it does, so
"the lock is abandoned" and "the lock is working" cannot stay indistinguishable.

**The stand's home-shard gate is re-checked after the walk.** `shouldHoldStand()`
was evaluated once on entry to `openStandAtBestSpot`, which then awaited
`travelTo` - and he hops shards constantly, so the `homeServer` gate could pass
on information seconds out of date and raise a stand on a foreign shard. It is
re-checked immediately before `open_stand`. The candidate loop also yields to the
lock: without that, a lock held elsewhere made all five candidates fail fast and
the loop ended on a misleading "could not open stand at any candidate location".

Slot size 244,632 chars - 1,128 under the 245,760 cap. The next change to this
file needs comment relocated to MerchantComments.md before anything is added.

## v58

The map-churn half of the permanent blacklist becomes a one-hour hold.

v57 gave `NEVER_TRADE_NAMES` two automatic feeders. The failure one is sound:
8 consecutive failures past a backoff ceiling really is not new information.
The `mapChurnLimit` one was not, because a merchant that moved three times in
30 minutes is unusable NOW, not for ever - relocating and then settling is
ordinary behaviour, and nothing ever expired the verdict.

Measured 2026-09-27, 29 hours after v57 shipped: 79 merchants permanently
excluded, every one of them with a `changed map N times` reason, accumulating
at roughly 2.7 per hour with no expiry, against a market of 272 merged merchant
rows. That is 29% of the market gone and still climbing - the same ratchet
shape as the farm-spot blacklist in TASKS.md item 1.

It had already cost trades. `arbProbeFindFlips` drops a blacklisted row whole,
both its sells and its buys (`if (arbNeverBlocked(r.id)) continue;`), so a
watchlist showing slice_nightberry at a 1,000,000 spread produced zero
candidates: the buy side, SalesShadow, was on the list. Ten hours passed with
no attempted trade while `arbCanStart` returned `{ok:true}`, no halt, nothing
in flight, and 85,147,025 gold against a 10,000,000 floor.

- `mapChurnHoldMs` (1 hour) is the new knob, and `arbChurnNote` now calls
  `arbNeverHold` instead of `arbNeverPromote`.
- `arbNeverHold` writes `{at, why, until}`. `arbNeverBlocked` treats an entry
  carrying `until` as expired once it passes; an entry without one stays
  permanent, so the hardcoded pair and the failure promotions are unaffected.
- `arbNeverPromote` will now overwrite a temporary hold, which it had to learn:
  its `if (m[target]) return false;` guard would otherwise have let an hour-long
  churn hold block a genuine 8-failure promotion from ever landing.

Not a fix for the visibility theory that preceded it, because that theory was
wrong. The merchant already merges all three feeds - `arbProbeMarketRows`
returns `source: "merged"` over aldata 270, bridge 55 and game 60. Reading only
`arbFetchGameMerchants` and calling its 60 rows the whole picture is the trap;
it is one of three sources, and the flip finder does not use it alone.

## v57

A permanent counterparty blacklist.

Every vendor-level exclusion up to now was temporary by design: `arb_fail` holds
for `min(2min * 2^(n-1), 60min)`, forgets the count `failForgetMs` later, and is
wiped entirely by a single success, so "occasional failures never compound into a
permanent ban". Correct for a seller who stepped away; useless against one whose
listing is never really there, because failure 13 and failure 6 produce the same
60-minute hold and the route is retried forever.

`NEVER_TRADE_NAMES` is permanent and keyed by name rather than `shard|name`.
Seeded with Kazhag (EUI, 13 consecutive failures, and the buy side of every
strict flip candidate in the 2026-09-26 report) and Balitr (USI - advertised
offeringp at 6,000,000 x12 with an ALData age of 2 minutes, but the rendered
entity had `buySlots: 0`; six samples over 20s had him stationary at 336,-985,
`moving: false`, 140 units away, and a trade sat at `at_sell` for 19 minutes
against a phantom order).

Two automatic promotions feed the same list, both writing to CODE storage so
they survive the `change_server` reload - and a DEPLOY DOES NOT CLEAR THEM,
which is what makes them permanent and why promotion logs in red:

- `neverTradeAfter: 8` consecutive failures. The backoff ceiling is reached at
  failure 6, so past that another retry is not new information.
- `mapChurnLimit: 3` map changes inside `mapChurnWindowMs` (30 min). MAP
  transitions only, so local shuffling is ignored. Measured 2026-09-26 over 7
  ALData observations spanning two minutes: earthMer 4 changes across USII
  `bank_b`/`main`/`arena`, Manillo 1, and MuaBan, Ellume, Gobbo, Kazhag and
  Balitr all 0. The default separates the one that never settles from the one
  that relocated once.

Filtered at feed ingestion like `NO_TRADE_ITEM_NAMES`, and again in
`arbProbeFindBuy`, `arbFindBuyerFor` and the candidate filter, so no path
reaches a refused name by another route. `arbNeverList()` reads the lists,
`arbNeverForget(name)` undoes an automatic entry and clears its churn record.

Exercised before shipping against the measured sequences rather than by reading:
18 assertions covering earthMer's real map order (bans), Manillo's (does not),
a stationary merchant (one write then silence), a lapsed window (resets rather
than accumulates), the hard-coded names, forget-and-clear, and `mapChurnLimit: 0`
disabling promotion.

Size: 239,870 chars, 5,890 under the 245,760 ceiling. The long rationale went to
MerchantComments.md under `NEVER_TRADE_NAMES` and `mapChurnLimit` rather than
into the slot, for exactly that reason.

## v56

Tracktrix is protected from both sell paths.

The item's name is `tracker`; `Tracktrix` is only its display label
(`G.items.tracker.name`), and there is no `tracktrix` key in `G.items` at all -
measured 2026-09-25. It was absent from `PROTECTED_ITEM_NAMES` in every
spelling, which left it exposed in both places that set is consulted:
`sellAggressivelyIfLowOnSpace()`, which vendors nearly anything once the bag is
almost full, and `ssVendorBound()`, which would have listed it on the stand.

It vendors for SEVEN GOLD, so neither path would have registered as a loss worth
noticing, and no value-based guard could have caught it. The item is what records
achievements for bonus stats - its worth is in holding it, not in any price.

Arbitrage was deliberately left alone. It only sells what it bought, tracked in
`arbHeldNames()`, so a tracker acquired for achievements is not arbitrage stock
and is not at risk from it. Adding the name to `NO_TRADE_ITEM_NAMES` would have
blocked BUYING one as well, which is the opposite of what is wanted.

## v55

replayed potion requests are refused.

A delivery watermark now lives in CODE storage, one entry per recipient per
potion type, and a low_potions request whose send time predates the watermark is
dropped at intake instead of becoming a job.

THE CAUSE. plCursor (line 78) and plSeen (line 80) are both in-memory, and
change_server reloads the page on every hop, so both reset. The bridge keeps
messages for MESSAGE_TTL - ten minutes - and serves everything with seq > since.
So after each hop the merchant asked for everything since zero and got up to ten
minutes of already-satisfied low_potions requests handed back, every 2s
(pollMs), each one becoming a fresh delivery job the moment processBatch had
spliced the queue empty.

MEASURED 2026-09-25. MageofOz was brought under threshold deliberately: 400
mpot1 moved off him, leaving 278. One genuine request produced three deliveries -
+999 at t+424s while low, then +1000 at t+556s and +1000 at t+601s with him
already at 1183 and 2151 and not asking. Left alone he reached 10,563. The priest
reached 11,059 the same way. The merchant log showed enqueue delivery:MageofOz
firing every two seconds with dupSup=true - the replay storm, suppressed only
while a job already sat in the queue.

The fighters were innocent. requestCooldownMs (30s) worked correctly throughout;
every duplicate came from the merchant re-reading stored messages, not from a
fighter re-sending. Nothing in Ranger/Priest/Mage needed changing.

WHY A WATERMARK RATHER THAN PERSISTING plCursor. The bridge does not persist its
seq counter: __init__ sets self.seq = 0 and save() writes only merchants, ponty
and activity. A restart therefore rewinds seq to zero, and a persisted cursor of
several thousand would make `seq > since` permanently false - the merchant would
go silently deaf to every relayed request until the bridge climbed back past it.
The watermark cannot fail that way. Its worst case is one redundant delivery, not
total deafness.

WHY NO BLANKET STALENESS GATE. A "drop anything older than 60s" rule was
considered and rejected. It would drop real requests, because reprobeMs is five
minutes - after a bridge blip the first successful poll legitimately carries
messages minutes old - and because a hidden Chrome tab throttles setInterval
toward one tick per minute, which is this repo's oldest measured trap. Worse, a
dropped request never becomes a job, so it can never age into
arbOldestJobAgeMs > jobPreemptMs. The blunt gate would have blinded the exact
safeguard that exists to notice a fighter waiting too long.

THE UNIT TRAP, for whoever touches this next. The bridge stamps ts with
time.time() - epoch SECONDS - while every clock in Merchant.js is Date.now()
milliseconds. plPoll converts once, at the point the message enters the handler.
Comparing a raw seconds value against a millisecond watermark reads as 1970 and
would refuse EVERY request rather than only replayed ones, which looks like a
merchant that has stopped delivering for no reason.

Keyed per potion deliberately: an mp delivery must not suppress an hp request
made a second earlier. Stamped before send_item deliberately: a reload landing
between the send and the write is the gap the mark exists to close, and the cost
is bounded - an in-batch retry reads from memory, which the watermark does not
filter, and a wholly failed batch is re-requested 30s later with a fresh stamp.
The suppression logs every time; a silent guard would make "refused a replay"
and "nobody asked" indistinguishable.

Pickups are untouched. A replayed inventory_almost_full costs a wasted trip
rather than a wrong outcome, and "still full" is not the same predicate as
"already served".

## v54

tier-0 potions are no longer protected.

PROTECTED_ITEM_NAMES dropped 'hpot0' and 'mpot0'. The fighters dropped them from
muling.excludeItems, the ranger also from inventoryRelief.neverSell, and
Cleanout.js from CONFIG.protect.

There is nothing left to protect. Measured 2026-09-25 across Dexon, FatherToken,
MageofOz, Meltymerch and all three bank packs: zero hpot0 and zero mpot0. Every
buy path is tier 1 already - ensureStock('hpot1'), ensureStock('mpot1'), and the
delivery picks `dj.potion === 'mp' ? 'mpot1' : 'hpot1'` - so nothing re-acquires
tier 0. The 3,354 hpot0 that had accumulated on FatherToken were cleared by hand.

Worth recording why removing the protection was NOT what drew that pile down,
because the obvious reading is wrong. Protection governs muling and selling, not
drinking. use_skill('use_hp') resolves to use('hp'), which in
adventureland_mongodb js/functions.js:4593 scans character.items from the LAST
slot BACKWARDS and consumes the first item whose `gives` matches the resource:

    for (var i = character.items.length - 1; i >= 0; i--)

Tier is never consulted - slot position alone decides. FatherToken's hpot0 sat
at slot 0, beneath hpot1 at slot 2, so the scan reached tier 1 first every time
and those 3,354 potions were unreachable no matter how long he farmed. The
ranger never had the problem because inventorySorter pins hpot1/mpot1 to low
slots; the priest and mage have no sorter, which is how the pile stranded.
Unprotecting it would have muled and vendored the stock (~40k gold), not drunk
it (~168k gold of tier 1 displaced).

The stock counts still read quantity('hpot0') + quantity('hpot1') and the mpot
equivalent on purpose. They are counters, not protection: leaving tier 0 in the
sum means a stray tier-0 stack cannot mask an empty tier-1 bag and suppress a
restock.

## v53

a stored arbitrage halt is no longer cleared by a redeploy.

arbHalted() gated a persisted halt on `h.build !== MERCHANT_BUILD`, treating a
build change as "you have redeployed, so you presumably fixed the cause". That
clause is gone.

It had never once run. MERCHANT_BUILD was frozen at 'v27 / arb.4 / 2026-09-19'
from 2026-09-19 while the file reached v52, so the comparison was always false.
Fixing that string earlier on 2026-09-25 armed a path that had never executed,
and its first effect would have been to clear this breaker on EVERY deploy.

The theory behind it does not hold here. Deploys mostly touch unrelated
subsystems - the three before this one were farm scoring, a mirror document and
a build string, none of them related to stranding. Under the armed clause, a
stand or gear commit would have silently resumed an executor that stopped
because the market being traded against was not the market on the board. That
is the exact failure the breaker exists to stop, and the cost is on record:
71,981,480 gold into unsold stock on 2026-09-23 alone, behind an in-memory
breaker that tripped 18 times across two days and never stopped a trade.

Two bounds remain, neither resting on an inference: haltMs expiry (60 min), and
arbProbeHalt(false) by hand. The manual clear already says "I fixed it, resume
now" as a deliberate act rather than a side effect of an unrelated commit. The
cost of removal is at most a 60-minute wait or one console call after a real
fix.

`build` is still stamped into the stored halt, now purely diagnostic, and
arbProbeHalt() prints it ("tripped on build ...") so the field is read rather
than write-only.

The CONFIG.arbitrage.haltMs comment promised three bounds and now describes
two, with the removed one and its reasoning recorded there.

## v52

gear tripwire - four reasons not to attempt a gear step. DEFAULT OFF.

CONFIG.gearTripwire.mode is 'off' (default), 'observe' or 'enforce'. In
'observe' every step is judged and logged and NOTHING is blocked, which is the
intended way to watch it before trusting it. gearProbeTripwire(n) dumps the
verdicts and a tally of which predicate fired.

WHY. The gear chooser optimises cost-per-success and nothing else. It cannot
see what the finished item costs, what the party already wears, or whether the
inputs it needs exist. All three were live on 2026-09-25:

BUY BEATS BUILD. Measured from the real market that day:

    step        success   bases/success   build      buy finished   verdict
    +3 -> +4      68%         1.47       1,529,412     2,500,000    BUILD 1.6x
    +4 -> +5      58%         1.72       4,379,310    15,054,400    BUILD 3.4x
    +5 -> +6      38%         2.63      39,722,105    22,905,600    BUY   1.7x
    +6 -> +7      24%         4.17      95,606,667    66,521,280    BUY   1.4x

The crossover is at +5: below it building is several times cheaper, at and
above it success rates collapse faster than prices rise and buying wins. The
market is near-efficient at the top (1.1-1.7x), so this avoids losses rather
than finding free money.

NO IMPROVEMENT. Dexon already had firebow +7 equipped while the plan ground a
spare toward +5. parent.party carries no slots and parent.entities is
proximity-bound, so the only source that works while the party is off farming
is the party_link cache at cstore_<name>_newparty_info, which does carry slots
and lastSeen. Verified against Dexon's own tab: firebow +7, 14 slots, age 0s.
The recipient is resolved from parent.party[name].type rather than hardcoded,
so a roster change does not silently misroute gear.

INPUTS UNOBTAINABLE. Zero dexearrings were for sale on any shard in either
feed, while all three plan candidates were dexearring compounds needing three
copies each. That plan could never complete, and the loop re-evaluated it every
cycle regardless. A compound with fewer than three copies and no asks anywhere
is now reported - including the case where it never reaches the affordability
check, which is how it stayed invisible.

VALUABLE WITHOUT AN OFFERING. Break-even is 10,500,000, measured: at that item
value the safe route (scroll2 + offeringp, 94%, 7,021,277 per success) and the
cheap route (scroll1 alone, 58%, 68,966 per success but 0.724 items destroyed
per success) cost the same. Above it, grinding unprotected destroys more value
than it saves.

NOTE ON THE FIREBOW LOST ON 2026-09-24: a +3 asks 1,000,000, so the +4 was
worth 2-4M, well under break-even. The 58% gamble was CORRECT and simply lost.
This tripwire would not have saved it and is not meant to. It exists for the
range above the crossover, where dexbelt +2 bids 2,500,000 and dexbelt +5 bids
1,000,000,000 - 400x for three levels.

EVERY PREDICATE FAILS OPEN. A missing market read, stale party info or a thrown
lookup allows the step. A tripwire that silently halts all gear work because a
fetch failed would be worse than the behaviour it replaces. gtJudge catches
everything, logs, and returns allow.

No harness in this repo, so the predicates were extracted and run standalone
against the real 2026-09-25 prices: 15 cases covering the full buy-vs-build
ladder, the equipped-gear comparison, stale party info, obtainable and
unobtainable compounds, above and below break-even with and without an offering
held, and three fail-open paths. All pass.

NOT BUILT, deliberately: offering stock-keeping (buy up to a quantity, bank,
retrieve). Nothing currently owned comes near break-even - the entire gear
inventory is three dexearrings worth about 50,000 each - so locking 50-100M
into offerings would idle capital that arbitrage returns 52.3% on. The tripwire
is the cheap half; the stock is worth building when something actually crosses
10,500,000.

## v51

one closer, one opener.

v50 fixed the rate of stand churn. This fixes the RACE, which v50 did not
touch: measured 2026-09-25, travelToBank closed the stand correctly - the spy
caught the close - and something reopened it 1.2 seconds later, mid-walk. He
finished the trip to the bank at speed 10 with state.busy false, no trade in
flight, and nothing claiming to be doing anything.

WHAT THE INVENTORY SHOWED, and it was not what was expected. All 14 movement
call sites live in 7 functions, and every one of those 7 ALREADY closed the
stand. There was no mover that forgot. The only close-side gap in the whole
file was mHopTo, which changes shard without closing. So consolidating the
closers - which is the obvious fix and the one asked for - would have fixed
almost nothing on its own.

The gap was on the open side: six reopen sites, none of which checked whether
the character was walking, two of them firing on timers.

CLOSER. travelBegin/travelEnd plus moveTo / moveTown / moveNudge. Every mover
routes through them. The load-bearing part is not the close - that was already
universal - it is that state.travelling is held for the WHOLE duration of the
move rather than only its first instant. A close-before-move wrapper closes at
t=0 of an await that runs for minutes and has nothing to say about second 1.2.

state.travelling is a COUNTER, not a boolean, because travel nests: travelTo
falls back to town() and then moves again, and a boolean would clear on the
inner unwind while the outer move was still running.

moveNudge deliberately does NOT close the stand. The two nudge sites
(travelToRecipient's xmove, arbProbeStep's move fallback) are a few units of
in-map repositioning, and closing for those would reintroduce the exact
teardown-per-unit-of-work granularity v50 removed. It still takes the lock.

mHopTo now closes before change_server.

OPENER. Six sites become one. processBatch, gearProgressionLoop,
anniversaryKissLoop, scoutGoHome and resumeInterruptedTrip lose their reopens;
arbLoop's moves into standLoop(). Five were imperative restores ("I closed it,
so I put it back") and arbLoop's was already a reconciler - so the reconciler
is what survives, and it is declarative: if nothing is happening, we are home,
and there is no stand, raise one. Every former caller is covered because they
all end by clearing the flag they took. Cost is up to reconcileMs (4s) of
latency before the stand returns.

resumeInterruptedTrip's call was not even awaited. Deleting it fixes that for
free.

WHY standLoop IS ITS OWN LOOP rather than a line inside arbLoop: arbLoop is a
self-chained async loop and Merchant.js never got noHang() - that shipped in
Ranger v51 / Priest v26 / Mage v50 only. If any await in arbLoop never settles
the chain ends silently, and leaving the sole stand-opener inside it would make
the stand's existence inherit arbLoop's liveness. The redundancy that would
currently mask such a hang is exactly what collapsing six openers into one
removes, so the two changes must not be combined.

PROBE.hold is now honoured. The old arbLoop line sat outside that guard, so a
probe hold stopped everything except stand churn. As the sole owner that
inconsistency would have become the only behaviour.

state.standSuppressed added: the reconciler opens whenever idle-and-home-and-
down, which loses the wasStandOpen intent the old restores carried. Without an
explicit flag there would be no way to keep the stand down while idle at home.

No harness in this repo, so the lock and the guard were extracted and run
standalone: 22 cases, including nesting, release-after-throw, nudge-does-not-
close, and a direct reproduction of the bug (a reconciler check during an
in-flight move must not fire). All pass.

NOT FIXED HERE, observed live while writing this: the stand was found open at
(-179,-72), which is CONFIG.townSpot and 106.9 units from the nearest candidate
spot against a 20-unit threshold. That is travelTo's tail returning true after
the town() fallback without verifying arrival, so openStandAtBestSpot believes
it reached a candidate and opens where it stands. Known since 2026-09-24, still
unfixed, and unrelated to the stand race.

## v50

stand thrash: stop paying a cross-town round trip per gear step.

MEASURED, not read. A stand spy wrapping open_stand/close_stand recorded 3 opens
and 3 closes in 33 seconds, and the console carried twelve unbroken minutes of
`smart_move: main 100 0` alternating with `smart_move: main -179 -72`.

Two wrong diagnoses died on the way, both recorded here because the reasoning is
the reusable part:

- "Two loops fighting over the stand with no lock." Wrong. gearProgressionLoop
  and anniversaryKissLoop both guard on state.busy and they alternate correctly.
  The stack traces showed both loops touching the stand, which is not the same
  as showing them racing.
- "The loop spins doing nothing." Also wrong. attemptBestPlanStep returns false
  when no candidate has an affordable available step, and the gate above it only
  checks that candidates EXIST - so a uselessly spinning loop was plausible. It
  is not what was happening: firebow at level 4 toward target 9 was a genuinely
  eligible upgrade at 40,000 gold, affordable, every single tick.

The real fault is granularity. gearProgressionLoop ran every 8s and performed
exactly ONE step per cycle, with a stand teardown and rebuild wrapped around it.
So one 40,000-gold upgrade attempt cost a close, a speed-clamped walk to
(-179,-72), and a walk back to (100,0) to reopen. Firebow needs five more
levels, so this was set to continue indefinitely.

Three changes:

- CONFIG.stand.minDwellMs (3 min) and state.standOpenedAt, with standDwellHeld()
  gating gearProgressionLoop. A floor, not a lock - callers still decide whether
  they want the stand. Arbitrage is deliberately exempt: a trade in flight has
  gold committed to a destination and has to travel.
- gearProgressionLoop batches up to CONFIG.gearProgression.maxStepsPerVisit (12)
  steps per visit instead of one. Both inner calls re-read character.gold and
  both return false when nothing is affordable, which ends the visit.
- gearProgression.intervalMs 8000 -> 30000. 8s was never sensible for a loop
  that crosses town.

NOT fixed here, because it was not measured: anniversaryKissLoop sets
state.kissAttemptedFor only on SUCCESS, so a kiss that keeps failing retries
every 5s forever, tearing the stand down each time. The kiss path was dormant
(findFeaturedPlayerName() returned null) when the driver was identified, so
there is no evidence it is currently misbehaving and no fix is being shipped on
a guess. The minDwellMs floor would blunt it; wiring the kiss to respect the
floor needs thought, since an event round is only 5 minutes long.

Throughput note: worst case is now 12 steps per 3 minutes (4/min) against the
old 1 step per 8s (7.5/min), in exchange for roughly one walk instead of
twenty-two. Raise maxStepsPerVisit if the ceiling ever binds.

## v49

Backfilled 2026-09-25 from commit 0a59254; shipped without an entry.

make the stranding breaker actually stop, and cap nightberry.

The breaker had never once stopped a trade. It fired 18 times across two days -
"executor stopped itself after 2 ... 3 ... 4 ... 5 ... 6 ... 7 consecutive
strandings" - and trading continued straight through every time.

Cause: it only set CONFIG.arbitrage.enabled = false, which is in-memory, and
change_server RELOADS THE PAGE. The next shard hop rebuilt CONFIG from the saved
build and undid it. The stranding COUNTER is persisted, which is why it climbed
2 -> 7 instead of resetting: it re-tripped one higher on each hop. Same root
cause as three other bugs found that week - state that does not survive the
reload.

71,981,480 of gold went into unsold stock behind it on 2026-09-23 alone, against
24,275,984 of profit over the same window. Every closed trade was profitable;
the losses were all in capital that stopped being liquid.

The halt is now persisted in CODE storage and bounded three ways, so a stored
stop can never outlive its usefulness - which is what the existing "no runtime
toggle for enabled" rule was protecting against, and why this is not simply a
persisted flag:

  - it expires after haltMs (1 hour)
  - it is ignored when MERCHANT_BUILD has changed, so a redeploy clears it and a
    build can never ship silently halted
  - arbProbeHalt(false) clears it by hand and resets the counter

SECOND CHANGE: CONFIG.arbitrage.itemCapitalCap, a per-item ceiling on what one
trade may spend. slice_nightberry set to 10,000,000. It earned 5,560,000 on
closes while stranding 62,100,000 - including a single lot of 52 units for
46,800,000 that found no buyer at all. Three days of data said the same thing:
7.8%, then 8.5%, on more deployed capital than every other item combined. Not a
bad spread - a thin spread bought in sizes this market cannot absorb. The cap
would have blocked that 46.8M lot outright.

KNOWN DEFECT, found 2026-09-24 while diagnosing something else: MERCHANT_BUILD
was never bumped across v45-v49 and still reads "v27 / arb.4 / 2026-09-19". The
build-changed test above therefore never fires, so a halt DOES survive a
redeploy. The escape hatch is inert until that string is maintained.

## v48

Backfilled 2026-09-25 from commit d4ccc80; shipped without an entry.

close the stand before the anniversary kiss chase.

Caught in the act: Meltymerch walking out to the party's farm spot with his
stand still deployed. The server clamps speed hard for that, in node/server.js:

    if (player.p.stand || player.s.hardshell) player.speed = 10;

A quarter of his normal pace, for the whole trip.

Audited every mover in the file rather than patching what was in front of me.
travelTo() already closes the stand itself, so all eight of its callers were
covered, and the six raw smart_move sites each had an explicit close - except
two, both inside attemptKiss(). The first read of this blamed
openStandAtBestSpot(); that was wrong, it goes through travelTo and is fine.

attemptKiss is the worst possible place for the gap. It chases
parent.S.anniversary.target, who can be anywhere on the map - including standing
next to the party at crabs - and the chase loop reruns for a full 30-minute
featured round, re-issuing smart_move every couple of seconds.

Second change, same function family. The stand candidate list is tried strictly
in order and the spots are deliberately spread out "in case one spot is
blocked", so ending up on candidate 3 is a normal outcome.
openStandAtBestSpot() would then march him back to candidate 1 on every call -
closing the stand to travel, reopening at the far end, for no gain over the
perfectly valid spot already under his feet. It now tries whichever candidate he
is already standing on first.

NOTE, 2026-09-24: this did not cure "the merchant is moving with his stand out".
It closed two real gaps, but the dominant cause was gearProgressionLoop's
teardown/rebuild cycle - see v50.

## v47

Backfilled 2026-09-25 from commit bf89752; shipped without an entry.

stop the merchant selling arbitrage stock at a loss. Two ends of the same hole,
both found by tracing where 63.5M went.

1. RESERVE PRICE on the fallback exit. arbFindBuyerFor runs after the planned
buyer fails, and it took the best bid on the board with no reference to what the
goods cost - its own comment said the question had become "is there any exit at
all". On 2026-09-22 it bought feather0 x331 from Zintaro for 82,750,000 and sold
the lot into MuaBan's 60,000 bid 28 minutes later: received 19,264,200, net
-63,485,800. Every other trade that day was positive; without this one the day
was +75.6M rather than +12.1M.

CONFIG.arbitrage.fallbackMinRecovery (1.0) now floors that exit. Checked against
the real numbers: 60,000 x 331 x 0.97 = 19,264,200 against a need of 82,750,000,
so the bid is refused and the goods are banked instead - already a supported
outcome with its own stranding breaker. The refusal logs, because otherwise
"nobody was buying" and "everyone was buying too cheaply" stay indistinguishable
forever.

2. ARBITRAGE STOCK hidden from both NPC sell paths. Neither sell path knew
arbitrage existed. sellTrash vendors anything on its whitelist on sight; the
aggressive seller vendors nearly anything once free slots drop to 5. Both price
by NPC value, and the slices arbitrage trades in millions vendor for SIX GOLD.
slice_nightberry absorbed 124,200,000 in one day and vendors at 6/unit. Free
slots were 9 when this was found.

Worse, it would have been invisible: NPC sales are recorded nowhere - not in the
bridge ledger, not in the server's trade_history, which logs player trades only.

ARB_HELD_KEY registry, keyed by NAME because stacks move and merge, consulted by
sellTrash, sellAggressivelyIfLowOnSpace and ssVendorBound. Conservative on
purpose: ordinary loot sharing a name with live stock is protected too, which
costs a little vendor gold and risks nothing. Self-healing - a name the bag no
longer carries is dropped on the next read, so a stale entry cannot protect an
item forever.

3. slice_blueberry off the sellTrash whitelist. Arbitrage has paid 2,000,000 for
one; the NPC pays 6. It was on a list of things to vendor on sight.

## v46

Backfilled 2026-09-25 from commit 0574e5a; shipped without an entry.

never buy or sell the two event boxes. marketparcel and anniversarygift are
protected end to end: not vendored, not listed on the stand, not traded by
arbitrage.

Two changes were needed, because PROTECTED_ITEM_NAMES does not do what its name
suggests. It is consulted in exactly two places - the aggressive NPC dump and
ssVendorBound - and arbitrage never looks at it. Not a guess: offeringp had been
on that list since forever and was still bought and flipped for 5,980,935 net.

So NO_TRADE_ITEM_NAMES is a second set, applied at flip INGESTION in
arbProbeFindFlips rather than at the point of sale. A name filtered out of the
buys/sells feed cannot reach any caller, hand-run probes included. The Ponty row
loop gets the same filter.

WHY THESE TWO - measured from the live drop tables and the server's own
chest_exchange (one weighted pick per box, nested "open" recurses, no _bonus
tables for either):

  marketparcel     contents EV  8,232 vendor gold vs unopened NPC value 60 (137x)
  anniversarygift  contents EV 21,907 vendor gold vs unopened NPC value 60 (365x)

Vendoring either unopened throws away almost all of its value, which is the
failure this prevents. The player market pays more again - 23 marketparcels sold
to CrownMerch for 45,999,997, roughly 240x the vendor value of the contents -
but these are being kept rather than sold, so that price is declined knowingly.

Buy thresholds if ever wanted: 8,232 and 21,907. Market is 120-240x that, so no
price near trading justifies buying them to vendor the contents. Chasing the
five 0.0222% rares in a marketparcel is worse - about 900 boxes per rare, 900M
at market, for items whose vendor value is 192k-744k.

## (unversioned) stand sales disabled

Backfilled 2026-09-25 from commit 784cff3; shipped without an entry. Sits
between v45 and v46 and carries no version bump of its own.

Observed in production within ten minutes of deploying v45.

The first pass worked exactly as designed: five vendor-bound stacks listed on
the home shard, each priced at the cheapest competing listing minus 1g and each
above its NPC floor (marketparcel x3 @1999999, anniversarygift x80 @999999, cake
@119, confetti x7 @39, beewings x10 @29). Verified against a fresh market read:
every ourPrice was exactly cheapestOther - 1, and ssCheapest correctly excluded
our own stand.

Then the arbitrage loop hopped Meltymerch to EU III. change_server reloads the
page, and after the reload character.slots had no trade keys at all and none of
the five stacks were in inventory either.

Disabled rather than deleted, because everything except lifetime is measured and
working.

CORRECTED 2026-09-24: the goods were NOT lost, and this rollback was not needed.
The client receives player.cslots, not player.slots (node/server.js:867), and
reslot_player() deletes every trade slot from cslots and repopulates only from
get_trade_slots(player), which returns [] when the stand is closed. So a closed
stand makes trade slots invisible CLIENT-SIDE while the goods remain server-side.
Confirmed live: anniversarygift x39 and marketparcel x2 were still held. The
feature can be re-enabled; v47's ARB_HELD_KEY registry independently fixes the
NPC-dump risk this entry worried about.

## v45

stand sales: the best vendor-bound goods are listed on the stand instead of
being sold to an NPC.

Five trade slots (1-5) are owned by the feature. Every five minutes, and on
each stand open, it ranks everything that the NPC sell paths would otherwise
vendor by what it would actually net sold to a player, and keeps the best five
listed. Price is the cheapest live competing listing minus 1g, floored at
ceil(npcValue / (1 - tax)) so a listing can never net less than the vendor
would have paid; below that floor the item is simply left for the NPC.

FOUR THINGS MEASURED FIRST, none of them guessable from the code:

trade(invSlot, tradeSlot, price, qty) takes a 1-INDEXED trade slot. Slot 0 is
an equipment slot and answers "cant_equip". CONFIG.stand.listing.tradeSlot was
0, so ensureListing() has never once succeeded - every call threw and was
swallowed by its own catch under the message "Likely already listed from a
previous run - not critical". That listing is now on slot 16, clear of the
five this feature owns.

Listing MOVES goods out of character.items and into character.slots.tradeN.
They are therefore already invisible to both NPC sell paths, so the "reserve
five slots from the aggressive seller" this feature was asked for needs no
code at all - the exclusion is automatic.

There is no unlist API. The verified removal is
parent.socket.emit('unequip', { slot: 'tradeN' }), after which the goods
return to inventory and restack. trade(..., 0) answers "slot_occuppied".

Because listing frees an inventory slot and unlisting consumes one, this
RELIEVES inventory pressure rather than adding to it. The guard is therefore
on unlisting while nearly full, not on listing.

Market data comes from the bridge when it has any and the game feed otherwise,
and the bridge's answer is validated rather than trusted: it was reporting
zero listings on every shard while pull_merchants returned 659, and an
unvalidated read would have parked the feature silently.

The cadence runs off a timestamp in CODE storage, not a setInterval, because
change_server reloads the page and would reset any in-memory timer.

## v44

the merchant could not approach anyone he was not already standing next to.

arbApproach opened with pEntity(targetName) and gave up the instant it came
back empty. character.vision is [700, 500] and it is a BOX, so pEntity only
ever resolves someone already close - and a shard hop keeps the old position,
which puts the seller well outside it. Three ticks at 4s each, abandoned in
twelve seconds, never a step taken.

The ledger had been saying this all along and nobody read it that way: 333
abandons on "could not reach the seller: not_loaded" against exactly ONE on
"still N units away". Almost nothing was failing to arrive. It was failing to
set off. That is 43% of 774 recorded trades.

The position was known the whole time and thrown away two steps before it was
needed. The market row carries map/x/y, the flip assembly dropped them, so
arbPlan had nothing to copy - despite its own comment promising "everything the
later phases need is copied in now". Flip and trade record now carry
buyMap/buyX/buyY and sellMap/sellX/sellY, and an unloaded seller means "walk to
where they were last seen and look again" rather than "give up".

Two new reasons separate the cases the old one collapsed: not_loaded_at_last_known
(standing on their spot, still nothing - really gone) and not_loaded_on_arrival
(walked there, still nothing). Plain not_loaded now only means no position was
recorded at all, which for a Ponty row is legitimate - those carry x/y null.

## v43

the game's own merchant feed joins the merge as a third source. POST to
https://adventure.land/api/pull_merchants with an empty body returns every
listed merchant on every shard in one ~300ms call - the data behind the
Communicator's "All Merchants" panel. arbFetchGameMerchants maps it into
aldata's row shape and arbMergeMarketRows now takes three arrays instead of
two. Nothing else changed: age still decides, so the bridge wins whenever it
has a row and aldata wins while it is fresher.

It is a CONFIRMER and never a denier, and that distinction is the whole
design. The obvious use - drop an aldata row when the merchant is absent from
the game feed - was tested and rejected. Sampled against in-game vision on US
IV every 15s for 226s: Tricksy and Gn. Spence stood with open stands for the
entire window and never appeared in the feed once, while its US IV count fell
from 10 to 7 as the stands actually visible held at 11-13. It sheds merchants
who never moved. Not the appearance lag, not map, position or afk state - all
ten were on main, PhatTrader at -150,-70 sits inside the cluster of merchants
that ARE listed, and AceShop and CrownMerch are afk=true and excluded anyway.
Sampling or rotation fits; the mechanism is unknown. An absence-veto would have
pruned two live stands on the one shard it was tested on.

The positive signal is sound. Every merchant the feed listed matched ground
truth exactly - position to six decimals, afk state, slot contents and prices.
So the gain is the case aldata cannot cover: merchant still standing, item sold
or price moved. Mapping verified live before deploy - 55 rows, 0 unrecognised
server tags, 51 of 55 keys colliding with aldata's so the merge dedupes rather
than double-counts, the remaining 4 being merchants aldata had not recorded.

gameFeedAgeSec is 128, measured not chosen. A listing placed at t0 was
confirmed server-side instantly, still absent from the feed at t+114s, present
at t+128s. A closed stand was still listed at t1+48s and gone by t1+75s.
Stamping the slower of the two is deliberate: game rows then lose to anything
genuinely fresher and win only against aldata rows aged past ~2 minutes, which
is exactly where aldata starts advertising stands that have gone.

Both latencies are n=1 on one shard, and the 128/75 asymmetry may be
cache-cycle phase rather than two different latencies - that was not separated.
Treat them as "about two minutes", not as precise figures.

This also corrects two claims made while investigating and before the tests
were run. The feed is not live - it was called live on the strength of nothing
more than a count drifting between calls. And a phantom rate of 39% was
computed against it as if it were ground truth; that number inherits the feed's
own ~2 minute lag and should not be quoted.

## v42

the long comments move to Codex/MerchantComments.md. They were 43.7% of the
file - 107,305 chars of 245,699 - and the file had been trimmed twice in one
evening just to keep deploying, once down to seven characters of headroom.
Merchant.js is now 189,886.

111 block and run comments were lifted. Each site keeps its first line as a
summary and gains a pointer, "-> MerchantComments.md#anchor"; the full text
lives under that anchor, which is the function or config key it sat on. Every
pointer resolves: 111 pointers, 111 anchors, none missing, orphaned or
duplicated. The extraction was mechanical and the result verified by stripping
all comments from the before and after and comparing - the code is byte
identical, same SHA. Nothing was rewritten, only relocated.

The header now says so, because a summary that looks like the whole comment is
worse than no comment: most of these numbers were measured live rather than
chosen, and several record a theory that was tried and discarded, both of which
invite tidying by someone who only sees the one-liner.

Two claims in the header were also corrected rather than carried forward. The
"240 KiB" ceiling was wrong - 245,706 loaded and 238,214 did not, so size alone
does not explain that failure. And the backtick rule was overstated: the bisect
that produced it was real, but Codex/FamilyFleet.js carries backticks in
comments and runs, so it is not general and the mechanism is unknown. Both now
say what was actually observed and tell the next person to bisect rather than
trust a number.

## v41

the trade verifier stops opening a modal on every leg. arbProbeVerify is a
hand-run probe that returns through pShow, and arbStillThere calls it to check
both legs of every trade - so each attempt put one modal on screen per leg.
Twelve identical MuaBan/trade10 boxes were stacked when this was found, which
is the same fault v37 fixed in arbProbeFindFlips and the same cause: a probe
written for a person, reused by the automated path with its display side
effects intact. It gains the same quiet option, passed by arbStillThere only;
the return value is byte-identical, so selection and verification behaviour do
not move, and the reason still reaches the ledger through arbFinish.

Worth noting for whoever edits this next: the file is now 245,699 chars and
the largest size PROVEN to load is 245,706. That is seven characters of room.
The 240 KiB figure in the header is not trustworthy - it was inferred before
the backtick bisect and a 238,214-char build later failed to load while a
245,706-char one succeeded, so size and that failure are not the same thing.
Before adding anything substantial here, either establish the real limit or
spend a pass trimming prose, of which there is plenty.

## v40

two fixes, both cases of a cached value drifting from the truth. The stand
first: ensureStandClosed early-returned on state.standOpen, which is only our
note of the stand, not the stand. change_server reloads the page on every shard
hop, so state comes back with standOpen false while the stand itself, being
server side, is still standing - the close was then skipped and the merchant
walked and hopped with it up. Caught live on EU III: stand0 open,
state.standOpen false, moving true, mid-trade. It now asks the game
(character.stand) as well as the flag. v39 closed the stand in arbApproach,
which was necessary and not sufficient; this is the other half.

Second, the abandon path now records the failure. arbMarkUsed only ever fired
on a consumed listing, so a listing that is real, freshly advertised and always
gone on arrival was re-picked the moment it reappeared in the feed. Kazhag on
EU I is the case: slice_mint at 100,000 in all four trade slots, genuinely
re-listed every couple of minutes with a lastSeen two minutes old, and five
separate trades opened against him inside 90 seconds, every one abandoned at
slot_gone. 707 abandons on the day. This is NOT the v38 cache bug - v38 is
confirmed running, and the row really was fresh through the merchant's own
arbProbeMarketRows; he simply loses the race every time, which a 10x spread on
a public feed guarantees. Failures are now keyed on shard|target with an
escalating hold (2 min doubling to 60), forgotten two hours after the hold
lapses, and cleared by any completed trade. Keyed on the seller rather than the
slot because four slots advertising one item would otherwise burn four cycles
before that stand went quiet, and escalating because a flat cooldown only turns
a permanent loop into a duty cycle.

## v39

the stand no longer stays open while the merchant walks. Stand safety was
centralised in travelTo()/travelToBank() on the stated grounds that they were
"the only functions that call smart_move/town/xmove" - true when written, false
since the arbitrage executor arrived. arbApproach smart_moves straight to a
counterparty and arbProbeStep does the same, so neither ever reached
ensureStandClosed(); scoutPontyCheck has the same hole, dormant only because
scouting is off. Caught live 2026-09-21: stand0 open, state.standOpen true,
moving true, at (12,23) on main with a trade picked against AriaHarper on US
III. attemptKiss looked like a fourth case and is not - its caller closes the
stand first. The reopen was missing too, and that half is the subtler bug:
shouldHoldStand() already refuses a stand while ARB.cur is set, but only
openStandAtBestSpot() consulted it, so the rule governed opening and nothing
else. Nothing closed the stand when a trade started, and nothing put it back
when one finished - every existing reopen hangs off a delivery batch, the gear
loop, the kiss, a hop home, or script load, none of which an arbitrage run
touches. arbLoop now reopens when idle, guarded on ARB.cur, ARB.busy,
state.busy and standOpen so it cannot fight another subsystem or re-issue
open_stand every tick. Consequences of the old behaviour: listings stayed live
while in transit, so a stand could be traded against at a position already
left; state.standOpen drifted from the truth; and the best-spot placement was
defeated, since the stand ended up wherever the arbitrage walk stopped.

## v38

the market fetch no longer reads the browser cache. arbFetchJson called fetch with no cache option and no cache-buster, so /merchants was served from cache indefinitely - and because a cached response carries a cached lastSeen, ageSec was computed against a frozen timestamp and every row read as fresh forever. sellMaxAgeSec could not catch it: by its own measure the rows it was handed were seconds old. Measured live on 2026-09-21 - the executor spent hours re-picking Kazhag|trade1|EUI, opening a FRESH trade against him every ~18 seconds and abandoning it at slot_gone, while ALData polled directly showed no Kazhag at all and the bridge held zero merchant rows. 399 abandons against 45 closed trades; slot_gone (168) and not_loaded (189) are the same fact seen twice - counterparties that had left a market this copy never stopped describing. Near-zero gold cost, because verification fires before the buy, which is how it hid inside a profitable day; the cost was almost all of the throughput. Fix is cache: 'no-store' plus a _=Date.now() param, applied to scoutFetch and plFetch as well - the bridge half of the same path, and /msg?to=X&since=N repeats its URL exactly whenever the cursor plateaus. Selection logic is untouched. Worth re-testing on live data before acting on anything concluded from the frozen copy: the 90% abandon rate, the absent arb_used markers, and whether any listing genuinely recurs often enough to be worth pre-positioning for.

## v37

arbProbeFindFlips gains a quiet mode and arbLookForWork uses it. That function is a hand-run probe the automated path had been calling on its 30-second beat, so every look opened a modal - they stacked up on screen through a live run - and narrated itself into probe_log, which is capped at 200 and was therefore evicting the operator's own probe history in under two hours. Quiet suppresses the display and the narration and nothing else; the return value is byte-identical, so selection behaviour does not move. Left alone deliberately: the slice(0, 20) on the return, which is a display limit the automated caller also inherits - worth revisiting, but changing which flips are visible to a live money path is not a popup fix.

## v36

LIVE: dryRun false, and this is now the build on the live slot. The rehearsal is over - the operator watched a run and confirmed it working, and the ledger agrees: 8 closed live trades, 60,469,850 spent, 84,930,141 gross, 3,397,206 tax, 21,063,085 net. dryRun has to be false in SOURCE, not set from the console: mHopTo calls change_server, which reloads the page, and the hop to the buy shard is the first step of nearly every trade, so a console value is gone before the buy leg runs and the trade finishes simulated after starting live. Scouting stays off from v35 and that is safe for trading - the executor finds its counterparties through pEntity/parent.entities and get_player, which the client fills regardless, and the flip finder reads arbMarketRows; the scout only ever fed reporting. Every earlier 'not deployed to the live slot' marker below is superseded by this line.

## v35

scouting OFF, deliberately and temporarily, for the live arbitrage run - it keeps the merchant off the scan beat, off the bridge and out of scoutGoHome, so the trade executor is the only thing moving the character and anything it does is attributable. Arbitrage is untouched and unaffected: the flip finder reads the bridge and ALData, both filled by other scouts, and nothing in it needs THIS character to have scanned. The two are separate switches. Also gates scoutProbe on the same flag - it was outside it, so with scouting off it kept polling /health every 60s and logging 'bridge up - scouting enabled' while scouting was disabled, which is the sort of line that sends someone hunting a bug that is not there. Set scout.enabled back to true to resume; everything else stays configured. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v34

the town scan now matches FamilyFleet, and unsent scans are dropped rather than carried. The beat is 20s, and the gate is whether the whole standRegion is inside the vision box rather than whether we are within 60 of the first stand candidate - a stronger test, because an empty scan REPLACES a shard on the bridge, so a reading taken where the stands are not visible reports an empty market as fact. Vision is a box, [700, 500], not a radius: a radius would accept a point 600 north that the box rejects, and reject one at (600, 400) that it accepts. Buffered scans are now discarded once the immediate retries are spent. Measured, not assumed - the MerchantScout sweep with the bridge down took 1338s against 241s with it up, and the per-hop cost climbed about 14s each time, because every failed post leaves another bucket and every bucket costs the 7s post gap twice a hop. The data was worthless by the time it would have landed anyway. The same-pass retries are kept: that data is seconds old and the bridge answered. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v33

all five Mainland NPC errands now happen from one measured position, (-179, -72): Lucas for scrolls, Cue for upgrade and compound, Gabriel for basics and selling, Ernis for potions, Ponty for secondhands. It is the centre of the smallest circle enclosing the four that were measured live - Gabriel 129.4, Cue 150.6, Lucas 286.0, Ponty 286.1 - and Ernis turns out to sit inside it at 169.8, so adding him does not move the optimum. The gear loop walks there ONCE and then buys the scroll, compounds and upgrades without another step; before, each material had its own travelTo and the roll then happened wherever the last one left the character, which for a plain scroll was Lucas, from whom Cue is 285.4 - at the very edge of range and the only reason it worked. Ponty is no longer walked to from the spot, and potions go to the spot rather than to Ernis, who can do only the one thing. Garwyn (616 away) and Crun (on level2) are out of reach of anywhere in the cluster and still travel. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v32

two scan-buffer bugs ported from FamilyFleet, both in live-gold paths. scoutSettleScan measured settling with scoutBufferedCount - every shard still being carried - so an unsent backlog made the two-passes-agree test pass on the second pass before the new shard had been looked at once, and the roamer posted whatever it happened to hold. It now counts THIS shard. And the buffer never cleared a shard between visits, so a stand that closed was merged forward and re-reported as live on every return; sweeps now replace rather than accumulate, which is what stops the bridge being fed ghosts it has no way to detect. scoutPostGap's wait is also clamped, since a backwards clock made it a number setTimeout cannot hold. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v31

market rows from ALData and our bridge are now merged per merchant per shard, newer row wins, rather than ALData winning wholesale whenever it answered. Freshness is a property of a row, not a source: on a shard a parked scout holds, ours is seconds old; three shards away ALData's is better. A union, so a merchant only one source knows is kept - absence from a source is not evidence of departure. Pinning a source stays winner-takes-all, since that is what it is asked for.

## v30

sellMaxAgeSec tightened from 15 minutes to 7 - about three sweeps at the measured 2.4-minute rate, where 15 allowed a buy order six sweeps stale to be travelled to. The flip finder now reports how many listings it dropped as stale and how fresh the freshest rejected one was, so a window that is too tight shows up as a number rather than as an unexplained absence of opportunities.

## v29

skip the anniversary kiss while hop sick. G's explanation for the condition says it blocks kiss rewards - an effect absent from its modifier list - so a sick merchant walks the round, closes its stand and collects nothing. Also corrects the model behind it: serverhop_logic is declared twice in node/server_functions.js and the later declaration wins, so the hop-counted tapering tiers an earlier read reported are dead code. The live rule is flat, from G: off p.home at level 60+ gives luck/gold/xp -80 and output -20 for 12 minutes. Inert at level 30, but merchants gain xp from trading.

## v28

parked scout: the merchant now holds CONFIG.homeServer and never hops for the sake of a scan. The family's MerchantScout fleet covers the rotation, and a hop reloads the page - a dedicated scout pays that for nothing else, the merchant pays it with deliveries, the stand and in-flight trades behind the load. It still scans wherever the script legitimately takes it, and now tells the bridge role:'parked' with pinned:true instead of claiming to be a roamer that never moves. Set CONFIG.scout.parked false to restore roaming. Also gains the game log filter the other three characters run - tab bar over #gamelog in rows of four, a Noise tab off by default for 'get closer', AP[...] achievement progress and the courage messages, and a MutationObserver so lines the client writes through add_log are filtered on arrival. Guarded on parent.$ so it no-ops where there is no game DOM. (Superseded: deployed to the live slot on 2026-09-21 - see v36.)
