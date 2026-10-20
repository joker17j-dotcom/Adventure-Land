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
		parent: Object.assign({ G: G_BASE, S: over.S || {}, server_region: 'US', server_identifier: 'I' }, over.parentExtra || {}),
	}, over));
	/* bossState and bossCooledDown are lifted because localTarget() now reads the
	   give-up cooldown. They are declared in the same file as bossHop, so a live
	   CODE context always has them; only a lifted world has to be told. Two
	   existing tests threw ReferenceError the moment the gate landed, which is
	   the suite doing its job rather than a hazard in the script. */
	/* bossShard and bossCooldownKey joined the list when v103 keyed the
	   cooldown by (type, shard); four tests threw ReferenceError the moment it
	   landed, which is the same signal bossCooledDown gave in v99. */
	lift(w, RANGER, ['bossState', 'bossCooledDown', 'bossShard', 'bossCooldownKey',
		'BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossRank', 'BOSS_JOIN_SPOTS', 'bossTaxiWalkable',
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

{ name: 'a boss the combat side gave up on no longer pins the party here', fn(t) {
	/* THE 2026-10-19 NIGHTLY WINDOW, which cost two franky credits and their keys.
	   tick() asks localTarget() FIRST and anything truthy commits FIGHTING and
	   returns, so pickTarget() is never reached. localTarget() consulted
	   localBossLive() and a feasibility test and NOTHING about whether the combat
	   side had already given up - so an abandoned-but-alive home boss pinned the
	   party to its shard while a sixteen-second franky sat two shards away. */
	const { extract, ROOT } = require('./lift');
	const fs = require('fs');
	const path = require('path');

	/* BOSS_TYPE_GIVEUP_MAX has a non-brace initialiser so lift() cannot
	   brace-match it, and bossEligible names it in its refusal message. */
	const w = world({ BOSS_TYPE_GIVEUP_MAX: 2, parent: { server_region: 'US', server_identifier: 'I' } });
	lift(w, RANGER, ['bossState', 'bossCooledDown', 'bossShard', 'bossCooldownKey', 'bossEligible']);
	w.CONFIG = { bossEvents: { enabled: true, exclude: new Set(), include: [], cooperativeOnly: false } };
	w.bossCooperative = () => true;

	const NOW = Date.now();
	t.eq('no cooldown entry -> not cooled down', w.bossCooledDown('franky'), false);
	w.bossState.cooldown.franky = NOW + 30 * 60 * 1000;
	t.eq('a live cooldown reads true', w.bossCooledDown('franky'), true);
	t.eq('and bossEligible agrees, through the same expression', w.bossEligible('franky').ok, false);
	w.bossState.cooldown.franky = NOW - 1;
	t.eq('an expired cooldown reads false', w.bossCooledDown('franky'), false);
	t.eq('and bossEligible lets it through again', w.bossEligible('franky').ok, true);
	w.bossState.cooldown.franky = 0;
	t.eq('a zeroed cooldown - the clear path - reads false', w.bossCooledDown('franky'), false);

	/* ONE EXPRESSION, NOT TWO. The cooldown was read in exactly one place and that
	   place was the local-pick path, which is how the hop path came to ignore a
	   give-up. A second inlined copy would reintroduce the drift. */
	const el = extract(RANGER, 'bossEligible');
	t.ok('bossEligible goes through the helper', el.indexOf('bossCooledDown(') > 0);
	t.eq('and does not re-inline the comparison',
		/cooldown\[[^\]]+\]\s*\|\|\s*0\)\s*>\s*Date\.now\(\)/.test(el), false);

	/* localTarget is a method on the bossHop object literal, so lift() cannot reach
	   it by name - asserted at source instead, against the mechanism. */
	const src = fs.readFileSync(path.join(ROOT, RANGER), 'utf8');
	const lt = src.slice(src.indexOf('\tlocalTarget() {'), src.indexOf('\tpickTarget() {'));
	t.ok('localTarget skips a cooled-down target',
		/if \(bossCooledDown\(t\.mtype\)\) continue;/.test(lt));
	t.ok('and before paying for the feasibility test',
		lt.indexOf('bossCooledDown(') < lt.indexOf('requiredDwellSec('));

	/* THIS ASSERTION WAS INVERTED IN v103, AND THE INVERSION IS THE POINT.
	   It read "pickTarget does NOT gate on the cooldown" and that was correct
	   while the key was type-wide: a type-wide entry here blocks the very hop
	   v99 exists to allow. Keyed (type, shard) the gate is right, and what has
	   to be asserted instead is that it asks about the CANDIDATE's shard -
	   gating with one argument would silently ask about OURS, which is never
	   the shard being considered and would make the check a no-op. */
	const pt = src.slice(src.indexOf('\tpickTarget() {'), src.indexOf('\tgoHomeIfIdle'));
	t.ok('pickTarget gates on the cooldown, by the CANDIDATE shard',
		/bossCooledDown\(x\.mtype, x\.shard\)/.test(pt));
	t.eq('and never with the default, which would ask about our own shard',
		/bossCooledDown\(x\.mtype\)/.test(pt), false);
	t.ok('localTarget still gates, and defaults to ours',
		/if \(bossCooledDown\(t\.mtype\)\) continue;/.test(lt));
	t.note('v99 asymmetry + type key, or v103 symmetry + shard key - either pairing works, neither half alone');
} },

{ name: 'applyTerminal: a boss that stopped existing stops being a candidate', fn(t) {
	/* SCAN_STALE_MS is a const with a non-brace initialiser, so lift() cannot
	   brace-match it; supplied to the world the same way HOP_ATTEMPT_CAP is. */
	function withScan(entries) {
		const w = ranger({ SCAN_STALE_MS: 5 * 60 * 1000 });
		w.bossHop.scanResults = entries;
		w.bossHop.currentShard = () => 'USI';
		w.bossHop.maxHpOf = () => 960000;
		return w;
	}
	const NOW = Date.now();
	const liveRow = () => ({
		shard: 'USII', mtype: 'crabxx', live: true,
		hp: 960000, maxHp: 960000, spawnTime: null, at: NOW - 60000,
	});

	/* 1. THE CASE THE DEFECT IS ABOUT. The entry is fresh enough that
	   SCAN_STALE_MS does not touch it, so before this change it stayed the
	   picker's best candidate - a frozen hp is an hp that never falls. */
	let w = withScan([liveRow()]);
	t.eq('a fresh live entry IS a candidate to begin with',
		w.bossHop.candidates().map((c) => c.mtype), ['crabxx']);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a death clears the live claim', w.bossHop.scanResults[0].live, false);
	t.eq('and the entry drops out of candidates() entirely',
		w.bossHop.candidates().length, 0);
	t.note('closes a 300s window (SCAN_STALE_MS) to about 75s - one 45s bridge poll plus one 30s fetch');

	/* 2. THE OLD-BRIDGE HAZARD. `terminal=1` is a query parameter; the
	   handler reads the params it knows and ignores an unknown one in
	   silence, so a bridge deployed before it answers with spawns mixed in.
	   If the ev check were not in applyTerminal this would pass degenerately
	   - the server filter would have removed the row before it arrived. */
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'spawn', type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a SPAWN never clears anything - the ev check is the authority',
		w.bossHop.scanResults[0].live, true);

	/* 3. ALL THREE terminal values, pinned so the set is the MEANING and not
	   an accident of which rows the log happened to hold. `lost` is in it
	   because neither of its two causes - an instance id that changed, or a
	   shard that stopped being listable - is a boss worth planning a trip
	   towards, so its ambiguity need not be resolved to classify it. */
	for (const ev of ['death', 'despawn', 'lost']) {
		const h = withScan([liveRow()]);
		h.bossHop.applyTerminal({ ev, type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
		t.eq('terminal: ' + ev, h.bossHop.scanResults[0].live, false);
	}
	t.note('measured 2026-10-20 over 2,499 retained events: death 1116, despawn 15, lost 120, spawn 1248');
	t.note('so ev=despawn alone would have covered 15 of 1,251 terminal events - 1.2%');

	/* 4. THE ORDERING GUARD, which is also what makes the cold start safe:
	   the first fetch has no cursor and replays the whole retained log, and
	   every historical row predates the push that created the entry. */
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: new Date(NOW - 600000).toISOString() });
	t.eq('an event OLDER than the push does not clear - server_info wins',
		w.bossHop.scanResults[0].live, true);
	t.note('server_info is the direct feed; the bridge is a derivative running up to 45s behind it');

	/* 5. SHARD NORMALISATION. The log writes "US II"; scanResults builds its
	   shard as region + name with no separator. An unnormalised compare
	   matches nothing, and matching nothing is indistinguishable from no boss
	   ever having died - so this asserts the match, not just the mismatch. */
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'USII', t: new Date(NOW).toISOString() });
	t.eq('an already-joined shard string still matches', w.bossHop.scanResults[0].live, false);
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'EU II', t: new Date(NOW).toISOString() });
	t.eq('a DIFFERENT shard is left alone', w.bossHop.scanResults[0].live, true);
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'franky', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a different boss on the right shard is left alone', w.bossHop.scanResults[0].live, true);

	/* 6. A PENDING entry - live false with a spawnTime - is the pre-spawn
	   candidate the hop wants, and must not be collateral damage. */
	w = withScan([{ shard: 'USII', mtype: 'crabxx', live: false, hp: null,
		maxHp: 960000, spawnTime: NOW + 60000, at: NOW - 60000 }]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a pending respawn entry keeps its spawnTime',
		w.bossHop.scanResults[0].spawnTime, NOW + 60000);
	/* And is not STAMPED. The `live !== true` early-out is not a safety guard
	   - nothing downstream reads clearedBy - so asserting on behaviour here
	   would be degenerate: removing the check changes no outcome, because the
	   pre-spawn path reads spawnTime and this path never writes it. What the
	   check buys is that clearedBy means "a live claim was cleared HERE" and
	   not "a terminal event once went past", which is the difference between
	   a usable diagnostic and a misleading one. */
	t.eq('and is not stamped as cleared - clearedBy marks a cleared LIVE claim',
		w.bossHop.scanResults[0].clearedBy, undefined);

	/* 7. Garbage in from a bridge mid-upgrade must not throw: applyTerminal
	   runs inside a for loop in the fetch handler, so one bad row would cost
	   every row after it. */
	w = withScan([liveRow()]);
	for (const bad of [null, {}, { ev: 'death' }, { ev: 'death', type: 'crabxx' },
			{ ev: 'death', type: 'crabxx', server: 'US II' },
			{ ev: 'death', type: 'crabxx', server: 'US II', t: 'not a date' }]) {
		w.bossHop.applyTerminal(bad);
	}
	t.eq('no malformed row clears anything, and none throws',
		w.bossHop.scanResults[0].live, true);
} },

{ name: 'refreshTerminal: the cursor is the server clock and only moves on success', fn(t) {
	const { extract } = require('./lift');
	const rt = extract(RANGER, 'bossHop');
	const body = rt.slice(rt.indexOf('\trefreshTerminal() {'), rt.indexOf('\tapplyTerminal(e) {'));

	t.ok('asks for terminal rows only', /terminal=1/.test(body));
	t.ok('and carries the cursor as `since` when it has one',
		/since=' \+ encodeURIComponent\(this\.termCursor\)/.test(body));
	/* The cursor must be the ANSWER's clock. A local Date.now() even a few
	   seconds fast would skip rows the script never saw, and they are gone
	   for good - the query is strictly-after. */
	t.ok('advances the cursor to the answer\'s own now', /this\.termCursor = j\.now/.test(body));
	t.eq('and never to a local clock', /termCursor = Date\.now/.test(body), false);

	/* The failure arm must NOT advance it: holding it back re-reads a few
	   rows, which applyTerminal is idempotent about, while advancing past a
	   failed fetch drops those events permanently. */
	const arms = body.split('}, (e) => {');
	t.eq('the fetch has a rejection arm', arms.length, 2);
	t.eq('which does not touch the cursor', /termCursor/.test(arms[1]), false);
	t.ok('and records the error rather than swallowing it', /termErr = String\(e\)/.test(arms[1]));

	/* Both feeds have to run on the one timer, or the invalidation silently
	   stops happening the moment someone edits the other one. */
	const w = ranger();
	const scan = extract(RANGER, 'bossHop');
	const start = scan.slice(scan.indexOf('\tstartScanning() {'), scan.indexOf('\trecord(entry) {'));
	t.ok('refreshTerminal is wired into the same 30s interval as refreshBridge',
		/setInterval\(\(\) => \{ this\.refreshBridge\(\); this\.refreshTerminal\(\); \}, 30000\)/.test(start));
	t.ok('and is called once up front', /\n\t\tthis\.refreshTerminal\(\);\n/.test(start));
	t.eq('state starts with no cursor, so the first fetch pulls the whole log',
		w.bossHop.termCursor, null);
} },

{ name: 'applyTerminal orders against the OBSERVATION, not the death estimate', fn(t) {
	const NOW = Date.now();
	function w1(at) {
		const w = ranger({ SCAN_STALE_MS: 5 * 60 * 1000 });
		w.bossHop.scanResults = [{ shard: 'USII', mtype: 'crabxx', live: true,
			hp: 960000, maxHp: 960000, spawnTime: null, at }];
		w.bossHop.currentShard = () => 'USI';
		w.bossHop.maxHpOf = () => 960000;
		return w;
	}
	const iso = (ms) => new Date(ms).toISOString();

	/* THE REGRESSION. A death row's `t` is a reconstruction - two of its three
	   forms are (last_alive_t + poll_t)/2 - while death_hi is iso(poll_t), the
	   poll that proved the boss gone. An event boss's server_info key vanishes
	   AT the death, so `at` lands there, which is AFTER the midpoint whenever
	   the true death fell in the later half of the bracket. v100 compared
	   against `t` and discarded those terminals; nothing arrives afterwards to
	   correct it, because the key is gone. */
	let w = w1(NOW - 60000);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: iso(NOW - 120000), death_hi: iso(NOW) });
	t.eq('a death whose MIDPOINT predates the push still clears, because death_hi does not',
		w.bossHop.scanResults[0].live, false);
	t.note('v100 returned early here; by METHOD, all 238 absent_on_responding_server rows carry the midpoint, 174 of them over 30s');

	/* The guard is not disabled, only re-anchored: an observation genuinely
	   older than the push is still a previous instance and still loses. */
	w = w1(NOW);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: iso(NOW - 600000), death_hi: iso(NOW - 300000) });
	t.eq('an observation older than the push does NOT clear', w.bossHop.scanResults[0].live, true);

	/* despawn and lost carry no death_hi, and their `t` IS the detection time,
	   so the fallback is the correct reading rather than a concession. Both
	   directions, or the fallback could be ignoring t entirely. */
	for (const ev of ['despawn', 'lost']) {
		let h = w1(NOW - 60000);
		h.bossHop.applyTerminal({ ev, type: 'crabxx', server: 'US II', t: iso(NOW) });
		t.eq(ev + ' with no death_hi clears on its own t', h.bossHop.scanResults[0].live, false);
		h = w1(NOW);
		h.bossHop.applyTerminal({ ev, type: 'crabxx', server: 'US II', t: iso(NOW - 600000) });
		t.eq(ev + ' older than the push still does not clear', h.bossHop.scanResults[0].live, true);
	}

	/* A malformed death_hi must fall back to t rather than drop a real
	   terminal - `Date.parse(e.death_hi || e.t)` would return NaN here and
	   bail, losing the row silently. */
	w = w1(NOW - 60000);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: iso(NOW), death_hi: 'not a date' });
	t.eq('a malformed death_hi falls back to t instead of dropping the row',
		w.bossHop.scanResults[0].live, false);

	/* Both unusable: still no throw, still no clear. */
	w = w1(NOW - 60000);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: 'rubbish', death_hi: 'rubbish' });
	t.eq('both timestamps unusable leaves the entry alone', w.bossHop.scanResults[0].live, true);

	/* THE COLD START IS STILL SAFE. death_hi on a historical row is in the
	   past too, so replaying the whole retained log clears nothing live. The
	   2,290s bracket below is deliberately WIDER than anything the affected
	   population produces - the real max on absent_on_responding_server rows
	   is 348s - because the point is to stress the guard, not to model it. */
	w = w1(NOW);
	for (let d = 1; d <= 50; d++) {
		w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
			t: iso(NOW - d * 3600000), death_hi: iso(NOW - d * 3600000 + 2290000) });
	}
	t.eq('50 historical rows at a deliberately over-wide bracket, still clear nothing',
		w.bossHop.scanResults[0].live, true);
} },

{ name: 'the cooldown is keyed (type, shard), which is what lets the party fight on arrival', fn(t) {
	const CD = 30 * 60 * 1000;
	function w1(shard) {
		const w = world({
			BOSS_TYPE_GIVEUP_MAX: 2,
			parent: { server_region: shard.slice(0, 2), server_identifier: shard.slice(2) },
			character: { name: 'Dexon', rip: false },
		});
		lift(w, RANGER, ['bossState', 'bossShard', 'bossCooldownKey', 'bossCooledDown',
			'bossClearCooldown', 'bossEligible', 'bossGenerationEnd', 'bossEnd']);
		/* No bridge row by default, so every assertion above this block reads
		   the cooldownMs fallback and the generation-end tests opt in. */
		w.bossHop = { bridgeRow: () => null };
		w.CONFIG = { bossEvents: { enabled: true, exclude: new Set(), include: [],
			cooperativeOnly: false, cooldownMs: CD } };
		w.bossCooperative = () => true;
		w.bossSave = () => { };
		w.bossLog = () => { };
		w.bossIsLeader = () => false;
		w.bossBroadcast = () => { };
		return w;
	}

	/* THE MEASURED NIGHT. Give up on US II franky at the trip cap, then ask
	   whether franky is takeable on US V. Under the type-keyed cooldown
	   bossEligible said no on every shard - and bossEligible is what bossPick
	   consults, which is what shouldHandleEvents needs, which is what makes the
	   party APPROACH and attack. So v99 hopped to US V and then farmed ordinary
	   mobs beside the franky it had travelled for. */
	let w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('the give-up cools the shard it happened on',
		w.bossCooledDown('franky', 'USII'), true);
	t.eq('and NOT the same boss elsewhere', w.bossCooledDown('franky', 'USV'), false);
	t.eq('so bossEligible refuses here', w.bossEligible('franky', 'USII').ok, false);
	t.eq('and allows there - the half v99 was missing',
		w.bossEligible('franky', 'USV').ok, true);
	t.note('bossEligible -> bossPick -> shouldHandleEvents is what authorises the approach; bossHop arrival alone never did');

	/* The trip's OWN shard is used, not wherever we stand when the budget runs
	   out - otherwise a give-up after any movement is attributed to the wrong
	   shard and cools an instance nobody fought. */
	w = w1('EUIII');
	w.bossState.trip = { name: 'crabxx', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('the cooldown lands on the trip shard', w.bossCooledDown('crabxx', 'USII'), true);
	t.eq('not on the shard we ended up on', w.bossCooledDown('crabxx', 'EUIII'), false);

	/* AN EVENT THAT ENDED ON ITS OWN IS NOT A GIVE-UP, unchanged from before -
	   only 'death', 'cap' and 'by hand' count. */
	w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1000, deaths: 0 };
	w.bossEnd('nothing eligible is live');
	t.eq('a boss that died or despawned cools nothing',
		w.bossCooledDown('franky', 'USII'), false);

	/* THE TYPE-LEVEL BACKSTOP counts distinct SHARDS, not attempts, so a boss
	   that is too strong everywhere is not walked across five shards in turn. */
	w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('one shard does not trip it', w.bossCooledDown('franky', 'ASIAI'), false);
	w.bossState.trip = { name: 'franky', shard: 'USV', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('the second DISTINCT shard cools the type everywhere',
		w.bossCooledDown('franky', 'ASIAI'), true);
	t.ok('and says so, so the log distinguishes "try elsewhere" from "out of reach"',
		/EVERYWHERE/.test(w.bossEligible('franky', 'ASIAI').why));

	/* Twice on the SAME shard says nothing new about the other four, so it must
	   not trip the backstop - this is the assertion that makes "distinct
	   shards" the meaning rather than an accident of the counter. */
	w = w1('USII');
	for (let i = 0; i < 3; i++) {
		w.bossState.trip = { name: 'crabxx', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
		w.bossEnd('trip cap of 20 min');
	}
	t.eq('three give-ups on ONE shard leave the type alone',
		w.bossCooledDown('crabxx', 'USV'), false);

	/* Clearing is by TYPE and must take the shard keys with it, or an operator
	   calling the party to a boss is refused by an entry they cannot see. */
	w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	w.bossClearCooldown('franky');
	t.eq('bossClearCooldown clears the shard entry', w.bossCooledDown('franky', 'USII'), false);
	w = w1('USII');
	w.bossState.cooldown.franky = Date.now() + CD;
	w.bossClearCooldown('franky');
	t.eq('and the type entry', w.bossCooledDown('franky', 'USII'), false);

	/* MIGRATION. A map persisted before v103 holds bare type keys. They read as
	   type backstops, which is over-restrictive for at most one cooldown and
	   never permissive - the safe direction, and the reason no migration step
	   is needed. */
	w = w1('USII');
	w.bossState.cooldown = { franky: Date.now() + CD };
	t.eq('a pre-v103 bare key still forbids the type everywhere',
		w.bossCooledDown('franky', 'ASIAI'), true);
	t.note('fails safe rather than permissive, so the persisted map needs no migration');
} },

{ name: 'the cooldown runs to the end of the GENERATION, not a fixed 30 minutes', fn(t) {
	const CD = 30 * 60 * 1000;
	function w1(row) {
		const w = world({
			BOSS_TYPE_GIVEUP_MAX: 2,
			parent: { server_region: 'US', server_identifier: 'II' },
			character: { name: 'Dexon', rip: false },
		});
		lift(w, RANGER, ['bossState', 'bossShard', 'bossCooldownKey', 'bossCooledDown',
			'bossClearCooldown', 'bossEligible', 'bossGenerationEnd', 'bossEnd']);
		w.CONFIG = { bossEvents: { enabled: true, exclude: new Set(), include: [],
			cooperativeOnly: false, cooldownMs: CD } };
		w.bossCooperative = () => true;
		w.bossSave = () => { };
		w.bossLog = () => { };
		w.bossIsLeader = () => false;
		w.bossBroadcast = () => { };
		w.bossHop = { bridgeRow: () => row };
		return w;
	}
	const giveUp = (w, name, shard) => {
		w.bossState.trip = { name, shard, startedAt: Date.now() - 1200000, deaths: 0 };
		w.bossEnd('trip cap of 20 min');
	};
	const leftMin = (w, key) => Math.round((w.bossState.cooldown[key] - Date.now()) / 60000);

	/* NO CONSTANT IS RIGHT, which is why the field exists. A 30-minute cooldown
	   against a 2400s window expires INSIDE the window for a give-up in the
	   first ten minutes and runs PAST the next window's open for one in the
	   last ten - mistimed in opposite directions at the two ends. */
	let w = w1({ hasWindow: true, windowEndsAt: Date.now() + 8 * 60000, estimatedRespawn: null });
	giveUp(w, 'franky', 'USII');
	t.eq('an event boss cools only to its window end', leftMin(w, 'franky|USII'), 8);
	t.note('30 min here would have expired 22 min into the NEXT window, suppressing a fresh generation');

	/* And the type-level backstop uses the same end, because an event boss's
	   generation IS type-wide - every shard spawns on the scheduled hour. */
	w = w1({ hasWindow: true, windowEndsAt: Date.now() + 8 * 60000, estimatedRespawn: null });
	giveUp(w, 'franky', 'USII');
	giveUp(w, 'franky', 'USV');
	t.eq('the backstop too, for an event boss', leftMin(w, 'franky'), 8);

	/* A RESPAWN BOSS IS THE CASE THE OTHER SESSION GOT WRONG. estimated_respawn
	   is right for THIS shard's instance and says nothing about the others,
	   because each shard's timer runs independently - so there is no type-wide
	   generation and the backstop has nothing to align to. */
	w = w1({ hasWindow: false, windowEndsAt: null, estimatedRespawn: Date.now() + 95 * 60000 });
	giveUp(w, 'dragold', 'USII');
	t.eq('a respawn boss cools its SHARD to its own respawn', leftMin(w, 'dragold|USII'), 95);
	giveUp(w, 'dragold', 'USV');
	t.eq('but the backstop keeps the constant - no type-wide generation exists',
		leftMin(w, 'dragold'), 30);
	t.note('using estimated_respawn there would suppress every shard on one shard\'s timer');

	/* NULL IS NOT ABSENT. An event boss the bridge found already up sends
	   window_ends_at as null, and inventing a deadline from that would be
	   worse than falling back. */
	w = w1({ hasWindow: true, windowEndsAt: null, estimatedRespawn: null });
	giveUp(w, 'crabxx', 'USII');
	t.eq('an event boss with an unknown window falls back to the constant',
		leftMin(w, 'crabxx|USII'), 30);

	/* A window end already past, and no bridge row at all: both fall back
	   rather than producing a zero or negative cooldown. */
	w = w1({ hasWindow: true, windowEndsAt: Date.now() - 60000, estimatedRespawn: null });
	giveUp(w, 'crabxx', 'USII');
	t.eq('a window end in the past falls back', leftMin(w, 'crabxx|USII'), 30);
	w = w1(null);
	giveUp(w, 'crabxx', 'USII');
	t.eq('no bridge row falls back', leftMin(w, 'crabxx|USII'), 30);

	/* The three-state read itself, at the helper. */
	w = w1({ hasWindow: true, windowEndsAt: 123456, estimatedRespawn: 999 });
	t.eq('hasWindow -> type-wide', w.bossGenerationEnd('franky', 'USII'),
		{ at: 123456, typeWide: true });
	w = w1({ hasWindow: false, windowEndsAt: null, estimatedRespawn: 999 });
	t.eq('absent window -> per-shard only', w.bossGenerationEnd('dragold', 'USII'),
		{ at: 999, typeWide: false });
	w = w1(null);
	t.eq('no row -> nothing known', w.bossGenerationEnd('franky', 'USII'),
		{ at: null, typeWide: false });
} },

{ name: 'an event that spawns two monster types is found by either of them', fn(t) {
	function w1(mons, G) {
		const w = world({
			character: { name: 'Dexon', x: 0, y: 0 },
			parent: { G: G || { monsters: { rgoo: { cooperative: true }, bgoo: { cooperative: true } } } },
			get_nearest_monster: (q) => mons[q.type] || null,
		});
		lift(w, RANGER, ['BOSS_FIGHT_TYPES', 'bossMonsterTypes', 'bossNearestMonster',
			'bossCooperative']);
		return w;
	}

	let w = w1({});
	t.eq('goobrawl maps to BOTH products', w.bossMonsterTypes('goobrawl'), ['rgoo', 'bgoo']);
	t.eq('and anything else maps to itself', w.bossMonsterTypes('franky'), ['franky']);

	/* THE DEFECT. bossApproach asked for rgoo only, so a goobrawl showing just
	   bgoo returned null - and because goobrawl is not walkable the
	   fall-through re-emitted the join while a live goo stood beside us. */
	w = w1({ bgoo: { id: 'b', x: 10, y: 0 } });
	t.eq('a bgoo-only goobrawl is found', w.bossNearestMonster('goobrawl').id, 'b');
	t.note('the rgoo-only mapping returned null here, and goobrawl is not walkable');
	w = w1({ rgoo: { id: 'r', x: 10, y: 0 } });
	t.eq('an rgoo-only goobrawl is still found', w.bossNearestMonster('goobrawl').id, 'r');

	/* NEAREST, not first-found: posturing against the far one walks past the
	   near one. Asserted in BOTH orders so the result cannot come from the
	   iteration order of BOSS_FIGHT_TYPES. */
	w = w1({ rgoo: { id: 'r', x: 500, y: 0 }, bgoo: { id: 'b', x: 10, y: 0 } });
	t.eq('the nearer type wins when both are up', w.bossNearestMonster('goobrawl').id, 'b');
	w = w1({ rgoo: { id: 'r', x: 10, y: 0 }, bgoo: { id: 'b', x: 500, y: 0 } });
	t.eq('and in the other order too', w.bossNearestMonster('goobrawl').id, 'r');

	w = w1({});
	t.eq('nothing up answers null, as the single-type form did',
		w.bossNearestMonster('goobrawl'), null);
	w = w1({ franky: { id: 'f', x: 5, y: 5 } });
	t.eq('a single-type boss is unaffected', w.bossNearestMonster('franky').id, 'f');

	/* bossCooperative was SAFE either way - both types are cooperative live -
	   so this is about robustness, not a live defect: reading only the first
	   answers false if G does not carry it, and false removes the boss. */
	w = w1({}, { monsters: { bgoo: { cooperative: true } } });
	t.eq('cooperative is true when only the SECOND type carries it',
		w.bossCooperative('goobrawl'), true);
	w = w1({}, { monsters: { rgoo: { cooperative: true } } });
	t.eq('and when only the first does', w.bossCooperative('goobrawl'), true);
	w = w1({}, { monsters: { rgoo: {}, bgoo: {} } });
	t.eq('false when neither does', w.bossCooperative('goobrawl'), false);
	w = w1({}, { monsters: {} });
	t.eq('and when G carries neither', w.bossCooperative('goobrawl'), false);
	w = w1({}, {});
	t.eq('a G with no monsters table does not throw', w.bossCooperative('goobrawl'), false);
} },

];
