// ============================================================================
// UpgradeCompound.js - v5 (2026-10-04) the planner no longer divides by a probability the game allows to exceed 1, no longer plans on the retired offeringp/offeringx, and falls back to a shared price table instead of giving up - v4 (2026-09-29) a stop re-checks itself every tick and clears the moment the situation changes; every awaited game call is bounded, so a hung call costs one tick, not the run; a dry run buys nothing - v3 (2026-09-29) slot 0 is the item, compound copies come from the bag - v2 (2026-09-29) aldata rows over ten minutes old are historical pricing, not listings - v1 (2026-09-29) first version, forked from Upgrade.js - upgrade AND compound to a target level
// at the lowest EXPECTED cost, counting the gear that failed rolls destroy.
//
// Runs on Meltymerch, inventory only, while the operator watches. The original
// Upgrade script is untouched; this is its successor, not an edit of it.
//
// SLOT 0 IS THE ITEM, as in the original. Whatever sits in slot 0 is evaluated
// and rolled, up to its target level. For a compound the other two copies are
// found anywhere else in the bag by name and level; slot 0 goes in first, and
// the server keeps the FIRST selected item on success - so what you put in
// slot 0 is what comes out a level higher. An empty slot 0 idles; it does not
// stop, because a failed upgrade empties it and the next item is yours to add.
//
// A STOP IS NOT A DEAD END, and nothing here waits on you to notice it. Every
// stop records a fingerprint of the situation it stopped in: what is in slot 0,
// a tally of the whole bag, gold to the nearest million, and how far you stand
// from the shrine and the two NPCs. Every tick compares that fingerprint with
// now, and the moment it differs the stop clears itself and the plan is worked
// out again. Drop a new item in slot 0, add the two compound copies, put the
// offering you just bought in the bag, walk to the shrine - it picks up from
// there on its own, no ucResume() needed. Nothing changed means it stays put
// and stays quiet. Server refusals that are usually momentary (calculation mode
// or a roll refused, an NPC buy that failed) also retry by themselves after
// RETRY_MS, RETRY_TRIES times, and only then wait for you.
//
// AND NO AWAIT IS UNBOUNDED. buy(), calculation mode and the roll itself are
// each wrapped in ucNoHang(), because an awaited call that never settles would
// leave the tick lock held and every later tick would return at the door - the
// exact shape of a script that looks alive and does nothing. A hang now costs
// one tick. The lock itself has a backstop too, in case something outside these
// three ever hangs.
//
// EVERY MECHANIC HERE WAS PULLED FROM THE SERVER SOURCE AND THE GAME DOCS ON
// 2026-09-29, not remembered. Sources: adventureland_mongodb node/server.js
// (socket "upgrade" and "compound" handlers), design/upgrades.js (base chance
// tables), js/old_common_functions.js (calculate_item_grade), and the
// "upgrading" / "compounding" guide articles.
//
//   - A failed upgrade destroys the item. A failed compound destroys all three.
//   - The scroll must match the item's CURRENT grade, which is per item:
//     G.items[x].grades (default [9,10,11,12]) gives the levels at which grade
//     1/2/3/4 begin. frankypants is [0,0,9,10]: Rare from +0. Grade 4 = Exalted,
//     no further upgrade or compound is accepted.
//   - A higher-grade scroll is accepted. Upgrade: p*1.2+0.01, ONLY while the
//     new level is <= 10. Compound: p*1.1+0.001.
//   - Offering multipliers depend on offering grade MINUS item grade
//     (upgrade / compound): >1: 1.7/1.64  1: 1.5/1.48  0: 1.4/1.36
//     -1: 1.15/1.15  lower: 1.08/1.08.
//   - Then a ceiling. Upgrade: min(base+0.36, base*3) with a higher scroll or
//     offering, else min(base+0.24, base*2). Compound: min(base*(3+0.6h),
//     base+0.2+0.05h), h = scroll grade gap (or 1 from an offering).
//   - GRACE (item, player, server-wide) raises the real chance and is not
//     visible from the client, so it is modelled as 0 for PLANNING, and the
//     game's own calculation mode - upgrade(...,true) / compound(...,true) -
//     is used for the exact chance of the roll about to be made.
//
// PRICING RULES (the operator's, 2026-09-29):
//   - An item's value is what it costs to make, expected losses included, or
//     what the market says - never an NPC number unless an NPC sells it for gold.
//   - NPC gold price is G.items[x].g, exactly (server: cost = q * g).
//   - offeringp and offeringx are not NPC-sold: market only. Their `g` fields
//     (480k / 242M) are vendor values and are IGNORED.
//   - Crun's scroll3/cscroll3 count at min(market, his 480M) and are never
//     auto-bought; the operator is told to buy them.
//   - Base item: PRICE_OVERRIDES, then Ponty, then the lowest FRESH ask, then
//     the lowest HISTORICAL ask, then NPC gold if NPC-sold, else STOP and ask
//     for an override. A stand row older than HISTORICAL_AFTER_SEC (10 min) is
//     historical: it prices the item, but it is not a listing anyone can buy
//     from, so it never sends the operator shopping and never undercuts an NPC
//     price that is actually payable.
//   - When the cheapest path needs something not in inventory and not
//     buyable from an NPC here: print exactly what to buy and STOP. The
//     operator buys it, or proceeds by hand.
// ============================================================================

const UC_CONFIG = {
	/* How far to take whatever is in slot 0. Mode is auto-detected from G.items
	   (upgrade vs compound). TARGET_LEVELS wins for a named item. */
	TARGET_LEVEL: 7,
	TARGET_LEVELS: {
		// frankypants: 7,
	},

	/* Set a value here to override every other source for that item at +0.
	   Left null, the chain is: Ponty -> market low -> NPC gold (if sold) -> STOP. */
	PRICE_OVERRIDES: {
		// frankypants: 950000,
	},

	/* Last resort, consulted only after Ponty, the fresh ask, the historical
	   ask and the NPC price have all come up empty. An override above beats
	   these; a live price beats them too. Kept in step with Merchant.js's
	   GEAR_VALUE_FALLBACK - if you change one, change the other. */
	PRICE_FALLBACK: {
		gcape: 2000000000,
		sbelt: 2000000000,
		tshirt9: 2000000000,
		starkillers: 100000000,
		mshield: 720001,
		rabbitsfoot: 126000000,
		mmhat: 10500000,
		ecape: 126000,
	},

	DRY_RUN: true,            // print the plan and the exact chance, roll nothing
	MIN_GOLD_TO_BUY: 1000000, // never spend NPC gold below this (as the original)
	MIN_CHANCE: 0.0,          // refuse a roll whose EXACT chance is below this

	/* NPCs this character may buy from on his own. Anything else NPC-sold is
	   priced at min(market, npc) and left to the operator. */
	AUTOBUY_NPCS: ['scrolls', 'premium'],   // Lucas, Garwyn

	BRIDGE: 'http://127.0.0.1:8787',
	ALDATA: 'https://aldata.earthiverse.ca',
	PRICE_TTL_MS: 5 * 60 * 1000,
	HISTORICAL_AFTER_SEC: 600,   // a stand row older than this is a price, not a listing
	TICK_MS: 4000,
	FETCH_MS: 8000,

	/* A stop that is probably momentary retries itself this often, this many
	   times, before it waits for the situation to change. A stop caused by
	   something you have to do - an item to add, a walk to the shrine - does not
	   use these: it clears the instant the fingerprint changes. */
	RETRY_MS: 30000,
	RETRY_TRIES: 3,

	/* Ceilings on awaited game calls. A roll gets longer than the rest, and a
	   roll that times out stops rather than retries: it may have landed. */
	HANG_MS: 20000,
	ROLL_HANG_MS: 30000,
	BUSY_MAX_MS: 90000,   // backstop: force the tick lock open after this
};

// ------------------------------------------------------------ base chances
// design/upgrades.js, verbatim. Row = the item's grade at +0 (its igrade);
// column = the level being attempted.
const UC_UPGRADES = {
	0: { 1: 0.9999999, 2: 0.98, 3: 0.95, 4: 0.7, 5: 0.6, 6: 0.4, 7: 0.25, 8: 0.15, 9: 0.07, 10: 0.024, 11: 0.14, 12: 0.11 },
	1: { 1: 0.99998, 2: 0.97, 3: 0.94, 4: 0.68, 5: 0.58, 6: 0.38, 7: 0.24, 8: 0.14, 9: 0.066, 10: 0.018, 11: 0.13, 12: 0.10 },
	2: { 1: 0.97, 2: 0.94, 3: 0.92, 4: 0.64, 5: 0.52, 6: 0.32, 7: 0.232, 8: 0.13, 9: 0.062, 10: 0.015, 11: 0.12, 12: 0.09 },
};
const UC_COMPOUNDS = {
	0: { 1: 0.99, 2: 0.75, 3: 0.40, 4: 0.25, 5: 0.20, 6: 0.10, 7: 0.08, 8: 0.05, 9: 0.05, 10: 0.05 },
	1: { 1: 0.90, 2: 0.70, 3: 0.40, 4: 0.20, 5: 0.15, 6: 0.08, 7: 0.05, 8: 0.05, 9: 0.05, 10: 0.03 },
	2: { 1: 0.80, 2: 0.60, 3: 0.32, 4: 0.16, 5: 0.10, 6: 0.05, 7: 0.03, 8: 0.03, 9: 0.03, 10: 0.02 },
};

/* Measured from G.maps.main on 2026-09-29. One NPC (newupgrade) runs BOTH
   shrines. Lucas is 288 units from it, so scrolls buy from the shrine; Garwyn
   is ~530 away, so `offering` needs a walk. buy() and calculation mode both
   refuse with "distance" when out of range - the operator stands, not the script. */
const UC_SPOTS = {
	shrine: { x: -207, y: -220, who: 'Cue (upgrade + compound)' },
	scrolls: { x: -464, y: -96, who: 'Lucas' },
	premium: { x: 192, y: -564, who: 'Garwyn' },
};
function ucWhere(id) { const s = UC_SPOTS[id]; return s ? s.who + ' at main (' + s.x + ',' + s.y + ')' : id; }

const UC_USCROLLS = ['scroll0', 'scroll1', 'scroll2', 'scroll3', 'scroll4'];
const UC_CSCROLLS = ['cscroll0', 'cscroll1', 'cscroll2', 'cscroll3'];
const UC_OFFERINGS = [null, 'offeringp', 'offering', 'offeringx'];   // index = grade

/* What the PLANNER is allowed to choose. offeringp and offeringx carry
   "ignore": true in design/items.js - they are RETIRED, obtainable by no route
   at all, which is the measured reason no NPC stocks them. Left in UC_OFFERINGS
   above because that array is indexed by grade and the chance maths still needs
   the entries; removed from the planner so a plan is never built on an item
   that cannot be bought. Without this the cheapest path routinely picked
   offeringp, ucAcquire failed at the market branch, and the run stopped partway
   up the ladder having printed a plan it could never execute. */
const UC_PLANNABLE_OFFERINGS = [null, 'offering'];

// --------------------------------------------------------------- state
const UC = {
	stop: null,           // { reason, needs, sig, tries, retryAt } - see ucStop()
	prevStop: null,       // { reason, tries } while a timed retry is in flight
	busy: false,
	busyAt: 0,            // when the tick lock was taken, for the hang backstop
	busySeq: 0,           // which tick holds it, so a forced-open tick cannot free another's
	lastPrint: null,      // signature the plan was last printed for
	prices: { at: 0, asks: {}, hist: {}, ponty: {}, errors: {} },   // asks = fresh, hist = aged
	npcGold: null,        // name -> { g, npc, autobuy }
	history: [],          // every roll: { t, mode, item, from, to, chance, exact, success, spent, lost }
	idleNote: null,
};

function ucLog(m, c) { try { game_log('[uc] ' + m, c || '#8b98ab'); } catch (e) { } console.log('[uc] ' + m); }
function ucFmt(n) { return (n == null || !isFinite(n)) ? '?' : Math.round(n).toLocaleString('en-US'); }
function ucG() { return (typeof parent !== 'undefined' && parent.G) ? parent.G : (typeof G !== 'undefined' ? G : null); }

// --------------------------------------------------------------- grades
function ucGrades(def) { return (def && def.grades) || [9, 10, 11, 12]; }
function ucGradeAt(def, level) {
	if (!def || !(def.upgrade || def.compound)) return 0;
	const g = ucGrades(def), L = level || 0;
	if (L >= g[3]) return 4;
	if (L >= g[2]) return 3;
	if (L >= g[1]) return 2;
	if (L >= g[0]) return 1;
	return 0;
}
function ucMode(def) { return def && def.upgrade ? 'upgrade' : (def && def.compound ? 'compound' : null); }

// ---------------------------------------------------- chance, grace = 0
/* Mirrors the server's scroll branch exactly with every grace term at zero.
   Returns null when the attempt would be refused. */
function ucUpgradeChance(def, level, scrollName, offeringName) {
	const G = ucG();
	const grade = ucGradeAt(def, level);
	if (grade >= 4) return null;
	const sdef = G.items[scrollName];
	if (!sdef || sdef.type !== 'uscroll' || grade > sdef.grade) return null;
	const igrade = ucGradeAt(def, 0);
	const row = UC_UPGRADES[igrade];
	const newLevel = (level || 0) + 1;
	if (!row || row[newLevel] == null) return null;
	const base = row[newLevel];
	let p = base, high = false;
	if (sdef.grade > grade && newLevel <= 10) { p = p * 1.2 + 0.01; high = true; }
	if (offeringName) {
		const od = G.items[offeringName];
		if (!od || od.type !== 'offering') return null;
		const d = od.grade - grade;
		if (d > 1) { p *= 1.7; high = true; }
		else if (d === 1) { p *= 1.5; high = true; }
		else if (d === 0) { p *= 1.4; }
		else if (d === -1) { p *= 1.15; }
		else { p *= 1.08; }
	}
	const cap = high ? Math.min(base + 0.36, base * 3) : Math.min(base + 0.24, base * 2);
	return Math.min(p, cap);
}

function ucCompoundChance(def, level, scrollName, offeringName) {
	const G = ucG();
	const grade = ucGradeAt(def, level);
	if (grade >= 4) return null;
	const sdef = G.items[scrollName];
	if (!sdef || sdef.type !== 'cscroll' || grade > sdef.grade) return null;
	/* Server quirk, kept: from +3 up the table row is the grade at level-2. */
	const rowGrade = (level || 0) >= 3 ? ucGradeAt(def, level - 2) : ucGradeAt(def, 0);
	const row = UC_COMPOUNDS[rowGrade];
	const newLevel = (level || 0) + 1;
	if (!row || row[newLevel] == null) return null;
	const base = row[newLevel];
	let p = base, high = 0;
	if (sdef.grade > grade) { p = p * 1.1 + 0.001; high = sdef.grade - grade; }
	if (offeringName) {
		const od = G.items[offeringName];
		if (!od || od.type !== 'offering') return null;
		const d = od.grade - grade;
		if (d > 1) { p *= 1.64; high = 1; }
		else if (d === 1) { p *= 1.48; high = 1; }
		else if (d === 0) { p *= 1.36; }
		else if (d === -1) { p *= 1.15; }
		else { p *= 1.08; }
	}
	const cap = Math.min(base * (3 + high * 0.6), base + 0.2 + high * 0.05);
	return Math.min(p, cap);
}

// --------------------------------------------------------------- prices
function ucNpcGold() {
	if (UC.npcGold) return UC.npcGold;
	const G = ucG(), out = {};
	for (const id in G.npcs) {
		const n = G.npcs[id];
		if (!n || n.role !== 'merchant' || !Array.isArray(n.items)) continue;
		for (const name of n.items) {
			if (!name || !G.items[name] || typeof G.items[name].g !== 'number') continue;
			const auto = UC_CONFIG.AUTOBUY_NPCS.indexOf(id) >= 0;
			if (!out[name] || (auto && !out[name].autobuy)) out[name] = { g: G.items[name].g, npc: id, autobuy: auto };
		}
	}
	UC.npcGold = out;
	return out;
}

async function ucFetchJson(url) {
	if (typeof fetch !== 'function') throw new Error('no fetch');
	const o = { cache: 'no-store' };
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController(); o.signal = ac.signal;
		stop = setTimeout(function () { try { ac.abort(); } catch (e) { } }, UC_CONFIG.FETCH_MS);
	}
	try {
		const r = await fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now(), o);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		return await r.json();
	} finally { if (stop) clearTimeout(stop); }
}

/* ISO string or epoch, seconds or ms - aldata and the bridge need not agree. */
function ucAgeSec(when) {
	const t = (typeof when === 'number') ? when : Date.parse(when);
	if (!isFinite(t)) return null;
	const ms = (t > 1e12) ? t : (t > 1e9 ? t * 1000 : t);
	return Math.round((Date.now() - ms) / 1000);
}
function ucAgeStr(sec) { return sec == null ? 'age unknown' : sec < 3600 ? Math.round(sec / 60) + 'm ago' : (sec / 3600).toFixed(1) + 'h ago'; }

/* Lowest SELL listing per item+level across aldata and the bridge, plus Ponty
   separately. Same row shape Merchant.js reads: r.slots[k] = {name, level,
   price, q, b}; b marks a buy order and is skipped. Each stand row carries
   lastSeen; rows older than HISTORICAL_AFTER_SEC (or of unknown age) go to
   `hist` - a price, not a listing. Fresh rows go to `asks`. */
async function ucRefreshPrices(force) {
	if (!force && Date.now() - UC.prices.at < UC_CONFIG.PRICE_TTL_MS) return UC.prices;
	const asks = {}, hist = {}, ponty = {}, errors = {};
	const take = function (bucket, name, level, price, src, age) {
		if (typeof price !== 'number' || !isFinite(price) || price <= 0) return;
		const k = name + '+' + (level || 0);
		if (!bucket[k] || price < bucket[k].price) bucket[k] = { price: price, src: src, age: age };
	};
	const stands = async function (url, src) {
		try {
			const rows = await ucFetchJson(url);
			if (!Array.isArray(rows)) throw new Error('not an array');
			for (const r of rows) {
				const age = ucAgeSec(r.lastSeen);
				const fresh = age != null && age <= UC_CONFIG.HISTORICAL_AFTER_SEC;
				for (const k in (r.slots || {})) {
					const sl = r.slots[k];
					if (!sl || !sl.name || sl.b) continue;
					take(fresh ? asks : hist, sl.name, sl.level, sl.price, src, age);
				}
			}
		} catch (e) { errors[src] = String(e && e.message || e); }
	};
	await Promise.all([
		stands(UC_CONFIG.BRIDGE + '/merchants', 'bridge'),
		stands(UC_CONFIG.ALDATA + '/merchants', 'aldata'),
		(async function () {
			try {
				const p = await ucFetchJson(UC_CONFIG.BRIDGE + '/ponty');
				for (const shard in (p || {})) {
					const age = ucAgeSec((p[shard] || {}).at);
					for (const it of ((p[shard] || {}).items || [])) {
						if (it && it.name) take(ponty, it.name, it.level, it.price, 'ponty:' + shard, age);
					}
				}
			} catch (e) { errors.ponty = String(e && e.message || e); }
		})(),
	]);
	UC.prices = { at: Date.now(), asks: asks, hist: hist, ponty: ponty, errors: errors };
	const es = Object.keys(errors);
	ucLog('prices: ' + Object.keys(asks).length + ' fresh asks, ' + Object.keys(hist).length + ' historical, ' + Object.keys(ponty).length + ' ponty'
		+ (es.length ? ' - FAILED: ' + es.map(function (k) { return k + ' (' + errors[k] + ')'; }).join(', ') : ''),
		es.length ? 'orange' : '#8b98ab');
	return UC.prices;
}

/* Where a consumable comes from and what it costs. `how`:
     inventory  - already held, cost is still its value (it could be sold)
     npc        - buyable here for gold, and allowed to be
     market     - operator must buy it; cost is the market low (or Crun's price
                  if that is lower, but still the operator's job) */
function ucSource(name) {
	const held = (typeof quantity === 'function') ? quantity(name) : 0;
	const npc = ucNpcGold()[name];
	const mkt = UC.prices.asks[name + '+0'];          // fresh: someone is selling it now
	const old = UC.prices.hist[name + '+0'];          // aged: a price, not a listing
	let cost = null, how = null, note = '';
	if (npc && npc.autobuy) { cost = npc.g; how = 'npc'; note = npc.npc; }
	else if (npc && mkt && mkt.price < npc.g) { cost = mkt.price; how = 'market'; note = mkt.src + ' (under ' + npc.npc + '\'s ' + ucFmt(npc.g) + ')'; }
	else if (npc) { cost = npc.g; how = 'market'; note = npc.npc + ' sells it, you buy it'; }
	else if (mkt) { cost = mkt.price; how = 'market'; note = mkt.src; }
	else if (old) { cost = old.price; how = 'market'; note = old.src + ' last seen ' + ucAgeStr(old.age) + ' - NOT currently listed'; }
	if (held > 0) how = 'inventory';
	return { name: name, cost: cost, how: how, held: held, note: note };
}

/* Value of one base (+0) copy of the item being made. */
function ucBaseValue(name) {
	const ov = UC_CONFIG.PRICE_OVERRIDES[name];
	if (typeof ov === 'number' && ov > 0) return { value: ov, src: 'override' };
	const p = UC.prices.ponty[name + '+0'];
	if (p) return { value: p.price, src: p.src + ' (' + ucAgeStr(p.age) + ')' };
	const m = UC.prices.asks[name + '+0'];
	if (m) return { value: m.price, src: m.src + ' (fresh)' };
	const h = UC.prices.hist[name + '+0'];
	if (h) return { value: h.price, src: h.src + ' (historical, ' + ucAgeStr(h.age) + ')' };
	const npc = ucNpcGold()[name];
	if (npc) return { value: npc.g, src: 'npc ' + npc.npc };
	const fb = UC_CONFIG.PRICE_FALLBACK[name];
	if (typeof fb === 'number' && fb > 0) return { value: fb, src: 'fallback ' + fb };
	return { value: null, src: 'none' };
}

// --------------------------------------------------------------- planner
/* Expected cost to reach `target` from a +0 copy, choosing scroll and offering
   per level to minimise the value of the item at the NEXT level:
     upgrade  C(L+1) = (  C(L) + scroll + offering) / p
     compound C(L+1) = (3*C(L) + scroll + offering) / p
   The step's choice cannot change any earlier level's cost, so a forward greedy
   over levels is the exact optimum for this recurrence. */
function ucPlan(name, target) {
	const G = ucG(), def = G.items[name];
	const mode = ucMode(def);
	if (!mode) return { error: name + ' is neither upgradeable nor compoundable' };
	const base = ucBaseValue(name);
	if (base.value == null) return { error: 'no value for ' + name + '+0 - not on Ponty, no fresh or historical ask, not NPC-sold. Set UC_CONFIG.PRICE_OVERRIDES.' + name };
	const scrolls = mode === 'upgrade' ? UC_USCROLLS : UC_CSCROLLS;
	const steps = [];
	let C = base.value;
	for (let L = 0; L < target; L++) {
		let best = null;
		for (const s of scrolls) {
			const ss = ucSource(s);
			if (ss.cost == null) continue;
			for (const o of UC_PLANNABLE_OFFERINGS) {
				const os = o ? ucSource(o) : { cost: 0, how: 'none' };
				if (o && os.cost == null) continue;
				const p = mode === 'upgrade' ? ucUpgradeChance(def, L, s, o) : ucCompoundChance(def, L, s, o);
				if (!p) continue;
				const inputs = (mode === 'upgrade' ? 1 : 3) * C;
				/* min(p, 1) is load-bearing. The server's cap is
				   min(base + 0.36, base * 3) with NO clamp to 1, and the roll is
				   Math.random() < probability, so anything at or above 1 simply
				   means certain. Dividing by an unclamped 1.24 reports a next
				   level CHEAPER than the copy going into it, and biases the
				   choice toward offerings, which are exactly what inflate p. */
				const next = (inputs + ss.cost + os.cost) / Math.min(p, 1);
				if (!best || next < best.next) best = { level: L, scroll: s, offering: o, p: p, next: next, inputs: inputs, scrollCost: ss.cost, offeringCost: os.cost };
			}
		}
		if (!best) return { error: 'no legal scroll for ' + name + ' at +' + L + ' (Exalted, or nothing priced)' };
		steps.push(best);
		C = best.next;
	}
	return { name: name, mode: mode, target: target, base: base, steps: steps, total: C };
}

function ucPrintPlan(plan) {
	if (plan.error) { ucLog('PLAN: ' + plan.error, 'red'); return; }
	ucLog('PLAN ' + plan.name + ' +0 -> +' + plan.target + ' (' + plan.mode + '), base ' + ucFmt(plan.base.value) + ' [' + plan.base.src + ']', '#FFD700');
	for (const s of plan.steps) {
		ucLog('  +' + s.level + ' -> +' + (s.level + 1) + ': ' + s.scroll + (s.offering ? ' + ' + s.offering : '')
			+ '  p=' + (s.p * 100).toFixed(1) + '%'
			+ '  inputs ' + ucFmt(s.inputs) + ' + ' + ucFmt(s.scrollCost + s.offeringCost)
			+ '  => E[' + (s.level + 1) + '] ' + ucFmt(s.next));
	}
	ucLog('  expected total to reach +' + plan.target + ': ' + ucFmt(plan.total), '#FFD700');
}

// -------------------------------------------------------------- inventory
function ucSlotsOf(name, level) {
	const out = [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (it && it.name === name && (it.level || 0) === (level || 0)) out.push(i);
	}
	return out;
}
function ucSlotOf(name) { return (typeof locate_item === 'function') ? locate_item(name) : ucSlotsOf(name, 0)[0]; }

/* What is in slot 0, and how far it is meant to go. */
function ucTarget() {
	const it = character.items[0];
	if (!it) return null;
	const def = ucG().items[it.name];
	const mode = ucMode(def);
	const lvls = UC_CONFIG.TARGET_LEVELS || {};
	const target = (typeof lvls[it.name] === 'number') ? lvls[it.name] : UC_CONFIG.TARGET_LEVEL;
	return { item: it.name, level: it.level || 0, target: target, def: def, mode: mode };
}

/* The roll: slot 0 first, always. For a compound, two more copies of the same
   name at the same level from anywhere else in the bag. */
function ucSelect(t) {
	if (t.mode === 'upgrade') return { level: t.level, slots: [0] };
	const others = ucSlotsOf(t.item, t.level).filter(function (i) { return i !== 0; });
	if (others.length < 2) return { level: t.level, slots: null, short: 2 - others.length };
	return { level: t.level, slots: [0, others[0], others[1]] };
}

// --------------------------------------------------------------- situation
/* Coarse distance band to a spot, 0 (on top of it) to 6 (far). Bands, not raw
   coordinates, so standing still reads as unchanged while walking over does
   not go unnoticed - and so the exact NPC range does not have to be right. */
function ucBand(id) {
	const s = UC_SPOTS[id];
	if (!s || typeof character === 'undefined' || character.map !== 'main') return 'x';
	const dx = character.x - s.x, dy = character.y - s.y;
	return String(Math.min(6, Math.floor(Math.sqrt(dx * dx + dy * dy) / 200)));
}
/* Everything about this character that a stop could be waiting on, in one
   string: slot 0, the bag, gold to the million, and where he is standing. If
   this is what it was when we stopped, nothing the operator could do has been
   done yet. If it differs, the stop is stale and the plan is worth redoing. */
function ucSignature() {
	if (typeof character === 'undefined' || !character.items) return '-';
	const bag = {};
	for (const it of character.items) {
		if (!it) continue;
		const k = it.name + '+' + (it.level || 0);
		bag[k] = (bag[k] || 0) + (it.q || 1);
	}
	const head = character.items[0] ? (character.items[0].name + '+' + (character.items[0].level || 0)) : '-';
	return head + '|' + Object.keys(bag).sort().map(function (k) { return k + 'x' + bag[k]; }).join(',')
		+ '|g' + Math.floor((character.gold || 0) / 1e6)
		+ '|' + ucBand('shrine') + ucBand('scrolls') + ucBand('premium')
		+ '|' + ucConfigSig();
}
/* The knobs the operator turns from the console belong in the fingerprint too:
   flipping DRY_RUN, lowering MIN_CHANCE or adding a PRICE_OVERRIDE is a change
   in the situation, and a stop should not outlive it. */
function ucConfigSig() {
	try {
		return [UC_CONFIG.DRY_RUN, UC_CONFIG.MIN_CHANCE, UC_CONFIG.TARGET_LEVEL, UC_CONFIG.MIN_GOLD_TO_BUY,
			JSON.stringify(UC_CONFIG.TARGET_LEVELS), JSON.stringify(UC_CONFIG.PRICE_OVERRIDES)].join(',');
	} catch (e) { return '?'; }
}

/* An awaited game call that never settles would hold the tick lock forever and
   every later tick would return at the door: alive, idle, silent. Bound them. */
function ucNoHang(p, label, ms) {
	return new Promise(function (res, rej) {
		let done = false;
		const timer = setTimeout(function () {
			if (done) return;
			done = true;
			rej({ reason: label + ' never came back (' + Math.round(ms / 1000) + 's)' });
		}, ms);
		Promise.resolve(p).then(
			function (v) { if (!done) { done = true; clearTimeout(timer); res(v); } },
			function (e) { if (!done) { done = true; clearTimeout(timer); rej(e); } });
	});
}

// --------------------------------------------------------------- stopping
/* retryMs > 0 marks a stop as probably momentary: it retries itself that many
   ms later, up to RETRY_TRIES times for the same reason. Every stop, timed or
   not, also clears itself as soon as ucSignature() changes. */
function ucStop(reason, needs, retryMs) {
	const tries = (UC.prevStop && UC.prevStop.reason === reason) ? UC.prevStop.tries : 0;
	const timed = !!retryMs && tries < UC_CONFIG.RETRY_TRIES;
	UC.stop = { reason: reason, needs: needs || [], at: Date.now(), sig: ucSignature(),
		tries: tries, retryAt: timed ? Date.now() + retryMs : 0 };
	UC.prevStop = null;
	ucLog('STOPPED: ' + reason, 'red');
	for (const n of (needs || [])) ucLog('   BUY  ' + n, 'orange');
	ucLog(timed
		? '   retrying on its own in ' + Math.round(retryMs / 1000) + 's ('
			+ (UC_CONFIG.RETRY_TRIES - tries) + ' left), sooner if the bag, gold or where you stand changes'
		: '   clears itself as soon as the bag, gold or where you stand changes - or run ucResume()', 'orange');
}
function ucResume() { UC.stop = null; UC.prevStop = null; UC.lastPrint = null; UC.npcGold = null; ucLog('resumed', '#7FD98A'); }
/* Idle is not a stop: nothing needs buying, the operator just has not put the
   next item in slot 0 yet. Said once, not every tick. */
function ucIdle(why) { if (UC.idleNote !== why) { UC.idleNote = why; ucLog(why, '#8b98ab'); } }
function ucStatus() {
	ucLog('dryRun=' + UC_CONFIG.DRY_RUN + ' stopped=' + (UC.stop ? UC.stop.reason : 'no') + ' rolls=' + UC.history.length);
	const t = ucTarget();
	if (!t) { ucLog('slot 0 is empty - put the item to work on there', 'orange'); return; }
	if (!t.mode) { ucLog(t.item + ' in slot 0 is neither upgradeable nor compoundable', 'red'); return; }
	ucLog('slot 0: ' + t.item + ' +' + t.level + ' -> target +' + t.target + ' (' + t.mode + ')');
	ucPrintPlan(ucPlan(t.item, t.target));
}

async function ucAcquire(name, how, cost) {
	if (how === 'inventory') return true;
	if (how === 'npc') {
		if (character.gold - cost < UC_CONFIG.MIN_GOLD_TO_BUY) {
			ucStop('gold ' + ucFmt(character.gold) + ' would fall below MIN_GOLD_TO_BUY buying ' + name, [], 0);
			return false;
		}
		try { await ucNoHang(buy(name, 1), 'buy ' + name, UC_CONFIG.HANG_MS); ucLog('bought 1 ' + name + ' for ' + ucFmt(cost), '#7FD98A'); return true; }
		catch (e) {
			const npc = (ucNpcGold()[name] || {}).npc;
			ucStop('could not buy ' + name + ' here (' + (e && (e.reason || e.message) || e) + ') - stand near ' + ucWhere(npc) + ', or buy it yourself', [name], UC_CONFIG.RETRY_MS);
			return false;
		}
	}
	return false;
}

// --------------------------------------------------------------- executor
async function ucTick() {
	if (typeof character === 'undefined' || character.rip) return;
	/* Backstop for a hang outside the three bounded calls. Everything awaited
	   below is capped well under BUSY_MAX_MS, so reaching this means something
	   unexpected hung - say so, and let the next tick run. */
	if (UC.busy) {
		if (!UC.busyAt || Date.now() - UC.busyAt < UC_CONFIG.BUSY_MAX_MS) return;
		ucLog('a tick held the lock for ' + Math.round((Date.now() - UC.busyAt) / 1000) + 's - forcing it open', 'red');
		UC.busy = false;
	}
	if (UC.stop) {
		const sig = ucSignature();
		if (sig !== UC.stop.sig) {
			ucLog('something changed - re-checking (was: ' + UC.stop.reason + ')', '#7FD98A');
			UC.prevStop = null;
		} else if (UC.stop.retryAt && Date.now() >= UC.stop.retryAt) {
			ucLog('retrying (' + UC.stop.reason + ')');
			UC.prevStop = { reason: UC.stop.reason, tries: UC.stop.tries + 1 };
		} else return;
		UC.stop = null; UC.npcGold = null; UC.lastPrint = null;
	}
	/* The lock is claimed with a serial number, so a tick whose lock was forced
	   open cannot release the lock of the tick that replaced it. */
	const mine = ++UC.busySeq;
	UC.busy = true; UC.busyAt = Date.now();
	try {
		const t = ucTarget();
		if (!t) { ucIdle('slot 0 is empty - waiting for an item'); return; }
		if (!t.mode) { ucIdle(t.item + ' in slot 0 is neither upgradeable nor compoundable - waiting'); return; }
		if (t.level >= t.target) { ucIdle(t.item + ' +' + t.level + ' in slot 0 is at target +' + t.target + ' - done, waiting'); return; }
		UC.idleNote = null;
		{
			await ucRefreshPrices(false);
			const plan = ucPlan(t.item, t.target);
			if (plan.error) { ucStop(plan.error, []); return; }
			const front = ucSelect(t);
			if (!front.slots) {
				ucStop('compound needs ' + front.short + ' more ' + t.item + ' +' + t.level + ' in the bag to go with slot 0', [t.item + '+' + t.level + ' x' + front.short]);
				return;
			}
			const step = plan.steps[front.level];
			/* The plan only changes when the situation does, so print it when it
			   does. A dry run has nothing else to do once it has printed: it waits
			   here, silently, until the bag, gold or the operator moves. */
			const sig = ucSignature();
			if (sig === UC.lastPrint && UC_CONFIG.DRY_RUN) return;
			if (sig !== UC.lastPrint) { ucPrintPlan(plan); UC.lastPrint = sig; }

			// Everything the chosen step consumes, and where it comes from.
			const needs = [];
			const ss = ucSource(step.scroll);
			if (ss.how === 'market') needs.push(step.scroll + ' x1 @ ~' + ucFmt(ss.cost) + ' [' + ss.note + ']');
			let os = null;
			if (step.offering) {
				os = ucSource(step.offering);
				if (os.how === 'market') needs.push(step.offering + ' x1 @ ~' + ucFmt(os.cost) + ' [' + os.note + ']');
			}
			if (needs.length) { ucStop('cheapest path for ' + t.item + ' +' + front.level + '->' + (front.level + 1) + ' needs items you must buy', needs); return; }
			/* A dry run spends nothing, so it does not buy the scroll either. Without
			   it in the bag there is no slot to hand calculation mode, and EXACT comes
			   back unavailable with the reason - which is the honest answer. */
			if (!UC_CONFIG.DRY_RUN) {
				if (!await ucAcquire(step.scroll, ss.how, ss.cost)) return;
				if (step.offering && !await ucAcquire(step.offering, os.how, os.cost)) return;
			}

			const sSlot = ucSlotOf(step.scroll);
			const oSlot = step.offering ? ucSlotOf(step.offering) : -1;
			const ready = sSlot >= 0 && (!step.offering || oSlot >= 0);
			if (!ready && !UC_CONFIG.DRY_RUN) { ucStop('consumable vanished from inventory after acquire', []); return; }

			// The game's own number for THIS roll - grace included.
			let exact = null, noExact = null;
			if (!ready) {
				noExact = (sSlot < 0 ? step.scroll : step.offering) + ' is not in the bag and a dry run buys nothing';
			} else try {
				const pv = plan.mode === 'upgrade'
					? await ucNoHang(upgrade(front.slots[0], sSlot, oSlot >= 0 ? oSlot : null, true), 'calculation mode', UC_CONFIG.HANG_MS)
					: await ucNoHang(compound(front.slots[0], front.slots[1], front.slots[2], sSlot, oSlot >= 0 ? oSlot : null, true), 'calculation mode', UC_CONFIG.HANG_MS);
				exact = pv && typeof pv.chance === 'number' ? pv.chance : null;
			} catch (e) {
				const why = 'calculation mode refused: ' + (e && (e.reason || e.message) || e) + ' - stand near ' + ucWhere('shrine');
				if (!UC_CONFIG.DRY_RUN) { ucStop(why, [], UC_CONFIG.RETRY_MS); return; }
				noExact = why;
			}

			const atRisk = step.inputs;
			ucLog('ROLL ' + t.item + ' +' + front.level + ' -> +' + (front.level + 1) + ' with ' + step.scroll + (step.offering ? ' + ' + step.offering : '')
				+ ': model ' + (step.p * 100).toFixed(1) + '%, EXACT ' + (exact == null ? ('unavailable - ' + (noExact || '?')) : (exact * 100).toFixed(1) + '%')
				+ ', at risk ' + ucFmt(atRisk) + ' + ' + ucFmt(step.scrollCost + step.offeringCost), '#FFD700');
			if (exact != null && exact < UC_CONFIG.MIN_CHANCE) { ucStop('exact chance ' + (exact * 100).toFixed(1) + '% is below MIN_CHANCE', []); return; }
			if (UC_CONFIG.DRY_RUN) {
				UC.lastPrint = sig;
				ucLog('DRY_RUN - not rolling, and nothing bought. Set UC_CONFIG.DRY_RUN = false to proceed.', 'orange');
				return;
			}

			let res = null;
			try {
				res = plan.mode === 'upgrade'
					? await ucNoHang(upgrade(front.slots[0], sSlot, oSlot >= 0 ? oSlot : null), 'the roll', UC_CONFIG.ROLL_HANG_MS)
					: await ucNoHang(compound(front.slots[0], front.slots[1], front.slots[2], sSlot, oSlot >= 0 ? oSlot : null), 'the roll', UC_CONFIG.ROLL_HANG_MS);
			} catch (e) {
				/* A refused roll changed nothing and is worth retrying. A roll that
				   never came back may have landed, so it is NOT retried on a timer -
				   but if it did land the bag changed, and that clears this stop by
				   itself on the next tick, with the real state in hand. */
				const msg = (e && (e.reason || e.message) || e);
				const hung = String(msg).indexOf('never came back') >= 0;
				ucStop('roll ' + (hung ? 'may or may not have happened: ' : 'rejected: ') + msg, [], hung ? 0 : UC_CONFIG.RETRY_MS);
				return;
			}
			const ok = !!(res && res.success);
			UC.history.push({ t: Date.now(), mode: plan.mode, item: t.item, from: front.level, to: front.level + 1,
				chance: step.p, exact: exact, success: ok, spent: step.scrollCost + step.offeringCost, lost: ok ? 0 : atRisk });
			ucLog((ok ? 'SUCCESS ' : 'FAILED  ') + t.item + ' -> +' + (front.level + 1)
				+ (ok ? '' : ' - lost ' + ucFmt(atRisk) + ' of inputs'), ok ? '#7FD98A' : 'red');
			return;   // one roll per tick, so the log is readable and the operator can stop
		}
	} catch (e) {
		ucLog('tick threw: ' + (e && e.message || e), 'red');
	} finally { if (UC.busySeq === mine) { UC.busy = false; UC.busyAt = 0; } }
}

// --------------------------------------------------------------- startup
(function ucStart() {
	if (typeof character === 'undefined') { ucLog('no character - load this in a CODE slot', 'red'); return; }
	const missing = ['upgrade', 'compound', 'buy', 'quantity', 'locate_item'].filter(function (f) { return typeof window[f] !== 'function'; });
	if (missing.length) ucLog('helpers not in scope: ' + missing.join(', ') + ' - this file expects the game CODE context', 'red');
	ucLog('UpgradeCompound v4 loaded. Slot 0 is the item. DRY_RUN=' + UC_CONFIG.DRY_RUN
		+ '. A stop clears itself when the bag, gold or where you stand changes; ucStatus() prints the plan, ucResume() forces it.', '#FFD700');
	setInterval(ucTick, UC_CONFIG.TICK_MS);
})();
