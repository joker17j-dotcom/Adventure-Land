#!/usr/bin/env node
/* Tests/run.js - no framework, no dependency, matching how the rest of this
   repo works. `node Tests/run.js` runs every suite_*.js beside it; name one
   or more on the command line to run a subset.

   A suite exports an array of { name, fn }. fn receives `t`, throws nothing,
   and records assertions. Exit code is 1 if any assertion failed, so this is
   usable as a gate without reading the output. */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = __dirname;
const want = process.argv.slice(2);

function makeT() {
	const results = [];
	const show = (v) => { try { return JSON.stringify(v); } catch (e) { return String(v); } };
	return {
		results,
		/* Deep-equal by JSON, which is what every one of these assertions
		   actually wants and keeps a failure readable. */
		eq(name, got, want) {
			results.push({ name, ok: show(got) === show(want), got, want });
		},
		ok(name, got) { this.eq(name, !!got, true); },
		/* For a bound rather than a value - "under 300ms", "at least 2". */
		that(name, cond, detail) {
			results.push({ name, ok: !!cond, got: detail === undefined ? cond : detail, want: 'true' });
		},
		note(msg) { results.push({ note: msg }); },
	};
}

(async () => {
	const files = fs.readdirSync(DIR)
		.filter((f) => /^suite_.*\.js$/.test(f))
		.filter((f) => !want.length || want.some((w) => f.includes(w)))
		.sort();

	if (!files.length) { console.log('no suites matched'); process.exit(1); }

	let total = 0, failed = 0;
	for (const f of files) {
		const suites = require(path.join(DIR, f));
		for (const s of [].concat(suites)) {
			const t = makeT();
			let threw = null;
			try { await s.fn(t); } catch (e) { threw = e; }
			console.log('\n' + s.name + '   [' + f + ']');
			for (const r of t.results) {
				if (r.note !== undefined) { console.log('      ' + r.note); continue; }
				total++;
				if (r.ok) { console.log('  PASS  ' + r.name); }
				else {
					failed++;
					console.log('  FAIL  ' + r.name);
					console.log('        got  ' + JSON.stringify(r.got));
					console.log('        want ' + JSON.stringify(r.want));
				}
			}
			if (threw) {
				failed++; total++;
				console.log('  THREW ' + (threw && threw.stack ? threw.stack.split('\n').slice(0, 3).join('\n        ') : threw));
			}
		}
	}
	/* ONE GATE, even though the bridge is Python. Tests/bridge/*.py imports
	   the committed Codex/market_bridge.py and calls the real functions -
	   the same "never copy the subject" rule this harness keeps, reached by
	   a different route, because lifting JS into a vm cannot touch Python
	   and porting the predicate across would break exactly that rule.
	   Shelled out rather than ported, and SKIPPED rather than failed when
	   python3 is absent: a missing interpreter is not a failing test, and
	   reporting it as one would train people to ignore a red run. */
	const py = fs.existsSync(path.join(DIR, 'bridge'))
		? fs.readdirSync(path.join(DIR, 'bridge')).filter((f) => /^test_.*\.py$/.test(f)).sort()
		: [];
	for (const f of py) {
		if (want.length && !want.some((w) => f.includes(w) || 'bridge'.includes(w))) continue;
		const r = spawnSync('python3', [path.join(DIR, 'bridge', f)], { encoding: 'utf8' });
		if (r.error && r.error.code === 'ENOENT') {
			console.log('\n' + f + '   [SKIPPED - python3 not on PATH]');
			continue;
		}
		const out = (r.stdout || '').trim();
		console.log('\n' + f + '   [python]');
		for (const line of out.split('\n')) if (line) console.log('  ' + line);
		if (r.stderr && r.stderr.trim()) console.log('  ' + r.stderr.trim().split('\n').join('\n  '));
		/* Its own count, folded in, so the final line is the whole gate. */
		const m = /PASS (\d+)\s+FAIL (\d+)/.exec(out);
		if (m) { total += Number(m[1]) + Number(m[2]); failed += Number(m[2]); }
		else { total++; failed++; console.log('  (could not read a PASS/FAIL count - treating as a failure)'); }
	}

	console.log('\n' + (failed ? `${failed} FAILED of ${total}` : `all ${total} pass`));
	process.exit(failed ? 1 : 0);
})();
