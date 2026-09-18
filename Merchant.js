// ============================================================================
// Meltymerch (Merchant) - Mainframe slot CH_aLtHealaSgKdmOsDWpNl8scE9NhXk - v24 (GEAR_PROGRESSION tier-1 goals commented out for ranger/priest/mage per request - the evaluator now has nothing to act on at tier 1 for any class; tier 2/3 goals unaffected)
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
async function openStandAtBestSpot() {
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
		sellTrash();
		sellAggressivelyIfLowOnSpace();
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
		if (CONFIG.gearProgression.enabled && !state.busy) {
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

			if (name && state.kissAttemptedFor !== name) {
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
openStandAtBestSpot();
gearProgressionLoop();
maintenanceLoop();
