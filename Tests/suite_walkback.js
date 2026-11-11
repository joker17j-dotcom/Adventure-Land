/* The walk back after a death, and stuck in a wall - Ranger v165 / Priest v92
   / Mage v115, 2026-11-11.

   The operator's ruling of 11:30-11:31 EST: a respawned member holds fire on
   its way back until it is with the party (the cohesion leash); if it dies
   again before that, the living members go to where it died and wait for it;
   a walk a death interrupted is not a failed travel attempt. And the browser
   session's 2026-11-09 read of Dexon in a wall: pathfinder throws, a walled-in
   position, or no kill of his own while the party kills -> stop and use town.

   The block is lifted from Party/Ranger.js and checked byte-identical in the
   other two, so every behavioural assertion here covers all three. */

const { lift, world, extract } = require('./lift');
const fs = require('fs');
const path = require('path');

const FILES = ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js'];
const NAMES = ['WALKBACK', 'WALLSTUCK', 'walkBack', 'wallStuck', 'walkBackHoldsFire', 'walkBackWithParty', 'walkRallyTell',
	'walkRallyEnd', 'walkBackTick', 'walkBackDeathInterrupted', 'walkRallyGo', 'walkBackMove', 'walkBackOnCall',
	'wallStuckOnError', 'wallStuckOnHit', 'wallStuckHook', 'wallStuckTown', 'wallStuckTick', 'walkBackAndStuckTick',
	'TOWN_CHANNEL', 'townCast', 'useTown', 'townChannelHeld', 'townLandTick'];

function src(f) { return fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); }
/* The block from its banner to on_cm, verbatim. */
function block(f) {
	const s = src(f);
	const a = s.indexOf('/* ---------------------------------------------------------------------------\n   AFTER A DEATH, AND STUCK IN A WALL');
	const b = s.indexOf('\nfunction on_cm(name, data) {');
	return a >= 0 && b > a ? s.slice(a, b) : '';
}

function mk(o = {}) {
	const w = world({
		character: Object.assign({ name: 'Dexon', ctype: 'ranger', map: 'halloween', real_x: 0, real_y: 0, x: 0, y: 0, rip: false, moving: false }, o.character || {}),
		parent: Object.assign({ entities: {}, party: {}, server_region: 'US', server_identifier: 'II' }, o.parent || {}),
	});
	w.T = 1000000;
	w.Date = { now: () => w.T };
	w.sent = []; w.plSend = (to, p) => w.sent.push([to, p]);
	w.lines = []; w.game_log = (m, c) => w.lines.push([String(m), c]);
	w.smart = { moving: false };
	w.travelState = { startedAt: 0, failures: 0, inFlight: false };
	w.cancels = 0; w.travelCancel = () => { w.cancels++; return true; };
	w.moves = []; w.safeSmartMove = (d) => { w.moves.push(d); return Promise.resolve(); };
	w.homes = 0; w.handleReturnHome = () => { w.homes++; };
	w.destination = o.destination === undefined ? { map: 'halloween', x: 1000, y: 0 } : o.destination;
	w.walkRally = null; w.walkRallyFlight = false;
	w.stops = []; w.stop = (k) => w.stops.push(k);
	w.skills = []; w.use_skill = (s) => { w.skills.push(s); return Promise.resolve(); };
	w.can_move_to = o.can_move_to || (() => true);
	w.bossState = { trip: null };
	lift(w, 'Party/Ranger.js', NAMES);
	return w;
}
const member = (x, y, extra) => Object.assign({ real_x: x, real_y: y, x: x, y: y }, extra || {});

module.exports = [
	{
		name: 'the block is byte-identical in all three party scripts',
		fn(t) {
			const r = block('Party/Ranger.js');
			t.ok('precondition: the Ranger block was found', r.length > 3000);
			for (const f of ['Party/Priest.js', 'Party/Mage.js']) t.eq(f + ' carries the same block', block(f) === r, true);
		},
	},
	{
		name: '(a) a respawned member holds fire until every living member in view is inside the leash',
		fn(t) {
			const party = { MageofOz: {}, FatherToken: {} };
			const w = mk({ parent: { party: party } });
			w.walkBackTick();
			t.eq('alive, never died: not holding', w.walkBackHoldsFire(), false);
			w.character.rip = true; w.walkBackTick();
			t.eq('dead: no rally on a first death (nothing was held)', w.sent.length, 0);
			w.T += 10000; w.character.rip = false; w.walkBackTick();
			t.eq('respawned: holding fire', w.walkBackHoldsFire(), true);
			t.ok('and it says so', /respawned - holding fire/.test(w.lines[w.lines.length - 1][0]));
			w.parent.entities = { MageofOz: member(100, 0), FatherToken: member(400, 0) };
			w.walkBackTick();
			t.eq('one member past the leash: still holding', w.walkBackHoldsFire(), true);
			w.parent.entities.FatherToken = member(150, 0);
			w.walkBackTick();
			t.eq('both inside 150: firing again', w.walkBackHoldsFire(), false);
			t.ok('with a line', /back with the party - firing again/.test(w.lines[w.lines.length - 1][0]));

			const x = mk({ parent: { party: party, entities: { MageofOz: member(10, 0) } } });
			x.walkBack.holding = true;
			t.eq('a party member out of view is not "with the party"', x.walkBackWithParty(), false);
			x.parent.party.FatherToken = { rip: true };
			t.eq('one out of view the party marks dead: does not count', x.walkBackWithParty(), true);
			x.parent.party = { MageofOz: {} };
			x.parent.entities = { MageofOz: member(10, 0), FatherToken: member(900, 0) };
			t.eq('a member not in parent.party (another shard): does not count', x.walkBackWithParty(), true);
			x.parent.party = { MageofOz: {}, FatherToken: {} };
			x.parent.entities = { MageofOz: member(10, 0), FatherToken: member(900, 0, { rip: true }) };
			t.eq('one in view and dead: does not count', x.walkBackWithParty(), true);

			const y = mk({ parent: { party: party } });
			y.walkBack.holding = true; y.walkBack.since = y.T;
			y.T += y.WALKBACK.maxHoldMs; y.walkBackTick();
			t.eq('precondition: at maxHoldMs still holding', y.walkBackHoldsFire(), true);
			y.T += 1; y.walkBackTick();
			t.eq('past maxHoldMs: firing again', y.walkBackHoldsFire(), false);
			t.eq('in orange', y.lines[y.lines.length - 1][1], 'orange');
			const z = mk(); z.walkBack.holding = true; z.character.rip = true;
			t.eq('dead: never "holding fire" (nothing to fire)', z.walkBackHoldsFire(), false);
		},
	},
	{
		name: '(a) walking back goes on past farm monsters, to the farm or its own rally',
		fn(t) {
			let w = mk();
			t.eq('not holding, no rally: movement is the script\'s', w.walkBackMove(), false);
			w.walkBack.holding = true;
			t.eq('holding, far from the farm: it owns movement', w.walkBackMove(), true);
			t.eq('and walks home', w.homes, 1);
			w.character.real_x = 900;
			t.eq('holding, inside the leash of the farm: the script\'s again (cohesion closes the rest)', w.walkBackMove(), false);
			w = mk({ destination: null }); w.walkBack.holding = true;
			t.eq('no farm yet: the script\'s', w.walkBackMove(), false);
			w = mk(); w.walkBack.holding = true;
			w.walkRally = { for: 'Dexon', map: 'halloween', x: -500, y: 20, at: w.T };
			t.eq('holding with my own rally: it owns movement', w.walkBackMove(), true);
			t.eq('toward the rally spot, not the farm', [w.homes, JSON.stringify(w.moves[0])].join(), '0,' + JSON.stringify({ map: 'halloween', x: -500, y: 20 }));
			t.eq('cancelling the farm trip first', w.cancels, 1);
		},
	},
	{
		name: '(b) a second death before rejoining asks the party to come to where it died',
		fn(t) {
			const w = mk({ parent: { party: { MageofOz: {}, FatherToken: {} } } });
			w.character.rip = true; w.walkBackTick(); w.character.rip = false; w.walkBackTick();
			t.eq('precondition: holding after the first respawn', w.walkBackHoldsFire(), true);
			w.character.real_x = -480; w.character.real_y = 33; w.walkBackTick();
			w.character.rip = true; w.T += 5000; w.walkBackTick();
			t.eq('both followers told', w.sent.map((s) => s[0]).join(), 'MageofOz,FatherToken');
			t.eq('with the last live spot', JSON.stringify(w.sent[0][1]), JSON.stringify({ message: 'walkback_rally', for: 'Dexon', map: 'halloween', x: -480, y: 33 }));
			t.eq('and a rally of its own to walk to', [w.walkRally.for, w.walkRally.x].join(), 'Dexon,-480');
			w.walkBackTick();
			t.eq('one message per death, not per tick', w.sent.length, 2);
			w.character.rip = false; w.walkBackTick();
			w.parent.entities = { MageofOz: member(-470, 30), FatherToken: member(-500, 40) };
			w.character.real_x = -480; w.walkBackTick();
			t.eq('rejoined at the rally: rally over', w.walkRally, null);
			t.eq('and the others are told it is over', JSON.stringify(w.sent.slice(2).map((s) => [s[0], s[1].message, s[1].for])),
				JSON.stringify([['MageofOz', 'walkback_rally_end', 'Dexon'], ['FatherToken', 'walkback_rally_end', 'Dexon']]));

			const r = mk({ character: { name: 'MageofOz', ctype: 'mage' } });
			r.walkBackOnCall('Dexon', { message: 'walkback_rally', for: 'Dexon', map: 'halloween', x: -480, y: 33, _plshard: { region: 'US', name: 'II' } });
			t.eq('a follower takes the rally', [r.walkRally && r.walkRally.for, r.walkRally && r.walkRally.x].join(), 'Dexon,-480');
			t.eq('and goes there, though it never died', [r.walkBackMove(), JSON.stringify(r.moves[0])].join(), 'true,' + JSON.stringify({ map: 'halloween', x: -480, y: 33 }));
			r.walkRallyFlight = false; r.character.real_x = -470; r.character.real_y = 30;
			t.eq('at the spot: still owns movement (waits), no second walk', [r.walkBackMove(), r.moves.length].join(), 'true,1');
			r.walkBackOnCall('Dexon', { message: 'walkback_rally_end', for: 'Dexon' });
			t.eq('the end message clears it', [r.walkRally, r.walkBackMove()].join(), ',false');

			const g = mk({ character: { name: 'MageofOz', ctype: 'mage' } });
			g.walkBackOnCall('Meltymerch', { message: 'walkback_rally', for: 'Meltymerch', map: 'main', x: 0, y: 0 });
			t.eq('not a party member: ignored', g.walkRally, null);
			g.walkBackOnCall('FatherToken', { message: 'walkback_rally', for: 'Dexon', map: 'main', x: 0, y: 0 });
			t.eq('a rally for someone other than its sender: ignored', g.walkRally, null);
			g.walkBackOnCall('Dexon', { message: 'walkback_rally', for: 'Dexon', map: 'main', x: 0, y: 0, _plshard: { region: 'EU', name: 'I' } });
			t.eq('from another shard: ignored', g.walkRally, null);
			g.walkBackOnCall('Dexon', { message: 'walkback_rally', for: 'Dexon', map: 'main', x: 'a', y: 0 });
			t.eq('a malformed spot: ignored', g.walkRally, null);
			g.walkBackOnCall('Dexon', { message: 'walkback_rally', for: 'Dexon', map: 'main', x: 0, y: 0 });
			g.walkBackOnCall('FatherToken', { message: 'walkback_rally_end', for: 'FatherToken' });
			t.eq('another member\'s end does not clear it', g.walkRally && g.walkRally.for, 'Dexon');
			g.T += g.WALKBACK.rallyMaxMs + 1; g.walkBackTick();
			t.eq('a rally its member never ends lapses', g.walkRally, null);
		},
	},
	{
		name: '(c) a death-interrupted walk is not a failed travel attempt',
		fn(t) {
			const w = mk();
			w.travelState.startedAt = w.T;
			t.eq('alive, no death since the attempt: counts', w.walkBackDeathInterrupted(), false);
			w.character.rip = true;
			t.eq('dead: does not count', w.walkBackDeathInterrupted(), true);
			w.walkBackTick(); w.character.rip = false;
			t.eq('died during the attempt, now up: does not count', w.walkBackDeathInterrupted(), true);
			w.T += 1000; w.travelState.startedAt = w.T;
			t.eq('a later attempt: counts again', w.walkBackDeathInterrupted(), false);
			for (const f of FILES) {
				const body = extract(f, 'noteTravelFailure');
				t.ok(f + ': noteTravelFailure returns on it before counting', /if \(walkBackDeathInterrupted\(\)\) \{[\s\S]*?return;\n\t\}[\s\S]*travelState\.failures\+\+/.test(body));
			}
		},
	},
	{
		name: 'every attack path holds fire, heals do not',
		fn(t) {
			const r = src('Party/Ranger.js'), p = src('Party/Priest.js'), m = src('Party/Mage.js');
			t.ok('Ranger handleAttack opens with it', /const handleAttack = async \(\) => \{\n[^\n]*\n\tif \(walkBackHoldsFire\(\)\) return;/.test(r));
			t.ok('Ranger skillLoop (huntersmark, supershot) skips on it', /const skillLoop = async \(\) => \{[\s\S]{0,300}if \(walkBackHoldsFire\(\)\) return setTimeout\(skillLoop, 250\);/.test(r));
			t.ok('Priest attack skips on it, after the heal', /const healed = await noHang\(tryHeal\(\)[\s\S]{0,200}!walkBackHoldsFire\(\)\) await noHang\(use_skill\('attack'/.test(p));
			t.ok('Priest curse and both zaps skip on it', /CONFIG\.combat\.curse && !holdFire/.test(p) && /zapper && state\.current === 'idle' && !holdFire/.test(p) && /zapSpam\?\.enabled && state\.current === 'idle' && !holdFire/.test(p));
			t.ok('Mage attack and burst skip on it', /smart\.moving \|\| walkBackHoldsFire\(\)\) \{\n\t\t\treturn setTimeout\(actionLoop/.test(m));
			for (const [f, s] of [['Party/Ranger.js', r], ['Party/Priest.js', p], ['Party/Mage.js', m]]) {
				t.ok(f + ': the rage pull does not fire either', /if \(ragePullActive\(\) && !walkBackHoldsFire\(\)\) ragePullTick\(\)/.test(s));
				const main = extract(f, 'mainLoop');
				t.ok(f + ': mainLoop ticks it first, ahead of every early return', /^async function mainLoop\(\) \{\n\ttry \{\n\t\twalkBackAndStuckTick\(\);/.test(main));
				t.ok(f + ': the movement branch asks it before the farm', /if \(walkBackMove\(\)\) \{[\s\S]{0,120}\} else if \(!get_nearest_monster\(\{ type: home \}\)/.test(main));
				t.ok(f + ': on_cm routes both messages to it', /data\.message === 'walkback_rally' \|\| data\.message === 'walkback_rally_end'\) \{ walkBackOnCall\(name, data\); return; \}/.test(extract(f, 'on_cm')));
			}
		},
	},
	{
		name: 'stuck in a wall: pathfinder throws, walled in, or no kills of my own -> stop and town',
		fn(t) {
			let w = mk();
			w.wallStuckTick();
			t.eq('precondition: nothing stuck, nothing done', [w.skills.length, w.stops.length].join(), '0,0');
			w.wallStuckOnError({ message: 'Uncaught RangeError: Too many properties to enumerate' });
			w.wallStuckOnError({ message: 'TypeError: x is undefined' });
			w.wallStuckOnError({ error: { message: 'Too many properties to enumerate' } });
			w.T += 1000; w.wallStuckTick();
			t.eq('two pathfinder throws: not yet', w.skills.length, 0);
			w.wallStuckOnError({ message: 'RangeError: Too many properties to enumerate' });
			w.T += 1000; w.wallStuckTick();
			t.eq('three in the window: town', w.skills, ['use_town']);
			t.eq('after stopping the walk', [w.cancels, w.stops.join()].join(), '1,smart,move');
			t.ok('with a red line', /\[stuck\] the pathfinder threw 3x/.test(w.lines[w.lines.length - 1][0]) && w.lines[w.lines.length - 1][1] === 'red');
			for (let i = 0; i < 3; i++) w.wallStuckOnError({ message: 'RangeError' });
			w.T += 1000; w.wallStuckTick();
			t.eq('not again inside townGapMs', w.skills.length, 1);

			w = mk();
			w.T += 1000; w.wallStuckOnError({ message: 'RangeError' }); w.wallStuckOnError({ message: 'RangeError' });
			w.T += w.WALLSTUCK.errWindowMs + 1000; w.wallStuckOnError({ message: 'RangeError' }); w.wallStuckTick();
			t.eq('throws spread past the window: no town', w.skills.length, 0);

			let open = false;
			w = mk({ can_move_to: () => open });
			for (let i = 0; i < 2; i++) { w.T += 1000; w.wallStuckTick(); }
			t.eq('walled in for two checks: not yet', w.skills.length, 0);
			w.T += 1000; w.wallStuckTick();
			t.eq('three: town', w.skills, ['use_town']);
			w = mk({ can_move_to: () => open });
			w.T += 1000; w.wallStuckTick(); w.T += 1000; w.wallStuckTick();
			open = true; w.T += 1000; w.wallStuckTick(); open = false;
			w.T += 1000; w.wallStuckTick(); w.T += 1000; w.wallStuckTick();
			t.eq('an open step resets the count', w.skills.length, 0);
			w = mk({ can_move_to: () => false }); w.smart.moving = true;
			for (let i = 0; i < 5; i++) { w.T += 1000; w.wallStuckTick(); }
			t.eq('not judged while walking', w.skills.length, 0);
			w = mk({ can_move_to: () => false }); w.character.map = 'jail';
			for (let i = 0; i < 5; i++) { w.T += 1000; w.wallStuckTick(); }
			t.eq('not in jail', w.skills.length, 0);
			w = mk({ can_move_to: () => false }); w.character.rip = true;
			for (let i = 0; i < 5; i++) { w.T += 1000; w.wallStuckTick(); }
			t.eq('not dead', w.skills.length, 0);
			let calls = 0;
			w = mk({ can_move_to: () => { calls++; return false; } });
			w.wallStuckTick(); w.T += 500; w.wallStuckTick();
			t.eq('checked once per everyMs, not every tick', calls, 8);
		},
	},
	{
		name: 'no kill of my own for noKillMs while the party kills -> town',
		fn(t) {
			const kills = (w, n, who) => { for (let i = 0; i < n; i++) w.wallStuckOnHit({ hid: who, kill: true }); };
			let w = mk();
			w.wallStuckTick();
			t.eq('precondition: the hook starts the clock', w.wallStuck.ownKillAt, w.T);
			w.T += w.WALLSTUCK.noKillMs; kills(w, 5, 'FatherToken'); w.wallStuck.checkedAt = 0;
			w.wallStuckTick();
			t.eq('noKillMs with 5 party kills: town', w.skills, ['use_town']);
			t.ok('naming the count', /no kill of my own in 6 min while the party made 5/.test(w.lines[w.lines.length - 1][0]));

			w = mk(); w.wallStuckTick();
			w.T += w.WALLSTUCK.noKillMs; kills(w, 4, 'MageofOz'); w.wallStuck.checkedAt = 0; w.wallStuckTick();
			t.eq('four party kills: not yet', w.skills.length, 0);
			w = mk(); w.wallStuckTick();
			w.T += 60000; kills(w, 5, 'MageofOz'); w.T += w.WALLSTUCK.noKillMs; w.wallStuck.checkedAt = 0; w.wallStuckTick();
			t.eq('the party\'s last kill is stale: not yet', w.skills.length, 0);
			w = mk(); w.wallStuckTick();
			w.T += w.WALLSTUCK.noKillMs; kills(w, 5, 'MageofOz'); w.wallStuckOnHit({ hid: 'Dexon', kill: true }); kills(w, 4, 'MageofOz');
			w.wallStuck.checkedAt = 0; w.wallStuckTick();
			t.eq('a kill of my own resets it', w.skills.length, 0);
			w = mk(); w.wallStuckTick();
			w.T += w.WALLSTUCK.noKillMs; kills(w, 5, 'Somebody'); w.wallStuckOnHit({ hid: 'MageofOz', kill: false }); w.wallStuck.checkedAt = 0; w.wallStuckTick();
			t.eq('kills by a stranger, and a hit that killed nothing: not party kills', w.skills.length, 0);
			w = mk({ character: { name: 'FatherToken', ctype: 'priest' } }); w.wallStuckTick();
			w.T += w.WALLSTUCK.noKillMs; kills(w, 9, 'Dexon'); w.wallStuck.checkedAt = 0; w.wallStuckTick();
			t.eq('a priest: never on kills', w.skills.length, 0);
			w = mk(); w.wallStuckTick(); w.bossState.trip = { name: 'franky' };
			w.T += w.WALLSTUCK.noKillMs; kills(w, 9, 'MageofOz'); w.wallStuck.checkedAt = 0; w.wallStuckTick();
			t.eq('on a boss trip: never on kills', w.skills.length, 0);
			w = mk(); w.wallStuckTick(); w.walkBack.holding = true;
			w.T += w.WALLSTUCK.noKillMs; kills(w, 9, 'MageofOz'); w.wallStuck.checkedAt = 0; w.wallStuckTick();
			t.eq('holding fire on the walk back: never on kills', w.skills.length, 0);
		},
	},
	{
		name: 'the hit hook is installed once and replaces a previous page\'s',
		fn(t) {
			const w = mk();
			const on = [], off = [];
			const old = () => {};
			w.parent.__wallStuckHit = old;
			w.parent.socket = { on: (e, f) => on.push([e, f]), off: (e, f) => off.push([e, f]) };
			w.wallStuckHook(); w.wallStuckHook();
			t.eq('one listener added', on.length, 1);
			t.eq('the old one taken off first', off.length === 1 && off[0][1] === old, true);
			on[0][1]({ hid: 'Dexon', kill: true });
			t.eq('and it feeds the kill clock', w.wallStuck.ownKillAt, w.T);
		},
	},
];

module.exports.push(
	{
		name: 'v166: our own town channel holds every loop, and a cast that did not land is said',
		fn(t) {
			let w = mk();
			t.eq('precondition: nothing cast, no channel: not held', w.townChannelHeld(), false);
			w.useTown('a test');
			t.eq('useTown casts use_town', w.skills, ['use_town']);
			t.eq('and stamps where from', [w.townCast.at === w.T, w.townCast.map, w.townCast.why].join(), 'true,halloween,a test');
			t.eq('held at once, before the client sees the channel', w.townChannelHeld(), true);
			w.T += w.TOWN_CHANNEL.graceMs;
			t.eq('not held at graceMs with no channel seen', w.townChannelHeld(), false);
			w.character.c = { town: { ms: 1200 } };
			t.eq('held while the game shows the channel, whatever the clock', w.townChannelHeld(), true);
			w.character.c = {};

			w = mk(); w.useTown('x');
			w.T += w.TOWN_CHANNEL.landCheckMs - 1; w.townLandTick(w.T);
			t.eq('not judged before landCheckMs', w.lines.length, 0);
			w.T += 1; w.townLandTick(w.T);
			t.ok('still on the cast spot at landCheckMs: an orange line', w.lines.length === 1 && w.lines[0][1] === 'orange' && /town cast for x did not land/.test(w.lines[0][0]));
			w.T += 10000; w.townLandTick(w.T);
			t.eq('said once', w.lines.length, 1);
			w = mk(); w.useTown('x'); w.character.real_x = 500;
			w.T += w.TOWN_CHANNEL.landCheckMs; w.townLandTick(w.T);
			t.eq('moved: landed, nothing said', w.lines.length, 0);
			w = mk(); w.useTown('x'); w.character.map = 'main';
			w.T += w.TOWN_CHANNEL.landCheckMs; w.townLandTick(w.T);
			t.eq('another map: landed', w.lines.length, 0);
			w = mk(); w.useTown('x'); w.character.c = { town: { ms: 500 } };
			w.T += w.TOWN_CHANNEL.landCheckMs; w.townLandTick(w.T);
			t.eq('still channelling: not judged yet', [w.lines.length, w.townCast.at > 0].join(), '0,true');

			w = mk();
			w.wallStuckOnError({ message: 'RangeError' }); w.wallStuckOnError({ message: 'RangeError' }); w.wallStuckOnError({ message: 'RangeError' });
			w.T += 1000; w.wallStuckTick();
			t.eq('the wall-stuck town goes through useTown', [w.skills.join(), w.townChannelHeld()].join(), 'use_town,true');

			for (const f of FILES) {
				const s = src(f);
				t.eq(f + ': use_skill(\'use_town\') only inside useTown', (s.match(/use_skill\('use_town'\)/g) || []).length, 1);
				t.ok(f + ': useTown holds it', /function useTown\(why\) \{[\s\S]{0,200}return use_skill\('use_town'\);/.test(s));
				t.ok(f + ': mainLoop stands down', /walkBackAndStuckTick\(\);\n[^\n]*\n\t\tif \(townChannelHeld\(\)\) return setTimeout\(mainLoop, 250\);/.test(s));
				t.ok(f + ': actionLoop stands down', /if \(townChannelHeld\(\)\) return setTimeout\(actionLoop, 100\);/.test(s));
				t.ok(f + ': skillLoop stands down', /if \(townChannelHeld\(\)\) return setTimeout\(skillLoop, 250\);/.test(s));
				t.ok(f + ': potionLoop stands down above potionBelow', /if \(townChannelHeld\(\) && character\.hp >= character\.max_hp \* TOWN_CHANNEL\.potionBelow\) return setTimeout\(potionLoop, 250\);/.test(s));
				t.ok(f + ': maintenanceLoop stands down, respawn excepted', /if \(townChannelHeld\(\) && !character\.rip\) return setTimeout\(maintenanceLoop, TICK_RATE\.maintenance\);/.test(s));
				t.ok(f + ': rageStuckTown and the escape ladder use it', /await useTown\('rage stuck'\)/.test(s) && /await useTown\('rage escape'\)/.test(s));
				t.ok(f + ': the land check rides the per-tick hook', /townLandTick\(Date\.now\(\)\)/.test(extract(f, 'walkBackAndStuckTick')));
			}
			const r = src('Party/Ranger.js');
			t.ok('Ranger equipmentLoop stands down', /if \(townChannelHeld\(\)\) return setTimeout\(equipmentLoop, delay\);/.test(r));
			t.ok('Ranger monster hunt and trick-or-treat ticks stand down', /setInterval\(\(\) => \{\n\tif \(townChannelHeld\(\)\) return;\n\tmhTick\(\)/.test(r) && /setInterval\(\(\) => \{\n\tif \(townChannelHeld\(\)\) return;\n\ttotTick\(\)/.test(r));
		},
	},
);
