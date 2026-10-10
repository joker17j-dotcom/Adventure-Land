// ============================================================================
// Dexon (Ranger) - Mainframe slot CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB - v80 (The party never reached the spot and this is why, all of it measured. (1) rageGuard tripped on the SAME margin the planner aims for, so arriving at a correctly-planned spot counted as a breach: stop, shove out, travel walks back, forever - 11 stop/xmove pairs in 5 seconds, every smart_move dying as 'interrupted' with hp full and targets 0. It now detects on the real rectangle (guardMargin, default 0) and escapes out to margin, so there is hysteresis between 'safe' and 'get out'. (2) The effective clearance was 55, not 30: rageRoute excludes cells within margin + step, and 30 + 25 = 55. The corridor entrance is a pinch measured at 14-18 units wide - an A* at step 5 connects at margin 14 and fails at 18 - so 55 was never going to fit. Now 4 + 5 = 9, verified against the LIVE map at the shipped grid anchoring: 13 still failed there, because the grid is anchored at the search window's corner rather than the origin and no lattice point fell in the 13..18 band that was left. 9 reaches the park point in 29,443 expansions. (3) step 25 -> 5, because a 10-unit grid cannot resolve a 14-unit gap; the same search that succeeds at step 5 reports NO ROUTE at step 10 for every margin, which is what made a passable corridor look like a sealed pocket. maxCells 24000 -> 200000 so the doubling loop does not quietly push the step back to 20 and undo it. (4) The search was running off the map - can_move answers happily for points outside the geometry - and burning the whole budget in the void: 400,000 expansions on a map holding ~19,000 cells. Clamped to G.geometry bounds it exhausts honestly in 12,164. (5) The park point moves from (415,-986), which is genuinely unreachable - a flood from it stops after 385 cells and smart_move refuses it - to (290,-990), 148 from the booboo rectangle and 140 from the mummy one. The corridor is entered from the WEST; the operator drew that route by hand and drove MageofOz through the pinch manually with ~5 units to spare, which is what disproved my 'sealed pocket' reading. His route is pinned in CONFIG.movement.approaches. Mummy pulls need 173 of reach and so fall to the priest (201) or mage (235) by range alone; Dexon's 163 cannot, and ragePuller already handles that. Standing measurement from the live test: parked 66 from the booboo rectangle, targets 0 - booboo do NOT aggro from outside the box at their 420 range, the rectangle is the whole mechanic.) v79 (Four fixes, every one of them measured on a live run of v78 rather than reasoned about, and the first is a regression I introduced in v78 itself. THE PARTY WAS STUCK at spookytown's (0,0) spawn through 41 consecutive travel failures, all rage_route_blocked, with no fear, no attackers and full hp - so the loop was mine, not the game's. (1) The per-EDGE can_move check added in v78 was the cause. It was the right worry - stopping the simplifier emitting a leg nothing had checked - and the wrong tool, because can_move's SEGMENT test is far stricter than its POINT test, so verifying every 25-unit edge fragments the graph. Measured from the spawn to the park point: 4-connected with edge checks reached 1,030 cells and NOT the goal, 8-connected with edge checks 999 and not the goal, 4-connected nodes-only 5,301 and the goal, 8-connected nodes-only 5,504 and the goal. Connectivity and margin made no difference; the edge check alone did it. Walkability is settled per LEG in rageWalk now, where the legs are actually walked: one can_move clears goes to xmove, one it does not goes to smart_move, whose pathfinder handles terrain - and since both ends of a leg are already margin-clear of every rectangle and the leg is short, there is nowhere for it to wander, with rageGuard still watching. (2) An interruption is combat, not a bad route, and it no longer spends a route attempt. Measured on a desertland leg: 4 attackers against courage 2, the move rejected as 'interrupted', the character pinned. This is also what defeated two manual smart_move tests earlier and was invisible to wrappers on smart_move/xmove/stop, because the fear response does not go through any of them - the operator suggested fear and was right. Interruptions get their own budget, CONFIG.achievements.pull.maxInterrupts, default 12, with a 500ms pause and a retry of the SAME leg. (3) A release valve for an unreachable whitelisted spot, which is why 41 failures went unnoticed. There was already a circuit breaker at TRAVEL.maxAttempts of 3 - but it BLACKLISTS the spot, and achvApply deliberately adds the achievement spot to PERMANENT_WHITELIST, so it took the 'whitelisted, so staying put and still trying' branch: one log line, then forever. The whitelist is right to stop a blacklisting; what was missing is that after achievements.maxTravelFailures, default 10, the achievement layer now releases the override, hands the spot back to the scorer and stands the queue down, so the party farms something instead of standing on a spawn point. (4) rageWaypoints, an optional hand-pinned approach chain in CONFIG.movement.approaches keyed 'map|x|y', tried before the search and refused if any of its own points sit inside a rectangle. Nothing needs one today: across two monitored trips and 1,283 position samples the pathfinder's own route to the park point produced ZERO rage-box breaches, which is the measurement that says the elaborate routing was never what this trip needed. It exists so a spot can be pinned by hand without that being load-bearing. Shipping with monsterHunt disabled and the booboo/mummy achievement farm ENABLED, ready to paste and watch. Priest v46 and Mage v69 carry the identical module changes) - v78 (Four routing fixes, all from one live run. The containment half held - nobody entered a rectangle all session, which is the thing that killed the party earlier in the day - but the party never reached the park point and ended up stranded beside the booboo box. Instrumented rather than read, and the numbers name the fault: rageRoute succeeded on ALL 13 attempts, returning 6 to 9 legs each, while ZERO legs completed and every failure was leg 1 from a standing start. (1) The BFS checked only NODES and allowed diagonals, so it emitted a route whose own first leg was unwalkable - measured [225,-586] -> [200,-611] with can_move false on that segment, two individually standable cells with a wall corner between them that the h 8 / v 7 bounding box cannot pass. It is now four-connected with every explored EDGE verified by can_move, which also makes the simplifier's `best = i + 1` fallback safe; it could previously emit a leg nothing had checked. Diagonals cost nothing to lose because the simplifier straightens the path afterwards. (2) rageWalk treated a refused leg as proof that no route existed, and safeSmartMove escalated that into a throw that travelTo counted as a travel failure - two of those and the trip was abandoned. It now re-plans from the current position, bounded at four attempts, and only a null from rageRoute means no route. It also walks from index 0 rather than 1: raw[0] is the grid cell nearest the start, not the character's real position, so the step from where we actually stand to the second waypoint had never been verified. (3) rageWalk calls stop() first and raises rageNav.busy, which mainLoop stands down on - smart.moving and smart.searching were both measured true throughout the stranded trip, a second driver on the same wheel. (4) rageHoldFire, which is the fix for engaging more than one at a time. The pull gate only ever limited NEW pulls; nothing stopped the ordinary attack loop, and shouldAttackMob returns true for anything whose mtype equals home - which booboo is. The party now holds fire on a rage-boxed type in two cases: while further from the park point than parkWithin, so it stops breaking the trip to fight on the way in, and on any monster still INSIDE its rectangle, because shooting into the box is what wakes the pack. Only what has already come out is engaged. STILL NOT ESTABLISHED: whether booboo aggro at their 420 range from outside the rectangle. Three were seen out at x 155-168 against a box starting at 286, but the party was standing 32 units from the edge at the time, so they may simply have wandered to it and aggroed close - booboo wander at speed 16. The park point at 144 is where that gets tested, and the party has not reached it yet. Priest v45 and Mage v68 carry the identical fixes) - v77 (Rage boxes. G.maps[map].monsters[i] can carry a `rage` rectangle beside its `boundary`, and stepping inside aggros the whole pack AND applies the monster's own rage multiplier. Measured 2026-10-09 in the live client on spookytown: mummy boundary [31,-1571,480,-1293] with rage [-124,-1631,614,-1130], a halo 130-165 units larger; both booboo packs with rage IDENTICAL to their boundary; stoneworm, mrgreen and jr with no rage field at all. Both monsters carry rage 1.5, which is why booboo's listed attack of 220 was measured landing for ~352 - the earlier prediction of 264 and the measurement of 352 were both right, un-enraged and enraged. This was not theory: scoreAllFarmSpots returns the spawn-boundary CENTRE, so an override on booboo resolved to (415,-702), dead centre of the rage box, and the measured result was three deaths, zero kills, the spawn never reached, and travelState stuck inFlight with failures: 0 because death kept interrupting the route. The monster was never the problem; the standing point was. Four things are new. rageHit/rageClips/rageEscape read the rectangles straight out of G. safeMove replaces every xmove call site, refusing to enter a rectangle and routing around one rather than through it - it falls straight through to xmove on a map with no rage boxes, which is every map but spookytown today, so this costs nothing anywhere else. rageRoute is a BFS on a 25-unit grid with the rectangles treated as solid, greedily simplified so EVERY leg is verified straight-line can_move-clear, which is the whole point: the legs are walked with xmove, so smart_move's pathfinder - which knows nothing about rage boxes and would happily cut the corner through one, the interior being ordinary open ground (can_move(415,-702) is true) - is taken out of the loop. Measured at 4 ms on spookytown. safeSmartMove wraps travelTo and bossApproach so the trip OUT to a boss event is protected as well as the trip in, and a blocked route THROWS rather than falling back, because surfacing the failure is the house rule and silently crossing the box is the one outcome worth failing to avoid. rageGuard runs first in mainLoop as the net for a respawn somewhere unexpected, knockback, or being dragged - the failed test respawned Dexon on level1 at (1376,500), none of spookytown's three spawn points, which is why the route is recomputed from wherever the character actually is rather than hardcoded. Nothing here restricts movement OUTSIDE a rectangle: closing, backing off and regrouping are untouched, and the rectangle is the only thing that is solid. ragePullTick adds one-at-a-time discipline, with CONFIG.achievements.pull.concurrent as the knob - how many targets may be in flight at once, 1 to start, raised as the farm earns trust. ragePuller picks who pulls deterministically by range so three characters decide alike without a message: a booboo at its box edge costs margin+2, while a mummy at its spawn edge needs 193 because of the rage halo, which is past the ranger's 163 and inside the priest's 201 and the mage's 235. ragePullTick is fire-and-forget behind a busy flag because a pull is two round trips and mainLoop is wrapped in the 10s HANG_GUARD - the same trap restockTrip was detached to avoid. NOT established: whether an un-enraged booboo outside the rectangle opens fire at its 420 range at all (aggro 1.5 is a multiplier whose base is unmeasured), and whether booboo's phresistance 50 halves the ranger's contribution as modelled. Both are answerable by watching the first run, and neither changes the geometry. Priest v44 and Mage v67 carry the same rage-box safety; the achievement wiring is Dexon-only) - v76 (Goo Brawl is a boss event now, which it was not, and the cause is worth recording: it is the ONLY one of the four joinable events whose parent.S key is an EVENT name rather than a monster name. Measured 2026-10-09 in the live client - G.monsters.crabxx, .franky and .icegolem all exist and all carry cooperative: true, while G.monsters.goobrawl does not exist at all. bossCooperative('goobrawl') therefore read undefined and answered false, and with cooperativeOnly true and include empty, bossEligible rejected it as 'not cooperative' every time it went live. The gate was right about the data and wrong about the event. Two call sites broke on the same gap and only one of them would ever have been visible: bossApproach asked get_nearest_monster({ type: 'goobrawl' }) and got null on every tick, so even a forced bossJoin('goobrawl') would have teleported in and then stood on the arrival point without ever taking a firing posture - inside rgoo's reach, which is the one thing bossPosture exists to prevent. BOSS_FIGHT_TYPE maps the event name to the monster and bossMonsterType() is used at all three resolution sites (bossCooperative, bossApproach, bossStatus). No policy was relaxed: goobrawl now passes the cooperative test for the same reason the other three do, rather than being admitted by hand through include - which would have hidden the real defect and left bossApproach still asking for a monster type that does not exist. The brawl's monsters are rgoo (hp 1,000,000, attack 320, frequency 1.2, range 64, armor 300, resistance 300, xp 48,000,000, damage_type physical, cooperative true, aggro 0.1, rage 0) and bgoo (hp 100,000, attack 5, frequency 0.4, range 15, xp 100,000, cooperative true, aggro 0); both were ALREADY in allBosses, so the attack side needed no change - the ranger admits them through attackIfTargeted and the priest and mage through BOSS_SET, all three resolving to the same 'only once somebody else is on it' rule that shared cooperative credit makes correct. rgoo's range 64 against our ~163 puts this in the free-shot band with crabxx at 45 and icegolem at 64, not the hopeless band with franky at 948, and attack 320 physical is heavily mitigated by the party's armor - this is a far safer trip than the booboo farm measured the same day. G.events.goobrawl gives duration 540 and type 'daily', so the event ends on its own well inside the 20 min maxTripMs and bossEnd records no cooldown; G.maps.goobrawl carries no pvp flag, and on_death is ['goobrawl', 0], so a death respawns inside the brawl rather than ejecting - maxDeaths 2 still bounds it. BOSS_JOIN_SPOTS.goobrawl keeps x/y null deliberately: that map is reachable by the join emit alone, so bossWalkTarget answering null is the correct answer and not a hole to fill. NOT ESTABLISHED - the reward. The operator reports funtoken as a large drop from the event and that is the reason for this change; game data does not corroborate the mechanism, and the gap is recorded rather than papered over. rgoo.drops and bgoo.drops are both null, G.drops has no goobrawl table at all, and the only two drop tables containing funtoken are glitch and lglitch at weight 1 each. G.items.funtoken is g 12,000, stack 9,999, type token, and its own text reads 'Collect them from Daily events' - which goo brawl is, G.events.goobrawl.type being exactly 'daily'. So the payout is server-side event logic that G does not publish, and its size is unverified from here. Priest v43 and Mage v66 carry the identical change) - v75 (Monster hunt banks each hunt the moment it finishes and takes the next one without leaving Daisy. Two changes, both in mhTick. The hunt phase used to push the finished owner onto mhDone and then CHAIN to another member's hunt whenever one was viable and turnInMarginMs (7 min) of clock remained, banking the whole batch at the end of the cycle; it now goes straight to the turnin phase, within one mhTick of the count reaching zero - tickMs is 5s, so that is the latency floor and the walk is the rest. The turnin phase then calls mhAcceptSelf() immediately after a confirmed turn-in, while still inside Daisy's radius. The trade is explicit: one Daisy trip per hunt instead of one per batch, in exchange for a finished hunt no longer being able to expire unbanked - which is the only thing turnInMarginMs ever guarded against, and it is now consulted only when turnInImmediately is set false. THE OPERATOR'S QUESTION, measured rather than assumed: accepting and turning in are THE SAME CALL, parent.socket.emit('monsterhunt') with no arguments, and the server decides which it means from whether a finished hunt is held - which is why both mhAcceptSelf and mhTurnInSelf already emitted exactly that. Scanning the live client on 2026-10-09 for every function whose source contains 'monsterhunt' returns exactly ONE that emits it, npc_right_click, and it passes no second argument. So the game's own Daisy panel sends a byte-identical request to the script's, and having to close and reopen her prompt in the UI is a property of the PANEL - closing and reopening is just how npc_right_click is made to fire again. There is no server-side dialog state, nothing for this path to reopen, and consecutive emits are exactly how the turn-in-then-accept pair works. mhAcceptSelf is called unconditionally because its own first branch returns early when a live hunt is held and emits nothing then: that is what makes it safe when the hunt that finished belonged to a follower and we still hold our own. FOLLOWERS GET ONLY THE TURN-IN, deliberately. Their mhAccept and mhTurnIn share one mhBusy flag and each refuses outright while the other holds it, so an mh_accept sent on the heels of an mh_turnin is answered 'already on a Daisy trip' and dropped rather than queued. Their re-accept comes from the gather phase instead, which mhReset already primes by zeroing mhAskedAt, so it asks on the very next pass and keeps asking every askMs until it lands. No change was needed in Priest.js or Mage.js: mh_accept and mh_turnin already exist on their side and this drives the protocol that was already there) - v74 (The Farm Spot panel's buttons had never worked - all six of its handlers, not just the override rows. initializeFarmUI does `const $ = parent.$` and then binds with `$(document).off(...).on(...)`. The selector forms in that function are fine: `$('body')` and `$('#farm-spot-ui')` resolve in parent jQuery's own context, which IS the page document, which is why the panel renders correctly. `$(document)` is the exception, because it passes an explicit OBJECT rather than a selector, and `document` inside a CODE script is the maincode iframe's document. So the panel went into the page and every delegated handler sat on a document the clicks never touch. Measured 2026-10-09 in Dexon's live v73 CODE context: `document === parent.document` is false, `parent.document.getElementById('farm-spot-ui')` is true while the CODE document has no such element, and jQuery's own registry shows the click handlers for #ui-toggle-expand, #ui-reset-override and .farm-spot-row attached to the CODE document while the page document carried only the game's own a.eexternal. A/B test, one real MouseEvent dispatched on a live .farm-spot-row with the identical selector bound to both: 0 fires on the CODE document, 1 on parent.document. The ordinary suspects were ruled out first - elementFromPoint returns the button itself at its own centre, both buttons sit inside a 3440x1305 viewport, pointer-events is auto and visibility visible, and #ui-mob-list was correctly populated with all 20 candidate rows. Fixed by naming `const doc = parent.document` once and binding all six through it. SECOND BUG fixed in the same function: `off('mousemove', document)` and `off('mouseup', document)` pass a document object where jQuery expects a selector string, so neither call ever removed anything, and scheduleFarmUiRedock re-calling initializeFarmUI stacked another pair of direct handlers every time - they are now `off('mousemove')` and `off('mouseup')` with no selector. That stacking was invisible because the drag handlers only arm when the panel is floating and it docks into .codebuttons normally. The rebind comment above the remove() said all handlers 'rebind cleanly rather than stacking', which was true only of the delegated ones; it now says which is which. Verified live before shipping: rebinding the three click handlers to parent.document inside the running v73 made the panel work - #ui-toggle-expand collapsed #farm-spot-body to display:none and relabelled itself '+', then restored both. Priest.js and Mage.js contain no $(document) bindings and need no equivalent change) - v73 (The out-of-potions fallback walks to a vendor now instead of firing the town teleport. town() is parent.socket.emit('town') and nothing else, and the server answers it by applying the use_town skill, which lands you on the CURRENT map's town point - measured 2026-10-09 in the live CODE context, and there is no map argument to give it. Observed live on desertland: he ran dry, fired use_town, landed at desertland's town point, buy() had no vendor to talk to, the counts stayed at zero, the finally cleared state.restocking, and the next 250ms main tick fired the skill again - indefinitely, with Alia standing unused at -14,-477 on the same map. The five potion vendors in live G are main/fancypots -35,-162, halloween/fancypots 201,-180, winter_inn/wbartender -143,-220, and the legacy old_main and original_main pots; desertland's whole NPC list is transporter / locksmith / scrollsmith / citizen17, so the old path could not have worked there however many times it ran. restockTrip() now takes the vendor on this map if there is one - halloween has one, which matters during the event - and main's otherwise, and smart_move routes it through Alia. find_npc is deliberately NOT how the vendor is found: find_npc('transporter') from desertland answers { map: 'test', x: -50, y: -50 }, the first match in G rather than the one on your own map, so a vendor located that way could have sent the walk to the test map. It is resolved out of G.maps instead. Three new bounds in CONFIG.potions - restockTripMs 180s on the walk, restockBuyMs 15s on the purchase, restockRetryMs 60s before a failed trip is retried - and that last one is what replaces the per-tick retry. The trip is DETACHED from checkPotionEmergency on purpose: mainLoop wraps that call in the 10s HANG_GUARD.defaultMs, so awaiting a cross-map walk there would fire the hang guard on every healthy restock and bury the real failures in 'did not settle'. state.restocking is the stand-down flag instead, same shape as a Daisy trip, and restockTrip's finally always clears it. Success is tested by the potion count after buying, not by whether buy() threw, because a rejection is not the only way a socket call fails. autoBuyPotions' two buy() calls are gated on atPotionVendor() as well - off-vendor they were two doomed socket calls every 2s. New operator handles: restockStatus() and restockNow(). NOT CHANGED, both deliberately: travelTo()'s own town() call, which is documented as a way out of a dead end and retries the real route straight afterwards, and the post-respawn top-up in maintenanceLoop, which fails quietly and costs nothing. Priest v42 and Mage v65 carry the identical change; FamilyFleet.js has no potion-restock path at all and is unaffected) - v72 (Evasion and avoidance now scale effective dps, in BOTH scoreAllFarmSpots and mhEvaluate. Neither was read, and both are straight misses: a mob dodging one swing in five is worth a fifth less xp/s than its hp implies. Measured 2026-10-06 against live G - 14 monsters carry evasion, 4 carry avoidance, and three sat in this party's top 14. iceroamer 3671 -> 3303 (rank 3 -> 8), ghost 3248 -> 2598 (11 -> 16), bigbird 2950 -> 2360 (14 -> 29); gscorpion holds rank 1 untouched. Candidate count 84 before and 84 after, so this REORDERS and never admits or rejects a spot. The avoidance four are why it is not cosmetic - cutebee 99.9, tiger 99, pinkgoo 98 and wabbit 98.8 are effectively unkillable and nothing else flags them, as are goblin 99.95, frog 99, jr 80 and the four elementals at 80. mhEvaluate is included for hunt estimates, but the bound decides whether it shows: killRate is min(dps/hp, count/respawn), so per 100 kills ghost goes 493s -> 616s, bigbird 1017s -> 1271s and iceroamer 114s -> 127s, while jr, greenjr and frog are SUPPLY-bound and do not move at all despite evasion 80, 40 and 99 - correct, not a gap. An earlier draft of this entry claimed jr and greenjr were five times over-estimated; the harness disproved it before it shipped. phresistance was investigated and DELIBERATELY LEFT OUT: js/progression/stats.js groups it with pnresistance, firesistance, fzresistance and stresistance, no client combat function applies it, damage_multiplier(defense) takes one argument and serves armor and resistance only, and the monster sheet never displays it - a server-side status resistance, so putting it in a damage model would be wrong. NOT CHANGED, with a note left in both functions: incoming damage is still the raw hit with none of our own mitigation removed, overstating danger by 57-62% at Dexon's armor 377 / resistance 399. That error is one-directional - it can only refuse a viable spot, never admit a lethal one - and the operator chose to keep it pessimistic for now. Verified with a 17-case node harness over the extracted helper plus a full-gate replication of the scorer against live G) - v71 (Blacklist false positives. Arrival is now a RANGE (TRAVEL.arrivalRadius 200) because kiting preempts smart_move and the rejection was counted as a failed route against a spot we were standing on, and unreachable is never reported while get_nearest_monster({type:home}) is in range. Cohesion and xp-economics fixes are in Priest/Mage; Dexon is group[0] so cohesion self-disables, and he only records what he is told) - v70 (Slenderman is out of the boss rotation and in a new hits-of-opportunity path instead. ROOT CAUSE, measured against adventureland_mongodb: his spawn broadcast is the only one in the game carrying no x/y - server_functions.js sends { name, map } where the generic boss broadcast five lines earlier sends x and y from pack.boundary - so bossWalkTarget() returns null on all three of its paths (parent.S has no coords, EVENT_LOCATIONS has no entry, BOSS_JOIN_SPOTS has no entry) and bossApproach() returns early every tick while the trip stays open to the 20 min maxTripMs cap. Measured 2026-10-04 on the live party: the cooldown lapsed at 1791142637118 and Dexon opened a fresh trip at ...181, 63ms later, then propagated it to FatherToken and MageofOz within 56ms via fromLeader; all three stood in winterland. Exclusion rather than a better waypoint because he cannot be chased at all: event_loop re-evaluates him every second and warps him to a random walkable node on a random one of cave/halloween/spookytown if any non-invisible player on his map is within 600 units, if any projectile targets him, or every 2 minutes unconditionally. Dexon's range is 165, so closing to attack range is itself the warp trigger. Only s.invis suppresses the proximity check and step_out_of_invis() sits in the shared player attack path, so even a rogue drops invis on its first swing. He has been at 66,666/66,666 untouched all event; Lang in #suggestions 2022-10-07 'nobody is farming slenderman ... it cant be farmed efficiently on most servers because everyone scares it'. NEW slenderOpportunity() fires only when he is alive, we are already on one of his three maps, and he is inside our range - no movement and no trip, so the cost when he is absent is one property read. Called ABOVE the inRange guard in handleAttack because shouldAttackMob() keeps him out of cache.targets entirely, so inRange is routinely empty while he is standing on us. Gated to PHYSICAL damage classes: reflection:96 is gated on defense == 'resistance' at server.js:3682, which is magical damage only, so a mage or priest reflects 96% of each cast back at themselves. An earlier reading of this stat and of phresistance:95 was BACKWARDS and is corrected here - phresistance is the defense key on the 'stunned' condition, not damage reduction, and slenderman carries no armor, resistance or evasion at all, so ranger physical lands in full. NOT changed, having been checked first: maxTripMs already enforces a hard 20 min expiry in bossTick, so no trip-expiry fix was needed or made) - v69 (The party no longer walks to a hunt it does not have. mhTick's hunt branch tested only 'the owner still holds this hunt AND has finished it' and had NO branch for the owner's hunt having ROLLED OVER, so a dead pick fell through to the huntCapMs check and the party kept walking to it for up to 25 minutes. MEASURED 2026-10-04 on Dexon: mhPick was target_a750 at main|-270|280 while his live character.s.monsterhunt was booboo x3 with 27 minutes left, and target_a750 was in NOBODY's pool - not his, not MageofOz's pppompom, not FatherToken's stoneworm. The reports were three seconds old, so the pool was fine and the PICK was stale; nine minutes into the phase with mhDone empty. The pick is now refuted whenever the owner's entry disagrees, but only when that entry POST-DATES the pick (mhPickAt), because a follower's report is only as fresh as its last mh_ask and an old one must not cancel a live hunt; our own entry is rewritten by mhRefresh() every tick so it is exempt. SECOND DEFECT, same symptom: mhEvaluate returns the CENTRE of the spawn's boundary box, which says where the monsters are and nothing about where the ground is - can_move_to(-270,280) is FALSE, which is why he stood 63 units short with smart.searching true. New mhWalkableSpot() takes the nearest standable point inside the box. It runs ON ARRIVAL, not at selection: can_move_to reads the CURRENT map's geometry, so asking at selection time would have been asking the wrong map about the wrong point - the first plan for this fix, corrected before it shipped. Leader-only; mhPick, mhEvaluate and mhApply do not exist in the follower files. Verified with a node harness over the extracted functions) - v68 (mhGoDaisy() now takes the wheel from a trip already in flight instead of racing it. A farm or hunt trip started by mainLoop keeps running inside its own travelTo() after mainLoop stands down on mhBusy - standing down stops NEW movement, it does not cancel movement under way - so both owned the single smart_move the client provides, and Daisy always lost: travelTo's recovery path calls town(), which TELEPORTS, then re-issues smart_move(dest). MEASURED 2026-10-04 on Dexon: the game log repeated 'Path found!' then '[mh] could not reach Daisy: interrupted' without end, and a state sample caught both owners live at once - he stood on main at (35,-109), 317 units from Daisy and INSIDE the 340 radius so mhAtDaisy() was already true, while travelState.inFlight was true against mansion|-8|-148 with an 8-step plotted route to mansion. The pathfinder was never at fault; he was driven by two destinations at once. The cure is orphaning, and travelTo was already built for it: its catch opens with 'if (!mine()) return false', so bumping travelState.attemptId makes the interrupted travelTo return before it reaches town() or the retry, and its finally leaves our state alone. Same trick as travelWatchdog, applied deliberately rather than on a timeout. Left alone the cycle died at mhTick's 180-second 'cannot reach Daisy' giveup, discarding a hunt already paid for in kills. Leader half; the follower copies in Priest.js and Mage.js get the identical guard) - v67 (Monster Hunt corrections. maxCount:150 is GONE and replaced by maxEstMin:15 - it had the sign backwards. The server sets a hunt count as (20*60*times)/(max_hp/1000)/(respawn+0.25), so count scales INVERSELY with difficulty: measured live 2026-10-04 it refused bee x500, which mhEvaluate priced at 200 SECONDS on main's 5-pack at 2.5 kills/s, and minimush x500 at 250s, while a count-based rule would wave through a single 80,000 hp skeletor. Count is not a proxy for effort, seconds are, and the hunt's own 30-minute clock was already the real bound. The toggle now SURVIVES A SHARD HOP: mhOn()/mhOff() write CODE storage under MH_KEY - which v66 declared and never used - instead of assigning to an in-memory CONFIG that a change_server reload threw away. The stored value outranks the source default and mhForget() clears it. mhStatus() says which is in force) - v66 (Monster Hunt, behind CONFIG.monsterHunt.enabled - default FALSE, so this build changes nothing until mhOn(). All three characters accept their own hunt, because the assignment is per-character and three characters are three independent rolls: measured live 2026-10-03 on US IV, Dexon drew cgoo x50, FatherToken osnake x34 and MageofOz crabx x51, three DIFFERENT targets held at once, since assign() skips any type already published in server.s and every one of these characters is account level 75, which publishes. Dexon ranks them with the party's OWN farm model - mitigated() dps, the priest's heal throughput, incoming dps at maxConcurrentAttackers and the same uptimeFraction gate - minus the xp and gold-margin gates, which are not reasons to refuse a hunt paid in tokens. It waits for every member to settle before choosing, where a member still holding an unexpired hunt counts as settled because they cannot reroll and waiting for them would never end. mh_mode tells the other two whether they are walking to a hunt or back to a farm. Credit is shard-locked and fails silently (monster_hunt_logic returns unless sn matches), so every pass re-checks the shard and abandons rather than killing for nothing. mhOn() / mhOff() / mhStatus() / mhSkip()) - v65 (The achievement queue walks a list of monster rungs on its own, behind CONFIG.achievements.enabled - default FALSE, so this build changes nothing until you flip it. Why: a farm spot lives in manualOverride, a runtime let, and it is lost silently two ways - a reload wipes it, and checkFarmEconomics blacklists the spot the override points at, which is how the party left rat@mansion for booboo@spookytown on 2026-10-01 with 2,583 score still owed, on a death's xp loss divided into a rate. The queue is persisted in CODE storage, re-asserted every 30s, and re-adds its spot to PERMANENT_WHITELIST on every pass because that Set is rebuilt from source on load too. Progress is READ from the tracker, never counted: parent.tracker is a cache that sat frozen at 11,038 rat kills while 203 landed, so achvRefresh emits the socket's own tracker request with parent.render_tracker suppressed for the round trip - the game's handler ends in show_modal and would open a panel on the operator otherwise. Needs a tracker ITEM in the bag; the server handler returns early without one. An override pointing somewhere the queue did not put it means the operator moved the party by hand, so the queue stands down and says so rather than dragging them back. achvStatus() / achvSkip() / achvReset(i) / achvResume() from the console. / 2026-10-02) - v64 (Cooperative bosses are engaged only once somebody else is on them, and six of them were missing from the list that decides it. attackIfTargeted resolves to mob.target != null, which IS the operator's rule - cooperative credit is shared by damage dealt, so joining a fight in progress pays and opening one alone does not. Measured 2026-10-02 in Dexon's live CODE context with a snowman alive at 155-165 units against his 165 range: shouldAttackMob(snowman) returned FALSE and cache.targets.inRange was EMPTY, so handleAttack returned on its first line. snowman was not `home` (spider), not in alwaysAttack, and not in attackIfTargeted, so it fell to the targetPriority fallback - is the mob hitting FatherToken - and the boss spent the fight on Jasnah, ShallanDavar and Ratage, strangers' characters. He fired 8 times in 223 seconds, every one an incidental arcticbee, against the ~70 his cadence allows. v63 walked him to the boss and held him at the computed range; the attack gate then refused the target, which is why the symptom was 'arrived and did nothing'. Derived from G.monsters[x].cooperative the same day: 19 cooperative monsters exist, allBosses already covered 13, and the six added here are the remainder - pinkgoo, rharpy, rimedjinn, slenderman, snowman, tiger. allBosses itself is deliberately NOT widened: it also feeds COMBAT_SETS.bosses, so that is a separate decision. Two findings recorded rather than acted on. rimedjinn has range 200 against Dexon's 165 and FatherToken's 197, so only MageofOz can outrange it and bossHoldDistance will park the other two inside its reach for a 640,000 hp fight - the mrgreen problem again, and a candidate for CONFIG.bossEvents.exclude. bscorpion and ent sit in attackIfTargeted but are NOT cooperative; they predate the boss work and read as a 'dangerous, only if already engaged' rule, so they are left alone. Priest.js and Mage.js need a DIFFERENT fix and are untouched here: their actionLoop has no equivalent filter, and findBestTarget's boss branch takes any BOSS_SET member in range unconditionally - too loose where this was too strict - so the same six names belong in their allBosses AND that branch needs the already-engaged test.) - v63 (NOT DEPLOYED TO THE LIVE SLOT as of 2026-09-30. Change: BOSS EVENTS. The operator's rule, given 2026-09-30: cooperative bosses only, fought from maximum range, never expecting the kill. Cooperative is the game's own G.monsters[x].cooperative - credit shared by damage dealt - so a trip pays even when somebody else lands the finishing blow, and it is the only class of boss where chipping from range is a strategy rather than a wasted evening. An unknown monster is NOT treated as cooperative. THE OLD BEHAVIOUR WAS NOT A POLICY AT ALL, in three ways. First, shouldHandleEvents() asked only "is anything in getDynamicEvents() live", and EVENT_LOCATIONS lists dragold, mrgreen and mrpumpkin UNCONDITIONALLY - so the party dropped the farm for any of the three the moment it spawned, whatever the odds, with no cap and nothing to bring it home. Measured the same day against this party (Dexon 75, FatherToken 69, MageofOz 70, single-target party DPS about 2,400): mrgreen is 36M hp behind resistance 900, which is 6.6 HOURS, and its attack range is 620 against our 158/197/201 - there is no standing position it cannot reach. dragold is 4.1h, mrpumpkin 4.1h, franky 120M hp and 13.8h at range 948. Second, all three files ran the SAME most-damaged-event scan independently, so two live bosses could send the ranger to one and the priest to the other; the tie-break is now by name, the leader broadcasts its pick, and a follower believes that call for leaderTrustMs before deciding for itself. Third, crabxx was in the ranger's getDynamicEvents alone (v55), so he joined it while the other two kept farming - the boss side of a 960,000 hp fight with no healer, and its 11,706 per hit takes MageofOz down in 1.6 seconds. MAX RANGE IS TWO POSTURES and bossHoldDistance computes both from the live entity: outside the boss's own reach when ours is longer, which costs nothing (crabxx range 45, icegolem 64), and otherwise the far edge of ours, which is merely the best available (franky 948, mrgreen 620). JOINING is measured from adventureland_mongodb node/server.js socket.on('join'), not inferred: exactly four events teleport - goobrawl, crabxx to main (-1000,1700), franky to level2w (-300,150), icegolem to winterland (820,425) - and every other boss must be walked to. The same handler refuses with no_merchants (so never Meltymerch), cant_when_sick (hopsickness, i.e. just after a shard hop, which is now reported rather than retried blindly), cant_in_bank and cant_join for any name not listed, and it ignores the emit when we are already within 200 units - which is why repeating it is free. RETURN was left to my judgement, and it is: boss dead, event expired, maxDeaths 2, or a maxTripMs cap of 20 minutes, whichever comes first, then handleReturnHome(). A trip we GAVE UP on cools that event down for 30 minutes; one that simply ended does not, because those are different facts and cooling the second would refuse a boss the party could have finished. COMMANDS, asked for by name: bossJoin('franky') goes now whatever the gate thinks, clears that cooldown, and broadcasts to the other two from ANY character rather than only the leader - "go now" has to mean the party, not whichever console happened to be open; bossHome() abandons and returns; bossStatus() prints what is live, the gate's verdict on each with its reason, and where we would stand against each. The trip is persisted in CODE storage so a redeploy mid-event cannot hand the party another fresh 20 minutes at a boss it had already abandoned. handleSpecificEvent is now unreachable and marked for deletion next time the file is touched, the way Merchant.js retired heldScanMs. Verified with a 36-case node harness over the extracted block rather than by reading it: the gate, the name tie-break, both hold postures at all three ranges, join versus walk, hopsickness, the death and time caps, cooldown only on giving up, every command, a forced pick that is not live, follower precedence, and the persisted trip. CORRECTION to the v62 entry that follows: it still says NOT DEPLOYED as of 2026-09-28, and that is stale - measured 2026-09-30 in Dexon's live CODE context, String(sendLocationUpdate) contains needsMluck, so v62 IS deployed. The operator deployed it and the marker was never cleared. Read every deployment marker below with that in mind and feature-detect rather than trusting one.) v62 (NOT DEPLOYED TO THE LIVE SLOT as of 2026-09-28. Change: the mluck request carries its INTENT. sendLocationUpdate sends one `message: 'location'` for two unrelated reasons - "the merchant can buff me and my buff is missing" and "my pack is nearly full, come and empty it" - and Merchant.js read ANY location message from a name in CONFIG.mluck.targets as a buff request. So every pickup ask enqueued an mluck job on the merchant, and an mluck job is a whole batch there on its own: a shard hop, a trip to Dexon's last-known coordinates, and - when he arrived with Dexon further than mluck's 320 units away - summonAndWait, which pulls Dexon off the farm spot for up to 60 seconds. The operator observed exactly that on 2026-09-28 with more than 50 minutes left on the buff. Measured in his live CODE context the same day, which is what identified the real sender: mluckState() returned {ok:false, why:"Meltymerch is not in the party"} while character.s.mluck read {f:"Meltymerch", minsLeft:42}, so needsUpdate was FALSE and the mluck branch was sending nothing at all; pickupCooldownMs is 15000 and lowInventorySlots is 3, so the pickup branch was asking every 15 seconds. The location message now carries needsMluck, which is this file's own needsUpdate, and the merchant refuses to enqueue when it reads false. This is the half that stops the trip being taken; Merchant v67 is the half that stops the summon, and it also covers a legacy sender that omits the field. Two smaller fixes in the same pass. (1) The [mluck] log line was keyed off gate.ok, which only says the merchant COULD cast it, so it printed "requesting" for the entire hour a fresh buff was running. That wording cost a wrong diagnosis: the log and the observed travelling looked like the same event and NEITHER of them was the request. It is keyed off the decision now, it names which of the two reasons applies, and the throttle compares the whole note so a genuine change still prints. (2) rangedKiting.autoBySpeed defaults to false. It was true, and kiteCandidateTypes() then added every monster Dexon outruns by speedRatio 1.3 on top of the hand-tuned list - 13 types where the list holds 1 - so "authoritative, never derived" was true of the list and not of the behaviour. The operator set it false on the live slot on 2026-09-28; the file now agrees instead of quietly re-enabling it on the next deploy. Also carried in from the live slot: 'boar' in CONFIG.combat.focusFire.singleTargetMobs. Feature-detected 2026-09-28, the slot held ['cgoo','bigbird','mummy','prat','plantoid','fireroamer','boar'] against the repo's six after eaea6d6 removed poisio, so a deploy from the repo would have dropped an operator edit. Drift is a two-way diff; this is the repo catching up, not a combat decision made here.) v61 (DEPLOYED TO THE LIVE SLOT 2026-09-26 - this entry originally carried a NOT-DEPLOYED hold while Dexon stayed on v60; the operator deployed it later the same day, and it is verified live by feature-detecting CONFIG.combat.focusFire.singleTargetMobs in his CODE context with all seven entries present, not by the slot version number. The hand-test that motivated the hold is ANSWERED and the answer is that cgoo stays on the list: with single-target OFF at cgoo one 605s window lost the priest at t=532s and the mage at t=593s, incoming hits on the priest went from 0.034/s to 1.25/s (2.96 average attackers, peak 10), and Dexon's xp rate did NOT improve - 11,131/s against 11,600/s with single-target on. The mechanism was aggro inheritance, not the priest fighting: the priest's own output measured 0.10 attacks/s, so the damage Dexon spread across 2-3 mobs and then kited away from settled on the nearest body. Written 2026-09-26 at the operator's request so it exists while he hand-tests whether v60's other changes hold the party together at cgoo with single-target OFF. Do not save_code this file without being asked. Change: preferSingleTarget was a hardcoded global true in v60; it becomes a curated per-monster list, singleTargetMobs, with the global left in place but off. The gate now tests the monsters actually IN RANGE as well as `home`, because the case that motivated the list is bigbird sharing main with crab. Seed chosen from two measured quantities against Dexon's 880 attack and 223 armor: danger per mob (attack after mitigation x frequency) and volleys to kill under a 5shot at its 0.5 multiplier. crab is danger 7 and 1.1 volleys - one cast removes it, so AoE is pure gain; bee 6 and 0.7; goo 2 and 0.2; snake 11 and 1.6. cgoo is 299 and 5.5. bigbird is 299 and 73, poisio 112 and 8.2, mummy 392 and 27, prat 398 and 25, plantoid 598 and 325, fireroamer 299 and 217. So the seed is cgoo (unchanged behaviour at the current spot), bigbird and poisio (they share main with crab, which is where AoE resumes), and four that pre-cover the achievement shortlist maps. Bosses are deliberately absent - AoE needs 4+ targets in range so a lone boss never triggers it, and ignoreAddsDuringCrabxx already covers the one that arrives with a swarm; adding fifteen names would make a hand-maintained list harder to read for no measured gain. Worth recording: cgoo is the WEAKEST entry on its own list at 5.5 volleys, where everything else runs 8 to 325 - its case rests on danger and the respawn cap, and that ceiling model is the one the v60 evidence strained, so cgoo is the entry most worth re-testing once this is a list that can be toggled. The Set is rebuilt per call instead of hoisted into COMBAT_SETS so it can be edited from the console without a redeploy.) v60 (v59 shipped and measured no better: at cgoo/level2s incoming hits per second AT the spot went 0.34 to 0.45 (Dexon), 0.59 to 0.66 (FatherToken) and 0.09 to 0.23 (MageofOz), one death each again, 8.9M xp lost. Two findings from that window explain it, and neither is about movement. FIRST: heal carries use_range: true, so it reaches character.range - 197 for FatherToken - and mid-fight he was at (-6,280) with Dexon at (181,637). That is 403 units, 2.05x outside heal range. He was not failing to heal because he was feared; he could not heal at all, and the 'feared priest stops healing' story was only half right. SECOND: the party was not focus firing - two distinct targets across three characters - and no focus-fire mechanism existed in any of the three files. targetPriority looks like one but means 'prefer monsters already targeting the priest'. Party.js had real focus fire via followers copying leader.target; these files had lost it. Also measured offline against the real G.geometry.level2s with 24 sampled directions: within 120 units of the cgoo spawn centre the average open approach-lane count is 23.9 of 24 - a fully open field, which is what nine simultaneous attackers looks like. Ranger changes. (1) CONFIG.movement.anchors overrides the spawn-boundary centre that scoreAllFarmSpots returns; 'cgoo@level2s' anchors to (-86,683), which measures 3 open lanes of 24, is reachable in the same flood-fill region, sits 222 units out and keeps 2 lanes facing the spawn so monsters still come. It is a funnel to pull into, not a firing position - nothing that tight has line of fire to the spawn centre - and it costs no exp/hr because cgoo is respawn-capped at 8 spawns / 48s = 0.167 kills per second, which the party already exceeds about fivefold. (2) Focus fire: preferSingleTarget skips the AoE branches, since 5shot lands at a 0.5 multiplier and 3shot at 0.7, so against 2,400 hp a 5shot needs 5.5 casts per target against single-target's 2.7 - it keeps five monsters alive and swinging instead of removing one every ~2.3s. leaderPicksLowestHp finishes wounded mobs; the old single-target fallback used inRange[0], and sortedByHP sorts b.hp - a.hp, so it was opening on the HEALTHIEST mob in range. AoE also resumes automatically whenever attackers drop below courage. (3) kitePathBlocked became kitePathPenalty. Measured offline: with 11 cgoo scattered at 25-70 units, 180 of 180 candidates were passable and ZERO survived the veto, so inside the pack - the only case that kills - the whole-field scorer never ran and every decision fell through to the crude ladder. As a cost rather than a veto the ranking survives and the scorer picks the least-bad route. Verified: where the veto froze, the penalty moves and lifts mean distance from the field 45.0 to 69.0.) v59 (Measured 2026-09-26 with v58/v31/v54 live at cgoo/level2s: the derived hold band was honoured in the steady state - median nearest 134/129/134 against designed bands of 84-155, 129-192 and 84-196 - and incoming hits fell 27-50% (Dexon 54 to 37, FatherToken 190 to 138, MageofOz 50 to 25). The party still wiped. Dexon's last six seconds ran 92 to 72 to 47 to 27 to 10 units while attackers went 3 to 9, then he sat at 10 - inside his own 84 retreat threshold - and died; MageofOz bled 1,995 to 0 with ONE attacker while holding 59-95 against a 176 hold, unhealed because the other two were already down. So the band arithmetic was right and the DIRECTION was wrong: the scorer maximised distance from the single nearest monster, which inside an 11-cgoo pack means retreating into the other ten. XP went backwards 5.6M across the party in five minutes. Six changes. (1) Retreat and disengage now score direction against the whole threat field via kiteMultiWeight, signed and urgency-weighted - a candidate that escapes one monster into another is penalised, not merely unrewarded, and threats we are already deep inside weigh more. Closing and recentring keep single-target scoring, which measured correct. (2) kitePathBlocked vetoes candidates whose ROUTE closes on a threat, not just whose endpoint is farther. The harness caught this: from inside a pack the old scorer picked a point 30 units beyond a mob standing 10 units away, scoring it as ten units gained while the path walked over it. Priest.js had tangent cones for this; this file had nothing. (3) Step-length retry at 1, 1/2 and 1/4 - a wall 30 units out used to block every candidate while 10 units of room existed. (4) An ordered ladder fallback, borrowed in shape from the old Party.js handleKiting which always produced some move where the scored sampler could produce none; corrected to stop at +-120 degrees rather than its +-180, which aimed into what it was fleeing, and to retry shorter steps. (5) `if (!found) return true` became `return false`. It claimed the tick was handled while moving nothing AND suppressed the walkInCircle fallback at the call site, which is consistent with him sitting at 10 units for seconds. A gated pathfinder last resort runs first: xmove falls back to smart_move for walls, but the scored pass never reached it because every candidate is pre-filtered through can_move_to, and smart_move is blind to monsters so it only fires below courage. (6) Disengage mode (reason 4) abandons the band entirely once attackers reach character.courage, and smart.moving no longer vetoes kiting outright - a crowd cancels the path instead. Verified with a stub harness over live G.monsters replaying the recorded pack geometry: the old pick is vetoed, the new one leaves sideways, step retry uses 15 where 30 was walled, and the ladder escapes a narrow corridor.) v58 (Kiting is enabled and no longer bscorpion-only, and scare counts attackers instead of detecting one. Four parts. (1) rangedKiting.enabled was false and targets was ['bscorpion'], so the engine - 90 sample angles, throttling, weighting - had never run against anything else. It is on, and kiteCandidateTypes() adds any monster we outrun by speedRatio 1.3 on top of the hand-tuned list, which stays authoritative. (2) The hold band is derived per target by kiteBand() from kiteThreatRadius() + rangeBuffer instead of the fixed 155/170, and that radius is max(range, widest aura) because bscorpion's danger is weakness_aura at radius 100, NOT its 32 attack range - deriving from range alone would have moved the hold from 155 to 52 and parked him inside the aura. bscorpion therefore keeps its measured numbers as an explicit override, optimalDistance 170 above his 160 range included, which is an avoid rather than a kite-and-shoot. (3) cfg.maxDistance was null, so `dist > cfg.maxDistance` coerced to `dist > 0`: reason 2 fired on every tick reason 1 did not, repositionThreshold was unreachable dead config, and the `nd > maxDistance` penalty scored every candidate -1000 alike. The per-target band makes all three behave as designed. (4) scare() fired when any ONE monster had held aggro for 250ms, so the 5s cooldown was routinely already spent when it mattered; it now counts attackers and fires at character.courage. Measured 2026-09-26 at cgoo: the party took 294 hits, FatherToken 190 of them, and all three died - a feared character stops acting, and for the healer that means it stops healing. Also: the kiting branch sat as an `else if` above walkInCircle(), so enabling it would have retired circle-walking entirely and left him standing still wherever nothing was kite-worthy; it is chained now. Verified with a stub harness over live G.monsters - every derived band starts outside the target's threat radius, and monsters we cannot outrun or outrange are refused.) v57 (The inventory sorter is gone. It pinned tracker/ancientcomputer/hpot1/mpot1/xptome/pumpkinspice/xpbooster to slots 0-6 from maintenanceLoop, which runs every TICK_RATE.maintenance = 2000ms, and swap() is an EXCHANGE - so it did not merely hold those items in place, it evicted whatever the operator dragged into one of those slots. Measured 2026-09-26: forcing the tracker from slot 0 to slot 8 landed at +500ms and was reverted by +1000ms, which is why manual dragging had become impossible rather than merely awkward. It only started biting today, because v56 fixed the dead 'tracktrix' spelling to 'tracker' AND a tracker was acquired the same hour, so slot 0 was defended for the first time ever. Nothing depends on the slots it was maintaining: there is not one numeric index into character.items anywhere in this file, every lookup is by name, and MageofOz has run without a sorter the whole time. The potion path is unaffected in practice - use_skill('use_hp') resolves to use('hp'), which scans items from the LAST slot BACKWARDS and drinks the first gives match, and measured the same day the only hp/mp-giving items in the bag are hpot1 and mpot1 themselves, so there is nothing to mis-pick. Note the pins were the WORSE arrangement for that scan: slots 2 and 3 are scanned last, so a second hp/mp consumable would have taken priority over the potions, not the other way round. The tracker is still safe without the pin - neverSell and muling.excludeItems protect it, which is what v56 was actually for. Slot order is now the operator's to arrange by hand.) v56 (Tracktrix is now actually protected, which it was not before. The item's NAME is tracker - Tracktrix is only its display label, G.items.tracker.name - and there is no tracktrix key in G.items at all. Measured 2026-09-25. So the 'tracktrix' string that had been sitting in inventoryRelief.neverSell could never match item.name and protected nothing, and the same typo in inventorySorter's slot map meant the item was never pinned to slot 0 either. Priest.js already spelled it correctly as tracker: 0, and that disagreement between the two files is what the typo was hiding behind. This was not theoretical: reliefSellable() sorts candidates by NPC value ASCENDING and sells the cheapest first, and a tracker vendors for SEVEN GOLD - it would have been the first thing off the pack the next time the bag filled with no mule in reach. It was also missing from muling.excludeItems in every spelling, so clearInventory() was handing it to Meltymerch on sight. Protected now on the same footing as tier-1 potions: not sold, not muled, pinned to slot 0. It is the item that records achievements for bonus stats, so its value is in holding it, never in what it fetches.) v55 (Giga Crab is now joined, and his contribution is logged for later review. Three parts. (1) getDynamicEvents() injects crabxx when parent.S.crabxx.live, with join: true - G.events.crabxx carries join: true and duration 2400 as a daily, so arrival is an event join rather than a walk, and handleEvents() already emits the join for any entry with that flag. There is no static monster pack for crabxx, so the smart_move G.monsters fallback would have found nothing and silently done nothing. (2) shouldAttackMob ignores crabx while crabxx is live. Measured 2026-09-25: a crabx hits for 189 after mitigation against a 4,621 HP pool - 24 hits - and the boss spawns 1,000 of them, so volume is what kills a ranger here. The boss itself hits for 12,572, 2.7x the whole pool, so there is no posture in which he trades with it; he stands outside its 45 range with his 160 and contributes damage, which is what cooperative credit pays on. ignoreAddsDuringCrabxx turns this off. (3) A contribution log in CODE storage, so it survives the change_server reload exactly as the chest map now does. Damage comes from the game's own hit events filtered to our own id against a crabxx target, not inferred from attack calls, so only landed hits count. Writes are batched to one per 10s rather than one per hit. Query it any day with crabxxReport(). Left deliberately unanswered for now: whether to generalise the dragold cross-shard hunter to this boss. At ~491 effective DPS into 960,000 HP behind armor 320 and phresistance 30, and with other players finishing it well inside the 40-minute window, the value of hopping depends on damage actually landed - which is the number this log exists to produce.) v54 (Chest looting was stalled, not slow. updateChestsInStorage() stamped every chest with performance.now(), which is measured from PAGE LOAD and resets to ~0 on every reload, while the chest map persists in CODE storage. So after any hop or redeploy each stored chest carried a stamp from the previous session's clock, now - storedAt went NEGATIVE, the < delay test passed, and the entry was skipped forever - and never removed either, since removal only happened after a successful loot. Measured 2026-09-25 on Dexon: 9,342 of 9,465 stored chests were stamped in the future and permanently unlootable while ~5,500 chests sat within 800 units, nearest 3 units away. Now Date.now(), which survives a reload. A negative age means a stamp from another clock - legacy performance.now() values read as 1970 - and is treated as ready rather than stranded, so this class of bug cannot recur silently. Two further defects fixed in the same pass: the try wrapped the WHOLE loop, so one loot() throw aborted every remaining chest and left the offender at the head of the map for the next pass to abort on again; and removeChestId() re-read and re-wrote the entire map per chest, O(n) each and O(n^2) across a backlog this size, which would wedge the tab during a drain. Removals are now batched into one write per pass, and maxPerPass bounds the drain rate. Looting costs no exp: loot is not a skill, shares no cooldown with attack, and runs on its own interval. Ranger: delayMs 180000 unchanged; added maxPerPass.) v53 (Tier-0 potions are no longer protected. Measured 2026-09-25: the fleet holds zero hpot0 and zero mpot0 - all four characters and all three bank packs - and nothing acquires them, since every buy path is hpot1/mpot1 only. The 3,354 hpot0 that had piled up on FatherToken were cleared manually. Protection was never what kept tier 0 in use anyway: use_skill('use_hp'/'use_mp') resolves to use('hp'/'mp'), which scans character.items from the LAST slot BACKWARDS (adventureland_mongodb js/functions.js:4593) and drinks the first item whose gives matches, so tier is never consulted - slot position alone decides. That is why the priest's pile sat undrinkable at slot 0 underneath hpot1 at slot 2, and why unprotecting tier 0 on its own would have muled and vendored it rather than drawn it down. The stock COUNTS deliberately still read hpot0+hpot1 and mpot0+mpot1, so a stray tier-0 stack cannot mask an empty tier-1 bag and suppress a restock. Removed from inventoryRelief.neverSell and muling.excludeItems.) v52 (Farm scoring now uses the game's own armor curve. mitigated() applied 1-x/(x+900), an approximation that tracks parent.damage_multiplier closely near armor 100 but diverges badly above 400: at defense 900 it returned x0.500 where the game returns x0.313, overestimating our damage by 60%. 13 of the 86 monsters this scorer ranks sit above 400, so the tankiest mobs were systematically over-ranked - mrgreen at defense 900 drops 12% and the armor-900 dummy 37%. damage_multiplier is typeof-guarded rather than assumed, and its null return for an undefined argument is rejected; the old curve stays as a fallback that logs once, so a missing helper cannot masquerade as a correct estimate. No top-10 spot changes today - the top spots are defense 0 - but the error grows as party DPS rises and high-defense mobs become viable candidates.) v51 (Loop hang guard. Every loop here is an async function that schedules its next tick only after its body resolves, so an awaited call that never settles does not slow the loop down - it ends it, permanently and silently. Throws were already handled; hangs were not. Measured 2026-09-22 on Dexon: actionLoop 0 iterations in 20s where ~1300 were due, mainLoop dead in the same window (is_disabled, called every 250ms, not called once). He stood in range of crabs casting nothing and the party earned 0 xp until the page was reloaded - which is why a reload 'fixed' it each time. setInterval work (buffs, loot, keepalives) kept running throughout, so /hub showed a live, idle character. New noHang() bounds every await that appears directly in a loop body and rejects on timeout, landing in that loop's existing catch: the tick is lost, the chain is not. Same intent as travelWatchdog. It logs, throttled - a silent guard makes 'hung' and 'idle' indistinguishable. Ranger only: handleAttack fired at mobs it could not reach. top5/top3 were sliced from sortedByHP, which is every monster on screen sorted by HP descending and NOT range-filtered, and of six branches only the last checked range. The healthiest mobs on screen are the ones still at full HP precisely because nobody can reach them, so the aoe branches shot at those. The clumped guard did not help: it proves some mob is close, then the shot goes to top3 anyway. Measured: 33 consecutive 3shot casts at crabs 683-715 units away against a range of 158, 0 xp from all 33. Now sliced from cache.targets.inRange - same list, same HP order - so every branch inherits the range check. The single-target fallback also moved from sortedByHP[0] to inRange[0]: it used to test the healthiest mob on screen and so attacked nothing at all whenever that one was out of reach.)
// ============================================================================
// ============================================================================
// Dexon (Ranger) - Mainframe slot CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB - v50 (DPS meter: the 'hit' listener is now replaced rather than added to. The socket lives in the game frame and outlives a CODE restart, so every reload added another - nine on this character after a morning of redeploys. Orphans belong to destroyed CODE frames where parent is null, and the line reading parent.party_list sat outside the try, so an orphan threw into socket.io's emit loop and aborted the listeners behind it. The live handler registers last, so it never ran and this meter read zero while the rest of the party's read correctly. Now: remove our own previous handler by reference - not a blanket removeListener, which would strip the client's own damage-number rendering - and guard the first line so a surviving orphan returns quietly. Orphans already on the socket need a page reload; a CODE reload cannot reach them.)
// ============================================================================
// ============================================================================
// COMPATIBILITY SHIM - Mainframe's sandboxed vm context doesn't expose the
// 'performance' global that a real browser tab (or plain Node.js) would.
// Every performance.now() call below is just for cooldown/cache-TTL timing
// at millisecond granularity, so Date.now() is a fully safe substitute -
// no behavior changes, just makes this actually load on Mainframe.
// ============================================================================
if (typeof performance === 'undefined') {
	globalThis.performance = { now: () => Date.now() };
}

let home = null;
let mobMap = null;
// ============================================================================
// PARTY LINK - cross-shard messaging for the party, with in-game as its twin
// ============================================================================
// Paste this block near the top of Ranger.js / Priest.js / Mage.js /
// Merchant.js, then make two edits per script (see INTEGRATION at the bottom).
//
// WHY BOTH CHANNELS, NOT A FALLBACK
// send_cm is instant but realm-local: a character on another shard never hears
// it. The bridge reaches everyone but costs a poll interval. Rather than pick
// one and reason about which is reachable - that reasoning is itself a bug
// surface - every message goes out BOTH ways and receivers drop the duplicate.
// Neither channel is load-bearing, and both are exercised constantly, so a
// broken one is obvious immediately instead of at the moment it is needed.
//
// Latency does not argue against this: the party's most frequent message fires
// at 500 potions remaining, and nothing here is sub-second sensitive.
//
// ON MAINFRAME THE BRIDGE HALF SWITCHES ITSELF OFF
// Mainframe runs on Adventure Land's servers, so 127.0.0.1 there is the game
// server, not your PC - the bridge is unreachable by construction. A probe at
// startup settles it, and the same probe covers "the bridge is not running
// yet". When it fails, messaging degrades to exactly today's behaviour:
// send_cm only, no retry storm, one log line. It re-probes occasionally so
// starting the bridge later is picked up without a restart.
// ============================================================================

const PARTY_LINK = {
	url: 'http://127.0.0.1:8787',
	pollMs: 2000,           // how often to collect relayed messages
	reprobeMs: 5 * 60 * 1000,
	timeoutMs: 1500,        // a dead endpoint must fail fast, not hang the loop
	dedupeMs: 5 * 60 * 1000,
	verbose: true,
};

let plUp = false;           // is the bridge reachable right now
let plProbed = 0;           // when we last found out
let plCursor = 0;           // highest relay seq collected
let plSeq = 0;              // our own outgoing counter
const plSeen = new Map();   // message id -> when it may be forgotten

function plLog(msg, color) {
	if (!PARTY_LINK.verbose) return;
	try { game_log('[link] ' + msg, color || '#8b98ab'); } catch (e) { }
}

function plName() {
	try { return character.name; } catch (e) { return '?'; }
}

/* fetch that always settles. On Mainframe fetch may be missing entirely, and a
   request to an unreachable host can otherwise sit there forever. */
function plFetch(path, opts) {
	if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
	const o = Object.assign({}, opts || {});
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(() => { try { ac.abort(); } catch (e) { } }, PARTY_LINK.timeoutMs);
	}
	return Promise.race([
		fetch(PARTY_LINK.url + path, o),
		new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), PARTY_LINK.timeoutMs + 200)),
	]).then((r) => {
		if (stop) clearTimeout(stop);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		return r.json();
	}, (e) => { if (stop) clearTimeout(stop); throw e; });
}

async function plProbe() {
	plProbed = Date.now();
	const was = plUp;
	try {
		await plFetch('/health');
		plUp = true;
		if (!was) plLog('bridge up - messages go out in-game AND through the relay', '#7FD98A');
	} catch (e) {
		plUp = false;
		if (was || plProbed === Date.now()) {
			plLog(typeof fetch !== 'function'
				? 'no fetch here (Mainframe) - relay off, send_cm only'
				: 'bridge unreachable - relay off, send_cm only', 'orange');
		}
	}
	return plUp;
}

/* True the first time an id is seen, false every time after. This is the single
   dedupe point: both channels funnel through it. */
function plFirstTime(id) {
	if (!id) return true;                 // unlinked message, nothing to dedupe
	const now = Date.now();
	for (const [k, exp] of plSeen) if (exp < now) plSeen.delete(k);
	if (plSeen.has(id)) return false;
	plSeen.set(id, now + PARTY_LINK.dedupeMs);
	return true;
}

/* Drop-in for send_cm. Same arguments; sends both ways. */
function plSend(to, payload) {
	const body = Object.assign({}, payload || {});
	if (!body._plid) body._plid = `${plName()}-${Date.now()}-${++plSeq}`;
	/* Stamp where the sender is standing. Doing it here rather than at each
	   call site means every message type gets it for free, and the merchant can
	   work out whether a request needs a shard change without the requester
	   having to think about it. */
	if (!body._plshard) {
		try { body._plshard = { region: parent.server_region, name: parent.server_identifier }; }
		catch (e) { }
	}

	try { send_cm(to, body); } catch (e) { plLog('send_cm failed: ' + e, 'orange'); }

	if (!plUp) {
		if (Date.now() - plProbed > PARTY_LINK.reprobeMs) plProbe();
		return;
	}
	plFetch('/msg', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: plName(),
			to: Array.isArray(to) ? to : (to ? [to] : null),
			id: body._plid,
			payload: body,
		}),
	}).catch(() => { plUp = false; plProbed = Date.now(); });
}

async function plPoll() {
	if (!plUp) {
		if (Date.now() - plProbed > PARTY_LINK.reprobeMs) await plProbe();
		return;
	}
	try {
		const r = await plFetch(`/msg?to=${encodeURIComponent(plName())}&since=${plCursor}`);
		plCursor = r.cursor || plCursor;
		for (const m of (r.messages || [])) {
			// Straight into the script's existing handler, so relayed and in-game
			// messages take exactly the same path. plFirstTime drops whichever
			// copy arrives second.
			try { on_cm(m.frm, m.payload); } catch (e) { plLog('handler error: ' + e, 'orange'); }
		}
	} catch (e) {
		plUp = false;
		plProbed = Date.now();
		plLog('bridge lost - send_cm only until it returns', 'orange');
	}
}

function plStatus() {
	return { bridge: plUp ? 'up' : 'off', cursor: plCursor, deduped: plSeen.size };
}

plProbe();
setInterval(plPoll, PARTY_LINK.pollMs);

const homeServer = 'USIV';
const allBosses = ['bgoo', 'bscorpion', 'crabxx', 'dragold', 'ent', 'franky', 'greenjr', 'grinch', 'icegolem', 'jr', 'mrgreen', 'mrpumpkin', 'phoenix', 'rgoo', 'wabbit'];

const CONFIG = {
	combat: {
		enabled: true,
		/* Scare clears everything currently targeting us. Needs a jacko in the bag
		   (it equips, casts, then swaps the previous orb back): 50 mp, 5s cooldown.
		   courageOffset shifts the trigger relative to character.courage - 0 fires
		   at courage itself, +1 waits until fear has already begun. */
		scare: { enabled: true, courageOffset: 0, minHeldMs: 250 },
		/* Focus fire. preferSingleTarget skips the AoE branches entirely: 5shot
		   lands at a 0.5 damage multiplier and 3shot at 0.7, so against cgoo's
		   2,400 hp a 5shot needs 5.5 casts per target where single-target needs
		   2.7 - it keeps five monsters alive and swinging instead of removing one
		   every ~2.3s. At a respawn-capped spot that throughput buys nothing:
		   cgoo is limited to 8 spawns / 48s = 0.167 kills per second and the
		   party already exceeds that roughly fivefold, so the surplus is better
		   spent on provoking fewer monsters. leaderPicksLowestHp finishes wounded
		   mobs instead of opening on the healthiest, which is what inRange[0]
		   gave - sortedByHP sorts b.hp - a.hp, healthiest first. */
		/* singleTargetMobs is a curated list, maintained by hand: add a monster when
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
		   evidence has since strained. The list does not depend on that model. */
		focusFire: {
			enabled: true,
			preferSingleTarget: false,
			singleTargetMobs: ['cgoo', 'bigbird', 'mummy', 'prat', 'plantoid', 'fireroamer', 'boar', 'cutebee'],
			leaderPicksLowestHp: true
		},
		targetPriority: ['FatherToken'],
		alwaysAttack: ['crabx', 'wabbit'],
		// See shouldAttackMob: while crabxx is live the 1,000 crabx adds are
		// ignored so the shots land on the boss instead of the swarm.
		ignoreAddsDuringCrabxx: true,
		/* COOPERATIVE BOSSES ARE ENGAGED ONLY ONCE SOMEBODY ELSE IS ON THEM.
		   attackIfTargeted resolves to `mob.target != null`, which is exactly the
		   operator's rule: credit on a cooperative boss is shared by damage dealt,
		   so joining a fight in progress pays, and opening one alone does not.

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
		   and widening that is a separate decision from this one. */
		attackIfTargeted: [...allBosses, 'phoenix',
			'pinkgoo', 'rharpy', 'rimedjinn', 'slenderman', 'snowman', 'tiger'],
		neverAttack: ['nerfedmummy', 'target_ar500red', 'target_ar900', 'target', 'target_a500', 'target_a750', 'target_r500', 'target_r750'],
		useHuntersMark: true,
		useSupershot: true,
		minTargetsFor5Shot: 4,
		minTargetsFor3Shot: 2,
	},

	movement: {
		/* Hand-pinned approach chains, keyed 'map|x|y' of the DESTINATION, tried
		   by rageWaypoints before the search and refused if any of their own
		   points sit inside a rectangle. This one is the measured margin-12 route
		   from the spookytown spawn to the corridor park point: out west, down the
		   far side, then back east along y -1075..-1115. It is the operator's own
		   route - drawn on the map by hand before it was ever derived - and the
		   search now produces the same shape on its own, so this is insurance and
		   a saving of ~22,000 node expansions, not a crutch. */
		approaches: {
			'spookytown|290|-990': [
				[-450, -30], [-585, -45], [-715, -105], [-715, -115],
				[-585, -455], [-465, -670], [-465, -765], [-440, -910],
				[-295, -955], [115, -1075], [120, -1115], [270, -1115],
				[270, -1060]
			]
		},
		enabled: true,
		circleWalk: true,
		circleRadius: 75,
		moveThreshold: 25,
		clumpRadius: 85,
		/* Per-spot standing position, overriding the spawn-boundary centre that
		   scoreAllFarmSpots hands back. Measured off G.geometry.level2s with 24
		   sampled directions at 50 units: within 120 units of the cgoo spawn
		   centre (34,503) the average open approach lane count is 23.9 of 24 -
		   a fully open field, which is what nine simultaneous attackers looks
		   like. (-86,683) is 3 of 24, reachable in the same flood-fill region,
		   222 units out, with 2 lanes facing the spawn so they still come. It is
		   a funnel to pull into, not a firing position - nothing there has line
		   of fire to the spawn centre. Free at a respawn-capped spot. */
		anchors: {
			'cgoo@level2s': { x: -86, y: 683 }
		},
		rangedKiting: {
			enabled: true,
			/* Hand-tuned list - authoritative, never derived. See kiteThreatRadius(). */
			targets: ['bscorpion'],
			overrides: {
				/* Measured tuning preserved verbatim. optimalDistance 170 deliberately
				   EXCEEDS Dexon's 160 range: against bscorpion this is an avoid, not a
				   kite-and-shoot, because the threat is weakness_aura (radius 100) and
				   not the 32 attack range. maxDistance 400 preserves the old convergence
				   toward 170 instead of letting the corrected band push him further out. */
				bscorpion: { minDistance: 155, optimalDistance: 170, maxDistance: 400 }
			},
			/* FALSE deliberately. True made kiteCandidateTypes() add every monster we
			   outrun by speedRatio, which grew the list from the 1 hand-tuned entry to
			   13 and made `targets` authoritative in name only. Measured on the live
			   slot 2026-09-28: the operator had already turned it off there. Turn it
			   back on only alongside a measurement of what the derived list adds. */
			autoBySpeed: false,
			speedRatio: 1.3,
			attackMargin: 15,
			/* Disengage abandons the hold band once this many monsters are on us.
			   Default is character.courage, the count tolerated before fear starts
			   and actions stop. Holding optD is right against one monster and fatal
			   against nine - measured 2026-09-26, nearest went 92 to 10 while
			   attackers went 3 to 9, and he died at the band's own threshold. */
			disengageOnCourage: true,
			disengageDistance: 60,
			/* Fallbacks only - per-target values come from kiteBand(). */
			minDistance: 155,
			maxDistance: null,
			rangeBuffer: 20,
			optimalDistance: 170,
			moveThrottle: 100,
			sampleAngles: 90,
			moveDistance: 30,
			prioritizeDistance: true,
			repositionThreshold: 20,
			maxKiteRange: 400,
			debug: false
		}
	},

	equipment: {
		bossHpThresholds: {
			mrpumpkin: 100000,
			mrgreen: 100000,
			crabxx: 100000,
			grinch: 100000,
			dragold: 200000,
			wabbit: 5000,
		},
		mpThresholds: { upper: 1700, lower: 2100 },
		chestThreshold: 12,
		swapCooldown: 500,
		capeSwapEnabled: false,
		coatSwapEnabled: true,
		bossSetSwapEnabled: true,
		xpSetSwapEnabled: false,
		xpMonsters: ['sparkbot'],
		xpMobHpThreshold: 12000,
		useLicence: false,
		temporal: {
			enabled: true,
			targetMob: 'bscorpion',
			orbName: 'orboftemporal',
			skillName: 'temporalsurge',
			characters: ['FatherToken', 'Dexon', 'MageofOz'],
			storageKey: 'temporal_surge_rotation'
		}
	},

	potions: {
		autoBuy: true,
		hpThreshold: 400,
		mpThreshold: 500,
		minStock: 1000,
		// autoBuyPotions runs on the 2s maintenance tick, and the low-stock
		// condition it fires on is not transient: away from a vendor, or broke,
		// buy() fails and the count stays under the threshold. That sent two
		// messages every two seconds, indefinitely, from every fighter.
		//
		// The cooldown is the real fix and the gate below is an optimisation on
		// top of it. That ordering matters: the gate can be wrong about
		// reachability, but the cooldown bounds the cost either way.
		requestCooldownMs: 30000,

		/* The emergency restock is a walk to a vendor now, not a town() teleport
		   - see checkPotionEmergency(). These three bound it. restockTripMs caps
		   the walk, and it is minutes rather than seconds because desertland ->
		   Alia -> main is a real journey. restockBuyMs caps the purchase.
		   restockRetryMs is how long a failed trip is left alone, and that is the
		   one that matters: without it, a vendor we cannot reach becomes a trip
		   attempted on every single main tick, which is exactly the loop this
		   change is fixing. */
		restockTripMs: 180000,
		restockBuyMs: 15000,
		restockRetryMs: 60000,
	},

	party: {
		autoManage: true,
		/* Leader-exempt by construction - see holdCohesion(). Present so the
		   three files carry the same shape. */
		cohesion: { enabled: true, leash: 150, stepMax: 120, debug: false },
		groupMembers: ['Dexon', 'MageofOz', 'FatherToken', 'Meltymerch']
	},

	looting: {
		enabled: true,
		delayMs: 180000,
		// Bounds one pass so draining a large backlog cannot become a single
		// unbroken chain of socket calls. 25 x 4 passes/sec = 100 loots/sec.
		maxPerPass: 25,
	},

	selling: {
		enabled: true,
		whitelist: [
			'angelwings', 'candycanesword', 'carrotsword', 'coat1',
			'crabclaw', 'cupid', 'dexring', 'eears', 'eggnog', 'epyjamas', 'eslippers',
			'gloves', 'gloves1', 'helmet', 'helmet1', 'hhelmet', 'harmor', 'hpants',
			'hboots', 'hgloves', 'hotchocolate', 'hpamulet', 'hpbelt', 'iceskates',
			'intring', 'lantern', 'lostearring', 'merry', 'mittens', 'mushroomstaff',
			'ornamentstaff', 'oxhelmet', 'pants', 'pants1', 'pinkie',
			'pstem', 'quiver', 'rednose', 'ringsj', 'santasbelt', 'skullamulet',
			'stramulet', 'dexamulet', 'intamulet', 'shoes1', 'smoke', 'snowball',
			'snowflakes', 'spear', 'strring', 't2bow', 'throwingstars', 'tshirt0',
			'tshirt1', 'tshirt2', 'vitearring', 'vitring', 'warmscarf', 'wbook0',
			'wgloves', 'wcap', 'wattire', 'wbreeches', 'wshoes', 'xmashat',
			'xmasshoes', 'xmassweater', 'xmaspants'
		],
	},

	upgrading: { enabled: false, whitelist: {} },
	combining: {
		enabled: false,
		whitelist: {
			dexamulet: { targetLevel: 3, primling: 3, prim: 4 },
			intamulet: { targetLevel: 3, primling: 3, prim: 4 },
			stramulet: { targetLevel: 3, primling: 3, prim: 4 }
		}
	},

	characterStarter: {
		enabled: false,
		characters: {
			MERCHANT: { name: 'Meltymerch', codeSlot: 'CH_aLtHealaSgKdmOsDWpNl8scE9NhXk' },
			PRIEST: { name: 'FatherToken', codeSlot: 'CH_hae5t3g8gBezOVTdR6ToTagikbTbF' },
			MAGE: { name: 'MageofOz', codeSlot: 'CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom' }
		}
	},

	/* When the pack is full and no mule is coming, sell junk rather than stop.

	   DESTRUCTIVE, so the protections are the important part of this block and
	   not the thresholds. Nothing upgraded, nothing special, nothing locked and
	   nothing named below is ever sold, whatever it is worth - an item's vendor
	   price is a poor guide to whether you wanted to keep it, which is exactly
	   why "sell the cheapest" needs a floor under it rather than a sort alone. */
	inventoryRelief: {
		enabled: true,
		// How long the pack must stay full, with the merchant unreachable,
		// before selling. Long enough that a merchant mid-hop or mid-trade gets
		// to arrive first; this is a last resort, not a first response.
		graceMs: 90000,
		targetFreeSlots: 21,
		// Ernis in Mainland - the same NPC the merchant restocks potions from,
		// so it is a known-good vendor location in this codebase rather than a
		// guess. Any NPC that buys would do.
		vendor: { map: 'main', x: -35, y: -162 },
		neverSell: new Set([
			'hpot1', 'mpot1', 'xptome', 'xpbooster', 'luckbooster',
			'goldbooster', 'pumpkinspice', 'licence', 'tracker', 'ancientcomputer',
			'computer', 'supercomputer', 'cscroll0', 'cscroll1', 'cscroll2',
			'scroll0', 'scroll1', 'scroll2', 'stand0', 'stand1',
		]),
	},

	locationBroadcast: {
		enabled: true,
		targetPlayer: 'Meltymerch',
		checkInterval: 1000,
		lowInventorySlots: 3,
		// The pickup request fires on a one-second tick off a condition that
		// only clears when someone else acts. Same shape as the potion request.
		pickupCooldownMs: 15000,
		// Only used if the game's own skill table cannot be read. The real
		// requirement comes from G.skills.mluck.level at runtime, so it cannot
		// go stale if the game changes it - this is a floor for the case where
		// G is unavailable, not a second source of truth.
		mluckLevelFallback: 40,
	},

	dragold: {
		enabled: true,
		preSpawnBuffer: 3000,
	},

	/* BOSS EVENTS - the operator's rule, 2026-09-30: cooperative bosses only,
	   fought from maximum range, never expecting the kill. -> bossTick */
	bossEvents: {
		enabled: true,
		// G.monsters[x].cooperative - the game's own "credit is shared by damage
		// dealt" flag, and the only class of boss where chipping from range is a
		// strategy rather than a waste. An unknown monster is NOT cooperative.
		cooperativeOnly: true,
		// abtesting is team PvP with a 120s join window, not a boss.
		// slenderman is excluded because he cannot be WALKED to, not because he is
		// not worth fighting. The server broadcasts his MAP and nothing else -
		// server_functions.js sends { name, map } for him where every other boss
		// also carries x/y - so bossWalkTarget() returns null and the trip latches
		// until the 20 min maxTripMs cap. Measured 2026-10-04: all three characters
		// latched within 120ms of his cooldown lapsing, Dexon 63ms after.
		// He also cannot be CHASED: event_loop re-checks him every second and warps
		// him to a random one of cave/halloween/spookytown whenever any non-invis
		// player on his map is within 600 units, whenever a projectile targets him,
		// or every 2 minutes regardless. Our range is 165. Approaching him is
		// itself what removes him. Ranger.js takes hits of opportunity instead.
		exclude: new Set(['abtesting', 'slenderman']),
		// Names admitted even when the flag says no. Empty by design.
		include: [],
		holdFraction: 0.92,     // of OUR range, when we cannot get outside theirs
		rangeMargin: 25,        // beyond THEIR range, when our reach allows it
		holdTolerance: 25,      // don't re-step for less than this
		maxTripMs: 20 * 60 * 1000,
		maxDeaths: 2,
		// After giving up on an event, leave it alone this long. Without it the
		// party walks straight back out to the boss that just outlasted it.
		cooldownMs: 30 * 60 * 1000,
		leaderName: 'Dexon',
		leaderTrustMs: 20000,
	},

	/* ACHIEVEMENT QUEUE - off until you turn it on. -> ACHIEVEMENT QUEUE below. */
	/* MONSTER HUNT - off until you turn it on. -> MONSTER HUNT below.
	   mhOn() and mhOff() flip 'enabled' at runtime; off restores ordinary
	   farming and hands the spot straight back to the scorer. */
	monsterHunt: {
		enabled: false,
		/* The backstop on waiting for everyone, NOT the rule. The rule is in
		   mhSettled(): a member holding an unexpired hunt counts as settled,
		   because the server answers monsterhunt_already and leaves it
		   untouched, so they cannot reroll and waiting for them to "accept"
		   would never finish. This timer only covers a character gone quiet. */
		acceptWaitMs: 90 * 1000,
		askMs: 20 * 1000,               // how often to poll the other two for progress
		/* BOUND THE GRIND BY TIME, NEVER BY KILL COUNT. The server sets the
		   count as (20*60*times)/(max_hp/1000)/(respawn+0.25), so it scales
		   INVERSELY with how tough the monster is: a x500 assignment is bees,
		   a x1 is an 80,000 hp skeletor. The first guard here was maxCount:150
		   and it had the sign backwards - measured live 2026-10-04, it refused
		   a bee x500 that mhEvaluate priced at 200 SECONDS (main, 5-pack, 2.5
		   kills/s, uptime 1.0) and a minimush x500 at 250s, while a count-based
		   rule would happily admit a single 80,000 hp target. Count is not a
		   proxy for effort; seconds are. 0 disables this bound, and the hunt's
		   own 30-minute clock still applies either way just below. */
		maxEstMin: 15,
		huntCapMs: 25 * 60 * 1000,      // give up on one target after this
		/* BANK EACH HUNT THE MOMENT IT FINISHES, AND TAKE THE NEXT ONE ON THE SPOT.
		   Previously a finished hunt was only held in mhDone while the party
		   chained through the other members' hunts, and the whole batch was banked
		   at the end of the cycle. That is cheaper in Daisy trips and strictly
		   riskier in tokens: a hunt carries its own 30-minute clock, so anything
		   held unbanked can expire, and turnInMarginMs below existed only to guess
		   how much clock to keep spare for it. Immediate turn-in removes the guess
		   and the risk together, at the cost of one trip per hunt rather than one
		   per batch. Set false to go back to batching. */
		turnInImmediately: true,
		/* Ask for the next hunt without leaving Daisy. Accepting and turning in are
		   THE SAME CALL - parent.socket.emit('monsterhunt') with no arguments - and
		   the server decides which one it means from whether a finished hunt is
		   held. So the emit that banks a token and the emit that hands out the next
		   one are one after the other, from the spot we are already standing on.
		   Measured 2026-10-09 in the live client: exactly ONE client function emits
		   'monsterhunt' at all, npc_right_click, and it passes no second argument -
		   so the game's own Daisy panel sends a byte-identical request to this one.
		   Having to close and reopen her prompt in the UI is therefore a property
		   of the PANEL, not of the server: closing and reopening is simply how you
		   make npc_right_click fire a second time. There is no dialog state to
		   reset, and nothing for this path to reopen. */
		reAcceptAtDaisy: true,
		/* Only consulted while turnInImmediately is false - see above. */
		turnInMarginMs: 7 * 60 * 1000,  // clock kept spare to bank what is already done
		retryMs: 5 * 60 * 1000,         // after a cycle with nothing viable, hold off this long
	},

	achievements: {
		/* ON, and monsterHunt above stays OFF - shipped ready to paste and watch
		   the booboo/mummy run without editing anything first. */
		enabled: true,
		/* Consecutive failed travel attempts to an achievement spot before the
		   override is released. Needed because the breaker in the farm loop
		   blacklists a spot, and an achievement spot is whitelisted against
		   exactly that, so there was no way to give up. -> the release valve */
		maxTravelFailures: 10,
		refreshMs: 5 * 60 * 1000,   // how often to ask the server for a fresh tracker
		reassertMs: 30 * 1000,      // how often to check the override is still ours
		/* One-at-a-time pulling for a spot that sits beside a rage rectangle.
		   concurrent IS THE KNOB: how many of the target monsters may be in flight
		   at once. 1 is the measured-safe start - one un-enraged booboo is 264 dps
		   and one mummy 317 after armor, against FatherToken's ~1,499 hps, so the
		   ceiling is roughly four before healing loses. Raise it a step at a time;
		   courage still caps attackers on any one character independently. */
		pull: {
			enabled: true,
			concurrent: 1,
			margin: 4,           // margin + step must stay <= 9 - see rageCfg
			guardMargin: 0,      // the guard trips only on a REAL breach - see rageCfg
			step: 5,             // route-search grid, in units
			maxCells: 200000,
			parkWithin: 45,
			pullTimeoutMs: 20000,
			repullGapMs: 1200,
			respectCourage: true,
		},
		/* Each entry: the monster, where to stand, and the rung to stop at. rung is
		   the threshold out of G.monsters[m].achievements[0][0]; coordinates are the
		   same spots the manual overrides used. Edit, reorder or extend freely - the
		   saved position is an index, so achvReset(n) after a reorder. */
		queue: [
			/* Both spookytown rage-box spots, parked on the corridor between them -
			   the band outside BOTH rectangles, y -1130..-842. (415,-986) was the
			   old spot and it is NOT REACHABLE: a flood from it dies after 385 cells,
			   walled to east and west, and smart_move refuses it too. The corridor
			   is entered from the WEST, and (290,-990) sits in the part that connects
			   - 148 from the booboo rectangle, 140 from the mummy one, and arrived at
			   live with zero breaches. booboo is pulled by Dexon; a mummy at its spawn
			   edge needs 173 of reach, past the ranger's 163 and inside the priest's
			   201 and the mage's 235, so ragePuller hands those to them on range
			   alone, with no special case. `also` runs both from one entry
			   because booboo respawns every 48s against mummy's 24 and would otherwise
			   idle most of the trip; the rung still tracks `m`. rung null means run
			   until the toggle goes off or achvStop(). */
			{ m: 'booboo', map: 'spookytown', x: 290, y: -990, rung: null, also: ['mummy'] },
			{ m: 'stoneworm',  map: 'spookytown',  x:  677, y:   129, rung: 100000 },
			{ m: 'mole',       map: 'tunnel',      x:   14, y: -1072, rung: 10000  },
			{ m: 'armadillo',  map: 'main',        x:  526, y:  1846, rung: 100000 },
			{ m: 'porcupine',  map: 'desertland',  x: -829, y:   135, rung: 100000 },
			{ m: 'croc',       map: 'main',        x:  801, y:  1710, rung: 100000 },
			{ m: 'iceroamer',  map: 'winterland',  x:  824, y:   -45, rung: 100000 },
			{ m: 'poisio',     map: 'main',        x: -121, y:  1360, rung: 100000 },
			{ m: 'crabx',      map: 'main',        x: -984, y:  1762, rung: 100000 },
			{ m: 'squig',      map: 'main',        x:-1175, y:   422, rung: 100000 },
			{ m: 'tortoise',   map: 'main',        x:-1124, y:  1118, rung: 100000 },
			{ m: 'bbpompom',   map: 'winter_cave', x:  -82, y:  -949, rung: 100000 },
			{ m: 'bat',        map: 'batcave',     x:   66, y:     8, rung: 100000 }, 
			{ m: 'boar',       map: 'winterland',  x:   20, y: -1109, rung: 100000 },
			{ m: 'cgoo',       map: 'level2s',     x:   34, y:   503, rung: 100000 },
			{ m: 'spider',     map: 'main',        x:  948, y:  -144, rung: 100000 },
			{ m: 'ghost',      map: 'halloween',   x: -405, y: -1642, rung: 100000 },
			{ m: 'wolfie',     map: 'winterland',  x: -169, y: -2026, rung: 100000 },
			{ m: 'booboo',     map: 'spookytown',  x:  415, y:  -702, rung: 100000 },
			{ m: 'scorpion',   map: 'main',        x: 1578, y:  -168, rung: 100000 },
			{ m: 'gscorpion',  map: 'desertland',  x:  391, y: -1422, rung: 100000 },
			{ m: 'osnake',     map: 'halloween',   x: -509, y:  -626, rung: 100000 },
		],
	},

	muling: {
		enabled: true,
		muleName: 'Meltymerch',
		goldReserve: 500000,
		excludeItems: new Set(['hpot1', 'mpot1', 'tracker', 'luckbooster', 'xpbooster', 'pumpkinspice', 'xptome']),
	},
};

const TICK_RATE = { main: 100, action: 15, mark: 40, equipment: 25, maintenance: 2000 };
const MERCHANT_WAIT_TIMEOUT_MS = 90000;
const COOLDOWNS = { cc: 135 };
const CACHE_TTL = 50;

const EVENT_LOCATIONS = [
	{ name: 'dragold', map: 'cave', x: 1150, y: -850 },
	{ name: 'mrgreen', map: 'spookytown', x: 610, y: 1000 },
	{ name: 'mrpumpkin', map: 'halloween', x: -222, y: 720 }
];

const getDynamicEvents = () => {
	const out = [...EVENT_LOCATIONS];
	const w = parent.S?.wabbit;
	if (w?.live) out.push({ name: 'wabbit', map: w.map, x: w.x, y: w.y });
	// Giga Crab is a daily with G.events.crabxx.join === true, so arrival is an
	// event join rather than a walk - no map or coordinates needed, and there is
	// no static monster pack to walk to anyway. handleEvents() already emits the
	// join for any entry carrying join: true.
	const c = parent.S?.crabxx;
	if (c?.live) out.push({ name: 'crabxx', join: true, map: c.map, x: c.x, y: c.y });
	return out;
};

const REGIONS = ['US', 'EU', 'ASIA'];

const COMBAT_SETS = {
	neverAttack: new Set(CONFIG.combat.neverAttack),
	attackIfTargeted: new Set(CONFIG.combat.attackIfTargeted),
	alwaysAttack: new Set(CONFIG.combat.alwaysAttack),
	targetPriority: new Set(CONFIG.combat.targetPriority),
	xpMonsters: new Set(CONFIG.equipment.xpMonsters),
	bosses: new Set(allBosses),
};

const state = {
	skinReady: false,
	lastEquipTime: 0,
	lastBoosterSwap: 0,
	lastCapeSwap: 0,
	lastCoatSwap: 0,
	lastBossSetSwap: 0,
	lastXpSwap: 0,
	angle: 0,
	lastAngleUpdate: performance.now(),
	waitingForMerchant: false,
	waitingForMerchantSince: 0,
	sellingOff: false,          // freeing slots at a vendor; mainLoop stands down
	restocking: false,
};

const cache = {
	targets: { sortedByHP: [], inRange: [], outOfRange: [], clumped: [] },
	healTarget: null,
	priestTargets: 0,
	hasLowHpXpMob: false,
	lastUpdate: 0,
	isValid() { return performance.now() - this.lastUpdate < CACHE_TTL; }
};

const locations = {
	bat: [{ x: 1200, y: -782 }],
	bigbird: [{ x: 1258, y: -120 }],
	bluefairy: [{ x: -376, y: -680 }],
	bscorpion: [{ x: -561, y: -1400 }],
	boar: [{ x: 19, y: -1109 }],
	cgoo: [{ x: -221, y: -274 }],
	crab: [{ x: -11840, y: -37 }],
	dryad: [{ x: 403, y: -347 }],
	ent: [{ x: -413, y: -1961 }],
	fireroamer: [{ x: 222, y: -827 }],
	ghost: [{ x: -405, y: -1642 }],
	gscorpion: [{ x: 390, y: -1422 }],
	iceroamer: [{ x: 823, y: -45 }],
	mechagnome: [{ x: 0, y: 0 }],
	mole: [{ x: 14, y: -1072 }],
	mummy: [{ x: 256, y: -1417 }],
	odino: [{ x: -52, y: 756 }],
	oneeye: [{ x: -632, y: 55 }],
	pinkgoblin: [{ x: 485, y: 157 }],
	poisio: [{ x: -121, y: 1360 }],
	prat: [{ x: 11, y: 84 }],
	pppompom: [{ x: 292, y: -189 }],
	plantoid: [{ x: -780, y: -387 }],
	rat: [{ x: 6, y: 430 }],
	scorpion: [{ x: -495, y: 685 }],
	stoneworm: [{ x: 830, y: 7 }],
	spider: [{ x: 895, y: -145 }],
	squig: [{ x: -1175, y: 422 }],
	targetron: [{ x: -544, y: -275 }],
	wolf: [{ x: 433, y: -2745 }],
	wolfie: [{ x: 113, y: -2014 }],
	xscorpion: [{ x: -495, y: 685 }]
};

let destination = null;

const equipmentSets = {
	single: [
		{ itemName: "bowofthedead", slot: "mainhand", level: 11, l: "l" },
		{ itemName: "t2quiver", slot: "offhand", level: 9, l: "l" },
	],
	dead: [
		{ itemName: "bowofthedead", slot: "mainhand", level: 11, l: "l" },
		{ itemName: "t2quiver", slot: "offhand", level: 9, l: "l" },
	],
	deadx: [
		{ itemName: "bowofthedead", slot: "mainhand", level: 11, l: "l" },
		{ itemName: "alloyquiver", slot: "offhand", level: 10, l: "l" },
	],
	boom: [
		{ itemName: "pouchbow", slot: "mainhand", level: 13, l: "l" },
		{ itemName: "alloyquiver", slot: "offhand", level: 10, l: "l" },
	],
	heal: [{ itemName: "cupid", slot: "mainhand", level: 9, l: "l" }],
	dps: [
		{ itemName: "dexearring", slot: "earring2", level: 5, l: "l" },
		{ itemName: "dexearring", slot: "earring1", level: 5, l: "l" },
		{ itemName: "suckerpunch", slot: "ring1", level: 3, l: "l" },
		{ itemName: "suckerpunch", slot: "ring2", level: 3, l: "u" },
	],
	luck: [
		{ itemName: "mearring", slot: "earring1", level: 0, l: "l" },
		{ itemName: "mearring", slot: "earring2", level: 0, l: "u" },
		{ itemName: "rabbitsfoot", slot: "orb", level: 2, l: "l" },
		{ itemName: "ringofluck", slot: "ring2", level: 0, l: "u" },
		{ itemName: "ringofluck", slot: "ring1", level: 0, l: "l" }
	],
	xp: [
		{ itemName: "talkingskull", slot: "orb", level: 4, l: "l" },
		{ itemName: "northstar", slot: "amulet", level: 2, l: "l" },
	],
	orb: [
		{ itemName: "orbofdex", slot: "orb", level: 5, l: "l" },
		{ itemName: "dexamulet", slot: "amulet", level: 6, l: "l" },
	],
	stealth: [{ itemName: "stealthcape", slot: "cape", level: 0, l: "l" }],
	cape: [{ itemName: "vcape", slot: "cape", level: 6, l: "l" }],
	mana: [{ itemName: "tshirt9", slot: "chest", level: 7, l: "l" }],
	stat: [{ itemName: "coat", slot: "chest", level: 12, l: "s" }],
};

const shouldAttackMob = (mob) => {
	if (!mob || mob.dead) return false;
	if (rageHoldFire(mob)) return false;
	if (COMBAT_SETS.neverAttack.has(mob.mtype)) return false;
	/* Giga Crab spawns 1,000 crabx, and alwaysAttack would commit us to every
	   one of them. Measured 2026-09-25: a crabx hits for 189 after mitigation
	   against a 4,621 HP pool - 24 hits - so the swarm is what kills a ranger
	   here, not the boss. The boss itself hits for 12,572, which is 2.7x the
	   whole pool, so trading with it is never an option either; the plan is to
	   stand outside its 45 range with our 160 and contribute damage. Ignoring
	   the adds keeps the shots on the boss, which is what earns cooperative
	   credit. Flip ignoreAddsDuringCrabxx to false to go back to the swarm. */
	if (mob.mtype === 'crabx' && CONFIG.combat.ignoreAddsDuringCrabxx && parent?.S?.crabxx?.live) return false;
	if (mob.mtype === home) return true;
	if (COMBAT_SETS.alwaysAttack.has(mob.mtype)) return true;
	if (COMBAT_SETS.attackIfTargeted.has(mob.mtype)) {
		return mob.target !== null && mob.target !== undefined;
	}
	return COMBAT_SETS.targetPriority.has(mob.target);
};

const EXPLOSION_RADIUS = { boom: 68 / 3.6, dead: 23 / 3.6 };

const updateCache = () => {
	if (!cache.isValid()) {
		if (!destination) return;
		const now = performance.now();
		const { x: homeX, y: homeY } = destination;
		const clumpRadius = CONFIG.movement.clumpRadius;
		const xpHpThreshold = CONFIG.equipment.xpMobHpThreshold;

		cache.priestTargets = 0;
		cache.hasLowHpXpMob = false;
		cache.untargeted = [];

		const sortedByHP = [];

		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (e.type !== 'monster') continue;

			if (e.target === 'FatherToken') cache.priestTargets++;

			if (!cache.hasLowHpXpMob && !e.dead &&
				(COMBAT_SETS.xpMonsters.has(e.mtype) || e.mtype === home) &&
				e.hp < xpHpThreshold) {
				cache.hasLowHpXpMob = true;
			}

			if (e.target == null && !COMBAT_SETS.alwaysAttack.has(e.mtype)) {
				cache.untargeted.push(e);
			}

			if (shouldAttackMob(e)) sortedByHP.push(e);
		}

		sortedByHP.sort((a, b) => {
			const aBoss = COMBAT_SETS.attackIfTargeted.has(a.mtype);
			const bBoss = COMBAT_SETS.attackIfTargeted.has(b.mtype);
			if (aBoss !== bBoss) return bBoss - aBoss;

			const aPriority = COMBAT_SETS.alwaysAttack.has(a.mtype);
			const bPriority = COMBAT_SETS.alwaysAttack.has(b.mtype);
			if (aPriority !== bPriority) return bPriority - aPriority;

			const aCurse = a.s?.curse ? 1 : 0, bCurse = b.s?.curse ? 1 : 0;
			if (aCurse !== bCurse) return bCurse - aCurse;

			const aMarked = a.s?.marked ? 1 : 0, bMarked = b.s?.marked ? 1 : 0;
			if (aMarked !== bMarked) return bMarked - aMarked;

			return b.hp - a.hp;
		});

		const inRange = [], outOfRange = [], clumped = [];
		for (const mob of sortedByHP) {
			if (is_in_range(mob)) {
				inRange.push(mob);
				if (Math.hypot(mob.x - homeX, mob.y - homeY) <= clumpRadius) {
					clumped.push(mob);
				}
			} else {
				outOfRange.push(mob);
			}
		}

		cache.targets = { sortedByHP, inRange, outOfRange, clumped };
		cache.healTarget = findHealTarget();
		cache.lastUpdate = now;
	}
};

const aoeUnsafe = (targets, radius) => {
	for (const t of targets) {
		for (const e of cache.untargeted) {
			if (Math.hypot(e.x - t.x, e.y - t.y) <= radius) return true;
		}
	}
	return false;
};

const findHealTarget = () => {
	const healer = get_entity('FatherToken');
	const threshold = (!healer || healer.rip) ? 0.9 : 0.5;
	const party = Object.keys(get_party() || {});

	let target = null, minPct = 1;

	for (const name of party) {
		if (name === character.name) continue;
		const ally = get_player(name);
		if (ally?.hp && ally?.max_hp && !ally.rip) {
			const pct = ally.hp / ally.max_hp;
			if (pct < minPct) { minPct = pct; target = ally; }
		}
	}

	return minPct < threshold ? target : null;
};

// ============================================================================
// AWAIT HANG GUARD
// ============================================================================
// Every loop below is an async function that schedules its own next tick only
// after its body resolves. A THROW is already handled - each loop reschedules
// from its catch, or after it. A HANG is not: if an awaited call never
// settles, execution never reaches the reschedule and the chain simply ends,
// silently and permanently. setInterval work (buffs, loot, party keepalives)
// keeps running, so the character still looks alive on /hub while doing
// nothing at all.
//
// Measured 2026-09-22 on Dexon: actionLoop ran 0 iterations in 20s where ~1300
// were due, and mainLoop was dead in the same window - is_disabled(), which it
// calls every 250ms, was not called once. He stood in range of crabs casting
// nothing until the page was reloaded, and the party earned 0 xp. use_skill()
// and smart_move() both return promises the game can leave unsettled, so this
// is a live failure mode, not a theoretical one.
//
// noHang() bounds an awaited call. On timeout it REJECTS, which lands in the
// loop's own catch and lets that loop reschedule normally: the tick is lost,
// the chain is not. Same intent as travelWatchdog, applied to the loops.
// Wrapping only the awaits that appear DIRECTLY in a loop body is enough - a
// hang deeper in a helper propagates up to that await and is bounded there.
const HANG_GUARD = {
	defaultMs: 10000,
	logEveryMs: 30000,   // the guard must log, or "hung" and "idle" look identical
};
let lastHangLogAt = 0;

function noHang(p, label, ms) {
	if (!p || typeof p.then !== 'function') return Promise.resolve(p);
	const limit = ms || HANG_GUARD.defaultMs;
	let timer = null;
	return Promise.race([
		Promise.resolve(p).finally(() => clearTimeout(timer)),
		new Promise((_, reject) => {
			timer = setTimeout(() => {
				const now = Date.now();
				if (now - lastHangLogAt >= HANG_GUARD.logEveryMs) {
					lastHangLogAt = now;
					game_log(`"${label}" did not settle in ${Math.round(limit / 1000)}s - dropping this tick`, 'orange');
				}
				reject(new Error(`hang guard: ${label}`));
			}, limit);
		}),
	]);
}

async function mainLoop() {
	try {
		/* Containment first, and the pull owns movement while it runs - the same
		   stand-down shape as sellingOff and mhBusy below. ragePullTick is NOT
		   awaited: a pull is two round trips and mainLoop is wrapped in the 10s
		   HANG_GUARD, which is exactly the trap restockTrip was detached to avoid. */
		if (await rageGuard()) return setTimeout(mainLoop, 250);
		if (ragePull.busy || rageNav.busy) return setTimeout(mainLoop, 250);
		if (ragePullActive()) ragePullTick().catch(e => rageLog('pull tick threw: ' + (e && e.message || e), 'red'));
		if (is_disabled(character)) return setTimeout(mainLoop, 250);
		// Selling junk off to make room. Same shape as waiting for the merchant:
		// stand down until it finishes, and it always finishes.
		if (state.sellingOff) return setTimeout(mainLoop, 250);
		/* A Daisy trip owns movement. Same shape as the merchant wait: stand down
		   until it finishes, and it always finishes - mhGoDaisy is noHang-bounded. */
		if (mhBusy) return setTimeout(mainLoop, 250);
		if (state.waitingForMerchant) {
			if (Date.now() - state.waitingForMerchantSince > MERCHANT_WAIT_TIMEOUT_MS) {
				state.waitingForMerchant = false;
				game_log('Gave up waiting on the merchant - resuming on my own', 'red');
			} else {
				return setTimeout(mainLoop, 250);
			}
		}
		if (await noHang(checkPotionEmergency(), 'checkPotionEmergency')) {
			return setTimeout(mainLoop, TICK_RATE.main);
		}
		if (!home || !mobMap || !destination) {
			return setTimeout(mainLoop, 250);
		}

		updateCache();

		if (CONFIG.equipment.useLicence) {
			let slot = locate_item("licence");
			if (slot === -1 && (character?.s?.licenced?.ms ?? 0) < 5000) {
				await buy("licence");
				slot = locate_item("licence");
			}
			if ((character?.s?.licenced?.ms ?? 0) < 250 && slot !== -1) {
				await consume(slot);
			}
		}

		if (await noHang(dragold.tick(), 'dragold.tick') === 'block') {
			return setTimeout(mainLoop, TICK_RATE.main);
		}
		if (character.map === "jail" && !smart.moving) {
			log("Jail escape plan!");
			return smart_move(find_npc("jailer")).then(() => {
				parent.socket.emit("leave");
			});
		}

		else if (shouldHandleEvents()) {
			handleEvents();
		}
		else if (CONFIG.movement.enabled) {
			if (!get_nearest_monster({ type: home })) {
				handleReturnHome();
			} else if (CONFIG.movement.rangedKiting.enabled) {
				/* Chained, not exclusive. rangedKite() returns false when nothing
				   kite-worthy is in reach, and this was an `else if` - so merely
				   enabling kiting would have retired walkInCircle() altogether and
				   left him standing still at every ordinary farm spot. */
				const kited = await noHang(rangedKite(), 'rangedKite');
				if (!kited && CONFIG.movement.circleWalk) walkInCircle();
			} else if (CONFIG.movement.circleWalk) {
				walkInCircle();
			}
		}
	} catch (e) {
		console.error('mainLoop error:', e);
	}

	setTimeout(mainLoop, TICK_RATE.main);
}

const ACTION_MIN_DELAY = 15;

const actionLoop = async () => {
	try {
		if (is_disabled(character)) return setTimeout(actionLoop, 25);
		updateCache();
		const ms = ms_to_next_skill('attack') - 1.5;
		if (ms < 3) {
			if (cache.healTarget) { equipSet('heal'); await noHang(use_skill('attack', cache.healTarget), 'use_skill heal'); }
			else await noHang(handleAttack(), 'handleAttack');
			return setTimeout(actionLoop, ACTION_MIN_DELAY);
		}
		return setTimeout(actionLoop, ms > 8 ? ms - 6 : ACTION_MIN_DELAY);
	} catch { return setTimeout(actionLoop, ACTION_MIN_DELAY); }
};

/* ---- Slenderman: hits of opportunity, never a trip ------------------------
   He is in CONFIG.bossEvents.exclude, so the boss code will not walk to him.
   That is not squeamishness - it is that the walk cannot work:

     * The spawn broadcast carries only { name, map }. Every other boss also
       sends x/y. bossWalkTarget() therefore returns null for him, forever.
     * event_loop runs once a second and relocates him to a random walkable
       node on a random one of cave/halloween/spookytown if ANY non-invisible
       player on his map comes within 600 units, if any projectile targets
       him, or if 2 minutes have passed. Our range is 165. We cannot close
       435 units without being the thing that teleports him away.
     * Only s.invis suppresses the proximity trigger, and step_out_of_invis()
       sits in the shared attack path, so even a rogue drops invis on its own
       first swing. Nobody holds him. He has sat at 66,666/66,666 all event.

   So the only shot that exists is the one where he materialises on top of us.
   This runs at attack cadence and takes exactly that shot and nothing else:
   no movement, no target commitment, no trip.

   PHYSICAL ATTACKERS ONLY. reflection:96 is gated on defense == 'resistance',
   which is set for MAGICAL damage only, so a mage or priest would send 96% of
   each cast into their own face. The ranger is clean: slenderman carries no
   armor, no resistance and no evasion, so physical lands in full. The class is
   read from G at runtime rather than hardcoded so this block stays correct if
   it is ever copied into the other two files - there it simply never fires. */
const SLENDER_MAPS = new Set(['cave', 'halloween', 'spookytown']);
let slenderLastNote = 0;
function slenderNote() {
	if (Date.now() - slenderLastNote < 1000) return;
	slenderLastNote = Date.now();
	try { game_log('[slender] in range - taking the shot', '#B388FF'); } catch (e) { }
	console.log('[slender] in range - taking the shot');
}
function slenderOpportunity() {
	try {
		if (typeof parent === 'undefined' || !parent.entities) return null;
		const S = parent.S || {};
		if (!S.slenderman || !S.slenderman.live) return null;
		if (!SLENDER_MAPS.has(character.map)) return null;
		/* typeof, not truthiness: an undeclared identifier THROWS. */
		const cls = (parent.G && parent.G.classes) ? parent.G.classes[character.ctype] : null;
		if (!cls || cls.damage_type !== 'physical') return null;
		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (!e || e.type !== 'monster' || e.mtype !== 'slenderman' || e.dead) continue;
			if (typeof is_in_range === 'function' && !is_in_range(e)) return null;
			return e;
		}
		return null;
	} catch (err) {
		/* A default returned from a catch must say so, or 'the helper is missing'
		   and 'there is no slenderman here' stay indistinguishable forever. */
		console.error('[slender] opportunity check threw:', err);
		return null;
	}
}

const handleAttack = async () => {
	// FIRE ONLY AT WHAT IS ACTUALLY IN RANGE.
	// `sortedByHP` is every monster on screen, sorted by HP descending and NOT
	// filtered by range. top5/top3 used to slice from it, and of the six branches
	// below only the last one ever checked range - so the aoe branches routinely
	// fired at the three or five HEALTHIEST mobs on screen, which are the ones
	// still at full HP precisely because nobody can reach them. The `clumped`
	// guard did not help: it proves SOME mob is close, then the shot goes to
	// top3 anyway. Measured 2026-09-22: 33 consecutive 3shot casts at crabs
	// 683-715 units away with a range of 158, and 0 xp from all 33.
	// `inRange` is the same list in the same HP order, minus that mistake, so
	// every branch below inherits the range check for free.
	/* Slenderman first, and only if he is already standing in our range. See
	   slenderOpportunity() for why there is no path to him and never will be.
	   Checked before the inRange guard below on purpose: he is not in
	   alwaysAttack and not `home`, so shouldAttackMob() keeps him out of
	   cache.targets entirely and inRange is routinely empty while he is
	   literally on top of us. */
	const slender = slenderOpportunity();
	if (slender) {
		change_target(slender);
		slenderNote();
		await noHang(use_skill('attack', slender), 'use_skill slenderman');
		return;
	}

	const { inRange, clumped } = cache.targets;
	if (!inRange.length) return;

	/* Concentrate. Aggro scales with how many DISTINCT monsters have been
	   provoked, and a focused target dies ~3x sooner so it stops swinging. */
	const ff = CONFIG.combat.focusFire || {};
	const crowded = ff.enabled !== false && kiteAttackerCount() >= (character.courage || 2);
	/* Built per call rather than hoisted into COMBAT_SETS, so the list can be
	   edited live from the console without a redeploy. Ten names at attack
	   cadence costs nothing. */
	const stSet = new Set(ff.singleTargetMobs || []);
	const listedHome = (typeof home !== 'undefined') && stSet.has(home);
	const listedHere = stSet.size > 0 && inRange.some(function (m) { return stSet.has(m.mtype); });
	if (ff.enabled !== false && (listedHome || listedHere || ff.preferSingleTarget || crowded)) {
		const pick = ff.leaderPicksLowestHp !== false
			? inRange.reduce(function (a, b) { return (a && a.hp <= b.hp) ? a : b; }, null)
			: inRange[0];
		if (pick) {
			change_target(pick);
			equipSet('single');
			await noHang(use_skill('attack', pick), 'use_skill focus');
			return;
		}
	}

	const min5 = CONFIG.combat.minTargetsFor5Shot;
	const min3 = CONFIG.combat.minTargetsFor3Shot;
	const can5 = character.level >= (G.skills['5shot']?.level || 0) && character.mp >= (G.skills['5shot']?.mp || 0);
	const can3 = character.level >= (G.skills['3shot']?.level || 0) && character.mp >= (G.skills['3shot']?.mp || 0);
	const top5 = can5 && inRange.length >= min5 ? inRange.slice(0, 5) : null;
	const top3 = can3 && inRange.length >= min3 ? inRange.slice(0, 3) : null;

	if (can5 && clumped.length >= min5) {
		const slice = clumped.slice(0, 5);
		if (!aoeUnsafe(slice, EXPLOSION_RADIUS.boom)) {
			equipSet('boom');
			await use_skill('5shot', slice.map(e => e.id));
			return;
		}
	}
	if (top5 && !aoeUnsafe(top5, EXPLOSION_RADIUS.dead)) {
		equipSet('dead'); await use_skill('5shot', top5.map(e => e.id)); return;
	}
	if (top3 && clumped.length >= min3 && !aoeUnsafe(top3, EXPLOSION_RADIUS.dead)) {
		equipSet('deadx'); await use_skill('3shot', top3.map(e => e.id)); return;
	}
	if (top3 && !aoeUnsafe(top3, EXPLOSION_RADIUS.dead)) {
		equipSet('dead'); await use_skill('3shot', top3.map(e => e.id)); return;
	}
	if (top5) {
		equipSet('dead'); await use_skill('5shot', top5.map(e => e.id));
	} else if (top3) {
		equipSet('dead'); await use_skill('3shot', top3.map(e => e.id));
	} else {
		// inRange[0] is in range by construction. The old form tested
		// sortedByHP[0], so when the healthiest mob on screen was out of reach
		// this fell through and attacked nothing at all, even with mobs at melee.
		equipSet('single'); await noHang(use_skill('attack', inRange[0]), 'use_skill single');
	}
};

const skillLoop = async () => {
	let delay = 15;
	try {
		if (!CONFIG.combat.useHuntersMark && !CONFIG.combat.useSupershot) return;
		if (is_disabled(character)) return setTimeout(skillLoop, 250);

		updateCache();

		const { sortedByHP } = cache.targets;
		if (!sortedByHP.length) return setTimeout(skillLoop, 250);

		const target = sortedByHP[0];
		if (!target || !is_in_range(target)) return setTimeout(skillLoop, 250);

		const msHunter = ms_to_next_skill('huntersmark');
		const msSuper = ms_to_next_skill('supershot');
		const minMs = Math.min(msHunter, msSuper);

		if (minMs < (character.ping || 0) / 10) {
			change_target(target);

			if (CONFIG.combat.useHuntersMark && msHunter === 0 && !target.s?.marked && target.hp >= target.max_hp * 0.01 && character.mp >= (G.skills.huntersmark?.mp || 0)) {
				await noHang(use_skill('huntersmark', target), 'use_skill huntersmark');
			}

			if (CONFIG.combat.useSupershot && msSuper === 0 && character.mp >= (G.skills.supershot?.mp || 0)) {
				await noHang(use_skill('supershot', target), 'use_skill supershot');
			}
		} else {
			delay = minMs > 200 ? 100 : minMs > 50 ? 20 : 15;
		}
	} catch (e) {
		console.error("skillLoop error:", e);
		delay = 15;
	}
	setTimeout(skillLoop, delay);
};

const maintenanceLoop = async () => {
	try {
		if (CONFIG.potions.autoBuy) autoBuyPotions();
		if (CONFIG.party.autoManage) partyMaker();
		if (CONFIG.selling.enabled) sellItems();
		if (CONFIG.upgrading.enabled) upgradeItems();
		if (CONFIG.combining.enabled) combineItems();

		if (CONFIG.muling.enabled) clearInventory();
		elixirUsage();
		checkFarmEconomics();

		if (character.rip) {
			await respawn();
			if (CONFIG.potions.autoBuy) {
				await sleep(1000);
				game_log('Respawned - topping up potions while in town', '#FFD700');
				await buyMissingPotions();
			}
		}
	} catch (e) {
		console.error('maintenanceLoop error:', describeError(e));
	}

	setTimeout(maintenanceLoop, TICK_RATE.maintenance);
}

async function potionLoop() {
	let delay = 100;

	try {
		const hpThreshold = character.max_hp - CONFIG.potions.hpThreshold;
		const mpThreshold = character.max_mp - CONFIG.potions.mpThreshold;

		if (character.mp < mpThreshold && !is_on_cooldown('use_mp')) {
			use_skill('use_mp');
			reduce_cooldown('use_mp', (character.ping || 0) * 0.95);
			delay = ms_to_next_skill('use_mp');
		} else if (character.hp < hpThreshold && !is_on_cooldown('use_hp')) {
			use_skill('use_hp');
			reduce_cooldown('use_hp', (character.ping || 0) * 0.95);
			delay = ms_to_next_skill('use_hp');
		}
	} catch (e) {
		console.error('potionLoop error:', describeError(e));
	}

	setTimeout(potionLoop, delay || 2000);
}

async function equipmentLoop() {
	const delay = TICK_RATE.equipment;

	try {
		if (!state.skinReady || character.cc > COOLDOWNS.cc) {
			return setTimeout(equipmentLoop, delay);
		}

		const now = performance.now();
		const swapCooldown = CONFIG.equipment.swapCooldown;

		const mainhand = character.slots?.mainhand?.name;
		if (mainhand === 'cupid') return setTimeout(equipmentLoop, delay);

		let activeBossName = null, activeBossData = null;
		for (const e of getDynamicEvents()) {
			const d = parent.S[e.name];
			if (d?.live) { activeBossName = e.name; activeBossData = d; break; }
		}

		if (now - state.lastBoosterSwap > swapCooldown) {
			let desiredBooster = activeBossData && activeBossData.hp < CONFIG.equipment.bossHpThresholds[activeBossName]
				? 'luckbooster'
				: 'xpbooster';

			const currentBoosterSlot = locate_item(desiredBooster);
			if (currentBoosterSlot === -1) {
				const otherBoosterSlot = findBoosterSlot();
				if (otherBoosterSlot !== null) {
					shift(otherBoosterSlot, desiredBooster);
					state.lastBoosterSwap = now;
				}
			}
		}

		if (CONFIG.equipment.capeSwapEnabled && now - state.lastCapeSwap > swapCooldown) {
			const chestCount = getNumChests();
			const numTargets = cache.priestTargets;
			const targetCapeSet = chestCount >= CONFIG.equipment.chestThreshold && numTargets < 6
				? 'stealth'
				: 'cape';

			if (targetCapeSet && !isSetEquipped(targetCapeSet)) {
				equipSet(targetCapeSet);
				state.lastCapeSwap = now;
			}
		}

		if (CONFIG.equipment.coatSwapEnabled && now - state.lastCoatSwap > swapCooldown) {
			const targetCoatSet = character.mp > CONFIG.equipment.mpThresholds.upper
				? 'stat'
				: character.mp < CONFIG.equipment.mpThresholds.lower && 'mana';

			if (targetCoatSet && !isSetEquipped(targetCoatSet)) {
				equipSet(targetCoatSet);
				state.lastCoatSwap = now;
			}
		}

		if (now - state.lastBossSetSwap > swapCooldown) {
			if (activeBossData && activeBossData.hp <= CONFIG.equipment.bossHpThresholds[activeBossName]) {
				if (!isSetEquipped('luck')) {
					equipSet('luck');
					state.lastBossSetSwap = now;
				}
			} else {
				if (activeBossName || character.map === mobMap) {
					if (!isSetEquipped('dps')) {
						equipSet('dps');
						state.lastBossSetSwap = now;
					}
				}

				if (CONFIG.equipment.xpSetSwapEnabled && now - state.lastXpSwap > swapCooldown) {
					const targetOrb = cache.hasLowHpXpMob ? 'xp' : 'orb';
					if (!isSetEquipped(targetOrb)) {
						equipSet(targetOrb);
						state.lastXpSwap = now;
					}
				}
			}
		}

		scare();

	} catch (e) {
		console.error('equipmentLoop error:', e);
	}

	setTimeout(equipmentLoop, delay);
}

const BOOSTER_NAMES = new Set(['xpbooster', 'goldbooster', 'luckbooster']);
function findBoosterSlot() {
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && BOOSTER_NAMES.has(item.name)) return i;
	}
	return null;
}

function getNumChests() {
	let n = 0;
	for (const _ in get_chests()) n++;
	return n;
}

// ============================================================================
// BOSS EVENTS - go, contribute from maximum range, come home.
// Cooperative bosses only, fought from max range, never expecting the kill.
// The reasoning and the measurements behind every number are in this version's
// entry in the header above; what follows is what the code needs.
//
// MEASURED 2026-09-30 (Dexon 75 / FatherToken 69 / MageofOz 70, party
// single-target DPS ~2,400, our ranges 158/197/201). hp, our time to kill,
// THEIR attack range:
//   crabxx    960k  462s   45   | icegolem   16M  5.2h   64
//   dragold    25M  4.1h  320   | mrpumpkin  36M  4.1h  520
//   mrgreen    36M  6.6h  620   | franky    120M 13.8h  948
// A boss whose range is under ours can be shot for free; one above it hits us
// wherever we stand, and we will never finish it. bossHoldDistance computes
// both postures, and maxTripMs/maxDeaths bound the second kind.
//
// JOINING, from adventureland_mongodb node/server.js socket.on('join'):
// exactly these four teleport, to these fixed spots, and everything else is
// walked to. That handler also refuses with no_merchants, cant_when_sick
// (hopsickness), cant_in_bank and cant_join - so the emit is NOT a general "go
// to the event" call. It ignores the emit within 200 units of the destination,
// which is why repeating it is free.
// ============================================================================
const BOSS_JOIN_SPOTS = {
	goobrawl: { map: 'goobrawl', x: null, y: null },
	crabxx: { map: 'main', x: -1000, y: 1700 },
	franky: { map: 'level2w', x: -300, y: 150 },
	icegolem: { map: 'winterland', x: 820, y: 425 },
};

/* goobrawl is the ONE joinable event whose parent.S key is an EVENT name and not
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
   franky's hopeless 948. */
const BOSS_FIGHT_TYPE = { goobrawl: 'rgoo' };
function bossMonsterType(name) { return BOSS_FIGHT_TYPE[name] || name; }

// ============================================================================
// RAGE BOXES - the geometry the farm scorer did not know about
//
// G.maps[map].monsters[i] can carry a `rage` rectangle beside its `boundary`.
// Measured 2026-10-09 in the live client, on spookytown:
//   mummy  boundary [31,-1571,480,-1293]  rage [-124,-1631,614,-1130]  (a halo
//          130-165 units larger than the spawn)
//   booboo boundary [286,-842,544,-562]   rage IDENTICAL to the boundary
//   booboo boundary [-820,-940,-570,-630] rage IDENTICAL to the boundary
//   stoneworm, mrgreen, jr - no rage field at all.
// Stepping inside one aggros the whole pack AND applies the monster's own
// `rage` multiplier, 1.5 for both: booboo's listed attack of 220 lands for
// ~352, and nine at once is ~3,800 dps into a 7,263 hp ranger.
//
// This is not theory. scoreAllFarmSpots() returns the spawn-boundary CENTRE, so
// an override on booboo resolved to (415,-702) - dead centre of the rage box.
// Measured the same day: three deaths, zero kills, the spawn never reached, and
// travelState left inFlight with failures: 0 because death kept interrupting
// the route. The monster was never the problem; the standing point was.
//
// Nothing here restricts movement OUTSIDE a rectangle. Closing, backing off and
// regrouping are all untouched - the rectangle is the only thing that is solid.
// ============================================================================

/* Dexon owns the knob. The followers have no CONFIG.achievements of their own,
   so without this, raising concurrent in Ranger.js would leave the priest and
   mage still gated at 1 - and the mage is the only one who can pull a mummy, so
   the throttle would land exactly where it hurts. Broadcast with the farm spot;
   null everywhere it has not arrived, which leaves the local default alone. */
let ragePullShared = null;

function rageCfg() {
	const a = (typeof CONFIG !== 'undefined' && CONFIG.achievements && CONFIG.achievements.pull) || {};
	return {
		enabled: a.enabled !== false,
		/* THE KNOB. How many of the target monsters may be in flight at once.
		   1 is the proven-safe start. Raise it as the farm earns trust: the only
		   other gate is courage, which stops a pull when this character already
		   has its own limit of attackers. Nothing else in here assumes 1. */
		concurrent: Math.max(1, ragePullShared || a.concurrent || 1),
		/* MEASURED 2026-10-09, and the single reason the party never arrived.
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
		   through the pinch with about 5 units to spare. */
		margin: (typeof a.margin === 'number') ? a.margin : 4,
		/* 5, not 25. A 10-unit grid cannot resolve a 14-unit gap: the same search
		   that succeeds at step 5 reports NO ROUTE at step 10 at every margin,
		   which is what made a passable corridor look like a sealed pocket and
		   sent me hunting for standoff spots that were never needed. */
		step: a.step || 5,
		/* Big enough that step 5 survives. The budget is spent BEFORE the grid is
		   built - too small and the doubling loop below pushes the step back to 20
		   and silently undoes the fix. Spookytown at step 5 is ~131,000 cells. */
		maxCells: a.maxCells || 200000,
		/* HYSTERESIS, and the reason nothing could move even when the route was
		   fine. The guard used to trip on the same margin the planner aims for,
		   so arriving at a correctly-planned spot WAS a breach: it stopped and
		   shoved the character out, travel walked back, forever. Measured on the
		   stuck party: 11 stop/xmove pairs in 5 seconds out of rageGuard, every
		   smart_move dying as "interrupted", hp full and targets 0 - no attacker
		   anywhere near it. The guard now fires only on a real breach of the
		   rectangle and escapes out to margin, leaving a full margin of slack
		   between "safe to stand here" and "get out now". */
		guardMargin: (typeof a.guardMargin === 'number') ? a.guardMargin : 0,
		parkWithin: a.parkWithin || 45,
		pullTimeoutMs: a.pullTimeoutMs || 20000,
		repullGapMs: (typeof a.repullGapMs === 'number') ? a.repullGapMs : 1200,
		respectCourage: a.respectCourage !== false,
		/* Interruptions are combat, not routing, so they get their own budget. */
		maxInterrupts: (typeof a.maxInterrupts === 'number') ? a.maxInterrupts : 12,
	};
}

function rageLog(m, c) {
	try { game_log('[rage] ' + m, c || '#FF9F6B'); } catch (e) { }
	console.log('[rage] ' + m);
}

/* Every rage rectangle on a map. Returns [] for a map with none, which is what
   makes all of this free everywhere else. */
function rageBoxes(map) {
	const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : (typeof G !== 'undefined' ? G : null);
	const m = g && g.maps && g.maps[map];
	if (!m || !Array.isArray(m.monsters)) return [];
	const out = [];
	for (const s of m.monsters) {
		const r = s && s.rage;
		if (Array.isArray(r) && r.length === 4) out.push({ type: s.type, r: r, boundary: s.boundary || null });
	}
	return out;
}

/* The box this point is in, inflated by margin, or null. */
function rageHit(map, x, y, margin) {
	const m = (typeof margin === 'number') ? margin : rageCfg().margin;
	const boxes = rageBoxes(map);
	for (let i = 0; i < boxes.length; i++) {
		const r = boxes[i].r;
		if (x >= r[0] - m && x <= r[2] + m && y >= r[1] - m && y <= r[3] + m) return boxes[i];
	}
	return null;
}

/* Does the straight line a->b clip any rectangle? Sampled, not analytic: the
   sample spacing is 15 units against rectangles 250 units on a side, so it
   cannot step over one. */
function rageClips(map, ax, ay, bx, by, margin) {
	if (!rageBoxes(map).length) return null;
	const n = Math.max(8, Math.min(160, Math.ceil(Math.hypot(bx - ax, by - ay) / 15)));
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const hit = rageHit(map, ax + (bx - ax) * t, ay + (by - ay) * t, margin);
		if (hit) return hit;
	}
	return null;
}

/* Nearest point outside every rectangle. Re-checks after each push, because
   leaving one box can put you inside another. */
function rageEscape(map, x, y, margin) {
	const m = (typeof margin === 'number') ? margin : rageCfg().margin;
	let px = x, py = y;
	for (let guard = 0; guard < 5; guard++) {
		const b = rageHit(map, px, py, m);
		if (!b) return { x: px, y: py };
		const r = b.r;
		const outs = [
			{ x: r[0] - m - 2, y: py }, { x: r[2] + m + 2, y: py },
			{ x: px, y: r[1] - m - 2 }, { x: px, y: r[3] + m + 2 },
		];
		outs.sort((p, q) => Math.hypot(p.x - px, p.y - py) - Math.hypot(q.x - px, q.y - py));
		px = outs[0].x; py = outs[0].y;
	}
	return { x: px, y: py };
}

/* A walkable route from->to that never enters a rectangle. BFS on a coarse grid
   with the rectangles treated as solid, then greedily simplified so EVERY leg
   is verified straight-line can_move-clear. That last property is the point:
   the legs get walked with xmove, so smart_move's pathfinder - which knows
   nothing about rage boxes and would happily cut the corner through one, the
   interior being ordinary open ground - is taken out of the loop entirely.
   Measured on spookytown: 4 ms. Returns null when there is no safe route, which
   is a refusal to travel rather than a licence to walk through. */
function rageRoute(map, from, to, margin) {
	if (typeof can_move !== 'function') return null;
	const cfg = rageCfg();
	const m = (typeof margin === 'number') ? margin : cfg.margin;
	const boxes = rageBoxes(map);
	if (!boxes.length) return null;

	let x0 = Math.min(from.x, to.x), x1 = Math.max(from.x, to.x);
	let y0 = Math.min(from.y, to.y), y1 = Math.max(from.y, to.y);
	for (const b of boxes) {
		x0 = Math.min(x0, b.r[0]); x1 = Math.max(x1, b.r[2]);
		y0 = Math.min(y0, b.r[1]); y1 = Math.max(y1, b.r[3]);
	}
	const PAD = 280;
	x0 -= PAD; x1 += PAD; y0 -= PAD; y1 += PAD;
	/* Clamp to the map. Without this the flood walks off the edge - can_move is
	   perfectly happy to answer for points outside the geometry - and spends the
	   whole cell budget in the void. Measured: an unclamped A* to the park point
	   expanded 400,000 nodes on a map holding only ~19,000 at step 20 and found
	   nothing; clamped, the same search exhausts honestly in 12,164. */
	try {
		const geo = G.geometry[map];
		if (geo) {
			x0 = Math.max(x0, geo.min_x); x1 = Math.min(x1, geo.max_x);
			y0 = Math.max(y0, geo.min_y); y1 = Math.min(y1, geo.max_y);
		}
	} catch (e) { }

	let step = cfg.step;
	while (((x1 - x0) / step + 1) * ((y1 - y0) / step + 1) > cfg.maxCells) step *= 2;
	const W = Math.floor((x1 - x0) / step) + 1, H = Math.floor((y1 - y0) / step) + 1;
	const base = character.base;
	const stand = (x, y) => { try { return !!can_move({ map: map, x: x, y: y, going_x: x, going_y: y, base: base }); } catch (e) { return false; } };
	const seg = (a, b) => { try { return !!can_move({ map: map, x: a[0], y: a[1], going_x: b[0], going_y: b[1], base: base }); } catch (e) { return false; } };

	/* The grid is tested at cell CENTRES, so two adjacent open centres can still
	   have a segment between them that clips a corner of the rectangle - both
	   endpoints outside a convex shape does not put the line outside it. Caught
	   by the harness: a leg into (550,-886) grazed the booboo box. Rejecting
	   cells within m + step of a rectangle buys a full cell of clearance, which
	   is more than any single 8-connected step can cross. The CLIP checks below
	   still use the configured margin, so the route is verified against the real
	   boundary rather than the padded one. */
	const gm = m + step;
	const grid = new Uint8Array(W * H);
	for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
		const x = x0 + i * step, y = y0 + j * step;
		grid[j * W + i] = (!rageHit(map, x, y, gm) && stand(x, y)) ? 1 : 0;
	}
	const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
	const cellOf = (p) => [clamp(Math.round((p.x - x0) / step), W - 1), clamp(Math.round((p.y - y0) / step), H - 1)];
	/* The start may be blocked - we could be standing in a box right now, which
	   is exactly the case this has to recover from - so seed from the nearest
	   open cell instead of giving up. */
	const nearestOpen = (c) => {
		if (grid[c[1] * W + c[0]]) return c;
		for (let rad = 1; rad < 14; rad++) {
			for (let di = -rad; di <= rad; di++) for (let dj = -rad; dj <= rad; dj++) {
				if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
				const ni = c[0] + di, nj = c[1] + dj;
				if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
				if (grid[nj * W + ni]) return [ni, nj];
			}
		}
		return null;
	};
	const S = nearestOpen(cellOf(from)), Gl = nearestOpen(cellOf(to));
	if (!S || !Gl) return null;

	const prev = new Int32Array(W * H).fill(-1);
	const seen = new Uint8Array(W * H);
	const q = [S[1] * W + S[0]];
	seen[q[0]] = 1;
	const goal = Gl[1] * W + Gl[0];
	/* FOUR-connected, on NODES only.
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
	   path afterwards. */
	const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
	let found = false, head = 0;
	while (head < q.length) {
		const cur = q[head++];
		if (cur === goal) { found = true; break; }
		const ci = cur % W, cj = (cur - ci) / W;
		for (let d = 0; d < 4; d++) {
			const ni = ci + D[d][0], nj = cj + D[d][1];
			if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
			const nk = nj * W + ni;
			if (seen[nk] || !grid[nk]) continue;
			seen[nk] = 1; prev[nk] = cur; q.push(nk);
		}
	}
	if (!found) return null;

	const raw = [];
	for (let k = goal; k !== -1; k = prev[k]) {
		const ci = k % W, cj = (k - ci) / W;
		raw.push([x0 + ci * step, y0 + cj * step]);
	}
	raw.reverse();

	const out = [raw[0]];
	let i = 0;
	while (i < raw.length - 1) {
		let best = i + 1;
		for (let j = raw.length - 1; j > i; j--) {
			if (seg(raw[i], raw[j]) && !rageClips(map, raw[i][0], raw[i][1], raw[j][0], raw[j][1], m)) { best = j; break; }
		}
		if (best === i + 1 && rageClips(map, raw[i][0], raw[i][1], raw[best][0], raw[best][1], m))
			rageLog('route leg ' + i + ' grazes a rectangle - the grid clearance should have prevented this', 'red');
		out.push(raw[best]); i = best;
	}
	return out;
}

/* Walk a safe route leg by leg. Every leg is straight-line clear by
   construction, so xmove is enough and no pathfinder gets a say. */
/* Walks a safe route, re-planning when a leg is refused instead of giving up on
   the whole trip.

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
   position to the second waypoint unverified. */
const rageNav = { busy: false };

/* An optional hand-pinned chain, tried before the search:
     CONFIG.movement.approaches['spookytown|415|-986'] = [[x1,y1],[x2,y2], ...]
   Measured 2026-10-09 across two monitored trips and 1,283 position samples,
   the pathfinder's own route to this park point never enters a rectangle, so
   nothing currently needs one - it exists so a spot CAN be pinned by hand
   without that being load-bearing. A chain whose own points sit inside a
   rectangle is refused rather than walked. */
function rageWaypoints(map, to, margin) {
	const mv = (typeof CONFIG !== 'undefined' && CONFIG.movement) || {};
	const key = map + '|' + Math.round(to.x) + '|' + Math.round(to.y);
	const hand = (mv.approaches || {})[key];
	if (Array.isArray(hand) && hand.length) {
		const bad = hand.filter((p) => rageHit(map, p[0], p[1], margin));
		if (!bad.length) return hand.concat([[to.x, to.y]]);
		rageLog('ignoring the hand-pinned approach for ' + key + ' - ' + bad.length + ' of its points sit inside a rectangle', 'orange');
	}
	return rageRoute(map, { x: character.x, y: character.y }, to, margin);
}

async function rageWalk(map, to, margin, attempts) {
	if (typeof xmove !== 'function') { rageLog('xmove is not a function here - cannot walk a safe route', 'red'); return false; }
	const cfg = rageCfg();
	const max = attempts || 4;
	const maxInterrupts = cfg.maxInterrupts;
	const near = (p) => Math.hypot(character.x - p[0], character.y - p[1]) < 12;
	const base = character.base;
	const legClear = (a, b) => {
		if (typeof can_move !== 'function') return false;
		try { return !!can_move({ map: map, x: a[0], y: a[1], going_x: b[0], going_y: b[1], base: base }); }
		catch (e) { return false; }
	};
	const pause = (ms) => new Promise((r) => setTimeout(r, ms));
	/* Anything else steering us is a second driver on the same wheel: smart.moving
	   was measured true throughout the stranded trip. */
	try { if (typeof stop === 'function') stop(); } catch (e) { }
	rageNav.busy = true;
	let interrupts = 0;
	try {
		for (let a = 0; a < max; a++) {
			if (near([to.x, to.y])) return true;
			const wp = rageWaypoints(map, to, margin);
			if (!wp || !wp.length) return false;          // genuinely no route
			let blocked = false;
			const was = [character.x, character.y];
			for (let i = 0; i < wp.length; i++) {
				if (near(wp[i])) continue;
				const from = [character.x, character.y];
				try {
					/* A leg can_move clears is walked directly, which keeps the
					   pathfinder out of it. One it does not clear is handed to
					   smart_move: both ends are already margin-clear of every
					   rectangle and the leg is short, so there is nowhere for it to
					   wander, and rageGuard is still watching. */
					if (legClear(from, wp[i])) await xmove(wp[i][0], wp[i][1]);
					else await smart_move({ map: map, x: wp[i][0], y: wp[i][1] });
				} catch (e) {
					const why = String((e && (e.reason || e.message)) || e);
					/* An interruption is COMBAT, not a bad route. Measured on the
					   desertland leg: 4 attackers against courage 2, the move
					   rejected as "interrupted", and the character pinned in place.
					   Spending a route attempt on that is how a walk through
					   contested ground exhausts its budget without ever being
					   wrong about the route. */
					if (/interrupt/i.test(why) && interrupts < maxInterrupts) {
						interrupts++;
						await pause(500);
						i--;
						continue;
					}
					blocked = true;
					rageLog('leg ' + (i + 1) + '/' + wp.length + ' refused (' + why + ') - re-planning', '#8b98ab');
					break;
				}
			}
			if (!blocked) return true;
			/* Gaining no ground is worth saying, but it is NOT a reason to stop:
			   an obstruction can be another character or a monster standing in the
			   way for a moment. The attempt cap is what bounds this - an earlier
			   version returned false the first time a leg failed before any had
			   succeeded, which made every transient block permanent. */
			if (Math.hypot(character.x - was[0], character.y - was[1]) < 1)
				rageLog('no ground gained on attempt ' + (a + 1) + ' of ' + max, '#8b98ab');
		}
		if (!near([to.x, to.y]))
			rageLog('gave up after ' + max + ' attempts' + (interrupts ? ' and ' + interrupts + ' interruptions' : '')
				+ ', ' + Math.round(Math.hypot(character.x - to.x, character.y - to.y)) + ' units short', 'orange');
		return near([to.x, to.y]);
	} finally {
		rageNav.busy = false;
	}
}

/* Hold fire. Two separate reasons, and the second is the one that brought three
   booboo onto the priest: shooting a monster that is still INSIDE its rectangle
   is what wakes the pack, so the party only ever engages what has already come
   out. The first simply keeps the party from stopping to fight on the way in and
   never arriving. */
function rageHoldFire(mob) {
	if (!mob || !mob.mtype) return false;
	const cfg = rageCfg();
	if (!cfg.enabled || !ragePullActive()) return false;
	if (ragePullTypes().indexOf(mob.mtype) < 0) return false;
	if (!destination || typeof destination.x !== 'number') return false;
	if (Math.hypot(character.x - destination.x, character.y - destination.y) > cfg.parkWithin) return true;
	return !!rageHit(character.map, mob.x, mob.y, 0);
}

function rageFilterTarget(t) { return rageHoldFire(t) ? null : t; }

/* The one mover everything else calls. Refuses to enter a rectangle, and routes
   around one rather than through it. Falls straight through to xmove on a map
   with no rage boxes, which is every map but spookytown today. */
async function safeMove(x, y) {
	if (typeof xmove !== 'function') return;
	const map = character.map;
	const cfg = rageCfg();
	if (!cfg.enabled || !rageBoxes(map).length) return xmove(x, y);

	if (rageHit(map, x, y, cfg.margin)) {
		const e = rageEscape(map, x, y, cfg.margin);
		x = e.x; y = e.y;
	}
	if (rageClips(map, character.x, character.y, x, y, cfg.margin)) {
		const ok = await rageWalk(map, { x: x, y: y }, cfg.margin);
		if (!ok) rageLog('no safe route to ' + Math.round(x) + ',' + Math.round(y) + ' - staying put', 'orange');
		return;
	}
	return xmove(x, y);
}

/* Containment. The net for everything no route planning can cover: a respawn
   somewhere unexpected, knockback, being dragged by a pull, or any routine that
   moved us before this existed. Runs first in mainLoop. */
async function rageGuard() {
	const cfg = rageCfg();
	if (!cfg.enabled) return false;
	let hit = null;
	/* cfg.guardMargin, NOT cfg.margin - see the note on guardMargin in rageCfg.
	   Detect on the real rectangle; escape out to the planner's margin. Using
	   one number for both is what pinned the party in place for a whole run. */
	try { hit = rageHit(character.map, character.x, character.y, cfg.guardMargin); } catch (e) { return false; }
	if (!hit) return false;
	rageLog('inside the ' + hit.type + ' rage box at ' + Math.round(character.x) + ',' + Math.round(character.y) + ' - leaving now', 'red');
	try { if (typeof stop === 'function') stop(); } catch (e) { }
	const e2 = rageEscape(character.map, character.x, character.y, cfg.margin);
	if (typeof xmove === 'function') {
		try { await xmove(e2.x, e2.y); } catch (err) { rageLog('escape move failed: ' + (err && err.message || err), 'red'); }
	}
	return true;
}

// ---- one-at-a-time pulling -------------------------------------------------
/* Dexon sets this from the achievement entry's `also`; the followers get it on
   the farm_spot message. Empty everywhere else, which leaves `home` alone. */
let rageAlso = [];
const ragePull = { openedAt: {}, lastPull: 0, busy: false };

function ragePullTypes() {
	const out = [];
	if (typeof home === 'string' && home) out.push(home);
	for (const t of rageAlso) if (out.indexOf(t) < 0) out.push(t);
	return out;
}

/* Active only where it is needed: the spot we are farming has to be one with a
   rage box on this map. Everywhere else the ordinary farm loop is untouched. */
function ragePullActive() {
	const cfg = rageCfg();
	if (!cfg.enabled) return false;
	if (!destination || destination.map !== character.map) return false;
	const types = ragePullTypes();
	if (!types.length) return false;
	const boxes = rageBoxes(character.map);
	for (const b of boxes) if (types.indexOf(b.type) >= 0) return true;
	return false;
}

function rageParty() {
	const names = (typeof CONFIG !== 'undefined' && CONFIG.party && CONFIG.party.groupMembers) || [];
	const out = [];
	for (const n of names) {
		if (n === character.name) { out.push({ name: n, range: character.range || 0, rip: !!character.rip, x: character.x, y: character.y }); continue; }
		const e = (typeof parent !== 'undefined' && parent.entities) ? parent.entities[n] : null;
		if (e && !e.rip) out.push({ name: n, range: e.range || 0, rip: false, x: e.x, y: e.y });
	}
	return out;
}

/* How far out a shooter has to be able to reach to hit this monster from the
   nearest point OUTSIDE its box. For booboo, whose rage equals its boundary,
   one at the near edge costs margin+2. For a mummy at its spawn edge the rage
   halo adds 163 on top, which is what puts it beyond the ranger's 163 and in
   reach of the priest at 201 and the mage at 235. */
function rageRequiredRange(map, mon, margin) {
	const cfg = rageCfg();
	const m = (typeof margin === 'number') ? margin : cfg.margin;
	const b = rageHit(map, mon.x, mon.y, 0);
	if (!b) return 0;
	const r = b.r;
	const d = Math.min(mon.x - r[0], r[2] - mon.x, mon.y - r[1], r[3] - mon.y);
	return d + m + 2;
}

/* Deterministic, so three characters deciding independently land on the same
   answer without a message: the longest range that can actually reach it, ties
   broken by name. */
function ragePuller(map, mon) {
	const need = rageRequiredRange(map, mon);
	let best = null;
	for (const p of rageParty()) {
		if (p.range < need) continue;
		if (!best || p.range > best.range || (p.range === best.range && p.name < best.name)) best = p;
	}
	return best;
}

function rageEngagedCount(types) {
	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	const names = (typeof CONFIG !== 'undefined' && CONFIG.party && CONFIG.party.groupMembers) || [];
	const now = Date.now(), cfg = rageCfg();
	let n = 0;
	const counted = {};
	for (const id in E) {
		const e = E[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (types.indexOf(e.mtype) < 0) continue;
		if (e.target && names.indexOf(e.target) >= 0) { counted[id] = 1; n++; }
	}
	/* One we have opened on but which has not registered a target yet still
	   counts, or the gate lets a second pull through in the gap. */
	for (const id in ragePull.openedAt) {
		if (now - ragePull.openedAt[id] > cfg.pullTimeoutMs) { delete ragePull.openedAt[id]; continue; }
		if (!counted[id] && E[id] && !E[id].dead) n++;
	}
	return n;
}

/* Picks one monster still inside its box and brings it out. Returns true when
   it owns this tick. */
async function ragePullTick() {
	if (ragePull.busy) return true;
	if (!ragePullActive()) return false;
	const cfg = rageCfg();
	const map = character.map;
	const types = ragePullTypes();

	if (rageEngagedCount(types) >= cfg.concurrent) return false;
	if (Date.now() - ragePull.lastPull < cfg.repullGapMs) return false;
	if (cfg.respectCourage) {
		const courage = character.courage || 2;
		let onMe = 0;
		const E = (typeof parent !== 'undefined' && parent.entities) || {};
		for (const id in E) if (E[id] && E[id].target === character.name) onMe++;
		if (onMe >= courage) return false;
	}

	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	let pick = null, pickD = Infinity;
	for (const id in E) {
		const e = E[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (types.indexOf(e.mtype) < 0) continue;
		if (e.target) continue;                       // already somebody's problem
		if (ragePull.openedAt[id]) continue;
		if (!rageHit(map, e.x, e.y, 0)) continue;     // already outside - the loop will take it
		const d = Math.hypot(e.x - character.x, e.y - character.y);
		if (d < pickD) { pick = e; pickD = d; }
	}
	if (!pick) return false;

	const puller = ragePuller(map, pick);
	if (!puller || puller.name !== character.name) return false;

	const need = rageRequiredRange(map, pick);
	const reach = Math.max(20, (character.range || 0) - 6);
	const b = rageHit(map, pick.x, pick.y, 0);
	if (!b) return false;
	/* Stand off the nearest edge, on the monster's side, as far back as our own
	   reach allows - never closer to the rectangle than the margin. */
	const r = b.r;
	const edges = [
		{ x: r[0] - cfg.margin - 2, y: pick.y }, { x: r[2] + cfg.margin + 2, y: pick.y },
		{ x: pick.x, y: r[1] - cfg.margin - 2 }, { x: pick.x, y: r[3] + cfg.margin + 2 },
	];
	edges.sort((p, q) => Math.hypot(p.x - pick.x, p.y - pick.y) - Math.hypot(q.x - pick.x, q.y - pick.y));
	const spot = edges[0];
	if (Math.hypot(spot.x - pick.x, spot.y - pick.y) > reach) return false;

	const park = destination ? { x: destination.x, y: destination.y } : { x: character.x, y: character.y };
	ragePull.busy = true;
	try {
		rageLog('pulling ' + pick.mtype + ' (need ' + Math.round(need) + ', reach ' + Math.round(reach) + ')', '#FFD700');
		await safeMove(spot.x, spot.y);
		if (typeof attack === 'function' && typeof is_in_range === 'function' && is_in_range(pick)) {
			try { await attack(pick); ragePull.openedAt[pick.id] = Date.now(); ragePull.lastPull = Date.now(); }
			catch (e) { rageLog('open shot failed: ' + (e && e.reason || e && e.message || e), 'orange'); }
		}
		await safeMove(park.x, park.y);
	} finally {
		ragePull.busy = false;
	}
	return true;
}

function rageStatus() {
	const map = character.map;
	const boxes = rageBoxes(map);
	rageLog(map + ': ' + (boxes.length ? boxes.map(b => b.type + ' [' + b.r.join(',') + ']').join('  ') : 'no rage boxes'), '#8b98ab');
	rageLog('pull ' + (ragePullActive() ? 'ACTIVE' : 'idle') + ' | types ' + ragePullTypes().join(',')
		+ ' | concurrent ' + rageCfg().concurrent + ' | margin ' + rageCfg().margin
		+ ' | engaged ' + rageEngagedCount(ragePullTypes()), '#8b98ab');
	return { boxes: boxes, types: ragePullTypes(), cfg: rageCfg() };
}

/* A map spawn point known to be outside every rectangle, used as the landing
   spot for a cross-map trip so the arrival itself cannot be inside a box.
   spookytown's first spawn is (0,0), clear of all three. */
function rageStaging(map) {
	const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	const sp = g && g.maps && g.maps[map] && g.maps[map].spawns;
	if (!Array.isArray(sp)) return null;
	for (const s of sp) {
		if (!Array.isArray(s) || typeof s[0] !== 'number' || typeof s[1] !== 'number') continue;
		if (!rageHit(map, s[0], s[1], rageCfg().margin)) return { x: s[0], y: s[1] };
	}
	return null;
}

/* smart_move, but it is never allowed to route through a rage rectangle. Used
   for BOTH directions - the trip in and, just as importantly, the trip back out
   when a boss event takes the party. bossApproach's smart_move was the obvious
   way to die on the way to a boss with the farm parked next to a box.
   A blocked route THROWS rather than falling back to smart_move: surfacing the
   failure is the house rule, and silently crossing the box is the one outcome
   worth failing to avoid. */
async function safeSmartMove(dest) {
	if (typeof smart_move !== 'function') throw new Error('smart_move is not a function');
	const cfg = rageCfg();
	const map = (dest && dest.map) || character.map;
	if (!cfg.enabled || !rageBoxes(map).length) return smart_move(dest);

	if (map !== character.map) {
		const stage = rageStaging(map);
		if (stage) await smart_move({ map: map, x: stage.x, y: stage.y });
		else await smart_move(dest);
	}
	if (character.map !== map || typeof dest.x !== 'number') return true;
	if (!rageClips(map, character.x, character.y, dest.x, dest.y, cfg.margin)) return smart_move(dest);
	const ok = await rageWalk(map, { x: dest.x, y: dest.y }, cfg.margin);
	if (!ok) {
		rageLog('no safe route to ' + Math.round(dest.x) + ',' + Math.round(dest.y) + ' on ' + map
			+ ' - refusing to let the pathfinder cut through a rage box', 'red');
		throw new Error('rage_route_blocked');
	}
	return true;
}

const BOSS_KEY = 'boss_trip';
const bossState = {
	trip: null,         // { name, startedAt, deaths, wasRip, src }
	cooldown: {},       // name -> ms until we will consider it again
	fromLeader: null,   // { name, at } - the leader's current call
	forced: null,       // { name, at } - bossJoin() from the console
	lastNote: null,
};
/* The trip survives a reload, which matters because a redeploy mid-event would
   otherwise restart the clock and hand the party another full 20 minutes at a
   boss it had already given up on. */
try {
	const bossSaved = get(BOSS_KEY);
	if (bossSaved && typeof bossSaved === 'object') {
		bossState.trip = bossSaved.trip || null;
		bossState.cooldown = bossSaved.cooldown || {};
	}
} catch (e) { }
function bossSave() {
	try { set(BOSS_KEY, { trip: bossState.trip, cooldown: bossState.cooldown }); }
	catch (e) { bossLog('could not persist the trip - a reload will restart its clock', 'orange'); }
}
function bossLog(m, c) { try { game_log('[boss] ' + m, c || '#FFD700'); } catch (e) { } console.log('[boss] ' + m); }
/* Said once per distinct message: approach runs every tick and would otherwise
   be the loudest thing in the log. */
function bossNote(m) { if (bossState.lastNote !== m) { bossState.lastNote = m; bossLog(m, '#8b98ab'); } }
function bossIsLeader() { return character.name === CONFIG.bossEvents.leaderName; }

function bossCooperative(name) {
	const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : (typeof G !== 'undefined' ? G : null);
	const m = g && g.monsters && g.monsters[bossMonsterType(name)];
	return !!(m && m.cooperative);
}

function bossLiveNames() {
	const S = (typeof parent !== 'undefined' && parent.S) || {};
	const out = [];
	for (const k in S) {
		const v = S[k];
		if (v && typeof v === 'object' && v.live) out.push(k);
	}
	return out;
}

/* The gate. Returns its reason rather than logging it, so bossStatus() can
   print the whole picture in one pass. */
function bossEligible(name) {
	const cfg = CONFIG.bossEvents;
	if (!cfg.enabled) return { ok: false, why: 'bossEvents.enabled is false' };
	if (cfg.exclude.has(name)) return { ok: false, why: 'excluded' };
	const byHand = cfg.include.indexOf(name) >= 0;
	if (cfg.cooperativeOnly && !byHand && !bossCooperative(name)) return { ok: false, why: 'not cooperative' };
	const until = bossState.cooldown[name] || 0;
	if (until > Date.now()) return { ok: false, why: 'gave up on it ' + Math.round((until - Date.now()) / 60000) + ' min ago' };
	return { ok: true, why: byHand ? 'included by hand' : 'cooperative' };
}

/* Which boss: an operator command first, then the leader's call, then our own
   reading. The own-reading tie-break is by NAME, not by iteration order,
   because three characters deciding independently have to land on the same
   answer or the party splits between two live bosses. */
function bossPick() {
	const cfg = CONFIG.bossEvents;
	if (bossState.forced && bossState.forced.name) {
		const f = bossState.forced.name;
		const d = (parent.S || {})[f];
		if (d && d.live) return { name: f, src: 'command' };
		bossLog('dropping the forced pick ' + f + ' - it is not live', 'orange');
		bossState.forced = null;
	}
	if (!bossIsLeader() && bossState.fromLeader && bossState.fromLeader.name
		&& (Date.now() - bossState.fromLeader.at) < cfg.leaderTrustMs) {
		const n = bossState.fromLeader.name;
		const d = (parent.S || {})[n];
		if (d && d.live) return { name: n, src: 'leader' };
	}
	let best = null;
	for (const n of bossLiveNames()) {
		if (!bossEligible(n).ok) continue;
		const d = parent.S[n];
		const ratio = (d && d.max_hp) ? (d.hp / d.max_hp) : 1;
		if (!best || ratio < best.ratio - 1e-9 || (Math.abs(ratio - best.ratio) < 1e-9 && n < best.name)) {
			best = { name: n, ratio: ratio };
		}
	}
	return best ? { name: best.name, src: 'own' } : null;
}

/* Outside their reach when ours is longer - which costs nothing - and otherwise
   the far edge of ours. Derived per boss from the live entity, never a
   constant: the difference between crabxx at 45 and franky at 948 is the whole
   decision. */
function bossHoldDistance(mon) {
	const cfg = CONFIG.bossEvents;
	const mine = Math.max(20, character.range || 100);
	const theirs = (mon && mon.range) || 0;
	let hold = Math.min(mine * cfg.holdFraction, mine - 5);
	const outside = theirs + cfg.rangeMargin;
	if (outside < mine && hold < outside) hold = outside;
	return Math.max(10, hold);
}

/* Stand at that distance, whether we are currently too close or too far. */
async function bossPosture(mon) {
	const hold = bossHoldDistance(mon);
	const dx = mon.x - character.x, dy = mon.y - character.y;
	const dist = Math.hypot(dx, dy) || 1;
	if (Math.abs(dist - hold) <= CONFIG.bossEvents.holdTolerance) return;
	if (smart.moving) return;
	const f = hold / dist;
	await safeMove(mon.x - dx * f, mon.y - dy * f);
}

function bossWalkTarget(name) {
	const d = (parent.S || {})[name];
	if (d && d.map && typeof d.x === 'number') return { map: d.map, x: d.x, y: d.y };
	for (const e of EVENT_LOCATIONS) if (e.name === name) return { map: e.map, x: e.x, y: e.y };
	const spot = BOSS_JOIN_SPOTS[name];
	if (spot && typeof spot.x === 'number') return { map: spot.map, x: spot.x, y: spot.y };
	return null;
}

async function bossApproach(name) {
	const mon = get_nearest_monster({ type: bossMonsterType(name) });
	if (mon) { await bossPosture(mon); return; }
	if (BOSS_JOIN_SPOTS[name]) {
		// hopsickness is the one refusal worth naming: it is temporary, and the
		// alternative reading - "join is broken" - would send us walking to a
		// destination the teleport reaches for free.
		if (character.s && character.s.hopsickness) { bossNote('hopsick - cannot join ' + name + ' yet'); return; }
		bossNote('joining ' + name);
		try { parent.socket.emit('join', { name: name }); } catch (e) { bossLog('join emit failed: ' + e, 'red'); }
		return;
	}
	if (smart.moving) return;
	const where = bossWalkTarget(name);
	if (!where) { bossNote('no position known for ' + name + ' - cannot travel'); return; }
	bossNote('walking to ' + name + ' on ' + where.map);
	safeSmartMove({ map: where.map, x: where.x, y: where.y })
		.catch(e => rageLog('boss approach blocked: ' + (e && e.message || e), 'orange'));
}

/* forced marks an operator command, which outranks the gate on every character
   that hears it. An unforced call is the leader's ordinary pick, and only the
   leader's is believed. */
function bossBroadcast(name, forced) {
	const members = (CONFIG.party && CONFIG.party.groupMembers) || [];
	for (const m of members) {
		if (m === character.name || m === 'Meltymerch') continue;   // join refuses merchants outright
		try { plSend(m, { message: 'boss', name: name, forced: !!forced }); } catch (e) { }
	}
}

/* Heard from another character. Lives here rather than in on_cm so all three
   files carry one copy of the rule. */
function bossOnCall(from, data) {
	const members = (CONFIG.party && CONFIG.party.groupMembers) || [];
	if (members.indexOf(from) < 0) return;
	if (data.forced) {
		if (data.name) {
			bossState.forced = { name: data.name, at: Date.now() };
			bossState.cooldown[data.name] = 0;
			bossSave();
			bossLog(from + ' called everyone to ' + data.name, '#7FD98A');
		} else {
			bossState.forced = null;
			if (bossState.trip) bossEnd(from + ' called it off');
			else bossLog(from + ' called it off');
		}
		return;
	}
	if (from !== CONFIG.bossEvents.leaderName) return;
	bossState.fromLeader = { name: data.name || null, at: Date.now() };
	if (!data.name && bossState.trip) bossEnd('the leader moved on');
}

/* Terminal for one trip. The cooldown is set ONLY when we gave up rather than
   when the event ended on its own - otherwise the party turns round and walks
   back out to the boss that just outlasted it, which is the same loop under a
   different name. */
function bossEnd(why) {
	const t = bossState.trip;
	if (!t) return;
	const mins = Math.round((Date.now() - t.startedAt) / 60000);
	const gaveUp = why.indexOf('death') >= 0 || why.indexOf('cap') >= 0 || why.indexOf('by hand') >= 0;
	if (gaveUp) bossState.cooldown[t.name] = Date.now() + CONFIG.bossEvents.cooldownMs;
	bossState.trip = null;
	bossState.forced = null;
	bossState.lastNote = null;
	bossSave();
	bossLog('leaving ' + t.name + ' after ' + mins + ' min (' + why + ') - back to farming'
		+ (gaveUp ? ', and leaving it alone for ' + Math.round(CONFIG.bossEvents.cooldownMs / 60000) + ' min' : ''), 'orange');
	if (bossIsLeader()) bossBroadcast(null);
	try { if (typeof handleReturnHome === 'function') handleReturnHome(); } catch (e) { }
}

async function bossTick() {
	const cfg = CONFIG.bossEvents;
	const t0 = bossState.trip;
	// Deaths are counted from the rip EDGE, so one corpse is one death however
	// many ticks it lies there.
	if (t0) {
		if (character.rip && !t0.wasRip) {
			t0.deaths++; t0.wasRip = true; bossSave();
			bossLog('died at ' + t0.name + ' (' + t0.deaths + ' of ' + cfg.maxDeaths + ')', 'red');
		} else if (!character.rip && t0.wasRip) {
			t0.wasRip = false; bossSave();
		}
	}
	const pick = bossPick();
	if (!pick) { if (bossState.trip) bossEnd('nothing eligible is live'); return false; }
	if (!bossState.trip || bossState.trip.name !== pick.name) {
		if (bossState.trip) bossEnd('switching to ' + pick.name);
		bossState.trip = { name: pick.name, startedAt: Date.now(), deaths: 0, wasRip: !!character.rip, src: pick.src };
		bossSave();
		bossLog('going to ' + pick.name + ' (' + pick.src + ', '
			+ (BOSS_JOIN_SPOTS[pick.name] ? 'joinable' : 'on foot') + ')');
		if (bossIsLeader()) bossBroadcast(pick.name);
	}
	const t = bossState.trip;
	if (t.deaths >= cfg.maxDeaths) { bossEnd(t.deaths + ' deaths'); return false; }
	if (Date.now() - t.startedAt > cfg.maxTripMs) { bossEnd('trip cap of ' + Math.round(cfg.maxTripMs / 60000) + ' min'); return false; }
	if (character.rip) return true;   // the respawn path owns us until we are up
	await bossApproach(t.name);
	return true;
}

/* ---- operator commands ---------------------------------------------------
   bossJoin('franky') goes now, whatever the gate thinks, and clears any
   cooldown on that name. From Dexon it takes the party; from anyone else it
   takes that character. bossHome() abandons the trip. bossStatus() prints what
   is live, what the gate says about each, and where we would stand. */
function bossJoin(name) {
	if (!name) {
		const live = bossLiveNames();
		bossLog('bossJoin("<name>") - live now: ' + (live.length ? live.join(', ') : 'nothing')
			+ ' | joinable: ' + Object.keys(BOSS_JOIN_SPOTS).join(', '));
		return;
	}
	bossState.forced = { name: name, at: Date.now() };
	bossState.cooldown[name] = 0;
	bossSave();
	bossLog('forced to ' + name + ' by hand', '#7FD98A');
	// From ANY character, not just the leader: "go now" has to mean the party,
	// not whichever console the operator happened to have open.
	bossBroadcast(name, true);
}
function bossHome() {
	bossState.forced = null;
	bossBroadcast(null, true);
	if (bossState.trip) bossEnd('bossHome() by hand');
	else bossLog('not on a boss trip');
}
function bossStatus() {
	const t = bossState.trip;
	bossLog('leader=' + CONFIG.bossEvents.leaderName + ' me=' + character.name
		+ ' trip=' + (t ? t.name + ' ' + Math.round((Date.now() - t.startedAt) / 60000) + 'min deaths=' + t.deaths + ' via ' + t.src : 'none'));
	const live = bossLiveNames();
	if (!live.length) bossLog('nothing live');
	for (const n of live) {
		const g = bossEligible(n);
		const d = parent.S[n];
		const mon = get_nearest_monster({ type: bossMonsterType(n) });
		const hold = mon ? Math.round(bossHoldDistance(mon)) : null;
		bossLog('  ' + n + ': ' + (g.ok ? 'ELIGIBLE' : 'skip') + ' (' + g.why + ')'
			+ (d && d.max_hp ? ' hp ' + Math.round(100 * d.hp / d.max_hp) + '%' : '')
			+ (BOSS_JOIN_SPOTS[n] ? ' joinable' : ' on foot')
			+ (hold != null ? ' hold at ' + hold + ' (my range ' + character.range + ', its ' + (mon.range || '?') + ')' : ''),
			g.ok ? '#7FD98A' : '#8b98ab');
	}
	for (const n in bossState.cooldown) {
		const left = bossState.cooldown[n] - Date.now();
		if (left > 0) bossLog('  cooling: ' + n + ' for ' + Math.round(left / 60000) + ' min', '#8b98ab');
	}
}


function shouldHandleEvents() {
	const holidaySpirit = parent?.S?.holidayseason && !character?.s?.holidayspirit;
	/* The gate is the boss policy now, not "is anything live". The old test
	   went through getDynamicEvents(), whose EVENT_LOCATIONS lists dragold,
	   mrgreen and mrpumpkin UNCONDITIONALLY - so the farm was dropped for any
	   of the three the moment it spawned, with no question of whether the party
	   could contribute, and nothing to bring it home. */
	return holidaySpirit || !!bossPick() || !!bossState.trip;
}

function handleEvents() {
	if (parent?.S?.holidayseason && !character?.s?.holidayspirit) {
		if (!smart.moving) {
			smart_move({ to: 'town' }, () => {
				parent.socket.emit('interaction', { type: 'newyear_tree' });
			});
		}
		return;
	}

	/* Everything below here used to be an independent decision per character:
	   the same "most damaged live event" scan ran in all three files, so two
	   live bosses could send the ranger to one and the priest to the other, and
	   crabxx was in the ranger's list alone - he joined it while the other two
	   kept farming, boss-side with no healer. bossTick owns the decision now,
	   the leader broadcasts it, and the gate decides whether it is worth taking
	   at all. -> BOSS EVENTS */
	bossTick().catch(e => bossLog('tick threw: ' + (e && e.message || e), 'red'));
}

/* DEAD as of this version - bossPosture() replaced the boss branch and the
   non-boss branch has no caller left, since only cooperative bosses and the
   holiday tree reach handleEvents() now. Kept for one version so a diff is
   readable; delete it next time this file is touched, in the same way
   Merchant.js retired heldScanMs. */
async function handleSpecificEvent(eventType, mapName, x, y) {
	if (!parent?.S?.[eventType]?.live) return;

	const monster = get_nearest_monster({ type: eventType });
	if (!monster) {
		smart_move({ x, y, map: mapName });
		return;
	}

	if (COMBAT_SETS.bosses.has(eventType)) {
		if (!is_in_range(monster) && !smart.moving) {
			const dx = monster.x - character.x;
			const dy = monster.y - character.y;
			const dist = Math.hypot(dx, dy);
			const targetDist = character.range * 0.8;
			await safeMove(
				character.x + dx * (1 - targetDist / dist),
				character.y + dy * (1 - targetDist / dist)
			);
		}
		return;
	}

	const halfway_x = character.x + (monster.x - character.x) / 2;
	const halfway_y = character.y + (monster.y - character.y) / 2;
	if (!is_in_range(monster, 'attack') && !smart.moving) {
		await safeMove(halfway_x, halfway_y);
	}
}

/* ============================================================================
   GIGA CRAB CONTRIBUTION LOG

   Persisted with set()/get(), so it lives in CODE storage and survives the page
   reload that change_server performs on every shard hop - the same property the
   chest map needed and did not have until v54. Nothing here is in memory only.

   Query it any day with crabxxReport() in the console, or the GigaCrab top
   button while the event is live. The point is to answer, from real data rather
   than estimate, whether it is worth generalising the dragold cross-shard
   hunter to this boss: at ~491 effective DPS into 960,000 HP behind armor 320
   and phresistance 30, the open question is how much damage he actually lands
   before other players finish it.
   ============================================================================ */
const CRABXX_KEY = 'crabxx_contrib';

function crabxxLoad() {
	try { const d = get(CRABXX_KEY); return (d && typeof d === 'object' && Array.isArray(d.runs)) ? d : { runs: [] }; }
	catch (e) { return { runs: [] }; }
}
function crabxxSave(v) {
	try { set(CRABXX_KEY, v); } catch (e) { console.error('crabxx log save failed:', e); }
}
function crabxxShard() {
	try { return String(parent.server_region || '?') + String(parent.server_identifier || '?'); }
	catch (e) { return '?'; }
}
/* One run per shard per day: a daily event, and a hop to another shard is a
   genuinely separate contribution worth accounting separately. */
function crabxxRunId() {
	return crabxxShard() + ':' + new Date().toISOString().slice(0, 10);
}

let crabxxPendingDmg = 0, crabxxPendingHits = 0, crabxxLastFlush = 0, crabxxHooked = false, crabxxWasRip = false;

/* Damage is read from the game's own hit events rather than inferred from our
   attack calls - only hits that actually landed count, and only ours. */
function crabxxHook() {
	if (crabxxHooked || !parent?.socket) return;
	crabxxHooked = true;
	parent.socket.on('hit', (d) => {
		try {
			if (!d || d.hid !== character.id || !d.damage) return;
			const t = parent.entities?.[d.id];
			if (!t || t.mtype !== 'crabxx') return;
			crabxxPendingDmg += d.damage;
			crabxxPendingHits++;
		} catch (e) { }
	});
}

function crabxxFlush(force) {
	const now = Date.now();
	// Batched: one write per 10s, never one per hit. A per-hit write would
	// rewrite the whole log every time, which is the O(n^2) trap v54 removed
	// from the chest map.
	if (!force && (now - crabxxLastFlush < 10000 || !crabxxPendingDmg)) return;
	crabxxLastFlush = now;
	if (!crabxxPendingDmg && !crabxxPendingHits && !force) return;
	const s = parent?.S?.crabxx;
	const log = crabxxLoad();
	const id = crabxxRunId();
	let run = log.runs.find(r => r.id === id);
	if (!run) {
		run = { id, shard: crabxxShard(), startedAt: new Date(now).toISOString(),
			damage: 0, hits: 0, deaths: 0, hpAtJoin: s?.hp ?? null, maxHp: s?.max_hp ?? null };
		log.runs.push(run);
		while (log.runs.length > 60) log.runs.shift();
	}
	run.damage += crabxxPendingDmg;
	run.hits += crabxxPendingHits;
	run.endedAt = new Date(now).toISOString();
	if (s) { run.hpLast = s.hp; run.maxHp = s.max_hp; run.liveLast = !!s.live; }
	crabxxPendingDmg = 0; crabxxPendingHits = 0;
	crabxxSave(log);
}

function crabxxTick() {
	try {
		crabxxHook();
		const live = parent?.S?.crabxx?.live === true;
		// Deaths are worth knowing: they are the cost side of showing up.
		if (live) {
			if (character.rip && !crabxxWasRip) {
				crabxxWasRip = true;
				const log = crabxxLoad();
				const run = log.runs.find(r => r.id === crabxxRunId());
				if (run) { run.deaths = (run.deaths || 0) + 1; crabxxSave(log); }
			} else if (!character.rip) {
				crabxxWasRip = false;
			}
		}
		crabxxFlush(!live && (crabxxPendingDmg > 0 || crabxxPendingHits > 0));
	} catch (e) { }
}
setInterval(crabxxTick, 5000);

/* Console-friendly summary. Safe to call any day - it reads the persisted log,
   not live state, so a hop or a reload loses nothing. */
function crabxxReport() {
	const log = crabxxLoad();
	if (!log.runs.length) { game_log('crabxx: no runs recorded yet', '#8b98ab'); return { runs: [] }; }
	let dmg = 0, hits = 0, deaths = 0;
	for (const r of log.runs) { dmg += r.damage || 0; hits += r.hits || 0; deaths += r.deaths || 0; }
	const out = {
		runs: log.runs.length, totalDamage: dmg, totalHits: hits, totalDeaths: deaths,
		avgDamagePerRun: Math.round(dmg / log.runs.length),
		shareOfOneBoss: Math.round((dmg / 960000) * 1000) / 10 + '% of a 960,000 HP Giga Crab',
		detail: log.runs.slice(-10)
	};
	console.log('crabxx contribution', out);
	game_log(`crabxx: ${log.runs.length} run(s), ${dmg.toLocaleString()} damage, ${deaths} death(s)`, '#FFD700');
	return out;
}

const dragold = {
	state: 'IDLE',
	targetShard: null,
	scanResults: [],
	hopping: false,

	startScanning() {
		if (!CONFIG.dragold.enabled) return;
		if (typeof parent.io !== 'function') {
			game_log('Cross-server dragold scanning unavailable here - will still fight dragold locally if it spawns', 'orange');
			return;
		}
		const servers = parent?.X?.servers;
		if (!servers) return;

		for (const server of servers) {
			if (server.name === 'PVP') continue;
			const shard = server.region + server.name;
			const socket = parent.io(`https://${server.address}`, { path: server.path + 'socket.io', transports: ['websocket'] });
			socket.on('server_info', (data) => {
				if (!data?.dragold) return;
				const spawnTime = new Date(data.dragold.spawn).getTime();
				const idx = this.scanResults.findIndex(r => r.shard === shard);
				const entry = { shard, live: data.dragold.live, spawnTime };
				if (idx >= 0) this.scanResults[idx] = entry;
				else this.scanResults.push(entry);
			});
		}
	},

	currentShard() {
		return parent.server_region + parent.server_identifier;
	},

	localDragoldLive() {
		return parent?.S?.dragold?.live === true;
	},

	pickTargetShard() {
		const now = Date.now();
		const cur = this.currentShard();
		let best = null;

		for (const r of this.scanResults) {
			if (r.shard === cur) continue;

			if (r.live) {
				best = r;
				break;
			}

			const untilSpawn = r.spawnTime - now;
			if (untilSpawn > 0 && untilSpawn <= CONFIG.dragold.preSpawnBuffer) {
				if (!best || r.spawnTime < best.spawnTime) best = r;
			}
		}

		return best?.shard ?? null;
	},

	async lootBeforeHop() {
		const chests = Object.keys(get_chests());
		if (chests.length === 0) return false;

		for (const id of chests) {
			try { await loot(id); } catch (e) { }
		}
		return true;
	},

	parseShard(shard) {
		for (const region of REGIONS) {
			if (shard.startsWith(region)) return { region, name: shard.slice(region.length) };
		}
		return null;
	},

	async changeServer(shard) {
		const parsed = this.parseShard(shard);
		if (!parsed) {
			game_log(`dragold: can't parse shard "${shard}"`, 'red');
			return false;
		}
		game_log(`🐉 Hopping to ${shard} for dragold`, '#FFD700');
		this.hopping = true;
		try {
			change_server(parsed.region, parsed.name);
			plSend(['FatherToken', 'MageofOz'], {
				message: 'dragold_hop',
				region: parsed.region,
				name: parsed.name
			});
			this.hopping = false;
			return true;
		} catch (e) {
			game_log(`dragold: server change failed — ${e}`, 'red');
			this.hopping = false;
			return false;
		}
	},

	async tick() {
		if (!CONFIG.dragold.enabled) return 'continue';
		if (this.hopping) return 'block';

		const cur = this.currentShard();

		switch (this.state) {
			case 'IDLE': {
				if (this.localDragoldLive()) {
					this.state = 'FIGHTING';
					this.targetShard = cur;
					game_log('🐉 Dragold live here — entering FIGHTING', '#FFD700');
					return 'continue';
				}

				const target = this.pickTargetShard();
				if (target) {
					this.state = 'HOPPING';
					this.targetShard = target;
				} else {
					return 'continue';
				}
			}

			case 'HOPPING': {
				if (cur === this.targetShard) {
					if (this.localDragoldLive()) {
						this.state = 'FIGHTING';
						game_log('🐉 Arrived — dragold is live, FIGHTING', '#FFD700');
						return 'continue';
					}
					game_log('🐉 Arrived but dragold not live here — back to IDLE', '#FFD700');
					this.state = 'IDLE';
					this.targetShard = null;
					return 'continue';
				}

				if (await this.lootBeforeHop()) return 'block';

				await this.changeServer(this.targetShard);
				return 'block';
			}

			case 'FIGHTING': {
				if (this.localDragoldLive()) {
					return 'continue';
				}
				game_log('🐉 Dragold dead — RETURNING home', '#FFD700');
				this.state = 'RETURNING';
				this.targetShard = null;
			}

			case 'RETURNING': {
				const liveShard = this.scanResults.find(
					r => r.shard !== cur && r.live
				)?.shard;

				if (liveShard) {
					this.state = 'HOPPING';
					this.targetShard = liveShard;
					game_log(`🐉 New live dragold on ${liveShard} — diverting`, '#FFD700');
					return 'block';
				}

				if (cur === homeServer) {
					this.state = 'IDLE';
					this.targetShard = null;
					return 'continue';
				}

				if (await this.lootBeforeHop()) return 'block';

				await this.changeServer(homeServer);
				return 'block';
			}

			default:
				this.state = 'IDLE';
				return 'continue';
		}
	}
};

// ============================================================================
// TRAVEL HELPER - a smart_move that reports its own failures
// ============================================================================
// Ported from Merchant.js travelTo(). Two jobs.
//
// 1. SURFACE THE FAILURE. handleReturnHome() used to call smart_move() with no
//    await and no .catch(). A rejection became an unhandled promise rejection
//    and vanished, smart.moving went false, and the next tick re-issued it -
//    a silent hot loop indistinguishable, from outside, from walking there
//    slowly. Now every attempt ends in a verdict: arrived, or failed with a
//    reason and a distance.
//
// 2. FALL BACK THROUGH town(). A seasonal or event map can lose its route out
//    once the event ends. town() gets us somewhere routable, and the real
//    route is tried again from there.
//
// WHY A COUNTER AND NOT A CLOCK. The unreachable verdict used to fire on
// wall-clock since the spot was assigned, measured in a loop that has nothing
// to do with travel - so a shard hop, a live event, a potion run or a trip to
// the vendor blacklisted the spot merely for taking three minutes, while
// travel was often never attempted at all. That is what walked the auto-
// blacklist down the whole candidate list at 180-second intervals. Counting
// failed ATTEMPTS judges a spot only on something it is responsible for.
//
// WHY THE IN-FLIGHT GUARD. The tick loops are synchronous and this is not;
// without it each tick would stack another attempt on the last. Same shape as
// the sell-off stand-down.
//
// WHY THE WATCHDOG. An in-flight guard is itself a new way to hang: if
// smart_move never settles, inFlight stays true, no attempt ever completes,
// and nothing is ever judged. The watchdog orphans an attempt that outlives
// attemptTimeoutMs - bumping attemptId makes the orphan's late resolution a
// no-op - and counts it as the failure it is.
// ============================================================================
const TRAVEL = {
	maxAttempts: 3,                  // failed attempts before the spot is judged unreachable
	attemptTimeoutMs: 3 * 60 * 1000, // an attempt that outlives this never settled
	// How close counts as arrived. -> travelAtDestination
	arrivalRadius: 200,
};

const travelState = {
	inFlight: false,
	attemptId: 0,
	startedAt: 0,
	failures: 0,         // consecutive failures against `target`
	lastError: null,
	lastDistance: null,  // readable: how far off we were when it failed
	target: null,
};

function travelKey(dest) {
	return dest ? `${dest.map}|${Math.round(dest.x)}|${Math.round(dest.y)}` : null;
}

function travelWhy(e) {
	return (e && (e.reason || e.message)) || String(e);
}

/* Where we ended up relative to the target, for the blacklist entry. Across
   maps an x/y distance is meaningless, so say that instead of printing a
   number that reads like one. */
function travelDistanceNote(dest) {
	if (!dest) return 'no destination';
	if (character.map !== dest.map) return `stuck on ${character.map}, target is on ${dest.map}`;
	return `${Math.round(distance(character, dest))} units short on ${dest.map}`;
}

/* ARRIVAL IS A RANGE, NOT A PROMISE THAT smart_move RESOLVED. The old test was
   purely "did smart_move settle without throwing", and kiting breaks that: a
   kite step is an ordinary move command, it PREEMPTS the pathfinder, smart_move
   rejects, and noteTravelFailure counts a failure against a spot we are standing
   on and fighting the intended monster at. Three of those and the spot is
   reported unreachable. Kite steps are moveDistance 50 / disengageDistance 70,
   so a few of them compound to well inside this radius while the fight is ON the
   destination. 200 sits clear of that and of the cohesion leash (150), and well
   under the handoff (400) so it cannot mask a route that left us hundreds short -
   travelDistanceNote still logs "N units short", so the figure is checkable. */
function travelAtDestination(dest) {
	if (!dest) return false;
	if (character.map !== dest.map) return false;
	return distance(character, dest) <= (TRAVEL.arrivalRadius || 200);
}

/* Failures count against ONE destination. A new spot starts at zero - without
   this, a spot inherits the previous spot's strikes and is condemned before it
   has been tried even once. */
function noteTravelTarget(dest) {
	const key = travelKey(dest);
	if (key === travelState.target) return;
	travelState.target = key;
	travelState.failures = 0;
	travelState.lastError = null;
	travelState.lastDistance = null;
}

function travelArrived() {
	travelState.failures = 0;
	travelState.lastError = null;
	travelState.lastDistance = null;
}

/* `note` is how close we got BEFORE town() moved us. Pass it whenever it is
   known: "142 units short" is the diagnostic that distinguishes a pathing
   problem at the target from a spot he never got near, and reading the
   position after the town() fallback would report where town is instead. */
function noteTravelFailure(dest, why, note) {
	/* Standing on it is not failing to reach it. -> travelAtDestination */
	if (travelAtDestination(dest)) {
		travelArrived();
		game_log(`Travel reported "${why}" but we are at ${dest.map} within ${TRAVEL.arrivalRadius || 200}u - counting it as arrived`, '#7FD98A');
		return;
	}
	travelState.failures++;
	travelState.lastError = why;
	travelState.lastDistance = note || travelDistanceNote(dest);
	game_log(`Travel attempt ${travelState.failures}/${TRAVEL.maxAttempts} failed: ${why} (${travelState.lastDistance})`, 'orange');
}

/* One sentence for a log line or a blacklist entry. */
function travelFailureDetail() {
	return `${travelState.failures} failed travel attempts; last error: ${travelState.lastError}; ${travelState.lastDistance}`;
}

async function travelTo(dest) {
	if (!dest || travelState.inFlight) return false;
	noteTravelTarget(dest);

	const myAttempt = ++travelState.attemptId;
	const mine = () => travelState.attemptId === myAttempt;
	travelState.inFlight = true;
	travelState.startedAt = Date.now();

	let closest = null;   // how near we got before town() relocated us
	try {
		try {
			await safeSmartMove(dest);
			if (mine()) travelArrived();
			return true;
		} catch (e) {
			if (!mine()) return false;   // the watchdog already gave up on this attempt
			travelState.lastError = travelWhy(e);
			closest = travelDistanceNote(dest);
		}

		// town() only reaches the CURRENT map's town point, so it is a way out
		// of a dead end rather than a way to the target - the real route still
		// has to be tried again afterwards.
		try {
			await town();
		} catch (e) {
			if (mine()) noteTravelFailure(dest, `no route (${travelState.lastError}) and town() failed too (${travelWhy(e)})`, closest);
			return false;
		}
		if (!mine()) return false;

		try {
			await safeSmartMove(dest);
			if (mine()) travelArrived();
			return true;
		} catch (e) {
			if (mine()) noteTravelFailure(dest, `still no route after town(): ${travelWhy(e)}`, closest);
			return false;
		}
	} finally {
		if (mine()) travelState.inFlight = false;
	}
}

function travelWatchdog(dest) {
	if (!travelState.inFlight) return;
	if (Date.now() - travelState.startedAt < TRAVEL.attemptTimeoutMs) return;
	travelState.attemptId++;        // orphan it: the late resolution becomes a no-op
	travelState.inFlight = false;
	noteTravelFailure(dest, `smart_move never returned after ${Math.round(TRAVEL.attemptTimeoutMs / 1000)}s`);
}

function handleReturnHome() {
	if (!destination) return;
	noteTravelTarget(destination);
	// Only compare positions on the same map - an x/y distance across maps is
	// meaningless, and a coincidental match would park us on the wrong map.
	if (character.map === destination.map && distance(character, destination) < 20) return;
	if (smart.moving || travelState.inFlight) return;
	travelTo(destination);   // handles its own failures; nothing here can reject
}

async function walkInCircle() {
	if (smart.moving || !destination) return;
	const center = destination, r = CONFIG.movement.circleRadius, now = performance.now();
	const dt = Math.min((now - state.lastAngleUpdate) / 1000, 0.5);
	state.lastAngleUpdate = now;
	state.angle = (state.angle + (character.speed / r) * dt) % (2 * Math.PI);
	if (!character.moving) await safeMove(center.x + Math.cos(state.angle) * r, center.y + Math.sin(state.angle) * r);
}

/* ---------------------------------------------------------------------------
   KITE TARGET SELECTION - identical shape in Ranger.js / Priest.js / Mage.js.

   Two independent paths into "should this be kited", deliberately separate:

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
   --------------------------------------------------------------------------- */
function kiteThreatRadius(mdef) {
	if (!mdef) return 0;
	let r = mdef.range || 0;
	const ab = mdef.abilities;
	if (ab) {
		for (const k in ab) {
			const a = ab[k];
			if (a && a.aura && typeof a.radius === 'number' && a.radius > r) r = a.radius;
		}
	}
	return r;
}

function kiteCandidateTypes(cfg) {
	const out = new Set(cfg.targets || cfg.avoidTypes || []);
	if (!cfg.autoBySpeed) return [...out];
	const G = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	if (!G || !G.monsters || typeof parent === 'undefined' || !parent.entities) return [...out];
	const mySpeed = character.speed || 0;
	const reach = (character.range || 0) - (cfg.attackMargin || 0);
	const ratio = cfg.speedRatio || 1.3;
	const buffer = cfg.rangeBuffer || 0;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (out.has(e.mtype)) continue;
		const mdef = G.monsters[e.mtype];
		if (!mdef) continue;
		if (mySpeed <= (mdef.speed || 0) * ratio) continue;
		if (kiteThreatRadius(mdef) + buffer > reach) continue;
		out.add(e.mtype);
	}
	return [...out];
}

function kiteBand(mtype, cfg) {
	const reposition = cfg.repositionThreshold || 20;
	const ov = (cfg.overrides || {})[mtype];
	if (ov) {
		const minD = ov.minDistance, optD = ov.optimalDistance;
		return { minD, optD, maxD: ov.maxDistance != null ? ov.maxDistance : Math.max(optD + reposition, minD + 10) };
	}
	const G = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	const minD = kiteThreatRadius((G && G.monsters) ? G.monsters[mtype] : null) + (cfg.rangeBuffer || 0);
	const maxD = Math.max(minD + 10, (character.range || 0) - 5);
	return { minD, optD: Math.max(minD + 5, maxD - reposition), maxD };
}

/* ---------------------------------------------------------------------------
   THREAT FIELD - added v59/v32/v55, after measurement.

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
   --------------------------------------------------------------------------- */

/* Every monster within reach that matters, with its own danger radius. */
function kiteThreats(cfg, types) {
	const set = (types && types.length) ? new Set(types) : null;
	const cx = character.real_x, cy = character.real_y;
	const buffer = cfg.rangeBuffer || 0;
	const reach = cfg.avoidRadius || cfg.maxKiteRange || 400;
	const G = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	const out = [];
	if (!G || !G.monsters || !parent.entities) return out;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (set && !set.has(e.mtype)) continue;
		const ex = (e.real_x != null ? e.real_x : e.x) || 0;
		const ey = (e.real_y != null ? e.real_y : e.y) || 0;
		const d = Math.hypot(ex - cx, ey - cy);
		if (d > reach) continue;
		const r = kiteThreatRadius(G.monsters[e.mtype]) + buffer;
		out.push({ x: ex, y: ey, r: r, d: d, danger: d < r, mtype: e.mtype });
	}
	return out;
}

/* How many monsters are targeting us. Compared against character.courage, which
   is the count tolerated before fear starts and actions stop. */
function kiteAttackerCount() {
	let n = 0;
	if (typeof parent === 'undefined' || !parent.entities) return n;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e && e.type === 'monster' && !e.dead && e.target === character.id) n++;
	}
	return n;
}

/* Signed, urgency-weighted distance gained across the whole threat field.

   Two deliberate differences from the gain-only version in Priest.js: a
   candidate that escapes one monster and walks into another is PENALISED rather
   than merely un-rewarded, and threats we are already deep inside weigh more
   than ones at the edge of their radius. Without the sign, "away from the
   nearest" and "into the other ten" score the same, which is the bug. */
function kiteMultiWeight(threats, px, py) {
	let w = 0;
	for (const t of threats) {
		if (!t.danger) continue;
		const dp = Math.hypot(px - t.x, py - t.y);
		const urgency = Math.max(1, t.r - t.d);
		w += (dp - t.d) * urgency;
	}
	return w;
}

/* Direction that points away from the whole field, for the ladder's base angle.
   Sum of unit vectors away from each threat in danger range; null when nothing
   is pressing, in which case the caller falls back to away-from-target. */
function kiteRepulsionAngle(threats) {
	const cx = character.real_x, cy = character.real_y;
	let vx = 0, vy = 0, any = false;
	for (const t of threats) {
		if (!t.danger) continue;
		const dx = cx - t.x, dy = cy - t.y;
		const m = Math.hypot(dx, dy) || 1;
		vx += dx / m; vy += dy / m; any = true;
	}
	if (!any || (vx === 0 && vy === 0)) return null;
	return Math.atan2(vy, vx);
}

/* Last-resort escape: escalating angles, then shorter steps.

   Borrowed in shape from the older Party.js handleKiting, which tried a fixed
   ladder first-fit and so always produced SOME move, where the scored sampler
   could find nothing and stand still. Two corrections to that original: it
   stopped at +-PI, i.e. straight into what it was fleeing, so this stops at
   +-120 degrees; and it never retried a shorter step, so a wall 30 units out
   blocked every candidate when 10 units of room existed. */
const KITE_LADDER = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3,
                     Math.PI / 2, -Math.PI / 2, 2 * Math.PI / 3, -2 * Math.PI / 3];
const KITE_STEP_FRACTIONS = [1, 0.5, 0.25];

function kiteLadderEscape(baseAngle, mag) {
	if (baseAngle == null) return null;
	const cx = character.real_x, cy = character.real_y;
	for (const frac of KITE_STEP_FRACTIONS) {
		const m = Math.max(6, mag * frac);
		for (const off of KITE_LADDER) {
			const a = baseAngle + off;
			const tx = cx + Math.cos(a) * m, ty = cy + Math.sin(a) * m;
			if (can_move_to(tx, ty)) return { x: tx, y: ty, mag: m, off: off };
		}
	}
	return null;
}

/* Distance from a threat to the straight-line move we are considering, not just
   to its endpoint. Added after the v59 harness caught endpoint-only scoring
   choosing a route THROUGH a monster: from inside a pack, the candidate 30 units
   past a mob sitting 10 units away scores as "10 units gained" while the path
   walks over it. Priest.js has tangent cones for this; Ranger and Mage had
   nothing at all. */
function kiteSegDist(px, py, qx, qy, tx, ty) {
	const dx = qx - px, dy = qy - py;
	const L2 = dx * dx + dy * dy;
	let u = L2 ? ((tx - px) * dx + (ty - py) * dy) / L2 : 0;
	u = u < 0 ? 0 : (u > 1 ? 1 : u);
	return Math.hypot(tx - (px + u * dx), ty - (py + u * dy));
}

/* Veto a candidate whose route closes on any threat more than we already are.
   Retreating keeps our current distance as the closest approach, so it passes;
   crossing a mob, or fleeing one monster into another, does not. */
function kitePathBlocked(threats, px, py) {
	const cx = character.real_x, cy = character.real_y;
	for (const t of threats) {
		const dmin = kiteSegDist(cx, cy, px, py, t.x, t.y);
		if (dmin < Math.min(t.d, t.r) * 0.9) return true;
	}
	return false;
}

/* ---------------------------------------------------------------------------
   COHESION, FOCUS FIRE AND THE ROUTE PENALTY - v60/v33/v56.

   The v59 measurement said the kiting work was treating a symptom. Two findings
   from the same window settled it:

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
   --------------------------------------------------------------------------- */

/* Route incursion as a PENALTY rather than a veto.

   v59 vetoed any candidate whose path closed on a threat. Measured offline
   against the real geometry: with 4 cgoo at 20 units, 180 of 180 candidates
   passable and ZERO survived the veto; with 11 scattered at 25-70 units, again
   zero. So in the only situation that actually kills - being inside the pack -
   the whole-field scorer never ran, and every decision fell through to the
   crude ladder. A penalty keeps the ranking intact so the scorer can still pick
   the least-bad route when no clean one exists. */
function kitePathPenalty(threats, px, py) {
	const cx = character.real_x, cy = character.real_y;
	let pen = 0;
	for (const t of threats) {
		const dmin = kiteSegDist(cx, cy, px, py, t.x, t.y);
		const floor = Math.min(t.d, t.r) * 0.9;
		if (dmin < floor) pen += (floor - dmin) * Math.max(1, t.r - t.d) * 3;
	}
	return pen;
}

/* The leader's current target, when we are a follower and it is worth sharing.
   Returns null for the leader itself, so this is safe to call anywhere. */
function focusFireTarget() {
	const cfg = (CONFIG.combat && CONFIG.combat.focusFire) || {};
	if (cfg.enabled === false) return null;
	const group = (CONFIG.party && CONFIG.party.groupMembers) || [];
	const leaderName = group[0];
	if (!leaderName || leaderName === character.name) return null;
	if (typeof parent === 'undefined' || !parent.entities) return null;
	const leader = parent.entities[leaderName];
	if (!leader || !leader.target) return null;
	const t = parent.entities[leader.target];
	if (!t || t.type !== 'monster' || t.dead) return null;
	if (cfg.requireInRange !== false && !is_in_range(t)) return null;
	return t;
}

/* Close on the party when we drift out of heal range.

   Moves toward the CENTROID of the other members rather than at the leader, so
   the priest settles between the two he has to reach instead of hugging one and
   losing the other. Leader-exempt: Dexon drives the farm spot, and a leader that
   chases his own followers never arrives anywhere. */
async function holdCohesion() {
	const cfg = (CONFIG.party && CONFIG.party.cohesion) || {};
	if (!cfg.enabled) return false;
	const group = (CONFIG.party.groupMembers || []);
	if (group[0] === character.name) return false;
	if (typeof parent === 'undefined' || !parent.entities) return false;

	let fx = 0, fy = 0, n = 0, worst = 0;
	for (const nm of group) {
		if (nm === character.name) continue;
		const e = parent.entities[nm];
		if (!e || e.rip) continue;
		const ex = (e.real_x != null ? e.real_x : e.x) || 0;
		const ey = (e.real_y != null ? e.real_y : e.y) || 0;
		const d = Math.hypot(ex - character.real_x, ey - character.real_y);
		if (d > worst) worst = d;
		fx += ex; fy += ey; n++;
	}
	if (!n || worst <= (cfg.leash || 150)) return false;

	fx /= n; fy /= n;
	const a = Math.atan2(fy - character.real_y, fx - character.real_x);
	const gap = Math.hypot(fx - character.real_x, fy - character.real_y);
	const step = Math.max(20, Math.min(cfg.stepMax || 120, gap - (cfg.leash || 150) * 0.5));
	await safeMove(character.real_x + Math.cos(a) * step, character.real_y + Math.sin(a) * step);
	if (cfg.debug) game_log('Cohesion: closing ' + Math.round(worst) + 'u to party', '#7FD1FF');
	return true;
}

async function rangedKite() {
	const cfg = CONFIG.movement.rangedKiting;
	if (!cfg.enabled) return false;
	const types = kiteCandidateTypes(cfg);
	if (!types.length) return false;

	const threats = kiteThreats(cfg, types);
	const attackers = kiteAttackerCount();
	const courage = character.courage || 2;
	const disengage = cfg.disengageOnCourage !== false && attackers >= courage;

	/* smart_move used to veto kiting outright, so a character pathing anywhere
	   could not defend itself at all. It still yields during ordinary travel,
	   but a crowd at or over courage cancels the path rather than being ignored. */
	if (smart.moving) {
		if (!disengage) return false;
		try { if (typeof stop === 'function') stop(); } catch (e) {}
	}

	const target = get_nearest_monster_v2({ type: types, max_distance: cfg.maxKiteRange });
	if (!target && !disengage) return false;

	/* Band is per-target now. The old code read cfg.maxDistance, which was null,
	   so `dist > cfg.maxDistance` coerced to `dist > 0` and reason 2 fired on
	   every tick reason 1 did not - which made repositionThreshold unreachable
	   dead config and made the `nd > maxDistance` penalty below a no-op that
	   scored every candidate -1000 alike. Both work as designed now. */
	const cx = character.real_x, cy = character.real_y;
	const band = target ? kiteBand(target.mtype, cfg) : null;
	const dist = target ? Math.hypot(target.real_x - cx, target.real_y - cy) : 0;

	/* reason 4 is disengage - the band is abandoned, not adjusted. */
	let reason = 0, need = 0;
	if (disengage) { reason = 4; need = cfg.disengageDistance || cfg.moveDistance; }
	else if (dist < band.minD) { reason = 1; need = band.optD - dist; }
	else if (dist > band.maxD) { reason = 2; need = dist - band.optD; }
	else if (Math.abs(dist - band.optD) > cfg.repositionThreshold) { reason = 3; need = Math.abs(dist - band.optD); }
	if (!reason) return true;

	const now = performance.now();
	if (now - rangedKite.lastMove <= cfg.moveThrottle) return true;

	/* Direction from the whole field when retreating or disengaging; from the
	   governing target when closing or recentring, which measured correct. */
	const multi = (reason === 1 || reason === 4);
	const baseMag = Math.max(6, Math.min(cfg.moveDistance, Math.abs(need)));
	const step = Math.PI / cfg.sampleAngles, n = cfg.sampleAngles * 2;
	let bestW = -Infinity, bestX = 0, bestY = 0, found = false;
	for (const frac of KITE_STEP_FRACTIONS) {
		const mag = Math.max(6, baseMag * frac);
		for (let i = 0, a = 0; i < n; i++, a += step) {
			const tx = cx + mag * Math.cos(a), ty = cy + mag * Math.sin(a);
			if (!can_move_to(tx, ty)) continue;
			/* Route cost, not a veto - kitePathBlocked eliminated every candidate
			   whenever we were inside the pack, which is the only case that kills. */
			let w;
			if (multi) w = kiteMultiWeight(threats, tx, ty) - kitePathPenalty(threats, tx, ty);
			else {
				const nd = Math.hypot(target.real_x - tx, target.real_y - ty);
				w = reason === 2 ? dist - nd : Math.abs(dist - band.optD) - Math.abs(nd - band.optD);
				if (nd < band.minD || nd > band.maxD) w -= 1000;
			}
			if (w > bestW) { bestW = w; bestX = tx; bestY = ty; found = true; }
		}
		if (found) break;
	}

	const awayAngle = (function () {
		const r = kiteRepulsionAngle(threats);
		if (r != null) return r;
		return target ? Math.atan2(cy - target.real_y, cx - target.real_x) : null;
	})();

	if (!found) {
		const esc = kiteLadderEscape(awayAngle, baseMag);
		if (esc) { bestX = esc.x; bestY = esc.y; found = true; }
	}

	if (!found) {
		/* Pathfinder last resort. xmove falls back to smart_move when the straight
		   line is blocked, and the scored pass never reaches it because every
		   candidate is pre-filtered through can_move_to. smart_move routes around
		   walls but is blind to monsters, so this is gated on an uncrowded field -
		   a path through the pack is worse than standing still. */
		if (attackers < courage && awayAngle != null) {
			const far = Math.max(cfg.moveDistance, 60);
			await safeMove(cx + Math.cos(awayAngle) * far, cy + Math.sin(awayAngle) * far);
			rangedKite.lastMove = now;
			if (cfg.debug) game_log('Kiting: pathfinder fallback', '#FFA500');
			return true;
		}
		/* Say so rather than claiming the tick - the call site can walkInCircle. */
		return false;
	}

	await safeMove(bestX, bestY);
	rangedKite.lastMove = now;
	if (cfg.debug) game_log(`Kiting ${target ? target.mtype : 'field'}: r${reason} att${attackers} (${Math.round(dist)} → ${Math.round(Math.hypot(target.real_x - bestX, target.real_y - bestY))})`, '#FFA500');
	return true;
}
rangedKite.lastMove = 0;

function getTemporalRotation() {
	const stored = get(CONFIG.equipment.temporal.storageKey);
	if (!stored) {
		const initial = {
			lastUser: null,
			nextIndex: 0,
			lastKillTime: 0
		};
		set(CONFIG.equipment.temporal.storageKey, initial);
		return initial;
	}
	return stored;
}

function updateTemporalRotation() {
	const rotation = getTemporalRotation();
	rotation.lastUser = character.name;
	rotation.nextIndex = (rotation.nextIndex + 1) % CONFIG.equipment.temporal.characters.length;
	rotation.lastKillTime = Date.now();
	set(CONFIG.equipment.temporal.storageKey, rotation);
}

function isMyTurnForTemporal() {
	const rotation = getTemporalRotation();
	const myIndex = CONFIG.equipment.temporal.characters.indexOf(character.name);

	if (myIndex === -1) return false;

	return rotation.lastUser === null || rotation.nextIndex === myIndex;
}

async function handleTemporalSurge() {
	if (!CONFIG.equipment.temporal.enabled) return;
	if (!isMyTurnForTemporal()) return;

	const orbSlot = character.items.findIndex(i => i?.name === 'orboftemporal');
	if (orbSlot === -1) {
		game_log(`Missing ${CONFIG.equipment.temporal.orbName}!`, 'red');
		return;
	}

	try {
		equip(orbSlot, 'orb');
		use_skill(CONFIG.equipment.temporal.skillName);
		game_log(`⏰ Temporal Surge used on ${CONFIG.equipment.temporal.targetMob}!`, '#00FFFF');
		updateTemporalRotation();
		equip(orbSlot, 'orb');
	} catch (e) {
		game_log(`Temporal surge failed: ${e}`, 'red');
		console.error('Temporal surge error:', e);
	}
}

const CHEST_STORAGE_KEY = 'loot_chest_ids';

function loadChestMap() {
	const data = get(CHEST_STORAGE_KEY);
	return typeof data === 'object' && data !== null ? data : {};
}

function saveChestMap(map) {
	set(CHEST_STORAGE_KEY, map);
}

function removeChestId(id) {
	const stored = loadChestMap();
	if (stored[id]) {
		delete stored[id];
		saveChestMap(stored);
	}
}

function updateChestsInStorage() {
	const stored = loadChestMap();
	const now = performance.now();
	for (const id of Object.keys(get_chests())) {
		if (!stored[id]) {
			stored[id] = now;
		}
	}
	saveChestMap(stored);
}

async function handleLooting() {
	if (!CONFIG.looting.enabled) return;

	const chestMap = loadChestMap();
	const ids = Object.keys(chestMap);
	if (!ids.length) return;

	// Date.now(), not performance.now() - see the version header. performance
	// .now() restarts at ~0 on every page load while this map survives in CODE
	// storage, so stored stamps came from a dead clock and the age test below
	// went negative forever.
	const now = Date.now();
	const cap = CONFIG.looting.maxPerPass || 25;
	const done = [];
	let looted = 0;

	for (const id of ids) {
		if (looted >= cap) break;
		const storedAt = chestMap[id];
		if (!storedAt) { done.push(id); continue; }
		const age = now - storedAt;
		// age < 0 means the stamp came from a different clock than ours - a
		// legacy performance.now() value, or a wall-clock jump. Never strand
		// it: loot it now rather than wait for a deadline that cannot arrive.
		if (age >= 0 && age < CONFIG.looting.delayMs) continue;
		// try INSIDE the loop. It used to wrap the whole pass, so one throw
		// killed every remaining chest and left the offender at the head of the
		// map - and the next pass aborted on the same id.
		try {
			await loot(id);
			looted++;
		} catch (e) {
			console.error('loot(' + id + ') failed, dropping:', e);
		}
		done.push(id);
	}

	// One write per pass. removeChestId() reloads and rewrites the whole map
	// per chest, which is O(n) each and O(n^2) over a backlog of thousands.
	if (done.length) {
		const stored = loadChestMap();
		for (const id of done) delete stored[id];
		saveChestMap(stored);
	}

	if (looted > 0) {
		console.log(`Looted ${looted} chest(s), ${ids.length - done.length} still queued`);
	}
}

function lootInterval() {
	updateChestsInStorage();
	handleLooting();
}
setInterval(lootInterval, 250);

const clearInventory = () => {
	const cfg = CONFIG.muling;
	const mule = get_player(cfg.muleName);
	if (!mule) return;

	if (character.gold > cfg.goldReserve) send_gold(mule, character.gold - cfg.goldReserve);

	character.items.forEach((item, i) => {
		if (item && !cfg.excludeItems.has(item.name) && !item.l && !item.s && is_in_range(mule, 'attack'))
			send_item(mule.id, i, item.q ?? 1);
	});
};

/* There was an inventorySorter() here until v57. It pinned seven item names to
   slots 0-6 every 2s, and because swap() is an exchange it evicted anything the
   operator dragged into one of those slots - measured reverting a hand move
   within 500ms. Slot order is arranged by hand now. Nothing reads a numeric
   index into character.items in this file. */

/* Can a message to the merchant actually arrive?

   Two channels with different reach. The bridge relay crosses shards, so if it
   is up the merchant hears us wherever it is. send_cm is realm-local, so it
   only works when the merchant is on this shard - and the one thing we can
   check for certain is whether it is visible to this client.

   Anything else is UNKNOWN, not "no". A merchant parked two maps away on this
   same shard is perfectly reachable by send_cm and invisible to get_player, so
   treating unknown as unreachable would suppress requests that would have
   worked. Callers decide what to do with unknown; for a request that is merely
   repeated too often, the cooldown already bounds the cost, so sending is the
   right answer. */
function merchantReach(name) {
	if (plUp) return { ok: true, how: 'bridge' };
	try { if (get_player(name)) return { ok: true, how: 'same shard, in view' }; } catch (e) { }
	return { ok: false, how: 'bridge down and not in view', unknown: true };
}

let potionAskAt = { hp: 0, mp: 0 };
let potionGateNote = null;

/* Ask the merchant for a resupply, at most once per cooldown. */
function askForPotions(kind, have) {
	const now = Date.now();
	if (now - (potionAskAt[kind] || 0) < CONFIG.potions.requestCooldownMs) return;
	const target = CONFIG.locationBroadcast.targetPlayer;
	const reach = merchantReach(target);
	// Unknown reachability still sends: see merchantReach. Only a confident
	// "no" would be worth suppressing, and we cannot have one.
	if (!reach.ok && !reach.unknown) {
		if (potionGateNote !== reach.how) {
			potionGateNote = reach.how;
			game_log(`[potions] holding requests: ${reach.how}`, '#8b98ab');
		}
		return;
	}
	potionGateNote = null;
	potionAskAt[kind] = now;
	plSend(target, {
		message: 'low_potions', potion: kind, quantity: have,
		x: character.x, y: character.y, map: character.map,
	});
}

function autoBuyPotions() {
	/* Only attempt the purchase where there is something to sell to us. This
	   runs on the 2s maintenance tick, and off-vendor it was emitting two
	   doomed buy calls every two seconds for as long as stock stayed low. */
	if (atPotionVendor()) {
		if (quantity('hpot1') < CONFIG.potions.minStock) buy('hpot1', CONFIG.potions.minStock);
		if (quantity('mpot1') < CONFIG.potions.minStock) buy('mpot1', CONFIG.potions.minStock);
	}

	const totalHp = quantity('hpot0') + quantity('hpot1');
	const totalMp = quantity('mpot0') + quantity('mpot1');
	if (totalHp < 500) askForPotions('hp', totalHp);
	if (totalMp < 500) askForPotions('mp', totalMp);
}

async function buyMissingPotions() {
	if (quantity('hpot0') + quantity('hpot1') < CONFIG.potions.minStock) {
		try { await buy('hpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy hpot1 failed:', e); }
	}
	if (quantity('mpot0') + quantity('mpot1') < CONFIG.potions.minStock) {
		try { await buy('mpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy mpot1 failed:', e); }
	}
}

/* ---- Emergency restock: the trip has to be a TRIP, not a teleport ---------

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
   vendor is resolved out of G.maps below instead, which cannot do that. */

// The two legacy starting maps still carry a `pots` NPC, and `test` is not a
// place to send a character. Kept out of the candidate list rather than
// trusted to be unroutable.
const RESTOCK_SKIP_MAPS = new Set(['old_main', 'original_main', 'test']);

// How near counts as standing at the vendor. This is NOT a measured server
// constant - no client function carries the npc interaction radius, so being
// wrong here can only cost a short walk, never a failed buy: the trip always
// smart_moves onto the NPC's own coordinates.
const RESTOCK_AT_VENDOR = 200;

let potionVendorCache = null;

/* Every (map, position) in the game where both potion kinds are sold, read
   from live G rather than listed, so a vendor added to a new map is picked up
   without a code change. Cached only once G has actually answered - a call
   before the data is up must not poison the cache with an empty list. */
function potionVendors() {
	if (potionVendorCache) return potionVendorCache;
	const found = [];
	try {
		const ids = [];
		for (const [id, npc] of Object.entries(G.npcs || {})) {
			const items = npc.items || [];
			if (items.includes('hpot1') && items.includes('mpot1')) ids.push(id);
		}
		if (!ids.length) return found;
		for (const [mapName, map] of Object.entries(G.maps || {})) {
			if (RESTOCK_SKIP_MAPS.has(mapName)) continue;
			for (const npc of (map.npcs || [])) {
				if (ids.indexOf(npc.id) === -1) continue;
				const p = npc.position || (npc.positions && npc.positions[0]);
				if (!p) continue;
				found.push({ map: mapName, x: p[0], y: p[1], id: npc.id });
			}
		}
	} catch (e) {
		return found;
	}
	if (found.length) potionVendorCache = found;
	return found;
}

/* Where to go and buy: this map if it has a vendor, otherwise main's. */
function potionVendor() {
	const all = potionVendors();
	if (!all.length) return null;
	return all.find((v) => v.map === character.map)
		|| all.find((v) => v.map === 'main')
		|| all[0];
}

function potionsOnHand() {
	return {
		hp: quantity('hpot0') + quantity('hpot1'),
		mp: quantity('mpot0') + quantity('mpot1'),
	};
}

/* True when buy() has someone to talk to from where we are standing. */
function atPotionVendor() {
	const v = potionVendor();
	if (!v || v.map !== character.map) return false;
	return distance(character, v) <= RESTOCK_AT_VENDOR;
}

let restockState = { failedAt: 0, failures: 0, note: null };

/* The trip. Detached from checkPotionEmergency on purpose - see there. */
async function restockTrip() {
	const want = potionVendor();
	try {
		if (!want) throw new Error('no potion vendor anywhere in G');

		/* A farm trip may be mid-flight. Orphan it the way travelWatchdog does,
		   so the smart_move this walk preempts rejects into a no-op instead of
		   counting a strike against a farm spot we never stopped wanting. */
		if (travelState.inFlight) {
			travelState.attemptId++;
			travelState.inFlight = false;
		}

		if (!atPotionVendor()) {
			game_log(`[potions] walking to ${want.id} on ${want.map} to restock`, '#FFD700');
			await noHang(smart_move({ map: want.map, x: want.x, y: want.y }),
				'restock walk', CONFIG.potions.restockTripMs);
		}
		if (!atPotionVendor()) {
			throw new Error(`stopped on ${character.map}, ${want.id} is on ${want.map}`);
		}

		await noHang(buyMissingPotions(), 'restock buy', CONFIG.potions.restockBuyMs);

		/* buy() is a socket call and a rejection is not the only way it fails,
		   so the test is the count afterwards, not whether anything threw.
		   Gold is in the message because broke and out-of-range read the same
		   from here otherwise. */
		const after = potionsOnHand();
		if (!after.hp || !after.mp) {
			throw new Error(`still out at ${want.id} - hp ${after.hp}, mp ${after.mp}, gold ${character.gold}`);
		}

		restockState.failures = 0;
		restockState.note = null;
		game_log(`Restocked at ${want.id} on ${want.map} - heading back to the farm spot`, '#00FF00');
	} catch (e) {
		restockState.failures++;
		restockState.failedAt = Date.now();
		restockState.note = null;
		game_log(`[potions] restock attempt ${restockState.failures} failed: ${describeError(e)}`, 'red');
		console.error('Emergency potion restock failed:', e);
	} finally {
		state.restocking = false;
	}
}

// Self-sufficiency fallback: don't just wait on the merchant forever if HP or
// MP potions hit zero outright - go buy more directly.
async function checkPotionEmergency() {
	if (!CONFIG.potions.autoBuy) return false;
	if (state.restocking) return true;   // the trip owns movement until it ends

	const have = potionsOnHand();
	if (have.hp > 0 && have.mp > 0) {
		// A delivery that arrived while we were holding off clears the backoff.
		restockState.failures = 0;
		restockState.note = null;
		return false;
	}

	/* A failed trip must not be retried on the next tick. That retry is what
	   turned "no vendor on this map" into town() being fired over and over:
	   fighting on empty is bad, teleport-spamming on empty is worse, and the
	   request to the merchant still goes out on the maintenance tick either
	   way. Returning false here keeps the rest of the loop running rather
	   than standing the character still with nothing on the way. */
	const since = Date.now() - restockState.failedAt;
	if (restockState.failures && since < CONFIG.potions.restockRetryMs) {
		if (restockState.note !== 'backoff') {
			restockState.note = 'backoff';
			game_log(`[potions] restock failed ${restockState.failures}x - holding ${Math.round((CONFIG.potions.restockRetryMs - since) / 1000)}s before the next trip`, 'orange');
		}
		return false;
	}

	state.restocking = true;
	game_log(`Out of ${have.hp === 0 ? 'HP' : 'MP'} potions - going to a vendor to restock`, 'red');
	/* DETACHED ON PURPOSE. The call site in mainLoop wraps this function in a
	   10s hang guard (HANG_GUARD.defaultMs), and a cross-map walk to main is
	   far longer than that - awaiting the trip here would fire the guard on
	   every healthy restock and bury the real failures in "did not settle".
	   Same shape as a Daisy trip instead: set the flag, let mainLoop stand
	   down on it, and bound the trip from the inside so the flag always
	   clears. restockTrip() catches everything, so nothing escapes here. */
	restockTrip();
	return true;
}

/* Operator handles. restockStatus() answers "where would he go, and is he
   holding off after a failure"; restockNow() drops the backoff so the next
   empty tick takes the trip immediately. */
function restockStatus() {
	const v = potionVendor();
	const have = potionsOnHand();
	const waitMs = restockState.failures
		? Math.max(0, CONFIG.potions.restockRetryMs - (Date.now() - restockState.failedAt))
		: 0;
	const out = {
		map: character.map,
		hp: have.hp,
		mp: have.mp,
		gold: character.gold,
		vendor: v ? `${v.id} on ${v.map} at ${v.x},${v.y}` : 'none found in G',
		atVendor: atPotionVendor(),
		restocking: !!state.restocking,
		failures: restockState.failures,
		holdingForSec: Math.round(waitMs / 1000),
	};
	game_log('[potions] ' + JSON.stringify(out), '#9FD3FF');
	return out;
}

function restockNow() {
	restockState.failures = 0;
	restockState.failedAt = 0;
	restockState.note = null;
	game_log('[potions] backoff cleared - the next empty tick will take the trip', '#FFD700');
	return restockStatus();
}

function elixirUsage() {
	const required = 'pumpkinspice';
	const currentElixir = character.slots.elixir?.name;

	if (currentElixir !== required) {
		const slot = locate_item(required);
		if (slot !== -1) use(slot);
	}
}

const targetStartTimes = new Map();

const scare = () => {
	const cfg = (CONFIG.combat && CONFIG.combat.scare) || {};
	if (cfg.enabled === false) return;
	const slot = character.items.findIndex(i => i?.name === 'jacko');
	const now = performance.now();
	const minHeld = cfg.minHeldMs != null ? cfg.minHeldMs : 250;
	let held = 0;

	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e.type === 'monster' && e.target === character.name && e.mtype !== 'grinch') {
			let t = targetStartTimes.get(id);
			if (t === undefined) targetStartTimes.set(id, t = now);
			if (now - t > minHeld) held++;
		} else if (targetStartTimes.has(id)) {
			targetStartTimes.delete(id);
		}
	}

	/* Count attackers, do not merely detect one. Courage is how many attackers
	   are tolerated before fear starts, and a feared character stops ACTING -
	   for the priest that means it stops healing, which is the measured
	   mechanism behind the 2026-09-26 cgoo wipe: FatherToken absorbed 190 of
	   the party's 294 hits and sat over courage for 49 of 239 one-second
	   samples, and all three characters died. Firing AT courage pre-empts the
	   third attacker. The old gate fired on the FIRST monster to hold aggro for
	   250ms, so the 5s cooldown was routinely already spent when it mattered. */
	const threshold = Math.max(1, (character.courage || 2) + (cfg.courageOffset || 0));
	const shouldScare = held >= threshold;

	if (shouldScare && !is_on_cooldown('scare') && slot !== -1) {
		equip(slot);
		use_skill('scare');
		equip(slot);
	}

	const paused = parent?.paused;
	if (character?.afk && !paused) { pause(); parent.no_graphics = true; }
	else if (!character?.afk && paused) { pause(); parent.no_graphics = false; }
};

function partyMaker() {
	if (!CONFIG.party.autoManage) return;

	const group = CONFIG.party.groupMembers;
	const leaderName = group[0];
	const party = get_party() || {};
	const partyLead = get_entity(leaderName);

	if (character.name === leaderName) {
		for (let i = 1; i < group.length; i++) {
			const name = group[i];
			if (name === character.name) continue;
			if (party[name]) continue;

			send_party_invite(name);
		}
	} else {
		if (!party[character.name] && partyLead) {
			send_party_request(leaderName);
		}
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function describeError(e) {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object') {
		if (e.message) return e.message;
		if (e.reason) return e.reason;
		try { return JSON.stringify(e); } catch { /* fall through */ }
	}
	return String(e);
}

function teamStarter() {
	if (!CONFIG.characterStarter.enabled) return;

	const activeCharacters = get_active_characters();

	for (const [key, char] of Object.entries(CONFIG.characterStarter.characters)) {
		if (!activeCharacters[char.name]) {
			start_character(char.name, char.codeSlot);
		}
	}
}
setInterval(teamStarter, 3000);

/* What level a merchant must be before mluck exists for it at all. Read from
   the game's own skill table rather than written down here: a number this file
   remembers is a number that can disagree with the game later. */
function mluckLevelRequired() {
	try {
		const lvl = parent?.G?.skills?.mluck?.level;
		if (typeof lvl === 'number' && isFinite(lvl)) return lvl;
	} catch (e) { }
	return CONFIG.locationBroadcast.mluckLevelFallback;
}

/* Is the merchant we ping actually able to cast mluck at us?

   Three answers, not two. Absent from the party means no - nobody is coming.
   Present but below the level means no - it cannot cast the skill whatever we
   tell it. Present at an unreadable level means YES: the old behaviour is
   preserved rather than silently disabling a working feature on missing data.

   mluckState is returned rather than a bare boolean so the caller can say
   which of those it is, once, instead of going quiet for an unexplained
   reason. */
function mluckState() {
	const want = CONFIG.locationBroadcast.targetPlayer;
	const party = (typeof get_party === 'function' ? get_party() : null) || {};
	const m = party[want];
	if (!m) return { ok: false, why: `${want} is not in the party` };
	const type = m.type || m.ctype;
	if (type && type !== 'merchant') return { ok: false, why: `${want} is a ${type}, not a merchant` };
	const need = mluckLevelRequired();
	const lvl = m.level;
	if (typeof lvl !== 'number') return { ok: true, why: `${want}'s level is unreadable - assuming it can` };
	if (lvl < need) return { ok: false, why: `${want} is level ${lvl}, mluck needs ${need}` };
	return { ok: true, why: `${want} is level ${lvl}` };
}

let mluckGateNote = null;
let pickupAskedAt = 0;
let packFullSince = 0;
let reliefRunning = false;

/* Items this character is willing to part with, cheapest first.

   Sorted by what a vendor would pay, per the game's own valuation rather than
   anything this file guesses. Everything excluded below is excluded on a rule,
   not a price: an upgraded or special item represents work, a locked one was
   deliberately protected, and the named list is things whose usefulness has
   nothing to do with their vendor value. */
function reliefSellable() {
	const cfg = CONFIG.inventoryRelief;
	const out = [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (!it || !it.name) continue;
		if (cfg.neverSell.has(it.name)) continue;
		if (it.l === 'l') continue;                 // locked by hand
		if (it.p) continue;                         // special / shiny
		if ((it.level || 0) > 0) continue;          // upgraded: someone paid for that
		let value = null;
		try { value = parent.calculate_item_value(it); } catch (e) { }
		out.push({ slot: i, name: it.name, q: it.q || 1, value: (typeof value === 'number' && isFinite(value)) ? value : 0 });
	}
	out.sort((a, b) => a.value - b.value);
	return out;
}

function freeSlots() {
	return character.items.filter((it) => it === null).length;
}

/* No mule is coming and the pack is full. Sell the cheapest junk until there
   is room, then carry on. Runs once at a time and always clears its own flag,
   because a fighter stuck in a sell that threw would simply stop fighting. */
async function runInventoryRelief() {
	const cfg = CONFIG.inventoryRelief;
	if (reliefRunning) return;
	reliefRunning = true;
	state.sellingOff = true;
	try {
		const want = cfg.targetFreeSlots;
		let sellable = reliefSellable();
		if (!sellable.length) {
			game_log(`Pack full, no mule, and nothing safe to sell - carrying on full`, 'red');
			return;
		}
		game_log(`No mule reachable - selling junk for ${want} free slots`, '#FFD700');
		try {
			await smart_move({ map: cfg.vendor.map, x: cfg.vendor.x, y: cfg.vendor.y });
		} catch (e) {
			game_log(`Could not reach the vendor: ${e?.reason || e}`, 'red');
			return;
		}
		let sold = 0;
		for (const item of sellable) {
			if (freeSlots() >= want) break;
			// Re-read the slot: selling shifts nothing, but a mule pickup or a
			// death could have emptied it since the list was built.
			const live = character.items[item.slot];
			if (!live || live.name !== item.name) continue;
			try {
				await sell(item.slot, live.q || 1);
				sold++;
				await new Promise((r) => setTimeout(r, 250));
			} catch (e) {
				game_log(`sell failed for ${item.name}: ${e?.reason || e}`, 'orange');
			}
		}
		game_log(`Sold ${sold} stack(s); ${freeSlots()} slots free`, sold ? '#7FD98A' : 'orange');
	} catch (e) {
		console.error('inventory relief failed:', e);
	} finally {
		state.sellingOff = false;
		reliefRunning = false;
		packFullSince = 0;      // whatever happened, start the clock again
	}
}

async function sendLocationUpdate() {
	if (!CONFIG.locationBroadcast.enabled) return;

	try {
		// Gated on the merchant being able to cast it. Without this the
		// condition below is permanently true whenever mluck is out of reach -
		// an unreachable state, not a transient one - and this fired a location
		// ping every second forever, asking for a buff nobody could give.
		const gate = mluckState();
		const mluckLive = !!(character.s.mluck
			&& character.s.mluck.f === CONFIG.locationBroadcast.targetPlayer);
		const needsUpdate = gate.ok && !mluckLive;

		/* Keyed off the DECISION, not the gate. gate.ok only says the merchant COULD
		   cast it, so the old line printed "requesting" for the whole hour a fresh
		   buff was running - and on 2026-09-28 that cost a wrong diagnosis, because
		   the log said "requesting" while the merchant was seen travelling and the
		   two looked like one event when neither was the request. The note now names
		   which of the two reasons applies, and the throttle compares the whole note
		   rather than gate.why, so a buff expiring still prints. */
		const gateNote = needsUpdate
			? `requesting: ${gate.why}`
			: mluckLive
				? `not requesting: mluck is live from ${character.s.mluck.f}`
				: `not requesting: ${gate.why}`;
		if (gateNote !== mluckGateNote) {
			mluckGateNote = gateNote;
			game_log(`[mluck] ${gateNote}`, needsUpdate ? '#7FD98A' : '#8b98ab');
		}
		const nullCount = character.items.filter(item => item === null).length;

		// The inventory branch is deliberately outside the mluck gate: a full
		// pack needs the mule whether or not anyone can buff us.
		const target = CONFIG.locationBroadcast.targetPlayer;
		const lowInv = nullCount <= CONFIG.locationBroadcast.lowInventorySlots;
		const now = Date.now();

		if (!lowInv) packFullSince = 0;
		else if (!packFullSince) packFullSince = now;

		let askPickup = false;
		if (lowInv) {
			const reach = merchantReach(target);
			if (reach.ok) {
				// Reachable: ask, at most once per cooldown. Whichever channel
				// carries it, the message gets there.
				askPickup = now - pickupAskedAt >= CONFIG.locationBroadcast.pickupCooldownMs;
				if (askPickup) pickupAskedAt = now;
			} else if (CONFIG.inventoryRelief.enabled
				&& !reliefRunning
				&& now - packFullSince >= CONFIG.inventoryRelief.graceMs) {
				// Not reachable by either channel, and long enough that a mule
				// mid-hop would have arrived. Free the slots ourselves rather
				// than stand there full.
				runInventoryRelief();
			}
		}

		if (needsUpdate || askPickup) {
			/* needsMluck carries the INTENT, and it is the whole point of v62.

			   This one message serves two purposes - "come and buff me" and "come and
			   empty my pack" - and Merchant.js used to read ANY location message from
			   an mluck target as a buff request. So a pickup ask enqueued a phantom
			   mluck job, and on the merchant an mluck job is a full batch: a shard
			   hop, a trip, and a summon that drags us off the farm spot for a buff
			   with most of its hour still left. With pickupCooldownMs at 15000 and
			   lowInventorySlots at 3, a low pack asked for that four times a minute.

			   Sent as a field rather than a second message type because the merchant
			   still needs these coordinates for the pickup - the trip is real, only
			   the buff task attached to it was invented. -> Merchant.js visitOneStop */
			plSend(target, {
				message: 'location',
				needsMluck: needsUpdate,
				x: character.x,
				y: character.y,
				map: character.map
			});
		}

		if (askPickup) {
			plSend(target, {
				message: 'inventory_almost_full',
				emptySlots: nullCount,
				x: character.x,
				y: character.y,
				map: character.map
			});
		}
	} catch (error) {
		console.error('Failed to send location update:', error);
	}
}
setInterval(sendLocationUpdate, CONFIG.locationBroadcast.checkInterval);

const SELL_WHITELIST = new Set(CONFIG.selling.whitelist);
function sellItems() {
	if (!CONFIG.selling.enabled) return;
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && SELL_WHITELIST.has(item.name) && item.p === undefined && item.l !== 'l') sell(i);
	}
}

async function upgradeItems() {
	if (!CONFIG.upgrading.enabled) return;

	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (!item || item.p || !CONFIG.upgrading.whitelist[item.name]) continue;

		const config = CONFIG.upgrading.whitelist[item.name];
		if (item.level >= config.targetLevel) continue;

		const grades = G.items[item.name].grades;
		let scrollname;

		if (item.level < grades[0]) scrollname = 'scroll0';
		else if (item.level < grades[1]) scrollname = 'scroll1';
		else scrollname = 'scroll2';

		const scrollSlot = locate_item(scrollname);
		if (scrollSlot === -1) {
			buy(scrollname);
			return;
		}

		let offeringSlot = null;
		if (item.level >= config.prim) {
			offeringSlot = locate_item('offering');
		} else if (item.level >= config.primling) {
			offeringSlot = locate_item('offeringp');
		}

		if (character.q.upgrade === undefined) {
			try {
				await upgrade(i, scrollSlot, offeringSlot);
			} catch (e) {
				console.error('Upgrade failed:', e);
			}
		}
		return;
	}
}

async function combineItems() {
	if (!CONFIG.combining.enabled) return;

	const toCompound = new Map();

	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (!item || !CONFIG.combining.whitelist[item.name]) continue;

		const config = CONFIG.combining.whitelist[item.name];
		if (item.level >= config.targetLevel) continue;

		const key = item.name + item.level;
		const grade = item_grade(item);

		if (!toCompound.has(key)) {
			toCompound.set(key, [item.level, grade, i]);
		} else {
			toCompound.get(key).push(i);
		}
	}

	for (const group of toCompound.values()) {
		const itemLevel = group[0];
		const grade = group[1];
		const scrollName = 'cscroll' + grade;

		for (let i = 2; i + 2 < group.length; i += 3) {
			const scrollSlot = locate_item(scrollName);
			if (scrollSlot === -1) {
				buy(scrollName);
				return;
			}

			const item = character.items[group[i]];
			const config = CONFIG.combining.whitelist[item.name];

			let offeringSlot = null;
			if (itemLevel >= config.prim) {
				offeringSlot = locate_item('offering');
			} else if (itemLevel >= config.primling) {
				offeringSlot = locate_item('offeringp');
			}

			if (character.q.compound === undefined) {
				try {
					await compound(group[i], group[i + 1], group[i + 2], scrollSlot, offeringSlot);
				} catch (e) {
					console.error('Compound failed:', e);
				}
			}
			return;
		}
	}
}

function pingButton() {
	add_top_button('Ping', (character.ping ?? 0).toFixed(0));
}
setInterval(pingButton, 1000);

function topButtons() {
	if (parent.S.lunarnewyear) {
		add_top_button('ShowDragold', '🐉', () => {
			const info = {
				state: dragold.state,
				targetShard: dragold.targetShard,
				currentShard: dragold.currentShard(),
				localDragoldLive: dragold.localDragoldLive(),
				scanResults: dragold.scanResults
					.slice()
					.sort((a, b) => a.spawnTime - b.spawnTime)
					.map(r => ({
						shard: r.shard,
						live: r.live,
						spawnTime: new Date(r.spawnTime).toLocaleString()
					}))
			};
			show_json(info);
		});
	}

	add_top_button('Return', 'R&M', () => {
		plSend(['FatherToken', 'MageofOz'], {
			message: 'location',
			x: character.x,
			y: character.y,
			map: character.map
		});
	});

	add_top_button('showLoot', '💼', displayLoot);

	/* Freezes the graphics (parent.pause() is a renderer toggle - the character
	   keeps playing) and arms teamStarter, which restarts any of the three
	   teammates that isn't running, rechecking every 3s.

	   There is deliberately no matching off-switch button. The old one paired
	   this with stop_character('Meltymerch'), which removes that character's
	   iframe outright: a hard kill with no on_destroy, taking the merchant
	   offline and losing whatever was in state.queue unless a hop had happened
	   to persist it. Disarming is not worth that - CONFIG is module scope, so
	   reloading Dexon (or any change_server hop) already resets enabled to
	   false. */
	add_top_button('Pause2', '⏸️', () => {
		pause();
		CONFIG.characterStarter.enabled = true
	});
}
topButtons();
function displayLoot() {
	const savedLoot = get('lootItems' + new Date().toLocaleString('en', { month: 'long' })) || {};
	const sortedLoot = Object.fromEntries(Object.keys(savedLoot).sort().map(k => [k, savedLoot[k]]));
	console.log("Saved Loot (Sorted):", sortedLoot);
	show_json(sortedLoot);
}

function get_nearest_monster_v2(args = {}) {
	let min_d = 999999;
	let target = null;
	let optimal_hp = args.check_max_hp ? 0 : 999999999;

	for (let id in parent.entities) {
		let current = parent.entities[id];
		if (current.type !== 'monster' || !current.visible || current.dead) continue;

		if (args.type) {
			if (Array.isArray(args.type)) {
				if (!args.type.includes(current.mtype)) continue;
			} else {
				if (current.mtype !== args.type) continue;
			}
		}

		if (args.min_level !== undefined && current.level < args.min_level) continue;
		if (args.max_level !== undefined && current.level > args.max_level) continue;
		if (args.target && !args.target.includes(current.target)) continue;
		if (args.no_target && current.target && current.target !== character.name) continue;

		if (args.statusEffects && !args.statusEffects.every(effect => current.s[effect])) continue;

		if (args.min_xp !== undefined && current.xp < args.min_xp) continue;
		if (args.max_xp !== undefined && current.xp > args.max_xp) continue;

		if (args.max_att !== undefined && current.attack > args.max_att) continue;

		if (args.path_check && !can_move_to(current)) continue;

		let c_dist = args.point_for_distance_check
			? Math.hypot(args.point_for_distance_check[0] - current.x, args.point_for_distance_check[1] - current.y)
			: parent.distance(character, current);

		if (args.max_distance !== undefined && c_dist > args.max_distance) continue;

		if (args.check_min_hp || args.check_max_hp) {
			let c_hp = current.hp;
			if ((args.check_min_hp && c_hp < optimal_hp) || (args.check_max_hp && c_hp > optimal_hp)) {
				optimal_hp = c_hp;
				target = current;
			}
			continue;
		}

		if (c_dist < min_d) {
			min_d = c_dist;
			target = current;
		}
	}

	return target;
}

function ms_to_next_skill(skill) {
	const next_skill = parent.next_skill[skill];
	if (next_skill === undefined || next_skill === null) return 0;

	let targetMs;
	if (typeof next_skill.getTime === 'function') {
		targetMs = next_skill.getTime();
	} else if (typeof next_skill === 'number') {
		targetMs = next_skill;
	} else {
		const parsed = new Date(next_skill).getTime();
		targetMs = Number.isNaN(parsed) ? Date.now() : parsed;
	}

	const ping = parent.pings?.length ? Math.min(...parent.pings) : 0;
	const ms = targetMs - Date.now() - ping;
	return ms < 0 ? 0 : ms;
}

const equipBatch = async data => {
	if (!Array.isArray(data) || data.length > 15) return;

	const valid = data.reduce((acc, { itemName, slot, level, l }) => {
		if (!itemName) return acc;

		const current = character.slots[slot];
		if (current?.name === itemName && current.level === level && current.l === l) return acc;

		const i = character.items.findIndex(item =>
			item?.name === itemName && item.level === level && item.l === l
		);
		if (i !== -1) acc.push({ num: i, slot });
		return acc;
	}, []);

	if (!valid.length) return;

	try {
		parent.socket.emit('equip_batch', valid);
		await parent.push_deferred('equip_batch');
	} catch (e) {
		console.error('equipBatch:', e);
	}
};

function isSetEquipped(setName) {
	const set = equipmentSets[setName];
	if (!set) return false;

	return set.every(item =>
		character.slots[item.slot]?.name === item.itemName &&
		character.slots[item.slot]?.level === item.level
	);
}

const equipSet = name => equipmentSets[name] && equipBatch(equipmentSets[name]);

state.skinReady = true;

const FARM_SEARCH = {
	reevaluateIntervalMs: 15 * 60 * 1000,
	mitigationConstant: 900,        // fallback only; defenseMultiplier() prefers the game's damage_multiplier
	avgDeathDowntimeSec: 45,
	minUptimeFraction: 0.5,
	maxConcurrentAttackers: 4,
	goldToXpRatioGuess: 0.05,
	minGoldMarginRatio: 1.2,
	maxViableHp: 50000000,
	xpLossPerDeathFraction: 0.03,
};

const partyDpsReports = {
	FatherToken: { type: 'magical', dps: 0, maxHp: 0, level: 0, receivedAt: 0 },
	MageofOz: { type: 'magical', dps: 0, maxHp: 0, level: 0, receivedAt: 0 },
};

const economicsTracker = {
	lastGold: character.gold,
	lastCheckTime: Date.now(),
};

const ARRIVAL_RADIUS = 100;

const arrivalState = {
	assignedAt: null,
	reachedAt: null,
	reported: false,
};

function hasReachedFarmSpot() {
	if (!destination || character.map !== mobMap) return false;
	return distance(character, destination) < ARRIVAL_RADIUS;
}

const BLACKLIST_STORAGE_KEY = 'farm_spot_blacklist';

// ============================================================================
// CODED LISTS - the two verdicts the auto-blacklist is not allowed to make
// ============================================================================
// The unreachable heuristic further down (3 minutes without arriving -> blacklist
// forever) has been firing on spots that are perfectly fine to farm, and nothing
// ever expires, so it ratchets: ~55 spots are blacklisted already, nearly all of
// them "stuck 180s without arriving" at exactly 180-second intervals - i.e. the
// timeout fired, the next spot was picked, that one timed out too, and so on down
// the list. Run long enough it blacklists everything and the party farms nothing.
//
// These two lists bound it from both ends. They are a floor under the damage,
// not the fix - see the TASK note below them.

// Never blacklisted, whatever Dexon or the healers report. An incoming report
// naming one of these is refused, AND any entry already sitting in storage is
// dropped on the next read - so the three spots the ratchet already ate come
// back on their own, without the user clearing anything by hand.
const PERMANENT_WHITELIST = new Set([
	'crab@main',
	'arcticbee@winterland',
	'snake@main',
]);

// Never scored as a candidate at all. Cheaper than blacklisting them (they
// never reach the UI list, never become the auto pick, never become a manual
// override) and it cannot be undone by removeFromBlacklist() the way a stored
// entry can - to change it, edit this list.
const PERMANENT_BLACKLIST = new Set([
	//testing if no longer needed as characters have advanced significantly since this was implmented
	//'gscorpion@desertland',
	'mrpumpkin@halloween',//boss not valid farm
	'mrgreen@spookytown',//boss not valid farm
	//'mummy@level3',
	//'mummy@level4',
]);

// TASK - come back to this. The lists above are a stopgap; the real bug is the
// reachability verdict in checkFarmEconomics(). Two halves to it:
//   1. Why does smart_move keep failing to arrive? Candidates: doors/instances
//      the router won't cross, a spot whose boundary midpoint sits inside
//      geometry, or ARRIVAL_RADIUS (100) being tighter than where smart_move
//      actually stops - in which case Dexon IS there and is blacklisting the
//      spot he is standing in.
//   2. Whatever the cause, the verdict must stop being permanent and absolute:
//      expire entries after a while, require N failures rather than one, and
//      record how close he actually got so a near-miss is told apart from a
//      spot the router genuinely cannot reach.
// Until that is done the whitelist is the only thing guaranteeing the party has
// anywhere to farm at all.

let whitelistFallbackLogged = false;

function spotKey(home, mobMap) {
	return `${home}@${mobMap}`;
}

function isWhitelistedSpot(key) {
	return PERMANENT_WHITELIST.has(key);
}

function isPermanentlyBlacklisted(key) {
	return PERMANENT_BLACKLIST.has(key);
}

function getBlacklist() {
	const stored = get(BLACKLIST_STORAGE_KEY) || {};
	// Self-healing: a whitelisted spot blacklisted before this list existed is
	// dropped here and the pruned map written back, so it stays gone.
	let pruned = false;
	for (const key in stored) {
		if (!isWhitelistedSpot(key)) continue;
		delete stored[key];
		pruned = true;
	}
	if (pruned) set(BLACKLIST_STORAGE_KEY, stored);
	return stored;
}

// Returns the key on success, or null if the spot is whitelisted and the
// report was refused. Callers must check - "nothing was blacklisted" is a
// different outcome from "blacklisted", not an error.
function addToBlacklist(home, mobMap, reason, reportedBy, details) {
	const key = spotKey(home, mobMap);
	if (isWhitelistedSpot(key)) {
		game_log(`Refused to blacklist "${key}" - permanent whitelist (was: ${reason})`, 'orange');
		return null;
	}
	const blacklist = getBlacklist();
	blacklist[key] = { reason, reportedBy, blacklistedAt: Date.now() };
	if (details) blacklist[key].details = details;
	set(BLACKLIST_STORAGE_KEY, blacklist);
	return key;
}

function removeFromBlacklist(key) {
	if (isPermanentlyBlacklisted(key)) {
		game_log(`"${key}" is on the permanent blacklist in the script - edit PERMANENT_BLACKLIST to change that`, 'orange');
		return false;
	}
	const blacklist = getBlacklist();
	if (!blacklist[key]) {
		game_log(`"${key}" isn't on the blacklist`, 'orange');
		return false;
	}
	delete blacklist[key];
	set(BLACKLIST_STORAGE_KEY, blacklist);
	game_log(`Removed "${key}" from the farm spot blacklist`, '#00FF00');
	return true;
}

function clearBlacklist() {
	const count = Object.keys(getBlacklist()).length;
	set(BLACKLIST_STORAGE_KEY, {});
	game_log(`Cleared ${count} stored blacklist entries (the coded lists are unaffected)`, '#00FF00');
	return count;
}

function listBlacklist() {
	const view = {
		permanentWhitelist: [...PERMANENT_WHITELIST],
		permanentBlacklist: [...PERMANENT_BLACKLIST],
		blacklisted: getBlacklist(),
	};
	show_json(view);
	return view;
}

function myOwnDps() {
	return (character.attack || 0) * (character.frequency || 0);
}

function getPartyDps() {
	let physical = myOwnDps();
	let magical = 0;
	for (const name in partyDpsReports) {
		const r = partyDpsReports[name];
		if (r.type === 'physical') physical += r.dps;
		else magical += r.dps;
	}
	return { physical, magical };
}

/* Damage mitigation, taken from the game rather than approximated.

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
   missing" and "the estimate is right" indistinguishable. */
let mitigationFallbackLogged = false;
function defenseMultiplier(defenseStat) {
	const d = Number.isFinite(defenseStat) ? defenseStat : 0;
	if (typeof parent !== 'undefined' && typeof parent.damage_multiplier === 'function') {
		const m = parent.damage_multiplier(d);
		if (typeof m === 'number' && isFinite(m)) return m;
	}
	if (!mitigationFallbackLogged) {
		mitigationFallbackLogged = true;
		console.error('farm scoring: parent.damage_multiplier unavailable, using the /(x+'
			+ FARM_SEARCH.mitigationConstant + ') approximation, which overestimates our damage against defense above ~400');
	}
	return 1 - (d / (d + FARM_SEARCH.mitigationConstant));
}

function mitigated(dps, defenseStat) {
	return dps * defenseMultiplier(defenseStat);
}

/* EVASION AND AVOIDANCE ARE STRAIGHT MISSES, so they scale effective dps the
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
   a damage model would make this worse rather than better. */
function dodgeMultiplier(mobData) {
	if (!mobData) return 1;
	const ev = Math.max(0, Math.min(100, mobData.evasion || 0));
	const av = Math.max(0, Math.min(100, mobData.avoidance || 0));
	return (1 - ev / 100) * (1 - av / 100);
}

function isMapSafeForFarming(mapData) {
	if (!mapData) return false;
	if (mapData.pvp) return false;
	if (mapData.instance) return false;
	return true;
}

function estimateHealThroughput() {
	return 400 / 0.2;
}

function getTrackedPartyMembers() {
	const members = [{ name: character.name, maxHp: character.max_hp, level: character.level }];
	for (const name in partyDpsReports) {
		const r = partyDpsReports[name];
		if (r.maxHp && r.level) members.push({ name, maxHp: r.maxHp, level: r.level });
	}
	return members;
}

function scoreAllFarmSpots() {
	if (!parent.G || !parent.G.maps || !parent.G.monsters) return [];

	const dps = getPartyDps();
	const healThroughput = estimateHealThroughput();
	const partyEffectiveHp = 3 * (character.max_hp || 2000);
	const blacklist = getBlacklist();

	const candidates = [];

	for (const mapName in parent.G.maps) {
		const mapData = parent.G.maps[mapName];
		if (!isMapSafeForFarming(mapData) || !mapData.monsters) continue;

		for (const spot of mapData.monsters) {
			const mobData = parent.G.monsters[spot.type];
			if (!mobData || !mobData.hp || !mobData.xp) continue;
			if (mobData.hp > FARM_SEARCH.maxViableHp) continue;
			const key = spotKey(spot.type, mapName);
			if (isPermanentlyBlacklisted(key)) continue;
			if (blacklist[key]) continue;

			const effPhysical = mitigated(dps.physical, mobData.armor || 0);
			const effMagical = mitigated(dps.magical, mobData.resistance || 0);
			const totalEffDps = Math.max((effPhysical + effMagical) * dodgeMultiplier(mobData), 1);

			const ttk = mobData.hp / totalEffDps;
			const rawKillRate = 1 / ttk;
			const respawn = mobData.respawn || 1;
			const sustainableKillRate = spot.count / respawn;
			const actualKillRate = Math.min(rawKillRate, sustainableKillRate);
			const rawExpPerSecond = actualKillRate * mobData.xp;

			const attackers = Math.min(spot.count, FARM_SEARCH.maxConcurrentAttackers);
			/* THIS IS THE RAW HIT, with none of OUR mitigation taken off it, and
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
			   only reorders. */
			const incomingDps = (mobData.attack || 0) * (mobData.frequency || 1) * attackers;
			const survivabilityMargin = healThroughput - incomingDps;

			let uptimeFraction = 1;
			if (survivabilityMargin < 0) {
				const timeToDeathSec = partyEffectiveHp / Math.abs(survivabilityMargin);
				const deathsPerHour = 3600 / timeToDeathSec;
				const downtimePerHour = deathsPerHour * FARM_SEARCH.avgDeathDowntimeSec;
				uptimeFraction = Math.max(0, (3600 - downtimePerHour) / 3600);
			}
			if (uptimeFraction < FARM_SEARCH.minUptimeFraction) continue;

			let allMembersNetPositive = true;
			for (const member of getTrackedPartyMembers()) {
				const memberMargin = healThroughput - incomingDps;
				if (memberMargin >= 0) continue;
				const memberTimeToDeathSec = member.maxHp / Math.abs(memberMargin);
				const memberDeathsPerHour = 3600 / memberTimeToDeathSec;
				const xpToNextLevel = parent.G.levels?.[member.level] || 0;
				const xpLossPerDeath = xpToNextLevel * FARM_SEARCH.xpLossPerDeathFraction;
				const memberUptimeFraction = Math.max(0, (3600 - memberDeathsPerHour * FARM_SEARCH.avgDeathDowntimeSec) / 3600);
				const memberNetXpPerSecond = (rawExpPerSecond * memberUptimeFraction) - (memberDeathsPerHour * xpLossPerDeath / 3600);
				if (memberNetXpPerSecond <= 0) { allMembersNetPositive = false; break; }
			}
			if (!allMembersNetPositive) continue;

			const adjustedExpPerSecond = rawExpPerSecond * uptimeFraction;

			const estGoldPerSecond = adjustedExpPerSecond * FARM_SEARCH.goldToXpRatioGuess;
			const estPotionCostPerSecond = incomingDps > 0 ? incomingDps * 0.002 : 0.5;
			if (estGoldPerSecond < estPotionCostPerSecond * FARM_SEARCH.minGoldMarginRatio) continue;

			if (!Array.isArray(spot.boundary) || spot.boundary.length < 4) continue;
			const [bx1, by1, bx2, by2] = spot.boundary;
			candidates.push({
				home: spot.type,
				mobMap: mapName,
				x: (bx1 + bx2) / 2,
				y: (by1 + by2) / 2,
				expPerSecond: adjustedExpPerSecond,
				uptimeFraction,
			});
		}
	}

	candidates.sort((a, b) => b.expPerSecond - a.expPerSecond);
	if (candidates.length) {
		whitelistFallbackLogged = false;
		return candidates;
	}

	// Nothing survived scoring. Rather than stand still, fall back to the
	// whitelisted spots unscored - they are hand-picked, so "is it worth it"
	// is already answered. Only reachable from here, so it changes nothing
	// whenever the normal path produces even one candidate.
	const fallback = whitelistFallbackCandidates();
	if (fallback.length && !whitelistFallbackLogged) {
		whitelistFallbackLogged = true;
		game_log(`No spot passed scoring - falling back to the ${fallback.length} whitelisted spot(s)`, 'orange');
	}
	return fallback;
}

function whitelistFallbackCandidates() {
	if (!parent.G || !parent.G.maps) return [];
	const out = [];
	for (const mapName in parent.G.maps) {
		const mapData = parent.G.maps[mapName];
		if (!mapData || !mapData.monsters) continue;
		for (const spot of mapData.monsters) {
			if (!isWhitelistedSpot(spotKey(spot.type, mapName))) continue;
			if (!Array.isArray(spot.boundary) || spot.boundary.length < 4) continue;
			const [bx1, by1, bx2, by2] = spot.boundary;
			out.push({
				home: spot.type,
				mobMap: mapName,
				x: (bx1 + bx2) / 2,
				y: (by1 + by2) / 2,
				expPerSecond: 0,
				uptimeFraction: 1,
				whitelistFallback: true,
			});
		}
	}
	return out;
}

function findBestFarmSpot() {
	const candidates = scoreAllFarmSpots();
	return candidates.length ? candidates[0] : null;
}

let manualOverride = null;
let lastCandidates = [];

function runFarmSearch() {
	try {
		lastCandidates = scoreAllFarmSpots();
		const result = manualOverride || lastCandidates[0];

		if (!result) {
			game_log('Farm search found no viable candidates (waiting on DPS reports or game data)', 'red');
			updateFarmUI();
			return;
		}
		const changed = home !== result.home || mobMap !== result.mobMap;
		home = result.home;
		mobMap = result.mobMap;
		/* An anchor, where one is configured, replaces the spawn-boundary centre.
		   Standing in the middle of the spawn is what makes 24-lane surrounds
		   possible; see CONFIG.movement.anchors. */
		const anchor = (CONFIG.movement.anchors || {})[spotKey(result.home, result.mobMap)];
		destination = anchor
			? { map: result.mobMap, x: anchor.x, y: anchor.y }
			: { map: result.mobMap, x: result.x, y: result.y };
		if (changed) {
			const tag = manualOverride ? '(manual override)' : '(auto)';
			game_log(
				`Farm spot ${tag}: ${home} @ ${mobMap} (~${result.expPerSecond.toFixed(1)} xp/s, ${(result.uptimeFraction * 100).toFixed(0)}% uptime)`,
				'#00FF00'
			);
			arrivalState.assignedAt = Date.now();
			arrivalState.reachedAt = null;
			arrivalState.reported = false;
			noteTravelTarget(destination);
		}
		sendFarmSpot();
		updateFarmUI();
	} catch (e) {
		console.error('runFarmSearch error:', e);
	}
}

/* FEAR INSTRUMENTATION - observation only. Nothing branches on any of this.

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
   shard hop would otherwise reset it. Read it with farmFearReport(). */
const FEAR_STORE = 'fear_log';
const fearWatch = { lastSample: Date.now(), fearedMs: 0, windowMs: 0, peak: 0, recent: [] };

function fearAttackerCount() {
	let n = 0;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e && e.type === 'monster' && e.target === character.name) n++;
	}
	return n;
}

function sampleFear() {
	const now = Date.now();
	const dt = now - fearWatch.lastSample;
	fearWatch.lastSample = now;
	/* A throttled tab or a reload leaves a gap that is not observed time.
	   Counting it would inflate both numerator and denominator with fiction. */
	if (dt <= 0 || dt > 5000) return;
	fearWatch.windowMs += dt;
	if (character.fear > 0) fearWatch.fearedMs += dt;
	const n = fearAttackerCount();
	if (n > fearWatch.peak) fearWatch.peak = n;
}

function flushFearWindow(key) {
	const windowMs = fearWatch.windowMs;
	const fearedMs = fearWatch.fearedMs;
	const peak = fearWatch.peak;
	fearWatch.windowMs = 0; fearWatch.fearedMs = 0; fearWatch.peak = 0;
	if (windowMs <= 0) return null;

	const pct = Math.round((fearedMs / windowMs) * 100);
	fearWatch.recent.push({ pct, sec: Math.round(fearedMs / 1000), peak });
	if (fearWatch.recent.length > 6) fearWatch.recent.shift();

	try {
		const log = get(FEAR_STORE) || { since: Date.now(), bySpot: {} };
		const row = log.bySpot[key] || { observedMs: 0, fearedMs: 0, peak: 0, windows: 0, abandons: 0 };
		row.observedMs += windowMs;
		row.fearedMs += fearedMs;
		row.windows += 1;
		if (peak > row.peak) row.peak = peak;
		log.bySpot[key] = row;
		set(FEAR_STORE, log);
	} catch (e) { /* storage is best effort; the live numbers still log */ }

	return { pct, sec: Math.round(fearedMs / 1000), peak };
}

function noteFearAbandon(key) {
	try {
		const log = get(FEAR_STORE) || { since: Date.now(), bySpot: {} };
		const row = log.bySpot[key] || { observedMs: 0, fearedMs: 0, peak: 0, windows: 0, abandons: 0 };
		row.abandons = (row.abandons || 0) + 1;
		log.bySpot[key] = row;
		set(FEAR_STORE, log);
	} catch (e) { /* as above */ }
}

function fearRecentSummary() {
	if (!fearWatch.recent.length) return 'no fear samples yet';
	const sec = fearWatch.recent.reduce((a, r) => a + r.sec, 0);
	const peak = Math.max(...fearWatch.recent.map((r) => r.peak));
	return `feared ${sec}s over the last ${fearWatch.recent.length} window(s), peak ${peak} attacker(s), courage ${character.courage}`;
}

/* Console helper. The whole point of the exercise - read this after a few
   hours of farming and the fear-versus-spot question answers itself. */
function farmFearReport() {
	const log = get(FEAR_STORE);
	if (!log || !log.bySpot || !Object.keys(log.bySpot).length) {
		game_log('fear report: nothing recorded yet', 'orange');
		return null;
	}
	const rows = Object.entries(log.bySpot).map(([key, r]) => ({
		spot: key,
		minutes: +(r.observedMs / 60000).toFixed(1),
		fearedPct: r.observedMs ? +((r.fearedMs / r.observedMs) * 100).toFixed(1) : 0,
		fearedMin: +(r.fearedMs / 60000).toFixed(1),
		peakAttackers: r.peak,
		abandons: r.abandons || 0,
	})).sort((a, b) => b.fearedPct - a.fearedPct);
	game_log(`fear report: ${rows.length} spot(s) since ${new Date(log.since).toLocaleString()}`, '#7FD98A');
	return show_json({ courage: character.courage, mcourage: character.mcourage, pcourage: character.pcourage, spots: rows });
}

function clearFearReport() { set(FEAR_STORE, { since: Date.now(), bySpot: {} }); game_log('fear report cleared', 'orange'); }

setInterval(sampleFear, 1000);

function checkFarmEconomics() {
	if (!home || !mobMap) return;

	if (!hasReachedFarmSpot()) {
		economicsTracker.lastGold = character.gold;
		economicsTracker.lastCheckTime = Date.now();
		economicsTracker.consecutiveBadSamples = 0;

		// The verdict runs on failed travel ATTEMPTS, not on elapsed time. This
		// loop is independent of the one that travels, so a clock here measures
		// shard hops, live events, potion runs and vendor trips just as happily
		// as it measures a bad route - which is how the blacklist ate ~55 spots
		// at exactly 180-second intervals without ever calling smart_move.
		noteTravelTarget(destination);
		travelWatchdog(destination);

		/* THE RELEASE VALVE, and it sits above the breaker deliberately.
		   The breaker below BLACKLISTS a spot it cannot route to, and achvApply
		   deliberately whitelists the achievement spot so that cannot happen -
		   which left "whitelisted, so staying put and still trying" as the only
		   outcome, and arrivalState.reported makes that log ONCE. Measured
		   2026-10-09: 41 consecutive failures standing on spookytown's (0,0)
		   spawn, with nothing in the script noticing. The whitelist is right;
		   what was missing is a way to give up on the OVERRIDE rather than on
		   the spot. This is checked every tick, not once, because `reported`
		   latches. */
		if (typeof achvIsOurs === 'function' && achvIsOurs()
			&& travelState.failures >= ((CONFIG.achievements && CONFIG.achievements.maxTravelFailures) || 10)) {
			achvLog('cannot route to ' + home + '@' + mobMap + ' after ' + travelState.failures
				+ ' attempts (' + travelFailureDetail() + ') - releasing the spot to the scorer and standing the '
				+ 'queue down. achvResume() to pick it up again.', 'red');
			achvPaused = true;
			rageAlso = [];
			manualOverride = null;
			travelArrived();                      // clear the counter for the next spot
			try { runFarmSearch(); } catch (e) { }
			return;
		}

		/* ...and never while the monsters we were sent for are right here. A
		   radius can be mistuned; this cannot. -> travelAtDestination */
		if (!arrivalState.reported && travelState.failures >= TRAVEL.maxAttempts
			&& !get_nearest_monster({ type: home })) {
			arrivalState.reported = true;
			const detail = travelFailureDetail();
			if (isWhitelistedSpot(spotKey(home, mobMap))) {
				// Whitelisted: keep walking. handleReturnHome() re-issues travelTo()
				// whenever nothing is in flight, so staying here means "keep
				// trying", not "give up". reported stays true so this logs once
				// instead of every tick.
				game_log(`Can't route to ${home}@${mobMap} (${detail}) - whitelisted, so staying put and still trying`, 'orange');
				return;
			}
			const assignedSec = arrivalState.assignedAt ? Math.round((Date.now() - arrivalState.assignedAt) / 1000) : null;
			game_log(`Can't route to ${home}@${mobMap} (${detail}) - blacklisting as unreachable`, 'red');
			addToBlacklist(home, mobMap, `Dexon couldn't route here - ${detail}`, 'Dexon', {
				attempts: travelState.failures,
				lastError: travelState.lastError,
				stoppedAt: travelState.lastDistance,
				assignedSecAgo: assignedSec,
			});
			runFarmSearch();
		}
		return;
	}

	if (arrivalState.reachedAt === null) {
		arrivalState.reachedAt = Date.now();
		travelArrived();
		economicsTracker.lastGold = character.gold;
		economicsTracker.lastCheckTime = Date.now();
		economicsTracker.consecutiveBadSamples = 0;
		return;
	}

	const now = Date.now();
	const elapsedSec = (now - economicsTracker.lastCheckTime) / 1000;
	if (elapsedSec < 60) return;

	const goldGained = character.gold - economicsTracker.lastGold;
	const goldPerSecond = goldGained / elapsedSec;

	const spot = spotKey(home, mobMap);
	const fear = flushFearWindow(spot);

	if (goldPerSecond <= 0) {
		economicsTracker.consecutiveBadSamples = (economicsTracker.consecutiveBadSamples || 0) + 1;
		/* Say whether fear was present rather than blaming the spot silently.
		   This only annotates the verdict - the verdict itself is unchanged. */
		if (fear && fear.pct > 0) {
			game_log(`No net gold this minute, and ${fear.pct}% of it was spent feared (peak ${fear.peak} attackers)`, 'orange');
		}
		if (economicsTracker.consecutiveBadSamples >= 3) {
			noteFearAbandon(spot);
			game_log(`Current farm spot shows no net gold gain for ${economicsTracker.consecutiveBadSamples} consecutive minutes (${fearRecentSummary()}) - re-evaluating`, 'red');
			runFarmSearch();
			economicsTracker.consecutiveBadSamples = 0;
		}
	} else {
		economicsTracker.consecutiveBadSamples = 0;
	}

	economicsTracker.lastGold = character.gold;
	economicsTracker.lastCheckTime = now;
}

setTimeout(runFarmSearch, 8000);
setInterval(runFarmSearch, FARM_SEARCH.reevaluateIntervalMs);

// ============================================================================
// ACHIEVEMENT QUEUE - work a list of monster rungs without being driven by hand
// ============================================================================
/* WHY THIS EXISTS. A farm spot lives in `manualOverride`, which is a runtime
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
   returns early without one. Dexon carries one in slot 0. */
const ACHV_KEY = 'achv_queue';
let achvKills = 0;        // kill_credit for the current target since the last read
let achvLastRefresh = 0;
let achvPaused = false;   // the operator moved the party by hand; stay out of the way
let achvWarned = false;

function achvCfg() { return CONFIG.achievements || { enabled: false, queue: [] }; }
function achvLog(m, c) { try { game_log('[achv] ' + m, c || '#9FD3FF'); } catch (e) { } console.log('[achv] ' + m); }

function achvLoad() {
	let s = null;
	try { s = get(ACHV_KEY); } catch (e) { }
	if (!s || typeof s !== 'object') s = { i: 0, done: [] };
	if (typeof s.i !== 'number') s.i = 0;
	if (!Array.isArray(s.done)) s.done = [];
	return s;
}
function achvSave(s) { try { set(ACHV_KEY, s); } catch (e) { achvLog('could not persist the queue', 'red'); } }

function achvTarget() {
	const q = achvCfg().queue || [];
	const s = achvLoad();
	return (s.i >= 0 && s.i < q.length) ? q[s.i] : null;
}

/* max(own + diff, account best) - the same expression node/server.js uses to
   decide whether a rung is earned, so this cannot disagree with the game. */
function achvScore(m) {
	const t = (typeof parent !== 'undefined' && parent.tracker) || {};
	const own = t.monsters || {}, d = t.monsters_diff || {}, mx = (t.max && t.max.monsters) || {};
	return Math.max((own[m] || 0) + (d[m] || 0), (mx[m] || [0, 0])[0]);
}

function achvRefresh() {
	return new Promise((resolve) => {
		let restored = false;
		const P = parent;
		const orig = P.render_tracker;
		const restore = () => { if (!restored) { restored = true; try { P.render_tracker = orig; } catch (e) { } } };
		try {
			P.render_tracker = function () { };
			P.socket.emit('tracker');
		} catch (e) { restore(); return resolve(false); }
		setTimeout(() => { restore(); resolve(true); }, 2200);
	});
}

/* Everything the spot needs to survive: whitelisted so checkFarmEconomics cannot
   take it, pruned out of any blacklist already holding it, then set. */
function achvApply(t) {
	try { PERMANENT_WHITELIST.add(spotKey(t.m, t.map)); getBlacklist(); } catch (e) { }
	manualOverride = { home: t.m, mobMap: t.map, x: t.x, y: t.y, expPerSecond: 0, uptimeFraction: 1 };
	/* `also` monsters are farmed alongside t.m and must survive the economics
	   check the same way, or the spot is dropped the moment one of them scores
	   badly on its own. */
	rageAlso = Array.isArray(t.also) ? t.also.slice() : [];
	try { for (const a of rageAlso) PERMANENT_WHITELIST.add(spotKey(a, t.map)); } catch (e) { }
	achvKills = 0;
	try { runFarmSearch(); } catch (e) { achvLog('runFarmSearch threw: ' + e, 'red'); }
}

function achvIsOurs() {
	const t = achvTarget();
	return !!(t && manualOverride && manualOverride.home === t.m && manualOverride.mobMap === t.map);
}

function achvAdvance(reason) {
	const s = achvLoad(), t = achvTarget();
	if (t) s.done.push({ m: t.m, rung: t.rung, at: Date.now(), why: reason });
	s.i++;
	achvSave(s);
	const n = achvTarget();
	if (n) { achvLog('next: ' + n.m + '@' + n.map + ' for ' + n.rung, '#7FD98A'); achvApply(n); }
	else {
		achvLog('queue finished - handing the spot back to the scorer', '#FFD700');
		manualOverride = null;
		try { runFarmSearch(); } catch (e) { }
	}
}

async function achvTick() {
	const cfg = achvCfg();
	if (!cfg.enabled || achvPaused) return;
	/* The monster hunt owns the farm spot while a cycle is live, and the override
	   check further down would read that as the operator moving the party by
	   hand - which stands the queue down PERMANENTLY until achvResume(). Return
	   before that happens; the queue picks up again when mhOff() releases. */
	if (typeof mhOwnsSpot === 'function' && mhOwnsSpot()) return;
	const t = achvTarget();
	if (!t) return;

	if (!achvWarned && !(typeof parent !== 'undefined' && parent.tracker)) {
		achvWarned = true;
		achvLog('no tracker data - a tracker item must be in the bag or progress cannot be read', 'orange');
	}

	/* An override that is neither ours nor empty means the operator moved the
	   party by hand, and that outranks the queue. Empty means a reload or a
	   blacklist cleared it, which is the case this exists to repair. */
	if (manualOverride && !achvIsOurs()) {
		achvPaused = true;
		achvLog('override points at ' + manualOverride.home + '@' + manualOverride.mobMap
			+ ' - standing down, achvResume() to take it back', 'orange');
		return;
	}
	if (!achvIsOurs()) { achvLog('re-asserting ' + t.m + '@' + t.map, '#8b98ab'); achvApply(t); }

	/* On a timer, and early when the kills counted since the last read could
	   already have crossed. 1.3 UNDER-states score per kill (1.589 measured for a
	   co-located trio) so the eager check fires before the rung, never after. */
	const base = achvScore(t.m);
	/* rung null = run until the toggle goes off or achvStop(), so there is no
	   threshold to race and nothing to refresh early for. */
	if (t.rung == null) { if (Date.now() - achvLastRefresh < cfg.refreshMs) return; }
	else if (Date.now() - achvLastRefresh < cfg.refreshMs && base + achvKills * 1.3 < t.rung) return;

	achvLastRefresh = Date.now();
	try { await noHang(achvRefresh(), 'achv tracker refresh', 6000); } catch (e) { }
	achvKills = 0;
	const now = achvScore(t.m);
	if (t.rung == null) achvLog(t.m + ': ' + Math.round(now) + ' (no rung - running until stopped)', '#8b98ab');
	else if (now >= t.rung) { achvLog(t.m + ' reached ' + t.rung + ' (' + Math.round(now) + ')', '#00FF00'); achvAdvance('reached'); }
	else achvLog(t.m + ': ' + Math.round(now) + ' / ' + t.rung, '#8b98ab');
}

// ---- console helpers -------------------------------------------------------
function achvStatus() {
	const cfg = achvCfg(), s = achvLoad();
	achvLog(cfg.enabled ? (achvPaused ? 'ENABLED, stood down' : 'ENABLED') : 'disabled',
		cfg.enabled && !achvPaused ? '#7FD98A' : '#8b98ab');
	(cfg.queue || []).forEach((q, i) => {
		const sc = Math.round(achvScore(q.m));
		achvLog((i === s.i ? ' -> ' : '    ') + q.m + '@' + q.map + '  ' + sc + ' / ' + q.rung
			+ (sc >= q.rung ? '  DONE' : ''), i === s.i ? '#FFD700' : '#8b98ab');
	});
	return { i: s.i, target: achvTarget(), paused: achvPaused, done: s.done };
}
/* The stop command. Clears the override so the scorer takes the spot back,
   and stays stood down until achvResume() - the toggle is the other way out. */
function achvStop() {
	achvPaused = true;
	rageAlso = [];
	if (achvIsOurs()) { manualOverride = null; try { runFarmSearch(); } catch (e) { } }
	achvLog('stopped by hand - spot handed back to the scorer; achvResume() to pick up again', '#FFD700');
	return true;
}
function achvResume() { achvPaused = false; achvLog('resumed', '#7FD98A'); const t = achvTarget(); if (t) achvApply(t); return true; }
function achvSkip() { achvLog('skipped by hand', '#FFD700'); achvAdvance('skipped'); return achvTarget(); }
function achvReset(i) {
	const s = achvLoad();
	s.i = (typeof i === 'number') ? i : 0;
	s.done = [];
	achvSave(s);
	achvPaused = false;
	achvLog('queue index set to ' + s.i, '#FFD700');
	const t = achvTarget();
	if (t) achvApply(t);
	return t;
}

/* Counted only to decide when to spend a refresh early, never as progress. */
try {
	parent.socket.on('kill_credit', (d) => {
		if (!achvCfg().enabled || achvPaused) return;
		const t = achvTarget();
		if (t && d && d.mtype === t.m) achvKills++;
	});
} catch (e) { }

setInterval(() => {
	achvTick().catch((e) => achvLog('tick threw: ' + ((e && e.message) || e), 'red'));
}, (CONFIG.achievements && CONFIG.achievements.reassertMs) || 30000);

setInterval(() => {
	mhTick().catch((e) => mhLog('tick threw: ' + ((e && e.message) || e), 'red'));
}, (CONFIG.monsterHunt && CONFIG.monsterHunt.tickMs) || 5000);

/* The toolbar is static markup in the game's index.html, so it is normally
   there long before any CODE runs and the dock succeeds first time. If it
   somehow is not, keep checking for a while rather than leaving the panel
   floating for the rest of the session. Only the fallback branch schedules
   this, so a successful dock costs nothing. */
const FARM_UI_REDOCK = { tries: 0, max: 10, everyMs: 1000 };

/* Where the panel ended up and why. Read it from the console with
   farmUiDiag() when the panel is not where it should be - guessing at the
   live client's markup from the open-source snapshot has already cost one
   round. */
const FARM_UI_DIAG = { docked: null, via: null, toprightcorner: null, codebuttons: null, at: null };

function farmUiDiag() {
	const $ = parent.$;
	const out = Object.assign({}, FARM_UI_DIAG);
	if ($) {
		const $panel = $('#farm-spot-ui');
		out.panelExists = $panel.length > 0;
		out.panelParent = $panel.length ? ($panel.parent().attr('id') || $panel.parent().attr('class') || $panel.parent().prop('tagName')) : null;
		out.panelPosition = $panel.length ? $panel.css('position') : null;
		const $cb = $('.codebuttons').first();
		out.codebuttonsParent = $cb.length ? ($cb.parent().attr('id') || $cb.parent().attr('class') || $cb.parent().prop('tagName')) : null;
		out.codebuttonsChain = [];
		let node = $cb;
		for (let i = 0; i < 6 && node.length && node.prop('tagName') !== 'BODY'; i++) {
			out.codebuttonsChain.push(node.prop('tagName') + (node.attr('id') ? '#' + node.attr('id') : '') + (node.attr('class') ? '.' + String(node.attr('class')).split(/\s+/).join('.') : ''));
			node = node.parent();
		}
		out.redockTries = FARM_UI_REDOCK.tries;
	}
	show_json(out);
	return out;
}

function scheduleFarmUiRedock() {
	if (FARM_UI_REDOCK.tries >= FARM_UI_REDOCK.max) return;
	FARM_UI_REDOCK.tries++;
	setTimeout(() => {
		if (!parent.$) return;
		if (parent.$('#toprightcorner').children('.codebuttons').length === 0) {
			scheduleFarmUiRedock();
			return;
		}
		initializeFarmUI();   // removes the floating panel and rebuilds it docked
	}, FARM_UI_REDOCK.everyMs);
}

function initializeFarmUI() {
	if (character.name !== 'Dexon') return;
	if (!parent.$) return;
	const $ = parent.$;
	/* THE DOCUMENT THE PANEL LIVES IN, AND NOT THE ONE THIS SCRIPT RUNS IN.
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
	   binding here. */
	const doc = parent.document;

	/* Rebuild rather than bail when a panel already exists.

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
	   pass one either - see below. */
	$('#farm-spot-ui').remove();

	/* Dock into the game's own top-right toolbar, immediately left of the first
	   code button (R&M), rather than floating over the map.

	   Two details decide the insertion point:

	   - It goes NEXT TO .codebuttons, never inside it. clear_buttons() is
	     `$('.codebuttons').html("")` - anything living in that span gets wiped
	     with the buttons.

	   - #toprightcorner carries `bpclicks`: pointer-events:none on itself,
	     with `.bpclicks > *` restoring auto for DIRECT children only. A direct
	     child gets clicks back and its own descendants inherit that, so the
	     candidate chips and the Auto button stay clickable. A deeper insertion
	     point would render but swallow every click.

	   If the toolbar isn't there (a UI mode that doesn't render it), fall back
	   to the old free-floating panel rather than silently having no UI. */
	/* Anchor on .codebuttons unscoped, exactly as the game's own
	   add_top_button does (`parent.$(".codebuttons").append(...)`).

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
	   lives in the toolbar. */
	const $dock = $('.codebuttons').first();
	const docked = $dock.length > 0;
	FARM_UI_DIAG.docked = docked;
	FARM_UI_DIAG.via = docked ? '.codebuttons' : 'nothing matched - floating';
	FARM_UI_DIAG.toprightcorner = $('#toprightcorner').length;
	FARM_UI_DIAG.codebuttons = $('.codebuttons').length;
	FARM_UI_DIAG.at = new Date().toLocaleTimeString();

	// Docked, it flows in the toolbar row, so it is sized rather than
	// positioned - and kept off the left edge on a narrow window. Floating, it
	// keeps the old fixed placement, drag and resize.
	const frameStyle = docked
		? 'display: inline-block; vertical-align: top; width: 600px; max-width: 60vw; pointer-events: auto;'
		: 'position: fixed; top: 180px; left: 10px; width: 1000px; min-width: 400px; resize: both;';
	const headerCursor = docked ? 'default' : 'move';

	const uiHtml = `
		<div id="farm-spot-ui" style="${frameStyle} min-height: 60px; background: rgba(0, 0, 0, 0.9); color: #fff; border-radius: 6px; font-family: monospace; font-size: 11px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); box-sizing: border-box; user-select: none; overflow: auto;">
			<div id="farm-spot-header" style="padding: 6px 12px; background: rgba(30, 30, 30, 0.95); border-top-left-radius: 6px; border-top-right-radius: 6px; cursor: ${headerCursor}; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #555;">
				<div style="font-weight: bold; display: flex; align-items: center; gap: 6px;">
					<span>Farm Spot</span>
					<button id="ui-reset-override" style="background: #444; color: #fff; border: 1px solid #777; cursor: pointer; font-size: 9px; padding: 2px 5px; border-radius: 3px;">Auto</button>
				</div>
				<button id="ui-toggle-expand" style="background: #444; color: #fff; border: 1px solid #777; cursor: pointer; font-size: 10px; padding: 1px 6px; border-radius: 3px;">_</button>
			</div>
			<div id="farm-spot-body" style="padding: 6px 12px; display: flex; align-items: center; gap: 10px; height: calc(100% - 31px); min-height: 42px;">
				<div id="ui-mob-list" style="display: flex; gap: 8px; overflow-x: auto; width: 100%; white-space: nowrap; padding-bottom: 2px; align-items: center; height: 100%;"></div>
			</div>
		</div>
	`;

	if (docked) {
		$dock.before(uiHtml);
	} else {
		$('body').append(uiHtml);
		scheduleFarmUiRedock();
	}

	let isDragging = false;
	let startX, startY;

	if (!docked) $(doc).off("mousedown", "#farm-spot-header").on("mousedown", "#farm-spot-header", function (e) {
		if ($(e.target).is("button")) return;
		isDragging = true;
		startX = e.clientX - $("#farm-spot-ui").offset().left;
		startY = e.clientY - $("#farm-spot-ui").offset().top;
		$("#farm-spot-ui").css("transform", "none");
		e.preventDefault();
	});

	$(doc).off("mousemove").on("mousemove", function (e) {
		if (!isDragging) return;
		const newX = e.clientX - startX;
		const newY = e.clientY - startY;
		$("#farm-spot-ui").css({ left: newX + "px", top: newY + "px", bottom: "auto" });
	});

	$(doc).off("mouseup").on("mouseup", function () { isDragging = false; });

	let isExpanded = true;
	$(doc).off("click", "#ui-toggle-expand").on("click", "#ui-toggle-expand", function () {
		isExpanded = !isExpanded;
		if (isExpanded) {
			$("#farm-spot-body").css("display", "flex");
			$(this).text("_");
		} else {
			$("#farm-spot-body").css("display", "none");
			$(this).text("+");
		}
	});

	$(doc).off("click", "#ui-reset-override").on("click", "#ui-reset-override", function () {
		manualOverride = null;
		runFarmSearch();
	});

	$(doc).off("click", ".farm-spot-row").on("click", ".farm-spot-row", function () {
		const idx = $(this).data("idx");
		const candidate = lastCandidates[idx];
		if (!candidate) return;
		if (manualOverride && manualOverride.home === candidate.home && manualOverride.mobMap === candidate.mobMap) {
			manualOverride = null;
		} else {
			manualOverride = candidate;
		}
		runFarmSearch();
	});

	game_log(`Farm Spot UI: ${docked ? 'docked' : 'FLOATING'} (${FARM_UI_DIAG.via}) - farmUiDiag() for details`, docked ? '#00FF00' : 'orange');

	updateFarmUI();
}

function updateFarmUI() {
	if (character.name !== 'Dexon') return;
	if (!parent.$) return;
	if (lastCandidates.length === 0) lastCandidates = scoreAllFarmSpots();
	const $ = parent.$;
	const $list = $('#ui-mob-list');
	if ($list.length === 0) return;

	const rows = lastCandidates.slice(0, 20).map((c, idx) => {
		const isActive = manualOverride
			? (manualOverride.home === c.home && manualOverride.mobMap === c.mobMap)
			: (idx === 0 && !manualOverride);
		const bg = isActive ? '#2a6' : '#333';
		return `
			<div class="farm-spot-row" data-idx="${idx}" style="cursor: pointer; background: ${bg}; border: 1px solid #777; border-radius: 3px; padding: 4px 8px; display: inline-block;">
				<div style="font-weight: bold;">${c.home}</div>
				<div style="font-size: 9px; opacity: 0.85;">${c.mobMap} - ${c.expPerSecond.toFixed(1)} xp/s - ${(c.uptimeFraction * 100).toFixed(0)}% up</div>
			</div>
		`;
	}).join('');

	$('#ui-reset-override').css('background', manualOverride ? '#444' : '#2a6');
	$list.html(rows || '<div style="opacity:0.7;">No viable candidates yet</div>');
}

// ============================================================================
// MONSTER HUNT - THE LEADER HALF. Dexon decides; Priest.js and Mage.js obey.
// ============================================================================
/* THE TOGGLE IS CONFIG.monsterHunt.enabled, default FALSE, and mhOn()/mhOff()
   flip it at runtime. Off means the party farms exactly as it did before: this
   block releases the override it set, tells the other two they are farming
   again, and stops touching anything.

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
   abandons rather than grinding for nothing. -> mhStale */
const MH_DAISY = { map: 'main', x: 126, y: -413 };
const MH_DAISY_RADIUS = 340;
const MH_FOLLOWERS = ['FatherToken', 'MageofOz'];
const MH_KEY = 'mh_state';

let mhPhase = 'off';          // off | gather | hunt | turnin
let mhPool = {};              // name -> last report
let mhPick = null;            // { owner, id, map, x, y, c, estSec, b }
let mhPickAt = 0;             // when it was chosen - a follower report older than this cannot refute it
let mhSpotFixed = false;      // have we already terrain-checked this pick's centre
let mhPhaseSince = 0;
let mhAskedAt = 0;
let mhModeSent = null;
let mhDone = [];              // owners whose hunt reached zero this cycle
let mhBusy = false;           // a Daisy trip owns movement; mainLoop stands down

/* THE TOGGLE SURVIVES A SHARD HOP. mhOn()/mhOff() used to assign straight to
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
   times per tick and once per candidate inside mhScore. */
let mhToggle = null;   // null = follow the source; true/false = stored choice

function mhStored() {
	try { const s = get(MH_KEY); return (s && typeof s === 'object') ? s : null; } catch (e) { return null; }
}

function mhCfg() {
	const c = CONFIG.monsterHunt || { enabled: false };
	if (mhToggle === null) return c;
	return Object.assign({}, c, { enabled: mhToggle });
}

function mhSaveToggle(v) {
	mhToggle = v;
	try { set(MH_KEY, { enabled: v, at: new Date().toISOString() }); }
	catch (e) { mhLog('could not persist the toggle - it will not survive a hop', 'red'); }
}

/* Read once at load, so a reload picks the operator's choice back up. */
(function () {
	const st = mhStored();
	if (st && typeof st.enabled === 'boolean') mhToggle = st.enabled;
})();
function mhLog(m, c) { try { game_log('[mh] ' + m, c || '#9FD3FF'); } catch (e) { } console.log('[mh] ' + m); }
function mhShard() { try { return String(parent.server_region) + ' ' + String(parent.server_identifier); } catch (e) { return null; } }
function mhSelfHunt() { try { return (character.s && character.s.monsterhunt) || null; } catch (e) { return null; } }
function mhAtDaisy() {
	try {
		return character.map === MH_DAISY.map
			&& Math.hypot(character.x - MH_DAISY.x, character.y - MH_DAISY.y) <= MH_DAISY_RADIUS;
	} catch (e) { return false; }
}

/* Our own report, in the same shape the followers send, so the pool is uniform
   and the ranking does not special-case the leader. */
function mhSelfReport() {
	const h = mhSelfHunt(), shard = mhShard();
	return { id: h ? h.id : null, c: h ? h.c : null, ms: h ? h.ms : null, sn: h ? h.sn : null,
		shard: shard, stale: !!(h && shard && h.sn !== shard), atDaisy: mhAtDaisy(),
		esize: character.esize, why: 'self', at: Date.now() };
}

function mhRefresh() { mhPool[character.name] = mhSelfReport(); }

/* SAFETY AND COST, from the party's own model. Returns null when this monster
   is not something the party should be standing in. */
function mhEvaluate(id) {
	if (!id) return null;
	if (!parent.G || !parent.G.maps || !parent.G.monsters) return null;
	const mob = parent.G.monsters[id];
	if (!mob || !mob.hp) return null;
	/* Pure damage ignores armour AND resistance, so no amount of gear or
	   healing makes it survivable - it is a refusal, not a score. */
	if (mob.damage_type === 'pure') return null;

	const dps = getPartyDps();
	const heal = estimateHealThroughput();
	const blacklist = getBlacklist();
	let best = null;

	for (const mapName in parent.G.maps) {
		const mapData = parent.G.maps[mapName];
		if (!isMapSafeForFarming(mapData) || !mapData.monsters) continue;
		for (const spot of mapData.monsters) {
			if (spot.type !== id) continue;
			if (!Array.isArray(spot.boundary) || spot.boundary.length < 4) continue;
			const key = spotKey(id, mapName);
			if (isPermanentlyBlacklisted(key)) { /* whitelisted spots are fine */ }
			else if (blacklist[key]) continue;

			const eff = Math.max((mitigated(dps.physical, mob.armor || 0) + mitigated(dps.magical, mob.resistance || 0)) * dodgeMultiplier(mob), 1);
			const attackers = Math.min(spot.count || 1, FARM_SEARCH.maxConcurrentAttackers);
			/* Raw hit, our own mitigation not applied - see the long note in
			   scoreAllFarmSpots. Pessimistic deliberately; it can only refuse a
			   hunt spot, never admit a lethal one. */
			const incoming = (mob.attack || 0) * (mob.frequency || 1) * attackers;

			let uptime = 1;
			if (heal - incoming < 0) {
				const ttd = (3 * (character.max_hp || 2000)) / Math.abs(heal - incoming);
				const deathsPerHour = 3600 / ttd;
				uptime = Math.max(0, (3600 - deathsPerHour * FARM_SEARCH.avgDeathDowntimeSec) / 3600);
			}
			if (uptime < FARM_SEARCH.minUptimeFraction) continue;

			/* Throughput is the lesser of how fast we can kill and how fast they
			   come back - a four-spawn pack on a 60s respawn is supply-bound no
			   matter how hard the party hits. */
			const killRate = Math.min(eff / mob.hp, (spot.count || 1) / (mob.respawn || 1));
			if (!(killRate > 0)) continue;
			const [bx1, by1, bx2, by2] = spot.boundary;
			const cand = { id: id, map: mapName, x: (bx1 + bx2) / 2, y: (by1 + by2) / 2,
				/* keep the spawn box: the centre may be unstandable and mhWalkableSpot
				   needs somewhere to look for a point that is not. */
				b: [bx1, by1, bx2, by2],
				uptime: uptime, killRate: killRate * uptime, count: spot.count || 1 };
			if (!best || cand.killRate > best.killRate) best = cand;
		}
	}
	return best;
}

/* Seconds to clear this hunt, or null when it should not be attempted. */
function mhScore(rep) {
	if (!rep || !rep.id || !rep.c) return null;
	if (rep.stale) return null;
	const cfg = mhCfg();
	const ev = mhEvaluate(rep.id);
	if (!ev) return null;
	const sec = rep.c / ev.killRate;
	if (cfg.maxEstMin && sec > cfg.maxEstMin * 60) return null;
	/* No point starting something the hunt's own clock will outlive. */
	const leftSec = Math.max(0, (rep.ms || 0) / 1000);
	if (sec > leftSec) return null;
	return Object.assign({}, ev, { estSec: sec, c: rep.c, msLeft: rep.ms });
}

/* THE WAIT RULE. Choose only once every member has settled, where settled means
   we have heard SOMETHING definite from them: a hunt they accepted, a hunt they
   were already holding and cannot reroll (the operator's exception - its timer
   has not expired, so waiting for them to accept would be waiting for ever), or
   a flat refusal. A member we have heard nothing at all from is not settled, and
   acceptWaitMs is the backstop so one silent character cannot stall the cycle. */
function mhSettled(name) {
	const r = mhPool[name];
	if (!r) return false;
	if (r.id) return true;                       // holding or accepted something
	return r.why === 'refused' || r.why === 'no slot'
		|| r.why === 'could not reach Daisy' || r.why === 'emit failed';
}

function mhRoster() { return [character.name].concat(MH_FOLLOWERS.filter((n) => mhInParty(n))); }

function mhInParty(name) {
	try { const p = (typeof get_party === 'function' ? get_party() : null) || {}; return !!p[name]; }
	catch (e) { return false; }
}

function mhAllSettled() {
	const roster = mhRoster();
	const unsettled = roster.filter((n) => !mhSettled(n));
	if (!unsettled.length) return { ready: true, why: 'all ' + roster.length + ' settled' };
	if (Date.now() - mhPhaseSince > (mhCfg().acceptWaitMs || 90000))
		return { ready: true, why: 'waited out ' + unsettled.join(', ') };
	return { ready: false, waiting: unsettled };
}

/* The notification the operator asked for: are we walking to a hunt, or to a
   farm? Sent on every transition and whenever the target changes, so the other
   two always have a reason for where they are being taken. */
function mhSendMode(mode, target, map, why) {
	const sig = mode + '|' + (target || '') + '|' + (map || '') + '|' + (why || '');
	if (sig === mhModeSent) return;
	mhModeSent = sig;
	try { plSend(MH_FOLLOWERS, { message: 'mh_mode', mode: mode, target: target || null, map: map || null, why: why || null }); }
	catch (e) { mhLog('mode broadcast failed: ' + e, 'orange'); }
	mhLog(mode === 'hunt' ? ('hunting ' + target + '@' + map + (why ? ' - ' + why : '')) : ('farming' + (why ? ' - ' + why : '')),
		mode === 'hunt' ? '#FFD700' : '#7FD98A');
}

function mhTell(names, message, extra) {
	try { plSend(names, Object.assign({ message: message }, extra || {})); }
	catch (e) { mhLog(message + ' to ' + names + ' failed: ' + e, 'orange'); }
}

/* Pin the spot the same way the achievement queue does, for the same reason:
   checkFarmEconomics will otherwise blacklist a spot chosen for a reason it
   cannot see, and PERMANENT_WHITELIST is rebuilt from source on load so the
   addition has to be re-made rather than assumed. */
/* THE SPOT IS A BOUNDING-BOX CENTRE, AND A CENTRE NEED NOT BE STANDABLE.
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
   permits rather than being bounced somewhere arbitrary. */
function mhWalkableSpot(pick) {
	if (!pick || !pick.b || typeof can_move_to !== 'function') return null;
	if (character.map !== pick.map) return null;
	if (can_move_to(pick.x, pick.y)) return null;
	const x1 = pick.b[0], y1 = pick.b[1], x2 = pick.b[2], y2 = pick.b[3];
	const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
	const hw = Math.abs(x2 - x1) / 2, hh = Math.abs(y2 - y1) / 2;
	let best = null, bestD = Infinity;
	for (let i = -3; i <= 3; i++) {
		for (let j = -3; j <= 3; j++) {
			if (!i && !j) continue;
			const x = cx + (hw * i) / 3, y = cy + (hh * j) / 3;
			if (!can_move_to(x, y)) continue;
			const d = Math.hypot(x - cx, y - cy);
			if (d < bestD) { best = [x, y]; bestD = d; }
		}
	}
	return best;
}

function mhApply(pick) {
	try { PERMANENT_WHITELIST.add(spotKey(pick.id, pick.map)); getBlacklist(); } catch (e) { }
	manualOverride = { home: pick.id, mobMap: pick.map, x: pick.x, y: pick.y, expPerSecond: 0, uptimeFraction: pick.uptime || 1 };
	try { runFarmSearch(); } catch (e) { mhLog('runFarmSearch threw: ' + e, 'red'); }
	mhSendMode('hunt', pick.id, pick.map, pick.owner + "'s hunt, " + pick.c + ' left, ~' + Math.round(pick.estSec / 60) + ' min');
}

function mhOwnsSpot() {
	return !!(mhCfg().enabled && mhPick && manualOverride
		&& manualOverride.home === mhPick.id && manualOverride.mobMap === mhPick.map);
}

function mhRelease(why) {
	if (mhPick && manualOverride && manualOverride.home === mhPick.id && manualOverride.mobMap === mhPick.map) {
		manualOverride = null;
		try { runFarmSearch(); } catch (e) { }
	}
	mhPick = null;
	mhPickAt = 0;
	mhSpotFixed = false;
	mhSendMode('farm', null, null, why || null);
}

function mhReset(why, phase) {
	mhRelease(why);
	mhPool = {};
	mhDone = [];
	mhPhase = phase || 'off';
	mhPhaseSince = Date.now();
	mhAskedAt = 0;
}

async function mhGoDaisy() {
	if (mhAtDaisy()) return true;
	/* TAKE THE WHEEL FROM A TRIP ALREADY IN FLIGHT, OR LOSE THE RACE TO IT.

	   A farm or hunt trip started by mainLoop keeps running inside its own
	   travelTo() call after mainLoop stands down on mhBusy - standing down stops
	   NEW movement, it does not cancel movement already under way. Both trips
	   then own the one smart_move the client gives us, and the Daisy trip is the
	   one that loses, because travelTo's recovery path is far more aggressive
	   than ours: when its smart_move is interrupted it calls town(), which
	   TELEPORTS, and then re-issues smart_move(dest). So every Daisy attempt was
	   cut short, and the character was yanked back toward the farm target.

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
	   for in kills. */
	if (typeof travelState !== 'undefined' && travelState.inFlight) {
		mhLog('taking movement from a live trip to ' + travelState.target, '#8b98ab');
		travelState.attemptId++;      // orphan it: travelTo's mine() goes false
		travelState.inFlight = false;
	}
	try { await noHang(smart_move({ map: MH_DAISY.map, x: MH_DAISY.x, y: MH_DAISY.y }), 'mh daisy', 120000); }
	catch (e) { mhLog('could not reach Daisy: ' + ((e && (e.reason || e.message)) || e), 'orange'); }
	return mhAtDaisy();
}

async function mhAcceptSelf() {
	const have = mhSelfHunt();
	if (have && have.c) { mhRefresh(); mhPool[character.name].why = 'already held'; return true; }
	if (!character.esize) { mhRefresh(); mhPool[character.name].why = 'no slot'; mhLog('no free slot - not accepting', 'orange'); return false; }
	/* The flag has to span the walk, the emit AND the settle sleep, not just the
	   walk: mainLoop would otherwise start dragging us back to the farm spot
	   between arriving and the server answering. */
	mhBusy = true;
	try {
		if (!(await mhGoDaisy())) { mhRefresh(); mhPool[character.name].why = 'could not reach Daisy'; return false; }
		try { parent.socket.emit('monsterhunt'); } catch (e) { mhLog('emit failed: ' + e, 'red'); mhRefresh(); mhPool[character.name].why = 'emit failed'; return false; }
		await sleep(1500);
		mhRefresh();
		const h = mhSelfHunt();
		mhPool[character.name].why = h ? 'accepted' : 'refused';
		mhLog(h ? ('accepted ' + h.id + ' x' + h.c) : 'the server refused the hunt', h ? '#7FD98A' : 'orange');
		return !!h;
	} finally { mhBusy = false; }
}

async function mhTurnInSelf() {
	const h = mhSelfHunt();
	if (!h || h.c) return false;
	mhBusy = true;
	try {
		if (!(await mhGoDaisy())) return false;
		try { parent.socket.emit('monsterhunt'); } catch (e) { mhLog('emit failed: ' + e, 'red'); return false; }
		await sleep(1500);
		const done = !mhSelfHunt();
		mhLog(done ? 'turned in - token collected' : 'turn-in did not take', done ? '#7FD98A' : 'orange');
		mhRefresh();
		return done;
	} finally { mhBusy = false; }
}

/* Follower reports arrive here, routed from on_cm. */
function mhOnReport(name, data) {
	mhPool[name] = { id: data.id || null, c: data.c, ms: data.ms, sn: data.sn, shard: data.shard,
		stale: !!data.stale, atDaisy: !!data.atDaisy, esize: data.esize, why: data.why || 'asked', at: Date.now() };
	mhLog(name + ': ' + (data.id ? (data.id + ' x' + data.c + (data.stale ? ' STALE(' + data.sn + ' vs ' + data.shard + ')' : '')) : ('none - ' + data.why)), '#8b98ab');
}

function mhStale() {
	const shard = mhShard();
	const bad = [];
	for (const n in mhPool) { const r = mhPool[n]; if (r && r.id && r.sn && shard && r.sn !== shard) bad.push(n); }
	return bad;
}

async function mhTick() {
	const cfg = mhCfg();
	if (!cfg.enabled) {
		if (mhPhase !== 'off') { mhLog('disabled - handing the spot back', '#FFD700'); mhReset('monster hunt turned off', 'off'); }
		return;
	}
	if (mhPhase === 'off') { mhPhase = 'gather'; mhPhaseSince = Date.now(); mhPool = {}; mhDone = []; mhLog('enabled - collecting hunts', '#FFD700'); }

	/* Our own live state first, THEN the staleness judgement. Reading the pool
	   before refreshing it meant our own shard change was only ever noticed on
	   the FOLLOWING tick, because nothing had written our current sn yet - the
	   harness caught that, and a tick of grinding for no credit is exactly what
	   this check exists to prevent. */
	mhRefresh();

	/* A hop invalidates every hunt taken on the old shard, silently. Catch it
	   before the party spends the window killing things for no credit. */
	const stale = mhStale();
	if (stale.length && mhPhase !== 'gather') {
		mhLog('shard changed - ' + stale.join(', ') + " hunt(s) no longer count, restarting", 'orange');
		mhReset('shard changed', 'gather');
		return;
	}

	if (mhPhase === 'gather') {
		mhRefresh();
		if (!mhSettled(character.name)) {
			mhSendMode('farm', null, null, 'collecting hunts');
			await mhAcceptSelf();
		}
		if (Date.now() - mhAskedAt > (cfg.askMs || 20000)) {
			mhAskedAt = Date.now();
			for (const n of MH_FOLLOWERS) {
				if (!mhInParty(n)) continue;
				mhTell([n], mhSettled(n) ? 'mh_ask' : 'mh_accept');
			}
		}
		const s = mhAllSettled();
		if (!s.ready) return;

		const ranked = mhRoster().map((n) => {
			const sc = mhScore(mhPool[n]);
			return sc ? Object.assign({ owner: n }, sc) : null;
		}).filter(Boolean).sort((a, b) => a.estSec - b.estSec);

		if (!ranked.length) {
			const held = mhRoster().filter((n) => mhPool[n] && mhPool[n].id);
			mhLog('nothing worth hunting (' + s.why + '): '
				+ (held.length ? held.map((n) => n + '=' + mhPool[n].id + ' x' + mhPool[n].c).join(', ') : 'no hunts at all')
				+ ' - farming until they expire', 'orange');
			mhReset('no acceptable target', 'gather');
			mhPhaseSince = Date.now() + (cfg.retryMs || 300000) - (cfg.acceptWaitMs || 90000);
			return;
		}
		mhPick = ranked[0];
		mhPickAt = Date.now();
		mhSpotFixed = false;
		mhLog('picked ' + mhPick.owner + "'s " + mhPick.id + ' x' + mhPick.c + ' (~'
			+ Math.round(mhPick.estSec / 60) + ' min) from ' + ranked.length + ' viable; ' + s.why, '#FFD700');
		mhPhase = 'hunt';
		mhPhaseSince = Date.now();
		mhApply(mhPick);
		return;
	}

	if (mhPhase === 'hunt') {
		if (!mhPick) { mhPhase = 'gather'; mhPhaseSince = Date.now(); return; }
		if (!mhOwnsSpot()) { mhLog('re-asserting ' + mhPick.id + '@' + mhPick.map, '#8b98ab'); mhApply(mhPick); }

		mhRefresh();
		if (Date.now() - mhAskedAt > (cfg.askMs || 20000)) {
			mhAskedAt = Date.now();
			for (const n of MH_FOLLOWERS) if (mhInParty(n)) mhTell([n], 'mh_ask');
		}

		/* THE PICK CAN DIE UNDER US, AND NOTHING LOOKED. The only test below is
		   "the owner still holds this hunt AND has finished it". There was no
		   branch at all for the owner's hunt having ROLLED OVER to a different
		   one, so a dead pick fell through to the huntCapMs check and the party
		   kept walking to it for up to twenty-five minutes.

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
		   never needs that test. */
		const cur = mhPool[mhPick.owner];
		const refutable = cur && (mhPick.owner === character.name || (cur.at || 0) > mhPickAt);
		if (refutable && cur.id !== mhPick.id) {
			mhLog(mhPick.owner + ' no longer holds ' + mhPick.id + ' (now '
				+ (cur.id ? cur.id + ' x' + cur.c : 'nothing') + ') - pick is dead, re-gathering', 'orange');
			mhReset('pick no longer held', 'gather');
			return;
		}

		/* We are on the pick's map now, so the terrain question can finally be
		   asked. Once per pick: a repeated scan would re-apply every tick. */
		if (!mhSpotFixed && character.map === mhPick.map) {
			mhSpotFixed = true;
			const fix = mhWalkableSpot(mhPick);
			if (fix) {
				mhLog('spot centre ' + Math.round(mhPick.x) + ',' + Math.round(mhPick.y)
					+ ' is not standable - using ' + Math.round(fix[0]) + ',' + Math.round(fix[1]), '#FFD700');
				mhPick.x = fix[0];
				mhPick.y = fix[1];
				mhApply(mhPick);
			}
		}

		const owner = mhPool[mhPick.owner];
		if (owner && owner.id === mhPick.id && !owner.c) {
			mhLog(mhPick.owner + ' finished ' + mhPick.id, '#7FD98A');
			if (mhDone.indexOf(mhPick.owner) < 0) mhDone.push(mhPick.owner);

			/* Straight to Daisy. The latency floor here is the tick, not the walk:
			   mhTick runs every CONFIG.monsterHunt.tickMs (5s), so a hunt is banked
			   within one tick of its count reaching zero rather than at the end of a
			   cycle that could still have another 25-minute target in it. */
			if (cfg.turnInImmediately !== false) {
				mhPhase = 'turnin';
				mhPhaseSince = Date.now();
				mhSendMode('farm', null, null, 'banking ' + mhPick.id + ' now');
				return;
			}

			/* Another hunt still worth doing, and enough clock left on the ones
			   already finished to bank them afterwards? Then keep going. */
			const next = mhRoster().filter((n) => n !== mhPick.owner && mhDone.indexOf(n) < 0)
				.map((n) => { const sc = mhScore(mhPool[n]); return sc ? Object.assign({ owner: n }, sc) : null; })
				.filter(Boolean).sort((a, b) => a.estSec - b.estSec);
			const margin = Math.min.apply(null, mhDone.map((n) => (mhPool[n] && mhPool[n].ms) || 0).concat([Infinity]));
			if (next.length && margin > (cfg.turnInMarginMs || 420000)) {
				mhPick = next[0];
				mhPickAt = Date.now();
				mhSpotFixed = false;
				mhLog('next: ' + mhPick.owner + "'s " + mhPick.id + ' x' + mhPick.c, '#FFD700');
				mhApply(mhPick);
				return;
			}
			mhPhase = 'turnin';
			mhPhaseSince = Date.now();
			mhSendMode('farm', null, null, 'banking ' + mhDone.length + ' token(s)');
			return;
		}

		if (Date.now() - mhPhaseSince > (cfg.huntCapMs || 1500000)) {
			mhLog('gave up on ' + mhPick.id + ' after ' + Math.round((Date.now() - mhPhaseSince) / 60000) + ' min', 'orange');
			mhPhase = mhDone.length ? 'turnin' : 'gather';
			mhPhaseSince = Date.now();
			mhRelease('hunt cap reached');
		}
		return;
	}

	if (mhPhase === 'turnin') {
		mhRelease('turning in');
		mhBusy = true;
		let reached;
		try { reached = await mhGoDaisy(); } finally { mhBusy = false; }
		if (!reached) {
			if (Date.now() - mhPhaseSince > 180000) { mhLog('cannot reach Daisy - giving up on this cycle', 'red'); mhReset('could not bank', 'gather'); }
			return;
		}
		const banked = await mhTurnInSelf();

		/* Ask for the next one here, while still standing at her. mhAcceptSelf
		   guards itself - it returns early when a live hunt is already held, so
		   this cannot reroll a hunt the party is part-way through, and it emits
		   nothing in that case. When the finished hunt belonged to a FOLLOWER we
		   hold a live one of our own, so that guard is what makes this safe to
		   call unconditionally. */
		if (cfg.reAcceptAtDaisy !== false) {
			const got = await mhAcceptSelf();
			if (banked) mhLog(got ? 'banked and took the next hunt in one trip' : 'banked, but no new hunt was issued', got ? '#7FD98A' : 'orange');
		}

		/* THE FOLLOWERS CANNOT BE TOLD BOTH THINGS AT ONCE. Their mhAccept and
		   mhTurnIn share a single mhBusy flag, and each refuses outright while the
		   other holds it - an mh_accept arriving behind an mh_turnin is answered
		   with "already on a Daisy trip" and dropped, not queued. So only the
		   turn-in is sent here, and their re-accept comes from the gather phase,
		   which mhReset below primes by zeroing mhAskedAt: gather asks every
		   unsettled follower on its very next pass and keeps asking every askMs
		   until it lands, so a follower still walking to Daisy is simply picked up
		   on a later pass. Nothing is lost by not racing it. */
		for (const n of MH_FOLLOWERS) if (mhInParty(n) && mhDone.indexOf(n) >= 0) mhTell([n], 'mh_turnin');
		await sleep(3000);
		mhLog('banked ' + mhDone.length + ' hunt(s) - re-gathering', '#7FD98A');
		mhReset('cycle complete', 'gather');
		return;
	}
}

// ---- console helpers -------------------------------------------------------
function mhOn() { mhSaveToggle(true); mhLog('ON - and it will stay on across a shard hop', '#7FD98A'); return mhStatus(); }
function mhOff() { mhSaveToggle(false); mhReset('turned off by hand', 'off'); mhLog('OFF - farming as normal, and it stays off across a hop', '#FFD700'); return mhStatus(); }
/* Drop the stored choice and go back to obeying CONFIG.monsterHunt.enabled. */
function mhForget() {
	mhToggle = null;
	try { set(MH_KEY, null); } catch (e) { }
	mhLog('stored toggle cleared - following the source default ('
		+ ((CONFIG.monsterHunt && CONFIG.monsterHunt.enabled) ? 'ON' : 'OFF') + ') again', '#FFD700');
	return mhStatus();
}
function mhSkip() {
	if (!mhPick) { mhLog('nothing picked', '#8b98ab'); return null; }
	mhLog('skipping ' + mhPick.id + ' by hand', '#FFD700');
	mhRelease('skipped by hand');
	mhPhase = 'gather';
	mhPhaseSince = Date.now();
	return mhStatus();
}
function mhStatus() {
	mhRefresh();
	const rows = {};
	for (const n of mhRoster()) {
		const r = mhPool[n];
		const sc = mhScore(r);
		rows[n] = r ? ((r.id ? r.id + ' x' + r.c + ' (' + Math.round((r.ms || 0) / 60000) + ' min)' : 'none')
			+ (r.stale ? ' STALE' : '') + ' - ' + r.why
			+ (r.id ? (sc ? '  viable ~' + Math.round(sc.estSec / 60) + ' min' : '  REFUSED') : '')) : 'no report';
	}
	const out = { enabled: !!mhCfg().enabled,
		toggle: mhToggle === null ? 'from source' : ('stored ' + (mhToggle ? 'ON' : 'OFF')),
		phase: mhPhase, busy: mhBusy, shard: mhShard(),
		pick: mhPick ? (mhPick.owner + ':' + mhPick.id + '@' + mhPick.map) : null,
		done: mhDone.slice(), reports: rows, ownsSpot: mhOwnsSpot(),
		waiting: mhAllSettled().waiting || null };
	console.log('[mh]', out);
	return out;
}

function on_cm(name, data) {
	if (!plFirstTime(data && data._plid)) return;   // same message may arrive twice: in-game and relayed
	if (data.message === 'boss') { bossOnCall(name, data); return; }
	if (data.message === 'mh_report' && (name === 'FatherToken' || name === 'MageofOz')) { mhOnReport(name, data); return; }
	if (data.message === 'dps_report' && partyDpsReports[name]) {
		partyDpsReports[name] = { type: data.damageType, dps: data.dps, maxHp: data.maxHp, level: data.level, receivedAt: Date.now() };
		return;
	}

	if ((name === 'FatherToken' || name === 'MageofOz') && data.message === 'blacklist_spot') {
		const key = addToBlacklist(data.home, data.mobMap, data.reason, name, data.details);
		if (!key) return;   // whitelisted - addToBlacklist said so, and nothing changed
		game_log(`Blacklisted "${key}" - ${data.reason} (reported by ${name})`, 'red');
		if (manualOverride && spotKey(manualOverride.home, manualOverride.mobMap) === key) {
			manualOverride = null;
			game_log(`Cleared manual override - it pointed at the spot just blacklisted`, 'orange');
		}
		runFarmSearch();
		return;
	}

	if (name !== 'Meltymerch') return;

	if (data.message === 'come_to_merchant') {
		state.waitingForMerchant = true;
		state.waitingForMerchantSince = Date.now();
		game_log('Meltymerch needs me to come to him', '#FFD700');
		smart_move({ x: data.x, y: data.y, map: data.map });
	}
	if (data.message === 'merchant_done') {
		state.waitingForMerchant = false;
		game_log('Merchant business done - resuming', '#00FF00');
	}
}

function on_party_request(name) {
	if (CONFIG.party.groupMembers.includes(name)) {
		console.log('Accepting party request from ' + name);
		accept_party_request(name);
	}
}

function on_party_invite(name) {
	if (CONFIG.party.groupMembers.includes(name)) {
		console.log('Accepting party invite from ' + name);
		accept_party_invite(name);
	}
}

function sendUpdates() {
	if (!parent.$) return;
	parent.socket.emit('send_updates', {});
}
setInterval(sendUpdates, 20000);

/* Tell the party where we are farming.

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
   is still seen as an arrival. */
const FARM_SPOT = {
	burstMs: 5000,
	burstForMs: 60000,
	keepaliveMs: 30000,
	audience: ['FatherToken', 'MageofOz'],
};

let farmSpotLast = null;       // the spot as last announced
let farmSpotSentAt = 0;
let farmSpotBurstUntil = 0;
let farmSpotKnownParty = new Set();

function farmSpotKey() {
	if (!home || !mobMap || !destination) return null;
	return `${home}|${mobMap}|${Math.round(destination.x)}|${Math.round(destination.y)}`;
}

/* Who is in the party that we care about, right now. */
function farmSpotAudienceInParty() {
	const party = (typeof get_party === 'function' ? get_party() : null) || {};
	return new Set(FARM_SPOT.audience.filter((n) => party[n]));
}

function sendFarmSpot(reason) {
	if (!home || !mobMap || !destination) return false;
	plSend(FARM_SPOT.audience, {
		message: 'farm_spot',
		home,
		mobMap,
		x: destination.x,
		y: destination.y,
		also: rageAlso,
		pullConcurrent: rageCfg().concurrent,
	});
	farmSpotLast = farmSpotKey();
	farmSpotSentAt = Date.now();
	if (reason) plLog(`farm spot -> ${reason}`, '#8b98ab');
	return true;
}

function farmSpotTick() {
	const key = farmSpotKey();
	if (!key) return;
	const now = Date.now();

	const present = farmSpotAudienceInParty();
	const joined = [...present].filter((n) => !farmSpotKnownParty.has(n));
	farmSpotKnownParty = present;

	if (key !== farmSpotLast) {
		farmSpotBurstUntil = now + FARM_SPOT.burstForMs;
		sendFarmSpot('spot changed');
		return;
	}
	if (joined.length) {
		farmSpotBurstUntil = now + FARM_SPOT.burstForMs;
		sendFarmSpot(`${joined.join(', ')} joined`);
		return;
	}
	const due = (now < farmSpotBurstUntil) ? FARM_SPOT.burstMs : FARM_SPOT.keepaliveMs;
	if (now - farmSpotSentAt >= due) sendFarmSpot(null);
}

setInterval(farmSpotTick, 1000);

mainLoop();
actionLoop();
skillLoop();
equipmentLoop();
dragold.startScanning();
maintenanceLoop();
potionLoop();
farmSpotTick();
initializeFarmUI();
if (parent.$) {

	(function () {
		if (parent.killTrackerInitialized) return;
		parent.killTrackerInitialized = true;

		let deaths = 0;
		const killTime = new Date();

		game.on('death', function (data) {
			if (parent.entities[data.id]) {
				const mob = parent.entities[data.id];
				const mobName = mob.type;

				if (mobName === 'monster') {
					const mobTarget = mob.target;
					const party = get_party();
					const partyMembers = party ? Object.keys(party) : [];

					if (mobTarget === character.name || partyMembers.includes(mobTarget)) {
						console.log(data);
						deaths++;
						killHandler();
					}
				}
			}
		});

		function killHandler() {
			const elapsed = (new Date() - killTime) / 1000;
			if (elapsed > 0) {
				const deathsPerSec = deaths / elapsed;
				const dailyKillRate = calculateKillRate(deathsPerSec);

				add_top_button("kpm", Math.round(dailyKillRate.kpm).toLocaleString() + ' kpm');
				add_top_button("kph", Math.round(dailyKillRate.kph).toLocaleString() + ' kph');
				add_top_button("kpd", Math.round(dailyKillRate.kpd).toLocaleString() + ' kpd');
			} else {
				console.warn("Elapsed time is zero, cannot calculate rates.");
			}
		}

		function calculateKillRate(deathsPerSec) {
			let kpm = deathsPerSec * 60;
			let kph = kpm * 60;
			let kpd = kph * 24;
			return { kpm, kph, kpd };
		}
	})();

	(function () {
		if (parent.goldMeterInitialized) return;
		parent.goldMeterInitialized = true;

		let sumGold = 0, largestGoldDrop = 0, interval = 'hour';
		const startTime = performance.now();
		const intervals = { minute: 60000, hour: 3600000, day: 86400000 };

		const init = () => {
			const $ = parent.$;
			$('#bottomrightcorner').find('#goldtimer').remove();
			const container = $('<div id="goldtimer"></div>').css({ fontSize: '25px', color: 'white', textAlign: 'center', display: 'table', overflow: 'hidden', marginBottom: '-5px', width: "100%" });
			$('<div id="goldtimercontent"></div>').css({ display: 'table-cell', verticalAlign: 'middle' }).appendTo(container);
			$('#bottomrightcorner').children().first().after(container);

			const countPartyChars = () => {
				let count = 0;
				for (const name in parent.party) {
					if (name === character.name || parent.entities[name]?.owner === character.owner) count++;
				}
				return count;
			};

			character.on("loot", d => {
				if (d.gold && typeof d.gold === 'number' && !Number.isNaN(d.gold)) {
					const myGold = Math.round(d.gold * countPartyChars());
					sumGold += myGold;
					if (myGold > largestGoldDrop) largestGoldDrop = myGold;
				}
			});

			setInterval(() => {
				const elapsed = performance.now() - startTime;
				const divisor = elapsed / intervals[interval];
				const avg = divisor > 0 ? (sumGold / divisor | 0) : 0;
				$('#goldtimercontent').html(`<div>${avg.toLocaleString('en')} Gold/${interval[0].toUpperCase() + interval.slice(1)}</div><div>${largestGoldDrop.toLocaleString('en')} Jackpot</div>`).css({ backgroundColor: 'rgba(0,0,0,1)', border: 'solid gray', borderWidth: '4px 4px', height: '50px', lineHeight: '25px', fontSize: '25px', color: '#FFD700', textAlign: 'center' });
			}, 500);
		};

		const setGoldInterval = i => ['minute', 'hour', 'day'].includes(i) ? interval = i : console.warn("Invalid interval. Use 'minute', 'hour', or 'day'.");
		setTimeout(init, 1000);
	})();

	(function () {
		const FILTERS = {
			kills: { show: false, regex: /killed/, label: 'Kills' },
			gold: { show: true, regex: /gold/, label: 'Gold' },
			party: { show: true, regex: /party/, label: 'Party' },
			items: { show: true, regex: /found/, label: 'Items' },
			upgrade: { show: true, regex: /(upgrade|combination)/, label: 'Upgrades' },
			errors: { show: true, regex: /(error|line|column)/i, label: 'Errors' },
			/* Routine client chatter that says nothing actionable during farming.
			   Off by default, but a tab rather than a hard suppression so each
			   can be read back when it IS the question being debugged.

			     get closer  - emitted on every out-of-range action attempt;
			                   80 of 289 entries in a four-minute sample.
			     AP[...]     - achievement progress. Mostly firehazard, which
			                   wants 20,000 CONSECUTIVE burn last-hits, so a
			                   physical last hit resets it and the line repeats
			                   "1/20,000" forever rather than counting up.
			     scared /    - the courage mechanic. Rangers have base courage 2,
			     terrified     so a third attacker starts fear. Worth seeing
			                   while tuning courage, worth hiding otherwise. */
			noise: { show: false, regex: /get closer|AP\[|scared|terrified/i, label: 'Noise' }
		};

		/* Tabs wrap onto rows of this many instead of being squeezed into one.
		   Each tab is flex 1 1 <basis> rather than a fixed width, so a final
		   short row grows to fill the bar instead of leaving a gap. */
		const TABS_PER_ROW = 4;

		const COLORS = {
			active: ['#151342', '#1D1A5C'],
			inactive: ['#222', '#333'],
			activeText: '#FFF',
			inactiveText: '#999'
		};

		const TRUNCATE_AT = 1000;
		const TRUNCATE_TO = 720;

		function padZero(num, length = 2) {
			return num.toString().padStart(length, '0');
		}

		function getTimestamp() {
			const now = new Date();
			return `${padZero(now.getHours())}:${padZero(now.getMinutes())}:${padZero(now.getSeconds())}`;
		}

		function createFilterBar() {
			const existingBar = parent.document.getElementById('gamelog-tab-bar');
			if (existingBar) existingBar.remove();

			const bar = parent.document.createElement('div');
			bar.id = 'gamelog-tab-bar';
			bar.className = 'enableclicks';
			Object.assign(bar.style, {
				border: '5px solid gray',
				height: 'auto',
				background: 'black',
				margin: '-5px 0',
				display: 'flex',
				flexWrap: 'wrap',
				fontSize: '20px',
				fontFamily: 'pixel'
			});

			Object.entries(FILTERS).forEach(([key, filter], index) => {
				const tab = parent.document.createElement('div');
				tab.id = `gamelog-tab-${key}`;
				tab.className = 'gamelog-tab enableclicks';
				tab.textContent = filter.label;

				const colors = filter.show ? COLORS.active : COLORS.inactive;
				const textColor = filter.show ? COLORS.activeText : COLORS.inactiveText;

				Object.assign(tab.style, {
					height: '24px',
					flex: `1 1 ${100 / TABS_PER_ROW}%`,
					boxSizing: 'border-box',
					textAlign: 'center',
					lineHeight: '24px',
					cursor: 'default',
					background: colors[index % 2],
					color: textColor
				});

				tab.addEventListener('click', () => toggleFilter(key));
				bar.appendChild(tab);
			});

			const gamelog = parent.document.getElementById('gamelog');
			gamelog.parentElement.insertBefore(bar, gamelog);
		}

		function toggleFilter(key) {
			FILTERS[key].show = !FILTERS[key].show;

			const tab = parent.document.getElementById(`gamelog-tab-${key}`);
			const index = Array.from(tab.parentElement.children).indexOf(tab);
			const colors = FILTERS[key].show ? COLORS.active : COLORS.inactive;
			const textColor = FILTERS[key].show ? COLORS.activeText : COLORS.inactiveText;

			tab.style.background = colors[index % 2];
			tab.style.color = textColor;

			filterGamelog();
			scrollGamelogToBottom();
		}

		/* First matching filter decides, and nothing matching means show. Shared by
		   all three callers so the rule cannot drift between them. */
		function shouldShowEntry(text) {
			for (const filter of Object.values(FILTERS)) {
				if (filter.regex.test(text)) return filter.show;
			}
			return true;
		}

		function filterGamelog() {
			const entries = parent.document.querySelectorAll('.gameentry');
			entries.forEach(entry => {
				entry.style.display = shouldShowEntry(entry.innerHTML) ? 'block' : 'none';
			});
		}

		/* Not every line in #gamelog comes through addLogEntry. The socket hook
		   below only replaces the `game_log` listener; the client writes others
		   itself through add_log, and those arrive as .gameentry nodes with no
		   inline display set - which is exactly how "Get closer" was slipping
		   past the filters. They were only ever hidden by filterGamelog(), so
		   they stayed visible until something happened to toggle a tab.

		   Watching for added nodes covers both paths, so the filter bar now
		   governs the whole log rather than only the half this code writes. */
		function observeGamelog() {
			const gamelog = parent.document.getElementById('gamelog');
			if (!gamelog) return;
			if (parent.gamelog_filter_observer) parent.gamelog_filter_observer.disconnect();
			const MO = parent.MutationObserver || MutationObserver;
			const observer = new MO((records) => {
				for (const record of records) {
					for (const node of record.addedNodes) {
						if (node.nodeType !== 1 || !node.classList || !node.classList.contains('gameentry')) continue;
						node.style.display = shouldShowEntry(node.innerHTML) ? 'block' : 'none';
					}
				}
			});
			observer.observe(gamelog, { childList: true });
			parent.gamelog_filter_observer = observer;
		}

		function scrollGamelogToBottom() {
			const gamelog = parent.document.getElementById('gamelog');
			gamelog.scrollTop = gamelog.scrollHeight;
		}

		function addLogEntry(message, color = 'white') {
			if (parent.mode?.dom_tests || parent.inside === 'payments') return;

			const gamelog = parent.document.getElementById('gamelog');

			if (parent.game_logs.length > TRUNCATE_AT) {
				parent.game_logs = parent.game_logs.slice(-TRUNCATE_TO);

				const truncateMsg = "<div class='gameentry' style='color: gray'>- Truncated -</div>";
				const entries = parent.game_logs.map(([msg, clr]) =>
					`<div class='gameentry' style='color: ${clr || 'white'}'>${msg}</div>`
				).join('');

				gamelog.innerHTML = truncateMsg + entries;
			}

			parent.game_logs.push([message, color]);

			const display = shouldShowEntry(message) ? 'block' : 'none';

			const entry = parent.document.createElement('div');
			entry.className = 'gameentry';
			entry.style.color = color;
			entry.style.display = display;
			entry.innerHTML = message;

			gamelog.appendChild(entry);
			scrollGamelogToBottom();
		}

		function initTimestamps() {
			if (parent.socket.hasListeners('game_log')) {
				parent.socket.removeListener('game_log');
			}

			parent.socket.on('game_log', data => {
				parent.draw_trigger(() => {
					const timestamp = getTimestamp();

					if (typeof data === 'string') {
						addLogEntry(`${timestamp} | ${data}`, 'gray');
					} else {
						if (data.sound) sfx(data.sound);
						addLogEntry(`${timestamp} | ${data.message}`, data.color);
					}
				});
			});
		}

		createFilterBar();
		filterGamelog();
		observeGamelog();
		initTimestamps();
	})();

	(function () {
		const damageTypes = ["Base", "Blast", "HPS", "DPS"];
		let displayClassTypeColors = true, displayDamageTypeColors = true, showOverheal = false, showOverManasteal = true;

		const damageTypeColors = { Base: '#A92000', Blast: '#782D33', Burn: '#FF7F27', HPS: '#9A1D27', MPS: '#353C9C', DR: '#E94959', RF: '#D880F0', DPS: '#FFD700', "Dmg Taken": '#FF4C4C' };
		const classColors = { mage: '#3FC7EB', paladin: '#F48CBA', priest: '#FFFFFF', ranger: '#AAD372', rogue: '#FFF468', warrior: '#C69B6D' };

		const METER_START = performance.now();
		const playerData = {};

		const getEntry = id => playerData[id] || (playerData[id] = { t: performance.now(), bD: 0, blD: 0, baD: 0, h: 0, m: 0, dr: 0, rf: 0, dtP: 0, dtM: 0 });

		const fmt = v => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

		parent.$('#bottomrightcorner').find('#dpsmeter').remove();
		const container = parent.$("<div id='dpsmeter'></div>").css({ fontSize: '20px', color: 'white', textAlign: 'center', display: 'table', overflow: 'hidden', marginBottom: '-3px', width: '100%', backgroundColor: 'rgba(0,0,0,1)' });
		container.append(parent.$("<div id='dpsmetercontent'></div>").css({ display: 'table-cell', verticalAlign: 'middle', padding: '2px', border: '4px solid grey' }));
		parent.$('#bottomrightcorner').children().first().after(container);

		/* Replace OUR previous 'hit' listener, and survive any that outlived us.

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
		   CODE reload cannot reach them. */
		if (parent.dps_hit_handler) parent.socket.removeListener('hit', parent.dps_hit_handler);
		const onHit = d => {
			if (!parent || !parent.party_list) return;
			const inParty = id => parent.party_list.includes(id);
			if (!inParty(d.hid) && !inParty(d.id)) return;

			try {
				const dmg = d.damage || 0, isPlayer = get_player(d.id), isAttacker = get_player(d.hid);

				if (dmg && isPlayer) {
					const e = getEntry(d.id);
					d.damage_type === 'physical' ? e.dtP += dmg : e.dtM += dmg;
				}
				if (d.dreturn && isAttacker) getEntry(d.hid).dtP += d.dreturn;
				if (d.reflect && isAttacker) getEntry(d.hid).dtM += d.reflect;

				if (d.dreturn && isPlayer && !get_player(d.hid)) getEntry(d.id).dr += d.dreturn;
				if (d.reflect && isPlayer && !get_player(d.hid)) getEntry(d.id).rf += d.reflect;

				if (isAttacker) {
					const e = getEntry(d.hid);

					if (dmg) {
						d.source === 'burn' ? e.bD += dmg : d.splash ? e.blD += dmg : e.baD += dmg;
					}

					if (d.heal || d.lifesteal) {
						const target = get_player(d.id);
						e.h += showOverheal ? (d.heal || 0) + (d.lifesteal || 0) :
							(d.heal ? Math.min(d.heal, (target?.max_hp || 0) - (target?.hp || 0)) : 0) +
							(d.lifesteal ? Math.min(d.lifesteal, isAttacker.max_hp - isAttacker.hp) : 0);
					}

					if (d.manasteal) {
						e.m += showOverManasteal ? d.manasteal : Math.min(d.manasteal, isAttacker.max_mp - isAttacker.mp);
					}
				}
			} catch (err) {
				console.error('hit handler error', err);
			}
		};
		parent.dps_hit_handler = onHit;
		parent.socket.on('hit', onHit);

		const calcVal = (type, e, elapsed) => {
			const r = 1000 / elapsed;
			const vals = {
				DPS: (e.baD + e.blD + e.bD + e.dr + e.rf) * r,
				Burn: e.bD * r,
				Blast: e.blD * r,
				Base: e.baD * r,
				HPS: e.h * r,
				MPS: e.m * r,
				DR: e.dr * r,
				RF: e.rf * r,
				'Dmg Taken': { phys: e.dtP * r | 0, mag: e.dtM * r | 0 }
			};
			return type === 'Dmg Taken' ? vals[type] : vals[type] | 0;
		};

		setInterval(() => {
			const $ = parent.$, c = $('#dpsmetercontent');
			if (!c.length) return;

			const now = performance.now(), elapsed = now - METER_START;
			const hrs = elapsed / 3600000 | 0, mins = (elapsed % 3600000) / 60000 | 0;

			let html = `<div>👑 Elapsed Time: ${hrs}h ${mins}m 👑</div><table border="1" style="width:100%"><tr><th></th>`;
			damageTypes.forEach(t => html += `<th style='color:${displayDamageTypeColors ? damageTypeColors[t] || 'white' : 'white'}'>${t}</th>`);
			html += '</tr>';

			const sorted = Object.entries(playerData).map(([id, e]) => ({ id, e, dps: calcVal('DPS', e, now - e.t) })).sort((a, b) => b.dps - a.dps);

			sorted.forEach(({ id, e }) => {
				const p = get_player(id);
				if (!p) return;
				html += `<tr><td style='color:${displayClassTypeColors ? classColors[p.ctype.toLowerCase()] || '#FFF' : '#FFF'}'>${p.name}</td>`;
				damageTypes.forEach(t => {
					const v = calcVal(t, e, now - e.t);
					html += t === 'Dmg Taken' ? `<td><span style='color:#F44'>${fmt(v.phys)}</span> | <span style='color:#6CF'>${fmt(v.mag)}</span></td>` : `<td>${fmt(v)}</td>`;
				});
				html += '</tr>';
			});

			html += `<tr><td style='color:${damageTypeColors.DPS}'>Total DPS</td>`;
			damageTypes.forEach(t => {
				if (t === 'Dmg Taken') {
					let totP = 0, totM = 0;
					Object.values(playerData).forEach(e => {
						const v = calcVal(t, e, now - e.t);
						totP += v.phys; totM += v.mag;
					});
					html += `<td><span style='color:#F44'>${fmt(totP)}</span> | <span style='color:#6CF'>${fmt(totM)}</span></td>`;
				} else {
					let tot = 0;
					Object.values(playerData).forEach(e => tot += calcVal(t, e, now - e.t));
					html += `<td>${fmt(tot)}</td>`;
				}
			});
			html += '</tr></table>';
			c.html(html);
		}, 250);
	})();

	(function () {
		if (parent.party_style_prepared) parent.$('#style-party-frames').remove();

		parent.$('head').append(`<style id="style-party-frames">
.party-container {position: absolute; top: 55px; right: 0; width: 1000px; height: 300px; font-family: 'pixel';}
</style>`);
		parent.party_style_prepared = true;

		const DISPLAY_BARS = ['hp', 'mp', 'xp', 'xprate', 'xpeta'];
		const FRAME_WIDTH = 80;
		const INCLUDE = ['mp', 'max_mp', 'hp', 'max_hp', 'name', 'max_xp', 'xp', 'level', 'share', 'cc', 'max_cc'];
		const SHOW_IMG = true;

		const extractInfo = (char) => {
			const info = {};
			for (const key of INCLUDE) if (key in char) info[key] = char[key];
			for (const key of character.read_only) if (key in char) info[key] = char[key];
			return info;
		};

		setInterval(() => set(character.name + '_newparty_info', { ...extractInfo(character), lastSeen: Date.now() }), 200);

		const getIFramedChar = (name) => {
			for (const iframe of top.$('iframe')) {
				const char = iframe.contentWindow.character;
				if (char?.name === name) return char;
			}
		};

		/* `text` is the label. Pass an empty string for a bare row - the xp rate and
		   its ETA are self-describing ("22.9M xp/hr"), and at 78px of frame a
		   redundant "XP/HR: " prefix is what pushed the line past the edge.
		   `fontSize` defaults to the 17px the stat bars use; the two xp rows ask
		   for less so the whole string fits inside the frame. */
		const barHTML = (text, val, width, color, fontSize) =>
			`<div style="position:relative;width:100%;height:${fontSize ? 16 : 20}px;text-align:center;margin-top:3px;">
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:bold;font-size:${fontSize || 17}px;z-index:1;white-space:nowrap;text-shadow:-1px 0 black,0 2px black,2px 0 black,0 -1px black;">${text ? text + ': ' : ''}${val}</div>
<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-color:${color};width:${width}%;height:${fontSize ? 16 : 20}px;border:1px solid grey;"></div>
</div>`;

		const XP_SAMPLE_INTERVAL_MS = 5000;
		const XP_WINDOW_MS = 5 * 60 * 1000;
		const xpHistory = new Map();

		function updateXpHistory(name, info) {
			if (!info || info.xp === undefined || info.level === undefined) return null;
			const now = Date.now();
			const hist = xpHistory.get(name) || [];
			const last = hist[hist.length - 1];
			if (!last || now - last.t >= XP_SAMPLE_INTERVAL_MS) {
				hist.push({ t: now, xp: info.xp, level: info.level });
				while (hist.length && now - hist[0].t > XP_WINDOW_MS) hist.shift();
				xpHistory.set(name, hist);
			}
			return hist;
		}

		function xpGainedBetween(oldSample, newSample) {
			if (newSample.level <= oldSample.level) return newSample.xp - oldSample.xp;
			let total = (G.levels[oldSample.level] || 0) - oldSample.xp;
			for (let lvl = oldSample.level + 1; lvl < newSample.level; lvl++) total += G.levels[lvl] || 0;
			return total + newSample.xp;
		}

		function formatXpRate(xpPerHour) {
			if (xpPerHour <= 0) return '0 xp/hr';
			if (xpPerHour >= 1000000) return (xpPerHour / 1000000).toFixed(1) + 'M xp/hr';
			if (xpPerHour >= 1000) return (xpPerHour / 1000).toFixed(1) + 'k xp/hr';
			return Math.round(xpPerHour) + ' xp/hr';
		}

		function formatDuration(hours) {
			if (!isFinite(hours) || hours < 0) return '—';
			if (hours < 1) return Math.round(hours * 60) + 'm';
			if (hours < 48) return hours.toFixed(1) + 'h';
			return Math.round(hours / 24) + 'd';
		}

		function computeXpRateAndEta(name, info) {
			const hist = updateXpHistory(name, info);
			if (!hist || hist.length < 2) return { rateStr: '—', etaStr: '—' };

			const oldest = hist[0];
			const newest = hist[hist.length - 1];
			const elapsedSec = (newest.t - oldest.t) / 1000;
			if (elapsedSec < 10) return { rateStr: '—', etaStr: '—' };

			const gained = xpGainedBetween(oldest, newest);
			const xpPerHour = (gained / elapsedSec) * 3600;
			const rateStr = formatXpRate(xpPerHour);

			let etaStr = '—';
			if (xpPerHour > 0 && typeof G !== 'undefined' && G.levels) {
				const xpNeeded = (G.levels[info.level] || 0) - info.xp;
				etaStr = formatDuration(xpNeeded / xpPerHour);
			}
			return { rateStr, etaStr };
		}

		const barConfigs = {
			hp: { color: 'red', calc: (i) => ({ val: i.hp, width: i.hp / i.max_hp * 100 }) },
			mp: { color: 'blue', calc: (i) => ({ val: i.mp, width: i.mp / i.max_mp * 100 }) },
			xp: {
				color: 'green', calc: (i) => {
					const pct = i.xp / G.levels[i.level] * 100;
					return { val: pct.toFixed(2) + '%', width: pct };
				}
			},
			/* Two rows, not one. computeXpRateAndEta samples history on a timer, so
			   calling it twice a tick would be wasteful and could skew the window;
			   the render loop computes it once and passes it in as `xp`. */
			xprate: {
				color: 'purple', label: '',
				calc: (i, partyData, xp) => {
					if (!xp) return { val: '??', width: 0 };
					return { val: xp.rateStr, width: 0 };
				}
			},
			xpeta: {
				color: 'purple', label: '',
				calc: (i, partyData, xp) => {
					if (!xp) return { val: '??', width: 0 };
					return { val: `next ${xp.etaStr}`, width: 0 };
				}
			},
			cc: { color: 'grey', calc: (i) => ({ val: i.cc?.toFixed(2) ?? i.cc, width: i.cc / (i.max_cc || 200) * 100 }) },
			ping: { color: 'black', calc: () => ({ val: character.ping?.toFixed(0) ?? '??', width: 0 }) },
			share: {
				color: 'teal', calc: (i, partyData) => {
					const share = partyData?.share;
					return share != null ? { val: (share * 100).toFixed(2) + '%', width: share * 300 } : { val: '??', width: 0 };
				}
			}
		};

		/* Left-align the party block under the R&M button.

		   The game does not position #newparty at all - it ships as a static
		   inline-block. WE position it: `.party-container` above sets
		   `position: absolute; right: 0; width: 1000px`, and the render loop
		   applies that class with addClass() immediately before calling in here.
		   So the right-anchoring that pinned the block to the viewport edge -
		   pushing the rightmost frame's text to 1734 against a 1718 viewport -
		   is ours, and so is the fix.

		   (An earlier draft of this comment blamed "the game's own id rule".
		   There is no such rule; the measurement matched .party-container
		   exactly. Left in the record because a false claim about the DOM, sitting
		   in the file, reads as documentation - the same reason the dead
		   `#toprightcorner > .codebuttons` branch was deleted rather than kept.)

		   Written inline because inline beats the class rule we just applied,
		   which is what otherwise holds `right: 0` and `width: 1000px`.

		   The anchor is read from the live button rather than hard-coded: the
		   toolbar is itself right-anchored, so R&M's x moves with the window and
		   any fixed number would be wrong at another size. If the button cannot
		   be found the block is left exactly where it was - a misaligned panel
		   beats one flung off screen. */
		let rmButton = null;
		const findRmButton = () => {
			if (rmButton && rmButton.isConnected) return rmButton;
			rmButton = null;
			parent.$('#toprightcorner *').each((i, el) => {
				if (rmButton || el.children.length) return;
				if (/^\s*R&M\s*$/.test(el.textContent || '')) rmButton = el;
			});
			return rmButton;
		};

		/* Only align a POSITIONED #newparty, and say so once if it is not.

		   This rests on #newparty being out of normal flow. It is inside
		   #toprightcorner, which is `position: fixed; right: 0` with auto width -
		   so its width is the widest of its IN-FLOW children. If #newparty were
		   static, writing `width` here would widen that container, which extends
		   leftward, which moves R&M, which changes the anchor we just read, which
		   writes a new width: a 250ms oscillation. And `left`/`right` would be
		   ignored outright, so the alignment could not work anyway.

		   What makes it positioned is our own `.party-container`, applied by the
		   render loop two lines before this runs - not anything the game does.
		   That is a dependency on our own style block having injected, so it is
		   worth checking rather than assuming: if `<style id="style-party-frames">`
		   is ever removed, desynced via party_style_prepared, or refactored away,
		   the class goes inert and #newparty falls back to the static inline-block
		   the game ships. Reading the computed value catches exactly that -
		   positioned, align; static, decline and say so once - instead of writing
		   a width into an in-flow element and starting the oscillation above. */
		let alignChecked = false;
		const partyFrameIsPositioned = (partyFrame) => {
			const pos = parent.getComputedStyle(partyFrame[0]).position;
			if (pos !== 'static') return true;
			if (!alignChecked) {
				alignChecked = true;
				game_log('Party frames: #newparty is position:static - not aligning (left/right would be ignored and width could move the toolbar)', 'orange');
			}
			return false;
		};

		/* Distance from `el` to `ancestor` in CSS pixels, by walking offsetParent.

		   NOT getBoundingClientRect(). The game UI is scaled - measured at 0.7502
		   on this client - so rects come back in device pixels while `left` and
		   `width` are interpreted as CSS pixels. Mixing the two was wrong twice
		   over: rect.left is also viewport-relative, while `left` on a positioned
		   element is relative to its offsetParent. Reading R&M's rect.left of 901
		   and writing `left: 901px` put the block 297 CSS px right of where it
		   belonged, because the true offset within #toprightcorner is 604.
		   offsetLeft is already CSS px and already relative to offsetParent, so
		   accumulating it needs no origin correction and no scale factor, and
		   cannot drift if the client's scale changes. */
		const offsetLeftWithin = (el, ancestor) => {
			let x = 0, node = el;
			while (node && node !== ancestor) { x += node.offsetLeft; node = node.offsetParent; }
			return node === ancestor ? x : null;
		};

		const alignPartyFrames = (partyFrame, count) => {
			const rm = findRmButton();
			if (!rm || !count) return;
			if (!partyFrameIsPositioned(partyFrame)) return;

			const np = partyFrame[0];
			const anchorBox = np.offsetParent;
			if (!anchorBox) return;

			/* Both measured against the SAME offsetParent, or not at all: if R&M
			   is not inside it the two numbers are in different coordinate spaces
			   and subtracting them would be meaningless. */
			const rmLeft = offsetLeftWithin(rm, anchorBox);
			if (rmLeft === null || !isFinite(rmLeft)) return;

			/* One row, always. The previous width was pitch * count computed from
			   device-pixel rects, which at 0.75 scale came out ~25% short - 327 CSS
			   px for four 104px cells - and the fourth member wrapped onto a second
			   row. max-content plus nowrap lets the row size itself, so there is no
			   arithmetic left to get wrong and no count at which it silently wraps. */
			if (partyFrame.data('alignedTo') === rmLeft && partyFrame.data('alignedN') === count) return;
			partyFrame.css({ left: rmLeft + 'px', right: 'auto', width: 'max-content', 'white-space': 'nowrap' });

			/* Second pass: whatever inset the first cell has once it is laid out on
			   one row, take it off, so the FIRST member's frame is flush with R&M
			   rather than the container's padding edge. Measured after the write
			   because the inset is a product of that layout - it reads 5 while the
			   block is wrapped and 0 once it is not, and subtracting the stale one
			   overshoots by exactly that much. */
			np.offsetWidth;
			const inset = np.children[0] ? np.children[0].offsetLeft : 0;
			if (inset) partyFrame.css('left', (rmLeft - inset) + 'px');

			partyFrame.data('alignedTo', rmLeft).data('alignedN', count);
		};

		setInterval(() => {
			const partyFrame = parent.$('#newparty').addClass('party-container');
			if (!partyFrame.length) return;

			/* The merchant gets no frame. It is excluded by CLASS rather than by
			   name, so it keeps working if the merchant is renamed or replaced,
			   and it does not quietly hide a second character who happens to
			   share the name. The game builds one cell per party member in
			   member order, so the cell is hidden in place and the count passed
			   to alignPartyFrames is the count of VISIBLE cells - otherwise the
			   row would be sized for a frame that is not drawn. */
			const members = Object.keys(parent.party);
			const frameHidden = (name) => ((parent.party[name] || {}).type === 'merchant');
			alignPartyFrames(partyFrame, members.filter((n) => !frameHidden(n)).length);
			partyFrame.children().each((x, el) => {
				const name = members[x];
				parent.$(el).toggle(!frameHidden(name));
				if (frameHidden(name)) return;
				let info = get(name + '_newparty_info');

				if (!info || Date.now() - info.lastSeen > 1000) {
					const iframed = getIFramedChar(name);
					info = iframed ? extractInfo(iframed) : (get_player(name) || { name });
				}

				const partyData = parent.party[name];
				let html = `<div style="width:${FRAME_WIDTH}px;height:20px;margin-top:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${info.name}</div>`;

				const xp = (info && info.name !== undefined && info.xp !== undefined && info.level !== undefined)
					? computeXpRateAndEta(info.name, info)
					: null;

				for (const key of DISPLAY_BARS) {
					const cfg = barConfigs[key];
					const { val, width } = cfg.calc(info, partyData, xp);
					if (val !== undefined && val !== '??') {
						/* label may be deliberately empty - only fall back to the key
						   when the config never declared one. */
						const label = cfg.label === undefined ? key.toUpperCase() : cfg.label;
						html += barHTML(label, val, width, cfg.color, cfg.fontSize);
					}
				}

				parent.$(el).children().first().css('display', SHOW_IMG ? 'inherit' : 'none');
				parent.$(el).children().last().html(`<div style="font-size:22px;" onclick='pcs(event);party_click("${name}");'>${html}</div>`);
			});
		}, 250);

		parent.$('#party-props-toggles').remove();
	})();

}

