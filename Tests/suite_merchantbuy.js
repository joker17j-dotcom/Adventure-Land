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
			CONFIG: { bank: { map: 'bank' }, craftInputCaps: { dexbelt: 2 },
				craftInputCeilings: { dexbelt: { level: 2, stopBuyAt: 21, fullAt: 28 } } },
			ceilBank: { at: 0, counts: null, loading: null, said: {}, sellPauseUntil: 0 },
			CEILING_BANK_TTL_MS: 600000, CEILING_BANK_MAX_AGE_MS: 1800000,
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
			bannerEmit: (n, v, emit) => emit(),   // the file-on-change gate; tested in suite_gamelog
			arbHeldNames: () => over.held || {},
			PARTY_CLASSES: over.plan ? ['priest'] : [],
			GEAR_PROGRESSION: over.plan || {},
		});
		lift(w, MERCHANT, ['COMPOUND_RETRIEVE_HEADROOM', 'craftInputCap', 'isKnownGearItem',
			'compoundWouldOvershootCap', 'isCompoundableItem', 'retrieveCompoundTriples',
			'ceilingCfg', 'ceilingLog', 'ceilingNoteBank', 'ceilingCount', 'ceilingState']);
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

	/* --- a gear-plan item stays in the bank (v129) ----------------------- */
	const plan = { priest: [null, { belt: { item: 'intbelt', level: 4, method: 'compound' } }, null] };
	const ints = [{ name: 'intbelt', level: 0 }, { name: 'intbelt', level: 0 }, { name: 'intbelt', level: 0 }];
	pulled.length = 0;
	t.eq('PRECONDITION: with no plan the same triple is pulled',
		await (bw({ pack0: ints.slice() })).retrieveCompoundTriples(), 3);
	pulled.length = 0;
	t.eq('in the plan, the triple is left in the bank',
		await (bw({ pack0: ints.slice(), plan: plan })).retrieveCompoundTriples(), 0);
	t.eq('and nothing was retrieved', pulled.length, 0);
	t.eq('a material beside it is still pulled',
		await (bw({ pack0: ints.slice().concat(belts(3, 0)), plan: plan })).retrieveCompoundTriples(), 3);
	t.ok('the sweep asks isKnownGearItem', /if \(isKnownGearItem\(it\.name\)\) continue;/.test(body));

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

/* THE dexbelt+2 CEILING - operator's ruling 2026-10-23, built in Merchant v123.
   Counted in bank slots of dexbelt+2 against one 42-slot pack, bank plus bag:
   at 21 the Ponty buy stops; at 28 compounding stops and a +0 that reaches the
   bag is sold. */
function ceilWorld(over) {
	over = over || {};
	const calls = { sold: [], traded: [], bought: [], logs: [] };
	const w = world({
		character: {
			name: 'Meltymerch', map: over.map || 'main', x: 0, y: 0, real_x: 0, real_y: 0,
			gold: 1e9, items: over.items || [], bank: over.charBank || null,
		},
		CONFIG: {
			bank: { map: 'bank' }, craftInputCaps: { dexbelt: 2 },
			craftInputCeilings: { dexbelt: { level: 2, stopBuyAt: 21, fullAt: 28 } },
			arbitrage: { approachUnits: 350 },
			pontyBuy: { enabled: true, capAtOneStack: false, maxPrice: {}, maxLevel: { dexbelt: 2 } },
		},
		ceilBank: { at: 0, counts: null, loading: null, said: {}, sellPauseUntil: 0 },
		CEILING_BANK_TTL_MS: 600000, CEILING_BANK_MAX_AGE_MS: 1800000,
		G: { items: { dexbelt: { compound: true }, ringsj: { compound: true } } },
		parent: {
			G: { items: {} }, entities: over.ents || {},
			calculate_item_value: () => 30000,
		},
		game_log: (m) => calls.logs.push(m),
		bannerEmit: (n, v, emit) => emit(),   // the file-on-change gate; tested in suite_gamelog
		bannerChanged: () => true,
		api_call: over.api_call || (async () => ({ packs: over.bankPacks || { items0: [] } })),
		atTownSpot: () => over.atTown !== false,
		sell: async (i) => { if (over.sellFails) throw new Error('too_far'); calls.sold.push(i); },
		trade_sell: async (e, slot, q) => { calls.traded.push(e.name + ':' + slot + ':' + q); },
		arbTaxRate: () => 0.05,
		pontyWanted: () => new Set(['dexbelt', 'leather']),
		pontyLog: () => {}, pontyFmt: (n) => String(n), pontyFreeSlots: () => 20,
		pontyBankQty: async () => null, pontyStackCap: () => null,
		pontyBuyGate: () => ({ ok: true }), pontyRemember: () => {}, mShardKey: () => 'EUI',
		pontyBuyOne: async (r) => { calls.bought.push(r.name + '+' + r.level); return { ok: true, spent: 1 }; },
		PARTY_CLASSES: over.plan ? ['priest'] : [], GEAR_PROGRESSION: over.plan || {},
		calls,
	});
	lift(w, MERCHANT, ['ceilingCfg', 'ceilingLog', 'ceilingNoteBank', 'ceilingRefresh',
		'ceilingCount', 'ceilingState', 'ceilingSellPass', 'ceilingBuyer', 'arbNetFromSale',
		'pDist', 'pWhere', 'craftInputCap', 'compoundWouldOvershootCap', 'isCompoundableItem', 'isKnownGearItem',
		'findBaseDuplicateGroup', 'pontyBuyPass']);
	return w;
}
const belt = (lvl, extra) => Object.assign({ name: 'dexbelt', level: lvl }, extra || {});
const plus2 = (n) => Array.from({ length: n }, () => belt(2));

module.exports.push(
{ name: 'ceiling: the count is the bank plus the bag, at the ceiling level only', async fn(t) {
	const s = text();
	t.ok('module state: ceilBank starts unread', /^let ceilBank = \{ at: 0, counts: null,/m.test(s));
	t.ok('TTL is 10 minutes', /^const CEILING_BANK_TTL_MS = 10 \* 60 \* 1000;/m.test(s));
	t.ok('a reading older than 30 minutes is unknown', /^const CEILING_BANK_MAX_AGE_MS = 30 \* 60 \* 1000;/m.test(s));
	t.ok('the shipped thresholds are the ruling: +2, 21 and 28',
		/dexbelt: \{ level: 2, stopBuyAt: 21, fullAt: 28 \}/.test(s));

	let w = ceilWorld({ items: [belt(2), belt(0), belt(2, { q: undefined })] });
	t.eq('before any bank read the count is unknown', w.ceilingCount('dexbelt'), null);
	const st0 = w.ceilingState('dexbelt');
	t.eq('and an unknown count stops nothing', st0.stopBuy || st0.full, false);
	w.ceilingNoteBank({ gold: 5, items0: [belt(2), belt(2), belt(0), belt(1), { name: 'leather', q: 50 }],
		items1: [belt(2), null] });
	t.eq('bank +2s (3) plus bag +2s (2)', w.ceilingCount('dexbelt'), 5);
	t.eq('an unconfigured item has no count', w.ceilingCount('leather'), null);
	w.ceilBank.at = Date.now() - 31 * 60000;
	t.eq('a stale bank reading makes the count unknown again', w.ceilingCount('dexbelt'), null);

	w = ceilWorld({ bankPacks: { items0: plus2(19) }, items: [belt(2)] });
	await w.ceilingRefresh();
	t.eq('load_bank feeds the count from anywhere', w.ceilingCount('dexbelt'), 20);
	w = ceilWorld({ map: 'bank', charBank: { items0: plus2(4) },
		api_call: async () => { throw new Error('must not be called in the bank'); } });
	await w.ceilingRefresh();
	t.eq('standing in the bank it reads character.bank instead', w.ceilingCount('dexbelt'), 4);
	w = ceilWorld({ api_call: async () => { throw new Error('socket gone'); } });
	await w.ceilingRefresh();
	t.eq('a failed read leaves the count unknown, not zero', w.ceilingCount('dexbelt'), null);
	t.ok('and says so', w.calls.logs.some((m) => /load_bank failed/.test(m)));
} },

{ name: 'ceiling: 21 stops the buy, 28 is full', fn(t) {
	const at = (n) => { const w = ceilWorld(); w.ceilingNoteBank({ items0: plus2(n) }); return w.ceilingState('dexbelt'); };
	t.eq('20: under', JSON.stringify(at(20)), JSON.stringify({ count: 20, stopBuy: false, full: false }));
	t.eq('21: buying stops', JSON.stringify(at(21)), JSON.stringify({ count: 21, stopBuy: true, full: false }));
	t.eq('27: still only the buy', at(27).full, false);
	t.eq('28: full', JSON.stringify(at(28)), JSON.stringify({ count: 28, stopBuy: true, full: true }));
	const w = ceilWorld(); w.ceilingNoteBank({ items0: plus2(28) });
	w.ceilingState('dexbelt'); w.ceilingState('dexbelt');
	t.eq('the flip is logged once, not every tick', w.calls.logs.filter((m) => /FULL/.test(m)).length, 1);
} },

{ name: 'ceiling: the Ponty buy skips dexbelt from 21, and only dexbelt', async fn(t) {
	const rows = [{ rid: 'a', name: 'dexbelt', level: 0, price: 60000 }, { rid: 'b', name: 'leather', level: 0, price: 10 }];
	let w = ceilWorld({ bankPacks: { items0: plus2(20) } });
	await w.pontyBuyPass(rows);
	t.eq('under the ceiling dexbelt is bought', w.calls.bought.join(','), 'leather+0,dexbelt+0');
	w = ceilWorld({ bankPacks: { items0: plus2(21) } });
	await w.pontyBuyPass(rows);
	t.eq('at 21 the dexbelt row is skipped and the rest still buy', w.calls.bought.join(','), 'leather+0');
	w = ceilWorld({ api_call: async () => { throw new Error('down'); } });
	await w.pontyBuyPass(rows);
	t.eq('an unknown count does not stop the buy', w.calls.bought.indexOf('dexbelt+0') >= 0, true);
} },

{ name: 'v135 the ceiling skip line reaches the file once per id and level, until the ceiling is seen open', async fn(t) {
	const rows = [{ rid: 'a', name: 'dexbelt', level: 0, price: 60000 }, { rid: 'c', name: 'dexbelt', level: 1, price: 90000 }];
	const store = {}, kept = [];
	let quiet = false;
	const w = ceilWorld({ bankPacks: { items0: plus2(21) } });
	Object.assign(w, {
		get: (k) => (k in store ? JSON.parse(store[k]) : null), set: (k, v) => { store[k] = JSON.stringify(v); },
		BANNER_KEY: 'merch_banner', bannerSeen: null,
		gamelogQuietly: (fn) => { quiet = true; try { return fn(); } finally { quiet = false; } },
		pontyLog: (m) => { if (!quiet) kept.push(m); },
	});
	lift(w, MERCHANT, ['bannerChanged', 'bannerEmit']);
	await w.pontyBuyPass(rows);
	await w.pontyBuyPass(rows);
	t.eq('two passes at 21: each level kept once', kept.filter((m) => /craft-input ceiling/.test(m)),
		['skipping dexbelt+0 - its craft-input ceiling is reached', 'skipping dexbelt+1 - its craft-input ceiling is reached']);
	w.bannerSeen = null;
	await w.pontyBuyPass(rows);
	t.eq('and a hop does not forget it', kept.filter((m) => /craft-input ceiling/.test(m)).length, 2);
	w.ceilingNoteBank({ items0: plus2(20) });
	await w.pontyBuyPass(rows);
	w.ceilingNoteBank({ items0: plus2(21) });
	await w.pontyBuyPass(rows);
	t.eq('seen open, then reached again: kept again', kept.filter((m) => /craft-input ceiling/.test(m)).length, 4);
} },

{ name: 'ceiling: at 28 dexbelts stop being compounded or retrieved for it', fn(t) {
	const three = [belt(0), belt(0), belt(0), { name: 'ringsj', level: 0 }, { name: 'ringsj', level: 0 }, { name: 'ringsj', level: 0 }];
	let w = ceilWorld({ items: three.slice() });
	w.ceilingNoteBank({ items0: plus2(27) });
	const g = w.findBaseDuplicateGroup();
	t.eq('under full the dexbelt triple is still the group', g && g.name, 'dexbelt');
	w = ceilWorld({ items: three.slice() });
	w.ceilingNoteBank({ items0: plus2(28) });
	const g2 = w.findBaseDuplicateGroup();
	t.eq('at full the dexbelts are left alone and the next item is taken', g2 && g2.name, 'ringsj');
	const s = text();
	t.ok('retrieveCompoundTriples counts from character.bank before planning',
		/ceilingNoteBank\(character\.bank\);[\s\S]{0,200}const groups = new Map\(\);/.test(s));
	t.ok('and skips a full item', /if \(ceilingState\(it\.name\)\.full\) continue;/.test(s));
} },

{ name: 'a gear-plan item is never auto-combined; a material still is (v129)', fn(t) {
	/* Operator's ruling 2026-10-24: plan items go through attemptBestPlanStep()
	   only, which counts what the copies are worth and hands over when an
	   offering is due. The auto-combine prices scroll against chance alone, so
	   it rolled a plan item's +0/+1 triples bare - sbelt at 90% then 70%. */
	const plan = { priest: [null, { belt: { item: 'ringsj', level: 2, method: 'compound' } }, null] };
	const rings = (lvl) => [0, 1, 2].map(() => ({ name: 'ringsj', level: lvl }));
	let w = ceilWorld({ items: rings(0) });
	const g0 = w.findBaseDuplicateGroup();
	t.eq('PRECONDITION: with no plan the triple is a group', g0 && g0.name, 'ringsj');
	w = ceilWorld({ items: rings(0), plan: plan });
	t.eq('in the plan at +0 it is not', w.findBaseDuplicateGroup(), null);
	w = ceilWorld({ items: rings(1), plan: plan });
	t.eq('nor at +1', w.findBaseDuplicateGroup(), null);
	w = ceilWorld({ items: rings(1).concat([belt(0), belt(0), belt(0)]), plan: plan });
	const g = w.findBaseDuplicateGroup();
	t.eq('the material beside it is still taken', g && g.name + '@' + g.level, 'dexbelt@0');
	const met = { priest: [null, { belt: { item: 'ringsj', level: 1, method: 'compound' } }, null] };
	w = ceilWorld({ items: rings(1), plan: met });
	t.eq('a plan item past its goal is still the plan’s, not the auto-combine’s',
		w.findBaseDuplicateGroup(), null);
	const s = text();
	const body = s.slice(s.indexOf('function findBaseDuplicateGroup'), s.indexOf('async function autoCombineOneBaseDuplicateGroup'));
	t.ok('it asks isKnownGearItem', /if \(isKnownGearItem\(item\.name\)\) return;/.test(body));
	t.ok('the plan path still finds its own compound groups',
		/group = findCompoundGroup\(character\.items, c\.item\.name, level\);/.test(s));
} },

{ name: 'ceiling: at 28 a +0 is sold - to a buying stand above the NPC, else the NPC', async fn(t) {
	const bag = () => [belt(1), belt(0, { l: 'l' }), belt(0), belt(2)];
	const stand = (price, x) => ({ Buyer: { type: 'character', name: 'Buyer', stand: true, map: 'main',
		x: x || 100, y: 0, real_x: x || 100, real_y: 0,
		slots: { trade3: { b: true, name: 'dexbelt', level: 0, price: price, q: 5 } } } });
	let w = ceilWorld({ items: bag() });
	w.ceilingNoteBank({ items0: plus2(26) });
	t.eq('PRECONDITION: the bag +2 counts, so 26 banked is 27', w.ceilingCount('dexbelt'), 27);
	await w.ceilingSellPass();
	t.eq('under full nothing is sold', w.calls.sold.length + w.calls.traded.length, 0);

	w = ceilWorld({ items: bag() });
	await w.ceilingSellPass();
	t.eq('an unknown count sells nothing', w.calls.sold.length + w.calls.traded.length, 0);

	w = ceilWorld({ items: bag() });
	w.ceilingNoteBank({ items0: plus2(28) });
	await w.ceilingSellPass();
	t.eq('full, no buyer, at town: the NPC gets the unlocked +0 and nothing else', w.calls.sold.join(','), '2');
	t.eq('one per pass', w.calls.sold.length, 1);

	w = ceilWorld({ items: bag(), atTown: false });
	w.ceilingNoteBank({ items0: plus2(28) });
	await w.ceilingSellPass();
	t.eq('away from the town spot the NPC sale waits', w.calls.sold.length, 0);

	w = ceilWorld({ items: bag(), ents: stand(50000) });
	w.ceilingNoteBank({ items0: plus2(28) });
	await w.ceilingSellPass();
	t.eq('a stand buying above the NPC in reach gets it', w.calls.traded.join(','), 'Buyer:trade3:1');
	t.eq('and the NPC does not', w.calls.sold.length, 0);

	w = ceilWorld({ items: bag(), ents: stand(30000) });
	w.ceilingNoteBank({ items0: plus2(28) });
	await w.ceilingSellPass();
	t.eq('a stand that nets less than the NPC after tax loses to the NPC', w.calls.sold.join(','), '2');

	w = ceilWorld({ items: bag(), ents: stand(50000, 900) });
	w.ceilingNoteBank({ items0: plus2(28) });
	await w.ceilingSellPass();
	t.eq('a stand out of reach is not walked to', w.calls.traded.length, 0);

	const failing = { items: bag(), sellFails: true };
	w = ceilWorld(failing);
	w.ceilingNoteBank({ items0: plus2(28) });
	await w.ceilingSellPass();
	t.ok('a refused sale backs off', w.ceilBank.sellPauseUntil > Date.now());
	failing.sellFails = false;   // the NPC would take it now - only the back-off can stop it
	await w.ceilingSellPass();
	t.eq('and the next tick does not retry', w.calls.sold.length, 0);
	w.ceilBank.sellPauseUntil = 0;
	await w.ceilingSellPass();
	t.eq('once the minute is up it sells', w.calls.sold.join(','), '2');

	const s = text();
	t.ok('the never-sell set still names dexbelt - the exception is carved, not widened',
		/const PROTECTED_ITEM_NAMES = new Set\(\[[\s\S]*?'dexbelt', 'intbelt',/.test(s));
} },
);

/* THE PAGE-LOAD BANNER AND THE GEAR-PLAN OVERRIDES - operator's rulings
   2026-10-25 (Merchant v134). */
function bannerWorld(store) {
	const logs = [];
	const gl = { quiet: false };
	const w = world({
		get: (k) => (k in store ? JSON.parse(store[k]) : null),
		set: (k, v) => { store[k] = JSON.stringify(v); },
		game_log: (m) => logs.push([m, gl.quiet]),
		parent: { __gamelog: gl },
		BANNER_KEY: 'merch_banner', GV_OVERRIDE_SAID_KEY: 'gv_override_said',
	});
	w.bannerSeen = null;
	w.gvOverrideSaid = null;
	w.logs = logs;
	lift(w, MERCHANT, ['gamelogQuietly', 'bannerChanged', 'bannerEmit', 'gvOverrideNote']);
	return w;
}
module.exports.push(
{ name: 'banner lines reach the file only when their state changed, across hops; the screen always', fn(t) {
	const s = text();
	for (const k of ["const BANNER_KEY = 'merch_banner';", "const GV_OVERRIDE_SAID_KEY = 'gv_override_said';",
		'let bannerSeen = null;', 'let gvOverrideSaid = null;']) t.ok('the world supplies what the source declares: ' + k, s.indexOf('\n' + k + '\n') >= 0);
	const store = {};
	let w = bannerWorld(store);
	w.bannerEmit('link', 'up', () => w.game_log('[link] bridge up'));
	w.bannerEmit('link', 'up', () => w.game_log('[link] bridge up'));
	w.bannerEmit('link', 'down', () => w.game_log('[link] bridge unreachable'));
	t.eq('first to the file, repeat to the screen only, the change to the file',
		w.logs.map((l) => l[1]), [false, true, false]);
	t.eq('and the flag is cleared after', w.parent.__gamelog.quiet, false);
	w = bannerWorld(store);                      // the next page: fresh memory, same CODE storage
	w.bannerEmit('link', 'down', () => w.game_log('[link] bridge unreachable'));
	w.bannerEmit('scout', 'up', () => w.game_log('[scout] bridge up'));
	t.eq('a hop does not forget the state; another name has its own', w.logs.map((l) => l[1]), [true, false]);

	/* Every banner site goes through it, and the hop-sickness rule is
	   registered after the GAMELOG block has run. */
	t.ok('[link] up', /bannerEmit\('link', 'up', \(\) => plLog\('bridge up/.test(s));
	t.ok('[link] down', /bannerEmit\('link', 'down', \(\) => plLog\(typeof fetch/.test(s));
	t.ok('[scout] up and lost', /bannerEmit\('scout', 'up'/.test(s) && /bannerEmit\('scout', 'down'/.test(s));
	t.ok('[ceiling] by its state, not its count', /bannerEmit\('ceiling:' \+ name, key, \(\) => ceilingLog/.test(s));
	t.ok('[probe] merge by the answering sources', /bannerEmit\('merge', shape,/.test(s));
	t.ok('the gear plan header and its items as one', /bannerEmit\('gearplan', key, \(\) => \{\n\t\tgame_log\('Gear plan handing/.test(s));
	t.ok('the game\'s Hop Sickness line by a file rule', /gamelogFileOnChange\('hopsick', 'Hop Sickness'\)/.test(s));
	t.ok('registered from a timer, after the block at the end of the file', /\nsetTimeout\(merchantLogRules, 0\);/.test(s)
		&& s.indexOf('setTimeout(merchantLogRules, 0);') < s.indexOf('// === GAMELOG BEGIN ==='));
} },

{ name: 'gear plan: xhelmet, intamulet and intbelt resolve by the operator\'s overrides, logged once ever', fn(t) {
	const s = text();
	const m = /const PONTY_PRICED_ITEMS = new Set\(\[([\s\S]*?)\]\);/.exec(s);
	const ponty = new Set(((m && m[1]) || '').match(/'[^']+'/g).map((x) => x.slice(1, -1)));
	t.ok('intamulet and intbelt are Ponty-priced', ponty.has('intamulet') && ponty.has('intbelt'));
	t.ok('xhelmet is NOT Ponty-priced - it takes the ask', !ponty.has('xhelmet'));
	const store = {};
	const mk = () => {
		const w = bannerWorld(store);
		Object.assign(w, {
			PONTY_PRICED_ITEMS: ponty, VALUE_DIVERGENCE_LIMIT: 3,
			scoutItemPrice: (it) => ({ xhelmet: 3840000, intamulet: 36000, intbelt: 60000, ringsj: 1000 })[it.name],
			gtQuote: (rows, name) => ({ xhelmet: { ask: 40000000, bid: 20000000 }, intamulet: { ask: 475000 },
				intbelt: { ask: 99999999999 }, ringsj: { ask: 900000 } })[name] || null,
		});
		lift(w, MERCHANT, ['GEAR_VALUE_OVERRIDES', 'GEAR_VALUE_FALLBACK', 'gvFallback', 'gvBaseValue']);
		return w;
	};
	let w = mk();
	t.eq('xhelmet: 40,000,000 by override', JSON.stringify(w.gvBaseValue('xhelmet', [])), '{"value":40000000,"src":"override"}');
	t.eq('intamulet: its Ponty price', w.gvBaseValue('intamulet', []).value, 36000);
	t.eq('intbelt: its Ponty price', w.gvBaseValue('intbelt', []).value, 60000);
	t.eq('an item with no override still hands over when its anchors disagree',
		[w.gvBaseValue('ringsj', []).value, /anchors disagree/.test(w.gvBaseValue('ringsj', []).src)], [null, true]);
	t.eq('three override lines, one per item', w.logs.map((l) => l[0]), [
		'[gear] xhelmet is valued by GEAR_VALUE_OVERRIDES at 40000000 - an operator override',
		'[gear] intamulet is valued by the Ponty price at 36000 - an operator override',
		'[gear] intbelt is valued by the Ponty price at 60000 - an operator override']);
	w.gvBaseValue('xhelmet', []); w.gvBaseValue('intamulet', []);
	t.eq('not again on the same page', w.logs.length, 3);
	w = mk();
	w.gvBaseValue('xhelmet', []); w.gvBaseValue('intbelt', []);
	t.eq('nor on the next page', w.logs.length, 0);
	store.gv_override_said = JSON.stringify({ xhelmet: 'the Ponty price' });
	w = mk();
	w.gvBaseValue('xhelmet', []);
	t.eq('a change of route is logged again', w.logs.length, 1);
} },
);
