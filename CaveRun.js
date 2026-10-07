// CaveRun.js - one script for Dexon / FatherToken / MageofOz - v7 (TEST BUILD)
// v7 2026-10-06 dry-run mode, configurable leader, latched cohesion recovery,
//               potions, skill range gating, scare, reason-counter telemetry
// v6 2026-10-06 auto-party with retry, looting
// v4 2026-10-06 first live cave run - IIFE wrapper, vote mirroring proven
//
// Cave of Many Dreams. Deploy the SAME file to all three combat slots.
// Standalone on purpose: it touches none of the farm builds, so iteration is
// cheap. Port what survives into Ranger/Priest/Mage once it earns its place.
//
// WHO LEADS IS CONFIGURABLE. caveLead('FatherToken') writes a key all three
// tabs read - same origin, so one call retargets the whole party. Measured
// 2026-10-06: Dexon 74 speed, FatherToken 59, MageofOz 55. A follower CANNOT
// converge on a faster leader; driving Dexon gave closing rates of -15 and
// -19 u/s and 11-12 minutes per character outside the leash. Drive the priest.
//
// COMMANDS   caveDry()   on-map rehearsal - never enters, no staging, no votes
//            caveGo()    gather at Dorr for a real run
//            caveEnter() leader only, cave mode only
//            caveLead(name) caveStatus() caveStop() caveDump()
//
// ENTRY IS MANUAL BY DESIGN. One visit per account per day; an accidental
// enter() burns it. Combat is also held while staged, because the gate refuses
// anyone with targets > 0 (generated_maps.js:434 -> bring_party_to_keeper).

/* EVERYTHING IS WRAPPED IN AN IIFE. The CODE slot is evaluated into a scope
   that already holds names from the client and anything else loaded, and a
   top-level `const T` collided with one on the very first engage:
   "Identifier 'T' has already been declared", which kills the whole file at
   line 1. Nothing here is global any more; the commands reach the outside
   through the window.* assignments at the bottom, which is all they ever
   needed. The body is deliberately left un-indented so this wrapper stays a
   two-line change rather than reflowing every line. */
(function () {

/* A second engage without a reload would otherwise start a SECOND set of
   loops on top of the first - double ticks, double moves, double attacks.
   Each load claims a generation; older loops see they are superseded and
   stop rescheduling themselves. */
try { window.__caveGen = (window.__caveGen || 0) + 1; } catch (e) {}
const MY_GEN = (function () { try { return window.__caveGen; } catch (e) { return 1; } })();
function alive() { try { return window.__caveGen === MY_GEN; } catch (e) { return true; } }

const TEAM = ['Dexon', 'FatherToken', 'MageofOz'];
const LEADER_KEY = 'cave_leader';
const DEFAULT_LEADER = 'Dexon';

/* LEADER IS READ, NEVER CAPTURED. v6 held it in a const inside this IIFE,
   which made it unreachable from outside and forced an edit-and-redeploy to
   change who drives. localStorage is shared across every adventure.land tab,
   so one caveLead() retargets all three at once. */
function leaderName() {
	try { const v = parent.localStorage.getItem(LEADER_KEY); if (v && TEAM.indexOf(v) >= 0) return v; } catch (e) {}
	return DEFAULT_LEADER;
}
function role() { return character.name === leaderName() ? 'leader' : 'follower'; }
function isLeader() { return role() === 'leader'; }
function followers() { const L = leaderName(); return TEAM.filter((n) => n !== L); }

const CFG = {
	keeper: { map: 'main', x: 816, y: 1200 },
	partyMs: 5000,
	acceptMs: 3000,
	engageHoldMs: 8000,
	healAt: 0.78,
	partyHealAt: 0.6,
	tickMs: 250,
	voteTickMs: 400,
	doorNear: 40,
	stageWithin: 120,
	logEveryMs: 6000,
	potMs: 2100,            // use_hp/use_mp share a 2000ms cooldown
	potHpCrit: 0.50,
	potMpLow: 0.60,
	potHpTop: 0.85,
	scareAt: 2,             // attackers on me before the jacko comes out
	scareHpAt: 0.60,        // or one attacker while this hurt
	autoRespawn: true,      // bare respawn() - the only parameterless one that exists
};

/* MOVEMENT. closeAt/releaseAt are a latch, not a threshold - v6 compared gap
   against a single leash of 70, so a 55-unit kite step could push the gap back
   over it and the next tick closed again. 2064 close steps against 486 kite
   steps, cancelling. Numbers are sized to MEASURED ranges, not guesses:
   priest heal 201, Dexon attack 163, mage attack 229. The ceiling stays inside
   the priest's 201 so a kite step can never leave heal range. */
const MOVE = {
	closeAt: 180,
	releaseAt: 120,
	ceiling: 195,
	kiteRadius: 90,
	kiteStep: 55,
	speedEdge: 1.05,
	closeStepMax: 110,
	staleSlack: 60,
	smartMoveMaxMs: 8000,
};

let mode = 'cave';         // cave | dry
let phase = 'idle';        // idle | gather | staged | inside | active (dry)
let stopped = false;
let engagedUntil = 0;
let votedFor = {};
let lastLog = 0;
let lastDoorTry = 0;
let lastPot = 0;
let deadDoors = {};        // a locked door is not retried every three seconds

/* COHESION RECOVERY IS LATCHED AND UNINTERRUPTIBLE. Past closeAt the follower
   commits to reaching the leader and nothing else may move it - no kiting, no
   door logic - until the gap is back inside releaseAt. The aim point is only
   refreshed once the leader has walked staleSlack away from it, so a moving
   leader is still tracked without restarting pathing every tick. */
let recovering = false;
let aim = null;
let smartFlight = 0;

const isFn = (f) => typeof f === 'function';
function clog(m, c) { try { game_log('[cave] ' + m, c || '#8b98ab'); } catch (e) {} try { console.log('[cave] ' + m); } catch (e) {} }
function throttleLog(m) { if (Date.now() - lastLog < CFG.logEveryMs) return; lastLog = Date.now(); clog(m); }

function inCave() { try { return parent.G.maps[character.map] && parent.G.maps[character.map].generated && parent.G.maps[character.map].generated.zone === 'dreams'; } catch (e) { return false; } }
function caveState() { try { return character.cave || null; } catch (e) { return null; } }

/* THE CAVE PAUSES, AND v6 HAD NO IDEA. Measured 2026-10-06: paused on 57-64 of
   every ~157 ticks, about 37% of the run. While paused the server refuses BOTH
   attack and move with cave_paused - 869 failed attacks against 24 landed on
   the mage. Guarded for an absent cave so the same code path runs in dry mode. */
function cavePaused() { try { const c = character.cave; return !!(c && c.paused); } catch (e) { return false; } }

function here(e) { return e && !e.rip && (!e.map || e.map === character.map); }
function dist(a, b) { return Math.hypot((a.real_x !== undefined ? a.real_x : a.x) - (b.real_x !== undefined ? b.real_x : b.x), (a.real_y !== undefined ? a.real_y : a.y) - (b.real_y !== undefined ? b.real_y : b.y)); }

function leaderEntity() { try { return parent.entities[leaderName()] || null; } catch (e) { return null; } }
function leaderPos() {
	const e = leaderEntity();
	if (here(e)) return { x: e.real_x !== undefined ? e.real_x : e.x, y: e.real_y !== undefined ? e.real_y : e.y };
	try { const p = (parent.party || {})[leaderName()]; if (p && p.x != null && (p.map || p.in) === character.map) return { x: p.x, y: p.y }; } catch (e) {}
	return null;
}
function leaderMap() { try { const p = (parent.party || {})[leaderName()]; return (p && (p.map || p.in)) || null; } catch (e) { return null; } }

/* active() replaces v6's bare phase === 'inside' test, which made an on-map
   rehearsal impossible: both combatTick and moveTick returned immediately
   anywhere but inside the cave, so nothing could be exercised without
   spending the one daily run. */
function active() { return mode === 'dry' ? phase === 'active' : phase === 'inside'; }

// ------------------------------------------------------------- threats -----
function threats() {
	const out = [];
	try {
		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (!e || e.type !== 'monster' || e.dead || (e.map && e.map !== character.map)) continue;
			out.push(e);
		}
	} catch (e) {}
	return out;
}
function partyNames() { try { const n = Object.keys(parent.party || {}); return n.length ? n : [character.name]; } catch (e) { return [character.name]; } }
function monsterOnParty() {
	const names = partyNames();
	return threats().some((m) => m.target && names.indexOf(m.target) >= 0);
}
function attackersOnMe() { let n = 0; for (const m of threats()) if (m.target === character.name) n++; return n; }

function noteEngagement() {
	const e = leaderEntity();
	if ((e && e.target) || monsterOnParty()) engagedUntil = Date.now() + CFG.engageHoldMs;
}
function engaged() { return Date.now() < engagedUntil; }

function inRangeFor(t, skill) {
	if (!t) return false;
	try { if (isFn(is_in_range)) return skill ? is_in_range(t, skill) : is_in_range(t); } catch (e) {}
	return true;
}

function pickTarget() {
	if (!engaged()) return null;
	try {
		const le = leaderEntity();
		if (le && le.target) {
			const t = parent.entities[le.target];
			if (t && t.type === 'monster' && !t.dead && inRangeFor(t)) return t;
		}
	} catch (e) {}
	const names = partyNames();
	let best = null, bestD = Infinity;
	for (const m of threats()) {
		if (!m.target || names.indexOf(m.target) < 0) continue;
		const d = dist(character, m);
		if (d < bestD && inRangeFor(m)) { best = m; bestD = d; }
	}
	if (best) return best;
	try { if (isFn(get_nearest_monster)) { const n = get_nearest_monster(); if (n && inRangeFor(n)) return n; } } catch (e) {}
	return null;
}

// -------------------------------------------------------------- skills -----
/* Self-configuring: class, level, mp, cooldown AND equipment slot. The slot
   check is what makes scare self-gating - G.skills.scare declares
   slot [["orb","jacko"]], so the mage uses it only while the jacko is on. */
function haveSkill(name) {
	try {
		const s = parent.G.skills[name];
		if (!s) return false;
		if (s.class && s.class.indexOf(character.ctype) < 0) return false;
		if (s.level && character.level < s.level) return false;
		if (s.mp && character.mp < s.mp) return false;
		if (s.slot) {
			let ok = false;
			for (let i = 0; i < s.slot.length; i++) {
				const sl = s.slot[i][0], item = s.slot[i][1];
				try { const eq = character.slots[sl]; if (eq && eq.name === item) { ok = true; break; } } catch (e) {}
			}
			if (!ok) return false;
		}
		if (isFn(is_on_cooldown) && is_on_cooldown(name)) return false;
		return true;
	} catch (e) { return false; }
}
function allies() {
	const out = [];
	for (const nm of partyNames()) {
		const e = nm === character.name ? character : (parent.entities || {})[nm];
		if (here(e)) out.push(e);
	}
	return out;
}
function hurtAlly(frac) {
	let worst = null, w = 1;
	for (const a of allies()) { const f = a.hp / a.max_hp; if (f < w) { w = f; worst = a; } }
	return w < frac ? worst : null;
}

/* v6 swallowed the reason: catch (e) { tel.skillFail[name]++ }. curse came back
   1113 failures against 42 successes with nothing to say why, and energize
   538 against 3. Both were out-of-range calls - local throws from use_skill,
   which never reach game_response, so the socket tally could not see them
   either. The reason is recorded now. */
async function telUse(name, a, b) {
	try {
		const r = b !== undefined ? await use_skill(name, a, b) : (a !== undefined ? await use_skill(name, a) : await use_skill(name));
		tel.skills[name] = (tel.skills[name] || 0) + 1; return r;
	} catch (e) { noteWhy(name, e); throw e; }
}
function noteWhy(name, e) {
	tel.skillFail[name] = (tel.skillFail[name] || 0) + 1;
	let r = 'unknown';
	try { r = String((e && (e.reason || e.response || e.message)) || e).slice(0, 48); } catch (x) {}
	if (!tel.skillFailWhy[name]) tel.skillFailWhy[name] = {};
	tel.skillFailWhy[name][r] = (tel.skillFailWhy[name][r] || 0) + 1;
}

async function priestSkills(target) {
	const hurtCount = allies().filter((a) => a.hp / a.max_hp < CFG.partyHealAt).length;
	if (hurtCount >= 2 && haveSkill('partyheal')) { try { await telUse('partyheal'); return true; } catch (e) {} }
	const ally = hurtAlly(CFG.healAt);
	if (ally && inRangeFor(ally, 'heal')) { try { await heal(ally); tel.skills.heal = (tel.skills.heal || 0) + 1; return true; } catch (e) { noteWhy('heal', e); } }
	if (target && haveSkill('curse') && inRangeFor(target, 'curse') && !(target.s && target.s.cursed)) {
		try { await telUse('curse', target); return true; } catch (e) {}
	}
	if (haveSkill('absorb')) {
		const le = leaderEntity();
		if (here(le) && inRangeFor(le, 'absorb') && threats().filter((m) => m.target === leaderName()).length >= 3) {
			try { await telUse('absorb', le); return true; } catch (e) {}
		}
	}
	return false;
}
async function mageSkills(target) {
	/* Scare first: it is a survival action and its whole point is shedding the
	   pack already on her. haveSkill() has verified the jacko is equipped. */
	if (haveSkill('scare')) {
		const n = attackersOnMe();
		if (n >= CFG.scareAt || (n >= 1 && character.hp / character.max_hp < CFG.scareHpAt)) {
			try { await telUse('scare'); bump('scares'); return true; } catch (e) {}
		}
	}
	if (haveSkill('energize')) {
		const le = leaderEntity();
		const to = here(le) && le.mp != null && le.max_mp && le.mp / le.max_mp < 0.5 && inRangeFor(le, 'energize') ? le : null;
		if (to) { try { await telUse('energize', to); return true; } catch (e) {} }
	}
	if (target && haveSkill('cburst') && inRangeFor(target, 'cburst')) { try { await telUse('cburst', [[target.id, character.mp * 0.5]]); return true; } catch (e) {} }
	return false;
}

async function combatTick() {
	if (stopped || !active() || character.rip) return;
	if (cavePaused()) { bump('pausedAttackSkipped'); return; }
	noteEngagement();
	const target = pickTarget();
	try {
		if (character.ctype === 'priest') { if (await priestSkills(target)) return; }
		else if (character.ctype === 'mage') { if (await mageSkills(target)) return; }
	} catch (e) {}
	if (!target) {
		/* v6 bumped this whenever engaged with no target, which the 8s
		   engagement hold alone explains - 32 idle ticks after every kill.
		   Only count it when there is something visible we cannot act on. */
		if (engaged() && threats().length) bump('noTargetWhileEngaged');
		return;
	}
	try {
		if (isFn(can_attack) && !can_attack(target)) return;
		if (!isLeader()) change_target(target);
		await attack(target);
		bump('attacks');
	} catch (e) { bump('attackFail'); noteWhy('attack', e); }
}

// ------------------------------------------------------------ movement -----
function kiteStep(lp) {
	const hurt = character.hp / character.max_hp < 0.5;
	const near = threats()
		.filter((m) => dist(character, m) < MOVE.kiteRadius)
		.filter((m) => hurt || !m.speed || character.speed > m.speed * MOVE.speedEdge);
	if (!near.length) return null;
	const gapNow = lp ? Math.hypot(character.real_x - lp.x, character.real_y - lp.y) : 0;
	let best = null, bestScore = -Infinity;
	for (let i = 0; i < 12; i++) {
		const a = (Math.PI * 2 * i) / 12;
		const nx = character.real_x + Math.cos(a) * MOVE.kiteStep;
		const ny = character.real_y + Math.sin(a) * MOVE.kiteStep;
		if (isFn(can_move_to) && !can_move_to(nx, ny)) continue;
		/* NO RATCHETING OUTWARD. The ceiling alone let the follower walk itself
		   to the top of the dead band and park there - harness measured it
		   settling at 177 with a mob glued 40u away, which is a hair inside the
		   priest's 201 heal range and no margin at all. Past releaseAt a kite
		   step may hold the gap or shrink it, never grow it, so kiting becomes
		   tangential instead of a slow retreat. */
		if (lp) {
			const gapNew = Math.hypot(nx - lp.x, ny - lp.y);
			if (gapNew > MOVE.ceiling) continue;
			if (gapNow > MOVE.releaseAt && gapNew > gapNow + 1) continue;
		}
		let minD = Infinity;
		for (const m of near) minD = Math.min(minD, Math.hypot(nx - (m.real_x !== undefined ? m.real_x : m.x), ny - (m.real_y !== undefined ? m.real_y : m.y)));
		if (minD > bestScore) { bestScore = minD; best = { x: nx, y: ny }; }
	}
	if (!best) return null;
	let cur = Infinity;
	for (const m of near) cur = Math.min(cur, dist(character, m));
	return bestScore > cur + 8 ? best : null;
}

/* A locked door is not a door. v6 retried every 3s forever and, worse,
   returned true the whole time - which blocked cohesion entirely. doorOk was
   0 across a 29-minute run while the leader was never actually on another
   floor; the trigger was his death and respawn. */
async function followFloor() {
	if (mode === 'dry') return false;
	const lm = leaderMap();
	if (!lm || lm === character.map) return false;
	const st = caveState();
	const doors = (st && st.doors) || [];
	const door = doors.filter((d) => d.to === lm && !d.locked)[0];
	if (!door) {
		if (!deadDoors[lm]) { deadDoors[lm] = 1; throttleLog('leader on ' + lm + ' - no open door from here, holding station'); ev('noDoor', lm); }
		return false;   // NOT true - never block cohesion on a door we cannot take
	}
	if (Math.hypot(door.x - character.real_x, door.y - character.real_y) > CFG.doorNear) {
		try { await smart_move({ map: character.map, x: door.x, y: door.y }); } catch (e) {}
		return true;
	}
	if (Date.now() - lastDoorTry < 3000) return true;
	lastDoorTry = Date.now();
	bump('doorTry'); ev('door', { to: lm });
	clog('taking the door to ' + lm, '#7FD1FF');
	try { await transport(door.to, 0); bump('doorOk'); ev('doorOk', lm); }
	catch (e) { ev('doorFail', String((e && (e.reason || e.message)) || e)); clog('transport refused: ' + (e && e.reason || e), 'orange'); }
	return true;
}

async function recoverStep(lp, gap) {
	if (!aim || Math.hypot(aim.x - lp.x, aim.y - lp.y) > MOVE.staleSlack) aim = { x: lp.x, y: lp.y };
	const direct = !isFn(can_move_to) || can_move_to(aim.x, aim.y);
	if (direct) {
		const step = Math.min(MOVE.closeStepMax, Math.max(30, gap - MOVE.releaseAt * 0.6));
		const a = Math.atan2(aim.y - character.real_y, aim.x - character.real_x);
		const nx = character.real_x + Math.cos(a) * step, ny = character.real_y + Math.sin(a) * step;
		try { if (!isFn(can_move_to) || can_move_to(nx, ny)) { move(nx, ny); bump('closeSteps'); } } catch (e) {}
		return;
	}
	/* Obstacle in the way - path around it, once. The in-flight guard carries a
	   watchdog because an unsettled smart_move promise is the documented way
	   these chains die silently. */
	if (smartFlight && Date.now() - smartFlight < MOVE.smartMoveMaxMs) return;
	smartFlight = Date.now();
	bump('closeSmart');
	try { await smart_move({ map: character.map, x: aim.x, y: aim.y }); } catch (e) { ev('closeSmartFail', String((e && (e.reason || e.message)) || e)); }
	smartFlight = 0;
}

async function moveTick() {
	if (stopped || character.rip) return;
	if (cavePaused()) { bump('pausedMoveSkipped'); return; }

	if (phase === 'gather') {
		if (character.map !== CFG.keeper.map || dist(character, CFG.keeper) > CFG.stageWithin) {
			try { await smart_move({ map: CFG.keeper.map, x: CFG.keeper.x, y: CFG.keeper.y }); } catch (e) {}
		}
		return;
	}
	if (isLeader()) { warnOutrun(); return; }
	if (!active()) return;

	const lp = leaderPos();
	if (!lp) { if (await followFloor()) return; return; }
	const gap = Math.hypot(lp.x - character.real_x, lp.y - character.real_y);
	tel.maxDistLeader = Math.max(tel.maxDistLeader, Math.round(gap));
	if (gap > MOVE.closeAt) tel.msBeyondLeash += CFG.tickMs;

	// --- the latch ---
	if (!recovering && gap > MOVE.closeAt) { recovering = true; aim = null; bump('recoveries'); ev('recover', { gap: Math.round(gap) }); }
	else if (recovering && gap <= MOVE.releaseAt) { recovering = false; aim = null; ev('recovered', { gap: Math.round(gap) }); }

	if (recovering) { tel.msRecovering += CFG.tickMs; await recoverStep(lp, gap); return; }

	if (await followFloor()) return;

	const k = kiteStep(lp);
	if (k) { try { move(k.x, k.y); bump('kiteSteps'); } catch (e) {} }
	else if (threats().some((m) => dist(character, m) < MOVE.kiteRadius)) bump('kiteRejected');
}

/* The driver is the only one who can fix an over-extension, and v6 surfaced it
   nowhere - the priest sat 230 seconds outside the leash with no indication in
   game. */
function warnOutrun() {
	try {
		let worst = 0, who = '';
		for (const nm of followers()) {
			const e = (parent.entities || {})[nm];
			if (!here(e)) continue;
			const d = dist(character, e);
			if (d > worst) { worst = d; who = nm; }
		}
		if (worst > MOVE.closeAt) { bump('outrunWarnTicks'); throttleLog('OUTRUNNING PARTY - ' + who + ' is ' + Math.round(worst) + 'u back (close at ' + MOVE.closeAt + ')'); }
	} catch (e) {}
}

// ------------------------------------------------------------- potions -----
/* hpot1 gives 400 against ~7000 max hp, so potions are a trickle, not a heal -
   the ladder keeps mp topped first because a dry priest heals nobody. Proven
   live 2026-10-06: ~90% land rate, zero errors, mage 608 -> 2875 mp. */
function potionTick() {
	if (stopped || character.rip) return;
	if (cavePaused()) return;
	const now = Date.now();
	if (now - lastPot < CFG.potMs) return;
	const hpF = character.hp / character.max_hp, mpF = character.mp / character.max_mp;
	let which = null;
	if (hpF < CFG.potHpCrit) which = 'use_hp';
	else if (mpF < CFG.potMpLow) which = 'use_mp';
	else if (hpF < CFG.potHpTop) which = 'use_hp';
	if (!which) return;
	lastPot = now;
	try { use_skill(which); bump(which === 'use_hp' ? 'hpPots' : 'mpPots'); }
	catch (e) { noteWhy(which, e); }
}

// ---------------------------------------------------------------- death ----
/* RESPAWN IS DELIBERATELY CONSERVATIVE, AND HERE IS WHY.
   Measured 2026-10-06: respawn() in the CODE context takes ZERO arguments
   (arity 0, 119 chars) and does nothing but socket.emit("respawn") - there is
   no destination, cost or option parameter to pass. The deployed dreams event
   definition contains NO respawn, revive, death or penalty field either; every
   amber/cost entry in it belongs to an encounter OPTION, i.e. the things the
   party votes on. So the free-vs-paid choice the operator sees on death is not
   reachable from any source available here.
   Rather than invent an emit that might spend the run's amber, this snapshots
   exactly what the cave offers at the moment of death, then calls the only
   parameterless respawn that exists. If the snapshot shows a cost dialog, the
   next run has the exact payload to use and this becomes a one-line change. */
let lastRespawn = 0, wasRip = false;
function deathSnapshot() {
	const snap = {};
	try {
		const c = character.cave;
		snap.caveKeys = c ? Object.keys(c) : null;
		if (c) {
			snap.paused = c.paused; snap.floor = c.floor; snap.gold = c.gold; snap.amber = c.amber;
			snap.limits = c.limits;
			for (const k in c) if (/respawn|revive|death|rip|penalt|cost|offer|prompt|modal/i.test(k)) snap['cave.' + k] = c[k];
			snap.choice = c.choice ? { id: c.choice.id, resolved: !!c.choice.resolved,
				options: (c.choice.options || []).map((o) => ({ id: o.id, cost: o.cost, amber: o.amber })) } : null;
		}
	} catch (e) { snap.err = String(e); }
	try { for (const k in parent) if (/^(modal|dialog|prompt)/i.test(k)) snap['parent.' + k] = typeof parent[k]; } catch (e) {}
	try { snap.map = character.map; snap.x = Math.round(character.real_x); snap.y = Math.round(character.real_y); } catch (e) {}
	return snap;
}
function deathTick() {
	const rip = !!character.rip;
	if (rip && !wasRip) {
		wasRip = true;
		bump('partyDeaths');
		const snap = deathSnapshot();
		ev('died', snap);
		clog('DIED - snapshotting respawn options then respawning at the door', 'red');
	}
	if (!rip) {
		if (wasRip) {
			wasRip = false;
			/* Back on our feet somewhere other than the fight - go to the leader
			   and keep going, which is exactly the recovery latch. */
			recovering = true; aim = null; bump('recoveries'); ev('respawned', { map: character.map });
		}
		return;
	}
	if (!CFG.autoRespawn) return;
	if (Date.now() - lastRespawn < 4000) return;
	lastRespawn = Date.now();
	bump('respawnCalls');
	try { respawn(); } catch (e) { noteWhy('respawn', e); clog('respawn threw: ' + e, 'red'); }
}

// ---------------------------------------------------------------- vote -----
function voteTick() {
	if (stopped || mode === 'dry' || isLeader()) return;
	const st = caveState(), choice = st && st.choice;
	if (!choice || choice.resolved) return;
	if (choice.deadline && Date.now() > choice.deadline) return;
	if (votedFor[choice.id]) return;
	if (choice.votes && choice.votes[character.name]) { votedFor[choice.id] = choice.votes[character.name]; return; }
	const L = leaderName();
	const want = choice.votes && choice.votes[L];
	if (!want) return;
	if (!(choice.options || []).some((o) => o.id === want)) {
		clog('leader voted ' + want + ', not offered to me - skipping', 'orange');
		votedFor[choice.id] = '(unavailable)'; return;
	}
	votedFor[choice.id] = want;
	try {
		parent.socket.emit('interaction', { type: 'cave', action: 'vote', choice: choice.id, option: want,
			request_id: 'cr' + Math.random().toString(36).slice(2, 12) });
		bump('votesEcho'); ev('vote', { choice: choice.id, option: want });
		clog('mirrored ' + L + ': ' + want, '#7FD98A');
	} catch (e) { bump('voteErr'); ev('voteErr', String(e)); clog('vote emit failed: ' + e, 'red'); }
}

// ---------------------------------------------------------------- gate -----
function gateReport() {
	const out = [];
	const names = partyNames();
	if (names.length > 3) out.push('PARTY OF ' + names.length + ' - max 3');
	for (const nm of names) {
		const e = nm === character.name ? character : (parent.entities || {})[nm];
		if (!e) { out.push(nm + ': not visible (cannot verify)'); continue; }
		if (e.rip) out.push(nm + ': DEAD');
		if (e.map !== CFG.keeper.map) out.push(nm + ': on ' + e.map);
		if (e.targets > 0) out.push(nm + ': IN COMBAT (targets=' + e.targets + ')');
	}
	if (character.map === CFG.keeper.map && dist(character, CFG.keeper) > 160) out.push('me: >160u from Dorr');
	return out;
}

// ----------------------------------------------------------------- party ---
function partyHas(name) { try { return !!(parent.party && parent.party[name]); } catch (e) { return false; } }
function partyRoster() { try { return Object.keys(parent.party || {}); } catch (e) { return []; } }
function partyComplete() { return TEAM.every(partyHas); }

let lastInvite = 0, lastAccept = 0;
function partyTick() {
	if (stopped) return;
	if (isLeader()) {
		if (partyComplete() || Date.now() - lastInvite < CFG.partyMs) return;
		lastInvite = Date.now();
		const missing = followers().filter((n) => !partyHas(n));
		if (!missing.length) return;
		for (const n of missing) {
			try { send_party_invite(n); bump('invites'); } catch (e) { ev('inviteErr', String(e)); }
		}
		throttleLog('inviting ' + missing.join(', '));
		return;
	}
	const L = leaderName();
	if (partyHas(L) || Date.now() - lastAccept < CFG.acceptMs) return;
	lastAccept = Date.now();
	try { accept_party_invite(L); bump('accepts'); } catch (e) { ev('acceptErr', String(e)); }
}

function hookPartyInvite() {
	try {
		const prev = window.on_party_invite;
		window.on_party_invite = function (name) {
			try {
				if (alive() && !isLeader() && name === leaderName()) { accept_party_invite(name); bump('accepts'); ev('invited', name); }
			} catch (e) {}
			try { if (typeof prev === 'function') prev(name); } catch (e) {}
		};
	} catch (e) { clog('could not hook on_party_invite: ' + e, 'red'); }
}

// ------------------------------------------------------------------ loot ---
function lootTick() {
	if (stopped || character.rip) return;
	try {
		const chests = (typeof get_chests === 'function') ? get_chests() : null;
		if (!chests) return;
		if (!Object.keys(chests).length) return;
		loot();
		bump('lootCalls');
	} catch (e) { bump('lootErr'); }
}

// ------------------------------------------------------------ telemetry ----
/* Keyed by CLASS, not name. A key containing "Token" is redacted by output
   filters on the reading side, which would silently blind the priest's
   telemetry - measured 2026-10-06. */
const TEL_KEY = 'cave_tel_' + character.ctype;
const tel = {
	ver: 7, runId: 'r' + Date.now().toString(36), name: character.name, ctype: character.ctype,
	loadedAt: Date.now(), at: 0,
	/* COUNTER NAMES SAY WHAT THEY COUNT. v6 had a single `deaths` fed by
	   game.on('death'), which fires for EVERY entity; 91 of them got read as 91
	   party wipes when the real number was three. Split, permanently. */
	counters: { ticks: 0, engagedTicks: 0, pausedTicks: 0, pausedMoveSkipped: 0,
		pausedAttackSkipped: 0, attacks: 0, attackFail: 0, noTargetWhileEngaged: 0,
		closeSteps: 0, closeSmart: 0, kiteSteps: 0, kiteRejected: 0, recoveries: 0,
		outrunWarnTicks: 0, doorTry: 0, doorOk: 0,
		votesEcho: 0, voteErr: 0, entityDeaths: 0, partyDeaths: 0, respawnCalls: 0,
		hpPots: 0, mpPots: 0, scares: 0, exceptions: 0,
		invites: 0, accepts: 0, lootCalls: 0, lootErr: 0 },
	skills: {}, skillFail: {}, skillFailWhy: {},
	/* EVERY response reason, counted. v6 filtered them through TEL_REASONS
	   before recording, so distance / not_ready / no_mp / cooldown never
	   appeared at all and cave_paused looked more dominant than it was. The
	   regex now governs only the event ring, never the tally. */
	reasons: {},
	maxDistLeader: 0, msBeyondLeash: 0, msRecovering: 0, helpers: {}, events: [],
};
function bump(k, n) { tel.counters[k] = (tel.counters[k] || 0) + (n || 1); }
function bumpReason(r, place) {
	tel.reasons[r] = (tel.reasons[r] || 0) + 1;
	if (place) { const k = r + '@' + place; tel.reasons[k] = (tel.reasons[k] || 0) + 1; }
}
let lastEvFlush = 0;
function ev(kind, data) {
	tel.events.push({ t: Date.now(), k: kind, d: data === undefined ? null : data });
	if (tel.events.length > 80) tel.events.shift();
	/* v6 stringified the whole blob on every single event - with 175 entity
	   deaths a run that is a lot of synchronous JSON for nothing. */
	if (Date.now() - lastEvFlush > 500) { lastEvFlush = Date.now(); telFlush(true); }
}
let lastFlush = 0;
function telFlush(force) {
	if (!force && Date.now() - lastFlush < 2000) return;
	lastFlush = Date.now();
	try {
		tel.at = Date.now();
		const st = caveState(), lp = leaderPos();
		tel.role = role(); tel.leader = leaderName(); tel.mode = mode;
		tel.live = {
			mode: mode, phase: phase, active: active(), inCave: inCave(), paused: cavePaused(),
			map: character.map, engaged: engaged(), recovering: recovering,
			hp: character.hp, max_hp: character.max_hp, mp: character.mp, max_mp: character.max_mp,
			speed: character.speed, range: character.range,
			targets: character.targets, rip: !!character.rip,
			x: Math.round(character.real_x), y: Math.round(character.real_y),
			leaderMap: leaderMap(), party: partyRoster(), partyComplete: partyComplete(),
			distLeader: lp ? Math.round(Math.hypot(lp.x - character.real_x, lp.y - character.real_y)) : null,
			gate: phase === 'staged' ? gateReport() : undefined,
			cave: st ? { remaining_ms: st.remaining_ms, floor: st.floor, gold: st.gold, amber: st.amber,
				paused: st.paused,
				doors: (st.doors || []).map((d) => d.to + (d.locked ? '*' : '')),
				objectivesLeft: (st.objectives || []).filter((o) => o.required && !o.done).length,
				choice: st.choice ? { id: st.choice.id, resolved: !!st.choice.resolved,
					mine: st.choice.votes && st.choice.votes[character.name] } : null } : null,
		};
		parent.localStorage.setItem(TEL_KEY, JSON.stringify(tel));
	} catch (e) {}
}

function telCensus() {
	const names = ['smart_move', 'move', 'can_move_to', 'attack', 'heal', 'use_skill', 'change_target',
		'is_in_range', 'can_attack', 'is_on_cooldown', 'get_nearest_monster', 'get_targeted_monster',
		'transport', 'enter', 'show_json', 'game_log', 'ms_to_next_skill', 'get_entities',
		'loot', 'get_chests', 'send_party_invite', 'accept_party_invite', 'send_cm', 'respawn'];
	for (const n of names) { try { tel.helpers[n] = eval('typeof ' + n); } catch (e) { tel.helpers[n] = 'undefined'; } }
	try { tel.helpers['parent.socket'] = typeof parent.socket; } catch (e) {}
	try { tel.helpers['G.skills'] = typeof parent.G.skills; } catch (e) {}
}

const TEL_REASONS = /keeper|party_too_large|daily|cave_|zone_busy|already_|stale_choice|vote_closed|invalid_reply|transport|seal_closed|cant_enter|defeated|use_exit|respawn/i;
function telHook() {
	const fn = function (data) {
		try {
			if (!alive() || !data) return;
			const r = typeof data === 'string' ? data : (data.reason || data.response || '');
			if (!r) return;
			bumpReason(String(r), data && data.place);
			if (TEL_REASONS.test(String(r))) ev('response', { r: String(r), failed: !!(data && data.failed), place: data && data.place });
		} catch (e) {}
	};
	try { if (parent.__caveTelHook) parent.socket.off('game_response', parent.__caveTelHook); } catch (e) {}
	try { parent.socket.on('game_response', fn); parent.__caveTelHook = fn; } catch (e) {}
	/* game.on has no matching off(), so a handler from an earlier engage stays
	   registered forever. alive() makes the stale ones inert instead. */
	try { game.on('death', function (d) { if (!alive()) return; bump('entityDeaths'); }); } catch (e) {}
	try { game.on('new_map', function (d) { if (!alive()) return; ev('new_map', d && (d.name || d.map)); }); } catch (e) {}
}
function caveDump() { telFlush(true); try { show_json(tel); } catch (e) {} clog('telemetry at ' + TEL_KEY); return tel; }

// ------------------------------------------------------------ commands -----
function caveSay(msg) {
	if (!isLeader()) return;
	try { send_cm(followers(), { cave: msg }); ev('sent', msg); }
	catch (e) { clog('send_cm failed: ' + e, 'red'); }
}
function caveLead(name) {
	if (TEAM.indexOf(name) < 0) { clog('leader must be one of ' + TEAM.join(', '), 'red'); return null; }
	try { parent.localStorage.setItem(LEADER_KEY, name); } catch (e) { clog('could not write ' + LEADER_KEY + ': ' + e, 'red'); return null; }
	recovering = false; aim = null; votedFor = {}; deadDoors = {};
	clog('leader is now ' + name + ' - I am the ' + role() + '. Every tab shares this key.', '#FFD700');
	ev('leader', name);
	return { leader: name, me: character.name, role: role() };
}
/* THE REHEARSAL. No staging, no gate, no votes, no doors, and caveEnter() is
   refused - so the cohesion, kiting, combat, potion, party and loot paths can
   all be exercised on an ordinary map without spending the one daily run.
   Everything that broke on 2026-10-06 except doors and votes reproduces here. */
function caveDry() {
	if (inCave()) { clog('already inside a cave - caveDry() is for outside', 'orange'); return null; }
	mode = 'dry'; stopped = false; phase = 'active'; recovering = false; aim = null;
	clog('DRY RUN as ' + role() + ' (' + character.name + '/' + character.ctype + ' speed ' + character.speed
		+ ' range ' + character.range + '). Leader ' + leaderName() + '. Will NOT enter anything.', '#FFD700');
	ev('dry', { leader: leaderName(), role: role() });
	return { mode: mode, role: role(), leader: leaderName() };
}
function caveGo() {
	if (mode === 'dry') { clog('in dry mode - caveStop() then re-engage for a real run', 'orange'); return null; }
	stopped = false; phase = 'gather';
	caveSay('go');
	clog('gathering at Dorr' + (isLeader() ? ' - and told ' + followers().join(', ') : '') + ' - combat held until inside', '#FFD700');
	return phase;
}
function caveStop() { stopped = true; phase = 'idle'; recovering = false; aim = null; caveSay('stop'); clog('stopped', 'orange'); }
function caveStatus() {
	const st = caveState(), lp = leaderPos();
	const info = { mode: mode, role: role(), leader: leaderName(), phase: phase, active: active(),
		inCave: inCave(), paused: cavePaused(), map: character.map, engaged: engaged(), recovering: recovering,
		speed: character.speed, range: character.range,
		distLeader: lp ? Math.round(Math.hypot(lp.x - character.real_x, lp.y - character.real_y)) : null,
		distToDorr: Math.round(dist(character, CFG.keeper)), targets: character.targets,
		leaderMap: leaderMap(), party: partyRoster(), partyComplete: partyComplete(),
		gateBlockers: gateReport(),
		cave: st ? { remaining_ms: st.remaining_ms, floor: st.floor, gold: st.gold, amber: st.amber,
			doors: (st.doors || []).map((d) => d.to + (d.locked ? '(locked)' : '')),
			choice: st.choice ? { id: st.choice.id, resolved: st.choice.resolved,
				options: (st.choice.options || []).map((o) => o.id) } : null } : null };
	clog(JSON.stringify(info)); try { show_json(info); } catch (e) {}
	return info;
}
function caveEnter() {
	if (mode === 'dry') { clog('REFUSED - dry mode never enters. caveStop() and re-engage first.', 'red'); return null; }
	if (!isLeader()) { clog('only ' + leaderName() + ' enters - the server builds the party from the opener', 'orange'); return; }
	const b = gateReport();
	if (b.length) { clog('NOT entering - ' + b.join(' | '), 'red'); return b; }
	clog('entering...', '#FFD700');
	ev('enterTry');
	try { return enter('dreams'); } catch (e) { ev('enterThrew', String(e)); clog('enter threw: ' + e, 'red'); }
}

try {
	character.on('cm', function (d) {
		try {
			if (!alive() || !d || !d.message || !d.message.cave) return;
			if (d.name !== leaderName()) return;
			ev('cm', { from: d.name, msg: d.message.cave });
			if (d.message.cave === 'go') caveGo();
			else if (d.message.cave === 'stop') caveStop();
		} catch (e) {}
	});
} catch (e) { clog('could not hook cm: ' + e, 'red'); }

try {
	window.caveGo = caveGo; window.caveDry = caveDry; window.caveLead = caveLead;
	window.caveEnter = caveEnter; window.caveStatus = caveStatus; window.caveStop = caveStop;
	window.caveDump = caveDump;
} catch (e) {}

// ---------------------------------------------------------------- loop -----
async function tick() {
	try {
		const was = phase;
		if (inCave()) phase = 'inside';
		else if (phase === 'inside') { phase = 'idle'; votedFor = {}; deadDoors = {}; }
		else if (mode === 'dry') phase = stopped ? 'idle' : 'active';
		else if (phase === 'gather' && character.map === CFG.keeper.map && dist(character, CFG.keeper) <= CFG.stageWithin) phase = 'staged';
		if (phase !== was) { clog('phase -> ' + phase, '#7FD1FF'); ev('phase', { from: was, to: phase }); }
		if (phase === 'staged' && isLeader()) {
			const b = gateReport();
			throttleLog(b.length ? 'staged, BLOCKED: ' + b.join(' | ') : 'staged and clear - caveEnter() when ready');
		}
		bump('ticks');
		if (engaged()) bump('engagedTicks');
		if (cavePaused()) bump('pausedTicks');
		deathTick();            // before anything that returns early on rip
		potionTick();
		partyTick();
		lootTick();
		await moveTick();
		await combatTick();
		telFlush();
	} catch (e) { bump('exceptions'); ev('exception', String(e)); clog('tick: ' + e, 'red'); }
	if (alive()) setTimeout(tick, CFG.tickMs);
}
function voteLoop() { try { voteTick(); } catch (e) { clog('vote: ' + e, 'red'); } if (alive()) setTimeout(voteLoop, CFG.voteTickMs); }

clog('v7 loaded as ' + role() + ' (' + character.name + '/' + character.ctype + ' speed ' + character.speed
	+ '). Leader ' + leaderName() + '. caveDry() to rehearse on-map, caveGo() for a real run, caveLead(name) to retarget.', '#7FD98A');
telCensus();
telHook();
hookPartyInvite();
ev('load', { ver: 7, leader: leaderName(), role: role(), speed: character.speed, range: character.range,
	missing: Object.keys(tel.helpers).filter((k) => tel.helpers[k] === 'undefined') });
tick();
voteLoop();

})();
