# Ranger.js changelog

Dexon (Ranger) - CODE slot `CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB`

Moved out of the Ranger.js header on 2026-10-18, for the reason Merchant.js
was emptied on 2026-09-21: a slot that grows without limit eventually stops
evaluating and says nothing about it. The header had reached 89,104 bytes,
22% of the whole file, and one single line of it was 64,673 characters.
None of that is load-bearing for the script and all of it was costing budget
against the CODE slot ceiling.

The ceiling is NOT a known number - see Party/MerchantChangelog.md, which
records a build 6% past the figure once quoted as the cap evaluating and
running fine. Keeping these files lean is still worth doing; just do not
quote a limit.

Entries below are VERBATIM from the header they replaced. Only the line
wrapping is new - no wording was changed, nothing was summarised, and the
chronological order is unchanged. Newest first.

Prepend new entries here, never to line 2 of Ranger.js, and bump the version
on that line in the same commit.

## v92

Relay helpers: say why plActed/plMarkActed are unreferenced here.

**NOT DEPLOYED.** The live slots were loaded with v91/v52/v75 at ~14:56 on
2026-10-18 and confirmed running by feature detection. This is the review
round on top of that; repo HEAD is ahead of all three until the operator
pushes again.

A comment, no behaviour change.

plActed and plMarkActed are declared in this file and never called, which the
browser session flagged as exactly the declared-and-unreferenced shape the
dead-code pass removed elsewhere and a future AST scan will flag again. They
are staying, and the comment now says why rather than leaving the next reader
to work it out or delete them.

The two helpers exist to stop a handler that RELOADS THE PAGE from acting on
the same message twice. Dexon has no such handler: `on_cm` takes six message
types - boss, mh_report, dps_report, blacklist_spot, come_to_merchant,
merchant_done - and none of them reaches `change_server`, whose only call site
is in the bossHop driver. So the in-memory plFirstTime covers the
in-game/relay duplicate and the persisted cursor covers the reload, and the
durable acted-list has nothing to do here.

They stay for two reasons. The relay block is identical in all three files, so
the next fix to it ports once instead of three times - the Merchant v68 fix
not reaching these three is precisely what cost the followers a reload loop in
the first place. And if a Dexon handler that hops is ever added, the helpers
are already there; the comment names bossHopFollow in Priest.js and Mage.js as
the shape to copy.

Third option considered and rejected: dropping them from Ranger only. That
makes the relay block diverge per file, which is the condition that produced
the bug being fixed.

## v91

Relay replay protection, ported from Merchant v68.

Relay replay protection. Ranger cannot hit the reload loop itself - it sends
boss_hop and never receives it - but it reads the same relay and needs the
same persistence for the message types it does receive, and a cursor resetting
to 0 on every one of its own hops re-reads the window regardless.

**The loop.** change_server() reloads the page. The reload resets plCursor to
0 and empties plSeen, both of which live only in memory. The bridge serves
every message newer than `since` for MESSAGE_TTL, ten minutes, so the fresh
page asks from 0 and is handed the window back - including the boss_hop it
just acted on, which makes it hop again. Four steps, closed.

Measured on the live party 2026-10-18: FatherToken and MageofOz reloading in
place on US V, each "hopping" to the shard it already stood on, cursors
climbing 0 -> ~19,700 inside three minutes. Dexon was never affected because
he SENDS boss_hop and never receives it - which is exactly why the operator
saw the two followers and not the leader. It stopped on its own only because
the stale message aged out of the ten-minute window. It was dormant, not
fixed; the next hop would have re-armed it.

Merchant hit the identical loop with potion requests on 2026-09-25 - MageofOz
went 278 to 10,563 mpot1 on one genuine request - and fixed it in v68. None of
that reached these three. Ported here, with one deliberate difference.

**1. plCursor is persisted**, with Merchant's bridge-restart guard: if the
bridge's own cursor comes back BELOW what we asked from, its seq began again
at 0 and a remembered cursor would sit above every new message and starve us
in silence. Re-reading the window once is the cheap answer.

**2. COMMITTED PER MESSAGE, not per batch - the deliberate difference.**
Merchant advances the cursor after the whole batch, so a hop mid-batch
re-reads the tail rather than losing it, and its watermarks absorb the
overlap. That order cannot work here: change_server never returns, so a
batch-level commit is never written at all and the entire window replays - the
commit that would have prevented the loop is the one the loop prevents. Per
message, the only thing that can replay is the single message that reloaded,
and part 3 absorbs exactly that one. Same safe direction, finer grain.

**3. A durable acted-list**, capped at 20 ids, written to CODE storage BEFORE
change_server. plSeen cannot do this job: the whole problem is that the page
dies between acting on a message and remembering that we did. Keyed on _plid,
not a timestamp - _plid is already stamped by plSend in all four scripts and
is already the dedupe key, whereas _plts exists only in Merchant and would
need porting along with the bridge-field bug Merchant already shipped once,
reading `ts` when a /msg row carries `at`.

**Demonstrated, not just parsed.** node --check cannot show any of this, so
the real functions were lifted from the committed file and driven through a
simulated hop with CODE storage surviving and memory dying. 13 checks on the
replay: the first delivery hops and persists its id BEFORE hopping; after a
reload memory is empty and storage is not; the replayed message is REFUSED and
- replayed deliberately from a different shard so the same-shard guard cannot
be what catches it - refused by the acted-list specifically; a same-shard
order causes no reload and is not recorded as acted; a genuinely new order
still hops; the list caps at 20 keeping the newest; and with CODE storage
throwing it still hops rather than wedging, warning that the message may
replay. 7 more on the cursor: a message before the reloader is committed
before it runs, the cursor reaches storage and a fresh page resumes from it
rather than 0, and the restart guard detects a backwards seq, resets to 0,
persists that, and does not starve afterwards.

## v90

A TOGGLES block and a console-command header - the treatment Priest, Mage and
Merchant already had. Additive only: no read site changed and no behaviour
changed.

**TOGGLES.** All 39 on/off switches in CONFIG collected into one `const
TOGGLES` immediately before `const CONFIG`, with CONFIG referencing each. The
value still lives at its original CONFIG path, so a local alias and any
runtime assignment both resolve exactly as before. This is the largest of the
four blocks; Merchant has 20, Priest 28, Mage 23. `enabled` appears 18 times
here, so every key is namespaced: `<subsystem>` for an `enabled`,
`<subsystem><Key>` for anything else. Values replaced by AST offset rather
than by line, because several CONFIG lines carry two booleans at once. The
current live settings are preserved as written - bossHop on, monsterHunt off -
since hoisting copies the value, it does not choose one.

The block's comment carries the runtime caveat: the value is read ONCE when
CONFIG is constructed, so assigning to TOGGLES at runtime does NOT propagate,
while mhOn()/mhOff() and the other console commands still work because they
assign to the CONFIG path.

**CONSOLE COMMANDS header.** 23 commands with their signatures, under the note
that they have no internal callers BY DESIGN and that a static scan will call
every one of them dead. Derived with an AST walk - top-level functions with
zero bare, zero dotted and zero string-literal references, excluding on_*
handlers - not from a list.

A SECOND, SEPARATELY LABELLED GROUP lists 3 more: functions an operator can
also type, but which HAVE internal callers, so a dead-code scan would never
flag them. They are reference, not protection, and the split keeps visible
which names would actually be at risk if their caller disappeared. The
operator's call, 2026-10-18: the header is an operator reference, not a scan
shield.


## v89

A join-type event cannot be entered hop-sick, so stop arriving that way.

RECONSTRUCTED 2026-10-18 from commit 1a4a341, which shipped the code but
bumped neither line 2 nor this file - the first entry to go missing since the
convention changed. The text below is that commit's own message, not a
summary written after the fact.

crabxx is in CONFIG.bossHop.targets and boss hopping is live, so this was
costing hops that could never pay. G.events.crabxx.join is true, meaning
arrival is an event JOIN rather than a walk, and the server refuses a join
while hop-sick: "You can't do this when you are sick!". Hopping re-stamps hop
sickness on arrival, so a hop timed to land at spawn lands unable to join at
all - every time.

Two separate failures, both fixed. (1) localTarget() would pick a crabxx
standing on our own shard while hop-sick and then fail the join; it is now
skipped until the clock clears. (2) candidates() admitted a pre-spawn hop at
preSpawnBuffer, 3 seconds - for a join event the lead time has to exceed the
whole hop-sickness duration, so join events now use hopsickMs() +
joinClearMarginMs.

pickTarget() additionally requires that enough of the event window remains
AFTER hop sickness clears to satisfy the dwell, so we do not hop for a crab
that will close before we can touch it. spawnTime is now carried through
candidates() to make that computable.

Everything is read from the game rather than hardcoded - hopsickMs() from
G.conditions.hopsickness.duration, isJoinEvent() from G.events[x].join,
eventWindowMs() from G.events[x].duration - so a new daily behaves correctly
without editing a list here.

Measured 2026-10-18: hop sickness 720,000ms; crabxx window 2,400s. Waiting out
the sickness inside the window is affordable only because of that gap -
roughly 28 minutes of crab remain after the 12-minute wait.

## v88

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-18, BUT ITS TWO BEHAVIOUR FLAGS
NOW MATCH IT. Dexon is running v87 plus two hand edits; this commit folds
those edits into the repo so a push needs no hand work. bossHop.enabled false
-> TRUE and monsterHunt.enabled true -> FALSE. Both are startup defaults only:
mhOn()/mhOff() still flip the hunt at runtime, and flipping bossHop needs a
RELOAD rather than an edit, because startScanning() runs once at load and
returns early while the flag is false. The comment above bossHop.enabled
opened 'Off: the operator flips it ... a session the operator starts
deliberately', which committing true would have turned into a fresh
documentation trap of exactly the kind the rest of this version removes, so it
is rewritten; the reload paragraph is kept verbatim because it is still true
and still the thing that catches people. THE REST IS DEAD CODE, 197 lines,
found by two independent passes - a reference sweep from the browser session
and an acorn AST walk here - which agreed on every item and position after one
stale-checkout correction. Deleted: homeServer (superseded by v87's
goHomeIfIdle, which reads character.home and says 'nothing is hardcoded'; a
dead 'USIV' const was the highest-cost line in the file, one day after the
account moved to US II); locations (34, a monster-coordinate table the farm
scorer replaced); rageFilterTarget; handleSpecificEvent (29, author-marked
DEAD in its own comment); kitePathBlocked (8, a hard veto that eliminated
every candidate whenever we were inside the pack); focusFireTarget (14);
holdCohesion (28, also author-marked); findBestFarmSpot (4, a wrapper whose
callers already use scoreAllFarmSpots directly); and the whole Temporal Surge
feature - handleTemporalSurge, isMyTurnForTemporal, updateTemporalRotation,
getTemporalRotation and CONFIG.equipment.temporal, 57 lines end to end.
MageofOz owns Temporal Surge now; his copy is live, unrelated and untouched.
getTemporalRotation is the one item neither first-order reference count found:
both its callers are themselves dead, so only reachability reaches it. Also
dropped two config keys nothing reads, movement.moveThreshold and
rangedKiting.prioritizeDistance. equipment.bossSetSwapEnabled is KEPT by the
operator's call - the swap is planned now that hopping is live - and now
carries a NOT IMPLEMENTED comment, because a knob reading true for code that
does not exist is a trap whether or not it is dead weight. Every deletion took
its attached doc comment with it: 16 lines the manifest did not count, and
leaving them would have recreated the orphaned-comment problem the pass exists
to remove. Three surviving comments that named deleted code were reworded
rather than cut, keeping the reasoning: the kitePathBlocked note still records
WHY the veto died and now says not to reinstate it, the travel-radius note
drops the cohesion leash figure, and the cohesion comment went with its key.

## v87

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-18. Dexon is running v86. Two
changes, both out of the overnight run. THE TARGET LIST NARROWS TO THREE -
dragold, franky, crabxx - the reachable sub-100 rungs. Overnight credited 20
boss kills for 24.35 score, every point of it on mrgreen and mrpumpkin, whose
rungs are still 619 and 530 kills away. franky took one kill at exactly 1.300,
the full-party multiplier, which proves the v48/v71 follower relay works.
crabxx, snowman, dragold and grinch were never live, so the cheap rungs got
nothing. Meanwhile ZERO mobs died all night - armadillo, osnake, snake, bee,
poisio and croc all unchanged - because with mrgreen on a 94-minute respawn
across 13 shards something was always eligible and the party never stopped
hopping. Six and a half hours that would have produced roughly 105,000 score
at 1.6 a kill produced 24.35. Dropping the two
cheap-to-reach-but-expensive-to-finish bosses means pickTarget() usually
returns null, and null hands control straight back to ordinary farming.
snowman is out despite being the cheapest rung at 60 kills, because
FatherToken holds that account max at 22.10 against Dexon's 19.35 and it is a
winter-event boss; grinch is out as a judgement call, though an unavailable
target is never picked and costs nothing. AND THE CHAIN NOW ENDS AT HOME. v86
removed home routing BETWEEN kills and that stays removed - a round trip
between two targets buys nothing and re-arms both clocks. This is the other
case: nothing eligible anywhere, so there is no next hop, and parking on a
foreign shard forfeits the HOME shard's own boss spawns, the only ones paying
the home-server bonus and the drops_home table. goHomeIfIdle() reads
character.home, which is the Bean-set home already in currentShard() format,
so nothing is hardcoded, and debounces on idleSince against returnHomeAfterMs
of 90s so a boss flickering across the eligibility floor cannot ping-pong the
party between shards. It routes through changeServer(), so the followers are
told first and come along. bossHop.enabled stays FALSE: a feature that moves
the party across shards should not start itself on a deploy.

## v86

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-17. Dexon is running v82. This
records live configuration rather than changing behaviour. Five lines of the
LIVE slot had drifted from the repo and none of them were in git, so every
paste of a repo build was silently reverting the operator's own settings - and
the deployment markers only ever record the repo being AHEAD of a slot, with
no marker for the reverse, which is the direction that bites. Found by
block-hashing codemirror_render.getValue() against v82 (372,989 UTF-16 units
live against 372,979 committed, same line count), then hashing lines within
the three differing blocks, which located five lines in a 7,217-line file.
ADOPTED FROM LIVE: 'mole' joins singleTargetMobs; the achievement queue's
enabled becomes true, which is the mode the party has actually been in all
day; and the booboo park point (290,-990) is commented out rather than
deleted, because that is the entry the operator uncomments when booboo IS
wanted. DELETED: the second booboo entry, (415,-702). v82 measured it at gap
0, rageHit 'booboo', INSIDE the rage box - it is the coordinate that wedged
the whole party twice in one morning - and it was kept then only in case the
achievement path used it differently. It does not. Two booboo entries where
only one is ever enabled is how the wrong one gets uncommented, and
huntParkPoint validates by rageHit and rectGap with nearest-qualifying-wins,
so nothing indexes the queue and removing an entry shifts nothing. NOT
ADOPTED: monsterHunt.enabled stays true against live's false. Operator's call
- the repo carries it enabled, so a deploy turns monster hunt back on by
intent, and that is the one line to flip by hand after a paste if ordinary
farming is wanted instead. ALSO, A THIRD STALE TOGGLE COMMENT. The
achievements comment opened "OFF, with monsterHunt above ON - the operator's
2026-10-12 choice", which is a state claim of exactly the kind the standing
rule forbids and which this version would have made false, and it closed by
justifying the entry this version deletes. Merchant v98's sweep and the pair
fixed in v85 both missed it because it never says "currently ON".

## v85

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-18. Dexon is running v82. The
dwell gate is PER-BOSS, not a constant, which is the one substantive defect in
v84. requiredDwellMs was a single 60s number and pickTarget() applied its
76.5s floor to all seven targets; it was calibrated on mrgreen, which is the
only boss it fits. What has to be out-weighed is the total damage every OTHER
contributor banks across the whole fight, and that is the boss's entire hp
pool, so the requirement scales as maxHp^0.65. One constant was therefore
wrong in both directions at once. snowman (1,200 hp) and crabxx (960,000)
could NEVER be picked - their whole-health secsToDeath is 0.06s and 48.0s,
both under 76.5s at any dps - and those are the two CHEAPEST rungs on the
board, 60 kills to resistance +3 and 70 to luck +1. franky meanwhile was
admitted when it earns nothing: it needs 167s at 40 contributors and the gate
passed anything over 76.5s, so the party paid 12 minutes of hop sickness for
no credit. THE FIX IS IN THREE PARTS. candidates() now emits maxHp alongside
hp, because secsToDeath correctly asks when the boss will die while the dwell
requirement needs the full pool - contributors' points for damage dealt before
Dexon lands are still in total at the award. The G lookup is hoisted out of
the pre-spawn branch into maxHpOf()/gameData() so both paths see it, keeping
the typeof guard: optional chaining does NOT save an undeclared identifier
from throwing. requiredDwellSec(maxHp, contributors, hopsick, mtype)
implements the share model directly - others deal the whole pool split K ways,
contributing K^(1-E) * maxHp^E to total, and Dexon clears THR/(1-THR) of that.
contributors() derives K from observed dps over typicalPlayerDps, clamped to
[5,200], since no feed reports one; it is self-consistent rather than
accurate, because more dps means both more players and a faster death and both
push the gate the same way. isHopsick() reads character.s live. AND THE SINGLE
FLOOR SPLITS INTO TWO TESTS, which is what unblocks snowman: a LIVE boss must
outlast the trip (secsToDeath >= arriveSec) while a PENDING one is exempt,
since we land before it exists and catch the whole fight; then enough must
remain AFTER landing (remainingSec >= requiredDwellSec). Conflating the two is
exactly what rejected snowman, which needs ~0s of dwell but dies far inside
the hop latency and is only ever reachable pre-spawn. localTarget() gets test
(2) as well - v84 let it commit FIGHTING to a boss whose share was
unreachable, a quarter of an hour spent for nothing - with hopsick read live,
because a clean party's requirement is 5x smaller and that is precisely when a
boss standing in front of him is most worth taking. Unknown hp does NOT reject
a local boss: there is nothing to lose by trying and the alternative is
hopping away from a free fight on missing data. CONFIG: requiredDwellMs is
DROPPED rather than left as a dead knob that looks live; dexonDps 2605,
typicalPlayerDps 2000, minContributors 5, maxContributors 200 added, with an
optional per-target dexonDps override. The 2605 is a magical-resistance figure
measured against mrgreen (resistance 900, apiercing 122) and is a first
approximation elsewhere - crabxx is armor 320 physical, franky lists no
resistance - mattering least where the maxHp term dominates and most at
mrgreen, where a 2x error moves the gate from 50s to 100s. Per-boss figures
want measuring. ShowBossHop now prints maxHp, contributors, requiredDwellSec,
remainingSec and a rejectedBecause string per row, plus the live hopsick flag
and arriveSec: with a per-boss gate the reason for a rejection stopped being
guessable, since one 76.5s number no longer explains every one of them.
VERIFIED by lifting the shipped methods out of the file and running them, not
by re-deriving: requiredDwellSec reproduces the browser session's independent
seven-boss table at K=10/40/80 to better than 0.9%, the residual being
rounding and well inside the uncertainty on dexonDps; hop sickness is exactly
5.000x on all seven; crabxx flips from rejected to picked; snowman is rejected
live and picked pre-spawn; a near-dead franky on a busy shard flips from
picked to rejected while a full-health one and the same fight with a clean
party both stay picked.

## v84

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-17. The cross-shard dragold hunter
becomes a cross-shard BOSS hunter, and it ships OFF. CONFIG.dragold is now
CONFIG.bossHop, carrying seven targets - dragold, grinch, snowman, franky,
crabxx, mrpumpkin, mrgreen - each with its kills_to_rung. The state machine
needed almost nothing: only six places ever named dragold. TWO FEEDS, AND THE
BRIDGE IS OPTIONAL. The per-shard parent.io sockets stay and now record every
target type rather than filtering on data.dragold, which gives liveness and hp
everywhere with no external process; the bridge /bosses endpoint is layered on
top for the one thing a snapshot cannot give, the dps it measured from its own
sample series on that shard. A dead bridge costs a worse pick, not the hunt -
refreshBridge() is fire-and-forget on a 30s interval, nothing in tick() awaits
it, and a failure drops the rows rather than letting a stale dps rot, because
fallbackDps is at least honestly labelled. ShowBossHop names the source per
row. SELECTION. secsToDeath = hp / shardDps(shard, mtype); eligible when
secsToDeath >= (requiredDwellMs + hopLatencyMs + safetyMarginMs) / 1000, which
is 76.5s at the shipped numbers; among the eligible take the SMALLEST
secsToDeath, tie-broken on the lowest kills_to_rung. Smallest-first reads
backwards until you write out the alternative: eligibility has already
guaranteed the boss lives long enough to earn credit, so every candidate past
that gate pays the same and what separates them is how long Dexon is stuck
there. Biggest-first parks him on a full-health mrgreen for twenty minutes
while four others die elsewhere. A boss that has not spawned yet is admitted
only inside preSpawnBuffer and is costed at full health, which correctly ranks
it last - arriving early means waiting. NO HOME ROUTING BETWEEN HOPS, which
v83 did after every kill. Going home is not useless in itself; it clears Hop
Sickness instantly, measured 2026-10-17 with ~11 minutes still on the clock.
But the clear is spent the moment he leaves again, because the next hop
re-stamps the full 12 minutes, so between two kills the round trip buys
nothing, costs two hops of latency, and re-arms Realm Fatigue on the whole
party - which does NOT clear on the way home. FIGHTING now falls straight back
to IDLE. FIGHTING ALSO EXITS ON DEATH OR A HARD ABORT AND NOTHING ELSE: credit
requires being live in that shard's process when the boss dies, because the
award loop resolves contributors through players[name_to_id[name]] behind a
bare if (current) and a departed player's points are discarded without even
reaching total. maxFightMs is therefore an abort for a fight that has gone
wrong, never a 'banked enough, move on' timer; there is no such thing as
leaving early with a share. It also aborts if something else moved him off the
target shard mid-fight, since the credit is gone either way and pretending
otherwise just wedges the state. The relay message generalises from
dragold_hop to boss_hop and now carries shard and mtype alongside the region
and name it already sent, and it is sent BEFORE change_server because
change_server reloads the page and anything after it may never run.
ShowDragold becomes ShowBossHop, listing the candidate table sorted the way
the picker sorts it, with each row's dps source and whether it clears the
floor; its gate moves from parent.S.lunarnewyear - right while the only target
was a lunar-new-year boss - to the feature's own switch. Two toggle comments
rewritten to describe effect rather than current state, per the operator's
standing rule.

## v83

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-17. Dexon is running v82. `also`
on an achievement entry now reaches the attack filter, and that is the whole
change. achvApply() has always read `also`, added those monsters to
PERMANENT_WHITELIST so the economics check could not drop the spot, and fed
them to ragePullTypes() for the one-at-a-time puller - but shouldAttackMob
never consulted the list. Traced in the shipped file: `also` reaches
achvApply, ragePullTypes and the farm_spot message, and no attack decision
anywhere. So a snake at the osnake spot was pulled, whitelisted, and then shot
only while it happened to be targeting FatherToken - the targetPriority
fallback on the last line of shouldAttackMob. The new check sits next to
`mob.mtype === home` at the same precedence, and NOT in
CONFIG.combat.alwaysAttack, which was the obvious-looking fix and is wrong
twice over: that set is a sort key in updateCache as well as a filter, so
snake there would rank every snake ABOVE the osnakes the achievement is
counting, and it is global, so it would also commit the party to snakes on
every other map. The osnake queue entry gains `also: ['snake']`. Entries
without `also` are untouched - rageAlso is empty everywhere else, and the
guard short-circuits on length. Priest and Mage need no change: they carry
rageAlso for the puller but have no shouldAttackMob of their own, and follow
the leader's target. TDZ checked - rageAlso is declared below shouldAttackMob,
but the only module-scope call before that point is plProbe(), which awaits a
bridge health fetch and cannot reach the combat path.

## v82

The hunt sent the whole party to the dead centre of a rage box and wedged it
there twice in one morning. mhEvaluate's spot is the boundary centre, and for
a rage-boxed pack the rage rectangle IS the boundary, so the one point
rageRoute must refuse is exactly the one the hunt asked for:
rage_route_blocked, 1419 units short, travel attempt 1033. Measured live -
mummy@spookytown centre (255.5,-1432), then booboo@spookytown centre
(415,-702): two monsters, one arithmetic, which rules out anything
mummy-specific. All three characters blocked independently. Dexon computes the
spot and sendFarmSpot broadcasts destination.x/y verbatim; Priest.js and
Mage.js carry the full rage machinery and NO mh* functions, so they inherit
the coordinate and fail on it themselves - one source, three consumers, which
is why this is Ranger-only and the other two need no redeploy. THE FIX IS A
LOOKUP, NOT A COMPUTATION. rageEscape() was the obvious move and was wrong: it
returns the nearest point outside the rectangle and knows nothing about walls,
the exact mistake v80 was spent correcting, where (415,-986) was geometrically
fine and genuinely unreachable. The problem is also small - G holds SEVEN rage
boxes in the whole game and isMapSafeForFarming already excludes three
(spider_instance is instance:true), leaving four a hunt can reach:
mummy@spookytown, booboo@spookytown x2, d_wiz@d2. The queue already has
verified points for the first three. BUT THE QUEUE IS NOT UNIFORMLY
TRUSTWORTHY, which is the part worth remembering: entry 0 is a real park point
- (290,-990), rageHit null, 140 from the mummy RAGE rectangle
[-124,-1631,614,-1130] and 148 from booboo's, reproducing v80's figures once
measured against rage rather than boundary - while entry 18 is booboo @
(415,-702), gap 0, rageHit 'booboo', INSIDE the box. The coordinate that
wedged the party was sitting in the queue looking like an answer, and
first-match-wins picks entry 0 today only because it is first. So
huntParkPoint validates instead of trusting: rageHit() must place the
candidate outside EVERY box, and rectGap must put it within HUNT_PARK_MAX_GAP
of THIS pack - 400, against measured 140/148 for the right pack and 861 for
the wrong one. Nearest qualifying entry wins, so ordering stops mattering, and
a rageHit that throws disqualifies rather than passes. No qualifying point
means the spot is skipped and the hunt declined, which costs one slot;
guessing cost an hour, twice. d_wiz@d2 has no entry and stays refused until
someone stands there and measures. Also fixes the two config comments v81 left
inverted.

## v81

The monster hunt refused booboo before computing anything, and the reason was
wrong. mhEvaluate's seventh line was `if (mob.damage_type === 'pure') return
null`, justified as "no amount of gear or healing makes it survivable". Pure
damage ignores armour and resistance; it does not ignore healing, and the
uptime gate twenty lines below is healThroughput - incomingDps, in which
armour is not a term. The conclusion did not follow from the premise. It was
also the ONLY damage_type check in the file: the farm scorer has none and puts
every mob through the same gate, so this script farmed booboo - the whole v80
entry is about routing into its corridor at (290,-990) - while refusing it as
a hunt. MEASURED, because the first draft of this entry guessed and guessed
wrong: that line was the SOLE blocker. Run against the party's real figures -
max_hp 7,149, heal throughput 2,000/s, dps 2,198 physical / 1,702 magical, all
read live out of the CODE context - booboo scores at FULL uptime even with the
old attackers=4, because 220 x 1.2 x 4 = 1,056 incoming is still under 2,000
of healing. Removing the pure line alone admits it. The claim that
minUptimeFraction 0.5 would have refused it anyway was wrong. The attacker
change below is still correct and still changes verdicts, just not booboo's:
booboo is supply-bound at 5 spawns on a 48s respawn, so the attacker count
does not move its estimate at all. Where it bites is mummy - count 9, 420 x
1.2 x 4 = 2,016 against 2,000 of heal degrades uptime, while the pulled 504
does not. attackers now reads spot.rage - the same
G.maps[map].monsters[i].rage that rageBoxes() reads, so every rage-boxed spot
on every map is covered and no monster is named here - and uses
rageCfg().concurrent when the pull is enabled, falling back to the pessimistic
pack count when it is not. phresistance stays absent; the v72 note sourcing it
to stats.js as a status resistance still holds. booboo is supply-bound at 5
spawns on a 48s respawn, so a 2-count hunt is ~19s of killing against
maxEstMin 15min - the clock was never the obstacle.

## v80

The party never reached the spot and this is why, all of it measured. (1)
rageGuard tripped on the SAME margin the planner aims for, so arriving at a
correctly-planned spot counted as a breach: stop, shove out, travel walks
back, forever - 11 stop/xmove pairs in 5 seconds, every smart_move dying as
'interrupted' with hp full and targets 0. It now detects on the real rectangle
(guardMargin, default 0) and escapes out to margin, so there is hysteresis
between 'safe' and 'get out'. (2) The effective clearance was 55, not 30:
rageRoute excludes cells within margin + step, and 30 + 25 = 55. The corridor
entrance is a pinch measured at 14-18 units wide - an A* at step 5 connects at
margin 14 and fails at 18 - so 55 was never going to fit. Now 4 + 5 = 9,
verified against the LIVE map at the shipped grid anchoring: 13 still failed
there, because the grid is anchored at the search window's corner rather than
the origin and no lattice point fell in the 13..18 band that was left. 9
reaches the park point in 29,443 expansions. (3) step 25 -> 5, because a
10-unit grid cannot resolve a 14-unit gap; the same search that succeeds at
step 5 reports NO ROUTE at step 10 for every margin, which is what made a
passable corridor look like a sealed pocket. maxCells 24000 -> 200000 so the
doubling loop does not quietly push the step back to 20 and undo it. (4) The
search was running off the map - can_move answers happily for points outside
the geometry - and burning the whole budget in the void: 400,000 expansions on
a map holding ~19,000 cells. Clamped to G.geometry bounds it exhausts honestly
in 12,164. (5) The park point moves from (415,-986), which is genuinely
unreachable - a flood from it stops after 385 cells and smart_move refuses it
- to (290,-990), 148 from the booboo rectangle and 140 from the mummy one. The
corridor is entered from the WEST; the operator drew that route by hand and
drove MageofOz through the pinch manually with ~5 units to spare, which is
what disproved my 'sealed pocket' reading. His route is pinned in
CONFIG.movement.approaches. Mummy pulls need 173 of reach and so fall to the
priest (201) or mage (235) by range alone; Dexon's 163 cannot, and ragePuller
already handles that. Standing measurement from the live test: parked 66 from
the booboo rectangle, targets 0 - booboo do NOT aggro from outside the box at
their 420 range, the rectangle is the whole mechanic.

## v79

Four fixes, every one of them measured on a live run of v78 rather than
reasoned about, and the first is a regression I introduced in v78 itself. THE
PARTY WAS STUCK at spookytown's (0,0) spawn through 41 consecutive travel
failures, all rage_route_blocked, with no fear, no attackers and full hp - so
the loop was mine, not the game's. (1) The per-EDGE can_move check added in
v78 was the cause. It was the right worry - stopping the simplifier emitting a
leg nothing had checked - and the wrong tool, because can_move's SEGMENT test
is far stricter than its POINT test, so verifying every 25-unit edge fragments
the graph. Measured from the spawn to the park point: 4-connected with edge
checks reached 1,030 cells and NOT the goal, 8-connected with edge checks 999
and not the goal, 4-connected nodes-only 5,301 and the goal, 8-connected
nodes-only 5,504 and the goal. Connectivity and margin made no difference; the
edge check alone did it. Walkability is settled per LEG in rageWalk now, where
the legs are actually walked: one can_move clears goes to xmove, one it does
not goes to smart_move, whose pathfinder handles terrain - and since both ends
of a leg are already margin-clear of every rectangle and the leg is short,
there is nowhere for it to wander, with rageGuard still watching. (2) An
interruption is combat, not a bad route, and it no longer spends a route
attempt. Measured on a desertland leg: 4 attackers against courage 2, the move
rejected as 'interrupted', the character pinned. This is also what defeated
two manual smart_move tests earlier and was invisible to wrappers on
smart_move/xmove/stop, because the fear response does not go through any of
them - the operator suggested fear and was right. Interruptions get their own
budget, CONFIG.achievements.pull.maxInterrupts, default 12, with a 500ms pause
and a retry of the SAME leg. (3) A release valve for an unreachable
whitelisted spot, which is why 41 failures went unnoticed. There was already a
circuit breaker at TRAVEL.maxAttempts of 3 - but it BLACKLISTS the spot, and
achvApply deliberately adds the achievement spot to PERMANENT_WHITELIST, so it
took the 'whitelisted, so staying put and still trying' branch: one log line,
then forever. The whitelist is right to stop a blacklisting; what was missing
is that after achievements.maxTravelFailures, default 10, the achievement
layer now releases the override, hands the spot back to the scorer and stands
the queue down, so the party farms something instead of standing on a spawn
point. (4) rageWaypoints, an optional hand-pinned approach chain in
CONFIG.movement.approaches keyed 'map|x|y', tried before the search and
refused if any of its own points sit inside a rectangle. Nothing needs one
today: across two monitored trips and 1,283 position samples the pathfinder's
own route to the park point produced ZERO rage-box breaches, which is the
measurement that says the elaborate routing was never what this trip needed.
It exists so a spot can be pinned by hand without that being load-bearing.
Shipping with monsterHunt disabled and the booboo/mummy achievement farm
ENABLED, ready to paste and watch. Priest v46 and Mage v69 carry the identical
module changes

## v78

Four routing fixes, all from one live run. The containment half held - nobody
entered a rectangle all session, which is the thing that killed the party
earlier in the day - but the party never reached the park point and ended up
stranded beside the booboo box. Instrumented rather than read, and the numbers
name the fault: rageRoute succeeded on ALL 13 attempts, returning 6 to 9 legs
each, while ZERO legs completed and every failure was leg 1 from a standing
start. (1) The BFS checked only NODES and allowed diagonals, so it emitted a
route whose own first leg was unwalkable - measured [225,-586] -> [200,-611]
with can_move false on that segment, two individually standable cells with a
wall corner between them that the h 8 / v 7 bounding box cannot pass. It is
now four-connected with every explored EDGE verified by can_move, which also
makes the simplifier's `best = i + 1` fallback safe; it could previously emit
a leg nothing had checked. Diagonals cost nothing to lose because the
simplifier straightens the path afterwards. (2) rageWalk treated a refused leg
as proof that no route existed, and safeSmartMove escalated that into a throw
that travelTo counted as a travel failure - two of those and the trip was
abandoned. It now re-plans from the current position, bounded at four
attempts, and only a null from rageRoute means no route. It also walks from
index 0 rather than 1: raw[0] is the grid cell nearest the start, not the
character's real position, so the step from where we actually stand to the
second waypoint had never been verified. (3) rageWalk calls stop() first and
raises rageNav.busy, which mainLoop stands down on - smart.moving and
smart.searching were both measured true throughout the stranded trip, a second
driver on the same wheel. (4) rageHoldFire, which is the fix for engaging more
than one at a time. The pull gate only ever limited NEW pulls; nothing stopped
the ordinary attack loop, and shouldAttackMob returns true for anything whose
mtype equals home - which booboo is. The party now holds fire on a rage-boxed
type in two cases: while further from the park point than parkWithin, so it
stops breaking the trip to fight on the way in, and on any monster still
INSIDE its rectangle, because shooting into the box is what wakes the pack.
Only what has already come out is engaged. STILL NOT ESTABLISHED: whether
booboo aggro at their 420 range from outside the rectangle. Three were seen
out at x 155-168 against a box starting at 286, but the party was standing 32
units from the edge at the time, so they may simply have wandered to it and
aggroed close - booboo wander at speed 16. The park point at 144 is where that
gets tested, and the party has not reached it yet. Priest v45 and Mage v68
carry the identical fixes

## v77

Rage boxes. G.maps[map].monsters[i] can carry a `rage` rectangle beside its
`boundary`, and stepping inside aggros the whole pack AND applies the
monster's own rage multiplier. Measured 2026-10-09 in the live client on
spookytown: mummy boundary [31,-1571,480,-1293] with rage
[-124,-1631,614,-1130], a halo 130-165 units larger; both booboo packs with
rage IDENTICAL to their boundary; stoneworm, mrgreen and jr with no rage field
at all. Both monsters carry rage 1.5, which is why booboo's listed attack of
220 was measured landing for ~352 - the earlier prediction of 264 and the
measurement of 352 were both right, un-enraged and enraged. This was not
theory: scoreAllFarmSpots returns the spawn-boundary CENTRE, so an override on
booboo resolved to (415,-702), dead centre of the rage box, and the measured
result was three deaths, zero kills, the spawn never reached, and travelState
stuck inFlight with failures: 0 because death kept interrupting the route. The
monster was never the problem; the standing point was. Four things are new.
rageHit/rageClips/rageEscape read the rectangles straight out of G. safeMove
replaces every xmove call site, refusing to enter a rectangle and routing
around one rather than through it - it falls straight through to xmove on a
map with no rage boxes, which is every map but spookytown today, so this costs
nothing anywhere else. rageRoute is a BFS on a 25-unit grid with the
rectangles treated as solid, greedily simplified so EVERY leg is verified
straight-line can_move-clear, which is the whole point: the legs are walked
with xmove, so smart_move's pathfinder - which knows nothing about rage boxes
and would happily cut the corner through one, the interior being ordinary open
ground (can_move(415,-702) is true) - is taken out of the loop. Measured at 4
ms on spookytown. safeSmartMove wraps travelTo and bossApproach so the trip
OUT to a boss event is protected as well as the trip in, and a blocked route
THROWS rather than falling back, because surfacing the failure is the house
rule and silently crossing the box is the one outcome worth failing to avoid.
rageGuard runs first in mainLoop as the net for a respawn somewhere
unexpected, knockback, or being dragged - the failed test respawned Dexon on
level1 at (1376,500), none of spookytown's three spawn points, which is why
the route is recomputed from wherever the character actually is rather than
hardcoded. Nothing here restricts movement OUTSIDE a rectangle: closing,
backing off and regrouping are untouched, and the rectangle is the only thing
that is solid. ragePullTick adds one-at-a-time discipline, with
CONFIG.achievements.pull.concurrent as the knob - how many targets may be in
flight at once, 1 to start, raised as the farm earns trust. ragePuller picks
who pulls deterministically by range so three characters decide alike without
a message: a booboo at its box edge costs margin+2, while a mummy at its spawn
edge needs 193 because of the rage halo, which is past the ranger's 163 and
inside the priest's 201 and the mage's 235. ragePullTick is fire-and-forget
behind a busy flag because a pull is two round trips and mainLoop is wrapped
in the 10s HANG_GUARD - the same trap restockTrip was detached to avoid. NOT
established: whether an un-enraged booboo outside the rectangle opens fire at
its 420 range at all (aggro 1.5 is a multiplier whose base is unmeasured), and
whether booboo's phresistance 50 halves the ranger's contribution as modelled.
Both are answerable by watching the first run, and neither changes the
geometry. Priest v44 and Mage v67 carry the same rage-box safety; the
achievement wiring is Dexon-only

## v76

Goo Brawl is a boss event now, which it was not, and the cause is worth
recording: it is the ONLY one of the four joinable events whose parent.S key
is an EVENT name rather than a monster name. Measured 2026-10-09 in the live
client - G.monsters.crabxx, .franky and .icegolem all exist and all carry
cooperative: true, while G.monsters.goobrawl does not exist at all.
bossCooperative('goobrawl') therefore read undefined and answered false, and
with cooperativeOnly true and include empty, bossEligible rejected it as 'not
cooperative' every time it went live. The gate was right about the data and
wrong about the event. Two call sites broke on the same gap and only one of
them would ever have been visible: bossApproach asked get_nearest_monster({
type: 'goobrawl' }) and got null on every tick, so even a forced
bossJoin('goobrawl') would have teleported in and then stood on the arrival
point without ever taking a firing posture - inside rgoo's reach, which is the
one thing bossPosture exists to prevent. BOSS_FIGHT_TYPE maps the event name
to the monster and bossMonsterType() is used at all three resolution sites
(bossCooperative, bossApproach, bossStatus). No policy was relaxed: goobrawl
now passes the cooperative test for the same reason the other three do, rather
than being admitted by hand through include - which would have hidden the real
defect and left bossApproach still asking for a monster type that does not
exist. The brawl's monsters are rgoo (hp 1,000,000, attack 320, frequency 1.2,
range 64, armor 300, resistance 300, xp 48,000,000, damage_type physical,
cooperative true, aggro 0.1, rage 0) and bgoo (hp 100,000, attack 5, frequency
0.4, range 15, xp 100,000, cooperative true, aggro 0); both were ALREADY in
allBosses, so the attack side needed no change - the ranger admits them
through attackIfTargeted and the priest and mage through BOSS_SET, all three
resolving to the same 'only once somebody else is on it' rule that shared
cooperative credit makes correct. rgoo's range 64 against our ~163 puts this
in the free-shot band with crabxx at 45 and icegolem at 64, not the hopeless
band with franky at 948, and attack 320 physical is heavily mitigated by the
party's armor - this is a far safer trip than the booboo farm measured the
same day. G.events.goobrawl gives duration 540 and type 'daily', so the event
ends on its own well inside the 20 min maxTripMs and bossEnd records no
cooldown; G.maps.goobrawl carries no pvp flag, and on_death is ['goobrawl',
0], so a death respawns inside the brawl rather than ejecting - maxDeaths 2
still bounds it. BOSS_JOIN_SPOTS.goobrawl keeps x/y null deliberately: that
map is reachable by the join emit alone, so bossWalkTarget answering null is
the correct answer and not a hole to fill. NOT ESTABLISHED - the reward. The
operator reports funtoken as a large drop from the event and that is the
reason for this change; game data does not corroborate the mechanism, and the
gap is recorded rather than papered over. rgoo.drops and bgoo.drops are both
null, G.drops has no goobrawl table at all, and the only two drop tables
containing funtoken are glitch and lglitch at weight 1 each. G.items.funtoken
is g 12,000, stack 9,999, type token, and its own text reads 'Collect them
from Daily events' - which goo brawl is, G.events.goobrawl.type being exactly
'daily'. So the payout is server-side event logic that G does not publish, and
its size is unverified from here. Priest v43 and Mage v66 carry the identical
change

## v75

Monster hunt banks each hunt the moment it finishes and takes the next one
without leaving Daisy. Two changes, both in mhTick. The hunt phase used to
push the finished owner onto mhDone and then CHAIN to another member's hunt
whenever one was viable and turnInMarginMs (7 min) of clock remained, banking
the whole batch at the end of the cycle; it now goes straight to the turnin
phase, within one mhTick of the count reaching zero - tickMs is 5s, so that is
the latency floor and the walk is the rest. The turnin phase then calls
mhAcceptSelf() immediately after a confirmed turn-in, while still inside
Daisy's radius. The trade is explicit: one Daisy trip per hunt instead of one
per batch, in exchange for a finished hunt no longer being able to expire
unbanked - which is the only thing turnInMarginMs ever guarded against, and it
is now consulted only when turnInImmediately is set false. THE OPERATOR'S
QUESTION, measured rather than assumed: accepting and turning in are THE SAME
CALL, parent.socket.emit('monsterhunt') with no arguments, and the server
decides which it means from whether a finished hunt is held - which is why
both mhAcceptSelf and mhTurnInSelf already emitted exactly that. Scanning the
live client on 2026-10-09 for every function whose source contains
'monsterhunt' returns exactly ONE that emits it, npc_right_click, and it
passes no second argument. So the game's own Daisy panel sends a
byte-identical request to the script's, and having to close and reopen her
prompt in the UI is a property of the PANEL - closing and reopening is just
how npc_right_click is made to fire again. There is no server-side dialog
state, nothing for this path to reopen, and consecutive emits are exactly how
the turn-in-then-accept pair works. mhAcceptSelf is called unconditionally
because its own first branch returns early when a live hunt is held and emits
nothing then: that is what makes it safe when the hunt that finished belonged
to a follower and we still hold our own. FOLLOWERS GET ONLY THE TURN-IN,
deliberately. Their mhAccept and mhTurnIn share one mhBusy flag and each
refuses outright while the other holds it, so an mh_accept sent on the heels
of an mh_turnin is answered 'already on a Daisy trip' and dropped rather than
queued. Their re-accept comes from the gather phase instead, which mhReset
already primes by zeroing mhAskedAt, so it asks on the very next pass and
keeps asking every askMs until it lands. No change was needed in Priest.js or
Mage.js: mh_accept and mh_turnin already exist on their side and this drives
the protocol that was already there

## v74

The Farm Spot panel's buttons had never worked - all six of its handlers, not
just the override rows. initializeFarmUI does `const $ = parent.$` and then
binds with `$(document).off(...).on(...)`. The selector forms in that function
are fine: `$('body')` and `$('#farm-spot-ui')` resolve in parent jQuery's own
context, which IS the page document, which is why the panel renders correctly.
`$(document)` is the exception, because it passes an explicit OBJECT rather
than a selector, and `document` inside a CODE script is the maincode iframe's
document. So the panel went into the page and every delegated handler sat on a
document the clicks never touch. Measured 2026-10-09 in Dexon's live v73 CODE
context: `document === parent.document` is false,
`parent.document.getElementById('farm-spot-ui')` is true while the CODE
document has no such element, and jQuery's own registry shows the click
handlers for #ui-toggle-expand, #ui-reset-override and .farm-spot-row attached
to the CODE document while the page document carried only the game's own
a.eexternal. A/B test, one real MouseEvent dispatched on a live .farm-spot-row
with the identical selector bound to both: 0 fires on the CODE document, 1 on
parent.document. The ordinary suspects were ruled out first - elementFromPoint
returns the button itself at its own centre, both buttons sit inside a
3440x1305 viewport, pointer-events is auto and visibility visible, and
#ui-mob-list was correctly populated with all 20 candidate rows. Fixed by
naming `const doc = parent.document` once and binding all six through it.
SECOND BUG fixed in the same function: `off('mousemove', document)` and
`off('mouseup', document)` pass a document object where jQuery expects a
selector string, so neither call ever removed anything, and
scheduleFarmUiRedock re-calling initializeFarmUI stacked another pair of
direct handlers every time - they are now `off('mousemove')` and
`off('mouseup')` with no selector. That stacking was invisible because the
drag handlers only arm when the panel is floating and it docks into
.codebuttons normally. The rebind comment above the remove() said all handlers
'rebind cleanly rather than stacking', which was true only of the delegated
ones; it now says which is which. Verified live before shipping: rebinding the
three click handlers to parent.document inside the running v73 made the panel
work - #ui-toggle-expand collapsed #farm-spot-body to display:none and
relabelled itself '+', then restored both. Priest.js and Mage.js contain no
$(document) bindings and need no equivalent change

## v73

The out-of-potions fallback walks to a vendor now instead of firing the town
teleport. town() is parent.socket.emit('town') and nothing else, and the
server answers it by applying the use_town skill, which lands you on the
CURRENT map's town point - measured 2026-10-09 in the live CODE context, and
there is no map argument to give it. Observed live on desertland: he ran dry,
fired use_town, landed at desertland's town point, buy() had no vendor to talk
to, the counts stayed at zero, the finally cleared state.restocking, and the
next 250ms main tick fired the skill again - indefinitely, with Alia standing
unused at -14,-477 on the same map. The five potion vendors in live G are
main/fancypots -35,-162, halloween/fancypots 201,-180, winter_inn/wbartender
-143,-220, and the legacy old_main and original_main pots; desertland's whole
NPC list is transporter / locksmith / scrollsmith / citizen17, so the old path
could not have worked there however many times it ran. restockTrip() now takes
the vendor on this map if there is one - halloween has one, which matters
during the event - and main's otherwise, and smart_move routes it through
Alia. find_npc is deliberately NOT how the vendor is found:
find_npc('transporter') from desertland answers { map: 'test', x: -50, y: -50
}, the first match in G rather than the one on your own map, so a vendor
located that way could have sent the walk to the test map. It is resolved out
of G.maps instead. Three new bounds in CONFIG.potions - restockTripMs 180s on
the walk, restockBuyMs 15s on the purchase, restockRetryMs 60s before a failed
trip is retried - and that last one is what replaces the per-tick retry. The
trip is DETACHED from checkPotionEmergency on purpose: mainLoop wraps that
call in the 10s HANG_GUARD.defaultMs, so awaiting a cross-map walk there would
fire the hang guard on every healthy restock and bury the real failures in
'did not settle'. state.restocking is the stand-down flag instead, same shape
as a Daisy trip, and restockTrip's finally always clears it. Success is tested
by the potion count after buying, not by whether buy() threw, because a
rejection is not the only way a socket call fails. autoBuyPotions' two buy()
calls are gated on atPotionVendor() as well - off-vendor they were two doomed
socket calls every 2s. New operator handles: restockStatus() and restockNow().
NOT CHANGED, both deliberately: travelTo()'s own town() call, which is
documented as a way out of a dead end and retries the real route straight
afterwards, and the post-respawn top-up in maintenanceLoop, which fails
quietly and costs nothing. Priest v42 and Mage v65 carry the identical change;
FamilyFleet.js has no potion-restock path at all and is unaffected

## v72

Evasion and avoidance now scale effective dps, in BOTH scoreAllFarmSpots and
mhEvaluate. Neither was read, and both are straight misses: a mob dodging one
swing in five is worth a fifth less xp/s than its hp implies. Measured
2026-10-06 against live G - 14 monsters carry evasion, 4 carry avoidance, and
three sat in this party's top 14. iceroamer 3671 -> 3303 (rank 3 -> 8), ghost
3248 -> 2598 (11 -> 16), bigbird 2950 -> 2360 (14 -> 29); gscorpion holds rank
1 untouched. Candidate count 84 before and 84 after, so this REORDERS and
never admits or rejects a spot. The avoidance four are why it is not cosmetic
- cutebee 99.9, tiger 99, pinkgoo 98 and wabbit 98.8 are effectively
unkillable and nothing else flags them, as are goblin 99.95, frog 99, jr 80
and the four elementals at 80. mhEvaluate is included for hunt estimates, but
the bound decides whether it shows: killRate is min(dps/hp, count/respawn), so
per 100 kills ghost goes 493s -> 616s, bigbird 1017s -> 1271s and iceroamer
114s -> 127s, while jr, greenjr and frog are SUPPLY-bound and do not move at
all despite evasion 80, 40 and 99 - correct, not a gap. An earlier draft of
this entry claimed jr and greenjr were five times over-estimated; the harness
disproved it before it shipped. phresistance was investigated and DELIBERATELY
LEFT OUT: js/progression/stats.js groups it with pnresistance, firesistance,
fzresistance and stresistance, no client combat function applies it,
damage_multiplier(defense) takes one argument and serves armor and resistance
only, and the monster sheet never displays it - a server-side status
resistance, so putting it in a damage model would be wrong. NOT CHANGED, with
a note left in both functions: incoming damage is still the raw hit with none
of our own mitigation removed, overstating danger by 57-62% at Dexon's armor
377 / resistance 399. That error is one-directional - it can only refuse a
viable spot, never admit a lethal one - and the operator chose to keep it
pessimistic for now. Verified with a 17-case node harness over the extracted
helper plus a full-gate replication of the scorer against live G

## v71

Blacklist false positives. Arrival is now a RANGE (TRAVEL.arrivalRadius 200)
because kiting preempts smart_move and the rejection was counted as a failed
route against a spot we were standing on, and unreachable is never reported
while get_nearest_monster({type:home}) is in range. Cohesion and xp-economics
fixes are in Priest/Mage; Dexon is group[0] so cohesion self-disables, and he
only records what he is told

## v70

Slenderman is out of the boss rotation and in a new hits-of-opportunity path
instead. ROOT CAUSE, measured against adventureland_mongodb: his spawn
broadcast is the only one in the game carrying no x/y - server_functions.js
sends { name, map } where the generic boss broadcast five lines earlier sends
x and y from pack.boundary - so bossWalkTarget() returns null on all three of
its paths (parent.S has no coords, EVENT_LOCATIONS has no entry,
BOSS_JOIN_SPOTS has no entry) and bossApproach() returns early every tick
while the trip stays open to the 20 min maxTripMs cap. Measured 2026-10-04 on
the live party: the cooldown lapsed at 1791142637118 and Dexon opened a fresh
trip at ...181, 63ms later, then propagated it to FatherToken and MageofOz
within 56ms via fromLeader; all three stood in winterland. Exclusion rather
than a better waypoint because he cannot be chased at all: event_loop
re-evaluates him every second and warps him to a random walkable node on a
random one of cave/halloween/spookytown if any non-invisible player on his map
is within 600 units, if any projectile targets him, or every 2 minutes
unconditionally. Dexon's range is 165, so closing to attack range is itself
the warp trigger. Only s.invis suppresses the proximity check and
step_out_of_invis() sits in the shared player attack path, so even a rogue
drops invis on its first swing. He has been at 66,666/66,666 untouched all
event; Lang in #suggestions 2022-10-07 'nobody is farming slenderman ... it
cant be farmed efficiently on most servers because everyone scares it'. NEW
slenderOpportunity() fires only when he is alive, we are already on one of his
three maps, and he is inside our range - no movement and no trip, so the cost
when he is absent is one property read. Called ABOVE the inRange guard in
handleAttack because shouldAttackMob() keeps him out of cache.targets
entirely, so inRange is routinely empty while he is standing on us. Gated to
PHYSICAL damage classes: reflection:96 is gated on defense == 'resistance' at
server.js:3682, which is magical damage only, so a mage or priest reflects 96%
of each cast back at themselves. An earlier reading of this stat and of
phresistance:95 was BACKWARDS and is corrected here - phresistance is the
defense key on the 'stunned' condition, not damage reduction, and slenderman
carries no armor, resistance or evasion at all, so ranger physical lands in
full. NOT changed, having been checked first: maxTripMs already enforces a
hard 20 min expiry in bossTick, so no trip-expiry fix was needed or made

## v69

The party no longer walks to a hunt it does not have. mhTick's hunt branch
tested only 'the owner still holds this hunt AND has finished it' and had NO
branch for the owner's hunt having ROLLED OVER, so a dead pick fell through to
the huntCapMs check and the party kept walking to it for up to 25 minutes.
MEASURED 2026-10-04 on Dexon: mhPick was target_a750 at main|-270|280 while
his live character.s.monsterhunt was booboo x3 with 27 minutes left, and
target_a750 was in NOBODY's pool - not his, not MageofOz's pppompom, not
FatherToken's stoneworm. The reports were three seconds old, so the pool was
fine and the PICK was stale; nine minutes into the phase with mhDone empty.
The pick is now refuted whenever the owner's entry disagrees, but only when
that entry POST-DATES the pick (mhPickAt), because a follower's report is only
as fresh as its last mh_ask and an old one must not cancel a live hunt; our
own entry is rewritten by mhRefresh() every tick so it is exempt. SECOND
DEFECT, same symptom: mhEvaluate returns the CENTRE of the spawn's boundary
box, which says where the monsters are and nothing about where the ground is -
can_move_to(-270,280) is FALSE, which is why he stood 63 units short with
smart.searching true. New mhWalkableSpot() takes the nearest standable point
inside the box. It runs ON ARRIVAL, not at selection: can_move_to reads the
CURRENT map's geometry, so asking at selection time would have been asking the
wrong map about the wrong point - the first plan for this fix, corrected
before it shipped. Leader-only; mhPick, mhEvaluate and mhApply do not exist in
the follower files. Verified with a node harness over the extracted functions

## v68

mhGoDaisy() now takes the wheel from a trip already in flight instead of
racing it. A farm or hunt trip started by mainLoop keeps running inside its
own travelTo() after mainLoop stands down on mhBusy - standing down stops NEW
movement, it does not cancel movement under way - so both owned the single
smart_move the client provides, and Daisy always lost: travelTo's recovery
path calls town(), which TELEPORTS, then re-issues smart_move(dest). MEASURED
2026-10-04 on Dexon: the game log repeated 'Path found!' then '[mh] could not
reach Daisy: interrupted' without end, and a state sample caught both owners
live at once - he stood on main at (35,-109), 317 units from Daisy and INSIDE
the 340 radius so mhAtDaisy() was already true, while travelState.inFlight was
true against mansion|-8|-148 with an 8-step plotted route to mansion. The
pathfinder was never at fault; he was driven by two destinations at once. The
cure is orphaning, and travelTo was already built for it: its catch opens with
'if (!mine()) return false', so bumping travelState.attemptId makes the
interrupted travelTo return before it reaches town() or the retry, and its
finally leaves our state alone. Same trick as travelWatchdog, applied
deliberately rather than on a timeout. Left alone the cycle died at mhTick's
180-second 'cannot reach Daisy' giveup, discarding a hunt already paid for in
kills. Leader half; the follower copies in Priest.js and Mage.js get the
identical guard

## v67

Monster Hunt corrections. maxCount:150 is GONE and replaced by maxEstMin:15 -
it had the sign backwards. The server sets a hunt count as
(20*60*times)/(max_hp/1000)/(respawn+0.25), so count scales INVERSELY with
difficulty: measured live 2026-10-04 it refused bee x500, which mhEvaluate
priced at 200 SECONDS on main's 5-pack at 2.5 kills/s, and minimush x500 at
250s, while a count-based rule would wave through a single 80,000 hp skeletor.
Count is not a proxy for effort, seconds are, and the hunt's own 30-minute
clock was already the real bound. The toggle now SURVIVES A SHARD HOP:
mhOn()/mhOff() write CODE storage under MH_KEY - which v66 declared and never
used - instead of assigning to an in-memory CONFIG that a change_server reload
threw away. The stored value outranks the source default and mhForget() clears
it. mhStatus() says which is in force

## v66

Monster Hunt, behind CONFIG.monsterHunt.enabled - default FALSE, so this build
changes nothing until mhOn(). All three characters accept their own hunt,
because the assignment is per-character and three characters are three
independent rolls: measured live 2026-10-03 on US IV, Dexon drew cgoo x50,
FatherToken osnake x34 and MageofOz crabx x51, three DIFFERENT targets held at
once, since assign() skips any type already published in server.s and every
one of these characters is account level 75, which publishes. Dexon ranks them
with the party's OWN farm model - mitigated() dps, the priest's heal
throughput, incoming dps at maxConcurrentAttackers and the same uptimeFraction
gate - minus the xp and gold-margin gates, which are not reasons to refuse a
hunt paid in tokens. It waits for every member to settle before choosing,
where a member still holding an unexpired hunt counts as settled because they
cannot reroll and waiting for them would never end. mh_mode tells the other
two whether they are walking to a hunt or back to a farm. Credit is
shard-locked and fails silently (monster_hunt_logic returns unless sn
matches), so every pass re-checks the shard and abandons rather than killing
for nothing. mhOn() / mhOff() / mhStatus() / mhSkip()

## v65

The achievement queue walks a list of monster rungs on its own, behind
CONFIG.achievements.enabled - default FALSE, so this build changes nothing
until you flip it. Why: a farm spot lives in manualOverride, a runtime let,
and it is lost silently two ways - a reload wipes it, and checkFarmEconomics
blacklists the spot the override points at, which is how the party left
rat@mansion for booboo@spookytown on 2026-10-01 with 2,583 score still owed,
on a death's xp loss divided into a rate. The queue is persisted in CODE
storage, re-asserted every 30s, and re-adds its spot to PERMANENT_WHITELIST on
every pass because that Set is rebuilt from source on load too. Progress is
READ from the tracker, never counted: parent.tracker is a cache that sat
frozen at 11,038 rat kills while 203 landed, so achvRefresh emits the socket's
own tracker request with parent.render_tracker suppressed for the round trip -
the game's handler ends in show_modal and would open a panel on the operator
otherwise. Needs a tracker ITEM in the bag; the server handler returns early
without one. An override pointing somewhere the queue did not put it means the
operator moved the party by hand, so the queue stands down and says so rather
than dragging them back. achvStatus() / achvSkip() / achvReset(i) /
achvResume() from the console. / 2026-10-02

## v64

Cooperative bosses are engaged only once somebody else is on them, and six of
them were missing from the list that decides it. attackIfTargeted resolves to
mob.target != null, which IS the operator's rule - cooperative credit is
shared by damage dealt, so joining a fight in progress pays and opening one
alone does not. Measured 2026-10-02 in Dexon's live CODE context with a
snowman alive at 155-165 units against his 165 range: shouldAttackMob(snowman)
returned FALSE and cache.targets.inRange was EMPTY, so handleAttack returned
on its first line. snowman was not `home` (spider), not in alwaysAttack, and
not in attackIfTargeted, so it fell to the targetPriority fallback - is the
mob hitting FatherToken - and the boss spent the fight on Jasnah, ShallanDavar
and Ratage, strangers' characters. He fired 8 times in 223 seconds, every one
an incidental arcticbee, against the ~70 his cadence allows. v63 walked him to
the boss and held him at the computed range; the attack gate then refused the
target, which is why the symptom was 'arrived and did nothing'. Derived from
G.monsters[x].cooperative the same day: 19 cooperative monsters exist,
allBosses already covered 13, and the six added here are the remainder -
pinkgoo, rharpy, rimedjinn, slenderman, snowman, tiger. allBosses itself is
deliberately NOT widened: it also feeds COMBAT_SETS.bosses, so that is a
separate decision. Two findings recorded rather than acted on. rimedjinn has
range 200 against Dexon's 165 and FatherToken's 197, so only MageofOz can
outrange it and bossHoldDistance will park the other two inside its reach for
a 640,000 hp fight - the mrgreen problem again, and a candidate for
CONFIG.bossEvents.exclude. bscorpion and ent sit in attackIfTargeted but are
NOT cooperative; they predate the boss work and read as a 'dangerous, only if
already engaged' rule, so they are left alone. Priest.js and Mage.js need a
DIFFERENT fix and are untouched here: their actionLoop has no equivalent
filter, and findBestTarget's boss branch takes any BOSS_SET member in range
unconditionally - too loose where this was too strict - so the same six names
belong in their allBosses AND that branch needs the already-engaged test.

## v63

NOT DEPLOYED TO THE LIVE SLOT as of 2026-09-30. Change: BOSS EVENTS. The
operator's rule, given 2026-09-30: cooperative bosses only, fought from
maximum range, never expecting the kill. Cooperative is the game's own
G.monsters[x].cooperative - credit shared by damage dealt - so a trip pays
even when somebody else lands the finishing blow, and it is the only class of
boss where chipping from range is a strategy rather than a wasted evening. An
unknown monster is NOT treated as cooperative. THE OLD BEHAVIOUR WAS NOT A
POLICY AT ALL, in three ways. First, shouldHandleEvents() asked only "is
anything in getDynamicEvents() live", and EVENT_LOCATIONS lists dragold,
mrgreen and mrpumpkin UNCONDITIONALLY - so the party dropped the farm for any
of the three the moment it spawned, whatever the odds, with no cap and nothing
to bring it home. Measured the same day against this party (Dexon 75,
FatherToken 69, MageofOz 70, single-target party DPS about 2,400): mrgreen is
36M hp behind resistance 900, which is 6.6 HOURS, and its attack range is 620
against our 158/197/201 - there is no standing position it cannot reach.
dragold is 4.1h, mrpumpkin 4.1h, franky 120M hp and 13.8h at range 948.
Second, all three files ran the SAME most-damaged-event scan independently, so
two live bosses could send the ranger to one and the priest to the other; the
tie-break is now by name, the leader broadcasts its pick, and a follower
believes that call for leaderTrustMs before deciding for itself. Third, crabxx
was in the ranger's getDynamicEvents alone (v55), so he joined it while the
other two kept farming - the boss side of a 960,000 hp fight with no healer,
and its 11,706 per hit takes MageofOz down in 1.6 seconds. MAX RANGE IS TWO
POSTURES and bossHoldDistance computes both from the live entity: outside the
boss's own reach when ours is longer, which costs nothing (crabxx range 45,
icegolem 64), and otherwise the far edge of ours, which is merely the best
available (franky 948, mrgreen 620). JOINING is measured from
adventureland_mongodb node/server.js socket.on('join'), not inferred: exactly
four events teleport - goobrawl, crabxx to main (-1000,1700), franky to
level2w (-300,150), icegolem to winterland (820,425) - and every other boss
must be walked to. The same handler refuses with no_merchants (so never
Meltymerch), cant_when_sick (hopsickness, i.e. just after a shard hop, which
is now reported rather than retried blindly), cant_in_bank and cant_join for
any name not listed, and it ignores the emit when we are already within 200
units - which is why repeating it is free. RETURN was left to my judgement,
and it is: boss dead, event expired, maxDeaths 2, or a maxTripMs cap of 20
minutes, whichever comes first, then handleReturnHome(). A trip we GAVE UP on
cools that event down for 30 minutes; one that simply ended does not, because
those are different facts and cooling the second would refuse a boss the party
could have finished. COMMANDS, asked for by name: bossJoin('franky') goes now
whatever the gate thinks, clears that cooldown, and broadcasts to the other
two from ANY character rather than only the leader - "go now" has to mean the
party, not whichever console happened to be open; bossHome() abandons and
returns; bossStatus() prints what is live, the gate's verdict on each with its
reason, and where we would stand against each. The trip is persisted in CODE
storage so a redeploy mid-event cannot hand the party another fresh 20 minutes
at a boss it had already abandoned. handleSpecificEvent is now unreachable and
marked for deletion next time the file is touched, the way Merchant.js retired
heldScanMs. Verified with a 36-case node harness over the extracted block
rather than by reading it: the gate, the name tie-break, both hold postures at
all three ranges, join versus walk, hopsickness, the death and time caps,
cooldown only on giving up, every command, a forced pick that is not live,
follower precedence, and the persisted trip. CORRECTION to the v62 entry that
follows: it still says NOT DEPLOYED as of 2026-09-28, and that is stale -
measured 2026-09-30 in Dexon's live CODE context, String(sendLocationUpdate)
contains needsMluck, so v62 IS deployed. The operator deployed it and the
marker was never cleared. Read every deployment marker below with that in mind
and feature-detect rather than trusting one.

## v62

NOT DEPLOYED TO THE LIVE SLOT as of 2026-09-28. Change: the mluck request
carries its INTENT. sendLocationUpdate sends one `message: 'location'` for two
unrelated reasons - "the merchant can buff me and my buff is missing" and "my
pack is nearly full, come and empty it" - and Merchant.js read ANY location
message from a name in CONFIG.mluck.targets as a buff request. So every pickup
ask enqueued an mluck job on the merchant, and an mluck job is a whole batch
there on its own: a shard hop, a trip to Dexon's last-known coordinates, and -
when he arrived with Dexon further than mluck's 320 units away -
summonAndWait, which pulls Dexon off the farm spot for up to 60 seconds. The
operator observed exactly that on 2026-09-28 with more than 50 minutes left on
the buff. Measured in his live CODE context the same day, which is what
identified the real sender: mluckState() returned {ok:false, why:"Meltymerch
is not in the party"} while character.s.mluck read {f:"Meltymerch",
minsLeft:42}, so needsUpdate was FALSE and the mluck branch was sending
nothing at all; pickupCooldownMs is 15000 and lowInventorySlots is 3, so the
pickup branch was asking every 15 seconds. The location message now carries
needsMluck, which is this file's own needsUpdate, and the merchant refuses to
enqueue when it reads false. This is the half that stops the trip being taken;
Merchant v67 is the half that stops the summon, and it also covers a legacy
sender that omits the field. Two smaller fixes in the same pass. (1) The
[mluck] log line was keyed off gate.ok, which only says the merchant COULD
cast it, so it printed "requesting" for the entire hour a fresh buff was
running. That wording cost a wrong diagnosis: the log and the observed
travelling looked like the same event and NEITHER of them was the request. It
is keyed off the decision now, it names which of the two reasons applies, and
the throttle compares the whole note so a genuine change still prints. (2)
rangedKiting.autoBySpeed defaults to false. It was true, and
kiteCandidateTypes() then added every monster Dexon outruns by speedRatio 1.3
on top of the hand-tuned list - 13 types where the list holds 1 - so
"authoritative, never derived" was true of the list and not of the behaviour.
The operator set it false on the live slot on 2026-09-28; the file now agrees
instead of quietly re-enabling it on the next deploy. Also carried in from the
live slot: 'boar' in CONFIG.combat.focusFire.singleTargetMobs.
Feature-detected 2026-09-28, the slot held
['cgoo','bigbird','mummy','prat','plantoid','fireroamer','boar'] against the
repo's six after eaea6d6 removed poisio, so a deploy from the repo would have
dropped an operator edit. Drift is a two-way diff; this is the repo catching
up, not a combat decision made here.

## v61

DEPLOYED TO THE LIVE SLOT 2026-09-26 - this entry originally carried a
NOT-DEPLOYED hold while Dexon stayed on v60; the operator deployed it later
the same day, and it is verified live by feature-detecting
CONFIG.combat.focusFire.singleTargetMobs in his CODE context with all seven
entries present, not by the slot version number. The hand-test that motivated
the hold is ANSWERED and the answer is that cgoo stays on the list: with
single-target OFF at cgoo one 605s window lost the priest at t=532s and the
mage at t=593s, incoming hits on the priest went from 0.034/s to 1.25/s (2.96
average attackers, peak 10), and Dexon's xp rate did NOT improve - 11,131/s
against 11,600/s with single-target on. The mechanism was aggro inheritance,
not the priest fighting: the priest's own output measured 0.10 attacks/s, so
the damage Dexon spread across 2-3 mobs and then kited away from settled on
the nearest body. Written 2026-09-26 at the operator's request so it exists
while he hand-tests whether v60's other changes hold the party together at
cgoo with single-target OFF. Do not save_code this file without being asked.
Change: preferSingleTarget was a hardcoded global true in v60; it becomes a
curated per-monster list, singleTargetMobs, with the global left in place but
off. The gate now tests the monsters actually IN RANGE as well as `home`,
because the case that motivated the list is bigbird sharing main with crab.
Seed chosen from two measured quantities against Dexon's 880 attack and 223
armor: danger per mob (attack after mitigation x frequency) and volleys to
kill under a 5shot at its 0.5 multiplier. crab is danger 7 and 1.1 volleys -
one cast removes it, so AoE is pure gain; bee 6 and 0.7; goo 2 and 0.2; snake
11 and 1.6. cgoo is 299 and 5.5. bigbird is 299 and 73, poisio 112 and 8.2,
mummy 392 and 27, prat 398 and 25, plantoid 598 and 325, fireroamer 299 and
217. So the seed is cgoo (unchanged behaviour at the current spot), bigbird
and poisio (they share main with crab, which is where AoE resumes), and four
that pre-cover the achievement shortlist maps. Bosses are deliberately absent
- AoE needs 4+ targets in range so a lone boss never triggers it, and
ignoreAddsDuringCrabxx already covers the one that arrives with a swarm;
adding fifteen names would make a hand-maintained list harder to read for no
measured gain. Worth recording: cgoo is the WEAKEST entry on its own list at
5.5 volleys, where everything else runs 8 to 325 - its case rests on danger
and the respawn cap, and that ceiling model is the one the v60 evidence
strained, so cgoo is the entry most worth re-testing once this is a list that
can be toggled. The Set is rebuilt per call instead of hoisted into
COMBAT_SETS so it can be edited from the console without a redeploy.

## v60

v59 shipped and measured no better: at cgoo/level2s incoming hits per second
AT the spot went 0.34 to 0.45 (Dexon), 0.59 to 0.66 (FatherToken) and 0.09 to
0.23 (MageofOz), one death each again, 8.9M xp lost. Two findings from that
window explain it, and neither is about movement. FIRST: heal carries
use_range: true, so it reaches character.range - 197 for FatherToken - and
mid-fight he was at (-6,280) with Dexon at (181,637). That is 403 units, 2.05x
outside heal range. He was not failing to heal because he was feared; he could
not heal at all, and the 'feared priest stops healing' story was only half
right. SECOND: the party was not focus firing - two distinct targets across
three characters - and no focus-fire mechanism existed in any of the three
files. targetPriority looks like one but means 'prefer monsters already
targeting the priest'. Party.js had real focus fire via followers copying
leader.target; these files had lost it. Also measured offline against the real
G.geometry.level2s with 24 sampled directions: within 120 units of the cgoo
spawn centre the average open approach-lane count is 23.9 of 24 - a fully open
field, which is what nine simultaneous attackers looks like. Ranger changes.
(1) CONFIG.movement.anchors overrides the spawn-boundary centre that
scoreAllFarmSpots returns; 'cgoo@level2s' anchors to (-86,683), which measures
3 open lanes of 24, is reachable in the same flood-fill region, sits 222 units
out and keeps 2 lanes facing the spawn so monsters still come. It is a funnel
to pull into, not a firing position - nothing that tight has line of fire to
the spawn centre - and it costs no exp/hr because cgoo is respawn-capped at 8
spawns / 48s = 0.167 kills per second, which the party already exceeds about
fivefold. (2) Focus fire: preferSingleTarget skips the AoE branches, since
5shot lands at a 0.5 multiplier and 3shot at 0.7, so against 2,400 hp a 5shot
needs 5.5 casts per target against single-target's 2.7 - it keeps five
monsters alive and swinging instead of removing one every ~2.3s.
leaderPicksLowestHp finishes wounded mobs; the old single-target fallback used
inRange[0], and sortedByHP sorts b.hp - a.hp, so it was opening on the
HEALTHIEST mob in range. AoE also resumes automatically whenever attackers
drop below courage. (3) kitePathBlocked became kitePathPenalty. Measured
offline: with 11 cgoo scattered at 25-70 units, 180 of 180 candidates were
passable and ZERO survived the veto, so inside the pack - the only case that
kills - the whole-field scorer never ran and every decision fell through to
the crude ladder. As a cost rather than a veto the ranking survives and the
scorer picks the least-bad route. Verified: where the veto froze, the penalty
moves and lifts mean distance from the field 45.0 to 69.0.

## v59

Measured 2026-09-26 with v58/v31/v54 live at cgoo/level2s: the derived hold
band was honoured in the steady state - median nearest 134/129/134 against
designed bands of 84-155, 129-192 and 84-196 - and incoming hits fell 27-50%
(Dexon 54 to 37, FatherToken 190 to 138, MageofOz 50 to 25). The party still
wiped. Dexon's last six seconds ran 92 to 72 to 47 to 27 to 10 units while
attackers went 3 to 9, then he sat at 10 - inside his own 84 retreat threshold
- and died; MageofOz bled 1,995 to 0 with ONE attacker while holding 59-95
against a 176 hold, unhealed because the other two were already down. So the
band arithmetic was right and the DIRECTION was wrong: the scorer maximised
distance from the single nearest monster, which inside an 11-cgoo pack means
retreating into the other ten. XP went backwards 5.6M across the party in five
minutes. Six changes. (1) Retreat and disengage now score direction against
the whole threat field via kiteMultiWeight, signed and urgency-weighted - a
candidate that escapes one monster into another is penalised, not merely
unrewarded, and threats we are already deep inside weigh more. Closing and
recentring keep single-target scoring, which measured correct. (2)
kitePathBlocked vetoes candidates whose ROUTE closes on a threat, not just
whose endpoint is farther. The harness caught this: from inside a pack the old
scorer picked a point 30 units beyond a mob standing 10 units away, scoring it
as ten units gained while the path walked over it. Priest.js had tangent cones
for this; this file had nothing. (3) Step-length retry at 1, 1/2 and 1/4 - a
wall 30 units out used to block every candidate while 10 units of room
existed. (4) An ordered ladder fallback, borrowed in shape from the old
Party.js handleKiting which always produced some move where the scored sampler
could produce none; corrected to stop at +-120 degrees rather than its +-180,
which aimed into what it was fleeing, and to retry shorter steps. (5) `if
(!found) return true` became `return false`. It claimed the tick was handled
while moving nothing AND suppressed the walkInCircle fallback at the call
site, which is consistent with him sitting at 10 units for seconds. A gated
pathfinder last resort runs first: xmove falls back to smart_move for walls,
but the scored pass never reached it because every candidate is pre-filtered
through can_move_to, and smart_move is blind to monsters so it only fires
below courage. (6) Disengage mode (reason 4) abandons the band entirely once
attackers reach character.courage, and smart.moving no longer vetoes kiting
outright - a crowd cancels the path instead. Verified with a stub harness over
live G.monsters replaying the recorded pack geometry: the old pick is vetoed,
the new one leaves sideways, step retry uses 15 where 30 was walled, and the
ladder escapes a narrow corridor.

## v58

Kiting is enabled and no longer bscorpion-only, and scare counts attackers
instead of detecting one. Four parts. (1) rangedKiting.enabled was false and
targets was ['bscorpion'], so the engine - 90 sample angles, throttling,
weighting - had never run against anything else. It is on, and
kiteCandidateTypes() adds any monster we outrun by speedRatio 1.3 on top of
the hand-tuned list, which stays authoritative. (2) The hold band is derived
per target by kiteBand() from kiteThreatRadius() + rangeBuffer instead of the
fixed 155/170, and that radius is max(range, widest aura) because bscorpion's
danger is weakness_aura at radius 100, NOT its 32 attack range - deriving from
range alone would have moved the hold from 155 to 52 and parked him inside the
aura. bscorpion therefore keeps its measured numbers as an explicit override,
optimalDistance 170 above his 160 range included, which is an avoid rather
than a kite-and-shoot. (3) cfg.maxDistance was null, so `dist >
cfg.maxDistance` coerced to `dist > 0`: reason 2 fired on every tick reason 1
did not, repositionThreshold was unreachable dead config, and the `nd >
maxDistance` penalty scored every candidate -1000 alike. The per-target band
makes all three behave as designed. (4) scare() fired when any ONE monster had
held aggro for 250ms, so the 5s cooldown was routinely already spent when it
mattered; it now counts attackers and fires at character.courage. Measured
2026-09-26 at cgoo: the party took 294 hits, FatherToken 190 of them, and all
three died - a feared character stops acting, and for the healer that means it
stops healing. Also: the kiting branch sat as an `else if` above
walkInCircle(), so enabling it would have retired circle-walking entirely and
left him standing still wherever nothing was kite-worthy; it is chained now.
Verified with a stub harness over live G.monsters - every derived band starts
outside the target's threat radius, and monsters we cannot outrun or outrange
are refused.

## v57

The inventory sorter is gone. It pinned
tracker/ancientcomputer/hpot1/mpot1/xptome/pumpkinspice/xpbooster to slots 0-6
from maintenanceLoop, which runs every TICK_RATE.maintenance = 2000ms, and
swap() is an EXCHANGE - so it did not merely hold those items in place, it
evicted whatever the operator dragged into one of those slots. Measured
2026-09-26: forcing the tracker from slot 0 to slot 8 landed at +500ms and was
reverted by +1000ms, which is why manual dragging had become impossible rather
than merely awkward. It only started biting today, because v56 fixed the dead
'tracktrix' spelling to 'tracker' AND a tracker was acquired the same hour, so
slot 0 was defended for the first time ever. Nothing depends on the slots it
was maintaining: there is not one numeric index into character.items anywhere
in this file, every lookup is by name, and MageofOz has run without a sorter
the whole time. The potion path is unaffected in practice -
use_skill('use_hp') resolves to use('hp'), which scans items from the LAST
slot BACKWARDS and drinks the first gives match, and measured the same day the
only hp/mp-giving items in the bag are hpot1 and mpot1 themselves, so there is
nothing to mis-pick. Note the pins were the WORSE arrangement for that scan:
slots 2 and 3 are scanned last, so a second hp/mp consumable would have taken
priority over the potions, not the other way round. The tracker is still safe
without the pin - neverSell and muling.excludeItems protect it, which is what
v56 was actually for. Slot order is now the operator's to arrange by hand.

## v56

Tracktrix is now actually protected, which it was not before. The item's NAME
is tracker - Tracktrix is only its display label, G.items.tracker.name - and
there is no tracktrix key in G.items at all. Measured 2026-09-25. So the
'tracktrix' string that had been sitting in inventoryRelief.neverSell could
never match item.name and protected nothing, and the same typo in
inventorySorter's slot map meant the item was never pinned to slot 0 either.
Priest.js already spelled it correctly as tracker: 0, and that disagreement
between the two files is what the typo was hiding behind. This was not
theoretical: reliefSellable() sorts candidates by NPC value ASCENDING and
sells the cheapest first, and a tracker vendors for SEVEN GOLD - it would have
been the first thing off the pack the next time the bag filled with no mule in
reach. It was also missing from muling.excludeItems in every spelling, so
clearInventory() was handing it to Meltymerch on sight. Protected now on the
same footing as tier-1 potions: not sold, not muled, pinned to slot 0. It is
the item that records achievements for bonus stats, so its value is in holding
it, never in what it fetches.

## v55

Giga Crab is now joined, and his contribution is logged for later review.
Three parts. (1) getDynamicEvents() injects crabxx when parent.S.crabxx.live,
with join: true - G.events.crabxx carries join: true and duration 2400 as a
daily, so arrival is an event join rather than a walk, and handleEvents()
already emits the join for any entry with that flag. There is no static
monster pack for crabxx, so the smart_move G.monsters fallback would have
found nothing and silently done nothing. (2) shouldAttackMob ignores crabx
while crabxx is live. Measured 2026-09-25: a crabx hits for 189 after
mitigation against a 4,621 HP pool - 24 hits - and the boss spawns 1,000 of
them, so volume is what kills a ranger here. The boss itself hits for 12,572,
2.7x the whole pool, so there is no posture in which he trades with it; he
stands outside its 45 range with his 160 and contributes damage, which is what
cooperative credit pays on. ignoreAddsDuringCrabxx turns this off. (3) A
contribution log in CODE storage, so it survives the change_server reload
exactly as the chest map now does. Damage comes from the game's own hit events
filtered to our own id against a crabxx target, not inferred from attack
calls, so only landed hits count. Writes are batched to one per 10s rather
than one per hit. Query it any day with crabxxReport(). Left deliberately
unanswered for now: whether to generalise the dragold cross-shard hunter to
this boss. At ~491 effective DPS into 960,000 HP behind armor 320 and
phresistance 30, and with other players finishing it well inside the 40-minute
window, the value of hopping depends on damage actually landed - which is the
number this log exists to produce.

## v54

Chest looting was stalled, not slow. updateChestsInStorage() stamped every
chest with performance.now(), which is measured from PAGE LOAD and resets to
~0 on every reload, while the chest map persists in CODE storage. So after any
hop or redeploy each stored chest carried a stamp from the previous session's
clock, now - storedAt went NEGATIVE, the < delay test passed, and the entry
was skipped forever - and never removed either, since removal only happened
after a successful loot. Measured 2026-09-25 on Dexon: 9,342 of 9,465 stored
chests were stamped in the future and permanently unlootable while ~5,500
chests sat within 800 units, nearest 3 units away. Now Date.now(), which
survives a reload. A negative age means a stamp from another clock - legacy
performance.now() values read as 1970 - and is treated as ready rather than
stranded, so this class of bug cannot recur silently. Two further defects
fixed in the same pass: the try wrapped the WHOLE loop, so one loot() throw
aborted every remaining chest and left the offender at the head of the map for
the next pass to abort on again; and removeChestId() re-read and re-wrote the
entire map per chest, O(n) each and O(n^2) across a backlog this size, which
would wedge the tab during a drain. Removals are now batched into one write
per pass, and maxPerPass bounds the drain rate. Looting costs no exp: loot is
not a skill, shares no cooldown with attack, and runs on its own interval.
Ranger: delayMs 180000 unchanged; added maxPerPass.

## v53

Tier-0 potions are no longer protected. Measured 2026-09-25: the fleet holds
zero hpot0 and zero mpot0 - all four characters and all three bank packs - and
nothing acquires them, since every buy path is hpot1/mpot1 only. The 3,354
hpot0 that had piled up on FatherToken were cleared manually. Protection was
never what kept tier 0 in use anyway: use_skill('use_hp'/'use_mp') resolves to
use('hp'/'mp'), which scans character.items from the LAST slot BACKWARDS
(adventureland_mongodb js/functions.js:4593) and drinks the first item whose
gives matches, so tier is never consulted - slot position alone decides. That
is why the priest's pile sat undrinkable at slot 0 underneath hpot1 at slot 2,
and why unprotecting tier 0 on its own would have muled and vendored it rather
than drawn it down. The stock COUNTS deliberately still read hpot0+hpot1 and
mpot0+mpot1, so a stray tier-0 stack cannot mask an empty tier-1 bag and
suppress a restock. Removed from inventoryRelief.neverSell and
muling.excludeItems.

## v52

Farm scoring now uses the game's own armor curve. mitigated() applied
1-x/(x+900), an approximation that tracks parent.damage_multiplier closely
near armor 100 but diverges badly above 400: at defense 900 it returned x0.500
where the game returns x0.313, overestimating our damage by 60%. 13 of the 86
monsters this scorer ranks sit above 400, so the tankiest mobs were
systematically over-ranked - mrgreen at defense 900 drops 12% and the
armor-900 dummy 37%. damage_multiplier is typeof-guarded rather than assumed,
and its null return for an undefined argument is rejected; the old curve stays
as a fallback that logs once, so a missing helper cannot masquerade as a
correct estimate. No top-10 spot changes today - the top spots are defense 0 -
but the error grows as party DPS rises and high-defense mobs become viable
candidates.

## v51

Loop hang guard. Every loop here is an async function that schedules its next
tick only after its body resolves, so an awaited call that never settles does
not slow the loop down - it ends it, permanently and silently. Throws were
already handled; hangs were not. Measured 2026-09-22 on Dexon: actionLoop 0
iterations in 20s where ~1300 were due, mainLoop dead in the same window
(is_disabled, called every 250ms, not called once). He stood in range of crabs
casting nothing and the party earned 0 xp until the page was reloaded - which
is why a reload 'fixed' it each time. setInterval work (buffs, loot,
keepalives) kept running throughout, so /hub showed a live, idle character.
New noHang() bounds every await that appears directly in a loop body and
rejects on timeout, landing in that loop's existing catch: the tick is lost,
the chain is not. Same intent as travelWatchdog. It logs, throttled - a silent
guard makes 'hung' and 'idle' indistinguishable. Ranger only: handleAttack
fired at mobs it could not reach. top5/top3 were sliced from sortedByHP, which
is every monster on screen sorted by HP descending and NOT range-filtered, and
of six branches only the last checked range. The healthiest mobs on screen are
the ones still at full HP precisely because nobody can reach them, so the aoe
branches shot at those. The clumped guard did not help: it proves some mob is
close, then the shot goes to top3 anyway. Measured: 33 consecutive 3shot casts
at crabs 683-715 units away against a range of 158, 0 xp from all 33. Now
sliced from cache.targets.inRange - same list, same HP order - so every branch
inherits the range check. The single-target fallback also moved from
sortedByHP[0] to inRange[0]: it used to test the healthiest mob on screen and
so attacked nothing at all whenever that one was out of reach.

## v50

DPS meter: the 'hit' listener is now replaced rather than added to. The socket
lives in the game frame and outlives a CODE restart, so every reload added
another - nine on this character after a morning of redeploys. Orphans belong
to destroyed CODE frames where parent is null, and the line reading
parent.party_list sat outside the try, so an orphan threw into socket.io's
emit loop and aborted the listeners behind it. The live handler registers
last, so it never ran and this meter read zero while the rest of the party's
read correctly. Now: remove our own previous handler by reference - not a
blanket removeListener, which would strip the client's own damage-number
rendering - and guard the first line so a surviving orphan returns quietly.
Orphans already on the socket need a page reload; a CODE reload cannot reach
them.

