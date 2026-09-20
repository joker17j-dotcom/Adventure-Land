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
		scanEveryMs: 2 * 60 * 1000,     // the standing beat: town, scan, back out
		fullInventoryScanMs: 20 * 1000, // stuck with a full bag: scan harder while waiting
		townSpot: { map: 'main', x: 0, y: 0 },
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
	merchant: {
		// Mirror of bank.rangerKeepGold. Below the floor the merchant draws the
		// bank down to leaveInBank; at or above it, it withdraws nothing.
		goldFloor: 10000000,
		leaveInBank: 1000000,
		kissEvent: true,
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
	await goTo(spot);
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
	let seen = -1;
	for (let pass = 0; pass < CONFIG.scout.maxSettlePasses; pass++) {
		absorb(scanStands());
		const n = bufferedCount();
		if (n > 0 && n === seen) return n;
		seen = n;
		await new Promise((r) => setTimeout(r, CONFIG.scout.settleMs));
	}
	const n = bufferedCount();
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
	const wait = CONFIG.scout.minPostGapMs - since;
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
	const def = itemDef('hpot1');
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
const fleetState = { busy: false, parkedFull: false, lastParkScanAt: 0 };

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
		if (character.hp / character.max_hp <= cfg.hpAt && potionCount('hpot1') > 0) {
			use_skill('use_hp');
			return;
		}
		if (character.mp / character.max_mp <= cfg.mpAt && potionCount('mpot1') > 0) {
			use_skill('use_mp');
		}
	} catch (e) { }
}

function potionsLow() {
	const cfg = CONFIG.ranger.potions;
	return potionCount('hpot1') < cfg.buyBelow || potionCount('mpot1') < cfg.buyBelow;
}

async function buyPotions() {
	const cfg = CONFIG.ranger.potions;
	for (const kind of ['hpot1', 'mpot1']) {
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
	await settleScan();
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
	if (!(await goTo(spot))) return false;
	if (reason === 'potions') await buyPotions();
	await doScan();
	ranger.lastTownTripAt = Date.now();
	return true;
}

function scanDue() {
	return Date.now() - ranger.lastScanAt >= CONFIG.scout.scanEveryMs;
}

function bagFull() {
	return freeSlots() <= CONFIG.ranger.freeSlotsFloor;
}

/* Bag full and not our bank window yet.

   The spec's instruction is to wait in town rather than drop anything, and to
   scan harder while waiting - which turns dead time into the one thing this
   character can still usefully do. Nothing is sold here: selling belongs after
   the bank window, once the bank has had its pick.

   Note this deliberately does NOT walk back out to farm in between. Killing
   things with no room to loot them is how a full bag stays full while looking
   busy. */
async function parkFull() {
	if (!fleetState.parkedFull) {
		fleetState.parkedFull = true;
		log(`bag full (${freeSlots()} free) - holding in town until the bank window`, '#E9C46A');
		await goTo(CONFIG.scout.townSpot);
	}
	if (Date.now() - fleetState.lastParkScanAt < CONFIG.scout.fullInventoryScanMs) return;
	fleetState.lastParkScanAt = Date.now();
	await doScan();
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
	if (fleetState.busy) return;

	fleetState.busy = true;
	try {
		if (isMyBankWindow()) {
			fleetState.parkedFull = false;
			await bankRun();
			return;
		}
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

/* The bank window's work is the gear economy, which is the next piece to
   build. Until it lands this does the half that is unambiguous and safe -
   deposit the gold above the floor - and says plainly that the rest is not
   here yet, rather than silently doing nothing and looking finished. */
async function bankRun() {
	if (!(await goTo({ map: CONFIG.bank.map, x: 0, y: -100 }))) return;
	await doScan();                        // the spec wants a scan on the way in
	const keep = CONFIG.bank.rangerKeepGold;
	if (character.gold > keep) {
		const amount = character.gold - keep;
		try {
			await bank_deposit(amount);
			log(`banked ${amount} gold`, '#7FD98A');
		} catch (e) {
			log(`bank_deposit failed: ${e && e.reason ? e.reason : e}`, 'red');
		}
	}
	log('gear pass not implemented yet - gold only this window', 'orange');
	await townTrip('bank window, on the way out');
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
function bankWantsMore(name) {
	const entry = PLAN_INDEX.get(name);
	if (!entry) return false;
	const held = copiesHeld(name);
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
function shouldBank(item) {
	if (!isPlanItem(item.name)) return false;
	if (slotToEquip(item)) return false;
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
	if (NEVER_SELL.has(item.name)) return false;
	if (isPlanItem(item.name) && bankWantsMore(item.name)) return false;
	return true;
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
