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
const LIFT = ['CRYPT', 'CRYPT_RUN', 'cryptAutoStamp', 'cryptAutoSaved', 'cryptNew', 'NAV', 'navGo', 'navHalt', 'navLanded',
	'mayAttack', 'attackingUs', 'crunRead', 'crunWrite', 'crunPatch', 'crunEffective', 'crSay', 'crPos', 'crDist',
	'mluckLeft', 'crInside', 'crMate', 'crKills', 'cryptStage', 'cryptSeeTick', 'cryptOnDeath', 'cryptMayAttack',
	'cryptRunHere', 'cryptAbsorbPick', 'cryptAbsorb', 'crHpTrack', 'crLossRate', 'crLastsMs', 'crWindowMs', 'crDoomed', 'crA2Nominal',
	'crA2Watch', 'cryptRestShort', 'cryptRestSafe', 'crStageClose', 'crStageOpen', 'cryptDumpOf', 'cryptDump', 'cryptOutOfKeys',
	'cryptHandBackAll', 'cryptHandBackPending', 'cryptHandBack', 'cryptMerchantTick', 'crHasJacko', 'cryptRun', 'cryptStop', 'cryptStatus',
	'crInBox', 'crPolyDist', 'crProtected', 'crCrossesBox', 'crRouteNext', 'crRouteWalk', 'crSafeStep', 'crMonsterDps', 'crA8', 'crA8Near',
	'crA8Chase', 'crA8Retreat', 'cryptRouteBlocked', 'crPullStand', 'crBatOnParty', 'cryptPullTick', 'cryptBatStage', 'crA2FarPoint', 'crA2BlinkPoint', 'cryptScareWanted', 'cryptMayRespawn', 'crWalk', 'crGo', 'crHalt',
	'crStraysOnMe', 'cryptKitePoint', 'cryptKiteTick', 'cryptPartyHold', 'crNearest', 'crOnParty', 'cryptLeaderInside',
	'cryptFollowerInside', 'crHoldPlace', 'cryptLeave', 'cryptEnter', 'cryptEnterFailed', 'cryptGate', 'cryptOutside',
	'cryptSelfBeacon', 'cryptMuleList', 'cryptFree', 'cryptMluckLacking', 'cryptTick', 'cryptMoveTick',
	'cryptMuleTick', 'cryptRoomTick', 'cryptMluckTick', 'cryptAskMerchant', 'crSendAll',
	'crZone', 'crInZone', 'crSightings', 'cryptLeaderBook', 'crSearchBlocked', 'cryptSearchPoints',
	'crA2', 'crAngerMs', 'crHpFrac', 'crPartyMean', 'crPoisoned', 'crA2Low', 'crA2Read', 'crA2Write', 'crA2Clear', 'crA2State',
	'crA2HoldFire', 'crA2Away', 'cryptBlinkWanted', 'crA2Disengage', 'crNearVbat', 'crPriestPos', 'crA2Station',
	'crA2AwayPoint', 'crStepTo', 'crA2Move', 'crRestOwed', 'crRestStamp', 'potionTick'];

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
	const w = world({ TEAM: TEAM, mode: 'crypt', stopped: false, cryptAuto: true, cryptNavOn: true, cryptRelayId: null, crAutoAt: 0,
		crunRaw: null, crunMemo: null, crSaid: {}, crSeen: {}, crKite: null, crHolding: false, crHoldSince: 0,
		crSearch: { stage: -1, i: 0, since: 0, done: {} }, crVbatEmptySince: 0,
		crCs: { run: null, seen: {}, died: [], zav: [] }, crAvoid: {}, crOnMe: null, crWasRip: false, crHoldGapSince: 0, crHoldWaived: false,
		resting: false, deathLoop: false, crRejoin: false, CRYPT_A2_KEY: 'crypt_a2', crWalkFlight: null, crEnterFlight: 0,
		CRYPT_START_KEY: 'crypt_started', CRYPT_HANDBACK_KEY: 'crypt_handback', crHpHist: {}, crA2Last: null, crAbsorbAt: 0,
		launcher: { handBackAt: 0 }, phase: 'idle', crPull: null, crPullOkAt: 0, crBatRestSince: 0, crA2Stuck: 0, CRYPT_A8_KEY: 'crypt_a8', crRestStampAt: 0, lastPot: 0,
		crMuled: false, crMuleRun: undefined, crMuleSince: 0, crMuleAt: 0, crRoom: true, crPushAt: 0, crAskAt: {}, crMluckSince: 0,
		CRUN_KEY: 'crypt_run', CRYPT_ID_KEY: 'crypt_instance', CRYPT_AUTO_KEY: 'crypt_auto',
		navFlight: null, navManualUntil: 0, navFails: {}, engagedUntil: 0, recovering: false, aim: null,
		CFG: { engageHoldMs: 8000, potMs: 2100, potHpCrit: 0.50, potMpLow: 0.60, potHpTop: 0.85 } });
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
	w.leaderMoving = () => !!o.leaderMoving;
	w.can_move_to = o.blocked ? () => false : () => true;
	w.isFn = (f) => typeof f === 'function';
	w.joinWanted = () => !!o.joinWanted; w.joins = [];
	w.joinStep = (lp) => { w.joins.push([lp.x, lp.y]); };
	w.moved = []; w.move = (x, y) => { w.moved.push([Math.round(x), Math.round(y)]); };
	w.enter = (place, id) => { w.enters.push([place, id === undefined ? null : id]); return o.enterResult || new Promise(() => {}); };
	w.locate_item = (n) => (o.hasKey === false ? -1 : (n === 'cryptkey' ? 3 : -1));
	w.send_item = (to, i, q) => w.sent.push([to, i, q]);
	w.send_cm = (to, m) => w.cms.push([to, m]);
	w.get_player = (n) => (o.players || {})[n] || null;
	w.use_skill = (n) => { w.skills.push(n); return Promise.resolve({}); };
	w.get_chests = () => o.chests || {};
	w.telUse = (n, a) => { w.skills.push([n, a && a.name]); return Promise.resolve({}); };
	w.caveVersion = () => 36;
	w.handBacks = []; w.handBack = (why) => { w.handBacks.push(why); };
	w.caveSay = (m) => { w.cms.push(['party', m]); };
	w.haveSkill = (n) => (o.skills || []).indexOf(n) >= 0;
	w.navFlight = null; w.navHalt = () => {};
	w.partyFighting = () => !!o.fighting;
	w.attacks = []; w.attack = (b) => { w.attacks.push(b.id); return Promise.resolve(); };
	w.can_attack = () => true;
	w.cavePaused = () => false; w.noteWhy = () => {};
	w.parent.__gamelog = o.gamelog === false ? undefined : { buf: [], capture(m, c, src) { this.buf.push({ message: m, color: c, source: src }); } };
	w.parent.G = { monsters: { a2: { attack: 2240, frequency: 1.4 }, a8: { attack: 2680, frequency: 4 }, vbat: { attack: 1240, frequency: 1.56 } }, skills: { scare: { mp: 50 } } };
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
	t.ok('CRYPT_A2_KEY', /^const CRYPT_A2_KEY = 'crypt_a2';$/m.test(s));
	t.ok('CRYPT_START_KEY', /^const CRYPT_START_KEY = 'crypt_started';$/m.test(s));
	t.ok('CRYPT_HANDBACK_KEY', /^const CRYPT_HANDBACK_KEY = 'crypt_handback';$/m.test(s));
	t.ok('the v36 scalars start empty', /^let crHpHist = \{\}, crA2Last = null, crAbsorbAt = 0;$/m.test(s));
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
	t.eq('from a7’s spawn the middle - nearer by path on the level-0 grid', w0.cryptKitePoint(730, -1080), w0.CRYPT_RUN.kiteMid);
	t.eq('from the west end of a7’s hall the top', w0.cryptKitePoint(380, -1100), w0.CRYPT_RUN.kiteTop);
	t.eq('from the top hall the top', w0.cryptKitePoint(1240, -1480), w0.CRYPT_RUN.kiteTop);
	t.ok('v34: the line is past the zone’s edge, x 1850 - R6', w0.CRYPT_RUN.lineX > w0.CRYPT_RUN.zone.x);
	t.eq('from the entrance corridor the top', w0.cryptKitePoint(0, -450), w0.CRYPT_RUN.kiteTop);
	t.ok('both crossings are right of the line', w0.CRYPT_RUN.kiteTop.x >= w0.CRYPT_RUN.lineX && w0.CRYPT_RUN.kiteMid.x >= w0.CRYPT_RUN.lineX);
	const stray = { id: 's1', mtype: 'a5', target: 'MageofOz', x: 1000, y: -600 };
	const w = cw({ me: 'MageofOz', x: 1100, y: -620, run: R(), monsters: [stray], ents: { s1: stray } });
	return (async () => {
		t.eq('a stray on me starts the kite', await w.cryptKiteTick(Date.now()), true);
		t.eq('toward the middle crossing', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([1880, -880]));
		t.eq('no town yet', w.skills.length, 0);
		w.character.real_x = 1850;
		await w.cryptKiteTick(Date.now());
		t.eq('v34: at x 1850 - the old line - still walking', w.skills.length, 0);
		w.character.real_x = 1870;
		await w.cryptKiteTick(Date.now());
		t.eq('right of the line: use_town', w.skills, ['use_town']);
		w.character.real_x = 0; w.character.real_y = 0;
		t.eq('landed at the entrance: the kite is over', await w.cryptKiteTick(Date.now()), false);
		t.eq('and the follower rejoins', w.recovering, true);
		const m = cw({ me: 'Dexon', run: R(), monsters: [stray], ents: { s1: stray } });
		t.eq('a stray on a mate starts nothing here', await m.cryptKiteTick(Date.now()), false);
	})();
}}, {

name: 'v36 crypt: a2 - absorb decided from hp, scare and blink also on survival time', fn(t) {
	const now = Date.now();
	const a2 = (target, ms, s) => ({ id: 'b', mtype: 'a2', target: target, x: 0, y: 0, s: Object.assign(ms === undefined ? {} : { anger: { ms: ms } }, s || {}) });
	const M = (n, hp) => ({ name: n, hp: hp, max_hp: 10000, x: 0, y: 0 });
	/* hist: name -> [hp 1.5s ago, hp now] */
	const pw = (o) => {
		const w = cw(Object.assign({ me: 'FatherToken', character: { hp: o.php === undefined ? 9000 : o.php, max_hp: o.pmax || 10000 } }, o));
		for (const n in (o.hist || {})) w.crHpHist[n] = [{ t: now - 1500, hp: o.hist[n][0] }, { t: now, hp: o.hist[n][1] }];
		return w;
	};
	const P = (o) => { const w = pw(o); return w.cryptAbsorbPick(now) || {}; };
	const dexLow = (hp, extra) => Object.assign({ ents: { Dexon: M('Dexon', hp) }, allies: [M('FatherToken', 9000), M('MageofOz', 9500), M('Dexon', hp)] }, extra);
	/* Emergency: Dexon losing 1000/s at 1500 lasts 1.5s; the tick is 6s off. */
	let p = P(dexLow(1500, { monsters: [a2('Dexon', 6000)], hist: { Dexon: [3000, 1500] } }));
	t.eq('EMERGENCY: he will not last to the tick and I will - absorb', [p.kind, p.e && p.e.name].join(), 'emergency,Dexon');
	t.ok('said with both survival times', /Dexon lasts 1\.5s, the tick is 6\.0s off, I last 9\.0s/.test(p.why));
	p = P(dexLow(1500, { monsters: [a2('Dexon', 1000)], hist: { Dexon: [3000, 1500] } }));
	t.eq('the emergency ignores the tick clock: 1s off and still absorb', p.kind, 'emergency');
	p = P(dexLow(1500, { php: 3000, monsters: [a2('Dexon', 6000)], hist: { Dexon: [3000, 1500] } }));
	t.eq('but NOT when I would not last the window myself (3000 hp at 1000/s, 7.5s needed)', [p.kind, p.e].join(), 'refuse,');
	p = P(dexLow(1500, { php: 3000, monsters: [a2('Dexon', 1000)], hist: { Dexon: [3000, 1500] } }));
	t.eq('the same 3000 hp lasts a 1s window plus the margin: absorb', p.kind, 'emergency');
	/* Soak: Dexon low but steady, clearly the lowest; I am clearly healthier. */
	p = P(dexLow(4000, { monsters: [a2('Dexon', 6000)], hist: { Dexon: [4075, 4000] } }));
	t.eq('SOAK: clearly the lowest, I am clearly healthier, the window is long - absorb', [p.kind, p.e && p.e.name].join(), 'soak,Dexon');
	p = P(dexLow(4000, { monsters: [a2('Dexon', 2000)], hist: { Dexon: [4075, 4000] } }));
	t.eq('the soak with 2s left: no - the tick re-picks soon', p.kind, undefined);
	p = P(Object.assign(dexLow(4000, { monsters: [a2('Dexon', 6000)] }), { allies: [M('FatherToken', 9000), M('MageofOz', 4500), M('Dexon', 4000)] }));
	t.eq('not CLEARLY the lowest (the mage 5 points above): no', p.kind, undefined);
	p = P(dexLow(4000, { php: 10000, pmax: 20000, monsters: [a2('Dexon', 6000)] }));
	t.eq('I am not CLEARLY healthier (10 points, though I would last): no', p.kind, undefined);
	p = P(dexLow(4000, { monsters: [a2('Dexon', 6000)] }));
	t.eq('no history yet: no rate, so the soak rules alone decide', p.kind, 'soak');
	p = P(dexLow(9000, { monsters: [a2('Dexon', 6000)], hist: { Dexon: [9100, 9000] } }));
	t.eq('everyone healthy: nothing', p.kind, undefined);
	/* The scare holder first. */
	const mageOn = (esc) => ({ ents: { MageofOz: M('MageofOz', 1500) }, allies: [M('FatherToken', 9000), M('MageofOz', 1500), M('Dexon', 9500)],
		monsters: [a2('MageofOz', 6000)], hist: { MageofOz: [3000, 1500] }, beacons: { MageofOz: B('MageofOz', { esc: esc }) } });
	p = P(mageOn(true));
	t.eq('a2 on the mage with her escape ready: hers comes first, even in an emergency', [p.kind, p.e].join(), 'defer,');
	p = P(mageOn(false));
	t.eq('her escape not ready: the emergency absorb', p.kind, 'emergency');
	p = P({ monsters: [{ id: 'v', mtype: 'vbat', target: 'Dexon', s: { anger: { ms: 7000 } } }], ents: { Dexon: M('Dexon', 100) }, allies: [M('Dexon', 100)], hist: { Dexon: [3000, 100] } });
	t.eq('not for another monster', p.kind, undefined);
	p = P({ monsters: [a2('FatherToken', 7000)] });
	t.eq('not for himself', p.kind, undefined);
	/* a2's nominal floor: an unhurt victim does not make me immortal. */
	p = P(dexLow(4000, { php: 2000, monsters: [a2('Dexon', 6000)], hist: { Dexon: [4000, 4000] } }));
	t.eq('the victim losing nothing: a2 still deals me at least the floor (2000 hp lasts 2.6s < 7.5s)', p.kind, 'refuse');
	let w = pw(dexLow(4000, { php: 2000, monsters: [a2('Dexon', 6000, { cursed: { ms: 3000 } })] }));
	t.eq('cursed, the floor is 0.8 of it', Math.round(w.crA2Nominal(w.crA2())), Math.round(2240 * 1.4 * 0.8));

	w = pw(dexLow(1500, { monsters: [a2('Dexon', 6000)], hist: { Dexon: [3000, 1500] } }));
	return (async () => {
		t.eq('cast: true', await w.cryptAbsorb(w.cryptAbsorbPick(now), now), true);
		t.eq('absorb on Dexon', JSON.stringify(w.skills), JSON.stringify([['absorb', 'Dexon']]));
		t.ok('stamped for the switch log', w.crAbsorbAt > 0);
		t.ok('and said with its kind', w.said.some((m) => /absorbed a2 off Dexon \(emergency\)/.test(m)));
		t.eq('a refusal casts nothing', await w.cryptAbsorb({ e: null, kind: 'refuse' }, now), false);

		/* The member he is on: scare and blink when it will not last to the tick. */
		const mw = (hp, ms, hist, allies) => {
			const x = cw({ me: 'MageofOz', monsters: [a2('MageofOz', ms)], character: { hp: hp, max_hp: 1000 },
				allies: allies || [{ name: 'FatherToken', hp: 900, max_hp: 1000 }, { name: 'MageofOz', hp: hp, max_hp: 1000 }, { name: 'Dexon', hp: 1000, max_hp: 1000 }] });
			if (hist) x.crHpHist.MageofOz = [{ t: Date.now() - 1500, hp: hist }, { t: Date.now(), hp: hp }];
			return x;
		};
		let x = mw(400, 7000);
		t.eq('P1: on her at 40%, the clock just reset: scare', x.cryptScareWanted(x.crA2()), true);
		x = mw(400, 3000);
		t.eq('the same with 3s left: wait for the next tick', x.cryptScareWanted(x.crA2()), false);
		x = mw(250, 1000);
		t.eq('critical: scare whatever the clock', x.cryptScareWanted(x.crA2()), true);
		x = mw(800, 7000, null, [{ name: 'FatherToken', hp: 400, max_hp: 1000 }, { name: 'MageofOz', hp: 800, max_hp: 1000 }, { name: 'Dexon', hp: 500, max_hp: 1000 }]);
		t.eq('she is fine but the party mean is low: scare', x.cryptScareWanted(x.crA2()), true);
		x = mw(800, 7000);
		t.eq('everyone fine: no scare', x.cryptScareWanted(x.crA2()), false);
		x = mw(600, 3000, 1050);
		t.eq('v36: not low, 3s left, but losing 300/s - she will not last 4.5s: scare now', x.cryptScareWanted(x.crA2()), true);
		x = mw(600, 3000, 650);
		t.eq('losing 33/s she will: no scare', x.cryptScareWanted(x.crA2()), false);
		x = cw({ me: 'MageofOz', monsters: [{ id: 'v', mtype: 'vbat', target: 'MageofOz', s: {} }], character: { hp: 100, max_hp: 1000 } });
		t.eq('not for vbat, however low', x.cryptScareWanted(x.monsters[0]), false);
		x = mw(400, 1000);
		t.eq('P5: low, 1s before a tick: blink', x.cryptBlinkWanted(x.crA2()), true);
		x = mw(400, 6000);
		t.eq('6s before one: not yet', x.cryptBlinkWanted(x.crA2()), false);
		x = mw(600, 6000, 1500);
		t.eq('v36: 6s before one but losing 600/s: blink now', x.cryptBlinkWanted(x.crA2()), true);

		const s = src();
		t.ok('the emergency absorb goes before any heal',
			/async function priestSkills\(target\) \{[\s\S]{0,400}absorbPick = cryptAbsorbPick\(Date\.now\(\)\);\n\t\tif \(absorbPick && absorbPick\.kind === 'emergency' && await cryptAbsorb\(absorbPick, Date\.now\(\)\)\) return true;[\s\S]{0,300}const hurtCount = /.test(s));
		t.ok('and none while the party holds fire on him', /if \(cryptRunHere\(\) && haveSkill\('absorb'\) && !crA2HoldFire\(Date\.now\(\)\)\) \{/.test(s));
		t.ok('the soak absorb after the heals, the curse after it',
			/if \(!hold && absorbPick && absorbPick\.kind === 'soak' && await cryptAbsorb\(absorbPick, Date\.now\(\)\)\) return true;\n\t\tif \(a2 && !hold && crOnParty\(a2\) && haveSkill\('curse'\)/.test(s));
		t.ok('the mage scares first, blinks only with scare unavailable, and both disengage',
			/haveSkill\('scare'\) && cryptScareWanted\(a2\)\) \{\n\t\t\ttry \{ await telUse\('scare'\); bump\('scares'\); crA2Disengage\(a2, [^\n]*\n\t\t\} else if \(a2 && !haveSkill\('scare'\) && haveSkill\('blink'\) && cryptBlinkWanted\(a2\)\)/.test(s));
		t.ok('the beacon says when a mage can escape', /esc: character\.map === 'crypt' && character\.ctype === 'mage' && \(haveSkill\('scare'\) \|\| haveSkill\('blink'\)\),/.test(s));
	})();
}}, {

name: 'v36 crypt: hp-loss rates', fn(t) {
	const w = cw({ allies: [{ name: 'Dexon', hp: 5000, max_hp: 10000 }] });
	const now = Date.now();
	w.crHpTrack(now - 2000);
	t.eq('one sample: no rate', w.crLossRate('Dexon', now - 2000), null);
	w.o = null;
	w.allies = () => [{ name: 'Dexon', hp: 3000, max_hp: 10000 }];
	w.crHpTrack(now);
	t.eq('2000 lost in 2s: 1000/s', w.crLossRate('Dexon', now), 1000);
	w.allies = () => [{ name: 'Dexon', hp: 4000, max_hp: 10000 }];
	w.crHpTrack(now + 500);
	t.eq('net over the window: 1000 lost in 2.5s', w.crLossRate('Dexon', now + 500), 400);
	w.allies = () => [{ name: 'Dexon', hp: 6000, max_hp: 10000 }];
	w.crHpTrack(now + 600);
	t.eq('healed past the oldest reading: 0, never negative', w.crLossRate('Dexon', now + 600), 0);
	w.crHpTrack(now + 9000);
	t.eq('the window drops old samples: one left, no rate', w.crLossRate('Dexon', now + 9000), null);
	t.eq('lasts at no loss: forever', w.crLastsMs(100, 0), Infinity);
	t.eq('the window with no clock is 8s plus the margin', w.crWindowMs(null), 8000 + w.CRYPT_RUN.a2.absorbMarginMs);
	t.eq('my own hp is tracked under my name', (w.allies = () => [w.character], w.crHpTrack(now), w.crHpHist.FatherToken.length), 1);
}}, {

name: 'v35 crypt: the disengage - one member or all, hold fire, re-engage healed with the mage opening', fn(t) {
	const now = Date.now();
	const a2 = (target, ms) => ({ id: 'b', mtype: 'a2', target: target, x: 0, y: 0, s: { anger: { ms: ms } } });
	const full = [{ name: 'FatherToken', hp: 1000, max_hp: 1000 }, { name: 'MageofOz', hp: 1000, max_hp: 1000 }, { name: 'Dexon', hp: 1000, max_hp: 1000 }];
	const low = [{ name: 'FatherToken', hp: 400, max_hp: 1000 }, { name: 'MageofOz', hp: 300, max_hp: 1000 }, { name: 'Dexon', hp: 500, max_hp: 1000 }];
	let m = cw({ me: 'MageofOz', monsters: [a2('MageofOz', 7000)], allies: full, character: { hp: 300, max_hp: 1000 } });
	m.crA2Disengage(m.crA2(), 'scared a2 off', now);
	let st = JSON.parse(m.ls.m.crypt_a2);
	t.eq('the party is fine: she goes alone', [st.mode, st.who, st.tickAt - now].join(), 'one,MageofOz,7000');
	t.eq('she holds fire on him', m.crA2HoldFire(now + 100), true);
	t.eq('and stays away', m.crA2Away(now + 100), true);
	const a2stage = R({ dead: { m1: 'a3', m2: 'a7' } });
	t.eq('cryptMayAttack refuses a2 for her, in his own stage', m.cryptMayAttack({ mtype: 'a2', target: 'Dexon' }, a2stage), false);
	t.eq('precondition: without the record she could', cw({ me: 'MageofOz' }).cryptMayAttack({ mtype: 'a2', target: 'Dexon' }, a2stage), true);
	const d = cw({ me: 'Dexon', storage: { crypt_a2: m.ls.m.crypt_a2 }, monsters: [a2(null, 7000)], allies: full });
	t.eq('Dexon is not covered by her disengage', [d.crA2HoldFire(now + 100), d.crA2Away(now + 100)].join(), 'false,false');
	t.eq('past the next tick: the record is gone', [m.crA2State(now + 7000 + m.CRYPT_RUN.a2.tickPadMs + 1), 'crypt_a2' in m.ls.m].join(), ',false');
	m = cw({ me: 'MageofOz', monsters: [a2('MageofOz', 7000)], allies: full, character: { hp: 300, max_hp: 1000 }, inst: 'OTHER' });
	m.crA2Disengage(m.crA2(), 'scared', now);
	const other = cw({ me: 'Dexon', storage: { crypt_a2: m.ls.m.crypt_a2 } });
	t.eq('a record from another instance is ignored', other.crA2Read(), null);

	m = cw({ me: 'MageofOz', monsters: [a2('MageofOz', 7000)], allies: low, character: { hp: 300, max_hp: 1000 } });
	m.crA2Disengage(m.crA2(), 'scared a2 off', now);
	st = JSON.parse(m.ls.m.crypt_a2);
	t.eq('the party is low: everyone', st.mode, 'all');
	const dl = cw({ me: 'Dexon', storage: { crypt_a2: m.ls.m.crypt_a2 }, monsters: [a2(null, 5000)], allies: low });
	t.eq('Dexon holds fire and goes too', [dl.crA2HoldFire(now + 100), dl.crA2Away(now + 100)].join(), 'true,true');
	const after = now + 7000 + dl.CRYPT_RUN.a2.tickPadMs + 1;
	t.eq('past the tick but still hurt: still away', dl.crA2Away(after), true);
	const dh = cw({ me: 'Dexon', storage: { crypt_a2: m.ls.m.crypt_a2 }, monsters: [a2(null, 5000)], allies: full });
	t.eq('healed: no longer away', dh.crA2Away(after), false);
	t.eq('but Dexon holds fire - the mage opens', dh.crA2HoldFire(after), true);
	t.ok('reopen is written for all', JSON.parse(dh.ls.m.crypt_a2).reopen === true);
	const mh = cw({ me: 'MageofOz', storage: { crypt_a2: dh.ls.m.crypt_a2 }, monsters: [a2(null, 5000)], allies: full });
	t.eq('the mage may hit him', mh.crA2HoldFire(after + 10), false);
	mh.monsters[0].target = 'MageofOz';
	t.eq('he takes a target: the record is cleared for everyone', [mh.crA2State(after + 20), 'crypt_a2' in mh.ls.m].join(), ',false');
	const dp = cw({ me: 'Dexon', storage: { crypt_a2: m.ls.m.crypt_a2 }, monsters: [a2(null, 5000)],
		allies: full.map((a) => a.name === 'Dexon' ? Object.assign({ s: { poisoned: { ms: 3000 } } }, a) : a) });
	t.eq('healed but poisoned: still away', dp.crA2Away(after), true);
	t.eq('the cap: away no longer than reengageMaxMs', dl.crA2Away(now + dl.CRYPT_RUN.a2.reengageMaxMs + 1), false);
	const dead = cw({ me: 'Dexon', storage: { crypt_a2: m.ls.m.crypt_a2 }, run: R() });
	dead.crSeen.b = 'a2'; dead.cryptOnDeath({ id: 'b' });
	t.eq('a2 dead: the record goes', 'crypt_a2' in dead.ls.m, false);
}}, {

name: 'v35 crypt: a2 stations on the priest\'s side, the way away, and the pull with no 40% stop', fn(t) {
	const now = Date.now();
	const run = R({ dead: { m1: 'a3', m2: 'a7' } });
	const a2 = { id: 'b', mtype: 'a2', target: 'FatherToken', x: 0, y: -500, real_x: 0, real_y: -500, s: { anger: { ms: 6000 } } };
	const priest = { name: 'FatherToken', ctype: 'priest', x: 100, y: -500, real_x: 100, real_y: -500, hp: 1000, max_hp: 1000 };
	let w = cw({ me: 'MageofOz', x: 50, y: -400, run: run, monsters: [a2], ents: { FatherToken: priest }, character: { range: 241 } });
	w.partyNames = () => ['FatherToken', 'MageofOz', 'Dexon'];
	let p = w.crA2Station(a2, run);
	t.eq('P4: the mage stands at her range less the slack, on the priest\'s side', [Math.round(p.x), Math.round(p.y)].join(), '221,-500');
	w = cw({ me: 'FatherToken', x: 100, y: -500, run: run, monsters: [a2], character: { range: 165, ctype: 'priest' } });
	p = w.crA2Station(a2, run);
	t.eq('the priest nearer, on his own bearing', [Math.round(p.x), Math.round(p.y)].join(), '145,-500');
	const vb = { id: 'b', mtype: 'a2', target: 'Dexon', x: 1190, y: -560, real_x: 1190, real_y: -560 };
	w = cw({ me: 'FatherToken', x: 1190, y: -460, run: run, monsters: [vb], character: { range: 165, ctype: 'priest' } });
	p = w.crA2Station(vb, run);
	t.ok('never by the vbat box while vbat is to come', !p || !w.crNearVbat(p, run));
	w = cw({ me: 'Dexon', x: 40, y: -500, run: run, monsters: [a2] });
	const away = w.crA2AwayPoint(a2, run);
	t.ok('the way away is past 340 from him', Math.hypot(away.x - 0, away.y + 500) >= 340);
	t.ok('and not back across him', (away.x - 40) * 40 >= 0);
	const by = { id: 'b', mtype: 'a2', target: 'Dexon', x: -100, y: -460, real_x: -100, real_y: -460 };
	w = cw({ me: 'Dexon', x: -150, y: -460, run: run, monsters: [by], blocked: true });
	const tp = w.crA2AwayPoint(by, run);
	t.eq('no straight way: a tour point that is not behind him - (0,0) is nearer and behind him', [tp.x, tp.y, tp.straight].join(), '-180,-1040,false');

	const pull = { id: 'b', mtype: 'a2', target: 'FatherToken', x: 1000, y: -700 };
	const near = (n, over) => B(n, Object.assign({ x: 1050, y: -680 }, over || {}));
	w = cw({ me: 'FatherToken', x: 1050, y: -680, run: run, monsters: [pull], allies: [{ hp: 300, max_hp: 1000 }],
		beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
	return (async () => {
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('Q1: someone at 30% and the pull goes on', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([-270, -465]));
		const at = { id: 'b', mtype: 'a2', target: 'FatherToken', x: -270, y: -420, real_x: -270, real_y: -420, s: {} };
		w = cw({ me: 'FatherToken', x: -270, y: -465, run: run, monsters: [at], character: { range: 165, ctype: 'priest' },
			beacons: { Dexon: B('Dexon', { x: -260, y: -470 }), MageofOz: B('MageofOz', { x: -260, y: -470 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('at the pull spot the leader takes his station', w.moved.length, 1);
		const off = { id: 'b', mtype: 'a2', target: null, x: 0, y: -500, real_x: 0, real_y: -500, s: { anger: { ms: 6000 } } };
		w = cw({ me: 'FatherToken', x: 40, y: -500, run: run, monsters: [off], character: { range: 165, ctype: 'priest' },
			storage: { crypt_a2: JSON.stringify({ run: 'INST1', mode: 'all', who: 'MageofOz', at: now, tickAt: now + 6000 }) },
			beacons: { Dexon: B('Dexon'), MageofOz: B('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.ok('everyone away: the leader heads past 340 rather than for him', w.moved.length + w.moves.length === 1
			&& Math.hypot((w.moved[0] || [w.moves[0].x, w.moves[0].y])[0], (w.moved[0] || [w.moves[0].x, w.moves[0].y])[1] + 500) >= 340);
	})();
}}, {

name: 'v35 crypt: a respawn rests at the entrance and rejoins only onto a stationary leader out of combat', fn(t) {
	const now = Date.now();
	let w = cw({ me: 'MageofOz', x: 900, y: -900, run: R(), beacons: { FatherToken: B('FatherToken', { x: 900, y: -900 }) } });
	w.resting = true;
	t.eq('resting: to the entrance', w.cryptFollowerInside(w.crunRead(), now) && JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([0, 0]));
	w = cw({ me: 'MageofOz', x: 0, y: 0, run: R(), beacons: { FatherToken: B('FatherToken', { x: 900, y: -900 }) } });
	w.crRejoin = true;
	t.eq('rested, the leader busy: hold', [w.cryptFollowerInside(w.crunRead(), now), w.joins.length].join(), 'true,0');
	w = cw({ me: 'MageofOz', x: 0, y: 0, run: R(), joinWanted: true, beacons: { FatherToken: B('FatherToken', { x: 900, y: -900 }) } });
	w.crRejoin = true;
	t.eq('rested, the leader stationary out of combat: join him', [w.cryptFollowerInside(w.crunRead(), now), JSON.stringify(w.joins)].join(), 'true,[[900,-900]]');
	w = cw({ me: 'MageofOz', x: 880, y: -900, run: R(), beacons: { FatherToken: B('FatherToken', { x: 900, y: -900 }) } });
	w.crRejoin = true;
	t.eq('beside him: back to normal', [w.cryptFollowerInside(w.crunRead(), now), w.crRejoin].join(), 'false,false');
	w = cw({ me: 'FatherToken', x: 500, y: -900, run: R(), beacons: { Dexon: B('Dexon', { x: 500, y: -900 }), MageofOz: B('MageofOz', { x: 0, y: 0, loop: true, rest: true }) } });
	return (async () => {
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a death loop at the entrance: the leader goes to collect it', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([0, 0]));
		w = cw({ me: 'FatherToken', x: 0, y: 0, run: R({ regroupAll: true }), beacons: { Dexon: B('Dexon', { x: 10, y: 10 }), MageofOz: B('MageofOz', { x: 10, y: 10, rest: true }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('after a wipe the regroup waits for the resting', w.crunRead().regroupAll, true);
		w = cw({ me: 'FatherToken', x: 500, y: -500, run: R() });
		w.resting = true;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('the leader respawned rests at the entrance too', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([0, 0]));
		const s = src();
		t.ok('deathTick rests a crypt-run respawn', /if \(\(mode === 'cave' && inCave\(\)\) \|\| \(mode === 'crypt' && cryptAuto\)\) \{/.test(s));
		t.ok('restTick hands a crypt-run follower to the rejoin, not the latch',
			/if \(mode === 'crypt' && cryptAuto\) \{ crRejoin = true;[^\n]*return; \}\n\trecovering = true;/.test(s));
	})();
}}, {

name: 'v35 crypt: the search clock counts only while searching', fn(t) {
	const now = Date.now();
	const near = (n, over) => B(n, Object.assign({ x: 10, y: 10, t: now + 60000 }, over || {}));
	let w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
	return (async () => {
		await w.cryptLeaderInside(w.crunRead(), now);
		await w.cryptLeaderInside(w.crunRead(), now + 500);
		t.eq('two search ticks 500ms apart: 500ms spent', w.crSearch.spent, 500);
		await w.cryptLeaderInside(w.crunRead(), now + 60000);
		t.eq('a minute\'s gap counts as one second at most', w.crSearch.spent, 1500);
		w = cw({ me: 'FatherToken', run: R({ regroupAll: true }), beacons: { Dexon: near('Dexon', { x: 900 }), MageofOz: near('MageofOz') } });
		w.crSearch.spent = 200000;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a regroup resets it', w.crSearch.spent, 0);
		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon', { rip: true }), MageofOz: near('MageofOz') } });
		w.crSearch.stage = 0; w.crSearch.spent = 200000;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a dead member resets it', w.crSearch.spent, 0);
		w = cw({ me: 'FatherToken', run: R() });
		w.crSearch.spent = 999999;
		const s = src();
		t.ok('cryptNav(true) resets it', /if \(cryptNavOn\) \{ crSearch\.spent = 0; crSearch\.lastAt = 0; \}/.test(s));
		t.ok('the leader dead resets it', /if \(!character\.rip\) crHoldSince = 0;\n\telse \{ crSearch\.spent = 0; crSearch\.lastAt = 0; \}/.test(s));
	})();
}}, {

name: 'v35: no await holds the tick, and the watchdog restarts a stalled loop', fn(t) {
	const s = src();
	const w = world({ CFG: { awaitMaxMs: 30, tickStallMs: 30000 }, boundSaid: 0 });
	w.clog = () => {}; w.ev = () => {}; w.bumps = 0; w.bump = () => { w.bumps++; };
	lift(w, 'CaveRun.js', ['bounded']);
	return (async () => {
		const t0 = Date.now();
		await w.bounded(new Promise(() => {}), 'moveTick');
		t.ok('a promise that never settles is cut at awaitMaxMs', Date.now() - t0 < 1000 && w.bumps === 1);
		let threw = null;
		try { await w.bounded(Promise.reject(new Error('boom')), 'combatTick'); } catch (e) { threw = e.message; }
		t.eq('a rejection still reaches the tick\'s catch', threw, 'boom');
		t.ok('both awaits in tick() are bounded', /await bounded\(moveTick\(\), 'moveTick'\);[\s\S]{0,80}await bounded\(combatTick\(\), 'combatTick'\);/.test(s));
		t.ok('a stalled tick that resumes does not start a second loop', /if \(alive\(\) && gen === tickGen\) setTimeout\(tick, CFG\.tickMs\);/.test(s));
		t.ok('the watchdog bumps the generation and starts a new loop', /tickGen\+\+; tickAt = now;[\s\S]{0,300}setTimeout\(tick, 0\);/.test(s));
		t.ok('and is armed at load', /\ntick\(\);\nsetTimeout\(tickWatch, 5000\);/.test(s));
	})();
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
		t.eq('a2 on the party: pull him to the left wing - R2', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([-270, -465]));
		w = cw({ me: 'FatherToken', x: 1050, y: -680, run: R({ dead: dead2 }), monsters: [a2], allies: [{ hp: 900, max_hp: 1000 }],
			beacons: { Dexon: near('Dexon', { x: 1500, y: -680 }), MageofOz: near('MageofOz', { rip: true }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('R1: a follower 450 back and one dead - the pull goes on', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([-270, -465]));
		t.eq('and nothing says holding', w.said.some((m) => /holding/.test(m)), false);
		w = cw({ me: 'FatherToken', x: 1050, y: -680, run: R({ dead: dead2 }), monsters: [a2], allies: [{ hp: 300, max_hp: 1000 }],
			beacons: { Dexon: near('Dexon', { x: 1050, y: -680 }), MageofOz: near('MageofOz', { x: 1050, y: -680 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('v35 Q1: someone low and the pull goes on - the disengage replaces the stop', w.moves.length, 1);

		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('nothing in view: search a7’s home first', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([730, -1080]));
		w.crSearch.spent = w.CRYPT_RUN.searchMaxMs + 1;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('R6: searched too long - given up, both of the stage', Object.keys(w.crunRead().givenUp || {}).sort().join(','), 'a3,a7');
		t.eq('and the driving is NOT handed back', w.cryptNavOn, true);
		t.ok('said in red words', w.said.some((m) => /given up, moving on/.test(m)));
		w.moves.length = 0;
		await w.cryptLeaderInside(w.crunRead(), now + 1);
		t.eq('and the next stage is a2: his home next', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([1110, -630]));

		const all = { m1: 'a3', m2: 'a7', m3: 'a2' };
		for (let i = 0; i < 7; i++) all['v' + i] = 'vbat';
		w = cw({ me: 'FatherToken', run: R({ dead: all }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('every stage done: the run is done', w.crunRead().done, true);

		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: { m1: 'a3', m2: 'a7', m3: 'a2', v1: 'vbat' } }),
			beacons: { Dexon: near('Dexon', { x: 950, y: -500 }), MageofOz: near('MageofOz', { x: 950, y: -500 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('at the spot, the first look starts the clock and clears nothing', w.crunRead().cleared.vbat, undefined);
		w.crVbatEmptySince = now - w.CRYPT_RUN.vbatClearMs - 1;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('at the spot, no vbat in view long enough: counted clear', w.crunRead().cleared.vbat, true);
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
	t.ok('a reload resumes the run before the cave launcher runs', /if \(cryptAutoSaved\(Date\.now\(\)\)\) cryptRun\(\);\ntick\(\);\nsetTimeout\(tickWatch, 5000\);\nvoteLoop\(\);\nlauncherStart\(\);/.test(s));
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

	w = cw({ me: 'Dexon', map: 'cave', x: -193, y: -1296, esize: 4, items: loot, players: { Meltymerch: { name: 'Meltymerch', x: -150, y: -1290, real_x: -150, real_y: -1290 } } });
	w.cryptRoomTick(now);
	t.eq('four free: no room', w.crRoom, false);
	t.ok('the merchant is asked to take the overflow', w.cms.some((c) => c[0] === 'Meltymerch' && c[1].message === 'inventory_almost_full' && c[1].emptySlots === 4 && c[1]._plid));
	t.eq('v36: the room tick only asks', w.sent.length, 0);
	t.eq('the merchant tick hands it over when he is in range', w.cryptMerchantTick(now) && JSON.stringify(w.sent), JSON.stringify([['Meltymerch', 1, 1]]));
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
}}, {

name: 'v33 crypt: crypt_auto lapses after the run goes quiet, and cryptNew() abandons an instance', fn(t) {
	const now = Date.now();
	let w = cw({});
	t.eq('nothing saved: no resume', w.cryptAutoSaved(now), false);
	w.cryptTick();
	t.eq('a crypt tick stamps the time', Number(w.ls.m.crypt_auto) > 0, true);
	t.eq('a fresh stamp resumes', w.cryptAutoSaved(now), true);
	t.eq('two hours on it does not', w.cryptAutoSaved(Number(w.ls.m.crypt_auto) + w.CRYPT_RUN.autoKeepMs + 1), false);
	t.eq('and the lapsed key is cleared', 'crypt_auto' in w.ls.m, false);
	t.ok('saying so on load', w.said.some((m) => /NOT resumed/.test(m)));
	w = cw({ storage: { crypt_auto: '1' } });
	t.eq('the v32 form ("1") reads as lapsed', w.cryptAutoSaved(now), false);
	w = cw({ run: R() });
	t.eq('cryptNew marks the run done', w.cryptNew().done, true);
	t.eq('as abandoned', w.crunRead().abandoned, true);
	w = cw({ me: 'FatherToken', map: 'cave', x: -193, y: -1296, run: R() });
	w.cryptOutside(w.crunRead(), now);
	t.eq('precondition: an undone run is re-entered, not replaced', JSON.stringify(w.enters), JSON.stringify([['crypt', 'INST1']]));
	w = cw({ storage: {} });
	t.eq('nothing on record: cryptNew says so', w.cryptNew(), null);
}}, {

name: 'v34 crypt: every fixed point is a level-0 cell - the server grid counts cells past a wall too', fn(t) {
	/* precomputed_map_data.js smap_data.crypt holds levels 0-7, and only level 0
	   is reachable: server_bfs pushes level+1 for a step can_move refuses.
	   v32 read every key as walkable, so (1470,-1400) - a level-5 cell - was a
	   search point inside a sealed pocket, retried ~104 times live. These are
	   level-0 cells read off upstream a5c133dc; a point moved off one fails here. */
	const C = cw({}).CRYPT_RUN;
	const L0 = { '0|0': 1, '-270|-460': 1, '1190|-380': 1, '950|-500': 1, '-30|-380': 1, '-40|-450': 1, '-180|-540': 1, '-180|-940': 1, '-170|-1020': 1,
		'-130|-1050': 1, '-50|-1070': 1, '750|-1070': 1, '750|-740': 1, '760|-660': 1, '790|-640': 1, '950|-560': 1, '1900|-1760': 1, '1880|-880': 1, '730|-1080': 1, '1790|-1480': 1, '1110|-630': 1,
		'-40|-460': 1, '-180|-520': 1, '-180|-1040': 1, '380|-1100': 1, '600|-1080': 1, '740|-660': 1, '1100|-440': 1, '1140|-340': 1,
		'1440|-560': 1, '1500|-860': 1, '420|-1480': 1, '940|-1480': 1, '1240|-1480': 1, '1760|-1520': 1 };
	const cell = (x, y) => (Math.round(x / 10) * 10) + '|' + (Math.round(y / 10) * 10);
	const pts = [['entrance', C.entrance.x, C.entrance.y], ['pullSpot', C.pullSpot.x, C.pullSpot.y], ['vbatSpot', C.vbatSpot.x, C.vbatSpot.y],
		['kiteTop', C.kiteTop.x, C.kiteTop.y], ['kiteMid', C.kiteMid.x, C.kiteMid.y]];
	for (const t2 in C.homes) C.homes[t2].forEach((h) => pts.push(['home ' + t2, h[0], h[1]]));
	C.tour.forEach((p, i) => pts.push(['tour ' + i, p[0], p[1]]));
	C.route.concat(C.routeBranch).forEach((p, i) => pts.push(['route ' + i, p[0], p[1]]));
	for (const p of pts) t.ok(p[0] + ' at ' + p[1] + ',' + p[2] + ' is a level-0 cell', !!L0[cell(p[1], p[2])]);
	t.ok('the sealed pocket is gone from every list', !pts.some((p) => p[1] === 1470 && p[2] === -1400));
	t.ok('no tour point is in the zone or past the line', C.tour.every((p) => !(p[0] > C.zone.x && p[1] > C.zone.y) && p[0] < C.lineX));
}}, {

name: 'v34 crypt: what a member sees goes in its beacon, and the leader merges it', fn(t) {
	const now = Date.now();
	const a3 = { id: 'm3', mtype: 'a3', target: 'Dexon', x: 1500, y: -1480 };
	const a8 = { id: 'm8', mtype: 'a8', x: 1700, y: -900 };
	let w = cw({ me: 'Dexon', x: 1450, y: -1480, run: R(), monsters: [a3, a8] });
	w.cryptSeeTick(now);
	t.eq('a plan monster: last seen where it stands', JSON.stringify(w.crCs.seen.a3), JSON.stringify({ x: 1500, y: -1480, t: now }));
	t.eq('a zone monster outside the zone is reported', w.crCs.zav.map((z) => z.mtype + '@' + z.x).join(), 'a8@1700');
	t.eq('and anything not friendly is a search hazard', Object.keys(w.crAvoid).sort().join(), 'm3,m8');
	w.character.rip = true;
	w.cryptSeeTick(now + 1000);
	t.eq('dying to a3: the death point carries a3', JSON.stringify(w.crCs.died), JSON.stringify([{ x: 1450, y: -1480, t: now + 1000, by: 'a3' }]));
	w.cryptSeeTick(now + 2000);
	t.eq('once per death', w.crCs.died.length, 1);
	t.ok('the beacon carries it', /cs: character\.map === 'crypt' \? crCs : null/.test(src()));
	const cs = JSON.parse(JSON.stringify(w.crCs));
	const s = w.crSightings({ Dexon: { cs: cs }, MageofOz: { cs: { run: 'OTHER', seen: { a7: { x: 1, y: 1, t: now } }, died: [], zav: [] } } }, R());
	t.eq('merged: this run only', Object.keys(s.seen).join(), 'a3');
	t.eq('with who died', s.died[0].who, 'Dexon');
}}, {

name: 'v34 crypt: the search - last seen, died-to, home, then the tour; blocked points skipped', fn(t) {
	const now = Date.now();
	const near = (n, over) => B(n, Object.assign({ x: 10, y: 10 }, over || {}));
	const first = async (o) => {
		const w = cw(Object.assign({ me: 'FatherToken', run: R() }, o));
		if (o.pre) o.pre(w);
		await w.cryptLeaderInside(w.crunRead(), now);
		return { w: w, at: w.moves[0] ? [w.moves[0].x, w.moves[0].y].join(',') : null };
	};
	return (async () => {
		let r = await first({ beacons: { Dexon: near('Dexon', { cs: { run: 'INST1', seen: { a3: { x: 1500, y: -1480, t: now - 5000 } }, died: [], zav: [] } }), MageofOz: near('MageofOz') } });
		t.eq('R5: where a member last saw it, first', r.at, '1500,-1480');
		r = await first({ run: R({ dead: { m1: 'a3', m2: 'a7' } }), beacons: { Dexon: near('Dexon', { cs: { run: 'INST1', seen: {}, died: [{ x: -270, y: -465, t: now - 9000, by: 'a2' }], zav: [] } }), MageofOz: near('MageofOz') } });
		t.eq('R5: where a member died to it, when nobody saw it since', r.at, '-270,-465');
		r = await first({ beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') }, pre: (w) => { w.crAvoid.x = { x: 720, y: -1060, t: now, mtype: 'a6' }; } });
		t.eq('another monster by a7’s home: skipped, a3’s home next', r.at, '1790,-1480');
		r = await first({ beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') }, pre: (w) => { w.crAvoid.x = { x: 720, y: -1060, t: now, mtype: 'a7' }; } });
		t.eq('a monster of THIS stage is not a hazard', r.at, '730,-1080');
		r = await first({ beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') }, pre: (w) => { w.navFails['crs-home-a7-0'] = 2; } });
		t.eq('a point whose walk failed twice: skipped', r.at, '1790,-1480');
		r = await first({ x: 300, y: -1050, beacons: { Dexon: near('Dexon', { x: 300, y: -1050 }), MageofOz: near('MageofOz', { x: 300, y: -1050 }) },
			pre: (w) => { w.crSearch = { stage: 0, i: 0, spent: 0, lastAt: 0, done: { 'home-a7-0': true, 'home-a3-0': true } }; } });
		t.eq('homes done: the tour, from the point nearest the leader', r.at, '380,-1100');
		const w = r.w;
		const run = R(), st = { i: 0, types: ['a3', 'a7'] };
		t.eq('the vbat box is off the search, always (v37)', w.crSearchBlocked({ x: 1140, y: -340 }, run, st, now), 'the bat box');
		t.eq('and a2’s room', w.crSearchBlocked({ x: 1110, y: -560 }, run, st, now), "a2's home");
		t.eq('not once a2 is dead', w.crSearchBlocked({ x: 740, y: -660 }, R({ dead: { b: 'a2' } }), st, now), null);
		t.eq('the zone', w.crSearchBlocked({ x: 1900, y: -1000 }, run, st, now), 'zone');
		t.eq('past the line', w.crSearchBlocked({ x: 1870, y: -1760 }, run, st, now), 'line');
		const pts = w.cryptSearchPoints(run, st, {}, now);
		t.ok('every point of a whole pass is offered once', new Set(pts.map((p) => p.key)).size === pts.length);
		w.crSearch.done = {};
		for (const p of w.cryptSearchPoints(run, st, {}, now)) w.crSearch.done[p.key] = true;
		t.ok('a finished pass starts again rather than stopping', w.cryptSearchPoints(run, st, {}, now).length > 0);
	})();
}}, {

name: 'v37 crypt: a zone monster outside the zone blocks the ground around it, never the bat route; a given-up monster seen again is taken back', fn(t) {
	const now = Date.now();
	let w = cw({ me: 'FatherToken', run: R() });
	w.cryptLeaderBook(w.crunRead(), { Dexon: { cs: { run: 'INST1', seen: {}, died: [], zav: [{ id: 'm8', mtype: 'a8', x: 1700, y: -900, t: now }] } } }, now);
	t.eq('a8 at 1700,-900: a local exclusion, not a moved edge', JSON.stringify([w.crunRead().zone, w.crunRead().zoneLocal.map((a) => [a.mtype, a.x, a.y])]),
		JSON.stringify([undefined, [['a8', 1700, -900]]]));
	t.eq('the zone test reads it within 300', w.crInZone({ x: 1650, y: -900 }, w.crunRead()), true);
	t.eq('and not beyond', w.crInZone({ x: 1300, y: -900 }, w.crunRead()), false);
	w = cw({ me: 'FatherToken', run: R() });
	w.cryptLeaderBook(w.crunRead(), { Dexon: { cs: { run: 'INST1', seen: {}, died: [], zav: [{ id: 'm8', mtype: 'a8', x: 958, y: -480, t: now }] } } }, now);
	const r3 = w.crunRead();
	t.eq('run 3: a8 by the bats - the box is NOT no-go', w.crInZone({ x: 1190, y: -380 }, r3), false);
	t.eq('nor the bat spot', w.crInZone(w.CRYPT_RUN.vbatSpot, r3), false);
	t.eq('nor the corridor past a2\'s room', w.crInZone({ x: 790, y: -640 }, r3), false);
	t.eq('nor a7\'s hall', w.crInZone({ x: 750, y: -900 }, r3), false);
	t.eq('but off the route, near it, it is', w.crInZone({ x: 1110, y: -640 }, r3), true);
	t.eq('the base zone is untouched', [w.crInZone({ x: 1900, y: -1000 }, r3), w.crInZone({ x: 1700, y: -1000 }, r3)].join(), 'true,false');
	t.eq('a v34-v36 record with a grown zone is ignored', w.crInZone({ x: 1000, y: -900 }, R({ zone: { x: 858, y: -1235 } })), false);
	w.cryptLeaderBook(w.crunRead(), { Dexon: { cs: { run: 'INST1', seen: {}, died: [], zav: [{ id: 'm8', mtype: 'a8', x: 960, y: -481, t: now + 500 }] } } }, now + 500);
	t.eq('a sighting that has not moved is not rewritten every tick', w.crunRead().zoneLocal[0].t, now);
	t.eq('an exclusion lapses after zoneLocalMs', w.crInZone({ x: 1110, y: -640 }, R({ zoneLocal: [{ id: 'm8', x: 958, y: -480, t: now - w.CRYPT_RUN.zoneLocalMs - 1 }] })), false);
	t.eq('a sighting inside the zone adds nothing', (() => {
		const v = cw({ me: 'FatherToken', run: R() });
		v.cryptSeeTick(now);
		v.monsters.push({ id: 'm8', mtype: 'a8', x: 2040, y: -880 });
		v.cryptSeeTick(now);
		return v.crCs.zav.length;
	})(), 0);
	w = cw({ me: 'FatherToken', run: R({ givenUp: { a3: now - 60000 } }) });
	t.eq('precondition: a given-up a3 is out of the stages', w.cryptStage(w.crunRead()).types.join(), 'a7');
	w.cryptLeaderBook(w.crunRead(), { MageofOz: { cs: { run: 'INST1', seen: { a3: { x: 1, y: 1, t: now - 120000 } }, died: [], zav: [] } } }, now);
	t.eq('a sighting from BEFORE the give-up does not bring it back', !!w.crunRead().givenUp.a3, true);
	w.cryptLeaderBook(w.crunRead(), { MageofOz: { cs: { run: 'INST1', seen: { a3: { x: 1, y: 1, t: now } }, died: [], zav: [] } } }, now);
	t.eq('seen since: taken back', !!w.crunRead().givenUp.a3, false);
	t.eq('and it is a stage again', w.cryptStage(w.crunRead()).types.join(), 'a3,a7');
	const inZ = { id: 'z3', mtype: 'a3', x: 1950, y: -1000 };
	let v = cw({ me: 'FatherToken', monsters: [inZ] });
	t.eq('a stage target inside the zone is not gone after', v.crNearest(['a3'], R()), null);
	inZ.target = 'Dexon';
	t.eq('unless it is already on the party', (v.crNearest(['a3'], R()) || {}).id, 'z3');
	const vb = { id: 'v', mtype: 'vbat', x: 1190, y: -380 };
	w = cw({ me: 'FatherToken', x: 1190, y: -380, run: R({ dead: { m3: 'a3', m2: 'a2' }, givenUp: { a7: now - 1 } }), monsters: [vb],
		beacons: { Dexon: B('Dexon', { x: 1190, y: -380 }), MageofOz: B('MageofOz', { x: 1190, y: -380 }) } });
	t.eq('precondition: on vbat with a7 given up', w.cryptStage(w.crunRead()).types.join(), 'vbat');
	const all = { m1: 'a3', m3: 'a2' };
	for (let i = 0; i < 7; i++) all['v' + i] = 'vbat';
	w = cw({ me: 'FatherToken', run: R({ dead: all, givenUp: { a7: now } }), beacons: { Dexon: B('Dexon'), MageofOz: B('MageofOz') } });
	return (async () => {
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('every stage killed or given up: done', w.crunRead().done, true);
		t.ok('and the log names what was given up', w.said.some((m) => /given up: a7/.test(m)));
	})();
}}, {

name: 'v34 crypt: the leader never holds through a fight, and a gap hold gives up', fn(t) {
	const now = Date.now();
	const vb = { id: 'v1', mtype: 'vbat', target: 'Dexon', x: 1190, y: -380 };
	const dead = { m1: 'a3', m2: 'a7', m3: 'a2' };
	let w = cw({ me: 'FatherToken', x: 1190, y: -380, run: R({ dead: dead }), monsters: [vb],
		beacons: { Dexon: B('Dexon', { x: 1190, y: -380 }), MageofOz: B('MageofOz', { x: 1190, y: -700 }) } });
	return (async () => {
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('vbat on Dexon, MageofOz 320 back: no hold - fight', w.said.some((m) => /holding/.test(m)), false);
		t.ok('and the leader stands', w.stops >= 0 && w.moves.length === 0);
		const later = now + 60000;   // beacons fresh for the whole test
		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: B('Dexon', { x: 10, y: 10, t: later }), MageofOz: B('MageofOz', { x: 135, y: 0, t: later }) } });
		w.crHolding = true;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('the live case: 135 back, holding', w.moves.length, 0);
		await w.cryptLeaderInside(w.crunRead(), now + w.CRYPT_RUN.holdMaxMs + 1);
		t.eq('past holdMaxMs: going on', w.moves.length, 1);
		t.ok('said once', w.said.filter((m) => /going on/.test(m)).length === 1);
		w.cryptPartyHold(w.crunRead(), { Dexon: B('Dexon', { t: later }), MageofOz: B('MageofOz', { t: later }) }, now + w.CRYPT_RUN.holdMaxMs + 2);
		t.eq('the gap closed: re-armed', w.crHoldWaived, false);
		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: B('Dexon', { rip: true, t: later }), MageofOz: B('MageofOz', { t: later }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		await w.cryptLeaderInside(w.crunRead(), now + w.CRYPT_RUN.holdMaxMs + 1);
		t.eq('a dead follower is still held for, however long', w.moves.length, 0);
	})();
}}, {

name: 'v34 crypt: a walk still moving is not re-sent, and its own replacement is not reported', fn(t) {
	const rejects = [];
	const w = cw({ me: 'Dexon', map: 'cave' });
	w.smart_move = (p) => { w.moves.push(p); return new Promise((res, rej) => rejects.push(rej)); };
	return (async () => {
		w.crWalk({ map: 'cave', x: -193, y: -1296 }, 'door');
		w.character.moving = true;
		w.crWalkFlight.at -= 31000;
		w.crWalk({ map: 'cave', x: -193, y: -1296 }, 'door');
		t.eq('moving after 31s: not re-sent', w.moves.length, 1);
		w.character.moving = false;
		w.crWalk({ map: 'cave', x: -193, y: -1296 }, 'door');
		t.eq('stopped after 31s: re-sent', w.moves.length, 2);
		rejects[0]({ reason: 'interrupted' });
		await new Promise((r) => setTimeout(r, 0));
		t.eq('the replaced walk’s "interrupted" is not reported', w.said.some((m) => /failed/.test(m)), false);
		rejects[1]({ reason: 'failed' });
		await new Promise((r) => setTimeout(r, 0));
		t.eq('a real failure still is', w.said.some((m) => /path to door failed: failed/.test(m)), true);
		t.eq('nothing in the crypt smart_moves to a name - coordinates only', /smart_move\(\s*['"]/.test(src()), false);
	})();
}}, {

name: 'v36 crypt: each a2 target switch is logged once, by the member he switched onto', fn(t) {
	const now = Date.now();
	const a2 = (target, ms) => ({ id: 'b', mtype: 'a2', target: target, x: 0, y: 0, real_x: 0, real_y: 0, s: { anger: { ms: ms } } });
	const ents = { Dexon: { name: 'Dexon', x: 100, y: 0, real_x: 100, real_y: 0 } };
	let w = cw({ me: 'MageofOz', x: 0, y: 200, run: R(), monsters: [a2('Dexon', 7900)], ents: ents,
		beacons: { FatherToken: B('FatherToken', { x: 0, y: -300 }) } });
	w.crA2Watch(now);
	t.eq('first sight, on someone else: nothing said here', w.said.length, 0);
	w.monsters[0] = a2('MageofOz', 7950);
	w.crA2Watch(now + 100);
	t.eq('onto me: one line', w.said.length, 1);
	t.ok('naming from, to and anger.ms', /a2 Dexon -> MageofOz, anger\.ms 7950/.test(w.said[0]));
	t.ok('and every member\'s distance - from the beacon when out of view', /Dexon 100, FatherToken 300, MageofOz 200/.test(w.said[0]));
	const log = w.crunRead().a2log;
	t.eq('in the run record for the dump', [log.length, log[0].from, log[0].to, log[0].ms, log[0].d.MageofOz].join(), '1,Dexon,MageofOz,7950,200');
	w.crA2Watch(now + 200);
	t.eq('no switch: nothing more', w.said.length, 1);
	w.monsters[0] = a2('Dexon', 7900);
	w.crA2Watch(now + 300);
	t.eq('off me onto Dexon: his tab logs it, not mine', w.said.length, 1);

	w = cw({ me: 'FatherToken', run: R(), monsters: [a2('FatherToken', 7000)], ents: ents });
	w.crA2Watch(now);
	t.eq('first sight, on me: logged', w.said.length, 1);
	w.crAbsorbAt = now + 50;
	w.monsters[0] = a2('Dexon', 7000); w.crA2Watch(now + 60);
	w.monsters[0] = a2('FatherToken', 6900); w.crA2Watch(now + 100);
	t.ok('back onto me just after my absorb: tagged absorb', /a2 Dexon -> FatherToken \(absorb\)/.test(w.said[1]));
	w.monsters[0] = a2(null, 6000); w.crA2Watch(now + 200);
	t.ok('the leader logs a drop to no target', /a2 FatherToken -> no target/.test(w.said[2]));
	w = cw({ me: 'Dexon', run: R(), monsters: [a2('Dexon', 7000)], ents: ents });
	w.crA2Watch(now); w.monsters[0] = a2(null, 6000); w.crA2Watch(now + 100);
	t.eq('a follower does not', w.said.length, 1);
	t.ok('the watch runs every tick inside', /crHpTrack\(now\);\n\tcrA2Watch\(now\);/.test(src()));
}}, {

name: 'v36 crypt: the party rests to near full before each stage, and before a2 the scare holder has a scare', fn(t) {
	const now = Date.now();
	const near = (n, over) => B(n, Object.assign({ x: 10, y: 10, hpFrac: 1, mpFrac: 1 }, over || {}));
	return (async () => {
		let w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon', { mpFrac: 0.5 }), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('Dexon at 50% mp: no search yet', w.moves.length, 0);
		t.ok('said why', w.said.some((m) => /resting before stage 1 - Dexon mp 50%/.test(m)));
		w = cw({ me: 'FatherToken', x: 500, y: 0, run: R(), monsters: [{ id: 'z', mtype: 'a6', x: 600, y: 0, real_x: 600, real_y: 0 }],
			beacons: { Dexon: near('Dexon', { mpFrac: 0.5, x: 500, y: 0 }), MageofOz: near('MageofOz', { x: 500, y: 0 }) } });
		await w.cryptLeaderInside(w.crunRead(), now + 10);
		t.eq('something hostile near: rest at the entrance instead', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([0, 0]));
		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon', { hpFrac: 0.95, mpFrac: 0.85 }), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('near full (95% hp, 85% mp): go on', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([730, -1080]));
		w = cw({ me: 'FatherToken', run: R(), character: { mp: 300, max_mp: 1000 }, beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('the leader himself at 30% mp: wait', w.moves.length, 0);
		w.crSearch.restAt = now - w.CRYPT_RUN.restMaxMs - 1;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('rested past the cap: go on anyway', w.moves.length, 1);
		t.ok('said in orange words', w.said.some((m) => /still FatherToken mp 30% - going on/.test(m)));
		w.moves.length = 0; w.navFlight = null;
		w.character.mp = 0; w.crSearch.restAt = now;
		await w.cryptLeaderInside(w.crunRead(), now + 1);
		t.eq('and not again inside the same stage', w.moves.length, 1);

		const dead2 = { m1: 'a3', m2: 'a7' };
		w = cw({ me: 'FatherToken', run: R({ dead: dead2 }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz', { jacko: true, mp: 40 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('before a2: the scare holder short of one scare - wait', w.moves.length, 0);
		t.ok('naming it', w.said.some((m) => /MageofOz short of one scare \(40\/50 mp\)/.test(m)));
		w = cw({ me: 'FatherToken', run: R({ dead: dead2 }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz', { jacko: true, mp: 60 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('60 mp: go', w.moves.length, 1);
		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz', { jacko: true, mp: 40 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('the scare rule is for a2 only', w.moves.length, 1);
		w = cw({ me: 'FatherToken', run: R({ dead: dead2 }), x: 1050, y: -680, monsters: [{ id: 'b', mtype: 'a2', target: 'FatherToken', x: 1000, y: -700 }],
			allies: [{ hp: 900, max_hp: 1000 }], beacons: { Dexon: near('Dexon', { mpFrac: 0.1, x: 1050, y: -680 }), MageofOz: near('MageofOz', { x: 1050, y: -680 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('never in the way of the a2 pull', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([-270, -465]));
		t.ok('the self beacon carries hp, mp and the jacko', /hpFrac: character\.max_hp \? character\.hp \/ character\.max_hp : 1,\n\t\tmpFrac: character\.max_mp \? character\.mp \/ character\.max_mp : 1,\n\t\tmp: Math\.round\(character\.mp \|\| 0\), jacko: crHasJacko\(\) \};/.test(src()));
	})();
}}, {

name: 'v36 crypt: the CRYPT DUMP - one row per run with stages, deaths, keys and what was given up', fn(t) {
	const now = Date.now();
	const near = (n) => B(n, { x: 10, y: 10 });
	return (async () => {
		let w = cw({ me: 'FatherToken', inst: 'K1' });
		w.cryptTick();
		t.eq('a new instance records the key it cost', w.crunRead().keyUsed, true);
		w = cw({ me: 'FatherToken', run: R({ at: now - 600000 }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now - 500000);
		t.eq('stage 1 opened with its time', JSON.stringify(w.crunRead().stages.map((x) => [x.i, x.types, x.at])), JSON.stringify([[0, ['a3', 'a7'], now - 500000]]));
		await w.cryptLeaderInside(w.crunRead(), now - 499000);
		t.eq('not opened twice', w.crunRead().stages.length, 1);
		w.crSearch.stage = -1;
		await w.cryptLeaderInside(w.crunRead(), now - 498000);
		t.eq('nor after a reload forgets the stage', w.crunRead().stages.length, 1);
		w.crunPatch((c) => { c.dead = { m1: 'a3', m2: 'a7' }; });
		await w.cryptLeaderInside(w.crunRead(), now - 300000);
		const st = w.crunRead().stages;
		t.eq('the next stage closes the last', [st.length, st[0].ms, st[1].types[0]].join(), '2,200000,a2');
		w.crSearch.spent = w.CRYPT_RUN.searchMaxMs + 1;
		await w.cryptLeaderInside(w.crunRead(), now - 200000);
		t.eq('a give-up records why', w.crunRead().givenWhy.a2, 'not found in 5 min of searching');
		await w.cryptLeaderInside(w.crunRead(), now - 100000);
		t.eq('the vbat stage opens after it', w.crunRead().stages[2].types[0], 'vbat');
		w.crunPatch((c) => {
			for (let i = 0; i < 7; i++) c.dead['v' + i] = 'vbat';
			c.deaths = [{ who: 'MageofOz', x: 1100, y: -600, by: 'a2', t: now - 350000 }, { who: 'MageofOz', x: 0, y: 0, by: null, t: now - 340000 }];
		});
		w.character.items = [{ name: 'cryptkey', q: 2 }];
		await w.cryptLeaderInside(w.crunRead(), now);
		const row = w.parent.__gamelog.buf.find((r) => /^CRYPT DUMP/.test(r.message));
		t.ok('one CRYPT DUMP row, cleared', row && /^CRYPT DUMP \(cleared\) - FatherToken - \d+ min, 2 death\(s\), given up a2$/.test(row.message));
		const d = row && row.dump;
		t.eq('deaths with where and by what', JSON.stringify(d.deaths[0]), JSON.stringify({ who: 'MageofOz', x: 1100, y: -600, by: 'a2', t: now - 350000 }));
		t.eq('per member', JSON.stringify(d.deathsBy), JSON.stringify({ MageofOz: 2 }));
		t.eq('keys left in the bag', d.keysLeft, 2);
		t.eq('given up, with why', JSON.stringify(d.givenUp.map((g) => [g.mtype, g.why])), JSON.stringify([['a2', 'not found in 5 min of searching']]));
		t.eq('three stages timed, all closed', d.stages.map((x) => x.ms !== null).join(), 'true,true,true');
		t.ok('a total time', d.totalMs >= 600000);
		t.eq('the kills', d.kills.vbat, 7);
		await w.cryptLeaderInside(w.crunRead(), now + 1000);
		t.eq('written once', w.parent.__gamelog.buf.filter((r) => /^CRYPT DUMP/.test(r.message)).length, 1);
		w = cw({ me: 'Dexon', run: R({ done: true, doneAt: now }) });
		t.eq('only the leader writes it', w.cryptDump(w.crunRead(), 'cleared'), false);
		w = cw({ me: 'FatherToken', run: R() });
		w.cryptNew();
		t.ok('an abandoned run is dumped too', w.parent.__gamelog.buf.some((r) => /^CRYPT DUMP \(abandoned\)/.test(r.message)));
		w = cw({ me: 'FatherToken', map: 'cave', run: R() });
		w.cryptEnterFailed('INST1', { reason: 'invalid' });
		t.ok('and a lost one', w.parent.__gamelog.buf.some((r) => /^CRYPT DUMP \(lost\)/.test(r.message)));

		w = cw({ me: 'MageofOz', run: R(), character: { rip: true, real_x: 50, real_y: 60 } });
		w.crCs.run = 'INST1'; w.crOnMe = { mtype: 'a2', t: now };
		w.cryptSeeTick(now);
		t.eq('a death goes in the run record, by the one who died', JSON.stringify(w.crunRead().deaths), JSON.stringify([{ who: 'MageofOz', x: 50, y: 60, t: now, by: 'a2' }]));
	})();
}}, {

name: 'v36 crypt: when the keys run out after a run, all three hand back', fn(t) {
	const now = Date.now();
	const door = (n, over) => B(n, Object.assign({ map: 'cave', x: -190, y: -1290, inst: null }, over || {}));
	const at = { map: 'cave', x: -193, y: -1296 };
	const mk0 = (o) => cw(Object.assign({ me: 'FatherToken', map: 'cave', x: -193, y: -1296, hasKey: false, storage: { crypt_started: String(now - 3600000), crypt_auto: String(now) },
		run: R({ done: true, at: now - 1800000 }), beacons: { Dexon: door('Dexon'), MageofOz: door('MageofOz') } }, o));
	const mk = (o) => { const x = mk0(o); x.character.s = { mluck: { ms: 3600000 } }; x.crMuled = true; return x; };
	let w = mk();
	w.cryptOutside(w.crunRead(), now);
	t.eq('done, all out and muled, no key: the leader hands back', JSON.stringify(w.handBacks), JSON.stringify(['crypt: no cryptkey left after the last run']));
	t.ok('tells the others', w.cms.some((c) => c[1] === 'crypthandback'));
	t.ok('writes the shared key for any tab that misses it', JSON.parse(w.ls.m.crypt_handback).at > 0);
	t.eq('and clears crypt_auto and the start', ['crypt_auto' in w.ls.m, 'crypt_started' in w.ls.m].join(), 'false,false');
	t.eq('crypt mode off', w.cryptAuto, false);
	w = mk({ beacons: { Dexon: door('Dexon'), MageofOz: door('MageofOz', { muled: false }) } });
	w.cryptOutside(w.crunRead(), now);
	t.eq('the mage still muling: wait', w.handBacks.length, 0);
	t.ok('saying for what', w.said.some((m) => /no cryptkey left - handing everyone back once MageofOz has muled/.test(m)));
	w = mk({ beacons: { Dexon: door('Dexon', { map: 'crypt' }), MageofOz: door('MageofOz') } });
	w.cryptOutside(w.crunRead(), now);
	t.eq('Dexon still inside: wait', w.handBacks.length, 0);
	w = mk({ run: R({ done: true, at: now - 7200000 }) });
	w.cryptOutside(w.crunRead(), now);
	t.eq('no run done since cryptRun: the red wait, no hand-back', w.handBacks.length + (w.said.some((m) => /put a cryptkey in his bag/.test(m)) ? 0 : 1), 0);
	w = mk({ run: R({ done: false, at: now - 1800000 }) });
	w.cryptOutside(w.crunRead(), now);
	t.eq('an unfinished run with no key: re-entered, it needs none', JSON.stringify([w.handBacks.length, w.enters]), JSON.stringify([0, [['crypt', 'INST1']]]));
	w = mk({ hasKey: true });
	w.cryptOutside(w.crunRead(), now);
	t.eq('a key left: the next run opens', JSON.stringify([w.handBacks.length, w.enters]), JSON.stringify([0, [['crypt', null]]]));

	/* A follower that missed the cm. */
	w = cw({ me: 'Dexon', map: 'cave', storage: { crypt_started: String(now - 3600000), crypt_handback: JSON.stringify({ at: now - 5000, why: 'x' }) } });
	w.cryptTick();
	t.eq('a follower outside follows the shared key', JSON.stringify(w.handBacks), JSON.stringify(['crypt: the leader handed back - no keys left']));
	w = cw({ me: 'Dexon', map: 'cave', storage: { crypt_started: String(now - 3600000), crypt_handback: JSON.stringify({ at: now - 7200000, why: 'x' }) } });
	w.cryptTick();
	t.eq('not a key from before this run began', w.handBacks.length, 0);
	w = cw({ me: 'Dexon', map: 'cave', storage: { crypt_handback: JSON.stringify({ at: now - 5000, why: 'x' }) } });
	w.cryptAutoStamp(now);
	t.eq('and no tab re-stamps crypt_auto after a hand-back', 'crypt_auto' in w.ls.m, false);
	w = cw({ me: 'FatherToken', storage: { crypt_handback: JSON.stringify({ at: now - 5000, why: 'x' }) } });
	w.cryptRun();
	t.eq('a new cryptRun clears the hand-back', 'crypt_handback' in w.ls.m, false);
	const st0 = w.ls.m.crypt_started;
	t.ok('and stamps the start', Number(st0) > 0);
	w.ls.m.crypt_started = '12345';
	w.cryptRun();
	t.eq('a resume keeps the start', w.ls.m.crypt_started, '12345');
	w.cryptStop();
	t.eq('a stop clears it', 'crypt_started' in w.ls.m, false);
	t.ok('the follower hears the cm', /d\.message\.cave === 'crypthandback'\) \{ if \(cryptAuto\) cryptHandBack\(/.test(src()));
}}, {

name: 'v36 crypt: every member mules straight to the merchant whenever he is in range', fn(t) {
	const now = Date.now();
	const melty = { Meltymerch: { name: 'Meltymerch', x: -150, y: -1290, real_x: -150, real_y: -1290 } };
	const loot = [{ name: 'hpot1', q: 9 }, { name: 'vitring' }, { name: 'cryptkey' }];
	for (const me of ['Dexon', 'FatherToken', 'MageofOz']) {
		const w = cw({ me: me, map: 'cave', x: -193, y: -1296, run: R(), items: loot, players: melty });
		t.eq(me + ': in range, run still on - the loot goes to him', w.cryptMerchantTick(now) && JSON.stringify(w.sent), JSON.stringify([['Meltymerch', 1, 1]]));
	}
	let w = cw({ me: 'MageofOz', map: 'crypt', x: -193, y: -1296, items: loot, players: melty });
	t.eq('not from inside the crypt', w.cryptMerchantTick(now) || w.sent.length, 0);
	w = cw({ me: 'MageofOz', map: 'cave', x: -193, y: -1296, items: loot, players: { Meltymerch: { name: 'Meltymerch', x: 400, y: -1290, real_x: 400, real_y: -1290 } } });
	t.eq('out of range: nothing', w.cryptMerchantTick(now) || w.sent.length, 0);
	w = cw({ me: 'MageofOz', map: 'cave', x: -193, y: -1296, items: loot, players: melty });
	w.cryptMerchantTick(now); w.cryptMerchantTick(now + 500);
	t.eq('once every 2s', w.sent.length, 1);
	const dex = { name: 'Dexon', x: -180, y: -1290, real_x: -180, real_y: -1290 };
	w = cw({ me: 'MageofOz', map: 'cave', x: -193, y: -1296, run: R({ done: true }), items: loot, players: Object.assign({ Dexon: dex }, melty) });
	w.cryptTick();
	t.eq('both in range after a run: the merchant gets it, not Dexon', JSON.stringify(w.sent), JSON.stringify([['Meltymerch', 1, 1]]));
	w = cw({ me: 'MageofOz', map: 'cave', x: -193, y: -1296, run: R({ done: true }), items: loot, players: { Dexon: dex } });
	w.cryptTick();
	t.eq('the merchant away: Dexon is the fallback', JSON.stringify(w.sent), JSON.stringify([['Dexon', 1, 1]]));
}}, {

name: 'v37 crypt: the protected route - the box, the route to it, and steps that keep out of the box', fn(t) {
	const w = cw({ me: 'MageofOz' });
	const C = w.CRYPT_RUN;
	t.eq('the route ends at the bat spot', JSON.stringify(C.route[C.route.length - 1]), JSON.stringify([C.vbatSpot.x, C.vbatSpot.y]));
	t.eq('and starts at the entrance', JSON.stringify(C.route[0]), JSON.stringify([C.entrance.x, C.entrance.y]));
	t.eq('no route leg enters the box', C.route.slice(1).some((v, i) => w.crCrossesBox({ x: C.route[i][0], y: C.route[i][1] }, { x: v[0], y: v[1] }, 0)), false);
	t.eq('the bat spot is outside the box', w.crInBox(C.vbatSpot, 0), false);
	t.eq('the old spot was inside it', w.crInBox({ x: 1190, y: -380 }, 0), true);
	t.eq('protected: the box', w.crProtected({ x: 1300, y: -400 }), true);
	t.eq('protected: the entrance corridor, the pull room, a7\'s hall', [w.crProtected({ x: -20, y: -200 }), w.crProtected({ x: -250, y: -460 }), w.crProtected({ x: 400, y: -1070 })].join(), 'true,true,true');
	t.eq('not protected: a3\'s hall (ruling 2 - only the bat route)', w.crProtected({ x: 1500, y: -1480 }), false);
	t.eq('the far end of the pull room: by the branch alone', [w.crPolyDist({ x: -330, y: -430 }, C.route) > C.routeR, w.crProtected({ x: -330, y: -430 })].join(), 'true,true');
	t.eq('a leg from south of the box to the spot crosses it', w.crCrossesBox({ x: 1200, y: -280 }, C.vbatSpot), true);
	t.eq('a leg along the north edge does not', w.crCrossesBox({ x: 790, y: -640 }, C.vbatSpot), false);
	t.eq('route next: from the entrance toward the spot, the next vertex', JSON.stringify(w.crRouteNext({ x: 0, y: 0 }, C.vbatSpot)), JSON.stringify({ x: -30, y: -380 }));
	t.eq('off the route: its nearest vertex first', JSON.stringify(w.crRouteNext({ x: 400, y: -1000 }, C.vbatSpot)), JSON.stringify({ x: 750, y: -1070 }));
	t.eq('back the other way', JSON.stringify(w.crRouteNext({ x: 750, y: -1070 }, { x: 0, y: 0 })), JSON.stringify({ x: -50, y: -1070 }));
	t.eq('at the vertex nearest the target: straight on', w.crRouteNext({ x: 960, y: -505 }, C.vbatSpot).end, true);
	w.character.real_x = 1200; w.character.real_y = -280;
	t.eq('a safe step that would cross the box goes by the route', JSON.stringify(w.crSafeStep(C.vbatSpot, 'k')), JSON.stringify({ x: 950, y: -500 }) === 'x' ? 'x' : JSON.stringify(w.crRouteNext({ x: 1200, y: -280 }, C.vbatSpot)));
	const s = src();
	t.ok('a crypt-run kite step never lands in the box', /if \(cryptAuto && mode === 'crypt' && character\.map === 'crypt' && crInBox\(\{ x: nx, y: ny \}, 10\)\) continue;/.test(s));
	t.ok('a closing step that would cross the box goes by the route', /if \(cryptRunHere\(\) && crCrossesBox\(crPos\(character\), lp\)\) \{ crSafeStep\(lp, 'recover'\); return; \}/.test(s));
	t.ok('so does a rejoin', /if \(joinWanted\(gap\)\) \{ if \(crCrossesBox\(crPos\(character\), lp\)\) crSafeStep\(lp, 'rejoin'\); else joinStep\(lp, gap\); \}/.test(s));
	t.eq('the a2 station never takes a box point', w.crNearVbat({ x: 1000, y: -420 }, R({ cleared: { vbat: true } })), true);
}}, {

name: 'v37 crypt: a death is put down to the strongest monster on the member', fn(t) {
	const now = Date.now();
	const w = cw({ me: 'FatherToken', run: R(), monsters: [{ id: 'v', mtype: 'vbat', target: 'FatherToken', x: 0, y: 0 }, { id: '8', mtype: 'a8', target: 'FatherToken', x: 0, y: 0 }, { id: 'v2', mtype: 'vbat', target: 'FatherToken', x: 0, y: 0 }] });
	w.crCs.run = 'INST1';
	w.cryptSeeTick(now);
	t.eq('a8 and two vbat on him: a8', w.crOnMe.mtype, 'a8');
	w.character.rip = true;
	w.cryptSeeTick(now + 100);
	t.eq('and his death is put down to a8', w.crunRead().deaths[0].by, 'a8');
	t.ok('said so', w.said.some((m) => /died to a8/.test(m)));
	const x = cw({ me: 'Dexon', run: R(), monsters: [{ id: 's', mtype: 'a6', x: 100, y: -100 }] });
	x.cryptSeeTick(now);
	t.eq('a stray goes in the beacon\'s str list', x.crCs.str.map((a) => a.mtype).join(), 'a6');
}}, {

name: 'v37 crypt: a8 is never kited or attacked - the mage scares it, anyone else backs off west, the bats wait', fn(t) {
	const now = Date.now();
	const a8 = (target, x, y) => ({ id: '8', mtype: 'a8', target: target, x: x, y: y, real_x: x, real_y: y });
	let w = cw({ me: 'FatherToken', monsters: [a8('FatherToken', 1000, -500)] });
	t.eq('a8 on me is not a stray to kite', w.crStraysOnMe().length, 0);
	t.eq('and never attacked, even on me', w.mayAttack(a8('FatherToken', 0, 0)), false);
	w = cw({ me: 'FatherToken', x: 950, y: -500, run: R(), monsters: [a8('Dexon', 1000, -480)], beacons: { Dexon: B('Dexon') } });
	t.ok('a8 on Dexon: the chase is stamped', !!w.crA8Chase(now));
	t.eq('for the tabs that cannot see it', JSON.parse(w.ls.m.crypt_a8).who, 'Dexon');
	t.eq('the back-off steps west along the route, to the first vertex past its 300', w.crA8Retreat({ x: 1000, y: -480 }) && JSON.stringify(w.moved[0]), JSON.stringify([750, -740]));
	const x = cw({ me: 'MageofOz', storage: { crypt_a8: w.ls.m.crypt_a8 } });
	t.ok('another tab reads the stamp', !!x.crA8Chase(now + 100));
	t.eq('and it lapses', x.crA8Chase(now + x.CRYPT_RUN.a8ChaseMs + 1), null);
	w = cw({ me: 'FatherToken', run: R(), monsters: [a8('MageofOz', 1000, -480)], beacons: { MageofOz: B('MageofOz', { esc: true, jacko: true }) } });
	t.eq('a8 on the mage with her scare ready: no chase - she scares it', w.crA8Chase(now), null);
	w = cw({ me: 'MageofOz', run: R(), monsters: [a8('MageofOz', 1000, -480)], skills: [] });
	t.ok('her scare not ready: the party backs off', !!w.crA8Chase(now));
	t.ok('the mage scares a8 off her', /if \(a8 && a8\.target === character\.name && haveSkill\('scare'\)\) \{\n\t\t\ttry \{ await telUse\('scare'\); bump\('a8Scares'\);/.test(src()));

	/* The bats wait while a8 is near them. */
	const dead = { m1: 'a3', m2: 'a7', m3: 'a2' };
	const near = (n) => B(n, { x: 950, y: -500, hpFrac: 1, mpFrac: 1 });
	return (async () => {
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: dead }), monsters: [a8(null, 1150, -420)], beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.ok('a8 by the box: the bats wait', w.said.some((m) => /a8 near the bats - waiting north of it/.test(m)));
		t.eq('no pull stamped', w.crunRead().pullOk, undefined);
		t.eq('backing off north along the route, out of its 300', JSON.stringify(w.moved[0]), JSON.stringify([790, -640]));
		t.eq('the wait is timed', w.crunRead().a8Since > 0, true);
		w.crunPatch((c) => { c.a8Since = now - w.CRYPT_RUN.a8WaitMs - 1; });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('five minutes: the bats are given up', w.crunRead().givenWhy.vbat, 'a8 stayed by the bats 5 min');
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: dead, a8Since: now - 1000 }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a8 gone: the wait is over', w.crunRead().a8Since, undefined);
		t.ok('and the pull stamped', w.crunRead().pullOk > 0);
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: { m1: 'a3', m2: 'a7' } }), monsters: [a8('Dexon', 1000, -480)],
			beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a8 on Dexon: the leader backs off west too', JSON.stringify(w.moved[0]), JSON.stringify([750, -740]));
		t.ok('saying so', w.said.some((m) => /a8 is on Dexon - backing off west along the route/.test(m)));
		w = cw({ me: 'FatherToken', x: 300, y: -1070, run: R({ dead: dead }), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		w.crA8Near = () => null;
		const z = cw({ me: 'FatherToken', run: R() });
		t.eq('a8 seen by a member near the bats, recently', !!z.crA8Near(R(), { Dexon: { cs: { run: 'INST1', seen: {}, died: [], zav: [{ id: '8', mtype: 'a8', x: 1100, y: -450, t: now }] } } }, now), true);
		t.eq('not a stale sighting', z.crA8Near(R(), { Dexon: { cs: { run: 'INST1', seen: {}, died: [], zav: [{ id: '8', mtype: 'a8', x: 1100, y: -450, t: now - 60000 }] } } }, now), null);
		t.eq('not one far from the bats', z.crA8Near(R(), { Dexon: { cs: { run: 'INST1', seen: {}, died: [], zav: [{ id: '8', mtype: 'a8', x: 1700, y: -900, t: now }] } } }, now), null);
	})();
}}, {

name: 'v37 crypt: the bats are pulled one at a time by Dexon, from outside the box', fn(t) {
	const now = Date.now();
	const dead = { m1: 'a3', m2: 'a7', m3: 'a2' };
	const near = (n, o) => B(n, Object.assign({ x: 950, y: -500, hpFrac: 1, mpFrac: 1 }, o || {}));
	const bat = (id, x, y, target) => ({ id: id, mtype: 'vbat', x: x, y: y, real_x: x, real_y: y, target: target || null });
	return (async () => {
		let w = cw({ me: 'FatherToken', x: 1190, y: -380, run: R({ dead: dead }), beacons: { Dexon: near('Dexon', { x: 1190, y: -380 }), MageofOz: near('MageofOz', { x: 1190, y: -380 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('the leader goes to the new spot north of the box', JSON.stringify([w.moves[0].x, w.moves[0].y]), JSON.stringify([950, -500]));
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: dead }), monsters: [bat('b1', 1100, -400)], beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('at the spot, rested, no bat on us: the pull is stamped', w.crunRead().pullOk, now);
		t.eq('and the leader does not walk to the bat', w.moves.length, 0);
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: dead }), monsters: [bat('b1', 1300, -380, 'MageofOz')], beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('a bat on us, out past the fight range: no new pull', w.crunRead().pullOk, undefined);
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: dead }), monsters: [bat('b1', 1100, -400)], beacons: { Dexon: near('Dexon', { mpFrac: 0.3 }), MageofOz: near('MageofOz') } });
		w.crSearch = { stage: 2, i: 0, spent: 0, lastAt: 0, done: {}, rested: true, restAt: 0 };
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('Dexon at 30% mp: rest before the next bat', w.crunRead().pullOk, undefined);
		t.ok('said', w.said.some((m) => /resting before the next bat - Dexon mp 30%/.test(m)));
		w.crBatRestSince = now - w.CRYPT_RUN.restMaxMs - 1;
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('capped like the stage rest', w.crunRead().pullOk, now);

		/* Dexon's half. */
		const dx = (o) => cw(Object.assign({ me: 'Dexon', x: 950, y: -500, character: { range: 192 }, run: R({ dead: dead, pullOk: now }) }, o));
		w = dx({ monsters: [bat('b1', 1300, -380), bat('b2', 1450, -350)] });
		t.eq('Dexon pulls the nearest bat', w.cryptPullTick(w.crunRead(), now) && w.crPull.id, 'b1');
		t.eq('from a stand point outside the box, within his range', [w.crInBox(w.crPull.stand, 0), Math.round(Math.hypot(w.crPull.stand.x - 1300, w.crPull.stand.y + 380))].join(), 'false,172');
		t.ok('reached in a straight line that keeps out of the box', !w.crCrossesBox({ x: 950, y: -500 }, w.crPull.stand, 5));
		t.eq('walking there in a straight line', w.moved.length, 1);
		w.character.real_x = w.crPull.stand.x; w.character.real_y = w.crPull.stand.y;
		w.dist = (a, b) => Math.hypot((a.real_x !== undefined ? a.real_x : a.x) - b.x, (a.real_y !== undefined ? a.real_y : a.y) - b.y);
		w.parent.entities = { b1: w.monsters[0] };
		t.eq('in range: one shot', w.cryptPullTick(w.crunRead(), now + 500) && JSON.stringify(w.attacks), JSON.stringify(['b1']));
		w.monsters[0].target = 'Dexon';
		w.cryptPullTick(w.crunRead(), now + 1000);
		t.eq('the bat on him: straight back to the spot', [w.crPull.phase, JSON.stringify(w.moved[w.moved.length - 1])].join(), 'back,[950,-500]');
		w.character.real_x = 950; w.character.real_y = -500;
		t.eq('back at the spot: the pull is over', w.cryptPullTick(w.crunRead(), now + 2000) || w.crPull, null);
		w = dx({ monsters: [bat('b1', 1100, -400)], run: R({ dead: dead, pullOk: now - 5000 }) });
		t.eq('no fresh stamp: no pull', w.cryptPullTick(w.crunRead(), now), false);
		w = dx({ monsters: [bat('b1', 1100, -400)], x: 700, y: -700 });
		t.eq('not at the spot: no pull', w.cryptPullTick(w.crunRead(), now), false);
		w = dx({ me: 'MageofOz', monsters: [bat('b1', 1100, -400)] });
		t.eq('only Dexon pulls', w.cryptPullTick(w.crunRead(), now), false);
		w = dx({ monsters: [bat('b1', 1300, -380)] });
		w.cryptPullTick(w.crunRead(), now);
		const free = w.crPull.stand;
		w = dx({ monsters: [bat('b1', 1300, -380), { id: '8', mtype: 'a8', x: free.x, y: free.y - 20, real_x: free.x, real_y: free.y - 20 }] });
		w.cryptPullTick(w.crunRead(), now);
		t.ok('a8 by the best stand point: another one, at least pullA8Avoid from it', w.crPull && Math.hypot(w.crPull.stand.x - free.x, w.crPull.stand.y - free.y + 20) >= w.CRYPT_RUN.pullA8Avoid);
		w = dx({ monsters: [bat('b1', 1300, -380)] });
		w.cryptPullTick(w.crunRead(), now);
		w.crPull.at = now - w.CRYPT_RUN.pullMaxMs - 1;
		w.character.real_x = w.crPull.stand.x; w.character.real_y = w.crPull.stand.y;
		w.parent.entities = { b1: w.monsters[0] };
		w.cryptPullTick(w.crunRead(), now);
		t.eq('a pull that takes too long comes back', w.crPull.phase, 'back');

		/* Who may shoot a bat. */
		w = cw({ me: 'MageofOz', run: R({ dead: dead }) });
		t.eq('a bat not on us: nobody but the puller', w.mayAttack(bat('b1', 1100, -400)), false);
		t.eq('a bat on us: everyone', w.mayAttack(bat('b1', 1100, -400, 'Dexon')), true);
		w.crPull = { id: 'b1' };
		t.eq('the bat being pulled: the puller', w.mayAttack(bat('b1', 1100, -400)), true);
		t.ok('Dexon\'s pull runs in the follower branch', /\/\* v37, ruling 4: Dexon pulls the bats\. \*\/\n\tif \(cryptPullTick\(run, now\)\) return true;/.test(src()));
	})();
}}, {

name: 'v37 crypt: a death loop walks back alone once the route is clear; the leader collects only otherwise', fn(t) {
	const now = Date.now();
	const all3 = { m1: 'a3', m2: 'a7', m3: 'a2' };
	let w = cw({ me: 'MageofOz', run: R() });
	t.eq('a7 alive: blocked', w.cryptRouteBlocked(R({ dead: { m1: 'a3', m3: 'a2' } }), {}, now), 'a7 is alive');
	t.eq('a2 given up counts as gone', w.cryptRouteBlocked(R({ dead: { m1: 'a3', m2: 'a7' }, givenUp: { a2: now } }), {}, now), null);
	t.eq('all three dead and nothing seen: clear', w.cryptRouteBlocked(R({ dead: all3 }), {}, now), null);
	const bs = (zav, str) => ({ Dexon: { cs: { run: 'INST1', seen: {}, died: [], zav: zav || [], str: str || [] } } });
	t.eq('a8 seen by the route: blocked', w.cryptRouteBlocked(R({ dead: all3 }), bs([{ id: '8', mtype: 'a8', x: 900, y: -600, t: now }]), now), 'a8 was seen by it');
	t.eq('a stray seen by it: blocked', w.cryptRouteBlocked(R({ dead: all3 }), bs([], [{ id: 's', mtype: 'a6', x: 0, y: -600, t: now }]), now), 'a6 was seen by it');
	t.eq('long ago: clear', w.cryptRouteBlocked(R({ dead: all3 }), bs([{ id: '8', mtype: 'a8', x: 900, y: -600, t: now - w.CRYPT_RUN.avoidMs - 1 }]), now), null);
	t.eq('far from the route: clear', w.cryptRouteBlocked(R({ dead: all3 }), bs([{ id: '8', mtype: 'a8', x: 1800, y: -1500, t: now }]), now), null);

	w = cw({ me: 'MageofOz', run: R({ dead: all3 }), beacons: { FatherToken: B('FatherToken', { x: 950, y: -500 }) } });
	w.deathLoop = true;
	t.eq('death loop, route clear: she walks back', w.cryptFollowerInside(w.crunRead(), now) && JSON.stringify(w.moved[0]), JSON.stringify([-30, -380]));
	w = cw({ me: 'MageofOz', run: R({ dead: { m1: 'a3', m2: 'a7' } }), beacons: { FatherToken: B('FatherToken', { x: 950, y: -500 }) } });
	w.deathLoop = true;
	w.cryptFollowerInside(w.crunRead(), now);
	t.eq('a2 alive: she holds at the entrance', w.moved.length + w.moves.length, 0);
	return (async () => {
		const loopB = (over) => B('MageofOz', Object.assign({ x: 0, y: 0, loop: true, rest: true }, over || {}));
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: { m1: 'a3', m2: 'a7' } }), beacons: { Dexon: B('Dexon', { x: 950, y: -500 }), MageofOz: loopB() } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.ok('a2 alive: the leader collects her', w.said.some((m) => /collecting MageofOz/.test(m)));
		w = cw({ me: 'FatherToken', x: 950, y: -500, run: R({ dead: all3 }), beacons: { Dexon: B('Dexon', { x: 950, y: -500 }), MageofOz: loopB() } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('route clear: he does not leave the bats', w.said.some((m) => /collecting MageofOz/.test(m)), false);
	})();
}}, {

name: 'v37 crypt: rest under attack, the room ask, and a2 with no way past 300', fn(t) {
	const now = Date.now();
	return (async () => {
		let w = cw({ me: 'FatherToken', run: R(), fighting: true, character: { mp: 300, max_mp: 1000 },
			beacons: { Dexon: B('Dexon', { x: 0, y: 0 }), MageofOz: B('MageofOz', { x: 0, y: 0 }) } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('ruling 5: the stage rest does not hold while the party is fighting', w.said.some((m) => /resting before stage/.test(m)), false);
		t.eq('and is still owed afterwards', w.crSearch.rested, false);

		w = cw({ me: 'Dexon', map: 'cave', x: 500, y: 500, esize: 4 });
		w.cryptRoomTick(now);
		t.eq('Dexon short of room away from the door: no ask', w.cms.length, 0);
		w = cw({ me: 'Dexon', map: 'cave', x: -193, y: -1296, esize: 4, run: R() });
		w.cryptRoomTick(now);
		t.eq('at the door with a run still on: no ask', w.cms.length, 0);
		w = cw({ me: 'Dexon', map: 'cave', x: -193, y: -1296, esize: 4, run: R({ done: true }) });
		w.cryptRoomTick(now);
		t.eq('at the door between runs: ask', w.cms.length, 1);

		const a2 = { id: 'b', mtype: 'a2', target: 'MageofOz', x: 20, y: -20, real_x: 20, real_y: -20, s: { anger: { ms: 7000 } } };
		w = cw({ me: 'MageofOz', x: 0, y: 0, run: R(), monsters: [a2], blocked: true,
			storage: { crypt_a2: JSON.stringify({ run: 'INST1', mode: 'one', who: 'MageofOz', at: now, tickAt: now + 7000 }) } });
		w.crA2Move(a2, w.crunRead(), now);
		t.eq('cornered at the entrance: the stuck mark', w.crA2Stuck, now);
		t.ok('said what she does', w.said.some((m) => /no way past 300 from a2 from here - scaring or blinking/.test(m)));
		const bp = w.crA2BlinkPoint(a2, w.crunRead());
		t.eq('a blink point past him, at least 340 away, outside the box and zone', [bp && Math.hypot(bp.x - 20, bp.y + 20) >= 340, bp && w.crInBox(bp, 10)].join(), 'true,false');
		t.ok('the mage re-scares, else blinks, when cornered', /if \(a2 && a2\.target === character\.name && now - crA2Stuck < 2000\) \{\n\t\t\tif \(haveSkill\('scare'\)\)/.test(src()));
		w = cw({ me: 'Dexon', x: 0, y: 0, run: R(), monsters: [a2] });
		w.can_move_to = (x, y) => y > 0;
		const fp = w.crA2FarPoint(a2, w.crunRead());
		t.ok('anyone else: the walkable point farthest from him', fp && fp.y > 0 && Math.hypot(fp.x - 20, fp.y + 20) > 200);

		/* v36's survivor: a rate needs rateMinMs of history. */
		w = cw({ me: 'FatherToken' });
		w.crHpHist.Dexon = [{ t: now - 500, hp: 5000 }, { t: now, hp: 4000 }];
		t.eq('half a second of history: no rate yet', w.crLossRate('Dexon', now), null);
	})();
}}, {

name: 'v38 crypt: while a rest is owed every tab drinks to the rest lines, mp first, the hp-crit drink first of all', fn(t) {
	const now = Date.now();
	const near = (n, over) => B(n, Object.assign({ x: 10, y: 10, hpFrac: 1, mpFrac: 1 }, over || {}));
	const src = () => fs.readFileSync(path.join(ROOT, 'CaveRun.js'), 'utf8');
	t.ok('the source pins the potion lines this suite stubs', /potHpCrit: 0\.50,\n\tpotMpLow: 0\.60,\n\tpotHpTop: 0\.85,/.test(src()));
	return (async () => {
		/* The leader resting before a stage stamps it; a done rest does not. */
		let w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon', { mpFrac: 0.5 }), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('resting before a stage: the run carries restOwed', w.crunRead().restOwed, now);
		t.ok('and a tab reads it as owed', w.crRestOwed(now + 4000));
		t.ok('not once it is older than restOwedMs', !w.crRestOwed(now + w.CRYPT_RUN.restOwedMs + 1));
		w = cw({ me: 'FatherToken', run: R(), beacons: { Dexon: near('Dexon'), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('nobody short: no stamp', w.crunRead().restOwed, undefined);
		w = cw({ me: 'FatherToken', run: R(), fighting: true, beacons: { Dexon: near('Dexon', { mpFrac: 0.5 }), MageofOz: near('MageofOz') } });
		await w.cryptLeaderInside(w.crunRead(), now);
		t.eq('fighting: no rest, no stamp', w.crunRead().restOwed, undefined);

		/* The stamp is at most once a second. */
		w = cw({ me: 'FatherToken', run: R() });
		w.crRestStamp(now); w.crRestStamp(now + 999);
		t.eq('a second stamp inside 1s does not write', w.crunRead().restOwed, now);
		w.crRestStamp(now + 1000);
		t.eq('at 1s it does', w.crunRead().restOwed, now + 1000);

		/* Owed only in a live crypt run, on the crypt map. */
		w = cw({ me: 'Dexon', run: R({ restOwed: now }) });
		t.ok('a follower on the crypt map: owed', w.crRestOwed(now));
		w = cw({ me: 'Dexon', run: R({ restOwed: now, done: true }) });
		t.ok('the run is done: not owed', !w.crRestOwed(now));
		w = cw({ me: 'Dexon', map: 'cave', run: R({ restOwed: now }) });
		t.ok('off the crypt map: not owed', !w.crRestOwed(now));
		w = cw({ me: 'Dexon', run: R({ restOwed: now }) }); w.cryptAuto = false;
		t.ok('no crypt run: not owed', !w.crRestOwed(now));

		/* The bat rest stamps too. */
		const spot = { x: 950, y: -500 };
		w = cw({ me: 'FatherToken', x: spot.x, y: spot.y, run: R({ dead: { m1: 'a3', m2: 'a7', m3: 'a2' } }),
			beacons: { Dexon: near('Dexon', { x: spot.x, y: spot.y, hpFrac: 0.5 }), MageofOz: near('MageofOz', { x: spot.x, y: spot.y }) } });
		w.crBatRestSince = 0;
		w.cryptBatStage(w.crunRead(), { i: 2, types: ['vbat'] }, w.beacons(), now);
		t.eq('resting between bats: stamped', w.crunRead().restOwed, now);
		t.eq('and no pull stamped', w.crunRead().pullOk, undefined);

		/* potionTick reads it. */
		const drink = (over, owed) => {
			const x = cw({ me: 'Dexon', run: R(owed ? { restOwed: now } : {}), character: over });
			x.potionTick();
			return x.skills.slice();
		};
		t.eq('mp 70%, no rest: no drink', drink({ mp: 700, max_mp: 1000 }, false), []);
		t.eq('mp 70%, rest owed: mp', drink({ mp: 700, max_mp: 1000 }, true), ['use_mp']);
		t.eq('hp 88%, no rest: no drink', drink({ hp: 880, mp: 1000, max_mp: 1000 }, false), []);
		t.eq('hp 88%, rest owed: hp', drink({ hp: 880, mp: 1000, max_mp: 1000 }, true), ['use_hp']);
		t.eq('both short, rest owed: mp first', drink({ hp: 880, mp: 700, max_mp: 1000 }, true), ['use_mp']);
		t.eq('hp under the crit line: hp first of all, owed or not', drink({ hp: 400, mp: 100, max_mp: 1000 }, true), ['use_hp']);
		t.eq('at the rest lines: no drink', drink({ hp: 900, mp: 800, max_mp: 1000 }, true), []);
		t.eq('below the plain mp line, no rest: mp as before', drink({ mp: 500, max_mp: 1000 }, false), ['use_mp']);
		t.eq('dead: nothing', drink({ rip: true, hp: 0, mp: 0, max_mp: 1000 }, true), []);

		/* The crypt's death-loop line. */
		t.ok("the crypt's death-loop line names the entrance", /mode === 'crypt'\s*\? ' min\. Holding at the crypt entrance/.test(src()));
	})();
}}];
