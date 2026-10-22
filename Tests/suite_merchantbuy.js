/* Tests/suite_merchantbuy.js - the Ponty buy cap, and specifically that an
   item which does not stack is not capped at all.

   WHY THIS SUITE EXISTS. Operator's ruling 2026-10-21: "The previous buy cap
   was predicated on items that stack and only buying up to a single full
   stack. For items that do not stack there is not supposed to be a buy cap
   from ponty." pontyStackCap() returned `it.s || 1`, so an unstackable id
   capped at one copy - 23 of the 58 live buy-list ids.

   THE SOURCE AND THE LIVE CLIENT DISAGREE ABOUT `s`'s SHAPE, AND THAT IS WHY
   BOTH BRANCHES EXIST. `design/items.js` carries `s: true` on 201 of 671
   entries at current upstream HEAD. Live G, read off a character tab, carries
   NO BOOLEAN AT ALL - 653 entries, 216 reading 9999, not one reading true. No
   normaliser exists in the server source, and the two sites that consume `s`
   resolve the boolean inline (`s === true && 9999 || s` in can_stack), which
   is what you write only when the data really does carry booleans. The
   resolution site is unexplained.

   SO THE BOOLEAN ASSERTIONS BELOW PIN ARITHMETIC, NOT A LIVE DEFECT. An
   earlier version of this header claimed 19 further ids were capped at one
   copy by `true` coercing through `have >= stackCap`. The coercion is real;
   the conclusion was not, because live G hands those ids 9999. It was inferred
   from source and asserted about the running game, and pontyStackCap() reads G
   in the script's own context - so live G is not a second copy that might
   disagree, it is the input to the function. Retracted in v111.

   A numeric-first rewrite would still cap a boolean-shaped stackable at one
   copy, because Number(true) is 1. Unreachable today, one unexplained change
   away from reachable, which is why the ordering is pinned rather than left to
   taste.

   -> CLAUDE.md "Selling, banking and what must never be vendored", "Testing"
   -> Party/MerchantComments.md#pontyStackCap */
const fs = require('fs');
const path = require('path');
const { lift, world, extract, ROOT } = require('./lift');

const MERCHANT = 'Party/Merchant.js';
const text = () => fs.readFileSync(path.join(ROOT, MERCHANT), 'utf8');

/* G.items stub: the four shapes the real table actually presents. */
function itemsWorld() {
	return world({
		parent: {
			server_region: 'US', server_identifier: 'IV',
			G: {
				items: {
					zapper:      { name: 'zapper' },               // no `s` at all
					leather:     { name: 'leather',  s: true },    // stackable, size unstated
					dkey:        { name: 'dkey',     s: 50 },      // explicit stack size
					ashleaf:     { name: 'ashleaf',  s: 9999 },
					weird:       { name: 'weird',    s: 0 },       // degenerate
				},
			},
		},
	});
}

module.exports = [{

name: 'pontyStackCap: no cap on an item that does not stack', fn(t) {
	const w = itemsWorld();
	/* PRECONDITION, per CLAUDE.md: assert the stub is the thing the lifted code
	   reads, or a merge in world() can leave the case unexercised. */
	t.ok('stub G.items reached the world', !!(w.parent && w.parent.G && w.parent.G.items && w.parent.G.items.zapper));
	t.ok('zapper carries no s in the stub', w.parent.G.items.zapper.s === undefined);

	lift(w, MERCHANT, 'pontyStackCap');
	t.eq('an unstackable id has NO cap', w.pontyStackCap('zapper'), null);
	t.eq('an id absent from G has no cap', w.pontyStackCap('nosuchitem'), null);
	t.eq('a degenerate s: 0 has no cap', w.pontyStackCap('weird'), null);
} },

{ name: 'pontyStackCap: s: true resolves to the game’s own 9999', fn(t) {
	const w = itemsWorld();
	lift(w, MERCHANT, 'pontyStackCap');
	t.eq('a source-shaped s: true caps at a full stack, not one copy', w.pontyStackCap('leather'), 9999);
	t.eq('an explicit size is used as given', w.pontyStackCap('dkey'), 50);
	t.eq('an explicit 9999 is used as given', w.pontyStackCap('ashleaf'), 9999);

	/* THE OLD EXPRESSION, PRESERVED AS ARITHMETIC. Both halves, so a reader
	   cannot conclude either branch is redundant and collapse it. The absent-`s`
	   case below is the defect that was real on live data; the boolean case is
	   reachable only if the client ever serves the shape the source carries. */
	const old = (it) => it.s || 1;
	t.eq('the old expression returned the BOOLEAN for a source-shaped s', old({ s: true }), true);
	t.ok('and the call site coerces it to a cap of one', (1 >= true) === true && (0 >= true) === false);
	t.eq('the old expression capped an unstackable id at one - the REAL defect', old({}), 1);
} },

{ name: 'pontyStackCap: the order of the tests is load-bearing', fn(t) {
	/* Number(true) is 1, so a numeric-first rewrite reinstates the exact bug
	   this function was fixed for. Pinned as arithmetic rather than as advice. */
	t.eq('Number(true) is 1', Number(true), 1);
	t.ok('so a Number()-first branch would cap a boolean-shaped s at one copy',
		(typeof Number(true) === 'number') && Number(true) === 1);

	const body = extract(MERCHANT, 'pontyStackCap');
	const atBool = body.indexOf('it.s === true');
	const atNum = body.indexOf("typeof it.s === 'number'");
	t.ok('the boolean branch is present', atBool > 0);
	t.ok('the numeric branch is present', atNum > 0);
	t.ok('the boolean branch is tested FIRST', atBool < atNum);
	t.eq('the old it.s || 1 fallback is gone', body.indexOf('it.s || 1'), -1);
} },

{ name: 'the call site treats a null cap as no cap', fn(t) {
	/* pontyStackCap returning null only means "uncapped" because the guard is
	   a truthiness test. If that guard ever became `stackCap != null` the null
	   would start capping at... null, and every comparison would be have >= 0.
	   Assert the mechanism the return value depends on. */
	const s = text();
	t.ok('the guard is a truthiness test on the cap',
		s.indexOf('if (stackCap && have >= stackCap)') > 0);
	t.ok('have counts bank stock plus this pass',
		s.indexOf("const have = (bankQty[r.name] || 0) + (boughtThisPass[r.name] || 0);") > 0);

	/* And the arithmetic that makes a null safe. */
	t.ok('null is falsy so the guard is skipped entirely', !(null && 5 >= null));
	t.ok('0 >= null would otherwise be true', (0 >= null) === true);
} },

{ name: 'the level ceiling is a level, not a price in disguise', fn(t) {
	/* Operator's ruling 2026-10-21 on dexbelt: "+0, +1, +2 ONLY - they are an
	   ingredient, higher is not acceptable." A 1,000,000 price ceiling does
	   implement that at secondhands_mult 2, and STOPS implementing it if that
	   multiplier moves - at 4 the +2 asks 1,273,600 and the same ceiling
	   refuses the belt the craft needs. So the level rule is stated as a level
	   and the arithmetic that makes the price proxy fragile is pinned here. */
	const s = text();
	t.ok('the buy is on the list', s.indexOf("'dexbelt',") > 0);
	t.ok('the price ceiling is set', s.indexOf('maxPrice: { dexbelt: 1000000 }') > 0);
	t.ok('the level ceiling is set', s.indexOf('maxLevel: { dexbelt: 2 }') > 0);
	t.ok('the guard reads maxLevel', s.indexOf("const lvlCap = (cfg.maxLevel || {})[r.name];") > 0);
	t.ok('and refuses only ABOVE the ceiling',
		s.indexOf("typeof lvlCap === 'number' && (r.level || 0) > lvlCap") > 0);

	/* The arithmetic. Ponty asks calculate_item_value(item) x secondhands_mult,
	   and the per-level npc values were measured 2026-10-21. */
	const npc = { 0: 30000, 1: 98667, 2: 318400, 3: 1118880, 4: 3680416 };
	const ask = (lvl, mult) => npc[lvl] * mult;
	t.ok('at mult 2 a 1,000,000 ceiling admits the +2', ask(2, 2) < 1000000);
	t.ok('at mult 2 a 1,000,000 ceiling refuses the +3', ask(3, 2) > 1000000);
	t.ok('AT MULT 4 THE SAME CEILING REFUSES THE +2 the craft needs', ask(2, 4) > 1000000);
	t.eq('which is why the level cap is not redundant', 2, 2);

	/* A non-upgradeable row carries no level and must not be refused. */
	const refuse = (lvl, lvlCap) => (typeof lvlCap === 'number' && (lvl || 0) > lvlCap);
	t.ok('an absent level reads as 0 and passes', !refuse(undefined, 2));
	t.ok('+2 passes', !refuse(2, 2));
	t.ok('+3 is refused', refuse(3, 2));
	t.ok('an id with no ceiling is never refused', !refuse(9, undefined));
} },

{ name: 'cscroll4 is off the buy list', fn(t) {
	/* Not an item - the game has cscroll0 through cscroll3, against scroll0
	   through scroll4. Confirmed from source here and from live G.items by the
	   browser session, then removed on the operator's ruling. */
	const s = text();
	const at = s.indexOf('pontyBuy: {');
	const items = s.slice(at, s.indexOf('goldFloor', at));
	t.ok('the buy list block was located', at > 0 && items.length > 0);
	t.eq('cscroll4 is absent', items.indexOf("'cscroll4'"), -1);
	t.ok('cscroll3 is still there', items.indexOf("'cscroll3'") > 0);
} },

{ name: 'every -> Comments.md#anchor pointer resolves', fn(t) {
	/* A `->` pointing at an anchor that does not exist is a claim that rots in
	   total silence: it reads as "the rationale is written down" and nothing
	   checks it. 14 dangled in Party/Merchant.js alone on 2026-10-21, against
	   zero in Ranger, Priest and Mage.

	   NO ALLOWLIST. The 14 were resolved by DELETING the pointer wherever the
	   reasoning was already at the call site - an archive nobody needs is a
	   second place to keep in step, which is the drift this repo pays for
	   everywhere else - and by writing the two sections that had real content.
	   So this can be a plain assertion, and a new dangling pointer fails it.

	   The convention line at the top of each script ("a line ending
	   `-> XComments.md#anchor` is a SUMMARY") is not a pointer. It produced four
	   false dangles in the first audit, from the tool built to find the real
	   ones. */
	const files = ['Party/Merchant.js', 'Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js'];
	const anchorsOf = (f) => {
		const md = path.join(ROOT, f);
		if (!fs.existsSync(md)) return null;
		const out = new Set();
		for (const m of fs.readFileSync(md, 'utf8').matchAll(/^## (.+)$/gm)) out.add(m[1].trim());
		return out;
	};
	const cache = {};
	let checked = 0;
	const dangling = [];
	for (const f of files) {
		const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
		for (const m of src.matchAll(/\b([A-Za-z]+)Comments\.md#([A-Za-z0-9_-]+)/g)) {
			const doc = 'Party/' + m[1] + 'Comments.md';
			const anc = m[2];
			/* The convention placeholder, not a pointer. */
			if (anc === 'anchor') continue;
			if (!(doc in cache)) cache[doc] = anchorsOf(doc);
			if (cache[doc] === null) { dangling.push(doc + ' (missing file)'); continue; }
			checked++;
			if (!cache[doc].has(anc)) dangling.push(doc + '#' + anc + ' <- ' + f);
		}
	}
	t.ok('pointers were actually found and checked (>200)', checked > 200);
	t.eq('no pointer names a missing anchor: ' + dangling.slice(0, 8).join(', '), dangling.length, 0);
} },

{ name: 'the windbelt note carries structure, not bank quantities', fn(t) {
	/* The figures it used to quote had all rotted: 1,963 stormfeather and "no
	   dexbelt+2 banked" against 2,735 and exactly one by 2026-10-21 - and the
	   conclusion drawn from them ("tier 2 short, tier 3 unreachable") was the
	   operator's to make and wrong toward pessimism. Refreshing them would only
	   restart the decay, because the bank moves several times a day. */
	/* THE FIGURES ARE STILL IN THE FILE AND MUST BE - this repo keeps a
	   superseded reading as the instance rather than overwriting it. So the
	   assertion cannot be "the string is gone"; the first version of it was
	   exactly that and failed against correct code. What matters is that every
	   stale figure sits INSIDE the retraction rather than being asserted as
	   current, which is a question about POSITION that a string search cannot
	   answer. */
	const s = text();
	const retraction = s.indexOf('THIS BLOCK USED TO QUOTE BANK CONTENTS AND THEY HAD ALL ROTTED');
	t.ok('the retraction is present', retraction > 0);
	for (const stale of ['1,963 stormfeather', 'no dexbelt+2 banked', '18 essenceofether held']) {
		const at = s.indexOf(stale);
		t.ok('"' + stale + '" appears only inside the retraction', at > retraction);
		t.eq('and appears exactly once', s.split(stale).length - 1, 1);
	}
	t.ok('the recipe is kept', s.indexOf("1x dexbelt+2 + 40x stormfeather") > 0);
	t.ok('the binding input is named as structural', s.indexOf('WHICH INPUT BINDS IS STRUCTURAL') > 0);
	t.ok('and the rule is stated where the rot was',
		s.indexOf('DO NOT WRITE DOWN WHAT A SINGLE CALL ANSWERS') > 0);
} },

{ name: 'the config comment no longer promises a single-copy cap', fn(t) {
	/* The comment on capAtOneStack said "one copy for anything that does not
	   stack" - a correct description of the old code and a direct contradiction
	   of the operator's ruling. A comment is a claim. */
	const s = text();
	t.eq('the superseded wording is gone', s.indexOf('one copy for anything that does not stack'), -1);
	t.ok('and the ruling is recorded where the flag is configured',
		s.indexOf('NEVER on an id that does not stack') > 0);
} }, {

name: 'the bank sources compound triples, and only ones the compounder will take', async fn(t) {
	/* Operator's requirement 2026-10-22 off a measured finding: the bank is
	   336/336 FULL and holds 77x dexbelt@0 - levelled items do not stack, so
	   that is 77 slots, 22.9% of the whole bank - against 0 at @1, 4 at @2.
	   The compound mechanics already existed; the only gap was SOURCING, since
	   findBaseDuplicateGroup() reads character.items and nothing else. */
	const pulled = [];
	function bw(over) {
		over = over || {};
		const w = world({
			character: {
				name: 'Meltymerch', map: 'bank',
				esize: over.esize === undefined ? 20 : over.esize,
				items: over.items || [],
				bank: over.bank === undefined ? { items0: over.pack0 || [] } : over.bank,
			},
			CONFIG: { bank: { map: 'bank' }, craftInputCaps: { dexbelt: 2 } },
			/* BARE `G`, NOT `parent.G`, and the difference cost four failures in
			   this test's first run. isCompoundableItem() reads `G.items`
			   directly - `typeof G !== 'undefined' && G.items` - while most of
			   this file reaches through `parent.G`. Supplied as parent.G alone,
			   the typeof guard fails, the function falls through to its
			   GEAR_PROGRESSION scan and returns its "unknown item, assume
			   compoundable" default, so `coat` read as compoundable and the
			   assertion caught a fixture bug rather than a code one. */
			G: { items: {
				dexbelt: { name: 'dexbelt', compound: true },
				intbelt: { name: 'intbelt', compound: true },
				coat:    { name: 'coat' },                 // not compoundable
			} },
			parent: { G: { items: {} } },
			bank_retrieve: async (pack, i) => {
				if (over.failWith) { const e = new Error(over.failWith); e.reason = over.failWith; throw e; }
				pulled.push(pack + ':' + i);
			},
			sleep: async () => {},
			game_log: () => {},
			arbHeldNames: () => over.held || {},
			PARTY_CLASSES: [],
			GEAR_PROGRESSION: {},
		});
		lift(w, MERCHANT, ['COMPOUND_RETRIEVE_HEADROOM', 'craftInputCap',
			'compoundWouldOvershootCap', 'isCompoundableItem', 'retrieveCompoundTriples']);
		return w;
	}
	const belts = (n, lvl) => Array.from({ length: n }, () => ({ name: 'dexbelt', level: lvl }));

	/* --- it never travels, the bankExchangeables contract ------------------ */
	let w = bw({ pack0: belts(3, 0) });
	w.character.map = 'main';
	t.eq('off the bank map it does nothing', await (w).retrieveCompoundTriples(), 0);
	w = bw({ pack0: belts(3, 0), bank: null });
	t.eq('arrived but not open yet: nothing, not an error', await (w).retrieveCompoundTriples(), 0);

	/* --- complete triples only -------------------------------------------- */
	pulled.length = 0;
	t.eq('two of a kind cannot compound, so they stay put',
		await (bw({ pack0: belts(2, 0) })).retrieveCompoundTriples(), 0);
	pulled.length = 0;
	t.eq('three come out', await (bw({ pack0: belts(3, 0) })).retrieveCompoundTriples(), 3);
	pulled.length = 0;
	t.eq('four yield one triple, not four', await (bw({ pack0: belts(4, 0) })).retrieveCompoundTriples(), 3);
	pulled.length = 0;
	t.eq('seven yield two triples', await (bw({ pack0: belts(7, 0) })).retrieveCompoundTriples(), 6);

	/* --- THE COMPOUNDER'S OWN ELIGIBILITY, not a copy ---------------------- */
	/* Retrieving something findBaseDuplicateGroup() then refuses is WORSE than
	   retrieving nothing: three inventory slots spent and the bank as full as
	   before. So the cap and the compoundable test are the real functions. */
	pulled.length = 0;
	t.eq('precondition: a dexbelt@2 would overshoot its cap',
		bw({}).compoundWouldOvershootCap('dexbelt', 2), true);
	t.eq('so @2 is left in the bank', await (bw({ pack0: belts(3, 2) })).retrieveCompoundTriples(), 0);
	t.eq('and @1 is not - 1->2 is exactly what the recipe wants',
		await (bw({ pack0: belts(3, 1) })).retrieveCompoundTriples(), 3);
	pulled.length = 0;
	t.eq('precondition: coat is not compoundable', bw({}).isCompoundableItem('coat'), false);
	t.eq('so three coats are left alone',
		await (bw({ pack0: [{ name: 'coat', level: 0 }, { name: 'coat', level: 0 }, { name: 'coat', level: 0 }] })).retrieveCompoundTriples(), 0);
	pulled.length = 0;
	t.eq('and a level above 1 is out of range entirely',
		await (bw({ pack0: belts(3, 3) })).retrieveCompoundTriples(), 0);

	/* --- level 1 before level 0 ------------------------------------------- */
	/* Both free the same two slots; only the 1->2 finishes something. */
	pulled.length = 0;
	/* esize 5 leaves a budget of 3 after the reserve, so exactly one triple
	   fits out of the two available - which is what makes the ORDER visible.
	   The first draft used esize 8, i.e. a budget of 6, and took both groups:
	   a test that cannot distinguish the two orderings. */
	const mixed = bw({ pack0: belts(3, 0).concat(belts(3, 1)), esize: 5 });
	t.eq('with room for one triple only, six available', await (mixed).retrieveCompoundTriples(), 3);
	t.eq('the ones taken are the level 1s',
		mixed.character.bank.items0.filter((_, i) => pulled.includes('items0:' + i))
			.every((x) => x.level === 1), true);

	/* --- headroom for the scrolls the compounder buys ---------------------- */
	t.ok('the reserve is positive', bw({}).COMPOUND_RETRIEVE_HEADROOM > 0);
	pulled.length = 0;
	t.eq('exactly 3 free is not enough - the buy would have nowhere to go',
		await (bw({ pack0: belts(3, 0), esize: 3 })).retrieveCompoundTriples(), 0);
	pulled.length = 0;
	t.eq('3 plus the reserve is',
		await (bw({ pack0: belts(3, 0), esize: 3 + bw({}).COMPOUND_RETRIEVE_HEADROOM })).retrieveCompoundTriples(), 3);

	/* --- arbitrage keeps its own exits ------------------------------------ */
	pulled.length = 0;
	t.eq('a name arbitrage holds is not taken',
		await (bw({ pack0: belts(3, 0), held: { dexbelt: 1 } })).retrieveCompoundTriples(), 0);

	/* --- a full bag ends the sweep rather than looping -------------------- */
	pulled.length = 0;
	t.eq('a failure is survived and reported, not thrown',
		await (bw({ pack0: belts(3, 0), failWith: 'inventory_full' })).retrieveCompoundTriples(), 0);

	/* --- NOTHING NAMES dexbelt, so the next craft input is covered -------- */
	const src = text();
	const body = src.slice(src.indexOf('async function retrieveCompoundTriples'),
		src.indexOf('/* The arrival wrapper.'));
	t.eq('the sweep names no item at all', /dexbelt|intbelt|windbelt/.test(body), false);
	t.ok('it asks craftInputCaps through the compounder’s own predicate',
		/compoundWouldOvershootCap\(/.test(body) && /isCompoundableItem\(/.test(body));
	pulled.length = 0;
	t.eq('so an uncapped compoundable is picked up with no edit',
		await (bw({ pack0: [{ name: 'intbelt', level: 1 }, { name: 'intbelt', level: 1 },
			{ name: 'intbelt', level: 1 }] })).retrieveCompoundTriples(), 3);

	/* --- it rides a trip, hooked after the deposit sweep ------------------ */
	t.ok('travelToBank calls it', /try \{ await retrieveCompoundTriples\(\); \}/.test(src));
	t.ok('and catches it, because travelToBank is awaited in boolean position',
		/retrieveCompoundTriples\(\); \}\s*\n\s*catch \(e\)/.test(src));
	const wrap = src.slice(src.indexOf('async function travelToBank()'));
	t.ok('after bankExchangeables, so it gets the larger budget',
		wrap.indexOf('bankExchangeables()') < wrap.indexOf('retrieveCompoundTriples()'));
	t.eq('and it never travels - the map check is the first thing it does',
		/async function retrieveCompoundTriples\(\) \{\n\tif \(character\.map !== CONFIG\.bank\.map\) return 0;/.test(src), true);
}

}];
