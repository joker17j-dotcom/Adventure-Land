/* Tests/suite_merchantsell.js - the sell guards on BOTH the merchant and the
   ranger, and specifically that the scarcity protections do not rest on a
   mechanism an unrelated edit can withdraw.

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

   NAME SETS ARE PARSED FROM THE SOURCE TEXT, NOT LIFTED. `const X = new Set([
   ... ])` has no brace after the name, so lift() brace-matches past it into
   whatever follows - measured on PROTECTED_ITEM_NAMES, the extraction ran 112
   lines and swallowed exchangeableNames() whole. It happened to evaluate and
   the assertions happened to hold, which is the "silent first, loud second"
   failure CLAUDE.md warns about: the next declaration added in that span either
   changes the blob or throws "already declared". namesIn() below reads the
   bracketed literal instead, which answers the membership question directly.
   -> CLAUDE.md "Selling, banking and what must never be vendored", "Testing" */
const fs = require('fs');
const path = require('path');
const { lift, world, extract, ROOT } = require('./lift');

const text = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* Quoted names inside the first bracketed literal following a declaration. */
function namesIn(file, decl) {
	const s = text(file);
	const at = s.indexOf(decl);
	if (at < 0) return null;
	const open = s.indexOf('[', at);
	if (open < 0) return null;
	let d = 0, end = -1;
	for (let i = open; i < s.length; i++) {
		if (s[i] === '[') d++;
		else if (s[i] === ']') { d--; if (d === 0) { end = i; break; } }
	}
	if (end < 0) return null;
	return namesFrom(s.slice(open, end + 1));
}

/* THE PARSE HAS TWO INDEPENDENT DEFENCES AND THEY COVER DIFFERENT CASES, which
   is why it is split out and tested directly rather than only through the real
   files.

   An apostrophe in ordinary prose - "operator's rule", "the item's level" -
   pairs with the next one, so a naive /'[^']*'/ swallows every real name
   between them. Measured on the merchant set: 23 "names", most of them prose
   fragments, reporting dexbelt ABSENT while it sat in the literal two lines
   below. Same class as the committed lift matcher ignoring strings and
   comments, hit in the helper written to avoid lifting at all.

   STRIPPING COMMENTS IS THE DEFENCE THAT WORKS. The newline guard in the regex
   is a backstop and is NOT independently load-bearing - measured by mutation:
   widening it back to /'[^']*'/ breaks nothing once comments are gone, because
   nothing outside a comment puts a stray apostrophe in these literals. It stays
   as cheap insurance against a comment the stripper cannot see (an unterminated
   block, say), and this note says so rather than implying two live defences.
   The reverse mutation DOES bite: removing the strip fails three assertions.
   Both claims were established the hard way. Removing the strip was first
   measured as breaking NOTHING, because the newline guard had been added in the
   same edit and was silently covering it - two fixes landing together, each
   looking proven by the other's work. */
function namesFrom(lit) {
	const bare = String(lit)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/\/\/[^\n]*/g, ' ');
	return (bare.match(/'[^'\n]*'|"[^"\n]*"/g) || []).map((q) => q.slice(1, -1));
}

const merchant = () => {
	const w = world({});
	lift(w, 'Party/Merchant.js', ['PARTY_CLASSES', 'GEAR_PROGRESSION',
		'isTier2OrTier3GearItem', 'TOGGLES', 'CONFIG', 'pontyWanted']);
	return w;
};

module.exports = [{

name: 'the scarce belts are protected by NAME, not by any withdrawable mechanism', fn(t) {
	const w = merchant();
	const protectedNames = namesIn('Party/Merchant.js', 'const PROTECTED_ITEM_NAMES');
	t.ok('PROTECTED_ITEM_NAMES parsed', Array.isArray(protectedNames) && protectedNames.length > 5);

	for (const belt of ['dexbelt', 'intbelt']) {
		t.ok(belt + ' is in the merchant PROTECTED_ITEM_NAMES', protectedNames.includes(belt));
	}

	/* PRECONDITION for dexbelt: the mechanism that used to cover it. If this
	   ever reads true again - a GEAR_PROGRESSION edit naming dexbelt - the
	   explicit entry becomes belt-and-braces rather than the only guard, and
	   this assertion is how a reader finds that out instead of assuming it. */
	t.eq('precondition: isTier2OrTier3GearItem(dexbelt) is FALSE, so the name is the only guard',
		w.isTier2OrTier3GearItem('dexbelt'), false);

	/* THE BUY LIST IS NOW A SECOND GUARD ON dexbelt, AND THAT MAKES THE
	   EXPLICIT ENTRY MORE LOAD-BEARING RATHER THAN LESS.
	   This pair asserted dexbelt was ABSENT from the buy list until v112, as the
	   precondition establishing that `PROTECTED_ITEM_NAMES` was its only sell
	   guard. The operator added the buy on 2026-10-21 ("+0, +1, +2 ONLY - they
	   are an ingredient"), so `pontyWanted()` now covers it too.
	   That is exactly the state v109 was written about, arriving from the other
	   direction: dexbelt's protection was once a SIDE EFFECT of
	   GEAR_PROGRESSION's contents and a gear edit silently repealed it. The buy
	   list is the operator's, marked EDIT THIS, and dropping the buy would
	   repeal this one the same silent way - so the explicit name must stay, and
	   a reader who finds two guards must not conclude either is redundant.
	   intbelt is still absent, so for IT the explicit name remains the only
	   guard - the asymmetry is asserted rather than flattened. */
	t.eq('dexbelt IS on the Ponty buy list since v112, so pontyWanted also covers it',
		w.pontyWanted().has('dexbelt'), true);
	t.eq('intbelt is NOT on the buy list, so its explicit name is still the only guard',
		w.pontyWanted().has('intbelt'), false);
	t.ok('so the explicit entry is what survives a buy-list edit', protectedNames.includes('dexbelt'));

	/* intbelt's own mechanism DOES still cover it - asserted so the pairing with
	   dexbelt stays explicit: one belt lost its implicit cover, the other has
	   not yet, and both are named regardless. */
	t.eq('intbelt IS still covered by the tier-2/3 check as well',
		w.isTier2OrTier3GearItem('intbelt'), true);

	t.ok('craftInputCaps still names dexbelt', (w.CONFIG.craftInputCaps || {}).dexbelt === 2);
},

}, {

name: 'merchant: both vendoring paths consult the set, and sellTrash notably does not', fn(t) {
	for (const fn of ['sellAggressivelyIfLowOnSpace', 'ssVendorBound']) {
		t.ok(fn + ' consults PROTECTED_ITEM_NAMES',
			extract('Party/Merchant.js', fn).indexOf('PROTECTED_ITEM_NAMES') > 0);
	}

	/* THE ASYMMETRY IS PINNED DELIBERATELY. sellTrash() is whitelist-driven and
	   consults nothing here, so the belts are beyond its reach only while
	   CONFIG.selling.whitelist does not name them. Asserting the absence stops
	   a reader assuming the protected set covers all three paths. */
	t.eq('sellTrash does NOT consult PROTECTED_ITEM_NAMES - it is whitelist-gated',
		extract('Party/Merchant.js', 'sellTrash').indexOf('PROTECTED_ITEM_NAMES'), -1);

	const w = merchant();
	for (const belt of ['dexbelt', 'intbelt']) {
		t.eq('and ' + belt + ' is off the merchant selling whitelist, which is what keeps it out of that path',
			(w.CONFIG.selling.whitelist || []).includes(belt), false);
	}

}, }, {

name: 'ranger: rules (a) and (b) reach BOTH of its sell paths', fn(t) {
	/* allBosses is `const allBosses = [...]` - an array, so lift() cannot reach
	   it either, and CONFIG reads it. Supplied from the SOURCE TEXT rather than
	   retyped, and pinned below, so the world cannot quietly hold a stale copy
	   while every assertion still passes. */
	const bosses = namesIn('Party/Ranger.js', 'const allBosses');
	t.ok('allBosses parsed from source and non-empty', Array.isArray(bosses) && bosses.length > 5);
	t.ok('...and still contains the event bosses CONFIG is built around',
		['crabxx', 'franky', 'icegolem'].every((b) => bosses.includes(b)));
	const w = world({ allBosses: bosses });
	lift(w, 'Party/Ranger.js', ['TOGGLES', 'CONFIG']);

	/* THE SAME OMISSION-SAFETY APPLIES HERE AND IS LOAD-BEARING ON A LIST THE
	   OPERATOR EDITED YESTERDAY. sellItems() is whitelist-driven with no level
	   check at all, so a belt added to that list would go at any level. */
	const wl = w.CONFIG.selling.whitelist || [];
	for (const belt of ['dexbelt', 'intbelt']) {
		t.eq(belt + ' is absent from the ranger selling whitelist', wl.includes(belt), false);
	}

	const scarce = namesIn('Party/Ranger.js', 'const SCARCE_ITEM_NAMES');
	t.ok('ranger SCARCE_ITEM_NAMES parsed', Array.isArray(scarce));
	for (const belt of ['dexbelt', 'intbelt']) {
		t.ok(belt + ' is in the ranger SCARCE_ITEM_NAMES', scarce.includes(belt));
	}

	for (const fn of ['reliefSellable', 'sellItems']) {
		const body = extract('Party/Ranger.js', fn);
		t.ok(fn + ' consults isExchangeable (rule b)', body.indexOf('isExchangeable(') > 0);
		t.ok(fn + ' consults isScarceItem (rule a)', body.indexOf('isScarceItem(') > 0);
	}

	/* THE ONE NAME WHOSE BEHAVIOUR CHANGED. lostearring is on the ranger
	   whitelist and carries e=1, so rule (b) now outranks the whitelist for it -
	   the same relationship the guard has to gem0/seashell on the merchant.
	   Asserted so the change is a recorded decision rather than a side effect. */
	t.ok('lostearring IS on the ranger whitelist (the name rule (b) now outranks)',
		wl.includes('lostearring'));
	t.ok('and lostearring is in the exchangeable seed, so the guard catches it',
		namesIn('Party/Ranger.js', 'const EXCHANGEABLE_SEED').includes('lostearring'));

}, }, {

name: "the suite's own name parser survives prose in the literal", fn(t) {
	/* Tested on fixtures because the real files exercise only one of the two
	   defences - see namesFrom(). A helper that mis-parses silently is how an
	   assertion passes for the wrong reason, and this suite already hit that
	   once: it reported dexbelt absent from a set that contained it. */
	t.eq('a clean literal parses', namesFrom("['a', 'b']").join(','), 'a,b');

	/* Defence 2: a block comment whose apostrophes span lines. */
	const multi = "[\n/* operator's rule\n   the item's level */\n'dexbelt', 'intbelt',\n]";
	t.eq('a multi-line comment with apostrophes does not swallow the names',
		namesFrom(multi).join(','), 'dexbelt,intbelt');

	/* Defence 1: TWO apostrophes on ONE line, which the newline guard cannot
	   see. This is the case no real file currently contains. */
	const oneLine = "[\n/* the operator's own rule, the item's level */\n'dexbelt', 'intbelt',\n]";
	t.eq('two apostrophes on one comment line do not swallow the names either',
		namesFrom(oneLine).join(','), 'dexbelt,intbelt');

	const lineComment = "[\n// operator's call, the item's level\n'dexbelt',\n]";
	t.eq('a // comment with apostrophes is stripped too',
		namesFrom(lineComment).join(','), 'dexbelt');

	/* THE INVERTED ASSERTION, AND IT TOOK TWO GOES - WHICH IS THE FINDING.
	   An unguarded parse breaks only on an ODD number of prose apostrophes: with
	   two, the pairs close inside the comment and the real names survive BY LUCK.
	   The first version of this assertion used the two-apostrophe fixture above
	   and failed against a correctly-broken parser. So whether a naive parse
	   corrupts a literal depends on the PARITY of apostrophes in whatever prose
	   precedes it, which is why the fault is intermittent and why it reached the
	   merchant set - and it means a passing naive parse is evidence of nothing. */
	const naiveOf = (lit) => (lit.match(/'[^']*'/g) || []).map((q) => q.slice(1, -1));
	const odd = "[\n/* the operator's rule */\n'dexbelt', 'intbelt',\n]";
	t.eq('an ODD apostrophe count breaks an unguarded parse', naiveOf(odd).includes('dexbelt'), false);
	t.eq('an EVEN count leaves it intact, which is luck and not safety',
		naiveOf(oneLine).includes('dexbelt'), true);
	t.eq('the guarded parse is correct in BOTH cases',
		namesFrom(odd).join(',') + '|' + namesFrom(oneLine).join(','),
		'dexbelt,intbelt|dexbelt,intbelt');

}, }, {

name: 'the exchangeable seed does not drift between the two scripts', fn(t) {
	/* Deliberate duplication: these are separate CODE slots with no shared
	   module, so the remedy for a copied predicate is an assertion that the
	   copies stay equal - not a promise that nobody will touch one. */
	const mSeed = namesIn('Party/Merchant.js', 'const EXCHANGEABLE_SEED');
	const rSeed = namesIn('Party/Ranger.js', 'const EXCHANGEABLE_SEED');
	t.ok('both seeds parsed', Array.isArray(mSeed) && Array.isArray(rSeed));
	t.eq('the two seeds are the same length', rSeed.length, mSeed.length);
	t.eq('the two seeds are identical', rSeed.join(','), mSeed.join(','));

	/* And both must DERIVE as well as seed, or a game update that adds an
	   exchangeable is covered on one character and not the other. */
	for (const f of ['Party/Merchant.js', 'Party/Ranger.js']) {
		const body = extract(f, 'exchangeableNames');
		t.ok(f + ' derives from G.items .e as well as seeding', body.indexOf('it.e !== undefined') > 0);
		t.ok(f + ' only caches once the derived half read something',
			body.indexOf('out.size > EXCHANGEABLE_SEED.length') > 0);
	}
} },

{ name: 'the trick-or-treat costumes survive both characters\' sell paths', fn(t) {
  /* The slot is the game's choice, not ours: `trick_or_treat_settle` reads
     `player.slots.helmet` against `G.events.trickortreat.costumes`, and all
     three costumes are `"type":"helmet"`. So one has to be kept and worn.
     EQUIPPED is safe by construction - every sell path in both files iterates
     `character.items`, and `character.slots` is never a sell source - so what
     needs a guard is whichever helmet is NOT being worn. */
  /* OPERATOR'S RULING, 2026-10-23, by editing the lists directly: ONE kept
     costume, horsemanpumpkin; phelmet and gphelmet go to the merchant's sell
     whitelist. The suite went red on that edit as a policy conflict and the
     assertions moved to the ruling - the sold pair is pinned as SOLD so the
     next reader sees a decision, not an omission. */
  const fs = require('fs');
  const COSTUMES = ['horsemanpumpkin'];
  const SOLD = ['phelmet', 'gphelmet'];
  const merch = fs.readFileSync('Party/Merchant.js', 'utf8');
  const prot = merch.slice(merch.indexOf('const PROTECTED_ITEM_NAMES'),
    merch.indexOf(']);', merch.indexOf('const PROTECTED_ITEM_NAMES')));
  for (const c of COSTUMES) {
    t.ok('Merchant protects ' + c, prot.indexOf("'" + c + "'") > 0);
  }
  const mwl = merch.slice(merch.indexOf('whitelist: ['), merch.indexOf(']', merch.indexOf('whitelist: [')));
  for (const c of SOLD) {
    t.eq('Merchant does NOT protect ' + c + ' (operator sells it)', prot.indexOf("'" + c + "'"), -1);
    t.ok('and ' + c + ' is on the merchant whitelist by the operator\'s hand', mwl.indexOf("'" + c + "'") > 0);
  }

  const ranger = fs.readFileSync('Party/Ranger.js', 'utf8');
  /* SEPARATE FROM SCARCE_ITEM_NAMES ON PURPOSE. That set means "not
     plentiful"; this one means "the event wants it worn". One set read by two
     rules for two reasons is the hazard already recorded against
     `alwaysAttack` and `pontyWanted`, so the disjointness is asserted rather
     than left to whoever edits next. */
  const scarce = ranger.slice(ranger.indexOf('const SCARCE_ITEM_NAMES'),
    ranger.indexOf(');', ranger.indexOf('const SCARCE_ITEM_NAMES')));
  for (const c of COSTUMES) {
    t.ok('Ranger names ' + c + ' as a costume',
      ranger.indexOf("const COSTUME_ITEM_NAMES") > 0 &&
      ranger.slice(ranger.indexOf('const COSTUME_ITEM_NAMES'),
        ranger.indexOf(');', ranger.indexOf('const COSTUME_ITEM_NAMES'))).indexOf("'" + c + "'") > 0);
    t.eq('and NOT as scarce - two sets, two reasons', scarce.indexOf("'" + c + "'"), -1);
  }
  const cset = ranger.slice(ranger.indexOf('const COSTUME_ITEM_NAMES'),
    ranger.indexOf(');', ranger.indexOf('const COSTUME_ITEM_NAMES')));
  for (const c of SOLD) t.eq('Ranger does NOT name ' + c + ' as a costume', cset.indexOf("'" + c + "'"), -1);
  t.ok('sellItems consults it', /isCostumeItem\(item\.name\)/.test(ranger));

  /* THE DISCRIMINATING CASE. relief sorts ASCENDING by vendor value and
     refuses only `level > 0`, so a +0 costume is exactly what it reaches -
     gphelmet vendors at 32,000 against the 30,000 dexbelt+0 a relief run was
     measured reaching. The control is an unprotected item at the same value:
     without it this passes against a relief that sells nothing at all. */
  const w = world({
    CONFIG: { inventoryRelief: { neverSell: new Set() } },
    character: { name: 'Dexon', items: [
      { name: 'gphelmet', level: 0 }, { name: 'phelmet', level: 0 },
      { name: 'horsemanpumpkin', level: 0 }, { name: 'leather', level: 0, q: 1 },
    ] },
    isExchangeable: () => false,
    parent: { calculate_item_value: () => 32000 },
  });
  lift(w, 'Party/Ranger.js', ['SCARCE_ITEM_NAMES', 'isScarceItem',
    'COSTUME_ITEM_NAMES', 'isCostumeItem', 'CIPHER_INGREDIENT_NAMES', 'isCipherIngredient', 'reliefSellable']);
  const out = w.reliefSellable().map((r) => r.name);
  t.eq('CONTROL: an unprotected +0 item at the same value IS offered',
    out.includes('leather'), true);
  for (const c of COSTUMES) t.eq('relief refuses ' + c, out.includes(c), false);
  for (const c of SOLD) t.eq('and relief now OFFERS ' + c + ' - a second control, by ruling', out.includes(c), true);
} },
{ name: 'the Witch\'s Cipher ingredients survive every sell path', fn(t) {
  /* Operator's ruling 2026-10-23: never sold. Asserted on every script that
     sells - the merchant's protected set, both ranger paths, and the absence
     from all three whitelists, since a whitelist-driven path holds by
     omission and the operator edits those lists. */
  const fs = require('fs');
  const ING = ['verdantspore', 'frostscale', 'embercoal', 'gloomfeather'];
  const merch = fs.readFileSync('Party/Merchant.js', 'utf8');
  const prot = merch.slice(merch.indexOf('const PROTECTED_ITEM_NAMES'),
    merch.indexOf(']);', merch.indexOf('const PROTECTED_ITEM_NAMES')));
  for (const n of ING) t.ok('Merchant protects ' + n, prot.indexOf("'" + n + "'") > 0);
  for (const f of ['Party/Merchant.js', 'Party/Ranger.js', 'Party/Mage.js']) {
    const src = fs.readFileSync(f, 'utf8');
    const i = src.indexOf('whitelist: [');
    const wl = i < 0 ? '' : src.slice(i, src.indexOf(']', i));
    for (const n of ING) t.eq(f + ': ' + n + ' is on no sell whitelist', wl.indexOf("'" + n + "'"), -1);
  }
  const ranger = fs.readFileSync('Party/Ranger.js', 'utf8');
  t.ok('Ranger sellItems consults the ingredient guard', /isCipherIngredient\(item\.name\)/.test(ranger));
  const w = world({
    CONFIG: { inventoryRelief: { neverSell: new Set() } },
    character: { name: 'Dexon', items: ING.map((n) => ({ name: n, level: 0, q: 5 }))
      .concat([{ name: 'leather', level: 0, q: 1 }]) },
    isExchangeable: () => false,
    parent: { calculate_item_value: () => 1200 },
  });
  lift(w, 'Party/Ranger.js', ['SCARCE_ITEM_NAMES', 'isScarceItem', 'COSTUME_ITEM_NAMES',
    'isCostumeItem', 'CIPHER_INGREDIENT_NAMES', 'isCipherIngredient', 'reliefSellable']);
  const out = w.reliefSellable().map((r) => r.name);
  t.eq('CONTROL: an unprotected +0 item at the same value IS offered', out.includes('leather'), true);
  for (const n of ING) t.eq('relief refuses ' + n, out.includes(n), false);
  /* And on the Ponty BUY list, operator's go-ahead 2026-10-24. Read off the
     lifted CONFIG rather than the text, so a commented-out entry reads as
     absent exactly as it does live. No count is pinned: "25 of each" is a farm
     trigger, not a buy cap (ruled 2026-10-23). */
  const m = merchant();
  const buy = m.CONFIG.pontyBuy.items;
  t.ok('CONTROL: the lifted buy list is the real one (dexbelt on it)', buy.includes('dexbelt'));
  for (const n of ING) t.ok('Merchant Ponty buy list carries ' + n, buy.includes(n));
} },

{ name: 'cave Amber and the Loaded Die are never sold, always banked, and the die is never compounded', fn(t) {
  /* Operator's rulings 2026-10-24: the cave is run for Loaded Dice and Amber
     is what one is made from; "No compounding just bank" for the die. */
  const CAVE = ['cave_amber', 'cave_loaded_die', 'snakeoil'];
  const prot = namesIn('Party/Merchant.js', 'const PROTECTED_ITEM_NAMES');
  const scarce = namesIn('Party/Ranger.js', 'const SCARCE_ITEM_NAMES');
  const m = merchant();
  for (const n of CAVE) {
    if (n !== 'snakeoil') t.ok(n + ' is in the merchant PROTECTED_ITEM_NAMES', prot.includes(n));
    t.ok(n + ' is in the ranger SCARCE_ITEM_NAMES', scarce.includes(n));
    t.ok(n + ' is kept and banked on the merchant', (m.CONFIG.materials.keepAndBank || []).includes(n));
    t.ok(n + ' is not on the merchant sell whitelist', m.CONFIG.selling.whitelist.indexOf(n) < 0);
    const rl = (text('Party/Ranger.js').match(/^\t\twhitelist: \[[^\]]*\]/m) || [''])[0];
    t.ok('CONTROL: the ranger whitelist was found', rl.length > 20);
    t.ok(n + ' is not on the ranger sell whitelist', rl.indexOf("'" + n + "'") < 0);
  }
  t.eq('the die is capped at +0, so no compound path will take it', m.CONFIG.craftInputCaps.cave_loaded_die, 0);
  lift(m, 'Party/Merchant.js', ['craftInputCap', 'compoundWouldOvershootCap']);
  t.eq('compounding a +0 die overshoots the cap', m.compoundWouldOvershootCap('cave_loaded_die', 0), true);
  t.eq('CONTROL: a +0 dexbelt still compounds', m.compoundWouldOvershootCap('dexbelt', 0), false);
} }];
