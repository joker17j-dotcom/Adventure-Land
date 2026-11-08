/* The circle-walk override - Ranger v161 / Priest v89 / Mage v112, with the
   fear-free radius and the between-waves hold in Ranger v162 / Priest v90 /
   Mage v113.

   Dexon owns the plan (CONFIG.movement.circleOverride) and sends it on the
   farm_spot message; the followers phase-lock to his angle on a ring scaled
   by speed. The shared helpers are copied into all three files because CODE
   slots share no module, so the first block pins the copies together. */

const fs = require('fs');
const path = require('path');
const { lift, extract, world, ROOT } = require('./lift');

const RANGER = 'Party/Ranger.js', PRIEST = 'Party/Priest.js', MAGE = 'Party/Mage.js';
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const SHARED = ['circleWallLimit', 'circleEntryKey', 'circleWall', 'circleWalkWanted',
	'circleNoKiteTypes', 'speedWithoutFear', 'circleHoldsSpot', 'kiteCandidateTypes'];
const FOLLOWER = ['circleOnWord', 'circlePlan', 'circleFollowerRadius', 'circleIntercept',
	'circleAngleDiff', 'circleFollowStep', 'circleStep'];
/* Scalar consts are not liftable (lift() brace-matches from the first `{`),
   so they are supplied to each world and pinned here from the source text. */
const SHARED_CONSTS = ['const CIRCLE_RAYS = 36;', 'const CIRCLE_RAY_STEP = 5;', 'const CIRCLE_RAY_MAX = 300;',
	'const CIRCLE_HOLD_SLACK = 40;', 'const FEAR_SPEED_REDUX = [0, 20, 40, 70, 80, 90, 100];'];
const FOLLOWER_CONSTS = ['const CIRCLE_TRUST_MS = 75000;', 'const CIRCLE_BODY_MARGIN = 5;',
	'const CIRCLE_MIN_R = 10;', 'const CIRCLE_ARRIVE = 6;', 'const CIRCLE_T_MIN = 0.5;', 'const CIRCLE_T_MAX = 6;'];
const CONSTS = { CIRCLE_RAYS: 36, CIRCLE_RAY_STEP: 5, CIRCLE_RAY_MAX: 300, CIRCLE_HOLD_SLACK: 40,
	FEAR_SPEED_REDUX: [0, 20, 40, 70, 80, 90, 100] };
const FCONSTS = { CIRCLE_TRUST_MS: 75000, CIRCLE_BODY_MARGIN: 5, CIRCLE_MIN_R: 10,
	CIRCLE_ARRIVE: 6, CIRCLE_T_MIN: 0.5, CIRCLE_T_MAX: 6 };

const CGOO = { m: 'cgoo', map: 'level2s', x: 34, y: 503, r: 40, rBy: { FatherToken: null, MageofOz: null }, noKite: true };

/* A round room of radius `wall` around (cx, cy): a segment is clear while its
   far end stays inside it. Enough for rays from the centre, which is all
   circleWallLimit asks. */
function room(cx, cy, wall) {
	return (o) => Math.hypot(o.going_x - cx, o.going_y - cy) < wall && Math.hypot(o.x - cx, o.y - cy) < wall;
}

function rangerWorld(over = {}) {
	const w = world(Object.assign({
		CONFIG: {
			movement: {
				circleWalk: false, circleRadius: 75,
				anchors: { 'cgoo@level2s': { x: -86, y: 683 } },
				circleOverride: { enabled: true, bodyMargin: 5, whitelist: [JSON.parse(JSON.stringify(CGOO))] },
			},
		},
		home: 'cgoo', mobMap: 'level2s', destination: { map: 'level2s', x: -86, y: 683 },
		spotKey: (h, m) => h + '@' + m,
		can_move: room(34, 503, 150),
		circleStore: undefined, farmSearchResult: null, CIRCLE_KEY: 'circle_override',
		character: { name: 'Dexon', map: 'level2s', base: { h: 8, v: 7, vn: 2 }, speed: 66 },
	}, CONSTS, over));
	w.scopedGet = (k) => w.get(k + '_Dexon');
	w.scopedSet = (k, v) => w.set(k + '_Dexon', v);
	lift(w, RANGER, ['circleWallCache', 'circleRefused', ...SHARED.filter((n) => n !== 'kiteCandidateTypes'),
		'circleCfg', 'circleStored', 'circleOverrideOn', 'circleMatch', 'circlePlan', 'circleWord', 'circleWordKey',
		'farmDestinationFor', 'circleReapply', 'circleSave', 'circleOn', 'circleOff', 'circleR',
		'circleForget', 'circleStatus', 'kiteCandidateTypes']);
	return w;
}

function followerWorld(file, over = {}) {
	const moves = [], circles = [];
	const w = world(Object.assign({
		CONFIG: { movement: { circleWalk: false, circleRadius: 35 } },
		can_move: room(34, 503, 150),
		smart: { moving: false },
		character: { name: 'MageofOz', map: 'level2s', base: { h: 8, v: 7, vn: 2 }, speed: 57, real_x: 34, real_y: 503, moving: false },
		parent: { entities: {} },
		moves, circles,
		safeMove: async (x, y) => { moves.push({ x, y }); },
		walkInCircle: async () => { circles.push(1); },
	}, CONSTS, FCONSTS, over));
	lift(w, file, ['circleWallCache', 'circleHeard', 'circleRefusedAt', ...SHARED.filter((n) => n !== 'kiteCandidateTypes'),
		...FOLLOWER, 'kiteThreatRadius', 'kiteCandidateTypes']);
	return w;
}

const WORD = { v: 1, on: true, rD: 40, entry: CGOO };

module.exports = [

{ name: 'the shared helpers are byte-identical in all three scripts', fn(t) {
	for (const n of SHARED) {
		const r = extract(RANGER, n);
		t.eq('Priest ' + n + ' matches Ranger', extract(PRIEST, n) === r, true);
		t.eq('Mage ' + n + ' matches Ranger', extract(MAGE, n) === r, true);
	}
	for (const f of [RANGER, PRIEST, MAGE]) {
		const s = src(f);
		for (const c of SHARED_CONSTS) t.ok(f + ': ' + c, s.indexOf(c) >= 0);
		t.ok(f + ': circleWallCache is the empty object this suite lifts', /^const circleWallCache = \{\};$/m.test(s));
	}
	for (const n of FOLLOWER) t.eq('Mage ' + n + ' matches Priest', extract(MAGE, n) === extract(PRIEST, n), true);
	for (const c of FOLLOWER_CONSTS) {
		t.ok('Priest: ' + c, src(PRIEST).indexOf(c) >= 0);
		t.ok('Mage: ' + c, src(MAGE).indexOf(c) >= 0);
	}
	t.ok('Ranger: CIRCLE_KEY as this suite supplies it', src(RANGER).indexOf("const CIRCLE_KEY = 'circle_override';") >= 0);
	t.ok('Ranger: circleStore starts unread', /^let circleStore;/m.test(src(RANGER)));
	t.ok('Ranger: farmSearchResult starts null', /^let farmSearchResult = null;$/m.test(src(RANGER)));
	t.ok('Priest and Mage declare circleHeard null', /^let circleHeard = null;$/m.test(src(PRIEST)) && /^let circleHeard = null;$/m.test(src(MAGE)));
} },

{ name: 'the wall check: rays from the centre, less the margin, null when it cannot run', fn(t) {
	const w = rangerWorld();
	t.eq('a room of 150 clears 145 at margin 0', w.circleWallLimit('level2s', 34, 503, 0), 145);
	t.eq('and 140 at margin 5', w.circleWallLimit('level2s', 34, 503, 5), 140);
	w.can_move = (o) => (o.going_x - 34) < 52;   // a wall 52 east, open everywhere else
	t.eq('the shortest ray decides', w.circleWallLimit('level2s', 34, 503, 0), 50);
	w.can_move = () => false;
	t.eq('a blocked centre is null, not zero', w.circleWallLimit('level2s', 34, 503, 0), null);
	delete w.can_move;
	t.eq('no can_move is null', w.circleWallLimit('level2s', 34, 503, 0), null);
	const w2 = rangerWorld();
	let calls = 0;
	w2.can_move = (o) => { calls++; return room(34, 503, 150)(o); };
	w2.circleWall(CGOO, 5); const first = calls; w2.circleWall(CGOO, 5);
	t.eq('a measured limit is cached', calls, first);
	const w3 = rangerWorld();
	delete w3.can_move;
	w3.circleWall(CGOO, 5);
	w3.can_move = room(34, 503, 150);
	t.eq('a null is not cached, so it is tried again', w3.circleWall(CGOO, 5), 140);
} },

{ name: 'Dexon: on, off, no match, and the wall check refusing a radius', fn(t) {
	const w = rangerWorld();
	const p = w.circlePlan();
	t.eq('on, matching cgoo@level2s: the entry governs', [p.on, p.entry && p.entry.m, p.rD, p.wall], [true, 'cgoo', 40, 140]);
	t.eq('the word carries the entry and Dexon radius',
		[w.circleWord().on, w.circleWord().rD, w.circleWord().entry.noKite, w.circleWord().entry.x], [true, 40, true, 34]);
	t.eq('on forces circle-walking whatever the own toggle says', w.circleWalkWanted(), true);
	w.home = 'bee';
	t.eq('on with no matching entry: the default circle', [w.circlePlan().on, w.circlePlan().entry], [true, null]);
	t.eq('and the word says on with no entry', w.circleWord(), { v: 1, on: true });
	w.home = 'cgoo';
	w.CONFIG.movement.circleOverride.enabled = false;
	t.eq('off', w.circlePlan(), { on: false, entry: null });
	t.eq('off: the own toggle decides', w.circleWalkWanted(), false);
	w.CONFIG.movement.circleWalk = true;
	t.eq('off: the own toggle decides either way', w.circleWalkWanted(), true);

	const n = rangerWorld({ can_move: room(34, 503, 40) });
	const r = n.circlePlan();
	t.eq('a radius past the walls drops the entry', [r.on, r.entry, r.refused], [true, null, true]);
	n.circlePlan();
	t.eq('and says so in red once, not every tick', n.logs.filter((l) => /fails the wall check/.test(l)).length, 1);
	t.ok('naming the clear distance', /radius 40 fails the wall check \(clear 30\)/.test(n.logs.join('\n')));
	const u = rangerWorld();
	delete u.can_move;
	t.eq('an unmeasurable wall drops the entry too', u.circlePlan().entry, null);
	t.ok('saying it was unmeasured', /clear unmeasured/.test(u.logs.join('\n')));
	const by = rangerWorld();
	by.CONFIG.movement.circleOverride.whitelist[0].rBy.Dexon = 60;
	t.eq('rBy.Dexon outranks r for Dexon', by.circlePlan().rD, 60);
} },

{ name: 'the entry centre replaces the anchor; the console commands persist and re-apply', fn(t) {
	const w = rangerWorld();
	const result = { home: 'cgoo', mobMap: 'level2s', x: 40, y: 500 };
	t.eq('on: the entry centre, not the wall-pocket anchor', w.farmDestinationFor(result), { map: 'level2s', x: 34, y: 503 });
	w.farmSearchResult = result;
	w.circleOff();
	t.eq('circleOff() puts the anchor back at once', w.destination, { map: 'level2s', x: -86, y: 683 });
	t.eq('and stores the choice', w.store.circle_override_Dexon.on, false);
	t.eq('the stored choice outranks the CONFIG default', w.circlePlan().on, false);
	w.circleOn();
	t.eq('circleOn() restores the entry centre', w.destination, { map: 'level2s', x: 34, y: 503 });
	w.circleR(125);
	t.eq('circleR(125) sets Dexon radius for this entry', w.circlePlan().rD, 125);
	t.eq('stored per entry centre', w.store.circle_override_Dexon.r['level2s|34|503'], 125);
	w.circleR(145);
	t.eq('a radius past the measured 140 is refused by the wall check', w.circlePlan().entry, null);
	t.eq('and the destination falls back to the anchor', w.destination, { map: 'level2s', x: -86, y: 683 });
	w.circleR(null);
	t.eq('circleR(null) goes back to the entry radius', w.circlePlan().rD, 40);
	w.circleR(-3);
	t.ok('a bad radius is refused with a line', /positive number/.test(w.logs.join('\n')));
	w.circleOff(); w.circleForget();
	t.eq('circleForget() follows CONFIG again', w.circlePlan().on, true);
	t.eq('and stored null, not a deleted key', 'circle_override_Dexon' in w.store && w.store.circle_override_Dexon === null, true);
	const other = { home: 'bee', mobMap: 'main', x: 10, y: 20 };
	t.eq('a spot with no entry or anchor is the spawn centre', w.farmDestinationFor(other), { map: 'main', x: 10, y: 20 });
	w.home = 'bee'; w.mobMap = 'main';
	w.circleR(50);
	t.ok('circleR with no matching entry says so', /no whitelist entry matches bee@main/.test(w.logs.join('\n')));
	t.eq('circleStatus reports the plan', rangerWorld().circleStatus().entry, 'cgoo@level2s (34,503)');
} },

{ name: 'noKite takes the entry monster out of kiting, and only while active on its map', fn(t) {
	const cfg = { targets: ['cgoo', 'bscorpion'], autoBySpeed: false };
	const w = rangerWorld();
	t.eq('active on level2s: cgoo dropped', w.kiteCandidateTypes(cfg), ['bscorpion']);
	w.character.map = 'main';
	t.eq('on another map: kept', w.kiteCandidateTypes(cfg), ['cgoo', 'bscorpion']);
	w.character.map = 'level2s';
	w.CONFIG.movement.circleOverride.whitelist[0].noKite = false;
	t.eq('an entry without noKite: kept', w.kiteCandidateTypes(cfg), ['cgoo', 'bscorpion']);
	w.CONFIG.movement.circleOverride.whitelist[0].noKite = true;
	w.CONFIG.movement.circleOverride.enabled = false;
	t.eq('override off: kept', w.kiteCandidateTypes(cfg), ['cgoo', 'bscorpion']);

	/* The follower path, where cgoo arrives through autoBySpeed. */
	const f = followerWorld(MAGE, {
		parent: { entities: { a: { type: 'monster', mtype: 'cgoo' } }, G: { monsters: { cgoo: { speed: 10, range: 20 } } } },
	});
	f.character.range = 200;
	const auto = { avoidTypes: [], autoBySpeed: true, speedRatio: 1.3, attackMargin: 15 };
	t.eq('precondition: the follower derives cgoo by speed', f.kiteCandidateTypes(auto), ['cgoo']);
	f.circleOnWord(WORD);
	t.eq('with Dexon word heard it is dropped', f.kiteCandidateTypes(auto), []);
} },

{ name: 'the follower hears, validates and forgets the word', fn(t) {
	const w = followerWorld(MAGE);
	t.eq('nothing heard: no plan, own settings', w.circlePlan(), null);
	t.eq('nothing heard: own toggle', w.circleWalkWanted(), false);
	w.circleOnWord({ v: 1, on: true });
	t.eq('on with no entry: the default circle, forced on', [w.circlePlan().on, w.circlePlan().entry, w.circleWalkWanted()], [true, null, true]);
	w.circleOnWord(WORD);
	t.eq('on with the cgoo entry', [w.circlePlan().entry.m, w.circlePlan().rD, w.circlePlan().wall], ['cgoo', 40, 140]);
	w.circleHeard.at = Date.now() - 75001;
	t.eq('a word older than the trust window is dropped', w.circlePlan(), null);
	w.circleOnWord(WORD);
	w.circleOnWord({ on: 'yes' });
	t.eq('a malformed word is ignored, the last good one stands', w.circlePlan().entry.m, 'cgoo');
	w.circleOnWord({ v: 1, on: true, rD: 40, entry: Object.assign({}, CGOO, { x: '34' }) });
	t.eq('an entry with a bad field is not half-used', w.circlePlan().entry, null);
	w.circleOnWord({ v: 1, on: false });
	t.eq('off: own settings again, without waiting for the window', [w.circlePlan().on, w.circleWalkWanted()], [false, false]);
	w.circleOnWord(undefined);
	t.eq('a farm_spot from an older Dexon carries no word and changes nothing', w.circlePlan().on, false);
	const nw = followerWorld(MAGE);
	delete nw.can_move;
	nw.circleOnWord(WORD);
	t.eq('walls it cannot measure: default circle', [nw.circlePlan().entry, nw.circlePlan().refused], [null, true]);
	nw.circlePlan();
	t.eq('said once in red', nw.logs.filter((l) => /cannot measure the walls/.test(l)).length, 1);
} },

{ name: 'follower radius: same angle per second as Dexon, rBy wins, capped at the walls', fn(t) {
	const w = followerWorld(MAGE);
	w.circleOnWord(WORD);
	const p = w.circlePlan();
	t.eq('MageofOz 57 against Dexon 66 at 40', Math.round(w.circleFollowerRadius(p, 66) * 100) / 100, 34.55);
	w.character.speed = 74;
	t.eq('a buffed follower rides outside him', Math.round(w.circleFollowerRadius(p, 66) * 100) / 100, 44.85);
	const big = followerWorld(MAGE);
	big.circleOnWord(Object.assign({}, WORD, { rD: 130 }));
	big.character.speed = 80;
	t.eq('capped at the measured wall limit', big.circleFollowerRadius(big.circlePlan(), 66), 140);
	const by = followerWorld(MAGE);
	by.circleOnWord(Object.assign({}, WORD, { entry: Object.assign({}, CGOO, { rBy: { MageofOz: 20 } }) }));
	t.eq('rBy for this character outranks the scaling', by.circleFollowerRadius(by.circlePlan(), 66), 20);
	t.eq('and never below the floor', followerWorld(MAGE, {}).circleFollowerRadius({ entry: { rBy: { MageofOz: 2 } }, rD: 40, wall: 140 }, 66), 10);
	t.eq('an unknown Dexon speed keeps the radius', followerWorld(MAGE).circleFollowerRadius({ entry: CGOO, rD: 40, wall: 140 }, 0), 40);
} },

{ name: 'fear does not shrink the ring: both speeds are taken with fear removed', fn(t) {
	const w = followerWorld(PRIEST);
	t.eq('the server table: -20 a level to 2, then 70, 80, 90, 100', [0, 1, 2, 3, 4, 5, 6, 9].map((f) => w.speedWithoutFear(10, f)),
		[10, 30, 50, 80, 90, 100, 110, 110]);
	t.eq('no fear field is no fear', w.speedWithoutFear(43, undefined), 43);
	t.eq('an unknown speed is passed through, not invented', w.speedWithoutFear(0, 2), 0);
	/* The browser session's FatherToken: 63 clean, 43 at fear 1, 23 at fear 2. */
	w.character = Object.assign(w.character, { name: 'FatherToken', speed: 63, fear: 0 });
	w.circleOnWord(Object.assign({}, WORD, { sD: 67 }));
	const p = w.circlePlan();
	t.eq('the word carries sD through to the plan', p.sD, 67);
	const clean = w.circleFollowerRadius(p, 67);
	w.character.speed = 43; w.character.fear = 1;
	t.eq('fear 1: the same radius', w.circleFollowerRadius(p, 67), clean);
	w.character.speed = 23; w.character.fear = 2;
	t.eq('fear 2: the same radius', w.circleFollowerRadius(p, 67), clean);
	t.eq('Dexon frightened too: his live entity speed is not used while sD is known', w.circleFollowerRadius(p, 47), clean);
	const old = followerWorld(PRIEST);
	old.character = Object.assign(old.character, { name: 'FatherToken', speed: 43, fear: 1 });
	old.circleOnWord(WORD);
	t.eq('a word without sD: his entity speed stands in', old.circlePlan().sD, null);
	t.eq('and the follower side is still fear-free', Math.round(old.circleFollowerRadius(old.circlePlan(), 63) * 100) / 100, 40);
	const bad = followerWorld(PRIEST);
	bad.circleOnWord(Object.assign({}, WORD, { sD: 'fast' }));
	t.eq('a malformed sD is dropped, not used', bad.circlePlan().sD, null);
	const r = rangerWorld();
	r.character.speed = 46; r.character.fear = 1;
	t.eq('Dexon sends his own speed with fear removed', r.circleWord().sD, 66);
	const k1 = r.circleWordKey();
	r.character.speed = 86;
	t.eq('the farm-spot key ignores sD, so a speed buff does not restart the re-sends', r.circleWordKey(), k1);
	t.ok('but the word itself carries the new value', r.circleWord().sD === 106);
	t.ok('and the key still holds the entry', /"rD":40/.test(k1) && k1.indexOf('sD') < 0);
} },

{ name: 'between waves an active entry holds the ring rather than parking on the centre', fn(t) {
	const w = followerWorld(MAGE);
	t.eq('no word: nothing held', w.circleHoldsSpot(), false);
	w.circleOnWord(WORD);
	Object.assign(w.character, { real_x: 34 + 35, real_y: 503 });
	t.eq('on the ring: held', w.circleHoldsSpot(), true);
	Object.assign(w.character, { real_x: 34 + 140 + 40, real_y: 503 });
	t.eq('at wall + slack: held', w.circleHoldsSpot(), true);
	Object.assign(w.character, { real_x: 34 + 140 + 41, real_y: 503 });
	t.eq('beyond it: handleReturnHome() takes us back', w.circleHoldsSpot(), false);
	Object.assign(w.character, { real_x: 34, real_y: 503, map: 'main' });
	t.eq('another map: not held', w.circleHoldsSpot(), false);
	w.character.map = 'level2s';
	w.circleOnWord({ v: 1, on: true });
	t.eq('on with no entry: not held', w.circleHoldsSpot(), false);
	const r = rangerWorld();
	Object.assign(r.character, { x: 74, y: 503 });
	t.eq('Dexon on his ring: held', r.circleHoldsSpot(), true);
	r.CONFIG.movement.circleOverride.enabled = false;
	t.eq('Dexon with the override off: not held', r.circleHoldsSpot(), false);
	const gate = 'if (!get_nearest_monster({ type: home }) && !circleHoldsSpot()) {\n\t\t\t\thandleReturnHome();';
	for (const f of [RANGER, PRIEST, MAGE]) {
		const s = src(f);
		t.eq(f + ': the return-home branch is gated on circleHoldsSpot()', s.split(gate).length - 1, 1);
		t.eq(f + ': and no ungated copy remains', s.split('if (!get_nearest_monster({ type: home })) {\n\t\t\t\thandleReturnHome();').length - 1, 0);
	}
} },

{ name: 'the intercept: ahead on the ring when in phase, a chord when behind', fn(t) {
	const w = followerWorld(MAGE);
	const c = { x: 0, y: 0 }, R = 40, wd = 66 / 40;
	const inPhase = w.circleIntercept(c, R, 0, wd, { x: 40, y: 0 }, 66, 0.5, 6);
	t.eq('in phase: the first candidate, half a second ahead', [inPhase.ok, inPhase.t], [true, 0.5]);
	t.ok('which is ahead of him on the ring', Math.atan2(inPhase.y, inPhase.x) > 0);
	const centre = w.circleIntercept(c, R, 0, wd, { x: 0, y: 0 }, 57, 0.5, 6);
	t.eq('from the centre the ring is R away', [centre.ok, centre.t], [true, 0.8]);
	const behind = w.circleIntercept(c, R, Math.PI / 2, wd, { x: 40, y: 0 }, 57, 0.5, 6);
	t.eq('behind him: reached across the middle', behind.ok, true);
	t.ok('at a point he has not reached yet', w.circleAngleDiff(Math.atan2(behind.y, behind.x), Math.PI / 2) > 0);
	const far = w.circleIntercept(c, R, 0, wd, { x: 5000, y: 0 }, 57, 0.5, 6);
	t.eq('out of reach: the last point, flagged', [far.ok, Math.round(far.t * 10) / 10], [false, 6]);
	t.eq('angle difference wraps', Math.round(w.circleAngleDiff(0.1, 2 * Math.PI - 0.1) * 100) / 100, 0.2);
} },

{ name: 'the follow step walks, waits, and falls back', fn(t) {
	const mk = (me, dexAt) => {
		const w = followerWorld(MAGE);
		w.circleOnWord(WORD);
		Object.assign(w.character, { real_x: me.x, real_y: me.y });
		if (dexAt) w.parent.entities.Dexon = { real_x: dexAt.x, real_y: dexAt.y, speed: 66 };
		return w;
	};
	const R = 40 * 57 / 66;
	/* Dexon at angle 0 on his ring, MageofOz on hers a quarter turn ahead. */
	const ahead = mk({ x: 34, y: 503 + R }, { x: 74, y: 503 });
	ahead.circleStep();
	t.eq('ahead of him on her ring: she waits', [ahead.moves.length, ahead.circles.length], [0, 0]);
	const behind = mk({ x: 34, y: 503 - R }, { x: 74, y: 503 });
	behind.circleStep();
	t.eq('behind him: she moves', behind.moves.length, 1);
	t.ok('to a point on her ring', Math.abs(Math.hypot(behind.moves[0].x - 34, behind.moves[0].y - 503) - R) < 0.01);
	const gone = mk({ x: 34, y: 503 }, null);
	gone.circleStep();
	t.eq('Dexon not in sight: the plain circle', [gone.moves.length, gone.circles.length], [0, 1]);
	const busy = mk({ x: 34, y: 503 - R }, { x: 74, y: 503 });
	busy.character.moving = true;
	busy.circleStep();
	t.eq('already moving: nothing new', busy.moves.length, 0);
	const elsewhere = mk({ x: 34, y: 503 }, { x: 74, y: 503 });
	elsewhere.character.map = 'main';
	elsewhere.circleStep();
	t.eq('the entry is for another map: the plain circle', [elsewhere.moves.length, elsewhere.circles.length], [0, 1]);
	const off = followerWorld(MAGE);
	off.circleStep();
	t.eq('no word: the plain circle', off.circles.length, 1);
} },

{ name: 'the wiring: who calls what', fn(t) {
	const r = src(RANGER);
	t.ok('Ranger: the movement branch asks circleWalkWanted()', /if \(!kited && circleWalkWanted\(\)\) walkInCircle\(\);\n\t\t\t\} else if \(circleWalkWanted\(\)\) \{\n\t\t\t\twalkInCircle\(\);/.test(r));
	t.ok('Ranger: no movement branch reads circleWalk directly', !/&& CONFIG\.movement\.circleWalk\) walkInCircle/.test(r));
	t.ok('Ranger: walkInCircle centres on an active entry', extract(RANGER, 'walkInCircle').indexOf('const center = ent || destination, r = ent ? p.rD : CONFIG.movement.circleRadius') >= 0);
	t.ok('Ranger: the farm search goes through farmDestinationFor', extract(RANGER, 'runFarmSearch').indexOf('destination = farmDestinationFor(result);') >= 0);
	t.ok('Ranger: the farm_spot payload carries the word', extract(RANGER, 'sendFarmSpot').indexOf('circle: circleWord(),') >= 0);
	t.ok('Ranger: and the key includes it, so a change is sent at once', extract(RANGER, 'farmSpotKey').indexOf('|${circleWordKey()}`') >= 0);
	t.ok('Ranger: the cgoo entry as designed', r.indexOf("{ m: 'cgoo', map: 'level2s', x: 34, y: 503, r: 40, rBy: { FatherToken: null, MageofOz: null }, noKite: true },") >= 0);
	for (const f of [PRIEST, MAGE]) {
		const s = src(f);
		t.ok(f + ': the movement branch calls circleStep()', /if \(!kited && circleWalkWanted\(\)\) circleStep\(\);/.test(s) && /\} else if \(circleWalkWanted\(\)\) \{\n\t\t\t\tcircleStep\(\);/.test(s));
		t.ok(f + ': the farm_spot handler hands the word on', /circleOnWord\(data\.circle\);/.test(s));
		t.eq(f + ': and only there', (s.match(/circleOnWord\(/g) || []).length, 2);
	}
} },

];
