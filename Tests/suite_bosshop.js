/* Ranger's cross-shard boss hop: the taxi-join predicate, the three gates it
   feeds, the walk-in-sick probe, and the hop lock that stops a burst of
   boss_hop messages. Every function is lifted from Party/Ranger.js as
   committed. */

const { lift, world } = require('./lift');
const RANGER = 'Party/Ranger.js';

const G_BASE = {
	events: {
		crabxx: { join: true, duration: 2400 }, franky: { join: true, duration: 2400 },
		icegolem: { join: true, duration: 2400 }, goobrawl: { join: true, duration: 540 },
		abtesting: { join: true, duration: 480 },
	},
	maps: { main: { doors: [[1]] }, level2w: { doors: [[1], [2], [3]] }, winterland: { doors: [[1]] }, goobrawl: { doors: [] } },
	monsters: { crabxx: { hp: 960000 }, franky: { hp: 120000000 }, dragold: { hp: 25600000 } },
	conditions: { hopsickness: { duration: 720000 } },
};

const CFG = () => ({
	bossHop: {
		enabled: true, hopLatencyMs: 1500, safetyMarginMs: 500, joinClearMarginMs: 30000,
		dexonDps: 2605, typicalPlayerDps: 2000, minContributors: 5, maxContributors: 200,
		returnHome: true, returnHomeAfterMs: 90000,
		targets: [{ mtype: 'dragold', kills_to_rung: 1 }, { mtype: 'franky', kills_to_rung: 68 }, { mtype: 'crabxx', kills_to_rung: 70 }],
	},
});

function ranger(over = {}) {
	const w = world(Object.assign({
		CONFIG: over.CONFIG || CFG(),
		REGIONS: ['US', 'EU', 'ASIA'], HOP_ATTEMPT_CAP: 5, HOP_RELOAD_GRACE_MS: 15000,
		TAXI_PROBE_KEY: 'taxi_probe', TAXI_PROBE_MAX: 30,
		parent: { G: G_BASE, S: over.S || {} },
	}, over));
	lift(w, RANGER, ['BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossRank', 'BOSS_JOIN_SPOTS', 'bossTaxiWalkable',
		'taxiProbeRead', 'taxiProbeWrite', 'taxiProbeNote', 'taxiProbeClose', 'bossHop']);
	w.bossHop.shardDps = () => 5000;
	w.bossHop.localBossLive = (t) => (over.live || []).includes(t);
	return w;
}

module.exports = [

{ name: 'taxi joins: which refusals actually put the fight out of reach', fn(t) {
	let w = ranger();
	t.eq('crabxx walks to main', w.bossTaxiWalkable('crabxx'), true);
	t.eq('franky walks to level2w', w.bossTaxiWalkable('franky'), true);
	t.eq('icegolem walks to winterland', w.bossTaxiWalkable('icegolem'), true);
	t.eq('goobrawl does NOT - its map has doors: []', w.bossTaxiWalkable('goobrawl'), false);
	t.eq('abtesting does NOT - it is not a transport at all', w.bossTaxiWalkable('abtesting'), false);

	/* The predicate is derived, not listed, so the game can change the
	   answer. This is the check that proves it is derived. */
	const noDoors = JSON.parse(JSON.stringify(G_BASE));
	noDoors.maps.main.doors = [];
	w = ranger({ parent: { G: noDoors, S: {} } });
	t.eq('a destination that LOSES its doors stops being a taxi join', w.bossTaxiWalkable('crabxx'), false);

	w = ranger();
	t.eq('isTaxiJoin(crabxx)', w.bossHop.isTaxiJoin('crabxx'), true);
	t.eq('isTaxiJoin(goobrawl)', w.bossHop.isTaxiJoin('goobrawl'), false);
	t.eq('isTaxiJoin(dragold) - not a join event at all', w.bossHop.isTaxiJoin('dragold'), false);
	t.eq('isJoinEvent(goobrawl) is still true - a different question', w.bossHop.isJoinEvent('goobrawl'), true);
} },

{ name: 'hop sickness: what remains, not the full duration', fn(t) {
	t.eq('not sick', ranger().bossHop.hopsickRemainingMs(), 0);
	t.eq('reads the live ms off the condition',
		ranger({ character: { s: { hopsickness: { ms: 451765 } } } }).bossHop.hopsickRemainingMs(), 451765);
	t.eq('no ms field falls back to G duration - the conservative direction',
		ranger({ character: { s: { hopsickness: {} } } }).bossHop.hopsickRemainingMs(), 720000);
} },

{ name: 'localTarget: a sick taxi join is walked to, not abandoned', fn(t) {
	t.eq('HOP-SICK with crabxx live HERE: taken',
		ranger({ character: { s: { hopsickness: { ms: 600000 } } }, live: ['crabxx'] }).bossHop.localTarget(), 'crabxx');
	t.eq('not sick, crabxx live here: taken (unchanged)',
		ranger({ character: { s: {} }, live: ['crabxx'] }).bossHop.localTarget(), 'crabxx');

	const cfg = CFG(); cfg.bossHop.targets = [{ mtype: 'goobrawl', kills_to_rung: 5 }];
	t.eq('HOP-SICK with goobrawl live here: still skipped, no walkable entrance',
		ranger({ CONFIG: cfg, character: { s: { hopsickness: { ms: 600000 } } }, live: ['goobrawl'] }).bossHop.localTarget(), null);
	t.eq('not sick, goobrawl live here: taken via the join',
		ranger({ CONFIG: cfg, character: { s: {} }, live: ['goobrawl'] }).bossHop.localTarget(), 'goobrawl');
} },

{ name: 'pickTarget: the window test charges no sickness wait for a taxi join', fn(t) {
	const stub = (w, cand, win) => {
		w.bossHop.candidates = () => [cand];
		w.bossHop.contributors = () => 40;
		w.bossHop.requiredDwellSec = () => 2;
		w.bossHop.maxHpOf = () => cand.maxHp;
		w.bossHop.eventWindowMs = () => win;
		return w.bossHop;
	};
	const crab = { shard: 'EUI', mtype: 'crabxx', hp: 960000, maxHp: 960000, live: true, secsToDeath: 1500, kills_to_rung: 70 };
	const goo = { shard: 'EUI', mtype: 'goobrawl', hp: 1000000, maxHp: 1000000, live: true, secsToDeath: 400, kills_to_rung: 5 };

	let b = stub(ranger({ character: { s: { hopsickness: { ms: 700000 } } } }), crab, 2400000);
	t.eq('sick, crabxx 1500s left: eligible', (b.pickTarget() || {}).mtype, 'crabxx');

	b = stub(ranger({ character: { s: { hopsickness: { ms: 700000 } } } }), goo, 540000);
	t.eq('sick, goobrawl in a 540s window: refused, 700s will not fit', b.pickTarget(), null);

	b = stub(ranger({ character: { s: {} } }), goo, 540000);
	t.eq('not sick, goobrawl: eligible', (b.pickTarget() || {}).mtype, 'goobrawl');

	/* The remaining-ms fix, observable from outside: same boss, same window,
	   only the clock differs. */
	b = stub(ranger({ character: { s: { hopsickness: { ms: 60000 } } } }), goo, 540000);
	t.eq('only 60s of sickness LEFT: goobrawl now fits', (b.pickTarget() || {}).mtype, 'goobrawl');
} },

{ name: 'the walk-in-sick probe survives the reload a hop causes', fn(t) {
	const w = ranger();
	w.taxiProbeNote('crabxx', { walkedAt: 1000, sickMsAtWalk: 600000 });
	t.eq('a walk opens one row', w.taxiProbeRead().length, 1);
	w.taxiProbeNote('crabxx', { note: 'again' });
	t.eq('a second note updates it rather than opening another', w.taxiProbeRead().length, 1);

	w.character.s = { hopsickness: { ms: 120000 } };
	w.taxiProbeClose('crabxx', 95000);
	const r = w.taxiProbeRead()[0];
	t.eq('closed', r.closed, true);
	t.eq('present at death - what credit actually requires', r.presentAtDeath, true);
	t.eq('dwell in seconds', r.dwellSec, 95);
	t.eq('STILL SICK at the kill - the row that proves the mechanism', r.sickThroughout, true);

	w.taxiProbeNote('crabxx', { walkedAt: 2000 });
	t.eq('a later walk opens a NEW row, the closed one is not reused', w.taxiProbeRead().length, 2);
	w.character.s = {};
	w.taxiProbeClose('crabxx', 10000);
	t.eq('sickness cleared before the kill is recorded as such', w.taxiProbeRead()[1].sickThroughout, false);

	const w2 = ranger();
	w2.taxiProbeClose('franky', 50000);
	t.eq('an ordinary teleported fight records nothing', w2.taxiProbeRead().length, 0);

	const w3 = ranger();
	w3.set = () => { throw new Error('storage down'); };
	let threw = false;
	try { w3.taxiProbeNote('crabxx', { walkedAt: 1 }); } catch (e) { threw = true; }
	t.eq('a storage failure degrades rather than throwing into the caller', threw, false);
} },

{ name: 'goHomeIfIdle no longer abandons a boss live where we stand', async fn(t) {
	let w = ranger({ live: ['crabxx'] });
	let hopped = false;
	w.bossHop.localTarget = () => 'crabxx';
	w.bossHop.changeServer = async () => { hopped = true; return true; };
	w.bossHop.lootBeforeHop = async () => false;
	w.bossHop.idleSince = Date.now() - 600000;
	const r = await w.bossHop.goHomeIfIdle('USIV');
	t.eq('a live local boss stops the trip home', [r, hopped], ['continue', false]);
	t.eq('and the idle clock resets', w.bossHop.idleSince, 0);

	w = ranger();
	hopped = false;
	w.bossHop.localTarget = () => null;
	w.bossHop.changeServer = async () => { hopped = true; return true; };
	w.bossHop.lootBeforeHop = async () => false;
	w.bossHop.idleSince = Date.now() - 600000;
	await w.bossHop.goHomeIfIdle('USIV');
	t.eq('nothing local: still goes home as before', hopped, true);
} },

{ name: "the operator's rank orders the eligible set, and only orders it", fn(t) {
	const w = ranger();
	t.eq('dragold 1', w.bossRank('dragold'), 1);
	t.eq('franky 2', w.bossRank('franky'), 2);
	t.eq('crabxx, wabbit and goobrawl all 3',
		['crabxx', 'wabbit', 'goobrawl'].map(w.bossRank), [3, 3, 3]);
	t.eq('mrgreen 4', w.bossRank('mrgreen'), 4);
	t.eq('grinch and mrpumpkin 5', ['grinch', 'mrpumpkin'].map(w.bossRank), [5, 5]);
	t.eq('anything unranked is 6, the operator\'s "all others"', w.bossRank('phoenix'), 6);
	t.eq('and so is a name the game does not have', w.bossRank('nonsense'), 6);
	/* Keyed by the parent.S name, which is the EVENT name where one exists -
	   bossLiveNames() yields goobrawl, never rgoo. */
	t.eq('goobrawl is keyed by its event name, not its monster', w.bossRank('rgoo'), 6);
} },

{ name: 'localTarget ranks, and the ranking changes nothing today', fn(t) {
	/* Two targets live at once is the case the rank exists for. It cannot
	   actually arise for these two - no two event windows overlap - but the
	   ordering has to be right before a target is added that can. */
	let h = ranger({ live: ['crabxx', 'franky'] });
	t.eq('franky (2) beats crabxx (3) when both are live here', h.bossHop.localTarget(), 'franky');

	h = ranger({ live: ['crabxx'] });
	t.eq('one live target is still taken', h.bossHop.localTarget(), 'crabxx');

	/* The no-op claim, asserted rather than asserted-about: today's three
	   targets rank in the same order their kills_to_rung already produced. */
	const w = ranger();
	const byRank = [...w.CONFIG.bossHop.targets].sort((a, b) => w.bossRank(a.mtype) - w.bossRank(b.mtype));
	const byRung = [...w.CONFIG.bossHop.targets].sort((a, b) => a.kills_to_rung - b.kills_to_rung);
	t.eq('rank order == kills_to_rung order for the current targets',
		byRank.map((x) => x.mtype), byRung.map((x) => x.mtype));
	t.note('so this change is future-proofing for bossHop; the live effect is in bossPick');
} },

{ name: 'pickTarget sorts by rank before deadline', fn(t) {
	const h = ranger();
	h.bossHop.contributors = () => 40;
	h.bossHop.requiredDwellSec = () => 2;
	h.bossHop.maxHpOf = (m) => (m === 'crabxx' ? 960000 : 120000000);
	h.bossHop.eventWindowMs = () => 2400000;
	/* crabxx dies SOONER, franky ranks HIGHER. Before the change the earliest
	   deadline won; now the rank does. */
	h.bossHop.candidates = () => [
		{ shard: 'EUI', mtype: 'crabxx', hp: 960000, maxHp: 960000, live: true, secsToDeath: 300, kills_to_rung: 70 },
		{ shard: 'USII', mtype: 'franky', hp: 120000000, maxHp: 120000000, live: true, secsToDeath: 1500, kills_to_rung: 68 },
	];
	t.eq('franky (2) wins over a sooner-dying crabxx (3)', h.bossHop.pickTarget().mtype, 'franky');

	/* Within one rank the delegated tie-break applies: cheapest dwell first. */
	const h2 = ranger();
	h2.bossHop.contributors = () => 40;
	h2.bossHop.maxHpOf = () => 960000;
	h2.bossHop.eventWindowMs = () => 2400000;
	h2.bossHop.requiredDwellSec = (maxHp, k, sick, mtype) => (mtype === 'wabbit' ? 1 : 50);
	h2.bossHop.candidates = () => [
		{ shard: 'EUI', mtype: 'crabxx', hp: 960000, maxHp: 960000, live: true, secsToDeath: 200, kills_to_rung: 70 },
		{ shard: 'USII', mtype: 'wabbit', hp: 960000, maxHp: 960000, live: true, secsToDeath: 1500, kills_to_rung: 99 },
	];
	t.eq('equal rank: the cheaper dwell wins even though it dies later',
		h2.bossHop.pickTarget().mtype, 'wabbit');
} },

{ name: 'bossPick: rank leads, and the incumbent holds a tie', fn(t) {
	function picker(live, held) {
		const w = ranger();
		/* bossPick's own preamble - forced pick, then a leader's call - is
		   not what this suite is about, so both are empty and we are the
		   leader, which drops straight through to the ranked scan. */
		w.bossState = { trip: held ? { name: held } : null, forced: null, fromLeader: null };
		w.bossIsLeader = () => true;
		w.bossEligible = () => ({ ok: true });
		w.bossLiveNames = () => Object.keys(live);
		w.parent.S = live;
		w.CONFIG.bossEvents = { leaderTrustMs: 60000 };
		lift(w, RANGER, ['bossPick']);
		return w.bossPick();
	}
	const full = (hp) => ({ live: true, hp, max_hp: 100 });

	/* THE CASE THAT CHANGES. Before: lowest hp ratio won, so a nearly-dead
	   low-rank boss beat a fresh high-rank one. */
	t.eq('a fresh mrgreen (4) beats a half-dead greenjr (unranked 6)',
		picker({ mrgreen: full(100), greenjr: full(3) }).name, 'mrgreen');
	t.eq('franky (2) beats mrgreen (4) regardless of hp',
		picker({ franky: full(100), mrgreen: full(1) }).name, 'franky');

	/* Within a rank the old key still decides. */
	t.eq('equal rank falls back to lowest hp ratio',
		picker({ crabxx: full(80), wabbit: full(20) }).name, 'wabbit');

	/* Invariant: never abandon for an EQUAL rank. */
	t.eq('the incumbent holds against an equal-rank boss with less hp',
		picker({ crabxx: full(80), wabbit: full(20) }, 'crabxx').name, 'crabxx');
	t.eq('but a HIGHER rank still takes the trip',
		picker({ crabxx: full(80), franky: full(99) }, 'crabxx').name, 'franky');
	t.eq('and a lower rank never does',
		picker({ crabxx: full(99), mrgreen: full(1) }, 'crabxx').name, 'crabxx');

	t.eq('nothing live -> null', picker({}), null);
} },

{ name: 'the hop lock: one boss_hop per hop, not a burst of five', async fn(t) {
	/* The leader used to clear `hopping` on the line after change_server.
	   change_server does not block - it starts a navigation and returns - so
	   the next tick 100ms later found state HOPPING with the old shard still
	   reported, and sent another boss_hop. Measured live: 2-5 per episode,
	   ~105ms apart, which is TICK_RATE.main exactly. */
	const TICK = 100, TEARDOWN = 420;

	async function run(clearEagerly, navigates, ticks) {
		const sent = [];
		let now = 0, navigatedAt = null;
		const w = ranger();
		w.Date = { now: () => now };
		w.plSend = (to, d) => sent.push({ at: now, shard: d.shard });
		w.change_server = () => { if (navigates && navigatedAt === null) navigatedAt = now; };
		w.get_chests = () => ({});
		w.loot = async () => {};
		/* Re-lift with the frozen clock in place. */
		lift(w, RANGER, ['bossHop']);
		const b = w.bossHop;
		b.state = 'HOPPING'; b.targetShard = 'EUI'; b.targetType = 'mrgreen';
		b.localBossLive = () => false; b.localTarget = () => null;
		b.pickTarget = () => null; b.goHomeIfIdle = async () => 'continue';
		b.currentShard = () => 'USIV';
		if (clearEagerly) {
			const orig = b.changeServer.bind(b);
			b.changeServer = async (...a) => { const r = await orig(...a); b.hopping = false; return r; };
		}
		for (let i = 0; i < (ticks || 12); i++) {
			if (navigatedAt !== null && now >= navigatedAt + TEARDOWN) break;
			await b.tick();
			now += TICK;
		}
		return { sent, hopping: b.hopping };
	}

	const before = await run(true, true);
	t.eq('OLD behaviour reproduces the live burst: five messages', before.sent.length, 5);
	t.eq('all naming the same shard', [...new Set(before.sent.map((s) => s.shard))], ['EUI']);
	t.eq('spaced one main-loop tick apart', before.sent.slice(1).map((s, i) => s.at - before.sent[i].at), [100, 100, 100, 100]);

	const after = await run(false, true);
	t.eq('NEW: exactly one boss_hop', after.sent.length, 1);
	t.eq('and the lock is still held when the page dies', after.hopping, true);

	const stuck = await run(false, false, 12);
	t.eq('no burst even when the navigation never arrives', stuck.sent.length, 1);
	t.eq('lock still held inside the grace window', stuck.hopping, true);

	/* 200 ticks of a frozen clock is 20s, past HOP_RELOAD_GRACE_MS. */
	const released = await run(false, false, 200);
	t.eq('the watchdog releases at 15s and the hop retries once by 20s', released.sent.length, 2);
	t.that('the retry is 15s later, not a burst', released.sent[1].at - released.sent[0].at >= 15000,
		released.sent[1].at - released.sent[0].at);
} },

];
