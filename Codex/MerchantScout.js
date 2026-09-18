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
	postIntervalMs: 15000,       // how often to ship findings to the bridge
	roamDwellMs: 90000,          // how long a roamer works one shard
	pontyEveryMs: 10 * 60 * 1000,// per-shard Ponty re-check interval
	minHopIntervalMs: 30000,     // floor between change_server calls
	pontyTimeoutMs: 8000,

	// Where to stand while scanning. Empty = derive from the game's own map
	// data (see deriveScanSpots). Override with explicit
	// [{map,x,y}, ...] if you know a better pitch on your servers.
	scanSpots: [],

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
	const out = [];
	for (const it of list) {
		if (!it || !it.name) continue;
		out.push({
			name: it.name,
			level: it.level || 0,
			price: it.price != null ? it.price : null,
			q: it.q || 1,
			p: it.p || null,
			rid: it.rid || null,
		});
	}
	return out;
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

async function report(extra) {
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
	if (!reply) {
		// Put it back so nothing is lost while the bridge is down. The stand map
		// is keyed by merchant, so re-absorbing cannot double-count.
		absorb(stands);
		if (ponty) buffer.ponty = ponty;
	}
	log(`${stands.length} stands${ponty ? ` + ${ponty.length} Ponty items` : ''} on `
		+ `${shardKey(currentShard())}${reply ? '' : ' (buffered, bridge down)'}`);
	return reply;
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

	await report();                     // never carry findings across a hop
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
			const reply = await report();
			lastPost = Date.now();
			if (reply && reply.assignment) await hopTo(reply.assignment);
		}

		// Drift between anchor points: entity visibility is a radius, so one
		// fixed pitch silently misses stands parked on the far side of the square.
		if (spots.length > 1 && Math.random() < 0.25) {
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
			if (spots.length > 1) {
				spotIdx = (spotIdx + 1) % spots.length;
				await goTo(spots[spotIdx]);
			}
			await new Promise((r) => setTimeout(r, CONFIG.scanIntervalMs));
		}

		const reply = await report();
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
