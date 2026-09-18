// ============================================================================
// MageofOz (Mage) - Mainframe slot CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom - v42 (actionLoop error logging now uses describeError() instead of raw console.error)
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
// CONFIGURATION - Toggle features here instead of editing code.
// Built for MageofOz (mage, level 41 at time of writing). curse/mshield are
// priest/paladin-only. cburst/entangle/aether_shield/phaseout/arcane_needle
// all need a higher level than 41 - re-check G.skills[name].level and add
// them back in once castable.
// ============================================================================
// home/mobMap come from Dexon's 'farm_spot' CODE message, not hardcoded -
// start null until that arrives (see on_cm below).
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
		// Mana Burst dumps the ENTIRE mp pool as pure damage - only fire it
		// when mp is comfortably high, never as a reflex low-mp action.
		manaBurst: {
			enabled: true,
			minMp: 1200,       // don't burst below this - keep some mp in reserve
			// home used to be baked in here, but it isn't known yet at load
			// time now - checked separately alongside this list wherever
			// it's consumed (see actionLoop's canBurst check).
			targets: [...allBosses],
		},
		targetPriority: ['FatherToken'],
		allBosses,
	},

	movement: {
		enabled: true,
		circleWalk: true,
		circleRadius: 35,
	},

	support: {
		// Energize: buffs an ally's attack speed and tops up their mp.
		// Defaults to buffing Dexon (the ranger) since ranged aspd scales well
		// with this. Change target to FatherToken if you'd rather buff the
		// priest instead.
		energize: {
			enabled: true,
			target: 'Dexon',
			minSelfMp: 500, // don't energize if it would leave MageofOz too low
		},
		// Magiport pulls a named ally to MageofOz's location. Off by default -
		// it moves another character without them asking for it in the moment,
		// so leave this opt-in until you've decided you want it.
		magiport: {
			enabled: false,
			target: 'Dexon',
			triggerDistance: 2000, // only pull if they're this far away
		},
	},

	selfPreservation: {
		// Blink is a short teleport, used here purely to break away from
		// immediate danger. No offensive use.
		blinkOnLowHp: {
			enabled: true,
			hpThreshold: 0.25, // blink away below 25% hp
		},
	},

	looting: {
		lootSet: "current",
		enabled: true,
		chestThreshold: 1,
		lootCooldown: 3000
	},

	equipment: {
		autoSwapSets: true,
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

	// Shared with Ranger.js / Priest.js - keep this array identical across
	// all three scripts, since the rotation index is shared via localStorage.
	temporal: {
		enabled: true,
		targetMob: 'bscorpion',
		orbName: 'orboftemporal',
		skillName: 'temporalsurge',
		characters: ['FatherToken', 'Dexon', 'MageofOz'],
		storageKey: 'temporal_surge_rotation'
	},

	// Selling is left disabled - I don't know which mage drops you actually
	// want auto-sold. Fill in a whitelist and flip this on when you're ready.
	selling: {
		enabled: false,
		whitelist: [],
	},

	// Mirrors Ranger.js's mule behavior: send spare gold/items to Meltymerch,
	// via Dexon first (the collector) - same pattern as Priest.js.
	muling: {
		enabled: true,
		muleName: 'Dexon',
		fallbackMuleName: 'Meltymerch',
		goldReserve: 500000,
		excludeItems: new Set(['hpot0', 'hpot1', 'mpot0', 'mpot1', 'xptome']),
	},
};

// ============================================================================
// CONSTANTS
// ============================================================================
// CPU FIX: action was 1ms, so actionLoop() fired ~1000x/sec on every
// branch - no busy-wait here (unlike Ranger/Priest), but still needlessly
// tight for a CPU-quota-limited Mainframe microVM. Raised to 15ms; real
// attack/burst cooldowns are hundreds of ms minimum, so no real cost.
const TICK_RATE = { main: 100, action: 15, skill: 100, maintenance: 2000 };
const MERCHANT_WAIT_TIMEOUT_MS = 90000; // safety net if merchant_done never arrives (e.g. merchant died mid-summon)
const CACHE_TTL = 50;

const EVENT_LOCATIONS = [
	{ name: 'dragold', map: 'cave', x: 1150, y: -850 },
	{ name: 'mrgreen', map: 'spookytown', x: 610, y: 1000 },
	{ name: 'mrpumpkin', map: 'halloween', x: -222, y: 720 }
];

const getDynamicEvents = () => {
	const w = parent.S?.wabbit;
	return w?.live ? [...EVENT_LOCATIONS, { name: 'wabbit', map: w.map, x: w.x, y: w.y }] : EVENT_LOCATIONS;
};

// ============================================================================
// STATE & CACHE
// ============================================================================
const state = {
	skinReady: true, // no mage skin changer - see removal note further down
	lastEnergize: 0,
	lastMagiport: 0,
	angle: 0,
	lastAngleUpdate: performance.now(),
	waitingForMerchant: false,
	waitingForMerchantSince: 0,
	restocking: false,
};

const cache = {
	target: null,
	energizeTarget: null,
	lastUpdate: 0,
	isValid() { return performance.now() - this.lastUpdate < CACHE_TTL; }
};

// ============================================================================
// LOCATION DATA (shared farming spot with Ranger.js / Priest.js)
// ============================================================================
const locations = {
	bat: [{ x: 1200, y: -782 }],
	bigbird: [{ x: 1258, y: -69 }],
	bluefairy: [{ x: -344, y: -680 }],
	bscorpion: [{ x: -555, y: -1158 }],
	// 'ent' removed - no longer hardcoded here, comes from Dexon's
	// 'farm_spot' message instead (see destination, set in on_cm).
	ghost: [{ x: -405, y: -1642 }],
	mummy: [{ x: 256, y: -1417 }],
};

// destination used to be built from a local locations[home] lookup - now
// it's set directly from Dexon's 'farm_spot' message (see on_cm below).
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
const UNREACHABLE_TIMEOUT_MS = 5 * 60 * 1000; // assigned but never arrived after this long - something (e.g. a stuck smart_move) is blocking travel entirely

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
			xpTracker.lastXp = character.xp;
			xpTracker.lastLevel = character.level;
			xpTracker.lastCheckTime = Date.now();
			return;
		}

		// Still traveling. If this drags on far longer than any reasonable
		// travel time, something is actually preventing arrival (a stuck
		// smart_move, an unreachable map, etc.) - report it the same way as
		// a bad-xp spot so Dexon blacklists it and moves the party on,
		// rather than waiting here forever with the 3-strike counter never
		// even starting.
		if (!xpTracker.reportedUnreachable && Date.now() - xpTracker.assignedAt > UNREACHABLE_TIMEOUT_MS) {
			xpTracker.reportedUnreachable = true;
			game_log(`Still haven't reached ${home}@${mobMap} after ${Math.round(UNREACHABLE_TIMEOUT_MS / 60000)} minutes - reporting to Dexon for blacklist`, 'red');
			plSend('Dexon', {
				message: 'blacklist_spot',
				home,
				mobMap,
				reason: `${character.name} couldn't reach ${home}@${mobMap} after ${Math.round(UNREACHABLE_TIMEOUT_MS / 60000)} minutes - likely unreachable`,
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

// ============================================================================
// EQUIPMENT - built from MageofOz's actual equipped items, not guessed gear.
// Verify slot/level values against current inventory before relying on this;
// re-run mainframe_get_character('MageofOz') if you've re-geared since.
// ============================================================================
const equipmentSets = {
	current: [
		{ itemName: "mushroomstaff", slot: "mainhand", level: 4, l: "l" },
		{ itemName: "wcap", slot: "helmet", level: 4, l: "l" },
		{ itemName: "wattire", slot: "chest", level: 4, l: "l" },
		{ itemName: "wbreeches", slot: "pants", level: 4, l: "l" },
		{ itemName: "wshoes", slot: "shoes", level: 3, l: "l" },
		{ itemName: "wgloves", slot: "gloves", level: 4, l: "l" },
		{ itemName: "intamulet", slot: "amulet", level: 0, l: "l" },
	],
};

// ============================================================================
// CORE UTILITIES
// ============================================================================
const BOSS_SET = new Set(allBosses);

function updateCache() {
	if (!cache.isValid()) {
		cache.target = findBestTarget();
		cache.energizeTarget = findEnergizeTarget();
		cache.lastUpdate = performance.now();
	}
}

function findBestTarget() {
	for (const bossType of BOSS_SET) {
		const boss = get_nearest_monster_v2({ type: bossType, max_distance: character.range });
		if (boss) return boss;
	}

	// Protect whoever's named in targetPriority - attack whatever is
	// currently targeting them, same semantics as Ranger.js's COMBAT_SETS.
	const priorityNames = CONFIG.combat.targetPriority;
	if (priorityNames?.length) {
		const protectTarget = get_nearest_monster_v2({ target: priorityNames, max_distance: character.range });
		if (protectTarget) return protectTarget;
	}

	return home ? get_nearest_monster({ type: home }) : null;
}

function findEnergizeTarget() {
	const cfg = CONFIG.support.energize;
	if (!cfg.enabled) return null;
	const ally = get_player(cfg.target);
	if (!ally || ally.rip) return null;
	return ally;
}

// Adapted from Ranger.js/Priest.js's get_nearest_monster_v2 helper.
function get_nearest_monster_v2(args = {}) {
	let min_d = 999999;
	let target = null;

	for (let id in parent.entities) {
		let current = parent.entities[id];
		if (current.type !== 'monster' || !current.visible || current.dead) continue;

		if (args.type) {
			if (Array.isArray(args.type)) {
				if (!args.type.includes(current.mtype)) continue;
			} else if (current.mtype !== args.type) continue;
		}

		if (args.target && !args.target.includes(current.target)) continue;

		const c_dist = parent.distance(character, current);
		if (args.max_distance !== undefined && c_dist > args.max_distance) continue;

		if (c_dist < min_d) { min_d = c_dist; target = current; }
	}

	return target;
}

// ============================================================================
// MAIN TICK LOOP
// ============================================================================
async function mainLoop() {
	try {
		if (is_disabled(character)) return setTimeout(mainLoop, 250);
		if (state.waitingForMerchant) {
			if (Date.now() - state.waitingForMerchantSince > MERCHANT_WAIT_TIMEOUT_MS) {
				state.waitingForMerchant = false;
				game_log('Gave up waiting on the merchant - resuming on my own', 'red');
			} else {
				return setTimeout(mainLoop, 250);
			}
		}
		if (await checkPotionEmergency()) {
			return setTimeout(mainLoop, TICK_RATE.main);
		}
		if (!home || !mobMap || !destination) {
			return setTimeout(mainLoop, 250); // haven't heard from Dexon yet
		}

		updateCache();

		if (CONFIG.looting.enabled) await handleLooting();

		if (shouldHandleEvents()) {
			handleEvents();
		} else if (CONFIG.movement.enabled) {
			if (!get_nearest_monster({ type: home })) {
				handleReturnHome();
			} else if (CONFIG.movement.circleWalk) {
				walkInCircle();
			}
		}

		if (CONFIG.equipment.autoSwapSets && state.skinReady) {
			if (!isSetEquipped('current')) equipSet('current');
		}

	} catch (e) {
		console.error('mainLoop error:', e);
	}

	setTimeout(mainLoop, TICK_RATE.main);
}

// ============================================================================
// ACTION LOOP - basic attack + Mana Burst
// ============================================================================
async function actionLoop() {
	try {
		if (is_disabled(character)) return setTimeout(actionLoop, 25);
		updateCache();

		const target = cache.target;
		if (!target || !is_in_range(target) || smart.moving) {
			return setTimeout(actionLoop, TICK_RATE.action);
		}

		const burstCfg = CONFIG.combat.manaBurst;
		const canBurst = burstCfg.enabled
			&& character.mp >= burstCfg.minMp
			&& !is_on_cooldown('burst')
			&& (burstCfg.targets.includes(target.mtype) || target.mtype === home);

		if (canBurst) {
			await use_skill('burst', target);
		} else if (!is_on_cooldown('attack')) {
			await use_skill('attack', target);
		}

	} catch (e) {
		// Was raw console.error(e) - game API rejections are often plain
		// objects, not real Error instances, so this printed a useless
		// "[object Object]" every time (confirmed spamming multiple times
		// per second live on 2026-09-17, with no way to see what was
		// actually failing). describeError() already existed and was used
		// by maintenanceLoop/potionLoop's catch blocks - just missing here.
		console.error('actionLoop error:', describeError(e));
	}

	setTimeout(actionLoop, TICK_RATE.action);
}

// ============================================================================
// SKILL LOOP - support skills (energize, magiport, blink)
// ============================================================================
async function skillLoop() {
	try {
		if (is_disabled(character)) return setTimeout(skillLoop, 250);
		updateCache();

		await handleEnergize();
		await handleMagiport();
		handleBlinkEscape();

	} catch (e) {
		console.error('skillLoop error:', e);
	}

	setTimeout(skillLoop, TICK_RATE.skill);
}

async function handleEnergize() {
	const cfg = CONFIG.support.energize;
	if (!cfg.enabled || is_on_cooldown('energize')) return;
	if (character.level < (G.skills.energize?.level || 0)) return; // not unlocked yet (level 20)

	const target = cache.energizeTarget;
	if (!target) return;
	if (character.mp < cfg.minSelfMp) return;
	if (!is_in_range(target, 'energize')) return;

	await use_skill('energize', target);
	state.lastEnergize = performance.now();
}

async function handleMagiport() {
	const cfg = CONFIG.support.magiport;
	if (!cfg.enabled || is_on_cooldown('magiport')) return;
	if (character.mp < (G.skills.magiport?.mp || 0)) return;

	const target = get_player(cfg.target);
	if (!target || target.rip) return;

	const dist = parent.distance(character, target);
	if (dist < cfg.triggerDistance) return;

	await use_skill('magiport', target);
	state.lastMagiport = performance.now();
}

function handleBlinkEscape() {
	const cfg = CONFIG.selfPreservation.blinkOnLowHp;
	if (!cfg.enabled || is_on_cooldown('blink')) return;
	if (character.hp / character.max_hp > cfg.hpThreshold) return;
	if (character.mp < (G.skills.blink?.mp || 0)) return; // can't afford it - no point attempting

	// Blink to a short random offset from current position - just needs to
	// break line-of-sight/aggro, not reach anywhere specific.
	const angle = Math.random() * Math.PI * 2;
	const bx = character.x + Math.cos(angle) * 150;
	const by = character.y + Math.sin(angle) * 150;
	use_skill('blink', [bx, by]);
	game_log('Blink: low HP escape', '#00FFFF');
}

// ============================================================================
// MAINTENANCE LOOP
// ============================================================================
async function maintenanceLoop() {
	try {
		if (CONFIG.potions.autoBuy) autoBuyPotions();
		if (CONFIG.party.autoManage) partyMaker();
		if (CONFIG.selling.enabled) sellItems();
		if (CONFIG.muling.enabled) muleToMerchant();
		checkOwnXpEconomics();

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
// POTION LOOP
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

// ============================================================================
// EQUIPMENT HELPERS
// ============================================================================
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

// ============================================================================
// SKIN CHANGER - removed per request (2026-09-17). This was already just a
// no-op stub (no mage skin config was ever defined), and state.skinReady is
// initialized true above anyway, so removing it changes nothing at runtime.
// ============================================================================

// ============================================================================
// MOVEMENT
// ============================================================================
function shouldHandleEvents() {
	return getDynamicEvents().some(e => parent?.S?.[e.name]?.live);
}

function handleEvents() {
	let target = null, bestRatio = Infinity;
	for (const e of getDynamicEvents()) {
		const d = parent.S[e.name];
		if (!d?.live) continue;
		const r = d.hp / d.max_hp;
		if (r < bestRatio) { bestRatio = r; target = e; }
	}
	if (!target) return;
	if (!smart.moving) smart_move({ x: target.x, y: target.y, map: target.map });
}

function handleReturnHome() {
	if (distance(character, destination) < 20) return;
	if (!smart.moving) smart_move(destination);
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
// LOOTING
// ============================================================================
const CHEST_STORAGE_KEY = 'loot_chest_ids';

function loadChestMap() {
	const data = get(CHEST_STORAGE_KEY);
	return typeof data === 'object' && data !== null ? data : {};
}
function saveChestMap(map) { set(CHEST_STORAGE_KEY, map); }
function removeChestId(id) {
	const stored = loadChestMap();
	if (stored[id]) { delete stored[id]; saveChestMap(stored); }
}
function updateChestsInStorage() {
	const stored = loadChestMap();
	const now = performance.now();
	for (const id of Object.keys(get_chests())) {
		if (!stored[id]) stored[id] = now;
	}
	saveChestMap(stored);
}

async function handleLooting() {
	try {
		const chestMap = loadChestMap();
		const now = performance.now();
		for (const id of Object.keys(chestMap)) {
			const storedAt = chestMap[id];
			if (!storedAt) continue;
			if (now - storedAt < CONFIG.looting.lootCooldown) continue;
			await loot(id);
			removeChestId(id);
		}
	} catch (err) {
		console.error('Looting error:', err);
	}
}
setInterval(updateChestsInStorage, 250);

// ============================================================================
// SELLING (disabled by default - see CONFIG.selling)
// ============================================================================
function sellItems() {
	if (!CONFIG.selling.enabled) return;
	const whitelist = new Set(CONFIG.selling.whitelist);
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && whitelist.has(item.name) && item.p === undefined && item.l !== 'l') sell(i);
	}
}

// ============================================================================
// MULING (disabled by default - see CONFIG.muling)
// ============================================================================
function muleToMerchant() {
	const cfg = CONFIG.muling;
	const mule = get_player(cfg.muleName) || get_player(cfg.fallbackMuleName);
	if (!mule || !is_in_range(mule, 'attack')) return;

	if (character.gold > cfg.goldReserve) {
		send_gold(mule, character.gold - cfg.goldReserve);
	}

	character.items.forEach((item, i) => {
		if (item && !cfg.excludeItems.has(item.name) && !item.l && !item.s) {
			send_item(mule.id, i, item.q ?? 1);
		}
	});
}

// ============================================================================
// TEMPORAL SURGE COORDINATION (shared rotation with Ranger.js / Priest.js)
// ============================================================================
function getTemporalRotation() {
	// get()/set() are the game's own storage functions - unlike localStorage
	// (a browser-only Web API), these work identically in a real browser tab
	// and on Mainframe's sandboxed runtime.
	const stored = get(CONFIG.temporal.storageKey);
	if (!stored) {
		const initial = { lastUser: null, nextIndex: 0, lastKillTime: 0 };
		set(CONFIG.temporal.storageKey, initial);
		return initial;
	}
	return stored;
}

function updateTemporalRotation() {
	const rotation = getTemporalRotation();
	rotation.lastUser = character.name;
	rotation.nextIndex = (rotation.nextIndex + 1) % CONFIG.temporal.characters.length;
	rotation.lastKillTime = Date.now();
	set(CONFIG.temporal.storageKey, rotation);
}

function isMyTurnForTemporal() {
	const rotation = getTemporalRotation();
	const myIndex = CONFIG.temporal.characters.indexOf(character.name);
	if (myIndex === -1) return false;
	return rotation.lastUser === null || rotation.nextIndex === myIndex;
}

async function handleTemporalSurge() {
	if (!CONFIG.temporal.enabled) return;
	if (!isMyTurnForTemporal()) return;

	const orbSlot = character.items.findIndex(i => i?.name === 'orboftemporal');
	if (orbSlot === -1) return; // MageofOz may not own this orb - silently skip

	try {
		equip(orbSlot, 'orb');
		use_skill(CONFIG.temporal.skillName);
		game_log(`Temporal Surge used on ${CONFIG.temporal.targetMob}!`, '#00FFFF');
		updateTemporalRotation();
	} catch (e) {
		console.error('Temporal surge error:', e);
	}
}

parent.socket.on('kill_credit', async (data) => {
	if (!CONFIG.temporal.enabled) return;
	if (data.mtype !== CONFIG.temporal.targetMob) return;
	if (!is_on_cooldown(CONFIG.temporal.skillName)) {
		await handleTemporalSurge();
	}
});

// ============================================================================
// PARTY MANAGEMENT (same leader/follower pattern as Ranger.js / Priest.js)
// ============================================================================
function partyMaker() {
	if (!CONFIG.party.autoManage) return;

	const group = CONFIG.party.groupMembers;
	const leaderName = group[0]; // Dexon leads
	const party = get_party() || {};
	const partyLead = get_entity(leaderName);

	if (character.name === leaderName) {
		for (let i = 1; i < group.length; i++) {
			const name = group[i];
			if (name === character.name || party[name]) continue;
			send_party_invite(name);
		}
	} else {
		if (!party[character.name] && partyLead) {
			send_party_request(leaderName);
		}
	}
}

function on_party_request(name) {
	if (CONFIG.party.groupMembers.includes(name)) accept_party_request(name);
}
function on_party_invite(name) {
	if (CONFIG.party.groupMembers.includes(name)) accept_party_invite(name);
}

// ============================================================================
// EVENT HANDLERS - CODE messages
// ============================================================================
function on_cm(name, data) {
	if (!plFirstTime(data && data._plid)) return;   // same message may arrive twice: in-game and relayed
	if (name === "Dexon" && data.message === 'farm_spot') {
		const changed = home !== data.home || mobMap !== data.mobMap;
		home = data.home;
		mobMap = data.mobMap;
		destination = { map: data.mobMap, x: data.x, y: data.y };
		if (changed) resetXpTracker();
	}
	// Dexon's "Return" button broadcasts its location to FatherToken and
	// MageofOz so they can respawn/regroup - same pattern as Priest.js.
	if (name === "Dexon" && data.message === "location") {
		respawn();
		smart_move({ x: data.x, y: data.y, map: data.map });
		game_log("Respawning & Moving to Dexon");
	}
	if (name === "Dexon" && data.message === "dragold_hop") {
		try {
			change_server(data.region, data.name);
			game_log(`🐉 Following Dexon to ${data.region}${data.name} for dragold`, '#FFD700');
		} catch (e) {
			game_log(`dragold_hop follow failed: ${e}`, 'red');
		}
	}
	if (name === "Meltymerch" && data.message === "come_to_merchant") {
		state.waitingForMerchant = true;
		state.waitingForMerchantSince = Date.now();
		game_log('Meltymerch needs me to come to him', '#FFD700');
		smart_move({ x: data.x, y: data.y, map: data.map });
	}
	if (name === "Meltymerch" && data.message === "merchant_done") {
		state.waitingForMerchant = false;
		game_log('Merchant business done - resuming', '#00FF00');
	}
}

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
// see MageofOz's exact live stats directly.
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
			upgrade: { show: true, regex: /(upgrade|combination)/, label: 'Upgr.' },
			errors: { show: true, regex: /(error|line|column)/i, label: 'Errors' }
		};

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
				height: '24px',
				background: 'black',
				margin: '-5px 0',
				display: 'flex',
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
					height: '100%',
					width: `${100 / Object.keys(FILTERS).length}%`,
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

		function filterGamelog() {
			const entries = parent.document.querySelectorAll('.gameentry');
			entries.forEach(entry => {
				let shouldShow = true;
				for (const filter of Object.values(FILTERS)) {
					if (filter.regex.test(entry.innerHTML)) {
						shouldShow = filter.show;
						break;
					}
				}
				entry.style.display = shouldShow ? 'block' : 'none';
			});
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

			let display = 'block';
			for (const filter of Object.values(FILTERS)) {
				if (filter.regex.test(message)) {
					display = filter.show ? 'block' : 'none';
					break;
				}
			}

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

		parent.socket.on('hit', d => {
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
		});

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

		parent.$('head').append(`<style id="style-party-frames">
.party-container {position: absolute; top: 55px; left: -25%; width: 1000px; height: 300px; font-family: 'pixel';}
</style>`);
		parent.party_style_prepared = true;

		const DISPLAY_BARS = ['hp', 'mp', 'xp', 'xprate']; // <-- Add 'cc', 'ping', 'share' as needed
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

		const barHTML = (text, val, width, color) =>
			`<div style="position:relative;width:100%;height:20px;text-align:center;margin-top:3px;">
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:bold;font-size:17px;z-index:1;white-space:nowrap;text-shadow:-1px 0 black,0 2px black,2px 0 black,0 -1px black;">${text}: ${val}</div>
<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-color:${color};width:${width}%;height:20px;border:1px solid grey;"></div>
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
			if (xpPerHour <= 0) return '0/hr';
			if (xpPerHour >= 1000000) return (xpPerHour / 1000000).toFixed(1) + 'M/hr';
			if (xpPerHour >= 1000) return (xpPerHour / 1000).toFixed(1) + 'k/hr';
			return Math.round(xpPerHour) + '/hr';
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
			xprate: {
				color: 'purple', label: 'XP/HR',
				calc: (i) => {
					if (!i || i.name === undefined || i.xp === undefined || i.level === undefined) return { val: '??', width: 0 };
					const { rateStr, etaStr } = computeXpRateAndEta(i.name, i);
					return { val: `${rateStr} · next ${etaStr}`, width: 0 };
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

		setInterval(() => {
			const partyFrame = parent.$('#newparty').addClass('party-container');
			if (!partyFrame.length) return;

			const members = Object.keys(parent.party);
			partyFrame.children().each((x, el) => {
				const name = members[x];
				let info = get(name + '_newparty_info');

				if (!info || Date.now() - info.lastSeen > 1000) {
					const iframed = getIFramedChar(name);
					info = iframed ? extractInfo(iframed) : (get_player(name) || { name });
				}

				const partyData = parent.party[name];
				let html = `<div style="width:${FRAME_WIDTH}px;height:20px;margin-top:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${info.name}</div>`;

				for (const key of DISPLAY_BARS) {
					const cfg = barConfigs[key];
					const { val, width } = cfg.calc(info, partyData);
					if (val !== undefined && val !== '??') {
						html += barHTML(cfg.label || key.toUpperCase(), val, width, cfg.color);
					}
				}

				parent.$(el).children().first().css('display', SHOW_IMG ? 'inherit' : 'none');
				parent.$(el).children().last().html(`<div style="font-size:22px;" onclick='pcs(event);party_click("${name}");'>${html}</div>`);
			});
		}, 250);

		parent.$('#party-props-toggles').remove();
	})();

}
