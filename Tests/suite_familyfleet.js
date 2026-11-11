/* FamilyFleet: use town when stuck - the operator's request of 2026-11-08
   22:15 EST, after the family's rangers wedged at icegolem. Built by the
   browser-driven session and committed from its patch (blob 017cd449).

   Stuck is two smart_move refusals in a row, or a walk asked for in the last
   stuckMs with under moveEps moved in stuckMs while more than arriveEps from
   its destination (or the game still reporting moving). Then stop the walk,
   end a boss trip, use_town; at most once per townGapMs. */

const fs = require('fs');
const path = require('path');
const { lift, extract, world, ROOT } = require('./lift');

const FF = 'Codex/FamilyFleet.js';
const src = () => fs.readFileSync(path.join(ROOT, FF), 'utf8');

function ffWorld(over = {}) {
	const calls = [];
	const w = world(Object.assign({
		inTown: () => false,
		bossState: { trip: null },
		bossEnd: (why) => { calls.push('bossEnd:' + why); w.bossState.trip = null; },
		stop: (k) => { calls.push('stop:' + k); },
		use_skill: async (s) => { calls.push('skill:' + s); },
		character: { name: 'Fam', map: 'winterland', x: 0, y: 0, moving: false, rip: false },
	}, over));
	w.calls = calls;
	w.T = 1000000;
	w.Date = { now: () => w.T };
	w.stuckTownFrom = null;
	lift(w, FF, ['STUCK', 'stuckState', 'stuckNoteIntent', 'stuckNotePath', 'stuckReason', 'stuckTick', 'STUCK_TOWN', 'stuckTownHeld', 'stuckTownLandCheck']);
	return w;
}

module.exports = [
	{
		name: 'the constants are what the patch shipped',
		fn(t) {
			const w = ffWorld();
			t.eq('STUCK', JSON.parse(JSON.stringify(w.STUCK)), { stuckMs: 20000, moveEps: 15, arriveEps: 25, townGapMs: 30000, pathFailsToTown: 2 });
		},
	},
	{
		name: 'stuckReason - when it fires and when it does not',
		fn(t) {
			let w = ffWorld();
			t.eq('fresh: nothing', w.stuckReason(w.T), null);
			w.stuckNotePath(false);
			t.eq('one refusal is not stuck', w.stuckReason(w.T), null);
			w.stuckNotePath(false);
			t.eq('two refusals in a row are', w.stuckReason(w.T), '2 path refusals in a row');
			w.stuckNotePath(true);
			t.eq('a success resets the count', w.stuckReason(w.T), null);

			w = ffWorld();
			w.stuckReason(w.T);                                 // anchor at 0,0
			w.stuckNoteIntent({ map: 'winterland', x: 400, y: 0 });
			w.T += 10000;
			w.stuckNoteIntent({ map: 'winterland', x: 400, y: 0 });   // the next tick asks again
			w.T += 9999;
			t.eq('a walk asked for, not moved, under stuckMs: not yet', w.stuckReason(w.T), null);
			w.T += 1;
			t.ok('at stuckMs, far from where it was going: stuck', /^no movement in 20s on the way to winterland 400,0$/.test(w.stuckReason(w.T)));

			/* A PROPERTY OF THE PATCH, PINNED AS SHIPPED: one ask that is never
			   repeated, with the game not reporting moving, does not fire -
			   "wanted" lapses at stuckMs from the ask, the same moment the
			   unmoved clock could first fire. The loops re-ask every tick, which
			   is what the case above models. */
			w = ffWorld();
			w.stuckReason(w.T);
			w.stuckNoteIntent({ map: 'winterland', x: 400, y: 0 });
			w.T += 20000;
			t.eq('a single ask never repeated, not moving: does not fire', w.stuckReason(w.T), null);

			w = ffWorld();
			w.stuckReason(w.T);
			w.stuckNoteIntent({ map: 'winterland', x: 20, y: 0 });
			w.T += 10000;
			w.stuckNoteIntent({ map: 'winterland', x: 20, y: 0 });   // still asked for: "wanted" holds
			w.T += 15000;
			t.eq('within arriveEps of the destination: arrived, not stuck', w.stuckReason(w.T), null);
			w.character.x = -6;                                 // the same ask, 26 away and unmoved
			w.stuckState.x = -6;
			t.ok('just past arriveEps, same ask: stuck', w.stuckReason(w.T) !== null);

			w = ffWorld();
			w.stuckReason(w.T);
			w.T += 60000;
			t.eq('no walk asked for and not moving (waiting at a boss): not stuck', w.stuckReason(w.T), null);
			w.character.moving = true;
			t.ok('the game still reporting moving, unmoved 60s: stuck', /^no movement in 60s$/.test(w.stuckReason(w.T)));

			w = ffWorld();
			w.stuckReason(w.T);
			w.stuckNoteIntent({ map: 'winterland', x: 400, y: 0 });
			w.T += 15000;
			w.character.x = 16;
			w.stuckReason(w.T);                                 // moved > moveEps: the anchor moves
			w.T += 6000;
			t.eq('movement past moveEps re-anchors the clock', w.stuckReason(w.T), null);

			w = ffWorld();
			w.stuckReason(w.T);
			w.stuckNoteIntent({ map: 'winterland', x: 400, y: 0 });
			w.T += 25000;
			w.character.rip = true;
			t.eq('dead: never stuck', w.stuckReason(w.T), null);
		},
	},
	{
		name: 'stuckTick - stops, ends the trip, towns, once per townGapMs',
		async fn(t) {
			let w = ffWorld({ bossState: { trip: { name: 'icegolem' } } });
			w.stuckNotePath(false); w.stuckNotePath(false);
			t.eq('it towns', await w.stuckTick(), true);
			t.eq('stop smart, stop move, end the trip, then town - in that order', w.calls,
				['stop:smart', 'stop:move', 'bossEnd:stuck - used town', 'skill:use_town']);
			t.eq('the refusal count is reset', w.stuckState.pathFails, 0);
			w.stuckNotePath(false); w.stuckNotePath(false);
			w.T += 29999;
			t.eq('not again inside townGapMs', await w.stuckTick(), false);
			w.T += 1;
			t.eq('again at townGapMs', await w.stuckTick(), true);

			w = ffWorld({ inTown: () => true });
			w.stuckNotePath(false); w.stuckNotePath(false);
			t.eq('in town it does not cast', await w.stuckTick(), false);
			t.eq('and clears the refusals', w.stuckState.pathFails, 0);
			t.eq('nothing was called', w.calls, []);

			w = ffWorld();
			w.stuckNotePath(false); w.stuckNotePath(false);
			await w.stuckTick();
			t.ok('no trip: no bossEnd', !w.calls.some((c) => /^bossEnd/.test(c)));
		},
	},
	{
		name: 'the walks report to it, and rangerTick runs it ahead of the movement lock',
		fn(t) {
			for (const fn of ['goTo', 'goToMonster']) {
				const b = extract(FF, fn);
				t.that(fn + ' notes its intent before the smart_move', b.indexOf('stuckNoteIntent(') >= 0 && b.indexOf('stuckNoteIntent(') < b.indexOf('smart_move('), fn);
				t.that(fn + ' notes success after it', b.indexOf('stuckNotePath(true)') > b.indexOf('smart_move('), fn);
				t.that(fn + ' notes a refusal in its catch', b.indexOf('stuckNotePath(false)') > b.indexOf('catch'), fn);
			}
			const so = extract(FF, 'bossStandOff');
			t.that("bossStandOff's straight move notes its intent", so.indexOf('stuckNoteIntent(') >= 0 && so.indexOf('stuckNoteIntent(') < so.indexOf('await move('), 'bossStandOff');
			const rt = extract(FF, 'rangerTick');
			const s = rt.indexOf('await stuckTick()'), lock = rt.indexOf('if (fleetState.busy && !busyExpired()) return;');
			t.that('rangerTick calls stuckTick', s > 0, s);
			t.that('ahead of the busy lock', s > 0 && lock > 0 && s < lock, [s, lock]);
			t.that('after the rage guard', rt.indexOf('await rageGuard()') < s, s);
		},
	},
];

module.exports.push({
	name: 'the town channel: held after the cast, said once when it did not land',
	async fn(t) {
		let w = ffWorld();
		t.eq('precondition: nothing cast, not held', w.stuckTownHeld(), false);
		w.stuckNotePath(false); w.stuckNotePath(false);
		t.eq('precondition: it towns', await w.stuckTick(), true);
		t.eq('held at once', w.stuckTownHeld(), true);
		t.eq('the cast spot is stamped', JSON.stringify(w.stuckTownFrom), JSON.stringify({ at: w.T, map: 'winterland', x: 0, y: 0 }));
		w.T += w.STUCK_TOWN.holdMs;
		t.eq('not held at holdMs with no channel seen', w.stuckTownHeld(), false);
		w.character.c = { town: { ms: 800 } };
		t.eq('held while the game shows the channel', w.stuckTownHeld(), true);
		w.T += 4000; w.stuckTownLandCheck(w.T);
		t.eq('not judged while channelling', w.stuckTownFrom !== null, true);
		w.character.c = {};
		w.stuckTownLandCheck(w.T);
		t.ok('on the cast spot past landCheckMs: an orange line', w.logs.some((m) => /town cast did not land/.test(m)));
		t.eq('once', w.stuckTownFrom, null);
		w = ffWorld();
		w.stuckNotePath(false); w.stuckNotePath(false); await w.stuckTick();
		w.character.x = 900; w.T += w.STUCK_TOWN.landCheckMs; w.stuckTownLandCheck(w.T);
		t.eq('moved: landed, nothing said', w.logs.some((m) => /did not land/.test(m)), false);
		const tick = extract(FF, 'rangerTick');
		t.ok('rangerTick stands down while held, ahead of the rage guard and the stuck check',
			/stuckTownLandCheck\(Date\.now\(\)\);\n\tif \(stuckTownHeld\(\)\) return;\n[\s\S]*rageGuard\(\)[\s\S]*stuckTick\(\)/.test(tick));
	},
});
