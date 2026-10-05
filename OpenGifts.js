// ============================================================================
// OpenGifts - stand at the hub, open anniversary boxes, sell the chaff - v5 (the jacko compound now runs DURING the box loop, any time three jackos share a level below the target, instead of once after it. v4 had it as an end-of-run phase, which was the wrong shape for what it is for: three jackos become one, so a compound is a net +2 slots, and the whole reason it exists is to stop the run stalling on a full bag. Running it only at the end meant the stall happened first and the fix arrived after the run had already given up. Three places now trigger it: after every box opened, on the slot-pressure check at the top of the loop, and in the inventory_full refusal path. The last two used to sell and then give up; they now try the whole ladder - sell for gold, compound for two slots per three jackos, bank the finished +3s - and only stop when none of the three can free anything. Banking is the last resort there because it is the only step that walks off the hub. compoundJackos(quiet) suppresses the phase header when called from inside the loop, so the log stays readable; the end-of-run pass still prints in full and still does the banking.) - v4 (compounds jacko to +3 after the box run and banks the finished ones. Jacko is the commonest thing the candy exchanges produce, so it accumulates faster than anything else here. THE HUB ALREADY MADE THIS FREE: hubAnchors() has always included G.maps.main.compound and requireMerchants is ['scrolls'], so the standing spot is already within range of the compound NPC AND of Lucas, who sells the cscrolls - the compound phase needs no movement at all, and neither does restocking. Only the bank trip moves. THE SCROLL GRADE STEPS UP MID-LADDER AND THIS IS THE EASY THING TO GET WRONG: jacko's grades are [2,4,6,7], so a +0 and a +1 are grade 0 and take cscroll0 at 6,400, but a +2 is grade 1 and needs cscroll1 at 240,000 - the server refuses the cheap scroll with compound_incompatible_scroll, because it checks grade > scroll_def.grade. jackoScrollFor() derives the scroll from the item's own grade rather than hardcoding one. COST, so the defaults can be argued with: the chances are igrade 0 from G.compounds, 0.99 / 0.75 / 0.40 for +1 / +2 / +3, and a failure destroys all three inputs - so a finished +3 costs about 91 jacko+0, not the 27 that 3^3 suggests, plus roughly 858,000 in scrolls. Grace makes the real figure better than that; it is a floor, not a forecast. Banking is gated on a nearly-full bag and takes ONLY jackos at the target level, which is what was asked for.) - v3 (opens EVERYTHING Xyn takes, not just the three anniversary boxes. boxes goes from 3 to 33, derived by listing G.items entries with an "e" and no "quest" - def.quest is what routes an exchange away from G.maps.main.exchange, and these have none, so one standing position covers all 33. sixcake and 5bucks are excluded on purpose: they carry an "e" but have NO entry in design/drops.js, and the handler gates on !D.drops[dropId], so they fail as "invalid" - an unhandled reason that would burn three consecutive-failure slots and stop the run. Found by parsing drops.js rather than by trying it. findBox now skips a stack smaller than the item's e, because candypop (10) and ornament (20) consume a whole stack and the server refuses a short one with "exchange_notenough", also unhandled. autoSell goes from 7 entries to 45, built from the 148 distinct rewards across those 32 tables and filtered on gear plan, exchangeability, type, live market price >= 50,000 and vendor >= 100,000. THE MARKET TEST IS WHAT MAKES IT SAFE: cxjar vendors for 1 and sells for 1,000,000, tshirt3 vendors for 72 and sells for 200,000,000, and both sort to the top of a cheapest-first vendor list. ftrinket keeps 2 alongside poker's 3 - FatherToken wears ftrinket+2. angelwings, puppyer, tshirt7, talkingskull and tristone were removed from the sell list by the operator after review; the classifier will keep proposing them, so do not re-add them from a fresh run) - v2
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
	/* EVERY item Xyn takes, read off G at runtime on 2026-10-04 by listing the
	   G.items entries that carry an "e" and no "quest" - def.quest is exactly
	   what sends an exchange somewhere other than G.maps.main.exchange, and
	   none of these have one. Add to this list rather than rewriting it; an
	   unknown name is skipped, not an error.

	   sixcake and 5bucks are DELIBERATELY ABSENT. Both carry an "e" but have no
	   entry in design/drops.js, and the handler gates on
	   !def || !def.e || !D.drops[dropId] - so they fail as "invalid", a reason
	   the catch below does not special-case, and three of them in a row stops
	   the run with boxes still in the bag. Verified by parsing drops.js.

	   candypop (e=10) and ornament (e=20) consume a whole stack per exchange.
	   findBox skips a stack that is too small rather than letting the server
	   refuse it with "exchange_notenough" - another unhandled reason. */
	boxes: [
		'anniversarygift', 'gift0', 'gift1',
		'gem0', 'gem1',
		'candy0', 'candy1', 'candy0v2', 'candy1v2', 'candy0v3', 'candy1v3',
		'candypop', 'candycane', 'mistletoe', 'ornament',
		'basketofeggs', 'goldenegg', 'xbox', 'mysterybox', 'troll', 'glitch',
		'weaponbox', 'armorbox', 'jewellerybox', 'bugbountybox', 'apologybox',
		'redenvelope', 'redenvelopev2', 'redenvelopev3', 'redenvelopev4',
		'greenenvelope', 'brownenvelope',
		'marketparcel',
	],

	// Stop when the bag gets this tight. The rewards have to land somewhere,
	// and the server refuses outright at zero free slots - stopping a little
	// short leaves room to walk away and bank rather than being stuck.
	minFreeSlots: 3,

	/* Sold to the nearest merchant as it accumulates. The number is how many
	   to KEEP, not how many to sell. Everything below came out of the 32 Xyn
	   drop tables in design/drops.js - 148 distinct reward items - filtered to
	   the ones worth nothing to us. A reward is KEPT OFF this list if it is on
	   the gear plan, is itself exchangeable, is a scroll/offering/potion/
	   elixir/booster/token/gem, has a live market price at or above 50,000, or
	   vendors for 100,000 or more.

	   THE MARKET TEST IS LOAD-BEARING. Vendor value alone would have been a
	   disaster, because the two worst offenders sort to the TOP of a
	   cheapest-first vendor list. Measured 2026-10-04:
	     cxjar    vendors for 1  and sells for 1,000,000
	     tshirt3  vendors for 72 and sells for 200,000,000
	   Both drop from these tables. Neither is on this list.

	   poker keeps 3 deliberately. It sells for 9,600, which is exactly what
	   the market charges for one, and poker+0 (armor 11 / resistance 6, crit
	   0.5) beats the gloves+6 that Dexon and MageofOz wear (armor 9 /
	   resistance 6). Selling every one of them sells a gear upgrade at the
	   same price you would buy it back for. Three covers the party; set it to
	   0 if you would rather have the gold.

	   ftrinket keeps 2 for the same reason - FatherToken wears ftrinket+2 in
	   his orb slot, so they are a spare and an upgrade path, not chaff.

	   HELD OUT BY THE OPERATOR 2026-10-04, not by the filter: angelwings,
	   puppyer, tshirt7, talkingskull and tristone. Do not re-add them from a
	   fresh classifier run - the filter will keep proposing them.

	   confetti is g20 - it sells for 12 gold. It is on this list to free the
	   slot, not to earn anything. */
	autoSell: {
		// kept deliberately - see above
		poker: 3, ftrinket: 2,

		// pure slot-clearers: throwables, novelty wearables, low-tier gear
		snowball: 0, confetti: 0, firecrackers: 0, smoke: 0,
		broom: 0, emptyheart: 0, partyhat: 0, rednose: 0,
		tshirt0: 0, tshirt1: 0, tshirt2: 0, tshirt4: 0, tshirt6: 0,
		tshirt8: 0, tshirt88: 0,
		xmashat: 0, xmassweater: 0, xmaspants: 0, xmasshoes: 0,
		warmscarf: 0, eslippers: 0, epyjamas: 0, luckyt: 0,
		bunnyears: 0, eears: 0, gphelmet: 0, helmet1: 0,
		gloves1: 0, mittens: 0,
		hpamulet: 0, hpbelt: 0, skullamulet: 0,
		cupid: 0, snowflakes: 0, ornamentstaff: 0, bataxe: 0, pinkie: 0,
		throwingstars: 0, swordofthedead: 0, daggerofthedead: 0,
		maceofthedead: 0, hbow: 0, hgloves: 0, bowofthedead: 0, staffofthedead:0,
		pmaceofthedead: 0, phelmet: 0, hhelmet: 0,

		// carried over from the slot-8 build
		pants: 0, shoes: 0, gloves: 0, coat: 0, helmet: 0, wbreeches: 0,
	},

	// Sell every this many opens, so slots come back during a long run rather
	// than only at the end.
	sellEvery: 25,

	/* JACKO COMPOUNDING. Runs after the box loop, because the boxes are what
	   produce the jackos in the first place.

	   WHY HERE AND NOT IN Merchant.js: the merchant's gear planner compounds
	   toward named plan targets, and a surplus stream is not a plan target. It
	   also already stands somewhere else. This script is the one that creates
	   jackos, and its hub is already in range of everything the ladder needs.

	   target 3 means compound +0 -> +1 -> +2 -> +3 and then STOP. A +3 is the
	   thing that gets banked, so it is never fed back into another roll.

	   The ladder is not cheap in jackos. Chances are 0.99 / 0.75 / 0.40 for
	   +1 / +2 / +3 (G.compounds, igrade 0 - jacko's igrade is computed
	   server-side from its grades and is absent from the client's G), and a
	   failed compound destroys all three inputs, so the expected cost of one
	   finished +3 is about 91 jacko+0 and ~858,000 gold in scrolls. Grace
	   improves both; treat those as a floor. */
	jacko: {
		enabled: true,
		item: 'jacko',
		target: 3,

		/* Finished +3s kept in the bag rather than banked. 0 banks all of them. */
		reserve: 0,

		/* Bank the finished +3s once free slots fall to this or below. The bank is
		   its own map, so this is the only part of the jacko phase that moves the
		   character - everything else happens from the hub. */
		bankAtFreeSlots: 2,

		/* Lucas is a hard hub anchor (requireMerchants above), so a restock is a
		   buy() from where we already stand, not a trip. */
		buyScrolls: true,

		/* Never buy a scroll above this grade. cscroll2 is 9,200,000 against
		   cscroll1's 240,000, and nothing in a 0..3 ladder needs it - a +2 is
		   grade 1. This is a guard against a mis-derived grade quietly spending
		   nine million gold. */
		maxScrollGrade: 1,

		/* Gold never spent on scrolls, so a compound run cannot empty the purse. */
		goldFloor: 1000000,

		/* Offerings multiply the chance (1.64x at the low end) but cost far more
		   than a jacko is worth. Off; the inputs are effectively free. */
		useOffering: false,

		maxConsecutiveFailures: 3,
	},

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

/* First exchangeable in the bag, re-read every time. The inventory shifts under
   us on every exchange - the box is consumed and a reward appears - so an index
   cached across iterations is an index pointing at the wrong thing.

   A stack smaller than the item's "e" is SKIPPED, not attempted. The server
   consumes def.e per exchange and refuses below it with "exchange_notenough";
   candypop needs 10 and ornament 20, so a part-stack of either would fail three
   times in a row and stop the run while other boxes still sat in the bag. */
function findBox() {
	const items = character.items || [];
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it || !CONFIG.boxes.includes(it.name)) continue;
		let need = 1;
		try { need = (parent.G.items[it.name] || {}).e || 1; } catch (e) { }
		if ((it.q || 1) < need) continue;
		return i;
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

/* Grade bands from G at runtime. jacko is [2,4,6,7], so +0/+1 are grade 0,
   +2/+3 are grade 1, +4/+5 grade 2. The server computes a grade exactly this
   way and then refuses a scroll whose grade is lower, so this has to match. */
function jackoGradeAt(level) {
	try {
		const g = parent.G.items[CONFIG.jacko.item].grades || [];
		let grade = 0;
		for (let i = 0; i < g.length; i++) if (level >= g[i]) grade = i + 1;
		return grade;
	} catch (e) { return null; }
}

/* The cheapest scroll the server will ACCEPT for an item at this level - not the
   cheapest scroll. The check is grade > scroll_def.grade -> refused, so the
   scroll grade must be at least the item's grade. Returns null rather than
   guessing when the grade is unreadable or above maxScrollGrade. */
function jackoScrollFor(level) {
	const grade = jackoGradeAt(level);
	if (grade === null) return null;
	if (grade > CONFIG.jacko.maxScrollGrade) return null;
	return 'cscroll' + grade;
}

/* Three DISTINCT slots holding the same name at the same level, below target.
   The server requires three different slots, identical names and identical
   levels, and refuses locked items outright - all four checked here so a doomed
   call is never sent. Lowest level first, so the ladder is climbed from the
   bottom and a +2 is never built before the +1s are used up. */
function jackoGroup() {
	const name = CONFIG.jacko.item;
	const byLevel = {};
	const items = character.items || [];
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it || it.name !== name) continue;
		if (it.l) continue;                      // locked -> item_locked
		const L = it.level || 0;
		if (L >= CONFIG.jacko.target) continue;  // finished; this is what gets banked
		(byLevel[L] = byLevel[L] || []).push(i);
	}
	const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
	for (const L of levels) if (byLevel[L].length >= 3) return { level: L, indices: byLevel[L].slice(0, 3) };
	return null;
}

function jackoCount() {
	const out = {};
	for (const it of (character.items || [])) {
		if (!it || it.name !== CONFIG.jacko.item) continue;
		const L = it.level || 0;
		out[L] = (out[L] || 0) + 1;
	}
	return out;
}

/* Lucas is a hub anchor, so this is a buy from where we stand. Returns the slot
   or -1. Never spends past goldFloor. */
async function ensureScroll(scrollName) {
	let slot = -1;
	try { slot = locate_item(scrollName); } catch (e) { slot = -1; }
	if (slot !== -1 && slot !== null && slot >= 0) return slot;
	if (!CONFIG.jacko.buyScrolls) { log('no ' + scrollName + ' and buying is off', 'orange'); return -1; }

	let price = 0;
	try { price = (parent.G.items[scrollName] || {}).g || 0; } catch (e) { }
	if (character.gold - price < CONFIG.jacko.goldFloor) {
		log('not buying ' + scrollName + ' (~' + price.toLocaleString() + ') - would drop under the '
			+ CONFIG.jacko.goldFloor.toLocaleString() + ' floor', 'orange');
		return -1;
	}
	try {
		await buy(scrollName, 1);
		log('bought a ' + scrollName + ' (~' + price.toLocaleString() + ' gold)', '#8b98ab');
	} catch (e) {
		log('could not buy ' + scrollName + ': ' + ((e && (e.reason || e.message)) || e), 'red');
		return -1;
	}
	try { slot = locate_item(scrollName); } catch (e) { slot = -1; }
	return (slot === null || slot === undefined) ? -1 : slot;
}

/* Climbs the ladder as far as the jackos on hand allow, then stops. A compound
   takes 10s server-side (len = 10000) and parent.compound resolves when the
   server answers, so this awaits rather than polls - but it is bounded, because
   an await that never settles would end the run silently. */
async function compoundJackos(quiet) {
	if (!CONFIG.jacko.enabled) return { attempts: 0, made: {} };
	if (typeof compound !== 'function') { log('compound() not available in this context', 'orange'); return { attempts: 0, made: {} }; }

	const before = jackoCount();
	/* quiet is for the in-loop calls: they fire whenever a triple appears, which
	   is often, and a phase header each time would bury the box log. The
	   per-compound lines still print - those are the ones worth seeing. */
	if (!quiet) {
		const have = Object.keys(before).map(function (L) { return before[L] + 'x+' + L; }).join(', ');
		log('jacko phase: ' + (have || 'none on hand'), '#55BDF0');
	}

	let attempts = 0, failures = 0;
	const made = {}, lost = {};
	while (true) {
		const group = jackoGroup();
		if (!group) break;

		const scrollName = jackoScrollFor(group.level);
		if (!scrollName) {
			log('+' + group.level + ' needs a scroll above maxScrollGrade (' + CONFIG.jacko.maxScrollGrade
				+ ') - stopping the ladder here', '#E9C46A');
			break;
		}
		const scrollSlot = await ensureScroll(scrollName);
		if (scrollSlot < 0) break;

		let offeringSlot = null;
		if (CONFIG.jacko.useOffering) {
			try { const o = locate_item('offering'); if (o !== null && o >= 0) offeringSlot = o; } catch (e) { }
		}

		const [a, b, c] = group.indices;
		attempts++;
		try {
			const p = compound(a, b, c, scrollSlot, offeringSlot);
			const res = await Promise.race([
				Promise.resolve(p),
				new Promise(function (_, rej) { setTimeout(function () { rej(new Error('compound-timeout')); }, 30000); }),
			]);
			/* The server holds q.compound for the full 10s even after answering, and
			   a second call lands as compound_in_progress. Wait it out. */
			for (let i = 0; i < 400 && character.q && character.q.compound; i++) await sleep(100);

			const success = !!(res && (res.success === true || res.level !== undefined));
			if (success) {
				const L = group.level + 1;
				made[L] = (made[L] || 0) + 1;
				log('compounded 3x +' + group.level + ' -> +' + L, '#7FD98A');
			} else {
				lost[group.level] = (lost[group.level] || 0) + 3;
				log('compound of 3x +' + group.level + ' failed - inputs lost', '#E9C46A');
			}
			failures = 0;
		} catch (e) {
			const why = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
			/* A roll that simply lost is NOT an error - the promise rejects on a
			   failed compound in some client builds, and treating that as a fault
			   would stop the ladder after three unlucky rolls. Only refusals count. */
			if (why === 'compound_in_progress') { await sleep(500); continue; }
			if (why === 'distance') {
				log('out of compound range - the hub should cover it; stopping the ladder', 'red');
				break;
			}
			if (why === 'compound_incompatible_scroll') {
				log('server refused ' + scrollName + ' for a +' + group.level
					+ ' - the grade derivation is wrong, stopping rather than guessing', 'red');
				break;
			}
			if (why === 'max_level' || why === 'compound_cant') { break; }
			if (/fail|lost|broke/i.test(why)) {
				lost[group.level] = (lost[group.level] || 0) + 3;
				log('compound of 3x +' + group.level + ' failed - inputs lost', '#E9C46A');
				failures = 0;
				continue;
			}
			failures++;
			log('compound refused (' + why + ') ' + failures + '/' + CONFIG.jacko.maxConsecutiveFailures, 'orange');
			if (failures >= CONFIG.jacko.maxConsecutiveFailures) break;
			await sleep(500);
		}
	}

	const after = jackoCount();
	if (!quiet || attempts) {
		const now = Object.keys(after).map(function (L) { return after[L] + 'x+' + L; }).join(', ');
		log('jacko: ' + attempts + ' compound(s), now ' + (now || 'none'), '#55BDF0');
	}
	return { attempts: attempts, made: made, lost: lost, after: after };
}

/* Free slots, counted. character.esize is what the rest of this script uses and
   it agrees here, but counting the nulls is the question actually being asked. */
function freeSlots() {
	let free = 0;
	const items = character.items || [];
	for (let i = 0; i < items.length; i++) if (!items[i]) free++;
	return free;
}

/* The finished jackos this pass would bank, or [] - keeps reserve back. */
function jackoToBank() {
	const name = CONFIG.jacko.item, target = CONFIG.jacko.target;
	const found = [];
	const items = character.items || [];
	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		if (!it || it.name !== name) continue;
		if (it.l) continue;                       // locked - left alone
		if ((it.level || 0) !== target) continue;  // ONLY the finished ones
		found.push(i);
	}
	const keep = Math.min(CONFIG.jacko.reserve, found.length);
	return found.slice(keep);
}

/* Banks ONLY jacko at the target level. Nothing else is touched - that is the
   requirement, and it is why this does its own trip instead of calling anything
   that sweeps the bag. Returns to the hub afterwards so a following run is not
   left standing in the bank. */
async function bankJackos(spot) {
	const toBank = jackoToBank();
	if (!toBank.length) return 0;

	const bankMap = 'bank';
	if (character.map !== bankMap) {
		log('banking ' + toBank.length + ' finished jacko(s) - walking to the bank', '#55BDF0');
		try { await smart_move(bankMap); }
		catch (e) { log('could not reach the bank: ' + ((e && e.reason) || e) + ' - keeping them', 'orange'); return 0; }
	}
	/* bank_store rejects until the vault is actually open, which lags arrival. */
	for (let i = 0; i < 100 && !character.bank; i++) await sleep(100);
	if (!character.bank) { log('at the bank but the vault did not open - keeping them', 'orange'); return 0; }

	/* Re-read indices: the walk can change the bag, and a store nulls its slot.
	   Highest first so earlier indices stay meaningful. */
	let stored = 0;
	for (const idx of jackoToBank().sort(function (a, b) { return b - a; })) {
		const it = character.items[idx];
		if (!it || it.name !== CONFIG.jacko.item) continue;
		try {
			await bank_store(idx);
			stored++;
			await sleep(300);
		} catch (e) {
			const why = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
			log('bank_store failed for a +' + (it.level || 0) + ' jacko - ' + why, 'red');
			if (why === 'storage_full') break;
		}
	}
	if (stored) log('banked ' + stored + ' jacko+' + CONFIG.jacko.target, '#7FD98A');

	if (spot && !hasComputer()) {
		try { await smart_move({ map: spot.map, x: spot.x, y: spot.y }); }
		catch (e) { log('banked, but could not walk back to the hub', 'orange'); }
	}
	return stored;
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
	/* Compounds done DURING the loop, kept apart from the end-of-run pass so the
	   summary shows which did the slot reclaiming. */
	const jackoDuring = { attempts: 0, made: {} };
	let opened = 0, failures = 0, goldFromSales = 0;
	const started = Date.now();
	log('starting with ' + countBoxes() + ' box(es) and ' + character.esize + ' free slot(s)', '#55BDF0');

	while (true) {
		if (character.esize <= CONFIG.minFreeSlots) {
			/* THE ANTI-STALL LADDER, cheapest first. Until v5 this sold and then
			   gave up, which IS the stall. Each rung frees slots a different way:
			     sell     - gold, no movement
			     compound - three jackos become one, a net +2 slots, and it is
			                progress we want anyway
			     bank     - the finished +3s, and the only rung that walks off the
			                hub, so it goes last
			   Each is re-checked against esize so no rung runs that is not needed. */
			const r = await sellChaff(soldTally);
			goldFromSales += r.gold;

			if (character.esize <= CONFIG.minFreeSlots && CONFIG.jacko.enabled && jackoGroup()) {
				log('slots tight - compounding jackos to reclaim some', '#E9C46A');
				const j = await compoundJackos(true);
				jackoDuring.attempts += j.attempts;
				for (const L in (j.made || {})) jackoDuring.made[L] = (jackoDuring.made[L] || 0) + j.made[L];
			}
			if (character.esize <= CONFIG.minFreeSlots && CONFIG.jacko.enabled && jackoToBank().length) {
				log('still tight - banking the finished jackos', '#E9C46A');
				await bankJackos(spot);
			}
			if (character.esize <= CONFIG.minFreeSlots) {
				log('down to ' + character.esize + ' free slot(s) with nothing left to sell, '
					+ 'compound or bank - stopping', '#E9C46A');
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

			/* THE TRIGGER. Any time three jackos share a level below target - so
			   3x+0, 3x+1 or 3x+2 - compound them, right here, mid-run. Checked
			   after every box because a box is what produces a jacko, so this is
			   the first moment a new triple can exist. jackoGroup() is a cheap
			   inventory scan; the compound itself only happens when it returns
			   something. */
			if (CONFIG.jacko.enabled && jackoGroup()) {
				const j = await compoundJackos(true);
				jackoDuring.attempts += j.attempts;
				for (const L in (j.made || {})) jackoDuring.made[L] = (jackoDuring.made[L] || 0) + j.made[L];
			}
		} catch (e) {
			const why = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
			failures++;
			log('exchange refused (' + why + ')', 'orange');

			if (why === 'inventory_full') {
				const s = await sellChaff(soldTally);
				goldFromSales += s.gold;
				if (s.sold) { failures = 0; continue; }
				/* Selling found nothing, so try the other two rungs before giving
				   up - this is the precise stall the jacko work was added for. */
				if (CONFIG.jacko.enabled && jackoGroup()) {
					const j = await compoundJackos(true);
					jackoDuring.attempts += j.attempts;
					for (const L in (j.made || {})) jackoDuring.made[L] = (jackoDuring.made[L] || 0) + j.made[L];
					if (j.attempts) { failures = 0; continue; }
				}
				if (CONFIG.jacko.enabled && jackoToBank().length) {
					const n = await bankJackos(spot);
					if (n) { failures = 0; continue; }
				}
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

	/* AFTER the boxes, not during: the boxes are what produce the jackos, so
	   running the ladder first would work on a smaller pile for no reason. */
	let jacko = null;
	if (jackoDuring.attempts) {
		log('reclaimed slots during the run: ' + jackoDuring.attempts + ' compound(s)', '#8b98ab');
	}
	if (CONFIG.jacko.enabled) {
		try {
			/* Not quiet: this is the summary pass, and it is also what does the
			   banking when the bag never got tight enough to trigger it in-loop. */
			jacko = await compoundJackos();
			/* Gated on a nearly-full bag, as asked - a bank trip is not worth
			   making for one finished jacko while there is still room to work. */
			if (freeSlots() <= CONFIG.jacko.bankAtFreeSlots) {
				await bankJackos(spot);
			} else if (jackoToBank().length) {
				log(jackoToBank().length + ' finished jacko(s) held - ' + freeSlots()
					+ ' free slot(s), banking at ' + CONFIG.jacko.bankAtFreeSlots, '#8b98ab');
			}
		} catch (e) {
			log('jacko phase threw and was contained: ' + ((e && (e.reason || e.message)) || e), 'red');
		}
	}

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
try {
	parent.openGifts = openGifts; parent.sellChaff = sellChaff;
	parent.compoundJackos = compoundJackos; parent.bankJackos = bankJackos;
	parent.jackoCount = jackoCount;
} catch (e) { }

openGifts();
