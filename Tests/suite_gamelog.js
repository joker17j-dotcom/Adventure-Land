/* Tests/suite_gamelog.js - the shared GAMELOG block: every game-log line to a
   file on the bridge. Lifted from the committed files; the bridge half is
   Tests/bridge/test_gamelog.py. */
const fs = require('fs');
const path = require('path');
const { lift, world, ROOT } = require('./lift');

const FILES = ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js', 'Party/Merchant.js', 'CaveRun.js'];
const text = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const block = (f) => {
	const s = text(f);
	const a = s.indexOf('// === GAMELOG BEGIN ===');
	const b = s.indexOf('// === GAMELOG END ===');
	return (a >= 0 && b > a) ? s.slice(a, b) : null;
};
const FNS = ['GAMELOG', 'gamelogPageSource', 'gamelogInstall', 'gamelogMarkScript', 'gamelogName',
	'gamelogRestore', 'gamelogPost', 'gamelogFlush', 'gamelogStatus'];

/* A page with the game's add_log, its own localStorage, and a pagehide hook we
   can fire. pageFn false makes the page refuse its Function, as a strict CSP
   would. */
function page(over = {}) {
	const shown = [];
	const ls = {};
	const hooks = {};
	const P = {
		server_region: 'US', server_identifier: 'II',
		character: { name: 'Dexon', map: 'main' },
		add_log: function (m, c) { shown.push([m, c]); },
		localStorage: {
			getItem: (k) => (k in ls ? ls[k] : null),
			setItem: (k, v) => { ls[k] = String(v); },
			removeItem: (k) => { delete ls[k]; },
		},
		addEventListener: (ev, fn) => { hooks[ev] = fn; },
	};
	if (over.pageFn !== false) P.Function = Function;
	return { P, shown, ls, hooks };
}
function mk(over = {}) {
	const pg = over.page || page(over);
	const w = world({ character: { name: 'Dexon' } });
	w.parent = pg.P;
	w.fetch = over.fetch || (async () => ({ json: async () => ({ ok: true }) }));
	lift(w, over.file || 'Party/Ranger.js', FNS);
	return { w, pg };
}

module.exports = [

{ name: 'the GAMELOG block is byte-identical in all five scripts, and runs at load', fn(t) {
	const ref = block(FILES[0]);
	t.ok('Ranger carries the block', !!ref);
	for (const f of FILES.slice(1)) t.eq(f + ' carries the same block', block(f), ref);
	for (const f of FILES) {
		const s = text(f);
		const b = s.indexOf('// === GAMELOG END ===');
		t.ok(f + ': gamelogStart() is called inside it, at load', /\ngamelogStart\(\);\n\/\/ === GAMELOG END ===/.test(s));
		t.eq(f + ': exactly one block', s.split('// === GAMELOG BEGIN ===').length - 1, 1);
		t.eq(f + ': GAMELOG is declared once', (s.match(/^const GAMELOG = \{/mg) || []).length, 1);
	}
	t.ok('CaveRun puts it inside its IIFE and exports the status',
		/\/\/ === GAMELOG END ===\nwindow\.gamelogStatus = gamelogStatus;\n\n\}\)\(\);\n$/.test(text('CaveRun.js')));
} },

{ name: 'the four party scripts\' log filters hand server messages to the capture', fn(t) {
	const CALL = "try { const g = parent.__gamelog; if (g && typeof g.capture === 'function') g.capture(message, color, 'game'); } catch (e) { }";
	for (const f of ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js', 'Party/Merchant.js']) {
		const s = text(f);
		const a = s.indexOf("function addLogEntry(message, color = 'white') {");
		t.ok(f + ': addLogEntry exists', a > 0);
		const body = s.slice(a, s.indexOf('const gamelog =', a));
		t.ok(f + ': and captures before anything can return', body.indexOf(CALL) > 0 && body.indexOf(CALL) < body.indexOf('return;'));
	}
	/* CaveRun installs no filter, so on a page it started the game's own
	   listener still reaches add_log - a capture call there would count those
	   lines twice. */
	t.eq('CaveRun has no addLogEntry to hook', /function addLogEntry/.test(text('CaveRun.js')), false);
	t.eq('nor replaces the server-message listener', /removeListener\('game_log'\)/.test(text('CaveRun.js')), false);
} },

{ name: 'install wraps add_log once, in the page, and every line still reaches the screen', fn(t) {
	const { w, pg } = mk();
	const st = w.gamelogInstall();
	t.eq('built in the page realm', st.realm, 'page');
	pg.P.add_log('Path not found!', 'red');
	t.eq('the game still shows the line', pg.shown, [['Path not found!', 'red']]);
	const l = st.buf[0] || {};
	t.eq('captured with its fields',
		[l.character, l.server, l.map, l.color, l.message, l.source, l.seq],
		['Dexon', 'USII', 'main', 'red', 'Path not found!', 'game', 1]);
	t.ok('stamped with the page start and a send time', typeof l.page === 'number' && typeof l.t_script === 'number');
	pg.P.add_log({ a: 1 }, null);
	t.eq('an object message is stored as JSON, as add_log itself does', st.buf[1].message, '{"a":1}');
	t.eq('a second load reuses the page state', w.gamelogInstall() === st, true);
	pg.P.add_log('x', 'white');
	t.eq('and does not wrap twice - one line, one capture', st.buf.length, 3);
} },

{ name: 'a CODE-realm state (page refused its Function) is rebuilt on the next load, keeping its lines', fn(t) {
	const pg = page({ pageFn: false });
	const gameAddLog = pg.P.add_log;
	const a = mk({ page: pg });
	const st1 = a.w.gamelogInstall();
	t.eq('precondition: the page refused, so it is a CODE-realm state', st1.realm, 'code');
	pg.P.add_log('one', 'white');
	pg.P.Function = Function;                     // the next load can build in the page
	const b = mk({ page: pg });
	const st2 = b.w.gamelogInstall();
	t.eq('rebuilt in the page', st2.realm, 'page');
	t.eq('carrying the unsent line', st2.buf.map((l) => l.message), ['one']);
	pg.P.add_log('two', 'white');
	t.eq('and the old wrapper was unwound - one capture per line', st2.buf.map((l) => l.message), ['one', 'two']);
	t.eq('the screen saw both, once each', pg.shown.map((x) => x[0]), ['one', 'two']);
	/* Without the unwind the old wrapper stays in the chain, feeding a buffer
	   nobody drains - invisible in the file, and one layer deeper on every
	   runner restart. */
	t.eq('the new wrapper sits directly on the game\'s add_log (identity - eq would call any two functions equal)',
		st2.orig === gameAddLog, true);
} },

{ name: 'our own game_log() lines are marked script, the game\'s are not', fn(t) {
	const { w, pg } = mk();
	const st = w.gamelogInstall();
	w.game_log = function (m, c) { pg.P.add_log(m, c); };
	t.eq('wraps the runner game_log', w.gamelogMarkScript(), true);
	t.eq('once', w.gamelogMarkScript(), false);
	w.game_log('from the script', '#fff');
	pg.P.add_log('from the game', '#fff');
	t.eq('sources', st.buf.map((l) => l.source), ['script', 'game']);
	t.eq('and the flag is cleared after the call', st.src, null);
} },

{ name: 'a full buffer drops the oldest and counts them', fn(t) {
	const { w, pg } = mk();
	const st = w.gamelogInstall();
	for (let i = 0; i < w.GAMELOG.keep + 5; i++) pg.P.add_log('l' + i, null);
	t.eq('capped at keep', st.buf.length, w.GAMELOG.keep);
	t.eq('the five oldest counted as dropped', st.dropped, 5);
	t.eq('and it is the oldest that went', st.buf[0].message, 'l5');
} },

{ name: 'flush: sent lines leave by identity, a failure keeps them, the dropped count travels', async fn(t) {
	let posted = null, mode = 'ok';
	const { w, pg } = mk({ fetch: async (url, o) => {
		posted = { url, body: JSON.parse(o.body) };
		if (mode === 'throw') throw new Error('bridge down');
		if (mode === 'refuse') return { json: async () => ({ ok: false, error: 'game log disabled' }) };
		/* While the POST is out, the capture trims the front of a full buffer.
		   Removing by position would then drop lines that were never sent. */
		if (mode === 'trim') { pg.P.add_log('late', null); w.parent.__gamelog.buf.shift(); }
		return { json: async () => ({ ok: true }) };
	} });
	const st = w.gamelogInstall();
	pg.P.add_log('a', null); pg.P.add_log('b', null);
	st.dropped = 4;
	t.eq('sent', await w.gamelogFlush(), 'sent');
	t.eq('to the bridge path', posted.url, 'http://127.0.0.1:8787/gamelog');
	t.eq('both lines, with the dropped count', [posted.body.lines.map((l) => l.message), posted.body.dropped], [['a', 'b'], 4]);
	t.eq('the buffer is empty and the count reported is cleared', [st.buf.length, st.dropped, st.sent], [0, 0, 2]);
	t.eq('nothing to send', await w.gamelogFlush(), 'empty');

	pg.P.add_log('c', null);
	mode = 'throw';
	t.eq('a dead bridge', await w.gamelogFlush(), 'failed');
	t.eq('keeps the line', st.buf.map((l) => l.message), ['c']);
	t.ok('and says why', /bridge down/.test(st.lastErr));
	mode = 'refuse';
	t.eq('a refusal keeps it too', [await w.gamelogFlush(), st.buf.length], ['refused', 1]);

	mode = 'trim';
	pg.P.add_log('d', null);
	t.eq('sent while the buffer moved', await w.gamelogFlush(), 'sent');
	t.eq('only the unsent line is left', st.buf.map((l) => l.message), ['late']);
} },

{ name: 'flush: one at a time, unless the last one was abandoned', async fn(t) {
	const { w, pg } = mk();
	const st = w.gamelogInstall();
	pg.P.add_log('x', null);
	st.flushingSince = Date.now();
	t.eq('a flush in flight blocks the next', await w.gamelogFlush(), 'busy');
	st.flushingSince = Date.now() - 3 * w.GAMELOG.timeoutMs;
	t.eq('one older than twice the timeout is abandoned', await w.gamelogFlush(), 'sent');
} },

{ name: 'a hop: the page saves what is unsent, the next page sends it first', async fn(t) {
	const { w, pg } = mk();
	const st = w.gamelogInstall();
	pg.P.add_log('before the hop', null);
	t.eq('precondition: a pagehide handler is registered', typeof pg.hooks.pagehide, 'function');
	pg.hooks.pagehide();
	const saved = JSON.parse(pg.ls.gamelog_unsent_Dexon || '[]');
	t.eq('saved under the character\'s own key', saved.map((l) => l.message), ['before the hop']);

	/* The next page: a fresh capture, the same storage. */
	const next = page();
	next.ls.gamelog_unsent_Dexon = JSON.stringify(saved);
	Object.assign(next.P.localStorage, { getItem: (k) => (k in next.ls ? next.ls[k] : null), removeItem: (k) => { delete next.ls[k]; } });
	let posted = null;
	const n = mk({ page: next, fetch: async (u, o) => { posted = JSON.parse(o.body); return { json: async () => ({ ok: true }) }; } });
	n.w.gamelogInstall();
	next.P.add_log('after the hop', null);
	await n.w.gamelogFlush();
	t.eq('old lines first, then the new', posted.lines.map((l) => l.message), ['before the hop', 'after the hop']);
	t.eq('the key is removed once read', 'gamelog_unsent_Dexon' in next.ls, false);
	t.ok('the two pages are told apart', posted.lines[0].page !== posted.lines[1].page || posted.lines[0].seq !== posted.lines[1].seq);
	const other = page();
	other.ls.gamelog_unsent_Dexon = '[{"message":"not mine"}]';
	other.P.character.name = 'MageofOz';
	const o = mk({ page: other });
	o.w.character.name = 'MageofOz';
	o.w.gamelogInstall();
	await o.w.gamelogFlush();
	t.eq('another character never sends Dexon\'s backlog', 'gamelog_unsent_Dexon' in other.ls, true);
} },

{ name: 'status reads the page state without building it', fn(t) {
	const { w, pg } = mk();
	t.eq('before install', w.gamelogStatus(), { installed: false });
	w.gamelogInstall();
	pg.P.add_log('x', null);
	const s = w.gamelogStatus();
	t.eq('after', [s.installed, s.realm, s.buffered, s.sent], [true, 'page', 1, 0]);
} },

];
