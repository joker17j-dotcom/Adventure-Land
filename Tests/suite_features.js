/* Tests/suite_features.js - the three party scripts say which one they are.

   Dexon, a RANGER, was found on 2026-10-19 running Party/Mage.js out of the
   Ranger slot with code_active true. Nothing in these files reached `parent`,
   so from outside there was nothing to read. A version number would not have
   caught it - the slot header said v77, a real and current version, just the
   wrong script's - which is why the published signal is the set of functions
   the build actually DEFINES rather than a number describing it.

   The list is still written by hand, and that is the thing this suite is for:
   a key naming a function the build does not define is the only way the
   published set can lie, and these assertions close it at the gate instead of
   relying on whoever adds the next feature. */
const fs = require('fs');
const path = require('path');
const { lift, extract, world, ROOT } = require('./lift');

const SCRIPTS = ['Ranger', 'Priest', 'Mage'];
const src = (n) => fs.readFileSync(path.join(ROOT, 'Party/' + n + '.js'), 'utf8');
const probeKeys = (n) =>
	[...extract('Party/' + n + '.js', 'PARTY_FEATURE_PROBE').matchAll(/(\w+):\s*typeof\s+(\w+)/g)];

module.exports = [{

name: 'each script publishes a feature set that resolves in its own source', fn(t) {
	for (const n of SCRIPTS) {
		const s = src(n);
		const declared = new Set([...s.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
			.map((m) => m[1]));
		const pairs = probeKeys(n);
		t.ok(n + ': the probe table is not empty', pairs.length > 0);
		t.eq(n + ": PARTY_SCRIPT names the file it is in",
			(s.match(/^const PARTY_SCRIPT = '(\w+)';$/m) || [])[1], n);
		for (const [, key, typed] of pairs) {
			/* THE KEY MUST BE typeof'd AGAINST ITSELF. `foo: typeof bar` would
			   publish foo on the strength of bar existing - a published key
			   that means nothing. Cheap to write by accident, invisible later. */
			t.eq(n + ': ' + key + ' is typeof\'d against itself', typed, key);
			t.ok(n + ': ' + key + ' is declared in Party/' + n + '.js', declared.has(key));
		}
	}
},

}, {

/* A PUBLISHED KEY THAT THE RESULT FILTER EATS IS A KEY THAT CANNOT BE READ,
   and this whole mechanism exists to be read through a probe. Measured by the
   browser session 2026-10-19 with identical values and only the key name
   varying: the filter does plain case-insensitive SUBSTRING matching, so
   `author` and `secretary` are suppressed exactly as `token` is. Bare `key`
   is NOT matched - keys, keyTest and monkey all pass.

   This cannot cover the CHARACTER-name key: FatherToken contains "token" and
   his PARTY_BUILD entry is suppressed in any wholesale read of the object.
   That is not fixable here and is not a fault in the data - read
   `parent.PARTY_BUILD[character.name].script` and the blocked key never
   appears in the result. */
name: 'no published key is one the result filter will suppress', fn(t) {
	const BLOCKED = ['token', 'auth', 'secret', 'password', 'apikey', 'api_key',
		'credential', 'bearer', 'session_id', 'cookie'];
	for (const n of SCRIPTS) {
		for (const [, key] of probeKeys(n)) {
			const hit = BLOCKED.filter((b) => key.toLowerCase().includes(b));
			t.eq(n + ': ' + key + ' survives the result filter', hit.join(','), '');
		}
	}
	// the check has to be able to fail, or it is decoration
	t.eq('the list would catch a key named authTarget',
		BLOCKED.filter((b) => 'authTarget'.toLowerCase().includes(b)).join(','), 'auth');
	t.eq('and does not fire on a bare key-like name',
		BLOCKED.filter((b) => 'monkeyKeys'.toLowerCase().includes(b)).join(','), '');
},

}, {

name: 'the three feature sets stay disjoint, so one read names the script', fn(t) {
	const sets = {};
	for (const n of SCRIPTS) sets[n] = new Set(probeKeys(n).map((m) => m[1]));
	for (const a of SCRIPTS) {
		for (const b of SCRIPTS) {
			if (a >= b) continue;
			const shared = [...sets[a]].filter((k) => sets[b].has(k));
			/* Overlap does not break identification on its own, but it erodes
			   it silently - the sets are the whole mechanism, so drift toward
			   a shared key should fail here rather than weaken a live probe. */
			t.eq(a + ' and ' + b + ' share no feature key', shared.join(','), '');
		}
	}
},

}, {

name: 'publishPartyBuild reports only what the build actually defines', fn(t) {
	/* Ranger's table, with half its functions missing from the world. A build
	   that lost them must not keep claiming them. */
	const w = world({});
	lift(w, 'Party/Ranger.js', ['publishPartyBuild']);
	w.PARTY_SCRIPT = 'Ranger';
	w.PARTY_FEATURE_PROBE = {
		achvScore: 'function', bossRank: 'function',
		combineItems: 'undefined', addToBlacklist: 'undefined',
	};

	const out = w.publishPartyBuild();
	t.eq('only the defined keys are published', out.join(','), 'achvScore,bossRank');
	t.eq('and they are sorted', out.join(','), [...out].sort().join(','));
	t.eq('published under the character name, not the script name',
		w.parent.PARTY_BUILD.Dexon.script, 'Ranger');
	t.eq('the character key is who is running it',
		Object.keys(w.parent.PARTY_BUILD).join(','), 'Dexon');
	t.eq('and the features ride along', w.parent.PARTY_BUILD.Dexon.features.join(','),
		'achvScore,bossRank');

	/* THE DEXON CASE, asserted directly: a ranger running mage code reports
	   'Mage' against the ranger's own name, which is the thing a version
	   number could not say. */
	const dexonOnMage = world({});
	lift(dexonOnMage, 'Party/Mage.js', ['publishPartyBuild']);
	dexonOnMage.PARTY_SCRIPT = 'Mage';
	dexonOnMage.PARTY_FEATURE_PROBE = { findEnergizeTarget: 'function' };
	dexonOnMage.publishPartyBuild();
	t.eq('a ranger running Mage.js says so', dexonOnMage.parent.PARTY_BUILD.Dexon.script, 'Mage');

	// a parent that throws must not take the script down at load
	const hostile = world({});
	lift(hostile, 'Party/Ranger.js', ['publishPartyBuild']);
	hostile.PARTY_SCRIPT = 'Ranger';
	hostile.PARTY_FEATURE_PROBE = { achvScore: 'function' };
	Object.defineProperty(hostile, 'parent', { get() { throw new Error('no parent'); } });
	t.eq('an unreachable parent still returns the list rather than throwing',
		hostile.publishPartyBuild().join(','), 'achvScore');
},

}, {

name: 'the publish block has not diverged across the three scripts', fn(t) {
	/* Same guard as the relay block and bossHopFollow: these were written once
	   and copied, and the v94 strand shipped to Ranger alone and stranded the
	   followers. Only the two DATA lines may differ. */
	const norm = (n) => extract('Party/' + n + '.js', 'publishPartyBuild');
	t.eq('publishPartyBuild is identical in Ranger and Priest', norm('Ranger'), norm('Priest'));
	t.eq('publishPartyBuild is identical in Ranger and Mage', norm('Ranger'), norm('Mage'));
	for (const n of SCRIPTS) {
		t.ok(n + ' calls publishPartyBuild() at load',
			/^publishPartyBuild\(\);$/m.test(src(n)));
	}
},

}];
