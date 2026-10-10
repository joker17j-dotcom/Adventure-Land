// ============================================================================
// Meltymerch (Merchant) - slot CH_aLtHealaSgKdmOsDWpNl8scE9NhXk - v92
//
// CHANGELOG: read CHANGELOG.md in this repo. Do not put version history back
// in this file, and do not reconstruct it from git log - CHANGELOG.md is the
// record. Prepend new entries there, newest first, and never rewrite an old
// one. Bump the version on the line above in the same commit.
//
// COMMENTS: a line ending "-> MerchantComments.md#anchor" is a SUMMARY, not
// the whole comment. The reasoning behind it - what was measured, what was
// tried and discarded, why a number is that number - lives in
// Codex/MerchantComments.md under that anchor. Read it before changing the
// code it sits on. Most of those numbers were measured live rather than
// chosen, and several record a theory that turned out to be wrong; both are
// easy to tidy away if you only see the summary. When you change such a line,
// update its section there in the same commit and keep the pointer.
//
// SILENT LOAD FAILURE: a slot can be ACCEPTED by save_code and then never
// evaluated - the runner builds a frame where the character object exists and
// every script function is undefined, with nothing in the console and no
// exception anywhere. Two things have produced it; neither is understood.
//
// Backticks: a backtick inside a COMMENT bisected to this failure on
// 2026-09-21 - two identical 239,029-char builds, one with a backtick pair
// around a word and one with quotes, and only the quoted one loaded. But
// Codex/FamilyFleet.js has backticks in comments and runs, so the rule is NOT
// general and the mechanism is unknown. Quotes in prose cost nothing, so
// prefer them here, but do not trust this as an explanation.
//
// Size: no ceiling is established. 245,706 chars loaded and 238,214 did not,
// so size alone does not explain it and the "240 KiB" once written here was
// wrong. If a deploy comes up empty with a clean console, bisect - do not
// trust a number, including these.
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
let plCursor = 0;           // highest relay seq collected - PERSISTED, see PL_CURSOR_KEY
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
	// Stamp where the sender is standing. Doing it here rather than at each
	// -> MerchantComments.md#stamp-where-the-sender-is
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
		const since = plCursor;
		const r = await plFetch(`/msg?to=${encodeURIComponent(plName())}&since=${since}`);
		/* The one failure a remembered cursor can introduce: the bridge restarts,
		   its seq begins again at 0, and a cursor from the old numbering sits above
		   every new message - starving the merchant in silence. Its own cursor
		   going backwards is the tell, and re-reading the backlog once is the
		   cheap, safe answer. */
		if (typeof r.cursor === 'number' && r.cursor < since) {
			plLog('bridge seq went backwards (' + since + ' -> ' + r.cursor + ') - it restarted; reading from 0', 'orange');
			plCursor = 0;
			plSaveCursor(0);
			return;
		}
		let high = since;
		for (const m of (r.messages || [])) {
			// Straight into the script's existing handler, so relayed and in-game
			// messages take exactly the same path. plFirstTime drops whichever
			// copy arrives second.
			const relayed = Object.assign({}, m.payload || {});
			/* When the message was SENT, from whichever field this bridge actually
			   stamps. MEASURED 2026-09-29 against the running bridge: a /msg row
			   carries seq, at, frm, id, payload - `at` is an ISO-8601 string, and
			   NO row carries `ts`. This read only `ts`, so _plts was never set,
			   every reqAt fell back to Date.now(), and a ten-minute-old replay
			   looked newer than the delivery that had already satisfied it. The
			   watermark below was inert from the day it shipped. Both fields are
			   read now, seconds and ISO, so a bridge that adds `ts` later also
			   works. In-game messages have no stamp and need none: send_cm is live
			   and cannot be replayed - only the bridge stores, so only the bridge
			   can hand one back twice. */
			if (!relayed._plts) {
				if (m.ts) relayed._plts = Math.round(Number(m.ts) * 1000);
				else if (m.at) { const p = Date.parse(m.at); if (isFinite(p)) relayed._plts = p; }
			}
			try { on_cm(m.frm, relayed); } catch (e) { plLog('handler error: ' + e, 'orange'); }
			if (typeof m.seq === 'number' && m.seq > high) high = m.seq;
		}
		/* Advanced only once the batch has been handled, then written straight to
		   storage. A hop mid-batch therefore re-reads the tail instead of losing
		   it, and the watermarks absorb the handful it re-reads - the safe
		   direction. r.cursor can run ahead of the last message here, since the
		   seq is shared with messages addressed to the other characters. */
		plCursor = Math.max(high, Number(r.cursor) || 0);
		if (plCursor !== since) plSaveCursor(plCursor);
	} catch (e) {
		plUp = false;
		plProbed = Date.now();
		plLog('bridge lost - send_cm only until it returns', 'orange');
	}
}

function plStatus() {
	return { bridge: plUp ? 'up' : 'off', cursor: plCursor, deduped: plSeen.size };
}

/* THE HOP REPLAY, and the three things that stop it.

   change_server reloads the page on every hop - and the scout rotation hops
   several times an hour - so every in-memory field resets. The bridge keeps
   messages for MESSAGE_TTL (10 minutes) and serves everything with seq > since,
   so a cursor that resets to 0 re-reads ten minutes of already-satisfied
   requests and acts on each one. Measured 2026-09-25: MageofOz went from 278
   to 10,563 mpot1 on a single genuine request, and FatherToken reached 11,059.
   Measured 2026-09-29: 15 `location` rows in the backlog, every one carrying
   needsMluck: true from before the buff was cast, while Dexon's mluck - from
   Meltymerch - still had 52 minutes left on it.

   1. plCursor is PERSISTED (v68). The replay does not happen in the first
      place: after a hop the merchant resumes from the seq it had reached.
   2. The delivery watermark below, per recipient AND potion. A request is
      refused only when THAT character has already been served THAT potion
      since the request was made - by definition a request already satisfied.
      It never discards an unmet need, so it cannot hide one from
      arbOldestJobAgeMs and the jobPreemptMs safeguard the way a blanket
      staleness gate would. Keyed per potion on purpose: an mp delivery must
      not suppress an hp request made a second earlier.
   3. The mluck watermark, same shape, added in v68 - deliveries had a guard
      and buffs had none.

   2 and 3 are the durable half: CODE storage is the only state a hop cannot
   erase. They stay even with the cursor fixed, because a mid-batch reload
   deliberately re-reads its tail, and because one of them being enough has
   never been demonstrated. */
function plDeliveredKey(recipient, potion) {
	return 'pl_delivered_' + recipient + '_' + (potion === 'mp' ? 'mp' : 'hp');
}
function plDeliveredAt(recipient, potion) {
	try { return Number(get(plDeliveredKey(recipient, potion))) || 0; }
	catch (e) { return 0; }
}
function plMarkDelivered(recipient, potion, when) {
	try { set(plDeliveredKey(recipient, potion), when || Date.now()); }
	catch (e) { plLog('could not persist delivery watermark for ' + recipient, 'orange'); }
}

/* The same durable trick for the buff. mluck lasts an hour (G.skills.mluck
   .duration, measured 3,600,000 ms on 2026-09-29) and its `ms` field is the
   remaining time, so a cast can be dated exactly from an observed buff. */
function plMluckedKey(recipient) { return 'pl_mlucked_' + recipient; }
function plMluckedAt(recipient) {
	try { return Number(get(plMluckedKey(recipient))) || 0; } catch (e) { return 0; }
}
function plMarkMlucked(recipient, when) {
	try { set(plMluckedKey(recipient), when || Date.now()); }
	catch (e) { plLog('could not persist mluck watermark for ' + recipient, 'orange'); }
}
function plMluckDurationMs() {
	try { const d = parent.G.skills.mluck.duration; if (typeof d === 'number' && d > 0) return d; }
	catch (e) { }
	return 3600000;
}
/* Only ever consulted when the sender gave no needsMluck - see on_cm. The
   recipient's own view of its buff outranks this record every time. */
function mluckStillFresh(recipient) {
	const at = plMluckedAt(recipient);
	if (!at) return false;
	return (Date.now() - at) < (plMluckDurationMs() - CONFIG.mluck.refreshWithinMs);
}

/* Restored before the first poll, which is the whole point of persisting it. */
const PL_CURSOR_KEY = 'pl_cursor';
/* Loud on failure. A cursor that silently stops persisting brings the whole
   replay back with nothing to show for it - the failure mode this file has
   been bitten by twice now. */
function plSaveCursor(n) {
	try { set(PL_CURSOR_KEY, n); }
	catch (e) { plLog('could not persist the relay cursor (' + n + ') - a hop will replay the backlog', 'red'); }
}
try { plCursor = Number(get(PL_CURSOR_KEY)) || 0; } catch (e) { plCursor = 0; }
if (plCursor) plLog('resuming the relay at seq ' + plCursor + ' - no backlog replay', '#7FD98A');

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
	movement: {
		/* Hand-pinned approach chains, keyed 'map|x|y' of the DESTINATION, tried
		   by rageWaypoints before the search and refused if any of their own
		   points sit inside a rectangle. This one is the measured margin-12 route
		   from the spookytown spawn to the corridor park point: out west, down the
		   far side, then back east along y -1075..-1115. It is the operator's own
		   route - drawn on the map by hand before it was ever derived - and the
		   search now produces the same shape on its own, so this is insurance and
		   a saving of ~22,000 node expansions, not a crutch. */
		approaches: {
			'spookytown|290|-990': [
				[-450, -30], [-585, -45], [-715, -105], [-715, -115],
				[-585, -455], [-465, -670], [-465, -765], [-440, -910],
				[-295, -955], [115, -1075], [120, -1115], [270, -1115],
				[270, -1060]
			]
		},
	},
	scout: {
		// ON. The operator's standing preference, 2026-10-01: keep scouting
		// enabled and keep `parked` true. This REPLACES the earlier arrangement,
		// where a release carried these two at their defaults and the operator
		// flipped them by hand after deploying - `true` is the default now, so do
		// not reset it on a push. The comment this replaces said "OFF,
		// deliberately and temporarily" while the value next to it was already
		// true, which is the sort of line a later reader fixes the wrong way.
		// -> MerchantComments.md#enabled
		enabled: true,
		// PARKED - hold the party's home shard and never hop just to scout.
		// Standing preference 2026-10-01: keep this true, same as `enabled`.
		// -> MerchantComments.md#parked
		parked: false,
		bridge: 'http://127.0.0.1:8787',
		// earthiverse's ALData, the same feed the watchlist page defaults to. It
		// -> MerchantComments.md#aldata
		aldata: 'https://aldata.earthiverse.ca',
		// The game's own merchant feed. A CONFIRMER, never a denier - a stand
		// -> MerchantComments.md#gameFeed
		gameFeed: 'https://adventure.land/api/pull_merchants',
		// Nominal age stamped on every game-feed row, measured not chosen.
		// -> MerchantComments.md#gameFeedAgeSec
		gameFeedAgeSec: 128,
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
		/* Never publish a listing we just bought. The scan is captured BEFORE the
		   buying, which is the right order - the buy needs the data - so without
		   this the report advertises the slot we emptied. -> scoutRescanAfterBuy */
		rescanAfterBuy: true,
		// Where the stands are, as a box in world coordinates.
		// -> MerchantComments.md#standRegion
		standRegion: { minX: -250, maxX: 260, minY: -210, maxY: 190 },
		// Be home this long before an anniversary round starts. S.anniversary.next
		// -> MerchantComments.md#kissGuardMs
		kissGuardMs: 5 * 60 * 1000 + 10 * 1000,
		// Longest a single shard visit may take before the loop assumes it has
		// hung and takes its lock back. Generous: a hop alone can take 30s.
		maxCycleMs: 3 * 60 * 1000,
		skipServers: ['PVP'],
	},

	// ARBITRAGE - the agreed specification, recorded here so it lives with the
	// -> MerchantComments.md#arbitrage
	arbitrage: {
		// Source is the only switch. There is deliberately no runtime toggle:
		// one persisted in CODE storage would outlive a redeploy, so a build
		// pushed with this false could still be trading, which is the opposite
		// of what a kill switch is for. arbProbeBuild() reports the live value.
		enabled: true,
		// Belt and braces. Turning `enabled` on alone cannot spend gold: the
		// -> MerchantComments.md#dryRun
		dryRun: false,
		// Per ITEM, not per batch: a marginal item must not ride along on a good
		// one, which would quietly lower the floor.
		minProfit: 500000,
		// HARD reserve. gold - (everything this trade or batch will spend) must
		// still clear this, so a large purchase cannot leave the merchant broke.
		goldFloor: 10000000,
		/* Reserve price for the FALLBACK exit. arbFindBuyerFor used to take the
		   best bid on the board with no reference to what the goods cost. On
		   2026-09-22 that sold feather0 x331 - bought for 82,750,000 - into a
		   60,000 bid, for a net of -63,485,800. 1.0 means never realise a loss:
		   below it the goods are banked instead, which is already a supported
		   outcome with its own stranding breaker. */
		fallbackMinRecovery: 1.0,
		// Half of the NET profit is banked after each sale - not half the sale
		// value, so the capital spent on the item stays with the merchant and
		// only the gain is split. Never banked on a loss, and losses are not
		// carried forward against a later trade's share.
		bankShare: 0.5,
		// Below this much gold, one trade at a time. At or above it, batching is
		// -> MerchantComments.md#batchAboveGold
		batchAboveGold: 100000000,
		// A queued delivery/pickup older than this stops the NEXT trade from
		// starting. It never interrupts a trade already in flight: once gold is
		// spent, the item reaches a terminal state (sold or banked) first.
		jobPreemptMs: 10 * 60 * 1000,
		// A listing older than this is treated as gone rather than as an offer.
		// -> MerchantComments.md#sellMaxAgeSec
		sellMaxAgeSec: 7 * 60,
		/* Total sell attempts for ONE trade, across every buyer it is rerouted
		   to. Never reset by a reroute - that reset is what let a trade loop on
		   the same absent buyer for 29 minutes with attempts still reading 0. */
		/* How much dearer than planned a LIVE Ponty listing may be before the
		   trade is refused. The plan comes from a cached scan and his price is a
		   function of the item, so any drift means a different listing. */
		npcPriceDrift: 0.02,
		/* How long a vanished NPC listing is remembered, keyed by shard+vendor+
		   item+level. Sized against the bridge's own staleness: /ponty rows
		   measured 2026-10-06 at 363-941s old (median 440s), so a window under
		   ~8 min would expire before the scan that produced the dead row did.
		   -> arbNoteGone */
		goneForgetMs: 12 * 60 * 1000,
		maxSellAttempts: 4,
		/* And a wall clock over the top of it, because an attempt counter only
		   bounds the paths that increment it. Goods held longer than this are
		   banked whatever the market says: the gold is already spent, and the
		   merchant standing still is the larger cost. */
		sellDeadlineMs: 15 * 60 * 1000,
		// How close to get to a stand before trading. Not a measured limit - a
		// -> MerchantComments.md#approachUnits
		approachUnits: 350,
		// A listing this merchant has just traded against is suppressed for this
		// -> MerchantComments.md#usedCooldownMs
		usedCooldownMs: 20 * 60 * 1000,
		// First shelving for a counterparty whose route keeps failing before any
		// gold moves, doubling per consecutive failure. Two minutes is about one
		// feed refresh, so a seller genuinely back is retried almost at once, and
		// one never really there falls out rather than returning every 18s.
		failBackoffMs: 2 * 60 * 1000,
		failBackoffMaxMs: 60 * 60 * 1000,
		// How long after a hold expires the failure COUNT survives. Without it
		// the count resets as the hold lapses and escalation never escalates.
		failForgetMs: 2 * 60 * 60 * 1000,
		// Failures against one counterparty before it moves to the PERMANENT list.
		// The backoff ceiling is reached at 6, so 8 is two ceilings waited out.
		// Map changes inside the window before the same. 0 disables either.
		// -> MerchantComments.md#NEVER_TRADE_NAMES
		neverTradeAfter: 8,
		mapChurnLimit: 3,
		mapChurnWindowMs: 30 * 60 * 1000,
		mapChurnHoldMs: 60 * 60 * 1000,

		/* Unwinding ABANDONED stock. arbBankItem() banks goods no buyer would
		   take and arbHeldDrop()s them, so the executor forgot they existed.
		   minProfit is PROFIT AFTER TAX against what the goods actually cost,
		   not against vendor value. v61 compared to the vendor and closed three
		   of its first four recoveries at a loss, because stock gets abandoned
		   precisely when it was bought above the market that now exists.
		   Measured 2026-09-27 over 48 banked rows with a live buyer: the vendor
		   bar passed 29 of them for -29,373,824 realised, this one passes 9
		   for +15,109,489. -> MerchantComments.md#only-at-a-profit */
		stockRecovery: { enabled: true, minProfit: 100000, refreshMs: 10 * 60 * 1000 },
		// Consecutive trades that ended with an item banked rather than sold.
		// Past this the executor stops itself: each one has converted liquid
		// gold into stock, and a run of them means the market being traded
		// against is not the market on the board. Cleared by any completed sale.
		maxConsecutiveStrandings: 2,
		/* How long the self-stop lasts.

		   The breaker used to only set CONFIG.arbitrage.enabled = false, which is
		   in-memory - and change_server RELOADS THE PAGE, so the next shard hop
		   rebuilt CONFIG from the saved build and undid it. It tripped 18 times
		   across two days and never once stopped a trade. 71,981,480 went into
		   unsold stock behind it on 2026-09-23 alone.

		   The halt is now persisted, and bounded two ways so a stored stop can
		   never outlive its usefulness - which is what the "no runtime toggle for
		   enabled" rule was protecting against: it expires after this long, and
		   arbProbeHalt(false) clears it by hand.

		   A third bound used to sit here: the halt was ignored once MERCHANT_BUILD
		   changed, on the theory that a redeploy means the cause was fixed. It was
		   removed on 2026-09-25. It had never once run - MERCHANT_BUILD was frozen
		   at v27 from 2026-09-19 while the file reached v52, so the comparison was
		   always false - and the moment that string was corrected the clause would
		   have started clearing this breaker on EVERY deploy. The theory does not
		   hold either: deploys here mostly touch unrelated subsystems, so a stand
		   or gear change would have resumed an executor that stopped because the
		   market being traded against was not the market on the board. That is the
		   failure this breaker exists to stop, and it costs real gold - see the
		   71,981,480 above. arbProbeHalt(false) already expresses "I fixed it,
		   resume now" as a deliberate act rather than a side effect. */
		haltMs: 60 * 60 * 1000,
		/* Ceiling on what ONE trade may spend, per item. 0 or absent = uncapped.

		   slice_nightberry earned 5,560,000 on closed trades while stranding
		   62,100,000 on the same day, including a single 46,800,000 lot of 52 that
		   found no buyer at all. It is not a bad spread - it is a thin spread
		   bought in sizes this market cannot absorb. */
		itemCapitalCap: { slice_nightberry: 10000000 },
		// Tax applies ONLY to gold received from another ACCOUNT, and the
		// -> MerchantComments.md#taxBands
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

	// THE TOWN SPOT - one position that reaches five NPCs.
	// -> MerchantComments.md#townSpot
	/* The 3 s recall. Gated per leg - see the TOWN HOP block for the measured
	   reason a blanket smart.use_town is worse. margin is how many units the hop
	   must beat walking by before it is taken. */
	town: { enabled: true, margin: 40 },
	/* The summon wait. Meltymerch holds the move lock for waitMs so nothing
	   else walks him off the spot he just published; driftUnits is how far he
	   may be shifted by anything that bypasses the lock before he re-publishes. */
	summon: { waitMs: 60000, pollMs: 1000, driftUnits: 60 },
	townSpot: { name: 'town spot', map: 'main', x: -179, y: -72, radius: 60 },

	// A move lock older than this is abandoned, not busy - see moveLockHeld().
	moveLockMaxMs: 3 * 60 * 1000,

	deliveryAmount: 1000,
	restockBuffer: 500, // buy a bit past the delivery amount so stock doesn't immediately dip low again

	/* Top up while parked, rather than only when a request arrives.

	   ensureStock is reached from exactly one place - step 1 of a delivery
	   batch - so an empty job queue means no buying, however long he stands
	   next to Ernis. Measured 2026-09-27: parked at the town spot holding 176
	   hpot1 against a deliveryAmount of 1000, so the next hp request would
	   have paid for a shopping trip before anyone got a potion, from whatever
	   shard arbitrage had taken him to.

	   Gated on atTownSpot() rather than the home shard on purpose: Ernis is on
	   main on every shard and his gold travels with him, so an arbitrage stop
	   tops up just as well as being home.

	   target defaults to deliveryAmount + restockBuffer so it cannot drift
	   away from what a delivery actually needs.
	   -> MerchantComments.md#idleRestock */
	idleRestock: {
		enabled: true,
		everyMs: 5 * 60 * 1000,
		target: null,        // null = deliveryAmount + restockBuffer
		reserve: 1000000,    // never spend down past this
	},

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
	/* Materials that are never vendored and are banked on sight.
	   essenceofether is the reason this exists: it gates EIGHT craft recipes
	   (windbelt, scribeorb, moonshardearring and reunionbow at 4 each,
	   gloampendant 6, stormquiver 8, thundergrips 12, starcloak 40) and the
	   party has no reliable source - booboo drop it at 0.5% behind a rage box,
	   cutebee at 0.3709% but one spawn per 480,000 bees, and glitch/lglitch are
	   not in the deployed client data at all. rgoo in Goo Brawl at 1-in-10,784
	   is the only tap the party can currently reach. Vendoring one is throwing
	   away a gate, not a material.
	   It was never on selling.whitelist, so sellTrash was already safe - the
	   exposure was sellAggressivelyIfLowOnSpace, which vendors nearly anything
	   not explicitly protected. */
	materials: {
		/* Added 2026-10-10. The craft inputs for the two pieces the party is
		   actually chasing, so none of them may be vendored:
		     thundergrips  1x mrngloves+6, 80x stormfeather, 12x essenceofether
		     emberhood     1x mmhat+5, 1x embercore, 8x essenceoffire, 20x ashleaf
		   stormfeather is on the list to PROTECT it, not to buy it - the operator
		   holds 1,963 and farms them easily, so it is deliberately absent from
		   pontyBuy. ashleaf/embercore/essenceoffire are bought from PONTY ONLY and
		   are deliberately NOT in standBuy.items.

		   NOTE ON REACH: this list is consulted by the two sell guards only
		   (sellAggressivelyIfLowOnSpace and ssVendorBound). Arbitrage does not
		   read it - that is NO_TRADE_ITEM_NAMES, and putting these there would
		   also forbid BUYING them, which is the opposite of what is wanted. The
		   exposure that leaves is arbitrage flipping one, which was weighed and
		   accepted rather than overlooked. */
		keepAndBank: ['essenceofether', 'stormfeather', 'ashleaf', 'embercore', 'essenceoffire'],
	},

	selling: {
		enabled: true,
		// slice_blueberry was on this list until 2026-09-22. Arbitrage pays up to
		// 2,000,000 for one and the NPC pays 6, so vendoring it on sight was a
		// 300,000x loss waiting for the wrong moment.
		whitelist: ['gslime', 'seashell', 'reefglass', 'crabclaw', 'gem0'],

		// Nothing else in this script actively guards against Meltymerch's
		// -> MerchantComments.md#aggressiveEnabled
		aggressiveEnabled: true,
		aggressiveFreeSlotThreshold: 5,
	},

	// Self-sustain using his own hp potion stock.
	potions: {
		hpThreshold: 400,
	},

	// mluck requires level 40 - Meltymerch is 19 at time of writing, so this
	// -> MerchantComments.md#mluck
	mluck: {
		minLevel: 40,
		targets: ['Dexon'],
		/* How close to expiry our own cast has to be before a location message
		   that says nothing about the buff is worth a trip. Only reached when the
		   sender predates v62 and sends no needsMluck; a recipient that states its
		   need is believed either way. */
		refreshWithinMs: 10 * 60 * 1000,
	},

	/* PONTY BUY LIST - the tier-3 gear the operator wants picked up whenever it
	   turns up in Ponty's stock during the ordinary scan cycle. -> PONTY BUY */
	pontyBuy: {
		enabled: true,

		/* EDIT THIS. Item ids, any order, duplicates harmless - the set is
		   rebuilt on every pass, so a change from the console takes effect on the
		   next shard without a redeploy. Level is deliberately not part of the
		   rule: any level found is bought. */
		items: [
			// ranger
			'alloyquiver', 'fury', 'tshirt9', 'wingedboots', 'supermittens', 'ecape', 'suckerpunch',
			// priest
			'lmace', 'mshield', 'xhelmet', 'vattire', 'starkillers', 'mpxgloves', 'bcape',
			'mpxamulet', 'sbelt', 'rabbitsfoot', 'cearring', 'zapper',
			// mage
			'sparkstaff', 'mmhat', 'cring', //'jacko', too many durring halloween event
			// Cake
			'slice_mint', 'slice_blueberry', 'slice_citrus', 'slice_honey', 'slice_nightberry', 'slice_strawberry',
			// other
			'leather', 'mysterybox', 'weaponbox', 'armorbox','funtoken', 'anniversarygift', 'tracker', 'feather0', 'monstertoken', 'candy0', 'voidthread', 'essenceofether',
			// emberhood craft inputs - Ponty only, never from a player stand
			'ashleaf', 'embercore', 'essenceoffire',
			//upgrade
			'scroll3', 'scroll4', 'cscroll3', 'cscroll4', 'offeringp', 'offering', 'offeringx',
		],

		/* The operator's two stops, and nothing else. Both are tested before
		   EVERY purchase, because one buy can cross either line. */
		goldFloor: 50000000,     // never let a buy take on-hand gold below this
		stopAtFreeSlots: 3,      // stop while 3 or fewer inventory slots are free

		/* Optional per-item ceiling, id -> max gold. An id absent from here has
		   no ceiling, which is the operator's "any level, any price" default.
		   Ponty's price is calculate_item_value(item) x G.multipliers
		   .secondhands_mult, so it is a function of the item and its level, not a
		   seller's asking price. */
		maxPrice: {},

		/* 'always' | 'low' | 'never'. The bank trip happens AFTER the buying is
		   finished, never between two purchases, so a hop is never taken with the
		   list half-bought. */
		bankAfterBuy: 'always',
		bankWhenFreeSlotsBelow: 12,   // only consulted when bankAfterBuy is 'low'
	},

	/* STAND BUY LIST - the gear-plan pieces worth taking off another player's
	   stand when they are cheap enough. -> STAND BUY */
	standBuy: {
		enabled: true,

		/* A pasted buy freezes the rotation while it runs, and may cross a shard
		   to reach the listing. Both are v91; see sbBuyNow. */
		pendingMs: 600000,        // a stashed cross-shard buy older than this is dropped
		pendingResumeMs: 9000,    // settle time after the reload before resuming
		pendingMaxHops: 1,        // never hop twice chasing one listing

		/* EDIT THIS, exactly like pontyBuy.items above - ids, any order,
		   duplicates harmless, rebuilt on every pass so a console change takes
		   effect on the next scan without a redeploy. Seeded 2026-10-02 with the
		   intersection of GEAR_PROGRESSION and pontyBuy.items: 23 of those 43 ids
		   are gear-plan pieces, the other 20 (boxes, slices, scrolls, offerings,
		   tracker, leather, funtoken) are not and are deliberately absent. Level
		   is not part of the rule - any level at or under the cap is bought. */
		items: [
			// ranger
			'alloyquiver', 'fury', 'suckerpunch',
			// priest
			'lmace', 'mshield', 'xhelmet', 'vattire', 'bcape', 'mpxamulet',
			'mpxgloves', 'sbelt', 'rabbitsfoot',
			// mage
			'sparkstaff', 'mmhat', //'jacko', too many durring halloween event
			// shared by two or three of the three classes
			'cearring', 'cring', 'ecape', 'starkillers', 'supermittens', 'tshirt9',
			'wingedboots', 'zapper',
		],

		/* The operator's line, 2026-10-02: a listing above this is left alone.
		   Unlike Ponty's price this is a SELLER'S ASKING price - whatever they
		   typed, with no relation to calculate_item_value - so this ceiling is
		   doing real work rather than acting as a sanity check. */
		maxPrice: 1000000,
		maxPriceByItem: {},      // optional id -> gold, overrides maxPrice for that id

		goldFloor: 50000000,     // never let a buy take on-hand gold below this
		stopAtFreeSlots: 3,      // stop while 3 or fewer inventory slots are free

		/* Each purchase costs a walk to the seller and back, which Ponty's does
		   not, so a pass is bounded instead of draining every listing on the shard
		   in one go. Whatever is left is still there on the next scan. */
		maxPerPass: 3,
		skipAfterMissMs: 20 * 60 * 1000,   // don't re-walk a listing that just fell through

		dryRun: false,           // rehearse the whole pass, stopping short of trade_buy

		bankAfterBuy: 'always',  // 'always' | 'low' | 'never'
		bankWhenFreeSlotsBelow: 12,
	},

	stand: {
		map: 'main',
		// Candidates inside Merrit's valid zones (square: x -240..240, y -120..144;
		// southern aisle: x -88..88, y 144..360), spread out in case one spot
		// is blocked or too close to another player's stand. Tried in order.
		candidates: [
			// Town spot FIRST: inside Merrit's area, and 129.4 from the nearest fixed
			// NPC against a 40 clearance where (100,0) clears by only 2.8. Standing
			// here needs no walk at all. -> MerchantComments.md#town-spot-is-a-stand-spot
			{ x: -179, y: -72 },
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
		// tradeSlot is 1-INDEXED. It was 0, which is an equipment slot: every
		// ensureListing() call returned "cant_equip" and was swallowed by its
		// own catch, so this listing has never actually been placed.
		listing: { itemName: 'scroll0', tradeSlot: 16, price: 500, keepReserve: 100, maxListQuantity: 50 },
		// Minimum time a freshly opened stand is left alone. A teardown costs a
		// close, a slow clamped walk, and a reopen; below this threshold the
		// stand spends more time moving than standing.
		// -> MerchantComments.md#minDwellMs
		minDwellMs: 3 * 60 * 1000,
		// How often standLoop reconciles "idle and home and no stand" -> open one.
		reconcileMs: 4000,
	},

	// Vendor-bound goods shown on the stand instead of sold to an NPC.
	// -> see the STAND SALES block for the measured facts behind these.
	standSales: {
		enabled: false,   // DISABLED 2026-09-22: listed goods vanish on a shard hop, see CHANGELOG
		slots: [1, 2, 3, 4, 5],      // trade slots this feature owns (1-indexed)
		revalueEveryMs: 5 * 60 * 1000,
		undercutBy: 1,               // be the cheapest listing, by exactly this
		marketTimeoutMs: 6000,
		minFreeSlotsToUnlist: 2,     // unlisting CONSUMES an inventory slot
		maxOpsPerPass: 3,
	},

	// GEAR PROGRESSION - see the "GEAR PROGRESSION SYSTEM" section below for
	// the full table and logic. This just toggles/paces the loop.
	/* GEAR TRIPWIRE - refuses gear steps that are not worth doing.
	   -> MerchantComments.md#gearTripwire

	   mode: 'off'      nothing happens; gear behaves exactly as before (DEFAULT)
	         'observe'  every step is judged and logged, but nothing is blocked
	         'enforce'  blocked steps are skipped
	   Start in 'observe', read gearProbeTripwire(), then move to 'enforce'. */
	gearTripwire: {
		mode: 'off',
		partyInfoMaxAgeSec: 600,   // newparty_info older than this cannot judge "no improvement"
		marketMaxAgeSec: 1800,     // a price older than this is not used to block anything
		marketCacheMs: 120000,     // how long one market read is reused across candidates
		breakEvenGold: 10500000,   // measured 2026-09-25 for the offeringp route; see CHANGELOG v52
		logSize: 80,
	},

	gearProgression: {
		enabled: true,
		// 8000 was far too tight for a loop that walks to the town spot and back.
		// -> MerchantComments.md#gearPacing
		intervalMs: 30000,
		maxStepsPerVisit: 12,
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
	standOpenedAt: 0,       // when the current stand went up - drives standDwellHeld()
	travelling: 0,          // >0 while a move is in flight - a COUNTER, travel nests
	travellingSince: 0,     // when it first went >0; 0 when idle. Abandonment clock.
	standSuppressed: false, // set by hand to keep the stand down while idle at home
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
// -> MerchantComments.md#ensureStandClosed
// ============================================================================
async function ensureStandClosed() {
	// character.stand is the game's answer; state.standOpen only our note of it.
	// -> MerchantComments.md#character-stand-is-the-game
	if (!state.standOpen && !character.stand) return;
	try {
		await close_stand();
		state.standOpen = false;
	} catch (e) {
		console.error('close_stand failed:', e);
	}
}

// Where we are, in WORLD coordinates.
// -> MerchantComments.md#mPos
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

// Can we see the whole selling area from here?
// -> MerchantComments.md#mInTown
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

/* ============================================================================
   MOVEMENT - the only place this script moves the character.

   Every mover routes through here so two invariants hold:

     1. The stand is closed before real travel. The server clamps speed to 10 -
        a quarter pace - while player.p.stand is set, so travelling with it up
        is pure loss.
     2. state.travelling is held for the WHOLE duration of the move, not just
        its first instant. That is the half a close-before-move wrapper cannot
        give you, and it is what was actually broken. MEASURED 2026-09-25:
        travelToBank closed the stand correctly (spy caught the close) and
        something reopened it 1.2 seconds later, mid-walk, leaving him clamped
        at speed 10 for the whole trip to the bank.

   A COUNTER, not a boolean: travel nests - travelTo falls back to town() and
   then moves again - and a boolean would clear on the inner unwind while the
   outer move was still running.
   ============================================================================ */
function travelBegin() {
	state.travelling++;
	if (!state.travellingSince) state.travellingSince = Date.now();
}
function travelEnd() {
	state.travelling = Math.max(0, state.travelling - 1);
	if (!state.travelling) state.travellingSince = 0;
}

/* THE LOCK IS NOW REAL - travelBegin() only counted; nothing enforced it, and
   a second smart_move() REJECTS the one in flight. The loser fails fast with a
   TAGGED error. -> MerchantComments.md#the-lock-is-now-real */
function moveBusy() {
	const e = new Error('another move is already in flight');
	e.reason = 'move_busy';
	e.moveBusy = true;
	return e;
}

/* Held, or ABANDONED? Nothing but travelEnd() clears the counter and this file
   has no noHang(), so a never-settling await would wedge every mover for good.
   Past the ceiling: break it open and LOG, never silently.
   -> MerchantComments.md#the-lock-is-now-real */
function moveLockHeld() {
	if (state.travelling <= 0) return false;
	const since = state.travellingSince || 0;
	const held = since ? Date.now() - since : 0;
	if (since && held > (CONFIG.moveLockMaxMs || 180000)) {
		game_log(`move lock held ${Math.round(held / 1000)}s with nothing to clear it - forcing through`, 'red');
		state.travelling = 0;
		state.travellingSince = 0;
		return false;
	}
	return true;
}


// ============================================================================
// RAGE BOXES - the geometry the farm scorer did not know about
//
// G.maps[map].monsters[i] can carry a `rage` rectangle beside its `boundary`.
// Measured 2026-10-09 in the live client, on spookytown:
//   mummy  boundary [31,-1571,480,-1293]  rage [-124,-1631,614,-1130]  (a halo
//          130-165 units larger than the spawn)
//   booboo boundary [286,-842,544,-562]   rage IDENTICAL to the boundary
//   booboo boundary [-820,-940,-570,-630] rage IDENTICAL to the boundary
//   stoneworm, mrgreen, jr - no rage field at all.
// Stepping inside one aggros the whole pack AND applies the monster's own
// `rage` multiplier, 1.5 for both: booboo's listed attack of 220 lands for
// ~352, and nine at once is ~3,800 dps into a 7,263 hp ranger.
//
// This is not theory. scoreAllFarmSpots() returns the spawn-boundary CENTRE, so
// an override on booboo resolved to (415,-702) - dead centre of the rage box.
// Measured the same day: three deaths, zero kills, the spawn never reached, and
// travelState left inFlight with failures: 0 because death kept interrupting
// the route. The monster was never the problem; the standing point was.
//
// Nothing here restricts movement OUTSIDE a rectangle. Closing, backing off and
// regrouping are all untouched - the rectangle is the only thing that is solid.
// ============================================================================

/* Dexon owns the knob. The followers have no CONFIG.achievements of their own,
   so without this, raising concurrent in Ranger.js would leave the priest and
   mage still gated at 1 - and the mage is the only one who can pull a mummy, so
   the throttle would land exactly where it hurts. Broadcast with the farm spot;
   null everywhere it has not arrived, which leaves the local default alone. */

let ragePullShared = null;

function rageCfg() {
	const a = (typeof CONFIG !== 'undefined' && CONFIG.achievements && CONFIG.achievements.pull) || {};
	return {
		enabled: a.enabled !== false,
		/* THE KNOB. How many of the target monsters may be in flight at once.
		   1 is the proven-safe start. Raise it as the farm earns trust: the only
		   other gate is courage, which stops a pull when this character already
		   has its own limit of attackers. Nothing else in here assumes 1. */
		concurrent: Math.max(1, ragePullShared || a.concurrent || 1),
		/* MEASURED 2026-10-09, and the single reason the party never arrived.
		   rageRoute excludes cells within margin + step of a rectangle, so 30
		   with a step of 25 was really demanding 55 units of clearance. The
		   corridor's entrance is a PINCH: an A* at step 5 from the spawn reaches
		   (290,-990) at margin 14 and fails at 18, so the gap is 14-18 wide and
		   55 never had a chance. 4 + 5 = 9 does, with 5 units of headroom.
		   8 + 5 = 13 was tried first and FAILED against the live map: the grid is
		   anchored at the search window's corner, not at the origin, so with only
		   13..18 of usable band no lattice point landed inside it. Verified live
		   at the shipped anchoring: gm 13 does not reach the park point, gm 9
		   does, in 29,443 expansions. Keep margin + step at or below 9 for this
		   corridor. The operator proved the route by hand first, walking MageofOz
		   through the pinch with about 5 units to spare. */
		margin: (typeof a.margin === 'number') ? a.margin : 4,
		/* 5, not 25. A 10-unit grid cannot resolve a 14-unit gap: the same search
		   that succeeds at step 5 reports NO ROUTE at step 10 at every margin,
		   which is what made a passable corridor look like a sealed pocket and
		   sent me hunting for standoff spots that were never needed. */
		step: a.step || 5,
		/* Big enough that step 5 survives. The budget is spent BEFORE the grid is
		   built - too small and the doubling loop below pushes the step back to 20
		   and silently undoes the fix. Spookytown at step 5 is ~131,000 cells. */
		maxCells: a.maxCells || 200000,
		/* HYSTERESIS, and the reason nothing could move even when the route was
		   fine. The guard used to trip on the same margin the planner aims for,
		   so arriving at a correctly-planned spot WAS a breach: it stopped and
		   shoved the character out, travel walked back, forever. Measured on the
		   stuck party: 11 stop/xmove pairs in 5 seconds out of rageGuard, every
		   smart_move dying as "interrupted", hp full and targets 0 - no attacker
		   anywhere near it. The guard now fires only on a real breach of the
		   rectangle and escapes out to margin, leaving a full margin of slack
		   between "safe to stand here" and "get out now". */
		guardMargin: (typeof a.guardMargin === 'number') ? a.guardMargin : 0,
		parkWithin: a.parkWithin || 45,
		pullTimeoutMs: a.pullTimeoutMs || 20000,
		repullGapMs: (typeof a.repullGapMs === 'number') ? a.repullGapMs : 1200,
		respectCourage: a.respectCourage !== false,
		/* Interruptions are combat, not routing, so they get their own budget. */
		maxInterrupts: (typeof a.maxInterrupts === 'number') ? a.maxInterrupts : 12,
	};
}

function rageLog(m, c) {
	try { game_log('[rage] ' + m, c || '#FF9F6B'); } catch (e) { }
	console.log('[rage] ' + m);
}

/* Every rage rectangle on a map. Returns [] for a map with none, which is what
   makes all of this free everywhere else. */
function rageBoxes(map) {
	const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : (typeof G !== 'undefined' ? G : null);
	const m = g && g.maps && g.maps[map];
	if (!m || !Array.isArray(m.monsters)) return [];
	const out = [];
	for (const s of m.monsters) {
		const r = s && s.rage;
		if (Array.isArray(r) && r.length === 4) out.push({ type: s.type, r: r, boundary: s.boundary || null });
	}
	return out;
}

/* The box this point is in, inflated by margin, or null. */
function rageHit(map, x, y, margin) {
	const m = (typeof margin === 'number') ? margin : rageCfg().margin;
	const boxes = rageBoxes(map);
	for (let i = 0; i < boxes.length; i++) {
		const r = boxes[i].r;
		if (x >= r[0] - m && x <= r[2] + m && y >= r[1] - m && y <= r[3] + m) return boxes[i];
	}
	return null;
}

/* Does the straight line a->b clip any rectangle? Sampled, not analytic: the
   sample spacing is 15 units against rectangles 250 units on a side, so it
   cannot step over one. */
function rageClips(map, ax, ay, bx, by, margin) {
	if (!rageBoxes(map).length) return null;
	const n = Math.max(8, Math.min(160, Math.ceil(Math.hypot(bx - ax, by - ay) / 15)));
	for (let i = 0; i <= n; i++) {
		const t = i / n;
		const hit = rageHit(map, ax + (bx - ax) * t, ay + (by - ay) * t, margin);
		if (hit) return hit;
	}
	return null;
}

/* Nearest point outside every rectangle. Re-checks after each push, because
   leaving one box can put you inside another. */
function rageEscape(map, x, y, margin) {
	const m = (typeof margin === 'number') ? margin : rageCfg().margin;
	let px = x, py = y;
	for (let guard = 0; guard < 5; guard++) {
		const b = rageHit(map, px, py, m);
		if (!b) return { x: px, y: py };
		const r = b.r;
		const outs = [
			{ x: r[0] - m - 2, y: py }, { x: r[2] + m + 2, y: py },
			{ x: px, y: r[1] - m - 2 }, { x: px, y: r[3] + m + 2 },
		];
		outs.sort((p, q) => Math.hypot(p.x - px, p.y - py) - Math.hypot(q.x - px, q.y - py));
		px = outs[0].x; py = outs[0].y;
	}
	return { x: px, y: py };
}

/* A walkable route from->to that never enters a rectangle. BFS on a coarse grid
   with the rectangles treated as solid, then greedily simplified so EVERY leg
   is verified straight-line can_move-clear. That last property is the point:
   the legs get walked with xmove, so smart_move's pathfinder - which knows
   nothing about rage boxes and would happily cut the corner through one, the
   interior being ordinary open ground - is taken out of the loop entirely.
   Measured on spookytown: 4 ms. Returns null when there is no safe route, which
   is a refusal to travel rather than a licence to walk through. */
function rageRoute(map, from, to, margin) {
	if (typeof can_move !== 'function') return null;
	const cfg = rageCfg();
	const m = (typeof margin === 'number') ? margin : cfg.margin;
	const boxes = rageBoxes(map);
	if (!boxes.length) return null;

	let x0 = Math.min(from.x, to.x), x1 = Math.max(from.x, to.x);
	let y0 = Math.min(from.y, to.y), y1 = Math.max(from.y, to.y);
	for (const b of boxes) {
		x0 = Math.min(x0, b.r[0]); x1 = Math.max(x1, b.r[2]);
		y0 = Math.min(y0, b.r[1]); y1 = Math.max(y1, b.r[3]);
	}
	const PAD = 280;
	x0 -= PAD; x1 += PAD; y0 -= PAD; y1 += PAD;
	/* Clamp to the map. Without this the flood walks off the edge - can_move is
	   perfectly happy to answer for points outside the geometry - and spends the
	   whole cell budget in the void. Measured: an unclamped A* to the park point
	   expanded 400,000 nodes on a map holding only ~19,000 at step 20 and found
	   nothing; clamped, the same search exhausts honestly in 12,164. */
	try {
		const geo = G.geometry[map];
		if (geo) {
			x0 = Math.max(x0, geo.min_x); x1 = Math.min(x1, geo.max_x);
			y0 = Math.max(y0, geo.min_y); y1 = Math.min(y1, geo.max_y);
		}
	} catch (e) { }

	let step = cfg.step;
	while (((x1 - x0) / step + 1) * ((y1 - y0) / step + 1) > cfg.maxCells) step *= 2;
	const W = Math.floor((x1 - x0) / step) + 1, H = Math.floor((y1 - y0) / step) + 1;
	const base = character.base;
	const stand = (x, y) => { try { return !!can_move({ map: map, x: x, y: y, going_x: x, going_y: y, base: base }); } catch (e) { return false; } };
	const seg = (a, b) => { try { return !!can_move({ map: map, x: a[0], y: a[1], going_x: b[0], going_y: b[1], base: base }); } catch (e) { return false; } };

	/* The grid is tested at cell CENTRES, so two adjacent open centres can still
	   have a segment between them that clips a corner of the rectangle - both
	   endpoints outside a convex shape does not put the line outside it. Caught
	   by the harness: a leg into (550,-886) grazed the booboo box. Rejecting
	   cells within m + step of a rectangle buys a full cell of clearance, which
	   is more than any single 8-connected step can cross. The CLIP checks below
	   still use the configured margin, so the route is verified against the real
	   boundary rather than the padded one. */
	const gm = m + step;
	const grid = new Uint8Array(W * H);
	for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
		const x = x0 + i * step, y = y0 + j * step;
		grid[j * W + i] = (!rageHit(map, x, y, gm) && stand(x, y)) ? 1 : 0;
	}
	const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
	const cellOf = (p) => [clamp(Math.round((p.x - x0) / step), W - 1), clamp(Math.round((p.y - y0) / step), H - 1)];
	/* The start may be blocked - we could be standing in a box right now, which
	   is exactly the case this has to recover from - so seed from the nearest
	   open cell instead of giving up. */
	const nearestOpen = (c) => {
		if (grid[c[1] * W + c[0]]) return c;
		for (let rad = 1; rad < 14; rad++) {
			for (let di = -rad; di <= rad; di++) for (let dj = -rad; dj <= rad; dj++) {
				if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
				const ni = c[0] + di, nj = c[1] + dj;
				if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
				if (grid[nj * W + ni]) return [ni, nj];
			}
		}
		return null;
	};
	const S = nearestOpen(cellOf(from)), Gl = nearestOpen(cellOf(to));
	if (!S || !Gl) return null;

	const prev = new Int32Array(W * H).fill(-1);
	const seen = new Uint8Array(W * H);
	const q = [S[1] * W + S[0]];
	seen[q[0]] = 1;
	const goal = Gl[1] * W + Gl[0];
	/* FOUR-connected, on NODES only.
	   An earlier version also verified every EDGE with can_move, to stop the
	   simplifier emitting a leg nothing had checked. That was the right worry
	   and the wrong tool: can_move's SEGMENT test is far stricter than its POINT
	   test, so checking every 25-unit edge fragments the graph. Measured live on
	   spookytown, from the (0,0) spawn to the corridor park point:
	     4-connected + edge checks   1,030 cells reachable   park point NOT reached
	     8-connected + edge checks     999                   NOT reached
	     4-connected, nodes only     5,301                   reached
	     8-connected, nodes only     5,504                   reached
	   Connectivity and margin made no difference; the edge check alone did it.
	   rageRoute returned null, safeSmartMove threw, and the party sat at the
	   spawn through 41 consecutive travel failures. Walkability is now settled
	   per LEG in rageWalk, which is where the legs are actually walked: a leg
	   can_move clears goes to xmove, and one it does not goes to smart_move,
	   whose pathfinder handles terrain. Dropping diagonals stays, because it
	   removes corner-cutting by construction and the simplifier straightens the
	   path afterwards. */
	const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
	let found = false, head = 0;
	while (head < q.length) {
		const cur = q[head++];
		if (cur === goal) { found = true; break; }
		const ci = cur % W, cj = (cur - ci) / W;
		for (let d = 0; d < 4; d++) {
			const ni = ci + D[d][0], nj = cj + D[d][1];
			if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
			const nk = nj * W + ni;
			if (seen[nk] || !grid[nk]) continue;
			seen[nk] = 1; prev[nk] = cur; q.push(nk);
		}
	}
	if (!found) return null;

	const raw = [];
	for (let k = goal; k !== -1; k = prev[k]) {
		const ci = k % W, cj = (k - ci) / W;
		raw.push([x0 + ci * step, y0 + cj * step]);
	}
	raw.reverse();

	const out = [raw[0]];
	let i = 0;
	while (i < raw.length - 1) {
		let best = i + 1;
		for (let j = raw.length - 1; j > i; j--) {
			if (seg(raw[i], raw[j]) && !rageClips(map, raw[i][0], raw[i][1], raw[j][0], raw[j][1], m)) { best = j; break; }
		}
		if (best === i + 1 && rageClips(map, raw[i][0], raw[i][1], raw[best][0], raw[best][1], m))
			rageLog('route leg ' + i + ' grazes a rectangle - the grid clearance should have prevented this', 'red');
		out.push(raw[best]); i = best;
	}
	return out;
}

function rageWaypoints(map, to, margin) {
	const mv = (typeof CONFIG !== 'undefined' && CONFIG.movement) || {};
	const key = map + '|' + Math.round(to.x) + '|' + Math.round(to.y);
	const hand = (mv.approaches || {})[key];
	if (Array.isArray(hand) && hand.length) {
		const bad = hand.filter((p) => rageHit(map, p[0], p[1], margin));
		if (!bad.length) return hand.concat([[to.x, to.y]]);
		rageLog('ignoring the hand-pinned approach for ' + key + ' - ' + bad.length + ' of its points sit inside a rectangle', 'orange');
	}
	return rageRoute(map, { x: character.x, y: character.y }, to, margin);
}

async function rageWalk(map, to, margin, attempts) {
	if (typeof xmove !== 'function') { rageLog('xmove is not a function here - cannot walk a safe route', 'red'); return false; }
	const cfg = rageCfg();
	const max = attempts || 4;
	const maxInterrupts = cfg.maxInterrupts;
	const near = (p) => Math.hypot(character.x - p[0], character.y - p[1]) < 12;
	const base = character.base;
	const legClear = (a, b) => {
		if (typeof can_move !== 'function') return false;
		try { return !!can_move({ map: map, x: a[0], y: a[1], going_x: b[0], going_y: b[1], base: base }); }
		catch (e) { return false; }
	};
	const pause = (ms) => new Promise((r) => setTimeout(r, ms));
	/* Anything else steering us is a second driver on the same wheel: smart.moving
	   was measured true throughout the stranded trip. */
	try { if (typeof stop === 'function') stop(); } catch (e) { }
	rageNav.busy = true;
	let interrupts = 0;
	try {
		for (let a = 0; a < max; a++) {
			if (near([to.x, to.y])) return true;
			const wp = rageWaypoints(map, to, margin);
			if (!wp || !wp.length) return false;          // genuinely no route
			let blocked = false;
			const was = [character.x, character.y];
			for (let i = 0; i < wp.length; i++) {
				if (near(wp[i])) continue;
				const from = [character.x, character.y];
				try {
					/* A leg can_move clears is walked directly, which keeps the
					   pathfinder out of it. One it does not clear is handed to
					   smart_move: both ends are already margin-clear of every
					   rectangle and the leg is short, so there is nowhere for it to
					   wander, and rageGuard is still watching. */
					if (legClear(from, wp[i])) await xmove(wp[i][0], wp[i][1]);
					else await smart_move({ map: map, x: wp[i][0], y: wp[i][1] });
				} catch (e) {
					const why = String((e && (e.reason || e.message)) || e);
					/* An interruption is COMBAT, not a bad route. Measured on the
					   desertland leg: 4 attackers against courage 2, the move
					   rejected as "interrupted", and the character pinned in place.
					   Spending a route attempt on that is how a walk through
					   contested ground exhausts its budget without ever being
					   wrong about the route. */
					if (/interrupt/i.test(why) && interrupts < maxInterrupts) {
						interrupts++;
						await pause(500);
						i--;
						continue;
					}
					blocked = true;
					rageLog('leg ' + (i + 1) + '/' + wp.length + ' refused (' + why + ') - re-planning', '#8b98ab');
					break;
				}
			}
			if (!blocked) return true;
			/* Gaining no ground is worth saying, but it is NOT a reason to stop:
			   an obstruction can be another character or a monster standing in the
			   way for a moment. The attempt cap is what bounds this - an earlier
			   version returned false the first time a leg failed before any had
			   succeeded, which made every transient block permanent. */
			if (Math.hypot(character.x - was[0], character.y - was[1]) < 1)
				rageLog('no ground gained on attempt ' + (a + 1) + ' of ' + max, '#8b98ab');
		}
		if (!near([to.x, to.y]))
			rageLog('gave up after ' + max + ' attempts' + (interrupts ? ' and ' + interrupts + ' interruptions' : '')
				+ ', ' + Math.round(Math.hypot(character.x - to.x, character.y - to.y)) + ' units short', 'orange');
		return near([to.x, to.y]);
	} finally {
		rageNav.busy = false;
	}
}

const rageNav = { busy: false };

/* The one mover everything else calls. Refuses to enter a rectangle, and routes
   around one rather than through it. Falls straight through to xmove on a map
   with no rage boxes, which is every map but spookytown today. */
async function safeMove(x, y) {
	if (typeof xmove !== 'function') return;
	const map = character.map;
	const cfg = rageCfg();
	if (!cfg.enabled || !rageBoxes(map).length) return xmove(x, y);

	if (rageHit(map, x, y, cfg.margin)) {
		const e = rageEscape(map, x, y, cfg.margin);
		x = e.x; y = e.y;
	}
	if (rageClips(map, character.x, character.y, x, y, cfg.margin)) {
		const ok = await rageWalk(map, { x: x, y: y }, cfg.margin);
		if (!ok) rageLog('no safe route to ' + Math.round(x) + ',' + Math.round(y) + ' - staying put', 'orange');
		return;
	}
	return xmove(x, y);
}

/* Containment. The net for everything no route planning can cover: a respawn
   somewhere unexpected, knockback, being dragged by a pull, or any routine that
   moved us before this existed. Runs first in mainLoop. */
async function rageGuard() {
	const cfg = rageCfg();
	if (!cfg.enabled) return false;
	let hit = null;
	/* cfg.guardMargin, NOT cfg.margin - see the note on guardMargin in rageCfg.
	   Detect on the real rectangle; escape out to the planner's margin. Using
	   one number for both is what pinned the party in place for a whole run. */
	try { hit = rageHit(character.map, character.x, character.y, cfg.guardMargin); } catch (e) { return false; }
	if (!hit) return false;
	rageLog('inside the ' + hit.type + ' rage box at ' + Math.round(character.x) + ',' + Math.round(character.y) + ' - leaving now', 'red');
	try { if (typeof stop === 'function') stop(); } catch (e) { }
	const e2 = rageEscape(character.map, character.x, character.y, cfg.margin);
	if (typeof xmove === 'function') {
		try { await xmove(e2.x, e2.y); } catch (err) { rageLog('escape move failed: ' + (err && err.message || err), 'red'); }
	}
	return true;
}

/* A map spawn point known to be outside every rectangle, used as the landing
   spot for a cross-map trip so the arrival itself cannot be inside a box.
   spookytown's first spawn is (0,0), clear of all three. */
function rageStaging(map) {
	const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	const sp = g && g.maps && g.maps[map] && g.maps[map].spawns;
	if (!Array.isArray(sp)) return null;
	for (const s of sp) {
		if (!Array.isArray(s) || typeof s[0] !== 'number' || typeof s[1] !== 'number') continue;
		if (!rageHit(map, s[0], s[1], rageCfg().margin)) return { x: s[0], y: s[1] };
	}
	return null;
}

// ============================================================================
// TOWN HOP - the 3 second recall, used only on the legs where it beats walking
// ============================================================================
/* MEASURED 2026-10-10, from the server source and the live tables.

   use_town channels for 3,000 ms and teleports to spawns[0] of the CURRENT map.
   Cooldown 0. The server refuses to start it when targets > 5, inside a
   generated instance, in jail, or when the character cannot walk.

   TWO THINGS THAT ARE NOT OBVIOUS, AND BOTH MATTER.

   One: a SINGLE monster hit cancels it. In the monster-attacks-player branch
   `target.c = {}` sits OUTSIDE the lethal-damage check, so any hit of any size
   ends the channel - and the client's town() cannot tell, because it waits only
   for character.c.town to clear and that happens on cancellation too:
       for (var i = 0; character.c.town && i < 10000; i++) await sleep(1);
       return { success: true };
   It reports success either way. Nothing here trusts that resolution; arrival
   is decided by looking at where the character actually ended up.

   Two: the server lets you WALK while channeling - its move handler gates on
   can_walk(), which tests is_disabled() and not c.town - but smart_move will
   not, because its step loop requires !is_transporting(character) and
   is_transporting() returns true on c.town. So the walk-along below is driven
   with raw move(). That is the operator's design, and it makes a cancelled
   channel free: instead of 3 s standing still, the character is 3 s * speed
   further along the road it was going to walk anyway. It does not change the
   success case - the teleport still fires at 3 s and discards the walking - so
   the gate below is still needed.

   WHERE IT PAYS, for Meltymerch at speed 67, on the trip home from the combat
   party's corridor. spookytown has no door to main; the chain is
   spookytown -> halloween -> main, entering main at spawn 15 (1600,-524):

     leg                                     walk     town()    saving
     spookytown corridor -> halloween door   36.6s     24.6s    +12.0s
     halloween entry     -> main door        19.1s     21.2s     -2.1s
     main entry          -> town spot        27.4s      5.9s    +21.5s
     whole trip home                         83.1s     49.7s    +33.5s

   The halloween leg is why this is gated per leg instead of setting
   smart.use_town once. That flag pushes the teleport into the pathfinder as a
   single graph step with no cost attached, so the planner cannot see that it
   costs 3 s and would take that leg too, handing back 2.1 s. Note also that
   smart.use_town is a persistent global on the `smart` object, NOT an argument
   - smart_move reads only x, y, map and to from what it is passed.

   Distances are straight-line, so the savings are floors: the walking legs
   curve around terrain and the recall leg does not. */

const TOWN_CHANNEL_MS = 3000;

function townCfg() {
	const a = (typeof CONFIG !== 'undefined' && CONFIG.town) || {};
	return {
		enabled: a.enabled !== false,
		channelMs: a.channelMs || TOWN_CHANNEL_MS,
		/* A FLOOR IN SECONDS, not units. v85 shipped 40 units - 0.6 s at speed
		   67 - and the merchant promptly took a hop the log priced at "about
		   2.3s better than walking", mid-route, and lost the path. Straight-line
		   distance to the goal is not monotonic along a real route: the
		   pathfinder walks AWAY from the goal to get around terrain, so small
		   positive readings are noise. 5 s cleanly separates the two legs worth
		   taking (17.5 s and 21.5 s) from everything else. */
		minSaveSec: (typeof a.minSaveSec === 'number') ? a.minSaveSec : 5,
		stepUnits: a.stepUnits || 120,
		pollMs: a.pollMs || 150,
		/* How often the watcher re-prices the hop while smart_move drives. */
		watchMs: a.watchMs || 400,
		/* A cancelled hop leaves us still worth-it, so bound the retries rather
		   than channelling into the same monster over and over. */
		minGapMs: (typeof a.minGapMs === 'number') ? a.minGapMs : 6000,
		maxPerMap: a.maxPerMap || 2,
	};
}

/* Per-map attempt bookkeeping, reset at the start of each trip. */
const townTries = {};

function townLog(m, c) {
	try { game_log('[town] ' + m, c || '#8EC8FF'); } catch (e) { }
	console.log('[town] ' + m);
}

function townG() { return (typeof parent !== 'undefined' && parent.G) ? parent.G : null; }

/* Where the recall lands: spawns[0] of the map we are on. */
function townSpawn(map) {
	const g = townG();
	const s = g && g.maps[map] && g.maps[map].spawns && g.maps[map].spawns[0];
	if (!Array.isArray(s) || typeof s[0] !== 'number') return null;
	return { x: s[0], y: s[1] };
}


/* SAME MAP ONLY. v85 also priced a leg we were not on yet, using a BFS of the
   door graph to guess which door we would leave by. Two things went wrong with
   that and both are visible in the live log. The BFS chain need not match the
   one smart_move picks - main alone has three separate mtunnel doors - and the
   walk-along then drives raw move() toward a door the route was never going to
   use, which is how the merchant ended up stuck on mtunnel. Pricing against the
   real destination is unambiguous, and it still catches the two legs that
   matter: arriving on main 1,836 units from the town spot (+21.5 s) and
   arriving on spookytown 2,408 units from the corridor (+17.5 s). The forgone
   case is the corridor -> halloween-door leg on the way home, worth 12 s, which
   is not worth guessing a door chain for. */
function townGoal(targetMap, tx, ty) {
	if (character.map !== targetMap) return null;
	if (typeof tx !== 'number' || typeof ty !== 'number') return null;
	return { x: tx, y: ty };
}

/* Is the recall actually faster from here? Returns the numbers so the log can
   say why; null when walking wins. */
function townWorthIt(targetMap, tx, ty) {
	const cfg = townCfg();
	if (!cfg.enabled) return null;
	if (typeof town !== 'function' || typeof move !== 'function') return null;
	if (character.rip || (character.c && character.c.town)) return null;
	if ((character.targets || 0) > 5) return null;   // the server answers cant_escape
	const tried = townTries[character.map];
	if (tried && (tried.n >= cfg.maxPerMap || Date.now() - tried.at < cfg.minGapMs)) return null;
	const sp = townSpawn(character.map);
	const goal = townGoal(targetMap, tx, ty);
	if (!sp || !goal) return null;
	// Never recall INTO a rectangle - the spawn is a fixed point, so this is cheap.
	if (rageHit(character.map, sp.x, sp.y, rageCfg().margin)) return null;
	/* A rage-managed walk is deliberately heading away from the goal to get
	   round a rectangle - the western approach to the corridor is the extreme
	   case - so its straight-line distance is meaningless to this comparison. */
	if (typeof rageNav !== 'undefined' && rageNav && rageNav.busy) return null;
	const speed = character.speed || 55;
	const here = Math.hypot(character.x - goal.x, character.y - goal.y);
	const after = Math.hypot(sp.x - goal.x, sp.y - goal.y);
	const channel = (cfg.channelMs / 1000) * speed;  // the 3 s, priced in units
	const saves = here - (after + channel);
	if (saves <= cfg.minSaveSec * speed) return null;
	return { goal: goal, sp: sp, here: here, after: after, channel: channel, saves: saves, speed: speed };
}

/* One step of the walk-along. Raw move(), because smart_move will not step
   while is_transporting() is true. Never into a rectangle, never through one. */
async function townWalkStep(goal) {
	const cfg = townCfg();
	const dx = goal.x - character.x, dy = goal.y - character.y;
	const d = Math.hypot(dx, dy);
	if (!d) return;
	const step = Math.min(cfg.stepUnits, d);
	const nx = character.x + (dx / d) * step, ny = character.y + (dy / d) * step;
	const m = character.map, margin = rageCfg().margin;
	if (rageHit(m, nx, ny, margin)) return;
	if (rageClips(m, character.x, character.y, nx, ny, margin)) return;
	if (typeof can_move === 'function') {
		try {
			if (!can_move({ map: m, x: character.x, y: character.y, going_x: nx, going_y: ny, base: character.base })) return;
		} catch (e) { return; }
	}
	try { move(nx, ny); } catch (e) { }
}

/* Fire the recall and walk the road at the same time. Returns whether we ended
   up at the spawn, decided by POSITION - town() resolves the same way whether
   it landed or was cancelled. */
async function townHop(w) {
	const cfg = townCfg();
	townLog('recall on ' + character.map + ' from ' + Math.round(character.x) + ',' + Math.round(character.y)
		+ ' - about ' + (Math.round(w.saves / w.speed * 10) / 10) + 's better than walking', '#8EC8FF');
	const tr = townTries[character.map] || (townTries[character.map] = { n: 0, at: 0 });
	tr.n++; tr.at = Date.now();
	try {
		const p = town();
		if (p && typeof p.catch === 'function') p.catch(function () { });
	} catch (e) { return false; }
	const deadline = Date.now() + cfg.channelMs + 2500;
	while (Date.now() < deadline) {
		if (!character.c || !character.c.town) break;
		await townWalkStep(w.goal);
		await sleep(cfg.pollMs);
	}
	const landed = Math.hypot(character.x - w.sp.x, character.y - w.sp.y) < 100;
	if (!landed) townLog('recall cancelled - already walking, carrying on', 'orange');
	return landed;
}

/* The trip is driven by ONE smart_move, exactly as before this change; the
   recall rides alongside it.

   An earlier version of this staged the trip leg by leg over a BFS of the door
   graph, on the belief that a single cross-map smart_move would walk past the
   main-entry hop - the biggest of the three - because it only becomes visible
   after arriving on main. That belief was WRONG, and the operator caught it.
   Firing the skill does not disturb a smart_move in flight, for three reasons
   checked in the client source:

     - town() and use("town") reach request("town","town") and touch nothing on
       the `smart` object. smart.moving and smart.plot are untouched.
     - smart_move's step loop gates on !is_transporting(character), and
       is_transporting() is true while c.town is set, so it merely PAUSES for
       the channel instead of failing.
     - after the teleport the next plot point fails can_move_to() from the
       spawn, so the loop takes its `path_lost` branch and re-issues
       smart_move to the same destination with the same on_done - it re-plans
       itself from the new position and the original promise still resolves.

   So the watcher below just re-prices the hop every watchMs while smart_move
   drives, and takes it whenever the gate turns true - before departure, and
   again on each new map as it is entered. This keeps smart_move's own route
   choice, which the staging version was overriding with a door BFS for no
   good reason.

   v86: the hop is now priced ONLY against the real destination on the map we
   are standing on, and only once per map arrival. v85 did neither, and the
   merchant ended up stuck on mtunnel - see townGoal and townTravel. */
async function townTravel(spec) {
	const cfg = townCfg();
	if (!cfg.enabled || !spec || typeof spec !== 'object') return safeSmartMove(spec);
	if (typeof spec.x !== 'number' || typeof spec.y !== 'number') return safeSmartMove(spec);
	const targetMap = spec.map || character.map;
	for (const k in townTries) delete townTries[k];
	let done = false;
	/* ON ARRIVAL, NEVER MID-WALK. v85 re-priced every watchMs while smart_move
	   drove, and took any hop that read positive. Straight-line distance to the
	   goal rises and falls along a real route, so that fires on noise - measured
	   live at "about 2.3s better than walking" - and a teleport mid-route forces
	   a path_lost re-plan that can land somewhere else entirely. The poll now
	   only watches for the map to CHANGE; the decision is made once per map,
	   which is what the straight-line comparison is actually valid for. */
	let priced = null;
	const watcher = (async () => {
		while (!done) {
			try {
				if (character.map !== priced) {
					priced = character.map;
					const w = townWorthIt(targetMap, spec.x, spec.y);
					if (w) await townHop(w);
				}
			} catch (e) { townLog('watcher: ' + ((e && e.message) || e), 'orange'); }
			if (done) break;
			await sleep(cfg.watchMs);
		}
	})();
	try {
		return await safeSmartMove(spec);
	} finally {
		done = true;
		try { await watcher; } catch (e) { }
	}
}

/* smart_move, but it is never allowed to route through a rage rectangle. Used
   for BOTH directions - the trip in and, just as importantly, the trip back out
   when a boss event takes the party. bossApproach's smart_move was the obvious
   way to die on the way to a boss with the farm parked next to a box.
   A blocked route THROWS rather than falling back to smart_move: surfacing the
   failure is the house rule, and silently crossing the box is the one outcome
   worth failing to avoid. */
async function safeSmartMove(dest) {
	if (typeof smart_move !== 'function') throw new Error('smart_move is not a function');
	const cfg = rageCfg();
	const map = (dest && dest.map) || character.map;
	if (!cfg.enabled || !rageBoxes(map).length) return smart_move(dest);

	if (map !== character.map) {
		const stage = rageStaging(map);
		if (stage) await smart_move({ map: map, x: stage.x, y: stage.y });
		else await smart_move(dest);
	}
	if (character.map !== map || typeof dest.x !== 'number') return true;
	if (!rageClips(map, character.x, character.y, dest.x, dest.y, cfg.margin)) return smart_move(dest);
	const ok = await rageWalk(map, { x: dest.x, y: dest.y }, cfg.margin);
	if (!ok) {
		rageLog('no safe route to ' + Math.round(dest.x) + ',' + Math.round(dest.y) + ' on ' + map
			+ ' - refusing to let the pathfinder cut through a rage box', 'red');
		throw new Error('rage_route_blocked');
	}
	return true;
}

/* The merchant never pulls, so only the navigation half of the module ships
   here: the geometry, the route search, and the two movers. rageStatus is
   trimmed to match - there is no farm spot or pull state to report. */
function rageStatus() {
	const map = character.map;
	const boxes = rageBoxes(map);
	rageLog(map + ': ' + (boxes.length ? boxes.map(b => b.type + ' [' + b.r.join(',') + ']').join('  ') : 'no rage boxes'), '#8b98ab');
	rageLog('margin ' + rageCfg().margin + ' | standing ' + (rageHit(map, character.x, character.y, rageCfg().margin) ? 'INSIDE a rectangle' : 'clear'), '#8b98ab');
	return { boxes: boxes, cfg: rageCfg() };
}

// A real move. Closes the stand, holds the lock, propagates failure unchanged
// so every existing catch keeps working.
async function moveTo(spec) {
	if (moveLockHeld()) throw moveBusy();
	travelBegin();
	/* Every trip in the file funnels through here - pickup, mluck, potion
	   delivery, the bank runs, the scout hops - so one guard covers them all.
	   -> RAGE BOXES */
	try { await ensureStandClosed(); return await townTravel(spec); }
	finally { travelEnd(); }
}

// town() recall, same contract.
async function moveTown() {
	if (moveLockHeld()) throw moveBusy();
	travelBegin();
	try { await ensureStandClosed(); return await town(); }
	finally { travelEnd(); }
}

/* A short in-map reposition. Deliberately does NOT close the stand: these are a
   few units, and tearing the stand down for them would reintroduce exactly the
   teardown-per-unit-of-work granularity that v50 removed. It still takes the
   lock so the reconciler cannot race it. */
async function moveNudge(fn) {
	if (moveLockHeld()) throw moveBusy();
	travelBegin();
	try { return await fn(); }
	finally { travelEnd(); }
}

async function travelTo(map, x, y) {
	try {
		await moveTo({ map, x, y });
		return true;
	} catch (e) {
		// Not a broken trip - another loop is walking, and the backup would
		// interrupt it again. Silent: a race resolving, not the fault it was
		// being reported as.
		if (e && e.moveBusy) return false;
		game_log(`smart_move to ${map} (${x}, ${y}) failed: ${e.reason || e} - trying town() fallback`, 'red');
	}

	try {
		await moveTown();
	} catch (e) {
		game_log(`town() fallback also failed: ${e.reason || e} - Meltymerch may be stuck on ${character.map}`, 'red');
		return false;
	}

	// town() only returns to the CURRENT map's town point, not necessarily
	// the target map - so if the target is elsewhere, try the real route
	// again now that we're hopefully out of a dead-end area.
	if (character.map !== map) {
		try {
			await moveTo({ map, x, y });
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
// -> MerchantComments.md#SHARD_REGIONS
// ============================================================================
const SHARD_REGIONS = ['ASIA', 'US', 'EU'];

// This merchant's tax rate on gold received from another account.
// -> MerchantComments.md#arbTaxRate
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

// A cross-shard trip has to survive the hop itself.
// -> MerchantComments.md#TRIP_KEY
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

// Where to return to once the trip is done. Read straight from CONFIG and
// -> MerchantComments.md#mHomeShard
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
	// A shard hop reloads the page. Close the stand first: the speed clamp
	// follows him to the new shard otherwise, and shouldHoldStand() means no
	// stand belongs off the home shard anyway.
	try { await ensureStandClosed(); } catch (e) { }
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
		// A relayed message carries the bridge's send time; an in-game one is
		// live, so "now" is the honest stamp for it.
		const reqAt = Number(data._plts) || Date.now();
		const servedAt = plDeliveredAt(name, data.potion);
		if (servedAt && reqAt <= servedAt) {
			// Logged, never silent: "suppressed a replay" and "nobody asked" have
			// to stay distinguishable, or this guard becomes the thing that hides
			// a starving fighter.
			plLog('ignoring replayed ' + (data.potion || 'hp') + ' request from ' + name
				+ ' (sent ' + Math.round((servedAt - reqAt) / 1000) + 's before it was served)', '#8b98ab');
			return;
		}
		enqueueJob({ type: 'delivery', recipient: name, potion: data.potion, requestAt: reqAt, x: data.x, y: data.y, map: data.map, shard });
	}
	if (data.message === 'inventory_almost_full') {
		enqueueJob({ type: 'pickup', recipient: name, emptySlots: data.emptySlots, x: data.x, y: data.y, map: data.map, shard });
	}
	if (data.message === 'location' && CONFIG.mluck.targets.includes(name)) {
		/* A replayed request, exactly as on the delivery side: sent before the
		   buff it is asking for was cast, so it is answered already. This is the
		   guard that was missing - the needsMluck: true it carries was true when
		   it was sent, ten minutes ago, which is why observation alone never
		   caught it: the trip was booked long before anyone could look. */
		const reqAt = Number(data._plts) || Date.now();
		const luckedAt = plMluckedAt(name);
		if (luckedAt && reqAt <= luckedAt) {
			plLog('ignoring replayed mluck request from ' + name + ' (sent '
				+ Math.round((luckedAt - reqAt) / 1000) + 's before the buff was cast)', '#8b98ab');
			return;
		}
		// `location` means "buff me" OR "empty my pack"; needsMluck says which.
		// undefined = a pre-v62 sender, and keeps the old assumption on purpose.
		// -> MerchantComments.md#mluck-intent
		if (data.needsMluck === false) {
			// Drop a pending job too - enqueueJob dedupes, so a stale one would win.
			const before = state.queue.length;
			state.queue = state.queue.filter(j => !(j.type === 'mluck' && j.recipient === name));
			if (state.queue.length !== before) {
				game_log(`Dropped a stale mluck job for ${name} - their buff is live`, '#8b98ab');
			}
		} else if (character.level < CONFIG.mluck.minLevel) {
			// Below minLevel: silently ignored, nothing to do yet.
		} else if (data.needsMluck === undefined && mluckStillFresh(name)) {
			/* No hint AND our own cast is nowhere near expiry. Throttled, because
			   location arrives about once a second and this would otherwise be the
			   loudest line in the log. */
			if (Date.now() - mluckFreshNote > 60000) {
				mluckFreshNote = Date.now();
				plLog('no mluck trip for ' + name + ': our cast was '
					+ Math.round((Date.now() - plMluckedAt(name)) / 60000) + ' min ago and they are not saying otherwise', '#8b98ab');
			}
		} else {
			enqueueJob({
				type: 'mluck', recipient: name, needsMluck: data.needsMluck,
				x: data.x, y: data.y, map: data.map, shard
			});
		}
	}
}
let mluckFreshNote = 0;   // throttle for the line above

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
}

// ============================================================================
// VISIT LOGIC - handles delivery and/or pickup jobs for one recipient,
// -> MerchantComments.md#visitOneStop
// ============================================================================
/* Need, not list membership - the old test was the latter, so every visit to an
   mluck target carried a buff task whatever the buff said. Observation wins when
   we can see them; the sender's hint is the fallback.
   -> MerchantComments.md#mluck-intent */
function mluckWanted(recipientName, hint) {
	if (!CONFIG.mluck.targets.includes(recipientName)) return false;
	if (character.level < CONFIG.mluck.minLevel) return false;
	const t = get_player(recipientName);
	if (!t) {
		// Can't see them. What they said about their own buff beats any record of
		// ours; with nothing said, our own recent cast is the better guess than
		// the old blanket yes.
		if (hint === true) return true;
		if (hint === false) return false;
		return !mluckStillFresh(recipientName);
	}
	// Visible: observation beats any hint, however stale the hint has become.
	return !t.s || !t.s.mluck || t.s.mluck.f !== character.name;
}

async function visitOneStop(recipientName, jobs) {
	const deliveryJobs = jobs.filter(j => j.type === 'delivery');
	const wantsPickup = jobs.some(j => j.type === 'pickup');
	const mluckJob = jobs.find(j => j.type === 'mluck');
	const locJob = jobs[jobs.length - 1]; // most recent location data across all bundled jobs

	game_log(`Visiting ${recipientName}: ${jobs.map(j => j.type).join(' + ')}`, '#FFD700');

	// Travel to the recipient's best-known location.
	await travelToRecipient(locJob);

	/* Decided AFTER the trip. Before it we are almost always on another shard,
	   so get_player() is null and the hint would decide by default every time;
	   here the buff can actually be seen. -> MerchantComments.md#mluck-intent */
	const wantsMluck = mluckWanted(recipientName, mluckJob ? mluckJob.needsMluck : undefined);

	let remaining = { deliveries: deliveryJobs, pickup: wantsPickup, mluck: wantsMluck };
	remaining = await attemptActions(recipientName, remaining);

	/* mluck deliberately absent: a summon costs the recipient up to 60s off their
	   spot, which is worth it for cargo and never for a buff that reaches 320
	   units. -> MerchantComments.md#mluck-intent */
	const stillNeeded = remaining.deliveries.length > 0 || remaining.pickup;
	if (!stillNeeded) return;

	// Couldn't complete everything from here - summon them instead of
	// just giving up.
	const arrived = await summonAndWait(recipientName);
	if (arrived) {
		remaining = await attemptActions(recipientName, remaining);
		// mluck excluded as above - a skipped buff is not an incomplete visit.
		const stillMissing = remaining.deliveries.length > 0 || remaining.pickup;
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
			// Stamped BEFORE the send, deliberately. If a hop or reload lands
			// between send_item and this write, the mark is the only thing that
			// stops the replayed request coming straight back. The cost of that
			// ordering is narrow: if send_item throws, the job is retried inside
			// this same batch from memory, which the watermark does not filter,
			// and if the whole batch fails the fighter re-asks 30s later with a
			// fresh timestamp that clears the mark.
			plMarkDelivered(recipientName, dj.potion, Date.now());
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
		const alreadyOurs = !!(target.s && target.s.mluck && target.s.mluck.f === character.name);
		if (character.level < CONFIG.mluck.minLevel) {
			stillMluck = false; // not eligible regardless of range - summoning won't help
		} else if (alreadyOurs) {
			// Cleared regardless of range: tryCastMluck would no-op anyway, and the
			// flag left set is what made a live buff read as unfinished work.
			/* And date it while we can see it. `ms` is the remaining time, so the
			   cast is now minus what has elapsed - which seeds the watermark for a
			   buff cast before v68, or before this storage key existed at all. */
			const left = Number(target.s.mluck.ms) || 0;
			if (left > 0) plMarkMlucked(recipientName, Date.now() - (plMluckDurationMs() - left));
			stillMluck = false;
		} else if (is_in_range(target, 'mluck')) {
			await tryCastMluck(recipientName);
			stillMluck = false;
		}
	}

	return { deliveries: stillDeliveries, pickup: stillPickup, mluck: stillMluck };
}

/* Asks the recipient to come to Meltymerch's current spot, then STANDS STILL
   and polls for their arrival.

   Standing still is the whole point and v86 did not do it. summonAndWait
   published a position and then waited 60 s without taking the move lock, so
   every other loop in the file - the scout, the stand, gear progression,
   arbitrage, the maintenance beat - was free to walk him off while the
   recipient was still on its way to the coordinates he had just sent. The
   recipient arrives, finds nobody, and the trip ends in
   "<name> never arrived - giving up on remaining actions this trip", which
   reads like the recipient's fault and is not.

   Two defences, because the lock alone is not quite enough. The lock stops
   anything that routes through moveTo(); the drift check below catches
   everything else - a raw move() somewhere, knockback, a move already in
   flight when we were called - by noticing we are no longer where we said we
   would be and re-publishing rather than letting them walk to an empty spot.

   The lock ceiling is 180 s (CONFIG.moveLockMaxMs) and the wait is 60 s, so
   holding it for the whole wait is well inside the break-open threshold. */
async function summonAndWait(recipientName) {
	const cfg = (typeof CONFIG !== 'undefined' && CONFIG.summon) || {};
	const timeoutMs = cfg.waitMs || 60000;
	const pollMs = cfg.pollMs || 1000;
	const drift = cfg.driftUnits || 60;

	travelBegin();
	try {
		/* Anything already walking us has to be cancelled before we can promise
		   to be here. Its caller sees an interrupted move and backs off; a retry
		   then fails fast on the lock we are holding. */
		try { if (typeof stop === 'function') stop(); } catch (e) { }
		await sleep(250);

		const spot = { x: character.x, y: character.y, map: character.map };
		const publish = () => plSend(recipientName, {
			message: 'come_to_merchant', x: spot.x, y: spot.y, map: spot.map,
		});
		publish();
		game_log(`${recipientName} wasn't in range - asked them to come to Meltymerch, holding position at `
			+ `${Math.round(spot.x)},${Math.round(spot.y)}`, '#FFD700');

		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			await sleep(pollMs);
			if (character.rip) {
				game_log('Meltymerch died while waiting - abandoning this summon', 'red');
				return false;
			}
			if (character.map !== spot.map || Math.hypot(character.x - spot.x, character.y - spot.y) > drift) {
				spot.x = character.x; spot.y = character.y; spot.map = character.map;
				publish();
				game_log(`Moved while waiting for ${recipientName} - re-sent position `
					+ `${Math.round(spot.x)},${Math.round(spot.y)}`, 'orange');
			}
			const target = get_player(recipientName);
			if (target && is_in_range(target, 'attack')) return true;
		}
		game_log(`${recipientName} did not reach Meltymerch within ${Math.round(timeoutMs / 1000)}s`, 'orange');
		return false;
	} finally {
		travelEnd();
	}
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
		/* Stamped AFTER the cast, unlike the delivery watermark. The asymmetry is
		   deliberate: a mark written before a cast that then fails would refuse
		   the hint-less replacement request for the best part of an hour, while a
		   mark written late costs at most one redundant trip. A recipient running
		   v62 or later states its need and is believed regardless. */
		plMarkMlucked(targetName, Date.now());
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

const IDLE_RESTOCK_KEY = 'idle_restock_at';

/* Keep hp/mp stocked while there is nothing else to do.

   Calls ensureStock rather than buy_with_gold so the buy-and-verify path
   stays in one place; atTownSpot() is already true here, so ensureStock's
   travel branch is skipped and this never moves him.

   The throttle timestamp lives in CODE storage because a shard hop reloads
   the page, which would reset an in-memory timer and turn this into a
   per-tick check. It is written even when nothing was bought, so a failing
   buy - broke, or out of inventory slots - retries on the cadence rather
   than on every tick. -> MerchantComments.md#idleRestock */
async function idleRestock() {
	const cfg = CONFIG.idleRestock;
	if (!cfg || !cfg.enabled) return false;
	if (!atTownSpot()) return false;

	let at = 0;
	try { at = Number(get(IDLE_RESTOCK_KEY)) || 0; } catch (e) { at = 0; }
	if (at && Date.now() - at < cfg.everyMs) return false;

	const target = cfg.target || (CONFIG.deliveryAmount + CONFIG.restockBuffer);
	const reserve = cfg.reserve || 0;
	let bought = false;

	for (const name of ['hpot1', 'mpot1']) {
		const have = quantity(name);
		if (have >= target) continue;
		/* Price the purchase before making it. G is the client's own item table,
		   so a missing entry means we cannot price it - skip rather than guess,
		   the same rule arbitrage applies to a missing tax rate. */
		const g = parent.G && parent.G.items && parent.G.items[name];
		if (!g || !g.g) { plLog('idle restock: no price for ' + name + ' - skipping', 'orange'); continue; }
		const cost = (target - have) * g.g;
		if (character.gold - cost < reserve) {
			plLog('idle restock: ' + name + ' would cost ' + cost + ' and leave less than '
				+ reserve + ' - skipping', 'orange');
			continue;
		}
		const before = have;
		await ensureStock(name, target);
		const got = quantity(name) - before;
		if (got > 0) {
			bought = true;
			plLog('idle restock: bought ' + got + ' ' + name + ' for ' + (got * g.g)
				+ ' (now ' + quantity(name) + '/' + target + ')', '#7FD98A');
		}
	}

	try { set(IDLE_RESTOCK_KEY, Date.now()); } catch (e) { }
	return bought;
}

async function ensureStock(itemName, targetAmount) {
	// To the town spot rather than to Ernis himself.
	// -> MerchantComments.md#needed
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
			/* The recipient may be parked beside a rage rectangle - the combat party
			   farms booboo from its edge - so this short hop needs the same guard as
			   a full trip. -> RAGE BOXES */
			await moveNudge(function () { return safeMove(target.x, target.y); });
		} catch (e) {
			// Best effort - proceed to the delivery attempt regardless.
		}
	}
}

// ============================================================================
// STAND MANAGEMENT
// ============================================================================
// A stand only belongs on the home shard.
// -> MerchantComments.md#shouldHoldStand
function shouldHoldStand() {
	// A trade in flight may well be running on the home shard - that is the
	// commonest buy shard. Opening the stand there would still be wrong: the
	// stand has to be closed again before travelling, and the trade is about to
	// travel.
	if (ARB.cur) return false;
	return mShardKey() === mHomeShard();
}

/* Is the current stand too young to tear down?

   MEASURED 2026-09-24: gearProgressionLoop ran every 8s, found one eligible
   firebow upgrade (40,000 gold, target level 9), and to make that ONE attempt
   it closed the stand, walked to (-179,-72), upgraded, and walked back to
   (100,0) to reopen. Twelve unbroken minutes of alternating
   `smart_move: main 100 0` / `smart_move: main -179 -72` in the console, which
   is what "the merchant is moving with his stand out" actually was.

   This is a floor, not a lock: callers still decide whether they want the
   stand. Arbitrage is deliberately NOT gated on it - a trade in flight has gold
   committed to a destination and must travel regardless. */
function standDwellHeld() {
	if (!state.standOpen && !character.stand) return false;  // nothing to protect
	if (!state.standOpenedAt) return false;                  // opened before this build; do not stall forever
	return (Date.now() - state.standOpenedAt) < (CONFIG.stand.minDwellMs || 0);
}

/* ============================================================================
   THE ONLY PLACE A STAND IS RAISED.

   Six call sites used to reopen the stand: processBatch, gearProgressionLoop,
   anniversaryKissLoop, scoutGoHome, arbLoop and resumeInterruptedTrip. Five
   were imperative restores ("I closed it, so I put it back") and one - arbLoop's
   - was already a reconciler. None of them checked whether the character was
   mid-walk, which is how a stand came back up underneath a trip that had
   correctly closed it.

   This is the reconciler, and it is declarative: if nothing is happening, we
   are home, and there is no stand, raise one. Every former caller is covered
   because they all end by clearing the flag they took.

   WHY ITS OWN LOOP, not a line inside arbLoop: arbLoop is a self-chained async
   loop and Merchant.js never got noHang() - that shipped in Ranger v51 /
   Priest v26 / Mage v50 only. If any await in arbLoop never settles, the chain
   ends silently. Leaving the sole stand-opener in there would make the stand's
   existence inherit arbLoop's liveness, and the redundancy that currently
   masks such a hang is exactly what this change removes.

   PROBE.hold IS honoured here. The old arbLoop line sat outside that guard, so
   a probe hold stopped everything except stand churn. As the sole owner that
   inconsistency would become the only behaviour.
   ============================================================================ */
async function standLoop() {
	try {
		if (!state.travelling && !character.moving && !character.stand
			&& !state.standOpen && !state.standSuppressed && !PROBE.hold
			&& !state.busy && !ARB.cur && !ARB.busy) {
			await openStandAtBestSpot();
		}
	} catch (e) {
		console.error('standLoop error:', e);
	}
	setTimeout(standLoop, (CONFIG.stand && CONFIG.stand.reconcileMs) || 4000);
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

	/* Open where we already stand, if that is a valid spot.

	   The list is tried in order and the candidates are deliberately spread out
	   "in case one spot is blocked" - so being parked on candidate 3 is a normal
	   outcome, not a fault. Walking back to candidate 1 on every call is pure
	   cost: travelTo() closes the stand to do it, then it reopens at the far end,
	   for no gain over the spot already under his feet. */
	const atSpot = CONFIG.stand.candidates.filter(function (s) {
		return character.map === CONFIG.stand.map && distance(character, s) <= 20;
	});
	const order = atSpot.concat(CONFIG.stand.candidates.filter(function (s) {
		return atSpot.indexOf(s) < 0;
	}));

	for (const spot of order) {
		// Another loop holds the lock: all five would fail fast and the loop
		// would end on a misleading "could not open stand anywhere".
		if (moveLockHeld()) return;
		try {
			if (character.map !== CONFIG.stand.map || distance(character, spot) > 20) {
				const arrived = await travelTo(CONFIG.stand.map, spot.x, spot.y);
				if (!arrived) continue; // try the next candidate rather than getting stuck on one
			}
			// Re-checked AFTER the walk: travelTo() can await through a shard hop
			// and the gate would pass on stale data. Return, not continue - no
			// candidate is on the home shard either.
			// -> MerchantComments.md#re-check-after-the-walk
			if (!shouldHoldStand()) return;
			await open_stand(slot);
			state.standOpen = true;
			state.standOpenedAt = Date.now();
			game_log(`Stand opened at (${spot.x}, ${spot.y})`, '#00FF00');
			await ensureListing();
			await ssTick('stand-open');
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
// Selling needs Gabriel in range - 129.4 from the town spot, and both buy and
// -> MerchantComments.md#sellTrash
function sellTrash() {
	if (!CONFIG.selling.enabled) return;
	const whitelist = new Set(CONFIG.selling.whitelist);
	const held = arbHeldNames();
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && whitelist.has(item.name) && item.p === undefined && item.l !== 'l') {
			if (held[item.name]) continue;   // arbitrage paid real gold for this
			/* The whitelist is not the last word. gem0 and seashell are both on
			   it and both exchangeable; this is the guard that outranks it. */
			if (isExchangeable(item.name)) continue;
			sell(i);
		}
	}
}

// ============================================================================
// AGGRESSIVE SELLING WHEN LOW ON SPACE - see CONFIG.selling.aggressive*.
// -> MerchantComments.md#PROTECTED_ITEM_NAMES
// ============================================================================
const PROTECTED_ITEM_NAMES = new Set([
	'hpot1', 'mpot1',
	// Records achievements for bonus stats. Vendors for 7 gold, so every
	// value-based guard in here would have waved it straight through.
	'tracker',
	'scroll0', 'scroll1', 'scroll2', 'scroll3', 'scroll4',
	'cscroll0', 'cscroll1', 'cscroll2', 'cscroll3', 'cscroll4',
	'offeringp', 'offering', 'offeringx',
	'stand0',
	// Event boxes. Opening one yields ~8,232 (marketparcel) or ~21,907
	// (anniversarygift) in vendor gold against an unopened NPC value of 60 -
	// vendoring them unopened throws away 137x and 365x respectively.
	'anniversarygift', 'marketparcel',
]);

/* Items the merchant may not BUY or SELL at all - not to an NPC, not to a
   player, not through arbitrage.

   PROTECTED_ITEM_NAMES is consulted in exactly two places, the aggressive
   NPC dump and ssVendorBound. Arbitrage never looks at it, which is why
   offeringp - protected since forever - was still bought and flipped for
   5,980,935 net. So a second set is needed, and it is applied at flip
   INGESTION rather than at the point of sale: a name filtered out of the
   buys/sells feed cannot reach any caller, hand-run probes included. */
const NO_TRADE_ITEM_NAMES = new Set(['anniversarygift', 'marketparcel']);

/* EXCHANGEABLE ITEMS ARE NEVER SOLD. The operator's rule, 2026-10-03.

   An exchangeable item is one Wizard/Ponty will trade for a random reward -
   G.items[name].e, which is the QUANTITY the exchange consumes, not a boolean.
   items.js labels the field itself: `// "e" Exchangable`. Derived rather than
   listed, so a game update that adds one is covered without a redeploy.

   WHY IT IS A RULE AND NOT A PRICE CHECK. Two exchangeables were sitting on
   CONFIG.selling.whitelist, so sellTrash() vendored them on sight:

     gem0 (Raw Emerald)  NPC 240,000
     seashell            NPC 800, e=20

   gem0's exchange table (design/drops.js) pays out 100k-6.4M in gold, a
   weaponbox or armorbox, scroll1 x10, cscroll1 x4, and - at 0.641% - an
   offering. Counting ONLY the pure-gold rows, which need no valuation
   assumptions at all, the exchange averages 262,779 against a 240,000 vendor
   price. Every box, scroll and offering is upside on top of that. So the NPC
   price is not a floor to compare against; it is the worst available exit, and
   a value-based guard waves it through precisely because 240,000 looks like
   real money.

   SEED + DERIVED, UNIONED. A derived-only set that reads an empty or missing
   G.items would be EMPTY, and an empty protection set protects nothing - the
   failure is silent and costs 240,000 a gem. The seed is the 45 names measured
   2026-10-03 against design/items.js; the derived half extends it. Neither can
   shrink the other. -> MerchantComments.md#EXCHANGEABLE */
const EXCHANGEABLE_SEED = ['cosmo0', 'cosmo1', 'cosmo2', 'cosmo3', 'cosmo4', 'cosmo5',
	'sixcake', 'anniversarygift', 'gem0', 'gem1', 'candypop', 'candy0', 'candy1',
	'candy0v2', 'candy1v2', 'candy0v3', 'candy1v3', 'bugbountybox', 'apologybox',
	'weaponbox', 'armorbox', 'jewellerybox', 'mistletoe', 'candycane', 'marketparcel',
	'gift0', 'gift1', 'redenvelope', 'redenvelopev2', 'redenvelopev3', 'redenvelopev4',
	'greenenvelope', 'brownenvelope', 'mysterybox', 'troll', 'glitch', '5bucks',
	'seashell', 'leather', 'gemfragment', 'ornament', 'lostearring', 'xbox',
	'goldenegg', 'basketofeggs'];

let exchangeableCache = null;
function exchangeableNames() {
	if (exchangeableCache) return exchangeableCache;
	const out = new Set(EXCHANGEABLE_SEED);
	try {
		const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : (typeof G !== 'undefined' ? G : null);
		for (const id in (g && g.items) || {}) {
			const it = g.items[id];
			if (it && it.e !== undefined) out.add(String(id));
		}
	} catch (e) { }
	/* Only cache once the derived half actually read something. A failed read
	   caching the seed alone would freeze the gap in for the session. */
	if (out.size > EXCHANGEABLE_SEED.length) exchangeableCache = out;
	return out;
}

function isExchangeable(name) { return !!name && exchangeableNames().has(String(name)); }

/* Never sold, always banked. -> CONFIG.materials.keepAndBank */
let keptMaterialCache = null;
function keptMaterialNames() {
	if (!keptMaterialCache) keptMaterialCache = new Set((CONFIG.materials && CONFIG.materials.keepAndBank) || []);
	return keptMaterialCache;
}
function isKeptMaterial(name) { return !!name && keptMaterialNames().has(String(name)); }

/* What the rule is costing or saving, on demand. */
function exchangeableReport() {
	const names = exchangeableNames();
	const held = [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (it && it.name && names.has(it.name)) held.push({ slot: i, name: it.name, q: it.q || 1, locked: it.l === 'l' });
	}
	const wl = (CONFIG.selling.whitelist || []).filter(function (n) { return names.has(n); });
	const out = { known: names.size, derived: exchangeableCache !== null, onHand: held,
		stillOnSellWhitelist: wl, atBank: character.map === CONFIG.bank.map };
	console.log('exchangeables', out);
	return out;
}

/* Counterparties never traded with. PERMANENT, unlike arb_fail, which caps at a
   one-hour hold and forgets the count. By NAME, not shard|name. Filtered at feed
   ingestion for the same reason as NO_TRADE_ITEM_NAMES, and again in the buy
   finder, the stranded-goods buyer and the candidate filter.
   -> MerchantComments.md#NEVER_TRADE_NAMES */
const NEVER_TRADE_NAMES = new Set(['Kazhag', 'Balitr']);

/* AN NPC IS NEVER SHELVED AND NEVER BLACKLISTED. The operator's rule,
   2026-09-30, and it closes a live hole: arb_fails held FOUR entries and all
   four were Ponty - USV n=5, EUIII n=5, USIV n=3, ASIAI n=2, fifteen abandoned
   trades and the only shelved counterparties on record. At neverTradeAfter (8)
   that promotes the name permanently, so the merchant was three failures per
   shard away from blacklisting the one counterparty that cannot move, cannot
   log off and never runs out of stock for good.

   The set is DERIVED from G.npcs rather than listing names, so it covers all
   132 of them and stays right when the game adds one. Measured 2026-09-30:
   G.npcs.secondhands.name is 'Ponty', role 'secondhands'. The name is what the
   failure bookkeeping is keyed on, which is why the lookup is by name. */
let arbNpcNameCache = null;
function arbNpcNames() {
	if (arbNpcNameCache) return arbNpcNameCache;
	const out = new Set();
	try {
		const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : (typeof G !== 'undefined' ? G : null);
		for (const id in (g && g.npcs) || {}) {
			const n = g.npcs[id];
			if (n && n.name) out.add(String(n.name));
			out.add(String(id));
		}
	} catch (e) { }
	// Never let an empty read pass for "no NPCs": that would re-open the hole.
	if (!out.size) { out.add('Ponty'); return out; }
	arbNpcNameCache = out;
	return out;
}
function arbIsNpcTarget(target) { return !!target && arbNpcNames().has(String(target)); }

const ARB_NEVER_KEY = 'arb_never';
const ARB_CHURN_KEY = 'arb_churn';

// The automatic half. CODE storage, so it survives the change_server reload -
// and a DEPLOY DOES NOT CLEAR IT, which is why promotion logs in red.
function arbNeverAuto() {
	try { const v = get(ARB_NEVER_KEY); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; }
}

function arbNeverBlocked(target) {
	if (!target) return false;
	if (NEVER_TRADE_NAMES.has(target)) return true;
	/* Reads as well as writes: entries written before v71 are still in storage,
	   and a deploy does not clear them. */
	if (arbIsNpcTarget(target)) return false;
	const e = arbNeverAuto()[target];
	if (!e) return false;
	// A churn HOLD carries `until` and expires; a promotion has none and is permanent.
	if (e.until && Date.now() >= e.until) return false;
	return true;
}

/* The CHURN half: a merchant that will not stand still is unusable NOW, not
   for ever. Holds for an hour, then it is tried again - merchants relocate and
   then settle, and the permanent list was swallowing ~2.7 of them an hour with
   no expiry until nothing tradeable was left. Repeated FAILURES still promote
   permanently via arbNeverPromote. -> MerchantComments.md#NEVER_TRADE_NAMES */
function arbNeverHold(target, why, ms) {
	if (!target || NEVER_TRADE_NAMES.has(target)) return false;
	if (arbIsNpcTarget(target)) return false;   // -> AN NPC IS NEVER SHELVED
	const m = arbNeverAuto();
	const cur = m[target];
	if (cur && !cur.until) return false;                 // never downgrade a permanent entry
	const until = Date.now() + (ms || 3600000);
	if (cur && cur.until >= until) return false;
	m[target] = { at: new Date().toISOString(), why: why || 'moving', until: until };
	try { set(ARB_NEVER_KEY, m); } catch (e) { return false; }
	return true;
}

function arbNeverPromote(target, why) {
	if (!target || NEVER_TRADE_NAMES.has(target)) return false;
	if (arbIsNpcTarget(target)) {
		arbLog('not blacklisting the NPC ' + target + ' (' + (why || '') + ') - an NPC is never shelved', '#8b98ab');
		return false;
	}
	const m = arbNeverAuto();
	if (m[target] && !m[target].until) return false;   // already permanent
	m[target] = { at: new Date().toISOString(), why: why || 'repeated failures' };
	try { set(ARB_NEVER_KEY, m); } catch (e) { return false; }
	arbLog('NEVER TRADING ' + target + ' AGAIN - ' + (why || '') + '. Permanent, survives a '
		+ 'deploy. arbNeverForget("' + target + '") undoes it.', 'red');
	return true;
}

// A permanent list nobody can read is a permanent list nobody trusts.
function arbNeverList() {
	const auto = arbNeverAuto();
	const out = { manual: Array.from(NEVER_TRADE_NAMES), automatic: auto,
		churn: arbChurnLoad(), count: NEVER_TRADE_NAMES.size + Object.keys(auto).length };
	console.log('never traded with', out);
	return out;
}

function arbNeverForget(target) {
	if (NEVER_TRADE_NAMES.has(target)) {
		arbLog(target + ' is hard-coded in Merchant.js - remove it there and redeploy', 'orange');
		return false;
	}
	const m = arbNeverAuto();
	if (!m[target]) { arbLog(target + ' is not on the automatic list', '#8b98ab'); return false; }
	delete m[target];
	try { set(ARB_NEVER_KEY, m); } catch (e) { return false; }
	const c = arbChurnLoad();
	if (c[target]) { delete c[target]; try { set(ARB_CHURN_KEY, c); } catch (e) { } }
	arbLog('forgot ' + target + ' - it can be traded with again', '#7FD98A');
	return true;
}

/* MAP CHURN - the merchant that will not hold still long enough to trade.
   Counted on MAP transitions only, so shuffling around one map is ignored:
   approachUnits is 350 and smart_move closes that. Measured 2026-09-26.
   -> MerchantComments.md#mapChurnLimit */
function arbChurnLoad() {
	try { const v = get(ARB_CHURN_KEY); return (v && typeof v === 'object') ? v : {}; } catch (e) { return {}; }
}

// Mutates the caller's map so one ingestion pass costs ONE write, not one per
// merchant - the O(n^2) trap v54 removed from the chest map.
function arbChurnNote(churn, name, map) {
	if (!name || !map) return false;
	const cfg = CONFIG.arbitrage;
	if (!cfg.mapChurnLimit) return false;
	const now = Date.now();
	const e = churn[name];
	// No record, or a stale window: that is a relocation, not churn. Restart.
	if (!e || now - (e.since || 0) > (cfg.mapChurnWindowMs || 0)) {
		churn[name] = { map: map, changes: 0, since: now };
		return true;
	}
	if (e.map === map) return false;
	e.map = map;
	e.changes = (e.changes || 0) + 1;
	if (e.changes >= cfg.mapChurnLimit) {
		arbNeverHold(name, 'changed map ' + e.changes + ' times in '
			+ Math.round((now - e.since) / 60000) + ' min - not standing still',
			cfg.mapChurnHoldMs);
	}
	return true;
}

/* ARBITRAGE STOCK - goods the executor has paid for and not yet disposed of.

   Neither NPC sell path knew arbitrage existed. sellTrash vendors anything on
   its whitelist on sight, and the aggressive seller vendors nearly anything
   once the bag is almost full. Both price by NPC value, and the slices
   arbitrage moves in millions vendor for SIX GOLD - slice_nightberry alone
   absorbed 124,200,000 in one day. One inventory squeeze at the wrong moment
   could dump a nine-figure position for pocket change, and do it invisibly:
   NPC sales are recorded nowhere, not in the bridge ledger and not in the
   server's own trade_history, which logs player-to-player trades only.

   Keyed by NAME, not slot, because stacks move and merge. That is deliberately
   conservative - ordinary loot sharing a name with live arbitrage stock is
   protected too, which costs a little vendor gold and risks nothing.

   SELF-HEALING: a name the bag no longer carries is dropped on the next read,
   whether it sold, was banked, or a hook was missed. A stale entry therefore
   cannot protect an item forever, and the registry cannot drift far from what
   is actually in the bag. */
const ARB_HELD_KEY = 'arb_held';
let arbHeldCache = null, arbHeldCacheAt = 0;

function arbHeldNames() {
	if (arbHeldCache && Date.now() - arbHeldCacheAt < 1000) return arbHeldCache;
	let h;
	try { h = get(ARB_HELD_KEY) || {}; } catch (e) { h = {}; }
	const names = Object.keys(h);
	if (names.length) {
		const have = new Set();
		const bag = (typeof character !== 'undefined' && character.items) || [];
		for (const it of bag) if (it && it.name) have.add(it.name);
		let changed = false;
		for (const n of names) if (!have.has(n)) { delete h[n]; changed = true; }
		if (changed) { try { set(ARB_HELD_KEY, h); } catch (e) { } }
	}
	arbHeldCache = h; arbHeldCacheAt = Date.now();
	return h;
}

function arbHeldAdd(name, qty, cost) {
	if (!name) return;
	let h;
	try { h = get(ARB_HELD_KEY) || {}; } catch (e) { h = {}; }
	h[name] = { qty: qty || 1, cost: cost || 0, at: Date.now() };
	try { set(ARB_HELD_KEY, h); } catch (e) { }
	arbHeldCache = null;
}

function arbHeldDrop(name) {
	let h;
	try { h = get(ARB_HELD_KEY) || {}; } catch (e) { h = {}; }
	if (h[name] !== undefined) {
		delete h[name];
		try { set(ARB_HELD_KEY, h); } catch (e) { }
	}
	arbHeldCache = null;
}

/* ============================================================================
   ABANDONED STOCK - the bridge is the registry, the bank is the truth.
   -> MerchantComments.md#stock-recovery
   ============================================================================ */
const ARB_STOCK_KEY = 'arb_stock';

/* Rows the bridge still calls `abandoned` but which cannot be recovered,
   because the goods are not in the bank. The bridge is RIGHT to keep saying
   abandoned - that is what happened to the trade - and rewriting its status
   would book a close that never occurred and a receipt that never arrived.
   So the correction is local and the ledger stays honest.

   Without this, arbStockForget only pruned arbStockCache. arbStockLoad
   rebuilds `keep` from /trades on every successful read, so the drop was
   undone on the next look: 68 identical notes in 59 minutes, a bank trip
   each, and the flip finder never reached.
   -> MerchantComments.md#stock-tombstones */
const ARB_STOCK_SKIP_KEY = 'arb_stock_skip';

function arbStockSkips() {
	try { const v = get(ARB_STOCK_SKIP_KEY); return (v && typeof v === 'object') ? v : {}; }
	catch (e) { return {}; }
}

// Console helpers, mirroring arbNeverList / arbNeverForget.
function arbStockSkipList() {
	const m = arbStockSkips();
	console.log('stock rows skipped', m);
	arbLog(Object.keys(m).length + ' stock row(s) skipped - see console', '#FFD700');
	return m;
}

function arbStockUnskip(id) {
	const m = arbStockSkips();
	if (!m[id]) { arbLog('stock: ' + id + ' is not skipped', '#8b98ab'); return false; }
	delete m[id];
	try { set(ARB_STOCK_SKIP_KEY, m); } catch (e) { return false; }
	arbStockCache = null;   // force the next load to rebuild from the bridge
	arbLog('stock: ' + id + ' will be considered again', '#7FD98A');
	return true;
}
let arbStockCache = null, arbStockAt = 0;

/* Abandoned trades whose goods should still exist. Cached in CODE storage so a
   hop costs no round trip and a bridge outage degrades to the last known list
   rather than to nothing. */
async function arbStockLoad(force) {
	const cfg = CONFIG.arbitrage.stockRecovery;
	if (!force && arbStockCache && Date.now() - arbStockAt < cfg.refreshMs) return arbStockCache;
	let rows = null;
	try {
		const st = await scoutFetch('/trades');
		if (st && Array.isArray(st.trades)) rows = st.trades;
	} catch (e) {
		arbLog('stock: /trades unreachable (' + (e && e.message ? e.message : e)
			+ ') - using the last known list', 'orange');
	}
	if (rows) {
		const keep = [];
		for (const r of rows) {
			if (!r || r.dryRun || r.status !== 'abandoned' || !r.item) continue;
			keep.push({ id: r.id, item: r.item, level: r.level || 0, qty: r.qty || 1,
				spend: r.spend || 0, where: r.disposition || null });
		}
		/* Applied AFTER the fetch, every time. The bridge is authoritative for
		   what was abandoned; this is authoritative for what is worth trying. */
		const skip = arbStockSkips();
		arbStockCache = keep.filter(function (s) { return !skip[s.id]; });
		try { set(ARB_STOCK_KEY, arbStockCache); } catch (e) { }
	} else if (!arbStockCache) {
		try { arbStockCache = get(ARB_STOCK_KEY) || []; } catch (e) { arbStockCache = []; }
	}
	arbStockAt = Date.now();
	return arbStockCache;
}

// Sold, or the bank does not have it. Either way stop considering it.
function arbStockForget(id, why, item) {
	let added = false;
	if (why) {
		const m = arbStockSkips();
		if (!m[id]) {
			m[id] = { at: new Date().toISOString(), why: why, item: item || null };
			try { set(ARB_STOCK_SKIP_KEY, m); added = true; } catch (e) { }
		}
	}
	if (arbStockCache) {
		arbStockCache = arbStockCache.filter(function (s) { return s.id !== id; });
		try { set(ARB_STOCK_KEY, arbStockCache); } catch (e) { }
	}
	return added;   // true only the FIRST time, so a caller can log once
}

/* A fresh buyer for something already owned, best edge first.

   Sell-side only, so it cannot be arbProbeFindFlips - there is no buy leg to
   price. The bar is arbNetFromSale's: after tax the player must beat what a
   vendor pays, because anything less should be vendored rather than carried
   across a shard. Returns null cheaply when nothing is banked, so the market
   is not re-fetched on every look for no reason. */
async function arbStockFindSale() {
	const cfg = CONFIG.arbitrage.stockRecovery;
	if (!cfg.enabled) return null;
	const stock = await arbStockLoad();
	if (!stock || !stock.length) return null;
	const tax = arbTaxRate();
	if (tax == null) return null;

	const want = new Map();
	for (const s of stock) want.set(s.item + '|' + s.level, s);

	const got = await arbProbeMarketRows();
	const maxAge = CONFIG.arbitrage.sellMaxAgeSec;
	let best = null;
	for (const r of (got.rows || [])) {
		if (arbNeverBlocked(r.id)) continue;
		const age = pAgeSec(r.lastSeen);
		if (age == null || age > maxAge) continue;
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || !sl.name || !sl.b) continue;
			if (NO_TRADE_ITEM_NAMES.has(sl.name)) continue;
			if (isExchangeable(sl.name)) continue;   // never sold, so never a sell target
			if (typeof sl.price !== 'number' || !isFinite(sl.price)) continue;
			const s = want.get(sl.name + '|' + (sl.level || 0));
			if (!s) continue;
			let npcv = null;
			try { npcv = parent.calculate_item_value({ name: sl.name, level: sl.level || 0 }); } catch (e) { }
			const dec = arbNetFromSale(sl.price, npcv);
			if (!dec || dec.to !== 'player') continue;         // a vendor pays more
			const qty = Math.max(1, Math.min(s.qty, sl.q || 1));
			/* PROFIT AFTER TAX, against what the goods cost - not against what a
			   vendor would pay. offeringp cost 5,000,000 a unit and the best
			   buyer's 5,100,000 is 4,972,500 after tax, so every unit realised
			   -27,500 while showing +4.68M against a vendor. The basis is per
			   UNIT because qty is capped by what the buyer wants, which is
			   routinely less than the row holds.
			   -> MerchantComments.md#only-at-a-profit */
			const basisUnit = (s.qty > 0) ? (s.spend || 0) / s.qty : (s.spend || 0);
			const profit = Math.floor((dec.net - basisUnit) * qty);
			const overVendor = Math.floor((dec.net - (npcv || 0)) * qty);
			if (profit < cfg.minProfit) continue;
			if (best && profit <= best.profit) continue;
			best = { stock: s, item: sl.name, level: sl.level || 0, qty: qty,
				profit: profit, overVendor: overVendor, basisUnit: Math.round(basisUnit),
				sellTo: r.id, sellPrice: sl.price, sellSlot: k,
				sellShard: String(r.serverRegion) + String(r.serverIdentifier),
				sellMap: r.map, sellX: r.x, sellY: r.y, ageSec: age, taxRate: tax };
		}
	}
	return best;
}

/* The trade record for unwinding one abandoned holding.

   IT KEEPS THE ORIGINAL TRADE ID. arbFinish() emits `closed` against t.id, the
   bridge replays events per id with last-write-wins on status, and `closed`
   already carries received/net - so the row that was abandoned becomes closed
   and leaves abandonedSpend on its own, with no new event type. That matters:
   the bridge validates against LEDGER_EVENTS and refuses anything else.
   Reusing the id is also what makes net honest - the basis is the gold really
   spent, not zero, so the share banked is a share of real profit.

   phase 'fetch' because the goods are in the BANK, not the bag. fromStock so a
   failure cannot trip the stranding breaker: that exists to stop gold turning
   into stock, and this direction converts nothing. */
function arbStockPlan(sale) {
	return {
		id: sale.stock.id,
		phase: 'fetch',
		at: Date.now(),
		fromStock: true,
		item: sale.item, level: sale.level, special: null, qty: sale.qty,
		buyFrom: null, buyPrice: 0, buyShard: null, buySlot: null, buyIsNpc: false,
		buyMap: null, buyX: null, buyY: null,
		sellTo: sale.sellTo, sellPrice: sale.sellPrice, sellShard: sale.sellShard,
		sellSlot: sale.sellSlot, sellMap: sale.sellMap || null,
		sellX: sale.sellX, sellY: sale.sellY,
		spend: sale.stock.spend, actualSpend: sale.stock.spend,
		expectProfit: sale.profit, taxRate: sale.taxRate,
		goldAtStart: character.gold, attempts: 0, tried: [],
	};
}

/* Withdraw it. The bridge says what SHOULD be there; character.bank only
   populates at the bank, so this is the first point the claim can be checked.
   Missing means someone moved it - note it, forget it, and stop walking to the
   bank for a ghost. A short count sells what is actually there. */
async function arbStockFetch(t) {
	const held = function () {
		let n = 0;
		for (const it of character.items) {
			if (it && it.name === t.item && (it.level || 0) === (t.level || 0)) n += (it.q || 1);
		}
		return n;
	};
	if (held() >= t.qty) return true;
	if (!(await travelToBank())) { arbLog('stock: could not reach the bank', 'red'); return false; }
	if (!character.bank) { arbLog('stock: at the bank but character.bank is empty', 'red'); return false; }
	for (const pack in character.bank) {
		if (!/^items/.test(pack)) continue;
		const arr = character.bank[pack] || [];
		for (let i = 0; i < arr.length && held() < t.qty; i++) {
			const it = arr[i];
			if (!it || it.name !== t.item || (it.level || 0) !== (t.level || 0)) continue;
			if (!character.items.some(function (x) { return x === null; })) break;
			try {
				await bank_retrieve(pack, i);
				await new Promise(function (r) { setTimeout(r, 250); });
			} catch (e) {
				arbLog('stock: bank_retrieve failed - '
					+ (e && (e.reason || e.message) ? (e.reason || e.message) : e), 'red');
			}
		}
	}
	const got = held();
	await scoutGoToScanSpot();
	if (got < 1) {
		/* Once per row, not once per look. The tombstone is what makes that
		   possible - before it, this note was the loop's only visible symptom. */
		if (arbStockForget(t.id, 'not in the bank', t.item)) {
			arbLedger({ id: t.id, event: 'note', text: 'stock recovery: ' + t.item
				+ ' is not in the bank - dropped from the stock list' });
			arbLog('stock: ' + t.item + ' is not in the bank - dropped. '
				+ 'arbStockUnskip("' + t.id + '") puts it back.', 'orange');
		}
		return false;
	}
	if (got < t.qty) {
		t.qty = got;
		arbLog('stock: only ' + got + ' of ' + t.item + ' in the bank - selling that', 'orange');
	}
	arbHeldAdd(t.item, t.qty, t.actualSpend);
	return true;
}

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

	const held = arbHeldNames();
	let sold = 0;
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (!item || !item.name) continue;
		if (item.p !== undefined || item.l === 'l') continue; // already listed for sale, or locked - can't sell either way
		if (PROTECTED_ITEM_NAMES.has(item.name)) continue;
		if (isExchangeable(item.name)) continue;   // -> EXCHANGEABLE ITEMS ARE NEVER SOLD
		if (isKeptMaterial(item.name)) continue;   // -> CONFIG.materials.keepAndBank
		if (isTier2OrTier3GearItem(item.name)) continue;
		if (held[item.name]) continue;   // arbitrage stock - vendoring it realises the loss

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
		/* Containment. The merchant has no mainLoop, and this is the housekeeping
		   tick - 2s is fast enough to leave a rectangle before a pack commits. */
		try { await rageGuard(); } catch (e) { }
	} catch (e) {
		console.error('maintenanceLoop error:', e);
	}
	setTimeout(maintenanceLoop, 2000);
}
// NOT called here - it now references GEAR_PROGRESSION/PARTY_CLASSES from
// -> MerchantComments.md#not-called-here-it-now

// ============================================================================
// GEAR PROGRESSION SYSTEM (see [[gear-progression-system]] memory note).
// -> MerchantComments.md#LEVEL_CODES
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
			// -> MerchantComments.md#earring1
		},
		{
			// Pants are plain, not starkillers - that item is
			// class-restricted to mage/priest and a ranger can't equip it.
			/* MAINHAND IS bowofthedead, NOT firebow, from 2026-10-10. Measured:
			     firebow+9        attack 97   range 135  crit 0
			     bowofthedead+7   attack 82   range 121  crit 2.45
			     bowofthedead+9   attack 104  range 151  crit 3.15
			   so the tier-3 target beats what firebow reached on all three, and
			   the operator already holds one at +7.

			   TWO THINGS THAT ARE EASY TO MISS. The grade break is at 5 for
			   bowofthedead against 8 for firebow, so +7 and +9 both sit inside
			   grade 1 where the cost per level is already raised - this is not
			   the cheap end of the curve that firebow+7 would have been. And it
			   carries speed -12, which firebow does not; Dexon is the fastest of
			   the three at 78, so he can absorb it, but it is a real cost on a
			   party whose cohesion work all season has been about closing rates.

			   GLOVES ARE thundergrips+7, NOT supermittens, for now. supermittens
			   is still the tier-3 target and still the better item under the
			   DAMAGE-FIRST rule - at +5 it is apiercing 47 and frequency 3
			   against thundergrips' 0 and 2 - but it is DROP-ONLY: no craft
			   recipe, no token price, no NPC source. thundergrips is craftable
			   (mrngloves+6 + 80 stormfeather + 12 essenceofether + 800k) so it is
			   the reachable item, exactly like frankypants in the pants slot
			   rather than an off-plan substitute. At +7: armor 52, res 41,
			   frequency 3, against armor 43 / res 32 / frequency 2 at +5. */
			/* CHEST IS mrnarmor+7, NOT coat+9, as of 2026-10-05. Measured stats:
			     coat+9       armor 13  resistance 11  stat 15
			     mrnarmor+7   armor 62  resistance 51  stat 10  frequency 1
			   so the swap buys +49 armor and +40 resistance for -5 dex. At Dexon's
			   311 armor that is about 6.3% less damage taken.

			   mrnarmor IS TOKEN-ONLY and the planner can never acquire one: 12
			   monstertokens from the monsterhunter, no NPC gold price, no Ponty entry,
			   and zero market asks across all 76 merchants on the feed. That is safe
			   rather than a stall, because gatherPlanCandidates only ever walks
			   character.items - a plan target is the goal for a copy already in hand,
			   never a shopping list. Supplied by hand.

			   grades are [0,7,10,12], so +7 is exactly where it crosses into grade 2
			   and the cost per level jumps. Do not raise this target to +8 or +9
			   casually: from +7 the next two steps are 19.6% then 12.5% and run to
			   roughly a billion gold-equivalent. -> MerchantComments.md#mrnarmor */
			earring1: { item: 'dexearring', level: 4, method: 'compound' }, helmet: { item: 'fury', level: 4, method: 'upgrade' }, earring2: { item: 'dexearring', level: 4, method: 'compound' }, amulet: { item: 'dexamulet', level: 4, method: 'compound' },
			mainhand: { item: 'bowofthedead', level: 7, method: 'upgrade' }, chest: { item: 'mrnarmor', level: 7, method: 'upgrade' }, offhand: { item: 't2quiver', level: 7, method: 'upgrade' }, cape: { item: 'ecape', level: 7, method: 'upgrade' },
			ring1: { item: 'cring', level: 3, method: 'compound' }, pants: { item: 'frankypants', level: 6, method: 'upgrade' }, ring2: { item: 'suckerpunch', level: 0, method: 'compound' }, belt: { item: 'dexbelt', level: 3, method: 'compound' },
			orb: { item: 'orbofdex', level: 3, method: 'compound' }, shoes: { item: 'wingedboots', level: 8, method: 'upgrade' }, gloves: { item: 'thundergrips', level: 7, method: 'upgrade' }, elixir: null,
		},
		{
			// Pants are plain, not starkillers - same class-restriction as tier2.
			/* CHEST STAYS tshirt9 HERE, DELIBERATELY - it is not an oversight and not
			   a worse mrnarmor. tshirt9 is a manasteal shirt with zero armor, zero
			   resistance and zero stat, and manasteal is a DPS stat on this character:
			   server.js applies ceil(min(attack, target.hp) * manasteal / 100) PER HIT,
			   so 5shot triggers it five times. Dexon is MP-capped - 5shot costs 320 MP
			   at frequency 1.29, which is 414 MP/s against a 1,760 pool, i.e. 4.3
			   seconds of fire - so MP returned converts straight into uptime.
			   Measured 2026-10-05: tshirt9+4 refunds ~10.9% of a 5shot and ~15% of a
			   3shot; at +6 that is 12.5% and 18%.

			   Two caveats on the stat. It DRAINS the target's MP and returns exactly
			   zero against a target with no mp field (the seven cave_* monsters), and
			   it is capped by min(target.mp, ...) with monster mp running at hp/50 -
			   so it is worth full value from roughly 1,000 target HP upward and is
			   clipped to a couple of MP on genuine trash like goo and crab.

			   The operator holds an mrnarmor+7 as well and swaps by target: this slot
			   for sustained fights where MP is the limiter, mrnarmor when incoming
			   damage is. Tier 2 above is the armor one. */
			earring1: { item: 'dexearring', level: 5, method: 'compound' }, helmet: { item: 'fury', level: 8, method: 'upgrade' }, earring2: { item: 'dexearring', level: 5, method: 'compound' }, amulet: { item: 'dexamulet', level: 5, method: 'compound' },
			mainhand: { item: 'bowofthedead', level: 9, method: 'upgrade' }, chest: { item: 'tshirt9', level: 4, method: 'upgrade' }, offhand: { item: 'alloyquiver', level: 9, method: 'upgrade' }, cape: { item: 'ecape', level: 9, method: 'upgrade' },
			ring1: { item: 'suckerpunch', level: 2, method: 'compound' }, pants: { item: 'frankypants', level: 7, method: 'upgrade' }, ring2: { item: 'suckerpunch', level: 2, method: 'compound' }, belt: { item: 'dexbelt', level: 5, method: 'compound' },
			orb: { item: 'orbofdex', level: 5, method: 'compound' }, shoes: { item: 'wingedboots', level: 10, method: 'upgrade' }, gloves: { item: 'supermittens', level: 6, method: 'upgrade' }, elixir: null,
		},
	],
	priest: [
		{
			// Uses the intelligence-stat set (intbelt/intamulet). orbg@1
			// -> MerchantComments.md#earring1-2
		},
		{
			// Cape is Grinch's Cape (gcape)@7, upgrade - confirmed by user.
			earring1: { item: 'cearring', level: 3, method: 'compound' }, helmet: { item: 'xhelmet', level: 6, method: 'upgrade' }, earring2: { item: 'cearring', level: 3, method: 'compound' }, amulet: { item: 'intamulet', level: 4, method: 'compound' },
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
			// -> MerchantComments.md#earring1-3
		},
		{
			earring1: { item: 'cearring', level: 3, method: 'compound' }, helmet: { item: 'mmhat', level: 7, method: 'upgrade' }, earring2: { item: 'cearring', level: 3, method: 'compound' }, amulet: { item: 'intamulet', level: 4, method: 'compound' },
			/* CHEST IS mmarmor+7, NOT coat+9, as of 2026-10-05. Measured stats:
			     coat+9      armor 13  resistance 11  stat 15
			     mmarmor+7   armor 62  resistance 51  stat 10
			   so on the item alone the swap is +49 armor and +40 resistance for -5 int.

			   THE SET BONUS IS THE REST OF THE REASON. mmhat and mmarmor are both
			   set:'mmage', and the helmet in this same row is already mmhat+7, so this
			   lands a TWO-PIECE bonus of int 2 - which pulls the net cost of the swap
			   down to -3 int. G.sets.mmage, measured:
			     2 pieces  int 2
			     3 pieces  speed 2, int 3
			     4 pieces  rpiercing 40
			     5 pieces  crit 2, phresistance 25, stresistance 20
			   Those are the RAW design numbers the client is served. The server
			   accumulates them at load (server_functions.js:247 walks i=2..n adding
			   set[i-1] into set[i]), so what is actually worn at 3 pieces is int 5 and
			   speed 2, and at 4 pieces int 5, speed 2 AND rpiercing 40. The 2-piece
			   value is the same either way, because tier 1 is empty.

			   rpiercing at 4 pieces is worth noting for later: the mage is a magical
			   class, so rpiercing is its LIVE piercing stat (server.js zeroes
			   apiercing on a magical hit), and 40 of it is roughly +4 points on the
			   damage multiplier. mmgloves (8 tokens) and mmpants (11) are the cheapest
			   route to it if that becomes worth chasing.

			   mmarmor IS TOKEN-ONLY - 12 monstertokens from the monsterhunter, no NPC
			   gold price, no Ponty entry, zero market asks. Safe rather than a stall:
			   gatherPlanCandidates only walks character.items, so a plan target is the
			   goal for a copy already in hand, never a shopping list.

			   grades are [0,7,10,12] - identical to mrnarmor and mmhat - so +7 is the
			   crossing into grade 2. Expected cost to +7 at live prices is 6.9 copies
			   (83 tokens); do not raise this casually, since +8 and +9 run to about a
			   billion gold-equivalent. -> MerchantComments.md#mmarmor */
			mainhand: { item: 'firestaff', level: 9, method: 'upgrade' }, chest: { item: 'mmarmor', level: 7, method: 'upgrade' }, offhand: { item: 'wbook0', level: 4, method: 'compound' }, cape: { item: 'ecape', level: 7, method: 'upgrade' },
			ring1: { item: 'cring', level: 3, method: 'compound' }, pants: { item: 'frankypants', level: 6, method: 'upgrade' }, ring2: { item: 'cring', level: 3, method: 'compound' }, belt: { item: 'intbelt', level: 4, method: 'compound' },
			orb: { item: 'jacko', level: 3, method: 'compound' }, shoes: { item: 'wingedboots', level: 8, method: 'upgrade' }, gloves: { item: 'supermittens', level: 5, method: 'upgrade' }, elixir: null,
		},
		{
			/* Mainhand is the Spark Staff, a two-handed great_staff - hence no offhand.
			   CORRECTED 2026-10-02: this row said gstaff (Blaster) by mistake. Blaster is
			   stronger at the same level (153 attack / 140 range at +9 against sparkstaff's
			   140 / 130) but its grade thresholds are [0,0,9,10] against sparkstaff's
			   [0,5,10,12], so it sits in an expensive band from level zero, and it costs
			   1,240,000 against 224,000. MageofOz is already on sparkstaff+6, which beats a
			   fully upgraded tier-2 firestaff+9 on both attack and range. */
			earring1: { item: 'cearring', level: 5, method: 'compound' }, helmet: { item: 'mmhat', level: 9, method: 'upgrade' }, earring2: { item: 'cearring', level: 5, method: 'compound' }, amulet: { item: 'intamulet', level: 5, method: 'compound' },
			mainhand: { item: 'sparkstaff', level: 9, method: 'upgrade' }, chest: { item: 'tshirt9', level: 6, method: 'upgrade' }, offhand: null, cape: { item: 'ecape', level: 9, method: 'upgrade' },
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
// -> MerchantComments.md#buildCosts
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
// -> MerchantComments.md#BUYABLE_OFFERING_INDICES
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
	/* The server adds item_def.igrace here, NOT igrade, and igrace is a
	   PENALTY assigned at boot - igrade 0 -> +1, igrade 1 -> -1, igrade 2 ->
	   -2 (server_functions.js). Using igrade added +1 where the server
	   subtracts 1, so a fresh copy of any igrade-1 item scored grace 1 where
	   the server scores 0, and every chance this returned was optimistic.
	   That is the wrong direction for a function whose output decides whether
	   to gamble a 100,000,000-gold item.

	   The player and server grace pools (player.p.ugrace[new_level],
	   S.ugrace[new_level], player.p.ograce) are real and non-zero in play but
	   are not readable from the client, so they stay at zero: the conservative
	   floor, and the same choice UpgradeCompound.js makes deliberately. */
	const igrace = igrade === 0 ? 1 : (igrade === 1 ? -1 : -2);
	let grace = Math.max(0, Math.min(new_level + 1, (item.grace || 0) + igrace));
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
// -> MerchantComments.md#pickBestUpgradeStep
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


// ============================================================================
// VALUE-INCLUSIVE STEP PLANNING - tier 2 / tier 3
//
// The original pickBestUpgradeStep/pickBestCompoundStep minimise cost/chance,
// where 'cost' is scroll + offering ONLY. The copy going into the roll is not
// in the arithmetic, so a 1,000-gold scroll on a 100,000,000-gold item scores
// as the cheapest move available. It is the cheapest move only if the item is
// free. This is what was lost with the starkillers.
//
// The fix is the recurrence UpgradeCompound.js already uses:
//     upgrade    C(L+1) = (    C + scroll + offering) / p
//     compound   C(L+1) = (3 * C + scroll + offering) / p
// Adding the copy's value to the numerator shifts the optimum toward a higher
// success rate, because the constant amplifies what p buys. That is the whole
// behavioural difference.

// Lucas (the 'scrolls' NPC) stocks grades 0-2 of both scroll lines. Grade 3
// and 4 exist in G.items but NO NPC sells either, so a step needing one is a
// step this script cannot supply - it hands over rather than stall holding a
// half-built item. Measured from live NPC stock, not inferred from price.
const NPC_MAX_SCROLL_GRADE = 2;

// Ponty restocks these often enough that his price is the honest replacement
// cost. USER-CONFIRMED list - do not extend it by reading G.items[x].g, which
// is a weak anchor: starkillers' g is 7,800,000 against ~100,000,000 actually
// paid, a 12.8x gap.
const PONTY_PRICED_ITEMS = new Set(['harmor', 'firebow', 'dexearring', 'frankypants', 'wbook0', 'coat', 'dexbelt']);

// YOUR values, checked FIRST and beating every other source, a live market read
// included. Deliberately EMPTY: this table is the operator's lever, so anything
// in it is a decision rather than a leftover. The derived numbers live in
// GEAR_VALUE_FALLBACK below and are overridden by whatever you put here.
const GEAR_VALUE_OVERRIDES = {
	// gcape: 2000000000,
};

// Last resort, consulted ONLY when there is no override, no Ponty price, and no
// pair of agreeing market anchors. A live anchor BEATS these, which is the
// point: they keep the planner working while the market is silent, they are not
// a claim about what an item is worth today.
/* Provenance, so a later reader can argue with them instead of guessing. The
   market figures are the dearest credible live anchor at +0, measured
   2026-10-04; a bid is quoted in preference to an ask where both exist,
   because gold is committed behind it.
     gcape, sbelt, tshirt9   operator's flat value, 2026-10-03
     mpxgloves 3,000,000,000 and zapper 2,000,000,000   +0 buy orders
     suckerpunch             +0 ask 2,000,000,000, against a 30-deep bid at
                             1,100,000,000 - 1.8x apart, so both are credible
     fury 300,000,000        +0 buy order, 10 deep
     mpxamulet 300,000,000   +0 buy order
     starkillers             just under 100,000,000 actually paid
     sparkstaff 12,227,542   +7 ask 320,000,000 back-solved through the
                             recurrence; agrees with the 18-deep +0 bid at
                             5,000,000 to within 2.45x
     rabbitsfoot             120 funtokens x 1,050,000 bid
     mmhat                   7 monstertokens x 1,500,000 ask
     frankypants, harmor     Ponty price (g x 1.2), which matches the live ask
     mshield 720,000         +0 market bid, which beat the 10-funtoken route
     firestaff, firebow      +0 ask
     ecape 126,000           exactly 1/1000 of rabbitsfoot: both drop from
                             basketofeggs at weights 1 and 0.001 of 5.721, so
                             the ratio holds whatever a basket costs. Within 9%
                             of the basket's own Ponty price, and the market
                             cannot price it - its three live anchors back-solve
                             to 1, 548,887 and 29,473,137.

   NEVER set one of these from G.items[x].g. That is a vendor number, not a
   market one, and it is wrong by orders of magnitude exactly where it matters:
   tshirt9's g is 120 against a real 2,000,000,000, and zapper's 6,400,000
   against a live 2,000,000,000 buy order. A fallback BELOW the true value is
   the dangerous direction - it tells the planner the copy is cheap, so it rolls
   on with a cheap scroll instead of handing over. That is how the starkillers
   were lost. */
const GEAR_VALUE_FALLBACK = {
	mpxgloves:   3000000000,
	gcape:       2000000000,
	sbelt:       2000000000,
	tshirt9:     2000000000,
	suckerpunch: 2000000000,
	zapper:      2000000000,
	fury:        300000000,
	mpxamulet:   300000000,
	rabbitsfoot: 126000000,
	starkillers: 100000000,
	sparkstaff:  12227542,
	mmhat:       10500000,
	frankypants: 936000,
	mshield:     720000,
	harmor:      576000,
	firestaff:   500000,
	firebow:     267000,
	ecape:       126000,
};

// Two independent anchors disagreeing by more than this factor means at least
// one is a parking price, and there is no way to tell which. Neither is
// trusted: the item hands over and the divergence is logged so a value can be
// added above. Real g-to-paid gaps reach 13x, so this is deliberately loose -
// it is here to catch 80x, not 2x.
const VALUE_DIVERGENCE_LIMIT = 3;

/* Items the value planner has handed over, as 'name|level' keys. Recorded by
   attemptBestPlanStep and read by the next bank pass, so a price appearing
   later simply drops the item from the set instead of needing an un-bank. */
let gearHeldKeys = new Set();
const gearHeldKey = (item) => item.name + '|' + (item.level || 0);

/* The last stop before handing an item over. Reached only once every live
   source has failed, so 'why' carries the reason the market could not answer
   and stays in the log line whether or not a fallback exists. */
function gvFallback(name, why) {
	const fb = GEAR_VALUE_FALLBACK[name];
	if (fb != null) return { value: fb, src: 'fallback ' + fb + ' (' + why + ')' };
	return { value: null, src: why };
}

/* What losing one +0 copy actually costs - the number the old path omitted.
   Order: user override, then Ponty for the items he reliably carries, then the
   live market, then nothing. Reuses gtQuote, which already returns cheapest
   ask AND best bid with an age bound; a standing buy order is as real an
   anchor as an ask, since somebody is holding gold against it.

   A null value is a RESULT, not a failure: it means hand the item over and
   tell the user to price it. */
function gvBaseValue(name, rows) {
	const ov = GEAR_VALUE_OVERRIDES[name];
	if (ov != null) return { value: ov, src: 'override' };

	let ponty = null;
	try { ponty = scoutItemPrice({ name: name, level: 0 }); } catch (e) { ponty = null; }

	if (PONTY_PRICED_ITEMS.has(name)) {
		if (ponty != null) return { value: ponty, src: 'ponty ' + ponty };
		return gvFallback(name, 'ponty price unavailable');
	}

	const q = rows ? gtQuote(rows, name, 0) : null;
	const anchors = [];
	if (q && q.ask != null) anchors.push(['ask', q.ask]);
	if (q && q.bid != null) anchors.push(['bid', q.bid]);
	if (ponty != null) anchors.push(['ponty', ponty]);
	if (!anchors.length) return gvFallback(name, 'no anchor');

	let lo = anchors[0][1], hi = anchors[0][1];
	for (const a of anchors) { if (a[1] < lo) lo = a[1]; if (a[1] > hi) hi = a[1]; }
	const detail = anchors.map((a) => a[0] + ' ' + a[1]).join(' vs ');
	if (lo > 0 && hi / lo > VALUE_DIVERGENCE_LIMIT) {
		return gvFallback(name, 'anchors disagree (' + detail + ')');
	}
	// Replacement cost, so the dearest credible anchor is the right one.
	return { value: hi, src: 'max of ' + detail };
}

/* What the copy IN HAND is worth, which is what the recurrence needs as its
   input - not the +0 price. A +7 copy embodies every roll that got it there,
   so feeding the +0 price into the arithmetic repeats the original omission
   one level up: the offering never looks worth buying because it is being
   compared against a fraction of the real stake.

   Preference is the live market at THIS level, since that is the actual
   replacement cost, falling back to walking the recurrence up from +0 for the
   levels nobody trades - which is most of them above about +4. */
function gvCarriedValue(name, level, rows, baseValue, mode) {
	if (!level) return { value: baseValue, src: 'base' };

	const q = rows ? gtQuote(rows, name, level) : null;
	if (q) {
		const seen = [];
		if (q.ask != null) seen.push(q.ask);
		if (q.bid != null) seen.push(q.bid);
		if (seen.length) {
			const lo = Math.min.apply(null, seen), hi = Math.max.apply(null, seen);
			if (!(lo > 0 && hi / lo > VALUE_DIVERGENCE_LIMIT)) {
				return { value: hi, src: 'market at +' + level };
			}
		}
	}

	const costs = mode === 'compound' ? COSTS.cscroll : COSTS.scroll;
	const chanceOf = mode === 'compound' ? getCompoundChance : getUpgradeChance;
	const mult = mode === 'compound' ? 3 : 1;
	let C = baseValue;
	for (let L = 0; L < level; L++) {
		const at = { name: name, level: L };
		const g = item_grade(at);
		let bestNext = null;
		for (let s = g; s <= Math.min(g + 1, NPC_MAX_SCROLL_GRADE); s++) {
			for (const o of BUYABLE_OFFERING_INDICES) {
				const { chance } = chanceOf(at, s, o);
				if (!chance) continue;
				const nx = (mult * C + costs[s] + COSTS.offering[o]) / Math.min(chance, 1);
				if (bestNext == null || nx < bestNext) bestNext = nx;
			}
		}
		// Not walkable this far with NPC stock - keep the best value proven so
		// far rather than inventing one.
		if (bestNext == null) break;
		C = bestNext;
	}
	return { value: C, src: 'recurrence from +0' };
}

/* The tier-1 target level for an item, using PARTY_CLASSES order as the
   attribution priority when a name appears in more than one class's tier 1 -
   the same priority the stand/delivery path already uses for shared-name
   arrivals. Only intamulet currently differs (priest 2, mage 1 -> 2).
   Returns null for an item tier 1 does not mention at all. */
function tier1TargetLevel(itemName) {
	for (const cls of PARTY_CLASSES) {
		const tiers = GEAR_PROGRESSION[cls];
		const tier1 = tiers && tiers[0];
		if (!tier1) continue;
		for (const slotName in tier1) {
			const entry = tier1[slotName];
			if (entry && entry.item === itemName) {
				try { return decodeLevel(entry.level); } catch (e) { return null; }
			}
		}
	}
	return null;
}

/* Tier-1 levels keep the original materials-only economics: those items are
   cheap enough that the scroll dominates and losing one costs little. At and
   above the tier-1 target - and for every item tier 1 never mentions - the
   copy is worth more than the materials, so the value-inclusive path takes
   over.

   NOTE: GEAR_PROGRESSION's tier-1 objects are currently EMPTY (the lists live
   in MerchantComments.md under #earring1 / #earring1-2 / #earring1-3 and have
   never been pasted in), so today this answers true for every item. It starts
   splitting the moment tier 1 is populated - 11 of the 37 plan items are
   shared with tier 1 and would then route by level. */
function usesValuePlanning(itemName, level) {
	const t1 = tier1TargetLevel(itemName);
	if (t1 === null) return true;
	return (level || 0) >= t1;
}

/* One step, chosen with the copy's value in the arithmetic. 'carriedValue' is
   the worth of ONE copy at its CURRENT level - see gvCarriedValue - not the
   +0 price.

   The clamp on 'chance' is load-bearing. The game's own cap lets probability
   exceed 1 - the server rolls Math.random() < probability, so anything >= 1
   just means certain - and dividing by an unclamped 1.24 reports a next level
   CHEAPER than the copy going into it, which cannot happen. getUpgradeChance
   already clamps; this does not rely on that staying true.

   Returns { stop } instead of a step when the cheapest move wants an offering
   or a scroll no NPC sells. Neither is an error: both are the hand-over point
   the user asked for, where UpgradeCompound.js or a manual roll takes over. */
function pickBestValueStep(item, mode, carriedValue) {
	const level = item.level || 0;
	const grade = item_grade(item);
	const names = mode === 'compound' ? SCROLL_NAMES.compound : SCROLL_NAMES.upgrade;
	if (grade > NPC_MAX_SCROLL_GRADE) {
		return { stop: 'scroll_not_npc_buyable: +' + level + ' is grade ' + grade + ', needs ' + names[grade] };
	}
	const costs = mode === 'compound' ? COSTS.cscroll : COSTS.scroll;
	const chanceOf = mode === 'compound' ? getCompoundChance : getUpgradeChance;
	const inputs = (mode === 'compound' ? 3 : 1) * carriedValue;

	let best = null;
	for (let s = grade; s <= Math.min(grade + 1, NPC_MAX_SCROLL_GRADE); s++) {
		for (const o of BUYABLE_OFFERING_INDICES) {
			const { chance } = chanceOf(item, s, o);
			if (!chance) continue;
			const p = Math.min(chance, 1);
			const cost = costs[s] + COSTS.offering[o];
			const next = (inputs + cost) / p;
			if (!best || next < best.next) {
				best = {
					scrollIdx: s, offeringIdx: o, chance: p, cost: cost, next: next, inputs: inputs,
					expectedCost: cost / p,
					scrollName: names[s], offeringName: OFFERING_NAMES[o],
				};
			}
		}
	}
	if (!best) return { stop: 'no NPC-buyable ' + mode + ' scroll is legal at +' + level };
	if (best.offeringIdx > 0) {
		return {
			stop: 'wants_offering: cheapest move at +' + level + ' is ' + best.scrollName + ' + '
				+ best.offeringName + ' at ' + (best.chance * 100).toFixed(1) + '%',
			step: best,
		};
	}
	return { step: best };
}

/* The held list repeats every pass while nothing changes, so it logs once per
   distinct set and then stays quiet. Unthrottled this is the same few lines
   every 30 seconds, forever. */
const gearHold = { key: '', at: 0 };
const GEAR_HOLD_LOG_MS = 10 * 60 * 1000;
function gearHoldLog(held) {
	const key = held.map((h) => h.key + ' ' + h.why).sort().join(' | ');
	if (!key) return;
	if (key === gearHold.key && Date.now() - gearHold.at < GEAR_HOLD_LOG_MS) return;
	gearHold.key = key;
	gearHold.at = Date.now();
	game_log('Gear plan handing ' + held.length + ' item(s) over for manual upgrade:', '#FFD700');
	for (const h of held) game_log('  ' + h.key.replace('|', ' +') + ' - ' + h.why, '#8b98ab');
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
// -> MerchantComments.md#SCROLL_NPC
const SCROLL_NPC = { name: 'Lucas', map: 'main', x: -464, y: -96 };
const OFFERING_NPC = { name: 'Garwyn', map: 'main', x: 192, y: -564 };
const THIEF_NPC = { name: 'Crun', map: 'level2', x: -133, y: -187 };

// Maps each purchasable material name to the NPC that actually sells it.
// -> MerchantComments.md#MATERIAL_VENDORS
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

// Walk to ONE place and buy everything from there.
// -> MerchantComments.md#ensureUpgradeMaterials
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


/* DEPOSIT EXCHANGEABLES, BUT NEVER TRAVEL FOR THEM. The operator's rule,
   2026-10-03: bank them when he is at the bank anyway, and do not spend a trip
   on it. So this refuses to move - it is a sweep, not an errand - and the only
   thing that ever calls it is the arrival wrapper below.

   WHY character.bank IS CHECKED AS WELL AS THE MAP. bank_store() rejects with
   "not_in_bank" unless character.bank is populated, and it populates on arrival
   rather than with the map change - arbStockRetrieve already carries a branch
   for "at the bank but character.bank is empty". An empty read here is a quiet
   return, not an error: the next bank visit picks the items up.

   SLOT PRESSURE IS LARGELY IMAGINARY HERE. bank_store() with no pack argument
   prefers a slot it can STACK into, and nearly every exchangeable is stackable
   (gem0 is s:true), so a sweep usually merges into a stack it already owns
   instead of consuming a slot. storage_full still ends the sweep rather than
   retrying, and the goods simply stay in inventory for next time.

   IT MUST NOT THROW. travelToBank is awaited in boolean position at every call
   site - `if (!(await travelToBank()))` - so a rejection escaping this sweep
   would not return false, it would blow up the caller. That is CLAUDE.md's
   Form A, and it cost three rangers an afternoon. Hence the catch, and hence
   the catch logs: a silent default is indistinguishable from a working one.
   -> MerchantComments.md#bankExchangeables */
async function bankExchangeables() {
	const names = exchangeableNames();
	if (character.map !== CONFIG.bank.map) return 0;   // never travels, by design
	if (!character.bank) return 0;                     // arrived, not open yet

	// Highest index first, matching bankFullyProgressedItems. A store nulls the
	// slot in place rather than shifting (server.js: player.items[inv] = null),
	// so this is belt-and-braces rather than load-bearing.
	const todo = [];
	let locked = 0;
	for (let i = character.items.length - 1; i >= 0; i--) {
		const it = character.items[i];
		if (!it || !it.name || !(names.has(it.name) || isKeptMaterial(it.name))) continue;
		if (it.b) continue;                        // blocked - the server refuses it
		if (it.l === 'l') { locked++; continue; }  // the operator's own hands-off marker
		if (arbHeldNames()[it.name]) continue;     // arbitrage owns this exit (arbBankItem)
		todo.push(i);
	}
	if (locked) {
		game_log('[exch] leaving ' + locked + ' locked exchangeable(s) in inventory - '
			+ 'unlock them if you want them banked', '#8b98ab');
	}
	if (!todo.length) return 0;

	let stored = 0;
	for (const idx of todo) {
		const name = character.items[idx] && character.items[idx].name;
		try {
			await bank_store(idx);
			stored++;
			await sleep(300);
		} catch (e) {
			const why = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
			game_log('[exch] bank_store failed for ' + (name || 'slot ' + idx) + ' - ' + why, 'red');
			if (why === 'storage_full') break;   // nothing later will fit either
		}
	}
	if (stored) game_log('[exch] banked ' + stored + ' exchangeable item(s)', '#00FF00');
	return stored;
}

/* The arrival wrapper. Every bank visit in the script goes through
   travelToBank, which makes it the one choke point where "we are at the bank
   for some other reason" is true - the ponty and stand-buy runs, the
   fully-progressed gear sweep, arbitrage's stock retrieval and its abandoned
   -stock banking all land here. Hooking the sweep on arrival therefore covers
   every one of them without any of them creating a trip. */
async function travelToBank() {
	const arrived = await travelToBankRaw();
	if (arrived) {
		try { await bankExchangeables(); }
		catch (e) { game_log('[exch] sweep threw and was swallowed - ' + (e && (e.reason || e.message) || e), 'red'); }
	}
	return arrived;
}

async function travelToBankRaw() {
	if (character.map === CONFIG.bank.map) return true;
	try {
		await moveTo({ to: 'bank' });
		return true;
	} catch (e) {
		game_log(`smart_move to bank failed: ${e.reason || e} - trying town() fallback first`, 'red');
	}
	try {
		await moveTown();
		await moveTo({ to: 'bank' });
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
		/* Held items are banked even though they still have plan room: the value
		   planner has handed them over, and leaving them in inventory means
		   re-deciding the same dead end every pass. */
		if (findCandidacy(item) && !gearHeldKeys.has(gearHeldKey(item))) return;
		toBank.push(idx);
	});

	/* KEPT MATERIALS RIDE AN EXISTING TRIP; THEY NEVER CAUSE ONE.

	   CONFIG.materials.keepAndBank has always been documented as "never
	   vendored and banked on sight", but isKeptMaterial() was only ever read by
	   the two sell guards - nothing banked anything. essenceofether has been
	   protected-but-never-banked since the list was created. This is the
	   missing half.

	   Collected AFTER the !toBank.length check on purpose. The operator's
	   instruction was to bank them on EXISTING bank trips, so a pile of
	   stormfeather must not be able to pull the merchant off arbitrage for a
	   walk of its own. If gear is already going, they go too; otherwise they
	   wait, costing nothing but an inventory slot they were occupying anyway. */
	if (!toBank.length) return false;

	const gearSlots = new Set(toBank);
	character.items.forEach((item, idx) => {
		if (item && item.name && isKeptMaterial(item.name)) toBank.push(idx);
	});

	const arrived = await travelToBank();
	if (!arrived) return false;

	/* ONE combined pass, highest index first. The two lists must NOT be stored
	   separately: bank_store nulls the slot and the indices behind it shift, so
	   a second list captured beforehand would be pointing at the wrong items by
	   the time it ran. That is the whole reason the original loop sorted
	   descending, and splitting it would have quietly undone the guarantee. */
	for (const idx of toBank.sort((a, b) => b - a)) {
		const itemName = character.items[idx]?.name;
		const label = gearSlots.has(idx) ? 'fully-progressed' : 'kept material';
		try {
			await bank_store(idx);
			game_log(`Banked ${label} ${itemName ?? 'item'}`, '#00FF00');
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
// -> MerchantComments.md#findBaseDuplicateGroup
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

/* ============================================================================
   GEAR TRIPWIRE - four reasons not to attempt a gear step.
   -> MerchantComments.md#gearTripwire

   The gear system optimises cost-per-success and nothing else, so it will
   happily grind something worth less than the scrolls, duplicate gear the
   party already wears, or chase a compound whose missing copies are not for
   sale at any price. Measured 2026-09-25, all three were live:

     - firebow +5 costs 15,054,400 to buy and 39,722,105 to build from a +5
       base (38% success, 2.63 bases consumed). Building was 1.7x WORSE, and
       nothing in the chooser could see that.
     - Dexon already had firebow +7 equipped while the plan ground a spare
       toward +5.
     - ZERO dexearrings were for sale on any shard, in either feed, while all
       three plan candidates were dexearring compounds needing 3 copies each.
       That plan could never complete and was re-evaluated every cycle anyway.

   DEFAULT IS 'off'. In 'observe' every step is judged and logged and nothing
   is blocked, which is the intended way to watch it before trusting it.

   Every predicate FAILS OPEN. Missing market data, stale party info or a
   thrown lookup must never block a step - a tripwire that silently stops all
   gear work because a fetch failed is worse than the behaviour it replaces.
   ============================================================================ */
const GT_LOG_KEY = 'gear_tripwire_log';
const GT = { rows: null, at: 0, inflight: null };

function gtMode() {
	const m = (CONFIG.gearTripwire && CONFIG.gearTripwire.mode) || 'off';
	return (m === 'observe' || m === 'enforce') ? m : 'off';
}

// One market read shared by every candidate in a visit.
async function gtMarket() {
	const ttl = (CONFIG.gearTripwire && CONFIG.gearTripwire.marketCacheMs) || 120000;
	if (GT.rows && (Date.now() - GT.at) < ttl) return GT.rows;
	if (GT.inflight) return await GT.inflight;
	GT.inflight = (async function () {
		try {
			const got = await arbProbeMarketRows();
			GT.rows = (got && got.rows) || [];
			GT.at = Date.now();
		} catch (e) {
			gtLog('market read failed: ' + (e && e.message ? e.message : e));
			GT.rows = null;          // fail open - no data means no blocking
		} finally {
			GT.inflight = null;
		}
		return GT.rows;
	})();
	return await GT.inflight;
}

/* Cheapest ask and best bid for one item at one level, honouring the age
   bound. Returns nulls rather than guesses when nothing qualifies. */
function gtQuote(rows, name, level) {
	const maxAge = (CONFIG.gearTripwire && CONFIG.gearTripwire.marketMaxAgeSec) || 1800;
	let ask = null, bid = null, askN = 0, bidN = 0;
	for (const r of (rows || [])) {
		const age = pAgeSec(r.lastSeen);
		if (age != null && age > maxAge) continue;
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || sl.name !== name) continue;
			if ((sl.level || 0) !== level) continue;
			if (!(typeof sl.price === 'number' && isFinite(sl.price))) continue;
			if (sl.b) { bidN++; if (bid == null || sl.price > bid) bid = sl.price; }
			else { askN++; if (ask == null || sl.price < ask) ask = sl.price; }
		}
	}
	return { ask: ask, bid: bid, askCount: askN, bidCount: bidN };
}

// What the item is worth to us: what someone will pay, else what one costs.
function gtValue(q) {
	if (!q) return null;
	if (q.bid != null) return q.bid;
	if (q.ask != null) return q.ask;
	return null;
}

/* What the recipient already wears in this slot, from the party_link cache.
   parent.party carries no slots and parent.entities is proximity-bound, so
   cstore_<name>_newparty_info is the only source that works while the party
   is off farming - verified 2026-09-25 against Dexon's own tab. */
function gtEquipped(who, slotName) {
	try {
		const raw = parent.localStorage.getItem('cstore_' + who + '_newparty_info');
		if (!raw) return null;
		const d = JSON.parse(raw);
		if (!d) return null;
		const ls = d.lastSeen != null ? (typeof d.lastSeen === 'number' ? d.lastSeen : Date.parse(d.lastSeen)) : null;
		const maxAge = (CONFIG.gearTripwire && CONFIG.gearTripwire.partyInfoMaxAgeSec) || 600;
		if (ls == null || (Date.now() - ls) / 1000 > maxAge) return null;   // too stale to judge
		const sl = (d.slots || {})[slotName];
		if (!sl || !sl.name) return null;
		return { name: sl.name, level: sl.level || 0 };
	} catch (e) { return null; }
}

/* Which party member wears this class's gear. parent.party carries a `type`
   field per member (verified live), so the mapping is read rather than
   hardcoded and survives a roster change. */
function gtRecipientFor(cls) {
	try {
		const p = parent.party || {};
		for (const n in p) {
			if (n === character.name) continue;
			if (p[n] && p[n].type === cls) return n;
		}
	} catch (e) { }
	return null;
}

function gtLog(text, extra) {
	try {
		const a = get(GT_LOG_KEY) || [];
		a.push(Object.assign({ at: new Date().toISOString(), text: text }, extra || {}));
		const cap = (CONFIG.gearTripwire && CONFIG.gearTripwire.logSize) || 80;
		while (a.length > cap) a.shift();
		set(GT_LOG_KEY, a);
	} catch (e) { }
}

function gtHoldsOffering() {
	try {
		return character.items.filter(Boolean).some(function (i) { return /^offering/.test(i.name); });
	} catch (e) { return false; }
}

/* THE VERDICT. Returns { allow, blocks:[...], detail }. Never throws. */
async function gtJudge(candidate, step) {
	const out = { allow: true, blocks: [], detail: {} };
	if (gtMode() === 'off') return out;
	try {
		const name = candidate.item.name;
		const level = candidate.item.level || 0;
		const rows = await gtMarket();
		out.detail.item = name + ' +' + level;
		out.detail.method = candidate.method;

		// --- 4. valuable, and no offering to protect it
		const selfQ = rows ? gtQuote(rows, name, level) : null;
		const selfVal = gtValue(selfQ);
		out.detail.itemValue = selfVal;
		const breakEven = (CONFIG.gearTripwire && CONFIG.gearTripwire.breakEvenGold) || 10500000;
		if (selfVal != null && selfVal >= breakEven && !gtHoldsOffering()) {
			out.blocks.push('valuable_no_offering');
			out.detail.breakEven = breakEven;
		}

		// --- 1. buying the finished item beats building it (upgrades only)
		if (candidate.method !== 'compound' && rows && step && step.chance > 0) {
			const nextQ = gtQuote(rows, name, level + 1);
			const p = step.chance;
			const basePrice = selfQ ? selfQ.ask : null;
			if (nextQ && nextQ.ask != null && basePrice != null) {
				const build = step.cost / p + ((1 - p) / p) * basePrice;
				out.detail.buildCost = Math.round(build);
				out.detail.finishedAsk = nextQ.ask;
				if (nextQ.ask < build) out.blocks.push('buy_beats_build');
			}
		}

		// --- 2. the recipient already has as good or better
		const who = gtRecipientFor(candidate.class);
		const slotName = candidate.slot || null;
		if (who && slotName) {
			const eq = gtEquipped(who, slotName);
			out.detail.recipient = who;
			out.detail.equipped = eq ? (eq.name + ' +' + eq.level) : null;
			if (eq && eq.name === name && eq.level >= (level + 1)) out.blocks.push('no_improvement');
		}

		// --- 3. a compound whose missing copies cannot be bought
		if (candidate.method === 'compound') {
			let owned = 0;
			try {
				owned = character.items.filter(Boolean).filter(function (i) {
					return i.name === name && (i.level || 0) === level;
				}).length;
			} catch (e) { owned = 0; }
			out.detail.copiesOwned = owned;
			if (owned < 3 && rows) {
				const forSale = gtQuote(rows, name, level).askCount;
				out.detail.copiesForSale = forSale;
				if (forSale === 0) out.blocks.push('inputs_unobtainable');
			}
		}

		out.allow = out.blocks.length === 0;
	} catch (e) {
		// Fail open, loudly. -> MerchantComments.md#gtFailOpen
		gtLog('judge threw, allowing step: ' + (e && e.message ? e.message : e));
		return { allow: true, blocks: [], detail: { threw: true } };
	}
	return out;
}

function gearProbeTripwire(n) {
	let a = [];
	try { a = get(GT_LOG_KEY) || []; } catch (e) { }
	const tally = {};
	a.forEach(function (r) { (r.blocks || []).forEach(function (b) { tally[b] = (tally[b] || 0) + 1; }); });
	return pShow({
		mode: gtMode(),
		config: JSON.parse(JSON.stringify(CONFIG.gearTripwire || {})),
		entries: a.length,
		blockTally: tally,
		recent: a.slice(-(n || 20)),
	});
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

	/* One market read serves every valuation in this pass, and only when
	   something actually needs one. gtMarket caches across the visit and
	   fails open, so a dead market means no value and therefore a hand-over,
	   never a blind roll. */
	let vpRows = null;
	if (candidates.some((c) => usesValuePlanning(c.item.name, c.item.level || 0))) {
		vpRows = await gtMarket();
	}

	let best = null;
	const held = [];
	for (const c of candidates) {
		const level = c.item.level || 0;
		let step = null, group = null;
		if (c.method === 'compound') {
			group = findCompoundGroup(character.items, c.item.name, level);
		}

		/* Tier-2/3 items - and any level at or above a tier-1 target - are
		   planned with the copy's own value counted, and hand over rather
		   than gamble once the cheapest move needs something this script
		   cannot buy from an NPC.

		   Deliberately independent of CONFIG.gearTripwire.mode. This gate is
		   the operator's banking rule; the tripwire's four reasons are a
		   separate judgement that is still off by default, and turning one
		   on must not quietly turn on the other. */
		if (usesValuePlanning(c.item.name, level)) {
			const mode = c.method === 'compound' ? 'compound' : 'upgrade';
			const val = gvBaseValue(c.item.name, vpRows);
			if (val.value == null) {
				held.push({ key: gearHeldKey(c.item), why: 'value_unknown: ' + val.src });
				continue;
			}
			/* The stake is the copy in hand, not a fresh one. */
			const carried = gvCarriedValue(c.item.name, level, vpRows, val.value, mode);
			const plan = pickBestValueStep(c.item, mode, carried.value);
			if (plan.stop) {
				held.push({ key: gearHeldKey(c.item), why: plan.stop });
				continue;
			}
			step = plan.step;
		} else {
			step = c.method === 'compound' ? pickBestCompoundStep(c.item) : pickBestUpgradeStep(c.item);
		}

		if (!step || !canAffordStep(currentGold, step.cost)) {
			// Still judge an unbuildable compound: "no 3 copies AND none for
			// sale" is exactly the permanently-stalled case worth reporting.
			if (c.method === 'compound' && !group) {
				const v0 = await gtJudge(c, step);
				if (v0.blocks.length) gtLog('would block: ' + v0.blocks.join(', '), { blocks: v0.blocks, detail: v0.detail, acted: false });
			}
			continue;
		}
		if (c.method === 'compound' && !group) continue; // don't have 3 copies yet

		const v = await gtJudge(c, step);
		if (v.blocks.length) {
			const enforcing = gtMode() === 'enforce';
			gtLog((enforcing ? 'BLOCKED: ' : 'would block: ') + v.blocks.join(', '),
				{ blocks: v.blocks, detail: v.detail, acted: enforcing });
			game_log('Gear tripwire ' + (enforcing ? 'blocked' : 'flagged') + ' ' + c.item.name
				+ ' +' + level + ': ' + v.blocks.join(', '), enforcing ? 'orange' : '#8b98ab');
			if (enforcing) continue;
		}

		/* Ranked on expected gold for THIS attempt, which is the one figure
		   comparable across both paths. The value-inclusive arithmetic picks
		   the scroll and decides go/hand-over; it does not set the ordering
		   between candidates, where a next-level value and a materials-only
		   expected cost would be different units. */
		if (!best || step.expectedCost < best.step.expectedCost) best = { candidate: c, step: step, group: group };
	}

	/* Rebuilt from scratch every pass, so an item that becomes priceable or
	   affordable again simply stops being held. The bank pass is what moves
	   them out of inventory. */
	gearHeldKeys = new Set(held.map((h) => h.key));
	if (held.length) gearHoldLog(held);

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
// -> MerchantComments.md#gearProgressionLoop
async function gearProgressionLoop() {
	try {
		if (CONFIG.gearProgression.enabled && !state.busy && !PROBE.hold) {
			const hasBankable = character.items.some(item => item && item.name && isKnownGearItem(item.name)
				&& (!findCandidacy(item) || gearHeldKeys.has(gearHeldKey(item))));
			// Gated behind canStartSpending: without this, a plan candidate or
			// -> MerchantComments.md#canSpend
			const canSpend = canStartSpending(character.gold);
			const hasDuplicateGroup = canSpend && !!findBaseDuplicateGroup();
			const hasPlanCandidate = canSpend && gatherPlanCandidates().length > 0;

			if ((hasBankable || hasDuplicateGroup || hasPlanCandidate) && !standDwellHeld()) {
				state.busy = true;
				const wasStandOpen = state.standOpen;
				if (wasStandOpen) {
					try { await close_stand(); state.standOpen = false; } catch (e) { console.error('close_stand failed:', e); }
				}

				if (hasBankable) await bankFullyProgressedItems();

				// One walk, then everything. The bank pass above is its own
				// -> MerchantComments.md#combined
				if (hasDuplicateGroup || hasPlanCandidate) await goToTownSpot();

				/* BATCHED. One walk, many steps - this used to do exactly one
				   attempt per cycle, so the walk cost was paid per attempt. Both
				   calls re-read character.gold each pass, and both return false
				   when nothing is affordable or available, which ends the visit. */
				let steps = 0;
				const cap = CONFIG.gearProgression.maxStepsPerVisit || 12;
				while (steps < cap) {
					const combined = await autoCombineOneBaseDuplicateGroup(character.gold);
					const advanced = combined || await attemptBestPlanStep(character.gold);
					if (!advanced) break;
					steps++;
				}
				if (steps) game_log(`Gear progression: ${steps} step(s) in one visit`, '#00FF00');

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
// -> MerchantComments.md#featuredState
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
	// -> MerchantComments.md#primary-source-structured-game-state
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
// Are we carrying hop sickness right now?
// -> MerchantComments.md#hopSick
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
				/* A DEPLOYED STAND CLAMPS SPEED TO 10, server-side:
				   `if (player.p.stand || player.s.hardshell) player.speed = 10;`
				   Every other mover in this file is covered - travelTo() closes the
				   stand itself, and the raw smart_move sites each close first. These
				   two were the only exceptions, and this is the worst place to have
				   one: the featured player can be anywhere, the chase reruns for a
				   whole 30-minute round, and it was observed crawling out to the
				   party's farm spot at a quarter speed with the stand still up. */
				try { await moveTo(target); } catch (e) { /* keep trying next tick */ }
			}
		} else if (!smart.moving) {
			// Not visible yet (get_player only resolves nearby/visible
			// players) - head straight to the known location from game
			// state instead of waiting for visibility to happen on its own.
			const loc = getFeaturedLocation();
			if (loc) {
				try { await moveTo(loc); } catch (e) { /* keep trying next tick */ }
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
		// -> MerchantComments.md#a-probe-hold-suppresses-this
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
			// -> MerchantComments.md#being-the-target-ourselves-is
			if (name && name === character.name) {
				if (state.selfFeaturedFor !== name) {
					state.selfFeaturedFor = name;
					state.selfFeaturedAt = Date.now();
					game_log('Anniversary: we are the featured player - staying put for others to reach us', '#FF69B4');
				}
			} else if (name && hopSick()) {
				// Hop sickness blocks kiss rewards outright - G's own explanation
				// -> MerchantComments.md#hop-sickness-blocks-kiss-rewards
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
// -> MerchantComments.md#not-called-here-it-now-2

// ============================================================================
// MARKET SCOUTING
// -> MerchantComments.md#scout
// ============================================================================
const scout = {
	up: false,
	probedAt: 0,
	lastPostAt: 0,
	// Findings not yet accepted by the bridge, BUCKETED BY SHARD. Keying only
	// -> MerchantComments.md#shards
	shards: new Map(),      // shardKey -> {shard, stands:Map, ponty}
	pontySeen: {},          // shard -> when Ponty was last read there
	rotIdx: 0,
	cycleStartedAt: 0,      // when the current scout cycle took state.busy
	homeFor: null,          // the anniversary `next` we came home for
	lastReply: null,        // the bridge's most recent rotation/parked hints
};

// change_server RELOADS THE PAGE in a browser tab - the script is destroyed...
// -> MerchantComments.md#scoutSave
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
				/* ITEM-FOR-ITEM TRADES. A slot posted for goods instead of gold
				   carries `want` - {name, q, level?} - and no price.

				   THIS WHITELIST IS WHY THE BRIDGE NEVER HAD IT. Rebuilding
				   every slot from seven named fields silently drops anything
				   the game adds afterwards, and barter listings are exactly
				   that. Measured 2026-10-10: ALData carries `want` on 62 of
				   2,223 slots and the game's own pull_merchants on 23 of 643 -
				   both times on precisely the unpriced slots - while the bridge
				   had 0 of 632. The watchlist page reported "not published by
				   the feed" on the strength of the bridge copy alone, which was
				   wrong about the game and wrong about ALData.

				   cache_item(item, true) strips only grace/o/oo/src, so `want`
				   reaches entities[].slots intact. null here means an ordinary
				   gold listing, which is what every slot looked like before. */
				want: (s.want && s.want.name)
					? { name: s.want.name, q: s.want.q || 1, level: s.want.level }
					: null,
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
// Stands buffered for THIS shard only.
// -> MerchantComments.md#scoutCurrentShardCount
function scoutCurrentShardCount() {
	const e = scout.shards.get(mShardKey());
	return e ? e.stands.size : 0;
}

// Drop this shard's stands before a sweep starts.
// -> MerchantComments.md#scoutResetCurrentShardStands
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
			/* rid is what buy_secondhand() needs, and it is per listing per shard -
			   the bridge's cached /ponty rows cannot supply it, so a purchase can
			   only ever be made from a LIVE read like this one. -> PONTY BUY */
			finish(list.filter((it) => it && it.name).map((it) => ({
				name: it.name, level: it.level || 0, q: it.q || 1, rid: it.rid || null,
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

// calculate_item_value() returns what Ponty PAID - buy_to_sell is already in
// -> MerchantComments.md#scoutItemPrice
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

/* Server gate: simple_distance(G.maps.main.ref.secondhands, player) > 500 ->
   game_response "distance". ref.secondhands is absent from the client map data,
   so npcs[] is the position of record - (106,-47), which reproduces the 286.1
   measured from the town spot exactly. simple_distance ignores the map;
   requiring main is the conservative reading and costs nothing.
   -> MerchantComments.md#do-not-walk-to-him */
function scoutPontyDistance() {
	const m = parent && parent.G && parent.G.maps && parent.G.maps.main;
	const npc = m && (m.npcs || []).find((n) => n && n.id === 'secondhands');
	const p = (npc && Array.isArray(npc.position)) ? npc.position
		: (m && m.ref && m.ref.secondhands);
	if (!p || p.length < 2 || character.map !== 'main') return null;
	return Math.hypot(character.x - p[0], character.y - p[1]);
}

async function scoutPontyCheck() {
	/* NEVER WALK TO HIM, from anywhere: every spot he parks at is already inside
	   the 500 gate (47.4 at the stand spot, 346.1 worst case). The old
	   `!atTownSpot()` guard was true on EVERY cycle. Out of range, SKIP.
	   -> MerchantComments.md#do-not-walk-to-him */
	const pontyDist = scoutPontyDistance();
	if (pontyDist === null || pontyDist > 500) {
		scoutLog(`Ponty out of range (${pontyDist === null ? 'off main' : Math.round(pontyDist)}) - skipping, not walking`, '#B8B8B8');
		return;
	}
	const items = await scoutPontyQuery();
	if (items) {
		scoutBufferFor(scoutHere()).ponty = items;
		scout.pontySeen[mShardKey()] = Date.now();
		scoutLog(`Ponty: ${items.length} items on ${mShardKey()}`, '#5ED6A8');
		/* Buy from the list BEFORE the report goes out and before the caller
		   returns, which is what keeps the hop waiting: scoutVisitNextShard()
		   returns after the scan and hops on a later tick. Banking comes after
		   the buying, never between two purchases. -> PONTY BUY */
		try {
			const bought = await pontyBuyPass(items);
			/* Handed back so the caller knows the buffered Ponty stock is now stale
			   by exactly what we took. -> scoutRescanAfterBuy */
			if (bought) { await pontyStash(bought); return bought; }
		} catch (e) {
			pontyLog('buy pass threw: ' + ((e && e.message) ? e.message : e) + ' - the scan itself stands', 'red');
		}
	}
}

// ============================================================================
// PONTY BUY - pick the gear list out of Ponty's stock during the scan cycle
//
// The operator's rule, 2026-09-30: buy the listed tier-3 gear whenever it shows
// up while scanning, at any level, without leaving the ordinary cycle. Stop only
// on three-or-fewer free inventory slots or on-hand gold below goldFloor. Bank
// what is bought when the bank has room; keep it when it does not.
//
// WHY THIS LIVES IN scoutPontyCheck. Ponty answers, and sells, only within 500
// units - MEASURED from the server source, node/server.js socket.on("secondhands")
// and socket.on("sbuy"), which both gate on
// simple_distance(G.maps.main.ref.secondhands, player) > 500. The town scan spot
// is already inside it (47.4 units at the stand spot, 346.1 worst case, both
// measured earlier and recorded at scoutPontyCheck), so nothing walks anywhere to
// buy. sbuy also refuses with cant_in_bank, no_space and buy_cost, and with
// item_gone when somebody else took the listing first - all four are ordinary
// outcomes here, not faults, and each is logged as itself.
//
// PRICE. Ponty charges calculate_item_value(item) * G.multipliers
// .secondhands_mult - 2x the item's own value, 3x for a cash item - so the price
// is a property of the item and its level, not an asking price a seller chose.
// scoutItemPrice() already computes exactly that for the scan report, so the
// estimate and the gate use the same number the server will charge. Every
// purchase is then VERIFIED by gold delta and by the item arriving, because an
// estimate that silently drifts from the charge is how a gold floor stops
// meaning anything.
//
// THE HOP WAITS BY CONSTRUCTION. scoutVisitNextShard() does the scan and then
// `return`s so the hop happens on a LATER tick, and this pass is awaited inside
// that scan. There is no separate "hold the hop" flag to get out of step.
// ============================================================================
const PONTY_LOG_KEY = 'ponty_bought';

function pontyLog(m, c) { try { game_log('[ponty] ' + m, c || '#5ED6A8'); } catch (e) { } console.log('[ponty] ' + m); }
function pontyFmt(n) { return (n == null || !isFinite(n)) ? '?' : Math.round(n).toLocaleString('en-US'); }

/* Rebuilt per pass on purpose: the operator edits CONFIG.pontyBuy.items, and a
   Set hoisted at load would ignore the edit until a redeploy. */
function pontyWanted() {
	const out = new Set();
	for (const n of (CONFIG.pontyBuy.items || [])) if (n) out.add(String(n));
	return out;
}

function pontyFreeSlots() {
	let n = 0;
	for (const it of character.items) if (!it) n++;
	return n;
}
function pontySlotOf(name, level) {
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (it && it.name === name && (it.level || 0) === (level || 0)) return i;
	}
	return -1;
}
function pontyCount(name, level) {
	let n = 0;
	for (const it of character.items) if (it && it.name === name && (it.level || 0) === (level || 0)) n++;
	return n;
}

/* Tested before every purchase, not once per pass. */
function pontyBuyGate(cost) {
	const cfg = CONFIG.pontyBuy;
	const free = pontyFreeSlots();
	if (free <= cfg.stopAtFreeSlots) return { ok: false, why: free + ' inventory slot(s) free' };
	if (character.gold - (cost || 0) < cfg.goldFloor) {
		return { ok: false, why: 'gold ' + pontyFmt(character.gold) + ' minus ' + pontyFmt(cost)
			+ ' would fall below the ' + pontyFmt(cfg.goldFloor) + ' floor' };
	}
	return { ok: true };
}

function pontyRemember(bought) {
	try {
		const log = get(PONTY_LOG_KEY) || [];
		for (const b of bought) log.push({ at: Date.now(), shard: mShardKey(), name: b.name, level: b.level, spent: b.spent });
		while (log.length > 80) log.shift();
		set(PONTY_LOG_KEY, log);
	} catch (e) { pontyLog('could not record the purchase in storage', 'orange'); }
}

/* One listing. buy_secondhand() is the game's own wrapper and gives a real
   verdict per rid; the raw emit is the fallback for a context without it, and is
   judged only by what actually happened to gold and inventory. */
async function pontyBuyOne(row) {
	const before = character.gold;
	const had = pontyCount(row.name, row.level);
	let refused = null;
	try {
		if (typeof buy_secondhand === 'function') await buy_secondhand(row.rid);
		else { parent.socket.emit('sbuy', { rid: row.rid }); await sleep(1200); }
	} catch (e) { refused = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e); }
	await sleep(400);
	const spent = before - character.gold;
	const arrived = pontyCount(row.name, row.level) > had;
	if (arrived) {
		if (refused) pontyLog(row.name + ' reported "' + refused + '" but arrived anyway - trusting the inventory', 'orange');
		return { ok: true, spent: spent > 0 ? spent : (row.price || 0) };
	}
	pontyLog('did not get ' + row.name + '+' + row.level + (refused ? ' (' + refused + ')' : ' (nothing arrived)')
		+ (spent > 0 ? ' but ' + pontyFmt(spent) + ' gold left - CHECK THIS' : ''), spent > 0 ? 'red' : 'orange');
	return { ok: false, why: refused || 'nothing arrived' };
}

async function pontyBuyPass(rows) {
	const cfg = CONFIG.pontyBuy;
	if (!cfg.enabled) return null;
	const want = pontyWanted();
	if (!want.size) return null;
	const hits = (rows || []).filter((r) => r && r.rid && want.has(r.name));
	if (!hits.length) return null;
	/* Cheapest first, so a budget near the floor buys the most pieces rather
	   than spending itself on whichever row happened to come back first. */
	hits.sort((a, b) => (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price));
	pontyLog(hits.length + ' wanted item(s) in stock on ' + mShardKey() + ': '
		+ hits.map((h) => h.name + '+' + h.level).join(', '), '#FFD700');
	const bought = [];
	for (const r of hits) {
		const cap = (cfg.maxPrice || {})[r.name];
		if (typeof cap === 'number' && r.price != null && r.price > cap) {
			pontyLog('skipping ' + r.name + '+' + r.level + ' at ' + pontyFmt(r.price) + ' - over its ' + pontyFmt(cap) + ' cap', '#8b98ab');
			continue;
		}
		const gate = pontyBuyGate(r.price || 0);
		if (!gate.ok) { pontyLog('stopping here: ' + gate.why, 'orange'); break; }
		const res = await pontyBuyOne(r);
		if (res.ok) {
			bought.push({ name: r.name, level: r.level, spent: res.spent });
			pontyLog('bought ' + r.name + '+' + r.level + ' for ' + pontyFmt(res.spent)
				+ ' (gold ' + pontyFmt(character.gold) + ', ' + pontyFreeSlots() + ' slots free)', '#7FD98A');
		}
	}
	if (!bought.length) return null;
	pontyRemember(bought);
	return bought;
}

/* Bank space cannot be read from out here - character.bank is null anywhere but
   inside the bank - so this TRIES and treats a refusal as "no room", which is
   the operator's rule by a shorter route. Runs only after the buying is done. */
async function pontyStash(bought) {
	const cfg = CONFIG.pontyBuy;
	if (!bought || !bought.length || cfg.bankAfterBuy === 'never') return;
	if (cfg.bankAfterBuy === 'low' && pontyFreeSlots() > cfg.bankWhenFreeSlotsBelow) {
		pontyLog('keeping ' + bought.length + ' item(s) on hand - ' + pontyFreeSlots() + ' slots free', '#8b98ab');
		return;
	}
	if (!(await travelToBank())) { pontyLog('could not reach the bank - keeping them on hand', 'orange'); return; }
	let stored = 0, kept = 0;
	for (const b of bought) {
		const idx = pontySlotOf(b.name, b.level);
		if (idx < 0) continue;
		try { await bank_store(idx); stored++; await sleep(300); }
		catch (e) {
			kept++;
			pontyLog('bank would not take ' + b.name + '+' + b.level + ' ('
				+ ((e && (e.reason || e.message)) ? (e.reason || e.message) : e) + ') - keeping it on hand', 'orange');
		}
	}
	pontyLog('banked ' + stored + ' item(s)' + (kept ? ', kept ' + kept + ' (no room)' : '')
		+ ' - returning to the scan spot', '#7FD98A');
	await scoutGoToScanSpot();
}

/* Operator view: the list, the gates as they stand right now, and what has been
   bought recently. */
function pontyStatus() {
	const cfg = CONFIG.pontyBuy;
	const gate = pontyBuyGate(0);
	pontyLog('enabled=' + cfg.enabled + ' items=' + pontyWanted().size
		+ ' free=' + pontyFreeSlots() + ' (stop at ' + cfg.stopAtFreeSlots + ')'
		+ ' gold=' + pontyFmt(character.gold) + ' (floor ' + pontyFmt(cfg.goldFloor) + ')'
		+ ' bankAfterBuy=' + cfg.bankAfterBuy + ' -> ' + (gate.ok ? 'BUYING' : 'HOLDING: ' + gate.why),
		gate.ok ? '#7FD98A' : 'orange');
	pontyLog('list: ' + [...pontyWanted()].sort().join(', '));
	const caps = Object.keys(cfg.maxPrice || {});
	if (caps.length) pontyLog('price caps: ' + caps.map((k) => k + ' <= ' + pontyFmt(cfg.maxPrice[k])).join(', '));
	let log = [];
	try { log = get(PONTY_LOG_KEY) || []; } catch (e) { }
	if (!log.length) { pontyLog('nothing bought yet'); return; }
	for (const e of log.slice(-10)) {
		pontyLog('  ' + new Date(e.at).toISOString().slice(0, 16).replace('T', ' ') + ' ' + e.shard
			+ ' ' + e.name + '+' + e.level + ' for ' + pontyFmt(e.spent), '#8b98ab');
	}
	pontyLog('  (' + log.length + ' recorded, spent ' + pontyFmt(log.reduce((a, e) => a + (e.spent || 0), 0)) + ' in total)', '#8b98ab');
}


// ============================================================================
// STAND BUY - take the gear-plan pieces off another player's stand when cheap
//
// The operator's rule, 2026-10-02: for the ids on BOTH the gear plan and the
// Ponty buy list, buy from a player's stand whenever the listed price is
// 1,000,000 or less. The list is its own editable array, same as the Ponty one.
//
// WHY THIS IS NOT ARBITRAGE. Arbitrage buys to RESELL, so it will not look at a
// listing without a matching buy order clearing minProfit - a cheap wingedboots
// nobody is bidding on is invisible to it. This buys to KEEP: the only test is
// the price, and the piece goes to the bank instead of back on the market. It
// also keeps gear spending out of the arbitrage ledger, which is why it has its
// own log key rather than writing trades.
//
// WHY IT HANGS OFF THE SCAN. scoutSettleScan() already reads every stand on
// every shard into scout.shards, from the live entity list, seconds old - so
// unlike the arbitrage finders there is no freshness question and no bridge
// dependency. The one unavoidable cost is the walk: trade_buy needs the stand
// loaded, where Ponty sells from 500 units away.
//
// WHAT IT WILL NOT DO. Never buys from the operator's own characters, never
// touches a buy order, and never pays more than a price it re-read on arrival.
// ============================================================================
const SB_LOG_KEY = 'standbuy_log';
const sbSkip = new Map();    // shard|seller|slot -> until. Runtime only, by design.

function sbLog(m, c) { try { game_log('[gearbuy] ' + m, c || '#C7A3FF'); } catch (e) { } console.log('[gearbuy] ' + m); }
function sbFmt(n) { return (n == null || !isFinite(n)) ? '?' : Math.round(n).toLocaleString('en-US'); }

/* Rebuilt per pass for the same reason pontyWanted() is: the operator edits the
   list from the console, and a Set hoisted at load would ignore that until a
   redeploy. */
function sbWanted() {
	const out = new Set();
	for (const n of ((CONFIG.standBuy || {}).items || [])) if (n) out.add(String(n));
	return out;
}

/* Our own characters are never a counterparty. Standing operator rule, and the
   mule is included because he holds gear on purpose. */
function sbOwnNames() {
	const out = new Set(CONFIG.partyMembers || []);
	out.add(character.name);
	if (CONFIG.muling && CONFIG.muling.muleName) out.add(CONFIG.muling.muleName);
	return out;
}

function sbCap(name) {
	const cfg = CONFIG.standBuy || {};
	const per = (cfg.maxPriceByItem || {})[name];
	if (typeof per === 'number' && isFinite(per)) return per;
	return (typeof cfg.maxPrice === 'number' && isFinite(cfg.maxPrice)) ? cfg.maxPrice : 0;
}

/* Tested before every purchase, not once per pass - the same two gates as the
   Ponty list, reusing its two helpers because they are the same questions. */
function sbGate(cost) {
	const cfg = CONFIG.standBuy;
	const free = pontyFreeSlots();
	if (free <= cfg.stopAtFreeSlots) return { ok: false, why: free + ' inventory slot(s) free' };
	if (character.gold - (cost || 0) < cfg.goldFloor) {
		return { ok: false, why: 'gold ' + sbFmt(character.gold) + ' minus ' + sbFmt(cost)
			+ ' would fall below the ' + sbFmt(cfg.goldFloor) + ' floor' };
	}
	return { ok: true };
}

function sbSkipKey(seller, slot) { return mShardKey() + '|' + seller + '|' + slot; }
function sbSkipped(seller, slot) {
	const k = sbSkipKey(seller, slot);
	const until = sbSkip.get(k);
	if (until == null) return false;
	if (Date.now() >= until) { sbSkip.delete(k); return false; }
	return true;
}

/* Candidates from this shard's stands: the buffer the settle scan just filled,
   plus a live read for anything that arrived since. Live wins - its price is the
   newer one. A buffered row that has scrolled out of vision is still usable,
   because it carries map/x/y and arbApproach walks to a last-known spot. */
function sbOffers() {
	const want = sbWanted();
	const mine = sbOwnNames();
	const rows = new Map();
	const buf = scout.shards.get(mShardKey());
	if (buf && buf.stands) for (const r of buf.stands.values()) if (r && r.id) rows.set(r.id, r);
	try { for (const r of scoutScanStands()) if (r && r.id) rows.set(r.id, r); } catch (e) { }
	const out = [];
	for (const r of rows.values()) {
		if (mine.has(r.id)) continue;
		if (arbNeverBlocked(r.id)) continue;
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || !sl.name) continue;
			if (sl.b) continue;                                // a buy order, not for sale
			if (!want.has(sl.name)) continue;
			if (NO_TRADE_ITEM_NAMES.has(sl.name)) continue;
			if (isExchangeable(sl.name)) continue;   // -> EXCHANGEABLE ITEMS ARE NEVER SOLD
			if (!(typeof sl.price === 'number' && isFinite(sl.price))) continue;
			if (sl.price > sbCap(sl.name)) continue;
			if (sbSkipped(r.id, k)) continue;
			out.push({ seller: r.id, slot: k, name: sl.name, level: sl.level || 0,
				p: sl.p || null, price: sl.price, q: sl.q || 1,
				map: r.map, x: r.x, y: r.y });
		}
	}
	out.sort((a, b) => a.price - b.price);   // cheapest first, so a tight budget buys the most
	return out;
}

/* Is this still the listing the scan saw? A price that moved UP is a different
   trade nobody evaluated; a price that moved down is fine and is what gets paid.
   Read off the live entity, not a probe, because we are standing next to them. */
function sbVerify(row) {
	const e = pEntity(row.seller);
	if (!e) return { ok: false, why: 'seller not loaded on arrival' };
	if (!e.stand) return { ok: false, why: 'stand is closed' };
	const sl = (e.slots || {})[row.slot];
	if (!sl || !sl.name) return { ok: false, why: 'slot ' + row.slot + ' is empty now' };
	if (sl.b) return { ok: false, why: 'slot ' + row.slot + ' is a buy order now' };
	if (sl.name !== row.name || (sl.level || 0) !== row.level) {
		return { ok: false, why: 'slot now holds ' + sl.name + '+' + (sl.level || 0) };
	}
	if (!(typeof sl.price === 'number' && isFinite(sl.price))) return { ok: false, why: 'no price on the slot' };
	if (sl.price > row.price) return { ok: false, why: 'price moved up to ' + sbFmt(sl.price) };
	return { ok: true, price: sl.price };
}

/* One listing: walk, re-read, buy, and judge by what happened to the inventory
   rather than by what the call returned. */
async function sbBuyOne(row) {
	const cfg = CONFIG.standBuy;
	const ap = await arbApproach(row.seller, { map: row.map, x: row.x, y: row.y });
	if (!ap.ok) return { ok: false, why: 'could not reach ' + row.seller + ': ' + ap.reason };

	const v = sbVerify(row);
	if (!v.ok) return { ok: false, why: v.why };
	const cap = sbCap(row.name);
	if (v.price > cap) return { ok: false, why: 'live price ' + sbFmt(v.price) + ' is over its ' + sbFmt(cap) + ' cap' };
	const gate = sbGate(v.price);
	if (!gate.ok) return { ok: false, why: gate.why, stop: true };

	if (cfg.dryRun) {
		sbLog('DRY RUN: would buy ' + row.name + '+' + row.level + ' from ' + row.seller
			+ ' slot ' + row.slot + ' for ' + sbFmt(v.price), '#FFD700');
		return { ok: false, why: 'dry run' };
	}

	const had = pontyCount(row.name, row.level);
	const before = character.gold;
	let refused = null;
	try { await trade_buy(pEntity(row.seller), row.slot, 1); }
	catch (e) { refused = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e); }
	await sleep(1200);           // the gold change lands on a socket round trip
	const spent = before - character.gold;
	if (pontyCount(row.name, row.level) > had) {
		if (refused) sbLog(row.name + ' reported "' + refused + '" but arrived anyway - trusting the inventory', 'orange');
		return { ok: true, spent: spent > 0 ? spent : v.price };
	}
	return { ok: false, why: (refused || 'nothing arrived')
		+ (spent > 0 ? ' but ' + sbFmt(spent) + ' gold left - CHECK THIS' : '') };
}

/* MANUAL OVERRIDE - buy ONE named listing, now. The Codex watchlist page builds
   the call for each selling row and the operator pastes it here.

   WHAT IT KEEPS AND WHAT IT DROPS. It keeps sbVerify, so a listing that changed
   under us is refused: a different item, a closed stand, a slot that turned into
   a buy order, or a price that moved UP are all still "no". Paying more than the
   page quoted is never what the operator asked for. It DROPS sbCap and sbGate,
   which encode the automatic pass's own policy - a hand-picked buy is the
   operator overriding that policy on purpose, and a refusal citing a config
   ceiling they did not consult would be noise. Both skips are logged.

   CONFIG.standBuy.dryRun is still honoured. It is the operator's own switch and
   silently spending real gold while it is on would be the worst kind of
   surprise.

   The shard is checked first and never crossed automatically: arbProbeGo()
   reloads the page, which would destroy the pasted command mid-flight. */
/* A BUY THAT OUTLIVES THE PAGE.

   change_server RELOADS the page, so a cross-shard buy cannot be a single call -
   the hop destroys the very command that asked for it. v90 refused instead and
   told the operator to hop by hand, which works but means pasting twice and
   remembering what you were doing.

   This stashes the row in CODE storage (which survives the reload - the same
   mechanism probe_hold already relies on for exactly this reason), hops, and
   resumes on the other side.

   THE RECORD IS CLEARED BEFORE IT IS ACTED ON, never after. A buy that throws,
   or a shard the hop never reached, must not leave something behind that fires
   again on the next load - a stored purchase that retries forever is a worse
   failure than one that is quietly dropped. `hops` caps the chase at one, and
   `expiresAt` drops anything stale: ten minutes on, the listing has very likely
   moved, and sbVerify would refuse it at the stand anyway. */
const SB_PENDING = 'pending_buy';
function sbPendingRead() {
	try { const r = get(SB_PENDING); return (r && r.row) ? r : null; } catch (e) { return null; }
}
function sbPendingClear() { try { set(SB_PENDING, null); } catch (e) { } }
function sbPendingWrite(row, hops) {
	const cfg = CONFIG.standBuy || {};
	const rec = { row: row, at: Date.now(),
		expiresAt: Date.now() + (cfg.pendingMs || 600000),
		hops: hops || 0, shard: String(row.shard || '').replace(/\s+/g, '') };
	try { set(SB_PENDING, rec); } catch (e) { return false; }
	return true;
}

/* Called once from STARTUP. Deliberately not awaited there: the character has
   only just reconnected and the seller will not be in vision yet. */
function sbPendingResume() {
	const rec = sbPendingRead();
	if (!rec) return;
	const cfg = CONFIG.standBuy || {};
	if (Date.now() > (rec.expiresAt || 0)) {
		sbPendingClear();
		sbLog('a stashed cross-shard buy for ' + (rec.row.name || '?') + ' expired before the hop landed - dropped', 'orange');
		return;
	}
	const here = mShardKey();
	if (rec.shard && here !== rec.shard) {
		/* The hop did not land where it was aimed. Chasing it again is how a
		   merchant ends up bouncing between shards forever. */
		sbPendingClear();
		sbLog('stashed buy wanted ' + rec.shard + ' but the hop landed on ' + here
			+ ' - dropped rather than hopping again', 'red');
		return;
	}
	sbLog('resuming the stashed buy: ' + rec.row.name + ' from ' + rec.row.seller
		+ ' on ' + here + ' in ' + Math.round((cfg.pendingResumeMs || 9000) / 1000) + 's', '#FFD700');
	setTimeout(function () {
		/* cleared FIRST - see the note above */
		sbPendingClear();
		try { sbBuyNow(rec.row, { resumed: true }); } catch (e) { sbLog('resume threw: ' + e, 'red'); }
	}, cfg.pendingResumeMs || 9000);
}

async function sbBuyNow(row, opts) {
	if (!row || !row.seller || !row.slot || !row.name) {
		sbLog('buyNow needs at least {seller, slot, name} - copy the command from the watchlist page', 'red');
		return { ok: false, why: 'incomplete row' };
	}
	const want = String(row.shard || '').replace(/\s+/g, '');
	if (want && mShardKey() !== want) {
		/* v90 stopped here and asked the operator to hop by hand. It now stashes
		   the row and hops itself - arbProbeGo sets the hold and calls
		   change_server, so THE PAGE RELOADS and nothing after this line runs.
		   The buy continues from sbPendingResume() on the other side. */
		const hops = ((opts && opts.hops) || 0) + 1;
		if (hops > (CONFIG.standBuy.pendingMaxHops || 1)) {
			sbLog('already hopped once chasing ' + row.name + ' - not hopping again', 'red');
			return { ok: false, why: 'hop limit' };
		}
		if (!sbPendingWrite(row, hops)) {
			sbLog('could not stash the buy, so the hop would lose it - staying put. '
				+ 'Run arbProbeGo("' + want + '") and paste again.', 'red');
			return { ok: false, why: 'could not stash' };
		}
		sbLog(row.name + ' is on ' + want + ', Meltymerch is on ' + mShardKey()
			+ ' - stashed and hopping; the page reloads and the buy resumes there', '#FFD700');
		try { await arbProbeGo(want); }
		catch (e) {
			sbPendingClear();
			sbLog('the hop to ' + want + ' failed: ' + ((e && (e.reason || e.message)) || e)
				+ ' - stash dropped', 'red');
			return { ok: false, why: 'hop failed' };
		}
		return { ok: false, why: 'hopping to ' + want };
	}

	const qty = Math.max(1, parseInt(row.q || 1) || 1);
	sbLog('override: ' + row.name + '+' + (row.level || 0) + ' x' + qty + ' from ' + row.seller
		+ ' slot ' + row.slot + ' at ' + sbFmt(row.price) + ' - walking', '#FFD700');

	/* THE ROTATION IS FROZEN FOR THE WHOLE WALK, and this is not optional.
	   v89/v90 took only the move lock, by way of moveTo - that stops other
	   MOVEMENT, but the scout's shard hop is gated on state.busy and PROBE.hold,
	   neither of which a buy touched. So the rotation could fire change_server
	   mid-walk, reload the page, and destroy an in-flight purchase with nothing
	   logged. The gate's own comment already said it: "A probe is measuring.
	   Never hop - a hop reloads the page."

	   Restored, not cleared: an operator who was already holding stays holding
	   when this finishes. */
	const heldBefore = !!PROBE.hold;
	if (!heldBefore) arbProbeHold(true);
	try {
		return await sbBuyNowInner(row, qty);
	} finally {
		/* in a finally so a throw, a refusal or a death cannot leave the
		   merchant frozen off its rotation for the rest of the session */
		if (!heldBefore) arbProbeHold(false);
	}
}

async function sbBuyNowInner(row, qty) {
	const ap = await arbApproach(row.seller, { map: row.map, x: row.x, y: row.y });
	if (!ap.ok) {
		sbLog('could not reach ' + row.seller + ': ' + ap.reason, 'red');
		return { ok: false, why: 'could not reach ' + row.seller + ': ' + ap.reason };
	}

	const v = sbVerify(row);
	if (!v.ok) { sbLog('refused: ' + v.why, 'red'); return { ok: false, why: v.why }; }

	/* Said out loud, because these are the two guards the automatic pass would
	   have applied and this call is deliberately ignoring. */
	try {
		const cap = sbCap(row.name);
		if (v.price > cap) sbLog('override: ' + sbFmt(v.price) + ' is over the ' + sbFmt(cap)
			+ ' cap for ' + row.name + ' - buying anyway', 'orange');
		const gate = sbGate(v.price);
		if (!gate.ok) sbLog('override: the automatic pass would have stopped here (' + gate.why
			+ ') - buying anyway', 'orange');
	} catch (e) { }

	if (CONFIG.standBuy && CONFIG.standBuy.dryRun) {
		sbLog('DRY RUN is on: would have bought ' + row.name + '+' + (row.level || 0)
			+ ' x' + qty + ' for ' + sbFmt(v.price) + ' - set CONFIG.standBuy.dryRun = false to buy', '#FFD700');
		return { ok: false, why: 'dry run' };
	}

	const had = pontyCount(row.name, row.level || 0);
	const before = character.gold;
	let refused = null;
	try { await trade_buy(pEntity(row.seller), row.slot, qty); }
	catch (e) { refused = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e); }
	await sleep(1200);           // the gold change lands on a socket round trip

	const spent = before - character.gold;
	const got = pontyCount(row.name, row.level || 0) - had;
	/* Judged by the inventory, not the call: trade_buy has been seen to report a
	   refusal for a purchase that landed. -> sbBuyOne */
	if (got > 0) {
		sbLog('bought ' + got + ' x ' + row.name + '+' + (row.level || 0) + ' for ' + sbFmt(spent), '#5ED6A8');
		if (refused) sbLog('(it reported "' + refused + '" but the item arrived - trusting the inventory)', 'orange');
		return { ok: true, got: got, spent: spent };
	}
	sbLog('nothing arrived' + (refused ? ' - ' + refused : '')
		+ (spent > 0 ? ' BUT ' + sbFmt(spent) + ' gold left - CHECK THIS' : ''), 'red');
	return { ok: false, why: refused || 'nothing arrived', spent: spent };
}

function sbRemember(bought) {
	try {
		const log = get(SB_LOG_KEY) || [];
		for (const b of bought) {
			log.push({ at: Date.now(), shard: mShardKey(), name: b.name, level: b.level, spent: b.spent, from: b.from });
		}
		while (log.length > 80) log.shift();
		set(SB_LOG_KEY, log);
	} catch (e) { sbLog('could not record the purchase in storage', 'orange'); }
}

/* Same shape and same reasoning as pontyStash: bank space cannot be read from
   outside the bank, so this TRIES and treats a refusal as "no room". Runs after
   the buying, never between two purchases. */
async function sbStash(bought) {
	const cfg = CONFIG.standBuy;
	if (!bought || !bought.length || cfg.bankAfterBuy === 'never') return;
	if (cfg.bankAfterBuy === 'low' && pontyFreeSlots() > cfg.bankWhenFreeSlotsBelow) {
		sbLog('keeping ' + bought.length + ' item(s) on hand - ' + pontyFreeSlots() + ' slots free', '#8b98ab');
		return;
	}
	if (!(await travelToBank())) { sbLog('could not reach the bank - keeping them on hand', 'orange'); return; }
	let stored = 0, kept = 0;
	for (const b of bought) {
		const idx = pontySlotOf(b.name, b.level);
		if (idx < 0) continue;
		try { await bank_store(idx); stored++; await sleep(300); }
		catch (e) {
			kept++;
			sbLog('bank would not take ' + b.name + '+' + b.level + ' ('
				+ ((e && (e.reason || e.message)) ? (e.reason || e.message) : e) + ') - keeping it on hand', 'orange');
		}
	}
	sbLog('banked ' + stored + ' item(s)' + (kept ? ', kept ' + kept + ' (no room)' : ''), '#7FD98A');
}

async function sbBuyPass(why) {
	const cfg = CONFIG.standBuy;
	if (!cfg || !cfg.enabled) return null;
	/* A missing or nonsense ceiling must not read as "no ceiling". This feature
	   spends up to the cap per item on a stranger's asking price, so the failure
	   mode of guessing wrong is paying it. */
	if (!(typeof cfg.maxPrice === 'number' && isFinite(cfg.maxPrice) && cfg.maxPrice > 0)) {
		sbLog('CONFIG.standBuy.maxPrice is not a positive number - refusing to buy rather than assume no ceiling', 'red');
		return null;
	}
	if (!sbWanted().size) return null;
	const offers = sbOffers();
	if (!offers.length) return null;

	sbLog(offers.length + ' gear-plan listing(s) at or under cap on ' + mShardKey()
		+ ' (' + (why || 'scan') + '): '
		+ offers.slice(0, 6).map((o) => o.name + '+' + o.level + ' ' + sbFmt(o.price) + ' @' + o.seller).join(', ')
		+ (offers.length > 6 ? ', +' + (offers.length - 6) + ' more' : ''), '#FFD700');

	const bought = [];
	let walked = 0;
	for (const o of offers) {
		if (walked >= cfg.maxPerPass) {
			sbLog('stopping at ' + cfg.maxPerPass + ' seller(s) this pass - the rest keep until the next scan', '#8b98ab');
			break;
		}
		const gate = sbGate(o.price);
		if (!gate.ok) { sbLog('stopping here: ' + gate.why, 'orange'); break; }
		walked++;
		const res = await sbBuyOne(o);
		if (res.ok) {
			bought.push({ name: o.name, level: o.level, spent: res.spent, from: o.seller });
			sbLog('bought ' + o.name + '+' + o.level + ' from ' + o.seller + ' for ' + sbFmt(res.spent)
				+ ' (gold ' + sbFmt(character.gold) + ', ' + pontyFreeSlots() + ' slots free)', '#7FD98A');
		} else {
			sbLog('no deal on ' + o.name + '+' + o.level + ' from ' + o.seller + ': ' + res.why, 'orange');
			if (res.stop) break;
			sbSkip.set(sbSkipKey(o.seller, o.slot), Date.now() + (cfg.skipAfterMissMs || 0));
		}
	}

	if (bought.length) { sbRemember(bought); await sbStash(bought); }
	/* We walked off the scan spot, and both callers expect to still be standing
	   on it - scoutHeldScan's own gate is mInTown(). Cheap when already there. */
	if (walked) await scoutGoToScanSpot();
	return bought.length ? bought : null;
}

/* Operator view: the list, the gates as they stand, and what has been bought. */
function sbStatus() {
	const cfg = CONFIG.standBuy;
	const gate = sbGate(0);
	sbLog('enabled=' + cfg.enabled + (cfg.dryRun ? ' DRY RUN' : '') + ' items=' + sbWanted().size
		+ ' cap=' + sbFmt(cfg.maxPrice) + ' free=' + pontyFreeSlots() + ' (stop at ' + cfg.stopAtFreeSlots + ')'
		+ ' gold=' + sbFmt(character.gold) + ' (floor ' + sbFmt(cfg.goldFloor) + ')'
		+ ' maxPerPass=' + cfg.maxPerPass + ' bankAfterBuy=' + cfg.bankAfterBuy
		+ ' -> ' + (gate.ok ? 'BUYING' : 'HOLDING: ' + gate.why), gate.ok ? '#7FD98A' : 'orange');
	sbLog('list: ' + [...sbWanted()].sort().join(', '));
	const caps = Object.keys(cfg.maxPriceByItem || {});
	if (caps.length) sbLog('per-item caps: ' + caps.map((k) => k + ' <= ' + sbFmt(cfg.maxPriceByItem[k])).join(', '));
	const offers = sbOffers();
	sbLog(offers.length + ' listing(s) would qualify on ' + mShardKey() + ' right now'
		+ (offers.length ? ': ' + offers.slice(0, 8).map((o) => o.name + '+' + o.level + ' ' + sbFmt(o.price) + ' @' + o.seller).join(', ') : ''),
		offers.length ? '#FFD700' : '#8b98ab');
	if (sbSkip.size) sbLog(sbSkip.size + ' listing(s) on the miss-skip list');
	let log = [];
	try { log = get(SB_LOG_KEY) || []; } catch (e) { }
	if (!log.length) { sbLog('nothing bought yet'); return; }
	for (const e of log.slice(-10)) {
		sbLog('  ' + new Date(e.at).toISOString().slice(0, 16).replace('T', ' ') + ' ' + e.shard
			+ ' ' + e.name + '+' + e.level + ' for ' + sbFmt(e.spent) + ' from ' + (e.from || '?'), '#8b98ab');
	}
	sbLog('  (' + log.length + ' recorded, spent ' + sbFmt(log.reduce((a, e) => a + (e.spent || 0), 0)) + ' in total)', '#8b98ab');
}


/* RESCAN AFTER A PURCHASE - never publish a listing we just took.

   The scan is captured BEFORE the buying, and that order is right: the buy needs
   the data. But it means the report would advertise the exact slot we emptied.
   Anyone reading it - the bridge, ALData, FamilyFleet, or this merchant's own
   flip finder while the row is still inside sellMaxAgeSec - then plans a trip for
   an item already sitting in our bank. arbStillThere() catches it at the till, so
   no gold is lost, but the trip is spent and on another shard the hop with it.

   So when anything was bought, drop this shard's stands, read them again from the
   scan spot, and let the report post THAT. Both buy paths already walk back to the
   scan spot, so the travel here is normally a no-op.

   It does NOT suppress a post. There is only one post per visit and it already
   comes after the buying; what was missing was that the buffer behind it had gone
   stale by our own hand. */
async function scoutRescanAfterBuy(reason, alsoPonty) {
	if (!CONFIG.scout.rescanAfterBuy) return false;
	if (!(await scoutGoToScanSpot())) {
		scoutLog('could not get back to the scan spot - posting the pre-purchase scan', 'orange');
		return false;
	}
	await scoutSettleScan();        // clears this shard's stands first, by design
	let pontyNote = '';
	if (alsoPonty) {
		/* Ponty's stock is a separate buffer and a stand rescan does not touch it,
		   so a Ponty purchase needs its own re-read. He answers only within 500
		   units - the same gate scoutPontyCheck tests, which the scan spot passes
		   at 47.4. Deliberately not routed through scoutPontyCheck: that would buy
		   again, and this is a read. */
		const items = await scoutPontyQuery();
		if (items) {
			scoutBufferFor(scoutHere()).ponty = items;
			pontyNote = ', Ponty re-read at ' + items.length + ' item(s)';
		} else {
			pontyNote = ', Ponty did not answer - his stock stands as read before the buy';
		}
	}
	scoutLog('rescanned after ' + reason + ': ' + scoutCurrentShardCount() + ' stand(s) on '
		+ mShardKey() + pontyNote + ' - posting this one', '#5ED6A8');
	return true;
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

// Posts every buffered shard, each stamped with the shard it was observed on -
// -> MerchantComments.md#scoutReport
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
					// Parked, and PINNED - two separate claims.
					// -> MerchantComments.md#role
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
// Everything still unsent, dropped, with a count of what went.
// -> MerchantComments.md#scoutDropBuffer
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
		await mHopTo(home);
	} finally { state.busy = false; }
}

// Where to go next, steered by the bridge rather than a blind round-robin.
// -> MerchantComments.md#scoutNextShard
function scoutNextShard() {
	const all = scoutShards();
	const here = mShardKey();
	const reply = scout.lastReply;

	const parked = new Set(Object.values((reply && reply.parked) || {}).filter(Boolean));
	const fromBridge = (reply && Array.isArray(reply.rotation)) ? reply.rotation : [];

	// A beat of this roamer's own, dealt by the bridge so two roamers never
	// -> MerchantComments.md#beat
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

// Stand where the stands are before reading them.
// -> MerchantComments.md#scoutGoToScanSpot
async function scoutGoToScanSpot() {
	const spot = CONFIG.stand.candidates[0];
	if (!spot) return false;
	// Completeness, not proximity - the gate scoutHeldScan already trusts. The
	// town spot passes it with 261/238 units of vision margin while sitting 288
	// from candidate[0], and Merrit needs him STILL (anchor_tolerance 4).
	// -> MerchantComments.md#the-gate-is-now-can
	if (mInTown()) return true;
	return await travelTo(CONFIG.stand.map, spot.x, spot.y);
}

// Two phases, never in one continuation, because a hop ends the script.
// -> MerchantComments.md#two-phases-never-in-one
// Keep this shard's listings current while a probe holds the merchant.
// -> MerchantComments.md#scoutHeldScan
async function scoutHeldScan() {
	if (!scoutCanRun()) return;
	// The gate is now "can I see the whole stand region", not "am I within 60
	// -> MerchantComments.md#the-gate-is-now-can
	if (!mInTown()) return;
	if (Date.now() - (scout.heldScanAt || 0) < CONFIG.scout.townScanMs) return;
	scout.heldScanAt = Date.now();
	state.busy = true;
	try {
		await scoutSettleScan();
		/* The parked path is the one that actually runs while scout.parked is
		   true, so the gear buy has to hang off BOTH scans or it would only ever
		   fire on the shard-rotation cycle the operator has turned off.
		   -> STAND BUY */
		let boughtStand = null;
		try { boughtStand = await sbBuyPass('town scan'); }
		catch (e) { sbLog('buy pass threw: ' + ((e && e.message) ? e.message : e) + ' - the scan itself stands', 'red'); }
		/* No Ponty leg on this path, so the stand rescan is the whole of it.
		   -> scoutRescanAfterBuy */
		if (boughtStand && boughtStand.length) await scoutRescanAfterBuy('a stand purchase', false);
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
			let boughtPonty = null, boughtStand = null;
			if (scoutPontyDue()) boughtPonty = await scoutPontyCheck();
			/* After the scan, so the stand data is already buffered, and before the
			   report, exactly like the Ponty buy. -> STAND BUY */
			try { boughtStand = await sbBuyPass('shard scan'); }
			catch (e) { sbLog('buy pass threw: ' + ((e && e.message) ? e.message : e) + ' - the scan itself stands', 'red'); }
			/* Either purchase makes the captured scan wrong about our own doing, so
			   read it again before the report goes out. -> scoutRescanAfterBuy */
			if ((boughtPonty && boughtPonty.length) || (boughtStand && boughtStand.length)) {
				await scoutRescanAfterBuy('a purchase on ' + here, !!(boughtPonty && boughtPonty.length));
			}
			const r = await scoutReportConfirmed();
			if (r && r.reply) scout.lastReply = r.reply;
			if (r && r.confirmed) scoutSave('scanned', here);
			scoutSaveBuffer();
		} finally { state.busy = false; scout.cycleStartedAt = 0; }
		return;                       // hop on the NEXT tick, not this one
	}

	// This shard is already scanned. Roaming would hop to the next one here;
	// -> MerchantComments.md#home
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
		// Gated on `enabled`, not just spaced out. Without this the probe kept
		// -> MerchantComments.md#gated-on-enabled-not-just
		if (CONFIG.scout.enabled
			&& Date.now() - scout.probedAt > CONFIG.scout.reprobeMs) await scoutProbe();

		// A scout cycle awaits smart_move and change_server, and smart_move can
		// -> MerchantComments.md#a-scout-cycle-awaits-smart
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
				// -> MerchantComments.md#a-probe-is-measuring-never
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
// Buy on one shard, sell on another, and survive being killed halfway.
// -> MerchantComments.md#ARB

const ARB = {
	cur: null,          // mirror of the stored trade; storage is authoritative
	buffer: [],         // ledger events the bridge has not acknowledged
	lastLookAt: 0,
	busy: false,
};

const ARB_KEY = 'arb_trade';
const ARB_BUF_KEY = 'arb_ledger_buffer';
const ARB_USED_KEY = 'arb_used';
const ARB_FAIL_KEY = 'arb_fails';
const ARB_GONE_KEY = 'arb_gone';
const ARB_STRAND_KEY = 'arb_strandings';
const ARB_HALT_KEY = 'arb_halt';

/* A stop that survives the reload a shard hop causes, without outliving a
   redeploy. -> CONFIG.arbitrage.haltMs for why a plain flag could not work. */
function arbHalted() {
	let h = null;
	try { h = get(ARB_HALT_KEY); } catch (e) { return null; }
	if (!h || !h.at) return null;
	if (Date.now() - h.at > CONFIG.arbitrage.haltMs) return null;
	return h;
}

/* build is recorded for diagnosis - which build was running when the breaker
   tripped - and is deliberately NOT a clearing condition. See haltMs. */
function arbHalt(reason) {
	try { set(ARB_HALT_KEY, { at: Date.now(), reason: reason, build: MERCHANT_BUILD }); } catch (e) { }
}

/* Console helper: arbProbeHalt() reports, arbProbeHalt(false) clears. */
function arbProbeHalt(on) {
	if (on === false) {
		try { set(ARB_HALT_KEY, null); } catch (e) { }
		arbStrandings(0);
		arbLog('halt cleared by hand - trading may resume', '#FFD700');
		return null;
	}
	const h = arbHalted();
	arbLog(h ? ('HALTED ' + Math.round((Date.now() - h.at) / 60000) + ' min ago: ' + h.reason
		+ ' (expires in ' + Math.round((CONFIG.arbitrage.haltMs - (Date.now() - h.at)) / 60000) + ' min'
		+ ', tripped on build ' + (h.build || 'unknown') + ')')
		: 'not halted', '#FFD700');
	return h;
}

// Listings this merchant has already traded against, and when they stop being
// -> MerchantComments.md#arbUsedKey
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

// Counterparties that keep failing, and how long to leave them alone.
// -> MerchantComments.md#arbFailKey
function arbFailKey(shard, target) { return String(shard) + '|' + String(target); }

function arbLoadFails() {
	let m = {};
	try { m = get(ARB_FAIL_KEY) || {}; } catch (e) { m = {}; }
	const now = Date.now();
	let changed = false;
	for (const k in m) {
		// Forget the record once the hold has expired AND a grace period has
		// passed, so occasional failures never compound into a permanent ban.
		if (!(m[k] && m[k].until + CONFIG.arbitrage.failForgetMs > now)) { delete m[k]; changed = true; }
	}
	if (changed) { try { set(ARB_FAIL_KEY, m); } catch (e) { } }
	return m;
}

function arbNoteFailure(shard, target) {
	if (!shard || !target) return;
	/* An NPC failing means THIS listing went, not that the counterparty is bad.
	   Give up on the attempt and nothing else. -> AN NPC IS NEVER SHELVED */
	if (arbIsNpcTarget(target)) return;
	const m = arbLoadFails();
	const k = arbFailKey(shard, target);
	const n = ((m[k] && m[k].n) || 0) + 1;
	const cfg = CONFIG.arbitrage;
	const hold = Math.min(cfg.failBackoffMs * Math.pow(2, n - 1), cfg.failBackoffMaxMs);
	m[k] = { n: n, until: Date.now() + hold };
	try { set(ARB_FAIL_KEY, m); } catch (e) { }
	arbLog('shelving ' + target + ' on ' + shard + ' for '
		+ Math.round(hold / 60000) + ' min (failure ' + n + ')', 'orange');
	// The hold has been at its ceiling since failure 6, so another retry is not
	// new information. -> NEVER_TRADE_NAMES
	if (cfg.neverTradeAfter && n >= cfg.neverTradeAfter) {
		arbNeverPromote(target, 'failed ' + n + ' consecutive times, last on ' + shard);
	}
}

/* A success says the earlier failures were situational, so the count goes. */
function arbClearFailure(shard, target) {
	if (!shard || !target) return;
	const m = arbLoadFails();
	const k = arbFailKey(shard, target);
	if (!m[k]) return;
	delete m[k];
	try { set(ARB_FAIL_KEY, m); } catch (e) { }
}

function arbFailBlocked(shard, target, fails) {
	if (arbIsNpcTarget(target)) return false;   // -> AN NPC IS NEVER SHELVED
	const m = fails || arbLoadFails();
	const e = m[arbFailKey(shard, target)];
	return !!(e && e.until > Date.now());
}

/* A LISTING that has gone, as opposed to a counterparty that keeps failing.
   arbNoteFailure deliberately refuses to shelve an NPC and that is right: Ponty
   carries 300+ rows per shard, so shelving him would shut most of the pipeline.
   But the early return meant nothing remembered the ROW either, and the finder
   re-proposed it from the same stale scan on the very next pass.

   Measured 2026-10-06: 187 Ponty abandons in 24h across SEVEN distinct items -
   ftrinket+0 alone 63 times - with a median gap between retries of 22 seconds.
   That is ~68 minutes of the day spent hopping for items that were not there,
   and because only one trade runs at a time it blocked every other candidate
   while it did so.

   Keyed by shard AND vendor, not by item alone: the same item from a player
   stand on that shard is a different offer and must stay available. */
function arbGoneKey(shard, target, item, level) {
	return String(shard) + '|' + String(target) + '|' + String(item) + '+' + String(level || 0);
}

function arbLoadGone() {
	let m = {};
	try { m = get(ARB_GONE_KEY) || {}; } catch (e) { m = {}; }
	const now = Date.now();
	let changed = false;
	for (const k in m) {
		if (!(m[k] && m[k].until > now)) { delete m[k]; changed = true; }
	}
	if (changed) { try { set(ARB_GONE_KEY, m); } catch (e) { } }
	return m;
}

function arbNoteGone(shard, target, item, level) {
	if (!shard || !target || !item) return;
	const ms = CONFIG.arbitrage.goneForgetMs || 12 * 60 * 1000;
	const m = arbLoadGone();
	m[arbGoneKey(shard, target, item, level)] = { until: Date.now() + ms };
	try { set(ARB_GONE_KEY, m); } catch (e) { }
	arbLog(target + ' ' + item + '+' + (level || 0) + ' gone on ' + shard
		+ ' - not re-offering it for ' + Math.round(ms / 60000) + ' min', '#8b98ab');
}

function arbGoneBlocked(shard, target, item, level, gone) {
	if (!shard || !target || !item) return false;
	const m = gone || arbLoadGone();
	const e = m[arbGoneKey(shard, target, item, level)];
	return !!(e && e.until > Date.now());
}

/* PER-TRADE dead ends, which is a different question again from arbIsUsed
   ("did we consume this order") and arbFailBlocked ("do we keep losing against
   this counterparty"). This one is only "has THIS trade already stood in front
   of that slot and failed", and it is what makes a reroute a reroute rather
   than a retry wearing a different log line. */
function arbSellSlotKey(shard, target, slot) {
	return String(shard) + '|' + String(target) + '|' + String(slot);
}
function arbSellTried(t, shard, target, slot) {
	if (!t || !target || !slot) return;
	if (!Array.isArray(t.tried)) t.tried = [];
	const k = arbSellSlotKey(shard, target, slot);
	if (t.tried.indexOf(k) < 0) t.tried.push(k);
}
function arbSellTriedAlready(t, shard, target, slot) {
	return !!(t && Array.isArray(t.tried) && t.tried.indexOf(arbSellSlotKey(shard, target, slot)) >= 0);
}

/* Held goods have a deadline. t.sellSince is stamped when the goods became
   ours; t.at is the fallback for a trade that was in flight across the
   upgrade. Only the two phases that can loop are checked - a hop in progress
   is not a stall. */
function arbSellOverdueMs(t) {
	const limit = CONFIG.arbitrage.sellDeadlineMs;
	if (!limit || !t) return 0;
	const since = t.sellSince || t.at;
	if (!since) return 0;
	const held = Date.now() - since;
	return held > limit ? held : 0;
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
	const halt = arbHalted();
	if (halt) return { ok: false, reason: 'halted: ' + halt.reason };
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
		// The last-known position of each side. Without these arbApproach has
		// -> MerchantComments.md#planCoords
		buyMap: flip.buyMap || null, buyX: flip.buyX, buyY: flip.buyY,
		sellMap: flip.sellMap || null, sellX: flip.sellX, sellY: flip.sellY,
		spend: flip.spend, expectProfit: flip.profit, taxRate: flip.taxRate,
		goldAtStart: gold,
		attempts: 0,
		/* Every (shard|buyer|slot) this trade has already failed against, so a
		   reroute goes to someone new or not at all. -> arbSellTried */
		tried: [],
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
	/* Blame the side that failed: buy-side (not_loaded, slot_gone) is the
	   seller, sell-side the buyer. A close clears the count, so an occasional
	   miss never accumulates into a ban. */
	if (event === 'closed') {
		arbClearFailure(t.buyShard, t.buyFrom);
		arbClearFailure(t.sellShard, t.sellTo);
	} else if (t.phase === 'at_sell' || t.phase === 'holding' || t.phase === 'stranded') {
		arbNoteFailure(t.sellShard, t.sellTo);
	} else {
		arbNoteFailure(t.buyShard, t.buyFrom);
	}
	arbLog(event === 'closed'
		? 'closed ' + t.item + ' x' + t.qty + ' for ' + (extra && extra.net) + ' net'
		: 'abandoned ' + t.item + ' x' + t.qty + ' (' + (extra && extra.reason) + ')',
		event === 'closed' ? '#7FD98A' : 'orange');
	arbClearTrade();
}

// Close enough to trade. A stand's trade slots stay fully readable right to...
// -> MerchantComments.md#arbApproach
async function arbApproach(targetName, hint) {
	const want = CONFIG.arbitrage.approachUnits;
	let e = pEntity(targetName);

	/* NOT LOADED IS NOT THE SAME AS NOT THERE.

	   character.vision is [700, 500] and it is a BOX, so pEntity only ever
	   resolves someone already close. This function used to give up the instant
	   the lookup came back empty - which meant it could never approach anyone it
	   was not already standing next to. After a shard hop the character keeps its
	   old position, so the seller is usually well outside that box, three ticks
	   burn at 4s each, and the trade is abandoned in about twelve seconds without
	   a single step being taken.

	   That is the largest single failure in the ledger: 333 abandons on
	   'could not reach the seller: not_loaded' against ONE on 'still N units
	   away'. Almost nothing was failing to arrive; it was failing to set off.

	   The position was known the whole time. The market row carries map/x/y, and
	   it is now carried through the flip and the trade record, so an unloaded
	   seller means "walk to where they were last seen and look again" rather
	   than "give up". */
	if (!e) {
		const haveHint = hint && typeof hint.x === 'number' && typeof hint.y === 'number' && hint.map;
		if (!haveHint) return { ok: false, reason: 'not_loaded' };
		const me0 = pWhere(character);
		if (hint.map === me0.map && pDist(me0.x, me0.y, hint.x, hint.y) <= want) {
			// Standing on their last known spot and still nothing: really gone.
			return { ok: false, reason: 'not_loaded_at_last_known' };
		}
		try {
			await moveTo({ map: hint.map, x: hint.x, y: hint.y });
		} catch (err) {
			return { ok: false, reason: 'smart_move to last known: ' + (err && (err.reason || err.message) ? (err.reason || err.message) : String(err)) };
		}
		e = pEntity(targetName);
		if (!e) return { ok: false, reason: 'not_loaded_on_arrival' };
	}

	const t = pWhere(e), me = pWhere(character);
	if (t.map === me.map && pDist(me.x, me.y, t.x, t.y) <= want) return { ok: true, moved: false };
	// Past the in-range return, so this only fires when we are actually going
	// -> MerchantComments.md#past-the-in-range-return
	try {
		await moveTo({ map: t.map, x: t.x, y: t.y });
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
		: { target: t.sellTo, slot: t.sellSlot, name: t.item, level: t.level, price: t.sellPrice, b: true },
		{ quiet: true });
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

/* ---- buying the NPC leg (Ponty) -------------------------------------------
   arbProbePontyRows() has always put Ponty's stock on the BUY side of the flip
   search, tagged npc: true, target 'Ponty', slot null. Nothing could act on it:
   the buy leg ran trade_buy(pEntity(name), slot, qty), which needs a loaded
   player stand and a trade slot, and Ponty has neither - measured 2026-09-30,
   pEntity('Ponty') resolves to entity id $Ponty with npc: true and ZERO slots.
   So every Ponty-sourced flip was planned, travelled toward and abandoned.

   What it takes instead, all measured from adventureland_mongodb
   node/server.js:
     - socket.on("sbuy") buys ONE listing by rid, and a rid is per listing per
       shard. The bridge's cached /ponty rows carry no rid, so the executor has
       to take a LIVE read on arrival and re-match by name and level.
     - Both the read and the buy gate on
       simple_distance(G.maps.main.ref.secondhands, player) > 500, so the town
       spot qualifies and nothing walks to him. scoutPontyDistance() is the same
       check the scout already uses.
     - The price is calculate_item_value(item) * G.multipliers.secondhands_mult
       (measured: 2), a property of the item, so a live row can be re-priced and
       compared with what was planned rather than trusted.
     - sbuy refuses with cant_in_bank, no_space, buy_cost and item_gone. Each is
       an ordinary outcome, and item_gone in particular is the normal one: somebody
       else took the listing between the scan and the trip. */
function arbPontyPlanned(t) { return !!t && (t.buyIsNpc || arbIsNpcTarget(t.buyFrom)); }

/* MERCHANT.JS HAS NO noHang(). That helper shipped in Ranger v51 / Priest v26 /
   Mage v50 and was never ported here - this file says so twice already, at the
   mover note and in the self-chained-loop note. v71 called it anyway, in both
   Ponty functions below, and referencing an undeclared identifier THROWS rather
   than evaluating to undefined. The throw landed in arbPontyLive's own catch and
   came back out as "could not read Ponty: noHang is not defined" with
   retry: true, so every Ponty flip burned its three attempts and abandoned -
   textbook Form B, a catch returning a plausible lie. Measured in Meltymerch's
   live CODE context 2026-10-01: typeof noHang === 'undefined'.

   So the bound lives here, local and self-contained, with no dependency on the
   party scripts. Promise.race is the idiom this file already uses for the party
   link and the scout bridge. Do NOT replace this with noHang(). */
function arbNoHang(p, label, ms) {
	return Promise.race([
		Promise.resolve(p),
		new Promise((_, rej) => setTimeout(() => rej(new Error((label || 'call') + ' timed out after ' + ms + 'ms')), ms)),
	]);
}

async function arbPontyLive() {
	if (typeof get_secondhands !== 'function') return { rows: null, why: 'get_secondhands is not in this context' };
	try {
		const r = await arbNoHang(get_secondhands(8000), 'get_secondhands', 10000);
		const list = (r && Array.isArray(r.items)) ? r.items : (Array.isArray(r) ? r : null);
		if (!list) return { rows: null, why: 'no items in the reply' };
		return { rows: list.filter((it) => it && it.name && it.rid) };
	} catch (e) {
		return { rows: null, why: (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e) };
	}
}

/* The cheapest live listing that matches what was planned. Level and special
   must match exactly - a +2 is not the +0 the flip was priced on. */
function arbPontyMatch(rows, t) {
	let best = null;
	for (const it of rows) {
		if (it.name !== t.item) continue;
		if ((it.level || 0) !== (t.level || 0)) continue;
		if ((it.p || null) !== (t.special || null)) continue;
		const price = scoutItemPrice(it);
		const cand = { rid: it.rid, price: (price == null ? t.buyPrice : price), q: it.q || 1 };
		if (!best || cand.price < best.price) best = cand;
	}
	return best;
}

/* Returns the same shape the trade_buy path produces, so at_buy reads one way. */
async function arbPontyBuy(t) {
	const dist = (typeof scoutPontyDistance === 'function') ? scoutPontyDistance() : null;
	if (dist === null || dist > 500) {
		return { ok: false, retry: true, reason: 'Ponty out of range ('
			+ (dist === null ? 'off main' : Math.round(dist)) + ') - the town spot is inside 500' };
	}
	const live = await arbPontyLive();
	if (!live.rows) return { ok: false, retry: true, reason: 'could not read Ponty: ' + live.why };
	const hit = arbPontyMatch(live.rows, t);
	if (!hit) return { ok: false, retry: false, reason: 'item_gone - ' + t.item + '+' + (t.level || 0) + ' is no longer in his stock' };
	/* Re-priced from the live row, because the plan came from a cached scan. A
	   listing that costs materially more than planned is not the trade that was
	   chosen, so it is refused rather than silently bought. */
	if (hit.price > t.buyPrice * (1 + (CONFIG.arbitrage.npcPriceDrift || 0))) {
		return { ok: false, retry: false, reason: 'priced at ' + hit.price + '/unit against the ' + t.buyPrice + ' planned' };
	}
	if (!arbAffordable(hit.price, character.gold)) {
		return { ok: false, retry: false, reason: 'would breach the ' + CONFIG.arbitrage.goldFloor + ' gold floor at the live price' };
	}
	/* ONE listing per sbuy, and a Ponty row is one item - so a multi-quantity
	   flip cannot be filled here. Take the one and correct the trade down to it
	   rather than selling a quantity we do not hold. */
	const before = character.gold;
	const had = pontyCount(t.item, t.level || 0);
	let refused = null;
	try { await arbNoHang(buy_secondhand(hit.rid), 'buy_secondhand', 12000); }
	catch (e) { refused = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e); }
	await sleep(400);
	const spent = before - character.gold;
	const arrived = pontyCount(t.item, t.level || 0) > had;
	if (!arrived) {
		return { ok: false, retry: refused === 'cooldown' || refused === 'distance',
			reason: (refused || 'nothing arrived') + (spent > 0 ? ' but ' + spent + ' gold left - CHECK THIS' : '') };
	}
	if (t.qty > 1) {
		arbLog('Ponty sells one listing at a time - trimming ' + t.item + ' from x' + t.qty + ' to x1', '#8b98ab');
		t.qty = 1;
	}
	return { ok: true, spent: spent > 0 ? spent : hit.price, rid: hit.rid };
}


	// ---- at_buy: verify, afford, buy ---------------------------------------
	if (t.phase === 'at_buy') {
		/* The NPC leg does not approach, verify or trade_buy like a stand: Ponty
		   has no position to walk to, no slot to verify and no entity to trade
		   with. It reads him live, re-matches, re-prices and buys by rid.
		   -> buying the NPC leg */
		if (arbPontyPlanned(t)) {
			const pr = await arbPontyBuy(t);
			if (!pr.ok) {
				t.attempts = (t.attempts || 0) + 1;
				const out = !pr.retry || t.attempts >= 3;
				arbLog('Ponty buy: ' + pr.reason + (out ? ' - giving up on this attempt' : ' - retrying'),
					out ? 'orange' : '#8b98ab');
				/* Remember the ROW, not the vendor. -> arbNoteGone */
				if (pr.reason && pr.reason.indexOf('item_gone') === 0) arbNoteGone(t.buyShard, t.buyFrom, t.item, t.level);
				/* buyShard on the abandon record too: without it the ledger cannot say
				   WHICH shard a Ponty failure happened on, which made the repeat loop
				   invisible until it was counted by item alone. */
				if (out) arbFinish(t, 'abandoned', { reason: 'Ponty: ' + pr.reason, disposition: 'nothing_spent', buyShard: t.buyShard, item: t.item, level: t.level });
				else arbSaveTrade(t);
				return;
			}
			t.actualSpend = pr.spent;
			/* No arbMarkUsed: there is no slot to mark, the listing is consumed by
			   the purchase itself, and marking the NAME would refuse every other
			   thing he has for usedCooldownMs. */
			t.phase = 'holding';
			t.attempts = 0;
			t.sellSince = t.sellSince || Date.now();
			arbSaveTrade(t);
			arbLedger({ id: t.id, event: 'open', item: t.item, level: t.level, special: t.special,
				qty: t.qty, buyPrice: t.buyPrice, buyFrom: t.buyFrom, buyShard: t.buyShard,
				spend: t.actualSpend, taxRate: t.taxRate });
			arbHeldAdd(t.item, t.qty, t.actualSpend);
			arbLog('bought ' + t.item + ' x' + t.qty + ' from Ponty for ' + t.actualSpend, '#7FD98A');
			return;
		}
		const near = await arbApproach(t.buyFrom, { map: t.buyMap, x: t.buyX, y: t.buyY });
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
		// A new leg, so the counter legitimately restarts here - and only here.
		t.attempts = 0;
		t.sellSince = t.sellSince || Date.now();
		arbSaveTrade(t);
		arbLedger({
			id: t.id, event: 'open', item: t.item, level: t.level, special: t.special,
			qty: t.qty, buyPrice: t.buyPrice, buyFrom: t.buyFrom, buyShard: t.buyShard,
			spend: t.actualSpend, taxRate: t.taxRate,
		});
		arbHeldAdd(t.item, t.qty, t.actualSpend);   // shield it from both NPC sell paths
		arbLog('bought ' + t.item + ' x' + t.qty + ' for ' + t.actualSpend, '#7FD98A');
		return;
	}

	// ---- fetch: the goods are in the BANK. Collect them, then sell as usual -
	if (t.phase === 'fetch') {
		if (!(await arbStockFetch(t))) {
			// arbStockFetch has already noted a missing item and forgotten it.
			// Clearing rather than arbFinish(): there is no counterparty to blame
			// for an empty bank, and the next look re-finds it if it reappears.
			arbClearTrade();
			return;
		}
		t.phase = 'holding';
		t.sellSince = t.sellSince || Date.now();
		arbSaveTrade(t);
		return;
	}

	// ---- holding: an item we paid for, and a shard to reach ----------------
	if (t.phase === 'holding') {
		const over = arbSellOverdueMs(t);
		if (over) {
			t.phase = 'stranded'; arbSaveTrade(t);
			arbLog('held ' + t.item + ' for ' + Math.round(over / 60000) + ' min without selling it - banking it', 'orange');
			return;
		}
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
		const over = arbSellOverdueMs(t);
		if (over) {
			t.phase = 'stranded'; arbSaveTrade(t);
			arbLog('held ' + t.item + ' for ' + Math.round(over / 60000) + ' min without selling it - banking it', 'orange');
			return;
		}
		const near = await arbApproach(t.sellTo, { map: t.sellMap, x: t.sellX, y: t.sellY });
		const v = near.ok ? arbStillThere(t, 'sell') : { ok: false, reason: near.reason };
		if (!v.ok) {
			/* The buyer is gone or has repriced. Re-asking the market is right - the
			   item is already paid for, so any profitable exit beats banking it -
			   but the answer has to be SOMEONE ELSE.

			   MEASURED 2026-09-29: an ascale x36 trade sat in at_sell for 29 minutes
			   with attempts reading 0. Mercantor's stand row kept coming back from
			   the bridge at 120s old, so arbFindBuyerFor returned the same buyer the
			   approach had just failed on, the reroute branch logged 'buyer changed'
			   and reset attempts to 0, and the 3-strike exit below could never be
			   reached. The merchant was standing ON the row's coordinates with
			   pEntity('Mercantor') null - the stand was simply not there. (That row
			   carried x: 0, y: 0, so even its position was no help.)

			   So: count the attempt ALWAYS and before anything else, shelve the
			   counterparty at once rather than waiting for the trade to end, and
			   remember the dead end on the trade so the search cannot offer it
			   again. */
			arbSellTried(t, t.sellShard, t.sellTo, t.sellSlot);
			t.attempts = (t.attempts || 0) + 1;
			arbNoteFailure(t.sellShard, t.sellTo);
			const left = (CONFIG.arbitrage.maxSellAttempts || 4) - t.attempts;
			const alt = left > 0 ? await arbFindBuyerFor(t) : null;
			if (alt) {
				arbLog('buyer gone (' + (v.reason || '?') + ') - rerouting to ' + alt.target
					+ ' on ' + alt.shard + ' @ ' + alt.price + ' (' + left + ' attempt(s) left)', '#FFD700');
				t.sellTo = alt.target; t.sellShard = alt.shard; t.sellSlot = alt.slot; t.sellPrice = alt.price;
				/* Carry the new buyer's position, or clear the old one. Rerouting
				   while keeping the previous buyer's coordinates would send the
				   merchant to the wrong spot and fail there; a null hint at least
				   fails immediately instead of walking first. A row at exactly 0,0 is
				   the placeholder the bridge emits when it has no position. */
				const hasPos = alt.map && typeof alt.x === 'number' && typeof alt.y === 'number'
					&& isFinite(alt.x) && isFinite(alt.y) && !(alt.x === 0 && alt.y === 0);
				t.sellMap = hasPos ? alt.map : null;
				t.sellX = hasPos ? alt.x : null;
				t.sellY = hasPos ? alt.y : null;
				t.phase = (alt.shard === here) ? 'at_sell' : 'holding';
				arbSaveTrade(t);
				return;
			}
			t.phase = 'stranded'; arbSaveTrade(t);
			arbLog('no other buyer for ' + t.item + ' after ' + t.attempts + ' attempt(s) - banking it', 'orange');
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
		arbHeldDrop(t.item);   // sold - ordinary goods again
		const share = arbBankShare(t.net);
		if (share > 0) await arbBankShareNow(t, share);
		return;
	}

	// ---- stranded: bought, unsellable. Bank it and close the books ---------
	if (t.phase === 'stranded') {
		const ok = await arbBankItem(t);
		if (ok) arbHeldDrop(t.item);   // in the bank, out of the seller's reach
		arbFinish(t, 'abandoned', {
			reason: 'no buyer found', disposition: ok ? 'banked_item' : 'held_in_inventory',
			item: t.item, qty: t.qty, spend: t.actualSpend || t.spend,
		});
		// Each stranding has turned liquid gold into stock. A run of them means
		// the market being traded against is not the market on the board, and
		// continuing would keep paying to find that out.
		// A stock sale that fails re-banks goods that were already banked, so no
		// gold became stock and the breaker must not count it. Read, do not write.
		const n = t.fromStock ? arbStrandings() : arbStrandings(1);
		if (n >= CONFIG.arbitrage.maxConsecutiveStrandings) {
			CONFIG.arbitrage.enabled = false;        // this run
			arbHalt(n + ' consecutive strandings');   // and every run until it expires
			arbLog('STOPPED: ' + n + ' trades in a row ended with the goods banked rather than sold. '
				+ 'Gold is being converted to stock. Halted for '
				+ Math.round(CONFIG.arbitrage.haltMs / 60000) + ' min - arbProbeHalt(false) clears it.', 'red');
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
	/* RESERVE PRICE - see CONFIG.arbitrage.fallbackMinRecovery. "Any exit at all"
	   is not the same as "any price at all". */
	const cost = t.actualSpend || t.spend || 0;
	const tr = (typeof t.taxRate === 'number' ? t.taxRate : arbTaxRate()) || 0;
	const need = cost * (CONFIG.arbitrage.fallbackMinRecovery || 0);
	let best = null, refused = 0, bestRefused = null, deadEnds = 0, shelved = 0, tooSmall = 0;
	for (const r of rows) {
		// Not even a last-resort exit. -> NEVER_TRADE_NAMES
		if (arbNeverBlocked(r.id)) continue;
		const age = pAgeSec(r.lastSeen);
		if (age == null || age > maxAge) continue;
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || !sl.b) continue;
			if ((sl.name + '|' + (sl.level || 0) + '|' + (sl.p || '')) !== key) continue;
			if (!(typeof sl.price === 'number' && isFinite(sl.price))) continue;
			const shard = String(r.serverRegion) + String(r.serverIdentifier);
			if (arbIsUsed(shard, r.id, k)) continue;   // we already filled this one
			// Stood here already this trade and it did not work. The whole point.
			if (arbSellTriedAlready(t, shard, r.id, k)) { deadEnds++; continue; }
			/* And the planner's own gate, which this search never consulted: a
			   counterparty shelved for repeated failures was still offered here as
			   the way out, which is how the same absent buyer kept winning. */
			if (arbFailBlocked(shard, r.id)) { shelved++; continue; }
			/* An order for 2 cannot absorb 36. trade_sell is one call for the whole
			   quantity, so a short order is a failed attempt, not a partial sale. */
			if (typeof sl.q === 'number' && isFinite(sl.q) && sl.q < t.qty) { tooSmall++; continue; }
			if (sl.price * t.qty * (1 - tr) < need) {
				refused++;
				if (bestRefused == null || sl.price > bestRefused) bestRefused = sl.price;
				continue;
			}
			const cand = { target: r.id, slot: k, price: sl.price, shard: shard, ageSec: age,
				map: r.map || null, x: r.x, y: r.y };
			if (!best || cand.price > best.price) best = cand;
		}
	}
	/* A refusal must say so, or "nobody was buying" and "everyone was buying too
	   cheaply" stay indistinguishable in the log forever. */
	if (!best && (deadEnds || shelved || tooSmall)) {
		arbLog('no new buyer for ' + t.item + ' - ' + deadEnds + ' already tried this trade, '
			+ shelved + ' shelved for repeated failures, ' + tooSmall + ' wanting fewer than '
			+ t.qty, '#8b98ab');
	}
	if (!best && refused) {
		const perUnit = (t.qty && (1 - tr)) ? Math.ceil(need / (t.qty * (1 - tr))) : null;
		arbLog('refused ' + refused + ' bid(s) for ' + t.item + ' below the reserve - best was '
			+ bestRefused + '/unit, need ' + perUnit + '/unit to recover ' + cost
			+ '. Banking the goods instead.', 'orange');
	}
	return best;
}

// Deposit the banked share, then return to the scan spot before anything else
// -> MerchantComments.md#arbBankShareNow
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

// Put an unsold item away rather than carry it. Inventory space is the scarcer
// -> MerchantComments.md#arbBankItem
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

/* Unwind one abandoned row. SECOND to flips, deliberately.

   v61 ran this first, reasoning that it commits no gold. That is true and it
   is not the deciding question: a flip is perishable - the spreads measured on
   2026-09-27 had been seen 7 and 48 seconds before they were priced - while a
   banked row keeps indefinitely. Running the backlog first put a 45-row queue
   at roughly one row per 10-19 minutes in front of every flip, and because the
   executor has a single trade slot that is a full stop rather than a delay.

   Returns true if it started one, so the caller knows the slot is spoken for.
   -> MerchantComments.md#flips-before-backlog */
async function arbTryStock() {
	const sale = await arbStockFindSale();
	if (!sale) return false;
	const st = arbStockPlan(sale);
	arbSaveTrade(st);
	state.busy = true;
	arbLog('stock: unwinding ' + st.item + ' x' + st.qty + ' -> ' + st.sellTo
		+ ' on ' + st.sellShard + ' (+' + sale.profit + ' after tax on a '
		+ sale.basisUnit + '/unit basis; +' + sale.overVendor + ' vs vendor)', '#FFD700');
	return true;
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
	/* FLIPS FIRST, backlog second. -> arbTryStock for why the v61 order
	   (stock before flips, because it commits no gold) was the wrong way
	   round. */
	const flips = await arbProbeFindFlips({ quiet: true });
	if (!flips || !flips.length) { await arbTryStock(); return; }
	const used = arbLoadUsed();
	const fails = arbLoadFails();
	const gone = arbLoadGone();
	let suppressed = 0, capped = 0;
	const pick = flips.find(function (f) {
		if (!f.affordable || !arbAffordable(f.spend, character.gold)) return false;
		// Per-item size limit - see CONFIG.arbitrage.itemCapitalCap.
		const cap = (CONFIG.arbitrage.itemCapitalCap || {})[f.item];
		if (cap && f.spend > cap) { capped++; return false; }
		// Either side having been traded recently disqualifies the route. The
		// sell side matters more - a buy order we filled is the one that costs
		// gold to rediscover - but a stand we emptied is equally not there.
		if (arbIsUsed(f.buyShard, f.buyFrom, f.buySlot, used)
			|| arbIsUsed(f.sellShard, f.sellTo, f.sellSlot, used)) { suppressed++; return false; }
		// Shelved after repeated failures against that counterparty - see
		// arbNoteFailure. Checked here rather than in arbIsUsed because it is a
		// different question: not "did we consume this" but "do we keep losing".
		if (arbFailBlocked(f.buyShard, f.buyFrom, fails)
			|| arbFailBlocked(f.sellShard, f.sellTo, fails)) { suppressed++; return false; }
		// That listing was gone last time we walked to it and his stock has not
		// rotated since. A different question again from the two above, because
		// an NPC is never shelved. -> arbNoteGone
		if (arbGoneBlocked(f.buyShard, f.buyFrom, f.item, f.level, gone)) { suppressed++; return false; }
		// Ingestion drops these, but a flip list built before a name was added is
		// still in memory. -> NEVER_TRADE_NAMES
		if (arbNeverBlocked(f.buyFrom) || arbNeverBlocked(f.sellTo)) { suppressed++; return false; }
		return true;
	});
	if (!pick) {
		if (suppressed) arbLog(suppressed + ' flip(s) skipped - traded against recently', '#8b98ab');
		if (capped) arbLog(capped + ' flip(s) skipped - over the per-item capital cap', '#8b98ab');
		await arbTryStock();
		return;
	}

	const t = arbPlan(pick, character.gold);
	arbSaveTrade(t);
	arbLog((CONFIG.arbitrage.dryRun ? '[dry run] ' : '') + 'taking ' + t.item + ' x' + t.qty
		+ ': buy ' + t.buyPrice + ' from ' + t.buyFrom
		+ ' (' + t.buyShard + '), sell ' + t.sellPrice + ' to ' + t.sellTo + ' (' + t.sellShard
		+ ') for ~' + t.expectProfit + ' net', '#FFD700');
}

// ============================================================================
// STAND SALES - vendor-bound goods listed on the stand instead of sold to NPC
// ============================================================================
// Some of what sellTrash() and the aggressive seller hand to an NPC is worth
// more sold to a player. This owns the first N trade slots, keeps the best
// candidates in them, and rotates as better ones appear.
//
// MEASURED 2026-09-22 - none of this was guessable from the code:
//   - trade(invSlot, tradeSlot, price, qty) takes a 1-INDEXED trade slot.
//     Slot 0 is an equipment slot and answers "cant_equip". CONFIG.stand
//     .listing.tradeSlot was 0, so ensureListing() has never once worked.
//   - Listing MOVES goods out of character.items into character.slots.tradeN.
//     They are therefore invisible to both NPC sell paths already, so no
//     "protect these" flag is needed - the exclusion is automatic.
//   - There is no unlist API. The verified removal is
//     parent.socket.emit('unequip', { slot: 'tradeN' }); the goods return to
//     inventory and restack. trade(..., 0) answers "slot_occuppied".
//   - Listing FREES an inventory slot; unlisting CONSUMES one. So this
//     relieves inventory pressure. The guard belongs on unlisting when nearly
//     full, not on listing.
//   - change_server RELOADS THE PAGE, so nothing may live in memory between
//     evaluations - the cadence runs off a timestamp in CODE storage.
const SS_KEY = 'stand_sales';

function ssLoad() { try { return get(SS_KEY) || {}; } catch (e) { return {}; } }
function ssSave(s) { try { set(SS_KEY, s); } catch (e) { } }
function ssLog(msg, color) { game_log('[stand] ' + msg, color || '#8b98ab'); }

/* "Would this be vendored right now?" - deliberately mirrors the predicate the
   two sell paths actually use, quirks included, because the premise of the
   feature is "instead of vendoring THIS". Note item.p is the special/prefix
   field, not a listing marker; the sell paths treat p !== undefined as a skip
   and this matches them rather than quietly widening the pool. */
function ssVendorBound(item) {
	if (!item || !item.name) return false;
	if (item.l === 'l') return false;
	if (item.p !== undefined) return false;
	if (PROTECTED_ITEM_NAMES.has(item.name)) return false;
	if (isExchangeable(item.name)) return false;   // -> EXCHANGEABLE ITEMS ARE NEVER SOLD
	if (isKeptMaterial(item.name)) return false;   // -> CONFIG.materials.keepAndBank
	if (isTier2OrTier3GearItem(item.name)) return false;
	if (arbHeldNames()[item.name]) return false;   // arbitrage owns this exit
	return true;
}

function ssNpcValue(item) {
	try {
		const v = parent.calculate_item_value(item);
		return (typeof v === 'number' && isFinite(v) && v > 0) ? v : null;
	} catch (e) { return null; }
}

/* The price at which a player sale nets exactly what the NPC would pay. Listing
   below this loses gold, which is the one thing the feature must never do. */
function ssFloor(npcValue) {
	const t = arbTaxRate();
	if (t == null || npcValue == null) return null;
	return Math.ceil(npcValue / (1 - t));
}

/* Bridge first, game feed when it is down or has nothing. The bridge shape is
   validated rather than trusted: it reported zero listings on every shard while
   the game feed returned 659, and a silently empty source would park the whole
   feature. */
async function ssMarketRows() {
	try {
		const r = await scoutFetch('/merchants');
		const rows = Array.isArray(r) ? r : (r && (r.rows || r.merchants));
		if (Array.isArray(rows) && rows.some(function (x) {
			const sl = (x && x.slots) || {};
			for (const k in sl) if (sl[k] && sl[k].price != null) return true;
			return false;
		})) return rows;
	} catch (e) { }
	try { return await arbFetchGameMerchants(CONFIG.standSales.marketTimeoutMs); }
	catch (e) { ssLog('no market data (bridge and game feed both failed)', 'orange'); return null; }
}

/* Cheapest live SALE listing of this exact item, ignoring our own stand and
   ignoring buy orders - a buy order at a low price is not a competing seller. */
function ssCheapest(rows, name, level) {
	let best = null;
	const me = character.name;
	for (const row of (rows || [])) {
		if (!row) continue;
		if (row.id === me || row.name === me) continue;
		const slots = row.slots || {};
		for (const k in slots) {
			const s = slots[k];
			if (!s || s.b || s.price == null || !s.name) continue;
			if (s.name !== name) continue;
			if ((s.level || 0) !== (level || 0)) continue;
			if (best == null || s.price < best) best = s.price;
		}
	}
	return best;
}

/* One priced candidate, or null with the reason it did not qualify. */
function ssPrice(rows, name, level, npcValue) {
	const cheapest = ssCheapest(rows, name, level);
	if (cheapest == null) return { ok: false, why: 'no competing listing' };
	const price = cheapest - CONFIG.standSales.undercutBy;
	const floor = ssFloor(npcValue);
	if (floor == null) return { ok: false, why: 'tax rate unknown' };
	if (price < floor) return { ok: false, why: 'undercut ' + price + ' below NPC floor ' + floor };
	const t = arbTaxRate();
	return { ok: true, price: price, cheapest: cheapest, gain: price * (1 - t) - npcValue };
}

function ssCandidates(rows) {
	const out = [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (!ssVendorBound(it)) continue;
		const npc = ssNpcValue(it);
		if (npc == null) continue;
		const p = ssPrice(rows, it.name, it.level || 0, npc);
		if (!p.ok) continue;
		out.push({ idx: i, name: it.name, level: it.level || 0, q: it.q || 1,
			price: p.price, npc: npc, gain: p.gain });
	}
	out.sort(function (a, b) { return b.gain - a.gain; });
	return out;
}

async function ssUnlist(slotNum) {
	try {
		parent.socket.emit('unequip', { slot: 'trade' + slotNum });
		await sleep(600);
		return !character.slots['trade' + slotNum];
	} catch (e) { ssLog('unlist trade' + slotNum + ' failed: ' + e, 'orange'); return false; }
}

/* One evaluation pass. `reason` is only for the log - the cadence gate is the
   caller's job, so a stand-open can force a pass the timer would have skipped. */
async function ssEvaluate(reason) {
	const cfg = CONFIG.standSales;
	const rows = await ssMarketRows();
	if (!rows) return;

	const st = ssLoad();
	const notes = st.notes || {};
	let ops = 0;

	// Pass 1 - re-price or evict what we are already showing. Unlisting returns
	// goods to inventory, so a re-price is an unlist here and a re-list below.
	for (const n of cfg.slots) {
		if (ops >= cfg.maxOpsPerPass) break;
		const s = character.slots['trade' + n];
		if (!s) continue;
		const npc = (notes['trade' + n] && notes['trade' + n].npc) != null
			? notes['trade' + n].npc
			: ssNpcValue({ name: s.name, level: s.level || 0 });
		if (npc == null) continue;
		const p = ssPrice(rows, s.name, s.level || 0, npc);
		const stale = !p.ok || p.price !== s.price;
		if (!stale) continue;
		if (character.esize <= cfg.minFreeSlotsToUnlist) {
			ssLog('want to re-price ' + s.name + ' but only ' + character.esize + ' free slots - leaving it', 'orange');
			continue;
		}
		if (await ssUnlist(n)) {
			ops++;
			delete notes['trade' + n];
			ssLog((p.ok ? 're-pricing ' : 'pulling ') + s.name + ' from trade' + n
				+ (p.ok ? ' (' + s.price + ' -> ' + p.price + ')' : ' (' + p.why + ')'));
		}
	}

	// Pass 2 - fill our empty slots with the best remaining candidates.
	const cands = ssCandidates(rows);
	let ci = 0;
	for (const n of cfg.slots) {
		if (ops >= cfg.maxOpsPerPass) break;
		if (character.slots['trade' + n]) continue;
		const c = cands[ci++];
		if (!c) break;
		const it = character.items[c.idx];
		if (!it || it.name !== c.name) continue;   // inventory moved under us
		try {
			await trade(c.idx, n, c.price, c.q);
			ops++;
			notes['trade' + n] = { npc: c.npc, at: Date.now() };
			ssLog('listed ' + c.name + (c.level ? ' +' + c.level : '') + ' x' + c.q
				+ ' @' + c.price + ' (NPC ' + Math.round(c.npc)
				+ ', +' + Math.round(c.gain) + ' net) in trade' + n, '#00FF00');
		} catch (e) {
			ssLog('list ' + c.name + ' failed: ' + ((e && (e.reason || e.message)) || e), 'orange');
		}
	}

	st.notes = notes;
	st.lastEvalAt = Date.now();
	st.lastReason = reason;
	ssSave(st);
}

/* Cadence gate. Home shard only, stand open only, and driven off a persisted
   timestamp because a shard hop reloads the page and would reset any timer. */
async function ssTick(reason) {
	const cfg = CONFIG.standSales;
	if (!cfg || !cfg.enabled) return;
	if (!character.stand) return;
	if (mShardKey() !== mHomeShard()) return;
	const st = ssLoad();
	const due = (Date.now() - (st.lastEvalAt || 0)) >= cfg.revalueEveryMs;
	if (!due && reason !== 'stand-open') return;
	await ssEvaluate(reason);
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
		// The stand is standLoop's business now, not this loop's.
		/* Idle only: no trade in flight and nothing else holding the character.
		   Same gate ssTick already uses, and restocking goes first because it is
		   cheap and someone may be about to ask for potions. */
		if (!ARB.cur && !ARB.busy && !state.busy) {
			await idleRestock();
			await ssTick('tick');
		}
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
// Nothing in this section runs on its own. Every function is called by hand
// -> MerchantComments.md#nothing-in-this-section-runs

// WHICH BUILD IS ACTUALLY RUNNING.
// -> MerchantComments.md#MERCHANT_BUILD
// BUMP THIS EVERY DEPLOY, together with line 2. It is the version a human
// sees in-game, via the [probe] game_log on load, and it is stamped into a
// stored arbitrage halt so you can tell which build tripped the breaker.
// It sat at v27 from 2026-09-19 to 2026-09-25 while the file reached v52, so
// the game log named the wrong build for 25 versions. It no longer gates
// anything: arbHalted() used to ignore a halt whose build differed, and that
// clause was removed in v53 - see CONFIG.arbitrage.haltMs.
/* Read by the operator - and by anyone diagnosing this character from outside,
   which is the reason it is now kept current. It sat at 'v57' through ten
   releases, and on 2026-09-29 a live probe of the running merchant reported v57
   while the deployed build was in fact v67. Feature-detection caught it; the
   string should not have needed catching. Bump this with every version. */
const MERCHANT_BUILD = 'v76 / exchangeables are never sold, and are banked when already at the bank / 2026-10-03';

function arbProbeBuild() {
	const api = Object.keys(parent.PROBE_API || {}).sort();
	const out = {
		build: MERCHANT_BUILD,
		api: api,
		apiCount: api.length,
		// Read from CONFIG, never transcribed into the build string. An earlier
		// -> MerchantComments.md#arbitrage-2
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

// A market view from outside this character.
// -> MerchantComments.md#arbFetchJson
async function arbFetchJson(url, ms) {
	if (typeof fetch !== 'function') throw new Error('no fetch');
	// no-store, and a cache-buster on top of it.
	// -> MerchantComments.md#o
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

// The game's own merchant feed, mapped into aldata's row shape.
// -> MerchantComments.md#arbFetchGameMerchants
async function arbFetchGameMerchants(ms) {
	if (typeof fetch !== 'function') throw new Error('no fetch');
	// POST, empty body. It rejects the usual method=/arguments= fields.
	// -> MerchantComments.md#emptyBody
	const o = { method: 'POST', cache: 'no-store', credentials: 'same-origin', body: '' };
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(function () { try { ac.abort(); } catch (e) { } }, ms);
	}
	let payload = null;
	try {
		const r = await fetch(CONFIG.scout.gameFeed, o);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		payload = await r.json();
	} finally { if (stop) clearTimeout(stop); }

	const infs = (payload && Array.isArray(payload.infs)) ? payload.infs : [];
	let chars = null;
	for (const inf of infs) {
		if (inf && inf.type === 'merchants' && Array.isArray(inf.chars)) { chars = inf.chars; break; }
	}
	if (!chars) throw new Error('no merchants block');

	// One stamp per fetch, so every row of this batch sorts identically.
	// -> MerchantComments.md#oneStampPerFetch
	const stamp = Date.now() - (CONFIG.scout.gameFeedAgeSec * 1000);
	const rows = [];
	let unparsed = 0;
	for (const c of chars) {
		if (!c || !c.name || !c.server) continue;
		const m = /^SR_(US|EU|ASIA)(.+)$/.exec(String(c.server));
		if (!m) { unparsed++; continue; }
		rows.push({
			id: c.name,
			lastSeen: stamp,
			map: c.map,
			x: c.x,
			y: c.y,
			serverRegion: m[1],
			serverIdentifier: m[2],
			slots: c.slots || {}
		});
	}
	if (unparsed) pLog(unparsed + ' game-feed row(s) had an unrecognised server tag', 'orange');
	return rows;
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

// One row per merchant per shard, taking whichever source saw it more
// -> MerchantComments.md#arbMergeMarketRows
function arbMergeMarketRows(aldataRows, bridgeRows, gameRows) {
	const by = new Map();
	let fromBridge = 0, fromAldata = 0, fromGame = 0, bridgeWins = 0, gameWins = 0;

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
			if (cur.src === 'game') gameWins--;
		}
		by.set(key, { row: row, age: age, src: src });
		if (src === 'bridge') bridgeWins++;
		if (src === 'game') gameWins++;
	};

	// Order is cosmetic - age decides, and a tie keeps whoever landed first.
	// -> MerchantComments.md#mergeOrder
	for (const r of (aldataRows || [])) { fromAldata++; take(r, 'aldata'); }
	for (const r of (gameRows || [])) { fromGame++; take(r, 'game'); }
	for (const r of (bridgeRows || [])) { fromBridge++; take(r, 'bridge'); }

	const rows = [];
	for (const e of by.values()) rows.push(e.row);
	return {
		rows: rows, fromAldata: fromAldata, fromBridge: fromBridge, fromGame: fromGame,
		bridgeWins: bridgeWins, gameWins: gameWins
	};
}

async function arbProbeMarketRows() {
	const want = arbProbeSource();
	const errors = {};

	const fetchOne = async function (src) {
		try {
			const rows = (src === 'aldata')
				? await arbFetchJson(CONFIG.scout.aldata + '/merchants', 8000)
				: (src === 'game')
					? await arbFetchGameMerchants(8000)
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
	if (want === 'bridge' || want === 'aldata' || want === 'game') {
		const rows = await fetchOne(want);
		if (rows) return { rows: rows, source: want };
		pLog('no market rows from pinned source ' + want + ' (' + errors[want]
			+ ') - falling back to what is in view', 'orange');
		return { rows: null, source: 'in-view', errors: errors };
	}

	const all = await Promise.all([fetchOne('aldata'), fetchOne('bridge'), fetchOne('game')]);
	const aldataRows = all[0], bridgeRows = all[1], gameRows = all[2];

	const live = [];
	if (aldataRows) live.push('aldata');
	if (bridgeRows) live.push('bridge');
	if (gameRows) live.push('game');

	if (!live.length) {
		pLog('no market rows from aldata, bridge or game (aldata: ' + errors.aldata
			+ '; bridge: ' + errors.bridge + '; game: ' + errors.game
			+ ') - falling back to what is in view', 'orange');
		return { rows: null, source: 'in-view', errors: errors };
	}
	// One source standing means no merge to report, and the label stays the
	// -> MerchantComments.md#singleSourceLabel
	if (live.length === 1) {
		const only = (aldataRows || bridgeRows || gameRows);
		return { rows: only, source: live[0], errors: errors };
	}

	const m = arbMergeMarketRows(aldataRows, bridgeRows, gameRows);
	pLog(m.rows.length + ' merchant rows merged (' + m.fromAldata + ' aldata, '
		+ m.fromBridge + ' bridge, ' + m.fromGame + ' game; bridge fresher on '
		+ m.bridgeWins + ', game fresher on ' + m.gameWins + ')');
	return { rows: m.rows, source: 'merged', merge: m, errors: errors };
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

// Ponty's stock, from the local bridge, across every shard a scout has read.
// -> MerchantComments.md#arbProbePontyRows
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

// Candidates for the BUY leg, taken from what the scouts already recorded
// -> MerchantComments.md#arbProbeFindBuy
async function arbProbeFindBuy(maxPrice) {
	const cap = maxPrice || CONFIG.arbitrage.probe.maxPrice;
	const got = await arbProbeMarketRows();
	const rows = got.rows || [];
	const here = mShardKey();
	const out = [];
	if (!rows.length) {
		// Stamped and wrapped in an array. Returning a bare object here once
		// -> MerchantComments.md#local
		const local = arbProbePick(cap);
		if (local) out.push(Object.assign({ source: 'in-view', shard: here, here: true, ageSec: 0 }, local));
		pLog('SOURCE: in-view scan only - ' + out.length + ' stand candidate(s)', 'orange');
	}
	for (const r of rows) {
		if (arbNeverBlocked(r.id)) continue;   // -> NEVER_TRADE_NAMES
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

// Candidates for the SELL leg - the taxed one, and the one that otherwise
// -> MerchantComments.md#arbProbeFindSell
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
	// -> MerchantComments.md#FRESH
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

// Why findSell came back empty.
// -> MerchantComments.md#arbProbeWhyNoSell
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

// THE MONEY QUERY: every buy-side listing that some player is paying more for
// -> MerchantComments.md#arbProbeFindFlips
async function arbProbeFindFlips(opts) {
	opts = opts || {};
	// QUIET MODE - for arbLookForWork, which calls this on every look.
	// -> MerchantComments.md#show
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
	const churn = arbChurnLoad();
	let churnDirty = false;
	for (const r of rows) {
		if (arbNeverBlocked(r.id)) continue;   // -> NEVER_TRADE_NAMES
		if (arbChurnNote(churn, r.id, r.map)) churnDirty = true;
		const shard = String(r.serverRegion) + String(r.serverIdentifier);
		const age = pAgeSec(r.lastSeen);
		for (const k in (r.slots || {})) {
			const sl = r.slots[k];
			if (!sl || !sl.name) continue;
			if (NO_TRADE_ITEM_NAMES.has(sl.name)) continue;   // never buy, never sell
			if (isExchangeable(sl.name)) continue;            // bought, it could never be flipped
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
	if (churnDirty) { try { set(ARB_CHURN_KEY, churn); } catch (e) { } }
	const pon = await arbProbePontyRows();
	for (const r of pon.rows) {
		if (NO_TRADE_ITEM_NAMES.has(r.name)) continue;   // never buy, never sell
		if (isExchangeable(r.name)) continue;            // bought, it could never be flipped
		if (!(typeof r.price === 'number' && isFinite(r.price))) continue;
		buys.push(Object.assign({ key: r.name + '|' + r.level + '|' + (r.p || ''), map: 'main', x: null, y: null }, r));
	}

	// Count what freshness throws away, and how narrowly.
	// -> MerchantComments.md#missed
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
			// WHERE they were standing, carried from the market row.
			// -> MerchantComments.md#flipCoords
			buyMap: buy.map || null, buyX: buy.x, buyY: buy.y,
			sellMap: sell.map || null, sellX: sell.x, sellY: sell.y,
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

// The named check. Object.keys does not see identifiers declared in the
// -> MerchantComments.md#arbProbeNamed
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

// The most valuable single output of Phase 0. A runner function is a thin
// -> MerchantComments.md#arbProbeSrc
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

// Every visible stand with its distance, so the operator can see what is in
// -> MerchantComments.md#arbProbeStands
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

// Inventory headroom. esize is the number the purchase gate will read, so it
// -> MerchantComments.md#arbProbeInv
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

// Walk to the bank, read what is actually there, and walk back - timed, since
// -> MerchantComments.md#arbProbeBank
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

// Stand exactly `dist` units from a target stand, on the line between here and
// -> MerchantComments.md#stand-exactly-dist-units-from
// Distance, computed here rather than through the game's distance().
// -> MerchantComments.md#pDist
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

// How far apart are distance() and plain arithmetic, and why?
// -> MerchantComments.md#arbProbeDistanceCheck
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

// Is this listing real, here, now?
// -> MerchantComments.md#arbProbeVerify
function arbProbeVerify(expect, opts) {
	expect = expect || {};
	opts = opts || {};
	// Quiet, as arbProbeFindFlips in v37 and for the same reason: a hand-run
	// -> MerchantComments.md#show-2
	const show = opts.quiet ? function (x) { return x; } : pShow;
	const note = opts.quiet ? function () { } : pLog;
	const out = { target: expect.target, slot: expect.slot, ok: false };
	const e = expect.target ? pEntity(expect.target) : null;
	if (!e) {
		out.reason = 'not_loaded';
		note(expect.target + ' is not loaded here - the listing is stale or we are out of range', 'orange');
		return show(out);
	}
	out.loaded = true;
	const me = pWhere(character), t = pWhere(e);
	out.sameMap = t.map === me.map;
	out.distance = out.sameMap ? Math.round(pDist(me.x, me.y, t.x, t.y)) : null;
	const sl = (e.slots || {})[expect.slot];
	if (!sl) {
		out.reason = 'slot_gone';
		note(expect.target + ' is here but ' + expect.slot + ' is empty - the stand was rearranged', 'orange');
		return show(out);
	}
	out.live = { name: sl.name, level: sl.level || 0, price: sl.price, q: sl.q, b: !!sl.b };
	const mismatch = [];
	if (expect.name != null && sl.name !== expect.name) mismatch.push('name ' + sl.name + ' not ' + expect.name);
	if (expect.level != null && (sl.level || 0) !== expect.level) mismatch.push('level ' + (sl.level || 0) + ' not ' + expect.level);
	if (expect.price != null && sl.price !== expect.price) mismatch.push('price ' + sl.price + ' not ' + expect.price);
	if (expect.b != null && !!sl.b !== !!expect.b) mismatch.push('side changed');
	out.mismatch = mismatch;
	out.ok = mismatch.length === 0;
	note(out.ok
		? 'verified: ' + expect.target + '.' + expect.slot + ' is ' + sl.name + ' @ ' + sl.price
			+ ', ' + out.distance + ' units away'
		: 'CHANGED since the listing: ' + mismatch.join('; ') + ' - re-evaluate before trading',
		out.ok ? null : 'orange');
	return show(out);
}

// Stand `dist` units from a target, and REPORT WHETHER IT ACTUALLY HAPPENED.
// -> MerchantComments.md#arbProbeStep
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
	try { await moveTo({ map: t.map, x: px, y: py }); }
	catch (err) {
		errors.push('smart_move: ' + (err && (err.reason || err.message) ? (err.reason || err.message) : String(err)));
		try { await moveNudge(function () { return move(px, py); }); }
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

// THE ONLY FUNCTION HERE THAT CAN MOVE GOLD.
// -> MerchantComments.md#arbProbeCall
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
	// -> MerchantComments.md#the-whole-reason-for-the
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

// Does calculate_item_value actually predict what a vendor pays?
// -> MerchantComments.md#arbProbeNpcSell
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
	/* The probe is hand-run and deliberately sells a real item, which is exactly
	   why the rule has to reach it too - a measurement is not an exemption. */
	if (isExchangeable(it.name)) {
		pLog('refused: ' + it.name + ' is exchangeable and is never sold', 'orange');
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
		'gearProbeTripwire(n)      what the gear tripwire judged, and why',
		'arbProbeSrc("trade_buy")   dump a function\'s source (the socket payload)',
		'arbProbeSource("aldata")   pin the market feed: aldata | bridge | game | auto',
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
		'PROBE_API.buyNow({...})    buy ONE listing - copy it from the watchlist page',
		'                           (the page emits parent.PROBE_API...; both work)',
		'arbProbeNpcSell(idx,"YES") does calculate_item_value predict the payout?',
		'arbProbeDump()             everything recorded, survives a reload',
		'arbProbeClear()            wipe the record',
	];
	for (const l of lines) { try { console.log('[probe] ' + l); } catch (e) { } }
	pLog('help printed to console (' + lines.length + ' commands)');
	return lines;
}

/* Reachable from the code console and from other scripts on this tab, under
   BOTH names - see the note on the window binding at the end of this block for
   why one of them was not enough. */
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
		/* The watchlist page's per-row buy command lands here. */
		buyNow: sbBuyNow,
		dump: arbProbeDump, clear: arbProbeClear, help: arbProbeHelp, state: PROBE,
	};
	/* AND BOUND INTO THE CODE SCOPE, WHICH IS WHERE IT ACTUALLY GETS PASTED.
	   v89 published this on `parent` only. Inside the maincode iframe
	   `window !== parent`, so the eval box - the one place these commands are
	   meant to be typed - answered every one of them with
	   "ReferenceError: PROBE_API is not defined". Measured 2026-10-10 in
	   Meltymerch's live context: bare PROBE_API undefined, parent.PROBE_API an
	   object with buyNow on it.

	   The parent assignment STAYS: it is what /hub and any top-window console
	   reach, and the watchlist page emits the parent-prefixed form so that one
	   string works against v89 and v90 alike. This line only adds the short
	   form for the eval box. */
	try { window.PROBE_API = parent.PROBE_API; } catch (e) { }
} catch (e) { }

// ============================================================================
// GAME LOG FILTER
// -> MerchantComments.md#FILTERS
if (parent.$) {

	(function () {
		const FILTERS = {
			kills: { show: false, regex: /killed/, label: 'Kills' },
			gold: { show: true, regex: /gold/, label: 'Gold' },
			party: { show: true, regex: /party/, label: 'Party' },
			items: { show: true, regex: /found/, label: 'Items' },
			upgrade: { show: true, regex: /(upgrade|combination)/, label: 'Upgrades' },
			errors: { show: true, regex: /(error|line|column)/i, label: 'Errors' },
			// Routine client chatter that says nothing actionable during farming.
			// -> MerchantComments.md#noise
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

		// Not every line in #gamelog comes through addLogEntry. The socket hook
		// -> MerchantComments.md#observeGamelog
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
						if (data.sound) parent.sfx(data.sound);
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
/* The stand is raised by standLoop and nowhere else. After a reload it goes up
   on the next tick, guarded by shouldHoldStand() - a reload on a remote shard
   is mid-rotation and no stand belongs there. The old bare call here was not
   even awaited. */
standLoop();
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
	// A cross-shard buy stashed before the hop picks itself up here.
	try { sbPendingResume(); } catch (e) { }
	game_log('[probe] ' + MERCHANT_BUILD + ' loaded (' + PROBE.log.length + ' stored entries'
		+ (PROBE.hold ? ', HOLD STILL ON' : '') + ') - arbProbeHelp() for commands',
		PROBE.hold ? '#FFD700' : '#8b98ab');
} catch (e) { }
