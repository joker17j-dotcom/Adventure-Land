/* Tests/suite_merchantbuy.js - the Ponty buy cap, and specifically that an
   item which does not stack is not capped at all.

   WHY THIS SUITE EXISTS. Operator's ruling 2026-10-21: "The previous buy cap
   was predicated on items that stack and only buying up to a single full
   stack. For items that do not stack there is not supposed to be a buy cap
   from ponty." pontyStackCap() returned `it.s || 1`, so an unstackable id
   capped at one copy - and a SECOND defect rode along that nobody had filed:
   `s` is a truthiness flag carrying an optional size, so `s: true` returned
   the BOOLEAN, and the call site's `have >= stackCap` coerces true to 1. 19 of
   the 58 pontyBuy ids were therefore capped at ONE COPY - leather, funtoken,
   monstertoken, both boxes, the six cake slices, the scrolls, the essences.

   THE COMMENT ABOVE THE FUNCTION WAS RIGHT THE WHOLE TIME. It read "23 stack
   at 9,999", which is exactly what can_stack() does with `s: true`
   (`G.items[n].s===true && 9999 || G.items[n].s`). A correct claim sat on top
   of code that did something else, and re-verifying the claim would have
   confirmed the claim. That is CLAUDE.md's "a correct comment that nobody
   acted on is invisible to every check" with the numbers attached.

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
	t.eq('s: true caps at a full stack, not one copy', w.pontyStackCap('leather'), 9999);
	t.eq('an explicit size is used as given', w.pontyStackCap('dkey'), 50);
	t.eq('an explicit 9999 is used as given', w.pontyStackCap('ashleaf'), 9999);

	/* THE DEFECT, PRESERVED. Both halves of the old expression, so a reader
	   cannot conclude the boolean branch is redundant and collapse it. */
	const old = (it) => it.s || 1;
	t.eq('the old expression returned the BOOLEAN for s: true', old({ s: true }), true);
	t.ok('and the call site coerces it to a cap of one', (1 >= true) === true && (0 >= true) === false);
	t.eq('the old expression capped an unstackable id at one', old({}), 1);
} },

{ name: 'pontyStackCap: the order of the tests is load-bearing', fn(t) {
	/* Number(true) is 1, so a numeric-first rewrite reinstates the exact bug
	   this function was fixed for. Pinned as arithmetic rather than as advice. */
	t.eq('Number(true) is 1', Number(true), 1);
	t.ok('so a Number()-first branch would cap s: true at one copy',
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

{ name: 'the config comment no longer promises a single-copy cap', fn(t) {
	/* The comment on capAtOneStack said "one copy for anything that does not
	   stack" - a correct description of the old code and a direct contradiction
	   of the operator's ruling. A comment is a claim. */
	const s = text();
	t.eq('the superseded wording is gone', s.indexOf('one copy for anything that does not stack'), -1);
	t.ok('and the ruling is recorded where the flag is configured',
		s.indexOf('NEVER on an id that does not stack') > 0);
} }];
