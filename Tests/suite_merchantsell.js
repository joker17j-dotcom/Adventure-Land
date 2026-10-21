/* Tests/suite_merchantsell.js - the merchant's sell guards, and specifically
   that the scarcity protections do not rest on a mechanism that can be
   withdrawn by an unrelated edit.

   WHY THIS SUITE EXISTS. dexbelt was measured UNPROTECTED in both of the
   merchant's sell paths on 2026-10-21 - every guard they apply returned false
   for it - and the reason is instructive rather than careless: it HAD been
   covered by isTier2OrTier3GearItem() until windbelt took the ranger belt slot
   on 2026-10-10, at which point a GEAR_PROGRESSION edit silently repealed a
   sell protection nobody had filed as one. Nothing failed, nothing logged.

   So the assertions below are mostly PRECONDITION + OUTCOME pairs: each names
   the guard that does NOT cover the item, then asserts it is protected anyway.
   Keeping the inverted half visible is what stops a future reader concluding
   the explicit entry is redundant and deleting it.
   -> CLAUDE.md "Selling, banking and what must never be vendored" */
const { lift, world, extract } = require('./lift');

const NAMES = ['PARTY_CLASSES', 'GEAR_PROGRESSION', 'isTier2OrTier3GearItem',
	'PROTECTED_ITEM_NAMES', 'TOGGLES', 'CONFIG', 'pontyWanted'];
const merchant = () => {
	const w = world({});
	lift(w, 'Party/Merchant.js', NAMES);
	return w;
};

module.exports = [{

name: 'the scarce belts are protected by NAME, not by any withdrawable mechanism', fn(t) {
	const w = merchant();

	for (const belt of ['dexbelt', 'intbelt']) {
		t.ok(belt + ' is in PROTECTED_ITEM_NAMES', w.PROTECTED_ITEM_NAMES.has(belt));
	}

	/* PRECONDITION for dexbelt: the mechanism that used to cover it. If this
	   ever reads true again - a GEAR_PROGRESSION edit naming dexbelt - the
	   explicit entry becomes belt-and-braces rather than the only guard, and
	   this assertion is how a reader finds that out instead of assuming it. */
	t.eq('precondition: isTier2OrTier3GearItem(dexbelt) is FALSE, so the name is the only guard',
		w.isTier2OrTier3GearItem('dexbelt'), false);

	/* PRECONDITION: the protection must not be keyed on the buy list, because
	   that list doubles as a sell guard and a buy preference is editable for
	   entirely unrelated reasons. */
	t.eq('precondition: dexbelt is NOT on the Ponty buy list', w.pontyWanted().has('dexbelt'), false);
	t.eq('precondition: intbelt is NOT on the Ponty buy list', w.pontyWanted().has('intbelt'), false);

	/* intbelt's own mechanism DOES currently cover it - asserted so the pairing
	   with dexbelt is explicit: one belt lost its implicit cover, the other has
	   not yet, and both are now named regardless. */
	t.eq('intbelt IS still covered by the tier-2/3 check as well',
		w.isTier2OrTier3GearItem('intbelt'), true);

	/* The reason dexbelt is scarce enough to matter: it is a craft input whose
	   level is already guarded, which is what made the sell path's silence
	   expensive. */
	t.ok('craftInputCaps still names dexbelt', (w.CONFIG.craftInputCaps || {}).dexbelt === 2);
},

}, {

name: 'both sell paths consult the protected set, and sellTrash notably does not', fn(t) {
	/* Asserted on the extracted bodies rather than a line window, so the long
	   comment block inside the set - which names every function below - cannot
	   satisfy or fail these. */
	for (const fn of ['sellAggressivelyIfLowOnSpace', 'ssVendorBound']) {
		t.ok(fn + ' consults PROTECTED_ITEM_NAMES',
			extract('Party/Merchant.js', fn).indexOf('PROTECTED_ITEM_NAMES') > 0);
	}

	/* THE ASYMMETRY IS PINNED DELIBERATELY. sellTrash() is whitelist-driven and
	   consults nothing here, so the belts are beyond its reach only while
	   CONFIG.selling.whitelist does not name them. Asserting the absence stops
	   a reader assuming the protected set covers all three paths; if sellTrash
	   is ever given this guard, this assertion fails and says why. */
	t.eq('sellTrash does NOT consult PROTECTED_ITEM_NAMES - it is whitelist-gated',
		extract('Party/Merchant.js', 'sellTrash').indexOf('PROTECTED_ITEM_NAMES'), -1);

	const w = merchant();
	for (const belt of ['dexbelt', 'intbelt']) {
		t.eq('and ' + belt + ' is not on the selling whitelist, which is what keeps it out of that path',
			(w.CONFIG.selling.whitelist || []).includes(belt), false);
	}
} }];
