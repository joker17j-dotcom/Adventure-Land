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

];
