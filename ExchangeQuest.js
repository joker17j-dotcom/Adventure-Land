// ExchangeQuest.js
// ExchangeQuest - exchanges the quest-routed exchangeables at their own NPCs - v1 (the complement of OpenGifts.js. Measured 2026-10-04 from the running client: 45 G.items entries carry an "e"; 10 of them also carry a "quest", and def.quest is exactly what routes an exchange away from G.maps.main.exchange. OpenGifts handles the 35 without one, less sixcake and 5bucks, which is the 33 it ships. These are the other 10, spread over 5 NPCs on 4 maps, so no single standing position can cover them. PASSIVE BY DESIGN: it never moves the character and never paths - it exchanges only what is already in range, which is what was asked for. TWO GROUPS ARE OFF BY DEFAULT AND SHOULD STAY OFF UNLESS YOU MEAN IT. lostearring is compoundable and its reward table is read as lostearring<level>: +0 gives one armorbox, while +4 gives the tier-3 h-set and tier-4 x-set, commented "~120m - 81X" in design/drops.js - exchanging a +0 throws away the bottom rung of a ladder worth about 120m at the top, so it is off, and when turned on it is additionally gated to level 4. cosmo0..cosmo5 are worth 4.1m to 44.8m each and exchange into cosmetic appearance unlocks, which is irreversible, so they are off too. seashell, leather and gemfragment are on: cheap stacked quest materials with ordinary reward tables.)

/* WHY THIS IS A SEPARATE SCRIPT AND NOT MORE OF OpenGifts.js
   OpenGifts works because all 33 of its items share one destination, so it can
   stand at main -25,-478 and drain the bag. These 10 do not share a
   destination. Measured positions, read from G.quests at runtime rather than
   hardcoded here so the script follows the creator if an NPC moves:

     quest        NPC               map         x,y          items
     cx           Haila             main        -361,-832    cosmo0..cosmo5
     seashell     Tristian          main        -1572,552    seashell     (e 20)
     leather      Landon            winterland  262,-48.5    leather      (e 40)
     gemfragment  Mine Heathcliff   tunnel      -264,-96     gemfragment  (e 50)
     lostearring  Wynifreed         mansion     0,-303       lostearring  (e 1)

   The server check is distance(player, G.quests[def.quest]) > B.sell_dist,
   and B.sell_dist is 400 on a normal server (server.js:178). The two places
   that raise it to ~10m are the HARDCORE and TEST servers only, so 400 is the
   real number for US/EU/ASIA. player.computer skips the check entirely -
   nobody on this account has one, so range genuinely matters here. */

/* The reward tables, read off design/drops.js, so the defaults below can be
   argued with rather than taken on trust:

     seashell     e20  -> basicelixir, 1e-6 vitscroll x10, 2e-5 fury
     leather      e40  -> cape (w 20), bcape (w 1), 0.5 armorbox
     gemfragment  e50  -> 0.5 gem0, t2stramulet, t2intamulet, t2dexamulet,
                          1e-5 fury
     lostearring  +0   -> one armorbox                         // 1 copy
                  +1   -> one weaponbox                        // 3 copies,  ~300k
                  +2   -> wbook1, 0.25 t2quiver                // 9 copies,  ~9.2m
                  +3   -> 0.5 fury, 5x handofmidas             // 27 copies, ~36m
                  +4   -> hhelmet/harmor/hpants/hgloves/hboots
                          + xhelmet/xarmor/xpants/xgloves/xboots
                                                               // 81 copies, ~120m
     cosmo0..5         -> cosmetic appearance unlocks only

   The gold figures in the lostearring rows are the creator's own comments in
   drops.js, not my estimates. harmor is on the gear plan, which is the other
   reason not to let a +0 go. */

const EQ_CONFIG = {

	/* Only these 10 names are exchangeable away from Xyn, and the set is closed -
	   it is every G.items entry with both an "e" and a "quest". Turning one on
	   here is the whole interface; there is nothing else to edit.

	   on:false items are skipped silently, not logged every tick. */
	items: {
		// stacked quest materials - safe to drain
		seashell: { on: true },
		leather: { on: true },
		gemfragment: { on: true },

		/* OFF DELIBERATELY. Compoundable, and the reward is read from the item's
		   LEVEL: lostearring0 is one armorbox, lostearring4 is the tier-3 and
		   tier-4 sets. minLevel 4 means that even if you flip this to true it
		   will not burn a low one. maxLevel 4 because drops.js defines
		   lostearring0..lostearring4 and nothing above - a level-5 earring would
		   resolve to a dropId with no table and come back "invalid". */
		lostearring: { on: false, minLevel: 4, maxLevel: 4 },

		/* OFF DELIBERATELY. 4.1m - 44.8m each, and the exchange yields cosmetic
		   unlocks. Irreversible, so this is a decision rather than a default. */
		cosmo0: { on: false },
		cosmo1: { on: false },
		cosmo2: { on: false },
		cosmo3: { on: false },
		cosmo4: { on: false },
		cosmo5: { on: false },
	},

	/* B.sell_dist, server.js:178. Not padded down: the server applies it at the
	   moment of the call, and a "distance" refusal is treated as transient below
	   rather than counted against the failure budget, so a character drifting at
	   the edge of range costs a retry and nothing else. */
	dist: 400,

	idleMs: 5000,        // nothing in range / nothing to do
	busyMs: 500,         // just exchanged - look again promptly, more may be queued
	waitMs: 1000,        // an exchange is already in progress server-side
	boundMs: 30000,      // hard ceiling on one await (see eqBound)
	maxFails: 3,         // consecutive hard failures before an item is parked
	quiet: false,        // true: only log exchanges and parks, not skips
};

/* Re-entrancy. The CODE slot can be re-saved while the old chain is still
   scheduled, which would leave two loops exchanging against each other and
   double-spending the in-progress check. Stop the previous one first. This also
   avoids the "Identifier already declared" class of failure by keeping every
   binding inside the closure below instead of at top level. */
(function () {
	'use strict';

	if (typeof window !== 'undefined' && typeof window.__eqStop === 'function') {
		try { window.__eqStop(); } catch (e) { }
	}

	let stopped = false;
	let timer = null;
	const fails = {};      // name -> consecutive hard failures
	const parked = {};      // name -> true once it has used up maxFails
	let lastNote = 0;

	function eqLog(msg, color) {
		try { game_log('[exchange] ' + msg, color || '#9FA8DA'); } catch (e) { }
		console.log('[exchange] ' + msg);
	}

	/* Throttled, for anything that would otherwise fire every tick. */
	function eqNote(msg) {
		if (EQ_CONFIG.quiet) return;
		if (Date.now() - lastNote < 60000) return;
		lastNote = Date.now();
		eqLog(msg);
	}

	/* CLAUDE.md: an awaited call that never settles ends a self-chained loop
	   permanently and silently. exchange() polls up to 30000 iterations of
	   sleep(1) internally, and in a background-throttled tab sleep(1) is clamped
	   to about a second - 30000 of those is over eight hours, which is a hang in
	   every sense that matters. Bound it and let the rejection land in the loop's
	   own catch, so the tick is lost and the chain is not. */
	function eqBound(p, label, ms) {
		return Promise.race([
			Promise.resolve(p),
			new Promise(function (_, reject) {
				setTimeout(function () { reject(new Error('eq-timeout:' + label)); }, ms);
			}),
		]);
	}

	/* typeof, never truthiness: referencing an undeclared identifier THROWS
	   rather than evaluating to undefined, and a ternary written as a guard is
	   itself what explodes. Measured 2026-10-04 in Dexon's CODE context:
	   exchange, distance, simple_distance, game_log, set_message and sleep are
	   all functions - but which helpers exist varies by context, so this still
	   checks rather than trusting that line. */
	function eqReady() {
		if (typeof character === 'undefined' || !character) return false;
		if (typeof exchange !== 'function') return false;
		if (typeof parent === 'undefined' || !parent || !parent.G) return false;
		return true;
	}

	/* Resolved from G, not from the table in the header comment. */
	function eqSpot(def) {
		try {
			const q = parent.G.quests[def.quest];
			if (!q || typeof q.x !== 'number' || typeof q.y !== 'number') return null;
			return q;
		} catch (e) { return null; }
	}

	function eqInRange(q) {
		if (character.map !== q.map) return false;
		if (q.in && character.in && character.in !== q.in) return false;
		const dx = (character.x || 0) - q.x;
		const dy = (character.y || 0) - q.y;
		return Math.sqrt(dx * dx + dy * dy) <= EQ_CONFIG.dist;
	}

	/* Mirrors the server's own check order (server.js, the "exchange" handler) so
	   the script never sends a call that is already known to fail:
	     invalid           - no def, no def.e, or no drop table for the dropId
	     item_locked       - item.l set
	     inventory_full    - esize <= 0 AND the stack is larger than 1
	     distance          - further than B.sell_dist from the quest spot
	     exchange_notenough- def.e > 1 and the stack is short of it
	   Returns the inventory index, or -1. */
	function eqFind() {
		const items = character.items || [];
		for (let i = 0; i < items.length; i++) {
			const it = items[i];
			if (!it) continue;

			const cfg = EQ_CONFIG.items[it.name];
			if (!cfg || !cfg.on || parked[it.name]) continue;

			let def = null;
			try { def = parent.G.items[it.name]; } catch (e) { }
			if (!def || !def.e || !def.quest) continue;

			if (it.l) continue;                                  // item_locked

			const need = def.e || 1;
			if ((it.q || 1) < need) continue;                    // exchange_notenough

			if ((character.esize || 0) <= 0 && (it.q || 1) !== 1) continue; // inventory_full

			/* Level-suffixed reward tables. The server builds the dropId as
			   name + (def.compound || def.upgrade ? item.level || 0 : ""), so for a
			   compoundable item the LEVEL picks the reward table outright. */
			if (def.compound || def.upgrade) {
				const lvl = it.level || 0;
				if (typeof cfg.minLevel === 'number' && lvl < cfg.minLevel) continue;
				if (typeof cfg.maxLevel === 'number' && lvl > cfg.maxLevel) continue;
			}

			const q = eqSpot(def);
			if (!q) continue;
			if (!eqInRange(q)) continue;                         // distance

			return i;
		}
		return -1;
	}

	/* A refusal the script should retry rather than hold against the item. */
	function eqTransient(reason) {
		return reason === 'distance'
			|| reason === 'exchange_existing'
			|| reason === 'inventory_full'
			|| reason === 'disconnected'
			|| reason === 'timeout';
	}

	function eqReason(err) {
		if (!err) return 'unknown';
		if (typeof err === 'string') return err;
		if (err.reason) return String(err.reason);
		if (err.message) return String(err.message);
		return 'unknown';
	}

	async function eqTick() {
		if (stopped) return;
		let next = EQ_CONFIG.idleMs;

		try {
			if (!eqReady()) {
				eqNote('waiting: character or exchange() not available in this context');
				next = EQ_CONFIG.idleMs;
			} else if (character.q && character.q.exchange) {
				/* Server-side exchange already running (3-6s, halved by massexchange,
				   divided by 10 by massexchangepp). Sending another would come back
				   exchange_existing. */
				next = EQ_CONFIG.waitMs;
			} else {
				const num = eqFind();
				if (num < 0) {
					next = EQ_CONFIG.idleMs;
				} else {
					const it = character.items[num];
					const name = it.name;
					const qty = it.q || 1;
					const lvl = it.level;

					let res = null;
					try {
						res = await eqBound(exchange(num), name, EQ_CONFIG.boundMs);
					} catch (err) {
						const reason = eqReason(err);
						if (eqTransient(reason)) {
							eqNote('retrying ' + name + ': ' + reason);
							next = EQ_CONFIG.waitMs;
						} else {
							fails[name] = (fails[name] || 0) + 1;
							eqLog('failed ' + name + ': ' + reason
								+ ' (' + fails[name] + '/' + EQ_CONFIG.maxFails + ')', '#EF9A9A');
							if (fails[name] >= EQ_CONFIG.maxFails) {
								parked[name] = true;
								eqLog('parking ' + name + ' for this session after '
									+ EQ_CONFIG.maxFails + ' failures - fix the cause, then reload',
									'#EF9A9A');
							}
							next = EQ_CONFIG.busyMs;
						}
						res = null;
					}

					if (res) {
						fails[name] = 0;
						const tag = name + (typeof lvl === 'number' ? '+' + lvl : '')
							+ (qty > 1 ? ' x' + Math.min(qty, 999) : '');
						if (res.success) {
							eqLog('exchanged ' + tag + ' -> ' + (res.reward || 'nothing'), '#A5D6A7');
						} else {
							/* exchange() resolved without success and without throwing -
							   a server refusal that came back as a plain response. Logged
							   rather than swallowed: "the call failed" and "the default was
							   fine" must never be indistinguishable. */
							const reason = eqReason(res.reason || res);
							if (eqTransient(reason)) {
								eqNote('retrying ' + tag + ': ' + reason);
							} else {
								fails[name] = (fails[name] || 0) + 1;
								eqLog('refused ' + tag + ': ' + reason
									+ ' (' + fails[name] + '/' + EQ_CONFIG.maxFails + ')', '#EF9A9A');
								if (fails[name] >= EQ_CONFIG.maxFails) {
									parked[name] = true;
									eqLog('parking ' + name + ' for this session', '#EF9A9A');
								}
							}
						}
						next = EQ_CONFIG.busyMs;
					}
				}
			}
		} catch (err) {
			/* The loop reschedules from its own catch, so a throw costs one tick. */
			console.error('[exchange] tick threw:', err);
			next = EQ_CONFIG.idleMs;
		}

		if (!stopped) timer = setTimeout(eqTick, next);
	}

	if (typeof window !== 'undefined') {
		window.__eqStop = function () {
			stopped = true;
			if (timer) { try { clearTimeout(timer); } catch (e) { } timer = null; }
		};
		/* Handles for poking at it from the console without editing the slot. */
		window.EQ = {
			config: EQ_CONFIG,
			fails: fails,
			parked: parked,
			unpark: function (name) { delete parked[name]; delete fails[name]; return true; },
			stop: function () { window.__eqStop(); return 'stopped'; },
			/* Why is nothing happening? Answers it for every enabled item at once. */
			why: function () {
				const out = [];
				if (!eqReady()) return ['not ready: character or exchange() missing'];
				for (const name in EQ_CONFIG.items) {
					const cfg = EQ_CONFIG.items[name];
					if (!cfg.on) { out.push(name + ': off in config'); continue; }
					if (parked[name]) { out.push(name + ': parked after failures'); continue; }
					let def = null;
					try { def = parent.G.items[name]; } catch (e) { }
					if (!def) { out.push(name + ': not in G.items'); continue; }
					const held = (character.items || []).filter(function (x) { return x && x.name === name; });
					if (!held.length) { out.push(name + ': none in bag'); continue; }
					const q = eqSpot(def);
					if (!q) { out.push(name + ': quest spot unresolved'); continue; }
					const near = eqInRange(q);
					const best = held.reduce(function (a, b) { return (b.q || 1) > (a.q || 1) ? b : a; });
					out.push(name + ': have ' + (best.q || 1) + '/' + (def.e || 1)
						+ (typeof best.level === 'number' ? ' at +' + best.level : '')
						+ ', ' + (near ? 'in range' : 'out of range of ' + q.map + ' ' + q.x + ',' + q.y));
				}
				return out;
			},
		};
	}

	eqLog('ExchangeQuest v1 up - passive, no movement. '
		+ Object.keys(EQ_CONFIG.items).filter(function (n) { return EQ_CONFIG.items[n].on; }).join(', ')
		+ ' enabled; cosmo0-5 and lostearring off by design. EQ.why() explains any idle.', '#80CBC4');

	timer = setTimeout(eqTick, 1000);
})();
