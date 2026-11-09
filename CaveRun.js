// CaveRun.js - one script for Dexon / FatherToken / MageofOz - v37 (TEST BUILD)
// v37 2026-11-09 THE OPERATOR'S CRYPT RULINGS OF 2026-11-08 19:49-20:12 EST.
//                The bats are the point of the run. The route from the entrance
//                to them is protected: a zone monster seen outside the zone now
//                blocks only the ground around it, never that route or the bat
//                box. Nobody stands in the box or walks through it: the bat spot
//                moves north of it to (950,-500), and Dexon pulls one bat at a
//                time from his full range while the others wait there. a8 is
//                never kited or attacked - the mage scares it off herself, and
//                when it is on anyone else the party backs off west along the
//                route; the bats wait while a8 is near them, for up to 5 min.
//                Resting ends the moment something is on the party. A member in
//                a death loop walks back by itself once the route is clear.
//                With no way past a2's 300, the mage re-scares or blinks.
//                A death is put down to the strongest monster on the member.
// v36 2026-11-09 THE OPERATOR'S CRYPT RULINGS OF 2026-11-08 19:16-19:39 EST.
//                The priest decides each absorb from hp: at once if the member
//                a2 is on will not last until his next anger tick and the
//                priest will, or to soak the window when that member is clearly
//                the lowest and the priest clearly healthier - never when the
//                priest would not last himself, nor while the mage can escape
//                him. Every member sends its loot straight to Meltymerch
//                whenever he is in send range, Dexon still the fallback. When
//                a run is done and the leader holds no cryptkey, all three hand
//                back to their character slots. The party rests to near full
//                before each stage, and before a2 the scare holder needs mp for
//                one scare. Each run writes a CRYPT DUMP row to the game log,
//                and each a2 target switch is logged with anger.ms and every
//                member's distance.
// v35 2026-11-09 THE SECOND LIVE CRYPT RUN'S DEFECTS AND THE OPERATOR'S a2
//                RULINGS. A member respawned in a crypt run rests at the
//                entrance and rejoins only onto a stationary leader out of
//                combat; a death loop holds there until collected, and the
//                leader comes for it. Every awaited call in tick() is bounded,
//                and a watchdog restarts a stalled tick loop with a red line.
//                The search clock counts only while the party is actually
//                searching. a2: the member he is on scares right after an
//                anger tick (or the mage blinks just before one) and gets past
//                the 300 anger radius - alone, or the whole party when its hp
//                is low, re-engaging once healed with the mage opening; the
//                priest keeps him cursed and absorbs him off the lowest member
//                right after a tick; each member stands at its own range on
//                the priest's side. The pull no longer stops at 40%.
// v34 2026-11-08 THE FIRST LIVE CRYPT RUN'S DEFECTS AND THE OPERATOR'S RULINGS.
//                The crypt map is now the server grid's LEVEL-0 cells only -
//                levels 1-7 are cells past a wall, which is why (1470,-1400)
//                was a sealed pocket. A stage target not in view is searched
//                for over a tour of that map, from where any member last saw
//                it or died to it first, avoiding other monsters, the no-go
//                zone (x>1850, y>-1235, grown by sightings of a8/a5/a4/a1) and
//                the far side of the line; one not found in 5 min is given up
//                and the run moves on, and one that reappears is taken back.
//                a2 is pulled to (-270,-465) with no follower hold on the way;
//                the leader never holds through a fight, and a gap hold gives
//                up after 20s. The stray line moves to x 1860. A stationary
//                leader, out of combat, is joined ON HIS SPOT by the followers
//                - cave and crypt. A re-sent walk no longer reports itself as
//                an interruption.
// v33 2026-11-08 crypt_auto LAPSES 2 HOURS AFTER THE LAST CRYPT TICK, so a
//                crypt run left on cannot turn a later cave day in slot 11 into
//                crypt mode; a lapsed one says so on load. cryptNew() abandons
//                the current instance - a run not marked done is resumed, and
//                no new key is spent while it stands.
// v32 2026-11-08 THE CRYPT RUN - the operator's spec of 2026-11-08. cryptRun()
//                on the leader starts all three: at the crypt door the party
//                waits for mluck (Dexon asks Meltymerch), a cryptkey in the
//                leader's bag and Dexon's room; the leader opens the instance
//                and publishes its id, and the others enter it. A death holds
//                the instance; after a wipe the leader respawns last and the
//                party regroups at the entrance. The leader drives a3/a7, then
//                a2 (pulled back to the hall), then the vbat; a stray is walked
//                right of the line by the one it is on, who then towns. Absorb
//                and scare only for a2 on someone low. After a run the loot goes
//                to Dexon and the next run opens. caveCrypt() is unchanged.
// v31 2026-10-30 THE HAND-BACK ENGAGES THE MAIN SLOT, NOT ONLY RUNS IT. The
//                runner's load_code() evaluates a slot inside this iframe and
//                leaves the page's engaged slot on the Cave slot, so every later
//                hop reloaded CaveRun for its 20s launcher. handBack() now also
//                loads the character slot into the editor and persists it as
//                the engaged slot, then checks get_code_slot() and logs either way.
// v30 2026-10-25 THE SHARED GAMELOG BLOCK IS v4 - nothing else changed. The minute
//                row's gold reads "own share of loot gold". See Party/RangerChangelog.md, v154.
// v29 2026-10-25 THE SHARED GAMELOG BLOCK IS v3 - nothing else changed. A kill
//                counts only on the killer's own minute row, because every party
//                member receives the broadcast. See Party/RangerChangelog.md, v153.
// v28 2026-10-25 THE SHARED GAMELOG BLOCK IS v2 - nothing else changed. The
//                game-log FILE takes the pathfinder lines and the game's kill
//                and gold lines as one summary row a minute, and a page state
//                from an older build is rebuilt on load. The screen is as it
//                was. See Party/RangerChangelog.md, v152.
// v27 2026-10-24 THE CAVE LEADER DRIVES ITSELF - the operator's ruling: "a
//                change in method for cave from leader manually driven to a
//                fully automated cave run". navPlan() reads the floor's
//                required rooms from character.cave, orders them by the
//                cheapest walk ending at the stairs, and smart_moves the leader
//                to each one at the objective's own x/y - the call the
//                objective buttons make. At a room it pulls the monsters or
//                walks to the NPC so the vote opens, sees the room through,
//                then takes the stairs (chests first, up to 20s).
//                In order: the party first (healer dead or two dead -> the
//                landing; a member waiting -> go and collect it; a member dead
//                or resting -> no new objectives), then whatever attacks, an
//                escort (walked to the stairs), an open vote, the room under
//                way, the Loaded Die (inserted into the route where it costs
//                least, under 2 min and the run's slack; "die skipped - why"
//                logged), a camp wave already under way nearby (only if the
//                clock allows, freely after the last seal), an unopened shop
//                or revealed room close to the route, the next required room,
//                the stairs. After the last seal: camp waves and encounters
//                by Amber per second while they fit, then leave; the
//                followers leave when the leader's beacon says so.
//                The followers' half: healer dead or two dead pulls them back
//                to the landing, and a leader in a death loop is walked to and
//                collected rather than held off (his loop ends once every
//                living follower is beside him). A smart_move the autopilot did not make
//                pauses it 45s; caveNav(false) hands the leader back to the
//                operator, caveNavStatus() shows the plan. Path lengths are
//                straight line x 1.5 at the leader's speed, logged against
//                the measured time per leg (navLeg) to be refined.
// v26 2026-10-24 CAVERUN IS A LAUNCHER, THE DIE IS RETRIED, DEATHS REGROUP -
//                the operator's rulings relayed in the 12:22 EDT block.
//                LAUNCHER: on load outside the cave each character asks the
//                server (interaction `info`) whether today's visit is spent.
//                Open: restock and walk to Dorr on its own, no 'go' needed.
//                Spent: hand back to the main script after 20s (caveStay()
//                keeps CaveRun). A reload of the Cave slot therefore does the
//                right thing either way. Leaving the cave - our exit or the
//                clock - writes one CAVE DUMP row to the game log file and loads
//                this character's own slot by name.
//                EXIT now waits for the Amber cap, the last minute or
//                caveExit(); the time after the last seal is for farming.
//                VOTES read G.events.dreams.encounters live when it is there,
//                the copy otherwise. REVIVE HERE is voted for the healer, a
//                repeat death, a short clock or a long walk back, inside 2
//                Amber per character, and a dead character waits for that vote
//                instead of respawning at the doorway first.
//                DIE: any character beside an unsold die shop with the purse
//                to pay buys it; the leader says when it is affordable but out
//                of reach, because the detour is the operator's to walk.
//                REGROUP: a death holds the leader with no 20s give-up (moves
//                back toward the stranded member pass); a respawned character
//                rests at the landing, then rejoins unless hostiles are in
//                view; a dead or resting leader is not chased; two deaths in 5
//                minutes is a death loop that holds at the landing until
//                collected or caveResume(). Every death logs where, fear,
//                attackers and seconds from 90% hp.
// v25 2026-10-24 THE PARTY VOTES, BUYS THE DIE, LEAVES AND STOPS HITTING
//                FRIENDS - the operator's cave rulings of 2026-10-24.
//                VOTES: the leader votes every encounter it knows the moment it
//                opens, from a copy of design/events.js (upstream 16881a2) scored
//                in Amber - see the vote block. An encounter or option not in
//                that copy is logged as UNKNOWN EVENT and nobody votes; the
//                operator has the 60s and any vote he makes on any character is
//                echoed by the other two (the echo used to follow the leader
//                only). A 10,000 cave-gold reserve is held for a merchant's Loaded
//                Die until the third floor's encounter is done, and the die is
//                bought whenever a shop shows one. caveVotePreview() shows what
//                the open vote would pick and why.
//                TARGETS: anything whose cave side is neutral, ally or victim is
//                skipped - the 2026-10-23 run spent 2,394 of Dexon's attacks on
//                one friendly Counterweight Sentinel - and a friendly_target
//                refusal benches the id for 10s in case a side never arrives.
//                EXIT: once every required third-floor room is done and this
//                map's chests are gone (90s cap), each character leaves; the
//                same run sat six idle minutes before. Hand-back to the main
//                slot ships empty until load_code() is measured on a character
//                slot. The leader hold no longer runs outside an active run.
// v24 2026-10-24 EVERY GAME LOG LINE GOES TO A FILE ON THE BRIDGE - the shared
//                GAMELOG block, byte-identical in the four party scripts, so a
//                cave run is no longer a gap in the file. gamelogStatus() on
//                the console.
// v23 2026-10-24 FATHERTOKEN IS THE DEFAULT CAVE LEADER, ON THE OPERATOR'S RULING:
//                "defaults for cave going forward should be FatherToken as the
//                leader. This should apply to all modes. He is middle in speed
//                and the tankiest character so best to first engage." He has
//                led only because the shared cave_leader key was set by hand,
//                so clearing site data reverted the party to Dexon. One
//                constant: leaderName() is the only reader, and every mode -
//                travel, combat, crypt, dry run - asks it. caveLead() still
//                overrides it per browser.
// v22 2026-10-22 LEADER MOTION PICKS THE DISTANCES, THE BAND'S OWN GEOMETRY
//                PICKS THE KITE RULE - item 1, with the decoupling the handoff
//                asked for and one correction it did not anticipate.
//                THE SELECTOR ASKED NOTHING ABOUT THE LEADER until now, which
//                is the third sighting of the wrong-actor shape. Caught live:
//                leader STATIONARY, Dexon 171u away, recovering false, moving
//                false, closeAt 180, nobody objecting to 171. On open ground
//                doing nothing engagedNow was TRUE all session, so the travel
//                band never applied at all.
//                ITEM 1 AS SPECIFIED WOULD HAVE REINSTATED ITEM 2 THROUGH THE
//                BACK DOOR, and that is the part worth reading twice. "A
//                stationary leader uses the TRAVEL band regardless of follower
//                engagement" - but travel carries the UNCONDITIONAL no-ratchet,
//                and that is exactly the retreat freedom the operator just
//                protected ("it also protects the followers ability to kite
//                while in combat"). An engaged follower beside a parked leader
//                would have lost it. So the stationary case gets its OWN pair,
//                90/30, and cannot borrow travel's.
//                90 IS FORCED, NOT CHOSEN. The oscillation invariant is
//                `releaseAt + kiteStep > closeAt` while the no-ratchet is
//                conditional, so any band that KEEPS the retreat must be at
//                least kiteStep (55) wide: 30 + 55 = 85, and 90 is the round
//                number above it. The operator may move it; the constraint
//                travels with it, and the suite asserts it over every band the
//                selector can return rather than over three hand-checked pairs.
//                AND THE KITE RULE IS NOW DERIVED FROM GEOMETRY RATHER THAN
//                FROM THE MODE LABEL. `L.mode === 'travel'` tied it to the
//                band's NAME, which was correct with two bands and wrong the
//                moment a third existed. noRatchetAlways(L) asks the question
//                the invariant actually poses, reproduces BOTH shipped answers
//                exactly - combat 175 <= 180 conditional, travel 85 > 60
//                unconditional - and gives the right answer for any band added
//                later. "The tight band and the unconditional no-ratchet are
//                ONE change rather than two" is this file's own phrasing; it is
//                one expression now.
//                THE LEADER NOTES ITS OWN MOTION, because it returns from
//                moveTick before noteLeaderMotion and would otherwise report
//                the stationary band forever. Nothing acts on the leader's
//                leash - the hold reads MOVE.* directly - but caveLeash()
//                reports it, and a probe that lies is this file's most
//                expensive recurring cost.
//                TWO SUITE ASSERTIONS WERE REWRITTEN RATHER THAN DELETED, and
//                the distinction from the item-2 episode is stated in the test
//                itself: there an assertion encoded an operator RULING and the
//                change removed a freedom; here it encoded a MECHANISM, the
//                behaviour is identical, and the equivalence is asserted rather
//                than claimed. Unscored, like v21 - no run has seen 90/30.
// v21 2026-10-22 FOLLOWERS START ON LEADER MOTION - item 3 of the three
//                proposed changes, and the only one the kiting ruling never
//                touched. `closeAt / leaderSpeed + tickMs/2` IS the follower's
//                reaction delay - measured 957ms and 926ms at closeAt 60,
//                IDENTICAL across two characters of different resting speed
//                because it is the LEADER's speed that sets it - so at the
//                committed closeAt 180 a follower stands still for 2.9s. He is
//                not reacting late: waiting for closeAt IS his trigger. This
//                adds an earlier one and moves closeAt not at all.
//                INFERRED, because leaderPos() returns {x,y} with no `moving`
//                flag: noteLeaderMotion() differences successive readings and
//                leaderMoving() is a 750ms recency window. THE DEGENERATE
//                READING IS THE SAFE ONE - a frozen party row or an expired
//                beacon does not change, so it reads NOT moving and the leash
//                band behaves exactly as before. That is why leaderPos()'s own
//                staleness handling is not duplicated here.
//                followStep() IS LIGHTER THAN recoverStep IN EVERY WAY THAT
//                MATTERS, each deliberate: no `recovering` latch, which is
//                uninterruptible and stops kiting AND looting (the run measured
//                lootOutOfRange ~1030 against ~15 lootCalls, so a second route
//                into that state is the last thing to add); no smart_move, so
//                it cannot leave an unsettled promise and blocked is simply a
//                no-op with the latch at closeAt still the fallback; and it
//                aims at the LIVE leader point rather than recoverStep's cached
//                `aim`, which gets staleSlack's measured tightening here
//                without moving staleSlack and changing recoverStep too.
//                PLACED LAST, AFTER THE KITE BRANCHES, so kiting keeps absolute
//                priority - the operator's ruling is that kite range is normal
//                in combat and "it also protects the followers ability to kite
//                while in combat". This fills only the branch where a follower
//                previously did NOTHING: no kite wanted, no threat in range,
//                and the gap opening because the leader walked off. The
//                ordering is asserted on the source text, not on an outcome.
//                NOT SCORED YET. motionEps 4 is derived (the leader covers ~15u
//                per 250ms tick at a resting 62) and motionMs 750 spans three
//                ticks so a smart_move pause is not a stop, but no run has
//                measured either. followSteps / followBlocked are on the
//                counters for that. Landed ALONE, with item 1 held back, so
//                neither change can look proven by the other's work.
// v20 2026-10-21 THE "A FOLLOWER CANNOT CONVERGE ON A FASTER LEADER" CLAIM IS
//                SCOPED TO A LEADER WE NO LONGER USE, AND ALL THREE SITES NOW
//                SAY SO. Comment-only. The claim is asserted three times and
//                all three rest on ONE measurement, at :102 - "2026-10-06:
//                Dexon 74 speed, FatherToken 59, MageofOz 55 ... driving Dexon
//                gave closing rates of -15 and -19 u/s". Its own conclusion is
//                "Drive the priest", THE OPERATOR DID, and FatherToken has led
//                ever since - so the measurement that establishes the claim was
//                taken in the configuration it was written to argue against.
//                The deficit it measured is 15-19 u/s. Against the current
//                leader it is 5: resting speeds are FatherToken 62, Dexon 66,
//                MageofOz 57, measured 2026-10-21 by subtracting the active
//                speed conditions rather than reading character.speed raw.
//                AND EVERY SPEED IN BOTH OLD MEASUREMENTS IS A BUFFED SNAPSHOT.
//                74/59/55 are instants, and 74 is the exact figure recorded
//                elsewhere as a buffed Dexon reading; the :512 note's "leader
//                65" is a buffed FatherToken whose resting value is 62, so its
//                8u/s of bleed is really 5. character.speed is a live value and
//                not a stat - that retraction had already been made, and it had
//                not been carried into the three comments that depend on it.
//                SO THE BROWSER SESSION'S DRY-RUN RESULT CONTRADICTS A
//                STALE-SCOPED CLAIM RATHER THAN A LIVE ONE. They measured the
//                mage holding mean 10 / p50 3 against a leader at 62-63 with
//                MOVE.staleSlack at 15, and flagged it as an apparent
//                contradiction of this file. It mostly dissolves: a 5u/s
//                deficit is not a 15-19u/s one, and their own named confound -
//                the leader under smart_move, which paths and pauses - makes
//                the effective deficit smaller still. The clean
//                constant-velocity re-measure is still worth doing before
//                anything is planned on the tight numbers; what is settled is
//                that these three comments were overstating their own reach.
//                NOTHING BEHAVIOURAL CHANGED. staleSlack stays 60 and the
//                bands stay as v19 left them, because the re-measure has not
//                happened - this commit only stops three comments asserting
//                more than their measurement supports.
// v19 2026-10-21 holdReleaseAt 30 WAS UNREACHABLE AND 120 IS A FLOOR, NOT A
//                RETUNE. v18 shipped 30 and the live run could not complete a
//                hold: holds 8, holdGaveUp 5 - 62% - and the give-up LATCHES,
//                so the leader then stopped holding at all and the party
//                trailed freely. Operator's report was that movement was worse
//                than before, and it was.
//                THE MECHANISM IS A COUPLING, NOT A TUNING. A follower stops
//                closing at HIS OWN releaseAt (120 in the combat band), so the
//                hold's exit condition can only ever be satisfied by follower
//                movement that stops there. THE LEADER'S RELEASE CANNOT BE SET
//                BELOW THE FOLLOWERS' RELEASE. v18's risk note named "a
//                follower stalled between 30 and 120" and modelled it as rare;
//                that band is not a stall, it is the followers' RESTING STATE,
//                so the risk was the default path rather than an edge.
//                holdReleaseAt is now 120, which the operator patched live and
//                confirmed working. The SEPARATION STAYS and is still worth its
//                keep - the hold owns a knob that can move without dragging the
//                kite rejection and the close-step sizing with it, and ABOVE 120
//                is the untested direction - but it is numerically inert at this
//                value and the suite now says so rather than asserting the
//                separation has an effect.
//                ALSO FIXED: caveLeash() returned `hold:` TWICE, so the pair
//                v18 added for observability never reached a reader - the
//                second key silently won. Object-literal form of the
//                serverhop_logic double-declaration trap, in the file that
//                documents that trap, and it cost the browser session a wrong
//                deploy call: they feature-detected on the hold pair, found it
//                absent and reported pre-v18 while v18 was running.
//                A FEATURE ADDED IN THE SAME COMMIT AS THE BEHAVIOUR IT
//                REPORTS IS THE WORST POSSIBLE DEPLOY PROBE - nothing has ever
//                confirmed it reaches a reader. The two keys are one now.
// v18 2026-10-21 THE LEADER HOLD GETS ITS OWN PAIR OF CONSTANTS. holdAt 180 /
//                holdReleaseAt 30, read ONLY by the hold. MOVE.closeAt and
//                MOVE.releaseAt kept 180/120 and still build the followers'
//                combat band, the kite rejection and the close-step sizing, so
//                exactly one behaviour moved. The hold used to release at the
//                same 120 the followers use, so it let go 60u before they were
//                gathered and the gap re-opened at once: 142 holds, 571s held,
//                40% of a 24-minute run stopped. Follower start latency is a
//                FIXED COST PER HOLD, so many short holds is the expensive
//                arrangement - waiting once for 150u pays it once.
//                PREDICTION, to be falsified by the next run: holds ~57 (from
//                142), total held ~325s (from 571s), each hold longer. THE RISK
//                IS holdGaveUp: a follower stalled between 30 and 120 now keeps
//                the leader waiting where it was released before, so if that
//                count rises materially from 9 the lever is HOLD.maxMs (20000),
//                patchable live via caveLeash({maxMs:...}) with no redeploy.
//                NOT Option B - the out-of-combat trigger stays 180 and the
//                operator is still holding the four-constant mode-selecting
//                version.
// v17 2026-10-21 the version is READ from line 1 instead of hardcoded. ver: 14
//                sat in the dump and in the load event while v16 was live and
//                was believed over feature detection in a deploy report.
//                caveHeaderVersion() anchors on the FILE MARKER rather than a
//                trailing version, because line 1 ends "(TEST BUILD)" and
//                because this header ACCUMULATES history, so any scan taking
//                the last match returns the OLDEST entry. A foreign editor
//                buffer yields null rather than another script's version, and
//                caveDump() reports line 1 VERBATIM as `build` - text over any
//                hand-maintained number
// v16 2026-10-20 comment only: the isFn(bare identifier) Form A surface is
//                recorded as MEASURED inert across all five game helpers, and
//                the file is confirmed IIFE-wrapped by brace depth
// v15 2026-10-20 followers close from 60/30 out of combat instead of 120/60,
//                and the leader's hold stops tracking the travel leash - it
//                reads MOVE.* so it holds at 180/120 in both modes, which is
//                a REVERSAL of v14's deliberate welding of the two. A travel
//                kite step may no longer grow the leader gap at all, because
//                a 30u band is narrower than kiteStep 55 and v6's oscillation
//                would otherwise return. leaderMap and leaderPos read the
//                leader ENTITY then the BEACON and never parent.party, which
//                is what sent followers back to the door they had just used
// v14 2026-10-18 travel leash tightens to 120/60 while walking and reverts to
//                180/120 whenever anyone is fighting; a localStorage trouble
//                beacon carries fear, which is self-only and readable nowhere
//                else; the leader cancels its in-flight path and waits when a
//                member is too far back or in trouble, bounded at 20s; an
//                unseen follower no longer counts as a close one
// v13 2026-10-12 crypt: retaliate against anything that starts it, except the
//                three that would win; caveOnly/caveNever set it at runtime
// v12 2026-10-12 crypt mode: operator drives the leader, followers cohere and
//                fight, and NOTHING may be attacked but the whitelist
// v11 2026-10-11 telemetry archived per run; door recon; chest recon fixed;
//                lootRangeFilter switch (default unchanged)
// v10 2026-10-10 loot: pause guard, cooldown, per-chest backoff, shape recon
// v9 2026-10-10 heal cooldown gate; friendly_target forensics; objective and
//               objective-button reconnaissance (both read-only)
// v8 2026-10-10 restock phase before the gather, respawn backoff, two more
//               gate pre-checks (cave_closed, home server)
// v7 2026-10-06 dry-run mode, configurable leader, latched cohesion recovery,
//               potions, skill range gating, scare, reason-counter telemetry
// v6 2026-10-06 auto-party with retry, looting
// v4 2026-10-06 first live cave run - IIFE wrapper, vote mirroring proven
//
// Cave of Many Dreams. Deploy the SAME file to all three combat slots.
// Standalone on purpose: it touches none of the farm builds, so iteration is
// cheap. Port what survives into Ranger/Priest/Mage once it earns its place.
//
// WHO LEADS IS CONFIGURABLE. caveLead('FatherToken') writes a key all three
// tabs read - same origin, so one call retargets the whole party. Measured
// 2026-10-06: Dexon 74 speed, FatherToken 59, MageofOz 55. A follower CANNOT
// converge on a faster leader; driving Dexon gave closing rates of -15 and
// -19 u/s and 11-12 minutes per character outside the leash. Drive the priest.
// THAT ADVICE WAS TAKEN AND IT RETIRED ITS OWN EVIDENCE - v20. FatherToken has
// led since, so the only measurement behind "cannot converge" was taken under
// the arrangement it argued against, and the two sites below that cite it
// inherit that scope. Against the CURRENT leader the deficit is 5 u/s, not
// 15-19: resting speeds are FatherToken 62, Dexon 66, MageofOz 57, measured
// 2026-10-21 by subtracting active speed conditions. The figures on the line
// above are BUFFED INSTANTS - character.speed is a live value, not a stat, and
// 74 is a known buffed Dexon reading - so they overstate every differential
// they are used for. Re-measure against a constant-velocity leader before
// planning on any of it.
//
// COMMANDS   caveDry()   on-map rehearsal - never enters, no staging, no votes
//            caveGo()    restock potions, THEN gather at Dorr for a real run
//            caveEnter() leader only, cave mode only
//            caveLead(name) caveStatus() caveStop() caveDump()
//            cryptRun()  the automated crypt (v32), on the leader for all three
//            cryptStop() cryptNav(on) cryptStatus() cryptSpot('pull'|'vbat', x, y)
//            cryptNew()  abandon the current instance so the next run opens a new one
//
// ENTRY IS MANUAL BY DESIGN. One visit per account per day; an accidental
// enter() burns it. Combat is also held while staged, because the gate refuses
// anyone with targets > 0 (generated_maps.js:434 -> bring_party_to_keeper).

/* EVERYTHING IS WRAPPED IN AN IIFE. The CODE slot is evaluated into a scope
   that already holds names from the client and anything else loaded, and a
   top-level `const T` collided with one on the very first engage:
   "Identifier 'T' has already been declared", which kills the whole file at
   line 1. Nothing here is global any more; the commands reach the outside
   through the window.* assignments at the bottom, which is all they ever
   needed. The body is deliberately left un-indented so this wrapper stays a
   two-line change rather than reflowing every line. */
(function () {

/* A second engage without a reload would otherwise start a SECOND set of
   loops on top of the first - double ticks, double moves, double attacks.
   Each load claims a generation; older loops see they are superseded and
   stop rescheduling themselves. */
try { window.__caveGen = (window.__caveGen || 0) + 1; } catch (e) {}
const MY_GEN = (function () { try { return window.__caveGen; } catch (e) { return 1; } })();
function alive() { try { return window.__caveGen === MY_GEN; } catch (e) { return true; } }

const TEAM = ['Dexon', 'FatherToken', 'MageofOz'];
const LEADER_KEY = 'cave_leader';
const DEFAULT_LEADER = 'FatherToken';

/* LEADER IS READ, NEVER CAPTURED. v6 held it in a const inside this IIFE,
   which made it unreachable from outside and forced an edit-and-redeploy to
   change who drives. localStorage is shared across every adventure.land tab,
   so one caveLead() retargets all three at once. With no key set the default
   applies, which is the operator's ruling of 2026-10-24 for every mode: the
   priest, middle in speed and the tankiest, so the right one to engage
   first. */
function leaderName() {
	try { const v = parent.localStorage.getItem(LEADER_KEY); if (v && TEAM.indexOf(v) >= 0) return v; } catch (e) {}
	return DEFAULT_LEADER;
}
function role() { return character.name === leaderName() ? 'leader' : 'follower'; }
function isLeader() { return role() === 'leader'; }
function followers() { const L = leaderName(); return TEAM.filter((n) => n !== L); }

const CFG = {
	keeper: { map: 'main', x: 816, y: 1200 },
	partyMs: 5000,
	acceptMs: 3000,
	engageHoldMs: 8000,
	healAt: 0.78,
	partyHealAt: 0.6,
	tickMs: 250,
	awaitMaxMs: 15000,      // v35: no awaited call holds a tick longer than this
	tickStallMs: 30000,     // v35: no tick for this long and the watchdog restarts the loop
	voteTickMs: 400,
	doorNear: 40,
	stageWithin: 120,
	logEveryMs: 6000,
	potMs: 2100,            // use_hp/use_mp share a 2000ms cooldown
	potHpCrit: 0.50,
	potMpLow: 0.60,
	potHpTop: 0.85,
	scareAt: 2,             // attackers on me before the jacko comes out
	scareHpAt: 0.60,        // or one attacker while this hurt
	autoRespawn: true,      // bare respawn() - the only parameterless one that exists
	respawnMs: 4000,        // first retry delay; doubles on cant_respawn
	respawnMaxMs: 30000,

	/* LEAVING - v25, narrowed in v26. Once every required room of the third
	   floor is done the time left is the operator's to farm (camps, unvisited
	   encounters - the leader is theirs to drive), so a character leaves by
	   itself only when there is nothing left to earn: the run's Amber cap is
	   reached, or finalMs of clock remain, or caveExit() asks. It still waits
	   for the chests on its map to be gone first - the finish reward and the
	   purse's Amber are chests until opened, and leaving settles only what was
	   opened - capped at chestWaitMs, because a chest the loot range never
	   reaches would otherwise hold it in forever; whatever is left is logged.
	   handback: on leaving the cave, by exit or by the clock, write the final
	   dump to the game log and load this character's own main slot by name -
	   load_code(character.name), measured by the browser session to resolve
	   the character slot by its name. engageMs bounds the wait for the page
	   to load that slot into its editor - see engageMainSlot(). */
	exit: { enabled: true, settleMs: 15000, chestWaitMs: 90000, retryMs: 10000, finalMs: 60000, handback: true, engageMs: 15000 },
	/* THE LAUNCHER - v26. On load outside the cave, ask the server whether
	   today's visit is spent (interaction `info`, which answers
	   {visit: {available, resets, resume}}). Available: restock and walk to
	   Dorr on our own, no 'go' message needed, so engage order does not matter
	   and a reloaded character catches up. Spent: hand back to the main script
	   after graceMs, which caveStay(), caveDry() or caveCrypt() cancel. A run
	   open to resume: do nothing and say so. Entry stays caveEnter(). */
	launch: { enabled: true, graceMs: 20000, answerMs: 10000 },

	/* LOOT. v9 called loot() on every 250ms tick with no pause guard and no
	   cooldown; see lootTick for the measurements. */
	lootMs: 900,
	lootPerPass: 3,         // chests attempted per pass, newest first
	lootMaxTries: 3,        // attempts before a chest is rested
	lootDeadMs: 15000,      // how long a rested chest is left alone
	lootRange: 400,         // ONLY applied when the chest record exposes a position
	/* THE RANGE FILTER WAS 98% OF v10's LOOT SUPPRESSION, and it is the one
	   brake v10 shipped without verifying. Measured over the two runs:

	     run   loot() calls   out-of-range rejections
	     v7           6,236   (filter did not exist)
	     v10            103   4,916

	   Backoff accounted for 74 of v10's rejections and give-up for 6; the
	   range filter did the other 4,916. Turning this off restores v10's other
	   three brakes (pause guard, rate cooldown, per-chest backoff) WITHOUT the
	   unverified one, which is the clean A/B - it is not a revert to v7's
	   hammering. Left TRUE so v11 changes no behaviour on its own; flip it for
	   one run, or read tel.chestProbe below, whichever you prefer. */
	lootRangeFilter: true,

	/* RESTOCK. Each character buys its own - there is no shared pool, and a
	   priest that runs dry heals nobody. 2000 of each at 100g is 200k per
	   character fully empty, which is affordable at current balances. */
	restock: { hpot1: 2000, mpot1: 2000 },
	restockChunk: 500,      // buy() calls are chunked and re-counted between
	restockRounds: 14,
	restockMaxMs: 240000,
	restockNear: 200,       // close enough to the counter to trade
	vendorFallback: { map: 'main', x: -35, y: -162 },   // fancypots, measured
};

/* MOVEMENT. closeAt/releaseAt are a latch, not a threshold - v6 compared gap
   against a single leash of 70, so a 55-unit kite step could push the gap back
   over it and the next tick closed again. 2064 close steps against 486 kite
   steps, cancelling. Numbers are sized to MEASURED ranges, not guesses:
   priest heal 201, Dexon attack 163, mage attack 229. The ceiling stays inside
   the priest's 201 so a kite step can never leave heal range. */
const MOVE = {
	closeAt: 180,
	releaseAt: 120,
	ceiling: 195,

	/* THE LEADER HOLD'S OWN PAIR - v18. Read ONLY at the hold; closeAt and
	   releaseAt above keep building the followers' combat band, the kite
	   rejection and the close-step sizing, so this separation moves exactly one
	   behaviour and nothing else.
	   holdAt MATCHES closeAt ON PURPOSE. The trigger is not what was wrong and
	   180 is the value the operator's range and the priest's measured 201 heal
	   range both admit; raising it out of combat is Option B and is theirs to
	   call, still held.
	   holdReleaseAt IS AT ITS FLOOR, AND THE FLOOR IS THE FOLLOWERS' OWN
	   releaseAt - v19, measured. v18 read this as a free tuning knob and set it
	   to 30; the hold then could not complete at all (holds 8, holdGaveUp 5,
	   and the give-up latches, so the leader stops holding entirely). The
	   coupling is one-way and structural: a follower stops closing at HIS
	   releaseAt, so no value below it can ever be reached, however long the
	   leader waits. v18's own comment had the diagnosis exactly inverted - it
	   called releasing at 120 the fault, when 120 is the only gap the followers
	   will actually deliver.
	   SO THIS PAIR IS NUMERICALLY INERT AT 120 AND STRUCTURALLY STILL RIGHT.
	   What it buys is that the hold owns a threshold which can be moved on its
	   own, without dragging the kite rejection and the close-step sizing along;
	   what it cannot buy is a release tighter than the followers'. Moving it
	   UP is untested and is the direction Option B lives in.
	   -> see the v19 header block */
	holdAt: 180,
	holdReleaseAt: 120,
	kiteRadius: 90,
	kiteStep: 55,
	speedEdge: 1.05,
	closeStepMax: 110,
	staleSlack: 60,

	/* START-ON-LEADER-MOTION - v21, item 3 of the three proposed changes, and
	   the one that never touched kiting so it was never blocked by the ruling.
	   WHAT IT IS FOR: `closeAt / leaderSpeed + tickMs/2` is the follower's
	   reaction delay, measured at 957ms and 926ms with closeAt 60 and IDENTICAL
	   across two characters of different speed, because it is the LEADER's
	   speed that sets it. At the committed closeAt 180 that is 2.9 SECONDS of
	   standing still before a follower twitches, and the follower is not
	   reacting late - waiting for closeAt IS his trigger. This gives him an
	   earlier one that does not move closeAt.
	   motionEps IS DERIVED, NOT PICKED: the leader covers ~15 units per 250ms
	   tick at a resting 62, so 4 sits an order below real movement and above
	   coordinate jitter. motionMs spans three ticks so a smart_move pause does
	   not read as a stop. Both are provisional in the sense that no run has
	   scored them, and both fail toward the OLD behaviour. */
	motionEps: 4,
	motionMs: 750,
	smartMoveMaxMs: 8000,

	/* TRAVEL LEASH - v14, HALVED IN v15. Tighter while the party is walking, the
	   numbers above the moment anyone is fighting. v14 said the band "stays 60u
	   wide"; it is 30u now and the v15 block explains what had to change in
	   kiteStep to make a band narrower than kiteStep safe. travelCeiling is
	   unchanged and is inert in travel mode for the same reason - it no longer
	   holds v14's closeAt+15 relationship and does not need to. */
	tighten: true,
	travelCloseAt: 60,
	travelReleaseAt: 30,
	travelCeiling: 135,

	/* THE STATIONARY BAND - v22, item 1. A leader who is not going anywhere has
	   no claim on 180 units of slack: the loose combat band exists so a
	   FIGHTING follower is not yanked off a monster by a leader walking away,
	   and when the leader is parked the second half of that is simply absent.
	   Caught live: leader STATIONARY, Dexon 171u away, `recovering` false,
	   `moving` false, closeAt 180, and nobody objected to 171.
	   THE WIDTH IS FORCED BY THE OSCILLATION INVARIANT, NOT CHOSEN. The sawtooth
	   fires when `releaseAt + kiteStep > closeAt` while the no-ratchet rule is
	   conditional, so a band carrying the combat kite rule must be at least
	   kiteStep (55) wide: 30 + 55 = 85, and 90 is the round number above it.
	   COLLAPSING TO THE TRAVEL BAND INSTEAD WOULD HAVE BROKEN THE OPERATOR'S
	   KITING RULING. 30 + 55 = 85 > 60 violates the invariant, and travel
	   survives it only because its no-ratchet is unconditional - which is
	   exactly the retreat freedom the ruling protects in combat. So the
	   stationary case needs its own pair; it cannot borrow travel's.
	   90 IS THE OPERATOR'S TO MOVE, with one constraint that is not: keep
	   `travelReleaseAt + kiteStep <= stationaryCloseAt` or the retreat has to
	   go with it. The suite asserts that over every band the selector returns. */
	stationaryCloseAt: 90,
	stationaryReleaseAt: 30,
	stationaryCeiling: 135,

	/* JOINING A STATIONARY LEADER - v34, the operator's ruling R3 of
	   2026-11-08, cave and crypt alike. While the leader is not moving and
	   nothing is fighting the party, a follower walks onto the leader's EXACT
	   spot rather than parking anywhere inside a band. In combat nothing
	   changes - the 2026-10-23 ruling stands, kiting and backing away as
	   normal - and once the fight ends the follower walks back onto the spot.
	   It replaces the crypt's 135u standoff: a follower inside the 180 at
	   which the latch closes, a leader holding for a 120 release. */
	joinStationary: true,
	joinAt: 8,
};

/* ---------------------------------------------------------------- v14 -----
   THE TRAVEL LEASH, THE TROUBLE BEACON AND THE LEADER HOLD. Three changes
   that only work as one: a tighter leash on its own just moves where the
   follower gives up, because this file already measures that a follower
   CANNOT converge on a faster leader - SCOPED, see :102 and v20: that was
   measured with DEXON leading at a 15-19 u/s deficit, and the current leader
   gives 5. The argument for the three changes being one does not rest on the
   size of the deficit, only on its sign, so it survives the rescoping; a
   quantitative claim built on it would not. The leader holding is what makes a
   tight band reachable, and the beacon is what tells the leader to hold.

   HYSTERESIS WAS PRESERVED EXACTLY, AND v15 BROKE THAT ON PURPOSE. 120-60 was
   the same 60u band as 180-120, and that margin existed because it had to stay
   comfortably above kiteStep (55) or v6's oscillation returns - 2,064 close
   steps against 486 kite steps, cancelling each other out. v15's band is
   60-30, which is 30u and BELOW kiteStep, so that protection is gone and
   something had to replace it; see the v15 block for the kiteStep guard that
   does. travelCeiling no longer keeps closeAt's +15 relationship either - it
   is inert in travel mode once a kite step there cannot grow the gap at all.

   THE CEILING NEVER GOES UP. 195 is already inside the priest's measured
   201 heal range with no margin to spare; travel tightens it to 135. */
const TROUBLE = {
	hpAt: 0.55,            // at or below this fraction of max_hp, a member needs help
	atkAt: 3,              // monsters on one member before it counts as mobbed
	staleMs: 3000,         // a beacon older than this tells us nothing - see mateTrouble
	/* NOT MEASURED, deliberately conservative. One ~160 byte localStorage write
	   per character per beaconMs; at 250ms that is 12/s across three tabs. No
	   cost was observed, but none was measured either, so it is a knob rather
	   than a hardcoded tick. Anything comfortably under staleMs is safe. */
	beaconMs: 250,
};

/* THE LEADER HOLD. The leader has no script-driven movement inside the Cave -
   moveTick returns at the isLeader() line, and the crypt block says in as many
   words that the operator drives. So "stop and wait" cannot mean declining to
   issue a move; it means CANCELLING one the operator already started. Measured
   2026-10-18 on the live leader: character.moving was true and
   character.going_x / going_y carried the in-flight target, so a move() to the
   character's own position stops it and the remembered target re-issues it.

   WHAT THIS CANNOT DO, stated so nobody has to find out. going_x/going_y is
   the CURRENT leg, not the whole journey: a click that paths over several legs
   loses its remainder and the operator re-clicks. character.destination does
   not exist on the character - checked, not assumed.

   BOUNDED, BECAUSE AN UNBOUNDED WAIT IS THE TRAVEL DEADLOCK WEARING A HAT.
   maxMs then gives up, says so loudly, and resumes - the same shape as
   restockGaveUp, and for the same reason: three characters standing still
   forever is the failure least likely to be noticed, because everything
   still looks alive.

   OFF IN CRYPT, ON PURPOSE. There the operator's driving is the safety
   mechanism that keeps the party away from Marceline, and this file already
   refuses to put a geofence in its way. */
const HOLD = {
	enabled: true,
	inCrypt: false,
	maxMs: 20000,
};

/* FEAR IS SELF-ONLY, AND THAT IS THE ENTIRE REASON THIS BEACON EXISTS.
   Measured 2026-10-18 in the live CODE context: character.fear is a number on
   the character and it is on NOTHING else. Not parent.party, which carries
   only cx/gold/in/l/level/luck/map/pdps/share/skin/type/x/y. Not
   parent.entities[mate]. Not even parent.entities[own name]. hp/max_hp ARE on
   a visible entity, so HP reads remotely and fear does not. A feared member
   stops acting and cannot catch up, which is exactly the state the leader
   needs to see, so each character publishes its own.

   parent.party IS ALSO USELESS FOR DISTANCE, measured the same day: every
   member's x/y sat frozen for a 20.7s sample while the characters walked
   hundreds of units, and the leader's own entry was 396u from his real
   position. Re-measured 2026-10-19 and worse: single snaps of 975u, and the two
   candidate leader positions 2558u apart. On a travel band that is now 30u wide
   that is not a rounding error.
   THIS PARAGRAPH WAS RIGHT AND THE CODE IGNORED IT UNTIL v15. It used to end
   "which is why leaderPos() tries the ENTITY first and party only as a
   fallback" - and that fallback was the party row this very paragraph calls
   useless for distance. leaderPos() and leaderMap() now fall back to the
   BEACON, which is measured ~100x fresher and is what the rest of this file
   already uses for exactly this reason. A correct comment sitting above code
   that contradicts it is not a safe state; see CLAUDE.md, "A comment is a
   claim".

   WHY localStorage AND NOT send_cm. caveSay is leader-gated and the cm handler
   drops anything whose sender is not the leader, so followers have no upward
   channel at all without changing that protocol. localStorage is shared across
   every adventure.land tab - this file already depends on that for cave_leader
   - and it is synchronous, which matters at a 250ms tick where a ~1s cm round
   trip would leave a quarter of the decision stale.

   CTYPE IN THE KEY, NEVER THE NAME. The same rule as TEL_KEY and for the same
   measured reason: a key containing "Token" is redacted by output filters on
   the reading side. The name goes in the VALUE, where tel already puts it. */
const ST_PREFIX = 'cave_st_';
const ST_KEY = ST_PREFIX + character.ctype;


/* CRYPT MODE, AND WHY IT IS NOT JUST dry.

   dry was the right hook and the wrong safety story. It makes active() true
   without any Cave state, which is exactly what is needed to run this script on
   a map that is not the Cave - but it suppresses only cave ENTRY, floor
   following and voting. combatTick and moveTick have no dry guard at all, so
   dry still walks and still swings. In the Crypt that is the most dangerous
   setting available, not the safest: caveDry() sets phase='active', which is
   the very gate that wakes combatTick, and pickTarget ends in a bare
   get_nearest_monster() fallback with no type restriction.

   WHAT IS IN THAT ROOM, measured 2026-10-12 against the party's real figures
   (heal 2,000/s, FatherToken armour 512 / resistance 569 as the best tank):

     a6 Marceline   9,401 dps on FT   kills him in ~0.9s
     a8 Angel       5,624 dps         ~2.3s
     a1 Spike       2,466 dps AND 18,700,000 hp - 99 minutes of party dps
     vbat           1,015 dps         +985 margin, 45s each  <- the only target

   So crypt mode is dry's active() hook plus a HARD whitelist. The whitelist is
   enforced twice on purpose - once in pickTarget so nothing downstream ever
   sees a forbidden target, and again immediately before attack(), because the
   entire failure mode is something slipping through to that one call.

   THE OPERATOR DRIVES THE LEADER. moveTick returns early for the leader, so in
   crypt mode the leader is yours to steer and the other two cohere to it and
   shoot. That is deliberate: a geofence would fight your own driving, and your
   driving is what keeps the party away from Marceline. Kiting still considers
   ALL threats, not just the whitelist, which is what you want near her. */
const CRYPT = {
	/* What we go looking for. pickTarget will initiate on these. */
	only: ['vbat'],

	/* NEVER, not even when they are already hitting us. Measured 2026-10-12
	   against the party's real figures (heal 2,000/s, FatherToken armour 512 /
	   resistance 569 as the best tank), dps AFTER mitigation:

	     a6 Marceline   9,401   kills FT in ~0.9s
	     a8 Angel       5,624   ~2.3s
	     a1 Spike       2,466   and 18,700,000 hp - 99 minutes of party dps

	   Fighting back against these is how the run ends, so retaliation is
	   refused too. Everything NOT on this list is survivable in a straight
	   fight and may be answered:

	     a7 Lucinda       529   +1,471 margin
	     a4 Orlok         567   +1,433
	     a3 Lestat        957   +1,043
	     a5 Elena          35   +1,965
	     a2 Bill        1,645   +355  (thin - the one to watch)
	     vbat           1,015   +985

	   v12 had only the whitelist, so a7 could stand there hitting the priest
	   while the party refused to answer - safe, because 529 against 2,000 of
	   healing is a stalemate, but it stops you clearing a path. */
	never: ['a6', 'a8', 'a1'],
};

let mode = 'cave';         // cave | dry | crypt
let phase = 'idle';        // idle | restock | gather | staged | inside | active (dry)
let stopped = false;
let engagedUntil = 0;
let votedFor = {};
let lastLog = 0;
let lastDoorTry = 0;
let lastPot = 0;
let deadDoors = {};        // a locked door is not retried every three seconds
let lastLoot = 0;
let chestTries = {};       // id -> attempts in this life
let deadChests = {};       // id -> when it was rested

/* COHESION RECOVERY IS LATCHED AND UNINTERRUPTIBLE. Past closeAt the follower
   commits to reaching the leader and nothing else may move it - no kiting, no
   door logic - until the gap is back inside releaseAt. The aim point is only
   refreshed once the leader has walked staleSlack away from it, so a moving
   leader is still tracked without restarting pathing every tick. */
let recovering = false;
let aim = null;
let smartFlight = 0;

let troubleNow = [];
let leashNow = null;
let holdFrom = 0;
let holdGoing = null;
let holdDone = false;

let beaconAt = 0;
function beaconWrite() {
	if (Date.now() - beaconAt < TROUBLE.beaconMs) return;
	beaconAt = Date.now();
	try {
		parent.localStorage.setItem(ST_KEY, JSON.stringify({
			name: character.name,
			t: Date.now(),
			map: character.map,
			x: Math.round(character.real_x),
			y: Math.round(character.real_y),
			hpFrac: character.max_hp ? Math.round((character.hp / character.max_hp) * 1000) / 1000 : 1,
			fear: character.fear || 0,
			atk: attackersOnMe(),
			rip: !!character.rip,
			/* v26: the regroup state. `rest` is resting at the landing after a
			   respawn (or held there by a death loop), `loop` the death loop
			   itself, `deaths` this character's deaths this run, `ctype` so the
			   leader can tell the healer died without a name table. */
			rest: !!(resting || deathLoop),
			loop: !!deathLoop,
			deaths: myDeaths.length,
			ctype: character.ctype || null,
			/* v27: `wait` is a member waiting for the party to collect it - rested
			   but blocked by a hostile, or held by a death loop; `exit` is the
			   leader leaving, which the followers follow. */
			wait: !!(deathLoop || (resting && restSaid)),
			exit: !!exitForce,
			/* v32, the crypt run: the instance this member is in, its mluck, whether
			   it is walking a stray off, and the after-run state the leader's gate
			   reads - its loot handed over, and (the mule) room for another run. */
			inst: character.map === 'crypt' ? (character.in || null) : null,
			mluck: mluckLeft(),
			kite: !!crKite,
			muled: !!crMuled,
			room: !!crRoom,
			/* v34: this member's crypt sightings, for the leader's search. */
			cs: character.map === 'crypt' ? crCs : null,
			/* v36: the rest before each stage reads mpFrac; `jacko` names the
			   scare holder and `mp` lets the leader check one scare's worth;
			   `esc` is a mage with scare or blink ready, which the priest
			   leaves to escape a2 herself rather than absorbing him. */
			mpFrac: character.max_mp ? Math.round((character.mp / character.max_mp) * 1000) / 1000 : 1,
			mp: Math.round(character.mp || 0),
			jacko: crHasJacko(),
			esc: character.map === 'crypt' && character.ctype === 'mage' && (haveSkill('scare') || haveSkill('blink')),
		}));
	} catch (e) { bump('beaconWriteFail'); }
}
function crHasJacko() {
	try { const o = character.slots && character.slots.orb; return !!(o && o.name === 'jacko'); } catch (e) { return false; }
}
function beacons() {
	const out = {};
	try {
		const ls = parent.localStorage;
		for (let i = 0; i < ls.length; i++) {
			const k = ls.key(i);
			if (!k || k.indexOf(ST_PREFIX) !== 0) continue;
			let v = null;
			try { v = JSON.parse(ls.getItem(k)); } catch (e) { continue; }
			if (v && v.name) out[v.name] = v;
		}
	} catch (e) {}
	return out;
}
/* RIP IS NOT TROUBLE, and the two readers must agree about that or the leader
   holds for a corpse. Trouble means "needs help AND can still be helped": you
   hold to stop someone dying, and once they have died holding achieves
   nothing - they respawn in town, far from here, and deathTick owns getting
   them back. followerGaps reports a dead mate as gap 0 for the same reason, so
   neither path strands the run on a body. Caught by the harness; reading it
   twice had not. */
/* ANY DEATH PUTS THE PARTY IN REGROUP - the operator's ruling of 2026-10-24.
   Until v26 a dead member was not trouble at all ("holding for a corpse helps
   nobody"), so the leader walked on and the respawned character crossed the
   floor alone, which is the repeat-death loop the operator watched. A dead,
   resting or death-looped member now holds the leader, and REGROUP_WHY marks
   the holds that have no 20-second give-up. */
const REGROUP_WHY = ['dead', 'resting', 'deathloop'];
function troubleOf(st) {
	if (!st) return null;
	if (st.rip) return 'dead';
	if (st.loop) return 'deathloop';
	if (st.rest) return 'resting';
	if (st.hpFrac <= TROUBLE.hpAt) return 'hp';
	if (st.fear > 0) return 'fear';
	if (st.atk >= TROUBLE.atkAt) return 'mobbed';
	return null;
}
/* A STALE BEACON IS NOT TROUBLE, AND IT IS NOT SAFETY EITHER. Getting that
   wrong is worse than never reading it. Chrome clamps a hidden tab's timers to
   ~1s and then to about one tick a minute, so a backgrounded member's beacon
   ages while nothing at all is wrong. Read stale as trouble and the leader
   never moves again; read it as fine and the party walks away from someone
   dying. So stale falls back to what can be seen locally - entity hp, which is
   real whenever the member is in range - and FEAR IS SIMPLY UNKNOWN while
   stale, reported as such rather than guessed at. */
function mateTrouble() {
	const now = Date.now(), bs = beacons(), out = [];
	for (const nm of TEAM) {
		if (nm === character.name) continue;
		const st = bs[nm];
		if (st && now - st.t <= TROUBLE.staleMs) {
			const why = troubleOf(st);
			if (why) out.push({ who: nm, why: why });
			continue;
		}
		const e = (parent.entities || {})[nm];
		if (here(e) && e.max_hp && e.hp / e.max_hp <= TROUBLE.hpAt) out.push({ who: nm, why: 'hp/entity' });
	}
	return out;
}
/* IS THE HOLD GOING TO BACK THIS UP. The tight band and the leader hold are
   one change, not two, and the tight band is the half that hurts on its own:
   this file measures that a follower CANNOT converge on a faster leader, so a
   120u band with nobody waiting just latches the slowest member into
   recovering and leaves it there - and recovering is uninterruptible, so it
   also stops kiting and looting. Worse than the 180 it replaced. Measured
   2026-10-18: mage 57 against leader 65, which is 8u/s of bleed, so 60u of
   band is gone in 7.5s and never comes back while the leader walks. So travel
   numbers apply only where a hold will actually stop the leader.
   THE 8u/s IS REALLY 5, AND THE BAND LASTS 12s RATHER THAN 7.5 - v20. "Leader
   65" is a buffed FatherToken instant; his resting speed is 62 against the
   mage's 57, both measured 2026-10-21 by subtracting active speed conditions.
   The conclusion is unchanged in kind - the band still bleeds away while the
   leader walks, which is the whole point - but do not quote 8u/s or 7.5s, and
   note that a leader under smart_move paths and pauses, so the effective
   deficit is smaller again. The browser session measured the mage tracking at
   mean 10 with MOVE.staleSlack cut to 15, which is the lever this note does
   not mention and which was doing much of the bleeding. */
function holdActive() { return HOLD.enabled && !(mode === 'crypt' && !HOLD.inCrypt); }
/* THE NO-RATCHET RULE IS DERIVED FROM THE BAND'S OWN GEOMETRY - v22 - AND
   THAT REPLACES READING THE MODE LABEL.
   It used to be `L.mode === 'travel'`, which tied the kite rule to the band
   NAME. That was correct while there were two bands and the narrow one was the
   travel one, and it becomes wrong the moment a third exists: item 1 was
   specified as "a stationary leader uses the travel band regardless of
   follower engagement", and travel carries the unconditional rule, so an
   ENGAGED follower beside a parked leader would have lost the retreat - which
   is precisely what the operator ruled against on item 2 ("it also protects
   the followers ability to kite while in combat"). The decoupling would have
   reinstated item 2 through the back door.
   SO THE PREDICATE IS THE INVARIANT ITSELF. A band needs the unconditional
   rule exactly when a free kite step from releaseAt can land past closeAt,
   because that is the oscillation condition; a band wider than kiteStep does
   not, and keeps the retreat. Today that reproduces both shipped answers with
   no behaviour change - combat 120 + 55 = 175 <= 180 stays CONDITIONAL and
   keeps the retreat, travel 30 + 55 = 85 > 60 stays UNCONDITIONAL - and it
   gives the right answer for any band added later without anyone re-deriving
   it. "The tight band and the unconditional no-ratchet are ONE change rather
   than two" is the file's own phrasing; this makes them one expression. */
function noRatchetAlways(L) { return L.releaseAt + MOVE.kiteStep > L.closeAt; }

/* WHICH BAND. Leader motion picks the DISTANCES; engagement still picks
   whether the loose pair is even a candidate. The selector asked nothing about
   the leader until v22 - the third sighting of the wrong-actor shape - and on
   open ground doing nothing `engagedNow` was TRUE all session, so the travel
   band never applied at all and every dry-run figure was the combat band. */
function computeLeash() {
	const base = { closeAt: MOVE.closeAt, releaseAt: MOVE.releaseAt, ceiling: MOVE.ceiling, mode: 'combat' };
	if (!MOVE.tighten || !holdActive()) { base.mode = MOVE.tighten ? 'base/nohold' : 'base'; return base; }
	if (engaged() || attackersOnMe() || troubleNow.length) {
		/* ENGAGED. The loose band is for a follower being pulled off a monster
		   by a leader walking away; parked, there is nothing to be pulled off
		   by, so the distances tighten and the kite rule does not. */
		if (leaderMoving()) return base;
		return { closeAt: MOVE.stationaryCloseAt, releaseAt: MOVE.stationaryReleaseAt,
			ceiling: MOVE.stationaryCeiling, mode: 'stationary' };
	}
	return { closeAt: MOVE.travelCloseAt, releaseAt: MOVE.travelReleaseAt, ceiling: MOVE.travelCeiling, mode: 'travel' };
}
function leash() { return leashNow || computeLeash(); }
/* ONE SCAN PER TICK. mateTrouble walks localStorage, and leash() is asked
   three times a tick - by moveTick, kiteStep and recoverStep. */
function senseTick() {
	beaconWrite();
	troubleNow = mateTrouble();
	leashNow = computeLeash();
	if (leashNow.mode === 'travel') bump('travelLeashTicks');
	if (troubleNow.length) bump('troubleTicks');
}


/* THE isFn(bare_identifier) PATTERN IS MEASURED INERT, NOT ASSUMED SAFE, AND THAT
   IS WHY IT STAYS. Passing a bare identifier as an ARGUMENT evaluates it, so
   `isFn(can_move_to)` throws ReferenceError rather than returning false if the
   name is undeclared - CLAUDE.md's Form A, and :803 and :912 sit outside any
   try. Eight call sites across five identifiers. Measured live 2026-10-19 in the
   CODE context of all three combat characters, by typeof AND by the arg-pass
   that is the actual hazard: can_move_to, can_attack, is_on_cooldown,
   is_in_range and get_nearest_monster all `function` both ways, and a real
   can_move_to() call returned a boolean. Confound ruled out the way the
   ms_to_next_skill case teaches - grepped Party/*.js, CaveRun.js and Codex/*.js
   for a declaration of each: zero for all five, so they are game-provided and
   the measurement transfers. DO NOT "fix" the eight sites on the pattern alone;
   re-measure first if the game ever stops providing one. */
const isFn = (f) => typeof f === 'function';
function clog(m, c) { try { game_log('[cave] ' + m, c || '#8b98ab'); } catch (e) {} try { console.log('[cave] ' + m); } catch (e) {} }
function throttleLog(m) { if (Date.now() - lastLog < CFG.logEveryMs) return; lastLog = Date.now(); clog(m); }

function inCave() { try { return parent.G.maps[character.map] && parent.G.maps[character.map].generated && parent.G.maps[character.map].generated.zone === 'dreams'; } catch (e) { return false; } }
function caveState() { try { return character.cave || null; } catch (e) { return null; } }

/* THE CAVE PAUSES, AND v6 HAD NO IDEA. Measured 2026-10-06: paused on 57-64 of
   every ~157 ticks, about 37% of the run. While paused the server refuses BOTH
   attack and move with cave_paused - 869 failed attacks against 24 landed on
   the mage. Guarded for an absent cave so the same code path runs in dry mode. */
function cavePaused() { try { const c = character.cave; return !!(c && c.paused); } catch (e) { return false; } }

function here(e) { return e && !e.rip && (!e.map || e.map === character.map); }
function dist(a, b) { return Math.hypot((a.real_x !== undefined ? a.real_x : a.x) - (b.real_x !== undefined ? b.real_x : b.x), (a.real_y !== undefined ? a.real_y : a.y) - (b.real_y !== undefined ? b.real_y : b.y)); }

function leaderEntity() { try { return parent.entities[leaderName()] || null; } catch (e) { return null; } }
/* LEADER MOTION, INFERRED FROM SUCCESSIVE READINGS, because leaderPos()
   returns {x,y} and the game offers no `moving` flag on it.
   THE FAIL-SAFE IS STRUCTURAL RATHER THAN CHECKED: a stale source does not
   change, so a frozen party row or an expired beacon yields "not moving", the
   light follow never fires, and the leash band behaves exactly as it did
   before this existed. That is why there is no staleness test here on top of
   the ones leaderPos() already applies - the degenerate reading is the safe
   answer, not a case to detect. */
let leaderSeen = null;
let leaderMovedAt = 0;

function noteLeaderMotion(lp) {
	if (!lp) { leaderSeen = null; return; }
	if (leaderSeen && Math.hypot(lp.x - leaderSeen.x, lp.y - leaderSeen.y) > MOVE.motionEps) {
		leaderMovedAt = Date.now();
	}
	leaderSeen = { x: lp.x, y: lp.y };
}

function leaderMoving() { return Date.now() - leaderMovedAt < MOVE.motionMs; }

/* THE LIGHT STEP, AND EVERY WAY IT IS LIGHTER THAN recoverStep IS DELIBERATE.
   No latch - `recovering` is UNINTERRUPTIBLE and stops kiting AND looting, and
   the cave run measured lootOutOfRange ~1030 against ~15 successful lootCalls,
   so a second path into that state is the last thing this should add. No
   smart_move, so it cannot leave an unsettled promise and cannot hang a tick;
   blocked, it simply does nothing and the recovering latch is still there at
   closeAt as the fallback it always was.
   AND IT AIMS AT THE LIVE LEADER POINT RATHER THAN recoverStep's CACHED `aim`.
   That cache is refreshed only once the leader is MOVE.staleSlack (60) away
   from it, which is the constant measured to set how loosely a follower tracks
   - mean 44 at 60 against mean 18 at 15. Aiming live gets that tightening here
   WITHOUT moving staleSlack, which would change recoverStep's behaviour too. */
async function followStep(lp, gap) {
	const step = Math.min(MOVE.closeStepMax, gap - leash().releaseAt);
	if (step <= 0) return;
	const a = Math.atan2(lp.y - character.real_y, lp.x - character.real_x);
	const nx = character.real_x + Math.cos(a) * step, ny = character.real_y + Math.sin(a) * step;
	try {
		if (!isFn(can_move_to) || can_move_to(nx, ny)) { move(nx, ny); bump('followSteps'); }
		else bump('followBlocked');
	} catch (e) { bump('followBlocked'); }
}

function leaderPos() {
	const e = leaderEntity();
	if (here(e)) return { x: e.real_x !== undefined ? e.real_x : e.x, y: e.real_y !== undefined ? e.real_y : e.y };
	/* SAME ROOT CAUSE AS leaderMap BELOW, AND NO OBSERVED SYMPTOM IS ATTRIBUTED TO
	   IT - this was latent, not the backtracking. The party row that measured 975u,
	   1418u and 2558u stale was this fallback's source too, so it could steer a
	   follower that far off a leader it simply could not see. The beacon is the
	   same substitution, with the same staleness gate. */
	try {
		const st = beacons()[leaderName()];
		if (st && st.x != null && st.map === character.map && Date.now() - st.t <= TROUBLE.staleMs) return { x: st.x, y: st.y };
	} catch (e) {}
	return null;
}
/* THE PARTY ROW IS GONE FROM BOTH OF THESE, AND IT IS WHY FOLLOWERS WALKED BACK
   TO THE DOOR THEY HAD JUST COME THROUGH. Operator, 2026-10-19: "the party kept
   moving between the entrance they just passed through onto the new floor and the
   leader... At all times during this behavior both the door and the leader were in
   vision range of the follower."

   leaderMap() read ONLY parent.party and never consulted parent.entities, so
   followFloor() could fire with the leader standing in plain sight. After the party
   takes a door onto floor N+1 the row still names floor N while it is stale, and
   the door matching `d.to === lm` IS THE ENTRANCE THEY JUST USED; followFloor
   returning true skips cohesion entirely. When the row refreshes, lm ===
   character.map, it returns false, and recoverStep aims at the leader. Entrance,
   leader, entrance, leader - stopping once the row settles, which is also once
   they are far from the door. The same failure shape is already recorded above
   followFloor from a different trigger (a death and respawn), so this is its
   second trigger rather than a new class.

   HOW STALE THE ROW GETS, measured live 2026-10-19 at 250ms on two followers:
   parent.party[*].x,y is a SPARSE SNAPSHOT, not a lagging position - one change in
   26.6s across 53 ticks, a 975-unit snap, and a separate 7.2s window frozen while
   the leader entity moved ~290u. The two candidate leader positions were 2558u then
   1418u apart, with both followers recording the same 1418u split at the same
   moment. Beacons are ~100x fresher.

   A VISIBLE LEADER IS ON THIS MAP BY DEFINITION, so clause one is not circular:
   here(e) is `e && !e.rip && (!e.map || e.map === character.map)`. Clause two
   handles the genuine cross-floor case from the leader's own beacon, which
   beaconWrite() refreshes unconditionally every TROUBLE.beaconMs for every
   CaveRun character including the leader, and which carries `map`. A beacon more
   than TROUBLE.staleMs old during a cave run means the leader's script is not
   ticking, and chasing a door on that basis is pointless - so it answers null and
   moveTick's `if (!lp)` path handles it. */
function leaderMap() {
	try { if (here(leaderEntity())) return character.map; } catch (e) {}
	try { const st = beacons()[leaderName()]; if (st && st.map && Date.now() - st.t <= TROUBLE.staleMs) return st.map; } catch (e) {}
	return null;
}

/* active() replaces v6's bare phase === 'inside' test, which made an on-map
   rehearsal impossible: both combatTick and moveTick returned immediately
   anywhere but inside the cave, so nothing could be exercised without
   spending the one daily run. */
/* True for dry AND crypt: both run outside the Cave, where `inside` never
   arrives because nothing sets it. */
function offCave() { return mode !== 'cave'; }
function active() { return offCave() ? phase === 'active' : phase === 'inside'; }

/* Did this one start it? Retaliation is judged from the monster's own target,
   so there is no flag to thread through pickTarget and no way for the two
   gates in combatTick to disagree about what counts as self-defence. */
function attackingUs(t) {
	try {
		if (!t || !t.target) return false;
		return partyNames().indexOf(t.target) >= 0;
	} catch (e) { return false; }
}

/* Open in every mode but crypt, so nothing else changes.

   Three outcomes, in order, and the order is the safety property:
     1. on `never`  -> refused, even in self-defence. These win the fight.
     2. on `only`   -> may be initiated on. This is the hunt.
     3. otherwise   -> only if it is already hitting a party member.
   A monster that wanders into range and is ignoring us is still left alone. */
function mayAttack(t) {
	if (mode !== 'crypt') return true;
	if (!t || !t.mtype) return false;
	if (CRYPT.never.indexOf(t.mtype) >= 0) return false;
	if (cryptAuto && character.map === 'crypt') return cryptMayAttack(t, crunEffective());
	if (CRYPT.only.indexOf(t.mtype) >= 0) return true;
	return attackingUs(t);
}

// ------------------------------------------------------------- threats -----
function threats() {
	const out = [];
	try {
		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (!e || e.type !== 'monster' || e.dead || (e.map && e.map !== character.map)) continue;
			out.push(e);
		}
	} catch (e) {}
	return out;
}
function partyNames() { try { const n = Object.keys(parent.party || {}); return n.length ? n : [character.name]; } catch (e) { return [character.name]; } }
function monsterOnParty() {
	const names = partyNames();
	return threats().some((m) => m.target && names.indexOf(m.target) >= 0);
}
function attackersOnMe() { let n = 0; for (const m of threats()) if (m.target === character.name) n++; return n; }

/* A MEMBER IN TROUBLE COUNTS AS THE PARTY BEING ENGAGED, which is what makes
   the other two assist instead of walking on. monsterOnParty only sees
   monsters in the reader's OWN entity list, so the one case that matters - a
   member mobbed far enough back to be out of range - is invisible to it. The
   beacon is not, and holding the engagement open keeps pickTarget unlocked and
   the leash on its combat numbers until it is sorted out. */
function noteEngagement() {
	const e = leaderEntity();
	if ((e && e.target) || monsterOnParty() || troubleNow.length) engagedUntil = Date.now() + CFG.engageHoldMs;
}
function engaged() { return Date.now() < engagedUntil; }

function inRangeFor(t, skill) {
	if (!t) return false;
	try { if (isFn(is_in_range)) return skill ? is_in_range(t, skill) : is_in_range(t); } catch (e) {}
	return true;
}

/* NEVER SWING AT A SIDE THE SERVER WILL REFUSE - v25. The 2026-10-23 run spent
   2,394 of Dexon's attacks and 2,242 of MageofOz's on ONE entity, a
   "Counterweight Sentinel" that the encounter had made friendly, from 15:03
   until the exit at 15:18; can_attack() read true throughout. The rule is the
   server's: a player's hostile skill is refused unless the target's cave side
   is something other than neutral or ally, and the server sends that side on
   every cave monster as `cave: {room, side, citizen}` and again whenever it
   changes. `victim` is added on the operator's ruling: a player CAN hit one,
   and killing it forfeits the save the party voted for. `finish` turns the
   victim into `enemy`, so that choice still gets its fight.
   friendlySkip is the backstop for an entity whose side never arrived: a
   friendly_target refusal benches that id for friendlyBenchMs. */
const FRIENDLY_SIDES = ['neutral', 'ally', 'victim'];
const friendlyBenchMs = 10000;
let friendlySkip = {};
function caveFriendly(t) {
	try { const c = t && t.cave; if (c && FRIENDLY_SIDES.indexOf(c.side) >= 0) return true; } catch (e) {}
	const until = t && friendlySkip[t.id];
	return !!(until && Date.now() < until);
}
function mayTarget(t) {
	if (!t || t.type !== 'monster' || t.dead || !mayAttack(t)) return false;
	if (caveFriendly(t)) { bump('friendlySkips'); return false; }
	return true;
}

function pickTarget() {
	if (!engaged()) return null;
	/* THE WHITELIST IS APPLIED TO ALL THREE PATHS, and the third is the one that
	   matters. Following the leader's target and the "already hitting us" scan
	   are both bounded by what the party is doing; the get_nearest_monster
	   fallback is not bounded by anything, and in the Crypt the nearest monster
	   is eventually Marceline. */
	try {
		const le = leaderEntity();
		if (le && le.target) {
			const t = parent.entities[le.target];
			if (mayTarget(t) && inRangeFor(t)) return t;
		}
	} catch (e) {}
	const names = partyNames();
	let best = null, bestD = Infinity;
	for (const m of threats()) {
		if (!m.target || names.indexOf(m.target) < 0) continue;
		if (!mayTarget(m)) continue;
		const d = dist(character, m);
		if (d < bestD && inRangeFor(m)) { best = m; bestD = d; }
	}
	if (best) return best;
	try { if (isFn(get_nearest_monster)) { const n = get_nearest_monster(); if (n && !caveFriendly(n) && inRangeFor(n) && mayAttack(n)) return n; } } catch (e) {}
	/* The nearest monster can be the friendly one, which used to end the search
	   there; take the nearest one we may hit instead. */
	for (const m of threats()) {
		if (!mayTarget(m)) continue;
		const d = dist(character, m);
		if (d < bestD && inRangeFor(m)) { best = m; bestD = d; }
	}
	return best;
}

// -------------------------------------------------------------- skills -----
/* Self-configuring: class, level, mp, cooldown AND equipment slot. The slot
   check is what makes scare self-gating - G.skills.scare declares
   slot [["orb","jacko"]], so the mage uses it only while the jacko is on. */
function haveSkill(name) {
	try {
		const s = parent.G.skills[name];
		if (!s) return false;
		if (s.class && s.class.indexOf(character.ctype) < 0) return false;
		if (s.level && character.level < s.level) return false;
		if (s.mp && character.mp < s.mp) return false;
		if (s.slot) {
			let ok = false;
			for (let i = 0; i < s.slot.length; i++) {
				const sl = s.slot[i][0], item = s.slot[i][1];
				try { const eq = character.slots[sl]; if (eq && eq.name === item) { ok = true; break; } } catch (e) {}
			}
			if (!ok) return false;
		}
		if (isFn(is_on_cooldown) && is_on_cooldown(name)) return false;
		return true;
	} catch (e) { return false; }
}
function allies() {
	const out = [];
	for (const nm of partyNames()) {
		const e = nm === character.name ? character : (parent.entities || {})[nm];
		if (here(e)) out.push(e);
	}
	return out;
}
function hurtAlly(frac) {
	let worst = null, w = 1;
	for (const a of allies()) { const f = a.hp / a.max_hp; if (f < w) { w = f; worst = a; } }
	return w < frac ? worst : null;
}

/* v6 swallowed the reason: catch (e) { tel.skillFail[name]++ }. curse came back
   1113 failures against 42 successes with nothing to say why, and energize
   538 against 3. Both were out-of-range calls - local throws from use_skill,
   which never reach game_response, so the socket tally could not see them
   either. The reason is recorded now. */
async function telUse(name, a, b) {
	try {
		const r = b !== undefined ? await use_skill(name, a, b) : (a !== undefined ? await use_skill(name, a) : await use_skill(name));
		tel.skills[name] = (tel.skills[name] || 0) + 1; return r;
	} catch (e) { noteWhy(name, e, a && typeof a === 'object' ? a : undefined); throw e; }
}
/* FRIENDLY_TARGET FORENSICS - read-only, and deliberately NOT in the event ring.
   The 2026-10-10 run produced 1,779 attack/curse refusals reading
   "friendly_target": 578 on the priest, 613 on Dexon, 588 on MageofOz, against
   735 swings that landed. Roughly 70% of the party's damage never left the
   ground, and nothing in game said so - the catch swallows it and only the v7
   reason tally revealed it at all.

   TWO EXPLANATIONS SURVIVE READING, WHICH IS WHY THIS MEASURES INSTEAD.
     a) an encounter NPC that was fought - the operator chose a fight option
     b) an encounter that ATTACHES friendly monsters to the party - several
        exist (monster_handler: wolves/lure/trade, pact_broker: hire). Those
        would be type "monster" client-side, so threats() and the
        get_nearest_monster() fallback would both return them happily and every
        attack would be refused.
   The shape of the numbers leans to (b): ~1/second per character sustained
   across 10.5 minutes is not the burst a single encounter produces. But that
   is an argument, not a measurement.

   WHAT DISTINGUISHES THEM is the time spread per target. One entity seen for
   ten minutes is an attached ally; several entities inside one short window is
   the encounter. So this records first/last/count per distinct target rather
   than a running total.

   It is NOT put in tel.events on purpose. That ring is 80 entries and the loot
   loop filled 75 of them with identical open_chest refusals in the last run,
   evicting everything else - so anything that matters has to live outside it. */
const FRIENDLY_CAP = 16;
function noteFriendly(skill, target) {
	try {
		if (!target) return;
		const key = String(target.id || target.name || '?') + '/' + skill;
		const f = tel.friendly;
		if (!f[key]) {
			if (Object.keys(f).length >= FRIENDLY_CAP) { tel.friendlyOverflow = (tel.friendlyOverflow || 0) + 1; return; }
			f[key] = {
				n: 0, first: Date.now(), last: 0, skill: skill,
				id: target.id || null, name: target.name || null,
				type: target.type || null, mtype: target.mtype || null,
				ctype: target.ctype || null, npc: target.npc || null,
				owner: target.owner || null, team: target.team || null,
				/* the client-side check the attack path already consults - if it
				   says yes while the server says friendly, that disagreement is
				   the whole bug */
				canAttack: (function () { try { return isFn(can_attack) ? !!can_attack(target) : null; } catch (e) { return 'threw'; } })(),
				inParty: partyNames().indexOf(target.name) >= 0,
				/* the field v25 filters on - a refusal on a target reading enemy or
				   predator here would mean the side rule is not the whole story */
				side: (target.cave && target.cave.side) || null,
				map: character.map, floor: (caveState() || {}).floor,
			};
		}
		f[key].n++; f[key].last = Date.now();
	} catch (e) {}
}
function noteWhy(name, e) {
	tel.skillFail[name] = (tel.skillFail[name] || 0) + 1;
	let r = 'unknown';
	try { r = String((e && (e.reason || e.response || e.message)) || e).slice(0, 48); } catch (x) {}
	if (!tel.skillFailWhy[name]) tel.skillFailWhy[name] = {};
	tel.skillFailWhy[name][r] = (tel.skillFailWhy[name][r] || 0) + 1;
	if (r === 'friendly_target' && arguments.length > 2) {
		try { noteFriendly(name, arguments[2]); } catch (x) {}
		try {
			const t = arguments[2];
			if (t && t.id != null) friendlySkip[t.id] = Date.now() + friendlyBenchMs;
			throttleLog('refused friendly_target on ' + (t && (t.name || t.mtype)) + ' side ' + ((t && t.cave && t.cave.side) || 'unknown') + ' - benched');
		} catch (x) {}
	}
}

async function priestSkills(target) {
	/* v36: an absorb the member a2 is on cannot live without goes before any
	   heal - the next anger tick would come too late for the heal to matter. */
	let absorbPick = null;
	if (cryptRunHere() && haveSkill('absorb') && !crA2HoldFire(Date.now())) {
		absorbPick = cryptAbsorbPick(Date.now());
		if (absorbPick && absorbPick.kind === 'emergency' && await cryptAbsorb(absorbPick, Date.now())) return true;
		if (absorbPick && !absorbPick.e) crSay('absorbNo-' + absorbPick.kind, 'not absorbing a2: ' + absorbPick.why, 'orange', 8000);
	}
	const hurtCount = allies().filter((a) => a.hp / a.max_hp < CFG.partyHealAt).length;
	if (hurtCount >= 2 && haveSkill('partyheal')) { try { await telUse('partyheal'); return true; } catch (e) {} }
	const ally = hurtAlly(CFG.healAt);
	/* HEAL WAS THE ONE SKILL THAT SKIPPED haveSkill(). Every other call in this
	   file is gated by it - and haveSkill is where is_on_cooldown lives - so
	   heal alone fired every tick an ally was hurt, cooldown or not. Measured
	   in the 2026-10-10 cave run: 145 heal failures, 142 of them purely
	   "cooldown". Nothing broke, because the catch swallows it, which is
	   exactly why it survived two versions.
	   Safe to gate: G.skills.heal declares class ["priest"] and NOTHING else -
	   no level, no mp, no slot - so haveSkill('heal') reduces to the class test
	   plus the cooldown, and cannot refuse a heal the server would have taken.
	   Note heal carries `share`, so its cooldown is not its own; the gate stops
	   the wasted call either way. */
	if (ally && haveSkill('heal') && inRangeFor(ally, 'heal')) { try { await heal(ally); tel.skills.heal = (tel.skills.heal || 0) + 1; return true; } catch (e) { noteWhy('heal', e); } }
	if (target && haveSkill('curse') && inRangeFor(target, 'curse') && !(target.s && target.s.cursed)) {
		try { await telUse('curse', target); return true; } catch (e) {}
	}
	if (cryptRunHere()) {
		/* v35: a2 is kept cursed the whole fight (P2) - never while the party
		   is holding fire on him. v36: the soak absorb (P3) comes after the
		   heals; the emergency one went before them, at the top. */
		const a2 = crA2(), hold = crA2HoldFire(Date.now());
		if (!hold && absorbPick && absorbPick.kind === 'soak' && await cryptAbsorb(absorbPick, Date.now())) return true;
		if (a2 && !hold && crOnParty(a2) && haveSkill('curse') && inRangeFor(a2, 'curse') && !(a2.s && a2.s.cursed)) {
			try { await telUse('curse', a2); bump('a2Curses'); return true; } catch (e) {}
		}
	} else if (haveSkill('absorb')) {
		const le = leaderEntity();
		if (here(le) && inRangeFor(le, 'absorb') && threats().filter((m) => m.target === leaderName()).length >= 3) {
			try { await telUse('absorb', le); return true; } catch (e) {}
		}
	}
	return false;
}
async function mageSkills(target) {
	/* Scare first: it is a survival action and its whole point is shedding the
	   pack already on her. haveSkill() has verified the jacko is equipped. */
	if (cryptRunHere()) {
		/* v35: a2 on her - scare right after a tick (P1), else blink just
		   before one (P5); either way past 300 before the next. */
		const a2 = crA2(), now = Date.now(), a8 = crA8();
		/* v37, ruling 3: a8 on her - she scares it; it has no anger, so it
		   stays off until hit or faced within 35. */
		if (a8 && a8.target === character.name && haveSkill('scare')) {
			try { await telUse('scare'); bump('a8Scares'); crSay('a8scare-' + now, 'a8 was on me - scared it off', '#7FD1FF', 0); return true; } catch (e) {}
		}
		/* v37, (f): a2 on her with no way past 300 - scare again, else blink past him. */
		if (a2 && a2.target === character.name && now - crA2Stuck < 2000) {
			if (haveSkill('scare')) { try { await telUse('scare'); bump('scares'); crA2Disengage(a2, 'scared a2 off again, cornered', now); return true; } catch (e) {} }
			const bp = haveSkill('blink') ? crA2BlinkPoint(a2, crunEffective()) : null;
			if (bp) { try { await telUse('blink', [bp.x, bp.y]); bump('blinks'); crA2Disengage(a2, 'blinked past a2, cornered', now); return true; } catch (e) {} }
		}
		if (a2 && haveSkill('scare') && cryptScareWanted(a2)) {
			try { await telUse('scare'); bump('scares'); crA2Disengage(a2, 'scared a2 off', now); return true; } catch (e) {}
		} else if (a2 && !haveSkill('scare') && haveSkill('blink') && cryptBlinkWanted(a2)) {
			const p = crA2AwayPoint(a2, crunEffective());
			if (p) { try { await telUse('blink', [p.x, p.y]); bump('blinks'); crA2Disengage(a2, 'blinked clear of a2', now); return true; } catch (e) {} }
		}
	} else if (haveSkill('scare')) {
		const n = attackersOnMe();
		if (n >= CFG.scareAt || (n >= 1 && character.hp / character.max_hp < CFG.scareHpAt)) {
			try { await telUse('scare'); bump('scares'); return true; } catch (e) {}
		}
	}
	if (haveSkill('energize')) {
		const le = leaderEntity();
		const to = here(le) && le.mp != null && le.max_mp && le.mp / le.max_mp < 0.5 && inRangeFor(le, 'energize') ? le : null;
		if (to) { try { await telUse('energize', to); return true; } catch (e) {} }
	}
	if (target && haveSkill('cburst') && inRangeFor(target, 'cburst')) { try { await telUse('cburst', [[target.id, character.mp * 0.5]]); return true; } catch (e) {} }
	return false;
}

async function combatTick() {
	if (stopped || !active() || character.rip) return;
	if (cavePaused()) { bump('pausedAttackSkipped'); return; }
	noteEngagement();
	const target = pickTarget();
	try {
		if (character.ctype === 'priest') { if (await priestSkills(target)) return; }
		else if (character.ctype === 'mage') { if (await mageSkills(target)) return; }
	} catch (e) {}
	if (!target) {
		/* v6 bumped this whenever engaged with no target, which the 8s
		   engagement hold alone explains - 32 idle ticks after every kill.
		   Only count it when there is something visible we cannot act on. */
		if (engaged() && threats().length) bump('noTargetWhileEngaged');
		return;
	}
	try {
		/* SECOND GATE, deliberately redundant with pickTarget. Everything this
		   mode exists to prevent funnels through this one call, so it is worth
		   paying for twice - a future edit to pickTarget cannot quietly reopen
		   it. If this ever fires, the first gate has a hole. */
		if (!mayAttack(target)) { bump('cryptBlocked'); return; }
		if (isFn(can_attack) && !can_attack(target)) return;
		if (!isLeader()) change_target(target);
		await attack(target);
		bump('attacks');
	} catch (e) { bump('attackFail'); noteWhy('attack', e, target); }
}

// ------------------------------------------------------------ movement -----
function kiteStep(lp) {
	const L = leash();
	const hurt = character.hp / character.max_hp < 0.5;
	const near = threats()
		.filter((m) => dist(character, m) < MOVE.kiteRadius)
		.filter((m) => hurt || !m.speed || character.speed > m.speed * MOVE.speedEdge);
	if (!near.length) return null;
	const gapNow = lp ? Math.hypot(character.real_x - lp.x, character.real_y - lp.y) : 0;
	let best = null, bestScore = -Infinity;
	for (let i = 0; i < 12; i++) {
		const a = (Math.PI * 2 * i) / 12;
		const nx = character.real_x + Math.cos(a) * MOVE.kiteStep;
		const ny = character.real_y + Math.sin(a) * MOVE.kiteStep;
		if (isFn(can_move_to) && !can_move_to(nx, ny)) continue;
		/* v37, ruling 4: never into the bat box in a crypt run. */
		if (cryptAuto && mode === 'crypt' && character.map === 'crypt' && crInBox({ x: nx, y: ny }, 10)) continue;
		/* NO RATCHETING OUTWARD. The ceiling alone let the follower walk itself
		   to the top of the dead band and park there - harness measured it
		   settling at 177 with a mob glued 40u away, which is a hair inside the
		   priest's 201 heal range and no margin at all. Past releaseAt a kite
		   step may hold the gap or shrink it, never grow it, so kiting becomes
		   tangential instead of a slow retreat. */
		if (lp) {
			const gapNew = Math.hypot(nx - lp.x, ny - lp.y);
			if (gapNew > L.ceiling) continue;
			/* IN TRAVEL MODE THE NO-RATCHET RULE IS UNCONDITIONAL, AND v15's
			   NARROWER BAND IS UNSAFE WITHOUT IT. The clause below only bites
			   past releaseAt, which was sound while the band was wider than
			   kiteStep: a free 55u step taken from releaseAt 60 landed at ~115,
			   still inside closeAt 120, so it could not latch. v15's band is
			   60-30, so the same step from 30 lands at ~85 - past closeAt 60 -
			   and the follower latches recovering, closes to 30, and is free to
			   kite out again. That is v6's oscillation returning by the exact
			   mechanism this block was written to prevent, and it needs no
			   engagement to fire: kiteStep asks only for a threat inside
			   kiteRadius 90, while computeLeash stays in travel mode until
			   something is engaged, attacking, or in trouble. A monster wandering
			   past at 80u is enough.
			   So in travel mode a kite step may hold the gap or shrink it and
			   never grow it, whatever the current gap. Kiting stays tangential,
			   which is what the paragraph above already asks for; what it loses
			   is the slow retreat, and out of combat staying with the party is
			   worth more than backing away from a monster that is not attacking. */
			if ((gapNow > L.releaseAt || noRatchetAlways(L)) && gapNew > gapNow + 1) continue;
		}
		let minD = Infinity;
		for (const m of near) minD = Math.min(minD, Math.hypot(nx - (m.real_x !== undefined ? m.real_x : m.x), ny - (m.real_y !== undefined ? m.real_y : m.y)));
		if (minD > bestScore) { bestScore = minD; best = { x: nx, y: ny }; }
	}
	if (!best) return null;
	let cur = Infinity;
	for (const m of near) cur = Math.min(cur, dist(character, m));
	return bestScore > cur + 8 ? best : null;
}

/* A locked door is not a door. v6 retried every 3s forever and, worse,
   returned true the whole time - which blocked cohesion entirely. doorOk was
   0 across a 29-minute run while the leader was never actually on another
   floor; the trigger was his death and respawn. */
async function followFloor() {
	if (offCave()) return false;
	const lm = leaderMap();
	if (!lm || lm === character.map) return false;
	const st = caveState();
	const doors = (st && st.doors) || [];
	const door = doors.filter((d) => d.to === lm && !d.locked)[0];
	if (!door) {
		if (!deadDoors[lm]) { deadDoors[lm] = 1; throttleLog('leader on ' + lm + ' - no open door from here, holding station'); ev('noDoor', lm); }
		return false;   // NOT true - never block cohesion on a door we cannot take
	}
	if (Math.hypot(door.x - character.real_x, door.y - character.real_y) > CFG.doorNear) {
		try { await smart_move({ map: character.map, x: door.x, y: door.y }); } catch (e) {}
		return true;
	}
	if (Date.now() - lastDoorTry < 3000) return true;
	lastDoorTry = Date.now();
	bump('doorTry');

	/* DOOR RECON - v11. v10 called transport() 24 times across the only two
	   doors in the run and got zero successes, every one refused with
	   transport_cant_reach, and nothing recorded said why. followFloor hashes
	   IDENTICALLY at v7, v9 and v10, so the version is not the variable and
	   neither is the leader - both were ruled out. Three explanations survive:
	     a) transport() is the wrong mechanism for a cave floor door
	     b) right mechanism, wrong spawn - transport(to, 0) hardcodes spawn 0
	     c) doorNear 40 is looser than the server's own reach check, or the
	        character is still in motion when the call lands
	   (b) shows up as doorShape carrying a spawn/index field we are ignoring.
	   (c) shows up as gap clustering near 40, or moving:true on the failures.
	   (a) is what is left when neither of those appears.

	   Object.keys IS the honest tool here, unlike the chest case below: a door
	   is a plain server object, not a PIXI sprite with accessors on a
	   prototype. Recorded on EVERY attempt rather than once, because the gap
	   at the moment of the call is the variable in (c) and one sample cannot
	   show a distribution. Two doors a run means ~24 records - nothing. */
	const rec = {
		to: lm, spawnSent: 0,
		doorX: Math.round(door.x), doorY: Math.round(door.y),
		myX: Math.round(character.real_x), myY: Math.round(character.real_y),
		gap: Math.round(Math.hypot(door.x - character.real_x, door.y - character.real_y)),
		doorNear: CFG.doorNear, moving: !!character.moving, map: character.map,
	};
	if (!tel.doorShape) {
		try { tel.doorShape = { keys: Object.keys(door), sample: JSON.parse(JSON.stringify(door)) }; }
		catch (e) { tel.doorShape = { keys: null, why: String(e) }; }
	}
	clog('taking the door to ' + lm + ' (gap ' + rec.gap + ')', '#7FD1FF');
	try { await transport(door.to, 0); rec.ok = true; bump('doorOk'); }
	catch (e) {
		rec.ok = false;
		rec.why = String((e && (e.reason || e.message)) || e);
		clog('transport refused: ' + rec.why + ' at gap ' + rec.gap, 'orange');
	}
	rec.afterX = Math.round(character.real_x);
	rec.afterY = Math.round(character.real_y);
	rec.afterMap = character.map;
	if (tel.doors.length < 40) tel.doors.push(rec);
	ev(rec.ok ? 'doorOk' : 'doorFail', rec);
	return true;
}

/* OUT OF COMBAT, for R3: nothing in view is on a party member. Deliberately
   not engaged(), whose hold timer also counts the leader's own `target` - a
   field that can name a monster long dead, which the first live crypt run
   suspected of keeping the followers in the combat band. */
function partyFighting() {
	const names = partyNames();
	if (threats().some((m) => m.target && names.indexOf(m.target) >= 0 && !caveFriendly(m))) return true;
	/* v35: and a mate out of my view with something on it, from its beacon - a
	   rested member at the crypt entrance cannot see the fight it would join. */
	try {
		const bs = beacons(), now = Date.now();
		for (const n in bs) {
			const b = bs[n];
			if (n === character.name || !b || now - b.t > TROUBLE.staleMs || b.map !== character.map) continue;
			if (b.atk > 0) return true;
		}
	} catch (e) {}
	return false;
}
function joinWanted(gap) {
	return !!MOVE.joinStationary && gap > MOVE.joinAt && !leaderMoving() && !partyFighting();
}
/* Straight onto the spot where nothing is in the way; round an obstacle once,
   under the same in-flight watchdog as recoverStep. */
async function joinStep(lp, gap) {
	try {
		if (!isFn(can_move_to) || can_move_to(lp.x, lp.y)) { move(lp.x, lp.y); bump('joinSteps'); return; }
	} catch (e) { return; }
	if (smartFlight && Date.now() - smartFlight < MOVE.smartMoveMaxMs) return;
	smartFlight = Date.now();
	bump('joinSmart');
	try { await smart_move({ map: character.map, x: lp.x, y: lp.y }); } catch (e) { ev('joinSmartFail', String((e && (e.reason || e.message)) || e)); }
	smartFlight = 0;
}

async function recoverStep(lp, gap) {
	/* v37, ruling 4: in a crypt run, a closing step that would cross the bat
	   box goes by the route instead. */
	if (cryptRunHere() && crCrossesBox(crPos(character), lp)) { crSafeStep(lp, 'recover'); return; }
	if (!aim || Math.hypot(aim.x - lp.x, aim.y - lp.y) > MOVE.staleSlack) aim = { x: lp.x, y: lp.y };
	const direct = !isFn(can_move_to) || can_move_to(aim.x, aim.y);
	if (direct) {
		const step = Math.min(MOVE.closeStepMax, Math.max(30, gap - leash().releaseAt * 0.6));
		const a = Math.atan2(aim.y - character.real_y, aim.x - character.real_x);
		const nx = character.real_x + Math.cos(a) * step, ny = character.real_y + Math.sin(a) * step;
		try { if (!isFn(can_move_to) || can_move_to(nx, ny)) { move(nx, ny); bump('closeSteps'); } } catch (e) {}
		return;
	}
	/* Obstacle in the way - path around it, once. The in-flight guard carries a
	   watchdog because an unsettled smart_move promise is the documented way
	   these chains die silently. */
	if (smartFlight && Date.now() - smartFlight < MOVE.smartMoveMaxMs) return;
	smartFlight = Date.now();
	bump('closeSmart');
	try { await smart_move({ map: character.map, x: aim.x, y: aim.y }); } catch (e) { ev('closeSmartFail', String((e && (e.reason || e.message)) || e)); }
	smartFlight = 0;
}

async function moveTick() {
	if (stopped || character.rip) return;
	if (cavePaused()) { bump('pausedMoveSkipped'); return; }

	if (phase === 'restock') { await restockTick(); return; }

	if (phase === 'gather') {
		if (character.map !== CFG.keeper.map || dist(character, CFG.keeper) > CFG.stageWithin) {
			try { await smart_move({ map: CFG.keeper.map, x: CFG.keeper.x, y: CFG.keeper.y }); } catch (e) {}
		}
		return;
	}
	restTick();
	/* v32: a crypt run owns the move outside the crypt, inside it for the
	   leader, and for a follower while the leader is down or away. */
	if (cryptAuto && mode === 'crypt' && active() && await cryptMoveTick()) return;
	if (isLeader()) {
		/* The leader never reaches noteLeaderMotion below, so without this its
		   own leaderMovedAt stays 0 and computeLeash would report the
		   stationary band at all times. Nothing ACTS on the leader's leash -
		   the hold reads MOVE.* directly and moveTick returns here - but
		   caveLeash() reports it, and a probe that lies is this file's most
		   expensive recurring cost. */
		noteLeaderMotion({ x: character.real_x, y: character.real_y });
		/* ONLY WHILE A RUN IS ACTIVE - v25. The 2026-10-23 dump caught the hold
		   still firing on main after the exit, at a 1,453u "gap" to followers
		   who were simply elsewhere. */
		if (active()) warnOutrun();
		/* v27: and then the autopilot, which moves the leader unless the hold
		   above has stopped him or the operator has turned it off. */
		if (active()) await navTick();
		return;
	}
	if (!active()) return;
	/* v27: healer dead or two dead - pull back to the landing. */
	if (!resting && !deathLoop && await followerLanding()) return;

	const lp = leaderPos();
	if (!lp) { if (await followFloor()) return; return; }
	noteLeaderMotion(lp);
	/* RESTING AT THE LANDING, or held there by a death loop: no recovery latch,
	   nothing crosses the floor. combatTick still answers what attacks. */
	if (resting || deathLoop) { recovering = false; aim = null; return; }
	/* A DEAD OR RESTING LEADER IS NOT CHASED - v26. It used to pull both
	   followers back across the floor, fighting without heals on the way. They
	   hold where they are and kite; the leader comes back to them. */
	if (leaderDown()) {
		if (recovering) { recovering = false; aim = null; ev('recoverHeld', { why: 'leader down' }); }
		const k = kiteStep(lp);
		if (k) { try { move(k.x, k.y); bump('kiteSteps'); } catch (e) {} }
		return;
	}
	const L = leash();
	const gap = Math.hypot(lp.x - character.real_x, lp.y - character.real_y);
	tel.maxDistLeader = Math.max(tel.maxDistLeader, Math.round(gap));
	if (gap > L.closeAt) tel.msBeyondLeash += CFG.tickMs;

	/* v34, R3: a stationary leader out of combat is joined on his spot. Ahead
	   of the latch, which it replaces in this state; behind everything that
	   holds a follower still. */
	if (joinWanted(gap)) {
		if (recovering) { recovering = false; aim = null; }
		await joinStep(lp, gap);
		return;
	}

	// --- the latch ---
	if (!recovering && gap > L.closeAt) { recovering = true; aim = null; bump('recoveries'); ev('recover', { gap: Math.round(gap), leash: L.mode }); }
	else if (recovering && gap <= L.releaseAt) { recovering = false; aim = null; ev('recovered', { gap: Math.round(gap), leash: L.mode }); }

	if (recovering) { tel.msRecovering += CFG.tickMs; await recoverStep(lp, gap); return; }

	if (await followFloor()) return;

	const k = kiteStep(lp);
	if (k) { try { move(k.x, k.y); bump('kiteSteps'); } catch (e) {} }
	else if (threats().some((m) => dist(character, m) < MOVE.kiteRadius)) bump('kiteRejected');
	/* LAST, so kiting keeps absolute priority - the operator's ruling is that
	   kite range is normal in combat, and this must not become a second thing
	   competing for the same tick. It fills the branch where the follower
	   previously did NOTHING: no kite wanted, no threat in range, and the gap
	   opening because the leader walked off. */
	else if (leaderMoving() && gap > L.releaseAt) await followStep(lp, gap);
}

/* The driver is the only one who can fix an over-extension, and v6 surfaced it
   nowhere - the priest sat 230 seconds outside the leash with no indication in
   game. v14 stops merely surfacing it and acts, under HOLD above. */

/* AN INVISIBLE FOLLOWER USED TO COUNT AS A CLOSE ONE. v13 skipped any mate
   that failed here(), so the single worst case - a member far enough back to
   have dropped out of the entity list, or left behind on the previous floor -
   produced a worst gap of 0 and no warning whatsoever. That is the exact state
   this work exists to catch. An unseen mate now reports Infinity, and the
   beacon is consulted first so a member merely out of render range still
   yields a real distance. A dead one reports 0 here, because a corpse has no
   distance to close; it holds the leader through troubleOf() instead, which
   reads it as 'dead' - the regroup ruling of v26 - and deathTick owns the
   respawn. */
function followerGaps() {
	const bs = beacons(), now = Date.now(), out = [];
	for (const nm of followers()) {
		const e = (parent.entities || {})[nm];
		if (here(e)) { out.push({ who: nm, gap: dist(character, e), src: 'entity' }); continue; }
		const st = bs[nm];
		if (st && st.rip) { out.push({ who: nm, gap: 0, src: 'rip' }); continue; }
		if (st && now - st.t <= TROUBLE.staleMs && st.map === character.map) {
			out.push({ who: nm, gap: Math.hypot(st.x - character.real_x, st.y - character.real_y), src: 'beacon' });
			continue;
		}
		out.push({ who: nm, gap: Infinity, src: st ? 'offmap' : 'unseen' });
	}
	return out;
}
function holdResume() {
	const g = holdGoing;
	holdFrom = 0; holdGoing = null;
	/* The autopilot re-plans by itself; a straight move to one smart_move node
	   would only fight it. */
	if (!g || navDriving()) return;
	try {
		move(g.x, g.y);
		bump('holdResumes');
		clog('party is back - resuming toward ' + Math.round(g.x) + ',' + Math.round(g.y), '#5ED6A8');
		ev('holdResume', { x: Math.round(g.x), y: Math.round(g.y) });
	} catch (e) { bump('holdResumeFail'); }
}
function collectingMove(regroup) {
	try {
		if (!character.moving || character.going_x == null) return false;
		const bs = beacons();
		for (const t of regroup) {
			const b = bs[t.who];
			if (!b || b.map !== character.map) continue;
			const now = Math.hypot(b.x - character.real_x, b.y - character.real_y);
			const then = Math.hypot(b.x - character.going_x, b.y - character.going_y);
			if (then < now - 10) return true;
		}
	} catch (e) {}
	return false;
}
function warnOutrun() {
	try {
		let worst = 0, who = '', src = '';
		for (const g of followerGaps()) if (g.gap > worst) { worst = g.gap; who = g.who; src = g.src; }
		const L = leash();
		const shown = worst === Infinity ? 'OUT OF SIGHT (' + src + ')' : Math.round(worst) + 'u';
		if (worst > L.closeAt) { bump('outrunWarnTicks'); throttleLog('OUTRUNNING PARTY - ' + who + ' is ' + shown + ' back (close at ' + L.closeAt + ')'); }
		if (troubleNow.length) { bump('troubleWarnTicks'); throttleLog('PARTY IN TROUBLE - ' + troubleNow.map((t) => t.who + ':' + t.why).join(', ')); }

		if (!HOLD.enabled) return;
		if (mode === 'crypt' && !HOLD.inCrypt) return;

		/* THE HOLD NO LONGER LATCHES ON THE SAME NUMBERS AS COHESION, AND THAT
		   IS A REVERSAL OF v14's DELIBERATE DESIGN rather than a typo fix. This
		   comment used to say the welding was intentional, and the code matched
		   it; what falsified it was the operator driving a live run, not an
		   inconsistency in the file. Out of combat `L` is the TRAVEL leash, so
		   the leader's stop threshold WAS the same number the followers use to
		   decide to start following - "the stop feature is too close to the
		   distance at which the followers start following so it stops before
		   they start moving". Reading MOVE.* instead pins the hold to the combat
		   pair (180/120) in both modes, so out of combat followers begin closing
		   at 60 while the leader does not halt until 180.

		   HYSTERESIS IS STILL HERE, just on the combat pair: it begins past 180
		   and does not let go until 120, because releasing at the number it
		   caught on is how you get a leader that stutters one step at a time
		   down a corridor. 180 also stays inside the priest's measured 201 heal
		   range, which is why the hold threshold cannot simply be raised to the
		   top of the operator's range - see the v15 block. */
		const need = (holdFrom ? worst > MOVE.holdReleaseAt : worst > MOVE.holdAt) || troubleNow.length > 0;
		if (!need) { holdDone = false; if (holdFrom) holdResume(); return; }
		const regroup = troubleNow.filter((t) => REGROUP_WHY.indexOf(t.why) >= 0);
		/* A REGROUP HOLD STOPS THE LEADER LEAVING, NOT COMING BACK. The operator
		   walks back to collect a member stranded at the landing, so a move whose
		   target is nearer that member than the leader is now passes through. */
		if (regroup.length && collectingMove(regroup)) { bump('regroupCollectMoves'); return; }
		/* v27: the autopilot going back for a member, or to the landing, is the
		   move a regroup hold waits for - it ends the hold rather than fighting it. */
		if (regroup.length && navRegroupMove()) { if (holdFrom) { holdFrom = 0; holdGoing = null; } bump('regroupCollectMoves'); return; }
		if (holdDone && !regroup.length) return;

		if (!holdFrom) {
			holdFrom = Date.now();
			holdGoing = (character.moving && character.going_x != null)
				? { x: character.going_x, y: character.going_y } : null;
			bump('holds');
			clog('HOLDING - ' + (troubleNow.length ? troubleNow.map((t) => t.who + ':' + t.why).join(', ') : who + ' ' + shown + ' back')
				+ (holdGoing ? ' - path cancelled, will resume' : ' - was not moving'), '#FFD700');
			ev('hold', { who: who, src: src, gap: worst === Infinity ? null : Math.round(worst),
				trouble: troubleNow, resume: !!holdGoing });
		}
		if (Date.now() - holdFrom > HOLD.maxMs && !regroup.length) {
			holdDone = true;
			bump('holdGaveUp');
			clog('HOLD GAVE UP after ' + Math.round((Date.now() - holdFrom) / 1000) + 's - ' + who + ' still ' + shown
				+ ' back. Moving on so the run cannot deadlock here.', 'orange');
			ev('holdGaveUp', { who: who, src: src, trouble: troubleNow });
			holdResume();
			return;
		}
		tel.msHolding += CFG.tickMs;
		try { if (character.moving) { move(character.real_x, character.real_y); bump('holdStops'); } } catch (e) {}
	} catch (e) {}
}

/* Read the leash in force, or retune it live: caveLeash({travelCloseAt:140}). */
function caveLeash(patch) {
	if (patch && typeof patch === 'object') {
		for (const k in patch) { if (k in MOVE) MOVE[k] = patch[k]; else if (k in HOLD) HOLD[k] = patch[k]; else if (k in TROUBLE) TROUBLE[k] = patch[k]; }
		leashNow = computeLeash();
	}
	const L = leash();
	clog('leash ' + L.mode + ' - close ' + L.closeAt + ' release ' + L.releaseAt + ' ceiling ' + L.ceiling
		+ (troubleNow.length ? ' | TROUBLE ' + troubleNow.map((t) => t.who + ':' + t.why).join(',') : ''), '#7FD1FF');
	return {
		mode: L.mode, closeAt: L.closeAt, releaseAt: L.releaseAt, ceiling: L.ceiling, tighten: MOVE.tighten,
		travel: { closeAt: MOVE.travelCloseAt, releaseAt: MOVE.travelReleaseAt, ceiling: MOVE.travelCeiling },
		combat: { closeAt: MOVE.closeAt, releaseAt: MOVE.releaseAt, ceiling: MOVE.ceiling },
		/* ONE `hold` KEY. v18 added a second one above the existing report and
		   the later literal silently won, so the pair it added never reached a
		   reader and a deploy probe for it answered "not deployed" on a build
		   that was deployed. Merged in v19 - if a field is wanted here it goes
		   INTO this object, never into a sibling with the same key. */
		hold: {
			holdAt: MOVE.holdAt, holdReleaseAt: MOVE.holdReleaseAt,
			enabled: HOLD.enabled, inCrypt: HOLD.inCrypt, active: holdActive(),
			maxMs: HOLD.maxMs, holding: !!holdFrom, gaveUp: holdDone,
		},
		trouble: troubleNow,
		gaps: isLeader() ? followerGaps().map((g) => g.who + ':' + (g.gap === Infinity ? 'unseen' : Math.round(g.gap)) + '/' + g.src) : null,
	};
}

// ------------------------------------------------------------- restock -----
/* EVERY FACT BELOW WAS MEASURED IN THE LIVE CODE CONTEXT 2026-10-10, because
   three of them would otherwise have been guesses and two would have thrown:

     item_count  is UNDEFINED here. The count is done by hand over
                 character.items, summing q.
     can_buy     is an OBJECT, not a function. Calling it is the Form A hazard
                 from CLAUDE.md - a throw on the first line of a phase handler
                 takes the whole phase with it and looks like dead code. So
                 nothing below calls it, and affordability is checked against
                 G.items[name].g instead.
     fancypots   is the ONLY hpot1 seller placed on main, at -35,-162. `pots`
                 and `wbartender` sell them too but are not on this map. The
                 position is still resolved at runtime; the constant in CFG is
                 only a fallback.

   hpot1 and mpot1 are 100g each. Starting stock when this was written:
   Dexon 1679/922, FatherToken 584/362, MageofOz 1806/40. */
function countItem(name) {
	let t = 0;
	try { for (const it of (character.items || [])) if (it && it.name === name) t += (it.q || 1); } catch (e) {}
	return t;
}
function restockShortfall() {
	const out = {};
	try {
		for (const nm in CFG.restock) {
			const have = countItem(nm);
			if (have < CFG.restock[nm]) out[nm] = CFG.restock[nm] - have;
		}
	} catch (e) {}
	return out;
}
function potVendor() {
	try {
		const sellers = [];
		for (const k in G.npcs) {
			const n = G.npcs[k];
			if (n && n.items && n.items.indexOf && n.items.indexOf('hpot1') >= 0) sellers.push(k);
		}
		for (const n of ((G.maps[CFG.keeper.map] || {}).npcs || [])) {
			if (n && n.position && sellers.indexOf(n.id) >= 0) {
				return { map: CFG.keeper.map, x: Math.round(n.position[0]), y: Math.round(n.position[1]), id: n.id };
			}
		}
	} catch (e) {}
	const f = CFG.vendorFallback;
	return { map: f.map, x: f.x, y: f.y, id: 'fallback' };
}
function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

let restockStarted = 0, restockRound = 0;
function restockReset() { restockStarted = 0; restockRound = 0; }

/* Returns nothing; it drives `phase` itself. Called only from moveTick, so it
   inherits that function's rip / paused guards. */
async function restockTick() {
	if (!restockStarted) {
		restockStarted = Date.now(); restockRound = 0;
		const short = restockShortfall();
		clog('restock: need ' + (Object.keys(short).length ? JSON.stringify(short) : 'nothing')
			+ ' (have ' + CFG.restock.hpot1 + '/' + CFG.restock.mpot1 + ' targets)', '#FFD700');
		ev('restockStart', { short: short, gold: character.gold });
	}

	const short = restockShortfall();
	if (!Object.keys(short).length) {
		clog('potions topped up - heading to Dorr', '#5ED6A8');
		ev('restockDone', { rounds: restockRound });
		phase = 'gather';
		return;
	}

	/* NEVER DEADLOCK THE PARTY ON SHOPPING. Walking in a few hundred potions
	   short is recoverable; three characters standing at a counter forever is
	   not, and it is the failure the operator would be least likely to notice
	   because everything still looks alive. */
	if (restockRound >= CFG.restockRounds || Date.now() - restockStarted > CFG.restockMaxMs) {
		bump('restockGaveUp');
		clog('RESTOCK GAVE UP after ' + restockRound + ' rounds - still short '
			+ JSON.stringify(short) + ' - going to Dorr anyway', 'orange');
		ev('restockGaveUp', short);
		phase = 'gather';
		return;
	}

	const v = potVendor();
	if (character.map !== v.map || dist(character, v) > CFG.restockNear) {
		throttleLog('walking to ' + v.id + ' at ' + v.x + ',' + v.y + ' to restock');
		try { await smart_move({ map: v.map, x: v.x, y: v.y }); }
		catch (e) { bump('restockMoveFail'); ev('restockMoveFail', String((e && (e.reason || e.message)) || e)); }
		return;
	}

	restockRound++;
	for (const nm in short) {
		const n = Math.min(short[nm], CFG.restockChunk);
		const unit = ((G.items[nm] || {}).g) || 0;
		if (unit <= 0) { clog('no price for ' + nm + ' - skipping it', 'orange'); continue; }
		if (n * unit > character.gold) {
			bump('restockBroke');
			clog('cannot afford ' + n + ' x ' + nm + ' (' + (n * unit) + 'g, have ' + character.gold + ')', 'orange');
			ev('restockBroke', { item: nm, want: n, unit: unit, gold: character.gold });
			continue;
		}
		const before = countItem(nm);
		try { await buy(nm, n); bump('buys'); }
		catch (e) { bump('buyErr'); noteWhy('buy_' + nm, e); }
		await pause(500);
		/* JUDGED BY THE INVENTORY, NOT BY THE CALL - the same rule the merchant
		   stand buys use. buy() has been seen to reject a purchase that landed,
		   and a round that trusted the call would either double-buy or stall. */
		const got = countItem(nm) - before;
		if (got > 0) ev('bought', { item: nm, got: got });
		else ev('boughtNothing', { item: nm, asked: n });
	}
	throttleLog('restocking, still short ' + JSON.stringify(restockShortfall()));
}

// ------------------------------------------------------------- potions -----
/* hpot1 gives 400 against ~7000 max hp, so potions are a trickle, not a heal -
   the ladder keeps mp topped first because a dry priest heals nobody. Proven
   live 2026-10-06: ~90% land rate, zero errors, mage 608 -> 2875 mp. */
function potionTick() {
	if (stopped || character.rip) return;
	if (cavePaused()) return;
	const now = Date.now();
	if (now - lastPot < CFG.potMs) return;
	const hpF = character.hp / character.max_hp, mpF = character.mp / character.max_mp;
	let which = null;
	if (hpF < CFG.potHpCrit) which = 'use_hp';
	else if (mpF < CFG.potMpLow) which = 'use_mp';
	else if (hpF < CFG.potHpTop) which = 'use_hp';
	if (!which) return;
	lastPot = now;
	try { use_skill(which); bump(which === 'use_hp' ? 'hpPots' : 'mpPots'); }
	catch (e) { noteWhy(which, e); }
}

// ---------------------------------------------------------------- death ----
/* RESPAWN IS DELIBERATELY CONSERVATIVE, AND HERE IS WHY.
   Measured 2026-10-06: respawn() in the CODE context takes ZERO arguments
   (arity 0, 119 chars) and does nothing but socket.emit("respawn") - there is
   no destination, cost or option parameter to pass. The deployed dreams event
   definition contains NO respawn, revive, death or penalty field either; every
   amber/cost entry in it belongs to an encounter OPTION, i.e. the things the
   party votes on. So the free-vs-paid choice the operator sees on death is not
   reachable from any source available here.
   Rather than invent an emit that might spend the run's amber, this snapshots
   exactly what the cave offers at the moment of death, then calls the only
   parameterless respawn that exists. If the snapshot shows a cost dialog, the
   next run has the exact payload to use and this becomes a one-line change. */
let lastRespawn = 0, wasRip = false, respawnWait = 0, respawnRefusals = 0;
/* THE BACKOFF, AND WHY IT IS DRIVEN BY THE RESPONSE AND NOT BY A CATCH.
   Measured in the 2026-10-10 rehearsal: the priest died once and the server
   answered cant_respawn THREE times before one took. respawn() does not throw
   on that - the refusal arrives through game_response - so a try/catch around
   it sees nothing and a fixed 4s retry just hammers the server. bumpReason
   calls this, which is the only place the refusal is visible. */
function noteRespawnRefused() {
	respawnRefusals++;
	respawnWait = Math.min(CFG.respawnMaxMs, (respawnWait || CFG.respawnMs) * 2);
	ev('respawnRefused', { n: respawnRefusals, nextWaitMs: respawnWait });
}
function deathSnapshot() {
	const snap = {};
	try {
		const c = character.cave;
		snap.caveKeys = c ? Object.keys(c) : null;
		if (c) {
			snap.paused = c.paused; snap.floor = c.floor; snap.gold = c.gold; snap.amber = c.amber;
			snap.limits = c.limits;
			for (const k in c) if (/respawn|revive|death|rip|penalt|cost|offer|prompt|modal/i.test(k)) snap['cave.' + k] = c[k];
			snap.choice = c.choice ? { id: c.choice.id, resolved: !!c.choice.resolved,
				options: (c.choice.options || []).map((o) => ({ id: o.id, cost: o.cost, amber: o.amber })) } : null;
		}
	} catch (e) { snap.err = String(e); }
	try { for (const k in parent) if (/^(modal|dialog|prompt)/i.test(k)) snap['parent.' + k] = typeof parent[k]; } catch (e) {}
	try { snap.map = character.map; snap.x = Math.round(character.real_x); snap.y = Math.round(character.real_y); } catch (e) {}
	return snap;
}
/* DEATHS ARE LOGGED WITH WHAT KILLED THEM - v26. The 2026-10-23 dumps read
   partyDeaths 0, so there was no data at all; each death now writes one line
   to the game log (and so to the bridge's file) with the map, position, fear,
   the monsters on this character and how long it took from 90% hp, and the
   respawn and any re-death are logged the same way. */
let myDeaths = [], hpTrail = [], lastAlive = null, diedAt = 0;
let resting = false, restSince = 0, restSaid = false, deathLoop = false;
function sampleAlive() {
	if (character.rip) return;
	const now = Date.now();
	const f = character.max_hp ? character.hp / character.max_hp : 1;
	hpTrail.push([now, f]);
	while (hpTrail.length && now - hpTrail[0][0] > 30000) hpTrail.shift();
	const on = {};
	for (const m of threats()) if (m.target === character.name) on[m.mtype || '?'] = (on[m.mtype || '?'] || 0) + 1;
	lastAlive = { at: now, map: character.map, x: Math.round(character.real_x), y: Math.round(character.real_y),
		fear: character.fear || 0, attackers: on, hp: Math.round(f * 100) };
}
function msFrom90(now) {
	for (let i = hpTrail.length - 1; i >= 0; i--) if (hpTrail[i][1] >= 0.9) return now - hpTrail[i][0];
	return hpTrail.length ? now - hpTrail[0][0] : null;
}
function deathTick() {
	const rip = !!character.rip;
	if (!rip) sampleAlive();
	if (rip && !wasRip) {
		wasRip = true;
		const now = Date.now();
		diedAt = now;
		myDeaths.push(now);
		bump('partyDeaths');
		const snap = deathSnapshot();
		const la = lastAlive || {};
		const ttd = msFrom90(now);
		snap.n = myDeaths.length; snap.fear = la.fear; snap.attackers = la.attackers; snap.msFrom90 = ttd;
		ev('died', snap);
		clog('DIED (#' + myDeaths.length + ' this run) on ' + (la.map || character.map) + ' at ' + la.x + ',' + la.y
			+ ' - fear ' + (la.fear || 0) + ', attackers ' + JSON.stringify(la.attackers || {})
			+ ', from 90% hp in ' + (ttd == null ? '?' : Math.round(ttd / 1000) + 's'), 'red');
	}
	if (!rip) {
		if (wasRip) {
			wasRip = false;
			respawnWait = 0; respawnRefusals = 0;
			const now = Date.now();
			const recent = myDeaths.filter((t) => now - t <= REGROUP.deathLoopMs).length;
			ev('respawned', { map: character.map, x: Math.round(character.real_x), y: Math.round(character.real_y), recent: recent });
			/* v35: a crypt run rests too - at the crypt entrance, once re-entered
			   (cryptFollowerInside / cryptLeaderInside hold it there). */
			if ((mode === 'cave' && inCave()) || (mode === 'crypt' && cryptAuto)) {
				/* REST AT THE LANDING FIRST - the operator's ruling. The old latch sent
				   a respawned character straight back across the floor, alone. */
				resting = true; restSince = now; restSaid = false; recovering = false; aim = null; crRejoin = false;
				if (recent >= 2) {
					deathLoop = true;
					clog('DEATH LOOP - ' + recent + ' deaths inside ' + Math.round(REGROUP.deathLoopMs / 60000)
						+ ' min. Holding at the landing, defending only, until the party collects me or caveResume().', 'red');
					ev('deathLoop', { recent: recent });
				} else clog('respawned at ' + Math.round(character.real_x) + ',' + Math.round(character.real_y) + ' - resting before rejoining', 'orange');
			} else {
				/* Back on our feet somewhere other than the fight - go to the leader
				   and keep going, which is exactly the recovery latch. */
				recovering = true; aim = null; bump('recoveries');
			}
		}
		return;
	}
	if (!CFG.autoRespawn) return;
	/* v32: in a crypt run a death holds the instance - see cryptMayRespawn(). */
	if (mode === 'crypt' && !cryptMayRespawn(Date.now())) return;
	/* NOT WHILE A VOTE IS OPEN IN THE CAVE. The server offers the revival vote
	   - revive here for Amber, or at the doorway free - only once no other vote
	   is open, and a bare respawn() would take the free doorway before that vote
	   could pick "here". So wait for it, up to REGROUP.reviveWaitMs, and wait a
	   moment after dying for the offer to arrive at all. */
	if (mode === 'cave' && inCave()) {
		const ch = (caveState() || {}).choice;
		const since = Date.now() - diedAt;
		if (since < REGROUP.reviveWaitMs && ((ch && !ch.resolved) || since < REGROUP.offerGraceMs)) {
			throttleLog('dead - waiting for the revival vote before respawning');
			return;
		}
	}
	if (Date.now() - lastRespawn < (respawnWait || CFG.respawnMs)) return;
	lastRespawn = Date.now();
	bump('respawnCalls');
	try { respawn(); } catch (e) { noteWhy('respawn', e); clog('respawn threw: ' + e, 'red'); }
}

/* THE REGROUP - v26, the operator's rulings of 2026-10-24.
   A respawned character rests at the landing until hp, mp and fear are back,
   then walks to the party only when nothing hostile is in view; otherwise it
   stays and the party comes back for it. Two deaths of one character inside
   deathLoopMs is a death loop: it holds at the landing, defending only, until
   the leader reaches it or caveResume(). */
const REGROUP = {
	hpAt: 0.9, mpAt: 0.8,
	restMaxMs: 90000,       // rest ends at this age even short of full, if the path is clear
	hostileWithin: 300,     // a monster this close that is not friendly blocks walking out
	collectedWithin: 150,   // the leader this close has collected a resting member
	deathLoopMs: 300000,
	reviveWaitMs: 75000,    // longest a dead character waits for the revival vote
	offerGraceMs: 3000,
};
function hostileInView() {
	for (const m of threats()) {
		if (caveFriendly(m)) continue;
		if (dist(character, m) <= REGROUP.hostileWithin) return m;
	}
	return null;
}
function restTick() {
	if (!(resting || deathLoop) || character.rip) return;
	const le = leaderEntity();
	if (!isLeader() && here(le) && dist(character, le) <= REGROUP.collectedWithin) {
		clog('the party is here - back to normal', '#7FD98A');
		ev('collected', { loop: deathLoop });
		resting = false; deathLoop = false;
		return;
	}
	/* v27: A LEADER IN A DEATH LOOP IS COLLECTED THE SAME WAY - the followers
	   walk to him (leaderDown() does not hold them for a loop), and he is
	   released once every living one is beside him. Without this nothing but
	   caveResume() could end it, and the autopilot would wait out the run. */
	if (isLeader() && deathLoop) {
		const gaps = followerGaps().filter((g) => g.src !== 'rip');
		if (gaps.length && gaps.every((g) => g.gap <= REGROUP.collectedWithin)) {
			clog('the party has come back for me - back to normal', '#7FD98A');
			ev('collected', { loop: true, leader: true });
			resting = false; deathLoop = false;
			return;
		}
	}
	if (deathLoop) return;
	/* v37, ruling 5: the rest ends the moment something in view is on a party
	   member, and the party fights - a2 came to the door while they rested. In
	   view only: a fight across the map is not a reason to walk off alone. */
	if (threats().some((m) => crOnParty(m) && !caveFriendly(m))) {
		resting = false;
		ev('restDone', { engaged: true });
		clog('resting, but something is on the party - fighting', 'orange');
		if (!isLeader() && mode === 'crypt' && cryptAuto) crRejoin = true;
		return;
	}
	const hp = character.max_hp ? character.hp / character.max_hp : 1;
	const mp = character.max_mp ? character.mp / character.max_mp : 1;
	const full = hp >= REGROUP.hpAt && mp >= REGROUP.mpAt && !(character.fear > 0);
	const aged = Date.now() - restSince >= REGROUP.restMaxMs;
	if (!full && !aged) return;
	/* The leader only waits for hp/mp/fear: the autopilot (v27) or the operator
	   then takes him back to the party, so there is no hostile check to make. */
	const h = isLeader() ? null : hostileInView();
	if (h) {
		if (!restSaid) {
			restSaid = true;
			clog('rested, but ' + (h.mtype || h.name) + ' is ' + Math.round(dist(character, h)) + 'u away - waiting here for the party', 'orange');
			ev('restBlocked', { by: h.mtype || h.name });
		}
		return;
	}
	resting = false;
	ev('restDone', { hp: Math.round(hp * 100), mp: Math.round(mp * 100), aged: aged });
	if (isLeader()) return;
	/* v35: in a crypt run a rested follower joins only a stationary leader out
	   of combat (R3) - see cryptFollowerInside. */
	if (mode === 'crypt' && cryptAuto) { crRejoin = true; clog('rested - rejoining once the leader stops out of combat', '#7FD98A'); return; }
	recovering = true; aim = null; bump('recoveries'); clog('rested - rejoining the party', '#7FD98A');
}
function leaderDown() {
	if (isLeader()) return false;
	const L = leaderName(), b = beacons()[L];
	/* A leader in a DEATH LOOP is not held off: the party walks back to collect
	   him (v27), which is the only thing that ends his loop. */
	if (b && Date.now() - b.t <= TROUBLE.staleMs && (b.rip || (b.rest && !b.loop))) return true;
	const e = leaderEntity();
	return !!(e && e.rip);
}
function caveResume() {
	resting = false; deathLoop = false; recovering = true; aim = null;
	clog('released from the landing by hand', '#FFD700');
	return true;
}

// ---------------------------------------------------------------- vote -----
/* THE PARTY VOTES BY ITSELF ON EVERY ENCOUNTER IT KNOWS - v25, the operator's
   rulings of 2026-10-24. The cave is for Loaded Dice, so Amber is the prize
   and everything below is scored in Amber.

   WHAT THE SERVER SHOWS AND WHAT IT DOES NOT. A vote offers TWO of an
   encounter's six options (one affordable `offer` pick and one random other;
   both when there are only two), so this needs a full ranking rather than a
   single answer. The client payload per option is id, label, cost, amber and
   unavailable - NO effect - so the effects come from the table below, a copy
   of design/events.js `dreams.encounters` at upstream 16881a2. Option ids are
   NOT globally unique (e01's are small/large/six..., the rescues' and
   conflicts' are save/watch/left/right...), so the encounter is identified
   first: from title_message.phrase (event.dreams.<id>.name) when the server
   sends it, else by title, and the 50 titles are distinct.

   UNKNOWN MEANS DO NOT VOTE. An encounter not in the table, or one offering an
   option id the table does not list for it, is logged as UNKNOWN EVENT with
   every option, which the game log file then keeps, and nobody votes: the
   operator has the 60 seconds, whatever he votes on any character is echoed by
   the other two, and if nobody votes the server applies its own fallback.

   VOTES ARE ECHOED BEFORE THEY ARE CHOSEN. Majority (2 of 3) resolves at once
   and a vote cannot be changed, so a character that has not voted copies a
   teammate who has - the leader first - and only the LEADER picks on its own.
   That keeps one decision per encounter rather than three computed from three
   views of the purse.

   THE SCORING, all in Amber, and each number is the operator's ordering
   expressed as a value rather than a measurement:
   - 2+ Amber beats a parcel and a parcel beats 1 Amber, so a parcel is 1.2;
     the rescue table (1.8 Amber expected) is 1.9 and the boss table (1.65
     Amber plus heavier items) 1.95, which keeps both above a parcel and below
     a flat 2 Amber.
   - A fight outcome in an ordinary encounter ends in a parcel when the room
     clears, so it scores a parcel less what it costs: fightBase per fight plus
     a per-monster cost, plus the 0.08 Amber a rat/bat/crab/guard/wolf drops.
   - The 20-second careful parcel beats a 50/50 gamble while carefulMinMs of
     run clock remain and loses to it after, which is the operator's "prefer
     the guaranteed parcel when run time is comfortable, else the gamble".
   - Cave gold is nearly worthless (it never leaves the cave), but it is what
     buys a Loaded Die from a cave merchant, so any option that would take the
     purse below `reserve` is refused while the reserve stands. It stands until
     the third floor's required encounter is done.
   - NEVER: any option that spends Amber (exchanges, the 6-Amber die bet, Amber
     tolls, reviving in place); `wolves` (level-100 wolves at 50x hp);
     `bad_double`; the shadow copy of our strongest fighter; and `bad_fight`,
     which pays nothing.
   - `prefer` pins the operator's explicit orderings ahead of any score: the
     surveyor rescue is save/lure/hire; the rogue is watch, since saving him
     betrays half the time and pays nothing; a conflict is testimony/left/right
     because the surviving ally pays the rescue table.
   When every shown option is refused nobody votes, and the server's fallback
   applies - for a bad encounter that is the 45-second wait, which is exactly
   the operator's "else the time option". */
const VOTE = {
	reserve: 10000,
	carefulMinMs: 300000,
	shopMin: 10000,         // inspecting a shop is worth a die chance only if the purse can pay for one
	value: { parcel: 1.2, rescue: 1.9, boss: 1.95, helper: 0.1, gold: 1 / 50000, reveal: 0.05,
		shop: 1.5, shopPoor: 0.05, lamp: 1.1, tool: 0.4, decoy: 0.1, truce: 0.1, message: 0.1,
		mothsteps: 2.2, moths: 2.05, landing: 0.5 },
	fightBase: 0.1,
	unit: { rat: 0.03, bat: 0.03, crab: 0.05, guard: 0.1, wolf: 0.12, npc: 0.15, rogue: 0.3,
		lockbreaker: 0.5, sentinel: 0.6, mothkeeper: 0.7 },
	kill: { rat: 0.08, bat: 0.08, crab: 0.08, guard: 0.08, wolf: 0.08 },
	never: ['wolves', 'bad_double', 'bad_fight', 'die', 'exchange', 'revive_here'],
	prefer: { e06: ['save', 'lure', 'aid'], e20: ['watch'], e11: ['testimony', 'left', 'right'],
		e14: ['testimony', 'left', 'right'], e24: ['testimony', 'left', 'right'],
		e25: ['testimony', 'left', 'right'] },
	/* [parcels, pays 5,000 gold, chance of missing the count] - the miss chance
	   is a guess, nothing has measured how fast the party clears a hunt. */
	hunt: { hunt: [1, 1, 0.1], hunt_double: [2, 1, 0.3], hunt_helper: [1, 1, 0.05],
		hunt_quick: [0, 0, 0.02], hunt_late: [0, 0, 0.03] },
};

/* The revival a death opens is a vote like any other, outside the encounter
   list: `here` costs 1 Amber per fallen member and is refused, `landing` is
   free and is also the server's fallback. */
const CAVE_REVIVAL = { id: 'revival', n: 'A Hand in the Dark', g: 'positive', k: 'revival', o: [
	{i:'here',e:'revive_here'}, {i:'landing',e:'revive_landing'} ] };

/* GENERATED from upstream 16881a2 design/events.js. Keys: i option id, e
   effect, c cost (cave gold), a amber, n needs a supply, w dice win, s seconds,
   ra practice amber, gd practice guard scale, tr travelers; o outcomes with w
   weight, g gold, a amber, r reward table, f fight 'type:count', fl supply
   flags, j joins, al ally, sh shadow. */
const CAVE_ENCOUNTERS = [
	{ id: 'e01', n: 'Dice in a Tin Cup', g: 'mixed', k: 'dice', o: [
		{i:'small',e:'dice',c:2000,w:4000},
		{i:'large',e:'dice',c:5000,w:10000},
		{i:'six',e:'dice6',c:2000,w:12000},
		{i:'die',e:'die',a:6},
		{i:'favor',e:'favor'},
		{i:'door',e:'dice_room'},
	] },
	{ id: 'e02', n: 'The Unclaimed Parcel', g: 'mixed', k: 'parcel', o: [
		{i:'e02_0',e:'venture',o:[{w:1,r:'parcel'},{w:1,f:'guard:3'}]},
		{i:'e02_1',e:'venture',n:'tool',o:[{w:1,r:'parcel'}]},
		{i:'e02_2',e:'careful'},
		{i:'e02_3',e:'venture',c:2000,o:[{w:1,r:'parcel'}]},
		{i:'e02_4',e:'venture',o:[{w:1,f:'guard:3'}]},
		{i:'e02_5',e:'leave'},
	] },
	{ id: 'e03', n: 'Feed the Vault', g: 'mixed', k: 'lure', o: [
		{i:'e03_0',e:'venture',o:[{w:1,f:'rat:6'}]},
		{i:'e03_1',e:'venture',o:[{w:1,r:'parcel'},{w:1,f:'wolf:2'}]},
		{i:'e03_2',e:'venture',a:2,o:[{w:1,fl:'decoy'}]},
		{i:'e03_3',e:'venture',o:[{w:1,al:1}]},
		{i:'e03_4',e:'venture',o:[{w:1,g:2000}]},
		{i:'e03_5',e:'leave'},
	] },
	{ id: 'e04', n: 'The Hot Forge', g: 'mixed', k: 'forge', o: [
		{i:'e04_0',e:'venture',o:[{w:1,r:'boss'},{w:1,f:'lockbreaker:1'}]},
		{i:'e04_1',e:'venture',a:4,o:[{w:1,r:'parcel'}]},
		{i:'e04_2',e:'venture',o:[{w:1,f:'lockbreaker:1'}]},
		{i:'e04_3',e:'venture',o:[{w:1,fl:'tool'}]},
		{i:'e04_4',e:'venture',o:[{w:1,a:2}]},
		{i:'e04_5',e:'leave'},
	] },
	{ id: 'e05', n: 'The Guard’s Contract', g: 'mixed', k: 'hire', o: [
		{i:'e05_0',e:'venture',c:2000,o:[{w:1,j:1}]},
		{i:'e05_1',e:'venture',o:[{w:1,j:1},{w:1,f:'guard:3'}]},
		{i:'e05_2',e:'venture',o:[{w:1,f:'npc:1'}]},
		{i:'e05_3',e:'venture',o:[{w:1,fl:'truce'}]},
		{i:'e05_4',e:'venture',a:1,o:[{w:1,fl:'lamp'}]},
		{i:'e05_5',e:'leave'},
	] },
	{ id: 'e06', n: 'The Trapped Surveyor', g: 'mixed', k: 'rescue', o: [
		{i:'save',e:'save'},
		{i:'watch',e:'watch'},
		{i:'lure',e:'lure'},
		{i:'aid',e:'hire',c:2000},
		{i:'finish',e:'both'},
		{i:'cover',e:'cover'},
	] },
	{ id: 'e07', n: 'Borrow a Uniform', g: 'mixed', k: 'disguise', o: [
		{i:'e07_0',e:'venture',a:2,o:[{w:1,fl:'truce'}]},
		{i:'e07_1',e:'venture',o:[{w:1,g:2000,fl:'truce'},{w:1,f:'guard:3'}]},
		{i:'e07_2',e:'venture',o:[{w:1,f:'rogue:1'}]},
		{i:'e07_3',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e07_4',e:'venture',o:[{w:1,r:'parcel'}]},
		{i:'e07_5',e:'leave'},
	] },
	{ id: 'e08', n: 'Pick a Fighter', g: 'mixed', k: 'arena', o: [
		{i:'e08_0',e:'venture',o:[{w:1,f:'crab:3'}]},
		{i:'e08_1',e:'venture',o:[{w:1,f:'bat:6'}]},
		{i:'e08_2',e:'venture',o:[{w:1,f:'wolf:2'}]},
		{i:'e08_3',e:'venture',o:[{w:1,f:'lockbreaker:1'}]},
		{i:'e08_4',e:'venture',o:[{w:1,g:3000,r:'parcel'},{w:1,f:'wolf:4'}]},
		{i:'e08_5',e:'leave'},
	] },
	{ id: 'e09', n: 'Finish the Golem', g: 'mixed', k: 'construct', o: [
		{i:'e09_0',e:'venture',a:4,o:[{w:1,al:1}]},
		{i:'e09_1',e:'venture',o:[{w:1,al:1},{w:1,f:'sentinel:1'}]},
		{i:'e09_2',e:'venture',o:[{w:1,f:'sentinel:1'}]},
		{i:'e09_3',e:'venture',o:[{w:1,a:2}]},
		{i:'e09_4',e:'careful'},
		{i:'e09_5',e:'leave'},
	] },
	{ id: 'e10', n: 'The Handler and the Wolves', g: 'mixed', k: 'wolves', o: [
		{i:'e10_0',e:'wolves'},
		{i:'e10_1',e:'venture',o:[{w:1,f:'wolf:2'}]},
		{i:'e10_2',e:'venture',a:2,o:[{w:1,fl:'decoy'}]},
		{i:'e10_3',e:'venture',o:[{w:1,r:'parcel'},{w:1,f:'wolf:4'}]},
		{i:'e10_4',e:'venture',c:2000,o:[{w:1,r:'parcel'}]},
		{i:'e10_5',e:'leave'},
	] },
	{ id: 'e11', n: 'Two People Claim the Chest', g: 'mixed', k: 'conflict', o: [
		{i:'left',e:'left'},
		{i:'right',e:'right'},
		{i:'neither',e:'neither'},
		{i:'both',e:'both'},
		{i:'peace',e:'peace',c:3000},
		{i:'testimony',e:'testimony'},
	] },
	{ id: 'e12', n: 'The Bell Ropes', g: 'mixed', k: 'bell', o: [
		{i:'e12_0',e:'venture',o:[{w:1,f:'guard:3'}]},
		{i:'e12_1',e:'venture',o:[{w:1,f:'mothkeeper:1'}]},
		{i:'e12_2',e:'wolves'},
		{i:'e12_3',e:'venture',o:[{w:1,fl:'decoy'}]},
		{i:'e12_4',e:'use_tool',n:'tool'},
		{i:'e12_5',e:'leave'},
	] },
	{ id: 'e13', n: 'The Strong Magnet', g: 'mixed', k: 'magnet', o: [
		{i:'e13_0',e:'venture',o:[{w:1,r:'boss'},{w:1,f:'sentinel:1'}]},
		{i:'e13_1',e:'venture',o:[{w:1,a:2}]},
		{i:'e13_2',e:'venture',o:[{w:1,f:'sentinel:1'}]},
		{i:'e13_3',e:'venture',a:2,o:[{w:1,r:'parcel'}]},
		{i:'e13_4',e:'venture',o:[{w:1,fl:'tool'}]},
		{i:'e13_5',e:'leave'},
	] },
	{ id: 'e14', n: 'Two Couriers, One Badge', g: 'mixed', k: 'conflict', o: [
		{i:'left',e:'left'},
		{i:'right',e:'right'},
		{i:'neither',e:'neither'},
		{i:'both',e:'both'},
		{i:'peace',e:'peace',c:3000},
		{i:'testimony',e:'testimony'},
	] },
	{ id: 'e15', n: 'Letter to the Captain', g: 'mixed', k: 'letter', o: [
		{i:'e15_0',e:'venture',o:[{w:1,g:3000,r:'rescue'},{w:1,f:'npc:2'}]},
		{i:'e15_1',e:'venture',o:[{w:1,f:'npc:1'}]},
		{i:'e15_2',e:'venture',c:2000,o:[{w:1,j:1}]},
		{i:'e15_3',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e15_4',e:'careful'},
		{i:'e15_5',e:'leave'},
	] },
	{ id: 'e16', n: 'Trade the Crates', g: 'mixed', k: 'trade', o: [
		{i:'e16_0',e:'venture',o:[{w:1,g:4000,r:'parcel'},{w:1,f:'bat:6'}]},
		{i:'e16_1',e:'venture',a:3,o:[{w:1,r:'parcel'}]},
		{i:'e16_2',e:'venture',o:[{w:1,f:'npc:2'}]},
		{i:'e16_3',e:'venture',o:[{w:1,g:1500}]},
		{i:'e16_4',e:'venture',o:[{w:1,fl:'tool'}]},
		{i:'e16_5',e:'leave'},
	] },
	{ id: 'e17', n: 'The Copying Shadow', g: 'mixed', k: 'shadow', o: [
		{i:'e17_0',e:'venture',o:[{w:1,sh:1}]},
		{i:'e17_1',e:'venture',o:[{w:1,r:'parcel'},{w:1,f:'bat:5'}]},
		{i:'e17_2',e:'venture',a:2,o:[{w:1,r:'parcel'}]},
		{i:'e17_3',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e17_4',e:'careful'},
		{i:'e17_5',e:'leave'},
	] },
	{ id: 'e18', n: 'The Broken Lift', g: 'mixed', k: 'lift', o: [
		{i:'e18_0',e:'venture',o:[{w:1,r:'rescue'},{w:1,f:'rat:8'}]},
		{i:'e18_1',e:'venture',c:2000,o:[{w:1,j:1}]},
		{i:'e18_2',e:'use_tool',n:'tool'},
		{i:'e18_3',e:'venture',o:[{w:1,a:2}]},
		{i:'e18_4',e:'venture',o:[{w:1,f:'wolf:2'}]},
		{i:'e18_5',e:'leave'},
	] },
	{ id: 'e19', n: 'The Farmer’s Guess', g: 'mixed', k: 'mushroom', o: [
		{i:'e19_0',e:'venture',o:[{w:1,g:3000,r:'parcel'},{w:1,f:'bat:6'}]},
		{i:'e19_1',e:'venture',o:[{w:1,a:2}]},
		{i:'e19_2',e:'plant'},
		{i:'e19_3',e:'venture',o:[{w:1,fl:'decoy'}]},
		{i:'e19_4',e:'venture',o:[{w:1,f:'rat:6'}]},
		{i:'e19_5',e:'leave'},
	] },
	{ id: 'e20', n: 'The Cornered Rogue', g: 'mixed', k: 'rogue', o: [
		{i:'save',e:'save'},
		{i:'watch',e:'watch'},
		{i:'lure',e:'lure'},
		{i:'aid',e:'hire',c:2000},
		{i:'finish',e:'both'},
		{i:'cover',e:'cover'},
	] },
	{ id: 'e21', n: 'Change the Map', g: 'mixed', k: 'route', o: [
		{i:'e21_0',e:'venture',a:3,o:[{w:1,fl:'truce'}]},
		{i:'e21_1',e:'venture',o:[{w:1,f:'guard:3'}]},
		{i:'e21_2',e:'venture',o:[{w:1,r:'parcel'},{w:1,f:'wolf:3'}]},
		{i:'e21_3',e:'venture',c:2000,o:[{w:1,j:1}]},
		{i:'e21_4',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e21_5',e:'leave'},
	] },
	{ id: 'e22', n: 'One More Turn', g: 'mixed', k: 'pressure', o: [
		{i:'e22_0',e:'venture',o:[{w:1,r:'boss'},{w:1,f:'sentinel:1'}]},
		{i:'e22_1',e:'venture',o:[{w:1,f:'lockbreaker:1'}]},
		{i:'e22_2',e:'careful'},
		{i:'e22_3',e:'use_tool',n:'tool'},
		{i:'e22_4',e:'venture',o:[{w:1,a:2}]},
		{i:'e22_5',e:'leave'},
	] },
	{ id: 'e23', n: 'Keep the Crate Cold', g: 'mixed', k: 'escort', o: [
		{i:'e23_0',e:'escort'},
		{i:'e23_1',e:'venture',o:[{w:1,r:'rescue'},{w:1,f:'crab:4'}]},
		{i:'e23_2',e:'venture',c:2000,o:[{w:1,r:'parcel'}]},
		{i:'e23_3',e:'guide'},
		{i:'e23_4',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e23_5',e:'leave'},
	] },
	{ id: 'e24', n: 'The Same Prisoner Twice', g: 'mixed', k: 'twins', o: [
		{i:'left',e:'left'},
		{i:'right',e:'right'},
		{i:'neither',e:'neither'},
		{i:'both',e:'both'},
		{i:'peace',e:'peace',c:3000},
		{i:'testimony',e:'testimony'},
	] },
	{ id: 'e25', n: 'The Prisoner and the Captain', g: 'mixed', k: 'conflict', o: [
		{i:'left',e:'left'},
		{i:'right',e:'right'},
		{i:'neither',e:'neither'},
		{i:'both',e:'both'},
		{i:'peace',e:'peace',c:3000},
		{i:'testimony',e:'testimony'},
	] },
	{ id: 'e26', n: 'The Toll Patrol', g: 'bad', k: 'collapse', o: [
		{i:'e26_0',e:'pay',c:3000},
		{i:'e26_1',e:'bad_fight'},
		{i:'e26_2',e:'pay',a:2},
		{i:'e26_3',e:'time',c:1000,s:30},
		{i:'e26_4',e:'time',s:45},
		{i:'e26_5',e:'bad_double'},
	] },
	{ id: 'e27', n: 'Stopped by a Guard', g: 'bad', k: 'toll', o: [
		{i:'e27_0',e:'pay',c:3000},
		{i:'e27_1',e:'bad_fight'},
		{i:'e27_2',e:'pay',a:2},
		{i:'e27_3',e:'time',c:1000,s:30},
		{i:'e27_4',e:'time',s:45},
		{i:'e27_5',e:'bad_double'},
	] },
	{ id: 'e28', n: 'The Rope Snaps', g: 'bad', k: 'alarm', o: [
		{i:'e28_0',e:'pay',c:3000},
		{i:'e28_1',e:'bad_fight'},
		{i:'e28_2',e:'pay',a:2},
		{i:'e28_3',e:'time',c:1000,s:30},
		{i:'e28_4',e:'time',s:45},
		{i:'e28_5',e:'bad_double'},
	] },
	{ id: 'e29', n: 'The Cargo Is Stuck', g: 'bad', k: 'cargo', o: [
		{i:'e29_0',e:'pay',c:3000},
		{i:'e29_1',e:'bad_fight'},
		{i:'e29_2',e:'pay',a:2},
		{i:'e29_3',e:'time',c:1000,s:30},
		{i:'e29_4',e:'time',s:45},
		{i:'e29_5',e:'bad_double'},
	] },
	{ id: 'e30', n: 'The Wrong Receipt', g: 'bad', k: 'debt', o: [
		{i:'e30_0',e:'pay',c:3000},
		{i:'e30_1',e:'bad_fight'},
		{i:'e30_2',e:'pay',a:2},
		{i:'e30_3',e:'time',c:1000,s:30},
		{i:'e30_4',e:'time',s:45},
		{i:'e30_5',e:'bad_double'},
	] },
	{ id: 'e31', n: 'The Shop with One Item', g: 'positive', k: 'merchant', o: [
		{i:'e31_0',e:'inspect'},
		{i:'e31_1',e:'leave'},
		{i:'e31_2',e:'story'},
		{i:'e31_3',e:'inspect'},
		{i:'e31_4',e:'leave'},
		{i:'e31_5',e:'leave'},
	] },
	{ id: 'e32', n: 'Clear the Crab Pens', g: 'positive', k: 'hunt', o: [
		{i:'e32_0',e:'hunt'},
		{i:'e32_1',e:'hunt_double'},
		{i:'e32_2',e:'hunt_quick'},
		{i:'e32_3',e:'hunt_helper'},
		{i:'e32_4',e:'hunt_late'},
		{i:'e32_5',e:'leave'},
	] },
	{ id: 'e33', n: 'Catch the Bats', g: 'positive', k: 'hunt_bats', o: [
		{i:'e33_0',e:'hunt'},
		{i:'e33_1',e:'hunt_double'},
		{i:'e33_2',e:'hunt_quick'},
		{i:'e33_3',e:'hunt_helper'},
		{i:'e33_4',e:'hunt_late'},
		{i:'e33_5',e:'leave'},
	] },
	{ id: 'e34', n: 'Rats with Silver Teeth', g: 'positive', k: 'hunt_rats', o: [
		{i:'e34_0',e:'hunt'},
		{i:'e34_1',e:'hunt_double'},
		{i:'e34_2',e:'hunt_quick'},
		{i:'e34_3',e:'hunt_helper'},
		{i:'e34_4',e:'hunt_late'},
		{i:'e34_5',e:'leave'},
	] },
	{ id: 'e35', n: 'Move the Caravan', g: 'positive', k: 'escort_safe', o: [
		{i:'e35_0',e:'escort'},
		{i:'e35_1',e:'guide'},
		{i:'e35_2',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e35_3',e:'venture',o:[{w:1,fl:'tool'}]},
		{i:'e35_4',e:'venture',o:[{w:1,a:1}]},
		{i:'e35_5',e:'leave'},
	] },
	{ id: 'e36', n: 'Craft with Cave Amber', g: 'positive', k: 'recipes', o: [
		{i:'e36_0',e:'recipes'},
		{i:'e36_1',e:'venture',o:[{w:1,a:1}]},
		{i:'e36_2',e:'venture',o:[{w:1,fl:'tool'}]},
		{i:'e36_3',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e36_4',e:'venture',o:[{w:1,al:1}]},
		{i:'e36_5',e:'leave'},
	] },
	{ id: 'e37', n: 'Try the Dice', g: 'positive', k: 'practice_dice', o: [
		{i:'e37_0',e:'free_die'},
		{i:'e37_1',e:'story'},
		{i:'e37_2',e:'free_die'},
		{i:'e37_3',e:'venture',o:[{w:1,j:1}]},
		{i:'e37_4',e:'leave'},
		{i:'e37_5',e:'leave'},
	] },
	{ id: 'e38', n: 'Borrow a Tool', g: 'positive', k: 'tool', o: [
		{i:'e38_0',e:'tool'},
		{i:'e38_1',e:'lamp'},
		{i:'e38_2',e:'decoy'},
		{i:'e38_3',e:'venture',o:[{w:1,j:1}]},
		{i:'e38_4',e:'venture',o:[{w:1,a:1}]},
		{i:'e38_5',e:'leave'},
	] },
	{ id: 'e39', n: 'The Amber Garden', g: 'positive', k: 'plant', o: [
		{i:'e39_0',e:'plant'},
		{i:'e39_1',e:'venture',o:[{w:1,a:1}]},
		{i:'e39_2',e:'decoy'},
		{i:'e39_3',e:'venture',o:[{w:1,al:1}]},
		{i:'e39_4',e:'lamp'},
		{i:'e39_5',e:'leave'},
	] },
	{ id: 'e40', n: 'Practice with Wooden Swords', g: 'positive', k: 'practice', o: [
		{i:'e40_0',e:'practice'},
		{i:'e40_1',e:'practice',ra:1,gd:0.5},
		{i:'e40_2',e:'practice',s:15},
		{i:'e40_3',e:'guide'},
		{i:'e40_4',e:'careful'},
		{i:'e40_5',e:'leave'},
	] },
	{ id: 'e41', n: 'Trade Materials', g: 'positive', k: 'exchange', o: [
		{i:'e41_0',e:'exchange',a:2},
		{i:'e41_1',e:'tool'},
		{i:'e41_2',e:'lamp'},
		{i:'e41_3',e:'decoy'},
		{i:'e41_4',e:'venture',o:[{w:1,al:1}]},
		{i:'e41_5',e:'leave'},
	] },
	{ id: 'e42', n: 'The Rat’s Shortcuts', g: 'positive', k: 'ratdoor', o: [
		{i:'e42_0',e:'reveal'},
		{i:'e42_1',e:'venture',o:[{w:1,al:1}]},
		{i:'e42_2',e:'lamp'},
		{i:'e42_3',e:'tool'},
		{i:'e42_4',e:'venture',o:[{w:1,a:1}]},
		{i:'e42_5',e:'leave'},
	] },
	{ id: 'e43', n: 'Call a Guard Away', g: 'positive', k: 'decoy', o: [
		{i:'e43_0',e:'decoy'},
		{i:'e43_1',e:'guide'},
		{i:'e43_2',e:'reveal',tr:1},
		{i:'e43_3',e:'lamp'},
		{i:'e43_4',e:'tool'},
		{i:'e43_5',e:'leave'},
	] },
	{ id: 'e44', n: 'Find the Rogue', g: 'positive', k: 'appraise', o: [
		{i:'e44_0',e:'appraise'},
		{i:'e44_1',e:'story'},
		{i:'e44_2',e:'guide'},
		{i:'e44_3',e:'lamp'},
		{i:'e44_4',e:'venture',o:[{w:1,a:1}]},
		{i:'e44_5',e:'leave'},
	] },
	{ id: 'e45', n: 'The Lost Traveler', g: 'positive', k: 'escort_safe', o: [
		{i:'e45_0',e:'escort'},
		{i:'e45_1',e:'guide'},
		{i:'e45_2',e:'venture',o:[{w:1,fl:'lamp'}]},
		{i:'e45_3',e:'venture',o:[{w:1,fl:'tool'}]},
		{i:'e45_4',e:'venture',o:[{w:1,a:1}]},
		{i:'e45_5',e:'leave'},
	] },
	{ id: 'e46', n: 'Is It Worth the Price?', g: 'positive', k: 'merchant', o: [
		{i:'e46_0',e:'inspect'},
		{i:'e46_1',e:'leave'},
		{i:'e46_2',e:'story'},
		{i:'e46_3',e:'inspect'},
		{i:'e46_4',e:'leave'},
		{i:'e46_5',e:'leave'},
	] },
	{ id: 'e47', n: 'Follow the Thread', g: 'positive', k: 'moths', o: [
		{i:'e47_0',e:'moths'},
		{i:'e47_1',e:'venture',o:[{w:1,a:2}]},
		{i:'e47_2',e:'lamp'},
		{i:'e47_3',e:'venture',o:[{w:1,j:1}]},
		{i:'e47_4',e:'reveal'},
		{i:'e47_5',e:'leave'},
	] },
	{ id: 'e48', n: 'The Supply Cart', g: 'positive', k: 'merchant', o: [
		{i:'e48_0',e:'inspect'},
		{i:'e48_1',e:'story'},
		{i:'e48_2',e:'story'},
		{i:'e48_3',e:'lamp'},
		{i:'e48_4',e:'tool'},
		{i:'e48_5',e:'leave'},
	] },
	{ id: 'e49', n: 'Make a Tool', g: 'positive', k: 'tool', o: [
		{i:'e49_0',e:'tool'},
		{i:'e49_1',e:'lamp'},
		{i:'e49_2',e:'decoy'},
		{i:'e49_3',e:'venture',o:[{w:1,j:1}]},
		{i:'e49_4',e:'venture',o:[{w:1,a:1}]},
		{i:'e49_5',e:'leave'},
	] },
	{ id: 'e50', n: 'Before You Leave', g: 'positive', k: 'farewell', o: [
		{i:'e50_0',e:'gift'},
		{i:'e50_1',e:'venture',o:[{w:1,r:'parcel'}]},
		{i:'e50_2',e:'lamp'},
		{i:'e50_3',e:'tool'},
		{i:'e50_4',e:'guide'},
		{i:'e50_5',e:'leave'},
	] },
];
/* THE LIVE TABLE WINS - v26. The browser session measured the client's own G
   carrying G.events.dreams.encounters, 50 entries with `effect` on every
   option (G version 18183), so an encounter the game adds arrives with its
   effects instead of reading as UNKNOWN until somebody copies the table again.
   It is converted into the compact shape above, so the scorer reads one shape
   from either source; the copy is the fallback when the live table is missing
   or empty. voteTableSource() says which one is in use. */
function compactEncounter(e) {
	const out = { id: e.id, n: e.name, g: e.group, k: e.kind, o: [] };
	for (const o of e.options || []) {
		const r = { i: o.id, e: o.effect };
		if (o.cost) r.c = o.cost;
		if (o.amber) r.a = o.amber;
		if (o.needs) r.n = o.needs;
		if (o.win) r.w = o.win;
		if (o.seconds) r.s = o.seconds;
		if (o.reward_amber) r.ra = o.reward_amber;
		if (o.guard) r.gd = o.guard;
		if (o.travelers) r.tr = 1;
		if (o.hazard) r.hz = o.hazard;
		if (o.outcomes) r.o = o.outcomes.map((x) => {
			const y = { w: x.weight };
			if (x.gold) y.g = x.gold;
			if (x.amber) y.a = x.amber;
			if (x.reward) y.r = String(x.reward).replace(/^cave_/, '');
			if (x.fight) y.f = String(x.fight[0]).replace(/^cave_/, '') + ':' + x.fight[1];
			if (x.flags) y.fl = x.flags.join(',');
			if (x.join) y.j = 1;
			if (x.ally) y.al = 1;
			if (x.shadow) y.sh = 1;
			return y;
		});
		out.o.push(r);
	}
	return out;
}
let encounterIndex = null;
function encounterTable() {
	let live = null;
	try { live = parent.G.events.dreams.encounters; } catch (e) {}
	const src = (Array.isArray(live) && live.length) ? live : null;
	if (encounterIndex && encounterIndex.from === (src || CAVE_ENCOUNTERS)) return encounterIndex;
	const list = src ? src.map(compactEncounter) : CAVE_ENCOUNTERS;
	const byId = {}, byName = {};
	for (const e of list) { byId[e.id] = e; byName[e.n] = e; }
	encounterIndex = { from: src || CAVE_ENCOUNTERS, source: src ? 'live' : 'copy', list: list, byId: byId, byName: byName };
	return encounterIndex;
}
function voteTableSource() { return encounterTable().source; }

function encounterOf(choice) {
	if (!choice) return null;
	const T = encounterTable();
	try {
		const ph = choice.title_message && choice.title_message.phrase;
		const m = ph && /^event\.dreams\.(e\d+)\.name$/.exec(ph);
		if (m && T.byId[m[1]]) return T.byId[m[1]];
	} catch (e) {}
	if (choice.title && T.byName[choice.title]) return T.byName[choice.title];
	const ids = (choice.options || []).map((o) => o.id);
	if (ids.length && ids.every((id) => id === 'here' || id === 'landing')) return CAVE_REVIVAL;
	return null;
}

function voteFightValue(spec) {
	const p = String(spec).split(':'), t = p[0], n = +p[1] || 1;
	const unit = VOTE.unit[t] == null ? 0.3 : VOTE.unit[t];
	return VOTE.value.parcel + n * ((VOTE.kill[t] || 0) - unit) - VOTE.fightBase;
}
function voteFlagValue(f, s) { return s.has[f] ? 0 : (VOTE.value[f] || 0); }
function voteOutcomeValue(x, s) {
	if (x.sh) return null;
	let v = (x.a || 0) + (x.g || 0) * VOTE.value.gold;
	if (x.r) v += VOTE.value[x.r] || 0;
	if (x.f) v += voteFightValue(x.f);
	if (x.fl) for (const f of x.fl.split(',')) v += voteFlagValue(f, s);
	if (x.j || x.al) v += VOTE.value.helper;
	return v;
}
/* null means never vote for it. `o` is the option as the server sent it, so a
   live cost or amber (the revival's grows with the fallen) wins over the
   table's, and anything the server marks unavailable is out. */
function voteScore(d, o, s) {
	if (!d) return null;
	if (VOTE.never.indexOf(d.e) >= 0) return null;
	if ((o && o.amber) || d.a) return null;
	if (o && o.unavailable) return null;
	if (d.n && !s.has[d.n]) return null;
	const cost = (o && o.cost) || d.c || 0;
	if (cost && s.gold - cost < s.reserve) return null;
	const V = VOTE.value, U = VOTE.unit;
	let v = -cost * V.gold;
	switch (d.e) {
		case 'leave': case 'story': case 'recipes': return v;
		case 'venture': {
			let tot = 0, sum = 0;
			for (const x of d.o || []) {
				const ov = voteOutcomeValue(x, s);
				if (ov === null) return null;
				tot += x.w; sum += x.w * ov;
			}
			return v + (tot ? sum / tot : 0);
		}
		case 'careful': return v + V.parcel - (s.comfortable ? 0.05 : 0.6);
		case 'use_tool': return v + V.parcel;
		case 'dice': return v + 0.5 * (d.w || 0) * V.gold;
		case 'dice6': return v + (d.w || 0) * V.gold / 6;
		case 'favor': return v + 0.5 * V.helper + 0.5 * voteFightValue('guard:2');
		case 'dice_room': return v + 0.5 * voteFightValue('crab:4') + 0.5 * voteFightValue('rat:4');
		case 'free_die': return v + 1 / 6;
		case 'save': case 'lure': return v + V.rescue + 3000 * V.gold - VOTE.fightBase - 2 * U.wolf;
		case 'hire': return v + V.rescue + 3000 * V.gold - VOTE.fightBase - 2 * U.wolf + V.helper;
		case 'cover': return v + V.parcel + 3000 * V.gold - VOTE.fightBase - 2 * U.wolf;
		case 'watch': return v + voteFightValue('wolf:2');
		case 'both': case 'neither': return v + voteFightValue('npc:2');
		case 'left': case 'right': case 'testimony': return v + V.rescue - VOTE.fightBase - U.npc;
		case 'peace': return v + 1;
		case 'inspect': case 'buy': return v + (s.gold >= VOTE.shopMin ? V.shop : V.shopPoor);
		case 'pay': return v;
		case 'time': return v - (d.s || 45) * (s.comfortable ? 0.002 : 0.01);
		case 'tool': case 'lamp': return v + voteFlagValue(d.e, s);
		case 'decoy': return v + voteFlagValue(s.kind === 'decoy' ? 'message' : 'decoy', s);
		case 'guide': return v + V.helper;
		case 'escort': return v + 0.8 * V.rescue + 3000 * V.gold;
		case 'moths': return v + (s.has.lamp ? V.mothsteps : V.moths);
		case 'plant': return v + 3;
		case 'practice': return v + (d.s && d.s < 30 ? 0.8 : 0.9) * (d.ra || V.parcel) - 0.05;
		case 'gift': return v + 2;
		case 'small_gift': return v + 1;
		case 'reveal': case 'appraise': return v + V.reveal;
		case 'revive_landing': return v + V.landing;
	}
	const h = VOTE.hunt[d.e];
	if (h) return v + (1 - h[2]) * (h[0] * V.parcel + h[1] * 5000 * V.gold + 2 + (d.e === 'hunt_helper' ? V.helper : 0));
	return null;
}

/* THE RESERVE STANDS UNTIL THE THIRD FLOOR'S REQUIRED ENCOUNTER IS DONE, and
   then it is released for the rest of the run - the operator's "release it
   after floor 3's encounter with no merchant". Floors are numbered 0-2 by the
   server. */
let reserveReleased = false;
function reserveNow(st) {
	if (!reserveReleased && st && st.floor === 2
		&& (st.objectives || []).some((o) => o.floor === 2 && o.required && o.kind === 'encounter' && o.done)) {
		reserveReleased = true;
		clog('third floor encounter done - cave gold reserve released', '#7FD98A');
		ev('reserveReleased', { gold: st.gold });
	}
	return reserveReleased ? 0 : VOTE.reserve;
}
function voteContext(st, enc) {
	const has = {};
	for (const k of (st && st.supplies) || []) has[k] = true;
	return { gold: (st && st.gold) || 0, reserve: reserveNow(st), has: has, kind: enc && enc.k,
		comfortable: !st || st.remaining_ms == null || st.remaining_ms >= VOTE.carefulMinMs };
}
/* The pick, as data, so caveVotePreview() and the suite read exactly what the
   vote would do. Returns { enc, unknown, pick, scores }. */
function votePlan(choice, st) {
	const enc = encounterOf(choice);
	if (!enc) return { enc: null, unknown: 'encounter', pick: null, scores: {} };
	const byId = {};
	for (const d of enc.o) byId[d.i] = d;
	const shown = choice.options || [];
	const missing = shown.filter((o) => !byId[o.id]).map((o) => o.id);
	if (missing.length) return { enc: enc, unknown: 'option ' + missing.join(','), pick: null, scores: {} };
	if (enc.id === 'revival') return reviveChoice(enc, choice, st);
	const s = voteContext(st, enc), scores = {};
	for (const o of shown) scores[o.id] = voteScore(byId[o.id], o, s);
	let pick = null;
	for (const id of VOTE.prefer[enc.id] || []) if (scores[id] != null) { pick = id; break; }
	if (!pick) for (const o of shown) if (scores[o.id] != null && (pick === null || scores[o.id] > scores[pick])) pick = o.id;
	return { enc: enc, unknown: null, pick: pick, scores: scores };
}

/* REVIVE IN PLACE ONLY WHEN IT PAYS - the operator's ruling of 2026-10-24,
   the one place an Amber price is allowed. "Here" costs 1 Amber per dead
   member on that map; it is taken when (1) the healer died, (2) the walk back
   from the doorway is estimated over walkSec, (3) the run clock is short, or
   (4) it is that character's repeat death - and only while every dead member
   is inside a budget of 2 Amber per run. The walk is straight-line from where
   the member lies to the floor's doorway (doors[0], where the free revive
   lands) times a maze factor, at a resting speed - an estimate, logged as one.
   Spend is counted by this page; a reload resets it. */
const REVIVE = { budget: 2, tightMs: 300000, walkSec: 60, mazeFactor: 1.5, speed: 60 };
let reviveSpent = {};
function deadMates(st) {
	const bs = beacons(), out = [];
	for (const n of TEAM) {
		const e = n === character.name ? character : (parent.entities || {})[n];
		const b = bs[n];
		const rip = (e && e.rip) || (b && b.rip && Date.now() - b.t <= 10000);
		if (!rip) continue;
		const pos = (b && b.map === character.map) ? { x: b.x, y: b.y } : (e && e.map === character.map ? { x: e.x, y: e.y } : null);
		out.push({ name: n, ctype: (b && b.ctype) || (e && e.ctype) || null, deaths: (b && b.deaths) || 0, pos: pos });
	}
	return out;
}
function reviveChoice(enc, choice, st) {
	const shown = choice.options || [];
	const here = shown.find((o) => o.id === 'here'), landing = shown.find((o) => o.id === 'landing');
	const dead = deadMates(st || {});
	const why = [];
	if (dead.some((d) => d.ctype === 'priest')) why.push('the healer died');
	if (dead.some((d) => d.deaths >= 2)) why.push('a repeat death');
	if (st && st.remaining_ms != null && st.remaining_ms < REVIVE.tightMs) why.push('the clock is short');
	const door = st && st.doors && st.doors[0];
	if (door) for (const d of dead) {
		if (!d.pos) continue;
		const sec = Math.hypot(d.pos.x - door.x, d.pos.y - door.y) * REVIVE.mazeFactor / REVIVE.speed;
		if (sec > REVIVE.walkSec) { why.push(d.name + ' is ~' + Math.round(sec) + 's from the doorway'); break; }
	}
	const inBudget = dead.length > 0 && dead.every((d) => (reviveSpent[d.name] || 0) + 1 <= REVIVE.budget);
	const canHere = !!(here && !here.unavailable && inBudget && why.length > 0);
	const pick = canHere ? 'here' : (landing ? 'landing' : null);
	const reason = canHere ? why.join('; ')
		: (!why.length ? 'no reason to pay' : !inBudget ? 'over the 2-Amber budget' : 'here not available');
	return { enc: enc, unknown: null, pick: pick, scores: { here: canHere ? 1 : null, landing: 0.5 },
		revive: { dead: dead.map((d) => d.name), reason: reason } };
}

function voteEmit(choice, option, how) {
	votedFor[choice.id] = option;
	try {
		parent.socket.emit('interaction', { type: 'cave', action: 'vote', choice: choice.id, option: option,
			request_id: 'cr' + Math.random().toString(36).slice(2, 12) });
		bump(how === 'echo' ? 'votesEcho' : 'votesAuto'); ev('vote', { choice: choice.id, option: option, how: how });
	} catch (e) { bump('voteErr'); ev('voteErr', String(e)); clog('vote emit failed: ' + e, 'red'); }
}
function voteTick() {
	if (stopped || offCave()) return;
	const st = caveState(), choice = st && st.choice;
	if (!choice) return;
	if (!choice.resolved) voteOpen(st, choice);
	else { learnShop(choice); navNoteResolved(choice); }
}
function voteOpen(st, choice) {
	if (choice.deadline && Date.now() > choice.deadline) return;
	if (votedFor[choice.id]) return;
	const votes = choice.votes || {};
	if (votes[character.name]) { votedFor[choice.id] = votes[character.name]; return; }
	const offered = (id) => (choice.options || []).some((o) => o.id === id);
	/* Echo first: the leader's vote if there is one, else any teammate's - the
	   operator may vote on whichever character he has in front of him. */
	const L = leaderName();
	const from = votes[L] ? L : TEAM.filter((n) => n !== character.name && votes[n])[0];
	if (from) {
		const want = votes[from];
		if (!offered(want)) {
			clog(from + ' voted ' + want + ', not offered to me - skipping', 'orange');
			votedFor[choice.id] = '(unavailable)'; return;
		}
		voteEmit(choice, want, 'echo');
		clog('mirrored ' + from + ': ' + want, '#7FD98A');
		return;
	}
	if (!isLeader() || voteNoted[choice.id]) return;
	const plan = votePlan(choice, st);
	/* Not voting is NOT marked in votedFor, which would stop this character
	   echoing the operator's own vote when it arrives - voteNoted only keeps the
	   log line from repeating every tick. */
	if (plan.unknown) {
		voteNoted[choice.id] = 'unknown';
		bump('voteUnknown');
		const opts = (choice.options || []).map((o) => o.id + ' "' + o.label + '" cost ' + (o.cost || 0) + ' amber ' + (o.amber || 0)
			+ (o.unavailable ? ' [' + o.unavailable + ']' : ''));
		clog('UNKNOWN EVENT (' + plan.unknown + ') - not voting, the operator has the timer. id '
			+ ((plan.enc && plan.enc.id) || (choice.title_message && choice.title_message.phrase) || '?')
			+ ' title "' + choice.title + '" kind ' + choice.kind + ' options: ' + opts.join(' | '), 'orange');
		ev('voteUnknown', { why: plan.unknown, title: choice.title, phrase: choice.title_message && choice.title_message.phrase,
			kind: choice.kind, options: choice.options });
		return;
	}
	const sc = Object.keys(plan.scores).map((k) => k + '=' + (plan.scores[k] == null ? 'never' : plan.scores[k].toFixed(2))).join(' ');
	if (!plan.pick) {
		voteNoted[choice.id] = 'fallback';
		bump('voteFallback');
		clog(plan.enc.id + ' ' + plan.enc.n + ': nothing acceptable offered (' + sc + ') - leaving it to the server fallback', 'orange');
		ev('voteFallback', { enc: plan.enc.id, scores: plan.scores });
		return;
	}
	voteEmit(choice, plan.pick, 'auto');
	if (plan.revive) {
		if (plan.pick === 'here') for (const n of plan.revive.dead) reviveSpent[n] = (reviveSpent[n] || 0) + 1;
		clog('revival for ' + plan.revive.dead.join(', ') + ': ' + plan.pick + ' - ' + plan.revive.reason, plan.pick === 'here' ? '#FFD700' : '#7FD98A');
		ev('revive', { pick: plan.pick, dead: plan.revive.dead, reason: plan.revive.reason, spent: reviveSpent });
		return;
	}
	clog(plan.enc.id + ' ' + plan.enc.n + ': voted ' + plan.pick + ' (' + sc + ')', '#7FD98A');
}
/* ALWAYS BUY A LOADED DIE WHEN A CAVE MERCHANT SHOWS ONE - and keep trying,
   v26. v25 tried once, at the moment the shop opened, and every floor's shop
   is in its first room while the purse starts at 0 - so on floor 1 the attempt
   was refused gold_not_enough and never made again. Now any character that saw
   a die shop remembers it, and whichever one is within reach of that
   shopkeeper (the entity whose cave.room is the shop's room) buys once the
   purse covers the price: a respawn at the doorway, or the party passing back.
   The server's answer settles it - bought, or sold_out - and other refusals
   are retried every retryMs. The leader also says, throttled, when the die is
   affordable but out of reach, for a leader the operator is walking; the
   autopilot (v27) makes that detour decision itself and says why it skips one. */
const DIE = { reach: 150, retryMs: 5000, maxTries: 8 };
let voteNoted = {}, dieShops = {}, pendingBuys = {};
function learnShop(choice) {
	const shop = choice && choice.shop;
	if (!shop || shop.name !== 'cave_loaded_die' || dieShops[shop.room]) return;
	dieShops[shop.room] = { map: character.map, price: shop.price, done: !!shop.sold, tries: 0, lastTry: 0 };
	clog('a Loaded Die is for sale here for ' + shop.price + ' cave gold', '#FFD700');
	ev('dieShop', { room: shop.room, price: shop.price });
}
function shopKeeper(room) {
	try {
		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (e && !e.dead && e.cave && e.cave.room === room) return e;
		}
	} catch (e) {}
	return null;
}
function dieTick() {
	if (stopped || mode !== 'cave' || !inCave() || character.rip) return;
	const st = caveState();
	if (!st) return;
	const now = Date.now();
	for (const room in dieShops) {
		const d = dieShops[room];
		if (d.done || d.map !== character.map) continue;
		const gold = st.gold || 0;
		if (gold < d.price) continue;
		const k = shopKeeper(room);
		const reach = k ? dist(character, k) : Infinity;
		if (reach > DIE.reach) {
			if (isLeader() && !navDriving()) throttleLog('Loaded Die affordable (' + gold + ' of ' + d.price + ') at the shop '
				+ (k ? Math.round(reach) + 'u away' : 'out of sight') + ' - detour if the route allows');
			continue;
		}
		if (now - d.lastTry < DIE.retryMs || d.tries >= DIE.maxTries) continue;
		d.lastTry = now; d.tries++;
		const rid = 'crd' + Math.random().toString(36).slice(2, 10);
		pendingBuys[rid] = room;
		try {
			parent.socket.emit('interaction', { type: 'cave', action: 'buy', room: room, request_id: rid });
			bump('dieBuys'); ev('dieBuy', { room: room, price: d.price, gold: gold, try: d.tries });
			clog('buying the Loaded Die for ' + d.price + ' cave gold (try ' + d.tries + ')', '#FFD700');
		} catch (e) { bump('voteErr'); clog('die buy failed: ' + e, 'red'); }
	}
}
/* The server's answer to our own buy and info requests, matched by request_id. */
function onCaveResponse(d) {
	if (!d || d.interaction !== 'cave' || !d.request_id) return;
	const room = pendingBuys[d.request_id];
	if (room) {
		delete pendingBuys[d.request_id];
		const shop = dieShops[room];
		if (!shop) return;
		if (d.success) { shop.done = true; clog('bought the Loaded Die - it went to ' + (d.recipient || '?'), '#7FD98A'); ev('dieBought', { room: room, to: d.recipient }); }
		else if (d.reason === 'sold_out') { shop.done = true; clog('the Loaded Die is sold', 'orange'); ev('dieSold', { room: room }); }
		else ev('dieRefused', { room: room, reason: d.reason });
		return;
	}
	if (d.request_id === launcher.rid) launcherAnswer(d);
}
try {
	parent.socket.on('game_response', function (d) { try { if (alive()) onCaveResponse(d); } catch (e) {} });
} catch (e) {}

function caveVotePreview() {
	const st = caveState(), choice = st && st.choice;
	if (!choice) return { choice: null };
	const p = votePlan(choice, st);
	return { id: choice.id, enc: p.enc && p.enc.id, unknown: p.unknown, pick: p.pick, scores: p.scores,
		reserve: reserveNow(st), gold: st.gold };
}

// ---------------------------------------------------------------- gate -----
/* TWO CHECKS THE SERVER MAKES THAT v7 COULD NOT SEE COMING. The enter handler
   in node/logic/generated_maps.js throws 23 distinct reasons; gateReport only
   ever pre-checked four conditions, so the rest arrived as a surprise AFTER
   the one daily opening was spent. These two are the ones readable from here:

     cave_closed       gated on G.events.dreams.disabled, which exists and read
                       false on 2026-10-10.
     cave_other_server / invalid_home_server
                       character.home is "USIV" and the live server reports
                       region "US" + identifier "IV", so the test is a string
                       compare. A character whose home is another shard cannot
                       be brought in.

   Not checkable from the client, and still capable of refusing the open:
   daily_opening_used, zone_busy, already_opening, party_changed,
   admission_expired, cant_reenter, character_already_entering. */
function serverKey() {
	try {
		const r = parent.server_region, i = parent.server_identifier;
		if (typeof r === 'string' && typeof i === 'string') return r + i;
	} catch (e) {}
	return null;
}
function gateReport() {
	const out = [];
	const names = partyNames();
	try { if (G.events && G.events.dreams && G.events.dreams.disabled) out.push('CAVE IS CLOSED (dreams event disabled)'); } catch (e) {}
	const sk = serverKey();
	if (sk && character.home && character.home !== sk) out.push('me: home is ' + character.home + ', this server is ' + sk);
	if (names.length > 3) out.push('PARTY OF ' + names.length + ' - max 3');
	for (const nm of names) {
		const e = nm === character.name ? character : (parent.entities || {})[nm];
		if (!e) { out.push(nm + ': not visible (cannot verify)'); continue; }
		if (e.rip) out.push(nm + ': DEAD');
		if (e.map !== CFG.keeper.map) out.push(nm + ': on ' + e.map);
		if (e.targets > 0) out.push(nm + ': IN COMBAT (targets=' + e.targets + ')');
	}
	if (character.map === CFG.keeper.map && dist(character, CFG.keeper) > 160) out.push('me: >160u from Dorr');
	return out;
}

// ----------------------------------------------------------------- party ---
function partyHas(name) { try { return !!(parent.party && parent.party[name]); } catch (e) { return false; } }
function partyRoster() { try { return Object.keys(parent.party || {}); } catch (e) { return []; } }
function partyComplete() { return TEAM.every(partyHas); }

let lastInvite = 0, lastAccept = 0;
function partyTick() {
	if (stopped) return;
	if (isLeader()) {
		if (partyComplete() || Date.now() - lastInvite < CFG.partyMs) return;
		lastInvite = Date.now();
		const missing = followers().filter((n) => !partyHas(n));
		if (!missing.length) return;
		for (const n of missing) {
			try { send_party_invite(n); bump('invites'); } catch (e) { ev('inviteErr', String(e)); }
		}
		throttleLog('inviting ' + missing.join(', '));
		return;
	}
	const L = leaderName();
	if (partyHas(L) || Date.now() - lastAccept < CFG.acceptMs) return;
	lastAccept = Date.now();
	try { accept_party_invite(L); bump('accepts'); } catch (e) { ev('acceptErr', String(e)); }
}

function hookPartyInvite() {
	try {
		const prev = window.on_party_invite;
		window.on_party_invite = function (name) {
			try {
				if (alive() && !isLeader() && name === leaderName()) { accept_party_invite(name); bump('accepts'); ev('invited', name); }
			} catch (e) {}
			try { if (typeof prev === 'function') prev(name); } catch (e) {}
		};
	} catch (e) { clog('could not hook on_party_invite: ' + e, 'red'); }
}

// ------------------------------------------------------------------ loot ---
/* MEASURED OVER THE 2026-10-10 CAVE RUN, which is what every number here is for:

     character      loot() calls   loot_failed   cave_paused
     FatherToken          3,047         1,068            77
     Dexon                1,627           611            60
     MageofOz             1,562           572            63

   6,236 calls, 2,451 refusals - and more than half the calls drew no response
   at all, which is what firing faster than the server will answer looks like.

   THE PAUSE GUARD IS THE OPERATOR'S CATCH and it was a real omission: this was
   the ONLY loop in the file without one. moveTick has pausedMoveSkipped,
   combatTick has pausedAttackSkipped, loot had nothing, so the priest kept
   hammering open_chest through all 556 of its paused ticks. It is worth saying
   that it only explains about 7% of the volume, though - the other 93% is rate.

   THE RATE WAS THE REAL FAULT. v9 called the blanket loot() every 250ms for as
   long as get_chests() was non-empty, so a chest that could not be opened was
   re-attempted four times a second for its entire life. Now: a cooldown, a few
   chests per pass, and a chest that has refused lootMaxTries times is rested
   for lootDeadMs - the same shape as deadDoors, for the same reason.

   WHY THIS MATTERS MORE THAN ITS SIZE: the spam filled 75 of the event ring's
   80 slots and evicted every door, vote and phase event from the run. v9's
   friendly_target forensics live outside the ring precisely to survive that.
   Fix the source and the ring becomes worth reading again.

   THE RANGE FILTER IS CONDITIONAL ON PURPOSE. get_chests() returns
   parent.chests keyed by id, but it was empty everywhere it could be probed
   outside a cave, so whether a chest record carries x/y is UNVERIFIED. The
   filter applies only when the fields are actually numbers - typeof, never
   truthiness - and tel.chestFields records the real shape the first time one
   is seen, so the next run settles it. */
let finishedAt = 0, exitAsked = 0, exitedByUs = false, chestsClearSince = 0, exitForce = false, exitWhyFrom = 0;
function caveExit() {
	if (!inCave()) { clog('not in the cave', 'orange'); return false; }
	exitForce = true; exitWhyFrom = 0;
	clog('leaving once the chests here are opened', '#FFD700');
	return true;
}
function runFinished(st) {
	if (!st || st.floor !== 2) return false;
	const req = (st.objectives || []).filter((o) => o.floor === 2 && o.required);
	return req.length > 0 && req.every((o) => o.done);
}
function exitTick() {
	const X = CFG.exit;
	if (!X || !X.enabled || stopped || mode !== 'cave' || !inCave() || character.rip) return;
	const st = caveState();
	const follow = leaderExiting();
	if (!st || (!runFinished(st) && !exitForce && !follow)) { finishedAt = 0; return; }
	const now = Date.now();
	if (!finishedAt) {
		finishedAt = now; chestsClearSince = 0;
		clog('last seal done - the time left is for farming; leaving at the Amber cap, the last minute, or caveExit()', '#7FD98A');
		ev('runFinished', { gold: st.gold, amber: st.amber });
	}
	let chests = 0;
	try { chests = Object.keys((typeof get_chests === 'function' && get_chests()) || {}).length; } catch (e) {}
	if (chests) chestsClearSince = 0; else if (!chestsClearSince) chestsClearSince = now;
	const capped = !!(st.limits && st.limits.amber != null && st.limits.amber_spawned >= st.limits.amber);
	const lastMinute = st.remaining_ms != null && st.remaining_ms <= X.finalMs;
	if (!capped && !lastMinute && !exitForce && !follow) return;
	if (!exitWhyFrom) exitWhyFrom = now;
	const settled = chestsClearSince && now - chestsClearSince >= X.settleMs;
	const timedOut = now - exitWhyFrom >= X.chestWaitMs;
	if (!settled && !timedOut) return;
	if (exitAsked && now - exitAsked < X.retryMs) return;
	exitAsked = now; exitedByUs = true;
	try {
		parent.socket.emit('interaction', { type: 'cave', action: 'exit',
			request_id: 'cr' + Math.random().toString(36).slice(2, 12) });
		bump('exits');
		ev('exit', { chestsLeft: chests, waitedMs: now - finishedAt, amber: st.amber, gold: st.gold,
			why: exitForce ? 'asked' : follow ? 'leader left' : capped ? 'amber cap' : 'clock' });
		clog('leaving the cave' + (chests ? ' with ' + chests + ' chest(s) unopened after ' + Math.round((now - finishedAt) / 1000) + 's' : ''), chests ? 'orange' : '#7FD98A');
	} catch (e) { bump('exitErr'); clog('exit emit failed: ' + e, 'red'); }
}
/* THE FINAL DUMP GOES TO THE GAME LOG FILE - v26, the operator's ruling. One
   row reading CAVE DUMP, with the telemetry under an extra `dump` field: the
   bridge caps a row's message at 4,000 characters but stores unknown fields
   whole, so no bridge change is needed. Written into the page's log buffer,
   which outlives this script, so it is sent even after the hand-back. */
function caveDumpToLog(why) {
	try {
		const st = parent.__gamelog;
		if (!st || typeof st.capture !== 'function') return false;
		try { tel.ver = caveVersion(); tel.build = caveBuild(); } catch (e) {}
		st.capture('CAVE DUMP (' + why + ') - ' + character.name, '#8b98ab', 'script');
		const row = st.buf[st.buf.length - 1];
		if (row) row.dump = JSON.parse(JSON.stringify(tel));
		return true;
	} catch (e) { return false; }
}
/* Out of the cave, by our exit or by the clock: dump, then hand back. */
function leftCave() {
	const why = exitedByUs ? 'exit' : 'run over';
	ev('leftCave', { why: why });
	telFlush(true);
	caveDumpToLog(why);
	handBack(why);
}
/* Back to the main script. The new script is loaded into this same CODE
   context, so every CaveRun loop is retired first by claiming a new
   generation - alive() goes false for all of them. The two GAMELOG copies do
   not double up: the page-level capture is reused as it is, and the flush
   timer is one window slot the main script's copy replaces. */
function handBack(why) {
	exitedByUs = false;
	if (!CFG.exit.handback) { stopped = true; clog('out of the cave - engage the main script to carry on', '#FFD700'); return; }
	let slot = null;
	try { slot = character.name; } catch (e) {}
	if (!slot) { stopped = true; clog('hand back: character name unread - engage the main script by hand', 'red'); return; }
	try { window.__caveGen = (window.__caveGen || 0) + 1; } catch (e) {}
	stopped = true;
	clog('handing back to the main script (' + slot + ') - ' + why, '#7FD98A');
	ev('handBack', { slot: slot, why: why });
	try { load_code(slot); } catch (e) { clog('hand back failed: ' + e + ' - engage the main script by hand', 'red'); }
	engageMainSlot(slot);
}
/* RUNNING A SLOT IS NOT ENGAGING IT - v31. The load_code() above is the
   runner's: it fetches the slot and evaluates it in this iframe, and touches
   neither the page's code_slot nor the code_cache entry that get_code_slot()
   reads (client js/functions.js and js/runner_functions.js, upstream 16881a2).
   A page load runs THAT slot, so after a hand-back every hop brought CaveRun
   back - measured on the 2026-10-29 game log at four hops, 20s each, until the
   slot was loaded by hand. The page's own load_code(name, log) asks the server
   for the slot by name; its answer sets the editor and code_slot, and
   code_persistence_logic() - what start_runner()/stop_runner() call - records
   code_slot as the engaged slot. NOT start_runner(): it saves the editor into
   the viewed slot and restarts the runner. No timer here is gated on alive(),
   because handBack() retires every CaveRun loop before this runs. */
function engageMainSlot(name) {
	let P = null;
	try { P = parent; } catch (e) {}
	const slotOf = (f) => { try { return String(f()); } catch (e) { return null; } };
	const before = P && typeof P.get_code_slot === 'function' ? slotOf(() => P.get_code_slot()) : null;
	if (!P || typeof P.load_code !== 'function') {
		clog('hand back: the page has no load_code - a hop will run slot ' + before + ' again; engage ' + name + ' by hand', 'red');
		return false;
	}
	const viewedBefore = slotOf(() => P.code_slot);
	try { P.load_code(name, true); }
	catch (e) { clog('hand back: loading ' + name + ' into the editor failed (' + e + ') - engage it by hand', 'red'); return false; }
	const t0 = Date.now(), limit = (CFG.exit && CFG.exit.engageMs) || 15000;
	const caveBuffer = () => { try { return /^\/\/ CaveRun\.js\b/.test(P.codemirror_render.getValue()); } catch (e) { return true; } };
	const poll = () => {
		const viewed = slotOf(() => P.code_slot);
		if (!(viewed && viewed !== viewedBefore) && caveBuffer()) {
			if (Date.now() - t0 < limit) { setTimeout(poll, 250); return; }
			clog('hand back: the editor never loaded ' + name + ' - the engaged slot is still ' + before
				+ ', so a hop runs CaveRun again; engage ' + name + ' by hand', 'red');
			return;
		}
		let how = 'code_persistence_logic';
		try {
			if (typeof P.code_persistence_logic === 'function') P.code_persistence_logic();
			else {
				how = 'code_cache';
				const data = JSON.parse(P.storage_get('code_cache') || '{}');
				data['slot_' + P.real_id] = viewed;
				P.storage_set('code_cache', JSON.stringify(data));
			}
		} catch (e) { clog('hand back: recording slot ' + viewed + ' as engaged failed (' + e + ')', 'red'); }
		const after = typeof P.get_code_slot === 'function' ? slotOf(() => P.get_code_slot()) : null;
		if (after && after === viewed) clog('hand back: engaged slot is now ' + after + ' (was ' + before + ', via ' + how + ')', '#7FD98A');
		else clog('hand back: engaged slot still reads ' + after + ' (wanted ' + viewed + ', was ' + before
			+ ') - a hop will run it; engage ' + name + ' by hand', 'red');
		ev('engage', { before: before, viewed: viewed, after: after, how: how });
	};
	setTimeout(poll, 250);
	return true;
}

let launcher = { rid: null, askedAt: 0, answered: false, handBackAt: 0, said: false };
function launcherStart() {
	const L = CFG.launch;
	if (!L || !L.enabled || mode !== 'cave' || inCave()) return false;
	launcher.rid = 'crl' + Math.random().toString(36).slice(2, 10);
	launcher.askedAt = Date.now();
	try { parent.socket.emit('interaction', { type: 'cave', action: 'info', request_id: launcher.rid }); }
	catch (e) { clog('cave info request failed: ' + e + ' - caveGo() by hand', 'orange'); return false; }
	return true;
}
function launcherAnswer(d) {
	launcher.answered = true;
	const v = (d && d.visit) || {};
	ev('launch', { failed: !!(d && d.failed), reason: d && d.reason, available: v.available, resume: !!v.resume });
	if (d && d.failed) { clog('cave info refused (' + d.reason + ') - caveGo() by hand', 'orange'); return; }
	if (v.resume) { clog('a cave run is open to resume' + (v.resume.server ? ' on ' + v.resume.server : '') + ' - not staging', 'orange'); return; }
	if (v.available) {
		if (phase === 'idle' && !stopped && mode === 'cave') { clog("today's cave is available - restocking and walking to Dorr", '#FFD700'); caveGo(); }
		return;
	}
	launcher.handBackAt = Date.now() + CFG.launch.graceMs;
	clog("today's cave is done - handing back to the main script in " + Math.round(CFG.launch.graceMs / 1000)
		+ 's (caveStay() keeps CaveRun)', '#FFD700');
}
function launcherTick() {
	if (!launcher.rid) return;
	const now = Date.now();
	if (!launcher.answered && !launcher.said && now - launcher.askedAt > CFG.launch.answerMs) {
		launcher.said = true;
		clog('no answer to the cave info request - caveGo() by hand', 'orange');
	}
	if (launcher.handBackAt && now >= launcher.handBackAt) {
		launcher.handBackAt = 0;
		if (mode === 'cave' && !inCave() && !stopped) handBack("today's cave is done");
	}
}
function caveStay() {
	launcher.handBackAt = 0;
	clog('staying on CaveRun', '#FFD700');
	return true;
}

// ------------------------------------------------------------ autopilot ----
/* THE LEADER DRIVES ITSELF - v27, the operator's ruling of 2026-10-24: "a
   change in method for cave from leader manually driven to a fully automated
   cave run. The leader should be able to identify the 3 tasks for each floor to
   unlock the stairs". Until v26 nothing here moved the cave leader; the
   operator walked him with the objective buttons at the top of the screen.

   WHAT THE BUTTON DOES IS WHAT THIS DOES. Read from the client at upstream
   16881a2: a stair goal's onclick is cave_walk_to("room", i), which calls
   smart_move({map, x, y}) in the CODE context at the objective's own x/y. So
   the movement call is the one the operator has been using all along, made
   from here instead of from a click.

   WHAT THE SERVER NEEDS AT A ROOM, from cave_of_many_dreams.js at the same
   commit. Every room on a floor activates once anyone is within 1100 of it. A
   fight, boss or camp attacks once someone comes within 210 of one of its
   monsters or hits one, and is done when its monsters are dead. An encounter's
   vote opens only with someone within 280 of the room AND 160 of its NPC.
   Stairs unlock when the floor's three required rooms (fight, encounter, boss)
   are done. An escort finishes when its NPC, which follows the party, is
   within 120 of the down door, so an escort is walked to the stairs. A hunt's
   monsters spawn in the room and come to the party.

   THE ORDER OF ASKING IS THE SAFETY PROPERTY. Regroup first (the party's
   members before any objective), then a fight in progress, then whatever is
   under way at the current room, and only then a new objective. The plan is
   pure data - navPlan() - so caveNavStatus() and the suite read exactly what
   the leader would do.

   PATH LENGTH IS AN ESTIMATE: straight line times mazeFactor at the leader's
   speed. The runner's pathfinder only plans by moving, so a plan-without-moving
   is not available from here; every leg logs its measured time against the
   estimate (navLeg) so the factor can be refined from the game log. */
const NAV = {
	enabled: true,
	arriveAt: 70,           // a room point this close is reached (monsters engage at 210)
	npcAt: 110,             // an encounter NPC this close opens its vote (the server's test is 160)
	stallMs: 45000,         // at an unfinished room this long with nothing happening
	speedFallback: 60,
	mazeFactor: 1.5,
	roomMs: 60000,          // a required room still to do, travel aside
	floorMs: 360000,        // a floor not yet reached - the operator's ~6 min, refine from the logs
	marginMs: 60000,
	detourMaxMs: 120000,    // the Loaded Die detour limit
	inspectMaxMs: 45000,    // an unopened shop or revealed room is visited only this far off the route
	waveMs: 25000,          // one camp wave: the 10 s gap plus the fight
	campAmber: 2,           // per wave: a cave_farm roll (~0.97 Amber) plus the flat 1
	encounterAmber: 1.2,    // a revealed encounter, about a parcel
	encounterMs: 45000,
	campReach: 700,         // a camp in progress this close is on the route
	fightWithin: 250,       // a monster on the party this close stops the leader
	chestWaitMs: 20000,     // at the stairs, wait this long for chests to be opened
	manualPauseMs: 45000,   // an operator's own smart_move pauses the autopilot this long
	smartMaxMs: 30000,      // a smart_move older than this is re-issued from where we stand
	failSkip: 3,            // an optional target that fails this often is dropped
};
let navOn = true, navGoal = null, navFlight = null, navManualUntil = 0, navEscort = null, navAt = {},
	navSkip = {}, navFails = {}, navSaid = {}, navLastDoor = 0, navDoorSince = 0, navLeg = null, navFloor = null;

function navSpeed() { const s = character.speed; return (typeof s === 'number' && s > 0) ? s : NAV.speedFallback; }
function navMs(a, b) {
	if (!a || !b) return Infinity;
	return Math.hypot(a.x - b.x, a.y - b.y) * NAV.mazeFactor / navSpeed() * 1000;
}
function navMe() { return { x: character.real_x, y: character.real_y }; }
function navLanding(st) { const d = ((st && st.doors) || []).filter((x) => !x.down)[0]; return d ? { x: d.x, y: d.y } : null; }
function navDownDoor(st) { return ((st && st.doors) || []).filter((x) => x.down)[0] || null; }
function navFloorObjs(st) { return ((st && st.objectives) || []).filter((o) => o.floor === st.floor); }
function navRequired(st) { return navFloorObjs(st).filter((o) => o.required && !o.done); }
function navActors(room) {
	const out = [];
	try {
		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (e && !e.dead && e.cave && e.cave.room === room) out.push(e);
		}
	} catch (e) {}
	return out;
}
/* THE CHEAPEST ORDER OVER THE FLOOR'S REMAINING REQUIRED ROOMS, ENDING AT THE
   STAIRS when there are stairs. Three rooms is six orders, so this is exhaustive
   rather than greedy; a room nearer the landing is not always the right first. */
function navRoute(st, from) {
	const rooms = navRequired(st).filter((o) => !navSkip[o.id]).slice(0, 6), door = navDownDoor(st);
	const end = door ? { x: door.x, y: door.y } : null;
	let best = [], bestMs = Infinity;
	const walk = (left, at, path, ms) => {
		if (ms >= bestMs) return;
		if (!left.length) { const t = ms + (end ? navMs(at, end) : 0); if (t < bestMs) { bestMs = t; best = path; } return; }
		for (let i = 0; i < left.length; i++) walk(left.slice(0, i).concat(left.slice(i + 1)), left[i], path.concat([left[i]]), ms + navMs(at, left[i]));
	};
	walk(rooms, from, [], 0);
	const points = [from].concat(best);
	if (end) points.push(end);
	return { rooms: best, end: end, points: points, travelMs: bestMs === Infinity ? 0 : bestMs };
}
/* What the rest of the run still costs: this floor's route and rooms, every
   floor below, and a margin. Floors are 0-2 by the server. */
function navNeedMs(st, route) {
	return route.travelMs + route.rooms.length * NAV.roomMs + Math.max(0, 2 - (st.floor || 0)) * NAV.floorMs + NAV.marginMs;
}
function navSlackMs(st, route) {
	if (!st || st.remaining_ms == null) return Infinity;
	return st.remaining_ms - navNeedMs(st, route);
}
/* The cheapest place to insert a point into the route: A->p + p->B - A->B over
   every leg, the leg from where we stand included. `at` 0 means go now. With no
   leg ahead (the last floor done) it is simply the walk there. */
function navInsert(points, p) {
	if (points.length < 2) return { at: 0, ms: navMs(points[0], p) };
	let best = { at: 0, ms: Infinity };
	for (let i = 0; i < points.length - 1; i++) {
		const c = navMs(points[i], p) + navMs(p, points[i + 1]) - navMs(points[i], points[i + 1]);
		if (c < best.ms) best = { at: i, ms: c };
	}
	return best;
}
function navPoint(st, id) {
	const o = ((st && st.objectives) || []).filter((x) => x.id === id)[0];
	if (o) return { x: o.x, y: o.y };
	const k = shopKeeper(id);
	return k ? { x: k.real_x !== undefined ? k.real_x : k.x, y: k.real_y !== undefined ? k.real_y : k.y } : null;
}
function navOnce(key, msg, color) {
	if (navSaid[key]) return;
	navSaid[key] = 1;
	clog(msg, color || 'orange');
	ev('navNote', { key: key, msg: msg });
}
/* Deaths and rests in the party, from the beacons, plus this character. */
function navParty() {
	const bs = beacons(), now = Date.now(), out = [];
	for (const nm of TEAM) {
		if (nm === character.name) {
			out.push({ who: nm, ctype: character.ctype, dead: !!character.rip, rest: !!(resting || deathLoop), wait: !!deathLoop, x: character.real_x, y: character.real_y, map: character.map });
			continue;
		}
		const b = bs[nm];
		if (!b || now - b.t > TROUBLE.staleMs) { out.push({ who: nm, unknown: true }); continue; }
		out.push({ who: nm, ctype: b.ctype, dead: !!b.rip, rest: !!b.rest, wait: !!(b.wait || b.loop), x: b.x, y: b.y, map: b.map });
	}
	return out;
}
/* HEALER DEAD, OR TWO DEAD: THE LIVING PULL BACK TO THE LANDING - the
   operator's rulings of 2026-10-24. Answered the same way on every character,
   so the leader and the followers agree without a message. */
function landingWanted() {
	const p = navParty();
	const dead = p.filter((m) => m.dead).length;
	if (character.rip) return null;
	if (dead >= 2) return 'two of the party are dead';
	const healer = p.filter((m) => m.ctype === 'priest')[0];
	if (healer && healer.dead && healer.who !== character.name) return 'the healer is dead';
	return null;
}
function navFighting() {
	if (attackersOnMe() > 0) return true;
	const names = partyNames();
	return threats().some((m) => m.target && names.indexOf(m.target) >= 0 && !caveFriendly(m) && dist(character, m) <= NAV.fightWithin);
}

/* THE PLAN. Returns { kind, x, y, id, why } or a no-move kind. Pure apart from
   the reads above, so the suite drives it with a stubbed world. */
function navPlan(st, now) {
	if (!st) return { kind: 'idle', why: 'no cave state' };
	if (character.rip) return { kind: 'idle', why: 'dead' };
	if (resting || deathLoop) return { kind: 'rest', why: 'resting at the landing' };
	if (now < navManualUntil) return { kind: 'manual', why: 'the operator is driving' };
	const me = navMe();

	/* 1. THE PARTY BEFORE ANY OBJECTIVE. */
	const lw = landingWanted();
	if (lw) { const l = navLanding(st); if (l) return { kind: 'landing', x: l.x, y: l.y, why: lw }; }
	const party = navParty();
	const waiting = party.filter((m) => m.who !== character.name && m.wait && !m.dead && m.map === character.map)[0];
	if (waiting) return { kind: 'collect', x: waiting.x, y: waiting.y, id: waiting.who, why: waiting.who + ' is waiting for the party' };
	const down = party.filter((m) => m.who !== character.name && (m.dead || m.rest))[0];
	if (down) return { kind: 'hold', why: down.who + (down.dead ? ' is dead' : ' is resting') + ' - no new objectives' };

	/* 2. WHAT ATTACKS IS FINISHED FIRST. */
	if (navFighting()) return { kind: 'fight', why: 'the party is being attacked' };

	const objs = navFloorObjs(st);
	const byId = {};
	for (const o of objs) byId[o.id] = o;

	/* 3. AN ESCORT WALKS TO THE STAIRS. */
	if (navEscort && byId[navEscort] && !byId[navEscort].done) {
		const d = navDownDoor(st);
		if (d) return { kind: 'escort', x: d.x, y: d.y, id: navEscort, why: 'escorting to the stairs' };
	}
	if (navEscort && (!byId[navEscort] || byId[navEscort].done)) navEscort = null;

	/* 4. A ROOM UNDER WAY IS SEEN THROUGH: an open vote, or the goal room not
	   yet done and reached. */
	if (st.choice && !st.choice.resolved) return { kind: 'vote', why: 'a vote is open' };
	if (navGoal && navGoal.id && byId[navGoal.id] && !byId[navGoal.id].done && navAt[navGoal.id] && !navSkip[navGoal.id]
		&& NAV_ROOM_KINDS.indexOf(navGoal.kind) >= 0) {
		const o = byId[navGoal.id];
		return { kind: navGoal.kind, x: o.x, y: o.y, id: o.id, why: navGoal.why };
	}

	const route = navRoute(st, me);
	const slack = navSlackMs(st, route);
	const finished = runFinished(st);

	/* 5. THE LOADED DIE: insert the shop where it costs least, once the purse
	   covers it, within detourMaxMs and the run's slack. Re-scored every plan. */
	for (const room in dieShops) {
		const d = dieShops[room];
		if (d.done || d.map !== character.map || navSkip[room]) continue;
		if ((st.gold || 0) < d.price) continue;
		const p = navPoint(st, room);
		if (!p) { navOnce('die-nopos-' + room, 'die skipped - the shop ' + room + ' has no position'); continue; }
		const ins = navInsert(route.points, p);
		/* After the last seal the die is the prize and the detour limit no longer
		   applies - only the clock does. */
		if (!finished && ins.ms > NAV.detourMaxMs) { navOnce('die-far-' + room + '-' + route.rooms.length, 'die skipped - the detour is ' + Math.round(ins.ms / 1000) + 's, over the ' + Math.round(NAV.detourMaxMs / 1000) + 's limit'); continue; }
		if (ins.ms > slack) { navOnce('die-time-' + room + '-' + route.rooms.length, 'die skipped - ' + Math.round(ins.ms / 1000) + 's of detour, ' + Math.round(slack / 1000) + 's of slack'); continue; }
		if (ins.at === 0) return { kind: 'shop', x: p.x, y: p.y, id: room, why: 'buying the Loaded Die (' + d.price + ')' };
	}

	/* 6. A CAMP ALREADY UNDER WAY NEARBY is waited out when the clock allows -
	   early floors rarely, the last floor freely. */
	for (const o of objs) {
		if (o.kind !== 'farm' || o.done || !(o.waves >= 1) || navSkip[o.id]) continue;
		if (Math.hypot(o.x - me.x, o.y - me.y) > NAV.campReach) continue;
		const need = (3 - o.waves) * NAV.waveMs;
		if (finished || slack >= need) return { kind: 'camp', x: o.x, y: o.y, id: o.id, why: 'camp wave ' + o.waves + ' of 3' };
		navOnce('camp-' + o.id + '-' + o.waves, 'camp ' + (o.name || o.id) + ': not waiting for wave ' + (o.waves + 1) + ' - ' + Math.round(slack / 1000) + 's of slack');
	}

	/* 7. AN UNOPENED SHOP OR A REVEALED ROOM CLOSE TO THE ROUTE. The floor's own
	   shop is in its first room by the doorway, so it is usually a pass-through. */
	if (!finished) {
		let pick = null;
		for (const o of objs) {
			/* encounters only: a revealed traveller has no vote to open, and the
			   rare darkmage is not something to walk into on purpose */
			if (o.required || o.kind !== 'encounter' || o.done || navSkip[o.id] || dieShops[o.id]) continue;
			const ins = navInsert(route.points, o);
			if (ins.ms > NAV.inspectMaxMs || ins.ms > slack) continue;
			if (ins.at === 0 && (!pick || ins.ms < pick.ms)) pick = { o: o, ms: ins.ms };
		}
		if (pick) return { kind: 'inspect', x: pick.o.x, y: pick.o.y, id: pick.o.id, why: 'opening ' + (pick.o.name || pick.o.id) + ' (+' + Math.round(pick.ms / 1000) + 's)' };
	}

	/* 8. THE NEXT REQUIRED ROOM, in the cheapest order. */
	if (route.rooms.length) {
		const o = route.rooms[0];
		return { kind: 'room', x: o.x, y: o.y, id: o.id, why: o.kind + ' ' + (o.name || o.id) };
	}

	/* 9. THE STAIRS once the floor is done. */
	const d = navDownDoor(st);
	if (d && !d.locked && !navRequired(st).length) return { kind: 'door', x: d.x, y: d.y, id: 'door:' + d.to, door: d, why: 'the stairs to ' + d.to };
	if (d && navRequired(st).length) return { kind: 'idle', why: 'required rooms left but none reachable' };

	/* 10. AFTER THE LAST SEAL: Amber per second, best first, while it fits. */
	if (finished) {
		const lim = st.limits || {};
		if (lim.amber != null && lim.amber_spawned >= lim.amber) return { kind: 'leave', why: 'the Amber cap' };
		const left = (st.remaining_ms == null ? Infinity : st.remaining_ms) - CFG.exit.finalMs - NAV.marginMs;
		let best = null;
		for (const o of objs) {
			if (o.done || o.required || navSkip[o.id]) continue;
			let amber, ms;
			if (o.kind === 'farm') { const w = Math.max(1, 3 - (o.waves || 0)); amber = w * NAV.campAmber; ms = navMs(me, o) + w * NAV.waveMs; }
			else if (o.kind === 'encounter' && !dieShops[o.id]) { amber = NAV.encounterAmber; ms = navMs(me, o) + NAV.encounterMs; }
			else continue;
			if (ms > left) continue;
			const score = amber / ms;
			if (!best || score > best.score) best = { o: o, score: score, amber: amber, ms: ms };
		}
		if (best) return { kind: 'farm', x: best.o.x, y: best.o.y, id: best.o.id,
			why: 'after the last seal: ' + (best.o.name || best.o.id) + ' ~' + best.amber.toFixed(1) + ' Amber in ~' + Math.round(best.ms / 1000) + 's' };
		return { kind: 'leave', why: 'nothing left that fits the clock' };
	}
	return { kind: 'idle', why: 'nothing to do' };
}

/* ---- doing it ---- */
function navHalt(why) {
	const f = navFlight;
	if (f) f.halted = true;
	navFlight = null;
	try { if (typeof stop === 'function') stop(); else move(character.real_x, character.real_y); } catch (e) {}
	if (why) bump('navHalts');
}
function navLanded(f, e) {
	if (navFlight === f) navFlight = null;
	if (f.halted) return;
	const why = String((e && (e.reason || e.message)) || e);
	if (/interrupt/i.test(why)) {
		navManualUntil = Date.now() + NAV.manualPauseMs;
		bump('navManual');
		clog('a move I did not make - the autopilot waits ' + Math.round(NAV.manualPauseMs / 1000) + 's (' + (mode === 'crypt' ? 'cryptNav' : 'caveNav') + '(true) resumes now)', '#FFD700');
		ev('navManual', {});
		return;
	}
	const key = f.id || (Math.round(f.x) + ',' + Math.round(f.y));
	navFails[key] = (navFails[key] || 0) + 1;
	bump('navFails');
	ev('navFail', { id: f.id || null, x: Math.round(f.x), y: Math.round(f.y), why: why, n: navFails[key] });
	clog('path to ' + (f.id || key) + ' failed (' + why + ', #' + navFails[key] + ')', 'orange');
}
function navGo(g) {
	const f = { x: g.x, y: g.y, id: g.id || null, at: Date.now(), halted: false };
	if (navFlight) navFlight.halted = true;
	navFlight = f;
	bump('navMoves');
	try {
		const pr = smart_move({ map: character.map, x: g.x, y: g.y });
		if (pr && typeof pr.then === 'function') pr.then(() => { if (navFlight === f) navFlight = null; }, (e) => navLanded(f, e));
		else navFlight = null;
	} catch (e) { navLanded(f, e); }
}
/* ONCE A ROOM HAS BEEN REACHED IT STAYS REACHED WITHIN THE SERVER'S OWN ROOM
   RADIUS, 280, or walking out to pull one of its monsters would send the
   leader back to the room's centre and out again. */
const NAV_ROOM_KINDS = ['room', 'inspect', 'camp', 'farm', 'shop'];
function navReached(g) {
	const d = Math.hypot(g.x - character.real_x, g.y - character.real_y);
	if (g.id && navAt[g.id] && NAV_ROOM_KINDS.indexOf(g.kind) >= 0) return d <= 280;
	if (g.kind === 'door' || g.kind === 'escort') return d <= CFG.doorNear;
	if (g.kind === 'collect') return d <= REGROUP.collectedWithin * 0.7;
	return d <= NAV.arriveAt;
}
/* At a room that is not done: pull its monsters, walk to its NPC, or wait. */
function navAtRoom(g, st, now) {
	const actors = navActors(g.id);
	const hostile = actors.filter((a) => !caveFriendly(a));
	if (hostile.length) {
		engagedUntil = now + CFG.engageHoldMs;
		let near = null;
		for (const a of hostile) if (!near || dist(character, a) < dist(character, near)) near = a;
		const reach = Math.max(60, (character.range || 100) * 0.8);
		if (near && dist(character, near) > reach && !navFlight) navGo({ x: near.real_x !== undefined ? near.real_x : near.x, y: near.real_y !== undefined ? near.real_y : near.y, id: g.id });
		return;
	}
	const npc = actors.filter((a) => caveFriendly(a))[0];
	if (npc && dist(character, npc) > NAV.npcAt && !navFlight) {
		navGo({ x: npc.real_x !== undefined ? npc.real_x : npc.x, y: npc.real_y !== undefined ? npc.real_y : npc.y, id: g.id });
		return;
	}
	const since = navAt[g.id];
	if (since && now - since > NAV.stallMs) {
		const o = navFloorObjs(st).filter((x) => x.id === g.id)[0];
		if (o && !o.required) {
			navSkip[g.id] = 1;
			navOnce('stall-' + g.id, 'nothing is happening at ' + (o.name || g.id) + ' - moving on');
		} else navOnce('stall-' + g.id, 'STALLED at required ' + (o ? (o.name || o.id) : g.id) + ' for ' + Math.round((now - since) / 1000) + 's - the operator may need to look', 'red');
	}
}
async function navTick() {
	if (!NAV.enabled || !navOn || stopped || mode !== 'cave' || !inCave() || !active() || !isLeader()) return;
	if (cavePaused()) return;
	const st = caveState(), now = Date.now();
	if (!st) return;
	if (navFloor !== st.floor) { navFloor = st.floor; navAt = {}; navLeg = null; navDoorSince = 0; navEscort = null; }
	const g = navPlan(st, now);
	const changed = !navGoal || navGoal.kind !== g.kind || navGoal.id !== g.id;
	if (changed) {
		ev('navGoal', { kind: g.kind, id: g.id || null, why: g.why, floor: st.floor, rem: st.remaining_ms });
		if (g.kind !== 'fight' && g.kind !== 'vote') clog('autopilot: ' + g.kind + ' - ' + g.why, '#7FD1FF');
	}
	navGoal = g;
	/* THE HOLD STOPS THE LEADER FOR THE PARTY and the autopilot must not walk
	   off - except to go back for a member, which is what a regroup hold is
	   waiting for. Planned BEFORE this test, or a hold that began would hide the
	   collect goal that ends it. */
	if (holdFrom && !holdDone && !navRegroupMove()) { if (navFlight) navHalt('hold'); return; }
	if (g.kind === 'leave') {
		if (!exitForce) { exitForce = true; exitWhyFrom = 0; clog('autopilot: leaving - ' + g.why, '#FFD700'); ev('navLeave', { why: g.why }); }
		return;
	}
	if (['fight', 'hold', 'rest', 'idle', 'vote', 'manual'].indexOf(g.kind) >= 0) {
		if (navFlight && (g.kind === 'fight' || g.kind === 'hold')) navHalt(g.kind);
		return;
	}
	if (!navReached(g)) {
		if (!navLeg || navLeg.key !== g.kind + ':' + (g.id || '')) navLeg = { key: g.kind + ':' + (g.id || ''), from: navMe(), at: now, est: navMs(navMe(), g) };
		const stale = navFlight && now - navFlight.at > NAV.smartMaxMs;
		const elsewhere = navFlight && Math.hypot(navFlight.x - g.x, navFlight.y - g.y) > 40 && !(navFlight.id && navFlight.id === g.id);
		if (!navFlight || stale || elsewhere) {
			const key = g.id || (Math.round(g.x) + ',' + Math.round(g.y));
			if ((navFails[key] || 0) >= NAV.failSkip && !(navRequired(st).some((o) => o.id === g.id))) {
				navSkip[g.id || key] = 1;
				navOnce('fail-' + key, 'no path to ' + (g.id || key) + ' after ' + navFails[key] + ' tries - dropped');
				return;
			}
			navGo(g);
		}
		return;
	}
	/* Arrived. */
	if (navLeg && navLeg.key === g.kind + ':' + (g.id || '')) {
		const ms = now - navLeg.at;
		ev('navLeg', { kind: g.kind, id: g.id || null, straight: Math.round(Math.hypot(g.x - navLeg.from.x, g.y - navLeg.from.y)),
			ms: ms, est: Math.round(navLeg.est), factor: navLeg.est > 0 ? Math.round((ms / navLeg.est) * NAV.mazeFactor * 100) / 100 : null });
		navLeg = null;
	}
	if (g.id && !navAt[g.id]) navAt[g.id] = now;
	if (NAV_ROOM_KINDS.indexOf(g.kind) >= 0) { navAtRoom(g, st, now); return; }
	if (g.kind === 'door') {
		let chests = 0;
		try { chests = Object.keys((typeof get_chests === 'function' && get_chests()) || {}).length; } catch (e) {}
		if (!navDoorSince) navDoorSince = now;
		if (chests && now - navDoorSince < NAV.chestWaitMs) { throttleLog('at the stairs - waiting for ' + chests + ' chest(s)'); return; }
		if (now - navLastDoor < 3000) return;
		navLastDoor = now;
		bump('navDoors');
		clog('autopilot: taking the stairs to ' + g.door.to, '#7FD1FF');
		try { await transport(g.door.to, 0); ev('navDoor', { to: g.door.to, ok: true }); }
		catch (e) { const why = String((e && (e.reason || e.message)) || e); ev('navDoor', { to: g.door.to, ok: false, why: why }); clog('stairs refused: ' + why, 'orange'); }
	}
}
function navRegroupMove() { return !!(navGoal && (navGoal.kind === 'collect' || navGoal.kind === 'landing')); }
/* Is the autopilot the one moving the leader. */
function navDriving() { return NAV.enabled && navOn && mode === 'cave' && isLeader() && inCave(); }
/* Off/on by hand: caveNav(false) hands the leader back to the operator. */
function caveNav(on) {
	if (on === undefined) on = !navOn;
	navOn = !!on; navManualUntil = 0;
	if (!navOn && navFlight) navHalt('off');
	clog('autopilot ' + (navOn ? 'ON' : 'OFF'), '#FFD700');
	return navOn;
}
function caveNavStatus() {
	const st = caveState();
	const g = st ? navPlan(st, Date.now()) : null;
	const out = { on: navOn, goal: g, flying: navFlight ? { id: navFlight.id, x: Math.round(navFlight.x), y: Math.round(navFlight.y) } : null,
		escort: navEscort, skip: Object.keys(navSkip), manualFor: Math.max(0, navManualUntil - Date.now()) };
	clog(JSON.stringify(out));
	return out;
}
/* A RESOLVED VOTE THAT CHOSE AN ESCORT makes the room an escort: the NPC
   follows us and finishes at the stairs, so the goal room becomes the door. */
function navNoteResolved(choice) {
	if (!choice || !choice.resolved || !choice.result || navSaid['res-' + choice.id]) return;
	navSaid['res-' + choice.id] = 1;
	const enc = encounterOf(choice);
	const opt = enc && enc.o.filter((o) => o.i === choice.result)[0];
	if (opt && opt.e === 'escort' && navGoal && navGoal.id) {
		navEscort = navGoal.id;
		clog('autopilot: escort chosen - walking ' + navGoal.id + ' to the stairs', '#7FD1FF');
		ev('navEscort', { room: navGoal.id });
	}
}
/* The followers leave when the leader does: its beacon carries `exit`. */
function leaderExiting() {
	if (isLeader()) return false;
	const b = beacons()[leaderName()];
	return !!(b && b.exit && Date.now() - b.t <= TROUBLE.staleMs);
}
/* A FOLLOWER'S HALF OF THE LANDING RULING. Walks to the landing and kites
   there; returns true while it owns the move. */
async function followerLanding() {
	const why = landingWanted();
	if (!why || mode !== 'cave' || !inCave()) return false;
	const l = navLanding(caveState());
	if (!l) return false;
	const d = Math.hypot(l.x - character.real_x, l.y - character.real_y);
	if (recovering) { recovering = false; aim = null; }
	navOnce('landing-' + why + '-' + (caveState() || {}).floor, why + ' - pulling back to the landing', 'orange');
	if (d > NAV.arriveAt) {
		if (smartFlight && Date.now() - smartFlight < MOVE.smartMoveMaxMs) return true;
		smartFlight = Date.now();
		bump('landingMoves');
		try { await smart_move({ map: character.map, x: l.x, y: l.y }); } catch (e) {}
		smartFlight = 0;
		return true;
	}
	const k = kiteStep(null);
	if (k) { try { move(k.x, k.y); bump('kiteSteps'); } catch (e) {} }
	return true;
}

function lootTick() {
	if (stopped || character.rip) return;
	if (cavePaused()) { bump('pausedLootSkipped'); return; }
	const now = Date.now();
	if (now - lastLoot < CFG.lootMs) return;

	let chests = null;
	try { chests = (typeof get_chests === 'function') ? get_chests() : null; } catch (e) { bump('lootErr'); return; }
	if (!chests) return;
	const ids = Object.keys(chests);
	if (!ids.length) { chestTries = {}; deadChests = {}; return; }

	/* WHY chestFields WAS THE WRONG INSTRUMENT, kept here so the mistake is not
	   made again. It asked "does a chest record carry a position?" with
	   Object.keys, and came back with a PIXI sprite's OWN keys - _texture,
	   vertexData, blendMode, transform - and no x or y anywhere in the list.
	   Read literally that says the filter can never apply. The filter applied
	   4,916 times in the same run.

	   PIXI defines x and y as accessors on DisplayObject.prototype over
	   transform.position, and Object.keys does not walk a prototype. So the
	   one recon built to verify the filter's premise reported the opposite of
	   the truth, and the counters next to it were the only thing that caught
	   it. typeof reads through the prototype; Object.keys does not. */
	if (!tel.chestFields) {
		try { tel.chestFields = Object.keys(chests[ids[0]] || {}); } catch (e) { }
	}

	/* THE QUESTION chestFields COULD NOT ANSWER. Not "is there a position" -
	   there is - but "is it in the same coordinate space as character.real_x",
	   which is what the comparison actually assumes. A sprite's x/y could be
	   render coordinates, and comparing those against world coordinates would
	   reject nearly everything at any radius. 98.3% of attempts were rejected
	   against a 400 radius, so this is the live suspicion. gap vs lootRange on
	   a single real chest settles it. */
	if (!tel.chestProbe) {
		try {
			const c0 = chests[ids[0]];
			const hasXY = (typeof c0.x === 'number' && typeof c0.y === 'number');
			tel.chestProbe = {
				xType: typeof c0.x, yType: typeof c0.y,
				ownKey: Object.prototype.hasOwnProperty.call(c0, 'x'),
				x: hasXY ? Math.round(c0.x) : null, y: hasXY ? Math.round(c0.y) : null,
				myX: Math.round(character.real_x), myY: Math.round(character.real_y),
				gap: hasXY ? Math.round(Math.hypot(c0.x - character.real_x, c0.y - character.real_y)) : null,
				lootRange: CFG.lootRange, filterOn: !!CFG.lootRangeFilter,
				chestMap: c0.map, myMap: character.map,
			};
			ev('chestProbe', tel.chestProbe);
		} catch (e) { tel.chestProbe = { why: String(e) }; }
	}

	/* A chest that is gone has been looted or expired; forget it rather than
	   letting the two maps grow for the length of the run. */
	for (const k in chestTries) if (!chests[k]) delete chestTries[k];
	for (const k in deadChests) if (!chests[k]) delete deadChests[k];

	lastLoot = now;
	let tried = 0;
	for (const id of ids) {
		if (tried >= CFG.lootPerPass) break;
		if (deadChests[id] && now - deadChests[id] < CFG.lootDeadMs) { bump('lootRested'); continue; }
		if (deadChests[id]) { delete deadChests[id]; chestTries[id] = 0; }

		const c = chests[id];
		const useRange = !!CFG.lootRangeFilter;
		const cx = (useRange && c && typeof c.x === 'number') ? c.x : null;
		const cy = (useRange && c && typeof c.y === 'number') ? c.y : null;
		if (cx !== null && cy !== null
			&& Math.hypot(cx - character.real_x, cy - character.real_y) > CFG.lootRange) {
			bump('lootOutOfRange'); continue;
		}

		chestTries[id] = (chestTries[id] || 0) + 1;
		if (chestTries[id] > CFG.lootMaxTries) { deadChests[id] = now; bump('lootGaveUp'); continue; }

		tried++;
		/* loot() carries its own per-chest last_loot safety, so this is a
		   second gate rather than the only one. Nothing throws here in
		   practice - lootErr was 0 across all three characters - the refusal
		   arrives as loot_failed on game_response, which is why the backoff
		   counts ATTEMPTS rather than waiting for an error. */
		try { loot(id); bump('lootCalls'); } catch (e) { bump('lootErr'); deadChests[id] = now; }
	}
}

// ----------------------------------------------------- objective recon -----
/* READ-ONLY. Nothing here clicks, moves or interacts - it only writes down what
   the objective system looks like from inside, so the NEXT version can drive it
   without guessing.

   THE QUESTION IT ANSWERS: the operator found that the objective buttons at the
   top of the screen walk the character to the objective. If the position is
   reachable from `character.cave.objectives` then CaveRun can smart_move there
   itself and never touch the DOM - which is far more robust than synthesising a
   click. If it is NOT in the data, the button's own handler is the fallback, so
   the button is described too.

   Why both: `.click()` on a game button has already failed once in this
   codebase - the COMMAND gamebutton on /hub does not fire its inline onclick -
   so a DOM route is assumed broken until proven otherwise.

   Objectives are sampled once per floor and only when they change, so a 10
   minute run leaves a handful of records rather than thousands. */
let objSeen = {}, lastObjScan = 0;
function objRecon() {
	try {
		if (!inCave()) return;
		if (Date.now() - lastObjScan < 3000) return;
		lastObjScan = Date.now();
		const st = caveState();
		const objs = (st && st.objectives) || null;
		if (!objs) return;
		const floor = st.floor;
		const sig = floor + ':' + objs.map((o) => (o.id || o.name || '?') + (o.done ? '1' : '0')).join(',');
		if (objSeen[sig]) return;
		objSeen[sig] = 1;
		if (!tel.objectives) tel.objectives = [];
		if (tel.objectives.length > 24) return;
		tel.objectives.push({
			at: Date.now(), floor: floor,
			/* field NAMES, not prose - the text blobs are long and useless here */
			fields: objs.map((o) => Object.keys(o).join('|')),
			items: objs.map(function (o) {
				const r = { id: o.id || null, kind: o.kind || o.type || null,
					done: !!o.done, required: !!o.required };
				/* anything position-shaped, whatever it ends up being called */
				for (const k in o) {
					if (/^(x|y|map|pos|position|target|at|where|loc|location|spot)$/i.test(k)) {
						r['pos_' + k] = (o[k] && typeof o[k] === 'object') ? JSON.stringify(o[k]).slice(0, 80) : o[k];
					}
				}
				return r;
			}),
			me: { map: character.map, x: Math.round(character.real_x), y: Math.round(character.real_y) },
		});
		ev('objectives', { floor: floor, n: objs.length });
	} catch (e) {}
}

/* The buttons, described once. parent.document is the top window and this file
   runs in the maincode iframe, so the DOM is reachable - but it is only ever
   READ here. */
let btnScanned = false;
function objButtonRecon() {
	try {
		if (btnScanned || !inCave()) return;
		const d = parent.document;
		if (!d) return;
		const out = [];
		const nodes = d.querySelectorAll('[onclick], [id*="objective" i], [class*="objective" i], .gamebutton, [class*="quest" i]');
		for (let i = 0; i < nodes.length && out.length < 30; i++) {
			const n = nodes[i];
			const txt = (n.innerText || '').trim().slice(0, 40);
			if (!txt && !/objective|quest/i.test((n.id || '') + ' ' + (n.className || ''))) continue;
			out.push({
				tag: n.tagName, id: n.id || null,
				cls: (typeof n.className === 'string' ? n.className : '').slice(0, 60) || null,
				text: txt,
				/* the handler NAME, which is what a future version would call
				   directly instead of faking a click */
				onclick: n.getAttribute ? (n.getAttribute('onclick') || '').slice(0, 120) || null : null,
				data: (function () { const o = {}; try { for (const k in n.dataset) o[k] = String(n.dataset[k]).slice(0, 40); } catch (e) {} return Object.keys(o).length ? o : null; })(),
				rect: (function () { try { const r = n.getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); } catch (e) { return null; } })(),
			});
		}
		if (!out.length) return;
		btnScanned = true;
		tel.objButtons = out;
		/* and the candidate functions on the top window, by name only */
		const fns = [];
		try { for (const k in parent) { if (/objectiv|quest|waypoint|goto|travel_to/i.test(k) && typeof parent[k] === 'function') fns.push(k); } } catch (e) {}
		tel.objFns = fns.slice(0, 20);
		ev('objButtons', { n: out.length, fns: fns.length });
	} catch (e) {}
}

// ------------------------------------------------------------ telemetry ----
/* Keyed by CLASS, not name. A key containing "Token" is redacted by output
   filters on the reading side, which would silently blind the priest's
   telemetry - measured 2026-10-06. */
const TEL_KEY = 'cave_tel_' + character.ctype;

/* ONE KEY PER CLASS MEANT EVERY RUN DESTROYED THE LAST ONE. That is why a
   question about the 2026-10-10 run - did its doors work? - was unanswerable
   four days later: v7 carried the same doorTry/doorOk counters, recorded a real
   answer, and tonight's run overwrote it. runId already existed and was not in
   the key.

   THE ARCHIVE KEY KEEPS THE CLASS-NOT-NAME RULE above. A key containing
   "Token" is redacted by output filters on the reading side, so FatherToken's
   name must never appear in one; ctype + runId is safe.

   runId is 'r' + base36 of Date.now(), so ids of equal length sort lexically
   in time order - which lets telPrune find the oldest by sorting KEYS instead
   of parsing five 30 KB blobs. */
const TEL_RUN_PREFIX = TEL_KEY + '_';
const TEL_RUN_KEY = TEL_RUN_PREFIX + 'r' + Date.now().toString(36);
const TEL_KEEP = 5;
const TEL_ARCHIVE_MS = 30000;

/* THE VERSION IS READ FROM LINE 1, NOT HAND-MAINTAINED, BECAUSE THE
   HAND-MAINTAINED ONE WAS WRONG AND WAS BELIEVED. `ver: 14` sat in the dump
   and in the load event while v16 was live, so nothing derived from it and it
   was a lie rather than a defect - but a session read it as a deploy report
   and was wrong twice over, since the second signal that agreed with it
   (`noDoor` missing from the counter table) is an ev() and not a counter, so
   its absence measured nothing either. The live leash band settled it from the
   MECHANISM instead. Third stale version literal in this project after the v89
   header and MERCHANT_VER, which is the argument for reporting TEXT over any
   hand-maintained number. -> CLAUDE.md "The cave run"

   THREE THINGS DIFFER FROM THE MERCHANT'S READER AND EACH BREAKS A STRAIGHT
   PORT:
   (1) THE MARKER IS ON LINE 1 here; Merchant's is on line 2.
   (2) LINE 1 ENDS "(TEST BUILD)", so Merchant's end-anchored /\bv(\d+)\s*$/
       returns null against it. The anchor is the FILE MARKER instead.
   (3) CaveRun is a ROOT script, so it is NOT covered by the current-version-
       only rule and its header ACCUMULATES HISTORY - 12 lines match
       ^// v<digits>. Any read taking the LAST match returns the OLDEST entry,
       which is exactly the OpenGifts failure that returned 2 against a v11
       build. LINE 1 ONLY, never a header scan.

   A FOREIGN BUFFER YIELDS NULL RATHER THAN A WRONG NUMBER, which is the whole
   reason the file marker is in the pattern rather than just a version.
   parent.codemirror_render reports the slot the EDITOR has LOADED, which need
   not be the script executing - measured 2026-10-19 with slot 8 open and
   Merchant running - so without the marker this would confidently report
   another script's version. Requiring "// CaveRun.js" turns FAIL-WRONG into
   FAIL-NULL, the failure the retry already handles and the only one a cache is
   safe under.

   IT IS ALSO WHAT MAKES caveHeaderLine() SAFE TO REPORT RAW. All four party
   scripts carry the CODE-slot token on LINE 2 and CaveRun carries none, so a
   foreign buffer's line 1 happens not to hold one today; the gate is what
   guarantees that rather than the coincidence.

   THE PRE-SLOT FAILURE IS FAIL-NULL TOO: the game's tutorial template occupies
   the buffer for ~1.8-2.2s after a cold load and its line 1 does not match this
   marker either, so an early read is null and the retry covers it. */
function caveHeaderLine() {
	try {
		const src = parent && parent.codemirror_render && parent.codemirror_render.getValue();
		if (typeof src !== 'string') return null;
		const line1 = src.split('\n')[0] || '';
		return /^\/\/ CaveRun\.js\b/.test(line1) ? line1 : null;
	} catch (e) { return null; }
}
function caveHeaderVersion() {
	const line1 = caveHeaderLine();
	if (!line1) return null;
	const m = line1.match(/^\/\/ CaveRun\.js\b.* - v(\d+)\b/);
	return m ? Number(m[1]) : null;
}
/* FIRST SUCCESSFUL READ WINS AND IS KEPT, so a save_code part-way through a run
   cannot shift the answer under the build that is actually executing. A null is
   retried rather than cached, because downstream it reads exactly like a build
   from before this marker existed - the one direction nobody can detect. */
const caveVerCache = { v: null, line: null };
function caveVersion() {
	if (caveVerCache.v === null) caveVerCache.v = caveHeaderVersion();
	return caveVerCache.v;
}
function caveBuild() {
	if (caveVerCache.line === null) caveVerCache.line = caveHeaderLine();
	return caveVerCache.line;
}

const tel = {
	ver: caveVersion(), build: caveBuild(), runId: TEL_RUN_KEY.slice(TEL_RUN_PREFIX.length), name: character.name, ctype: character.ctype,
	loadedAt: Date.now(), at: 0,
	/* COUNTER NAMES SAY WHAT THEY COUNT. v6 had a single `deaths` fed by
	   game.on('death'), which fires for EVERY entity; 91 of them got read as 91
	   party wipes when the real number was three. Split, permanently. */
	counters: { ticks: 0, engagedTicks: 0, pausedTicks: 0, pausedMoveSkipped: 0,
		pausedAttackSkipped: 0, attacks: 0, attackFail: 0, noTargetWhileEngaged: 0,
		closeSteps: 0, closeSmart: 0, kiteSteps: 0, kiteRejected: 0, recoveries: 0,
		followSteps: 0, followBlocked: 0,
		outrunWarnTicks: 0, doorTry: 0, doorOk: 0, telArchiveFail: 0, cryptBlocked: 0,
		votesEcho: 0, votesAuto: 0, voteUnknown: 0, voteFallback: 0, dieBuys: 0, voteErr: 0,
		friendlySkips: 0, exits: 0, exitErr: 0, entityDeaths: 0, partyDeaths: 0, respawnCalls: 0,
		hpPots: 0, mpPots: 0, scares: 0, exceptions: 0,
		invites: 0, accepts: 0, lootCalls: 0, lootErr: 0,
		buys: 0, buyErr: 0, restockBroke: 0, restockGaveUp: 0, restockMoveFail: 0,
		pausedLootSkipped: 0, lootRested: 0, lootGaveUp: 0, lootOutOfRange: 0,
		travelLeashTicks: 0, troubleTicks: 0, troubleWarnTicks: 0, beaconWriteFail: 0,
		holds: 0, holdStops: 0, holdResumes: 0, holdResumeFail: 0, holdGaveUp: 0 },
	skills: {}, skillFail: {}, skillFailWhy: {},
	/* EVERY response reason, counted. v6 filtered them through TEL_REASONS
	   before recording, so distance / not_ready / no_mp / cooldown never
	   appeared at all and cave_paused looked more dominant than it was. The
	   regex now governs only the event ring, never the tally. */
	reasons: {},
	friendly: {},          // v9 forensics: distinct friendly_target victims
	objectives: null,      // v9 recon: what an objective record looks like
	chestFields: null,     // v10 recon: OWN KEYS ONLY - see chestProbe for why
	chestProbe: null,      // v11 recon: the question chestFields could not answer
	doorShape: null,       // v11 recon: what a door record actually carries
	doors: [],             // v11 recon: one entry per transport() attempt
	objButtons: null,      // v9 recon: the top-bar buttons, read-only
	objFns: null,
	maxDistLeader: 0, msBeyondLeash: 0, msRecovering: 0, msHolding: 0, helpers: {}, events: [],
};
function bump(k, n) { tel.counters[k] = (tel.counters[k] || 0) + (n || 1); }
function bumpReason(r, place) {
	tel.reasons[r] = (tel.reasons[r] || 0) + 1;
	if (place) { const k = r + '@' + place; tel.reasons[k] = (tel.reasons[k] || 0) + 1; }
	if (r === 'cant_respawn') { try { noteRespawnRefused(); } catch (e) {} }
}
let lastEvFlush = 0;
function ev(kind, data) {
	tel.events.push({ t: Date.now(), k: kind, d: data === undefined ? null : data });
	if (tel.events.length > 80) tel.events.shift();
	/* v6 stringified the whole blob on every single event - with 175 entity
	   deaths a run that is a lot of synchronous JSON for nothing. */
	if (Date.now() - lastEvFlush > 500) { lastEvFlush = Date.now(); telFlush(true); }
}
let lastFlush = 0;
function telFlush(force) {
	if (!force && Date.now() - lastFlush < 2000) return;
	lastFlush = Date.now();
	try {
		tel.at = Date.now();
		const st = caveState(), lp = leaderPos();
		tel.role = role(); tel.leader = leaderName(); tel.mode = mode;
		tel.live = {
			mode: mode, phase: phase, active: active(), inCave: inCave(), paused: cavePaused(),
			map: character.map, engaged: engaged(), recovering: recovering,
			hp: character.hp, max_hp: character.max_hp, mp: character.mp, max_mp: character.max_mp,
			speed: character.speed, range: character.range,
			targets: character.targets, rip: !!character.rip,
			x: Math.round(character.real_x), y: Math.round(character.real_y),
			leaderMap: leaderMap(), party: partyRoster(), partyComplete: partyComplete(),
			distLeader: lp ? Math.round(Math.hypot(lp.x - character.real_x, lp.y - character.real_y)) : null,
			gate: phase === 'staged' ? gateReport() : undefined,
			cave: st ? { remaining_ms: st.remaining_ms, floor: st.floor, gold: st.gold, amber: st.amber,
				paused: st.paused,
				doors: (st.doors || []).map((d) => d.to + (d.locked ? '*' : '')),
				objectivesLeft: (st.objectives || []).filter((o) => o.required && !o.done).length,
				choice: st.choice ? { id: st.choice.id, resolved: !!st.choice.resolved,
					mine: st.choice.votes && st.choice.votes[character.name] } : null } : null,
		};
		const blob = JSON.stringify(tel);
		parent.localStorage.setItem(TEL_KEY, blob);
		telArchive(false, blob);
	} catch (e) {}
}

/* ARCHIVED ON ITS OWN CLOCK, NOT ON `force`. ev() already calls telFlush(true)
   on a 500ms throttle, so archiving on every forced flush would write 30 KB
   twice a second for nothing. 30s is the resolution of the worst case that
   actually happens: the operator switches scripts and the run ends with no
   final flush, losing at most the last half minute. */
let lastArchive = 0;
function telArchive(force, blob) {
	if (!force && Date.now() - lastArchive < TEL_ARCHIVE_MS) return;
	lastArchive = Date.now();
	try {
		parent.localStorage.setItem(TEL_RUN_KEY, blob);
	} catch (e) {
		/* Out of quota. Drop every older archive and try once - losing old runs
		   beats losing the one in progress. */
		telPrune(0);
		try { parent.localStorage.setItem(TEL_RUN_KEY, blob); }
		catch (e2) { bump('telArchiveFail'); return; }
	}
	telPrune(TEL_KEEP);
}

/* Collect the keys BEFORE removing any: localStorage is index-addressed and
   removing during the walk reshuffles what ls.key(i) returns. */
function telPrune(keep) {
	try {
		const ls = parent.localStorage;
		const mine = [];
		for (let i = 0; i < ls.length; i++) {
			const k = ls.key(i);
			if (k && k.indexOf(TEL_RUN_PREFIX) === 0) mine.push(k);
		}
		if (mine.length <= keep) return;
		mine.sort();   // lexical == chronological, see TEL_RUN_KEY
		const doomed = mine.slice(0, mine.length - keep);
		for (let i = 0; i < doomed.length; i++) ls.removeItem(doomed[i]);
	} catch (e) {}
}

/* Everything this class has kept, newest last - so a later session can read a
   run that has already been replaced as the live one. */
function caveRuns() {
	const out = [];
	try {
		const ls = parent.localStorage;
		for (let i = 0; i < ls.length; i++) {
			const k = ls.key(i);
			if (k && k.indexOf(TEL_RUN_PREFIX) === 0) out.push(k);
		}
	} catch (e) {}
	return out.sort();
}

function telCensus() {
	const names = ['smart_move', 'move', 'can_move_to', 'attack', 'heal', 'use_skill', 'change_target',
		'is_in_range', 'can_attack', 'is_on_cooldown', 'get_nearest_monster', 'get_targeted_monster',
		'transport', 'enter', 'show_json', 'game_log', 'ms_to_next_skill', 'get_entities',
		'loot', 'get_chests', 'send_party_invite', 'accept_party_invite', 'send_cm', 'respawn'];
	for (const n of names) { try { tel.helpers[n] = eval('typeof ' + n); } catch (e) { tel.helpers[n] = 'undefined'; } }
	try { tel.helpers['parent.socket'] = typeof parent.socket; } catch (e) {}
	try { tel.helpers['G.skills'] = typeof parent.G.skills; } catch (e) {}
}

const TEL_REASONS = /keeper|party_too_large|daily|cave_|zone_busy|already_|stale_choice|vote_closed|invalid_reply|transport|seal_closed|cant_enter|defeated|use_exit|respawn/i;
function telHook() {
	const fn = function (data) {
		try {
			if (!alive() || !data) return;
			const r = typeof data === 'string' ? data : (data.reason || data.response || '');
			if (!r) return;
			bumpReason(String(r), data && data.place);
			if (TEL_REASONS.test(String(r))) ev('response', { r: String(r), failed: !!(data && data.failed), place: data && data.place });
		} catch (e) {}
	};
	try { if (parent.__caveTelHook) parent.socket.off('game_response', parent.__caveTelHook); } catch (e) {}
	try { parent.socket.on('game_response', fn); parent.__caveTelHook = fn; } catch (e) {}
	/* game.on has no matching off(), so a handler from an earlier engage stays
	   registered forever. alive() makes the stale ones inert instead. */
	try { game.on('death', function (d) { if (!alive()) return; bump('entityDeaths'); }); } catch (e) {}
	try { game.on('new_map', function (d) { if (!alive()) return; ev('new_map', d && (d.name || d.map)); }); } catch (e) {}
}
function caveDump() {
	/* REFRESHED HERE, NOT ONLY AT CONSTRUCTION. tel is built while the editor
	   buffer may still hold the tutorial template, so the construction-time read
	   is legitimately null; the memoised readers retry until the first non-null
	   answer. `build` is line 1 VERBATIM - read the text, not the number. */
	try { tel.ver = caveVersion(); tel.build = caveBuild(); } catch (e) {}
	telFlush(true);
	try { telArchive(true, JSON.stringify(tel)); } catch (e) {}
	try { show_json(tel); } catch (e) {}
	clog('telemetry at ' + TEL_KEY + ' - this run archived at ' + TEL_RUN_KEY);
	clog('kept runs: ' + caveRuns().join(', '));
	return tel;
}

// ------------------------------------------------------------ commands -----
function caveSay(msg) {
	if (!isLeader()) return;
	try { send_cm(followers(), { cave: msg }); ev('sent', msg); }
	catch (e) { clog('send_cm failed: ' + e, 'red'); }
}
function caveLead(name) {
	if (TEAM.indexOf(name) < 0) { clog('leader must be one of ' + TEAM.join(', '), 'red'); return null; }
	try { parent.localStorage.setItem(LEADER_KEY, name); } catch (e) { clog('could not write ' + LEADER_KEY + ': ' + e, 'red'); return null; }
	recovering = false; aim = null; votedFor = {}; deadDoors = {};
	clog('leader is now ' + name + ' - I am the ' + role() + '. Every tab shares this key.', '#FFD700');
	ev('leader', name);
	return { leader: name, me: character.name, role: role() };
}
/* THE REHEARSAL. No staging, no gate, no votes, no doors, and caveEnter() is
   refused - so the cohesion, kiting, combat, potion, party and loot paths can
   all be exercised on an ordinary map without spending the one daily run.
   Everything that broke on 2026-10-06 except doors and votes reproduces here. */
/* Crypt mode. The leader is yours to drive; the other two cohere and shoot,
   and only at CRYPT.only. Run it on all three before you take the door. */
function caveCrypt() {
	launcher.handBackAt = 0;
	mode = 'crypt'; stopped = false; phase = 'active'; recovering = false; aim = null;
	clog('CRYPT MODE as ' + role() + ' - hunting: ' + CRYPT.only.join(', ')
		+ ' | will answer anything that starts it EXCEPT ' + CRYPT.never.join(', '), '#FFD700');
	clog('leader is operator-driven; followers cohere at ' + leash().closeAt + 'u (' + leash().mode + '); hold is ' + (holdActive() ? 'ON' : 'off here'), '#FFD700');
	return { mode: mode, role: role(), leader: leaderName(),
		only: CRYPT.only.slice(), never: CRYPT.never.slice() };
}

/* Adjust the lists without a redeploy - v12 needed a paste to change its mind,
   which is a poor property to discover while standing in the room. Call with no
   arguments to read the current lists. */
function caveOnly() {
	if (arguments.length) CRYPT.only = Array.prototype.slice.call(arguments).filter(Boolean);
	clog('crypt only: ' + (CRYPT.only.join(', ') || '(nothing)'), '#FFD700');
	return CRYPT.only.slice();
}

function caveNever() {
	if (arguments.length) CRYPT.never = Array.prototype.slice.call(arguments).filter(Boolean);
	clog('crypt never (not even in self-defence): ' + (CRYPT.never.join(', ') || '(nothing)'), '#FFD700');
	return CRYPT.never.slice();
}

function caveDry() {
	launcher.handBackAt = 0;
	if (inCave()) { clog('already inside a cave - caveDry() is for outside', 'orange'); return null; }
	mode = 'dry'; stopped = false; phase = 'active'; recovering = false; aim = null;
	clog('DRY RUN as ' + role() + ' (' + character.name + '/' + character.ctype + ' speed ' + character.speed
		+ ' range ' + character.range + '). Leader ' + leaderName() + '. Will NOT enter anything.', '#FFD700');
	ev('dry', { leader: leaderName(), role: role() });
	return { mode: mode, role: role(), leader: leaderName() };
}
/* RESTOCK COMES FIRST, AND EACH CHARACTER DOES ITS OWN. caveSay('go') reaches
   the followers, so all three start shopping at the same moment rather than
   the leader waiting at Dorr for two characters that have not left town. The
   phase advances itself to 'gather' from restockTick - on success, on running
   out of gold, or on the give-up timer - so there is no path where a character
   stays in town indefinitely. */
function caveGo() {
	launcher.handBackAt = 0;
	if (offCave()) { clog('in ' + mode + ' mode - caveStop() then re-engage for a real run', 'orange'); return null; }
	stopped = false;
	restockReset();
	phase = 'restock';
	caveSay('go');
	const short = restockShortfall();
	clog('restocking first' + (Object.keys(short).length ? ' - short ' + JSON.stringify(short) : ' - already topped up')
		+ (isLeader() ? ' - and told ' + followers().join(', ') : '') + ' - combat held until inside', '#FFD700');
	return phase;
}
function caveStop() { stopped = true; phase = 'idle'; recovering = false; aim = null; caveSay('stop'); clog('stopped', 'orange'); }
function caveStatus() {
	const st = caveState(), lp = leaderPos();
	const info = { mode: mode, only: (mode === 'crypt' ? CRYPT.only.slice() : null),
		never: (mode === 'crypt' ? CRYPT.never.slice() : null),
		role: role(), leader: leaderName(), phase: phase, active: active(),
		inCave: inCave(), paused: cavePaused(), map: character.map, engaged: engaged(), recovering: recovering,
		speed: character.speed, range: character.range,
		distLeader: lp ? Math.round(Math.hypot(lp.x - character.real_x, lp.y - character.real_y)) : null,
		distToDorr: Math.round(dist(character, CFG.keeper)), targets: character.targets,
		leaderMap: leaderMap(), party: partyRoster(), partyComplete: partyComplete(),
		gateBlockers: gateReport(),
		cave: st ? { remaining_ms: st.remaining_ms, floor: st.floor, gold: st.gold, amber: st.amber,
			doors: (st.doors || []).map((d) => d.to + (d.locked ? '(locked)' : '')),
			choice: st.choice ? { id: st.choice.id, resolved: st.choice.resolved,
				options: (st.choice.options || []).map((o) => o.id) } : null } : null };
	clog(JSON.stringify(info)); try { show_json(info); } catch (e) {}
	return info;
}
function caveEnter() {
	if (offCave()) { clog('REFUSED - ' + mode + ' mode never enters the Cave. caveStop() and re-engage first.', 'red'); return null; }
	if (!isLeader()) { clog('only ' + leaderName() + ' enters - the server builds the party from the opener', 'orange'); return; }
	const b = gateReport();
	if (b.length) { clog('NOT entering - ' + b.join(' | '), 'red'); return b; }
	clog('entering...', '#FFD700');
	ev('enterTry');
	try { return enter('dreams'); } catch (e) { ev('enterThrew', String(e)); clog('enter threw: ' + e, 'red'); }
}

/* ============================================================ CRYPT RUN ====
   v32, the operator's spec of 2026-11-08. caveCrypt() is unchanged: the
   operator drives the leader and the followers cohere and shoot. cryptRun()
   is that mode plus the parts the spec automates, on all three at once:

   ROLES. The cave leader (FatherToken by default) holds the cryptkey, opens
   the instance and drives. Dexon is the mule: the other two hand him their
   loot after each run, and he calls the merchant when he is short of room.

   BEFORE ENTRY, at the crypt door. Each member publishes its mluck in its
   beacon; while any of the three lacks it, Dexon asks Meltymerch - Dexon,
   because the merchant takes a `location` request from Dexon only
   (CONFIG.mluck.targets in Party/Merchant.js), and the party standing at the
   door puts the other two inside the merchant's 320 for his opportunistic
   pass. The leader enters only with a cryptkey already in HIS bag; with none
   he says so in red and waits. Nothing here ever touches the bank.

   ENTRY AND REJOIN. The leader writes the instance id the moment he is in, to
   `crypt_instance` and to the run record below, and sends it over cm as well.
   Anyone else at the door enters that instance at once. A death in the crypt
   respawns at the crypt door (G.maps.crypt.on_death is cave spawn 2, the same
   point the server measures entry from), so the respawned member re-enters at
   once. use_town inside the instance lands at the instance's own spawn, the
   entrance.

   THE RESPAWN RULE - cryptMayRespawn(). A member who is in the crypt, alive
   or dead, holds the instance. A dead member respawns only while another
   member is still inside. If all three are dead the leader respawns LAST:
   the other two respawn, re-enter and wait at the entrance, and only when
   both are back inside alive does the leader respawn, re-enter and regroup
   with them before re-engaging. The operator measured an instance staying
   open with only dead members in it. The server source agrees and goes
   further: a crypt instance is never destroyed, only paused 50s after its
   last live player leaves (upstream a5c133dc, create_instance and the pause
   loop). So the rule costs a little time and loses nothing.

   FIGHT ORDER - CRYPT_RUN.stages. a3 and a7 first, then a2, then the seven
   vbat. Crypt monsters never respawn (respawn -1), so a kill is final for the
   instance; kills are recorded by monster id from the game's death event,
   shared through the run record so all three tabs agree. Only the current
   stage is hunted; any plan monster that starts a fight is answered. a2 is
   pulled: once he is on the party the leader walks back toward pullSpot, the
   left wing of the room south of the entrance corridor, unless someone is
   low, and holds for nobody on the way (v34, R1 and R2). A stage target not
   in view is searched for (v34, see `homes` and `tour` below); one not found
   in searchMaxMs is given up and the run moves on, and taken back if anyone
   sees it again (R6).

   STRAYS - anything that is not a2, a3, a7 or vbat. Never hunted. If one
   comes at a member, that member alone keeps it: it walks it right of the
   operator's line (x >= lineX), then casts use_town back to the entrance and
   rejoins, or dies and the respawn rule takes over. The others leave it
   alone, and nobody ever swings at a6, a8 or a1 (CRYPT.never).
   v37, ruling 3: a8 is NEVER kited - a cursed member walks at ~45 against its
   76. On the mage it is scared off; on anyone else the party backs off west
   along the route, and the bats wait while it is near them.

   THE BATS - v37, rulings 1, 2 and 4. They are the point of the run; a7 and
   a3 are worked for achievements and can be missed. The route from the
   entrance to them (CRYPT_RUN.route) is never no-go, and a zone monster seen
   outside the zone blocks only the ground around it. Nobody stands in the
   box or walks through it: the leader waits at vbatSpot, north of it, and
   Dexon pulls one bat at a time from his full range and walks straight back.
   Nobody else shoots a bat until it is on the party.

   a2 - v35, the operator's rulings of 2026-11-08 19:02-19:08 EST, from the
   browser session's probe of the run-2 fight (CRYPT_RUN.a2). His anger fires
   every 8s, in or out of combat and regardless of facing, onto a random live
   player within 300 - the current target included - and the client sees the
   clock as s.anger.ms. Nobody inside 300, the tick does nothing. So:
     SCARE AND DISENGAGE (P1). The member he is on scares right after a tick
     and gets past 300 before the next one, and nobody touches him meanwhile,
     so he stays untargeted. Alone when only that member is low; the whole
     party when its hp is low, re-engaging once healed with no poison left,
     the mage opening. Scare needs the jacko, so in practice it is the mage's.
     BLINK (P5). With scare unavailable, the mage blinks past 300 just before
     a tick, so the tick cannot pick her.
     CURSE (P2) is kept on him the whole fight: from source, cursed is output
     -20 and speed -20 on a monster as on a player, and +20% damage taken.
     ABSORB (P3) - v36, decided each time from hp (cryptAbsorbPick): at once
     when the member he is on will not last until his next tick and the priest
     will; to soak the window when that member is clearly the lowest and the
     priest clearly healthier; never when the priest would not last the window,
     nor while a2 is on a mage who can scare or blink. Absorb holds him only
     until the next tick, which re-picks at random.
     POSITIONING (P4). Each member stands at its own range from him on the
     priest's side - the priest nearest, the damage dealers behind, all inside
     heal range - so after an anger switch he has the most ground to cover.
     No station is taken in the zone or by the vbat box.
   The pull no longer stops where it is at 40% (Q1): the disengage replaces it.

   AFTER EACH RUN the party leaves to the crypt door, the other two send Dexon
   their loot, and Dexon asks the merchant to take the overflow while he has
   fewer than muleMinFree slots. v36: every member, Dexon too, sends its loot
   straight to the merchant whenever he is in send range, Dexon staying the
   fallback. The leader opens the next run once everyone is at the door,
   muled, mlucked and roomy, and he holds a key; with no key left after a run,
   all three hand back to their character slots (cryptOutOfKeys). Each stage
   is gone after only once the party has rested (cryptRestShort), and each run
   ends in a CRYPT DUMP row.

   THE MAP. Every point below is a LEVEL-0 cell of the server's reachability
   grid for the crypt (precomputed_map_data.js smap_data.crypt, upstream
   a5c133dc). v34: only level 0 is walkable - server_bfs pushes level + 1 for
   a step can_move refuses, so levels 1-7 are cells past a wall, and v32's a3
   point (1470,-1400) was one of them, in a sealed pocket. Path lengths from
   the entrance on level 0: a7 2,170, a2 2,980, the vbat box 3,310, a3 3,630;
   a7 to a2 830, a2 to the box 330, a7 to a3 2,140. */
const CRYPT_RUN = {
	mule: 'Dexon',
	merchant: 'Meltymerch',
	door: { map: 'cave', x: -193, y: -1296 },   // G.maps.cave.spawns[2]; enter() is refused beyond 120
	doorReach: 100,
	entrance: { x: 0, y: 0 },                    // the crypt's spawn: entry, re-entry and use_town all land here
	stages: [['a3', 'a7'], ['a2'], ['vbat']],
	need: { a3: 1, a7: 1, a2: 1, vbat: 7 },
	/* SEARCHING - v34, the operator's rulings R4 and R5. A stage target not in
	   view is looked for where any member last saw it, then where a member
	   died to it, then at its home, then over `tour`: fifteen points whose
	   300-unit path neighbourhoods cover every walkable cell left of the line
	   and outside the zone, in nearest-next order from the entrance. A point
	   near a monster that is not this stage's, inside the zone, past the line,
	   or near the home of a plan monster still to come is skipped, and so is
	   one whose walk failed searchFailSkip times. homes are the spawns, in the
	   order a7 then a3 - a7's hall is on the way to the top hall. */
	homes: { a7: [[730, -1080]], a3: [[1790, -1480]], a2: [[1110, -630]], vbat: [[1190, -380]] },
	tour: [[0, 0], [-40, -460], [-180, -520], [-180, -1040], [380, -1100], [600, -1080], [740, -660], [1100, -440],
		[1140, -340], [1440, -560], [1500, -860], [420, -1480], [940, -1480], [1240, -1480], [1760, -1520]],
	homeAvoid: 250,
	avoidR: 220,
	avoidMs: 120000,            // a monster seen this recently keeps its neighbourhood off the search
	searchFailSkip: 2,
	searchMaxMs: 300000,        // a stage target not found this long is given up, and the run moves on
	seenEveryMs: 2000,
	/* a2's fight spot: the left wing of the room south of the entrance
	   corridor - the operator's ruling R2, 2026-11-08. A dead end on three
	   sides, 730 by path from the entrance and 2,430 from a2's spawn. The
	   operator's to move - cryptSpot('pull', x, y). */
	pullSpot: { x: -270, y: -465 },
	/* v37, ruling 4: just OUTSIDE the box's north edge, by a2's room, where the
	   leader and Dexon stood at 20:08. The old spot (1190,-380) was the middle
	   of the box, and a follower rejoining him walked through it. */
	vbatSpot: { x: 950, y: -500 },
	vbatClearMs: 20000,         // standing at vbatSpot with no vbat in view this long, after one kill, is a clear box
	/* THE NO-GO ZONE - R6. x > zone.x and y > zone.y; it holds a8, a5, a4 and
	   a1. One of those seen outside it grows it to cover the sighting, plus
	   zoneMargin. Nothing walks into it but a member kiting a stray. */
	zone: { x: 1850, y: -1235 },
	zoneMonsters: ['a8', 'a5', 'a4', 'a1'],
	zoneMargin: 100,
	/* v37, rulings 1 and 2: a zone monster seen outside the zone no longer
	   moves its edge - run 3 moved it to x > 858 and swallowed the bats. It
	   blocks zoneLocalR around the sighting for zoneLocalMs instead, and never
	   the bat box or the route to it. */
	zoneLocalR: 300,
	zoneLocalMs: 300000,
	/* THE BATS ARE THE POINT OF THE RUN (ruling 2); a7 and a3 are worked for
	   achievements and can be missed. The box is the vbat spawn boundary
	   (design/maps.js crypt, upstream a5c133dc). */
	vbatBox: { x1: 903.57, y1: -465.05, x2: 1479.2, y2: -304.03 },
	boxMargin: 40,
	/* THE PROTECTED ROUTE - the level-0 shortest path from the entrance to
	   vbatSpot that keeps out of the box, cut into straight legs whose every
	   cell is level 0, computed once offline: entrance corridor, the hall
	   north, a7's hall, the corridor down past a2's room, the spot. 2,717
	   long. routeBranch is the pull-spot room. Within routeR of either is
	   never no-go, and a member walking back alone walks this. */
	route: [[0, 0], [-30, -380], [-40, -450], [-180, -540], [-180, -940], [-170, -1020], [-130, -1050], [-50, -1070],
		[750, -1070], [750, -740], [760, -660], [790, -640], [950, -560], [950, -500]],
	routeBranch: [[-40, -450], [-270, -460]],
	routeR: 150,
	/* a8 - ruling 3. Never kited, never attacked: attack 2680 x frequency 4,
	   a curse aura of 300 that slows a member to ~45 against its charge 76. */
	noKite: ['a8'],
	a8Near: 400,                // a8 this close to the bat spot or the box: the bats wait
	a8Clear: 340,               // past its 300 aura, with a margin
	a8RecentMs: 30000,
	a8ChaseMs: 8000,            // the party backs off while a8 was on a member this recently
	a8WaitMs: 300000,           // the bats wait this long for a8 to leave, then are given up
	/* The pull - ruling 4. Dexon (range 192, single target) shoots the nearest
	   bat from full range, outside the box, and walks straight back. */
	puller: 'Dexon',
	pullSlack: 20,
	pullA8Avoid: 150,
	pullMaxMs: 20000,
	lineX: 1860,                // right of the operator's line everywhere - past the zone's edge, R6
	kiteTop: { x: 1900, y: -1760 }, // the top strip, east of the corridor up from a3's spawn
	kiteMid: { x: 1880, y: -880 },  // inside the zone, ~160 west of a8's spawn; the operator allows a stray to be dragged there
	kiteLostMs: 4000,           // the stray off me this long and the kiter goes home anyway
	kiteMaxMs: 60000,
	regroupWithin: 150,
	fightWithin: 250,
	holdAt: 180,
	holdReleaseAt: 120,
	holdMaxMs: 20000,           // a hold for a follower's gap alone gives up after this
	/* REST BEFORE EACH STAGE - v36, the operator's ruling of 2026-11-08
	   19:30. All three near full hp and mp at a safe spot before a stage is
	   gone after, and before a2 the scare holder with mp for one scare. */
	restHpAt: 0.9,
	restMpAt: 0.8,
	restSafeR: 300,             // nothing hostile this close to the leader, or he rests at the entrance
	restMaxMs: 180000,          // rested this long and the stage goes ahead anyway, said in orange
	/* a2's fight - v35, see the block comment. Every number here is
	   provisional and the operator's to move. */
	a2: {
		selfAt: 0.45,           // the member he is on, this low, disengages
		partyMeanAt: 0.65,      // the party's mean hp this low and EVERYONE disengages
		criticalAt: 0.30,       // this low and the scare goes at once, whatever the clock
		scareAfterTickMs: 5000, // scare only with at least this much of the 8s cycle left
		blinkBeforeTickMs: 1500,// blink only this close before the next tick
		/* Absorb (P3), v36: decided each time from hp. A member's loss rate is
		   its net hp lost per second over rateWindowMs, so curse, crits,
		   heals and other attackers are priced in by themselves. */
		absorbMinLeftMs: 2500,  // the soak case: absorb only with this much of the cycle left
		absorbGap: 0.15,        // "clearly healthier": the priest this much above the member
		lowestGap: 0.10,        // "clearly the lowest": every other member this much above it
		absorbMarginMs: 1500,   // survive until the tick, plus this
		rateWindowMs: 3000,
		rateMinMs: 1000,        // less history than this and the rate is unknown
		priestTakeFrac: 0.25,   // a floor: a2's attack x frequency, times this, is the least he is taken to deal the priest
		clearOf: 340,           // past the 300 anger radius, with a margin
		tickPadMs: 1500,        // the next tick is taken to have passed this long after it was due
		reengageMeanAt: 0.85,   // the whole party back to this, and no poison, before re-engaging
		reengageMaxMs: 20000,   // or this long after the disengage, whatever
		opener: 'MageofOz',     // she re-engages first; the others wait for him to take a target
		stationSlack: 20,       // stand this far inside one's own range
		stationMoveAt: 25,
		vbatAvoid: 250,
	},
	mluckMinMs: 10 * 60 * 1000, // less than this left counts as lacking it
	askMs: 60000,               // a merchant request is repeated this often
	mluckLongMs: 5 * 60 * 1000, // after this the wait is reported in red
	keyItem: 'cryptkey',
	keep: ['hpot0', 'mpot0', 'hpot1', 'mpot1', 'tracker', 'xptome', 'mmhat', 'luckbooster', 'goldbooster',
		'xpbooster', 'elixirluck', 'essenceoflife', 'pumpkinspice', 'cryptkey', 'jacko'],
	muleRange: 350,
	muleWaitMs: 60000,          // Dexon not in range this long and the loot is kept
	muleMinFree: 10,
	chestWaitMs: 20000,
	mateStaleMs: 10000,
	holdInstanceMaxMs: 300000,  // a respawn held this long goes ahead anyway
	/* How long crypt_auto outlives the last tick of a crypt run. Slot 11 is
	   also the daily CAVE slot, so a crypt run left on would otherwise boot
	   every later engage into crypt mode instead of the cave launcher. */
	autoKeepMs: 2 * 60 * 60 * 1000,
	sayMs: 30000,
	bridge: 'http://127.0.0.1:8787',
};
const CRUN_KEY = 'crypt_run';
const CRYPT_ID_KEY = 'crypt_instance';
const CRYPT_AUTO_KEY = 'crypt_auto';
let cryptAuto = false, cryptNavOn = true, cryptRelayId = null, crAutoAt = 0;
let crunRaw = null, crunMemo = null;
let crSaid = {}, crSeen = {}, crKite = null, crHolding = false, crHoldSince = 0;
let crSearch = { stage: -1, i: 0, spent: 0, lastAt: 0, done: {} }, crVbatEmptySince = 0, crWalkFlight = null, crEnterFlight = 0;
let crMuled = false, crMuleRun = undefined, crMuleSince = 0, crMuleAt = 0, crRoom = true, crPushAt = 0, crAskAt = {}, crMluckSince = 0;
/* v34: what this tab has seen, published in its beacon as `cs` so the leader
   can merge all three without anyone writing the shared run record for it. */
let crCs = { run: null, seen: {}, died: [], zav: [] }, crAvoid = {}, crOnMe = null, crWasRip = false;
let crHoldGapSince = 0, crHoldWaived = false;
let crRejoin = false;   // v35: a rested follower waiting to join a stationary leader out of combat
const CRYPT_A2_KEY = 'crypt_a2';
/* v36: when the leader's crypt run began, and the hand-back he wrote when the
   keys ran out - both shared by the three tabs through localStorage. */
const CRYPT_START_KEY = 'crypt_started';
const CRYPT_HANDBACK_KEY = 'crypt_handback';
let crHpHist = {}, crA2Last = null, crAbsorbAt = 0;
/* v37: Dexon's bat pull, the leader's pull-ready stamp, a2 with no way out. */
let crPull = null, crPullOkAt = 0, crBatRestSince = 0, crA2Stuck = 0;
const CRYPT_A8_KEY = 'crypt_a8';

/* The run record, shared by every tab: {id, at, leader, dead: {monster id:
   mtype}, cleared: {mtype: true}, done, doneAt, regroupAll, lost}. v34 adds
   givenUp {mtype: when} and zone {x, y}, both written by the leader alone. */
function crunRead() {
	let raw = null;
	try { raw = parent.localStorage.getItem(CRUN_KEY); } catch (e) { return null; }
	if (raw === crunRaw) return crunMemo;
	crunRaw = raw;
	try { const v = JSON.parse(raw); crunMemo = (v && typeof v.id === 'string') ? v : null; } catch (e) { crunMemo = null; }
	return crunMemo;
}
function crunWrite(r) {
	try {
		parent.localStorage.setItem(CRUN_KEY, JSON.stringify(r));
		if (r && r.id) parent.localStorage.setItem(CRYPT_ID_KEY, r.id);
	} catch (e) { bump('crunWriteFail'); }
}
function crunPatch(fn) {
	const r = crunRead();
	if (!r) return null;
	const c = JSON.parse(JSON.stringify(r));
	fn(c);
	crunWrite(c);
	return c;
}
/* A run this tab heard of only over cm, for a tab whose storage lost it. */
function crunEffective() {
	const r = crunRead();
	if (r) return r;
	return cryptRelayId ? { id: cryptRelayId, dead: {}, cleared: {}, done: false } : null;
}
function crSay(key, msg, color, everyMs) {
	const now = Date.now();
	if (crSaid[key] && now - crSaid[key] < (everyMs === undefined ? CRYPT_RUN.sayMs : everyMs)) return;
	crSaid[key] = now;
	clog('[crypt] ' + msg, color || '#FFD700');
	ev('crypt', { key: key, msg: msg });
}
function crPos(e) { return { x: e.real_x !== undefined ? e.real_x : e.x, y: e.real_y !== undefined ? e.real_y : e.y }; }
function crDist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y); }
function mluckLeft() {
	try { const m = character.s && character.s.mluck; return m ? (Number(m.ms) || 0) : 0; } catch (e) { return 0; }
}
function crInside(st, run) {
	return !!(st && st.map === 'crypt' && (!run || !st.inst || st.inst === run.id));
}
function crMate(bs, name, now) {
	const st = bs[name];
	return (st && now - st.t <= CRYPT_RUN.mateStaleMs) ? st : null;
}

/* ---- kills and stages ---- */
function crKills(run) {
	const k = {};
	const d = (run && run.dead) || {};
	for (const id in d) k[d[id]] = (k[d[id]] || 0) + 1;
	return k;
}
/* The first stage with anything left: {i, types}, or null once all are done. */
function cryptStage(run) {
	const k = crKills(run), cl = (run && run.cleared) || {}, gu = (run && run.givenUp) || {};
	for (let i = 0; i < CRYPT_RUN.stages.length; i++) {
		const left = CRYPT_RUN.stages[i].filter((t) => !cl[t] && !gu[t] && (k[t] || 0) < (CRYPT_RUN.need[t] || 1));
		if (left.length) return { i: i, types: left };
	}
	return null;
}
/* ---- the no-go zone ---- */
/* v37: the edge is fixed. A run record from v34-v36 can carry a grown `zone`;
   it is ignored, since the growth is what swallowed the bats. */
function crZone(run) { return CRYPT_RUN.zone; }
/* In the zone, or (v37) within zoneLocalR of a zone monster seen outside it -
   but never on the protected ground. */
function crInZone(p, run) {
	const z = crZone(run);
	if (p.x > z.x && p.y > z.y) return true;
	const loc = (run && run.zoneLocal) || [];
	if (!loc.length || crProtected(p)) return false;
	const now = Date.now();
	return loc.some((a) => now - a.t <= CRYPT_RUN.zoneLocalMs && Math.hypot(p.x - a.x, p.y - a.y) <= CRYPT_RUN.zoneLocalR);
}
/* ---- the bat box and the protected route - v37 ---- */
function crInBox(p, margin) {
	const b = CRYPT_RUN.vbatBox, m = margin || 0;
	return p.x >= b.x1 - m && p.x <= b.x2 + m && p.y >= b.y1 - m && p.y <= b.y2 + m;
}
/* Distance from p to a polyline of [x, y] points. */
function crPolyDist(p, poly) {
	let best = Infinity;
	for (let i = 1; i < poly.length; i++) {
		const ax = poly[i - 1][0], ay = poly[i - 1][1], bx = poly[i][0], by = poly[i][1];
		const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
		const u = L ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / L)) : 0;
		best = Math.min(best, Math.hypot(p.x - (ax + u * dx), p.y - (ay + u * dy)));
	}
	return best;
}
/* Never no-go: the box itself, and the ground within routeR of the route and
   of the pull-room branch. */
function crProtected(p) {
	const R = CRYPT_RUN.routeR;
	return crInBox(p, CRYPT_RUN.boxMargin) || crPolyDist(p, CRYPT_RUN.route) <= R || crPolyDist(p, CRYPT_RUN.routeBranch) <= R;
}
/* True when the straight leg a -> b crosses the box (plus margin). */
function crCrossesBox(a, b, margin) {
	const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
	for (let i = 0; i <= n; i++) if (crInBox({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n }, margin === undefined ? 10 : margin)) return true;
	return false;
}
/* The next point to walk to on the way from me to `to` along the route: the
   nearest route vertex first, then vertex by vertex toward the one nearest
   `to`, then `to` itself. Each leg is a straight level-0 leg. */
function crRouteNext(me, to) {
	const R = CRYPT_RUN.route;
	const near = (p) => { let bi = 0, bd = Infinity; R.forEach((v, i) => { const d = Math.hypot(v[0] - p.x, v[1] - p.y); if (d < bd) { bd = d; bi = i; } }); return bi; };
	const i0 = near(me), i1 = near(to);
	if (i0 === i1) return { x: to.x, y: to.y, end: true };
	const v0 = { x: R[i0][0], y: R[i0][1] };
	if (crDist(me, v0) > 40) return v0;
	const v = R[i0 + (i1 > i0 ? 1 : -1)];
	return { x: v[0], y: v[1] };
}
/* Along the route toward `to`, then onto it. */
function crRouteWalk(to, key) {
	const p = crRouteNext(crPos(character), to);
	crStepTo(p, key);
	return p;
}
/* One step toward `to` that keeps out of the box: straight when the leg is
   clear of it and walkable, else along the route. */
function crSafeStep(to, key) {
	const me = crPos(character);
	const p = crCrossesBox(me, to) ? crRouteNext(me, to) : to;
	crStepTo(p, key);
	return p;
}

/* What this tab sees, every tick. The id map feeds the death count; the rest
   is published in the beacon (`cs`) for the leader to merge - R5: the last
   place each plan monster was seen, the places this member died to one, and
   sightings of the zone's monsters. A member's own death is noted here too. */
function cryptSeeTick(now) {
	if (character.map !== 'crypt') { crWasRip = false; return; }
	if (now === undefined) now = Date.now();
	const run = crunRead();
	const id = character.in || null;
	if (crCs.run !== id) { crCs = { run: id, seen: {}, died: [], zav: [], str: [] }; crAvoid = {}; crOnMe = null; }
	if (!crCs.str) crCs.str = [];
	let onMe = null, onMeHit = -1;
	const z = crZone(run);
	for (const m of threats()) {
		if (!m.id || !m.mtype) continue;
		crSeen[m.id] = m.mtype;
		if (caveFriendly(m)) continue;
		const p = crPos(m);
		if (CRYPT_RUN.need[m.mtype]) {
			const o = crCs.seen[m.mtype];
			if (!o || now - o.t >= CRYPT_RUN.seenEveryMs) crCs.seen[m.mtype] = { x: Math.round(p.x), y: Math.round(p.y), t: now };
		} else if (CRYPT_RUN.zoneMonsters.indexOf(m.mtype) < 0) {
			/* v37: strays too, for the death-loop walk-back's clear route. */
			crCs.str = crCs.str.filter((x) => x.id !== m.id).concat([{ id: m.id, mtype: m.mtype, x: Math.round(p.x), y: Math.round(p.y), t: now }]).slice(-6);
		}
		/* v37: a death is put down to the strongest monster on me, not the last
			one listed - run 3 called two a8 deaths "died to vbat". */
		if (m.target === character.name) {
			const hit = crMonsterDps(m.mtype);
			if (hit > onMeHit) { onMeHit = hit; onMe = m.mtype; }
		}
		crAvoid[m.id] = { x: p.x, y: p.y, t: now, mtype: m.mtype };
		if (CRYPT_RUN.zoneMonsters.indexOf(m.mtype) >= 0 && !(p.x > z.x && p.y > z.y)) {
			crCs.zav = crCs.zav.filter((x) => x.id !== m.id).concat([{ id: m.id, mtype: m.mtype, x: Math.round(p.x), y: Math.round(p.y), t: now }]).slice(-6);
		}
	}
	if (onMe) crOnMe = { mtype: onMe, t: now };
	for (const k in crAvoid) if (now - crAvoid[k].t > CRYPT_RUN.avoidMs) delete crAvoid[k];
	crHpTrack(now);
	crA2Watch(now);
	if (character.rip && !crWasRip) {
		const by = crOnMe && now - crOnMe.t < 5000 ? crOnMe.mtype : null;
		const dd = { x: Math.round(character.real_x), y: Math.round(character.real_y), t: now, by: by };
		crCs.died = crCs.died.concat([dd]).slice(-5);
		/* v36: every death, for the CRYPT DUMP - each tab writes its own. */
		crunPatch((c) => { if (c.id === id) c.deaths = (c.deaths || []).concat([Object.assign({ who: character.name }, dd)]).slice(-60); });
		if (by) crSay('diedTo-' + now, 'died to ' + by + ' - the search starts here', 'orange', 0);
	}
	crWasRip = !!character.rip;
}
/* What a monster deals per second, raw: G's attack x frequency, 0 unknown. */
function crMonsterDps(mtype) {
	try { const g = parent.G.monsters[mtype]; return g && g.attack ? g.attack * (g.frequency || 1) : 0; } catch (e) { return 0; }
}
/* Every member's sightings of this run, merged: the newest per type, every
   death point, every zone sighting, every stray (v37). bs is beacons() with
   this tab's own. */
function crSightings(bs, run) {
	const out = { seen: {}, died: [], zav: [], str: [] };
	for (const n in bs) {
		const cs = bs[n] && bs[n].cs;
		if (!cs || !run || cs.run !== run.id) continue;
		for (const t in cs.seen || {}) { const s = cs.seen[t]; if (!out.seen[t] || s.t > out.seen[t].t) out.seen[t] = s; }
		for (const d of cs.died || []) out.died.push(Object.assign({ who: n }, d));
		for (const z of cs.zav || []) out.zav.push(z);
		for (const z of cs.str || []) out.str.push(z);
	}
	return out;
}
/* Every tab that saw it records it, keyed by the monster's id, so three
   reports of one death count once. */
function cryptOnDeath(d) {
	if (!cryptAuto || !d || character.map !== 'crypt') return;
	const mt = crSeen[d.id];
	if (!mt || !CRYPT_RUN.need[mt]) return;
	let first = false;
	const r = crunPatch((c) => {
		if (c.id !== character.in) return;
		c.dead = c.dead || {};
		if (!c.dead[d.id]) { c.dead[d.id] = mt; first = true; }
	});
	if (first && mt === 'a2') crA2Clear();
	if (r && first) {
		const k = crKills(r);
		crSay('kill-' + d.id, mt + ' down (' + k[mt] + '/' + CRYPT_RUN.need[mt] + ')', '#7FD98A', 0);
	}
}

/* ---- who may be hit, inside a crypt run ---- */
/* The current stage is hunted. A plan monster out of turn is answered once it
   is on the party. A stray is hit only by the member it is on - the kiter. */
function cryptMayAttack(t, run) {
	if (t.mtype === 'a2' && crA2HoldFire(Date.now())) return false;
	/* v37, ruling 4: one bat at a time - only one already on the party, or the
	   one Dexon is pulling. Everyone else's shot at the box would pull more. */
	if (t.mtype === 'vbat') return crOnParty(t) || !!(crPull && crPull.id === t.id);
	const st = run ? cryptStage(run) : null;
	if (st && st.types.indexOf(t.mtype) >= 0) return true;
	if (CRYPT_RUN.need[t.mtype]) return attackingUs(t);
	return t.target === character.name;
}
function cryptRunHere() { return cryptAuto && mode === 'crypt' && character.map === 'crypt'; }

/* ---- a2 - v35, see the block comment and CRYPT_RUN.a2 ---- */
function crA2() {
	for (const m of threats()) if (m.mtype === 'a2' && !caveFriendly(m)) return m;
	return null;
}
/* Milliseconds to his next anger tick, or null when the client has no clock. */
function crAngerMs(m) {
	try { const a = m && m.s && m.s.anger; return a && typeof a.ms === 'number' ? a.ms : null; } catch (e) { return null; }
}
function crHpFrac(e) { return e && e.max_hp ? e.hp / e.max_hp : 1; }
function crPartyMean() {
	const a = allies();
	return a.length ? a.reduce((s, e) => s + crHpFrac(e), 0) / a.length : 1;
}
function crPoisoned() { return allies().some((e) => !!(e.s && e.s.poisoned)); }
/* The member he is on wants out: it is low, or the party is. */
function crA2Low() {
	return crHpFrac(character) < CRYPT_RUN.a2.selfAt || crPartyMean() < CRYPT_RUN.a2.partyMeanAt;
}
/* The shared disengage, {mode: 'all'|'one', who, at, tickAt, reopen}, in
   localStorage so all three tabs read one record. 'one' covers its `who`
   until the tick after the scare has passed; 'all' covers everyone until the
   party is healed, then `reopen` lets the opener back in first. */
function crA2Read() {
	try {
		const v = JSON.parse(parent.localStorage.getItem(CRYPT_A2_KEY));
		return v && v.mode && v.run === (character.in || null) ? v : null;
	} catch (e) { return null; }
}
function crA2Write(s) { try { parent.localStorage.setItem(CRYPT_A2_KEY, JSON.stringify(s)); } catch (e) {} }
function crA2Clear(why) {
	try { if (parent.localStorage.getItem(CRYPT_A2_KEY) === null) return; parent.localStorage.removeItem(CRYPT_A2_KEY); } catch (e) { return; }
	if (why) crSay('a2end-' + Date.now(), why, '#7FD98A', 0);
}
/* The state as it applies now, advancing it: null, or {away, holdFire}. */
function crA2State(now) {
	const s = crA2Read();
	if (!s) return null;
	const a = CRYPT_RUN.a2, past = now >= (s.tickAt || 0) + a.tickPadMs;
	if (s.mode === 'one') {
		if (past) { crA2Clear(s.who + ' is clear of a2 - back in'); return null; }
		return s.who === character.name ? { away: true, holdFire: true } : null;
	}
	if (!s.reopen) {
		const healed = crPartyMean() >= a.reengageMeanAt && !crPoisoned();
		if (past && (healed || now - s.at >= a.reengageMaxMs)) {
			s.reopen = true; s.reopenAt = now; crA2Write(s);
			crSay('a2reopen-' + s.at, 'healed - re-engaging a2, ' + a.opener + ' opens', '#7FD1FF', 0);
		} else return { away: true, holdFire: true };
	}
	const m = crA2();
	if (m && m.target) { crA2Clear('a2 has a target again - everyone back in'); return null; }
	/* The opener dead or away must not keep the other two holding fire. */
	if (now - (s.reopenAt || s.at) > a.reengageMaxMs) { crA2Clear('nobody opened on a2 - everyone back in'); return null; }
	return { away: false, holdFire: character.name !== a.opener };
}
function crA2HoldFire(now) { const s = crA2State(now); return !!(s && s.holdFire); }
function crA2Away(now) { const s = crA2State(now); return !!(s && s.away); }
/* Scare (P1): he is on me, I am low or the party is, and the clock has just
   reset - or I am about to die: critically low, or (v36) not lasting until
   his next tick at the rate I am losing hp. */
function cryptScareWanted(m) {
	if (!m || m.mtype !== 'a2' || m.target !== character.name) return false;
	const ms = crAngerMs(m);
	if (crDoomed(character, ms, Date.now())) return true;
	if (!crA2Low()) return false;
	return ms === null || ms >= CRYPT_RUN.a2.scareAfterTickMs || crHpFrac(character) < CRYPT_RUN.a2.criticalAt;
}
/* Who disengages: everyone when the party is low, else the member alone. */
function crA2Disengage(m, how, now) {
	const all = crPartyMean() < CRYPT_RUN.a2.partyMeanAt;
	const ms = crAngerMs(m);
	crA2Write({ run: character.in || null, mode: all ? 'all' : 'one', who: character.name, at: now, tickAt: now + (ms === null ? 8000 : ms), reopen: false, how: how });
	crSay('a2off-' + now, how + ' - ' + (all ? 'the party is low, everyone' : character.name + ' alone') + ' clears 300 of a2 before his next tick', 'orange', 0);
}
/* Blink (P5): the same, without the scare, just before a tick - or at once
   when I will not last until it. */
function cryptBlinkWanted(m) {
	if (!m || m.mtype !== 'a2' || m.target !== character.name) return false;
	const ms = crAngerMs(m);
	if (crDoomed(character, ms, Date.now())) return true;
	return crA2Low() && ms !== null && ms <= CRYPT_RUN.a2.blinkBeforeTickMs;
}
/* ---- hp-loss rates - v36 ---- */
/* Every tick inside, each member in view: its hp, kept for rateWindowMs. */
function crHpTrack(now) {
	const keep = CRYPT_RUN.a2.rateWindowMs + 1000;
	for (const e of allies()) {
		const n = e === character ? character.name : e.name;
		if (!n || typeof e.hp !== 'number') continue;
		const h = (crHpHist[n] || []).filter((x) => now - x.t <= keep);
		h.push({ t: now, hp: e.hp });
		crHpHist[n] = h;
	}
}
/* Net hp lost per second over the window, or null with too little history.
   Never below zero: a member being healed faster than hit is not losing hp. */
function crLossRate(name, now) {
	const a = CRYPT_RUN.a2, h = crHpHist[name] || [];
	const old = h.find((x) => now - x.t <= a.rateWindowMs), cur = h[h.length - 1];
	if (!old || !cur || cur.t - old.t < a.rateMinMs) return null;
	return Math.max(0, (old.hp - cur.hp) / ((cur.t - old.t) / 1000));
}
/* Milliseconds e lasts at this rate (hp per second): Infinity at none. */
function crLastsMs(hp, rate) { return rate > 0 ? (hp / rate) * 1000 : Infinity; }
/* Until his next tick, plus the margin; 8s when the client has no clock. */
function crWindowMs(ms) { return (ms === null || ms === undefined ? 8000 : ms) + CRYPT_RUN.a2.absorbMarginMs; }
function crDoomed(e, ms, now) {
	const r = crLossRate(e === character ? character.name : e.name, now);
	return r !== null && crLastsMs(e.hp, r) < crWindowMs(ms);
}
/* What a2 deals per second at the least: G's attack x frequency, cursed or not. */
function crA2Nominal(m) {
	let g = null;
	try { g = parent.G.monsters.a2; } catch (e) {}
	const dps = g && g.attack && g.frequency ? g.attack * g.frequency : 2240 * 1.4;
	return dps * (m && m.s && m.s.cursed ? 0.8 : 1);
}
/* Absorb (P3) - v36, the operator's answer of 2026-11-08 19:37-19:39: decided
   each time from hp, on neither fixed rule. {e, kind, why} or null.
     emergency - the member he is on will not last until his next tick (plus a
       margin) and the priest will. The tick clock does not matter.
     soak - that member is clearly the party's lowest, the priest is clearly
       healthier, and at least absorbMinLeftMs of the window is left.
   Never when the priest would not last the window himself: the member's own
   scare or blink is the fallback. Never while a2 is on the scare holder and her
   beacon says she can escape - that takes him off everyone. The priest's own
   heals count for nothing here, since poison cuts them to a quarter. */
function cryptAbsorbPick(now) {
	const m = crA2();
	if (!m || !m.target || m.target === character.name || partyNames().indexOf(m.target) < 0) return null;
	const e = (parent.entities || {})[m.target];
	if (!here(e) || !e.max_hp || !inRangeFor(e, 'absorb')) return null;
	const a = CRYPT_RUN.a2, ms = crAngerMs(m), win = crWindowMs(ms);
	const vr = crLossRate(m.target, now);
	const vLasts = vr === null ? Infinity : crLastsMs(e.hp, vr);
	const pRate = Math.max(vr || 0, crA2Nominal(m) * a.priestTakeFrac);
	const pLasts = crLastsMs(character.hp, pRate);
	const tag = m.target + ' lasts ' + (vLasts === Infinity ? 'indefinitely' : (vLasts / 1000).toFixed(1) + 's') + ', the tick is '
		+ (ms === null ? 'unknown' : (ms / 1000).toFixed(1) + 's') + ' off, I last ' + (pLasts / 1000).toFixed(1) + 's';
	const bs = beacons(), vb = bs[m.target];
	if (vb && vb.esc && now - vb.t <= CRYPT_RUN.mateStaleMs) return { e: null, kind: 'defer', why: m.target + ' can escape him herself - ' + tag };
	if (pLasts < win) return { e: null, kind: 'refuse', why: 'I would not last the window - ' + tag };
	if (vLasts < win) return { e: e, kind: 'emergency', why: tag };
	if (ms !== null && ms < a.absorbMinLeftMs) return null;
	const f = crHpFrac(e);
	const lowest = allies().every((o) => o === e || (o.name && o.name === e.name) || crHpFrac(o) >= f + a.lowestGap);
	if (!lowest || crHpFrac(character) - f < a.absorbGap) return null;
	return { e: e, kind: 'soak', why: tag };
}
/* The pick, cast: said with its numbers, and stamped for the switch log. */
async function cryptAbsorb(pick, now) {
	if (!pick || !pick.e) return false;
	try {
		await telUse('absorb', pick.e);
		bump('absorbs'); bump('absorb_' + pick.kind);
		crAbsorbAt = Date.now();
		crSay('absorb-' + now, 'absorbed a2 off ' + (pick.e.name || pick.e.id) + ' (' + pick.kind + '): ' + pick.why, '#7FD1FF', 0);
		return true;
	} catch (e) { return false; }
}
/* ---- a2's target switches - v36, the operator's ruling of 2026-11-08 19:30 ----
   Each switch onto a member is logged by that member's tab, which sees him
   for certain, so every switch is logged once: who from, who to, anger.ms,
   and each member's distance to him. A drop to no target is logged by the
   leader. The last 60 go in the run record, for the CRYPT DUMP. */
function crA2Watch(now) {
	const m = crA2();
	if (!m) return;
	const to = m.target || null, ms = crAngerMs(m);
	const first = !crA2Last || crA2Last.id !== m.id;
	const from = first ? null : crA2Last.target;
	crA2Last = { id: m.id, target: to, ms: ms, t: now };
	if (!first && to === from) return;
	if (first && to !== character.name) return;
	if (to ? to !== character.name : !isLeader()) return;
	const a = crPos(m), bs = beacons(), d = {};
	for (const n of TEAM) {
		const e = n === character.name ? character : (parent.entities || {})[n];
		const st = bs[n];
		const p = here(e) ? crPos(e) : (st && st.map === 'crypt' && now - st.t <= CRYPT_RUN.mateStaleMs ? st : null);
		d[n] = p ? Math.round(crDist(p, a)) : null;
	}
	const why = to === character.name && now - crAbsorbAt <= 1500 ? 'absorb' : null;
	const row = { t: now, from: from, to: to, ms: ms, d: d, why: why, hp: Math.round(crHpFrac(character) * 100) / 100 };
	crSay('a2sw-' + now, 'a2 ' + (from || '-') + ' -> ' + (to || 'no target') + (why ? ' (absorb)' : '') + ', anger.ms '
		+ (ms === null ? '?' : ms) + ' | ' + TEAM.map((n) => n + ' ' + (d[n] === null ? '?' : d[n])).join(', '), '#8b98ab', 0);
	ev('a2switch', row);
	crunPatch((c) => { if (c.id === character.in) c.a2log = (c.a2log || []).concat([row]).slice(-60); });
}
function crNearVbat(p, run) {
	if (crInBox(p, CRYPT_RUN.boxMargin)) return true;
	const k = crKills(run || {}), cl = (run && run.cleared) || {};
	if (cl.vbat || (k.vbat || 0) >= (CRYPT_RUN.need.vbat || 7)) return false;
	return CRYPT_RUN.homes.vbat.some((h) => Math.hypot(p.x - h[0], p.y - h[1]) <= CRYPT_RUN.a2.vbatAvoid);
}
function crPriestPos() {
	for (const n of partyNames()) {
		const e = n === character.name ? character : (parent.entities || {})[n];
		if (here(e) && e.ctype === 'priest') return crPos(e);
	}
	return null;
}
/* Positioning (P4): my own range from him, on the priest's side; rotated off a
   wall, the zone or the vbat box; null when nothing fits. */
function crA2Station(m, run) {
	const a = crPos(m), me = crPos(character);
	const anchor = character.ctype === 'priest' ? me : (crPriestPos() || me);
	let ux = anchor.x - a.x, uy = anchor.y - a.y, n = Math.hypot(ux, uy);
	if (n < 1) { ux = me.x - a.x; uy = me.y - a.y; n = Math.hypot(ux, uy); }
	if (n < 1) { ux = 1; uy = 0; n = 1; }
	ux /= n; uy /= n;
	const r = Math.max(40, (character.range || 100) - CRYPT_RUN.a2.stationSlack);
	for (const da of [0, 0.5, -0.5, 1.0, -1.0]) {
		const c = Math.cos(da), s = Math.sin(da);
		const p = { x: a.x + (ux * c - uy * s) * r, y: a.y + (ux * s + uy * c) * r };
		if (crInZone(p, run) || crNearVbat(p, run)) continue;
		try { if (isFn(can_move_to) && !can_move_to(p.x, p.y)) continue; } catch (e) { continue; }
		return p;
	}
	return null;
}
/* Somewhere past clearOf from him that is not back toward him: a straight
   step on a ring around me first, then the nearest tour point. */
function crA2AwayPoint(m, run) {
	const a = crPos(m), me = crPos(character), clear = CRYPT_RUN.a2.clearOf;
	const away = (p) => (p.x - me.x) * (me.x - a.x) + (p.y - me.y) * (me.y - a.y) >= 0;
	const ok = (p) => Math.hypot(p.x - a.x, p.y - a.y) >= clear && !crInZone(p, run) && !crNearVbat(p, run);
	let best = null, bd = Infinity;
	for (let i = 0; i < 16; i++) {
		const t = (Math.PI * 2 * i) / 16, p = { x: me.x + Math.cos(t) * 380, y: me.y + Math.sin(t) * 380 };
		if (!ok(p) || !away(p)) continue;
		try { if (isFn(can_move_to) && !can_move_to(p.x, p.y)) continue; } catch (e) { continue; }
		const d = -Math.hypot(p.x - a.x, p.y - a.y);
		if (d < bd) { bd = d; best = p; }
	}
	if (best) return { x: best.x, y: best.y, straight: true };
	for (const t of CRYPT_RUN.tour) {
		const p = { x: t[0], y: t[1] };
		if (!ok(p) || !away(p)) continue;
		const d = Math.hypot(p.x - me.x, p.y - me.y);
		if (d < bd) { bd = d; best = p; }
	}
	return best ? { x: best.x, y: best.y, straight: false } : null;
}
/* No way past clearOf: the straight ring point farthest from him, if it is
   farther than here. */
function crA2FarPoint(m, run) {
	const a = crPos(m), me = crPos(character);
	let best = null, bd = crDist(me, a) + 20;
	for (let i = 0; i < 16; i++) {
		const t = (Math.PI * 2 * i) / 16, p = { x: me.x + Math.cos(t) * 200, y: me.y + Math.sin(t) * 200 };
		if (crInZone(p, run) || crInBox(p, 10)) continue;
		try { if (isFn(can_move_to) && !can_move_to(p.x, p.y)) continue; } catch (e) { continue; }
		const d = crDist(p, a);
		if (d > bd) { bd = d; best = p; }
	}
	return best;
}
/* A blink lands anywhere walkable, so it can go past him: the nearest tour or
   route point at least clearOf from him, out of the zone and the box. */
function crA2BlinkPoint(m, run) {
	const a = crPos(m), me = crPos(character);
	let best = null, bd = Infinity;
	for (const t of CRYPT_RUN.tour.concat(CRYPT_RUN.route)) {
		const p = { x: t[0], y: t[1] };
		if (crDist(p, a) < CRYPT_RUN.a2.clearOf || crInZone(p, run) || crInBox(p, 10)) continue;
		const d = crDist(p, me);
		if (d < bd) { bd = d; best = p; }
	}
	return best;
}
/* One move toward p: a straight move where nothing is in the way, else a
   walk (the leader's through the autopilot, so its own pause rules hold). */
function crStepTo(p, key) {
	let straight = false;
	try { straight = !isFn(can_move_to) || can_move_to(p.x, p.y); } catch (e) {}
	if (straight) {
		if (isLeader()) crHalt(key);
		try { move(p.x, p.y); bump('a2Steps'); } catch (e) {}
		return;
	}
	if (isLeader()) crGo(p, key); else crWalk({ map: character.map, x: p.x, y: p.y }, key);
}
function crA2Move(m, run, now) {
	if (crA2Away(now)) {
		if (crDist(crPos(character), crPos(m)) >= CRYPT_RUN.a2.clearOf) { if (isLeader()) crHalt('a2-clear'); return true; }
		const p = crA2AwayPoint(m, run);
		if (p) crStepTo(p, 'a2-away');
		else {
			/* v37: no way past 300 - the mage re-scares or blinks (mageSkills),
			   and everyone steps to the straight point farthest from him. */
			crA2Stuck = now;
			const q = crA2FarPoint(m, run);
			if (q) crStepTo(q, 'a2-far');
			crSay('a2noAway', 'no way past 300 from a2 from here - ' + (character.ctype === 'mage' ? 'scaring or blinking' : 'getting as far as I can'), 'orange');
		}
		return true;
	}
	if (!crOnParty(m)) return false;
	const p = crA2Station(m, run);
	if (!p) return false;
	if (crDist(crPos(character), p) > CRYPT_RUN.a2.stationMoveAt) crStepTo(p, 'a2-station');
	else if (isLeader()) crHalt('a2-station');
	return true;
}

/* ---- a8 - v37, ruling 3 ---- */
function crA8() {
	for (const m of threats()) if (m.mtype === 'a8' && !caveFriendly(m)) return m;
	return null;
}
/* Where a8 was last seen near the bats - in view, or by any member - or null. */
function crA8Near(run, bs, now) {
	const near = (p) => crDist(p, CRYPT_RUN.vbatSpot) <= CRYPT_RUN.a8Near || crInBox(p, CRYPT_RUN.a8Near - 100);
	const m = crA8();
	if (m && near(crPos(m))) return crPos(m);
	const s = crSightings(bs, run);
	let best = null;
	for (const a of s.zav) if (a.mtype === 'a8' && now - a.t <= CRYPT_RUN.a8RecentMs && near(a) && (!best || a.t > best.t)) best = a;
	return best;
}
/* a8 on a party member - not the mage with her scare ready, who scares it
   herself. Stamped in crypt_a8 for the tabs that cannot see it; the party
   backs off while the stamp is fresh. */
function crA8Chase(now) {
	const m = crA8();
	if (m && m.target && partyNames().indexOf(m.target) >= 0) {
		const bs = beacons(), b = bs[m.target];
		const scares = m.target === character.name ? (character.ctype === 'mage' && haveSkill('scare')) : !!(b && b.esc && b.jacko);
		if (!scares) { try { parent.localStorage.setItem(CRYPT_A8_KEY, JSON.stringify({ run: character.in || null, at: now, who: m.target, x: Math.round(crPos(m).x), y: Math.round(crPos(m).y) })); } catch (e) {} }
	}
	let r = null;
	try { r = JSON.parse(parent.localStorage.getItem(CRYPT_A8_KEY)); } catch (e) {}
	return r && r.run === (character.in || null) && now - r.at <= CRYPT_RUN.a8ChaseMs ? r : null;
}
/* Backing off west: back along the route, vertex by vertex, until past
   a8Clear from it. */
function crA8Retreat(a8p) {
	const me = crPos(character), R = CRYPT_RUN.route;
	if (a8p && crDist(me, a8p) >= CRYPT_RUN.a8Clear) return false;
	let bi = 0, bd = Infinity;
	R.forEach((v, i) => { const d = Math.hypot(v[0] - me.x, v[1] - me.y); if (d < bd) { bd = d; bi = i; } });
	let j = bi;
	while (j > 0 && (Math.hypot(R[j][0] - me.x, R[j][1] - me.y) < 40 || (a8p && Math.hypot(R[j][0] - a8p.x, R[j][1] - a8p.y) < CRYPT_RUN.a8Clear))) j--;
	crStepTo({ x: R[j][0], y: R[j][1] }, 'a8-back');
	return true;
}
/* ---- the route back - v37, ruling 7 ---- */
/* Why a member could not walk the route back alone, or null: a plan monster
   that could be on it is alive and not given up, or a stray or zone monster
   has been seen near it recently. The bats are in the box, off the route. */
function cryptRouteBlocked(run, bs, now) {
	const k = crKills(run), gu = run.givenUp || {}, cl = run.cleared || {};
	for (const t of ['a2', 'a3', 'a7']) if (!gu[t] && !cl[t] && (k[t] || 0) < (CRYPT_RUN.need[t] || 1)) return t + ' is alive';
	const s = crSightings(bs, run), R = CRYPT_RUN.route;
	for (const a of s.zav.concat(s.str)) {
		if (now - a.t > CRYPT_RUN.avoidMs) continue;
		if (crPolyDist(a, R) <= CRYPT_RUN.routeR + CRYPT_RUN.avoidR) return a.mtype + ' was seen by it';
	}
	return null;
}
/* ---- the bats - v37, ruling 4 ---- */
/* A point within my range of the bat, outside the box, reachable in a straight
   line that keeps out of the box, clear of a8 - the nearest to the spot. */
function crPullStand(b, a8p) {
	const pb = crPos(b), me = crPos(character), spot = CRYPT_RUN.vbatSpot;
	const r = Math.max(60, (character.range || 150) - CRYPT_RUN.pullSlack);
	let best = null, bd = Infinity;
	for (let i = 0; i < 24; i++) {
		const t = (Math.PI * 2 * i) / 24, p = { x: pb.x + Math.cos(t) * r, y: pb.y + Math.sin(t) * r };
		if (crInBox(p, 15) || crCrossesBox(me, p, 5)) continue;
		if (a8p && crDist(p, a8p) < CRYPT_RUN.pullA8Avoid) continue;
		try { if (isFn(can_move_to) && !can_move_to(p.x, p.y)) continue; } catch (e) { continue; }
		const d = crDist(p, spot);
		if (d < bd) { bd = d; best = p; }
	}
	return best;
}
function crBatOnParty() { return threats().some((m) => m.mtype === 'vbat' && crOnParty(m) && !caveFriendly(m)); }
/* Dexon's half: once the leader has stamped the pull ready, one bat at a time -
   to a stand point, one shot, straight back to the spot. True while it owns
   his move. */
function cryptPullTick(run, now) {
	if (character.name !== CRYPT_RUN.puller) return false;
	const st = cryptStage(run), spot = CRYPT_RUN.vbatSpot;
	if (!st || st.types.indexOf('vbat') < 0) { crPull = null; return false; }
	if (crPull) {
		const b = (parent.entities || {})[crPull.id];
		if (crPull.phase === 'out') {
			if (!b || b.dead || crOnParty(b) || now - crPull.at > CRYPT_RUN.pullMaxMs) {
				crPull.phase = 'back';
				if (b && crOnParty(b)) crSay('pulled-' + crPull.id, 'a bat is on us - back to the spot', '#7FD1FF', 0);
			} else {
				if (dist(character, b) <= (character.range || 150) - 5) {
					try { if (!isFn(can_attack) || can_attack(b)) { const pr = attack(b); if (pr && typeof pr.catch === 'function') pr.catch(() => {}); bump('batPullShots'); } } catch (e) {}
				} else crStepTo(crPull.stand, 'pull-out');
				return true;
			}
		}
		if (crDist(crPos(character), spot) <= NAV.arriveAt) { crPull = null; return false; }
		crSafeStep(spot, 'pull-back');
		return true;
	}
	if (!(run.pullOk && now - run.pullOk <= 3000) || crDist(crPos(character), spot) > 80 || crBatOnParty()) return false;
	const a8 = crA8(), a8p = a8 ? crPos(a8) : null;
	const bats = threats().filter((m) => m.mtype === 'vbat' && !caveFriendly(m) && !m.target).sort((x, y) => dist(character, x) - dist(character, y));
	for (const b of bats) {
		const stand = crPullStand(b, a8p);
		if (!stand) continue;
		crPull = { id: b.id, at: now, phase: 'out', stand: stand };
		bump('batPulls');
		crSay('pull-' + b.id, 'pulling a bat from ' + Math.round(stand.x) + ',' + Math.round(stand.y), '#7FD1FF', 0);
		crStepTo(stand, 'pull-out');
		return true;
	}
	return false;
}
/* The leader's half of the bat stage: at the spot, rested, no bat on us and
   no a8 near - stamp the pull ready; a8 near - wait north of its aura, for at
   most a8WaitMs, then give the bats up; clear when none is seen for
   vbatClearMs after a kill. */
function cryptBatStage(run, st, bs, now) {
	const spot = CRYPT_RUN.vbatSpot, a8p = crA8Near(run, bs, now);
	if (a8p) {
		if (!run.a8Since) crunPatch((c) => { if (!c.a8Since) c.a8Since = now; });
		const since = run.a8Since || now;
		if (now - since > CRYPT_RUN.a8WaitMs) {
			crunPatch((c) => { c.givenUp = c.givenUp || {}; c.givenWhy = c.givenWhy || {}; c.givenUp.vbat = now;
				c.givenWhy.vbat = 'a8 stayed by the bats ' + Math.round(CRYPT_RUN.a8WaitMs / 60000) + ' min'; });
			crSay('a8gaveUp', 'a8 stayed by the bats ' + Math.round(CRYPT_RUN.a8WaitMs / 60000) + ' min - the bats are given up', 'red', 0);
			return;
		}
		crSay('a8wait', 'a8 near the bats - waiting north of it, out of its 300', 'orange', 20000);
		if (!crA8Retreat(a8p)) crHalt('a8-wait');
		return;
	}
	if (run.a8Since) { crunPatch((c) => { delete c.a8Since; }); crSay('a8gone', 'a8 is gone - back to the bats', '#7FD98A', 0); }
	if (crDist(crPos(character), spot) > NAV.arriveAt) { crVbatEmptySince = 0; crGo(spot, 'vbat'); return; }
	crHalt('vbat');
	const anyBat = threats().some((m) => m.mtype === 'vbat' && !caveFriendly(m));
	if (anyBat) crVbatEmptySince = 0;
	else {
		if (!crVbatEmptySince) crVbatEmptySince = now;
		if (now - crVbatEmptySince >= CRYPT_RUN.vbatClearMs && (crKills(run).vbat || 0) >= 1) {
			crunPatch((c) => { c.cleared = c.cleared || {}; c.cleared.vbat = true; });
			crSay('vbatClear', 'no vbat in view for ' + Math.round(CRYPT_RUN.vbatClearMs / 1000) + 's from the spot - counting it clear at ' + (crKills(run).vbat || 0) + '/7', '#FFD700', 0);
			return;
		}
	}
	if (crBatOnParty() || partyFighting()) { crBatRestSince = 0; return; }
	/* Between bats the party is back to near full; capped like the stage rest. */
	const short = cryptRestShort(null, bs, now);
	if (short.length) {
		if (!crBatRestSince) crBatRestSince = now;
		if (now - crBatRestSince < CRYPT_RUN.restMaxMs) { crSay('batRest', 'resting before the next bat - ' + short.join(', '), '#8b98ab', 30000); return; }
	} else crBatRestSince = 0;
	if (now - crPullOkAt >= 1000) { crPullOkAt = now; crunPatch((c) => { c.pullOk = now; }); }
}
/* ---- the respawn rule ---- */
function cryptMayRespawn(now) {
	if (!cryptAuto || character.map !== 'crypt') { crHoldSince = 0; return true; }
	const run = crunRead();
	if (!run || run.done) return true;
	if (!crHoldSince) crHoldSince = now;
	if (now - crHoldSince > CRYPT_RUN.holdInstanceMaxMs) {
		crSay('holdMax', 'held my respawn ' + Math.round(CRYPT_RUN.holdInstanceMaxMs / 60000) + ' min - respawning anyway', 'red', 60000);
		return true;
	}
	const bs = beacons();
	const mates = TEAM.filter((n) => n !== character.name).map((n) => crMate(bs, n, now));
	const inside = mates.filter((st) => crInside(st, run));
	if (inside.length === TEAM.length - 1 && inside.every((st) => st.rip) && !run.regroupAll) {
		crunPatch((c) => { c.regroupAll = true; });
		run.regroupAll = true;
		crSay('wipe', 'all three down - followers respawn first, ' + leaderName() + ' last, then regroup at the entrance', 'red', 0);
	}
	if (!inside.length) {
		crSay('holdInst', 'dead, and nobody else is inside - holding the instance', 'orange');
		return false;
	}
	if (isLeader() && run.regroupAll) {
		const back = followers().every((n) => { const st = crMate(bs, n, now); return crInside(st, run) && !st.rip; });
		if (!back) { crSay('leaderLast', 'leader respawns last - waiting for both followers to be back inside', 'orange'); return false; }
	}
	return true;
}

/* ---- moving: shared helpers ---- */
/* smart_move without awaiting it, so the tick keeps fighting and checking
   deaths while the walk runs. One walk per key; a failed one retries in 10s.
   v34: a walk still moving is never re-sent, and one this function replaced
   rejects as `interrupted` - that is our own doing and is not reported. The
   first live run logged "path to door failed: interrupted" every 30s. */
function crWalk(p, key) {
	const now = Date.now();
	if (crWalkFlight && crWalkFlight.key === key && (now - crWalkFlight.at < 30000 || character.moving)) return;
	if (crWalkFlight) crWalkFlight.replaced = true;
	const f = { key: key, at: now, replaced: false };
	crWalkFlight = f;
	try {
		const pr = smart_move({ map: p.map || character.map, x: p.x, y: p.y });
		if (pr && typeof pr.then === 'function') pr.then(() => { if (crWalkFlight === f) crWalkFlight = null; }, (e) => {
			if (f.replaced) return;
			if (crWalkFlight === f) crWalkFlight = { key: key, at: Date.now() - 20000 };
			crSay('walk-' + key, 'path to ' + key + ' failed: ' + String((e && (e.reason || e.message)) || e), 'orange', 15000);
		});
		else crWalkFlight = null;
	} catch (e) { crWalkFlight = null; }
}
/* Inside the crypt: the cave autopilot's own navGo, so its interrupt
   detection - a move the script did not make pauses it - covers this too. */
function crGo(p, id) {
	const now = Date.now();
	if (navFlight && Math.hypot(navFlight.x - p.x, navFlight.y - p.y) <= 60 && now - navFlight.at < NAV.smartMaxMs) return;
	navGo({ x: p.x, y: p.y, id: id || null });
}
function crHalt(why) { if (navFlight) navHalt(why); }

/* ---- strays ---- */
function crStraysOnMe() {
	return threats().filter((m) => m.target === character.name && !CRYPT_RUN.need[m.mtype] && !caveFriendly(m)
		&& CRYPT_RUN.noKite.indexOf(m.mtype) < 0);
}
/* Whichever crossing is nearer by path. Measured over every walkable cell
   left of the zone on the level-0 grid: this rule picks the nearer one for
   7,509 of 7,551 - the middle one from a7's east end, a2's room and the vbat
   box, the top one from everywhere else. */
function cryptKitePoint(x, y) { return (x >= 600 && y > -1300) ? CRYPT_RUN.kiteMid : CRYPT_RUN.kiteTop; }
async function cryptKiteTick(now) {
	if (character.map !== 'crypt' || character.rip) { crKite = null; return false; }
	if (!crKite) {
		const s = crStraysOnMe()[0];
		if (!s) return false;
		crKite = { id: s.id, mtype: s.mtype, at: now, lastOn: now, phase: 'out', to: cryptKitePoint(character.real_x, character.real_y), townAt: 0 };
		recovering = false; aim = null;
		crSay('kite', 'a stray ' + s.mtype + ' is on me - taking it right of the line, then town', 'orange', 0);
	}
	const k = crKite;
	if (k.phase === 'out') {
		const s = (parent.entities || {})[k.id];
		if (s && !s.dead && s.target === character.name) k.lastOn = now;
		if (character.real_x >= CRYPT_RUN.lineX || now - k.lastOn > CRYPT_RUN.kiteLostMs || now - k.at > CRYPT_RUN.kiteMaxMs) {
			k.phase = 'town';
			crHalt('kite-town');
		} else { crGo(k.to, 'kite'); return true; }
	}
	if (crDist(crPos(character), CRYPT_RUN.entrance) <= 150 && k.townAt) {
		crKite = null;
		crSay('kiteDone', 'back at the entrance - rejoining', '#7FD98A', 0);
		if (!isLeader()) { recovering = true; aim = null; }
		return false;
	}
	if (now - k.townAt > 5000) {
		k.townAt = now;
		try { const pr = use_skill('use_town'); if (pr && typeof pr.catch === 'function') pr.catch(() => {}); } catch (e) {}
	}
	return true;
}

/* ---- inside: the leader ---- */
/* Why the leader should not advance, or null. */
function cryptPartyHold(run, bs, now) {
	let worst = 0, who = null;
	for (const n of followers()) {
		const st = crMate(bs, n, now);
		if (!st) return 'no word from ' + n;
		if (st.rip) return n + ' is dead';
		if (!crInside(st, run)) return n + ' is outside';
		if (st.kite) return n + ' is kiting';
		const g = Math.hypot(st.x - character.real_x, st.y - character.real_y);
		if (g > worst) { worst = g; who = n; }
	}
	crHolding = crHolding ? worst > CRYPT_RUN.holdReleaseAt : worst > CRYPT_RUN.holdAt;
	/* v34: a hold for a gap alone gives up after holdMaxMs and stays given up
	   until the gap closes. The first live run held for MageofOz at 135u - past
	   the 120 release, short of the 180 at which she would close - with no end. */
	if (!crHolding) { crHoldGapSince = 0; crHoldWaived = false; return null; }
	if (!crHoldGapSince) crHoldGapSince = now;
	if (!crHoldWaived && now - crHoldGapSince > CRYPT_RUN.holdMaxMs) {
		crHoldWaived = true;
		crSay('holdWaived', 'held ' + Math.round(CRYPT_RUN.holdMaxMs / 1000) + 's for ' + who + ' at ' + Math.round(worst) + 'u - going on', 'orange', 0);
	}
	return crHoldWaived ? null : who + ' is ' + Math.round(worst) + 'u back';
}
/* A target inside the no-go zone is not gone after - unless it is already on
   the party, when the fight comes to us. */
function crNearest(types, run) {
	let best = null, bd = Infinity;
	for (const m of threats()) {
		if (types.indexOf(m.mtype) < 0 || caveFriendly(m)) continue;
		if (run && crInZone(crPos(m), run) && !crOnParty(m)) continue;
		const d = dist(character, m);
		if (d < bd) { bd = d; best = m; }
	}
	return best;
}
function crOnParty(m) { return !!(m && m.target && partyNames().indexOf(m.target) >= 0); }
async function cryptLeaderInside(run, now) {
	if (!cryptNavOn || now < navManualUntil) return;
	const bs = beacons(), E = CRYPT_RUN.entrance;
	if (run.regroupAll) {
		crSearch.spent = 0; crSearch.lastAt = 0;
		if (crDist(crPos(character), E) > CRYPT_RUN.regroupWithin * 0.6) { crGo(E, 'entrance'); return; }
		crHalt('regroup');
		/* v35: and rested - a follower still resting is not ready to go. */
		const ok = followers().every((n) => {
			const st = crMate(bs, n, now);
			return crInside(st, run) && !st.rip && !st.rest && crDist(st, E) <= CRYPT_RUN.regroupWithin;
		});
		if (!ok) { crSay('regroup', 'regrouping at the entrance before re-engaging', '#8b98ab'); return; }
		crunPatch((c) => { c.regroupAll = false; });
		crSay('regrouped', 'regrouped - re-engaging', '#7FD98A', 0);
		return;
	}
	/* v35: the leader respawned rests at the entrance, as a follower does. */
	if (resting || deathLoop) {
		crSearch.spent = 0; crSearch.lastAt = 0;
		if (crDist(crPos(character), E) > CRYPT_RUN.regroupWithin * 0.6) { crGo(E, 'entrance'); return; }
		crHalt('rest');
		crSay('restLead', deathLoop ? 'death loop - holding at the entrance until the party collects me' : 'resting at the entrance before re-engaging', '#8b98ab');
		return;
	}
	cryptLeaderBook(run, bs, now);
	/* v37, ruling 3: a8 on a member - the party backs off west, never kites it. */
	const ch = crA8Chase(now);
	if (ch) {
		const m8 = crA8();
		crSay('a8back', 'a8 is on ' + ch.who + ' - backing off west along the route', 'orange', 15000);
		if (!crA8Retreat(m8 ? crPos(m8) : ch)) crHalt('a8-back');
		return;
	}
	/* v35: a2 - the disengage first, then the stations (P1, P4). */
	const a2 = crA2();
	if (a2 && crA2Away(now)) { engagedUntil = now + CFG.engageHoldMs; crA2Move(a2, run, now); return; }
	const st = cryptStage(run);
	if (!st) {
		const gu = Object.keys(run.givenUp || {});
		const r = crunPatch((c) => { if (!c.done) { c.done = true; c.doneAt = Date.now(); } crStageClose(c, Date.now()); });
		crSay('done', 'crypt cleared - leaving' + (gu.length ? ' (given up: ' + gu.join(', ') + ')' : ''), '#7FD98A', 0);
		if (r) cryptDump(r, 'cleared');
		return;
	}
	if (crSearch.stage !== st.i) {
		crSearch = { stage: st.i, i: 0, spent: 0, lastAt: 0, done: {}, rested: false, restAt: 0 };
		crSay('stage-' + st.i, 'stage ' + (st.i + 1) + ': ' + st.types.join(', '), '#7FD1FF', 0);
		crunPatch((c) => crStageOpen(c, st, now));
	}
	const tgt = crNearest(st.types, run);
	const pulling = st.types.indexOf('a2') >= 0 && tgt && tgt.mtype === 'a2' && crOnParty(tgt);
	/* A plan monster already on the party is fought where it is - except a2,
	   who is pulled. v34: both come BEFORE the follower hold. The first live
	   run held through the vbat fight, and held on the way back with a2 on the
	   leader, which is the wipe. R1: no follower hold during the pull. */
	const fight = threats().some((m) => CRYPT_RUN.need[m.mtype] && crOnParty(m) && !caveFriendly(m)
		&& dist(character, m) <= CRYPT_RUN.fightWithin && !(pulling && m.mtype === 'a2'));
	if (fight) {
		engagedUntil = now + CFG.engageHoldMs;
		if (a2 && crOnParty(a2) && dist(character, a2) <= CRYPT_RUN.fightWithin && crA2Move(a2, run, now)) return;
		crHalt('fight'); return;
	}
	/* v35: a death loop is collected, by the leader walking to it. */
	if (!pulling) {
		const loop = followers().map((n) => crMate(bs, n, now)).find((m) => crInside(m, run) && !m.rip && m.loop);
		/* v37, ruling 7: only while something could still be on the route -
		   with it clear, the member walks back by itself. */
		if (loop && crDist(crPos(character), loop) > CRYPT_RUN.regroupWithin * 0.6 && cryptRouteBlocked(run, bs, now)) {
			crSearch.lastAt = 0;
			crSay('collect-' + loop.name, 'collecting ' + loop.name + ' - in a death loop at ' + Math.round(loop.x) + ',' + Math.round(loop.y), '#7FD1FF', 30000);
			crGo(loop, 'collect');
			return;
		}
	}
	if (!pulling) {
		const why = cryptPartyHold(run, bs, now);
		if (why) {
			/* The search clock runs only while the party is searching; a death or
			   an exit resets it (C). */
			if (/dead|outside/.test(why)) crSearch.spent = 0;
			crSearch.lastAt = 0;
			crHalt('hold'); crSay('hold-' + why.split(' ')[0], 'holding - ' + why, '#8b98ab', 15000); return;
		}
	}
	/* v36: rested before the stage is gone after - not while a2 is being pulled.
	   v37, ruling 5: and not while anything is on the party - it fights. */
	if (!pulling && !crSearch.rested && !partyFighting()) {
		const short = cryptRestShort(st, bs, now);
		if (!crSearch.restAt) crSearch.restAt = now;
		if (short.length && now - crSearch.restAt < CRYPT_RUN.restMaxMs) {
			crSearch.lastAt = 0;
			const E2 = CRYPT_RUN.entrance;
			if (!cryptRestSafe() && crDist(crPos(character), E2) > CRYPT_RUN.regroupWithin * 0.6) crGo(E2, 'rest-safe');
			else crHalt('rest');
			crSay('restStage-' + st.i, 'resting before stage ' + (st.i + 1) + ' - ' + short.join(', '), '#8b98ab', 30000);
			return;
		}
		crSearch.rested = true;
		if (short.length) crSay('restCap-' + st.i, 'rested ' + Math.round(CRYPT_RUN.restMaxMs / 60000) + ' min and still ' + short.join(', ') + ' - going on', 'orange', 0);
	}
	/* v37, ruling 4: the bats are pulled to the spot, never walked to. */
	if (st.types.indexOf('vbat') >= 0) { crSearch.spent = 0; crSearch.lastAt = 0; cryptBatStage(run, st, bs, now); return; }
	if (tgt) {
		crSearch.spent = 0; crSearch.lastAt = 0;
		engagedUntil = now + CFG.engageHoldMs;
		if (pulling) {
			/* v35, Q1: no stop at 40% - the scare-and-disengage replaces it. At
			   the pull spot the stations take over (P4). */
			if (crDist(crPos(character), CRYPT_RUN.pullSpot) <= NAV.arriveAt) {
				if (!crA2Move(tgt, run, now)) crHalt('pull-stop');
				return;
			}
			crSay('pull', 'a2 is on us - pulling him back to the hall', '#7FD1FF', 20000);
			crGo(CRYPT_RUN.pullSpot, 'pull');
			return;
		}
		if (crOnParty(tgt)) { crHalt('fight'); return; }
		const reach = Math.max(60, (character.range || 100) * 0.8);
		if (dist(character, tgt) > reach) crGo(crPos(tgt), 'tgt-' + tgt.mtype);
		else crHalt('in-range');
		return;
	}
	/* THE SEARCH CLOCK - v35 (C). It counts only from here: the party is all
	   alive and inside, nobody is fighting, holding or regrouping, and nothing
	   of the stage is in view. A pause adds at most a second; a death or a
	   regroup resets it. On v34 it ran through a wipe and gave a2 up. */
	crSearch.spent = (crSearch.spent || 0) + (crSearch.lastAt ? Math.min(now - crSearch.lastAt, 1000) : 0);
	crSearch.lastAt = now;
	/* Nothing of this stage in view this long: give it up and move on - R6. */
	if (crSearch.spent > CRYPT_RUN.searchMaxMs) {
		crunPatch((c) => {
			c.givenUp = c.givenUp || {}; c.givenWhy = c.givenWhy || {};
			for (const t of st.types) { c.givenUp[t] = now; c.givenWhy[t] = 'not found in ' + Math.round(CRYPT_RUN.searchMaxMs / 60000) + ' min of searching'; }
		});
		crHalt('search');
		crSay('gaveUp-' + st.types.join('-'), 'no ' + st.types.join('/') + ' found in ' + Math.round(CRYPT_RUN.searchMaxMs / 60000)
			+ ' min - given up, moving on; ' + (st.types.length > 1 ? 'they are' : 'it is') + ' taken back if seen again', 'red', 0);
		crSearch = { stage: -1, i: 0, spent: 0, lastAt: 0, done: {} };
		return;
	}
	/* Nothing of this stage in view: search - R4 and R5. */
	const pts = cryptSearchPoints(run, st, bs, now);
	if (!pts.length) {
		crHalt('search');
		crSay('searchBlocked', 'searching for ' + st.types.join('/') + ' - every point is blocked by a monster or a failed walk; waiting', 'orange');
		return;
	}
	const p = pts[0];
	if (crDist(crPos(character), p) <= NAV.arriveAt) { crSearch.done[p.key] = true; crSearch.i++; return; }
	crSay('search-' + p.key, 'looking for ' + st.types.join('/') + ' at ' + p.x + ',' + p.y + ' (' + p.why + ')', '#8b98ab', 60000);
	crGo(p, 'crs-' + p.key);
}
/* ---- the rest before each stage - v36 ---- */
/* Who is not yet rested, as reasons: hp or mp under restHpAt/restMpAt, and
   before a2 the jacko holder short of one scare. A beacon from an older build
   carries no mpFrac and is not held for it. */
function cryptRestShort(st, bs, now) {
	const out = [];
	let holder = null;
	for (const n of TEAM) {
		const b = n === character.name ? cryptSelfBeacon() : crMate(bs, n, now);
		if (!b) { out.push('no word from ' + n); continue; }
		if (typeof b.hpFrac === 'number' && b.hpFrac < CRYPT_RUN.restHpAt) out.push(n + ' hp ' + Math.round(b.hpFrac * 100) + '%');
		if (typeof b.mpFrac === 'number' && b.mpFrac < CRYPT_RUN.restMpAt) out.push(n + ' mp ' + Math.round(b.mpFrac * 100) + '%');
		if (b.jacko) holder = b;
	}
	if (st && st.types.indexOf('a2') >= 0 && holder) {
		let need = 50;
		try { need = parent.G.skills.scare.mp || need; } catch (e) {}
		if (typeof holder.mp === 'number' && holder.mp < need) out.push(holder.name + ' short of one scare (' + holder.mp + '/' + need + ' mp)');
	}
	return out;
}
/* Nothing hostile within restSafeR of me. */
function cryptRestSafe() {
	return !threats().some((m) => !caveFriendly(m) && !m.dead && dist(character, m) <= CRYPT_RUN.restSafeR);
}
/* ---- stage times, for the CRYPT DUMP - v36 ---- */
function crStageClose(c, now) {
	for (const x of c.stages || []) if (!x.end) { x.end = now; x.ms = now - x.at; }
}
function crStageOpen(c, st, now) {
	const last = (c.stages || [])[(c.stages || []).length - 1];
	if (last && last.i === st.i && !last.end) return;
	crStageClose(c, now);
	c.stages = (c.stages || []).concat([{ i: st.i, types: st.types.slice(), at: now }]);
}
/* ---- the CRYPT DUMP - v36, the operator's ruling of 2026-11-08 19:30 ----
   One row per run in the game log, as the cave's CAVE DUMP: time per stage,
   deaths per member with where and by what, keys used, what was given up and
   why, total time - plus the kills and a2's logged switches. Written once, by
   the leader, under an extra `dump` field. */
function cryptDumpOf(r, why, now) {
	const deaths = (r.deaths || []).map((d) => ({ who: d.who, x: d.x, y: d.y, by: d.by || null, t: d.t }));
	const per = {};
	for (const d of deaths) per[d.who] = (per[d.who] || 0) + 1;
	let keysLeft = null;
	try { keysLeft = (character.items || []).reduce((n, it) => n + (it && it.name === CRYPT_RUN.keyItem ? (it.q || 1) : 0), 0); } catch (e) {}
	const end = r.doneAt || now;
	return { kind: 'crypt', why: why, id: r.id, leader: r.leader || character.name, at: r.at || null, end: end,
		totalMs: r.at ? end - r.at : null,
		stages: (r.stages || []).map((x) => ({ types: x.types, at: x.at, end: x.end || null, ms: x.end ? x.end - x.at : null })),
		deaths: deaths, deathsBy: per, keysUsed: r.keyUsed ? 1 : 0, keysLeft: keysLeft,
		givenUp: Object.keys(r.givenUp || {}).map((t) => ({ mtype: t, at: r.givenUp[t], why: (r.givenWhy || {})[t] || 'not found' })),
		kills: crKills(r), cleared: r.cleared || {}, lost: !!r.lost, abandoned: !!r.abandoned, a2log: r.a2log || [], ver: caveVersion() };
}
function cryptDump(r, why) {
	if (!r || !isLeader()) return false;
	const now = Date.now();
	let first = false;
	crunPatch((c) => { if (c.id === r.id && !c.dumped) { c.dumped = now; first = true; } });
	if (!first) return false;
	const d = cryptDumpOf(r, why, now);
	ev('cryptDump', { id: d.id, why: why, totalMs: d.totalMs, deaths: d.deaths.length });
	const line = 'CRYPT DUMP (' + why + ') - ' + character.name + ' - ' + (d.totalMs ? Math.round(d.totalMs / 60000) + ' min, ' : '')
		+ d.deaths.length + ' death(s)' + (d.givenUp.length ? ', given up ' + d.givenUp.map((g) => g.mtype).join('/') : '');
	try {
		const st = parent.__gamelog;
		if (!st || typeof st.capture !== 'function') { clog(line + ' - the game-log capture is missing, so the dump is in the event ring only', 'orange'); return false; }
		st.capture(line, '#8b98ab', 'script');
		const row = st.buf[st.buf.length - 1];
		if (row) row.dump = JSON.parse(JSON.stringify(d));
		return true;
	} catch (e) { return false; }
}
/* The leader's bookkeeping, every tick inside: merge the members' sightings;
   grow the zone over a zone monster seen outside it; take back a given-up
   plan monster that has been seen since it was given up. */
function cryptLeaderBook(run, bs, now) {
	const s = crSightings(bs, run);
	/* v37, ruling 1: a local exclusion around each sighting, not a moved edge.
	   One entry per monster, its newest sighting; old ones drop off. */
	const old = (run.zoneLocal || []).filter((a) => now - a.t <= CRYPT_RUN.zoneLocalMs);
	const loc = old.slice();
	for (const a of s.zav) {
		const i = loc.findIndex((x) => x.id === a.id);
		/* Refreshed only when it has moved or every 10s - this runs every tick. */
		if (i >= 0 && (loc[i].t >= a.t || (a.t - loc[i].t < 10000 && Math.hypot(a.x - loc[i].x, a.y - loc[i].y) < 50))) continue;
		if (i >= 0) loc.splice(i, 1);
		else crSay('zoneLocal-' + a.id, 'a zone monster (' + a.mtype + ') seen outside the zone at ' + a.x + ',' + a.y
			+ ' - keeping ' + CRYPT_RUN.zoneLocalR + ' clear of it, never the bat route', 'orange', 60000);
		loc.push({ id: a.id, mtype: a.mtype, x: a.x, y: a.y, t: a.t });
	}
	if (JSON.stringify(loc) !== JSON.stringify(run.zoneLocal || [])) {
		crunPatch((c) => { c.zoneLocal = loc; });
		run.zoneLocal = loc;
	}
	const back = Object.keys(run.givenUp || {}).filter((t) => s.seen[t] && s.seen[t].t > run.givenUp[t]);
	if (back.length) {
		crunPatch((c) => { for (const t of back) if (c.givenUp) delete c.givenUp[t]; });
		for (const t of back) delete run.givenUp[t];
		crSay('back-' + back.join('-') + '-' + now, back.join('/') + ' seen again - going back for ' + (back.length > 1 ? 'them' : 'it'), '#7FD1FF', 0);
	}
	return s;
}
/* Why a search point is off limits, or null. */
function crSearchBlocked(p, run, st, now) {
	if (crInZone(p, run)) return 'zone';
	if (crInBox(p, CRYPT_RUN.boxMargin)) return 'the bat box';
	if (p.x >= CRYPT_RUN.lineX) return 'line';
	const k = crKills(run), cl = run.cleared || {}, gu = run.givenUp || {};
	for (const t in CRYPT_RUN.homes) {
		if (st.types.indexOf(t) >= 0 || cl[t] || gu[t] || (k[t] || 0) >= (CRYPT_RUN.need[t] || 1)) continue;
		for (const h of CRYPT_RUN.homes[t]) if (Math.hypot(p.x - h[0], p.y - h[1]) <= CRYPT_RUN.homeAvoid) return t + "'s home";
	}
	for (const id in crAvoid) {
		const a = crAvoid[id];
		if (st.types.indexOf(a.mtype) >= 0 || now - a.t > CRYPT_RUN.avoidMs) continue;
		if (Math.hypot(p.x - a.x, p.y - a.y) <= CRYPT_RUN.avoidR) return a.mtype + ' near it';
	}
	return null;
}
/* Where to look next, best first: where a member last saw it, where a member
   died to it, its home, then the tour from the point nearest the leader. A
   point already reached this pass, or whose walk failed searchFailSkip times,
   is left out; once a pass has nothing left it starts again. */
function cryptSearchPoints(run, st, bs, now) {
	const s = crSightings(bs, run), out = [];
	for (const t of st.types) if (s.seen[t]) out.push({ x: s.seen[t].x, y: s.seen[t].y, key: 'seen-' + t + '-' + s.seen[t].t, why: 'last seen' });
	for (const d of s.died) if (d.by && st.types.indexOf(d.by) >= 0) out.push({ x: d.x, y: d.y, key: 'died-' + d.who + '-' + d.t, why: d.who + ' died to it' });
	for (const t in CRYPT_RUN.homes) if (st.types.indexOf(t) >= 0) CRYPT_RUN.homes[t].forEach((h, i) => out.push({ x: h[0], y: h[1], key: 'home-' + t + '-' + i, why: 'its home' }));
	const T = CRYPT_RUN.tour, me = crPos(character);
	let start = 0, bd = Infinity;
	T.forEach((p, i) => { const d = Math.hypot(p[0] - me.x, p[1] - me.y); if (d < bd) { bd = d; start = i; } });
	for (let j = 0; j < T.length; j++) { const i = (start + j) % T.length; out.push({ x: T[i][0], y: T[i][1], key: 'tour-' + i, why: 'tour' }); }
	if (!crSearch.done) crSearch.done = {};
	const ok = (p) => !((navFails['crs-' + p.key] || 0) >= CRYPT_RUN.searchFailSkip) && !crSearchBlocked(p, run, st, now);
	let left = out.filter((p) => ok(p) && !crSearch.done[p.key]);
	if (!left.length && out.some(ok)) { crSearch.done = {}; left = out.filter(ok); }
	return left;
}

/* ---- inside: a follower. True while this owns the move. ---- */
function cryptFollowerInside(run, now) {
	const bs = beacons(), lb = crMate(bs, leaderName(), now), E = CRYPT_RUN.entrance;
	if (run.regroupAll) {
		if (crDist(crPos(character), E) > CRYPT_RUN.regroupWithin * 0.6) crGo(E, 'entrance');
		else crHoldPlace();
		return true;
	}
	/* v35 (A): respawned, rest at the entrance; a death loop waits there for
	   the leader to collect it. On v33 a respawn walked straight back across
	   the floor alone - MageofOz died nine times in one run that way. */
	/* v37, ruling 7: a death loop with the route clear walks back by itself,
	   along the route; restTick ends the loop once the leader is beside it. */
	if (deathLoop && crInside(lb, run) && !lb.rip && !cryptRouteBlocked(run, bs, now)) {
		crSay('walkBack', 'death loop, the route is clear - walking back to the party', '#7FD1FF', 30000);
		crRouteWalk({ x: lb.x, y: lb.y }, 'walk-back');
		return true;
	}
	if (resting || deathLoop) {
		if (crDist(crPos(character), E) > CRYPT_RUN.regroupWithin * 0.6) crGo(E, 'entrance');
		else crHoldPlace();
		return true;
	}
	if (!crInside(lb, run) || lb.rip || lb.kite || (lb.rest && !lb.loop)) { crHoldPlace(); return true; }
	/* v37, ruling 3: a8 on a member - back off west; a8 within 300 - back off. */
	const ch = crA8Chase(now), m8 = crA8();
	if (ch || (m8 && crDist(crPos(character), crPos(m8)) < CRYPT_RUN.a8Clear)) {
		if (!crA8Retreat(m8 ? crPos(m8) : ch)) crHoldPlace();
		return true;
	}
	/* v37, ruling 4: Dexon pulls the bats. */
	if (cryptPullTick(run, now)) return true;
	/* Rested: join the leader only while he is stationary and nobody is
	   fighting (R3), and hold where I am until then. */
	if (crRejoin) {
		const lp = { x: lb.x, y: lb.y }, gap = crDist(crPos(character), lp);
		if (gap <= CRYPT_RUN.regroupWithin) { crRejoin = false; clog('back with the party', '#7FD98A'); return false; }
		if (joinWanted(gap)) { if (crCrossesBox(crPos(character), lp)) crSafeStep(lp, 'rejoin'); else joinStep(lp, gap); } else crHoldPlace();
		return true;
	}
	/* a2 (P1, P4): away while the disengage covers me, else my station. */
	const a2 = crA2();
	if (a2 && !leaderMoving() && crA2Move(a2, run, now)) return true;
	if (a2 && crA2Away(now)) return crA2Move(a2, run, now);
	return false;
}
function crHoldPlace() {
	recovering = false; aim = null;
	const k = kiteStep(null);
	if (k) { try { move(k.x, k.y); bump('kiteSteps'); } catch (e) {} }
}
function cryptLeave(run, now) {
	let chests = 0;
	try { chests = Object.keys((typeof get_chests === 'function' && get_chests()) || {}).length; } catch (e) {}
	if (chests && now - (run.doneAt || now) < CRYPT_RUN.chestWaitMs) { crSay('chests', 'waiting for ' + chests + ' chest(s)', '#8b98ab', 10000); return; }
	crWalk(CRYPT_RUN.door, 'leave');
}

/* ---- outside ---- */
function cryptEnter(id, now) {
	if (crEnterFlight && now - crEnterFlight < 10000) return;
	crEnterFlight = now;
	crSay('enter', id ? 'entering the crypt' : 'opening a new crypt with a ' + CRYPT_RUN.keyItem, '#FFD700', 5000);
	let pr = null;
	try { pr = id ? enter('crypt', id) : enter('crypt'); } catch (e) { cryptEnterFailed(id, e); return; }
	if (pr && typeof pr.then === 'function') pr.then(() => {}, (e) => cryptEnterFailed(id, e));
}
function cryptEnterFailed(id, e) {
	const why = String((e && (e.reason || e.message)) || e);
	crSay('enterFail', 'enter refused: ' + why, 'orange', 0);
	if (id && /invalid/.test(why)) {
		const r = crunPatch((c) => { if (c.id === id && !c.done) { c.done = true; c.lost = true; c.doneAt = Date.now(); crStageClose(c, Date.now()); } });
		if (r && r.id === id) cryptDump(r, 'lost');
		if (cryptRelayId === id) cryptRelayId = null;
		crSay('lost', 'that instance is gone - the run is over', 'red', 0);
	}
}
/* What stops the leader opening the next run. bs carries every member's
   beacon, this tab's own included. */
function cryptGate(bs, now, hasKey) {
	const out = [];
	for (const n of TEAM) {
		const st = n === character.name ? bs[n] : crMate(bs, n, now);
		if (!st) { out.push('no word from ' + n); continue; }
		if (st.rip) { out.push(n + ' is dead'); continue; }
		if (st.map !== CRYPT_RUN.door.map || crDist(st, CRYPT_RUN.door) > CRYPT_RUN.doorReach) out.push(n + ' is not at the door');
		if (n === CRYPT_RUN.mule) { if (!st.room) out.push(n + ' has no room'); }
		else if (!st.muled) out.push(n + ' is still muling');
		if (!(st.mluck >= CRYPT_RUN.mluckMinMs)) out.push(n + ' lacks mluck');
	}
	if (!hasKey) out.push('no ' + CRYPT_RUN.keyItem + ' in ' + character.name + "'s bag");
	return out;
}
function cryptOutside(run, now) {
	if (character.map !== CRYPT_RUN.door.map || crDist(crPos(character), CRYPT_RUN.door) > CRYPT_RUN.doorReach) {
		crWalk(CRYPT_RUN.door, 'door');
		return;
	}
	if (run && !run.done) { cryptEnter(run.id, now); return; }
	if (!isLeader()) return;
	const bs = beacons();
	bs[character.name] = cryptSelfBeacon();
	let hasKey = false;
	try { hasKey = locate_item(CRYPT_RUN.keyItem) >= 0; } catch (e) {}
	const b = cryptGate(bs, now, hasKey);
	if (!b.length) { cryptEnter(null, now); return; }
	/* v36: out of keys after a run - hand back once everyone is out and muled. */
	if (!hasKey) {
		const wait = cryptOutOfKeys(run, bs, now);
		if (wait && !wait.length) { cryptHandBackAll('no ' + CRYPT_RUN.keyItem + ' left after the last run'); return; }
		if (wait) { crSay('keysOut', 'no ' + CRYPT_RUN.keyItem + ' left - handing everyone back once ' + wait.join(' | '), '#FFD700'); return; }
	}
	const red = !hasKey || (crMluckSince && now - crMluckSince > CRYPT_RUN.mluckLongMs && b.some((x) => /mluck/.test(x)));
	crSay('gate', 'waiting at the door - ' + b.join(' | ') + (!hasKey ? ' - put a ' + CRYPT_RUN.keyItem + ' in his bag; the bank is never touched' : ''),
		red ? 'red' : '#8b98ab');
}
/* ---- out of keys - v36, the operator's ruling of 2026-11-08 19:20 ----
   After the LAST run: done, the party out and muled, no key in the leader's
   bag. An unfinished instance never gets here - cryptOutside re-enters it, and
   that needs no key. null when this is not the after-run case (no run done
   since cryptRun, so a run that never had a key keeps the red wait); else what
   is still outstanding, empty when the hand-back can go. */
function cryptOutOfKeys(run, bs, now) {
	let started = 0;
	try { started = Number(parent.localStorage.getItem(CRYPT_START_KEY)) || 0; } catch (e) {}
	if (!run || !run.done || !(run.at >= started)) return null;
	const out = [];
	for (const n of TEAM) {
		const st = n === character.name ? bs[n] : crMate(bs, n, now);
		if (!st) { out.push('word from ' + n); continue; }
		if (st.rip) out.push(n + ' is alive');
		if (st.map === 'crypt') out.push(n + ' is out');
		if (n !== CRYPT_RUN.mule && !st.muled) out.push(n + ' has muled');
	}
	return out;
}
/* The leader's hand-back: written to the shared key for any tab that misses
   the cm, then said, then done here. */
function cryptHandBackAll(why) {
	try { parent.localStorage.setItem(CRYPT_HANDBACK_KEY, JSON.stringify({ at: Date.now(), why: why })); } catch (e) {}
	if (isLeader()) caveSay('crypthandback');
	cryptHandBack(why);
}
/* A hand-back this tab should follow: written since this crypt run began, and
   recent. Followers read it each tick, the fallback to the cm. */
function cryptHandBackPending(now) {
	let h = null, started = 0;
	try { h = JSON.parse(parent.localStorage.getItem(CRYPT_HANDBACK_KEY)); started = Number(parent.localStorage.getItem(CRYPT_START_KEY)) || 0; } catch (e) { return null; }
	if (!h || !(h.at >= started) || now - h.at > 10 * 60 * 1000) return null;
	return h;
}
/* Off crypt mode, crypt_auto cleared so a reload does not restart it, and
   back to the character slot by the cave's own path. */
function cryptHandBack(why) {
	if (!cryptAuto) return false;
	cryptAuto = false; crKite = null;
	try { parent.localStorage.removeItem(CRYPT_AUTO_KEY); parent.localStorage.removeItem(CRYPT_START_KEY); } catch (e) {}
	if (navFlight) navHalt('handback');
	ev('cryptHandBack', { why: why });
	clog('[crypt] ' + why + ' - handing back to the character slot', '#FFD700');
	handBack('crypt: ' + why);
	return true;
}
function cryptSelfBeacon() {
	return { name: character.name, t: Date.now(), map: character.map, x: Math.round(character.real_x), y: Math.round(character.real_y),
		rip: !!character.rip, mluck: mluckLeft(), muled: crMuled, room: crRoom,
		hpFrac: character.max_hp ? character.hp / character.max_hp : 1,
		mpFrac: character.max_mp ? character.mp / character.max_mp : 1,
		mp: Math.round(character.mp || 0), jacko: crHasJacko() };
}

/* ---- the mule, the room and the mluck ---- */
function cryptMuleList(items) {
	const out = [];
	(items || []).forEach((it, i) => {
		if (!it || it.l || it.s) return;
		if (CRYPT_RUN.keep.indexOf(it.name) >= 0) return;
		out.push({ i: i, name: it.name, q: it.q || 1 });
	});
	return out;
}
function cryptFree() {
	if (typeof character.esize === 'number') return character.esize;
	return (character.items || []).filter((x) => !x).length;
}
function cryptAskMerchant(payload) {
	const body = Object.assign({ _plid: character.name + '-crypt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) }, payload);
	try { body._plshard = { region: parent.server_region, name: parent.server_identifier }; } catch (e) {}
	try { send_cm(CRYPT_RUN.merchant, body); } catch (e) {}
	try {
		if (typeof fetch === 'function') fetch(CRYPT_RUN.bridge + '/msg', { method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: character.name, to: [CRYPT_RUN.merchant], id: body._plid, payload: body }) }).catch(() => {});
	} catch (e) {}
}
function crSendAll(to, list) {
	for (const it of list) { try { send_item(to, it.i, it.q); } catch (e) {} }
}
/* EVERY MEMBER, ANY TIME OUTSIDE: THE LOOT TO THE MERCHANT WHILE HE IS IN
   SEND RANGE - v36, the operator's ruling of 2026-11-08 19:16. He comes to the
   door for mluck anyway, so this saves the later trip and the gate's wait on
   muled and room. Dexon, as the mule, stays the fallback. True when he was in
   range this tick. */
function cryptMerchantTick(now) {
	if (character.map === 'crypt' || character.rip) return false;
	let m = null;
	try { m = get_player(CRYPT_RUN.merchant); } catch (e) {}
	if (!m || m.rip || dist(character, m) > CRYPT_RUN.muleRange) return false;
	if (now - crPushAt < 2000) return true;
	crPushAt = now;
	const list = cryptMuleList(character.items);
	if (list.length) {
		crSendAll(m.name || CRYPT_RUN.merchant, list);
		crSay('toMerchant', 'loot handed to ' + CRYPT_RUN.merchant + ' (' + list.length + ' item(s))', '#7FD98A', 30000);
	}
	return true;
}
/* The other two, outside after a run: hand Dexon everything but the keep list,
   unless the merchant is taking it this tick. */
function cryptMuleTick(run, now, toMerchant) {
	if (character.name === CRYPT_RUN.mule) { cryptRoomTick(now); return; }
	const key = run ? run.id : null;
	if (crMuleRun !== key) { crMuleRun = key; crMuled = false; crMuleSince = now; }
	if (crMuled || character.map === 'crypt' || character.rip || (run && !run.done)) return;
	if (now - crMuleAt < 2000) return;
	crMuleAt = now;
	const list = cryptMuleList(character.items);
	if (!list.length) { crMuled = true; crSay('muled', 'loot handed to ' + CRYPT_RUN.mule, '#7FD98A', 0); return; }
	let m = null;
	try { m = get_player(CRYPT_RUN.mule); } catch (e) {}
	if (!m || m.rip || dist(character, m) > CRYPT_RUN.muleRange) {
		if (now - crMuleSince > CRYPT_RUN.muleWaitMs) {
			crMuled = true;
			crSay('muleGaveUp', CRYPT_RUN.mule + ' never came in range - keeping ' + list.length + ' item(s)', 'orange', 0);
		}
		return;
	}
	if (toMerchant) return;
	crSendAll(m.name || CRYPT_RUN.mule, list);
}
/* Dexon: short of room, ask the merchant to come. Asked only outside the
   crypt - nobody could reach him inside. The overflow goes to him by
   cryptMerchantTick once he is in range, as everyone's loot does (v36). */
function cryptRoomTick(now) {
	const free = cryptFree();
	crRoom = free >= CRYPT_RUN.muleMinFree;
	if (crRoom || character.map === 'crypt' || character.rip) return;
	/* v37: only at the door between runs - twice in run 3 he asked from the
	   door on his way back in after a respawn, and the merchant came to nobody. */
	const run = crunEffective();
	if ((run && !run.done) || character.map !== CRYPT_RUN.door.map || crDist(crPos(character), CRYPT_RUN.door) > CRYPT_RUN.doorReach) return;
	if (now - (crAskAt.room || 0) >= CRYPT_RUN.askMs) {
		crAskAt.room = now;
		cryptAskMerchant({ message: 'inventory_almost_full', emptySlots: free, x: character.x, y: character.y, map: character.map });
		crSay('room', free + ' slot(s) free - asked ' + CRYPT_RUN.merchant + ' to take the overflow', 'orange');
	}
}
function cryptMluckLacking(bs, now) {
	return TEAM.filter((n) => {
		const st = n === character.name ? { t: now, mluck: mluckLeft() } : crMate(bs, n, now);
		return !st || !(st.mluck >= CRYPT_RUN.mluckMinMs);
	});
}
/* Dexon asks for everyone: the merchant's mluck trips answer his requests
   only, and the party is at the door with him. */
function cryptMluckTick(run, now) {
	if (character.map === 'crypt' || character.rip || (run && !run.done)) { crMluckSince = 0; return; }
	const lacking = cryptMluckLacking(beacons(), now);
	if (!lacking.length) { crMluckSince = 0; return; }
	if (!crMluckSince) crMluckSince = now;
	if (character.name !== CRYPT_RUN.mule) return;
	if (now - (crAskAt.mluck || 0) < CRYPT_RUN.askMs) return;
	crAskAt.mluck = now;
	cryptAskMerchant({ message: 'location', needsMluck: true, x: character.x, y: character.y, map: character.map });
	crSay('mluck', 'asked ' + CRYPT_RUN.merchant + ' for mluck - lacking: ' + lacking.join(', '),
		now - crMluckSince > CRYPT_RUN.mluckLongMs ? 'red' : 'orange');
}

/* ---- the tick ---- */
/* Bookkeeping, every tick, before anything moves. */
function cryptTick() {
	if (!cryptAuto || mode !== 'crypt') return;
	const now = Date.now();
	if (!character.rip) crHoldSince = 0;
	else { crSearch.spent = 0; crSearch.lastAt = 0; }
	if (now - crAutoAt >= 60000) cryptAutoStamp(now);
	cryptSeeTick(now);
	if (isLeader() && character.map === 'crypt' && character.in) {
		const r = crunRead();
		if (!r || r.id !== character.in) {
			/* A new instance is opened only by enter() with no name, which spends a key. */
			crunWrite({ id: character.in, at: now, leader: character.name, dead: {}, cleared: {}, done: false, regroupAll: false, keyUsed: true });
			try { send_cm(followers(), { cave: { crypt: character.in } }); } catch (e) {}
			crSearch = { stage: -1, i: 0, spent: 0, lastAt: 0, done: {} };
			crSay('published', 'in - instance published to ' + followers().join(', '), '#7FD98A', 0);
		}
	}
	/* v36: the leader's hand-back, for a tab that missed his cm. */
	if (!isLeader() && character.map !== 'crypt' && cryptHandBackPending(now)) { cryptHandBack('the leader handed back - no keys left'); return; }
	const run = crunEffective();
	const toMerchant = cryptMerchantTick(now);
	cryptMuleTick(run, now, toMerchant);
	cryptMluckTick(run, now);
}
/* Movement. True while the crypt run owns this tick's move. */
async function cryptMoveTick() {
	const now = Date.now();
	const run = crunEffective();
	if (character.map === 'crypt') {
		if (await cryptKiteTick(now)) return true;
		if (run && run.done) { cryptLeave(run, now); return true; }
		if (!run) return false;
		if (isLeader()) { noteLeaderMotion({ x: character.real_x, y: character.real_y }); await cryptLeaderInside(run, now); return true; }
		return cryptFollowerInside(run, now);
	}
	crKite = null;
	cryptOutside(run, now);
	return true;
}

/* ---- commands ---- */
function cryptRun() {
	launcher.handBackAt = 0;
	cryptAuto = true; cryptNavOn = true; navManualUntil = 0;
	cryptAutoStamp(Date.now());
	mode = 'crypt'; stopped = false; phase = 'active'; recovering = false; aim = null;
	if (isLeader()) {
		/* The start stands until the run is stopped, handed back or lapses, so a
		   reload resuming it keeps the runs already done. */
		try {
			parent.localStorage.removeItem(CRYPT_HANDBACK_KEY);
			if (!parent.localStorage.getItem(CRYPT_START_KEY)) parent.localStorage.setItem(CRYPT_START_KEY, String(Date.now()));
		} catch (e) {}
		caveSay('cryptrun');
	}
	clog('CRYPT RUN as ' + role() + ' - leader ' + leaderName() + ', mule ' + CRYPT_RUN.mule
		+ '. cryptStop() hands everything back; cryptNav(false) hands back the driving only; cryptNew() abandons the current instance.', '#FFD700');
	ev('cryptRun', { role: role() });
	return cryptStatus();
}
function cryptStop() {
	cryptAuto = false; crKite = null;
	try { parent.localStorage.removeItem(CRYPT_AUTO_KEY); parent.localStorage.removeItem(CRYPT_START_KEY); } catch (e) {}
	if (navFlight) navHalt('off');
	if (isLeader()) caveSay('cryptstop');
	clog('crypt run OFF - plain crypt mode, the leader is yours to drive', 'orange');
	return false;
}
/* A run record not marked done is RESUMED: the next entry goes back into that
   instance, and no new key is spent while it stands. That is right after a
   wipe or a reload, since the server never destroys a crypt instance and its
   kills are final. When the operator wants a fresh instance instead, this
   marks the current one done; a server restart does the same by itself, as the
   re-entry is refused invalid. cryptStop() deliberately does not, so stopping
   and restarting resumes. */
function cryptNew() {
	const r = crunPatch((c) => { if (!c.done) { c.done = true; c.abandoned = true; c.doneAt = Date.now(); crStageClose(c, Date.now()); } });
	if (r && r.abandoned) cryptDump(r, 'abandoned');
	cryptRelayId = null;
	clog(r ? 'crypt run abandoned - the next entry opens a new instance with a ' + CRYPT_RUN.keyItem : 'no crypt run on record', '#FFD700');
	return r ? { done: true, abandoned: !!r.abandoned } : null;
}
function cryptNav(on) {
	cryptNavOn = on === undefined ? !cryptNavOn : !!on;
	navManualUntil = 0;
	/* v35: a fresh search clock, or a clock already past its limit gives up again at once. */
	if (cryptNavOn) { crSearch.spent = 0; crSearch.lastAt = 0; }
	if (!cryptNavOn && navFlight) navHalt('off');
	clog('crypt autopilot ' + (cryptNavOn ? 'ON' : 'OFF'), '#FFD700');
	return cryptNavOn;
}
function cryptSpot(name, x, y) {
	const k = { pull: 'pullSpot', vbat: 'vbatSpot' }[name];
	if (!k) { clog('cryptSpot(pull|vbat, x, y)', 'orange'); return null; }
	if (typeof x === 'number' && typeof y === 'number') CRYPT_RUN[k] = { x: x, y: y };
	clog('crypt ' + name + ' spot: ' + CRYPT_RUN[k].x + ',' + CRYPT_RUN[k].y, '#FFD700');
	return CRYPT_RUN[k];
}
function cryptStatus() {
	const run = crunEffective(), st = run ? cryptStage(run) : null;
	const info = { auto: cryptAuto, nav: cryptNavOn, role: role(), leader: leaderName(), map: character.map,
		run: run ? { done: !!run.done, lost: !!run.lost, regroupAll: !!run.regroupAll, kills: crKills(run), cleared: run.cleared || {} } : null,
		stage: st ? st.types : null, kiting: crKite ? crKite.mtype : null, holding: crHolding,
		mluckMin: Math.round(mluckLeft() / 60000), muled: crMuled, room: crRoom, free: cryptFree() };
	clog(JSON.stringify(info));
	return info;
}
/* crypt_auto holds the time of the last crypt tick, refreshed once a minute,
   so it lapses autoKeepMs after the run goes quiet - see CRYPT_RUN.autoKeepMs. */
function cryptAutoStamp(now) {
	crAutoAt = now;
	if (cryptHandBackPending(now)) return;
	try { parent.localStorage.setItem(CRYPT_AUTO_KEY, String(now)); } catch (e) {}
}
function cryptAutoSaved(now) {
	let v = null;
	try { v = parent.localStorage.getItem(CRYPT_AUTO_KEY); } catch (e) { return false; }
	if (v === null) return false;
	const at = Number(v);
	if (at > 0 && now - at <= CRYPT_RUN.autoKeepMs) return true;
	try { parent.localStorage.removeItem(CRYPT_AUTO_KEY); parent.localStorage.removeItem(CRYPT_START_KEY); } catch (e) {}
	clog('crypt run NOT resumed - last active ' + (at > 0 ? Math.round((now - at) / 60000) + ' min ago' : 'at an unknown time')
		+ '; cryptRun() on ' + leaderName() + ' starts it again', 'orange');
	return false;
}
try { game.on('death', function (d) { if (!alive()) return; try { cryptOnDeath(d); } catch (e) {} }); } catch (e) {}

try {
	character.on('cm', function (d) {
		try {
			if (!alive() || !d || !d.message || !d.message.cave) return;
			if (d.name !== leaderName()) return;
			ev('cm', { from: d.name, msg: d.message.cave });
			if (d.message.cave === 'go') { if (phase === 'idle') caveGo(); }
			else if (d.message.cave === 'stop') caveStop();
			else if (d.message.cave === 'cryptrun') { if (!cryptAuto) cryptRun(); }
			else if (d.message.cave === 'cryptstop') { if (cryptAuto) cryptStop(); }
			else if (d.message.cave === 'crypthandback') { if (cryptAuto) cryptHandBack('the leader handed back - no keys left'); }
			else if (d.message.cave.crypt && typeof d.message.cave.crypt === 'string') cryptRelayId = d.message.cave.crypt;
		} catch (e) {}
	});
} catch (e) { clog('could not hook cm: ' + e, 'red'); }

try {
	window.caveGo = caveGo; window.caveDry = caveDry; window.caveLead = caveLead;
	window.caveCrypt = caveCrypt; window.caveOnly = caveOnly; window.caveNever = caveNever;
	window.caveEnter = caveEnter; window.caveStatus = caveStatus; window.caveStop = caveStop;
	window.caveDump = caveDump; window.caveLeash = caveLeash; window.caveVotePreview = caveVotePreview;
	window.caveExit = caveExit; window.caveStay = caveStay; window.caveResume = caveResume;
	window.caveNav = caveNav; window.caveNavStatus = caveNavStatus;
	window.cryptRun = cryptRun; window.cryptStop = cryptStop; window.cryptNav = cryptNav;
	window.cryptStatus = cryptStatus; window.cryptSpot = cryptSpot; window.cryptNew = cryptNew;
} catch (e) {}

// ---------------------------------------------------------------- loop -----
let leaving = false;
async function tick() {
	const gen = tickGen;
	tickAt = Date.now();
	try {
		const was = phase;
		if (inCave()) phase = 'inside';
		else if (phase === 'inside') { leaving = true; phase = 'idle'; votedFor = {}; deadDoors = {}; dieShops = {}; pendingBuys = {}; voteNoted = {}; reserveReleased = false; reviveSpent = {};
			myDeaths = []; resting = false; deathLoop = false; friendlySkip = {}; exitAsked = 0; finishedAt = 0; exitForce = false; exitWhyFrom = 0;
			navGoal = null; navFlight = null; navManualUntil = 0; navEscort = null; navAt = {}; navSkip = {}; navFails = {}; navSaid = {};
			navLastDoor = 0; navDoorSince = 0; navLeg = null; navFloor = null; }
		else if (offCave()) phase = stopped ? 'idle' : 'active';
		else if (phase === 'gather' && character.map === CFG.keeper.map && dist(character, CFG.keeper) <= CFG.stageWithin) phase = 'staged';
		if (phase !== was) { clog('phase -> ' + phase, '#7FD1FF'); ev('phase', { from: was, to: phase }); }
		if (leaving) { leaving = false; if (mode === 'cave') { leftCave(); if (!alive()) return; } }
		if (phase === 'staged' && isLeader()) {
			const b = gateReport();
			throttleLog(b.length ? 'staged, BLOCKED: ' + b.join(' | ') : 'staged and clear - caveEnter() when ready');
		}
		bump('ticks');
		if (engaged()) bump('engagedTicks');
		if (cavePaused()) bump('pausedTicks');
		objRecon();             // read-only; cheap, throttled, inside only
		objButtonRecon();       // read-only; runs once
		deathTick();            // before anything that returns early on rip
		potionTick();
		partyTick();
		lootTick();
		exitTick();
		cryptTick();            // v32 - bookkeeping only; the move is in moveTick
		dieTick();
		launcherTick();
		senseTick();            // beacon out, trouble + leash in - before anything moves
		tickStep = 'moveTick';
		await bounded(moveTick(), 'moveTick');
		tickStep = 'combatTick';
		await bounded(combatTick(), 'combatTick');
		tickStep = 'idle';
		telFlush();
	} catch (e) { bump('exceptions'); ev('exception', String(e)); clog('tick: ' + e, 'red'); }
	if (alive() && gen === tickGen) setTimeout(tick, CFG.tickMs);
}
/* NO AWAIT HOLDS A TICK FOREVER, AND A STALLED LOOP IS RESTARTED - v35. On the
   2026-11-08 crypt run MageofOz's tick counter stood still while she lay dead,
   no exception and no log line: an awaited call - most likely a smart_move in
   flight when she died - never settled, and the chain ended there. So each
   awaited step resolves after CFG.awaitMaxMs whatever it is waiting on, and the
   watchdog below starts a new loop when no tick has begun for tickStallMs. The
   generation number stops a stalled tick that does resume from running a
   second loop beside the new one. */
let tickGen = 0, tickAt = 0, tickStep = 'idle', boundSaid = 0;
function bounded(p, label) {
	let timer = null;
	const out = new Promise((res) => {
		timer = setTimeout(() => {
			bump('awaitTimeouts');
			if (Date.now() - boundSaid > 60000) { boundSaid = Date.now(); clog(label + ' did not settle in ' + Math.round(CFG.awaitMaxMs / 1000) + 's - the tick goes on without it', 'red'); }
			ev('awaitTimeout', { step: label });
			res();
		}, CFG.awaitMaxMs);
	});
	/* A rejection still reaches the tick's own catch - only a hang is cut short. */
	return Promise.race([Promise.resolve(p), out]).then(() => { clearTimeout(timer); }, (e) => { clearTimeout(timer); throw e; });
}
function tickWatch() {
	if (!alive()) return;
	const now = Date.now();
	if (tickAt && now - tickAt > CFG.tickStallMs) {
		tickGen++; tickAt = now;
		bump('tickRestarts');
		clog('the tick loop stalled ' + Math.round(CFG.tickStallMs / 1000) + 's+ in ' + tickStep + ' - restarting it', 'red');
		ev('tickRestart', { step: tickStep });
		setTimeout(tick, 0);
	}
	setTimeout(tickWatch, 5000);
}
function voteLoop() { try { voteTick(); } catch (e) { clog('vote: ' + e, 'red'); } if (alive()) setTimeout(voteLoop, CFG.voteTickMs); }

clog((caveVersion() ? 'v' + caveVersion() : 'version unread') + ' loaded as ' + role() + ' (' + character.name + '/' + character.ctype + ' speed ' + character.speed
	+ '). Leader ' + leaderName() + '. caveDry() to rehearse on-map, caveGo() for a real run, caveLead(name) to retarget.', '#7FD98A');
telCensus();
telHook();
hookPartyInvite();
ev('load', { ver: caveVersion(), build: caveBuild(), leader: leaderName(), role: role(), speed: character.speed, range: character.range,
	missing: Object.keys(tel.helpers).filter((k) => tel.helpers[k] === 'undefined') });
/* v32: a crypt run survives a reload; the cave launcher then stays out of
   it, since launcherStart() only runs in cave mode. */
if (cryptAutoSaved(Date.now())) cryptRun();
tick();
setTimeout(tickWatch, 5000);
voteLoop();
launcherStart();

// === GAMELOG BEGIN === byte-identical in Party/Ranger.js, Party/Priest.js,
// Party/Mage.js, Party/Merchant.js and CaveRun.js; Tests/suite_gamelog.js
// holds them to it.
/* EVERY GAME LOG LINE TO A FILE ON THE BRIDGE. Operator's request 2026-10-24:
   the game keeps 480 lines and then cuts to the newest 160, and the evidence
   for that morning's spookytown door diagnosis existed only in that
   scrollback.

   THE CAPTURE LIVES IN THE PAGE, THE SENDER IN THIS SCRIPT. parent.add_log is
   the game's one log writer: the client's own messages, the default
   server-message handler and every script's game_log() all reach it. The
   wrapper and its buffer are built with the PAGE's Function, so a runner
   restart, which destroys this iframe, leaves them working, and each load
   just picks the buffer up and drains it. The party scripts' log filter
   replaces the server-message listener and writes the line itself, so it calls
   capture() directly - without that, every server message would be missed
   while the filter runs.

   NOTHING IS LOST TO A HOP OR A BRIDGE OUTAGE, UP TO `keep` LINES. A failed
   POST leaves its lines in the buffer, and the page saves whatever is unsent
   to localStorage as it unloads, keyed by character because that storage is
   shared by every character in the browser. Each line carries the page's start
   time and a sequence number, so a batch sent twice can be told apart at read
   time.

   WHAT THE FILE DOES NOT GET LINE BY LINE - the operator's rulings of
   2026-10-25. The screen is untouched by all of it; only the file changes.
   - The pathfinder's "Searching for a path...", "Path found!" and "Path not
     found!" become one count row a minute.
   - The party broadcasts "<X> killed a <Y>" and "N gold" become one row a
     minute per character: each monster killed with its count, and the
     window's loot gold as one total, because the gold line names no monster.
     A kill counts only on the killer's own row and the others drop it, since
     every member receives the broadcast. The gold line is this member's own
     share, sent to each member separately: the server splits a chest by
     `share`, which is equal across one account's characters, so the party's
     loot is the SUM of the rows and equal figures on all three are expected.
     Only lines the GAME wrote are summarised, never our own game_log().
     "Received N gold" is a different line and is kept.
   - A line a script sends through gamelogScreenOnly() is shown and not kept.
   - A line matching a rule a script registered with gamelogFileOnChange() is
     kept only when its text differs from the last one kept under that rule,
     remembered across hops.
   The open minute is written out before the page unloads, so a hop loses
   none of it. `v` rebuilds a page state left by an older build, which would
   otherwise outlive a runner restart and go on capturing the old way. */
const GAMELOG = {
	base: 'http://127.0.0.1:8787', path: '/gamelog',
	everyMs: 3000, batch: 400, keep: 600, timeoutMs: 5000,
	unsentKey: 'gamelog_unsent_', seenKey: 'gamelog_seen_', minuteMs: 60000, v: 4,
};

/* Evaluated in whichever realm builds it - the page's by preference. Plain
   ES5 on purpose, since it is a string that is never parsed by our tooling. */
function gamelogPageSource() {
	return [
		'var TS = /^\\d{1,2}:\\d{2}:\\d{2} \\| /;',
		'var st = { v: ver, realm: realm, buf: [], dropped: 0, seq: 0, page: Date.now(), src: null, quiet: false,',
		'  sent: 0, flushingSince: 0, lastOk: 0, lastErr: null, restored: false, orig: P.add_log,',
		'  rules: {}, seen: null, seenFor: null, win: null };',
		'st.fresh = function () { return { start: 0, kills: {}, gold: 0, golds: 0, pfn: 0,',
		'  pf: { searching: 0, found: 0, not_found: 0 } }; };',
		'st.win = st.fresh();',
		'st.row = function (message, color, source, extra) {',
		'  var c = P.character || {};',
		'  var r = { page: st.page, seq: ++st.seq, t_script: Date.now(), character: c.name || null,',
		'    server: ((P.server_region || "") + (P.server_identifier || "")) || null, map: c.map || null,',
		'    color: color, message: message, source: source };',
		'  if (extra) for (var k in extra) r[k] = extra[k];',
		'  st.buf.push(r);',
		'  if (st.buf.length > keep) { st.dropped += st.buf.length - keep; st.buf.splice(0, st.buf.length - keep); }',
		'};',
		'st.roll = function (now, force) {',
		'  var w = st.win;',
		'  if (!w.start || (!force && now - w.start < minuteMs)) return false;',
		'  st.win = st.fresh();',
		'  var end = force ? now : w.start + minuteMs;',
		'  var names = Object.keys(w.kills).sort(), parts = [];',
		'  for (var i = 0; i < names.length; i++) parts.push(names[i] + " " + w.kills[names[i]]);',
		'  if (parts.length || w.golds) st.row("[minute] kills: " + (parts.join(", ") || "none") + " | own share of loot gold " + w.gold',
		'    + " (" + w.golds + " drops)", null, "summary", { kind: "party_minute", window_start: w.start,',
		'    window_end: end, kills: w.kills, gold: w.gold, gold_drops: w.golds });',
		'  if (w.pfn) st.row("[minute] pathfinder: searching " + w.pf.searching + ", found " + w.pf.found',
		'    + ", not found " + w.pf.not_found, null, "summary", { kind: "pathfinder_minute", window_start: w.start,',
		'    window_end: end, pathfinder: w.pf });',
		'  return true;',
		'};',
		'st.tally = function (body, source, now) {',
		'  var w = st.win, m = /^(Searching for a path|Path found|Path not found)/.exec(body);',
		'  if (m) {',
		'    if (!w.start) w.start = now;',
		'    w.pf[m[1] === "Path found" ? "found" : m[1] === "Path not found" ? "not_found" : "searching"]++;',
		'    w.pfn++;',
		'    return true;',
		'  }',
		'  if (source !== "game") return false;',
		'  m = /^(\\S+) killed (?:(?:a|an|the) )?(.+?)\\s*$/.exec(body);',
		'  if (m) {',
		'    if (m[1] !== "You" && m[1] !== ((P.character && P.character.name) || "")) return true;',
		'    if (!w.start) w.start = now; w.kills[m[2]] = (w.kills[m[2]] || 0) + 1; return true;',
		'  }',
		'  m = /^([\\d,]+) gold\\s*$/.exec(body);',
		'  if (m) { if (!w.start) w.start = now; w.gold += parseInt(m[1].replace(/,/g, ""), 10) || 0; w.golds++; return true; }',
		'  return false;',
		'};',
		'st.watch = function (name, source, flags) {',
		'  try { st.rules[name] = new RegExp(source, String(flags || "").replace(/g/g, "")); } catch (e) {}',
		'};',
		'st.changed = function (body) {',
		'  for (var n in st.rules) {',
		'    if (!st.rules[n].test(body)) continue;',
		'    var who = (P.character && P.character.name) || "";',
		'    if (st.seenFor !== who) {',
		'      st.seenFor = who; st.seen = {};',
		'      try { st.seen = JSON.parse(P.localStorage.getItem(seenKey + who) || "{}") || {}; } catch (e) {}',
		'    }',
		'    if (st.seen[n] === body) return false;',
		'    st.seen[n] = body;',
		'    try { if (who) P.localStorage.setItem(seenKey + who, JSON.stringify(st.seen)); } catch (e) {}',
		'    return true;',
		'  }',
		'  return true;',
		'};',
		'st.capture = function (message, color, source) {',
		'  try {',
		'    if (st.quiet) return;',
		'    var now = Date.now();',
		'    st.roll(now, false);',
		'    var m = message;',
		'    if (m !== null && typeof m === "object") { try { m = JSON.stringify(m); } catch (e) { m = "[object]"; } }',
		'    m = String(m);',
		'    var src = source || st.src || "game", body = m.replace(TS, "");',
		'    if (st.tally(body, src, now)) return;',
		'    if (!st.changed(body)) return;',
		'    st.row(m, color == null ? null : String(color), src);',
		'  } catch (e) {}',
		'};',
		'P.add_log = function (message, color) { st.capture(message, color, null); return st.orig.apply(this, arguments); };',
		'P.add_log.__gamelog = true;',
		'try {',
		'  P.addEventListener("pagehide", function () {',
		'    try { st.roll(Date.now(), true); } catch (e) {}',
		'    try {',
		'      var n = P.character && P.character.name;',
		'      if (n && st.buf.length) P.localStorage.setItem(unsentKey + n, JSON.stringify(st.buf.slice(-keep)));',
		'    } catch (e) {}',
		'  });',
		'} catch (e) {}',
		'return st;',
	].join('\n');
}

/* Returns the page's capture state, building it if absent. A state built in a
   CODE iframe (the page refused its Function) may outlive that iframe, and one
   from an older build would go on capturing the old way, so either is rebuilt
   on the next load, carrying its lines and its open minute over; a current
   page-realm one is reused as it is. */
function gamelogInstall() {
	let P = null;
	try { P = parent; } catch (e) { return null; }
	if (!P || typeof P.add_log !== 'function') return null;
	let st = P.__gamelog || null;
	if (st && st.realm === 'page' && st.v === GAMELOG.v) return st;
	if (st && typeof st.roll === 'function') { try { st.roll(Date.now(), true); } catch (e) { } }
	const carry = (st && Array.isArray(st.buf)) ? st.buf : [];
	const rules = (st && st.rules) || null;
	if (st && typeof st.orig === 'function' && P.add_log && P.add_log.__gamelog) P.add_log = st.orig;
	if (st) st.buf = [];   // its own pagehide handler then saves nothing over ours
	const src = gamelogPageSource();
	const args = ['P', 'keep', 'realm', 'unsentKey', 'seenKey', 'minuteMs', 'ver', src];
	let make = null, realm = 'page';
	try { make = P.Function.apply(null, args); }
	catch (e) { make = Function.apply(null, args); realm = 'code'; }
	st = make(P, GAMELOG.keep, realm, GAMELOG.unsentKey, GAMELOG.seenKey, GAMELOG.minuteMs, GAMELOG.v);
	if (carry.length) st.buf = carry.concat(st.buf).slice(-GAMELOG.keep);
	if (rules) for (const n in rules) { try { st.watch(n, rules[n].source, rules[n].flags); } catch (e) { } }
	P.__gamelog = st;
	return st;
}

/* Marks our own game_log() lines as `script` rather than `game`. Wraps the
   runner's game_log once per CODE context. */
function gamelogMarkScript() {
	try {
		if (typeof game_log !== 'function' || game_log.__gamelog) return false;
		const inner = game_log;
		const wrapped = function () {
			let st = null;
			try { st = parent.__gamelog || null; } catch (e) { }
			if (st) st.src = 'script';
			try { return inner.apply(this, arguments); } finally { if (st) st.src = null; }
		};
		wrapped.__gamelog = true;
		window.game_log = wrapped;
		return true;
	} catch (e) { return false; }
}

/* Runs fn with the capture off: whatever it logs is shown and not kept. */
function gamelogQuietly(fn) {
	let st = null;
	try { st = parent.__gamelog || null; } catch (e) { }
	if (st) st.quiet = true;
	try { return fn(); } finally { if (st) st.quiet = false; }
}

/* game_log() for a line that belongs on the screen and not in the file. */
function gamelogScreenOnly(message, color) {
	return gamelogQuietly(() => game_log(message, color));
}

/* Lines matching `source` (a RegExp source string, built in the page) reach
   the file only when their text changed since the last one kept under `name`.
   A string rather than a RegExp, because a RegExp made here belongs to this
   iframe and the capture outlives it. */
function gamelogFileOnChange(name, source, flags) {
	const st = gamelogInstall();
	if (!st || typeof st.watch !== 'function') return false;
	st.watch(name, source, flags);
	return !!st.rules[name];
}

function gamelogName() {
	try { return (character && character.name) || null; } catch (e) { return null; }
}

/* The lines a hop unloaded before they were sent, put back in front of
   anything captured since. Read once per page, by name. */
function gamelogRestore(st, name) {
	try {
		const key = GAMELOG.unsentKey + name;
		const raw = parent.localStorage.getItem(key);
		if (!raw) return 0;
		parent.localStorage.removeItem(key);
		const old = JSON.parse(raw);
		if (!Array.isArray(old) || !old.length) return 0;
		st.buf = old.concat(st.buf).slice(-GAMELOG.keep);
		return old.length;
	} catch (e) { return 0; }
}

function gamelogPost(body) {
	if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
	const o = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(() => { try { ac.abort(); } catch (e) { } }, GAMELOG.timeoutMs);
	}
	return fetch(GAMELOG.base + GAMELOG.path, o).then(
		(r) => { if (stop) clearTimeout(stop); return r.json(); },
		(e) => { if (stop) clearTimeout(stop); throw e; });
}

/* One batch. Lines leave the buffer only once the bridge has them, and by
   identity rather than by position, because the capture trims the front of
   the buffer when it is full and may have done so while the POST was out. A
   flush older than twice the timeout is taken as abandoned - its iframe was
   destroyed mid-await - so it cannot block the next script for ever. Each
   call also closes a minute that has run out, so a quiet one is still
   written within a flush of its end. */
async function gamelogFlush() {
	const st = gamelogInstall();
	if (!st) return 'not installed';
	const now = Date.now();
	try { st.roll(now, false); } catch (e) { }
	if (st.flushingSince && now - st.flushingSince < 2 * GAMELOG.timeoutMs) return 'busy';
	const name = gamelogName();
	if (name && !st.restored) { st.restored = true; gamelogRestore(st, name); }
	if (!st.buf.length) return 'empty';
	const lines = st.buf.slice(0, GAMELOG.batch);
	const dropped = st.dropped;
	st.flushingSince = now;
	try {
		const r = await gamelogPost({ lines: lines, dropped: dropped });
		if (r && r.ok) {
			const out = new Set(lines);
			st.buf = st.buf.filter((l) => !out.has(l));
			st.sent += lines.length;
			st.dropped = Math.max(0, st.dropped - dropped);
			st.lastOk = Date.now();
			st.lastErr = null;
			return 'sent';
		}
		st.lastErr = (r && r.error) || 'refused';
		return 'refused';
	} catch (e) {
		st.lastErr = String((e && e.message) || e);
		return 'failed';
	} finally {
		st.flushingSince = 0;
	}
}

/* The console view: what is waiting, what was lost, when the bridge last took
   a batch, and the minute still open. Read-only. */
function gamelogStatus() {
	let st = null;
	try { st = parent.__gamelog || null; } catch (e) { }
	if (!st) return { installed: false };
	const w = st.win || {};
	return {
		installed: true, v: st.v || 1, realm: st.realm, buffered: st.buf.length, dropped: st.dropped, sent: st.sent,
		lastOk: st.lastOk ? new Date(st.lastOk).toISOString() : null, lastErr: st.lastErr,
		minuteOpen: w.start ? new Date(w.start).toISOString() : null,
		changeRules: Object.keys(st.rules || {}),
	};
}

function gamelogStart() {
	gamelogInstall();
	gamelogMarkScript();
	try { if (window.__gamelogTimer) clearInterval(window.__gamelogTimer); } catch (e) { }
	try { window.__gamelogTimer = setInterval(() => { gamelogFlush().catch(() => { }); }, GAMELOG.everyMs); } catch (e) { }
}
gamelogStart();
// === GAMELOG END ===
window.gamelogStatus = gamelogStatus;

})();
