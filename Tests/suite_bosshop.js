/* Ranger's cross-shard boss hop: the taxi-join predicate, the three gates it
   feeds, the walk-in-sick probe, and the hop lock that stops a burst of
   boss_hop messages. Every function is lifted from Party/Ranger.js as
   committed. */

const { lift, world } = require('./lift');
const RANGER = 'Party/Ranger.js';
const MAGE_PATH = 'Party/Mage.js';
const PRIEST_PATH = 'Party/Priest.js';

const G_BASE = {
	events: {
		crabxx: { join: true, duration: 2400 }, franky: { join: true, duration: 2400 },
		icegolem: { join: true, duration: 2400 }, goobrawl: { join: true, duration: 540 },
		abtesting: { join: true, duration: 480 },
		/* `join: true` read from design/events.js at upstream 16881a27. It is
		   the premise of the inverted assertion below: without it, deleting
		   the BOSS_JOIN_SPOTS row would prove nothing. */
		horseman: { join: true, duration: 2400 },
	},
	maps: { main: { doors: [[1]] }, level2w: { doors: [[1], [2], [3]] }, winterland: { doors: [[1]] }, goobrawl: { doors: [] }, halloween: { doors: [[1], [2], [3], [4], [5]] } },
	monsters: { crabxx: { hp: 960000 }, franky: { hp: 120000000 }, dragold: { hp: 25600000 } },
	conditions: { hopsickness: { duration: 720000 } },
};

const CFG = () => ({
	bossHop: {
		enabled: true, hopLatencyMs: 1500, safetyMarginMs: 500, joinClearMarginMs: 30000,
		dexonDps: 2605, typicalPlayerDps: 2000, minContributors: 5, maxContributors: 200,
		returnHome: true, returnHomeAfterMs: 90000,
		targets: [{ mtype: 'dragold', kills_to_rung: 1 }, { mtype: 'franky', kills_to_rung: 68 }, { mtype: 'crabxx', kills_to_rung: 70 }],
	},
});

function ranger(over = {}) {
	const w = world(Object.assign({
		CONFIG: over.CONFIG || CFG(),
		REGIONS: ['US', 'EU', 'ASIA'], HOP_ATTEMPT_CAP: 5, HOP_RELOAD_GRACE_MS: 15000,
		TAXI_PROBE_KEY: 'taxi_probe', TAXI_PROBE_MAX: 30,
		parent: Object.assign({ G: G_BASE, S: over.S || {}, server_region: 'US', server_identifier: 'I' }, over.parentExtra || {}),
	}, over));
	/* bossState and bossCooledDown are lifted because localTarget() now reads the
	   give-up cooldown. They are declared in the same file as bossHop, so a live
	   CODE context always has them; only a lifted world has to be told. Two
	   existing tests threw ReferenceError the moment the gate landed, which is
	   the suite doing its job rather than a hazard in the script. */
	/* bossShard and bossCooldownKey joined the list when v103 keyed the
	   cooldown by (type, shard); four tests threw ReferenceError the moment it
	   landed, which is the same signal bossCooledDown gave in v99. */
	lift(w, RANGER, ['scopeKey', 'scopedHas', 'scopedSet', 'scopedGet', 'scopedGetLegacy',
		'bossState', 'bossCooledDown', 'bossShard', 'bossCooldownKey',
		'BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossRank', 'BOSS_JOIN_SPOTS', 'bossTaxiWalkable',
		'taxiProbeRead', 'taxiProbeWrite', 'taxiProbeNote', 'taxiProbeClose', 'bossHop']);
	w.bossHop.shardDps = () => 5000;
	w.bossHop.localBossLive = (t) => (over.live || []).includes(t);
	return w;
}

/* The spookytown mummy spawn, read from upstream design/maps.js at 16881a27,
   and Graveyard Rising's grave field from design/events.js at the same commit.
   Both are GAME DATA rather than ours, so they are fixtures and the assertions
   compute against them instead of restating a conclusion. */
const MUMMY_RAGE = [-124, -1631, 614, -1130];
const MUMMY_BOUNDARY = [31, -1571, 480, -1293];
const GRAVES_X = [65, 447];
const GRAVES_Y = [-1550, -1312];
const GARGOYLE = [255, -1545];
const inBox = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

/* Names out of the committed EVENT_LOCATIONS array. Comments are stripped
   first, per the apostrophe-parser lesson in suite_merchantsell.js - a `//`
   line mentioning a name would otherwise count as an entry. */
const EVENT_LOC_NAMES = (() => {
  const src = require('fs').readFileSync(
    require('path').join(require('./lift').ROOT, 'Party/Ranger.js'), 'utf8');
  const m = src.match(/const EVENT_LOCATIONS = \[([\s\S]*?)\n\];/);
  if (!m) return [];
  const body = m[1].split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  return (body.match(/name:\s*'([^']+)'/g) || []).map(x => x.replace(/.*'([^']+)'/, '$1'));
})();

/* The preposition planner's world: the ranger hop world plus the gate it
   consults (bossEligible) and the liveness rule a hold reads (bossEntryLive).
   US II is home, as on the live party. */
function prepWorld(o = {}) {
	const cfg = CFG();
	cfg.bossHop.preposition = { enabled: true, alsoFor: o.alsoFor || [], walkLeadMs: 180000, marginMs: 60000,
		minUsefulMs: 120000, feedMaxAgeMs: 300000, lineupMaxAgeSec: 1800 };
	cfg.bossEvents = { enabled: true, exclude: new Set(['abtesting']), include: [], cooperativeOnly: true };
	const w = ranger({ CONFIG: cfg, BOSS_TYPE_GIVEUP_MAX: 2, character: o.character,
		parentExtra: { server_region: o.region || 'US', server_identifier: o.id || 'II' } });
	lift(w, RANGER, ['BOSS_PRESENCE_LIVE', 'bossEntryLive', 'bossEligible']);
	w.bossCooperative = () => true;
	w.parent.S = {};
	return w;
}
function row(shard, event, at, windowSec, status) {
	return { shard, event, at, windowSec, status: status || 'scheduled' };
}
/* Every shard named in the rows, plus home, gets a fresh lineup unless an
   age is given for it. */
function feed(w, rows, ages = {}) {
	w.bossHop.schedRows = rows;
	const s = {};
	for (const k of ['USII'].concat(rows.map(r => r.shard))) s[k] = { ageSec: k in ages ? ages[k] : 10 };
	for (const k in ages) s[k] = { ageSec: ages[k] };
	w.bossHop.schedServers = s;
	w.bossHop.schedAt = Date.now();
}

module.exports = [

{ name: 'the spookytown corridor park point is outside the graveyard rage box', fn(t) {
  /* THE SCRIPT CARRIES NO GRAVEYARD CODE AND IS NOT GOING TO. Operator,
     2026-10-21: "I did not want the ranger script updated. I wanted an
     override code I could paste and execute." v108 built it as CONFIG plus a
     gyTick() interval, v109 rebuilt it as gyFarm()/gyOff() console commands,
     and BOTH were the wrong shape - a command in the file is still a file
     change. Ranger v110 reverts to v107 byte-for-byte and the graveyard is a
     pasted snippet instead.
     WHAT SURVIVES IS THE GEOMETRY, because the snippet's coordinates rest on
     it, and the repo DOES still carry the route: the approach chain for
     (290,-990). So this asserts game-data fixtures to show WHY the park point
     has to be out there, and the COMMITTED chain to show the route to it never
     enters the rectangle. Deleting the test with the code would have left the
     snippet's one load-bearing number unpinned. */
  for (const x of GRAVES_X) for (const y of GRAVES_Y) {
    t.ok('grave plot (' + x + ',' + y + ') is inside the mummy RAGE rectangle',
      inBox(MUMMY_RAGE, x, y));
    t.ok('and inside the mummy SPAWN boundary - the graveyard IS the mummy field',
      inBox(MUMMY_BOUNDARY, x, y));
  }
  t.ok('the gargoyle spawn is in there too', inBox(MUMMY_RAGE, GARGOYLE[0], GARGOYLE[1]));

  const rs = require('fs').readFileSync(
    require('path').join(require('./lift').ROOT, RANGER), 'utf8');

  /* Parsed out of the file rather than restated here. Every waypoint AND the
     destination must sit outside the rectangle: rageClips() is TYPE-BLIND, so
     safeMove refuses the route whatever `home` is set to, and the override
     would be INERT rather than wrong - the party never arrives and nothing
     logs a fault. */
  const m = rs.match(/'spookytown\|290\|-990':\s*\[([\s\S]*?)\n\s*\]/);
  t.ok('the approach chain for spookytown|290|-990 is still committed', !!m);
  const pts = m ? (m[1].match(/\[\s*-?\d+\s*,\s*-?\d+\s*\]/g) || [])
    .map(s => s.match(/-?\d+/g).map(Number)) : [];
  t.ok('and it parsed to waypoints (' + pts.length + ')', pts.length >= 10);
  let breaches = 0;
  for (const p of pts) if (inBox(MUMMY_RAGE, p[0], p[1])) breaches++;
  t.eq('no waypoint on the route enters the rage rectangle', breaches, 0);
  t.eq('nor does the destination itself', inBox(MUMMY_RAGE, 290, -990), false);
  t.ok('and it sits in the corridor band outside BOTH rectangles, y -1130..-842',
    -990 > MUMMY_RAGE[3] && -990 <= -842);

  /* INVERTED, so the parse is proved capable of catching a breach rather than
     passing because it found nothing. A fixture waypoint inside the box must
     fail the same test the real ones pass. */
  t.eq('a waypoint inside the box WOULD be caught', inBox(MUMMY_RAGE, 255, -1400), true);

  /* The gargoyle is why the snippet cannot promise the prize: 555 units from
     the park point against the longest reach in the party, the mage's 235. */
  const reach = Math.hypot(GARGOYLE[0] - 290, GARGOYLE[1] + 990);
  t.ok('the gargoyle is beyond every reach in the party (' + Math.round(reach) + 'u)',
    reach > 500);

  /* BOTH REJECTED SHAPES PINNED ABSENT, so neither returns by accident. */
  t.eq('no gyTick exists', /function gyTick/.test(rs), false);
  t.eq('no interval polls the graveyard', /setInterval[\s\S]{0,160}?gyTick/.test(rs), false);
  /* TIGHTENED 2026-10-22: this matched any one-tab `graveyard: {`, and
     BOSS_JOIN_SPOTS now legitimately has one. The assertion is about a CONFIG
     TOGGLE BLOCK, so it has to say so - a pattern that cannot tell the thing
     it forbids from the thing that replaced it is worse than no pattern. */
  t.eq('no CONFIG.graveyard block',
    /CONFIG\.graveyard|^\tgraveyard: \{\s*$|graveyard: \{\s*\n\s*enabled:/m.test(rs), false);
  t.ok('precondition: the BOSS_JOIN_SPOTS row that broke the old pattern IS there',
    /^\tgraveyard: \{ map: 'spookytown'/m.test(rs));
  t.eq('no TOGGLES entry', /graveyardFarm:/.test(rs), false);
  t.eq('no gyFarm command', /function gyFarm/.test(rs), false);
  t.eq('no gyOff command', /function gyOff/.test(rs), false);
  t.eq('achvTick has no graveyard exemption', /gyOwnsSpot/.test(rs), false);

  /* THE PASTED SNIPPET NEEDS `mummy` IN THE PULL TYPES AND THAT IS NOT
     OBVIOUS. ragePullActive() matches ragePullTypes() against the rage BOXES
     on the map, and the only box is the mummy's - zombie and ghoul are event
     spawns with no box of their own. So home:'zombie' alone leaves the pull
     machinery idle and nothing ever comes out. The CANDIDATE scan, by
     contrast, is POSITION-based (rageHit on the monster's own x/y), so a
     zombie standing on a grave is pullable once the machinery is running. */
  t.ok('ragePullActive gates on a box TYPE being in the types list',
    /for \(const b of boxes\) if \(types\.indexOf\(b\.type\) >= 0\) return true;/.test(rs));
  t.ok('while the pull candidate scan gates on POSITION',
    /if \(!rageHit\(map, e\.x, e\.y, 0\)\) continue;/.test(rs));
  /* THE FARM PATH'S TYPES ARE STILL home + rageAlso - the snippet's guarantee
     is intact - but they moved into ragePullCtx() when the pull learned to read
     a boss trip, so this points at where they live rather than at a body that
     no longer holds them. The claim did not rot; the address did. */
  t.ok('the FARM branch of ragePullCtx is still home plus rageAlso',
    /src: 'farm'[\s\S]{0,200}?types: out/.test(rs)
    && /function ragePullCtx\(\)[\s\S]{0,1600}?out\.push\(home\)[\s\S]{0,200}?of rageAlso/.test(rs));
  t.ok('and ragePullTypes still answers from that context',
    /function ragePullTypes\(\) \{ return ragePullCtx\(\)\.types; \}/.test(rs));
  /* THE TYPE TEST ABOVE IS NOW THE FIRST OF TWO DISJUNCTS, not the whole
     story - a positional half was added so a graveyard trip, whose types own
     no rectangle, can activate the pull at all. Asserted here so the sibling
     assertion is not read as "type matching is all there is". */
  t.ok('ragePullActive also has a POSITIONAL disjunct',
    /rageBoxedTarget\(character\.map, types\)/.test(rs));
} },

{ name: 'graveyard is handled as a boss event, not through the farm layer', fn(t) {
  /* FOUR ENTRIES AND A GUARD. The operator's ruling is that graveyard is
     handled automatically "similar to goo brawl and at the same rank as
     horseman". Driving it through the BOSS-EVENT layer rather than the farm
     layer is what makes that free: shouldHandleEvents()/handleEvents() already
     own movement, so there is no queue exemption to carve - which is what
     v108 had to do and what read, at the time, as evidence the automation was
     wrong. It was evidence the LAYER was wrong. */
  const G = JSON.parse(JSON.stringify(G_BASE));
  G.maps.spookytown = {
    doors: [[72, -80, 32, 40, 'halloween', 2, 1]],
    monsters: [
      { type: 'mummy', rage: MUMMY_RAGE, boundary: MUMMY_BOUNDARY },
      { type: 'booboo', rage: [286, -842, 544, -562] },
      { type: 'booboo', rage: [-820, -940, -570, -630] },
    ],
  };
  G.monsters.zombie = { cooperative: true, hp: 9000 };
  G.monsters.ghoul = { cooperative: true, hp: 32000 };
  G.monsters.gargoyle = { cooperative: true, hp: 6000000 };

  const notes = [];
  const gw = (over) => {
    over = over || {};
    const w = world({
      CONFIG: { achievements: { pull: { enabled: over.pull !== false } } },
      parent: { G: G, S: over.S || {} },
      bossNote: (m) => notes.push(m),
    });
    /* EVENT_LOCATIONS is `const X = [` - the ARRAY form of the non-liftable
       initialiser this repo already records for `new Set([...])`. lift()
       brace-matches from the first `{`, which here is the first ELEMENT, so
       asking for it swallows the rest of the file and throws "Unexpected end
       of input". Supplied here and pinned against the source below, per the
       remedy that trap already has. */
    lift(w, RANGER, ['BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossRank', 'BOSS_FIGHT_TYPES',
      'bossMonsterTypes', 'bossCooperative', 'BOSS_JOIN_SPOTS', 'bossTaxiWalkable',
      'rageCfg', 'rageBoxes', 'rageHit', 'bossWalkTarget']);
    w.EVENT_LOCATIONS = EVENT_LOC_NAMES.map(n => ({ name: n, map: 'x', x: 0, y: 0 }));
    /* `let ragePullShared = null` - same non-liftable shape, read by rageCfg.
       Left undefined it throws a ReferenceError from inside rageCfg, which is
       how the first draft of the guard was caught failing open. */
    w.ragePullShared = null;
    w.rageEntryActive = false;
    w.rageEntryOkSince = 0;
    w.rageEntryHeard = null;
    return w;
  };
  let w = gw();

  /* THE PIN: bossWalkTarget consults EVENT_LOCATIONS BEFORE BOSS_JOIN_SPOTS,
     so a graveyard row there would take precedence over the join spot and the
     guard below would be testing nothing. Read from the committed file rather
     than assumed. */
  t.eq('precondition: EVENT_LOCATIONS carries no graveyard row',
    EVENT_LOC_NAMES.indexOf('graveyard'), -1);
  t.ok('and it parsed to real rows (' + EVENT_LOC_NAMES.length + ')', EVENT_LOC_NAMES.length >= 3);
  t.eq('precondition: rageCfg is callable, so a false here means NOT contained '
    + 'rather than a throw the guard swallowed', typeof w.rageCfg(), 'object');

  /* --- rank ------------------------------------------------------------- */
  t.eq('graveyard ranks 5 (4 until the 2026-10-25 ruling)', w.bossRank('graveyard'), 5);
  t.eq('which TIES horseman', w.bossRank('graveyard'), w.bossRank('horseman'));
  /* A tie is normally what this table avoids, so the thing to pin is not the
     number but WHY the tie can never be exercised: horseman is realm hour 0,
     graveyard odd realm hours, and every regional offset is odd. */
  const TIMEO = { EU: 1, US: -5, ASIA: 7 };
  const utc = (realm, off) => ((realm - off) % 24 + 24) % 24;
  const horsemanUTC = Object.values(TIMEO).map(o => utc(0, o)).sort((a, b) => a - b);
  const graveUTC = [];
  for (const o of Object.values(TIMEO)) for (let h = 1; h < 24; h += 2) {
    const u = utc(h, o); if (graveUTC.indexOf(u) < 0) graveUTC.push(u);
  }
  t.eq('every regional offset is odd', Object.values(TIMEO).every(o => Math.abs(o % 2) === 1), true);
  t.eq('so horseman lands on ODD UTC hours only', horsemanUTC.every(h => h % 2 === 1), true);
  t.eq('and graveyard on EVEN UTC hours only', graveUTC.sort((a, b) => a - b).every(h => h % 2 === 0), true);
  t.eq('the two hour sets are disjoint',
    horsemanUTC.filter(h => graveUTC.indexOf(h) >= 0).length, 0);
  /* INVERTED: an even-offset region breaks it, which is the contingency the
     comment names. Nothing in the schedule code would have to change. */
  t.eq('a region at offset 2 WOULD collide', utc(0, 2) % 2, 0);

  /* --- eligibility, which is the entry nobody would guess ---------------- */
  t.eq('precondition: graveyard is not a monster in G',
    G.monsters.graveyard === undefined, true);
  t.eq('bossMonsterTypes resolves it to the waves',
    w.bossMonsterTypes('graveyard').join(','), 'zombie,ghoul');
  t.eq('so bossCooperative says yes, which is what bossEligible gates on',
    w.bossCooperative('graveyard'), true);
  /* INVERTED, AND THIS IS THE LOAD-BEARING ONE: drop the BOSS_FIGHT_TYPES row
     and the event is refused as "not cooperative" - the attack list and the
     eligibility gate are the same table, which the name does not say. */
  const noRow = gw();
  delete noRow.BOSS_FIGHT_TYPES.graveyard;
  t.eq('without the row it falls to the [name] default',
    noRow.bossMonsterTypes('graveyard').join(','), 'graveyard');
  t.eq('and the event would be refused as not cooperative',
    noRow.bossCooperative('graveyard'), false);
  t.eq('the gargoyle is deliberately NOT in the fight list',
    w.bossMonsterTypes('graveyard').indexOf('gargoyle'), -1);

  /* --- the join spot mirrors the server -------------------------------- */
  const spot = w.BOSS_JOIN_SPOTS.graveyard;
  t.ok('graveyard has a join spot', !!spot);
  t.eq('on spookytown', spot && spot.map, 'spookytown');
  t.eq('at the server handler’s own coordinates', spot && spot.x + ',' + spot.y, '255,-1030');
  t.eq('which is OUTSIDE the mummy rage rectangle',
    inBox(MUMMY_RAGE, spot.x, spot.y), false);
  t.eq('and outside both booboo boxes',
    inBox([286, -842, 544, -562], spot.x, spot.y)
    || inBox([-820, -940, -570, -630], spot.x, spot.y), false);
  t.eq('spookytown has doors, so a hop-sick character walks rather than waiting',
    w.bossTaxiWalkable('graveyard'), true);

  /* --- THE DEFECT THE FOUR ENTRIES ALONE WOULD HAVE SHIPPED -------------- */
  /* parent.S.graveyard carries the GARGOYLE's fixed spawn from the first wave,
     and that point is inside the rectangle. bossWalkTarget reads parent.S
     FIRST, so the hop-sick walk would have aimed at a coordinate safeSmartMove
     refuses - inert, not wrong, with one orange line and no explanation. */
  const LIVE = { graveyard: { live: true, map: 'spookytown', x: 255, y: -1545, wave: 3, waves: 3 } };
  t.eq('precondition: the published point IS inside the rage rectangle',
    inBox(MUMMY_RAGE, LIVE.graveyard.x, LIVE.graveyard.y), true);
  w = gw({ S: LIVE });
  const where = w.bossWalkTarget('graveyard') || {};
  t.eq('so the walk target falls through to the join spot', where.x + ',' + where.y, '255,-1030');
  t.ok('and it says why', notes.some(n => /inside a rage box/.test(n)));

  /* The guard is DERIVED, not a graveyard special case: an ordinary boss whose
     published point is clear keeps it. */
  w = gw({ S: { franky: { live: true, map: 'spookytown', x: 255, y: -1030 } } });
  const ok = w.bossWalkTarget('franky') || {};
  t.eq('a published point outside the box is used as-is', ok.x + ',' + ok.y, '255,-1030');

  /* AND IT TURNS ITSELF OFF WITH CONTAINMENT, which is what makes one guard
     serve the entry case too: with pull disabled safeMove stops refusing the
     rectangle, so the walk should aim at the real Gargoyle position. */
  w = gw({ S: LIVE, pull: false });
  t.eq('precondition: containment is off', w.rageCfg().enabled, false);
  const inside = w.bossWalkTarget('graveyard') || {};
  t.eq('the walk then aims at the gargoyle itself', inside.x + ',' + inside.y, '255,-1545');
} },

{ name: 'entering the rage box is the leader’s call, and off until the operator says', fn(t) {
  /* Entry is containment coming OFF, which is a PARTY-WIDE movement mode: a
     character that enters while another does not has its safeMove accepting a
     destination the other's still refuses, so the leader walks into the field
     and the followers hold at the corridor. That is the split this repo has a
     section about, and it is why the decision is broadcast rather than
     computed three times. */
  const G = JSON.parse(JSON.stringify(G_BASE));
  G.maps.spookytown = { doors: [[1]], monsters: [{ type: 'mummy', rage: MUMMY_RAGE }] };

  const sent = [];
  const mk = (over) => {
    over = over || {};
    const w = world({
      character: { name: over.me || 'FatherToken', map: 'spookytown', rip: false },
      CONFIG: {
        party: { groupMembers: ['FatherToken', 'Dexon', 'MageofOz'] },
        achievements: { pull: {} },
        bossEvents: {
          leaderName: 'FatherToken',
          rageEntry: Object.assign({
            enabled: true, minSoaked: 6, holdMs: 20000,
            retreatAtAttackers: 3, trustMs: 15000,
          }, over.cfg || {}),
        },
      },
      parent: { G: G, entities: over.ents || {},
        S: over.S || { graveyard: { live: true, gargoyle: true } } },
      bossState: { trip: over.trip === undefined ? { name: 'graveyard' } : over.trip },
      plSend: (to, d) => sent.push([to, d]),
      rageLog: () => {},
      ragePullShared: null,
      rageEntryActive: !!over.active,
      rageEntryOkSince: over.okSince || 0,
      rageEntryInSince: over.inSince || 0,
      rageEntryWindow: over.window || [],
      rageEntryHeard: over.heard || null,
    });
    lift(w, RANGER, ['rageBoxes', 'rageHit', 'rageCfg', 'bossIsLeader', 'rageCrowdSoak',
      'rageAttackersOnMe', 'rageEntrySet', 'rageEntryNotWanted', 'rageEntryTick',
      'rageEntryBroadcast', 'rageEntryOnCall']);
    return w;
  };
  /* Monsters INSIDE the rectangle. `other` is held by a stranger, `mine` by us,
     `free` by nobody - the three cases the signal has to tell apart. */
  const IN = (n, target) => {
    const o = {};
    for (let i = 0; i < n; i++) o['m' + target + i] =
      { type: 'monster', mtype: 'mummy', x: 255, y: -1400, target: target };
    return o;
  };
  const OUTSIDE = { far: { type: 'monster', mtype: 'mummy', x: 255, y: -1030, target: 'Stranger' } };

  /* --- the signal -------------------------------------------------------- */
  let w = mk({ ents: Object.assign({}, IN(7, 'Stranger'), IN(2, 'Dexon'), OUTSIDE) });
  t.eq('precondition: the sample point is inside the rectangle',
    inBox(MUMMY_RAGE, 255, -1400), true);
  t.eq('precondition: and the OUTSIDE one is not', inBox(MUMMY_RAGE, 255, -1030), false);
  const soak = w.rageCrowdSoak('spookytown');
  t.eq('counts only monsters in the box', soak.boxed, 9);
  t.eq('and only those held by a non-party name', soak.soaked, 7);
  t.eq('a monster on one of OURS is not crowd soak',
    w.rageCrowdSoak('spookytown').soaked < soak.boxed, true);

  /* --- ON since 2026-10-24, on the operator's word ------------------------
     "the ability for the party to enter the ragebox for gargoyle". It shipped
     off from v112 until then; the gate below is what keeps it narrow. All
     three, because a follower's tick checks its OWN toggle before it hears
     the leader, and one left off is a party split. */
  for (const f of ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js']) {
    const rs = require('fs').readFileSync(require('path').join(require('./lift').ROOT, f), 'utf8');
    t.ok(f + ': the toggle ships true', /\trageEntry:\s+true,/.test(rs));
  }
  w = mk({ cfg: { enabled: false }, ents: IN(20, 'Stranger') });
  w.rageEntryTick('spookytown');
  t.eq('a crowd of 20 does not open a disabled gate', w.rageEntryActive, false);
  t.eq('and containment stays on', w.rageCfg().enabled, true);

  /* --- the leader needs the crowd SUSTAINED ------------------------------ */
  w = mk({ ents: IN(7, 'Stranger') });
  w.rageEntryTick('spookytown');
  t.eq('first tick starts the clock, it does not enter', w.rageEntryActive, false);
  t.ok('and the clock is running', w.rageEntryOkSince > 0);
  w = mk({ ents: IN(7, 'Stranger'), okSince: Date.now() - 21000 });
  w.rageEntryTick('spookytown');
  t.eq('sustained past holdMs, the leader enters', w.rageEntryActive, true);
  t.eq('and containment comes off, which IS entering', w.rageCfg().enabled, false);
  t.eq('the decision is broadcast to the other two', sent.length >= 2, true);
  t.eq('never to the merchant', sent.some(x => x[0] === 'Meltymerch'), false);

  /* --- FOR THE WAVES, FROM WAVE 1 ---------------------------------------- */
  /* Operator, 2026-10-24: entry is for the zombie and ghoul kills, which are
     Halloween-only achievements, not for the Gargoyle. Until then the wave
     phase never qualified, because entry waited for `gargoyle: true`. */
  w = mk({ ents: IN(7, 'Stranger'), okSince: Date.now() - 21000, S: { graveyard: { live: true, wave: 1 } } });
  w.rageEntryTick('spookytown');
  t.eq('PRECONDITION: no gargoyle on the event entry', !!w.parent.S.graveyard.gargoyle, false);
  t.eq('the waves alone let the leader in', w.rageEntryActive, true);
  t.eq('and the followers are told IN', sent.length > 0 && sent[sent.length - 1][1].on, true);
  w = mk({ ents: IN(7, 'Stranger'), okSince: Date.now() - 21000, S: {} });
  w.rageEntryTick('spookytown');
  t.eq('with no graveyard live the box stays shut', w.rageEntryActive, false);
  t.eq('and the clock is reset rather than banked', w.rageEntryOkSince, 0);
  t.eq('and still tells the followers OUT', sent[sent.length - 1][1].on, false);

  /* --- THE MEASURED CROWD OPENS IT --------------------------------------- */
  /* 2026-10-24 10:30 EDT, six other players, sampled every 2s from the
     corridor. Under the old rule (>= 6 held for 20s) this never opened. */
  const SERIES = [6, 5, 7, 3, 5, 3, 5, 8, 6, 4, 8, 6, 5, 6, 6, 6, 2, 3, 5, 9];
  let run = 0, longest = 0;
  for (const v of SERIES) { run = v >= 6 ? run + 1 : 0; longest = Math.max(longest, run); }
  t.ok('PRECONDITION: no run of >= 6 lasts 20s (ten samples)', longest < 10);
  const past = SERIES.slice(0, -1).map((v, i) => [Date.now() - (SERIES.length - 1 - i) * 1000, v]);
  w = mk({ cfg: { minSoaked: 5 }, ents: IN(9, 'Stranger'), okSince: Date.now() - 21000, window: past });
  w.rageEntryTick('spookytown');
  t.eq('the measured series averages 5.4 and the leader goes in', w.rageEntryActive, true);
  t.eq('the window keeps only holdMs of samples', w.rageEntryWindow.length <= SERIES.length, true);
  w = mk({ cfg: { minSoaked: 5 }, ents: IN(9, 'Stranger'), okSince: Date.now() - 5000, window: past });
  w.rageEntryTick('spookytown');
  t.eq('but not before the leader has watched for holdMs', w.rageEntryActive, false);
  const thin = SERIES.map((v, i) => [Date.now() - (SERIES.length - i) * 1000, Math.min(v, 3)]);
  w = mk({ cfg: { minSoaked: 5 }, ents: IN(9, 'Stranger'), active: true, okSince: Date.now() - 60000, window: thin });
  w.rageEntryTick('spookytown');
  t.eq('a crowd that has averaged thin brings an entered leader out, one good tick or not', w.rageEntryActive, false);
  for (const f of ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js']) {
    const rs = require('fs').readFileSync(require('path').join(require('./lift').ROOT, f), 'utf8');
    t.ok(f + ': minSoaked ships at 5, as an average', /minSoaked: 5, +\/\/ AVERAGE/.test(rs));
  }
  w = mk({ ents: IN(7, 'Stranger'), okSince: Date.now() - 21000, trip: { name: 'mrgreen' } });
  w.rageEntryTick('spookytown');
  t.eq('on any other trip the box stays shut, crowd or not', w.rageEntryActive, false);
  w = mk({ ents: IN(7, 'Stranger'), okSince: Date.now() - 21000, active: true, S: {} });
  w.rageEntryTick('spookytown');
  t.eq('the graveyard ending puts an entered leader straight back out', w.rageEntryActive, false);
  /* INVERTED: a live graveyard is necessary, not sufficient - no crowd, no
     entry. */
  w = mk({ ents: IN(5, 'Stranger'), okSince: Date.now() - 60000 });
  w.rageEntryTick('spookytown');
  t.eq('a live graveyard with a thin crowd is still a no', w.rageEntryActive, false);

  /* The AVERAGE falling below the threshold ends it - still biased toward
     staying out, because missing a graveyard costs ~nothing and a wipe in the
     box does. */
  w = mk({ ents: IN(5, 'Stranger'), active: true, okSince: Date.now() - 60000 });
  w.rageEntryTick('spookytown');
  t.eq('the crowd thinning puts us straight back out', w.rageEntryActive, false);

  /* --- HYSTERESIS AND A DWELL - Ranger v139 / Priest v74 / Mage v97 -------
     Measured 12:30 EDT 2026-10-24 on US II: one threshold at 5 flapped - in
     for 2s, 16s, 24s, 4s, then 106s - while the raw count swung 0-17. The
     samples taken while inside read 4,4,1,9,7,6,2,6; the replay adds a
     current count of 2, which puts the average between the two lines. */
  const HYS = { minSoaked: 5, leaveSoaked: 3.5, minInsideMs: 30000 };
  const INSIDE = [4, 4, 1, 9, 7, 6, 2, 6];
  const inWin = INSIDE.map((v, i) => [Date.now() - (INSIDE.length - i) * 2000, v]);
  const inMean = (INSIDE.reduce((a, b) => a + b, 0) + 2) / (INSIDE.length + 1);   // the tick adds the current count, 2
  t.ok('PRECONDITION: the measured inside series averages under the entry line', inMean < 5);
  t.ok('PRECONDITION: and over the leave line', inMean >= 3.5);
  w = mk({ cfg: HYS, ents: IN(2, 'Stranger'), active: true, inSince: Date.now() - 60000, okSince: Date.now() - 60000, window: inWin });
  w.rageEntryTick('spookytown');
  t.eq('the measured flap: in between the two lines the party stays in', w.rageEntryActive, true);
  w = mk({ cfg: { minSoaked: 5 }, ents: IN(2, 'Stranger'), active: true, inSince: Date.now() - 60000, okSince: Date.now() - 60000, window: inWin });
  w.rageEntryTick('spookytown');
  t.eq('...where one threshold would have walked it out', w.rageEntryActive, false);
  const lowWin = [2, 1, 3, 2, 0, 3].map((v, i) => [Date.now() - (6 - i) * 2000, v]);
  w = mk({ cfg: HYS, ents: IN(2, 'Stranger'), active: true, inSince: Date.now() - 60000, okSince: Date.now() - 60000, window: lowWin });
  w.rageEntryTick('spookytown');
  t.eq('under the leave line, past the dwell: out', w.rageEntryActive, false);
  w = mk({ cfg: HYS, ents: IN(2, 'Stranger'), active: true, inSince: Date.now() - 10000, okSince: Date.now() - 60000, window: lowWin });
  w.rageEntryTick('spookytown');
  t.eq('under the leave line inside the dwell: still in', w.rageEntryActive, true);
  const onMeHys = Object.assign({}, IN(8, 'Stranger'), IN(3, 'FatherToken'));
  w = mk({ cfg: HYS, ents: onMeHys, active: true, inSince: Date.now() - 5000, okSince: Date.now() - 60000, window: inWin });
  w.rageEntryTick('spookytown');
  t.eq('three on me is out at once - the retreat ignores the dwell', w.rageEntryActive, false);
  w = mk({ cfg: HYS, ents: IN(2, 'Stranger'), okSince: Date.now() - 60000, window: inWin });
  w.rageEntryTick('spookytown');
  t.eq('OUTSIDE, the same in-between crowd does not open it - entry is still 5', w.rageEntryActive, false);
  w = mk({ cfg: HYS, ents: IN(9, 'Stranger'), okSince: Date.now() - 21000 });
  w.rageEntryTick('spookytown');
  t.ok('entering stamps the dwell clock', w.rageEntryInSince > 0);
  for (const f of ['Party/Ranger.js', 'Party/Priest.js', 'Party/Mage.js']) {
    const rs = require('fs').readFileSync(require('path').join(require('./lift').ROOT, f), 'utf8');
    t.ok(f + ': leaveSoaked 3.5 and minInsideMs 30000 ship', /leaveSoaked: 3\.5,[^\n]*\n\t\tminInsideMs: 30000,/.test(rs));
  }

  /* --- followers obey, and fall out on silence --------------------------- */
  w = mk({ me: 'Dexon', ents: IN(20, 'Stranger') });
  w.rageEntryTick('spookytown');
  t.eq('precondition: a follower sees a crowd that would convince the leader',
    w.rageCrowdSoak('spookytown').soaked, 20);
  t.eq('but never decides for itself', w.rageEntryActive, false);
  w = mk({ me: 'Dexon', heard: { on: true, at: Date.now() }, ents: {} });
  w.rageEntryTick('spookytown');
  t.eq('it enters on the leader’s word, with no crowd of its own', w.rageEntryActive, true);
  w = mk({ me: 'Dexon', active: true, heard: { on: true, at: Date.now() - 16000 }, ents: {} });
  w.rageEntryTick('spookytown');
  t.eq('and falls out when the word goes stale', w.rageEntryActive, false);
  /* Only the leader's word counts, by the rule bossOnCall already applies. */
  w = mk({ me: 'Dexon' });
  w.rageEntryOnCall('MageofOz', { on: true });
  t.eq('a non-leader is ignored', w.rageEntryHeard, null);
  w.rageEntryOnCall('FatherToken', { on: true });
  t.ok('the leader is heard', !!w.rageEntryHeard && w.rageEntryHeard.on);

  /* --- the retreat isEVERY character's own ----------------------------------- */
  const onMe = (n, me) => {
    const o = {};
    for (let i = 0; i < n; i++) o['a' + i] =
      { type: 'monster', mtype: 'mummy', x: 255, y: -1400, target: me };
    return o;
  };
  w = mk({ me: 'Dexon', active: true, heard: { on: true, at: Date.now() }, ents: onMe(3, 'Dexon') });
  t.eq('precondition: three are on this follower', w.rageAttackersOnMe(), 3);
  w.rageEntryTick('spookytown');
  t.eq('it retreats WITHOUT waiting for the leader to notice', w.rageEntryActive, false);
  t.eq('and containment is back on for it', w.rageCfg().enabled, true);
  /* INVERTED: below the threshold the leader's word still governs, so the
     retreat is a threshold and not a blanket refusal. */
  w = mk({ me: 'Dexon', active: true, heard: { on: true, at: Date.now() }, ents: onMe(2, 'Dexon') });
  w.rageEntryTick('spookytown');
  t.eq('two on it is not a retreat', w.rageEntryActive, true);
} },

{ name: 'the rage pull reads the BOSS context, not the farm it is not serving', fn(t) {
  /* MEASURED 2026-10-22, the graveyard's first live window. Routing worked -
     bossPick() became graveyard and two seconds after the open Dexon was on
     BOSS_JOIN_SPOTS at (255,-1030) - and the party produced zombie +0,
     ghoul +0, gargoyle +0 while the gargoyle on their own shard lived seven
     minutes and died at 0.01%. Present on shard, zero credit.
     Read off the priest mid-window: destination was the FARM target (crabx on
     `main`), rageAlso was [], so ragePullTypes() answered ["crabx"] and
     ragePullActive() early-returned on destination.map !== character.map.
     Every target sat inside the mummy rectangle, safeMove refuses every
     coordinate in it, and the only engagement route from the join spot is the
     pull - which was idle. */
  const G = JSON.parse(JSON.stringify(G_BASE));
  G.maps.spookytown = {
    doors: [[1]],
    monsters: [{ type: 'mummy', rage: MUMMY_RAGE, boundary: MUMMY_BOUNDARY }],
  };
  G.maps.main.monsters = [{ type: 'booboo', rage: [0, 0, 100, 100] }];
  G.monsters.zombie = { cooperative: true };
  G.monsters.ghoul = { cooperative: true };

  const mk = (over) => {
    over = over || {};
    const w = world({
      character: { name: 'Dexon', map: over.map || 'spookytown', x: 255, y: -1030,
        real_x: 255, real_y: -1030, s: {} },
      CONFIG: { achievements: { pull: {} }, party: { groupMembers: ['Dexon'] },
        bossEvents: { leaderName: 'Dexon', rageEntry: {} } },
      parent: { G: G, S: over.S || {}, entities: over.ents || {} },
      rageLog: () => {},
      bossNote: () => {},
      ragePullShared: null,
      rageEntryActive: false,
      rageActiveMemo: { at: 0, key: '', val: false },
      home: over.home === undefined ? 'crabx' : over.home,
      rageAlso: over.also || [],
      destination: over.dest === undefined ? { map: 'main', x: -984, y: 1762 } : over.dest,
      bossState: { trip: over.trip || null },
    });
    lift(w, RANGER, ['rageCfg', 'rageBoxes', 'rageHit', 'BOSS_FIGHT_TYPES',
      'bossMonsterTypes', 'BOSS_JOIN_SPOTS', 'bossWalkTarget', 'ragePullCtx',
      'ragePullTypes', 'rageBoxedTarget', 'ragePullActive', 'rageHoldFire']);
    w.EVENT_LOCATIONS = [];
    return w;
  };
  const IN_BOX = { z1: { type: 'monster', mtype: 'zombie', x: 255, y: -1400, dead: false } };

  /* --- the measured state, reproduced ----------------------------------- */
  let w = mk({});
  t.eq('precondition: with no trip the context is the FARM', w.ragePullCtx().src, 'farm');
  t.eq('and its types are the farm home, exactly as measured',
    w.ragePullTypes().join(','), 'crabx');
  t.eq('so on spookytown the pull is idle - the measured failure',
    w.ragePullActive(), false);

  /* --- with the trip, the context is the boss's -------------------------- */
  w = mk({ trip: { name: 'graveyard' }, ents: IN_BOX });
  const ctx = w.ragePullCtx();
  t.eq('a live graveyard trip switches the context', ctx.src, 'boss');
  t.eq('its park point is the join spot, not the farm target',
    ctx.x + ',' + ctx.y, '255,-1030');
  t.eq('and its types are the waves', w.ragePullTypes().join(','), 'zombie,ghoul');
  t.eq('so the pull is ACTIVE - which is the fix', w.ragePullActive(), true);

  /* THE TYPE TEST ALONE COULD NEVER HAVE DONE IT: spookytown's only box is the
     mummy's, and zombie/ghoul are event spawns with no rectangle of their own.
     Asserted so nobody "simplifies" the positional half away. */
  t.eq('precondition: no box on the map has a type we want',
    w.rageBoxes('spookytown').some((b) => w.ragePullTypes().indexOf(b.type) >= 0), false);
  t.eq('it is the POSITIONAL half that activates it',
    w.rageBoxedTarget('spookytown', ['zombie', 'ghoul']), true);
  /* And with the field empty it goes quiet again rather than spinning. */
  t.eq('no wanted type inside a box: idle', mk({ trip: { name: 'graveyard' } }).ragePullActive(), false);

  /* --- THE REGRESSION THE WIDENING EXISTS TO AVOID ----------------------- */
  /* rageHoldFire()'s first job is to stop the party fighting on the way IN. A
     purely positional test answers "inactive" on an approach with nothing yet
     inside a rectangle, hold-fire switches off, and the party stops to fight
     exactly where the old comment says it must not. So the box-TYPE test stays
     as the first disjunct and every case that was active stays active. */
  const farm = mk({ map: 'main', home: 'booboo', dest: { map: 'main', x: 50, y: 50 } });
  t.eq('precondition: nothing is inside the booboo box',
    farm.rageBoxedTarget('main', ['booboo']), false);
  t.eq('the farm case is STILL active on the box type alone',
    farm.ragePullActive(), true);

  /* --- hold fire reads the context's park point -------------------------- */
  w = mk({ trip: { name: 'graveyard' }, ents: IN_BOX });
  t.eq('a boxed wanted type is held',
    w.rageHoldFire({ mtype: 'zombie', x: 255, y: -1400 }), true);
  /* The old code measured distance to the FARM target - two maps away, so
     always past parkWithin, so hold-fire was unconditionally true for any
     wanted type. Now it measures to the join spot we are standing on. */
  t.eq('and one already OUT of the box is not',
    w.rageHoldFire({ mtype: 'zombie', x: 255, y: -1000 }), false);

  /* --- the memo must not mask a context change --------------------------- */
  const m = mk({ trip: { name: 'graveyard' }, ents: IN_BOX });
  t.eq('precondition: active', m.ragePullActive(), true);
  m.bossState.trip = null;
  t.eq('dropping the trip is seen at once, memo or not', m.ragePullActive(), false);
} },

{ name: 'taxi joins: which refusals actually put the fight out of reach', fn(t) {
	let w = ranger();
	t.eq('crabxx walks to main', w.bossTaxiWalkable('crabxx'), true);
	t.eq('franky walks to level2w', w.bossTaxiWalkable('franky'), true);
	t.eq('icegolem walks to winterland', w.bossTaxiWalkable('icegolem'), true);
	t.eq('goobrawl does NOT - its map has doors: []', w.bossTaxiWalkable('goobrawl'), false);
	t.eq('abtesting does NOT - it is not a transport at all', w.bossTaxiWalkable('abtesting'), false);

	/* The predicate is derived, not listed, so the game can change the
	   answer. This is the check that proves it is derived. */
	const noDoors = JSON.parse(JSON.stringify(G_BASE));
	noDoors.maps.main.doors = [];
	w = ranger({ parent: { G: noDoors, S: {} } });
	t.eq('a destination that LOSES its doors stops being a taxi join', w.bossTaxiWalkable('crabxx'), false);

	w = ranger();
	t.eq('isTaxiJoin(crabxx)', w.bossHop.isTaxiJoin('crabxx'), true);
	t.eq('isTaxiJoin(goobrawl)', w.bossHop.isTaxiJoin('goobrawl'), false);
	t.eq('isTaxiJoin(dragold) - not a join event at all', w.bossHop.isTaxiJoin('dragold'), false);
	t.eq('isJoinEvent(goobrawl) is still true - a different question', w.bossHop.isJoinEvent('goobrawl'), true);

	/* --- horseman, added 2026-10-22 ---------------------------------------- */
	/* The row was missing from BOSS_JOIN_SPOTS while horseman had a bossRank
	   entry, an EVENT window and a bridge collector - so it was reached by the
	   LOCAL path (bossEligible gates on none of this) and mistreated by every
	   gate that asks whether the join is the only way in. */
	w = ranger();
	const hm = w.BOSS_JOIN_SPOTS.horseman;
	t.ok('horseman has a join spot', !!hm);
	t.eq('on halloween', hm && hm.map, 'halloween');
	t.eq('at the server handler\'s own coordinates', hm && hm.x + ',' + hm.y, '-405,-1560');
	t.eq('halloween has doors, so the refusal costs the lift and not the fight',
		w.bossTaxiWalkable('horseman'), true);
	t.eq('isTaxiJoin(horseman)', w.bossHop.isTaxiJoin('horseman'), true);

	/* DERIVED, not listed - the same proof the crabxx case gets. */
	const hmNoDoors = JSON.parse(JSON.stringify(G_BASE));
	hmNoDoors.maps.halloween.doors = [];
	t.eq('a halloween that lost its doors stops being a taxi join',
		ranger({ parent: { G: hmNoDoors, S: {} } }).bossTaxiWalkable('horseman'), false);

	/* INVERTED, AND IT IS THE LOAD-BEARING HALF: the predicate three gates
	   share is `isJoinEvent && !isTaxiJoin`, which is the goobrawl treatment -
	   refused outright while hop-sick, and charged the full sickness wait in
	   the window test. The row is the only thing holding it off horseman. */
	const only = (b, n) => b.isJoinEvent(n) && !b.isTaxiJoin(n);
	t.eq('precondition: horseman carries join: true, so a gate DOES look at it',
		w.bossHop.isJoinEvent('horseman'), true);
	t.eq('with the row, horseman is not treated as join-only', only(w.bossHop, 'horseman'), false);
	t.eq('goobrawl still is', only(w.bossHop, 'goobrawl'), true);
	const gone = ranger();
	delete gone.BOSS_JOIN_SPOTS.horseman;
	t.eq('delete the row and horseman becomes join-only', only(gone.bossHop, 'horseman'), true);

	/* And what that costs, measured through the gate itself rather than the
	   predicate: a live horseman standing in front of a hop-sick character. */
	const hcfg = CFG(); hcfg.bossHop.targets = [{ mtype: 'horseman', kills_to_rung: 9 }];
	const sick = { s: { hopsickness: { ms: 600000 } } };
	t.eq('HOP-SICK with horseman live HERE: taken, because halloween is walkable',
		ranger({ CONFIG: hcfg, character: sick, live: ['horseman'] }).bossHop.localTarget(), 'horseman');
	const sickGone = ranger({ CONFIG: hcfg, character: sick, live: ['horseman'] });
	delete sickGone.BOSS_JOIN_SPOTS.horseman;
	t.eq('without the row the party is walked away from it',
		sickGone.bossHop.localTarget(), null);
} },

{ name: 'hop sickness: what remains, not the full duration', fn(t) {
	t.eq('not sick', ranger().bossHop.hopsickRemainingMs(), 0);
	t.eq('reads the live ms off the condition',
		ranger({ character: { s: { hopsickness: { ms: 451765 } } } }).bossHop.hopsickRemainingMs(), 451765);
	t.eq('no ms field falls back to G duration - the conservative direction',
		ranger({ character: { s: { hopsickness: {} } } }).bossHop.hopsickRemainingMs(), 720000);
} },

{ name: 'localTarget: a sick taxi join is walked to, not abandoned', fn(t) {
	t.eq('HOP-SICK with crabxx live HERE: taken',
		ranger({ character: { s: { hopsickness: { ms: 600000 } } }, live: ['crabxx'] }).bossHop.localTarget(), 'crabxx');
	t.eq('not sick, crabxx live here: taken (unchanged)',
		ranger({ character: { s: {} }, live: ['crabxx'] }).bossHop.localTarget(), 'crabxx');

	const cfg = CFG(); cfg.bossHop.targets = [{ mtype: 'goobrawl', kills_to_rung: 5 }];
	t.eq('HOP-SICK with goobrawl live here: still skipped, no walkable entrance',
		ranger({ CONFIG: cfg, character: { s: { hopsickness: { ms: 600000 } } }, live: ['goobrawl'] }).bossHop.localTarget(), null);
	t.eq('not sick, goobrawl live here: taken via the join',
		ranger({ CONFIG: cfg, character: { s: {} }, live: ['goobrawl'] }).bossHop.localTarget(), 'goobrawl');
} },

{ name: 'pickTarget: the window test charges no sickness wait for a taxi join', fn(t) {
	const stub = (w, cand, win) => {
		w.bossHop.candidates = () => [cand];
		w.bossHop.contributors = () => 40;
		w.bossHop.requiredDwellSec = () => 2;
		w.bossHop.maxHpOf = () => cand.maxHp;
		w.bossHop.eventWindowMs = () => win;
		return w.bossHop;
	};
	const crab = { shard: 'EUI', mtype: 'crabxx', hp: 960000, maxHp: 960000, live: true, secsToDeath: 1500, kills_to_rung: 70 };
	const goo = { shard: 'EUI', mtype: 'goobrawl', hp: 1000000, maxHp: 1000000, live: true, secsToDeath: 400, kills_to_rung: 5 };

	let b = stub(ranger({ character: { s: { hopsickness: { ms: 700000 } } } }), crab, 2400000);
	t.eq('sick, crabxx 1500s left: eligible', (b.pickTarget() || {}).mtype, 'crabxx');

	b = stub(ranger({ character: { s: { hopsickness: { ms: 700000 } } } }), goo, 540000);
	t.eq('sick, goobrawl in a 540s window: refused, 700s will not fit', b.pickTarget(), null);

	b = stub(ranger({ character: { s: {} } }), goo, 540000);
	t.eq('not sick, goobrawl: eligible', (b.pickTarget() || {}).mtype, 'goobrawl');

	/* The remaining-ms fix, observable from outside: same boss, same window,
	   only the clock differs. */
	b = stub(ranger({ character: { s: { hopsickness: { ms: 60000 } } } }), goo, 540000);
	t.eq('only 60s of sickness LEFT: goobrawl now fits', (b.pickTarget() || {}).mtype, 'goobrawl');
} },

{ name: 'the walk-in-sick probe survives the reload a hop causes', fn(t) {
	const w = ranger();
	w.taxiProbeNote('crabxx', { walkedAt: 1000, sickMsAtWalk: 600000 });
	t.eq('a walk opens one row', w.taxiProbeRead().length, 1);
	w.taxiProbeNote('crabxx', { note: 'again' });
	t.eq('a second note updates it rather than opening another', w.taxiProbeRead().length, 1);

	w.character.s = { hopsickness: { ms: 120000 } };
	w.taxiProbeClose('crabxx', 95000);
	const r = w.taxiProbeRead()[0];
	t.eq('closed', r.closed, true);
	t.eq('present at death - what credit actually requires', r.presentAtDeath, true);
	t.eq('dwell in seconds', r.dwellSec, 95);
	t.eq('STILL SICK at the kill - the row that proves the mechanism', r.sickThroughout, true);

	w.taxiProbeNote('crabxx', { walkedAt: 2000 });
	t.eq('a later walk opens a NEW row, the closed one is not reused', w.taxiProbeRead().length, 2);
	w.character.s = {};
	w.taxiProbeClose('crabxx', 10000);
	t.eq('sickness cleared before the kill is recorded as such', w.taxiProbeRead()[1].sickThroughout, false);

	const w2 = ranger();
	w2.taxiProbeClose('franky', 50000);
	t.eq('an ordinary teleported fight records nothing', w2.taxiProbeRead().length, 0);

	const w3 = ranger();
	w3.set = () => { throw new Error('storage down'); };
	let threw = false;
	try { w3.taxiProbeNote('crabxx', { walkedAt: 1 }); } catch (e) { threw = true; }
	t.eq('a storage failure degrades rather than throwing into the caller', threw, false);
} },

{ name: 'goHomeIfIdle no longer abandons a boss live where we stand', async fn(t) {
	let w = ranger({ live: ['crabxx'] });
	let hopped = false;
	w.bossHop.localTarget = () => 'crabxx';
	w.bossHop.changeServer = async () => { hopped = true; return true; };
	w.bossHop.lootBeforeHop = async () => false;
	w.bossHop.idleSince = Date.now() - 600000;
	const r = await w.bossHop.goHomeIfIdle('USIV');
	t.eq('a live local boss stops the trip home', [r, hopped], ['continue', false]);
	t.eq('and the idle clock resets', w.bossHop.idleSince, 0);

	w = ranger();
	hopped = false;
	w.bossHop.localTarget = () => null;
	w.bossHop.changeServer = async () => { hopped = true; return true; };
	w.bossHop.lootBeforeHop = async () => false;
	w.bossHop.idleSince = Date.now() - 600000;
	await w.bossHop.goHomeIfIdle('USIV');
	t.eq('nothing local: still goes home as before', hopped, true);
} },

{ name: "the operator's rank orders the eligible set, and only orders it", fn(t) {
	const w = ranger();
	t.eq('dragold 1', w.bossRank('dragold'), 1);
	t.eq('franky 2', w.bossRank('franky'), 2);
	t.eq('goobrawl ALONE at 3, the operator\'s 2026-10-25 ruling', w.bossRank('goobrawl'), 3);
	t.eq('crabxx and wabbit 4, below it', ['crabxx', 'wabbit'].map(w.bossRank), [4, 4]);
	t.eq('horseman 5 (inserted at 4 on 2026-10-21)', w.bossRank('horseman'), 5);
	t.eq('mrgreen 6', w.bossRank('mrgreen'), 6);
	t.eq('grinch and mrpumpkin 7', ['grinch', 'mrpumpkin'].map(w.bossRank), [7, 7]);
	t.eq('anything unranked is 8, the operator\'s "all others"', w.bossRank('phoenix'), 8);
	t.eq('and so is a name the game does not have', w.bossRank('nonsense'), 8);

	/* THE INSERTION IS ORDER-PRESERVING, WHICH IS THE OPERATOR'S ACTUAL
	   REASONING AND NOT A SIDE EFFECT. Horseman went in at 4 rather than tying
	   with mrgreen, and the property that buys is that EVERY pairwise
	   relationship holding before the insertion still holds after it. Asserted
	   against the pre-insertion table rather than against the new numbers,
	   because re-listing the new numbers would pass for any renumbering at all
	   - including one that quietly reordered two bosses. */
	const BEFORE = { dragold: 1, franky: 2, crabxx: 3, wabbit: 3, goobrawl: 3,
	                 mrgreen: 4, snowman: 5, grinch: 5, mrpumpkin: 5 };
	const names = Object.keys(BEFORE);
	const broken = [];
	for (const a of names) for (const b of names) {
		const was = Math.sign(BEFORE[a] - BEFORE[b]);
		const now = Math.sign(w.bossRank(a) - w.bossRank(b));
		if (was !== now) broken.push(a + ' vs ' + b);
	}
	/* 2026-10-25 REORDERED ON PURPOSE, and exactly these pairs: goobrawl stopped
	   tying crabxx and wabbit and went above them. Listed, so any OTHER reorder
	   still fails here. */
	t.eq('the only pre-insertion pairs that changed order are the 2026-10-25 ruling\'s',
		broken.sort().join(','), ['crabxx vs goobrawl', 'goobrawl vs crabxx', 'goobrawl vs wabbit', 'wabbit vs goobrawl'].sort().join(','));
	/* AND THIS CHECK CANNOT TELL AN INSERTION FROM A TIE - state the scope or
	   the next reader over-trusts it. A tie at 4 (horseman AND mrgreen both 4,
	   the group below shifted to 5) preserves every pre-insertion pair too,
	   because the pairs it compares never include horseman. Measured by
	   mutation: that tie fails the explicit `mrgreen 5` and `grinch 6`
	   assertions above and does NOT fail this loop. So the loop proves nothing
	   was REORDERED, and the literal values are what prove horseman was
	   INSERTED rather than tied - two assertions doing two jobs. */
	/* AND THE CHECK MUST BE ABLE TO SEE A REORDER, or it passes on a broken
	   comparator - the degenerate-setup trap this repo already records. Same
	   loop, against a table that really did swap two. */
	const SWAPPED = Object.assign({}, BEFORE, { mrgreen: 2, franky: 4 });
	const seen = [];
	for (const a of names) for (const b of names) {
		if (Math.sign(BEFORE[a] - BEFORE[b]) !== Math.sign(SWAPPED[a] - SWAPPED[b])) seen.push(a);
	}
	t.ok('the comparison detects a reorder when there is one', seen.length > 0);

	/* THE DEFAULT MUST NOT TIE WITH ANY ASSIGNED RANK. At 6 it would have tied
	   with snowman/grinch/mrpumpkin after the shift, and a tie falls through to
	   `need` and then `kills_to_rung` - ordering by achievement distance, which
	   is the exact failure this table was built to replace. Derived from the
	   table rather than asserted as the literal 7, so the next insertion cannot
	   leave it behind. */
	const assigned = Object.values(w.BOSS_RANK);
	t.ok('the default sits strictly above every assigned rank',
		w.BOSS_RANK_DEFAULT > Math.max.apply(null, assigned));
	t.eq('so no assigned rank ties with it',
		assigned.filter((r) => r === w.BOSS_RANK_DEFAULT).length, 0);

	/* SEASONAL ENTRIES STAY YEAR-ROUND, and the claim that makes that safe is
	   that NOTHING ITERATES the table - so an entry for a non-spawning boss is
	   unreachable rather than merely harmless. That is a property of the source,
	   not of the lookup, so it is checked there: a `for...in`, Object.keys /
	   values / entries over BOSS_RANK would all make the table's CONTENTS
	   observable and turn a stale seasonal entry into a live one. (This suite's
	   own Object.values above runs on the LIFTED copy, not in the script.) */
	const rs = require('fs').readFileSync(
		require('path').join(require('./lift').ROOT, 'Party/Ranger.js'), 'utf8');
	t.eq('nothing in Ranger.js enumerates BOSS_RANK',
		/(for\s*\([^)]*\bin\s+BOSS_RANK\b)|Object\.(keys|values|entries)\s*\(\s*BOSS_RANK\s*\)/.test(rs),
		false);
	t.ok('and bossRank is a plain keyed lookup with a default',
		/const r = BOSS_RANK\[name\];/.test(rs));
	/* Keyed by the parent.S name, which is the EVENT name where one exists -
	   bossLiveNames() yields goobrawl, never rgoo. That was ASPIRATIONAL until
	   v115: goobrawl publishes no `live` field, so the rank 3 entry was
	   unreachable from the day it was written. See the block below. */
	t.eq('goobrawl is keyed by its event name, not its monster', w.bossRank('rgoo'), w.BOSS_RANK_DEFAULT);
	t.eq('and horseman is its own name, event and monster alike',
		w.bossRank('horseman'), w.BOSS_RANK.horseman);
} },

{ name: 'liveness is not one field: goobrawl publishes only `end`', fn(t) {
	/* THE REAL SHAPES, read from upstream 16881a27. crabxx/franky/icegolem/
	   horseman come out of one forEach carrying `live`; graveyard_public()
	   returns live: true; goobrawl is `E.goobrawl = { end: timers.goobrawl }`
	   and the key is DELETED when the window closes, so presence is the only
	   signal it has. The non-boss keys are the ones a general presence rule
	   would swallow - S is the whole server_info payload, not a boss table. */
	/* THE NON-BOSS KEYS ARE THE MEASURED ONES, corrected 2026-10-22. The first
	   version of this fixture carried time_offset, night, dailies and nightlies
	   at the top level; all four are FIELDS INSIDE schedule and none is a key of
	   S, so the widening assertion below was exercising a payload that does not
	   exist. Measured on US II: schedule, event_flags, event_ends,
	   blessed_minutes, blessed_by, halloween, witchcipher, slenderman, mrgreen,
	   mrpumpkin. slenderman is included BECAUSE it carries the full boss shape -
	   it is the case that makes the named set look wrong and is refused
	   elsewhere. */
	const S_LIVE = () => ({
		goobrawl: { end: 1761130000 },
		schedule: { realm: 'USII', server_time: 1761120000, time_offset: -5, events: [], repeats: [] },
		event_flags: { halloween: true },
		event_ends: { halloween: 1762128000000 },
		blessed_minutes: 0,
		blessed_by: { name: 'someone' },
		halloween: { candy: 3 },
		slenderman: { live: true, map: 'spookytown', hp: 66666, max_hp: 66666 },
	});

	function pick(S, over = {}) {
		const w = ranger();
		w.bossState = Object.assign({ trip: null, forced: null, fromLeader: null }, over.bossState || {});
		w.bossIsLeader = () => over.leader !== false;
		w.bossEligible = () => ({ ok: true });
		w.parent.S = S;
		w.CONFIG.bossEvents = { leaderTrustMs: 60000 };
		lift(w, RANGER, ['BOSS_PRESENCE_LIVE', 'bossEntryLive', 'bossLiveNames', 'bossRank',
			'BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossPick']);
		if (over.drop) delete w.BOSS_PRESENCE_LIVE[over.drop];
		return w;
	}

	let w = pick(S_LIVE());
	/* PRECONDITION: the fixture really is the no-live shape, or the assertions
	   below would hold against a `live: true` entry and prove nothing. */
	t.eq('precondition: the goobrawl entry carries no live field',
		'live' in w.parent.S.goobrawl, false);
	t.eq('precondition: nor any hp', 'hp' in w.parent.S.goobrawl, false);

	t.eq('bossEntryLive says live on presence alone', w.bossEntryLive('goobrawl', w.parent.S.goobrawl), true);
	t.eq('and NOT for an unlisted name with the same shape',
		w.bossEntryLive('crabxx', { end: 1 }), false);
	t.eq('a live field still wins for anyone', w.bossEntryLive('crabxx', { live: true }), true);
	t.eq('and a missing entry is not live', w.bossEntryLive('goobrawl', undefined), false);

	t.eq('bossLiveNames yields goobrawl', w.bossLiveNames().indexOf('goobrawl') >= 0, true);
	t.eq('and the non-boss keys stay out',
		['schedule', 'event_flags', 'event_ends', 'blessed_minutes', 'blessed_by', 'halloween']
			.filter((k) => w.bossLiveNames().indexOf(k) >= 0), []);
	t.note('event_flags, blessed_by and halloween are objects with no live - a general presence rule reads all three as live bosses, which is why the set is named');

	/* slenderman DOES carry live: true, so it reaches bossLiveNames on its own
	   merits and always has - the presence set is not what admits it and not
	   what should exclude it. It is refused by CONFIG.bossEvents.exclude, whose
	   comment records why: he cannot be walked to (the server sends {name, map}
	   with no x/y) and approaching him warps him away. Asserted from the SOURCE
	   TEXT because that set is a non-liftable `new Set([...])`, and a fixture
	   copy would prove nothing about the committed file. */
	t.eq('slenderman is live by its own field', w.bossEntryLive('slenderman', w.parent.S.slenderman), true);
	t.eq('so bossLiveNames yields it too', w.bossLiveNames().indexOf('slenderman') >= 0, true);
	t.eq('it is NOT in the presence set - that is not what gates it',
		Object.prototype.hasOwnProperty.call(w.BOSS_PRESENCE_LIVE, 'slenderman'), false);
	t.eq('and not ranked either, so it would sort at the default',
		w.bossRank('slenderman'), w.BOSS_RANK_DEFAULT);
	const rangerSrc = require('fs').readFileSync(
		require('path').join(require('./lift').ROOT, RANGER), 'utf8');
	const exclLine = (rangerSrc.match(/exclude:\s*new Set\(\[[^\]]*\]\)/) || [''])[0];
	t.ok('the committed exclude set names slenderman', /'slenderman'/.test(exclLine));
	t.ok('and abtesting', /'abtesting'/.test(exclLine));
	t.eq('goobrawl still wins the ranked scan against it, rank 3 over the default',
		(w.bossPick() || {}).name, 'goobrawl');

	/* THE WHOLE CHAIN, from the one fact: bossPick feeds shouldHandleEvents(),
	   which is what authorises handleEvents() to move and to emit the join. */
	t.eq('so bossPick takes it', (w.bossPick() || {}).name, 'goobrawl');
	t.eq('by its own reading, not a relay', (w.bossPick() || {}).src, 'own');

	/* INVERTED, AND THIS IS THE MEASURED LOSS: with a bare d.live test the
	   event is invisible, bossPick returns null, shouldHandleEvents() stays
	   false and NOBODY emits the join - leader or follower. */
	const gone = pick(S_LIVE(), { drop: 'goobrawl' });
	t.eq('drop the row and goobrawl leaves bossLiveNames', gone.bossLiveNames().indexOf('goobrawl') >= 0, false);
	t.eq('and bossPick falls to the only other live entry rather than to goobrawl',
		(gone.bossPick() || {}).name, 'slenderman');
	t.note('slenderman is refused by the real bossEligible, which this harness stubs open - the point is only that goobrawl is gone');

	/* The other two gates in bossPick's preamble read the same helper. */
	const forced = pick(S_LIVE(), { bossState: { forced: { name: 'goobrawl', at: Date.now() } } });
	t.eq('an operator command reaches it', (forced.bossPick() || {}).src, 'command');
	const relayed = pick(S_LIVE(), {
		leader: false,
		bossState: { fromLeader: { name: 'goobrawl', at: Date.now() } },
	});
	t.eq('and so does the leader relay, which is the follower path',
		(relayed.bossPick() || {}).src, 'leader');

	/* MECHANISM, not behaviour: no bare d.live gate may survive in bossPick,
	   or one path answers differently from the other two - the "two state
	   machines over one decision" shape this file keeps paying for. */
	const { extract } = require('./lift');
	const pickSrc = extract(RANGER, 'bossPick');
	t.eq('bossPick holds no bare d.live test', /\bd\.live\b/.test(pickSrc), false);
	t.eq('it goes through the helper, three times',
		(pickSrc.match(/bossEntryLive\(/g) || []).length, 2);
	t.note('two in bossPick plus the one in bossLiveNames is the third gate');

	/* A goobrawl entry has no max_hp, and the ranked scan divides by it. */
	t.eq('a missing max_hp does not throw - ratio falls back to 1',
		(pick(S_LIVE()).bossPick() || {}).name, 'goobrawl');

	/* The set stays narrow, asserted so a later name cannot be added without
	   a reader confronting why presence is sound for it. */
	t.eq('exactly one name has presence liveness', Object.keys(w.BOSS_PRESENCE_LIVE), ['goobrawl']);
} },

{ name: 'localTarget ranks, and the ranking changes nothing today', fn(t) {
	/* Two targets live at once is the case the rank exists for. It cannot
	   actually arise for these two - no two event windows overlap - but the
	   ordering has to be right before a target is added that can. */
	let h = ranger({ live: ['crabxx', 'franky'] });
	t.eq('franky (2) beats crabxx (3) when both are live here', h.bossHop.localTarget(), 'franky');

	h = ranger({ live: ['crabxx'] });
	t.eq('one live target is still taken', h.bossHop.localTarget(), 'crabxx');

	/* The no-op claim, asserted rather than asserted-about: today's three
	   targets rank in the same order their kills_to_rung already produced. */
	const w = ranger();
	const byRank = [...w.CONFIG.bossHop.targets].sort((a, b) => w.bossRank(a.mtype) - w.bossRank(b.mtype));
	const byRung = [...w.CONFIG.bossHop.targets].sort((a, b) => a.kills_to_rung - b.kills_to_rung);
	t.eq('rank order == kills_to_rung order for the current targets',
		byRank.map((x) => x.mtype), byRung.map((x) => x.mtype));
	t.note('so this change is future-proofing for bossHop; the live effect is in bossPick');
} },

{ name: 'pickTarget sorts by rank before deadline', fn(t) {
	const h = ranger();
	h.bossHop.contributors = () => 40;
	h.bossHop.requiredDwellSec = () => 2;
	h.bossHop.maxHpOf = (m) => (m === 'crabxx' ? 960000 : 120000000);
	h.bossHop.eventWindowMs = () => 2400000;
	/* crabxx dies SOONER, franky ranks HIGHER. Before the change the earliest
	   deadline won; now the rank does. */
	h.bossHop.candidates = () => [
		{ shard: 'EUI', mtype: 'crabxx', hp: 960000, maxHp: 960000, live: true, secsToDeath: 300, kills_to_rung: 70 },
		{ shard: 'USII', mtype: 'franky', hp: 120000000, maxHp: 120000000, live: true, secsToDeath: 1500, kills_to_rung: 68 },
	];
	t.eq('franky (2) wins over a sooner-dying crabxx (3)', h.bossHop.pickTarget().mtype, 'franky');

	/* Within one rank the delegated tie-break applies: cheapest dwell first. */
	const h2 = ranger();
	h2.bossHop.contributors = () => 40;
	h2.bossHop.maxHpOf = () => 960000;
	h2.bossHop.eventWindowMs = () => 2400000;
	h2.bossHop.requiredDwellSec = (maxHp, k, sick, mtype) => (mtype === 'wabbit' ? 1 : 50);
	h2.bossHop.candidates = () => [
		{ shard: 'EUI', mtype: 'crabxx', hp: 960000, maxHp: 960000, live: true, secsToDeath: 200, kills_to_rung: 70 },
		{ shard: 'USII', mtype: 'wabbit', hp: 960000, maxHp: 960000, live: true, secsToDeath: 1500, kills_to_rung: 99 },
	];
	t.eq('equal rank: the cheaper dwell wins even though it dies later',
		h2.bossHop.pickTarget().mtype, 'wabbit');
} },

{ name: 'bossPick: rank leads, and the incumbent holds a tie', fn(t) {
	function picker(live, held) {
		const w = ranger();
		/* bossPick's own preamble - forced pick, then a leader's call - is
		   not what this suite is about, so both are empty and we are the
		   leader, which drops straight through to the ranked scan. */
		w.bossState = { trip: held ? { name: held } : null, forced: null, fromLeader: null };
		w.bossIsLeader = () => true;
		w.bossEligible = () => ({ ok: true });
		w.bossLiveNames = () => Object.keys(live);
		w.parent.S = live;
		w.CONFIG.bossEvents = { leaderTrustMs: 60000 };
		lift(w, RANGER, ['bossPick']);
		return w.bossPick();
	}
	const full = (hp) => ({ live: true, hp, max_hp: 100 });

	/* THE CASE THAT CHANGES. Before: lowest hp ratio won, so a nearly-dead
	   low-rank boss beat a fresh high-rank one. */
	t.eq('a fresh mrgreen (4) beats a half-dead greenjr (unranked 6)',
		picker({ mrgreen: full(100), greenjr: full(3) }).name, 'mrgreen');
	t.eq('franky (2) beats mrgreen (4) regardless of hp',
		picker({ franky: full(100), mrgreen: full(1) }).name, 'franky');

	/* Within a rank the old key still decides. */
	t.eq('equal rank falls back to lowest hp ratio',
		picker({ crabxx: full(80), wabbit: full(20) }).name, 'wabbit');

	/* Invariant: never abandon for an EQUAL rank. */
	t.eq('the incumbent holds against an equal-rank boss with less hp',
		picker({ crabxx: full(80), wabbit: full(20) }, 'crabxx').name, 'crabxx');
	t.eq('but a HIGHER rank still takes the trip',
		picker({ crabxx: full(80), franky: full(99) }, 'crabxx').name, 'franky');
	t.eq('and a lower rank never does',
		picker({ crabxx: full(99), mrgreen: full(1) }, 'crabxx').name, 'crabxx');

	t.eq('nothing live -> null', picker({}), null);
} },

{ name: 'the hop lock: one boss_hop per hop, not a burst of five', async fn(t) {
	/* The leader used to clear `hopping` on the line after change_server.
	   change_server does not block - it starts a navigation and returns - so
	   the next tick 100ms later found state HOPPING with the old shard still
	   reported, and sent another boss_hop. Measured live: 2-5 per episode,
	   ~105ms apart, which is TICK_RATE.main exactly. */
	const TICK = 100, TEARDOWN = 420;

	async function run(clearEagerly, navigates, ticks) {
		const sent = [];
		let now = 0, navigatedAt = null;
		const w = ranger();
		w.Date = { now: () => now };
		w.plSend = (to, d) => sent.push({ at: now, shard: d.shard });
		w.change_server = () => { if (navigates && navigatedAt === null) navigatedAt = now; };
		w.get_chests = () => ({});
		w.loot = async () => {};
		/* Re-lift with the frozen clock in place. */
		lift(w, RANGER, ['bossHop']);
		const b = w.bossHop;
		b.state = 'HOPPING'; b.targetShard = 'EUI'; b.targetType = 'mrgreen';
		b.localBossLive = () => false; b.localTarget = () => null;
		b.pickTarget = () => null; b.goHomeIfIdle = async () => 'continue';
		b.currentShard = () => 'USIV';
		if (clearEagerly) {
			const orig = b.changeServer.bind(b);
			b.changeServer = async (...a) => { const r = await orig(...a); b.hopping = false; return r; };
		}
		for (let i = 0; i < (ticks || 12); i++) {
			if (navigatedAt !== null && now >= navigatedAt + TEARDOWN) break;
			await b.tick();
			now += TICK;
		}
		return { sent, hopping: b.hopping };
	}

	const before = await run(true, true);
	t.eq('OLD behaviour reproduces the live burst: five messages', before.sent.length, 5);
	t.eq('all naming the same shard', [...new Set(before.sent.map((s) => s.shard))], ['EUI']);
	t.eq('spaced one main-loop tick apart', before.sent.slice(1).map((s, i) => s.at - before.sent[i].at), [100, 100, 100, 100]);

	const after = await run(false, true);
	t.eq('NEW: exactly one boss_hop', after.sent.length, 1);
	t.eq('and the lock is still held when the page dies', after.hopping, true);

	const stuck = await run(false, false, 12);
	t.eq('no burst even when the navigation never arrives', stuck.sent.length, 1);
	t.eq('lock still held inside the grace window', stuck.hopping, true);

	/* 200 ticks of a frozen clock is 20s, past HOP_RELOAD_GRACE_MS. */
	const released = await run(false, false, 200);
	t.eq('the watchdog releases at 15s and the hop retries once by 20s', released.sent.length, 2);
	t.that('the retry is 15s later, not a burst', released.sent[1].at - released.sent[0].at >= 15000,
		released.sent[1].at - released.sent[0].at);
} },

{ name: 'a boss the combat side gave up on no longer pins the party here', fn(t) {
	/* THE 2026-10-19 NIGHTLY WINDOW, which cost two franky credits and their keys.
	   tick() asks localTarget() FIRST and anything truthy commits FIGHTING and
	   returns, so pickTarget() is never reached. localTarget() consulted
	   localBossLive() and a feasibility test and NOTHING about whether the combat
	   side had already given up - so an abandoned-but-alive home boss pinned the
	   party to its shard while a sixteen-second franky sat two shards away. */
	const { extract, ROOT } = require('./lift');
	const fs = require('fs');
	const path = require('path');

	/* BOSS_TYPE_GIVEUP_MAX has a non-brace initialiser so lift() cannot
	   brace-match it, and bossEligible names it in its refusal message. */
	const w = world({ BOSS_TYPE_GIVEUP_MAX: 2, parent: { server_region: 'US', server_identifier: 'I' } });
	lift(w, RANGER, ['bossState', 'bossCooledDown', 'bossShard', 'bossCooldownKey', 'bossEligible']);
	w.CONFIG = { bossEvents: { enabled: true, exclude: new Set(), include: [], cooperativeOnly: false } };
	w.bossCooperative = () => true;

	const NOW = Date.now();
	t.eq('no cooldown entry -> not cooled down', w.bossCooledDown('franky'), false);
	w.bossState.cooldown.franky = NOW + 30 * 60 * 1000;
	t.eq('a live cooldown reads true', w.bossCooledDown('franky'), true);
	t.eq('and bossEligible agrees, through the same expression', w.bossEligible('franky').ok, false);
	w.bossState.cooldown.franky = NOW - 1;
	t.eq('an expired cooldown reads false', w.bossCooledDown('franky'), false);
	t.eq('and bossEligible lets it through again', w.bossEligible('franky').ok, true);
	w.bossState.cooldown.franky = 0;
	t.eq('a zeroed cooldown - the clear path - reads false', w.bossCooledDown('franky'), false);

	/* ONE EXPRESSION, NOT TWO. The cooldown was read in exactly one place and that
	   place was the local-pick path, which is how the hop path came to ignore a
	   give-up. A second inlined copy would reintroduce the drift. */
	const el = extract(RANGER, 'bossEligible');
	t.ok('bossEligible goes through the helper', el.indexOf('bossCooledDown(') > 0);
	t.eq('and does not re-inline the comparison',
		/cooldown\[[^\]]+\]\s*\|\|\s*0\)\s*>\s*Date\.now\(\)/.test(el), false);

	/* localTarget is a method on the bossHop object literal, so lift() cannot reach
	   it by name - asserted at source instead, against the mechanism. */
	const src = fs.readFileSync(path.join(ROOT, RANGER), 'utf8');
	const lt = src.slice(src.indexOf('\tlocalTarget() {'), src.indexOf('\tpickTarget() {'));
	t.ok('localTarget skips a cooled-down target',
		/if \(bossCooledDown\(t\.mtype\)\) continue;/.test(lt));
	t.ok('and before paying for the feasibility test',
		lt.indexOf('bossCooledDown(') < lt.indexOf('requiredDwellSec('));

	/* THIS ASSERTION WAS INVERTED IN v103, AND THE INVERSION IS THE POINT.
	   It read "pickTarget does NOT gate on the cooldown" and that was correct
	   while the key was type-wide: a type-wide entry here blocks the very hop
	   v99 exists to allow. Keyed (type, shard) the gate is right, and what has
	   to be asserted instead is that it asks about the CANDIDATE's shard -
	   gating with one argument would silently ask about OURS, which is never
	   the shard being considered and would make the check a no-op. */
	const pt = src.slice(src.indexOf('\tpickTarget() {'), src.indexOf('\tgoHomeIfIdle'));
	t.ok('pickTarget gates on the cooldown, by the CANDIDATE shard',
		/bossCooledDown\(x\.mtype, x\.shard\)/.test(pt));
	t.eq('and never with the default, which would ask about our own shard',
		/bossCooledDown\(x\.mtype\)/.test(pt), false);
	t.ok('localTarget still gates, and defaults to ours',
		/if \(bossCooledDown\(t\.mtype\)\) continue;/.test(lt));
	t.note('v99 asymmetry + type key, or v103 symmetry + shard key - either pairing works, neither half alone');
} },

{ name: 'applyTerminal: a boss that stopped existing stops being a candidate', fn(t) {
	/* SCAN_STALE_MS is a const with a non-brace initialiser, so lift() cannot
	   brace-match it; supplied to the world the same way HOP_ATTEMPT_CAP is. */
	function withScan(entries) {
		const w = ranger({ SCAN_STALE_MS: 5 * 60 * 1000 });
		w.bossHop.scanResults = entries;
		w.bossHop.currentShard = () => 'USI';
		w.bossHop.maxHpOf = () => 960000;
		return w;
	}
	const NOW = Date.now();
	const liveRow = () => ({
		shard: 'USII', mtype: 'crabxx', live: true,
		hp: 960000, maxHp: 960000, spawnTime: null, at: NOW - 60000,
	});

	/* 1. THE CASE THE DEFECT IS ABOUT. The entry is fresh enough that
	   SCAN_STALE_MS does not touch it, so before this change it stayed the
	   picker's best candidate - a frozen hp is an hp that never falls. */
	let w = withScan([liveRow()]);
	t.eq('a fresh live entry IS a candidate to begin with',
		w.bossHop.candidates().map((c) => c.mtype), ['crabxx']);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a death clears the live claim', w.bossHop.scanResults[0].live, false);
	t.eq('and the entry drops out of candidates() entirely',
		w.bossHop.candidates().length, 0);
	t.note('closes a 300s window (SCAN_STALE_MS) to about 75s - one 45s bridge poll plus one 30s fetch');

	/* 2. THE OLD-BRIDGE HAZARD. `terminal=1` is a query parameter; the
	   handler reads the params it knows and ignores an unknown one in
	   silence, so a bridge deployed before it answers with spawns mixed in.
	   If the ev check were not in applyTerminal this would pass degenerately
	   - the server filter would have removed the row before it arrived. */
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'spawn', type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a SPAWN never clears anything - the ev check is the authority',
		w.bossHop.scanResults[0].live, true);

	/* 3. ALL THREE terminal values, pinned so the set is the MEANING and not
	   an accident of which rows the log happened to hold. `lost` is in it
	   because neither of its two causes - an instance id that changed, or a
	   shard that stopped being listable - is a boss worth planning a trip
	   towards, so its ambiguity need not be resolved to classify it. */
	for (const ev of ['death', 'despawn', 'lost']) {
		const h = withScan([liveRow()]);
		h.bossHop.applyTerminal({ ev, type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
		t.eq('terminal: ' + ev, h.bossHop.scanResults[0].live, false);
	}
	t.note('measured 2026-10-20 over 2,499 retained events: death 1116, despawn 15, lost 120, spawn 1248');
	t.note('so ev=despawn alone would have covered 15 of 1,251 terminal events - 1.2%');

	/* 4. THE ORDERING GUARD, which is also what makes the cold start safe:
	   the first fetch has no cursor and replays the whole retained log, and
	   every historical row predates the push that created the entry. */
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: new Date(NOW - 600000).toISOString() });
	t.eq('an event OLDER than the push does not clear - server_info wins',
		w.bossHop.scanResults[0].live, true);
	t.note('server_info is the direct feed; the bridge is a derivative running up to 45s behind it');

	/* 5. SHARD NORMALISATION. The log writes "US II"; scanResults builds its
	   shard as region + name with no separator. An unnormalised compare
	   matches nothing, and matching nothing is indistinguishable from no boss
	   ever having died - so this asserts the match, not just the mismatch. */
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'USII', t: new Date(NOW).toISOString() });
	t.eq('an already-joined shard string still matches', w.bossHop.scanResults[0].live, false);
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'EU II', t: new Date(NOW).toISOString() });
	t.eq('a DIFFERENT shard is left alone', w.bossHop.scanResults[0].live, true);
	w = withScan([liveRow()]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'franky', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a different boss on the right shard is left alone', w.bossHop.scanResults[0].live, true);

	/* 6. A PENDING entry - live false with a spawnTime - is the pre-spawn
	   candidate the hop wants, and must not be collateral damage. */
	w = withScan([{ shard: 'USII', mtype: 'crabxx', live: false, hp: null,
		maxHp: 960000, spawnTime: NOW + 60000, at: NOW - 60000 }]);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II', t: new Date(NOW).toISOString() });
	t.eq('a pending respawn entry keeps its spawnTime',
		w.bossHop.scanResults[0].spawnTime, NOW + 60000);
	/* And is not STAMPED. The `live !== true` early-out is not a safety guard
	   - nothing downstream reads clearedBy - so asserting on behaviour here
	   would be degenerate: removing the check changes no outcome, because the
	   pre-spawn path reads spawnTime and this path never writes it. What the
	   check buys is that clearedBy means "a live claim was cleared HERE" and
	   not "a terminal event once went past", which is the difference between
	   a usable diagnostic and a misleading one. */
	t.eq('and is not stamped as cleared - clearedBy marks a cleared LIVE claim',
		w.bossHop.scanResults[0].clearedBy, undefined);

	/* 7. Garbage in from a bridge mid-upgrade must not throw: applyTerminal
	   runs inside a for loop in the fetch handler, so one bad row would cost
	   every row after it. */
	w = withScan([liveRow()]);
	for (const bad of [null, {}, { ev: 'death' }, { ev: 'death', type: 'crabxx' },
			{ ev: 'death', type: 'crabxx', server: 'US II' },
			{ ev: 'death', type: 'crabxx', server: 'US II', t: 'not a date' }]) {
		w.bossHop.applyTerminal(bad);
	}
	t.eq('no malformed row clears anything, and none throws',
		w.bossHop.scanResults[0].live, true);
} },

{ name: 'refreshTerminal: the cursor is the server clock and only moves on success', fn(t) {
	const { extract } = require('./lift');
	const rt = extract(RANGER, 'bossHop');
	const body = rt.slice(rt.indexOf('\trefreshTerminal() {'), rt.indexOf('\tapplyTerminal(e) {'));

	t.ok('asks for terminal rows only', /terminal=1/.test(body));
	t.ok('and carries the cursor as `since` when it has one',
		/since=' \+ encodeURIComponent\(this\.termCursor\)/.test(body));
	/* The cursor must be the ANSWER's clock. A local Date.now() even a few
	   seconds fast would skip rows the script never saw, and they are gone
	   for good - the query is strictly-after. */
	t.ok('advances the cursor to the answer\'s own now', /this\.termCursor = j\.now/.test(body));
	t.eq('and never to a local clock', /termCursor = Date\.now/.test(body), false);

	/* The failure arm must NOT advance it: holding it back re-reads a few
	   rows, which applyTerminal is idempotent about, while advancing past a
	   failed fetch drops those events permanently. */
	const arms = body.split('}, (e) => {');
	t.eq('the fetch has a rejection arm', arms.length, 2);
	t.eq('which does not touch the cursor', /termCursor/.test(arms[1]), false);
	t.ok('and records the error rather than swallowing it', /termErr = String\(e\)/.test(arms[1]));

	/* Both feeds have to run on the one timer, or the invalidation silently
	   stops happening the moment someone edits the other one. */
	const w = ranger();
	const scan = extract(RANGER, 'bossHop');
	const start = scan.slice(scan.indexOf('\tstartScanning() {'), scan.indexOf('\trecord(entry) {'));
	t.ok('refreshTerminal is wired into the same 30s interval as refreshBridge',
		/setInterval\(\(\) => \{ this\.refreshBridge\(\); this\.refreshTerminal\(\);[^}]*\}, 30000\)/.test(start));
	t.ok('and is called once up front', /\n\t\tthis\.refreshTerminal\(\);\n/.test(start));
	t.eq('state starts with no cursor, so the first fetch pulls the whole log',
		w.bossHop.termCursor, null);
} },

{ name: 'applyTerminal orders against the OBSERVATION, not the death estimate', fn(t) {
	const NOW = Date.now();
	function w1(at) {
		const w = ranger({ SCAN_STALE_MS: 5 * 60 * 1000 });
		w.bossHop.scanResults = [{ shard: 'USII', mtype: 'crabxx', live: true,
			hp: 960000, maxHp: 960000, spawnTime: null, at }];
		w.bossHop.currentShard = () => 'USI';
		w.bossHop.maxHpOf = () => 960000;
		return w;
	}
	const iso = (ms) => new Date(ms).toISOString();

	/* THE REGRESSION. A death row's `t` is a reconstruction - two of its three
	   forms are (last_alive_t + poll_t)/2 - while death_hi is iso(poll_t), the
	   poll that proved the boss gone. An event boss's server_info key vanishes
	   AT the death, so `at` lands there, which is AFTER the midpoint whenever
	   the true death fell in the later half of the bracket. v100 compared
	   against `t` and discarded those terminals; nothing arrives afterwards to
	   correct it, because the key is gone. */
	let w = w1(NOW - 60000);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: iso(NOW - 120000), death_hi: iso(NOW) });
	t.eq('a death whose MIDPOINT predates the push still clears, because death_hi does not',
		w.bossHop.scanResults[0].live, false);
	t.note('v100 returned early here; by METHOD, all 238 absent_on_responding_server rows carry the midpoint, 174 of them over 30s');

	/* The guard is not disabled, only re-anchored: an observation genuinely
	   older than the push is still a previous instance and still loses. */
	w = w1(NOW);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: iso(NOW - 600000), death_hi: iso(NOW - 300000) });
	t.eq('an observation older than the push does NOT clear', w.bossHop.scanResults[0].live, true);

	/* despawn and lost carry no death_hi, and their `t` IS the detection time,
	   so the fallback is the correct reading rather than a concession. Both
	   directions, or the fallback could be ignoring t entirely. */
	for (const ev of ['despawn', 'lost']) {
		let h = w1(NOW - 60000);
		h.bossHop.applyTerminal({ ev, type: 'crabxx', server: 'US II', t: iso(NOW) });
		t.eq(ev + ' with no death_hi clears on its own t', h.bossHop.scanResults[0].live, false);
		h = w1(NOW);
		h.bossHop.applyTerminal({ ev, type: 'crabxx', server: 'US II', t: iso(NOW - 600000) });
		t.eq(ev + ' older than the push still does not clear', h.bossHop.scanResults[0].live, true);
	}

	/* A malformed death_hi must fall back to t rather than drop a real
	   terminal - `Date.parse(e.death_hi || e.t)` would return NaN here and
	   bail, losing the row silently. */
	w = w1(NOW - 60000);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: iso(NOW), death_hi: 'not a date' });
	t.eq('a malformed death_hi falls back to t instead of dropping the row',
		w.bossHop.scanResults[0].live, false);

	/* Both unusable: still no throw, still no clear. */
	w = w1(NOW - 60000);
	w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
		t: 'rubbish', death_hi: 'rubbish' });
	t.eq('both timestamps unusable leaves the entry alone', w.bossHop.scanResults[0].live, true);

	/* THE COLD START IS STILL SAFE. death_hi on a historical row is in the
	   past too, so replaying the whole retained log clears nothing live. The
	   2,290s bracket below is deliberately WIDER than anything the affected
	   population produces - the real max on absent_on_responding_server rows
	   is 348s - because the point is to stress the guard, not to model it. */
	w = w1(NOW);
	for (let d = 1; d <= 50; d++) {
		w.bossHop.applyTerminal({ ev: 'death', type: 'crabxx', server: 'US II',
			t: iso(NOW - d * 3600000), death_hi: iso(NOW - d * 3600000 + 2290000) });
	}
	t.eq('50 historical rows at a deliberately over-wide bracket, still clear nothing',
		w.bossHop.scanResults[0].live, true);
} },

{ name: 'the give-up REASON survives the reload that every hop trip ends in', fn(t) {
	/* bossState.lastGiveUp was memory-only while the blob on disk carried
	   {trip, cooldown, giveUps}; a hop trip ends in the hop home, which is a
	   page reload, so for every trip bossHop makes the reason was destroyed
	   before it could be read. 2026-10-23: twenty minutes on ASIA II, franky
	   untouched at 100%, and the why reconstructed from a cooldown timestamp. */
	const body = require('fs').readFileSync(RANGER, 'utf8');
	t.eq('the load block restores it',
		/bossState\.lastGiveUp = bossSaved\.lastGiveUp \|\| null/.test(body), true);
	const w = world({ character: { name: 'Dexon' } });
	lift(w, RANGER, ['scopeKey', 'scopedHas', 'scopedSet', 'scopedGet', 'scopedGetLegacy',
		'bossState', 'bossSave']);
	w.BOSS_KEY = 'boss_trip';
	w.bossLog = () => { };
	w.bossState.lastGiveUp = { name: 'franky', shard: 'ASIAII', why: 'trip cap', at: 1, startedAt: 0, deaths: 0 };
	w.bossSave();
	const saved = w.store['boss_trip_Dexon'] || {};
	t.eq('PRECONDITION: the blob was written under the scoped key', !!saved.cooldown, true);
	t.eq('and it carries the reason', (saved.lastGiveUp || {}).why, 'trip cap');
	t.eq('with the trip start, so the duration is a read rather than a reconstruction',
		'startedAt' in (saved.lastGiveUp || {}), true);
	t.eq('bossEnd records startedAt and deaths on it',
		/lastGiveUp = \{ name: t\.name, shard: sh, why: why, at: now,\s*startedAt: t\.startedAt/.test(body), true);
} },

{ name: 'the cooldown is keyed (type, shard), which is what lets the party fight on arrival', fn(t) {
	const CD = 30 * 60 * 1000;
	function w1(shard) {
		const w = world({
			BOSS_TYPE_GIVEUP_MAX: 2,
			parent: { server_region: shard.slice(0, 2), server_identifier: shard.slice(2) },
			character: { name: 'Dexon', rip: false },
			rageEntryEnd: () => {},   // v142; the rage side is tested on its own
		});
		lift(w, RANGER, ['bossState', 'bossShard', 'bossCooldownKey', 'bossCooledDown',
			'bossClearCooldown', 'bossEligible', 'bossGenerationEnd', 'bossEnd']);
		/* No bridge row by default, so every assertion above this block reads
		   the cooldownMs fallback and the generation-end tests opt in. */
		w.bossHop = { bridgeRow: () => null };
		w.CONFIG = { bossEvents: { enabled: true, exclude: new Set(), include: [],
			cooperativeOnly: false, cooldownMs: CD } };
		w.bossCooperative = () => true;
		w.bossSave = () => { };
		w.bossLog = () => { };
		w.bossIsLeader = () => false;
		w.bossBroadcast = () => { };
		return w;
	}

	/* THE MEASURED NIGHT. Give up on US II franky at the trip cap, then ask
	   whether franky is takeable on US V. Under the type-keyed cooldown
	   bossEligible said no on every shard - and bossEligible is what bossPick
	   consults, which is what shouldHandleEvents needs, which is what makes the
	   party APPROACH and attack. So v99 hopped to US V and then farmed ordinary
	   mobs beside the franky it had travelled for. */
	let w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('the give-up cools the shard it happened on',
		w.bossCooledDown('franky', 'USII'), true);
	t.eq('and NOT the same boss elsewhere', w.bossCooledDown('franky', 'USV'), false);
	t.eq('so bossEligible refuses here', w.bossEligible('franky', 'USII').ok, false);
	t.eq('and allows there - the half v99 was missing',
		w.bossEligible('franky', 'USV').ok, true);
	t.note('bossEligible -> bossPick -> shouldHandleEvents is what authorises the approach; bossHop arrival alone never did');

	/* The trip's OWN shard is used, not wherever we stand when the budget runs
	   out - otherwise a give-up after any movement is attributed to the wrong
	   shard and cools an instance nobody fought. */
	w = w1('EUIII');
	w.bossState.trip = { name: 'crabxx', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('the cooldown lands on the trip shard', w.bossCooledDown('crabxx', 'USII'), true);
	t.eq('not on the shard we ended up on', w.bossCooledDown('crabxx', 'EUIII'), false);

	/* AN EVENT THAT ENDED ON ITS OWN IS NOT A GIVE-UP, unchanged from before -
	   only 'death', 'cap' and 'by hand' count. */
	w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1000, deaths: 0 };
	w.bossEnd('nothing eligible is live');
	t.eq('a boss that died or despawned cools nothing',
		w.bossCooledDown('franky', 'USII'), false);

	/* THE TYPE-LEVEL BACKSTOP counts distinct SHARDS, not attempts, so a boss
	   that is too strong everywhere is not walked across five shards in turn. */
	w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('one shard does not trip it', w.bossCooledDown('franky', 'ASIAI'), false);
	w.bossState.trip = { name: 'franky', shard: 'USV', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	t.eq('the second DISTINCT shard cools the type everywhere',
		w.bossCooledDown('franky', 'ASIAI'), true);
	t.ok('and says so, so the log distinguishes "try elsewhere" from "out of reach"',
		/EVERYWHERE/.test(w.bossEligible('franky', 'ASIAI').why));

	/* Twice on the SAME shard says nothing new about the other four, so it must
	   not trip the backstop - this is the assertion that makes "distinct
	   shards" the meaning rather than an accident of the counter. */
	w = w1('USII');
	for (let i = 0; i < 3; i++) {
		w.bossState.trip = { name: 'crabxx', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
		w.bossEnd('trip cap of 20 min');
	}
	t.eq('three give-ups on ONE shard leave the type alone',
		w.bossCooledDown('crabxx', 'USV'), false);

	/* Clearing is by TYPE and must take the shard keys with it, or an operator
	   calling the party to a boss is refused by an entry they cannot see. */
	w = w1('USII');
	w.bossState.trip = { name: 'franky', shard: 'USII', startedAt: Date.now() - 1200000, deaths: 0 };
	w.bossEnd('trip cap of 20 min');
	w.bossClearCooldown('franky');
	t.eq('bossClearCooldown clears the shard entry', w.bossCooledDown('franky', 'USII'), false);
	w = w1('USII');
	w.bossState.cooldown.franky = Date.now() + CD;
	w.bossClearCooldown('franky');
	t.eq('and the type entry', w.bossCooledDown('franky', 'USII'), false);

	/* MIGRATION. A map persisted before v103 holds bare type keys. They read as
	   type backstops, which is over-restrictive for at most one cooldown and
	   never permissive - the safe direction, and the reason no migration step
	   is needed. */
	w = w1('USII');
	w.bossState.cooldown = { franky: Date.now() + CD };
	t.eq('a pre-v103 bare key still forbids the type everywhere',
		w.bossCooledDown('franky', 'ASIAI'), true);
	t.note('fails safe rather than permissive, so the persisted map needs no migration');
} },

{ name: 'the cooldown runs to the end of the GENERATION, not a fixed 30 minutes', fn(t) {
	const CD = 30 * 60 * 1000;
	function w1(row) {
		const w = world({
			BOSS_TYPE_GIVEUP_MAX: 2,
			parent: { server_region: 'US', server_identifier: 'II' },
			character: { name: 'Dexon', rip: false },
			rageEntryEnd: () => {},   // v142; the rage side is tested on its own
		});
		lift(w, RANGER, ['bossState', 'bossShard', 'bossCooldownKey', 'bossCooledDown',
			'bossClearCooldown', 'bossEligible', 'bossGenerationEnd', 'bossEnd']);
		w.CONFIG = { bossEvents: { enabled: true, exclude: new Set(), include: [],
			cooperativeOnly: false, cooldownMs: CD } };
		w.bossCooperative = () => true;
		w.bossSave = () => { };
		w.bossLog = () => { };
		w.bossIsLeader = () => false;
		w.bossBroadcast = () => { };
		w.bossHop = { bridgeRow: () => row };
		return w;
	}
	const giveUp = (w, name, shard) => {
		w.bossState.trip = { name, shard, startedAt: Date.now() - 1200000, deaths: 0 };
		w.bossEnd('trip cap of 20 min');
	};
	const leftMin = (w, key) => Math.round((w.bossState.cooldown[key] - Date.now()) / 60000);

	/* NO CONSTANT IS RIGHT, which is why the field exists. A 30-minute cooldown
	   against a 2400s window expires INSIDE the window for a give-up in the
	   first ten minutes and runs PAST the next window's open for one in the
	   last ten - mistimed in opposite directions at the two ends. */
	let w = w1({ hasWindow: true, windowEndsAt: Date.now() + 8 * 60000, estimatedRespawn: null });
	giveUp(w, 'franky', 'USII');
	t.eq('an event boss cools only to its window end', leftMin(w, 'franky|USII'), 8);
	t.note('30 min here would have expired 22 min into the NEXT window, suppressing a fresh generation');

	/* And the type-level backstop uses the same end, because an event boss's
	   generation IS type-wide - every shard spawns on the scheduled hour. */
	w = w1({ hasWindow: true, windowEndsAt: Date.now() + 8 * 60000, estimatedRespawn: null });
	giveUp(w, 'franky', 'USII');
	giveUp(w, 'franky', 'USV');
	t.eq('the backstop too, for an event boss', leftMin(w, 'franky'), 8);

	/* A RESPAWN BOSS IS THE CASE THE OTHER SESSION GOT WRONG. estimated_respawn
	   is right for THIS shard's instance and says nothing about the others,
	   because each shard's timer runs independently - so there is no type-wide
	   generation and the backstop has nothing to align to. */
	w = w1({ hasWindow: false, windowEndsAt: null, estimatedRespawn: Date.now() + 95 * 60000 });
	giveUp(w, 'dragold', 'USII');
	t.eq('a respawn boss cools its SHARD to its own respawn', leftMin(w, 'dragold|USII'), 95);
	giveUp(w, 'dragold', 'USV');
	t.eq('but the backstop keeps the constant - no type-wide generation exists',
		leftMin(w, 'dragold'), 30);
	t.note('using estimated_respawn there would suppress every shard on one shard\'s timer');

	/* NULL IS NOT ABSENT. An event boss the bridge found already up sends
	   window_ends_at as null, and inventing a deadline from that would be
	   worse than falling back. */
	w = w1({ hasWindow: true, windowEndsAt: null, estimatedRespawn: null });
	giveUp(w, 'crabxx', 'USII');
	t.eq('an event boss with an unknown window falls back to the constant',
		leftMin(w, 'crabxx|USII'), 30);

	/* A window end already past, and no bridge row at all: both fall back
	   rather than producing a zero or negative cooldown. */
	w = w1({ hasWindow: true, windowEndsAt: Date.now() - 60000, estimatedRespawn: null });
	giveUp(w, 'crabxx', 'USII');
	t.eq('a window end in the past falls back', leftMin(w, 'crabxx|USII'), 30);
	w = w1(null);
	giveUp(w, 'crabxx', 'USII');
	t.eq('no bridge row falls back', leftMin(w, 'crabxx|USII'), 30);

	/* The three-state read itself, at the helper. */
	w = w1({ hasWindow: true, windowEndsAt: 123456, estimatedRespawn: 999 });
	t.eq('hasWindow -> type-wide', w.bossGenerationEnd('franky', 'USII'),
		{ at: 123456, typeWide: true });
	w = w1({ hasWindow: false, windowEndsAt: null, estimatedRespawn: 999 });
	t.eq('absent window -> per-shard only', w.bossGenerationEnd('dragold', 'USII'),
		{ at: 999, typeWide: false });
	w = w1(null);
	t.eq('no row -> nothing known', w.bossGenerationEnd('franky', 'USII'),
		{ at: null, typeWide: false });
} },

{ name: 'an event that spawns two monster types is found by either of them', fn(t) {
	function w1(mons, G) {
		const w = world({
			character: { name: 'Dexon', x: 0, y: 0 },
			parent: { G: G || { monsters: { rgoo: { cooperative: true }, bgoo: { cooperative: true } } } },
			get_nearest_monster: (q) => mons[q.type] || null,
		});
		lift(w, RANGER, ['BOSS_FIGHT_TYPES', 'bossMonsterTypes', 'bossNearestMonster',
			'bossCooperative']);
		return w;
	}

	let w = w1({});
	t.eq('goobrawl maps to BOTH products', w.bossMonsterTypes('goobrawl'), ['rgoo', 'bgoo']);
	t.eq('and anything else maps to itself', w.bossMonsterTypes('franky'), ['franky']);

	/* THE DEFECT. bossApproach asked for rgoo only, so a goobrawl showing just
	   bgoo returned null - and because goobrawl is not walkable the
	   fall-through re-emitted the join while a live goo stood beside us. */
	w = w1({ bgoo: { id: 'b', x: 10, y: 0 } });
	t.eq('a bgoo-only goobrawl is found', w.bossNearestMonster('goobrawl').id, 'b');
	t.note('the rgoo-only mapping returned null here, and goobrawl is not walkable');
	w = w1({ rgoo: { id: 'r', x: 10, y: 0 } });
	t.eq('an rgoo-only goobrawl is still found', w.bossNearestMonster('goobrawl').id, 'r');

	/* NEAREST, not first-found: posturing against the far one walks past the
	   near one. Asserted in BOTH orders so the result cannot come from the
	   iteration order of BOSS_FIGHT_TYPES. */
	w = w1({ rgoo: { id: 'r', x: 500, y: 0 }, bgoo: { id: 'b', x: 10, y: 0 } });
	t.eq('the nearer type wins when both are up', w.bossNearestMonster('goobrawl').id, 'b');
	w = w1({ rgoo: { id: 'r', x: 10, y: 0 }, bgoo: { id: 'b', x: 500, y: 0 } });
	t.eq('and in the other order too', w.bossNearestMonster('goobrawl').id, 'r');

	w = w1({});
	t.eq('nothing up answers null, as the single-type form did',
		w.bossNearestMonster('goobrawl'), null);
	w = w1({ franky: { id: 'f', x: 5, y: 5 } });
	t.eq('a single-type boss is unaffected', w.bossNearestMonster('franky').id, 'f');

	/* bossCooperative was SAFE either way - both types are cooperative live -
	   so this is about robustness, not a live defect: reading only the first
	   answers false if G does not carry it, and false removes the boss. */
	w = w1({}, { monsters: { bgoo: { cooperative: true } } });
	t.eq('cooperative is true when only the SECOND type carries it',
		w.bossCooperative('goobrawl'), true);
	w = w1({}, { monsters: { rgoo: { cooperative: true } } });
	t.eq('and when only the first does', w.bossCooperative('goobrawl'), true);
	w = w1({}, { monsters: { rgoo: {}, bgoo: {} } });
	t.eq('false when neither does', w.bossCooperative('goobrawl'), false);
	w = w1({}, { monsters: {} });
	t.eq('and when G carries neither', w.bossCooperative('goobrawl'), false);
	w = w1({}, {});
	t.eq('a G with no monsters table does not throw', w.bossCooperative('goobrawl'), false);
} },

/* THE ATTACK GATE COULD NOT SEE AN EVENT'S OWN MONSTERS, which is a different
   hole from the pull v113 fixed and sits one layer further in: the pull gets
   the monster to us, and this decides whether we shoot it.
   `shouldAttackMob` asks `home`, `rageAlso`, `alwaysAttack`, `attackIfTargeted`
   and finally "is it hitting the name in targetPriority". `allBosses` - which
   is what the last two are built from - names NO event spawn: not zombie, not
   ghoul, not horseman, not gargoyle. So on a graveyard trip the ranger shot a
   zombie only when that zombie happened to be on FatherToken, which is aggro
   luck rather than a rule, and it fits the measured 0 -> 11 ranger zombie
   credits against the followers' 12 -> 31 and 17 -> 51.
   THE GARGOYLE IS NOT PART OF THIS FIX and the last assertions prove it: it is
   deliberately absent from BOSS_FIGHT_TYPES, a recorded decision whose own
   words are "the operator's open call, not a default", and a change that
   quietly enacted it through a new code path would be the worst possible
   version of making it. */
{ name: 'the event we travelled for is attackable while the trip is live', fn(t) {
  const aw = (over) => {
    over = over || {};
    const w = world({
      CONFIG: { combat: { ignoreAddsDuringCrabxx: true } },
      parent: { G: { monsters: {} }, S: {} },
      home: over.home || 'crabx',
      rageAlso: over.rageAlso || [],
      rageHoldFire: () => false,
      COMBAT_SETS: {
        neverAttack: new Set(['nerfedmummy']),
        /* The real sets, built from allBosses as the script builds them, so
           the goobrawl assertions below are about the shipped membership and
           not about a fixture that happens to agree. */
        attackIfTargeted: new Set(['rgoo', 'bgoo', 'crabxx', 'franky', 'icegolem']),
        alwaysAttack: new Set([]),
        targetPriority: new Set(['FatherToken']),
      },
    });
    lift(w, RANGER, ['BOSS_FIGHT_TYPES', 'bossMonsterTypes', 'bossFightTypes',
      'bossState', 'shouldAttackMob']);
    w.bossState.trip = over.trip === undefined ? null : over.trip;
    w.rageEntryActive = !!over.inside;
    return w;
  };
  const mob = (mtype, target) => ({ mtype: mtype, target: target === undefined ? null : target });

  /* PRECONDITION, and it is the whole defect: with no trip the ranger has no
     rule for a zombie, so a stationary one is not shot. If this ever reads
     true the assertions below stop discriminating. */
  let w = aw();
  t.eq('bossFightTypes is empty with no trip', w.bossFightTypes().length, 0);
  t.eq('so an untargeted zombie is NOT attacked', w.shouldAttackMob(mob('zombie')), false);

  w = aw({ trip: { name: 'graveyard' } });
  t.eq('a graveyard trip yields the wave types',
    w.bossFightTypes().join(','), 'zombie,ghoul');
  t.eq('and the untargeted zombie IS attacked', w.shouldAttackMob(mob('zombie')), true);
  t.eq('the ghoul too', w.shouldAttackMob(mob('ghoul')), true);
  /* The farm target and the unrelated mob are untouched either way, so the
     widening is scoped to the event rather than switching the filter off. */
  t.eq('the farm home is still attacked', w.shouldAttackMob(mob('crabx')), true);
  t.eq('an unrelated mob is still refused', w.shouldAttackMob(mob('goo')), false);
  t.eq('and neverAttack still wins', w.shouldAttackMob(mob('nerfedmummy')), false);

  /* HORSEMAN HAS A TABLE ROW NOW - the operator's, 2026-10-23, naming the
     jackowalker beside it - so the trip yields both. It used to fall out of
     the [name] default, which is why the fix is keyed on bossMonsterTypes
     rather than on a second list; that mechanism is unchanged. */
  w = aw({ trip: { name: 'horseman' } });
  t.eq('a horseman trip yields the horseman and the jackowalker',
    w.bossFightTypes().join(','), 'horseman,jackowalker');
  t.eq('and the horseman is attacked untargeted', w.shouldAttackMob(mob('horseman')), true);

  /* INVERTED, AND THIS IS THE ONE THAT KEEPS A DELIBERATE RULE INTACT.
     rgoo and bgoo ARE in allBosses and therefore in attackIfTargeted, so the
     new clause excludes them by construction and goobrawl keeps "engage a
     cooperative boss only once somebody else is on it". Removing either
     exclusion from the clause turns that rule off silently. */
  w = aw({ trip: { name: 'goobrawl' } });
  t.eq('a goobrawl trip yields the goos', w.bossFightTypes().join(','), 'rgoo,bgoo');
  t.eq('PRECONDITION: the goos are in attackIfTargeted',
    w.COMBAT_SETS.attackIfTargeted.has('rgoo'), true);
  t.eq('an UNtargeted rgoo is still refused, trip or no trip',
    w.shouldAttackMob(mob('rgoo')), false);
  t.eq('and a targeted one is still taken',
    w.shouldAttackMob(mob('rgoo', 'someone')), true);

  /* THE RECORDED DECISION, PINNED THROUGH THE NEW PATH. The gargoyle is absent
     from BOSS_FIGHT_TYPES on purpose - 6,000,000 hp, cooperative, spawn inside
     the mummy rectangle, and the waves' points carry over to it anyway so
     excluding it costs no share. This asserts that the attack-gate fix did not
     enact that open call as a side effect. */
  w = aw({ trip: { name: 'graveyard' } });
  t.eq('PRECONDITION: the gargoyle is still out of the fight list',
    w.bossMonsterTypes('graveyard').indexOf('gargoyle'), -1);
  t.eq('so an untargeted gargoyle is STILL not attacked',
    w.shouldAttackMob(mob('gargoyle')), false);
  t.eq('and it is reached only the way it always was, by aggro on the priest',
    w.shouldAttackMob(mob('gargoyle', 'FatherToken')), true);

  /* INSIDE THE BOX IT IS THE TARGET - operator, 2026-10-24. The table still
     leaves it out, because the table also feeds the pull and the eligibility
     gate; only the attack list widens, and only while entry is active. */
  w = aw({ trip: { name: 'graveyard' }, inside: true });
  t.eq('inside the box the graveyard trip yields the gargoyle too',
    w.bossFightTypes().join(','), 'zombie,ghoul,gargoyle');
  t.eq('so an untargeted gargoyle IS attacked in there', w.shouldAttackMob(mob('gargoyle')), true);
  t.eq('while the table the pull reads still excludes it',
    w.bossMonsterTypes('graveyard').indexOf('gargoyle'), -1);
  w = aw({ trip: { name: 'horseman' }, inside: true });
  t.eq('entry on any other trip adds nothing',
    w.bossFightTypes().join(','), 'horseman,jackowalker');
} },

/* THE FOLLOWER HALF, WHICH A MUTATION CAUGHT AS UNTESTED. Reverting the Mage's
   loop to a bare `BOSS_SET` moved NO assertion on the first run - the ranger
   assertions above cover a DIFFERENT function in a different file, and
   "shared predicate" was doing the work the loop body has to do itself.
   The division of labour is deliberate and is what this pins: the ranger OPENS
   (no `.target` needed, above) and the followers JOIN (`.target` still
   required, here), so nothing in the follower change relaxes the recorded
   "engage a cooperative boss only once somebody else is on it" rule. */
{ name: 'a follower joins the event we travelled for, once someone is on it', fn(t) {
  const MAGE = 'Party/Mage.js';
  const fw = (over) => {
    over = over || {};
    const ents = {};
    (over.mobs || []).forEach((m, i) => {
      ents['m' + i] = { type: 'monster', visible: true, dead: false,
        mtype: m.mtype, target: m.target === undefined ? null : m.target, x: m.x || 0, y: 0 };
    });
    const w = world({
      CONFIG: { combat: { targetPriority: [] } },
      character: { range: 300, x: 0, y: 0 },
      parent: { entities: ents },
      /* STUBBED, AND THE REASON IS A NEW VARIANT OF A TRAP THIS REPO ALREADY
         CARRIES. `function get_nearest_monster_v2(args = {})` cannot be
         lifted: lift() brace-matches from the first `{`, which here is the
         DEFAULT PARAMETER VALUE, so the match runs to end-of-file and throws
         "Unexpected end of input" - the same failure as `const X = new Set([`
         and `const X = [`, reached through a parameter list instead of an
         initialiser. The subject here is findBestTargetInner's loop, not this
         helper, so a faithful stub of the two argument shapes it is called
         with is the right scope. */
      get_nearest_monster_v2: (args) => {
        args = args || {};
        let best = null, bd = Infinity;
        for (const id in ents) {
          const e = ents[id];
          if (args.type && e.mtype !== args.type) continue;
          if (args.target && !args.target.includes(e.target)) continue;
          const d = Math.abs(e.x || 0);
          if (args.max_distance !== undefined && d > args.max_distance) continue;
          if (d < bd) { bd = d; best = e; }
        }
        return best;
      },
      focusFireTarget: () => null,
      /* BOSS_SET is `new Set([...allBosses, ...])` - the non-liftable shape -
         so it is supplied, and the precondition below proves the fixture is
         faithful on the one membership the test turns on. */
      BOSS_SET: new Set(['rgoo', 'bgoo', 'crabxx', 'franky', 'icegolem']),
      home: null,
    });
    lift(w, MAGE, ['BOSS_FIGHT_TYPES', 'bossMonsterTypes', 'bossFightTypes',
      'bossState', 'findBestTargetInner']);
    w.bossState.trip = over.trip === undefined ? null : over.trip;
    w.rageEntryActive = !!over.inside;
    return w;
  };
  const src = require('fs').readFileSync(MAGE_PATH, 'utf8');
  t.eq('PRECONDITION: zombie really is absent from the shipped allBosses',
    /const allBosses = \[[^\]]*'zombie'/.test(src), false);

  /* PRECONDITION: a targeted zombie in range, which BOSS_SET alone cannot
     reach - so a hit below is the widening and not the fixture. */
  let w = fw({ mobs: [{ mtype: 'zombie', target: 'Dexon' }] });
  t.eq('with no trip the follower finds nothing', w.findBestTargetInner(), null);

  w = fw({ trip: { name: 'graveyard' }, mobs: [{ mtype: 'zombie', target: 'Dexon' }] });
  const got = w.findBestTargetInner();
  t.eq('on a graveyard trip it joins the targeted zombie', got && got.mtype, 'zombie');

  /* THE RULE THAT DID NOT CHANGE: no `.target`, no join. The follower waits
     for the ranger to open, which is the existing design and not a new one. */
  w = fw({ trip: { name: 'graveyard' }, mobs: [{ mtype: 'zombie', target: null }] });
  t.eq('an UNtargeted zombie is still refused on the same trip',
    w.findBestTargetInner(), null);

  /* And the gargoyle stays out on the follower side too, for the same
     recorded reason - the open call is not enacted here either. */
  w = fw({ trip: { name: 'graveyard' }, mobs: [{ mtype: 'gargoyle', target: 'Dexon' }] });
  t.eq('a targeted gargoyle is NOT joined from outside the box',
    w.findBestTargetInner(), null);
  w = fw({ trip: { name: 'graveyard' }, inside: true, mobs: [{ mtype: 'gargoyle', target: 'Dexon' }] });
  const gg = w.findBestTargetInner();
  t.eq('inside the box the follower joins the targeted gargoyle', gg && gg.mtype, 'gargoyle');
  w = fw({ trip: { name: 'graveyard' }, inside: true, mobs: [{ mtype: 'gargoyle', target: null }] });
  t.eq('and still waits for someone to be on it', w.findBestTargetInner(), null);

  /* AND THE PRIEST IS COVERED BY POSITION RATHER THAN BY BEHAVIOUR, because a
     priest-only revert of this loop was ALSO invisible - measured by mutation,
     on the second attempt, after the mage-only revert had already been caught.
     The two findBestTargetInner bodies legitimately differ (the priest carries
     an extra `if (!home) return null` and wraps its argument object), so they
     cannot join the byte-identity loop in suite_relay and the subject must not
     be dropped for that - the answer is to narrow what the check ignores down
     to the one line both files have to carry. The `.target` half is asserted
     beside it so a revert cannot half-land either. */
  for (const f of ['Party/Priest.js', 'Party/Mage.js']) {
    const body = require('fs').readFileSync(f, 'utf8');
    t.eq(f + ': the boss loop iterates BOSS_SET plus the event types',
      body.indexOf('for (const bossType of new Set([...BOSS_SET, ...bossFightTypes()])) {') >= 0,
      true);
    t.eq(f + ': and still requires .target, so the follower joins rather than opens',
      /new Set\(\[\.\.\.BOSS_SET, \.\.\.bossFightTypes\(\)\]\)\)[\s\S]{0,240}?if \(boss && boss\.target\) return boss;/.test(body),
      true);
  }
} },

/* A TRUST WINDOW WITH NO HEARTBEAT IS A TIMER THAT ALWAYS EXPIRES.
   The leader broadcast its pick only where the trip STARTS or CHANGES, and a
   follower trusts `fromLeader` for `leaderTrustMs`. Every window outlives that
   by one to two orders - graveyard 600s, horseman 2400s against 20s - so for
   almost all of every trip the followers were on their OWN pick, which is a
   DIFFERENT RULE: the ranger ranks first, the followers order by lowest hp
   ratio, `bossRank` being declared in Ranger.js alone. Observed live
   2026-10-22 as a three-map split during one graveyard trip.
   `rageEntryBroadcast` re-sends every tick and is the model. The EXPIRY is
   correct and is pinned below - a leader that stops ticking must release the
   followers - so the fix adds the beat and changes no timeout. */
{ name: 'the leader keeps saying what the trip is', fn(t) {
  const rw = (over) => {
    over = over || {};
    const sent = [];
    const w = world({
      character: { name: over.me || 'Dexon' },
      CONFIG: { bossEvents: { leaderName: 'Dexon', leaderTrustMs: 20000 },
                party: { groupMembers: ['Dexon', 'FatherToken', 'MageofOz'] } },
      plSend: (to, d) => sent.push(to + ':' + d.name),
    });
    /* `const BOSS_RECAST_MS = 8000` is the non-brace initialiser this repo
       already records twice over - supplied here and PINNED from the source
       text below, so a changed constant cannot leave these assertions
       measuring a stale copy while still passing. */
    lift(w, RANGER, ['bossState', 'bossIsLeader', 'bossBroadcast', 'bossRecast']);
    w.BOSS_RECAST_MS = 8000;
    w.bossState.trip = over.trip === undefined ? null : over.trip;
    w.sent = sent;
    return w;
  };

  /* THE INVARIANT THE WHOLE FIX RESTS ON, read from the two source texts
     rather than from the fixture: the beat must be comfortably inside the
     window it refreshes, or a follower drops out between beats and the defect
     returns with nothing looking different. */
  const rsrc = require('fs').readFileSync(RANGER, 'utf8');
  const beat = Number((rsrc.match(/const BOSS_RECAST_MS = (\d+)/) || [])[1]);
  const trust = Number((rsrc.match(/leaderTrustMs: (\d+)/) || [])[1]);
  t.eq('both constants were found in the source', [beat > 0, trust > 0], [true, true]);
  t.eq('and the fixture matches the shipped beat', beat, 8000);
  t.eq('the beat survives a lost message - two of them fit inside the window',
    beat * 2 < trust, true);

  let w = rw({ trip: { name: 'graveyard' } });
  t.eq('the leader casts to both followers', (w.bossRecast(), w.sent),
    ['FatherToken:graveyard', 'MageofOz:graveyard']);
  t.eq('and is throttled immediately after', (w.bossRecast(), w.sent.length), 2);
  w.bossState.lastCast = Date.now() - (beat + 1);
  t.eq('then casts again once the beat has elapsed',
    (w.bossRecast(), w.sent.length), 4);

  /* Scoped three ways, each its own assertion so a mutation cannot pass by
     satisfying a neighbour. */
  /* v144: AN IDLE LEADER SAYS "NO BOSS" ON THE SAME BEAT. Until then it said
     nothing, and a follower read the silence as nothing heard and picked for
     itself - MageofOz to franky, alone, twice, 2026-10-24 on EU III. */
  w = rw({ trip: null });
  t.eq('an idle leader tells both followers there is no boss', (w.bossRecast(), w.sent),
    ['FatherToken:null', 'MageofOz:null']);
  t.eq('on the same throttle', (w.bossRecast(), w.sent.length), 2);
  w = rw({ me: 'MageofOz', trip: { name: 'graveyard' } });
  t.eq('PRECONDITION: that character is not the leader', w.bossIsLeader(), false);
  t.eq('so a follower never casts', (w.bossRecast(), w.sent.length), 0);

  /* THE EXPIRY IS DELIBERATE AND STAYS. This is what the beat feeds, and it
     must keep working: a leader that has genuinely stopped must release the
     followers to decide for themselves. Asserted through bossPick's `src`,
     which stays true however the own-path later chooses. */
  const pw = (ageMs) => {
    const w2 = world({
      character: { name: 'MageofOz' },
      CONFIG: { bossEvents: { leaderName: 'Dexon', leaderTrustMs: 20000 } },
      parent: { S: { graveyard: { live: true } } },
      bossEligible: () => ({ ok: true }),
      bossLog: () => {},
    });
    lift(w2, 'Party/Mage.js', ['BOSS_PRESENCE_LIVE', 'bossEntryLive', 'bossLiveNames',
      'bossState', 'bossIsLeader', 'BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossRank', 'bossPick']);
    w2.bossState.fromLeader = { name: 'graveyard', at: Date.now() - ageMs };
    return w2;
  };
  t.eq('a fresh call is followed', pw(1000).bossPick().src, 'leader');
  t.eq('and a stale one falls through to the follower\'s own rule',
    pw(25000).bossPick().src, 'own');

  /* A FOLLOWER'S OWN RULE IS NOW THE LEADER'S - Priest v74 / Mage v97.
     12:30 EDT 2026-10-24: the graveyard opened with Dexon on it and the two
     followers on a damaged mrpumpkin for 40-65s, because their own pick led on
     hp ratio and the leader's on rank. */
  for (const f of ['Party/Priest.js', 'Party/Mage.js']) {
    const w3 = world({
      character: { name: 'MageofOz' },
      CONFIG: { bossEvents: { leaderName: 'Dexon', leaderTrustMs: 20000 } },
      parent: { S: { graveyard: { live: true }, mrpumpkin: { live: true, hp: 14000000, max_hp: 36000000 } } },
      bossEligible: () => ({ ok: true }),
      bossLog: () => {},
    });
    lift(w3, f, ['BOSS_PRESENCE_LIVE', 'bossEntryLive', 'bossLiveNames',
      'bossState', 'bossIsLeader', 'BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossRank', 'bossPick']);
    t.ok(f + ': PRECONDITION: mrpumpkin is nearer dead, so hp ratio alone would take it',
      w3.parent.S.mrpumpkin.hp / w3.parent.S.mrpumpkin.max_hp < 1);
    const p3 = w3.bossPick();
    t.eq(f + ': with no word from the leader, the follower still takes the graveyard', [p3.name, p3.src].join(), 'graveyard,own');
  }
  const { extract } = require('./lift');
  for (const n of ['bossPick', 'bossRank', 'BOSS_RANK', 'BOSS_RANK_DEFAULT']) {
    const r = extract(RANGER, n);
    for (const f of ['Party/Priest.js', 'Party/Mage.js'])
      t.eq(f + ': ' + n + ' is the ranger\'s, byte for byte', extract(f, n) === r, true);
  }

  /* AND THE CALL SITE, WHICH A MUTATION CAUGHT AS UNASSERTED. Deleting
     `bossRecast();` from bossTick moved nothing above: every assertion so far
     is about the helper, and a perfect helper nobody invokes leaves the defect
     exactly where it was. That is this repo's own "assert on the far side of a
     handoff" - the helper is the near side - and bossTick is too large and too
     stateful to lift, so the check is positional over the source text in all
     three files, which is the narrow form used when byte-identity cannot
     apply. Position matters: called before `const t = bossState.trip` it beats
     on the same tick the trip is read. */
  for (const f of [RANGER, 'Party/Priest.js', 'Party/Mage.js']) {
    const body = require('fs').readFileSync(f, 'utf8');
    /* ANCHORED RELATIVE TO THE CALL, not to the first match in the file:
       `const t = bossState.trip` also appears in bossEnd, ABOVE bossTick, so
       a bare indexOf compares against the wrong occurrence and reports false
       against correct code - which is what the first draft of this assertion
       did in all three files. The pair that matters is the broadcast the
       trip-start block ends with, then the beat, then the read. */
    const cast = body.indexOf('if (bossIsLeader()) bossBroadcast(pick.name);');
    const call = body.indexOf('\n\tbossRecast();\n');
    const read = body.indexOf('\n\tconst t = bossState.trip;', call);
    t.eq(f + ': bossTick calls bossRecast', call >= 0, true);
    t.eq(f + ': exactly once', body.split('\n\tbossRecast();\n').length - 1, 1);
    t.eq(f + ': after the trip-start broadcast', cast >= 0 && cast < call, true);
    t.eq(f + ': and before the trip is read on that tick',
      call >= 0 && read >= 0 && call < read, true);
  }
} },

{ name: 'CODE storage is scoped per character', fn: (t) => {
  /* `set`/`get` ARE NOT CHARACTER-SCOPED - `window.localStorage.setItem(
     "cstore_" + name, ...)` at upstream 16881a27, one origin, every character
     tab sharing it. A bare 'boss_trip' made the trip, the shard-keyed
     cooldowns and the give-up counts ONE blob for all three characters. */
  const fs = require('fs');
  for (const f of [RANGER, 'Party/Priest.js', 'Party/Mage.js']) {
    const body = fs.readFileSync(f, 'utf8');
    t.eq(f + ': BOSS_KEY is the bare base name', 
      body.indexOf("const BOSS_KEY = 'boss_trip';") >= 0, true);
    /* THE INVERTED HALF, AND IT FORBIDS v119's OWN SHAPE RATHER THAN THE
       ORIGINAL BUG. Baking the name into a `const` at module scope looks like
       the fix and is a second way to have it: `runner_functions.js` builds
       `character` as a proxy filled by `proxy_all()`, whose own comment says
       "Not all properties are sadly available right away", so the const can
       capture an empty name and mint one shared `boss_trip_undefined` for all
       three - the same collision, now invisible. */
    t.eq(f + ': and is never frozen into a const at load',
      body.indexOf("'boss_trip_' + character.name"), -1);
    t.eq(f + ': every read goes through the scoped helper',
      body.indexOf('scopedGet(BOSS_KEY)') >= 0, true);
    t.eq(f + ': and no bare get(BOSS_KEY) survives',
      body.indexOf('get(BOSS_KEY)'), -1);
    t.eq(f + ': and no bare set(BOSS_KEY,', /[^d]set\(BOSS_KEY,/.test(body), false);
  }

  /* EVERY STORAGE KEY IS CLASSIFIED, AND A NEW ONE CANNOT DEFAULT INTO
     SHARING. Reverting a single call site to a bare `get(ACHV_KEY)` moved no
     assertion until this existed - the block above pins boss_trip by name and
     says nothing about its nine neighbours. So the declarations are DERIVED
     from the source and each must appear in exactly one of the two lists;
     adding a key without choosing fails here rather than quietly joining the
     shared namespace, which is the enumeration the log's `ev` values already
     get. The unscoped two are arguments, not oversights: `pl_cursor` ends
     every poll at the bridge's GLOBAL head so all four converge there anyway,
     and `loot_chest_ids` is harmless - and they are asserted so that scoping
     either one has to confront the reason. */
  const KEYS = {
    'Party/Ranger.js': {
      scoped: ['PL_ACTED_KEY', 'TAXI_PROBE_KEY', 'BOSS_KEY', 'CRABXX_KEY',
        'BLACKLIST_STORAGE_KEY', 'FEAR_STORE', 'ACHV_KEY', 'MH_KEY', 'CIPHER_STOCK_KEY'],
      /* TOT_STAND_KEY is shared ON PURPOSE: a door's stand point is a fact
         about the map, and the merchant and the ranger knock the same doors. */
      shared: ['PL_CURSOR_KEY', 'CHEST_STORAGE_KEY', 'TOT_STAND_KEY'],
    },
    /* PL_HOP_PENDING_KEY was NOT on the first draft of this list and the
       derivation is what found it - a pending-hop record shared by the two
       followers, so one could resolve a hop the other ordered. Scoped with
       NO migration, for boss_trip's reason: the legacy value is either
       follower's and adopting it once IS the import being removed. */
    'Party/Priest.js': { scoped: ['PL_ACTED_KEY', 'BOSS_KEY', 'PL_HOP_PENDING_KEY'],
      shared: ['PL_CURSOR_KEY', 'CHEST_STORAGE_KEY'] },
    'Party/Mage.js': { scoped: ['PL_ACTED_KEY', 'BOSS_KEY', 'PL_HOP_PENDING_KEY'],
      shared: ['PL_CURSOR_KEY', 'CHEST_STORAGE_KEY'] },
  };
  for (const [f, spec] of Object.entries(KEYS)) {
    const body = require('fs').readFileSync(f, 'utf8');
    const declared = (body.match(/^const [A-Z_]+(?:KEY|STORE) = ['"]/gm) || [])
      .map((d) => d.split(' ')[1]);
    const classified = spec.scoped.concat(spec.shared).sort();
    t.eq(f + ': every declared storage key is classified',
      declared.sort().join(','), classified.join(','));
    for (const k of spec.scoped) {
      t.eq(f + ': ' + k + ' has no bare read', body.indexOf('get(' + k + ')'), -1);
      t.eq(f + ': ' + k + ' has no bare write',
        new RegExp('[^d]set\\(' + k + ',').test(body), false);
    }
    for (const k of spec.shared) {
      t.eq(f + ': ' + k + ' is deliberately NOT scoped',
        new RegExp('scoped(?:Set|Get|GetLegacy)\\(' + k).test(body), false);
    }
  }

  const w = world({ character: { name: 'Dexon' } });
  lift(w, RANGER, ['scopeKey', 'scopedHas', 'scopedSet', 'scopedGet', 'scopedGetLegacy']);
  t.eq('the key carries the character', w.scopeKey('k'), 'k_Dexon');
  w.scopedSet('k', 1);
  t.eq('a write lands on the scoped key', w.store['k_Dexon'], 1);
  t.eq('and never on the shared one', 'k' in w.store, false);

  /* THE PROVENANCE SPLIT, WHICH IS THE WHOLE REASON THERE ARE TWO READERS.
     Falling back to the legacy key is right exactly where that value cannot
     be another character's, and wrong where it can - boss_trip is the second
     case, which is why reading it once IS the import being removed. */
  const w2 = world({ character: { name: 'Dexon' }, store: { legacy: 'old' } });
  lift(w2, RANGER, ['scopeKey', 'scopedHas', 'scopedSet', 'scopedGet', 'scopedGetLegacy']);
  t.eq('scopedGet refuses the legacy value', w2.scopedGet('legacy'), null);
  t.eq('scopedGetLegacy adopts it once', w2.scopedGetLegacy('legacy'), 'old');

  /* A CLEAR IS NOT AN ABSENCE, AND get() REPORTS THEM IDENTICALLY. A scoped
     key written null is PRESENT holding null; one never written is absent;
     `JSON.parse(localStorage.getItem(...))` answers null to both. Without the
     raw-item test the fallback UNDOES a deliberate clear by resurrecting the
     legacy value - live on `mhForget()`, which clears mh_state that way while
     mh_state is on the migrating list. */
  t.eq('PRECONDITION: the harness tells an absent key from a null one',
    [w2.scopedHas('legacy'), w2.scopedHas('k_Dexon')].join(), 'false,false');
  w2.scopedSet('legacy', null);
  t.eq('PRECONDITION: the clear is PRESENT, not absent',
    ['legacy_Dexon' in w2.store, w2.scopedHas('legacy')].join(), 'true,true');
  t.eq('PRECONDITION: and the legacy value is still there to be resurrected',
    w2.get('legacy'), 'old');
  t.eq('a cleared key stays cleared', w2.scopedGetLegacy('legacy'), null);

  /* The inverse, so the fix cannot pass by refusing to migrate at all. */
  const w2b = world({ character: { name: 'Dexon' }, store: { legacy: 'old' } });
  lift(w2b, RANGER, ['scopeKey', 'scopedHas', 'scopedSet', 'scopedGet', 'scopedGetLegacy']);
  t.eq('PRECONDITION: nothing has written the scoped key', w2b.scopedHas('legacy'), false);
  t.eq('an untouched key still migrates', w2b.scopedGetLegacy('legacy'), 'old');

  /* AND THE CASE IS LIVE RATHER THAN HYPOTHETICAL. mhForget() is the only
     clear-to-null on a migrating key; PL_HOP_PENDING_KEY is cleared the same
     way and is deliberately NOT migrating, so it cannot be resurrected. */
  t.eq('mhForget clears MH_KEY to null through the scoped writer',
    /function mhForget\(\)[\s\S]{0,200}scopedSet\(MH_KEY, null\)/.test(require('fs').readFileSync(RANGER, 'utf8')), true);
  t.eq('and MH_KEY is read through the migrating reader',
    /scopedGetLegacy\(MH_KEY\)/.test(require('fs').readFileSync(RANGER, 'utf8')), true);

  /* The point of the exercise: two characters, one store, no crossing. */
  /* world() COPIES the store it is given rather than aliasing it, so two
     worlds can never share one live object - the first draft of this handed
     both the same `{}` and asserted on it, and the PRECONDITION is what caught
     that the write had gone somewhere else. Seeding the sibling from the
     written store is the faithful shape anyway: one namespace, read after. */
  const dex = world({ character: { name: 'Dexon' } });
  lift(dex, RANGER, ['scopeKey', 'scopedSet', 'scopedGet']);
  dex.scopedSet('boss_trip', { name: 'mrgreen' });
  const mage = world({ character: { name: 'MageofOz' }, store: dex.store });
  lift(mage, RANGER, ['scopeKey', 'scopedSet', 'scopedGet']);
  t.eq('PRECONDITION: my trip IS in the namespace the sibling reads',
    (mage.store['boss_trip_Dexon'] || {}).name, 'mrgreen');
  t.eq('and the sibling does not read it', mage.scopedGet('boss_trip'), null);
  t.eq('it reads its own key', mage.scopeKey('boss_trip'), 'boss_trip_MageofOz');

  /* AN UNREADABLE NAME WRITES NOTHING, which is the safe direction: a lost
     save beats a write to the key all three read. */
  const w3 = world({ character: { name: 'Dexon' } });
  lift(w3, RANGER, ['scopeKey', 'scopedSet', 'scopedGet']);
  delete w3.character.name;
  t.eq('PRECONDITION: the name is unreadable', !!w3.character.name, false);
  t.eq('no key can be built', w3.scopeKey('k'), null);
  t.eq('the write is refused', w3.scopedSet('k', 1), false);
  t.eq('and nothing reached the store', Object.keys(w3.store).length, 0);

  /* THE INVARIANT THAT MADE THE DIAGNOSIS POSSIBLE. `src: 'leader'` sits
     behind `!bossIsLeader()`, so a leader holding a trip stamped 'leader' has
     loaded another character's save - which is what Dexon did at 23:01:20 on
     2026-10-22 after reading src='own' at 22:58:18, same startedAt. Asserted
     with a FRESH call in hand, the only state in which a follower WOULD
     answer 'leader', so it cannot pass by being offered nothing. */
  const wl = world({
    character: { name: 'Dexon' },
    CONFIG: { bossEvents: { leaderName: 'Dexon', leaderTrustMs: 20000 } },
    parent: { S: { mrgreen: { live: true, hp: 5, max_hp: 10 } } },
    bossEligible: () => ({ ok: true }),
    bossRank: () => 5,
    bossLog: () => {},
  });
  lift(wl, RANGER, ['BOSS_PRESENCE_LIVE', 'bossEntryLive', 'bossLiveNames',
    'bossState', 'bossIsLeader', 'bossPick']);
  wl.bossState.fromLeader = { name: 'mrgreen', at: Date.now() };
  t.eq('PRECONDITION: the call is fresh and live', wl.bossIsLeader(), true);
  t.eq('the leader never stamps a trip src=leader', wl.bossPick().src, 'own');
} },

{ name: 'boot order: the event branch runs before the farm gate in all three mainLoops', fn(t) {
	/* MEASURED BY THE BROWSER SESSION 2026-10-23 on the Ranger v123 and Priest
	   v69 slots: after a hop the farm spot was decided and broadcast before any
	   boss evaluation ran, because `if (!home || !mobMap || !destination)
	   return` sat ABOVE shouldHandleEvents() in every mainLoop. The gate now
	   guards only the farm-dependent movement branch. Asserted by POSITION in
	   the extracted mainLoop body, which is the only thing the defect was. */
	const { extract } = require('./lift');
	const fs = require('fs');
	const GATE = /if \(!home \|\| !mobMap \|\| !destination\)/;
	for (const f of [RANGER, PRIEST_PATH, MAGE_PATH]) {
		const body = extract(f, 'mainLoop');
		const ev = body.indexOf('shouldHandleEvents()');
		const gate = body.search(GATE);
		t.eq(`${f}: PRECONDITION: mainLoop consults shouldHandleEvents`, ev > 0, true);
		t.eq(`${f}: PRECONDITION: mainLoop still carries the farm gate`, gate > 0, true);
		t.eq(`${f}: the event branch precedes the farm gate`, ev < gate, true);
		/* And the gate is an else-branch of the event test, not a second
		   early return that happens to sit lower: `else if (!home` is the shape
		   in all three. */
		t.eq(`${f}: the gate is the else-branch of the event test`,
			/else if \(!home \|\| !mobMap \|\| !destination\)/.test(body), true);
	}

	/* THE PRIEST_PATH PICKER HAD ITS OWN GATE and the browser session named it as
	   the trap: `if (!home) return null` at the top of findBestTargetInner
	   refused a targeted boss in range until the farm spot arrived. Lifted with
	   home null and a boss on somebody: the boss is returned. */
	const { lift, world } = require('./lift');
	const boss = { id: 'h', mtype: 'horseman', target: 'Dexon' };
	const w = world({
		home: null,
		BOSS_SET: new Set(['horseman']),
		bossFightTypes: () => [],
		focusFireTarget: () => null,
		get_nearest_monster_v2: (a) => (a.type === 'horseman' ? boss : null),
		CONFIG: { combat: { targetPriority: ['FatherToken'] } },
	});
	w.character.range = 100;
	lift(w, PRIEST_PATH, ['findBestTargetInner']);
	t.eq('priest: a targeted boss is picked with no farm spot', w.findBestTargetInner(), boss);
	w.get_nearest_monster_v2 = () => null;
	t.eq('priest: and with nothing on anyone the answer is still null', w.findBestTargetInner(), null);
	/* The home-dependent loop is still guarded - source text, because a null
	   `type: home` query against a stub answers nothing either way. */
	const inner = extract(PRIEST_PATH, 'findBestTargetInner');
	t.eq('priest: the `type: home` loop is guarded by a home check',
		inner.indexOf('if (!home) return null') < inner.lastIndexOf('type: home,')
		&& inner.indexOf('if (!home) return null') > inner.indexOf('bossFightTypes()'), true);

	/* THE RANGER-SIDE TRAP THE HANDOFF DID NOT LIST: updateCache returned early
	   on a null destination, so cache.targets stayed empty and handleAttack had
	   nothing to shoot on any trip that started before the farm search. With
	   destination null a monster in range still lands in inRange; only the
	   clumped bucket, which is measured off the farm spot, stays empty. */
	const mob = { type: 'monster', mtype: 'horseman', x: 0, y: 0, hp: 100, s: {} };
	const wr = world({
		destination: null, home: null,
		performance: { now: () => 1000 },
		CONFIG: { movement: { clumpRadius: 50 }, equipment: { xpMobHpThreshold: 10 } },
		COMBAT_SETS: { xpMonsters: new Set(), alwaysAttack: new Set(), attackIfTargeted: new Set(['horseman']) },
		shouldAttackMob: () => true,
		is_in_range: () => true,
		findHealTarget: () => null,
		CACHE_TTL: 50,
	});
	wr.parent.entities = { a: mob };
	lift(wr, RANGER, ['cache', 'updateCache']);
	wr.updateCache();
	t.eq('ranger: a monster in range is cached with no destination', wr.cache.targets.inRange.length, 1);
	t.eq('ranger: and sortedByHP carries it', wr.cache.targets.sortedByHP.length, 1);
	t.eq('ranger: clumped stays empty - it is measured off the farm spot', wr.cache.targets.clumped.length, 0);
	wr.cache.lastUpdate = 0;
	wr.destination = { x: 0, y: 0 };
	wr.updateCache();
	t.eq('ranger: with a destination the same monster is clumped', wr.cache.targets.clumped.length, 1);

	/* THE LEADER'S FIRST BROADCAST WAITS FOR ONE BOSS EVALUATION AND ONE
	   ACHIEVEMENT TICK. Both are one-way latches; sendFarmSpot refuses until
	   both are set, and the farm-state guard above it is unchanged. */
	const sent = [];
	const ws = world({
		home: 'crab', mobMap: 'main', destination: { x: 1, y: 2 }, rageAlso: [],
		rageCfg: () => ({ concurrent: 1 }), plSend: (a, m) => sent.push(m), plLog: () => {},
		FARM_SPOT: { audience: ['FatherToken'] },
		farmSpotLast: null, farmSpotSentAt: 0, farmBootBossEval: false, farmBootAchvTick: false,
	});
	lift(ws, RANGER, ['farmSpotBootReady', 'farmSpotKey', 'sendFarmSpot']);
	t.eq('leader: no broadcast before either latch', ws.sendFarmSpot('x'), false);
	ws.farmBootBossEval = true;
	t.eq('leader: no broadcast on the boss latch alone', ws.sendFarmSpot('x'), false);
	ws.farmBootBossEval = false; ws.farmBootAchvTick = true;
	t.eq('leader: nor on the achievement latch alone', ws.sendFarmSpot('x'), false);
	ws.farmBootBossEval = true;
	t.eq('leader: both set, it sends', ws.sendFarmSpot('x'), true);
	t.eq('leader: and the payload is the farm spot', sent.length === 1 && sent[0].message === 'farm_spot', true);

	/* The latches are SET where they claim to be: the boss one in mainLoop
	   right after the event test (so a loop that returns early above it, on
	   jail or a potion emergency, has not evaluated a boss and does not count),
	   and the achievement one on settle of a tick that is ALSO called at boot
	   rather than first at reassertMs. */
	const ml = extract(RANGER, 'mainLoop');
	const evAt = ml.indexOf('shouldHandleEvents()');
	const latchAt = ml.indexOf('farmBootBossEval = true');
	t.eq('ranger: the boss latch is set in mainLoop', latchAt > 0, true);
	t.eq('ranger: after the event test', latchAt > evAt, true);
	t.eq('ranger: and before the farm gate', latchAt < ml.search(GATE), true);
	const rsrc = fs.readFileSync(RANGER, 'utf8');
	const run = extract(RANGER, 'achvTickRun');
	t.eq('ranger: achvTickRun latches on settle (finally), not on success', /\.finally\(\(\) => \{ farmBootAchvTick = true;/.test(run), true);
	t.eq('ranger: achvTickRun is called at boot', /^setTimeout\(achvTickRun, 0\);$/m.test(rsrc), true);
	t.eq('ranger: and on the interval', /setInterval\(achvTickRun,/.test(rsrc), true);
} },

{ name: 'BOSS_FIGHT_TYPES carries the operator\'s horseman row identically in all four copies', fn(t) {
	/* The operator put `horseman: ['horseman', 'jackowalker']` into the Ranger
	   SLOT by hand on 2026-10-23, unbumped. Carried into the repo so the next
	   deploy does not revert it, and into the other three copies so the
	   divergence check stays green. Exact text, all four. */
	const fs = require('fs');
	const path = require('path');
	const { ROOT } = require('./lift');
	for (const f of [RANGER, PRIEST_PATH, MAGE_PATH, path.join(ROOT, 'Codex/FamilyFleet.js')]) {
		t.eq(`${path.basename(f)}: horseman row present`,
			/horseman: \['horseman', 'jackowalker'\]/.test(fs.readFileSync(f, 'utf8')), true);
	}
} },
{ name: 'preposition: the planner picks a due, viable, ranked occurrence off home', fn(t) {
	const NOW = Date.now();
	const w = prepWorld();
	/* goobrawl at T+780s is due exactly: join-only, so it leads by the full
	   720s of hop sickness, plus the 60s margin and the 1.5s hop. */
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)]);
	let p = w.bossHop.prepPlan('USII');
	t.eq('goobrawl on ASIA I is the plan', p && p.shard + '/' + p.event, 'ASIAI/goobrawl');
	t.eq('and it is join-only', p && p.joinOnly, true);
	t.eq('hop time is start - hopsick - margin - latency', p && (p.at - p.hopAt), 720000 + 60000 + 1500);

	feed(w, [row('ASIAI', 'goobrawl', NOW + 900000, 540)]);
	t.eq('two minutes earlier it is not due yet', w.bossHop.prepPlan('USII'), null);

	/* THE LATE CASE, which is the 08:30 EDT graveyard shape: a hop now could
	   not engage before the window closed, so it is refused rather than
	   taken. Precondition first, so the refusal is not some other filter. */
	feed(w, [row('ASIAI', 'goobrawl', NOW, 540)]);
	t.ok('precondition: the event is still open', NOW < NOW + 540000);
	t.eq('a goobrawl that has just opened is not worth the hop', w.bossHop.prepPlan('USII'), null);

	/* Already there, with 100s of sickness left: no hop to pay, only the
	   remainder to clear, so it is still the plan - that is the hold. */
	const there = prepWorld({ id: 'I', region: 'ASIA', character: { s: { hopsickness: { ms: 100000 } } } });
	feed(there, [row('ASIAI', 'goobrawl', NOW + 60000, 540)]);
	p = there.bossHop.prepPlan('ASIAI');
	t.eq('on the shard already, the remaining sickness fits', p && p.shard, 'ASIAI');
	there.character.s.hopsickness.ms = 500000;
	t.eq('and when it does not, there is no plan to hold for', there.bossHop.prepPlan('ASIAI'), null);
} },

{ name: 'preposition: only join-only events, unless the operator names one', fn(t) {
	/* The operator's narrowing, 2026-10-24: hop in advance only where the
	   entrance requires not being hop-sick, or where arriving early is shown
	   to be worth it. crabxx, franky, horseman and graveyard can all be walked
	   into sick, so the reactive hop - which also runs the dwell check - keeps
	   them. */
	const NOW = Date.now();
	const w = prepWorld();
	for (const ev of ['crabxx', 'franky', 'horseman', 'graveyard']) {
		feed(w, [row('ASIAI', ev, NOW + 100000, 600)]);
		t.eq(ev + ' is walkable -> not prepositioned for', w.bossHop.prepPlan('USII'), null);
	}
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)]);
	t.eq('goobrawl is join-only -> it is', w.bossHop.prepPlan('USII') && w.bossHop.prepPlan('USII').event, 'goobrawl');
	const named = prepWorld({ alsoFor: ['crabxx'] });
	feed(named, [row('ASIAI', 'crabxx', NOW + 100000, 2400)]);
	t.eq('a name in alsoFor is, and leads by the walk', named.bossHop.prepPlan('USII') && named.bossHop.prepPlan('USII').joinOnly, false);
	const src = require('fs').readFileSync(require('path').join(require('./lift').ROOT, RANGER), 'utf8');
	t.ok('alsoFor ships empty', /alsoFor: \[\],/.test(src));
} },

{ name: 'preposition: no fresh home lineup or feed means no plan', fn(t) {
	const NOW = Date.now();
	const w = prepWorld();
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)]);
	t.ok('precondition: with home fresh it plans', !!w.bossHop.prepPlan('USII'));
	delete w.bossHop.schedServers.USII;
	t.eq('home lineup missing -> "is it on home" is unanswerable -> nothing', w.bossHop.prepPlan('USII'), null);
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)], { USII: 4000 });
	t.eq('home lineup stale -> nothing', w.bossHop.prepPlan('USII'), null);
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)]);
	w.bossHop.schedAt = NOW - 10 * 60 * 1000;
	t.eq('our own fetch stale -> nothing', w.bossHop.prepPlan('USII'), null);
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)], { ASIAI: 4000 });
	t.eq('the TARGET shard\'s lineup stale -> not that one', w.bossHop.prepPlan('USII'), null);
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)]);
	w.CONFIG.bossHop.preposition.enabled = false;
	t.eq('toggle off -> nothing', w.bossHop.prepPlan('USII'), null);
} },

{ name: 'preposition: what qualifies - explicit rank, eligible, live status', fn(t) {
	const NOW = Date.now();
	const w = prepWorld({ alsoFor: ['crabxx', 'icegolem'] });
	feed(w, [row('ASIAI', 'icegolem', NOW + 100000, 2400)]);
	t.eq('icegolem has no explicit rank -> not prepositioned for', w.bossHop.prepPlan('USII'), null);
	feed(w, [row('ASIAI', 'crabxx', NOW + 100000, 2400)]);
	t.eq('precondition: crabxx at the same time IS', w.bossHop.prepPlan('USII') && w.bossHop.prepPlan('USII').event, 'crabxx');
	feed(w, [row('ASIAI', 'crabxx', NOW + 100000, 2400, 'missed')]);
	t.eq('a missed occurrence is not', w.bossHop.prepPlan('USII'), null);
	feed(w, [row('ASIAI', 'crabxx', NOW + 100000, 2400)]);
	w.bossState.cooldown['crabxx|ASIAI'] = NOW + 600000;
	t.eq('a shard we gave up on is not', w.bossHop.prepPlan('USII'), null);
	w.bossState.cooldown = {};
	w.CONFIG.bossEvents.exclude = new Set(['crabxx']);
	t.eq('an excluded event is not - bossEligible is the gate', w.bossHop.prepPlan('USII'), null);
} },

{ name: 'preposition: rank, then home, then where we stand, then earliest', fn(t) {
	const NOW = Date.now();
	const w = prepWorld({ alsoFor: ['crabxx', 'franky', 'graveyard'] });
	feed(w, [row('ASIAI', 'crabxx', NOW + 100000, 2400), row('USII', 'crabxx', NOW + 100000, 2400)]);
	t.eq('equal rank on home -> home (the "not on home" half)', w.bossHop.prepPlan('EUI').shard, 'USII');
	feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540), row('USII', 'graveyard', NOW + 60000, 600)]);
	t.eq('a better rank off home beats a worse one on home', w.bossHop.prepPlan('USII').shard, 'ASIAI');
	feed(w, [row('EUI', 'crabxx', NOW + 100000, 2400), row('EUII', 'crabxx', NOW + 100000, 2400)]);
	t.eq('two equal shards off home -> the one we are on', w.bossHop.prepPlan('EUII').shard, 'EUII');
	t.eq('and from neither, deterministically by name', w.bossHop.prepPlan('ASIAI').shard, 'EUI');
	feed(w, [row('EUI', 'franky', NOW + 100000, 2400), row('EUII', 'crabxx', NOW + 100000, 2400)]);
	t.eq('franky (2) beats crabxx (3)', w.bossHop.prepPlan('USII').event, 'franky');
} },

{ name: 'holdRank: a plan here, or an event trip live here', fn(t) {
	const NOW = Date.now();
	const w = prepWorld();
	t.eq('nothing -> null', w.bossHop.holdRank('USII', null), null);
	t.eq('a plan here -> its rank', w.bossHop.holdRank('USII', { shard: 'USII', rank: 3 }), 3);
	t.eq('a plan elsewhere -> null', w.bossHop.holdRank('USII', { shard: 'EUI', rank: 3 }), null);
	w.bossState.trip = { name: 'graveyard', shard: 'USII' };
	w.parent.S.graveyard = { live: true };
	t.eq('a live graveyard trip here -> its rank, 5', w.bossHop.holdRank('USII', null), 5);
	t.eq('the better of the two', w.bossHop.holdRank('USII', { shard: 'USII', rank: 3 }), 3);
	w.parent.S.graveyard = { live: false };
	t.eq('its event over -> null', w.bossHop.holdRank('USII', null), null);
	w.bossState.trip = { name: 'goobrawl', shard: 'USII' };
	w.parent.S.goobrawl = { end: NOW + 100000 };
	t.eq('goobrawl by PRESENCE, as bossEntryLive reads it -> 3', w.bossHop.holdRank('USII', null), 3);
	t.eq('a trip on another shard does not hold this one', w.bossHop.holdRank('EUI', null), null);
	/* v132/v133 held on a bossHop TARGET's trip too, which blocked the
	   equal-ranked hop to the same boss elsewhere - the horseman chain. */
	w.CONFIG.bossHop.targets.push({ mtype: 'horseman', kills_to_rung: 70 });
	w.bossState.trip = { name: 'horseman', shard: 'USII' };
	w.parent.S.horseman = { live: true };
	t.eq('a trip on a bossHop target does not hold - FIGHTING/localTarget own it', w.bossHop.holdRank('USII', null), null);
	w.CONFIG.bossHop.targets.pop();
	t.eq('precondition: the same trip, horseman not a target, does', w.bossHop.holdRank('USII', null), 5);
} },

{ name: 'goHomeIfIdle: an event fight here is not "nothing eligible"', fn(t) {
	const go = (withTrip) => {
		const w = prepWorld({ region: 'EU', id: 'III' });
		const hops = [];
		w.bossHop.lootBeforeHop = async () => false;
		w.bossHop.changeServer = async (s, m) => { hops.push(s + '/' + m); return true; };
		if (withTrip) { w.bossState.trip = { name: 'graveyard', shard: 'EUIII' }; w.parent.S.graveyard = { live: true }; }
		w.bossHop.idleSince = Date.now() - 200000;
		return w.bossHop.goHomeIfIdle('EUIII').then(() => hops);
	};
	return Promise.all([go(false), go(true)]).then(([bare, held]) => {
		t.eq('precondition: idle off home with nothing on, it goes home', bare, ['USII/home']);
		t.eq('with a graveyard live here, it stays', held, []);
	});
} },

{ name: 'tick IDLE: hop for the plan, hold on arrival, admit only a better hop', fn(t) {
	const NOW = Date.now();
	const mk = (region, id) => {
		const w = prepWorld({ region, id, alsoFor: ['franky'] });
		w.hops = [];
		w.bossHop.lootBeforeHop = async () => false;
		w.bossHop.changeServer = async (s, m) => { w.hops.push(s + '/' + m); return true; };
		w.bossHop.pickTarget = () => w.pick || null;
		w.bossHop.localTarget = () => w.here || null;
		feed(w, [row('ASIAI', 'goobrawl', NOW + 780000, 540)]);
		return w;
	};
	const a = mk('US', 'II');
	const b = mk('ASIA', 'I');
	const c = mk('ASIA', 'I');
	c.pick = { shard: 'EUI', mtype: 'crabxx', secsToDeath: 100 };
	const d = mk('ASIA', 'I');
	d.pick = { shard: 'EUI', mtype: 'franky', secsToDeath: 100 };
	const e = mk('US', 'II');
	e.here = 'goobrawl';
	const e2 = mk('US', 'II');
	e2.here = 'crabxx';
	const f = mk('US', 'II');
	f.here = 'crabxx';
	feed(f, [row('EUI', 'franky', NOW + 100000, 2400)]);
	return (async () => {
		await a.bossHop.tick();
		t.eq('from home: hops to the plan\'s shard, naming the event', a.hops, ['ASIAI/goobrawl']);
		t.ok('and says it is prepositioning', a.logs.some(l => /Prepositioning on ASIAI for goobrawl/.test(l)));

		const r1 = await b.bossHop.tick();
		await b.bossHop.tick();
		t.eq('on the shard: no hop', b.hops, []);
		t.eq('it holds', r1, 'continue');
		t.eq('and says so once, not per tick', b.logs.filter(l => /Holding on ASIAI/.test(l)).length, 1);

		await c.bossHop.tick();
		t.eq('a lower-ranked crabxx (4) elsewhere does not pull it off - 12:09Z 2026-10-25', c.hops, []);
		await d.bossHop.tick();
		t.eq('a strictly better one does', d.hops, ['EUI/franky']);

		await e.bossHop.tick();
		t.eq('a live goobrawl here beats an equal-ranked plan elsewhere', e.bossHop.state, 'FIGHTING');
		await e2.bossHop.tick();
		t.eq('a live crabxx here no longer does - goobrawl alone at 3', e2.hops, ['ASIAI/goobrawl']);
		await f.bossHop.tick();
		t.eq('but not a strictly better plan elsewhere', f.hops, ['EUI/franky']);
	})();
} },

{ name: 'refreshSchedule: shard names normalised, failure keeps rows', fn(t) {
	const w = prepWorld();
	w.bossHop.schedRows = []; w.bossHop.schedAt = 0;
	let answer = { occurrences: [
		{ server: 'ASIA I', event: 'goobrawl', at: '2026-10-24T13:00:00Z', at_ms: 1792846800000, window_sec: 540, status: 'scheduled' },
		{ server: '', event: 'crabxx', at_ms: 1 },
	], servers: { 'ASIA I': { age_sec: 12 }, 'US II': { age_sec: 30 } } };
	let fail = false;
	w.plFetch = (p) => { w.lastPath = p; return fail ? Promise.reject(new Error('down')) : Promise.resolve(answer); };
	w.bossHop.refreshSchedule();
	return Promise.resolve().then(() => Promise.resolve()).then(() => {
		t.eq('asks /schedule_live for a short horizon', w.lastPath, '/schedule_live?hours=3');
		t.eq('one usable row, shard without the space', w.bossHop.schedRows.map(r => r.shard + '/' + r.event), ['ASIAI/goobrawl']);
		t.eq('at is the epoch ms', w.bossHop.schedRows[0].at, 1792846800000);
		t.eq('server ages keyed the same way', w.bossHop.schedServers.USII && w.bossHop.schedServers.USII.ageSec, 30);
		const at = w.bossHop.schedAt;
		fail = true;
		w.bossHop.refreshSchedule();
		return new Promise(r => setTimeout(r, 5)).then(() => {
			t.eq('a failed poll keeps the rows', w.bossHop.schedRows.length, 1);
			t.eq('and does not advance schedAt, so they age out instead', w.bossHop.schedAt, at);
			t.ok('and records why', /down/.test(w.bossHop.schedErr || ''));
		});
	});
} },

{ name: 'preposition is wired: toggle, scan interval, home guard, feature probe', fn(t) {
	const src = require('fs').readFileSync(require('path').join(require('./lift').ROOT, RANGER), 'utf8');
	t.ok('TOGGLES carries the flag with its CONFIG annotation',
		/bossHopPreposition:\s+true,\s+\/\/ CONFIG\.bossHop\.preposition\.enabled/.test(src));
	t.ok('CONFIG reads it', /enabled: TOGGLES\.bossHopPreposition,/.test(src));
	t.ok('the 30s interval refreshes the schedule', /this\.refreshTerminal\(\); this\.refreshSchedule\(\); \}, 30000\)/.test(src));
	const gh = src.slice(src.indexOf('\tasync goHomeIfIdle(cur) {'), src.indexOf('\tasync lootBeforeHop()'));
	t.ok('goHomeIfIdle consults the hold', /this\.holdRank\(cur, this\.prepPlan\(cur\)\) !== null/.test(gh));
	t.ok('prepStatus is on the feature probe', /prepStatus: typeof prepStatus,/.test(src));
} },
{ name: 'v140 the leader beats on its own timer, notes dedupe per message, errors read', fn(t) {
	const FILES = [RANGER, 'Party/Priest.js', 'Party/Mage.js'];
	const fs = require('fs'), path = require('path'), ROOT = require('./lift').ROOT, { extract } = require('./lift');
	for (const n of ['bossNote', 'bossThrew', 'bossBeat', 'safeSmartMove', 'rageBlockKey', 'rageViaStaging', 'rageStuckTown', 'rageTownOnCall']) {
		const r = extract(RANGER, n);
		for (const f of FILES.slice(1)) t.eq(f + ': ' + n + ' is the ranger’s, byte for byte', extract(f, n) === r, true);
	}
	for (const f of FILES) {
		const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
		t.ok(f + ': the beat has its own timer', /\nsetInterval\(bossBeat, BOSS_BEAT_MS\);\n/.test(s));
		t.ok(f + ': handleEvents logs through bossThrew', /bossTick\(\)\.catch\(bossThrew\);/.test(s));
		t.ok(f + ': on_cm routes ragetown', /if \(data\.message === 'ragetown'\) \{ rageTownOnCall\(name, data\); return; \}/.test(s));
		t.eq(f + ': the refusal is not echoed by the approach', /rageLog\('boss approach blocked/.test(s), false);
		t.ok(f + ': BOSS_BEAT_MS is inside the followers’ trust', Number((/const BOSS_BEAT_MS = (\d+)/.exec(s) || [])[1]) * 2 < Number((/leaderTrustMs: (\d+)/.exec(s) || [])[1]));
	}

	/* THE BEAT. */
	const bw = (me, trip) => {
		const sent = [];
		const w = world({ character: { name: me }, CONFIG: { bossEvents: { leaderName: 'Dexon' }, party: { groupMembers: ['Dexon', 'FatherToken', 'MageofOz'] } },
			plSend: (to, d) => sent.push(to + ':' + d.message + ':' + (d.name || d.on)), rageEntryActive: true });
		lift(w, RANGER, ['bossState', 'bossIsLeader', 'bossBroadcast', 'bossRecast', 'rageEntryBroadcast', 'bossBeat']);
		w.BOSS_RECAST_MS = 8000;
		w.bossState.trip = trip;
		w.sent = sent;
		return w;
	};
	let w = bw('Dexon', { name: 'graveyard' });
	w.bossBeat();
	t.eq('the leader on a trip re-sends the trip and the rage-entry state', w.sent.slice().sort(),
		['FatherToken:boss:graveyard', 'FatherToken:rageentry:true', 'MageofOz:boss:graveyard', 'MageofOz:rageentry:true']);
	w = bw('MageofOz', { name: 'graveyard' }); w.bossBeat();
	t.eq('a follower says nothing', w.sent.length, 0);
	w = bw('Dexon', null); w.bossBeat();
	t.eq('no trip, nothing', w.sent.length, 0);

	/* NOTES: two alternating messages each say once per trip. */
	const nw = world({ bossState: { trip: { startedAt: 1 }, lastNote: null } });
	nw.logs2 = []; nw.bossLog = (m) => nw.logs2.push(m);
	lift(nw, RANGER, ['bossNote', 'bossThrew', 'errText']);
	/* `const X = new Map()` is the non-liftable initialiser this repo records -
	   supplied here and pinned from the source text. */
	const rs = fs.readFileSync(path.join(ROOT, RANGER), 'utf8');
	t.ok('PRECONDITION: the two maps and the window are what the fixture supplies',
		/const BOSS_NOTE_MS = 120000;\nconst bossNoteSeen = new Map\(\);/.test(rs) && /const bossThrewSeen = new Map\(\);/.test(rs));
	nw.bossNoteSeen = new Map(); nw.bossThrewSeen = new Map();
	nw.BOSS_NOTE_MS = 120000;
	for (let i = 0; i < 50; i++) { nw.bossNote('A'); nw.bossNote('B'); }
	t.eq('PRECONDITION-free: 100 alternating notes log twice', nw.logs2, ['A', 'B']);
	nw.bossState.trip = { startedAt: 2 };
	nw.bossNote('A');
	t.eq('a new trip says it again', nw.logs2.length, 3);
	nw.bossThrew({ reason: 'Path not found' }); nw.bossThrew({ reason: 'Path not found' });
	t.eq('a rejection reads by its reason, once a minute', nw.logs2.slice(3), ['tick threw: Path not found']);
} },

{ name: 'v140 a refused route is remembered, tried via the spawn, and two in a row use town', fn(t) {
	const mk = (o) => {
		o = o || {};
		const w = world({ character: { name: o.me || 'Dexon', map: 'spookytown', x: 290, y: -990, real_x: 290, real_y: -990 },
			CONFIG: { bossEvents: { leaderName: 'Dexon' }, party: { groupMembers: ['Dexon', 'FatherToken', 'MageofOz', 'Meltymerch'] } } });
		w.calls = []; w.sent = []; w.towns = 0;
		w.rageCfg = () => ({ enabled: true, margin: 4 });
		w.rageBoxes = () => [{ r: [-124, -1631, 614, -1130] }];
		w.rageClips = () => true;
		w.rageStaging = () => o.stage === undefined ? { x: 0, y: 0 } : o.stage;
		w.rageWalk = async (map, p) => { w.calls.push(Math.round(p.x) + ',' + Math.round(p.y)); const ok = (o.walk || (() => false))(p); if (ok) { w.character.x = p.x; w.character.y = p.y; } return ok; };
		w.smart_move = async () => true;
		w.rageLog = (m) => w.calls.push('log:' + m);
		w.rageAttackersOnMe = () => o.attackers || 0;
		w.plSend = (to, d) => w.sent.push(to + ':' + d.message);
		w.use_skill = async (n) => { if (n === 'use_town') w.towns++; return {}; };
		lift(w, RANGER, ['bossIsLeader', 'safeSmartMove', 'RAGE_BLOCK', 'rageBlockKey', 'rageViaStaging', 'rageStuckTown', 'rageTownOnCall']);
		w.rageBlocked = {}; w.rageTownAt = 0;
		return w;
	};
	const MRGREEN = { map: 'spookytown', x: 568, y: 920 };
	let w = mk({ walk: (p) => p.x === 0 || p.x === 568 && w.character.x === 0 });
	return w.safeSmartMove(MRGREEN).then((r) => {
		t.eq('direct fails, via the spawn succeeds', r, true);
		t.eq('the legs were direct, spawn, then mrgreen', w.calls.filter((c) => c.indexOf('log:') < 0), ['568,920', '0,0', '568,920']);
		t.eq('and a success leaves no memo', Object.keys(w.rageBlocked).length, 0);
		w = mk({ walk: () => false });
		return w.safeSmartMove(MRGREEN).then(() => null, (e) => e.message);
	}).then((why) => {
		t.eq('nothing works: refused', why, 'rage_route_blocked');
		const n = w.calls.length;
		return w.safeSmartMove(MRGREEN).then(() => null, (e) => e.message).then((why2) => {
			t.eq('asked again inside retryMs: refused without planning', [why2, w.calls.length === n].join(), 'rage_route_blocked,true');
			t.eq('one refusal is not stuck', w.towns, 0);
			for (const k in w.rageBlocked) w.rageBlocked[k].at = 0;
			return w.safeSmartMove(MRGREEN).then(() => null, () => null);
		});
	}).then(() => {
		t.eq('the second refusal in a row uses town', w.towns, 1);
		t.eq('and the leader takes the other two, never the merchant', w.sent.sort(), ['FatherToken:ragetown', 'MageofOz:ragetown']);
		t.ok('and says it once', w.calls.some((c) => /stuck - using town/.test(c)));
		for (const k in w.rageBlocked) w.rageBlocked[k].at = 0;
		return w.safeSmartMove(MRGREEN).then(() => null, () => null);
	}).then(() => {
		t.eq('not again inside townGapMs', w.towns, 1);
		w = mk({ walk: () => false, attackers: 2 });
		w.rageBlocked[w.rageBlockKey('spookytown', MRGREEN)] = { at: 0, n: 1, logged: 0 };
		return w.safeSmartMove(MRGREEN).then(() => null, () => null);
	}).then(() => {
		t.eq('not while something is on me', w.towns, 0);
		w = mk({ me: 'MageofOz' });
		w.rageTownOnCall('Dexon', { map: 'spookytown' });
		return Promise.resolve().then(() => Promise.resolve());
	}).then(() => {
		t.eq('a follower towns on the leader’s word', w.towns, 1);
		t.eq('and does not relay it', w.sent.length, 0);
		w = mk({ me: 'MageofOz' });
		w.rageTownOnCall('FatherToken', { map: 'spookytown' });
		w.rageTownOnCall('Dexon', { map: 'halloween' });
		return Promise.resolve().then(() => Promise.resolve());
	}).then(() => {
		t.eq('only the leader’s word counts, and only on my map', w.towns, 0);
	});
} },

{ name: 'v140 smaller log fixes: the boot achv tick, the priest loot line, the merchant merge line', fn(t) {
	const fs = require('fs'), path = require('path'), ROOT = require('./lift').ROOT;
	const r = fs.readFileSync(path.join(ROOT, RANGER), 'utf8');
	t.ok('PRECONDITION: mhToggle is declared below the boot call', r.indexOf('let mhToggle = null;') > r.indexOf('setTimeout(achvTickRun, 0);'));
	t.eq('so the boot tick is deferred, not inline', /^achvTickRun\(\);$/m.test(r), false);
	const p = fs.readFileSync(path.join(ROOT, 'Party/Priest.js'), 'utf8');
	t.ok('the priest loot line needs its fields', /if \(data\.opener !== undefined && data\.goldm !== undefined\) \{\n\t\t\tconsole\.log/.test(p));
	const m = fs.readFileSync(path.join(ROOT, 'Party/Merchant.js'), 'utf8');
	t.ok('the merge line is throttled', /if \(Date\.now\(\) - arbMergeSaidAt >= 600000\) \{ arbMergeSaidAt = Date\.now\(\); pLog\(m\.rows\.length/.test(m));
} },
{ name: 'v141 a buy is sent only where that item’s vendor is in reach', fn(t) {
	const FILES = [RANGER, 'Party/Priest.js', 'Party/Mage.js'];
	const fs = require('fs'), path = require('path'), ROOT = require('./lift').ROOT, { extract } = require('./lift');
	for (const n of ['vendorInReach', 'buyWhereSold', 'buyMissingPotions']) {
		const r = extract(RANGER, n);
		for (const f of FILES.slice(1)) t.eq(f + ': ' + n + ' is the ranger’s, byte for byte', extract(f, n) === r, true);
	}
	/* EVERY BARE buy() IN THE THREE FILES, counted with comments stripped:
	   the one inside buyWhereSold and the two in autoBuyPotions, which sit
	   behind atPotionVendor(). A new ungated buy fails here rather than
	   printing "Get closer" every tick in the live game. */
	const bare = (s) => {
		const code = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
		return (code.match(/(^|[^\w.$])buy\(/g) || []).length;
	};
	for (const f of FILES) {
		const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
		t.eq(f + ': three bare buy() calls and no more', bare(s), 3);
		t.ok(f + ': VENDOR_REACH sits inside the server’s 400', /\nconst VENDOR_REACH = 380;\n/.test(s));
		t.ok(f + ': the shortfall memo is what this suite supplies', /\nconst buyShortSaid = new Map\(\);\n/.test(s));
		const ab = extract(f, 'autoBuyPotions');
		t.ok(f + ': autoBuyPotions still buys only at a vendor', /if \(atPotionVendor\(\)\) \{\n\t\tif \(quantity\('hpot1'\)/.test(ab));
	}
	t.eq('the bare-buy counter sees an ungated buy', bare('x();\nbuy("a");\n// buy("b")\n/* buy("c") */\nfoo.buy("d");'), 1);

	/* THE PREDICATE. */
	const G = {
		npcs: { pots: { items: ['hpot1', 'mpot1'] }, wbartender: { items: ['hpot1', 'elixirluck'] }, thief: { items: ['licence'] } },
		maps: {
			main: { npcs: [{ id: 'pots', position: [0, 0] }, { id: 'thief', positions: [[900, 0], [2000, 0]] }] },
			winter_inn: { npcs: [{ id: 'wbartender', position: [-143, -220] }] },
		},
	};
	const vw = (map, x, y, over = {}) => {
		const bought = [];
		const w = world(Object.assign({
			G, character: { map, x, y },
			buy: (n, q) => { bought.push([n, q]); return Promise.resolve(true); },
			quantity: () => 0,
			CONFIG: { potions: { minStock: 1000 } },
			buyShortSaid: new Map(),
			VENDOR_REACH: 380,   // a brace-less const is not liftable - pinned from the source above
		}, over));
		w.bought = bought;
		lift(w, RANGER, ['vendorInReach', 'buyWhereSold', 'buyMissingPotions']);
		return w;
	};
	let w = vw('main', 379, 0);
	t.eq('379 from the pots vendor is in reach', w.vendorInReach('hpot1'), true);
	w = vw('main', 381, 0);
	t.eq('381 is not', w.vendorInReach('hpot1'), false);
	w = vw('main', 0, 0);
	t.eq('a vendor of OTHER items in reach does not count', w.vendorInReach('elixirluck'), false);
	t.eq('the item’s vendor on another map does not count', vw('winter_inn', 5000, 5000).vendorInReach('elixirluck'), false);
	t.eq('a vendor listed by positions[] is read at every spot', vw('main', 2010, 0).vendorInReach('licence'), true);
	t.eq('a map with no npcs is not in reach', vw('desertland', 0, 0).vendorInReach('hpot1'), false);

	/* THE WRAPPER. */
	w = vw('main', 0, 0);
	t.ok('in reach it returns buy()’s promise', w.buyWhereSold('hpot1', 5, 'x') instanceof Promise);
	t.eq('and buys what was asked', JSON.stringify(w.bought), '[["hpot1",5]]');
	w = vw('main', 0, 0);
	t.eq('out of reach it sends nothing', w.buyWhereSold('elixirluck', 2, 'luck elixir'), null);
	w.buyWhereSold('elixirluck', 2, 'luck elixir');
	t.eq('and no buy was made', w.bought.length, 0);
	t.eq('the shortfall is logged once, not per call', w.logs.filter((l) => l.indexOf('[buy] want elixirluck') === 0).length, 1);
	w.buyShortSaid.set('elixirluck', Date.now() - 1800001);
	w.buyWhereSold('elixirluck', 2, 'luck elixir');
	t.eq('and again after half an hour', w.logs.filter((l) => l.indexOf('[buy] want elixirluck') === 0).length, 2);
	w = vw('main', 5000, 0);
	w.buyWhereSold('hpot1', 1);
	t.eq('a caller that passes no reason is silent', w.logs.length, 0);

	/* THE TOP-UP. Dexon's "Get closer" pairs: dead away from town, respawn
	   refused on cooldown, then two buys every tick. */
	return (async () => {
		w = vw('cave', 900, 900);
		await w.buyMissingPotions();
		t.eq('away from a vendor the top-up sends nothing', w.bought.length, 0);
		w = vw('main', 50, 50);
		await w.buyMissingPotions();
		t.eq('at the vendor it buys both', JSON.stringify(w.bought), '[["hpot1",1000],["mpot1",1000]]');

		/* THE ELIXIR RULING, operator 2026-10-24: one in the elixir SLOT may be
		   used; one in the BAG is never drunk or equipped by a script, and none
		   is ever bought. Both scripts that had an elixirUsage() lose it. */
		for (const f of FILES) {
			const s = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
			t.eq(f + ': no elixirUsage', /elixirUsage/.test(s), false);
			t.eq(f + ': no script drinks an elixir from the bag', /locate_item\(\s*['"](elixir\w*|pumpkinspice)['"]/.test(s), false);
			t.eq(f + ': no script buys an elixir', /buy(WhereSold)?\(\s*['"](elixir\w*|pumpkinspice)['"]/.test(s), false);
		}
		/* THE RANGER'S OTHER BUYS go through the wrapper, with a reason. */
		const rs = fs.readFileSync(path.join(ROOT, RANGER), 'utf8');
		t.ok('the licence buy is gated', /const p = buyWhereSold\('licence', 1, 'licence'\);\n\t+if \(p\) \{ await p; slot = locate_item\("licence"\); \}/.test(rs));
		t.ok('the upgrade scroll buy is gated', /buyWhereSold\(scrollname, 1, 'upgrade'\);/.test(rs));
		t.ok('the compound scroll buy is gated', /buyWhereSold\(scrollName, 1, 'compound'\);/.test(rs));
	})();
} },
{ name: 'v142 rage entry ends with the trip, a join never pulls the party out, errors read', fn(t) {
	const FILES = [RANGER, 'Party/Priest.js', 'Party/Mage.js'];
	const fs = require('fs'), path = require('path'), ROOT = require('./lift').ROOT, { extract } = require('./lift');
	for (const n of ['rageEntryEnd', 'rageEntryExpire', 'bossJoinWanted', 'errText', 'bossBeat', 'bossThrew', 'bossApproach',
		'BOSS_FIELD_SPOTS', 'rageGuard', 'rageEscapeLadder', 'bossPick', 'bossRecast']) {
		const r = extract(RANGER, n);
		for (const f of FILES.slice(1)) t.eq(f + ': ' + n + ' is the ranger’s, byte for byte', extract(f, n) === r, true);
	}
	for (const f of FILES) {
		t.ok(f + ': bossEnd clears rage entry', /rageEntryEnd\('the trip ended'\);/.test(extract(f, 'bossEnd')));
		const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
		t.ok(f + ': the pull tick logs through errText', /ragePullTick\(\)\.catch\(e => rageLog\('pull tick threw: ' \+ errText\(e\), 'red'\)\);/.test(s));
		t.ok(f + ': BOSS_JOIN_NEAR is what this suite supplies', /\nconst BOSS_JOIN_NEAR = 1000;\n/.test(s));
	}

	/* THE FOLLOWER. 16:41 EDT: entry still on seven minutes after the trip. */
	const ew = (me, over = {}) => {
		const sent = [];
		const w = world(Object.assign({
			character: { name: me, map: 'spookytown', x: 285, y: -1025 },
			CONFIG: { bossEvents: { leaderName: 'Dexon', rageEntry: { trustMs: 15000 } }, party: { groupMembers: ['Dexon', 'FatherToken', 'MageofOz'] } },
			bossState: { trip: null },
			rageEntryActive: true, rageEntryOkSince: 5, rageEntryInSince: 5, rageEntryWindow: [[1, 6]], rageEntryHeard: { on: true, at: Date.now() - 20000 },
			plSend: (to, m) => { sent.push([to, m.message, m.on]); },
			rageLog: (m) => { w.logs.push(String(m)); },
			bossRecast: () => { sent.push(['recast']); },
		}, over));
		w.sent = sent;
		lift(w, RANGER, ['bossIsLeader', 'rageEntrySet', 'rageEntryBroadcast', 'rageEntryEnd', 'rageEntryExpire', 'bossBeat']);
		return w;
	};
	let w = ew('FatherToken');
	t.eq('precondition: no trip and the word is 20s old', [w.bossState.trip, Date.now() - w.rageEntryHeard.at > 15000], [null, true]);
	w.bossBeat();
	t.eq('the beat drops a follower’s stale entry with no trip at all', w.rageEntryActive, false);
	w = ew('FatherToken', { rageEntryHeard: { on: true, at: Date.now() - 1000 } });
	w.bossBeat();
	t.eq('a fresh word keeps it', w.rageEntryActive, true);
	w = ew('Dexon', { rageEntryHeard: null });
	w.bossBeat();
	t.eq('the leader’s own flag is not his followers’ timeout to drop', w.rageEntryActive, true);

	w = ew('Dexon');
	w.rageEntryEnd('the trip ended');
	t.eq('rageEntryEnd clears the leader’s state', [w.rageEntryActive, w.rageEntryWindow.length, w.rageEntryOkSince, w.rageEntryHeard], [false, 0, 0, null]);
	t.eq('and tells both followers OUT', JSON.stringify(w.sent), '[["FatherToken","rageentry",false],["MageofOz","rageentry",false]]');
	w = ew('MageofOz', { rageEntryHeard: { on: true, at: Date.now() } });
	w.rageEntryEnd('the trip ended');
	t.eq('a follower clears even with a fresh word, and sends nothing', [w.rageEntryActive, w.sent.length], [false, 0]);

	/* bossEnd ON A FOLLOWER - the far side of the handoff, through the path that
	   actually ended the 16:41 trips. */
	w = ew('FatherToken', {
		rageEntryHeard: { on: true, at: Date.now() },
		bossState: { trip: { name: 'graveyard', startedAt: Date.now() - 600000 }, cooldown: {}, fromLeader: null },
		bossSave: () => {}, bossLog: (m) => { w.logs.push(String(m)); }, bossBroadcast: () => {},
		CONFIG: { bossEvents: { leaderName: 'Dexon', cooldownMs: 1800000, rageEntry: { trustMs: 15000 } }, party: { groupMembers: ['Dexon', 'FatherToken', 'MageofOz'] } },
	});
	lift(w, 'Party/Priest.js', ['bossEnd', 'bossOnCall']);
	w.bossOnCall('Dexon', { name: null });
	t.eq('"the leader moved on" ends the follower’s trip', w.bossState.trip, null);
	t.eq('and takes the follower out of the box with it', w.rageEntryActive, false);

	/* THE JOIN. */
	const jw = (map, x, y, over = {}) => {
		const emitted = [], walked = [];
		const w = world(Object.assign({
			character: { name: 'Dexon', map, x, y, s: {} },
			BOSS_JOIN_NEAR: 1000, rageEntryActive: false,
			smart: { moving: false },
			bossNearestMonster: () => null, bossPosture: async () => {},
			bossNote: (m) => { w.logs.push(String(m)); },
			bossWalkTarget: () => ({ map: 'spookytown', x: 255, y: -1545 }),
			safeSmartMove: (p) => { walked.push(p); return Promise.resolve(); },
			bossTaxiWalkable: () => true,
			BOSS_FIELD_HOLD: 40,
			safeMove: async (x, y) => { walked.push({ x, y, held: true }); },
		}, over));
		w.parent.socket = { emit: (ev, d) => emitted.push([ev, d.name]) };
		w.emitted = emitted; w.walked = walked;
		lift(w, RANGER, ['BOSS_JOIN_SPOTS', 'BOSS_FIELD_SPOTS', 'bossJoinWanted', 'bossApproach']);
		return w;
	};
	t.eq('from another map it joins', jw('main', 0, 0).bossJoinWanted('graveyard'), true);
	t.eq('on spookytown 515 from the spot it does not', jw('spookytown', 255, -1545).bossJoinWanted('graveyard'), false);
	t.eq('nor inside the 200 the server skips anyway', jw('spookytown', 260, -1040).bossJoinWanted('graveyard'), false);
	t.eq('far across the same map it still does', jw('spookytown', 255, 100).bossJoinWanted('graveyard'), true);
	t.eq('never while rage entry has the party in the box', jw('main', 0, 0, { rageEntryActive: true }).bossJoinWanted('graveyard'), false);
	t.eq('on goobrawl’s own map never', jw('goobrawl', 0, 0).bossJoinWanted('goobrawl'), false);
	t.eq('to goobrawl from elsewhere, yes', jw('main', 0, 0).bossJoinWanted('goobrawl'), true);
	t.eq('an event with no join spot never', jw('main', 0, 0).bossJoinWanted('mrgreen'), false);

	return (async () => {
		let a = jw('spookytown', 255, -1545, { rageEntryActive: true });
		await a.bossApproach('graveyard');
		t.eq('in the box with nothing in view: no join is sent', a.emitted.length, 0);
		t.eq('it goes to the middle of the field instead (v144), not the Gargoyle spawn',
			JSON.stringify(a.walked), '[{"x":256,"y":-1430,"held":true}]');
		a = jw('main', 0, 0);
		await a.bossApproach('graveyard');
		t.eq('from another map the join still goes', JSON.stringify(a.emitted), '[["join","graveyard"]]');
		a = jw('goobrawl', 0, 0, { bossWalkTarget: () => null });
		await a.bossApproach('goobrawl');
		t.eq('on goobrawl with nothing in view: no join, no walk', [a.emitted.length, a.walked.length], [0, 0]);
		a = jw('spookytown', 255, -1545, { character: { name: 'Dexon', map: 'spookytown', x: 255, y: -1545, s: { hopsickness: { ms: 1 } } } });
		await a.bossApproach('graveyard');
		t.eq('hop-sick on the map: walks, never joins', [a.emitted.length, a.walked.length], [0, 1]);

		/* THE ERRORS. */
		const ew2 = world({});
		lift(ew2, RANGER, ['errText']);
		t.eq('a game rejection keeps its place', ew2.errText({ success: false, reason: 'failed', place: 'smart_move' }), 'failed {"place":"smart_move"}');
		t.eq('an Error is its message', ew2.errText(new Error('boom')), 'boom');
		t.eq('nested objects are left out', ew2.errText({ reason: 'x', data: { a: 1 }, n: 2 }), 'x {"n":2}');
		t.eq('a bare object is not [object Object]', ew2.errText({ place: 'buy' }), '{"place":"buy"}');
		t.eq('a string is itself', ew2.errText('nope'), 'nope');

		/* sbelt - the operator's word, 2026-10-24. */
		const sw = world({});
		lift(sw, RANGER, ['SCARCE_ITEM_NAMES', 'isScarceItem']);
		t.eq('the ranger keeps sbelt', sw.isScarceItem('sbelt'), true);
	})();
} },
{ name: 'v144 the field spot, the escape ladder, and an idle leader is obeyed', fn(t) {
	/* Measured 2026-10-24 22:30Z on EU III by the browser session: rage entry
	   walked all three onto the Gargoyle spawn eight seconds into wave 1;
	   Dexon then sat inside for eight minutes on "Path not found!" while
	   can_move_to to the join spot was true, and he and the mage died in the
	   box after the event. Operator's rulings: stand in the middle of the
	   field, and escape by straight line, then the join, then town. */
	const src = require('fs').readFileSync(RANGER, 'utf8');
	t.ok('the hold distance is what this suite supplies', /\nconst BOSS_FIELD_HOLD = 40;/.test(src));
	t.ok('and the ladder timings', /\nconst RAGE_ESCAPE_JOIN_WAIT_MS = 6000;/.test(src) && /\nconst RAGE_ESCAPE_TOWN_GAP_MS = 20000;/.test(src));

	/* THE FIELD SPOT. */
	const fw = (x, y, over = {}) => {
		const moved = [], walked = [];
		const w = world(Object.assign({
			character: { name: 'Dexon', map: 'spookytown', x, y, s: {} },
			rageEntryActive: true, BOSS_FIELD_HOLD: 40, BOSS_JOIN_NEAR: 1000,
			smart: { moving: false },
			bossNearestMonster: () => ({ x: 255, y: -1545 }),
			bossPosture: async (m) => { moved.push(['posture', m.x, m.y]); },
			bossNote: () => {},
			safeMove: async (px, py) => { moved.push(['field', px, py]); },
			safeSmartMove: (p) => { walked.push(p); return Promise.resolve(); },
			bossWalkTarget: () => ({ map: 'spookytown', x: 255, y: -1545 }),
			bossTaxiWalkable: () => true,
		}, over));
		w.parent.socket = { emit: () => {} };
		w.moved = moved;
		lift(w, RANGER, ['BOSS_JOIN_SPOTS', 'BOSS_FIELD_SPOTS', 'bossJoinWanted', 'bossApproach']);
		return w;
	};

	/* THE LADDER. */
	const lw = (over = {}) => {
		const logs = [], moves = [], emits = [], skills = [];
		const w = world(Object.assign({
			character: { name: 'Dexon', map: 'spookytown', x: 255, y: -1545, s: {} },
			RAGE_ESCAPE_JOIN_WAIT_MS: 6000, RAGE_ESCAPE_TOWN_GAP_MS: 20000,
			rageLog: (m) => logs.push(String(m)),
			can_move_to: () => false,
			move: async (x, y) => { moves.push([x, y]); },
			use_skill: async (n) => { skills.push(n); },
		}, over));
		w.parent.S = over.S || { graveyard: { live: true } };
		w.parent.socket = { emit: (ev, d) => emits.push([ev, d.name]) };
		lift(w, RANGER, ['BOSS_JOIN_SPOTS', 'BOSS_PRESENCE_LIVE', 'bossEntryLive', 'errText', 'rageEscapeEp', 'rageEscapeLadder']);
		Object.assign(w, { logs, moves, emits, skills });
		return w;
	};

	/* AN IDLE LEADER. */
	const pw = (fromLeader, over = {}) => {
		const w = world(Object.assign({
			character: { name: 'MageofOz' },
			CONFIG: { bossEvents: { leaderName: 'Dexon', leaderTrustMs: 20000 } },
			bossEligible: () => ({ ok: true }),
			bossLog: () => {},
		}, over));
		w.parent.S = { franky: { live: true, hp: 10, max_hp: 100 } };
		lift(w, RANGER, ['bossState', 'bossIsLeader', 'BOSS_RANK', 'BOSS_RANK_DEFAULT', 'bossRank', 'BOSS_PRESENCE_LIVE', 'bossEntryLive', 'bossLiveNames', 'bossPick']);
		w.bossState.fromLeader = fromLeader;
		return w;
	};

	return (async () => {
		let a = fw(260, -1440);
		await a.bossApproach('graveyard');
		t.eq('within the hold of the field spot it stays put - no posture, no walk', a.moved.length, 0);
		a = fw(255, -1545);
		await a.bossApproach('graveyard');
		t.eq('115 away on the spawn it walks back to the middle', JSON.stringify(a.moved), '[["field",256,-1430]]');
		a = fw(255, -1545, { rageEntryActive: false });
		await a.bossApproach('graveyard');
		t.eq('PRECONDITION of the gate: with entry off it postures as before', a.moved[0] && a.moved[0][0], 'posture');
		a = fw(0, 0, { character: { name: 'Dexon', map: 'halloween', x: 0, y: 0, s: {} } });
		await a.bossApproach('graveyard');
		t.eq('off the field map the spot does not apply', a.moved[0] && a.moved[0][0], 'posture');
		a = fw(255, -1545);
		await a.bossApproach('horseman');
		t.eq('an event with no field spot postures as before', a.moved[0] && a.moved[0][0], 'posture');

		let w = lw({ can_move_to: (x, y) => x === 255 && y === -1030 });
		t.eq('(1) a clear straight line to the join spot is taken', await w.rageEscapeLadder({ x: 255, y: -1641 }, 'failed'), 'straight');
		t.eq('and is a plain move to that spot', JSON.stringify(w.moves), '[[255,-1030]]');
		t.eq('the escape point comes first when it is clear',
			(w = lw({ can_move_to: () => true }), await w.rageEscapeLadder({ x: 255, y: -1641 }, 'failed'), JSON.stringify(w.moves)), '[[255,-1641]]');
		t.ok('the real reason is logged, not [object Object]', w.logs.some((m) => /pathfinder failed \(failed\)/.test(m)));
		w = lw();
		t.eq('(2) no straight line: the live event is joined', await w.rageEscapeLadder({ x: 255, y: -1641 }, 'failed'), 'join');
		t.eq('one join, for the graveyard', JSON.stringify(w.emits), '[["join","graveyard"]]');
		t.eq('then it waits for the teleport', await w.rageEscapeLadder({ x: 255, y: -1641 }, 'failed'), 'waiting');
		t.eq('and does not join twice', w.emits.length, 1);
		w.rageEscapeEp.joinAt = Date.now() - 7000;
		t.eq('(3) still inside after the join: town', await w.rageEscapeLadder({ x: 255, y: -1641 }, 'failed'), 'town');
		t.eq('use_town is the call', JSON.stringify(w.skills), '["use_town"]');
		t.eq('town is not re-cast inside its gap', await w.rageEscapeLadder({ x: 255, y: -1641 }, 'failed'), 'waiting');
		w = lw({ S: {} });
		t.eq('an event that has ended is not joined - straight to town', await w.rageEscapeLadder({ x: 255, y: -1641 }, 'failed'), 'town');
		t.eq('and nothing was emitted', w.emits.length, 0);
		w = lw({ use_skill: async () => { throw { reason: 'cooldown', ms: 900 }; } });
		w.rageEscapeEp.joinAt = 1;
		await w.rageEscapeLadder({ x: 0, y: 0 }, 'failed');
		t.ok('a refused town logs its reason readably', w.logs.some((m) => m === 'town refused: cooldown {"ms":900}'));
		t.ok('rageGuard resets the join on leaving and skips a town channel',
			/if \(!hit\) \{ rageEscapeEp\.joinAt = 0; return false; \}/.test(src) && /if \(character\.c && character\.c\.town\) return true;/.test(src));

		t.eq('a fresh "no boss" from the leader: the follower picks nothing', pw({ name: null, at: Date.now() }).bossPick(), null);
		t.eq('PRECONDITION: with no word at all it picks for itself', (pw(null).bossPick() || {}).src, 'own');
		t.eq('and a stale null releases it the same way', (pw({ name: null, at: Date.now() - 30000 }).bossPick() || {}).src, 'own');
		const fp = pw({ name: null, at: Date.now() });
		fp.bossState.forced = { name: 'franky', at: Date.now() };
		t.eq('a forced call still outranks the null', (fp.bossPick() || {}).src, 'command');
	})();
} },
{ name: 'v143 a boss trip is not a farm verdict - followers and Dexon both hold it', fn(t) {
	const FILES = [RANGER, 'Party/Priest.js', 'Party/Mage.js'];
	const fs = require('fs'), path = require('path'), ROOT = require('./lift').ROOT, { extract } = require('./lift');
	for (const n of ['farmVerdictHeld', 'bossBeat']) {
		const r = extract(RANGER, n);
		for (const f of FILES.slice(1)) t.eq(f + ': ' + n + ' is the ranger’s, byte for byte', extract(f, n) === r, true);
	}
	for (const f of FILES) {
		const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
		t.ok(f + ': the grace is 3 minutes', /\nconst FARM_VERDICT_GRACE_MS = 180000;\n/.test(s));
		t.ok(f + ': the busy stamp is what this suite supplies', /\nlet farmVerdictBusyAt = 0;\n/.test(s));
		t.ok(f + ': the beat keeps it current', /try \{ farmVerdictHeld\(\); \} catch \(e\) \{ \}/.test(extract(f, 'bossBeat')));
	}

	/* THE PREDICATE. */
	const hw = (over = {}) => {
		/* Both supplied, both pinned from the source above: lifting the
		   brace-less const runs on into farmVerdictHeld and declares its own
		   farmVerdictBusyAt, which the test then cannot reach. */
		const w = world(Object.assign({ bossState: { trip: null }, farmVerdictBusyAt: 0, FARM_VERDICT_GRACE_MS: 180000 }, over));
		lift(w, RANGER, ['farmVerdictHeld']);
		return w;
	};
	let w = hw();
	t.eq('no trip, never had one: not held', w.farmVerdictHeld(), false);
	w.bossState.trip = { name: 'mrgreen' };
	t.eq('on a trip: held', w.farmVerdictHeld(), true);
	w.bossState.trip = null;
	t.eq('just after: still held', w.farmVerdictHeld(), true);
	w.farmVerdictBusyAt = Date.now() - 180001;
	t.eq('three minutes after: released', w.farmVerdictHeld(), false);
	w = hw({ bossHop: { state: 'FIGHTING' } });
	t.eq('a boss hop under way holds it on the ranger', w.farmVerdictHeld(), true);
	w = hw({ bossHop: { state: 'IDLE' } });
	t.eq('an idle hop does not', w.farmVerdictHeld(), false);

	/* THE FOLLOWER - the 46 requests. On spookytown, which is also mrgreen's
	   map, earning nothing for three sampled minutes. */
	const fw = (trip) => {
		const sent = [];
		const w = world({
			home: 'booboo', mobMap: 'spookytown',
			character: { name: 'FatherToken', map: 'spookytown', xp: 500, level: 80 },
			bossState: { trip }, farmVerdictBusyAt: 0, FARM_VERDICT_GRACE_MS: 180000,
			xpTracker: { lastXp: 500, lastLevel: 80, lastCheckTime: 0, consecutiveBadSamples: 0,
				trackedHome: 'booboo', trackedMobMap: 'spookytown', arrivedAtSpot: true, assignedAt: 0, reportedUnreachable: false },
			plSend: (to, m) => { sent.push([to, m.message]); },
		});
		w.sent = sent;
		lift(w, 'Party/Priest.js', ['farmVerdictHeld', 'checkOwnXpEconomics']);
		return w;
	};
	const threeMinutes = (w) => { for (let i = 0; i < 3; i++) { w.xpTracker.lastCheckTime = Date.now() - 61000; w.checkOwnXpEconomics(); } };
	w = fw(null);
	threeMinutes(w);
	t.eq('precondition: with no trip, three flat minutes DO report', JSON.stringify(w.sent), '[["Dexon","blacklist_spot"]]');
	w = fw({ name: 'mrgreen' });
	threeMinutes(w);
	t.eq('on a mrgreen trip on the same map, nothing is reported', w.sent.length, 0);
	t.eq('and no streak builds', w.xpTracker.consecutiveBadSamples, 0);
	w.xpTracker.consecutiveBadSamples = 2;
	w.bossState.trip = null;
	w.xpTracker.lastCheckTime = Date.now() - 61000;
	w.checkOwnXpEconomics();
	t.eq('just after the trip a carried streak is dropped, not completed', [w.sent.length, w.xpTracker.consecutiveBadSamples], [0, 0]);
	const mage = extract('Party/Mage.js', 'checkOwnXpEconomics');
	t.ok('the mage carries the same guard', /if \(character\.map !== mobMap \|\| farmVerdictHeld\(\)\) \{[^}]*consecutiveBadSamples = 0;/.test(mage));

	/* DEXON - the receiver validates. */
	const rs = fs.readFileSync(path.join(ROOT, RANGER), 'utf8');
	const cm = rs.slice(rs.indexOf("data.message === 'blacklist_spot') {"));
	const held = cm.indexOf('if (farmVerdictHeld()) {'), add = cm.indexOf('addToBlacklist(data.home');
	t.ok('Dexon checks the hold before he blacklists', held > 0 && add > held);
	t.ok('and returns without blacklisting', /if \(farmVerdictHeld\(\)\) \{\n[^\n]*\n\t\t\treturn;\n\t\t\}/.test(cm.slice(held - 2)));
	const fe = extract(RANGER, 'checkFarmEconomics');
	t.ok('his own gold check holds too, before it samples', fe.indexOf('if (farmVerdictHeld()) {') > 0 && fe.indexOf('if (farmVerdictHeld()) {') < fe.indexOf('const goldGained'));
} },
{ name: 'rage pull: nothing is pulled while dead - 2026-10-25 06:30Z', fn(t) {
	return (async () => {
		for (const f of [RANGER, PRIEST_PATH, MAGE_PATH]) {
			const mk = (rip) => {
				const w = world({ character: { name: 'Dexon', map: 'spookytown', rip } });
				w.ragePull = { busy: false, lastPull: 0 };
				w.asked = 0;
				w.ragePullActive = () => { w.asked++; return false; };
				lift(w, f, ['ragePullTick']);
				return w;
			};
			const dead = mk(true);
			t.eq(f + ': dead, the tick returns false', await dead.ragePullTick(), false);
			t.eq(f + ': before asking whether a pull is wanted', dead.asked, 0);
			const alive = mk(false);
			await alive.ragePullTick();
			t.eq(f + ': precondition - alive, it does ask', alive.asked, 1);
		}
	})();
} },
];
