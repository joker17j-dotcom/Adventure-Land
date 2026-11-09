/* A cm body is another player's text. - 2026-11-08.

   BillGates sent all three characters a cm whose body was an HTML <script>
   that would have pm'd from our characters, aimed at any script that writes
   a cm body into the log as HTML. The party scripts' log filter renders
   server game_log lines with innerHTML, so the line the probe was looking
   for is a game_log of message content. None of ours does it: every cm
   handler gates on the sender first. This suite holds that.

   THE RULE: inside a cm handler, any logging call or innerHTML write that
   carries message content (`data.` / `d.message`) must sit after a sender
   gate - either inside a block whose opener tests the sender, or below an
   early `return` at the top level of the handler that does. The handlers are
   DERIVED: every tracked .js declaring on_cm, plus the three relay entry
   points (bossOnCall, rageEntryOnCall, rageTownOnCall) wherever they exist,
   plus CaveRun's character.on('cm') listener. */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { extract, ROOT } = require('./lift');

const SENDER = /\bname\s*[!=]==?\s*['"]|\bfrom\s*[!=]==?\s*|includes\(name\)|indexOf\(name\)|indexOf\(from\)|d\.name\s*[!=]==?/;
const LOGS = /(game_log|\blog|add_log|plLog|bossLog|bossNote|clog|safe_log)\s*\(|innerHTML/;
const CONTENT = /\bdata\.|\bd\.message\b/;

/* Every line of `body` that logs message content and is not behind a sender
   gate. Braces are counted outside strings and comments, which is enough for
   these bodies: `${...}` in a template opens and closes on one line. */
function ungated(body) {
	const lines = body.split('\n');
	const stack = [];       // opener line text per open brace
	let topGate = false;    // a top-level `if (<sender test>) return` seen
	const bad = [];
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		const l = raw.replace(/\/\/.*$/, '').replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""');
		if (i > 0 && LOGS.test(l) && CONTENT.test(l)) {
			const gated = topGate || stack.slice(1).some((o) => SENDER.test(o));
			if (!gated) bad.push(raw.trim());
		}
		if (stack.length === 1 && SENDER.test(l) && /\breturn\b/.test(l)) topGate = true;
		for (const ch of l) {
			if (ch === '{') stack.push(l);
			else if (ch === '}') stack.pop();
		}
	}
	return bad;
}

function handlers() {
	const out = [];
	const files = execSync('git ls-files "*.js"', { cwd: ROOT }).toString().split('\n')
		.filter((f) => f && !/^Tests\//.test(f));
	for (const f of files) {
		const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
		for (const fn of ['on_cm', 'bossOnCall', 'rageEntryOnCall', 'rageTownOnCall']) {
			if (new RegExp('^function ' + fn + '\\s*\\(', 'm').test(src)) out.push({ f, fn, body: extract(f, fn) });
		}
	}
	return out;
}

module.exports = [
	{
		name: 'the scanner itself - a gate is recognised, an ungated log is not',
		fn(t) {
			t.eq('ungated log of data is caught', ungated('function on_cm(name, data) {\n\tgame_log(data.message);\n}'),
				['game_log(data.message);']);
			t.eq('a top-level sender return gates it', ungated('function on_cm(name, data) {\n\tif (name !== "Dexon") return;\n\tgame_log(data.message);\n}'), []);
			t.eq('an enclosing sender block gates it', ungated('function on_cm(name, data) {\n\tif (name === "Dexon") {\n\t\tgame_log(`x ${data.home}`);\n\t}\n}'), []);
			t.eq('a non-sender block does not', ungated('function on_cm(name, data) {\n\tif (data.message === "x") {\n\t\tgame_log(`x ${data.home}`);\n\t}\n}'),
				['game_log(`x ${data.home}`);']);
			t.eq('a gate AFTER the log does not count', ungated('function on_cm(name, data) {\n\tgame_log(data.x);\n\tif (name !== "Dexon") return;\n}'), ['game_log(data.x);']);
			t.eq('a gate inside a nested block does not gate the top level', ungated('function on_cm(name, data) {\n\tif (data.a) {\n\t\tif (name !== "Dexon") return;\n\t}\n\tgame_log(data.x);\n}'), ['game_log(data.x);']);
		},
	},
	{
		name: 'every cm handler gates on the sender before logging message content',
		fn(t) {
			const hs = handlers();
			t.that('the derived set holds the four party on_cm handlers', ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js', 'Party/Merchant.js']
				.every((f) => hs.some((h) => h.f === f && h.fn === 'on_cm')), hs.map((h) => h.f + ':' + h.fn));
			t.that('and the relay entry points on all three combat scripts', hs.filter((h) => h.fn !== 'on_cm').length >= 9, hs.length);
			for (const h of hs) t.eq(h.f + ' ' + h.fn + ': no ungated log of message content', ungated(h.body), []);
		},
	},
	{
		name: "CaveRun's cm listener tests the leader before it acts on the body",
		fn(t) {
			const src = fs.readFileSync(path.join(ROOT, 'CaveRun.js'), 'utf8');
			const at = src.indexOf("character.on('cm'");
			t.that('the listener exists', at > 0, at);
			const body = src.slice(at, src.indexOf('\n\t});', at));
			const gate = body.indexOf('d.name !== leaderName()');
			t.that('a leader gate', gate > 0, gate);
			t.that('the gate precedes the first log', gate < body.indexOf("ev('cm'"), [gate, body.indexOf("ev('cm'")]);
			t.that('no innerHTML or game_log of the body', !/innerHTML|game_log\([^)]*d\.message/.test(body), body.length);
		},
	},
];
