// ============================================================================
// Dexon (Ranger) - Mainframe slot CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB - v57 (The inventory sorter is gone. It pinned tracker/ancientcomputer/hpot1/mpot1/xptome/pumpkinspice/xpbooster to slots 0-6 from maintenanceLoop, which runs every TICK_RATE.maintenance = 2000ms, and swap() is an EXCHANGE - so it did not merely hold those items in place, it evicted whatever the operator dragged into one of those slots. Measured 2026-09-26: forcing the tracker from slot 0 to slot 8 landed at +500ms and was reverted by +1000ms, which is why manual dragging had become impossible rather than merely awkward. It only started biting today, because v56 fixed the dead 'tracktrix' spelling to 'tracker' AND a tracker was acquired the same hour, so slot 0 was defended for the first time ever. Nothing depends on the slots it was maintaining: there is not one numeric index into character.items anywhere in this file, every lookup is by name, and MageofOz has run without a sorter the whole time. The potion path is unaffected in practice - use_skill('use_hp') resolves to use('hp'), which scans items from the LAST slot BACKWARDS and drinks the first gives match, and measured the same day the only hp/mp-giving items in the bag are hpot1 and mpot1 themselves, so there is nothing to mis-pick. Note the pins were the WORSE arrangement for that scan: slots 2 and 3 are scanned last, so a second hp/mp consumable would have taken priority over the potions, not the other way round. The tracker is still safe without the pin - neverSell and muling.excludeItems protect it, which is what v56 was actually for. Slot order is now the operator's to arrange by hand.) v56 (Tracktrix is now actually protected, which it was not before. The item's NAME is tracker - Tracktrix is only its display label, G.items.tracker.name - and there is no tracktrix key in G.items at all. Measured 2026-09-25. So the 'tracktrix' string that had been sitting in inventoryRelief.neverSell could never match item.name and protected nothing, and the same typo in inventorySorter's slot map meant the item was never pinned to slot 0 either. Priest.js already spelled it correctly as tracker: 0, and that disagreement between the two files is what the typo was hiding behind. This was not theoretical: reliefSellable() sorts candidates by NPC value ASCENDING and sells the cheapest first, and a tracker vendors for SEVEN GOLD - it would have been the first thing off the pack the next time the bag filled with no mule in reach. It was also missing from muling.excludeItems in every spelling, so clearInventory() was handing it to Meltymerch on sight. Protected now on the same footing as tier-1 potions: not sold, not muled, pinned to slot 0. It is the item that records achievements for bonus stats, so its value is in holding it, never in what it fetches.) v55 (Giga Crab is now joined, and his contribution is logged for later review. Three parts. (1) getDynamicEvents() injects crabxx when parent.S.crabxx.live, with join: true - G.events.crabxx carries join: true and duration 2400 as a daily, so arrival is an event join rather than a walk, and handleEvents() already emits the join for any entry with that flag. There is no static monster pack for crabxx, so the smart_move G.monsters fallback would have found nothing and silently done nothing. (2) shouldAttackMob ignores crabx while crabxx is live. Measured 2026-09-25: a crabx hits for 189 after mitigation against a 4,621 HP pool - 24 hits - and the boss spawns 1,000 of them, so volume is what kills a ranger here. The boss itself hits for 12,572, 2.7x the whole pool, so there is no posture in which he trades with it; he stands outside its 45 range with his 160 and contributes damage, which is what cooperative credit pays on. ignoreAddsDuringCrabxx turns this off. (3) A contribution log in CODE storage, so it survives the change_server reload exactly as the chest map now does. Damage comes from the game's own hit events filtered to our own id against a crabxx target, not inferred from attack calls, so only landed hits count. Writes are batched to one per 10s rather than one per hit. Query it any day with crabxxReport(). Left deliberately unanswered for now: whether to generalise the dragold cross-shard hunter to this boss. At ~491 effective DPS into 960,000 HP behind armor 320 and phresistance 30, and with other players finishing it well inside the 40-minute window, the value of hopping depends on damage actually landed - which is the number this log exists to produce.) v54 (Chest looting was stalled, not slow. updateChestsInStorage() stamped every chest with performance.now(), which is measured from PAGE LOAD and resets to ~0 on every reload, while the chest map persists in CODE storage. So after any hop or redeploy each stored chest carried a stamp from the previous session's clock, now - storedAt went NEGATIVE, the < delay test passed, and the entry was skipped forever - and never removed either, since removal only happened after a successful loot. Measured 2026-09-25 on Dexon: 9,342 of 9,465 stored chests were stamped in the future and permanently unlootable while ~5,500 chests sat within 800 units, nearest 3 units away. Now Date.now(), which survives a reload. A negative age means a stamp from another clock - legacy performance.now() values read as 1970 - and is treated as ready rather than stranded, so this class of bug cannot recur silently. Two further defects fixed in the same pass: the try wrapped the WHOLE loop, so one loot() throw aborted every remaining chest and left the offender at the head of the map for the next pass to abort on again; and removeChestId() re-read and re-wrote the entire map per chest, O(n) each and O(n^2) across a backlog this size, which would wedge the tab during a drain. Removals are now batched into one write per pass, and maxPerPass bounds the drain rate. Looting costs no exp: loot is not a skill, shares no cooldown with attack, and runs on its own interval. Ranger: delayMs 180000 unchanged; added maxPerPass.) v53 (Tier-0 potions are no longer protected. Measured 2026-09-25: the fleet holds zero hpot0 and zero mpot0 - all four characters and all three bank packs - and nothing acquires them, since every buy path is hpot1/mpot1 only. The 3,354 hpot0 that had piled up on FatherToken were cleared manually. Protection was never what kept tier 0 in use anyway: use_skill('use_hp'/'use_mp') resolves to use('hp'/'mp'), which scans character.items from the LAST slot BACKWARDS (adventureland_mongodb js/functions.js:4593) and drinks the first item whose gives matches, so tier is never consulted - slot position alone decides. That is why the priest's pile sat undrinkable at slot 0 underneath hpot1 at slot 2, and why unprotecting tier 0 on its own would have muled and vendored it rather than drawn it down. The stock COUNTS deliberately still read hpot0+hpot1 and mpot0+mpot1, so a stray tier-0 stack cannot mask an empty tier-1 bag and suppress a restock. Removed from inventoryRelief.neverSell and muling.excludeItems.) v52 (Farm scoring now uses the game's own armor curve. mitigated() applied 1-x/(x+900), an approximation that tracks parent.damage_multiplier closely near armor 100 but diverges badly above 400: at defense 900 it returned x0.500 where the game returns x0.313, overestimating our damage by 60%. 13 of the 86 monsters this scorer ranks sit above 400, so the tankiest mobs were systematically over-ranked - mrgreen at defense 900 drops 12% and the armor-900 dummy 37%. damage_multiplier is typeof-guarded rather than assumed, and its null return for an undefined argument is rejected; the old curve stays as a fallback that logs once, so a missing helper cannot masquerade as a correct estimate. No top-10 spot changes today - the top spots are defense 0 - but the error grows as party DPS rises and high-defense mobs become viable candidates.) v51 (Loop hang guard. Every loop here is an async function that schedules its next tick only after its body resolves, so an awaited call that never settles does not slow the loop down - it ends it, permanently and silently. Throws were already handled; hangs were not. Measured 2026-09-22 on Dexon: actionLoop 0 iterations in 20s where ~1300 were due, mainLoop dead in the same window (is_disabled, called every 250ms, not called once). He stood in range of crabs casting nothing and the party earned 0 xp until the page was reloaded - which is why a reload 'fixed' it each time. setInterval work (buffs, loot, keepalives) kept running throughout, so /hub showed a live, idle character. New noHang() bounds every await that appears directly in a loop body and rejects on timeout, landing in that loop's existing catch: the tick is lost, the chain is not. Same intent as travelWatchdog. It logs, throttled - a silent guard makes 'hung' and 'idle' indistinguishable. Ranger only: handleAttack fired at mobs it could not reach. top5/top3 were sliced from sortedByHP, which is every monster on screen sorted by HP descending and NOT range-filtered, and of six branches only the last checked range. The healthiest mobs on screen are the ones still at full HP precisely because nobody can reach them, so the aoe branches shot at those. The clumped guard did not help: it proves some mob is close, then the shot goes to top3 anyway. Measured: 33 consecutive 3shot casts at crabs 683-715 units away against a range of 158, 0 xp from all 33. Now sliced from cache.targets.inRange - same list, same HP order - so every branch inherits the range check. The single-target fallback also moved from sortedByHP[0] to inRange[0]: it used to test the healthiest mob on screen and so attacked nothing at all whenever that one was out of reach.)
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
		targetPriority: ['FatherToken'],
		alwaysAttack: ['crabx', 'wabbit'],
		// See shouldAttackMob: while crabxx is live the 1,000 crabx adds are
		// ignored so the shots land on the boss instead of the swarm.
		ignoreAddsDuringCrabxx: true,
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
	},

	party: {
		autoManage: true,
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
		if (is_disabled(character)) return setTimeout(mainLoop, 250);
		// Selling junk off to make room. Same shape as waiting for the merchant:
		// stand down until it finishes, and it always finishes.
		if (state.sellingOff) return setTimeout(mainLoop, 250);
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
				await noHang(rangedKite(), 'rangedKite');
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
	const { inRange, clumped } = cache.targets;
	if (!inRange.length) return;

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

	let reason = 0, need = 0;
	if (dist < cfg.minDistance) { reason = 1; need = cfg.optimalDistance - dist; }
	else if (dist > cfg.maxDistance) { reason = 2; need = dist - cfg.optimalDistance; }
	else if (Math.abs(dist - cfg.optimalDistance) > cfg.repositionThreshold) { reason = 3; need = Math.abs(dist - cfg.optimalDistance); }
	if (!reason) return true;

	const now = performance.now();
	if (now - rangedKite.lastMove <= cfg.moveThrottle) return true;

	const mag = Math.min(cfg.moveDistance, need);
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
	if (cfg.debug) game_log(`Kiting: ${reason} (${Math.round(dist)} → ${Math.round(Math.hypot(target.real_x - bestX, target.real_y - bestY))})`, '#FFA500');
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
	if (quantity('hpot1') < CONFIG.potions.minStock) buy('hpot1', CONFIG.potions.minStock);
	if (quantity('mpot1') < CONFIG.potions.minStock) buy('mpot1', CONFIG.potions.minStock);

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
		if (gate.why !== mluckGateNote) {
			mluckGateNote = gate.why;
			game_log(`[mluck] ${gate.ok ? 'requesting' : 'not requesting'}: ${gate.why}`,
				gate.ok ? '#7FD98A' : '#8b98ab');
		}
		const needsUpdate = gate.ok
			&& (!character.s.mluck || character.s.mluck.f !== CONFIG.locationBroadcast.targetPlayer);
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
			plSend(target, {
				message: 'location',
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
	'gscorpion@desertland',
	'mrpumpkin@halloween',
	'mummy@level3',
	'ghost@halloween',
	'mummy@level4',
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
			const totalEffDps = Math.max(effPhysical + effMagical, 1);

			const ttk = mobData.hp / totalEffDps;
			const rawKillRate = 1 / ttk;
			const respawn = mobData.respawn || 1;
			const sustainableKillRate = spot.count / respawn;
			const actualKillRate = Math.min(rawKillRate, sustainableKillRate);
			const rawExpPerSecond = actualKillRate * mobData.xp;

			const attackers = Math.min(spot.count, FARM_SEARCH.maxConcurrentAttackers);
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

		if (!arrivalState.reported && travelState.failures >= TRAVEL.maxAttempts) {
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

	/* Rebuild rather than bail when a panel already exists.

	   The guard here used to be `if ($('#farm-spot-ui').length) return`, which
	   is wrong across a code redeploy: the CODE iframe restarts but the PARENT
	   document does not, so the previous build's panel is still attached to its
	   body. The new script would find it, return, and never run its own layout -
	   so a change to where the panel goes could never take effect without a full
	   page reload, and it looked like the new code had done nothing.

	   Removing first prevents duplicates just as well and relocates too. The
	   handlers below are all delegated through $(document).off().on(), so they
	   rebind cleanly rather than stacking. */
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

	if (!docked) $(document).off("mousedown", "#farm-spot-header").on("mousedown", "#farm-spot-header", function (e) {
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

function on_cm(name, data) {
	if (!plFirstTime(data && data._plid)) return;   // same message may arrive twice: in-game and relayed
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

