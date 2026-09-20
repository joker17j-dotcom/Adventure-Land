// ============================================================================
// FamilyFleet - one script, four characters, one account
// ============================================================================
// Three rangers farm and hold a shard each as stationary scouts; one merchant
// roams the rotation, runs the kiss event, and drives the account's gear
// economy through the bank.
//
// There is deliberately NO messaging between characters. They live on separate
// shards, so send_cm cannot reach them and there is no bridge relay on this
// account. Every schedule below is therefore derived from the wall clock and
// from the character's own index in CONFIG.characters - never negotiated. Two
// characters must never want the bank at the same moment, and the only way to
// guarantee that without talking is to give each a fixed slice of the hour.
//
// CHARACTER NAMES APPEAR EXACTLY ONCE, in CONFIG.characters. Adding a person
// means adding rows there and nothing else: role, bank slot and scan duties
// are all derived from that list.
// ============================================================================

const CONFIG = {

	// ---------------------------------------------------------------- roster
	// The ONLY place names appear. Order matters: it fixes each character's
	// bank window (index 0 gets :00, index 1 gets :05, and so on), which is
	// what keeps two of them from walking into the bank together.
	characters: {
		Ranger1: { role: 'ranger' },
		Ranger2: { role: 'ranger' },
		Ranger3: { role: 'ranger' },
		Merchant1: { role: 'merchant' },
	},

	bridge: 'http://127.0.0.1:8787',

	// ------------------------------------------------------------- the bank
	bank: {
		// Minutes past the hour for index 0; each later character is offset by
		// stagger. Four characters at 5 minutes apart occupy :00 :05 :10 :15,
		// leaving the rest of the hour clear.
		firstWindowMinute: 0,
		staggerMinutes: 5,
		// How long a character may consider the bank "its turn". Generous
		// enough to walk in, work and walk out; short enough that a stuck
		// character frees the slot before the next one arrives.
		windowMs: 4 * 60 * 1000,
		// Rangers deposit everything above this. The merchant's rule is the
		// mirror of it - see merchant.goldFloor.
		rangerKeepGold: 10000000,
		map: 'bank',
	},

	// ------------------------------------------------------------ the scan
	scout: {
		// Rangers hold one shard each and never hop. The merchant roams.
		scanEveryMs: 2 * 60 * 1000,     // the standing beat: go to town, scan, back out
		// While standing at the town spot - for ANY reason - scan on this beat.
		// The walk is the expensive part; once we are here a scan costs a
		// synchronous read of parent.entities plus a post.
		townScanMs: 20 * 1000,
		// How close to townSpot still counts as standing there. Used for the NPC
		// transactions only - buying, selling, upgrading, Ponty - where the range
		// is the NPC's, not ours. A plain radius is right for "am I there".
		townSpotRadius: 60,
		/* Where the stands are, as a box in world coordinates.
		
		   The scan beat runs anywhere in town, not only on the parking spot - but
		   "in town" has to mean something defensible, because `main` is also
		   where goo and crabx are farmed. A scan taken from the goo field would
		   see no stands, and an empty scan REPLACES a shard's listings on the
		   bridge: the character would wipe a full shard every two minutes from
		   the other side of the map. So the test is not "on the main map", it is
		   "can I see the whole stand region from here".
		
		   The numbers are the observed cluster padded by about 100 each way. One
		   sample put six stands inside x -147..161, y -110..92; the other session
		   was explicit that this is a snapshot rather than a stable distribution,
		   so the padding is doing real work and this is a knob, not a constant. */
		standRegion: { minX: -250, maxX: 260, minY: -210, maxY: 190 },
		/* THE TOWN SPOT. Measured and tested live by the other session against
		   game data 17083 - not derived, and not guessed from the snapshot.
		
		   It is the centre of the smallest circle enclosing Lucas, Cue, Gabriel
		   and Ponty, radius 286.05. Lucas and Ponty are 572.1 apart and form the
		   diameter; Cue and Gabriel fall inside without constraining it. So no
		   point in town beats 286 on the worst-case NPC distance.
		
		   Verified working from exactly here: buy from Gabriel (129.4), buy from
		   Lucas (286.0), upgrade at Cue (150.6), Ponty replied with 225 items
		   (286.1), and all six visible stands inside the vision box.
		
		   IF THE NPC SET CHANGES, recompute the smallest enclosing circle rather
		   than nudging this point - the binding pair may change. */
		townSpot: { map: 'main', x: -179, y: -72 },
		/* Who this spot is chosen to reach, and what for. Positions are from
		   G.maps.main.npcs and are here for the re-optimisation above, not for
		   navigation - nothing walks to them individually. */
		townNpcs: {
			scrolls:     { name: 'Lucas',   at: [-464, -96],  for: 'scroll0-2, cscroll0-2' },
			newupgrade:  { name: 'Cue',     at: [-207, -220], for: 'upgrade and compound' },
			basics:      { name: 'Gabriel', at: [-89, -165],  for: 'basic gear, and selling' },
			secondhands: { name: 'Ponty',   at: [106, -47],   for: 'secondhand listings' },
			fancypots:   { name: 'Ernis',   at: null,         for: 'potions' },
		},
		settleMs: 1500,
		maxSettlePasses: 5,
		minPostGapMs: 7000,
		postConfirmRetries: 3,
		pontyEveryMs: 10 * 60 * 1000,
		pontyTimeoutMs: 8000,
		// Logs the field names in Ponty's first reply, once per scan. Leave on
		// until prices map correctly, then turn off.
		debugPonty: true,
		// Where to stand while scanning. Empty = derive from the game's own map
		// data; the rangers use townSpot above, but the merchant roams and reads
		// the NPC anchors on whatever shard it lands on.
		scanSpots: [],
		skipServers: ['PVP'],
	},

	// ----------------------------------------------------------- the hopping
	hop: {
		// Only the merchant hops. One per hour is the user's rule.
		//
		// HOP SICKNESS - measured, and NOT what an earlier read of the server
		// source said. node/server_functions.js declares serverhop_logic TWICE
		// (lines 928 and 982). The later declaration wins, so the first one -
		// with its hop counting, four-hour window and escalating -20/-30/-40/
		// -60/-80 tiers - is dead code. The live rule is the short one:
		//
		//   arriving on a server != player.p.home, at level >= 60, off PVP
		//   -> add_condition(player, 'hopsickness'), flat, from G:
		//      luck -80, gold -80, xp -80, output -20, for 720000ms (12 min)
		//
		// There is no mild band and no tapering. Every hop away from home is the
		// full penalty. Corroborated from the live datastore (game 17083):
		// G.conditions.hopsickness carries exactly those values and that
		// duration, which only makes sense if add_condition is what applies it.
		//
		// Two consequences for this fleet:
		//   - The gate is p.home, not time-spent. Coming back to home clears it
		//     immediately, because the same function deletes the condition before
		//     deciding whether to re-add it.
		//   - The gold -80 still does NOT touch trade income. It reaches goldm,
		//     which is only ever applied to chest loot. A scouting merchant is
		//     not farming, so luck/gold/xp cost it nothing real.
		minIntervalMs: 60 * 60 * 1000,
		/* Do not hop while the bridge is unreachable.

		   A hop costs a page reload and exists to put findings somewhere. With
		   nothing to put them in, rotating is pure cost - the scans still happen
		   and still buffer, but coverage of a shard nobody can read is worth
		   nothing.

		   This account reaches the bridge through Codex/relay/bridge_relay.py,
		   so there are two things that can be down, and the guard deliberately
		   does not try to tell them apart:

		     - the relay itself: the fetch throws, connection refused;
		     - the bridge behind a live relay: the relay answers 502 with a
		       bridge-shaped body, so `!r.ok` throws in bridge.post.

		   Both end at bridge.online === false, which is the only thing this
		   needs to know. Distinguishing them would be a diagnostic nicety that
		   changes no decision.

		   The rangers are unaffected: they are parked and never hop at all. This
		   binds the roaming merchant, whose loop is not built yet. */
		requireBridgeToHop: true,
		// The one thing that DOES cost: G's own explanation says hop sickness
		// "blocks kiss rewards". So a sick merchant that walks the kiss event
		// spends the trip and collects nothing. Skip the kiss while sick rather
		// than discovering it as a silently missing reward.
		skipKissWhileSick: true,
		// Below this level the condition is never applied at all, so none of the
		// above matters. Merchants gain xp from buying and selling, so a scout
		// merchant drifts toward this on its own - the guard is written now so
		// that crossing it is a behaviour change rather than a surprise.
		sicknessMinLevel: 60,
		// set_home is the gate itself, not a cure, which makes it worth more
		// than it first looked - but server.js:4783 allows it once per 36 HOURS
		// (fail reason 'sh_time'). So it cannot follow the hop cycle. Attempted
		// opportunistically: if it takes, home moves; if it returns sh_time, we
		// note the hours and stop asking until then.
		//
		// G also says "Bean in Mainland can change your home" - an NPC route
		// distinct from the set_home call. Whether Bean shares the 36h cooldown
		// is unknown; the server source does not show a Bean re-home handler at
		// all, and that source has already proven stale here.
		trySetHome: true,
		setHomeCooldownMs: 36 * 60 * 60 * 1000,
	},

	// ------------------------------------------------------------ the ranger
	ranger: {
		// Only these two, in this order of preference. goo is the starter spot;
		// crabx is the graduation.
		spots: {
			goo:   { map: 'main', monster: 'goo' },
			crabx: { map: 'main', monster: 'crabx' },
		},
		// "Comfortably farming crabx" needs a number, so: survive the pack
		// indefinitely with headroom, and be able to kill inside a sane window.
		// Both are measured against live stats each time, not decided once.
		crabxReady: {
			minLevel: 40,
			// Incoming dps from the assumed number of attackers must leave this
			// much of our own regen+potion throughput spare.
			minSurvivalMargin: 1.5,
			maxAttackers: 3,
			// Kill a single target in at most this long, or we are not really
			// farming it, we are standing next to it.
			maxSecondsToKill: 12,
			// Re-check this often; graduate once, demote if it stops being true.
			checkEveryMs: 60 * 1000,
		},
		potions: {
			// Named here rather than written into the four places that used to
			// spell them out, because the sell pass has to know what this
			// character drinks in order not to sell it.
			hp: 'hpot1',
			mp: 'mpot1',
			hpAt: 0.55,
			mpAt: 0.35,
			buyBelow: 200,
			buyTo: 500,
		},
		// Full bag and not our bank window: park in town and scan instead of
		// dropping anything.
		freeSlotsFloor: 2,
	},

	// ---------------------------------------------------------- the merchant
	/* THE MERCHANT NEVER OPENS A STAND, AND BARELY MOVES.

	   No stand: this character is reading the market and running the account's
	   gear economy, not competing in the market. Nothing here calls open_stand
	   and nothing should - a stand would also pin it in place and make its
	   position a commitment rather than a choice.

	   Barely moves: everything it needs is reachable from scout.townSpot.
	   Lucas for scrolls, Cue for upgrades and compounds, Gabriel for basics and
	   selling, Ponty for secondhand stock, and the whole stand cluster in the
	   vision box - all from one point, measured. A character keeps its position
	   across change_server, so a merchant parked on that spot arrives on it
	   after every hop and needs no walk at all.

	   The ONLY sanctioned movement is the bank run: out to the bank map and
	   back. Anything else that moves this character is a bug, and the two
	   things that would most plausibly introduce one are walking to an NPC that
	   is already in range, and walking "back" to a spot it never left. */
	merchant: {
		// Leaving the spot is a bank trip and nothing else. Kept as a flag rather
		// than an assumption so that anything that wants to move the merchant has
		// to say so explicitly and be seen doing it.
		moveOnlyForBank: true,
		// ...and leaving the SHARD additionally requires the bridge to be
		// answering - see hop.requireBridgeToHop.
		// Mirror of bank.rangerKeepGold. Below the floor the merchant draws the
		// bank down to leaveInBank; at or above it, it withdraws nothing.
		goldFloor: 10000000,
		leaveInBank: 1000000,
		kissEvent: true,
		/* How close the featured player has to be. The live merchant uses 80
		   for the same skill; this is the same number, named here because the
		   whole kiss behaviour on this character turns on it. */
		kissRange: 80,
		/* Walk to the featured player, the way the event expects?

		   No, and this is a decision rather than an oversight. It contradicts
		   moveOnlyForBank directly - the event wants you to travel, and the
		   rule for this character is that a bank run is the only thing that
		   moves it. The movement rule wins and the kiss becomes opportunistic:
		   taken when the featured player is within reach of the town spot,
		   skipped with a line in the log when they are not.

		   Turn this on to get the live merchant's behaviour back. */
		kissMayWalk: false,
		/* Run the upgrade pass at all. A switch rather than an assumption,
		   because an upgrade spends gold on a roll whose failure cost this
		   repo has not measured - see the note above upgradePass. */
		upgrade: true,
		/* And never past this, whatever the plan asks. Tier 3 wants firebow@10
		   and pants@10; the chance tables put level 10 at about 2%, which is
		   fifty scrolls for one success and a long run of failures to find out
		   what a failure costs. Raised deliberately, once that is known. */
		upgradeMaxLevel: 7,
		// Ponty is checked before each hop. A gear-plan item is worth buying
		// only if we can pay for it AND carry it AND do not already hold
		// enough - which is why the bank contents have to survive the hop.
		ponty: { minFreeSlots: 3 },
	},

	// ------------------------------------------------------------ gear plan
	// Lifted from Merchant.js GEAR_PROGRESSION.ranger, with TIER 1 RESTORED -
	// it is commented out there because that party is past it; this account
	// starts at the bottom.
	//
	// Tier 3 is the "never sell" set. Tier levels use the same decode as the
	// merchant's LEVEL_CODES.
	gear: {
		// How many copies of a plan item bank + worn should hold between them:
		// one per character on the account that can use it.
		copiesWanted: 3,
		// The exception: compounding consumes three to make one, so an item
		// still below its target level is allowed to stack past copiesWanted.
		// Without this the cap starves the very upgrades it exists to serve.
		compoundOverstock: true,
		/* Not gear, and not the sell pass's business.

		   The sell rule is "anything the plan does not want", which is the
		   right rule for gear and catastrophic for everything else in the bag:
		   as first written it would have sold the character's own potions, the
		   compound scrolls it had just bought, and the computer it shops from.
		   Everything here is something a character buys or is given on
		   purpose, so selling it is never the answer. */
		keepItems: [
			'computer', 'supercomputer', 'tracker',
			'cscroll0', 'cscroll1', 'cscroll2',
			'scroll0', 'scroll1', 'scroll2',
		],
	},

	verbose: true,
};

// A ranger's gear plan, tier 1 through 3. Tier 1 is the block commented out in
// Merchant.js - this account needs it.
const RANGER_GEAR = [
	{
		earring1: { item: 'dexearring', level: 1, method: 'compound' }, helmet: { item: 'helmet', level: 6, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 1, method: 'compound' }, amulet: { item: 'dexamulet', level: 2, method: 'compound' },
		mainhand: { item: 'firebow', level: 5, method: 'upgrade' },     chest: { item: 'coat', level: 6, method: 'upgrade' },
		offhand: { item: 't2quiver', level: 5, method: 'upgrade' },     cape: { item: 'bcape', level: 4, method: 'upgrade' },
		ring1: { item: 'dexring', level: 2, method: 'compound' },       pants: { item: 'pants', level: 6, method: 'upgrade' },
		ring2: { item: 'dexring', level: 2, method: 'compound' },       belt: { item: 'dexbelt', level: 1, method: 'compound' },
		orb: { item: 'orbg', level: 1, method: 'compound' },            shoes: { item: 'shoes', level: 6, method: 'upgrade' },
		gloves: { item: 'gloves', level: 6, method: 'upgrade' },        elixir: null,
	},
	{
		earring1: { item: 'dexearring', level: 4, method: 'compound' }, helmet: { item: 'fury', level: 4, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 4, method: 'compound' }, amulet: { item: 'dexamulet', level: 4, method: 'compound' },
		mainhand: { item: 'firebow', level: 9, method: 'upgrade' },     chest: { item: 'coat', level: 9, method: 'upgrade' },
		offhand: { item: 't2quiver', level: 7, method: 'upgrade' },     cape: { item: 'ecape', level: 7, method: 'upgrade' },
		ring1: { item: 'cring', level: 3, method: 'compound' },         pants: { item: 'pants', level: 9, method: 'upgrade' },
		ring2: { item: 'suckerpunch', level: 0, method: 'compound' },   belt: { item: 'dexbelt', level: 3, method: 'compound' },
		orb: { item: 'orbofdex', level: 3, method: 'compound' },        shoes: { item: 'wingedboots', level: 8, method: 'upgrade' },
		gloves: { item: 'supermittens', level: 5, method: 'upgrade' },  elixir: null,
	},
	{
		earring1: { item: 'dexearring', level: 5, method: 'compound' }, helmet: { item: 'fury', level: 8, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 5, method: 'compound' }, amulet: { item: 'dexamulet', level: 5, method: 'compound' },
		mainhand: { item: 'firebow', level: 10, method: 'upgrade' },    chest: { item: 'tshirt9', level: 4, method: 'upgrade' },
		offhand: { item: 'alloyquiver', level: 9, method: 'upgrade' },  cape: { item: 'ecape', level: 9, method: 'upgrade' },
		ring1: { item: 'suckerpunch', level: 2, method: 'compound' },   pants: { item: 'pants', level: 10, method: 'upgrade' },
		ring2: { item: 'suckerpunch', level: 2, method: 'compound' },   belt: { item: 'dexbelt', level: 5, method: 'compound' },
		orb: { item: 'orbofdex', level: 5, method: 'compound' },        shoes: { item: 'wingedboots', level: 10, method: 'upgrade' },
		gloves: { item: 'supermittens', level: 6, method: 'upgrade' },  elixir: null,
	},
];

/* Every item named anywhere in tier 3. These are never sold to an NPC, at any
   level, even as junk - a tier-3 name in the bag is either progress or the
   raw material for it. Built from the plan rather than written out, so
   editing the plan cannot leave a stale sell-safe list behind. */
const NEVER_SELL = new Set(
	Object.values(RANGER_GEAR[2]).filter(Boolean).map((s) => s.item)
);

/* Everything that is not gear at all and must survive the sell pass.

   Kept separate from NEVER_SELL because they are different rules that happen
   to share an outcome: NEVER_SELL is "tier 3 is either progress or the raw
   material for it", derived from the plan and moving with it. KEEP_ITEMS is
   "the plan has no opinion about this and neither should the sell pass".
   Merging them would make the potion list look like part of the gear plan. */
const KEEP_ITEMS = new Set([
	CONFIG.ranger.potions.hp,
	CONFIG.ranger.potions.mp,
	...CONFIG.gear.keepItems,
]);

/* Which character am I, and what do I do? Everything role- and
   schedule-shaped is derived from CONFIG.characters so that adding a person is
   a one-line edit. */
function myName() {
	return character.name;
}

function myEntry() {
	return CONFIG.characters[myName()] || null;
}

function myRole() {
	const e = myEntry();
	return e ? e.role : null;
}

/* Position in the roster fixes the bank window. Object key order is insertion
   order for string keys, which is exactly the declaration order above - so the
   slot a character gets is visible by reading CONFIG.characters top to bottom,
   with no separate table to keep in step. */
function myIndex() {
	return Object.keys(CONFIG.characters).indexOf(myName());
}

/* Minutes past the hour when this character owns the bank. */
function myBankMinute() {
	const i = myIndex();
	if (i < 0) return null;
	return (CONFIG.bank.firstWindowMinute + i * CONFIG.bank.staggerMinutes) % 60;
}

function isMyBankWindow(now) {
	const minute = myBankMinute();
	if (minute === null) return false;
	const d = new Date(now || Date.now());
	const msIntoHour = d.getMinutes() * 60000 + d.getSeconds() * 1000;
	const start = minute * 60000;
	return msIntoHour >= start && msIntoHour < start + CONFIG.bank.windowMs;
}

// ============================================================================
// SCAN AND BRIDGE LAYER
// ============================================================================
// Lifted from Codex/MerchantScout.js, which is a working scout - deliberately
// with as little edited as possible, so that a behaviour difference between
// the two is a real difference rather than a transcription slip. Only the
// CONFIG paths moved (CONFIG.x -> CONFIG.scout.x) to fit this file's shape.
//
// Adventure Land has no module system: one file per code slot, so sharing by
// import is not available and duplication is the only option. The comments
// come with it; they carry the reasons, and a copy without them is a copy
// nobody can safely change.
// ============================================================================

const SS = {
	// change_server() tears the script down and re-runs it in a browser tab, so
	// anything that must outlive a hop goes through the game's own persistent
	// CODE storage rather than a module-scope variable. Namespaced per script so
	// a scout and a fleet character sharing a browser cannot tread on each other.
	get(k, dflt) {
		try { const v = get('fleet_' + k); return v === null || v === undefined ? dflt : v; }
		catch (e) { return dflt; }
	},
	set(k, v) { try { set('fleet_' + k, v); } catch (e) { } },
};

function log(msg, color) {
	if (!CONFIG.verbose) return;
	try { game_log('[fleet] ' + msg, color || '#8b98ab'); } catch (e) { console.log('[fleet]', msg); }
}

function currentShard() {
	return { region: parent.server_region, name: parent.server_identifier };
}

function shardKey(s) { return String(s.region) + String(s.name); }

/* parent.X.servers is the page's own server list. Mainframe does not expose it,
   which is the single thing that makes multi-shard work browser-only. */
function serverList() {
	const raw = parent && parent.X && parent.X.servers;
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((s) => s && !CONFIG.scout.skipServers.includes(s.name))
		.map((s) => ({ region: s.region, name: s.name }));
}

function canHop() {
	return typeof change_server === 'function' && serverList().length > 0;
}

async function goTo(spot) {
	if (!spot) return false;
	try {
		await smart_move({ map: spot.map, x: spot.x, y: spot.y });
		return true;
	} catch (e) {
		log('could not reach ' + (spot.map || '?') + ': ' + e, 'orange');
		return false;
	}
}

function npcSpot(mapName, npcId) {
	const m = parent && parent.G && parent.G.maps && parent.G.maps[mapName];
	if (!m || !Array.isArray(m.npcs)) return null;
	for (const n of m.npcs) {
		if (n && n.id === npcId && Array.isArray(n.position)) {
			return { map: mapName, x: n.position[0], y: n.position[1] };
		}
	}
	return null;
}

function deriveScanSpots() {
	if (CONFIG.scout.scanSpots.length) return CONFIG.scout.scanSpots;
	const wanted = ['fancypots', 'secondhands', 'items1', 'newupgrade', 'basics'];
	const spots = [];
	for (const id of wanted) {
		const s = npcSpot('main', id);
		if (s) spots.push(s);
	}
	if (!spots.length) {
		// Last resort: the map's own default spawn. Always exists.
		const sp = parent && parent.G && parent.G.maps && parent.G.maps.main
			&& parent.G.maps.main.spawns && parent.G.maps.main.spawns[0];
		if (sp) spots.push({ map: 'main', x: sp[0], y: sp[1] });
	}
	return spots;
}


// ------------------------------------------------------------ stand scanning
/* Read every open stand currently in view. Trade goods live in slots named
   trade1..tradeN; a player's other slots are their equipment and must not be
   mistaken for stock. */
function scanStands() {
	const out = [];
	const ents = (parent && parent.entities) || {};
	const me = myName();
	for (const id in ents) {
		const e = ents[id];
		if (!e || e.type !== 'character') continue;
		// NPCs really are in parent.entities - measured, not assumed - so exclude
		// them explicitly rather than relying on the stand check below to do it.
		// Several NPCs are themselves vendors, and nothing guarantees their shape
		// stays distinguishable from a player stand forever.
		if (e.npc) continue;
		if (e.name === me) continue;                 // our own stand is not market data
		if (!e.stand) continue;                      // stand closed = not trading
		const slots = {};
		const raw = e.slots || {};
		for (const k in raw) {
			if (k.indexOf('trade') !== 0) continue;
			const s = raw[k];
			if (!s || !s.name) continue;
			slots[k] = {
				name: s.name,
				price: s.price,
				b: !!s.b,
				q: s.q || 1,
				level: s.level || 0,
				p: s.p || null,
				stat_type: s.stat_type || null,
			};
		}
		if (!Object.keys(slots).length) continue;
		out.push({
			id: e.name || e.id || id,
			map: e.map || (character && character.map),
			x: Math.round(e.real_x != null ? e.real_x : e.x),
			y: Math.round(e.real_y != null ? e.real_y : e.y),
			slots,
		});
	}
	return out;
}

// -------------------------------------------------------------- Ponty (NPC)
/* Ponty answers the 'secondhands' socket call only while you are standing next
   to him. The reply shape has changed across game versions, so normalise
   defensively rather than trusting one layout.

   NOTE: an earlier session crashed the whole browser tab reading this through
   parent.alert(). Never do that here - every readout goes to the bridge or
   game_log, both of which are scoped to this character. */
function normalisePonty(data) {
	const list = Array.isArray(data) ? data
		: (data && Array.isArray(data.items) ? data.items : null);
	if (!list) return null;

	/* One-shot dump of the real payload shape. The price is arriving null in
	   practice, which means the field is not called "price" on this version of
	   the game (or is not sent at all and the client computes it). Rather than
	   guess, print what actually came back and map it for certain. */
	if (CONFIG.scout.debugPonty && list.length) {
		log('Ponty raw item keys: ' + Object.keys(list[0] || {}).join(', '), '#E9C46A');
		const fns = probePricingFns();
		log('pricing-ish functions on the page: ' + (fns.join(', ') || 'none found'), '#E9C46A');
		try { console.log('[scout] Ponty raw sample:', list[0], '\npricing fns:', fns); } catch (e) { }
	}

	/* Probe the plausible spellings instead of only "price". Anything
	   non-numeric stays null - a wrong price is far worse than no price,
	   because the spread tables would quote it as real profit. */
	const priceOf = (it) => {
		for (const k of ['price', 'cost', 'g', 'value', 'gold']) {
			const v = it[k];
			if (typeof v === 'number' && isFinite(v)) return v;
		}
		return gameItemValue(it);          // fall back to the client's own maths
	};

	const out = [];
	for (const it of list) {
		if (!it || !it.name) continue;
		out.push({
			name: it.name,
			level: it.level || 0,
			price: priceOf(it),
			q: it.q || 1,
			p: it.p || null,
			rid: it.rid || null,
		});
	}
	return out;
}

/* What Ponty charges, straight from the client that renders his window.

   The page can derive a LEVEL 0 price exactly - base value x buy_to_sell x
   secondhands_mult, confirmed against Dracul's Attire at 576,000 - but levelled
   items do not follow from that. Observed: Rugged Pants +1 is 1.43x its base,
   Rugged Helmet +2 is 3.08x, and Stinger +4 is only 2.21x. A +4 costing less
   than a +2 rules out any function of level alone; grade and upgrade-vs-compound
   both feed in. Rather than fit a curve to a handful of samples and quote the
   result as profit, ask the game, which is computing the exact number to paint
   "42,400 GOLD" on screen anyway.

   Function names differ across builds, so try the plausible ones and take the
   first that returns a sane number. Returns null if none exist, which leaves
   levelled items unpriced rather than wrong. */

const PRICE_FNS = [
	'calculate_item_value', 'item_value', 'calculate_value',
	'item_price', 'calculate_item_price', 'item_worth',
];
let priceFnName = null;

function gameItemValue(it) {
	/* calculate_item_value() returns what Ponty PAID for the item, not what he
	   charges - it already has buy_to_sell baked in. His asking price is that
	   times secondhands_mult. Confirmed against four independent observations:

	     throwingstars  g  72,000 -> 86,400     snowflakes  g  92,000 -> 110,400
	     mcape          g 480,000 -> 576,000    ringsj      g  24,000 ->  28,800

	   all of which are g * buy_to_sell * secondhands_mult = g * 1.2, matching
	   both the in-game display and community notes. Returning the raw value
	   would report half price and roughly double every Ponty spread. */
	const mult = (parent && parent.G && parent.G.multipliers
		&& parent.G.multipliers.secondhands_mult);
	if (typeof mult !== 'number' || !isFinite(mult)) return null;

	for (const n of PRICE_FNS) {
		const f = parent && parent[n];
		if (typeof f !== 'function') continue;
		try {
			/* Pass the whole item through, level and all. The function handles
			   level, grade and upgrade-vs-compound internally, which is the part
			   no formula derived from samples could get right. */
			const v = f(it);
			if (typeof v === 'number' && isFinite(v) && v > 0) {
				if (priceFnName !== n) {
					priceFnName = n;
					log(`pricing via parent.${n}() x${mult}`, '#7FD98A');
				}
				return Math.round(v * mult);
			}
		} catch (e) { }
	}
	return null;
}

/* One-shot listing of anything in the page that looks like a pricing helper, so
   the right name can be added above if none of the guesses land. */
function probePricingFns() {
	const found = [];
	try {
		for (const k in parent) {
			if (typeof parent[k] !== 'function') continue;
			if (/value|price|cost|worth/i.test(k)) found.push(k);
		}
	} catch (e) { }
	return found;
}

function scanPonty() {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (v) => {
			if (settled) return;
			settled = true;
			try { parent.socket.off('secondhands', onData); } catch (e) { }
			resolve(v);
		};
		const onData = (data) => finish(normalisePonty(data));
		try {
			parent.socket.on('secondhands', onData);
			parent.socket.emit('secondhands');
		} catch (e) {
			log('Ponty query failed: ' + e, 'orange');
			finish(null);
			return;
		}
		setTimeout(() => finish(null), CONFIG.scout.pontyTimeoutMs);
	});
}


async function pontyCheck() {
	const spot = npcSpot('main', 'secondhands');
	if (!spot) { log('Ponty not found in map data', 'orange'); return null; }
	/* Do not walk to him from the town spot.

	   Ponty is 286.1 away from it and answered a live query at exactly that
	   distance with 225 items, so the walk buys nothing and costs the one rule
	   this character is built around. The walk is kept for anywhere else,
	   because "anywhere else" is a character that is lost rather than parked. */
	if (!atTownSpot()) await goTo(spot);
	const items = await scanPonty();
	if (items) log(`Ponty: ${items.length} items on ${shardKey(currentShard())}`, '#5ED6A8');
	else log('Ponty returned nothing (out of range, or the call timed out)', 'orange');
	return items;
}

// ------------------------------------------------------------ bridge client

/* The bridge speaks parked/roamer. This roster speaks ranger/merchant. They
   are not the same vocabulary and must not be conflated:

   - A ranger is PARKED. It holds one shard and farms there, so it is a
     stationary scout in the bridge's sense whatever else it is doing.
   - The merchant is the ROAMER. It is the only character here that hops.

   Both are also PINNED, and that is the part with teeth. Parked scouts are
   normally reassigned greedily by score, but a ranger cannot accept an
   assignment - it is farming where it stands, and the shard is not the
   bridge's to choose. A scout that accepts a shard it will not travel to
   advertises coverage that does not exist, and roamers then skip a shard
   nobody is watching. Worse than claiming nothing.

   The same reasoning already applies to Meltymerch on the other account; the
   bridge grew its `pinned` handling for exactly this case. */
function myScoutRole() {
	return myRole() === 'merchant' ? 'roamer' : 'parked';
}

function scoutPinned() {
	// A roaming merchant chooses its own next shard from the bridge's hints, so
	// it is not pinned. Everything else here is standing still by design.
	return myScoutRole() === 'parked' ? true : undefined;
}

const bridge = {
	online: false,
	lastReply: null,

	async post(payload) {
		if (typeof fetch !== 'function') {          // sandbox with no network
			this.online = false;
			return null;
		}
		try {
			const r = await fetch(CONFIG.bridge + '/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (!r.ok) throw new Error('HTTP ' + r.status);
			const j = await r.json();
			if (!this.online) log('bridge connected', '#7FD98A');
			this.online = true;
			this.lastReply = j;
			return j;
		} catch (e) {
			if (this.online) log('bridge lost: ' + e.message, 'orange');
			this.online = false;
			return null;
		}
	},
};

// --------------------------------------------------------------- scan buffer
/* Findings not yet accepted by the bridge, BUCKETED BY SHARD.

   Keying only by merchant id was wrong: a post that failed left the stands
   buffered, and the next successful post stamped the payload with wherever the
   scout had since hopped to. Nine merchants scanned on EU I would be filed
   under US II - the bridge takes the shard from the payload, so the wrong
   attribution is what the watchlist then quotes, and acting on it means
   travelling to a shard the merchant was never on. Ponty stock had the same
   flaw. Each bucket now carries the shard it was actually observed on. */
const buffer = { shards: new Map() };

function bufferFor(shard) {
	const k = shardKey(shard);
	let e = buffer.shards.get(k);
	if (!e) { e = { shard, stands: new Map(), ponty: null }; buffer.shards.set(k, e); }
	return e;
}

function absorb(stands) {
	const e = bufferFor(currentShard());
	for (const s of stands) e.stands.set(s.id, s);
}

function absorbPonty(items) {
	bufferFor(currentShard()).ponty = items;
}

function bufferedCount() {
	let n = 0;
	for (const e of buffer.shards.values()) n += e.stands.size;
	return n;
}

/* How many stands are buffered for the shard we are standing on.

   settleScan needs THIS, not the total. Its stopping test is "the count has
   stopped growing", and with the total it counts stands held for other shards
   whose post failed - so a roamer landing on a new shard starts the test at
   five instead of zero, sees five twice, and declares the sweep settled having
   read nothing at all. It would then post an empty current shard, which is the
   one result that destroys data. */
function currentShardCount() {
	const e = buffer.shards.get(shardKey(currentShard()));
	return e ? e.stands.size : 0;
}

/* Drop what we hold for this shard, so the sweep that follows replaces it
   rather than adding to it.

   Each sweep is a COMPLETE observation of the shard - that is the contract the
   bridge is built on, and why it deletes and rewrites a shard's listings
   rather than merging. The scout's buffer has to keep the same contract, and
   it did not: absorb() only ever adds, and a bucket is cleared only when a
   post is CONFIRMED. So a stand that packed up while the bridge was
   unreachable stayed in the buffer, was re-absorbed alongside the stands that
   are still there, and went out on the next successful post as though it were
   live. Someone reading the watchlist would travel to a stand that left
   minutes ago.

   Only this shard is cleared. A roamer holding an unsent sweep of another
   shard keeps it - that is the last thing known about somewhere it cannot see
   from here, and it is not refreshable by standing still. */
function resetCurrentShardStands() {
	const e = buffer.shards.get(shardKey(currentShard()));
	if (e) e.stands.clear();
}

/* Findings the bridge has not acknowledged must outlive the hop that follows.
   reportConfirmed already refuses to clear the buffer without an
   acknowledgement, and hopTo calls it before leaving - but when the bridge is
   down that path deliberately carries the scan forward instead of discarding
   it, and "forward" was a module-scope Map that change_server destroys. A
   whole shard's sweep was lost every time the bridge blinked.

   Maps do not survive JSON, so this flattens them on the way out and rebuilds
   them on the way in. */
function saveBuffer() {
	const out = [];
	for (const e of buffer.shards.values()) {
		out.push({ shard: e.shard, stands: [...e.stands.values()], ponty: e.ponty });
	}
	SS.set('buffer', out);
}

function restoreBuffer() {
	const saved = SS.get('buffer', null);
	if (!Array.isArray(saved)) return 0;
	let n = 0;
	for (const e of saved) {
		if (!e || !e.shard) continue;
		const b = bufferFor(e.shard);
		for (const row of (e.stands || [])) { b.stands.set(row.id, row); n++; }
		if (e.ponty) b.ponty = e.ponty;
	}
	if (n) log(`restored ${n} unsent stand(s) from before the last hop`, '#E9C46A');
	return n;
}

/* When Ponty was last read, per shard. Was a local in roamerLoop, so every
   reload - which is to say every hop - forgot it, and the roamer walked to
   Ponty on arrival at every single shard rather than once every pontyEveryMs.
   Correct, but it paid for the walk each time. */
function pontySeen(key, stamp) {
	const m = SS.get('ponty_seen', {}) || {};
	if (stamp !== undefined) { m[key] = stamp; SS.set('ponty_seen', m); }
	return m[key] || 0;
}

function pontyDue(key) {
	return Date.now() - pontySeen(key) > CONFIG.scout.pontyEveryMs;
}

/* Sweep until the visible set stops growing, so a shard that is still
   streaming entities in is never read half-empty.

   The zero case is the one that matters, and it is not symmetric with the
   others. A scan reporting an empty merchants array is a real observation to
   the bridge - "nothing trading here right now" - and it REPLACES that shard's
   listings. So a freshly landed client, whose entity list has not arrived yet,
   reads zero twice in a second and a half and wipes a shard that was full.
   Zero therefore only counts once every pass has been spent. */
async function settleScan() {
	// Accumulate WITHIN a sweep, replace BETWEEN sweeps. The passes exist to let
	// a streaming entity list finish arriving; they are not a running tally
	// across visits.
	resetCurrentShardStands();
	let seen = -1;
	for (let pass = 0; pass < CONFIG.scout.maxSettlePasses; pass++) {
		absorb(scanStands());
		const n = currentShardCount();
		if (n > 0 && n === seen) return n;
		seen = n;
		await new Promise((r) => setTimeout(r, CONFIG.scout.settleMs));
	}
	const n = currentShardCount();
	if (n === 0) log(`${shardKey(currentShard())}: no stands after ${CONFIG.scout.maxSettlePasses} sweeps`, 'orange');
	return n;
}


let lastPostAt = 0;

/* Hold until minPostGapMs has passed since this scout's own last post. Per
   scout, not global - two scouts posting a second apart is fine, one scout
   posting twice in a second is noise. */
async function respectPostGap() {
	if (!lastPostAt) return;
	const since = Date.now() - lastPostAt;
	if (since >= CONFIG.scout.minPostGapMs) return;
	// Clamped, because `since` can come back negative: the wall clock moving
	// backwards under an NTP correction makes the gap look like it has not
	// started yet, and an unclamped wait becomes a number setTimeout cannot
	// hold. Never wait longer than the gap itself.
	const wait = Math.min(CONFIG.scout.minPostGapMs, CONFIG.scout.minPostGapMs - since);
	log(`holding ${(wait / 1000).toFixed(1)}s before posting (min gap)`);
	await new Promise((r) => setTimeout(r, wait));
}

/* Posts every buffered shard, each stamped with the shard it was observed on -
   never with wherever the scout happens to be standing now. A bucket is only
   cleared once the bridge acknowledges storing exactly what was sent; anything
   unconfirmed stays put, still attributed correctly, and goes out next time.

   `confirmed` is true only when every bucket landed. */
async function report(extra) {
	const buckets = [...buffer.shards.entries()];

	// Nothing seen yet: still post, so the bridge knows this scout is alive and
	// where it is, and hands back its rotation hints.
	if (!buckets.length) {
		await respectPostGap();
		const reply = await bridge.post({
			character: myName(), role: myScoutRole(), pinned: scoutPinned(),
			shard: currentShard(),
			at: new Date().toISOString(), merchants: [], ponty: null,
			...(extra || {}),
		});
		lastPostAt = Date.now();
		return { reply, confirmed: !!reply, stands: 0, ponty: 0 };
	}

	let lastReply = null, allOk = true, sent = 0;
	for (const [key, e] of buckets) {
		await respectPostGap();
		const stands = [...e.stands.values()];
		const ponty = e.ponty;
		const reply = await bridge.post({
			character: myName(), role: myScoutRole(), pinned: scoutPinned(),
			shard: e.shard,                       // where it was SEEN, not where we are
			at: new Date().toISOString(),
			merchants: stands, ponty: ponty,
			...(extra || {}),
		});
		lastPostAt = Date.now();
		lastReply = reply || lastReply;

		const acc = reply && reply.accepted;
		const ok = !!(acc && acc.merchants === stands.length
			&& acc.ponty === (ponty ? ponty.length : 0));
		if (ok) {
			buffer.shards.delete(key);            // accepted, stop carrying it
			sent += stands.length;
			log(`${stands.length} stands${ponty ? ` + ${ponty.length} Ponty items` : ''} on ${key} - confirmed`);
		} else {
			allOk = false;
			log(`${key}: not acknowledged, held for retry`, 'orange');
		}
	}
	// Keep the stored copy in step with the live buffer. Without this a bucket
	// accepted by the bridge would still be sitting in storage, and the next
	// boot would restore and resend rows that already landed.
	saveBuffer();
	return { reply: lastReply, confirmed: allOk, stands: sent, ponty: 0 };
}


/* Post, and keep resending until the bridge confirms it stored the scan. Used
   before a hop: leaving a shard with an unacknowledged scan means the data was
   collected and then quietly dropped.

   Bounded on purpose. If the bridge is simply down, the findings are already
   back in the buffer and will go out when it returns, so blocking the rotation
   forever would cost coverage and save nothing. */
async function reportConfirmed() {
	for (let i = 0; i < CONFIG.scout.postConfirmRetries; i++) {
		const r = await report();
		if (r.confirmed) return r;
		if (!r.reply) {
			log('bridge unreachable - carrying the scan forward, will send when it returns', 'orange');
			return r;
		}
		log(`post not acknowledged (${i + 1}/${CONFIG.scout.postConfirmRetries})`, 'orange');
	}
	log('giving up on confirmation for now - scan stays buffered', 'orange');
	return { reply: null, confirmed: false, stands: 0, ponty: 0 };
}

// ---------------------------------------------------------------- hop guard

// ============================================================================
// SKILLS - use what is unlocked, attempt nothing that is not
// ============================================================================
/* Driven entirely by what G declares about each skill rather than by a list
   written here. Two reasons.

   First, the requirement to honour is "high enough level AND holding the items
   that unlock it", and the item half is not knowable from a hardcoded table -
   a ranger's multi-shot needs a bow equipped, and which items count as a bow
   is G's business, not ours.

   Second, G is served from the datastore and is not in the repository, so any
   shape written down here would be a guess. This reads the fields if they are
   there and treats a field it does not recognise as "no restriction" rather
   than inventing one. The failure mode that matters is refusing to use a skill
   we could have used, which costs dps; the opposite - attempting one we cannot
   - is what produces the error spam this is here to avoid. */

function skillDef(name) {
	try { return (parent.G && parent.G.skills && parent.G.skills[name]) || null; }
	catch (e) { return null; }
}

function itemDef(name) {
	try { return (parent.G && parent.G.items && parent.G.items[name]) || null; }
	catch (e) { return null; }
}

/* G expresses "one of these" as either a bare string or an array, depending on
   the field and the game version. Normalise rather than guessing which. */
function asList(v) {
	if (v === undefined || v === null) return null;
	return Array.isArray(v) ? v : [v];
}

/* Does the equipped mainhand satisfy a skill's weapon-type requirement? A
   skill with no wtype has no weapon requirement and passes. */
function weaponAllows(def) {
	const want = asList(def.wtype);
	if (!want) return true;
	const held = character.slots && character.slots.mainhand;
	if (!held || !held.name) return false;
	const it = itemDef(held.name);
	if (!it) return false;                 // unknown item: refuse rather than assume
	return want.indexOf(it.wtype) !== -1;
}

/* Some skills name a slot that must be filled, e.g. an offhand. Expressed as a
   slot name or a list of them. */
function slotsAllow(def) {
	const want = asList(def.slot);
	if (!want) return true;
	for (const entry of want) {
		// Seen as a plain slot name, and as [slot, item] pairs. Handle both.
		const slot = Array.isArray(entry) ? entry[0] : entry;
		const item = Array.isArray(entry) ? entry[1] : null;
		const held = character.slots && character.slots[slot];
		if (!held || !held.name) return false;
		if (item && held.name !== item) return false;
	}
	return true;
}

function classAllows(def) {
	const want = asList(def.class);
	if (!want) return true;
	return want.indexOf(character.ctype) !== -1;
}

function skillOffCooldown(name) {
	try { return ms_to_next_skill(name) <= 0; } catch (e) { return true; }
}

/* The single gate. Everything that wants a skill asks this and nothing else,
   so there is one place to correct when a G field turns out to have a shape
   this does not expect. */
function skillReady(name) {
	const def = skillDef(name);
	if (!def) return false;                                   // not a skill this game knows
	if (!classAllows(def)) return false;
	if (def.level !== undefined && character.level < def.level) return false;
	if (def.mp !== undefined && character.mp < def.mp) return false;
	if (!weaponAllows(def)) return false;
	if (!slotsAllow(def)) return false;
	if (!skillOffCooldown(name)) return false;
	return true;
}

/* Skills this character will reach for, best first. Being on the list is not a
   claim that it is available - skillReady decides that every tick, so a skill
   simply starts working the moment the character out-levels or re-equips into
   it, with no edit here. */
const RANGER_ROTATION = [
	{ skill: '5shot', minTargets: 5 },
	{ skill: '3shot', minTargets: 3 },
	{ skill: 'supershot', minTargets: 1, buff: true },
	{ skill: 'huntersmark', minTargets: 1, buff: true, skipIf: (t) => !!(t.s && t.s.marked) },
];

// ============================================================================
// RANGER - farm, keep yourself alive, and be in town when the scan is due
// ============================================================================

const ranger = {
	spot: null,             // 'goo' | 'crabx'
	lastReadinessCheck: 0,
	lastScanAt: 0,
	lastTownTripAt: 0,
	parked: false,          // full bag, waiting out the clock in town
};

function monsterDef(type) {
	try { return (parent.G && parent.G.monsters && parent.G.monsters[type]) || null; }
	catch (e) { return null; }
}

/* OUR position in world space.

   character.x / character.y are NOT world coordinates on the top window -
   measured at (1147, 416) while the character actually stood at (-123, -52).
   NPC entities have .x === .real_x, so G-derived geometry never shows this and
   the discrepancy stays invisible until something cross-checks. It has already
   cost this project once: a phantom 1,307-unit trade range in the merchant,
   read from the top window's character object.

   Everything that needs our position goes through here. */
function myPos() {
	const c = character || {};
	return {
		map: c.map,
		x: c.real_x != null ? c.real_x : c.x,
		y: c.real_y != null ? c.real_y : c.y,
	};
}

/* Is an entity inside our vision?

   character.vision is [700, 500] and the test is a BOX, not a radius:
   |dx| <= 700 && |dy| <= 500. A stand 690 east is visible; one 510 north is
   not. Any distance check here would be wrong in both directions - too
   generous on the diagonal, too strict on the long axis.

   Not currently on the scan path, which reads whatever parent.entities already
   holds, but here so that anything which does need the test uses the right
   one. */
function inVision(entity) {
	const me = myPos();
	const v = (character && character.vision) || [700, 500];
	const ex = entity.real_x != null ? entity.real_x : entity.x;
	const ey = entity.real_y != null ? entity.real_y : entity.y;
	return Math.abs(ex - me.x) <= v[0] && Math.abs(ey - me.y) <= v[1];
}

/* Close enough to the parking spot to transact with the NPCs it was chosen
   for. This is the tighter of the two town tests. */
function atTownSpot() {
	const spot = CONFIG.scout.townSpot;
	const me = myPos();
	if (me.map !== spot.map) return false;
	const dx = me.x - spot.x, dy = me.y - spot.y;
	return Math.sqrt(dx * dx + dy * dy) <= CONFIG.scout.townSpotRadius;
}

/* In town, in the sense that matters for scanning: the whole stand region is
   inside our vision box, so a scan from here reads the market rather than a
   corner of it.

   Deliberately NOT "on the main map". goo and crabx are farmed on main, and a
   scan from the goo field sees no stands - which the bridge would store as
   "nothing trading on this shard", replacing a full set of listings with an
   empty one. The character would quietly wipe its own shard every couple of
   minutes. The geometry is what stops that, so it is a real guard and not
   decoration.

   Uses the box test rather than a radius for the same reason inVision does:
   vision is [700, 500] and is not circular. */
/* May the merchant change shards right now?

   Kept as a named predicate rather than an inline check because it has two
   reasons to say no and they are easy to conflate. The bridge being
   unreachable is not the same as the hop interval not having elapsed, and a
   caller that treats them as one will log the wrong reason. */
function mayHop() {
	if (!CONFIG.hop.requireBridgeToHop) return { ok: true };
	if (!bridge.online) {
		return { ok: false, reason: 'bridge unreachable - scans continue and go out when it returns' };
	}
	return { ok: true };
}

function inTown() {
	const me = myPos();
	if (me.map !== CONFIG.scout.townSpot.map) return false;
	const r = CONFIG.scout.standRegion;
	return inVision({ real_x: r.minX, real_y: r.minY })
		&& inVision({ real_x: r.maxX, real_y: r.maxY })
		&& inVision({ real_x: r.minX, real_y: r.maxY })
		&& inVision({ real_x: r.maxX, real_y: r.minY });
}

function freeSlots() {
	try { return character.esize; } catch (e) { return 0; }
}

/* Our sustained healing throughput, in hp per second.

   An estimate, and labelled as one. A ranger's sustain is potions, so this is
   potion size over potion cooldown - which ignores regeneration, party heals
   we do not have, and the fact that a potion cannot be drunk while moving out
   of range. It is deliberately conservative: the number decides whether to
   walk a character into a harder spot, and being wrong in the optimistic
   direction means dying there repeatedly. */
function healThroughput() {
	const def = itemDef(CONFIG.ranger.potions.hp);
	const heal = (def && def.gives && def.gives[0] && def.gives[0][1]) || 400;
	const cooldown = 2;     // seconds; the potion cooldown the client enforces
	return heal / cooldown;
}

function myDps() {
	return (character.attack || 0) * (character.frequency || 0);
}

/* Mitigated damage, the same shape the party's farm scorer uses so the two
   agree about what a spot costs. */
function mitigated(dps, defense) {
	const K = 900;
	return dps * (1 - (defense / (defense + K)));
}

/* Is this character comfortably able to farm crabx?

   Three questions, all answered from live stats so the verdict tracks gear and
   levels rather than being decided once at startup:
     - past the level floor,
     - the pack's incoming damage leaves the required headroom against our
       sustain,
     - and a single target dies inside a sane window, because standing next to
       something we cannot kill is not farming.

   Re-checked on a timer, and it demotes as readily as it promotes. */
function crabxReady() {
	const cfg = CONFIG.ranger.crabxReady;
	if (character.level < cfg.minLevel) return false;

	const mob = monsterDef(CONFIG.ranger.spots.crabx.monster);
	if (!mob) return false;                   // unknown monster: do not gamble

	const incoming = (mob.attack || 0) * (mob.frequency || 1) * cfg.maxAttackers;
	const sustain = healThroughput();
	if (incoming * cfg.minSurvivalMargin > sustain) return false;

	const effective = Math.max(mitigated(myDps(), mob.armor || 0), 1);
	const ttk = (mob.hp || 1) / effective;
	if (ttk > cfg.maxSecondsToKill) return false;

	return true;
}

/* Which spot we should be on right now. goo is the floor and is never gated -
   a character that cannot handle goo has bigger problems than spot selection. */
function chooseSpot() {
	const now = Date.now();
	if (ranger.spot && now - ranger.lastReadinessCheck < CONFIG.ranger.crabxReady.checkEveryMs) {
		return ranger.spot;
	}
	ranger.lastReadinessCheck = now;
	const want = crabxReady() ? 'crabx' : 'goo';
	if (want !== ranger.spot) {
		log(ranger.spot === null
			? `farming ${want}`
			: (want === 'crabx' ? 'stats now carry crabx - moving up' : 'crabx is no longer comfortable - dropping back to goo'),
			want === 'crabx' ? '#7FD98A' : '#E9C46A');
		ranger.spot = want;
	}
	return ranger.spot;
}

// ============================================================================
// RANGER - the tick
// ============================================================================
/* One claim on the character at a time. Every branch below awaits travel or a
   socket call, and without this a slow smart_move would let the next tick
   start a second one on top of it - the same mutual exclusion the merchant
   learned to need. Released in a finally so a throw cannot strand it. */
const fleetState = { busy: false, scanning: false, parkedFull: false, stuck: false, lastTownScanAt: 0 };

/* Scanning gets its own lock, separate from the movement one.

   A scan reads parent.entities and posts. It never moves the character, so it
   has no business queueing behind smart_move - and queueing behind it was
   costing every reading that could have been taken while walking across town,
   which is most of the time a character spends there. One lock of its own
   stops two scans overlapping without coupling it to travel at all.

   Taking a scan mid-walk is not just safe but slightly better: settleScan
   absorbs into a Map keyed by stand id and never removes, so passes taken from
   different positions add coverage rather than replacing it. Walking out of
   town mid-settle keeps whatever was already seen. */
async function withScanLock(fn) {
	if (fleetState.scanning) return false;
	fleetState.scanning = true;
	try { await fn(); return true; }
	finally { fleetState.scanning = false; }
}

function potionCount(name) {
	let n = 0;
	const items = (character && character.items) || [];
	for (const it of items) if (it && it.name === name) n += (it.q || 1);
	return n;
}

/* Drink when low. Cheap, synchronous, and runs every tick regardless of what
   else the character is doing - being in town for the bank is not a reason to
   die on the way. */
function useRangerPotions() {
	const cfg = CONFIG.ranger.potions;
	try {
		if (character.hp / character.max_hp <= cfg.hpAt && potionCount(cfg.hp) > 0) {
			use_skill('use_hp');
			return;
		}
		if (character.mp / character.max_mp <= cfg.mpAt && potionCount(cfg.mp) > 0) {
			use_skill('use_mp');
		}
	} catch (e) { }
}

function potionsLow() {
	const cfg = CONFIG.ranger.potions;
	return potionCount(cfg.hp) < cfg.buyBelow || potionCount(cfg.mp) < cfg.buyBelow;
}

async function buyPotions() {
	const cfg = CONFIG.ranger.potions;
	for (const kind of [cfg.hp, cfg.mp]) {
		const have = potionCount(kind);
		if (have >= cfg.buyTo) continue;
		try { await buy(kind, cfg.buyTo - have); }
		catch (e) { log(`could not buy ${kind}: ${e && e.reason ? e.reason : e}`, 'orange'); }
	}
}

/* The scan itself, wherever we happen to be standing.

   settleScan is doing real work here, not ceremony: an empty scan REPLACES a
   shard's listings on the bridge, so a read taken before the entity list has
   streamed in would wipe a shard that is full. Zero only counts once every
   settle pass is spent. */
async function doScan() {
	const found = await settleScan();

	/* An empty result is the only one that can destroy anything.

	   A non-empty scan is additive and safe to post from anywhere: absorb()
	   sets into a Map keyed by stand id and never removes, so a later pass
	   taken from further away cannot shrink what an earlier one saw. Drifting
	   out of town mid-settle costs nothing.

	   Zero is different. The bridge stores it as "nothing is trading on this
	   shard" and REPLACES the shard's listings, so a false zero wipes a full
	   market. inTown() is checked when the scan STARTS, but settling takes
	   several seconds and the character may have walked out by the end - and a
	   zero read while leaving town is exactly the false one.

	   So: a zero only goes out if we are still standing where the whole stand
	   region is visible. Otherwise it is dropped rather than buffered, because
	   a stale zero is not an observation worth keeping. */
	if (found === 0 && !inTown()) {
		log('scan came back empty from outside town - not posting it', 'orange');
		ranger.lastScanAt = Date.now();
		return null;
	}

	if (pontyDue(shardKey(currentShard()))) await pontyCheck();
	const r = await reportConfirmed();
	if (r && r.reply) bridge.lastReply = r.reply;
	saveBuffer();
	ranger.lastScanAt = Date.now();
	return r;
}

/* Every trip to town scans, whatever brought us here.

   That is the spec's rule and it is also the cheap one: the walk is the
   expensive part, the scan is a synchronous read of parent.entities plus one
   post. A character that has walked to town for potions and does not scan has
   paid for the scan and thrown it away. */
async function townTrip(reason) {
	const spot = CONFIG.scout.townSpot;
	log(`town: ${reason}`, '#8b98ab');
	if (!atTownSpot() && !(await goTo(spot))) return false;
	if (reason === 'potions') await buyPotions();
	// Compounding is a town job too - Cue is in reach from this spot, and three
	// slots becoming one is worth more than the walk we have already paid for.
	await compoundPass();
	// Force the beat: a trip made for a reason always produces a reading, even
	// if the last one was 19 seconds ago. Through the scan lock, so it cannot
	// collide with a background scan started while we were walking in.
	fleetState.lastTownScanAt = Date.now();
	await withScanLock(doScan);
	ranger.lastTownTripAt = Date.now();
	return true;
}

function scanDue() {
	return Date.now() - ranger.lastScanAt >= CONFIG.scout.scanEveryMs;
}

function bagFull() {
	return freeSlots() <= CONFIG.ranger.freeSlotsFloor;
}

/* Standing at the town spot, whatever brought us here, scan on the 20s beat.

   One rule rather than a set of them. The spec lists the occasions separately
   - potions, combining, the bank trip in and out, waiting out a full bag - but
   they are all the same situation once you are in town, and writing them as
   separate cases is how one of them ends up forgotten. In town and the beat is
   due: scan.

   In town, not on the spot. The parking spot is where the NPCs are reachable;
   scanning only needs the stands in view, which is a much larger area, and
   restricting the beat to a 60-unit circle would throw away every reading
   taken while walking through.

   Returns whether it scanned, so callers that are waiting rather than working
   can tell a tick apart from a no-op. */
async function maybeTownScan() {
	if (!inTown()) return false;
	if (Date.now() - fleetState.lastTownScanAt < CONFIG.scout.townScanMs) return false;
	if (fleetState.scanning) return false;
	fleetState.lastTownScanAt = Date.now();
	return await withScanLock(doScan);
}

/* Bag full and not our bank window yet.

   The spec's instruction is to wait in town rather than drop anything, and to
   scan while waiting - which turns dead time into the one thing this character
   can still usefully do. Nothing is sold here: selling belongs after the bank
   window, once the bank has had its pick.

   Note this deliberately does NOT walk back out to farm in between. Killing
   things with no room to loot them is how a full bag stays full while looking
   busy. */
async function parkFull() {
	if (!fleetState.parkedFull) {
		fleetState.parkedFull = true;
		log(`bag full (${freeSlots()} free) - holding in town until the bank window`, '#E9C46A');
	}
	// Walk if we need to, then scan in the same tick. Returning after the walk
	// would spend a whole tick arriving and do nothing with it, which for a
	// character whose only remaining job is scanning is the wrong trade.
	if (!atTownSpot() && !(await goTo(CONFIG.scout.townSpot))) return;
	await maybeTownScan();
}

/* Move to the farm spot and fight what is there. */
async function farmTick() {
	const spotName = chooseSpot();
	const spot = CONFIG.ranger.spots[spotName];
	if (!spot) return;

	const target = get_nearest_monster({ type: spot.monster });
	if (!target) {
		// Nothing of ours in view: walk to the pack rather than standing idle.
		if (character.map !== spot.map) { await goTo({ map: spot.map, x: 0, y: 0 }); return; }
		const anywhere = get_nearest_monster({ type: spot.monster, no_target: true });
		if (anywhere) await goTo({ map: spot.map, x: anywhere.x, y: anywhere.y });
		return;
	}

	if (!is_in_range(target)) { try { await move_toward(target); } catch (e) { } return; }
	await attackWithRotation(target);
}

/* Best available skill, then a plain attack. skillReady decides availability
   every time, so this needs no knowledge of what the character has unlocked. */
async function attackWithRotation(target) {
	const nearby = (get_entities ? get_entities({ type: 'monster', no_target: true }) : []) || [];
	const same = nearby.filter((e) => e && e.mtype === target.mtype);

	for (const step of RANGER_ROTATION) {
		if (!skillReady(step.skill)) continue;
		if (step.skipIf && step.skipIf(target)) continue;
		const pool = step.minTargets > 1 ? same.slice(0, step.minTargets) : null;
		if (pool && pool.length < step.minTargets) continue;
		try {
			await use_skill(step.skill, pool ? pool.map((e) => e.id) : target);
			return;
		} catch (e) {
			// A refused skill is information, not a crash. The gate let it
			// through, so something it cannot see said no - log once and fall
			// through to the next option rather than dropping the whole tick.
			log(`${step.skill} refused: ${e && e.reason ? e.reason : e}`, 'orange');
		}
	}
	try { await attack(target); } catch (e) { }
}

/* Priority ladder. Ordered by what cannot wait, not by what is most common. */
async function rangerTick() {
	if (character.rip) { try { await respawn(); } catch (e) { } return; }
	useRangerPotions();
	/* In town for any reason at all, keep the beat - INCLUDING while a walk is
	   in progress.

	   This deliberately sits ahead of the movement lock and is deliberately not
	   awaited. An earlier version put it behind `if (fleetState.busy) return`
	   and then took that same lock, which meant no scan ever happened during a
	   smart_move - and a smart_move is most of what a character does in town.
	   The comment claimed it was outside the lock; it was not.

	   Not awaiting it is what makes travel scanning work: the tick returns and
	   the walk continues while the scan settles in the background under its own
	   lock. The catch is load-bearing, since nothing is awaiting this to
	   surface a rejection. */
	if (inTown()) {
		maybeTownScan().catch((e) => log(`town scan failed: ${e && e.message ? e.message : e}`, 'orange'));
	}

	if (fleetState.busy) return;

	fleetState.busy = true;
	try {
		if (isMyBankWindow()) {
			fleetState.parkedFull = false;
			await bankRun();
			return;
		}
		if (fleetState.stuck) { await parkFull(); return; }
		if (bagFull()) { await parkFull(); return; }
		fleetState.parkedFull = false;

		if (potionsLow()) { await townTrip('potions'); return; }
		if (scanDue()) { await townTrip('scan due'); return; }
		await farmTick();
	} catch (e) {
		console.error('rangerTick error:', e);
	} finally {
		fleetState.busy = false;
	}
}

// ============================================================================
// GEAR - the plan, and what the account already has against it
// ============================================================================
/* The plan is three tiers deep per slot. "Progress" for a slot means the
   lowest tier whose target the character has not yet met - so a ranger wearing
   a tier-1 helmet at the tier-1 level is working on tier 2 for that slot, and
   the slots advance independently. Nothing here assumes a character is
   uniformly on one tier; in practice they never are. */

const GEAR_SLOTS = Object.keys(RANGER_GEAR[1]);   // tier 2 is fully populated

/* Every item the plan mentions, at any tier, with the tiers it appears in.
   Built once from RANGER_GEAR so the plan stays the single source of truth. */
const PLAN_INDEX = (() => {
	const idx = new Map();
	RANGER_GEAR.forEach((tier, t) => {
		for (const slot of Object.keys(tier)) {
			const spec = tier[slot];
			if (!spec) continue;
			let e = idx.get(spec.item);
			if (!e) { e = { item: spec.item, slots: new Set(), tiers: [] }; idx.set(spec.item, e); }
			e.slots.add(slot);
			e.tiers.push({ tier: t, slot, level: spec.level, method: spec.method });
		}
	});
	return idx;
})();

function isPlanItem(name) {
	return PLAN_INDEX.has(name);
}

function itemLevel(it) {
	return (it && it.level) || 0;
}

/* Does this item satisfy a plan entry? Name must match exactly; level must be
   at or above the target. A higher level than asked for still satisfies it -
   overshooting is not a reason to go looking for a replacement. */
function satisfies(it, spec) {
	if (!it || !spec) return false;
	if (it.name !== spec.item) return false;
	return itemLevel(it) >= spec.level;
}

/* The highest plan tier an item would satisfy in a slot, or -1 for none.

   Highest, not first. A tier-3 item usually also satisfies tier 2, and the
   ranger's helmet line is the clear case: tier 1 is helmet@6 while tiers 2 and
   3 are both fury. Reading the FIRST unsatisfied tier sent a character wearing
   fury@9 back to hunt a tier-1 helmet, because fury does not satisfy a spec
   that names helmet. Progress has to be measured by the best thing an item
   satisfies, never by the first thing it does not. */
function planTierOf(item, slot) {
	let best = -1;
	for (let t = 0; t < RANGER_GEAR.length; t++) {
		const spec = RANGER_GEAR[t][slot];
		if (spec && satisfies(item, spec)) best = t;
	}
	return best;
}

/* The furthest tier this slot has reached. Used for the "enough for three
   characters of the gear furthest along" rule - which is per slot, because
   that is the only reading under which it can be satisfied: a single pool of
   "three sets" across all slots is not something you can hold or act on,
   whereas three helmets is. */
function slotReachedTier(slot) {
	return planTierOf((character.slots && character.slots[slot]) || null, slot);
}

/* The slot's active goal: the next tier up from whatever it has reached.
   Returns null once tier 3 is met, which is the only "done" state there is. */
function slotGoal(slot) {
	const reached = slotReachedTier(slot);
	for (let t = reached + 1; t < RANGER_GEAR.length; t++) {
		const spec = RANGER_GEAR[t][slot];
		if (spec) return { ...spec, tier: t, slot };
	}
	return null;
}

// ---------------------------------------------------------------- inventories
function inventoryItems() {
	const out = [];
	const items = (character && character.items) || [];
	items.forEach((it, i) => { if (it && it.name) out.push({ ...it, where: 'inventory', idx: i }); });
	return out;
}

/* The bank is split across packs. Enumerate whatever packs are present rather
   than assuming how many there are - the number has changed with account
   upgrades and is not ours to hardcode. */
function bankPacks() {
	const b = (character && character.bank) || null;
	if (!b) return [];
	return Object.keys(b).filter((k) => k.indexOf('items') === 0 && Array.isArray(b[k]));
}

function bankItems() {
	const out = [];
	const b = (character && character.bank) || null;
	if (!b) return out;
	for (const pack of bankPacks()) {
		b[pack].forEach((it, i) => { if (it && it.name) out.push({ ...it, where: 'bank', pack, idx: i }); });
	}
	return out;
}

function equippedItems() {
	const out = [];
	const slots = (character && character.slots) || {};
	for (const slot of Object.keys(slots)) {
		const it = slots[slot];
		if (it && it.name) out.push({ ...it, where: 'equipped', slot });
	}
	return out;
}

/* How many copies of a named item the account holds where it counts.

   Worn and banked only - the spec's rule is about what the bank and the
   characters between them hold, and an item sitting in a bag on its way
   somewhere is in neither state yet. Counting it would let a bag in transit
   satisfy the quota and then leave with it. */
function copiesHeld(name) {
	let n = 0;
	for (const it of equippedItems()) if (it.name === name) n += (it.q || 1);
	for (const it of bankItems()) if (it.name === name) n += (it.q || 1);
	return n;
}

/* Should the bank take another of these?

   Base rule: three, one per character on the account that can use it.

   The exception matters more than it looks. Compounding consumes THREE copies
   to produce one, so a slot still below its compound target needs copies in
   flight well past the headcount - capping at three would starve the very
   upgrade the quota exists to serve, and the quota would look satisfied while
   progress stopped. Upgrade-method items have no such appetite: one is enough
   to work on, so they cap at three regardless. */
function bankWantsMore(name, extraHeld) {
	const entry = PLAN_INDEX.get(name);
	if (!entry) return false;
	/* Counted remotely, which for a character standing in the bank is the same
	   count - copiesHeldRemote uses the live bank whenever there is one and
	   only falls back to the stored snapshot when there is not. That fallback
	   is the whole reason the merchant can answer this question from a town
	   spot three shards from where it banked.

	   extraHeld is for a pass that is part-way through acquiring copies: five
	   dexrings on one Ponty list would otherwise each be measured against the
	   same starting count and all five bought. */
	const held = copiesHeldRemote(name) + (extraHeld || 0);
	if (held < CONFIG.gear.copiesWanted) return true;
	if (!CONFIG.gear.compoundOverstock) return false;

	// Is any tier that uses this item a compound target we have not reached?
	for (const use of entry.tiers) {
		if (use.method !== 'compound') continue;
		if (slotReachedTier(use.slot) < use.tier) return true;
	}
	return false;
}

// ============================================================================
// GEAR - the three decisions
// ============================================================================
/* Everything the bank window does reduces to asking these of each item:
   wear it, store it for someone else, or let it go. They are deliberately
   separate and deliberately ordered - equipping is checked first because an
   upgrade in hand is worth more than the same item in the bank, and selling
   last because it is the only irreversible one. */

/* Is `candidate` a better answer for `slot` than what is worn there?

   Measured in plan tiers first, then level within a tier. Only the plan's
   opinion counts: a higher-stat off-plan item is not an upgrade here, because
   the point of a plan shared across three characters is that they converge on
   the same items, and one that wanders off it stops being able to hand
   anything useful to the others.

   Note what this deliberately does NOT do: an item that is the NEXT tier's
   named item but not yet at its level - a raw fury@0 against a finished
   helmet@6 - is not an upgrade. Wearing it would drop the slot from reached
   tier 0 to reached nothing. It is raw material, and shouldBank sends it to
   the bank where the merchant can work on it. */
function betterForSlot(candidate, slot) {
	const planSlots = PLAN_INDEX.get(candidate.name);
	if (!planSlots || !planSlots.slots.has(slot)) return false;

	const worn = (character.slots && character.slots[slot]) || null;
	if (!worn) return true;                        // empty slot, anything on-plan beats nothing

	const mine = planTierOf(candidate, slot);
	const theirs = planTierOf(worn, slot);
	if (mine !== theirs) return mine > theirs;
	// Same tier: a higher level is progress toward the next one, but only when
	// it is the same item - levels are not comparable across item names.
	if (candidate.name !== worn.name) return false;
	return itemLevel(candidate) > itemLevel(worn);
}

/* Which slot, if any, this item should be worn in. An item can appear in more
   than one slot in the plan (two rings, two earrings), so this returns the
   first slot it actually improves rather than the first slot it belongs to. */
function slotToEquip(candidate) {
	/* The plan is a RANGER's, and this script runs on a merchant too.

	   Without this the merchant's bank window reads an empty helmet slot,
	   decides a fury is an upgrade for it, and tries to put a ranger's helmet
	   on a merchant - which the game refuses, so the whole pass stops on the
	   first item. Worse, shouldBank asks the same question: an item the
	   merchant "would equip" is one it never hands over, so the bank would
	   fill with gear it cannot use and cannot give away. */
	if (myRole() !== 'ranger') return null;
	const entry = PLAN_INDEX.get(candidate.name);
	if (!entry) return null;
	for (const slot of entry.slots) {
		if (betterForSlot(candidate, slot)) return slot;
	}
	return null;
}

/* Should this go in the bank for one of the others?

   Three conditions, all necessary: it is on the plan, it is not an upgrade for
   us right now, and the bank still wants copies of it. The middle one is what
   stops a character banking the item it is about to equip, and the last is
   what stops the bank filling with a fourth and fifth copy of something two
   characters already wear. */
/* Is this something the merchant is still part-way through?

   An item below the level the plan asks of it is raw material with work left
   in it, and the merchant is the character that does that work. It matters on
   both sides of the bank window: the merchant must not hand back what it is
   halfway through, and it should take out what it can carry on with. */
function isWorkItem(it) {
	const ceiling = planCeiling(it.name);
	if (ceiling === null) return false;
	return itemLevel(it) < Math.min(ceiling, CONFIG.merchant.upgradeMaxLevel);
}

function shouldBank(item) {
	if (!isPlanItem(item.name)) return false;
	if (slotToEquip(item)) return false;
	// The merchant keeps its work. Depositing a half-upgraded item and then
	// withdrawing it again in the same window is not a bug that breaks
	// anything, which is exactly why it would have gone unnoticed.
	if (myRole() === 'merchant' && isWorkItem(item)) return false;
	return bankWantsMore(item.name);
}

/* Should this be sold to an NPC?

   Only after the bank has had its pick, and never for tier 3 at any level -
   that is the spec's rule and it is the right one: a tier-3 name in the bag is
   either progress or the raw material for it.

   Beyond that, anything the plan mentions is spared while the bank still wants
   copies. An on-plan item the bank is full of is genuinely surplus and may
   go - otherwise a finished slot would keep accumulating copies nobody can
   use and nothing could ever be cleared. */
function shouldSell(item) {
	if (KEEP_ITEMS.has(item.name)) return false;
	if (NEVER_SELL.has(item.name)) return false;
	if (isPlanItem(item.name) && bankWantsMore(item.name)) return false;
	return true;
}

/* ---------------------------------------------------------------- upgrading

   An upgrade raises one item by one level, at Cue, using a scroll from Lucas.
   Both are in reach of the town spot, which is why this character can run the
   account's gear economy without moving.

   WHAT IS DELIBERATELY NOT PORTED from Merchant.js: its expected-cost planner,
   which weighs scroll grades against offerings using the grace tables. Every
   option it can reach for that this one cannot is the reason - offerings come
   from Garwyn at (192, -564) and scroll3 from Crun on `level2`, and both are a
   journey. With no offering and only scroll0-2 available, the choice collapses
   to "the cheapest scroll that can carry this item's grade", which is what
   compoundScrollFor already does for compounds.

   OPEN QUESTION, and the reason for upgradeMaxLevel below: what a failed
   upgrade costs. The item is at best knocked back and at worst destroyed, and
   this repo has no measurement either way - Merchant.js's tables give the
   chance of success and say nothing about the consequence of failure. Until
   that is measured, this only ever pushes an item toward a level the plan
   actually asks for, and never past it. */
const MAX_SCROLL_GRADE = 2;          // scroll3 is Crun's, on level2, out of reach

function upgradeScrollFor(item) {
	let grade = 0;
	try { grade = item_grade(item) || 0; } catch (e) { grade = 0; }
	return 'scroll' + Math.max(0, Math.min(MAX_SCROLL_GRADE, grade));
}

/* The highest level any tier of the plan asks of this item, in any slot.

   "Any slot" matters: pants appear at 6, 9 and 10 across the tiers, and a
   pair being pushed for a tier-1 character still has tier 3 as its ceiling.
   Stopping at the nearest target would park every item one tier short. */
function planCeiling(name) {
	const entry = PLAN_INDEX.get(name);
	if (!entry) return null;
	let best = null;
	for (const use of entry.tiers) {
		if (use.method !== 'upgrade') continue;
		if (best === null || use.level > best) best = use.level;
	}
	return best;
}

/* Which item to put under the scroll next.

   The lowest-level on-plan upgrade item that is still short of its ceiling.
   Lowest first because the early levels are nearly free - the chance tables
   start at .9999 for level 1 and are still above .9 at level 3 - so the same
   scroll spend moves a raw item several levels while it would buy a coin flip
   on something already at 9. */
function nextUpgradeTarget() {
	let best = null;
	for (const it of inventoryItems()) {
		const ceiling = planCeiling(it.name);
		if (ceiling === null) continue;
		const level = itemLevel(it);
		if (level >= Math.min(ceiling, CONFIG.merchant.upgradeMaxLevel)) continue;
		if (!best || level < itemLevel(best)) best = it;
	}
	return best;
}

async function tryUpgrade(item) {
	const scroll = upgradeScrollFor(item);
	let scrollIdx = findInventory(scroll);
	if (scrollIdx < 0) {
		try { await buy(scroll, 1); } catch (e) {
			log(`could not buy ${scroll} for ${item.name}: ${e && e.reason ? e.reason : e}`, 'orange');
			return false;
		}
		scrollIdx = findInventory(scroll);
		if (scrollIdx < 0) return false;
	}
	try {
		await upgrade(item.idx, scrollIdx);
		log(`upgraded ${item.name}+${itemLevel(item)} with ${scroll}`, '#7FD98A');
		return true;
	} catch (e) {
		log(`upgrade of ${item.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
		return false;
	}
}

/* Bounded, and bounded by gold as well as by count.

   An upgrade is a purchase, and this character's gold is also what pays for a
   Ponty listing that will not be there next hour. The floor is the same one
   the bank window uses: spend down to it and stop, rather than arriving at
   Ponty with an empty bag of gold and a stack of +1 pants. */
async function upgradePass(maxAttempts) {
	if (!CONFIG.merchant.upgrade) return 0;
	let done = 0;
	for (let i = 0; i < (maxAttempts || 8); i++) {
		if (character.gold <= CONFIG.merchant.leaveInBank) {
			log('out of spending gold - stopping the upgrade pass', 'orange');
			break;
		}
		const target = nextUpgradeTarget();
		if (!target) break;
		if (await tryUpgrade(target)) done++;
		else break;                            // a refusal will just repeat
	}
	return done;
}

/* Items that can be compounded right now: three identical names at an
   identical level. Compounding is what the "buy the item to do so and combine
   them to save space" rule is about - three slots become one, and the result
   is a level higher than any of them. */
function findCompoundTriples() {
	const groups = new Map();
	for (const it of inventoryItems()) {
		const key = it.name + '@' + itemLevel(it);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(it);
	}
	const out = [];
	for (const [key, list] of groups) {
		for (let i = 0; i + 2 < list.length; i += 3) {
			out.push({
				name: list[i].name,
				level: itemLevel(list[i]),
				slots: [list[i].idx, list[i + 1].idx, list[i + 2].idx],
			});
		}
	}
	return out;
}

/* The scroll a compound needs, by the item's grade. Read from the game rather
   than mapped here: grade thresholds are item data and have moved before. */
function compoundScrollFor(item) {
	let grade = 0;
	try { grade = item_grade(item) || 0; } catch (e) { grade = 0; }
	return 'cscroll' + Math.max(0, Math.min(2, grade));
}

function findInventory(name) {
	const items = (character && character.items) || [];
	for (let i = 0; i < items.length; i++) if (items[i] && items[i].name === name) return i;
	return -1;
}

/* Buy the scroll if we do not have one, then compound. Returns true if a
   compound was actually attempted, so the caller can re-read the inventory
   rather than working from a stale picture - the slot indices move. */
async function tryCompound(triple) {
	const sample = { name: triple.name, level: triple.level };
	const scroll = compoundScrollFor(sample);
	let scrollIdx = findInventory(scroll);
	if (scrollIdx < 0) {
		try { await buy(scroll, 1); } catch (e) {
			log(`could not buy ${scroll} for ${triple.name}: ${e && e.reason ? e.reason : e}`, 'orange');
			return false;
		}
		scrollIdx = findInventory(scroll);
		if (scrollIdx < 0) return false;
	}
	try {
		await compound(triple.slots[0], triple.slots[1], triple.slots[2], scrollIdx);
		log(`compounded 3x ${triple.name}+${triple.level}`, '#7FD98A');
		return true;
	} catch (e) {
		log(`compound of ${triple.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
		return false;
	}
}

/* One pass of compounding. Bounded, and re-reads between attempts because a
   successful compound renumbers every slot after the ones it consumed. */
async function compoundPass(maxAttempts) {
	let done = 0;
	for (let i = 0; i < (maxAttempts || 8); i++) {
		const triples = findCompoundTriples();
		if (!triples.length) break;
		if (await tryCompound(triples[0])) done++;
		else break;                                // a failure will just repeat
	}
	return done;
}

// ============================================================================
// THE BANK WINDOW
// ============================================================================
/* Four minutes, one character at a time, and the window is the only thing
   keeping two of them out of the bank at once - so every phase below re-checks
   it and stops rather than overrunning. Overrunning is not a slow bank trip,
   it is two characters in the bank.

   Order is deliberate and is not the order the spec lists them in:

     1. gold, because it is unconditional and cannot fail for want of space
     2. equip what we are already carrying - this changes what counts as an
        upgrade for everything after it, so doing it later would make the
        withdraw step ask the wrong question
     3. deposit spares, which FREES slots
     4. withdraw upgrades, which NEEDS them

   Doing 4 before 3 is the obvious ordering and the wrong one: a full bag
   cannot accept the item it came for. */

/* Each phase re-reads between operations rather than working from a list it
   built at the start, and is a bounded loop rather than a for-each over a
   snapshot.

   Not because the slots renumber - the bag and the bank packs are sparse
   arrays and a removed item leaves a null, so indices are stable. Because the
   operations are async against the game's own live state: anything can change
   under an await, an index read before one is an index that was true then, and
   a loop that keeps asking cannot act on a stale answer. The bound is what
   stops it asking forever when the answer never changes. */
const BANK_MAX_OPS = 30;

function bankWindowOpen() {
	return isMyBankWindow();
}

async function bankDepositGold() {
	const keep = CONFIG.bank.rangerKeepGold;
	if (character.gold <= keep) return 0;
	const amount = character.gold - keep;
	try {
		await bank_deposit(amount);
		log(`banked ${amount} gold`, '#7FD98A');
		return amount;
	} catch (e) {
		log(`bank_deposit failed: ${e && e.reason ? e.reason : e}`, 'red');
		return 0;
	}
}

/* Wear anything in the bag that improves a slot. Done before the bank is
   touched at all, because what we are wearing decides what the bank is asked
   for - ask first and we would withdraw a second copy of something already in
   our hand. */
async function bankEquipFromInventory() {
	let done = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		let found = null;
		for (const it of inventoryItems()) {
			const slot = slotToEquip(it);
			if (slot) { found = { it, slot }; break; }
		}
		if (!found) break;
		try {
			await equip(found.it.idx, found.slot);
			log(`equipped ${found.it.name}${itemLevel(found.it) ? '+' + itemLevel(found.it) : ''} to ${found.slot}`, '#7FD98A');
			done++;
		} catch (e) {
			log(`equip ${found.it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;             // a refusal will just repeat; stop rather than spin
		}
	}
	return done;
}

/* Hand the others what we are not using. shouldBank already refuses anything
   we would wear and anything the bank has enough of. */
async function bankDepositSpares() {
	let done = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		const it = inventoryItems().find(shouldBank);
		if (!it) break;
		try {
			await bank_store(it.idx);
			log(`banked ${it.name}${itemLevel(it) ? '+' + itemLevel(it) : ''}`, '#7FD98A');
			done++;
		} catch (e) {
			log(`bank_store ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
	}
	return done;
}

/* Take out anything the others left that beats what we are wearing.

   Needs a free slot, so it runs after the deposit pass. The floor is the same
   one the farm loop uses: leaving with a bag at the brim means the next kill
   has nowhere to go, and the whole point of the window is to leave with room.

   Each item is worn as it comes out, inside the loop rather than in one pass
   afterwards. That is not tidiness - it is what lets a character with three
   free slots collect five upgrades. An item put on vacates the bag slot it
   arrived in, so withdraw-then-equip returns the slot before the next
   iteration asks for one; withdrawing everything first would stop at the floor
   with the rest still in the bank and nothing wrong reported.

   The floor check therefore only bites when an item comes out and STAYS in the
   bag - which means equip refused it. That is exactly when stopping is right,
   and it is why the guard is at the top of the loop rather than gone. */
async function bankWithdrawUpgrades() {
	let done = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		if (freeSlots() <= CONFIG.ranger.freeSlotsFloor) {
			log('no room to withdraw more - leaving the rest for next window', 'orange');
			break;
		}
		const it = bankItems().find((b) => slotToEquip(b));
		if (!it) break;
		try {
			await bank_retrieve(it.pack, it.idx);
			log(`withdrew ${it.name}${itemLevel(it) ? '+' + itemLevel(it) : ''} from ${it.pack}`, '#7FD98A');
			done++;
		} catch (e) {
			log(`bank_retrieve ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
		await bankEquipFromInventory();
	}
	return done;
}

/* Sell what is left, to Gabriel, from the town spot.

   AFTER the bank, never before. The bank gets first refusal on everything,
   because a spare the others can use is worth more in the bank than it is as
   gold - and once it is sold that judgement cannot be revisited. shouldSell
   guards it twice: never a tier-3 name at any level, and never an on-plan item
   the bank still wants.

   NOTE, untested: Gabriel is 129 units from the town spot and `buy` from him
   has been verified working at that distance. `sell` has not. If the first
   live run refuses here, the range for selling is the thing to check before
   anything else. */
async function sellSurplus() {
	let sold = 0;
	for (let i = 0; i < BANK_MAX_OPS; i++) {
		const it = inventoryItems().find(shouldSell);
		if (!it) break;
		try {
			await sell(it.idx, it.q || 1);
			sold++;
		} catch (e) {
			log(`sell ${it.name} failed: ${e && e.reason ? e.reason : e} - stopping`, 'orange');
			break;
		}
	}
	if (sold) log(`sold ${sold} surplus item(s)`, '#7FD98A');
	return sold;
}

/* Everything has been tried and the bag is still full.

   The bank would not take it, it is not sellable - which for this plan means
   it is tier-3 material, or on-plan and still wanted - and there is nowhere
   left to put it. Farming from here would loot into a bag with no room, so the
   character stops and says so rather than pretending to work.

   It keeps scanning, because that is the one thing it can still do that has
   value, and it is the reason this is a park rather than a halt. */
function stuckFull() {
	if (!fleetState.stuck) {
		fleetState.stuck = true;
		log(`bag still full after the bank window (${freeSlots()} free) - `
			+ `nothing left to bank or sell. Holding in town and scanning until `
			+ `someone looks at it.`, 'red');
	}
}

/* The window, start to finish. */
async function bankRun() {
	// Scan before leaving town - the bank is its own map, so once we are through
	// the door there is nothing to see until we come back out.
	await withScanLock(doScan);
	if (!(await goTo({ map: CONFIG.bank.map, x: 0, y: -100 }))) {
		log('could not reach the bank this window', 'orange');
		return;
	}

	await bankDepositGold();

	// character.bank is only populated while standing in it, so everything that
	// reads the bank has to happen here and cannot be deferred.
	if (!character.bank) {
		log('in the bank map but character.bank is not readable - gold only this window', 'orange');
	} else {
		const worn = await bankEquipFromInventory();
		const given = await bankDepositSpares();
		const taken = await bankWithdrawUpgrades();
		if (worn || given || taken) {
			log(`gear pass: equipped ${worn}, banked ${given}, withdrew ${taken}`, '#7FD98A');
		}
	}

	saveBankSnapshot();
	await townTrip('bank window, on the way out');
	await sellSurplus();

	if (bagFull()) stuckFull();
	else fleetState.stuck = false;
}

// ============================================================================
// THE MERCHANT
// ============================================================================
/* One character, three jobs, and a standing rule that shapes all of them: it
   does not move.

   The town spot reaches Lucas, Cue, Gabriel and Ponty, and the whole stand
   cluster is inside the vision box from there - so scanning, shopping,
   upgrading and selling are all things this character does standing still.
   Position survives change_server, so it arrives on the spot after every hop
   with no walk at all. The bank run is the only sanctioned exception.

   It does not open a stand. Nothing here calls open_stand. */

/* Are we carrying hop sickness right now?

   Worth a named helper rather than an inline check, because the condition is
   easy to reason about wrongly. The live rule - node/server_functions.js
   declares serverhop_logic twice and the SECOND declaration wins, so the
   first, with its hop counting and tapering tiers, is dead code - is:

     arriving anywhere that is not player.p.home, at level >= 60, off PVP
     -> the flat condition from G: luck -80, gold -80, xp -80, output -20,
        for 12 minutes of online play

   Returning to p.home clears it immediately, because the same function deletes
   the condition before deciding whether to re-add it. Below level 60 it is
   never applied at all, which is why this reads the live flag rather than
   trying to predict it: the level gate, the home shard and the clock are all
   the server's business, and character.s is where it reports the answer. */
function hopSick() {
	try { return !!(character.s && character.s.hopsickness); } catch (e) { return false; }
}

// ------------------------------------------------------------ the anniversary
/* The featured player, from game state rather than chat.

   parent.S.anniversary is the primary source and the reliable one: live
   testing on 2026-09-17 had the chat announcement fail to fire for an entire
   round while S.anniversary.target stayed correct throughout. The chat parse
   is kept in the live merchant as a second source; it is not carried here,
   because this character has no chat listener and adding one to a script that
   reloads on every hop buys a less reliable source at the cost of a listener
   to get wrong. */
function featuredPlayer() {
	try {
		const a = parent && parent.S && parent.S.anniversary;
		if (a && a.live && a.target) return a.target;
	} catch (e) { }
	return null;
}

/* Where the featured player is, per game state. get_player only resolves
   players already nearby, so this is the only source that answers before we
   are next to them - which is exactly when it is needed. */
function featuredLocation() {
	try {
		const a = parent && parent.S && parent.S.anniversary;
		if (a && a.live && a.map) return { map: a.map, x: a.x, y: a.y };
	} catch (e) { }
	return null;
}

function featuredDistance(name) {
	try {
		const p = get_player(name);
		if (!p) return null;
		return distance(character, p);
	} catch (e) { return null; }
}

/* Kiss the featured player, but only if they came to us.

   THIS IS NARROWER THAN THE EVENT ALLOWS, and deliberately. The event expects
   you to travel to the featured player; the standing rule for this character
   is that a bank run is the only thing that moves it. Those two cannot both
   hold, so the movement rule wins and the kiss is opportunistic: if the
   featured player is standing within range of the town spot, take it - the
   whole stand cluster is in town and so is the kiss target often enough for
   this to be worth having. If they are not, note it once and carry on.

   CONFIG.merchant.kissMayWalk is the switch. Turning it on makes the kiss
   behave like the live merchant's - walk the round, take the reward - at the
   cost of the character leaving the spot, which is the thing the rest of this
   file is built around. It is off, and it is a decision rather than an
   oversight. */
const kissState = { attemptedFor: null, skippedFor: null, unreachableFor: null };

async function kissRound() {
	if (!CONFIG.merchant.kissEvent) return false;
	const name = featuredPlayer();
	if (!name) return false;

	// We cannot kiss ourselves, and get_player does not resolve our own name -
	// so an unguarded attempt walks to where we already are and spins there for
	// the whole round. Others come to us; there is nothing to do.
	if (name === character.name) {
		if (kissState.skippedFor !== name) {
			kissState.skippedFor = name;
			log('anniversary: we are the featured player - staying put for others to reach us', '#FF69B4');
		}
		return false;
	}
	if (kissState.attemptedFor === name) return false;

	/* Hop sickness blocks the kiss REWARD outright. That is from G's own
	   explanation of the condition and it is not in the modifier list, so
	   nothing about luck/gold/xp/output hints at it - a sick merchant would
	   spend the round and collect nothing. */
	if (CONFIG.hop.skipKissWhileSick && hopSick()) {
		if (kissState.skippedFor !== name) {
			kissState.skippedFor = name;
			log(`anniversary: skipping ${name} - hop sick, the reward would be blocked`, 'orange');
		}
		return false;
	}

	const d = featuredDistance(name);
	if (d === null || d > CONFIG.merchant.kissRange) {
		if (!CONFIG.merchant.kissMayWalk) {
			if (kissState.unreachableFor !== name) {
				kissState.unreachableFor = name;
				log(`anniversary: ${name} is ${d === null ? 'not in sight' : Math.round(d) + ' away'} `
					+ `- not walking to them, this character only leaves the spot for the bank`, '#8b98ab');
			}
			return false;
		}
		// The switch is on: go to them, using the location game state carries
		// rather than waiting for get_player to resolve - it only answers for
		// players already nearby, which is the situation we are not in.
		const loc = featuredLocation();
		if (!loc || !(await goTo(loc))) return false;
		if ((featuredDistance(name) || Infinity) > CONFIG.merchant.kissRange) return false;
	}

	try {
		await use_skill('ikissyou', get_player(name));
		kissState.attemptedFor = name;         // the event rewards one visit per round
		log(`anniversary: kissed ${name}`, '#FF69B4');
		return true;
	} catch (e) {
		log(`anniversary: kiss on ${name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
		return false;
	}
}

// -------------------------------------------------------------------- the hop
/* Where to go next.

   Same shape as MerchantScout's: the bridge deals each roamer a beat of its
   own so two roamers never walk the same shard, and a shard a parked scout
   already holds is a shard whose data is arriving continuously - the roamer's
   time is better spent on the blind spots. The three rangers on this account
   are parked scouts, so on a healthy day most of the list is already covered
   and this merchant is working the remainder. */
function nextShard(reply) {
	const cur = shardKey(currentShard());
	const own = serverList().map(shardKey);
	const toServer = (key) => serverList().find((s) => shardKey(s) === key) || null;

	const parked = new Set(Object.values((reply && reply.parked) || {}).filter(Boolean));
	const beat = (reply && Array.isArray(reply.beat)) ? reply.beat : [];
	if (beat.length) {
		const mine = beat.filter((k) => k !== cur && own.includes(k));
		if (mine.length) return toServer(mine[0]);
		// Our beat is one shard and we are on it. Staying is correct: it is
		// ours, and nobody else is coming.
		if (beat.length === 1 && beat[0] === cur) return null;
	}

	const rotation = (reply && Array.isArray(reply.rotation)) ? reply.rotation : [];
	if (rotation.length) {
		// A shard the bridge has never heard of is staler than any timestamp,
		// so those come first; the rotation itself is already ordered
		// oldest-first, which makes its head the shard most worth visiting.
		const known = new Set(rotation);
		const pool = [...own.filter((k) => !known.has(k)), ...rotation]
			.filter((k) => k !== cur && own.includes(k) && !parked.has(k));
		if (pool.length) return toServer(pool[0]);
	}

	// No hints, or every other shard is covered by a parked scout: round-robin,
	// so an outage never leaves the roamer sitting still. The index is stored
	// rather than held, because change_server reloads the page and a counter
	// that restarts at the top each hop re-walks the same few shards forever.
	const any = own.filter((k) => k !== cur);
	if (!any.length) return null;
	const i = SS.get('roamIdx', 0) % any.length;
	SS.set('roamIdx', i + 1);
	return toServer(any[i]);
}

/* Leave. Everything that has to survive the page reload goes first. */
async function hopTo(target) {
	if (!target || !target.region || !target.name) return false;
	const cur = currentShard();
	if (shardKey(cur) === shardKey(target)) return false;
	if (!canHop()) {
		log('server hopping unavailable here (no change_server / X.servers) - staying put', 'orange');
		return false;
	}
	const last = SS.get('lastHop', 0);
	if (Date.now() - last < CONFIG.hop.minIntervalMs) return false;

	await reportConfirmed();            // never carry findings across a hop
	saveBuffer();                       // and if they could not be sent, keep them
	saveBankSnapshot();                 // the bank is not readable from a shard

	/* The bridge check sits AFTER the report, not before it.

	   bridge.online is false until something has succeeded, so checking first
	   would strand a scout that started before the bridge did - permanently,
	   since nothing else ever tries. The report attempt is what establishes
	   whether the bridge is there. */
	const may = mayHop();
	if (!may.ok) {
		if (!SS.get('hop_blocked', false)) {
			SS.set('hop_blocked', true);
			log(`holding ${shardKey(cur)} rather than rotating: ${may.reason}`, 'orange');
		}
		return false;
	}
	if (SS.get('hop_blocked', false)) {
		SS.set('hop_blocked', false);
		log('bridge back - resuming the rotation', '#7FD98A');
	}

	SS.set('lastHop', Date.now());
	log(`hopping ${shardKey(cur)} -> ${shardKey(target)}`, '#E9C46A');
	try {
		change_server(target.region, target.name);
		return true;
	} catch (e) {
		log('change_server failed: ' + e, 'red');
		return false;
	}
}

function hopDue() {
	return Date.now() - SS.get('lastHop', 0) >= CONFIG.hop.minIntervalMs;
}

// ------------------------------------------------------------- the merchant's
//                                                                 gold and bank
/* What the bank held when we last stood in it.

   character.bank is only populated inside the bank map, and this character
   spends its life on a town spot several shards from wherever it banked last.
   Every decision about whether to buy something - from Ponty, from Gabriel,
   anywhere - turns on how many copies the account already holds, and asking
   that question with no bank in sight answers "none" and buys a fourth.

   So the last reading is stored, with the time it was taken, and it survives
   the page reload that change_server performs. It is a snapshot and is treated
   as one: it is used for "do we already have enough", never for "take this
   specific item out". */
function saveBankSnapshot() {
	if (!character.bank) return false;
	const items = bankItems().map((it) => ({ name: it.name, level: it.level || 0, q: it.q || 1 }));
	SS.set('bank_snapshot', { at: Date.now(), items });
	return true;
}

function bankSnapshot() {
	const s = SS.get('bank_snapshot', null);
	return s && Array.isArray(s.items) ? s : null;
}

/* Copies the account holds, counted against the snapshot when the real bank is
   out of reach. Same rule as copiesHeld - worn and banked, never in-transit -
   but usable from a town spot three shards away. */
function copiesHeldRemote(name) {
	const worn = equippedItems().filter((it) => it.name === name).length;
	if (character.bank) return copiesHeld(name);
	const snap = bankSnapshot();
	if (!snap) return worn;
	return worn + snap.items.filter((it) => it.name === name).length;
}

/* The merchant's gold rule, the mirror of the rangers'.

   They deposit everything above a floor; it withdraws when it falls below one,
   and only down to leaveInBank. Nothing is deposited: this is the character
   that spends, and gold sitting in its bag is gold available to a Ponty
   listing that will be gone by the next window. */
async function merchantGold() {
	if (character.gold >= CONFIG.merchant.goldFloor) return 0;
	const inBank = (character.bank && character.bank.gold) || 0;
	const available = inBank - CONFIG.merchant.leaveInBank;
	if (available <= 0) {
		log(`gold is low (${character.gold}) and the bank cannot help `
			+ `(${inBank} held, ${CONFIG.merchant.leaveInBank} reserved)`, 'orange');
		return 0;
	}
	const want = Math.min(available, CONFIG.merchant.goldFloor - character.gold);
	try {
		await bank_withdraw(want);
		log(`drew ${want} gold from the bank`, '#7FD98A');
		return want;
	} catch (e) {
		log(`bank_withdraw failed: ${e && e.reason ? e.reason : e}`, 'orange');
		return 0;
	}
}

/* Three copies of the same name at the same level, sitting in the bank.

   Compounding needs exactly that, and the three rangers each banking one
   spare is how it happens - none of them ever sees a triple in its own bag.
   The merchant is the only character that can see all three at once, which
   makes taking them out its job rather than a convenience. */
function bankCompoundGroup() {
	const groups = new Map();
	for (const it of bankItems()) {
		const key = it.name + '@' + itemLevel(it);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(it);
	}
	for (const [, list] of groups) {
		if (list.length >= 3 && isPlanItem(list[0].name)) return list.slice(0, 3);
	}
	return null;
}

/* What the merchant takes OUT of the bank: work, not gear.

   The rangers' version of this asks "does it beat what I am wearing", which
   for a merchant answers no to everything - it cannot wear any of it. The
   merchant's question is different: what can I carry on with? Two answers,
   in this order.

     1. a compound group, because three slots become one and the result is a
        level above all of them - it is the only operation here that makes the
        bag emptier;
     2. anything still short of what the plan asks, lowest first.

   The free-slot floor applies to both, and a compound group that will not fit
   whole is left for the next window rather than half-taken. */
async function merchantWithdrawWork() {
	let taken = 0;
	for (let i = 0; i < BANK_MAX_OPS && bankWindowOpen(); i++) {
		const group = bankCompoundGroup();
		if (group && freeSlots() - 3 > CONFIG.ranger.freeSlotsFloor) {
			let got = 0;
			// Highest index first. A precaution rather than a known requirement:
			// the packs are sparse arrays, so a removal should leave a null and
			// not shift anything, but this is the one loop here that acts on
			// three indices read at the same moment, and descending order is
			// correct under either behaviour.
			for (const it of [...group].sort((a, b) => b.idx - a.idx)) {
				try { await bank_retrieve(it.pack, it.idx); got++; taken++; }
				catch (e) { log(`bank_retrieve ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange'); break; }
			}
			if (got === 3) {
				log(`took 3x ${group[0].name}+${itemLevel(group[0])} out to compound`, '#7FD98A');
				continue;
			}
			break;
		}

		if (freeSlots() <= CONFIG.ranger.freeSlotsFloor) {
			log('no room to take more work out - leaving the rest for next window', 'orange');
			break;
		}
		const work = bankItems().filter(isWorkItem)
			.sort((a, b) => itemLevel(a) - itemLevel(b))[0];
		if (!work) break;
		try {
			await bank_retrieve(work.pack, work.idx);
			log(`took ${work.name}+${itemLevel(work)} out to work on`, '#7FD98A');
			taken++;
		} catch (e) {
			log(`bank_retrieve ${work.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
	}
	return taken;
}

/* The merchant's bank window.

   Same shape as the rangers' and a different set of phases, because the
   rangers come here to dress and the merchant comes here to restock. It does
   not equip: the plan is a ranger's, and a merchant cannot wear any of it. */
async function merchantBankRun() {
	await withScanLock(doScan);
	if (!(await goTo({ map: CONFIG.bank.map, x: 0, y: -100 }))) {
		log('could not reach the bank this window', 'orange');
		return;
	}
	if (!character.bank) {
		log('in the bank map but character.bank is not readable - nothing to do this window', 'orange');
	} else {
		await merchantGold();
		const given = await bankDepositSpares();   // finished work goes back
		const taken = await merchantWithdrawWork();
		if (given || taken) log(`gear pass: banked ${given}, took out ${taken}`, '#7FD98A');
		// Last thing before leaving, so the snapshot reflects the deposits and
		// withdrawals this window just made rather than the state it arrived in.
		saveBankSnapshot();
	}
	await goTo(CONFIG.scout.townSpot);
	await withScanLock(doScan);
	await sellSurplus();
}

// ------------------------------------------------------------------ Ponty
/* Ponty sells what other players have sold to him, per shard, and the stock
   turns over - which is why this is evaluated on arrival rather than saved for
   a bank window that might be forty minutes away.

   THE QUESTION IT ASKS is the same one the bank window asks, and it can only
   ask it because of the snapshot: is this on the plan, and does the account
   already hold enough copies? Asked with no bank in sight the answer is always
   "we have none", and the merchant buys a fourth and fifth copy of something
   two rangers are already wearing.

   PRICE IS NOT TRUSTED WHEN IT IS NOT A NUMBER. The field name for it has not
   been established on this version of the game - normalisePonty probes five
   spellings and falls back to the client's own valuation, and in practice it
   has been arriving null. An unknown price cannot be budgeted against, so an
   item with one is skipped rather than bought blind. A wrong price here is
   worse than no price: it is gold spent on a number nobody chose. */
async function pontyBuy(items) {
	if (!items || !items.length) return 0;
	if (typeof buy_from_pont !== 'function') {
		if (!SS.get('no_pont_buy', false)) {
			SS.set('no_pont_buy', true);
			log('buy_from_pont is not available on this client - reading Ponty, not buying from him', 'orange');
		}
		return 0;
	}
	const acquired = new Map();
	let bought = 0, unpriced = 0;
	for (const it of items) {
		if (freeSlots() <= CONFIG.merchant.ponty.minFreeSlots) {
			log('bag too full to keep buying from Ponty', '#8b98ab');
			break;
		}
		const budget = character.gold - CONFIG.merchant.leaveInBank;
		if (budget <= 0) break;
		if (!isPlanItem(it.name)) continue;
		if (!bankWantsMore(it.name, acquired.get(it.name) || 0)) continue;
		if (typeof it.price !== 'number' || !isFinite(it.price)) { unpriced++; continue; }
		if (it.price > budget) continue;
		try {
			await buy_from_pont(it);
			acquired.set(it.name, (acquired.get(it.name) || 0) + 1);
			bought++;
			log(`bought ${it.name}${it.level ? '+' + it.level : ''} from Ponty for ${it.price}`, '#7FD98A');
		} catch (e) {
			log(`Ponty buy of ${it.name} failed: ${e && e.reason ? e.reason : e}`, 'orange');
			break;
		}
	}
	if (unpriced) {
		log(`${unpriced} Ponty listing(s) skipped for want of a price - `
			+ `the field name is still unconfirmed, see normalisePonty`, '#E9C46A');
	}
	return bought;
}

// -------------------------------------------------------------------- the tick
/* Priority ladder, same idea as the ranger's: ordered by what cannot wait.

   The bank window is the only thing that moves this character, so it is first.
   The kiss is next because the round is five minutes and does not come back.
   Everything else is standing on the spot reading the market. */
async function merchantTick() {
	if (character.rip) { try { await respawn(); } catch (e) { } return; }

	if (inTown()) {
		maybeTownScan().catch((e) => log(`town scan failed: ${e && e.message ? e.message : e}`, 'orange'));
	}
	if (fleetState.busy) return;

	fleetState.busy = true;
	try {
		if (isMyBankWindow()) { await merchantBankRun(); return; }

		// Back on the spot after a hop costs nothing - position survives
		// change_server, so this is a no-op on every tick but the first after a
		// bank run. goTo returns early when we are already there.
		if (!atTownSpot() && character.map === CONFIG.scout.townSpot.map) {
			await goTo(CONFIG.scout.townSpot);
		}

		if (await kissRound()) return;

		/* Both of these are town jobs done standing still: Cue is 150 from the
		   spot and Lucas 286, and neither needs a step. They run before the
		   hop for the obvious reason - after it we would be somewhere else,
		   with the same bag and different NPCs. */
		await compoundPass();
		await upgradePass();

		const key = shardKey(currentShard());
		if (pontyDue(key)) {
			const items = await pontyCheck();
			if (items) {
				absorbPonty(items);
				pontySeen(key, Date.now());
				// Evaluated here, on arrival, because his stock is per shard and
				// turns over. Holding it for the bank window would be holding it
				// until after we had hopped away from it.
				await pontyBuy(items);
			}
		}
		if (scanDue()) { await withScanLock(doScan); return; }

		if (hopDue()) {
			const r = await report();
			if (r && r.reply) bridge.lastReply = r.reply;
			const target = nextShard(bridge.lastReply);
			if (target) await hopTo(target);
		}
	} catch (e) {
		console.error('merchantTick error:', e);
	} finally {
		fleetState.busy = false;
	}
}

// ============================================================================
// STARTUP
// ============================================================================
/* One script, four characters, and the roster is what tells them apart. A name
   that is not in CONFIG.characters does nothing at all rather than guessing a
   role - an unknown character running the ranger loop would farm on someone
   else's shard and bank on someone else's minute. */
const TICK_MS = 1000;

function fleetTick() {
	const role = myRole();
	if (role === 'ranger') return rangerTick();
	if (role === 'merchant') return merchantTick();
	return null;
}

function startFleet() {
	const role = myRole();
	if (!role) {
		log(`${character.name} is not in the roster - doing nothing. `
			+ `Add it to CONFIG.characters to give it a job.`, 'red');
		return;
	}
	restoreBuffer();
	log(`${character.name}: ${role}, bank window at :${String(myBankMinute()).padStart(2, '0')}, `
		+ `on ${shardKey(currentShard())}`, '#55BDF0');
	setInterval(() => {
		try { fleetTick(); } catch (e) { console.error('fleetTick error:', e); }
	}, TICK_MS);
}

/* Guarded, because this file is concatenated whole into its test harness.

   In the game FLEET_AUTOSTART does not exist and the script starts. The
   harness declares it false, which is the difference between running the
   suite and starting a one-second interval that farms against a stub and
   never lets the process exit. */
if (typeof FLEET_AUTOSTART === 'undefined' || FLEET_AUTOSTART) startFleet();
