/* Tests/suite_trickortreat.js - the knock route in Party/Ranger.js and
   Party/Merchant.js.

   The rules every assertion here rests on were measured live on 2026-10-24
   or read from the server at upstream 16881a27 (CLAUDE.md "Trick or Treat"):
   seven doors, once per character per UTC day, fourteen per account; the
   costume counts only if WORN when the knock settles; `equip(idx)` swaps the
   bag item with the worn one in one call; `doors_left` can overstate on a
   shard that did not see the knocks, so the `trickortreat_limit` refusal is
   what stops a route.

   The stubs model exactly those behaviours and nothing more. The functions
   under test are lifted from the committed files. */

const fs = require('fs');
const path = require('path');
const { lift, world, ROOT } = require('./lift');

const text = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const DOORS = [['halloween', 331, -210], ['halloween', -228, -178], ['spookytown', -130, -60],
	['spookytown', 70, -103], ['spookytown', 217, -27], ['spookytown', -170, 180], ['spookytown', 117, 133]];
const RULES = { doors: DOORS, costumes: ['phelmet', 'gphelmet', 'horsemanpumpkin'], knocks: 14 };

const RANGER_FNS = ['totLog', 'totG', 'totRules', 'totUtcDay', 'totSeasonOpen', 'totRemainingDoors',
	'totBossSoon', 'totBlocked', 'totCostumeIdx', 'totWearing', 'totKnock', 'totCostumeOn',
	'totCostumeOff', 'totWalk', 'totRoute', 'totStatus', 'BOSS_RANK', 'bossRank'];
const MERCHANT_FNS = ['totLog', 'totRules', 'totUtcDay', 'totSeasonOpen', 'totRemainingDoors',
	'totArbClear', 'totBlocked', 'totKnock', 'totNear', 'totRoute', 'totStatus'];

/* `let x = <non-brace>` is not liftable (CLAUDE.md "Testing"), so the module
   state is supplied here and its committed initial values are pinned below. */
function rangerWorld(over = {}) {
	const calls = { equip: 0, knock: [], walks: [] };
	/* world() copies the character into a fresh object, so the stubs must
	   act on the world's copy - bound once the world exists, below. */
	const box = {};
	const seed = Object.assign({
		name: 'Dexon', map: 'main', x: 0, y: 0, real_x: 0, real_y: 0, rip: false,
		items: [null, null, { name: 'phelmet', level: 0, l: 'l' }, null],
		slots: { helmet: { name: 'fury', level: 6, l: 'l' } },
		trickortreat: { doors: [], doors_left: 7, stamps: 0 },
	}, over.character || {});
	const w = world({
		character: seed,
		parent: { S: Object.assign({ halloween: true, schedule: { events: [], repeats: [] } }, over.S || {}),
			G: { events: { trickortreat: RULES } } },
		CONFIG: { trickOrTreat: { enabled: true, tickMs: 20000, leadMs: 300000, retryMs: 600000, moveMs: 1000, reach: 80 } },
		BOSS_RANK_DEFAULT: 7,
		state: { sellingOff: false, waitingForMerchant: false },
		mhBusy: false, reliefRunning: false,
		ragePull: { busy: false }, rageNav: { busy: false },
		bossHop: { state: 'IDLE', hopping: false },
		travelState: { inFlight: false, attemptId: 0 },
		totBusy: false, totPauseUntil: 0, totDoneDay: null, totLast: null,
		is_disabled: () => false,
		noHang: (p) => p,
		shouldHandleEvents: over.shouldHandleEvents || (() => false),
		safeSmartMove: async (d) => { const ch = box.ch; calls.walks.push(d.map + '#' + d.x); ch.map = d.map; ch.real_x = d.x; ch.real_y = d.y; return true; },
		/* equip(idx): the bag item and the worn helmet trade places, as measured. */
		equip: async (idx) => {
			const ch = box.ch;
			calls.equip++;
			const it = ch.items[idx];
			if (!it) throw { reason: 'no_item' };
			ch.items[idx] = ch.slots.helmet || null;
			ch.slots.helmet = it;
			return { success: true };
		},
		unequip: async (slot) => {
			const ch = box.ch;
			const free = ch.items.indexOf(null);
			if (free < 0) throw { reason: 'no_space' };
			ch.items[free] = ch.slots[slot]; ch.slots[slot] = null;
			return { success: true };
		},
		knock: over.knock || (async (i) => ({ success: true, door: i, stamps: 1, treat: { name: 'candy1', q: 3 } })),
		calls,
	});
	/* The knock stub sees what the server would: record the helmet at the
	   moment of each knock. */
	box.ch = w.character;
	const ch = box.ch;
	const inner = w.knock;
	w.knock = async (i) => { calls.knock.push({ i, helmet: ch.slots.helmet ? ch.slots.helmet.name : null }); return inner(i); };
	lift(w, 'Party/Ranger.js', RANGER_FNS);
	return w;
}

function merchantWorld(over = {}) {
	const calls = { knock: [], travel: [] };
	const box = {};
	const seed = Object.assign({
		name: 'Meltymerch', map: 'main', x: 0, y: 0, real_x: 0, real_y: 0, rip: false, gold: 9e9,
		items: [], slots: { helmet: { name: 'horsemanpumpkin' } },
		trickortreat: { doors: [], doors_left: 7, stamps: 0 },
	}, over.character || {});
	const w = world({
		character: seed,
		parent: { S: { halloween: true }, G: { events: { trickortreat: RULES } } },
		CONFIG: { trickOrTreat: { enabled: true, checkIntervalMs: 20000, retryMs: 600000, reach: 80 },
			arbitrage: { lookEveryMs: 30000 } },
		state: Object.assign({ busy: false, queue: [] }, over.state || {}),
		ARB: Object.assign({ cur: null, busy: false, lastLookAt: Date.now() - 1000 }, over.ARB || {}),
		PROBE: { hold: false },
		arbCanStart: over.arbCanStart || (() => ({ ok: true })),
		arbOldestJobAgeMs: () => null,
		moveLockHeld: () => false,
		totPauseUntil: 0, totDoneDay: null, totLast: null,
		travelTo: async (map, x, y) => { const ch = box.ch; calls.travel.push(map); ch.map = map; ch.real_x = x; ch.real_y = y; return true; },
		equip: () => { throw new Error('the merchant must never swap'); },
		knock: over.knock || (async (i) => ({ success: true, door: i, stamps: 1, treat: { name: 'candy1', q: 3 } })),
		calls,
	});
	box.ch = w.character;
	const inner = w.knock;
	w.knock = async (i) => { calls.knock.push(i); return inner(i); };
	lift(w, 'Party/Merchant.js', MERCHANT_FNS);
	return w;
}

/* Body of a top-level function, by the same brace matcher lift uses - for the
   source-text assertions that a lift cannot express. Tolerates absence. */
function body(file, decl) {
	const s = text(file);
	const at = s.indexOf(decl);
	if (at < 0) return '';
	const { matchBraces } = require('./lift');
	return s.slice(at, matchBraces(s, s.indexOf('{', at)));
}

module.exports = [

{ name: 'Ranger: the module state the suite supplies matches the committed initial values', fn(t) {
	const s = text('Party/Ranger.js');
	t.ok('let totBusy = false', /^let totBusy = false;/m.test(s));
	t.ok('let totPauseUntil = 0', /^let totPauseUntil = 0;/m.test(s));
	t.ok('let totDoneDay = null', /^let totDoneDay = null;/m.test(s));
	t.ok('const BOSS_RANK_DEFAULT = 7', /^const BOSS_RANK_DEFAULT = 7;/m.test(s));
	t.ok('the toggle exists and feeds the config', /trickOrTreat:\s+true,\s+\/\/ CONFIG\.trickOrTreat\.enabled/.test(s)
		&& /enabled: TOGGLES\.trickOrTreat/.test(s));
	t.ok('totStatus is a published feature', /totStatus: typeof totStatus/.test(s));
} },

{ name: 'Ranger: door order is one walk - current map, then halloween, then spookytown', fn(t) {
	const w = rangerWorld();
	const order = w.totRemainingDoors().map((d) => d.i);
	t.eq('all seven, halloween pair first from main', order.slice(0, 2).sort(), [0, 1]);
	t.eq('then the five spookytown doors', order.slice(2).sort(), [2, 3, 4, 5, 6]);
	const w2 = rangerWorld({ character: { map: 'spookytown', real_x: 200, real_y: -30, x: 200, y: -30,
		trickortreat: { doors: [0], doors_left: 6, stamps: 1 } } });
	const o2 = w2.totRemainingDoors().map((d) => d.i);
	t.eq('starting in spookytown begins at the nearest door there (4 at 217,-27)', o2[0], 4);
	t.eq('a knocked door is not revisited', o2.includes(0), false);
	t.eq('six left', o2.length, 6);
} },

{ name: 'Ranger: totBossSoon reads both arrays and skips graveyard', fn(t) {
	const now = Date.now();
	const mk = (sch) => rangerWorld({ S: { schedule: sch } });
	t.eq('nothing scheduled', mk({ events: [], repeats: [] }).totBossSoon(now), Infinity);
	t.eq('franky in 3 min', Math.round(mk({ events: [{ event: 'franky', at: now + 180000 }] }).totBossSoon(now) / 1000), 180);
	t.eq('an unranked event (abtesting) does not count', mk({ events: [{ event: 'abtesting', at: now + 60000 }] }).totBossSoon(now), Infinity);
	t.eq('graveyard does not count - the route ends in spookytown',
		mk({ events: [], repeats: [{ event: 'graveyard', at: now + 60000, every: 7200000 }] }).totBossSoon(now), Infinity);
	t.eq('a ranked repeat is expanded forward by `every` (object form)',
		Math.round(mk({ repeats: [{ event: 'horseman', at: now - 600000, every: 3600000 }] }).totBossSoon(now) / 60000), 50);
	t.eq('and in the array form the creator\'s test pins',
		Math.round(mk({ repeats: [['horseman', now - 600000, 3600000]] }).totBossSoon(now) / 60000), 50);
	t.eq('a past one-off occurrence is ignored', mk({ events: [{ event: 'franky', at: now - 1000 }] }).totBossSoon(now), Infinity);
} },

{ name: 'Ranger: totBlocked names each reason, and is null when clear', fn(t) {
	const now = Date.now();
	t.eq('clear', rangerWorld().totBlocked(now), null);
	t.eq('boss on', rangerWorld({ shouldHandleEvents: () => true }).totBlocked(now), 'a boss or event is on');
	t.eq('ranked event soon', rangerWorld({ S: { schedule: { events: [{ event: 'crabxx', at: now + 120000 }] } } }).totBlocked(now), 'a ranked event opens soon');
	t.eq('graveyard soon does NOT block', rangerWorld({ S: { schedule: { repeats: [{ event: 'graveyard', at: now + 120000, every: 7200000 }] } } }).totBlocked(now), null);
	t.eq('season closed', rangerWorld({ S: { halloween: false } }).totBlocked(now), 'season closed');
	t.eq('no doors left', rangerWorld({ character: { trickortreat: { doors: [], doors_left: 0, stamps: 14 } } }).totBlocked(now), 'no doors left');
	t.eq('all knocked by me even though the account shows more', rangerWorld({ character: { trickortreat: { doors: [0, 1, 2, 3, 4, 5, 6], doors_left: 3, stamps: 7 } } }).totBlocked(now), 'all doors knocked');
	const h = rangerWorld(); h.bossHop.state = 'HOPPING';
	t.eq('mid hop', h.totBlocked(now), 'boss hop HOPPING');
	const d = rangerWorld(); d.totDoneDay = new Date(now).toISOString().slice(0, 10);
	t.eq('limit hit today', d.totBlocked(now), 'account limit reached today');
	const m = rangerWorld(); m.mhBusy = true;
	t.eq('another excursion owns movement', m.totBlocked(now), 'movement is busy');
} },

{ name: 'Ranger: the costume is WORN at every knock and the ordinary helmet is back after', async fn(t) {
	let n = 0;
	const w = rangerWorld({ knock: async (i) => (++n <= 3 ? { success: true, door: i, stamps: n, treat: { name: 'candy1', q: 3 } }
		: Promise.reject({ failed: true, reason: 'trickortreat_limit' })) });
	const sum = await w.totRoute();
	t.eq('four knocks sent, the fourth refused at the account limit', w.calls.knock.length, 4);
	t.eq('every knock went out wearing the costume', w.calls.knock.every((k) => k.helmet === 'phelmet'), true);
	t.eq('the ordinary helmet is back on', w.character.slots.helmet.name, 'fury');
	t.eq('the costume is back in its own bag index, lock intact', w.character.items[2], { name: 'phelmet', level: 0, l: 'l' });
	t.eq('stopped on the limit', sum.stopped, 'account limit');
	t.eq('the limit is remembered for the UTC day', w.totDoneDay, new Date().toISOString().slice(0, 10));
	t.eq('totBusy released', w.totBusy, false);
	t.eq('two equips per knock', w.calls.equip, 8);
} },

{ name: 'Ranger: a boss coming on stops the route at the next door', async fn(t) {
	let on = false, n = 0;
	const w = rangerWorld({ shouldHandleEvents: () => on,
		knock: async (i) => { if (++n === 2) on = true; return { success: true, door: i, stamps: n, treat: { name: 'candy0', q: 1 } }; } });
	const sum = await w.totRoute();
	t.eq('two knocks, then stood down', w.calls.knock.length, 2);
	t.eq('stopped for the boss', sum.stopped, 'a boss or event came on');
	t.eq('helmet restored', w.character.slots.helmet.name, 'fury');
	t.eq('totBusy released', w.totBusy, false);
} },

{ name: 'Ranger: a knock that throws still gets the helmet back', async fn(t) {
	const w = rangerWorld({ knock: async () => { throw new Error('socket gone'); } });
	const sum = await w.totRoute();
	t.eq('helmet restored after every failure', w.character.slots.helmet.name, 'fury');
	t.eq('all seven recorded as failed, none stopped the route', sum.failed.length, 7);
	t.ok('the failure reason is carried', sum.failed[0].indexOf('socket gone') > 0);
	t.ok('doors left open means a retry pause', w.totPauseUntil > Date.now());
} },

{ name: 'Ranger: no costume in the bag, or one already worn - no swaps, still knocks', async fn(t) {
	const bare = rangerWorld({ character: { items: [null, null], slots: { helmet: { name: 'fury', level: 6 } } } });
	await bare.totRoute();
	t.eq('no costume: seven bare knocks', bare.calls.knock.length, 7);
	t.eq('no costume: no equips', bare.calls.equip, 0);
	const worn = rangerWorld({ character: { items: [null], slots: { helmet: { name: 'horsemanpumpkin' } } } });
	await worn.totRoute();
	t.eq('already wearing: no equips', worn.calls.equip, 0);
	t.eq('already wearing: every knock costumed', worn.calls.knock.every((k) => k.helmet === 'horsemanpumpkin'), true);
} },

{ name: 'Ranger: with no helmet worn, the costume comes off to an empty slot', async fn(t) {
	const w = rangerWorld({ character: { items: [null, { name: 'gphelmet', level: 0 }], slots: { helmet: null },
		trickortreat: { doors: [0, 1, 2, 3, 4, 5], doors_left: 1, stamps: 6 } } });
	await w.totRoute();
	t.eq('knocked once, costumed', w.calls.knock, [{ i: 6, helmet: 'gphelmet' }]);
	t.eq('bare again afterwards', w.character.slots.helmet, null);
	t.ok('the costume is back in the bag', w.character.items.some((it) => it && it.name === 'gphelmet'));
} },

{ name: 'Ranger: movement and the off-helmet are guarded while a route runs (source text)', fn(t) {
	const main = body('Party/Ranger.js', 'async function mainLoop()');
	const stand = main.indexOf('if (totBusy) return setTimeout(mainLoop, 250);');
	t.ok('mainLoop stands down on totBusy', stand > 0);
	t.ok('and does so BEFORE bossHop.tick, which would otherwise hop us mid-route', stand > 0 && stand < main.indexOf('bossHop.tick()'));
	const s = text('Party/Ranger.js');
	const clear = s.slice(s.indexOf('const clearInventory = () => {'), s.indexOf('const clearInventory = () => {') + 600);
	t.ok('muling skips while the swapped-out helmet is in the bag', /if \(totBusy\) return;/.test(clear));
	t.ok('sellItems skips too', /if \(totBusy\) return;/.test(body('Party/Ranger.js', 'function sellItems()')));
	t.ok('relief does not start a vendor trip under a route', /if \(totBusy\) return;/.test(body('Party/Ranger.js', 'async function runInventoryRelief()')));
} },

{ name: 'Merchant: module state, toggle and boot call', fn(t) {
	const s = text('Party/Merchant.js');
	t.ok('let totPauseUntil = 0', /^let totPauseUntil = 0;/m.test(s));
	t.ok('let totDoneDay = null', /^let totDoneDay = null;/m.test(s));
	t.ok('toggle feeds the config', /trickOrTreat:\s+true,\s+\/\/ CONFIG\.trickOrTreat\.enabled/.test(s) && /enabled: TOGGLES\.trickOrTreat/.test(s));
	t.ok('totLoop is started at boot, after arbLoop', /^arbLoop\(\);\ntotLoop\(\);/m.test(s));
	t.eq('the merchant route never calls equip', /equip\(/.test(body('Party/Merchant.js', 'async function totRoute()')), false);
} },

{ name: 'Merchant: arbitrage goes first', fn(t) {
	const now = Date.now();
	t.eq('a look found nothing a moment ago - clear', merchantWorld().totBlocked(now), null);
	t.eq('no look for over lookEveryMs - wait for one', merchantWorld({ ARB: { lastLookAt: now - 60000 } }).totBlocked(now), 'arbitrage first');
	t.eq('a trade in flight', merchantWorld({ ARB: { cur: { item: 'x' } } }).totBlocked(now), 'arbitrage first');
	t.eq('arbitrage could not start anyway - the knock goes', merchantWorld({ ARB: { lastLookAt: 0 }, arbCanStart: () => ({ ok: false, reason: 'disabled' }) }).totBlocked(now), null);
	t.eq('busy merchant', merchantWorld({ state: { busy: true } }).totBlocked(now), 'merchant busy');
	t.eq('queued deliveries first', merchantWorld({ state: { queue: [{ type: 'mluck' }] } }).totBlocked(now), 'merchant busy');
	t.eq('no boss gate on the merchant', typeof merchantWorld().shouldHandleEvents, 'undefined');
} },

{ name: 'Merchant: a route knocks all seven, holding and releasing state.busy', async fn(t) {
	let seenBusy = null;
	const w = merchantWorld({ knock: async (i) => { seenBusy = w.state.busy; return { success: true, door: i, stamps: 1 + i, treat: { name: 'candy1', q: 3 } }; } });
	const sum = await w.totRoute();
	t.eq('seven knocks', w.calls.knock.length, 7);
	t.eq('state.busy held while knocking', seenBusy, true);
	t.eq('and released after', w.state.busy, false);
	t.eq('nothing stopped it', sum.stopped, null);
	t.eq('no retry pause when every door is done', w.totPauseUntil, 0);
} },

{ name: 'Merchant: already-knocked and limit refusals', async fn(t) {
	let n = 0;
	const w = merchantWorld({ knock: async (i) => {
		n++;
		if (n === 1) throw { failed: true, reason: 'trickortreat_knocked', door: i };
		if (n === 3) throw { failed: true, reason: 'trickortreat_limit' };
		return { success: true, door: i, stamps: n };
	} });
	const sum = await w.totRoute();
	t.eq('a knocked door is skipped and the route carries on, then the limit stops it', w.calls.knock.length, 3);
	t.eq('one success counted', sum.knocked, 1);
	t.eq('stopped on the limit', sum.stopped, 'account limit');
	t.eq('state.busy released', w.state.busy, false);
} },

];
