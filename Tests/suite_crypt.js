/* Tests/suite_crypt.js - CaveRun v32, the automated crypt run.

   Everything here is lifted from the committed CaveRun.js. The scalars the
   block declares (CRUN_KEY and the rest) are not liftable - lift() matches
   from the first brace, and a string constant has none - so they are supplied
   in the world and pinned against the source text. */
const fs = require('fs');
const path = require('path');
const { lift, world, ROOT } = require('./lift');
const src = () => fs.readFileSync(path.join(ROOT, 'CaveRun.js'), 'utf8');

const TEAM = ['Dexon', 'FatherToken', 'MageofOz'];
const LIFT = ['CRYPT', 'CRYPT_RUN', 'NAV', 'navGo', 'navHalt', 'navLanded',
	'mayAttack', 'attackingUs', 'crunRead', 'crunWrite', 'crunPatch', 'crunEffective', 'crSay', 'crPos', 'crDist',
	'mluckLeft', 'crInside', 'crMate', 'crKills', 'cryptStage', 'cryptSeeTick', 'cryptOnDeath', 'cryptMayAttack',
	'cryptRunHere', 'cryptAbsorbTarget', 'cryptScareWanted', 'cryptMayRespawn', 'crWalk', 'crGo', 'crHalt',
	'crStraysOnMe', 'cryptKitePoint', 'cryptKiteTick', 'cryptPartyHold', 'crNearest', 'crOnParty', 'cryptLeaderInside',
	'cryptFollowerInside', 'crHoldPlace', 'cryptLeave', 'cryptEnter', 'cryptEnterFailed', 'cryptGate', 'cryptOutside',
	'cryptSelfBeacon', 'cryptMuleList', 'cryptFree', 'cryptMluckLacking', 'cryptTick', 'cryptMoveTick',
	'cryptMuleTick', 'cryptRoomTick', 'cryptMluckTick', 'cryptAskMerchant', 'crSendAll'];

function mkStorage(init) {
	const m = Object.assign({}, init || {});
	return { m: m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
}

/* o: { me, leader, map, x, y, run, beacons, monsters, ents, storage } */
function cw(o) {
	o = o || {};
	const me = o.me || 'FatherToken';
	const leader = o.leader || 'FatherToken';
	const ls = mkStorage(o.storage);
	if (o.run) ls.m.crypt_run = JSON.stringify(o.run);
	const w = world({ TEAM: TEAM, mode: 'crypt', stopped: false, cryptAuto: true, cryptNavOn: true, cryptRelayId: null,
		crunRaw: null, crunMemo: null, crSaid: {}, crSeen: {}, crKite: null, crHolding: false, crHoldSince: 0,
		crSearch: { stage: -1, i: 0, since: 0 }, crVbatEmptySince: 0, crWalkFlight: null, crEnterFlight: 0,
		crMuled: false, crMuleRun: undefined, crMuleSince: 0, crMuleAt: 0, crRoom: true, crPushAt: 0, crAskAt: {}, crMluckSince: 0,
		CRUN_KEY: 'crypt_run', CRYPT_ID_KEY: 'crypt_instance', CRYPT_AUTO_KEY: 'crypt_auto',
		navFlight: null, navManualUntil: 0, navFails: {}, engagedUntil: 0, recovering: false, aim: null,
		CFG: { engageHoldMs: 8000 } });
	w.parent.localStorage = ls;
	w.ls = ls;
	w.character = Object.assign({ name: me, ctype: me === 'FatherToken' ? 'priest' : (me === 'MageofOz' ? 'mage' : 'ranger'),
		map: o.map || 'crypt', in: o.inst === undefined ? 'INST1' : o.inst, real_x: o.x || 0, real_y: o.y || 0, x: o.x || 0, y: o.y || 0,
		rip: !!o.rip, hp: 1000, max_hp: 1000, range: 150, s: {}, items: o.items || [], esize: o.esize === undefined ? 20 : o.esize }, o.character || {});
	w.leaderName = () => leader;
	w.isLeader = () => me === leader;
	w.followers = () => TEAM.filter((n) => n !== leader);
	w.role = () => (me === leader ? 'leader' : 'follower');
	w.beacons = () => JSON.parse(JSON.stringify(o.beacons || {}));
	w.monsters = o.monsters || [];
	w.threats = () => w.monsters;
	w.partyNames = () => TEAM;
	w.caveFriendly = () => false;
	w.here = (e) => !!(e && !e.rip);
	w.inRangeFor = () => true;
	w.dist = (a, b) => Math.hypot((a.real_x !== undefined ? a.real_x : a.x) - (b.real_x !== undefined ? b.real_x : b.x),
		(a.real_y !== undefined ? a.real_y : a.y) - (b.real_y !== undefined ? b.real_y : b.y));
	w.parent.entities = o.ents || {};
	w.allies = () => o.allies || [];
	w.said = [];
	w.clog = (m) => w.said.push(m); w.ev = () => {}; w.bump = () => {};
	w.moves = []; w.stops = 0; w.enters = []; w.sent = []; w.cms = []; w.skills = [];
	w.smart_move = (p) => { w.moves.push(p); return new Promise(() => {}); };
	w.stop = () => { w.stops++; };
	w.move = () => {};
	w.kiteStep = () => null;
	w.noteLeaderMotion = () => {};
	w.enter = (place, id) => { w.enters.push([place, id === undefined ? null : id]); return o.enterResult || new Promise(() => {}); };
	w.locate_item = (n) => (o.hasKey === false ? -1 : (n === 'cryptkey' ? 3 : -1));
	w.send_item = (to, i, q) => w.sent.push([to, i, q]);
	w.send_cm = (to, m) => w.cms.push([to, m]);
	w.get_player = (n) => (o.players || {})[n] || null;
	w.use_skill = (n) => { w.skills.push(n); return Promise.resolve({}); };
	w.get_chests = () => o.chests || {};
	lift(w, 'CaveRun.js', LIFT);
	return w;
}
const R = (over) => Object.assign({ id: 'INST1', dead: {}, cleared: {}, done: false, regroupAll: false }, over || {});
const B = (name, over) => Object.assign({ name: name, t: Date.now(), map: 'crypt', inst: 'INST1', x: 0, y: 0, rip: false,
	mluck: 3600000, muled: true, room: true, kite: false }, over || {});

module.exports = [{

name: 'v32 crypt: the scalars the suite supplies match the source', fn(t) {
	const s = src();
	t.ok('CRUN_KEY', /^const CRUN_KEY = 'crypt_run';$/m.test(s));
	t.ok('CRYPT_ID_KEY is the key the operator reads', /^const CRYPT_ID_KEY = 'crypt_instance';$/m.test(s));
	t.ok('CRYPT_AUTO_KEY', /^const CRYPT_AUTO_KEY = 'crypt_auto';$/m.test(s));
}}, {

name: 'v32 crypt: the stages go a3/a7, then a2, then the seven vbat', fn(t) {
	const w = cw({});
	const st = (dead, cleared) => { const r = w.cryptStage(R({ dead: dead || {}, cleared: cleared || {} })); return r ? r.types.join(',') : null; };
	t.eq('nothing dead: a3 and a7', st(), 'a3,a7');
	t.eq('a3 dead: a7 still first', st({ m1: 'a3' }), 'a7');
	t.eq('a2 dead early does not skip a7', st({ m1: 'a3', m2: 'a2' }), 'a7');
	t.eq('both dead: a2', st({ m1: 'a3', m2: 'a7' }), 'a2');
	const six = { m1: 'a3', m2: 'a7', m3: 'a2' };
	for (let i = 0; i < 6; i++) six['v' + i] = 'vbat';
	t.eq('six vbat: still the vbat', st(six), 'vbat');
	six.v6 = 'vbat';
	t.eq('seven vbat: done', st(six), null);
	t.eq('a box counted clear: done', st({ m1: 'a3', m2: 'a7', m3: 'a2', v0: 'vbat' }, { vbat: true }), null);
}}, {

name: 'v32 crypt: a death seen by three tabs counts once, and only plan monsters on this instance count', fn(t) {
	const w = cw({ run: R(), monsters: [{ id: 'm9', mtype: 'a3' }, { id: 's1', mtype: 'a5' }] });
	w.cryptSeeTick();
	w.cryptOnDeath({ id: 'm9' });
	w.crSeen.m9 = 'a3';          // a second tab saw the same death
	w.cryptOnDeath({ id: 'm9' });
	t.eq('a3 counted once', w.crKills(w.crunRead()).a3, 1);
	w.cryptOnDeath({ id: 's1' });
	t.eq('a stray is not recorded', w.crKills(w.crunRead()).a5, undefined);
	w.cryptOnDeath({ id: 'never-seen' });
	t.eq('an unseen id is not recorded', Object.keys(w.crunRead().dead).length, 1);
	const x = cw({ run: R(), inst: 'OTHER' });
	x.crSeen.m1 = 'a7';
	x.cryptOnDeath({ id: 'm1' });
	t.eq('a death in another instance is not this run’s', Object.keys(x.crunRead().dead).length, 0);
}}, {

name: 'v32 crypt: who may be hit - the stage, a plan monster on the party, a stray only by the one it is on', fn(t) {
	const w = cw({ me: 'Dexon', run: R() });
	t.eq('a6 never, even on me', w.mayAttack({ mtype: 'a6', target: 'Dexon' }), false);
	t.eq('the stage is hunted', w.mayAttack({ mtype: 'a7' }), true);
	t.eq('a later stage is not hunted', w.mayAttack({ mtype: 'vbat' }), false);
	t.eq('but answered once it is on the party', w.mayAttack({ mtype: 'vbat', target: 'MageofOz' }), true);
	t.eq('a stray on me may be hit', w.mayAttack({ mtype: 'a5', target: 'Dexon' }), true);
	t.eq('a stray on a mate is left to the mate', w.mayAttack({ mtype: 'a5', target: 'MageofOz' }), false);
	const x = cw({ me: 'Dexon', run: R() });
	x.cryptAuto = false;
	t.eq('plain crypt mode keeps its own rules: vbat is hunted', x.mayAttack({ mtype: 'vbat' }), true);
	t.eq('and a7 is not', x.mayAttack({ mtype: 'a7' }), false);
}}, {

name: 'v32 crypt: the respawn rule - hold the instance, and the leader respawns last after a wipe', fn(t) {
	const now = Date.now();
	const dead = (n) => B(n, { rip: true });
	let w = cw({ me: 'Dexon', rip: true, run: R(), beacons: { FatherToken: B('FatherToken'), MageofOz: B('MageofOz') } });
	t.eq('a mate inside alive: respawn', w.cryptMayRespawn(now), true);
	w = cw({ me: 'Dexon', rip: true, run: R(), beacons: { FatherToken: B('FatherToken', { map: 'cave' }), MageofOz: B('MageofOz', { map: 'cave' }) } });
	t.eq('nobody else inside: hold', w.cryptMayRespawn(now), false);
	w = cw({ me: 'Dexon', rip: true, run: R(), beacons: { FatherToken: B('FatherToken', { t: now - 60000 }), MageofOz: B('MageofOz', { map: 'cave' }) } });
	t.eq('a stale beacon does not count as inside', w.cryptMayRespawn(now), false);
	w = cw({ me: 'Dexon', rip: true, run: R(), beacons: { FatherToken: B('FatherToken', { inst: 'OLD' }), MageofOz: B('MageofOz', { map: 'cave' }) } });
	t.eq('a mate in another instance does not count', w.cryptMayRespawn(now), false);
	w = cw({ me: 'Dexon', rip: true, run: R(), beacons: { FatherToken: dead('FatherToken'), MageofOz: dead('MageofOz') } });
	t.eq('all three dead: a follower respawns', w.cryptMayRespawn(now), true);
	t.eq('and the wipe is recorded for everyone', w.crunRead().regroupAll, true);
	w = cw({ me: 'FatherToken', rip: true, run: R(), beacons: { Dexon: dead('Dexon'), MageofOz: dead('MageofOz') } });
	t.eq('all three dead: the leader holds', w.cryptMayRespawn(now), false);
	w = cw({ me: 'FatherToken', rip: true, run: R({ regroupAll: true }), beacons: { Dexon: B('Dexon'), MageofOz: B('MageofOz', { map: 'cave' }) } });
	t.eq('after a wipe the leader waits for BOTH followers back inside', w.cryptMayRespawn(now), false);
	w = cw({ me: 'FatherToken', rip: true, run: R({ regroupAll: true }), beacons: { Dexon: B('Dexon'), MageofOz: B('MageofOz') } });
	t.eq('both back inside alive: the leader respawns', w.cryptMayRespawn(now), true);
	w = cw({ me: 'FatherToken', rip: true, run: R(), beacons: { Dexon: B('Dexon'), MageofOz: dead('MageofOz') } });
	t.eq('no wipe: the leader respawns like anyone', w.cryptMayRespawn(now), true);
	w = cw({ me: 'Dexon', rip: true, map: 'cave', run: R(), beacons: {} });
	t.eq('dead outside the crypt: the rule does not apply', w.cryptMayRespawn(now), true);
	w = cw({ me: 'Dexon', rip: true, run: R({ done: true }), beacons: {} });
	t.eq('a finished run does not hold anyone', w.cryptMayRespawn(now), true);
	w = cw({ me: 'Dexon', rip: true, run: R(), beacons: {} });
	w.crHoldSince = now - w.CRYPT_RUN.holdInstanceMaxMs - 1;
	t.eq('held past the bound: respawn anyway', w.cryptMayRespawn(now), true);
	const s = src();
	t.ok('deathTick asks the rule before respawn()', /if \(mode === 'crypt' && !cryptMayRespawn\(Date\.now\(\)\)\) return;[\s\S]{0,1200}respawn\(\);/.test(s));
}}, {

name: 'v32 crypt: the gate to open a run', fn(t) {
	const now = Date.now();
	const door = (n, over) => B(n, Object.assign({ map: 'cave', x: -190, y: -1290 }, over || {}));
	const all = () => ({ Dexon: door('Dexon'), FatherToken: door('FatherToken'), MageofOz: door('MageofOz') });
	const w = cw({ me: 'FatherToken' });
	t.eq('all at the door, mlucked, muled, roomy, key held: open', w.cryptGate(all(), now, true), []);
	t.ok('no key: says so', w.cryptGate(all(), now, false).some((x) => /no cryptkey in FatherToken/.test(x)));
	let b = all(); b.MageofOz.mluck = 9 * 60000;
	t.ok('under ten minutes of mluck counts as lacking', w.cryptGate(b, now, true).some((x) => /MageofOz lacks mluck/.test(x)));
	b = all(); b.Dexon.room = false;
	t.ok('the mule with no room', w.cryptGate(b, now, true).some((x) => /Dexon has no room/.test(x)));
	b = all(); b.MageofOz.muled = false;
	t.ok('a member still muling', w.cryptGate(b, now, true).some((x) => /MageofOz is still muling/.test(x)));
	b = all(); b.Dexon.muled = false;
	t.eq('the mule himself is not asked to mule', w.cryptGate(b, now, true), []);
	b = all(); b.Dexon.x = 400;
	t.ok('a member away from the door', w.cryptGate(b, now, true).some((x) => /Dexon is not at the door/.test(x)));
}}, {

name: 'v32 crypt: outside - walk to the door, rejoin a live run, open a new one only past the gate, once', fn(t) {
	let w = cw({ me: 'MageofOz', map: 'main', x: 0, y: 0, run: R() });
	w.cryptOutside(w.crunRead(), Date.now());
	t.eq('away from the door: walk there', JSON.stringify(w.moves[0]), JSON.stringify({ map: 'cave', x: -193, y: -1296 }));
	w = cw({ me: 'MageofOz', map: 'cave', x: -193, y: -1296, run: R() });
	w.cryptOutside(w.crunRead(), Date.now());
	t.eq('at the door with a run on: enter THAT instance', JSON.stringify(w.enters), JSON.stringify([['crypt', 'INST1']]));
	const door = (n) => B(n, { map: 'cave', x: -190, y: -1290 });
	const bs = { Dexon: door('Dexon'), MageofOz: door('MageofOz') };
	w = cw({ me: 'FatherToken', map: 'cave', x: -193, y: -1296, run: R({ done: true }), beacons: bs });
	w.crMuled = true; w.character.s = { mluck: { ms: 3600000 } };
	w.cryptOutside(w.crunRead(), Date.now());
	t.eq('the leader past the gate opens a new one', JSON.stringify(w.enters), JSON.stringify([['crypt', null]]));
	w.cryptOutside(w.crunRead(), Date.now());
	t.eq('and never twice inside ten seconds - a key each time', w.enters.length, 1);
	w = cw({ me: 'FatherToken', map: 'cave', x: -193, y: -1296, run: R({ done: true }), beacons: bs, hasKey: false });
	w.crMuled = true; w.character.s = { mluck: { ms: 3600000 } };
	w.cryptOutside(w.crunRead(), Date.now());
	t.eq('no key: no enter', w.enters.length, 0);
	t.ok('and says it in red-worthy words', w.said.some((m) => /no cryptkey/.test(m) && /bank is never touched/.test(m)));
	w = cw({ me: 'Dexon', map: 'cave', x: -193, y: -1296, run: R({ done: true }), beacons: bs });
	w.cryptOutside(w.crunRead(), Date.now());
	t.eq('a follower never opens one', w.enters.length, 0);
	w = cw({ me: 'MageofOz', run: R() });
	w.cryptEnterFailed('INST1', { reason: 'transport_cant_invalid' });
	t.eq('an instance that is gone ends the run', w.crunRead().done && w.crunRead().lost, true);
}}, {

name: 'v32 crypt: a stray is walked right of the line, then town, then rejoin', fn(t) {
	const w0 = cw({});
	t.eq('from a2’s room the middle crossing', w0.cryptKitePoint(1110, -630), w0.CRYPT_RUN.kiteMid);
	t.eq('from the vbat box the middle crossing', w0.cryptKitePoint(1190, -380), w0.CRYPT_RUN.kiteMid);
	t.eq('from a7’s hall the top', w0.cryptKitePoint(700, -1076), w0.CRYPT_RUN.kiteTop);
	t.eq('from the entrance corridor the top', w0.cryptKitePoint(0, -450), w0.CRYPT_RUN.kiteTop);
	t.ok('both crossings are right of the line', w0.CRYPT_RUN.kiteTop.x >= w0.CRYPT_RUN.lineX && w0.CRYPT_RUN.kiteMid.x >= w0.CRYPT_RUN.lineX);
	const stray = { id: 's1', mtype: 'a5', target: 'MageofOz', x: 1000, y: -600 };
	const w = cw({ me: 'MageofOz', x: 1100, y: -620, run: R(), monsters: [stray], ents: { s1: stray } });
	return (async () => {
		t.eq('a stray on me starts the kite', await w.cryptKiteTick(Date.now()), true);
		t.eq('toward the middle crossing', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([1800, -900]));
		t.eq('no town yet', w.skills.length, 0);
		w.character.real_x = 1790;
		await w.cryptKiteTick(Date.now());
		t.eq('right of the line: use_town', w.skills, ['use_town']);
		w.character.real_x = 0; w.character.real_y = 0;
		t.eq('landed at the entrance: the kite is over', await w.cryptKiteTick(Date.now()), false);
		t.eq('and the follower rejoins', w.recovering, true);
		const m = cw({ me: 'Dexon', run: R(), monsters: [stray], ents: { s1: stray } });
		t.eq('a stray on a mate starts nothing here', await m.cryptKiteTick(Date.now()), false);
	})();
}}, {

name: 'v32 crypt: defence only for a2 on someone low', fn(t) {
	const a2 = (target) => ({ id: 'b', mtype: 'a2', target: target });
	let w = cw({ me: 'FatherToken', monsters: [a2('Dexon')], ents: { Dexon: { name: 'Dexon', hp: 400, max_hp: 1000 } } });
	t.eq('a2 on Dexon at 40%: absorb him', (w.cryptAbsorbTarget() || {}).name, 'Dexon');
	w = cw({ me: 'FatherToken', monsters: [a2('Dexon')], ents: { Dexon: { name: 'Dexon', hp: 500, max_hp: 1000 } } });
	t.eq('at 50%: hold - the party fights him', w.cryptAbsorbTarget(), null);
	w = cw({ me: 'FatherToken', monsters: [{ mtype: 'vbat', target: 'Dexon' }], ents: { Dexon: { name: 'Dexon', hp: 100, max_hp: 1000 } } });
	t.eq('not for another monster', w.cryptAbsorbTarget(), null);
	w = cw({ me: 'FatherToken', monsters: [a2('FatherToken')] });
	t.eq('not for himself', w.cryptAbsorbTarget(), null);
	w = cw({ me: 'MageofOz', monsters: [a2('MageofOz')], character: { hp: 350, max_hp: 1000 } });
	t.eq('a2 on her at 35%: scare', w.cryptScareWanted(), true);
	w = cw({ me: 'MageofOz', monsters: [a2('MageofOz')], character: { hp: 500, max_hp: 1000 } });
	t.eq('at 50%: no scare', w.cryptScareWanted(), false);
	w = cw({ me: 'MageofOz', monsters: [{ mtype: 'vbat', target: 'MageofOz' }, { mtype: 'vbat', target: 'MageofOz' }], character: { hp: 100, max_hp: 1000 } });
	t.eq('not for vbat, however low', w.cryptScareWanted(), false);
	const s = src();
	t.ok('the priest’s crypt branch replaces the three-on-the-leader absorb', /if \(cryptRunHere\(\)\) \{[\s\S]{0,300}cryptAbsorbTarget\(\)[\s\S]{0,200}\} else if \(haveSkill\('absorb'\)\)/.test(s));
	t.ok('the mage’s crypt branch replaces the general scare', /if \(cryptRunHere\(\)\) \{[\s\S]{0,200}cryptScareWanted\(\)[\s\S]{0,200}\} else if \(haveSkill\('scare'\)\)/.test(s));
}}, {

name: 'v32 crypt: the leader drives - regroup, hold for the party, pull a2, search, clear', fn(t) {
	const now = Date.now();
	const near = (n, over) => B(n, Object.assign({ x: 10, y: 10 }, over || {}));
	let w = cw({ me: 'FatherToken', x: 900, y: -900, run: R({ regroupAll: true }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
	return (async () => {
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('after a wipe: back to the entrance', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([0, 0]));
		w.character.real_x = 5; w.character.real_y = 5;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('both beside him: the regroup ends', w.crunRead().regroupAll, false);

		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon', { rip: true }), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a follower dead: no move', w.moves.length, 0);
		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon', { x: 300 }), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a follower 300 back: no move', w.moves.length, 0);

		const a2 = { id: 'b', mtype: 'a2', target: 'FatherToken', x: 1000, y: -700 };
		const dead2 = { m1: 'a3', m2: 'a7' };
		w = cw({ me: 'FatherToken', x: 1050, y: -680, run: R({ dead: dead2 }), monsters: [a2], allies: [{ hp: 900, max_hp: 1000 }],
			beacons: { Dexon: near('Dexon', { x: 1050, y: -680 }), MageofOz: near('MageofOz', { x: 1050, y: -680 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a2 on the party: pull him to the hall', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([570, -1080]));
		w = cw({ me: 'FatherToken', x: 1050, y: -680, run: R({ dead: dead2 }), monsters: [a2], allies: [{ hp: 300, max_hp: 1000 }],
			beacons: { Dexon: near('Dexon', { x: 1050, y: -680 }), MageofOz: near('MageofOz', { x: 1050, y: -680 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('someone low: the pull stops where it is', w.moves.length, 0);

		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('nothing in view: search a7’s spawn first', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([727, -1076]));
		w.crSearch.since = now - w.CRYPT_RUN.searchMaxMs - 1;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('searched too long: the driving goes back', w.cryptNavOn, false);

		const all = { m1: 'a3', m2: 'a7', m3: 'a2' };
		for (let i = 0; i < 7; i++) all['v' + i] = 'vbat';
		w = cw({ me: 'FatherToken', run: R({ dead: all }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('every stage done: the run is done', w.crunRead().done, true);

		w = cw({ me: 'FatherToken', x: 1190, y: -380, run: R({ dead: { m1: 'a3', m2: 'a7', m3: 'a2', v1: 'vbat' } }),
			beacons: { Dexon: near('Dexon', { x: 1190, y: -380 }), MageofOz: near('MageofOz', { x: 1190, y: -380 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('at the box, the first look starts the clock and clears nothing', w.crunRead().cleared.vbat, undefined);
		w.crVbatEmptySince = now - w.CRYPT_RUN.vbatClearMs - 1;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('at the box, no vbat in view long enough: counted clear', w.crunRead().cleared.vbat, true);
	})();
}}, {

name: 'v32 crypt: a follower inside holds while the leader is down, away or kiting', fn(t) {
	const now = Date.now();
	let w = cw({ me: 'Dexon', run: R(), beacons: { FatherToken: B('FatherToken', { rip: true }) } });
	t.eq('leader dead: hold', w.cryptFollowerInside(w.crunRead(), now), true);
	w = cw({ me: 'Dexon', run: R(), beacons: { FatherToken: B('FatherToken', { map: 'cave' }) } });
	t.eq('leader outside: hold', w.cryptFollowerInside(w.crunRead(), now), true);
	w = cw({ me: 'Dexon', run: R(), beacons: { FatherToken: B('FatherToken', { kite: true }) } });
	t.eq('leader kiting: hold', w.cryptFollowerInside(w.crunRead(), now), true);
	w = cw({ me: 'Dexon', run: R(), beacons: { FatherToken: B('FatherToken') } });
	t.eq('leader inside and up: normal cohesion', w.cryptFollowerInside(w.crunRead(), now), false);
	w = cw({ me: 'Dexon', x: 800, y: -1000, run: R({ regroupAll: true }), beacons: { FatherToken: B('FatherToken') } });
	t.eq('after a wipe: to the entrance', w.cryptFollowerInside(w.crunRead(), now) && JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([0, 0]));
}}, {

name: 'v32 crypt: the mule list keeps potions, keys, boosters and anything locked', fn(t) {
	const w = cw({});
	const list = w.cryptMuleList([null, { name: 'hpot1', q: 500 }, { name: 'cryptkey' }, { name: 'ringsj', l: 'l' },
		{ name: 'vitring' }, { name: 'essenceofnature', q: 3 }, { name: 'xpbooster' }, { name: 'amuletofm', s: 1 }]);
	t.eq('only the loot, with its slot and quantity', JSON.stringify(list), JSON.stringify([{ i: 4, name: 'vitring', q: 1 }, { i: 5, name: 'essenceofnature', q: 3 }]));
	const now = Date.now();
	const lack = w.cryptMluckLacking({ Dexon: B('Dexon', { mluck: 0 }), MageofOz: B('MageofOz', { t: now - 60000 }) }, now);
	t.eq('lacking: no buff, a stale beacon, and me with none', lack, ['Dexon', 'FatherToken', 'MageofOz']);
}}, {

name: 'v32 crypt: the leader publishes the instance id the moment he is in', fn(t) {
	const w = cw({ me: 'FatherToken', inst: 'NEWINST' });
	w.cryptTick();
	t.eq('the run record names it', w.crunRead().id, 'NEWINST');
	t.eq('crypt_instance carries it', w.ls.m.crypt_instance, 'NEWINST');
	t.ok('and it went to both followers over cm', w.cms.some((c) => JSON.stringify(c[0]) === JSON.stringify(['Dexon', 'MageofOz']) && c[1].cave.crypt === 'NEWINST'));
	const f = cw({ me: 'Dexon', inst: 'NEWINST' });
	f.cryptTick();
	t.eq('a follower inside publishes nothing', f.crunRead(), null);
	const s = src();
	t.ok('a follower takes a relayed id from the leader', /d\.message\.cave\.crypt && typeof d\.message\.cave\.crypt === 'string'\) cryptRelayId = d\.message\.cave\.crypt/.test(s));
	t.ok('a reload resumes the run before the cave launcher runs', /if \(cryptAutoSaved\(\)\) cryptRun\(\);\ntick\(\);\nvoteLoop\(\);\nlauncherStart\(\);/.test(s));
	t.ok('and the launcher only runs in cave mode', /if \(!L \|\| !L\.enabled \|\| mode !== 'cave'/.test(s));
	t.ok('moveTick gives the crypt run the move first', /restTick\(\);\n[\s\S]{0,200}if \(cryptAuto && mode === 'crypt' && active\(\) && await cryptMoveTick\(\)\) return;\n\tif \(isLeader\(\)\) \{/.test(s));
}}, {

name: 'v32 crypt: after a run - the loot goes to Dexon, Dexon asks for room, Dexon asks for everyone’s mluck', fn(t) {
	const now = Date.now();
	const loot = [{ name: 'hpot1', q: 9 }, { name: 'vitring' }];
	const dex = { name: 'Dexon', x: -180, y: -1290, real_x: -180, real_y: -1290 };
	let w = cw({ me: 'MageofOz', map: 'cave', x: -193, y: -1296, run: R({ done: true }), items: loot, players: { Dexon: dex } });
	w.cryptMuleTick(w.crunRead(), now);
	t.eq('Dexon in range: the loot is sent, the potions kept', JSON.stringify(w.sent), JSON.stringify([['Dexon', 1, 1]]));
	t.eq('not yet called muled', w.crMuled, false);
	w.character.items = [{ name: 'hpot1', q: 9 }, null];
	w.cryptMuleTick(w.crunRead(), now + 3000);
	t.eq('nothing left to send: muled', w.crMuled, true);
	w = cw({ me: 'MageofOz', map: 'cave', run: R(), items: loot, players: { Dexon: dex } });
	w.cryptMuleTick(w.crunRead(), now);
	t.eq('a run still on: nothing is sent', w.sent.length, 0);
	w = cw({ me: 'MageofOz', map: 'cave', run: R({ done: true }), items: loot, players: {} });
	w.cryptMuleTick(w.crunRead(), now);
	w.cryptMuleTick(w.crunRead(), now + w.CRYPT_RUN.muleWaitMs + 2001);
	t.eq('Dexon never in range: given up on, loot kept', w.crMuled && w.sent.length === 0, true);

	w = cw({ me: 'Dexon', map: 'cave', esize: 4, items: loot, players: { Meltymerch: { name: 'Meltymerch', x: 0, y: 0, real_x: 0, real_y: 0 } } });
	w.cryptRoomTick(now);
	t.eq('four free: no room', w.crRoom, false);
	t.ok('the merchant is asked to take the overflow', w.cms.some((c) => c[0] === 'Meltymerch' && c[1].message === 'inventory_almost_full' && c[1].emptySlots === 4 && c[1]._plid));
	t.eq('and handed it when he is in range', JSON.stringify(w.sent), JSON.stringify([['Meltymerch', 1, 1]]));
	w = cw({ me: 'Dexon', map: 'cave', esize: 12 });
	w.cryptRoomTick(now);
	t.eq('twelve free: room, and nobody asked', w.crRoom && w.cms.length === 0, true);

	const bs = { FatherToken: B('FatherToken', { map: 'cave', mluck: 0 }), MageofOz: B('MageofOz', { map: 'cave' }) };
	w = cw({ me: 'Dexon', map: 'cave', run: R({ done: true }), beacons: bs });
	w.character.s = { mluck: { ms: 3600000 } };
	w.cryptMluckTick(w.crunRead(), now);
	t.ok('FatherToken lacks it: Dexon asks, with needsMluck', w.cms.some((c) => c[0] === 'Meltymerch' && c[1].message === 'location' && c[1].needsMluck === true));
	w.cryptMluckTick(w.crunRead(), now + 1000);
	t.eq('and not again inside a minute', w.cms.length, 1);
	w = cw({ me: 'MageofOz', map: 'cave', run: R({ done: true }), beacons: bs });
	w.cryptMluckTick(w.crunRead(), now);
	t.eq('only Dexon asks - the merchant answers his requests alone', w.cms.length, 0);
	w = cw({ me: 'Dexon', map: 'cave', run: R(), beacons: bs });
	w.cryptMluckTick(w.crunRead(), now);
	t.eq('not while a run is on', w.cms.length, 0);
}}];
