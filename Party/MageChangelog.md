# Mage.js changelog

MageofOz (Mage) - CODE slot `CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom`

Moved out of the Mage.js header on 2026-10-18, for the reason Merchant.js
was emptied on 2026-09-21: a slot that grows without limit eventually stops
evaluating and says nothing about it. The header had reached 46,046 bytes,
20% of the whole file, and one single line of it was 43,556 characters.
None of that is load-bearing for the script and all of it was costing budget
against the CODE slot ceiling.

The ceiling is NOT a known number - see Party/MerchantChangelog.md, which
records a build 6% past the figure once quoted as the cap evaluating and
running fine. Keeping these files lean is still worth doing; just do not
quote a limit.

Entries below are VERBATIM from the header they replaced. Only the line
wrapping is new - no wording was changed, nothing was summarised, and the
chronological order is unchanged. Newest first.

Prepend new entries here, never to line 2 of Mage.js, and bump the version
on that line in the same commit.

## v83

**ENTERING THE RAGE BOX, ON THE OPERATOR'S RULING** - "that still needs to
happen if enough people show up to share the mummy attacks." Inert until
`CONFIG.bossEvents.rageEntry.enabled` is turned on; the three thresholds are
PROVISIONAL, since nobody has measured a crowded graveyard.

**THE SIGNAL IS NOT A HEADCOUNT AND IT IS NOT attackers-per-character EITHER.**
`rageCrowdSoak()` counts monsters INSIDE a rage rectangle whose `target` is a
name not in our party - the operator's words expressed as the thing they
describe, which also notices a crowd thinning because it is recomputed every
tick. attackers-per-character was the recommendation and it CANNOT gate entry:
parked in the corridor pulling one at a time we have no attackers to count, so
that signal only exists once we are already inside - the decision it was meant
to inform. Other players' aggro is visible from outside and ours is not, so the
gate reads theirs and the RETREAT reads ours.
One premise is unverified and is not this session's to measure: whether
entities deep in the mummy field are in range from the corridor at all (~263
units to the nearest spawn edge). If they are not, `soaked` reads 0, the gate
never opens, and `boxed` distinguishes that from a quiet field.

**ENTERING IS THE LEADER'S CALL AND IS BROADCAST, which is not tidiness.**
Entry is containment coming OFF - `rageCfg().enabled` consults the new
`rageEntryActive`, so `safeMove` falls through to `xmove`, `rageGuard` stops
shoving us out and `ragePullActive` stops pulling. A character that enters
while another does not accepts a destination the other still refuses: the
leader walks into the field, the followers hold at the corridor, and the party
splits with nothing logging a fault. Three characters evaluating one predicate
from three entity views WILL disagree at the margin, so there is one evaluator
and the rest obey a `rageentry` relay message. A follower hearing nothing for
`trustMs` falls OUT, so a leader that stops ticking strands nobody inside.

**THE RETREAT IS EVERY CHARACTER'S OWN AND RUNS BEFORE THE LEADER CHECK.**
Bodies on ME are a fact only I can see. `retreatAtAttackers` is its own number
rather than `courage`, because the file records courage failing as a
whole-party wipe twice.

**THE RETURN RE-CHECK IS THE OPERATOR'S SHAPE AND IT IS FREE HERE.** The rip
edge in `bossTick` already carried `{deaths, wasRip}`; entry is now recomputed
from scratch on the `!character.rip && wasRip` branch, so a crowd that thinned
while we lay there keeps us out. A DEATH IS A TRIGGER, NOT A VERDICT - aggro is
stochastic and one death cannot show a gate was miscalibrated, which is what
`maxDeaths` integrating over samples is for.
The rip edge now records `attackersAtDeath` and `soakAtDeath`, because "died
with 2 on me" and "died with 9 on me" are different stories and these are the
numbers the provisional thresholds should be set from.

## v82

**GRAVEYARD RISING IS HANDLED AS A BOSS EVENT.** Operator's ruling: handled
automatically "similar to goo brawl and at the same rank as horseman". Driving
it through the BOSS-EVENT layer rather than the farm layer is what makes that
free - `shouldHandleEvents()`/`handleEvents()` already own movement, so there
is no queue exemption to carve. v108 had to carve one and that read, at the
time, as evidence the automation was wrong; it was evidence the LAYER was
wrong.

Two table rows, identical in all three scripts because `suite_relay.js`
asserts they are: `BOSS_JOIN_SPOTS.graveyard` at spookytown (255,-1030) and
`BOSS_FIGHT_TYPES.graveyard = ['zombie','ghoul']`.

**(255,-1030) IS THE SERVER'S OWN JOIN SPOT, NOT THE FARM PARK POINT.** Every
row in that table mirrors `node/server.js`'s join handler exactly, and the
handler's own comment on this line reads "Below the graveyard's stairs, out of
the Mummies' reach". It checks out - y -1030 clears the mummy rage rectangle's
-1130 edge by 100 units, and both booboo boxes. The proposal in hand was
(290,-990), the achievement queue's park point in the same corridor; both are
correct places to STAND and only one is where `join` actually puts you, which
is this table's single invariant. The farm point keeps its measured
13-waypoint approach chain, which (255,-1030) does not have.

**THE FIGHT-TYPES ROW IS WHAT MAKES THE EVENT ELIGIBLE AT ALL, which the name
does not say.** `bossCooperative()` reads `bossMonsterTypes()`, so without the
row `graveyard` falls to the `[name]` default, finds no `G.monsters.graveyard`,
answers NOT cooperative, and `bossEligible()` refuses it. The attack list and
the eligibility gate are one table. Pinned by the inverted assertion rather
than by a comment.

**AND THE FOUR ENTRIES ALONE WOULD HAVE SHIPPED AN INERT APPROACH.**
`bossWalkTarget` reads `parent.S[name]` FIRST, and `parent.S.graveyard` carries
x/y 255,-1545 from the first wave - `rules.gargoyle`, the Gargoyle's fixed
spawn - which is INSIDE the mummy rage rectangle. `safeSmartMove` refuses it,
so the hop-sick walk would never arrive, one orange line would log, and nothing
would say why. The guard is DERIVED rather than a graveyard special case: any
event whose published point lands in a rage rectangle gets the join spot
instead, using `rageHit`, the same predicate `safeMove` itself consults.

**IT IS GATED ON CONTAINMENT BEING ON, which is what makes one guard serve the
entry case too.** With `CONFIG.achievements.pull.enabled` off, `safeMove` falls
through to `xmove` and the rectangle stops being a wall - so the walk should
aim at the real Gargoyle position, which is exactly what entering the box
means. Turn containment off and the guard turns itself off with it.

**THE FIRST DRAFT OF THE GUARD FAILED OPEN AND THE SUITE CAUGHT IT.** It wrapped
`rageCfg()` and `rageHit()` in try/catch; `rageCfg` threw in the harness (for a
missing `ragePullShared`), the catch answered "not contained", and the boxed
point was reported as fine. Both are top-level declarations in the same file -
the `ms_to_next_skill is OURS` case - so they are called bare now, and a catch
there could only have swallowed a real fault to return the Form B lie.

## v81

TWO LIVE DEFECTS the operator observed during the 22:00 UTC EU III franky
window, reported by the browser-driven session.

DEFECT A - A FOLLOWER THAT FAILED TO HOP COULD NEVER RETRY. "MageofOz did not
hop with the party I had to do that." The acted-list mark had to be written
BEFORE `change_server`, because nothing after that call runs - so a hop that
threw or no-opped became indistinguishable from one that succeeded,
permanently: the plid is durable in CODE storage and the dedupe refused every
retry. Measured with both followers on EU III: identical last acted plid on
each, the priest's trip starting 12s after that plid's timestamp and the
mage's 100s after it, which is when the operator moved him by hand. One
message, two consumers, one completion - and the one that failed had already
marked it. Throttling was ruled out rather than assumed: 60 ticks in 6s on both
tabs.

THE RECORD IS NOW PENDING FIRST AND ACTED ONLY ON ARRIVAL. A hop that worked
lands on the shard it was ordered to and confirms itself when the new page
evaluates; one that did not leaves a pending entry that retries. That is the
only moment the two are distinguishable, because the success case destroys the
page before it could report anything. Three things bound it, since a retry loop
is worse than a missed hop: `PL_HOP_GRACE_MS` (15s, the leader's own
HOP_RELOAD_GRACE_MS value and reasoning) before a silent navigation is called
failed; `PL_HOP_TRIES_MAX` (3), after which the plid IS marked and the order is
abandoned loudly; and a storage write that fails falls back to marking acted,
because without a durable record the machinery cannot work.
`plHopPendingResolve` runs at module load - so arrival is confirmed before the
backlog that ordered the hop is re-read - and on an interval, so a hop that
never navigated is retried without one.

A BUG IN THAT FIX, FOUND BY ITS OWN TEST RATHER THAN BY READING.
`parent.server_region + parent.server_identifier` with both fields missing is
the STRING "undefinedundefined" - truthy, and unequal to every real shard - so
the `!here` guard never fired and an unreadable shard read as "wrong shard",
retrying a hop that may already have landed. Both halves are now type-checked
before concatenating. The same bare concatenation is still in bossHopFollow's
same-shard guard, where it is benign: there a garbage value simply fails to
match and the guard turns itself off, which that comment already says.

DEFECT B IS PRIEST-ONLY and is recorded here only because
the version moves with Defect A. DEFECT B, PRIEST ONLY - THE ENGAGEMENT RULE WAS ON THE ATTACK PATH AND NOT ON
THE SKILLS. "Fathertoken attacks the boss when no one else has", then the
operator's own correction: "it may have been a skill such as curse". It was.
`findBestTargetInner` has enforced `boss.target` since the rule was written,
but that governs `cache.target`, which drives the attack and nothing else:
  handleCurse       picked any visible BOSS_SET monster, no .target test and no
                    max_distance.
  findZapTargets    was gated the WRONG WAY ROUND - `!e.target` SELECTS for
                    monsters nobody is fighting, and ZAPPER_MOB_SET is built
                    from [...allBosses, "sparkbot"], so the zapper
                    preferentially tagged a boss precisely while it was cold.
Whoever lands the first hit takes the aggro, and a priest tanking a franky is
the worst assignment in the party.

ONE PREDICATE, `bossCold(m)`, now asked by every offensive path. The zapper
splits by kind rather than dropping the test: `!e.target` stays correct for a
FARM mob and is inverted for a boss. The curse loop skips a cold boss WITHOUT
breaking, since the break would shadow the farm-mob fall-through and leave the
priest casting nothing while a zappable mob stood in range.

A FOURTH PATH THE REPORT DID NOT NAME, and the loop alone would not have
covered it: the curse fall-through draws from `[...CONFIG.combat.zapperMobs,
home]`, and zapperMobs is every boss plus sparkbot - so it selected bosses too.
Bosses are now filtered OUT of that list rather than merely refused later,
because the real selector returns the NEAREST of the types asked for, so a cold
boss standing closer than a farm mob won the pick and the cast-site guard then
refused it, meaning no curse at all that tick. `bossCold` is still checked at
the cast as defence in depth for any future path.

focusFireTarget IS LEFT ALONE, DELIBERATELY. It returns the monster the LEADER
is attacking, and `leader.target` on a player entity means they have engaged
it - so the opening hit has already been landed and the follower is joining,
not opening. Gating it would make the priest refuse to help the leader fight a
boss until the boss retaliated. The browser session flagged it as "arguably
benign"; it is benign for that reason, recorded so it is not re-raised.

MAGE IS UNTOUCHED BY B - it has neither curse nor zapper, and its only
use_skill with its own target pick is energize, a party buff. Which is why the
operator saw this on the priest alone.

Suite 553, and a new `Tests/suite_priest.js`. Eight mutations bound: marking
before the hop, the bare concatenation, the grace window, the try cap, the
ungated zapper, the curse loop, the cast guard and the fall-through filter.

## v80

goobrawl's spawn-set mapping is one-to-MANY. `BOSS_FIGHT_TYPE = { goobrawl:
'rgoo' }` named only one of the two monsters the event spawns, and the other
session found it while rewriting section 6 of the chain queue spec.

THE DEFECT WAS AT ONE OF THREE CALL SITES, each checked rather than counted.
`bossApproach` asked `get_nearest_monster({type:'rgoo'})`, which returns null on
a goobrawl showing only bgoo - and because goobrawl is NOT walkable the
fall-through re-emits the join, so the party teleports in, finds nothing it will
posture against, and keeps re-joining beside a live goo. `bossCooperative` was
safe either way (both types are cooperative live) and the status line was
cosmetic.

WHY IT HAD NOT VISIBLY FAILED: the single goobrawl in the bridge's retained log
produced rgoo. Base rate is roughly one observation in ~75 server-windows over
3.17 days, so it could have sat here for weeks. rgoo is also the valuable half -
1,000,000 hp, funtoken at rate 20, the only `open` source - against bgoo at
100,000 hp and 0.25, which is why the mapping pointed at the rarer one.

`bossNearestMonster(name)` takes the NEAREST of any of the event's types rather
than the first found, because on a goobrawl both may be up and posturing against
the far one walks past the near one. Asserted in both orders so the result
cannot come from iteration order. `bossCooperative` now answers true if ANY type
is cooperative: no change today, but reading only the first answers FALSE when G
does not carry it, and false removes the boss from consideration.

NOTHING WAS CHECKING THESE THREE COPIES. The other session believed
`suite_relay`'s divergence check covered it; it names `plSaveCursor`, `plActed`
and `plMarkActed` and nothing else, so three copies could have drifted in
silence. They had not, but nothing would have said so. `suite_relay` now asserts
all four names byte-identical across Ranger, Priest and Mage, and that no
single-valued `BOSS_FIGHT_TYPE` survives in any of them - a surviving copy being
the defect itself.

UNRESOLVED, flagged rather than theorised: `G.events.goobrawl.sprite` is "rgoo",
and sprite is an ICON field. If the original single value came from there it is a
display field read as a spawn-set claim, which is the same shape as the
`never_observable` finding. Nobody knows that it did.

Suite 502. Four mutations bound: narrowing the map back to rgoo, taking
first-found instead of nearest, reading only the first type for cooperative, and
dropping the G guard.

## v79

The PARTY_BUILD marker no longer accumulates, and the comment now names what
the real authority is.

MEASURED 2026-10-19, and it defeats the marker's whole purpose if left alone:
`parent.*` globals OUTLIVE THE SCRIPT THAT PUBLISHED THEM. Engaging a different
slot swaps the running script IMMEDIATELY - no page reload, `code_active` never
goes false, the maincode iframe is replaced in place - and every parent global
stays behind. `parent.MERCHANT_VER` still read 104 while OpenGifts v11 was the
thing executing. That is a confident false positive, which is exactly the
answer a deploy check must never produce, and `parent.PARTY_BUILD` had the same
exposure.

Two changes. The object is now REPLACED WHOLESALE rather than merged into, so a
previous party script's entry cannot survive beside the current one - that makes
a party-to-party swap self-correcting. And each record carries `at`, the publish
time, so a reader comparing it against how long the page has been up can see a
marker that stopped being refreshed.

NEITHER FIXES THE GENERAL CASE, and the comment says so. A swap to a script that
knows nothing about this marker - OpenGifts, anything shared - leaves it behind
untouched, and no amount of cross-clearing fixes that without every script
having to know every other script's marker names, which is the transcription
problem this session has spent its time removing.

SO THE AUTHORITY IS `PARTY_SCRIPT` ITSELF, READ INSIDE THE CODE CONTEXT. None of
these three scripts is IIFE-wrapped - verified, `PARTY_SCRIPT` is the first code
line in each - so it is a top-level const in the live lexical scope, which is
destroyed and rebuilt with the script and therefore cannot go stale.
`browser_code_eval` already runs in that context. The parent global is for a
reader who is NOT in the CODE context, and a disagreement between the two means
the global is wrong.

Suite 317.

Not deployed.


## v78

Publishes which script is running, so a mis-deploy is visible from outside.

MEASURED 2026-10-19 BY THE BROWSER SESSION: Dexon - a RANGER - was running
Party/Mage.js out of the Ranger slot, code_active, 4,219 lines against
Ranger's 7,445. Identified against the committed files rather than by guessing
names: Ranger-only achvScore/achvLoad/achvRefresh all undefined on him,
Mage-only findEnergizeTarget/handleBlinkEscape/muleToMerchant all functions.

A VERSION NUMBER WOULD NOT HAVE CAUGHT IT, and that is what settled the design.
The slot header read v77 - a real, current, valid-looking version, just the
wrong script's - so a version marker would have reported that the deploy took.
Nothing in these three files reached `parent` before this change, which is the
same gap that made v94 and v95 undetectable from outside: both touched only
CONFIG and GEAR_PROGRESSION, so there was nothing to feature-detect.

So each script now publishes the set of functions it actually DEFINES, as
`parent.PARTY_BUILD[<character name>] = { script, features }`. Every value in
the table is a live `typeof` of the identifier beside it, not a claim about it,
so a key whose function is absent is filtered out rather than published. The
three key sets are disjoint, so one read names the script. Keyed by character
name because the Dexon failure is precisely a mismatch between WHO and WHAT.

Mage publishes: findEnergizeTarget, handleEnergize, handleMagiport, handleBlinkEscape, muleToMerchant.

SCOPE. This answers WHICH SCRIPT, not WHICH VERSION - the list grows as
features land, so a missing key means "older build, or nobody added the key"
and those are not distinguishable. Version stays with feature-detecting the
specific function a build introduced. DELIBERATELY NO SLOT-HEADER VERSION READ
here, unlike Merchant v104: that reports what is in the SLOT, not what is
executing, and under the load_code cache those differ - a stale build would
read the new slot and report a successful deploy, which is the one answer a
deploy check must never get wrong. Merchant can carry it because it REPLACED
two already-rotting constants and publishes its probe API beside it; here it
would be net-new and the only signal. The slot buffer is readable directly
from a tab in any case.

The list is written by hand, so `Tests/suite_features.js` closes the one way it
can lie: every key must resolve to a declaration in that same lifted source,
every key must be typeof'd against ITSELF (`foo: typeof bar` would publish foo
on the strength of bar), the three sets must stay disjoint, and the block must
stay identical across the three - the same divergence guard the relay block and
bossHopFollow carry, added because the v94 strand shipped to Ranger alone and
stranded the followers. All five checks were mutation-tested: each was broken
on purpose and each failed the run. Suite green at 289.

CONSEQUENCE WORTH RECORDING: bossRank is declared only in Party/Ranger.js, so
with Dexon on Mage v77 the operator's boss ranking has been live on nobody.
Any earlier claim that the ranking was deployed and verified was wrong.

Not deployed. Dexon needs Ranger v78 and is currently running the wrong
script entirely.


## v77

Port the v94 taxi walk to the followers - it was leader-only.

**NOT DEPLOYED.** Live slots run v91/v52/v75 as of the last confirmed deploy,
so this is a PRE-DEPLOY catch rather than a live incident - but it would have
become one the moment Ranger v94 or v95 was deployed without the followers.

**v94 shipped the walk to the leader alone.** `bossTaxiWalkable` and the
bossApproach fall-through went into `Party/Ranger.js` and nowhere else; Priest
and Mage kept the pre-v94 unconditional bail, comment and all: `if
(character.s && character.s.hopsickness) { bossNote('hopsick - cannot join ' +
name + ' yet'); return; }`

**IT STRANDS THEM, IT DOES NOT MERELY DELAY THEM, AND COHESION CANNOT COVER
IT.** The follower main loop reads `if (shouldHandleEvents()) {
handleEvents(); } else if (CONFIG.movement.enabled) { ... holdCohesion() ...
}`, and `shouldHandleEvents()` is `holidaySpirit || !!bossPick() ||
!!bossState.trip`. Once the leader's broadcast sets `bossState.trip` it stays
true, the event path owns movement, and holdCohesion sits in the `else` where
it never runs. bossApproach then declines to move. The follower is pinned
where it landed for up to `maxTripMs` while the leader walks to the boss.

**That is a failure this repo has already had twice**, reached a third way.
Priest.js:2327 records centralising the DECISION after "crabxx was in the
ranger's list alone - he joined it while the other two kept farming, boss-side
with no healer". v94 centralised nothing and diverged on whether the target is
REACHABLE, which produces the same outcome. CLAUDE.md records losing Dexon on
2026-10-17 to the older form of it. Dexon solo is 2605 dps against franky's
120,000,000 hp and 2910 magical attack - he cannot finish it and takes
sustained damage with no priest.

**The branch is now BYTE-IDENTICAL in all three files**, 1,949 bytes, md5
e4409f5208b7, and so are `bossTaxiWalkable` and `BOSS_JOIN_SPOTS`. Identity
rather than equivalence is deliberate: it is what lets a suite assert it. The
one genuinely leader-only line, the walk-in-sick probe, is typeof-guarded
rather than omitted, so the followers run the same text and simply do not
declare `taxiProbeNote`.

**THE TEST THAT SHOULD HAVE CAUGHT IT NOW EXISTS**, in `suite_relay.js` rather
than `suite_bosshop.js` - every assertion in the latter is about Ranger, so
nothing there could ever have seen this. It asserts the branch is identical
across the three, that none of them carries an unconditional hopsick bail,
that each gates it on `bossTaxiWalkable`, and that the predicate and its table
are the same function and the same table. Verified to FAIL on the pre-fix tree
- reverting Priest alone produces three failures - rather than only to pass on
the fixed one.

**Credit where it is due:** the browser session found this live and proposed
exactly this test, naming bossApproach as belonging in the same divergence set
as the relay block and bossHopFollow. That framing is right and is why the
assertion went where it did.

## v76

Review round: the same-shard guard no longer fails silently.

**NOT DEPLOYED.** The live slots were loaded with v91/v52/v75 at ~14:56 on
2026-10-18 and confirmed running by feature detection. This is the review
round on top of that; repo HEAD is ahead of all three until the operator
pushes again.

Two findings from the browser session's review of the reload-loop fix. Neither
is a behaviour change on the path that was broken.

**The same-shard guard's catch was silent.** `try { here =
parent.server_region + parent.server_identifier; } catch (e) { }` - if that
throws, `here` stays null, the guard never fires, and nothing says so. It was
the only silent catch in bossHopFollow while plActed and plMarkActed both
logged theirs, which is exactly the antipattern this repo's own rule names: a
catch that returns a default must log, or "the helper is missing" and "the
default is correct" stay indistinguishable. Now logs, and says in the message
that the acted-list still applies, so the line reads as a degraded layer
rather than a failure.

**The `parent.` prefix is load-bearing and now says so.** Measured live
2026-10-18 by the browser session: bare `server_region` is UNDEFINED in the
CODE context and only the parent-window form resolves. Anyone tidying the
prefix away would disable the guard with nothing visible changing. Recorded in
the comment above the read for that reason.

Also confirmed live in the same review, and the reason neither finding is
urgent: CODE storage round-trips a real Array through the game's own
`set`/`get` - `isArray` true, `push` and `indexOf` both functions - so
plMarkActed's `(get(k) || []).push(...)` works against the real API and not
only against a harness stub. `get('pl_acted')` is null before first use, which
`|| []` handles.

bossHopFollow stays byte-identical between the two files: 2,228 bytes, md5
1c53a7a2c5cf41090876825cbb7e278f.

## v75

The follower reload loop: a hop replays the message that caused it.

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

**Same-shard guard.** bossHopFollow now refuses a hop to the shard it is
standing on. That is a pure page reload, and the reload is what re-reads the
backlog that sent it - the message becomes its own cause. This is the exact
shape the operator saw.

The guard is NOT sufficient alone, which is why part 3 exists: a replayed
boss_hop naming a DIFFERENT shard clears it, reloads, and the party bounces
between shards instead of reloading in place. The same loop wearing movement.

**The follower's own log line was dead code.** It sat after change_server, so
it never printed - which is why the console looked empty while this was
happening. Moved above the call, along with the acted-list write, for the same
reason the leader sends boss_hop before hopping: nothing after that call runs.

The function stays byte-identical between Priest.js and Mage.js: 1,814 bytes,
md5 e4e16c58c3a26a9f382c789fe40d7883. Only the -> <Name>Comments.md pointer in
the doc comment above it differs, as it must.

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

## v74

One addition to the console-command header.

**CONSOLE COMMANDS header.** The existing eight are unchanged. Derived with an
AST walk - top-level functions with zero bare, zero dotted and zero
string-literal references, excluding on_* handlers - not from a list.

A SECOND, SEPARATELY LABELLED GROUP lists 1 more: functions an operator can
also type, but which HAVE internal callers, so a dead-code scan would never
flag them. They are reference, not protection, and the split keeps visible
which names would actually be at risk if their caller disappeared. The
operator's call, 2026-10-18: the header is an operator reference, not a scan
shield.


## v73

A TOGGLES block and a console-command header. Additive only - no read site
changed and no behaviour changed.

**TOGGLES.** Every on/off switch in CONFIG, 23 of them, collected into one
`const TOGGLES` immediately before `const CONFIG`, with CONFIG referencing
each one. The value still lives at its original CONFIG path, so `cfg.enabled`
after `const cfg = CONFIG.support.energize` (line 735) resolves exactly as
before and a runtime assignment to a CONFIG path still wins. The diff touches
only the inserted block and the value positions inside the CONFIG literal;
every function body is untouched, which is the check that proves it is
additive.

Keys are namespaced because `enabled` appears 13 times in this file, once per
subsystem: `<subsystem>` for an `enabled`, `<subsystem><Key>` for anything
else, so `movement.kiting.debug` becomes `kitingDebug`. Each line carries its
CONFIG path as a comment.

The values were replaced by AST offset rather than by line, because several
CONFIG lines carry two booleans at once - `focusFire.enabled` and
`requireInRange` share a line, as do `cohesion.enabled` and `cohesion.debug` -
and a line-based edit would have taken both or neither.

RUNTIME CAVEAT, also in the block's own comment: the value is copied when
CONFIG is constructed, so assigning to TOGGLES at runtime does NOT propagate.
Editing the file and reloading does.

NOT swept up: booleans that are not operator switches. `show` on the log-panel
tabs, `ok` on result objects, `childList` on a MutationObserver,
`PARTY_LINK.verbose`, and the runtime state fields (`busy`, `rip`, `inFlight`,
`restocking`, `skinReady`, `waitingForMerchant`, `arrivedAtSpot`,
`reportedUnreachable`). A boolean at config indent inside a function is a data
field, not a switch.

**CONSOLE COMMANDS header.** 8 commands listed in the opening comment with
their signatures, under the note that they have no internal callers BY DESIGN
and that a static scan will call every one of them dead. Derived with an AST
walk - top-level functions with zero bare, zero dotted and zero string-literal
references, excluding `on_*` handlers - not from a list. The same derivation
reproduces Merchant.js's hand-written header exactly, all twelve names, which
is what validates the method.
## v72

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-18. Dead code only, 31 lines, no
behaviour change. Deleted: getDynamicEvents (4 - live in Ranger, dead here);
locations (10) with its now-empty LOCATION DATA banner; kitePathBlocked (8);
and three unread config keys, looting.lootSet, looting.chestThreshold and
temporal.orbName. On orbName: it was briefly suspected of meaning this file
uses the temporal skill without checking for the orb. It does not. L3227
checks with a hardcoded 'orboftemporal' literal and only the key went unread,
which is exactly what Ranger's now-deleted copy did too - a cosmetic duplicate
in both, never a bug. If the findIndex should read the key instead, that is a
separate one-liner and was deliberately not folded in here. Mage's Temporal
Surge is LIVE and untouched; it is Ranger's copy that was removed this round.
Two comments reworded rather than cut, as in Priest: the destination note and
shouldHandleEvents' history both named code this commit deleted.

## v71

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-17. The follower half of the
cross-shard hop, generalised with Ranger v84. dragold_hop becomes boss_hop and
the inline handler is extracted into bossHopFollow(data), which is
BYTE-IDENTICAL in Priest.js and Mage.js - same invariant the MONSTER HUNT
follower half already carries, and verified at 2,015 bytes in both. The
enclosing guards stay as they were, since the two files differ there: Priest's
sits inside the existing if (name == "Dexon") block and Mage's carries its own
name check. Dexon runs the scanner and decides alone; three independent
pickers reading slightly different server_info snapshots would scatter the
party across three shards, and a split party earns the 1.00 solo multiplier
instead of 1.30. The new shard and mtype fields are additive - region and name
are sent exactly as before - so an older build on the other side of the relay
degrades to a hop with a vaguer log line rather than to a failure. A message
with no destination is now logged and ignored instead of calling
change_server(undefined, undefined).

## v70

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

## v69

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
ENABLED, ready to paste and watch. Ranger v79 carries these plus the release
valve; Priest v46 is identical to this

## v68

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
gets tested, and the party has not reached it yet. Ranger v78 and Priest v45
carry the identical fixes

## v67

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
geometry. Ranger v77 carries the achievement wiring; this file has the safety
half

## v66

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
its size is unverified from here. Ranger v76 and Priest v43 carry the
identical change

## v65

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
quietly and costs nothing. NOT CHANGED here either: this file's autoBuyPotions
still plSends low_potions to Meltymerch with no cooldown and no reach gate,
where Ranger.js routes the same request through askForPotions, which has both.
That is a separate defect - a bridge message every 2s while stock is under 500
- and it is left for its own change rather than folded in here. Ranger v73 and
Priest v42 carry the identical change

## v64

Blacklist false positives, three causes. Arrival is now a RANGE
(TRAVEL.arrivalRadius 200) because kiting preempts smart_move and the
rejection was counted as a failed route against a spot we were standing on.
Unreachable is never reported while get_nearest_monster({type:home}) is in
range. The xp clock re-baselines off the farm map, so boss and vendor trips
stop reading as net-negative xp. Travel now outranks cohesion in the movement
chain, and holdCohesion stands down when the leader is not in the centroid -
the two followers were homing on each other and never pathfinding

## v63

Slenderman excluded from the boss rotation. His spawn broadcast is the only
one in the game carrying no x/y - server_functions.js sends { name, map }
where every other boss also sends x and y - so bossWalkTarget() returns null
and the trip latched open to the 20 min maxTripMs cap. Measured 2026-10-04:
this character picked the trip up via fromLeader within 56ms of Dexon opening
it, and stood in winterland for the duration. He cannot be chased either:
event_loop warps him to a random walkable node on a random one of
cave/halloween/spookytown every second that a non-invisible player is within
600 units, on any projectile targeting him, or every 2 minutes regardless.
Only s.invis suppresses the proximity check, and step_out_of_invis() sits in
the shared attack path, so even a rogue drops invis on its first swing. NO
opportunistic attack path here, unlike Ranger.js, and deliberately so:
reflection:96 is gated on defense == 'resistance' (server.js:3682), i.e.
MAGICAL damage only, so this character would reflect 96% of every cast back
into their own face. Physical classes only. maxTripMs already enforced a hard
20 min expiry, so nothing was changed there

## v62

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
kills. Follower half, byte-identical to the block in Priest.js. The followers
reach Daisy on mh_accept and mh_turnin and run the same travelTo, so the race
is the same one

## v61

Cohesion no longer spams an impossible move. holdCohesion() nudges with xmove,
a straight line, and when that line ran into a wall it retried the IDENTICAL
unreachable destination for as long as the character stayed wedged. MEASURED
2026-10-04 on DESERTLAND: MageofOz stuck at (218,-1830), five xmove calls in
25 seconds, every one to (274,-1936), can_move_to() FALSE on all five, four
rejections, ONE distinct position across the window and zero net drift;
FatherToken stuck at (373,-2121) was the worse of the two at 14 calls in
25.6s, all 14 to (316,-2015), all unreachable, all rejected; a separate
20-second window caught 32 move emits at 1.6/s from MageofOz, in pairs 70ms
apart with identical coordinates. WHAT PUT THEM THERE, which is why the
terrain handoff is a repair and not a mute button: Dexon was on MAIN at
(-87,673), 2,522 units and one map away, and v57's map check correctly drops
an off-map member from the centroid - leaving each follower with only THE
OTHER FOLLOWER to cohere to, 330 units apart, inside the 400 handoff, so the
distance escalation never fired. They were homing on each other with nothing
left that could walk them back, and handleReturnHome() is the only path that
leaves the map. A character standing still while repeating the same impossible
request every three seconds is a botting signature, which is why this was
treated as urgent rather than as kiting noise. Three defects, all here. (1)
can_move_to() was never consulted even though it answers the question locally
before anything reaches the socket; it is now, across a spread of seven
bearings, since being walled off dead ahead says nothing about the approaches
either side. (2) The xmove rejection ESCAPED the function, and mainLoop awaits
this inside noHang(holdCohesion()), so each throw lost the whole mainLoop tick
- kiting and everything below it skipped - every three seconds. It is caught
now, logged unthrottled, and returns false. (3) v57 built the escalation to
the pathfinder and wired it only to DISTANCE; terrain gets the same handoff
now, so a character walled off in every direction hands the trip to
handleReturnHome() instead of retrying forever. false rather than true is
v57's lesson restated: true means movement handled and hides the one path that
pathfinds, counts failures and arms travelWatchdog. Diagnosed by
instrumentation, and the first theory was WRONG - travelTo being interrupted
by cohesion looked like the cause until travelState.inFlight was sampled and
found false for 100% of a 30-second window, with all 10 smart_move calls
coming from holdCohesion and all 10 failing. A guard on inFlight would have
fired zero times. Verified with a 46-case node harness over the extracted
function. Byte-identical to the block in Priest.js

## v60

Monster Hunt follower half, byte-identical to the block in Priest.js. Purely
message-driven with no triggers of its own, so it is inert until Ranger.js
ships - a follower deployed alone cannot accept a hunt and so cannot burn a
roll onto a 30-minute clock nobody is watching. It exists because accepting
and turning in are emits on THIS character's socket and
character.s.monsterhunt is readable only here: a party-member payload carries
no 's' field at all (measured 2026-10-03), so Dexon cannot see our target and
we report it. The block deliberately avoids updateHomeDependentSets(), which
Priest.js has and this file does not

## v59

Cooperative bosses are engaged only once somebody else is on them, and six of
them were not recognised as bosses at all. findBestTarget's boss branch took
any BOSS_SET member in range UNCONDITIONALLY, which is the opposite failure
from Ranger v64: there the gate was so strict the boss was never shot at, here
there was no gate. It is `boss.target` now, mirroring the ranger's
attackIfTargeted, which resolves to the same mob.target != null - credit on a
cooperative boss is shared by damage dealt, so joining a fight in progress
pays and opening one alone does not. BOSS_SET also gains pinkgoo, rharpy,
rimedjinn, slenderman, snowman and tiger, derived from
G.monsters[x].cooperative on 2026-10-02: 19 cooperative monsters exist and
allBosses names 13. allBosses itself is deliberately NOT widened - it also
feeds manaBurst.targets, and Mana Burst dumps the entire mp pool, so widening
what it fires at is not a side effect to take casually - so that stays a
separate decision. Why only Dexon stalled at the snowman on 2026-10-02 and
these two did not: they attack from actionLoop, which carries no type filter,
so handleEvents() diverting mainLoop to the boss trip never stops them.
focusFireTarget() above already copies Dexon's target when he has one, so
following the leader was always covered; this governs only what happens before
he opens. Consequence, and it is the stated rule rather than an oversight: a
boss nobody else has touched is now attacked by nobody, so such a trip ends on
the maxTripMs cap having dealt no damage. findNearestBoss/cache.nearestBoss is
left ungated - it only drives bossLuckSwitch equipment swapping, not
attacking. rimedjinn is in the set but has range 200 against this party's
165/197/201, so only MageofOz can outrange it; a candidate for
CONFIG.bossEvents.exclude rather than something this change addresses.

## v58

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
follower precedence, and the persisted trip. CORRECTION to the v57 entry that
follows: it says NOT DEPLOYED as of 2026-09-29, and that is stale - measured
2026-09-30 in MageofOz's live CODE context, typeof unstickWatchdog is
"function" and CONFIG.party.cohesion.handoff is 400, so v57 IS deployed.

## v57

NOT DEPLOYED TO THE LIVE SLOT as of 2026-09-29. The followers could strand
themselves permanently, and the function meant to prevent it was the thing
preventing the cure. MEASURED on MageofOz, wedged at (-336,1007) on main: 995
units from his own destination, 953 from Dexon, ZERO position change across 55
consecutive one-second samples, smart {moving:true, searching:true,
found:false, plot:0}, travelState.inFlight FALSE, failures 1, lastError "still
no route after town(): interrupted", and the last travel attempt started 2,567
seconds - 43 minutes - earlier. Dexon appeared in parent.entities on 0 of
those 55 samples. Three defects that only bite together. (1) holdCohesion()
returns true whenever the worst gap exceeds leash 150, and mainLoop reads a
true as 'movement handled', so handleReturnHome() - the only path that
pathfinds, counts failures and arms travelWatchdog - was never reached. The
further out he drifted, the more certain it became that the one function able
to fetch him would not run. (2) Its move is xmove, a straight line, which over
that distance stops at the first wall AND interrupts any smart_move already in
flight; lastError is that interruption, recorded in the file. So cohesion was
not merely failing to help, it was cancelling the rescue. (3) It read member
positions from parent.entities, which holds only what is ON SCREEN - so the
member we have drifted away from is exactly the one that disappears from it,
and the leader left the centroid at the moment cohesion existed to close on
him. Both followers were left homing on each other: their worst gap of 480
units was the distance to EACH OTHER, not to Dexon. Fixes: positions now fall
back to parent.party, which carries x/y/map for every member regardless of
visibility (verified present live); past cohesion.handoff (400) the function
stops nudging and calls handleReturnHome() so the pathfinder owns the trip;
and unstickWatchdog() clears a wedged smart_move. That last one is not covered
by travelWatchdog, which only orphans an attempt while inFlight is true - it
was false here - and it matters because handleReturnHome() itself returns
early while smart.moving is true, so the wedge blocked its own repair. Not
diagnosed from reading: a one-second sampler over 55-60 samples on both
followers is what separated 'cohesion never fires' (false - it fired on every
sample) from 'cohesion fires and the move does not land' (true).

## v56

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
field, which is what nine simultaneous attackers looks like. Mage changes,
mirroring Priest. holdCohesion() at leash 150: he cannot heal himself, so
staying inside FatherToken's 197 range is what keeps him alive, and he died on
2026-09-26 bleeding 1,995 to 0 against ONE attacker with nobody in range to
heal him. focusFireTarget() first in findBestTarget. kitePathPenalty replaces
the veto in the scored pass. Verified with a stub harness: the penalty finds a
move in the surround geometry where the veto found none, focus fire refuses
out-of-range and dead leader targets and never fires for the leader itself,
and cohesion is a no-op inside the leash and shrinks the worst-case distance
from the measured 403-unit case.

## v55

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
minutes. Ported the same six changes as Ranger.js, since his kiter was copied
from it: whole-field direction scoring for retreat and disengage, route veto,
step-length retry, ordered ladder, honest `return false` with a courage-gated
pathfinder ahead of it, and disengage mode. He is the clearest beneficiary of
the band work so far - attackers capped at 1 and never once feared in 308
samples - and the clearest victim of the direction bug, since he died to a
single cgoo while parked 100 units inside his own hold distance.

## v54

Kiting added - there was none at all. blinkOnLowHp at 25% hp was his only
answer to being hit, which at the rate measured at cgoo on 2026-09-26 is about
a second and a half of warning, and he died there with 400 hp left on the
clock. rangedKite() is ported from Ranger.js so all three files hold distance
identically, on the same kiteThreatRadius/kiteCandidateTypes/kiteBand helpers.
targets is deliberately EMPTY: Ranger and Priest each carry a hand-tuned
bscorpion entry with measured distances and inventing one for the mage would
be guessing, while the speed predicate picks bscorpion up anyway (speed 24
against his 64) and derives the hold from its weakness_aura radius 100 rather
than its 32 attack range. He has the longest range in the party at 201, so his
derived holds are the safest of the three. Attacks run in actionLoop and
movement in mainLoop, and a ranged character attacks while moving, so this
costs no attack uptime - which is what makes it free under the standing rule
that the safer option wins unless it costs exp/hr. Chained ahead of
walkInCircle() rather than replacing it.

## v53

Tracktrix is no longer muled away. The item's name is tracker - Tracktrix is
only its display label, and G.items has no tracktrix key at all. It was absent
from muling.excludeItems, so clearInventory() handed it to Dexon and on to
Meltymerch, who vendors at seven gold. This file has no sorter and an empty
sell whitelist, so muling was the only exposure here. Protected now on the
same footing as tier-1 potions.

## v52

Chest looting was stalled, not slow. The chest map persists in CODE storage
but was stamped with performance.now(), which restarts at ~0 on every page
load, so after any hop or redeploy the stored stamps came from a dead clock,
now - storedAt went NEGATIVE, the wait test passed forever, and entries were
never looted nor removed. Measured 2026-09-25 on Dexon: 9,342 of 9,465 stored
chests stamped in the future while ~5,500 chests sat within 800 units, nearest
3 away. Now Date.now(); a negative age is treated as ready rather than
stranded. Also batched the map removal into one write per pass -
removeChestId() rewrote the whole map per chest, O(n^2) over a backlog this
size - and bounded each pass with maxPerPass. Looting costs no exp: loot is
not a skill and shares no cooldown with attack. Mage: same fix as Ranger v54.

## v51

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
suppress a restock. Removed from muling.excludeItems.

## v50

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
guard makes 'hung' and 'idle' indistinguishable.

## v49

party frames brought in line with Dexon's: the block left-aligns on the left
edge of the code-button row, re-measured every render rather than cached,
which is where Dexon's R&M sits and where this character's kpm button lands
once something dies - anchoring on the kpm text itself left the frames
unanchored, and a thousand pixels wide off the right edge, between a reload
and the first kill - measured by accumulating offsetLeft rather than
getBoundingClientRect, since the UI is scaled 0.7502 and rects are device
pixels while left/width are CSS pixels. The row is sized with max-content plus
nowrap so no member count can wrap it, the merchant gets no frame (excluded by
class, not name), the xp rate drops its XP/HR label and carries its own unit,
and time-to-next-level moves to its own row. Also the DPS 'hit' listener is
replaced rather than added to, with a guard so an orphan from a destroyed CODE
frame cannot throw into socket.io's emit loop and abort the listeners behind
it. Game log filter brought up to Dexon's: tabs wrap onto rows of four instead
of being squeezed into one line, 'Upgr.' is written out as 'Upgrades', and a
Noise tab (off by default) collects 'get closer', achievement-progress AP[...]
lines and the courage messages. The filter rule is now one shouldShowEntry()
shared by all three callers, and a MutationObserver watches #gamelog so
entries the client writes through add_log - which never pass through
addLogEntry, and which is how 'Get closer' was slipping past - are filtered on
arrival rather than only when a tab is toggled.

