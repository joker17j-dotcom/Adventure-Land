// ============================================================================
// FamilyFleet - one script, four characters, one account
// ============================================================================
// Three rangers farm and hold a shard each; one merchant roams the rotation,
// runs the kiss event, and drives the account's gear economy through the bank.
//
// THE SCOUTING IS GONE, removed 2026-10-03 at the owner's request: no stand
// scanning, no bridge client, no posting of findings, and no town trip made for
// the sake of a scan. What is left of the old scout layer is the part the rest
// of the file still uses - shard helpers, the NPC lookup, and the Ponty read
// that feeds pontyBuy. Town trips still happen for potions, compounding and the
// bank window, which is what they were always for besides the scan.
//
// A SWAPPED-OUT PIECE IS BANKED ON THE SPOT, added 2026-10-08 at the owner's
// request. equip() is a swap: when the slot was already filled, the piece
// coming off lands in the bag. It used to land there too late to be banked -
// bankDepositSpares has already run by then - and sellSurplus, on the way out
// of the window, vendored it whenever bankWantsMore said the bank had enough
// copies. That is the wrong verdict for this item in particular: a piece a
// ranger has just outgrown is either an upgrade for a sibling or the interim
// one somebody wears until their own catches up. Neither is surplus. It is now
// stored in the same breath as the equip, the copy limit gets no vote, and
// shouldSell refuses anything displaced this window even if that store failed -
// a full bank must not quietly become a sale.
//
// There is deliberately NO messaging between characters. They live on separate
// shards, so send_cm cannot reach them and there is no bridge relay on this
// account. Every schedule below is therefore derived from the wall clock and
// from the character's own index in CONFIG.characters - never negotiated. Two
// characters must never want the bank at the same moment, and the only way to
// guarantee that without talking is to give each a fixed slice of the hour.
//
// CHARACTER NAMES APPEAR EXACTLY ONCE, in CONFIG.characters. Adding a person
// means adding rows there and nothing else: role and bank slot are both derived
// from that list.
// ============================================================================

const CONFIG = {

	// ---------------------------------------------------------------- roster
	// The ONLY place names appear. Order matters: it fixes each character's
	// bank window (index 0 gets :00, index 1 gets :05, and so on), which is
	// what keeps two of them from walking into the bank together.
	characters: {
		LorienSwifty: { role: 'ranger' },
		BranSwifty: { role: 'ranger' },
		CassySwifty: { role: 'ranger' },
		IKnowAGuy: { role: 'merchant' },
	},


	/* How long one tick may hold the movement lock before it is forced open.

	   Has to clear the longest legitimate hold, and that is the bank run: it
	   walks to the bank map, deposits gold, runs three gear passes, walks back
	   to town and sells surplus, with no internal bound. bank.windowMs is four
	   minutes and nothing enforces even that on the run itself, so a ceiling
	   under it would interrupt real bank runs - which is worse than the stall
	   it is meant to cure. Eight minutes leaves room and still bounds a wedged
	   character to one window rather than forever. */
	lockCeilingMs: 8 * 60 * 1000,

	// ------------------------------------------------------------- the bank
	bank: {
		// Minutes past the hour for index 0; each later character is offset by
		// stagger. Four characters at 5 minutes apart occupy :00 :05 :10 :15,
		// leaving the rest of the hour clear.
		firstWindowMinute: 0,
		staggerMinutes: 5,
		// How long a character may consider the bank "its turn". Generous
		// enough to walk in, work and walk out; short enough that a stuck
		// character frees the slot before the next one arrives.
		windowMs: 4 * 60 * 1000,
		// Rangers deposit everything above this. The merchant's rule is the
		// mirror of it - see merchant.goldFloor.
		rangerKeepGold: 10000000,
		map: 'bank',
	},

	/* Named `scout` for its history rather than its job: the scouting was removed
	   on 2026-10-03 and what survives here is the town geometry everything else
	   navigates by, plus the Ponty settings. Renaming it would touch every call
	   site for no behavioural gain, so the name stays and this note explains it. */
	scout: {
		// Rangers hold one shard each and never hop. The merchant roams.
		// How close to townSpot still counts as standing there. Used for the NPC
		// transactions only - buying, selling, upgrading, Ponty - where the range
		// is the NPC's, not ours. A plain radius is right for "am I there".
		townSpotRadius: 60,
		/* The old stand region, still the definition of "in town".

		   It outlived the scanning because inTown() is what parkFull and the bank
		   window test, and `main` is also where goo and crabx are farmed - so "on
		   the main map" was never specific enough. The box keeps the test honest:
		   can I see the whole town area from here, rather than am I on its map.
		
		   The numbers are the observed cluster padded by about 100 each way. One
		   sample put six stands inside x -147..161, y -110..92; the other session
		   was explicit that this is a snapshot rather than a stable distribution,
		   so the padding is doing real work and this is a knob, not a constant. */
		standRegion: { minX: -250, maxX: 260, minY: -210, maxY: 190 },
		/* THE TOWN SPOT. Measured and tested live by the other session against
		   game data 17083 - not derived, and not guessed from the snapshot.
		
		   It is the centre of the smallest circle enclosing Lucas, Cue, Gabriel
		   and Ponty, radius 286.05. Lucas and Ponty are 572.1 apart and form the
		   diameter; Cue and Gabriel fall inside without constraining it. So no
		   point in town beats 286 on the worst-case NPC distance.
		
		   Verified working from exactly here: buy from Gabriel (129.4), buy from
		   Lucas (286.0), upgrade at Cue (150.6), Ponty replied with 225 items
		   (286.1), and all six visible stands inside the vision box.
		
		   IF THE NPC SET CHANGES, recompute the smallest enclosing circle rather
		   than nudging this point - the binding pair may change. */
		townSpot: { map: 'main', x: -179, y: -72 },
		/* Who this spot is chosen to reach, and what for. Positions are from
		   G.maps.main.npcs and are here for the re-optimisation above, not for
		   navigation - nothing walks to them individually. */
		townNpcs: {
			scrolls:     { name: 'Lucas',   at: [-464, -96],  for: 'scroll0-2, cscroll0-2' },
			newupgrade:  { name: 'Cue',     at: [-207, -220], for: 'upgrade and compound' },
			basics:      { name: 'Gabriel', at: [-89, -165],  for: 'basic gear, and selling' },
			secondhands: { name: 'Ponty',   at: [106, -47],   for: 'secondhand listings' },
			fancypots:   { name: 'Ernis',   at: null,         for: 'potions' },
		},
		pontyEveryMs: 10 * 60 * 1000,
		pontyTimeoutMs: 8000,
		// Logs the field names in Ponty's first reply, once per read. Worth
		// having on while the price mapping is being confirmed; noise once it is.
		debugPonty: true,
		skipServers: ['PVP'],
	},

	// ----------------------------------------------------------- the hopping
	hop: {
		// Only the merchant hops. One per hour is the user's rule.
		//
		// HOP SICKNESS - measured, and NOT what an earlier read of the server
		// source said. node/server_functions.js declares serverhop_logic TWICE
		// (lines 928 and 982). The later declaration wins, so the first one -
		// with its hop counting, four-hour window and escalating -20/-30/-40/
		// -60/-80 tiers - is dead code. The live rule is the short one:
		//
		//   arriving on a server != player.p.home, at level >= 60, off PVP
		//   -> add_condition(player, 'hopsickness'), flat, from G:
		//      luck -80, gold -80, xp -80, output -20, for 720000ms (12 min)
		//
		// There is no mild band and no tapering. Every hop away from home is the
		// full penalty. Corroborated from the live datastore (game 17083):
		// G.conditions.hopsickness carries exactly those values and that
		// duration, which only makes sense if add_condition is what applies it.
		//
		// Two consequences for this fleet:
		//   - The gate is p.home, not time-spent. Coming back to home clears it
		//     immediately, because the same function deletes the condition before
		//     deciding whether to re-add it.
		//   - The gold -80 still does NOT touch trade income. It reaches goldm,
		//     which is only ever applied to chest loot. A scouting merchant is
		//     not farming, so luck/gold/xp cost it nothing real.
		minIntervalMs: 60 * 60 * 1000,
		// The one thing that DOES cost: G's own explanation says hop sickness
		// "blocks kiss rewards". So a sick merchant that walks the kiss event
		// spends the trip and collects nothing. Skip the kiss while sick rather
		// than discovering it as a silently missing reward.
		skipKissWhileSick: true,
		// Below this level the condition is never applied at all, so none of the
		// above matters. Merchants gain xp from buying and selling, so a scout
		// merchant drifts toward this on its own - the guard is written now so
		// that crossing it is a behaviour change rather than a surprise.
		sicknessMinLevel: 60,
		// set_home is the gate itself, not a cure, which makes it worth more
		// than it first looked - but server.js:4783 allows it once per 36 HOURS
		// (fail reason 'sh_time'). So it cannot follow the hop cycle. Attempted
		// opportunistically: if it takes, home moves; if it returns sh_time, we
		// note the hours and stop asking until then.
		//
		// G also says "Bean in Mainland can change your home" - an NPC route
		// distinct from the set_home call. Whether Bean shares the 36h cooldown
		// is unknown; the server source does not show a Bean re-home handler at
		// all, and that source has already proven stale here.
		trySetHome: true,
		setHomeCooldownMs: 36 * 60 * 60 * 1000,
	},

	// ------------------------------------------------------------ the ranger
	ranger: {
		// Only these two, in this order of preference. goo is the starter spot;
		// crabx is the graduation.
		spots: {
			goo:   { map: 'main', monster: 'goo' },
			crabx: { map: 'main', monster: 'crabx' },
		},
		// "Comfortably farming crabx" needs a number, so: survive the pack
		// indefinitely with headroom, and be able to kill inside a sane window.
		// Both are measured against live stats each time, not decided once.
		/* COOPERATIVE BOSSES - join, never open. -> COOPERATIVE BOSSES */
		coopBosses: {
			enabled: true,
			// Below this much health, leave it alone: a boss somebody else is
			// holding is still a boss, and the credit is not worth the trip back.
			minHpFraction: 0.6,
			// Names refused even when the game flags them cooperative.
			// abtesting is team PvP with a join window, not a boss.
			/* slenderman added 2026-10-11 at the owner's instruction, and it was
			   not just a wasted trip - it STOPPED THE RANGERS FARMING. Measured
			   from the deployed data: G.monsters.slenderman.cooperative is true,
			   so bossPick() selects him whenever he is live. bossTick then sets
			   the trip and returns TRUE, which makes farmTick return at its
			   `if (await bossTick()) return;` - so nothing below it ever runs.
			   And the trip can never progress, because bossWalkTarget(name) has
			   no position to offer for him: parent.S.slenderman carries only
			   { name, map } where every other boss also sends x/y, he is not in
			   BOSS_JOIN_SPOTS, and monsterSpawn('main', ...) cannot help because
			   he lives on cave/halloween/spookytown. So the character logs "no
			   position known for slenderman - cannot travel" every tick and does
			   nothing else until maxTripMs (20 min) expires, then repeats after
			   cooldownMs. Excluding him here blocks BOTH paths that read this
			   list - bossEligible() for the trip and coopBossInReach() for the
			   in-reach swing - and the opportunity block below is what still
			   takes a shot at him when he turns up on his own.
			   -> Slenderman: hits of opportunity */
			exclude: ['abtesting', 'slenderman'],

			/* TRAVEL, added 2026-10-03 at the operator's instruction. The ATTACK
			   rule above is unchanged and still Ranger.js's: somebody else must
			   already be on it. Travelling and swinging are separate decisions, so
			   a boss nobody has engaged is one this character goes to, stands at,
			   and does not open - the caps below are what end that standoff. */
			/* STAND-OFF, added 2026-10-11 with goo brawl. How far OUTSIDE a boss's
			   own attack range to stand before swinging. -> bossStandOff */
			standOff: true,
			standOffMargin: 25,

			travel: true,
			maxTripMs: 20 * 60 * 1000,
			maxDeaths: 2,
			// After giving up, leave it alone this long. Without it the character
			// walks straight back to the boss that just outlasted it.
			cooldownMs: 30 * 60 * 1000,
		},

		/* FARM RANKING - stand where the WORN gear gets better.
		   -> FARM RANKING */
		farmRanking: {
			enabled: true,
			/* MAPS, derived from 2026-10-11 - null means "every map the game says
			   is farmable", which is Ranger.js's own test ported verbatim:
			   not pvp, not instance. -> isMapSafeForFarming

			   This used to be the hand-list ['main'], written 2026-10-03 with the
			   same brief that removed the scanning. It was not a leftover of the
			   scout layer - it was a deliberately conservative start, on the
			   grounds that the safety test cannot tell a hard monster from an
			   unreachable one. That reasoning was right and is now handled
			   properly rather than avoided: the pvp/instance flags do the
			   admitting, and travelBlacklist does the "cannot get there" half.

			   Measured 2026-10-11: the test admits 43 of 54 maps, 27 of them
			   carrying monsters, for 136 packs against the 41 that ['main'] saw.
			   It rejects 11 - all ten instance maps plus arena, which carries
			   pvp. Set an explicit array here to go back to a hand-list. */
			maps: null,

			/* Never ranked, whatever the numbers say.

			   booboo, mummy and d_wiz added 2026-10-11 with the map opening, and
			   they are the ONLY reason it is safe. Measured across the admitted
			   set: exactly four packs carry a `rage` rectangle, and in all four
			   the boundary CENTRE - which is the standing point farmCandidates
			   hands out - sits inside it. This file has no rage geometry at all,
			   so ranking one of those means walking to the middle of a rage box,
			   which on the main account cost three deaths and zero kills at
			   booboo's (415,-702). Both pure-damage packs in the admitted set are
			   also these booboos.

			   REMOVE THESE THREE ONLY WITH a rectangle-aware standing point and
			   one-at-a-time pulling. -> CLAUDE.md, "RAGE BOXES" in Ranger.js */
			never: ['phoenix', 'mrpumpkin', 'mrgreen', 'grinch', 'snowman',
			        'booboo', 'mummy', 'd_wiz'],

			/* A spot that cannot be walked to is blacklisted for this long and
			   then tried again. Ranger.js admits unreachable maps too and leans
			   on its blacklist to find that out; this is the small version of
			   the same idea, and WITHOUT IT opening the maps would wedge a
			   ranger: chooseSpot caches its pick for crabxReady.checkEveryMs and
			   would retry an unreachable top-ranked spot forever.
			   -> travelBlacklist */
			unreachableMs: 60 * 60 * 1000,
			unreachableStrikes: 3,
			/* Refuse pure damage outright rather than modelling it: it ignores
			   armour and resistance, so the survival margin would be computed
			   against a defence that does not apply. */
			refusePure: true,
			// How long to stay quiet after reporting that nothing qualified.
			quietMs: 15 * 60 * 1000,
			/* THE FALLBACK, by the operator's instruction 2026-10-03: crab, not
			   goo and not crabx. When nothing safe advances the plan the answer
			   is the safest thing on the board. */
			fallback: { map: 'main', monster: 'crab' },
		},

		/* ACHIEVEMENTS - OFF. Turn on with achvOn().

		   Ported from Ranger.js 2026-10-11 so the family member can grind kill
		   achievements when they want to. Ranger ships this ON with a 22-entry
		   queue; here it is OFF with a single record, which is what the owner
		   asked for. Add entries in Ranger's shape - { m, map, x, y, rung, also }
		   - and remember the saved position is an INDEX, so achvReset(n) after a
		   reorder.

		   WHAT TURNING THIS ON DOES, and it is not a small thing. The queue sets
		   an OVERRIDE that replaces the farm scorer's pick, and that override
		   deliberately bypasses farmRanking.never AND crabxReady.refusePure for
		   the queued monster. booboo is on the never-list and is pure damage;
		   both refusals exist for the unattended case, and this is the operator
		   saying "I know, do it anyway". What keeps it safe instead is the rage
		   machinery: pull.concurrent 1, the rage guard, and a route that never
		   crosses a rectangle. If you turn this on with pull.enabled false, you
		   have removed the safety and kept the danger.

		   rung is a threshold out of G.monsters[m].achievements[0][0], and
		   reading progress needs a TRACKER in the bag - without one achvTick
		   says so once and the queue cannot advance. rung null means run until
		   achvOff() or achvStop(), which is why this entry never reaches a
		   second one even if you add it. */
		achievements: {
			enabled: false,
			/* Consecutive failed trips before the override is released. The
			   achievement spot is whitelisted against the travel blacklist - that
			   is the point of whitelisting it - so without this there would be no
			   way to give up on a spot that cannot be reached.
			   -> travelBlacklist, isUnreachable */
			maxTravelFailures: 10,
			refreshMs: 5 * 60 * 1000,   // how often to ask the server for a tracker
			reassertMs: 30 * 1000,      // how often to check the override is ours
			pull: {
				enabled: true,
				concurrent: 1,
				margin: 4,           // margin + step must stay <= 9 - see rageCfg
				guardMargin: 0,      // the guard trips only on a REAL breach
				step: 5,             // route-search grid, in units
				maxCells: 200000,
				parkWithin: 45,
				pullTimeoutMs: 20000,
				repullGapMs: 1200,
				respectCourage: true,
			},
			/* ONE RECORD, as asked. Coordinates and shape are Ranger's index-0
			   entry verbatim: (290,-990) is the corridor spot outside BOTH
			   spookytown rectangles - 148 from the booboo box, 140 from the
			   mummy one - reached live with zero breaches. `also` runs mummy from
			   the same spot because booboo respawns every 48s against mummy's
			   24s and would otherwise idle most of the trip; the rung still
			   tracks `m`. NOT (415,-702), which is the rage-box centre.
			   -> RANGER_SPOTS */
			queue: [
				{ m: 'booboo', map: 'spookytown', x: 290, y: -990, rung: null, also: ['mummy'] },
			],
		},

		/* MONSTER HUNT - off until you turn it on. mhOn() / mhOff() / mhStatus()
		   flip and inspect it at runtime. -> MONSTER HUNT */
		monsterHunt: {
			enabled: false,

			/* WHY THIS IS NOT DEXON'S VERSION. His picks the best hunt across a
			   party of three that talk to each other over the party link. These
			   three are alone on separate shards and never communicate, so there
			   is nothing to compare against and no one to coordinate with. The
			   only question left is the one the owner asked for: is THIS hunt
			   worth doing, or do we leave it and wait out its clock. There is
			   deliberately no rerolling and no best-pick. */

			/* THE GRIND BOUND IS SECONDS, NEVER KILL COUNT. The server sets the
			   count as (20*60*times)/(max_hp/1000)/(respawn+0.25), so it scales
			   INVERSELY with how tough the monster is: a x500 assignment is bees
			   and a x1 is an 80,000 hp skeletor. A count-based rule has the sign
			   backwards - it refuses the trivial hunt and admits the hopeless
			   one. 10 rather than Dexon's 15 because these characters are solo,
			   unattended, and have no healer. 0 disables this bound. */
			maxEstMin: 10,

			/* ERR ON THE SIDE OF SAFETY, the owner's instruction, and this is
			   where it lives. The farm spots use crabxReady.minSurvivalMargin
			   (1.5) and the owner has watched those work. A hunt target is
			   chosen by the server and never reviewed, so it is held to this
			   instead. Raise it to be more cautious, not less. */
			huntSurvivalMargin: 2.5,

			// Re-grade the held hunt this often: gear improves, and a hunt
			// refused at level 30 can become reasonable later in the same clock.
			recheckMs: 2 * 60 * 1000,
			// After taking a hunt we cannot use, wait this long before walking
			// to Daisy again - the clock has to run out first either way.
			retryMs: 5 * 60 * 1000,
			// Stop grinding one hunt after this even if it is still viable.
			huntCapMs: 25 * 60 * 1000,
			// Daisy is NOT in reach of townSpot - measured 2026-10-11, she is at
			// (126, -413), 457 units away, against 286 for the furthest NPC that
			// spot was computed to cover. So the hunt gets its own trip.
			maxDaisyTripMs: 4 * 60 * 1000,
		},

		crabxReady: {
			minLevel: 40,
			// Incoming dps from the assumed number of attackers must leave this
			// much of our own regen+potion throughput spare.
			minSurvivalMargin: 1.5,
			maxAttackers: 3,
			// Kill a single target in at most this long, or we are not really
			// farming it, we are standing next to it.
			maxSecondsToKill: 12,
			// Re-check this often; graduate once, demote if it stops being true.
			checkEveryMs: 60 * 1000,
		},
		potions: {
			// Named here rather than written into the four places that used to
			// spell them out, because the sell pass has to know what this
			// character drinks in order not to sell it.
			hp: 'hpot1',
			mp: 'mpot1',
			hpAt: 0.55,
			mpAt: 0.35,
			buyBelow: 200,
			buyTo: 500,
			// How long to farm without them after a trip that could not afford
			// any. Long enough that the gold has a chance to accumulate, short
			// enough that a character is not running dry all afternoon.
			retryMs: 10 * 60 * 1000,
		},
		// Full bag and not our bank window: park in town and wait rather than
		// dropping anything.
		freeSlotsFloor: 2,
		/* Picking up what we killed.

		   There was no loot call in this file at all until now, and the omission
		   was invisible because everything downstream of it was already written:
		   bagFull, parkFull, stuckFull and the whole bank run exist to manage a
		   full bag that nothing could ever fill. Measured before the fix: 626
		   chests on the ground around one ranger, all inside 400 units, with two
		   items in his bag.

		   range: chests drop where the monster died, which is inside attack range,
		   so this only has to cover our own kills - deliberately not a reach for
		   other people's drops. perTick caps the burst so a backlog is worked off
		   over several ticks instead of stalling one. everyMs keeps it off the
		   4s tick, since there is nothing to collect most of the time. */
		loot: {
			range: 300,
			perTick: 5,
			everyMs: 1000,
			warnEveryMs: 60 * 1000,
		},
	},

	// ---------------------------------------------------------- the merchant
	/* THE MERCHANT NEVER OPENS A STAND, AND BARELY MOVES.

	   No stand: this character is reading the market and running the account's
	   gear economy, not competing in the market. Nothing here calls open_stand
	   and nothing should - a stand would also pin it in place and make its
	   position a commitment rather than a choice.

	   Barely moves: everything it needs is reachable from scout.townSpot.
	   Lucas for scrolls, Cue for upgrades and compounds, Gabriel for basics and
	   selling, Ponty for secondhand stock, and the whole stand cluster in the
	   vision box - all from one point, measured. A character keeps its position
	   across change_server, so a merchant parked on that spot arrives on it
	   after every hop and needs no walk at all.

	   The ONLY sanctioned movement is the bank run: out to the bank map and
	   back. Anything else that moves this character is a bug, and the two
	   things that would most plausibly introduce one are walking to an NPC that
	   is already in range, and walking "back" to a spot it never left. */
	merchant: {
		// Leaving the spot is a bank trip and nothing else. Kept as a flag rather
		// than an assumption so that anything that wants to move the merchant has
		// to say so explicitly and be seen doing it.
		moveOnlyForBank: true,
		// Mirror of bank.rangerKeepGold. Below the floor the merchant draws the
		// bank down to leaveInBank; at or above it, it withdraws nothing.
		goldFloor: 10000000,
		leaveInBank: 1000000,
		kissEvent: true,
		/* Only on the home shard, as the game records it.

		   This is the operator's rule and it is a tighter one than hop
		   sickness implies. Sickness is about being AWAY from home and it
		   lapses after twelve minutes; this does not lapse - off home, there
		   is no kiss, sick or not.

		   It fails CLOSED. If home cannot be read from the client the kiss is
		   skipped rather than taken, because "we could not tell" is not the
		   same as "we are home", and the instruction was to only do this at
		   home. The field is character.home and its shape has NOT been
		   confirmed live - see TASKS.md 5e. A wrong read presents as the kiss
		   never firing, with a log line saying exactly that, rather than as it
		   firing everywhere. */
		kissHomeOnly: true,
		/* How close the featured player has to be. The live merchant uses 80
		   for the same skill; this is the same number, named here because the
		   whole kiss behaviour on this character turns on it. */
		kissRange: 80,
		/* Walk to the featured player, the way the event expects?

		   No, and this is a decision rather than an oversight. It contradicts
		   moveOnlyForBank directly - the event wants you to travel, and the
		   rule for this character is that a bank run is the only thing that
		   moves it. The movement rule wins and the kiss becomes opportunistic:
		   taken when the featured player is within reach of the town spot,
		   skipped with a line in the log when they are not.

		   Turn this on to get the live merchant's behaviour back. */
		kissMayWalk: false,
		/* Run the upgrade pass at all. A switch rather than an assumption,
		   because an upgrade spends gold on a roll whose failure cost this
		   repo has not measured - see the note above upgradePass. */
		upgrade: true,
		/* THERE IS NO LEVEL CAP. The ratchet climbs as far as the plan asks.

		   There used to be one, at 6, to stop the account spending itself into
		   the ground. Reading the game's own scroll prices against its odds
		   tables showed the cap was a second, blunter copy of a limit that was
		   already holding: expected total gold to make one finished item runs
		   32k for helmet+6 and 501k for firebow+5, but 19.1M for coat+9, 76.4M
		   for t2quiver+7, 732M for firebow+9 - and 49 BILLION for firebow+10.

		   Tier 3 is not reachable and never was. What stops it is the merchant
		   running out of gold and holding, which is the correct behaviour and
		   needs no help from a number I picked. maxScrollSpend below is the
		   only ceiling, and it is denominated in the thing that actually runs
		   out. */
		/* A floor on the odds, which nothing else expresses: a grade-2 item at
		   +6 is a 32% roll where a grade-0 one is 40%. Low, because under the
		   ratchet every staked item has already been refused by all three
		   rangers - the loss is a scroll, not gear the account needed. */
		minUpgradeChance: 0.1,
		/* The most gold one attempt may cost.

		   Scroll prices step hard with item grade: scroll0 1k, scroll1 40k,
		   scroll2 1.6M; cscroll0 6.4k, cscroll1 240k, cscroll2 9.2M. And grade
		   is per item, not per level - fury and supermittens are grade 2 from
		   +0, so every single attempt on them is a 1.6M scroll. 9.2M against a
		   10M floor would be the whole float on one roll of a 20% dice. */
		maxScrollSpend: 2000000,
		/* Require the rangers to have seen an item and left it before staking
		   it. See "offered, and declined" further down - this is the rule that
		   lets tier progression happen at all, since counting copies says no
		   whenever the count is exactly right, which is the normal state. */
		requireDeclineToStake: true,
		/* How many merchant bank windows an item must survive untouched. 1 is
		   one full pass of all three rangers. Raise to 2 if a ranger's bank run
		   failing - full bag, no path - is producing false verdicts; that makes
		   it take the same failure twice running. */
		declineCycles: 1,
		// Ponty is checked before each hop. A gear-plan item is worth buying
		// only if we can pay for it AND carry it AND do not already hold
		// enough - which is why the bank contents have to survive the hop.
		ponty: { minFreeSlots: 3 },
	},

	// ------------------------------------------------------------ gear plan
	// Lifted from Merchant.js GEAR_PROGRESSION.ranger, with TIER 1 RESTORED -
	// it is commented out there because that party is past it; this account
	// starts at the bottom.
	//
	// Tier 3 is the "never sell" set. Tier levels use the same decode as the
	// merchant's LEVEL_CODES.
	gear: {
		// How many copies of a plan item bank + worn should hold between them:
		// one per character on the account that can use it.
		copiesWanted: 3,
		// The exception: compounding consumes three to make one, so an item
		// still below its target level is allowed to stack past copiesWanted.
		// Without this the cap starves the very upgrades it exists to serve.
		compoundOverstock: true,
		/* Not gear, and not the sell pass's business.

		   The sell rule is "anything the plan does not want", which is the
		   right rule for gear and catastrophic for everything else in the bag:
		   as first written it would have sold the character's own potions, the
		   compound scrolls it had just bought, and the computer it shops from.
		   Everything here is something a character buys or is given on
		   purpose, so selling it is never the answer. */
		keepItems: [
			'computer', 'supercomputer', 'tracker',
			'cscroll0', 'cscroll1', 'cscroll2',
			'scroll0', 'scroll1', 'scroll2',
		],
	},

	/* ------------------------------------------------------------ rehearsal

	   DRY RUN. Everything that spends, sells, destroys, moves an item between
	   the bank and the bag, or changes shard is logged instead of done.

	   This exists because the first place this script can realistically be
	   rehearsed is an account it was not written for. The roster names are
	   placeholders, the gear plan is a ranger's, and sellSurplus's rule is
	   "anything the plan does not want" - which on a mixed account means
	   another class's gear. One run with dryRun on prints exactly what it
	   would have done, against real inventory, before any of it is real.

	   Reading is unaffected: it still reads Ponty and still walks. The point is
	   to see the decisions, and a dry run that does not move cannot show you the
	   decisions it makes when it arrives.

	   ONE THING IT CANNOT SHOW, because nothing actually happens: the phases
	   do not see each other. A real bank window equips an upgrade and the
	   deposit phase then sees a bag without it; in a dry run both phases read
	   the same untouched bag, so an item can appear in two lists. Read each
	   line as "what this phase would decide, given the bag as it is now",
	   not as a script of one window. */
	safety: {
		dryRun: false,
	},

	verbose: true,
};

/* A ranger's gear plan, tier 1 through 3. Tier 1 is the block commented out in
   Merchant.js - this account needs it, so it stays and is NOT synced.

   TIERS 2 AND 3 ARE MERCHANT v95's GEAR_PROGRESSION.ranger, resynced
   2026-10-11, WITH ONE DELIBERATE DIVERGENCE: tier-2 mainhand is
   bowofthedead@8 here against the merchant's @7, because the whole fleet
   already holds it at +7 and @7 would be a goal with nothing left to do. The
   two tables do not have to agree to both be right; do not "fix" this back. They had drifted on five slots at tier 2 and three at tier 3:
   mainhand firebow -> bowofthedead, chest coat -> mrnarmor, pants plain ->
   frankypants, belt dexbelt -> windbelt, gloves supermittens -> thundergrips at
   tier 2 only. Generated from Merchant.js rather than retyped, so the two
   cannot drift through a transcription slip.

   READ THE SUPPLY NOTE BELOW BEFORE TRUSTING TIER 2 - three of those new
   targets are craft-gated and this account cannot currently reach them. */
const RANGER_GEAR = [
	{
		/* RETIRED 2026-10-11, on the family's report that these are met or
		   exceeded across the fleet: mainhand (firebow@5), helmet (helmet@6),
		   chest (coat@6), shoes (shoes@6), amulet (dexamulet@2), gloves
		   (gloves@6) and both rings (dexring@2).

		   `null` rather than a deleted key, deliberately. Every reader here
		   guards with `if (!spec || !spec.item) continue`, so both spellings
		   work - but a null says "this slot has no tier-1 goal" where a missing
		   key looks like somebody forgot one. GEAR_SLOTS is read off TIER 2, so
		   a sparse tier 1 costs nothing.

		   WHAT RETIRING ONE ACTUALLY DOES: the item leaves PLAN_INDEX unless
		   another tier names it, and then isPlanItem goes false - so it is no
		   longer banked and the sell pass may vendor it. That is the point.
		   firebow, helmet, coat, gloves and dexring leave outright. shoes does
		   NOT: measured 2026-10-11, G.craft.wingedboots consumes it, so it stays
		   protected as a craft input and keeps accumulating - retiring it stops
		   the SCROLL SPEND, not the banking. dexamulet does not leave either,
		   because tiers 2 and 3 still ask for it at @4 and @5.

		   BELT (dexbelt@1) RETIRED TOO, and this is the case worth understanding
		   before anyone restores it. dexbelt is windbelt's input at level 2, and
		   it now appears in NO tier at all - so every level it is allowed to
		   reach comes from the RECIPE rather than from the plan:

		     craftRequiredLevel('dexbelt')  2   <- G.craft.windbelt
		     compoundCeiling('dexbelt')     2   <- the recipe, not any tier
		     isCraftInput('dexbelt')        true <- so the sell pass spares it

		   That only holds while windbelt is still a plan goal, which it is at
		   tiers 2 and 3. If windbelt is ever dropped from the plan, dexbelt
		   loses its ceiling AND its protection in the same edit, and the fleet
		   will quietly start vendoring belts. Before this file read recipe
		   levels, retiring this row would have stopped dexbelt compounding
		   altogether - it answered "no tier compounds this item".
		   -> craftRequiredLevel */
		earring1: { item: 'dexearring', level: 1, method: 'compound' }, helmet: null,
		earring2: { item: 'dexearring', level: 1, method: 'compound' }, amulet: null,
		mainhand: null,                                                 chest: null,
		offhand: { item: 't2quiver', level: 5, method: 'upgrade' },     cape: { item: 'bcape', level: 4, method: 'upgrade' },
		ring1: null,                                                    pants: { item: 'pants', level: 6, method: 'upgrade' },
		ring2: null,                                                    belt: null,
		orb: { item: 'orbg', level: 1, method: 'compound' },            shoes: null,
		gloves: null,                                                   elixir: null,
	},
	{
		earring1: { item: 'dexearring', level: 4, method: 'compound' },  helmet: { item: 'fury', level: 4, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 4, method: 'compound' },  amulet: { item: 'dexamulet', level: 4, method: 'compound' },
		mainhand: { item: 'bowofthedead', level: 8, method: 'upgrade' }, chest: { item: 'mrnarmor', level: 7, method: 'upgrade' },
		offhand: { item: 't2quiver', level: 7, method: 'upgrade' },      cape: { item: 'ecape', level: 7, method: 'upgrade' },
		ring1: { item: 'cring', level: 3, method: 'compound' },          pants: { item: 'frankypants', level: 6, method: 'upgrade' },
		ring2: { item: 'suckerpunch', level: 0, method: 'compound' },    belt: { item: 'windbelt', level: 2, method: 'compound' },
		orb: { item: 'orbofdex', level: 3, method: 'compound' },         shoes: { item: 'wingedboots', level: 8, method: 'upgrade' },
		gloves: { item: 'thundergrips', level: 7, method: 'upgrade' },   elixir: null,
	},
	{
		earring1: { item: 'dexearring', level: 5, method: 'compound' },  helmet: { item: 'fury', level: 8, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 5, method: 'compound' },  amulet: { item: 'dexamulet', level: 5, method: 'compound' },
		mainhand: { item: 'bowofthedead', level: 9, method: 'upgrade' }, chest: { item: 'tshirt9', level: 4, method: 'upgrade' },
		offhand: { item: 'alloyquiver', level: 9, method: 'upgrade' },   cape: { item: 'ecape', level: 9, method: 'upgrade' },
		ring1: { item: 'suckerpunch', level: 2, method: 'compound' },    pants: { item: 'frankypants', level: 7, method: 'upgrade' },
		ring2: { item: 'suckerpunch', level: 2, method: 'compound' },    belt: { item: 'windbelt', level: 4, method: 'compound' },
		orb: { item: 'orbofdex', level: 5, method: 'compound' },         shoes: { item: 'wingedboots', level: 10, method: 'upgrade' },
		gloves: { item: 'supermittens', level: 6, method: 'upgrade' },   elixir: null,
	},
];

/* SUPPLY NOTE for the resynced tiers, 2026-10-11. Matching the merchant was the
   instruction and is done; this is what it costs, because three of the new
   tier-2 targets are CRAFT-GATED and this account is nowhere near them.
   Recipes read from the deployed data, game version 17665:

     windbelt      1x dexbelt+2 + 40x stormfeather + 4x essenceofether + 300,000g
     thundergrips  1x mrngloves+6 + 80x stormfeather + 12x essenceofether + 800,000g
     bowofthedead  1x mbones + 1x bow + 120,000g

   bowofthedead is the easy one and is also sold - Ponty carried it through the
   Halloween event - so that slot is reachable.

   The other two are not, for two different reasons. Both want essenceofether,
   which the merchant's own notes record as gating eight recipes with no reliable
   source on the main account; a fresh account has none. And windbelt is flagged
   `exclusive: true` in G.items, which in this game marks an item players cannot
   trade - so Ponty and the stands are very unlikely ever to stock one, and the
   craft is the only route. I have NOT verified what `exclusive` forbids
   precisely; treat "unbuyable" as the likely reading, not a measured fact.

   WHAT THIS MEANS IN PRACTICE. The gear planner reads the lowest unmet tier per
   slot, so those slots will sit permanently unmet and the Ponty pass will keep
   looking for items it can never find. That wastes a little work, not a lot:
   nothing here stalls the way the slenderman trip did, because an unmet slot is
   a normal state in this file's design. If the chasing becomes annoying, the
   honest fix for THIS account is to keep the old targets for the three gated
   slots (firebow, dexbelt, supermittens) and let the main party's plan run
   ahead - the two tables do not have to agree to both be right. */

/* Every item named anywhere in tier 3. These are never sold to an NPC, at any
   level, even as junk - a tier-3 name in the bag is either progress or the
   raw material for it. Built from the plan rather than written out, so
   editing the plan cannot leave a stale sell-safe list behind. */
const NEVER_SELL = new Set(
	Object.values(RANGER_GEAR[2]).filter(Boolean).map((s) => s.item)
);

/* Everything that is not gear at all and must survive the sell pass.

   Kept separate from NEVER_SELL because they are different rules that happen
   to share an outcome: NEVER_SELL is "tier 3 is either progress or the raw
   material for it", derived from the plan and moving with it. KEEP_ITEMS is
   "the plan has no opinion about this and neither should the sell pass".
   Merging them would make the potion list look like part of the gear plan. */
const KEEP_ITEMS = new Set([
	CONFIG.ranger.potions.hp,
	CONFIG.ranger.potions.mp,
	...CONFIG.gear.keepItems,
]);

/* Which character am I, and what do I do? Everything role- and
   schedule-shaped is derived from CONFIG.characters so that adding a person is
   a one-line edit. */
function myName() {
	return character.name;
}

function myEntry() {
	return CONFIG.characters[myName()] || null;
}

function myRole() {
	const e = myEntry();
	return e ? e.role : null;
}

/* Position in the roster fixes the bank window. Object key order is insertion
   order for string keys, which is exactly the declaration order above - so the
   slot a character gets is visible by reading CONFIG.characters top to bottom,
   with no separate table to keep in step. */
function myIndex() {
	return Object.keys(CONFIG.characters).indexOf(myName());
}

/* Minutes past the hour when this character owns the bank. */
function myBankMinute() {
	const i = myIndex();
	if (i < 0) return null;
	return (CONFIG.bank.firstWindowMinute + i * CONFIG.bank.staggerMinutes) % 60;
}

function isMyBankWindow(now) {
	const minute = myBankMinute();
	if (minute === null) return false;
	const d = new Date(now || Date.now());
	const msIntoHour = d.getMinutes() * 60000 + d.getSeconds() * 1000;
	const start = minute * 60000;
	return msIntoHour >= start && msIntoHour < start + CONFIG.bank.windowMs;
}

// ============================================================================
// SHARD, STORAGE AND NPC LAYER
// ============================================================================
// What is left of the scout layer lifted from Codex/MerchantScout.js once the
// scanning and the bridge client were removed on 2026-10-03: session storage,
// the shard helpers, the NPC lookup, and the Ponty read that feeds pontyBuy.
//
// Adventure Land has no module system: one file per code slot, so sharing by
// import is not available and duplication is the only option. The comments come
// with it; they carry the reasons, and a copy without them is a copy nobody can
// safely change.
// ============================================================================

const SS = {
	// change_server() tears the script down and re-runs it in a browser tab, so
	// anything that must outlive a hop goes through the game's own persistent
	// CODE storage rather than a module-scope variable. Namespaced per script so
	// a scout and a fleet character sharing a browser cannot tread on each other.
	get(k, dflt) {
		try { const v = get('fleet_' + k); return v === null || v === undefined ? dflt : v; }
		catch (e) { return dflt; }
	},
	set(k, v) { try { set('fleet_' + k, v); } catch (e) { } },
};

function log(msg, color) {
	if (!CONFIG.verbose) return;
	try { game_log('[fleet] ' + msg, color || '#8b98ab'); } catch (e) { console.log('[fleet]', msg); }
}

/* The one gate every irreversible action goes through.

   Returns true when the action must NOT happen, having said what it would
   have been. Callers use it at the TOP of a pass rather than inside the loop:
   a dry run leaves the world unchanged, so a loop that skips one item and
   asks again gets the same answer forever. Compute the list, print it, stop. */
function blocked(what) {
	if (!CONFIG.safety.dryRun) return false;
	log(`DRY RUN: would ${what}`, '#E9C46A');
	return true;
}

function currentShard() {
	return { region: parent.server_region, name: parent.server_identifier };
}

/* The shard the game says is home, normalised to the same spelling shardKey
   produces. Null when it cannot be read - which is a different answer from
   "somewhere else" and is treated as one. */
function homeShard() {
	try {
		const h = character.home;
		if (!h) return null;
		if (typeof h === 'string') return h.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
		if (h.region && h.name) return shardKey(h).toUpperCase();
	} catch (e) { }
	return null;
}

/* true / false / null for unknown. The null is the whole point: a caller that
   must fail closed can tell "not home" apart from "could not tell". */
function onHomeShard() {
	const home = homeShard();
	if (!home) return null;
	return home === shardKey(currentShard()).toUpperCase();
}

function shardKey(s) { return String(s.region) + String(s.name); }

/* parent.X.servers is the page's own server list. Mainframe does not expose it,
   which is the single thing that makes multi-shard work browser-only. */
function serverList() {
	const raw = parent && parent.X && parent.X.servers;
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((s) => s && !CONFIG.scout.skipServers.includes(s.name))
		.map((s) => ({ region: s.region, name: s.name }));
}

function canHop() {
	return typeof change_server === 'function' && serverList().length > 0;
}

/* Travel to where a monster spawns, using the game's own pathfinding.

   smart_move accepts a monster name and routes to its spawn - that is the
   documented form, but it has NOT been measured against this client, so it is
   tried first and falls through rather than being relied on. A false return
   means "that did not work, use the coordinate route below it", never "there
   is nowhere to go". */
/* Where the map data says this monster spawns. Read rather than guessed, and
   null when the map has no entry - the caller then has nowhere better to be
   than where it already is, which beats walking to an arbitrary point. */
function monsterSpawn(mapName, type) {
	try {
		const m = parent.G.maps[mapName];
		for (const s of (m.monsters || [])) {
			if (s && s.type === type) {
				if (Array.isArray(s.boundary)) {
					const b = s.boundary;      // [x1, y1, x2, y2]
					return { map: mapName, x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
				}
				if (Array.isArray(s.position)) return { map: mapName, x: s.position[0], y: s.position[1] };
			}
		}
	} catch (e) { }
	return null;
}

async function goToMonster(type) {
	try {
		await smart_move({ to: type });
		return true;
	} catch (e) {
		log(`smart_move to ${type} did not take (${e && e.reason ? e.reason : e}) `
			+ `- falling back to map coordinates`, '#8b98ab');
		return false;
	}
}

async function goTo(spot) {
	if (!spot) return false;
	try {
		await smart_move({ map: spot.map, x: spot.x, y: spot.y });
		return true;
	} catch (e) {
		// e is a game rejection object, not an Error - string-concatenating it
		// prints [object Object] and throws the reason away, which is exactly
		// what the family's logs showed while their rangers were wedged.
		// goToMonster, one function above, already does this correctly.
		log('could not reach ' + (spot.map || '?') + ': '
			+ (e && e.reason ? e.reason : (e && e.message ? e.message : JSON.stringify(e))), 'orange');
		return false;
	}
}

function npcSpot(mapName, npcId) {
	const m = parent && parent.G && parent.G.maps && parent.G.maps[mapName];
	if (!m || !Array.isArray(m.npcs)) return null;
	for (const n of m.npcs) {
		if (n && n.id === npcId && Array.isArray(n.position)) {
			return { map: mapName, x: n.position[0], y: n.position[1] };
		}
	}
	return null;
}

// -------------------------------------------------------------- Ponty (NPC)
/* Ponty answers the 'secondhands' socket call only while you are standing next
   to him. The reply shape has changed across game versions, so normalise
   defensively rather than trusting one layout.

   NOTE: an earlier session crashed the whole browser tab reading this through
   parent.alert(). Never do that here - every readout goes to game_log, which is
   scoped to this character. */
function normalisePonty(data) {
	const list = Array.isArray(data) ? data
		: (data && Array.isArray(data.items) ? data.items : null);
	if (!list) return null;

	/* Still dumps the payload shape, for a different reason than it used to.

	   It was here to find the price field. THERE ISN'T ONE - settled during
	   the standalone ALData work: Ponty's socket payload carries no price at
	   all and the client computes what it paints on screen. So the dump is now
	   for the fields that DO matter and are not confirmed - rid, q, p - and
	   for which pricing function this build exposes. */
	if (CONFIG.scout.debugPonty && list.length) {
		log('Ponty raw item keys: ' + Object.keys(list[0] || {}).join(', '), '#E9C46A');
		const fns = probePricingFns();
		log('pricing-ish functions on the page: ' + (fns.join(', ') || 'none found'), '#E9C46A');
		try { console.log('[scout] Ponty raw sample:', list[0], '\npricing fns:', fns); } catch (e) { }
	}

	/* ALWAYS DERIVED. The probe over ['price','cost','g','value','gold'] that
	   used to be here was worse than useless once the payload was known to
	   carry no price: `g` is a perfectly plausible key for an item's BASE
	   value, and taking it as the asking price would have under-quoted every
	   Ponty listing by 20% - Ponty charges g x buy_to_sell x secondhands_mult,
	   which is 1.2x base. Silently, and in the direction that looks like a
	   bargain. */
	const priceOf = (it) => pontyPrice(it);

	const out = [];
	for (const it of list) {
		if (!it || !it.name) continue;
		out.push({
			name: it.name,
			level: it.level || 0,
			price: priceOf(it),
			q: it.q || 1,
			p: it.p || null,
			rid: it.rid || null,
		});
	}
	return out;
}

/* What Ponty charges, straight from the client that renders his window.

   The page can derive a LEVEL 0 price exactly - base value x buy_to_sell x
   secondhands_mult, confirmed against Dracul's Attire at 576,000 - but levelled
   items do not follow from that. Observed: Rugged Pants +1 is 1.43x its base,
   Rugged Helmet +2 is 3.08x, and Stinger +4 is only 2.21x. A +4 costing less
   than a +2 rules out any function of level alone; grade and upgrade-vs-compound
   both feed in. Rather than fit a curve to a handful of samples and quote the
   result as profit, ask the game, which is computing the exact number to paint
   "42,400 GOLD" on screen anyway.

   Function names differ across builds, so try the plausible ones and take the
   first that returns a sane number. Returns null if none exist, which leaves
   levelled items unpriced rather than wrong. */

const PRICE_FNS = [
	'calculate_item_value', 'item_value', 'calculate_value',
	'item_price', 'calculate_item_price', 'item_worth',
];
let priceFnName = null;

function gameItemValue(it) {
	/* calculate_item_value() returns what Ponty PAID for the item, not what he
	   charges - it already has buy_to_sell baked in. His asking price is that
	   times secondhands_mult. Confirmed against four independent observations:

	     throwingstars  g  72,000 -> 86,400     snowflakes  g  92,000 -> 110,400
	     mcape          g 480,000 -> 576,000    ringsj      g  24,000 ->  28,800

	   all of which are g * buy_to_sell * secondhands_mult = g * 1.2, matching
	   both the in-game display and community notes. Returning the raw value
	   would report half price and roughly double every Ponty spread. */
	const mult = (parent && parent.G && parent.G.multipliers
		&& parent.G.multipliers.secondhands_mult);
	if (typeof mult !== 'number' || !isFinite(mult)) return null;

	for (const n of PRICE_FNS) {
		const f = parent && parent[n];
		if (typeof f !== 'function') continue;
		try {
			/* Pass the whole item through, level and all. The function handles
			   level, grade and upgrade-vs-compound internally, which is the part
			   no formula derived from samples could get right. */
			const v = f(it);
			if (typeof v === 'number' && isFinite(v) && v > 0) {
				if (priceFnName !== n) {
					priceFnName = n;
					log(`pricing via parent.${n}() x${mult}`, '#7FD98A');
				}
				return Math.round(v * mult);
			}
		} catch (e) { }
	}
	return null;
}

/* What Ponty charges, with the exact answer preferred and a proven fallback.

   For a LEVEL 0 item the price is derivable and does not need the page at all:
   base value x buy_to_sell x secondhands_mult, which is 1.2x base. Verified
   four ways - throwingstars 72,000 -> 86,400; snowflakes 92,000 -> 110,400;
   mcape 480,000 -> 576,000; ringsj 24,000 -> 28,800 - and matching both the
   in-game display and Ponty's own dialogue.

   For a LEVELLED item it is not derivable from base value: Rugged Pants +1 is
   1.43x base, Rugged Helmet +2 is 3.08x, and Stinger +4 only 2.21x. A +4
   costing less than a +2 rules out any function of level alone. Only the
   client's own routine gets that right, so a levelled item stays unpriced when
   that routine cannot be found - unknown beats wrong, because a wrong price
   here is gold spent on a number nobody chose. */
function pontyPrice(it) {
	const fromGame = gameItemValue(it);
	if (fromGame !== null) return fromGame;
	if ((it.level || 0) > 0) return null;

	const g = (parent && parent.G && parent.G.items
		&& parent.G.items[it.name] && parent.G.items[it.name].g);
	const m = (parent && parent.G && parent.G.multipliers) || {};
	if (typeof g !== 'number' || !isFinite(g)) return null;
	if (typeof m.buy_to_sell !== 'number' || typeof m.secondhands_mult !== 'number') return null;
	return Math.round(g * m.buy_to_sell * m.secondhands_mult);
}

/* One-shot listing of anything in the page that looks like a pricing helper, so
   the right name can be added above if none of the guesses land. */
function probePricingFns() {
	const found = [];
	try {
		for (const k in parent) {
			if (typeof parent[k] !== 'function') continue;
			if (/value|price|cost|worth/i.test(k)) found.push(k);
		}
	} catch (e) { }
	return found;
}

function scanPonty() {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (v) => {
			if (settled) return;
			settled = true;
			try { parent.socket.off('secondhands', onData); } catch (e) { }
			resolve(v);
		};
		const onData = (data) => finish(normalisePonty(data));
		try {
			parent.socket.on('secondhands', onData);
			parent.socket.emit('secondhands');
		} catch (e) {
			log('Ponty query failed: ' + e, 'orange');
			finish(null);
			return;
		}
		setTimeout(() => finish(null), CONFIG.scout.pontyTimeoutMs);
	});
}


async function pontyCheck(opts) {
	opts = opts || {};
	const spot = npcSpot('main', 'secondhands');
	if (!spot) { log('Ponty not found in map data', 'orange'); return null; }
	/* Do not walk to him from the town spot.

	   Ponty is 286.1 away from it and answered a live query at exactly that
	   distance with 225 items, so the walk buys nothing and costs the one rule
	   this character is built around. The walk is kept for anywhere else,
	   because "anywhere else" is a character that is lost rather than parked. */
	/* Only walk when the caller owns the movement lock.

	   This used to be the fix for a race: an unawaited background scan called
	   pontyCheck, pontyCheck walked, and that walk collided with whatever held
	   the movement lock - the 'could not reach main: interrupted' in the family's
	   logs, which kept the rangers from ever settling to farm. The background
	   scan is gone, so the collision cannot happen that way any more, but the
	   guard stays: any future caller that does not hold the lock still must not
	   move the character. The merchant's town round passes mayMove and gets the
	   walk. From the town spot Ponty is in range anyway. */
	if (!atTownSpot()) {
		if (!opts.mayMove) return null;
		await goTo(spot);
	}
	const items = await scanPonty();
	if (items) log(`Ponty: ${items.length} items on ${shardKey(currentShard())}`, '#5ED6A8');
	else log('Ponty returned nothing (out of range, or the call timed out)', 'orange');
	return items;
}
/* When Ponty was last read, per shard. Was a local in roamerLoop, so every
   reload - which is to say every hop - forgot it, and the roamer walked to
   Ponty on arrival at every single shard rather than once every pontyEveryMs.
   Correct, but it paid for the walk each time. */
function pontySeen(key, stamp) {
	const m = SS.get('ponty_seen', {}) || {};
	if (stamp !== undefined) { m[key] = stamp; SS.set('ponty_seen', m); }
	return m[key] || 0;
}

function pontyDue(key) {
	return Date.now() - pontySeen(key) > CONFIG.scout.pontyEveryMs;
}

// ============================================================================
// SKILLS - use what is unlocked, attempt nothing that is not
// ============================================================================
/* Driven entirely by what G declares about each skill rather than by a list
   written here. Two reasons.

   First, the requirement to honour is "high enough level AND holding the items
   that unlock it", and the item half is not knowable from a hardcoded table -
   a ranger's multi-shot needs a bow equipped, and which items count as a bow
   is G's business, not ours.

   Second, G is served from the datastore and is not in the repository, so any
   shape written down here would be a guess. This reads the fields if they are
   there and treats a field it does not recognise as "no restriction" rather
   than inventing one. The failure mode that matters is refusing to use a skill
   we could have used, which costs dps; the opposite - attempting one we cannot
   - is what produces the error spam this is here to avoid. */

function skillDef(name) {
	try { return (parent.G && parent.G.skills && parent.G.skills[name]) || null; }
	catch (e) { return null; }
}

function itemDef(name) {
	try { return (parent.G && parent.G.items && parent.G.items[name]) || null; }
	catch (e) { return null; }
}

/* G expresses "one of these" as either a bare string or an array, depending on
   the field and the game version. Normalise rather than guessing which. */
function asList(v) {
	if (v === undefined || v === null) return null;
	return Array.isArray(v) ? v : [v];
}

/* Does the equipped mainhand satisfy a skill's weapon-type requirement? A
   skill with no wtype has no weapon requirement and passes. */
function weaponAllows(def) {
	const want = asList(def.wtype);
	if (!want) return true;
	const held = character.slots && character.slots.mainhand;
	if (!held || !held.name) return false;
	const it = itemDef(held.name);
	if (!it) return false;                 // unknown item: refuse rather than assume
	return want.indexOf(it.wtype) !== -1;
}

/* Some skills name a slot that must be filled, e.g. an offhand. Expressed as a
   slot name or a list of them. */
function slotsAllow(def) {
	const want = asList(def.slot);
	if (!want) return true;
	for (const entry of want) {
		// Seen as a plain slot name, and as [slot, item] pairs. Handle both.
		const slot = Array.isArray(entry) ? entry[0] : entry;
		const item = Array.isArray(entry) ? entry[1] : null;
		const held = character.slots && character.slots[slot];
		if (!held || !held.name) return false;
		if (item && held.name !== item) return false;
	}
	return true;
}

function classAllows(def) {
	const want = asList(def.class);
	if (!want) return true;
	return want.indexOf(character.ctype) !== -1;
}

/* Is this skill on cooldown right now?

   ms_to_next_skill DOES NOT EXIST in this CODE context - measured, typeof is
   'undefined'. The old body called it bare inside a try, so every call threw a
   ReferenceError and the catch returned true. That made this, and therefore
   every cooldown gate in this file, a no-op that always answered "ready".
   Same shape as the get_entities bug: a helper that is not there, wrapped in a
   guard that turns its absence into a confident wrong answer.

   is_on_cooldown IS present and works - verified live. The fallbacks stay in
   order of preference and the default stays "ready", because a farming script
   that wrongly waits does nothing at all, while one that wrongly fires gets a
   refusal it already handles. */
function isOnCooldown(name) {
	try {
		if (typeof is_on_cooldown === 'function') return !!is_on_cooldown(name);
		if (typeof ms_to_next_skill === 'function') return ms_to_next_skill(name) > 0;
	} catch (e) { }
	return false;
}

function skillOffCooldown(name) {
	return !isOnCooldown(name);
}

/* The single gate. Everything that wants a skill asks this and nothing else,
   so there is one place to correct when a G field turns out to have a shape
   this does not expect. */
function skillReady(name) {
	const def = skillDef(name);
	if (!def) return false;                                   // not a skill this game knows
	if (!classAllows(def)) return false;
	if (def.level !== undefined && character.level < def.level) return false;
	if (def.mp !== undefined && character.mp < def.mp) return false;
	if (!weaponAllows(def)) return false;
	if (!slotsAllow(def)) return false;
	if (!skillOffCooldown(name)) return false;
	return true;
}

/* Skills this character will reach for, best first. Being on the list is not a
   claim that it is available - skillReady decides that every tick, so a skill
   simply starts working the moment the character out-levels or re-equips into
   it, with no edit here. */
const RANGER_ROTATION = [
	{ skill: '5shot', minTargets: 5 },
	{ skill: '3shot', minTargets: 3 },
	{ skill: 'supershot', minTargets: 1, buff: true },
	{ skill: 'huntersmark', minTargets: 1, buff: true, skipIf: (t) => !!(t.s && t.s.marked) },
];

// ============================================================================
// RANGER - farm, keep yourself alive, and be in town when the bank is due
// ============================================================================

const ranger = {
	spot: null,             // { map, monster, x, y, why } - see chooseSpot
	rankingQuietUntil: 0,   // do not repeat "nothing qualified" every minute
	lastReadinessCheck: 0,
	lastTownTripAt: 0,
	parked: false,          // full bag, waiting out the clock in town
	potionTripAt: 0,        // last trip made FOR potions
	potionsUnaffordable: false,
};

function monsterDef(type) {
	try { return (parent.G && parent.G.monsters && parent.G.monsters[type]) || null; }
	catch (e) { return null; }
}

/* OUR position in world space.

   character.x / character.y are NOT world coordinates on the top window -
   measured at (1147, 416) while the character actually stood at (-123, -52).
   NPC entities have .x === .real_x, so G-derived geometry never shows this and
   the discrepancy stays invisible until something cross-checks. It has already
   cost this project once: a phantom 1,307-unit trade range in the merchant,
   read from the top window's character object.

   Everything that needs our position goes through here. */
function myPos() {
	const c = character || {};
	return {
		map: c.map,
		x: c.real_x != null ? c.real_x : c.x,
		y: c.real_y != null ? c.real_y : c.y,
	};
}

/* Is an entity inside our vision?

   character.vision is [700, 500] and the test is a BOX, not a radius:
   |dx| <= 700 && |dy| <= 500. A stand 690 east is visible; one 510 north is
   not. Any distance check here would be wrong in both directions - too
   generous on the diagonal, too strict on the long axis.

   Used by inTown, which is the one place that needs to know whether a whole
   region is visible rather than how far away a single thing is. */
function inVision(entity) {
	const me = myPos();
	const v = (character && character.vision) || [700, 500];
	const ex = entity.real_x != null ? entity.real_x : entity.x;
	const ey = entity.real_y != null ? entity.real_y : entity.y;
	return Math.abs(ex - me.x) <= v[0] && Math.abs(ey - me.y) <= v[1];
}

/* Close enough to the parking spot to transact with the NPCs it was chosen
   for. This is the tighter of the two town tests. */
function atTownSpot() {
	const spot = CONFIG.scout.townSpot;
	const me = myPos();
	if (me.map !== spot.map) return false;
	const dx = me.x - spot.x, dy = me.y - spot.y;
	return Math.sqrt(dx * dx + dy * dy) <= CONFIG.scout.townSpotRadius;
}

/* May the merchant change shards right now?

   Nothing left to gate on. The only condition was ever the bridge answering,
   and with the bridge removed a hop costs a page reload and nothing else. Kept
   as a named predicate rather than inlined so hopTo still reads as a decision,
   and so a future condition has somewhere obvious to go. */
function mayHop() {
	return { ok: true };
}

/* In town, in the wide sense: the whole stand region is inside our vision box.

   Deliberately NOT "on the main map", and the distinction still earns its keep
   now that the scanning is gone - goo and crabx are farmed on main, and this is
   what parkFull and the bank window use to tell "waiting in town" from "standing
   in a field". atTownSpot above is the tighter test, for reaching the NPCs.

   Uses the box test rather than a radius for the same reason inVision does:
   vision is [700, 500] and is not circular. */
function inTown() {
	const me = myPos();
	if (me.map !== CONFIG.scout.townSpot.map) return false;
	const r = CONFIG.scout.standRegion;
	return inVision({ real_x: r.minX, real_y: r.minY })
		&& inVision({ real_x: r.maxX, real_y: r.maxY })
		&& inVision({ real_x: r.minX, real_y: r.maxY })
		&& inVision({ real_x: r.maxX, real_y: r.minY });
}

function freeSlots() {
	try { return character.esize; } catch (e) { return 0; }
}

/* Our sustained healing throughput, in hp per second.

   An estimate, and labelled as one. A ranger's sustain is potions, so this is
   potion size over potion cooldown - which ignores regeneration, party heals
   we do not have, and the fact that a potion cannot be drunk while moving out
   of range. It is deliberately conservative: the number decides whether to
   walk a character into a harder spot, and being wrong in the optimistic
   direction means dying there repeatedly. */
function healThroughput() {
	const def = itemDef(CONFIG.ranger.potions.hp);
	const heal = (def && def.gives && def.gives[0] && def.gives[0][1]) || 400;
	const cooldown = 2;     // seconds; the potion cooldown the client enforces
	return heal / cooldown;
}

function myDps() {
	return (character.attack || 0) * (character.frequency || 0);
}

/* Mitigated damage, the same shape the party's farm scorer uses so the two
   agree about what a spot costs. Both were changed together on 2026-09-25:
   the shared 1-x/(x+900) curve was an approximation that overestimates our
   damage by up to 60% against defense above 400, so both now prefer the
   game's own damage_multiplier and keep the old curve only as a fallback.

   The guard is not decoration here. This script runs in a context where
   get_entities and ms_to_next_skill are both undefined, so damage_multiplier
   cannot be assumed either; it is typeof-tested, its null return for an
   undefined argument is rejected, and the fallback logs once rather than
   quietly substituting a number that looks fine. */
let mitigationFallbackLogged = false;
function mitigated(dps, defense) {
	const K = 900;
	const d = Number.isFinite(defense) ? defense : 0;
	if (typeof parent !== 'undefined' && typeof parent.damage_multiplier === 'function') {
		const m = parent.damage_multiplier(d);
		if (typeof m === 'number' && isFinite(m)) return dps * m;
	}
	if (!mitigationFallbackLogged) {
		mitigationFallbackLogged = true;
		console.error('crabxReady: parent.damage_multiplier unavailable, using the /(x+'
			+ K + ') approximation, which overestimates our damage against defense above ~400');
	}
	return dps * (1 - (d / (d + K)));
}

// ============================================================================
// EXCHANGEABLE ITEMS - never sold, always banked
// ============================================================================
/* DERIVED FROM THE GAME, not from a list here. An item is exchangeable exactly
   when G.items[name].e is defined: it is the count the exchange NPC wants, so
   its presence IS the flag. Measured 2026-10-03 in the live client: 45 items
   carry it - gems, every box and envelope, the candies, seashell, leather,
   lostearring, gemfragment, goldenegg, basketofeggs, 5bucks, mysterybox.

   NOT `type`. x0 (Quantum Piece) is type 'quest' and has no `e`, so typing on
   the field would protect things that cannot be exchanged and would still miss
   gem0, which is type 'gem'. The `e` field is the only honest test, and because
   it is read from G rather than written down, an item the game adds later is
   covered the day it appears.

   Why this matters enough to be its own rule: the sell pass's default is "sell
   anything the plan does not want", and a Mystery Box is worth 12,000,000 to
   the right NPC and 0 to the plan. Selling one is not a small mistake. */
function isExchangeable(name) {
	const d = itemDef(name);
	return !!(d && d.e !== undefined);
}


// ============================================================================
// TOKENS - never sold, always banked, never spent by the script
// ============================================================================
/* Added 2026-10-11 at the owner's instruction. Tokens accumulate in the bank
   and the FAMILY MEMBER spends them, by hand, in game. Nothing here buys
   anything with them, and that is the requirement rather than a gap.

   WHY THEY NEEDED A RULE OF THEIR OWN. Measured against the deployed data at
   game version 17665 - all four items of type 'token':

       monstertoken   s:9999   g:12000   npc:'monsterhunter'
       funtoken       s:9999   g:12000
       pvptoken       s:9999   g:24000
       friendtoken    s:9999   g:36000

   NOT ONE of them carries an `e` field, so isExchangeable does not protect
   them the way it protects gems and boxes. None is a craft input and none is
   on the plan. They therefore fell through every guard to shouldSell's default
   of "anything the plan does not want", and every one of them has a `g`, so
   Gabriel accepts them. A hunt turned in at Daisy was being vendored at that
   ranger's next bank window - sellSurplus runs at the end of EVERY
   character's window, rangers included.

   DERIVED FROM `type`, NOT A LIST. The opposite of the choice isExchangeable
   makes, and for the same underlying reason: there, `type` was the dishonest
   test because x0 is type 'quest' and gem0 is type 'gem', so no type predicts
   exchangeability. Here `type: 'token'` IS the thing - it selects exactly the
   four above and nothing else, checked against the whole item table. A token
   the game adds later is covered the day it appears, and a written-out list
   would not be.

   NOTHING WITHDRAWS THEM, WHICH IS CORRECT HERE. The only two withdraw paths
   are slotToEquip (wearable upgrades) and isWorkItem (plan items below their
   ceiling); a token qualifies for neither, so once banked it stays banked
   until a person retrieves it. Under any other requirement that would be a
   leak - it is why the first attempt at this protected them in the BAG - but
   the requirement is manual spending, so "the script can put them in and
   cannot take them out" is the whole design.

   KEPT OUT OF KEEP_ITEMS ON PURPOSE. That list is "the plan has no opinion
   about this and neither should the sell pass", and everything on it stays in
   the bag because that is where it is used - potions, scrolls, the computer.
   Tokens are not sold for the same reason but they are not kept in the bag
   either, so folding them in would make one rule out of two and lose the
   banking half. */
function isToken(name) {
	const d = itemDef(name);
	return !!(d && d.type === 'token');
}


// ============================================================================
// CRAFT INPUTS - never sold, always banked
// ============================================================================
/* Added 2026-10-11 at the owner's instruction: the materials the gear plan's
   targets are CRAFTED from must survive the sell pass and accumulate in the
   bank, exactly as exchangeables do.

   DERIVED FROM G.craft, not from a list here - the same rule isExchangeable
   follows, and for the same reason. The plan moved to craft-gated targets in the
   v95 resync (windbelt, thundergrips, bowofthedead), and a written-out list of
   their inputs would go stale the next time a target changes. Walking G.craft
   from the plan means the protected set follows the plan automatically.

   WHAT THIS PROTECTS, resolved from the deployed data at version 17665:
     windbelt      <- dexbelt (lvl 2), stormfeather, essenceofether
     thundergrips  <- mrngloves (lvl 6), stormfeather, essenceofether
     bowofthedead  <- mbones, bow
     wingedboots   <- shoes, feather0
   Note dexbelt: it is a tier-1 GOAL and also a tier-2 INPUT, so it is protected
   twice over. That is the case that made this worth deriving - the v95 resync
   removed dexbelt as the tier-2/3 belt, and a naive reading of "the plan no
   longer wants dexbelt" is exactly how the sell pass would have vendored the
   input to the thing that replaced it.

   TRANSITIVE, with a depth cap. An input can itself be craftable, and the cap
   is there because G.craft is operator data at heart - a cycle in it would hang
   this walk, and a hang inside a self-chained tick is the failure mode this file
   is most careful about.

   Cached like coopBosses: an EMPTY read means "G is not ready", not "there are
   none", so it is not cached until something comes back. */
let craftInputCache = null;
function craftInputsCollect(name, out, depth) {
	if (!name || depth < 0) return;
	let c = null;
	try { c = (parent && parent.G && parent.G.craft) ? parent.G.craft[name] : null; } catch (e) { return; }
	if (!c || !Array.isArray(c.items)) return;
	for (const row of c.items) {
		// G.craft rows are [qty, name] or [qty, name, level].
		const n = Array.isArray(row) ? row[1] : null;
		if (!n || out.has(n)) continue;
		out.add(n);
		craftInputsCollect(n, out, depth - 1);
	}
}
function craftInputs() {
	if (craftInputCache) return craftInputCache;
	const out = new Set();
	try {
		for (const name of PLAN_INDEX.keys()) craftInputsCollect(name, out, 3);
	} catch (e) { }
	if (out.size) craftInputCache = out;
	return out;
}
function isCraftInput(name) {
	return !!name && craftInputs().has(name);
}


/* THE LEVEL A RECIPE NEEDS ITS INPUT AT - a number the tier table never states.

   Added 2026-10-11, after the v95 gear sync quietly broke the belt. G.craft
   wants dexbelt at level 2 for windbelt and mrngloves at +6 for thundergrips,
   and NEITHER number appears anywhere in RANGER_GEAR. The tier table's only
   mention of dexbelt is the tier-1 goal of @1, so compoundCeiling('dexbelt')
   answered 1 and compoundRefusal then said "already at the highest level any
   tier asks" for every dexbelt+1 - one level short of the only thing on the
   plan that now consumes it. Measured before this fix: ceiling 1, and a +1
   refused. The merchant was banking dexbelts forever and advancing none of them.

   mrngloves had it worse: it is not in RANGER_GEAR at all, so planCeiling
   answered null, isWorkItem answered false, and the merchant would never have
   taken one out of the bank or put a scroll in it.

   DERIVED, like craftInputs() and for the same reason - a recipe level written
   down here would go stale the next time a target changes.

   SPLIT BY OPERATION, which is the part that needs care. A required level is
   only a ceiling for the operation the item actually supports: dexbelt carries
   `compound` in G.items so it raises the COMPOUND ceiling, while mrngloves
   carries `upgrade` so it raises the UPGRADE one. Feeding a level into the wrong
   one would have compoundRefusal trying to merge three of something that should
   be scrolled up singly. Materials like mbones and feather0 carry neither and
   get no ceiling at all, which is correct - they are consumed as they are. */
let craftLevelCache = null;
function craftRequiredLevels() {
	if (craftLevelCache) return craftLevelCache;
	const out = new Map();
	try {
		const craft = (parent && parent.G && parent.G.craft) || {};
		const seen = new Set();
		const walk = (name, depth) => {
			if (!name || depth < 0 || seen.has(name)) return;
			seen.add(name);
			const c = craft[name];
			if (!c || !Array.isArray(c.items)) return;
			for (const row of c.items) {
				if (!Array.isArray(row)) continue;
				const n = row[1];
				const lvl = Number(row[2]) || 0;
				if (!n) continue;
				if (lvl > (out.get(n) || 0)) out.set(n, lvl);
				walk(n, depth - 1);
			}
		};
		for (const name of PLAN_INDEX.keys()) walk(name, 3);
	} catch (e) { }
	if (out.size) craftLevelCache = out;
	return out;
}
/* null rather than 0 when nothing needs it at a level: 0 would read as "a
   recipe wants this at +0", which is not a target to climb toward. */
function craftRequiredLevel(name) {
	const v = craftRequiredLevels().get(name);
	return (typeof v === 'number' && v > 0) ? v : null;
}
/* Which operation the GAME says this item takes. G.items is authoritative;
   the plan's own `method` field only covers items the plan names. */
function itemOperation(name) {
	const d = itemDef(name);
	if (!d) return null;
	if (d.compound) return 'compound';
	if (d.upgrade) return 'upgrade';
	return null;
}

// ============================================================================
// COOPERATIVE BOSSES - join a fight, never open one
// ============================================================================
/* The same rule Dexon runs (Ranger v64), ported deliberately rather than
   copied: a cooperative monster shares credit by damage dealt, so chipping at
   one somebody else is already fighting PAYS, while opening one alone is a long
   fight this character will usually lose and always lose money on.

   So the test is mob.target - is anyone on it? - and not the monster's name.
   G.monsters[t].cooperative is the game's own flag and the set is built from it
   on first use, which means a boss the game adds later is covered without an
   edit here. An unknown monster is NOT cooperative.

   WHY A RANGER AND NOT A PARTY. Dexon's version exists so three characters can
   join a boss together. These rangers are alone on their shards, so the honest
   framing is different: this is opportunism. A boss that wanders into the farm
   spot while another player is holding it is free damage and free credit. It is
   not a reason to travel, and nothing below moves the character. */
let coopBossCache = null;
function coopBosses() {
	if (coopBossCache) return coopBossCache;
	const out = new Set();
	try {
		const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
		for (const t in (g && g.monsters) || {}) if (g.monsters[t] && g.monsters[t].cooperative) out.add(t);
	} catch (e) { }
	// An empty read is "G is not ready", not "there are none" - do not cache it.
	if (out.size) coopBossCache = out;
	return out;
}

function isCoopBoss(mtype) {
	return !!mtype && coopBosses().has(mtype);
}

/* Someone else's fight, in range, worth joining?

   IN RANGE ONLY. get_nearest_monster is bounded by vision, and this
   deliberately does not walk: a boss across the map is somebody else's
   business, and a ranger that leaves its spot to chase one stops farming and
   stops being where the bank window expects it.

   `target` is the test for "already engaged". It is set on the monster when it
   has someone, so a null means we would be the one opening the fight. */
function coopBossInReach() {
	const cfg = CONFIG.ranger.coopBosses || {};
	if (!cfg.enabled) return null;
	if (!coopBosses().size) return null;
	if (character.hp / character.max_hp < (cfg.minHpFraction || 0.6)) return null;
	for (const t of coopBosses()) {
		if ((cfg.exclude || []).indexOf(t) !== -1) continue;
		let mob = null;
		try { mob = get_nearest_monster({ type: t }); } catch (e) { continue; }
		if (!mob || mob.dead) continue;
		if (mob.target === null || mob.target === undefined) continue;   // nobody on it: not ours to open
		if (typeof is_in_range === 'function' && !is_in_range(mob)) continue;
		return mob;
	}
	return null;
}

/* Back out of a boss's reach before swinging at it.

   Ranger.js has bossPosture for this and it is the one thing the brawl needs
   that this file did not have. The join TELEPORTS us to an arrival point, which
   for goobrawl is inside rgoo's 64-unit range - and rgoo is attack 320 at
   frequency 1.2, so standing there is ~384 dps into a character that has no
   business absorbing it. maxDeaths (2) would eventually end the trip, which is a
   bound, not a posture.

   Deliberately conservative in both directions. It refuses to act at all when
   the boss out-ranges us, because then there is no standing point that is both
   safe and in range and shuffling would just waste the tick - the trip caps are
   what end that case. And it only ever moves AWAY: nothing here closes distance,
   so it cannot walk a character into a pack.

   `move` is typeof-guarded. Referencing an undeclared identifier THROWS rather
   than evaluating to undefined, and this file has already paid for that lesson
   once in attackWithRotation. */
async function bossStandOff(mob) {
	if (!mob) return false;
	const cfg = (CONFIG.ranger && CONFIG.ranger.coopBosses) || {};
	if (cfg.standOff === false) return false;
	const def = monsterDef(mob.mtype);
	const mobRange = (def && def.range) || 0;
	if (!mobRange) return false;
	const want = mobRange + (cfg.standOffMargin || 25);
	// Cannot out-range it: there is no posture to take. Let the caps decide.
	if ((character.range || 0) <= want) return false;
	let d = 0;
	try { d = Math.hypot(mob.x - character.x, mob.y - character.y); } catch (e) { return false; }
	if (!d || d >= want) return false;                      // already clear
	if (typeof move !== 'function') return false;
	const k = want / Math.max(d, 1);
	const tx = mob.x + (character.x - mob.x) * k;
	const ty = mob.y + (character.y - mob.y) * k;
	try {
		await move(tx, ty);
		bossNote('backed off ' + mob.mtype + ' to ' + Math.round(want)
			+ ' (its range ' + mobRange + ', ours ' + Math.round(character.range || 0) + ')');
		return true;
	} catch (e) { return false; }
}

/* ---------------------------------------------------------- the boss trip

   TRAVEL IS NEW, the attack rule is not. The operator's instruction, 2026-10-03:
   these characters should GO to a cooperative boss, and should still only swing
   at it on Ranger.js's condition - mob.target is set, somebody else is already
   on it. Those are two separate questions and keeping them separate is the whole
   design: coopBossInReach() below is untouched and still the only thing that
   decides whether to attack, so a boss nobody else has engaged is one this
   character will stand next to and not hit. That is intended. The trip caps
   below are what stop it standing there for ever.

   PORTED FROM Ranger.js v65 WITHOUT the party half. Dexon's version has a
   leader, a broadcast and a trust window because three characters have to land
   on the same boss or the party splits. These rangers are alone on their shards,
   so there is nobody to agree with and all of that is dead weight here. What
   carries over is the part that is about one character: the gate, the live read
   from parent.S, the join spots, and the trip caps. */
/* GOO BRAWL, added 2026-10-11 - and the join spot below was never enough on its
   own. goobrawl is the ONE joinable event whose parent.S key is an EVENT name
   rather than a monster name: G.monsters.crabxx, .franky and .icegolem all exist
   and all carry cooperative: true, while G.monsters.goobrawl DOES NOT EXIST.
   Two things failed quietly as a result, both of them here:

     * isCoopBoss('goobrawl') read undefined, answered false, and bossEligible()
       rejected it as "not cooperative" every time it went live. The gate was
       right about the data and wrong about the event.
     * bossApproach() asked get_nearest_monster({ type: 'goobrawl' }) and got
       null forever, so it never recognised ARRIVAL - it would have kept
       re-emitting join while standing in the brawl, and never swung.

   bossMonsterType() maps the event name to the monster that is actually there,
   which fixes both and relaxes no policy: goobrawl now passes the cooperative
   test for the same reason the other three do, rather than being admitted by
   hand. -> bossStandOff for the part Ranger.js needs bossPosture for.

   Measured from the deployed data, game version 17665:
     rgoo  hp 1,000,000  attack 320  frequency 1.2  range 64  armor 300
           resistance 300  xp 48,000,000  physical  cooperative  aggro 0.1
     bgoo  hp 100,000    attack 5     range 15      xp 100,000  cooperative
   rgoo's range of 64 is the free-shot band - well inside a ranger's reach - but
   ONLY if the character actually stands outside it, which is what bossStandOff
   is for. The join teleports us to the arrival point, not to a firing posture. */
const BOSS_FIGHT_TYPE = { goobrawl: 'rgoo' };
function bossMonsterType(name) { return BOSS_FIGHT_TYPE[name] || name; }

const BOSS_JOIN_SPOTS = {
	goobrawl: { map: 'goobrawl', x: null, y: null },
	crabxx: { map: 'main', x: -1000, y: 1700 },
	franky: { map: 'level2w', x: -300, y: 150 },
	icegolem: { map: 'winterland', x: 820, y: 425 },
};

/* The trip survives a reload. Without that a redeploy mid-event restarts the
   clock and hands the character another full trip at a boss it had already given
   up on - and a reload is exactly what a shard hop costs. */
const bossState = { trip: null, cooldown: {}, forced: null, lastNote: null };
try {
	const saved = SS.get('boss_trip', null);
	if (saved && typeof saved === 'object') {
		bossState.trip = saved.trip || null;
		bossState.cooldown = saved.cooldown || {};
	}
} catch (e) { }
function bossSave() {
	try { SS.set('boss_trip', { trip: bossState.trip, cooldown: bossState.cooldown }); }
	catch (e) { log('[boss] could not persist the trip - a reload will restart its clock', 'orange'); }
}
function bossLog(m, c) { log('[boss] ' + m, c || '#FFD700'); }
/* Said once per distinct message: approach runs every tick and would otherwise
   be the loudest thing in the log. */
function bossNote(m) { if (bossState.lastNote !== m) { bossState.lastNote = m; bossLog(m, '#8b98ab'); } }

function bossLiveNames() {
	const S = (typeof parent !== 'undefined' && parent.S) || {};
	const out = [];
	for (const k in S) { const v = S[k]; if (v && typeof v === 'object' && v.live) out.push(k); }
	return out;
}

/* The gate. Returns its reason rather than logging it, so bossStatus() can
   print the whole picture in one pass. */
function bossEligible(name) {
	const cfg = CONFIG.ranger.coopBosses;
	if (!cfg.enabled || !cfg.travel) return { ok: false, why: 'travel is off' };
	if ((cfg.exclude || []).indexOf(name) !== -1) return { ok: false, why: 'excluded' };
	// -> GOO BRAWL: the event name is not always the monster name.
	if (!isCoopBoss(bossMonsterType(name))) return { ok: false, why: 'not cooperative' };
	const until = bossState.cooldown[name] || 0;
	if (until > Date.now()) return { ok: false, why: 'gave up, ' + Math.round((until - Date.now()) / 60000) + ' min left' };
	return { ok: true, why: 'cooperative' };
}

/* Which boss: an operator command first, then the weakest eligible one, tied
   by name. Weakest-first because a boss already most of the way down is the one
   most likely to die while we are still useful to it. */
function bossPick() {
	if (bossState.forced && bossState.forced.name) {
		const f = bossState.forced.name;
		const d = ((parent && parent.S) || {})[f];
		if (d && d.live) return { name: f, src: 'command' };
		bossLog('dropping the forced pick ' + f + ' - it is not live', 'orange');
		bossState.forced = null;
	}
	let best = null;
	for (const n of bossLiveNames()) {
		if (!bossEligible(n).ok) continue;
		const d = parent.S[n];
		const ratio = (d && d.max_hp) ? (d.hp / d.max_hp) : 1;
		if (!best || ratio < best.ratio - 1e-9 || (Math.abs(ratio - best.ratio) < 1e-9 && n < best.name)) {
			best = { name: n, ratio };
		}
	}
	return best ? { name: best.name, src: 'own' } : null;
}

function bossWalkTarget(name) {
	const d = ((parent && parent.S) || {})[name];
	if (d && d.map && typeof d.x === 'number') return { map: d.map, x: d.x, y: d.y };
	const spot = BOSS_JOIN_SPOTS[name];
	if (spot && typeof spot.x === 'number') return { map: spot.map, x: spot.x, y: spot.y };
	const spawn = monsterSpawn('main', name);
	return spawn || null;
}

function bossEnd(why) {
	const t = bossState.trip;
	if (!t) return;
	bossState.cooldown[t.name] = Date.now() + (CONFIG.ranger.coopBosses.cooldownMs || 30 * 60 * 1000);
	bossState.trip = null;
	bossState.lastNote = null;
	bossSave();
	bossLog('leaving ' + t.name + ': ' + why, '#E9C46A');
}

/* Get there. Returns once a step has been taken or the trip is over - the
   caller owns the tick either way, which is what keeps the farm loop from
   walking us back to the farm spot in the same breath. */
async function bossApproach(name) {
	// -> GOO BRAWL. Asking for the EVENT name here returned null forever.
	const arrived = get_nearest_monster({ type: bossMonsterType(name) });
	if (arrived) { await bossStandOff(arrived); return; }   // arrived; the attack rule decides from here
	if (BOSS_JOIN_SPOTS[name]) {
		// hopsickness is the one refusal worth naming: it is temporary, and the
		// alternative reading - "join is broken" - would send us walking to a
		// destination the teleport reaches for free.
		if (character.s && character.s.hopsickness) { bossNote('hopsick - cannot join ' + name + ' yet'); return; }
		bossNote('joining ' + name);
		try { parent.socket.emit('join', { name: name }); } catch (e) { bossLog('join emit failed: ' + e, 'red'); }
		return;
	}
	const where = bossWalkTarget(name);
	if (!where) { bossNote('no position known for ' + name + ' - cannot travel'); return; }
	bossNote('walking to ' + name + ' on ' + where.map);
	await goTo(where);
}

/* Returns true when the boss path owns this tick. */
async function bossTick() {
	const cfg = CONFIG.ranger.coopBosses;
	if (!cfg.enabled || !cfg.travel) { if (bossState.trip) bossEnd('travel turned off'); return false; }

	// Deaths are counted from the rip EDGE, so one corpse is one death however
	// many ticks it lies there.
	const t0 = bossState.trip;
	if (t0) {
		if (character.rip && !t0.wasRip) {
			t0.deaths++; t0.wasRip = true; bossSave();
			bossLog('died at ' + t0.name + ' (' + t0.deaths + ' of ' + cfg.maxDeaths + ')', 'red');
		} else if (!character.rip && t0.wasRip) { t0.wasRip = false; bossSave(); }
	}

	const pick = bossPick();
	if (!pick) { if (bossState.trip) bossEnd('nothing eligible is live'); return false; }
	if (!bossState.trip || bossState.trip.name !== pick.name) {
		if (bossState.trip) bossEnd('switching to ' + pick.name);
		bossState.trip = { name: pick.name, startedAt: Date.now(), deaths: 0, wasRip: !!character.rip, src: pick.src };
		bossSave();
		bossLog('going to ' + pick.name + ' (' + pick.src + ', '
			+ (BOSS_JOIN_SPOTS[pick.name] ? 'joinable' : 'on foot') + ')');
	}

	const t = bossState.trip;
	if (t.deaths >= cfg.maxDeaths) { bossEnd(t.deaths + ' deaths'); return false; }
	if (Date.now() - t.startedAt > cfg.maxTripMs) { bossEnd('trip cap of ' + Math.round(cfg.maxTripMs / 60000) + ' min'); return false; }
	if (character.rip) return true;      // the respawn path owns us until we are up

	/* ARRIVED. The attack rule is coopBossInReach's and nothing here overrides
	   it: if nobody else is on this boss we stand here and do not swing, and the
	   trip cap above is what eventually sends us home. Travelling to a boss and
	   declining to open it is the instruction, not a bug. */
	const mob = coopBossInReach();
	if (mob) { await bossStandOff(mob); await attackWithRotation(mob); return true; }

	await bossApproach(t.name);
	return true;
}

// ---- operator commands ----------------------------------------------------
function bossJoin(name) {
	if (!name) {
		const live = bossLiveNames();
		bossLog('bossJoin("<name>") - live now: ' + (live.length ? live.join(', ') : 'nothing')
			+ ' | joinable: ' + Object.keys(BOSS_JOIN_SPOTS).join(', '));
		return;
	}
	bossState.forced = { name, at: Date.now() };
	bossState.cooldown[name] = 0;
	bossSave();
	bossLog('forced to ' + name + ' by hand', '#7FD98A');
}
function bossHome() {
	bossState.forced = null;
	if (bossState.trip) bossEnd('bossHome() by hand');
	else bossLog('not on a boss trip');
}
function bossStatus() {
	const t = bossState.trip;
	bossLog('travel=' + (CONFIG.ranger.coopBosses.travel ? 'on' : 'off')
		+ ' trip=' + (t ? t.name + ' ' + Math.round((Date.now() - t.startedAt) / 60000) + 'min deaths=' + t.deaths + ' via ' + t.src : 'none'));
	const live = bossLiveNames();
	if (!live.length) { bossLog('nothing is live'); return; }
	for (const n of live) {
		const e = bossEligible(n);
		const d = parent.S[n] || {};
		const mob = get_nearest_monster({ type: bossMonsterType(n) });
		bossLog('  ' + n + ': ' + (e.ok ? 'ELIGIBLE' : 'no - ' + e.why)
			+ (d.max_hp ? ' hp ' + Math.round(100 * d.hp / d.max_hp) + '%' : '')
			+ (mob ? (mob.target ? ' - engaged by ' + mob.target + ', we would attack' : ' - nobody on it, we would hold') : ''),
			e.ok ? '#7FD98A' : '#8b98ab');
	}
}

// ============================================================================
// FARM RANKING - stand where the gear this character is WEARING gets better
// ============================================================================
/* THE BRIEF, 2026-10-03: pick a reasonably safe spot whose drops advance the
   gear plan, judged only against what this character has ON, with no reference
   to the bank or to anyone else. Fall back to crab when nothing qualifies.

   That last clause is the important one. The old chooser had two spots and a
   graduation test between them; this has every pack the game declares and a
   plan to satisfy, so "found nothing" is a normal outcome rather than an error,
   and it has to land somewhere safe rather than somewhere ambitious.

   WHAT COUNTS AS WANTED. For each equipped slot, the plan's lowest tier whose
   target this character does not already meet. The item named there is wanted;
   everything else is not. Reading the WORN item rather than the bag or the bank
   is the whole point - a ranger with a firebow+5 on does not want another
   firebow, and a ranger with an empty cape slot wants the first cape the plan
   names, not the tier-3 one.

   WHAT COUNTS AS SAFE is the crabxReady model, generalised: the pack's incoming
   damage must leave a margin against our sustain, and one target must die
   inside a sane window. Those two numbers were already the file's definition of
   "comfortable", so the ranking inherits a definition the operator has already
   watched work rather than inventing a second one. */

/* Every pack the game declares, as flat candidates. Built per pass rather than
   cached: level and gear move, and a spot that was unsafe an hour ago may not
   be now. */

/* Ranger.js's map test, ported verbatim 2026-10-11 rather than reinvented.

   Two flags and nothing else. I had first written a door-BFS from main, which
   looked more careful and was wrong in both directions: it admitted maps the
   game marks instance-free but unreachable, and it REFUSED six the ranger farms
   happily - old_main, goobrawl, d2, jail, cyberland and batcave are none of them
   door-reachable from main, and all six are admitted here. Reachability is not
   a property of the door graph; it is whatever smart_move can do, and the honest
   way to find that out is to try and remember the failure.
   -> travelBlacklist */

/* RANGER'S MEASURED STANDING POINTS, ported 2026-10-11 at the owner's
   instruction: use the coordinates listed in Ranger.js rather than computing a
   spot here.

   These are CONFIG.achievements.queue from Ranger.js - "the monster, where to
   stand, and the rung to stop at", and its own comment says the coordinates are
   the same spots the manual overrides used. They were arrived at live on the
   main account, which makes them worth more than anything this file can derive:
   farmCandidates' boundary CENTRE is a geometric guess that happens to be
   correct on open ground and catastrophic next to a rage rectangle.

   THE BOOBOO ENTRY IS THE WHOLE POINT, and it is why FIRST MATCH WINS below.
   The table carries booboo TWICE:

     index 0   (290, -990)   rung null    <- the corridor spot, outside BOTH
                                            spookytown rectangles (148 from the
                                            booboo box, 140 from the mummy one),
                                            reached live with zero breaches
     index 19  (415, -702)   rung 100000  <- the spawn-boundary centre, INSIDE
                                            the booboo rage box - the coordinate
                                            that cost the main account three
                                            deaths and zero kills

   Ranger never reaches index 19 because index 0 has rung null and the queue
   stops there, so the bad coordinate sits in its table harmlessly. Here there
   is no queue and no rung, so a naive "find the entry for this monster" could
   pick either. Order is preserved and the FIRST match is taken, which is the
   curated one. Do not sort this array.

   `also` is carried across: the booboo entry serves mummy from the same spot,
   which is how mummy gets a safe standing point too.

   A monster absent from this table falls back to the boundary centre exactly as
   before - this narrows the guessing, it does not replace it. */
const RANGER_SPOTS = [
	{ m: 'booboo',     map: 'spookytown',  x:  290, y:  -990, also: ['mummy'] },
	{ m: 'stoneworm',  map: 'spookytown',  x:  677, y:   129 },
	{ m: 'mole',       map: 'tunnel',      x:   14, y: -1072 },
	{ m: 'armadillo',  map: 'main',        x:  526, y:  1846 },
	{ m: 'porcupine',  map: 'desertland',  x: -829, y:   135 },
	{ m: 'croc',       map: 'main',        x:  801, y:  1710 },
	{ m: 'iceroamer',  map: 'winterland',  x:  824, y:   -45 },
	{ m: 'poisio',     map: 'main',        x: -121, y:  1360 },
	{ m: 'crabx',      map: 'main',        x: -984, y:  1762 },
	{ m: 'squig',      map: 'main',        x:-1175, y:   422 },
	{ m: 'tortoise',   map: 'main',        x:-1124, y:  1118 },
	{ m: 'bbpompom',   map: 'winter_cave', x:  -82, y:  -949 },
	{ m: 'bat',        map: 'batcave',     x:   66, y:     8 },
	{ m: 'boar',       map: 'winterland',  x:   20, y: -1109 },
	{ m: 'cgoo',       map: 'level2s',     x:   34, y:   503 },
	{ m: 'spider',     map: 'main',        x:  948, y:  -144 },
	{ m: 'ghost',      map: 'halloween',   x: -405, y: -1642 },
	{ m: 'wolfie',     map: 'winterland',  x: -169, y: -2026 },
	/* index 19 in Ranger's queue - (415,-702), the booboo rage-box centre - is
	   DELIBERATELY NOT COPIED. It is unreachable in Ranger because the queue
	   stops at index 0, and copying it here would make it reachable. */
	{ m: 'scorpion',   map: 'main',        x: 1578, y:  -168 },
	{ m: 'gscorpion',  map: 'desertland',  x:  391, y: -1422 },
	{ m: 'osnake',     map: 'halloween',   x: -509, y:  -626 },
];

/* monster -> the first entry that names it, directly or through `also`.
   Built once; the table is static. */
const RANGER_SPOT_BY_MONSTER = (() => {
	const idx = new Map();
	for (const e of RANGER_SPOTS) {
		if (!e || !e.m) continue;
		const names = [e.m].concat(Array.isArray(e.also) ? e.also : []);
		for (const n of names) if (!idx.has(n)) idx.set(n, e);   // FIRST match wins
	}
	return idx;
})();

/* The measured spot for this monster, but only when it is on the same map as
   the pack being considered - an entry naming spookytown says nothing about
   where to stand for the same monster somewhere else. */
function rangerSpot(monster, mapName) {
	const e = RANGER_SPOT_BY_MONSTER.get(monster);
	if (!e || e.map !== mapName) return null;
	return { x: e.x, y: e.y };
}

function isMapSafeForFarming(mapData) {
	if (!mapData) return false;
	if (mapData.pvp) return false;
	if (mapData.instance) return false;
	return true;
}

/* THE "CANNOT GET THERE" HALF.

   Ranger.js carries a full blacklist with permanence, reporting and whitelists;
   this is the part of it that the fleet needs - a strike count per spot and a
   timeout. Kept in CODE storage so a reload or a shard hop does not hand the
   character the same unreachable spot again with a clean slate. */
const travelStrikes = {};        // spotKey -> consecutive failures
let travelBlack = null;          // spotKey -> ms timestamp it may be retried
function tbLoad() {
	if (travelBlack) return travelBlack;
	let saved = null;
	try { saved = SS.get('travel_black', null); } catch (e) { }
	travelBlack = (saved && typeof saved === 'object') ? saved : {};
	return travelBlack;
}
function tbSave() {
	try { SS.set('travel_black', tbLoad()); }
	catch (e) { log('could not persist the travel blacklist - a reload will forget it', 'orange'); }
}
function spotKey(monster, map) { return monster + '@' + map; }
function isUnreachable(monster, map) {
	/* An achievement spot is whitelisted: the blacklist must not quietly remove
	   the thing the operator asked for. achvNoteTravelFailure is the release
	   valve, after maxTravelFailures. -> achvWhitelisted */
	if (achvWhitelisted(monster, map)) return false;
	const until = tbLoad()[spotKey(monster, map)] || 0;
	return Date.now() < until;
}
/* Called when a walk to a ranked spot did not take. Strikes rather than one
   failure, because an interrupted smart_move is routine - a death, a rage
   guard, a monster in the doorway - and one of those is not evidence that a
   map cannot be reached. */
function noteTravelFailure(monster, map) {
	const cfg = CONFIG.ranger.farmRanking || {};
	/* A whitelisted achievement spot is counted separately and released by
	   maxTravelFailures rather than blacklisted. -> achvNoteTravelFailure */
	if (achvWhitelisted(monster, map)) { achvNoteTravelFailure(); return false; }
	const key = spotKey(monster, map);
	travelStrikes[key] = (travelStrikes[key] || 0) + 1;
	const need = cfg.unreachableStrikes || 3;
	if (travelStrikes[key] < need) return false;
	const ms = cfg.unreachableMs || 60 * 60 * 1000;
	tbLoad()[key] = Date.now() + ms;
	travelStrikes[key] = 0;
	tbSave();
	log('cannot reach ' + key + ' after ' + need + ' tries - ignoring it for '
		+ Math.round(ms / 60000) + ' min', '#E9C46A');
	ranger.spot = null;            // re-rank now rather than after checkEveryMs
	return true;
}
function noteTravelSuccess(monster, map) {
	delete travelStrikes[spotKey(monster, map)];
}
/* Read it from the console. */
function farmBlacklist() {
	const b = tbLoad();
	const keys = Object.keys(b).filter((k) => b[k] > Date.now());
	if (!keys.length) { log('travel blacklist is empty'); return; }
	keys.forEach((k) => log('  ' + k + ': ' + Math.round((b[k] - Date.now()) / 60000) + ' min left'));
}
function farmBlacklistClear() {
	travelBlack = {};
	tbSave();
	ranger.spot = null;
	log('travel blacklist cleared', '#7FD98A');
}

function farmCandidates() {
	const cfg = CONFIG.ranger.farmRanking;
	const out = [];
	let g = null;
	try { g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null; } catch (e) { }
	if (!g || !g.maps) return out;
	/* null => every map the game calls farmable. -> isMapSafeForFarming */
	const names = Array.isArray(cfg.maps) ? cfg.maps : Object.keys(g.maps);
	for (const mapName of names) {
		const m = g.maps[mapName];
		if (!m || !Array.isArray(m.monsters)) continue;
		if (!Array.isArray(cfg.maps) && !isMapSafeForFarming(m)) continue;
		for (const pack of m.monsters) {
			if (!pack || !pack.type) continue;
			if ((cfg.never || []).indexOf(pack.type) !== -1) continue;
			const b = pack.boundary;
			/* Ranger's measured point first, the boundary centre only as a
			   fallback. -> RANGER_SPOTS */
			const measured = rangerSpot(pack.type, mapName);
			out.push({
				type: pack.type, map: mapName,
				x: measured ? measured.x : (b ? Math.round((b[0] + b[2]) / 2) : (pack.x || 0)),
				y: measured ? measured.y : (b ? Math.round((b[1] + b[3]) / 2) : (pack.y || 0)),
				count: pack.count || 1,
				grow: !!pack.grow,
				hasBoundary: !!b,
				// 'ranger' means a spot somebody stood on; 'centre' is geometry.
				spotSource: measured ? 'ranger' : 'centre',
			});
		}
	}
	return out;
}

/* The crabxReady test, applied to any monster.

   Returns a reason when it says no, because "nothing was safe" with no detail
   is the kind of verdict nobody can act on - and this runs over fifty-odd packs
   where knowing WHICH test rejected a spot is the difference between tuning a
   number and guessing. */
/* This absorbed crabxReady(), which asked the same two questions of one
   monster and is gone. Its `minLevel: 40` deliberately did NOT come with it:
   that number meant "old enough for crabx specifically", and as a universal
   gate it would refuse a level-20 character the crab it can obviously handle.
   The two live-stat tests already answer "can this character handle it" without
   a hardcoded level, which is why they were the right thing to generalise. The
   key keeps its name because the config block is shared. */
/* marginOverride, added 2026-10-11 for the monster hunt. The farm's margin is
   tuned for a spot the owner has watched; a hunt is handed to us by the server
   and graded sight-unseen, so it is held to a stricter one. Omitted everywhere
   else, which leaves farm behaviour byte-identical. -> MONSTER HUNT */
function spotSafety(cand, marginOverride) {
	const cfg = CONFIG.ranger.crabxReady;
	const mob = monsterDef(cand.type);
	if (!mob) return { ok: false, why: 'unknown monster' };
	if (mob.cooperative) return { ok: false, why: 'cooperative boss' };
	/* PURE DAMAGE IS CHECKED FIRST, before any number is computed. It ignores
	   armour and resistance, so every figure below would be measured against a
	   defence that does not apply - and when the first version checked it last,
	   booboo came back as 'incoming 792 dps vs sustain 200', which is a true
	   sentence that names the wrong reason and sends you tuning a margin that was
	   never the problem. Refused rather than modelled. */
	if (mob.damage_type === 'pure' && (cfg.refusePure !== false)) {
		return { ok: false, why: 'pure damage, unmitigable' };
	}
	/* HOW MANY CAN REACH US AT ONCE, which is the configured assumption and NOT
	   the pack size. The first version doubled it for a `grow` pack on the
	   grounds that such a pack cannot be thinned - true, but it confuses SUPPLY
	   with SIMULTANEOUS ATTACKERS. grow means the next one spawns in 25ms rather
	   than in `respawn` seconds; it does not mean six of them hit you at the same
	   time. The doubling rejected goo - 30 attack x 6 - which these characters
	   farm perfectly well, and a safety model that refuses the spot the operator
	   is already standing on is wrong about safety. */
	const attackers = Math.min(cand.count, cfg.maxAttackers || 3);
	const incoming = (mob.attack || 0) * (mob.frequency || 1) * attackers;
	const sustain = healThroughput();
	const margin = (typeof marginOverride === 'number' && marginOverride > 0)
		? marginOverride : (cfg.minSurvivalMargin || 1.5);
	if (incoming * margin > sustain) {
		return { ok: false, why: 'incoming ' + Math.round(incoming) + ' dps vs sustain ' + Math.round(sustain) };
	}
	const effective = Math.max(mitigated(myDps(), mob.armor || 0), 1);
	const ttk = (mob.hp || 1) / effective;
	if (ttk > (cfg.maxSecondsToKill || 12)) {
		return { ok: false, why: Math.round(ttk) + 's to kill one' };
	}
	return { ok: true, ttk, incoming, attackers };
}

/* What this character still needs, read off what it is WEARING.

   One entry per slot: the tier ABOVE the highest one the worn item already
   satisfies. An empty slot, or one holding something the plan never mentions,
   wants tier 1. A slot whose worn item satisfies the last tier wants nothing.

   WALKING DOWN FROM THE TOP, not up from the bottom. The first version stopped
   at the lowest unmet tier, which is wrong whenever consecutive tiers name
   DIFFERENT items: a ranger wearing tshirt9+4 - the tier-3 chest - does not
   satisfy tier 1's coat@6, so the upward walk declared it wanted a coat. It
   would have sent a fully geared character to farm starter gear. Highest
   satisfied tier, then the next one up, is the question actually being asked. */
function wantedFromWorn() {
	const want = new Map();            // item name -> { slot, tier, level }
	const slots = (character && character.slots) || {};
	for (const slot of GEAR_SLOTS) {
		const worn = slots[slot] || null;
		let best = -1;                 // highest tier index the worn item satisfies
		for (let t = 0; t < RANGER_GEAR.length; t++) {
			const spec = RANGER_GEAR[t] && RANGER_GEAR[t][slot];
			if (!spec || !spec.item) continue;
			if (worn && satisfies(worn, spec)) best = t;
		}
		for (let t = best + 1; t < RANGER_GEAR.length; t++) {
			const spec = RANGER_GEAR[t] && RANGER_GEAR[t][slot];
			if (!spec || !spec.item) continue;
			if (!want.has(spec.item)) want.set(spec.item, { slot, tier: t, level: spec.level });
			break;                     // only the next rung, not every rung above
		}
	}
	return want;
}

/* Does this monster drop anything on that list, and how often?

   Reads the monster's own table AND the map table, because a map drop rolls on
   every kill there - that is how the stat belts arrive on spookytown, and a
   ranking that only read monster tables would call that map worthless.

   The map roll is hp-weighted by the server (hp_mult = max_hp/1000), so it is
   scaled here the same way rather than counted at face value. Monster drops are
   not weighted that way and are taken as written. */
function dropValue(cand, want) {
	let g = null;
	try { g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null; } catch (e) { }
	if (!g || !g.drops) return { score: 0, items: [] };
	const mob = monsterDef(cand.type) || {};
	const hpMult = (mob.hp || 0) / 1000;
	const hits = [];
	let score = 0;

	const consider = (chance, name, weight) => {
		if (!name || !want.has(name)) return;
		const c = (typeof chance === 'number' && isFinite(chance)) ? chance : 0;
		const w = want.get(name);
		/* An earlier tier is worth more than a later one: it is the next thing
		   this character can actually wear. */
		const tierWeight = 1 / (1 + w.tier);
		score += c * weight * tierWeight;
		hits.push(name + ' (' + w.slot + ', tier ' + (w.tier + 1) + ')');
	};

	for (const row of ((g.drops.monsters && g.drops.monsters[cand.type]) || [])) {
		if (!Array.isArray(row)) continue;
		// [chance, name] and [chance, 'open', pool] both occur.
		if (row[1] === 'open') {
			for (const sub of ((g.drops[row[2]]) || [])) if (Array.isArray(sub)) consider(row[0], sub[1], 1);
		} else consider(row[0], row[1], 1);
	}
	for (const row of ((g.drops.maps && g.drops.maps[cand.map]) || [])) {
		if (!Array.isArray(row)) continue;
		if (row[1] === 'open') {
			for (const sub of ((g.drops[row[2]]) || [])) if (Array.isArray(sub)) consider(row[0] * hpMult, sub[1], 1);
		} else consider(row[0] * hpMult, row[1], 1);
	}
	return { score, items: [...new Set(hits)] };
}

/* The ranking itself. Safety is a GATE, not a term: an unsafe spot with a
   perfect drop table is still a spot this character dies at, and averaging the
   two would let a good drop buy its way past the survival test. */
function rankFarmSpots() {
	const want = wantedFromWorn();
	const rows = [];
	for (const cand of farmCandidates()) {
		/* -> travelBlacklist. Checked before the safety maths so a spot we
		   cannot walk to costs nothing to skip. */
		if (isUnreachable(cand.type, cand.map)) {
			rows.push({ cand, ok: false, why: 'unreachable, blacklisted' });
			continue;
		}
		const safe = spotSafety(cand);
		if (!safe.ok) { rows.push({ cand, ok: false, why: safe.why }); continue; }
		const dv = dropValue(cand, want);
		if (dv.score <= 0) { rows.push({ cand, ok: false, why: 'drops nothing on the plan' }); continue; }
		/* Among spots that are safe AND useful, prefer the one that kills faster:
		   the drop chance is per kill, so kills per second is the multiplier that
		   turns a drop table into a rate. */
		rows.push({ cand, ok: true, score: dv.score / Math.max(safe.ttk, 0.1), items: dv.items, ttk: safe.ttk });
	}
	const good = rows.filter((r) => r.ok).sort((a, b) => b.score - a.score);
	return { good, all: rows, want };
}

/* Which spot we should be on right now.

   Re-ranked on the same timer the graduation test used, and it demotes as
   readily as it promotes: gear improves, a slot gets filled, and the spot that
   was worth standing at stops being. Logging only on CHANGE keeps a sixty-pack
   ranking from filling the log every minute.

   THE FALLBACK IS CRAB, by the operator's instruction. Not goo and not crabx:
   when nothing safe advances the plan the right answer is the safest thing on
   the board, not the most ambitious thing this character can survive. If crab
   itself is missing from the game data the old goo spot is the floor under the
   floor, because standing still is worse than farming something. */
function chooseSpot() {
	/* The achievement queue outranks EVERYTHING, including the hunt. Both are
	   explicit modes the operator turns on; this one is the more deliberate of
	   the two - it is off by default and bypasses the never-list to run - so a
	   character told to grind booboo is not quietly diverted by a hunt that
	   happens to arrive. -> CONFIG.ranger.achievements */
	const achv = achvSpot();
	if (achv) {
		const akey = achv.monster + '@' + achv.map;
		if (!ranger.spot || akey !== ranger.spot.monster + '@' + ranger.spot.map) {
			log('farming ' + akey + ' - ' + achv.why, '#9FD3FF');
		}
		ranger.spot = achv;
		return ranger.spot;
	}

	/* A viable monster hunt outranks the scorer: it is a fixed instruction with
	   a clock on it, while the ranked spot is always available. Everything
	   downstream - the walk, the target pick, the rotation - is the ordinary
	   farm path. -> MONSTER HUNT */
	const hunt = mhSpot();
	if (hunt) {
		const hkey = hunt.monster + '@' + hunt.map;
		if (!ranger.spot || hkey !== ranger.spot.monster + '@' + ranger.spot.map) {
			log('farming ' + hkey + ' - ' + hunt.why, '#7FD98A');
		}
		ranger.spot = hunt;
		return ranger.spot;
	}

	const now = Date.now();
	if (ranger.spot && now - ranger.lastReadinessCheck < CONFIG.ranger.crabxReady.checkEveryMs) {
		return ranger.spot;
	}
	ranger.lastReadinessCheck = now;

	let pick = null;
	if (CONFIG.ranger.farmRanking && CONFIG.ranger.farmRanking.enabled) {
		const r = rankFarmSpots();
		if (r.good.length) {
			const best = r.good[0];
			pick = { map: best.cand.map, monster: best.cand.type, x: best.cand.x, y: best.cand.y,
				why: 'advances ' + best.items.slice(0, 3).join(', ')
					+ (best.cand.spotSource === 'ranger' ? ' [measured spot]' : '') };
		} else if (!ranger.rankingQuietUntil || now > ranger.rankingQuietUntil) {
			ranger.rankingQuietUntil = now + (CONFIG.ranger.farmRanking.quietMs || 15 * 60 * 1000);
			const wanted = [...r.want.keys()];
			log(wanted.length
				? `nothing safe drops ${wanted.slice(0, 5).join(', ')} - falling back`
				: 'the worn gear already meets the plan at every slot - falling back', '#8b98ab');
		}
	}

	if (!pick) {
		const fb = CONFIG.ranger.farmRanking.fallback;
		const spawn = monsterSpawn(fb.map, fb.monster);
		pick = monsterDef(fb.monster)
			? { map: fb.map, monster: fb.monster, x: spawn ? spawn.x : 0, y: spawn ? spawn.y : 0, why: 'fallback' }
			: Object.assign({ why: 'fallback (crab missing from game data)' }, CONFIG.ranger.spots.goo);
	}

	const key = pick.monster + '@' + pick.map;
	if (!ranger.spot || key !== ranger.spot.monster + '@' + ranger.spot.map) {
		log(`farming ${key} - ${pick.why}`, pick.why === 'fallback' ? '#E9C46A' : '#7FD98A');
	}
	ranger.spot = pick;
	return ranger.spot;
}

/* Operator view: what is worn against the plan, what that makes wanted, and
   why each spot was or was not chosen. Read-only. */
function farmStatus() {
	const r = rankFarmSpots();
	log('wanted, from what is worn: ' + ([...r.want.entries()]
		.map(([n, w]) => n + '+' + w.level + ' (' + w.slot + ')').join(', ') || 'nothing - the plan is met'), '#FFD700');
	log(r.good.length + ' of ' + r.all.length + ' pack(s) are safe AND advance the plan', r.good.length ? '#7FD98A' : '#E9C46A');
	for (const g of r.good.slice(0, 8)) {
		log('  ' + g.cand.type + '@' + g.cand.map + '  score ' + g.score.toExponential(2)
			+ '  ' + Math.round(g.ttk) + 's/kill  -> ' + g.items.join(', '), '#8b98ab');
	}
	const why = {};
	for (const r2 of r.all) if (!r2.ok) why[r2.why] = (why[r2.why] || 0) + 1;
	log('rejected: ' + Object.keys(why).map((k) => k + ' x' + why[k]).join(', '), '#8b98ab');
	return r;
}

// ============================================================================
// RANGER - the tick
// ============================================================================
/* One claim on the character at a time. Every branch below awaits travel or a
   socket call, and without this a slow smart_move would let the next tick
   start a second one on top of it - the same mutual exclusion the merchant
   learned to need. Released in a finally so a throw cannot strand it. */
const fleetState = {
	busy: false, busySince: 0, busyToken: 0,
	parkedFull: false, stuck: false,
};

/* Taking and releasing the movement lock, by token.

   The lock is released in a finally, which covers a throw. It does NOT cover an
   await that never settles - and that is what happens in practice. Measured on
   the family's account 2026-09-21: both rangers sat with busy true across
   repeated reads, a goo at distance 0, is_in_range true and every other gate
   open, doing nothing. They still LOOKED alive, because the town scan sits
   above this lock in the tick while farming sits below it, so the log kept
   filling with Ponty and stand readings while the character never fought again.
   Their logs carry a matching 'could not reach main' from goTo, so smart_move
   is the suspect: when it rejects you get that line, and when it simply never
   settles the finally never runs.

   The token is what makes forcing the lock safe. Clearing the flag does not
   cancel the stuck operation, so it can still wake up later and run its own
   finally - which would release a lock a FRESH flow legitimately holds. Each
   acquisition takes a generation number and a release only applies if it still
   owns it, so a stale flow's release is a no-op. */
function takeBusy() {
	fleetState.busy = true;
	fleetState.busySince = Date.now();
	return ++fleetState.busyToken;
}

function freeBusy(token) {
	if (fleetState.busyToken !== token) return;   // stale flow, not ours to release
	fleetState.busy = false;
}

/* Held past the ceiling? Say so loudly and force it open.

   Loudly is the point. The recovery is worth having, but an operation that
   silently wedges every few hours and silently recovers is still a bug nobody
   can chase - the log line is what turns it into something with a timestamp
   and a duration next to it. */
function busyExpired() {
	if (!fleetState.busy) return false;
	const held = Date.now() - fleetState.busySince;
	if (held < CONFIG.lockCeilingMs) return false;
	log('movement lock held ' + Math.round(held / 1000) + 's - forcing it open. '
		+ 'Something awaited never settled; the next tick starts clean.', 'red');
	fleetState.busy = false;
	return true;
}

function potionCount(name) {
	let n = 0;
	const items = (character && character.items) || [];
	for (const it of items) if (it && it.name === name) n += (it.q || 1);
	return n;
}

/* Drink when low. Cheap, synchronous, and runs every tick regardless of what
   else the character is doing - being in town for the bank is not a reason to
   die on the way. */
function useRangerPotions() {
	const cfg = CONFIG.ranger.potions;
	try {
		/* NO STOCK CHECK, deliberately.

		   use_hp and use_mp fall back to the regen abilities when the bag is
		   empty. The game says so itself - G.skills.use_mp.explanation reads
		   "Shares a cooldown with HP potions and HP/MP regeneration ... Without a
		   potion, restore 100 MP and wait 4 seconds instead" - and all four of
		   use_hp, use_mp, regen_hp and regen_mp carry cooldown_group "potion",
		   verified live rather than read off the server source.

		   So calling with nothing to drink is not a wasted call, it IS the free
		   regeneration. The old `potionCount(...) > 0` guard meant a character
		   with no potions never called at all and got NO sustain whatsoever,
		   which is exactly the state a new level-1 ranger with no gold is in -
		   "could not afford any potions - farming without them". The guard was
		   backwards: the empty bag is when the call is most worth making.

		   Only one of the four can fire per cycle, so HP goes first. */
		if (character.hp / character.max_hp <= cfg.hpAt && !isOnCooldown('use_hp')) {
			use_skill('use_hp');
			return;
		}
		if (character.mp / character.max_mp <= cfg.mpAt && !isOnCooldown('use_mp')) {
			use_skill('use_mp');
		}
	} catch (e) { }
}

function potionsLow() {
	const cfg = CONFIG.ranger.potions;
	return potionCount(cfg.hp) < cfg.buyBelow || potionCount(cfg.mp) < cfg.buyBelow;
}

/* Buy as many as the purse allows, rather than the full restock or nothing.

   A NEW ACCOUNT IS THE CASE THIS EXISTS FOR. hpot1 is 100 gold and buyTo is
   500, so a full restock of both kinds is 100,000 gold - which a character
   that has never farmed does not have. The all-or-nothing version asked for
   500, the game refused the whole purchase, and the character came back from
   town with nothing. Fifty potions is not a restock but it is enough to farm
   goos, and farming goos is how the gold for the next fifty arrives.

   Returns how many it actually bought, because the caller has to be able to
   tell "restocked" from "could not afford a single one" - those need
   different behaviour and they used to look identical. */
async function buyPotions() {
	const cfg = CONFIG.ranger.potions;
	let bought = 0;
	for (const kind of [cfg.hp, cfg.mp]) {
		const have = potionCount(kind);
		if (have >= cfg.buyTo) continue;
		let want = cfg.buyTo - have;

		const price = basePrice(kind);
		if (price !== null && price > 0) {
			const affordable = Math.floor(character.gold / price);
			if (affordable <= 0) continue;
			want = Math.min(want, affordable);
		}
		if (blocked(`buy ${want} ${kind}`)) continue;
		try { await buy(kind, want); bought += want; }
		catch (e) { log(`could not buy ${kind}: ${e && e.reason ? e.reason : e}`, 'orange'); }
	}
	return bought;
}

/* Is another potion trip worth making?

   Without this a character that cannot afford potions goes to town, buys
   nothing, returns, and is still low - so the next tick sends it to town
   again, forever. It never farms, so it never earns the gold for the potions
   it is going to town to buy. A new account deadlocks on the first tick.

   So a trip that bought nothing buys quiet instead: back out to the farm, and
   do not come in for potions again until the retry window is up. A ranger with
   no potions is a worse ranger, not a broken one - useRangerPotions simply
   finds none and the fight goes on. */
function potionTripDue() {
	if (!ranger.potionsUnaffordable) return true;
	return Date.now() - ranger.potionTripAt >= CONFIG.ranger.potions.retryMs;
}

/* Every trip to town scans, whatever brought us here.

   That is the spec's rule and it is also the cheap one: the walk is the
   expensive part, the scan is a synchronous read of parent.entities plus one
   post. A character that has walked to town for potions and does not scan has
   paid for the scan and thrown it away. */
async function townTrip(reason) {
	const spot = CONFIG.scout.townSpot;
	log(`town: ${reason}`, '#8b98ab');
	if (!atTownSpot() && !(await goTo(spot))) return false;
	if (reason === 'potions') {
		const got = await buyPotions();
		ranger.potionTripAt = Date.now();
		ranger.potionsUnaffordable = got === 0;
		if (got === 0) {
			log(`could not afford any potions (${character.gold} gold) - farming without them `
				+ `and trying again in ${Math.round(CONFIG.ranger.potions.retryMs / 60000)} min`, '#E9C46A');
		}
	}
	// Compounding is a town job too - Cue is in reach from this spot, and three
	// slots becoming one is worth more than the walk we have already paid for.
	// A no-op on a ranger, which is deliberate and explained at compoundPass:
	// the call stays here so that the merchant's own town trips run it.
	await compoundPass();
	ranger.lastTownTripAt = Date.now();
	return true;
}

function bagFull() {
	return freeSlots() <= CONFIG.ranger.freeSlotsFloor;
}

/* Bag full and not our bank window yet.

   The spec's instruction is to wait in town rather than drop anything, and to
   scan while waiting - which turns dead time into the one thing this character
   can still usefully do. Nothing is sold here: selling belongs after the bank
   window, once the bank has had its pick.

   Note this deliberately does NOT walk back out to farm in between. Killing
   things with no room to loot them is how a full bag stays full while looking
   busy. */
async function parkFull() {
	if (!fleetState.parkedFull) {
		fleetState.parkedFull = true;
		log(`bag full (${freeSlots()} free) - holding in town until the bank window`, '#E9C46A');
	}
	// Walk if we need to, then scan in the same tick. Returning after the walk
	// would spend a whole tick arriving and do nothing with it, which for a
	// character whose only remaining job is scanning is the wrong trade.
	if (!atTownSpot() && !(await goTo(CONFIG.scout.townSpot))) return;
}

/* Move to the farm spot and fight what is there. */
const LOOT = { at: 0, lastWarnAt: 0 };

/* Collect our own drops. Returns how many chests were opened.

   typeof, not truthiness. `get_chests ? ... : ...` would throw a
   ReferenceError if the helper were absent rather than falling back - that is
   exactly the bug that kept attackWithRotation from ever reaching attack(),
   and it is not worth repeating two functions later. parent.chests is the
   same data the helper reads.

   A refused loot breaks the batch rather than continuing: the usual reasons
   are rate limiting or a full bag, and both mean the rest of this batch will
   be refused too. The warning is throttled for the same reason the attack one
   is - a contested field refuses plenty, and a log line per refusal would bury
   everything else. */
async function lootTick() {
	if (bagFull()) return 0;
	if (Date.now() - LOOT.at < CONFIG.ranger.loot.everyMs) return 0;
	LOOT.at = Date.now();

	let chests = {};
	try {
		if (typeof get_chests === 'function') chests = get_chests() || {};
		else chests = (parent && parent.chests) || {};
	} catch (e) { return 0; }

	const here = myPos();
	const range = CONFIG.ranger.loot.range;
	const near = [];
	for (const id in chests) {
		const ch = chests[id];
		if (!ch) continue;
		const dx = (ch.x || 0) - here.x, dy = (ch.y || 0) - here.y;
		if (dx * dx + dy * dy <= range * range) near.push(id);
	}
	if (!near.length) return 0;

	let got = 0;
	for (const id of near) {
		if (got >= CONFIG.ranger.loot.perTick) break;
		if (bagFull()) break;
		try {
			await loot(id);
			got++;
		} catch (e) {
			const now = Date.now();
			if (now - LOOT.lastWarnAt > CONFIG.ranger.loot.warnEveryMs) {
				LOOT.lastWarnAt = now;
				log('loot refused: ' + (e && e.reason ? e.reason : JSON.stringify(e))
					+ ' (throttled - logged at most once a minute)', 'orange');
			}
			break;
		}
	}
	return got;
}

/* ---- Slenderman: hits of opportunity, never a trip ------------------------
   PORTED FROM Ranger.js 2026-10-11, on the owner's instruction to stop doing
   Slenderman but still swing at him if he is seen. He is in
   CONFIG.ranger.coopBosses.exclude, so neither the trip nor the coop in-reach
   swing will touch him; this is the only thing that does.

   WHY THERE IS NO TRIP TO BE HAD, same as in Ranger.js:
     * The spawn broadcast carries only { name, map } - no x/y - so
       bossWalkTarget() returns null for him and always will.
     * event_loop relocates him once a second to a random walkable node on a
       random one of cave/halloween/spookytown if ANY non-invisible player on
       his map comes within 600 units. A ranger's range is far short of that,
       so closing the gap IS the thing that teleports him away.
     * Only s.invis suppresses that trigger, and the first swing drops invis.
       Nobody holds him.

   So the only shot that exists is the one where he materialises on top of us,
   and this takes exactly that shot: no movement, no target commitment, no trip.

   PHYSICAL ATTACKERS ONLY. reflection:96 is gated on defense == 'resistance',
   which is set for MAGICAL damage only, so a magical attacker would send 96% of
   each cast into its own face. All three fleet rangers are physical, so this
   fires for them; the class is still read from G at runtime rather than assumed,
   so the block stays correct for the merchant in the roster - there it simply
   never fires.

   WHAT THE SHOT IS WORTH, measured from the deployed monster data rather than
   inherited from Ranger.js's comment: he carries no armor, no resistance and no
   evasion, but he DOES carry phresistance 95, which Ranger.js's note does not
   mention. Physical lands, at roughly a twentieth of its usual value, against
   66,666 hp. Treat this as a free poke and an achievement ticket, not as
   progress toward a kill - the achievements table wants kills, not hits.

   NO noHang HERE. This file has never had that helper (measured: 0 occurrences),
   and referencing an undeclared identifier THROWS rather than evaluating to
   undefined - the exact Form A failure that cost this file 37 dead ticks in
   attackWithRotation. The swing uses the same plain awaited use_skill in a
   try/catch that attackWithRotation already uses. */
const SLENDER_MAPS = new Set(['cave', 'halloween', 'spookytown']);
let slenderLastNote = 0;
function slenderNote() {
	if (Date.now() - slenderLastNote < 1000) return;
	slenderLastNote = Date.now();
	log('[slender] in range - taking the shot', '#B388FF');
	// Deliberately outside log(), which is gated on CONFIG.verbose. A shot at
	// something this rare should leave a trace even with logging turned down.
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

/* Returns true when the shot was taken and this tick is spent. */
async function slenderTick() {
	const slender = slenderOpportunity();
	if (!slender) return false;
	try { if (typeof change_target === 'function') change_target(slender); } catch (e) { }
	slenderNote();
	try { await use_skill('attack', slender); }
	catch (e) { log('[slender] shot refused: ' + (e && e.reason ? e.reason : e), 'orange'); }
	return true;
}



// ============================================================================
// RAGE BOXES - the geometry this file did not have
// ============================================================================
/* PORTED FROM Ranger.js 2026-10-11 at the owner's instruction, to make the
   achievement grind below possible. Almost all of it is verbatim: the geometry
   is geometry, and the numbers in rageCfg were paid for on the main account and
   must not be re-derived here. What changed is marked SOLO or ADAPTED.

   WHAT A RAGE BOX IS. G.maps[map].monsters[i] can carry a `rage` rectangle
   beside its `boundary`. Stepping inside aggros the whole pack AND applies the
   monster's own `rage` multiplier - 1.5 for booboo and mummy. Measured on
   spookytown: booboo's rage rectangle is IDENTICAL to its boundary, and
   farmCandidates hands out the boundary CENTRE, so the old standing point
   (415,-702) was dead centre of it. On the main account that cost three deaths
   and zero kills with the spawn never reached.

   Nothing here restricts movement OUTSIDE a rectangle. Closing, backing off and
   regrouping are untouched - the rectangle is the only thing that is solid.

   REQUIRES xmove and can_move, neither of which this file used before. Both are
   typeof-guarded at every site: referencing an undeclared identifier THROWS, and
   this file has already paid for that lesson once in attackWithRotation. With
   them missing, routing refuses to travel rather than walking a straight line
   through a rectangle. */
function rageLog(m, c) {
	log('[rage] ' + m, c || '#FF9F6B');
	console.log('[rage] ' + m);
}

/* ADAPTED: reads CONFIG.ranger.achievements.pull to match this file's nesting,
   and drops Ranger's ragePullShared, which was a party broadcast. Every NUMBER
   is Ranger's, and the comments explaining them are kept because they are the
   record of what was measured. */
function rageCfg() {
	const a = (CONFIG.ranger && CONFIG.ranger.achievements && CONFIG.ranger.achievements.pull) || {};
	return {
		enabled: a.enabled !== false,
		/* THE KNOB. How many of the target monsters may be in flight at once.
		   1 is the proven-safe start: one un-enraged booboo is 264 dps and one
		   mummy 317 after armor. On the main account that was measured against a
		   priest's ~1,499 hps, giving a ceiling of about four. THESE RANGERS HAVE
		   NO HEALER, so 1 is not a starting point to raise casually - it is the
		   number that makes a solo pull survivable at all. */
		concurrent: Math.max(1, a.concurrent || 1),
		/* MEASURED 2026-10-09 on the main account. rageRoute excludes cells
		   within margin + step of a rectangle, so 30 with a step of 25 was really
		   demanding 55 units of clearance. The spookytown corridor entrance is a
		   PINCH 14-18 units wide, so 55 never had a chance. 4 + 5 = 9 does, with
		   5 units of headroom. 8 + 5 = 13 was tried and FAILED against the live
		   map: the grid is anchored at the search window's corner, not the origin,
		   so with only 13..18 of usable band no lattice point landed in it.
		   KEEP margin + step AT OR BELOW 9 for this corridor. */
		margin: (typeof a.margin === 'number') ? a.margin : 4,
		/* 5, not 25. A 10-unit grid cannot resolve a 14-unit gap: the same search
		   that succeeds at step 5 reports NO ROUTE at step 10 at every margin,
		   which is what made a passable corridor look like a sealed pocket. */
		step: a.step || 5,
		/* Big enough that step 5 survives. The budget is spent BEFORE the grid is
		   built - too small and the doubling loop pushes the step back to 20 and
		   silently undoes the fix. Spookytown at step 5 is ~131,000 cells. */
		maxCells: a.maxCells || 200000,
		/* HYSTERESIS, and the reason nothing could move even when the route was
		   fine. The guard used to trip on the same margin the planner aims for,
		   so arriving at a correctly-planned spot WAS a breach: stop, shove out,
		   walk back, forever - 11 stop/xmove pairs in 5 seconds. The guard now
		   fires only on a real breach and escapes out to margin. */
		guardMargin: (typeof a.guardMargin === 'number') ? a.guardMargin : 0,
		parkWithin: a.parkWithin || 45,
		pullTimeoutMs: a.pullTimeoutMs || 20000,
		repullGapMs: (typeof a.repullGapMs === 'number') ? a.repullGapMs : 1200,
		respectCourage: a.respectCourage !== false,
		/* Interruptions are combat, not routing, so they get their own budget. */
		maxInterrupts: (typeof a.maxInterrupts === 'number') ? a.maxInterrupts : 12,
	};
}

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

function rageHit(map, x, y, margin) {
	const m = (typeof margin === 'number') ? margin : rageCfg().margin;
	const boxes = rageBoxes(map);
	for (let i = 0; i < boxes.length; i++) {
		const r = boxes[i].r;
		if (x >= r[0] - m && x <= r[2] + m && y >= r[1] - m && y <= r[3] + m) return boxes[i];
	}
	return null;
}

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

function rageRequiredRange(map, mon, margin) {
	const cfg = rageCfg();
	const m = (typeof margin === 'number') ? margin : cfg.margin;
	const b = rageHit(map, mon.x, mon.y, 0);
	if (!b) return 0;
	const r = b.r;
	const d = Math.min(mon.x - r[0], r[2] - mon.x, mon.y - r[1], r[3] - mon.y);
	return d + m + 2;
}

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

/* ADAPTED: Ranger consults CONFIG.movement.approaches for hand-pinned
   approaches. This file has no such table, so a route is always planned. The
   hook is kept so one can be added without touching rageWalk. */
function rageWaypoints(map, to, margin) {
	const hand = ((CONFIG.ranger && CONFIG.ranger.approaches) || {})[
		map + '|' + Math.round(to.x) + '|' + Math.round(to.y)];
	if (Array.isArray(hand) && hand.length) {
		const bad = hand.filter((p) => rageHit(map, p[0], p[1], margin));
		if (!bad.length) return hand.concat([[to.x, to.y]]);
		rageLog('ignoring the hand-pinned approach - ' + bad.length
			+ ' of its points sit inside a rectangle', 'orange');
	}
	return rageRoute(map, { x: character.x, y: character.y }, to, margin);
}

const rageNav = { busy: false };

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

/* Detect on the real rectangle, escape out to the planner's margin. Using one
   number for both is what pinned the main party in place for a whole run. */
async function rageGuard() {
	const cfg = rageCfg();
	if (!cfg.enabled) return false;
	let hit = null;
	try { hit = rageHit(character.map, character.x, character.y, cfg.guardMargin); }
	catch (e) { return false; }
	if (!hit) return false;
	rageLog('inside the ' + hit.type + ' rage box at ' + Math.round(character.x) + ','
		+ Math.round(character.y) + ' - leaving now', 'red');
	try { if (typeof stop === 'function') stop(); } catch (e) { }
	const e2 = rageEscape(character.map, character.x, character.y, cfg.margin);
	if (typeof xmove === 'function') {
		try { await xmove(e2.x, e2.y); }
		catch (err) { rageLog('escape move failed: ' + (err && err.message || err), 'red'); }
	}
	return true;
}

// ---- one-at-a-time pulling -------------------------------------------------
const ragePull = { openedAt: {}, lastPull: 0, busy: false };

/* The monsters this pull is for: the achievement target plus its `also`. */
function ragePullTypes() {
	const t = achvTarget();
	if (!t || !t.m) return [];
	const out = [t.m];
	for (const a of (Array.isArray(t.also) ? t.also : [])) if (out.indexOf(a) < 0) out.push(a);
	return out;
}

/* Active only where it is needed: the spot being farmed has to be one with a
   rage box on this map. Everywhere else the ordinary farm loop is untouched. */
function ragePullActive() {
	const cfg = rageCfg();
	if (!cfg.enabled) return false;
	if (!achvIsOurs()) return false;
	const t = achvTarget();
	if (!t || t.map !== character.map) return false;
	const types = ragePullTypes();
	if (!types.length) return false;
	for (const b of rageBoxes(character.map)) if (types.indexOf(b.type) >= 0) return true;
	return false;
}

function rageEngagedCount(types) {
	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	/* SOLO. Ranger counts anything targeting a PARTY member; these rangers are
	   alone on their shards, so the only name that can own a monster is ours. */
	const names = [character.name];
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

/* SOLO: Ranger picks the party member with the reach. There is only one of us,
   so the question is simply whether WE can reach it from outside the box. */
function ragePuller(map, mon) {
	const need = rageRequiredRange(map, mon);
	const reach = Math.max(20, (character.range || 0) - 6);
	return reach >= need ? { name: character.name, range: character.range || 0 } : null;
}

/* ADAPTED: parks at the achievement spot rather than Ranger's `destination`,
   and moves with safeMove so no leg crosses a rectangle. */
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
		if (!rageHit(map, e.x, e.y, 0)) continue;     // already outside - the loop takes it
		const d = Math.hypot(e.x - character.x, e.y - character.y);
		if (d < pickD) { pick = e; pickD = d; }
	}
	if (!pick) return false;

	if (!ragePuller(map, pick)) return false;         // cannot reach it from safety

	const need = rageRequiredRange(map, pick);
	const reach = Math.max(20, (character.range || 0) - 6);
	const b = rageHit(map, pick.x, pick.y, 0);
	if (!b) return false;
	/* Stand off the nearest edge, on the monster's side, never closer to the
	   rectangle than the margin. */
	const r = b.r;
	const edges = [
		{ x: r[0] - cfg.margin - 2, y: pick.y }, { x: r[2] + cfg.margin + 2, y: pick.y },
		{ x: pick.x, y: r[1] - cfg.margin - 2 }, { x: pick.x, y: r[3] + cfg.margin + 2 },
	];
	edges.sort((p, q) => Math.hypot(p.x - pick.x, p.y - pick.y) - Math.hypot(q.x - pick.x, q.y - pick.y));
	const spot = edges[0];
	if (Math.hypot(spot.x - pick.x, spot.y - pick.y) > reach) return false;

	const t = achvTarget();
	const park = { x: t.x, y: t.y };
	ragePull.busy = true;
	try {
		rageLog('pulling ' + pick.mtype + ' (need ' + Math.round(need)
			+ ', reach ' + Math.round(reach) + ')', '#FFD700');
		await safeMove(spot.x, spot.y);
		if (typeof attack === 'function' && typeof is_in_range === 'function' && is_in_range(pick)) {
			try {
				await attack(pick);
				ragePull.openedAt[pick.id] = Date.now();
				ragePull.lastPull = Date.now();
			} catch (e) { rageLog('open shot failed: ' + (e && e.reason || e && e.message || e), 'orange'); }
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
	rageLog(map + ': ' + (boxes.length
		? boxes.map((b) => b.type + ' [' + b.r.join(',') + ']').join('  ')
		: 'no rage boxes'), '#8b98ab');
	rageLog('pull ' + (ragePullActive() ? 'ACTIVE' : 'idle')
		+ ' | types ' + (ragePullTypes().join(',') || 'none')
		+ ' | concurrent ' + rageCfg().concurrent + ' | margin ' + rageCfg().margin
		+ ' | engaged ' + rageEngagedCount(ragePullTypes())
		+ ' | xmove ' + typeof xmove + ' | can_move ' + typeof can_move, '#8b98ab');
	return { boxes: boxes, types: ragePullTypes(), cfg: rageCfg() };
}


// ============================================================================
// ACHIEVEMENTS - a queued kill grind, off by default
// ============================================================================
/* Ported from Ranger.js 2026-10-11. The bookkeeping is Ranger's; what changed
   is how the spot is held. Ranger sets `manualOverride` and calls
   runFarmSearch(); this file has chooseSpot and ranger.spot, so the override is
   achvOverride and chooseSpot consults it first. -> CONFIG.ranger.achievements */
const ACHV_KEY = 'achv_queue';
let achvOverride = null;      // { m, map, x, y, also } - beats the scorer
let achvPaused = false;
let achvKills = 0;
let achvLastRefresh = 0;
let achvWarned = false;
let achvTravelFails = 0;

function achvCfg() {
	return (CONFIG.ranger && CONFIG.ranger.achievements) || { enabled: false, queue: [] };
}
function achvLog(m, c) {
	log('[achv] ' + m, c || '#9FD3FF');
	console.log('[achv] ' + m);
}
function achvLoad() {
	let s = null;
	try { s = SS.get(ACHV_KEY, null); } catch (e) { }
	if (!s || typeof s !== 'object') s = { i: 0, done: [] };
	if (typeof s.i !== 'number') s.i = 0;
	if (!Array.isArray(s.done)) s.done = [];
	return s;
}
function achvSave(s) {
	try { SS.set(ACHV_KEY, s); }
	catch (e) { achvLog('could not persist the queue - a reload restarts it', 'orange'); }
}
function achvTarget() {
	const q = achvCfg().queue || [];
	const s = achvLoad();
	return (s.i >= 0 && s.i < q.length) ? q[s.i] : null;
}

/* max(own + diff, account best) - the same expression the server uses to decide
   whether a rung is earned, so this cannot disagree with the game. */
function achvScore(m) {
	const t = (typeof parent !== 'undefined' && parent.tracker) || {};
	const own = t.monsters || {}, d = t.monsters_diff || {}, mx = (t.max && t.max.monsters) || {};
	return Math.max((own[m] || 0) + (d[m] || 0), (mx[m] || [0, 0])[0]);
}

/* Ask the server for a fresh tracker without letting it draw the panel. */
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

/* Take the spot. Whitelisting is what stops the travel blacklist from quietly
   removing an achievement spot that took a few tries to reach. */
function achvApply(t) {
	achvOverride = { m: t.m, map: t.map, x: t.x, y: t.y,
		also: Array.isArray(t.also) ? t.also.slice() : [] };
	achvKills = 0;
	achvTravelFails = 0;
	/* PRUNE, not just shadow. achvWhitelisted already makes isUnreachable
	   answer false for this spot, so the override would work either way - but a
	   stale entry left behind outlives the override and would take the spot the
	   moment achievements are turned off again. Ranger prunes here for the same
	   reason. -> travelBlacklist */
	try {
		const b = tbLoad();
		for (const n of [t.m].concat(Array.isArray(t.also) ? t.also : [])) {
			delete b[spotKey(n, t.map)];
			delete travelStrikes[spotKey(n, t.map)];
		}
		tbSave();
	} catch (e) { }
	ranger.spot = null;        // re-pick now rather than after checkEveryMs
	achvLog('holding ' + t.m + '@' + t.map + ' at ' + t.x + ',' + t.y
		+ (t.rung == null ? ' (no rung)' : ' for ' + t.rung), '#7FD98A');
}
function achvIsOurs() {
	const t = achvTarget();
	return !!(t && achvOverride && achvOverride.m === t.m && achvOverride.map === t.map);
}
/* Is this spot the achievement's? Consulted by isUnreachable so the blacklist
   leaves it alone, until maxTravelFailures releases it. */
function achvWhitelisted(monster, mapName) {
	if (!achvOverride) return false;
	if (achvOverride.map !== mapName) return false;
	if (achvOverride.m === monster) return true;
	return achvOverride.also.indexOf(monster) >= 0;
}
function achvNoteTravelFailure() {
	if (!achvOverride) return;
	achvTravelFails++;
	const max = achvCfg().maxTravelFailures || 10;
	if (achvTravelFails < max) return;
	achvLog('could not reach ' + achvOverride.m + '@' + achvOverride.map + ' in '
		+ max + ' tries - releasing the spot, achvResume() to retry', 'orange');
	achvPaused = true;
	achvOverride = null;
	ranger.spot = null;
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
		achvOverride = null;
		ranger.spot = null;
	}
}

/* The farm spot, when the queue owns it. DELIBERATELY bypasses the never-list
   and spotSafety: booboo is on both and that is the whole point of a manual
   grind. -> CONFIG.ranger.achievements */
function achvSpot() {
	if (!achvCfg().enabled || achvPaused) return null;
	if (!achvOverride) return null;
	return { map: achvOverride.map, monster: achvOverride.m,
		x: achvOverride.x, y: achvOverride.y,
		why: 'achievement grind (' + achvOverride.m
			+ (achvOverride.also.length ? ' + ' + achvOverride.also.join(', ') : '') + ')' };
}

async function achvTick() {
	const cfg = achvCfg();
	if (!cfg.enabled || achvPaused) return;
	const t = achvTarget();
	if (!t) return;

	if (!achvWarned && !(typeof parent !== 'undefined' && parent.tracker)) {
		achvWarned = true;
		achvLog('no tracker data - a tracker item must be in the bag or progress '
			+ 'cannot be read', 'orange');
	}
	if (!achvIsOurs()) { achvApply(t); return; }

	/* rung null = run until the toggle goes off, so there is no threshold to
	   race and nothing to refresh early for. */
	const base = achvScore(t.m);
	if (t.rung == null) { if (Date.now() - achvLastRefresh < cfg.refreshMs) return; }
	else if (Date.now() - achvLastRefresh < cfg.refreshMs && base + achvKills * 1.3 < t.rung) return;

	achvLastRefresh = Date.now();
	try { await achvRefresh(); } catch (e) { }
	achvKills = 0;
	const now = achvScore(t.m);
	if (t.rung == null) achvLog(t.m + ': ' + Math.round(now) + ' (no rung - running until stopped)', '#8b98ab');
	else if (now >= t.rung) { achvLog(t.m + ' reached ' + t.rung + ' (' + Math.round(now) + ')', '#00FF00'); achvAdvance('reached'); }
	else achvLog(t.m + ': ' + Math.round(now) + ' / ' + t.rung, '#8b98ab');
}

// ---- console helpers -------------------------------------------------------
function achvOn() {
	if (!CONFIG.ranger.achievements) CONFIG.ranger.achievements = { enabled: true, queue: [] };
	CONFIG.ranger.achievements.enabled = true;
	achvPaused = false;
	achvTravelFails = 0;
	const t = achvTarget();
	if (t) achvApply(t);
	achvLog('ON - in memory only, so a reload or a shard hop restores the file default. '
		+ 'This BYPASSES the never-list and refusePure for ' + (t ? t.m : 'the target')
		+ '; pull.concurrent ' + rageCfg().concurrent + ' and the rage guard are what keep it safe.', '#7FD98A');
}
function achvOff() {
	if (CONFIG.ranger.achievements) CONFIG.ranger.achievements.enabled = false;
	achvOverride = null;
	ranger.spot = null;
	achvLog('OFF - the spot goes back to the scorer', '#E9C46A');
}
function achvStop() { achvPaused = true; achvOverride = null; ranger.spot = null; achvLog('stopped - achvResume() to take it back', '#E9C46A'); return true; }
function achvResume() { achvPaused = false; achvTravelFails = 0; const t = achvTarget(); if (t) achvApply(t); achvLog('resumed', '#7FD98A'); return true; }
function achvSkip() { achvLog('skipped by hand', '#FFD700'); achvAdvance('skipped'); return achvTarget(); }
function achvReset(i) {
	const s = achvLoad();
	s.i = (typeof i === 'number') ? i : 0;
	s.done = [];
	achvSave(s);
	achvLog('queue index set to ' + s.i);
	const t = achvTarget();
	if (t && achvCfg().enabled && !achvPaused) achvApply(t);
	return t;
}
function achvStatus() {
	const cfg = achvCfg(), s = achvLoad(), t = achvTarget();
	achvLog('enabled=' + (cfg.enabled ? 'on' : 'off') + ' paused=' + achvPaused
		+ ' index=' + s.i + '/' + ((cfg.queue || []).length)
		+ ' tracker=' + (typeof parent !== 'undefined' && parent.tracker ? 'yes' : 'NO')
		+ ' travelFails=' + achvTravelFails);
	if (!t) { achvLog('queue finished or empty'); return; }
	achvLog('target ' + t.m + '@' + t.map + ' (' + t.x + ',' + t.y + ') rung='
		+ (t.rung == null ? 'null' : t.rung)
		+ (t.also ? ' also ' + t.also.join(',') : ''));
	achvLog('score ' + Math.round(achvScore(t.m)) + ' | ours=' + achvIsOurs()
		+ ' | pull ' + (ragePullActive() ? 'ACTIVE' : 'idle'));
	rageStatus();
}

// ============================================================================
// MONSTER HUNT - is THIS hunt worth doing, or do we wait out its clock
// ============================================================================
/* Added 2026-10-11 at the owner's instruction, and deliberately NOT a port of
   Dexon's version. His exists to pick the best hunt across three characters that
   talk over the party link; these three are alone on separate shards and never
   communicate. So the pool, the broadcast, the accept-wait and the best-pick are
   all absent by design, and what is left is one decision: grind the hunt we were
   handed, or leave it and let the clock run out.

   THERE IS NO REROLL, and that is a property of the server rather than a choice:
   while a hunt is held the server answers monsterhunt_already and leaves it
   untouched. Waiting is the only alternative to doing it, which is exactly what
   the owner asked for.

   CREDIT IS SHARD-LOCKED AND FAILS SILENTLY. monster_hunt_logic returns on its
   first line unless s.monsterhunt.sn === region + " " + server_name. These
   rangers hold one shard each and never hop, so this should never fire - but it
   is checked rather than assumed, because the failure is invisible: the kills
   land, the counter does not move, and nothing says why.

   ACCEPTING AND TURNING IN ARE THE SAME CALL - socket.emit('monsterhunt') with
   no arguments - and the server decides which it means from whether a finished
   hunt is held. s.monsterhunt is { id, c, ms, sn }; c reaching 0 is "done".

   DAISY IS NOT IN REACH OF townSpot. Measured 2026-10-11: she is at (126, -413),
   457 units from (-179, -72), where the furthest NPC that spot was chosen to
   cover sits at 286. townTrip() therefore cannot do this and the hunt gets its
   own destination, read from G rather than written down. */

function mhCfg() {
	return (CONFIG.ranger && CONFIG.ranger.monsterHunt) || { enabled: false };
}
function mhLog(m, c) { log('[hunt] ' + m, c || '#FFD700'); }

const mhState = {
	verdict: null,      // { key, ok, why, cand, estSec, at }
	lastNote: null,
	quietUntil: 0,      // set after a refusal, so we stop walking to Daisy
	startedAt: 0,       // when the current accepted hunt began
	daisyTripAt: 0,
};

function mhSelfHunt() {
	try { return (character.s && character.s.monsterhunt) || null; } catch (e) { return null; }
}
function mhShard() {
	try { return parent.server_region + ' ' + parent.server_identifier; } catch (e) { return null; }
}
function mhDaisySpot() { return npcSpot('main', 'monsterhunter'); }
function mhAtDaisy() {
	const d = mhDaisySpot();
	if (!d) return false;
	const me = myPos();
	if (me.map !== d.map) return false;
	// The NPC's range, not ours - same reasoning as townSpotRadius.
	return Math.hypot(me.x - d.x, me.y - d.y) <= (CONFIG.scout.townSpotRadius || 60);
}

/* Seconds to finish `count` kills at this spot. Throughput is the LESSER of how
   fast we can kill and how fast they come back: a two-spawn pack on a 60s
   respawn is supply-bound no matter how hard we hit. */
function mhEstimateSec(cand, count) {
	const mob = monsterDef(cand.type);
	if (!mob || !mob.hp) return null;
	const eff = Math.max(mitigated(myDps(), mob.armor || 0), 1);
	const byDamage = eff / mob.hp;
	const bySupply = (cand.count || 1) / Math.max(mob.respawn || 1, 0.25);
	const killRate = Math.min(byDamage, bySupply);
	if (!(killRate > 0)) return null;
	return (Number(count) || 1) / killRate;
}

/* The whole decision. Refusals are returned rather than logged so mhStatus can
   print the reason without re-running anything. */
function mhEvaluate(h) {
	const cfg = mhCfg();
	if (!h || !h.id) return { ok: false, why: 'no hunt held' };

	const shard = mhShard();
	if (shard && h.sn && h.sn !== shard) {
		return { ok: false, why: 'credit is locked to ' + h.sn + ', we are on ' + shard };
	}
	const mob = monsterDef(h.id);
	if (!mob) return { ok: false, why: h.id + ' is not in the game data' };
	/* A cooperative monster is a boss, and the boss path owns those on its own
	   rules - joining one somebody else is holding, never opening one alone. A
	   hunt is an instruction to kill a fixed number, which is the opposite. */
	if (mob.cooperative) return { ok: false, why: h.id + ' is a cooperative boss' };
	if (mob.damage_type === 'pure') return { ok: false, why: 'pure damage, unmitigable' };

	/* WHERE IT LIVES, and only among maps the owner has allowed. farmRanking.maps
	   is deliberately short because most maps are instances, dungeons or event
	   spaces a solo character has no business entering - so a hunt for something
	   that lives outside it is refused rather than walked to. This is the
	   err-on-the-side-of-safety rule doing most of its work. */
	/* farmCandidates is the one source for "where does it live", so the hunt
	   inherits the farm's map admission, its never-list and its unreachable
	   blacklist for free. The reasons it can come back empty are worth telling
	   apart: two are deliberate policy and one means the game moved.

	   This used to read "does not live on <allowed maps>", which was true while
	   maps was the hand-list ['main'] and became misleading the moment the list
	   was derived: a mummy hunt was refused with "does not live on any allowed
	   map" when mummy lives on spookytown, which IS admitted - it is the
	   never-list that refuses it, for the rage box. */
	const fr = CONFIG.ranger.farmRanking || {};
	if ((fr.never || []).indexOf(h.id) !== -1) {
		return { ok: false, why: h.id + ' is on the never-farm list' };
	}
	const spots = farmCandidates().filter((c) => c.type === h.id);
	if (!spots.length) {
		const scope = Array.isArray(fr.maps) ? fr.maps.join('/') : 'any farmable map';
		return { ok: false, why: h.id + ' does not live on ' + scope
			+ ' (or every spot for it is blacklisted as unreachable)' };
	}

	let best = null, firstRefusal = null;
	for (const cand of spots) {
		const safe = spotSafety(cand, cfg.huntSurvivalMargin);
		if (!safe.ok) { if (!firstRefusal) firstRefusal = safe.why; continue; }
		const est = mhEstimateSec(cand, h.c);
		if (est == null) { if (!firstRefusal) firstRefusal = 'cannot estimate a kill rate'; continue; }
		if (!best || est < best.estSec) best = { cand, estSec: est, ttk: safe.ttk };
	}
	if (!best) return { ok: false, why: firstRefusal || 'no safe spot for it' };

	const capSec = (cfg.maxEstMin || 0) * 60;
	if (capSec > 0 && best.estSec > capSec) {
		return { ok: false, why: Math.round(best.estSec / 60) + ' min of grinding, cap is '
			+ cfg.maxEstMin + ' min' };
	}
	/* And it has to fit the clock we actually have. Starting a grind that cannot
	   finish before the hunt expires spends the whole window for nothing - the
	   same waste as doing an unsafe one, minus the dying. */
	const leftSec = (Number(h.ms) || 0) / 1000;
	if (leftSec > 0 && best.estSec > leftSec) {
		return { ok: false, why: 'needs ' + Math.round(best.estSec / 60) + ' min, only '
			+ Math.round(leftSec / 60) + ' min left on its clock' };
	}
	return { ok: true, cand: best.cand, estSec: best.estSec,
		why: h.id + ' x' + h.c + ' in about ' + Math.round(best.estSec / 60) + ' min' };
}

/* Cached so the verdict is logged once rather than every tick, and re-graded on
   recheckMs because gear moves. Keyed on the hunt's identity, not its count -
   the count falls as we kill and would re-key on every single one. */
function mhVerdict() {
	const h = mhSelfHunt();
	if (!h || !h.id) { mhState.verdict = null; return { ok: false, why: 'no hunt held', h: null }; }
	const key = h.id + '|' + (h.sn || '');
	const cfg = mhCfg();
	const v = mhState.verdict;
	if (v && v.key === key && (Date.now() - v.at) < (cfg.recheckMs || 120000)) {
		return Object.assign({}, v, { h: h });
	}
	const out = mhEvaluate(h);
	out.key = key;
	out.at = Date.now();
	mhState.verdict = out;
	if (mhState.lastNote !== key + '|' + out.ok + '|' + out.why) {
		mhState.lastNote = key + '|' + out.ok + '|' + out.why;
		if (out.ok) { mhState.startedAt = mhState.startedAt || Date.now(); mhLog('taking ' + out.why, '#7FD98A'); }
		else { mhLog('leaving ' + h.id + ' x' + h.c + ' alone - ' + out.why
			+ '; waiting out its clock', '#E9C46A'); }
	}
	return Object.assign({}, out, { h: h });
}

/* The farm spot, when a hunt is worth doing. Consumed by chooseSpot, so every
   bit of travelling and attacking downstream is the ordinary farm path. */
function mhSpot() {
	const cfg = mhCfg();
	if (!cfg.enabled) return null;
	const v = mhVerdict();
	if (!v.ok || !v.cand) return null;
	if (mhState.startedAt && (Date.now() - mhState.startedAt) > (cfg.huntCapMs || 25 * 60 * 1000)) {
		if (mhState.lastNote !== 'capped|' + v.key) {
			mhState.lastNote = 'capped|' + v.key;
			mhLog('giving up on ' + v.h.id + ' - past the ' + Math.round((cfg.huntCapMs || 0) / 60000)
				+ ' min cap', '#E9C46A');
		}
		return null;
	}
	return { map: v.cand.map, monster: v.cand.type, x: v.cand.x, y: v.cand.y,
		why: 'monster hunt (' + v.h.id + ' x' + v.h.c + ')'
			+ (v.cand.spotSource === 'ranger' ? ' [measured spot]' : '') };
}

/* Returns true when it owned the tick. Only ever walks for two reasons: to bank
   a finished hunt, or to take one when we hold none. */
async function mhTick() {
	const cfg = mhCfg();
	if (!cfg.enabled) return false;
	if (myRole() !== 'ranger') return false;
	if (character.rip) return false;

	const h = mhSelfHunt();

	// A finished hunt is a token waiting to be banked, and the same emit hands
	// out the next one. Worth the trip on its own.
	const finished = !!(h && h.id && !h.c);
	if (!h || finished) {
		if (!finished && Date.now() < mhState.quietUntil) return false;
		const d = mhDaisySpot();
		if (!d) { mhLog('Daisy is not in the game data for main - cannot hunt', 'orange'); return false; }
		if (!mhAtDaisy()) {
			if (Date.now() - mhState.daisyTripAt < 5000) return false;   // one walk at a time
			mhState.daisyTripAt = Date.now();
			mhLog(finished ? 'walking to Daisy to bank ' + h.id : 'walking to Daisy for a hunt');
			await goTo(d);
			return true;
		}
		/* blocked() is the file's own gate and it is INVERTED: true means the
		   action must not happen. -> blocked */
		if (blocked(finished ? 'bank the finished ' + h.id + ' hunt at Daisy'
		                     : 'take a monster hunt from Daisy')) return true;
		try { parent.socket.emit('monsterhunt'); }
		catch (e) { mhLog('emit failed: ' + e, 'red'); return true; }
		mhState.startedAt = 0;
		mhState.verdict = null;
		const got = mhSelfHunt();
		mhLog(got && got.id ? 'holding ' + got.id + ' x' + got.c : 'asked for a hunt', '#7FD98A');
		return true;
	}

	/* We hold an unfinished hunt. Grade it; if it is not worth doing we do NOT
	   walk anywhere and do NOT reroll - the clock is the only way out, and
	   ordinary farming continues underneath. */
	const v = mhVerdict();
	if (!v.ok) { mhState.quietUntil = Date.now() + (cfg.retryMs || 5 * 60 * 1000); return false; }
	return false;   // viable: chooseSpot picks it up, the farm path does the rest
}

// ---- operator commands ----------------------------------------------------
function mhOn() {
	if (!CONFIG.ranger.monsterHunt) CONFIG.ranger.monsterHunt = {};
	CONFIG.ranger.monsterHunt.enabled = true;
	mhState.quietUntil = 0;
	mhState.verdict = null;
	mhLog('ON - in memory only, so a reload or a shard hop restores the file default', '#7FD98A');
}
function mhOff() {
	if (!CONFIG.ranger.monsterHunt) CONFIG.ranger.monsterHunt = {};
	CONFIG.ranger.monsterHunt.enabled = false;
	ranger.spot = null;    // hand the spot straight back to the scorer
	mhLog('OFF - ordinary farming resumes', '#E9C46A');
}
function mhStatus() {
	const cfg = mhCfg();
	const h = mhSelfHunt();
	mhLog('enabled=' + (cfg.enabled ? 'on' : 'off') + ' shard=' + mhShard()
		+ ' atDaisy=' + mhAtDaisy() + ' daisy=' + JSON.stringify(mhDaisySpot()));
	if (!h || !h.id) { mhLog('holding nothing'); return; }
	mhLog('holding ' + h.id + ' x' + h.c + ', ' + Math.round((Number(h.ms) || 0) / 60000)
		+ ' min left, sn=' + h.sn);
	const v = mhEvaluate(h);
	mhLog(v.ok ? 'VIABLE - ' + v.why : 'refused - ' + v.why, v.ok ? '#7FD98A' : '#E9C46A');
	if (v.ok) mhLog('  spot ' + v.cand.type + '@' + v.cand.map
		+ ' (' + v.cand.x + ', ' + v.cand.y + ')  est ' + Math.round(v.estSec) + 's');
}

async function farmTick() {
	const spot = chooseSpot();
	if (!spot || !spot.monster) return;

	/* Before anything else, including the walk below. A character that is about
	   to travel to a new pack should leave with the floor cleared, not abandon
	   its own drops - and chests expire. */
	await lootTick();

	/* ONE AT A TIME. Only active at an achievement spot that has a rage box on
	   this map; everywhere else it answers false immediately and the ordinary
	   loop below is untouched. -> ragePullTick */
	try { if (await ragePullTick()) return; } catch (e) { rageLog('pull tick threw: ' + e, 'red'); }

	/* Slenderman, before the boss path and before the farm target, and only if
	   he is already standing in our range. He is excluded from the boss list so
	   nothing here walks to him. -> Slenderman: hits of opportunity

	   Ahead of bossTick on purpose, mirroring Ranger.js. It costs a boss trip at
	   most one tick, and only in the moment he is physically on top of us -
	   which lasts about a second, because proximity is what relocates him. */
	if (await slenderTick()) return;

	/* A live boss event outranks the farm spot entirely: bossTick travels, and
	   while a trip is running it owns the tick so nothing below walks us back.
	   It also handles the attack itself, on the same rule as below.
	   -> the boss trip */
	if (await bossTick()) return;

	/* No trip, but a cooperative boss wandered into the farm spot and somebody
	   else is holding it: free credit, no travel. -> COOPERATIVE BOSSES */
	const boss = coopBossInReach();
	// -> bossStandOff: get out of its reach first, then swing.
	if (boss) { await bossStandOff(boss); await attackWithRotation(boss); return; }

	const target = get_nearest_monster({ type: spot.monster });
	/* Seeing one IS arrival, which is the only honest definition available here.
	   -> travelBlacklist */
	if (target) noteTravelSuccess(spot.monster, spot.map);
	if (!target) {
		// Nothing of ours in view: walk to the pack rather than standing idle.
		//
		// Ask the game where the monster lives FIRST. The old version walked to
		// the map's (0, 0) and then looked around, which on `main` is the town
		// end - goos are not visible from there, so a character that arrived
		// with an empty screen stood at the origin indefinitely. On a new
		// account that is every character's first tick, and it never farms.
		if (await goToMonster(spot.monster)) return;
		if (character.map !== spot.map) {
			if (!(await goTo({ map: spot.map, x: 0, y: 0 }))) noteTravelFailure(spot.monster, spot.map);
			return;
		}
		/* Last resort: the map's own spawn table.

		   What used to be here was another get_nearest_monster, with
		   no_target: true, described as looking "anywhere". It does not -
		   no_target means "not currently attacking anyone", which is NARROWER
		   than the call that just returned null, not wider. The branch could
		   never find anything the line above had missed. */
		/* The ranked spot carries the pack's own boundary centre, which is a
		   better destination than the map's spawn table entry - and for a spot
		   the table does not list at all, it is the only one. */
		const spawn = (typeof spot.x === 'number' && typeof spot.y === 'number' && (spot.x || spot.y))
			? { map: spot.map, x: spot.x, y: spot.y }
			: monsterSpawn(spot.map, spot.monster);
		/* EVERY route to this spot has now been tried and none of them landed.
		   That is the signal the blacklist wants - not one failed smart_move,
		   which is routine, but a whole tick that got nowhere. Three of these in
		   a row and the spot is set aside. -> travelBlacklist */
		if (!spawn || !(await goTo(spawn))) noteTravelFailure(spot.monster, spot.map);
		return;
	}

	if (!is_in_range(target)) { try { await move_toward(target); } catch (e) { } return; }
	await attackWithRotation(target);
}

let lastAttackWarnAt = 0;
const ATTACK_WARN_EVERY_MS = 60 * 1000;

/* Best available skill, then a plain attack. skillReady decides availability
   every time, so this needs no knowledge of what the character has unlocked. */
async function attackWithRotation(target) {
	/* NOTE the two helpers read `type` from different fields: here it is the
	   entity type ('monster'), while get_nearest_monster's `type` is the mtype
	   ('goo'). Same key, different field - the game's design, and easy to get
	   backwards. mtype is filtered separately below. */
	/* get_entities does not exist in this CODE context, and the old guard
	   `(get_entities ? ... : [])` did not protect against that: referencing an
	   UNDECLARED identifier throws a ReferenceError rather than evaluating to
	   undefined. Only typeof is safe. So this line threw on every single call,
	   attackWithRotation died before the rotation loop, the plain attack() below
	   was never reached, and rangerTick's catch turned it into a console.error
	   nobody was reading. Measured live on LorienSwifty: farmTick 37 calls,
	   attackWithRotation 37 calls, 37 throws, in 30 seconds - standing on the
	   goo spawn at (-32, 787) with a goo 9 units away, can_attack true and
	   in_attack_range true, at 0 xp gained.

	   This is what "the characters are not attacking" actually was. It was never
	   the scan/goTo race fixed in a7d415f - that race was real and the
	   `interrupted` log lines were real, but it was never the reason.

	   The fallback walks parent.entities directly, which is all the helper does.
	   no_target means "not currently attacking anyone", so !e.target is the
	   equivalent filter. */
	let nearby = [];
	try {
		if (typeof get_entities === 'function') {
			nearby = get_entities({ type: 'monster', no_target: true }) || [];
		} else {
			const ents = (parent && parent.entities) || {};
			for (const id in ents) {
				const e = ents[id];
				if (e && e.type === 'monster' && !e.dead && !e.target) nearby.push(e);
			}
		}
	} catch (e) { nearby = []; }
	/* The target goes in FIRST and unconditionally.

	   The pool was built from no_target entities only, and the monster we are
	   fighting is usually attacking us - so it had a target, was filtered out,
	   and a 3shot aimed at "three of these" hit three OTHER monsters while
	   leaving ours untouched. Pulling more of the pack in is the opposite of
	   what the rotation is for. */
	const same = [target].concat(
		nearby.filter((e) => e && e.mtype === target.mtype && e.id !== target.id));

	for (const step of RANGER_ROTATION) {
		if (!skillReady(step.skill)) continue;
		if (step.skipIf && step.skipIf(target)) continue;
		const pool = step.minTargets > 1 ? same.slice(0, step.minTargets) : null;
		if (pool && pool.length < step.minTargets) continue;
		try {
			await use_skill(step.skill, pool ? pool.map((e) => e.id) : target);
			/* A buff is a prelude to the swing, not a substitute for it.
			   `buff: true` has been on supershot and huntersmark since the rotation
			   was written and was read NOWHERE - so any ready buff ended the tick
			   and the attack below was skipped. That was masked by the ReferenceError
			   above (nothing ever got this far); fixing that alone would have
			   exposed it, because huntersmark costs 240mp against this ranger's 260
			   and so is "ready" on every full-mp tick. */
			if (!step.buff) return;
		} catch (e) {
			// A refused skill is information, not a crash. The gate let it
			// through, so something it cannot see said no - log once and fall
			// through to the next option rather than dropping the whole tick.
			log(`${step.skill} refused: ${e && e.reason ? e.reason : e}`, 'orange');
		}
	}
	/* achvKills feeds the eager rung check so a refresh happens before the
	   threshold is crossed rather than after. -> achvTick */
	if (achvIsOurs()) achvKills++;
	try { await attack(target); } catch (e) {
		/* This catch used to be empty, so every refused attack vanished. A
		   contested field refuses a lot of them - the target dies to someone
		   else between picking it and swinging, and the server answers
		   not_there - so this is throttled rather than logged every time.
		   Silence was the wrong trade: a character that cannot attack AT ALL
		   looked identical to one that was simply between targets. */
		const now = Date.now();
		if (now - lastAttackWarnAt > ATTACK_WARN_EVERY_MS) {
			lastAttackWarnAt = now;
			log('attack refused: ' + (e && e.reason ? e.reason : JSON.stringify(e))
				+ ' (throttled - logged at most once a minute)', 'orange');
		}
	}
}

/* Priority ladder. Ordered by what cannot wait, not by what is most common. */
async function rangerTick() {
	if (character.rip) { try { await respawn(); } catch (e) { } return; }
	useRangerPotions();
	/* BEFORE ANYTHING THAT MOVES. Standing in a rage box is the one state worth
	   leaving immediately, and it is ahead of the movement lock on purpose: the
	   lock is held by whatever walked us in. -> RAGE BOXES */
	try { if (await rageGuard()) return; } catch (e) { }
	/* In town for any reason at all, keep the beat - INCLUDING while a walk is
	   in progress.

	   This deliberately sits ahead of the movement lock and is deliberately not
	   awaited. An earlier version put it behind `if (fleetState.busy) return`
	   and then took that same lock, which meant no scan ever happened during a
	   smart_move - and a smart_move is most of what a character does in town.
	   The comment claimed it was outside the lock; it was not.

	   Not awaiting it is what makes travel scanning work: the tick returns and
	   the walk continues while the scan settles in the background under its own
	   lock. The catch is load-bearing, since nothing is awaiting this to
	   surface a rejection. */
	if (inTown()) {
	}

	if (fleetState.busy && !busyExpired()) return;

	const lock = takeBusy();
	try {
		if (isMyBankWindow()) {
			fleetState.parkedFull = false;
			await bankRun();
			return;
		}
		if (fleetState.stuck) { await parkFull(); return; }
		if (bagFull()) { await parkFull(); return; }
		fleetState.parkedFull = false;

		if (potionsLow() && potionTripDue()) { await townTrip('potions'); return; }
		/* Queue bookkeeping - tracker refresh and the rung check. Cheap, and it
		   never moves the character. -> ACHIEVEMENTS */
		try { await achvTick(); } catch (e) { console.error('achvTick error:', e); }
		/* Takes a hunt or banks a finished one, and owns the tick while it walks
		   to Daisy. A hunt it has refused returns false here and farming
		   continues underneath. -> MONSTER HUNT */
		if (await mhTick()) return;
		await farmTick();
	} catch (e) {
		console.error('rangerTick error:', e);
	} finally {
		freeBusy(lock);
	}
}

// ============================================================================
// GEAR - the plan, and what the account already has against it
// ============================================================================
/* The plan is three tiers deep per slot. "Progress" for a slot means the
   lowest tier whose target the character has not yet met - so a ranger wearing
   a tier-1 helmet at the tier-1 level is working on tier 2 for that slot, and
   the slots advance independently. Nothing here assumes a character is
   uniformly on one tier; in practice they never are. */

const GEAR_SLOTS = Object.keys(RANGER_GEAR[1]);   // tier 2 is fully populated

/* Every item the plan mentions, at any tier, with the tiers it appears in.
   Built once from RANGER_GEAR so the plan stays the single source of truth. */
const PLAN_INDEX = (() => {
	const idx = new Map();
	RANGER_GEAR.forEach((tier, t) => {
		for (const slot of Object.keys(tier)) {
			const spec = tier[slot];
			if (!spec) continue;
			let e = idx.get(spec.item);
			if (!e) { e = { item: spec.item, slots: new Set(), tiers: [] }; idx.set(spec.item, e); }
			e.slots.add(slot);
			e.tiers.push({ tier: t, slot, level: spec.level, method: spec.method });
		}
	});
	return idx;
})();

function isPlanItem(name) {
	return PLAN_INDEX.has(name);
}

function itemLevel(it) {
	return (it && it.level) || 0;
}

/* Does this item satisfy a plan entry? Name must match exactly; level must be
   at or above the target. A higher level than asked for still satisfies it -
   overshooting is not a reason to go looking for a replacement. */
function satisfies(it, spec) {
	if (!it || !spec) return false;
	if (it.name !== spec.item) return false;
	return itemLevel(it) >= spec.level;
}

/* The highest plan tier an item would satisfy in a slot, or -1 for none.

   Highest, not first. A tier-3 item usually also satisfies tier 2, and the
   ranger's helmet line is the clear case: tier 1 is helmet@6 while tiers 2 and
   3 are both fury. Reading the FIRST unsatisfied tier sent a character wearing
   fury@9 back to hunt a tier-1 helmet, because fury does not satisfy a spec
   that names helmet. Progress has to be measured by the best thing an item
   satisfies, never by the first thing it does not. */
function planTierOf(item, slot) {
	let best = -1;
	for (let t = 0; t < RANGER_GEAR.length; t++) {
		const spec = RANGER_GEAR[t][slot];
		if (spec && satisfies(item, spec)) best = t;
	}
	return best;
}

/* The furthest tier this slot has reached. Used for the "enough for three
   characters of the gear furthest along" rule - which is per slot, because
   that is the only reading under which it can be satisfied: a single pool of
   "three sets" across all slots is not something you can hold or act on,
   whereas three helmets is. */
function slotReachedTier(slot) {
	return planTierOf((character.slots && character.slots[slot]) || null, slot);
}

/* The slot's active goal: the next tier up from whatever it has reached.
   Returns null once tier 3 is met, which is the only "done" state there is. */
function slotGoal(slot) {
	const reached = slotReachedTier(slot);
	for (let t = reached + 1; t < RANGER_GEAR.length; t++) {
		const spec = RANGER_GEAR[t][slot];
		if (spec) return { ...spec, tier: t, slot };
	}
	return null;
}

// ---------------------------------------------------------------- inventories
function inventoryItems() {
	const out = [];
	const items = (character && character.items) || [];
	items.forEach((it, i) => { if (it && it.name) out.push({ ...it, where: 'inventory', idx: i }); });
	return out;
}

/* The bank is split across packs. Enumerate whatever packs are present rather
   than assuming how many there are - the number has changed with account
   upgrades and is not ours to hardcode. */
function bankPacks() {
	const b = (character && character.bank) || null;
	if (!b) return [];
	return Object.keys(b).filter((k) => k.indexOf('items') === 0 && Array.isArray(b[k]));
}

function bankItems() {
	const out = [];
	const b = (character && character.bank) || null;
	if (!b) return out;
	for (const pack of bankPacks()) {
		b[pack].forEach((it, i) => { if (it && it.name) out.push({ ...it, where: 'bank', pack, idx: i }); });
	}
	return out;
}

function equippedItems() {
	const out = [];
	const slots = (character && character.slots) || {};
	for (const slot of Object.keys(slots)) {
		const it = slots[slot];
		if (it && it.name) out.push({ ...it, where: 'equipped', slot });
	}
	return out;
}

/* How many copies of a named item the account holds where it counts.

   Worn and banked only - the spec's rule is about what the bank and the
   characters between them hold, and an item sitting in a bag on its way
   somewhere is in neither state yet. Counting it would let a bag in transit
   satisfy the quota and then leave with it. */
function copiesHeld(name) {
	let n = 0;
	for (const it of equippedItems()) if (it.name === name) n += (it.q || 1);
	for (const it of bankItems()) if (it.name === name) n += (it.q || 1);
	return n;
}

/* Should the bank take another of these?

   Base rule: three, one per character on the account that can use it.

   The exception matters more than it looks. Compounding consumes THREE copies
   to produce one, so a slot still below its compound target needs copies in
   flight well past the headcount - capping at three would starve the very
   upgrade the quota exists to serve, and the quota would look satisfied while
   progress stopped. Upgrade-method items have no such appetite: one is enough
   to work on, so they cap at three regardless. */
/* How many copies the account actually needs.

   copiesWanted is per CHARACTER, and some plan items fill two slots on the
   same character: dexearring is both earrings, dexring and suckerpunch are
   both rings. Three rangers therefore need SIX dexearrings, not three - and
   reading copiesWanted straight meant the bank called itself full at half
   stocked, refused to keep the next three, and left the merchant thinking a
   set that was still short was surplus. */
function slotsUsing(name) {
	const entry = PLAN_INDEX.get(name);
	return entry ? entry.slots.size : 0;
}

function neededCopies(name) {
	return CONFIG.gear.copiesWanted * Math.max(1, slotsUsing(name));
}

/* Copies beyond what every ranger can wear. This is the "enough for them and
   still extra" test, and it is deliberately separate from the decline ledger:
   a surplus this large needs no verdict from anyone, because no arrangement of
   the rangers could use it. */
function surplusCopies(name) {
	return copiesHeldRemote(name) - neededCopies(name);
}

function bankWantsMore(name, extraHeld) {
	const entry = PLAN_INDEX.get(name);
	if (!entry) return false;
	/* Counted remotely, which for a character standing in the bank is the same
	   count - copiesHeldRemote uses the live bank whenever there is one and
	   only falls back to the stored snapshot when there is not. That fallback
	   is the whole reason the merchant can answer this question from a town
	   spot three shards from where it banked.

	   extraHeld is for a pass that is part-way through acquiring copies: five
	   dexrings on one Ponty list would otherwise each be measured against the
	   same starting count and all five bought. */
	const held = copiesHeldRemote(name) + (extraHeld || 0);
	if (held < neededCopies(name)) return true;
	if (!CONFIG.gear.compoundOverstock) return false;

	// Is any tier that uses this item a compound target we have not reached?
	for (const use of entry.tiers) {
		if (use.method !== 'compound') continue;
		if (slotReachedTier(use.slot) < use.tier) return true;
	}
	return false;
}

// ============================================================================
// GEAR - the three decisions
// ============================================================================
/* Everything the bank window does reduces to asking these of each item:
   wear it, store it for someone else, or let it go. They are deliberately
   separate and deliberately ordered - equipping is checked first because an
   upgrade in hand is worth more than the same item in the bank, and selling
   last because it is the only irreversible one. */

/* Is `candidate` a better answer for `slot` than what is worn there?

   Measured in plan tiers first, then level within a tier. Only the plan's
   opinion counts: a higher-stat off-plan item is not an upgrade here, because
   the point of a plan shared across three characters is that they converge on
   the same items, and one that wanders off it stops being able to hand
   anything useful to the others.

   Note what this deliberately does NOT do: an item that is the NEXT tier's
   named item but not yet at its level - a raw fury@0 against a finished
   helmet@6 - is not an upgrade. Wearing it would drop the slot from reached
   tier 0 to reached nothing. It is raw material, and shouldBank sends it to
   the bank where the merchant can work on it. */
function betterForSlot(candidate, slot) {
	const planSlots = PLAN_INDEX.get(candidate.name);
	if (!planSlots || !planSlots.slots.has(slot)) return false;

	const worn = (character.slots && character.slots[slot]) || null;
	if (!worn) return true;                        // empty slot, anything on-plan beats nothing

	const mine = planTierOf(candidate, slot);
	const theirs = planTierOf(worn, slot);
	if (mine !== theirs) return mine > theirs;
	// Same tier: a higher level is progress toward the next one, but only when
	// it is the same item - levels are not comparable across item names.
	if (candidate.name !== worn.name) return false;
	return itemLevel(candidate) > itemLevel(worn);
}

/* Which slot, if any, this item should be worn in. An item can appear in more
   than one slot in the plan (two rings, two earrings), so this returns the
   first slot it actually improves rather than the first slot it belongs to. */
function slotToEquip(candidate) {
	/* The plan is a RANGER's, and this script runs on a merchant too.

	   Without this the merchant's bank window reads an empty helmet slot,
	   decides a fury is an upgrade for it, and tries to put a ranger's helmet
	   on a merchant - which the game refuses, so the whole pass stops on the
	   first item. Worse, shouldBank asks the same question: an item the
	   merchant "would equip" is one it never hands over, so the bank would
	   fill with gear it cannot use and cannot give away. */
	if (myRole() !== 'ranger') return null;
	const entry = PLAN_INDEX.get(candidate.name);
	if (!entry) return null;
	for (const slot of entry.slots) {
		if (betterForSlot(candidate, slot)) return slot;
	}
	return null;
}

/* Should this go in the bank for one of the others?

   Three conditions, all necessary: it is on the plan, it is not an upgrade for
   us right now, and the bank still wants copies of it. The middle one is what
   stops a character banking the item it is about to equip, and the last is
   what stops the bank filling with a fourth and fifth copy of something two
   characters already wear. */
/* Is this something the merchant is still part-way through?

   An item below the level the plan asks of it is raw material with work left
   in it, and the merchant is the character that does that work. It matters on
   both sides of the bank window: the merchant must not hand back what it is
   halfway through, and it should take out what it can carry on with. */
function isWorkItem(it) {
	const ceiling = planCeiling(it.name);
	if (ceiling === null) return false;
	return itemLevel(it) < ceiling;
}

function shouldBank(item) {
	/* Exchangeable goods go in whoever is carrying them and whatever the plan
	   thinks, because the bank is where they accumulate until there are enough
	   to exchange - that is the whole point of the `e` count.
	   -> EXCHANGEABLE ITEMS */
	if (isExchangeable(item.name)) return true;
	/* Craft inputs accumulate in the bank for the same reason exchangeables do:
	   a craft needs 40 or 80 of a thing at once, which is a bank's job and not a
	   bag's. -> CRAFT INPUTS */
	if (isCraftInput(item.name)) return true;
	/* Tokens go to the bank and stay there for a person to spend. Costs four
	   bank slots at the very most, whatever the count, since all four token
	   types stack to 9999. -> TOKENS */
	if (isToken(item.name)) return true;
	if (!isPlanItem(item.name)) return false;
	if (slotToEquip(item)) return false;
	if (myRole() === 'merchant') {
		// Advanced since the last window: hand it back to be judged, whatever
		// the copy count says. This is the return half of the ratchet and it
		// outranks everything below, including "the bank has enough of these" -
		// the point is the verdict, not the stock level.
		if (advancedThisWindow(item)) return true;
		// Otherwise the merchant keeps its work. Depositing a half-upgraded
		// item and withdrawing it again in the same window is not a bug that
		// breaks anything, which is exactly why it would go unnoticed.
		if (isWorkItem(item)) return false;
	}
	return bankWantsMore(item.name);
}

/* Should this be sold to an NPC?

   Only after the bank has had its pick, and never for tier 3 at any level -
   that is the spec's rule and it is the right one: a tier-3 name in the bag is
   either progress or the raw material for it.

   Beyond that, anything the plan mentions is spared while the bank still wants
   copies. An on-plan item the bank is full of is genuinely surplus and may
   go - otherwise a finished slot would keep accumulating copies nobody can
   use and nothing could ever be cleared. */
function shouldSell(item) {
	if (KEEP_ITEMS.has(item.name)) return false;
	if (NEVER_SELL.has(item.name)) return false;
	// Taken off this window - see displacedThisWindow. Ahead of the plan checks
	// because it does not matter what the plan or the copy count think: nobody
	// sells the piece a character was wearing twenty seconds ago.
	if (displacedThisWindow.has(item.name + '+' + itemLevel(item))) return false;
	// -> EXCHANGEABLE ITEMS. A Mystery Box is 12,000,000 to the right NPC and
	// nothing at all to the plan, so the plan must not be the one deciding.
	if (isExchangeable(item.name)) return false;
	/* -> CRAFT INPUTS. Ahead of the plan check on purpose: the plan has no
	   opinion about stormfeather or essenceofether, and "the plan does not want
	   it" is precisely the reading that would vendor them. */
	if (isCraftInput(item.name)) return false;
	/* -> TOKENS. Ahead of the plan check for exactly the reason craft inputs
	   are: the plan has no opinion about a monstertoken, and "the plan does not
	   want it" is the reading that was vendoring them. */
	if (isToken(item.name)) return false;
	if (isPlanItem(item.name) && bankWantsMore(item.name)) return false;
	return true;
}

/* ---------------------------------------------------------------- upgrading

   An upgrade raises one item by one level, at Cue, using a scroll from Lucas.
   Both are in reach of the town spot, which is why this character can run the
   account's gear economy without moving.

   WHAT IS DELIBERATELY NOT PORTED from Merchant.js: its expected-cost planner,
   which weighs scroll grades against offerings using the grace tables. Every
   option it can reach for that this one cannot is the reason - offerings come
   from Garwyn at (192, -564) and scroll3 from Crun on `level2`, and both are a
   journey. With no offering and only scroll0-2 available, the choice collapses
   to "the cheapest scroll that can carry this item's grade", which is what
   compoundScrollFor already does for compounds.

   A FAILED UPGRADE DESTROYS THE ITEM. Confirmed by the operator, and it is
   the fact everything below is shaped around - it makes an upgrade a purchase
   of a lottery ticket with the item as the stake, not a retryable step.

   What that costs, from the chance tables. Failure destroys the item AND all
   its progress, so producing one item at level N consumes, on average,
   1 / (p1 x p2 x ... x pN) fresh items. For an ordinary grade-0 item:

     +1  1.0 items      +4  1.5 items      +7   26 items
     +2  1.0            +5  2.6            +8   ~170
     +3  1.1            +6  6.4

   Those are conservative: the tables here carry no grace, the game's pity
   term, which only ever helps. But the shape is the point - it is flat to +3,
   bends at +5 and goes vertical after +6.

   THE RATCHET is what makes climbing it safe anyway. Nothing is staked that
   the rangers have not been shown and refused, one level at a time, so the
   account never loses gear it was using - only gear all three had already
   passed over. That is why there is no level cap here: see maxScrollSpend in
   CONFIG for what actually stops the climb, which is gold.

   THREE GUARDS:

     - minUpgradeChance, which reads the odds for THIS item. A higher-grade
       item has worse odds at every level, so one number cannot serve a pair
       of pants and a quiver alike.
     - maxScrollSpend, and affordability against the gold reserve. Scroll
       price steps hard with item grade, and grade is per ITEM: fury and
       supermittens are grade 2 from +0, so every attempt on them is 1.6M.
     - nothing that currently satisfies a plan tier is staked unless the
       rangers have declined it, or the account holds more copies than every
       slot on every character could wear. */
const MAX_SCROLL_GRADE = 2;          // scroll3 is Crun's, on level2, out of reach

/* Base success odds by item grade and TARGET level, lifted from Merchant.js.

   No grace term. Grace is the game's pity counter and only ever raises these,
   so every number here is a floor - which is the right direction for a guard
   that decides whether to stake an item. */
const UPGRADE_ODDS = {
	0: { 1: .9999999, 2: .98, 3: .95, 4: .7, 5: .6, 6: .4, 7: .25, 8: .15, 9: .07, 10: .024, 11: .14, 12: .11 },
	1: { 1: .99998, 2: .97, 3: .94, 4: .68, 5: .58, 6: .38, 7: .24, 8: .14, 9: .066, 10: .018, 11: .13, 12: .1 },
	2: { 1: .97, 2: .94, 3: .92, 4: .64, 5: .52, 6: .32, 7: .232, 8: .13, 9: .062, 10: .015, 11: .12, 12: .09 },
};

function itemGrade(name) {
	try { return item_grade({ name, level: 0 }) || 0; } catch (e) { return 0; }
}

/* The odds of the NEXT level landing. Null when the tables say nothing, which
   is treated as "do not stake it" rather than as "probably fine". */
function upgradeChance(item) {
	const row = UPGRADE_ODDS[Math.max(0, Math.min(2, itemGrade(item.name)))];
	const p = row && row[itemLevel(item) + 1];
	return (typeof p === 'number') ? p : null;
}

/* Is this item currently doing a job? An item that satisfies a plan tier in
   any of its slots is gear, not material - staking it is spending something
   the account already earned. */
function satisfiesATier(item) {
	const entry = PLAN_INDEX.get(item.name);
	if (!entry) return false;
	for (const slot of entry.slots) if (planTierOf(item, slot) >= 0) return true;
	return false;
}

/* May this item go under a scroll at all? Returns a reason when not, so the
   log says which guard stopped it rather than just going quiet. */
/* What an item costs, from the game's own data. Used for scrolls and for
   potions - both are "what will this purchase take out of the float". */
function basePrice(name) {
	try {
		const g = parent.G.items[name].g;
		return (typeof g === 'number' && isFinite(g)) ? g : null;
	} catch (e) { return null; }
}

function upgradeRefusal(item) {
	const ceiling = planCeiling(item.name);
	if (ceiling === null) return 'not an upgrade item on the plan';
	const level = itemLevel(item);
	/* THE CEILING IS THE PLAN'S OWN TARGET, not a level cap of ours.

	   There used to be an upgradeMaxLevel here, set at 6 to keep the account
	   from spending itself into the ground on a 2% roll. It is gone, and the
	   reason is that GOLD is the real limiter and it was already being
	   respected - the level cap was a second, blunter copy of a rule that
	   holds by itself.

	   The numbers, expected total gold to produce one finished item from raw,
	   read off the game's own scroll prices and odds tables:

	     helmet+6      32k        coat+9        19.1M      firebow+10    49B
	     firebow+5    501k        fury+4        11.1M      fury+8         3B
	     bcape+4      250k        t2quiver+7    76.4M      wingedboots+10 13B
	     dexbelt+3    858k        firebow+9    732.7M      orbofdex+5     2B

	   Tier 1 is small change. Tier 2 is a serious project. Tier 3 is not
	   reachable at all, and no cap of mine was ever what stopped it - the
	   merchant simply runs out of gold and holds, which is the correct
	   behaviour and needs no help. So the ratchet is allowed to climb as far
	   as the plan asks and stops where the wallet does. */
	if (level >= ceiling) return 'at the tier-3 target';
	const p = upgradeChance(item);
	if (p === null) return 'no odds for that level in the tables';
	if (p < CONFIG.merchant.minUpgradeChance) {
		return `${Math.round(p * 100)}% is below the ${Math.round(CONFIG.merchant.minUpgradeChance * 100)}% floor`;
	}
	const cost = basePrice(upgradeScrollFor(item));
	if (cost !== null) {
		if (cost > CONFIG.merchant.maxScrollSpend) {
			return `${upgradeScrollFor(item)} costs ${cost}, over the ${CONFIG.merchant.maxScrollSpend} per-attempt limit`;
		}
		if (cost > character.gold - CONFIG.merchant.leaveInBank) {
			return `cannot afford ${upgradeScrollFor(item)} (${cost}) and keep the reserve`;
		}
	}
	/* An item doing a job is only staked once the rangers have said they do
	   not want it - or once the account holds more than every ranger can wear,
	   which is the same conclusion reached by counting instead of by asking.
	   Either is enough; the decline is the one that unblocks tier progression,
	   because the count is exactly right most of the time. */
	if (satisfiesATier(item) && !provenDeclined(item) && surplusCopies(item.name) < 1) {
		return 'it satisfies a tier, no ranger has declined it yet, and there is no spare';
	}
	return null;
}

function upgradeScrollFor(item) {
	let grade = 0;
	try { grade = item_grade(item) || 0; } catch (e) { grade = 0; }
	return 'scroll' + Math.max(0, Math.min(MAX_SCROLL_GRADE, grade));
}

/* The highest level any tier of the plan asks of this item, in any slot.

   "Any slot" matters: pants appear at 6, 9 and 10 across the tiers, and a
   pair being pushed for a tier-1 character still has tier 3 as its ceiling.
   Stopping at the nearest target would park every item one tier short. */
function planCeiling(name) {
	let best = null;
	const entry = PLAN_INDEX.get(name);
	if (entry) {
		for (const use of entry.tiers) {
			if (use.method !== 'upgrade') continue;
			if (best === null || use.level > best) best = use.level;
		}
	}
	/* -> craftRequiredLevel. thundergrips wants mrngloves at +6, and mrngloves
	   is not in RANGER_GEAR at all - without this the merchant never takes one
	   out of the bank, because isWorkItem reads this function. */
	const need = craftRequiredLevel(name);
	if (need !== null && itemOperation(name) === 'upgrade'
		&& (best === null || need > best)) best = need;
	return best;
}

/* Which item to put under the scroll next.

   The lowest-level on-plan upgrade item that is still short of its ceiling.
   Lowest first because the early levels are nearly free - the chance tables
   start at .9999 for level 1 and are still above .9 at level 3 - so the same
   scroll spend moves a raw item several levels while it would buy a coin flip
   on something already at 9. */
function nextUpgradeTarget() {
	let best = null;
	for (const it of inventoryItems()) {
		if (advancedThisWindow(it)) continue;   // one level, then the rangers judge
		if (upgradeRefusal(it)) continue;
		if (!best || itemLevel(it) < itemLevel(best)) best = it;
	}
	return best;
}

async function tryUpgrade(item) {
	const scroll = upgradeScrollFor(item);
	let scrollIdx = findInventory(scroll);
	if (scrollIdx < 0) {
		try { await buy(scroll, 1); } catch (e) {
			log(`could not buy ${scroll} for ${item.name}: ${e && e.reason ? e.reason : e}`, 'orange');
			return false;
		}
		scrollIdx = findInventory(scroll);
		if (scrollIdx < 0) return false;
	}
	const p = upgradeChance(item);
	try {
		await upgrade(item.idx, scrollIdx);
		// The odds go in the log because the stake is the item. A run of these
		// with no successes is the difference between bad luck and a guard
		// that is set too low, and neither is visible without the number.
		noteAdvanced(item.name, itemLevel(item) + 1);
		log(`upgraded ${item.name}+${itemLevel(item)} with ${scroll} `
			+ `(${Math.round(p * 100)}% - the item is the stake). `
			+ `Back to the bank next window for the rangers to judge.`, '#7FD98A');
		return true;
	} catch (e) {
		// A refusal from the game, not a failed roll - a failed roll resolves
		// as a successful call that comes back with the item gone.
		log(`upgrade of ${item.name} refused: ${e && e.reason ? e.reason : e}`, 'orange');
		return false;
	}
}

/* Bounded, and bounded by gold as well as by count.

   An upgrade is a purchase, and this character's gold is also what pays for a
   Ponty listing that will not be there next hour. The floor is the same one
   the bank window uses: spend down to it and stop, rather than arriving at
   Ponty with an empty bag of gold and a stack of +1 pants. */
async function upgradePass(maxAttempts) {
	if (!CONFIG.merchant.upgrade) return 0;
	const first = nextUpgradeTarget();
	if (!first) return 0;
	if (blocked(`upgrade ${first.name}+${itemLevel(first)} with ${upgradeScrollFor(first)} `
		+ `(one level, then back to the bank for the rangers to judge; the plan `
		+ `wants +${planCeiling(first.name)})`)) return 0;

	let done = 0;
	for (let i = 0; i < (maxAttempts || 8); i++) {
		if (character.gold <= CONFIG.merchant.leaveInBank) {
			log('out of spending gold - stopping the upgrade pass', 'orange');
			break;
		}
		const target = nextUpgradeTarget();
		if (!target) break;
		// nextUpgradeTarget already skips anything advanced this window, so a
		// success here ends that item's climb until the rangers have seen it.
		// The loop continues only because there may be OTHER items to advance.
		if (await tryUpgrade(target)) done++;
		else break;                            // a refusal will just repeat
	}
	return done;
}

/* Items that can be compounded right now: three identical names at an
   identical level. Compounding is what the "buy the item to do so and combine
   them to save space" rule is about - three slots become one, and the result
   is a level higher than any of them. */
/* The highest level any tier asks of this item by COMPOUNDING. Null for an
   item no tier compounds - dexearring runs 1, 4, 5 across the tiers, while
   pants is an upgrade item at every tier and belongs to the other ceiling. */
function compoundCeiling(name) {
	let best = null;
	const entry = PLAN_INDEX.get(name);
	if (entry) {
		for (const use of entry.tiers) {
			if (use.method !== 'compound') continue;
			if (best === null || use.level > best) best = use.level;
		}
	}
	/* A RECIPE ASKS TOO. -> craftRequiredLevel. This is why the item does not
	   have to be in PLAN_INDEX at all: windbelt's input is dexbelt+2 whether or
	   not any tier still names dexbelt, so removing the tier-1 belt goal cannot
	   strand the input. */
	const need = craftRequiredLevel(name);
	if (need !== null && itemOperation(name) === 'compound'
		&& (best === null || need > best)) best = need;
	return best;
}

/* Why this triple should not go under a scroll, or null.

   A failed compound destroys ALL THREE, which makes this the most expensive
   refusal in the file to get wrong in either direction. */
function compoundRefusal(sample) {
	const ceiling = compoundCeiling(sample.name);
	if (ceiling === null) return 'no tier compounds this item';
	if (itemLevel(sample) >= ceiling) return 'already at the highest level any tier asks';
	const cost = basePrice(compoundScrollFor(sample));
	if (cost !== null) {
		if (cost > CONFIG.merchant.maxScrollSpend) {
			return `${compoundScrollFor(sample)} costs ${cost}, over the ${CONFIG.merchant.maxScrollSpend} per-attempt limit`;
		}
		if (cost > character.gold - CONFIG.merchant.leaveInBank) {
			return `cannot afford ${compoundScrollFor(sample)} (${cost}) and keep the reserve`;
		}
	}
	/* Three spare copies need no verdict from anyone: a compound consumes
	   three, and holding three MORE than every ranger can wear means no
	   arrangement of them could use these. That is the "take them out on first
	   sight" case, and it deliberately skips the decline wait. */
	if (surplusCopies(sample.name) >= 3) return null;
	if (satisfiesATier(sample) && !provenDeclined(sample) && surplusCopies(sample.name) < 1) {
		return 'it satisfies a tier, no ranger has declined it yet, and there is no spare';
	}
	return null;
}

function findCompoundTriples() {
	const groups = new Map();
	for (const it of inventoryItems()) {
		const key = it.name + '@' + itemLevel(it);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(it);
	}
	const out = [];
	for (const [key, list] of groups) {
		/* Used to return every group of three identical items in the bag,
		   which meant three identical drops got a scroll spent on them to
		   produce one slightly better drop. Now it is only ever a step the
		   plan actually asks for - and only on material the rangers have
		   passed over, since three items is a lot to lose on a 20% roll. */
		if (advancedThisWindow(list[0])) continue;   // one level, then the rangers judge
		if (compoundRefusal(list[0])) continue;
		for (let i = 0; i + 2 < list.length; i += 3) {
			out.push({
				name: list[i].name,
				level: itemLevel(list[i]),
				slots: [list[i].idx, list[i + 1].idx, list[i + 2].idx],
			});
		}
	}
	return out;
}

/* The scroll a compound needs, by the item's grade. Read from the game rather
   than mapped here: grade thresholds are item data and have moved before. */
function compoundScrollFor(item) {
	let grade = 0;
	try { grade = item_grade(item) || 0; } catch (e) { grade = 0; }
	return 'cscroll' + Math.max(0, Math.min(2, grade));
}

function findInventory(name) {
	const items = (character && character.items) || [];
	for (let i = 0; i < items.length; i++) if (items[i] && items[i].name === name) return i;
	return -1;
}

/* Buy the scroll if we do not have one, then compound. Returns true if a
   compound was actually attempted, so the caller can re-read the inventory
   rather than working from a stale picture - the slot indices move. */
async function tryCompound(triple) {
	const sample = { name: triple.name, level: triple.level };
	const scroll = compoundScrollFor(sample);
	let scrollIdx = findInventory(scroll);
	if (scrollIdx < 0) {
		try { await buy(scroll, 1); } catch (e) {
			log(`could not buy ${scroll} for ${triple.name}: ${e && e.reason ? e.reason : e}`, 'orange');
			return false;
		}
		scrollIdx = findInventory(scroll);
		if (scrollIdx < 0) return false;
	}
	try {
		await compound(triple.slots[0], triple.slots[1], triple.slots[2], scrollIdx);
		noteAdvanced(triple.name, triple.level + 1);
		log(`compounded 3x ${triple.name}+${triple.level} -> +${triple.level + 1}`, '#7FD98A');
		return true;
	} catch (e) {
		log(`compound of ${triple.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
		return false;
	}
}

/* One pass of compounding. Bounded, and re-reads between attempts because a
   successful compound renumbers every slot after the ones it consumed. */
async function compoundPass(maxAttempts) {
	/* THE MERCHANT ONLY.

	   Not a tidiness rule. A compound consumes three items to make one and
	   destroys all three when it fails, and a ranger deciding that from its
	   own bag is deciding it half-blind: it cannot see what the other two are
	   holding, cannot see the bank between windows, and has no way to know
	   whether the three in its bag are the account's only three. The merchant
	   can see all of it - that is what bankCompoundGroup exists for - and is
	   the only character the "offered and declined" test works on, since it is
	   the one that banks last.

	   So a ranger banks its spares and the merchant does the compounding. */
	if (myRole() !== 'merchant') return 0;
	const triples = findCompoundTriples();
	if (!triples.length) return 0;
	if (blocked(`compound ` + triples.map((t) => `3x ${t.name}+${t.level}`).join(', ')
		+ `, buying the scroll`)) return 0;

	let done = 0;
	for (let i = 0; i < (maxAttempts || 8); i++) {
		const triples = findCompoundTriples();
		if (!triples.length) break;
		if (await tryCompound(triples[0])) done++;
		else break;                                // a failure will just repeat
	}
	return done;
}

// ============================================================================
// THE BANK WINDOW
// ============================================================================
/* Four minutes, one character at a time, and the window is the only thing
   keeping two of them out of the bank at once - so every phase below re-checks
   it and stops rather than overrunning. Overrunning is not a slow bank trip,
   it is two characters in the bank.

   Order is deliberate and is not the order the spec lists them in:

     1. gold, because it is unconditional and cannot fail for want of space
     2. equip what we are already carrying - this changes what counts as an
        upgrade for everything after it, so doing it later would make the
        withdraw step ask the wrong question
     3. deposit spares, which FREES slots
     4. withdraw upgrades, which NEEDS them

   Doing 4 before 3 is the obvious ordering and the wrong one: a full bag
   cannot accept the item it came for. */

/* Each phase re-reads between operations rather than working from a list it
   built at the start, and is a bounded loop rather than a for-each over a
   snapshot.

   Not because the slots renumber - the bag and the bank packs are sparse
   arrays and a removed item leaves a null, so indices are stable. Because the
   operations are async against the game's own live state: anything can change
   under an await, an index read before one is an index that was true then, and
   a loop that keeps asking cannot act on a stale answer. The bound is what
   stops it asking forever when the answer never changes. */
const BANK_MAX_OPS = 30;

/* name+level of everything a swap pushed into the bag this window.

   The belt to bankDisplaced's braces. If the store succeeds the item is out of
   the bag and unsellable anyway, so this only matters when it failed - a full
   bank, a closed window, a refusal. That is exactly when the old behaviour did
   the damage, so the guarantee should not depend on the store working. Keyed by
   name AND level so a farmed duplicate of the same name is still fair game.
   Reset at the top of every bank run: it is a within-window fact, not a
   standing one. */
let displacedThisWindow = new Set();

function bankWindowOpen() {
	return isMyBankWindow();
}

async function bankDepositGold() {
	const keep = CONFIG.bank.rangerKeepGold;
	if (character.gold <= keep) return 0;
	const amount = character.gold - keep;
	if (blocked(`deposit ${amount} gold, keeping ${keep}`)) return 0;
	try {
		await bank_deposit(amount);
		log(`banked ${amount} gold`, '#7FD98A');
		return amount;
	} catch (e) {
		log(`bank_deposit failed: ${e && e.reason ? e.reason : e}`, 'red');
		return 0;
	}
}

/* Wear anything in the bag that improves a slot. Done before the bank is
   touched at all, because what we are wearing decides what the bank is asked
   for - ask first and we would withdraw a second copy of something already in
   our hand. */
/* `displaced` is an out-parameter: push each piece this pass takes OFF, so the
   caller can bank it. Read from character.slots immediately before the equip,
   because that is the only moment the outgoing item is still identifiable - a
   swap puts it in the bag and the slot now reads as the new one. */
async function bankEquipFromInventory(displaced) {
	const would = inventoryItems().map((it) => ({ it, slot: slotToEquip(it) })).filter((x) => x.slot);
	if (!would.length) return 0;
	if (blocked(`equip ` + would.map((x) => `${x.it.name}${itemLevel(x.it) ? '+' + itemLevel(x.it) : ''} -> ${x.slot}`).join(', '))) return 0;

	let done = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		let found = null;
		for (const it of inventoryItems()) {
			const slot = slotToEquip(it);
			if (slot) { found = { it, slot }; break; }
		}
		if (!found) break;
		const was = (character.slots && character.slots[found.slot]) || null;
		try {
			await equip(found.it.idx, found.slot);
			log(`equipped ${found.it.name}${itemLevel(found.it) ? '+' + itemLevel(found.it) : ''} to ${found.slot}`, '#7FD98A');
			done++;
			if (was && was.name) {
				const key = was.name + '+' + itemLevel(was);
				displacedThisWindow.add(key);
				if (displaced) displaced.push({ name: was.name, level: itemLevel(was) });
			}
		} catch (e) {
			log(`equip ${found.it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;             // a refusal will just repeat; stop rather than spin
		}
	}
	return done;
}

/* Hand the others what we are not using. shouldBank already refuses anything
   we would wear and anything the bank has enough of. */
async function bankDepositSpares() {
	const would = inventoryItems().filter(shouldBank);
	if (!would.length) return 0;
	if (blocked(`bank ` + would.map((i) => i.name + (itemLevel(i) ? '+' + itemLevel(i) : '')).join(', '))) return 0;

	let done = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		const it = inventoryItems().find(shouldBank);
		if (!it) break;
		try {
			await bank_store(it.idx);
			log(`banked ${it.name}${itemLevel(it) ? '+' + itemLevel(it) : ''}`, '#7FD98A');
			done++;
		} catch (e) {
			log(`bank_store ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
	}
	return done;
}

/* Put away what a swap just took off, before anything can sell it.

   The copy limit deliberately does NOT apply: bankWantsMore exists to stop the
   bank filling with farmed duplicates, not to discard gear that was being worn.

   Anything still equippable is skipped rather than banked, and that costs
   nothing - bankEquipFromInventory loops until no item in the bag is an upgrade
   for any slot, so a displaced ring that still beats the OTHER ring slot has
   already gone back on by the time this runs. The check is here for the case
   where it has not: better to leave it in the bag and bank it next window than
   to put away something the character should be wearing. */
async function bankDisplaced(displaced) {
	if (!displaced || !displaced.length) return 0;
	let stored = 0;
	for (const d of displaced) {
		if (!bankWindowOpen()) break;
		const tag = d.name + (d.level ? '+' + d.level : '');
		const it = inventoryItems().find((x) => x.name === d.name && itemLevel(x) === d.level);
		if (!it) continue;                 // re-equipped, or already gone
		if (slotToEquip(it)) continue;     // still an upgrade somewhere - keep it on
		if (blocked(`bank the displaced ${tag}`)) continue;
		try {
			await bank_store(it.idx);
			log(`banked the displaced ${tag}`, '#7FD98A');
			stored++;
		} catch (e) {
			const why = e && e.reason ? e.reason : e;
			log(`bank_store of the displaced ${tag} failed: ${why}`
				+ ` - keeping it, and shouldSell will not sell it`, 'orange');
			break;
		}
	}
	return stored;
}

/* Take out anything the others left that beats what we are wearing.

   Needs a free slot, so it runs after the deposit pass. The floor is the same
   one the farm loop uses: leaving with a bag at the brim means the next kill
   has nowhere to go, and the whole point of the window is to leave with room.

   Each item is worn as it comes out, inside the loop rather than in one pass
   afterwards. That is not tidiness - it is what lets a character with three
   free slots collect five upgrades. An item put on vacates the bag slot it
   arrived in, so withdraw-then-equip returns the slot before the next
   iteration asks for one; withdrawing everything first would stop at the floor
   with the rest still in the bank and nothing wrong reported.

   The floor check therefore only bites when an item comes out and STAYS in the
   bag - which means equip refused it. That is exactly when stopping is right,
   and it is why the guard is at the top of the loop rather than gone. */
async function bankWithdrawUpgrades() {
	const would = bankItems().filter((b) => slotToEquip(b));
	if (!would.length) return 0;
	if (blocked(`withdraw and wear ` + would.map((i) => i.name + (itemLevel(i) ? '+' + itemLevel(i) : '')).join(', ')
		+ ` (as many as the free-slot floor allows)`)) return 0;

	let done = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		if (freeSlots() <= CONFIG.ranger.freeSlotsFloor) {
			log('no room to withdraw more - leaving the rest for next window', 'orange');
			break;
		}
		const it = bankItems().find((b) => slotToEquip(b));
		if (!it) break;
		try {
			await bank_retrieve(it.pack, it.idx);
			log(`withdrew ${it.name}${itemLevel(it) ? '+' + itemLevel(it) : ''} from ${it.pack}`, '#7FD98A');
			done++;
		} catch (e) {
			log(`bank_retrieve ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
		/* Wear it, then put away whatever came off - both inside the loop, so
		   the swap never leaves a worn piece sitting in the bag where the sell
		   pass on the way out could reach it. */
		const displaced = [];
		await bankEquipFromInventory(displaced);
		await bankDisplaced(displaced);
	}
	return done;
}

/* Sell what is left, to Gabriel, from the town spot.

   AFTER the bank, never before. The bank gets first refusal on everything,
   because a spare the others can use is worth more in the bank than it is as
   gold - and once it is sold that judgement cannot be revisited. shouldSell
   guards it twice: never a tier-3 name at any level, and never an on-plan item
   the bank still wants.

   Gabriel is 129 units from the town spot, and both `buy` and `sell` are
   confirmed working at that distance - so this sells without walking, like
   everything else this character does from the spot. */
async function sellSurplus() {
	const would = inventoryItems().filter(shouldSell);
	if (!would.length) return 0;
	if (blocked(`sell ${would.length}: `
		+ would.map((i) => i.name + (itemLevel(i) ? '+' + itemLevel(i) : '') + (i.q > 1 ? ' x' + i.q : '')).join(', '))) return 0;

	let sold = 0;
	for (let i = 0; i < BANK_MAX_OPS; i++) {
		const it = inventoryItems().find(shouldSell);
		if (!it) break;
		try {
			await sell(it.idx, it.q || 1);
			sold++;
		} catch (e) {
			log(`sell ${it.name} failed: ${e && e.reason ? e.reason : e} - stopping`, 'orange');
			break;
		}
	}
	if (sold) log(`sold ${sold} surplus item(s)`, '#7FD98A');
	return sold;
}

/* Everything has been tried and the bag is still full.

   The bank would not take it, it is not sellable - which for this plan means
   it is tier-3 material, or on-plan and still wanted - and there is nowhere
   left to put it. Farming from here would loot into a bag with no room, so the
   character stops and says so rather than pretending to work.

   It keeps scanning, because that is the one thing it can still do that has
   value, and it is the reason this is a park rather than a halt. */
function stuckFull() {
	if (!fleetState.stuck) {
		fleetState.stuck = true;
		log(`bag still full after the bank window (${freeSlots()} free) - `
			+ `nothing left to bank or sell. Holding in town and scanning until `
			+ `someone looks at it.`, 'red');
	}
}

/* The window, start to finish. */
async function bankRun() {
	if (!(await goTo({ map: CONFIG.bank.map, x: 0, y: -100 }))) {
		log('could not reach the bank this window', 'orange');
		return;
	}

	await bankDepositGold();

	// character.bank is only populated while standing in it, so everything that
	// reads the bank has to happen here and cannot be deferred.
	if (!character.bank) {
		log('in the bank map but character.bank is not readable - gold only this window', 'orange');
	} else {
		/* Within-window record, so it cannot leak into a later run. */
		displacedThisWindow = new Set();
		/* The first pass displaces things too - it wears whatever the farm loop
		   picked up - and those land BEFORE the deposit pass, so that pass would
		   catch them while bankWantsMore allowed and sellSurplus would take the
		   rest. Banked here for the same reason as the ones inside the withdraw
		   loop. */
		const displaced = [];
		const worn = await bankEquipFromInventory(displaced);
		const putAway = await bankDisplaced(displaced);
		const given = await bankDepositSpares();
		const taken = await bankWithdrawUpgrades();
		if (worn || given || taken || putAway) {
			log(`gear pass: equipped ${worn}, banked ${putAway} displaced, `
				+ `banked ${given} spare, withdrew ${taken}`, '#7FD98A');
		}
	}

	saveBankSnapshot();
	await townTrip('bank window, on the way out');
	await sellSurplus();

	if (bagFull()) stuckFull();
	else fleetState.stuck = false;
}

// ============================================================================
// THE MERCHANT
// ============================================================================
/* One character, three jobs, and a standing rule that shapes all of them: it
   does not move.

   The town spot reaches Lucas, Cue, Gabriel and Ponty, and the whole stand
   cluster is inside the vision box from there - so scanning, shopping,
   upgrading and selling are all things this character does standing still.
   Position survives change_server, so it arrives on the spot after every hop
   with no walk at all. The bank run is the only sanctioned exception.

   It does not open a stand. Nothing here calls open_stand. */

/* Are we carrying hop sickness right now?

   Worth a named helper rather than an inline check, because the condition is
   easy to reason about wrongly. The live rule - node/server_functions.js
   declares serverhop_logic twice and the SECOND declaration wins, so the
   first, with its hop counting and tapering tiers, is dead code - is:

     arriving anywhere that is not player.p.home, at level >= 60, off PVP
     -> the flat condition from G: luck -80, gold -80, xp -80, output -20,
        for 12 minutes of online play

   Returning to p.home clears it immediately, because the same function deletes
   the condition before deciding whether to re-add it. Below level 60 it is
   never applied at all, which is why this reads the live flag rather than
   trying to predict it: the level gate, the home shard and the clock are all
   the server's business, and character.s is where it reports the answer. */
function hopSick() {
	try { return !!(character.s && character.s.hopsickness); } catch (e) { return false; }
}

// ------------------------------------------------------------ the anniversary
/* The featured player, from game state rather than chat.

   parent.S.anniversary is the primary source and the reliable one: live
   testing on 2026-09-17 had the chat announcement fail to fire for an entire
   round while S.anniversary.target stayed correct throughout. The chat parse
   is kept in the live merchant as a second source; it is not carried here,
   because this character has no chat listener and adding one to a script that
   reloads on every hop buys a less reliable source at the cost of a listener
   to get wrong. */
function featuredPlayer() {
	try {
		const a = parent && parent.S && parent.S.anniversary;
		if (a && a.live && a.target) return a.target;
	} catch (e) { }
	return null;
}

/* Where the featured player is, per game state. get_player only resolves
   players already nearby, so this is the only source that answers before we
   are next to them - which is exactly when it is needed. */
function featuredLocation() {
	try {
		const a = parent && parent.S && parent.S.anniversary;
		if (a && a.live && a.map) return { map: a.map, x: a.x, y: a.y };
	} catch (e) { }
	return null;
}

function featuredDistance(name) {
	try {
		const p = get_player(name);
		if (!p) return null;
		return distance(character, p);
	} catch (e) { return null; }
}

/* Kiss the featured player, but only if they came to us.

   THIS IS NARROWER THAN THE EVENT ALLOWS, and deliberately. The event expects
   you to travel to the featured player; the standing rule for this character
   is that a bank run is the only thing that moves it. Those two cannot both
   hold, so the movement rule wins and the kiss is opportunistic: if the
   featured player is standing within range of the town spot, take it - the
   whole stand cluster is in town and so is the kiss target often enough for
   this to be worth having. If they are not, note it once and carry on.

   CONFIG.merchant.kissMayWalk is the switch. Turning it on makes the kiss
   behave like the live merchant's - walk the round, take the reward - at the
   cost of the character leaving the spot, which is the thing the rest of this
   file is built around. It is off, and it is a decision rather than an
   oversight. */
const kissState = { attemptedFor: null, skippedFor: null, unreachableFor: null };

async function kissRound() {
	if (!CONFIG.merchant.kissEvent) return false;
	const name = featuredPlayer();
	if (!name) return false;

	// We cannot kiss ourselves, and get_player does not resolve our own name -
	// so an unguarded attempt walks to where we already are and spins there for
	// the whole round. Others come to us; there is nothing to do.
	if (name === character.name) {
		if (kissState.skippedFor !== name) {
			kissState.skippedFor = name;
			log('anniversary: we are the featured player - staying put for others to reach us', '#FF69B4');
		}
		return false;
	}
	if (kissState.attemptedFor === name) return false;

	/* Home only, and unknown counts as not home.

	   Deliberately ahead of the hop-sickness check, because it is the stricter
	   rule and subsumes it in the normal case: on home there is no sickness to
	   have. The sickness check stays below for the case that is not normal -
	   arriving home with the condition still on, in the seconds before the
	   server clears it. */
	if (CONFIG.merchant.kissHomeOnly) {
		const home = onHomeShard();
		if (home !== true) {
			if (kissState.skippedFor !== name) {
				kissState.skippedFor = name;
				log(home === null
					? `anniversary: skipping ${name} - cannot read character.home, and the `
						+ `rule is home only. See TASKS.md 5e.`
					: `anniversary: skipping ${name} - home is ${homeShard()}, we are on `
						+ `${shardKey(currentShard())}`, '#8b98ab');
			}
			return false;
		}
	}

	/* Hop sickness blocks the kiss REWARD outright. That is from G's own
	   explanation of the condition and it is not in the modifier list, so
	   nothing about luck/gold/xp/output hints at it - a sick merchant would
	   spend the round and collect nothing. */
	if (CONFIG.hop.skipKissWhileSick && hopSick()) {
		if (kissState.skippedFor !== name) {
			kissState.skippedFor = name;
			log(`anniversary: skipping ${name} - hop sick, the reward would be blocked`, 'orange');
		}
		return false;
	}

	const d = featuredDistance(name);
	if (d === null || d > CONFIG.merchant.kissRange) {
		if (!CONFIG.merchant.kissMayWalk) {
			if (kissState.unreachableFor !== name) {
				kissState.unreachableFor = name;
				log(`anniversary: ${name} is ${d === null ? 'not in sight' : Math.round(d) + ' away'} `
					+ `- not walking to them, this character only leaves the spot for the bank`, '#8b98ab');
			}
			return false;
		}
		// The switch is on: go to them, using the location game state carries
		// rather than waiting for get_player to resolve - it only answers for
		// players already nearby, which is the situation we are not in.
		const loc = featuredLocation();
		if (!loc || !(await goTo(loc))) return false;
		if ((featuredDistance(name) || Infinity) > CONFIG.merchant.kissRange) return false;
	}

	try {
		await use_skill('ikissyou', get_player(name));
		kissState.attemptedFor = name;         // the event rewards one visit per round
		log(`anniversary: kissed ${name}`, '#FF69B4');
		return true;
	} catch (e) {
		log(`anniversary: kiss on ${name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
		return false;
	}
}

// -------------------------------------------------------------------- the hop
/* Where to go next.

   It still takes a `reply` argument and still understands beats and rotations,
   because the shape came from MerchantScout and removing it would be a rewrite
   rather than a deletion. Nothing supplies one any more: merchantTick passes
   null, so every call falls through to the stored round-robin at the bottom,
   which was always the no-hints path. The paragraphs below describe what the
   hints MEANT, kept because a future caller could supply them again
   and this merchant is working the remainder. */
function nextShard(reply) {
	const cur = shardKey(currentShard());
	const own = serverList().map(shardKey);
	const toServer = (key) => serverList().find((s) => shardKey(s) === key) || null;

	const parked = new Set(Object.values((reply && reply.parked) || {}).filter(Boolean));
	const beat = (reply && Array.isArray(reply.beat)) ? reply.beat : [];
	if (beat.length) {
		const mine = beat.filter((k) => k !== cur && own.includes(k));
		if (mine.length) return toServer(mine[0]);
		// Our beat is one shard and we are on it. Staying is correct: it is
		// ours, and nobody else is coming.
		if (beat.length === 1 && beat[0] === cur) return null;
	}

	const rotation = (reply && Array.isArray(reply.rotation)) ? reply.rotation : [];
	if (rotation.length) {
		// A shard the bridge has never heard of is staler than any timestamp,
		// so those come first; the rotation itself is already ordered
		// oldest-first, which makes its head the shard most worth visiting.
		const known = new Set(rotation);
		const pool = [...own.filter((k) => !known.has(k)), ...rotation]
			.filter((k) => k !== cur && own.includes(k) && !parked.has(k));
		if (pool.length) return toServer(pool[0]);
	}

	// No hints, or every other shard is covered by a parked scout: round-robin,
	// so an outage never leaves the roamer sitting still. The index is stored
	// rather than held, because change_server reloads the page and a counter
	// that restarts at the top each hop re-walks the same few shards forever.
	const any = own.filter((k) => k !== cur);
	if (!any.length) return null;
	const i = SS.get('roamIdx', 0) % any.length;
	SS.set('roamIdx', i + 1);
	return toServer(any[i]);
}

/* Leave. Everything that has to survive the page reload goes first. */
async function hopTo(target) {
	if (!target || !target.region || !target.name) return false;
	const cur = currentShard();
	if (shardKey(cur) === shardKey(target)) return false;
	if (!canHop()) {
		log('server hopping unavailable here (no change_server / X.servers) - staying put', 'orange');
		return false;
	}
	const last = SS.get('lastHop', 0);
	if (Date.now() - last < CONFIG.hop.minIntervalMs) return false;

	saveBankSnapshot();                 // the bank is not readable from a shard

	/* mayHop cannot currently say no - its only condition was the bridge, which
	   is gone - but the call stays so a future one has a place to live. The
	   hop_blocked bookkeeping that used to sit here went with it: a latch that
	   can never be set reads as a live guard to the next person. */
	const may = mayHop();
	if (!may.ok) {
		log(`holding ${shardKey(cur)} rather than rotating: ${may.reason}`, 'orange');
		return false;
	}

	// Blocked AFTER the bank snapshot, which is a read and is exactly what a
	// rehearsal wants exercised. Only the reload stops.
	if (blocked(`hop ${shardKey(cur)} -> ${shardKey(target)}`)) return false;

	SS.set('lastHop', Date.now());
	log(`hopping ${shardKey(cur)} -> ${shardKey(target)}`, '#E9C46A');
	try {
		change_server(target.region, target.name);
		return true;
	} catch (e) {
		log('change_server failed: ' + e, 'red');
		return false;
	}
}

function hopDue() {
	return Date.now() - SS.get('lastHop', 0) >= CONFIG.hop.minIntervalMs;
}

// ------------------------------------------------------------- the merchant's
//                                                                 gold and bank
/* What the bank held when we last stood in it.

   character.bank is only populated inside the bank map, and this character
   spends its life on a town spot several shards from wherever it banked last.
   Every decision about whether to buy something - from Ponty, from Gabriel,
   anywhere - turns on how many copies the account already holds, and asking
   that question with no bank in sight answers "none" and buys a fourth.

   So the last reading is stored, with the time it was taken, and it survives
   the page reload that change_server performs. It is a snapshot and is treated
   as one: it is used for "do we already have enough", never for "take this
   specific item out". */
function saveBankSnapshot() {
	if (!character.bank) return false;
	const items = bankItems().map((it) => ({ name: it.name, level: it.level || 0, q: it.q || 1 }));
	SS.set('bank_snapshot', { at: Date.now(), items });
	return true;
}

function bankSnapshot() {
	const s = SS.get('bank_snapshot', null);
	return s && Array.isArray(s.items) ? s : null;
}

/* Copies the account holds, counted against the snapshot when the real bank is
   out of reach. Same rule as copiesHeld - worn and banked, never in-transit -
   but usable from a town spot three shards away. */
function copiesHeldRemote(name) {
	const worn = equippedItems().filter((it) => it.name === name).length;
	if (character.bank) return copiesHeld(name);
	const snap = bankSnapshot();
	if (!snap) return worn;
	return worn + snap.items.filter((it) => it.name === name).length;
}

/* The merchant's gold rule, the mirror of the rangers'.

   They deposit everything above a floor; it withdraws when it falls below one,
   and only down to leaveInBank. Nothing is deposited: this is the character
   that spends, and gold sitting in its bag is gold available to a Ponty
   listing that will be gone by the next window. */
async function merchantGold() {
	if (character.gold >= CONFIG.merchant.goldFloor) return 0;
	const inBank = (character.bank && character.bank.gold) || 0;
	const available = inBank - CONFIG.merchant.leaveInBank;
	if (available <= 0) {
		log(`gold is low (${character.gold}) and the bank cannot help `
			+ `(${inBank} held, ${CONFIG.merchant.leaveInBank} reserved)`, 'orange');
		return 0;
	}
	const want = Math.min(available, CONFIG.merchant.goldFloor - character.gold);
	if (blocked(`withdraw ${want} gold, leaving ${CONFIG.merchant.leaveInBank}`)) return 0;
	try {
		await bank_withdraw(want);
		log(`drew ${want} gold from the bank`, '#7FD98A');
		return want;
	} catch (e) {
		log(`bank_withdraw failed: ${e && e.reason ? e.reason : e}`, 'orange');
		return 0;
	}
}

/* Three copies of the same name at the same level, sitting in the bank.

   Compounding needs exactly that, and the three rangers each banking one
   spare is how it happens - none of them ever sees a triple in its own bag.
   The merchant is the only character that can see all three at once, which
   makes taking them out its job rather than a convenience. */
function bankCompoundGroup() {
	const groups = new Map();
	for (const it of bankItems()) {
		const key = it.name + '@' + itemLevel(it);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(it);
	}
	/* Surplus first, and on sight.

	   A group the rangers could not use between them - three copies MORE than
	   every slot on every character can hold - needs no verdict and no waiting
	   cycle, because there is no arrangement of them under which it is wanted.
	   Taking those first also means a bank holding both kinds spends its three
	   free slots on the one that is certainly free to use. */
	const ready = [];
	for (const [, list] of groups) {
		// Same refusal the compound itself would apply. Without this the
		// merchant fills three bag slots with a group it will then decline to
		// compound, every window, forever.
		if (list.length < 3 || compoundRefusal(list[0])) continue;
		ready.push(list);
	}
	if (!ready.length) return null;
	ready.sort((a, b) => surplusCopies(b[0].name) - surplusCopies(a[0].name));
	return ready[0].slice(0, 3);
}

/* What the merchant takes OUT of the bank: work, not gear.

   The rangers' version of this asks "does it beat what I am wearing", which
   for a merchant answers no to everything - it cannot wear any of it. The
   merchant's question is different: what can I carry on with? Two answers,
   in this order.

     1. a compound group, because three slots become one and the result is a
        level above all of them - it is the only operation here that makes the
        bag emptier;
     2. anything still short of what the plan asks, lowest first.

   The free-slot floor applies to both, and a compound group that will not fit
   whole is left for the next window rather than half-taken. */
async function merchantWithdrawWork() {
	const group = bankCompoundGroup();
	const work = bankItems().filter(isWorkItem);
	if (!group && !work.length) return 0;
	if (blocked(`take out `
		+ (group ? `3x ${group[0].name}+${itemLevel(group[0])} to compound` : '')
		+ (group && work.length ? '; ' : '')
		+ (work.length ? `work: ` + work.map((i) => i.name + '+' + itemLevel(i)).join(', ') : ''))) return 0;

	let taken = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		const group = bankCompoundGroup();
		if (group && freeSlots() - 3 > CONFIG.ranger.freeSlotsFloor) {
			let got = 0;
			// Highest index first. A precaution rather than a known requirement:
			// the packs are sparse arrays, so a removal should leave a null and
			// not shift anything, but this is the one loop here that acts on
			// three indices read at the same moment, and descending order is
			// correct under either behaviour.
			for (const it of [...group].sort((a, b) => b.idx - a.idx)) {
				try { await bank_retrieve(it.pack, it.idx); got++; taken++; }
				catch (e) { log(`bank_retrieve ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange'); break; }
			}
			if (got === 3) {
				log(`took 3x ${group[0].name}+${itemLevel(group[0])} out to compound`, '#7FD98A');
				continue;
			}
			break;
		}

		if (freeSlots() <= CONFIG.ranger.freeSlotsFloor) {
			log('no room to take more work out - leaving the rest for next window', 'orange');
			break;
		}
		const work = bankItems()
			.filter((b) => isWorkItem(b) && !advancedThisWindow(b) && !upgradeRefusal(b))
			.sort((a, b) => itemLevel(a) - itemLevel(b))[0];
		if (!work) break;
		try {
			await bank_retrieve(work.pack, work.idx);
			log(`took ${work.name}+${itemLevel(work)} out to work on`, '#7FD98A');
			taken++;
		} catch (e) {
			log(`bank_retrieve ${work.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
	}
	return taken;
}

/* The merchant's bank window.

   Same shape as the rangers' and a different set of phases, because the
   rangers come here to dress and the merchant comes here to restock. It does
   not equip: the plan is a ranger's, and a merchant cannot wear any of it. */
async function merchantBankRun() {
	if (!(await goTo({ map: CONFIG.bank.map, x: 0, y: -100 }))) {
		log('could not reach the bank this window', 'orange');
		return;
	}
	if (!character.bank) {
		log('in the bank map but character.bank is not readable - nothing to do this window', 'orange');
	} else {
		// FIRST, and before anything is deposited: read the bank as the rangers
		// left it. Anything put in during this window has not been offered yet.
		noteBankOffers();
		await merchantGold();
		const given = await bankDepositSpares();   // finished work, and this cycle's ratchet step
		const taken = await merchantWithdrawWork();
		if (given || taken) log(`gear pass: banked ${given}, took out ${taken}`, '#7FD98A');
		/* Cleared only now, after the deposit that handed this cycle's advanced
		   items back and the withdrawal that deliberately left them behind.
		   Clearing earlier would let the merchant take back the very item it
		   just advanced, and the rangers would never get their look at it. */
		SS.set('advanced', []);
		// Last thing before leaving, so the snapshot reflects the deposits and
		// withdrawals this window just made rather than the state it arrived in.
		saveBankSnapshot();
	}
	await goTo(CONFIG.scout.townSpot);
	await sellSurplus();
}

// ------------------------------------------------- offered, and declined ----
/* THE MERCHANT BANKS LAST, AND THAT IS WHAT MAKES THIS POSSIBLE.

   A failed upgrade destroys the item and a failed compound destroys three, so
   the question "is this one safe to stake" decides real losses. The static
   answer - does the account hold more copies than it needs - is weak: it stalls
   tier progression whenever the count is exactly right, which is most of the
   time, since three copies is what the plan aims for.

   The operator's answer is better, and it falls out of the bank rota. The
   windows are :00 :05 :10 for the rangers and :15 for the merchant, so between
   any two merchant visits EVERY ranger has had a window and has looked at the
   bank with bankWithdrawUpgrades - which takes anything that beats what it is
   wearing. An item still sitting there on the merchant's next visit has been
   offered to all three and declined by all three. They judged their own gear
   equal or better. It is surplus, demonstrated rather than counted, and the
   merchant may stake it on the next tier's target.

   TWO THINGS HAVE TO HOLD for the inference to mean anything, and both are
   checked rather than assumed:

     1. the merchant really is last in the rota. It is a config, and a roster
        edit that moves it breaks the inference silently. rotaSupportsDecline()
        tests it and says so.
     2. the rangers were actually ONLINE for their windows. A ranger that was
        offline never declined anything; its silence would read as a verdict.
        THIS IS NO LONGER CHECKED. The bridge used to answer it for free - its
        reply carried the live parked scouts by name - and with the bridge gone
        there is nothing left that can see another character. Removed knowingly
        on 2026-10-03 rather than left to fail closed forever; see the note at
        the gate itself in noteBankOffers.

   What it cannot cover: a ranger that is online but whose bank run failed - it
   could not path to the bank, or its window was eaten by a full bag. That reads
   as a decline and is not one. declineCycles
   is the answer to that: requiring two cycles makes it need the same failure
   twice running. */

function rosterRangers() {
	return Object.keys(CONFIG.characters).filter((n) => CONFIG.characters[n].role === 'ranger');
}

/* Is the merchant last in the rota? The whole inference rests on every ranger
   having had a window between two merchant visits, which is true exactly when
   the merchant's bank minute is the highest. */
function rotaSupportsDecline() {
	const mine = myBankMinute();
	if (mine === null) return false;
	return rosterRangers().every((n) => {
		const i = Object.keys(CONFIG.characters).indexOf(n);
		return (CONFIG.bank.firstWindowMinute + i * CONFIG.bank.staggerMinutes) % 60 < mine;
	});
}

const offerKey = (it) => it.name + '@' + itemLevel(it);

/* Read the bank as it was found, and age the ledger by one cycle.

   Called on ARRIVAL, before anything is deposited - an item the merchant puts
   in during this window has not been offered to anyone yet, and counting it
   would credit it with a cycle it never served. That also means a freshly
   deposited item needs to survive to the visit AFTER next, which is exactly
   the operator's "still there on the second bank run". */
function noteBankOffers() {
	const prev = SS.get('offer_log', null);
	const now = Date.now();
	const counts = {};
	for (const it of bankItems()) {
		const k = offerKey(it);
		counts[k] = (counts[k] || 0) + 1;
	}

	if (!prev) {
		SS.set('offer_log', { at: now, counts, cycles: {} });
		log('bank offer ledger started - nothing is provably surplus yet', '#8b98ab');
		return { qualified: false, reason: 'first visit' };
	}

	/* THE LIVENESS GATE IS GONE, deliberately, 2026-10-03.

	   It used to refuse to count a cycle unless every ranger had been seen since
	   the last window, and the only thing that ever saw them was the bridge's
	   reply - `parked` in noteReply. With the bridge removed nothing writes
	   rangers_seen, so the gate would have failed every single time, the ledger
	   would never have advanced, provenDeclined would never have become true, and
	   the merchant would have fallen back to the copy count for good. That is the
	   stall the startup banner warns about, arrived at silently.

	   So a cycle now counts whether or not a ranger was online: an item that sat
	   in the bank through a whole window and was not taken reads as declined. The
	   cost is that an offline ranger votes by absence, which is the behaviour this
	   gate existed to prevent - accepted knowingly rather than inherited. */

	const cycles = {};
	for (const k of Object.keys(counts)) {
		const held = Math.min(counts[k], prev.counts[k] || 0);
		// A count that dropped means a ranger took one - the rest were still
		// declined, so the survivors keep their history.
		cycles[k] = held > 0 ? ((prev.cycles && prev.cycles[k]) || 0) + 1 : 0;
	}
	SS.set('offer_log', { at: now, counts, cycles });

	const proven = Object.keys(cycles).filter((k) => cycles[k] >= CONFIG.merchant.declineCycles);
	if (proven.length) log(`offered and declined: ${proven.join(', ')}`, '#8b98ab');
	return { qualified: true, proven };
}

/* Has this item been offered to every ranger and left behind? */
/* THE RATCHET: one level, then hand it back.

   An item the merchant has advanced this window goes into the bank at the
   bank window and is NOT taken out again in the same visit. The rangers get
   their look at it on the next three windows, and the merchant either finds
   it gone - somebody wanted it - or finds it still there, which is a fresh
   decline and licence to push one more level.

   Why one level rather than running it to the target in a single window: the
   decline that authorised the stake was a verdict on the item AT THE LEVEL
   THE RANGERS SAW. A fury+4 nobody wanted says nothing about whether they
   want a fury+5, and pushing straight to +8 spends seven more stakes on one
   verdict. Stepping it returns the item for judgement at every level, which
   is what makes the whole climb safe rather than just its first rung. */
function advancedKeys() {
	return SS.get('advanced', []) || [];
}

function noteAdvanced(name, level) {
	const keys = advancedKeys();
	const k = name + '@' + level;
	if (!keys.includes(k)) { keys.push(k); SS.set('advanced', keys); }
}

function advancedThisWindow(item) {
	return advancedKeys().includes(offerKey(item));
}

function provenDeclined(item) {
	if (!CONFIG.merchant.requireDeclineToStake) return true;
	if (!rotaSupportsDecline()) return false;
	const log_ = SS.get('offer_log', null);
	if (!log_ || !log_.cycles) return false;
	return (log_.cycles[offerKey(item)] || 0) >= CONFIG.merchant.declineCycles;
}

// ------------------------------------------------------------------ Ponty
/* Ponty sells what other players have sold to him, per shard, and the stock
   turns over - which is why this is evaluated on arrival rather than saved for
   a bank window that might be forty minutes away.

   THE QUESTION IT ASKS is the same one the bank window asks, and it can only
   ask it because of the snapshot: is this on the plan, and does the account
   already hold enough copies? Asked with no bank in sight the answer is always
   "we have none", and the merchant buys a fourth and fifth copy of something
   two rangers are already wearing.

   PRICE IS NOT TRUSTED WHEN IT IS NOT A NUMBER. The field name for it has not
   been established on this version of the game - normalisePonty probes five
   spellings and falls back to the client's own valuation, and in practice it
   has been arriving null. An unknown price cannot be budgeted against, so an
   item with one is skipped rather than bought blind. A wrong price here is
   worse than no price: it is gold spent on a number nobody chose. */
async function pontyBuy(items) {
	if (!items || !items.length) return 0;
	if (typeof buy_from_pont !== 'function') {
		if (!SS.get('no_pont_buy', false)) {
			SS.set('no_pont_buy', true);
			log('buy_from_pont is not available on this client - reading Ponty, not buying from him', 'orange');
		}
		return 0;
	}
	const acquired = new Map();
	let bought = 0, unpriced = 0;
	if (CONFIG.safety.dryRun) {
		const want = items.filter((it) => isPlanItem(it.name) && bankWantsMore(it.name));
		if (want.length) {
			blocked(`buy from Ponty: ` + want.map((it) => `${it.name}${it.level ? '+' + it.level : ''} @ `
				+ (typeof it.price === 'number' ? it.price : 'no price, so it would be skipped')).join(', '));
		}
		return 0;
	}
	for (const it of items) {
		if (freeSlots() <= CONFIG.merchant.ponty.minFreeSlots) {
			log('bag too full to keep buying from Ponty', '#8b98ab');
			break;
		}
		const budget = character.gold - CONFIG.merchant.leaveInBank;
		if (budget <= 0) break;
		if (!isPlanItem(it.name)) continue;
		if (!bankWantsMore(it.name, acquired.get(it.name) || 0)) continue;
		if (typeof it.price !== 'number' || !isFinite(it.price)) { unpriced++; continue; }
		if (it.price > budget) continue;
		try {
			await buy_from_pont(it);
			acquired.set(it.name, (acquired.get(it.name) || 0) + 1);
			bought++;
			log(`bought ${it.name}${it.level ? '+' + it.level : ''} from Ponty for ${it.price}`, '#7FD98A');
		} catch (e) {
			log(`Ponty buy of ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
	}
	if (unpriced) {
		log(`${unpriced} Ponty listing(s) skipped for want of a price - `
			+ `the field name is still unconfirmed, see normalisePonty`, '#E9C46A');
	}
	return bought;
}

// -------------------------------------------------------------------- the tick
/* Priority ladder, same idea as the ranger's: ordered by what cannot wait.

   The bank window is the only thing that moves this character, so it is first.
   The kiss is next because the round is five minutes and does not come back.
   Everything else is standing on the spot reading the market. */
async function merchantTick() {
	if (character.rip) { try { await respawn(); } catch (e) { } return; }

	if (inTown()) {
	}
	if (fleetState.busy && !busyExpired()) return;

	const lock = takeBusy();
	try {
		if (isMyBankWindow()) { await merchantBankRun(); return; }

		// Back on the spot after a hop costs nothing - position survives
		// change_server, so this is a no-op on every tick but the first after a
		// bank run. goTo returns early when we are already there.
		if (!atTownSpot() && character.map === CONFIG.scout.townSpot.map) {
			await goTo(CONFIG.scout.townSpot);
		}

		if (await kissRound()) return;

		/* Both of these are town jobs done standing still: Cue is 150 from the
		   spot and Lucas 286, and neither needs a step. They run before the
		   hop for the obvious reason - after it we would be somewhere else,
		   with the same bag and different NPCs. */
		await compoundPass();
		await upgradePass();

		const key = shardKey(currentShard());
		if (pontyDue(key)) {
			const items = await pontyCheck({ mayMove: true });
			if (items) {
				pontySeen(key, Date.now());
				// Evaluated here, on arrival, because his stock is per shard and
				// turns over. Holding it for the bank window would be holding it
				// until after we had hopped away from it.
				await pontyBuy(items);
			}
		}
		if (hopDue()) {
			/* No reply to steer by now that the bridge is gone, so nextShard falls
			   through to its own stored round-robin - which it was already written
			   to do whenever the hints were missing. */
			const target = nextShard(null);
			if (target) await hopTo(target);
		}
	} catch (e) {
		console.error('merchantTick error:', e);
	} finally {
		freeBusy(lock);
	}
}

// ============================================================================
// STARTUP
// ============================================================================
/* One script, four characters, and the roster is what tells them apart. A name
   that is not in CONFIG.characters does nothing at all rather than guessing a
   role - an unknown character running the ranger loop would farm on someone
   else's shard and bank on someone else's minute. */
const TICK_MS = 1000;

function fleetTick() {
	const role = myRole();
	if (role === 'ranger') return rangerTick();
	if (role === 'merchant') return merchantTick();
	return null;
}

function startFleet() {
	const role = myRole();
	if (!role) {
		log(`${character.name} is not in the roster - doing nothing. `
			+ `Add it to CONFIG.characters to give it a job.`, 'red');
		return;
	}
	/* The mode goes in the banner, loudly. A rehearsal that is quietly live is
	   the expensive mistake here, and so is a live run everyone thinks is a
	   rehearsal - both are the same missing line. */
	if (CONFIG.safety.dryRun) {
		log('DRY RUN - nothing will be sold, spent, destroyed, moved between bank '
			+ 'and bag, or hopped. Scanning and walking are real.', '#E9C46A');
	}
	if (role === 'merchant' && CONFIG.merchant.requireDeclineToStake && !rotaSupportsDecline()) {
		log('the merchant does NOT hold the last bank window, so "offered and declined" '
			+ 'cannot be inferred - upgrades and compounds will fall back to the copy count, '
			+ 'which stalls tier progression. Reorder CONFIG.characters so the merchant is '
			+ 'last, or set merchant.requireDeclineToStake false to say this is deliberate.', 'red');
	}
	log(`${character.name}: ${role}, bank window at :${String(myBankMinute()).padStart(2, '0')}, `
		+ `on ${shardKey(currentShard())}${CONFIG.safety.dryRun ? ' [DRY RUN]' : ''}`, '#55BDF0');
	setInterval(() => {
		try { fleetTick(); } catch (e) { console.error('fleetTick error:', e); }
	}, TICK_MS);
}

/* Guarded, because this file is concatenated whole into its test harness.

   In the game FLEET_AUTOSTART does not exist and the script starts. The
   harness declares it false, which is the difference between running the
   suite and starting a one-second interval that farms against a stub and
   never lets the process exit. */
if (typeof FLEET_AUTOSTART === 'undefined' || FLEET_AUTOSTART) startFleet();
