/* Tests/suite_bosstimers.js - the Schedule tab of Codex/boss_timers.html.

   The page is not a CODE slot, but its script sits at column 0 like one, so
   lift() reads the committed HTML exactly as it reads a character script. Two
   things here are cross-file and are the reason the suite exists rather than
   a screenshot: the rank table is a COPY of Party/Ranger.js's, and the fields
   the page reads are whatever published_schedule() in Codex/market_bridge.py
   emits. Either side can move without the other noticing. */
const vm = require('vm');
const { lift, world } = require('./lift');

const PAGE = 'Codex/boss_timers.html';

/* `const SCHED_SHARD_ORDER = [` is the array form lift() cannot reach (it
   brace-matches from the first `{`), so it is read off the page's own text
   and evaluated - the committed line, not a transcription. */
function pageWorld() {
	const w = world({});
	const src = require('fs').readFileSync(require('path').join(__dirname, '..', PAGE), 'utf8');
	const m = /^const SCHED_SHARD_ORDER = (\[[^\]]*\]);$/m.exec(src);
	if (m) vm.runInContext('globalThis.SCHED_SHARD_ORDER = ' + m[1], w);
	w.Map = Map; w.Set = Set;
	lift(w, PAGE, ['SCHED_RANK', 'schedRank', 'schedShardKey', 'schedRegionShards', 'schedRows', 'schedEvents']);
	/* The default is derived on the page, and a scalar initialiser is not
	   liftable, so the committed line is evaluated as written. */
	const d = /^const SCHED_RANK_DEFAULT = (.*);$/m.exec(src);
	if (d) vm.runInContext('globalThis.SCHED_RANK_DEFAULT = ' + d[1], w);
	return { w, src, hasOrder: !!m };
}

const H = 3600e3;
const T0 = Date.parse('2026-10-24T05:00:00Z');
const SERVERS = { 'US I': {}, 'US II': {}, 'US IV': {}, 'US V': {}, 'US PVP': {}, 'EU I': {}, 'EU II': {} };
const occ = (server, event, at, window_sec) => ({ server, event, at_ms: at, window_sec: window_sec === undefined ? 2400 : window_sec });

module.exports = [{ name: 'boss_timers Schedule tab', fn(t) {
	const { w, src, hasOrder } = pageWorld();
	t.ok('precondition: SCHED_SHARD_ORDER read from the page source', hasOrder);

	/* -- the rank copy matches the Ranger's table ------------------------ */
	const r = world({});
	lift(r, 'Party/Ranger.js', ['BOSS_RANK']);
	const ranger = JSON.parse(JSON.stringify(r.BOSS_RANK));
	t.eq('SCHED_RANK is identical to Party/Ranger.js BOSS_RANK', JSON.parse(JSON.stringify(w.SCHED_RANK)), ranger);
	/* Both defaults are DERIVED now, one past the largest entry, so the copy is
	   checked by the same rule rather than by a literal parsed out of the file. */
	const rsrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'Party/Ranger.js'), 'utf8');
	t.ok('precondition: the Ranger derives its default', /^const BOSS_RANK_DEFAULT = Math\.max\.apply\(null, Object\.values\(BOSS_RANK\)\) \+ 1;$/m.test(rsrc));
	t.ok('and so does the page', /^const SCHED_RANK_DEFAULT = Math\.max\.apply\(null, Object\.values\(SCHED_RANK\)\) \+ 1;$/m.test(src));
	const rangerDefault = Math.max.apply(null, Object.values(ranger)) + 1;
	t.eq('SCHED_RANK_DEFAULT equals BOSS_RANK_DEFAULT', w.SCHED_RANK_DEFAULT, rangerDefault);
	t.eq('an unranked event takes the default', w.schedRank('abtesting'), rangerDefault);

	/* -- one row per start time, cells by rank then name ----------------- */
	const list = [
		occ('US I', 'abtesting', T0), occ('US II', 'goobrawl', T0, 540), occ('US IV', 'crabxx', T0),
		occ('US V', 'goobrawl', T0, 540), occ('EU I', 'horseman', T0 + H), occ('EU II', 'horseman', T0 + H),
		occ('US I', 'graveyard', T0 + 1.5 * H, 600),
	];
	const rows = w.schedRows(list, SERVERS, T0 - 60e3, new Set());
	t.eq('one row per distinct start time', rows.map((x) => x.at_ms), [T0, T0 + H, T0 + 1.5 * H]);
	t.eq('cells by rank (goobrawl 3 before crabxx 4)',
		rows[0].cells.map((c) => c.event), ['goobrawl', 'crabxx', 'abtesting']);
	t.eq('the rank rides on the cell', rows[0].cells.map((c) => c.rank), [3, 4, 9]);
	t.eq('two shards running one event share one cell', rows[0].cells[0].regions,
		[{ region: 'US', shards: ['II', 'V'], all: false }]);

	/* -- "all" means every reporting shard of that region ---------------- */
	t.eq('every reporting EU shard -> all', rows[1].cells[0].regions, [{ region: 'EU', shards: ['I', 'II'], all: true }]);
	const usAll = w.schedRows(['US I', 'US II', 'US IV', 'US V', 'US PVP'].map((s) => occ(s, 'horseman', T0)), SERVERS, T0 - 1, new Set());
	t.eq('shards sort I II IV V then PVP, not alphabetically', usAll[0].cells[0].regions[0].shards, ['I', 'II', 'IV', 'V', 'PVP']);
	t.eq('all five reporting US shards -> all', usAll[0].cells[0].regions[0].all, true);

	/* -- the filter --------------------------------------------------------- */
	const filtered = w.schedRows(list, SERVERS, T0 - 60e3, new Set(['horseman']));
	t.eq('a filtered event leaves its row empty and the row goes', filtered.map((x) => x.at_ms), [T0, T0 + 1.5 * H]);
	t.eq('the filter does not drop the other events at that time',
		w.schedRows(list, SERVERS, T0 - 60e3, new Set(['goobrawl']))[0].cells.map((c) => c.event), ['crabxx', 'abtesting']);
	t.eq('schedEvents lists a hidden event so it can be switched back on',
		w.schedEvents([occ('US I', 'crabxx', T0)], new Set(['horseman'])), ['crabxx', 'horseman']);
	t.eq('schedEvents is by rank, ties by name (graveyard and horseman, both 5)', w.schedEvents(list, new Set()), ['goobrawl', 'crabxx', 'graveyard', 'horseman', 'abtesting']);

	/* -- live and ended ------------------------------------------------------ */
	const at10 = w.schedRows(list, SERVERS, T0 + 10 * 60e3, new Set());
	const c0 = at10[0].cells;
	t.eq('goobrawl (540s) has closed 10 minutes in and drops out of its row', c0.map((c) => c.event), ['crabxx', 'abtesting']);
	t.eq('crabxx is live 10 minutes into a 2400s window', c0[0].live, true);
	t.eq('and reports what is left of it', c0[0].left_sec, 1800);
	t.eq('a future cell is not live', at10[1].cells[0].live, false);
	t.eq('a row whose every window has closed is dropped',
		w.schedRows(list, SERVERS, T0 + 50 * 60e3, new Set()).map((x) => x.at_ms), [T0 + H, T0 + 1.5 * H]);
	const nullW = w.schedRows([occ('US I', 'mystery', T0, null)], SERVERS, T0 + 30e3, new Set());
	t.eq('an unknown window (null) is live only through its start minute', nullW[0].cells[0].live, true);
	t.eq('and gone after it', w.schedRows([occ('US I', 'mystery', T0, null)], SERVERS, T0 + 61e3, new Set()).length, 0);

	/* -- the far side of the handoff: the bridge emits what the page reads --
	   The page reads server, event, at_ms and window_sec off each occurrence
	   and the KEYS of `servers`. Asserted against published_schedule()'s own
	   source, because a renamed field would leave every test above green and
	   the live tab empty. */
	const py = require('fs').readFileSync(require('path').join(__dirname, '..', 'Codex/market_bridge.py'), 'utf8');
	const at = py.indexOf('\ndef published_schedule(');
	const end = at < 0 ? -1 : py.indexOf('\ndef ', at + 1);
	/* indexOf, not a throwing lookup: a missing function must report as a
	   failed assertion rather than abort the suite. */
	const bridge = at < 0 ? '' : py.slice(at, end < 0 ? undefined : end);
	t.ok('precondition: published_schedule found in the bridge', bridge.length > 0);
	for (const k of ['"server"', '"event"', '"at_ms"', '"window_sec"', '"servers"', '"occurrences"'])
		t.ok('published_schedule emits ' + k, bridge.indexOf(k) >= 0);
	t.ok('the page fetches /schedule_live', src.indexOf('"/schedule_live?hours="') >= 0);
}}];
