// ============================================================================
// LuckySlotFinder.js  -  finds this character's lucky upgrade slot
// ----------------------------------------------------------------------------
// MECHANISM (verified in the server source, not inferred):
//   server_functions.js:4225  player.p.item_num = parseInt(Math.random()*42)
//                             assigned ONCE per character, never re-rolled
//   server.js:7279            if (data.item_num == player.p.item_num
//                                 && Math.random() < 0.6)
//                                 result = max(Math.random()/1e4, result*0.975-0.012)
//   server.js:7312            if (result <= probability)  -> success
//
//   So in the lucky slot, 60% of rolls are compressed downward. Two fingerprints:
//     * roll == 0.0000 is ~75x more common  (0.75% vs 0.01%)
//     * roll >= 0.9630 is ~2.5x LESS common (0.975*1-0.012 = 0.963 is a hard ceiling)
//
//   This applies to NORMAL upgrades only. There is exactly one comparison of
//   p.item_num in the whole server; the pscroll/stat path and the entire
//   compound path do not have it. Compounding gains nothing from the lucky slot.
//
//   The slot is per CHARACTER. Run this on whichever character does your
//   upgrading. Moving items around does NOT move the lucky slot - the only
//   code that reassigns p.item_num is an admin mainframe command.
//
// WHY MEASURING THE ROLL (not the success rate) IS THE RIGHT CALL:
//   accumulated ugrace raises `probability` over time, so success rates drift.
//   The roll's distribution does not. Grace is irrelevant to this measurement.
//
// POSITIONING: parks at the newupgrade NPC (-207,-220) on main. Measured
//   distances from there, against the server's limit of B.sell_dist = 400:
//     newupgrade   0.0 | basics (helmet) 130.2 | scrolls (scroll0) 285.4
//   One spot covers buy, upgrade and sell. No movement during the run.
//
// NOTE: loading this into a CODE slot STOPS whatever was running there
//   (Merchant.js included). That is intended - but you lose mluck/arbitrage
//   for the duration.
// ============================================================================

const SLOTS          = 42;
const CONFIDENCE     = 0.99;     // stop when one slot reaches this posterior
const ITEM           = "helmet"; // 3,200g, cheapest NPC-buyable upgradable
const SCROLL         = "scroll0";// 1,000g; +0->+1 ~100%, +1->+2 98%
const SELL_AT        = 2;        // sell the helmet once it hits +2
const MIN_GOLD       = 1000000;  // refuse to continue below this
const MAX_ROLLS      = 20000;    // hard cap (p99 of the search is ~9,500)
const CONFIRM_ROLLS  = 300;      // extra rolls on the winner as a sanity check; 0 to skip
const REACH_MARGIN   = 380;      // server limit is 400; keep headroom
const UPGRADE_SPOT   = { map: "main", x: -207, y: -220 };

// --- bucket probabilities, derived from the source above -------------------
// bucket = floor(roll * 10000), reconstructed from the 4 revealed digits.
// The server TRUNCATES each digit (parseInt(u_roll*10000) % 10), so
// bucket 0 means roll < 0.0001 exactly - not "rounds to zero".
const P0_N = 0.0001,  PH_N = 0.0369,  PO_N = 1 - 0.0001 - 0.0369;
const P0_L = 0.4 * P0_N + 0.6 * (0.0121 / 0.975);   // 0.00749
const PH_L = 0.4 * PH_N;                            // 0.01476
const PO_L = 1 - P0_L - PH_L;

function likelihoodRatio(bucket) {
	if (bucket === 0)     return P0_L / P0_N;   // 74.9
	if (bucket >= 9630)   return PH_L / PH_N;   // 0.40
	return PO_L / PO_N;                         // 1.0153
}

// --- persisted state (survives a reload / CODE restart) --------------------
const STATE_KEY = "luckyslot_" + character.name;
let st = get(STATE_KEY) || null;
if (!st || !Array.isArray(st.logw) || st.logw.length !== SLOTS) {
	st = { logw: new Array(SLOTS).fill(0), tests: new Array(SLOTS).fill(0),
	       zeros: new Array(SLOTS).fill(0), highs: new Array(SLOTS).fill(0),
	       rolls: 0, done: null };
}
function saveState() { set(STATE_KEY, st); }

// --- roll capture ----------------------------------------------------------
// The server streams the roll's digits during the upgrade and tags each packet
// with the slot (`num`). Filtering on that slot is what makes this safe against
// a stray manual upgrade or compound landing in the sample.
let slotUnderTest = -1;
let lastNums = null;

if (parent.__luckyHook) {
	try { parent.socket.off("q_data", parent.__luckyHook); } catch (e) {}
}
parent.__luckyHook = function (d) {
	if (!d || d.num !== slotUnderTest) return;          // <- the critical guard
	const n = d.p && d.p.nums;
	if (n && n.length === 4 && n.every((x) => x !== undefined && x !== null)) {
		lastNums = n.slice();
	}
};
parent.socket.on("q_data", parent.__luckyHook);

function posterior() {
	const m = Math.max.apply(null, st.logw);
	const w = st.logw.map((x) => Math.exp(x - m));
	const t = w.reduce((a, b) => a + b, 0);
	return w.map((x) => x / t);
}

function findItem(pred) {
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (it && pred(it)) return i;
	}
	return -1;
}

// --- preflight -------------------------------------------------------------
function foreignItems() {
	const bad = [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (it && it.name !== ITEM && it.name !== SCROLL) bad.push(i + ":" + it.name);
	}
	return bad;
}

async function park() {
	if (character.map !== UPGRADE_SPOT.map ||
	    simple_distance(character, UPGRADE_SPOT) > 60) {
		set_message("Parking...");
		try { await smart_move("newupgrade"); }
		catch (e) { await smart_move(UPGRADE_SPOT); }
	}
	// Verify reach rather than assume it. All three must be inside the limit.
	const need = {
		upgrade: UPGRADE_SPOT,
		helmet:  (G.maps.main.items[ITEM]   || [])[0],
		scroll:  (G.maps.main.items[SCROLL] || [])[0]
	};
	const far = [];
	for (const k in need) {
		if (!need[k]) { far.push(k + ":no-vendor"); continue; }
		const d = simple_distance(character, need[k]);
		if (d > REACH_MARGIN) far.push(k + ":" + d.toFixed(0));
	}
	const merchantNear = (G.maps.main.merchants || []).some(
		(m) => simple_distance(character, m) < REACH_MARGIN);
	if (!merchantNear) far.push("sell:no-merchant-in-range");
	return far;
}

async function sellFinished() {
	let i;
	while ((i = findItem((it) => it.name === ITEM && (it.level || 0) >= SELL_AT)) !== -1) {
		await sell(i, 1);
	}
}

async function prepare(slot) {
	await sellFinished();
	let h = findItem((it) => it.name === ITEM && (it.level || 0) < SELL_AT);
	if (h === -1) {
		await buy(ITEM, 1);
		h = findItem((it) => it.name === ITEM && (it.level || 0) < SELL_AT);
		if (h === -1) throw { reason: "no_helmet" };
	}
	if (h !== slot) await swap(h, slot);
	let s = locate_item(SCROLL);
	if (s === -1) {
		await buy(SCROLL, 100);
		s = locate_item(SCROLL);
		if (s === -1) throw { reason: "no_scroll" };
	}
	return s;
}

// Returns the bucket, or null when no roll was observed.
async function rollOnce(slot) {
	const scroll = await prepare(slot);
	slotUnderTest = slot;
	lastNums = null;
	// A failed upgrade still produced a real roll - do NOT discard it.
	try { await upgrade(slot, scroll); } catch (e) {}
	if (!lastNums) return null;
	// nums[0] is the 4th decimal ... nums[3] the 1st
	return lastNums[3] * 1000 + lastNums[2] * 100 + lastNums[1] * 10 + lastNums[0];
}

async function main() {
	const bad = foreignItems();
	if (bad.length) {
		return game_log("ABORT: bank everything first. This shuffles slots 0-41. " +
		                "Foreign items: " + bad.join(", "));
	}
	const far = await park();
	if (far.length) return game_log("ABORT: out of reach after parking -> " + far.join(", "));
	game_log("Parked at the upgrade NPC. Searching " + character.name + "'s lucky slot.");

	let errs = 0;
	while (st.rolls < MAX_ROLLS) {
		if (character.gold < MIN_GOLD) { saveState(); return game_log("ABORT: gold floor reached"); }

		// Greedy: always test the current most-likely slot.
		let slot = 0;
		for (let i = 1; i < SLOTS; i++) if (st.logw[i] > st.logw[slot]) slot = i;

		let bucket;
		try { bucket = await rollOnce(slot); errs = 0; }
		catch (e) {
			if (++errs >= 10) { saveState(); return game_log("ABORT: 10 consecutive errors: " + JSON.stringify(e)); }
			await new Promise((r) => setTimeout(r, 1000));
			continue;
		}
		if (bucket === null) continue;   // digits never arrived; carries no information

		st.logw[slot] += Math.log(likelihoodRatio(bucket));
		st.tests[slot]++;
		if (bucket === 0) st.zeros[slot]++;
		else if (bucket >= 9630) st.highs[slot]++;
		st.rolls++;
		if (st.rolls % 25 === 0) saveState();

		const p = posterior();
		let best = 0;
		for (let i = 1; i < SLOTS; i++) if (p[i] > p[best]) best = i;
		set_message("R" + st.rolls + " s" + best + " " + (100 * p[best]).toFixed(0) + "%");

		if (p[best] >= CONFIDENCE) {
			st.done = best; saveState();
			game_log("LUCKY SLOT = " + best + "  (" + (100 * p[best]).toFixed(2) +
			         "% after " + st.rolls + " rolls, " + st.tests[best] + " in that slot)");
			if (CONFIRM_ROLLS > 0) await confirm(best);
			await sellFinished();
			show_json({ character: character.name, lucky_slot: best,
			            confidence: p[best], rolls: st.rolls,
			            tests: st.tests, zeros: st.zeros, highs: st.highs });
			return;
		}
	}
	saveState();
	game_log("Roll cap reached with no slot at " + CONFIDENCE);
}

// Independent check on the winner: the zero rate is the loud fingerprint.
async function confirm(slot) {
	let n = 0, z = 0, h = 0;
	game_log("Confirming slot " + slot + " over " + CONFIRM_ROLLS + " rolls...");
	while (n < CONFIRM_ROLLS) {
		if (character.gold < MIN_GOLD) break;
		let b;
		try { b = await rollOnce(slot); } catch (e) { continue; }
		if (b === null) continue;
		n++;
		if (b === 0) z++; else if (b >= 9630) h++;
		set_message("C" + n + "/" + CONFIRM_ROLLS + " z" + z);
	}
	game_log("CONFIRM slot " + slot + ": " + n + " rolls, " + z + " zeros, " + h + " highs");
	game_log("  expected if LUCKY : " + (n * P0_L).toFixed(1) + " zeros, " + (n * PH_L).toFixed(1) + " highs");
	game_log("  expected if NORMAL: " + (n * P0_N).toFixed(2) + " zeros, " + (n * PH_N).toFixed(1) + " highs");
}

main();
