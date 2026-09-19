// ============================================================================
// Meltymerch (Merchant) - slot CH_aLtHealaSgKdmOsDWpNl8scE9NhXk - v26 (v25 plus: anniversary guard tightened to 5m10s, the agreed arbitrage spec recorded in CONFIG.arbitrage, and a hand-driven PHASE 0 PROBE section that discovers the trade/bank API instead of assuming it. Nothing in the probe runs on its own. Bump this header when you change the file - v24's survived thirteen commits and led a handoff to record this file as untouched)
// ============================================================================
// ============================================================================
// CONFIGURATION
// CAVEAT: send_cm is realm-local - low_potions requests from Dexon/
// FatherToken/MageofOz only reach Meltymerch if he's on their server.
// No auto-follow on server change (unlike the fighters' dragold_hop sync).
// ============================================================================
// ============================================================================
// PARTY LINK - cross-shard messaging for the party, with in-game as its twin
// ============================================================================
// Paste this block near the top of Ranger.js / Priest.js / Mage.js /
// Merchant.js, then make two edits per script (see INTEGRATION at the bottom).
//
// WHY BOTH CHANNELS, NOT A FALLBACK
// send_cm is instant but realm-local: a character on another shard never hears
// it. The bridge reaches everyone but costs a poll interval. Rather than pick
// one and reason about which is reachable - that reasoning is itself a bug
// surface - every message goes out BOTH ways and receivers drop the duplicate.
// Neither channel is load-bearing, and both are exercised constantly, so a
// broken one is obvious immediately instead of at the moment it is needed.
//
// Latency does not argue against this: the party's most frequent message fires
// at 500 potions remaining, and nothing here is sub-second sensitive.
//
// ON MAINFRAME THE BRIDGE HALF SWITCHES ITSELF OFF
// Mainframe runs on Adventure Land's servers, so 127.0.0.1 there is the game
// server, not your PC - the bridge is unreachable by construction. A probe at
// startup settles it, and the same probe covers "the bridge is not running
// yet". When it fails, messaging degrades to exactly today's behaviour:
// send_cm only, no retry storm, one log line. It re-probes occasionally so
// starting the bridge later is picked up without a restart.
// ============================================================================

const PARTY_LINK = {
	url: 'http://127.0.0.1:8787',
	pollMs: 2000,           // how often to collect relayed messages
	reprobeMs: 5 * 60 * 1000,
	timeoutMs: 1500,        // a dead endpoint must fail fast, not hang the loop
	dedupeMs: 5 * 60 * 1000,
	verbose: true,
};

let plUp = false;           // is the bridge reachable right now
let plProbed = 0;           // when we last found out
let plCursor = 0;           // highest relay seq collected
let plSeq = 0;              // our own outgoing counter
const plSeen = new Map();   // message id -> when it may be forgotten

function plLog(msg, color) {
	if (!PARTY_LINK.verbose) return;
	try { game_log('[link] ' + msg, color || '#8b98ab'); } catch (e) { }
}

function plName() {
	try { return character.name; } catch (e) { return '?'; }
}

/* fetch that always settles. On Mainframe fetch may be missing entirely, and a
   request to an unreachable host can otherwise sit there forever. */
function plFetch(path, opts) {
	if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
	const o = Object.assign({}, opts || {});
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(() => { try { ac.abort(); } catch (e) { } }, PARTY_LINK.timeoutMs);
	}
	return Promise.race([
		fetch(PARTY_LINK.url + path, o),
		new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), PARTY_LINK.timeoutMs + 200)),
	]).then((r) => {
		if (stop) clearTimeout(stop);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		return r.json();
	}, (e) => { if (stop) clearTimeout(stop); throw e; });
}

async function plProbe() {
	plProbed = Date.now();
	const was = plUp;
	try {
		await plFetch('/health');
		plUp = true;
		if (!was) plLog('bridge up - messages go out in-game AND through the relay', '#7FD98A');
	} catch (e) {
		plUp = false;
		if (was || plProbed === Date.now()) {
			plLog(typeof fetch !== 'function'
				? 'no fetch here (Mainframe) - relay off, send_cm only'
				: 'bridge unreachable - relay off, send_cm only', 'orange');
		}
	}
	return plUp;
}

/* True the first time an id is seen, false every time after. This is the single
   dedupe point: both channels funnel through it. */
function plFirstTime(id) {
	if (!id) return true;                 // unlinked message, nothing to dedupe
	const now = Date.now();
	for (const [k, exp] of plSeen) if (exp < now) plSeen.delete(k);
	if (plSeen.has(id)) return false;
	plSeen.set(id, now + PARTY_LINK.dedupeMs);
	return true;
}

/* Drop-in for send_cm. Same arguments; sends both ways. */
function plSend(to, payload) {
	const body = Object.assign({}, payload || {});
	if (!body._plid) body._plid = `${plName()}-${Date.now()}-${++plSeq}`;
	/* Stamp where the sender is standing. Doing it here rather than at each
	   call site means every message type gets it for free, and the merchant can
	   work out whether a request needs a shard change without the requester
	   having to think about it. */
	if (!body._plshard) {
		try { body._plshard = { region: parent.server_region, name: parent.server_identifier }; }
		catch (e) { }
	}

	try { send_cm(to, body); } catch (e) { plLog('send_cm failed: ' + e, 'orange'); }

	if (!plUp) {
		if (Date.now() - plProbed > PARTY_LINK.reprobeMs) plProbe();
		return;
	}
	plFetch('/msg', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: plName(),
			to: Array.isArray(to) ? to : (to ? [to] : null),
			id: body._plid,
			payload: body,
		}),
	}).catch(() => { plUp = false; plProbed = Date.now(); });
}

async function plPoll() {
	if (!plUp) {
		if (Date.now() - plProbed > PARTY_LINK.reprobeMs) await plProbe();
		return;
	}
	try {
		const r = await plFetch(`/msg?to=${encodeURIComponent(plName())}&since=${plCursor}`);
		plCursor = r.cursor || plCursor;
		for (const m of (r.messages || [])) {
			// Straight into the script's existing handler, so relayed and in-game
			// messages take exactly the same path. plFirstTime drops whichever
			// copy arrives second.
			try { on_cm(m.frm, m.payload); } catch (e) { plLog('handler error: ' + e, 'orange'); }
		}
	} catch (e) {
		plUp = false;
		plProbed = Date.now();
		plLog('bridge lost - send_cm only until it returns', 'orange');
	}
}

function plStatus() {
	return { bridge: plUp ? 'up' : 'off', cursor: plCursor, deduped: plSeen.size };
}

plProbe();
setInterval(plPoll, PARTY_LINK.pollMs);

const CONFIG = {
	partyMembers: ['Dexon', 'FatherToken', 'MageofOz'],
	// How long to wait for a change_server to actually land before treating the
	// hop as failed and requeueing the work.
	hopTimeoutMs: 30000,
	// The shard this merchant lives on. FIXED, never learned - matches Ranger's
	// homeServer. A cross-shard trip always comes back here, and opening a stand
	// somewhere else never changes where "here" is.
	homeServer: 'USIV',
	scout: {
		enabled: true,
		bridge: 'http://127.0.0.1:8787',
		// earthiverse's ALData, the same feed the watchlist page defaults to. It
		// covers every server continuously and is not affected by whatever this
		// merchant happens to be doing, which matters during a probe: holding
		// the merchant still stops OUR scouting, and then our own bridge is the
		// worst market view available rather than the best. Serves the same row
		// shape as /merchants, so it is a peer source, not a special case.
		aldata: 'https://aldata.earthiverse.ca',
		tickMs: 5000,
		timeoutMs: 1500,
		reprobeMs: 60000,
		settleMs: 1500,
		maxSettlePasses: 5,
		pontyEveryMs: 10 * 60 * 1000,
		pontyTimeoutMs: 8000,
		minPostGapMs: 7000,
		postConfirmRetries: 3,
		// While a probe holds the merchant, the shard it is standing on is still
		// rescanned and reposted this often. Without it the hold starves the
		// bridge it is meant to be probing - see scoutHeldScan.
		heldScanMs: 30000,
		// Be home this long before an anniversary round starts. S.anniversary.next
		// is the round's start time, on the hour, so this is a real deadline
		// rather than a guess.
		//
		// 5m10s, not 6m. The requirement is to be in place five minutes early;
		// the extra minute was padding, and padding here is paid for in forgone
		// arbitrage, which is worth more than one kiss round. Ten seconds of
		// slack is kept because smart_move's last few steps are not instant.
		// Missing the window is not an error: the round is skipped and the
		// merchant carries on as though the event were not running until the
		// next round's guard opens.
		kissGuardMs: 5 * 60 * 1000 + 10 * 1000,
		// Longest a single shard visit may take before the loop assumes it has
		// hung and takes its lock back. Generous: a hop alone can take 30s.
		maxCycleMs: 3 * 60 * 1000,
		skipServers: ['PVP'],
	},

	// ARBITRAGE - the agreed specification, recorded here so it lives with the
	// code rather than in chat history. PHASE 0 uses only `probe`; every other
	// field is inert until Phase 1 flips `enabled`.
	//
	// PRIORITY: arbitrage outranks queued delivery/pickup work and the
	// anniversary round. The combat characters buy their own potions when stock
	// hits zero, so a delayed delivery is an inconvenience rather than a death.
	// The one exception is jobPreemptMs below.
	arbitrage: {
		enabled: false,
		// Per ITEM, not per batch: a marginal item must not ride along on a good
		// one, which would quietly lower the floor.
		minProfit: 500000,
		// HARD reserve. gold - (everything this trade or batch will spend) must
		// still clear this, so a large purchase cannot leave the merchant broke.
		goldFloor: 10000000,
		// Half of the NET profit is banked after each sale - not half the sale
		// value, so the capital spent on the item stays with the merchant and
		// only the gain is split. Never banked on a loss, and losses are not
		// carried forward against a later trade's share.
		bankShare: 0.5,
		// Below this much gold, one trade at a time. At or above it, batching is
		// allowed - multiple units of one item and multiple items in a visit -
		// but ONLY when every buy sits on one shard and every sell sits on one
		// shard. Splitting either leg across shards risks buying what cannot
		// then be sold.
		batchAboveGold: 100000000,
		// A queued delivery/pickup older than this stops the NEXT trade from
		// starting. It never interrupts a trade already in flight: once gold is
		// spent, the item reaches a terminal state (sold or banked) first.
		jobPreemptMs: 10 * 60 * 1000,
		// A buy order older than this is treated as gone rather than as an offer.
		// Matches the watchlist's SPREAD_MAX_AGE_MS: the listing is still worth
		// keeping and showing, it is just not worth travelling to.
		sellMaxAgeSec: 15 * 60,
		// Tax applies ONLY to gold received from another ACCOUNT, and the
		// receiver pays it. Exactly one leg of an arbitrage round trip is
		// therefore taxed:
		//
		//   buy from a player   - gold goes to them; they are taxed, we pay the
		//                         listed price and nothing more.
		//   buy from Ponty      - an NPC receives; nobody is taxed.
		//   sell to a player    - gold arrives here from their account: TAXED.
		//   sell to an NPC      - no account on the other side; untaxed, so
		//                         calculate_item_value is the true net.
		//   own characters      - same account, exempt.
		//
		//   net = sellPrice * (1 - taxRate) - buyPrice      (player buyer)
		//   net = npcValue                  - buyPrice      (NPC buyer)
		//
		// CONSEQUENCE: the sell side is a CHOICE, not a given. A player buy
		// order only beats the vendor once it clears the vendor's price by more
		// than the tax, so the comparison is
		//
		//   max(npcValue, playerBuyPrice * (1 - taxRate))
		//
		// and never playerBuyPrice on its own. At 4% a buy order must sit about
		// 4.2% above vendor value merely to break even against vendoring, so a
		// buy order that looks better on the board can be worse in the hand.
		//
		// SOURCE: kaansoral/adventureland, node/server.js, in
		// calculate_player_stats(), which assigns player.tax from a chain of
		// `level > N && rate` clauses. It is a STEP function, not a smooth
		// decay: no per-level taper, nothing below 1%, nothing above 5%. The
		// bands below were evaluated against that expression at every boundary
		// (1/20/21/50/51/60/61/70/71/80/81/100) and agree at all of them.
		//
		// The published chain carries two consecutive `level > 80` clauses
		// (0.01 then 0.012). `||` short-circuits on the first truthy value, so
		// the second is unreachable and everything above 80 is simply 1%.
		// Transcribed here as the live behaviour rather than the apparent
		// intent, since the server runs the code and not the intent.
		taxBands: [
			{ above: 80, rate: 0.01 },
			{ above: 70, rate: 0.02 },
			{ above: 60, rate: 0.025 },
			{ above: 50, rate: 0.03 },
			{ above: 20, rate: 0.04 },
			{ above: -Infinity, rate: 0.05 },
		],
		probe: {
			// arbProbeCall refuses to spend more than this in one call.
			maxPrice: 10000,
			// The distance walk-in starts this far out and closes in by
			// stepDist until the server stops rejecting the trade.
			startDist: 600,
			stepDist: 50,
		},
	},

	// How many times to retry the journey home before giving up for now. The
	// trip record is kept on failure, so a later batch or restart tries again.
	homeReturnAttempts: 3,

	// Ernis sells HP/MP potions in Mainland, beside Gabriel.
	npc: { name: 'Ernis', map: 'main', x: -35, y: -162 },

	deliveryAmount: 1000,
	restockBuffer: 500, // buy a bit past the delivery amount so stock doesn't immediately dip low again

	// Ranger.js's own clearInventory() already auto-sends items to Meltymerch
	// whenever he's within attack range of Dexon, every ~2s. So "picking up"
	// items just means standing near Dexon long enough for that existing
	// loop to fire - no separate pull mechanism needed.
	pickup: {
		settleMs: 2500,
	},

	// Meltymerch requests a heal from FatherToken when low, but only if
	// FatherToken is actually close enough for partyheal to reach him.
	// partyheal's exact radius isn't documented, so this is a conservative
	// approximation - tune if it turns out too tight or too loose.
	selfHeal: {
		enabled: true,
		hpThreshold: 0.5,
		maxRangeToHealer: 400,
		requestCooldownMs: 5000,
	},

	// Selling junk to an NPC merchant (not the player stand). Start with a
	// short, clearly-low-value whitelist - review/expand based on what
	// actually accumulates from the other three's muling.
	selling: {
		enabled: true,
		whitelist: ['gslime', 'seashell', 'reefglass', 'crabclaw', 'slice_blueberry', 'gem0'],

		// Nothing else in this script actively guards against Meltymerch's
		// own 42 inventory slots filling up - the fighters' own muling logic
		// dumps items on him with no capacity check on his end. Once free
		// slots drop to/below this threshold, sell everything NOT protected
		// (see PROTECTED_ITEM_NAMES and isTier2OrTier3GearItem below)
		// instead of just the small whitelist above.
		aggressiveEnabled: true,
		aggressiveFreeSlotThreshold: 5,
	},

	// Self-sustain using his own hp potion stock.
	potions: {
		hpThreshold: 400,
	},

	// mluck requires level 40 - Meltymerch is 19 at time of writing, so this
	// stays inert until he levels up. Ranger.js's own "location" broadcast
	// fires specifically when Dexon's current mluck isn't sourced from
	// Meltymerch (see needsUpdate in sendLocationUpdate()) - that's the
	// signal this listens for below.
	mluck: {
		minLevel: 40,
		targets: ['Dexon'],
	},

	stand: {
		map: 'main',
		// Candidates inside Merrit's valid zones (square: x -240..240, y -120..144;
		// southern aisle: x -88..88, y 144..360), spread out in case one spot
		// is blocked or too close to another player's stand. Tried in order.
		candidates: [
			{ x: 100, y: 0 },
			{ x: -100, y: 0 },
			{ x: 150, y: 100 },
			{ x: -150, y: 100 },
			{ x: 60, y: -60 },
		],
		// A qualifying listing to keep the stand eligible for Merrit's visits.
		// Uses scroll0 (currently well-stocked, unrelated to delivery potions)
		// rather than competing with the hp/mp reserve. Adjust price to actual
		// market rate - this is a placeholder.
		listing: { itemName: 'scroll0', tradeSlot: 0, price: 500, keepReserve: 100, maxListQuantity: 50 },
	},

	// GEAR PROGRESSION - see the "GEAR PROGRESSION SYSTEM" section below for
	// the full table and logic. This just toggles/paces the loop.
	gearProgression: {
		enabled: true,
		intervalMs: 8000,
	},

	// ANNIVERSARY KISS HUNTER - works on Mainframe (primary source is
	// parent.S.anniversary, confirmed reliable via live testing
	// 2026-09-17). Enabled by default.
	anniversaryKiss: {
		enabled: true, // primary source is now parent.S.anniversary - confirmed reliable via live testing 2026-09-17
		checkIntervalMs: 5000,
		townMap: 'main', // only hunts while already in town, not mid-delivery/farm-support travel
		// When this character IS the featured player there is nobody to go and
		// kiss - others come here. Hold scouting for this long from the moment
		// that is established, so the merchant is actually present and reachable
		// for the people travelling to it. Everything else carries on as normal.
		selfFeaturedHoldMs: 5 * 60 * 1000,
	},

	// The Bank is its own map, reached via a door off 'main' - confirmed via
	// live game data (main's doors include one to 'bank'). bank_store()
	// rejects with "not_in_bank" unless actually standing in this map.
	bank: {
		map: 'bank',
	},
};

const state = {
	queue: [],
	busy: false,
	standOpen: false,
	lastHealRequest: 0,
	kissAttemptedFor: null, // name of the featured player already attempted this round - avoids retrying the same one
	selfFeaturedFor: null,  // the round in which WE were the featured player
	selfFeaturedAt: 0,      // when that was established
};

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TRAVEL HELPER - smart_move with a town() fallback, since a seasonal/event
// map (e.g. halloween) may have no route out once that event ends.
//
// STAND SAFETY - close the stand before any real movement, centralized here
// in travelTo()/travelToBank() (the only functions that call smart_move/
// town/xmove) rather than at each call site. Fixes a real bug: the stand
// used to stay open during a mid-delivery potion restock trip, because that
// trip ran before processBatch()'s own close step.
// ============================================================================
async function ensureStandClosed() {
	if (!state.standOpen) return;
	try {
		await close_stand();
		state.standOpen = false;
	} catch (e) {
		console.error('close_stand failed:', e);
	}
}

async function travelTo(map, x, y) {
	await ensureStandClosed();

	try {
		await smart_move({ map, x, y });
		return true;
	} catch (e) {
		game_log(`smart_move to ${map} (${x}, ${y}) failed: ${e.reason || e} - trying town() fallback`, 'red');
	}

	try {
		await town();
	} catch (e) {
		game_log(`town() fallback also failed: ${e.reason || e} - Meltymerch may be stuck on ${character.map}`, 'red');
		return false;
	}

	// town() only returns to the CURRENT map's town point, not necessarily
	// the target map - so if the target is elsewhere, try the real route
	// again now that we're hopefully out of a dead-end area.
	if (character.map !== map) {
		try {
			await smart_move({ map, x, y });
			return true;
		} catch (e) {
			game_log(`Still can't reach ${map} after town() - Meltymerch is stuck on ${character.map}`, 'red');
			return false;
		}
	}

	return true;
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================
// ============================================================================
// CROSS-SHARD SERVICE
// ============================================================================
// send_cm is realm-local, so before the relay existed a request from another
// shard simply never arrived and the question never came up. Now it does: a
// job can name a shard this character is not on, and serving it means going
// there and coming back.
//
// Only reachable when the relay is up, i.e. in a browser tab. On Mainframe the
// relay is off, so every request that arrives came in-game from someone on this
// same shard and none of this engages.
// ============================================================================
const SHARD_REGIONS = ['ASIA', 'US', 'EU'];

/* This merchant's tax rate on gold received from another account.
 
   Prefers the server's own number. calculate_player_stats assigns player.tax
   server-side, so if it reaches the client then it is authoritative and cannot
   drift when the bands are rebalanced. CONFIG.arbitrage.taxBands is the
   fallback, transcribed from the same function.
 
   Returning null is meaningful: it means neither source produced a usable rate,
   and the profit test must refuse rather than treat the tax as zero. Assuming
   zero over-trades, which is the expensive direction to be wrong in. */
function arbTaxRate() {
	const live = (typeof character !== 'undefined') ? character.tax : undefined;
	if (typeof live === 'number' && isFinite(live) && live >= 0 && live < 1) return live;
	const lvl = (typeof character !== 'undefined') ? character.level : null;
	if (typeof lvl !== 'number' || !isFinite(lvl)) return null;
	for (const b of CONFIG.arbitrage.taxBands) {
		if (lvl > b.above) return b.rate;
	}
	return null;
}

/* What a sale is actually worth after tax, against what a vendor would pay
   untaxed. Phase 1's sell-side decision in one place so the comparison cannot
   be written as a raw price anywhere else. */
function arbNetFromSale(playerPrice, npcValue) {
	const t = arbTaxRate();
	const viaPlayer = (typeof playerPrice === 'number' && isFinite(playerPrice) && t != null)
		? playerPrice * (1 - t) : null;
	const viaNpc = (typeof npcValue === 'number' && isFinite(npcValue)) ? npcValue : null;
	if (viaPlayer == null && viaNpc == null) return null;
	if (viaPlayer == null) return { to: 'npc', net: viaNpc, taxRate: t };
	if (viaNpc == null) return { to: 'player', net: viaPlayer, taxRate: t };
	return (viaPlayer >= viaNpc)
		? { to: 'player', net: viaPlayer, taxRate: t }
		: { to: 'npc', net: viaNpc, taxRate: t };
}

function mShardKey() {
	return String(parent.server_region) + String(parent.server_identifier);
}

function mParseShard(key) {
	for (const r of SHARD_REGIONS) {
		if (key && key.startsWith(r)) return { region: r, name: key.slice(r.length) };
	}
	return null;
}

function mCanHop() {
	return typeof change_server === 'function';
}

/* A cross-shard trip has to survive the hop itself.

   change_server() wipes runtime state in a browser tab - the script restarts -
   and processBatch has already spliced the whole queue OUT of state.queue into
   a local variable by then, so an in-flight batch would be lost twice over. The
   browser tab is also the ONLY place this feature runs, since the relay needs
   the bridge, so that is not an edge case, it is the normal case.

   So before every hop the not-yet-served jobs and the real home shard are
   written to storage, and a restart puts them back. */
const TRIP_KEY = 'merch_trip';

function mLoadTrip() {
	try { const v = get(TRIP_KEY); if (v && Array.isArray(v.pending)) return v; } catch (e) { }
	return null;
}
function mSaveTrip(pending) {
	try { set(TRIP_KEY, { pending: pending || [], at: Date.now() }); } catch (e) { }
}
function mClearTrip() {
	try { set(TRIP_KEY, null); } catch (e) { }
}

/* Where to return to once the trip is done. Read straight from CONFIG and
   never written: home is a decision, not an observation. Learning it from
   wherever the stand happened to open meant one failed return could redefine
   where the merchant lived, and it would then believe it was already home. */
function mHomeShard() {
	return CONFIG.homeServer || mShardKey();
}

/* change_server() drops the connection and reconnects. Mainframe keeps the
   running code across that, so polling until the shard actually changes is the
   reliable way to know we have landed. */
async function mHopTo(key) {
	if (key === mShardKey()) return true;
	const t = mParseShard(key);
	if (!t) { game_log(`Cannot parse shard "${key}"`, 'red'); return false; }
	if (!mCanHop()) {
		game_log(`change_server unavailable - cannot reach ${key}`, 'red');
		return false;
	}
	game_log(`Hopping to ${key}`, '#FFD700');
	try { change_server(t.region, t.name); }
	catch (e) { game_log(`change_server failed: ${e}`, 'red'); return false; }

	const until = Date.now() + CONFIG.hopTimeoutMs;
	while (Date.now() < until) {
		await new Promise(r => setTimeout(r, 1000));
		if (mShardKey() === key) { game_log(`Arrived on ${key}`, '#7FD98A'); return true; }
	}
	game_log(`Hop to ${key} did not land within ${CONFIG.hopTimeoutMs / 1000}s`, 'red');
	return false;
}

function on_cm(name, data) {
	if (!plFirstTime(data && data._plid)) return;   // same message may arrive twice: in-game and relayed
	if (!CONFIG.partyMembers.includes(name)) return;

	// A message with no _plshard came in-game, which means same shard by
	// definition - the pre-relay assumption, still correct.
	const shard = (data._plshard && data._plshard.region)
		? String(data._plshard.region) + String(data._plshard.name)
		: mShardKey();

	if (data.message === 'low_potions') {
		enqueueJob({ type: 'delivery', recipient: name, potion: data.potion, x: data.x, y: data.y, map: data.map, shard });
	}
	if (data.message === 'inventory_almost_full') {
		enqueueJob({ type: 'pickup', recipient: name, emptySlots: data.emptySlots, x: data.x, y: data.y, map: data.map, shard });
	}
	if (data.message === 'location' && CONFIG.mluck.targets.includes(name)) {
		if (character.level >= CONFIG.mluck.minLevel) {
			enqueueJob({ type: 'mluck', recipient: name, x: data.x, y: data.y, map: data.map, shard });
		}
		// Below CONFIG.mluck.minLevel: silently ignored, nothing to do yet.
	}
}

function enqueueJob(job) {
	// Avoid stacking duplicate pending jobs of the same type for the same character.
	const exists = state.queue.some(j => j.type === job.type && j.recipient === job.recipient);
	if (exists) return;
	job.requestedAt = Date.now();
	state.queue.push(job);
	game_log(`Queued ${job.type} for ${job.recipient}`, '#FFD700');
}

function on_party_request(name) {
	if (CONFIG.partyMembers.includes(name)) accept_party_request(name);
}
function on_party_invite(name) {
	if (CONFIG.partyMembers.includes(name)) accept_party_invite(name);
}

// ============================================================================
// DELIVERY / PICKUP QUEUE PROCESSOR
// ============================================================================
async function queueLoop() {
	try {
		if (!state.busy && state.queue.length > 0) {
			state.busy = true;
			await processBatch();
			state.busy = false;
		}
	} catch (e) {
		console.error('queueLoop error:', e);
		state.busy = false;
	}
	setTimeout(queueLoop, 2000);
}
queueLoop();

// ============================================================================
// BATCH PROCESSING - one combined circuit covering every recipient
// currently queued, not just repeated jobs for the same character.
// ============================================================================
async function processBatch() {
	// Pull the ENTIRE current queue into one batch, not just jobs matching
	// the first one's recipient - this is what actually lets multiple
	// different party members get served in a single trip.
	const batch = state.queue.splice(0, state.queue.length);

	const byRecipient = new Map();
	for (const job of batch) {
		if (!byRecipient.has(job.recipient)) byRecipient.set(job.recipient, []);
		byRecipient.get(job.recipient).push(job);
	}

	game_log(`Starting batch: ${batch.length} job(s) across ${byRecipient.size} recipient(s)`, '#FFD700');

	// 1. Compute the TOTAL potions needed across every delivery job in the
	// whole batch, and stock up for that combined total in one trip to
	// Ernis - rather than re-checking and re-buying separately per stop.
	let totalHpNeeded = 0, totalMpNeeded = 0;
	for (const job of batch) {
		if (job.type !== 'delivery') continue;
		if (job.potion === 'mp') totalMpNeeded += CONFIG.deliveryAmount;
		else totalHpNeeded += CONFIG.deliveryAmount;
	}

	if (totalHpNeeded > 0 && quantity('hpot1') < totalHpNeeded) {
		const ok = await ensureStock('hpot1', totalHpNeeded + CONFIG.restockBuffer);
		if (!ok) game_log(`Could not fully stock hpot1 for this batch (have ${quantity('hpot1')}, need ${totalHpNeeded})`, 'red');
	}
	if (totalMpNeeded > 0 && quantity('mpot1') < totalMpNeeded) {
		const ok = await ensureStock('mpot1', totalMpNeeded + CONFIG.restockBuffer);
		if (!ok) game_log(`Could not fully stock mpot1 for this batch (have ${quantity('mpot1')}, need ${totalMpNeeded})`, 'red');
	}

	// 2. Close the stand once for the whole batch.
	if (state.standOpen) {
		try {
			await close_stand();
			state.standOpen = false;
		} catch (e) {
			console.error('close_stand failed:', e);
		}
	}

	// 3. Visit every recipient, grouped by the shard they asked from. Everyone
	// on this shard is served first so the common case costs no travel at all;
	// only then do we go elsewhere. Potions were bought above, before any hop,
	// so a trip never strands us somewhere with an empty bag.
	const home = mHomeShard();
	const here = mShardKey();
	const byShard = new Map();
	for (const [recipientName, jobs] of byRecipient) {
		const k = jobs[0].shard || here;
		if (!byShard.has(k)) byShard.set(k, []);
		byShard.get(k).push([recipientName, jobs]);
	}

	const order = [here, ...[...byShard.keys()].filter(k => k !== here)];
	const served = new Set();
	for (const shard of order) {
		const stops = byShard.get(shard);
		if (!stops || !stops.length) continue;

		if (shard !== mShardKey()) {
			// Everything still outstanding, this shard's stops included, goes to
			// storage before the connection drops.
			const pending = [];
			for (const sh of order) {
				if (served.has(sh)) continue;
				for (const [, jobs] of (byShard.get(sh) || [])) pending.push(...jobs);
			}
			mSaveTrip(pending);

			if (!await mHopTo(shard)) {
				// Requeue rather than drop: the requester still needs this, and a
				// later batch may find the shard reachable.
				for (const [recipientName, jobs] of stops) {
					for (const j of jobs) enqueueJob(j);
				}
				game_log(`Could not reach ${shard} - ${stops.length} stop(s) requeued`, 'red');
				continue;
			}
		}
		for (const [recipientName, jobs] of stops) {
			await visitOneStop(recipientName, jobs);
		}
		served.add(shard);
	}
	mClearTrip();

	// 4. Back to the home shard, then reopen the stand ONCE - after every stop
	// in the batch, not after each recipient.
	if (mShardKey() !== home) {
		let back = false;
		for (let i = 0; i < CONFIG.homeReturnAttempts && !back; i++) {
			back = await mHopTo(home);
			if (!back) game_log(`Return to ${home} failed (${i + 1}/${CONFIG.homeReturnAttempts})`, 'red');
		}
		if (!back) {
			// Keep the trip record open so startup and the next batch both keep
			// trying. Home stays CONFIG.homeServer either way - being stuck
			// somewhere is not the same as living there.
			mSaveTrip([]);
			game_log(`Still off-home on ${mShardKey()}; will keep trying to reach ${home}`, 'red');
		}
	}
	await openStandAtBestSpot();
}

// ============================================================================
// VISIT LOGIC - handles delivery and/or pickup jobs for one recipient,
// as one stop within a larger batch (no travel-home step here).
//
// Strategy: try everything at the current location first. Whatever can't be
// done because the recipient isn't actually in range gets a "come to me"
// summon instead of just failing - then waits for them to arrive before
// retrying, and tells them to resume their normal routine once done.
// ============================================================================
async function visitOneStop(recipientName, jobs) {
	const deliveryJobs = jobs.filter(j => j.type === 'delivery');
	const wantsPickup = jobs.some(j => j.type === 'pickup');
	const wantsMluck = CONFIG.mluck.targets.includes(recipientName);
	const locJob = jobs[jobs.length - 1]; // most recent location data across all bundled jobs

	game_log(`Visiting ${recipientName}: ${jobs.map(j => j.type).join(' + ')}`, '#FFD700');

	// Travel to the recipient's best-known location.
	await travelToRecipient(locJob);

	let remaining = { deliveries: deliveryJobs, pickup: wantsPickup, mluck: wantsMluck };
	remaining = await attemptActions(recipientName, remaining);

	const stillNeeded = remaining.deliveries.length > 0 || remaining.pickup || remaining.mluck;
	if (!stillNeeded) return;

	// Couldn't complete everything from here - summon them instead of
	// just giving up.
	const arrived = await summonAndWait(recipientName);
	if (arrived) {
		remaining = await attemptActions(recipientName, remaining);
		const stillMissing = remaining.deliveries.length > 0 || remaining.pickup || remaining.mluck;
		if (stillMissing) {
			game_log(`${recipientName} arrived but some actions still couldn't complete`, 'red');
		}
	} else {
		game_log(`${recipientName} never arrived - giving up on remaining actions this trip`, 'red');
	}

	// Let them resume their normal routine either way - they may have
	// started heading over even if we gave up waiting.
	plSend(recipientName, { message: 'merchant_done' });
}

// Attempts whichever actions are actually possible right now (recipient
// visible and in the right range for each specific action). Returns
// whatever's still outstanding.
async function attemptActions(recipientName, remaining) {
	const target = get_player(recipientName);
	if (!target) return remaining; // can't see them at all right now

	const stillDeliveries = [];
	for (const dj of remaining.deliveries) {
		const itemName = dj.potion === 'mp' ? 'mpot1' : 'hpot1';

		if (!is_in_range(target, 'attack')) {
			stillDeliveries.push(dj);
			continue;
		}

		const slot = locate_item(itemName);
		if (slot === -1 || quantity(itemName) < CONFIG.deliveryAmount) {
			game_log(`Not enough ${itemName} left for ${recipientName} - skipping (not a range issue)`, 'red');
			continue; // not something summoning them would fix
		}

		try {
			await send_item(recipientName, slot, CONFIG.deliveryAmount);
			game_log(`Delivered ${CONFIG.deliveryAmount} ${itemName} to ${recipientName}`, '#00FF00');
		} catch (e) {
			// Could still be a last-instant range hiccup - give the summon
			// path a chance rather than dropping it outright.
			stillDeliveries.push(dj);
		}
	}

	let stillPickup = remaining.pickup;
	if (remaining.pickup && is_in_range(target, 'attack')) {
		await pickupItemsFrom(recipientName);
		stillPickup = false;
	}

	let stillMluck = remaining.mluck;
	if (remaining.mluck) {
		if (character.level < CONFIG.mluck.minLevel) {
			stillMluck = false; // not eligible regardless of range - summoning won't help
		} else if (is_in_range(target, 'mluck')) {
			await tryCastMluck(recipientName);
			stillMluck = false;
		}
	}

	return { deliveries: stillDeliveries, pickup: stillPickup, mluck: stillMluck };
}

// Asks the recipient to come to Meltymerch's current spot, then polls for
// their arrival up to a timeout.
async function summonAndWait(recipientName) {
	plSend(recipientName, {
		message: 'come_to_merchant',
		x: character.x,
		y: character.y,
		map: character.map,
	});
	game_log(`${recipientName} wasn't in range - asked them to come to Meltymerch`, '#FFD700');

	const timeoutMs = 60000;
	const pollMs = 1000;
	const start = Date.now();

	while (Date.now() - start < timeoutMs) {
		await sleep(pollMs);
		if (character.rip) {
			game_log('Meltymerch died while waiting - abandoning this summon', 'red');
			return false;
		}
		const target = get_player(recipientName);
		if (target && is_in_range(target, 'attack')) return true;
	}
	return false;
}

async function tryCastMluck(targetName) {
	if (character.level < CONFIG.mluck.minLevel) return;
	if (is_on_cooldown('mluck')) return;

	const target = get_player(targetName);
	if (!target) return;

	const needsRefresh = !target.s?.mluck || target.s.mluck.f !== character.name;
	if (!needsRefresh) return;
	if (!is_in_range(target, 'mluck')) return;

	try {
		await use_skill('mluck', target);
		game_log(`Cast mluck on ${targetName}`, '#00FF00');
	} catch (e) {
		game_log(`mluck on ${targetName} failed: ${e.reason || e}`, 'red');
	}
}

async function pickupItemsFrom(recipientName) {
	// The fighters' own clearInventory()/muling logic already auto-sends
	// items to Meltymerch whenever he's within range - no pull mechanism
	// needed here, just linger long enough for that loop (every ~2s on
	// their end) to get a chance to fire while we're actually here.
	game_log(`Waiting near ${recipientName} to receive overflow items...`, '#FFD700');
	await sleep(CONFIG.pickup.settleMs);
}

async function ensureStock(itemName, targetAmount) {
	if (character.map !== CONFIG.npc.map || distance(character, CONFIG.npc) > 300) {
		const arrived = await travelTo(CONFIG.npc.map, CONFIG.npc.x, CONFIG.npc.y);
		if (!arrived) return false;
	}

	const needed = targetAmount - quantity(itemName);
	if (needed <= 0) return true;

	try {
		await buy_with_gold(itemName, needed);
	} catch (e) {
		game_log(`Buying ${itemName} failed: ${e.reason || e}`, 'red');
	}

	// Compare against the actual amount the caller asked for, not a fixed
	// single-delivery figure - this matters now that ensureStock() can be
	// called with a much larger combined-batch target.
	return quantity(itemName) >= targetAmount;
}

async function travelToRecipient(job) {
	// Prefer the recipient's live position if they're currently trackable
	// (same server, visible); fall back to the coordinates from their
	// request otherwise.
	let target = get_player(job.recipient);
	if (target) {
		await travelTo(target.map || job.map, target.x, target.y);
	} else if (job.map) {
		await travelTo(job.map, job.x, job.y);
	} else {
		game_log(`No location data for ${job.recipient} - cannot travel to deliver`, 'red');
		return;
	}

	// They may have moved since sending the request - nudge closer once we
	// arrive if they're now trackable and not yet in range.
	target = get_player(job.recipient);
	if (target && !is_in_range(target, 'attack')) {
		try {
			await ensureStandClosed();
			await xmove(target.x, target.y);
		} catch (e) {
			// Best effort - proceed to the delivery attempt regardless.
		}
	}
}

// ============================================================================
// STAND MANAGEMENT
// ============================================================================
/* A stand only belongs on the home shard.

   Every hop reloads the page, so STARTUP now runs on whatever shard the scout
   just landed on - and startup opened a stand there. That is the eight
   "Stand opened at (100, 0)" lines seen across one rotation: a stand raised on
   a remote shard nobody is looking at, closed again by the next tick, and
   raised again after the next hop. Pointless work, and it advertises the
   merchant somewhere it will not be in thirty seconds. */
function shouldHoldStand() {
	return mShardKey() === mHomeShard();
}

async function openStandAtBestSpot() {
	if (!shouldHoldStand()) {
		// Not an error: mid-rotation is the normal case for this path now.
		return;
	}

	const slot = locate_item('stand0');
	if (slot === -1) {
		game_log('No stand0 item owned - cannot open a stand', 'red');
		return;
	}

	for (const spot of CONFIG.stand.candidates) {
		try {
			if (character.map !== CONFIG.stand.map || distance(character, spot) > 20) {
				const arrived = await travelTo(CONFIG.stand.map, spot.x, spot.y);
				if (!arrived) continue; // try the next candidate rather than getting stuck on one
			}
			await open_stand(slot);
			state.standOpen = true;
			game_log(`Stand opened at (${spot.x}, ${spot.y})`, '#00FF00');
			await ensureListing();
			return;
		} catch (e) {
			game_log(`Stand placement at (${spot.x}, ${spot.y}) failed: ${e.reason || e} - trying next spot`, 'red');
		}
	}

	game_log('Could not open stand at any candidate location', 'red');
}

async function ensureListing() {
	const cfg = CONFIG.stand.listing;
	const slot = locate_item(cfg.itemName);
	if (slot === -1) return;

	const availableToList = Math.min(cfg.maxListQuantity, quantity(cfg.itemName) - cfg.keepReserve);
	if (availableToList <= 0) return;

	try {
		await trade(slot, cfg.tradeSlot, cfg.price, availableToList);
		game_log(`Listed ${availableToList}x ${cfg.itemName} for sale`, '#00FF00');
	} catch (e) {
		// Likely already listed from a previous run - not critical.
		console.error('ensureListing:', e);
	}
}

function sendUpdates() {
	// This action refreshes a UI panel in a real browser tab and is rejected
	// outright on Mainframe ("Action send_updates is unavailable") - not
	// harmful, but spams the log every 20s for no benefit there.
	if (!parent.$) return;
	parent.socket.emit('send_updates', {});
}
setInterval(sendUpdates, 20000);

// ============================================================================
// SELF-HEAL REQUEST - matches Priest.js's existing "Heal Merch" listener
// ============================================================================
async function selfHealLoop() {
	try {
		const cfg = CONFIG.selfHeal;
		if (cfg.enabled && character.hp / character.max_hp < cfg.hpThreshold) {
			const healer = get_player('FatherToken');
			const now = Date.now();
			if (
				healer &&
				distance(character, healer) <= cfg.maxRangeToHealer &&
				now - state.lastHealRequest > cfg.requestCooldownMs
			) {
				plSend('FatherToken', { message: 'Heal Merch' });
				state.lastHealRequest = now;
				game_log('Requested heal from FatherToken', '#FFD700');
			}
		}
	} catch (e) {
		console.error('selfHealLoop error:', e);
	}
	setTimeout(selfHealLoop, 1000);
}
selfHealLoop();

// ============================================================================
// SELF-SUSTAIN - use his own hp potion stock when in need
// ============================================================================
async function potionLoop() {
	try {
		const hpThreshold = character.max_hp - CONFIG.potions.hpThreshold;
		if (character.hp < hpThreshold && !is_on_cooldown('use_hp')) {
			use_skill('use_hp');
		}
	} catch (e) {
		console.error('potionLoop error:', e);
	}
	setTimeout(potionLoop, 100);
}
potionLoop();

// ============================================================================
// SELLING TRASH TO AN NPC MERCHANT (not the player stand)
// ============================================================================
function sellTrash() {
	if (!CONFIG.selling.enabled) return;
	const whitelist = new Set(CONFIG.selling.whitelist);
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && whitelist.has(item.name) && item.p === undefined && item.l !== 'l') {
			sell(i);
		}
	}
}

// ============================================================================
// AGGRESSIVE SELLING WHEN LOW ON SPACE - see CONFIG.selling.aggressive*.
// Never sells a tier 2/3 gear-progression item (per explicit instruction).
// Tier 1 items are NOT protected - if one is mid-compound when space runs
// low, this can sell it out from under the auto-combine logic. That's the
// rule working as specified: tier 1 gear is treated as ordinary junk.
// ============================================================================
const PROTECTED_ITEM_NAMES = new Set([
	'hpot0', 'hpot1', 'mpot0', 'mpot1',
	'scroll0', 'scroll1', 'scroll2', 'scroll3', 'scroll4',
	'cscroll0', 'cscroll1', 'cscroll2', 'cscroll3', 'cscroll4',
	'offeringp', 'offering', 'offeringx',
	'stand0',
]);

function isTier2OrTier3GearItem(itemName) {
	for (const cls of PARTY_CLASSES) {
		const tiers = GEAR_PROGRESSION[cls];
		if (!tiers) continue;
		for (let tierIdx = 1; tierIdx <= 2; tierIdx++) { // tier 2 = index 1, tier 3 = index 2
			const tier = tiers[tierIdx];
			if (!tier) continue;
			for (const slotName in tier) {
				const entry = tier[slotName];
				if (entry && entry.item === itemName) return true;
			}
		}
	}
	return false;
}

function freeInventorySlots() {
	return character.items.reduce((count, item) => count + (item ? 0 : 1), 0);
}

function sellAggressivelyIfLowOnSpace() {
	const cfg = CONFIG.selling;
	if (!cfg.aggressiveEnabled) return;
	if (freeInventorySlots() > cfg.aggressiveFreeSlotThreshold) return;

	let sold = 0;
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (!item || !item.name) continue;
		if (item.p !== undefined || item.l === 'l') continue; // already listed for sale, or locked - can't sell either way
		if (PROTECTED_ITEM_NAMES.has(item.name)) continue;
		if (isTier2OrTier3GearItem(item.name)) continue;

		try {
			sell(i);
			sold++;
		} catch (e) {
			// Best effort - some items (quest items, etc.) may reject a sell
			// outright; skip and keep going rather than aborting the pass.
		}
	}
	if (sold > 0) {
		game_log(`Low on inventory space - sold ${sold} item(s) to make room`, '#FFA500');
	}
}

async function maintenanceLoop() {
	try {
		// sellTrash moves gold. Left running during a probe it would land inside
		// the before/after window of a measured trade and be read as tax.
		if (!PROBE.hold) {
			sellTrash();
			sellAggressivelyIfLowOnSpace();
		}
		if (character.rip) respawn();
	} catch (e) {
		console.error('maintenanceLoop error:', e);
	}
	setTimeout(maintenanceLoop, 2000);
}
// NOT called here - it now references GEAR_PROGRESSION/PARTY_CLASSES from
// the "GEAR PROGRESSION SYSTEM" section further down this file, which are
// `const` declarations not yet initialized at this point in top-to-bottom
// script load. Calling it immediately here would throw a
// "Cannot access before initialization" error the moment this script
// loads. Started instead from STARTUP, after that section has run.

// ============================================================================
// GEAR PROGRESSION SYSTEM (see [[gear-progression-system]] memory note).
// Decides whether a muled-over item is worth upgrading/compounding toward
// its class's gear plan, one step at a time. Also: auto-compounds any 3+
// identical items at level 0/1 regardless of the plan (junk piles up fast),
// and banks a plan item once it hits the highest level any class calls for.
//
// GEAR_PROGRESSION only populates ranger/priest/mage (the party's classes).
// Tier-3 levels use letter codes - see LEVEL_CODES. Several item names are
// shared across classes; PARTY_CLASSES's order (ranger > priest > mage) is
// the attribution priority when a shared-name item arrives, since there's
// no way to know which character actually sent it.
const LEVEL_CODES = { X: 10, Y: 11, Z: 12, V: 5 };

function decodeLevel(raw) {
	if (typeof raw === 'number') return raw;
	if (LEVEL_CODES[raw] !== undefined) return LEVEL_CODES[raw];
	throw new Error(`Unrecognized gear-progression level code: ${raw}`);
}

const GEAR_PROGRESSION = {
	ranger: [
		{
			// Uses the dexterity-stat set (dexbelt/dexring/dexamulet), not
			// the generic shared items. orbg@1 compound is the shared
			// tier1 orb goal across all three classes.
			// earring1: { item: 'dexearring', level: 1, method: 'compound' }, helmet: { item: 'helmet', level: 6, method: 'upgrade' }, earring2: { item: 'dexearring', level: 1, method: 'compound' }, amulet: { item: 'dexamulet', level: 2, method: 'compound' },
			// mainhand: { item: 'firebow', level: 5, method: 'upgrade' }, chest: { item: 'coat', level: 6, method: 'upgrade' }, offhand: { item: 't2quiver', level: 5, method: 'upgrade' }, cape: { item: 'bcape', level: 4, method: 'upgrade' },
			// ring1: { item: 'dexring', level: 2, method: 'compound' }, pants: { item: 'pants', level: 6, method: 'upgrade' }, ring2: { item: 'dexring', level: 2, method: 'compound' }, belt: { item: 'dexbelt', level: 1, method: 'compound' },
			// orb: { item: 'orbg', level: 1, method: 'compound' }, shoes: { item: 'shoes', level: 6, method: 'upgrade' }, gloves: { item: 'gloves', level: 6, method: 'upgrade' }, elixir: null,
		},
		{
			// Pants are plain, not starkillers - that item is
			// class-restricted to mage/priest and a ranger can't equip it.
			earring1: { item: 'dexearring', level: 4, method: 'compound' }, helmet: { item: 'fury', level: 4, method: 'upgrade' }, earring2: { item: 'dexearring', level: 4, method: 'compound' }, amulet: { item: 'dexamulet', level: 4, method: 'compound' },
			mainhand: { item: 'firebow', level: 9, method: 'upgrade' }, chest: { item: 'coat', level: 9, method: 'upgrade' }, offhand: { item: 't2quiver', level: 7, method: 'upgrade' }, cape: { item: 'ecape', level: 7, method: 'upgrade' },
			ring1: { item: 'cring', level: 3, method: 'compound' }, pants: { item: 'pants', level: 9, method: 'upgrade' }, ring2: { item: 'suckerpunch', level: 0, method: 'compound' }, belt: { item: 'dexbelt', level: 3, method: 'compound' },
			orb: { item: 'orbofdex', level: 3, method: 'compound' }, shoes: { item: 'wingedboots', level: 8, method: 'upgrade' }, gloves: { item: 'supermittens', level: 5, method: 'upgrade' }, elixir: null,
		},
		{
			// Pants are plain, not starkillers - same class-restriction as tier2.
			earring1: { item: 'dexearring', level: 5, method: 'compound' }, helmet: { item: 'fury', level: 8, method: 'upgrade' }, earring2: { item: 'dexearring', level: 5, method: 'compound' }, amulet: { item: 'dexamulet', level: 5, method: 'compound' },
			mainhand: { item: 'firebow', level: 10, method: 'upgrade' }, chest: { item: 'tshirt9', level: 4, method: 'upgrade' }, offhand: { item: 'alloyquiver', level: 9, method: 'upgrade' }, cape: { item: 'ecape', level: 9, method: 'upgrade' },
			ring1: { item: 'suckerpunch', level: 2, method: 'compound' }, pants: { item: 'pants', level: 10, method: 'upgrade' }, ring2: { item: 'suckerpunch', level: 2, method: 'compound' }, belt: { item: 'dexbelt', level: 5, method: 'compound' },
			orb: { item: 'orbofdex', level: 5, method: 'compound' }, shoes: { item: 'wingedboots', level: 10, method: 'upgrade' }, gloves: { item: 'supermittens', level: 6, method: 'upgrade' }, elixir: null,
		},
	],
	priest: [
		{
			// Uses the intelligence-stat set (intbelt/intamulet). orbg@1
			// compound is the shared tier1 orb goal across all three classes.
			// earring1: { item: 'intearring', level: 1, method: 'compound' }, helmet: { item: 'wcap', level: 5, method: 'upgrade' }, earring2: { item: 'intearring', level: 1, method: 'compound' }, amulet: { item: 'intamulet', level: 2, method: 'compound' },
			// mainhand: { item: 'firestaff', level: 5, method: 'upgrade' }, chest: { item: 'wattire', level: 5, method: 'upgrade' }, offhand: { item: 'wshield', level: 4, method: 'upgrade' }, cape: { item: 'bcape', level: 4, method: 'upgrade' },
			// ring1: { item: 'ringsj', level: 2, method: 'compound' }, pants: { item: 'wbreeches', level: 5, method: 'upgrade' }, ring2: { item: 'ringsj', level: 2, method: 'compound' }, belt: { item: 'intbelt', level: 1, method: 'compound' },
			// orb: { item: 'orbg', level: 1, method: 'compound' }, shoes: { item: 'wshoes', level: 5, method: 'upgrade' }, gloves: { item: 'wgloves', level: 5, method: 'upgrade' }, elixir: null,
		},
		{
			// Cape is Grinch's Cape (gcape)@7, upgrade - confirmed by user.
			earring1: { item: 'cearring', level: 3, method: 'compound' }, helmet: { item: 'hhelmet', level: 6, method: 'upgrade' }, earring2: { item: 'cearring', level: 3, method: 'compound' }, amulet: { item: 'intamulet', level: 4, method: 'compound' },
			mainhand: { item: 'lmace', level: 6, method: 'upgrade' }, chest: { item: 'harmor', level: 6, method: 'upgrade' }, offhand: { item: 'mshield', level: 6, method: 'upgrade' }, cape: { item: 'gcape', level: 7, method: 'upgrade' },
			ring1: { item: 'cring', level: 3, method: 'compound' }, pants: { item: 'starkillers', level: 5, method: 'upgrade' }, ring2: { item: 'cring', level: 3, method: 'compound' }, belt: { item: 'intbelt', level: 4, method: 'compound' },
			orb: { item: 'rabbitsfoot', level: 1, method: 'compound' }, shoes: { item: 'wingedboots', level: 8, method: 'upgrade' }, gloves: { item: 'supermittens', level: 5, method: 'upgrade' }, elixir: null,
		},
		{
			earring1: { item: 'cearring', level: 5, method: 'compound' }, helmet: { item: 'xhelmet', level: 8, method: 'upgrade' }, earring2: { item: 'cearring', level: 5, method: 'compound' }, amulet: { item: 'mpxamulet', level: 2, method: 'compound' },
			mainhand: { item: 'lmace', level: 9, method: 'upgrade' }, chest: { item: 'vattire', level: 8, method: 'upgrade' }, offhand: { item: 'mshield', level: 9, method: 'upgrade' }, cape: { item: 'bcape', level: 8, method: 'upgrade' },
			ring1: { item: 'zapper', level: 1, method: 'compound' }, pants: { item: 'starkillers', level: 8, method: 'upgrade' }, ring2: { item: 'zapper', level: 1, method: 'compound' }, belt: { item: 'sbelt', level: 2, method: 'compound' },
			orb: { item: 'rabbitsfoot', level: 3, method: 'compound' }, shoes: { item: 'wingedboots', level: 10, method: 'upgrade' }, gloves: { item: 'mpxgloves', level: 6, method: 'upgrade' }, elixir: null,
		},
	],
	mage: [
		{
			// Plain-basics + Fiery Staff, not priest's Wanderer's set - mage
			// doesn't use that set. orbg@1 compound is the shared tier1 orb
			// goal across all three classes.
			// earring1: { item: 'intearring', level: 1, method: 'compound' }, helmet: { item: 'helmet', level: 6, method: 'upgrade' }, earring2: { item: 'intearring', level: 1, method: 'compound' }, amulet: { item: 'intamulet', level: 1, method: 'compound' },
			// mainhand: { item: 'firestaff', level: 5, method: 'upgrade' }, chest: { item: 'coat', level: 6, method: 'upgrade' }, offhand: { item: 'wbook0', level: 2, method: 'compound' }, cape: { item: 'bcape', level: 4, method: 'upgrade' },
			// ring1: { item: 'ringsj', level: 2, method: 'compound' }, pants: { item: 'pants', level: 6, method: 'upgrade' }, ring2: { item: 'ringsj', level: 2, method: 'compound' }, belt: { item: 'intbelt', level: 1, method: 'compound' },
			// orb: { item: 'orbg', level: 1, method: 'compound' }, shoes: { item: 'shoes', level: 6, method: 'upgrade' }, gloves: { item: 'gloves', level: 6, method: 'upgrade' }, elixir: null,
		},
		{
			earring1: { item: 'cearring', level: 3, method: 'compound' }, helmet: { item: 'mageshood', level: 7, method: 'upgrade' }, earring2: { item: 'cearring', level: 3, method: 'compound' }, amulet: { item: 'intamulet', level: 4, method: 'compound' },
			mainhand: { item: 'firestaff', level: 9, method: 'upgrade' }, chest: { item: 'coat', level: 9, method: 'upgrade' }, offhand: { item: 'wbook0', level: 4, method: 'compound' }, cape: { item: 'ecape', level: 7, method: 'upgrade' },
			ring1: { item: 'cring', level: 3, method: 'compound' }, pants: { item: 'pants', level: 9, method: 'upgrade' }, ring2: { item: 'cring', level: 3, method: 'compound' }, belt: { item: 'intbelt', level: 4, method: 'compound' },
			orb: { item: 'jacko', level: 3, method: 'compound' }, shoes: { item: 'wingedboots', level: 8, method: 'upgrade' }, gloves: { item: 'supermittens', level: 5, method: 'upgrade' }, elixir: null,
		},
		{
			// Mainhand is Blaster (gstaff), a two-handed great_staff - no offhand.
			earring1: { item: 'cearring', level: 5, method: 'compound' }, helmet: { item: 'mageshood', level: 9, method: 'upgrade' }, earring2: { item: 'cearring', level: 5, method: 'compound' }, amulet: { item: 'intamulet', level: 5, method: 'compound' },
			mainhand: { item: 'gstaff', level: 9, method: 'upgrade' }, chest: { item: 'tshirt9', level: 6, method: 'upgrade' }, offhand: null, cape: { item: 'ecape', level: 9, method: 'upgrade' },
			ring1: { item: 'zapper', level: 1, method: 'compound' }, pants: { item: 'starkillers', level: 8, method: 'upgrade' }, ring2: { item: 'cring', level: 5, method: 'compound' }, belt: { item: 'intbelt', level: 5, method: 'compound' },
			orb: { item: 'jacko', level: 5, method: 'compound' }, shoes: { item: 'wingedboots', level: 10, method: 'upgrade' }, gloves: { item: 'supermittens', level: 8, method: 'upgrade' }, elixir: null,
		},
	],
	paladin: [null, null, null],
	rogue: [null, null, null],
	warrior: [null, null, null],
};

const PARTY_CLASSES = ['ranger', 'priest', 'mage'];

const GOLD_RULES = {
	minToStart: 1500000,
	minReserve: 1000000,
};
function canStartSpending(currentGold) { return currentGold > GOLD_RULES.minToStart; }
function canAffordStep(currentGold, stepCost) { return (currentGold - stepCost) >= GOLD_RULES.minReserve; }

function validateGearProgression() {
	for (const cls in GEAR_PROGRESSION) {
		GEAR_PROGRESSION[cls].forEach((tier, tierIdx) => {
			if (!tier) return;
			for (const slotName in tier) {
				const entry = tier[slotName];
				if (!entry) continue;
				if (entry.item && (entry.level === null || entry.level === undefined)) {
					throw new Error(`GEAR_PROGRESSION.${cls}[tier ${tierIdx + 1}].${slotName} has item "${entry.item}" but no level.`);
				}
				if (entry.item && !entry.method) {
					throw new Error(`GEAR_PROGRESSION.${cls}[tier ${tierIdx + 1}].${slotName} has item "${entry.item}" but no method.`);
				}
			}
		});
	}
}
validateGearProgression();

// Given an item ({name, level}), find whether it's part of ANY party
// class's progression, at any tier, and still below that tier's target.
// Matches by item name alone - no need to know which named slot it's for.
function findCandidacy(item) {
	if (!item || !item.name) return null;

	for (const cls of PARTY_CLASSES) {
		const tiers = GEAR_PROGRESSION[cls];
		if (!tiers) continue;

		for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
			const tier = tiers[tierIdx];
			if (!tier) continue;

			for (const slotName in tier) {
				const slotGoal = tier[slotName];
				if (!slotGoal || slotGoal.item !== item.name) continue;

				const method = slotGoal.method;
				if (typeof slotGoal.level === 'string') {
					const codedMethod = slotGoal.level === 'V' ? 'compound' : 'upgrade';
					if (codedMethod !== method) {
						throw new Error(`Slot "${slotName}" (${cls}, tier ${tierIdx + 1}) has method "${method}" but code "${slotGoal.level}" implies ${codedMethod}.`);
					}
				}

				const targetLevel = decodeLevel(slotGoal.level);
				const currentLevel = item.level || 0;
				if (currentLevel >= targetLevel) continue; // this particular entry's goal is already met - keep scanning, another entry might not be

				return { class: cls, slot: slotName, tier: tierIdx + 1, targetLevel, method };
			}
		}
	}

	return null;
}

// True if this item name appears ANYWHERE in the gear plan, regardless of
// current level - used to distinguish "done, ready to bank" (matched but
// findCandidacy returned null) from "not tracked at all" (never matched).
function isKnownGearItem(itemName) {
	for (const cls of PARTY_CLASSES) {
		const tiers = GEAR_PROGRESSION[cls];
		if (!tiers) continue;
		for (const tier of tiers) {
			if (!tier) continue;
			for (const slotName in tier) {
				const entry = tier[slotName];
				if (entry && entry.item === itemName) return true;
			}
		}
	}
	return false;
}

// ----------------------------------------------------------------------------
// COST / PROBABILITY MATH - reused from the Upgrade & Compound Cost
// Calculator's pure probability functions (getUpgradeChance/getCompoundChance),
// scoped down to a single greedy next-step choice rather than a full
// multi-step plan, since execution re-evaluates after every real attempt
// anyway (success/failure is random).
// ----------------------------------------------------------------------------
function buildCosts() {
	const g = (name, fallback) => (typeof G !== 'undefined' && G.items && G.items[name]) ? G.items[name].g : fallback;
	return {
		scroll: [g('scroll0'), g('scroll1'), g('scroll2'), g('scroll3'), g('scroll4', 50000000000)],
		cscroll: [g('cscroll0'), g('cscroll1'), g('cscroll2'), g('cscroll3'), g('cscroll4', 50000000000)],
		offering: [0, g('offeringp'), g('offering'), g('offeringx')],
	};
}
// Real values as of the check performed while building this (US IV,
// 2026-09-15) - fallback only; buildCosts() always prefers live G data.
const KNOWN_COSTS_SNAPSHOT = {
	scroll: [1000, 40000, 1600000, 480000000, 640000000],
	cscroll: [6400, 240000, 9200000, 1840000000, 50000000000],
	offering: [0, 480000, 27420000, 242064000],
};
const COSTS = (typeof G !== 'undefined' && G.items) ? buildCosts() : KNOWN_COSTS_SNAPSHOT;

const MANUAL_IGRADE = { lostearring: 2 };
const UPGRADES = {
	0: { 1: .9999999, 2: .98, 3: .95, 4: .7, 5: .6, 6: .4, 7: .25, 8: .15, 9: .07, 10: .024, 11: .14, 12: .11 },
	1: { 1: .99998, 2: .97, 3: .94, 4: .68, 5: .58, 6: .38, 7: .24, 8: .14, 9: .066, 10: .018, 11: .13, 12: .1 },
	2: { 1: .97, 2: .94, 3: .92, 4: .64, 5: .52, 6: .32, 7: .232, 8: .13, 9: .062, 10: .015, 11: .12, 12: .09 }
};
const COMPOUNDS = {
	0: { 1: .99, 2: .75, 3: .4, 4: .25, 5: .2, 6: .1, 7: .08, 8: .05, 9: .05, 10: .05 },
	1: { 1: .9, 2: .7, 3: .4, 4: .2, 5: .15, 6: .08, 7: .05, 8: .05, 9: .05, 10: .03 },
	2: { 1: .8, 2: .6, 3: .32, 4: .16, 5: .1, 6: .05, 7: .03, 8: .03, 9: .03, 10: .02 }
};
const SCROLL_NAMES = { upgrade: ['scroll0', 'scroll1', 'scroll2', 'scroll3', 'scroll4'], compound: ['cscroll0', 'cscroll1', 'cscroll2', 'cscroll3', 'cscroll4'] };
const OFFERING_NAMES = ['none', 'offeringp', 'offering', 'offeringx'];
// Verified against live NPC data: 'offeringp' and 'offeringx' have NO
// vendor anywhere in the game - offeringp is drop-only (bscorpion,
// fvampire, market parcels), offeringx is craft-only (10x offering +
// essences + 32,000,000 gold). Only index 0 ("none", no purchase needed)
// and index 2 ("offering", sold by Garwyn) can actually be bought, so
// those are the only ones the planner is allowed to select.
const BUYABLE_OFFERING_INDICES = [0, 2];

const gradeCache = {};
const getIgrade = n => gradeCache[n] ?? (gradeCache[n] = MANUAL_IGRADE[n] ?? item_grade({ name: n, level: 0 }));
const tableLookup = (table, igrade, level) => table[igrade]?.[level] ?? null;

function offeringGradeOf(offeringIdx) {
	if (offeringIdx === 0) return null;
	const names = [null, 'offeringp', 'offering', 'offeringx'];
	if (typeof G !== 'undefined' && G.items && G.items[names[offeringIdx]]) return G.items[names[offeringIdx]].grade;
	return [null, 1, 2, 3][offeringIdx];
}

function getUpgradeChance(item, scrollGrade, offeringIdx) {
	const igrade = getIgrade(item.name), grade = item_grade(item);
	if (grade > scrollGrade) return { chance: 0 };
	const new_level = (item.level || 0) + 1;
	const oprobability = tableLookup(UPGRADES, igrade, new_level);
	if (oprobability == null) return { chance: 0 };
	let probability = oprobability;
	let grace = Math.max(0, Math.min(new_level + 1, (item.grace || 0) + igrade));
	grace = (probability * grace) / new_level + grace / 1000;
	let high = false;
	if (scrollGrade > grade && new_level <= 10) { probability = probability * 1.2 + 0.01; high = true; }
	if (offeringIdx > 0) {
		const offeringGrade = offeringGradeOf(offeringIdx);
		const diff = offeringGrade - grade;
		if (diff > 1) probability = probability * 1.7 + grace * 4, high = true;
		else if (diff > 0) probability = probability * 1.5 + grace * 1.2, high = true;
		else if (diff === 0) probability = probability * 1.4 + grace;
		else if (diff === -1) probability = probability * 1.15 + grace / 3.2;
		else probability = probability * 1.08 + grace / 4;
	} else {
		grace = Math.max(0, grace / 4.8 - 0.4 / ((new_level - 0.999) ** 2));
		probability += grace;
	}
	probability = Math.min(probability, high ? Math.min(oprobability + 0.36, oprobability * 3) : Math.min(oprobability + 0.24, oprobability * 2));
	return { chance: Math.min(probability, 1) };
}

function getCompoundChance(item, scrollGrade, offeringIdx) {
	const rawGrace = item.grace || 0;
	const grade = item_grade(item);
	if (grade > scrollGrade) return { chance: 0 };
	const new_level = (item.level || 0) + 1;
	let igrade = getIgrade(item.name);
	if (item.level >= 3) igrade = item_grade({ name: item.name, level: item.level - 2 });
	const oprobability = tableLookup(COMPOUNDS, igrade, new_level);
	if (oprobability == null) return { chance: 0 };
	let probability = oprobability;
	let high = 0;
	if (scrollGrade > grade) { probability = probability * 1.1 + 0.001; high = scrollGrade - grade; }
	if (offeringIdx > 0) {
		const offeringGrade = offeringGradeOf(offeringIdx);
		const grace = 0.027 * (rawGrace * 3 + 0.5);
		const diff = offeringGrade - grade;
		if (diff > 1) probability = probability * 1.64 + grace * 2, high = 1;
		else if (diff > 0) probability = probability * 1.48 + grace, high = 1;
		else if (diff === 0) probability = probability * 1.36 + Math.min(30 * 0.027, grace);
		else if (diff === -1) probability = probability * 1.15 + Math.min(25 * 0.019, grace) / Math.max(item.level - 2, 1);
		else probability = probability * 1.05 + Math.min(20 * 0.011, grace) / Math.max(item.level - 2, 1) ** 2;
	}
	probability = Math.min(probability, high ? Math.min(oprobability + 0.33, oprobability * 3) : Math.min(oprobability + 0.22, oprobability * 2));
	return { chance: Math.min(probability, 1) };
}

// Picks the single cheapest-expected-cost (cost / chance) scroll+offering
// combo for the NEXT level only. Scroll grade capped at 3 (grades arrays
// are always 4 entries, so this never excludes a real option) and offering
// restricted to BUYABLE_OFFERING_INDICES, since offeringp/offeringx have
// no vendor anywhere (drop/craft only) and would just fail every buy().
function pickBestUpgradeStep(item) {
	const grade = item_grade(item);
	let best = null;
	for (let s = grade; s <= Math.min(grade + 1, 3); s++) {
		for (const o of BUYABLE_OFFERING_INDICES) {
			const { chance } = getUpgradeChance(item, s, o);
			if (!chance) continue;
			const cost = COSTS.scroll[s] + COSTS.offering[o];
			const expectedCost = cost / chance;
			if (!best || expectedCost < best.expectedCost) {
				best = { scrollIdx: s, offeringIdx: o, chance, cost, expectedCost, scrollName: SCROLL_NAMES.upgrade[s], offeringName: OFFERING_NAMES[o] };
			}
		}
	}
	return best;
}

function pickBestCompoundStep(item) {
	const grade = item_grade(item);
	let best = null;
	for (let s = grade; s <= Math.min(grade + 1, 3); s++) {
		for (const o of BUYABLE_OFFERING_INDICES) {
			const { chance } = getCompoundChance(item, s, o);
			if (!chance) continue;
			const cost = COSTS.cscroll[s] + COSTS.offering[o];
			const expectedCost = cost / chance;
			if (!best || expectedCost < best.expectedCost) {
				best = { scrollIdx: s, offeringIdx: o, chance, cost, expectedCost, scrollName: SCROLL_NAMES.compound[s], offeringName: OFFERING_NAMES[o] };
			}
		}
	}
	return best;
}


// Compounding needs 3 identical (name, level) copies - a hard game rule,
// not optional infrastructure.
function findCompoundGroup(items, itemName, level) {
	const indices = [];
	items.forEach((it, idx) => {
		if (it && it.name === itemName && (it.level || 0) === level) indices.push(idx);
	});
	return indices.length >= 3 ? indices.slice(0, 3) : null;
}

// ----------------------------------------------------------------------------
// EXECUTION - verified vendors:
//   - Lucas ("scrolls") main (-464, -96): scroll0-2, cscroll0-2. No offerings.
//   - Garwyn ("premium") main (192, -564): sells 'offering' (grade 2, 27.42M gold).
//   - Crun ("thief") map "level2" (-133, -187): scroll3, cscroll3.
//   - scroll4/cscroll4, offeringp, offeringx: no vendor anywhere - excluded
//     via the scroll-grade cap and BUYABLE_OFFERING_INDICES above.
// ----------------------------------------------------------------------------
const SCROLL_NPC = { name: 'Lucas', map: 'main', x: -464, y: -96 };
const OFFERING_NPC = { name: 'Garwyn', map: 'main', x: 192, y: -564 };
const THIEF_NPC = { name: 'Crun', map: 'level2', x: -133, y: -187 };

// Maps each purchasable material name to the NPC that actually sells it.
// Anything not listed here (offeringp, offeringx, scroll4, cscroll4) has
// no real vendor - ensureUpgradeMaterials() below refuses to attempt a
// buy() for those rather than travel nowhere and fail silently, but in
// practice the planner functions above never select them in the first
// place (see the scroll-grade cap and BUYABLE_OFFERING_INDICES).
const MATERIAL_VENDORS = {
	scroll0: SCROLL_NPC, scroll1: SCROLL_NPC, scroll2: SCROLL_NPC,
	cscroll0: SCROLL_NPC, cscroll1: SCROLL_NPC, cscroll2: SCROLL_NPC,
	scroll3: THIEF_NPC, cscroll3: THIEF_NPC,
	offering: OFFERING_NPC,
};

// Buys whatever's missing, traveling to each material's own real vendor -
// the scroll and the offering can require two different trips, since
// they're not always sold by the same NPC (see MATERIAL_VENDORS above).
async function ensureUpgradeMaterials(scrollName, offeringName) {
	if (quantity(scrollName) < 1) {
		const vendor = MATERIAL_VENDORS[scrollName];
		if (!vendor) throw new Error(`No known vendor sells ${scrollName} - cannot buy it.`);
		const arrived = await travelTo(vendor.map, vendor.x, vendor.y);
		if (!arrived) throw new Error(`Could not reach ${vendor.name} at ${vendor.map} (${vendor.x}, ${vendor.y}) for ${scrollName}`);
		await buy(scrollName, 1);
	}
	if (offeringName !== 'none' && quantity(offeringName) < 1) {
		const vendor = MATERIAL_VENDORS[offeringName];
		if (!vendor) throw new Error(`No known vendor sells ${offeringName} - cannot buy it.`);
		const arrived = await travelTo(vendor.map, vendor.x, vendor.y);
		if (!arrived) throw new Error(`Could not reach ${vendor.name} at ${vendor.map} (${vendor.x}, ${vendor.y}) for ${offeringName}`);
		await buy(offeringName, 1);
	}
}


async function travelToBank() {
	if (character.map === CONFIG.bank.map) return true;
	await ensureStandClosed();
	try {
		await smart_move({ to: 'bank' });
		return true;
	} catch (e) {
		game_log(`smart_move to bank failed: ${e.reason || e} - trying town() fallback first`, 'red');
	}
	try {
		await town();
		await smart_move({ to: 'bank' });
		return character.map === CONFIG.bank.map;
	} catch (e) {
		game_log(`Still can't reach the bank: ${e.reason || e}`, 'red');
		return false;
	}
}

// Scans inventory for every tracked gear item that's exhausted every tier
// target it appears in (across every party class's table, not just one),
// and banks it. Bank slot indices highest-first so earlier indices don't
// shift out from under us as items are removed mid-loop.
async function bankFullyProgressedItems() {
	const toBank = [];
	character.items.forEach((item, idx) => {
		if (!item || !item.name) return;
		if (!isKnownGearItem(item.name)) return; // not part of any tracked plan at all
		if (findCandidacy(item)) return; // still has room to improve somewhere - keep it in play
		toBank.push(idx);
	});
	if (!toBank.length) return false;

	const arrived = await travelToBank();
	if (!arrived) return false;

	for (const idx of toBank.sort((a, b) => b - a)) {
		const itemName = character.items[idx]?.name;
		try {
			await bank_store(idx);
			game_log(`Banked fully-progressed ${itemName ?? 'item'}`, '#00FF00');
		} catch (e) {
			game_log(`bank_store failed for ${itemName ?? `slot ${idx}`}: ${e.reason || e}`, 'red');
		}
	}
	return true;
}

// True if this item is compoundable per G.items (authoritative), falling
// back to the gear plan's own 'compound'/'upgrade' method if G is unavailable.
function isCompoundableItem(itemName) {
	if (typeof G !== 'undefined' && G.items && G.items[itemName]) {
		return !!G.items[itemName].compound;
	}
	// G not available (shouldn't normally happen on Mainframe) - fall back
	// to the tracked plan's own method field, if this item is tracked at all.
	for (const cls of PARTY_CLASSES) {
		const tiers = GEAR_PROGRESSION[cls];
		if (!tiers) continue;
		for (const tier of tiers) {
			if (!tier) continue;
			for (const slotName in tier) {
				const entry = tier[slotName];
				if (entry && entry.item === itemName) return entry.method === 'compound';
			}
		}
	}
	return true; // unknown item, no G data - assume compoundable rather than silently skipping real junk
}

// Finds the first group of 3+ identical (name, level) items at level 0/1,
// regardless of GEAR_PROGRESSION - junk from muling piles up fast and is
// worth consolidating on its own. Skips upgrade-only items (coat, pants,
// weapons, etc.) - compounding one of those either fails outright or
// silently blocks that item's real upgrade logic every tick.
function findBaseDuplicateGroup() {
	const groups = new Map();
	character.items.forEach((item, idx) => {
		if (!item || !item.name) return;
		if (item.level !== 0 && item.level !== 1) return;
		if (!isCompoundableItem(item.name)) return; // e.g. "coat" - meant to be upgraded individually, not merged 3-for-1
		const key = `${item.name}|${item.level}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(idx);
	});
	for (const [key, indices] of groups) {
		if (indices.length >= 3) {
			const [name, levelStr] = key.split('|');
			return { name, level: Number(levelStr), indices: indices.slice(0, 3) };
		}
	}
	return null;
}

async function autoCombineOneBaseDuplicateGroup(currentGold) {
	const group = findBaseDuplicateGroup();
	if (!group) return false;
	if (!canStartSpending(currentGold)) return false;

	const sampleItem = character.items[group.indices[0]];
	const step = pickBestCompoundStep(sampleItem);
	if (!step) {
		game_log(`No viable compound combo for ${group.name}@${group.level} right now`, 'red');
		return false;
	}
	if (!canAffordStep(currentGold, step.cost)) return false;

	try {
		await ensureUpgradeMaterials(step.scrollName, step.offeringName);
		const scrollSlot = locate_item(step.scrollName);
		const offeringSlot = step.offeringName === 'none' ? null : locate_item(step.offeringName);
		await compound(group.indices[0], group.indices[1], group.indices[2], scrollSlot, offeringSlot);
		game_log(`Auto-combined 3x ${group.name}@${group.level} (${(step.chance * 100).toFixed(0)}% chance)`, '#00FF00');
		return true;
	} catch (e) {
		// Previously returned true unconditionally here, which meant a
		// failed attempt still counted as "handled this tick" and silently
		// skipped the real upgrade-plan step below. Returning false lets
		// attemptBestPlanStep get a chance in the same tick instead.
		game_log(`Auto-combine of ${group.name}@${group.level} failed: ${e.reason || e}`, 'red');
		return false;
	}
}

function gatherPlanCandidates() {
	const candidates = [];
	character.items.forEach((item, idx) => {
		if (!item || !item.name) return;
		const candidacy = findCandidacy(item);
		if (candidacy) candidates.push({ inventoryIndex: idx, item, ...candidacy });
	});
	return candidates;
}

// Picks the cheapest-expected-cost AFFORDABLE candidate across the whole
// plan (not just inventory order) and attempts exactly one step on it.
async function attemptBestPlanStep(currentGold) {
	if (!canStartSpending(currentGold)) return false;
	const candidates = gatherPlanCandidates();
	if (!candidates.length) return false;

	let best = null;
	for (const c of candidates) {
		if (c.method === 'compound') {
			const group = findCompoundGroup(character.items, c.item.name, c.item.level || 0);
			if (!group) continue; // don't have 3 copies yet
			const step = pickBestCompoundStep(c.item);
			if (!step || !canAffordStep(currentGold, step.cost)) continue;
			if (!best || step.expectedCost < best.step.expectedCost) best = { candidate: c, step, group };
		} else {
			const step = pickBestUpgradeStep(c.item);
			if (!step || !canAffordStep(currentGold, step.cost)) continue;
			if (!best || step.expectedCost < best.step.expectedCost) best = { candidate: c, step };
		}
	}
	if (!best) return false;

	try {
		await ensureUpgradeMaterials(best.step.scrollName, best.step.offeringName);
		const scrollSlot = locate_item(best.step.scrollName);
		const offeringSlot = best.step.offeringName === 'none' ? null : locate_item(best.step.offeringName);

		if (best.candidate.method === 'compound') {
			await compound(best.group[0], best.group[1], best.group[2], scrollSlot, offeringSlot);
		} else {
			await upgrade(best.candidate.inventoryIndex, scrollSlot, offeringSlot);
		}
		const verb = best.candidate.method === 'compound' ? 'Compounding' : 'Upgrading';
		game_log(`${verb} ${best.candidate.item.name} toward ${best.candidate.class} tier ${best.candidate.tier} target ${best.candidate.targetLevel} (${(best.step.chance * 100).toFixed(0)}% chance)`, '#00FF00');
	} catch (e) {
		game_log(`Gear step on ${best.candidate.item.name} failed: ${e.reason || e}`, 'red');
	}
	return true;
}

// ----------------------------------------------------------------------------
// MAIN LOOP - mirrors queueLoop()'s own busy-flag pattern so the two never
// fight over Meltymerch's movement at the same time. One action category
// per tick (bank pass, then at most one spend action), re-evaluating from
// scratch next tick rather than trying to plan multiple steps ahead.
// ----------------------------------------------------------------------------
async function gearProgressionLoop() {
	try {
		if (CONFIG.gearProgression.enabled && !state.busy && !PROBE.hold) {
			const hasBankable = character.items.some(item => item && item.name && isKnownGearItem(item.name) && !findCandidacy(item));
			// Gated behind canStartSpending: without this, a plan candidate or
			// duplicate group sitting below the gold threshold made the loop
			// close/reopen the stand every cycle for nothing, since
			// attemptBestPlanStep()/autoCombineOneBaseDuplicateGroup() both
			// bail out silently at that same gold check anyway. hasBankable
			// stays independent since banking doesn't cost gold.
			const canSpend = canStartSpending(character.gold);
			const hasDuplicateGroup = canSpend && !!findBaseDuplicateGroup();
			const hasPlanCandidate = canSpend && gatherPlanCandidates().length > 0;

			if (hasBankable || hasDuplicateGroup || hasPlanCandidate) {
				state.busy = true;
				const wasStandOpen = state.standOpen;
				if (wasStandOpen) {
					try { await close_stand(); state.standOpen = false; } catch (e) { console.error('close_stand failed:', e); }
				}

				if (hasBankable) await bankFullyProgressedItems();

				const combined = await autoCombineOneBaseDuplicateGroup(character.gold);
				if (!combined) await attemptBestPlanStep(character.gold);

				if (wasStandOpen) await openStandAtBestSpot();
				state.busy = false;
			}
		}
	} catch (e) {
		console.error('gearProgressionLoop error:', e);
		state.busy = false;
	}
	setTimeout(gearProgressionLoop, CONFIG.gearProgression.intervalMs);
}

// ============================================================================
// ANNIVERSARY KISS HUNTER - see CONFIG.anniversaryKiss above for the toggle.
// Works on Mainframe and in browser. Primary source is parent.S.anniversary
// (target/map/x/y) - structured game state, no chat or DOM dependency.
// The public chat announcement ("Find X in Y!...") is kept as a secondary
// source, though live testing 2026-09-17 found it didn't fire for an entire
// round while parent.S.anniversary stayed correct the whole time - a
// guessed-CSS-selector DOM lookup remains as a last-resort browser-only
// fallback below both.
// ============================================================================
const featuredState = { name: null, announcedAt: 0 };
const FEATURED_ROUND_MS = 5 * 60 * 1000; // matches the event's own 5-minute window

// Matches: "Find Meltymerch in Mainland! Get close and use I Kiss You for a
// slice and an Anniversary Gift." - captures the featured character's name.
// Case-insensitive and tolerant of the map display name varying.
const FEATURED_ANNOUNCEMENT_RE = /^Find\s+(.+?)\s+in\s+.+?!\s*Get close and use I Kiss You/i;

game.on('chat', (data) => {
	try {
		const match = FEATURED_ANNOUNCEMENT_RE.exec(data?.message || '');
		if (match) {
			featuredState.name = match[1].trim();
			featuredState.announcedAt = Date.now();
			game_log(`Anniversary: chat announced ${featuredState.name} as featured`, '#FF69B4');
		}
	} catch (e) {
		console.error('anniversary chat parse error:', e);
	}
});

function isInTown() {
	return character.map === CONFIG.anniversaryKiss.townMap;
}

function findFeaturedPlayerName() {
	// Primary source - structured game state, no chat/DOM dependency at
	// all, works identically on Mainframe and in browser. Confirmed via
	// live testing 2026-09-17: the chat announcement below did NOT fire
	// for an entire round, but parent.S.anniversary.target was populated
	// and correct the whole time - this is the reliable source.
	if (parent.S?.anniversary?.live && parent.S.anniversary.target) {
		return parent.S.anniversary.target;
	}

	// Secondary source - chat-derived. Kept in case parent.S.anniversary
	// is ever unavailable/stale, though live testing suggests it's the
	// less reliable of the two, not the more reliable one.
	if (featuredState.name && Date.now() - featuredState.announcedAt < FEATURED_ROUND_MS) {
		return featuredState.name;
	}

	// Last-resort browser-only fallback (e.g. script started mid-round and
	// missed both of the above, but the portrait is still visible).
	// Selector list is a best guess, not yet confirmed against the live
	// rendered page.
	if (parent.$) {
		const candidates = [
			'.featured-player', '.kiss-target', '[data-featured="true"]',
			'.info-player.featured', '.player-entry.kiss'
		];
		for (const sel of candidates) {
			const el = parent.document.querySelector(sel);
			if (el) {
				return el.dataset?.name || el.getAttribute?.('data-name') || el.textContent?.trim();
			}
		}
	}

	return null;
}

// parent.S.anniversary.map/x/y are the featured player's known location per
// game state - lets attemptKiss() head straight there even before
// get_player() can see them (which only resolves once nearby/visible).
function getFeaturedLocation() {
	const anniv = parent.S?.anniversary;
	if (anniv?.live && anniv.map) return { map: anniv.map, x: anniv.x, y: anniv.y };
	return null;
}

// Travels to the named player and fires I Kiss You once in range.
// Bails out early if the featured player changes mid-hunt (their
// 30-minute round ended or someone new got featured) rather than
// chasing a name that's no longer the active target.
async function attemptKiss(name) {
	const timeoutMs = FEATURED_ROUND_MS;
	const start = Date.now();

	while (Date.now() - start < timeoutMs) {
		const target = get_player(name);
		if (target) {
			if (distance(character, target) <= 80) {
				try {
					await use_skill('ikissyou', target);
					game_log(`Kissed ${name} for the anniversary event!`, '#FF69B4');
					return true;
				} catch (e) {
					game_log(`Kiss on ${name} failed: ${e.reason || e}`, 'red');
					return false;
				}
			} else if (!smart.moving) {
				try { await smart_move(target); } catch (e) { /* keep trying next tick */ }
			}
		} else if (!smart.moving) {
			// Not visible yet (get_player only resolves nearby/visible
			// players) - head straight to the known location from game
			// state instead of waiting for visibility to happen on its own.
			const loc = getFeaturedLocation();
			if (loc) {
				try { await smart_move(loc); } catch (e) { /* keep trying next tick */ }
			}
		}

		await sleep(2000);

		const stillFeatured = findFeaturedPlayerName();
		if (stillFeatured !== name) {
			game_log(`Featured player changed (was ${name}, now ${stillFeatured || 'none'}) - abandoning this hunt`, 'orange');
			return false;
		}
	}

	game_log(`Couldn't reach ${name} within the 5 minute window`, 'red');
	return false;
}

async function anniversaryKissLoop() {
	try {
		if (CONFIG.anniversaryKiss.enabled && !state.busy && isInTown()) {
			const name = findFeaturedPlayerName();

			// Being the target ourselves is not a kiss we can perform: get_player
			// does not resolve our own name, so attemptKiss fell through to
			// smart_move-to-where-we-already-are and span there for the whole
			// round - with state.busy held the entire time, which also blocked
			// deliveries, the stand and scouting. Record it and do nothing.
			if (name && name === character.name) {
				if (state.selfFeaturedFor !== name) {
					state.selfFeaturedFor = name;
					state.selfFeaturedAt = Date.now();
					game_log('Anniversary: we are the featured player - staying put for others to reach us', '#FF69B4');
				}
			} else if (name && state.kissAttemptedFor !== name) {
				state.busy = true;
				const wasStandOpen = state.standOpen;
				if (wasStandOpen) await ensureStandClosed();

				game_log(`Anniversary: found featured player ${name} - going to kiss them`, '#FF69B4');
				const success = await attemptKiss(name);
				if (success) state.kissAttemptedFor = name; // one rewarded visit per round, per the event's own rule

				if (wasStandOpen) await openStandAtBestSpot();
				state.busy = false;
			}
		}
	} catch (e) {
		console.error('anniversaryKissLoop error:', e);
		state.busy = false;
	}
	setTimeout(anniversaryKissLoop, CONFIG.anniversaryKiss.checkIntervalMs);
}

anniversaryKissLoop();

// ============================================================================
// MARKET SCOUTING
// ============================================================================
// Folds MerchantScout's roaming scan into the merchant, as a strictly lower
// priority than everything it already does.
//
// GATE: scouting runs only when the local bridge answers AND change_server is
// available. On Mainframe the bridge lives on the operator's PC and is
// unreachable by construction, so this never engages there and the merchant
// behaves exactly as it did before - no flag to set, no separate build.
//
// PRIORITY, highest first:
//   1. queued delivery/pickup work      - scouting stands down entirely
//   2. the anniversary round            - home kissGuardMs early, stays until
//                                         the round has rolled over
//   3. scouting                         - only with nothing else to do
//
// While out scouting the stand is closed, so this trades stand uptime for
// market coverage. It comes home for anything that matters and reopens.
// ============================================================================
const scout = {
	up: false,
	probedAt: 0,
	lastPostAt: 0,
	/* Findings not yet accepted by the bridge, BUCKETED BY SHARD. Keying only
	   by merchant id was wrong: a failed post left stands buffered, and the next
	   successful one stamped the payload with wherever the scout had since
	   hopped to, so merchants scanned on EU I were filed under US II. The bridge
	   takes the shard from the payload, so that mis-attribution is what the
	   watchlist quotes - and acting on it means travelling to a shard the
	   merchant was never on. Ponty had the same flaw. */
	shards: new Map(),      // shardKey -> {shard, stands:Map, ponty}
	pontySeen: {},          // shard -> when Ponty was last read there
	rotIdx: 0,
	cycleStartedAt: 0,      // when the current scout cycle took state.busy
	homeFor: null,          // the anniversary `next` we came home for
	lastReply: null,        // the bridge's most recent rotation/parked hints
};

/* change_server RELOADS THE PAGE in a browser tab - the script is destroyed and
   re-run from the top. Nothing after the hop in the same function ever executes,
   and every in-memory field resets. Anything that must outlive a hop therefore
   goes through the game's own CODE storage, and the loop is arranged so a hop is
   always the LAST thing a cycle does. */
function scoutSave(k, v) { try { set('scout_' + k, v); } catch (e) { } }
function scoutLoad(k, dflt) {
	try { const v = get('scout_' + k); return (v === null || v === undefined) ? dflt : v; }
	catch (e) { return dflt; }
}

/* Unsent findings, flattened so they survive a reload. */
function scoutSaveBuffer() {
	const out = [];
	for (const [k, e] of scout.shards) {
		out.push({ k, shard: e.shard, stands: [...e.stands.values()], ponty: e.ponty });
	}
	scoutSave('buf', out);
}
function scoutRestoreBuffer() {
	for (const e of scoutLoad('buf', [])) {
		if (!e || !e.shard) continue;
		const b = scoutBufferFor(e.shard);
		for (const row of (e.stands || [])) b.stands.set(row.id, row);
		if (e.ponty) b.ponty = e.ponty;
	}
}

function scoutBufferFor(shard) {
	const k = String(shard.region) + String(shard.name);
	let e = scout.shards.get(k);
	if (!e) { e = { shard, stands: new Map(), ponty: null }; scout.shards.set(k, e); }
	return e;
}

function scoutHere() {
	return { region: parent.server_region, name: parent.server_identifier };
}

function scoutBufferedCount() {
	let n = 0;
	for (const e of scout.shards.values()) n += e.stands.size;
	return n;
}

function scoutLog(msg, color) {
	try { game_log('[scout] ' + msg, color || '#8b98ab'); } catch (e) { }
}

function scoutShards() {
	const raw = parent && parent.X && parent.X.servers;
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((s) => s && !CONFIG.scout.skipServers.includes(s.name))
		.map((s) => String(s.region) + String(s.name));
}

function scoutFetch(path, opts) {
	if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
	const o = Object.assign({}, opts || {});
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(() => { try { ac.abort(); } catch (e) { } }, CONFIG.scout.timeoutMs);
	}
	return Promise.race([
		fetch(CONFIG.scout.bridge + path, o),
		new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), CONFIG.scout.timeoutMs + 200)),
	]).then((r) => {
		if (stop) clearTimeout(stop);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		return r.json();
	}, (e) => { if (stop) clearTimeout(stop); throw e; });
}

async function scoutProbe() {
	scout.probedAt = Date.now();
	const was = scout.up;
	try {
		await scoutFetch('/health');
		scout.up = true;
		if (!was) scoutLog('bridge up - scouting enabled', '#7FD98A');
	} catch (e) {
		if (was) scoutLog('bridge lost - scouting suspended', 'orange');
		scout.up = false;
	}
	return scout.up;
}

function scoutCanRun() {
	if (!CONFIG.scout.enabled) return false;
	if (typeof change_server !== 'function') return false;
	if (!scoutShards().length) return false;
	return scout.up;
}

/* Every open player stand in view. NPCs are in parent.entities too - measured,
   not assumed - so they are excluded explicitly rather than left to the stand
   check. Trade goods live in trade1..N; a player's other slots are equipment. */
function scoutScanStands() {
	const out = [];
	const ents = (parent && parent.entities) || {};
	const me = character.name;
	for (const id in ents) {
		const e = ents[id];
		if (!e || e.type !== 'character') continue;
		if (e.npc) continue;
		if (e.name === me) continue;
		if (!e.stand) continue;
		const slots = {};
		const raw = e.slots || {};
		for (const k in raw) {
			if (k.indexOf('trade') !== 0) continue;
			const s = raw[k];
			if (!s || !s.name) continue;
			slots[k] = {
				name: s.name, price: s.price, b: !!s.b, q: s.q || 1,
				level: s.level || 0, p: s.p || null, stat_type: s.stat_type || null,
			};
		}
		if (!Object.keys(slots).length) continue;
		out.push({
			id: e.name || e.id || id,
			map: e.map || character.map,
			x: Math.round(e.real_x != null ? e.real_x : e.x),
			y: Math.round(e.real_y != null ? e.real_y : e.y),
			slots,
		});
	}
	return out;
}

/* Sweep until the visible set stops growing. After a change_server the client
   is still streaming entities in, and one instant scan can read it half-empty.
   Exits as soon as two passes agree - a convergence test, not a dwell. */
async function scoutSettleScan() {
	let seen = -1;
	for (let pass = 0; pass < CONFIG.scout.maxSettlePasses; pass++) {
		const bucket = scoutBufferFor(scoutHere());
		for (const row of scoutScanStands()) bucket.stands.set(row.id, row);
		const n = scoutBufferedCount();
		// Two passes agreeing means the list has settled - EXCEPT at zero, where
		// "nothing yet" and "nothing here" look identical. Reading an empty
		// entity list twice in 1.5s said a shard was empty and reported it as
		// fact. Zero only counts once every pass has been spent.
		if (n > 0 && n === seen) break;
		seen = n;
		await new Promise((r) => setTimeout(r, CONFIG.scout.settleMs));
	}
	if (scoutBufferedCount() === 0) {
		scoutLog(`${mShardKey()}: no stands after ${CONFIG.scout.maxSettlePasses} sweeps`, 'orange');
	}
}

/* Ponty answers only while standing next to him. Never read through
   parent.alert() - it freezes every character in the tab, not just this one. */
function scoutPontyQuery() {
	return new Promise((resolve) => {
		let settled = false;
		const finish = (v) => {
			if (settled) return;
			settled = true;
			try { parent.socket.off('secondhands', onData); } catch (e) { }
			resolve(v);
		};
		const onData = (data) => {
			const list = Array.isArray(data) ? data
				: (data && Array.isArray(data.items) ? data.items : null);
			if (!list) return finish(null);
			finish(list.filter((it) => it && it.name).map((it) => ({
				name: it.name, level: it.level || 0, q: it.q || 1,
				p: it.p || null, price: scoutItemPrice(it),
			})));
		};
		try {
			parent.socket.on('secondhands', onData);
			parent.socket.emit('secondhands');
		} catch (e) { return finish(null); }
		setTimeout(() => finish(null), CONFIG.scout.pontyTimeoutMs);
	});
}

/* calculate_item_value() returns what Ponty PAID - buy_to_sell is already in
   it - so his asking price is that times secondhands_mult. Verified against
   four observations: mcape 480,000 -> 576,000, ringsj 24,000 -> 28,800, and
   two community samples. Passing the whole item lets the game handle level,
   grade and upgrade-vs-compound, which no formula fitted to samples could. */
function scoutItemPrice(it) {
	const mult = parent && parent.G && parent.G.multipliers
		&& parent.G.multipliers.secondhands_mult;
	if (typeof mult !== 'number') return null;
	if (typeof parent.calculate_item_value !== 'function') return null;
	try {
		const v = parent.calculate_item_value(it);
		if (typeof v === 'number' && isFinite(v) && v > 0) return Math.round(v * mult);
	} catch (e) { }
	return null;
}

async function scoutPontyCheck() {
	const m = parent && parent.G && parent.G.maps && parent.G.maps.main;
	const npc = m && (m.npcs || []).find((n) => n && n.id === 'secondhands');
	if (!npc || !Array.isArray(npc.position)) return;
	try { await smart_move({ map: 'main', x: npc.position[0], y: npc.position[1] }); }
	catch (e) { return; }
	const items = await scoutPontyQuery();
	if (items) {
		scoutBufferFor(scoutHere()).ponty = items;
		scout.pontySeen[mShardKey()] = Date.now();
		scoutLog(`Ponty: ${items.length} items on ${mShardKey()}`, '#5ED6A8');
	}
}

function scoutPontyDue() {
	const last = scout.pontySeen[mShardKey()];
	return !last || Date.now() - last > CONFIG.scout.pontyEveryMs;
}

/* Never two posts inside minPostGapMs from this character. */
async function scoutPostGap() {
	if (!scout.lastPostAt) return;
	const since = Date.now() - scout.lastPostAt;
	if (since >= CONFIG.scout.minPostGapMs) return;
	await new Promise((r) => setTimeout(r, CONFIG.scout.minPostGapMs - since));
}

/* Posts every buffered shard, each stamped with the shard it was observed on -
   never with wherever the merchant happens to be standing now. A bucket clears
   only once the bridge acknowledges storing exactly what was sent; anything
   unconfirmed stays put, still attributed correctly, and goes out next time. */
async function scoutReport() {
	const buckets = [...scout.shards.entries()];

	const send = async (shard, stands, ponty) => {
		await scoutPostGap();
		let reply = null;
		try {
			reply = await scoutFetch('/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					character: character.name, role: 'roamer', shard,
					at: new Date().toISOString(), merchants: stands, ponty: ponty,
				}),
			});
		} catch (e) { scout.up = false; scout.probedAt = Date.now(); }
		scout.lastPostAt = Date.now();
		return reply;
	};

	// Nothing seen yet: still post, so the bridge knows this scout is alive and
	// hands back its rotation hints.
	if (!buckets.length) {
		const reply = await send(scoutHere(), [], null);
		return { reply, confirmed: !!reply, count: 0 };
	}

	let lastReply = null, allOk = true, sent = 0;
	for (const [key, e] of buckets) {
		const stands = [...e.stands.values()];
		const ponty = e.ponty;
		const reply = await send(e.shard, stands, ponty);
		lastReply = reply || lastReply;

		const acc = reply && reply.accepted;
		const ok = !!(acc && acc.merchants === stands.length
			&& acc.ponty === (ponty ? ponty.length : 0));
		if (ok) {
			scout.shards.delete(key);
			sent += stands.length;
			scoutLog(`${stands.length} stands on ${key} - confirmed`);
		} else {
			allOk = false;
			scoutLog(`${key}: not acknowledged, held for retry`, 'orange');
		}
	}
	return { reply: lastReply, confirmed: allOk, count: sent };
}

/* Resend until acknowledged. Bounded: with the bridge down the findings are
   already back in the buffer and go out when it returns, so blocking the
   rotation forever would cost coverage and save nothing. */
async function scoutReportConfirmed() {
	for (let i = 0; i < CONFIG.scout.postConfirmRetries; i++) {
		const r = await scoutReport();
		if (r.confirmed) return r;
		if (!r.reply) {
			scoutLog('bridge unreachable - carrying the scan forward', 'orange');
			return r;
		}
	}
	scoutLog('scan not acknowledged - staying buffered', 'orange');
	return { reply: null, confirmed: false, count: 0 };
}

// ------------------------------------------------------- anniversary guard
/* S.anniversary carries {active, live, next} where next is the round's start,
   on the hour. That is a real schedule, so the merchant can be home BEFORE the
   round rather than discovering it late from another shard. */
function scoutKissNext() {
	const a = parent && parent.S && parent.S.anniversary;
	if (!a || !a.active || typeof a.next !== 'number') return null;
	return a.next;
}

function scoutKissHoldsUsHome() {
	// Being the featured player outranks the schedule: people are travelling
	// here to reach us, so wandering off mid-round would waste their trip.
	if (state.selfFeaturedAt
		&& Date.now() - state.selfFeaturedAt < CONFIG.anniversaryKiss.selfFeaturedHoldMs) {
		return true;
	}

	const next = scoutKissNext();
	if (next == null) {
		scout.homeFor = null;
		return false;
	}
	// Inside the guard window before a round starts.
	if (next - Date.now() <= CONFIG.scout.kissGuardMs) {
		if (scout.homeFor == null) scout.homeFor = next;
		return true;
	}
	// Came home for a round that has not rolled over yet. `next` advancing past
	// the value we returned for is the confirmation the round is done - more
	// reliable than trying to catch `live` going false between 5s polls.
	if (scout.homeFor != null) {
		if (next > scout.homeFor) {
			scoutLog('anniversary round complete - resuming scouting', '#7FD98A');
			scout.homeFor = null;
			return false;
		}
		return true;
	}
	return false;
}

// ------------------------------------------------------------------ driving
async function scoutGoHome(reason) {
	const home = mHomeShard();
	if (mShardKey() === home) return;
	state.busy = true;
	try {
		await scoutReportConfirmed();       // never carry findings across a hop
		scoutLog(`standing down (${reason}) - returning to ${home}`, '#FFD700');
		if (await mHopTo(home)) await openStandAtBestSpot();
	} finally { state.busy = false; }
}

/* Where to go next, steered by the bridge rather than a blind round-robin.

   Two hints come back with every accepted scan:
     parked   - shards a stationary scout is holding. Those are being reported
                continuously, so visiting one spends the rotation re-collecting
                data the bridge already has fresher than we could make it.
     rotation - every shard the bridge knows, ordered oldest observation first.

   Shards the bridge has never heard of outrank everything, since "no data at
   all" is staler than any timestamp. With no reply yet - first run, or the
   bridge down - this falls back to the plain round-robin, which is what a lone
   scout effectively gets anyway. */
function scoutNextShard() {
	const all = scoutShards();
	const here = mShardKey();
	const reply = scout.lastReply;

	const parked = new Set(Object.values((reply && reply.parked) || {}).filter(Boolean));
	const fromBridge = (reply && Array.isArray(reply.rotation)) ? reply.rotation : [];

	if (fromBridge.length) {
		const known = new Set(fromBridge);
		const unseen = all.filter((k) => !known.has(k));
		const ordered = [...unseen, ...fromBridge];
		const pool = ordered.filter((k) =>
			k !== here && all.includes(k) && !parked.has(k));
		// Already staleness-ordered, so the head IS the shard most worth visiting.
		if (pool.length) return pool[0];
	}

	// No hints, or every other shard is parked-covered: keep moving rather than
	// stall, so a bridge outage never leaves the scout sitting still.
	const any = all.filter((k) => k !== here);
	if (!any.length) return null;
	const k = any[scout.rotIdx % any.length];
	scout.rotIdx++;
	return k;
}

/* Stand where the stands are before reading them.

   Entity visibility is a radius - measured at 699+ units - so WHERE the scan
   happens decides what it sees. change_server drops the character wherever it
   left off, and an anniversary kiss can end anywhere on the map, so without
   this the scout would hop and scan from some arbitrary corner and report a
   near-empty shard as fact.

   Reuses CONFIG.stand.candidates rather than deriving a spot: that list is
   already tuned to the merchant plaza on this account, and it is where the
   stands being scanned actually are. */
async function scoutGoToScanSpot() {
	const spot = CONFIG.stand.candidates[0];
	if (!spot) return false;
	if (character.map === CONFIG.stand.map && distance(character, spot) <= 60) return true;
	return await travelTo(CONFIG.stand.map, spot.x, spot.y);
}

/* Two phases, never in one continuation, because a hop ends the script.

   TICK A - we are somewhere unscanned: travel, sweep, read Ponty, report, and
            record the shard as done. No hop.
   TICK B - this shard is already reported: hop. Whatever follows is unreachable
            in a browser tab, so nothing follows.

   The previous single-pass version did hop-then-scan, so in a tab it hopped,
   the page reloaded, and the scan and report were simply never reached. It
   rotated shards forever and posted nothing - matching exactly what was
   observed: constant hopping, zero POSTs, and the only report being the one
   scoutGoHome sends BEFORE its hop. */
/* Keep this shard's listings current while a probe holds the merchant.
 
   Scan and report only - no travel, no Ponty trip, and never a hop. The
   no-travel rule is the important one: a probe may have walked the merchant
   600 units out to measure the trade distance, and dragging it back to the
   plaza mid-measurement would ruin the reading.
 
   That also means the scan is SKIPPED rather than taken from wherever the
   character happens to be standing. A sweep read from a corner reports a
   near-empty shard as fact, and a scan REPLACES its shard on the bridge - so a
   lazy read here would not just be useless, it would destroy good data. */
async function scoutHeldScan() {
	if (!scoutCanRun()) return;
	const spot = CONFIG.stand.candidates[0];
	if (!spot) return;
	if (character.map !== CONFIG.stand.map || distance(character, spot) > 60) return;
	if (Date.now() - (scout.heldScanAt || 0) < CONFIG.scout.heldScanMs) return;
	scout.heldScanAt = Date.now();
	state.busy = true;
	try {
		await scoutSettleScan();
		const r = await scoutReportConfirmed();
		if (r && r.reply) scout.lastReply = r.reply;
		scoutSaveBuffer();
	} catch (e) {
		console.error('scoutHeldScan error:', e);
	} finally { state.busy = false; }
}

async function scoutVisitNextShard() {
	const here = mShardKey();
	const done = scoutLoad('scanned', null);

	if (done !== here) {
		state.busy = true;
		scout.cycleStartedAt = Date.now();
		try {
			if (state.standOpen) await ensureStandClosed();
			// Travel BEFORE settling: the sweep measures whether the entity list
			// has finished streaming, which only means anything once standing
			// where the read will happen.
			await scoutGoToScanSpot();
			await scoutSettleScan();
			if (scoutPontyDue()) await scoutPontyCheck();
			const r = await scoutReportConfirmed();
			if (r && r.reply) scout.lastReply = r.reply;
			if (r && r.confirmed) scoutSave('scanned', here);
			scoutSaveBuffer();
		} finally { state.busy = false; scout.cycleStartedAt = 0; }
		return;                       // hop on the NEXT tick, not this one
	}

	const target = scoutNextShard();
	if (!target) return;
	state.busy = true;
	try {
		if (state.standOpen) await ensureStandClosed();
		scoutSaveBuffer();            // anything unsent must survive the reload
		scoutSave('rot', scout.rotIdx);
		scoutSave('ponty_seen', scout.pontySeen);
		await mHopTo(target);         // in a browser tab the script ends here
	} finally { state.busy = false; }
}

async function scoutLoop() {
	try {
		if (Date.now() - scout.probedAt > CONFIG.scout.reprobeMs) await scoutProbe();

		// A scout cycle awaits smart_move and change_server, and smart_move can
		// hang indefinitely on an unreachable path. state.busy is the merchant's
		// only mutual exclusion, so one stuck await silently freezes deliveries,
		// the stand and the anniversary kiss along with scouting - which is
		// precisely what an 8 minute silence after a single post looks like.
		// Release the lock and let the next tick start over; the abandoned
		// promise clearing it again later is harmless.
		if (scout.cycleStartedAt
			&& Date.now() - scout.cycleStartedAt > CONFIG.scout.maxCycleMs) {
			scoutLog(`cycle stuck for ${Math.round((Date.now() - scout.cycleStartedAt) / 1000)}s - releasing`, 'red');
			scout.cycleStartedAt = 0;
			state.busy = false;
		}

		if (!state.busy) {
			if (PROBE.hold) {
				// A probe is measuring. Never hop - a hop reloads the page and
				// would take the probe and its half-collected findings with it -
				// but DO keep scanning this shard and posting it.
				//
				// Standing down entirely was wrong and self-defeating: holding
				// stopped the only thing that feeds the bridge, the bridge aged
				// out to zero stands, and arbProbeFindBuy/FindSell - which exist
				// precisely to read that data - silently fell back to whatever
				// was in the plaza. The hold was starving the probe it protected.
				await scoutHeldScan();
			} else if (!scoutCanRun()) {
				// Never leave the merchant parked off-home with scouting disabled.
				await scoutGoHome('scouting unavailable');
			} else if (state.queue.length) {
				// Deliveries outrank scouting. processBatch routes to each
				// requester's shard itself and returns home, so nothing to do but
				// stay out of its way.
				await scoutGoHome('jobs queued');
			} else if (scoutKissHoldsUsHome()) {
				await scoutGoHome('anniversary round due');
				// A kiss can finish anywhere on the map, and openStandAtBestSpot
				// only runs afterwards if the stand happened to be open before it.
				// Walk back to the plaza either way so the merchant is where
				// people expect it, and where the next scan will read from.
				if (!state.busy && !state.standOpen) await scoutGoToScanSpot();
			} else {
				await scoutVisitNextShard();
			}
		}
	} catch (e) {
		console.error('scoutLoop error:', e);
		state.busy = false;
	}
	setTimeout(scoutLoop, CONFIG.scout.tickMs);
}

// ============================================================================
// PHASE 0 - ARBITRAGE PROBE
// ============================================================================
/* Nothing in this section runs on its own. Every function is called by hand
   from the Adventure Land code console while the merchant stands somewhere
   useful, and the results are read off the log.
 
   WHY A PROBE AT ALL
   The trade API is the one part of the arbitrage plan this codebase has never
   exercised. The obvious move is to write trade_buy(target, slot) and see what
   happens, but the last constant assumed in this project - Ponty's asking
   price - was wrong by a factor of two and took three rounds to catch, and
   that one only cost a wrong number on a webpage. This one spends gold. So
   the API is DISCOVERED: arbProbeFns and arbProbeSrc read the real function
   list and the real source, including the socket payload each one emits, and
   the operator builds the first call from that rather than from memory.
 
   SAFETY
   arbProbeCall is the only function here that can move gold. It refuses a slot
   priced above CONFIG.arbitrage.probe.maxPrice, demands an explicit confirm
   string, and reports the gold delta whether it succeeded or failed - a failed
   call is data too, since a rejection at a known distance is how the trade
   range gets measured without paying for it.
 
   Everything else reads, or walks.
 
   Procedure: Codex/PHASE0_PROBE.md. */

/* WHICH BUILD IS ACTUALLY RUNNING.
 
   A redeploy returns "queued", not "confirmed", so a reader needs a way to
   check that the code answering is the code just written. This file has form
   here: the v24 header survived thirteen commits of changes and led a handoff
   to record the file as untouched.
 
   So two answers, of different quality. `build` is a hand-bumped string and
   can go stale exactly as that header did - treat it as a hint. `api` is the
   live list of probe functions the running script actually exposes, and it
   cannot lie: if arbProbeDistanceCheck is in it, the build is at least the one
   that introduced it. Feature-detect against `api`, read `build` for context. */
const MERCHANT_BUILD = 'v26 / probe.8 / 2026-09-19 / step+refusals fixed';

function arbProbeBuild() {
	const api = Object.keys(parent.PROBE_API || {}).sort();
	const out = {
		build: MERCHANT_BUILD,
		api: api,
		apiCount: api.length,
		// Named so a caller can assert on a capability rather than a number.
		has: {
			distanceCheck: api.indexOf('distanceCheck') >= 0,   // the distance() diagnostic
			range: api.indexOf('range') >= 0,                   // loaded-and-how-far
            findFlips: api.indexOf('findFlips') >= 0,           // the profitability query
			findPonty: api.indexOf('findPonty') >= 0,
		},
		stepReportsMovement: (typeof arbProbeStep === 'function')
			&& String(arbProbeStep).indexOf('DID NOT MOVE') >= 0,
		callReturnsStructuredRefusals: (typeof arbProbeCall === 'function')
			&& String(arbProbeCall).indexOf('target_not_loaded') >= 0,
	};
	pLog('build ' + out.build + ' - ' + out.apiCount + ' probe functions'
		+ (out.stepReportsMovement && out.callReturnsStructuredRefusals
			? ', step and call are the fixed versions'
			: ', WARNING: step or call is the OLD version - the redeploy did not land'),
		(out.stepReportsMovement && out.callReturnsStructuredRefusals) ? null : 'red');
	return pShow(out);
}

const PROBE = {
	// While held: no shard hop (a hop reloads the page and kills a probe
	// mid-measurement), no gear spending, no sellTrash. That last one matters
	// most - without it a gold delta measured across a trade is the trade plus
	// whatever junk got vendored in the same two seconds.
	hold: false,
	log: [],
};

function pLog(msg, color) {
	const line = '[probe] ' + msg;
	PROBE.log.push({ at: new Date().toISOString(), msg: msg });
	// Kept in CODE storage too: a probe that ends in a page reload - or a hop
	// slipping through - would otherwise take its own findings with it.
	try { set('probe_log', PROBE.log.slice(-200)); } catch (e) { }
	try { game_log(line, color || '#7FD98A'); } catch (e) { }
	try { console.log(line); } catch (e) { }
}

function pShow(obj) {
	try { show_json(obj); } catch (e) { try { console.log(obj); } catch (e2) { } }
	return obj;
}

/* Freeze the merchant for the duration of a probe. Leave it on for the whole
   session and turn it off when done; forgetting it on costs scouting, not
   correctness. */
function arbProbeHold(on) {
	PROBE.hold = (on !== false);
	// Written to storage, not just memory. Travelling to a candidate on another
	// shard means change_server, which reloads the page and would otherwise
	// clear the hold - the scout would resume rotating and hop straight back
	// off the shard the operator just went to.
	try { set('probe_hold', PROBE.hold); } catch (e) { }
	pLog(PROBE.hold
		? 'HOLD ON - no hops, no gear spending, no sellTrash. This shard is still '
			+ 'scanned and posted every ' + Math.round(CONFIG.scout.heldScanMs / 1000)
			+ 's while parked at the scan spot. Survives a reload.'
		: 'HOLD OFF - normal behaviour resumes', '#FFD700');
	return PROBE.hold;
}

/* A market view from outside this character.
 
   ALData first, our own bridge second. The order is deliberate and was learned
   the hard way: holding the merchant for a probe stops OUR scouting, at which
   point the local bridge is the *worst* available view of the market rather
   than the best - one shard, frozen at whatever it last saw. ALData keeps
   covering every server regardless of what this merchant is doing.
 
   Both serve the same row shape, so neither is a special case. Returns the
   rows and says which source produced them; callers stamp that onto results so
   nobody has to infer it from the shape of an answer. */
async function arbFetchJson(url, ms) {
	if (typeof fetch !== 'function') throw new Error('no fetch');
	const o = {};
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(function () { try { ac.abort(); } catch (e) { } }, ms);
	}
	try {
		const r = await fetch(url, o);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		return await r.json();
	} finally { if (stop) clearTimeout(stop); }
}

/* 'aldata' | 'bridge' | 'auto'. Stored, so it survives the reload a shard hop
   causes. */
function arbProbeSource(which) {
	if (which) {
		try { set('probe_source', which); } catch (e) { }
		pLog('market source pinned to ' + which, '#FFD700');
	}
	try { return get('probe_source') || 'auto'; } catch (e) { return 'auto'; }
}

async function arbProbeMarketRows() {
	const want = arbProbeSource();
	const attempts = (want === 'bridge') ? ['bridge']
		: (want === 'aldata') ? ['aldata']
			: ['aldata', 'bridge'];
	const errors = {};
	for (const src of attempts) {
		try {
			const rows = (src === 'aldata')
				? await arbFetchJson(CONFIG.scout.aldata + '/merchants', 8000)
				: await scoutFetch('/merchants');
			if (Array.isArray(rows) && rows.length) return { rows: rows, source: src };
			errors[src] = Array.isArray(rows) ? 'empty' : 'not an array';
		} catch (e) {
			errors[src] = String(e && e.message ? e.message : e);
		}
	}
	pLog('no market rows from ' + attempts.join(' or ') + ' ('
		+ attempts.map(function (k) { return k + ': ' + errors[k]; }).join('; ')
		+ ') - falling back to what is in view', 'orange');
	return { rows: null, source: 'in-view', errors: errors };
}

/* Accepts an ISO string or an epoch number - aldata and the bridge need not
   agree on which, and a silently-null age would sort as "freshest". */
function pAgeSec(when) {
	const t = (typeof when === 'number') ? when : Date.parse(when);
	if (!isFinite(t)) return null;
	const ms = (t > 1e12) ? t : (t > 1e9 ? t * 1000 : t);
	return Math.round((Date.now() - ms) / 1000);
}

/* Is the bridge actually feeding the finders? Asked directly, because the
   alternative is inferring it from the shape of a result - which has already
   been got wrong once. */
async function arbProbeBridge() {
	const out = { preference: arbProbeSource(), bridgeUrl: CONFIG.scout.bridge, aldataUrl: CONFIG.scout.aldata };
	try {
		out.health = await scoutFetch('/health');
		out.bridgeReachable = true;
	} catch (e) {
		out.bridgeError = String(e && e.message ? e.message : e);
		out.bridgeReachable = false;
		pLog('local bridge NOT reachable at ' + out.bridgeUrl + ' (' + out.bridgeError + ')', 'orange');
	}
	const got = await arbProbeMarketRows();
	const rows = got.rows;
	out.source = got.source;
	out.reachable = got.source !== 'in-view';
	out.stands = rows ? rows.length : 0;
	const shards = {};
	let listings = 0, buyOrders = 0;
	for (const r of (rows || [])) {
		const k = String(r.serverRegion) + String(r.serverIdentifier);
		shards[k] = (shards[k] || 0) + 1;
		for (const s2 in (r.slots || {})) { listings++; if (r.slots[s2] && r.slots[s2].b) buyOrders++; }
	}
	out.shards = shards;
	out.shardCount = Object.keys(shards).length;
	out.listings = listings;
	out.buyOrders = buyOrders;
	pLog('SOURCE ' + out.source + ': ' + out.stands + ' stands across ' + out.shardCount
		+ ' shard(s), ' + listings + ' listings of which ' + buyOrders + ' are buy orders',
		out.source === 'in-view' ? 'orange' : null);
	return pShow(out);
}

/* Ponty's stock, from the local bridge, across every shard a scout has read.
 
   Always the bridge - ALData does not carry Ponty, which is exactly why this
   matters. It is the one buy source that is genuinely private: every spread
   visible on the public board is visible to everyone querying it, and Ponty's
   stock is not on that board at all.
 
   It is also the only buy leg with no counterparty risk. A player merchant can
   pack up between reading their price and arriving at their stand; Ponty
   cannot. His stock rotates, so a listing can still be gone - but he is always
   there, which removes the failure mode that makes a cross-shard round trip
   risky in the first place. */
async function arbProbePontyRows() {
	let raw = null;
	try { raw = await scoutFetch('/ponty'); } catch (e) { return { rows: [], error: String(e && e.message ? e.message : e) }; }
	const rows = [];
	for (const shard in (raw || {})) {
		const e = raw[shard] || {};
		const age = pAgeSec(e.at);
		for (const it of (e.items || [])) {
			if (!it || !it.name) continue;
			rows.push({
				source: 'ponty', npc: true, counterparty: 'none',
				shard: shard, ageSec: age,
				target: 'Ponty', slot: null,
				name: it.name, level: it.level || 0, p: it.p || null,
				price: it.price, q: it.q || 1,
			});
		}
	}
	return { rows: rows };
}

/* Ponty stock across shards, cheapest first. Standalone because his stock is
   worth looking at on its own, not only when it happens to undercut a player. */
async function arbProbeFindPonty(maxPrice) {
	const got = await arbProbePontyRows();
	const cap = (maxPrice == null) ? Infinity : maxPrice;
	// Dearest first, not cheapest. Sorting Ponty up from the bottom returns
	// thirty snowballs at 2 gold: cheap items are cheap because nobody wants
	// them, and the slice then hides the gear that is actually worth flipping.
	const out = got.rows
		.filter(function (r) { return typeof r.price === 'number' && isFinite(r.price) && r.price <= cap; })
		.sort(function (a, b) { return b.price - a.price; });
	if (got.error) {
		pLog('Ponty stock unavailable (' + got.error + ') - the local bridge serves it, ALData does not', 'orange');
		return pShow([]);
	}
	const oldest = out.reduce(function (m, r) { return Math.max(m, r.ageSec || 0); }, 0);
	pLog(out.length + ' Ponty listing(s)' + (cap === Infinity ? '' : ' at or under ' + cap)
		+ ' across ' + [...new Set(out.map(function (r) { return r.shard; }))].length + ' shard(s)');
	// Ponty answers only when stood next to, so his stock is refreshed by a
	// rotation and by nothing else. A hold keeps stands current through
	// scoutHeldScan but cannot do the same here without walking the merchant
	// away mid-probe, so a long hold silently ages this data out.
	if (oldest > 30 * 60) {
		pLog('Ponty data is ' + Math.round(oldest / 60) + ' min old - his stock rotates, so treat this '
			+ 'as history. Only a scouting rotation refreshes it: arbProbeHold(false) for a sweep.', 'orange');
	}
	return pShow(out.slice(0, 30));
}

/* Candidates for the BUY leg, taken from what the scouts already recorded
   rather than from whatever happens to be standing here.
 
   Ordered by AGE, not by price. The cheapest listing on the board is worthless
   if the seller packed up twenty minutes ago, and every candidate here is under
   the probe cap anyway - so the question is not "which is cheapest" but "which
   is most likely to still be there when we arrive". Price breaks ties.
 
   Falls back to the in-view scan when the bridge is down or has nothing. */
async function arbProbeFindBuy(maxPrice) {
	const cap = maxPrice || CONFIG.arbitrage.probe.maxPrice;
	const got = await arbProbeMarketRows();
	const rows = got.rows || [];
	const here = mShardKey();
	const out = [];
	if (!rows.length) {
		// Stamped and wrapped in an array. Returning a bare object here once
		// read as "the finder returns the single best candidate" rather than
		// "no market feed was consulted" - the opposite conclusion, and the one
		// that matters.
		//
		// Falls THROUGH rather than returning: Ponty comes from the bridge, and
		// the bridge can have his stock while having no merchant rows at all.
		// Returning early here skipped the one buy source that is still ours
		// when the public feed is down, which is exactly when it matters most.
		const local = arbProbePick(cap);
		if (local) out.push(Object.assign({ source: 'in-view', shard: here, here: true, ageSec: 0 }, local));
		pLog('SOURCE: in-view scan only - ' + out.length + ' stand candidate(s)', 'orange');
	}
	for (const r of rows) {
		const shard = String(r.serverRegion) + String(r.serverIdentifier);
		const age = pAgeSec(r.lastSeen);
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || sl.b) continue;
			if (!(typeof sl.price === 'number' && isFinite(sl.price))) continue;
			if (sl.price > cap) continue;
			out.push({
				source: got.source,
				shard: shard, here: shard === here, ageSec: age,
				target: r.id, slot: k, name: sl.name, level: sl.level || 0,
				price: sl.price, q: sl.q, map: r.map, x: r.x, y: r.y,
			});
		}
	}
	// Ponty joins the same list. He is not on ALData, so he comes from the
	// bridge whatever the market source is - a private candidate on a public
	// board's worth of competition.
	const pon = await arbProbePontyRows();
	let pontyCount = 0;
	for (const r of pon.rows) {
		if (!(typeof r.price === 'number' && isFinite(r.price)) || r.price > cap) continue;
		out.push(Object.assign({}, r, { here: r.shard === here, map: 'main', x: null, y: null }));
		pontyCount++;
	}
	const FRESH = CONFIG.arbitrage.sellMaxAgeSec;
	for (const r of out) r.stale = (r.ageSec == null) || (r.ageSec > FRESH);
	out.sort(function (a, b) {
		if (a.stale !== b.stale) return a.stale ? 1 : -1;  // a dead listing is not a cheap one
		if (a.here !== b.here) return a.here ? -1 : 1;     // no hop beats a hop
		// Ponty cannot pack up between reading his price and arriving, so at
		// equal freshness he is the safer of two otherwise equal candidates.
		if (!!a.npc !== !!b.npc) return a.npc ? -1 : 1;
		if ((a.ageSec || 0) !== (b.ageSec || 0)) return (a.ageSec || 0) - (b.ageSec || 0);
		return a.price - b.price;
	});
	// One empty-result path, not two. The old one here returned arbProbePick's
	// bare object-or-null - the same shape ambiguity that was already fixed
	// once on the other branch, left behind when the in-view fallback moved up.
	// The in-view scan has already run above by the time we reach this.
	if (!out.length) {
		pLog('nothing at or under ' + cap + ' gold on ' + got.source + ' or at Ponty', 'orange');
		return pShow([]);
	}
	const top = out[0];
	if (rows.length) pLog('SOURCE: ' + got.source + ' (' + rows.length + ' stands across all shards)'
		+ (pontyCount ? ' + ' + pontyCount + ' Ponty listing(s) from the bridge'
			: (pon.error ? ' - no Ponty (' + pon.error + ')' : ' - Ponty has nothing under the cap')));
	else if (pontyCount) pLog('SOURCE: Ponty only (' + pontyCount + ' listing(s) from the bridge)');
	pLog(out.length + ' candidate(s) at or under ' + cap + '. Best: ' + top.name
		+ ' @ ' + top.price + ' from ' + top.target + ' on ' + top.shard
		+ ' (' + top.ageSec + 's old' + (top.stale ? ', STALE' : '')
		+ (top.npc ? ', NPC - no counterparty risk' : '') + ')'
		+ (top.here ? ' - already here' : ' - arbProbeGo("' + top.shard + '")'));
	return pShow(out.slice(0, 20));
}

/* Candidates for the SELL leg - the taxed one, and the one that otherwise
   stalls for want of a counterparty.
 
   Cross-references the merchant's OWN INVENTORY against every buy order the
   scouts have seen, so the question stops being "will someone turn up wanting
   what I bought" and becomes "who already wants something I am holding".
   Matched on name, level and special, the same way the watchlist groups them -
   a level 0 buy order does not pay for a level 3 item.
 
   Ordered by price, highest first: the tax measurement needs two sales at
   clearly different prices, and the top and bottom of this list are exactly
   that pair. */
async function arbProbeFindSell() {
	const have = new Map();
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (!it || !it.name) continue;
		const key = it.name + '|' + (it.level || 0) + '|' + (it.p || '');
		if (!have.has(key)) have.set(key, { slot: i, name: it.name, level: it.level || 0, p: it.p || null, q: it.q || 1 });
	}
	if (!have.size) { pLog('inventory is empty - nothing to sell', 'orange'); return []; }

	const got = await arbProbeMarketRows();
	const rows = got.rows;
	const here = mShardKey();
	const out = [];
	let source = got.source;
	const scan = function (shard, ageSec, r) {
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || !sl.b) continue;
			const key = sl.name + '|' + (sl.level || 0) + '|' + (sl.p || '');
			const mine = have.get(key);
			if (!mine) continue;
			out.push({
				source: source,
				shard: shard, here: shard === here, ageSec: ageSec,
				target: r.id, slot: k, name: sl.name, level: sl.level || 0,
				theyPay: sl.price, theyWant: sl.q, iHoldSlot: mine.slot, iHold: mine.q,
				map: r.map, x: r.x, y: r.y,
			});
		}
	};
	if (rows === null || !rows.length) {
		source = 'in-view';
		for (const r of scoutScanStands()) scan(here, 0, r);
	} else {
		for (const r of rows) scan(String(r.serverRegion) + String(r.serverIdentifier), pAgeSec(r.lastSeen), r);
	}
	// Stated before the result, because an empty list means very different
	// things depending on which of the two it is.
	pLog('SOURCE: ' + (source === 'in-view'
		? 'in-view scan only'
		: source + ' (' + rows.length + ' stands across all shards)'),
		source === 'in-view' ? 'orange' : null);
	// Freshness FIRST, then price. Sorting on price alone was wrong and it
	// showed: a four-day-old buy order for 60,000 outranked a 98-second-old one,
	// and the older merchant is long gone. A high price on a dead listing is not
	// a better trade, it is not a trade. findBuy already ordered by age; this
	// did not, which was simply an inconsistency.
	const FRESH = CONFIG.arbitrage.sellMaxAgeSec;
	for (const r of out) r.stale = (r.ageSec == null) || (r.ageSec > FRESH);
	out.sort(function (a, b) {
		if (a.stale !== b.stale) return a.stale ? 1 : -1;
		return (b.theyPay || 0) - (a.theyPay || 0);
	});
	if (!out.length) {
		pLog('nobody the scouts have seen is buying anything currently held'
			+ ' - arbProbeWhyNoSell() shows what was compared', 'orange');
		return pShow([]);
	}
	const fresh = out.filter(function (r) { return !r.stale; });
	if (!fresh.length) {
		pLog(out.length + ' buyer(s) for held items, but ALL are older than '
			+ Math.round(FRESH / 60) + ' min - treat them as gone, not as offers', 'orange');
	} else if (fresh.length < out.length) {
		pLog(fresh.length + ' fresh of ' + out.length + ' buyer(s); the rest are stale and ranked last');
	}
	const top = out[0];
	pLog(out.length + ' buyer(s) for held items. Best: ' + top.name + ' lvl ' + top.level
		+ ' -> ' + top.theyPay + ' from ' + top.target + ' on ' + top.shard
		+ ' (' + top.ageSec + 's old' + (top.stale ? ', STALE' : '') + ')'
		+ (top.here ? ' - already here' : ' - arbProbeGo("' + top.shard + '")'));
	return pShow(out.slice(0, 20));
}

/* Why findSell came back empty.
 
   "20 buy orders exist, none of them match" is a conclusion, not an
   observation, and the two things it could mean need different responses: a
   real gap in the market, or a matching rule that is too strict. So show the
   working - what is held, what is wanted, and in particular the NEAR MISSES:
   the same item name at a different level or special.
 
   A near miss is the informative case. A pile of them means the level+special
   match is throwing away trades; none at all means the market genuinely does
   not want what this merchant is carrying, and the sell leg has to wait. */
async function arbProbeWhyNoSell() {
	const held = [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (!it || !it.name) continue;
		held.push({ slot: i, name: it.name, level: it.level || 0, p: it.p || null, q: it.q || 1 });
	}
	const got = await arbProbeMarketRows();
	const rows = got.rows;
	const here = mShardKey();
	const wanted = [];
	const src = (rows === null || !rows.length)
		? scoutScanStands().map(function (r) { return { r: r, shard: here, age: 0 }; })
		: rows.map(function (r) { return { r: r, shard: String(r.serverRegion) + String(r.serverIdentifier), age: pAgeSec(r.lastSeen) }; });
	for (const e of src) {
		for (const k in (e.r.slots || {})) {
			const sl = e.r.slots[k];
			if (!sl || !sl.b) continue;
			wanted.push({
				shard: e.shard, ageSec: e.age, target: e.r.id, slot: k,
				name: sl.name, level: sl.level || 0, p: sl.p || null,
				pays: sl.price, wants: sl.q,
			});
		}
	}
	const heldNames = new Set(held.map(function (h) { return h.name; }));
	const exact = [];
	const near = [];
	for (const w of wanted) {
		if (!heldNames.has(w.name)) continue;
		const mine = held.filter(function (h) { return h.name === w.name; });
		const hit = mine.filter(function (h) { return h.level === w.level && (h.p || '') === (w.p || ''); });
		if (hit.length) exact.push({ buyer: w, mine: hit });
		else near.push({ buyer: w, mine: mine, why: 'same item, different level/special' });
	}
	const out = {
		source: got.source,
		shardsSeen: [...new Set(wanted.map(function (w) { return w.shard; }))],
		heldCount: held.length,
		buyOrdersSeen: wanted.length,
		nameOverlap: exact.length + near.length,
		exactMatches: exact.length,
		nearMisses: near,
		held: held,
		wantedItems: [...new Set(wanted.map(function (w) { return w.name + ' lvl' + w.level; }))].sort(),
	};
	pLog('[' + got.source + '] ' + held.length + ' held vs ' + wanted.length
		+ ' buy order(s) on ' + out.shardsSeen.join(',')
		+ ': ' + exact.length + ' exact, ' + near.length + ' near miss(es)',
		near.length ? '#FFD700' : null);
	if (!out.nameOverlap) {
		pLog('no item NAME appears on both sides - a real market gap, not a matching rule');
	} else if (!exact.length) {
		pLog('names overlap but level/special never does - the match rule is what is blocking', '#FFD700');
	}
	return pShow(out);
}

/* THE MONEY QUERY: every buy-side listing that some player is paying more for
   than it costs, after tax, right now.
 
   This is the whole arbitrage thesis in one function. Buy side is player
   stands plus Ponty; sell side is player buy orders. Both sides must be fresh,
   because a spread between two dead listings is arithmetic, not an
   opportunity.
 
   Net is per unit and taxed on the sell leg only - the buyer pays the listed
   price, we receive gold from another account and are taxed on it:
 
       unitNet = sellPrice * (1 - taxRate) - buyPrice
 
   Quantity is capped by both sides: Ponty's stock and what the buyer will
   take. Profit is unitNet times that, so a thin margin on a large order can
   outrank a fat one on a single item - which is usually the real shape of
   this.
 
   A note on Ponty specifically: he sells at calculate_item_value times
   secondhands_mult, which is above what a vendor pays for the same item.
   Buying from Ponty to vendor is therefore always a loss, and the only
   profitable exit is a player buy order. That is not a limitation, it is the
   reason to look: those buy orders are on the public board but Ponty's stock
   is not, so the pairing is not one everyone else can see. */
async function arbProbeFindFlips(opts) {
	opts = opts || {};
	const minProfit = (opts.minProfit == null) ? CONFIG.arbitrage.minProfit : opts.minProfit;
	const maxAge = (opts.maxAgeSec == null) ? CONFIG.arbitrage.sellMaxAgeSec : opts.maxAgeSec;
	const tax = arbTaxRate();
	if (tax == null) {
		pLog('no tax rate available - refusing to price a flip rather than assume zero', 'red');
		return pShow([]);
	}

	const got = await arbProbeMarketRows();
	const rows = got.rows || [];
	const here = mShardKey();
	const fresh = function (a) { return a != null && a <= maxAge; };

	const buys = [];   // things we could acquire
	const sells = [];  // people paying for things
	for (const r of rows) {
		const shard = String(r.serverRegion) + String(r.serverIdentifier);
		const age = pAgeSec(r.lastSeen);
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || !sl.name) continue;
			if (!(typeof sl.price === 'number' && isFinite(sl.price))) continue;
			const rec = {
				key: sl.name + '|' + (sl.level || 0) + '|' + (sl.p || ''),
				shard: shard, ageSec: age, target: r.id, slot: k,
				name: sl.name, level: sl.level || 0, p: sl.p || null,
				price: sl.price, q: sl.q || 1, map: r.map, x: r.x, y: r.y,
				source: got.source, npc: false,
			};
			(sl.b ? sells : buys).push(rec);
		}
	}
	const pon = await arbProbePontyRows();
	for (const r of pon.rows) {
		if (!(typeof r.price === 'number' && isFinite(r.price))) continue;
		buys.push(Object.assign({ key: r.name + '|' + r.level + '|' + (r.p || ''), map: 'main', x: null, y: null }, r));
	}

	const cheapest = new Map();
	for (const b of buys) {
		if (!fresh(b.ageSec)) continue;
		const cur = cheapest.get(b.key);
		if (!cur || b.price < cur.price) cheapest.set(b.key, b);
	}

	const out = [];
	for (const sell of sells) {
		if (!fresh(sell.ageSec)) continue;
		const buy = cheapest.get(sell.key);
		if (!buy) continue;
		const unitNet = sell.price * (1 - tax) - buy.price;
		if (unitNet <= 0) continue;
		const qty = Math.max(1, Math.min(buy.q || 1, sell.q || 1));
		const spend = buy.price * qty;
		const profit = Math.floor(unitNet * qty);
		if (profit < minProfit) continue;
		out.push({
			item: sell.name, level: sell.level, special: sell.p,
			qty: qty, spend: spend, profit: profit,
			unitNet: Math.round(unitNet), taxRate: tax,
			buyFrom: buy.target, buyPrice: buy.price, buyShard: buy.shard,
			buyAgeSec: buy.ageSec, buyIsNpc: !!buy.npc, buySlot: buy.slot,
			sellTo: sell.target, sellPrice: sell.price, sellShard: sell.shard,
			sellAgeSec: sell.ageSec, sellSlot: sell.slot,
			sameShard: buy.shard === sell.shard,
			hops: (buy.shard === sell.shard ? (buy.shard === here ? 0 : 1) : (buy.shard === here ? 1 : 2)),
			affordable: (character.gold - spend) >= CONFIG.arbitrage.goldFloor,
		});
	}
	out.sort(function (a, b) { return b.profit - a.profit; });

	if (!out.length) {
		pLog('no flip clears ' + minProfit + ' with both sides under ' + Math.round(maxAge / 60)
			+ ' min old (tax ' + (tax * 100).toFixed(1) + '%, ' + buys.length + ' buy-side, '
			+ sells.length + ' sell-side listings considered)', 'orange');
		return pShow([]);
	}
	const t = out[0];
	const unaffordable = out.filter(function (r) { return !r.affordable; }).length;
	pLog(out.length + ' flip(s) clearing ' + minProfit + '. Best: ' + t.item + ' x' + t.qty
		+ ' - buy ' + t.buyPrice + ' from ' + t.buyFrom + ' (' + t.buyShard + ')'
		+ ', sell ' + t.sellPrice + ' to ' + t.sellTo + ' (' + t.sellShard + ')'
		+ ' = ' + t.profit + ' net, ' + t.hops + ' hop(s)'
		+ (t.affordable ? '' : ' - NOT AFFORDABLE under the ' + CONFIG.arbitrage.goldFloor + ' floor'),
		'#7FD98A');
	if (unaffordable) pLog(unaffordable + ' of these would breach the gold floor', 'orange');
	return pShow(out.slice(0, 20));
}

/* Travel to a candidate's shard. THE SCRIPT RESTARTS: change_server reloads the
   page, so nothing after this call runs. The hold and the probe log are both in
   storage, so they come back; anything held only in memory does not. */
async function arbProbeGo(shardKey) {
	if (shardKey === mShardKey()) { pLog('already on ' + shardKey); return true; }
	arbProbeHold(true);
	pLog('hopping to ' + shardKey + ' - the page will reload and this script restarts', '#FFD700');
	return await mHopTo(shardKey);
}

/* Every function in either scope whose name suggests trading or banking.
   Discovery, not a guess list: the point is to see names nobody thought to
   look for. */
function arbProbeFns() {
	const seen = new Set();
	const out = [];
	const scopes = [];
	try { if (typeof globalThis !== 'undefined' && globalThis) scopes.push(['runner', globalThis]); } catch (e) { }
	try { if (typeof parent !== 'undefined' && parent) scopes.push(['parent', parent]); } catch (e) { }
	for (const pair of scopes) {
		const label = pair[0], scope = pair[1];
		let keys = [];
		try { keys = Object.keys(scope); } catch (e) { continue; }
		for (const k of keys) {
			if (!/trade|buy|sell|bank|merchant|stand|exchange|vend/i.test(k)) continue;
			let v;
			try { v = scope[k]; } catch (e) { continue; }
			if (typeof v !== 'function') continue;
			const sig = label + '.' + k;
			if (seen.has(sig)) continue;
			seen.add(sig);
			out.push({ scope: label, name: k, arity: v.length });
		}
	}
	out.sort((a, b) => a.name.localeCompare(b.name) || a.scope.localeCompare(b.scope));
	pLog(out.length + ' candidate function(s) found by name scan');
	return pShow(out);
}

/* The named check. Object.keys does not see identifiers declared in the
   runner's own scope, so the ones that actually matter are referenced
   directly and the ReferenceError caught. Verbose on purpose: a missing name
   here is a real finding, not a gap in the scan. */
function arbProbeNamed() {
	const out = [];
	const t = function (name, get) {
		try {
			const fn = get();
			out.push({ name: name, type: typeof fn, arity: (typeof fn === 'function') ? fn.length : null });
		} catch (e) {
			out.push({ name: name, type: 'undeclared', arity: null });
		}
	};
	t('trade_buy', function () { return trade_buy; });
	t('trade_sell', function () { return trade_sell; });
	t('buy', function () { return buy; });
	t('sell', function () { return sell; });
	t('buy_with_gold', function () { return buy_with_gold; });
	t('bank_deposit', function () { return bank_deposit; });
	t('bank_withdraw', function () { return bank_withdraw; });
	t('bank_store', function () { return bank_store; });
	t('bank_retrieve', function () { return bank_retrieve; });
	t('open_stand', function () { return open_stand; });
	t('close_stand', function () { return close_stand; });
	t('calculate_item_value', function () { return calculate_item_value; });
	pLog('named API check');
	return pShow(out);
}

/* The most valuable single output of Phase 0. A runner function is a thin
   wrapper around a socket emit, so its source names the event and the exact
   payload keys - which is the argument order and shape, straight from the
   game, with nothing inferred. */
function arbProbeSrc(name) {
	let fn = null;
	try { fn = eval(name); } catch (e) { }                 // runner scope
	if (typeof fn !== 'function') {
		try { fn = parent[name]; } catch (e) { }           // parent scope
	}
	if (typeof fn !== 'function') {
		pLog('no function named "' + name + '" in either scope', 'orange');
		return null;
	}
	const src = String(fn);
	pLog('source of ' + name + ' (' + src.length + ' chars) - see console');
	try { console.log('[probe] ' + name + ' =\n' + src); } catch (e) { }
	return src;
}

/* Every visible stand with its distance, so the operator can see what is in
   reach before touching anything. Deliberately built on the same reader the
   scout posts from, so what the probe sees and what the watchlist shows are
   the same rows. */
function arbProbeStands() {
	const rows = scoutScanStands().map(function (r) {
		return {
			id: r.id, map: r.map, x: r.x, y: r.y,
			dist: Math.round(pDist(character.x, character.y, r.x, r.y)),
			sells: Object.keys(r.slots).filter(function (k) { return !r.slots[k].b; }).length,
			buys: Object.keys(r.slots).filter(function (k) { return r.slots[k].b; }).length,
		};
	}).sort(function (a, b) { return a.dist - b.dist; });
	pLog(rows.length + ' stand(s) in view on ' + mShardKey());
	return pShow(rows);
}

/* The cheapest sell slot at or under a cap, with everything arbProbeCall
   needs already assembled. This is how the first real trade gets chosen: by
   price, so the experiment costs pocket change. */
function arbProbePick(maxPrice) {
	const cap = maxPrice || CONFIG.arbitrage.probe.maxPrice;
	let best = null;
	for (const r of scoutScanStands()) {
		for (const k in r.slots) {
			const sl = r.slots[k];
			if (sl.b) continue;                                  // buy orders are not for sale
			if (!(typeof sl.price === 'number' && isFinite(sl.price))) continue;
			if (sl.price > cap) continue;
			const cand = {
				target: r.id, slot: k, name: sl.name, level: sl.level,
				price: sl.price, q: sl.q,
				x: r.x, y: r.y, dist: Math.round(pDist(character.x, character.y, r.x, r.y)),
			};
			if (!best || cand.price < best.price) best = cand;
		}
	}
	if (!best) pLog('nothing on sale at or under ' + cap + ' gold in view', 'orange');
	else pLog('cheapest in view: ' + best.name + ' lvl ' + best.level + ' @ ' + best.price + ' from ' + best.target + ' (' + best.dist + ' away)');
	return pShow(best);
}

/* Visible buy orders, for the sell leg. Cheapest first is the wrong order
   here - a buy order is worth more the higher it is. */
function arbProbeBuyOrders() {
	const out = [];
	for (const r of scoutScanStands()) {
		for (const k in r.slots) {
			const sl = r.slots[k];
			if (!sl.b) continue;
			out.push({
				target: r.id, slot: k, name: sl.name, level: sl.level,
				price: sl.price, wants: sl.q,
				dist: Math.round(pDist(character.x, character.y, r.x, r.y)),
			});
		}
	}
	out.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
	pLog(out.length + ' buy order(s) in view');
	return pShow(out);
}

/* Inventory headroom. esize is the number the purchase gate will read, so it
   is worth confirming it means what it is assumed to mean rather than
   trusting the name. Stack counts are reported alongside because a stackable
   purchase may need no new slot at all. */
function arbProbeInv() {
	let used = 0;
	const stacks = {};
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (!it) continue;
		used++;
		if (it.q && it.q > 1) stacks[it.name] = (stacks[it.name] || 0) + it.q;
	}
	// character.tax is the question Phase 1 cares about most here: if the server
	// exposes its own rate there is no band table to keep in step.
	const banded = (function () {
		for (const b of CONFIG.arbitrage.taxBands) if (character.level > b.above) return b.rate;
		return null;
	})();
	const info = {
		esize: character.esize,
		slotsTotal: character.items.length,
		slotsUsed: used,
		slotsFreeCounted: character.items.length - used,
		gold: character.gold,
		level: character.level,
		taxLive: (typeof character.tax === 'number') ? character.tax : null,
		taxFromBands: banded,
		taxUsed: arbTaxRate(),
		stacked: stacks,
	};
	pLog('tax: bands say ' + (banded * 100).toFixed(1) + '% at level ' + character.level
		+ (info.taxLive == null
			? ' - character.tax NOT exposed, falling back to the table'
			: (info.taxLive === banded
				? ' - character.tax agrees'
				: ' - character.tax says ' + (info.taxLive * 100).toFixed(1) + '%, DISAGREES with the table')),
		(info.taxLive != null && info.taxLive !== banded) ? 'orange' : null);
	pLog('inventory: esize=' + character.esize + ', counted free=' + info.slotsFreeCounted
		+ (character.esize === info.slotsFreeCounted ? ' (agree)' : ' (DISAGREE - esize does not mean free slots)'),
		character.esize === info.slotsFreeCounted ? null : 'orange');
	return pShow(info);
}

/* Walk to the bank, read what is actually there, and walk back - timed, since
   the agreed rule is that every sale is followed by a bank visit before
   scouting resumes, and that rule is only affordable if the trip is short.
   Reads only: no deposit, no withdrawal. */
async function arbProbeBank() {
	if (state.busy) { pLog('merchant is busy - try again in a moment', 'orange'); return null; }
	const wasHeld = PROBE.hold;
	arbProbeHold(true);
	state.busy = true;
	const t0 = Date.now();
	const result = { from: { map: character.map, x: Math.round(character.x), y: Math.round(character.y) } };
	try {
		const ok = await travelToBank();
		result.reachedBank = ok;
		result.toBankMs = Date.now() - t0;
		if (!ok) {
			pLog('could not reach the bank', 'red');
		} else {
			// character.bank is null anywhere but inside the bank map, which is
			// exactly why a pre-purchase bank-space check cannot be done from
			// the field. Confirm that here rather than take it on trust.
			const b = character.bank || null;
			result.bankVisible = !!b;
			result.bankGold = b ? b.gold : null;
			result.packs = b ? Object.keys(b).filter(function (k) { return k !== 'gold'; }) : [];
			result.freeBySlot = {};
			if (b) {
				for (const k of result.packs) {
					const arr = b[k] || [];
					let free = 0;
					for (let i = 0; i < arr.length; i++) if (!arr[i]) free++;
					result.freeBySlot[k] = { size: arr.length, free: free };
				}
			}
			pLog('bank: ' + result.packs.length + ' pack(s), gold=' + result.bankGold);
		}
		const t1 = Date.now();
		await scoutGoToScanSpot();
		result.backMs = Date.now() - t1;
		result.totalMs = Date.now() - t0;
		pLog('bank round trip: ' + Math.round(result.totalMs / 1000) + 's ('
			+ Math.round(result.toBankMs / 1000) + 's there, ' + Math.round(result.backMs / 1000) + 's back)');
	} catch (e) {
		result.error = String(e && e.reason ? e.reason : e);
		pLog('bank probe failed: ' + result.error, 'red');
	} finally {
		state.busy = false;
		if (!wasHeld) arbProbeHold(false);
	}
	return pShow(result);
}

/* Stand exactly `dist` units from a target stand, on the line between here and
   there. This is the distance walk-in: call it at decreasing distances and
   retry the trade at each, and the first distance that stops being rejected
   is the real trade range. Nothing about it is guessed or hardcoded, which is
   the point - whatever the number turns out to be, and whenever it changes,
   this measures it again. */
/* Distance, computed here rather than through the game's distance().
 
   distance(character, {x, y}) was returning numbers that had nothing to do
   with the real separation - 208 when the true gap was 1307, 47 when it was
   708 - so a plain {x,y} is evidently not what it expects. Whatever it does
   with one, this is eight lines of arithmetic and it cannot lie. Different
   maps are not comparable, so that returns null rather than a number. */
function pDist(ax, ay, bx, by) {
	const dx = ax - bx, dy = ay - by;
	const d = Math.sqrt(dx * dx + dy * dy);
	return isFinite(d) ? d : null;
}

function pWhere(e) {
	if (!e) return null;
	return {
		map: e.map,
		x: (e.real_x != null ? e.real_x : e.x),
		y: (e.real_y != null ? e.real_y : e.y),
	};
}

/* Find a visible entity by name. parent.entities is keyed by id; for players
   the id is the name, but get_player is the documented route, so try both. */
function pEntity(name) {
	let e = null;
	try { e = parent.entities[name] || null; } catch (err) { }
	if (!e) { try { e = get_player(name) || null; } catch (err) { } }
	if (!e) {
		try {
			for (const id in parent.entities) {
				const c = parent.entities[id];
				if (c && c.name === name) { e = c; break; }
			}
		} catch (err) { }
	}
	return e;
}

/* Does the game's distance() agree with plain arithmetic?
 
   It did not in the field - 208 against a true 1307, then 47 against 708 - but
   only ever when called with a plain {x, y}. The merchant's own long-standing
   code calls it the same way for the scan spot, the stand spot and the potion
   NPC, and that code demonstrably works: the stand goes up in the right place
   and scoutHeldScan fires. So the fault is not obviously in distance() itself,
   and rewriting working code on a theory is how good code gets broken.
 
   This settles it by measuring instead. Run it next to any loaded target and
   it reports both numbers for the same two points. If they agree, the probe's
   208 came from somewhere else and the scan-spot checks are fine. If they
   disagree, every distance() call in this file that passes a plain object is
   suspect and they are listed here so they can be fixed together. */
function arbProbeDistanceCheck(targetName) {
	const out = { cases: [] };
	const me = pWhere(character);
	const add = function (label, x, y, extra) {
		let game = null, err = null;
		try { game = Math.round(distance(character, Object.assign({ x: x, y: y }, extra || {}))); }
		catch (e) { err = String(e && e.message ? e.message : e); }
		const mine = Math.round(pDist(me.x, me.y, x, y));
		out.cases.push({ label: label, at: { x: Math.round(x), y: Math.round(y) }, game: game, pDist: mine, agree: game === mine, error: err });
	};
	if (targetName) {
		const e = pEntity(targetName);
		if (e) {
			const t = pWhere(e);
			add('entity ' + targetName + ' via plain {x,y}', t.x, t.y);
			let game = null;
			try { game = Math.round(distance(character, e)); } catch (err) { }
			out.cases.push({
				label: 'entity ' + targetName + ' passed WHOLE', at: { x: Math.round(t.x), y: Math.round(t.y) },
				game: game, pDist: Math.round(pDist(me.x, me.y, t.x, t.y)), agree: game === Math.round(pDist(me.x, me.y, t.x, t.y)),
			});
		} else out.cases.push({ label: targetName + ' not loaded', game: null, pDist: null, agree: null });
	}
	const spot = CONFIG.stand.candidates[0];
	if (spot) add('the scan/stand spot (used by scoutHeldScan)', spot.x, spot.y);
	add('the potion NPC ' + CONFIG.npc.name, CONFIG.npc.x, CONFIG.npc.y, { map: CONFIG.npc.map });
	add('a point 1000 units due east', me.x + 1000, me.y);

	out.meAt = me;
	out.allAgree = out.cases.every(function (c) { return c.agree !== false; });
	pLog(out.allAgree
		? 'distance() agrees with plain arithmetic on every case - the 208 came from elsewhere'
		: 'distance() DISAGREES with plain arithmetic - every plain-object call in this file is suspect',
		out.allAgree ? null : 'red');
	return pShow(out);
}

/* Stand `dist` units from a target, and REPORT WHETHER IT ACTUALLY HAPPENED.
 
   The previous version claimed success while standing still. It awaited
   move(), which walks only in a straight line and, when the path is blocked,
   neither moves nor throws - so the smart_move fallback in the catch never
   ran. It then measured with the game's distance() against a plain {x,y},
   which returned a number unrelated to the real gap. Two independent faults,
   and between them it reported "standing 208 units from Griffin" while parked
   1307 units away and never having moved.
 
   So: smart_move first, since it is the one that pathfinds; positions read
   before and after; distance computed here; and the result says plainly
   whether the character moved at all. A caller must be able to distinguish
   "in position" from "still where it started but told otherwise". */
async function arbProbeStep(targetName, dist) {
	const e = pEntity(targetName);
	if (!e) {
		pLog('no entity named "' + targetName + '" is loaded here - cannot position', 'orange');
		return pShow({ ok: false, reason: 'target_not_loaded', target: targetName });
	}
	const t = pWhere(e);
	const from = pWhere(character);
	const want = (dist == null) ? CONFIG.arbitrage.probe.startDist : dist;
	const before = (from.map === t.map) ? pDist(from.x, from.y, t.x, t.y) : null;

	let dx = from.x - t.x, dy = from.y - t.y;
	let len = Math.sqrt(dx * dx + dy * dy);
	// Standing exactly on top of the target leaves no direction to back off in;
	// any direction will do, so pick one.
	if (!len || !isFinite(len)) { dx = 1; dy = 0; len = 1; }
	const px = t.x + (dx / len) * want, py = t.y + (dy / len) * want;

	const errors = [];
	try { await smart_move({ map: t.map, x: px, y: py }); }
	catch (err) {
		errors.push('smart_move: ' + (err && (err.reason || err.message) ? (err.reason || err.message) : String(err)));
		try { await move(px, py); }
		catch (err2) { errors.push('move: ' + (err2 && (err2.reason || err2.message) ? (err2.reason || err2.message) : String(err2))); }
	}

	const to = pWhere(character);
	const after = (to.map === t.map) ? pDist(to.x, to.y, t.x, t.y) : null;
	const travelled = (from.map === to.map) ? pDist(from.x, from.y, to.x, to.y) : null;
	const out = {
		ok: false, target: targetName, asked: want,
		aimedAt: { x: Math.round(px), y: Math.round(py), map: t.map },
		targetAt: { x: Math.round(t.x), y: Math.round(t.y), map: t.map },
		from: { x: Math.round(from.x), y: Math.round(from.y), map: from.map },
		to: { x: Math.round(to.x), y: Math.round(to.y), map: to.map },
		movedUnits: travelled == null ? null : Math.round(travelled),
		distBefore: before == null ? null : Math.round(before),
		distAfter: after == null ? null : Math.round(after),
		errors: errors,
	};
	// Under two units of drift is not movement, it is the client jittering.
	out.moved = (out.movedUnits != null && out.movedUnits > 2);
	out.ok = out.moved && out.distAfter != null && Math.abs(out.distAfter - want) <= Math.max(30, want * 0.25);

	if (!out.moved) {
		pLog('DID NOT MOVE. Still ' + out.distAfter + ' units from ' + targetName
			+ ' (asked to stand at ' + want + ')'
			+ (errors.length ? ' - ' + errors.join('; ') : ' - smart_move reported no error'), 'red');
	} else if (!out.ok) {
		pLog('moved ' + out.movedUnits + ' units but ended ' + out.distAfter + ' from '
			+ targetName + ', not the ' + want + ' asked for', 'orange');
	} else {
		pLog('in position: ' + out.distAfter + ' units from ' + targetName
			+ ' (asked ' + want + ', travelled ' + out.movedUnits + ')');
	}
	return pShow(out);
}

/* How far away is a target, and is it even loaded? Read-only, and the thing to
   check before assuming anything about positioning. */
function arbProbeRange(targetName) {
	const e = pEntity(targetName);
	if (!e) {
		pLog('"' + targetName + '" is not in parent.entities - not loaded on this client', 'orange');
		return pShow({ loaded: false, target: targetName });
	}
	const t = pWhere(e), me = pWhere(character);
	const out = {
		loaded: true, target: targetName,
		sameMap: t.map === me.map,
		distance: (t.map === me.map) ? Math.round(pDist(me.x, me.y, t.x, t.y)) : null,
		targetAt: t, meAt: me, hasStand: !!e.stand,
	};
	pLog(targetName + ': ' + (out.sameMap ? out.distance + ' units away on ' + t.map
		: 'on ' + t.map + ', we are on ' + me.map) + (out.hasStand ? ', stand open' : ', no stand'));
	return pShow(out);
}

/* THE ONLY FUNCTION HERE THAT CAN MOVE GOLD.
 
   o = {
     fn:      'trade_buy',        // name discovered by arbProbeFns/arbProbeSrc
     target:  'SomeMerchant',     // stand owner, resolved to an entity
     slot:    'trade1',
     extra:   [1],                // anything after (target, slot) - e.g. qty
     leg:     'buy' | 'sell',     // 'buy' enforces the price cap
     confirm: 'YES'
   }
 
   Arguments are assembled as [entity, slot, ...extra]. If the source dump
   shows a different order, pass o.args directly - that path skips the price
   check, so it needs confirm 'YES-UNCHECKED' and the operator owns the risk.
 
   Gold, inventory and the counterparty's slot are recorded either side of the
   call. A REJECTION IS A RESULT, not a failure: the distance walk-in depends
   on collecting rejections, and the exact reason string is what the Phase 1
   error handling will have to branch on. */
async function arbProbeCall(o) {
	o = o || {};
	const cap = CONFIG.arbitrage.probe.maxPrice;
	const unchecked = !!o.args;
	const need = unchecked ? 'YES-UNCHECKED' : 'YES';
	// Refusals are returned as records, not as a bare null. A caller that gets
	// null cannot tell "you forgot the confirm string" from "the stand is not
	// loaded" from "it costs too much" without scraping the log, and those want
	// three different responses.
	const refuse = function (reason, detail, color) {
		pLog('refused: ' + detail, color || 'orange');
		return pShow({ outcome: 'refused', reason: reason, detail: detail, fn: o.fn, target: o.target || null, slot: o.slot || null });
	};
	if (o.confirm !== need) {
		return refuse('no_confirm', 'this call can spend gold. Pass confirm: "' + need + '" to proceed.');
	}

	let fn = null;
	try { fn = eval(o.fn); } catch (e) { }
	if (typeof fn !== 'function') { try { fn = parent[o.fn]; } catch (e) { } }
	if (typeof fn !== 'function') return refuse('no_such_function', 'no function named "' + o.fn + '"', 'red');

	const ent = o.target ? pEntity(o.target) : null;
	// Presence first, and named as its own reason. The only refusal Phase 0 saw
	// in the field was this one wearing the price check's clothes: the target
	// was on another shard, so its price could not be read, and the message
	// talked about prices when the real problem was that nothing was there.
	if (o.target && !ent) {
		return refuse('target_not_loaded', '"' + o.target + '" is not in parent.entities - '
			+ 'not on this shard, or too far to be loaded. Check with arbProbeRange("' + o.target + '").');
	}
	let slotInfo = null;
	if (ent && o.slot && ent.slots) slotInfo = ent.slots[o.slot] || null;

	if (!unchecked && (o.leg || 'buy') === 'buy') {
		if (!slotInfo) {
			return refuse('slot_unreadable', o.target + ' is loaded but has no readable slot "' + o.slot
				+ '" - the stand may have closed or been rearranged.');
		}
		if (!(typeof slotInfo.price === 'number' && isFinite(slotInfo.price))) {
			return refuse('no_price', o.target + '.' + o.slot + ' has no readable price');
		}
		if (slotInfo.price > cap) {
			return refuse('over_cap', slotInfo.name + ' costs ' + slotInfo.price
				+ ', over the ' + cap + ' probe cap. Pick something cheaper.');
		}
	}

	const args = unchecked ? o.args : [ent || o.target, o.slot].concat(o.extra || []);
	// pDist, not the game's distance(): the latter reported 208 where the true
	// gap was 1307, so every distance this probe recorded before now is suspect.
	const entAt = pWhere(ent), meAt = pWhere(character);
	const before = {
		gold: character.gold,
		esize: character.esize,
		sameMap: ent ? (entAt.map === meAt.map) : null,
		dist: (ent && entAt.map === meAt.map) ? Math.round(pDist(meAt.x, meAt.y, entAt.x, entAt.y)) : null,
		slot: slotInfo ? { name: slotInfo.name, level: slotInfo.level, price: slotInfo.price, q: slotInfo.q, b: slotInfo.b } : null,
	};
	pLog('CALL ' + o.fn + ' at ' + before.dist + ' units, gold=' + before.gold
		+ (before.slot ? ', slot=' + before.slot.name + ' @ ' + before.slot.price : ''), '#FFD700');

	const rec = { fn: o.fn, target: o.target || null, slot: o.slot || null, before: before };
	try {
		rec.returned = await fn.apply(null, args);
		rec.outcome = 'resolved';
	} catch (e) {
		rec.outcome = 'rejected';
		rec.reason = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
	}

	// Settle: the gold change lands on a socket round trip, not on the promise.
	await sleep(1200);
	rec.after = { gold: character.gold, esize: character.esize };
	rec.goldDelta = rec.after.gold - before.gold;
	rec.esizeDelta = rec.after.esize - before.esize;

	// The whole reason for the cheap trade. For a buy, anything paid beyond the
	// listed price is tax (or a fee by another name); for a sell, anything
	// short of it is.
	//
	// Only on a resolved call that moved gold. A rejection moves nothing, and
	// deriving a "fee" from a zero delta produces a confident -100% that reads
	// exactly like a measurement and is not one.
	rec.qty = (o.extra && typeof o.extra[0] === 'number') ? o.extra[0] : 1;
	if (before.slot && typeof before.slot.price === 'number') {
		rec.unitPrice = before.slot.price;
		rec.expectedGross = before.slot.price * rec.qty;   // listed price is PER UNIT
	}
	if (rec.outcome === 'resolved' && rec.goldDelta !== 0 && rec.expectedGross != null) {
		rec.impliedFee = (o.leg === 'sell')
			? rec.expectedGross - rec.goldDelta
			: (-rec.goldDelta) - rec.expectedGross;
		rec.impliedFeePct = rec.expectedGross
			? +(100 * rec.impliedFee / rec.expectedGross).toFixed(4) : null;
	}
	// Recorded on every row because the tax is said to scale with merchant
	// level: a rate measured at one level is a data point, not a constant.
	rec.characterLevel = character.level;

	pLog(rec.outcome.toUpperCase() + (rec.reason ? ' (' + rec.reason + ')' : '')
		+ ' - gold ' + (rec.goldDelta >= 0 ? '+' : '') + rec.goldDelta
		+ ', slots ' + (rec.esizeDelta >= 0 ? '+' : '') + rec.esizeDelta
		+ (rec.impliedFee != null ? ', implied fee ' + rec.impliedFee + ' (' + rec.impliedFeePct + '%)' : ''),
		rec.outcome === 'resolved' ? '#7FD98A' : 'orange');

	PROBE.log.push({ at: new Date().toISOString(), msg: 'TRADE RECORD', record: rec });
	try { set('probe_log', PROBE.log.slice(-200)); } catch (e) { }
	return pShow(rec);
}

/* Does calculate_item_value actually predict what a vendor pays?

   Not a tax measurement - NPC sales are untaxed, which is settled. This exists
   because Phase 1 has to CHOOSE a sell side: a player buy order is only worth
   taking once it clears the vendor's price by more than the tax, so
   calculate_item_value sits directly in the go/no-go comparison. This project
   has already been burned once by trusting that function's output for Ponty
   and being wrong by half, and that time it only misprinted a webpage.

   Cheap to check, and it needs no counterparty - every other measurement here
   waits on a stranger standing in the plaza with the right goods.

   idx is an INVENTORY SLOT NUMBER, not a name. Refuses gear-plan items and
   anything worth more than the probe cap. */
async function arbProbeNpcSell(idx, confirm) {
	if (confirm !== 'YES') {
		pLog('refused: this sells a real item. Pass "YES" as the second argument.', 'orange');
		return null;
	}
	const it = character.items[idx];
	if (!it) { pLog('slot ' + idx + ' is empty', 'orange'); return null; }
	if (isKnownGearItem(it.name)) {
		pLog('refused: ' + it.name + ' is on a gear plan - pick junk', 'orange');
		return null;
	}
	let expected = null;
	try { expected = parent.calculate_item_value(it); } catch (e) { }
	if (expected != null && expected > CONFIG.arbitrage.probe.maxPrice) {
		pLog('refused: ' + it.name + ' is worth ' + expected + ', over the '
			+ CONFIG.arbitrage.probe.maxPrice + ' probe cap', 'orange');
		return null;
	}
	const rec = {
		fn: 'sell', target: 'NPC', item: it.name, level: it.level || 0,
		before: { gold: character.gold, esize: character.esize },
		expectedUnit: expected,
	};
	pLog('CALL sell(' + idx + ', 1) on ' + it.name + ', calculate_item_value says ' + expected, '#FFD700');
	try {
		rec.returned = await sell(idx, 1);
		rec.outcome = 'resolved';
	} catch (e) {
		rec.outcome = 'rejected';
		rec.reason = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
	}
	await sleep(1200);
	rec.after = { gold: character.gold, esize: character.esize };
	rec.goldDelta = rec.after.gold - rec.before.gold;
	if (rec.outcome === 'resolved' && rec.goldDelta !== 0 && expected) {
		// NPC sales are untaxed, so this should be zero. Anything else means
		// calculate_item_value does not predict the payout, and Phase 1's
		// vendor-vs-player comparison is being fed a wrong number.
		rec.predictionError = expected - rec.goldDelta;
		rec.predictionErrorPct = +(100 * rec.predictionError / expected).toFixed(4);
		// Gold is an integer, so a cheap item cannot resolve a small error: on a
		// 3 gold sale anything under ~17% rounds to a perfect zero and reads as
		// proof. Resolution is roughly 100/expected percent, so "EXACT" only
		// means much on something worth four figures.
		rec.resolutionPct = +(100 / expected).toFixed(4);
		rec.lowResolution = expected < 1000;
	}
	rec.characterLevel = character.level;
	pLog(rec.outcome.toUpperCase() + (rec.reason ? ' (' + rec.reason + ')' : '')
		+ ' - gold +' + rec.goldDelta + ', predicted ' + expected
		+ (rec.predictionError != null
			? (rec.predictionError === 0
				? ', EXACT' + (rec.lowResolution
					? ' but only to +-' + rec.resolutionPct + '% - too cheap to prove much, repeat on something worth 1000+'
					: '')
				: ', OFF BY ' + rec.predictionError + ' (' + rec.predictionErrorPct + '%)')
			: ''),
		rec.outcome === 'resolved' ? '#7FD98A' : 'orange');
	PROBE.log.push({ at: new Date().toISOString(), msg: 'NPC SELL RECORD', record: rec });
	try { set('probe_log', PROBE.log.slice(-200)); } catch (e) { }
	return pShow(rec);
}

/* Everything observed this session, including across a reload. */
function arbProbeDump() {
	let stored = [];
	try { stored = get('probe_log') || []; } catch (e) { }
	pLog(stored.length + ' stored entries (in-memory: ' + PROBE.log.length + ')');
	return pShow(stored);
}

function arbProbeClear() {
	const n = PROBE.log.length;
	// Announce first, then wipe. pLog writes back to storage, so clearing and
	// then logging left exactly one entry behind and the log was never empty.
	pLog('clearing ' + n + ' probe entries');
	PROBE.log = [];
	try { set('probe_log', []); } catch (e) { }
	return n;
}

function arbProbeHelp() {
	const lines = [
		'arbProbeBuild()            which build is running - feature-detected',
		'arbProbeHold(true|false)   freeze/unfreeze the merchant for a probe',
		'arbProbeFns()              scan both scopes for trade/bank functions',
		'arbProbeNamed()            direct check of the names we expect',
		'arbProbeSrc("trade_buy")   dump a function\'s source (the socket payload)',
		'arbProbeSource("aldata")   pin the market feed: aldata | bridge | auto',
		'arbProbeBridge()           which feed answers, and how much is in it',
		'arbProbeFindBuy(10000)     BUY candidates from every shard the scouts saw',
		'arbProbeFindFlips()        THE MONEY QUERY: profitable buy->sell pairs now',
		'arbProbeFindPonty(99999)   Ponty stock across shards - bridge only, not public',
		'arbProbeFindSell()         who is buying something already in inventory',
		'arbProbeWhyNoSell()        when that is empty: held vs wanted, near misses',
		'arbProbeGo("EUII")         travel to a candidate\'s shard (reloads the page)',
		'arbProbeStands()           stands in view here, with distances',
		'arbProbePick(10000)        cheapest sell slot in view here',
		'arbProbeBuyOrders()        buy orders in view here, highest first',
		'arbProbeInv()              esize vs counted free slots, stacks, gold',
		'arbProbeBank()             timed bank round trip, reads only',
		'arbProbeRange("Name")      is it loaded, and how far? read-only',
		'arbProbeDistanceCheck("N") does the game distance() agree with arithmetic?',
		'arbProbeStep("Name", 400)  walk to 400 units away - REPORTS IF IT DID NOT',
		'arbProbeCall({...})        player trade - see the source before using',
		'arbProbeNpcSell(idx,"YES") does calculate_item_value predict the payout?',
		'arbProbeDump()             everything recorded, survives a reload',
		'arbProbeClear()            wipe the record',
	];
	for (const l of lines) { try { console.log('[probe] ' + l); } catch (e) { } }
	pLog('help printed to console (' + lines.length + ' commands)');
	return lines;
}

/* Reachable from the code console and from other scripts on this tab. The
   functions are also in the runner scope, but only if the console evaluates
   there, which is not worth depending on. */
try {
	parent.PROBE_API = {
		build: arbProbeBuild,
		hold: arbProbeHold, fns: arbProbeFns, named: arbProbeNamed, src: arbProbeSrc,
		stands: arbProbeStands, pick: arbProbePick, buyOrders: arbProbeBuyOrders,
		findBuy: arbProbeFindBuy, findSell: arbProbeFindSell, go: arbProbeGo,
		bridge: arbProbeBridge, whyNoSell: arbProbeWhyNoSell, source: arbProbeSource,
		findPonty: arbProbeFindPonty, findFlips: arbProbeFindFlips,
		inv: arbProbeInv, bank: arbProbeBank, step: arbProbeStep, call: arbProbeCall,
		range: arbProbeRange, distanceCheck: arbProbeDistanceCheck,
		npcSell: arbProbeNpcSell,
		dump: arbProbeDump, clear: arbProbeClear, help: arbProbeHelp, state: PROBE,
	};
} catch (e) { }

// ============================================================================
// STARTUP
// ============================================================================
/* If a change_server restarted the script mid-trip, put the unfinished jobs
   back and, with nothing left to do, go home. Without this the merchant sits
   on whichever shard it last hopped to, with no memory of why it went. */
async function resumeInterruptedTrip() {
	const trip = mLoadTrip();
	if (!trip) return;
	const pending = trip.pending || [];
	for (const j of pending) enqueueJob(j);
	if (pending.length) {
		game_log(`Resuming ${pending.length} job(s) interrupted by a server change`, '#FFD700');
	}
	const home = mHomeShard();
	if (!state.queue.length && mShardKey() !== home) {
		game_log(`Nothing left to do here - returning to ${home}`, '#FFD700');
		mClearTrip();
		await mHopTo(home);
		return;
	}
	mClearTrip();
}

resumeInterruptedTrip();
/* Pick up where the pre-hop script left off: a reload wiped every in-memory
   field, but the findings, rotation position and Ponty timers were written to
   storage before the hop. */
scoutRestoreBuffer();
scout.rotIdx = scoutLoad('rot', 0);
scout.pontySeen = scoutLoad('ponty_seen', {}) || {};
// Guarded inside openStandAtBestSpot: a reload on a remote shard is mid-
// rotation, and no stand goes up there.
openStandAtBestSpot();
scoutLoop();
gearProgressionLoop();
maintenanceLoop();
/* Phase 0 only announces itself. Nothing in the probe section runs unless the
   operator calls it by hand - see Codex/PHASE0_PROBE.md. */
try {
	PROBE.log = get('probe_log') || [];
	// A hop to a candidate's shard reloads the page. Without restoring the hold
	// the scout would resume rotating on the next tick and carry the merchant
	// straight back off the shard the operator just travelled to.
	PROBE.hold = !!get('probe_hold');
	game_log('[probe] ' + MERCHANT_BUILD + ' loaded (' + PROBE.log.length + ' stored entries'
		+ (PROBE.hold ? ', HOLD STILL ON' : '') + ') - arbProbeHelp() for commands',
		PROBE.hold ? '#FFD700' : '#8b98ab');
} catch (e) { }
