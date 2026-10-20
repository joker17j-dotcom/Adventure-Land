# Priest.js - the long comments

Rationale extracted from Priest.js on 2026-10-18, on the model Merchant.js has
used since 2026-09-21. Priest.js keeps the operational summary at each site plus
a pointer here; the reasoning, the measurements, and the theories that were
tried and discarded live below under the anchor the code names.

None of this is load-bearing for the script. It is load-bearing for the next
person who wonders why a number is what it is - and most of these numbers were
measured rather than chosen, which is exactly the kind of thing that gets
'tidied' away by someone who does not know that.

The split rule: if a reader editing the function would need it in front of
them, it stayed in the source. If it is archaeology - why an approach was
abandoned, what was measured on which date - it moved here.

Anchors match the `-> PriestComments.md#anchor` pointers in the source.

---

## engage-a-cooperative-boss-only-once-somebody

THE RULE WAS ON THE ATTACK PATH ONLY UNTIL v58, AND THE SKILLS OPENED BOSS
FIGHTS. `findBestTargetInner` has enforced `boss.target` since this section was
written, and that is correct - but it governs `cache.target`, which drives
`use_skill('attack', ...)` and nothing else. `handleCurse` and `findZapTargets`
pick their own targets and never asked. The operator saw it on the 22:00 EU III
franky window on 2026-10-20 and reported it as "attacks the boss when no one
else has", then corrected themselves to "it may have been a skill such as
curse" - which was right.

THE ZAPPER WAS GATED THE WRONG WAY ROUND, which is worse than ungated.
`!e.target` SELECTS for monsters nobody is fighting - the right preference for a
FARM mob, and the exact inverse of this rule - and `ZAPPER_MOB_SET` is built
from `[...allBosses, "sparkbot"]`, so every boss is in it. The zapper therefore
preferentially tagged a boss precisely while it was still cold. It now splits by
kind rather than dropping the test.

FOUR PATHS, AND THE FOURTH WAS NOT IN THE REPORT. The curse fall-through draws
from `[...CONFIG.combat.zapperMobs, home]`, which is every boss plus sparkbot
plus the farm mob - so it selected bosses too, and gating only the boss loop
above it would have left that way in. Bosses are filtered OUT of that list
rather than merely refused at the cast, because the real selector returns the
NEAREST of the types asked for: a cold boss standing closer than a farm mob won
the pick, the cast-site guard refused it, and the priest cast nothing that tick
while a perfectly good mob stood in range. The guard stays as defence in depth
for any future path into `target`.

THE LOOP SKIPS WITHOUT BREAKING, and that is deliberate. A `break` on a cold
boss would shadow the fall-through and produce the same do-nothing tick.

`bossCold` IS DELIBERATELY AS WIDE AS THE ATTACK GATE. BOSS_SET carries pinkgoo,
snowman, rharpy, rimedjinn, slenderman and tiger alongside the cooperative
bosses, so this refuses to OPEN on those too. That is already how the attack
path behaves; making the skills match it is the fix. pinkgoo at 40 hp is the
case where it is arguably wrong, and narrowing BOTH paths to cooperative-only is
a separate decision about existing behaviour - raised with the operator rather
than taken here.

focusFireTarget IS LEFT ALONE. It returns the monster the LEADER is attacking,
and `.target` on a player entity means they have engaged it - so the opening hit
is already landed and the follower is joining rather than opening. Gating it
would make the priest refuse to help the leader fight a boss until the boss
retaliated, which is worse than the thing being prevented. The browser session
flagged it as "arguably benign"; it is benign for that reason.

WHY IT MATTERS BEYOND TIDINESS: whoever lands the first hit takes the boss's
aggro, and a priest tanking a franky is the worst assignment in the party.
Credit on a cooperative boss is shared by damage dealt, so opening one alone
pays nothing and costs the healer.


This branch used to take any BOSS_SET member in range unconditionally.
That is the opposite failure from Ranger v64, where the gate was so
strict the boss was never shot at: measured 2026-10-02, only Dexon stalled
at a live snowman, because these two attack from actionLoop, which has no
equivalent filter and so is never stopped by handleEvents() diverting
mainLoop. Too loose here, too strict there.
focusFireTarget() above already copies Dexon's target when he has one, so
the "follow the leader" case was always covered; this only decides what
happens when he has not opened yet. Consequence worth knowing: a boss
nobody else has touched is now attacked by nobody, so such a trip ends on
the maxTripMs cap having dealt no damage. That is the stated rule - never
take a cooperative boss solo - not an oversight. 

## main-tick-loop-handles-state-updates-caching

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

## travel-outranks-cohesion-reversing-the-v34-era

TRAVEL OUTRANKS COHESION, reversing the v34-era order. Cohesion
returning true skipped handleReturnHome() - the only path that
pathfinds, counts failures and arms the watchdog - and its nudge is an
xmove, which INTERRUPTS a running smart_move. Between them the two
followers rubber-banded off each other instead of travelling, and the
spot was then blacklisted as unreachable. get_nearest_monster({type:
home}) is the right discriminator because `home` is a MONSTER TYPE:
present means we are at the spot (true while kiting 50-70u), absent
means we are still travelling - including spot-to-spot on ONE map,
which a map comparison would miss. The cascade case is unaffected: in
a fight the monsters are present, so cohesion still runs ahead of
kiting, and boss fights never reach this chain (shouldHandleEvents
branches away above). 

## movement-functions

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

## note

SCARE - new in v31. The jacko was already in two of the equipment loadouts
below (orb slot, level 5) and the skill was never once cast, so the priest
carried a 5-second aggro wipe through every fight without using it.
That mattered more for him than for anyone: measured 2026-09-26 at cgoo he
absorbed 190 of the party's 294 incoming hits and spent 49 of 239 one-second
samples above courage 2, and a feared character stops acting - so the healer
stops HEALING, and all three characters died. Scare is the direct counter.
Polled from maintenanceLoop (TICK_RATE.maintenance), so worst-case reaction
is one tick rather than instant. Against the measured ~750 dps of a 3-cgoo
pile that is ~1,500 damage into a 5,111 pool - survivable, and it keeps this
change to one cheap call site. Move it to skillLoop if that proves too slow.

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

## ask-whether-the-nudge-is-possible-before

MEASURED 2026-10-04 ON DESERTLAND. MageofOz wedged at (218,-1830): five
xmove calls in 25 seconds, every one of them to (274,-1936), can_move_to()
FALSE on every one, four rejections and one interruption, ONE distinct
position across the whole window and zero net drift. FatherToken, wedged at
(373,-2121) at the same moment, was worse: 14 calls in 25.6s, all 14 to
(316,-2015), all unreachable, all rejected. In a separate 20-second window
MageofOz emitted 32 move commands, 1.6/s, in pairs 70ms apart carrying
identical coordinates.
WHAT PUT THEM THERE, and the reason the terrain handoff below is a repair
rather than a mute button: Dexon was on MAIN at (-87,673), 2,522 units and
one map away. v57's map check correctly drops an off-map member from the
centroid, which left each follower with only THE OTHER FOLLOWER to cohere
to - 330 units apart, inside the 400 handoff, so the distance escalation
never fired either. They were homing on each other with nothing left that
could walk them back to the leader, and handleReturnHome() is the only path
here that leaves the map. A character standing perfectly still while sending the same
impossible movement request every three seconds is the clearest botting
signature this party could present, which is the reason this is a fix and
not a tuning note.
can_move_to() settles it locally, before anything reaches the socket, so ask
it. Try a spread of bearings rather than only the exact one: being walled
off dead ahead says nothing about the approaches either side of it, and the
centroid is a direction of travel rather than a destination that matters.
v57 taught the shape of the escalation and only wired it to DISTANCE - past
handoff, let the pathfinder own the trip. Terrain deserves the same
treatment, so when no bearing is walkable this hands off too. 

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

## dexon-owns-every-decision-this-half-only

WHY THE FOLLOWER HAS TO EXIST AT ALL. Accepting and turning in are socket
emits on THIS character's own socket - nothing in Ranger.js can make us emit.
And character.s.monsterhunt is readable only in this context: measured
2026-10-03, a party-member payload carries no 's' field whatsoever (its keys
are skin, level, type, x, y, in, map, share, pdps, l, xp, luck, gold, cx), so
the leader cannot observe our target and we have to tell it.
PURELY MESSAGE-DRIVEN, WITH NO TRIGGERS OF ITS OWN. Nothing here fires on a
timer, on arriving anywhere, or on a farm-spot change. That is deliberate and
it is what makes this block safe to deploy BEFORE the leader: a follower
shipped on its own cannot accept a hunt, so it cannot burn a roll onto a
30-minute clock that nobody is watching. It stays inert until Dexon speaks.
KEEP THE TWO COPIES IDENTICAL, and diff them rather than reading them. The
block uses only helpers that exist in BOTH files - sleep, noHang, plSend,
state, smart_move, game_log. It deliberately does NOT call
updateHomeDependentSets(), which exists in Priest.js and NOT in Mage.js;
referencing it would throw here rather than evaluate to undefined.
-> CLAUDE.md, "Helpers that may not exist" 

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

## boss-hop-the-follower-half-byte-identical

Generalised from dragold_hop on 2026-10-17. The shard and mtype fields are
new and the message carries region and name exactly as before, so an older
build on the other side of the relay degrades to a hop with a vaguer log
line rather than to a failure. 

## routine-client-chatter-that-says-nothing-actionable

get closer  - emitted on every out-of-range action attempt.
              Measured on Dexon: 80 of 289 entries in a
              four-minute sample.
AP[...]     - achievement progress. A counter that resets on the
              wrong kind of last hit repeats the same fraction
              indefinitely rather than counting up - firehazard,
              which wants 20,000 CONSECUTIVE burn last-hits, sat
              at "1/20,000" on Dexon for exactly that reason.
scared /    - the courage mechanic. Priests carry courage 2,
terrified     mcourage 5, pcourage 2, so it is physical and pure
              attackers that start fear here, not magical ones.
              Worth seeing while tuning courage, worth hiding
              otherwise. 

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

## anchor-the-party-block-on-the-left

Dexon anchors on R&M, which is simply the first thing HIS script puts
in .codebuttons. This character has no R&M, and anchoring on the kpm
readout instead was wrong: killHandler() only calls add_top_button the
first time something dies, so between a CODE reload and the first kill
there was no anchor at all - alignPartyFrames returned early, the row
never got its max-content sizing, and #newparty sat a thousand pixels
wide off the right edge of the screen. Measured on FatherToken: thirty
seconds after a reload, .codebuttons still empty, #newparty 1000px.
The row origin is the same place either way - kpm lands exactly where
R&M does - but it exists from the first frame. So: the first element in
.codebuttons once anything is in there, and until then the first laid
out sibling after it, which is where a code button would go. The span
itself is display:contents and generates no box, so it cannot be
measured directly.
Resolved fresh every call, deliberately. Caching the result broke the
handover: on a fresh page .codebuttons is empty, so the fallback picks
the X button, and a cached X stays connected and laid out forever - so
when kpm finally appeared the frames stayed under X instead of moving
left to meet it. Observed on FatherToken at left: 327px with the kpm
block sitting at 0. Two DOM reads at the render cadence is nothing
next to getting that wrong. alignPartyFrames still skips the write
unless the measured offset actually changed. 

