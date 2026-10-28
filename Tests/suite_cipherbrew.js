/* Tests/suite_cipherbrew.js - Meltymerch brewing the Witch's Cipher.

   Operator's rulings 2026-10-25 09:18-09:21 EDT, on the browser session's spec
   of 09:28 EDT. The mechanics are read from upstream 16881a2
   node/logic/witch_cipher.js; `fit` is live-only and its decoding was verified
   by the browser session against US II's 11:00Z board that morning, which is
   the fixture the first test pins.

   -> CLAUDE.md "Selling, banking and what must never be vendored"
   -> Party/Merchant.js "WITCH'S CIPHER - BREWING" */
const fs = require('fs');
const path = require('path');
const { lift, world, ROOT } = require('./lift');

const MERCHANT = 'Party/Merchant.js';
const SRC = fs.readFileSync(path.join(ROOT, MERCHANT), 'utf8');
const NAMES = ['verdantspore', 'frostscale', 'embercoal', 'gloomfeather'];
const H = 3600e3;
/* 2026-10-25 11:00Z, the day's first US/ASIA round. */
const R11 = Date.parse('2026-10-25T11:00:00Z');
const R23 = Date.parse('2026-10-25T23:00:00Z');
const CFG = { enabled: true, threshold: 8, regions: ['US', 'ASIA'], roundHours: [11, 23], prefer: 'USII',
	spendLastMs: 6 * 60e3, floorAfterCrack: 25, reach: 300, tickMs: 2000, liveEveryMs: 5000, moveMs: 120000, answerMs: 10000 };

function fitOf(set, total) {
	const chars = [];
	for (let h = 0; h < total / 4; h++) {
		let v = 0;
		for (let b = 0; b < 4; b++) if (set.has(4 * h + b)) v |= (1 << b);
		chars.push(v.toString(16));
	}
	return chars.join('');
}

function mk(over = {}) {
	const posts = [];
	const w = world(Object.assign({
		character: { name: 'Meltymerch', map: 'halloween', x: 858, y: -120, items: [] },
		CONFIG: { cipherBrew: Object.assign({}, CFG) },
		CIPHER_SPLIT_MAX: 128,
		CIPHER_PLAN_KEY: 'cipher_brew_plan', CIPHER_DAY_KEY: 'cipher_brew_day', CIPHER_WATCH_KEY: 'cipher_brew_watch',
		cipherBusy: false, cipherPlan: null, cipherLive: { at: 0, shards: {} }, cipherLast: null,
		cipherPending: null, cipherLastPick: null, cipherAwaitBoard: null, cipherWaitWhy: null, cipherHeldSeen: null,
		cipherTickTimer: null, cipherTickRunning: false, cipherKickPending: false, cipherLiveHooked: false,
		cipherSaid: {}, cipherAnswers: {},
		state: { busy: false, queue: [] }, ARB: { cur: null, busy: false }, PROBE: { hold: false }, totBusy: false,
		moveLockHeld: () => false,
		SHARD_REGIONS: ['ASIA', 'US', 'EU'],
		parent: { server_region: 'US', server_identifier: 'II', S: {}, G: { events: { witchcipher: { slots: 5, mixes: 5,
			ingredients: NAMES.map((n) => [n, []]) } }, quests: { witch: { map: 'halloween', x: 858, y: -160 } } } },
		scoutFetch: (p, o) => { posts.push([p, o && o.body ? JSON.parse(o.body) : null]); return Promise.resolve({}); },
	}, over));
	w.posts = posts;
	lift(w, MERCHANT, ['cipherLog', 'cipherSay', 'cipherRules', 'cipherSlots', 'cipherKey', 'cipherBridgeName',
		'cipherFitSet', 'cipherRecipe', 'cipherScore', 'cipherBoardCandidates', 'cipherHave', 'cipherCanMake', 'cipherMakeable',
		'cipherPick', 'cipherIsLastRound', 'cipherDecide', 'cipherDayLoad', 'cipherDaySave', 'cipherPlanSave',
		'cipherRestore', 'cipherHoldBlocked', 'cipherTakeHold', 'cipherRelease', 'cipherShardsNow', 'cipherPost',
		'cipherSlowCheck', 'cipherWatchNote', 'cipherBrewNext', 'cipherIngredientNames', 'mShardKey', 'mParseShard',
		'cipherHeldLine', 'cipherKickWanted', 'cipherKick', 'cipherLiveHook']);
	return w;
}
const posted = (w, kind) => w.posts.filter((p) => p[0] === '/cipher' && p[1] && p[1].kind === kind).map((p) => p[1]);
const round = (id, start, over = {}) => Object.assign({ id, live: true, start, end: start + 28 * 60e3, possible: 40 }, over);

module.exports = [
{ name: 'fit decodes LSB-first into recipe numbers, as measured on US II', fn(t) {
	const w = mk();
	/* The browser session's 11:00Z fixture: the board's brute-force candidates
	   were {183, 379, 951}, all bit 3 of their hex character - which is what
	   makes this fixture discriminate the bit order. */
	const fit = '0'.repeat(256).split('');
	for (const h of [45, 94, 237]) fit[h] = '8';
	const got = w.cipherFitSet(fit.join(''), 1024);
	t.eq('the measured candidates', got, [183, 379, 951]);
	const msb = [];
	fit.forEach((c, h) => { const v = parseInt(c, 16); for (let b = 0; b < 4; b++) if (v & (8 >> b)) msb.push(4 * h + b); });
	t.eq('precondition: MSB-first reads the same string as the wrong set', msb, [180, 376, 948]);
	t.eq('recipe 183 is slot i = names[floor(n / 4^i) % 4]', w.cipherRecipe(183, NAMES, 5),
		['gloomfeather', 'frostscale', 'gloomfeather', 'embercoal', 'verdantspore']);
	t.eq('a short string is no map', w.cipherFitSet('ff', 1024), null);
	t.eq('nor is a non-hex one', w.cipherFitSet('z'.repeat(256), 1024), null);
	t.eq('nor a missing one', w.cipherFitSet(undefined, 1024), null);
	/* Round trip against the board: a fit built from board candidates decodes
	   back to them, so the two sources agree where both exist. */
	const secret = w.cipherRecipe(700, NAMES, 5);
	const board = [w.cipherRecipe(3, NAMES, 5), w.cipherRecipe(512, NAMES, 5), w.cipherRecipe(77, NAMES, 5)]
		.map((m) => ({ mix: m, right: w.cipherScore(secret, m) }));
	const fromBoard = w.cipherBoardCandidates({ board, mixes: 3 }, NAMES, 5);
	t.ok('precondition: the secret is a board candidate', fromBoard.indexOf(700) >= 0);
	t.eq('fit and board agree', w.cipherFitSet(fitOf(new Set(fromBoard), 1024), 1024), fromBoard);
	t.eq('a board shorter than the history is not trusted', w.cipherBoardCandidates({ board, mixes: 31 }, NAMES, 5), null);
} },

{ name: 'the next mix fits, is new, can be made, and splits the candidates best', fn(t) {
	const w = mk();
	const all = {}; NAMES.forEach((n) => { all[n] = 99; });
	const cands = [5, 21, 183, 379, 951, 1000];
	const recs = cands.map((n) => w.cipherRecipe(n, NAMES, 5));
	const p = w.cipherPick(cands, NAMES, 5, all, new Set());
	const cost = (g) => { const b = {}; recs.forEach((c) => { const k = w.cipherScore(g, c); b[k] = (b[k] || 0) + 1; }); return Object.values(b).reduce((a, x) => a + x * x, 0); };
	const best = Math.min.apply(null, recs.map(cost));
	t.eq('it is a candidate', cands.indexOf(p.n) >= 0, true);
	t.eq('with the least expected candidates left', p.cost, best);
	t.eq('lowest number on a tie', p.n, cands.find((n, i) => cost(recs[i]) === best));
	const tried = new Set([p.r.join(',')]);
	t.ok('a mix already on the board is never sent again', w.cipherPick(cands, NAMES, 5, all, tried).n !== p.n);
	const onlyVerdant = { verdantspore: 5 };
	t.eq('nothing makeable from the bag -> null', w.cipherPick([183], NAMES, 5, onlyVerdant, new Set()), null);
	t.eq('a recipe needing five of one name needs five', w.cipherCanMake(w.cipherRecipe(0, NAMES, 5), { verdantspore: 4 }), false);
	t.eq('and five will do', w.cipherCanMake(w.cipherRecipe(0, NAMES, 5), { verdantspore: 5 }), true);
	const many = Array.from({ length: 300 }, (_, i) => i);
	t.eq('above CIPHER_SPLIT_MAX the first makeable recipe will do', w.cipherPick(many, NAMES, 5, all, new Set()).n, 0);
	t.ok('CIPHER_SPLIT_MAX as supplied', /^const CIPHER_SPLIT_MAX = 128;/m.test(SRC));
	w.character.items = [{ name: 'verdantspore', q: 5, l: 'l' }, { name: 'frostscale', q: 2 }];
	t.eq('a locked stack is not counted - the server will not consume it', w.cipherHave(), { frostscale: 2 });
} },

{ name: 'when to brew: the threshold, the first and last rounds, the lock', fn(t) {
	const w = mk();
	const d = (shards, day = {}, now = R11 + 5 * 60e3, plan = null) =>
		w.cipherDecide({ now, cfg: CFG, day: Object.assign({ mixesLeft: 5 }, day), shards, plan });
	t.eq('disabled', w.cipherDecide({ now: R11, cfg: Object.assign({}, CFG, { enabled: false }), day: {}, shards: {} }).act, 'idle');
	t.eq('no live round', d({}).act, 'idle');
	t.eq('no mixes left', d({ USII: round('a', R11, { possible: 3 }) }, { mixesLeft: 0 }).act, 'idle');
	t.eq('locked elsewhere', d({ USII: round('a', R11, { possible: 3 }) }, { elsewhere: 'EUI' }).act, 'idle');
	t.eq('an EU round is not ours', d({ EUI: round('e', R11, { possible: 3 }) }).act, 'idle');
	t.eq('a round from yesterday is not today\'s', d({ USII: round('y', R11 - 24 * H, { end: R11 + 60e3, possible: 3 }) }).act, 'idle');
	t.eq('a wide board in the first round: watch', d({ USII: round('a', R11, { possible: 40 }) }).act, 'watch');
	const narrow = d({ USII: round('a', R11, { possible: 40 }), USIII: round('b', R11, { possible: 6 }), ASIAI: round('c', R11, { possible: 7 }) });
	t.eq('a board at the threshold: brew', narrow.act, 'brew');
	t.eq('on the narrowest board', narrow.shard, 'USIII');
	t.eq('a board AT the threshold is brewed', d({ USII: round('a', R11, { possible: 8 }) }).act, 'brew');
	t.eq('one over it is not', d({ USII: round('a', R11, { possible: 9 }) }).act, 'watch');
	t.eq('a tie goes to US II', d({ USIII: round('b', R11, { possible: 6 }), USII: round('a', R11, { possible: 6 }) }).shard, 'USII');
	t.eq('the day\'s last round, wide board: hold at the Witch', d({ USII: round('a', R23, { possible: 900 }) }, {}, R23 + 60e3).act, 'hold');
	t.eq('and spend once little is left', d({ USII: round('a', R23, { possible: 900 }) }, {}, R23 + 23 * 60e3).act, 'brew');
	t.eq('the 50 won: spend the rest on any board', d({ USII: round('a', R11, { possible: 1024 }) }, { crackedToday: true }).act, 'brew');
	const locked = d({ USII: round('a', R11, { possible: 40 }), USIII: round('b', R11, { possible: 2 }) }, { lockedShard: 'USII' });
	t.eq('after the first mix only the locked shard counts', [locked.shard, locked.act], ['USII', 'watch']);
	const plan = { shard: 'USII' };
	t.eq('a held plan stays put on a wider board', d({ USII: round('a', R11, { possible: 7 }), USIII: round('b', R11, { possible: 2 }) }, {}, undefined, plan).shard, 'USII');
	t.eq('a held plan moves when its board is wide and another is narrow', d({ USII: round('a', R11, { possible: 40 }), USIII: round('b', R11, { possible: 2 }) }, {}, undefined, plan).shard, 'USIII');
	t.eq('a held plan on a wide board with nothing narrow: hold', d({ USII: round('a', R11, { possible: 40 }) }, {}, undefined, plan).act, 'hold');
	t.eq('a round past its end is over', d({ USII: round('a', R11, { possible: 3 }) }, {}, R11 + 29 * 60e3).act, 'idle');
} },

{ name: 'the hold: arbitrage first, then everything waits, and only the round\'s shard is hopped to', fn(t) {
	let w = mk({ ARB: { cur: { item: 'x' }, busy: false } });
	t.eq('a trade under way is finished first', w.cipherTakeHold({ shard: 'USII', round: 'a', end: R11 + 1e6, why: 'x' }), false);
	t.eq('and nothing is held meanwhile', [w.cipherBusy, w.state.busy], [false, false]);
	w = mk({ state: { busy: true, queue: [] } });
	t.eq('other merchant work is waited for too', w.cipherTakeHold({ shard: 'USII', round: 'a', end: R11 + 1e6, why: 'x' }), false);
	w = mk();
	t.eq('free: the hold is taken', w.cipherTakeHold({ shard: 'USII', round: 'a', end: Date.now() + 1e6, why: 'x' }), true);
	t.eq('cipherBusy and state.busy both', [w.cipherBusy, w.state.busy], [true, true]);
	t.eq('and the plan is stored for a reload', w.store.cipher_brew_plan && w.store.cipher_brew_plan.shard, 'USII');
	const r = mk({ store: { cipher_brew_plan: { shard: 'ASIAI', round: 'r', end: Date.now() + 1e6 } } });
	r.cipherRestore();
	t.eq('a reload takes the hold straight back', [r.cipherBusy, r.state.busy, r.cipherPlan.shard], [true, true, 'ASIAI']);
	const x = mk({ store: { cipher_brew_plan: { shard: 'ASIAI', round: 'r', end: Date.now() - 1 } } });
	x.cipherRestore();
	t.eq('a plan for a round already over is dropped', [x.cipherBusy, x.store.cipher_brew_plan], [false, null]);
	w.cipherRelease('done');
	t.eq('release frees both and clears the plan', [w.cipherBusy, w.state.busy, w.store.cipher_brew_plan], [false, false, null]);
	/* mHopTo is the one door every hop goes through. */
	const hops = [];
	const h = world({ cipherBusy: true, cipherPlan: { shard: 'USIII' }, parent: { server_region: 'US', server_identifier: 'II' },
		SHARD_REGIONS: ['ASIA', 'US', 'EU'], CONFIG: { hopTimeoutMs: 5 },
		change_server: (r2, n) => hops.push(r2 + n), ensureStandClosed: async () => {} });
	lift(h, MERCHANT, ['mShardKey', 'mParseShard', 'mCanHop', 'mHopTo']);
	return (async () => {
		t.eq('a hop anywhere else is refused while held', await h.mHopTo('EUI'), false);
		t.eq('without calling change_server', hops, []);
		await h.mHopTo('USIII');
		t.eq('the round\'s own shard is allowed', hops, ['USIII']);
		t.ok('scoutLoop stands down on the hold', /if \(totBusy \|\| cipherBusy\) return setTimeout\(scoutLoop/.test(SRC));
		t.ok('arbLoop stands down on the hold', /CONFIG\.arbitrage\.enabled && !PROBE\.hold && !totBusy && !cipherBusy/.test(SRC));
		t.ok('the hold is restored before the loops start', /\narbRestore\(\);\ncipherRestore\(\);\n/.test(SRC));
		t.ok('and the tick is started', /\nsetTimeout\(cipherTick, 4000\);\n/.test(SRC));
		t.ok('the state is declared ahead of state, so mHopTo never meets the TDZ',
			SRC.indexOf('let cipherBusy = false;') >= 0 && SRC.indexOf('let cipherBusy = false;') < SRC.indexOf('const state = {'));
	})();
} },

{ name: 'a brew: the mix, the answer, the day record, the row', fn(t) {
	const w = mk();
	w.character.items = NAMES.map((n) => ({ name: n, q: 50 }));
	const secret = w.cipherRecipe(379, NAMES, 5);
	const set = new Set([183, 379, 951]);
	w.parent.S.witchcipher = { id: 'USII-r', live: true, start: R11, end: R11 + 28 * 60e3, possible: 3, mixes: 5, cracks: 0,
		board: [], fit: fitOf(set, 1024) };
	const asked = [];
	w.cipherAsk = async (body) => { asked.push(body); return { success: true, mix: body.items, right: w.cipherScore(secret, body.items), fits: true,
		cracked: body.items.join(',') === secret.join(','), parcels: 1, mixes_left: 4 }; };
	const day = w.cipherDayLoad('2026-10-25');
	return (async () => {
		await w.cipherBrewNext({ round: 'USII-r' }, day);
		const sent = asked.length ? asked[0].items : [];
		t.eq('one brew, of a candidate', asked.length === 1 && [183, 379, 951].some((n) => w.cipherRecipe(n, NAMES, 5).join(',') === sent.join(',')), true);
		t.eq('as the brew action', asked[0] && asked[0].action, 'brew');
		t.eq('the day locks to this shard', day.lockedShard, 'USII');
		t.eq('mixes left from the answer', day.mixesLeft, 4);
		t.eq('the mix is remembered for this recipe', day.submitted['USII-r#0'], [sent.join(',')]);
		t.eq('and stored', w.store.cipher_brew_day && w.store.cipher_brew_day.mixesLeft, 4);
		const rows = posted(w, 'mix');
		t.eq('a mix row to the bridge, in its shard form', rows.length === 1 && rows[0].server, 'US II');
		t.eq('the first answer in full', rows[0] && rows[0].first && !!rows[0].response, true);
		t.eq('with the board before it', rows[0] && rows[0].possible_before, 3);
		await w.cipherBrewNext({ round: 'USII-r' }, day);
		t.eq('the next mix waits for the board to show the last one', asked.length, 1);
		w.parent.S.witchcipher.mixes = 6;
		w.parent.S.witchcipher.board = [{ mix: sent, right: w.cipherScore(secret, sent) }];
		await w.cipherBrewNext({ round: 'USII-r' }, day);
		t.eq('then it goes, and is not the same mix', asked.length === 2 && asked[1].items.join(',') !== sent.join(','), true);
		t.eq('only the first answer is logged in full', posted(w, 'mix')[1] && posted(w, 'mix')[1].response, undefined);
		/* Refusals. */
		const f = mk();
		f.character.items = NAMES.map((n) => ({ name: n, q: 50 }));
		f.parent.S.witchcipher = Object.assign({}, w.parent.S.witchcipher, { board: [], mixes: 0 });
		f.cipherAsk = async () => ({ failed: true, reason: 'witchcipher_no_mixes' });
		const fd = f.cipherDayLoad('2026-10-25');
		await f.cipherBrewNext({ round: 'USII-r' }, fd);
		t.eq('no mixes: the day is spent', fd.mixesLeft, 0);
		t.eq('and the refusal is logged with its reason', posted(f, 'mix')[0] && posted(f, 'mix')[0].reason, 'witchcipher_no_mixes');
		f.cipherAsk = async () => ({ failed: true, reason: 'witchcipher_elsewhere', server: 'EUI' });
		const fe = f.cipherDayLoad('2026-10-26');
		await f.cipherBrewNext({ round: 'USII-r' }, fe);
		t.eq('elsewhere: the day is marked locked away', fe.elsewhere, 'EUI');
		const nf = mk();
		nf.parent.S.witchcipher = { id: 'USII-r', live: true, mixes: 40, board: [], cracks: 0 };
		nf.cipherAsk = async () => { throw new Error('should not ask'); };
		await nf.cipherBrewNext({ round: 'USII-r' }, nf.cipherDayLoad('2026-10-25'));
		t.ok('no fit and a truncated board: it does not guess', nf.logs.some((l) => /not guessing/.test(l)));
		const other = mk();
		other.parent.S.witchcipher = { id: 'USII-other', live: true };
		other.cipherAsk = async () => { throw new Error('should not ask'); };
		await other.cipherBrewNext({ round: 'USII-r' }, other.cipherDayLoad('2026-10-25'));
		t.eq('a different round on this shard is not brewed into', posted(other, 'mix').length, 0);
	})();
} },

{ name: 'v137 the shard is chosen by what the bag can make, and after the 50 each mix keeps 25 of what it uses', fn(t) {
	const w = mk();
	t.ok('the committed floor is the ruling', /floorAfterCrack: 25,/.test(SRC));
	/* The 23:00Z 2026-10-25 round: ASIA I down to 6, every one needing
	   frostscale; the bag held none; US II untouched at 1024. */
	const bag = { verdantspore: 25, embercoal: 6, gloomfeather: 52 };
	const all = new Set(Array.from({ length: 1024 }, (_, i) => i));
	const frost = Array.from({ length: 1024 }, (_, i) => i).filter((n) => w.cipherRecipe(n, NAMES, 5).indexOf('frostscale') >= 0);
	const six = new Set(frost.slice(0, 6));
	t.eq('precondition: the six all need frostscale', [...six].every((n) => w.cipherRecipe(n, NAMES, 5).indexOf('frostscale') >= 0), true);
	t.eq('nothing on ASIA I can be made', w.cipherMakeable(fitOf(six, 1024), NAMES, 5, bag, 0), 0);
	const full = w.cipherMakeable(fitOf(all, 1024), NAMES, 5, bag, 0);
	t.ok('on an empty board something can', full > 0);
	t.eq('no fit is not a count', w.cipherMakeable(undefined, NAMES, 5, bag, 0), null);
	const d = (shards, day = {}, now = R23 + 2 * 60e3, plan = null) =>
		w.cipherDecide({ now, cfg: CFG, day: Object.assign({ mixesLeft: 5 }, day), shards, plan });
	const tonight = { ASIAI: round('a', R23, { possible: 6, makeable: 0 }), USII: round('u', R23, { possible: 1024, makeable: full }) };
	const hold = d(tonight);
	t.eq('the narrow board with nothing makeable does not take the hold', [hold.shard, hold.act], ['USII', 'hold']);
	t.eq('it says how many it can make', /1024, \d+ makeable/.test(hold.why), true);
	t.eq('a held plan on the dead board gives way', d(tonight, {}, R23 + 2 * 60e3, { shard: 'ASIAI' }).shard, 'USII');
	t.eq('and spends there at the end of the last round', d(tonight, {}, R23 + 23 * 60e3, { shard: 'ASIAI' }).act + '@' + d(tonight, {}, R23 + 23 * 60e3, { shard: 'ASIAI' }).shard, 'brew@USII');
	t.eq('a narrow board that CAN be made still wins', d({ ASIAI: round('a', R23, { possible: 6, makeable: 2 }), USII: tonight.USII }).shard, 'ASIAI');
	t.eq('an unknown count is not ruled out', d({ ASIAI: round('a', R23, { possible: 6 }), USII: tonight.USII }).shard, 'ASIAI');
	const none = d({ ASIAI: tonight.ASIAI });
	t.eq('nothing makeable anywhere: no hold', none.act, 'watch');
	t.eq('locked on the dead shard: nothing elsewhere is open', d(tonight, { lockedShard: 'ASIAI' }).act, 'watch');
	const stop = d({ USII: round('u', R23, { possible: 40, makeable: 0 }) }, { crackedToday: true, lockedShard: 'USII' });
	t.eq('after the 50, nothing keeps the floor: stop for the day', [stop.act, !!stop.stopDay], ['idle', true]);
	t.eq('and a stopped day stays stopped', d({ USII: round('u', R23, { possible: 40, makeable: 9 }) }, { crackedToday: true, stoppedFloor: true }).act, 'idle');
	/* The floor: what is LEFT of each ingredient the recipe uses. */
	const five = w.cipherRecipe(0, NAMES, 5);   // five verdantspore
	t.eq('30 less 5 leaves 25: allowed', w.cipherCanMake(five, { verdantspore: 30 }, 25), true);
	t.eq('29 less 5 leaves 24: refused', w.cipherCanMake(five, { verdantspore: 29 }, 25), false);
	t.eq('an ingredient the recipe does not use is not tested', w.cipherCanMake(five, { verdantspore: 30, frostscale: 0 }, 25), true);
	t.eq('before the 50 the floor is 0', w.cipherCanMake(five, { verdantspore: 5 }, 0), true);
	const b = mk();
	b.character.items = NAMES.map((n) => ({ name: n, q: 26 }));
	b.parent.S.witchcipher = { id: 'USII-r', live: true, start: R23, end: R23 + 28 * 60e3, possible: 3, mixes: 1, cracks: 1, board: [],
		fit: fitOf(new Set([0, 1, 2]), 1024) };
	b.cipherAsk = async () => { throw new Error('should not ask'); };
	const bd = b.cipherDayLoad('2026-10-25');
	bd.crackedToday = true;
	t.eq('precondition: recipe 0 is five of one name', b.cipherRecipe(0, NAMES, 5).every((n) => n === NAMES[0]), true);
	return (async () => {
		await b.cipherBrewNext({ round: 'USII-r' }, bd);
		t.eq('after the 50, no candidate keeps 25 of what it uses: it stops for the day', bd.stoppedFloor, true);
		t.ok('and says why', b.logs.some((l) => /keeping 25 of each/.test(l)));
		const c = mk();
		c.character.items = NAMES.map((n) => ({ name: n, q: 26 }));
		c.parent.S.witchcipher = Object.assign({}, b.parent.S.witchcipher);
		const asked = [];
		c.cipherAsk = async (body) => { asked.push(body); return { success: true, right: 1, fits: true, cracked: false, parcels: 1, mixes_left: 2 }; };
		await c.cipherBrewNext({ round: 'USII-r' }, c.cipherDayLoad('2026-10-25'));
		t.eq('before the 50 the same bag brews', asked.length, 1);
	})();
} },

{ name: 'watch rows once per round, and the too-slow check', fn(t) {
	/* cipherWatchNote reads the wall clock, so these rounds start a few minutes
	   ago - a fixed 11:00Z round would read as already over by the afternoon. */
	const NOW = Date.now() - 5 * 60e3;
	const w = mk();
	const day = w.cipherDayLoad('2026-10-25');
	const live = { USII: round('a', NOW, { possible: 40 }), EUI: round('e', NOW, { possible: 1 }) };
	w.cipherWatchNote(live, day, CFG);
	w.cipherWatchNote({ USII: round('a', NOW, { possible: 12 }) }, day, CFG);
	t.eq('nothing posted while it runs', posted(w, 'watch').length, 0);
	w.cipherWatchNote({ USII: round('a', NOW, { possible: 9, live: false }) }, day, CFG);
	const rows = posted(w, 'watch');
	t.eq('one row when it ends', rows.length, 1);
	t.eq('with the final and the narrowest board', rows[0] && [rows[0].possible, rows[0].min_possible], [9, 9]);
	for (let i = 0; i < 3; i++) w.cipherWatchNote({ USII: round('a', NOW, { possible: 9, live: false }) }, day, CFG);
	t.eq('a finished round sitting in the snapshot is not posted again', posted(w, 'watch').length, 1);
	t.eq('an EU round is not watched', rows.every((r) => r.server !== 'EU I'), true);
	const b = mk();
	const bd = b.cipherDayLoad('2026-10-25');
	bd.brewed.push('a|USII');
	b.cipherWatchNote({ USII: round('a', NOW) }, bd, CFG);
	b.cipherWatchNote({ USII: round('a', NOW, { live: false }) }, bd, CFG);
	t.eq('a round brewed in is not a watched one', posted(b, 'watch').length, 0);

	const s = mk();
	const sd = s.cipherDayLoad('2026-10-25');
	const rec = ['frostscale', 'frostscale', 'embercoal', 'gloomfeather', 'verdantspore'];
	s.parent.S.witchcipher = { id: 'USII-r', cracks: 0 };
	s.cipherSlowCheck(sd);
	s.cipherPending = { key: rec.join(','), cycle: 'USII-r#0', at: Date.now() - 300 };
	s.parent.S.witchcipher = { id: 'USII-r', cracks: 1, possible: 1024, cracked: { by: 'Red_Merch', recipe: rec } };
	s.cipherSlowCheck(sd);
	t.eq('cracked by someone else while ours was in flight: too slow', posted(s, 'slow').length, 1);
	t.eq('naming who', posted(s, 'slow')[0] && posted(s, 'slow')[0].cracked_by, 'Red_Merch');
	s.cipherSlowCheck(sd);
	t.eq('once', posted(s, 'slow').length, 1);
	const own = mk();
	const od = own.cipherDayLoad('2026-10-25');
	own.parent.S.witchcipher = { id: 'USII-r', cracks: 0 };
	own.cipherSlowCheck(od);
	own.cipherPending = { key: rec.join(','), cycle: 'USII-r#0', at: Date.now() };
	own.parent.S.witchcipher = { id: 'USII-r', cracks: 1, cracked: { by: 'Meltymerch', recipe: rec } };
	own.cipherSlowCheck(od);
	t.eq('our own crack is not too slow', posted(own, 'slow').length, 0);
	const fresh = mk();
	fresh.cipherPending = { key: rec.join(','), cycle: 'USII-r#0', at: Date.now() };
	fresh.parent.S.witchcipher = { id: 'USII-r', cracks: 1, cracked: { by: 'X', recipe: rec } };
	fresh.cipherSlowCheck(fresh.cipherDayLoad('2026-10-25'));
	t.eq('a first sighting cannot say when the crack happened', posted(fresh, 'slow').length, 0);
} },

{ name: 'v139 the hold says what it sees: the board after a hop, a crack, the Witch, brew', fn(t) {
	/* US I, 11:00Z 2026-10-27: held on a stale board of 2 at 11:17:30, reset by a
	   crack at 11:17:24, narrowed to 1 by 11:24:03, released at 11:28:03 - and
	   no line in between said whether the merchant was at the Witch. */
	const w = mk();
	const d = (act, possible, round = 'USI-r') => ({ shard: 'USI', round, act, why: 'board at ' + possible });
	const s = (cracks, possible, by) => ({ cracks, possible, cracked: by ? { by } : undefined });
	let r = w.cipherHeldLine(null, d('brew', 2), s(0, 2), false, false);
	t.eq('before the hop: silent - the take-hold line said it', r.line, null);
	r = w.cipherHeldLine(null, d('hold', 1024), s(1, 1024), true, false);
	t.eq('first tick on the shard after the hop names the board it really sees', r.line, 'on USI: hold (board at 1024)');
	const arrived = w.cipherHeldLine(r.note, d('hold', 1024), s(1, 1024), true, true);
	t.eq('arriving at the Witch is logged', arrived.line, 'at the Witch on USI (board at 1024)');
	t.eq('and only once', w.cipherHeldLine(arrived.note, d('hold', 900), s(1, 900), true, true).line, null);
	const narrow = w.cipherHeldLine(arrived.note, d('brew', 6), s(1, 6), true, true);
	t.eq('the board reaching the threshold is logged', narrow.line, 'now brew on USI (board at 6)');
	const cracked = w.cipherHeldLine(narrow.note, d('hold', 1024), s(2, 1024, 'CrownMerch'), true, true);
	t.eq('a crack on the held round is logged with who and the reset board', cracked.line,
		'USI was cracked by CrownMerch - the board is back to 1024; now hold on USI (board at 1024)');
	const far = w.cipherHeldLine(r.note, d('brew', 6), s(1, 6), true, false);
	t.eq('brew while away from the Witch says so', far.line, 'now brew on USI (board at 6); not at the Witch yet');
	t.eq('once', w.cipherHeldLine(far.note, d('brew', 5), s(1, 5), true, false).line, null);
	const moved = w.cipherHeldLine(arrived.note, d('hold', 40, 'USI-other'), s(0, 40), true, true);
	t.eq('a different round reads as a fresh hold', moved.line, 'on USI: hold (board at 40); at the Witch on USI (board at 40)');
	w.cipherBusy = true; w.cipherHeldSeen = narrow.note;
	w.cipherRelease('done');
	t.eq('release forgets the held round', w.cipherHeldSeen, null);
	t.ok('the tick logs it before hopping or walking',
		/cipherHeldSeen = held\.note;\s*if \(held\.line\) cipherLog\(held\.line\);\s*if \(!here\) \{ await mHopTo/.test(SRC));
	t.ok('the declaration as supplied', /^let cipherHeldSeen = null;/m.test(SRC));

	const NOW = Date.now() - 5 * 60e3;
	const v = mk();
	const day = v.cipherDayLoad('2026-10-27');
	v.cipherWatchNote({ USI: round('a', NOW, { possible: 2, cracks: 0 }) }, day, CFG);
	v.cipherWatchNote({ USI: round('a', NOW, { possible: 1024, cracks: 1 }) }, day, CFG);
	v.cipherWatchNote({ USI: round('a', NOW, { possible: 5, cracks: 1 }) }, day, CFG);
	v.cipherWatchNote({ USI: round('a', NOW, { possible: 300, cracks: 2, live: false }) }, day, CFG);
	const row = posted(v, 'watch')[0] || {};
	t.eq('the round minimum is unchanged', row.min_possible, 2);
	t.eq('and each board has its own', row.min_by_board, { 0: 2, 1: 5, 2: 300 });
	const n = mk();
	const nd = n.cipherDayLoad('2026-10-27');
	n.cipherWatchNote({ USI: round('a', NOW, { possible: 7 }) }, nd, CFG);
	n.cipherWatchNote({ USI: round('a', NOW, { possible: 7, live: false }) }, nd, CFG);
	t.eq('no crack count, no per-board record', (posted(n, 'watch')[0] || {}).min_by_board, null);
	t.ok('the own shard carries who cracked it', /fit: w\.fit, cracked: w\.cracked \};/.test(SRC));
} },

{ name: 'v140 the brew decision runs on the publish, not only on the 2s tick', fn(t) {
	/* US I, 11:00Z 2026-10-27: 1024 to 1 in six mixes, at 8 or below only
	   between the fifth and the sixth, with the merchant on the Witch's map. */
	const w = mk();
	const plan = { shard: 'USI', round: 'USI-r' };
	const S = (possible, over = {}) => Object.assign({ id: 'USI-r', live: true, possible }, over);
	t.eq('the held round at the threshold', w.cipherKickWanted(S(8), plan, true, 8), true);
	t.eq('below it', w.cipherKickWanted(S(1), plan, true, 8), true);
	t.eq('above it: the tick will do', w.cipherKickWanted(S(9), plan, true, 8), false);
	t.eq('not holding', w.cipherKickWanted(S(3), plan, false, 8), false);
	t.eq('no plan', w.cipherKickWanted(S(3), null, true, 8), false);
	t.eq('another round on this shard', w.cipherKickWanted(S(3, { id: 'USI-other' }), plan, true, 8), false);
	t.eq('a finished round', w.cipherKickWanted(S(3, { live: false }), plan, true, 8), false);
	t.eq('no board count', w.cipherKickWanted({ id: 'USI-r', live: true }, plan, true, 8), false);
	t.eq('a null board count - null <= 8 is true in JS', w.cipherKickWanted(S(null), plan, true, 8), false);
	t.eq('no cipher in the payload', w.cipherKickWanted(undefined, plan, true, 8), false);

	/* The kick: mid-tick it is held for the end of the tick, otherwise it runs now. */
	let ran = 0;
	w.cipherTick = () => { ran++; };
	w.cipherTickRunning = true;
	w.cipherKick();
	t.eq('mid-tick: not run over the top of it', ran, 0);
	t.eq('but remembered', w.cipherKickPending, true);
	w.cipherTickRunning = false;
	w.cipherTickTimer = setTimeout(() => { ran += 100; }, 60000);
	w.cipherKick();
	t.eq('between ticks: run now', ran, 1);
	t.eq('and the waiting tick is cancelled', w.cipherTickTimer, null);

	/* The listener is on the page socket and replaces its predecessor. */
	const handlers = {};
	const sock = { on: (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); },
		off: (ev, fn) => { handlers[ev] = (handlers[ev] || []).filter((f) => f !== fn); } };
	w.parent.socket = sock;
	t.eq('installed', w.cipherLiveHook(), true);
	w.cipherLiveHook();
	t.eq('a second install replaces the first', (handlers.server_info || []).length, 1);
	t.eq('and it is the one the page keeps', handlers.server_info[0] === w.parent.__cipherLiveHook, true);
	const wd = mk();
	t.eq('no socket: not installed', wd.cipherLiveHook(), false);

	t.ok('the tick refuses to run twice at once',
		/async function cipherTick\(\) \{\s*const cfg = CONFIG\.cipherBrew;\s*if \(cipherTickRunning\) return;\s*cipherTickRunning = true;/.test(SRC));
	t.ok('it installs the listener once per runtime', /if \(cfg && cfg\.enabled && !cipherLiveHooked\) cipherLiveHooked = cipherLiveHook\(\);/.test(SRC));
	t.ok('and a held kick runs at the end of the tick',
		/cipherTickRunning = false;\s*const soon = cipherKickPending;\s*cipherKickPending = false;\s*cipherTickTimer = setTimeout\(cipherTick, soon \? 0 :/.test(SRC));
	t.ok('the publish listener asks the threshold', /cipherKickWanted\(d && d\.witchcipher, cipherPlan, cipherBusy, cfg\.threshold\)\) setTimeout\(cipherKick, 0\)/.test(SRC));
	t.ok('the declarations as supplied', ['cipherTickTimer = null', 'cipherTickRunning = false', 'cipherKickPending = false', 'cipherLiveHooked = false']
		.every((d) => new RegExp('^let ' + d + ';', 'm').test(SRC)));
} },
];
