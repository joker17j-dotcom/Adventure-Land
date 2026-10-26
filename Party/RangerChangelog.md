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

## v158

**ONE HOP FOR A WINDOW HOME ALSO RUNS** - from the browser session's read of the
11:00Z window of 2026-10-26. The cipher farm worked at rank 6, but Dexon hopped
twice for one window: ASIA I to ASIA II at 10:49:52Z, then home to US II at
10:57:40Z. A foreign window is due 13 minutes out and home only 10, so for three
minutes the foreign one was the only candidate. `cipherPlan()` now finds home's
usable window first, due or not, and skips any foreign window it overlaps.
Five assertions in `Tests/suite_cipher.js`. Removing the guard fails the one
that says no foreign hop is planned while home is not yet due.
-> RangerComments.md#cipherFarm

## v157

**NO HOP GOES TO A PVP SHARD, WHATEVER PLANNED IT** - the operator's standing
ruling (CLAUDE.md "Server hopping": PVP is off the table). Found while confirming,
for the browser session, why the 23:07Z horseman chain did not hop to EU PVP. That
chain was safe by construction: the reactive scanner opens no PVP socket, and
`record()` is fed only by those sockets. The lineup paths were not safe. The bridge
watches every shard, so `/schedule_live` carries EU PVP and US PVP rows, and
neither `prepCandidate()` nor `cipherPlan()` filtered them. A goobrawl preposition
or a cipher window on a PVP shard could have hopped the party there. Now:
`refreshSchedule()` drops PVP rows as it reads them, and `changeServer()` - the one
exit every hop takes - refuses a PVP shard, logs why, and tells no follower to hop.
Removing the first guard fails 2 assertions; removing the second fails 5.

## v156

**THE OPERATOR ACCEPTED v155 ON ONE CONDITION, AND `cipherBeat()` NOW MEETS IT** -
2026-10-25 21:14 EDT: "As long as the ranking is followed and actions below the
ranking do not stop actions above the ranking your proposed method is accepted."
Every other part of v155 already met it: `bossPickRanked()` drops only a pick ranked
below the cipher, a cipher hold admits a hop for anything ranked above it, and a
higher-ranked trip stops the beat. The beat did not. It repeated the leader's "no
boss" whenever the farm held the spot, so with nothing lower-ranked live it would
still override a follower's own pick of a boss ranked ABOVE the cipher once the
leader's last word went stale. It now speaks only while the leader's own pick is one
the cipher outranks. Otherwise followers behave as they did before the cipher was
ranked.

## v155

**witchcipher IS IN THE RANK TABLE AT 6, ABOVE mrgreen** - operator's ruling
2026-10-25 20:00 EDT. The table now reads dragold 1, franky 2, goobrawl 3, crabxx
and wabbit 4, horseman and graveyard 5, witchcipher 6, mrgreen 7, snowman, grinch
and mrpumpkin 8, everything else 9. The only pairs that changed order are the
cipher against mrgreen, snowman, grinch, mrpumpkin and the unranked set, which it
used to sit below. `CIPHER_RANK` (a constant one past the default) is gone;
cipherPlan, holdRank and the hold labels read `bossRank(CIPHER_EVENT)`.

**THE DEFAULT IS DERIVED**: `BOSS_RANK_DEFAULT` is one past the largest entry,
so an insertion can no longer leave it tied with the bottom group. That line is
the one place the table is enumerated; the suite allows it and no other.

**IT IS NEVER APPROACHED AS A BOSS.** `parent.S.witchcipher` is live, so
bossLiveNames() yields it, but it has no `G.monsters` entry and bossEligible()
refuses it as not cooperative. prepCandidate goes through the same gate.

**WHILE THE CIPHER OWNS THE FARM SPOT IT OUTRANKS A BOSS RANKED BELOW IT.** Before
this the rank decided nothing there: a live mrgreen or mrpumpkin made bossPick()
non-null, shouldHandleEvents() gave movement to the boss layer, and the farm spot
was never walked to. The leader now reads `bossPickRanked()`, which drops its own
pick when `cipherOutranks()` it. A trip under way ends with "the cipher gathering
outranks it", which bossEnd does not count as a give-up. bossPick() itself is
unchanged and still identical in all three scripts. A forced pick is never
dropped. The followers do not know the cipher, so `cipherBeat()` repeats the
leader's "no boss" every 8s while the farm holds the spot and no trip exists.
Their own pick would otherwise take the same mrgreen 20s after the leader's
last word. bossBeat() repeats only while a trip exists. holdRank takes the
stronger of the cipher window and a trip here.

**totBossSoon() asks the table directly** - an entry in `BOSS_RANK`, not "below
the default" - and skips witchcipher by name, so the knock route does not wait on
a gathering window. Every other entry the lineup does not name (mrgreen,
mrpumpkin, snowman, grinch, wabbit) has no schedule row, so the test cannot
reach it either way.

**A CIPHER SPOT IS SCORED BY WHAT THE BAG CAN STILL USE**: each spot's expected
drops are capped at `target` minus Meltymerch's count of that ingredient
(`useful`), and the held pick is kept or dropped by the same measure. At 23:00Z
on 2026-10-25 he held embercoal 6 and frostscale 0. By raw quantity an embercoal
spot could win on drops the bag could not use, while every recipe left needed
frostscale.

The comments around the table quote no rank numbers now; the table is the only
place the numbers are stated.

## v154

**THE MINUTE ROW'S GOLD SAYS IT IS THIS CHARACTER'S OWN SHARE** - GAMELOG `v: 4`,
in the block shared by all five scripts; the label is the only change. The
browser session saw the same "loot gold" figure on Dexon, FatherToken and MageofOz
in the same minute, on rows that carried no kills, and asked whether it was one
chest reported three times. It is not. In a party the server's chest-open path
gives each member `chest.gold * share * goldm` and sends that member its own
"N gold" line. `share` is the owner's output divided by the owner's character
count and by the party's output (`node/server.js`, upstream `2148cf25`). Our three
are one owner and the merchant counts for nothing, so each `share` is exactly a
third. So the figures are equal shares, the party's loot is the SUM of the three
rows, and a "kills: none" row is still a character's own gold. The row now reads
"own share of loot gold", so it says which.

## v153

**THE MINUTE ROW COUNTS ONLY THIS CHARACTER'S OWN KILLS** - GAMELOG `v: 3`, in
the block shared by all five scripts. The browser session found every
"[minute] kills" row written identically on Dexon, FatherToken and MageofOz
within 1-3s. The server sends a party member's kill through `party_emit` to
every member on the shard (`kill_monster`, upstream `2148cf25`), so each of the
three was counting the party's total. A kill line now counts only when its
killer is "You" or this character's name; the others are dropped from the file
as before and still shown. The gold line is unchanged: in a party the server
sends each member its own share of a chest, so it was never repeated. The three
rows now add up to the party's kills. `v` moved so a page state from v2 is
rebuilt on the next load.

**A BOSS IS HELD OFF FROM GROUND IT CAN REACH** - `bossHoldSpots()`, new, and
`bossPosture()`, byte-identical in Ranger, Priest and Mage. `bossPosture()`
moved to one point: `hold` from the boss on our bearing. The browser session
counted "cannot hold off mrgreen: failed" 24 times in 19 minutes on
2026-10-25, each a smart_move "Path not found". Now the ring at `hold` is tried
every 30 degrees from our bearing outward. A point is kept only if the boss can
walk to it in a straight line (`can_move`), which puts it on the boss's side of
every wall. Points we can also reach in a straight line come first, and points
inside a rage box are dropped. Each refusal moves the next try one place down
the list, so a refused spot is not asked for again every tick. A new boss
starts at the top. With no `can_move`, or nothing passing, it moves to the
bearing point as before. This addresses the near side of the mrgreen failure
only: whether the failing walk from the farm spot was this, or the two-leg
route from v140, was not separated in the log, and the second is unchanged.

## v152

**`sellItems()` SELLS ONLY BESIDE A MERCHANT NPC** - `sellerInReach()`, the same
rule the server's "sell" handler uses: an npc with a single `position` and an
`items` list, within 380 of the server's 400. The browser session recorded 14
minutes on Dexon on 2026-10-25: 389 of 389 "Get closer" refusals were
`{place: 'sell', reason: 'distance'}` from `maintenanceLoop -> sellItems -> sell`
(pstem 260, stramulet 30, wgloves 3), about one every two seconds while one sat
in the bag - the source of the 19,000 overnight lines. v141's `vendorInReach()`
gated buys only. The whitelist now waits in the bag until the next town visit.

**THE GAME-LOG FILE STOPS TAKING FOUR KINDS OF LINE ONE BY ONE** - the operator's
rulings of 2026-10-25, in the GAMELOG block shared by all five scripts (`v: 2`).
The screen is untouched; only the file changes.
- The pathfinder's "Searching for a path...", "Path found!" and "Path not found!"
  become one `[minute] pathfinder` row a minute, with a count of each. They arrive
  as `script` lines, so they are counted whatever their source. "Lost the path..."
  is not one of the three and is still kept line by line.
- The game's "<X> killed a <Y>" and "N gold" lines become one `[minute] kills` row
  a minute per character: each monster with its count, and the window's loot gold
  as one total plus the number of drops. Only lines the GAME wrote are summarised;
  our own `game_log()` and "Received N gold" are kept as they are. The row carries
  `kind`, `window_start`, `window_end`, `kills`, `gold` and `gold_drops`, which the
  bridge files under `extra`.
- The open minute is written out on `pagehide`, so a hop or a reload loses none
  of it, and each flush closes a minute that has run out.
- `gamelogScreenOnly()` / `gamelogQuietly()` show a line and keep it out of the
  file; `gamelogFileOnChange(name, source)` keeps a matching line only when its
  text changed since the last one kept under that name, remembered per character
  across hops in `gamelog_seen_<name>`.
A page state left by an older build is now rebuilt on the next load (`v`), with
its lines, its open minute and its rules carried over; until now a page-realm
state was reused as it was, so a runner restart would have kept the old capture.

## v151

**ONE RETREAT TAKES THE PARTY OUT OF THE RAGE BOX, AND HOLDS IT OUT FOR 60s.**
The operator left the retreat-at-3 question to this session's judgement on
2026-10-25. At the 12:30Z EU II graveyard two of three entries ended inside 5s on
"too many on me", with FatherToken terrified each time - so 3 is not early, and
`retreatAtAttackers` stays at 3. What changed is what follows a retreat:
- a follower that retreats tells the leader (`rageentry` with `retreat: true`);
  the leader takes everyone out and says so at once;
- `retreatHoldMs` (60000): after anyone's retreat on bodies, nobody re-enters
  until it has run. Before this a follower obeyed the leader's standing "in" as
  soon as the bodies dropped and walked back into what drove it out, and the
  healer alone outside the box is the party split entry was built to prevent.

## v150

- **A WAY OUT OF A RAGE BOX FOR A CHARACTER ALREADY IN ONE.** Measured by the
  browser session at the 12:30Z 2026-10-25 EU II graveyard: when rage entry
  ended, every walk toward the join spot (255,-1030) was refused as cutting
  through the box, on all three, because `rageRoute` seeds from the nearest
  open cell within 14 cells and the field is further in than that. The
  containment guard's own escape aimed at the NEAREST edge, which from the
  field is the wall to the north. `rageExitPoint()` picks the exit: the four
  edge points `rageEscape` considers plus each edge's point nearest the
  destination, dropping any inside another box or not standable, and
  preferring one a straight leg reaches. `rageWaypoints` walks that exit leg
  first and routes on from it; `rageGuard` exits toward the park point it is
  working. A leg that only exits cannot cut through anything.
- **NO PULL FOR A TRIP ON ANOTHER MAP.** `ragePullCtx()` fell back to the farm
  when a trip's target was elsewhere, so at 06:30Z on ASIA I the pull worked the
  booboo override on spookytown while the trip walked to crabxx on main. Dexon
  and MageofOz died in the west booboo box. A trip elsewhere now leaves the
  context empty and the pull idle.
- **A FARM WALK IS STOPPED, NOT ONLY ORPHANED.** `travelCancel()` bumps the
  attempt and calls `stop('smart')`; the watchdog uses it, and `bossApproach`
  calls it first, so a trip takes the wheel from a farm walk still under way.
  12:00Z EU I: a travelTo for the farm spot outlived the goobrawl join and
  walked Dexon out of the event four times; bumping `attemptId` alone left the
  game walking.
- **A REFUSED POSTURE OR FIELD-SPOT MOVE IS NOTED, NOT THROWN.** "Path not
  found!" rejected out of `bossTick` 275 times on 2026-10-25, ending the tick.

## v149

**GOOBRAWL ALONE AT 3, THE OPERATOR'S RULING 2026-10-25 08:17 EDT.** It tied
crabxx and wabbit; everything below it moves down one: dragold 1, franky 2,
goobrawl 3, crabxx and wabbit 4, horseman and graveyard 5, mrgreen 6, snowman,
grinch and mrpumpkin 7, `BOSS_RANK_DEFAULT` 8, so `CIPHER_RANK` follows to 9.
Prompted at 12:09Z, when a rank-3 crabxx pulled the party out of an EU I
goobrawl. Hop settings unchanged. Every pairwise order holds except goobrawl
now above crabxx and wabbit, and the suite lists exactly those pairs as the
allowed change. All four copies moved together (Ranger, Priest, Mage,
`Codex/boss_timers.html`).

## v148

**THE CIPHER FARM'S THREE LIVE DEFECTS**, measured by the browser session over
the 05:00Z and 11:00Z windows of 2026-10-25, in which nothing was farmed.
-> RangerComments.md#cipherFarm
- **The count is kept across a hop, aged from when Meltymerch counted, and
  asked for.** It lived only in memory, so every hop wiped it - 14 "no fresh
  count" lines in one night. It is now in the scoped `cipher_stock` key, read
  back once per page; its age is the report's own `at`, so a message the bridge
  held for a character mid-hop arrives as old as it is, and an older report
  arriving after a newer one is ignored. While the count is stale Dexon sends
  `cipher_stock_request` to Meltymerch, at most every `askEveryMs` (2 min).
  Merchant v132 is the other half.
- **The pick no longer flips at the opening.** Its key held the window's exact
  start, which moves from the schedule's `at` to `S.witchcipher.start` a few
  seconds later, so every opening re-picked: arcticbee@winterland (20.8
  expected, already walked to) for spider@main (19.6) at 11:00:10Z. The key is
  the five-minute bucket now, and a real re-pick keeps the held spot unless the
  best is more than `switchFactor` (1.25) better, scored from where we stand.
- **No hop into a window a hop target opens inside.** `cipherPlan()` refuses a
  window that needs a hop when `targetOpensWithin()` finds a `bossHop.targets`
  event scheduled to open, on any shard, before the gathering ends. The 05:00Z
  EU hop landed the party where the US horseman pulled it away from at 05:00:09.
  Horseman meets a gathering window three times a day. Home and the shard we
  stand on need no hop and still farm until the boss calls.
- **No rage pull while dead.** `ragePullTick()` returns at once on `rip`; both
  followers had logged "pull tick threw: unable" several times a second while
  dead at the 06:30Z graveyard. Same line in Priest v81 / Mage v104.

## v147

**CIPHER FARMING HAS NO SEASON END**, operator 2026-10-25: the cipher stays in
the daily rotation after Halloween, so the farming does too. The season gate is
gone from `cipherIdleReason()` and `bossHop.cipherPlan()`, and
`cipherSeasonOpen()` with it. Merchant v131 keeps the ingredients in his bag
year-round, so the count Dexon reads stays meaningful.
-> RangerComments.md#cipherFarm

## v146

**WITCH'S CIPHER INGREDIENT FARMING**, operator's rulings 2026-10-24 18:49-18:59
EDT. -> RangerComments.md#cipherFarm
- **Trigger.** Meltymerch reports his own bag's counts of verdantspore,
  frostscale, embercoal and gloomfeather (`cipher_stock`, Merchant v130).
  While any is under `CONFIG.cipherFarm.target` and a gathering window is open
  on this shard - read exactly from `S.witchcipher`, or from `/schedule_live`
  before it opens - `cipherTick()` points the farm spot at the best spawn for
  what he is short of. No count, a stale one or a name missing: nothing.
- **Which monster.** Expected quantity in the window after the walk: the xp
  scorer's kill model (now `farmSpotKill()`, shared with `scoreAllFarmSpots`)
  times `loot * hp / 1000`, over the gathering left once there. The monster
  list is read live from `G.events.witchcipher.ingredients`.
- **Which shard.** `bossHop.cipherPlan()`: a hold here at `CIPHER_RANK`, one
  below every boss, and a hop to another shard's window as the last branch of
  IDLE. Off-shard it leaves early enough to clear hop sickness by the opening;
  home is preferred inside home's own window. Arriving for it returns to IDLE,
  never FIGHTING.
- **Ownership.** A hand-set override outranks it; the achievement queue and
  the monster hunt wait while it holds the spot.
- Toggles `cipherFarm` and `cipherFarmHop`. Ends with Halloween.
- `Tests/suite_cipher.js`.

## v145

**THE GRAVEYARD STAND, THE WAY OUT OF THE BOX, AND AN IDLE LEADER IS OBEYED** -
from the browser session's 22:30Z EU III graveyard, 2026-10-24, and the
operator's rulings on it.
- **Field spot.** With rage entry on, `bossApproach` holds `BOSS_FIELD_SPOTS`
  (graveyard: (256,-1430), the centre of the 24 graves) within
  `BOSS_FIELD_HOLD` 40 and lets the attack loop shoot from there, through the
  waves and after the wake. Entry used to walk all three onto the Gargoyle
  spawn (255,-1545) eight seconds into wave 1, because `S.graveyard` publishes
  that point and the rage guard in `bossWalkTarget` is off while entry is on.
- **Escape ladder.** When `rageGuard`'s pathfinder fails, `rageEscapeLadder()`
  tries (1) a straight-line `move` to the escape point or to a join spot on
  this map, wherever `can_move_to` is true; (2) that event's join, once per
  stay, only while it is live, then waits 6s for the teleport; (3) town, at
  most every 20s, whatever is on us. A town channel is never cancelled by a
  move. Dexon sat on the spawn for eight minutes on "Path not found!" with
  `can_move_to(255,-1030)` true, and he and the mage died inside after the
  event. Every failure now logs through `errText`, not "[object Object]".
- **An idle leader says "no boss".** `bossRecast()` repeats a null on its 8s
  beat when there is no trip, and a follower's `bossPick()` takes a fresh null
  as the answer instead of picking for itself. MageofOz went to franky alone
  twice on EU III, on his own type-wide reading, while Dexon had given up on it
  there, and died both times. A forced call still outranks it; a stale null
  still releases the follower, as before.
- The retreat itself (`retreatAtAttackers` 3) is unchanged; its numbers are
  the operator's to set.

## v144

**THE CAVE MAIL CLAIMER NEVER SAW A LETTER, AND IT THREW INTO THE GAME LOG ON
EVERY READ.** Found by the browser session after the first automated cave run,
2026-10-24: "pull_mail returned no list" on all three, and "Uncaught
ReferenceError: handle_information is not defined, Line 22, Column 14" right
after each hand-back. Read from upstream `16881a2`: `pull_mail_api` returns
`{success: true}` and puts the letters in `infs` as `{type: 'mail', mail}`. The
game's `api_call` deletes `infs` before resolving and then hands them to
`handle_information()`, which exists in the top window and not in the CODE
frame. So the claimer read an object with no `mail`, and the frame's copy of
`api_call` threw. Column 14 is where `handle_information` sits after three tabs
and `if (infs) `; the frame's copy is served from `common/js/common_functions.js`,
which is not in the upstream repo, so line 22 is inferred rather than read.
`caveMailList()` now POSTs to `/api/pull_mail` directly, the way the merchant
reads `pull_merchants`, and takes the list out of `infs`. An empty mailbox is
now a quiet zero. The test fixture had `api_call` returning `{type: 'mail',
mail}`, a shape the game never produces, which is how the suite passed while
every live read failed; it now serves the server's real shape.

## v143

**A BOSS TRIP IS NOT A FARM VERDICT.** The browser session counted 46
follower requests to blacklist the farm spot in one day (2026-10-24), one every
~3 min during mrgreen trips and just after, each "0.00 xp/s over 3 min". The
earlier fix was still in place: the follower re-baselined only when OFF the
farm map. The booboo spot and mrgreen are both on spookytown, so a follower
standing at the boss, earning nothing until it died, counted every minute
against the spot. Dexon turned every request down only because that spot
happens to be whitelisted; on any other spot it would have been blacklisted
mid-trip. **The guard keyed on WHERE the character was, not on WHAT IT WAS
DOING**, and the two only coincide while the boss's map differs from the
farm's.

`farmVerdictHeld()` is true during any trip (`bossState.trip`, and on the
ranger a non-IDLE `bossHop`) and for `FARM_VERDICT_GRACE_MS` (3 min) after,
which covers the walk back. `bossBeat`'s timer keeps it current. It is
byte-identical in all three scripts.
- The followers' `checkOwnXpEconomics` treats it like being off the map, and
  also drops the streak, so the first post-trip verdict needs three fresh
  minutes.
- Dexon refuses `blacklist_spot` while it holds, logging the refusal: the
  receiver validates whatever the follower's build.
- His own gold check in `checkFarmEconomics` holds the same way, so a boss
  near the farm spot cannot trigger a re-search.

## v142

**RAGE ENTRY ENDS WITH THE TRIP.** Measured 2026-10-24 16:41 EDT by the
browser session: the graveyard ended and both followers were still in entry
mode, with containment off, parked beside the mummy box seven minutes later. A
follower's trip ends through `bossOnCall` ("the leader moved on"). `bossPick()`
is then null and `shouldHandleEvents()` goes false, so `bossTick`, which held
both the reset and the follower's trust timeout, never ran again. Now `bossEnd`
calls `rageEntryEnd()`, which clears the state on every character and has the
leader send an explicit "out". `rageEntryExpire()` drops a follower's stale
"in" from `bossBeat`'s own timer, which runs whether or not there is a trip.

**A JOIN IS A TAXI TO THE EVENT, NOT A WAY TO STAY AT IT.** The server teleports
anyone more than 200 from the join spot back onto it, so a join sent from inside
the fight pulled the party out of the box: the operator watched Dexon teleport
out. `bossJoinWanted()` joins only from another map or from more than
`BOSS_JOIN_NEAR` (1000) across this one, never while rage entry is on, and never
on goobrawl's own map. Otherwise the approach walks on, as it already did while
hop-sick.

**ERRORS READ.** `errText()` keeps a game rejection's reason and adds its scalar
fields (`place` and the rest), so "tick threw: failed" and "pull tick threw:
[object Object]" now say where.

**NO ELIXIR FROM THE BAG.** Operator's ruling, 2026-10-24: an elixir in the
elixir slot may be used, but a script never drinks or equips one from the bag
and never buys one. `elixirUsage()`, which drank `pumpkinspice` from the bag,
is gone.

**sbelt IS SCARCE.** Operator, 2026-10-24: added to `SCARCE_ITEM_NAMES`, which
both sell paths consult. A third Belt of Hallowed Trials was muled to Dexon, and
the ranger had named it nowhere. Whether three +0 copies get compounded is the
operator's call and is not touched here.

**ACHIEVEMENT QUEUE: A SECOND booboo SPOT FIRST.** The operator's
`{ m: 'booboo', map: 'spookytown', x: -530, y: -785, rung: null, also: [] }`
goes at the top of the queue, for now, because the corridor spot has
competition. The saved position is an index, so a saved 0 now means this entry;
`achvReset(n)` if it was anything else.

## v141

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

The licence buy, and the scroll buys in `upgradeItems` and `combineItems`, use
it too, with a reason. The licence one was an `await buy()` that a refusal threw
out of `mainLoop`, losing the tick.

## v140

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

And the boot `achvTickRun()` is deferred a turn: inline, it ran before `let mhToggle`
was initialised and threw once per page load.

## v139

**RAGE ENTRY HAS TWO LINES AND A DWELL, BECAUSE ONE LINE FLAPPED.** Measured
live by the browser session 2026-10-24 12:30 EDT on US II: entry opened from
wave 1 as v137 intended, then the party walked in and out of the box with the
20s average sitting right at `minSoaked` while the raw count swung 0-17 -
inside for 2s, 16s, 24s, 4s, then 106s, about a quarter of the window. Now the
leader enters at an average of `minSoaked`, stays until it falls below
`leaveSoaked`, and stays at least `minInsideMs` either way. The retreat on
`retreatAtAttackers` bodies is not subject to the dwell. Identical in all
three scripts; the gate's values are in `CONFIG.bossEvents.rageEntry`.

The followers' half of the same build, Priest v74 / Mage v97, gives them the
ranger's ranked `bossPick` - see their changelogs.

## v138

**SNAKEOIL IS NEVER SOLD** - added to `SCARCE_ITEM_NAMES` on the browser
session's finding, 2026-10-24. It is the only Hop Sickness cure, and relief's
cheapest-first list sold it early at ~120.

## v137

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

**CAVE AMBER AND THE LOADED DIE ARE NEVER SOLD** - added to
`SCARCE_ITEM_NAMES`, operator's ruling 2026-10-24. Amber vendors for 120, so it
sorted first in relief's cheapest-first list.

## v136

**BOOBOO IS BACK IN THE ACHIEVEMENT QUEUE AND THE PULL KNOB GOES 1 -> 3**, on
the operator's ruling 2026-10-24: with the bank holding so many dexbelts,
booboo's drop is now what limits windbelt production. Two config edits, no
logic changed:

- The first queue entry, `{ m: 'booboo', map: 'spookytown', x: 290, y: -990,
  rung: null, also: ['mummy'] }`, is uncommented. It is the verified corridor
  park point outside both spookytown rage rectangles, `rung: null` so it runs
  until the toggle goes off or `achvStop()`, and `also` farms the mummies from
  the same spot.
- `CONFIG.achievements.pull.concurrent` 1 -> 3. **It counts every pulled type
  together** (`rageEngagedCount` filters on the whole `ragePullTypes()` list),
  so on this entry three is booboo and mummies combined, not three of each. It
  reaches the priest and mage as `pullConcurrent` with the farm spot
  (`ragePullShared`), so the followers' gate rises with it. The comment above it
  puts the healing ceiling at roughly four, so 3 is one step under it;
  courage still caps attackers per character independently.

**THE QUEUE'S SAVED POSITION IS AN INDEX, AND UNCOMMENTING ENTRY 0 SHIFTS
EVERY OTHER ENTRY UP BY ONE**, so a saved index now names the entry BEFORE the
one it was on, and on a saved index above 0 booboo is never reached at all.
`achvReset(0)` once after the deploy puts the queue on booboo (it also clears
the done list).

## v135

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

## v134

**v132's EVENT-TRIP HOLD BLOCKED THE CROSS-SHARD CHAIN, AND IS NOW LIMITED TO
EVENTS bossHop DOES NOT HUNT.** holdRank() treated any live boss-event trip
here as a reason to admit only a strictly better hop - including a trip on a
bossHop target. When localTarget() declines the horseman here (its share
unreachable), the right move is the equal-ranked hop to a horseman elsewhere,
and the hold refused exactly that. Found by reading the browser session's
kill-order data, which was the first time the chain was looked at since v132.
A trip on a target is now left to localTarget()/FIGHTING; graveyard, goobrawl
and mrgreen still hold.

**AN UNREACHED DOOR NOW CARRIES ITS REASON** into `totStatus().last.failed`, as
`<door>:unreached:<last error>[ on <map>] after <n>`. The first spookytown
route's reason was lost because totLog writes the game log only, and that had
scrolled. Same as Merchant v124.

## v133

**PREPOSITIONING IS NARROWED TO JOIN-ONLY EVENTS, ON THE OPERATOR'S RULING.**
"I only want hopping in advance for events that entrance requires no hop
sickness or if doing it offers benefits that make it worth it. At this time I
think the only qualifying item is goo brawl." v132 planned for every ranked
event off home, which would have hopped the party ahead of crabxx, franky and
horseman several times a day. Those can all be walked into while sick. The
reactive hop already reaches them within minutes of spawn and checks the
dwell, which the planner does not, and a v132 hold could have parked the
party off home for a full 40-minute window the dwell check would have
refused. `CONFIG.bossHop.preposition.alsoFor` ships empty and is where a
walkable event goes if arriving early is ever shown to pay. The event-trip
hold from v132 is unchanged. Three mutations, each caught.

## v132

**THE PARTY PREPOSITIONS FOR A SCHEDULED EVENT, AS THE OPERATOR RULED.** It
had not: the ruling sat in `CLAUDE.md` with nothing implementing it, and the
party sat home through the 09:00 EDT ASIA goobrawl on 2026-10-24. bossHop now
reads the bridge's `/schedule_live` every 30s. When an event with an explicit
rank comes due on another shard - nothing outranking it, nothing equal on home
- Dexon hops there, and the followers come along. A join-only event (goobrawl)
leads by the full hop sickness, so the join is open when the event starts;
anything else leads by `walkLeadMs`. A trip that could not engage with
`minUsefulMs` of window left is refused rather than taken.

**AND THE PARTY NO LONGER GOES HOME OUT OF AN EVENT FIGHT.** `goHomeIfIdle`
only ever looked at `bossHop.targets`, so a graveyard, goobrawl or mrgreen trip
live on a foreign shard counted as "nothing eligible", and the party hopped
home 90s in. `holdRank()` keeps it there while a plan is for this shard or an
event trip is live here, and lets only a strictly better-ranked hop through.

`CONFIG.bossHop.preposition`, toggle `bossHopPreposition`; `prepStatus()` on
the console and on the feature probe. Off, behaviour is v131's except for the
event-trip hold. Not done: a plan does not interrupt FIGHTING, which still
exits on death or hard abort only. 13 mutations, each caught in
`Tests/suite_bosshop.js`. -> RangerComments.md#preposition

## v131

**DOOR STAND POINTS ARE KEPT ACROSS A RELOAD, IN A STORE SHARED WITH THE
OTHER KNOCKER.** The browser session's finding on the v122 route, 2026-10-24:
every spookytown door point was refused once per door and then knocked from a
ring point, exactly as designed - and the cache of those ring points was lost
to the hop that followed, so the next route would pay the same five dead
probes. `TOT_STAND_KEY` (`tot_stand`) now mirrors the in-memory map, read at
the start of every walk and written when a new point is learned or a stale one
dropped. It is SHARED on purpose: a stand point is a fact about the map, and
the ranger and the merchant knock the same doors. A stored point is used only
if it is finite and still within reach of its door, so a bad value costs one
probe. A newly learned point is logged once as its offset from the door.

Same change as Merchant v123. Six mutations across the two scripts, each
caught in `Tests/suite_trickortreat.js`; the key is classified shared in
`Tests/suite_bosshop.js`.

## v130

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

## v129

**THE SPOOKYTOWN DOORS ARE KNOCKED FROM A STAND POINT, BECAUSE THE DOOR
POINTS ARE NOT PATHABLE.** Captured live by the browser session on Dexon's
second route, 2026-10-24: the trip onto spookytown arrived, then all five door
legs returned smart_move's "Path not found!" within about 2s and the route
ended `0 knocked - failed 2:unreached 3:unreached 4:unreached 6:unreached
5:unreached`. Halloween door 0 had been walked to exactly that morning, so the
fault is the door coordinates, not the map, the move cap or a rage box (all
ruled out live). The server's door test is distance only - within 80 of the
player, no line of sight, `trick_or_treat_door` in `halloween_events.js` - so
any pathable point in reach will do.

- **`totWalk(d)` tries stand points in order** (`totStandPoints`): the point
  that worked last time, the door itself, then rings at 40 and 65 units, eight
  directions each, south first as an unmeasured guess. The first one that ends
  within 80 of the door is cached per door for the rest of the session.
- **A failure that leaves the character off the door's map ends the door**,
  since that is the trip failing and a nearer point cannot fix it. Once on the
  map the probing as a whole is bounded by `moveMs`; that bound is a hang guard
  and is not exercised by the suite.
- **One log line per unreachable door**, naming how many points were tried and
  the last reason, instead of one per probe - so the game log keeps the
  "Path not found!" lines that diagnosed this.
- `totNear` and `totStandPoints` are byte-identical in Ranger and Merchant and
  the suite fails if they drift.

Same change as Merchant v122. Eleven mutations across the two scripts, each
caught in `Tests/suite_trickortreat.js`.

## v128

**`totStatus(true)` READS THE KNOCK ROUTE'S STATE WITHOUT LOGGING.** The
browser session's report, 2026-10-24: `totStatus()` writes a `[tot]` line on
every call, so a 2s sampler polling it filled the ~100-line game log and
scrolled the real `[tot]` lines - the ones carrying a route's failure reasons -
out of it, which is how Dexon's failures were hidden before. The logging form
stays for the console; a truthy argument returns the same object silently.
Nothing else changed.

## v127

**TRICK OR TREAT: DEXON KNOCKS HIS SEVEN DOORS.** The operator's spec of
2026-10-23, built on the browser session's live test of 2026-10-24. The
account gets fourteen knocks a day and each character seven, so Dexon and
Meltymerch between them take the lot. `totTick()` every 20s starts a route when
the season is open, `character.trickortreat.doors_left` is above zero, no boss
or event is on (`shouldHandleEvents()`), bossHop is IDLE, nothing else owns
movement, and no RANKED event opens on this shard within `leadMs` (5 min).
**graveyard is excluded from that lead check on purpose**: the route ends in
spookytown, which is where the graveyard is, so a run just before one is the
operator's "on the way to a graveyard trip". Unranked events (abtesting,
icegolem at the default rank) do not hold a route back.

**The route owns movement like the Daisy trip** - `totBusy` stands mainLoop
down, and it takes the wheel from a farm trip already in flight. It re-checks
`shouldHandleEvents()` before every door and stops the moment a boss or event
wants the party, so bossHop never waits longer than one door. Doors are walked
current map first, then halloween, then spookytown, nearest-first.

**The costume goes on at the door and comes off after the knock SETTLES**,
through `equip(idx)` both ways, in a `finally` so a knock that throws still
gets the ordinary helmet back. No costume in the bag means a bare knock (70%
rather than 85%); one already worn means no swap. While a route runs, muling,
`sellItems()` and relief all stand clear, because the swapped-out helmet sits
in the bag for a moment.

**`doors_left` only decides whether to set off.** It can overstate on a shard
that did not see the account's knocks (measured: the merchant on another shard
was not updated), so `trickortreat_limit` is what stops a route, and it holds
for the UTC day. `trickortreat_knocked` skips the door; `trickortreat_season`
pauses an hour; `cant_in_bank` stops. A route that ended with FAILED doors
retries after `retryMs` (10 min).

`totStatus()` from the console says what the tick sees and how the last route
went; it is on `PARTY_BUILD`. `Tests/suite_trickortreat.js`, eleven mutations
named, each caught.

## v126

**COMMENT ONLY - NO BEHAVIOUR CHANGE, REDEPLOY WHEN CONVENIENT.** The block
above `COSTUME_ITEM_NAMES` still argued for protecting all three costumes after
the operator narrowed the set to `horsemanpumpkin` on 2026-10-23, and it quoted
G's `g` (phelmet 72,000, gphelmet 32,000, horsemanpumpkin 4,800,000) as vendor
prices. The browser session measured `calculate_item_value` live: phelmet+0
43,200, gphelmet+0 19,200, horsemanpumpkin+0 2,880,000 - an NPC pays 60% of `g`
at +0, and Ponty charges twice `calculate_item_value`. The comment now says
which costume is kept and why, with the measured figures.

## v125

**THE FOUR WITCH'S CIPHER INGREDIENTS ARE NEVER SOLD** - verdantspore,
frostscale, embercoal, gloomfeather - operator's ruling 2026-10-23. Read from
upstream `16881a27`: they drop ONLY during the first 20 minutes of a cipher
round (`witch_cipher_loot(on)` adds the drop rows at round start and strips them
at gather end), each mix consumes five, and an account gets five mixes a UTC
day. So a sold stack cannot be re-farmed until the next round. At g 1200 each
they sit well inside what relief reaches.

`CIPHER_INGREDIENT_NAMES` / `isCipherIngredient()` is its own set, beside the
costume and scarce sets rather than merged into either, for the reason those
two are separate: one set, one reason. Consulted in `reliefSellable()` and
`sellItems()`. Pinned in `Tests/suite_merchantsell.js` with a same-value control;
removing either call fails by name. Not on any sell whitelist, asserted on all
three files that carry one.

## v124

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

**THE RANGER HAD A SECOND GATE THE HANDOFF DID NOT LIST, IN `updateCache`.**
`if (!destination) return;` at its top left `cache.targets` EMPTY - and
`handleAttack` with nothing to shoot - on any trip that started before the farm
search answered, which after a hop is every one of them. `destination` shapes
ONLY the `clumped` bucket (measured off the farm spot), so that bucket now stays
empty without one and `sortedByHP`/`inRange`/`outOfRange` populate regardless.
Lifted with `destination` null: a monster in range lands in `inRange`, not in
`clumped`; restoring the early return fails two assertions.

**THE LEADER'S FIRST FARM-SPOT BROADCAST WAITS FOR ONE BOSS EVALUATION AND ONE
ACHIEVEMENT TICK.** `farmBootBossEval` latches in mainLoop immediately after
the event test (so a tick that returned early on jail or a potion emergency
does not count), `farmBootAchvTick` latches when `achvTick()` SETTLES, and
`sendFarmSpot` refuses until both are set. `achvTick()` is now called at boot
through `achvTickRun()` rather than first at `reassertMs` (30s), so the queue's
choice is in before the spot goes out. The achievement latch is on settle rather
than success deliberately: a throwing tick is already logged and must not hold
the farm spot hostage, and the tracker refresh inside is noHang-bounded so a
hang cannot either. Ten mutations, ten named failures.

**`BOSS_FIGHT_TYPES.horseman = ['horseman', 'jackowalker']`**, the operator's
2026-10-23 hand edit to the Ranger slot, carried into all four copies (Ranger,
Priest, Mage, `Codex/FamilyFleet.js`) so the next deploy does not revert it and
the relay divergence check stays green. `bossCooperative()` is any-of over the
row, so the jackowalker's own flag cannot remove the horseman.

## v123

**THE GIVE-UP REASON IS PERSISTED, BECAUSE A HOP TRIP ALWAYS ENDS IN THE
RELOAD THAT DESTROYED IT.** `bossEnd` stored `lastGiveUp` with a comment saying
it is "kept" for the next window - kept in memory only, while the blob on disk
carried `{trip, cooldown, giveUps}`. A hop trip ends in the hop home, which is
a page reload, so for every trip bossHop makes the reason was gone before
anyone could read it. Measured by the browser session 2026-10-23: twenty
minutes on ASIA II, give-up at 16:21:05Z, franky despawned untouched at 100%,
and the why had to be reconstructed from a cooldown timestamp. One field on
the same save path, restored in the load block, now carrying `startedAt` and
`deaths` too so the duration and the cause are a read and not an inference.
Ranger-only: Priest and Mage never had `lastGiveUp`.
**WHAT THIS DOES NOT ANSWER: why twenty minutes on shard produced zero
damage.** franky stands on level2w and the party lands on spookytown; whether
`bossWalkTarget` resolved or the walk stalled is not recorded by anything,
and the next trip will say what the give-up was, not what happened before it.

## v122

**A CLEAR IS NOT AN ABSENCE, AND v120's MIGRATION TURNED `mhForget()` INTO A
NO-OP THAT RESURRECTS THE OLD TOGGLE.** `scopedGetLegacy` adopts the legacy
key when the scoped one reads null, which is right for a key nothing has ever
written and wrong for one deliberately CLEARED - and `mhForget()` clears
`mh_state` by writing null, while `mh_state` is on the migrating list. So the
sequence clear, reload, read returned the pre-deploy stored toggle, and the
console command that exists to stop following a stored choice silently
restored one.
**`get()` CANNOT TELL THE TWO APART AND THAT IS THE WHOLE DIFFICULTY.** It is
`JSON.parse(localStorage.getItem('cstore_' + k))`, so a missing item and a
stored `"null"` both arrive as null. `scopedHas()` reads the RAW item, which
is the only thing in reach that separates them - the same `localStorage` the
game's own `set`/`get` use, so the catch around it cannot be the Form B lie:
`get()` above would have thrown first.
**THE OBVIOUS REPAIR IS THE WRONG DIRECTION, WHICH IS WHY IT IS WRITTEN DOWN
AT THE CALL SITE.** Making the clear DELETE the key instead of writing null
looks like the fix and merges the cleared state INTO the never-written one,
so the fallback fires exactly as before. Only an explicit presence test
separates three states that one null reading collapses.
**FIXING THE CALL SITE WOULD HAVE BEEN A COINCIDENCE WITH GOOD TIMING.**
`mhForget()` is the only clear-to-null on a migrating key today;
`PL_HOP_PENDING_KEY` is cleared the same way and is safe only because it is
deliberately not migrating. A guard that holds because of which keys happen
to be cleared this week is the `GEAR_PROGRESSION` repeal in another costume.
Found by the browser session, who reported `set(key, null)` not deleting as a
property of the namespace after their own cleanup left four keys present and
null - a storage observation, not a code review, and it landed on code they
had not read.
**AND THE FIVE SCOPING HELPERS WERE ON NO DIVERGENCE LIST**, because they were
trivial when written. One of them stopped being trivial here. A function joins
that list when it stops being trivial, not when it is written, and nothing
prompts the review except noticing it; a PRIEST-only drift now fails.

## v121

**THE TRICK-OR-TREAT COSTUMES ARE PROTECTED, AND THE OPERATOR'S TWO HALVES OF
THE ASK TURN OUT TO BE OPPOSITES.** They asked to protect the costume piece AND
the normal gear for that slot. **THE EQUIPPED ONE NEEDS NO WORK AT ALL**: every
sell path on both characters iterates `character.items`, and `character.slots`
is never a sell source anywhere in either file - so an item being worn is
unreachable by construction. What needs a guard is whichever helmet is NOT
worn, which is the costume between routes and THE NORMAL GEAR during one.

**THE SLOT IS NOT A CHOICE.** `trick_or_treat_settle` reads
`player.slots.helmet` against `G.events.trickortreat.costumes`, and phelmet,
gphelmet and horsemanpumpkin are all `"type":"helmet"` at upstream `16881a27`.
So the costume must be EQUIPPED - holding it does nothing - and the slot
question is answered by the game.

**THE COSTUME IS REACHABLE TODAY, BEFORE ANY ROUTE EXISTS.** `reliefSellable()`
sorts ASCENDING by `calculate_item_value` and refuses only `level > 0`.
gphelmet vendors at 32,000 against the 30,000 dexbelt+0 this repo already
measured a relief run reaching; phelmet is 72,000. horsemanpumpkin at 4,800,000
is safe by SORT ORDER, which is not a guard. A usable piece arrives from
ordinary farming at +0 - exactly the level relief takes.
`COSTUME_ITEM_NAMES` is read by `reliefSellable()` and `sellItems()`, and the
three names join the merchant's `PROTECTED_ITEM_NAMES` because a mule hand-off
is where they would otherwise meet the aggressive pass, which has no level
check.

**KEPT SEPARATE FROM `SCARCE_ITEM_NAMES` ON PURPOSE.** That set means "not
plentiful"; this one means "the event wants it worn". One set read by two rules
for two reasons is the hazard already recorded against `alwaysAttack` and
`pontyWanted`, so the disjointness is asserted rather than left to the next
editor.

**WHAT IS NOT BUILT, AND WHY IT IS NOT A SMALLER VERSION OF THIS.** The normal
gear is exposed only WHILE the costume is worn, and `CONFIG.selling.whitelist`
names four helmets - `helmet`, `helmet1`, `hhelmet`, `oxhelmet` - against a
`sellItems()` with NO level check, so unequipping one of those at any level
vendors it on the next maintenance tick. The whitelist is the operator's and is
CLOSED, so the fix is not an edit to it; it is a guard on what came OFF, which
is state the equip code owns and the equip code does not exist. Flagged rather
than guessed at.

Three mutations, three named failures: the relief guard removed (3), the
`sellItems` guard removed (1), one name dropped from the merchant's set (1).
The relief assertion carries a CONTROL - an unprotected +0 item at the same
vendor value, which must still be offered - because without it the test passes
against a relief that sells nothing at all.

## v120

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

## v119

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

## v118

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

## v117

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

## v116

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

## v115

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

## v114

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

## v113

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

**AND THE SIX FUNCTIONS JOINED THE DIVERGENCE LIST.** None was on it, all three
copies were identical before this, and a copy that drifts now means one
character pulling for the farm while another pulls for the boss. The measured
failure these replaced logged NOTHING at all, which is what makes the drift
worth asserting rather than trusting: reverting the boss context on the Priest
alone fails an assertion now.

## v112

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

**AND THE PORT FOUND A PRE-EXISTING ASYMMETRY WORTH REPORTING.** `rageCfg()`
reads `CONFIG.achievements.pull`, and the FOLLOWERS HAVE NO `CONFIG.achievements`
BLOCK AT ALL - so `a` is `{}` and `enabled` is hard-true for them. The blunt
lever described as "walk in" (`CONFIG.achievements.pull.enabled` false) exists
only on the Ranger, and using it would have disabled containment on Dexon alone
- the same party split, reached by the route that was offered as the workaround.

## v111

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

**`bossRank.graveyard` IS 4, TYING HORSEMAN, AND THE TIE IS UNREACHABLE.** A tie
is normally what this table avoids, because it falls through to `need` and then
`kills_to_rung` - the mechanism the ranking exists to override. It is safe here
because the two can never be live together: horseman runs at realm hour 0, which
is UTC 23/05/17, all ODD, while graveyard runs at odd realm hours minus odd
offsets and lands on EVEN UTC at :30. Minimum separation 20 minutes. CONTINGENT
ON `TIMEO` BEING ALL-ODD - a fourth region at an even offset would expose the
tie with nothing in the schedule code changing, so the parity is asserted rather
than described.
Rank 4 and not 6: twelve a day and ~144 before the season ends is an abundance
argument, and abundance is the wrong axis when every window banks share toward a
6,000,000 cooperative boss.

**THE GARGOYLE IS DELIBERATELY ABSENT FROM THE FIGHT LIST.** 6,000,000 hp and
cooperative, so three characters cannot take it, and its spawn is inside the
rectangle. The waves' points carry over to it regardless - `graveyard_fallen()`
banks them and the wake copies them - so excluding it costs no share. Whether a
crowd should flip this is the operator's open call, not a default.

**ONE COMMENT CORRECTED:** "goobrawl is the ONE joinable event whose parent.S key
is an EVENT name" is now two. The count was load-bearing nowhere, but a reader
checking whether the event-name case was still a single special case would have
been told yes.

## v110

**THE GRAVEYARD WORK IS REVERTED OUT OF THIS FILE ENTIRELY. v108 AND v109
WERE BOTH THE WRONG SHAPE AND THE SECOND CORRECTION SAID SO IN SO MANY
WORDS.** Operator, 2026-10-21: "I did not want the ranger script updated. I
wanted an override code I could paste and execute." v108 built
`CONFIG.graveyard` plus a `gyTick()` interval; told "not a script change / it
should be an override I run", v109 removed the automation and shipped
`gyFarm()` / `gyOff()` / `gyStatus()` as console commands. **A COMMAND IN THE
FILE IS STILL A FILE CHANGE**, which is what the second correction was for,
and reading "not a script change" as "not an automatic script change" is how
one rejected shape became two. The tree is byte-identical to v107 apart from
this version number; the deliverable is a pasted snippet and lives nowhere in
the repo, because that is the point of it.

**THE RESEARCH IS WHAT WAS ACTUALLY WANTED AND IT ALL SURVIVES** - none of it
needed to be code. Graveyard Rising sits ENTIRELY inside the spookytown mummy
rage box (spawn `boundary [31,-1571,480,-1293]`, `rage [-124,-1631,614,-1130]`
from upstream `design/maps.js` at `16881a27`, against 24 grave plots spanning
x 65..447 and y -1550..-1312), so the park point is `(290,-990)` in the
corridor band and not the graves. `rageClips()` is TYPE-BLIND, so `safeMove`
refuses the graves whatever `home` is set to and an override aimed at them
would be INERT rather than wrong - the party never arrives and nothing logs a
fault.

**AND THE SNIPPET NEEDS `mummy` IN THE PULL TYPES, WHICH IS THE ONE PART A
READER WOULD GET WRONG.** `ragePullActive()` matches `ragePullTypes()` against
the rage BOXES on the map, and spookytown's only box is the mummy's - zombie
and ghoul are event spawns with no box of their own - so `home: 'zombie'`
alone leaves the pull machinery idle and nothing ever comes out of the field.
The CANDIDATE scan is POSITION-based (`rageHit` on the monster's own x/y), so
once the machinery is running a zombie standing on a grave is pullable like
any mummy. Put `mummy` in `rageAlso` and the types list satisfies both.

`Tests/suite_bosshop.js` keeps the geometry rather than deleting it with the
code: the fixtures prove why the park point has to be out there, and the
COMMITTED `CONFIG.movement.approaches['spookytown|290|-990']` chain is parsed
out of this file and every one of its 13 waypoints asserted outside the
rectangle - so the snippet's one load-bearing number stays pinned by something
in the repo. Both rejected shapes are pinned ABSENT so neither returns by
accident, and the two `ragePull*` gates above are pinned by mechanism so the
snippet's `rageAlso` line cannot quietly stop being necessary.

## v109

**GRAVEYARD RISING IS A COMMAND NOW, NOT AN AUTOMATIC OVERRIDE. v108 HAD THE
WRONG SHAPE AND THE AUTOMATION IS GONE.** Operator, 2026-10-21: "not a script
change / it should be an override I run". v108 built `CONFIG.graveyard` plus a
`gyTick()` that polled `parent.S.graveyard` on a five-second interval and took
the farm spot by itself. Removed entirely - no toggle, no `TOGGLES` entry, no
interval, no liveness gate, and nothing in this file decides to go.

`gyFarm()` and `gyOff()` are console commands beside `achvStop()` and
`mhOn()`, documented in the header list where the operator looks for them, with
`gyStatus()` for reading the state. `gyFarm()` sets the override the way the
UI's manual override does, so everything downstream - the scorer, the queue,
the `farm_spot` broadcast to Priest and Mage - treats it as what it is: the
operator moving the party by hand.

**AND THAT REMOVED v108'S EDIT TO `achvTick()`, WHICH IS THE PART WORTH
KEEPING AS A LESSON.** An automatic takeover had to be exempted from the
queue's hand-move check, or a ten-minute event would have stood the queue down
until `achvResume()`. A command the operator runs IS a hand move, so the
queue's existing contract is already correct and is untouched. **THE
AUTOMATION WAS CARRYING ITS OWN EXCEPTION**, and the exception went out with
it - a shape worth noticing, because the exemption looked like a necessary
integration rather than a cost the wrong design was paying.

`gyFarm()` REPORTS LIVENESS AND NEVER GATES ON IT. Prepositioning before a
window opens is a thing the operator may want, and a command that
second-guesses them is not a command - so it takes the spot either way and
says which case it is in. Liveness is `parent.S.graveyard.live` and never
`hp`: `graveyard_public()` publishes `{live, map, x, y, start, wave, waves,
left}` from the first wave and only adds `{gargoyle, hp, max_hp, target, end}`
once the Gargoyle wakes, so an hp-gated read is undefined for the first
several minutes of every event. `gyOff()` clears only an override that is
OURS, so running it after the operator has moved the party elsewhere does not
steal their spot.

THE RAGE-BOX FINDING IS UNCHANGED AND IS WHY THE PARK POINT IS WHAT IT IS.
From upstream `design/maps.js` at `16881a27`: the spookytown mummy spawn is
`boundary [31,-1571,480,-1293]`, `count: 9`, `grow: true`,
`rage: [-124,-1631,614,-1130]`. The 24 grave plots span x 65..447, y
-1550..-1312, so the graves sit inside the mummy spawn boundary and the whole
field inside its rage rectangle - Graveyard Rising is not near the mummy field,
it IS the mummy field. `safeMove` refuses every coordinate in that rectangle,
so a command pointing at the graves would be INERT rather than wrong. `GY_PARK`
is (290,-990), the achievement queue's own spookytown point in the corridor
band outside BOTH rectangles, recorded there as "arrived at live with zero
breaches", with `ragePull` taking them one at a time as the commented-out
booboo/mummy entry did. `GY_ALSO` is ghoul only - 48 zombie spawns across the
three waves against ghoul's 9.

THE GARGOYLE IS STILL NOT INCLUDED AND THE COMMAND SAYS SO EVERY TIME IT RUNS.
Fixed spawn [255,-1545] is 555 units from the park point against the mage's
235, the longest reach in the party. Unreachable from outside the box, so
taking it means entering with 9 growing mummies applying `hexed` (-20 speed,
independent of the priest's curse) against a 180/120 leash band. The
operator's call, and not something a command should make for them.

v108's CONFIG block is gone, so the suite's `committedGraveyardCfg()` parser
went with it - the values are plain constants now and a constant cannot be
shadowed by a fixture, which was the defect that parser existed to fix.

FIVE MUTATIONS MEASURED, and three of them improved the suite rather than
confirming it. Pointing `GY_PARK` at the graves fails 5; putting gargoyle in
`GY_ALSO` fails 3; re-adding a `gyTick()` and its interval - exactly what a
later session would helpfully rebuild - fails 2; gating `gyFarm()` on liveness
fails 1; making `gyOff()` steal a foreign override fails 1.
The three repairs: the no-interval assertion used `/setInterval\([^)]*gyTick/`,
whose `[^)]*` stops at the arrow function's own paren, so a re-added interval
tripped only the sibling assertion - widened to match across the call. And two
assertions subscripted `w.manualOverride` directly, so the caught `gyOff`
mutation arrived as a THREW rather than a named failure, which is the recorded
"a test that dies instead of reporting will be debugged as a test bug" -
guarded, and the mutation now names itself.

## v108

Graveyard Rising auto farm override, on the operator's request 2026-10-21.
`CONFIG.graveyard` plus `gyTick()`: while the event is live it takes the farm
spot and hands it back at the close. The toggle is `TOGGLES.graveyardFarm` and
the operator owns it. Ranger-only - Dexon is the single source of truth for the
farm spot and broadcasts `farm_spot`, so Priest and Mage inherit it, `also`
and `pullConcurrent` included, with no edit to either file.

THE EVENT SITS ENTIRELY INSIDE THE spookytown MUMMY RAGE BOX, AND THAT IS THE
WHOLE DESIGN. Read from upstream `design/maps.js` at `16881a27`: the mummy
spawn is `boundary [31,-1571,480,-1293]`, `count: 9`, `grow: true`,
`rage: [-124,-1631,614,-1130]`. The 24 grave plots span x 65..447, y
-1550..-1312, so the graves are inside the mummy SPAWN boundary and the whole
field is inside its RAGE rectangle - the graveyard is not near the mummy field,
it IS the mummy field. `safeMove` refuses every coordinate in that rectangle,
so an override pointing at the graves would have been INERT rather than wrong:
the party would never arrive and nothing would log a fault.

So this uses the park-and-pull pattern the repo already arrived at for this
exact rectangle rather than inventing a second answer. `park` is (290,-990) -
the achievement queue's own spookytown point, in the corridor band outside BOTH
rage rectangles (y -1130..-842), entered from the west, 140 from the mummy
rectangle, recorded there as "arrived at live with zero breaches" - and
`ragePull` takes monsters one at a time exactly as the commented-out
booboo/mummy entry did. No containment is relaxed and nothing new is invented.

`home` is zombie with ghoul in `also`: 48 zombie spawns across the three waves
against ghoul's 9, the same reason that entry paired a 48s respawn with a 24s
one rather than idling.

THE GARGOYLE IS NOT IN `also` AND IT IS THE PRIZE, so the reason is recorded
rather than left to be rediscovered. Its spawn is FIXED at [255,-1545], 555
units from the park point against the longest reach in the party (the mage's
235). That is not a tuning gap - it is unreachable from anywhere outside the
rage box, so taking it means entering the box with 9 growing mummies applying
`hexed` (-20 speed, independent of the priest's curse) against a 180/120 leash
band. That is the operator's call, not a default, and it is NOT built.

Liveness is `parent.S.graveyard.live` and deliberately never `hp`:
`graveyard_public()` publishes `{live, map, x, y, start, wave, waves, left}`
from the first wave and only adds `{gargoyle, hp, max_hp, target, end}` once
the Gargoyle wakes, so an hp-gated read is undefined for the first several
minutes of every event and indistinguishable from "no graveyard" - the
absent-field null this project published and retracted once already.

TWO SUBTLETIES THAT WOULD HAVE BEEN SILENT. `gyRelease()` tests
`gyOwnsSpotIgnoringLiveness()` and not `gyOwnsSpot()`, because the latter
requires `gyLive()` - so at the instant the window closes it goes false and a
release gated on it would DECLINE to release, leaving the party parked on a
dead graveyard. And `achvTick()` now returns early on `gyOwnsSpot()` exactly as
it already did for `mhOwnsSpot()`: without it the queue reads the graveyard's
override as the operator moving the party by hand and stands down until
`achvResume()`, so a ten-minute event would silently retire it for the day.

Precedence: a monster hunt outranks this (its own deadline, deliberately
enabled, against an event recurring every two hours); a hand override outranks
both; the achievement queue does not, being open-ended where this window is 600
seconds.

MY FIRST SUITE TESTED ITSELF AND TWO MUTATIONS PROVED IT. `graveyardWorld()`
supplies its own `CONFIG`, and `gyCfg()` reads whatever the world has - so the
`park` and `also` assertions were statements about the fixture. Pointing the
committed park at the graves and adding gargoyle to the committed `also` BOTH
PASSED. `committedGraveyardCfg()` now parses the real block out of the source.
That is "a harness override the harness merges over is a test of nothing" from
the other direction: there the harness clobbered the subject, here it stood in
for it.

Five mutations measured against the fixed suite: park at the graves fails 4,
release gated on liveness fails 3, gargoyle in `also` fails 1, dropping the
achvTick stand-down fails 1, gating liveness on hp fails 3. One claim was
withdrawn rather than kept - the parser's comment strip is NOT load-bearing,
since brace-matching starts below the rationale block, and removing it changes
nothing; it stays as defence with the comment saying which.

## v107

`bossRank`: horseman inserted at 4, everything at or below shifted down one,
`BOSS_RANK_DEFAULT` 6 -> 7. Operator's ruling, 2026-10-21. The table is now
dragold 1 / franky 2 / crabxx, wabbit, goobrawl 3 / horseman 4 / mrgreen 5 /
snowman, grinch, mrpumpkin 6, default 7.

THE RULE IT EXPRESSES, so it is not re-derived wrong: perishable-but-FREQUENT
sits BELOW rare-and-permanent and ABOVE always-available. Horseman ends with
Halloween on 2 November, which argues for urgency - but it runs NIGHTLY across
three regions and about six shards, so the season holds dozens of chances at
it. wabbit is rare and does not expire, so when both are up wabbit (3) is the
right grab; mrgreen is always available and will still be there in January, so
it moved to 5. A DEADLINE IS NOT THE SAME THING AS SCARCITY, and ranking by
"ends soonest" would have put horseman above wabbit on exactly that confusion.

INSERTION RATHER THAN A TIE AT 4, which is the operator's reasoning and not a
side effect. A tie falls through to `need` and then `kills_to_rung`, and
neither of those knows a deadline exists - so a tie would have been decided by
achievement distance, the very thing this table replaced. The insertion is
order-preserving: every pairwise relationship that held before still holds.

THE DEFAULT IS 7 FOR A REASON AND NOT AS A SPARE GAP. It must sit strictly
above the largest assigned rank, which the shift moved from 5 to 6; at 6 the
unranked set would TIE with snowman/grinch/mrpumpkin and sort against them by
kills_to_rung. Asserted as `> max(assigned)` rather than as the literal 7, so
the next insertion cannot leave it behind.

SEASONAL ENTRIES STAY IN THE TABLE YEAR-ROUND - removing horseman in November
is a no-op NOT to perform. Verified rather than assumed: `bossRank()` is a pure
keyed lookup with a default, nothing iterates `BOSS_RANK`, and all three call
sites pass a name that already came off a live candidate list. So an entry for
a non-spawning boss is UNREACHABLE rather than merely harmless - which is what
dragold at rank 1 has been demonstrating for as long as `lunarnewyear` has been
false. `Tests/suite_bosshop.js` pins the no-enumeration property on the source
text, because that is what makes the year-round entry safe.

Three mutations measured: tying horseman with mrgreen fails 2, leaving the
default at 6 fails 5, adding an `Object.keys(BOSS_RANK)` fails 1. The
order-preserving loop does NOT catch the tie - a tie preserves every
pre-insertion pair, since those pairs never include horseman - so the literal
values and the loop are two assertions doing two jobs, and the suite says so.

Single-file: `bossRank` is declared in `Party/Ranger.js` and nowhere else.

## v106

Rules (a) and (b) from the operator's 2026-10-20 sell rulings reach this
character for the first time. Neither existed here: the merchant had both and
this file had neither, which is "a warning in one script does not protect
another" with the warning on the other side.

(b) EXCHANGEABLES. `isExchangeable()` is now derived the same way the merchant
derives it - the SEED unioned with everything in `G.items` carrying `.e`,
because a derived-only set that reads a missing `G.items` is EMPTY and an empty
protection set protects nothing, silently. The cache is taken only once the
derived half actually read something.

THIS GUARD OUTRANKS `CONFIG.selling.whitelist`, AND ONE NAME'S BEHAVIOUR
CHANGES. `lostearring` is on that whitelist and carries `e=1`, so `sellItems()`
vendored it on sight; it is kept now. The whitelist is the operator's and is
closed, so this is not an edit to it - rule (b) outranks it, exactly as the
same guard outranks `gem0` and `seashell` on the merchant's whitelist. Flagged
rather than buried: the operator can overrule by name if that sale was wanted.

(a) THE SCARCE BELTS. `dexbelt` and `intbelt` are an explicit name set, NOT
derived from any gear table. On the merchant that is precisely how the
protection was silently repealed - dexbelt was covered by a tier-2/3 lookup
until windbelt took the ranger belt slot, and a `GEAR_PROGRESSION` edit
withdrew a sell guard with nothing failing and nothing logging.

BOTH SELL PATHS, because they fail differently. `reliefSellable()` already
refused `level > 0`, so only a +0 belt was reachable there; `sellItems()`
applies no level check at all and runs every `maintenanceLoop` tick, so a
whitelisted belt would go at any level. The belts are absent from that
whitelist and therefore were already safe there BY OMISSION - on a list the
operator edited yesterday, which is why the suite now asserts the absence.

Tests: `Tests/suite_merchantsell.js` extended to both scripts, 38 assertions,
including a divergence check that the two exchangeable seeds stay identical and
that both scripts derive as well as seed. Mutation-verified eight ways on this
file: dropping either rule from either path, emptying the scarce set, drifting
the seed, seeding without deriving, caching a failed read, and adding a belt to
the whitelist each fail assertions. 702 -> 730.

## v105

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

## v104

The give-up cooldown runs to the end of the boss's current GENERATION instead
of a flat 30 minutes. This answers the open question v103 left, with data the
other session measured, and corrects half of their recommendation.

NO CONSTANT CAN BE RIGHT, which is why this needed a field rather than a better
number. Against a 2400s window with a 60-minute inter-window gap, a 30-minute
cooldown starting t minutes after the window opens: t under 10 expires INSIDE
the window, so the generation already judged too strong on two shards becomes
eligible again; t over 30 expires AFTER the next window opens, suppressing up
to ten minutes of a FRESH generation on the 1-hour gaps. Only 10-30 is correct,
and it is correct by accident. The quantity being approximated is not a
duration - it is "until this generation is gone".

BRIDGE SIDE: `window_ends_at` on `/bosses` rows. The END, not `spawn_t`: the
end is what a consumer needs, and sending the start would make every caller
transcribe `EVENT_WINDOW_SEC` client-side, which is exactly the config drift
`terminal=1` was built to avoid. THREE DISTINGUISHABLE STATES, because the
other session's "absent means not an event boss" reading has a hole - the
poller deliberately leaves `spawn_t` as None for a boss it found ALREADY UP, so
absence would then be ambiguous. A timestamp means an event boss whose spawn we
saw; NULL means an event boss with no computable window; ABSENT means not an
event boss at all.

THEIR RECOMMENDATION WAS HALF RIGHT, and the half that is wrong matters.
`estimated_respawn` is indeed the generation end for a respawn boss - but only
for THAT SHARD's instance. Each shard's timer runs independently, so a respawn
boss has no synchronised type-wide generation at all, and the TYPE-level
backstop has nothing to align to. So: event boss, both keys run to
`window_ends_at`; respawn boss, the shard key runs to its own
`estimated_respawn` and the backstop keeps `cooldownMs`. Using
`estimated_respawn` for the backstop would suppress every shard on one shard's
timer.

Unknowns fall back to `cooldownMs` rather than inventing a deadline: a null
window, a window end already past, a stale bridge row, no bridge row at all.

ALSO IN THIS COMMIT, AND IT IS A CORRECTION TO MY OWN BRIDGE. The comment above
`SCHEDULE_OBSERVABLE` claimed goobrawl was "permanently invisible", and the same
file has described the `goobrawl -> rgoo/bgoo` mapping sixty lines further down
since 2026-10-18. The false half cost the other session two wrong sections of
the chain queue spec. `never_observable` only ever meant "this event's own name
is not a polled monster type" and was NAMED as something far stronger; both
sessions believed the name over the contents. Fixed at the source rather than
documented around: `SCHEDULE_SPAWNS`, a reverse `SCHEDULE_EVENT_OF`, mapping
applied BEFORE the membership test in `/schedule`, so an rgoo row now counts as
evidence the goobrawl ran and `never_observable` reads `["abtesting"]` alone.
Both products are mapped, not just rgoo - the scripts' own `BOSS_FIGHT_TYPE`
names only the first, so a bgoo-only goobrawl would read as unobserved on it.

`applyTerminal` gains a note that goo entries FLAP during a healthy goobrawl.
The variants die and are replaced continuously, so `ev: "lost"` fires routinely
- measured in the only goo cluster the log holds: spawn 18:01:58, lost
18:05:45, spawn 18:05:45 at the same second, death 18:15:10. The replacement
arrives in the same poll and `record()` re-adds it, which is the self-healing
property that made treating `lost` as terminal safe. Nobody should "fix" it.

Suite 479 (355 JS, 124 python). Four new branches mutation-tested: ignoring
`typeWide` on the backstop, forcing the shard key to the constant, ignoring
`hasWindow`, and dropping the already-past check.

## v103

The give-up cooldown is keyed `(type, shard)`. This is section 4 of the chain
queue spec, and it completes v99 rather than extending it - v99 was half a fix
and was recorded as a whole one.

WHY v99 WAS HALF. It stopped an abandoned boss pinning the party to its shard,
and the hop then fired correctly. But arriving is not fighting. `bossHop`
commits FIGHTING from `localBossLive()` alone and performs no movement; what
walks the party to a boss and attacks it is `handleEvents()`, gated by
`shouldHandleEvents()` = `holidaySpirit || !!bossPick() || !!bossState.trip`.
After a give-up the trip is null and `bossPick()` goes through
`bossEligible()`, which a TYPE-keyed cooldown refused on every shard for 30
minutes. So the party travelled to US V and farmed ordinary mobs beside the
franky it had gone there for, until `maxFightMs` aborted. Shard-keying is what
lets `bossEligible` say yes at the destination.

THE SPEC'S OWN PREMISE WAS OFF, and the correction matters for what gets built.
It says the type-keyed cooldown prevents the fall-through to the same boss
elsewhere. It does not: `pickTarget()` had no cooldown gate at all, and
`candidates()` skips our own shard, so the hop was already permitted after v99.
What the type key blocked was the FIGHT after the hop. So the spec's 4(b) - a
new mechanism to re-rank the same type's other instances before other activity
- needs nothing built: rank-first ordering in `pickTarget` already delivers it.
4(a) is the whole of section 4, and it is more urgent than the spec frames it.

WHAT LANDED. `bossShard()`, `bossCooldownKey()`, `bossCooledDown(name, shard)`
reading the shard key OR the bare type key, `bossClearCooldown()` so a
by-type clear takes the shard entries with it, `bossEligible(name, shard)`
reporting WHICH key bit, the trip recording its own shard at START so a
give-up is attributed to where the fight was, and `bossState.lastGiveUp`
keeping the reason - "could not kill it" and "arrived too late" want different
answers next window.

THE ASYMMETRY v99 INSTALLED IS GONE, deliberately, and the suite assertion that
pinned it was INVERTED rather than deleted. v99's comment said not to tidy the
gate onto `pickTarget`; that was correct for a type-wide key and wrong for a
shard key. Both selectors now gate, each on its own shard - `localTarget` on
the default (ours), `pickTarget` on the candidate's. Gating `pickTarget` with
the default would ask about our own shard and be a no-op, so the suite asserts
the two-argument form specifically. Two coherent configurations exist and
neither half of either works alone.

TYPE-LEVEL BACKSTOP, `BOSS_TYPE_GIVEUP_MAX = 2`, counting DISTINCT SHARDS
rather than attempts and pruned to one event window. Its duration is
`cooldownMs` and not the window remainder the spec asked for: the remainder
needs a spawn time the script does not hold, so the existing constant is used
and the behaviour matches the pre-v103 type-wide cooldown exactly. Open
question for the operator and the other session - whether to pull `spawn_t`
from the bridge to compute it properly.

Migration is a no-op. The map persists to CODE storage, so a deploy meets bare
type keys; they read as type backstops - over-restrictive for at most one
cooldown, never permissive.

Suite 457. All five new behaviours mutation-tested: type-keying the write, the
backstop counting attempts instead of shards, attributing the give-up to the
current shard instead of the trip's, the clear skipping shard keys, and
`pickTarget` gating with the default argument.

## v102

Comment-only. DO NOT DEPLOY ALONE - it changes no behaviour, and the live slot
should not be disturbed for it.

The measurement in v101's entry, in `applyTerminal`'s comment, in
`Party/RangerComments.md#terminalInvalidation` and in CLAUDE.md was DERIVED
WRONG, and all four are corrected here. The browser session caught its own
figure a few hours after supplying it.

WHAT WAS WRONG. Bracket width, `death_hi - t`, was used as a proxy for how
imprecise `t` is. It is not one: on a `respawn_offset` row a wide bracket means
the poller noticed LATE while the reconstruction stayed EXACT. So the original
"105 of the 394 BOSS death rows carry a bracket over 30s, worst 2,290s" was an
honest measurement of a set that mixed two populations, and it meant nothing.

WHAT IS TRUE, by METHOD. `respawn_offset` 1,151 rows,
`absent_on_responding_server` 238, `poll_bracket` 0 - the third form does not
occur at all in 2.5 days of log. All 238 of the midpoint-bearing rows have a
non-zero gap, 174 (73%) exceed 30s, 44 exceed 120s, max 348s, so roughly 119
terminals were discarded. Of bossHop's own targets: crabxx 21, icegolem 13,
franky 12.

AND THE CORRECTED NUMBER IS LARGER, NOT SMALLER. That 238-row set is exactly
the set `applyTerminal` acts on at all, so the exposure was 100% of the rows it
depends on rather than 27% of boss deaths. Verified here as STRUCTURAL rather
than taken from the log: `BOSS_RESPAWN_SEC` (17 types) and `EVENT_WINDOW_SEC`
(5) are disjoint sets, and a boss with a known respawn keeps its `server_info`
key and reports the dead shape - so `record()` writes `live: false` and the
`r.live !== true` early-out fires before the ordering guard is ever reached.
The bridge terminal is the only signal for the vanishing-key population and
redundant for every other row.

ON REWRITING v101's ENTRY. The convention here is to prepend and never rewrite,
and v101's measurement paragraph WAS replaced in place rather than left standing
- because a false measurement in a changelog is read as a measurement. The
replacement names the figure it retracts instead of erasing it, and this entry
exists so the rewrite is on the record rather than silent. A retraction that
cannot be found from the entry it corrects is not a retraction.

A RATIO IS ONLY AS GOOD AS ITS DENOMINATOR BEING ONE POPULATION. Both figures
were real measurements; the first measured the wrong set. Partition by the
MECHANISM that produces the rows - here the `method` field - before computing
anything over them.

## v101

The v100 ordering guard compared against the wrong timestamp and discarded
roughly half the terminals it was built to act on. Found by the browser
session on 2026-10-20 by reading the function and then measuring the bracket
distribution, rather than by anything going visibly wrong.

WHAT WAS WRONG. `applyTerminal()` ended with `if (r.at > t) return;` where
`t = Date.parse(e.t)`. On a death row `e.t` is a RECONSTRUCTION of when the
boss died: of its three forms, `respawn_offset` is exact but the other two -
`poll_bracket` and `absent_on_responding_server` - are the midpoint of the
poll bracket, `(last_alive_t + poll_t)/2`. The observation that actually
proved the boss gone is `death_hi`, which is `iso(poll_t)`.

WHY THAT BROKE IT, and the mechanism is v100's own. An event boss's
`server_info` key VANISHES at the death, so pushes continue right up to it and
`at` lands at the true death D. The midpoint `t` precedes D whenever D fell in
the later half of the bracket - about half of them, weighted by bracket width
- so the guard returned early and the terminal was dropped. Nothing corrects
it afterwards: the key is gone, no further push arrives, and the entry keeps
`live: true` with a frozen hp. That is exactly the shortest-`secsToDeath`
state the whole function exists to clear, so the defect restored the original
defect on the rows it hit.

MEASURED BY METHOD, which is the partition that matters: `respawn_offset`
1,151 rows, `absent_on_responding_server` 238, `poll_bracket` 0 - the third
form does not occur at all in 2.5 days of log. Bracket width is NOT a proxy
for how imprecise `t` is: a wide bracket on a `respawn_offset` row means the
poller noticed LATE while the reconstruction stayed EXACT, so mixing the two
populations produced an earlier "105 of 394 boss rows" figure that was
meaningless. All 238 `absent_on_responding_server` rows carry the midpoint,
not one has gap 0, 174 of 238 (73%) exceed 30s, 44 exceed 120s, max 348s - so
roughly 119 rows over 2.5 days were discarded. bossHop's own targets inside
that set: crabxx 21, icegolem 13, franky 12.

AND THAT SET IS EXACTLY THE ONE `applyTerminal` DEPENDS ON, so the exposure
was 100% of the rows it acts on rather than 27% of boss deaths.
`BOSS_RESPAWN_SEC` (17 types) and `EVENT_WINDOW_SEC` (5) are DISJOINT, which
makes the method partition structural and not a property of this log: a boss
with a known respawn keeps its `server_info` key and reports the dead shape,
`record()` writes `live: false`, and `applyTerminal` returns at its own
`r.live !== true` without ever reaching the ordering guard. So the bridge
terminal is the ONLY signal for the vanishing-key population and redundant for
every other row.

THE FIX PRESERVES THE INTENT RATHER THAN RELAXING IT. The guard asks which
INSTANCE a push belongs to, so it must compare against the observation: a push
after `death_hi` genuinely postdates the absence and is a later instance; a
push between `t` and `death_hi` belongs to the instance that died. `despawn`
and `lost` rows carry no `death_hi` at all and their `t` IS the detection
time, so falling back to `t` is the correct reading for them rather than a
concession - checked against the emitters, not assumed.

PARSED IN TWO STEPS, not as `e.death_hi || e.t`. That form returns NaN on a
death_hi that is present but malformed, and the next line then bails - losing
a real terminal silently, which is the failure mode this function must never
have. The suite pins it: reverting to `e.t` fails the regression case, and the
`||` form fails the malformed case.

The cold start still needs no branch. A historical row's `death_hi` is in the
past too, so replaying the whole retained log still clears nothing live -
asserted with 50 rows at the widest bracket ever observed.

Suite 441.

## v100

A boss that is already dead stops being the picker's favourite candidate.
Second of the two bossHop defects the browser session found on 2026-10-19;
v99 fixed the first.

WHY A DEAD BOSS WAS THE *BEST* CANDIDATE. `startScanning()` records a boss
from the game's own `server_info` broadcast and opens with `if (!d) continue`.
When an event boss dies or despawns its key does not go false - it VANISHES
from the broadcast entirely - so there is nothing to write and the last
`live: true` push stays in `scanResults` untouched. Its `at` freezes with it,
which means `SCAN_STALE_MS` does eventually retire the entry, but not for five
minutes. For those five minutes the picker sees a boss whose hp never falls,
and an hp that never falls is the shortest `secsToDeath` on offer. The bridge
logs the transition within one 45s poll, so asking it closes a 300s hole to
about 75s.

TERMINAL EVENTS, NOT DESPAWNS - and this was the correction that mattered.
The first design asked the bridge for `ev=despawn`, reasoning from the despawn
classifier that had just been built. The browser session measured the retained
log: 2,499 events, of which death 1,116, despawn 15, lost 120, spawn 1,248. So
`ev=despawn` would have covered 15 of the 1,251 terminal events - 1.2% - and
missed every kill. The despawn/kill distinction grades HOW a boss stopped
existing, which is what `stored_row_is_despawn()` is for; this code cares only
THAT it did.

`lost` IS TREATED AS TERMINAL, and the ambiguity in it did not have to be
resolved to decide that. It is emitted from two places: an instance id that
changed between polls, where the old instance is gone for certain, and a shard
that stopped being listable for `BOSS_ABSENT_CONFIRM` successive successful
polls, where nothing at all is known about the boss. Neither is a boss worth
planning a 30-minute Realm Fatigue trip towards, so both clear the entry. The
costs decide it rather than the reason string: a wrongly cleared LIVE boss is
restored by the next `server_info` push seconds later, while a missed terminal
keeps a dead boss as the best candidate for the full five minutes.

THE ORDERING GUARD IS WHAT MAKES THE COLD START SAFE, so there is no
cold-start branch to get wrong. `applyTerminal()` ignores any event older than
the push that created the entry, because `server_info` is the direct feed and
the bridge a derivative of it running up to 45s behind. The first fetch has no
cursor and therefore replays the whole retained log - and cannot clear
anything, since every historical row predates the push that put the entry
there.

THE ev CHECK IN THE SCRIPT IS THE AUTHORITY; `terminal=1` ON THE QUERY IS
BANDWIDTH. The bridge's `/boss_events` handler reads the parameters it knows
and never rejects an unknown one, so a bridge deployed before `terminal`
existed answers a `terminal=1` query with spawns mixed in - and a script
trusting the server filter would clear entries on a boss APPEARING. Deploy
order between the script and the bridge is not something the script can
observe. `Tests/bridge/test_despawn.py` asserts that an unknown parameter is
ignored, so the premise of that comment is checked rather than claimed.

Bridge side, same commit: `BOSS_TERMINAL_EV` and `boss_ev_is_terminal()`,
plus `terminal=` and `since=` on `/boss_events` and a `truncated` flag on its
answer. `since` is strictly after, so a caller handing back the `now` of its
previous answer is never served the boundary row twice.

Suite 432 (320 JS, 112 python). Every guard in `applyTerminal` was
mutation-tested; the `live !== true` early-out proved to bind to nothing
behavioural, which is correct - it exists so `clearedBy` means "a live claim
was cleared here" - and its assertion was rewritten to say that instead.

## v99

A boss the combat side has GIVEN UP ON no longer pins the party to its shard.
Observed live by the browser session on the 2026-10-19 nightly window; it cost
two franky credits and their keys in one night.

`bossHop.tick()` asks `localTarget()` FIRST, and anything truthy commits
FIGHTING and returns, so `pickTarget()` is never reached. `localTarget()`
consulted `localBossLive()` and one feasibility test and NOTHING about the
give-up cooldown - that lived entirely in `bossEligible()`, which only
`bossPick()` and the status dump ever called. So the hop path could not see a
give-up at all, and two state machines disagreed: the combat side had abandoned
the boss while bossHop still believed it was fighting it.

WHAT IT PRODUCED. All three committed to US II franky at 04:00:01.5. By 04:20 it
had gone 120,000,000 -> 106,000,000 at ~11,400 dps - about 2.9 HOURS to finish -
and the combat side gave up at its 1,200s trip budget and cooled franky down.
From 04:20 to 04:43 `pickTarget()` was returning US V franky at ~15.9 SECONDS of
required dwell with ~6,000s of window left, and no hop ever fired, because
`localTarget()` still saw 106M of live franky standing here.

THE FIX IS ON THE *HERE* SELECTOR ONLY, AND THAT ASYMMETRY IS THE POINT. The
cooldown is keyed by TYPE and is shard-blind, so it cannot say "this franky";
applying it only where the give-up happened is what supplies the missing shard,
and leaves the party free to hop to a different instance of the same boss -
which is exactly the move that was being blocked. Gating `pickTarget()` on it
too would block the hop the fix exists to allow, so the suite asserts that
`pickTarget` does NOT read it.

`bossCooledDown()` is one expression now read by both `bossEligible()` and
`localTarget()`. It was read in exactly one place before, and that place being
the local-pick path is precisely how the hop path came to ignore it.

NOT FIXED HERE, flagged by the browser session and left to the chain queue: the
cooldown being type-keyed is wrong for anything that ranks INSTANCES. Cooling
down "franky" cools it on every shard. The asymmetry above works around that
rather than curing it.

11 assertions. Two EXISTING tests threw ReferenceError the moment the gate
landed, because they lift `bossHop` and call `localTarget()` without the new
helper in their world - the suite doing its job, not a hazard in the script,
which declares both in the same file. All four behaviours mutation-tested: the
gate removed, the helper neutered, `bossEligible` re-inlining the comparison,
and the gate wrongly added to `pickTarget`. Suite 379.

Not deployed.


## v98

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


## v97

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

Ranger publishes: achvScore, achvRefresh, bossRank, addToBlacklist, checkFarmEconomics, combineItems.

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

Not deployed. Dexon needs Ranger v97 and is currently running the wrong
script entirely.


## v96

Make the join branch portable so the followers can carry it verbatim.

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

## v95

The operator picks the priority; the selectors stop inferring one.

**NOT DEPLOYED.** Live slots run v91/v52/v75.

**The operator's priority, 2026-10-18, applied to all three selectors that
choose between live bosses.** Their words: "The bosses worth hopping do not
change - this is priority to pick while multiple are alive, either on the same
server or for the ones already identified as worth hopping for." So it is a
TIE-BREAK ON THE ELIGIBLE SET and nothing more. No eligibility test is
relaxed, no hop target is added or removed, and `requiredDwellSec`, the
arrival test and the join-window test all decide exactly what they decided
before.

**Rank: dragold 1, franky 2, crabxx/wabbit/goobrawl 3, mrgreen 4,
snowman/grinch/mrpumpkin 5, everything else 6.** Keyed by the `parent.S` name,
which is the EVENT name where one exists - `goobrawl`, never `rgoo` - because
that is what `bossLiveNames()` yields. Unranked falls to 6 rather than being
excluded. snowman is ranked and is NOT in `allBosses`, so it can never reach
these selectors today; the entry costs nothing and is there if it is added.

**THE LIVE EFFECT IS IN bossPick, NOT IN bossHop.** Worth saying plainly
because the opposite would be easy to assume. bossPick chose by LOWEST HP
RATIO - finish whatever is nearest dead - which is a reasonable way to choose
between two bosses of equal worth and a poor way to choose between unequal
ones. A half-dead greenjr beat a fresh mrgreen every time. That is the change.

**In bossHop it is future-proofing and changes nothing today**, by two
independent arguments, both asserted rather than claimed. localTarget ordered
by `kills_to_rung`, and today's three targets - dragold 1, franky 68, crabxx
70 - happen to rank in exactly that order, so the output is identical; the
suite asserts the two orderings agree so the day they stop agreeing is
visible. pickTarget ordered by earliest deadline, and its candidates cannot
contend: dragold is inert with lunarnewyear off, and no two event windows
overlap, so two event bosses are never live at once. What it buys is that the
NEXT target added cannot silently inherit an ordering nobody chose -
`kills_to_rung` is achievement distance, not worth, and leading on it was an
inference rather than an instruction.

**THE INCUMBENT NOW WINS A TIE IN bossPick, which is a real behaviour change
and the one to watch.** The caller switches trips whenever bossPick returns a
different name (`bossEnd('switching to ...')`), so with a continuously-moving
key like hp ratio two equally-ranked bosses could trade the trip back and
forth as their ratios crossed. Rank is static, so rank-first already makes
switching rarer; holding the current trip on an exact tie closes the rest. A
higher-ranked boss going live still takes the trip - that is what a priority
is for - and a lower-ranked one never does.

**The delegated tie-break, where the data exists for it.** Within a rank:
cheapest required dwell first, because banking the cheap one does not cost the
other; then earliest deadline; then `kills_to_rung` LAST. bossPick keeps hp
ratio as its within-rank key, since it computes no dwell - the three selectors
were never really in conflict about order, they were each inferring a priority
none of them had been given, and now only the secondary keys differ.

**Demonstrated: 20 new assertions, 63 in suite_bosshop.js, 195 across the
harness** (175 before this change).
The rank table including goobrawl keyed by event name and two kinds of
unranked; localTarget preferring franky over crabxx with both live, plus the
assertion that rank order equals kills_to_rung order for the current targets;
pickTarget taking a higher-ranked franky over a sooner-dying crabxx, and the
cheaper dwell winning within a rank; and bossPick's five cases - a fresh
mrgreen beating a half-dead greenjr, franky beating mrgreen regardless of hp,
equal rank still falling back to hp ratio, the incumbent holding against an
equal rank, and a higher rank still taking the trip.

## v94

A refused join blocks the taxi, not the fight - plus a probe to prove it.

**NOT DEPLOYED.** Live slots run v91/v52/v75.

**A refused join means the TAXI is unavailable, not the boss.** That inference
was the defect, and it was mine in v89. The server refuses `join` while
hop-sick (node/server.js:12653, upstream 2148cf25) - true, measured, and still
true. What does not follow is that the fight is out of reach. Three of the
five join events dispatch to a bare `transport_player_to` and nothing else:
crabxx to main (-1000, 1700), franky to level2w (-300, 150), icegolem to
winterland (820, 425), each skipped outright if you are already within 200
units (100 for icegolem). No team, no instance, no flag. crabxx's spawn is an
ordinary main-map box at design/maps.js:624 and there is no G.maps.crabxx at
all - the taxi drops you where the party already farms.

**It was hitting two of three current targets.** `targets` is dragold, franky,
crabxx, and franky and crabxx are both taxi joins.

**Walking in sick is affordable by a wide margin.** All three taxi events
share a 2,400s window. At Dexon's 2,605 dps the sick dwell is 1.3s for crabxx
at 40 contributors and 398.0s for franky at 200, against a flat 720s to wait
the sickness out. There is no contributor count where waiting wins - the 720s
is a floor and the sick dwell only reaches it past roughly K=1000. The window,
not the 5x penalty, is the binding constraint, and it is six times the worst
case.

**The predicate is `isTaxiJoin`, NOT `isJoinEvent`, and the distinction is the
whole fix.** goobrawl's map is `doors: []` - no walkable entrance, so for it
the join really is the only way in and refusing while sick stays correct.
abtesting is the real join, with teams and `join_too_late`. `isJoinEvent`
reads `G.events[mtype].join` and is deliberately open-ended so a new daily
behaves without an edit, which is exactly what would make a blanket relaxation
wrong. `bossTaxiWalkable()` derives it instead: BOSS_JOIN_SPOTS carries
coordinates only where the server supplies them (goobrawl's are null), and G
decides whether the destination map has doors. A map that gains or loses doors
changes the answer with no edit here.

**Four places changed.** bossApproach falls through to the walk when sick and
the destination is walkable - THE TELEPORT IS STILL PREFERRED whenever it is
available, which is what the comment there was protecting and was right to;
only the sick branch changed, from `return` to a walk. localTarget no longer
skips a sick taxi join, which was the worst of the three because it walked the
party away from a live boss standing in front of them. pickTarget's window
test and candidates' pre-spawn buffer charge no sickness wait for a taxi join.

**A separate bug found on the way: hopsickMs() is the full duration, always.**
Every gate using it charged a character 80% of the way through the whole
twelve minutes. `hopsickRemainingMs()` reads `character.s.hopsickness.ms` -
measured live at 531,630 then 451,765 on 2026-10-17 - and falls back to the
full duration when absent, which is the conservative direction. That is what
makes the two non-taxi gates correct rather than merely less strict.

**goHomeIfIdle no longer abandons a boss that is live where we stand.**
candidates() opens with `if (r.shard === cur) continue;`, so a locally-live
target is structurally invisible to pickTarget - "nothing eligible anywhere"
could be true of the picker while a boss was on screen. The two gates together
produced exactly that: the local gate skipped a sick taxi join, the picker
could not see it, and 90s later the party hopped home, clearing the sickness
instantly and leaving a boss still running on the shard it had just left.
Fixing the taxi gates narrows this; the guard closes it, and closes any future
local-only case with the same shape.

**THE PROBE, because none of the above has been observed.** Everything here is
read off the server source. ShowTaxiProbe() records one row per walk-in-sick
episode - keyed on event plus shard, written to CODE storage so a hop's reload
does not erase it, capped at 30. A row opens when a sick walk is chosen and
closes in the FIGHTING branch, the one place the script knows a boss died
while we were still present, which is what credit actually requires. The row
that proves the point is presentAtDeath AND sickThroughout: a kill attended
from a walk with the sickness never clearing, and those are counted
separately. It shows participation, not payment - credit is awarded
server-side and is not visible from the client, so the last step is comparing
a row against the tracker's kill count. An ordinary teleported fight records
nothing, so the log stays quiet unless the new path is being used.

**Demonstrated, 34 assertions against the real functions lifted from the
committed file.** 23 on the predicate and the probe: all three taxi joins
recognised, goobrawl and abtesting refused, a destination that LOSES its doors
ceasing to be a taxi join, remaining-ms read and its fallback, a second note
updating a row rather than opening one, a later walk opening a new row, an
ordinary fight recording nothing, and a storage write failure degrading rather
than throwing. 11 on the gates: hop-sick with crabxx live here now taken and
with goobrawl live here still skipped, both unchanged when not sick; crabxx
eligible at 1,500s remaining while sick; goobrawl refused with 700s of
sickness against a 540s window but ELIGIBLE with only 60s left, which is the
remaining-ms fix observable from outside; and goHomeIfIdle holding for a live
local boss while still going home when there is none.

## v93

The hop burst: 2-5 boss_hop per hop, because the lock was released too early.

**NOT DEPLOYED.** The live slots run v91/v52/v75. This is a leader-side fix
for a defect the followers were absorbing; nothing is broken while it waits.

**The burst was real and the cause was not re-entrancy.** The browser session
read both followers' acted-lists and found 2-5 boss_hop ids per hop episode,
~105ms apart, with sequential plSeq inside one Dexon page life. Their
hypothesis was that tick() is async and re-entrant, so several ticks pass the
`if (this.hopping) return 'block'` guard before any of them sets the flag
inside changeServer. It is not that: mainLoop awaits `bossHop.tick()` and only
then schedules the next one, so exactly one tick runs at a time.

**It was `this.hopping = false` on the line after `change_server`.**
change_server does not block - it starts a navigation and returns, and the
page keeps running for a few hundred ms. So the flag was cleared, tick
returned, and 100ms later the next tick found state HOPPING with
`currentShard()` still reporting the OLD shard, called changeServer again and
sent another boss_hop. Repeat until the teardown lands. ~105ms is
TICK_RATE.main, which is 100 - that number was the tell and it was in the file
the whole time. The comment directly above the plSend states the assumption
that was wrong: "it reloads the page, so anything after it in this function
may never run". MAY never run. It does run, for about as long as a teardown
takes.

**The fix is to not clear the flag on the success path.** The page is going
away; there is nothing to clear it for. The only reason it was ever cleared
there is the same assumption.

**That introduces a hazard, so it is bounded.** With nothing clearing the flag
on the normal path, a navigation that never arrives would wedge it on, and
because tick() answers 'block' while it is set, that stalls the WHOLE main
loop rather than just bossHop - farming, potions and everything below the
bossHop call in mainLoop. `hopWatchdog()` releases the lock after
HOP_RELOAD_GRACE_MS, 15000. Only a page teardown has to fit inside that
window, which is hundreds of ms, so the margin is two orders of magnitude.

**What it was costing, and why it was worth fixing anyway.** Nothing was
breaking. The followers' same-shard guard refused every burst message after
the first, since they name the shard the follower has now arrived on, and the
acted-list could not have helped - each burst id is distinct, so plActed
returns false for all of them. But every burst message burned one of the 20
entries in PL_ACTED_MAX, at a quarter of the cap per hop, and an id evicted
while still inside the bridge's 10-minute window can be served again, pass
plActed and cause a real reload. That is the failure the acted-list exists to
stop, reached by eviction instead of by memory loss. The cap is staying at 20:
at one id per hop the eviction case needs 20 hops inside ten minutes, and each
hop costs twelve minutes of Hop Sickness.

**Credit where it is due.** The browser session's reading of the follower
state is what surfaced this - it is invisible from the leader side, since the
burst leaves no trace on Dexon's own page once it reloads. Their mechanism was
wrong and their observation was exact, and the observation is the part that
could not be got any other way.

**Demonstrated.** The real bossHop object is lifted out of the committed file
and driven through a simulated teardown with a fake clock, everything it
touches stubbed, its own code unmodified. Ten checks pass. With the old
eager-clear restored as a wrapper: 5 boss_hop, all naming the same shard,
spaced exactly 100ms - the live burst reproduced. Without it: exactly one, and
the lock still held when the page dies. With the navigation never arriving:
still one message inside the grace window, then the watchdog releases at 15s
and the hop retries once by 20s rather than bursting or wedging. One test
assertion was wrong again - I asserted the lock reads false after the watchdog
fires, when the retry correctly re-takes it. Third time the harness has been
wrong rather than the code, which is worth more than it costs but is worth
saying.

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

