/* Priest-only: the engagement rule applied to the SKILL paths.

   The attack path has enforced "engage a cooperative boss only once somebody
   else is on it" since the rule was written, through findBestTargetInner's
   `boss.target` test. handleCurse and the zapper pick their own targets and
   never asked, so the priest opened boss fights through skills while the attack
   path correctly refused - observed by the operator on the 22:00 EU III franky
   window on 2026-10-20. Mage.js has neither skill, so this is Priest-only. */

const { lift, world } = require('./lift');
const PRIEST = 'Party/Priest.js';

const ALL_BOSSES = ['bgoo', 'bscorpion', 'crabxx', 'dragold', 'ent', 'franky',
	'greenjr', 'grinch', 'icegolem', 'jr', 'mrgreen', 'mrpumpkin', 'phoenix',
	'rgoo', 'wabbit'];
const BOSS_SET = new Set([...ALL_BOSSES,
	'pinkgoo', 'rharpy', 'rimedjinn', 'slenderman', 'snowman', 'tiger']);

function priest(over = {}) {
	const w = world(Object.assign({
		/* NEITHER SET IS LIFTABLE, and the reason is worth knowing:
		   `const BOSS_SET = new Set([...allBosses, ...])` has NO BRACE on its
		   initialiser, so lift()'s brace matcher runs past it and swallows the
		   ZAPPER_MOB_SET declaration and updateHomeDependentSets with it -
		   which silently overwrote this world's set, and then failed on a
		   second lift with "ZAPPER_MOB_SET has already been declared". Both are
		   supplied here and pinned against the committed source below. */
		BOSS_SET: BOSS_SET,
		allBosses: ALL_BOSSES,
		ZAPPER_MOB_SET: new Set([...ALL_BOSSES, 'sparkbot', 'poisio']),
		CONFIG: { combat: { zapper: true, zapperMobs: [...ALL_BOSSES, 'sparkbot'] } },
		character: { name: 'FatherToken', mp: 9999, range: 500, x: 0, y: 0 },
		G: { skills: { curse: { mp: 90 } } },
		is_in_range: () => true,
		is_on_cooldown: () => false,
		smart: { moving: false },
		home: 'poisio',
		destination: { x: 0, y: 0 },
	}, over));
	lift(w, PRIEST, ['bossCold', 'findZapTargets']);
	return w;
}

module.exports = [

{ name: 'the sets this suite supplies still match the committed source', fn(t) {
	/* The suite's whole value is lifting from the file that ships, so the two
	   sets it has to supply instead are pinned against the source text here -
	   otherwise a change to either would leave every assertion below testing a
	   stale copy and still passing. */
	const fs = require('fs');
	const path = require('path');
	const { ROOT } = require('./lift');
	const src = fs.readFileSync(path.join(ROOT, PRIEST), 'utf8');
	const m = src.match(/const allBosses = \[([^\]]*)\]/);
	t.ok('allBosses is found in the source', !!m);
	t.eq('and matches what this suite supplies',
		m[1].split(',').map((x) => x.trim().replace(/'/g, '')), ALL_BOSSES);
	t.ok('BOSS_SET is allBosses plus the six named extras',
		/const BOSS_SET = new Set\(\[\.\.\.allBosses,\s*'pinkgoo', 'rharpy', 'rimedjinn', 'slenderman', 'snowman', 'tiger'\]\)/.test(src));
	t.ok('and ZAPPER_MOB_SET is built from zapperMobs',
		/let ZAPPER_MOB_SET = new Set\(CONFIG\.combat\.zapperMobs\)/.test(src));
	t.ok('which is every boss plus sparkbot - why a boss was zappable at all',
		/zapperMobs: \[\.\.\.allBosses, "sparkbot"\]/.test(src));
} },

{ name: 'bossCold is the engagement rule, in one expression', fn(t) {
	const w = priest();
	t.eq('a boss nobody is on is COLD', w.bossCold({ mtype: 'franky', target: null }), true);
	t.eq('a boss somebody is on is not', w.bossCold({ mtype: 'franky', target: 'Dexon' }), false);
	t.eq('a farm mob is never cold - the rule is about bosses',
		w.bossCold({ mtype: 'poisio', target: null }), false);
	t.eq('nothing at all is not cold', w.bossCold(null), false);
	/* BOSS_SET is deliberately wider than the cooperative bosses - it carries
	   pinkgoo, snowman and others - and this matches the attack gate rather
	   than narrowing it. Asserted so the breadth is a decision, not a surprise. */
	t.eq('pinkgoo counts, because the attack gate counts it too',
		w.bossCold({ mtype: 'pinkgoo', target: null }), true);
} },

{ name: 'the zapper no longer opens boss fights - and still prefers untouched farm mobs', fn(t) {
	/* THE SETUP MUST SEPARATE THE TWO BRANCHES. `!e.target` is correct for a
	   farm mob and the exact inverse for a boss, so a test carrying only one
	   kind would pass against either version. All four combinations. */
	const ents = {
		a: { type: 'monster', mtype: 'franky', target: null, dead: false, visible: true },
		b: { type: 'monster', mtype: 'crabxx', target: 'Dexon', dead: false, visible: true },
		c: { type: 'monster', mtype: 'poisio', target: null, dead: false, visible: true },
		d: { type: 'monster', mtype: 'poisio', target: 'Dexon', dead: false, visible: true },
	};
	const w = priest({ parent: { entities: ents } });
	const got = w.findZapTargets().map((e) => e.mtype).sort();
	t.eq('an ENGAGED boss and an UNTOUCHED farm mob, and only those',
		got, ['crabxx', 'poisio']);
	t.note('before the fix: franky and poisio - the cold boss selected, the engaged one skipped');

	/* The rest of the predicate is unchanged and still has to hold. */
	const w2 = priest({ parent: { entities: {
		a: { type: 'monster', mtype: 'crabxx', target: 'Dexon', dead: true, visible: true },
		b: { type: 'monster', mtype: 'crabxx', target: 'Dexon', dead: false, visible: false },
		c: { type: 'npc', mtype: 'crabxx', target: 'Dexon', dead: false, visible: true },
		d: { type: 'monster', mtype: 'notinset', target: 'Dexon', dead: false, visible: true },
	} } });
	t.eq('dead, invisible, non-monster and out-of-set are all still excluded',
		w2.findZapTargets().length, 0);

	const w3 = priest({ CONFIG: { combat: { zapper: false, zapperMobs: [] } },
		parent: { entities: ents } });
	t.eq('and the whole thing is inert while zapper is off', w3.findZapTargets().length, 0);
} },

{ name: 'handleCurse: a cold boss is neither cursed nor allowed to shadow the fall-through', fn(t) {
	function curser(mons, over = {}) {
		const w = priest(Object.assign({
			get_nearest_monster_v2: (q) => {
				/* The boss loop asks by single type; the fall-through asks with
				   an array. The real selector returns the NEAREST of the types
				   asked for - this returns the first that exists, which is only
				   sound because the fall-through list no longer contains any
				   boss, so at most one entry of this table can match it. */
				const types = Array.isArray(q.type) ? q.type : [q.type];
				for (const ty of types) if (mons[ty]) return mons[ty];
				return null;
			},
		}, over));
		w.cast = [];
		w.use_skill = async (s, target) => { w.cast.push([s, target && target.mtype]); };
		lift(w, PRIEST, ['bossCold', 'handleCurse']);
		return w;
	}
	const full = (mtype, target) => ({ mtype, target, hp: 100, max_hp: 100, immune: false });

	/* THE DEFECT. A cold franky in range was selected and cursed. */
	let w = curser({ franky: full('franky', null) });
	return Promise.resolve(w.handleCurse()).then(() => {
		t.eq('a cold boss is not cursed', w.cast, []);

		/* AND IT MUST NOT `break` EITHER - that would shadow the farm-mob
		   fall-through and leave the priest casting nothing while a zappable
		   mob stood in range. This is the assertion that separates "skipped"
		   from "skipped and still looked further". */
		const w2 = curser({ franky: full('franky', null), poisio: full('poisio', null) });
		return Promise.resolve(w2.handleCurse()).then(() => {
			t.eq('and the farm mob behind it is still reached', w2.cast, [['curse', 'poisio']]);
			t.note('bosses are filtered OUT of the fall-through list, so a nearer cold boss cannot win the pick and block the curse');

			/* An ENGAGED boss is the case the rule exists to allow. */
			const w3 = curser({ franky: full('franky', 'Dexon') });
			return Promise.resolve(w3.handleCurse()).then(() => {
				t.eq('an engaged boss IS cursed', w3.cast, [['curse', 'franky']]);

				/* THE FOURTH PATH, which the boss loop alone does not cover:
				   the fall-through draws from [...zapperMobs, home] and
				   zapperMobs is [...allBosses, "sparkbot"], so it selects
				   bosses too.

				   The two queries are told apart by point_for_distance_check,
				   which only the fall-through passes - so this is a boss OUTSIDE
				   character.range and INSIDE 175 of the farm spot, which is a
				   real geometry rather than a contrived stub: range 100, boss at
				   ~150 from the spot. The boss loop misses it and the
				   fall-through finds it. */
				const w4 = priest({
					character: { name: 'FatherToken', mp: 9999, range: 100, x: 0, y: 0 },
					get_nearest_monster_v2: (q) => (q.point_for_distance_check
						? full('bgoo', null) : null),
				});
				w4.cast = [];
				w4.use_skill = async (sk, tg) => { w4.cast.push([sk, tg && tg.mtype]); };
				lift(w4, PRIEST, ['bossCold', 'handleCurse']);
				return Promise.resolve(w4.handleCurse()).then(() => {
					t.eq('a cold boss arriving through the fall-through is refused at the cast',
						w4.cast, []);
					t.note('the boss loop never saw it - only the cast-site guard stops this one');
				});
			});
		});
	});
} },

];
