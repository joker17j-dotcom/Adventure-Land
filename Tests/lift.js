/* Tests/lift.js - the machinery every suite in here needs.

   WHY THIS EXISTS. CLAUDE.md's Testing section says there is no harness and
   that both missing-helper bugs - the get_entities throw that left three
   rangers idle for hours, and the ms_to_next_skill catch that made every
   FamilyFleet cooldown answer "ready" - were invisible to reading and
   obvious the instant anything executed. Neither is reachable by a static
   check; both are reachable by running the function once.

   WHAT IT DOES. Lifts a named function or object literal straight out of a
   COMMITTED character script and runs it in a vm context against stubs. The
   code under test is never copied, edited or re-indented - a suite that
   passes is a statement about the file that ships, not about a transcription
   of it.

   THE BRACE MATCHER IS THE POINT. Seven throwaway versions of this were
   written on 2026-10-18 and two of them had counting bugs that cost a round
   trip each: one matched a literal ' };' line and spun forever when the file
   used '};', the other counted braces inside strings. This one ignores
   braces in strings, template literals, regex-ish slashes and comments, so
   it cannot be fooled by a brace in a log message. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* Walk the source from `from`, returning the index just past the brace that
   closes the first '{' at or after it. Braces inside strings, template
   literals and comments are not counted. */
function matchBraces(src, from) {
	let i = from, depth = 0, started = false;
	while (i < src.length) {
		const c = src[i], n = src[i + 1];
		if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
		if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
		if (c === '"' || c === "'" || c === '`') {
			const q = c; i++;
			while (i < src.length) {
				if (src[i] === '\\') { i += 2; continue; }
				if (src[i] === q) { i++; break; }
				/* ${ ... } inside a template can itself hold braces and
				   strings; recurse rather than guess. */
				if (q === '`' && src[i] === '$' && src[i + 1] === '{') { i = matchBraces(src, i + 1); continue; }
				i++;
			}
			continue;
		}
		if (c === '{') { depth++; started = true; }
		else if (c === '}') { depth--; if (started && depth === 0) return i + 1; }
		i++;
	}
	throw new Error('unterminated block from offset ' + from);
}

function read(file) {
	return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

/* A top-level `function x(`, `async function x(`, or `const x = {`. Anchored
   at column 0 so a nested or quoted mention cannot match. */
function findDecl(src, name) {
	const pats = [
		new RegExp('^async function ' + name + '\\s*\\(', 'm'),
		new RegExp('^function ' + name + '\\s*\\(', 'm'),
		new RegExp('^const ' + name + '\\s*=\\s*\\{', 'm'),
		new RegExp('^(?:const|let|var) ' + name + '\\s*=', 'm'),
	];
	for (const p of pats) {
		const m = p.exec(src);
		if (m) return m.index;
	}
	return -1;
}

/* Source text of one top-level declaration, verbatim. */
function extract(file, name) {
	const src = read(file);
	const at = findDecl(src, name);
	if (at < 0) throw new Error(`${file}: no top-level declaration of \`${name}\``);
	const brace = src.indexOf('{', at);
	if (brace < 0) throw new Error(`${file}: \`${name}\` has no block`);
	return src.slice(at, matchBraces(src, brace));
}

/* Evaluate the named declarations INTO `w`, in the order given. Each is
   rewritten to assign onto globalThis so a `const` at file scope is reachable
   from the suite - the only edit made to any lifted text. */
function lift(w, file, names) {
	for (const name of [].concat(names)) {
		let text = extract(file, name);
		text = text
			.replace(new RegExp('^async function ' + name + '\\b'), 'globalThis.' + name + ' = async function ' + name)
			.replace(new RegExp('^function ' + name + '\\b'), 'globalThis.' + name + ' = function ' + name)
			/* The `=` must be consumed here or a `const x = {` becomes
			   `globalThis.x = = {`. Caught by the suite on first run. */
			.replace(new RegExp('^(?:const|let|var) ' + name + '\\s*='), 'globalThis.' + name + ' =');
		try {
			vm.runInContext(text, w, { filename: `${file}:${name}` });
		} catch (e) {
			throw new Error(`lifting ${name} from ${file}: ${e.message}`);
		}
	}
	return w;
}

/* The world a character script expects. Everything here is a stub a suite can
   overwrite; nothing pretends to be the real game. CODE storage is a real
   round trip through JSON, because that is what the live set/get does and a
   stub that returns the same object reference hides aliasing bugs. */
function world(over = {}) {
	const store = Object.assign({}, over.store || {});
	const logs = [];
	const w = {
		Date, Math, JSON, console, setTimeout, clearTimeout, Promise, RegExp, Error, Object, Array, Number, String, Boolean,
		logs, store,
		sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms || 0, 2))),
		game_log: (m) => { logs.push(String(m)); },
		set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
		get: (k) => (k in store ? JSON.parse(JSON.stringify(store[k])) : null),
		character: Object.assign({
			name: 'Dexon', level: 70, mp: 1000, max_mp: 1000, esize: 20,
			home: 'USII', s: {}, items: [], q: {},
		}, over.character || {}),
		parent: Object.assign({
			server_region: 'US', server_identifier: 'IV',
			G: Object.assign({ skills: {}, events: {}, maps: {}, monsters: {}, conditions: {} }, (over.parent || {}).G || {}),
			S: (over.parent || {}).S || {},
			next_skill: (over.parent || {}).next_skill || {},
		}, over.parent || {}),
	};
	for (const k of Object.keys(over)) {
		if (['character', 'parent', 'store'].includes(k)) continue;
		w[k] = over[k];
	}
	w.globalThis = w;
	/* log() is declared in every character script; suites that do not lift it
	   still need the calls inside lifted code to land somewhere. */
	if (!w.log) w.log = (m) => { logs.push(String(m)); };
	if (!w.bossLog) w.bossLog = (m) => { logs.push(String(m)); };
	if (!w.bossNote) w.bossNote = (m) => { logs.push(String(m)); };
	vm.createContext(w);
	return w;
}

module.exports = { lift, extract, world, matchBraces, ROOT };
