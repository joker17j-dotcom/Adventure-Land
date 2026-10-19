/* OpenGifts: the merchant buff skills, the overlap of the three independent
   server queues, and the bow ladder making fodder rather than stopping at
   one finished copy. Lifted from OpenGifts.js as committed. */

const { lift, world } = require('./lift');
const GIFTS = 'OpenGifts.js';

const SKILLS = {
	massexchange: { level: 40, mp: 30, cooldown: 50 },
	massexchangepp: { level: 70, mp: 200, cooldown: 50 },
	massproduction: { level: 30, mp: 20, cooldown: 50 },
	massproductionpp: { level: 60, mp: 200, cooldown: 50 },
	regen_mp: { output: 100, share: 'use_mp' },
};

function gifts(over = {}) {
	const casts = [];
	const w = world(Object.assign({}, over, {
		character: Object.assign({ level: 69, mp: 1000, max_mp: 1000, items: [], q: {} }, over.character || {}),
		parent: { G: { skills: SKILLS }, next_skill: over.next_skill || {} },
		casts,
	}));
	if (over.noUseSkill) { /* leave use_skill undefined on purpose */ }
	else {
		w.use_skill = over.use_skill || (async (n) => {
			casts.push(n);
			if (n === 'regen_mp') w.character.mp = Math.min(w.character.max_mp, w.character.mp + 100);
			else w.character.mp -= (SKILLS[n].mp || 0);
			return true;
		});
	}
	w.cmpGroup = over.cmpGroup || (() => null);
	w.bowPick = over.bowPick || (() => null);
	w.compoundAll = over.compoundAll || (async () => ({ attempts: 0, made: {} }));
	w.upgradeBows = over.upgradeBows || (async () => ({ attempts: 0, made: 0, lost: 0 }));
	w.skillWarned = false;
	lift(w, GIFTS, ['CONFIG', 'skillDef', 'skillReadyIn', 'skillBlocked', 'topUpMp',
		'castBuff', 'buffExchange', 'buffProduction', 'skillReport',
		'bowPick', 'bowAtTarget', 'runLadders', 'exchangeStarted']);
	/* bowPick is lifted, so restore the stub where a suite wanted one. */
	if (over.bowPick) w.bowPick = over.bowPick;
	return w;
}

const bow = (level, locked) => ({ name: 'bowofthedead', level, l: locked || undefined });

module.exports = [

{ name: 'buff skills are gated on level against G, not a hardcoded number', async fn(t) {
	t.eq('level 69 picks massexchange, not the ++ it cannot cast', await gifts().buffExchange(), 'massexchange');
	t.eq('level 69 DOES have massproductionpp (needs 60)', await gifts().buffProduction(), 'massproductionpp');
	t.eq('level 70 picks massexchangepp', await gifts({ character: { level: 70 } }).buffExchange(), 'massexchangepp');
	t.eq('level 35 has only the base production form', await gifts({ character: { level: 35 } }).buffProduction(), 'massproduction');
	t.eq('level 35 can cast no exchange buff at all', await gifts({ character: { level: 35 } }).buffExchange(), null);
} },

{ name: 'one buff per action, because two actions beat one stacked', async fn(t) {
	/* Separate 50s cooldowns: spending them on two exchanges saves 6.3s per
	   50s against 4.3s for both on one, since a second halving of an
	   already-shrunk number is worth less than a first halving of a full
	   one. Preferring the stronger READY skill produces that spread with no
	   scheduling, which is what this asserts. */
	const w = gifts({ character: { level: 70 } });
	await w.buffExchange();
	t.eq('exactly one cast', w.casts.filter((x) => x.startsWith('mass')), ['massexchangepp']);

	const onCd = gifts({ character: { level: 70 }, next_skill: { massexchangepp: new Date(Date.now() + 30000) } });
	t.eq('++ on cooldown falls through to the base form', await onCd.buffExchange(), 'massexchange');
} },

{ name: 'MP: the reserve holds, and regen funds what it can', async fn(t) {
	const tight = gifts({ character: { level: 70, mp: 200, max_mp: 1000 } });
	t.eq('a cast that would breach the reserve is blocked with a reason', tight.skillBlocked('massexchangepp'), 'mp');

	const low = gifts({ character: { level: 70, mp: 100, max_mp: 1000 } });
	t.eq('regen tops up and the cast lands', await low.buffExchange(), 'massexchangepp');
	t.that('regen_mp was actually used', low.casts.filter((x) => x === 'regen_mp').length > 0,
		low.casts.filter((x) => x === 'regen_mp').length);
} },

{ name: 'a missing helper is loud, never silent', async fn(t) {
	/* The whole point of skillReport(): "the skills did nothing" and "the
	   skills are not available" look identical in a log of successes. */
	const w = gifts({ noUseSkill: true });
	t.eq('blocked with the reason, not a bare false', w.skillBlocked('massexchange'), 'use_skill unavailable');
	w.skillReport();
	t.that('and the startup line says so', w.logs.some((l) => /use_skill\(\) is unavailable/.test(l)),
		w.logs.join(' | '));
} },

{ name: 'runLadders never throws - it is launched without an await', async fn(t) {
	const w = gifts({
		cmpGroup: () => ({}), compoundAll: async () => { throw new Error('boom'); },
		bowPick: () => ({ slot: 1 }), upgradeBows: async () => { throw new Error('bang'); },
	});
	let threw = false;
	try { await w.runLadders({ attempts: 0, made: {} }, { attempts: 0, made: 0, lost: 0 }); }
	catch (e) { threw = true; }
	t.eq('two throwing ladders are swallowed', threw, false);
	t.eq('and both are logged', w.logs.filter((l) => /threw/.test(l)).length, 2);
} },

{ name: 'exchangeStarted waits for the queue, not the result', async fn(t) {
	/* The server claims the reward slot at exchange START and fills that
	   same slot at the end, so q.exchange appearing is the moment the bag has
	   taken its one shape-change and ladder indices are safe. */
	const w = gifts();
	w.character.q = { exchange: { ms: 4000 } };
	t.eq('true once q.exchange exists', await w.exchangeStarted({ done: false }), true);
	t.eq('false early when the call already settled - a refusal', await gifts().exchangeStarted({ done: true }), false);
} },

{ name: 'the overlap is real, not notional', async fn(t) {
	const w = gifts({ cmpGroup: () => ({}), bowPick: () => null });
	w.compoundAll = async () => { await new Promise((r) => setTimeout(r, 200)); return { attempts: 1, made: {} }; };
	const nil = () => [{ attempts: 0, made: {} }, { attempts: 0, made: 0, lost: 0 }];

	let t0 = Date.now();
	const flight = new Promise((r) => setTimeout(() => r({ reward: 'x' }), 200));
	const ladders = w.runLadders(...nil());
	await flight; await ladders;
	const overlapped = Date.now() - t0;

	t0 = Date.now();
	await new Promise((r) => setTimeout(r, 200));
	await w.runLadders(...nil());
	const serial = Date.now() - t0;

	t.that('overlapped is about max(200,200), not the sum', overlapped < 300, overlapped + 'ms');
	t.that('serial is about 400', serial >= 380, serial + 'ms');
	t.note(`measured: overlapped ${overlapped}ms, serial ${serial}ms`);
} },

{ name: 'the overlap runs BOTH ways - a slow ladder does not hold up the next box', async fn(t) {
	/* v10 overlapped one direction only: a box could start a compound, but
	   the next box waited for it. The operator saw exactly that live -
	   "it starts upgrades and compounds while opening boxes but it does not
	   open boxes while the upgrade/compound is running". A 10s compound
	   against a 3-6s exchange is ~5s of nothing, every compound. */
	const w = gifts({ cmpGroup: () => ({}), bowPick: () => null });
	w.compoundAll = async () => { await new Promise((r) => setTimeout(r, 300)); return { attempts: 1, made: {} }; };
	lift(w, GIFTS, ['ladderRunner']);
	const nil = () => [{ attempts: 0, made: {} }, { attempts: 0, made: 0, lost: 0 }];

	w.ladderRunner.reset();
	const t0 = Date.now();
	w.ladderRunner.launch(...nil());                       // 300ms ladder
	await new Promise((r) => setTimeout(r, 100));          // a 100ms "exchange"
	const afterFirstBox = Date.now() - t0;
	t.that('the next box is reachable while the ladder still runs', afterFirstBox < 200, afterFirstBox + 'ms');
	t.eq('and the ladder is still in flight', w.ladderRunner.busy, true);

	/* The second box must NOT start a second ladder - q.compound is single,
	   so two at once would contend however independent the three queues are. */
	t.eq('a second launch while one runs is refused', w.ladderRunner.launch(...nil()), false);

	await w.ladderRunner.settle();
	const total = Date.now() - t0;
	t.that('settle still waits for it', total >= 300, total + 'ms');
	t.eq('and clears the slot', w.ladderRunner.busy, false);
	t.note(`next box at ${afterFirstBox}ms, ladder settled at ${total}ms`);

	w.ladderRunner.reset();
	t.eq('a launch after a reset is accepted', w.ladderRunner.launch(...nil()), true);
	await w.ladderRunner.settle();

	/* settle() on nothing is a no-op rather than a throw - every guarded
	   call site hits this case most of the time. */
	let threw = false;
	try { await w.ladderRunner.settle(); } catch (e) { threw = true; }
	t.eq('settling an empty runner is safe', threw, false);

	/* A throwing ladder must not wedge the runner: runLadders swallows its
	   own, but the slot has to clear even if something else throws. */
	w.ladderRunner.reset();
	w.compoundAll = async () => { throw new Error('boom'); };
	w.ladderRunner.launch(...nil());
	await w.ladderRunner.settle();
	t.eq('a throwing ladder still frees the slot', w.ladderRunner.busy, false);
} },

{ name: 'the bow ladder makes fodder, not one trophy', fn(t) {
	t.that('a finished +7 on hand no longer stops the ladder', gifts({ character: { items: [bow(7), bow(3), bow(0)] } }).bowPick() !== null);
	t.eq('and it picks the highest BELOW target', gifts({ character: { items: [bow(7), bow(3), bow(0)] } }).bowPick().level, 3);
	t.eq('bowAtTarget counts the finished ones', gifts({ character: { items: [bow(7), bow(3)] } }).bowAtTarget(), 1);
	t.eq('three finished, nothing left to work on', gifts({ character: { items: [bow(7), bow(7), bow(7)] } }).bowPick(), null);
	t.eq('counted as three', gifts({ character: { items: [bow(7), bow(7), bow(7)] } }).bowAtTarget(), 3);
	t.eq('a LOCKED finished copy is skipped and the +5 picked', gifts({ character: { items: [bow(7, true), bow(5)] } }).bowPick().level, 5);
	t.eq('a locked unfinished copy is skipped too', gifts({ character: { items: [bow(6, true)] } }).bowPick(), null);
	t.eq('a copy ABOVE target is never re-rolled', gifts({ character: { items: [bow(8)] } }).bowPick(), null);
	t.eq('and still counts toward the total', gifts({ character: { items: [bow(8)] } }).bowAtTarget(), 1);
} },

];
