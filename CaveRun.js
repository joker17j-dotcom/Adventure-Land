// CaveRun.js - one script for Dexon / FatherToken / MageofOz - v14 (TEST BUILD)
// v14 2026-10-18 travel leash tightens to 120/60 while walking and reverts to
//                180/120 whenever anyone is fighting; a localStorage trouble
//                beacon carries fear, which is self-only and readable nowhere
//                else; the leader cancels its in-flight path and waits when a
//                member is too far back or in trouble, bounded at 20s; an
//                unseen follower no longer counts as a close one
// v13 2026-10-12 crypt: retaliate against anything that starts it, except the
//                three that would win; caveOnly/caveNever set it at runtime
// v12 2026-10-12 crypt mode: operator drives the leader, followers cohere and
//                fight, and NOTHING may be attacked but the whitelist
// v11 2026-10-11 telemetry archived per run; door recon; chest recon fixed;
//                lootRangeFilter switch (default unchanged)
// v10 2026-10-10 loot: pause guard, cooldown, per-chest backoff, shape recon
// v9 2026-10-10 heal cooldown gate; friendly_target forensics; objective and
//               objective-button reconnaissance (both read-only)
// v8 2026-10-10 restock phase before the gather, respawn backoff, two more
//               gate pre-checks (cave_closed, home server)
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
//            caveGo()    restock potions, THEN gather at Dorr for a real run
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
	respawnMs: 4000,        // first retry delay; doubles on cant_respawn
	respawnMaxMs: 30000,

	/* LOOT. v9 called loot() on every 250ms tick with no pause guard and no
	   cooldown; see lootTick for the measurements. */
	lootMs: 900,
	lootPerPass: 3,         // chests attempted per pass, newest first
	lootMaxTries: 3,        // attempts before a chest is rested
	lootDeadMs: 15000,      // how long a rested chest is left alone
	lootRange: 400,         // ONLY applied when the chest record exposes a position
	/* THE RANGE FILTER WAS 98% OF v10's LOOT SUPPRESSION, and it is the one
	   brake v10 shipped without verifying. Measured over the two runs:

	     run   loot() calls   out-of-range rejections
	     v7           6,236   (filter did not exist)
	     v10            103   4,916

	   Backoff accounted for 74 of v10's rejections and give-up for 6; the
	   range filter did the other 4,916. Turning this off restores v10's other
	   three brakes (pause guard, rate cooldown, per-chest backoff) WITHOUT the
	   unverified one, which is the clean A/B - it is not a revert to v7's
	   hammering. Left TRUE so v11 changes no behaviour on its own; flip it for
	   one run, or read tel.chestProbe below, whichever you prefer. */
	lootRangeFilter: true,

	/* RESTOCK. Each character buys its own - there is no shared pool, and a
	   priest that runs dry heals nobody. 2000 of each at 100g is 200k per
	   character fully empty, which is affordable at current balances. */
	restock: { hpot1: 2000, mpot1: 2000 },
	restockChunk: 500,      // buy() calls are chunked and re-counted between
	restockRounds: 14,
	restockMaxMs: 240000,
	restockNear: 200,       // close enough to the counter to trade
	vendorFallback: { map: 'main', x: -35, y: -162 },   // fancypots, measured
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

	/* TRAVEL LEASH - v14. Tighter while the party is walking, the numbers above
	   the moment anyone is fighting. See the v14 block below for why the band
	   stays 60u wide and why the ceiling only ever comes down. */
	tighten: true,
	travelCloseAt: 120,
	travelReleaseAt: 60,
	travelCeiling: 135,
};

/* ---------------------------------------------------------------- v14 -----
   THE TRAVEL LEASH, THE TROUBLE BEACON AND THE LEADER HOLD. Three changes
   that only work as one: a tighter leash on its own just moves where the
   follower gives up, because this file already measures that a follower
   CANNOT converge on a faster leader. The leader holding is what makes a
   tight band reachable, and the beacon is what tells the leader to hold.

   HYSTERESIS IS PRESERVED EXACTLY. 120-60 is the same 60u band as 180-120,
   and that margin exists because it must stay comfortably above kiteStep
   (55) or v6's oscillation returns - 2,064 close steps against 486 kite
   steps, cancelling each other out. travelCeiling keeps closeAt's +15
   relationship for the same reason: a kite step free to push to 195 while
   the band closes at 120 would re-latch recovering on the next tick, every
   tick.

   THE CEILING NEVER GOES UP. 195 is already inside the priest's measured
   201 heal range with no margin to spare; travel tightens it to 135. */
const TROUBLE = {
	hpAt: 0.55,            // at or below this fraction of max_hp, a member needs help
	atkAt: 3,              // monsters on one member before it counts as mobbed
	staleMs: 3000,         // a beacon older than this tells us nothing - see mateTrouble
	/* NOT MEASURED, deliberately conservative. One ~160 byte localStorage write
	   per character per beaconMs; at 250ms that is 12/s across three tabs. No
	   cost was observed, but none was measured either, so it is a knob rather
	   than a hardcoded tick. Anything comfortably under staleMs is safe. */
	beaconMs: 250,
};

/* THE LEADER HOLD. The leader has no script-driven movement inside the Cave -
   moveTick returns at the isLeader() line, and the crypt block says in as many
   words that the operator drives. So "stop and wait" cannot mean declining to
   issue a move; it means CANCELLING one the operator already started. Measured
   2026-10-18 on the live leader: character.moving was true and
   character.going_x / going_y carried the in-flight target, so a move() to the
   character's own position stops it and the remembered target re-issues it.

   WHAT THIS CANNOT DO, stated so nobody has to find out. going_x/going_y is
   the CURRENT leg, not the whole journey: a click that paths over several legs
   loses its remainder and the operator re-clicks. character.destination does
   not exist on the character - checked, not assumed.

   BOUNDED, BECAUSE AN UNBOUNDED WAIT IS THE TRAVEL DEADLOCK WEARING A HAT.
   maxMs then gives up, says so loudly, and resumes - the same shape as
   restockGaveUp, and for the same reason: three characters standing still
   forever is the failure least likely to be noticed, because everything
   still looks alive.

   OFF IN CRYPT, ON PURPOSE. There the operator's driving is the safety
   mechanism that keeps the party away from Marceline, and this file already
   refuses to put a geofence in its way. */
const HOLD = {
	enabled: true,
	inCrypt: false,
	maxMs: 20000,
};

/* FEAR IS SELF-ONLY, AND THAT IS THE ENTIRE REASON THIS BEACON EXISTS.
   Measured 2026-10-18 in the live CODE context: character.fear is a number on
   the character and it is on NOTHING else. Not parent.party, which carries
   only cx/gold/in/l/level/luck/map/pdps/share/skin/type/x/y. Not
   parent.entities[mate]. Not even parent.entities[own name]. hp/max_hp ARE on
   a visible entity, so HP reads remotely and fear does not. A feared member
   stops acting and cannot catch up, which is exactly the state the leader
   needs to see, so each character publishes its own.

   parent.party IS ALSO USELESS FOR DISTANCE, measured the same day: every
   member's x/y sat frozen for a 20.7s sample while the characters walked
   hundreds of units, and the leader's own entry was 396u from his real
   position. On a band that is 120u wide that is not a rounding error. This is
   why leaderPos() tries the ENTITY first and party only as a fallback, and why
   followerGaps does the same.

   WHY localStorage AND NOT send_cm. caveSay is leader-gated and the cm handler
   drops anything whose sender is not the leader, so followers have no upward
   channel at all without changing that protocol. localStorage is shared across
   every adventure.land tab - this file already depends on that for cave_leader
   - and it is synchronous, which matters at a 250ms tick where a ~1s cm round
   trip would leave a quarter of the decision stale.

   CTYPE IN THE KEY, NEVER THE NAME. The same rule as TEL_KEY and for the same
   measured reason: a key containing "Token" is redacted by output filters on
   the reading side. The name goes in the VALUE, where tel already puts it. */
const ST_PREFIX = 'cave_st_';
const ST_KEY = ST_PREFIX + character.ctype;


/* CRYPT MODE, AND WHY IT IS NOT JUST dry.

   dry was the right hook and the wrong safety story. It makes active() true
   without any Cave state, which is exactly what is needed to run this script on
   a map that is not the Cave - but it suppresses only cave ENTRY, floor
   following and voting. combatTick and moveTick have no dry guard at all, so
   dry still walks and still swings. In the Crypt that is the most dangerous
   setting available, not the safest: caveDry() sets phase='active', which is
   the very gate that wakes combatTick, and pickTarget ends in a bare
   get_nearest_monster() fallback with no type restriction.

   WHAT IS IN THAT ROOM, measured 2026-10-12 against the party's real figures
   (heal 2,000/s, FatherToken armour 512 / resistance 569 as the best tank):

     a6 Marceline   9,401 dps on FT   kills him in ~0.9s
     a8 Angel       5,624 dps         ~2.3s
     a1 Spike       2,466 dps AND 18,700,000 hp - 99 minutes of party dps
     vbat           1,015 dps         +985 margin, 45s each  <- the only target

   So crypt mode is dry's active() hook plus a HARD whitelist. The whitelist is
   enforced twice on purpose - once in pickTarget so nothing downstream ever
   sees a forbidden target, and again immediately before attack(), because the
   entire failure mode is something slipping through to that one call.

   THE OPERATOR DRIVES THE LEADER. moveTick returns early for the leader, so in
   crypt mode the leader is yours to steer and the other two cohere to it and
   shoot. That is deliberate: a geofence would fight your own driving, and your
   driving is what keeps the party away from Marceline. Kiting still considers
   ALL threats, not just the whitelist, which is what you want near her. */
const CRYPT = {
	/* What we go looking for. pickTarget will initiate on these. */
	only: ['vbat'],

	/* NEVER, not even when they are already hitting us. Measured 2026-10-12
	   against the party's real figures (heal 2,000/s, FatherToken armour 512 /
	   resistance 569 as the best tank), dps AFTER mitigation:

	     a6 Marceline   9,401   kills FT in ~0.9s
	     a8 Angel       5,624   ~2.3s
	     a1 Spike       2,466   and 18,700,000 hp - 99 minutes of party dps

	   Fighting back against these is how the run ends, so retaliation is
	   refused too. Everything NOT on this list is survivable in a straight
	   fight and may be answered:

	     a7 Lucinda       529   +1,471 margin
	     a4 Orlok         567   +1,433
	     a3 Lestat        957   +1,043
	     a5 Elena          35   +1,965
	     a2 Bill        1,645   +355  (thin - the one to watch)
	     vbat           1,015   +985

	   v12 had only the whitelist, so a7 could stand there hitting the priest
	   while the party refused to answer - safe, because 529 against 2,000 of
	   healing is a stalemate, but it stops you clearing a path. */
	never: ['a6', 'a8', 'a1'],
};

let mode = 'cave';         // cave | dry | crypt
let phase = 'idle';        // idle | restock | gather | staged | inside | active (dry)
let stopped = false;
let engagedUntil = 0;
let votedFor = {};
let lastLog = 0;
let lastDoorTry = 0;
let lastPot = 0;
let deadDoors = {};        // a locked door is not retried every three seconds
let lastLoot = 0;
let chestTries = {};       // id -> attempts in this life
let deadChests = {};       // id -> when it was rested

/* COHESION RECOVERY IS LATCHED AND UNINTERRUPTIBLE. Past closeAt the follower
   commits to reaching the leader and nothing else may move it - no kiting, no
   door logic - until the gap is back inside releaseAt. The aim point is only
   refreshed once the leader has walked staleSlack away from it, so a moving
   leader is still tracked without restarting pathing every tick. */
let recovering = false;
let aim = null;
let smartFlight = 0;

let troubleNow = [];
let leashNow = null;
let holdFrom = 0;
let holdGoing = null;
let holdDone = false;

let beaconAt = 0;
function beaconWrite() {
	if (Date.now() - beaconAt < TROUBLE.beaconMs) return;
	beaconAt = Date.now();
	try {
		parent.localStorage.setItem(ST_KEY, JSON.stringify({
			name: character.name,
			t: Date.now(),
			map: character.map,
			x: Math.round(character.real_x),
			y: Math.round(character.real_y),
			hpFrac: character.max_hp ? Math.round((character.hp / character.max_hp) * 1000) / 1000 : 1,
			fear: character.fear || 0,
			atk: attackersOnMe(),
			rip: !!character.rip,
		}));
	} catch (e) { bump('beaconWriteFail'); }
}
function beacons() {
	const out = {};
	try {
		const ls = parent.localStorage;
		for (let i = 0; i < ls.length; i++) {
			const k = ls.key(i);
			if (!k || k.indexOf(ST_PREFIX) !== 0) continue;
			let v = null;
			try { v = JSON.parse(ls.getItem(k)); } catch (e) { continue; }
			if (v && v.name) out[v.name] = v;
		}
	} catch (e) {}
	return out;
}
/* RIP IS NOT TROUBLE, and the two readers must agree about that or the leader
   holds for a corpse. Trouble means "needs help AND can still be helped": you
   hold to stop someone dying, and once they have died holding achieves
   nothing - they respawn in town, far from here, and deathTick owns getting
   them back. followerGaps reports a dead mate as gap 0 for the same reason, so
   neither path strands the run on a body. Caught by the harness; reading it
   twice had not. */
function troubleOf(st) {
	if (!st) return null;
	if (st.rip) return null;
	if (st.hpFrac <= TROUBLE.hpAt) return 'hp';
	if (st.fear > 0) return 'fear';
	if (st.atk >= TROUBLE.atkAt) return 'mobbed';
	return null;
}
/* A STALE BEACON IS NOT TROUBLE, AND IT IS NOT SAFETY EITHER. Getting that
   wrong is worse than never reading it. Chrome clamps a hidden tab's timers to
   ~1s and then to about one tick a minute, so a backgrounded member's beacon
   ages while nothing at all is wrong. Read stale as trouble and the leader
   never moves again; read it as fine and the party walks away from someone
   dying. So stale falls back to what can be seen locally - entity hp, which is
   real whenever the member is in range - and FEAR IS SIMPLY UNKNOWN while
   stale, reported as such rather than guessed at. */
function mateTrouble() {
	const now = Date.now(), bs = beacons(), out = [];
	for (const nm of TEAM) {
		if (nm === character.name) continue;
		const st = bs[nm];
		if (st && now - st.t <= TROUBLE.staleMs) {
			const why = troubleOf(st);
			if (why) out.push({ who: nm, why: why });
			continue;
		}
		const e = (parent.entities || {})[nm];
		if (here(e) && e.max_hp && e.hp / e.max_hp <= TROUBLE.hpAt) out.push({ who: nm, why: 'hp/entity' });
	}
	return out;
}
/* IS THE HOLD GOING TO BACK THIS UP. The tight band and the leader hold are
   one change, not two, and the tight band is the half that hurts on its own:
   this file measures that a follower CANNOT converge on a faster leader, so a
   120u band with nobody waiting just latches the slowest member into
   recovering and leaves it there - and recovering is uninterruptible, so it
   also stops kiting and looting. Worse than the 180 it replaced. Measured
   2026-10-18: mage 57 against leader 65, which is 8u/s of bleed, so 60u of
   band is gone in 7.5s and never comes back while the leader walks. So travel
   numbers apply only where a hold will actually stop the leader. */
function holdActive() { return HOLD.enabled && !(mode === 'crypt' && !HOLD.inCrypt); }
function computeLeash() {
	const base = { closeAt: MOVE.closeAt, releaseAt: MOVE.releaseAt, ceiling: MOVE.ceiling, mode: 'combat' };
	if (!MOVE.tighten || !holdActive()) { base.mode = MOVE.tighten ? 'base/nohold' : 'base'; return base; }
	if (engaged() || attackersOnMe() || troubleNow.length) return base;
	return { closeAt: MOVE.travelCloseAt, releaseAt: MOVE.travelReleaseAt, ceiling: MOVE.travelCeiling, mode: 'travel' };
}
function leash() { return leashNow || computeLeash(); }
/* ONE SCAN PER TICK. mateTrouble walks localStorage, and leash() is asked
   three times a tick - by moveTick, kiteStep and recoverStep. */
function senseTick() {
	beaconWrite();
	troubleNow = mateTrouble();
	leashNow = computeLeash();
	if (leashNow.mode === 'travel') bump('travelLeashTicks');
	if (troubleNow.length) bump('troubleTicks');
}


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
/* True for dry AND crypt: both run outside the Cave, where `inside` never
   arrives because nothing sets it. */
function offCave() { return mode !== 'cave'; }
function active() { return offCave() ? phase === 'active' : phase === 'inside'; }

/* Did this one start it? Retaliation is judged from the monster's own target,
   so there is no flag to thread through pickTarget and no way for the two
   gates in combatTick to disagree about what counts as self-defence. */
function attackingUs(t) {
	try {
		if (!t || !t.target) return false;
		return partyNames().indexOf(t.target) >= 0;
	} catch (e) { return false; }
}

/* Open in every mode but crypt, so nothing else changes.

   Three outcomes, in order, and the order is the safety property:
     1. on `never`  -> refused, even in self-defence. These win the fight.
     2. on `only`   -> may be initiated on. This is the hunt.
     3. otherwise   -> only if it is already hitting a party member.
   A monster that wanders into range and is ignoring us is still left alone. */
function mayAttack(t) {
	if (mode !== 'crypt') return true;
	if (!t || !t.mtype) return false;
	if (CRYPT.never.indexOf(t.mtype) >= 0) return false;
	if (CRYPT.only.indexOf(t.mtype) >= 0) return true;
	return attackingUs(t);
}

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

/* A MEMBER IN TROUBLE COUNTS AS THE PARTY BEING ENGAGED, which is what makes
   the other two assist instead of walking on. monsterOnParty only sees
   monsters in the reader's OWN entity list, so the one case that matters - a
   member mobbed far enough back to be out of range - is invisible to it. The
   beacon is not, and holding the engagement open keeps pickTarget unlocked and
   the leash on its combat numbers until it is sorted out. */
function noteEngagement() {
	const e = leaderEntity();
	if ((e && e.target) || monsterOnParty() || troubleNow.length) engagedUntil = Date.now() + CFG.engageHoldMs;
}
function engaged() { return Date.now() < engagedUntil; }

function inRangeFor(t, skill) {
	if (!t) return false;
	try { if (isFn(is_in_range)) return skill ? is_in_range(t, skill) : is_in_range(t); } catch (e) {}
	return true;
}

function pickTarget() {
	if (!engaged()) return null;
	/* THE WHITELIST IS APPLIED TO ALL THREE PATHS, and the third is the one that
	   matters. Following the leader's target and the "already hitting us" scan
	   are both bounded by what the party is doing; the get_nearest_monster
	   fallback is not bounded by anything, and in the Crypt the nearest monster
	   is eventually Marceline. */
	try {
		const le = leaderEntity();
		if (le && le.target) {
			const t = parent.entities[le.target];
			if (t && t.type === 'monster' && !t.dead && inRangeFor(t) && mayAttack(t)) return t;
		}
	} catch (e) {}
	const names = partyNames();
	let best = null, bestD = Infinity;
	for (const m of threats()) {
		if (!m.target || names.indexOf(m.target) < 0) continue;
		if (!mayAttack(m)) continue;
		const d = dist(character, m);
		if (d < bestD && inRangeFor(m)) { best = m; bestD = d; }
	}
	if (best) return best;
	try { if (isFn(get_nearest_monster)) { const n = get_nearest_monster(); if (n && inRangeFor(n) && mayAttack(n)) return n; } } catch (e) {}
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
	} catch (e) { noteWhy(name, e, a && typeof a === 'object' ? a : undefined); throw e; }
}
/* FRIENDLY_TARGET FORENSICS - read-only, and deliberately NOT in the event ring.
   The 2026-10-10 run produced 1,779 attack/curse refusals reading
   "friendly_target": 578 on the priest, 613 on Dexon, 588 on MageofOz, against
   735 swings that landed. Roughly 70% of the party's damage never left the
   ground, and nothing in game said so - the catch swallows it and only the v7
   reason tally revealed it at all.

   TWO EXPLANATIONS SURVIVE READING, WHICH IS WHY THIS MEASURES INSTEAD.
     a) an encounter NPC that was fought - the operator chose a fight option
     b) an encounter that ATTACHES friendly monsters to the party - several
        exist (monster_handler: wolves/lure/trade, pact_broker: hire). Those
        would be type "monster" client-side, so threats() and the
        get_nearest_monster() fallback would both return them happily and every
        attack would be refused.
   The shape of the numbers leans to (b): ~1/second per character sustained
   across 10.5 minutes is not the burst a single encounter produces. But that
   is an argument, not a measurement.

   WHAT DISTINGUISHES THEM is the time spread per target. One entity seen for
   ten minutes is an attached ally; several entities inside one short window is
   the encounter. So this records first/last/count per distinct target rather
   than a running total.

   It is NOT put in tel.events on purpose. That ring is 80 entries and the loot
   loop filled 75 of them with identical open_chest refusals in the last run,
   evicting everything else - so anything that matters has to live outside it. */
const FRIENDLY_CAP = 16;
function noteFriendly(skill, target) {
	try {
		if (!target) return;
		const key = String(target.id || target.name || '?') + '/' + skill;
		const f = tel.friendly;
		if (!f[key]) {
			if (Object.keys(f).length >= FRIENDLY_CAP) { tel.friendlyOverflow = (tel.friendlyOverflow || 0) + 1; return; }
			f[key] = {
				n: 0, first: Date.now(), last: 0, skill: skill,
				id: target.id || null, name: target.name || null,
				type: target.type || null, mtype: target.mtype || null,
				ctype: target.ctype || null, npc: target.npc || null,
				owner: target.owner || null, team: target.team || null,
				/* the client-side check the attack path already consults - if it
				   says yes while the server says friendly, that disagreement is
				   the whole bug */
				canAttack: (function () { try { return isFn(can_attack) ? !!can_attack(target) : null; } catch (e) { return 'threw'; } })(),
				inParty: partyNames().indexOf(target.name) >= 0,
				map: character.map, floor: (caveState() || {}).floor,
			};
		}
		f[key].n++; f[key].last = Date.now();
	} catch (e) {}
}
function noteWhy(name, e) {
	tel.skillFail[name] = (tel.skillFail[name] || 0) + 1;
	let r = 'unknown';
	try { r = String((e && (e.reason || e.response || e.message)) || e).slice(0, 48); } catch (x) {}
	if (!tel.skillFailWhy[name]) tel.skillFailWhy[name] = {};
	tel.skillFailWhy[name][r] = (tel.skillFailWhy[name][r] || 0) + 1;
	if (r === 'friendly_target' && arguments.length > 2) { try { noteFriendly(name, arguments[2]); } catch (x) {} }
}

async function priestSkills(target) {
	const hurtCount = allies().filter((a) => a.hp / a.max_hp < CFG.partyHealAt).length;
	if (hurtCount >= 2 && haveSkill('partyheal')) { try { await telUse('partyheal'); return true; } catch (e) {} }
	const ally = hurtAlly(CFG.healAt);
	/* HEAL WAS THE ONE SKILL THAT SKIPPED haveSkill(). Every other call in this
	   file is gated by it - and haveSkill is where is_on_cooldown lives - so
	   heal alone fired every tick an ally was hurt, cooldown or not. Measured
	   in the 2026-10-10 cave run: 145 heal failures, 142 of them purely
	   "cooldown". Nothing broke, because the catch swallows it, which is
	   exactly why it survived two versions.
	   Safe to gate: G.skills.heal declares class ["priest"] and NOTHING else -
	   no level, no mp, no slot - so haveSkill('heal') reduces to the class test
	   plus the cooldown, and cannot refuse a heal the server would have taken.
	   Note heal carries `share`, so its cooldown is not its own; the gate stops
	   the wasted call either way. */
	if (ally && haveSkill('heal') && inRangeFor(ally, 'heal')) { try { await heal(ally); tel.skills.heal = (tel.skills.heal || 0) + 1; return true; } catch (e) { noteWhy('heal', e); } }
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
		/* SECOND GATE, deliberately redundant with pickTarget. Everything this
		   mode exists to prevent funnels through this one call, so it is worth
		   paying for twice - a future edit to pickTarget cannot quietly reopen
		   it. If this ever fires, the first gate has a hole. */
		if (!mayAttack(target)) { bump('cryptBlocked'); return; }
		if (isFn(can_attack) && !can_attack(target)) return;
		if (!isLeader()) change_target(target);
		await attack(target);
		bump('attacks');
	} catch (e) { bump('attackFail'); noteWhy('attack', e, target); }
}

// ------------------------------------------------------------ movement -----
function kiteStep(lp) {
	const L = leash();
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
			if (gapNew > L.ceiling) continue;
			if (gapNow > L.releaseAt && gapNew > gapNow + 1) continue;
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
	if (offCave()) return false;
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
	bump('doorTry');

	/* DOOR RECON - v11. v10 called transport() 24 times across the only two
	   doors in the run and got zero successes, every one refused with
	   transport_cant_reach, and nothing recorded said why. followFloor hashes
	   IDENTICALLY at v7, v9 and v10, so the version is not the variable and
	   neither is the leader - both were ruled out. Three explanations survive:
	     a) transport() is the wrong mechanism for a cave floor door
	     b) right mechanism, wrong spawn - transport(to, 0) hardcodes spawn 0
	     c) doorNear 40 is looser than the server's own reach check, or the
	        character is still in motion when the call lands
	   (b) shows up as doorShape carrying a spawn/index field we are ignoring.
	   (c) shows up as gap clustering near 40, or moving:true on the failures.
	   (a) is what is left when neither of those appears.

	   Object.keys IS the honest tool here, unlike the chest case below: a door
	   is a plain server object, not a PIXI sprite with accessors on a
	   prototype. Recorded on EVERY attempt rather than once, because the gap
	   at the moment of the call is the variable in (c) and one sample cannot
	   show a distribution. Two doors a run means ~24 records - nothing. */
	const rec = {
		to: lm, spawnSent: 0,
		doorX: Math.round(door.x), doorY: Math.round(door.y),
		myX: Math.round(character.real_x), myY: Math.round(character.real_y),
		gap: Math.round(Math.hypot(door.x - character.real_x, door.y - character.real_y)),
		doorNear: CFG.doorNear, moving: !!character.moving, map: character.map,
	};
	if (!tel.doorShape) {
		try { tel.doorShape = { keys: Object.keys(door), sample: JSON.parse(JSON.stringify(door)) }; }
		catch (e) { tel.doorShape = { keys: null, why: String(e) }; }
	}
	clog('taking the door to ' + lm + ' (gap ' + rec.gap + ')', '#7FD1FF');
	try { await transport(door.to, 0); rec.ok = true; bump('doorOk'); }
	catch (e) {
		rec.ok = false;
		rec.why = String((e && (e.reason || e.message)) || e);
		clog('transport refused: ' + rec.why + ' at gap ' + rec.gap, 'orange');
	}
	rec.afterX = Math.round(character.real_x);
	rec.afterY = Math.round(character.real_y);
	rec.afterMap = character.map;
	if (tel.doors.length < 40) tel.doors.push(rec);
	ev(rec.ok ? 'doorOk' : 'doorFail', rec);
	return true;
}

async function recoverStep(lp, gap) {
	if (!aim || Math.hypot(aim.x - lp.x, aim.y - lp.y) > MOVE.staleSlack) aim = { x: lp.x, y: lp.y };
	const direct = !isFn(can_move_to) || can_move_to(aim.x, aim.y);
	if (direct) {
		const step = Math.min(MOVE.closeStepMax, Math.max(30, gap - leash().releaseAt * 0.6));
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

	if (phase === 'restock') { await restockTick(); return; }

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
	const L = leash();
	const gap = Math.hypot(lp.x - character.real_x, lp.y - character.real_y);
	tel.maxDistLeader = Math.max(tel.maxDistLeader, Math.round(gap));
	if (gap > L.closeAt) tel.msBeyondLeash += CFG.tickMs;

	// --- the latch ---
	if (!recovering && gap > L.closeAt) { recovering = true; aim = null; bump('recoveries'); ev('recover', { gap: Math.round(gap), leash: L.mode }); }
	else if (recovering && gap <= L.releaseAt) { recovering = false; aim = null; ev('recovered', { gap: Math.round(gap), leash: L.mode }); }

	if (recovering) { tel.msRecovering += CFG.tickMs; await recoverStep(lp, gap); return; }

	if (await followFloor()) return;

	const k = kiteStep(lp);
	if (k) { try { move(k.x, k.y); bump('kiteSteps'); } catch (e) {} }
	else if (threats().some((m) => dist(character, m) < MOVE.kiteRadius)) bump('kiteRejected');
}

/* The driver is the only one who can fix an over-extension, and v6 surfaced it
   nowhere - the priest sat 230 seconds outside the leash with no indication in
   game. v14 stops merely surfacing it and acts, under HOLD above. */

/* AN INVISIBLE FOLLOWER USED TO COUNT AS A CLOSE ONE. v13 skipped any mate
   that failed here(), so the single worst case - a member far enough back to
   have dropped out of the entity list, or left behind on the previous floor -
   produced a worst gap of 0 and no warning whatsoever. That is the exact state
   this work exists to catch. An unseen mate now reports Infinity, and the
   beacon is consulted first so a member merely out of render range still
   yields a real distance. A dead one reports 0 deliberately: holding for a
   corpse helps nobody, and deathTick owns the respawn. */
function followerGaps() {
	const bs = beacons(), now = Date.now(), out = [];
	for (const nm of followers()) {
		const e = (parent.entities || {})[nm];
		if (here(e)) { out.push({ who: nm, gap: dist(character, e), src: 'entity' }); continue; }
		const st = bs[nm];
		if (st && st.rip) { out.push({ who: nm, gap: 0, src: 'rip' }); continue; }
		if (st && now - st.t <= TROUBLE.staleMs && st.map === character.map) {
			out.push({ who: nm, gap: Math.hypot(st.x - character.real_x, st.y - character.real_y), src: 'beacon' });
			continue;
		}
		out.push({ who: nm, gap: Infinity, src: st ? 'offmap' : 'unseen' });
	}
	return out;
}
function holdResume() {
	const g = holdGoing;
	holdFrom = 0; holdGoing = null;
	if (!g) return;
	try {
		move(g.x, g.y);
		bump('holdResumes');
		clog('party is back - resuming toward ' + Math.round(g.x) + ',' + Math.round(g.y), '#5ED6A8');
		ev('holdResume', { x: Math.round(g.x), y: Math.round(g.y) });
	} catch (e) { bump('holdResumeFail'); }
}
function warnOutrun() {
	try {
		let worst = 0, who = '', src = '';
		for (const g of followerGaps()) if (g.gap > worst) { worst = g.gap; who = g.who; src = g.src; }
		const L = leash();
		const shown = worst === Infinity ? 'OUT OF SIGHT (' + src + ')' : Math.round(worst) + 'u';
		if (worst > L.closeAt) { bump('outrunWarnTicks'); throttleLog('OUTRUNNING PARTY - ' + who + ' is ' + shown + ' back (close at ' + L.closeAt + ')'); }
		if (troubleNow.length) { bump('troubleWarnTicks'); throttleLog('PARTY IN TROUBLE - ' + troubleNow.map((t) => t.who + ':' + t.why).join(', ')); }

		if (!HOLD.enabled) return;
		if (mode === 'crypt' && !HOLD.inCrypt) return;

		/* THE HOLD LATCHES ON THE SAME TWO NUMBERS AS COHESION. It begins past
		   closeAt and does not let go until releaseAt, because releasing at the
		   same number it caught on is how you get a leader that stutters one
		   step at a time down a corridor. */
		const need = (holdFrom ? worst > L.releaseAt : worst > L.closeAt) || troubleNow.length > 0;
		if (!need) { holdDone = false; if (holdFrom) holdResume(); return; }
		if (holdDone) return;

		if (!holdFrom) {
			holdFrom = Date.now();
			holdGoing = (character.moving && character.going_x != null)
				? { x: character.going_x, y: character.going_y } : null;
			bump('holds');
			clog('HOLDING - ' + (troubleNow.length ? troubleNow.map((t) => t.who + ':' + t.why).join(', ') : who + ' ' + shown + ' back')
				+ (holdGoing ? ' - path cancelled, will resume' : ' - was not moving'), '#FFD700');
			ev('hold', { who: who, src: src, gap: worst === Infinity ? null : Math.round(worst),
				trouble: troubleNow, resume: !!holdGoing });
		}
		if (Date.now() - holdFrom > HOLD.maxMs) {
			holdDone = true;
			bump('holdGaveUp');
			clog('HOLD GAVE UP after ' + Math.round((Date.now() - holdFrom) / 1000) + 's - ' + who + ' still ' + shown
				+ ' back. Moving on so the run cannot deadlock here.', 'orange');
			ev('holdGaveUp', { who: who, src: src, trouble: troubleNow });
			holdResume();
			return;
		}
		tel.msHolding += CFG.tickMs;
		try { if (character.moving) { move(character.real_x, character.real_y); bump('holdStops'); } } catch (e) {}
	} catch (e) {}
}

/* Read the leash in force, or retune it live: caveLeash({travelCloseAt:140}). */
function caveLeash(patch) {
	if (patch && typeof patch === 'object') {
		for (const k in patch) { if (k in MOVE) MOVE[k] = patch[k]; else if (k in HOLD) HOLD[k] = patch[k]; else if (k in TROUBLE) TROUBLE[k] = patch[k]; }
		leashNow = computeLeash();
	}
	const L = leash();
	clog('leash ' + L.mode + ' - close ' + L.closeAt + ' release ' + L.releaseAt + ' ceiling ' + L.ceiling
		+ (troubleNow.length ? ' | TROUBLE ' + troubleNow.map((t) => t.who + ':' + t.why).join(',') : ''), '#7FD1FF');
	return {
		mode: L.mode, closeAt: L.closeAt, releaseAt: L.releaseAt, ceiling: L.ceiling, tighten: MOVE.tighten,
		travel: { closeAt: MOVE.travelCloseAt, releaseAt: MOVE.travelReleaseAt, ceiling: MOVE.travelCeiling },
		combat: { closeAt: MOVE.closeAt, releaseAt: MOVE.releaseAt, ceiling: MOVE.ceiling },
		hold: { enabled: HOLD.enabled, inCrypt: HOLD.inCrypt, active: holdActive(), maxMs: HOLD.maxMs, holding: !!holdFrom, gaveUp: holdDone },
		trouble: troubleNow,
		gaps: isLeader() ? followerGaps().map((g) => g.who + ':' + (g.gap === Infinity ? 'unseen' : Math.round(g.gap)) + '/' + g.src) : null,
	};
}

// ------------------------------------------------------------- restock -----
/* EVERY FACT BELOW WAS MEASURED IN THE LIVE CODE CONTEXT 2026-10-10, because
   three of them would otherwise have been guesses and two would have thrown:

     item_count  is UNDEFINED here. The count is done by hand over
                 character.items, summing q.
     can_buy     is an OBJECT, not a function. Calling it is the Form A hazard
                 from CLAUDE.md - a throw on the first line of a phase handler
                 takes the whole phase with it and looks like dead code. So
                 nothing below calls it, and affordability is checked against
                 G.items[name].g instead.
     fancypots   is the ONLY hpot1 seller placed on main, at -35,-162. `pots`
                 and `wbartender` sell them too but are not on this map. The
                 position is still resolved at runtime; the constant in CFG is
                 only a fallback.

   hpot1 and mpot1 are 100g each. Starting stock when this was written:
   Dexon 1679/922, FatherToken 584/362, MageofOz 1806/40. */
function countItem(name) {
	let t = 0;
	try { for (const it of (character.items || [])) if (it && it.name === name) t += (it.q || 1); } catch (e) {}
	return t;
}
function restockShortfall() {
	const out = {};
	try {
		for (const nm in CFG.restock) {
			const have = countItem(nm);
			if (have < CFG.restock[nm]) out[nm] = CFG.restock[nm] - have;
		}
	} catch (e) {}
	return out;
}
function potVendor() {
	try {
		const sellers = [];
		for (const k in G.npcs) {
			const n = G.npcs[k];
			if (n && n.items && n.items.indexOf && n.items.indexOf('hpot1') >= 0) sellers.push(k);
		}
		for (const n of ((G.maps[CFG.keeper.map] || {}).npcs || [])) {
			if (n && n.position && sellers.indexOf(n.id) >= 0) {
				return { map: CFG.keeper.map, x: Math.round(n.position[0]), y: Math.round(n.position[1]), id: n.id };
			}
		}
	} catch (e) {}
	const f = CFG.vendorFallback;
	return { map: f.map, x: f.x, y: f.y, id: 'fallback' };
}
function pause(ms) { return new Promise((r) => setTimeout(r, ms)); }

let restockStarted = 0, restockRound = 0;
function restockReset() { restockStarted = 0; restockRound = 0; }

/* Returns nothing; it drives `phase` itself. Called only from moveTick, so it
   inherits that function's rip / paused guards. */
async function restockTick() {
	if (!restockStarted) {
		restockStarted = Date.now(); restockRound = 0;
		const short = restockShortfall();
		clog('restock: need ' + (Object.keys(short).length ? JSON.stringify(short) : 'nothing')
			+ ' (have ' + CFG.restock.hpot1 + '/' + CFG.restock.mpot1 + ' targets)', '#FFD700');
		ev('restockStart', { short: short, gold: character.gold });
	}

	const short = restockShortfall();
	if (!Object.keys(short).length) {
		clog('potions topped up - heading to Dorr', '#5ED6A8');
		ev('restockDone', { rounds: restockRound });
		phase = 'gather';
		return;
	}

	/* NEVER DEADLOCK THE PARTY ON SHOPPING. Walking in a few hundred potions
	   short is recoverable; three characters standing at a counter forever is
	   not, and it is the failure the operator would be least likely to notice
	   because everything still looks alive. */
	if (restockRound >= CFG.restockRounds || Date.now() - restockStarted > CFG.restockMaxMs) {
		bump('restockGaveUp');
		clog('RESTOCK GAVE UP after ' + restockRound + ' rounds - still short '
			+ JSON.stringify(short) + ' - going to Dorr anyway', 'orange');
		ev('restockGaveUp', short);
		phase = 'gather';
		return;
	}

	const v = potVendor();
	if (character.map !== v.map || dist(character, v) > CFG.restockNear) {
		throttleLog('walking to ' + v.id + ' at ' + v.x + ',' + v.y + ' to restock');
		try { await smart_move({ map: v.map, x: v.x, y: v.y }); }
		catch (e) { bump('restockMoveFail'); ev('restockMoveFail', String((e && (e.reason || e.message)) || e)); }
		return;
	}

	restockRound++;
	for (const nm in short) {
		const n = Math.min(short[nm], CFG.restockChunk);
		const unit = ((G.items[nm] || {}).g) || 0;
		if (unit <= 0) { clog('no price for ' + nm + ' - skipping it', 'orange'); continue; }
		if (n * unit > character.gold) {
			bump('restockBroke');
			clog('cannot afford ' + n + ' x ' + nm + ' (' + (n * unit) + 'g, have ' + character.gold + ')', 'orange');
			ev('restockBroke', { item: nm, want: n, unit: unit, gold: character.gold });
			continue;
		}
		const before = countItem(nm);
		try { await buy(nm, n); bump('buys'); }
		catch (e) { bump('buyErr'); noteWhy('buy_' + nm, e); }
		await pause(500);
		/* JUDGED BY THE INVENTORY, NOT BY THE CALL - the same rule the merchant
		   stand buys use. buy() has been seen to reject a purchase that landed,
		   and a round that trusted the call would either double-buy or stall. */
		const got = countItem(nm) - before;
		if (got > 0) ev('bought', { item: nm, got: got });
		else ev('boughtNothing', { item: nm, asked: n });
	}
	throttleLog('restocking, still short ' + JSON.stringify(restockShortfall()));
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
let lastRespawn = 0, wasRip = false, respawnWait = 0, respawnRefusals = 0;
/* THE BACKOFF, AND WHY IT IS DRIVEN BY THE RESPONSE AND NOT BY A CATCH.
   Measured in the 2026-10-10 rehearsal: the priest died once and the server
   answered cant_respawn THREE times before one took. respawn() does not throw
   on that - the refusal arrives through game_response - so a try/catch around
   it sees nothing and a fixed 4s retry just hammers the server. bumpReason
   calls this, which is the only place the refusal is visible. */
function noteRespawnRefused() {
	respawnRefusals++;
	respawnWait = Math.min(CFG.respawnMaxMs, (respawnWait || CFG.respawnMs) * 2);
	ev('respawnRefused', { n: respawnRefusals, nextWaitMs: respawnWait });
}
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
			respawnWait = 0; respawnRefusals = 0;
			/* Back on our feet somewhere other than the fight - go to the leader
			   and keep going, which is exactly the recovery latch. */
			recovering = true; aim = null; bump('recoveries'); ev('respawned', { map: character.map });
		}
		return;
	}
	if (!CFG.autoRespawn) return;
	if (Date.now() - lastRespawn < (respawnWait || CFG.respawnMs)) return;
	lastRespawn = Date.now();
	bump('respawnCalls');
	try { respawn(); } catch (e) { noteWhy('respawn', e); clog('respawn threw: ' + e, 'red'); }
}

// ---------------------------------------------------------------- vote -----
function voteTick() {
	if (stopped || offCave() || isLeader()) return;
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
/* TWO CHECKS THE SERVER MAKES THAT v7 COULD NOT SEE COMING. The enter handler
   in node/logic/generated_maps.js throws 23 distinct reasons; gateReport only
   ever pre-checked four conditions, so the rest arrived as a surprise AFTER
   the one daily opening was spent. These two are the ones readable from here:

     cave_closed       gated on G.events.dreams.disabled, which exists and read
                       false on 2026-10-10.
     cave_other_server / invalid_home_server
                       character.home is "USIV" and the live server reports
                       region "US" + identifier "IV", so the test is a string
                       compare. A character whose home is another shard cannot
                       be brought in.

   Not checkable from the client, and still capable of refusing the open:
   daily_opening_used, zone_busy, already_opening, party_changed,
   admission_expired, cant_reenter, character_already_entering. */
function serverKey() {
	try {
		const r = parent.server_region, i = parent.server_identifier;
		if (typeof r === 'string' && typeof i === 'string') return r + i;
	} catch (e) {}
	return null;
}
function gateReport() {
	const out = [];
	const names = partyNames();
	try { if (G.events && G.events.dreams && G.events.dreams.disabled) out.push('CAVE IS CLOSED (dreams event disabled)'); } catch (e) {}
	const sk = serverKey();
	if (sk && character.home && character.home !== sk) out.push('me: home is ' + character.home + ', this server is ' + sk);
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
/* MEASURED OVER THE 2026-10-10 CAVE RUN, which is what every number here is for:

     character      loot() calls   loot_failed   cave_paused
     FatherToken          3,047         1,068            77
     Dexon                1,627           611            60
     MageofOz             1,562           572            63

   6,236 calls, 2,451 refusals - and more than half the calls drew no response
   at all, which is what firing faster than the server will answer looks like.

   THE PAUSE GUARD IS THE OPERATOR'S CATCH and it was a real omission: this was
   the ONLY loop in the file without one. moveTick has pausedMoveSkipped,
   combatTick has pausedAttackSkipped, loot had nothing, so the priest kept
   hammering open_chest through all 556 of its paused ticks. It is worth saying
   that it only explains about 7% of the volume, though - the other 93% is rate.

   THE RATE WAS THE REAL FAULT. v9 called the blanket loot() every 250ms for as
   long as get_chests() was non-empty, so a chest that could not be opened was
   re-attempted four times a second for its entire life. Now: a cooldown, a few
   chests per pass, and a chest that has refused lootMaxTries times is rested
   for lootDeadMs - the same shape as deadDoors, for the same reason.

   WHY THIS MATTERS MORE THAN ITS SIZE: the spam filled 75 of the event ring's
   80 slots and evicted every door, vote and phase event from the run. v9's
   friendly_target forensics live outside the ring precisely to survive that.
   Fix the source and the ring becomes worth reading again.

   THE RANGE FILTER IS CONDITIONAL ON PURPOSE. get_chests() returns
   parent.chests keyed by id, but it was empty everywhere it could be probed
   outside a cave, so whether a chest record carries x/y is UNVERIFIED. The
   filter applies only when the fields are actually numbers - typeof, never
   truthiness - and tel.chestFields records the real shape the first time one
   is seen, so the next run settles it. */
function lootTick() {
	if (stopped || character.rip) return;
	if (cavePaused()) { bump('pausedLootSkipped'); return; }
	const now = Date.now();
	if (now - lastLoot < CFG.lootMs) return;

	let chests = null;
	try { chests = (typeof get_chests === 'function') ? get_chests() : null; } catch (e) { bump('lootErr'); return; }
	if (!chests) return;
	const ids = Object.keys(chests);
	if (!ids.length) { chestTries = {}; deadChests = {}; return; }

	/* WHY chestFields WAS THE WRONG INSTRUMENT, kept here so the mistake is not
	   made again. It asked "does a chest record carry a position?" with
	   Object.keys, and came back with a PIXI sprite's OWN keys - _texture,
	   vertexData, blendMode, transform - and no x or y anywhere in the list.
	   Read literally that says the filter can never apply. The filter applied
	   4,916 times in the same run.

	   PIXI defines x and y as accessors on DisplayObject.prototype over
	   transform.position, and Object.keys does not walk a prototype. So the
	   one recon built to verify the filter's premise reported the opposite of
	   the truth, and the counters next to it were the only thing that caught
	   it. typeof reads through the prototype; Object.keys does not. */
	if (!tel.chestFields) {
		try { tel.chestFields = Object.keys(chests[ids[0]] || {}); } catch (e) { }
	}

	/* THE QUESTION chestFields COULD NOT ANSWER. Not "is there a position" -
	   there is - but "is it in the same coordinate space as character.real_x",
	   which is what the comparison actually assumes. A sprite's x/y could be
	   render coordinates, and comparing those against world coordinates would
	   reject nearly everything at any radius. 98.3% of attempts were rejected
	   against a 400 radius, so this is the live suspicion. gap vs lootRange on
	   a single real chest settles it. */
	if (!tel.chestProbe) {
		try {
			const c0 = chests[ids[0]];
			const hasXY = (typeof c0.x === 'number' && typeof c0.y === 'number');
			tel.chestProbe = {
				xType: typeof c0.x, yType: typeof c0.y,
				ownKey: Object.prototype.hasOwnProperty.call(c0, 'x'),
				x: hasXY ? Math.round(c0.x) : null, y: hasXY ? Math.round(c0.y) : null,
				myX: Math.round(character.real_x), myY: Math.round(character.real_y),
				gap: hasXY ? Math.round(Math.hypot(c0.x - character.real_x, c0.y - character.real_y)) : null,
				lootRange: CFG.lootRange, filterOn: !!CFG.lootRangeFilter,
				chestMap: c0.map, myMap: character.map,
			};
			ev('chestProbe', tel.chestProbe);
		} catch (e) { tel.chestProbe = { why: String(e) }; }
	}

	/* A chest that is gone has been looted or expired; forget it rather than
	   letting the two maps grow for the length of the run. */
	for (const k in chestTries) if (!chests[k]) delete chestTries[k];
	for (const k in deadChests) if (!chests[k]) delete deadChests[k];

	lastLoot = now;
	let tried = 0;
	for (const id of ids) {
		if (tried >= CFG.lootPerPass) break;
		if (deadChests[id] && now - deadChests[id] < CFG.lootDeadMs) { bump('lootRested'); continue; }
		if (deadChests[id]) { delete deadChests[id]; chestTries[id] = 0; }

		const c = chests[id];
		const useRange = !!CFG.lootRangeFilter;
		const cx = (useRange && c && typeof c.x === 'number') ? c.x : null;
		const cy = (useRange && c && typeof c.y === 'number') ? c.y : null;
		if (cx !== null && cy !== null
			&& Math.hypot(cx - character.real_x, cy - character.real_y) > CFG.lootRange) {
			bump('lootOutOfRange'); continue;
		}

		chestTries[id] = (chestTries[id] || 0) + 1;
		if (chestTries[id] > CFG.lootMaxTries) { deadChests[id] = now; bump('lootGaveUp'); continue; }

		tried++;
		/* loot() carries its own per-chest last_loot safety, so this is a
		   second gate rather than the only one. Nothing throws here in
		   practice - lootErr was 0 across all three characters - the refusal
		   arrives as loot_failed on game_response, which is why the backoff
		   counts ATTEMPTS rather than waiting for an error. */
		try { loot(id); bump('lootCalls'); } catch (e) { bump('lootErr'); deadChests[id] = now; }
	}
}

// ----------------------------------------------------- objective recon -----
/* READ-ONLY. Nothing here clicks, moves or interacts - it only writes down what
   the objective system looks like from inside, so the NEXT version can drive it
   without guessing.

   THE QUESTION IT ANSWERS: the operator found that the objective buttons at the
   top of the screen walk the character to the objective. If the position is
   reachable from `character.cave.objectives` then CaveRun can smart_move there
   itself and never touch the DOM - which is far more robust than synthesising a
   click. If it is NOT in the data, the button's own handler is the fallback, so
   the button is described too.

   Why both: `.click()` on a game button has already failed once in this
   codebase - the COMMAND gamebutton on /hub does not fire its inline onclick -
   so a DOM route is assumed broken until proven otherwise.

   Objectives are sampled once per floor and only when they change, so a 10
   minute run leaves a handful of records rather than thousands. */
let objSeen = {}, lastObjScan = 0;
function objRecon() {
	try {
		if (!inCave()) return;
		if (Date.now() - lastObjScan < 3000) return;
		lastObjScan = Date.now();
		const st = caveState();
		const objs = (st && st.objectives) || null;
		if (!objs) return;
		const floor = st.floor;
		const sig = floor + ':' + objs.map((o) => (o.id || o.name || '?') + (o.done ? '1' : '0')).join(',');
		if (objSeen[sig]) return;
		objSeen[sig] = 1;
		if (!tel.objectives) tel.objectives = [];
		if (tel.objectives.length > 24) return;
		tel.objectives.push({
			at: Date.now(), floor: floor,
			/* field NAMES, not prose - the text blobs are long and useless here */
			fields: objs.map((o) => Object.keys(o).join('|')),
			items: objs.map(function (o) {
				const r = { id: o.id || null, kind: o.kind || o.type || null,
					done: !!o.done, required: !!o.required };
				/* anything position-shaped, whatever it ends up being called */
				for (const k in o) {
					if (/^(x|y|map|pos|position|target|at|where|loc|location|spot)$/i.test(k)) {
						r['pos_' + k] = (o[k] && typeof o[k] === 'object') ? JSON.stringify(o[k]).slice(0, 80) : o[k];
					}
				}
				return r;
			}),
			me: { map: character.map, x: Math.round(character.real_x), y: Math.round(character.real_y) },
		});
		ev('objectives', { floor: floor, n: objs.length });
	} catch (e) {}
}

/* The buttons, described once. parent.document is the top window and this file
   runs in the maincode iframe, so the DOM is reachable - but it is only ever
   READ here. */
let btnScanned = false;
function objButtonRecon() {
	try {
		if (btnScanned || !inCave()) return;
		const d = parent.document;
		if (!d) return;
		const out = [];
		const nodes = d.querySelectorAll('[onclick], [id*="objective" i], [class*="objective" i], .gamebutton, [class*="quest" i]');
		for (let i = 0; i < nodes.length && out.length < 30; i++) {
			const n = nodes[i];
			const txt = (n.innerText || '').trim().slice(0, 40);
			if (!txt && !/objective|quest/i.test((n.id || '') + ' ' + (n.className || ''))) continue;
			out.push({
				tag: n.tagName, id: n.id || null,
				cls: (typeof n.className === 'string' ? n.className : '').slice(0, 60) || null,
				text: txt,
				/* the handler NAME, which is what a future version would call
				   directly instead of faking a click */
				onclick: n.getAttribute ? (n.getAttribute('onclick') || '').slice(0, 120) || null : null,
				data: (function () { const o = {}; try { for (const k in n.dataset) o[k] = String(n.dataset[k]).slice(0, 40); } catch (e) {} return Object.keys(o).length ? o : null; })(),
				rect: (function () { try { const r = n.getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); } catch (e) { return null; } })(),
			});
		}
		if (!out.length) return;
		btnScanned = true;
		tel.objButtons = out;
		/* and the candidate functions on the top window, by name only */
		const fns = [];
		try { for (const k in parent) { if (/objectiv|quest|waypoint|goto|travel_to/i.test(k) && typeof parent[k] === 'function') fns.push(k); } } catch (e) {}
		tel.objFns = fns.slice(0, 20);
		ev('objButtons', { n: out.length, fns: fns.length });
	} catch (e) {}
}

// ------------------------------------------------------------ telemetry ----
/* Keyed by CLASS, not name. A key containing "Token" is redacted by output
   filters on the reading side, which would silently blind the priest's
   telemetry - measured 2026-10-06. */
const TEL_KEY = 'cave_tel_' + character.ctype;

/* ONE KEY PER CLASS MEANT EVERY RUN DESTROYED THE LAST ONE. That is why a
   question about the 2026-10-10 run - did its doors work? - was unanswerable
   four days later: v7 carried the same doorTry/doorOk counters, recorded a real
   answer, and tonight's run overwrote it. runId already existed and was not in
   the key.

   THE ARCHIVE KEY KEEPS THE CLASS-NOT-NAME RULE above. A key containing
   "Token" is redacted by output filters on the reading side, so FatherToken's
   name must never appear in one; ctype + runId is safe.

   runId is 'r' + base36 of Date.now(), so ids of equal length sort lexically
   in time order - which lets telPrune find the oldest by sorting KEYS instead
   of parsing five 30 KB blobs. */
const TEL_RUN_PREFIX = TEL_KEY + '_';
const TEL_RUN_KEY = TEL_RUN_PREFIX + 'r' + Date.now().toString(36);
const TEL_KEEP = 5;
const TEL_ARCHIVE_MS = 30000;

const tel = {
	ver: 14, runId: TEL_RUN_KEY.slice(TEL_RUN_PREFIX.length), name: character.name, ctype: character.ctype,
	loadedAt: Date.now(), at: 0,
	/* COUNTER NAMES SAY WHAT THEY COUNT. v6 had a single `deaths` fed by
	   game.on('death'), which fires for EVERY entity; 91 of them got read as 91
	   party wipes when the real number was three. Split, permanently. */
	counters: { ticks: 0, engagedTicks: 0, pausedTicks: 0, pausedMoveSkipped: 0,
		pausedAttackSkipped: 0, attacks: 0, attackFail: 0, noTargetWhileEngaged: 0,
		closeSteps: 0, closeSmart: 0, kiteSteps: 0, kiteRejected: 0, recoveries: 0,
		outrunWarnTicks: 0, doorTry: 0, doorOk: 0, telArchiveFail: 0, cryptBlocked: 0,
		votesEcho: 0, voteErr: 0, entityDeaths: 0, partyDeaths: 0, respawnCalls: 0,
		hpPots: 0, mpPots: 0, scares: 0, exceptions: 0,
		invites: 0, accepts: 0, lootCalls: 0, lootErr: 0,
		buys: 0, buyErr: 0, restockBroke: 0, restockGaveUp: 0, restockMoveFail: 0,
		pausedLootSkipped: 0, lootRested: 0, lootGaveUp: 0, lootOutOfRange: 0,
		travelLeashTicks: 0, troubleTicks: 0, troubleWarnTicks: 0, beaconWriteFail: 0,
		holds: 0, holdStops: 0, holdResumes: 0, holdResumeFail: 0, holdGaveUp: 0 },
	skills: {}, skillFail: {}, skillFailWhy: {},
	/* EVERY response reason, counted. v6 filtered them through TEL_REASONS
	   before recording, so distance / not_ready / no_mp / cooldown never
	   appeared at all and cave_paused looked more dominant than it was. The
	   regex now governs only the event ring, never the tally. */
	reasons: {},
	friendly: {},          // v9 forensics: distinct friendly_target victims
	objectives: null,      // v9 recon: what an objective record looks like
	chestFields: null,     // v10 recon: OWN KEYS ONLY - see chestProbe for why
	chestProbe: null,      // v11 recon: the question chestFields could not answer
	doorShape: null,       // v11 recon: what a door record actually carries
	doors: [],             // v11 recon: one entry per transport() attempt
	objButtons: null,      // v9 recon: the top-bar buttons, read-only
	objFns: null,
	maxDistLeader: 0, msBeyondLeash: 0, msRecovering: 0, msHolding: 0, helpers: {}, events: [],
};
function bump(k, n) { tel.counters[k] = (tel.counters[k] || 0) + (n || 1); }
function bumpReason(r, place) {
	tel.reasons[r] = (tel.reasons[r] || 0) + 1;
	if (place) { const k = r + '@' + place; tel.reasons[k] = (tel.reasons[k] || 0) + 1; }
	if (r === 'cant_respawn') { try { noteRespawnRefused(); } catch (e) {} }
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
		const blob = JSON.stringify(tel);
		parent.localStorage.setItem(TEL_KEY, blob);
		telArchive(false, blob);
	} catch (e) {}
}

/* ARCHIVED ON ITS OWN CLOCK, NOT ON `force`. ev() already calls telFlush(true)
   on a 500ms throttle, so archiving on every forced flush would write 30 KB
   twice a second for nothing. 30s is the resolution of the worst case that
   actually happens: the operator switches scripts and the run ends with no
   final flush, losing at most the last half minute. */
let lastArchive = 0;
function telArchive(force, blob) {
	if (!force && Date.now() - lastArchive < TEL_ARCHIVE_MS) return;
	lastArchive = Date.now();
	try {
		parent.localStorage.setItem(TEL_RUN_KEY, blob);
	} catch (e) {
		/* Out of quota. Drop every older archive and try once - losing old runs
		   beats losing the one in progress. */
		telPrune(0);
		try { parent.localStorage.setItem(TEL_RUN_KEY, blob); }
		catch (e2) { bump('telArchiveFail'); return; }
	}
	telPrune(TEL_KEEP);
}

/* Collect the keys BEFORE removing any: localStorage is index-addressed and
   removing during the walk reshuffles what ls.key(i) returns. */
function telPrune(keep) {
	try {
		const ls = parent.localStorage;
		const mine = [];
		for (let i = 0; i < ls.length; i++) {
			const k = ls.key(i);
			if (k && k.indexOf(TEL_RUN_PREFIX) === 0) mine.push(k);
		}
		if (mine.length <= keep) return;
		mine.sort();   // lexical == chronological, see TEL_RUN_KEY
		const doomed = mine.slice(0, mine.length - keep);
		for (let i = 0; i < doomed.length; i++) ls.removeItem(doomed[i]);
	} catch (e) {}
}

/* Everything this class has kept, newest last - so a later session can read a
   run that has already been replaced as the live one. */
function caveRuns() {
	const out = [];
	try {
		const ls = parent.localStorage;
		for (let i = 0; i < ls.length; i++) {
			const k = ls.key(i);
			if (k && k.indexOf(TEL_RUN_PREFIX) === 0) out.push(k);
		}
	} catch (e) {}
	return out.sort();
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
function caveDump() {
	telFlush(true);
	try { telArchive(true, JSON.stringify(tel)); } catch (e) {}
	try { show_json(tel); } catch (e) {}
	clog('telemetry at ' + TEL_KEY + ' - this run archived at ' + TEL_RUN_KEY);
	clog('kept runs: ' + caveRuns().join(', '));
	return tel;
}

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
/* Crypt mode. The leader is yours to drive; the other two cohere and shoot,
   and only at CRYPT.only. Run it on all three before you take the door. */
function caveCrypt() {
	mode = 'crypt'; stopped = false; phase = 'active'; recovering = false; aim = null;
	clog('CRYPT MODE as ' + role() + ' - hunting: ' + CRYPT.only.join(', ')
		+ ' | will answer anything that starts it EXCEPT ' + CRYPT.never.join(', '), '#FFD700');
	clog('leader is operator-driven; followers cohere at ' + leash().closeAt + 'u (' + leash().mode + '); hold is ' + (holdActive() ? 'ON' : 'off here'), '#FFD700');
	return { mode: mode, role: role(), leader: leaderName(),
		only: CRYPT.only.slice(), never: CRYPT.never.slice() };
}

/* Adjust the lists without a redeploy - v12 needed a paste to change its mind,
   which is a poor property to discover while standing in the room. Call with no
   arguments to read the current lists. */
function caveOnly() {
	if (arguments.length) CRYPT.only = Array.prototype.slice.call(arguments).filter(Boolean);
	clog('crypt only: ' + (CRYPT.only.join(', ') || '(nothing)'), '#FFD700');
	return CRYPT.only.slice();
}

function caveNever() {
	if (arguments.length) CRYPT.never = Array.prototype.slice.call(arguments).filter(Boolean);
	clog('crypt never (not even in self-defence): ' + (CRYPT.never.join(', ') || '(nothing)'), '#FFD700');
	return CRYPT.never.slice();
}

function caveDry() {
	if (inCave()) { clog('already inside a cave - caveDry() is for outside', 'orange'); return null; }
	mode = 'dry'; stopped = false; phase = 'active'; recovering = false; aim = null;
	clog('DRY RUN as ' + role() + ' (' + character.name + '/' + character.ctype + ' speed ' + character.speed
		+ ' range ' + character.range + '). Leader ' + leaderName() + '. Will NOT enter anything.', '#FFD700');
	ev('dry', { leader: leaderName(), role: role() });
	return { mode: mode, role: role(), leader: leaderName() };
}
/* RESTOCK COMES FIRST, AND EACH CHARACTER DOES ITS OWN. caveSay('go') reaches
   the followers, so all three start shopping at the same moment rather than
   the leader waiting at Dorr for two characters that have not left town. The
   phase advances itself to 'gather' from restockTick - on success, on running
   out of gold, or on the give-up timer - so there is no path where a character
   stays in town indefinitely. */
function caveGo() {
	if (offCave()) { clog('in ' + mode + ' mode - caveStop() then re-engage for a real run', 'orange'); return null; }
	stopped = false;
	restockReset();
	phase = 'restock';
	caveSay('go');
	const short = restockShortfall();
	clog('restocking first' + (Object.keys(short).length ? ' - short ' + JSON.stringify(short) : ' - already topped up')
		+ (isLeader() ? ' - and told ' + followers().join(', ') : '') + ' - combat held until inside', '#FFD700');
	return phase;
}
function caveStop() { stopped = true; phase = 'idle'; recovering = false; aim = null; caveSay('stop'); clog('stopped', 'orange'); }
function caveStatus() {
	const st = caveState(), lp = leaderPos();
	const info = { mode: mode, only: (mode === 'crypt' ? CRYPT.only.slice() : null),
		never: (mode === 'crypt' ? CRYPT.never.slice() : null),
		role: role(), leader: leaderName(), phase: phase, active: active(),
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
	if (offCave()) { clog('REFUSED - ' + mode + ' mode never enters the Cave. caveStop() and re-engage first.', 'red'); return null; }
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
	window.caveCrypt = caveCrypt; window.caveOnly = caveOnly; window.caveNever = caveNever;
	window.caveEnter = caveEnter; window.caveStatus = caveStatus; window.caveStop = caveStop;
	window.caveDump = caveDump; window.caveLeash = caveLeash;
} catch (e) {}

// ---------------------------------------------------------------- loop -----
async function tick() {
	try {
		const was = phase;
		if (inCave()) phase = 'inside';
		else if (phase === 'inside') { phase = 'idle'; votedFor = {}; deadDoors = {}; }
		else if (offCave()) phase = stopped ? 'idle' : 'active';
		else if (phase === 'gather' && character.map === CFG.keeper.map && dist(character, CFG.keeper) <= CFG.stageWithin) phase = 'staged';
		if (phase !== was) { clog('phase -> ' + phase, '#7FD1FF'); ev('phase', { from: was, to: phase }); }
		if (phase === 'staged' && isLeader()) {
			const b = gateReport();
			throttleLog(b.length ? 'staged, BLOCKED: ' + b.join(' | ') : 'staged and clear - caveEnter() when ready');
		}
		bump('ticks');
		if (engaged()) bump('engagedTicks');
		if (cavePaused()) bump('pausedTicks');
		objRecon();             // read-only; cheap, throttled, inside only
		objButtonRecon();       // read-only; runs once
		deathTick();            // before anything that returns early on rip
		potionTick();
		partyTick();
		lootTick();
		senseTick();            // beacon out, trouble + leash in - before anything moves
		await moveTick();
		await combatTick();
		telFlush();
	} catch (e) { bump('exceptions'); ev('exception', String(e)); clog('tick: ' + e, 'red'); }
	if (alive()) setTimeout(tick, CFG.tickMs);
}
function voteLoop() { try { voteTick(); } catch (e) { clog('vote: ' + e, 'red'); } if (alive()) setTimeout(voteLoop, CFG.voteTickMs); }

clog('v14 loaded as ' + role() + ' (' + character.name + '/' + character.ctype + ' speed ' + character.speed
	+ '). Leader ' + leaderName() + '. caveDry() to rehearse on-map, caveGo() for a real run, caveLead(name) to retarget.', '#7FD98A');
telCensus();
telHook();
hookPartyInvite();
ev('load', { ver: 14, leader: leaderName(), role: role(), speed: character.speed, range: character.range,
	missing: Object.keys(tel.helpers).filter((k) => tel.helpers[k] === 'undefined') });
tick();
voteLoop();

})();
