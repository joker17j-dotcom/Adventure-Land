/* Tests/suite_caverun.js - the v15 leash decoupling and the beacon fallbacks.

   CaveRun.js is a ROOT script and had no suite until 2026-10-20.

   IT IS TESTABLE BECAUSE ITS DECLARATIONS SIT AT COLUMN 0, WHICH IS A DIFFERENT
   QUESTION FROM WHETHER THE FILE IS WRAPPED - and this comment asserted the
   wrong one first. lift() anchors every pattern at ^, so column position is all
   it needs; CaveRun.js IS IIFE-wrapped and the suite works anyway. Measured by
   brace depth 2026-10-20: `(function () {` at :60, `})();` at the last line, and
   all 95 column-0 `function` declarations at DEPTH 1. The file says so itself at
   :52 - "EVERYTHING IS WRAPPED IN AN IIFE" - eight lines above the opener, and
   neither session read the head of the file before arguing about it.
   What wrapping DOES decide is whether the internals are reachable by indirect
   eval from the live CODE context. CaveRun's are not, so a live probe goes
   through its window.* exports - caveDump(), caveStatus(), caveLeash() - while
   the four party scripts are genuinely unwrapped (column-0 declarations at depth
   0) and expose PARTY_SCRIPT directly. */
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
	   following. The hold must read a FIXED pair rather than the mode-selected
	   one - that is the durable half of this assertion, and v18 moved WHICH
	   fixed pair without touching it. */
	const s = src();
	t.ok('the hold reads its OWN pair, MOVE.holdReleaseAt / MOVE.holdAt',
		/const need = \(holdFrom \? worst > MOVE\.holdReleaseAt : worst > MOVE\.holdAt\)/.test(s));
	t.eq('and nothing reads L.closeAt or L.releaseAt for the hold decision',
		/const need = \([^)]*\bL\.(closeAt|releaseAt)/.test(s), false);
	/* THE PREVIOUS FORM, KEPT SO THE SEPARATION CANNOT BE HALF-REVERTED. Until
	   v18 this read MOVE.releaseAt / MOVE.closeAt, which is the pair the
	   FOLLOWERS' combat band is built from - so the hold released at the exact
	   gap at which a follower decides to start closing, 60u before they were
	   gathered. 142 holds and 571s held in one 24-minute run. */
	t.eq('the shared-constant form is gone',
		/const need = \(holdFrom \? worst > MOVE\.releaseAt/.test(s), false);

	const w = world({});
	lift(w, 'CaveRun.js', ['MOVE', 'computeLeash']);
	w.holdActive = () => true;
	w.engaged = () => false;
	w.attackersOnMe = () => 0;
	w.troubleNow = [];

	const travel = w.computeLeash();
	t.eq('out of combat the leash is the travel pair', travel.mode, 'travel');

	t.eq('holdAt matches closeAt deliberately - the TRIGGER did not change',
		w.MOVE.holdAt, w.MOVE.closeAt);

	/* THIS BLOCK ASSERTED "THE SEPARATION HAS TO HAVE AN EFFECT, OR IT IS
	   CEREMONY" AND THE EFFECT IT DEMANDED WAS MEASURED IMPOSSIBLE. v18 set
	   holdReleaseAt to 30 and pinned `holdReleaseAt < releaseAt`; the live run
	   gave holds 8 and holdGaveUp 5, and because the give-up LATCHES the leader
	   then stopped holding at all. So the suite was pinning a belief, not a
	   mechanism, and the operator's hand-patch to 120 correctly failed it.
	   THE FLOOR IS THE FOLLOWERS' OWN releaseAt, and the coupling is one-way: a
	   follower stops closing at HIS releaseAt, so the hold's exit condition can
	   only be satisfied by movement that stops there and no lower value is
	   reachable at any timeout. Assert the FLOOR, which is a property of the
	   coupling, rather than a gap, which was a guess. */
	t.ok('holdReleaseAt is at or above the followers\u2019 release - the measured floor',
		w.MOVE.holdReleaseAt >= w.MOVE.releaseAt);
	/* THE FALSIFIED FORM, KEPT SO IT CANNOT BE REINSTATED AS AN IMPROVEMENT.
	   Tightening the leader's release below the followers' looks like exactly
	   the fix a reader of the v18 rationale would reach for, and it is the thing
	   that broke. */
	t.eq('the sub-release form that could never complete a hold is gone',
		w.MOVE.holdReleaseAt < w.MOVE.releaseAt, false);
	t.eq('and 30 specifically, which was v18\u2019s value', w.MOVE.holdReleaseAt === 30, false);

	/* SO THE SEPARATION IS NUMERICALLY INERT AND STRUCTURALLY LIVE, which is a
	   state the previous assertion had no way to express. What it still buys is
	   a threshold the hold owns, movable without dragging the kite rejection and
	   the close-step sizing with it - so the STRUCTURE is what gets pinned now,
	   and the value is free to move UP, which is the untested direction. */
	t.ok('the hold still reads its own constants, inert value or not',
		/MOVE\.holdReleaseAt/.test(s) && /MOVE\.holdAt/.test(s));
	t.ok('the followers\u2019 combat band still comes from closeAt/releaseAt',
		/closeAt: MOVE\.closeAt, releaseAt: MOVE\.releaseAt/.test(s));

	/* RAISING THE OUT-OF-COMBAT TRIGGER IS OPTION B AND IS THE OPERATOR'S CALL,
	   STILL HELD. A single constant cannot express it: the hold reads one
	   threshold for both modes, so raising it to their 240 would also raise the
	   IN-COMBAT stop and put a lagging follower outside the priest's measured
	   201 heal range. Four constants with mode selection is the shape; it is not
	   built, and this assertion records that it is not. */
	t.eq('Option B is NOT built - no travelHoldAt exists',
		/travelHoldAt|travelHoldReleaseAt/.test(s), false);
	t.ok('the hold threshold stays inside the priest heal range of 201',
		w.MOVE.holdAt < 201);
	t.eq('travel closes at 60', travel.closeAt, 60);
	t.eq('travel releases at 30', travel.releaseAt, 30);

	/* THE OSCILLATION INVARIANT, the browser session's 2026-10-21 finding, which
	   explains both shipped bands and is the thing any future band change has to
	   respect: the sawtooth fires when `releaseAt + kiteStep > closeAt`. A
	   follower sitting at releaseAt takes a free outward kite step - the
	   no-ratchet guard is INACTIVE below releaseAt in combat - and if that step
	   lands past closeAt he latches and closes back in, forever.
	     combat 120 + 55 = 175 < 180  safe, BY FIVE UNITS
	     travel  30 + 55 =  85 >  60  violates, and survives only because the
	                                  no-ratchet is UNCONDITIONAL in travel
	   So combat satisfies it ACCIDENTALLY with five units of margin, and the
	   tight band plus the unconditional no-ratchet are ONE change rather than
	   two. Pinned in both directions so neither half can land alone. */
	t.ok('the combat band satisfies the oscillation invariant',
		w.MOVE.releaseAt + w.MOVE.kiteStep < w.MOVE.closeAt);
	t.eq('the travel band does NOT, which is why it needs the unconditional rule',
		w.MOVE.travelReleaseAt + w.MOVE.kiteStep < w.MOVE.travelCloseAt, false);
	t.ok('so travel exempts itself from the no-ratchet gate by mode, not by gap',
		/gapNow > L\.releaseAt \|\| L\.mode === 'travel'/.test(s));
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
} },

{

name: 'the version is read from line 1 and fails null, never wrong', fn(t) {
	/* `ver: 14` was hardcoded while v16 was live and a session reported a deploy
	   against it. Replaced by a read of line 1 - but the merchant's recipe does
	   not port straight, and each of the three differences below is a way to get
	   a CONFIDENT WRONG NUMBER rather than a failure. Those are what this pins.
	   -> CLAUDE.md "The cave run" */
	const LIVE = '// CaveRun.js - one script for Dexon / FatherToken / MageofOz - v16 (TEST BUILD)';
	const names = ['caveHeaderLine', 'caveHeaderVersion', 'caveVerCache', 'caveVersion', 'caveBuild'];
	const buf = (text) => {
		const w = world({ parent: { codemirror_render: { getValue: () => text } } });
		lift(w, 'CaveRun.js', names);
		return w;
	};

	t.eq('reads its own header', buf(LIVE + '\nbody\n').caveVersion(), 16);
	t.eq('and reports line 1 verbatim rather than a derived number',
		buf(LIVE + '\nbody\n').caveBuild(), LIVE);

	/* THE REAL FILE'S OWN LINE 1 IS PINNED AGAINST THE READER THAT PARSES IT.
	   Every other fixture here is synthetic, so without this the header could be
	   reshaped - a renamed marker, a moved version, a reflowed suffix - and the
	   reader would go null forever with the whole suite still green. */
	const realLine1 = src().split('\n')[0];
	const realW = buf(src());
	t.ok('the committed header still matches the live marker',
		/^\/\/ CaveRun\.js\b/.test(realLine1));
	t.ok('and the committed header still yields a version number',
		typeof realW.caveVersion() === 'number' && realW.caveVersion() > 0);
	t.eq('caveBuild on the real file returns line 1 verbatim',
		realW.caveBuild(), realLine1);

	/* TRAP 1: THE HEADER ACCUMULATES HISTORY, so any read taking the LAST match
	   returns the OLDEST entry - the OpenGifts failure that returned 2 against a
	   v11 build. The inverted assertion is kept beside it so the pairing stays
	   visible: a scan would return 3 on this fixture, and line 1 returns 16. */
	const hist = LIVE + '\n// v15 2026-10-18 travel leash\n// v3 2026-10-02 older\nbody';
	t.eq('a history-carrying header still reads 16 from line 1', buf(hist).caveVersion(), 16);
	const scanLast = (hist.match(/^\/\/ v(\d+)\b/gm) || []).pop();
	t.eq('...where a header SCAN would have returned the oldest entry', scanLast, '// v3');

	/* TRAP 2: line 1 ends "(TEST BUILD)", so the merchant's end-anchored pattern
	   finds nothing here. Asserted directly, because a reader porting that
	   function would otherwise ship a reader that is null forever. */
	t.eq('the merchant end-anchored pattern does NOT match this header',
		/\bv(\d+)\s*$/.test(LIVE), false);

	/* TRAP 3: the buffer reports the slot the EDITOR has loaded, not the script
	   executing. Without the file marker in the pattern this reads another
	   script's header and caches it. FAIL-NULL is the whole point. */
	const foreign = '// Ranger.js - Dexon - v105\n// slot header line 2\nbody';
	t.eq('a foreign buffer yields null, not that script\'s version',
		buf(foreign).caveVersion(), null);
	t.eq('and caveBuild refuses to report a foreign line 1 raw',
		buf(foreign).caveBuild(), null);
	const naive = foreign.split('\n')[0].match(/v(\d+)/);
	t.eq('...where an unmarked pattern would have returned 105', naive && naive[1], '105');

	/* The pre-slot window: the tutorial template occupies the buffer for ~1.8-2.2s
	   after a cold load. It must be null rather than anything, because the cache
	   below keeps the first NON-null answer. */
	t.eq('the tutorial template reads null',
		buf('// This is CODE, lets you control your character with code.\nbody').caveVersion(), null);

	/* And the absent-buffer case. The field is DELETED after the lift rather than
	   passed as an override, because world() merges its own parent over one and a
	   test of a merged-away precondition is a test of nothing. */
	const gone = buf(LIVE);
	delete gone.parent.codemirror_render;
	t.eq('precondition: the buffer really is absent', gone.parent.codemirror_render, undefined);
	t.eq('an absent buffer reads null', gone.caveVersion(), null);

	/* THE CACHE RETRIES NULL AND KEEPS THE FIRST NON-NULL, which is what makes an
	   early construction-time read safe. Driven through one world whose buffer
	   changes under it, rather than asserted on the source text. */
	let text = '// tutorial\nbody';
	const w = world({ parent: { codemirror_render: { getValue: () => text } } });
	lift(w, 'CaveRun.js', names);
	t.eq('null while the slot has not arrived', w.caveVersion(), null);
	text = LIVE + '\nbody';
	t.eq('the retry picks it up once the slot lands', w.caveVersion(), 16);
	text = '// CaveRun.js - one script - v99 (TEST BUILD)\nbody';
	t.eq('and a later save_code cannot shift it under the running build',
		w.caveVersion(), 16);
} },

{

name: 'caveLeash reports every field it names - no duplicate object keys', fn(t) {
	/* v18 RETURNED `hold:` TWICE from caveLeash and the LATER literal silently
	   won, so the pair it had just added for observability never reached a
	   reader - and a deploy probe written against that pair answered "not
	   deployed" for a build that WAS deployed. Object-literal form of the
	   serverhop_logic double-declaration trap, in the one file whose own header
	   documents that trap.
	   THE DEPLOY LESSON IS THE EXPENSIVE HALF AND IT IS NOT TESTABLE HERE: a
	   feature added in the same commit as the behaviour it reports is the worst
	   possible probe for that behaviour, because nothing has ever confirmed it
	   reaches a reader. What IS testable is the duplicate, so that is pinned.
	   Depth-tracked rather than regexed, because the keys are not one per line
	   (`mode: L.mode, closeAt: L.closeAt, ...` share a line) and nested objects
	   legitimately reuse names - `closeAt` appears inside travel, combat AND at
	   the top level, so a flat scan would report three false duplicates. */
	const s = src();
	const open = s.indexOf('function caveLeash');
	t.ok('caveLeash is in the committed file', open >= 0);
	const retAt = s.indexOf('return {', open);
	t.ok('and it returns an object literal', retAt > open);

	// Walk the literal, collecting identifiers followed by ':' at depth 1 only.
	let depth = 0, i = retAt + 'return '.length, keys = [], tok = '';
	for (; i < s.length; i++) {
		const c = s[i];
		if (c === '{' || c === '[' || c === '(') { depth++; tok = ''; continue; }
		if (c === '}' || c === ']' || c === ')') { depth--; tok = ''; if (depth === 0) break; continue; }
		if (depth !== 1) continue;
		if (/[A-Za-z0-9_$]/.test(c)) { tok += c; continue; }
		if (c === ':' && tok) keys.push(tok);
		tok = '';
	}
	t.eq('the literal closed, so the walk covered it', depth, 0);
	t.ok('and it found the keys a reader expects', keys.includes('hold') && keys.includes('mode'));

	const dupes = keys.filter((k, n) => keys.indexOf(k) !== n);
	t.eq('no top-level key is declared twice', dupes.join(','), '');
	t.eq('`hold` in particular appears exactly once',
		keys.filter((k) => k === 'hold').length, 1);
	/* THE WALK HAS TO BE ABLE TO SEE A DUPLICATE, or the assertion above passes
	   on a broken detector - the degenerate-setup trap this suite already
	   records for the kiting comparison. Same collector, v18's actual text. */
	const broken = ['mode', 'hold', 'trouble', 'hold'];
	t.eq('the detector reports a duplicate when there is one',
		broken.filter((k, n) => broken.indexOf(k) !== n).join(','), 'hold');
} }, {

name: 'followers start on leader MOTION, without the recovering latch', fn(t) {
	/* ITEM 3. The reaction delay is closeAt/leaderSpeed + tickMs/2 - 2.9s at the
	   committed closeAt 180 - and the follower is not reacting late: waiting for
	   closeAt IS his trigger. This gives an earlier one without moving closeAt,
	   and without touching kiting, which is why the operator's ruling on item 2
	   never applied to it. */
	const s = src();
	const moved = [];
	function w(over) {
		over = over || {};
		const x = world({
			character: { name: 'Dexon', map: 'cave', real_x: 0, real_y: 0 },
			move: (mx, my) => moved.push([Math.round(mx), Math.round(my)]),
			can_move_to: over.blocked ? () => false : () => true,
			isFn: (f) => typeof f === 'function',
			bump: () => {},
			leash: () => ({ closeAt: 180, releaseAt: 120, mode: 'combat' }),
			smart_move: () => { throw new Error('followStep must never call smart_move'); },
		});
		lift(x, 'CaveRun.js', ['MOVE', 'noteLeaderMotion', 'leaderMoving', 'followStep']);
		x.leaderSeen = null;
		x.leaderMovedAt = 0;
		return x;
	}

	/* --- the inference ---------------------------------------------------- */
	let x = w();
	t.eq('precondition: nothing seen yet reads as not moving', x.leaderMoving(), false);
	x.noteLeaderMotion({ x: 0, y: 0 });
	t.eq('one reading alone is not motion - there is nothing to difference',
		x.leaderMoving(), false);
	x.noteLeaderMotion({ x: 0, y: 0 });
	t.eq('and a leader standing still stays not-moving', x.leaderMoving(), false);
	x.noteLeaderMotion({ x: 20, y: 0 });
	t.eq('a real step reads as moving', x.leaderMoving(), true);

	/* THE FAIL-SAFE IS THE POINT: a frozen party row or an expired beacon does
	   not change, so it reads NOT moving and the old band behaves unchanged.
	   This is why leaderPos()'s staleness handling is not duplicated here. */
	x = w();
	for (let i = 0; i < 10; i++) x.noteLeaderMotion({ x: 975, y: 975 });
	t.eq('a stale source repeated ten times never reads as motion',
		x.leaderMoving(), false);

	/* Jitter below motionEps must not count, or the follow never stops. */
	x = w();
	x.noteLeaderMotion({ x: 0, y: 0 });
	x.noteLeaderMotion({ x: x.MOVE.motionEps - 1, y: 0 });
	t.eq('sub-epsilon jitter is not motion', x.leaderMoving(), false);
	t.ok('and motionEps sits well under a tick of real travel (~15u at speed 62)',
		x.MOVE.motionEps > 0 && x.MOVE.motionEps < 10);

	/* The window spans more than one tick so a smart_move pause is not a stop. */
	x = w();
	x.noteLeaderMotion({ x: 0, y: 0 });
	x.noteLeaderMotion({ x: 20, y: 0 });
	t.eq('precondition: it is moving', x.leaderMoving(), true);
	x.leaderMovedAt = Date.now() - (x.MOVE.motionMs + 50);
	t.eq('and it decays once the window passes', x.leaderMoving(), false);
	t.ok('the window spans at least two 250ms ticks', x.MOVE.motionMs >= 500);

	/* --- the step --------------------------------------------------------- */
	x = w(); moved.length = 0;
	x.followStep({ x: 300, y: 0 }, 300);
	t.eq('it steps toward the leader', moved.length, 1);
	t.ok('along the bearing to him', moved[0][0] > 0 && moved[0][1] === 0);
	t.eq('capped at closeStepMax', moved[0][0], x.MOVE.closeStepMax);

	moved.length = 0;
	x.followStep({ x: 130, y: 0 }, 130);
	t.eq('inside the band it closes only the surplus over releaseAt',
		moved[0][0], 10);

	moved.length = 0;
	x.followStep({ x: 100, y: 0 }, 100);
	t.eq('and at or inside releaseAt it does nothing at all', moved.length, 0);

	/* BLOCKED IS A NO-OP, NOT A smart_move. recoverStep paths around an
	   obstacle; this must not, because an unsettled smart_move promise is the
	   documented way these chains die and the recovering latch at closeAt is
	   already the fallback. The world throws if smart_move is called. */
	moved.length = 0;
	const b = w({ blocked: true });
	b.followStep({ x: 300, y: 0 }, 300);
	t.eq('blocked, it moves nowhere', moved.length, 0);

	/* --- placement, which is what keeps the ruling intact ------------------ */
	/* Kiting must keep absolute priority. Asserted on the SOURCE because the
	   ordering is the property, not the outcome of any one call. */
	const tick = s.slice(s.indexOf('const k = kiteStep(lp);'));
	const iKite = tick.indexOf("bump('kiteSteps')");
	const iRej = tick.indexOf("bump('kiteRejected')");
	const iFollow = tick.indexOf('followStep(lp, gap)');
	t.ok('the kite step comes first', iKite >= 0 && iKite < iRej);
	t.ok('the rejected-kite branch comes before the follow', iRej >= 0 && iRej < iFollow);
	t.ok('so the follow only fills the branch that used to do nothing',
		/else if \(leaderMoving\(\) && gap > L\.releaseAt\) await followStep/.test(s));

	/* IT MUST NOT SET THE LATCH. `recovering` is uninterruptible and stops
	   kiting AND looting - lootOutOfRange ~1030 against ~15 lootCalls on both
	   followers - so a second route into it is the one thing this must not be. */
	const body = s.slice(s.indexOf('async function followStep'),
		s.indexOf('function leaderPos()'));
	t.eq('followStep never assigns recovering', /recovering\s*=/.test(body), false);
	t.eq('and never calls smart_move', /smart_move/.test(body), false);
	t.eq('nor touches recoverStep’s cached aim', /\baim\b/.test(body), false);
	t.ok('it aims at the live leader point instead', /lp\.y - character\.real_y/.test(body));
}

}];
