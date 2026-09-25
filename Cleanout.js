// ============================================================================
// Cleanout - sell an inventory down, to the best player bid or to an NPC - v2 (Tier-0 potions are no longer protected. Measured 2026-09-25: the fleet holds zero hpot0 and zero mpot0 - all four characters and all three bank packs - and nothing acquires them, since every buy path is hpot1/mpot1 only. The 3,354 hpot0 that had piled up on FatherToken were cleared manually. Protection was never what kept tier 0 in use anyway: use_skill('use_hp'/'use_mp') resolves to use('hp'/'mp'), which scans character.items from the LAST slot BACKWARDS (adventureland_mongodb js/functions.js:4593) and drinks the first item whose gives matches, so tier is never consulted - slot position alone decides. That is why the priest's pile sat undrinkable at slot 0 underneath hpot1 at slot 2, and why unprotecting tier 0 on its own would have muled and vendored it rather than drawn it down. The stock COUNTS deliberately still read hpot0+hpot1 and mpot0+mpot1, so a stray tier-0 stack cannot mask an empty tier-1 bag and suppress a restock. Removed from CONFIG.protect.) v1
// ============================================================================
// Engaged BY HAND in its own CODE slot while doing a bank cleanout. Withdraw
// what you want gone into the merchant's bag, switch to this slot, engage.
//
//   DEFAULTS TO PLAN, NOT SELL. Selling cannot be undone, so the first run
//   prints what it WOULD do and touches nothing. Set CONFIG.mode to 'sell'
//   once the plan reads right. This is the same shape as the gear tripwire.
//
//   WHY BOTHER WITH BIDS AT ALL. Measured 2026-09-25 against the live bank:
//   13 of 75 stored items had a player buy order beating the NPC, worth
//   23,016,580 gold in total. The gap is not marginal - an NPC pays 6 gold for
//   a slice_honey that a player is bidding 500,000 for. Selling a bank clean
//   to the nearest vendor throws that away.
//
//   ONLY 1 OF THOSE 13 WAS ON THE HOME SHARD, which is why this hops. A hop
//   is change_server, and change_server RELOADS THE PAGE - the script restarts
//   from scratch mid-job. So the plan is persisted before the first hop and
//   resumed on load. Nothing here may assume it is running for the first time.
//
//   ARBITRAGE. This runs INSTEAD of Merchant.js, so the executor is not live
//   while it works - but Merchant.js may have left a trade holding goods, and
//   selling those would take the goods out from under a trade that still
//   thinks it owns them, corrupting its ledger and its consecutive-strandings
//   breaker. So this REFUSES TO RUN while get('arb_trade') has a phase, and
//   says what to do about it. It also never writes an arb_* key; its own state
//   lives under CLEAN_KEY.
//
//   TAX IS REAL AND IT IS ON THE SELL SIDE. character.tax is live (0.03 at
//   level 60, read not assumed). A bid only wins if price*(1-tax) beats what
//   the vendor pays, so the comparison is always made net.
//
//   THE BUYER HAS TO BE RENDERED. trade_sell takes an ENTITY, not a name, so
//   being on the right shard is not enough - the merchant has to stand next to
//   them and wait for them to appear in parent.entities. A bid whose owner has
//   packed up since the feed was read is a normal outcome, not an error.
// ============================================================================

const CLEAN_KEY = 'cleanout_state';

const CONFIG = {
	// 'plan' prints and changes nothing. 'sell' acts.
	mode: 'plan',

	/* Never sold, whatever a bid says. Things that are worth more in use than
	   in gold, or that are inputs to something else.

	   firestaff is here because a firestaff+7 was sitting in the bank while
	   FatherToken and MageofOz both wielded firestaff+6 - attack 68 -> 75 for
	   free. gem0/gem1 exchange at Xyn for treasure. The keys unlock bank
	   floors worth 75,000,000 a pack. */
	protect: [
		'computer', 'supercomputer',
		'bkey', 'ukey', 'dkey',
		'gem0', 'gem1', 'gemfragment',
		'offering', 'offeringp', 'offeringx',
		'scroll3', 'scroll4', 'cscroll3', 'cscroll4',
		'firestaff', 'firebow',
		'anniversarygift', 'gift0', 'gift1',
		'seashell', 'candycane', 'candypop',
		'stoneofxp', 'stoneofgold', 'stoneofluck',
		'luckbooster', 'xpbooster', 'goldbooster',
		'hpot1', 'mpot1',
	],

	// Never sold by item type.
	protectTypes: ['stone', 'booster', 'cosmetics', 'bank_key', 'computer'],

	/* An upgraded or compounded item at or above this level is kept. Cheap to
	   re-buy at +0, expensive to rebuild - and a high-level piece is usually
	   in the bank because it is a spare for someone, not because it is junk. */
	protectLevelAtOrAbove: 6,

	/* Thresholds. A hop costs a page reload and a minute; walking across a map
	   costs less. Neither is worth doing for a rounding error, so a bid has to
	   beat the vendor by this much IN TOTAL for that buyer, after tax. */
	minGainToHop: 250000,
	minGainToTravel: 10000,

	// Leftovers go to a vendor once the bids are done.
	npcFallback: true,

	hopTimeoutMs: 60000,
	entityWaitMs: 12000,
	maxBuyersPerShard: 8,
};

function log(msg, color) {
	try { game_log('[clean] ' + msg, color || '#8b98ab'); } catch (e) { console.log('[clean]', msg); }
}

function shardKey() {
	return String(parent.server_region) + String(parent.server_identifier);
}

const SHARD_REGIONS = ['ASIA', 'EU', 'US'];
function parseShard(key) {
	for (const r of SHARD_REGIONS) {
		if (key && key.startsWith(r)) return { region: r, name: key.slice(r.length) };
	}
	return null;
}

function taxRate() {
	const live = (typeof character !== 'undefined') ? character.tax : undefined;
	if (typeof live === 'number' && isFinite(live) && live >= 0 && live < 1) return live;
	return 0.03;   // level-60 band, measured 2026-09-25; only a fallback
}

function npcValue(it) {
	try { return calculate_item_value(it) || 0; } catch (e) { return 0; }
}

function itemDef(name) {
	try { return parent.G.items[name] || null; } catch (e) { return null; }
}

/* Why an item is off limits, or null if it is sellable. Returns the REASON so
   the plan can say it, rather than silently omitting rows. */
function protectedReason(it) {
	if (!it || !it.name) return 'empty';
	if (it.name === 'placeholder') return 'placeholder';
	if (it.l) return 'locked';
	if (it.b) return 'blocked';
	if (CONFIG.protect.includes(it.name)) return 'on the protect list';
	const d = itemDef(it.name);
	if (!d) return 'unknown item';
	if (CONFIG.protectTypes.includes(d.type)) return 'protected type ' + d.type;
	if ((d.upgrade || d.compound) && (it.level || 0) >= CONFIG.protectLevelAtOrAbove) {
		return 'level ' + it.level + ' >= ' + CONFIG.protectLevelAtOrAbove;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Bids

/* Every live buy order, keyed name|level.

   The feed is a POST to /api/pull_merchants WITH AN EMPTY BODY - it rejects
   the usual method=/arguments= fields - and it needs the adventure.land origin
   AND credentials, which is why this only works from a character's CODE
   context. api_call('pull_merchants', {}) returns {success} and no rows;
   measured 2026-09-25 before this was written the other way.

   IT CARRIES NO PER-ROW TIMESTAMP. Merchant.js stamps the whole batch at
   gameFeedAgeSec (128s) for sorting purposes. So there is no way to tell a
   bid posted a minute ago from one posted an hour ago, and an age gate here
   would be theatre. The real freshness check is that the buyer has to be
   standing there when we arrive - see runShard.

   It does not cover every map. Measured 2026-09-25: 62 merchants across `main`
   and `spookytown` only, 155 buy orders, 103 distinct name|level bids, and
   x/y present on every row. A buyer parked on a map the feed omits is
   invisible here and simply will not be considered. */
async function loadBids() {
	const bids = {};
	let chars = null;
	try {
		const o = { method: 'POST', cache: 'no-store', credentials: 'same-origin', body: '' };
		const r = await fetch('https://adventure.land/api/pull_merchants', o);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		const payload = await r.json();
		const infs = (payload && Array.isArray(payload.infs)) ? payload.infs : [];
		for (const inf of infs) {
			if (inf && inf.type === 'merchants' && Array.isArray(inf.chars)) { chars = inf.chars; break; }
		}
	} catch (e) {
		log('merchant feed failed: ' + (e && e.message ? e.message : e), 'red');
		return null;
	}
	if (!chars) { log('feed returned no merchants block', 'red'); return null; }

	let considered = 0, unparsed = 0;
	for (const c of chars) {
		if (!c || !c.name || !c.server) continue;
		const m = /^SR_(US|EU|ASIA)(.+)$/.exec(String(c.server));
		if (!m) { unparsed++; continue; }
		const shard = m[1] + m[2];
		const slots = c.slots || {};
		for (const k in slots) {
			const s = slots[k];
			if (!s || !s.b || !s.name || typeof s.price !== 'number' || !isFinite(s.price)) continue;
			considered++;
			const key = s.name + '|' + (s.level || 0);
			const cand = {
				price: s.price, qty: s.q || 1, slot: k,
				who: c.name, shard: shard, map: c.map, x: c.x, y: c.y,
			};
			if (!bids[key] || cand.price > bids[key].price) bids[key] = cand;
		}
	}
	if (unparsed) log(unparsed + ' feed row(s) had an unrecognised server tag', 'orange');
	log('bids: ' + considered + ' buy order(s) across ' + chars.length + ' merchant(s)', '#55BDF0');
	return bids;
}

/* Decide, per inventory slot, whether a bid beats the vendor. The comparison
   is per-unit and net of tax; the TOTAL gain then has to clear the threshold
   for the trip that reaching the buyer would need. */
function buildPlan(bids) {
	const here = shardKey();
	const tax = taxRate();
	const items = character.items || [];
	const toBid = [], toNpc = [], kept = [];

	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		const why = protectedReason(it);
		if (why) { if (it && it.name && why !== 'empty') kept.push({ name: it.name, q: it.q || 1, why: why }); continue; }

		const have = it.q || 1;
		const npcPer = npcValue({ name: it.name, level: it.level || 0, q: 1 });
		const b = bids[it.name + '|' + (it.level || 0)];
		let took = false;

		if (b) {
			const netPer = b.price * (1 - tax);
			const qty = Math.min(have, b.qty);
			const gain = (netPer - npcPer) * qty;
			const sameShard = (b.shard === here);
			const need = sameShard ? CONFIG.minGainToTravel : CONFIG.minGainToHop;
			if (netPer > npcPer && gain >= need) {
				toBid.push({
					name: it.name, level: it.level || 0, have: have, qty: qty,
					npcPer: Math.round(npcPer), bid: b.price, netPer: Math.round(netPer),
					gain: Math.round(gain), who: b.who, slot: b.slot, shard: b.shard,
					map: b.map, x: b.x, y: b.y, sameShard: sameShard,
				});
				took = true;
				// Anything above the bid's cap still has to go somewhere.
				if (have > qty) toNpc.push({ name: it.name, level: it.level || 0, q: have - qty, npcPer: Math.round(npcPer) });
			}
		}
		if (!took) toNpc.push({ name: it.name, level: it.level || 0, q: have, npcPer: Math.round(npcPer) });
	}

	toBid.sort((a, b) => b.gain - a.gain);
	// One hop per shard, best-paying shard first.
	const byShard = {};
	for (const r of toBid) { (byShard[r.shard] = byShard[r.shard] || []).push(r); }
	const shards = Object.keys(byShard).sort((a, b) => {
		if (a === here) return -1;
		if (b === here) return 1;
		const ga = byShard[a].reduce((x, r) => x + r.gain, 0);
		const gb = byShard[b].reduce((x, r) => x + r.gain, 0);
		return gb - ga;
	});
	for (const s of shards) byShard[s] = byShard[s].slice(0, CONFIG.maxBuyersPerShard);

	return { here: here, tax: tax, byShard: byShard, shards: shards, toNpc: toNpc, kept: kept,
		bidGain: toBid.reduce((a, r) => a + r.gain, 0),
		npcValueTotal: toNpc.reduce((a, r) => a + r.npcPer * r.q, 0) };
}

function printPlan(p) {
	log('--- PLAN (mode=' + CONFIG.mode + ', tax ' + (p.tax * 100).toFixed(1) + '%) ---', '#FFD700');
	if (!p.shards.length) log('no bid beats a vendor for anything in the bag', '#8b98ab');
	for (const s of p.shards) {
		const rows = p.byShard[s];
		const g = rows.reduce((a, r) => a + r.gain, 0);
		log((s === p.here ? 'HERE ' : 'HOP  ') + s + ' - ' + rows.length + ' sale(s), +'
			+ g.toLocaleString() + ' over vendor', s === p.here ? '#7FD98A' : '#55BDF0');
		for (const r of rows) {
			log('   ' + r.name + '+' + r.level + ' x' + r.qty + '/' + r.have
				+ ' to ' + r.who + ' @ ' + r.bid + ' (net ' + r.netPer + ' vs npc ' + r.npcPer
				+ ') +' + r.gain.toLocaleString() + ' [' + r.map + ']', '#8b98ab');
		}
	}
	if (p.toNpc.length) {
		log('vendor: ' + p.toNpc.length + ' stack(s) for ~' + p.npcValueTotal.toLocaleString() + ' gold', '#E9C46A');
	}
	if (p.kept.length) {
		log('keeping ' + p.kept.length + ': ' + p.kept.slice(0, 10)
			.map((k) => k.name + ' (' + k.why + ')').join(', ')
			+ (p.kept.length > 10 ? ' ...' : ''), '#8b98ab');
	}
	log('total over vendor if every bid fills: +' + Math.round(p.bidGain).toLocaleString() + ' gold', '#FFD700');
	if (CONFIG.mode !== 'sell') log('PLAN ONLY - set CONFIG.mode to \'sell\' to act', '#FFD700');
}

// ---------------------------------------------------------------------------
// Execution

async function hopTo(key) {
	if (key === shardKey()) return true;
	const t = parseShard(key);
	if (!t) { log('cannot parse shard "' + key + '"', 'red'); return false; }
	if (typeof change_server !== 'function') { log('change_server unavailable', 'red'); return false; }
	log('hopping to ' + key + ' - the page will reload and this script restarts', '#FFD700');
	try { change_server(t.region, t.name); } catch (e) { log('change_server failed: ' + e, 'red'); return false; }
	const until = Date.now() + CONFIG.hopTimeoutMs;
	while (Date.now() < until) {
		await sleep(1000);
		if (shardKey() === key) return true;
	}
	return false;
}

function entityNamed(name) {
	try { if (parent.entities && parent.entities[name]) return parent.entities[name]; } catch (e) { }
	try { const p = get_player(name); if (p) return p; } catch (e) { }
	try {
		for (const id in parent.entities) {
			const c = parent.entities[id];
			if (c && c.name === name) return c;
		}
	} catch (e) { }
	return null;
}

// Find the slot holding this stack again. Indices shift after every sale, so
// nothing may cache one across an await.
function findSlot(name, level) {
	const items = character.items || [];
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (it && it.name === name && (it.level || 0) === (level || 0) && !it.l && !it.b) return i;
	}
	return -1;
}

/* Sell and CONFIRM BY GOLD, not by the call returning. A trade that is refused
   after the request lands looks identical to one that worked if the only thing
   checked is that no exception was thrown. */
async function sellToBid(r) {
	const before = character.gold;
	const ent = entityNamed(r.who);
	if (!ent) return { ok: false, why: 'buyer not rendered' };
	const idx = findSlot(r.name, r.level);
	if (idx < 0) return { ok: false, why: 'stack gone from the bag' };
	try { await trade_sell(ent, r.slot, r.qty); } catch (e) {
		return { ok: false, why: (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e) };
	}
	await sleep(600);
	const delta = character.gold - before;
	if (delta <= 0) return { ok: false, why: 'no gold arrived' };
	return { ok: true, delta: delta };
}

async function walkTo(map, x, y) {
	try { await smart_move({ map: map, x: x, y: y }); return true; }
	catch (e) { log('could not reach ' + map + ' ' + Math.round(x) + ',' + Math.round(y)
		+ ': ' + (e && e.reason ? e.reason : e), 'orange'); return false; }
}

async function runShard(s, rows, tally) {
	if (s !== shardKey()) {
		if (!await hopTo(s)) { log('hop to ' + s + ' failed - skipping it', 'orange'); return; }
	}
	for (const r of rows) {
		if (findSlot(r.name, r.level) < 0) continue;      // already gone
		log('-> ' + r.who + ' on ' + s + '/' + r.map + ' for ' + r.name + '+' + r.level + ' x' + r.qty, '#55BDF0');
		if (r.map != null && r.x != null && r.y != null) {
			if (!await walkTo(r.map, r.x, r.y)) continue;
		}
		// The feed said they were there; the game has to agree before selling.
		const until = Date.now() + CONFIG.entityWaitMs;
		let ent = null;
		while (Date.now() < until && !(ent = entityNamed(r.who))) await sleep(500);
		if (!ent) { log('   ' + r.who + ' never appeared - leaving the stack for the vendor', 'orange'); continue; }

		const res = await sellToBid(r);
		if (res.ok) {
			tally.sold++; tally.gold += res.delta;
			tally.overVendor += Math.max(0, res.delta - r.npcPer * r.qty);
			log('   sold for ' + res.delta.toLocaleString() + ' gold', '#7FD98A');
		} else {
			log('   did not sell (' + res.why + ')', 'orange');
		}
		await sleep(300);
	}
}

/* Vendor leg. The server checks sell() against G.maps[map].merchants - NOT the
   npc list - so the merchant has to stand near one of those entries. After a
   run of hops he could be anywhere, so this walks to one deliberately. */
async function nearestMerchantSpot() {
	try {
		const m = parent.G.maps[character.map];
		const list = (m && m.merchants) || [];
		let best = null;
		for (const e of list) {
			const d = Math.hypot(character.x - e.x, character.y - e.y);
			if (!best || d < best.d) best = { d: d, x: e.x, y: e.y, map: character.map, id: e.id };
		}
		if (best) return best;
	} catch (e) { }
	try {
		const e = (parent.G.maps.main.merchants || [])[2] || (parent.G.maps.main.merchants || [])[0];
		if (e) return { d: Infinity, x: e.x, y: e.y, map: 'main', id: e.id };
	} catch (e) { }
	return null;
}

async function runVendor(tally) {
	const spot = await nearestMerchantSpot();
	if (!spot) { log('no vendor found on this map - leaving the rest in the bag', 'orange'); return; }
	if (spot.d > 350) {
		log('walking to vendor ' + spot.id + ' on ' + spot.map, '#55BDF0');
		if (!await walkTo(spot.map, spot.x, spot.y)) return;
	}
	for (let guard = 0; guard < 120; guard++) {
		const items = character.items || [];
		let idx = -1;
		for (let i = 0; i < items.length; i++) {
			if (!protectedReason(items[i])) { idx = i; break; }
		}
		if (idx < 0) break;
		const it = items[idx];
		const qty = it.q || 1;
		const unit = npcValue({ name: it.name, level: it.level || 0, q: 1 });
		const before = character.gold;
		try { await sell(idx, qty); } catch (e) {
			log('vendor refused ' + it.name + ' (' + (e && (e.reason || e.message) ? (e.reason || e.message) : e) + ')', 'orange');
			break;
		}
		await sleep(150);
		const delta = character.gold - before;
		if (delta <= 0) { log('vendor took ' + it.name + ' but no gold arrived - stopping', 'orange'); break; }
		tally.vendorStacks++; tally.gold += delta;
		log('vendor: ' + it.name + ' x' + qty + ' for ' + delta.toLocaleString(), '#8b98ab');
	}
}

// ---------------------------------------------------------------------------

function saveState(st) { try { set(CLEAN_KEY, st); } catch (e) { } }
function loadState() { try { return get(CLEAN_KEY) || null; } catch (e) { return null; } }
function clearState() { try { set(CLEAN_KEY, null); } catch (e) { } }

/* Merchant.js may have left a trade holding goods. Selling those would take
   them out from under a trade that still thinks it owns them - its ledger
   would show a purchase with no disposal and its consecutive-strandings
   breaker would count wrong. Refuse rather than guess which stack is whose. */
function arbitrageBlocking() {
	let t = null;
	try { t = get('arb_trade'); } catch (e) { return null; }
	if (t && t.phase) return t;
	return null;
}

async function cleanout() {
	const blocked = arbitrageBlocking();
	if (blocked) {
		log('REFUSING TO RUN: Merchant.js has a trade in flight - ' + blocked.item
			+ ' x' + blocked.qty + ', phase ' + blocked.phase, 'red');
		log('those goods belong to that trade. Switch back to Merchant.js and let it'
			+ ' close or bank them, or clear it with arbProbeHalt/arbClearTrade, then rerun.', 'red');
		return;
	}

	let st = loadState();
	if (st && st.plan && CONFIG.mode === 'sell') {
		log('resuming a run started before a hop - ' + (st.done || []).length + ' shard(s) already done', '#FFD700');
	} else {
		const bids = await loadBids();
		if (!bids) { log('no bid data - nothing safe to decide on, stopping', 'red'); return; }
		const plan = buildPlan(bids);
		printPlan(plan);
		if (CONFIG.mode !== 'sell') return;
		st = { plan: plan, done: [], tally: { sold: 0, gold: 0, overVendor: 0, vendorStacks: 0 }, at: Date.now() };
		saveState(st);
	}

	const p = st.plan, tally = st.tally;
	for (const s of p.shards) {
		if ((st.done || []).includes(s)) continue;
		await runShard(s, p.byShard[s], tally);
		st.done = (st.done || []).concat([s]);
		st.tally = tally;
		saveState(st);          // before any further hop, so a reload resumes here
	}

	if (CONFIG.npcFallback) await runVendor(tally);

	log('done: ' + tally.sold + ' bid sale(s), ' + tally.vendorStacks + ' vendor stack(s), '
		+ tally.gold.toLocaleString() + ' gold in, ~' + Math.round(tally.overVendor).toLocaleString()
		+ ' of it above vendor price', '#7FD98A');
	log('switch back to Merchant.js when you are done - he may be off the home shard,'
		+ ' the scout will re-home him', '#55BDF0');
	clearState();
	return tally;
}

// Callable by hand so a run can be re-planned or resumed without re-engaging.
try { parent.cleanout = cleanout; parent.cleanoutPlan = async function () {
	const b = await loadBids(); if (b) printPlan(buildPlan(b)); }; } catch (e) { }

cleanout();
