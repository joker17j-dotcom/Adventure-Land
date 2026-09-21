// ============================================================================
// Meltymerch (Merchant) - slot CH_aLtHealaSgKdmOsDWpNl8scE9NhXk - v39
//
// CHANGELOG: read CHANGELOG.md in this repo. Do not put version history back
// in this file, and do not reconstruct it from git log - CHANGELOG.md is the
// record. Prepend new entries there, newest first, and never rewrite an old
// one. Bump the version on the line above in the same commit.
//
// Adventure Land will not run a CODE slot past roughly 240 KiB (245,760
// chars). save_code ACCEPTS an oversized slot and returns success; the runner
// then never evaluates it, leaving a frame where the character object exists and every
// script function is undefined, with nothing in the console. Measured
// 2026-09-21: v37 at 244,398 ran, v38 at 247,463 did not. That is why the
// changelog moved out - it had reached 9,255 chars of the budget. Check the
// file size before deploying, and if a deploy comes up with the functions
// missing and the console clean, suspect the cap before anything else.
//
// NEVER put a backtick in a comment in this file. It does not throw, it does
// not log, it silently stops the whole slot loading - the same empty-frame
// signature as the size cap. Proven 2026-09-21 by bisect: two identical
// 239,029-char builds, one with a backtick pair around a word in the comment
// above and one with quotes instead. The quoted one loads, the other does
// not. Backticks in real template literals are fine - there are ~196 in this
// file. Use quotes when naming an identifier in prose.
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
	// Precautionary, same reasoning as scoutFetch: /msg?to=X&since=N repeats its
	// URL exactly whenever the cursor plateaus, which is most of the time.
	const o = Object.assign({ cache: 'no-store' }, opts || {});
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
		/* OFF, deliberately and temporarily.
		
		   Turned off by the operator while the live arbitrage run is being
		   watched: it keeps the merchant off the scan beat, off the bridge and
		   out of scoutGoHome, so the only thing moving the character is the
		   trade executor and anything it does is attributable.
		
		   ARBITRAGE IS UNAFFECTED. It reads the market from the bridge and
		   ALData, both of which other scouts fill - nothing in the flip finder
		   needs THIS character to have scanned. Turning scouting off does not
		   turn trading off; CONFIG.arbitrage.enabled is the switch for that.
		
		   Set back to true to resume. Everything below stays configured. */
		enabled: false,
		/* PARKED - hold the party's home shard and never hop just to scout.
		
		   The family's MerchantScout fleet now covers the rotation, so the
		   merchant's shard-hopping was duplicating work it is much worse at: a
		   hop reloads the page, and every hop risks stranding deliveries, the
		   stand and an in-flight trade behind a page load. A dedicated scout
		   pays that cost for nothing else; the merchant pays it with the party's
		   economy on its back.
		
		   Parked, it holds CONFIG.homeServer, rescans it every townScanMs, and
		   still scans wherever else the script legitimately takes it - arbitrage,
		   deliveries - it just never travels FOR a scan. Set false to restore
		   the old roaming rotation. */
		parked: true,
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
		/* DEAD as of v34 - nothing reads it. The in-town beat is townScanMs
		   below, and it is 20s rather than this 30s. Kept for one version only
		   so a diff against v33 is readable; delete it next time this file is
		   touched. */
		heldScanMs: 30000,
		/* The standing beat while in town, matching FamilyFleet. Once we are
		   here the walk is already paid for and a scan costs a synchronous
		   read of parent.entities plus a post. */
		townScanMs: 20 * 1000,
		/* Where the stands are, as a box in world coordinates.
		
		   This is what the scan gate tests, and it is a stronger test than the
		   one it replaces. "Within 60 of the first stand candidate" asked
		   whether we were standing on one particular point; this asks whether
		   the whole selling area is inside the vision box, which is the thing
		   that actually decides whether a reading is complete.
		
		   It matters because an empty scan REPLACES a shard's listings on the
		   bridge rather than merging into them. A read taken from somewhere
		   that cannot see the stands reports "nothing trading here" as fact,
		   and wipes a full market.
		
		   Numbers are FamilyFleet's: the observed cluster padded by about 100
		   each way. One sample put six stands inside x -147..161, y -110..92.
		   A snapshot rather than a stable distribution, so the padding is doing
		   real work and this is a knob, not a constant. */
		standRegion: { minX: -250, maxX: 260, minY: -210, maxY: 190 },
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
		// Source is the only switch. There is deliberately no runtime toggle:
		// one persisted in CODE storage would outlive a redeploy, so a build
		// pushed with this false could still be trading, which is the opposite
		// of what a kill switch is for. arbProbeBuild() reports the live value.
		enabled: true,
		// Belt and braces. Turning `enabled` on alone cannot spend gold: the
		// executor still runs every step - find, verify, approach, hop, ledger,
		// bank - but the two calls that move money are simulated from the
		// listed prices instead of made. Everything this code has been tested
		// against so far is a stub, and the live game has already contradicted
		// three confident readings, so the first run on the real market should
		// not be the first run that can lose something.
		//
		// Dry-run events reach the ledger marked dryRun, so the whole recording
		// path is exercised too - a rehearsal that skipped it would not be
		// testing the thing most likely to be wrong. The bridge keeps them out
		// of realised P/L.
		//
		// NOW FALSE - the rehearsal is over and the operator has taken this
		// live, having watched a run and confirmed it working. As of the
		// handover: 8 closed live trades, 60,469,850 spent, 21,063,085 net.
		//
		// This MUST live in source rather than be set at runtime. mHopTo()
		// calls change_server, which reloads the page, and hopping to the buy
		// shard is the first step of nearly every trade - so a value set from
		// the console is gone before the buy leg runs, and the trade finishes
		// simulated after starting live.
		dryRun: false,
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
		/* A listing older than this is treated as gone rather than as an offer.
		   Gates BOTH legs in arbProbeFindFlips, despite the name.

		   Tightened from 15 minutes to 7. The old value matched the watchlist's
		   SPREAD_MAX_AGE_MS, which is the right window for something you are
		   looking at - a stale row is still worth showing. It is the wrong window
		   for something you travel to and spend gold on.

		   7 minutes is roughly three sweeps at the measured rate: Merchant.js's
		   scout swept 11 shards in about 2.4 minutes, so a row from our own
		   bridge is at most a sweep old when posted and this leaves margin for
		   two more before it is disbelieved. At 15 minutes a buy order could be
		   six sweeps stale and still be picked, and the case that costs real gold
		   - a fresh seller paired with a dead buyer - is exactly the one a wide
		   window lets through.

		   CAVEAT worth knowing before tightening further: the primary source is
		   ALData, not our bridge, and ALData's own refresh cadence has never been
		   measured. If its rows are typically older than this, the filter starts
		   rejecting the market rather than the stale part of it. The flip finder
		   now reports how many listings it dropped as stale and how fresh the
		   freshest rejected one was, so that shows up as a number rather than as
		   an unexplained absence of opportunities. */
		sellMaxAgeSec: 7 * 60,
		// How close to get to a stand before trading. Not a measured limit - a
		// deliberately conservative choice below two readings that disagree.
		//
		//   566-619  a controlled walk-out from a stationary stand: loaded and
		//            fully readable at 450, 500 and 566, gone at 619 and 681.
		//   699+     an earlier incidental observation of a stand still visible,
		//            and "still climbing" - see the scan-spot comments, which
		//            rely on it.
		//
		// They are not reconciled. Visibility may differ by map or by client
		// state, the first was controlled but done once against one target on
		// one map, and the second was incidental. Picking whichever is more
		// convenient is how this project produced a confident 1,307-unit trade
		// range that turned out to be an artefact.
		//
		// 350 sits comfortably inside both, and above the 208 units at which a
		// trade is known to have worked, so it costs nothing to be wrong about
		// either figure. Raise it once the disagreement is settled.
		approachUnits: 350,
		// A listing this merchant has just traded against is suppressed for this
		// long. Measured need: the rehearsal re-picked the same route seventeen
		// times because nothing consumes stock in a rehearsal - but live, the
		// public feed still lists a stand we have just emptied, and worse, a buy
		// order we have just filled.
		//
		// The two sides are not symmetric. A stale BUY listing costs nothing:
		// verification fires before any gold moves and the trade is abandoned
		// with nothing spent, which is exactly what the rehearsal showed nine
		// times. A stale SELL listing is only discovered after the purchase, on
		// another shard, and turns gold into an item nobody will buy. Without
		// this, the executor would re-fill an order it had just exhausted,
		// bank the goods, and go round again.
		usedCooldownMs: 20 * 60 * 1000,
		// Consecutive trades that ended with an item banked rather than sold.
		// Past this the executor stops itself: each one has converted liquid
		// gold into stock, and a run of them means the market being traded
		// against is not the market on the board. Cleared by any completed sale.
		maxConsecutiveStrandings: 2,
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
		// How often the executor ticks, and how often it re-asks the market when
		// idle. Looking is a network round trip against ALData, so it is paced
		// well below the tick.
		tickMs: 4000,
		lookEveryMs: 30000,
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

	/* THE TOWN SPOT - one position that reaches five NPCs.

	   Measured and tested live against game data 17083, not derived and not
	   guessed. It is the centre of the smallest circle enclosing Lucas, Cue,
	   Gabriel and Ponty, radius 286.05; Lucas and Ponty are 572.1 apart and
	   form the diameter, so no point in town beats 286 on the worst case.

	   Distances from it, all computed from the NPCs' own map positions:

	     Gabriel  (basics, selling)     129.4   verified: buy
	     Cue      (upgrade, compound)   150.6   verified: upgrade rolled
	     Ernis    (potions)             169.8
	     Lucas    (scrolls, cscrolls)   286.0   verified: buy
	     Ponty    (secondhands)         286.1   verified: replied, 225 items

	   Ernis was not in the original four and turns out to sit well inside the
	   circle, so adding him does not move the optimum - the worst case goes
	   from 286.05 to 286.09, which is the same two NPCs binding it.

	   WHAT IS STILL A JOURNEY, and deliberately: Garwyn (offerings) is 616
	   away and Crun (scroll3/cscroll3) is on `level2`. The upgrade planner can
	   still choose those and will still travel for them.

	   IF THE NPC SET CHANGES, recompute the smallest enclosing circle rather
	   than nudging this point - the binding pair may change. */
	townSpot: { name: 'town spot', map: 'main', x: -179, y: -72, radius: 60 },

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
	kissSkippedFor: null,   // ...and the one we declined while hop sick, so that logs once rather than every tick
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

/* Where we are, in WORLD coordinates.

   real_x/real_y where the client offers them, x/y otherwise. The top window
   reports .x/.y in screen space - measured (1147, 416) while the character
   stood at (-123, -52) - and NPC entities have .x === .real_x, so the
   discrepancy is invisible until something cross-checks the two. It cost this
   project a phantom 1,307-unit trade range once. */
function mPos() {
	const c = character || {};
	return {
		map: c.map,
		x: c.real_x != null ? c.real_x : c.x,
		y: c.real_y != null ? c.real_y : c.y,
	};
}

/* VISION IS A BOX, NOT A RADIUS. character.vision is [700, 500], and the test
   the game applies is |dx| <= 700 && |dy| <= 500. */
function mInVision(x, y) {
	const me = mPos();
	const v = (character && character.vision) || [700, 500];
	return Math.abs(x - me.x) <= v[0] && Math.abs(y - me.y) <= v[1];
}

/* Can we see the whole selling area from here?

   All four corners, not the centre: a box is only fully visible when its
   furthest corner is, and a centre test passes from places where half the
   stands are off screen. This is the gate on every scan, because a scan that
   cannot see the stands reports an empty market as fact. */
function mInTown() {
	const me = mPos();
	if (me.map !== CONFIG.stand.map) return false;
	const r = CONFIG.scout.standRegion;
	return mInVision(r.minX, r.minY) && mInVision(r.maxX, r.maxY)
		&& mInVision(r.minX, r.maxY) && mInVision(r.maxX, r.minY);
}

/* Standing where all five NPCs are in reach? A plain radius is the right test
   here: the question is "am I there", not "can I see something". */
function atTownSpot() {
	const t = CONFIG.townSpot;
	return character.map === t.map && distance(character, t) <= t.radius;
}

/* Go there, once. Returns early when we have already arrived, which is what
   makes it safe to call before every NPC interaction rather than reasoning
   about who walked where last. */
async function goToTownSpot() {
	if (atTownSpot()) return true;
	return await travelTo(CONFIG.townSpot.map, CONFIG.townSpot.x, CONFIG.townSpot.y);
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
	/* To the town spot rather than to Ernis himself.

	   He is 169.8 from it, comfortably inside the 300 this function already
	   accepted as close enough - so nothing about the purchase changes, but
	   the merchant ends up somewhere it can also buy scrolls, upgrade, sell
	   and read Ponty without moving again. Standing on Ernis can do only the
	   one thing. */
	if (!atTownSpot() && distance(character, CONFIG.npc) > 300) {
		if (!(await goToTownSpot())) return false;
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
	// A trade in flight may well be running on the home shard - that is the
	// commonest buy shard. Opening the stand there would still be wrong: the
	// stand has to be closed again before travelling, and the trade is about to
	// travel.
	if (ARB.cur) return false;
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
/* Selling needs Gabriel in range - 129.4 from the town spot, and both buy and
   sell are confirmed working at that distance. So this is another thing the
   merchant does without moving, PROVIDED it is standing there; called from
   anywhere else it is the caller's business to have got in range, which is
   unchanged from before. */
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
/* Vendors the town spot reaches. Lucas carries every scroll the planner can
   normally pick; Crun and Garwyn are the exceptions that still need a trip. */
const SPOT_VENDORS = new Set(['scroll0', 'scroll1', 'scroll2',
	'cscroll0', 'cscroll1', 'cscroll2']);

/* Walk to ONE place and buy everything from there.

   Each material used to get its own travelTo, so a step needing a scroll and
   an offering made two journeys and the upgrade itself then happened wherever
   the last one left the character standing. For a plain scroll that was
   Lucas, from whom Cue is 285.4 away - right at the edge of range, and the
   reason the upgrade worked at all. From the town spot Cue is 150.6, and the
   scroll, the roll and the selling afterwards all happen without another
   step. */
async function ensureUpgradeMaterials(scrollName, offeringName) {
	const needs = [];
	if (quantity(scrollName) < 1) needs.push(scrollName);
	if (offeringName !== 'none' && quantity(offeringName) < 1) needs.push(offeringName);
	if (!needs.length) return;

	// One walk covers every material the spot can reach.
	if (needs.some((n) => SPOT_VENDORS.has(n))) {
		if (!(await goToTownSpot())) {
			throw new Error(`Could not reach the town spot for ${needs.join(', ')}`);
		}
		for (const n of needs.filter((x) => SPOT_VENDORS.has(x))) await buy(n, 1);
	}

	// Anything else keeps its own journey - Garwyn at (192, -564) and Crun on
	// level2 are not in reach of anywhere in Mainland's NPC cluster.
	for (const n of needs.filter((x) => !SPOT_VENDORS.has(x))) {
		const vendor = MATERIAL_VENDORS[n];
		if (!vendor) throw new Error(`No known vendor sells ${n} - cannot buy it.`);
		const arrived = await travelTo(vendor.map, vendor.x, vendor.y);
		if (!arrived) throw new Error(`Could not reach ${vendor.name} at ${vendor.map} (${vendor.x}, ${vendor.y}) for ${n}`);
		await buy(n, 1);
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

				/* One walk, then everything. The bank pass above is its own
				   map and has to be its own trip, but from here on the scroll,
				   the compound and the upgrade are all reachable from a single
				   position - so go there once rather than letting each step
				   walk itself somewhere and leave the next one to find its own
				   way back. goToTownSpot returns early if we are already
				   standing there, which after a bank return we are not. */
				if (hasDuplicateGroup || hasPlanCandidate) await goToTownSpot();

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
/* Are we carrying hop sickness right now?

   Worth a named helper rather than an inline check, because the condition is
   easy to reason about wrongly. The live rule (node/server_functions.js
   declares serverhop_logic twice; the SECOND declaration wins and the first,
   with its hop counting and tapering tiers, is dead code) is:

     arriving anywhere that is not player.p.home, at level >= 60, off PVP
     -> the flat condition from G: luck -80, gold -80, xp -80, output -20,
        for 12 minutes of online play

   Returning to p.home clears it immediately, because the same function deletes
   the condition before deciding whether to re-add it. Below level 60 it is
   never applied at all, which is why this reads the live flag rather than
   trying to predict it - the level gate, the home shard and the clock are all
   the server's business, and character.s is where it reports the answer. */
function hopSick() {
	try { return !!(character.s && character.s.hopsickness); } catch (e) { return false; }
}

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
		// A probe hold suppresses this outright. The kiss walks the merchant
		// across town at its own cadence, on a loop of its own that the scout
		// hold never touched - so a measurement could be halfway through a
		// positioning step when the round pulled the character away, and the
		// numbers would look like a game behaviour rather than an interruption.
		//
		// Tied to the hold rather than a separate switch: the hold already
		// means "a probe is running", it survives a reload, and kissing resumes
		// by itself when the hold comes off, so there is no flag left stranded.
		// CONFIG.anniversaryKiss.enabled remains the permanent off switch.
		if (PROBE.hold) {
			if (!PROBE.kissNoted) {
				PROBE.kissNoted = true;
				pLog('anniversary kissing suppressed while the hold is on', '#FFD700');
			}
		} else if (ARB.cur) {
			// Same reason as the scout loop: a kiss walks the merchant across
			// town, and a trade in flight has gold committed to a destination.
		} else if (CONFIG.anniversaryKiss.enabled && !state.busy && isInTown()) {
			PROBE.kissNoted = false;
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
			} else if (name && hopSick()) {
				// Hop sickness blocks kiss rewards outright - G's own explanation
				// for the condition says so, and it is not in the modifier list, so
				// nothing about luck/gold/xp/output hints at it. Walking the round
				// while sick spends the trip, closes the stand and collects nothing.
				// Sit it out and say why, once per featured player.
				if (state.kissSkippedFor !== name) {
					state.kissSkippedFor = name;
					game_log(`Anniversary: skipping ${name} - hop sick, the reward would be blocked`, 'orange');
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

// NOT called here. It now reads PROBE.hold, and PROBE is a const declared in
// the probe section further down this file - referencing it at this point in
// top-to-bottom load throws "Cannot access before initialization" on the very
// first tick. Started from STARTUP instead, like maintenanceLoop and
// gearProgressionLoop, once every section has run.

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
	// The bridge half of the same market-row path arbFetchJson describes, and
	// the same exposure. An explicit opts.cache still wins.
	const o = Object.assign({ cache: 'no-store' }, opts || {});
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
/* Stands buffered for THIS shard only.

   scoutSettleScan used scoutBufferedCount(), which is every shard still being
   carried. With an unsent backlog that is non-zero before the new shard has
   been looked at even once, so the two-passes-agree test passed on the second
   pass and the sweep "settled" without observing anything. Settling exists to
   give a freshly landed client time to stream its entity list in, and a count
   that includes four other shards cannot measure that. */
function scoutCurrentShardCount() {
	const e = scout.shards.get(mShardKey());
	return e ? e.stands.size : 0;
}

/* Drop this shard's stands before a sweep starts.

   Accumulate WITHIN a sweep - the passes are there so a streaming entity list
   can finish arriving - but REPLACE between visits. Without this a returning
   roamer merged the new view into the old, so a stand that closed between
   visits was never removed and went on being reported as live every time the
   roamer came back. The bridge stores what it is sent; it cannot know a row is
   a ghost. */
function scoutResetCurrentShardStands() {
	const e = scout.shards.get(mShardKey());
	if (e) e.stands.clear();
}

async function scoutSettleScan() {
	scoutResetCurrentShardStands();
	let seen = -1;
	for (let pass = 0; pass < CONFIG.scout.maxSettlePasses; pass++) {
		const bucket = scoutBufferFor(scoutHere());
		for (const row of scoutScanStands()) bucket.stands.set(row.id, row);
		const n = scoutCurrentShardCount();
		// Two passes agreeing means the list has settled - EXCEPT at zero, where
		// "nothing yet" and "nothing here" look identical. Reading an empty
		// entity list twice in 1.5s said a shard was empty and reported it as
		// fact. Zero only counts once every pass has been spent.
		if (n > 0 && n === seen) break;
		seen = n;
		await new Promise((r) => setTimeout(r, CONFIG.scout.settleMs));
	}
	if (scoutCurrentShardCount() === 0) {
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
	/* Do not walk to him from the town spot. He is 286.1 away from it and has
	   answered a live query at exactly that distance with 225 items, so the
	   walk buys nothing and costs the position everything else is reachable
	   from. The walk is kept for anywhere else, because anywhere else means
	   the merchant is mid-errand rather than parked. */
	if (!atTownSpot()) {
		await ensureStandClosed();   // same bypass as arbApproach
		try { await smart_move({ map: 'main', x: npc.position[0], y: npc.position[1] }); }
		catch (e) { return; }
	}
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
	// Clamped: `since` comes back negative if the wall clock moves backwards
	// under an NTP correction, and an unclamped wait is then a number
	// setTimeout cannot hold. Never wait longer than the gap itself.
	const wait = Math.min(CONFIG.scout.minPostGapMs, CONFIG.scout.minPostGapMs - since);
	await new Promise((r) => setTimeout(r, wait));
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
					character: character.name,
					/* Parked, and PINNED - two separate claims.
					
					   role tells the bridge to count this shard as covered so roamers
					   leave it out of their beats. Claiming 'roamer' while never
					   hopping would be worse than saying nothing: the bridge deals the
					   unparked shards between self-declared roamers, so a roamer that
					   never moves silently shrinks every real roamer's beat and its own
					   share goes unwalked.
					
					   pinned says the assignment is not the bridge's to make. Parked
					   scouts are normally reassigned greedily by score, and a merchant
					   that accepted one would advertise coverage of a shard it is not
					   standing on - which is worse than no claim, because roamers would
					   then skip a shard nobody is watching. */
					role: CONFIG.scout.parked ? 'parked' : 'roamer',
					pinned: CONFIG.scout.parked || undefined,
					shard,
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
			scoutLog(`${key}: not acknowledged`, 'orange');
		}
	}
	return { reply: lastReply, confirmed: allOk, count: sent };
}

/* Resend until acknowledged. Bounded: with the bridge down the findings are
   already back in the buffer and go out when it returns, so blocking the
   rotation forever would cost coverage and save nothing. */
/* Everything still unsent, dropped, with a count of what went.

   THE BUFFER IS NOT WORTH CARRYING ACROSS AN OUTAGE, and this is measured
   rather than assumed. The MerchantScout sweep with the bridge down took
   1338s against 241s with it up, and the per-hop cost CLIMBED by about 14s
   each time: every failed post leaves another bucket, every bucket costs the
   7s minimum post gap, and the report runs twice per hop. The character gets
   slower the longer the outage lasts, which is the opposite of degrading
   gracefully.

   And the data it is paying for is worthless by the time it lands. A stand
   list held through a ten-minute outage describes a market that has moved on;
   re-posting it would overwrite a shard with observations older than the ones
   already there. Better to go quiet and start fresh when the bridge returns.

   The immediate retries above are a different thing and are kept: those
   re-send data that is seconds old, to a bridge that answered. This only
   discards once that has been spent. */
function scoutDropBuffer(why) {
	let rows = 0;
	for (const e of scout.shards.values()) rows += e.stands.size;
	scout.shards.clear();
	scoutSave('buffer', []);
	if (rows) scoutLog(`dropped ${rows} unsent stand(s) - ${why}`, 'orange');
	return rows;
}

async function scoutReportConfirmed() {
	for (let i = 0; i < CONFIG.scout.postConfirmRetries; i++) {
		const r = await scoutReport();
		if (r.confirmed) return r;
		if (!r.reply) {
			scoutDropBuffer('bridge unreachable, and a held scan is stale by the time it lands');
			return r;
		}
	}
	scoutDropBuffer('not acknowledged after every retry');
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

	// A beat of this roamer's own, dealt by the bridge so two roamers never
	// walk the same shard. Preferred over `rotation`, which every roamer
	// receives identically and which therefore sent them all to the same head.
	// Falls through when the bridge is older, or when there are more roamers
	// than free shards and someone's beat is empty - overlap is unavoidable
	// then, and standing still is worse.
	const beat = (reply && Array.isArray(reply.beat)) ? reply.beat : [];
	if (beat.length) {
		const mine = beat.filter((k) => k !== here && all.includes(k));
		if (mine.length) return mine[0];
		if (beat.length === 1 && beat[0] === here) return null;
	}

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

   Entity visibility is a radius. Two readings of it disagree - a stand was once
   seen at 699+ units and still climbing, while a controlled walk-out later put
   the unload boundary between 566 and 619 - and neither has been reconciled.
   Drifting between spots is cheap and covers both, so WHERE the scan
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
	/* The gate is now "can I see the whole stand region", not "am I within 60
	   of the first stand candidate". The old test tied scanning to one point;
	   this ties it to whether the reading would be complete, which is the
	   thing that actually matters when an empty scan replaces a shard. */
	if (!mInTown()) return;
	if (Date.now() - (scout.heldScanAt || 0) < CONFIG.scout.townScanMs) return;
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

	/* This shard is already scanned. Roaming would hop to the next one here;
	   parked, there is no next one.

	   Off-home and idle means whatever took us here - a delivery, a finished
	   trade - is done, so go back and hold the party's shard. The scan above
	   has already run by then, so the trip out still contributed a reading;
	   that is the whole of "scouts while doing its normal work", and it is
	   opportunistic by nature. Note it will not fire mid-delivery or mid-trade:
	   both hold state.busy (or ARB.cur) for their duration and scoutLoop stands
	   clear of them deliberately, which is a guarantee worth more than an extra
	   reading.

	   At home, scoutHeldScan re-reads and re-posts on its own cadence, which is
	   what keeps the shard from ageing out of the bridge. `scanned` is a
	   one-shot latch, so without it a parked scout would post once and go
	   quiet. */
	if (CONFIG.scout.parked) {
		const home = mHomeShard();
		if (here !== home) await scoutGoHome(`parked on ${home}`);
		else await scoutHeldScan();
		return;
	}

	const target = scoutNextShard();
	if (!target) return;
	state.busy = true;
	try {
		if (state.standOpen) await ensureStandClosed();
		// Nothing unsent survives a hop by design - see scoutDropBuffer. This
		// only keeps the store in step with a buffer that is already empty.
		scoutSaveBuffer();
		scoutSave('rot', scout.rotIdx);
		scoutSave('ponty_seen', scout.pontySeen);
		await mHopTo(target);         // in a browser tab the script ends here
	} finally { state.busy = false; }
}

async function scoutLoop() {
	try {
		/* Gated on `enabled`, not just spaced out. Without this the probe kept
		   polling /health every reprobeMs with scouting switched off - pointless
		   traffic, and worse, its log line reads "bridge up - scouting enabled"
		   while scouting is in fact disabled, which is the sort of thing that
		   sends someone looking for a bug that is not there. */
		if (CONFIG.scout.enabled
			&& Date.now() - scout.probedAt > CONFIG.scout.reprobeMs) await scoutProbe();

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

		if (ARB.cur) {
			// A trade is in flight. It outranks scouting and the anniversary
			// round, and unlike them it cannot be resumed from wherever it was
			// left: gold has been committed and the item has to reach a
			// terminal state. Stand well clear.
		} else if (!state.busy) {
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
// ARBITRAGE EXECUTION
// ============================================================================
/* Buy on one shard, sell on another, and survive being killed halfway.
 
   THE CONSTRAINT THAT SHAPES EVERYTHING HERE
   change_server reloads the page, which destroys every variable in this
   script. A cross-shard trade contains two of those reloads, and between them
   the merchant is holding an item it has paid for. So the trade lives in CODE
   storage, not in memory, and every phase is written BEFORE the hop that ends
   the script rather than after it. This file has been bitten by that twice
   already - the scout hopped before it scanned, and the probe hold evaporated
   on the reload it was meant to survive - and those only cost data.
 
   ONE STEP PER TICK. A phase does its work, records the outcome, and returns.
   Nothing chains a hop onto anything, because nothing after a hop runs.
 
   PHASES
     picked   a flip chosen, nothing spent   -> travel to the buy shard
     at_buy   on the buy shard               -> verify, then buy
     holding  item bought, gold spent        -> travel to the sell shard
     at_sell  on the sell shard              -> verify, then sell
     sold     gold received                  -> bank the share, then finish
 
   From `holding` onwards the trade is no longer optional. Gold has become an
   item, and the only ways out are selling it or banking it - never simply
   forgetting it, which would leave the ledger reporting an open trade forever
   and the merchant carrying stock nobody decided to keep. */

const ARB = {
	cur: null,          // mirror of the stored trade; storage is authoritative
	buffer: [],         // ledger events the bridge has not acknowledged
	lastLookAt: 0,
	busy: false,
};

const ARB_KEY = 'arb_trade';
const ARB_BUF_KEY = 'arb_ledger_buffer';
const ARB_USED_KEY = 'arb_used';
const ARB_STRAND_KEY = 'arb_strandings';

/* Listings this merchant has already traded against, and when they stop being
   suppressed. Keyed by shard|target|slot so the same merchant's other slots
   stay available - emptying one of a stand's six trade slots says nothing
   about the other five. Persisted, because the cooldown has to outlive the
   page reloads a trade causes. */
function arbUsedKey(shard, target, slot) { return shard + '|' + target + '|' + slot; }

function arbLoadUsed() {
	let m = {};
	try { m = get(ARB_USED_KEY) || {}; } catch (e) { m = {}; }
	const now = Date.now();
	let changed = false;
	for (const k in m) if (!(m[k] > now)) { delete m[k]; changed = true; }
	if (changed) { try { set(ARB_USED_KEY, m); } catch (e) { } }
	return m;
}

function arbMarkUsed(shard, target, slot) {
	if (!target || !slot) return;
	const m = arbLoadUsed();
	m[arbUsedKey(shard, target, slot)] = Date.now() + CONFIG.arbitrage.usedCooldownMs;
	try { set(ARB_USED_KEY, m); } catch (e) { }
}

function arbIsUsed(shard, target, slot, used) {
	const m = used || arbLoadUsed();
	return !!m[arbUsedKey(shard, target, slot)];
}

function arbStrandings(delta) {
	let n = 0;
	try { n = get(ARB_STRAND_KEY) || 0; } catch (e) { n = 0; }
	if (delta === 0) n = 0;
	else if (delta) n += delta;
	if (delta !== undefined) { try { set(ARB_STRAND_KEY, n); } catch (e) { } }
	return n;
}

function arbLog(msg, color) {
	try { game_log('[arb] ' + msg, color || '#9BD1FF'); } catch (e) { }
	try { console.log('[arb] ' + msg); } catch (e) { }
}

function arbLoadTrade() {
	try { const v = get(ARB_KEY); return (v && v.phase) ? v : null; } catch (e) { return null; }
}
function arbSaveTrade(t) {
	ARB.cur = t;
	try { set(ARB_KEY, t); } catch (e) { }
}
function arbClearTrade() {
	ARB.cur = null;
	try { set(ARB_KEY, null); } catch (e) { }
}

/* A ledger event is buffered first and cleared only once the bridge confirms
   it. The bridge dedupes on eventId, so a resend after a lost reply is free -
   which is the whole reason a retry is safe to attempt at all. */
function arbLedger(ev) {
	if (CONFIG.arbitrage.dryRun) ev.dryRun = true;
	ev.eventId = ev.eventId || (ev.id + '-' + ev.event + '-' + Date.now());
	ARB.buffer.push(ev);
	try { set(ARB_BUF_KEY, ARB.buffer.slice(-100)); } catch (e) { }
	return ev;
}

async function arbFlushLedger() {
	if (!ARB.buffer.length) return true;
	const pending = ARB.buffer.slice();
	const kept = [];
	for (const ev of pending) {
		try {
			const r = await scoutFetch('/trade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(ev),
			});
			if (!r || r.ok !== true) kept.push(ev);
		} catch (e) {
			kept.push(ev);
		}
	}
	ARB.buffer = kept;
	try { set(ARB_BUF_KEY, ARB.buffer); } catch (e) { }
	if (kept.length) arbLog(kept.length + ' ledger event(s) still unsent - will retry', 'orange');
	return kept.length === 0;
}

/* May a NEW trade start? Says why not, because "nothing happened" is the
   hardest state to debug. An in-flight trade is not covered here: once gold is
   spent the answer is always yes, keep going. */
function arbCanStart(ctx) {
	const c = CONFIG.arbitrage;
	if (!c.enabled) return { ok: false, reason: 'disabled' };
	if (ctx.probeHold) return { ok: false, reason: 'probe hold' };
	if (ctx.trade) return { ok: false, reason: 'a trade is already in flight' };
	if (ctx.busy) return { ok: false, reason: 'merchant busy' };
	if (arbTaxRate() == null) return { ok: false, reason: 'no tax rate - refusing to price a trade' };
	// A queued job the merchant has sat on for too long takes the next slot.
	// It never interrupts a trade already running; it only stops one starting.
	if (ctx.oldestJobAgeMs != null && ctx.oldestJobAgeMs > c.jobPreemptMs) {
		return { ok: false, reason: 'a queued job has waited ' + Math.round(ctx.oldestJobAgeMs / 60000) + ' min' };
	}
	if (ctx.gold <= c.goldFloor) return { ok: false, reason: 'gold is at or below the floor' };
	return { ok: true };
}

/* The hard reserve is on what is LEFT, not on what is held. Requiring only
   that gold exceeds the floor before buying would let a purchase take it
   straight through. */
function arbAffordable(spend, gold) {
	return (gold - spend) >= CONFIG.arbitrage.goldFloor;
}

/* Turn a findFlips row into the trade record that will be carried across two
   page reloads. Everything the later phases need is copied in now - by the
   time the sell phase runs, the flip list that produced it is long gone. */
function arbPlan(flip, gold) {
	const qty = Math.max(1, flip.qty || 1);
	return {
		id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		phase: 'picked',
		at: Date.now(),
		item: flip.item, level: flip.level || 0, special: flip.special || null,
		qty: qty,
		buyFrom: flip.buyFrom, buyPrice: flip.buyPrice, buyShard: flip.buyShard,
		buySlot: flip.buySlot, buyIsNpc: !!flip.buyIsNpc,
		sellTo: flip.sellTo, sellPrice: flip.sellPrice, sellShard: flip.sellShard,
		sellSlot: flip.sellSlot,
		spend: flip.spend, expectProfit: flip.profit, taxRate: flip.taxRate,
		goldAtStart: gold,
		attempts: 0,
	};
}

/* Half of NET profit, and only of a profit. A loss banks nothing and is not
   carried forward against a later trade's share - each trade is settled on its
   own. Floored so the bank never receives a fraction of a gold. */
function arbBankShare(net) {
	if (!(typeof net === 'number' && isFinite(net)) || net <= 0) return 0;
	return Math.floor(net * CONFIG.arbitrage.bankShare);
}

/* Terminal. Records the outcome, releases the trade, and leaves the ledger
   holding the only lasting account of it. */
function arbFinish(t, event, extra) {
	const ev = Object.assign({ id: t.id, event: event }, extra || {});
	arbLedger(ev);
	arbLog(event === 'closed'
		? 'closed ' + t.item + ' x' + t.qty + ' for ' + (extra && extra.net) + ' net'
		: 'abandoned ' + t.item + ' x' + t.qty + ' (' + (extra && extra.reason) + ')',
		event === 'closed' ? '#7FD98A' : 'orange');
	arbClearTrade();
}

/* Close enough to trade. A stand's trade slots stay fully readable right to the
   edge of visibility - there is no inner radius where you can see a stand but
   not read its prices - so there is nothing to gain from closing the last few
   hundred units. Already inside CONFIG.arbitrage.approachUnits counts as
   arrived, and the commonest case is that no movement is needed at all. */
async function arbApproach(targetName) {
	const want = CONFIG.arbitrage.approachUnits;
	const e = pEntity(targetName);
	if (!e) return { ok: false, reason: 'not_loaded' };
	const t = pWhere(e), me = pWhere(character);
	if (t.map === me.map && pDist(me.x, me.y, t.x, t.y) <= want) return { ok: true, moved: false };
	// Past the in-range return, so this only fires when we are actually going
	// to move. travelTo() is where stand safety normally lives, but the
	// executor does not use it - it smart_moves straight to a counterparty,
	// which is how a stand stayed open across a walk and a shard hop. Seen
	// live 2026-09-21: stand0 open, state.standOpen true, moving true, with a
	// trade picked for another shard.
	await ensureStandClosed();
	try {
		await smart_move({ map: t.map, x: t.x, y: t.y });
	} catch (err) {
		return { ok: false, reason: 'smart_move: ' + (err && (err.reason || err.message) ? (err.reason || err.message) : String(err)) };
	}
	const now = pWhere(character);
	const e2 = pEntity(targetName);
	if (!e2) return { ok: false, reason: 'unloaded_on_arrival' };
	const t2 = pWhere(e2);
	const d = (t2.map === now.map) ? pDist(now.x, now.y, t2.x, t2.y) : null;
	return (d != null && d <= want) ? { ok: true, moved: true, distance: Math.round(d) }
		: { ok: false, reason: 'still ' + (d == null ? 'off-map' : Math.round(d) + ' units') + ' away' };
}

/* Is this listing still what the flip said it was? A price that has moved is
   not a smaller opportunity, it is a different trade nobody has evaluated. */
function arbStillThere(t, side) {
	const v = arbProbeVerify(side === 'buy'
		? { target: t.buyFrom, slot: t.buySlot, name: t.item, level: t.level, price: t.buyPrice, b: false }
		: { target: t.sellTo, slot: t.sellSlot, name: t.item, level: t.level, price: t.sellPrice, b: true });
	return v;
}

/* Gold actually moved, measured rather than assumed. The listed price is what
   was advertised; this is what the server did. */
async function arbGoldDelta(fn, args, sim) {
	if (CONFIG.arbitrage.dryRun) {
		// Simulated from the listed price. Deliberately NOT from a random or
		// optimistic figure: the point of the rehearsal is to see the same
		// arithmetic the real run would do, so a discrepancy later is the
		// game's and not the model's.
		await sleep(200);
		return { outcome: 'resolved', reason: null, returned: null, delta: sim, dryRun: true };
	}
	const before = character.gold;
	let outcome = 'resolved', reason = null, returned = null;
	try { returned = await fn.apply(null, args); }
	catch (e) { outcome = 'rejected'; reason = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e); }
	await sleep(1200);          // the gold change lands on a socket round trip
	return { outcome: outcome, reason: reason, returned: returned, delta: character.gold - before };
}

/* One phase per tick. Never chains work onto a hop, because nothing after a
   hop runs. */
async function arbAdvance() {
	const t = ARB.cur;
	if (!t) return;
	const here = mShardKey();

	// ---- picked: nothing spent yet, so this is the last cheap exit ----------
	if (t.phase === 'picked') {
		if (here !== t.buyShard) {
			t.phase = 'picked'; arbSaveTrade(t);      // written BEFORE the hop
			arbLog('hopping to ' + t.buyShard + ' to buy ' + t.item);
			await mHopTo(t.buyShard);                 // the script ends here in a tab
			return;
		}
		t.phase = 'at_buy'; arbSaveTrade(t);
		return;
	}

	// ---- at_buy: verify, afford, buy ---------------------------------------
	if (t.phase === 'at_buy') {
		const near = await arbApproach(t.buyFrom);
		if (!near.ok) {
			t.attempts = (t.attempts || 0) + 1;
			if (t.attempts >= 3) {
				arbFinish(t, 'abandoned', { reason: 'could not reach the seller: ' + near.reason, disposition: 'nothing_spent' });
			} else { arbSaveTrade(t); }
			return;
		}
		const v = arbStillThere(t, 'buy');
		if (!v.ok) {
			arbFinish(t, 'abandoned', { reason: 'listing changed before buying: ' + (v.reason || (v.mismatch || []).join('; ')), disposition: 'nothing_spent' });
			return;
		}
		if (!arbAffordable(t.spend, character.gold)) {
			arbFinish(t, 'abandoned', { reason: 'would breach the ' + CONFIG.arbitrage.goldFloor + ' gold floor', disposition: 'nothing_spent' });
			return;
		}
		const r = await arbGoldDelta(trade_buy, [pEntity(t.buyFrom), t.buySlot, t.qty],
			-(t.buyPrice * t.qty));
		if (r.outcome !== 'resolved' || r.delta >= 0) {
			t.attempts = (t.attempts || 0) + 1;
			arbLog('buy did not take (' + (r.reason || 'no gold moved') + ')', 'orange');
			if (t.attempts >= 3) arbFinish(t, 'abandoned', { reason: 'buy refused: ' + (r.reason || 'no gold moved'), disposition: 'nothing_spent' });
			else arbSaveTrade(t);
			return;
		}
		// Gold has become an item. From here the trade must reach a terminal
		// state; it is no longer something that can simply be dropped.
		t.actualSpend = -r.delta;
		t.dryRun = !!r.dryRun;
		// Marked the instant it is consumed, not when the trade completes: if
		// the sell leg strands, this stand must still not be re-bought from.
		arbMarkUsed(t.buyShard, t.buyFrom, t.buySlot);
		t.phase = 'holding';
		t.attempts = 0;
		arbSaveTrade(t);
		arbLedger({
			id: t.id, event: 'open', item: t.item, level: t.level, special: t.special,
			qty: t.qty, buyPrice: t.buyPrice, buyFrom: t.buyFrom, buyShard: t.buyShard,
			spend: t.actualSpend, taxRate: t.taxRate,
		});
		arbLog('bought ' + t.item + ' x' + t.qty + ' for ' + t.actualSpend, '#7FD98A');
		return;
	}

	// ---- holding: an item we paid for, and a shard to reach ----------------
	if (t.phase === 'holding') {
		if (here !== t.sellShard) {
			arbSaveTrade(t);
			arbLog('hopping to ' + t.sellShard + ' to sell ' + t.item);
			await mHopTo(t.sellShard);
			return;
		}
		t.phase = 'at_sell'; arbSaveTrade(t);
		return;
	}

	// ---- at_sell: verify, sell, or find another buyer ----------------------
	if (t.phase === 'at_sell') {
		const near = await arbApproach(t.sellTo);
		const v = near.ok ? arbStillThere(t, 'sell') : { ok: false, reason: near.reason };
		if (!v.ok) {
			// The buyer is gone or has repriced. Re-ask the market rather than
			// give up: the item is already paid for, so any profitable exit
			// beats banking it.
			const alt = await arbFindBuyerFor(t);
			if (alt) {
				arbLog('buyer changed - rerouting to ' + alt.target + ' on ' + alt.shard + ' @ ' + alt.price, '#FFD700');
				t.sellTo = alt.target; t.sellShard = alt.shard; t.sellSlot = alt.slot; t.sellPrice = alt.price;
				t.phase = (alt.shard === here) ? 'at_sell' : 'holding';
				t.attempts = 0;
				arbSaveTrade(t);
				return;
			}
			t.attempts = (t.attempts || 0) + 1;
			if (t.attempts >= 3) {
				t.phase = 'stranded'; arbSaveTrade(t);
				arbLog('no buyer for ' + t.item + ' - banking it', 'orange');
			} else arbSaveTrade(t);
			return;
		}
		const r = await arbGoldDelta(trade_sell, [pEntity(t.sellTo), t.sellSlot, t.qty],
			Math.round(t.sellPrice * t.qty * (1 - (arbTaxRate() || 0))));
		if (r.outcome !== 'resolved' || r.delta <= 0) {
			t.attempts = (t.attempts || 0) + 1;
			arbLog('sell did not take (' + (r.reason || 'no gold received') + ')', 'orange');
			if (t.attempts >= 3) { t.phase = 'stranded'; }
			arbSaveTrade(t);
			return;
		}
		t.received = r.delta;
		t.gross = t.sellPrice * t.qty;
		t.tax = t.gross - t.received;
		t.net = t.received - (t.actualSpend || t.spend);
		arbMarkUsed(t.sellShard, t.sellTo, t.sellSlot);
		arbStrandings(0);          // a completed sale clears the breaker
		t.phase = 'sold';
		arbSaveTrade(t);
		return;
	}

	// ---- sold: settle the books, bank the share ----------------------------
	if (t.phase === 'sold') {
		arbFinish(t, 'closed', {
			item: t.item, qty: t.qty, sellPrice: t.sellPrice, sellTo: t.sellTo,
			sellShard: t.sellShard, gross: t.gross, received: t.received,
			tax: t.tax, net: t.net,
		});
		const share = arbBankShare(t.net);
		if (share > 0) await arbBankShareNow(t, share);
		return;
	}

	// ---- stranded: bought, unsellable. Bank it and close the books ---------
	if (t.phase === 'stranded') {
		const ok = await arbBankItem(t);
		arbFinish(t, 'abandoned', {
			reason: 'no buyer found', disposition: ok ? 'banked_item' : 'held_in_inventory',
			item: t.item, qty: t.qty, spend: t.actualSpend || t.spend,
		});
		// Each stranding has turned liquid gold into stock. A run of them means
		// the market being traded against is not the market on the board, and
		// continuing would keep paying to find that out.
		const n = arbStrandings(1);
		if (n >= CONFIG.arbitrage.maxConsecutiveStrandings) {
			CONFIG.arbitrage.enabled = false;
			arbLog('STOPPED: ' + n + ' trades in a row ended with the goods banked rather than sold. '
				+ 'Gold is being converted to stock. Set CONFIG.arbitrage.enabled back to true '
				+ 'once you know why.', 'red');
			arbLedger({ id: t.id, event: 'note',
				text: 'executor stopped itself after ' + n + ' consecutive strandings' });
		}
		return;
	}
}

/* Any fresh buy order for what we are holding, anywhere. Used only after the
   planned buyer has failed, when the item is already paid for and the question
   has changed from "is this the best trade" to "is there any exit at all". */
async function arbFindBuyerFor(t) {
	const got = await arbProbeMarketRows();
	const rows = got.rows || [];
	const maxAge = CONFIG.arbitrage.sellMaxAgeSec;
	const key = t.item + '|' + (t.level || 0) + '|' + (t.special || '');
	let best = null;
	for (const r of rows) {
		const age = pAgeSec(r.lastSeen);
		if (age == null || age > maxAge) continue;
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || !sl.b) continue;
			if ((sl.name + '|' + (sl.level || 0) + '|' + (sl.p || '')) !== key) continue;
			if (!(typeof sl.price === 'number' && isFinite(sl.price))) continue;
			const shard = String(r.serverRegion) + String(r.serverIdentifier);
			if (arbIsUsed(shard, r.id, k)) continue;   // we already filled this one
			const cand = { target: r.id, slot: k, price: sl.price, shard: shard, ageSec: age };
			if (!best || cand.price > best.price) best = cand;
		}
	}
	return best;
}

/* Deposit the banked share, then return to the scan spot before anything else
   happens - the agreed rule. The bank is a door off the same map as the scan
   spot, so this is a short walk, measured at about six seconds for the round
   trip. Both legs are recorded: a deposit that happened but was not logged
   would quietly drift the running total. */
async function arbBankShareNow(t, share) {
	if (CONFIG.arbitrage.dryRun) {
		arbLedger({ id: t.id, event: 'banked', amount: share });
		arbLog('[dry run] would bank ' + share + ' (half of ' + t.net + ' net)', '#9BD1FF');
		return true;
	}
	const arrived = await travelToBank();
	if (!arrived) {
		arbLog('could not reach the bank - ' + share + ' gold stays on hand, recorded as owed', 'orange');
		arbLedger({ id: t.id, event: 'note', text: 'bank share of ' + share + ' not deposited: bank unreachable' });
		return false;
	}
	let ok = false;
	try {
		await bank_deposit(share);
		await sleep(800);
		ok = true;
	} catch (e) {
		arbLog('bank_deposit failed: ' + (e && (e.reason || e.message) ? (e.reason || e.message) : e), 'red');
	}
	if (ok) {
		arbLedger({ id: t.id, event: 'banked', amount: share });
		arbLog('banked ' + share + ' (half of ' + t.net + ' net)', '#7FD98A');
	} else {
		arbLedger({ id: t.id, event: 'note', text: 'bank share of ' + share + ' not deposited: bank_deposit failed' });
	}
	// Do the rest of the bank's business while standing in it, then go back.
	try { await bankFullyProgressedItems(); } catch (e) { }
	await scoutGoToScanSpot();
	return ok;
}

/* Put an unsold item away rather than carry it. Inventory space is the scarcer
   resource, and an item in the bank is still an asset the ledger can account
   for - see the "abandoned" status, which keeps its spend out of realised P/L
   rather than reporting it as a loss. */
async function arbBankItem(t) {
	if (CONFIG.arbitrage.dryRun) {
		arbLog('[dry run] would bank the unsold ' + t.item, '#9BD1FF');
		return true;
	}
	let idx = -1;
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (it && it.name === t.item && (it.level || 0) === (t.level || 0)) { idx = i; break; }
	}
	if (idx < 0) {
		arbLog('cannot find ' + t.item + ' in inventory to bank - it may already be gone', 'orange');
		return false;
	}
	if (!(await travelToBank())) return false;
	try { await bank_store(idx); } catch (e) {
		arbLog('bank_store failed: ' + (e && (e.reason || e.message) ? (e.reason || e.message) : e), 'red');
		await scoutGoToScanSpot();
		return false;
	}
	await scoutGoToScanSpot();
	return true;
}

/* How long the oldest queued job has waited. Above jobPreemptMs it blocks the
   NEXT trade from starting - never one already running. */
function arbOldestJobAgeMs() {
	if (!state.queue.length) return null;
	let oldest = null;
	for (const j of state.queue) {
		const at = j && j.requestedAt ? j.requestedAt : null;
		if (at && (oldest == null || at < oldest)) oldest = at;
	}
	return oldest == null ? null : (Date.now() - oldest);
}

/* Look for work. Only ever reached with nothing in flight. */
async function arbLookForWork() {
	const gate = arbCanStart({
		trade: ARB.cur, busy: state.busy, probeHold: PROBE.hold,
		gold: character.gold, oldestJobAgeMs: arbOldestJobAgeMs(),
	});
	if (!gate.ok) return;
	if (Date.now() - ARB.lastLookAt < CONFIG.arbitrage.lookEveryMs) return;
	ARB.lastLookAt = Date.now();

	// Quiet: this is the 30-second beat, not a hand-run probe. See the
	// quiet-mode note in arbProbeFindFlips for why that matters.
	const flips = await arbProbeFindFlips({ quiet: true });
	if (!flips || !flips.length) return;
	const used = arbLoadUsed();
	let suppressed = 0;
	const pick = flips.find(function (f) {
		if (!f.affordable || !arbAffordable(f.spend, character.gold)) return false;
		// Either side having been traded recently disqualifies the route. The
		// sell side matters more - a buy order we filled is the one that costs
		// gold to rediscover - but a stand we emptied is equally not there.
		if (arbIsUsed(f.buyShard, f.buyFrom, f.buySlot, used)
			|| arbIsUsed(f.sellShard, f.sellTo, f.sellSlot, used)) { suppressed++; return false; }
		return true;
	});
	if (!pick) {
		if (suppressed) arbLog(suppressed + ' flip(s) skipped - traded against recently', '#8b98ab');
		return;
	}

	const t = arbPlan(pick, character.gold);
	arbSaveTrade(t);
	arbLog((CONFIG.arbitrage.dryRun ? '[dry run] ' : '') + 'taking ' + t.item + ' x' + t.qty
		+ ': buy ' + t.buyPrice + ' from ' + t.buyFrom
		+ ' (' + t.buyShard + '), sell ' + t.sellPrice + ' to ' + t.sellTo + ' (' + t.sellShard
		+ ') for ~' + t.expectProfit + ' net', '#FFD700');
}

async function arbLoop() {
	try {
		await arbFlushLedger();
		if (CONFIG.arbitrage.enabled && !PROBE.hold) {
			if (!ARB.busy) {
				ARB.busy = true;
				try {
					if (ARB.cur) { state.busy = true; await arbAdvance(); }
					else await arbLookForWork();
				} finally {
					ARB.busy = false;
					if (!ARB.cur) state.busy = false;
				}
			}
		}
		/* Put the stand back once the trade is done.

		   shouldHoldStand() already says a stand and an in-flight trade do not
		   belong together, but only openStandAtBestSpot() consulted it, so the
		   rule only ever governed OPENING. Nothing closed the stand when a trade
		   started and nothing reopened it afterwards - every other reopen hangs
		   off a delivery batch, the gear loop, the kiss, a hop home, or script
		   load, none of which an arbitrage run touches.

		   The guards matter: shouldHoldStand() inside refuses while ARB.cur is
		   set or we are off the home shard, and standOpen stops this re-issuing
		   open_stand on every tick. */
		if (!ARB.cur && !ARB.busy && !state.busy && !state.standOpen) await openStandAtBestSpot();
	} catch (e) {
		console.error('arbLoop error:', e);
		ARB.busy = false;
	}
	setTimeout(arbLoop, CONFIG.arbitrage.tickMs);
}

/* A reload landed mid-trade. Storage is authoritative - the phase written
   before the hop says what was happening, and nothing in memory survived. */
function arbRestore() {
	try { ARB.buffer = get(ARB_BUF_KEY) || []; } catch (e) { ARB.buffer = []; }
	const t = arbLoadTrade();
	if (!t) return;
	ARB.cur = t;
	// state.busy is taken back immediately: an in-flight trade outranks
	// scouting and the anniversary round, and holds that claim across a reload.
	state.busy = true;
	arbLog('resuming ' + t.item + ' x' + t.qty + ' in phase "' + t.phase + '"'
		+ (t.actualSpend ? ' - ' + t.actualSpend + ' gold already committed' : ''), '#FFD700');
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
const MERCHANT_BUILD = 'v27 / arb.4 / 2026-09-19 / used-listing cooldown + stranding breaker';

function arbProbeBuild() {
	const api = Object.keys(parent.PROBE_API || {}).sort();
	const out = {
		build: MERCHANT_BUILD,
		api: api,
		apiCount: api.length,
		// Read from CONFIG, never transcribed into the build string. An earlier
		// version spelled the flags out in that string, which made a hand-kept
		// note the thing a reader checked before deciding whether a rehearsal
		// could spend gold - and a note that has to be kept in step with two
		// constants is a note that will eventually disagree with them. This
		// cannot: it is the value the executor itself consults.
		arbitrage: {
			enabled: !!CONFIG.arbitrage.enabled,
			dryRun: !!CONFIG.arbitrage.dryRun,
			canSpendGold: !!CONFIG.arbitrage.enabled && !CONFIG.arbitrage.dryRun,
			minProfit: CONFIG.arbitrage.minProfit,
			goldFloor: CONFIG.arbitrage.goldFloor,
		},
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
	pLog('arbitrage: ' + (out.arbitrage.enabled ? 'ENABLED' : 'disabled')
		+ ', dryRun ' + (out.arbitrage.dryRun ? 'ON' : 'OFF')
		+ ' -> ' + (out.arbitrage.canSpendGold
			? 'THIS BUILD CAN SPEND REAL GOLD'
			: (out.arbitrage.enabled ? 'rehearsal only, no gold moves' : 'executor will not run at all')),
		out.arbitrage.canSpendGold ? 'red' : (out.arbitrage.enabled ? '#7FD98A' : 'orange'));
	return pShow(out);
}

const PROBE = {
	// While held: no shard hop (a hop reloads the page and kills a probe
	// mid-measurement), no gear spending, no sellTrash. That last one matters
	// most - without it a gold delta measured across a trade is the trade plus
	// whatever junk got vendored in the same two seconds.
	hold: false,
	kissNoted: false,
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
		? 'HOLD ON - no hops, no gear spending, no sellTrash, NO ARBITRAGE. This '
			+ 'shard is still scanned and posted every '
			+ Math.round(CONFIG.scout.townScanMs / 1000)
			+ 's while the stand region is in view. Survives a reload - clear it '
			+ 'with arbProbeHold(false).'
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
	/* no-store, and a cache-buster on top of it.

	   Without this the browser serves its cached /merchants copy indefinitely,
	   and the failure is silent in the worst way: a cached response carries a
	   cached lastSeen, so ageSec is computed against a frozen timestamp and
	   EVERY row reads as fresh forever. sellMaxAgeSec cannot catch it - the rows
	   it is handed are, by its own measure, seconds old.

	   Measured live on 2026-09-21. The executor spent hours re-picking
	   Kazhag|trade1|EUI, a stand that had already left the market: ALData polled
	   directly showed no Kazhag at all and the bridge held zero merchant rows,
	   while the executor opened a FRESH trade against him every ~18 seconds and
	   abandoned it at slot_gone. 399 abandons against 45 closed trades, and the
	   two dominant reasons - slot_gone and not_loaded - are the same fact seen
	   twice: counterparties that had left a market this copy never stopped
	   describing. It costs almost no gold, because verification fires before any
	   buy; it costs nearly all of the throughput.

	   no-store covers this browser, the query param covers anything between here
	   and the origin. */
	const o = { cache: 'no-store' };
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(function () { try { ac.abort(); } catch (e) { } }, ms);
	}
	const bust = (url.indexOf('?') === -1 ? '?' : '&') + '_=' + Date.now();
	try {
		const r = await fetch(url + bust, o);
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

/* One row per merchant per shard, taking whichever source saw it more
   recently.

   This used to be winner-takes-all: 'auto' asked ALData, and if ALData
   answered with anything at all the bridge was never consulted. That was the
   right call while our scouts did not exist - ALData covers every shard
   continuously and a lone rotating scout produces a rolling snapshot of one
   shard at a time, so preferring ours wholesale meant reading the worst view
   of the market rather than the best.

   It is the wrong call once scouts are running. Freshness is not a property of
   a source, it is a property of a row: on the shard a parked scout is sitting
   on, our data is seconds old and ALData's is whatever its own refresh cadence
   gives; three shards away the opposite holds. So both are fetched and merged
   per merchant per shard, and the newer row wins.

   A union, not an intersection. A merchant only one source knows about is
   kept: absence from a source is not evidence of departure, because neither
   source claims to have looked everywhere. Only a CONFLICT is resolved, and
   only by age.

   A row with no readable timestamp always loses to one that has an age, for
   the same reason pAgeSec exists - an unknown age must never sort as fresh. */
function arbMergeMarketRows(aldataRows, bridgeRows) {
	const by = new Map();
	let fromBridge = 0, fromAldata = 0, bridgeWins = 0;

	const take = function (row, src) {
		if (!row || !row.id) return;
		const key = String(row.serverRegion) + String(row.serverIdentifier) + '|' + row.id;
		const age = pAgeSec(row.lastSeen);
		const cur = by.get(key);
		if (cur) {
			// Known age beats unknown; otherwise the smaller age wins.
			const better = (cur.age == null && age != null)
				|| (age != null && cur.age != null && age < cur.age);
			if (!better) return;
			if (cur.src === 'bridge') bridgeWins--;
		}
		by.set(key, { row: row, age: age, src: src });
		if (src === 'bridge') bridgeWins++;
	};

	for (const r of (aldataRows || [])) { fromAldata++; take(r, 'aldata'); }
	for (const r of (bridgeRows || [])) { fromBridge++; take(r, 'bridge'); }

	const rows = [];
	for (const e of by.values()) rows.push(e.row);
	return { rows: rows, fromAldata: fromAldata, fromBridge: fromBridge, bridgeWins: bridgeWins };
}

async function arbProbeMarketRows() {
	const want = arbProbeSource();
	const errors = {};

	const fetchOne = async function (src) {
		try {
			const rows = (src === 'aldata')
				? await arbFetchJson(CONFIG.scout.aldata + '/merchants', 8000)
				: await scoutFetch('/merchants');
			if (Array.isArray(rows) && rows.length) return rows;
			errors[src] = Array.isArray(rows) ? 'empty' : 'not an array';
		} catch (e) {
			errors[src] = String(e && e.message ? e.message : e);
		}
		return null;
	};

	// Pinning a source stays available and stays winner-takes-all - it exists to
	// answer "is the bridge feeding anything at all", and a merge would hide
	// exactly the answer it is asked for.
	if (want === 'bridge' || want === 'aldata') {
		const rows = await fetchOne(want);
		if (rows) return { rows: rows, source: want };
		pLog('no market rows from pinned source ' + want + ' (' + errors[want]
			+ ') - falling back to what is in view', 'orange');
		return { rows: null, source: 'in-view', errors: errors };
	}

	const both = await Promise.all([fetchOne('aldata'), fetchOne('bridge')]);
	const aldataRows = both[0], bridgeRows = both[1];

	if (!aldataRows && !bridgeRows) {
		pLog('no market rows from aldata or bridge (aldata: ' + errors.aldata
			+ '; bridge: ' + errors.bridge + ') - falling back to what is in view', 'orange');
		return { rows: null, source: 'in-view', errors: errors };
	}
	if (!bridgeRows) return { rows: aldataRows, source: 'aldata', errors: errors };
	if (!aldataRows) return { rows: bridgeRows, source: 'bridge', errors: errors };

	const m = arbMergeMarketRows(aldataRows, bridgeRows);
	pLog(m.rows.length + ' merchant rows merged (' + m.fromAldata + ' aldata, '
		+ m.fromBridge + ' bridge; ours was fresher on ' + m.bridgeWins + ')');
	return { rows: m.rows, source: 'merged', merge: m };
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
	/* QUIET MODE - for arbLookForWork, which calls this on every look.

	   This began life as a hand-run probe and kept its probe manners: it ends
	   in pShow(), which opens a modal, and narrates itself through pLog().
	   Harmless when a person types it; not harmless on a 30-second beat. The
	   operator watched modals stack up on screen all morning - and pLog also
	   writes probe_log, which is capped at 200, so the automated caller was
	   evicting the operator's own probe history in under two hours.

	   Quiet suppresses the display and the narration and nothing else. The
	   return value is unchanged, so the caller sees exactly what it saw
	   before, and a probe run by hand still shows and narrates as always. */
	const show = opts.quiet ? function (x) { return x; } : pShow;
	const note = opts.quiet ? function () { } : pLog;
	const minProfit = (opts.minProfit == null) ? CONFIG.arbitrage.minProfit : opts.minProfit;
	const maxAge = (opts.maxAgeSec == null) ? CONFIG.arbitrage.sellMaxAgeSec : opts.maxAgeSec;
	const tax = arbTaxRate();
	if (tax == null) {
		note('no tax rate available - refusing to price a flip rather than assume zero', 'red');
		return show([]);
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

	/* Count what freshness throws away, and how narrowly.

	   Without this a tightened window is indistinguishable from a quiet market:
	   both produce "no flips". The freshest REJECTED age is the useful half - if
	   the best thing on the board missed by thirty seconds the window is too
	   tight, and if it missed by an hour the window is doing its job. */
	let staleBuys = 0, staleSells = 0;
	let nearestMiss = null;
	const missed = function (age) {
		if (age == null) return;
		if (nearestMiss == null || age < nearestMiss) nearestMiss = age;
	};

	const cheapest = new Map();
	for (const b of buys) {
		if (!fresh(b.ageSec)) { staleBuys++; missed(b.ageSec); continue; }
		const cur = cheapest.get(b.key);
		if (!cur || b.price < cur.price) cheapest.set(b.key, b);
	}

	const out = [];
	for (const sell of sells) {
		if (!fresh(sell.ageSec)) { staleSells++; missed(sell.ageSec); continue; }
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

	const staleNote = (staleBuys || staleSells)
		? ' - ' + staleBuys + '/' + buys.length + ' buy-side and ' + staleSells + '/' + sells.length
		  + ' sell-side dropped as stale'
		  + (nearestMiss == null ? '' : ', freshest rejected ' + Math.round(nearestMiss / 60 * 10) / 10 + ' min')
		: '';

	if (!out.length) {
		note('no flip clears ' + minProfit + ' with both sides under ' + Math.round(maxAge / 60)
			+ ' min old (tax ' + (tax * 100).toFixed(1) + '%, ' + buys.length + ' buy-side, '
			+ sells.length + ' sell-side listings considered)' + staleNote, 'orange');
		return show([]);
	}
	if (staleNote) note('freshness' + staleNote);
	const t = out[0];
	const unaffordable = out.filter(function (r) { return !r.affordable; }).length;
	note(out.length + ' flip(s) clearing ' + minProfit + '. Best: ' + t.item + ' x' + t.qty
		+ ' - buy ' + t.buyPrice + ' from ' + t.buyFrom + ' (' + t.buyShard + ')'
		+ ', sell ' + t.sellPrice + ' to ' + t.sellTo + ' (' + t.sellShard + ')'
		+ ' = ' + t.profit + ' net, ' + t.hops + ' hop(s)'
		+ (t.affordable ? '' : ' - NOT AFFORDABLE under the ' + CONFIG.arbitrage.goldFloor + ' floor'),
		'#7FD98A');
	if (unaffordable) note(unaffordable + ' of these would breach the gold floor', 'orange');
	return show(out.slice(0, 20));
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

/* How far apart are distance() and plain arithmetic, and why?
 
   MEASURED, not theorised. distance() is edge-to-edge: it subtracts one
   entity's base for a bare {x, y}, and both bases when handed two whole
   entities. Readings from a stationary character at (240,-90):
 
       same two points, bare {x,y}   game 287  arithmetic 300   short by 13
       same two points, whole entity game 273  arithmetic 300   short by 27
       an NPC                        game 264  arithmetic 284   short by 20
       1000 units due east           game 987  arithmetic 1000  short by 13
 
   So it can never equal centre-to-centre arithmetic, and an earlier version of
   this function called that disagreement and printed it in red. That was the
   wrong question: the merchant's long-standing calls ask "am I close enough to
   interact", which is exactly what edge-to-edge answers. No rewrite warranted
   there, and none was made.
 
   What this now checks is that the offset stays small and one-directional. A
   large gap, or arithmetic coming out SHORTER than the game's figure, would
   mean something other than collision geometry and would be worth chasing. */
function arbProbeDistanceCheck(targetName) {
	const out = { cases: [] };
	const me = pWhere(character);
	const add = function (label, x, y, extra) {
		let game = null, err = null;
		try { game = Math.round(distance(character, Object.assign({ x: x, y: y }, extra || {}))); }
		catch (e) { err = String(e && e.message ? e.message : e); }
		const mine = Math.round(pDist(me.x, me.y, x, y));
		out.cases.push({
			label: label, at: { x: Math.round(x), y: Math.round(y) },
			game: game, pDist: mine,
			shortBy: (game == null) ? null : mine - game,
			error: err,
		});
	};
	if (targetName) {
		const e = pEntity(targetName);
		if (e) {
			const t = pWhere(e);
			add('entity ' + targetName + ' via plain {x,y}', t.x, t.y);
			let game = null;
			try { game = Math.round(distance(character, e)); } catch (err) { }
			const mine = Math.round(pDist(me.x, me.y, t.x, t.y));
			out.cases.push({
				label: 'entity ' + targetName + ' passed WHOLE', at: { x: Math.round(t.x), y: Math.round(t.y) },
				game: game, pDist: mine, shortBy: (game == null) ? null : mine - game,
			});
		} else out.cases.push({ label: targetName + ' not loaded', game: null, pDist: null, shortBy: null });
	}
	const spot = CONFIG.stand.candidates[0];
	if (spot) add('the scan/stand spot (used by scoutHeldScan)', spot.x, spot.y);
	add('the potion NPC ' + CONFIG.npc.name, CONFIG.npc.x, CONFIG.npc.y, { map: CONFIG.npc.map });
	add('a point 1000 units due east', me.x + 1000, me.y);

	const deltas = out.cases.map(function (c) { return c.shortBy; }).filter(function (d) { return d != null; });
	out.meAt = me;
	out.offsets = deltas;
	// Both entity bases together are tens of units, not hundreds. Anything
	// outside this, or negative, is not collision geometry.
	out.consistentWithCollisionGeometry = deltas.length > 0
		&& deltas.every(function (d) { return d >= 0 && d <= 60; });
	pLog(out.consistentWithCollisionGeometry
		? 'distance() runs ' + Math.min.apply(null, deltas) + '-' + Math.max.apply(null, deltas)
			+ ' units short of centre-to-centre - edge-to-edge, as expected. Nothing to fix.'
		: 'distance() offsets are NOT collision geometry: ' + deltas.join(', ')
			+ ' - something else is going on', 
		out.consistentWithCollisionGeometry ? null : 'red');
	return pShow(out);
}

/* Is this listing real, here, now?
 
   A listing on ALData seven seconds old was walked to and was simply not
   present - no entity, no slots, nothing at the coordinates. The public feed
   carries stands that have already gone, and the merchant would otherwise hop
   a shard on the strength of one.
 
   So every flip verifies against the live client before any gold moves: the
   target loaded, the slot still holding the same item at the same price and
   side. A price that has moved is not a smaller opportunity, it is a different
   trade that has not been evaluated. */
function arbProbeVerify(expect) {
	expect = expect || {};
	const out = { target: expect.target, slot: expect.slot, ok: false };
	const e = expect.target ? pEntity(expect.target) : null;
	if (!e) {
		out.reason = 'not_loaded';
		pLog(expect.target + ' is not loaded here - the listing is stale or we are out of range', 'orange');
		return pShow(out);
	}
	out.loaded = true;
	const me = pWhere(character), t = pWhere(e);
	out.sameMap = t.map === me.map;
	out.distance = out.sameMap ? Math.round(pDist(me.x, me.y, t.x, t.y)) : null;
	const sl = (e.slots || {})[expect.slot];
	if (!sl) {
		out.reason = 'slot_gone';
		pLog(expect.target + ' is here but ' + expect.slot + ' is empty - the stand was rearranged', 'orange');
		return pShow(out);
	}
	out.live = { name: sl.name, level: sl.level || 0, price: sl.price, q: sl.q, b: !!sl.b };
	const mismatch = [];
	if (expect.name != null && sl.name !== expect.name) mismatch.push('name ' + sl.name + ' not ' + expect.name);
	if (expect.level != null && (sl.level || 0) !== expect.level) mismatch.push('level ' + (sl.level || 0) + ' not ' + expect.level);
	if (expect.price != null && sl.price !== expect.price) mismatch.push('price ' + sl.price + ' not ' + expect.price);
	if (expect.b != null && !!sl.b !== !!expect.b) mismatch.push('side changed');
	out.mismatch = mismatch;
	out.ok = mismatch.length === 0;
	pLog(out.ok
		? 'verified: ' + expect.target + '.' + expect.slot + ' is ' + sl.name + ' @ ' + sl.price
			+ ', ' + out.distance + ' units away'
		: 'CHANGED since the listing: ' + mismatch.join('; ') + ' - re-evaluate before trading',
		out.ok ? null : 'orange');
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
	await ensureStandClosed();   // same bypass as arbApproach
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
		'arbProbeVerify({...})      is a listing still real, here, now?',
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
		range: arbProbeRange, distanceCheck: arbProbeDistanceCheck, verify: arbProbeVerify,
		npcSell: arbProbeNpcSell,
		dump: arbProbeDump, clear: arbProbeClear, help: arbProbeHelp, state: PROBE,
	};
} catch (e) { }

// ============================================================================
// GAME LOG FILTER
// ============================================================================
// The same filter bar the other three characters run. Guarded on parent.$
// because this script also has to load where there is no game DOM at all -
// on Mainframe there is no #gamelog to hang a tab bar on, and every call
// below would throw on a null element.
//
// Tab defaults are inherited rather than re-tuned for a merchant. The one
// thing worth knowing: initTimestamps() takes over the socket's 'game_log'
// listener wholesale, so from here on every server-pushed log line arrives
// stamped. The merchant's own game_log() calls are unaffected - those go
// through the client function, not the socket event.
if (parent.$) {

	(function () {
		const FILTERS = {
			kills: { show: false, regex: /killed/, label: 'Kills' },
			gold: { show: true, regex: /gold/, label: 'Gold' },
			party: { show: true, regex: /party/, label: 'Party' },
			items: { show: true, regex: /found/, label: 'Items' },
			upgrade: { show: true, regex: /(upgrade|combination)/, label: 'Upgrades' },
			errors: { show: true, regex: /(error|line|column)/i, label: 'Errors' },
			/* Routine client chatter that says nothing actionable during farming.
			   Off by default, but a tab rather than a hard suppression so each
			   can be read back when it IS the question being debugged.

			     get closer  - emitted on every out-of-range action attempt.
			                   Measured on Dexon: 80 of 289 entries in a
			                   four-minute sample.
			     AP[...]     - achievement progress. A counter that resets on the
			                   wrong kind of last hit repeats the same fraction
			                   indefinitely rather than counting up - firehazard,
			                   which wants 20,000 CONSECUTIVE burn last-hits, sat
			                   at "1/20,000" on Dexon for exactly that reason.
			     scared /    - the courage mechanic. Merchants carry courage 1
			     terrified     and mcourage/pcourage 0, so a single magical or pure
			                   attacker frightens them outright. Rarely relevant
			                   standing in town, which is the point of hiding it. */
			noise: { show: false, regex: /get closer|AP\[|scared|terrified/i, label: 'Noise' }
		};

		/* Tabs wrap onto rows of this many instead of being squeezed into one.
		   Each tab is flex 1 1 <basis> rather than a fixed width, so a final
		   short row grows to fill the bar instead of leaving a gap. */
		const TABS_PER_ROW = 4;

		const COLORS = {
			active: ['#151342', '#1D1A5C'],
			inactive: ['#222', '#333'],
			activeText: '#FFF',
			inactiveText: '#999'
		};

		const TRUNCATE_AT = 1000;
		const TRUNCATE_TO = 720;

		function padZero(num, length = 2) {
			return num.toString().padStart(length, '0');
		}

		function getTimestamp() {
			const now = new Date();
			return `${padZero(now.getHours())}:${padZero(now.getMinutes())}:${padZero(now.getSeconds())}`;
		}

		function createFilterBar() {
			const existingBar = parent.document.getElementById('gamelog-tab-bar');
			if (existingBar) existingBar.remove();

			const bar = parent.document.createElement('div');
			bar.id = 'gamelog-tab-bar';
			bar.className = 'enableclicks';
			Object.assign(bar.style, {
				border: '5px solid gray',
				height: 'auto',
				background: 'black',
				margin: '-5px 0',
				display: 'flex',
				flexWrap: 'wrap',
				fontSize: '20px',
				fontFamily: 'pixel'
			});

			Object.entries(FILTERS).forEach(([key, filter], index) => {
				const tab = parent.document.createElement('div');
				tab.id = `gamelog-tab-${key}`;
				tab.className = 'gamelog-tab enableclicks';
				tab.textContent = filter.label;

				const colors = filter.show ? COLORS.active : COLORS.inactive;
				const textColor = filter.show ? COLORS.activeText : COLORS.inactiveText;

				Object.assign(tab.style, {
					height: '24px',
					flex: `1 1 ${100 / TABS_PER_ROW}%`,
					boxSizing: 'border-box',
					textAlign: 'center',
					lineHeight: '24px',
					cursor: 'default',
					background: colors[index % 2],
					color: textColor
				});

				tab.addEventListener('click', () => toggleFilter(key));
				bar.appendChild(tab);
			});

			const gamelog = parent.document.getElementById('gamelog');
			gamelog.parentElement.insertBefore(bar, gamelog);
		}

		function toggleFilter(key) {
			FILTERS[key].show = !FILTERS[key].show;

			const tab = parent.document.getElementById(`gamelog-tab-${key}`);
			const index = Array.from(tab.parentElement.children).indexOf(tab);
			const colors = FILTERS[key].show ? COLORS.active : COLORS.inactive;
			const textColor = FILTERS[key].show ? COLORS.activeText : COLORS.inactiveText;

			tab.style.background = colors[index % 2];
			tab.style.color = textColor;

			filterGamelog();
			scrollGamelogToBottom();
		}

		/* First matching filter decides, and nothing matching means show. Shared by
		   all three callers so the rule cannot drift between them. */
		function shouldShowEntry(text) {
			for (const filter of Object.values(FILTERS)) {
				if (filter.regex.test(text)) return filter.show;
			}
			return true;
		}

		function filterGamelog() {
			const entries = parent.document.querySelectorAll('.gameentry');
			entries.forEach(entry => {
				entry.style.display = shouldShowEntry(entry.innerHTML) ? 'block' : 'none';
			});
		}

		/* Not every line in #gamelog comes through addLogEntry. The socket hook
		   below only replaces the `game_log` listener; the client writes others
		   itself through add_log, and those arrive as .gameentry nodes with no
		   inline display set - which is exactly how "Get closer" was slipping
		   past the filters. They were only ever hidden by filterGamelog(), so
		   they stayed visible until something happened to toggle a tab.

		   Watching for added nodes covers both paths, so the filter bar now
		   governs the whole log rather than only the half this code writes. */
		function observeGamelog() {
			const gamelog = parent.document.getElementById('gamelog');
			if (!gamelog) return;
			if (parent.gamelog_filter_observer) parent.gamelog_filter_observer.disconnect();
			const MO = parent.MutationObserver || MutationObserver;
			const observer = new MO((records) => {
				for (const record of records) {
					for (const node of record.addedNodes) {
						if (node.nodeType !== 1 || !node.classList || !node.classList.contains('gameentry')) continue;
						node.style.display = shouldShowEntry(node.innerHTML) ? 'block' : 'none';
					}
				}
			});
			observer.observe(gamelog, { childList: true });
			parent.gamelog_filter_observer = observer;
		}

		function scrollGamelogToBottom() {
			const gamelog = parent.document.getElementById('gamelog');
			gamelog.scrollTop = gamelog.scrollHeight;
		}

		function addLogEntry(message, color = 'white') {
			if (parent.mode?.dom_tests || parent.inside === 'payments') return;

			const gamelog = parent.document.getElementById('gamelog');

			if (parent.game_logs.length > TRUNCATE_AT) {
				parent.game_logs = parent.game_logs.slice(-TRUNCATE_TO);

				const truncateMsg = "<div class='gameentry' style='color: gray'>- Truncated -</div>";
				const entries = parent.game_logs.map(([msg, clr]) =>
					`<div class='gameentry' style='color: ${clr || 'white'}'>${msg}</div>`
				).join('');

				gamelog.innerHTML = truncateMsg + entries;
			}

			parent.game_logs.push([message, color]);

			const display = shouldShowEntry(message) ? 'block' : 'none';

			const entry = parent.document.createElement('div');
			entry.className = 'gameentry';
			entry.style.color = color;
			entry.style.display = display;
			entry.innerHTML = message;

			gamelog.appendChild(entry);
			scrollGamelogToBottom();
		}

		function initTimestamps() {
			if (parent.socket.hasListeners('game_log')) {
				parent.socket.removeListener('game_log');
			}

			parent.socket.on('game_log', data => {
				parent.draw_trigger(() => {
					const timestamp = getTimestamp();

					if (typeof data === 'string') {
						addLogEntry(`${timestamp} | ${data}`, 'gray');
					} else {
						if (data.sound) sfx(data.sound);
						addLogEntry(`${timestamp} | ${data.message}`, data.color);
					}
				});
			});
		}

		createFilterBar();
		filterGamelog();
		observeGamelog();
		initTimestamps();
	})();
}

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
	// An arbitrage trade in flight owns where the merchant is. This reload is
	// very likely the trade's own hop, and going home from here would strand a
	// paid-for item on the wrong shard - the delivery jobs are requeued above
	// and will be served once the trade reaches a terminal state.
	if (ARB.cur) {
		game_log('A trade is in flight - staying put; queued jobs wait', '#FFD700');
		mClearTrip();
		return;
	}
	if (!state.queue.length && mShardKey() !== home) {
		game_log(`Nothing left to do here - returning to ${home}`, '#FFD700');
		mClearTrip();
		await mHopTo(home);
		return;
	}
	mClearTrip();
}

// arbRestore FIRST: resumeInterruptedTrip decides whether to hop home, and it
// can only make that call correctly once it knows a trade is in flight.
arbRestore();
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
anniversaryKissLoop();
arbLoop();
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
