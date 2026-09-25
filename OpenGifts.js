// ============================================================================
// OpenGifts - stand at the hub, open anniversary boxes, sell the chaff - v2
// ============================================================================
// Everything below is read from the game's own data at runtime, or was read
// out of the server source rather than remembered. The numbers that matter:
//
//   THE HUB. The character no longer stands on Xyn. It stands at a point that
//   is inside B.sell_dist of four different things at once, so one position
//   covers opening, selling, buying scrolls and upgrading without moving:
//
//     exchange   G.maps.main.exchange  (-25, -478)   ~292 away
//     upgrade    G.maps.main.upgrade   (-207, -220)   ~68 away
//     compound   G.maps.main.compound  (-207, -220)   ~68 away
//     merchants  basics (-89, -165)    190 | fancypots 237 | scrolls 290
//
//   Measured 2026-09-25: (-240, -280) is walkable and its worst anchor is
//   292 of the 400 allowed, leaving 108 of margin. A grid search found 2,556
//   walkable points satisfying all four, so this is a plateau rather than a
//   knife edge. The hub is SOLVED AT RUNTIME from live G data all the same -
//   a hardcoded coordinate is a coordinate that can go stale - and only falls
//   back to the measured pair if the solve finds nothing.
//
//   SCROLLS ARE A HARD ANCHOR, and the first draft of this got it wrong. If
//   the solver only requires "some merchant in range" it returns (-88, -328),
//   which looks better on every other measure - worst anchor 163 instead of
//   292 - and puts Lucas 442 away. The character could then open, sell and
//   upgrade, and silently never be able to buy a scroll. Only 'scrolls'
//   stocks scroll0/1/2 and cscroll0/1/2; basics and fancypots do not.
//
//   THE ANCHORS ARE NOT THE NPCs. The server checks upgrading against
//   G.maps.main.upgrade and opening against G.maps.main.exchange, which are
//   map reference points, while selling is checked against the entries of
//   G.maps.main.MERCHANTS - a different array from G.maps.main.npcs. Reading
//   the npc list and assuming selling works there is how this breaks.
//
//   The range is B.sell_dist = 400 (server.js:178), and every one of these
//   checks is skipped entirely if the character holds a computer. So a
//   character with one never has to travel at all.
//
//   An exchange takes 3000 + random(0..3000) ms - randomised, 3 to 6 seconds.
//   THIS IS WHY NOTHING HERE SLEEPS FOR A FIXED PERIOD. The runner's own
//   exchange() already awaits completion: it polls character.q.exchange at 1ms
//   and resolves the moment the placeholder turns into the reward. Awaiting it
//   is optimal, and a fixed six-second wait would throw away up to three
//   seconds on every single box.
//
//   The server refuses a second exchange while one is running
//   (fail_response "exchange_existing"), so there is no faster pattern to
//   find - one at a time is the rule, and awaiting is how you hit it exactly.
//
//   SELLING IS WHAT MAKES A LONG RUN POSSIBLE. 1,292 boxes yield roughly 67
//   confetti, 54 party hats and 13 pokers, and the bag fills long before the
//   boxes run out. Selling the chaff as it arrives is what keeps slots free.
//   The server pays calculate_item_value(), which is 60% of the item's g.
// ============================================================================

const CONFIG = {
	// All three anniversary exchangeables, each consuming one per exchange
	// (their "e" is 1 in the item data). Add to this list rather than
	// rewriting it - an unknown name is skipped, not an error.
	boxes: ['anniversarygift', 'gift0', 'gift1'],

	// Stop when the bag gets this tight. The rewards have to land somewhere,
	// and the server refuses outright at zero free slots - stopping a little
	// short leaves room to walk away and bank rather than being stuck.
	minFreeSlots: 3,

	/* Sold to the nearest merchant as it accumulates. The number is how many
	   to KEEP, not how many to sell.

	   poker keeps 3 deliberately. It sells for 9,600, which is exactly what
	   the market charges for one, and poker+0 (armor 11 / resistance 6, crit
	   0.5) beats the gloves+6 that Dexon and MageofOz wear (armor 9 /
	   resistance 6). Selling every one of them sells a gear upgrade at the
	   same price you would buy it back for. Three covers the party; set it to
	   0 if you would rather have the gold.

	   confetti is g20 - it sells for 12 gold. It is on this list to free the
	   slot, not to earn anything. */
	autoSell: { partyhat: 0, confetti: 0, poker: 3, pants:0, shoes:0, gloves:0, coat:0},

	// Sell every this many opens, so slots come back during a long run rather
	// than only at the end.
	sellEvery: 25,

	hub: {
		map: 'main',
		// Only used if the runtime solve fails. Measured 2026-09-25.
		fallback: { x: -240, y: -280 },
		// The server's own limit. The solve keeps well inside it because the
		// check is made when the request lands, not when it was sent.
		serverRange: 400,
		solveRange: 340,

		/* Merchants whose STOCK is needed, not just any merchant who will buy.
		   Selling works at any entry in G.maps.main.merchants, but only
		   'scrolls' (Lucas) carries scroll0/1/2 and cscroll0/1/2 - the things
		   an upgrade run actually consumes.

		   This list is why the hub sits where it does. Without it the solver
		   happily returns (-88, -328), which is closer to everything else
		   (worst anchor 163) and leaves Lucas 442 away - out of range, so the
		   character could open, sell and upgrade but never restock. */
		requireMerchants: ['scrolls'],
	},

	// Give up after this many refusals in a row. Anything repeating is a
	// condition that will not clear by trying harder.
	maxConsecutiveFailures: 3,
};

function log(msg, color) {
	try { game_log('[gifts] ' + msg, color || '#8b98ab'); } catch (e) { console.log('[gifts]', msg); }
}

function xy(o) {
	if (!o) return null;
	if (Array.isArray(o)) return { x: o[0], y: o[1] };
	if (o.x != null && o.y != null) return { x: o.x, y: o.y };
	return null;
}

/* Every anchor the hub has to satisfy, read live. Selling deliberately reads
   G.maps.main.merchants rather than the npc list, because that is the array
   the server's sell handler walks. */
function hubAnchors() {
	const out = [];
	try {
		const m = parent.G.maps[CONFIG.hub.map];
		const ex = xy(m.exchange); if (ex) out.push({ name: 'exchange', x: ex.x, y: ex.y });
		const up = xy(m.upgrade); if (up) out.push({ name: 'upgrade', x: up.x, y: up.y });
		const co = xy(m.compound); if (co) out.push({ name: 'compound', x: co.x, y: co.y });
		// Merchants we need the STOCK of are hard requirements. Merchants we
		// only need to SELL to are not - any one of them will do, and that is
		// handled separately below.
		for (const id of (CONFIG.hub.requireMerchants || [])) {
			const mm = (m.merchants || []).find(function (e) { return e && e.id === id; });
			const p = xy(mm);
			if (p) out.push({ name: 'merchant:' + id, x: p.x, y: p.y });
			else log('required merchant "' + id + '" is not on this map - hub may be wrong', 'orange');
		}
	} catch (e) { }
	return out;
}

function merchantSpots() {
	try {
		return (parent.G.maps[CONFIG.hub.map].merchants || []).map(function (m) {
			const p = xy(m); return p ? { name: m.id || 'merchant', x: p.x, y: p.y } : null;
		}).filter(Boolean);
	} catch (e) { return []; }
}

function walkable(x, y) {
	try {
		return can_move({ map: CONFIG.hub.map, x: x, y: y, going_x: x, going_y: y, base: { h: 8, v: 7, vn: 2 } }) === true;
	} catch (e) { return true; }   // cannot test -> do not veto
}

/* Solve for a standing point covering every required anchor plus at least one
   merchant. Coarse grid then a fine pass, which is plenty for a 108-unit
   plateau and costs nothing next to a 3-6 second exchange. */
function solveHub() {
	const req = hubAnchors();
	const merchants = merchantSpots();
	if (!req.length || !merchants.length) {
		log('could not read the map anchors - using the recorded hub', 'orange');
		return { map: CONFIG.hub.map, x: CONFIG.hub.fallback.x, y: CONFIG.hub.fallback.y };
	}
	const R = CONFIG.hub.solveRange;
	const d = (x, y, p) => Math.sqrt((x - p.x) * (x - p.x) + (y - p.y) * (y - p.y));

	function score(x, y) {
		let worst = 0;
		for (const a of req) { const v = d(x, y, a); if (v > R) return null; if (v > worst) worst = v; }
		let near = Infinity;
		for (const m of merchants) { const v = d(x, y, m); if (v < near) near = v; }
		if (near > R) return null;
		return Math.max(worst, near);
	}

	let best = null;
	for (let step of [8, 2]) {
		const cx = best ? best.x : -240, cy = best ? best.y : -280;
		const span = best ? 24 : 600;
		for (let x = cx - span; x <= cx + span; x += step) {
			for (let y = cy - span; y <= cy + span; y += step) {
				const s = score(x, y);
				if (s == null) continue;
				if (best && s >= best.s) continue;
				if (!walkable(x, y)) continue;
				best = { x: x, y: y, s: s };
			}
		}
	}
	if (!best) {
		log('no point satisfied every anchor - using the recorded hub', 'orange');
		return { map: CONFIG.hub.map, x: CONFIG.hub.fallback.x, y: CONFIG.hub.fallback.y };
	}
	log('hub solved at ' + Math.round(best.x) + ', ' + Math.round(best.y)
		+ ' (worst anchor ' + Math.round(best.s) + ' of ' + CONFIG.hub.serverRange + ')', '#55BDF0');
	return { map: CONFIG.hub.map, x: best.x, y: best.y };
}

// A computer exempts the character from the distance check entirely, which is
// worth knowing before walking anywhere.
function hasComputer() {
	try {
		return (character.items || []).some((it) => it
			&& (it.name === 'computer' || it.name === 'supercomputer'));
	} catch (e) { return false; }
}

function atHub(spot) {
	try {
		if (character.map !== spot.map) return false;
		return distance(character, spot) <= 60;
	} catch (e) { return false; }
}

// First box in the bag, re-read every time. The inventory shifts under us on
// every exchange - the box is consumed and a reward appears - so an index
// cached across iterations is an index pointing at the wrong thing.
function findBox() {
	const items = character.items || [];
	for (let i = 0; i < items.length; i++) {
		if (items[i] && CONFIG.boxes.includes(items[i].name)) return i;
	}
	return -1;
}

function countBoxes() {
	let n = 0;
	for (const it of (character.items || [])) {
		if (it && CONFIG.boxes.includes(it.name)) n += (it.q || 1);
	}
	return n;
}

/* Sell down to the keep count. Re-reads the bag on every pass because selling
   shifts indices exactly the way opening does. Locked and blocked items are
   skipped rather than attempted - the server refuses them (item_locked,
   item_blocked) and a refusal here would burn a consecutive-failure slot. */
async function sellChaff(tally) {
	let sold = 0, gold = 0;
	for (const name of Object.keys(CONFIG.autoSell)) {
		const keep = CONFIG.autoSell[name] || 0;
		for (let guard = 0; guard < 60; guard++) {
			const items = character.items || [];
			let have = 0;
			for (const it of items) { if (it && it.name === name) have += (it.q || 1); }
			if (have <= keep) break;

			let idx = -1;
			for (let i = 0; i < items.length; i++) {
				const it = items[i];
				if (it && it.name === name && !it.l && !it.b) { idx = i; break; }
			}
			if (idx < 0) break;   // all locked or blocked

			const it = items[idx];
			const stack = it.q || 1;
			const qty = Math.min(stack, have - keep);
			let unit = 0;
			try { unit = calculate_item_value(it) || 0; } catch (e) { }

			try {
				await sell(idx, qty);
				sold += qty; gold += unit * qty;
				if (tally) tally[name] = (tally[name] || 0) + qty;
			} catch (e) {
				const why = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
				log('could not sell ' + name + ' (' + why + ')', 'orange');
				break;
			}
			await sleep(60);
		}
	}
	if (sold) log('sold ' + sold + ' item(s) for ~' + gold.toLocaleString() + ' gold', '#7FD98A');
	return { sold: sold, gold: gold };
}

async function openGifts() {
	const spot = solveHub();

	if (!atHub(spot) && !hasComputer()) {
		log('walking to the hub at ' + Math.round(spot.x) + ', ' + Math.round(spot.y), '#55BDF0');
		try {
			await smart_move({ map: spot.map, x: spot.x, y: spot.y });
		} catch (e) {
			log('could not reach the hub: ' + (e && e.reason ? e.reason : e), 'red');
			return;
		}
	} else if (hasComputer() && !atHub(spot)) {
		log('using the computer - no walk needed', '#55BDF0');
	}

	const rewards = {}, soldTally = {};
	let opened = 0, failures = 0, goldFromSales = 0;
	const started = Date.now();
	log('starting with ' + countBoxes() + ' box(es) and ' + character.esize + ' free slot(s)', '#55BDF0');

	while (true) {
		if (character.esize <= CONFIG.minFreeSlots) {
			// Try to make room before giving up - that is the whole point of
			// selling during the run rather than after it.
			const r = await sellChaff(soldTally);
			goldFromSales += r.gold;
			if (character.esize <= CONFIG.minFreeSlots) {
				log('down to ' + character.esize + ' free slot(s) with nothing left to sell - stopping', '#E9C46A');
				break;
			}
		}
		const idx = findBox();
		if (idx < 0) { log('no boxes left', '#7FD98A'); break; }

		try {
			// Awaited, not polled by us: this resolves the instant the server
			// finishes, which is somewhere between 3 and 6 seconds and is not
			// knowable in advance.
			const r = await exchange(idx);
			failures = 0;
			opened++;
			const got = (r && r.reward) || 'something the client did not name';
			rewards[got] = (rewards[got] || 0) + 1;
			log('opened ' + opened + ': ' + got, '#7FD98A');

			if (CONFIG.sellEvery > 0 && opened % CONFIG.sellEvery === 0) {
				const s = await sellChaff(soldTally);
				goldFromSales += s.gold;
			}
		} catch (e) {
			const why = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
			failures++;
			log('exchange refused (' + why + ')', 'orange');

			if (why === 'inventory_full') {
				const s = await sellChaff(soldTally);
				goldFromSales += s.gold;
				if (s.sold) { failures = 0; continue; }
				break;
			}
			if (why === 'distance') {
				log('drifted out of range - walking back', 'orange');
				try { await smart_move({ map: spot.map, x: spot.x, y: spot.y }); }
				catch (e2) { log('could not get back to the hub - stopping', 'red'); break; }
				failures = 0;
				continue;
			}
			// exchange_existing means one is still running. Nothing to do but
			// let it finish; a short wait here costs nothing because the
			// server would refuse a second one anyway.
			if (why === 'in_progress' || why === 'exchange_existing') {
				await sleep(200);
				failures = 0;
				continue;
			}
			if (failures >= CONFIG.maxConsecutiveFailures) {
				log('stopping after ' + failures + ' refusals in a row', 'red');
				break;
			}
			await sleep(500);
		}
	}

	const final = await sellChaff(soldTally);
	goldFromSales += final.gold;

	const secs = Math.round((Date.now() - started) / 1000);
	log('opened ' + opened + ' box(es) in ' + secs + 's'
		+ (opened ? ' (' + (secs / opened).toFixed(1) + 's each)' : ''), '#55BDF0');
	const lines = Object.keys(rewards).sort((a, b) => rewards[b] - rewards[a]);
	for (const k of lines) log('  ' + rewards[k] + ' x ' + k, '#8b98ab');
	const soldNames = Object.keys(soldTally);
	if (soldNames.length) {
		log('sold: ' + soldNames.map((n) => soldTally[n] + ' x ' + n).join(', ')
			+ ' for ~' + goldFromSales.toLocaleString() + ' gold', '#7FD98A');
	}
	log(countBoxes() + ' box(es) left, ' + character.esize + ' free slot(s)', '#55BDF0');
	return { opened: opened, rewards: rewards, sold: soldTally, gold: goldFromSales, left: countBoxes() };
}

// Reachable from the console so a run can be repeated after banking, without
// re-engaging the slot. sellChaff is exposed too - it is useful on its own.
try { parent.openGifts = openGifts; parent.sellChaff = sellChaff; } catch (e) { }

openGifts();
