# Ranger.js - the long comments

Rationale extracted from Ranger.js on 2026-10-18, on the model Merchant.js has
used since 2026-09-21. Ranger.js keeps the operational summary at each site plus
a pointer here; the reasoning, the measurements, and the theories that were
tried and discarded live below under the anchor the code names.

None of this is load-bearing for the script. It is load-bearing for the next
person who wonders why a number is what it is - and most of these numbers were
measured rather than chosen, which is exactly the kind of thing that gets
'tidied' away by someone who does not know that.

The split rule: if a reader editing the function would need it in front of
them, it stayed in the source. If it is archaeology - why an approach was
abandoned, what was measured on which date - it moved here.

Anchors match the `-> RangerComments.md#anchor` pointers in the source.

---

## preposition

**WHY IT EXISTS.** Operator, 2026-10-24: why did the party not preposition for
the 09:00 EDT ASIA goobrawl? Because nothing implemented the ruling recorded in
`CLAUDE.md` ("Boss priority and the event schedule"): a scheduled event that
nothing outranks and that is not on home requires a preposition on its shard.
The bridge had been publishing every shard's lineup at `/schedule_live` since
that morning and nothing read it.

**WHY IT IS A LEAD-TIME PROBLEM.** goobrawl is `join: true` with no walkable
entrance, runs 540s, and the server refuses the join while hop-sick. A hop
re-stamps 720s of sickness, so the party has to land about twelve minutes
before the event or the join opens late. Hopping later than about three minutes
before it means the join never opens inside the event at all. bossHop's
reactive path cannot do that, and goobrawl was never in `CONFIG.bossHop.targets`.

**THE INPUT IS THE BRIDGE AND NOTHING ELSE.** A character's own `S.schedule`
holds only its own shard's lineup, which cannot choose between shards. With no
fresh feed, or no fresh lineup for HOME, the planner returns nothing. "Is it on
home" is half the ruling, and a missing lineup answering it as "no" would hop
the party off a shard running the same event.

**WHAT QUALIFIES.** An event with an EXPLICIT `BOSS_RANK` entry, passing
`bossEligible` for that shard (so the exclude set, cooperative-only and
shard-keyed give-ups all apply), with status `scheduled` or `live`. The default
rank is not a rank anybody chose, so icegolem is not prepositioned for.

**WHEN.** Lead time is the full live hop sickness for a join-only event, and
`walkLeadMs` otherwise. Hop time is the event's start minus that lead, minus
`marginMs` and the hop latency. A candidate is refused if, hopping now, we
could not engage with `minUsefulMs` of window left. That refusal is the
"arrived after it ended" case: the trip is not taken at all.

**WHICH.** Rank first, then home, then the shard we are on, then the earliest,
then by name. Home at equal rank is the ruling's "not on home": stay or go
home. Going home also clears hop sickness at once, which turns a taxi join into
a teleport. A better rank off home still wins.

**THE HOLD IS THE OTHER HALF.** On arrival the event is not live, and
`goHomeIfIdle` would send an idle off-home party home 90s later. `holdRank()`
keeps the party where it is while either (a) the plan is for this shard, or
(b) a boss-event trip is live here. (b) is not a preposition at all. It is the
gap `goHomeIfIdle`'s own comment predicted: `localTarget()` sees only
`bossHop.targets`, so a graveyard or goobrawl being fought here was invisible
to it. While holding, only a STRICTLY better-ranked hop is admitted, so a crabxx
elsewhere cannot pull the party off the goobrawl it waited twelve minutes for.

**NOT DONE, AND DELIBERATELY.** `FIGHTING` still exits only on death or a hard
abort, which this file records as load-bearing. So a plan that comes due while
the party is FIGHTING a bossHop target waits for that fight to end, even when
the plan outranks it. The ruling says ranks 1 and 2 are worth abandoning
everything for, so this is the operator's call to widen.

## joinWhileHopsick

Three call sites point here and the section did not exist until 2026-10-18 -
the reference was written when the rule was a one-liner and never grew a home.
What it used to mean: the server refuses `join` while hop-sick, so a hop timed
to land at spawn lands unable to join at all, which is what v87 did for crabxx
every time.

That much is still true. The inference drawn from it was not. A REFUSED JOIN
MEANS THE TAXI IS UNAVAILABLE, NOT THAT THE BOSS IS. Read the handler
(node/server.js:12645-12676 at upstream 2148cf25): after the hopsickness
refusal at :12653 it dispatches on the event name, and three of the five
branches are a `transport_player_to` and nothing else -

    crabxx    -> main,       (-1000, 1700), skipped if already within 200
    franky    -> level2w,    (-300, 150),   skipped if already within 200
    icegolem  -> winterland, (820, 425),    skipped if already within 100

No team assignment, no instance, no flag, no state. Compare the abtesting
branch eight lines later, which assigns `player.team` and can answer
`join_too_late`; that is what a real join looks like. crabxx is not one: its
spawn is an ordinary main-map entry in design/maps.js:624, `{ type: "crabxx",
boundary: [-1256, 1520, -712, 2004], count: 0 }`, inside the `main` block, and
there is no G.maps.crabxx. The taxi drops you into a box the party already
farms.

So the cost of being sick at one of those three is the lift, not the fight.
Walk in and the only penalty is the one on the award path: `mnet /= 4` plus
`output: -20`, a 0.2 factor on points, which is 5x in required dwell.

WHICH IS AFFORDABLE, AND NOT MARGINALLY. All three taxi events carry the same
2,400s window (design/events.js, duration 60*40). Against the share model at
Dexon's 2,605 dps:

    boss     sick dwell          wait-then-clean    spare after walking
    crabxx   1.3s   (K=40)       720.3s             2,398.7s
    franky   167.3s (K=40)       753.5s             2,232.7s
    franky   398.0s (K=200)      799.6s             2,002.0s

There is no contributor count at which waiting wins. The 720s sickness is a
flat floor; the sick dwell only reaches it somewhere past K=1000. The binding
constraint is the window, and the window is six times the worst case.

THE TWO THAT STILL HAVE TO WAIT. goobrawl's map is `doors: []` - no walkable
entrance exists, so the join really is the only way in and refusing while sick
is correct. abtesting is the real join described above. This is why the gates
use `isTaxiJoin()` and not `isJoinEvent()`: the latter reads
`G.events[mtype].join` and is deliberately open-ended so a new daily behaves
correctly without an edit, which is exactly the property that would make a
blanket relaxation wrong. `bossTaxiWalkable()` derives the answer instead -
BOSS_JOIN_SPOTS supplies coordinates only for the events the server gives
coordinates for, and G decides whether the destination map has doors, so a map
that gains or loses them changes the answer with no edit here.

WHAT v94 CHANGED, in four places. bossApproach now falls through to the walk
when sick and the destination is walkable, instead of returning; the teleport
is still preferred whenever it is available, which is what the previous
comment there was protecting and was right to. localTarget no longer skips a
sick taxi join - that one was the worst, because it walked the party away from
a live boss standing in front of them. pickTarget's window test and
candidates' pre-spawn buffer charge no sickness wait for a taxi join, and for
the other two charge only what REMAINS rather than the full duration.

THE REMAINING-MS POINT IS SEPARATE AND WAS ITS OWN BUG. hopsickMs() returns
G's 720000 whatever the clock says, so every gate using it charged a character
80% of the way through the full twelve minutes. hopsickRemainingMs() reads
`character.s.hopsickness.ms` - measured live at 531,630 then 451,765 on
2026-10-17 - and falls back to the full duration when the field is absent,
which is the conservative direction.

## bossFightTypes

Why the event-to-monster mapping is one-to-many, and which of its three call
sites actually mattered.

NO MONSTER IS NAMED goobrawl. The event spawns `rgoo` and `bgoo`, so every
lookup that wants a live entity has to translate the event name - which is what
`BOSS_FIGHT_TYPE = { goobrawl: 'rgoo' }` did, naming one of the two. From live
G: rgoo 1,000,000 hp, cooperative, funtoken at rate 20 and the only `open`
source; bgoo 100,000 hp, cooperative, funtoken at 0.25. So the single value
pointed at the rarer and more valuable half, and CLAUDE.md already described
goobrawl as "only a CHANCE at rgoo" - the mapping assumed the chance had come
in.

THE THREE CALL SITES, checked individually rather than reported as a count,
because only one was a defect:
- `bossApproach` - THE DEFECT. `get_nearest_monster({type:'rgoo'})` is null on a
  goobrawl showing only bgoo. goobrawl is not walkable, so the fall-through
  re-emits the join rather than walking: the party teleports in, has nothing it
  will posture against, and re-joins every tick with a live goo beside it.
- `bossCooperative` - safe either way, since both types are cooperative live.
  Changed anyway for robustness: reading only the first answers false if G does
  not carry it, and false removes the boss from consideration entirely.
- the status line - cosmetic.

NEAREST, NOT FIRST-FOUND. On a goobrawl both types can be up, and posturing
against the far one walks past the near one. The suite asserts it in both
orders, so a pass cannot come from the order of `BOSS_FIGHT_TYPES`.

WHY IT SURVIVED. The one goobrawl in the bridge's retained log produced rgoo,
and the base rate is roughly one observation in ~75 server-windows over 3.17
days. Nothing had exercised the bgoo path.

AND NOTHING WAS CHECKING THE THREE COPIES. `suite_relay`'s divergence check
covers the relay block - `plSaveCursor`, `plActed`, `plMarkActed` - and was
believed to cover this. It did not. Three identical copies of a mapping with no
assertion over them is the exact shape the relay check exists to catch, and this
one sat outside it; it now asserts all four names identical across the three
scripts and that no single-valued form survives anywhere.

UNRESOLVED AND NOT WORTH THEORISING. `G.events.goobrawl.sprite` is "rgoo", and
sprite is an ICON. If the original single value was taken from there, it is a
display field read as a spawn-set claim - the same shape as `never_observable`
being a narrow computation under a sweeping name. Nobody knows that it was, and
the resemblance is recorded rather than asserted.

## shardKeyedCooldown

Why the give-up cooldown is keyed `(type, shard)` as of v103, and why v99 -
which looked like the whole fix and was asserted as such - was half of one.

WHAT v99 FIXED. `bossHop.tick()` asks `localTarget()` before `pickTarget()`
and anything truthy commits FIGHTING and returns, so a live-but-abandoned boss
at home pinned the party to its shard. v99 gated `localTarget()` on the
give-up cooldown, and that worked: the party stopped re-committing here and
`pickTarget()` was reached, returned US V franky, and the hop fired.

WHAT IT DID NOT FIX, AND THE SUITE COULD NOT SEE IT. Arriving is not
fighting. `bossHop` commits FIGHTING from `localBossLive()` alone and then does
nothing but wait for the boss to die - it performs no movement and never opens
a trip. What actually walks the party to a boss and attacks it is
`handleEvents()`, reached only when `shouldHandleEvents()` is true, which is
`holidaySpirit || !!bossPick() || !!bossState.trip`. After a give-up
`bossState.trip` is null, and `bossPick()` goes through `bossEligible()`, which
a TYPE-KEYED cooldown refused on every shard for 30 minutes. So the party
hopped to US V, entered FIGHTING, and farmed ordinary mobs beside the franky it
had travelled for until `maxFightMs` aborted. Both halves were needed for a
credit; v99 delivered the travel.

THE TESTING LESSON IS THE DURABLE PART. v99's assertions were that
`localTarget()` skips a cooled boss and that `pickTarget()` does not - both
true, both still true, and both about which target is CHOSEN. Nothing asserted
that the fight then happens, because the fight is authorised by a different
function in a different subsystem. The assertion boundary stopped exactly where
the defect began. When a fix spans two components, assert on the far side of the
handoff, not on the near side.

THE KEY CHANGE. `bossState.cooldown` is now keyed `'<name>|<shard>'` for a
give-up and by the bare `'<name>'` for the type-level backstop; both are
consulted, so a bare key still forbids the type everywhere. `bossCooledDown`
defaults its shard argument to ours, which is right for every HERE-style caller
(`bossEligible`, `localTarget`), while `pickTarget` passes the CANDIDATE's
shard - gating there with the default would silently ask about our own shard
and be a no-op.

THE ASYMMETRY DISSOLVED, AND THE PAIRING IS WHAT MATTERS. v99's comment said
not to tidy the gate onto `pickTarget`, and that was correct while the key was
type-wide: a type-wide entry there blocks the hop the fix exists to allow. With
a shard key both selectors gate and each asks about its own shard. So there are
two coherent configurations - v99's asymmetry with a type key, or v103's
symmetry with a shard key - and neither half of either works alone. Changing
one without the other reinstates a measured defect.

THE DURATION BECAME THE GENERATION END IN v104, and the open question v103
recorded here is answered. A constant cannot be right: against a 2400s window
and a 60-minute gap, 30 minutes expires INSIDE the window for a give-up in the
first ten minutes and past the NEXT window's open for one in the last ten. The
bridge now serves `window_ends_at` on `/bosses` rows - the END, since sending
`spawn_t` would make this script transcribe `EVENT_WINDOW_SEC`. Read it as three
states: a timestamp is an event boss whose spawn the bridge saw, NULL is an
event boss it found already up (`spawn_t` is deliberately None then), and ABSENT
is not an event boss. `hasWindow` is what separates the middle two, and
collapsing them reads an already-up crabxx as a respawn boss.
Only the EVENT end is type-wide. A respawn boss's `estimated_respawn` is the
generation end for ITS SHARD and says nothing about the others, because each
shard's timer runs independently - so it serves the shard key and the type-level
backstop keeps the constant, having nothing to align to. The other session
recommended `estimated_respawn` for both; for the backstop that would suppress
every shard on one shard's timer.

THE BACKSTOP COUNTS DISTINCT SHARDS, NOT ATTEMPTS. `BOSS_TYPE_GIVEUP_MAX = 2`,
pruned to one event window. Three give-ups on the same shard say nothing about
the other four and must not trip it; two different shards do. The DURATION is
`cooldownMs`, not the window remainder the spec asked for, because the
remainder needs the boss's spawn time and this script does not hold it -
`eventWindowMs()` gives the window's LENGTH, and `scanResults` carries
`spawnTime` only for a boss that has not spawned yet. Reusing the existing
constant makes the backstop behave exactly like the pre-v103 type-wide
cooldown, which is the conservative reading of an open question rather than an
invented number.

MIGRATION IS A NO-OP BY CONSTRUCTION. The map is persisted to CODE storage, so
a deploy meets bare type keys written by v102 and earlier. They read as type
backstops: over-restrictive for at most one cooldown, never permissive. The
safe direction, which is why there is no migration step.

## terminalInvalidation

Why `scanResults` needs the bridge at all, when it already has a staleness
timer, and why the query is terminal events rather than despawns.

THE FEED DOES NOT REPORT DEATH, IT STOPS REPORTING. `startScanning()` reads
the game's `server_info` broadcast per shard and opens its per-boss loop with
`if (!d) continue`. A respawning boss keeps its key and reports the dead shape
- no hp, a `spawn` field - which `record()` stores happily as
`live: false, spawnTime`. A timed EVENT boss has no respawn to report, so when
it dies or its window closes the key is simply gone. `continue` then has
nothing to write, and the last `live: true` entry survives with its `at`
frozen at the moment the key disappeared.

SO THE EXISTING GUARD IS A BACKSTOP, NOT A FIX. `SCAN_STALE_MS` is five
minutes, and it catches the frozen entry eventually. The problem is what
happens in between: `candidates()` costs a live entry as `hp / shardDps`, and
a frozen hp is an hp that never falls, so the dead boss offers the shortest
`secsToDeath` of anything on the board. It is not merely a stale candidate, it
is the preferred one. The bridge writes the transition to its log within one
45s poll and the script re-reads every 30s, so the exposure goes from 300s to
roughly 75s.

CAUSE VERSUS OUTCOME, which is the mistake worth remembering. The first design
asked for `ev=despawn`. That came from having just built the despawn
classifier, and it is the wrong question by construction: the classifier
exists to grade HOW a boss stopped existing, and a picker needs to know only
THAT it stopped. Measured by the browser session over the 2,499 retained
events on 2026-10-20 - death 1,116, despawn 15, lost 120, spawn 1,248 - the
despawn filter would have caught 15 of the 1,251 terminal events, 1.2%, and
missed every single kill. The tell was available before the measurement: the
classifier's own section in CLAUDE.md says a despawn and a kill are
indistinguishable at the transition, which is the whole reason it was needed.
A distinction that was hard to draw is not a distinction to filter on when you
do not need it drawn.

WHY `lost` IS IN THE TERMINAL SET WITHOUT RESOLVING WHAT IT MEANS. The bridge
emits it from two unrelated places. One is an instance id that changed between
polls, where the previous instance is gone for certain and a spawn for its
replacement is emitted on the same poll. The other is a shard absent from
`BOSS_ABSENT_CONFIRM` successive successful polls, where the honest reading is
that nothing is known about that boss. Those are different facts, and neither
of them is a boss worth committing a 30-minute Realm Fatigue trip towards, so
both clear the entry and the reason string never has to be parsed.

What actually settles it is the asymmetry of the two errors. Clearing a boss
that is really alive costs one scan cycle, because `record()` is an upsert and
the broadcast pushes on a short period - and, crucially, clearing sticks only
where it should: the entries that are wrong are exactly the ones whose key has
vanished, so nothing overwrites them, while a genuinely live boss is restored
within seconds by a feed that never stopped. Missing a terminal event costs
the full five minutes with a dead boss ranked first. The two mechanisms are
complementary rather than competing: broadcast present means the broadcast is
authoritative, broadcast gone means the bridge is.

THE ORDERING GUARD DOES DOUBLE DUTY, AND IT HAS TO BE ANCHORED ON THE
OBSERVATION. `applyTerminal()` returns early when the entry's `at` is newer
than `death_hi` - NOT than `t`. v100 used `t`, and that was a real defect for
one version: on a death row `t` is a reconstruction, two of its three forms
being the poll-bracket midpoint `(last_alive_t + poll_t)/2`, while `death_hi`
is `iso(poll_t)`, the poll that proved the boss gone. Because an event boss's
key vanishes AT the death, `at` lands at the true death, which is after the
midpoint whenever the death fell in the later half of the bracket - so the
guard threw away the terminal and left precisely the frozen-hp entry this
function exists to clear, with nothing arriving later to correct it. Measured by
METHOD rather than by bracket width, because width is not a proxy for
imprecision - a wide bracket on a `respawn_offset` row means the poller
noticed late while the reconstruction stayed exact, and mixing the two gave an
earlier "105 of 394 boss rows" that meant nothing. `respawn_offset` 1,151
rows, `absent_on_responding_server` 238, `poll_bracket` 0; all 238 carry the
midpoint, none has gap 0, 174 (73%) over 30s, 44 over 120s, max 348s, so
roughly 119 discarded in 2.5 days - crabxx 21, icegolem 13, franky 12 among
bossHop's own targets. The set is ALSO exactly the one this function depends
on, because `BOSS_RESPAWN_SEC` and `EVENT_WINDOW_SEC` are disjoint and a boss
with a known respawn reports the dead shape instead of vanishing, so
`record()` has already written `live: false` and the guard is never reached.
The exposure was therefore 100% of the rows this function acts on.
The question the guard asks is which INSTANCE a push belongs to, and only the
observation can answer that: a push after `death_hi` postdates the absence, a
push between `t` and `death_hi` belongs to the instance that died. `despawn`
and `lost` rows have no `death_hi` and their `t` IS the detection time, so the
fallback is the correct reading for them, not a concession. It is parsed in two
steps rather than as `e.death_hi || e.t`, because that form yields NaN on a
malformed `death_hi` and then bails, dropping a real terminal in silence. The direct reason is that `server_info`
is the primary feed and the bridge a derivative running up to 45s behind it,
so a push newer than the event is describing a later instance and must win.
The second effect is that the cold start needs no special case: the first
fetch carries no cursor and replays the entire retained log, and not one
historical row can clear a live entry, because every one of them predates the
push that created it. A seeding branch was considered and then deleted as
redundant, which is the better outcome - a guard that removes a branch is
worth more than a branch that duplicates a guard.

THE SERVER-SIDE FILTER IS NOT A GUARANTEE. `terminal=1` reduces bandwidth and
nothing else; the `ev` test inside `applyTerminal()` is what decides. The
bridge's handler reads the query parameters it knows about and silently
ignores any it does not, so a bridge deployed before `terminal` existed
answers a `terminal=1` query with the spawns still in it - and a script that
trusted the filter would clear its entries every time a boss APPEARED, which
is precisely inverted. The script cannot observe which bridge it is talking
to, and the two are deployed independently. `Tests/bridge/test_despawn.py`
asserts the unknown-parameter behaviour directly, so this paragraph is a
checked claim rather than a remembered one.

## taxiWalkProbe

The claim the whole of the above rests on - that a hop-sick character can walk
to a taxi join and still be credited - is derived from the server source and
has never been watched happening. The probe exists to close that, and it is
deliberately narrow: it records only what it can actually observe.

One row per walk-in-sick episode, keyed on event plus shard so a mid-fight
reload updates the row it already opened rather than starting a second.
Written to CODE storage, because a hop reloads the page and anything in memory
dies with it - the same property the relay-cursor work in v91 depends on.
Capped at 30 rows.

A row opens in bossApproach the moment a sick walk is chosen, carrying the
remaining sickness at that point. It closes in the FIGHTING branch of
bossHop.tick, which is the one place the script knows a boss died WHILE WE
WERE STILL THERE - presence at death being the thing credit actually requires
(the award loop resolves contributors through players[name_to_id[name]] and
silently skips anyone who has left). The closing row records dwell in seconds
and the sickness remaining at the kill.

THE ROW THAT PROVES THE POINT is one with presentAtDeath true AND
sickThroughout true: a kill we attended from a walk, with the sickness never
having cleared. ShowTaxiProbe() counts those separately for that reason.

WHAT IT DOES NOT PROVE. Credit is awarded server-side and is not visible from
the client, so the probe shows participation, not payment. To close the last
step, compare a row against the tracker's kill count for that monster before
and after - socket.emit('tracker'), per CLAUDE.md. An ordinary teleported
fight records nothing at all, so the log stays quiet unless the new path is
actually being exercised.

## singletargetmobs-is-a-curated-list-maintained-by

singleTargetMobs is a curated list, maintained by hand: add a monster when
splitting fire across a crowd of them is the wrong trade, remove it once
gear, levels or achievements make it no longer necessary. Two measured
criteria picked the seed, both against Dexon's 880 attack / 223 armor:
danger per mob (attack after mitigation x frequency) and VOLLEYS TO KILL
under a 5shot at its 0.5 multiplier. crab is 7 danger and 1.1 volleys -
one cast removes it, so AoE is pure gain. cgoo is 299 and 5.5. bigbird,
which shares main with crab, is 299 and 73: switch main to AoE and a
bigbird drifting into the volley absorbs split damage for a minute while
hitting back, which is why the test below reads the mobs actually IN
RANGE and not merely `home`.
Bosses are deliberately absent: AoE needs 4+ targets in range
(minTargetsFor5Shot) so a lone boss never triggers it, and
ignoreAddsDuringCrabxx covers the one boss that arrives with a swarm.
preferSingleTarget stays as a global override, now off - it was a
hardcoded true in v60, justified by a respawn-ceiling argument the
evidence has since strained. The list does not depend on that model. 

## cooperative-bosses-are-engaged-only-once-somebody

The six names after 'phoenix' were MISSING, and that is what stalled
Dexon at a live snowman on 2026-10-02. Measured in his CODE context
while the boss was alive: shouldAttackMob(snowman) === false and
cache.targets.inRange was EMPTY with the snowman 155-165 units away
against his 165 range, so handleAttack returned on its first line. It
was not `home` (spider), not in alwaysAttack (crabx, wabbit), not in
this list - so it fell through to the targetPriority fallback, which
asks whether the mob is hitting FatherToken. The snowman spent the whole
fight on Jasnah, ShallanDavar and Ratage - other people's characters -
so every branch said no. He fired 8 times in 223 seconds, all of them
incidental arcticbees, against the ~70 the attack cadence allows.
Derived from G.monsters[x].cooperative on 2026-10-02: 19 cooperative
monsters exist, allBosses covered 13, and these are the other six.
allBosses is left alone deliberately - it also feeds COMBAT_SETS.bosses,
and widening that is a separate decision from this one. 

## cross-shard-boss-hop-bosshop-below-generalised

CREDIT REQUIRES BEING PRESENT WHEN THE BOSS DIES. The award loop
resolves contributors through players[name_to_id[name]] and skips
anyone not live in THAT shard's process, so a departed player's
monster.points is discarded and does not even reach `total`. There is
therefore no such thing as banking damage and moving on, and maxFightMs
is a HARD ABORT, never a credit timer.
HOP SICKNESS COSTS 5x IN DWELL, not 4x: points /= 4 AND output: -20,
which is a 0.2 factor, and share scales as (factor * T)^0.65. A chaining
party is permanently sick - every hop re-stamps the full 12 minutes - so
the sick column is the only one worth quoting here. The two measured
anchors for mrgreen at 36,000,000 hp: 50.1s against 40 other
contributors, 147.0s against 300.
REQUIRED DWELL IS NOT A CONSTANT - it scales as maxHp^0.65, and v84
shipped it as one. What has to be out-weighed is the total damage every
OTHER contributor banks across the whole fight, and that is the boss's
entire hp pool, not the part left when Dexon arrives. A single 76.5s
floor calibrated on mrgreen was therefore wrong in both directions at
once: 39x too strict for crabxx and 31,587x for snowman - the two
CHEAPEST rungs on the board at 70 and 60 kills, both permanently
unreachable because their whole-health secsToDeath, 48.0s and 0.06s,
never clears it - and 2x too loose for franky, which needs 167s at 40
contributors and so was admitted to fights it could not score in, at a
cost of 12 minutes of hop sickness a time. See requiredDwellSec().
PUSH ONE CHARACTER, NOT THREE. Achievement score is a MAX across the
account, never a sum: the effective value is max(own p.stats total,
max_stats[monster][0]), so a second character earning credit adds
nothing unless it would overtake the holder. Dexon is the holder for
most of this list but NOT all of it - snowman was measured at 22.1 held
by FatherToken against Dexon's own 18.05 - so do not read "Dexon hops,
the others follow" as "the others are decoration". The followers earn
the party multiplier either way: 1 + 0.3/divider per own non-merchant
party member, divider 2 for a cooperative monster, which is 1.30 a kill
for the full party against 1.00 alone. That multiplier needs them
PRESENT at the death, same as Dexon - see the credit rule above. 

## await-hang-guard

Measured 2026-09-22 on Dexon: actionLoop ran 0 iterations in 20s where ~1300
were due, and mainLoop was dead in the same window - is_disabled(), which it
calls every 250ms, was not called once. He stood in range of crabs casting
nothing until the page was reloaded, and the party earned 0 xp. use_skill()
and smart_move() both return promises the game can leave unsettled, so this
is a live failure mode, not a theoretical one.
noHang() bounds an awaited call. On timeout it REJECTS, which lands in the
loop's own catch and lets that loop reschedule normally: the tick is lost,
the chain is not. Same intent as travelWatchdog, applied to the loops.
Wrapping only the awaits that appear DIRECTLY in a loop body is enough - a
hang deeper in a helper propagates up to that await and is bounded there.

## boss-events-go-contribute-from-maximum-range

MEASURED 2026-09-30 (Dexon 75 / FatherToken 69 / MageofOz 70, party
single-target DPS ~2,400, our ranges 158/197/201). hp, our time to kill,
THEIR attack range:
  crabxx    960k  462s   45   | icegolem   16M  5.2h   64
  dragold    25M  4.1h  320   | mrpumpkin  36M  4.1h  520
  mrgreen    36M  6.6h  620   | franky    120M 13.8h  948
A boss whose range is under ours can be shot for free; one above it hits us
wherever we stand, and we will never finish it. bossHoldDistance computes
both postures, and maxTripMs/maxDeaths bound the second kind.
JOINING, from adventureland_mongodb node/server.js socket.on('join'):
exactly these four teleport, to these fixed spots, and everything else is
walked to. That handler also refuses with no_merchants, cant_when_sick
(hopsickness), cant_in_bank and cant_join - so the emit is NOT a general "go
to the event" call. It ignores the emit within 200 units of the destination,
which is why repeating it is free.

## goobrawl-is-the-one-joinable-event-whose

goobrawl is the ONE joinable event whose parent.S key is an EVENT name and not
a monster name. Measured 2026-10-09 in the live client: G.monsters.crabxx,
.franky and .icegolem all exist and all carry cooperative: true, while
G.monsters.goobrawl does not exist at all. So bossCooperative('goobrawl') read
undefined, answered false, and bossEligible rejected it as "not cooperative"
every time it went live - the gate was right about the data and wrong about the
event. A second site failed on the same gap and showed nothing: bossApproach
asked get_nearest_monster({ type: 'goobrawl' }) and got null on every tick, so
even a forced bossJoin('goobrawl') would have teleported in and then stood on
the arrival point without ever taking a firing posture - inside rgoo's reach,
which is the one thing bossPosture exists to prevent.
Mapping the event name to the monster fixes both, and relaxes no policy:
goobrawl now passes the cooperative test for the same reason the other three
do, rather than being admitted by hand through cfg.include.
The brawl's monsters are rgoo (hp 1,000,000, attack 320, frequency 1.2, range
64, armor 300, resistance 300, xp 48,000,000, physical, cooperative, aggro 0.1,
rage 0) and bgoo (hp 100,000, attack 5, range 15, xp 100,000, cooperative,
aggro 0). Both are ALREADY in allBosses, so the attack side needs no change.
Range 64 against our ~163 is the free-shot band - crabxx 45, icegolem 64 - not
franky's hopeless 948. 

## rage-boxes-the-geometry-the-farm-scorer

G.maps[map].monsters[i] can carry a `rage` rectangle beside its `boundary`.
Measured 2026-10-09 in the live client, on spookytown:
  mummy  boundary [31,-1571,480,-1293]  rage [-124,-1631,614,-1130]  (a halo
         130-165 units larger than the spawn)
  booboo boundary [286,-842,544,-562]   rage IDENTICAL to the boundary
  booboo boundary [-820,-940,-570,-630] rage IDENTICAL to the boundary
  stoneworm, mrgreen, jr - no rage field at all.
Stepping inside one aggros the whole pack AND applies the monster's own
`rage` multiplier, 1.5 for both: booboo's listed attack of 220 lands for
~352, and nine at once is ~3,800 dps into a 7,263 hp ranger.
This is not theory. scoreAllFarmSpots() returns the spawn-boundary CENTRE, so
an override on booboo resolved to (415,-702) - dead centre of the rage box.
Measured the same day: three deaths, zero kills, the spawn never reached, and
travelState left inFlight with failures: 0 because death kept interrupting
the route. The monster was never the problem; the standing point was.
Nothing here restricts movement OUTSIDE a rectangle. Closing, backing off and
regrouping are all untouched - the rectangle is the only thing that is solid.

## measured-2026-10-09-and-the-single

MEASURED 2026-10-09, and the single reason the party never arrived.
rageRoute excludes cells within margin + step of a rectangle, so 30
with a step of 25 was really demanding 55 units of clearance. The
corridor's entrance is a PINCH: an A* at step 5 from the spawn reaches
(290,-990) at margin 14 and fails at 18, so the gap is 14-18 wide and
55 never had a chance. 4 + 5 = 9 does, with 5 units of headroom.
8 + 5 = 13 was tried first and FAILED against the live map: the grid is
anchored at the search window's corner, not at the origin, so with only
13..18 of usable band no lattice point landed inside it. Verified live
at the shipped anchoring: gm 13 does not reach the park point, gm 9
does, in 29,443 expansions. Keep margin + step at or below 9 for this
corridor. The operator proved the route by hand first, walking MageofOz
through the pinch with about 5 units to spare. 

## four-connected-on-nodes-only

FOUR-connected, on NODES only.
An earlier version also verified every EDGE with can_move, to stop the
simplifier emitting a leg nothing had checked. That was the right worry
and the wrong tool: can_move's SEGMENT test is far stricter than its POINT
test, so checking every 25-unit edge fragments the graph. Measured live on
spookytown, from the (0,0) spawn to the corridor park point:
  4-connected + edge checks   1,030 cells reachable   park point NOT reached
  8-connected + edge checks     999                   NOT reached
  4-connected, nodes only     5,301                   reached
  8-connected, nodes only     5,504                   reached
Connectivity and margin made no difference; the edge check alone did it.
rageRoute returned null, safeSmartMove threw, and the party sat at the
spawn through 41 consecutive travel failures. Walkability is now settled
per LEG in rageWalk, which is where the legs are actually walked: a leg
can_move clears goes to xmove, and one it does not goes to smart_move,
whose pathfinder handles terrain. Dropping diagonals stays, because it
removes corner-cutting by construction and the simplifier straightens the
path afterwards. 

## walks-a-safe-route-re-planning-when

The first version returned false on ANY leg rejection, and safeSmartMove
escalated that to a throw which travelTo counted as a travel failure - two of
those and travel abandoned the trip. Measured live: rageRoute succeeded on all
13 attempts (6 to 9 legs each) while ZERO legs completed, every failure being
leg 1 from a standing start. A single blocked leg had been masquerading as "no
safe route exists", and the party was stranded beside the booboo box as a
result. Only a null from rageRoute now means no route; a refused leg means
re-plan from wherever we actually are, which is cheap.
Note it walks from index 0, not 1. raw[0] is the grid cell nearest the start,
not the character's real position, so skipping it left the step from the real
position to the second waypoint unverified. 

## giga-crab-contribution-log

PARTLY OVERTAKEN 2026-10-17. The hunter was generalised anyway and crabxx is
in CONFIG.bossHop.targets, so the "is it worth it" question is now answered
per-hop at runtime by hp / shardDps rather than once, in advance, from this
log. The log is still the thing to read for whether the 491 figure holds and
what share of the kill he actually lands - the hop rule assumes neither.

## cross-shard-boss-hop

TWO TESTS, NOT ONE FLOOR, and that is the v84 fix. Adding the dwell
requirement to the trip cost and comparing the sum against secsToDeath
rejects snowman outright - it needs ~0s of dwell but dies far inside the
hop latency, so it is only ever reachable pre-spawn, and the pre-spawn
path must not be charged an arrival it does not pay.
Smallest-first looks backwards until you write out what the alternative
buys. Test (2) has already guaranteed the boss lives long enough to earn
credit, so every candidate past that gate pays the same; what separates
them is how long Dexon is then stuck there. Taking the one nearest death
banks the kill soonest and frees him for the next, which is the only way a
chain beats sitting still. Going biggest-first would park him on a
full-health mrgreen for twenty minutes while four others died elsewhere.
NO HOME ROUTING BETWEEN HOPS. v83 sent him back to USIV after every kill.
Going home is not useless in itself - it clears Hop Sickness instantly,
measured 2026-10-17 with ~11 minutes still on the clock - but the clear is
spent the moment he leaves again, because the next hop out re-stamps the
full 12 minutes. So between two kills the round trip buys nothing and costs
two hops' latency, and it re-arms Realm Fatigue on the whole party, which
does NOT clear on the way home. Going home is worth doing when the CHAIN
ENDS, which is the operator flipping enabled off, not something this state
machine should decide. FIGHTING therefore falls straight back to IDLE, and
IDLE either picks the next target or hands control to ordinary farming on
whatever shard he is standing in.
FIGHTING EXITS ON DEATH OR A HARD ABORT, NOTHING ELSE. Kill credit requires
being live in that shard's process when the boss dies: the award loop
resolves contributors through players[name_to_id[name]] and silently skips
anyone who has left, so accumulated damage does not travel. maxFightMs is
therefore an abort for a fight that has gone wrong, never a "banked enough,
move on" timer, and there is no such thing as leaving early with a share.

## travel-helper-a-smart-move-that-reports

WHY A COUNTER AND NOT A CLOCK. The unreachable verdict used to fire on
wall-clock since the spot was assigned, measured in a loop that has nothing
to do with travel - so a shard hop, a live event, a potion run or a trip to
the vendor blacklisted the spot merely for taking three minutes, while
travel was often never attempted at all. That is what walked the auto-
blacklist down the whole candidate list at 180-second intervals. Counting
failed ATTEMPTS judges a spot only on something it is responsible for.
WHY THE IN-FLIGHT GUARD. The tick loops are synchronous and this is not;
without it each tick would stack another attempt on the last. Same shape as
the sell-off stand-down.
WHY THE WATCHDOG. An in-flight guard is itself a new way to hang: if
smart_move never settles, inFlight stays true, no attempt ever completes,
and nothing is ever judged. The watchdog orphans an attempt that outlives
attemptTimeoutMs - bumping attemptId makes the orphan's late resolution a
no-op - and counts it as the failure it is.

## kite-target-selection-identical-shape-in-ranger

(1) The hand-tuned list (targets / avoidTypes). Authoritative, never derived.
    bscorpion is the reason this path has to exist: its attack range is 32,
    but weakness_aura carries radius 100 on a 4s cooldown, so the danger
    radius is the AURA, not the range, and the measured 155/170 hold was
    tuned against the aura. Deriving that hold from monster.range alone gives
    32 + buffer = 52 and parks the character INSIDE the aura - a silent
    regression wearing the costume of a generalisation. Measured 2026-09-26.
(2) The speed predicate. Kiting only works when we open distance faster than
    the monster closes it, so the speed ratio is the entire precondition. It
    is evaluated against the live G.monsters def, not a recorded list,
    because which monsters are present is not guessable and varies by map.
Path (2) also REFUSES a type when we cannot hold outside its threat radius
and still reach it (range - attackMargin). Safety bought by never attacking
is an exp/hr loss, not a gain, which is the standing rule for this party.
Path (1) is exempt from that test precisely BECAUSE bscorpion fails it:
holding at 170 with a 160 range means not attacking, and that is the
intended trade there.

## threat-field-added-v59-v32-v55-after

Measured 2026-09-26 at cgoo/level2s with the v58 kiter live: the derived hold
band was honoured in the steady state (median nearest 134 against a designed
84-155) and incoming hits fell 27-50%, but the party still wiped. Dexon's last
six seconds were 92 -> 72 -> 47 -> 27 -> 10 units while attackers climbed
3 -> 9, and he then sat at 10 - inside a retreat threshold of 84 - until he
died. MageofOz bled 1,995 -> 0 with ONE attacker while holding 59-95 against a
176 hold.
So the band arithmetic was right and the DIRECTION was wrong. rangedKite
maximised distance from the single nearest monster, which in an 11-cgoo pack
means retreating into the other ten. Priest.js already scored against every
threat, and its engine moved 164 times in the window where Dexon's moved 56.
These helpers give Ranger and Mage the same whole-field view, and give all
three a disengage mode that abandons the band when the attacker count reaches
courage - because fear is driven by how many monsters TARGET you, not how many
can reach you. Measured the same window: FatherToken sat at 122-181 units,
safely outside cgoo's 64 reach, and was still over courage for 53 of 297
samples. Distance alone cannot fix that.

## cohesion-focus-fire-and-the-route-penalty

1. heal carries use_range: true, so it reaches character.range - 197 for
   FatherToken. Measured mid-fight: Dexon at (181,637), FatherToken at
   (-6,280). That is 403 units, 2.05x outside heal range. The priest was not
   failing to heal because he was feared; for much of the window he could not
   heal at all. No movement algorithm fixes a healer standing 400 units away.
2. The party was not focus firing - two distinct targets across three
   characters, and no mechanism for it in any of the three files.
   targetPriority looks like one but means "prefer monsters already targeting
   the priest", a protect heuristic. Party.js had real focus fire, via
   followers copying leader.target; these files lost it.
Aggro scales with how many DISTINCT monsters have been provoked, and a 2,400
hp cgoo dies about three times faster under concentrated fire, so it stops
swinging sooner. Both effects push the attacker count down, which is the
quantity that drives fear - and fear is what stops the healer.

## emergency-restock-the-trip-has-to-be

town() is NOT travel. Measured 2026-10-09 in Dexon's own CODE context: its
body is parent.socket.emit('town', ...) and nothing else, and the server
answers it by applying the use_town skill, which lands you on the CURRENT
map's town point. There is no map argument to give it and no way to aim it.
That was the whole bug, and it was observed live on desertland: Dexon ran
dry, this function fired town(), the skill dropped him at desertland's town
point, buy() had nothing to buy from, the counts stayed at zero, the finally
cleared state.restocking, and the next main tick re-entered and fired the
skill again. use_town over and over while the party stood empty, with Alia
- the transporter, which is what smart_move routes every other cross-map
move through - standing unused at -14,-477 on the same map.
Every potion vendor in the game, read out of live G on 2026-10-09. These
five are all of them:
    main           fancypots ("Ernis")   -35,-162
    halloween      fancypots             201,-180
    winter_inn     wbartender           -143,-220
    old_main       pots                    10,10
    original_main  pots                   112,40
desertland's entire NPC list is transporter / locksmith / scrollsmith /
citizen17, so no amount of teleporting around desertland could ever have
worked. halloween is the one that matters during the event: a character
farming the event map has a vendor standing on it and never needs to cross.
So: walk to a vendor on this map if there is one, otherwise to main's, and
let smart_move do the routing. The way back is not handled here - clearing
state.restocking hands movement back to mainLoop, and handleReturnHome()
walks to `destination` as it does after any other errand.
find_npc() is deliberately NOT how the vendor is located. Measured the same
day from desertland, find_npc('transporter') answers
{ map: 'test', x: -50, y: -50 }: it returns the first match in G, not the one
on your own map, so smart_move would have been sent to the test map. The
vendor is resolved out of G.maps below instead, which cannot do that. 

## needsmluck-carries-the-intent-and-it-is

This one message serves two purposes - "come and buff me" and "come and
empty my pack" - and Merchant.js used to read ANY location message from
an mluck target as a buff request. So a pickup ask enqueued a phantom
mluck job, and on the merchant an mluck job is a full batch: a shard
hop, a trip, and a summon that drags us off the farm spot for a buff
with most of its hour still left. With pickupCooldownMs at 15000 and
lowInventorySlots at 3, a low pack asked for that four times a minute.
Sent as a field rather than a second message type because the merchant
still needs these coordinates for the pickup - the trip is real, only
the buff task attached to it was invented. -> Merchant.js visitOneStop 

## damage-mitigation-taken-from-the-game-rather

The old model here was 1 - x/(x+900). Measured 2026-09-25 against the
client's own parent.damage_multiplier: the two agree closely at low defense
(armor 116 -> x0.884 vs x0.886) and diverge badly above 400 (armor 900 ->
game x0.313, model x0.500, a 60% overestimate of our damage). 13 of the 86
monsters scoreAllFarmSpots() ranks carry defense above 400, so the model
systematically over-ranked exactly the mobs we kill slowest.
damage_multiplier is typeof-guarded, never assumed: which helpers exist
varies by context, and it returns null when handed undefined. A non-finite
result falls through to the old curve. Negative defense is passed straight
through because the game amplifies damage there (x1.05 at -50) and clamping
would silently discard that.
The fallback logs once. A default that stays quiet makes "the helper is
missing" and "the estimate is right" indistinguishable. 

## evasion-and-avoidance-are-straight-misses-so

EVASION AND AVOIDANCE ARE STRAIGHT MISSES, so they scale effective dps the
way armour scales damage: a mob that dodges one swing in five is worth a
fifth less xp per second than its hp alone suggests. Neither was read until
v72. Measured 2026-10-06 against live G - 14 monsters carry evasion, 4 carry
avoidance, and three sat inside this party's top 14. Correcting it moved
iceroamer 3671 -> 3303 (rank 3 -> 8), ghost 3248 -> 2598 (11 -> 16) and
bigbird 2950 -> 2360 (14 -> 29). The candidate count was 84 before and 84
after: this reorders, it never admits or rejects a spot.
The avoidance four are why it is not cosmetic - cutebee 99.9, tiger 99,
pinkgoo 98 and wabbit 98.8 are effectively unkillable and nothing else in
the scorer flags them. Likewise goblin 99.95, frog 99, jr 80, greenjr 40 and
the four elementals at 80.
mhEvaluate takes the same multiplier, but READ THE BOUND BEFORE EXPECTING AN
EFFECT: killRate is min(dps/hp, count/respawn), so a dodge only moves the
estimate where the spot is DPS-bound. Measured per 100 kills - ghost 493s ->
616s, bigbird 1017s -> 1271s, iceroamer 114s -> 127s, while jr, greenjr and
frog are SUPPLY-bound and do not move at all despite evasion 80, 40 and 99.
That is correct rather than a gap: when respawn is the constraint, how often
we miss does not change how fast they come back.
phresistance IS DELIBERATELY ABSENT. It reads like mitigation and is not:
js/progression/stats.js lists it beside pnresistance, firesistance,
fzresistance and stresistance - poison, fire, freeze, stun - and no client
combat function applies it. The game's own damage_multiplier(defense) takes
a single argument and serves armor and resistance only, and the monster
sheet never shows it (interface.monster.* is att, avoidance, evasion,
reflect). It is a status resistance resolved server-side, so folding it into
a damage model would make this worse rather than better. 

## this-is-the-raw-hit-with-none

THIS IS THE RAW HIT, with none of OUR mitigation taken off it, and
that is a standing decision rather than an oversight. Measured
2026-10-06 on Dexon: armor 377 and resistance 399 give
damage_multiplier 0.636 and 0.616, so the figure below overstates
what actually lands by roughly 57-62% - bigbird 384 against a real
244, stoneworm 216 against 137, ghost 200 against 123, gscorpion
96 against 61.
THE ERROR IS ONE-DIRECTIONAL, which is why it was left alone: it
can only ever make a spot look MORE dangerous, so it may refuse a
viable spot through the uptime gate below, but it can never wave a
lethal one through. Kept pessimistic on the operator's call,
2026-10-06.
To correct it later: multiply by defenseMultiplier(character.armor)
or defenseMultiplier(character.resistance), chosen on
mobData.damage_type, and expect spots the uptime gate currently
rejects to start appearing - which is why it belongs in its own
change with its own before/after rather than bundled into one that
only reorders. 

## fear-instrumentation-observation-only-nothing-branches-on

Courage is the number of monsters that can target you before fear starts
(G.classes.ranger sets courage/mcourage/pcourage to 2, and this character
carries no gear bonus, so a third attacker trips it). A feared character
stops killing, which reaches checkFarmEconomics as gold/sec <= 0 and looks
exactly like a poor spot - so a swarmy but rich spot can be abandoned for a
reason that belongs to the character rather than the location.
That is a theory. This records what actually happens so the question can be
settled with numbers instead, because the last function to be changed on an
unmeasured theory about farming was this one, and it ate ~55 spots.
Persisted, because the interesting window is hours long and a redeploy or a
shard hop would otherwise reset it. Read it with farmFearReport(). 

## why-this-exists-a-farm-spot-lives

WHY THIS EXISTS. A farm spot lives in `manualOverride`, which is a runtime
`let`, and it is lost two ways that both look like nothing happened. A reload
wipes it. So does checkFarmEconomics when it blacklists the spot the override
points at - measured 2026-10-01, FatherToken's death xp was divided into a
rate, read as "net-negative xp/hr (-46997.81 xp/s over 3 min)", and the party
left rat@mansion for booboo@spookytown with 2,583 score still to go. Nothing
logged an error either time; the party simply farmed the wrong monster.
So the queue is PERSISTED in CODE storage and re-asserted on a timer, and it
re-adds the spot to PERMANENT_WHITELIST on every pass - that Set is rebuilt
from source on load, so a runtime addition does not survive a reload either.
PROGRESS IS READ, NEVER COUNTED. parent.tracker is a cache the client fills on
request: measured 2026-09-30 it sat frozen at 11,038 rat kills while 203 more
landed, and a rat score that was really 91,168 read as 17,383. achvRefresh()
asks the server for a fresh one and suppresses parent.render_tracker for the
round trip, because the game's own handler ends in show_modal and would open a
panel on the operator every few minutes otherwise.
Requires a tracker ITEM in the bag - the server's socket.on("tracker") handler
returns early without one. Dexon carries one in slot 0. 

## the-document-the-panel-lives-in-and

THE DOCUMENT THE PANEL LIVES IN, AND NOT THE ONE THIS SCRIPT RUNS IN.
Every handler below is delegated, and delegation binds to whatever object
it is handed. `$('body')` and `$('#farm-spot-ui')` are SELECTORS, resolved
in parent jQuery's own context, so they correctly find the page's DOM.
`$(document)` is not a selector - it passes an explicit object, and
`document` inside a CODE script is the maincode iframe's document. The
panel therefore rendered into the page while every handler sat waiting on
a document the clicks never reach, which is why none of these buttons had
ever worked. Measured 2026-10-09 in Dexon's live v73: document ===
parent.document is false, parent.document holds #farm-spot-ui and the CODE
document does not, and one real click dispatched on a .farm-spot-row fired
0 times for the binding on the CODE document and once for the identical
binding here. 

## rebuild-rather-than-bail-when-a-panel

The guard here used to be `if ($('#farm-spot-ui').length) return`, which
is wrong across a code redeploy: the CODE iframe restarts but the PARENT
document does not, so the previous build's panel is still attached to its
body. The new script would find it, return, and never run its own layout -
so a change to where the panel goes could never take effect without a full
page reload, and it looked like the new code had done nothing.
Removing first prevents duplicates just as well and relocates too. The
handlers below are all delegated through $(doc).off().on(), so the ones
carrying a selector rebind cleanly rather than stacking. The two direct
bindings (mousemove, mouseup) take no selector, so their .off() must not
pass one either - see below. 

## dock-into-the-game-s-own-top

If the toolbar isn't there (a UI mode that doesn't render it), fall back
to the old free-floating panel rather than silently having no UI. 

## anchor-on-codebuttons-unscoped-exactly-as-the

MEASURED against the live client, not inferred - two earlier attempts
were wrong because they were read off kaansoral/adventureland, whose
snapshot is months behind what is actually served. The real chain is:
    SPAN.codebuttons
      -> DIV.game-controls                  <- absent from the snapshot
        -> DIV#toprightcorner.hidden.disableclicks.bpclicks
So .codebuttons is a GRANDCHILD of #toprightcorner, and a SPAN rather
than a DIV. Any `#toprightcorner > .codebuttons` form matches nothing
here; it is not merely redundant, it is wrong, and it is deliberately
not kept as a preferred branch because the next reader would take it
for documentation of the live markup.
.codebuttons measures 0x0 in an inspector. That is `display: contents`
behaving exactly as specified - the span generates no box of its own and
its children lay out in DIV.game-controls' flow - and NOT an empty span.
Measured live: 7 children, 40 characters of text, occupying x 901->1332
while the span itself reports zero. The reading looks alarming and means
nothing. Do not re-anchor on the strength of it.
It is also why .before() lands the panel correctly by the box model
rather than by luck: the panel goes immediately before the span in DOM
order, and the span's first child - R&M at left=901 - is the first thing
rendered after it. Anchoring on that first button instead would be
strictly worse, coupling us to whichever button add_top_button happens
to add first, which it can change at any time. Anchor on the container
the game itself appends to.
The `hidden` on #toprightcorner is not a problem and not luck: .hidden
is display:none, and game.js's boot calls .show() on that container,
which sets an INLINE display that outranks the class. The class just
stays behind as a stale label. It is applied to all five corner
containers, so if it ever became load-bearing the whole game UI would
go, not this panel - which is the right coupling for something that
lives in the toolbar. 

## the-toggle-is-config-monsterhunt-enabled-default

WHY ALL THREE CHARACTERS HUNT. Accepting is a per-character socket emit and
the assignment is per-character, so three characters are three independent
rolls. Measured live 2026-10-03 on US IV: Dexon drew cgoo x50, FatherToken
osnake x34, MageofOz crabx x51 - three DIFFERENT monsters held at once,
because assign() skips any type already published in server.s as somebody's
hunt and every one of these characters is account level 75, which publishes.
So three rolls give three chances that at least one target is something this
party should actually fight, and the counts came back small enough (24k-214k
total damage) that all three fit inside one 30-minute window. One roll would
mean accepting whatever came up or waiting the clock out.
SAFETY IS NOT HAND-ROLLED HERE. A hunt target is judged by the party's own
farm scorer - real measured dps through mitigated(), the priest's actual heal
throughput, incoming dps at FARM_SEARCH.maxConcurrentAttackers, and the same
uptimeFraction gate the farm search uses. What mhEvaluate() deliberately
drops are the ECONOMIC gates: a hunt is paid in monstertokens, so the xp
rate and the gold-margin test that scoreAllFarmSpots() applies are not
reasons to refuse one.
CREDIT IS SHARD-LOCKED AND FAILS SILENTLY. monster_hunt_logic returns on its
first line unless s.monsterhunt.sn === region + " " + server_name, and
nothing logs the mismatch. So a shard hop mid-hunt freezes every counter
while the party keeps killing. mhTick checks the shard on every pass and
abandons rather than grinding for nothing. -> mhStale 

## the-toggle-survives-a-shard-hop-mhon

THE TOGGLE SURVIVES A SHARD HOP. mhOn()/mhOff() used to assign straight to
CONFIG.monsterHunt.enabled, which is in-memory only - and a change_server is
a page reload, so the flag reverted to whatever the source said the moment
Meltymerch's scan hopped the party or anything else re-entered the game.
CODE storage survives both a reload and a deploy, which is why the
achievement queue keeps its position there.
The stored value OUTRANKS the source default, because a toggle that the
source could silently override would be no toggle at all. The cost is that
editing the enabled: line above has no effect while something is stored -
mhForget() clears it and hands control back to the source. That is the same
shape as scout.enabled/parked on the merchant, where a live slot differing
from the repo on those two is the operator's own hand toggle and deliberate.
Cached in mhToggle rather than read on every call: mhCfg() runs several
times per tick and once per candidate inside mhScore. 

## the-park-point-for-a-rage-boxed

THE QUEUE IS NOT UNIFORMLY TRUSTWORTHY, which is why this validates rather
than just reads. Measured 2026-10-12: entry 0 is a real park point, but
entry 18 is `booboo @ (415,-702)` - the raw boundary centre, gap 0, INSIDE
the box. That is the exact coordinate that wedged the party, sitting in the
queue looking like an answer. First-match-wins happens to pick entry 0 today
purely because it is first.
So every candidate must clear two gates:
  1. rageHit() must say it is outside EVERY box on the map. That is the
     defining property of a park point, needs no threshold, and is the same
     check rageGuard uses - entry 0 returns null, entry 18 returns "booboo".
  2. It must be within HUNT_PARK_MAX_GAP of THIS spot's rectangle, which is
     what stops the booboo[5] point being handed to the booboo[4] pack 861
     units away.
Nearest qualifying entry wins, so ordering stops mattering.
A rageHit that throws DISQUALIFIES the candidate rather than passing it.
Refusing a hunt costs a slot; guessing cost an hour, twice.
`also` is honoured, which is what makes the booboo entry cover mummy.
achvCfg() hands back CONFIG.achievements with no enabled gate, so this works
with the achievement system switched off - the live config. 

## the-pure-damage-refusal-was-removed-in

THE PURE-DAMAGE REFUSAL WAS REMOVED IN v81, and what it got wrong is worth
   keeping because the shape recurs. It read:
Pure damage ignores armour AND resistance, so no amount of gear or
healing makes it survivable - it is a refusal, not a score.
     if (mob.damage_type === 'pure') return null;
   The premise is true and the conclusion does not follow. Pure damage
   ignores MITIGATION. It does not ignore healing throughput, hp pool, or
   kill speed, and the uptime gate below is healThroughput - incomingDps,
   which contains no armour term at all. Nothing was being protected.
   It was also the only damage_type check in the file. scoreAllFarmSpots has
   none and runs every mob through this same gate, so the script FARMED
   booboo while refusing it as a hunt - see the v80 entry, which is entirely
   about routing the party into booboo's corridor.
   One more thing it inverted: the long note in scoreAllFarmSpots explains
   that incomingDps is pessimistic by 57-62% because it omits the player's
   own damage_multiplier. For a pure-damage mob that pessimism vanishes -
   the damage genuinely is unmitigated - so the gate's input is EXACT here
   and nowhere else. The one case where it could be trusted completely was
   the one case it was never allowed to compute. 

## the-spot-is-a-bounding-box-centre

THE SPOT IS A BOUNDING-BOX CENTRE, AND A CENTRE NEED NOT BE STANDABLE.
mhEvaluate takes the middle of G.maps[map].monsters[].boundary, which is a
rectangle drawn around a spawn - it says where the monsters are, nothing about
where the ground is. MEASURED 2026-10-04: target_a750's centre on main is
(-270,280), can_move_to() returns FALSE there, and Dexon stood 63 units off it
with smart.searching true, hunting a route that does not exist.
can_move_to() reads the CURRENT map's geometry, so it can only be asked once we
are standing on the pick's own map. Testing at selection time would have been
asking the wrong map about the wrong point, which is why this runs on arrival
instead. It walks outward from the centre and takes the nearest standable
point inside the box, so the party stays as close to the spawn as the terrain
permits rather than being bounced somewhere arbitrary. 

## take-the-wheel-from-a-trip-already

MEASURED 2026-10-04 on Dexon. The game log repeated, verbatim and without
end, "Path found!" followed by "[mh] could not reach Daisy: interrupted".
A state sample during it caught both owners live at the same instant: he
stood on main at (35,-109), which is 317 units from Daisy and INSIDE the
340 radius so mhAtDaisy() was already true, while travelState.inFlight was
true against target mansion|-8|-148 and smart.plot held an 8-step route to
mansion. Nothing was wrong with the pathfinding - he was simply being
driven by two destinations at once, and the other one kept winning.
Orphaning is the cure rather than merely waiting, and travelTo is already
built for it: its catch opens with "if (!mine()) return false", where
mine() compares travelState.attemptId against the id that call captured.
Bump the id and the interrupted travelTo returns immediately instead of
reaching town() and the retry, and its finally clause leaves our state
alone too. This is travelWatchdog's own trick, applied on purpose instead
of on a timeout.
Left alone, the cycle ends at the 180-second "cannot reach Daisy" giveup in
mhTick, which calls mhReset and throws away a hunt that was already paid
for in kills. 

## the-pick-can-die-under-us-and

MEASURED 2026-10-04 on Dexon: mhPick was target_a750 at main|-270|280
while his live character.s.monsterhunt was booboo x3 with 27 minutes
left, and target_a750 appeared in NOBODY's pool - not his, not
MageofOz's pppompom, not FatherToken's stoneworm. The reports were
three seconds old, so the pool was not stale; the PICK was. Nine
minutes into the phase with mhDone still empty.
A follower's entry is only as fresh as its last mh_report, so a
disagreement is believed only when that report POST-DATES the pick -
otherwise an old report could cancel a hunt that is perfectly alive.
Our own entry is rewritten by mhRefresh() every tick just above, so it
never needs that test. 

## tell-the-party-where-we-are-farming

This used to fire every five seconds regardless, resending an unchanged spot
forever - the single heaviest source of traffic in the system, and almost
all of it repetition.
Now it is driven by what actually matters. A CHANGE starts a burst: five
seconds apart for a minute, because that is when a message is worth
repeating - someone may be mid-hop, mid-load, or not listening yet. After
the burst it settles to a thirty-second keepalive, which is enough for a
member who joins late or misses one.
A member JOINING also starts a burst, since they have never heard any of it.
Tracked by name rather than by count so a swap - one leaves, another joins -
is still seen as an arrival. 

## replace-our-previous-hit-listener-and-survive

The socket lives in the game frame and outlives a CODE restart, so
every reload used to add another listener. Measured on Dexon after a
morning of redeploys: nine of them. The orphans belong to destroyed
CODE frames, where `parent` is null - and the line that reads
parent.party_list sat OUTSIDE the try below, so an orphan threw
straight into socket.io's emit loop and aborted the remaining
listeners. The live handler registers last, so it never ran: Dexon's
DPS meter read zero while the rest of the party's read correctly.
Two defences, because either alone is insufficient. Removing our own
previous handler stops the pile growing - but only ours, since a
blanket removeListener('hit') would also strip the client's own
damage-number rendering, which is not ours to take. And the guard on
the first line means an orphan that does survive returns quietly
instead of poisoning the chain for every listener behind it.
Orphans already on the socket are only cleared by a page reload; a
CODE reload cannot reach them. 

