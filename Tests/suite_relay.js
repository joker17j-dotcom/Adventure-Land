/* The party-link relay, across ALL THREE combat scripts. This is the suite
   that would have caught the follower reload loop: change_server reloads the
   page, plCursor and plSeen live only in memory, the bridge re-serves its
   ten-minute window, and bossHopFollow acts on the same boss_hop again.

   Run against each file in turn on purpose. The relay block is meant to be
   identical in all three so the next fix ports once instead of three times -
   Merchant fixed this exact bug in v68 and it took three weeks and a live
   reload loop to reach the others. A suite that only checked Ranger would
   not notice the day they diverge. */

const { lift, world } = require('./lift');

const FILES = ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js'];
const FOLLOWERS = ['Party/Priest.js', 'Party/Mage.js'];

function relay(file, over = {}) {
	const w = world(Object.assign({
		PL_CURSOR_KEY: 'pl_cursor', PL_ACTED_KEY: 'pl_acted', PL_ACTED_MAX: 20,
		plCursor: 0,
		plLog: function (m) { this.logs.push(String(m)); },
	}, over));
	w.plLog = (m) => w.logs.push(String(m));
	lift(w, file, ['plSaveCursor', 'plActed', 'plMarkActed']);
	return w;
}

module.exports = [

{ name: 'the acted-list is durable, which is the whole fix', fn(t) {
	for (const f of FILES) {
		const w = relay(f);
		t.eq(`${f}: an unseen id is not acted`, w.plActed('Dexon-1-1'), false);
		w.plMarkActed('Dexon-1-1');
		t.eq(`${f}: and is after marking`, w.plActed('Dexon-1-1'), true);

		/* The reload. Memory dies, CODE storage does not - which is exactly
		   why the list lives there and plSeen could not do this job. */
		const after = relay(f, { store: w.store });
		t.eq(`${f}: SURVIVES the reload a hop causes`, after.plActed('Dexon-1-1'), true);

		for (let i = 0; i < 25; i++) w.plMarkActed('id-' + i);
		const list = w.get('pl_acted');
		t.eq(`${f}: capped at PL_ACTED_MAX`, list.length, 20);
		t.eq(`${f}: keeping the NEWEST`, list[list.length - 1], 'id-24');
		t.eq(`${f}: and dropping the oldest`, list.includes('Dexon-1-1'), false);

		t.eq(`${f}: a null id is never acted`, w.plActed(null), false);
	}
} },

{ name: 'relay storage failures degrade loudly, never silently', fn(t) {
	for (const f of FILES) {
		let w = relay(f);
		w.set = () => { throw new Error('storage down'); };
		let threw = false;
		try { w.plMarkActed('x'); } catch (e) { threw = true; }
		t.eq(`${f}: a failed write does not throw into the caller`, threw, false);
		t.that(`${f}: and says the message may replay`, w.logs.some((l) => /may replay/.test(l)), w.logs.join(' | '));

		w = relay(f);
		w.get = () => { throw new Error('storage down'); };
		t.eq(`${f}: a failed read answers "not acted" - the safe direction`, w.plActed('x'), false);
		t.that(`${f}: and logs rather than guessing quietly`, w.logs.some((l) => /acted-list read failed/.test(l)), w.logs.join(' | '));

		w = relay(f);
		w.set = () => { throw new Error('storage down'); };
		w.plSaveCursor(42);
		t.that(`${f}: a cursor that cannot be persisted warns about the backlog`,
			w.logs.some((l) => /persist the relay cursor/.test(l)), w.logs.join(' | '));
	}
} },

{ name: 'bossHopFollow stays byte-identical between Priest and Mage', fn(t) {
	/* The follower half must not drift: three independent pickers reading
	   slightly different snapshots would scatter the party across shards,
	   and a split party earns the 1.00 solo multiplier instead of 1.30.
	   Only the -> <Name>Comments.md pointer in the doc comment above it may
	   differ, which is why the function BODY is what is compared. */
	const { extract } = require('./lift');
	for (const name of ['plHopPendingRead', 'plHopPendingWrite', 'plHopPendingClear',
			'plHopPendingResolve']) {
		const texts = FOLLOWERS.map((f) => extract(f, name));
		t.eq(`${name} is identical in Priest and Mage`, texts.every((x) => x === texts[0]), true);
	}
	const bodies = FOLLOWERS.map((f) => extract(f, 'bossHopFollow'));
	t.eq('the two bodies are identical', bodies[0] === bodies[1], true);
	t.note(`${Buffer.byteLength(bodies[0])} bytes in both`);

	/* The guard that closes the loop, and the ordering that makes it work:
	   nothing after change_server runs, so the acted-id and the log line
	   must both be written before it. */
	const b = bodies[0];
	/* The CALL, not the word: the doc comment above mentions change_server
	   three times before the call site, and matching the bare name put the
	   first failing run of this suite 1,700 bytes off. */
	const iActed = b.indexOf('plMarkActed(');
	const iLog = b.indexOf('Following Dexon');
	const iHop = b.indexOf('change_server(data.region');
	t.that('plMarkActed is written BEFORE change_server', iActed > 0 && iActed < iHop, [iActed, iHop]);
	t.that('and so is the log line - it used to sit after, and never printed', iLog > 0 && iLog < iHop, [iLog, iHop]);
	t.that('the same-shard guard reads parent.server_region', /parent\.server_region/.test(b), true);
	t.eq('no silent catch left in it', (b.match(/catch \(e\) \{\s*\}/g) || []).length, 0);
} },

{ name: 'bossApproach has not diverged - the branch that strands followers', fn(t) {
	/* WHY THIS SUITE AND NOT suite_bosshop.js. v94 taught the leader to WALK
	   to a taxi-join boss when hop sickness refuses the lift, and shipped it
	   to Ranger alone. The followers kept the unconditional bail, and because
	   shouldHandleEvents() owns movement while a trip is live - holdCohesion()
	   sits in its `else` - they were pinned where they stood for up to
	   maxTripMs while the leader walked to the boss. Leader boss-side with no
	   healer, which is the 2026-09-26 failure reached by a new route, and
	   Dexon was lost to its older form on 2026-10-17.
	   Nothing in suite_bosshop.js could see it: every assertion there is about
	   Ranger. Divergence is only visible from a suite that reads all three. */
	const { extract } = require('./lift');
	const FILES3 = ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js'];

	const approach = FILES3.map((f) => extract(f, 'bossApproach'));
	const i0 = approach[0].indexOf('if (BOSS_JOIN_SPOTS[name]) {');
	const branch = approach.map((a) => {
		const i = a.indexOf('if (BOSS_JOIN_SPOTS[name]) {');
		return i < 0 ? null : a.slice(i, a.indexOf('\n\t}\n', i));
	});
	t.that('all three have the join branch', branch.every((b) => b !== null), branch.map((b) => b === null));
	t.eq('the branch is byte-identical in all three',
		branch.every((b) => b === branch[0]), true);
	t.note(`${Buffer.byteLength(branch[0] || '')} bytes in each`);

	for (let i = 0; i < FILES3.length; i++) {
		const b = branch[i] || '';
		/* The specific regression, named rather than implied: an
		   unconditional bail on hopsickness is what v94 removed from Ranger
		   and left in the other two. */
		t.eq(`${FILES3[i]}: no unconditional hopsick bail`,
			/hopsickness\)\s*\{\s*bossNote\('hopsick - cannot join/.test(b), false);
		t.that(`${FILES3[i]}: the bail is gated on bossTaxiWalkable`,
			/if \(!bossTaxiWalkable\(name\)\)/.test(b), b.slice(0, 80));
	}

	/* The predicate itself has to be the same function, not merely present. */
	const walk = FILES3.map((f) => extract(f, 'bossTaxiWalkable'));
	t.eq('bossTaxiWalkable is identical in all three', walk.every((w) => w === walk[0]), true);
	const spots = FILES3.map((f) => extract(f, 'BOSS_JOIN_SPOTS'));
	t.eq('and so is the table it reads', spots.every((x) => x === spots[0]), true);
} },

{ name: 'the relay block has not diverged across the three scripts', fn(t) {
	/* Merchant fixed this bug in v68 and it took three weeks to reach the
	   other three. Keeping the block identical is what makes the next fix
	   port once; this is the check that notices when it stops being. */
	const { extract } = require('./lift');
	for (const name of ['plSaveCursor', 'plActed', 'plMarkActed']) {
		const texts = FILES.map((f) => extract(f, name));
		const same = texts.every((x) => x === texts[0]);
		t.eq(`${name} is identical in Ranger, Priest and Mage`, same, true);
	}
} },

{ name: 'the goobrawl spawn-set mapping has not diverged across the three scripts', fn(t) {
	/* IT WAS NEVER COVERED, and the other session assumed it was - the relay
	   block check above names plSaveCursor/plActed/plMarkActed and nothing
	   else, so three copies of BOSS_FIGHT_TYPE could have drifted silently.
	   They did not, but nothing would have said so. This is the check. */
	const { extract } = require('./lift');
	/* bossWalkTarget JOINED THE LIST 2026-10-22, when it stopped being three
	   identical one-liners and started carrying the rage-box guard. It was
	   never asserted before and did not need to be; the moment a guard lives
	   in it, an un-checked copy in two of three files is the exact drift this
	   block exists for - and it would have been invisible, because the
	   followers would simply walk somewhere the leader refuses. */
	for (const name of ['BOSS_FIGHT_TYPES', 'bossMonsterTypes', 'bossNearestMonster',
		'bossWalkTarget',
		/* The rage-entry set, added 2026-10-22. Entry is containment coming OFF,
		   so a copy that drifts means one character accepting a destination
		   another still refuses - the party splits and nothing logs a fault.
		   This is the set where identity is load-bearing rather than tidy. */
		'rageCrowdSoak', 'rageAttackersOnMe', 'rageEntrySet', 'rageEntryTick',
		'rageEntryBroadcast', 'rageEntryOnCall',
			'bossCooperative']) {
		const texts = FILES.map((f) => extract(f, name));
		t.eq(`${name} is identical in Ranger, Priest and Mage`,
			texts.every((x) => x === texts[0]), true);
	}

	/* rageCfg CANNOT GO IN THE LOOP ABOVE, and that is the whole reason this
	   second check exists rather than a fourth name. Its bodies differ by
	   exactly one token - the `-> RangerComments.md#...` pointer, which is
	   per-file BY DESIGN - so a byte-identity assertion on it would fail
	   against correct code, and the tempting repair is to leave it out of the
	   check entirely. That is what had happened: a mutation dropping
	   `!rageEntryActive` from PRIEST's copy alone passed every assertion in
	   this file. Entry is containment coming off, so that one missing term is
	   the leader walking into the rectangle while a follower's safeMove still
	   refuses it.
	   NORMALISE THE ONE THING THAT MAY DIFFER, then compare the rest. */
	const norm = (x) => x.replace(/(Ranger|Priest|Mage)Comments\.md/g, '<X>Comments.md');
	const cfgs = FILES.map((f) => norm(extract(f, 'rageCfg')));
	t.eq('rageCfg is identical once the per-file comment pointer is normalised',
		cfgs.every((x) => x === cfgs[0]), true);
	/* INVERTED, so the normaliser is proved to be doing work rather than
	   hiding a real difference: un-normalised they genuinely differ. */
	const raw = FILES.map((f) => extract(f, 'rageCfg'));
	t.eq('and they are NOT byte-identical, which is why the loop cannot take it',
		raw.every((x) => x === raw[0]), false);
	/* The term itself, named, because it is the one that splits the party. */
	const { ROOT: R2 } = require('./lift');
	for (const f of FILES) {
		const src = require('fs').readFileSync(require('path').join(R2, f), 'utf8');
		t.eq(`${f}: rageCfg gates enabled on the entry lever`,
			(src.match(/enabled: a\.enabled !== false && !rageEntryActive,/g) || []).length, 1);
	}
	/* THE FILE SET IS DERIVED, NOT LISTED, and that is this check's own lesson
	   applied to itself. The loop above fixes "a check covers the NAMES it
	   lists" by naming four; FILES is the same kind of list, so scoping the
	   survival check to it would have read as repo-wide while covering three of
	   FOUR copies - Codex/FamilyFleet.js carried the single-valued mapping with
	   the same three call-site shape, and was invisible to a FILES loop. The
	   other session found it after this check was written and passing.
	   Crowns3bc/ is excluded for free rather than deliberately: those files
	   carry no extension, so a '*.js' walk skips them - which is the behaviour
	   CLAUDE.md warns about, and is CORRECT here, since that directory is
	   reference-only and must never be edited. */
	const fs = require('fs');
	const path = require('path');
	const { ROOT } = require('./lift');
	const js = [];
	(function walk(dir) {
		for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
			const rel = dir ? dir + '/' + e.name : e.name;
			if (e.isDirectory()) {
				if (e.name === '.git' || e.name === 'node_modules' || e.name === 'Archived') continue;
				walk(rel);
			} else if (e.name.endsWith('.js')) {
				js.push(rel);
			}
		}
	})('');
	t.ok('the walk found the scripts it is meant to cover', js.length >= 4);
	const offenders = js.filter((f) => /BOSS_FIGHT_TYPE\s*=/.test(
		fs.readFileSync(path.join(ROOT, f), 'utf8')));
	t.eq('no single-valued BOSS_FIGHT_TYPE survives in ANY tracked .js', offenders, []);
	/* And every file that carries the mapping at all names both products, so a
	   fifth copy cannot land with one of them. */
	const carriers = js.filter((f) => /BOSS_FIGHT_TYPES\s*=/.test(
		fs.readFileSync(path.join(ROOT, f), 'utf8')));
	t.eq('four files carry the mapping - the three party scripts and FamilyFleet',
		carriers.length, 4);
	for (const f of carriers) {
		t.eq(`${f}: both goo types are named`, /goobrawl: \['rgoo', 'bgoo'\]/.test(
			fs.readFileSync(path.join(ROOT, f), 'utf8')), true);
	}
} },

{ name: 'a follower that fails to hop can retry - the mark waits for arrival', fn(t) {
	/* Operator, 22:00 EU III franky: "MageofOz did not hop with the party I had
	   to do that." The mark had to be written BEFORE change_server because
	   nothing after that call runs - so a hop that threw or no-opped was
	   indistinguishable from one that worked, permanently, and the durable
	   acted-list refused every retry. */
	const { lift, world } = require('./lift');
	const GRACE = 15000;

	function follower(store, here, over = {}) {
		const w = world(Object.assign({
			PL_ACTED_KEY: 'pl_acted',
			PL_ACTED_MAX: 20,
			PL_HOP_PENDING_KEY: 'pl_hop_pending',
			PL_HOP_GRACE_MS: GRACE,
			PL_HOP_TRIES_MAX: 3,
			/* world() supplies its own `parent` with a default shard on it, so
			   passing `parent: {}` does NOT produce an unreadable shard - it is
			   merged over and the default survives. The null case is made by
			   deleting the two fields from the object the lifted code actually
			   reads, after the lift. Passing {} silently tested nothing. */
			parent: { server_region: 'US', server_identifier: 'II' },
			get: (k) => (k in store ? store[k] : null),
			set: (k, v) => { store[k] = v; },
			plLog: () => { },
			game_log: () => { },
		}, over));
		w.hops = [];
		w.change_server = (r, n) => { w.hops.push(r + n); };
		lift(w, 'Party/Priest.js', ['plActed', 'plMarkActed', 'plHopPendingRead',
			'plHopPendingWrite', 'plHopPendingClear', 'plHopPendingResolve']);
		if (here) { w.parent.server_region = here.slice(0, 2); w.parent.server_identifier = here.slice(2); }
		else { delete w.parent.server_region; delete w.parent.server_identifier; }
		return w;
	}
	const pend = (over = {}) => Object.assign({
		plid: 'Dexon-1-54', region: 'EU', name: 'III', land: 'EUIII',
		mtype: 'franky', at: Date.now(), tries: 0,
	}, over);

	/* ARRIVED. This is the only moment success is distinguishable, because the
	   success case destroys the page before it could report anything. */
	let store = { pl_hop_pending: pend() };
	let w = follower(store, 'EUIII');
	w.plHopPendingResolve();
	t.eq('landing on the ordered shard marks the order acted', w.plActed('Dexon-1-54'), true);
	t.eq('and clears the pending record', store.pl_hop_pending, null);
	t.eq('without hopping again', w.hops, []);

	/* STILL IN FLIGHT. A navigation that has not landed yet must not be
	   retried on top of itself. */
	store = { pl_hop_pending: pend() };
	w = follower(store, 'USII');
	w.plHopPendingResolve();
	t.eq('inside the grace window nothing happens', w.hops, []);
	t.eq('and it is not marked acted', w.plActed('Dexon-1-54'), false);

	/* THE DEFECT, FIXED. Past the grace window and still on the wrong shard:
	   the hop did not take, and now it retries instead of being lost. */
	store = { pl_hop_pending: pend({ at: Date.now() - GRACE - 1 }) };
	w = follower(store, 'USII');
	w.plHopPendingResolve();
	t.eq('a hop that never landed is retried', w.hops, ['EUIII']);
	t.eq('the attempt is counted', store.pl_hop_pending.tries, 1);
	t.eq('and it is STILL not acted, so it can retry again', w.plActed('Dexon-1-54'), false);
	t.note('before the fix this plid was already in the acted-list, and the dedupe refused every retry forever');

	/* BOUNDED. A shard that refuses us forever must not reload forever. */
	store = { pl_hop_pending: pend({ at: Date.now() - GRACE - 1, tries: 3 }) };
	w = follower(store, 'USII');
	w.plHopPendingResolve();
	t.eq('at the try cap it gives up rather than retrying', w.hops, []);
	t.eq('marks the order acted so it cannot replay', w.plActed('Dexon-1-54'), true);
	t.eq('and clears the pending record', store.pl_hop_pending, null);

	/* NOWHERE IS NOT WRONG-SHARD. If the current shard cannot be read, retrying
	   blind would hop a character that had already arrived. */
	store = { pl_hop_pending: pend({ at: Date.now() - GRACE - 1 }) };
	w = follower(store, null);
	w.plHopPendingResolve();
	t.eq('an unreadable shard decides nothing', w.hops, []);
	t.eq('and marks nothing', w.plActed('Dexon-1-54'), false);
	/* THE TRAP THIS GUARDS, pinned so the naive form cannot come back:
	   `undefined + undefined` is a truthy STRING that equals no real shard, so
	   a bare concatenation reads as "wrong shard" and retries a hop that may
	   already have landed. */
	t.eq('because undefined + undefined is truthy, not empty',
		String(undefined) + String(undefined), 'undefinedundefined');
	t.ok('so both halves are type-checked before concatenating',
		/typeof rg === 'string' && rg && typeof id === 'string' && id/.test(
			require('./lift').extract('Party/Priest.js', 'plHopPendingResolve')));

	/* Nothing pending is a no-op, which is the common case on every load. */
	store = {};
	w = follower(store, 'EUIII');
	w.plHopPendingResolve();
	t.eq('no pending record does nothing at all', w.hops, []);

	/* A STORAGE WRITE THAT FAILS falls back to marking acted, because without a
	   durable pending record the retry machinery cannot work and a replay loop
	   is the worse failure. */
	store = { pl_hop_pending: pend({ at: Date.now() - GRACE - 1 }) };
	w = follower(store, 'USII', { set: (k, v) => { if (k === 'pl_hop_pending') throw new Error('nope'); store[k] = v; } });
	w.plHopPendingResolve();
	t.eq('an unwritable pending record is abandoned, not looped',
		w.plActed('Dexon-1-54'), true);
} },

{ name: 'bossHopFollow records PENDING, never acted, before it hops', fn(t) {
	const { extract } = require('./lift');
	for (const f of FOLLOWERS) {
		const body = extract(f, 'bossHopFollow');
		/* THE REGRESSION GUARD, and the first version of it PASSED FOR THE
		   WRONG REASON: it was named "does not mark the incoming plid acted"
		   and asserted that plMarkActed(data._plid) was PRESENT. It is present
		   - once, inside the failed-write fallback - so the assertion held
		   while saying the opposite of what it checked. Stated as the mechanism
		   instead: exactly one occurrence, and none of it outside the
		   fallback. */
		t.eq(`${f}: plMarkActed(data._plid) appears exactly once`,
			(body.match(/plMarkActed\(data\._plid\)/g) || []).length, 1);
		const withoutFallback = body.replace(
			/if \(!plHopPendingWrite\(\{[\s\S]*?\}\)\) \{\s*plMarkActed\(data\._plid\);\s*\}/, '');
		t.eq(`${f}: and nowhere outside the failed-write fallback`,
			/plMarkActed\(data\._plid\)/.test(withoutFallback), false);
		t.ok(`${f}: writes a pending record`, /plHopPendingWrite\(\{/.test(body));
		t.ok(`${f}: and only marks data._plid acted when that write FAILED`,
			/if \(!plHopPendingWrite\(\{[\s\S]*?\}\)\) \{\s*plMarkActed\(data\._plid\);/.test(body));
		t.ok(`${f}: refuses a replay of an order already in flight`,
			/inFlight\.plid === data\._plid/.test(body));
		t.ok(`${f}: compares arrival against region+name, not data.shard`,
			/land: `\$\{data\.region\}\$\{data\.name\}`/.test(body));
	}
	t.note('land is region+name because that is where change_server actually sends us');
} },

];
