# Priest.js changelog

FatherToken (Priest) - CODE slot `CH_hae5t3g8gBezOVTdR6ToTagikbTbF`

Moved out of the Priest.js header on 2026-10-18, for the reason Merchant.js
was emptied on 2026-09-21: a slot that grows without limit eventually stops
evaluating and says nothing about it. The header had reached 46,011 bytes,
18% of the whole file, and one single line of it was 43,516 characters.
None of that is load-bearing for the script and all of it was costing budget
against the CODE slot ceiling.

The ceiling is NOT a known number - see Party/MerchantChangelog.md, which
records a build 6% past the figure once quoted as the cap evaluating and
running fine. Keeping these files lean is still worth doing; just do not
quote a limit.

Entries below are VERBATIM from the header they replaced. Only the line
wrapping is new - no wording was changed, nothing was summarised, and the
chronological order is unchanged. Newest first.

Prepend new entries here, never to line 2 of Priest.js, and bump the version
on that line in the same commit.

## v76

**A BUY IS SENT ONLY WHERE THAT ITEM'S VENDOR IS IN REACH.** The browser
session caught the "Get closer" spam live on 2026-10-24: they are buy refusals,
not attacks. The server answers a buy only from a vendor of that exact item on
the buyer's own map within `B.sell_dist` (400, the "buy" handler in
`node/server.js`). `vendorInReach(name)` asks that question of live `G`
with a 380 margin, and `buyWhereSold(name, qty, why)` buys only when it says
yes. When it says no, it logs the shortfall once per item per half hour, for
callers that pass a reason. It is byte-identical in all three scripts.

`buyMissingPotions()` goes through it. While dead with `respawn()` refused on
cooldown, the post-respawn top-up used to send two refused buys every
maintenance tick: Dexon's pairs. The merchant's delivery and the restock trip
remain the supply away from a vendor; the restock trip calls this only once
`atPotionVendor()` (200) holds, which is inside 380, so it is unchanged.
`Tests/suite_bosshop.js` counts the bare `buy()` calls in each file, comments
stripped, and fails at a fourth.

**FATHERTOKEN'S LUCK ELIXIR.** `elixirUsage()` bought `elixirluck` every
maintenance tick wherever he stood, and only Warin (`wbartender`, winter_inn)
sells it. That was 29 refusals a minute. He now logs that he wants it, and
the refusals stop. He has none in his bag and none worn (`elixirluck` 0,
`slots.elixir` null), so he still goes without until someone brings him one:
the operator, or a merchant delivery if that is wanted. Nothing builds that yet.

## v75

**THE LEADER'S BEAT RUNS ON ITS OWN TIMER.** The browser session's pull of
the game-log file, 12:30 EDT 2026-10-24: the leader's first word reached both
followers in 0.1s, nothing followed for 63-86s, and both dropped the trust at
exactly `leaderTrustMs` and went to mrpumpkin. `bossRecast()` ran only inside
`bossTick()`, which runs only when `mainLoop` reaches `handleEvents()` - and
`mainLoop` returns early while the rage pull is busy, which at a graveyard is
most of the time. `bossBeat()` now re-sends the trip and the rage-entry state
every `BOSS_BEAT_MS` from a timer of its own; a no-op on a follower.

**STUCK NO LONGER LOOPS.** A destination `safeSmartMove` refuses is remembered
for `RAGE_BLOCK.retryMs` instead of being re-planned and re-logged every tick
(26% of that morning's log). A direct route that fails is retried in two legs
via the map's spawn - the farm spot to mrgreen had no route because
`rageRoute`'s grid spanned the whole map and doubled its step past `maxCells`,
losing the 14-18 unit pinch; each leg stays at step 5. Two refusals of the same
destination in a row cast town, on the operator's ruling; the leader tells the
other two, who town with it if they are on the same map and nothing is on
them.

**LOG VOLUME.** `bossNote` says each message once per trip (and again after
two minutes), where alternating notes used to defeat its last-message test -
42% of the log. A boss tick's rejection is logged by its `reason`, once a
minute, where it read "[object Object]".

And the loot line logs only when the event carries `opener` and `goldm` - 238
lines read "undefined looted chest goldm: undefined".

## v74

**RAGE ENTRY HAS TWO LINES AND A DWELL, BECAUSE ONE LINE FLAPPED.** Measured
live by the browser session 2026-10-24 12:30 EDT on US II: entry opened from
wave 1 as v137 intended, then the party walked in and out of the box with the
20s average sitting right at `minSoaked` while the raw count swung 0-17 -
inside for 2s, 16s, 24s, 4s, then 106s, about a quarter of the window. Now the
leader enters at an average of `minSoaked`, stays until it falls below
`leaveSoaked`, and stays at least `minInsideMs` either way. The retreat on
`retreatAtAttackers` bodies is not subject to the dwell. Identical in all
three scripts; the gate's values are in `CONFIG.bossEvents.rageEntry`.

**A FOLLOWER'S OWN BOSS PICK IS THE LEADER'S RULE.** Same 12:30 graveyard:
Dexon took it at once while FatherToken and MageofOz spent 40-65s on an
mrpumpkin trip. Without fresh word from the leader a follower ordered by
lowest hp ratio, where the ranger ranks first, so a damaged mrpumpkin beat an
untouched graveyard. `bossPick`, `BOSS_RANK`, `BOSS_RANK_DEFAULT` and
`bossRank` are now copied from Party/Ranger.js, and
`Tests/suite_bosshop.js` holds the copies byte-identical. Why the leader's
word took that long to land is not established - the relay polls every 2s and
the leader re-sends every 8s.

## v73

**GRAVEYARD RAGE ENTRY OPENS FROM WAVE 1, AND THE CROWD GATE IS AN AVERAGE.**
Operator, 2026-10-24: entry is for the waves, not the Gargoyle - inside the
box the party gets more zombie and ghoul kills while it waits, and those are
Halloween-only achievements. `rageEntryNotWanted()` now admits any live
graveyard; until this build it waited for `gargoyle: true`, which put the
whole wave phase out of reach.
The gate could not open for any crowd. Measured live on the 10:30 EDT graveyard
with six other players: `rageCrowdSoak()` from the corridor read
6,5,7,3,5,3,5,8,6,4,8,6,5,6,6,6,2,3,5,9 at 2s intervals - so the corridor CAN
see into the box - and the longest run at or above `minSoaked` 6 was three
samples against a 20s consecutive hold. `rageEntryTick` now keeps a `holdMs`
window of samples and goes in when their average reaches `minSoaked`, after the
leader has watched for `holdMs`; the average falling below it brings the party
out. `minSoaked` is 5: that crowd averaged 5.4, and a 70%-of-samples rule at 6
would not have opened on it either. The retreat at `retreatAtAttackers` on each
character is unchanged and still answers tick by tick. Byte-identical in the
three party scripts, and the relay divergence check holds them to it.

**CAVE MAIL IS CLAIMED.** A cave reward goes to a random member's bag, or by
mail from "Dorr" when that bag is full or the member is offline, and only the
named character can take it. The CAVE MAIL block lists mail with
`api_call('pull_mail')` 20s after load and every 30 minutes and takes each
untaken Dorr item letter addressed to this character. Byte-identical in the
three party scripts.

## v72

**EVERY GAME LOG LINE NOW GOES TO A FILE ON THE BRIDGE**, on the operator's
request: the game keeps 480 lines and then cuts to the newest 160, and the
evidence for the spookytown door diagnosis existed only in that scrollback.
The shared `GAMELOG` block at the end of the file is byte-identical in Ranger,
Priest, Mage, Merchant and CaveRun, held to it by `Tests/suite_gamelog.js`.
It wraps the page's `add_log`, which carries the client's messages, the
default server-message handler and every script's `game_log()`. The wrapper and
its buffer are built in the page, so a runner restart leaves them working. The
log filter's `addLogEntry` calls the capture directly, because the filter
replaces the listener that would have sent server messages through `add_log`.
Batches POST to the bridge's `/gamelog` every 3s. A failed POST keeps its lines
(up to 600), and lines unsent at a hop are saved under `gamelog_unsent_<name>`
and sent first by the next page. `gamelogStatus()` on the console. Needs the
bridge restarted on the new `Codex/market_bridge.py`; until then the POSTs fail
and the buffer simply holds its last 600 lines.

## v71

**THE PARTY ENTERS THE RAGE BOX FOR THE GARGOYLE.** Operator, 2026-10-24:
"the ability for the party to enter the ragebox for gargoyle". The entry
machinery shipped in Ranger v112 / Priest v60 / Mage v83 but OFF, and even
inside the box nothing would have shot the Gargoyle, because it was
deliberately left out of the attack list.

- **`rageEntry` toggle is ON in all three.** A follower's tick checks its own
  toggle before it listens to the leader, so one left off would split the
  party at the corridor.
- **Entry is now for the Gargoyle only, and only once it is up**
  (`rageEntryNotWanted`). The leader stays out unless the trip is graveyard
  and the event's entry carries `gargoyle: true`, which the server adds at the
  wake and not before. The waves are pulled from the corridor as before, and
  their points carry over to the Gargoyle anyway, so going in earlier would
  add mummy risk and buy nothing. The crowd gate is unchanged and still
  required: `minSoaked` other players' mummies held for `holdMs`. The
  retreat on bodies is unchanged and still each character's own.
- **Inside the box the Gargoyle joins the attack list** (`bossFightTypes`),
  and only there. `BOSS_FIGHT_TYPES` still leaves it out, because that table
  also feeds the rage pull and the eligibility gate, and the pull must never
  reach for a 6,000,000 hp boss from the corridor. The ranger opens on it; a
  follower joins once something is on it, as with every other event monster.
- **Untested in the field.** Whether the leader can see enough of the mummy
  field from the corridor to count a crowd at all is still unmeasured; if it
  cannot, the gate never opens, which is the safe direction.

Seven mutations across the three scripts, each caught in
`Tests/suite_bosshop.js` and `Tests/suite_relay.js`.

## v70

**THE EVENT BRANCH NOW RUNS BEFORE THE FARM GATE IN mainLoop.** Measured by
the browser session on 2026-10-23 on the Ranger v123 and Priest v69 slots:
after a hop the farm spot was decided and broadcast before any boss evaluation
ran, because `if (!home || !mobMap || !destination) return` sat ABOVE
`shouldHandleEvents()` and so above everything that calls `bossTick()`. The
event path reads none of `home`, `mobMap` or `destination` (checked by
extracting every function it reaches - `shouldHandleEvents`, `handleEvents`,
`bossTick`, `bossPick`, `bossApproach`, `bossWalkTarget` - which read them in
comments only), so the gate is now the ELSE-branch of the event test and
guards only the farm-dependent movement branch. Looting and `updateCache()`
run before it too. Pinned by position in `Tests/suite_bosshop.js`, all three
scripts; moving the gate back fails two assertions.

**`findBestTargetInner` NO LONGER REFUSES EVERYTHING ON A NULL `home`.** Its
first line was `if (!home) return null`, which refused a targeted boss in range
until the farm spot arrived - the trap the browser session named. Focus fire
and the boss loop need no farm spot; only the final `type: home` loop does, and
the guard now sits directly above that loop. Lifted with `home` null and a boss
on somebody: the boss is returned. Both the old gate restored and the new one
removed fail assertions.

**`BOSS_FIGHT_TYPES.horseman = ['horseman', 'jackowalker']`**, the operator's
2026-10-23 hand edit to the Ranger slot, carried into all four copies (Ranger,
Priest, Mage, `Codex/FamilyFleet.js`) so the next deploy does not revert it and
the relay divergence check stays green. `bossCooperative()` is any-of over the
row, so the jackowalker's own flag cannot remove the horseman.

## v69

**`scopedGetLegacy` CAN NO LONGER UNDO A DELIBERATE CLEAR**, ported byte for
byte from Ranger v122, where the defect was live. A scoped key written null is
PRESENT holding null and one never written is absent; `get()` reports both as
null, so the migration adopted the legacy value over a clear. `scopedHas()`
reads the raw `localStorage` item, which is the only thing that separates
them. Inert here - the one clear-to-null on this file is
`PL_HOP_PENDING_KEY`, which is deliberately not migrating - and the five
helpers must stay byte-identical across the three scripts, which is now
asserted rather than assumed.

## v68

**v119 SCOPED ONE KEY AND FROZE IT IN A `const`, WHICH IS A SECOND WAY TO HAVE
THE SAME BUG.** `runner_functions.js` builds `character` as a PROXY and fills
it with `proxy_all()`, whose own comment reads "Not all properties are sadly
available right away" - so `const BOSS_KEY = 'boss_trip_' + character.name`
evaluated at module scope can capture an empty name and mint one shared
`boss_trip_undefined` for all three characters. The collision, restored,
invisible. **v119 ALSO INTRODUCED THE FILE'S FIRST BARE `character.name` AT
MODULE TOP LEVEL**, in a file whose own style guards it at `:127` and `:195`,
and that style was the tell. The scope is resolved at every use now, and an
unreadable name yields null rather than a key: a lost read, never a write to
the key all three share.

**THE CONVENTION ALREADY EXISTED IN FOUR SUBSYSTEMS AND THE PARTY KEYS WERE THE
OUTLIER** - the browser session's census of the live namespace found
`<name>_newparty_info`, `luckyslot_<name>`, `pl_delivered_<name>_<pot>` and
`pl_mlucked_<name>` already scoped. So this is not a property of the accessor
nobody knew; it is a convention that was not applied uniformly, which is the
`rageEntryBroadcast` shape again - one subsystem complete, its neighbour
half-built, nothing connecting them.

**TWO READERS, AND THE DIFFERENCE IS PROVENANCE RATHER THAN CAUTION.**
`scopedGet` refuses the legacy value; `scopedGetLegacy` adopts it once. Falling
back is correct exactly where the legacy value cannot be another character's -
a key no other script ever wrote (`achv_queue`, `taxi_probe`,
`crabxx_contrib`, `farm_spot_blacklist`, `fear_log`, `mh_state`), or one whose
entries cannot be mistaken for a sibling's (`pl_acted`: `plSend` mints `_plid`
per call, so no two characters ever see one id). It is wrong for `boss_trip`
and `pl_hop_pending`, where reading the legacy value once IS the
cross-character import being removed.
**THE MIGRATION IS NOT A NICETY: `achv_queue` HOLDS A LIVE OPERATOR FEATURE.**
They were told hours ago to use the achievement queue for a farm override that
survives hops, precisely because it persists. Scoping that key without a
fall-back would have wiped the thing they had just set up.

**`pl_hop_pending` WAS NOT ON ANYONE'S LIST AND THE DERIVATION FOUND IT.** The
new assertion derives every `const *_KEY`/`*_STORE` declaration from the source
and requires each to appear in exactly one of two lists, so a key cannot
default into the shared namespace. On its first run it failed, naming a
pending-hop record shared by Priest and Mage - one follower able to resolve a
hop the other ordered, the `boss_trip` defect with different nouns. A
hand-written list would have shipped without it.

**`pl_cursor` AND `loot_chest_ids` STAY SHARED, AND THAT IS ASSERTED TOO** so
that scoping either has to confront the reason. `plPoll` ends every poll at
`Math.max(plCursor, r.cursor)` where `r.cursor` is the bridge's GLOBAL head
(`self.seq`, one counter for every recipient), so all four converge there each
tick and adopting a sibling's value is adopting your own; `loot_chest_ids` is
harmless to share.

Five mutations, five named failures: the shared-key fall-back (3), the
migration removed (1), a bare `get(ACHV_KEY)` (1), one of the two
`set(FEAR_STORE)` sites (1), the priest's pending-hop unscoped (9). **THE FIRST
ATTEMPT AT THE FOURTH SCORED ZERO BECAUSE ITS ANCHOR MATCHED TWICE AND NOTHING
WAS MUTATED** - a mutation that moves nothing is a claim about the mutation
first.
**AND ONE TEST WAS DEGENERATE UNTIL ITS PRECONDITION CAUGHT IT.** The
two-characters-one-store case handed both worlds the same `{}`; `world()`
COPIES the store it is given, so they never shared anything and the assertion
proved nothing. The precondition failed, which is the only reason it was
visible - the harness-override lesson arriving by a third route.

## v67

**THE BOSS TRIP WAS SHARED STATE BETWEEN THE THREE CHARACTERS, BECAUSE
`set`/`get` ARE NOT CHARACTER-SCOPED AND NOTHING SAYS SO.** Read from the
client at upstream `16881a27`: `set(name, value)` is
`window.localStorage.setItem("cstore_" + name, JSON.stringify(value))`. The key
carries no character anywhere, every character tab is the same
`adventure.land` origin, and `const BOSS_KEY = 'boss_trip'` was byte-identical
in Ranger, Priest and Mage - so the trip, the shard-keyed cooldowns and the
give-up counts were ONE blob, each `bossSave()` clobbering the other two and
each load reading whichever character had written last.

**THAT THE CODE CONTEXTS SHARE A `localStorage` IS NOT AN INFERENCE FROM THE
SOURCE.** `local_cm_logic` walks `Object.keys(localStorage)` for
`cm_<my name>_*` entries that ANOTHER character's `send_local_cm` wrote - it
is how `send_cm`'s local copy reaches us at all, which this party relies on
every time `plFirstTime` drops the relay duplicate. The game ships a
cross-character transport built on exactly this sharing.

**FOUND FROM ONE RETRACTED OBSERVATION.** The browser session measured Dexon's
mrgreen trip reading `src='own'` at 22:58:18 and `src='leader'` at 23:01:20,
same `startedAt`, across the v118 redeploy, and withdrew their earlier claim
that `trip.src` is stamped once and never moves. It is stamped once: the only
write is at trip creation and there is no mutation anywhere. What moved was
WHOSE trip Dexon was holding. `src: 'leader'` sits behind `!bossIsLeader()`,
so the leader cannot mint one - he loaded a follower's save. **A FIELD THAT
CANNOT CHANGE, OBSERVED CHANGING, IS A STATEMENT ABOUT THE CONTAINER AND NOT
ABOUT THE FIELD**, and reading it as mutation sends you looking for a writer
that does not exist.

**NOT MIGRATED FROM THE LEGACY KEY, ON PURPOSE.** Reading `boss_trip` once at
load is precisely the foreign-trip import this removes. The cost is one trip
clock restarting at the deploy, which is the same cost the persistence exists
to avoid and is worth paying once.

**THE OTHER THREE SHARED KEYS ARE LEFT, AND THE REASONS DIFFER RATHER THAN
BEING ONE JUDGEMENT.** `pl_cursor` is shared with Meltymerch as well, and is a
no-op: `plPoll` ends every poll at `Math.max(plCursor, r.cursor)` and
`r.cursor` is the bridge's GLOBAL head, so all four cursors converge there
each tick and adopting a sibling's is adopting your own. `pl_acted` cannot
cross-suppress, because `plSend` mints `_plid` per call and `bossBroadcast`
calls it once per member, so two followers never share an id - the only cost
is its cap of 20 being split three ways. `loot_chest_ids` is harmless to
share, arguably useful. The Ranger-only keys (`taxi_probe`, `crabxx_contrib`,
`farm_spot_blacklist`, `fear_log`, `achv_queue`, `mh_state`) are unshared ONLY
because no other script happens to use the name, which is this repo's own "a
guard that works as a side effect of something else's data is a coincidence
with good timing" - they are safe today and nothing protects them.

**AND THE SECOND HALF OF THE REPORT STANDS AND IS NOT FIXED BY THIS: TRIP AGE
IS NOT EVIDENCE OF CONTINUOUS EXECUTION.** The trip survives a reload by
design, so a `startedAt` of 22:58:13 read at 23:01 says nothing about whether
the script ran in between - which bears directly on reading the 22:42
graveyard pick as a live trip. A trip whose event has since ENDED does
self-correct: `bossPick()` returns null on the first `bossTick` and
`bossEnd('nothing eligible is live')` fires. What does not self-correct is the
inference.

Pinned in `Tests/suite_bosshop.js`: the scoped form present in all three
files, the bare form forbidden by name (a file carrying both would pass a
presence-only check, the later declaration winning), one declaration each, and
the leader-cannot-stamp-`leader` invariant asserted with a FRESH call in hand -
the only state in which a follower would answer `leader`, so the assertion
cannot pass by being offered nothing. Mutations: the bare key back in Priest
alone fails 2, dropping `!bossIsLeader()` from `bossPick` fails 1.

## v66

**A TRUST WINDOW WITH NO HEARTBEAT IS A TIMER THAT ALWAYS EXPIRES, AND IT HAD
THE PARTY ON THREE MAPS DURING ONE GRAVEYARD TRIP.** Observed live 2026-10-22
by the browser session, reported as an observation rather than a claim: Dexon
on spookytown, FatherToken on main, MageofOz on halloween, all on one trip.

`bossBroadcast(pick.name)` fires only where the trip STARTS or CHANGES, and a
follower trusts `bossState.fromLeader` for `leaderTrustMs`, 20 seconds. A
graveyard window is 600s and a horseman window 2400s, so for all but the first
twenty seconds of every trip the followers were falling through to their OWN
pick - **and that path is a DIFFERENT RULE, not a copy of the leader's**: the
ranger orders by `bossRank` first with an incumbent tie-break, while the
followers order by lowest hp ratio alone, `bossRank` being declared in
`Party/Ranger.js` and nowhere else. Same `parent.S`, two rules, three
characters: three bosses and three maps, with nothing logging a fault.

`bossRecast()` re-sends the live trip on a `BOSS_RECAST_MS` beat of 8s, which
is two beats inside the window so a lost message does not drop a follower. It
no-ops on a follower through the existing `bossIsLeader()` guard, which is what
lets the three files carry the same bytes; it is on the relay divergence list.

**THE EXPIRY IS CORRECT AND IS UNCHANGED.** A leader that has genuinely stopped
ticking must release the followers to decide for themselves - that is the whole
reason `leaderTrustMs` exists, and it is pinned here through `bossPick`'s `src`
going from `leader` to `own` across the boundary. What was missing was the
leader saying anything while it was still deciding.

**`rageEntryBroadcast` ALREADY HAD THIS RIGHT, which is the part worth
carrying.** It re-sends every tick, so its `trustMs` expires only when the
leader really has gone quiet. The same mechanism was built complete in one
subsystem and half-built in the other, three weeks apart, and nothing connected
them - a trust window and its heartbeat are ONE mechanism, and shipping the
window alone leaves a feature that works for twenty seconds.

**ONE MUTATION SCORED ZERO AND ONE ASSERTION WAS WRONG AGAINST CORRECT CODE.**
Deleting the `bossRecast();` CALL from `bossTick` moved nothing: every
assertion was about the helper, and a perfect helper nobody invokes leaves the
defect intact - "assert on the far side of a handoff", with the helper as the
near side. `bossTick` is too large and too stateful to lift, so the repair is
positional over the source text. The first draft of that check then failed in
all three files, because `const t = bossState.trip` also appears in `bossEnd`
ABOVE `bossTick` and a bare `indexOf` compared against the wrong occurrence;
it anchors relative to the call now. Six mutations, all caught.

## v65

**THE ATTACK GATE COULD NOT SEE AN EVENT'S OWN MONSTERS, which is one layer
further in than the pull v113 fixed: the pull brings the monster to us, this
decides whether we shoot it.** `allBosses` names NO event spawn - not zombie,
not ghoul, not horseman, not gargoyle - and it is what the ranger's
`attackIfTargeted` and the followers' `BOSS_SET` are built from. So on a
graveyard trip Dexon shot a zombie only when that zombie happened to be on
FatherToken, the one name in `targetPriority`. That is aggro luck rather than
a rule, and it fits the measured ranger zombie credits of 0 -> 11 against the
followers' 12 -> 31 and 17 -> 51 over the same window.

`bossFightTypes()` returns the current trip's `bossMonsterTypes()` and `[]`
with no trip, so the widening exists only while we are actually on the event.
It is byte-identical in all three files and is on the relay divergence list.

**NOT DONE BY WIDENING `allBosses`, `BOSS_SET` OR `alwaysAttack`.** On the
ranger `alwaysAttack` is a SORT KEY in `updateCache` as well as a filter, so a
zombie there would outrank the farm target on every map forever - the same
argument the `rageAlso` check already records at its own call site.

**THE RANGER OPENS AND THE FOLLOWERS JOIN, which is the existing division and
not a new one.** The ranger's clause excludes any type `alwaysAttack` or
`attackIfTargeted` already names, so it changes exactly the monsters that had
NO rule: rgoo and bgoo are in `allBosses` and therefore keep goobrawl's
deliberate "engage a cooperative boss only once somebody else is on it". The
followers' loop gains the event types but keeps its `.target` requirement, so
they still wait for someone to be on it.

**THE GARGOYLE IS NOT IN THIS CHANGE, AND THE SUITE IS WHAT STOPPED IT BEING.**
Adding it to `BOSS_FIGHT_TYPES` was written first and reverted: three
assertions went red, one of them "the gargoyle is deliberately NOT in the
fight list", and the recorded decision behind it says in its own words "the
operator's open call, not a default" - 6,000,000 hp and cooperative so three
characters cannot take it, its spawn inside the mummy rectangle, and the
waves' points carrying over to it anyway so excluding it costs no share. That
last clause also explains the gargoyle credit observed on 2026-10-22 without
any forcing having caused it. A change that enacted an open call as a side
effect of a different fix is the worst possible way to make it, so the new
path is asserted NOT to reach the gargoyle, on both the ranger and the
followers.

**TWO MUTATIONS SCORED ZERO BEFORE THE ASSERTIONS WERE RIGHT**, which is the
only reason the follower half is covered at all: reverting the Mage's loop
moved nothing (the ranger assertions are a different function in a different
file), and then reverting the PRIEST's moved nothing either (the behavioural
test lifts from the Mage). The two bodies legitimately differ, so they cannot
join the byte-identity loop; the check was narrowed to the one line both must
carry rather than dropped. Eight single-file mutations, all caught.

## v64

**A COMMENT-ONLY CORRECTION, AND IT IS THIS REPO'S OWN LESSON LANDING ON A
COMMENT WRITTEN HOURS EARLIER TO EXPLAIN A CLAIM THAT ROTTED.** v115's
`bossEntryLive` comment justified the named presence set by naming the non-boss
keys a general rule would swallow: `schedule`, `time_offset`, `night`,
`dailies` and `nightlies`. Only the first is a key of `S` - the other four are
FIELDS INSIDE it, which `CLAUDE.md`'s own schedule section already stated. The
browser session caught it against a live read.

**MEASURED, US II 2026-10-22, ten keys:** `schedule`, `event_flags`,
`event_ends`, `blessed_minutes`, `blessed_by`, `halloween`, `witchcipher`,
`slenderman`, `mrgreen`, `mrpumpkin`. So the keys a general "key present means
live" rule would actually read as live bosses are `event_flags`, `blessed_by`
and `halloween`.

The fix stands untouched; what was wrong was the EVIDENCE cited for it - and
the test fixture had the same fiction in it, so the widening assertion was
passing against a payload shape the game does not produce. Corrected here and
in `Tests/suite_bosshop.js`; the re-run mutation still fails 4.

**`slenderman` IS THE KEY THAT MAKES THE NAMED SET LOOK WRONG AND DOES NOT MAKE
IT WRONG, so it is now named at the declaration.** It carries the FULL boss
shape - `live: true`, map, hp 66,666, max_hp - so it reaches `bossLiveNames()`
on its own `live` field and always has, with no presence rule involved. It is
`cooperative: true`, so `bossCooperative` would admit it; what refuses it is
`CONFIG.bossEvents.exclude`, whose comment records why - the server sends
`{name, map}` with no x/y so `bossWalkTarget` returns null, and approaching him
warps him away. A reader who finds him live and unranked should look at the
exclude set, which the comment now says. Asserted from the SOURCE TEXT, because
that set is a non-liftable `new Set([...])` and a fixture copy would prove
nothing about the committed file.

**NO BEHAVIOUR CHANGED.** This version is byte-identical to v115 but for the
version number and that comment block, so a deploy of either is the same build
functionally - v115's `bossEntryLive` is the feature to detect for both.

## v63

**goobrawl PUBLISHES NO `live` FIELD, SO THE BOSS-EVENT LAYER COULD NEVER
HANDLE IT - ON ANY CHARACTER. THE 70-TO-0 bgoo SPLIT IS NOT A FOLLOWER
ASYMMETRY.** Read from upstream `16881a27`, 2026-10-22. Three shapes reach `parent.S`:
crabxx, franky, icegolem and horseman come out of one `forEach` in
`server_functions.js` assigned `{live, map, hp, max_hp, target, x, y, end}`;
`graveyard_public()` returns `live: true`; and goobrawl is assigned
`E.goobrawl = { end: timers.goobrawl }`, with `delete E.goobrawl` when the
window closes. No `live`, no map, no hp - its PRESENCE is the only signal it
has.

`bossPick()` gates all three of its paths on that field: the forced pick and
the leader relay each tested `d && d.live`, and the own reading iterates
`bossLiveNames()`, which filtered on `v.live`. So `bossPick('goobrawl')`
returned null for Dexon, FatherToken and MageofOz alike; `shouldHandleEvents()`
stayed false; `handleEvents()` never ran; and the join was never emitted by
anybody. `bossApproach` is byte-identical in all three files and the relay suite
pins it, so there was never a leader-only join path to find.

**TWO HYPOTHESES DIED ON THE MECHANISM RATHER THAN ON A COUNTER-EXAMPLE, AND
ONE OF THEM HAD BEEN REFUTED FOR THE WRONG REASON.** The followers' empty
`CONFIG.combat.alwaysAttack` and `attackIfTargeted` were ruled out by the
crabxx/franky/icegolem credit row - a sound refutation reaching the right answer
through the wrong path, because those lists are not what engages a follower on a
boss at all. `findBestTargetInner()` asks `BOSS_SET` membership plus
`boss.target` plus `max_distance: character.range`, and `BOSS_SET` spreads
`allBosses`, which names `bgoo` and `rgoo`. The followers were always able to
engage a targeted goo in range. **A REFUTATION THAT LANDS ON THE RIGHT VERDICT
BY THE WRONG ROUTE LEAVES THE NEXT READER BELIEVING THE WRONG MECHANISM**, and
here it would have sent them to the combat lists.

**THE FIX IS ONE PREDICATE READ FROM ALL THREE GATES.** `bossEntryLive(name, d)`
answers `d.live`, else presence for a name in `BOSS_PRESENCE_LIVE`. Presence is
sound for goobrawl because the server deletes the key, and the set is NAMED
rather than general because `bossLiveNames()` iterates every key of `S` - which
also carries `schedule`, `time_offset`, `night`, `dailies` and `nightlies`. A
general "key present means live" rule reads all five as live bosses; that
widening is an inverted assertion in `Tests/suite_bosshop.js`.

One gate was extracted rather than three copies left in place, for the reason
this repo already recorded against the give-up cooldown: a shared predicate read
from only one call site is not yet shared, and the failure it produces is
inaction with no log line.

**AND THE RANKING TABLE'S OWN COMMENT CITED goobrawl AS ITS EXAMPLE OF WHY IT IS
KEYED BY THE EVENT NAME - "because that is what bossLiveNames() yields".** True
of every other entry and false of that one, so `bossRank.goobrawl = 3` was
unreachable from the day it was written, exactly as dragold is under
`lunarnewyear` - except that one is recorded and this one was not. The keying
convention was right and the reason given for it was never checked. Corrected in
place, with the falsified clause kept.

Measured by mutation: dropping the row fails 9 assertions, reverting one gate to
a bare `d.live` fails 3, widening to a general presence rule fails 5, and
dropping the row from the PRIEST alone fails the relay divergence check.
`bossEntryLive`, `bossLiveNames` and `BOSS_PRESENCE_LIVE` are on that list now -
a drifted copy means the leader takes a trip the followers cannot see.

**WHAT THIS DOES NOT ESTABLISH.** That the followers will now earn goobrawl
credit. It removes the reason nobody could be routed there; whether all three are
present at the kills, and in range, is a live question for the next window.
Dexon's 70 bgoo were earned without this path, so something else put him on that
map - the operator's own "I have even joined them but the script immediately goes
to another boss and does not stay" is consistent with a manual join plus a farm
layer that owned movement because `shouldHandleEvents()` was false.

## v62

**horseman HAD NO `BOSS_JOIN_SPOTS` ROW, AND THE SERVER HAS JOINED IT ALL
ALONG.** Read from upstream `16881a27`: the join handler's horseman branch is
`transport_player_to(player, "halloween", [-405, -1560, 0, 40])` behind a
200-unit skip - the same SHAPE as crabxx, franky and icegolem, which is what
`bossTaxiWalkable()` derives "the refusal costs the lift, not the fight" from.
`halloween` carries five doors, so the derivation answers TRUE the moment the
row exists. It was missed because horseman arrived as a RANKING entry on
2026-10-21 - one `bossRank` row, one `EVENT_WINDOW_SEC` row in the bridge - and
nothing about adding a boss to a priority table asks whether the party can be
teleported to it.

**WHAT THE ABSENCE COST, AND WHAT IT DID NOT.** `bossApproach` gates its ENTIRE
join block on this table, so horseman was walked to even when clean, with a
free teleport available. It did NOT cause the 2026-10-22 zero credit: at
05:17:52Z Dexon was already on `halloween` with the boss at 24.46%, so the walk
arrived and `share > 0.0025` remains the live explanation. This row does not
touch that and must not be read as having closed it.

**THE LATENT HALF IS THE REASON IT IS WORTH A ROW NOW, AND IT IS ARMED BY AN
EDIT NOBODY WOULD CONNECT TO IT.** `isTaxiJoin()` is `isJoinEvent()` AND this
table, and horseman carries `join: true` - so without the row the three hop
gates treat it exactly like goobrawl: refused outright while hop-sick
(`bossHop` line "skip when the join is the ONLY way in"), given the larger
pre-spawn buffer, and charged the full sickness wait in the window test. Those
gates iterate `CONFIG.bossHop.targets`, which is the operator's list, so the
mistreatment was UNREACHABLE and silent - and the 05:00Z measurement that
settles horseman as worth hopping for (five kills at 391, 620, 686, 710 and
1322s against a 2400s window) is precisely the argument for adding it to that
list. The row means that edit cannot quietly arm the goobrawl treatment.
**A DEFECT GATED BEHIND AN OPERATOR CONFIG EDIT IS NOT CAUGHT BY ANY AMOUNT OF
WATCHING THE THING RUN**, which is the one thing this class has in common with
the `GEAR_PROGRESSION` repeal that withdrew dexbelt's sell guard: a data edit
elsewhere decides whether a guard applies, and nothing at either site says so.

Pinned in `Tests/suite_bosshop.js` with the inversion kept beside it - delete
the row and `isJoinEvent && !isTaxiJoin` flips on, and a hop-sick character
with a live horseman in front of him is walked away from it. Measured by
mutation: dropping the row fails 7 assertions, dropping it from the PRIEST
alone fails the relay divergence check.

## v61

**THE RAGE PULL READS THE BOSS CONTEXT NOW, AND WITHOUT THIS THE WORKING
GRAVEYARD ROUTE KILLED NOTHING.** Measured 2026-10-22, the first live window.
Routing was perfect - `bossPick()` became graveyard and two seconds after the
open Dexon was standing on `BOSS_JOIN_SPOTS` at (255,-1030) - and the party
produced zombie +0, ghoul +0, gargoyle +0 while the gargoyle on their own shard
lived seven minutes and died at 0.01%. Present on shard, zero credit.

**THE CAUSE WAS MEASURED, NOT INFERRED**, read off the priest mid-window:
`destination` was the FARM target (crabx on `main`), `rageAlso` was `[]`, so
`ragePullTypes()` answered `["crabx"]` and `ragePullActive()` early-returned on
`destination.map !== character.map`. Every target sat inside the mummy
rectangle, `safeMove` refuses every coordinate in it, and the ONLY engagement
route from the join spot is the pull - which was idle. The party stood at the
join spot with every target behind a wall it would not cross and no mechanism
to bring one out.

**IT IS THIS FILE'S OWN WARNING ABOUT THE MANUAL OVERRIDE, APPLIED TO THE
AUTOMATIC PATH.** "mummy has to be in `rageAlso` ... `home: 'zombie'` alone
leaves the pull machinery idle" - the operator's snippet worked because it set
`manualOverride` AND `rageAlso` AND ran `runFarmSearch()`. The boss path sets
none of the three, and should not: the farm layer owns those, and writing boss
state into them is v108's mistake from the other end. So the pull READS the
boss context, the way movement already does.

`ragePullCtx()` answers which park point and which types the pull is serving -
the boss trip's when one is live and its park point is on this map, the farm's
otherwise. **`bossWalkTarget` IS THE PARK POINT FOR FREE**, because v111's
guard already falls it through to the join spot when the published coordinates
land inside a rectangle; the two compose with nothing to keep in step.

**THE ACTIVATION TEST GAINED A SECOND DISJUNCT, AND IT IS A WIDENING RATHER
THAN A REPLACEMENT.** The box-TYPE test cannot see the graveyard - zombie,
ghoul and the gargoyle are EVENT spawns with no rectangle of their own, so
spookytown's only box type is `mummy` and a graveyard trip matched nothing. The
new half asks POSITION: is any wanted type currently standing inside a
rectangle, which is the question the candidate scan has always asked.
**REPLACING THE TYPE TEST WOULD HAVE BEEN A REGRESSION.** `rageHoldFire()`
consults this, and its first job is to stop the party fighting on the way IN -
so on an approach with nothing yet visible inside a rectangle a purely
positional test answers "inactive", hold-fire switches off, and the party stops
to fight exactly where the old comment says it must not. Both disjuncts, and the
regression case is an assertion.

`rageHoldFire()` and `ragePullTick()` take their park point from the context
too. The old code measured distance to the farm target two maps away, which is
always past `parkWithin`, so hold-fire was unconditionally true for any wanted
type. Memoised for 250ms because the positional half walks `parent.entities`
and `rageHoldFire()` asks per MOB; keyed on context and map, so a change of
either is seen at once, which is asserted.

## v60

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

## v59

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

## v58

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

DEFECT B, PRIEST ONLY - THE ENGAGEMENT RULE WAS ON THE ATTACK PATH AND NOT ON
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

## v57

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

## v56

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


## v55

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

Priest publishes: findHealTarget, handlePartyHeal, handleCurse, handleZapper, kiter, equipSet.

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

Not deployed. Dexon needs Ranger v55 and is currently running the wrong
script entirely.


## v54

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

## v53

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

## v52

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

## v51

One addition to the console-command header.

**CONSOLE COMMANDS header.** The existing seven are unchanged. Derived with an
AST walk - top-level functions with zero bare, zero dotted and zero
string-literal references, excluding on_* handlers - not from a list.

A SECOND, SEPARATELY LABELLED GROUP lists 1 more: functions an operator can
also type, but which HAVE internal callers, so a dead-code scan would never
flag them. They are reference, not protection, and the split keeps visible
which names would actually be at risk if their caller disappeared. The
operator's call, 2026-10-18: the header is an operator reference, not a scan
shield.


## v50

A TOGGLES block and a console-command header. Additive only - no read site
changed and no behaviour changed.

**TOGGLES.** Every on/off switch in CONFIG, 28 of them, collected into one
`const TOGGLES` immediately before `const CONFIG`, with CONFIG referencing
each one. The value still lives at its original CONFIG path, so `cfg.enabled`
after `const cfg = CONFIG.bossEvents` (line 1993) resolves exactly as before
and a runtime assignment to a CONFIG path still wins. The diff touches only
the inserted block and the value positions inside the CONFIG literal; every
function body is untouched, which is the check that proves it is additive.

Keys are namespaced because `enabled` appears 10 times in this file, once per
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
tabs, `ok` on result objects, `check_min_hp` on a game-API call, `childList`
on a MutationObserver, `PARTY_LINK.verbose`, and the runtime state fields
(`busy`, `rip`, `inFlight`, `restocking`, `skinReady`, `waitingForMerchant`,
`arrivedAtSpot`, `reportedUnreachable`). A boolean at config indent inside a
function is a data field, not a switch.

**CONSOLE COMMANDS header.** 7 commands listed in the opening comment with
their signatures, under the note that they have no internal callers BY DESIGN
and that a static scan will call every one of them dead. Derived with an AST
walk - top-level functions with zero bare, zero dotted and zero string-literal
references, excluding `on_*` handlers - not from a list. The same derivation
reproduces Merchant.js's hand-written header exactly, all twelve names, which
is what validates the method.
## v49

NOT DEPLOYED TO THE LIVE SLOT as of 2026-10-18. Dead code only, 130 lines, no
behaviour change. Deleted: getDynamicEvents (4 - Ranger's copy of the same
name is LIVE and is untouched, which is the trap in this one); locations (36)
with its now-empty LOCATION & EQUIPMENT DATA banner; the cache's invalidate()
method (3); handleSpecificEvent (29, author-marked DEAD); kiteBand (12);
kiteThreats (21); kitePathBlocked (8); and the unread kiting weights
goalWeight and safetyWeight with the // Weighting comment that covered them.
The surviving kite family here is NOT the same set that survives in Ranger or
Mage - kiteBand and kiteThreats are live in both of those and dead only here -
so these three files cannot be edited as one. Two comments were reworded
rather than cut: the destination note no longer points at the deleted
locations[home] lookup, and shouldHandleEvents' history no longer names
getDynamicEvents, which this commit removed from under it. Found by an acorn
AST walk and an independent reference sweep that agreed item for item.

## v48

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

## v47

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

## v46

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
valve; Mage v69 is identical to this

## v45

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
gets tested, and the party has not reached it yet. Ranger v78 and Mage v68
carry the identical fixes

## v44

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

## v43

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
its size is unverified from here. Ranger v76 and Mage v66 carry the identical
change

## v42

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
Mage v65 carry the identical change

## v41

Blacklist false positives, three causes. Arrival is now a RANGE
(TRAVEL.arrivalRadius 200) because kiting preempts smart_move and the
rejection was counted as a failed route against a spot we were standing on.
Unreachable is never reported while get_nearest_monster({type:home}) is in
range. The xp clock re-baselines off the farm map, so boss and vendor trips
stop reading as net-negative xp. Travel now outranks cohesion in the movement
chain, and holdCohesion stands down when the leader is not in the centroid -
the two followers were homing on each other and never pathfinding

## v40

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

## v39

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
kills. Follower half, byte-identical to the block in Mage.js. The followers
reach Daisy on mh_accept and mh_turnin and run the same travelTo, so the race
is the same one

## v38

Cohesion no longer spams an impossible move. Byte-identical to the Mage.js
change, same defect, same three fixes: can_move_to() consulted across seven
bearings before any emit, the xmove rejection caught instead of escaping into
mainLoop's tick through noHang(holdCohesion()), and a terrain handoff to
handleReturnHome() alongside v57's distance handoff. Measured on DESERTLAND on
2026-10-04, and FatherToken was the worse of the two: wedged at (373,-2121),
14 xmove calls in 25.6 seconds, every one to the unreachable (316,-2015), all
14 rejected, one distinct position, zero drift, can_move_to a function in his
context too. He and MageofOz sat 330 units apart homing on EACH OTHER because
Dexon was a map away on main at (-87,673), inside the 400 handoff so v57's
distance escalation never fired. Also: a priest wedged out of heal range is
the more expensive version of this bug: heal carries use_range true, so being
stuck 400 units from the party means healing nobody at all, which is the v56
finding. Fixed here at the same time rather than waiting for it to happen

## v37

Monster Hunt follower half, byte-identical to the block in Mage.js. Purely
message-driven with no triggers of its own, so it is inert until Ranger.js
ships - a follower deployed alone cannot accept a hunt and so cannot burn a
roll onto a 30-minute clock nobody is watching. It exists because accepting
and turning in are emits on THIS character's socket and
character.s.monsterhunt is readable only here: a party-member payload carries
no 's' field at all (measured 2026-10-03), so Dexon cannot see our target and
we report it

## v36

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
feeds zapperMobs, and the priest would start cursing and zapping six more
monster types - so that stays a separate decision. Why only Dexon stalled at
the snowman on 2026-10-02 and these two did not: they attack from actionLoop,
which carries no type filter, so handleEvents() diverting mainLoop to the boss
trip never stops them. focusFireTarget() above already copies Dexon's target
when he has one, so following the leader was always covered; this governs only
what happens before he opens. Consequence, and it is the stated rule rather
than an oversight: a boss nobody else has touched is now attacked by nobody,
so such a trip ends on the maxTripMs cap having dealt no damage.
findNearestBoss/cache.nearestBoss is left ungated - it only drives
bossLuckSwitch equipment swapping, not attacking. rimedjinn is in the set but
has range 200 against this party's 165/197/201, so only MageofOz can outrange
it; a candidate for CONFIG.bossEvents.exclude rather than something this
change addresses.

## v35

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
follower precedence, and the persisted trip. CORRECTION to the v34 entry that
follows: it says NOT DEPLOYED as of 2026-09-29, and that is stale - measured
2026-09-30 in FatherToken's live CODE context, typeof unstickWatchdog is
"function" and CONFIG.party.cohesion.handoff is 400, so v34 IS deployed.

## v34

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

## v33

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
field, which is what nine simultaneous attackers looks like. Priest changes.
(1) holdCohesion() closes on the party whenever the worst distance to another
member exceeds leash 150, which leaves margin inside his 197 heal range. It
moves toward the CENTROID of the others rather than at the leader, so he
settles between the two he has to reach instead of hugging one and losing the
other, and it runs ahead of kiting and farming in mainLoop because being in
heal range outranks both. Leader-exempt, so Dexon still drives the spot. (2)
findBestTarget now takes Dexon's target first via focusFireTarget(), refusing
it when out of range or dead. (3) The whole-field weight in avoidMobs
subtracts kitePathPenalty instead of the v59 veto. Note scare() is still inert
- no jacko anywhere on the account, and it drops only from Halloween candy0 at
weight 1 of ~6.5 - so cohesion and focus fire are carrying this round.

## v32

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
minutes. His engine already scored the whole field, which is why it moved 164
times in that window where Dexon's moved 56 - so this is smaller. The
gain-only weight sum became the shared signed, urgency-weighted
kiteMultiWeight, so fleeing one monster into another now costs rather than
merely failing to help. Step-length retry at 1, 1/2, 1/4. An ordered ladder
plus a courage-gated pathfinder before giving up, instead of returning false
straight away. Disengage mode acts BEFORE anything is in reach once attackers
reach courage, and suspends the arena boundaryBox while escaping, because a
fence that traps him mid-flight is worse than leaving it. Disengage matters
most for him: he held 122-181 units, safely outside cgoo's 64 reach, and was
still over courage for 53 of 297 samples, because fear counts who TARGETS you
rather than who can reach you - and a feared priest stops healing, which is
what killed all three. Note scare() is deployed but inert: no jacko on any
character or in any bank pack, and it is a Halloween candy drop (candy0,
weight 1 of ~6.5), so distance is doing all the work until one is acquired.

## v31

Kiting on, scare added, arena fence scoped. The jacko was already in two
equipment loadouts and the skill was never cast once - he carried a 5-second
aggro wipe through every fight unused, and he is the member it mattered most
for: measured 2026-09-26 at cgoo he absorbed 190 of the party's 294 incoming
hits and spent 49 of 239 one-second samples above courage 2, and a feared
priest stops HEALING, which is what killed all three. scare() counts attackers
and fires at courage, polled from maintenanceLoop - one tick of latency,
~1,500 damage into a 5,111 pool at the measured rate, which buys a cheap call
site. kiting.enabled was false; it is on, with kiteCandidateTypes() adding
anything we outrun by 1.3x to the hand-tuned avoidTypes list. The danger
radius now comes from kiteThreatRadius(), so auras count and an unknown mtype
no longer throws on .range of undefined. boundaryBox - the bscorpion arena
rectangle - was rejecting every candidate position anywhere else on the map,
so enabling kiting without scoping it would have silently done nothing outside
that box; it applies only while a hand-listed threat is the one in danger
range. cfg.moveDistance was dead config with the step hardcoded to 75; it is
wired up. debug was true and drew the fence and every tangent line each tick.
kiter() returns a boolean and the call site chains to walkInCircle() rather
than replacing it.

## v30

The inventory sorter is gone, for the reasons in Ranger v57. It pinned
tracker/computer/hpot1/mpot1/luckbooster/elixirluck/xptome to slots 0-6 from
maintenanceLoop, and since swap() is an EXCHANGE it evicted whatever the
operator dragged into one of those slots rather than just holding its own
items there. Measured 2026-09-26 on Dexon: a hand move out of a pinned slot
was undone within 500ms of landing. Nothing here depends on those positions -
no numeric index into character.items exists in this file, and the only
hp/mp-giving items held are hpot1 and mpot1, so the backwards scan in
use('hp'/'mp') has nothing to mis-pick. The tracker stays protected by
muling.excludeItems; the pin was never what protected it.

## v29

Tracktrix is no longer muled away. The item's name is tracker - Tracktrix is
only its display label - and it was absent from muling.excludeItems, so
clearInventory() handed it to Dexon, who passes everything on to Meltymerch,
who vendors at seven gold. inventorySorter here already spelled it correctly
as tracker: 0, and comparing the two files is what exposed Ranger's dead
'tracktrix' entry. Protected now on the same footing as tier-1 potions.

## v28

Chest looting starved. handleLooting() looted the first chestThreshold * 5 = 5
keys of the persisted chest map per pass and NEVER removed them, so it
re-looted the same five ids forever while everything behind them was
unreachable - the map was 9,465 entries deep on Dexon when this was measured
2026-09-25, with ~5,500 chests sitting within 800 units. Looted ids are now
collected and deleted in one write per pass, loot() is wrapped per chest so
one throw cannot abort the rest, and maxPerPass replaces the 5-per-pass cap.
This file never had the performance.now() stamp bug that Ranger v54 and Mage
v52 fix, because it has no timestamp gate at all. Looting costs no exp: loot
is not a skill and shares no cooldown with attack.

## v27

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

## v26

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

## v25

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

