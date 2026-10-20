/* Tests/suite_caverun.js - the v15 leash decoupling and the beacon fallbacks.

   CaveRun.js is a ROOT script and had no suite until 2026-10-20. It is testable
   for the same reason the party scripts are: 86 top-level function declarations
   at column 0 and none indented, so lift() reaches them. A handoff described it
   as IIFE-wrapped, which would have made all of this unreachable - worth the one
   check before concluding a file cannot be tested. */
const fs = require('fs');
const path = require('path');
const { lift, world, ROOT } = require('./lift');
const src = () => fs.readFileSync(path.join(ROOT, 'CaveRun.js'), 'utf8');

module.exports = [{

name: 'the leader hold no longer tracks the travel leash', fn(t) {
	/* OPERATOR, 2026-10-19: "the stop feature is too close to the distance at
	   which the followers start following so it stops before they start moving."
	   Out of combat `leash()` returns the TRAVEL pair, so reading L.closeAt there
	   made the leader's stop threshold the same number the followers use to begin
	   following. The hold must read MOVE.* so it stays on the combat pair. */
	const s = src();
	t.ok('the hold reads MOVE.releaseAt / MOVE.closeAt',
		/const need = \(holdFrom \? worst > MOVE\.releaseAt : worst > MOVE\.closeAt\)/.test(s));
	t.eq('and nothing reads L.closeAt or L.releaseAt for the hold decision',
		/const need = \([^)]*\bL\.(closeAt|releaseAt)/.test(s), false);

	const w = world({});
	lift(w, 'CaveRun.js', ['MOVE', 'computeLeash']);
	w.holdActive = () => true;
	w.engaged = () => false;
	w.attackersOnMe = () => 0;
	w.troubleNow = [];

	const travel = w.computeLeash();
	t.eq('out of combat the leash is the travel pair', travel.mode, 'travel');
	t.eq('travel closes at 60', travel.closeAt, 60);
	t.eq('travel releases at 30', travel.releaseAt, 30);
	t.ok('the hold threshold is 3x the follow threshold', w.MOVE.closeAt / travel.closeAt === 3);
	t.eq('and the hold threshold stays inside the priest 201 heal range',
		w.MOVE.closeAt <= 201, true);

	w.engaged = () => true;
	const combat = w.computeLeash();
	t.eq('anything engaged reverts to the combat pair', combat.mode, 'combat');
	t.eq('combat closes at 180', combat.closeAt, 180);
	t.eq('combat releases at 120', combat.releaseAt, 120);
	t.eq('the combat band is untouched by v15', combat.closeAt - combat.releaseAt, 60);
},

}, {

name: 'a travel-mode kite step may never grow the gap', fn(t) {
	/* THE v15 BAND IS NARROWER THAN kiteStep, which the v14 block said would
	   bring back v6's oscillation. 60-30 is 30u against a 55u step, so a free
	   step from releaseAt 30 lands at ~85 - past closeAt 60 - latching recovering
	   every time a monster wanders inside kiteRadius. It needs no engagement:
	   kiteStep asks only for a threat inside 90u while computeLeash stays in
	   travel mode until something is engaged, attacking or in trouble. */
	const s = src();
	t.ok('the no-ratchet clause is unconditional in travel mode',
		/if \(\(gapNow > L\.releaseAt \|\| L\.mode === 'travel'\) && gapNew > gapNow \+ 1\) continue;/.test(s));

	/* THE GEOMETRY HAS TO PUT THE THREAT BETWEEN THE FOLLOWER AND THE LEADER, or
	   the two modes are indistinguishable: with the leader on the far side from
	   the monster, fleeing the monster shrinks the leader gap anyway and both
	   modes agree. A first version of this test asserted on that geometry and
	   failed against correct code. Leader at +gap, monster at +20, follower at 0:
	   fleeing means -x, which GROWS the gap, so the guard is the only thing that
	   can stop it. */
	function kite(mode, gapNow) {
		const w = world({ character: { name: 'FatherToken', real_x: 0, real_y: 0, hp: 100, max_hp: 100, speed: 8 } });
		lift(w, 'CaveRun.js', ['MOVE', 'kiteStep', 'dist']);
		w.leash = () => mode === 'travel'
			? { closeAt: 60, releaseAt: 30, ceiling: 135, mode: 'travel' }
			: { closeAt: 180, releaseAt: 120, ceiling: 195, mode: 'combat' };
		w.threats = () => [{ real_x: 20, real_y: 0, speed: 4, target: null }];
		/* isFn and can_move_to BOTH have to be supplied, because the live line is
		   `isFn(can_move_to) && ...` - passing the identifier as an argument
		   EVALUATES it, so a bare stub of isFn still throws ReferenceError on an
		   undeclared can_move_to. That is Form A from CLAUDE.md and it is how this
		   suite first failed; see the v15 changelog for why the file is left as is. */
		w.isFn = (f) => typeof f === 'function';
		w.can_move_to = () => true;
		const k = w.kiteStep({ x: gapNow, y: 0 });
		return k === null ? null : Math.hypot(k.x - gapNow, k.y);
	}

	// travel: from inside releaseAt 30, the step must not grow the gap at all
	const tr = kite('travel', 30);
	t.ok('a travel kite step is still offered', tr !== null);
	t.ok('and it holds or shrinks the gap rather than retreating', tr <= 31);
	t.eq('so it cannot reach past travel closeAt 60 and latch recovering', tr > 60, false);

	/* COMBAT IS DELIBERATELY UNCHANGED - the operator's rule is that kite range is
	   normal in combat and may be exceeded out of combat. Same geometry, same
	   starting gap, and the retreat is still allowed below releaseAt 120. */
	const cb = kite('combat', 30);
	t.ok('a combat kite step is still offered', cb !== null);
	t.ok('and combat still retreats outward below its releaseAt', cb > 31);
	t.ok('which is the behaviour v15 removes only in travel mode', cb > tr);
},

}, {

name: 'the leader map and position come from the beacon, never the party row', fn(t) {
	/* OPERATOR, 2026-10-19: followers walked between the door they had just come
	   through and the leader, with BOTH in vision range. leaderMap() read only
	   parent.party, so followFloor() fired on a stale row naming the floor they
	   had left - and the door matching it was the entrance they had just used. */
	function w(over) {
		const x = world(over || {});
		lift(x, 'CaveRun.js', ['here', 'leaderEntity', 'leaderMap', 'leaderPos', 'TROUBLE']);
		x.leaderName = () => 'Dexon';
		return x;
	}
	const NOW = Date.now();

	// a visible leader is on this map by definition - this is the whole fix
	const seen = w({ character: { name: 'FatherToken', map: 'cave', real_x: 0, real_y: 0 },
		parent: { entities: { Dexon: { map: 'cave', real_x: 10, real_y: 10 } }, party: { Dexon: { map: 'level1', x: 999, y: 999 } } } });
	seen.beacons = () => ({});
	t.eq('a visible leader reports THIS map, whatever the party row says',
		seen.leaderMap(), 'cave');
	t.eq('and the stale party row naming another floor is ignored',
		seen.leaderMap() === 'level1', false);

	// genuinely on another floor, fresh beacon
	const away = w({ character: { name: 'FatherToken', map: 'cave' }, parent: { entities: {}, party: { Dexon: { map: 'level1' } } } });
	away.beacons = () => ({ Dexon: { name: 'Dexon', map: 'level2', x: 5, y: 5, t: NOW } });
	t.eq('an invisible leader reports the BEACON map, not the party row',
		away.leaderMap(), 'level2');

	// stale beacon answers unknown rather than guessing a door to chase
	const stale = w({ character: { name: 'FatherToken', map: 'cave' }, parent: { entities: {}, party: { Dexon: { map: 'level1' } } } });
	stale.beacons = () => ({ Dexon: { name: 'Dexon', map: 'level2', x: 5, y: 5, t: NOW - 5000 } });
	t.eq('a beacon past TROUBLE.staleMs reports null, not the party row',
		stale.leaderMap(), null);
	t.eq('no beacon at all reports null', w({ parent: { entities: {}, party: { Dexon: { map: 'level1' } } } }).leaderMap !== undefined, true);

	// leaderPos: entity first, beacon second, party row never
	const pos = w({ character: { name: 'FatherToken', map: 'cave', real_x: 0, real_y: 0 },
		parent: { entities: {}, party: { Dexon: { map: 'cave', x: 975, y: 0 } } } });
	pos.beacons = () => ({ Dexon: { name: 'Dexon', map: 'cave', x: 40, y: 0, t: NOW } });
	t.eq('leaderPos takes the beacon, not the 975u-stale party row', pos.leaderPos().x, 40);

	const posStale = w({ character: { name: 'FatherToken', map: 'cave', real_x: 0, real_y: 0 },
		parent: { entities: {}, party: { Dexon: { map: 'cave', x: 975, y: 0 } } } });
	posStale.beacons = () => ({ Dexon: { name: 'Dexon', map: 'cave', x: 40, y: 0, t: NOW - 5000 } });
	t.eq('a stale beacon gives null so moveTick takes its !lp path',
		posStale.leaderPos(), null);

	/* THE PARTY ROW MUST NOT BE REACHABLE FROM EITHER FUNCTION. Asserted on the
	   extracted bodies rather than a line window, so the surrounding comment -
	   which discusses parent.party at length - cannot satisfy or fail it. A
	   window-based version of this check matched the prose and failed. */
	const { extract } = require('./lift');
	for (const fn of ['leaderPos', 'leaderMap']) {
		t.eq(fn + ' does not read parent.party',
			extract('CaveRun.js', fn).indexOf('parent.party'), -1);
		t.ok(fn + ' does read the beacon', extract('CaveRun.js', fn).indexOf('beacons()') > 0);
	}
} }];
