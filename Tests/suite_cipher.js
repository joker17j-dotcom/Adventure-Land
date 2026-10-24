/* Tests/suite_cipher.js - Witch's Cipher ingredient farming: the ranger's
   farm layer and hop plan, and the merchant's bag hold and stock report.

   The rules every fixture rests on, read from the server at upstream 16881a27
   (node/logic/witch_cipher.js, design/events.js, design/event_flags.js):
   for the first `gathering` seconds of a round, sixteen monsters carry one of
   four ingredients in their normal loot at `loot * hp / 1000` per kill; the
   round is published on its own shard as S.witchcipher with `phase` and an
   exact `gather_end`; the season ends at S.event_ends.halloween (epoch ms).
   Operator's rulings 2026-10-24: farm only while Meltymerch holds fewer than
   25 of any one IN HIS OWN BAG, during a gathering window, nothing outranking
   it; hop to another shard's window if needed, home preferred in home's own
   window; he keeps them in the bag until the season ends.

   Every function under test is lifted from the committed files. */

const fs = require('fs');
const path = require('path');
const { lift, world, ROOT } = require('./lift');

const RANGER = 'Party/Ranger.js';
const MERCHANT = 'Party/Merchant.js';
const text = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const INGREDIENTS = [
	['verdantspore', ['goo', 'bee', 'spider', 'croc']],
	['frostscale', ['arcticbee', 'boar', 'wolfie', 'iceroamer']],
	['embercoal', ['plantoid', 'porcupine', 'fireroamer', 'gscorpion']],
	['gloomfeather', ['snake', 'osnake', 'minimush', 'ghost']],
];
const WC = { duration: 1680, gathering: 1200, loot: 0.003, ingredients: INGREDIENTS };
const FULL = { verdantspore: 30, frostscale: 30, embercoal: 30, gloomfeather: 30 };

/* A small world: main and halloween joined by one door, a goo spawn on main
   next to the character, a snake spawn on halloween behind the door, and a
   bee spawn on main. All three are pushovers - the uptime gate is not what
   these tests are about. */
function G() {
	return {
		events: { witchcipher: WC },
		maps: {
			main: { doors: [[1000, 0, 40, 40, 'halloween', 0]], spawns: [[0, 0]],
				monsters: [
					{ type: 'goo', count: 3, boundary: [-50, -50, 50, 50] },
					{ type: 'bee', count: 4, boundary: [300, -50, 400, 50] },
				] },
			halloween: { doors: [[0, 0, 40, 40, 'main', 0]], spawns: [[0, 0]],
				monsters: [{ type: 'snake', count: 6, boundary: [-50, 950, 50, 1050] }] },
			island: { doors: [], spawns: [[0, 0]], monsters: [{ type: 'croc', count: 6, boundary: [0, 0, 10, 10] }] },
		},
		monsters: {
			goo: { hp: 1000, xp: 10, respawn: 1, attack: 1, frequency: 1 },
			bee: { hp: 3000, xp: 30, respawn: 1, attack: 1, frequency: 1 },
			snake: { hp: 2000, xp: 20, respawn: 1, attack: 1, frequency: 1 },
			croc: { hp: 4000, xp: 40, respawn: 1, attack: 1, frequency: 1 },
		},
		conditions: { hopsickness: { duration: 720000 } },
	};
}

/* Scalar and array consts are not liftable (CLAUDE.md "Testing": lift()
   brace-matches from the first `{`, which for these is past the declaration),
   so they are supplied - and pinned against the source text below, so a change
   to the file cannot leave these copies stale while the suite stays green. */
const CONSTS = { CIPHER_EVENT: 'witchcipher', BOSS_RANK_DEFAULT: 7, CIPHER_RANK: 8,
	CIPHER_INGREDIENTS_FALLBACK: INGREDIENTS };
const RANGER_FNS = ['cipherLog', 'cipherSay', 'cipherRules', 'cipherIngredients', 'cipherGatherMs', 'cipherLootRate',
	'cipherOnStock', 'cipherShort', 'cipherWindowHere', 'cipherDoorDistance', 'cipherTravelSec',
	'cipherSpots', 'cipherOwnsSpot', 'cipherApply', 'cipherRelease', 'cipherIdleReason',
	'cipherSeasonOpen', 'cipherTick', 'farmSpotKill', 'FARM_SEARCH', 'spotKey', 'isPermanentlyBlacklisted',
	'isMapSafeForFarming', 'dodgeMultiplier', 'mitigated', 'defenseMultiplier'];

function cfg() {
	return { enabled: true, hop: true, target: 25, stockMaxAgeMs: 900000, tickMs: 15000,
		walkLeadMaxMs: 600000, marginMs: 60000, minUsefulMs: 180000, pathFactor: 1.5, unknownTravelSec: 300 };
}

function rangerWorld(o = {}) {
	const w = world({
		character: Object.assign({ name: 'Dexon', map: 'main', x: 0, y: 0, real_x: 0, real_y: 0, speed: 50,
			max_hp: 5000, home: 'USII', s: {} }, o.character || {}),
		/* The game's own mitigation, so the scorer never takes its logged
		   fallback; these monsters carry no armour, so 1 is exact. */
		parent: { G: G(), S: o.S || {}, server_region: 'US', server_identifier: 'II', damage_multiplier: () => 1 },
		CONFIG: { cipherFarm: Object.assign(cfg(), o.cf || {}),
			bossHop: { preposition: { feedMaxAgeMs: 300000, lineupMaxAgeSec: 1800 }, hopLatencyMs: 1500 } },
	});
	/* `let manualOverride = null`, `let rageAlso = []` and the `const` state
	   objects whose initialisers are not braces are supplied here, per
	   CLAUDE.md "Testing" - and pinned against the source below. */
	Object.assign(w, JSON.parse(JSON.stringify(CONSTS)));
	w.manualOverride = o.override || null;
	w.rageAlso = ['mummy'];
	w.cipherFarm = { stock: null, stockAt: 0, pick: null, key: '', said: '' };
	w.PERMANENT_WHITELIST = new Set();
	w.PERMANENT_BLACKLIST = new Set(o.permBlack || []);
	w.blacklist = o.blacklist || {};
	w.getBlacklist = () => w.blacklist;
	w.getPartyDps = () => ({ physical: 3000, magical: 3000 });
	w.estimateHealThroughput = () => 2000;
	w.farmRuns = 0;
	w.runFarmSearch = () => { w.farmRuns++; };
	w.achvIsOurs = () => !!o.achvOurs;
	w.mhOwnsSpot = () => !!o.mhOurs;
	w.bossHop = { currentShard: () => o.shard || 'USII', schedRows: o.rows || [],
		cipherPlan: () => null };
	lift(w, RANGER, RANGER_FNS);
	return w;
}

/* Stock a fresh report for the world. */
function stock(w, counts, ageMs) {
	w.cipherOnStock({ counts });
	if (ageMs) w.cipherFarm.stockAt = Date.now() - ageMs;
}

function gathering(now, endIn) {
	return { witchcipher: { live: true, phase: 'gathering', start: now - 60000, gather_end: now + endIn } };
}

/* bossHop itself, for the plan and the tick. The same shape suite_bosshop
   uses, kept local because that file exports only its suites. */
function hopWorld(o = {}) {
	const w = world({
		character: Object.assign({ name: 'Dexon', map: 'main', x: 0, y: 0, home: 'USII', s: {} }, o.character || {}),
		parent: { G: G(), S: o.S || {}, server_region: o.region || 'US', server_identifier: o.id || 'II' },
		CONFIG: {
			cipherFarm: Object.assign(cfg(), o.cf || {}),
			bossHop: { enabled: true, hopLatencyMs: 1500, safetyMarginMs: 500, joinClearMarginMs: 30000,
				returnHome: true, returnHomeAfterMs: 90000, targets: [],
				preposition: { enabled: true, alsoFor: [], walkLeadMs: 180000, marginMs: 60000, minUsefulMs: 120000,
					feedMaxAgeMs: 300000, lineupMaxAgeSec: 1800 } },
			bossEvents: { enabled: true, exclude: new Set(), include: [], cooperativeOnly: true },
		},
		REGIONS: ['US', 'EU', 'ASIA'], HOP_ATTEMPT_CAP: 5, HOP_RELOAD_GRACE_MS: 15000,
		TAXI_PROBE_KEY: 'taxi_probe', TAXI_PROBE_MAX: 30,
	});
	w.cipherFarm = { stock: null, stockAt: 0, pick: null, key: '', said: '' };
	Object.assign(w, JSON.parse(JSON.stringify(CONSTS)));
	lift(w, RANGER, ['scopeKey', 'scopedHas', 'scopedSet', 'scopedGet', 'scopedGetLegacy',
		'bossState', 'bossCooledDown', 'bossShard', 'bossCooldownKey',
		'BOSS_RANK', 'bossRank', 'BOSS_JOIN_SPOTS', 'bossTaxiWalkable',
		'BOSS_PRESENCE_LIVE', 'bossEntryLive', 'bossEligible',
		'cipherRules', 'cipherIngredients',
		'cipherGatherMs', 'cipherOnStock', 'cipherShort', 'cipherSeasonOpen', 'bossHop']);
	w.bossCooperative = () => true;
	w.hops = [];
	w.bossHop.lootBeforeHop = async () => false;
	w.bossHop.changeServer = async (s, m) => { w.hops.push(s + '/' + m); return true; };
	w.bossHop.pickTarget = () => w.pick || null;
	w.bossHop.localTarget = () => w.here || null;
	w.bossHop.localBossLive = (m) => m === 'witchcipher' || (o.live || []).includes(m);
	return w;
}
function feed(w, rows) {
	w.bossHop.schedRows = rows;
	const s = { USII: { ageSec: 10 } };
	for (const r of rows) s[r.shard] = { ageSec: 10 };
	w.bossHop.schedServers = s;
	w.bossHop.schedAt = Date.now();
}
const crow = (shard, at, status) => ({ shard, event: 'witchcipher', at, windowSec: 1680, status: status || 'scheduled' });

/* The merchant's half. */
function merchantWorld(o = {}) {
	const sent = [];
	const w = world({
		character: Object.assign({ name: 'Meltymerch', items: o.items || [] }, o.character || {}),
		parent: { G: { events: { witchcipher: WC } }, S: o.S || {} },
		plSend: (to, body) => sent.push({ to, body }),
	});
	w.sent = sent;
	w.cipherStockSent = '';
	w.cipherStockSentAt = 0;
	w.CIPHER_INGREDIENTS_FALLBACK = INGREDIENTS.map((x) => x[0]);
	lift(w, MERCHANT, ['cipherIngredientNames', 'cipherSeasonOpen',
		'cipherHeldInBag', 'cipherStockCounts', 'cipherStockTick']);
	return w;
}

module.exports = [

{ name: 'cipher: the merchant\'s count reaches Dexon and decides what is short', fn(t) {
	const w = rangerWorld();
	t.eq('no report yet -> unknown, never "nothing short"', w.cipherShort(Date.now()), null);
	stock(w, FULL);
	t.eq('all four at 30 -> nothing short', w.cipherShort(Date.now()), []);
	stock(w, Object.assign({}, FULL, { embercoal: 24, gloomfeather: 0 }));
	t.eq('24 and 0 are short; 25 is the line', w.cipherShort(Date.now()), ['embercoal', 'gloomfeather']);
	stock(w, Object.assign({}, FULL, { frostscale: 25 }));
	t.eq('exactly 25 is enough', w.cipherShort(Date.now()), []);
	stock(w, Object.assign({}, FULL, { embercoal: 3 }), 16 * 60 * 1000);
	t.eq('a report older than stockMaxAgeMs is unknown', w.cipherShort(Date.now()), null);
	stock(w, Object.assign({}, FULL, { embercoal: 'lots' }));
	t.eq('the receiver validates: a non-number makes the whole answer unknown', w.cipherShort(Date.now()), null);
	stock(w, { verdantspore: 30, frostscale: 30, embercoal: 30 });
	t.eq('a missing name is unknown too, not zero', w.cipherShort(Date.now()), null);
	const before = w.cipherFarm.stockAt;
	w.cipherOnStock({ counts: null });
	t.eq('a message with no counts is ignored, not stored as empty', w.cipherFarm.stockAt, before);
} },

{ name: 'cipher: the window here comes from S when gathering, else the schedule', fn(t) {
	const NOW = Date.now();
	const open = rangerWorld({ S: gathering(NOW, 600000) });
	const wo = open.cipherWindowHere(NOW);
	t.eq('S gathering -> open, ending at the server\'s own gather_end', [wo.open, wo.end], [true, NOW + 600000]);

	const brewing = rangerWorld({ S: { witchcipher: { live: true, phase: 'brewing', gather_end: NOW - 1000 } },
		rows: [crow('USII', NOW + 3600000)] });
	const wb = brewing.cipherWindowHere(NOW);
	t.eq('brewing is not gathering: falls to the next scheduled round', [wb.open, wb.start], [false, NOW + 3600000]);
	t.eq('and its end is start + gathering, read from G', wb.end, NOW + 3600000 + 1200000);

	const other = rangerWorld({ rows: [crow('EUI', NOW + 60000), crow('USII', NOW + 7200000), crow('USII', NOW + 3600000)] });
	t.eq('another shard\'s round is not this shard\'s window; the earliest of ours is',
		other.cipherWindowHere(NOW).start, NOW + 3600000);
	const none = rangerWorld({ rows: [crow('USII', NOW - 60000, 'live')] });
	t.eq('a round the schedule already shows as live is S\'s to report, not the schedule\'s', none.cipherWindowHere(NOW), null);
} },

{ name: 'cipher: the door-graph distance is a straight line on one map and through doors across', fn(t) {
	const w = rangerWorld();
	t.eq('same map: straight line', w.cipherDoorDistance('main', 0, 0, 'main', 300, 400), 500);
	t.eq('across one door: to the door, then from the far spawn',
		w.cipherDoorDistance('main', 0, 0, 'halloween', 0, 1000), 1000 + 1000);
	t.eq('no chain of doors: null, never a guess', w.cipherDoorDistance('main', 0, 0, 'island', 5, 5), null);
	t.eq('an unknown map: null', w.cipherDoorDistance('main', 0, 0, 'nowhere', 0, 0), null);
	t.eq('null becomes the configured long walk', w.cipherTravelSec('island', 5, 5), 300);
	t.eq('and a real distance is scaled by pathFactor over speed', w.cipherTravelSec('main', 300, 400), 500 * 1.5 / 50);
} },

{ name: 'cipher: the spot is the best expected quantity for a short ingredient, travel counted', fn(t) {
	const NOW = Date.now();
	const w = rangerWorld();
	const spots = w.cipherSpots(['verdantspore'], NOW, NOW + 1200000, NOW);
	const names = spots.map((s) => s.home + '@' + s.mobMap);
	t.eq('only monsters carrying a short ingredient', names.every((n) => /^(goo|bee|croc)@/.test(n)), true);
	t.eq('nothing for an ingredient nobody is short of', names.some((n) => /^snake@/.test(n)), false);
	/* WHERE THE PARTY'S DAMAGE IS THE LIMIT, EVERY MONSTER PAYS THE SAME PER
	   SECOND: kills/s is dps/hp and the chance is loot*hp/1000, so hp cancels
	   and the yield is loot*dps/1000. hp matters only when the spawn runs out
	   first. goo: 6,000 dps would kill 6/s, 3 alive at 1s respawn allows 3/s,
	   so 3 x 0.003 = 0.009/s. bee: 2/s against a cap of 4, damage-bound, 2 x
	   0.009 = 0.018/s. */
	const goo = spots.find((s) => s.home === 'goo'), bee = spots.find((s) => s.home === 'bee');
	t.eq('a damage-bound spawn yields loot x dps / 1000', +bee.perSec.toFixed(6), +(0.003 * 6000 / 1000).toFixed(6));
	t.eq('a spawn-bound one yields less', +goo.perSec.toFixed(6), 0.009);
	t.eq('so the spawn that never runs dry wins, though it is further away', spots[0].home, 'bee');
	t.ok('and quantity is per-second times the time left after the walk',
		Math.abs(spots[0].qty - spots[0].perSec * (1200000 - spots[0].travelSec * 1000) / 1000) < 1e-6);

	/* Travel can flip it: a window nearly over leaves the far spawn nothing. */
	const late = w.cipherSpots(['verdantspore', 'gloomfeather'], NOW - 1100000, NOW + 40000, NOW);
	const snake = late.find((s) => s.home === 'snake');
	t.ok('precondition: the snake spawn is reachable and pays per second', !!snake && snake.perSec > 0);
	t.eq('but a 60s walk with 40s of window left yields nothing', snake.qty, 0);
	t.eq('so a spawn standing here outranks it', late[0].mobMap, 'main');

	const opening = w.cipherSpots(['gloomfeather'], NOW + 600000, NOW + 1800000, NOW);
	t.eq('before the opening, a walk shorter than the wait costs nothing',
		+opening[0].qty.toFixed(6), +(opening[0].perSec * 1200).toFixed(6));

	const black = rangerWorld({ blacklist: { 'bee@main': { reason: 'unreachable' } }, permBlack: ['croc@island'] });
	const b = black.cipherSpots(['verdantspore'], NOW, NOW + 1200000, NOW).map((s) => s.home);
	t.eq('the stored and coded blacklists still apply', b, ['goo']);
} },

{ name: 'cipher: the tick farms, waits, stands aside and releases', fn(t) {
	const NOW = Date.now();
	const w = rangerWorld({ S: gathering(NOW, 900000) });
	stock(w, Object.assign({}, FULL, { verdantspore: 3 }));
	w.cipherTick();
	t.ok('short and gathering here: the farm spot is ours', w.cipherOwnsSpot());
	t.eq('pointing at the best verdantspore spot', w.manualOverride && w.manualOverride.home, 'bee');
	t.ok('whitelisted, so the economics check cannot take it', w.PERMANENT_WHITELIST.has('bee@main'));
	t.eq('the queue\'s rage extras are cleared', w.rageAlso, []);
	t.ok('and the farm search re-run to broadcast it', w.farmRuns >= 1);

	stock(w, FULL);
	w.cipherTick();
	t.eq('stock reaches the target mid-window: released', w.manualOverride, null);
	t.eq('and the pick dropped', w.cipherFarm.pick, null);

	const hand = rangerWorld({ S: gathering(NOW, 900000), override: { home: 'crab', mobMap: 'main' } });
	stock(hand, Object.assign({}, FULL, { verdantspore: 3 }));
	hand.cipherTick();
	t.eq('a hand-set override outranks it', hand.manualOverride.home, 'crab');
	const queue = rangerWorld({ S: gathering(NOW, 900000), override: { home: 'mummy', mobMap: 'spookytown' }, achvOurs: true });
	stock(queue, Object.assign({}, FULL, { verdantspore: 3 }));
	queue.cipherTick();
	t.eq('the achievement queue\'s does not', queue.manualOverride.home, 'bee');

	const early = rangerWorld({ rows: [crow('USII', NOW + 300000)] });
	stock(early, Object.assign({}, FULL, { gloomfeather: 0 }));
	early.cipherTick();
	t.eq('five minutes before the opening, a 60s walk waits', early.manualOverride, null);
	t.ok('but has picked where it will go', !!early.cipherFarm.pick && early.cipherFarm.pick.home === 'snake');
	early.cipherFarm.pick.travelSec = 300;
	early.cipherTick();
	t.eq('a walk as long as the wait sets off now', early.manualOverride && early.manualOverride.home, 'snake');

	const far = rangerWorld({ rows: [crow('USII', NOW + 3600000)] });
	stock(far, Object.assign({}, FULL, { gloomfeather: 0 }));
	far.cipherTick();
	t.eq('an hour out: nothing picked at all', far.cipherFarm.pick, null);

	const stale = rangerWorld({ S: gathering(NOW, 900000) });
	stale.cipherTick();
	t.eq('no count from Meltymerch: nothing farmed', stale.manualOverride, null);
	t.ok('and it says why', stale.logs.some((l) => /no fresh count from Meltymerch/.test(l)));

	const off = rangerWorld({ S: gathering(NOW, 900000), cf: { enabled: false } });
	stock(off, Object.assign({}, FULL, { verdantspore: 3 }));
	off.cipherTick();
	t.eq('toggle off: nothing farmed', off.manualOverride, null);

	const after = rangerWorld({ S: Object.assign(gathering(NOW, 900000), { event_ends: { halloween: NOW - 1000 } }) });
	stock(after, Object.assign({}, FULL, { verdantspore: 3 }));
	after.cipherTick();
	t.eq('season over: nothing farmed', after.manualOverride, null);
	t.eq('the season end is the server\'s own, with the date as fallback',
		[rangerWorld().cipherSeasonOpen(Date.parse('2026-11-02T23:59:00Z')),
			rangerWorld().cipherSeasonOpen(Date.parse('2026-11-03T00:00:00Z'))], [true, false]);
} },

{ name: 'cipher: re-picked when the short set changes, and only then', fn(t) {
	const NOW = Date.now();
	const w = rangerWorld({ S: gathering(NOW, 900000) });
	stock(w, Object.assign({}, FULL, { verdantspore: 3, gloomfeather: 3 }));
	w.cipherTick();
	const first = w.manualOverride.home;
	w.cipherTick();
	t.eq('the same short set keeps the same spot', w.manualOverride.home, first);
	stock(w, Object.assign({}, FULL, { gloomfeather: 3 }));
	w.cipherTick();
	t.eq('verdantspore filled: moves to a gloomfeather monster', w.manualOverride.home, 'snake');
} },

{ name: 'cipher plan: hop timing, home preference and the hold', fn(t) {
	const NOW = Date.now();
	const mk = (o = {}) => {
		const w = hopWorld(o);
		stock(w, Object.assign({}, FULL, { embercoal: 0 }));
		return w;
	};
	let w = mk();
	feed(w, [crow('EUI', NOW + 14 * 60000)]);
	t.eq('14 minutes out, a foreign window is not due (sickness 12 + margin 1)', w.bossHop.cipherPlan('USII'), null);
	feed(w, [crow('EUI', NOW + 13 * 60000)]);
	const p = w.bossHop.cipherPlan('USII');
	t.eq('13 minutes out it is', p && p.shard, 'EUI');
	t.eq('ranked below every boss', p && p.rank, w.BOSS_RANK_DEFAULT + 1);

	/* Home's window ENDS FIRST here, so the later tie-breaks would pick the
	   foreign one - only the home preference can put home on top. */
	w = mk();
	feed(w, [crow('EUI', NOW + 8 * 60000), crow('USII', NOW + 5 * 60000)]);
	t.ok('precondition: the foreign window has more gathering left', NOW + 8 * 60000 > NOW + 5 * 60000);
	t.eq('home\'s window coming due beats a foreign one with more left', w.bossHop.cipherPlan('ASIAI').shard, 'USII');
	w = mk();
	feed(w, [crow('EUI', NOW - 60000, 'live'), crow('USII', NOW + 30 * 60000)]);
	t.eq('but not outside home\'s own window', w.bossHop.cipherPlan('ASIAI').shard, 'EUI');
	w = mk();
	feed(w, [crow('EUI', NOW - 60000, 'live'), crow('ASIAI', NOW - 120000, 'live')]);
	t.eq('two foreign windows: the one we stand on', w.bossHop.cipherPlan('ASIAI').shard, 'ASIAI');

	w = mk();
	feed(w, [crow('EUI', NOW - 1100000, 'live')]);
	t.eq('under minUsefulMs of gathering left: refused', w.bossHop.cipherPlan('USII'), null);
	w = mk();
	feed(w, [crow('EUI', NOW + 60000, 'missed')]);
	t.eq('a missed round is not a window', w.bossHop.cipherPlan('USII'), null);

	w = mk({ cf: { hop: false } });
	feed(w, [crow('EUI', NOW + 60000)]);
	t.eq('hop off: no plan', w.bossHop.cipherPlan('USII'), null);
	w = hopWorld();
	stock(w, FULL);
	feed(w, [crow('EUI', NOW + 60000)]);
	t.eq('nothing short: no plan', w.bossHop.cipherPlan('USII'), null);
	w = hopWorld();
	feed(w, [crow('EUI', NOW + 60000)]);
	t.eq('no count: no plan', w.bossHop.cipherPlan('USII'), null);
	w = mk({ S: { event_ends: { halloween: NOW - 1 } } });
	feed(w, [crow('EUI', NOW + 60000)]);
	t.eq('after the season: no plan', w.bossHop.cipherPlan('USII'), null);
	w = mk();
	feed(w, [crow('EUI', NOW + 60000)]);
	w.bossHop.schedAt = NOW - 400000;
	t.eq('a stale feed: no plan', w.bossHop.cipherPlan('USII'), null);
	w = mk();
	feed(w, [crow('EUI', NOW + 60000)]);
	t.ok('precondition: with home\'s lineup fresh it plans', !!w.bossHop.cipherPlan('ASIAI'));
	w.bossHop.schedServers.USII = { ageSec: 4000 };
	t.eq('home\'s lineup stale: "is home in its window" is unanswerable -> no plan', w.bossHop.cipherPlan('ASIAI'), null);
	delete w.bossHop.schedServers.USII;
	t.eq('and missing, likewise', w.bossHop.cipherPlan('ASIAI'), null);

	w = mk();
	feed(w, [crow('USII', NOW - 60000, 'live')]);
	t.eq('a window here holds the party at the cipher rank', w.bossHop.holdRank('USII', null), w.BOSS_RANK_DEFAULT + 1);
	w = mk();
	feed(w, [crow('EUI', NOW - 60000, 'live')]);
	t.eq('a window elsewhere holds nothing here', w.bossHop.holdRank('USII', null), null);
} },

{ name: 'cipher plan: the tick hops for it last, holds for it, and never FIGHTS it', fn(t) {
	const NOW = Date.now();
	const mk = (o = {}) => {
		const w = hopWorld(o);
		stock(w, Object.assign({}, FULL, { embercoal: 0 }));
		return w;
	};
	return (async () => {
		const a = mk();
		feed(a, [crow('EUI', NOW + 12 * 60000)]);
		await a.bossHop.tick();
		t.eq('nothing else on: hops to the window', a.hops, ['EUI/witchcipher']);

		const b = mk();
		feed(b, [crow('EUI', NOW + 12 * 60000)]);
		b.pick = { shard: 'ASIAI', mtype: 'crabxx', secsToDeath: 100 };
		await b.bossHop.tick();
		t.eq('a boss outranks it, even an unranked-looking one', b.hops, ['ASIAI/crabxx']);

		const c = mk();
		feed(c, [crow('USII', NOW - 60000, 'live')]);
		c.pick = { shard: 'EUI', mtype: 'horseman', secsToDeath: 100 };
		await c.bossHop.tick();
		t.eq('holding for a window here still admits a boss hop - tonight\'s EU horseman', c.hops, ['EUI/horseman']);

		const d = mk();
		feed(d, [crow('USII', NOW - 60000, 'live')]);
		const r = await d.bossHop.tick();
		t.eq('nothing better: it holds', [r, d.hops], ['continue', []]);
		t.ok('and says what for', d.logs.some((l) => /Holding on USII for the cipher gathering/.test(l)));
		d.bossHop.idleSince = 0;
		await d.bossHop.goHomeIfIdle('EUI');
		t.eq('goHomeIfIdle is not the way round it', d.hops, []);

		const e = mk({ region: 'EU', id: 'I' });
		feed(e, [crow('EUI', NOW - 60000, 'live')]);
		e.bossHop.state = 'HOPPING';
		e.bossHop.targetShard = 'EUI';
		e.bossHop.targetType = 'witchcipher';
		await e.bossHop.tick();
		t.ok('precondition: S reads witchcipher as live', e.bossHop.localBossLive('witchcipher'));
		t.eq('arriving for the cipher is IDLE, never FIGHTING', e.bossHop.state, 'IDLE');

		/* An event fight live HERE holds the party; a gathering window elsewhere
		   must not take it off a graveyard. */
		const g = mk({ S: { graveyard: { live: true } } });
		feed(g, [crow('EUI', NOW + 12 * 60000)]);
		g.bossState.trip = { name: 'graveyard', shard: 'USII' };
		t.eq('precondition: the live event holds at its own rank', g.bossHop.holdRank('USII', null), 4);
		await g.bossHop.tick();
		t.eq('a live event here is not left for a gathering window', g.hops, []);

		const f = mk();
		feed(f, [crow('EUI', NOW + 12 * 60000), { shard: 'ASIAI', event: 'goobrawl', at: NOW + 700000, windowSec: 540, status: 'scheduled' }]);
		f.parent.G.events.goobrawl = { join: true, duration: 540 };
		f.parent.G.maps.goobrawl = { doors: [] };
		await f.bossHop.tick();
		t.eq('a boss preposition due elsewhere goes first', f.hops, ['ASIAI/goobrawl']);
	})();
} },

{ name: 'cipher: the wiring a lift cannot see', fn(t) {
	const src = text(RANGER);
	t.ok('Meltymerch\'s cipher_stock reaches cipherOnStock, after the Meltymerch-only gate',
		/if \(name !== 'Meltymerch'\) return;[\s\S]*?if \(data\.message === 'cipher_stock'\) cipherOnStock\(data\);/.test(src));
	t.ok('the achievement queue stands back while the cipher owns the spot - not down',
		/async function achvTick\(\) \{[\s\S]*?cipherOwnsSpot\(\)\) return;[\s\S]*?if \(manualOverride && !achvIsOurs\(\)\)/.test(src));
	t.ok('the hunt waits rather than re-asserting its pick',
		/async function mhTick\(\) \{[\s\S]*?cipherOwnsSpot\(\)\) return;[\s\S]*?if \(mhPhase === 'hunt'\)/.test(src));
	t.ok('the tick runs on its own timer', /setInterval\(\(\) => \{ try \{ cipherTick\(\);/.test(src));
	t.ok('the state the suite supplies is the state the file starts with',
		/^const cipherFarm = \{ stock: null, stockAt: 0, pick: null, key: '', said: '' \};$/m.test(src)
		&& /^let manualOverride = null;$/m.test(src));
	/* The live G is what the code reads; the fallback must match the source it
	   was copied from, or a G without the field silently farms the wrong list. */
	t.ok('CIPHER_EVENT as supplied', /^const CIPHER_EVENT = 'witchcipher';$/m.test(src));
	t.ok('BOSS_RANK_DEFAULT as supplied', /^const BOSS_RANK_DEFAULT = 7;$/m.test(src));
	t.ok('CIPHER_RANK is one below the default, as supplied', /^const CIPHER_RANK = BOSS_RANK_DEFAULT \+ 1;$/m.test(src));
	const fb = src.match(/^const CIPHER_INGREDIENTS_FALLBACK = (\[[\s\S]*?\n\]);/m);
	t.eq('the ranger\'s fallback list is the design file\'s, verbatim',
		fb ? JSON.parse(fb[1].replace(/'/g, '"').replace(/,\s*\]/g, ']')) : null, INGREDIENTS);
	const mfb = text(MERCHANT).match(/^const CIPHER_INGREDIENTS_FALLBACK = (\[.*\]);$/m);
	t.eq('and the merchant\'s names match it', mfb ? JSON.parse(mfb[1].replace(/'/g, '"')) : null, INGREDIENTS.map((x) => x[0]));
	t.eq('the farm scorer reads the same kill model', /const kill = farmSpotKill\(mobData, spot, dps, healThroughput, partyEffectiveHp\);/.test(src), true);
} },

{ name: 'merchant: the four stay in the bag until Halloween ends', fn(t) {
	const NOW = Date.now();
	const w = merchantWorld();
	t.eq('in season: held', ['verdantspore', 'gloomfeather'].map(w.cipherHeldInBag), [true, true]);
	t.eq('anything else: not', w.cipherHeldInBag('essenceofether'), false);
	const after = merchantWorld({ S: { event_ends: { halloween: NOW - 1 } } });
	t.eq('after the season: banked like any kept material', after.cipherHeldInBag('verdantspore'), false);

	const src = text(MERCHANT);
	t.ok('all four are kept materials, so they bank once released',
		/keepAndBank: \[[\s\S]*?'verdantspore', 'frostscale', 'embercoal', 'gloomfeather'\]/.test(src));
	/* Every bank_store in the file sits behind the gate. Counted, so a sixth
	   site cannot arrive unguarded without this failing. */
	const stores = (src.match(/await bank_store\(/g) || []).length;
	t.eq('five bank_store sites', stores, 5);
	t.ok('the exchangeable sweep skips them', /names\.has\(it\.name\) \|\| isKeptMaterial\(it\.name\)\)\) continue;\n\t\tif \(cipherHeldInBag\(it\.name\)\) continue;/.test(src));
	t.ok('the kept-material pass skips them', /isKeptMaterial\(item\.name\) && !cipherHeldInBag\(item\.name\)\) toBank\.push\(idx\)/.test(src));
	t.eq('both buy stashes skip them', (src.match(/for \(const b of bought\) \{\n\t\tif \(cipherHeldInBag\(b\.name\)\) continue;/g) || []).length, 2);
	t.ok('arbitrage keeps a stranded one, and says it is held, not banked',
		/async function arbBankItem\(t\) \{[\s\S]{0,300}?if \(cipherHeldInBag\(t\.item\)\) \{[\s\S]*?return false;/.test(src));
} },

{ name: 'merchant: the stock report', fn(t) {
	const w = merchantWorld({ items: [{ name: 'verdantspore', q: 10 }, null, { name: 'verdantspore', q: 5 },
		{ name: 'gloomfeather', q: 3 }, { name: 'embercoal' }, { name: 'stormfeather', q: 99 }] });
	t.eq('summed over every stack, one for an unstacked item, zero for none held', w.cipherStockCounts(),
		{ verdantspore: 15, frostscale: 0, embercoal: 1, gloomfeather: 3 });
	w.cipherStockTick();
	t.eq('sent to Dexon', w.sent.map((s) => [s.to, s.body.message]), [['Dexon', 'cipher_stock']]);
	t.eq('carrying the counts', w.sent[0].body.counts.verdantspore, 15);
	w.cipherStockTick();
	t.eq('unchanged inside five minutes: not re-sent', w.sent.length, 1);
	w.character.items[3].q = 4;
	w.cipherStockTick();
	t.eq('a change is sent at once', w.sent.length, 2);
	w.cipherStockSentAt = Date.now() - 5 * 60 * 1000 - 1;
	w.cipherStockTick();
	t.eq('and the same count is re-sent after five minutes, so Dexon\'s copy never goes stale while we run', w.sent.length, 3);
	const after = merchantWorld({ S: { event_ends: { halloween: Date.now() - 1 } } });
	after.cipherStockTick();
	t.eq('after the season nothing is sent - the bag count stops meaning anything', after.sent.length, 0);
	/* End to end: the merchant's body, as sent, read by the ranger's receiver. */
	const r = rangerWorld();
	r.cipherOnStock(w.sent[2].body);
	t.eq('and Dexon reads what he sent', r.cipherShort(Date.now()), ['verdantspore', 'frostscale', 'embercoal', 'gloomfeather']);
} },

];
