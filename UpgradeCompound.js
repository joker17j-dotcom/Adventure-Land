// ============================================================================
// UpgradeCompound.js - v1 (2026-09-29) - upgrade AND compound to a target level
// at the lowest EXPECTED cost, counting the gear that failed rolls destroy.
//
// Runs on Meltymerch, inventory only, while the operator watches. The original
// Upgrade script is untouched; this is its successor, not an edit of it.
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
//   - Base item: PRICE_OVERRIDES, then Ponty, then market low, then NPC gold
//     if NPC-sold, else STOP and ask for an override. No price history exists
//     anywhere in the stack (aldata serves live stands only), so a value the
//     operator sets is the fallback, not a guess.
//   - When the cheapest path needs something not in inventory and not
//     buyable from an NPC here: print exactly what to buy and STOP. The
//     operator buys it, or proceeds by hand.
// ============================================================================

const UC_CONFIG = {
	/* What to make. mode is auto-detected from G.items (upgrade vs compound). */
	TARGETS: [
		{ item: 'frankypants', level: 7 },
	],

	/* Set a value here to override every other source for that item at +0.
	   Left null, the chain is: Ponty -> market low -> NPC gold (if sold) -> STOP. */
	PRICE_OVERRIDES: {
		// frankypants: 950000,
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
	TICK_MS: 4000,
	FETCH_MS: 8000,
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

// --------------------------------------------------------------- state
const UC = {
	stop: null,           // { reason, needs: [...] } - set once, cleared by ucResume()
	busy: false,
	prices: { at: 0, asks: {}, ponty: {}, errors: {} },
	npcGold: null,        // name -> { g, npc, autobuy }
	history: [],          // every roll: { t, mode, item, from, to, chance, exact, success, spent, lost }
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

/* Lowest SELL listing per item+level across aldata and the bridge, plus Ponty
   separately. Same row shape Merchant.js reads: r.slots[k] = {name, level,
   price, q, b}; b marks a buy order and is skipped. */
async function ucRefreshPrices(force) {
	if (!force && Date.now() - UC.prices.at < UC_CONFIG.PRICE_TTL_MS) return UC.prices;
	const asks = {}, ponty = {}, errors = {};
	const take = function (bucket, name, level, price, src) {
		if (typeof price !== 'number' || !isFinite(price) || price <= 0) return;
		const k = name + '+' + (level || 0);
		if (!bucket[k] || price < bucket[k].price) bucket[k] = { price: price, src: src };
	};
	const stands = async function (url, src) {
		try {
			const rows = await ucFetchJson(url);
			if (!Array.isArray(rows)) throw new Error('not an array');
			for (const r of rows) for (const k in (r.slots || {})) {
				const sl = r.slots[k];
				if (!sl || !sl.name || sl.b) continue;
				take(asks, sl.name, sl.level, sl.price, src);
			}
		} catch (e) { errors[src] = String(e && e.message || e); }
	};
	await Promise.all([
		stands(UC_CONFIG.BRIDGE + '/merchants', 'bridge'),
		stands(UC_CONFIG.ALDATA + '/merchants', 'aldata'),
		(async function () {
			try {
				const p = await ucFetchJson(UC_CONFIG.BRIDGE + '/ponty');
				for (const shard in (p || {})) for (const it of ((p[shard] || {}).items || [])) {
					if (it && it.name) take(ponty, it.name, it.level, it.price, 'ponty:' + shard);
				}
			} catch (e) { errors.ponty = String(e && e.message || e); }
		})(),
	]);
	UC.prices = { at: Date.now(), asks: asks, ponty: ponty, errors: errors };
	const es = Object.keys(errors);
	ucLog('prices: ' + Object.keys(asks).length + ' asks, ' + Object.keys(ponty).length + ' ponty'
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
	const mkt = UC.prices.asks[name + '+0'];
	let cost = null, how = null, note = '';
	if (npc && npc.autobuy) { cost = npc.g; how = 'npc'; note = npc.npc; }
	else if (npc && mkt && mkt.price < npc.g) { cost = mkt.price; how = 'market'; note = mkt.src + ' (under ' + npc.npc + '\'s ' + ucFmt(npc.g) + ')'; }
	else if (npc) { cost = npc.g; how = 'market'; note = npc.npc + ' sells it, you buy it'; }
	else if (mkt) { cost = mkt.price; how = 'market'; note = mkt.src; }
	if (held > 0) how = 'inventory';
	return { name: name, cost: cost, how: how, held: held, note: note };
}

/* Value of one base (+0) copy of the item being made. */
function ucBaseValue(name) {
	const ov = UC_CONFIG.PRICE_OVERRIDES[name];
	if (typeof ov === 'number' && ov > 0) return { value: ov, src: 'override' };
	const p = UC.prices.ponty[name + '+0'];
	if (p) return { value: p.price, src: p.src };
	const m = UC.prices.asks[name + '+0'];
	if (m) return { value: m.price, src: m.src };
	const npc = ucNpcGold()[name];
	if (npc) return { value: npc.g, src: 'npc ' + npc.npc };
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
	if (base.value == null) return { error: 'no value for ' + name + '+0 - not on Ponty, not on the market, not NPC-sold. Set UC_CONFIG.PRICE_OVERRIDES.' + name };
	const scrolls = mode === 'upgrade' ? UC_USCROLLS : UC_CSCROLLS;
	const steps = [];
	let C = base.value;
	for (let L = 0; L < target; L++) {
		let best = null;
		for (const s of scrolls) {
			const ss = ucSource(s);
			if (ss.cost == null) continue;
			for (const o of UC_OFFERINGS) {
				const os = o ? ucSource(o) : { cost: 0, how: 'none' };
				if (o && os.cost == null) continue;
				const p = mode === 'upgrade' ? ucUpgradeChance(def, L, s, o) : ucCompoundChance(def, L, s, o);
				if (!p) continue;
				const inputs = (mode === 'upgrade' ? 1 : 3) * C;
				const next = (inputs + ss.cost + os.cost) / p;
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

/* The next roll: the highest level below target that has enough copies. */
function ucFrontier(name, mode, target) {
	for (let L = target - 1; L >= 0; L--) {
		const slots = ucSlotsOf(name, L);
		if (mode === 'upgrade' && slots.length >= 1) return { level: L, slots: slots.slice(0, 1) };
		if (mode === 'compound' && slots.length >= 3) return { level: L, slots: slots.slice(0, 3) };
	}
	return null;
}

// --------------------------------------------------------------- stopping
function ucStop(reason, needs) {
	UC.stop = { reason: reason, needs: needs || [], at: Date.now() };
	ucLog('STOPPED: ' + reason, 'red');
	for (const n of (needs || [])) ucLog('   BUY  ' + n, 'orange');
	ucLog('   then run ucResume()', 'orange');
}
function ucResume() { UC.stop = null; UC.npcGold = null; ucLog('resumed', '#7FD98A'); }
function ucStatus() {
	ucLog('dryRun=' + UC_CONFIG.DRY_RUN + ' stopped=' + (UC.stop ? UC.stop.reason : 'no') + ' rolls=' + UC.history.length);
	for (const t of UC_CONFIG.TARGETS) ucPrintPlan(ucPlan(t.item, t.level));
}

async function ucAcquire(name, how, cost) {
	if (how === 'inventory') return true;
	if (how === 'npc') {
		if (character.gold - cost < UC_CONFIG.MIN_GOLD_TO_BUY) {
			ucStop('gold ' + ucFmt(character.gold) + ' would fall below MIN_GOLD_TO_BUY buying ' + name, []);
			return false;
		}
		try { await buy(name, 1); ucLog('bought 1 ' + name + ' for ' + ucFmt(cost), '#7FD98A'); return true; }
		catch (e) {
			const npc = (ucNpcGold()[name] || {}).npc;
			ucStop('could not buy ' + name + ' here (' + (e && (e.reason || e.message) || e) + ') - stand near ' + ucWhere(npc) + ', or buy it yourself', [name]);
			return false;
		}
	}
	return false;
}

// --------------------------------------------------------------- executor
async function ucTick() {
	if (UC.busy || UC.stop) return;
	if (typeof character === 'undefined' || character.rip) return;
	UC.busy = true;
	try {
		await ucRefreshPrices(false);
		for (const t of UC_CONFIG.TARGETS) {
			const plan = ucPlan(t.item, t.level);
			if (plan.error) { ucStop(plan.error, []); return; }
			const front = ucFrontier(t.item, plan.mode, t.level);
			if (!front) {
				const have = [];
				for (let L = 0; L < t.level; L++) { const n = ucSlotsOf(t.item, L).length; if (n) have.push(n + 'x +' + L); }
				const need = plan.mode === 'compound' ? '3 copies of ' + t.item + ' at one level' : '1 ' + t.item + ' below +' + t.level;
				if (ucSlotsOf(t.item, t.level).length) { ucLog(t.item + ' +' + t.level + ' is DONE', '#7FD98A'); continue; }
				ucStop('need ' + need + ' in inventory (have: ' + (have.join(', ') || 'none') + ')', [t.item + '+0']);
				return;
			}
			const step = plan.steps[front.level];
			ucPrintPlan(plan);

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
			if (!await ucAcquire(step.scroll, ss.how, ss.cost)) return;
			if (step.offering && !await ucAcquire(step.offering, os.how, os.cost)) return;

			const sSlot = ucSlotOf(step.scroll);
			const oSlot = step.offering ? ucSlotOf(step.offering) : -1;
			if (sSlot < 0 || (step.offering && oSlot < 0)) { ucStop('consumable vanished from inventory after acquire', []); return; }

			// The game's own number for THIS roll - grace included.
			let exact = null;
			try {
				const pv = plan.mode === 'upgrade'
					? await upgrade(front.slots[0], sSlot, oSlot >= 0 ? oSlot : null, true)
					: await compound(front.slots[0], front.slots[1], front.slots[2], sSlot, oSlot >= 0 ? oSlot : null, true);
				exact = pv && typeof pv.chance === 'number' ? pv.chance : null;
			} catch (e) { ucStop('calculation mode refused: ' + (e && (e.reason || e.message) || e) + ' - stand near ' + ucWhere('shrine'), []); return; }

			const atRisk = step.inputs;
			ucLog('ROLL ' + t.item + ' +' + front.level + ' -> +' + (front.level + 1) + ' with ' + step.scroll + (step.offering ? ' + ' + step.offering : '')
				+ ': model ' + (step.p * 100).toFixed(1) + '%, EXACT ' + (exact == null ? '?' : (exact * 100).toFixed(1) + '%')
				+ ', at risk ' + ucFmt(atRisk) + ' + ' + ucFmt(step.scrollCost + step.offeringCost), '#FFD700');
			if (exact != null && exact < UC_CONFIG.MIN_CHANCE) { ucStop('exact chance ' + (exact * 100).toFixed(1) + '% is below MIN_CHANCE', []); return; }
			if (UC_CONFIG.DRY_RUN) { ucLog('DRY_RUN - not rolling. Set UC_CONFIG.DRY_RUN = false to proceed.', 'orange'); return; }

			let res = null;
			try {
				res = plan.mode === 'upgrade'
					? await upgrade(front.slots[0], sSlot, oSlot >= 0 ? oSlot : null)
					: await compound(front.slots[0], front.slots[1], front.slots[2], sSlot, oSlot >= 0 ? oSlot : null);
			} catch (e) { ucStop('roll rejected: ' + (e && (e.reason || e.message) || e), []); return; }
			const ok = !!(res && res.success);
			UC.history.push({ t: Date.now(), mode: plan.mode, item: t.item, from: front.level, to: front.level + 1,
				chance: step.p, exact: exact, success: ok, spent: step.scrollCost + step.offeringCost, lost: ok ? 0 : atRisk });
			ucLog((ok ? 'SUCCESS ' : 'FAILED  ') + t.item + ' -> +' + (front.level + 1)
				+ (ok ? '' : ' - lost ' + ucFmt(atRisk) + ' of inputs'), ok ? '#7FD98A' : 'red');
			return;   // one roll per tick, so the log is readable and the operator can stop
		}
	} catch (e) {
		ucLog('tick threw: ' + (e && e.message || e), 'red');
	} finally { UC.busy = false; }
}

// --------------------------------------------------------------- startup
(function ucStart() {
	if (typeof character === 'undefined') { ucLog('no character - load this in a CODE slot', 'red'); return; }
	const missing = ['upgrade', 'compound', 'buy', 'quantity', 'locate_item'].filter(function (f) { return typeof window[f] !== 'function'; });
	if (missing.length) ucLog('helpers not in scope: ' + missing.join(', ') + ' - this file expects the game CODE context', 'red');
	ucLog('UpgradeCompound v1 loaded. DRY_RUN=' + UC_CONFIG.DRY_RUN + '. ucStatus() prints the plan; ucResume() clears a stop.', '#FFD700');
	setInterval(ucTick, UC_CONFIG.TICK_MS);
})();
