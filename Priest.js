// ============================================================================
// FatherToken (Priest) - Mainframe slot CH_hae5t3g8gBezOVTdR6ToTagikbTbF - v32 (Measured 2026-09-26 with v58/v31/v54 live at cgoo/level2s: the derived hold band was honoured in the steady state - median nearest 134/129/134 against designed bands of 84-155, 129-192 and 84-196 - and incoming hits fell 27-50% (Dexon 54 to 37, FatherToken 190 to 138, MageofOz 50 to 25). The party still wiped. Dexon's last six seconds ran 92 to 72 to 47 to 27 to 10 units while attackers went 3 to 9, then he sat at 10 - inside his own 84 retreat threshold - and died; MageofOz bled 1,995 to 0 with ONE attacker while holding 59-95 against a 176 hold, unhealed because the other two were already down. So the band arithmetic was right and the DIRECTION was wrong: the scorer maximised distance from the single nearest monster, which inside an 11-cgoo pack means retreating into the other ten. XP went backwards 5.6M across the party in five minutes. His engine already scored the whole field, which is why it moved 164 times in that window where Dexon's moved 56 - so this is smaller. The gain-only weight sum became the shared signed, urgency-weighted kiteMultiWeight, so fleeing one monster into another now costs rather than merely failing to help. Step-length retry at 1, 1/2, 1/4. An ordered ladder plus a courage-gated pathfinder before giving up, instead of returning false straight away. Disengage mode acts BEFORE anything is in reach once attackers reach courage, and suspends the arena boundaryBox while escaping, because a fence that traps him mid-flight is worse than leaving it. Disengage matters most for him: he held 122-181 units, safely outside cgoo's 64 reach, and was still over courage for 53 of 297 samples, because fear counts who TARGETS you rather than who can reach you - and a feared priest stops healing, which is what killed all three. Note scare() is deployed but inert: no jacko on any character or in any bank pack, and it is a Halloween candy drop (candy0, weight 1 of ~6.5), so distance is doing all the work until one is acquired.) v31 (Kiting on, scare added, arena fence scoped. The jacko was already in two equipment loadouts and the skill was never cast once - he carried a 5-second aggro wipe through every fight unused, and he is the member it mattered most for: measured 2026-09-26 at cgoo he absorbed 190 of the party's 294 incoming hits and spent 49 of 239 one-second samples above courage 2, and a feared priest stops HEALING, which is what killed all three. scare() counts attackers and fires at courage, polled from maintenanceLoop - one tick of latency, ~1,500 damage into a 5,111 pool at the measured rate, which buys a cheap call site. kiting.enabled was false; it is on, with kiteCandidateTypes() adding anything we outrun by 1.3x to the hand-tuned avoidTypes list. The danger radius now comes from kiteThreatRadius(), so auras count and an unknown mtype no longer throws on .range of undefined. boundaryBox - the bscorpion arena rectangle - was rejecting every candidate position anywhere else on the map, so enabling kiting without scoping it would have silently done nothing outside that box; it applies only while a hand-listed threat is the one in danger range. cfg.moveDistance was dead config with the step hardcoded to 75; it is wired up. debug was true and drew the fence and every tangent line each tick. kiter() returns a boolean and the call site chains to walkInCircle() rather than replacing it.) v30 (The inventory sorter is gone, for the reasons in Ranger v57. It pinned tracker/computer/hpot1/mpot1/luckbooster/elixirluck/xptome to slots 0-6 from maintenanceLoop, and since swap() is an EXCHANGE it evicted whatever the operator dragged into one of those slots rather than just holding its own items there. Measured 2026-09-26 on Dexon: a hand move out of a pinned slot was undone within 500ms of landing. Nothing here depends on those positions - no numeric index into character.items exists in this file, and the only hp/mp-giving items held are hpot1 and mpot1, so the backwards scan in use('hp'/'mp') has nothing to mis-pick. The tracker stays protected by muling.excludeItems; the pin was never what protected it.) v29 (Tracktrix is no longer muled away. The item's name is tracker - Tracktrix is only its display label - and it was absent from muling.excludeItems, so clearInventory() handed it to Dexon, who passes everything on to Meltymerch, who vendors at seven gold. inventorySorter here already spelled it correctly as tracker: 0, and comparing the two files is what exposed Ranger's dead 'tracktrix' entry. Protected now on the same footing as tier-1 potions.) v28 (Chest looting starved. handleLooting() looted the first chestThreshold * 5 = 5 keys of the persisted chest map per pass and NEVER removed them, so it re-looted the same five ids forever while everything behind them was unreachable - the map was 9,465 entries deep on Dexon when this was measured 2026-09-25, with ~5,500 chests sitting within 800 units. Looted ids are now collected and deleted in one write per pass, loot() is wrapped per chest so one throw cannot abort the rest, and maxPerPass replaces the 5-per-pass cap. This file never had the performance.now() stamp bug that Ranger v54 and Mage v52 fix, because it has no timestamp gate at all. Looting costs no exp: loot is not a skill and shares no cooldown with attack.) v27 (Tier-0 potions are no longer protected. Measured 2026-09-25: the fleet holds zero hpot0 and zero mpot0 - all four characters and all three bank packs - and nothing acquires them, since every buy path is hpot1/mpot1 only. The 3,354 hpot0 that had piled up on FatherToken were cleared manually. Protection was never what kept tier 0 in use anyway: use_skill('use_hp'/'use_mp') resolves to use('hp'/'mp'), which scans character.items from the LAST slot BACKWARDS (adventureland_mongodb js/functions.js:4593) and drinks the first item whose gives matches, so tier is never consulted - slot position alone decides. That is why the priest's pile sat undrinkable at slot 0 underneath hpot1 at slot 2, and why unprotecting tier 0 on its own would have muled and vendored it rather than drawn it down. The stock COUNTS deliberately still read hpot0+hpot1 and mpot0+mpot1, so a stray tier-0 stack cannot mask an empty tier-1 bag and suppress a restock. Removed from muling.excludeItems.) v26 (Loop hang guard. Every loop here is an async function that schedules its next tick only after its body resolves, so an awaited call that never settles does not slow the loop down - it ends it, permanently and silently. Throws were already handled; hangs were not. Measured 2026-09-22 on Dexon: actionLoop 0 iterations in 20s where ~1300 were due, mainLoop dead in the same window (is_disabled, called every 250ms, not called once). He stood in range of crabs casting nothing and the party earned 0 xp until the page was reloaded - which is why a reload 'fixed' it each time. setInterval work (buffs, loot, keepalives) kept running throughout, so /hub showed a live, idle character. New noHang() bounds every await that appears directly in a loop body and rejects on timeout, landing in that loop's existing catch: the tick is lost, the chain is not. Same intent as travelWatchdog. It logs, throttled - a silent guard makes 'hung' and 'idle' indistinguishable.)
// ============================================================================
// ============================================================================
// FatherToken (Priest) - Mainframe slot CH_hae5t3g8gBezOVTdR6ToTagikbTbF - v25 (party frames brought in line with Dexon's: the block left-aligns on the left edge of the code-button row, re-measured every render rather than cached, which is where Dexon's R&M sits and where this character's kpm button lands once something dies - anchoring on the kpm text itself left the frames unanchored, and a thousand pixels wide off the right edge, between a reload and the first kill - measured by accumulating offsetLeft rather than getBoundingClientRect, since the UI is scaled 0.7502 and rects are device pixels while left/width are CSS pixels. The row is sized with max-content plus nowrap so no member count can wrap it, the merchant gets no frame (excluded by class, not name), the xp rate drops its XP/HR label and carries its own unit, and time-to-next-level moves to its own row. Also the DPS 'hit' listener is replaced rather than added to, with a guard so an orphan from a destroyed CODE frame cannot throw into socket.io's emit loop and abort the listeners behind it. Game log filter brought up to Dexon's: tabs wrap onto rows of four instead of being squeezed into one line, 'Upgr.' is written out as 'Upgrades', and a Noise tab (off by default) collects 'get closer', achievement-progress AP[...] lines and the courage messages. The filter rule is now one shouldShowEntry() shared by all three callers, and a MutationObserver watches #gamelog so entries the client writes through add_log - which never pass through addLogEntry, and which is how 'Get closer' was slipping past - are filtered on arrival rather than only when a tab is toggled.)
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

// ============================================================================
// CONFIGURATION - Toggle features here instead of editing code
// ============================================================================
// home/mobMap are no longer hardcoded here - Dexon (Ranger.js) is the
// source of truth and broadcasts them via a 'farm_spot' CODE message. These
// start null and get populated once that message arrives - see on_cm below.
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

const allBosses = ['bgoo', 'bscorpion', 'crabxx', 'dragold', 'ent', 'franky', 'greenjr', 'grinch', 'icegolem', 'jr', 'mrgreen', 'mrpumpkin', 'phoenix', 'rgoo', 'wabbit'];

const CONFIG = {
	combat: {
		/* Clears everything targeting us - jacko in the bag, 50 mp, 5s cooldown.
		   courageOffset 0 fires AT courage, pre-empting the attacker that would
		   start fear and stop him healing. See scare(). */
		scare: { enabled: true, courageOffset: 0, minHeldMs: 250 },
		curse: true,
		zapper: true,
		zapSwap: false,
		// home used to be baked in here, but it isn't known yet at load time
		// now - it's added dynamically wherever zapperMobs is actually used
		// (see updateHomeDependentSets() and handleCurse()).
		zapperMobs: [...allBosses, "sparkbot"],
		zapSpam: {
			enabled: true,
			mob: 'bscorpion',
			minMp: 2000
		},
		targetPriority: ['FatherToken'],
		allBosses,
	},

	movement: {
		enabled: true,
		circleWalk: true,
		circleRadius: 35,
		kiting: {
			enabled: true,
			/* Hand-tuned list - authoritative, never derived. See kiteThreatRadius(). */
			avoidTypes: ['bscorpion'],
			autoBySpeed: true,
			speedRatio: 1.3,
			attackMargin: 15,
			/* Flee even when not yet inside a danger radius, once this many monsters
			   target us. He is the member this matters most for: measured 2026-09-26
			   he held 122-181 units - safely outside cgoo's 64 reach - and was still
			   over courage for 53 of 297 samples, because fear counts who TARGETS
			   you, not who can reach you. A feared priest stops healing. */
			disengageOnCourage: true,
			disengageDistance: 70,
			avoidRadius: 300,
			rangeBuffer: 65,
			/* The bscorpion arena fence. It is applied ONLY while a hand-listed
			   avoidTypes threat is the one in danger range - as a global filter it
			   rejected every candidate position anywhere else on the map, so enabling
			   kiting without that scoping would have silently done nothing outside
			   this rectangle. Set to null to drop the fence entirely. */
			boundaryBox: [-650, -1385, -220, -1165], // [x1, y1, x2, y2]

			// Movement tuning
			moveThrottle: 50,  // ms between moves
			moveDistance: 50, // how far to move per step
			sampleAngles: 120, // directions to test (more = smoother)

			// Weighting
			goalWeight: 0.1, // how much to prefer moving toward goal
			safetyWeight: 1.0, // how much to prefer moving away from danger
			/* debug draws the fence and every tangent line on screen each tick -
			   fine while tuning one arena, far too noisy now kiting is general. */
			debug: false
		},
	},

	healing: {
		partyHealThreshold: 0.65,
		healOthers: true,
		healOthersThresh: 0.8,
		partyHealMinMp: 2000,
		absorb: true,
		darkBlessing: true
	},

	looting: {
		lootSet: "dreturn",
		enabled: true,
		chestThreshold: 1,
		// Bounds one pass; the old cap was chestThreshold * 5 = 5 per pass,
		// which could never drain a backlog of thousands.
		maxPerPass: 25,
		targetCount: 55,
		equipGoldGear: true,
		lootCooldown: 3000
	},

	equipment: {
		autoSwapSets: true,
		bossLuckSwitch: true,
		bossHpThresholds: {
			mrpumpkin: 300000,
			mrgreen: 300000,
			bscorpion: 75000,
			ent: 75000,
			crabxx: 40000,
			dragold: 200000,
			wabbit: 5000,
		},
		temporal: {
			enabled: true,
			targetMob: 'bscorpion',
			orbName: 'orboftemporal',
			skillName: 'temporalsurge',
			characters: ['FatherToken', 'Dexon', 'MageofOz'], // Rotation order
			storageKey: 'temporal_surge_rotation'
		}
	},

	potions: {
		autoBuy: true,
		hpThreshold: 400,
		mpThreshold: 500,
		minStock: 1000
	},

	party: {
		autoManage: true,
		groupMembers: ['Dexon', 'MageofOz', 'FatherToken']
	},

	muling: {
		enabled: true,
		muleName: 'Dexon',
		fallbackMuleName: 'Meltymerch',
		goldReserve: 500000,
		excludeItems: new Set(['hpot1', 'mpot1', 'tracker', 'luckbooster', 'goldbooster', 'xpbooster', 'elixirluck', 'xptome', 'essenceoflife']),
	},
};

// ============================================================================
// CONSTANTS - Named values instead of magic numbers
// ============================================================================
const TICK_RATE = {
	main: 100,         // Main game loop
	action: 15,        // Combat/skill actions - see CPU FIX note on actionLoop()
	maintenance: 2000  // Inventory, potions, etc
};
const MERCHANT_WAIT_TIMEOUT_MS = 90000; // safety net if merchant_done never arrives (e.g. merchant died mid-summon)

const COOLDOWNS = {
	equipSwap: 300,
	zapperSwap: 100,
	cc: 125
};

const EVENT_LOCATIONS = [
	{ name: 'dragold', map: 'cave', x: 1150, y: -850 },
	//{ name: 'crabxx', map: 'main', x: -961, y: 1780, join: true },
	{ name: 'mrgreen', map: 'spookytown', x: 610, y: 1000 },
	{ name: 'mrpumpkin', map: 'halloween', x: -222, y: 720 }
];

const getDynamicEvents = () => {
	const w = parent.S?.wabbit;
	return w?.live ? [...EVENT_LOCATIONS, { name: 'wabbit', map: w.map, x: w.x, y: w.y }] : EVENT_LOCATIONS;
}

const CACHE_TTL = 50; // Cache validity in ms

// ============================================================================
// STATE & CACHE
// ============================================================================
const state = {
	current: 'idle', // idle, looting, moving
	skinReady: false,
	lastEquipTime: 0,
	lastLootTime: 0,
	angle: 0,
	lastAngleUpdate: performance.now(),
	waitingForMerchant: false,
	waitingForMerchantSince: 0,
	restocking: false,
};

const cache = {
	target: null,
	healTarget: null,
	zapTargets: [],
	partyMembers: [],
	nearestBoss: null,
	lastUpdate: 0,

	isValid() {
		return performance.now() - this.lastUpdate < CACHE_TTL;
	},

	invalidate() {
		this.lastUpdate = 0;
	}
};

// ============================================================================
// LOCATION & EQUIPMENT DATA
// ============================================================================
const locations = {
	bat: [{ x: 1200, y: -782 }],
	bigbird: [{ x: 1258, y: -69 }],
	bluefairy: [{ x: -344, y: -680 }],
	bscorpion: [{ x: -555, y: -1158 }],
	boar: [{ x: 19, y: -1109 }],
	cgoo: [{ x: -221, y: -274 }],
	crab: [{ x: -11840, y: -37 }],
	dryad: [{ x: 403, y: -347 }],
	// 'ent' removed - no longer hardcoded here, comes from Dexon's
	// 'farm_spot' message instead (see destination, set in on_cm).
	fireroamer: [{ x: 222, y: -827 }],
	ghost: [{ x: -405, y: -1642 }],
	gscorpion: [{ x: 390, y: -1422 }],
	iceroamer: [{ x: 823, y: -45 }],
	mechagnome: [{ x: 0, y: 0 }],
	mole: [{ x: 14, y: -1072 }],
	mummy: [{ x: 256, y: -1417 }],
	odino: [{ x: -52, y: 756 }],
	oneeye: [{ x: -544, y: 94 }],
	pinkgoblin: [{ x: 485, y: 157 }],
	poisio: [{ x: -121, y: 1360 }],
	prat: [{ x: 11, y: 84 }],
	pppompom: [{ x: 292, y: -189 }],
	plantoid: [{ x: -780, y: -387 }],
	rat: [{ x: 6, y: 430 }],
	scorpion: [{ x: -495, y: 685 }],
	stoneworm: [{ x: 830, y: 7 }],
	sparkbot: [{ x: -544, y: -275 }],
	spider: [{ x: 895, y: -145 }],
	squig: [{ x: -1175, y: 422 }],
	targetron: [{ x: -544, y: -275 }],
	wolf: [{ x: 433, y: -2745 }],
	wolfie: [{ x: 113, y: -2014 }],
	xscorpion: [{ x: -495, y: 685 }]
};


// destination used to be built from a local locations[home] lookup - now
// it's set directly from Dexon's 'farm_spot' message (see on_cm below),
// since he's the authoritative source for where the farm spot is.
let destination = null;

// ============================================================================
// OWN XP ECONOMICS - reports the current farm spot to Dexon for blacklisting
// if THIS character (not the party average) is net-negative on xp/hour for
// a sustained period. Same 3-consecutive-bad-samples hysteresis as Dexon's
// own checkFarmEconomics() (xp gain is bursty, so one quiet minute isn't
// evidence), but per-character - catches a spot the aggregate model rated
// fine but that's actually killing one specific character.
//
// resetXpTracker() (called from on_cm on a real home/mobMap change) fully
// clears the streak so an old spot's bad streak can't get blamed on a new
// one, and sampling doesn't start until arrival - otherwise travel time
// would unfairly count against the spot.
// ============================================================================
const xpTracker = {
	lastXp: character.xp,
	lastLevel: character.level,
	lastCheckTime: Date.now(),
	consecutiveBadSamples: 0,
	trackedHome: null,      // home/mobMap this tracker's state belongs to - null forces a reset on the first real assignment
	trackedMobMap: null,
	arrivedAtSpot: false,   // sticky once true for this assignment - a later trip to town doesn't restart the clock
	assignedAt: 0,
	reportedUnreachable: false,
};

// Called from on_cm whenever a genuinely new farm spot arrives (home or
// mobMap actually changed) - starts xp tracking fully fresh so a bad streak
// from the old spot can't carry over and get blamed on the new one.
function resetXpTracker() {
	xpTracker.trackedHome = home;
	xpTracker.trackedMobMap = mobMap;
	xpTracker.consecutiveBadSamples = 0;
	xpTracker.arrivedAtSpot = (character.map === mobMap); // already there - no travel needed
	xpTracker.assignedAt = Date.now();
	xpTracker.reportedUnreachable = false;
	noteTravelTarget(destination);
	xpTracker.lastXp = character.xp;
	xpTracker.lastLevel = character.level;
	xpTracker.lastCheckTime = Date.now();
}

function checkOwnXpEconomics() {
	if (!home || !mobMap) return; // no farm spot assigned yet - nothing to blacklist

	// Safety net: this file only ever assigns trackedHome/trackedMobMap via
	// resetXpTracker(), so a mismatch here means on_cm's reset didn't run
	// for some reason - catch up now rather than silently attributing
	// samples to the wrong spot.
	if (home !== xpTracker.trackedHome || mobMap !== xpTracker.trackedMobMap) {
		resetXpTracker();
		return;
	}

	if (!xpTracker.arrivedAtSpot) {
		if (character.map === mobMap) {
			// Just arrived - start the real sampling clock from here, not
			// from whenever the spot was assigned (which may have included
			// travel time).
			xpTracker.arrivedAtSpot = true;
			travelArrived();
			xpTracker.lastXp = character.xp;
			xpTracker.lastLevel = character.level;
			xpTracker.lastCheckTime = Date.now();
			return;
		}

		// Still traveling. Judge the spot on failed travel ATTEMPTS, never on
		// elapsed time: this loop is independent of the one that travels, so a
		// clock here counts shard hops, live events and vendor trips against a
		// spot nobody tried to walk to. Three real failures - each of which has
		// already fallen back through town() - and Dexon hears about it.
		noteTravelTarget(destination);
		travelWatchdog(destination);
		if (!xpTracker.reportedUnreachable && travelState.failures >= TRAVEL.maxAttempts) {
			xpTracker.reportedUnreachable = true;
			const detail = travelFailureDetail();
			game_log(`Can't route to ${home}@${mobMap} (${detail}) - reporting to Dexon for blacklist`, 'red');
			plSend('Dexon', {
				message: 'blacklist_spot',
				home,
				mobMap,
				reason: `${character.name} couldn't route to ${home}@${mobMap} - ${detail}`,
				details: {
					attempts: travelState.failures,
					lastError: travelState.lastError,
					stoppedAt: travelState.lastDistance,
					assignedSecAgo: xpTracker.assignedAt ? Math.round((Date.now() - xpTracker.assignedAt) / 1000) : null,
				},
			});
		}
		return;
	}

	const now = Date.now();
	const elapsedSec = (now - xpTracker.lastCheckTime) / 1000;
	if (elapsedSec < 60) return; // sample roughly once a minute

	let xpGained;
	if (character.level > xpTracker.lastLevel) {
		// Leveled up during this window - character.xp resets at each
		// level, so a naive (current - previous) delta would read as a
		// huge false negative. Reconstruct the real total gained: finish
		// out the level we started the window on, add any full levels
		// passed through, then add however far into the current level we
		// are now. Multi-level-ups within one 60s window are rare, but
		// this handles them correctly rather than just the common
		// single-level case.
		let total = (G.levels[xpTracker.lastLevel] || 0) - xpTracker.lastXp;
		for (let lvl = xpTracker.lastLevel + 1; lvl < character.level; lvl++) {
			total += G.levels[lvl] || 0;
		}
		xpGained = total + character.xp;
	} else {
		xpGained = character.xp - xpTracker.lastXp; // can be negative - death xp loss with no offsetting kills this window
	}

	const xpPerSecond = xpGained / elapsedSec;

	if (xpPerSecond <= 0) {
		xpTracker.consecutiveBadSamples++;
		if (xpTracker.consecutiveBadSamples >= 3) {
			game_log(`Net-negative xp for ${xpTracker.consecutiveBadSamples} consecutive minutes at ${home}@${mobMap} - reporting to Dexon for blacklist`, 'red');
			plSend('Dexon', {
				message: 'blacklist_spot',
				home,
				mobMap,
				reason: `${character.name} net-negative xp/hr (${xpPerSecond.toFixed(2)} xp/s over ${xpTracker.consecutiveBadSamples} min)`,
			});
			xpTracker.consecutiveBadSamples = 0; // reset so we don't spam repeated reports for the same spot while waiting on Dexon to react
		}
	} else {
		xpTracker.consecutiveBadSamples = 0; // one good sample clears the streak
	}

	xpTracker.lastXp = character.xp;
	xpTracker.lastLevel = character.level;
	xpTracker.lastCheckTime = now;
}

const equipmentSets = {
	zapOn: [
		{ itemName: "zapper", slot: "ring2", level: 2, l: "u" }
	],
	zapOff: [
		{ itemName: "ringofluck", slot: "ring2", level: 2, l: "l" }
	],
	luck: [
		{ itemName: "xhelmet", slot: "helmet", level: 9, l: "l" },
		//{ itemName: "vattire", slot: "chest", level: 8, l: "l" },
		{ itemName: "tshirt88", slot: "chest", level: 4, l: "l" },
		{ itemName: "starkillers", slot: "pants", level: 9, l: "l" },
		{ itemName: "wingedboots", slot: "shoes", level: 9, l: "l" },
		{ itemName: "mpxgloves", slot: "gloves", level: 7, l: "l" },
		{ itemName: "sbelt", slot: "belt", level: 3, l: "l" },
		{ itemName: "lmace", slot: "mainhand", level: 9, l: "l" },
		{ itemName: "mshield", slot: "offhand", level: 10, l: "l" },
		{ itemName: "ringofluck", slot: "ring1", level: 2, l: "u" },
		{ itemName: "ringofluck", slot: "ring2", level: 2, l: "l" },
		{ itemName: "rabbitsfoot", slot: "orb", level: 3, l: "l" },
		{ itemName: "mpxamulet", slot: "amulet", level: 1, l: "l" },
		//{ itemName: "spookyamulet", slot: "amulet", level: 3, l: "l" },
		{ itemName: "bcape", slot: "cape", level: 8, l: "l" },
		{ itemName: "mearring", slot: "earring1", level: 2, l: "l" },
		{ itemName: "mearring", slot: "earring2", level: 1, l: "u" }
	],
	maxLuck: [
		{ itemName: "eears", slot: "helmet", level: 5, l: "l" },
		{ itemName: "tshirt88", slot: "chest", level: 4, l: "l" },
		{ itemName: "xmaspants", slot: "pants", level: 3, l: "l" },
		{ itemName: "wingedboots", slot: "shoes", level: 9, l: "l" },
		{ itemName: "mpxgloves", slot: "gloves", level: 7, l: "l" },
		{ itemName: "santasbelt", slot: "belt", level: 3, l: "l" },
		{ itemName: "lmace", slot: "mainhand", level: 9, l: "l" },
		{ itemName: "mshield", slot: "offhand", level: 10, l: "l" },
		{ itemName: "ringofluck", slot: "ring1", level: 2, l: "u" },
		{ itemName: "ringofluck", slot: "ring2", level: 2, l: "l" },
		{ itemName: "rabbitsfoot", slot: "orb", level: 3, l: "l" },
		{ itemName: "spookyamulet", slot: "amulet", level: 3, l: "l" },
		//{ itemName: "mpxamulet", slot: "amulet", level: 1, l: "l" },
		{ itemName: "ecape", slot: "cape", level: 8, l: "l" },
		{ itemName: "mearring", slot: "earring1", level: 2, l: "l" },
		{ itemName: "mearring", slot: "earring2", level: 1, l: "u" }
	],
	maxR: [
		{ itemName: "xhelmet", slot: "helmet", level: 9, l: "l" },
		{ itemName: "vattire", slot: "chest", level: 8, l: "l" },
		{ itemName: "starkillers", slot: "pants", level: 9, l: "l" },
		{ itemName: "wingedboots", slot: "shoes", level: 10, l: "l" },
		{ itemName: "mpxgloves", slot: "gloves", level: 7, l: "l" },
		{ itemName: "intbelt", slot: "belt", level: 6, l: "l" },
		{ itemName: "lmace", slot: "mainhand", level: 9, l: "s" },
		{ itemName: "wbookhs", slot: "offhand", level: 5, l: "l" },
		{ itemName: "zapper", slot: "ring1", level: 2, l: "l" },
		{ itemName: "zapper", slot: "ring2", level: 2, l: "u" },
		{ itemName: "jacko", slot: "orb", level: 5, l: "l" },
		{ itemName: "t2stramulet", slot: "amulet", level: 4, l: "l" },
		{ itemName: "gcape", slot: "cape", level: 9, l: "l" },
		{ itemName: "cearring", slot: "earring1", level: 4, l: "l" },
		{ itemName: "cearring", slot: "earring2", level: 5, l: "u" }
	],
	gold: [
		{ itemName: "wcap", slot: "helmet", level: 6, l: "l" },
		{ itemName: "wattire", slot: "chest", level: 6, l: "l" },
		{ itemName: "wbreeches", slot: "pants", level: 6, l: "l" },
		{ itemName: "wshoes", slot: "shoes", level: 6, l: "l" },
		{ itemName: "handofmidas", slot: "gloves", level: 9, l: "l" },
		{ itemName: "goldring", slot: "ring1", level: 1, l: "l" },
		{ itemName: "goldring", slot: "ring2", level: 1, l: "u" },
		{ itemName: "spookyamulet", slot: "amulet", level: 3, l: "l" },
		{ itemName: "horsecapeg", slot: "cape", level: 10, l: "l" },
	],
	dps: [
		{ itemName: "spikedhelmet", slot: "helmet", level: 9, l: "l" },
		{ itemName: "vattire", slot: "chest", level: 8, l: "l" },
		{ itemName: "starkillers", slot: "pants", level: 9, l: "l" },
		{ itemName: "wingedboots", slot: "shoes", level: 10, l: "l" },
		{ itemName: "mpxgloves", slot: "gloves", level: 7, l: "l" },
		{ itemName: "intbelt", slot: "belt", level: 6, l: "l" },
		{ itemName: "firestaff", slot: "mainhand", level: 9, l: "s" },
		{ itemName: "wbook0", slot: "offhand", level: 6, l: "l" },
		{ itemName: "zapper", slot: "ring1", level: 2, l: "l" },
		{ itemName: "zapper", slot: "ring2", level: 2, l: "u" },
		{ itemName: "jacko", slot: "orb", level: 5, l: "l" },
		{ itemName: "mpxamulet", slot: "amulet", level: 1, l: "l" },
		{ itemName: "bcape", slot: "cape", level: 8, l: "l" },
		{ itemName: "cearring", slot: "earring1", level: 4, l: "l" },
		{ itemName: "cearring", slot: "earring2", level: 5, l: "u" }
	],
	dreturn: [
		{ itemName: "spikedhelmet", slot: "helmet", level: 9, l: "l" },
		{ itemName: "cdragon", slot: "chest", l: "l" },
		{ itemName: "starkillers", slot: "pants", level: 9, l: "l" },
		{ itemName: "wingedboots", slot: "shoes", level: 10, l: "l" },
		{ itemName: "mpxgloves", slot: "gloves", level: 7, l: "l" },
		{ itemName: "sbelt", slot: "belt", level: 3, l: "l" },
		{ itemName: "lmace", slot: "mainhand", level: 9, l: "s" },
		{ itemName: "sshield", slot: "offhand", level: 10, l: "l" },
		{ itemName: "zapper", slot: "ring1", level: 2, l: "u" },
		{ itemName: "zapper", slot: "ring2", level: 2, l: "l" },
		{ itemName: "rabbitsfoot", slot: "orb", level: 3, l: "l" },
		{ itemName: "mpxamulet", slot: "amulet", level: 1, l: "l" },
		{ itemName: "bcape", slot: "cape", level: 8, l: "l" },
		{ itemName: "cearring", slot: "earring1", level: 4, l: "l" },
		{ itemName: "cearring", slot: "earring2", level: 5, l: "u" }
	],
};

// ============================================================================
// CORE UTILITIES
// ============================================================================
const BOSS_SET = new Set(allBosses);
let ZAPPER_MOB_SET = new Set(CONFIG.combat.zapperMobs);

// Rebuilds home-dependent derived structures - called once home is first
// set, and again any time it changes via a later 'farm_spot' message.
function updateHomeDependentSets() {
	ZAPPER_MOB_SET = new Set([...CONFIG.combat.zapperMobs, home]);
}

function updateCache() {
	if (!cache.isValid()) {
		cache.target = findBestTarget();
		cache.zapTargets = findZapTargets();
		cache.nearestBoss = findNearestBoss();
		cache.partyMembers = getPartyMembers();
		cache.lastUpdate = performance.now();
	}

	cache.healTarget = findHealTarget();
}

function findBestTarget() {
	if (!home) return null; // farm spot not received from Dexon yet

	for (const bossType of BOSS_SET) {
		const boss = get_nearest_monster_v2({
			type: bossType,
			max_distance: character.range
		});
		if (boss) return boss;
	}

	for (const name of CONFIG.combat.targetPriority) {
		const target = get_nearest_monster_v2({
			target: name,
			statusEffects: ['cursed'],
			max_distance: character.range
		});
		if (target) return target;
	}

	for (const name of CONFIG.combat.targetPriority) {
		const target = get_nearest_monster_v2({
			type: home,
			max_distance: character.range
		});
		if (target) return target;
	}

	return null;
}

function findHealTarget() {
	let lowest = character;
	let lowestPct = character.hp / character.max_hp;
	let lowestOutsider = null;
	let lowestOutsiderPct = 1;

	const partyNames = Object.keys(get_party() || {});

	for (const name of partyNames) {
		const ally = get_player(name);
		if (!ally || ally.rip) continue;

		const pct = ally.hp / ally.max_hp;
		if (pct < lowestPct) {
			lowestPct = pct;
			lowest = ally;
		}
	}

	if (CONFIG.healing.healOthers && lowestPct >= CONFIG.healing.healOthersThresh) {
		for (const id in parent.entities) {
			const entity = parent.entities[id];
			if (entity.type !== 'character' || entity.rip || entity.npc) continue;
			if (partyNames.includes(entity.name)) continue;
			if (!is_in_range(entity, 'heal')) continue;

			const pct = entity.hp / entity.max_hp;
			if (pct < lowestOutsiderPct) {
				lowestOutsiderPct = pct;
				lowestOutsider = entity;
			}
		}

		if (lowestOutsider && lowestOutsiderPct < CONFIG.healing.healOthersThresh) {
			return lowestOutsider;
		}
	}

	return lowest;
}

function findZapTargets() {
	if (!CONFIG.combat.zapper) return [];

	const targets = [];
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e && e.type === 'monster' && !e.target && !e.dead && e.visible &&
			ZAPPER_MOB_SET.has(e.mtype) && is_in_range(e, 'zapperzap')) {
			targets.push(e);
		}
	}
	return targets;
}

function getPartyMembers() {
	return Object.keys(get_party() || {});
}

function findNearestBoss() {
	for (const bossType of BOSS_SET) {
		const boss = get_nearest_monster_v2({ type: bossType, check_min_hp: true });
		if (boss) return { mob: boss, type: bossType };
	}
	return null;
}

// ============================================================================
// MAIN TICK LOOP - Handles state updates, caching, movement
// ============================================================================
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
		if (is_disabled(character)) {
			return setTimeout(mainLoop, 250);
		}
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
			return setTimeout(mainLoop, 250); // haven't heard from Dexon yet
		}

		updateCache();

		if (shouldLoot()) {
			await noHang(handleLooting(), 'handleLooting');
		}
		if (shouldHandleEvents()) {
			handleEvents();
		}
		else if (CONFIG.movement.enabled) {
			if (!get_nearest_monster({ type: home })) {
				handleReturnHome();
			} else if (CONFIG.movement.kiting.enabled) {
				/* Chained, not exclusive - kiter() returns false when nothing kite-worthy
				   is in danger range, and this was an `else if`, so enabling kiting would
				   have retired walkInCircle() everywhere. */
				const kited = await noHang(kiter(), 'kiter');
				if (!kited && CONFIG.movement.circleWalk) walkInCircle();
			} else if (CONFIG.movement.circleWalk) {
				walkInCircle();
			}
		}

		if (CONFIG.equipment.autoSwapSets && state.skinReady) {
			handleEquipmentSwap();
		}

	} catch (e) {
		console.error('mainLoop error:', e);
	}

	setTimeout(mainLoop, TICK_RATE.main);
}

// ============================================================================
// ACTION LOOP - Combat and healing only
// ============================================================================
// CPU FIX: used to busy-wait-spin on performance.now() and reschedule at a
// 0-1ms floor, firing ~1000x/sec with a synchronous spin - this is what
// triggered a real cpu_guard kill (see this character's own event history).
// Spin removed, floor raised to 15ms - real attack cooldowns are hundreds
// of ms minimum, so this costs no real responsiveness.
async function actionLoop() {
	try {
		if (is_disabled(character)) return setTimeout(actionLoop, 25);
		updateCache();
		const ms = ms_to_next_skill('attack') - 1.5;
		if (ms < 3) {
			const healed = await noHang(tryHeal(), 'tryHeal');
			if (!healed) {
				const target = cache.target;
				if (target && is_in_range(target) && !smart.moving) await noHang(use_skill('attack', target), 'use_skill attack');
			}
			return setTimeout(actionLoop, TICK_RATE.action);
		}
		return setTimeout(actionLoop, ms > 8 ? ms - 6 : TICK_RATE.action);
	} catch { return setTimeout(actionLoop, TICK_RATE.action); }
}

// ============================================================================
// SKILL LOOP - Independent skill management
// ============================================================================
async function skillLoop() {
	const delay = 40;

	try {
		if (is_disabled(character)) {
			return setTimeout(skillLoop, 250);
		}

		updateCache();

		const penalty = character.s?.penalty_cd?.ms || 0;

		if (CONFIG.combat.curse) {
			await noHang(handleCurse(), 'handleCurse');
		}

		// Level-gated, and wrapped: absorb (lvl 55) and darkblessing (lvl 70)
		// used to be attempted unconditionally. A rejected use_skill() throws
		// into this try block, which was skipping partyheal/zapper for the
		// rest of that tick every time either skill failed below its level -
		// darkblessing in particular has no cooldown once it fails, so it
		// was throwing on essentially every tick.
		if (CONFIG.healing.absorb && penalty < 500 && character.level >= (G.skills.absorb?.level || 0)) {
			try {
				await noHang(handleAbsorb(), 'handleAbsorb');
			} catch (e) {
				console.error('handleAbsorb error:', e);
			}
		}

		if (character.party) {
			await noHang(handlePartyHeal(), 'handlePartyHeal');
		}

		if (CONFIG.healing.darkBlessing && character.level >= (G.skills.darkblessing?.level || 0) && character.mp >= (G.skills.darkblessing?.mp || 0) && !is_on_cooldown('darkblessing')) {
			try {
				await noHang(use_skill('darkblessing'), 'use_skill darkblessing');
			} catch (e) {
				console.error('darkblessing error:', e);
			}
		}

		if (CONFIG.combat.zapper && state.current === 'idle') {
			await noHang(handleZapper(), 'handleZapper');
		}
		if (CONFIG.combat.zapSpam?.enabled && state.current === 'idle') {
			await noHang(handleZapSpam(), 'handleZapSpam');
		}

	} catch (e) {
		console.error('skillLoop error:', e);
	}

	setTimeout(skillLoop, delay);
}

async function tryHeal() {
	const healTarget = cache.healTarget;
	if (!healTarget) return false;

	const healThreshold = healTarget.max_hp - character.heal / 1.33;

	if (healTarget.hp < healThreshold && is_in_range(healTarget)) {
		await use_skill("heal", healTarget);
		return true;
	}

	return false;
}

async function handleCurse() {
	if (is_on_cooldown('curse') || smart.moving) return;
	if (character.mp < (G.skills.curse?.mp || 0)) return;
	if (!home || !destination) return; // farm spot not received yet

	const X = destination.x;
	const Y = destination.y;

	let target = null;

	for (const b of BOSS_SET) {
		const mb = get_nearest_monster_v2({ type: b });
		if (mb) {
			target = mb;
			break;
		}
	}

	if (!target) {
		target = get_nearest_monster_v2({
			type: [...CONFIG.combat.zapperMobs, home],
			check_min_hp: true,
			max_distance: 175,
			point_for_distance_check: [X, Y]
		});
	}

	if (target && target.hp >= target.max_hp * 0.01 && !target.immune && is_in_range(target, 'curse')) {
		await use_skill('curse', target);
	}
}

async function handleAbsorb() {
	if (is_on_cooldown('absorb')) return;
	if (character.mp < (G.skills.absorb?.mp || 0)) return;

	const mapsToExclude = ['level2n'];
	if (mapsToExclude.includes(character.map)) return;

	const boss = get_nearest_monster_v2({ type: BOSS_SET });
	if (boss?.target && boss.target !== character.name) {
		const targetPlayer = get_player(boss.target);
		if (targetPlayer) {
			await use_skill('absorb', boss.target);
			game_log(`Boss Absorb → ${boss.mtype} from ${boss.target}`, '#FF3333');
			return;
		}
	}

	if (!character.party) return;

	const partyNames = Object.keys(get_party());
	const allies = partyNames.filter(n => n !== character.name);
	if (!allies.length) return;

	for (let id in parent.entities) {
		const entity = parent.entities[id];
		if (!entity || entity.type !== 'monster' || entity.dead) continue;

		if (entity.target && allies.includes(entity.target) && entity.target !== character.name) {
			await use_skill('absorb', entity.target);
			game_log(`Absorbing ${entity.target}`, '#FFA600');
			return;
		}
	}
}

async function handlePartyHeal() {
	const threshold = character.map !== mobMap ? 0.99 : CONFIG.healing.partyHealThreshold;

	if (character.mp <= CONFIG.healing.partyHealMinMp || is_on_cooldown('partyheal')) return;

	for (const name of cache.partyMembers) {
		const ally = get_player(name);
		if (!ally || ally.rip || ally.hp >= ally.max_hp * threshold) continue;

		await use_skill('partyheal');
		break;
	}
}

async function handleZapper() {
	const now = performance.now();
	const hasZapper = character.slots.ring2?.name === 'zapper';
	const canSwap = now - state.lastEquipTime > COOLDOWNS.zapperSwap;
	const hasEnoughMp = character.mp > (G?.skills?.zapperzap?.mp || 0) + 1950;

	if (smart.moving || character.cc > COOLDOWNS.cc) return;

	const zapTargets = findZapTargets();

	if (CONFIG.combat.zapSwap && zapTargets.length > 0 && !hasZapper && canSwap && hasEnoughMp && character.map === mobMap) {
		try {
			await equipSet('zapOn');
			state.lastEquipTime = now;
		} catch (e) {
			console.error('Failed to equip zapper:', e);
		}
	}

	if (zapTargets.length > 0 && hasZapper && hasEnoughMp && !is_on_cooldown('zapperzap')) {
		for (const entity of zapTargets) {
			if (is_on_cooldown('zapperzap')) break;

			try {
				await use_skill('zapperzap', entity);
			} catch (e) {
				console.error('handleZapper error:', e);
			}
		}
	}
	if (CONFIG.combat.zapSwap && zapTargets.length === 0 && hasZapper && canSwap && character.map === mobMap) {
		try {
			await equipSet('zapOff');
			state.lastEquipTime = now;
		} catch (e) {
			console.error('Failed to unequip zapper:', e);
		}
	}
}

async function handleZapSpam() {
	const cfg = CONFIG.combat.zapSpam;
	if (!cfg?.enabled || character.cc > COOLDOWNS.cc) return;
	if (character.slots.ring2?.name !== 'zapper' || character.mp < cfg.minMp || is_on_cooldown('zapperzap')) return;

	const target = get_nearest_monster_v2({ type: cfg.mob });
	if (!target || target.dead || !target.visible || !is_in_range(target, 'zapperzap')) return;

	try {
		await use_skill('zapperzap', target);
	} catch (e) {
		console.error('handleZapSpam error:', e);
	}
}

// ============================================================================
// MAINTENANCE LOOP - Inventory, potions, party management
// ============================================================================
async function maintenanceLoop() {
	try {
		if (CONFIG.potions.autoBuy) {
			autoBuyPotions();
		}

		if (CONFIG.party.autoManage) {
			partyMaker();
		}

		if (CONFIG.muling.enabled) clearInventory();
		elixirUsage();
		checkOwnXpEconomics();
		scare();

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

// ============================================================================
// POTION HANDLER - Separate from maintenance for faster response
// ============================================================================
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

// ============================================================================
// MOVEMENT FUNCTIONS
// ============================================================================
function shouldHandleEvents() {
	const holidaySpirit = parent?.S?.holidayseason && !character?.s?.holidayspirit;
	const hasHandleableEvent = getDynamicEvents().some(e => parent?.S?.[e.name]?.live);
	return holidaySpirit || hasHandleableEvent;
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

	let target = null, bestRatio = Infinity;
	for (const e of getDynamicEvents()) {
		const d = parent.S[e.name];
		if (!d?.live) continue;
		const r = d.hp / d.max_hp;
		if (r < bestRatio) { bestRatio = r; target = e; }
	}
	if (!target) return;

	if (target.join === true && character.map !== target.map) {
		parent.socket.emit('join', { name: target.name });
		return;
	}

	if (!smart.moving) {
		handleSpecificEvent(target.name, target.map, target.x, target.y);
	}
}

async function handleSpecificEvent(eventType, mapName, x, y) {
	if (!parent?.S?.[eventType]?.live) return;

	const monster = get_nearest_monster({ type: eventType });
	if (!monster) {
		smart_move({ x, y, map: mapName });
		return;
	}

	if (BOSS_SET.has(eventType)) {
		if (!is_in_range(monster) && !smart.moving) {
			const dx = monster.x - character.x;
			const dy = monster.y - character.y;
			const dist = Math.hypot(dx, dy);
			const targetDist = character.range * 0.8;
			await xmove(
				character.x + dx * (1 - targetDist / dist),
				character.y + dy * (1 - targetDist / dist)
			);
		}
		return;
	}

	const halfway_x = character.x + (monster.x - character.x) / 2;
	const halfway_y = character.y + (monster.y - character.y) / 2;
	if (!is_in_range(monster, 'attack') && !smart.moving) {
		await xmove(halfway_x, halfway_y);
	}
}

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
			await smart_move(dest);
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
			await smart_move(dest);
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
	if (smart.moving) return;
	const center = destination, r = CONFIG.movement.circleRadius, now = performance.now();
	const dt = Math.min((now - state.lastAngleUpdate) / 1000, 0.5);
	state.lastAngleUpdate = now;
	state.angle = (state.angle + (character.speed / r) * dt) % (2 * Math.PI);
	if (!character.moving) await xmove(center.x + Math.cos(state.angle) * r, center.y + Math.sin(state.angle) * r);
}

// ============================================================================
// TEMPORAL SURGE COORDINATION
// ============================================================================
function getTemporalRotation() {
	// get()/set() are the game's own storage functions - unlike localStorage
	// (a browser-only Web API), these work identically in a real browser tab
	// and on Mainframe's sandboxed runtime.
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

	const orbSlot = character.items.findIndex(i => i?.name === 'orboftemporal');;
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

parent.socket.on('kill_credit', async (data) => {
	if (!CONFIG.equipment.temporal.enabled) return;
	if (data.mtype !== CONFIG.equipment.temporal.targetMob) return;

	if (!is_on_cooldown("temporalsurge")) {
		await handleTemporalSurge();
	}
});

// ============================================================================
// KITING SYSTEM 
// ============================================================================
let lastMove = 0;

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
   --------------------------------------------------------------------------- */
const targetStartTimes = new Map();

function scare() {
	const cfg = (CONFIG.combat && CONFIG.combat.scare) || {};
	if (cfg.enabled === false) return;
	const slot = character.items.findIndex(i => i && i.name === 'jacko');
	const now = performance.now();
	const minHeld = cfg.minHeldMs != null ? cfg.minHeldMs : 250;
	let held = 0;

	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e && e.type === 'monster' && e.target === character.name && e.mtype !== 'grinch') {
			let t = targetStartTimes.get(id);
			if (t === undefined) targetStartTimes.set(id, t = now);
			if (now - t > minHeld) held++;
		} else if (targetStartTimes.has(id)) {
			targetStartTimes.delete(id);
		}
	}

	const threshold = Math.max(1, (character.courage || 2) + (cfg.courageOffset || 0));
	if (held < threshold || is_on_cooldown('scare') || slot === -1) return;

	/* equip / cast / equip: the first equip moves the jacko into the orb slot and
	   displaces the previous orb into this inventory slot, the second puts it
	   back. Same sequence Ranger.js uses. */
	try { equip(slot); use_skill('scare'); equip(slot); } catch (e) {}
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

function kiter() {
	const cfg = CONFIG.movement.kiting;
	if (!cfg?.enabled) return false;
	if (cfg.debug && Array.isArray(cfg.boundaryBox)) {
		const [x1, y1, x2, y2] = cfg.boundaryBox;
		clear_drawings();
		draw_line(x1, y1, x1, y2, 2, 0xfc031c);
		draw_line(x2, y1, x2, y2, 2, 0xfc031c);
		draw_line(x1, y2, x2, y2, 2, 0xfc031c);
		draw_line(x1, y1, x2, y1, 2, 0xfc031c);
	}
	return avoidMobs(cfg);
}

function avoidMobs(cfg) {
	const cx = character.real_x, cy = character.real_y;
	const R2 = cfg.avoidRadius * cfg.avoidRadius;
	const types = kiteCandidateTypes(cfg);
	const listed = new Set(cfg.avoidTypes || []);
	const box = cfg.boundaryBox;
	const attackers = kiteAttackerCount();
	const courage = character.courage || 2;
	const disengage = cfg.disengageOnCourage !== false && attackers >= courage;
	const stepDist = disengage ? (cfg.disengageDistance || cfg.moveDistance || 75)
				: (cfg.moveDistance || 75);

	let threats = null, inDanger = false;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e.type !== 'monster' || !types.includes(e.mtype)) continue;
		const mx = e.real_x, my = e.real_y;
		const dx = cx - mx, dy = cy - my;
		const d2 = dx * dx + dy * dy;
		if (d2 >= R2) continue;
		/* kiteThreatRadius, not .range: an aura is a danger radius too, and this
		   also stops an unknown mtype throwing on .range of undefined. */
		const r = kiteThreatRadius(parent.G.monsters[e.mtype]) + cfg.rangeBuffer;
		const danger = d2 < r * r;
		/* x/y/d duplicate mx/my/d2 so the shared kiteMultiWeight can read these
		   without disturbing findTangents below, which wants mx/my. */
		(threats ??= []).push({ mx, my, x: mx, y: my, r, d2, d: Math.sqrt(d2), danger, mtype: e.mtype });
		if (danger) inDanger = true;
	}
	/* Disengage acts before anything is in reach, which is the whole point. */
	if (!inDanger && !(disengage && threats && threats.length)) return false;

	/* Fence only when the danger is hand-listed; a predicate-matched threat
	   can be on any map, where the arena rectangle is meaningless. */
	/* The fence is suspended while disengaging - an arena rectangle that traps
	   him mid-escape is worse than leaving it. */
	const useBox = !disengage && Array.isArray(box) && threats.some(t => t.danger && listed.has(t.mtype));

	const avoidRanges = [];
	for (const t of threats) {
		const tang = findTangents(cx, cy, t.mx, t.my, t.r);
		if (!tang) continue;
		const a1 = Math.atan2(cy - tang[0].y, cx - tang[0].x) + Math.PI;
		const a2 = Math.atan2(cy - tang[1].y, cx - tang[1].x) + Math.PI;
		avoidRanges.push(a1 < a2 ? [a1, a2] : [a2, a1]);
		if (cfg.debug) {
			draw_line(cx, cy, tang[0].x, tang[0].y, 1, 0x17F20D);
			draw_line(cx, cy, tang[1].x, tang[1].y, 1, 0x17F20D);
			draw_circle(t.mx, t.my, t.r, 1, 0x17F20D);
		}
	}

	const n = cfg.sampleAngles * 2, step = Math.PI / cfg.sampleAngles;
	let bestW = -Infinity, bestX = 0, bestY = 0, found = false;
	/* Shorter steps when the full one is walled off. A wall 50 units out used to
	   block every candidate while 12 units of room existed. */
	for (const frac of KITE_STEP_FRACTIONS) {
		const sd = Math.max(6, stepDist * frac);
		for (let i = 0, a = 0; i < n; i++, a += step) {
			const px = cx + sd * Math.cos(a), py = cy + sd * Math.sin(a);
			if (useBox && (px < box[0] || px > box[2] || py < box[1] || py > box[3])) continue;
			if (angleIntersectsMonsters(avoidRanges, a)) continue;
			if (!can_move_to(px, py)) continue;
			/* Signed and urgency-weighted, replacing the gain-only sum that used to
			   live here: escaping one monster into another now scores badly rather
			   than merely scoring zero. */
			const weight = kiteMultiWeight(threats, px, py);
			if (weight > bestW) { bestW = weight; bestX = px; bestY = py; found = true; }
		}
		if (found) break;
	}

	if (!found) {
		/* Ladder, then the pathfinder - anything rather than standing still. */
		const esc = kiteLadderEscape(kiteRepulsionAngle(threats), stepDist);
		if (esc) { bestX = esc.x; bestY = esc.y; found = true; }
	}
	if (!found) {
		const away = kiteRepulsionAngle(threats);
		if (attackers < courage && away != null) {
			const far = Math.max(stepDist, 60);
			xmove(cx + Math.cos(away) * far, cy + Math.sin(away) * far);
			lastMove = performance.now();
			return true;
		}
		return false;
	}

	const now = performance.now();
	if (now - lastMove > cfg.moveThrottle) {
		lastMove = now;
		const moveX = cx + (bestX - cx) / 3, moveY = cy + (bestY - cy) / 3;
		move(moveX, moveY);
		if (cfg.debug) draw_line(cx, cy, moveX, moveY, 2, 0xF20D0D);
	}
	/* true even when throttled - we are actively managing distance, and the
	   caller must not fall through to walkInCircle() and fight this. */
	return true;
}

function angleIntersectsMonsters(ranges, angle) {
	for (const r of ranges) if (isBetween(r[1], r[0], angle)) return true;
	return false;
}

function isBetween(angle1, angle2, target) {
	if (angle1 <= angle2) {
		if (angle2 - angle1 <= Math.PI) return target >= angle1 && target <= angle2;
		return target >= angle2 || target <= angle1;
	}
	if (angle1 - angle2 <= Math.PI) return target >= angle2 && target <= angle1;
	return target >= angle1 || target <= angle2;
}

function findTangents(px, py, cx, cy, r) {
	const dx = cx - px, dy = cy - py;
	const dd = Math.hypot(dx, dy);
	if (dd <= r) return null;
	const a = Math.asin(r / dd), b = Math.atan2(dy, dx);
	const t1 = b - a, t2 = b + a;
	return [
		{ x: cx + r * Math.sin(t1), y: cy - r * Math.cos(t1) },
		{ x: cx - r * Math.sin(t2), y: cy + r * Math.cos(t2) }
	];
}

// ============================================================================
// LOOTING
// ============================================================================
function shouldLoot() {
	if (!CONFIG.looting.enabled || !state.skinReady || character.cc > COOLDOWNS.cc) return false;

	const now = performance.now();
	const storedChestCount = Object.keys(loadChestMap()).length;
	const penalty = character.s?.penalty_cd?.ms || 0;
	const cooldownPass = now - state.lastLootTime > CONFIG.looting.lootCooldown;

	return (
		storedChestCount >= CONFIG.looting.chestThreshold &&
		character.targets < CONFIG.looting.targetCount &&
		cooldownPass &&
		penalty === 0 &&
		state.current !== 'looting'
	);
}

async function handleLooting() {
	state.lastLootTime = performance.now();
	state.current = 'looting';

	try {
		if (CONFIG.looting.equipGoldGear && !isSetEquipped('gold')) {
			equipSet('gold');
			swapBooster('luckbooster', 'goldbooster');
			await sleep(150);
		}

		let looted = 0;
		const maxLoots = CONFIG.looting.maxPerPass || CONFIG.looting.chestThreshold * 5;

		const storedChests = loadChestMap();
		// Looted ids are collected and deleted in ONE write at the end. This
		// loop never removed them at all, so with a cap of 5 it re-looted the
		// same five keys on every pass while everything behind them starved -
		// 9,465 entries deep on Dexon when this was measured.
		const done = [];
		for (const chestId in storedChests) {
			if (looted >= maxLoots) break;
			// Was parent.open_chest(chestId) - not a real function on Mainframe
			// ("parent.open_chest is not a function", confirmed live 2026-09-17
			// immediately after the describeError() fix surfaced it). The real
			// game API is the bare global loot(), same as Mage.js's proven-
			// working equivalent (557 successful opens in a single session).
			try {
				await loot(chestId);
				looted++;
			} catch (e) {
				console.error('loot(' + chestId + ') failed, dropping:', describeError(e));
			}
			done.push(chestId);
		}

		if (done.length) {
			const stored = loadChestMap();
			for (const id of done) delete stored[id];
			saveChestMap(stored);
		}

		await sleep(75);

		if (CONFIG.looting.equipGoldGear) {
			swapBooster('goldbooster', 'luckbooster');
		}
	} catch (e) {
		console.error('Looting error:', describeError(e));
	} finally {
		state.current = 'idle';
	}
}

const CHEST_STORAGE_KEY = "loot_chest_ids";
function loadChestMap() {
	const data = get(CHEST_STORAGE_KEY);
	return typeof data === "object" && data !== null ? data : {};
}

function removeChestId(id) {
	const stored = loadChestMap();
	if (stored[id]) {
		delete stored[id];
		saveChestMap(stored);
	}
}

function saveChestMap(map) {
	set(CHEST_STORAGE_KEY, map);
}

// CHEST BUG FIX (2026-09-17): this file had loadChestMap()/saveChestMap()/
// removeChestId() and a fully working shouldLoot()/handleLooting() pipeline,
// but nothing ever called get_chests() to populate the chest map in the
// first place - it started empty and stayed empty forever, so
// storedChestCount never reached CONFIG.looting.chestThreshold and
// handleLooting() never ran. Confirmed live: loadChestMap() returned {}
// all session while MageofOz's equivalent map (which does have this
// function) was actively capturing real chest IDs. Ported verbatim from
// Mage.js, which has been working correctly (557 open_chest actions in a
// single ~50-minute session).
function updateChestsInStorage() {
	const stored = loadChestMap();
	const now = performance.now();
	for (const id of Object.keys(get_chests())) {
		if (!stored[id]) stored[id] = now;
	}
	saveChestMap(stored);
}
setInterval(updateChestsInStorage, 250);

// ============================================================================
// EQUIPMENT MANAGEMENT
// ============================================================================
function handleEquipmentSwap() {
	if (!CONFIG.equipment.autoSwapSets || character.cc > COOLDOWNS.cc) return;
	if (cache.zapTargets.length > 0) return;

	const now = performance.now();
	if (now - state.lastEquipTime < COOLDOWNS.equipSwap) return;

	let targetSet = CONFIG.looting.lootSet;

	if (CONFIG.equipment.bossLuckSwitch && cache.nearestBoss) {
		const { mob, type } = cache.nearestBoss;
		const threshold = CONFIG.equipment.bossHpThresholds[type] || 0;
		targetSet = mob.hp < threshold ? 'maxLuck' : CONFIG.looting.lootSet;
	}

	if (!isSetEquipped(targetSet)) {
		state.lastEquipTime = now;
		equipSet(targetSet);
	}
}

function isSetEquipped(setName) {
	const set = equipmentSets[setName];
	if (!set) return false;

	return set.every(item =>
		character.slots[item.slot]?.name === item.itemName &&
		character.slots[item.slot]?.level === item.level
	);
}

function equipSet(setName) {
	const set = equipmentSets[setName];
	if (set) {
		equipBatch(set);
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function clearInventory() {
	const cfg = CONFIG.muling;
	let lootMule = get_player(cfg.muleName) || get_player(cfg.fallbackMuleName);
	if (!lootMule) return;

	if (character.gold > cfg.goldReserve) {
		send_gold(lootMule, character.gold - cfg.goldReserve);
	}

	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && !cfg.excludeItems.has(item.name) && !item.l && !item.s) {
			if (is_in_range(lootMule, 300)) {
				send_item(lootMule.id, i, item.q ?? 1);
			}
		}
	}
}

/* There was an inventorySorter() here until v30. It pinned seven item names to
   slots 0-6 every maintenance tick, and because swap() is an exchange it evicted
   anything the operator dragged into one of those slots. Slot order is arranged
   by hand now. Nothing reads a numeric index into character.items here. */


function autoBuyPotions() {
	if (quantity('hpot1') < CONFIG.potions.minStock) buy('hpot1', CONFIG.potions.minStock);
	if (quantity('mpot1') < CONFIG.potions.minStock) buy('mpot1', CONFIG.potions.minStock);

	const totalHp = quantity('hpot0') + quantity('hpot1');
	const totalMp = quantity('mpot0') + quantity('mpot1');
	if (totalHp < 500) plSend('Meltymerch', { message: 'low_potions', potion: 'hp', quantity: totalHp, x: character.x, y: character.y, map: character.map });
	if (totalMp < 500) plSend('Meltymerch', { message: 'low_potions', potion: 'mp', quantity: totalMp, x: character.x, y: character.y, map: character.map });
}

// Shared by both the emergency restock (below) and the post-respawn top-up
// in maintenanceLoop.
async function buyMissingPotions() {
	if (quantity('hpot0') + quantity('hpot1') < CONFIG.potions.minStock) {
		try { await buy('hpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy hpot1 failed:', e); }
	}
	if (quantity('mpot0') + quantity('mpot1') < CONFIG.potions.minStock) {
		try { await buy('mpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy mpot1 failed:', e); }
	}
}

// Self-sufficiency fallback: don't just wait on Meltymerch forever if HP or
// MP potions hit zero outright - go buy more directly.
async function checkPotionEmergency() {
	if (!CONFIG.potions.autoBuy) return false;
	if (state.restocking) return true;

	const totalHp = quantity('hpot0') + quantity('hpot1');
	const totalMp = quantity('mpot0') + quantity('mpot1');
	if (totalHp > 0 && totalMp > 0) return false;

	state.restocking = true;
	game_log(`Out of ${totalHp === 0 ? 'HP' : 'MP'} potions - heading to town to restock`, 'red');
	try {
		await town();
		await buyMissingPotions();
		game_log('Restocked - heading back to the farm spot', '#00FF00');
	} catch (e) {
		console.error('Emergency potion restock failed:', e);
	} finally {
		state.restocking = false;
	}
	return true;
}

function elixirUsage() {
	const required = 'elixirluck';
	const currentElixir = character.slots.elixir?.name;
	const currentQty = quantity(required);

	if (currentElixir !== required) {
		const slot = locate_item(required);
		if (slot !== -1) use(slot);
	}

	if (currentQty < 2) {
		buy(required, 2 - currentQty);
	}
}

function swapBooster(current, target) {
	const slot = locate_item(current);
	if (slot !== -1) shift(slot, target);
}

function partyMaker() {
	if (!CONFIG.party.autoManage) return;

	const group = CONFIG.party.groupMembers;
	const partyLead = get_entity(group[0]);
	const currentParty = character.party;
	const healer = get_entity('FatherToken');

	if (character.name === group[0]) {
		for (let i = 1; i < group.length; i++) {
			send_party_invite(group[i]);
		}
	} else {
		if (currentParty && currentParty !== group[0] && healer) {
			leave_party();
		}

		if (!currentParty && partyLead) {
			send_party_request(group[0]);
		}
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Game API rejections are often plain objects (e.g. {reason, message}), not
// real Error instances - console.error() on those just prints
// "[object Object]" with no way to see what actually went wrong. This pulls
// out whatever's actually useful: a real Error's .message, an object's own
// .message/.reason fields, or a JSON dump as a last resort.
function describeError(e) {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object') {
		if (e.message) return e.message;
		if (e.reason) return e.reason;
		try { return JSON.stringify(e); } catch { /* fall through */ }
	}
	return String(e);
}

setInterval(() => {
	if (character?.afk && !parent?.paused) pause();
	else if (!character?.afk && parent?.paused) pause();
}, 50);

// ============================================================================
// ESSENTIAL HELPER FUNCTIONS
// ============================================================================

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

	// Normally a Date object exposing .getTime() - but Mainframe's runtime
	// sometimes hands this back as something else (a raw epoch-ms number,
	// or a value new Date() can still parse) with no .getTime() method,
	// which was throwing "next_skill.getTime is not a function" every
	// time it happened. That was previously invisible - console.error(e)
	// printed it as "[object Object]" - and it was silently non-fatal
	// only because use_hp/use_mp had already fired by the time this ran;
	// only the delay calculation afterward was crashing. Get the epoch ms
	// whichever shape we're actually given.
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

async function equipBatch(data) {
	if (!Array.isArray(data)) {
		return Promise.reject({ reason: 'invalid', message: 'Not an array' });
	}
	if (data.length > 15) {
		return Promise.reject({ reason: 'invalid', message: 'Too many items' });
	}

	let validItems = [];

	for (let i = 0; i < data.length; i++) {
		let itemName = data[i].itemName;
		let slot = data[i].slot;
		let level = data[i].level;
		let l = data[i].l;

		if (!itemName) continue;

		let found = false;
		if (parent.character.slots[slot]) {
			let slotItem = parent.character.items[parent.character.slots[slot]];
			if (slotItem && slotItem.name === itemName && slotItem.level === level && slotItem.l === l) {
				found = true;
			}
		}

		if (found) continue;

		for (let j = 0; j < parent.character.items.length; j++) {
			const item = parent.character.items[j];
			if (item && item.name === itemName && item.level === level && item.l === l) {
				validItems.push({ num: j, slot: slot });
				break;
			}
		}
	}

	if (validItems.length === 0) return;

	try {
		parent.socket.emit('equip_batch', validItems);
		await parent.push_deferred('equip_batch');
	} catch (error) {
		console.error('equipBatch error:', error);
		return Promise.reject({ reason: 'invalid', message: 'Failed to equip' });
	}
}

// ============================================================================
// SKIN CHANGER - removed per request (2026-09-17). Used to force-equip a
// cosmetic skinRing, wait for character.skin to match, then swap back to
// the normal ring - purely cosmetic, no gameplay effect, and it was
// spamming "Applying skinRing"/"Skin never applied" into the CODE log on
// every reconnect. state.skinReady only ever gated other logic on this
// process finishing, so it's set true immediately instead.
// ============================================================================
state.skinReady = true;

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function on_cm(name, data) {
	if (!plFirstTime(data && data._plid)) return;   // same message may arrive twice: in-game and relayed
	if (name == "Dexon") {
		if (data.message === 'farm_spot') {
			const changed = home !== data.home || mobMap !== data.mobMap;
			home = data.home;
			mobMap = data.mobMap;
			destination = { map: data.mobMap, x: data.x, y: data.y };
			if (changed) {
				updateHomeDependentSets();
				game_log(`Farm spot set: ${data.home} @ ${data.mobMap} (${data.x}, ${data.y})`, '#00FF00');
				resetXpTracker();
			}
		}
		if (data.message == "location") {
			respawn();
			smart_move({ x: data.x, y: data.y, map: data.map });
			game_log("Repsawning & Moving");
		}
		if (data.message == "dragold_hop") {
			try {
				change_server(data.region, data.name);
				game_log(`🐉 Following Dexon to ${data.region}${data.name} for dragold`, '#FFD700');
			} catch (e) {
				game_log(`dragold_hop follow failed: ${e}`, 'red');
			}
		}
	}
	if (name == "Meltymerch") {
		if (data.message == "Heal Merch") {
			use_skill("partyheal");
			game_log("Party Healing Meltymerch");
		}
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

game.on('death', data => {
	const mob = parent.entities[data.id];
	if (!mob) return;

	const mobName = mob.mtype;
	const mobTarget = mob.target;

	const partyMembers = Object.keys(get_party() || {});

	if (mobTarget === character.name || partyMembers.includes(mobTarget)) {
		const luckDisplay = mob.cooperative ? character.luckm : data.luckm;
		const msg = `${mobName} died with ${luckDisplay} luck`;
		game_log(msg, '#96a4ff');
		//console.log(msg);
	}
});

character.on('loot', data => {
	if (data.id) {
		console.log(`${data.opener} looted chest goldm: ${data.goldm}`);
		game_log(`${data.opener} looted chest goldm: ${data.goldm}`, 'gold');


		setTimeout(() => {
			removeChestId(data.id);
		}, 2000);
	}
});

function sendUpdates() {
	// This action refreshes a UI panel in a real browser tab and is rejected
	// outright on Mainframe ("Action send_updates is unavailable") - not
	// harmful, but spams the log every 20s for no benefit there.
	if (!parent.$) return;
	parent.socket.emit('send_updates', {});
}
setInterval(sendUpdates, 20000);

// ============================================================================
// DPS SELF-REPORT - feeds Dexon's dynamic farm spot search, since he can't
// see FatherToken's exact live stats directly.
// ============================================================================
function reportDps() {
	const dps = (character.attack || 0) * (character.frequency || 0);
	// maxHp/level ride along so Dexon's farm-spot search can check whether
	// THIS character specifically would come out net-positive on xp at a
	// candidate spot, not just the party in aggregate.
	plSend('Dexon', { message: 'dps_report', damageType: 'magical', dps, maxHp: character.max_hp, level: character.level });
}
setInterval(reportDps, 10000);
reportDps();

// ============================================================================
// START ALL LOOPS
// ============================================================================

mainLoop();
actionLoop();
skillLoop();
maintenanceLoop();
potionLoop();

// ============================================================================
// BROWSER-ONLY UI EXTRAS (Kill Tracker, Gold Meter, Game Log Filter, DPS
// Meter v4, Party Frames) - these render DOM/jQuery UI and do nothing
// useful on Mainframe (per the game's own docs on UI/button functions), so
// this entire block is skipped there rather than erroring. Each piece is
// wrapped in its own IIFE so none of their internal variable names can
// collide with each other or with anything else in this script.
// ============================================================================
if (parent.$) {

	// --- Kill Tracker ---
	(function () {
		if (parent.killTrackerInitialized) return; // guard against duplicate 'death' listeners if this script ever re-runs without a full page reload
		parent.killTrackerInitialized = true;

		let deaths = 0; // Variable to track the number of deaths
		const killTime = new Date(); // Start time to calculate elapsed time

		game.on('death', function (data) {
			if (parent.entities[data.id]) { // Check if the entity exists
				const mob = parent.entities[data.id];
				const mobName = mob.type;

				// Check if the mob is a monster
				if (mobName === 'monster') {
					const mobTarget = mob.target; // Get the mob's target
					const party = get_party(); // Get your party members

					// If party exists, extract party member names into an array
					const partyMembers = party ? Object.keys(party) : [];

					// Check if the mob's target was the player or someone in the party
					if (mobTarget === character.name || partyMembers.includes(mobTarget)) {
						console.log(data); // Log the death event
						deaths++; // Increment the death count
						killHandler(); // Call the killHandler function
					}
				}
			}
		});

		function killHandler() {
			const elapsed = (new Date() - killTime) / 1000; // Calculate elapsed time in seconds
			if (elapsed > 0) { // Prevent division by zero
				const deathsPerSec = deaths / elapsed; // Calculate deaths per second
				const dailyKillRate = calculateKillRate(deathsPerSec); // Calculate deaths based on interval

				add_top_button("kpm", Math.round(dailyKillRate.kpm).toLocaleString() + ' kpm'); // Deaths per minute
				add_top_button("kph", Math.round(dailyKillRate.kph).toLocaleString() + ' kph'); // Deaths per hour
				add_top_button("kpd", Math.round(dailyKillRate.kpd).toLocaleString() + ' kpd'); // Deaths per day
			} else {
				console.warn("Elapsed time is zero, cannot calculate rates.");
			}
		}

		// Function to calculate deaths based on the interval
		function calculateKillRate(deathsPerSec) {
			let kpm = deathsPerSec * 60; // Convert to deaths per minute
			let kph = kpm * 60; // Convert to deaths per hour
			let kpd = kph * 24; // Convert to deaths per day
			return { kpm, kph, kpd };
		}
	})();

	// --- Gold Meter ---
	(function () {
		if (parent.goldMeterInitialized) return; // guard against duplicate 'loot' listeners if this script ever re-runs without a full page reload
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

	// --- Game Log Filter ---
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
			                   otherwise. */
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

	// --- DPS Meter v4 ---
	(function () {
		// All currently supported damageTypes: "Base", "Blast", "Burn", "HPS", "MPS", "DR", "RF" "DPS"
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

				// Damage taken tracking
				if (dmg && isPlayer) {
					const e = getEntry(d.id);
					d.damage_type === 'physical' ? e.dtP += dmg : e.dtM += dmg;
				}
				if (d.dreturn && isAttacker) getEntry(d.hid).dtP += d.dreturn;
				if (d.reflect && isAttacker) getEntry(d.hid).dtM += d.reflect;

				// DR/RF attribution (only mob→player)
				if (d.dreturn && isPlayer && !get_player(d.hid)) getEntry(d.id).dr += d.dreturn;
				if (d.reflect && isPlayer && !get_player(d.hid)) getEntry(d.id).rf += d.reflect;

				// Attacker actions
				if (isAttacker) {
					const e = getEntry(d.hid);

					// Damage breakdown
					if (dmg) {
						d.source === 'burn' ? e.bD += dmg : d.splash ? e.blD += dmg : e.baD += dmg;
					}

					// Healing
					if (d.heal || d.lifesteal) {
						const target = get_player(d.id);
						e.h += showOverheal ? (d.heal || 0) + (d.lifesteal || 0) :
							(d.heal ? Math.min(d.heal, (target?.max_hp || 0) - (target?.hp || 0)) : 0) +
							(d.lifesteal ? Math.min(d.lifesteal, isAttacker.max_hp - isAttacker.hp) : 0);
					}

					// Mana steal
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

			// Sort by DPS
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

			// Totals
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

	// --- Party Frames ---
	(function () {
		if (parent.party_style_prepared) parent.$('#style-party-frames').remove();

		// POSITION FIX (2026-09-18): left:-25% pushed most of the party frame
		// row off-screen to the left on this character's own client -
		// confirmed live: only a single clipped slot (Dexon's) was visible at
		// the far edge, with this character's own entry and others missing.
		// left:0 keeps the row within normal viewport bounds.
		parent.$('head').append(`<style id="style-party-frames">
.party-container {position: absolute; top: 55px; left: 0; width: 1000px; height: 300px; font-family: 'pixel';}
</style>`);
		parent.party_style_prepared = true;

		const DISPLAY_BARS = ['hp', 'mp', 'xp', 'xprate', 'xpeta']; // <-- Add 'cc', 'ping', 'share' as needed
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

		/* `text` is the label. Pass an empty string for a bare row - the xp rate
		   and its ETA are self-describing ("22.9M xp/hr"), so a redundant
		   "XP/HR: " prefix only costs width. `fontSize` defaults to the 17px the
		   stat bars use. */
		const barHTML = (text, val, width, color, fontSize) =>
			`<div style="position:relative;width:100%;height:${fontSize ? 16 : 20}px;text-align:center;margin-top:3px;">
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:bold;font-size:${fontSize || 17}px;z-index:1;white-space:nowrap;text-shadow:-1px 0 black,0 2px black,2px 0 black,0 -1px black;">${text ? text + ': ' : ''}${val}</div>
<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-color:${color};width:${width}%;height:${fontSize ? 16 : 20}px;border:1px solid grey;"></div>
</div>`;

		// ========================================================================
		// XP/HR + TIME-TO-LEVEL - display-only, no effect on farming/combat.
		// Keeps a rolling {time, xp, level} history per party member
		// (in-memory, resets on reload), sampled opportunistically from the
		// render loop below and throttled to XP_SAMPLE_INTERVAL_MS apart.
		// ========================================================================
		const XP_SAMPLE_INTERVAL_MS = 5000; // minimum spacing between kept samples
		const XP_WINDOW_MS = 5 * 60 * 1000; // rolling window used for the rate calc
		const xpHistory = new Map(); // name -> [{t, xp, level}, ...], oldest first

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

		// xp resets to 0 each level, so a naive (new.xp - old.xp) is wrong
		// across a level-up - same fix as the fighter scripts' own xpTracker.
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

		// Returns display strings, not raw numbers - keeps xprate's calc() simple.
		function computeXpRateAndEta(name, info) {
			const hist = updateXpHistory(name, info);
			if (!hist || hist.length < 2) return { rateStr: '—', etaStr: '—' };

			const oldest = hist[0];
			const newest = hist[hist.length - 1];
			const elapsedSec = (newest.t - oldest.t) / 1000;
			if (elapsedSec < 10) return { rateStr: '—', etaStr: '—' }; // too little data yet - avoid a wild first reading

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

		/* Anchor the party block on the left edge of the code-button row.

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
		   unless the measured offset actually changed. */
		const findAnchor = () => {
			const cb = parent.document.querySelector('.codebuttons');
			if (!cb) return null;
			for (const el of cb.children) if (el.offsetWidth) return el;
			for (let el = cb.nextElementSibling; el; el = el.nextElementSibling) if (el.offsetWidth) return el;
			return null;
		};

		/* Only align a POSITIONED #newparty, and say so once if it is not.

		   What makes it positioned is our own `.party-container`, applied by the
		   render loop two lines before this runs - the game ships #newparty as a
		   static inline-block. So if the style block ever fails to inject, the
		   class goes inert, `left`/`right` would be ignored and writing `width`
		   into an in-flow child of #toprightcorner would widen that container,
		   move the anchor, and start a 250ms oscillation. Reading the computed
		   value catches exactly that. */
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
		   `width` are interpreted as CSS pixels, and rect.left is viewport-relative
		   while `left` on a positioned element is relative to its offsetParent.
		   offsetLeft is already CSS px and already relative to offsetParent, so
		   accumulating it needs no origin correction and no scale factor, and
		   cannot drift if the client's scale changes. */
		const offsetLeftWithin = (el, ancestor) => {
			let x = 0, node = el;
			while (node && node !== ancestor) { x += node.offsetLeft; node = node.offsetParent; }
			return node === ancestor ? x : null;
		};

		const alignPartyFrames = (partyFrame, count) => {
			const anchor = findAnchor();
			if (!anchor || !count) return;
			if (!partyFrameIsPositioned(partyFrame)) return;

			const np = partyFrame[0];
			const anchorBox = np.offsetParent;
			if (!anchorBox) return;

			/* Both measured against the SAME offsetParent, or not at all: if the
			   anchor is not inside it the two numbers are in different coordinate
			   spaces and subtracting them would be meaningless. */
			const anchorLeft = offsetLeftWithin(anchor, anchorBox);
			if (anchorLeft === null || !isFinite(anchorLeft)) return;

			/* One row, always. max-content plus nowrap lets the row size itself,
			   so there is no arithmetic to get wrong and no member count at which
			   it silently wraps onto a second row. */
			if (partyFrame.data('alignedTo') === anchorLeft && partyFrame.data('alignedN') === count) return;
			partyFrame.css({ left: anchorLeft + 'px', right: 'auto', width: 'max-content', 'white-space': 'nowrap' });

			/* Second pass: whatever inset the first cell has once it is laid out
			   on one row, take it off, so the FIRST member's frame is flush with
			   the anchor rather than the container's padding edge. Measured after
			   the write because the inset is a product of that layout. */
			np.offsetWidth;
			const inset = np.children[0] ? np.children[0].offsetLeft : 0;
			if (inset) partyFrame.css('left', (anchorLeft - inset) + 'px');

			partyFrame.data('alignedTo', anchorLeft).data('alignedN', count);
		};

		setInterval(() => {
			const partyFrame = parent.$('#newparty').addClass('party-container');
			if (!partyFrame.length) return;

			/* The merchant gets no frame. Excluded by CLASS rather than by name, so
			   it survives a rename and cannot hide a different character who
			   happens to share the name. The game builds one cell per party member
			   in member order, so the cell is hidden in place and the count passed
			   to alignPartyFrames is the count of VISIBLE cells. */
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

