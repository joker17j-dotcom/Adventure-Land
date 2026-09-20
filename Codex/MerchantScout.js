// ============================================================================
// MerchantScout - market + Ponty scanner for up to 4 merchant characters
//
// NO STAND. This never calls open_stand, by design: a scout is reading the
// market, not competing in it, and a stand would also anchor it where it
// stands. scanStands() skips our own name anyway, so a stand opened by
// something else is still not mistaken for market data.
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
	// A roamer does not linger. scanStands() reads parent.entities in one
	// synchronous pass, so 30 stands cost the same as 3 and standing around
	// afterwards adds nothing - it is the same snapshot, re-taken.
	//
	// The one real hazard is scanning too EARLY: after a change_server the
	// client needs a moment to receive the entity list, and a single instant
	// scan can catch it half-populated. So rather than a fixed dwell, sweep
	// until the count stops growing. On an already-loaded shard that settles in
	// two passes; it is a stability check, not a timer.
	settleMs: 1500,
	maxSettlePasses: 5,
	pontyEveryMs: 10 * 60 * 1000,// per-shard Ponty re-check interval
	minHopIntervalMs: 30000,     // floor between change_server calls
	pontyTimeoutMs: 8000,
	// Logs the field names in Ponty's first reply, once per scan. Leave on
	// until the price is mapping correctly, then turn off.
	debugPonty: true,

	/* Where to stand while scanning.

	   One measured point that reaches Lucas, Cue, Gabriel and Ponty at once,
	   with the whole player-stand cluster inside the vision box. It is the
	   centre of the smallest circle enclosing those four, radius 286.05, and
	   it was verified live: buy from Gabriel, buy from Lucas, upgrade at Cue,
	   Ponty replying with 225 items, all from exactly here.

	   This replaces walking to NPC anchors. The roamer used to goTo() the
	   first derived anchor on arrival and then goTo() Ponty separately when
	   Ponty was due - two walks across town per shard, for a scan that is a
	   synchronous read of parent.entities and a socket call, neither of which
	   needed the walk. The same point is what Codex/FamilyFleet.js uses.

	   If the NPC set changes, recompute the smallest enclosing circle rather
	   than nudging this - Lucas and Ponty are 572.1 apart and form the
	   diameter, so they are the pair that binds it. */
	townSpot: { map: 'main', x: -179, y: -72 },
	// Still derived if townSpot is ever cleared, so the old behaviour remains
	// reachable rather than deleted.
	scanSpots: [],
	// Walk between scan spots, or hold the first one.
	//
	// Entity visibility is a radius, and two readings of it disagree: a stand
	// was seen at 699+ units and still climbing when sampling stopped, while a
	// later controlled walk-out put the unload boundary between 566 and 619.
	// Neither has been reconciled. Either comfortably covers the whole main-map
	// merchant plaza from a single pitch - so drifting buys nothing there and
	// costs time that could be spent scanning. Left on by default because a
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
	if (CONFIG.townSpot) return [CONFIG.townSpot];
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

/* Travel only when we are not already there.

   A character keeps its position across change_server - observed rather than
   assumed: after a live rotation the scout was standing on Ponty's exact
   coordinates on the shard it finished on, carried over from the shard before.
   So a roamer that starts on the town spot arrives on the town spot, every
   hop, and calling smart_move to where it already stands is a call that can
   fail or hang for no gain.

   The walk is kept for the cases that need it: the first load, and anything
   that displaces the character. */
async function goTo(spot) {
	if (!spot) return false;
	if (atSpot(spot)) return true;
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

/* Are we standing on this spot already?

   real_x / real_y, never x / y. On the top window those are screen
   coordinates - measured at (1147, 416) while the character stood at
   (-123, -52) - and NPC entities have .x === .real_x, so the discrepancy is
   invisible until something cross-checks. It has cost this project once
   already. */
function atSpot(spot, within) {
	if (!spot) return false;
	const c = character || {};
	if (c.map !== spot.map) return false;
	const x = c.real_x != null ? c.real_x : c.x;
	const y = c.real_y != null ? c.real_y : c.y;
	const dx = x - spot.x, dy = y - spot.y;
	return Math.sqrt(dx * dx + dy * dy) <= (within || 60);
}

/* Ponty is in range from the town spot - measured at 286.1, with the call
   returning 225 items from exactly there - so standing on it is enough and the
   walk is pure cost. Only travel when we are somewhere else. */
function atTownSpot() {
	return atSpot(CONFIG.townSpot);
}

async function pontyCheck() {
	if (atTownSpot()) {
		const items = await scanPonty();
		if (items) log(`Ponty: ${items.length} items on ${shardKey(currentShard())}`, '#5ED6A8');
		else log('Ponty returned nothing (out of range, or the call timed out)', 'orange');
		return items;
	}
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
	return Date.now() - pontySeen(key) > CONFIG.pontyEveryMs;
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
	for (let pass = 0; pass < CONFIG.maxSettlePasses; pass++) {
		absorb(scanStands());
		const n = bufferedCount();
		if (n > 0 && n === seen) return n;
		seen = n;
		await new Promise((r) => setTimeout(r, CONFIG.settleMs));
	}
	const n = bufferedCount();
	if (n === 0) log(`${shardKey(currentShard())}: no stands after ${CONFIG.maxSettlePasses} sweeps`, 'orange');
	return n;
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
			character: myName(), role: myRole(), shard: currentShard(),
			at: new Date().toISOString(), merchants: [], ponty: null,
			...(extra || {}),
		});
		lastPostAt = Date.now();
		return { reply, confirmed: !!reply, stands: 0, ponty: 0 };
	}

	/* Stop paying the post gap once the bridge has proved unreachable.

	   The gap exists so one scout does not hammer the bridge with several
	   writes a second. It has no purpose against a bridge that is DOWN, and
	   charging it per bucket there is what made a rotation get slower every
	   hop: with nothing confirming, buckets are never cleared, so the buffer
	   grows by one shard per hop, and each post pass paid 7s for every bucket
	   in it. Two passes per hop - the loop's own, then hopTo's - made that
	   about +14s per hop, compounding. Measured on a live rotation: 72s
	   between the first two shards climbing monotonically to 168s by the
	   eighth, with no shard being individually slow.

	   The findings are not lost. Everything unsent stays buffered and stamped
	   with the shard it was seen on, and goes out when the bridge returns. */
	let lastReply = null, allOk = true, sent = 0;
	let offline = false;
	for (const [key, e] of buckets) {
		if (offline) { allOk = false; continue; }
		await respectPostGap();
		const stands = [...e.stands.values()];
		const ponty = e.ponty;
		const reply = await bridge.post({
			character: myName(), role: myRole(),
			shard: e.shard,                       // where it was SEEN, not where we are
			at: new Date().toISOString(),
			merchants: stands, ponty: ponty,
			...(extra || {}),
		});
		lastPostAt = Date.now();
		lastReply = reply || lastReply;

		if (!reply) {
			// No reply at all is the bridge being unreachable, not a rejected
			// payload. Give up on the rest of this pass rather than waiting
			// out a gap per bucket for writes that cannot land.
			offline = true;
			allOk = false;
			log(`${key}: bridge unreachable - holding this and ${buckets.length - 1 - buckets.findIndex(function (b) { return b[0] === key; })} other shard(s)`, 'orange');
			continue;
		}
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
	// saveBuffer is declared below report(); both are function declarations, so
	// the hoisting is fine - noted because the call order here reads backwards.
	if (!canHop()) {
		log('server hopping unavailable here (no change_server / X.servers) - staying put', 'orange');
		return false;
	}
	const last = SS.get('lastHop', 0);
	if (Date.now() - last < CONFIG.minHopIntervalMs) return false;

	await reportConfirmed();            // never carry findings across a hop
	saveBuffer();                       // and if it could not be sent, keep it
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
	const own = serverList().map(shardKey);

	const parked = new Set(Object.values((reply && reply.parked) || {}).filter(Boolean));
	const fromBridge = (reply && Array.isArray(reply.rotation)) ? reply.rotation : [];

	const toServer = (key) => {
		for (const s of serverList()) if (shardKey(s) === key) return s;
		return null;
	};

	// A beat of this roamer's own, dealt by the bridge so two roamers never
	// walk the same shard. Preferred over `rotation`, which every roamer
	// receives identically and which therefore sent them all to the same head.
	// Falls through when the bridge is older, or when there are more roamers
	// than free shards and someone's beat is empty - overlap is unavoidable
	// then, and standing still is worse.
	const beat = (reply && Array.isArray(reply.beat)) ? reply.beat : [];
	if (beat.length) {
		const mine = beat.filter((k) => k !== cur && own.includes(k));
		if (mine.length) return toServer(mine[0]);
		// The beat is a single shard and we are standing on it: nothing to do
		// but stay, which is correct - it is ours and nobody else will come.
		if (beat.length === 1 && beat[0] === cur) return null;
	}

	if (fromBridge.length) {
		// Shards the bridge has never heard of come first: no observation at all
		// is staler than any timestamp. Then its rotation, which is already
		// ordered oldest-first - so the head IS the shard most worth visiting,
		// and stepping an index through it would throw that ordering away.
		const known = new Set(fromBridge);
		const unseen = own.filter((k) => !known.has(k));
		const pool = [...unseen, ...fromBridge]
			.filter((k) => k !== cur && own.includes(k) && !parked.has(k));
		if (pool.length) return toServer(pool[0]);
	}

	// No hints, or every other shard is parked-covered: round-robin so an
	// outage or a full fleet never leaves the roamer sitting still. The index
	// is persisted because change_server wipes runtime state in a browser tab,
	// and restarting at the top of the list each hop would re-walk the same few.
	const any = own.filter((k) => k !== cur);
	if (!any.length) return null;
	const i = SS.get('roamIdx', 0) % any.length;
	SS.set('roamIdx', i + 1);
	return toServer(any[i]);
}

// -------------------------------------------------------------------- loops
async function parkedLoop() {
	log(`parked scout starting on ${shardKey(currentShard())}`, '#55BDF0');
	const spots = deriveScanSpots();
	let spotIdx = 0;
	await goTo(spots[0]);

	// Settle before anything is posted. lastPost starting at 0 made the first
	// iteration post immediately - straight after arriving, with an entity list
	// that had not streamed in - and an empty scan wipes the shard it names.
	// With several parked scouts that is a shard blanked every time one starts
	// or is reassigned.
	await settleScan();
	let lastPost = 0;
	while (true) {
		absorb(scanStands());

		// A parked scout sits on one shard indefinitely, which makes it that
		// shard's only source of Ponty stock - and Ponty is the one thing the
		// public feed does not carry. Previously only the roamer ever asked,
		// so a shard with a parked scout on it had no Ponty data at all.
		const key = shardKey(currentShard());
		if (pontyDue(key)) {
			const items = await pontyCheck();
			if (items) { absorbPonty(items); pontySeen(key, Date.now()); }
			await goTo(spots[spotIdx]);      // pontyCheck walks; come back
		}

		if (Date.now() - lastPost > CONFIG.postIntervalMs) {
			const { reply } = await report();
			lastPost = Date.now();
			if (reply && reply.assignment) await hopTo(reply.assignment);
		}

		// Drift between anchor points: entity visibility is a radius, so one
		// fixed pitch can miss stands parked beyond it. The two readings of that
		// radius disagree - 699+ once, 566-619 in a later controlled walk-out -
		// so drifting covers both at no cost. The main plaza fits inside either;
		// this is for venues that are larger.
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

	while (true) {
		const key = shardKey(currentShard());
		await goTo(spots[0]);

		// Ponty first: it is a fixed walk and the answer is the same all visit.
		if (pontyDue(key)) {
			const items = await pontyCheck();
			if (items) { absorbPonty(items); pontySeen(key, Date.now()); }
		}

		// Its own copy of this broke out on two equal readings including zero,
		// which is the case that wipes a shard. settleScan holds zero open
		// until every pass is spent.
		if (CONFIG.driftBetweenSpots && spots.length > 1) {
			for (let i = 0; i < spots.length; i++) {
				await goTo(spots[i]);
				await settleScan();
			}
		} else {
			await settleScan();
		}

		// hopTo() confirms before it leaves, so reporting here as well was a
		// second full pass over every buffered shard - each one paying the post
		// gap - immediately before the pass that actually matters. Only report
		// here when we are NOT about to hop, since then nothing else will.
		let reply = null;
		if (!canHop()) {                       // single-shard mode: just keep sweeping
			reply = (await reportConfirmed()).reply;
			await new Promise((r) => setTimeout(r, CONFIG.scanIntervalMs));
			continue;
		}
		reply = bridge.lastReply;
		const target = nextShard(reply);
		if (target) await hopTo(target);
		else await new Promise((r) => setTimeout(r, CONFIG.scanIntervalMs));
	}
}

// -------------------------------------------------- revisit / sweep timing
/* How long it takes to come back to a shard, and HOW MUCH was covered on the
   way. The second half is not decoration - without it the first is misread.

   A "lap" here is a REVISIT INTERVAL: the time between two arrivals at the
   same shard. It is only a full sweep if every shard was visited in between,
   and with a bridge up that is often false: nextShard() takes the bridge's
   staleness ordering rather than walking a fixed rotation, so the roamer
   revisits a hot shard without touching the others. A measured run closed a
   lap in 36 seconds across 8 known shards - no rotation covers 8 shards in 36
   seconds, and reporting that as a sweep time would be simply wrong.

   So every arrival is logged, and a lap carries the number of DISTINCT shards
   seen during it. A lap whose coverage equals the known shard count is a real
   sweep; anything less is a revisit and is reported as one.

   The distribution matters too, and a median over the whole set hides it. The
   same run produced 36, 93, 93, 125, 241, 241, 241, 243, 251 - nothing at all
   between 125 and 241. That is two populations, not a spread, and averaging
   across them describes neither. fullSweeps is reported separately for exactly
   that reason. */
const VISIT_LOG_MAX = 400;

function noteArrival() {
	const key = shardKey(currentShard());
	const now = Date.now();
	const visits = SS.get('visits', []) || [];

	// How many distinct shards since we were last here, and when that was.
	let prevAt = null, covered = 0;
	for (let i = visits.length - 1; i >= 0; i--) {
		if (visits[i].shard !== key) continue;
		prevAt = visits[i].at;
		const seen = {};
		for (let j = i; j < visits.length; j++) seen[visits[j].shard] = 1;
		seen[key] = 1;
		covered = Object.keys(seen).length;
		break;
	}

	visits.push({ shard: key, at: now });
	while (visits.length > VISIT_LOG_MAX) visits.shift();
	SS.set('visits', visits);

	if (prevAt == null) return null;

	const sec = Math.round((now - prevAt) / 1000);
	const known = serverList().length || null;
	const full = known != null && covered >= known;
	const laps = SS.get('sweep_laps', []) || [];
	laps.push({ shard: key, sec: sec, covered: covered, known: known, full: full,
		at: new Date(now).toISOString() });
	while (laps.length > 200) laps.shift();
	SS.set('sweep_laps', laps);

	log(`back on ${key} after ${sec}s, ${covered}${known ? '/' + known : ''} shard(s) covered`
		+ (full ? ' - full sweep' : ' - partial, revisit not sweep'),
		full ? '#E9C46A' : '#8b98ab');
	return sec;
}

/* Console helper. Reports full sweeps and partial revisits separately, because
   they answer different questions and mixing them answers neither. */
function sweepTimes() {
	const laps = SS.get('sweep_laps', []) || [];
	if (!laps.length) {
		log('no revisit recorded yet - needs a second arrival at a shard already seen', 'orange');
		return { laps: [] };
	}
	const stat = function (list) {
		if (!list.length) return null;
		const s = list.map(function (l) { return l.sec; }).sort(function (a, b) { return a - b; });
		const at = function (q) { return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
		return { n: s.length, medianSec: at(0.5), p90Sec: at(0.9), fastestSec: s[0], slowestSec: s[s.length - 1] };
	};
	const full = laps.filter(function (l) { return l.full; });
	const out = {
		note: 'a lap is a REVISIT interval; only fullSweeps covered every known shard',
		fullSweeps: stat(full),
		partialRevisits: stat(laps.filter(function (l) { return !l.full; })),
		allLapsSec: laps.map(function (l) { return l.sec; }),
		recent: laps.slice(-10),
	};
	if (!full.length) {
		out.warning = 'no lap covered every known shard - there is no measured sweep time here';
	}
	try { show_json(out); } catch (e) { console.log(out); }
	return out;
}

try { parent.sweepTimes = sweepTimes; } catch (e) { }

// --------------------------------------------------------------------- boot
(async function main() {
	const role = myRole();
	log(`${myName()} starting as ${role} - bridge ${CONFIG.bridge}`, '#5ED6A8');
	// A hop restarts this script from the top. Anything the previous run could
	// not hand over is still in storage.
	restoreBuffer();
	if (!CONFIG.roles[myName()]) {
		log(`${myName()} is not in CONFIG.roles - defaulting to parked. A parked `
			+ `scout never hops, so if you meant this one to rotate, add it as `
			+ `'roamer' rather than expecting the default to do it.`, 'orange');
	}
	// Close the lap before either loop starts: this runs once per arrival,
	// because a hop restarts the script from the top.
	if (role === 'roamer') noteArrival();
	try {
		if (role === 'roamer') await roamerLoop();
		else await parkedLoop();
	} catch (e) {
		log('scout stopped: ' + (e && e.stack ? e.stack : e), 'red');
	}
})();
