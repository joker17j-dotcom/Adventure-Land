// ============================================================================
// MerchantScout - market + Ponty scanner for up to 4 merchant characters
// ============================================================================
// Run this as the CODE for each scout merchant. One file, both roles; the role
// is resolved from CONFIG.roles below, so there is nothing to edit per
// character beyond adding its name.
//
// WHAT IT DOES
//   parked : sits on one shard at the merchant square and reports every open
//            stand it can see, continuously. The bridge tells it which shard.
//   roamer : cycles shards, scanning each for a dwell period and checking
//            Ponty's stock on every shard it lands on.
//
// THE BRIDGE IS NOT OPTIONAL FOR COORDINATION, BUT IS OPTIONAL FOR SCANNING.
// send_cm is realm-local, so scouts on different shards cannot talk to each
// other - the bridge is the only thing that can stop two parked scouts sitting
// on the same shard. If the bridge is unreachable the scouts keep scanning and
// buffer their findings; a roamer additionally falls back to its own rotation
// over parent.X.servers, so RUNNING THE ROAMER ON ITS OWN IS FULLY SUPPORTED
// and needs no bridge and no other scout.
//
// REQUIREMENTS
//   - A browser tab. parent.X.servers and change_server() are page globals;
//     Mainframe's sandbox does not reliably expose them (the same reason
//     Dexon's cross-server dragold scan is browser-only). The script detects
//     this and degrades to single-shard scanning rather than dying.
//   - market_bridge.py running locally, if you want automatic coordination.
// ============================================================================

const CONFIG = {
	bridge: 'http://127.0.0.1:8787',

	// Character name -> role. Anything not listed defaults to 'parked'.
	// Set every name you own; a name that never logs in simply never reports.
	roles: {
		Scout1: 'parked',
		Scout2: 'parked',
		Scout3: 'parked',
		Scout4: 'roamer',
	},

	scanIntervalMs: 4000,        // how often to sweep visible entities
	postIntervalMs: 20000,       // parked scouts: scan and post on this beat
	// Never post twice inside this window. A hop, a dwell ending and a heartbeat
	// can otherwise land together and hammer the bridge with three writes in a
	// second, which tells it nothing it did not already know.
	minPostGapMs: 7000,
	// How many times to resend before accepting that a scan is not getting
	// through. Only applies where delivery is confirmed (the roamer before a
	// hop); a parked scout just tries again on its next beat.
	postConfirmRetries: 3,
	// How long a roamer works one shard. Sized against the real server list:
	// 11 non-PVP shards (Europas I-IV, Americas I-V, Eastlands I-II), so a full
	// rotation is 11 x (travel + Ponty + dwell + hop). At 90s that was ~27 min,
	// longer than the bridge's merchant TTL - shards expired before the roamer
	// returned and flickered in and out. 60s puts the rotation near 18 min.
	roamDwellMs: 60000,
	pontyEveryMs: 10 * 60 * 1000,// per-shard Ponty re-check interval
	minHopIntervalMs: 30000,     // floor between change_server calls
	pontyTimeoutMs: 8000,
	// Logs the field names in Ponty's first reply, once per scan. Leave on
	// until the price is mapping correctly, then turn off.
	debugPonty: true,

	// Where to stand while scanning. Empty = derive from the game's own map
	// data (see deriveScanSpots). Override with explicit
	// [{map,x,y}, ...] if you know a better pitch on your servers.
	scanSpots: [],
	// Walk between scan spots, or hold the first one.
	//
	// Entity visibility was measured at 699+ units and still climbing when the
	// sampling stopped, which comfortably covers the whole main-map merchant
	// plaza from a single pitch - so drifting buys nothing there and costs time
	// that could be spent scanning. Left on by default because a bigger or more
	// spread-out venue may still need it; turn it off for main.
	driftBetweenSpots: false,

	// PVP shards are excluded: a scout parked there is a free kill and the
	// stands there are not a market you can safely trade in.
	skipServers: ['PVP'],

	verbose: true,
};

// ---------------------------------------------------------------- utilities
const SS = {
	// change_server() tears the script down and re-runs it in a browser tab, so
	// anything that must outlive a hop goes through the game's own persistent
	// CODE storage rather than a module-scope variable.
	get(k, dflt) {
		try { const v = get('scout_' + k); return v === null || v === undefined ? dflt : v; }
		catch (e) { return dflt; }
	},
	set(k, v) { try { set('scout_' + k, v); } catch (e) { } },
};

function log(msg, color) {
	if (!CONFIG.verbose) return;
	try { game_log('[scout] ' + msg, color || '#8b98ab'); } catch (e) { console.log('[scout]', msg); }
}

function myName() {
	try { return character.name; } catch (e) { return '?'; }
}

function myRole() {
	return CONFIG.roles[myName()] === 'roamer' ? 'roamer' : 'parked';
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
		.filter((s) => s && !CONFIG.skipServers.includes(s.name))
		.map((s) => ({ region: s.region, name: s.name }));
}

function canHop() {
	return typeof change_server === 'function' && serverList().length > 0;
}

// ------------------------------------------------------------ where to stand
/* Pull real coordinates out of the game's map data instead of hardcoding a
   guess. Merchants cluster around the main-map services, so the NPC anchors are
   a good proxy for "where the stands are" on any server. */
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
	if (CONFIG.scanSpots.length) return CONFIG.scanSpots;
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

async function goTo(spot) {
	if (!spot) return false;
	try {
		await smart_move({ map: spot.map, x: spot.x, y: spot.y });
		return true;
	} catch (e) {
		log('could not reach scan spot: ' + e, 'orange');
		return false;
	}
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
	if (CONFIG.debugPonty && list.length) {
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
		setTimeout(() => finish(null), CONFIG.pontyTimeoutMs);
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
/* Stands seen since the last successful post, keyed so a merchant re-seen on
   several sweeps is reported once with its latest stock. */
const buffer = { stands: new Map(), ponty: null };

function absorb(stands) {
	for (const s of stands) buffer.stands.set(s.id, s);
}

function drain() {
	const stands = [...buffer.stands.values()];
	const ponty = buffer.ponty;
	buffer.stands.clear();
	buffer.ponty = null;
	return { stands, ponty };
}

let lastPostAt = 0;

/* Hold until minPostGapMs has passed since this scout's own last post. Per
   scout, not global - two scouts posting a second apart is fine, one scout
   posting twice in a second is noise. */
async function respectPostGap() {
	if (!lastPostAt) return;
	const since = Date.now() - lastPostAt;
	if (since >= CONFIG.minPostGapMs) return;
	const wait = CONFIG.minPostGapMs - since;
	log(`holding ${(wait / 1000).toFixed(1)}s before posting (min gap)`);
	await new Promise((r) => setTimeout(r, wait));
}

/* Returns {reply, confirmed, stands, ponty}. `confirmed` means the bridge
   acknowledged storing exactly what was sent - not merely that the request
   returned. An HTTP 200 with a short count means the scan did not land. */
async function report(extra) {
	await respectPostGap();
	const { stands, ponty } = drain();
	const payload = {
		character: myName(),
		role: myRole(),
		shard: currentShard(),
		at: new Date().toISOString(),
		merchants: stands,
		ponty: ponty,
		...(extra || {}),
	};
	const reply = await bridge.post(payload);
	lastPostAt = Date.now();

	const sentM = stands.length;
	const sentP = ponty ? ponty.length : 0;
	const acc = reply && reply.accepted;
	const confirmed = !!(reply && acc
		&& acc.merchants === sentM && acc.ponty === sentP);

	if (!reply || !confirmed) {
		// Put it back so nothing is lost. The stand map is keyed by merchant, so
		// re-absorbing cannot double-count, and an unconfirmed post is treated
		// exactly like a failed one.
		absorb(stands);
		if (ponty) buffer.ponty = ponty;
	}

	const where = shardKey(currentShard());
	if (confirmed) {
		log(`${sentM} stands${sentP ? ` + ${sentP} Ponty items` : ''} on ${where} - confirmed`);
	} else if (reply) {
		log(`${where}: bridge took ${acc ? acc.merchants : '?'}/${sentM} stands - resending`, 'orange');
	} else {
		log(`${sentM} stands${sentP ? ` + ${sentP} Ponty items` : ''} on ${where} (buffered, bridge down)`);
	}
	return { reply, confirmed, stands: sentM, ponty: sentP };
}

/* Post, and keep resending until the bridge confirms it stored the scan. Used
   before a hop: leaving a shard with an unacknowledged scan means the data was
   collected and then quietly dropped.

   Bounded on purpose. If the bridge is simply down, the findings are already
   back in the buffer and will go out when it returns, so blocking the rotation
   forever would cost coverage and save nothing. */
async function reportConfirmed() {
	for (let i = 0; i < CONFIG.postConfirmRetries; i++) {
		const r = await report();
		if (r.confirmed) return r;
		if (!r.reply) {
			log('bridge unreachable - carrying the scan forward, will send when it returns', 'orange');
			return r;
		}
		log(`post not acknowledged (${i + 1}/${CONFIG.postConfirmRetries})`, 'orange');
	}
	log('giving up on confirmation for now - scan stays buffered', 'orange');
	return { reply: null, confirmed: false, stands: 0, ponty: 0 };
}

// ---------------------------------------------------------------- hop guard
async function hopTo(target) {
	if (!target || !target.region || !target.name) return false;
	const cur = currentShard();
	if (shardKey(cur) === shardKey(target)) return false;
	if (!canHop()) {
		log('server hopping unavailable here (no change_server / X.servers) - staying put', 'orange');
		return false;
	}
	const last = SS.get('lastHop', 0);
	if (Date.now() - last < CONFIG.minHopIntervalMs) return false;

	await reportConfirmed();            // never carry findings across a hop
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

// -------------------------------------------------------------- roamer route
/* Prefer the bridge's staleness-ordered rotation; without a bridge, walk our
   own list. Either way we skip shards a parked scout already owns, because a
   parked scout is reporting them continuously and the roamer's time is better
   spent on the blind spots. */
function nextShard(reply) {
	const cur = shardKey(currentShard());
	const parked = new Set(Object.values((reply && reply.parked) || {}).filter(Boolean));

	const fromBridge = (reply && Array.isArray(reply.rotation)) ? reply.rotation : [];
	const own = serverList().map(shardKey);
	const all = fromBridge.length ? [...new Set([...fromBridge, ...own])] : own;

	const candidates = all.filter((k) => k !== cur && !parked.has(k));
	const pool = candidates.length ? candidates : all.filter((k) => k !== cur);
	if (!pool.length) return null;

	// Round-robin through whatever pool we ended up with, persisted so a hop
	// does not reset us to the top of the list every time.
	const i = SS.get('roamIdx', 0) % pool.length;
	SS.set('roamIdx', i + 1);
	const key = pool[i];
	for (const s of serverList()) if (shardKey(s) === key) return s;
	return null;
}

// -------------------------------------------------------------------- loops
async function parkedLoop() {
	log(`parked scout starting on ${shardKey(currentShard())}`, '#55BDF0');
	const spots = deriveScanSpots();
	let spotIdx = 0;
	await goTo(spots[0]);

	let lastPost = 0;
	while (true) {
		absorb(scanStands());

		if (Date.now() - lastPost > CONFIG.postIntervalMs) {
			const { reply } = await report();
			lastPost = Date.now();
			if (reply && reply.assignment) await hopTo(reply.assignment);
		}

		// Drift between anchor points: entity visibility is a radius, so one
		// fixed pitch can miss stands parked beyond it. Measured at 699+ units,
		// which covers the main plaza, so this is for venues that are larger.
		if (CONFIG.driftBetweenSpots && spots.length > 1 && Math.random() < 0.25) {
			spotIdx = (spotIdx + 1) % spots.length;
			await goTo(spots[spotIdx]);
		}
		await new Promise((r) => setTimeout(r, CONFIG.scanIntervalMs));
	}
}

async function roamerLoop() {
	log(`roamer starting on ${shardKey(currentShard())}`, '#55BDF0');
	if (!canHop()) {
		log('no server hopping available - roamer will scan this shard only', 'orange');
	}
	const spots = deriveScanSpots();
	const pontySeen = {};

	while (true) {
		const key = shardKey(currentShard());
		await goTo(spots[0]);

		// Ponty first: it is a fixed walk and the answer is the same all dwell.
		if (!pontySeen[key] || Date.now() - pontySeen[key] > CONFIG.pontyEveryMs) {
			const items = await pontyCheck();
			if (items) { buffer.ponty = items; pontySeen[key] = Date.now(); }
		}

		const until = Date.now() + CONFIG.roamDwellMs;
		let spotIdx = 0;
		while (Date.now() < until) {
			absorb(scanStands());
			if (CONFIG.driftBetweenSpots && spots.length > 1) {
				spotIdx = (spotIdx + 1) % spots.length;
				await goTo(spots[spotIdx]);
			}
			await new Promise((r) => setTimeout(r, CONFIG.scanIntervalMs));
		}

		// One last sweep, then hand everything over and confirm it landed BEFORE
		// leaving. A hop with an unacknowledged scan throws the whole dwell away.
		absorb(scanStands());
		const { reply } = await reportConfirmed();

		if (!canHop()) {                       // single-shard mode: just keep sweeping
			await new Promise((r) => setTimeout(r, CONFIG.scanIntervalMs));
			continue;
		}
		const target = nextShard(reply);
		if (target) await hopTo(target);
		else await new Promise((r) => setTimeout(r, CONFIG.scanIntervalMs));
	}
}

// --------------------------------------------------------------------- boot
(async function main() {
	const role = myRole();
	log(`${myName()} starting as ${role} - bridge ${CONFIG.bridge}`, '#5ED6A8');
	if (!CONFIG.roles[myName()]) {
		log(`${myName()} is not in CONFIG.roles - defaulting to parked`, 'orange');
	}
	try {
		if (role === 'roamer') await roamerLoop();
		else await parkedLoop();
	} catch (e) {
		log('scout stopped: ' + (e && e.stack ? e.stack : e), 'red');
	}
})();
