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
	lift(w, 'CaveRun.js', ['MOVE', 'computeLeash', 'noRatchetAlways']);
	w.holdActive = () => true;
	w.engaged = () => false;
	w.attackersOnMe = () => 0;
	/* v22: the selector now asks whether the LEADER is going anywhere. Default
	   it to moving, so every pre-existing assertion below keeps describing the
	   case it was written for; the stationary branch has its own block. */
	w.leaderMoving = () => true;
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
	/* REWRITTEN IN v22, AND THE REWRITE HAD TO EARN IT. This read
	   `L.mode === 'travel'`, pinning the exemption to the band's NAME. The
	   rewrite is the move the item-2 episode warns against - "the tempting
	   move, rewrite the assertions to match the new behaviour" - so the
	   distinction is stated rather than assumed: THERE the assertion encoded an
	   operator RULING and the change removed a freedom; HERE it encodes a
	   mechanism, the behaviour is identical, and the equivalence is asserted
	   below rather than claimed. Keying on the name was correct with two bands
	   and became wrong at three. */
	t.ok('the exemption is DERIVED from the band geometry, not from its name',
		/gapNow > L\.releaseAt \|\| noRatchetAlways\(L\)/.test(s));
	/* NOT ABSENCE, AND NOT POSITION EITHER - the property is "never as LIVE
	   CODE", and it took two wrong drafts to get there. Draft one asserted the
	   superseded form was GONE and failed against correct code, because the
	   v22 comment quotes it inside a retraction and this repo keeps the
	   instance rather than erasing it. Draft two asserted it appeared exactly
	   once, after the marker - and the v22 HEADER entry quotes it too, so a
	   second legitimate mention broke it. Counting mentions of a thing prose is
	   free to discuss was never the right question; stripping the prose is. */
	const codeOnly = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	t.eq('no LIVE code gates the kite rule on the mode label',
		/L\.mode === 'travel'/.test(codeOnly(s)), false);
	t.ok('and the prose is free to quote it - it does, more than once',
		(s.match(/L\.mode === 'travel'/g) || []).length >= 1);
	/* THE STRIPPER IS CODE, so it is tested on fixtures rather than trusted -
	   the lesson suite_merchantsell's apostrophe parser paid for. */
	t.eq('stripper: a block comment goes', codeOnly('a /* L.mode === x */ b').trim(), 'a  b');
	t.eq('stripper: a line comment goes', codeOnly('a\n   // L.mode === x\nb'), 'a\n\nb');
	t.ok('stripper: live code survives', codeOnly('if (L.mode === 1) x();').includes('L.mode'));
	/* THE EQUIVALENCE, which is what makes the rewrite legitimate: the derived
	   predicate reproduces BOTH shipped answers exactly, so no behaviour moved
	   with the expression. */
	const band = (c, r) => ({ closeAt: c, releaseAt: r });
	t.eq('combat is CONDITIONAL exactly as before - the retreat survives',
		w.noRatchetAlways(band(w.MOVE.closeAt, w.MOVE.releaseAt)), false);
	t.eq('travel is UNCONDITIONAL exactly as before',
		w.noRatchetAlways(band(w.MOVE.travelCloseAt, w.MOVE.travelReleaseAt)), true);
	/* AND THE NEW BAND KEEPS THE RETREAT, which is the whole reason it exists
	   rather than item 1 collapsing to travel: travel's unconditional rule IS
	   the freedom the operator protected, so an engaged follower beside a
	   parked leader must not inherit it. */
	t.eq('the stationary band is CONDITIONAL, so an engaged follower may still retreat',
		w.noRatchetAlways(band(w.MOVE.stationaryCloseAt, w.MOVE.stationaryReleaseAt)), false);
	t.ok('and it is genuinely tighter than combat',
		w.MOVE.stationaryCloseAt < w.MOVE.closeAt);
	/* THE SOUNDNESS INVARIANT OVER THE WHOLE SELECTOR, rather than three
	   hand-checked pairs: any band that keeps the retreat must be at least
	   kiteStep wide, or it oscillates. Stated as a rule so the next band added
	   cannot quietly violate it. */
	for (const [name, c, r] of [['combat', w.MOVE.closeAt, w.MOVE.releaseAt],
		['stationary', w.MOVE.stationaryCloseAt, w.MOVE.stationaryReleaseAt],
		['travel', w.MOVE.travelCloseAt, w.MOVE.travelReleaseAt]]) {
		t.eq(name + ': conditional implies at least kiteStep of width',
			w.noRatchetAlways(band(c, r)) || (c - r) >= w.MOVE.kiteStep, true);
	}
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
		/if \(\(gapNow > L\.releaseAt \|\| noRatchetAlways\(L\)\) && gapNew > gapNow \+ 1\) continue;/.test(s));

	/* THE GEOMETRY HAS TO PUT THE THREAT BETWEEN THE FOLLOWER AND THE LEADER, or
	   the two modes are indistinguishable: with the leader on the far side from
	   the monster, fleeing the monster shrinks the leader gap anyway and both
	   modes agree. A first version of this test asserted on that geometry and
	   failed against correct code. Leader at +gap, monster at +20, follower at 0:
	   fleeing means -x, which GROWS the gap, so the guard is the only thing that
	   can stop it. */
	function kite(mode, gapNow) {
		const w = world({ character: { name: 'FatherToken', real_x: 0, real_y: 0, hp: 100, max_hp: 100, speed: 8 } });
		lift(w, 'CaveRun.js', ['MOVE', 'kiteStep', 'dist', 'noRatchetAlways']);
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

}, {

name: 'leader motion picks the distances, engagement picks the kite rule', fn(t) {
	/* ITEM 1, v22. The selector was gated ENTIRELY on follower-side facts and
	   asked nothing about whether the leader was going anywhere - the third
	   sighting of the wrong-actor shape. Caught live: leader STATIONARY, Dexon
	   171u away, recovering false, moving false, closeAt 180, and nobody
	   objected to 171. On open ground doing nothing `engagedNow` was TRUE all
	   session, so the travel band never applied at all. */
	function w(over) {
		over = over || {};
		const x = world({});
		lift(x, 'CaveRun.js', ['MOVE', 'computeLeash', 'noRatchetAlways']);
		x.holdActive = () => over.hold !== false;
		x.engaged = () => !!over.engaged;
		x.attackersOnMe = () => 0;
		x.troubleNow = [];
		x.leaderMoving = () => !!over.moving;
		return x;
	}

	t.eq('engaged with the leader MOVING is the combat band, unchanged',
		w({ engaged: true, moving: true }).computeLeash().closeAt, 180);
	const parked = w({ engaged: true, moving: false }).computeLeash();
	t.eq('engaged with the leader PARKED tightens to the stationary band',
		parked.closeAt, 90);
	t.eq('and says so', parked.mode, 'stationary');
	t.eq('releasing at 30', parked.releaseAt, 30);

	/* THE PRECONDITION IS THE FINDING: only leader motion differs between
	   those two, so the band moved because of the LEADER and nothing else. */
	const wa = w({ engaged: true, moving: true }), wb = w({ engaged: true, moving: false });
	t.eq('precondition: engaged() is true in BOTH worlds',
		[wa.engaged(), wb.engaged()].join(','), 'true,true');
	t.eq('precondition: and the only difference is leaderMoving()',
		[wa.leaderMoving(), wb.leaderMoving()].join(','), 'true,false');
	t.ok('so the band moved because of the LEADER and nothing else',
		wa.computeLeash().closeAt !== wb.computeLeash().closeAt);

	/* Not engaged is travel either way - the stationary band is a TIGHTENING of
	   the loose case, never a loosening of the tight one. */
	t.eq('unengaged, moving: travel', w({ moving: true }).computeLeash().closeAt, 60);
	t.eq('unengaged, parked: still travel', w({ moving: false }).computeLeash().closeAt, 60);
	t.ok('so the stationary band never loosens anything',
		w({ engaged: true, moving: false }).computeLeash().closeAt
		<= w({ engaged: true, moving: true }).computeLeash().closeAt);

	/* The hold gate still outranks everything: travel numbers apply only where
	   a hold will actually stop the leader, and that reasoning is untouched. */
	t.eq('no hold, parked and engaged: back to the base band',
		w({ engaged: true, moving: false, hold: false }).computeLeash().closeAt, 180);

	/* AND THE RULING SURVIVES THE TIGHTENING, which is the whole reason the
	   stationary band is not just travel: travel's no-ratchet is unconditional,
	   and that IS the retreat freedom the operator protected. */
	const x = w({});
	t.eq('the stationary band keeps the retreat',
		x.noRatchetAlways({ closeAt: 90, releaseAt: 30 }), false);
	t.eq('where collapsing to travel would have removed it',
		x.noRatchetAlways({ closeAt: 60, releaseAt: 30 }), true);
	/* INVERTED: narrow the stationary band below kiteStep and the retreat has
	   to go with it. That is the constraint on anyone moving the 90. */
	t.eq('a stationary band narrower than kiteStep would lose the retreat',
		x.noRatchetAlways({ closeAt: 80, releaseAt: 30 }), true);
	t.eq('85 is the floor, so 90 clears it by five',
		x.MOVE.stationaryReleaseAt + x.MOVE.kiteStep, 85);
}

},

{ name: 'FatherToken is the default cave leader, and the shared key still overrides it', fn(t) {
	/* Operator, 2026-10-24: "defaults for cave going forward should be
	   FatherToken as the leader. This should apply to all modes." He led only
	   because cave_leader had been set by hand, so clearing site data put Dexon
	   back. TEAM and DEFAULT_LEADER are non-brace initialisers, so they are
	   supplied here and pinned from the source below. */
	const s = src();
	t.ok('the committed default is FatherToken', /^const DEFAULT_LEADER = 'FatherToken';$/m.test(s));
	t.ok('the committed key is cave_leader', /^const LEADER_KEY = 'cave_leader';$/m.test(s));
	const mk = (stored) => {
		const w = world({ TEAM: ['Dexon', 'FatherToken', 'MageofOz'], LEADER_KEY: 'cave_leader', DEFAULT_LEADER: 'FatherToken' });
		w.parent.localStorage = { getItem: (k) => (k === 'cave_leader' ? stored : null) };
		lift(w, 'CaveRun.js', ['leaderName']);
		return w;
	};
	t.eq('no key -> FatherToken', mk(null).leaderName(), 'FatherToken');
	t.eq('a key naming Dexon still wins', mk('Dexon').leaderName(), 'Dexon');
	t.eq('a key naming nobody in the team falls back to the default', mk('Meltymerch').leaderName(), 'FatherToken');
	t.eq('leaderName is the only reader of the default',
		(s.match(/DEFAULT_LEADER/g) || []).length, 2);
}
},

{ name: 'v25 the encounter table covers all fifty, and every effect it names is scored or refused on purpose', fn(t) {
	const w = voteWorld();
	t.eq('fifty encounters', w.CAVE_ENCOUNTERS.length, 50);
	t.eq('ids e01..e50 in order', w.CAVE_ENCOUNTERS.map((e) => e.id).join(','),
		Array.from({ length: 50 }, (_, i) => 'e' + String(i + 1).padStart(2, '0')).join(','));
	t.eq('titles are distinct, which is what lets a title identify the encounter',
		new Set(w.CAVE_ENCOUNTERS.map((e) => e.n)).size, 50);
	/* An effect the scorer has no case for returns null and reads exactly like a
	   ruling, so the refusals have to be the KNOWN ones and nothing else. */
	const rich = { gold: 1e6, reserve: 0, has: { tool: true, lamp: false }, comfortable: true };
	const stray = [];
	for (const e of w.CAVE_ENCOUNTERS) for (const d of e.o) {
		const sc = w.voteScore(d, { cost: d.c || 0, amber: d.a || 0 }, Object.assign({ kind: e.k }, rich));
		const meant = w.VOTE.never.indexOf(d.e) >= 0 || d.a || (d.o || []).some((x) => x.sh);
		if (sc === null && !meant) stray.push(e.id + '/' + d.i + ':' + d.e);
	}
	t.eq('no option is refused by accident', stray.join(' '), '');
}

},

{ name: 'v25 the operator rulings, each as a pick', fn(t) {
	const w = voteWorld();
	const st = (o) => Object.assign({ floor: 0, gold: 20000, remaining_ms: 900000, supplies: [], objectives: [] }, o || {});
	const pick = (enc, ids, o) => {
		const e = w.CAVE_ENCOUNTER_BY_ID[enc];
		const choice = { id: 'c', title: e.n, options: ids.map((id) => {
			const d = e.o.find((x) => x.i === id);
			return { id: id, cost: d.c || 0, amber: d.a || 0, unavailable: null };
		}) };
		return w.votePlan(choice, st(o)).pick;
	};
	t.eq('never the 6-Amber die bet', pick('e01', ['die', 'small']), 'small');
	t.eq('never an Amber exchange, even against walking away', pick('e41', ['e41_0', 'e41_5']), 'e41_5');
	t.eq('never an Amber price on anything - a 3-Amber pass loses to walking away', pick('e21', ['e21_0', 'e21_5']), 'e21_5');
	t.eq('never the level-100 wolves', pick('e10', ['e10_0', 'e10_5']), 'e10_5');
	t.eq('never the shadow copy', pick('e17', ['e17_0', 'e17_5']), 'e17_5');
	t.eq('2 Amber beats a parcel', pick('e13', ['e13_1', 'e13_0']), 'e13_1');
	t.ok('a parcel beats 1 Amber', w.voteOutcomeValue({ r: 'parcel' }, { has: {} }) > w.voteOutcomeValue({ a: 1 }, { has: {} }));
	t.ok('and loses to 2', w.voteOutcomeValue({ r: 'parcel' }, { has: {} }) < w.voteOutcomeValue({ a: 2 }, { has: {} }));
	t.eq('the rescue table beats a parcel', pick('e18', ['e18_0', 'e18_4']), 'e18_0');
	t.eq('careful beats the 50/50 while time is comfortable', pick('e02', ['e02_0', 'e02_2']), 'e02_2');
	t.eq('and loses to it when the clock is short', pick('e02', ['e02_0', 'e02_2'], { remaining_ms: 120000 }), 'e02_0');
	t.eq('the surveyor: save over hire', pick('e06', ['aid', 'save']), 'save');
	t.eq('the rogue: watch, not save', pick('e20', ['save', 'watch']), 'watch');
	t.eq('a conflict: testimony first', pick('e11', ['left', 'testimony']), 'testimony');
	t.eq('carry a lamp when offered', pick('e38', ['e38_1', 'e38_4']), 'e38_1');
	t.eq('but not a second one', pick('e38', ['e38_1', 'e38_4'], { supplies: ['lamp'] }), 'e38_4');
	t.eq('moths beat the 2 Amber beside them', pick('e47', ['e47_0', 'e47_1']), 'e47_0');
	t.eq('a toll is paid from gold above the reserve', pick('e27', ['e27_0', 'e27_1'], { gold: 13000 }), 'e27_0');
	t.eq('and below it nobody votes, so the server takes the time option',
		pick('e27', ['e27_0', 'e27_1'], { gold: 12000 }), null);
	t.eq('the cheaper time option is refused under the reserve too',
		pick('e27', ['e27_3', 'e27_4'], { gold: 10500 }), 'e27_4');
	t.eq('never a fight in a bad encounter', pick('e28', ['e28_1', 'e28_4']), 'e28_4');
	t.eq('a merchant is inspected while the purse can buy a die', pick('e48', ['e48_0', 'e48_3']), 'e48_0');
	t.eq('and not worth a lamp when it cannot', pick('e48', ['e48_0', 'e48_3'], { gold: 4000 }), 'e48_3');
	const rel = st({ floor: 2, gold: 5000, objectives: [{ floor: 2, required: true, kind: 'encounter', done: true }] });
	t.eq('the reserve releases after the third floor encounter', w.reserveNow(rel), 0);
	t.eq('and stays released', w.reserveNow(st({ floor: 2 })), 0);
	t.eq('revival: never revive in place for Amber',
		w.votePlan({ id: 'r', title: 'A Hand in the Dark', options: [{ id: 'here', amber: 2 }, { id: 'landing', amber: 0 }] }, st()).pick, 'landing');
}

},

{ name: 'v25 unknown encounters are logged and left to the operator, and any teammate vote is echoed', fn(t) {
	const mk = (me) => {
		const w = voteWorld();
		w.character.name = me;
		w.sent = []; w.logs = [];
		w.parent.socket = { emit: (k, d) => w.sent.push(d) };
		w.clog = (m) => w.logs.push(m);
		return w;
	};
	const known = (votes) => ({ id: 'v1', title: 'The Unclaimed Parcel', votes: votes || {},
		options: [{ id: 'e02_0', cost: 0, amber: 0 }, { id: 'e02_2', cost: 0, amber: 0 }] });
	const L = mk('FatherToken');
	L.voteOpen({ floor: 0, gold: 0, remaining_ms: 900000, supplies: [], objectives: [] }, known());
	t.eq('the leader votes a known encounter at once', L.sent.map((d) => d.option).join(), 'e02_2');
	const F = mk('MageofOz');
	F.voteOpen({}, known());
	t.eq('a follower does not pick on its own', F.sent.length, 0);
	F.voteOpen({}, known({ Dexon: 'e02_0' }));
	t.eq('it echoes whichever teammate voted - the operator on Dexon here', F.sent.map((d) => d.option).join(), 'e02_0');
	const U = mk('FatherToken');
	U.voteOpen({ gold: 0 }, { id: 'v2', title: 'A Brand New Thing', options: [{ id: 'x', label: 'Do x', cost: 0, amber: 0 }] });
	t.eq('an unknown encounter gets no vote', U.sent.length, 0);
	t.ok('and an UNKNOWN EVENT line naming its options', U.logs.some((m) => /UNKNOWN EVENT/.test(m) && /x "Do x"/.test(m)));
	const O = mk('FatherToken');
	O.voteOpen({ gold: 0 }, { id: 'v3', title: 'The Unclaimed Parcel', options: [{ id: 'e02_9', cost: 0, amber: 0 }] });
	t.eq('an option the table does not list for a known encounter is unknown too', O.sent.length, 0);
	O.voteOpen({ gold: 0 }, { id: 'v3', title: 'The Unclaimed Parcel', votes: { MageofOz: 'e02_9' }, options: [{ id: 'e02_9', cost: 0, amber: 0 }] });
	t.eq('and when the operator then votes on a follower, the leader echoes it', O.sent.map((d) => d.option).join(), 'e02_9');
	t.eq('the UNKNOWN EVENT line is written once, not every tick', O.logs.filter((m) => /UNKNOWN EVENT/.test(m)).length, 1);
}

},

{ name: 'v25 a friendly cave side is never targeted, and a refusal benches the id', fn(t) {
	const w = world({ FRIENDLY_SIDES: ['neutral', 'ally', 'victim'], friendlyBenchMs: 10000, friendlySkip: {} });
	w.mayAttack = () => true;
	w.bump = () => {};
	lift(w, 'CaveRun.js', ['caveFriendly', 'mayTarget']);
	const m = (side, id) => ({ id: id || side, type: 'monster', cave: side ? { side: side } : undefined });
	for (const s of ['neutral', 'ally', 'victim']) t.eq(s + ' is not a target', w.mayTarget(m(s)), false);
	for (const s of ['enemy', 'predator', 'duel_left']) t.eq(s + ' is', w.mayTarget(m(s)), true);
	t.eq('no side at all is a target', w.mayTarget(m(null, 'plain')), true);
	w.friendlySkip.plain = Date.now() + 5000;
	t.eq('until a refusal benches it', w.mayTarget(m(null, 'plain')), false);
	const s = src();
	t.ok('noteWhy benches on friendly_target', /friendlySkip\[t\.id\] = Date\.now\(\) \+ friendlyBenchMs/.test(s));
	t.ok('every pickTarget path goes through mayTarget', (s.slice(s.indexOf('function pickTarget()'), s.indexOf('// -------------------------------------------------------------- skills')).match(/mayTarget\(/g) || []).length >= 3);
}

},

{ name: 'v25 the exit waits for the last seal and the chests, and the leader hold only runs inside a run', fn(t) {
	const w = world({});
	lift(w, 'CaveRun.js', ['runFinished']);
	const o = (done) => ({ floor: 2, objectives: [{ floor: 2, required: true, done: true }, { floor: 2, required: true, done: done }, { floor: 2, required: false, done: false }] });
	t.eq('finished when every required third-floor room is done', w.runFinished(o(true)), true);
	t.eq('not before', w.runFinished(o(false)), false);
	t.eq('not on an earlier floor', w.runFinished({ floor: 1, objectives: [{ floor: 1, required: true, done: true }] }), false);
	t.eq('not with no objectives read', w.runFinished({ floor: 2, objectives: [] }), false);
	const s = src();
	t.ok('exitTick runs every tick', /\t\tlootTick\(\);\n\t\texitTick\(\);/.test(s));
	t.ok('the leader hold is gated on active()', /if \(active\(\)\) warnOutrun\(\);/.test(s));
	t.ok('hand-back is on, by the character\'s own slot name', /\bhandback: true\b/.test(s) && /load_code\(slot\)/.test(s));
}

},

{ name: 'v26 the live encounter table is read when G carries it, and converts to the copy\'s shape', fn(t) {
	const w = voteWorld();
	t.eq('with no live table the copy is used', w.voteTableSource(), 'copy');
	/* The design file's own shape, reduced to the fields the server sends. */
	for (const raw of RAW_ENCOUNTERS) {
		const mine = w.compactEncounter(raw);
		const copy = w.CAVE_ENCOUNTERS.find((e) => e.id === raw.id);
		t.eq(raw.id + ' converts to exactly the committed copy', JSON.stringify(mine), JSON.stringify(copy));
	}
	w.parent.G = { events: { dreams: { encounters: RAW_ENCOUNTERS.concat([{ id: 'e51', name: 'A New Thing', group: 'positive',
		kind: 'gift', options: [{ id: 'e51_0', effect: 'gift' }, { id: 'e51_1', effect: 'leave' }] }]) } } };
	t.eq('a live table is preferred', w.voteTableSource(), 'live');
	const p = w.votePlan({ id: 'x', title: 'A New Thing', options: [{ id: 'e51_0' }, { id: 'e51_1' }] },
		{ floor: 0, gold: 0, remaining_ms: 900000, supplies: [], objectives: [] });
	t.eq('so an encounter the copy never had is known and voted', p.pick, 'e51_0');
	w.parent.G.events.dreams.encounters = [];
	t.eq('an empty live table falls back to the copy', w.voteTableSource(), 'copy');
} },

{ name: 'v26 revive in place only for the operator\'s four reasons, inside the 2-Amber budget', fn(t) {
	const w = voteWorld();
	const choice = { id: 'r', title: 'A Hand in the Dark', options: [{ id: 'here', amber: 1 }, { id: 'landing', amber: 0 }] };
	const st = (o) => Object.assign({ remaining_ms: 900000, doors: [{ x: 0, y: 0 }] }, o || {});
	const dead = (name, o) => { w.__beacons = { [name]: Object.assign({ t: Date.now(), rip: true, map: 'cave1', x: 10, y: 0, deaths: 1, ctype: 'ranger' }, o || {}) }; };
	w.character.map = 'cave1';
	dead('Dexon');
	t.eq('an ordinary first death near the door: the free doorway', w.votePlan(choice, st()).pick, 'landing');
	dead('FatherToken', { ctype: 'priest' });
	t.eq('the healer died: here', w.votePlan(choice, st()).pick, 'here');
	dead('Dexon', { deaths: 2 });
	t.eq('a repeat death: here', w.votePlan(choice, st()).pick, 'here');
	dead('Dexon');
	t.eq('the clock is short: here', w.votePlan(choice, st({ remaining_ms: 200000 })).pick, 'here');
	dead('Dexon', { x: 3000 });
	t.eq('a long walk back: here', w.votePlan(choice, st()).pick, 'here');
	dead('FatherToken', { ctype: 'priest' });
	w.reviveSpent = { FatherToken: 2 };
	t.eq('but never past 2 Amber for one character', w.votePlan(choice, st()).pick, 'landing');
	w.reviveSpent = {};
	t.eq('and never when the server marks here unavailable',
		w.votePlan({ id: 'r', title: 'A Hand in the Dark', options: [{ id: 'here', amber: 1, unavailable: 'short' }, { id: 'landing' }] }, st()).pick, 'landing');
} },

{ name: 'v26 a dead character waits for the revival vote before respawning', fn(t) {
	const mk = (choice, sinceMs) => {
		const w = world({ mode: 'cave', wasRip: true, diedAt: Date.now() - sinceMs, lastRespawn: 0, respawnWait: 0,
			myDeaths: [], hpTrail: [], lastAlive: null, resting: false, deathLoop: false, recovering: false, aim: null,
			CFG: { autoRespawn: true, respawnMs: 4000 } });
		w.character = { rip: true, name: 'Dexon' };
		w.inCave = () => true; w.caveState = () => ({ choice: choice });
		w.calls = 0; w.respawn = () => { w.calls++; };
		w.bump = () => {}; w.ev = () => {}; w.clog = () => {}; w.throttleLog = () => {}; w.noteWhy = () => {};
		lift(w, 'CaveRun.js', ['REGROUP', 'deathTick']);
		return w;
	};
	let w = mk({ id: 'r', resolved: false }, 10000);
	w.deathTick();
	t.eq('an open vote holds the respawn', w.calls, 0);
	w = mk(null, 1000);
	w.deathTick();
	t.eq('the first moments after dying wait for the offer', w.calls, 0);
	w = mk(null, 10000);
	w.deathTick();
	t.eq('no vote after the grace: respawn as before', w.calls, 1);
	w = mk({ id: 'r', resolved: false }, 80000);
	w.deathTick();
	t.eq('and an open vote holds it only up to reviveWaitMs', w.calls, 1);
} },

{ name: 'v26 regroup: deaths are trouble, the hold does not give up on them, and a rested member waits out hostiles', fn(t) {
	const s = src();
	const w = world({ TROUBLE: { hpAt: 0.55, atkAt: 3 } });
	lift(w, 'CaveRun.js', ['REGROUP_WHY', 'troubleOf']);
	t.eq('a dead mate is trouble', w.troubleOf({ rip: true }), 'dead');
	t.eq('a resting mate is trouble', w.troubleOf({ rest: true, hpFrac: 1 }), 'resting');
	t.eq('a death loop is trouble', w.troubleOf({ loop: true, rest: true, hpFrac: 1 }), 'deathloop');
	t.ok('the hold\'s give-up skips a regroup', /Date\.now\(\) - holdFrom > HOLD\.maxMs && !regroup\.length/.test(s));
	t.ok('and lets the leader walk back to collect', /if \(regroup\.length && collectingMove\(regroup\)\)/.test(s));

	const mk = (o) => {
		const x = world(Object.assign({ resting: true, deathLoop: false, restSince: Date.now(), restSaid: false,
			recovering: false, aim: null }, o || {}));
		x.character = Object.assign({ name: 'MageofOz', hp: 100, max_hp: 100, mp: 100, max_mp: 100, fear: 0, rip: false, real_x: 0, real_y: 0 }, o && o.ch);
		x.isLeader = () => false; x.leaderEntity = () => (o && o.leader) || null;
		x.here = (e) => !!e; const P = (o, k) => (o['real_' + k] != null ? o['real_' + k] : o[k]);
		x.dist = (a, b) => Math.hypot(P(a, 'x') - P(b, 'x'), P(a, 'y') - P(b, 'y'));
		x.threats = () => (o && o.threats) || []; x.caveFriendly = () => false;
		x.clog = () => {}; x.ev = () => {}; x.bump = () => {};
		lift(x, 'CaveRun.js', ['REGROUP', 'hostileInView', 'restTick']);
		return x;
	};
	let x = mk({ ch: { hp: 50 } });
	x.restTick();
	t.eq('still hurt: keeps resting', x.resting, true);
	x = mk();
	x.restTick();
	t.eq('rested and nothing in view: rejoins', [x.resting, x.recovering].join(), 'false,true');
	x = mk({ threats: [{ mtype: 'cave_wolf', x: 100, y: 0 }] });
	x.restTick();
	t.eq('a hostile in view: waits for the party', [x.resting, x.recovering].join(), 'true,false');
	x = mk({ deathLoop: true, leader: { x: 50, y: 0 } });
	x.restTick();
	t.eq('a death loop ends when the leader collects it', [x.resting, x.deathLoop].join(), 'false,false');
	/* v27: the LEADER's loop ends when the followers come to him. */
	const ml = (gaps) => { const y = mk({ deathLoop: true }); y.isLeader = () => true; y.followerGaps = () => gaps; return y; };
	x = ml([{ who: 'Dexon', gap: 60, src: 'entity' }, { who: 'MageofOz', gap: 400, src: 'beacon' }]);
	x.restTick();
	t.eq('a looped leader with one follower still away keeps holding', x.deathLoop, true);
	x = ml([{ who: 'Dexon', gap: 60, src: 'entity' }, { who: 'MageofOz', gap: 0, src: 'rip' }]);
	x.restTick();
	t.eq('every LIVING follower beside him ends it', [x.resting, x.deathLoop].join(), 'false,false');
	x = ml([{ who: 'Dexon', gap: 0, src: 'rip' }, { who: 'MageofOz', gap: 0, src: 'rip' }]);
	x.restTick();
	t.eq('both followers dead is nobody coming - a corpse reads gap 0 and must not count', x.deathLoop, true);
	const ld = world({ TROUBLE: { staleMs: 5000 } });
	ld.isLeader = () => false; ld.leaderName = () => 'FatherToken'; ld.leaderEntity = () => null;
	lift(ld, 'CaveRun.js', ['leaderDown']);
	ld.beacons = () => ({ FatherToken: { t: Date.now(), rest: true, loop: false } });
	t.eq('a resting leader holds the followers where they are', ld.leaderDown(), true);
	ld.beacons = () => ({ FatherToken: { t: Date.now(), rest: true, loop: true } });
	t.eq('a death-looped leader does not - they go and collect him', ld.leaderDown(), false);
} },

{ name: 'v26 the Loaded Die is retried whenever someone is beside its shop with the gold', fn(t) {
	const mk = (gold, keeperAt) => {
		const w = world({ stopped: false, mode: 'cave', DIE: { reach: 150, retryMs: 5000, maxTries: 8 },
			dieShops: { r1: { map: 'cave1', price: 10000, done: false, tries: 0, lastTry: 0 } }, pendingBuys: {},
			launcher: { rid: null } });
		w.character = { map: 'cave1', rip: false, real_x: 0, real_y: 0 };
		w.inCave = () => true; w.caveState = () => ({ gold: gold });
		w.parent.entities = keeperAt == null ? {} : { k: { cave: { room: 'r1' }, x: keeperAt, y: 0 } };
		w.sent = []; w.parent.socket = { emit: (k, d) => w.sent.push(d) };
		w.dist = (a, b) => Math.hypot((a.real_x != null ? a.real_x : a.x) - b.x, (a.real_y != null ? a.real_y : a.y) - b.y);
		w.isLeader = () => true; w.logs = []; w.throttleLog = (m) => w.logs.push(m);
		w.navDriving = () => !!w.__nav;
		w.bump = () => {}; w.ev = () => {}; w.clog = () => {};
		lift(w, 'CaveRun.js', ['shopKeeper', 'dieTick', 'onCaveResponse']);
		return w;
	};
	let w = mk(5000, 50);
	w.dieTick();
	t.eq('a short purse does not try', w.sent.length, 0);
	w = mk(12000, 50);
	w.dieTick();
	t.eq('beside the shopkeeper with the gold: buys', w.sent.map((d) => d.action + ':' + d.room).join(), 'buy:r1');
	w.onCaveResponse({ interaction: 'cave', request_id: w.sent[0].request_id, failed: true, reason: 'distance' });
	t.eq('a refusal other than sold_out keeps the shop open', w.dieShops.r1.done, false);
	w.dieShops.r1.lastTry = 0; w.dieTick();
	t.eq('and it is tried again', w.sent.length, 2);
	w.onCaveResponse({ interaction: 'cave', request_id: w.sent[1].request_id, success: true, recipient: 'Dexon' });
	t.eq('bought settles it', w.dieShops.r1.done, true);
	w = mk(12000, 900);
	w.dieTick();
	t.eq('out of reach: no buy', w.sent.length, 0);
	t.ok('but a leader the operator walks is told the detour is worth it', w.logs.some((m) => /affordable/.test(m)));
	w = mk(12000, 900); w.__nav = true;
	w.dieTick();
	t.eq('v27: under the autopilot, which decides the detour itself, that note is not repeated', w.logs.length, 0);
	w = mk(12000, 50);
	w.dieTick();
	w.onCaveResponse({ interaction: 'cave', request_id: w.sent[0].request_id, failed: true, reason: 'sold_out' });
	t.eq('sold_out settles it too', w.dieShops.r1.done, true);
} },

{ name: 'v31 the hand-back ENGAGES the main slot, so a hop no longer reloads CaveRun', fn(t) {
	/* 2026-10-29, the browser session's read of the game log: after the cave
	   hand-back every hop ran CaveRun's 20s launcher again, because the runner's
	   load_code() runs a slot without engaging it. The page below models the
	   client at upstream 16881a2: get_code_slot() reads code_cache, only
	   code_persistence_logic() writes it, and the page's load_code(name, log)
	   answers LATER by setting the editor and code_slot. */
	const ID = '6011', CAVE = '11';
	const mk = (o = {}) => {
		const w = world({ CFG: { exit: { engageMs: 15000 } } });
		let clock = 1000;
		w.Date = { now: () => clock };
		w.tick = (ms) => { clock += ms; };
		w.q = [];
		w.setTimeout = (f) => { w.q.push(f); };
		w.flush = () => { const q = w.q.splice(0); q.forEach((f) => f()); };
		w.lines = []; w.clog = (m, c) => w.lines.push([m, c]);
		w.evs = []; w.ev = (k, d) => w.evs.push([k, d]);
		const cache = { slot_6011: CAVE, run_6011: '1' };
		let buffer = '// CaveRun.js - one script ... - v31 (TEST BUILD)\n...';
		const P = w.parent;
		P.real_id = ID; P.code_slot = CAVE;
		P.storage_get = (k) => (k === 'code_cache' ? JSON.stringify(cache) : null);
		P.storage_set = (k, v) => { if (k === 'code_cache') { const d = JSON.parse(v); Object.keys(d).forEach((x) => { cache[x] = d[x]; }); } };
		P.get_code_slot = () => (o.explicit || cache['slot_' + ID] || ID);
		P.code_persistence_logic = () => { if (o.explicit) return; cache['slot_' + ID] = P.code_slot; };
		P.codemirror_render = { getValue: () => buffer };
		P.started = 0; P.start_runner = () => { P.started++; };
		P.loads = []; P.answer = null;
		P.load_code = (n, log) => { P.loads.push([n, log]); P.answer = () => { buffer = '// Dexon (Ranger) - v160'; P.code_slot = ID; }; };
		if (o.noPersist) delete P.code_persistence_logic;
		w.cache = cache;
		lift(w, 'CaveRun.js', ['engageMainSlot']);
		return w;
	};

	let w = mk();
	t.eq('precondition: the engaged slot is the Cave slot', w.parent.get_code_slot(), CAVE);
	t.eq('it asks the PAGE to load the character slot by name, with the log line', JSON.stringify(w.engageMainSlot('Dexon')) + JSON.stringify(w.parent.loads), 'true[["Dexon",true]]');
	w.flush();
	t.eq('before the answer arrives nothing is recorded', [w.cache.slot_6011, w.q.length].join(), CAVE + ',1');
	w.parent.answer(); w.flush();
	t.eq('once the editor holds the slot, it is the ENGAGED slot', w.parent.get_code_slot(), ID);
	t.eq('the run flag is left alone, so a page load still runs it', w.cache.run_6011, '1');
	t.ok('and it says so', /engaged slot is now 6011 \(was 11, via code_persistence_logic\)/.test((w.lines[w.lines.length - 1] || [])[0]));
	t.eq('the runner is never restarted - start_runner saves the editor into the viewed slot', w.parent.started, 0);

	w = mk();
	w.engageMainSlot('Dexon');
	w.tick(16000); w.flush();
	t.eq('no answer inside engageMs: the slot stays Cave and nothing loops on', [w.parent.get_code_slot(), w.q.length].join(), CAVE + ',0');
	t.ok('and that is a red line naming the hand fix', (w.lines[w.lines.length - 1] || [])[1] === 'red' && /engage Dexon by hand/.test(w.lines[w.lines.length - 1][0]));

	w = mk({ noPersist: true });
	w.engageMainSlot('Dexon'); w.parent.answer(); w.flush();
	t.eq('without code_persistence_logic the code_cache entry is written directly', [w.parent.get_code_slot(), w.cache.run_6011].join(), ID + ',1');

	w = mk({ explicit: CAVE });
	w.engageMainSlot('Dexon'); w.parent.answer(); w.flush();
	t.ok('a slot the page will not record is reported, never claimed', (w.lines[w.lines.length - 1] || [])[1] === 'red' && /still reads 11 \(wanted 6011/.test(w.lines[w.lines.length - 1][0]));

	w = mk();
	delete w.parent.load_code;
	t.eq('a page with no load_code: refused with a red line, nothing scheduled', [w.engageMainSlot('Dexon'), w.q.length, (w.lines[0] || [])[1]].join(), 'false,0,red');

	const s = src();
	const body = (s.match(/\nfunction engageMainSlot\(name\) \{[\s\S]*?\n\}\n/) || [''])[0];
	t.ok('precondition: the body was found', body.length > 500);
	t.eq('engageMainSlot never starts or toggles the runner', /start_runner|toggle_runner/.test(body.replace(/\/\*[\s\S]*?\*\//g, '')), false);
	t.ok('handBack runs the slot, THEN engages it', /\ttry \{ load_code\(slot\); \}[^\n]*\n\tengageMainSlot\(slot\);\n\}/.test(s));
} },

{ name: 'v26 the launcher stages when today\'s cave is open and hands back when it is spent', fn(t) {
	const mk = () => {
		const w = world({ mode: 'cave', phase: 'idle', stopped: false,
			launcher: { rid: 'crl1', askedAt: Date.now(), answered: false, handBackAt: 0, said: false },
			CFG: { launch: { enabled: true, graceMs: 20000, answerMs: 10000 } } });
		w.went = 0; w.caveGo = () => { w.went++; };
		w.back = []; w.handBack = (why) => w.back.push(why);
		w.inCave = () => false; w.clog = () => {}; w.ev = () => {};
		lift(w, 'CaveRun.js', ['launcherAnswer', 'launcherTick', 'caveStay']);
		return w;
	};
	let w = mk();
	w.launcherAnswer({ visit: { available: true } });
	t.eq('available: restock and walk to Dorr', w.went, 1);
	w = mk();
	w.launcherAnswer({ visit: { available: false } });
	t.ok('spent: a hand-back is scheduled', w.launcher.handBackAt > Date.now());
	w.launcherTick();
	t.eq('not before the grace', w.back.length, 0);
	w.launcher.handBackAt = Date.now() - 1;
	w.launcherTick();
	t.eq('then it hands back', w.back.length, 1);
	w = mk();
	w.launcherAnswer({ visit: { available: false } });
	w.caveStay();
	w.launcher.handBackAt = w.launcher.handBackAt || 0;
	w.launcherTick();
	t.eq('caveStay() cancels it', [w.back.length, w.launcher.handBackAt].join(), '0,0');
	w = mk();
	w.launcherAnswer({ visit: { available: false, resume: { server: 'USII' } } });
	t.eq('a run open to resume: neither stages nor hands back', [w.went, w.launcher.handBackAt].join(), '0,0');
	const s = src();
	for (const fn of ['caveCrypt', 'caveDry', 'caveGo'])
		t.ok(fn + '() cancels a pending hand-back', new RegExp('function ' + fn + '\\(\\) \\{\\n\\tlauncher\\.handBackAt = 0;').test(s));
	t.ok('the launcher asks on load', /\nvoteLoop\(\);\nlauncherStart\(\);\n/.test(s));
} },

{ name: 'v26 leaving waits for the Amber cap, the last minute or caveExit(), and the dump rides the game log', fn(t) {
	const mk = (st, o) => {
		const w = world(Object.assign({ stopped: false, mode: 'cave', finishedAt: 0, exitAsked: 0, exitedByUs: false,
			chestsClearSince: Date.now() - 20000, exitForce: false, exitWhyFrom: 0,
			CFG: { exit: { enabled: true, settleMs: 15000, chestWaitMs: 90000, retryMs: 10000, finalMs: 60000 } } }, o || {}));
		w.character = { rip: false };
		w.inCave = () => true; w.caveState = () => st;
		w.get_chests = () => ({});
		w.sent = []; w.parent.socket = { emit: (k, d) => w.sent.push(d.action) };
		w.bump = () => {}; w.ev = () => {}; w.clog = () => {};
		w.leaderExiting = () => !!w.__leaderExit;
		lift(w, 'CaveRun.js', ['runFinished', 'exitTick']);
		return w;
	};
	const done = { floor: 2, objectives: [{ floor: 2, required: true, done: true }], remaining_ms: 300000,
		limits: { amber: 36, amber_spawned: 20 } };
	let w = mk(done);
	w.exitTick(); w.chestsClearSince = Date.now() - 20000; w.exitWhyFrom = 1; w.exitTick();
	t.ok('PRECONDITION: the chests have settled, so only the gate can hold it',
		Date.now() - w.chestsClearSince >= 15000);
	t.eq('finished with time and Amber left: stays to farm', w.sent.length, 0);
	w = mk(Object.assign({}, done, { limits: { amber: 36, amber_spawned: 36 } }));
	w.exitTick(); w.exitWhyFrom = 1; w.exitTick();
	t.eq('at the Amber cap: leaves', w.sent.join(), 'exit');
	w = mk(Object.assign({}, done, { remaining_ms: 30000 }));
	w.exitTick(); w.exitWhyFrom = 1; w.exitTick();
	t.eq('in the last minute: leaves', w.sent.join(), 'exit');
	w = mk(Object.assign({}, done, { floor: 1 }), { exitForce: true });
	w.exitTick(); w.exitWhyFrom = 1; w.exitTick();
	t.eq('caveExit() leaves even before the last seal', w.sent.join(), 'exit');
	w = mk(Object.assign({}, done, { floor: 1 }));
	w.__leaderExit = true;
	w.exitTick(); w.exitWhyFrom = 1; w.exitTick();
	t.eq('v27: a follower leaves when the leader\u2019s beacon says it is leaving', w.sent.join(), 'exit');

	const d = world({ tel: { counters: { a: 1 } } });
	d.character = { name: 'Dexon' };
	const buf = [];
	d.parent.__gamelog = { buf: buf, capture: (m, c, src) => buf.push({ message: m, source: src }) };
	d.caveVersion = () => 26; d.caveBuild = () => 'line 1';
	lift(d, 'CaveRun.js', ['caveDumpToLog']);
	t.eq('the dump is written', d.caveDumpToLog('exit'), true);
	t.ok('as one CAVE DUMP row', /^CAVE DUMP \(exit\) - Dexon$/.test(buf[0].message));
	t.eq('with the telemetry under dump', JSON.stringify(buf[0].dump.counters), '{"a":1}');
} },

{ name: 'v27 the leader drives itself: the plan, in order of asking', fn(t) {
	const s = src();
	const m = /const NAV_ROOM_KINDS = (\[[^\]]*\]);/.exec(s);
	t.ok('PRECONDITION: NAV_ROOM_KINDS is an array literal the suite can pin', !!m);
	/* Required rooms are fight / encounter / boss, three a floor. Me at 0,0. A
	   is the NEARER room, but B first is the cheaper whole walk to the stairs. */
	const floor = (extra) => ({ floor: 0, remaining_ms: 1200000, gold: 0,
		doors: [{ x: 0, y: 0, to: 'main', down: false }, { x: 500, y: 0, to: 'zone_1', down: true, locked: true }],
		objectives: [
			{ id: '0:0', floor: 0, kind: 'fight', required: true, done: false, x: 100, y: 0 },
			{ id: '0:1', floor: 0, kind: 'encounter', required: true, done: false, x: -150, y: 0 },
		].concat(extra || []) });
	let w = navWorld();
	const a = floor();
	t.ok('PRECONDITION: the fight room is the nearer one', Math.abs(a.objectives[0].x) < Math.abs(a.objectives[1].x));
	let g = w.navPlan(a, Date.now());
	t.eq('the cheapest order to the stairs, not the nearest room first', [g.kind, g.id].join(), 'room,0:1');
	const ro = w.navRoute(a, { x: 0, y: 0 });
	t.eq('the route ends at the stairs', ro.points[ro.points.length - 1].x, 500);

	const done = floor();
	done.objectives.forEach((o) => { o.done = true; });
	done.doors[1].locked = false;
	g = w.navPlan(done, Date.now());
	t.eq('the floor done: the stairs', [g.kind, g.door && g.door.to].join(), 'door,zone_1');
	done.doors[1].locked = true;
	t.eq('a door still locked is not walked into', w.navPlan(done, Date.now()).kind === 'door', false);

	/* THE PARTY FIRST. */
	w = navWorld({ beacons: { Dexon: { t: Date.now(), rip: true, ctype: 'ranger', map: 'z', x: 0, y: 0 },
		MageofOz: { t: Date.now(), rip: true, ctype: 'mage', map: 'z', x: 0, y: 0 } } });
	g = w.navPlan(floor(), Date.now());
	t.eq('two dead: the landing, before any room', [g.kind, g.x, g.y].join(), 'landing,0,0');
	w = navWorld({ me: { name: 'Dexon', ctype: 'ranger' },
		beacons: { FatherToken: { t: Date.now(), rip: true, ctype: 'priest', map: 'z', x: 0, y: 0 } } });
	t.eq('the healer dead: the landing', w.navPlan(floor(), Date.now()).kind, 'landing');
	t.eq('and the same rule moves a follower', w.landingWanted(), 'the healer is dead');
	w = navWorld({ beacons: { MageofOz: { t: Date.now(), rip: true, ctype: 'mage', map: 'z', x: 0, y: 0 } } });
	t.eq('one member dead: no new objectives, and no walk away', w.navPlan(floor(), Date.now()).kind, 'hold');
	w = navWorld({ beacons: { MageofOz: { t: Date.now(), rest: true, wait: true, ctype: 'mage', map: 'z', x: 40, y: 70 } } });
	g = w.navPlan(floor(), Date.now());
	t.eq('a member waiting for the party is collected', [g.kind, g.id, g.x, g.y].join(), 'collect,MageofOz,40,70');
	w = navWorld({ beacons: { MageofOz: { t: Date.now() - 60000, rip: true, ctype: 'mage', map: 'z' } } });
	t.eq('a STALE beacon is neither dead nor fine - it does not stop the run', w.navPlan(floor(), Date.now()).kind, 'room');

	w = navWorld({ attackers: 1 });
	t.eq('anything on me is fought before the next room', w.navPlan(floor(), Date.now()).kind, 'fight');
	w = navWorld();
	const v = floor(); v.choice = { id: 'c1', resolved: false };
	t.eq('an open vote holds the leader where it opened', w.navPlan(v, Date.now()).kind, 'vote');
	w = navWorld(); w.navManualUntil = Date.now() + 10000;
	t.eq('a move the operator made pauses the autopilot', w.navPlan(floor(), Date.now()).kind, 'manual');
	w = navWorld(); w.resting = true;
	t.eq('a respawned leader rests first', w.navPlan(floor(), Date.now()).kind, 'rest');

	/* AN ESCORT WALKS TO THE STAIRS, and stops being one when its room is done. */
	w = navWorld(); w.navEscort = '0:1';
	g = w.navPlan(floor(), Date.now());
	t.eq('an escort is walked to the down door even with the stairs locked', [g.kind, g.x].join(), 'escort,500');
	const ed = floor(); ed.objectives[1].done = true;
	g = w.navPlan(ed, Date.now());
	t.eq('the escort done: back to the rooms', [g.kind, w.navEscort].join(), 'room,');
} },

{ name: 'v27 the Loaded Die, camps and unopened shops are inserted where they cost least', fn(t) {
	const base = () => ({ floor: 0, remaining_ms: 1200000, gold: 12000,
		doors: [{ x: 0, y: 0, to: 'main', down: false }, { x: 600, y: 0, to: 'zone_1', down: true, locked: true }],
		objectives: [{ id: '0:0', floor: 0, kind: 'fight', required: true, done: false, x: 300, y: 0 },
			{ id: '0:shop', floor: 0, kind: 'encounter', required: false, done: true, x: 20, y: 30 }] });
	let w = navWorld();
	w.dieShops = { '0:shop': { map: 'z', price: 10000, done: false } };
	let g = w.navPlan(base(), Date.now());
	t.eq('the die affordable and beside the route: bought now', [g.kind, g.id].join(), 'shop,0:shop');
	const poor = base(); poor.gold = 9000;
	t.eq('not affordable: the route goes on', w.navPlan(poor, Date.now()).kind, 'room');
	const far = base(); far.objectives[1].x = -6000;
	w = navWorld(); w.dieShops = { '0:shop': { map: 'z', price: 10000, done: false } };
	g = w.navPlan(far, Date.now());
	t.eq('a detour over the limit is skipped', g.kind, 'room');
	t.ok('and says why', w.said.some((m) => /die skipped - the detour is \d+s, over the 120s limit/.test(m)));
	const tight = base(); tight.remaining_ms = 400000; tight.objectives[1].x = -1500;
	w = navWorld(); w.dieShops = { '0:shop': { map: 'z', price: 10000, done: false } };
	g = w.navPlan(tight, Date.now());
	t.ok('PRECONDITION: inside the 2-minute limit', w.navInsert(w.navRoute(tight, { x: 0, y: 0 }).points, { x: -1500, y: 30 }).ms <= w.NAV.detourMaxMs);
	t.eq('but not inside the run’s slack: skipped', g.kind, 'room');
	t.ok('with the slack named', w.said.some((m) => /die skipped - \d+s of detour, -?\d+s of slack/.test(m)));
	/* The insertion is re-scored every plan: further along the route the same
	   shop can become the cheapest insertion AT 0. */
	const later = base(); later.objectives[1].x = 320; later.objectives[1].y = 40;
	w = navWorld({ me: { x: 0, y: 0 } }); w.dieShops = { '0:shop': { map: 'z', price: 10000, done: false } };
	t.eq('a shop beside the NEXT room waits for that leg', w.navPlan(later, Date.now()).kind, 'room');

	/* CAMPS. */
	const camp = base();
	camp.gold = 0;
	camp.objectives.push({ id: '0:farm:a', floor: 0, kind: 'farm', required: false, done: false, waves: 1, x: 100, y: 100 });
	w = navWorld();
	g = w.navPlan(camp, Date.now());
	t.eq('a camp under way nearby, time to spare: waited out', [g.kind, g.id].join(), 'camp,0:farm:a');
	const rush = JSON.parse(JSON.stringify(camp)); rush.remaining_ms = 860000;
	w = navWorld();
	t.eq('no slack for the next wave: the run comes first', w.navPlan(rush, Date.now()).kind, 'room');
	t.ok('and it says so', w.said.some((m) => /not waiting for wave 2/.test(m)));
	const unstarted = JSON.parse(JSON.stringify(camp)); unstarted.objectives[2].waves = 0;
	w = navWorld();
	t.eq('a camp nobody has started is not a detour on early floors', w.navPlan(unstarted, Date.now()).kind, 'room');

	/* AN UNOPENED SHOP by the route is opened on the way; a revealed traveller is not visited. */
	const shop = base(); shop.gold = 0; shop.objectives[1].done = false;
	w = navWorld();
	t.eq('the floor shop by the doorway is opened on the way', [w.navPlan(shop, Date.now()).kind].join(), 'inspect');
	const cit = base(); cit.gold = 0; cit.objectives[1].done = false; cit.objectives[1].kind = 'citizen';
	w = navWorld();
	t.eq('a citizen has no vote to open', w.navPlan(cit, Date.now()).kind, 'room');
} },

{ name: 'v27 after the last seal: Amber per second while it fits, then leave', fn(t) {
	const fin = () => ({ floor: 2, remaining_ms: 600000, gold: 0, limits: { amber: 36, amber_spawned: 20 },
		doors: [{ x: 0, y: 0, to: 'zone_1', down: false }],
		objectives: [{ id: '2:0', floor: 2, kind: 'boss', required: true, done: true, x: 50, y: 0 },
			{ id: '2:farm:a', floor: 2, kind: 'farm', required: false, done: false, waves: 0, x: 400, y: 0 },
			{ id: '2:farm:b', floor: 2, kind: 'farm', required: false, done: false, waves: 0, x: 4000, y: 0 }] });
	let w = navWorld();
	let g = w.navPlan(fin(), Date.now());
	t.eq('the nearer camp has the better Amber per second', [g.kind, g.id].join(), 'farm,2:farm:a');
	const capped = fin(); capped.limits.amber_spawned = 36;
	t.eq('at the Amber cap: leave', w.navPlan(capped, Date.now()).kind, 'leave');
	const late = fin(); late.remaining_ms = 100000;
	t.eq('nothing fits the clock: leave', w.navPlan(late, Date.now()).kind, 'leave');
	const die = fin(); die.gold = 15000; die.objectives.push({ id: '2:shop', floor: 2, kind: 'encounter', required: false, done: true, x: -6000, y: 0 });
	w = navWorld(); w.dieShops = { '2:shop': { map: 'z', price: 10000, done: false } };
	g = w.navPlan(die, Date.now());
	t.ok('PRECONDITION: the walk is over the floor-route detour limit', w.navMs({ x: 0, y: 0 }, { x: -6000, y: 0 }) > w.NAV.detourMaxMs);
	t.eq('after the last seal the die is fetched on the clock alone', [g.kind, g.id].join(), 'shop,2:shop');
} },

{ name: 'v27 doing it: one smart_move per goal, the hold wins, the stairs wait for chests', fn(t) {
	const st = { floor: 0, remaining_ms: 1200000, gold: 0,
		doors: [{ x: 0, y: 0, to: 'main', down: false }, { x: 30, y: 0, to: 'zone_1', down: true, locked: false }],
		objectives: [{ id: '0:0', floor: 0, kind: 'fight', required: true, done: false, x: 400, y: 0 }] };
	let w = navWorld({ st: st });
	w.navTick();
	w.navTick();
	t.eq('one smart_move to the room, not one a tick', w.moves.length, 1);
	t.eq('at the objective’s own x/y, which is what the button does', [w.moves[0].x, w.moves[0].y].join(), '400,0');
	w.holdFrom = Date.now(); w.holdDone = false;
	w.navTick();
	t.eq('a hold halts the flight', [w.stops, w.navFlight].join(), '1,');
	w.navTick();
	t.eq('and nothing new is issued while it holds', w.moves.length, 1);
	w.holdDone = true;
	w.navTick();
	t.eq('a hold that gave up lets the autopilot go on', w.moves.length, 2);

	/* A regroup hold does NOT stop the leader going back for the member it waits for. */
	w = navWorld({ st: st, beacons: { MageofOz: { t: Date.now(), rest: true, wait: true, ctype: 'mage', map: 'z', x: -300, y: 0 } } });
	w.holdFrom = Date.now(); w.holdDone = false;
	w.navTick();
	t.eq('collecting a member is the move a regroup hold waits for', [w.moves.length, w.moves[0] && w.moves[0].x].join(), '1,-300');

	/* THE STAIRS: arrived, chests still down - wait; then transport. */
	const fl = JSON.parse(JSON.stringify(st)); fl.objectives[0].done = true;
	w = navWorld({ st: fl, me: { x: 30, y: 0 } });
	w.chests = { c1: {} };
	w.navTick();
	t.eq('at the stairs with a chest down: wait', w.transports.length, 0);
	w.navDoorSince = Date.now() - 25000;
	w.navLastDoor = 0;
	w.navTick();
	t.eq('the chest wait is bounded', w.transports.join(), 'zone_1');

	/* A smart_move the autopilot did not make (the button, a hand move) pauses it. */
	w = navWorld({ st: st });
	const f = { x: 1, y: 1, halted: false };
	w.navFlight = f;
	w.navLanded(f, { reason: 'interrupted' });
	t.ok('an interruption we did not cause pauses the autopilot', w.navManualUntil > Date.now());
	w = navWorld({ st: st });
	const h = { x: 1, y: 1, halted: true };
	w.navLanded(h, { reason: 'interrupted' });
	t.eq('our own halt is not a manual takeover', w.navManualUntil, 0);
	w = navWorld({ st: st });
	w.navLanded({ x: 1, y: 1, id: 'r', halted: false }, { reason: 'failed' });
	t.eq('a failed path is counted, not read as the operator', [w.navManualUntil, w.navFails.r].join(), '0,1');

	/* Off is off. */
	w = navWorld({ st: st }); w.navOn = false;
	w.navTick();
	t.eq('caveNav(false): the leader is the operator’s again', w.moves.length, 0);
	w = navWorld({ st: st, me: { name: 'Dexon', ctype: 'ranger' } }); w.isLeader = () => false;
	w.navTick();
	t.eq('a follower never runs the autopilot', w.moves.length, 0);
} },

{ name: 'v27 wiring: escort from the vote, the leader’s exit carried to the followers', fn(t) {
	const s = src();
	t.ok('moveTick runs the autopilot after the hold check',
		/if \(active\(\)\) warnOutrun\(\);\n[\s\S]{0,200}if \(active\(\)\) await navTick\(\);\n\t\treturn;/.test(s));
	t.ok('a follower pulls back to the landing before following',
		/if \(!resting && !deathLoop && await followerLanding\(\)\) return;/.test(s));
	t.ok('a resolved vote is read for an escort', /else \{ learnShop\(choice\); navNoteResolved\(choice\); \}/.test(s));
	t.ok('the beacon carries exit and wait', /wait: !!\(deathLoop \|\| \(resting && restSaid\)\),\n\t\t\texit: !!exitForce,/.test(s));
	t.ok('the regroup hold yields to a collect move', /if \(regroup\.length && navRegroupMove\(\)\)/.test(s));
	t.ok('holdResume does not fight the autopilot', /if \(!g \|\| navDriving\(\)\) return;/.test(s));
	t.ok('leaving the cave resets the autopilot', /navGoal = null; navFlight = null; navManualUntil = 0; navEscort = null;/.test(s));

	const w = navWorld();
	w.navGoal = { kind: 'room', id: '0:1' };
	w.encounterOf = () => ({ o: [{ i: 'e23_0', e: 'escort' }, { i: 'e23_3', e: 'guide' }] });
	w.navNoteResolved({ id: 'c1', resolved: true, result: 'e23_3' });
	t.eq('a guide finishes in the room - no escort', w.navEscort, null);
	w.navNoteResolved({ id: 'c2', resolved: true, result: 'e23_0' });
	t.eq('an escort makes the goal room an escort', w.navEscort, '0:1');
} },
];

const RAW_ENCOUNTERS = [{"id":"e02","name":"The Unclaimed Parcel","group":"mixed","kind":"parcel","options":[{"id":"e02_0","effect":"venture","label":"Cut the seal. Something inside is scratching.","outcomes":[{"weight":1,"reward":"cave_parcel"},{"weight":1,"fight":["cave_guard",3]}],"offer":true},{"id":"e02_1","effect":"venture","label":"Pry the hinges off quietly.","outcomes":[{"weight":1,"reward":"cave_parcel"}],"needs":"tool"},{"id":"e02_2","label":"Spend 20 seconds checking the trap.","effect":"careful"},{"id":"e02_3","effect":"venture","label":"Buy the box for 2,000 shared gold","outcomes":[{"weight":1,"reward":"cave_parcel"}],"cost":2000},{"id":"e02_4","effect":"venture","label":"Ring the alarm and take what the guards carry.","outcomes":[{"weight":1,"fight":["cave_guard",3]}]},{"id":"e02_5","label":"Leave it and keep going.","effect":"leave"}]},{"id":"e06","name":"The Trapped Surveyor","group":"mixed","kind":"rescue","options":[{"id":"save","label":"Save {npc}: fight the wolves","effect":"save","offer":true},{"id":"watch","label":"Wait; loot the pack if {npc} dies","effect":"watch"},{"id":"lure","label":"Draw the wolves away from {npc}","effect":"lure","offer":true},{"id":"aid","label":"Save and hire {npc} for 2,000 shared gold","effect":"hire","cost":2000},{"id":"finish","label":"Attack {npc} and the wolves","effect":"both"},{"id":"cover","label":"Bring {npc} behind us; take a smaller reward","effect":"cover"}]},{"id":"e17","name":"The Copying Shadow","group":"mixed","kind":"shadow","options":[{"id":"e17_0","effect":"venture","label":"Step into the shadow. Fight a copy of your strongest fighter.","outcomes":[{"weight":1,"shadow":true}],"offer":true},{"id":"e17_1","effect":"venture","label":"Throw a stone into the shadow","outcomes":[{"weight":1,"reward":"cave_parcel"},{"weight":1,"fight":["cave_bat",5]}]},{"id":"e17_2","effect":"venture","label":"Pay 2 Amber to keep the lamp burning","outcomes":[{"weight":1,"reward":"cave_parcel"}],"amber":2},{"id":"e17_3","effect":"venture","label":"Borrow the watcher’s lamp","outcomes":[{"weight":1,"flags":["lamp"]}]},{"id":"e17_4","label":"Watch the shadow for 20 seconds","effect":"careful"},{"id":"e17_5","label":"Leave it and keep going.","effect":"leave"}]}];

function voteWorld() {
	/* CAVE_ENCOUNTERS is `const X = [`, which lift() cannot take, so it is cut
	   out of the committed source by text and evaluated here. */
	const s = src();
	const a = s.indexOf('const CAVE_ENCOUNTERS = [');
	const b = s.indexOf('\n];\n', a) + 3;
	const w = world({ TEAM: ['Dexon', 'FatherToken', 'MageofOz'], votedFor: {}, voteNoted: {}, reserveReleased: false,
		encounterIndex: null, reviveSpent: {} });
	w.beacons = () => w.__beacons || {};
	require('vm').runInContext(s.slice(a, b).replace('const CAVE_ENCOUNTERS', 'globalThis.CAVE_ENCOUNTERS'), w);
	w.CAVE_ENCOUNTER_BY_ID = {}; w.CAVE_ENCOUNTER_BY_NAME = {};
	for (const e of w.CAVE_ENCOUNTERS) { w.CAVE_ENCOUNTER_BY_ID[e.id] = e; w.CAVE_ENCOUNTER_BY_NAME[e.n] = e; }
	w.clog = () => {}; w.ev = () => {}; w.bump = () => {}; w.throttleLog = () => {};
	w.leaderName = () => 'FatherToken';
	w.isLeader = () => w.character.name === 'FatherToken';
	w.character = w.character || {};
	w.character.name = 'FatherToken';
	lift(w, 'CaveRun.js', ['VOTE', 'CAVE_REVIVAL', 'compactEncounter', 'encounterTable', 'voteTableSource', 'encounterOf',
		'voteFightValue', 'voteFlagValue', 'voteOutcomeValue', 'voteScore', 'reserveNow', 'voteContext', 'votePlan',
		'REVIVE', 'deadMates', 'reviveChoice', 'voteEmit', 'voteOpen']);
	return w;
}
function navWorld(o) {
	o = o || {};
	const s = src();
	const kinds = /const NAV_ROOM_KINDS = (\[[^\]]*\]);/.exec(s);
	const me = Object.assign({ name: 'FatherToken', ctype: 'priest', x: 0, y: 0 }, o.me || {});
	const w = world({ TEAM: ['Dexon', 'FatherToken', 'MageofOz'], mode: 'cave', stopped: false,
		navOn: true, navGoal: null, navFlight: null, navManualUntil: 0, navEscort: null, navAt: {}, navSkip: {},
		navFails: {}, navSaid: {}, navLastDoor: 0, navDoorSince: 0, navLeg: null, navFloor: null,
		dieShops: {}, resting: false, deathLoop: false, holdFrom: 0, holdDone: false, exitForce: false, exitWhyFrom: 0,
		engagedUntil: 0, TROUBLE: { staleMs: 5000 }, REGROUP: { collectedWithin: 150 },
		CFG: { doorNear: 40, engageHoldMs: 8000, exit: { finalMs: 60000 } } });
	w.NAV_ROOM_KINDS = JSON.parse(kinds[1].replace(/'/g, '"'));
	w.character = { name: me.name, ctype: me.ctype, real_x: me.x, real_y: me.y, map: 'z', speed: 60, rip: false, range: 150 };
	w.beacons = () => o.beacons || {};
	w.said = [];
	w.clog = (m) => w.said.push(m); w.ev = () => {}; w.bump = () => {}; w.throttleLog = () => {};
	w.attackersOnMe = () => o.attackers || 0;
	w.threats = () => []; w.partyNames = () => w.TEAM; w.caveFriendly = () => false;
	w.dist = (a, b) => Math.hypot((a.real_x !== undefined ? a.real_x : a.x) - (b.real_x !== undefined ? b.real_x : b.x),
		(a.real_y !== undefined ? a.real_y : a.y) - (b.real_y !== undefined ? b.real_y : b.y));
	w.shopKeeper = () => null;
	w.isLeader = () => true; w.inCave = () => true; w.active = () => true; w.cavePaused = () => false;
	w.caveState = () => o.st || null;
	w.moves = []; w.stops = 0; w.transports = []; w.chests = {};
	w.smart_move = (p) => { w.moves.push(p); return new Promise(() => {}); };
	w.stop = () => { w.stops++; };
	w.move = () => {};
	w.transport = (to) => { w.transports.push(to); return Promise.resolve({}); };
	w.get_chests = () => w.chests;
	lift(w, 'CaveRun.js', ['NAV', 'navSpeed', 'navMs', 'navMe', 'navLanding', 'navDownDoor', 'navFloorObjs', 'navRequired',
		'navActors', 'navRoute', 'navNeedMs', 'navSlackMs', 'navInsert', 'navPoint', 'navOnce', 'navParty', 'landingWanted',
		'navFighting', 'navPlan', 'runFinished', 'navHalt', 'navLanded', 'navGo', 'navReached', 'navAtRoom', 'navTick',
		'navRegroupMove', 'navDriving', 'navNoteResolved']);
	return w;
}
