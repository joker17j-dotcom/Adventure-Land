/* Tests/suite_merchantver.js - the version is read, not transcribed.

   Two constants in Party/Merchant.js used to carry the version by hand and both
   rotted under a comment telling a human to bump them: the deploy marker at 95
   against a v103 header, and MERCHANT_BUILD at v76. This suite exists because a
   third instruction would rot too. */
const { lift, world } = require('./lift');

function withHeader(line2) {
	const w = world({});
	w.parent.codemirror_render = { getValue: () => '// ====\n' + line2 + '\nbody\n' };
	lift(w, 'Party/Merchant.js', ['merchantHeaderVersion']);
	return w;
}

module.exports = [{ name: 'merchantHeaderVersion reads the slot header', fn(t) {
	// the real Party/Merchant.js header shape
	t.eq('clean header -> the version',
		withHeader('// Meltymerch (Merchant) - slot CH_aLtHealaSgKdmOsDWpNl8scE9NhXk - v103')
			.merchantHeaderVersion(), 103);
	t.eq('a four-digit bump still reads',
		withHeader('// Meltymerch (Merchant) - slot CH_x - v1040').merchantHeaderVersion(), 1040);
	t.eq('the character name is not hardcoded - only the class marker is',
		withHeader('// Renamed (Merchant) - slot CH_x - v105').merchantHeaderVersion(), 105);
	t.eq('trailing whitespace tolerated',
		withHeader('// Meltymerch (Merchant) - slot CH_x - v103   ').merchantHeaderVersion(), 103);

	/* THE TRAP IS NOW DEFENDED, NOT MERELY DOCUMENTED, AND THIS ASSERTION WAS
	   INVERTED ON 2026-10-19. It used to assert that a history-carrying header
	   returns its OLDEST version (2), recording the hazard and relying on a
	   reader not to copy the helper into a root script. Measured live that day:
	   the buffer reports the slot the EDITOR has LOADED, not the script that is
	   EXECUTING, so with slot 8 loaded and Merchant still running the helper
	   read OpenGifts' header and returned 2 - with no copying involved at all.
	   The hazard was never about where the helper lives. Requiring the full
	   "(Merchant)" header shape makes every foreign buffer null. */
	t.eq('a history-carrying foreign header is null, not its oldest version',
		withHeader('// OpenGifts - open boxes - v10 (2026-10-18) THREE CHANGES ... - v2')
			.merchantHeaderVersion(), null);

	/* The real sibling headers, verbatim in shape - these are what the buffer
	   actually holds when the editor has another slot open. */
	t.eq('a Ranger header is not read as a merchant version',
		withHeader('// Dexon (Ranger) - Mainframe slot CH_x - v97').merchantHeaderVersion(), null);
	t.eq('a Priest header is not read as a merchant version',
		withHeader('// FatherToken (Priest) - Mainframe slot CH_x - v55').merchantHeaderVersion(), null);
	t.eq('a Mage header is not read as a merchant version',
		withHeader('// MageofOz (Mage) - Mainframe slot CH_x - v78').merchantHeaderVersion(), null);
	t.eq('a bare trailing version with no header shape is null',
		withHeader('something else entirely - v42').merchantHeaderVersion(), null);

	// failure modes report unknown rather than guessing
	t.eq('no version on line 2 -> null',
		withHeader('// Meltymerch (Merchant) - slot CH_x').merchantHeaderVersion(), null);
	t.eq('a slot token ending in v+digits is not mistaken for the version',
		withHeader('// Meltymerch (Merchant) - slot CH_abcv9 - v103').merchantHeaderVersion(), 103);

	const noCm = world({});
	lift(noCm, 'Party/Merchant.js', ['merchantHeaderVersion']);
	t.eq('no codemirror_render -> null, not a throw', noCm.merchantHeaderVersion(), null);

	const throws = world({});
	throws.parent.codemirror_render = { getValue: () => { throw new Error('boom'); } };
	lift(throws, 'Party/Merchant.js', ['merchantHeaderVersion']);
	t.eq('getValue throwing -> null, not a throw', throws.merchantHeaderVersion(), null);

	const notString = world({});
	notString.parent.codemirror_render = { getValue: () => 12345 };
	lift(notString, 'Party/Merchant.js', ['merchantHeaderVersion']);
	t.eq('non-string buffer -> null', notString.merchantHeaderVersion(), null);

	const oneLine = world({});
	oneLine.parent.codemirror_render = { getValue: () => 'only one line' };
	lift(oneLine, 'Party/Merchant.js', ['merchantHeaderVersion']);
	t.eq('a buffer with no line 2 -> null', oneLine.merchantHeaderVersion(), null);
} }, {

/* THE READ RETRIES UNTIL IT SUCCEEDS, THEN STOPS. A one-shot read at load is
   null forever if parent.codemirror_render is not populated at that instant,
   and a null MERCHANT_VER is indistinguishable from a build predating the
   marker - so the marker's one job, telling a deploy from a stale slot, would
   fail in the direction nobody can detect. These assert both halves: it keeps
   trying while unreadable, and it stops trying once it has an answer. */
name: 'the version read retries, then pins', fn(t) {

	function ver(getValue) {
		const w = world({});
		w.parent.codemirror_render = { getValue: getValue };
		lift(w, 'Party/Merchant.js',
			['merchantHeaderVersion', 'merchantVerCache', 'merchantVersion', 'merchantBuild']);
		return w;
	}
	const HDR = (v) => '// ====\n// Meltymerch (Merchant) - slot CH_x - v' + v + '\nbody\n';

	// the buffer is not there yet at load, then it is
	let ready = false, calls = 0;
	const late = ver(() => { calls++; return ready ? HDR(103) : null; });
	t.eq('unreadable at load -> null', late.merchantVersion(), null);
	t.eq('and parent.MERCHANT_VER is left unset rather than stamped null',
		late.parent.MERCHANT_VER, undefined);
	ready = true;
	t.eq('a later call picks it up', late.merchantVersion(), 103);
	t.eq('and stamps parent.MERCHANT_VER on that first success',
		late.parent.MERCHANT_VER, 103);

	// once answered it must not move - a save_code mid-run cannot shift it
	const before = calls;
	ready = 'shifted';
	t.eq('the answer is pinned after the first success', late.merchantVersion(), 103);
	t.eq('and the buffer is not read again', calls, before);

	// the build string derives from the same read
	const good = ver(() => HDR(104));
	t.eq('merchantBuild derives from the header', good.merchantBuild(), 'v104');
	const bad = ver(() => null);
	t.that('an unreadable buffer says so rather than guessing a version',
		/^v\? /.test(bad.merchantBuild()));
	t.eq('and it is not the string "vnull"', bad.merchantBuild().indexOf('null'), -1);

	/* lift() pulls declarations, so nothing above proves the FILE calls
	   merchantVersion() at load. Without that call parent.MERCHANT_VER is unset
	   until some consumer happens to run, and the probe reads it from outside. */
	const { ROOT } = require('./lift');
	const src = require('fs').readFileSync(require('path').join(ROOT, 'Party/Merchant.js'), 'utf8');
	t.that('the file calls merchantVersion() at load so the stamp is not deferred',
		/^merchantVersion\(\);$/m.test(src));
	t.eq('and nothing transcribes a version into parent.MERCHANT_VER any more',
		/parent\.MERCHANT_VER\s*=\s*\d/.test(src), false);
} }];
