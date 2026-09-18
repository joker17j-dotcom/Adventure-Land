// ============================================================================
// Dexon (Ranger) - Mainframe slot CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB - v32 (ported the full BROWSER-ONLY UI EXTRAS block - Kill Tracker, Gold Meter, Game Log Filter, DPS Meter v4, Party Frames - from Priest/Mage; v24-lineage predated this block and never had it. Purely browser-only, no-op on Mainframe.)
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
// CONFIGURATION
// ============================================================================
// home/mobMap are no longer hardcoded - determined dynamically by
// findBestFarmSpot() below, based on live party DPS vs. real monster/map
// data. They start null until the first search completes.
let home = null;
let mobMap = null;
const homeServer = 'USIV';
const allBosses = ['bgoo', 'bscorpion', 'crabxx', 'dragold', 'ent', 'franky', 'greenjr', 'grinch', 'icegolem', 'jr', 'mrgreen', 'mrpumpkin', 'phoenix', 'rgoo', 'wabbit'];

const CONFIG = {
	combat: {
		enabled: true,
		targetPriority: ['FatherToken'],
		alwaysAttack: ['crabx', 'wabbit'], // 'home' is checked directly in shouldAttackMob() instead, since it's now dynamic
		attackIfTargeted: [...allBosses, 'phoenix'],
		neverAttack: ['nerfedmummy', 'target_ar500red', 'target_ar900', 'target', 'target_a500', 'target_a750', 'target_r500', 'target_r750'],
		useHuntersMark: true,
		useSupershot: true,
		minTargetsFor5Shot: 4,
		minTargetsFor3Shot: 2,
	},

	movement: {
		enabled: true,
		circleWalk: true,
		circleRadius: 75,
		moveThreshold: 25,
		clumpRadius: 85,
		rangedKiting: {
			enabled: false,
			targets: ['bscorpion'],
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
		xpMonsters: ['sparkbot'], // 'home' checked directly alongside this below, since it's dynamic now
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
		minStock: 1000
	},

	party: {
		autoManage: true,
		groupMembers: ['Dexon', 'MageofOz', 'FatherToken', 'Meltymerch']
	},

	looting: {
		enabled: true,
		delayMs: 180000,
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
		enabled: false, // stays off: this only fires from the "Pause2" browser button, which has no effect on Mainframe anyway
		characters: {
			MERCHANT: { name: 'Meltymerch', codeSlot: 'CH_aLtHealaSgKdmOsDWpNl8scE9NhXk' },
			PRIEST: { name: 'FatherToken', codeSlot: 'CH_hae5t3g8gBezOVTdR6ToTagikbTbF' },
			MAGE: { name: 'MageofOz', codeSlot: 'CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom' } // MageofOz's existing saved slot
		}
	},

	locationBroadcast: {
		enabled: true,
		targetPlayer: 'Meltymerch',
		checkInterval: 1000,
		lowInventorySlots: 3
	},

	dragold: {
		enabled: true,
		preSpawnBuffer: 3000,
	},

	muling: {
		enabled: true,
		muleName: 'Meltymerch',
		goldReserve: 500000,
		excludeItems: new Set(['hpot0', 'hpot1', 'mpot0', 'mpot1', 'luckbooster', 'xpbooster', 'pumpkinspice', 'xptome']),
	},
};

// ============================================================================
// CONSTANTS
// ============================================================================
const TICK_RATE = { main: 100, action: 15, mark: 40, equipment: 25, maintenance: 2000 };
const MERCHANT_WAIT_TIMEOUT_MS = 90000; // safety net if merchant_done never arrives (e.g. merchant died mid-summon)
const COOLDOWNS = { cc: 135 };
const CACHE_TTL = 50;

const EVENT_LOCATIONS = [
	{ name: 'dragold', map: 'cave', x: 1150, y: -850 },
	//{ name: 'crabxx', map: 'main', x: -961, y: 1780, join: true },
	{ name: 'mrgreen', map: 'spookytown', x: 610, y: 1000 },
	{ name: 'mrpumpkin', map: 'halloween', x: -222, y: 720 }
];

const getDynamicEvents = () => {
	const w = parent.S?.wabbit;
	return w?.live ? [...EVENT_LOCATIONS, { name: 'wabbit', map: w.map, x: w.x, y: w.y }] : EVENT_LOCATIONS;
};

const REGIONS = ['US', 'EU', 'ASIA'];

// ============================================================================
// OPTIMIZED LOOKUPS
// ============================================================================
const COMBAT_SETS = {
	neverAttack: new Set(CONFIG.combat.neverAttack),
	attackIfTargeted: new Set(CONFIG.combat.attackIfTargeted),
	alwaysAttack: new Set(CONFIG.combat.alwaysAttack),
	targetPriority: new Set(CONFIG.combat.targetPriority),
	xpMonsters: new Set(CONFIG.equipment.xpMonsters),
	bosses: new Set(allBosses),
};

// ============================================================================
// STATE & CACHE
// ============================================================================
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

// ============================================================================
// LOCATION & EQUIPMENT DATA
// ============================================================================
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

// destination is now set by findBestFarmSpot() once its search completes,
// rather than a static locations[home] lookup.
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
		//{ itemName: "amuletofm", slot: "amulet", level: 0, l: "l" },
	],
	stealth: [{ itemName: "stealthcape", slot: "cape", level: 0, l: "l" }],
	cape: [{ itemName: "vcape", slot: "cape", level: 6, l: "l" }],
	mana: [{ itemName: "tshirt9", slot: "chest", level: 7, l: "l" }],
	stat: [{ itemName: "coat", slot: "chest", level: 12, l: "s" }],
};

// ============================================================================
// CORE UTILITIES
// ============================================================================
const shouldAttackMob = (mob) => {
	if (!mob || mob.dead) return false;
	if (COMBAT_SETS.neverAttack.has(mob.mtype)) return false;
	if (mob.mtype === home) return true; // current farm-spot mob - engage unconditionally, whatever it currently is
	if (COMBAT_SETS.alwaysAttack.has(mob.mtype)) return true;
	if (COMBAT_SETS.attackIfTargeted.has(mob.mtype)) {
		return mob.target !== null && mob.target !== undefined;
	}
	return COMBAT_SETS.targetPriority.has(mob.target);
};

const EXPLOSION_RADIUS = { boom: 68 / 3.6, dead: 23 / 3.6 };

const updateCache = () => {
	if (!cache.isValid()) {
		if (!destination) return; // farm spot search hasn't completed yet
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
			return setTimeout(mainLoop, 250); // farm spot search hasn't completed yet
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

		if (await dragold.tick() === 'block') {
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
				await rangedKite();
			} else if (CONFIG.movement.circleWalk) {
				walkInCircle();
			}
		}
	} catch (e) {
		console.error('mainLoop error:', e);
	}

	setTimeout(mainLoop, TICK_RATE.main);
}

// ============================================================================
// ACTION LOOP
// ============================================================================
// CPU FIX: used to busy-wait-spin on performance.now() and reschedule at a
// 0-1ms floor, firing ~1000x/sec with a synchronous spin - this is what
// triggered a real Mainframe cpu_guard kill (see FatherToken's event
// history). Spin removed, floor raised to 15ms - real attack cooldowns are
// hundreds of ms minimum, so this costs no real responsiveness.
const ACTION_MIN_DELAY = 15;

const actionLoop = async () => {
	try {
		if (is_disabled(character)) return setTimeout(actionLoop, 25);
		updateCache();
		const ms = ms_to_next_skill('attack') - 1.5;
		if (ms < 3) {
			if (cache.healTarget) { equipSet('heal'); await use_skill('attack', cache.healTarget); }
			else await handleAttack();
			return setTimeout(actionLoop, ACTION_MIN_DELAY);
		}
		return setTimeout(actionLoop, ms > 8 ? ms - 6 : ACTION_MIN_DELAY);
	} catch { return setTimeout(actionLoop, ACTION_MIN_DELAY); }
};

const handleAttack = async () => {
	const { sortedByHP, clumped } = cache.targets;
	if (!sortedByHP.length) return;

	const min5 = CONFIG.combat.minTargetsFor5Shot;
	const min3 = CONFIG.combat.minTargetsFor3Shot;
	// Level-gated: without this check, the code would keep trying (and
	// silently failing) 3shot/5shot on every multi-target tick once mana
	// allowed it, even below the required level - which meant falling
	// through to plain attack() never happened in multi-target situations.
	const can5 = character.level >= (G.skills['5shot']?.level || 0) && character.mp >= (G.skills['5shot']?.mp || 0);
	const can3 = character.level >= (G.skills['3shot']?.level || 0) && character.mp >= (G.skills['3shot']?.mp || 0);
	const top5 = can5 && sortedByHP.length >= min5 ? sortedByHP.slice(0, 5) : null;
	const top3 = can3 && sortedByHP.length >= min3 ? sortedByHP.slice(0, 3) : null;

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
	} else if (is_in_range(sortedByHP[0])) {
		equipSet('single'); await use_skill('attack', sortedByHP[0]);
	}
};

// CPU FIX: same reasoning as ACTION_MIN_DELAY - the old 5ms/1ms floors here
// fired 200-1000x/sec doing real targeting work every cycle.
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
				await use_skill('huntersmark', target);
			}

			if (CONFIG.combat.useSupershot && msSuper === 0 && character.mp >= (G.skills.supershot?.mp || 0)) {
				await use_skill('supershot', target);
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

// ============================================================================
// MAINTENANCE LOOP
// ============================================================================
const maintenanceLoop = async () => {
	try {
		if (CONFIG.potions.autoBuy) autoBuyPotions();
		if (CONFIG.party.autoManage) partyMaker();
		if (CONFIG.selling.enabled) sellItems();
		if (CONFIG.upgrading.enabled) upgradeItems();
		if (CONFIG.combining.enabled) combineItems();

		if (CONFIG.muling.enabled) clearInventory();
		inventorySorter();
		elixirUsage();
		checkFarmEconomics();

		if (character.rip) {
			await respawn();
			if (CONFIG.potions.autoBuy) {
				// respawn() teleports to town - take advantage of already
				// being there rather than waiting for a future emergency
				// trip once potions actually run out.
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

// ============================================================================
// EQUIPMENT MANAGEMENT LOOP
// ============================================================================
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

	if (COMBAT_SETS.bosses.has(eventType)) {
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

// DRAGOLD SERVER HOPPING 
const dragold = {
	state: 'IDLE',
	targetShard: null,
	scanResults: [],
	hopping: false,

	startScanning() {
		if (!CONFIG.dragold.enabled) return;
		// parent.io is the socket.io-client global a real browser tab loads on
		// the page - Mainframe's sandboxed runtime doesn't have it. Without
		// this guard, the multi-server dragold scan crashes the whole script
		// on load. Degradation is graceful: dragold.tick()'s IDLE state still
		// checks localDragoldLive() and fights dragold if it spawns on
		// whichever server this character is already on - it just never
		// proactively hops to chase it on another server.
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
		game_log(`\ud83d\udc09 Hopping to ${shard} for dragold`, '#FFD700');
		this.hopping = true;
		try {
			change_server(parsed.region, parsed.name);
			// Bring the crew along - without this, FatherToken and MageofOz
			// stay behind on the old server while Dexon fights Dragold alone,
			// and heal/curse/energize range checks all go stale.
			send_cm(['FatherToken', 'MageofOz'], {
				message: 'dragold_hop',
				region: parsed.region,
				name: parsed.name
			});
			// Reset here, not just on failure - change_server() wipes runtime
			// state in an ordinary browser tab (masking this), but Mainframe
			// persists the running CODE through reconnects, so without this
			// reset 'hopping' would stay true forever after the first
			// successful hop, permanently blocking mainLoop via tick()'s
			// "if (this.hopping) return 'block'" check.
			this.hopping = false;
			return true;
		} catch (e) {
			game_log(`dragold: server change failed \u2014 ${e}`, 'red');
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
					game_log('\ud83d\udc09 Dragold live here \u2014 entering FIGHTING', '#FFD700');
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
						game_log('\ud83d\udc09 Arrived \u2014 dragold is live, FIGHTING', '#FFD700');
						return 'continue';
					}
					game_log('\ud83d\udc09 Arrived but dragold not live here \u2014 back to IDLE', '#FFD700');
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
				game_log('\ud83d\udc09 Dragold dead \u2014 RETURNING home', '#FFD700');
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
					game_log(`\ud83d\udc09 New live dragold on ${liveShard} \u2014 diverting`, '#FFD700');
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

function handleReturnHome() {
	if (!destination) return; // farm spot search hasn't completed yet
	if (distance(character, destination) < 20) return;

	if (!smart.moving) {
		smart_move(destination);
	}
}

async function walkInCircle() {
	if (smart.moving || !destination) return;
	const center = destination, r = CONFIG.movement.circleRadius, now = performance.now();
	const dt = Math.min((now - state.lastAngleUpdate) / 1000, 0.5);
	state.lastAngleUpdate = now;
	state.angle = (state.angle + (character.speed / r) * dt) % (2 * Math.PI);
	if (!character.moving) await xmove(center.x + Math.cos(state.angle) * r, center.y + Math.sin(state.angle) * r);
}

async function rangedKite() {
	const cfg = CONFIG.movement.rangedKiting;
	if (!cfg.enabled || smart.moving) return false;
	const target = get_nearest_monster_v2({ type: cfg.targets, max_distance: cfg.maxKiteRange });
	if (!target) return false;

	const cx = character.real_x, cy = character.real_y;
	const dist = Math.hypot(target.real_x - cx, target.real_y - cy);

	let reason = 0, need = 0; // need = how far we actually want to move, capped below
	if (dist < cfg.minDistance) { reason = 1; need = cfg.optimalDistance - dist; }
	else if (dist > cfg.maxDistance) { reason = 2; need = dist - cfg.optimalDistance; }
	else if (Math.abs(dist - cfg.optimalDistance) > cfg.repositionThreshold) { reason = 3; need = Math.abs(dist - cfg.optimalDistance); }
	if (!reason) return true;

	const now = performance.now();
	if (now - rangedKite.lastMove <= cfg.moveThrottle) return true;

	const mag = Math.min(cfg.moveDistance, need); // <- the actual fix: don't step further than needed
	const step = Math.PI / cfg.sampleAngles, n = cfg.sampleAngles * 2;
	let bestW = -Infinity, bestX = 0, bestY = 0, found = false;
	for (let i = 0, a = 0; i < n; i++, a += step) {
		const tx = cx + mag * Math.cos(a), ty = cy + mag * Math.sin(a);
		if (!can_move_to(tx, ty)) continue;
		const nd = Math.hypot(target.real_x - tx, target.real_y - ty);
		let w = reason === 1 ? nd - dist : reason === 2 ? dist - nd
			: Math.abs(dist - cfg.optimalDistance) - Math.abs(nd - cfg.optimalDistance);
		if (nd < cfg.minDistance || nd > cfg.maxDistance) w -= 1000;
		if (w > bestW) { bestW = w; bestX = tx; bestY = ty; found = true; }
	}
	if (!found) return true;

	await xmove(bestX, bestY);
	rangedKite.lastMove = now;
	if (cfg.debug) game_log(`Kiting: ${reason} (${Math.round(dist)} \u2192 ${Math.round(Math.hypot(target.real_x - bestX, target.real_y - bestY))})`, '#FFA500');
	return true;
}
rangedKite.lastMove = 0;

// ============================================================================
// TEMPORAL SURGE COORDINATION
// ============================================================================
function getTemporalRotation() {
	// get()/set() are the game's own storage functions - unlike localStorage
	// (a browser-only Web API), these work identically in a real browser tab
	// and on Mainframe's sandboxed runtime. Already proven safe elsewhere in
	// this file for chest storage.
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
		game_log(`\u23f0 Temporal Surge used on ${CONFIG.equipment.temporal.targetMob}!`, '#00FFFF');
		updateTemporalRotation();
		equip(orbSlot, 'orb');
	} catch (e) {
		game_log(`Temporal surge failed: ${e}`, 'red');
		console.error('Temporal surge error:', e);
	}
}

// ============================================================================
// LOOTING
// ============================================================================
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

	try {
		const chestMap = loadChestMap();
		const now = performance.now();
		let looted = 0;

		for (const id of Object.keys(chestMap)) {
			const storedAt = chestMap[id];
			if (!storedAt) continue;
			if (now - storedAt < CONFIG.looting.delayMs) continue;
			await loot(id);
			removeChestId(id);
			looted++;
		}

		if (looted > 0) {
			console.log(`Looted ${looted} chest(s)`);
		}
	} catch (err) {
		console.error('Looting error:', err);
	}
}

function lootInterval() {
	updateChestsInStorage();
	handleLooting();
}
setInterval(lootInterval, 250);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
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

const inventorySorter = () => {
	const slots = { tracktrix: 0, ancientcomputer: 1, hpot1: 2, mpot1: 3, xptome: 4, pumpkinspice: 5, xpbooster: 6 };
	character.items.forEach((item, i) => {
		const target = slots[item?.name];
		if (target !== undefined && i !== target) swap(i, target);
	});
};

function autoBuyPotions() {
	if (quantity('hpot1') < CONFIG.potions.minStock) buy('hpot1', CONFIG.potions.minStock);
	if (quantity('mpot1') < CONFIG.potions.minStock) buy('mpot1', CONFIG.potions.minStock);

	const totalHp = quantity('hpot0') + quantity('hpot1');
	const totalMp = quantity('mpot0') + quantity('mpot1');
	if (totalHp < 500) send_cm('Meltymerch', { message: 'low_potions', potion: 'hp', quantity: totalHp, x: character.x, y: character.y, map: character.map });
	if (totalMp < 500) send_cm('Meltymerch', { message: 'low_potions', potion: 'mp', quantity: totalMp, x: character.x, y: character.y, map: character.map });
}

// Shared by both the emergency restock (below) and the post-respawn top-up
// in maintenanceLoop - buys back up to minStock, not just enough to clear
// the zero-potion condition, so the trip actually lasts a while.
async function buyMissingPotions() {
	if (quantity('hpot0') + quantity('hpot1') < CONFIG.potions.minStock) {
		try { await buy('hpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy hpot1 failed:', e); }
	}
	if (quantity('mpot0') + quantity('mpot1') < CONFIG.potions.minStock) {
		try { await buy('mpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy mpot1 failed:', e); }
	}
}

// Self-sufficiency fallback: don't just wait on Meltymerch forever if HP or
// MP potions hit zero outright - go buy more directly. Once this returns,
// mainLoop's own existing handleReturnHome()/walkInCircle() logic naturally
// walks back to the farm spot on the next tick, so no explicit "return"
// step is needed here.
async function checkPotionEmergency() {
	if (!CONFIG.potions.autoBuy) return false;
	if (state.restocking) return true; // shouldn't normally happen (this call blocks until done), but guard anyway

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
	const required = 'pumpkinspice';
	const currentElixir = character.slots.elixir?.name;

	if (currentElixir !== required) {
		const slot = locate_item(required);
		if (slot !== -1) use(slot);
	}
}

const targetStartTimes = new Map();

const scare = () => {
	const slot = character.items.findIndex(i => i?.name === 'jacko');
	const now = performance.now();
	let shouldScare = false;

	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e.type === 'monster' && e.target === character.name && e.mtype !== 'grinch') {
			let t = targetStartTimes.get(id);
			if (t === undefined) targetStartTimes.set(id, t = now);
			if (now - t > 250) shouldScare = true;
		} else if (targetStartTimes.has(id)) {
			targetStartTimes.delete(id);
		}
	}

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
// CHARACTER STARTER
// ============================================================================
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

// ============================================================================
// LOCATION BROADCASTER
// ============================================================================
async function sendLocationUpdate() {
	if (!CONFIG.locationBroadcast.enabled) return;

	try {
		const needsUpdate = !character.s.mluck || character.s.mluck.f !== CONFIG.locationBroadcast.targetPlayer;
		const nullCount = character.items.filter(item => item === null).length;

		if (needsUpdate || nullCount <= CONFIG.locationBroadcast.lowInventorySlots) {
			send_cm(CONFIG.locationBroadcast.targetPlayer, {
				message: 'location',
				x: character.x,
				y: character.y,
				map: character.map
			});
		}

		// Distinct alert (separate from the general 'location' message above,
		// which already fires on the same low-slot condition) so the merchant
		// can tell "come find me" apart from "come find me, I'm almost full."
		if (nullCount <= CONFIG.locationBroadcast.lowInventorySlots) {
			send_cm(CONFIG.locationBroadcast.targetPlayer, {
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

// ============================================================================
// SELLING
// ============================================================================
const SELL_WHITELIST = new Set(CONFIG.selling.whitelist);
function sellItems() {
	if (!CONFIG.selling.enabled) return;
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && SELL_WHITELIST.has(item.name) && item.p === undefined && item.l !== 'l') sell(i);
	}
}

// ============================================================================
// UPGRADING
// ============================================================================
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

// ============================================================================
// COMBINING
// ============================================================================
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

// ============================================================================
// UI FUNCTIONS
// ============================================================================
function pingButton() {
	// character.ping is apparently not populated in Mainframe's environment
	// (undefined there, unlike a real browser tab) - without this fallback,
	// this throws every second forever since it's on a setInterval.
	add_top_button('Ping', (character.ping ?? 0).toFixed(0));
}
setInterval(pingButton, 1000);

function topButtons() {
	if (parent.S.lunarnewyear) {
		add_top_button('ShowDragold', '\ud83d\udc09', () => {
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
		send_cm(['FatherToken', 'MageofOz'], {
			message: 'location',
			x: character.x,
			y: character.y,
			map: character.map
		});
	});

	add_top_button('showLoot', '\ud83d\udcbc', displayLoot);

	add_top_button('Pause2', '\u23f8\ufe0f', () => {
		pause();
		CONFIG.characterStarter.enabled = true
	});

	add_top_button('Stop', '\ud83d\udd04', () => {
		stop_character('Meltymerch');
		CONFIG.characterStarter.enabled = false
	});
}
topButtons();
function displayLoot() {
	const savedLoot = get('lootItems' + new Date().toLocaleString('en', { month: 'long' })) || {};
	const sortedLoot = Object.fromEntries(Object.keys(savedLoot).sort().map(k => [k, savedLoot[k]]));
	console.log("Saved Loot (Sorted):", sortedLoot);
	show_json(sortedLoot);
}

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
// SKIN CHANGER - removed per request (2026-09-17). Used to force-equip a
// cosmetic skinRing, wait for character.skin to match, then swap back to
// the normal ring - purely cosmetic, no gameplay effect, and it was
// spamming "Applying skinRing"/"Skin never applied" into the CODE log on
// every reconnect. state.skinReady only ever gated other logic on this
// process finishing, so it's set true immediately instead.
// ============================================================================
state.skinReady = true;

// ============================================================================
// DYNAMIC FARM SPOT OPTIMIZER - live search across every map/monster type,
// ranked by death-adjusted XP/sec for the whole party, with a safety floor
// and map filtering (no PVP, no instances).
//
// Known limitations:
// - Gold-per-kill has no exposed formula - the gold-vs-potion check is a
//   rough approximation, corrected later by checkFarmEconomics().
// - Survivability modeling is a heuristic (no evasion/crit/kiting/positioning).
// - FatherToken's heal throughput assumes his base tier, not his real level
//   (not visible to Dexon) - deliberately conservative.
// ============================================================================
const FARM_SEARCH = {
	reevaluateIntervalMs: 15 * 60 * 1000, // re-run the full search every 15 minutes
	mitigationConstant: 900, // 100 armor/resistance \u2248 10% reduction, per the stats guide - NOT the 2500 some references use
	avgDeathDowntimeSec: 45, // rough respawn + travel-back estimate per death
	minUptimeFraction: 0.5, // hard floor - exclude anything worse than this, don't just penalize it
	maxConcurrentAttackers: 4, // cap on how many of a spawn can plausibly be hitting the party at once
	goldToXpRatioGuess: 0.05, // UNVERIFIED first-pass approximation only - no gold formula is exposed in game data
	minGoldMarginRatio: 1.2, // require estimated gold income to clear potion cost by this margin
	maxViableHp: 50000000, // filters out absurd world-boss-tier HP pools that aren't real farm targets
	xpLossPerDeathFraction: 0.03, // UNVERIFIED rough guess - AL's exact per-death xp penalty isn't exposed in game data either; assumed proportional to the level's total xp requirement (parent.G.levels[level]) so higher-level deaths are modeled as costing more in absolute terms, matching observed behavior
};

const partyDpsReports = {
	FatherToken: { type: 'magical', dps: 0, maxHp: 0, level: 0, receivedAt: 0 },
	MageofOz: { type: 'magical', dps: 0, maxHp: 0, level: 0, receivedAt: 0 },
};

const economicsTracker = {
	lastGold: character.gold,
	lastCheckTime: Date.now(),
};

// ============================================================================
// FARM SPOT ARRIVAL TRACKING - the economics sampling clock must not start
// until Dexon has actually ARRIVED, or the window measures travel time
// instead of farming. If arrival never happens (e.g. a stalled smart_move),
// blacklist the spot as unreachable after a timeout rather than waiting forever.
// ============================================================================
const ARRIVAL_RADIUS = 100; // close enough to destination to count as "at the spot" - looser than handleReturnHome()'s 20 since walkInCircle() patrols a radius around it
const UNREACHABLE_TIMEOUT_MS = 3 * 60 * 1000; // if still not there after this long, something is blocking travel, not just distance

const arrivalState = {
	assignedAt: null,
	reachedAt: null,
	reported: false,
};

function hasReachedFarmSpot() {
	if (!destination || character.map !== mobMap) return false;
	return distance(character, destination) < ARRIVAL_RADIUS;
}

// ============================================================================
// FARM SPOT BLACKLIST - persisted via get()/set(). A spot lands here when
// FatherToken or MageofOz reports sustained net-negative xp/hour there (a
// real, observed problem, not the pre-emptive safety filtering
// scoreAllFarmSpots() already does). No auto-expiry - stays blacklisted
// until removeFromBlacklist() is called explicitly.
// ============================================================================
const BLACKLIST_STORAGE_KEY = 'farm_spot_blacklist';

function spotKey(home, mobMap) {
	return `${home}@${mobMap}`;
}

function getBlacklist() {
	return get(BLACKLIST_STORAGE_KEY) || {};
}

function addToBlacklist(home, mobMap, reason, reportedBy) {
	const blacklist = getBlacklist();
	const key = spotKey(home, mobMap);
	blacklist[key] = { reason, reportedBy, blacklistedAt: Date.now() };
	set(BLACKLIST_STORAGE_KEY, blacklist);
	return key;
}

// Exposed globally (not just internal) so it can be called directly via
// code eval - e.g. removeFromBlacklist('cgoo@level2s') - per the explicit
// request to be able to manually un-blacklist a spot later.
function removeFromBlacklist(key) {
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

function listBlacklist() {
	const blacklist = getBlacklist();
	show_json(blacklist);
	return blacklist;
}

function myOwnDps() {
	return (character.attack || 0) * (character.frequency || 0);
}

function getPartyDps() {
	let physical = myOwnDps(); // Dexon - ranger, physical damage
	let magical = 0;
	for (const name in partyDpsReports) {
		const r = partyDpsReports[name];
		if (r.type === 'physical') physical += r.dps;
		else magical += r.dps;
	}
	return { physical, magical };
}

function mitigated(dps, defenseStat) {
	return dps * (1 - (defenseStat / (defenseStat + FARM_SEARCH.mitigationConstant)));
}

function isMapSafeForFarming(mapData) {
	if (!mapData) return false;
	if (mapData.pvp) return false;
	if (mapData.instance) return false;
	return true;
}

function estimateHealThroughput() {
	// FatherToken's partyheal, base tier (level 0-59): output 400, cooldown 200ms.
	// Conservative on purpose - his real level isn't visible to Dexon, and
	// underestimating heal throughput makes the safety floor stricter, not
	// looser.
	return 400 / 0.2; // ~2000 hp/sec ceiling, MP-limited in practice
}

// Everyone Dexon has enough data on to check individually - himself
// (known directly) plus any party member who's sent at least one
// dps_report carrying maxHp/level. Meltymerch isn't included here since
// he doesn't fight and reports nothing.
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
	const partyEffectiveHp = 3 * (character.max_hp || 2000); // rough - only Dexon's own max_hp is precisely known here
	const blacklist = getBlacklist(); // fetched once per search, not per-spot, to avoid repeated storage reads in the loop below

	const candidates = [];

	for (const mapName in parent.G.maps) {
		const mapData = parent.G.maps[mapName];
		if (!isMapSafeForFarming(mapData) || !mapData.monsters) continue;

		for (const spot of mapData.monsters) {
			const mobData = parent.G.monsters[spot.type];
			if (!mobData || !mobData.hp || !mobData.xp) continue;
			if (mobData.hp > FARM_SEARCH.maxViableHp) continue;
			if (blacklist[spotKey(spot.type, mapName)]) continue; // reported net-negative xp/hr by a party member - stays excluded until manually removed

			// Physical portion of party DPS mitigated by armor, magical
			// portion mitigated by resistance - not a single blended number.
			const effPhysical = mitigated(dps.physical, mobData.armor || 0);
			const effMagical = mitigated(dps.magical, mobData.resistance || 0);
			const totalEffDps = Math.max(effPhysical + effMagical, 1);

			const ttk = mobData.hp / totalEffDps;
			const rawKillRate = 1 / ttk;
			const respawn = mobData.respawn || 1;
			const sustainableKillRate = spot.count / respawn; // can't out-farm the respawn timer
			const actualKillRate = Math.min(rawKillRate, sustainableKillRate);
			const rawExpPerSecond = actualKillRate * mobData.xp;

			// Survivability: worst-case concurrent attackers vs FatherToken's
			// heal throughput, converted into expected downtime from deaths.
			const attackers = Math.min(spot.count, FARM_SEARCH.maxConcurrentAttackers);
			// aggro is the chance a monster proactively attacks an idle
			// player - it has nothing to do with damage output once a mob
			// is already engaged, which is exactly the case here (the
			// party parks and fights). Multiplying incoming damage by it
			// was underselling real danger by up to 10x on low-aggro mobs
			// (e.g. cgoo at 0.1), which is why "100% uptime" spots were
			// producing repeated real deaths.
			const incomingDps = (mobData.attack || 0) * (mobData.frequency || 1) * attackers;
			const survivabilityMargin = healThroughput - incomingDps;

			let uptimeFraction = 1;
			if (survivabilityMargin < 0) {
				const timeToDeathSec = partyEffectiveHp / Math.abs(survivabilityMargin);
				const deathsPerHour = 3600 / timeToDeathSec;
				const downtimePerHour = deathsPerHour * FARM_SEARCH.avgDeathDowntimeSec;
				uptimeFraction = Math.max(0, (3600 - downtimePerHour) / 3600);
			}
			if (uptimeFraction < FARM_SEARCH.minUptimeFraction) continue; // hard exclude, not just penalize

			// Per-character check: the party-wide uptimeFraction above uses
			// a single blended effective-HP proxy (3x Dexon's own max_hp),
			// which can hide a squishier character (lower max_hp) still
			// coming out net-negative on xp even when the party average
			// looks fine - exactly the pattern observed with MageofOz
			// dying repeatedly while the party-level "100% uptime" read
			// looked safe. Worst case, mobs don't split damage evenly -
			// they commit to whoever they're targeting - so any one
			// character could end up eating the full incomingDps alone.
			// Require every character Dexon has stats for to have a
			// strictly positive expected net xp/sec (gains minus expected
			// xp lost to death) at this spot, not just the party average.
			let allMembersNetPositive = true;
			for (const member of getTrackedPartyMembers()) {
				const memberMargin = healThroughput - incomingDps;
				if (memberMargin >= 0) continue; // this character wouldn't be dying here at all - net positive by construction
				const memberTimeToDeathSec = member.maxHp / Math.abs(memberMargin);
				const memberDeathsPerHour = 3600 / memberTimeToDeathSec;
				const xpToNextLevel = parent.G.levels?.[member.level] || 0;
				const xpLossPerDeath = xpToNextLevel * FARM_SEARCH.xpLossPerDeathFraction;
				const memberUptimeFraction = Math.max(0, (3600 - memberDeathsPerHour * FARM_SEARCH.avgDeathDowntimeSec) / 3600);
				const memberNetXpPerSecond = (rawExpPerSecond * memberUptimeFraction) - (memberDeathsPerHour * xpLossPerDeath / 3600);
				if (memberNetXpPerSecond <= 0) { allMembersNetPositive = false; break; }
			}
			if (!allMembersNetPositive) continue; // hard exclude - at least one tracked party member would net-lose xp here

			const adjustedExpPerSecond = rawExpPerSecond * uptimeFraction;

			// Gold vs. potion cost - rough estimate only, see header note.
			const estGoldPerSecond = adjustedExpPerSecond * FARM_SEARCH.goldToXpRatioGuess;
			const estPotionCostPerSecond = incomingDps > 0 ? incomingDps * 0.002 : 0.5;
			if (estGoldPerSecond < estPotionCostPerSecond * FARM_SEARCH.minGoldMarginRatio) continue;

			// Some spawn entries (full-map roamers, apparently) have no
			// boundary box at all - destructuring undefined here was
			// throwing and aborting the ENTIRE search on every single
			// call, which is why home/mobMap/destination never got set
			// this whole session. Skip entries without a usable boundary
			// rather than crash on them.
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
	return candidates;
}

function findBestFarmSpot() {
	const candidates = scoreAllFarmSpots();
	return candidates.length ? candidates[0] : null;
}

let manualOverride = null; // set by clicking a mob button in the farm-spot UI; null = automatic
let lastCandidates = []; // most recent scored list, used to populate/refresh the UI

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
		destination = { map: result.mobMap, x: result.x, y: result.y };
		if (changed) {
			const tag = manualOverride ? '(manual override)' : '(auto)';
			game_log(
				`Farm spot ${tag}: ${home} @ ${mobMap} (~${result.expPerSecond.toFixed(1)} xp/s, ${(result.uptimeFraction * 100).toFixed(0)}% uptime)`,
				'#00FF00'
			);
			arrivalState.assignedAt = Date.now();
			arrivalState.reachedAt = null;
			arrivalState.reported = false;
		}
		sendFarmSpot();
		updateFarmUI();
	} catch (e) {
		console.error('runFarmSearch error:', e);
	}
}

// Empirical correction: gold-per-kill isn't in game data, so watch real
// gold income once farming and re-run the search if a spot is a net loss.
// Requires 3 consecutive bad samples (~3 min) before re-evaluating, not one
// - gold income is bursty, and a single-sample trigger previously caused
// the farm spot to flap between locations every minute, dragging followers
// through unproductive spots too. The sampling clock doesn't start until
// Dexon has actually arrived (see hasReachedFarmSpot()) - otherwise the
// first window(s) measure travel time and can falsely blacklist a spot
// that never got a fair trial. If arrival never happens at all within
// UNREACHABLE_TIMEOUT_MS, the spot is blacklisted as unreachable instead.
function checkFarmEconomics() {
	if (!home || !mobMap) return; // nothing assigned yet

	if (!hasReachedFarmSpot()) {
		// Hold the sampling clock at "now" so the first real window starts
		// clean once we arrive, rather than measuring travel time.
		economicsTracker.lastGold = character.gold;
		economicsTracker.lastCheckTime = Date.now();
		economicsTracker.consecutiveBadSamples = 0;

		if (!arrivalState.reported && arrivalState.assignedAt &&
			Date.now() - arrivalState.assignedAt > UNREACHABLE_TIMEOUT_MS) {
			arrivalState.reported = true;
			const stuckSec = Math.round((Date.now() - arrivalState.assignedAt) / 1000);
			game_log(`Still haven't reached ${home}@${mobMap} after ${stuckSec}s - blacklisting as unreachable`, 'red');
			addToBlacklist(home, mobMap, `Dexon couldn't reach this spot (stuck ${stuckSec}s without arriving)`, 'Dexon');
			runFarmSearch();
		}
		return;
	}

	if (arrivalState.reachedAt === null) {
		// Just arrived - start the window fresh from this exact moment.
		arrivalState.reachedAt = Date.now();
		economicsTracker.lastGold = character.gold;
		economicsTracker.lastCheckTime = Date.now();
		economicsTracker.consecutiveBadSamples = 0;
		return;
	}

	const now = Date.now();
	const elapsedSec = (now - economicsTracker.lastCheckTime) / 1000;
	if (elapsedSec < 60) return; // sample roughly once a minute

	const goldGained = character.gold - economicsTracker.lastGold;
	const goldPerSecond = goldGained / elapsedSec;

	if (goldPerSecond <= 0) {
		economicsTracker.consecutiveBadSamples = (economicsTracker.consecutiveBadSamples || 0) + 1;
		if (economicsTracker.consecutiveBadSamples >= 3) {
			game_log(`Current farm spot shows no net gold gain for ${economicsTracker.consecutiveBadSamples} consecutive minutes - re-evaluating`, 'red');
			runFarmSearch();
			economicsTracker.consecutiveBadSamples = 0; // reset so the newly-picked spot gets its own fair trial
		}
	} else {
		economicsTracker.consecutiveBadSamples = 0; // one good sample clears the streak
	}

	economicsTracker.lastGold = character.gold;
	economicsTracker.lastCheckTime = now;
}

// Give FatherToken/MageofOz's DPS reports a few seconds to arrive before
// the very first search, then re-run periodically.
setTimeout(runFarmSearch, 8000);
setInterval(runFarmSearch, FARM_SEARCH.reevaluateIntervalMs);

// ============================================================================
// FARM SPOT OVERRIDE UI - browser-only. Mainframe doesn't render DOM/button
// output, so this deliberately no-ops there rather than erroring - only
// useful when running this character's CODE tab in an actual browser.
// ============================================================================
function initializeFarmUI() {
	if (character.name !== 'Dexon') return;
	if (!parent.$) return; // no jQuery/DOM available - not running in a browser (e.g. Mainframe)
	const $ = parent.$;
	if ($('#farm-spot-ui').length > 0) return;

	const uiHtml = `
		<div id="farm-spot-ui" style="position: fixed; top: 15px; left: 50%; transform: translateX(-50%); width: 1000px; min-width: 400px; min-height: 60px; background: rgba(0, 0, 0, 0.9); color: #fff; border-radius: 6px; font-family: monospace; font-size: 11px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); box-sizing: border-box; user-select: none; resize: both; overflow: auto;">
			<div id="farm-spot-header" style="padding: 6px 12px; background: rgba(30, 30, 30, 0.95); border-top-left-radius: 6px; border-top-right-radius: 6px; cursor: move; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #555;">
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

	if ($('#bottomrightcorner').length > 0) {
		$('#bottomrightcorner').children().first().after(uiHtml);
	} else {
		$('body').append(uiHtml);
	}

	let isDragging = false;
	let startX, startY;

	$(document).off("mousedown", "#farm-spot-header").on("mousedown", "#farm-spot-header", function (e) {
		if ($(e.target).is("button")) return;
		isDragging = true;
		startX = e.clientX - $("#farm-spot-ui").offset().left;
		startY = e.clientY - $("#farm-spot-ui").offset().top;
		$("#farm-spot-ui").css("transform", "none");
		e.preventDefault();
	});

	$(document).off("mousemove", document).on("mousemove", function (e) {
		if (!isDragging) return;
		const newX = e.clientX - startX;
		const newY = e.clientY - startY;
		$("#farm-spot-ui").css({ left: newX + "px", top: newY + "px", bottom: "auto" });
	});

	$(document).off("mouseup", document).on("mouseup", function () { isDragging = false; });

	let isExpanded = true;
	$(document).off("click", "#ui-toggle-expand").on("click", "#ui-toggle-expand", function () {
		isExpanded = !isExpanded;
		if (isExpanded) {
			$("#farm-spot-body").css("display", "flex");
			$(this).text("_");
		} else {
			$("#farm-spot-body").css("display", "none");
			$(this).text("+");
		}
	});

	$(document).off("click", "#ui-reset-override").on("click", "#ui-reset-override", function () {
		manualOverride = null;
		runFarmSearch();
	});

	$(document).off("click", ".farm-spot-row").on("click", ".farm-spot-row", function () {
		const idx = $(this).data("idx");
		const candidate = lastCandidates[idx];
		if (!candidate) return;
		if (manualOverride && manualOverride.home === candidate.home && manualOverride.mobMap === candidate.mobMap) {
			manualOverride = null; // clicking the active selection again returns to Auto
		} else {
			manualOverride = candidate;
		}
		runFarmSearch();
	});

	updateFarmUI();
}

function updateFarmUI() {
	if (character.name !== 'Dexon') return;
	if (!parent.$) return;
	if (lastCandidates.length === 0) lastCandidates = scoreAllFarmSpots(); // populate immediately if opened before the first scheduled search
	const $ = parent.$;
	const $list = $('#ui-mob-list');
	if ($list.length === 0) return; // UI not initialized (or not in a browser)

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

function on_cm(name, data) {
	if (data.message === 'dps_report' && partyDpsReports[name]) {
		partyDpsReports[name] = { type: data.damageType, dps: data.dps, maxHp: data.maxHp, level: data.level, receivedAt: Date.now() };
		return;
	}

	if ((name === 'FatherToken' || name === 'MageofOz') && data.message === 'blacklist_spot') {
		const key = addToBlacklist(data.home, data.mobMap, data.reason, name);
		game_log(`Blacklisted "${key}" - ${data.reason} (reported by ${name})`, 'red');
		if (manualOverride && spotKey(manualOverride.home, manualOverride.mobMap) === key) {
			manualOverride = null; // don't keep forcing a spot that's now known to be hurting someone
			game_log(`Cleared manual override - it pointed at the spot just blacklisted`, 'orange');
		}
		runFarmSearch(); // don't wait for the next scheduled re-evaluation - move off it now
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
	// This action refreshes a UI panel in a real browser tab and is rejected
	// outright on Mainframe ("Action send_updates is unavailable") - not
	// harmful, but spams the log every 20s for no benefit there.
	if (!parent.$) return;
	parent.socket.emit('send_updates', {});
}
setInterval(sendUpdates, 20000);

// ============================================================================
// FARM SPOT BROADCAST - tells FatherToken and MageofOz where to farm, so
// they don't need home/mobMap hardcoded themselves. Sent at startup and
// periodically, so a follower already running (or started later) picks up
// changes made here without needing its own restart.
// ============================================================================
function sendFarmSpot() {
	if (!home || !mobMap || !destination) return; // nothing decided yet
	send_cm(['FatherToken', 'MageofOz'], {
		message: 'farm_spot',
		home,
		mobMap,
		x: destination.x,
		y: destination.y,
	});
}
setInterval(sendFarmSpot, 5000);

// ============================================================================
// START ALL LOOPS
// ============================================================================
mainLoop();
actionLoop();
skillLoop();
equipmentLoop();
dragold.startScanning();
maintenanceLoop();
potionLoop();
sendFarmSpot();
initializeFarmUI();
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
