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

{ name: 'the config comment no longer promises a single-copy cap', fn(t) {
	/* The comment on capAtOneStack said "one copy for anything that does not
	   stack" - a correct description of the old code and a direct contradiction
	   of the operator's ruling. A comment is a claim. */
	const s = text();
	t.eq('the superseded wording is gone', s.indexOf('one copy for anything that does not stack'), -1);
	t.ok('and the ruling is recorded where the flag is configured',
		s.indexOf('NEVER on an id that does not stack') > 0);
} }];
