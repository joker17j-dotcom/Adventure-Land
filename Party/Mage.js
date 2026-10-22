// ==========================================================================
// MageofOz (Mage) - Mainframe slot CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom - v86
//
// CHANGELOG: read Party/MageChangelog.md in this repo. Do not put version
// history back in this file, and do not reconstruct it from git log - that
// file is the record. Prepend new entries there, newest first, never rewrite
// an old one, and bump the version on the line above in the same commit.
//
// CONSOLE COMMANDS - type these in the game console. They have no internal
// callers BY DESIGN; a static scan will report every one as dead and it is
// wrong. Do not delete them.
//   bossJoin(name)     join the named boss fight, bypassing the gate
//   bossHome()         abandon the boss trip and go back to the farm spot
//   bossStatus()       boss gate, current pick and trip state
//   mhStatus()         monster-hunt state for this character and the party
//   plStatus()         party-link state
//   rageStatus()       rage boxes on the current map
//   removeChestId(id)  drop one chest id from the persisted chest map
//   restockNow()       clear the potion-restock backoff so the next empty tick travels
//
// Also typeable, but these HAVE internal callers, so a dead-code scan
// would not flag them and they are listed for reference rather than
// protection:
//   restockStatus()  potion vendor, backoff and last attempt
//
// COMMENTS: a line ending "-> MageComments.md#anchor" is a SUMMARY, not the
// whole comment. The reasoning behind it - what was measured, what was tried
// and discarded, why a number is that number - lives in Party/MageComments.md
// under that anchor. Read it before changing the code it sits on. Many of
// those numbers were measured live rather than chosen, and several record a
// theory that turned out to be wrong; both are easy to tidy away if you only
// see the summary. When you change such a line, update its section there in
// the same commit and keep the pointer.
//
// SILENT LOAD FAILURE: a slot can be ACCEPTED by save_code and then never
// evaluated - the runner builds a frame where the character object exists and
// every script function is undefined, with nothing in the console and no
// exception anywhere. No size ceiling is established; if a deploy comes up
// empty with a clean console, bisect rather than trusting a number.
// -> Party/MerchantChangelog.md records the two builds that bracketed it.
// ==========================================================================

// ============================================================================
// COMPATIBILITY SHIM - Mainframe's sandboxed vm context doesn't expose the
// 'performance' global that a real browser tab (or plain Node.js) would.
// Every performance.now() call below is just for cooldown/cache-TTL timing
// at millisecond granularity, so Date.now() is a fully safe substitute -
// no behavior changes, just makes this actually load on Mainframe.
// ============================================================================
// --------------------------------------------------------------------------
// WHICH SCRIPT IS ACTUALLY RUNNING. Published to `parent` so a probe outside
// this file can answer that without reading the source.
//
// WHY THIS EXISTS, measured 2026-10-19: Dexon - a RANGER - was found running
// Party/Mage.js out of the Ranger slot, code_active, 4,219 lines against
// Ranger's 7,445. Nothing in these three files reached `parent` before this
// block, so from outside there was no way to tell. A VERSION NUMBER WOULD NOT
// HAVE CAUGHT IT: the slot header read v77, which is a real, valid, current
// version - just the wrong script's. It would have reported "the deploy took".
//
// So the signal is the set of functions the running build actually DEFINES.
// It cannot lie the way a transcribed number can, because every value below
// is a live `typeof` of the identifier beside it rather than a claim about
// it - a key whose function is absent is filtered out instead of published.
// The three scripts' key sets are disjoint, so one read names the script.
//
// SCOPE, so this is not read as more than it is. This answers WHICH SCRIPT,
// not WHICH VERSION. The list grows as features land, so a missing key means
// "older build, or nobody added the key" and those are not distinguishable.
// For version, feature-detect the specific function a build introduced, per
// CLAUDE.md "Deploying a code slot". Deliberately NO slot-header version read
// here: that reports what is in the SLOT, not what is executing, and under the
// load_code cache those differ - which is the one answer a deploy check must
// never get wrong. The slot buffer is readable directly from a tab anyway.
//
// THIS MARKER IS A CONVENIENCE, NOT THE AUTHORITY, AND THAT IS MEASURED.
// A parent.* global OUTLIVES THE SCRIPT THAT PUBLISHED IT: measured 2026-10-19,
// engaging a different slot swaps the running script immediately - no page
// reload - and parent.MERCHANT_VER still read 104 while OpenGifts was the thing
// executing. A confident false positive, which is the one answer a deploy check
// must never give. parent.PARTY_BUILD has exactly the same exposure.
//
// THE AUTHORITY IS PARTY_SCRIPT ITSELF, read inside the CODE context. It is a
// top-level const in this file - none of these scripts is IIFE-wrapped - so
// `typeof PARTY_SCRIPT !== 'undefined' && PARTY_SCRIPT` evaluated there answers
// from the live lexical scope, which is destroyed and rebuilt with the script
// and therefore cannot go stale. browser_code_eval already runs in that
// context. Read the global only from somewhere that is NOT the CODE context,
// and treat a disagreement between the two as the global being wrong.
//
// Tests/suite_features.js asserts every key resolves to a declaration in this
// same file, that each key is typeof'd against ITSELF, and that the three sets
// stay disjoint - so the list cannot drift into naming something that is not
// here. Keyed by character name so a probe sees WHO is running WHAT in one
// object, which is the exact shape of the Dexon failure. */
const PARTY_SCRIPT = 'Mage';
const PARTY_FEATURE_PROBE = {
	findEnergizeTarget: typeof findEnergizeTarget,
	handleEnergize: typeof handleEnergize,
	handleMagiport: typeof handleMagiport,
	handleBlinkEscape: typeof handleBlinkEscape,
	muleToMerchant: typeof muleToMerchant,
};

function publishPartyBuild() {
	const features = Object.keys(PARTY_FEATURE_PROBE)
		.filter((k) => PARTY_FEATURE_PROBE[k] === 'function')
		.sort();
	try {
		const who = (typeof character !== 'undefined' && character && character.name) || '?';
		/* REPLACED WHOLESALE, NEVER MERGED INTO. Engaging a different slot swaps
		   the running script immediately and leaves every parent.* global behind,
		   so merging would let a previous script's entry survive beside this one
		   and be read as current. Overwriting is what makes a party-to-party swap
		   self-correcting. `at` is the publish time: a reader comparing it with
		   how long the page has been up can see a marker that stopped being
		   refreshed, which is the only staleness this can signal by itself. */
		parent.PARTY_BUILD = {};
		parent.PARTY_BUILD[who] = { script: PARTY_SCRIPT, features: features, at: Date.now() };
	} catch (e) { }
	return features;
}
publishPartyBuild();

if (typeof performance === 'undefined') {
	globalThis.performance = { now: () => Date.now() };
}

// ============================================================================
// CONFIGURATION - Toggle features here instead of editing code.
// Built for MageofOz (mage, level 41 at time of writing). curse/mshield are
// priest/paladin-only. cburst/entangle/aether_shield/phaseout/arcane_needle
// all need a higher level than 41 - re-check G.skills[name].level and add
// them back in once castable.
// ============================================================================
// home/mobMap come from Dexon's 'farm_spot' CODE message, not hardcoded -
// start null until that arrives (see on_cm below).
let home = null;
let mobMap = null;
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
		const since = plCursor;
		const r = await plFetch(`/msg?to=${encodeURIComponent(plName())}&since=${since}`);
		/* The one failure a remembered cursor introduces: the bridge restarts,
		   its seq begins again at 0, and a cursor from the old numbering sits
		   above every new message - starving us in silence. Its own cursor
		   going backwards is the tell, and re-reading the window once is the
		   cheap, safe answer. */
		if (typeof r.cursor === 'number' && r.cursor < since) {
			plLog('bridge seq went backwards (' + since + ' -> ' + r.cursor + ') - it restarted; reading from 0', 'orange');
			plCursor = 0;
			plSaveCursor(0);
			return;
		}
		for (const m of (r.messages || [])) {
			// Straight into the script's existing handler, so relayed and in-game
			// messages take exactly the same path. plFirstTime drops whichever
			// copy arrives second.
			try { on_cm(m.frm, m.payload); } catch (e) { plLog('handler error: ' + e, 'orange'); }
			/* COMMITTED PER MESSAGE, which is the deliberate difference from
			   Merchant's per-BATCH commit. A batch-level commit cannot survive a
			   handler that reloads the page: change_server never returns, so the
			   cursor for the whole batch is never written and the window replays.
			   Per message, the only thing that can replay is the single message
			   that reloaded, and the acted-list below absorbs exactly that one.
			   The cost is the same one Merchant accepted in the other direction -
			   a message handled but not committed is re-read, never lost. */
			if (typeof m.seq === 'number' && m.seq > plCursor) {
				plCursor = m.seq;
				plSaveCursor(plCursor);
			}
		}
		/* r.cursor can run ahead of the last message addressed to us, since the
		   seq is shared with the other characters' traffic. */
		const end = Math.max(plCursor, Number(r.cursor) || 0);
		if (end !== plCursor) {
			plCursor = end;
			plSaveCursor(plCursor);
		}
	} catch (e) {
		plUp = false;
		plProbed = Date.now();
		plLog('bridge lost - send_cm only until it returns', 'orange');
	}
}

/* -- RELAY REPLAY PROTECTION ---------------------------------------
   change_server() RELOADS THE PAGE, and the reload resets plCursor to 0 and
   empties plSeen. The bridge serves everything newer than `since` for
   MESSAGE_TTL (10 minutes), so a character that hops comes back asking from
   0 and is handed the whole window again - including the message that made
   it hop, which makes it hop again.

   MEASURED on the live party 2026-10-18: FatherToken and MageofOz reloading
   in place on US V, each "hopping" to the shard it was already standing on,
   both cursors climbing 0 -> ~19,700 inside three minutes. Dexon was
   unaffected because he SENDS boss_hop and never receives it. The loop
   ended on its own only because the stale message aged out of the 10-minute
   window; the next hop would have re-armed it.

   Merchant hit the identical loop with potion requests on 2026-09-25 - 278
   to 10,563 mpot1 on one genuine request - and fixed it in v68. This is that
   fix ported, with one deliberate difference recorded at plPoll.
   CODE storage is the only state a hop cannot erase. */
const PL_CURSOR_KEY = 'pl_cursor';
const PL_ACTED_KEY = 'pl_acted';
const PL_ACTED_MAX = 20;

function plSaveCursor(n) {
	try { set(PL_CURSOR_KEY, n); }
	catch (e) { plLog('could not persist the relay cursor (' + n + ') - a hop will replay the backlog', 'red'); }
}
try { plCursor = Number(get(PL_CURSOR_KEY)) || 0; } catch (e) { plCursor = 0; }
if (plCursor) plLog('resuming the relay at seq ' + plCursor + ' - no backlog replay', '#7FD98A');

/* plSeen cannot do this job: it is in memory, and the whole problem is that
   the page dies between acting on a message and remembering that we did.
   Capped because it only has to outlive the MESSAGE_TTL window. */
function plActed(id) {
	if (!id) return false;
	try { return (get(PL_ACTED_KEY) || []).indexOf(id) !== -1; }
	catch (e) { plLog('acted-list read failed: ' + e, 'orange'); return false; }
}

function plMarkActed(id) {
	if (!id) return;
	try {
		const list = get(PL_ACTED_KEY) || [];
		if (list.indexOf(id) === -1) list.push(id);
		while (list.length > PL_ACTED_MAX) list.shift();
		set(PL_ACTED_KEY, list);
	} catch (e) { plLog('could not record ' + id + ' as acted - it may replay', 'red'); }
}

function plStatus() {
	return { bridge: plUp ? 'up' : 'off', cursor: plCursor, deduped: plSeen.size };
}

plProbe();
setInterval(plPoll, PARTY_LINK.pollMs);

const allBosses = ['bgoo', 'bscorpion', 'crabxx', 'dragold', 'ent', 'franky', 'greenjr', 'grinch', 'icegolem', 'jr', 'mrgreen', 'mrpumpkin', 'phoenix', 'rgoo', 'wabbit'];

/* -- TOGGLES -------------------------------------------------------
   Every on/off switch in this file, in one place, so flipping one does not
   mean hunting through CONFIG for it. Each is read ONCE, when CONFIG is
   constructed below, and the value still lives at its original CONFIG path -
   no read site changed, so `cfg.enabled` after `const cfg = CONFIG.x`
   resolves exactly as it did.

   EDITING A VALUE HERE AND RELOADING changes behaviour. ASSIGNING TO
   `TOGGLES` AT RUNTIME DOES NOT - the subsystem already copied the value.
   Runtime flips still go to the CONFIG path they always did, which is what
   the console commands above already do. */
const TOGGLES = {
	manaBurst:                  true,   // CONFIG.combat.manaBurst.enabled
	focusFire:                  true,   // CONFIG.combat.focusFire.enabled
	focusFireRequireInRange:    true,   // CONFIG.combat.focusFire.requireInRange
	movement:                   true,   // CONFIG.movement.enabled
	movementCircleWalk:         true,   // CONFIG.movement.circleWalk
	kiting:                     true,   // CONFIG.movement.kiting.enabled
	kitingAutoBySpeed:          true,   // CONFIG.movement.kiting.autoBySpeed
	kitingDisengageOnCourage:   true,   // CONFIG.movement.kiting.disengageOnCourage
	kitingDebug:                false,  // CONFIG.movement.kiting.debug
	energize:                   true,   // CONFIG.support.energize.enabled
	magiport:                   false,  // CONFIG.support.magiport.enabled
	blinkOnLowHp:               true,   // CONFIG.selfPreservation.blinkOnLowHp.enabled
	looting:                    true,   // CONFIG.looting.enabled
	equipmentAutoSwapSets:      true,   // CONFIG.equipment.autoSwapSets
	potionsAutoBuy:             true,   // CONFIG.potions.autoBuy
	partyAutoManage:            true,   // CONFIG.party.autoManage
	cohesion:                   true,   // CONFIG.party.cohesion.enabled
	cohesionDebug:              false,  // CONFIG.party.cohesion.debug
	temporal:                   true,   // CONFIG.temporal.enabled
	selling:                    false,  // CONFIG.selling.enabled
	bossEvents:                 true,   // CONFIG.bossEvents.enabled
	rageEntry:                  false,  // CONFIG.bossEvents.rageEntry.enabled
	bossEventsCooperativeOnly:  true,   // CONFIG.bossEvents.cooperativeOnly
	muling:                     true,   // CONFIG.muling.enabled
};

const CONFIG = {
	combat: {
		// Mana Burst dumps the ENTIRE mp pool as pure damage - only fire it
		// when mp is comfortably high, never as a reflex low-mp action.
		manaBurst: {
			enabled: TOGGLES.manaBurst,
			minMp: 1200,       // don't burst below this - keep some mp in reserve
			// home used to be baked in here, but it isn't known yet at load
			// time now - checked separately alongside this list wherever
			// it's consumed (see actionLoop's canBurst check).
			targets: [...allBosses],
		},
		/* Adopt Dexon's target rather than picking independently. Measured
		   2026-09-26: two distinct targets across three characters. Note
		   targetPriority below is NOT focus fire - it means "prefer monsters
		   already targeting the priest". */
		focusFire: { enabled: TOGGLES.focusFire, requireInRange: TOGGLES.focusFireRequireInRange },
		targetPriority: ['FatherToken'],
		allBosses,
	},

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
		enabled: TOGGLES.movement,
		circleWalk: TOGGLES.movementCircleWalk,
		circleRadius: 35,
		/* Kiting - new in v54. Mage.js had none at all, which left blinkOnLowHp as
		   his only answer to being hit, and that only fires at 25% hp - roughly a
		   second and a half of life at the incoming rate measured at cgoo on
		   2026-09-26, where he died. Kiting is the cheap half of the fix: he has
		   the longest range in the party (201) and outruns most things.

		   targets stays EMPTY deliberately. Ranger and Priest each carry a
		   hand-tuned bscorpion entry with measured hold distances; inventing one
		   for the mage would be guessing. The speed predicate picks bscorpion up
		   anyway (speed 24 against his 64) and derives the hold from its
		   weakness_aura radius of 100 rather than its 32 attack range. */
		kiting: {
			enabled: TOGGLES.kiting,
			targets: [],
			overrides: {},
			autoBySpeed: TOGGLES.kitingAutoBySpeed,
			speedRatio: 1.3,
			attackMargin: 15,
			/* Abandon the hold band once this many monsters target us. He died on
			   2026-09-26 bleeding 1,995 to 0 with ONE attacker while sitting at
			   59-95 against a 176 hold, unhealed because the rest of the party was
			   already down - so getting out matters more than holding station. */
			disengageOnCourage: TOGGLES.kitingDisengageOnCourage,
			disengageDistance: 60,
			rangeBuffer: 20,
			moveThrottle: 100,
			sampleAngles: 90,
			moveDistance: 30,
			repositionThreshold: 20,
			maxKiteRange: 400,
			debug: TOGGLES.kitingDebug
		},
	},

	support: {
		// Energize: buffs an ally's attack speed and tops up their mp.
		// Defaults to buffing Dexon (the ranger) since ranged aspd scales well
		// with this. Change target to FatherToken if you'd rather buff the
		// priest instead.
		energize: {
			enabled: TOGGLES.energize,
			target: 'Dexon',
			minSelfMp: 500, // don't energize if it would leave MageofOz too low
		},
		// Magiport pulls a named ally to MageofOz's location. It moves another
		// character without them asking for it in the moment, so it is opt-in:
		// the operator turns it on deliberately, for a reason.
		magiport: {
			enabled: TOGGLES.magiport,
			target: 'Dexon',
			triggerDistance: 2000, // only pull if they're this far away
		},
	},

	selfPreservation: {
		// Blink is a short teleport, used here purely to break away from
		// immediate danger. No offensive use.
		blinkOnLowHp: {
			enabled: TOGGLES.blinkOnLowHp,
			hpThreshold: 0.25, // blink away below 25% hp
		},
	},

	looting: {
		enabled: TOGGLES.looting,
		lootCooldown: 3000,
		// Bounds one pass so draining a backlog is not one unbroken socket chain.
		maxPerPass: 25
	},

	equipment: {
		autoSwapSets: TOGGLES.equipmentAutoSwapSets,
	},

	potions: {
		autoBuy: TOGGLES.potionsAutoBuy,
		hpThreshold: 400,
		mpThreshold: 500,
		minStock: 1000,

		/* The emergency restock is a walk to a vendor now, not a town() teleport
		   - see checkPotionEmergency(). These three bound it. restockTripMs caps
		   the walk, and it is minutes rather than seconds because desertland ->
		   Alia -> main is a real journey. restockBuyMs caps the purchase.
		   restockRetryMs is how long a failed trip is left alone, and that is the
		   one that matters: without it, a vendor we cannot reach becomes a trip
		   attempted on every single main tick, which is exactly the loop this
		   change is fixing. */
		restockTripMs: 180000,
		restockBuyMs: 15000,
		restockRetryMs: 60000,
	},

	party: {
		autoManage: TOGGLES.partyAutoManage,
		/* He cannot heal himself, so staying inside FatherToken's 197 heal range
		   is what keeps him alive. He died on 2026-09-26 bleeding 1,995 to 0
		   against ONE attacker with nobody in range to heal him. Moving toward
		   the centroid rather than at the leader keeps the group compact. */
		cohesion: { enabled: TOGGLES.cohesion, leash: 150, handoff: 400, stepMax: 120, stuckMs: 20000, debug: TOGGLES.cohesionDebug },
		groupMembers: ['Dexon', 'MageofOz', 'FatherToken']
	},

	// Shared with Ranger.js / Priest.js - keep this array identical across
	// all three scripts, since the rotation index is shared via localStorage.
	temporal: {
		enabled: TOGGLES.temporal,
		targetMob: 'bscorpion',
		skillName: 'temporalsurge',
		characters: ['FatherToken', 'Dexon', 'MageofOz'],
		storageKey: 'temporal_surge_rotation'
	},

	// Selling is left disabled - I don't know which mage drops you actually
	// want auto-sold. Fill in a whitelist and flip this on when you're ready.
	selling: {
		enabled: TOGGLES.selling,
		whitelist: [],
	},

	// Mirrors Ranger.js's mule behavior: send spare gold/items to Meltymerch,
	// via Dexon first (the collector) - same pattern as Priest.js.
	/* BOSS EVENTS - the operator's rule, 2026-09-30: cooperative bosses only,
	   fought from maximum range, never expecting the kill. -> bossTick */
	bossEvents: {
		enabled: TOGGLES.bossEvents,
	/* ENTERING THE RAGE BOX. Operator's ruling: "an issue with the override is
	   entering the rage box. That still needs to happen if enough people show
	   up to share the mummy attacks." Inert while `enabled` is off, and the
	   three numbers below are PROVISIONAL - nobody has measured a crowded
	   graveyard yet, so they are a starting point to be set from the
	   `attackersAtDeath` / `soakAtDeath` the trip record now carries, not
	   values anything was fitted to. */
	rageEntry: {
		enabled: TOGGLES.rageEntry,
		minSoaked: 6,            // monsters in the box held by non-party players
		holdMs: 20000,           // sustained for this long before we go in
		retreatAtAttackers: 3,   // on THIS character - meant to sit below courage
		trustMs: 15000,          // a follower falls out after this much silence
	},
		// G.monsters[x].cooperative - the game's own "credit is shared by damage
		// dealt" flag, and the only class of boss where chipping from range is a
		// strategy rather than a waste. An unknown monster is NOT cooperative.
		cooperativeOnly: TOGGLES.bossEventsCooperativeOnly,
		// abtesting is team PvP with a 120s join window, not a boss.
		// slenderman is excluded because he cannot be WALKED to, not because he is
		// not worth fighting. The server broadcasts his MAP and nothing else -
		// server_functions.js sends { name, map } for him where every other boss
		// also carries x/y - so bossWalkTarget() returns null and the trip latches
		// until the 20 min maxTripMs cap. Measured 2026-10-04: all three characters
		// latched within 120ms of his cooldown lapsing, Dexon 63ms after.
		// He also cannot be CHASED: event_loop re-checks him every second and warps
		// him to a random one of cave/halloween/spookytown whenever any non-invis
		// player on his map is within 600 units, whenever a projectile targets him,
		// or every 2 minutes regardless. Our range is 165. Approaching him is
		// itself what removes him. Ranger.js takes hits of opportunity instead.
		exclude: new Set(['abtesting', 'slenderman']),
		// Names admitted even when the flag says no. Empty by design.
		include: [],
		holdFraction: 0.92,     // of OUR range, when we cannot get outside theirs
		rangeMargin: 25,        // beyond THEIR range, when our reach allows it
		holdTolerance: 25,      // don't re-step for less than this
		maxTripMs: 20 * 60 * 1000,
		maxDeaths: 2,
		// After giving up on an event, leave it alone this long. Without it the
		// party walks straight back out to the boss that just outlasted it.
		cooldownMs: 30 * 60 * 1000,
		leaderName: 'Dexon',
		leaderTrustMs: 20000,
	},

	muling: {
		enabled: TOGGLES.muling,
		muleName: 'Dexon',
		fallbackMuleName: 'Meltymerch',
		goldReserve: 500000,
		excludeItems: new Set(['hpot1', 'mpot1', 'tracker', 'xptome']),
	},
};

// ============================================================================
// CONSTANTS
// ============================================================================
// CPU FIX: action was 1ms, so actionLoop() fired ~1000x/sec on every
// branch - no busy-wait here (unlike Ranger/Priest), but still needlessly
// tight for a CPU-quota-limited Mainframe microVM. Raised to 15ms; real
// attack/burst cooldowns are hundreds of ms minimum, so no real cost.
const TICK_RATE = { main: 100, action: 15, skill: 100, maintenance: 2000 };
const MERCHANT_WAIT_TIMEOUT_MS = 90000; // safety net if merchant_done never arrives (e.g. merchant died mid-summon)
const CACHE_TTL = 50;

const EVENT_LOCATIONS = [
	{ name: 'dragold', map: 'cave', x: 1150, y: -850 },
	{ name: 'mrgreen', map: 'spookytown', x: 610, y: 1000 },
	{ name: 'mrpumpkin', map: 'halloween', x: -222, y: 720 }
];


// ============================================================================
// STATE & CACHE
// ============================================================================
const state = {
	skinReady: true, // no mage skin changer - see removal note further down
	lastEnergize: 0,
	lastMagiport: 0,
	angle: 0,
	lastAngleUpdate: performance.now(),
	waitingForMerchant: false,
	waitingForMerchantSince: 0,
	restocking: false,
};

const cache = {
	target: null,
	energizeTarget: null,
	lastUpdate: 0,
	isValid() { return performance.now() - this.lastUpdate < CACHE_TTL; }
};


// destination is set directly from Dexon's 'farm_spot' message (see on_cm
// below).
let destination = null;

// ============================================================================
// OWN XP ECONOMICS - reports the current farm spot to Dexon for blacklisting
// if THIS character (not the party average) is net-negative on xp/hour for
// a sustained period. Same 3-consecutive-bad-samples hysteresis as Dexon's
// own checkFarmEconomics() (xp gain is bursty, so one quiet minute isn't
// evidence), but per-character - catches a spot the aggregate model rated
// fine but that's actually killing one specific character.
//
// resetXpTracker() (called from on_cm on a real home/mobMap change) fully
// clears the streak so an old spot's bad streak can't get blamed on a new
// one, and sampling doesn't start until arrival - otherwise travel time
// would unfairly count against the spot.
// ============================================================================
const xpTracker = {
	lastXp: character.xp,
	lastLevel: character.level,
	lastCheckTime: Date.now(),
	consecutiveBadSamples: 0,
	trackedHome: null,      // home/mobMap this tracker's state belongs to - null forces a reset on the first real assignment
	trackedMobMap: null,
	arrivedAtSpot: false,   // sticky once true for this assignment - a later trip to town doesn't restart the clock
	assignedAt: 0,
	reportedUnreachable: false,
};

// Called from on_cm whenever a genuinely new farm spot arrives (home or
// mobMap actually changed) - starts xp tracking fully fresh so a bad streak
// from the old spot can't carry over and get blamed on the new one.
function resetXpTracker() {
	xpTracker.trackedHome = home;
	xpTracker.trackedMobMap = mobMap;
	xpTracker.consecutiveBadSamples = 0;
	xpTracker.arrivedAtSpot = (character.map === mobMap); // already there - no travel needed
	xpTracker.assignedAt = Date.now();
	xpTracker.reportedUnreachable = false;
	noteTravelTarget(destination);
	xpTracker.lastXp = character.xp;
	xpTracker.lastLevel = character.level;
	xpTracker.lastCheckTime = Date.now();
}

function checkOwnXpEconomics() {
	if (!home || !mobMap) return; // no farm spot assigned yet - nothing to blacklist

	// Safety net: this file only ever assigns trackedHome/trackedMobMap via
	// resetXpTracker(), so a mismatch here means on_cm's reset didn't run
	// for some reason - catch up now rather than silently attributing
	// samples to the wrong spot.
	if (home !== xpTracker.trackedHome || mobMap !== xpTracker.trackedMobMap) {
		resetXpTracker();
		return;
	}

	if (!xpTracker.arrivedAtSpot) {
		if (character.map === mobMap) {
			// Just arrived - start the real sampling clock from here, not
			// from whenever the spot was assigned (which may have included
			// travel time).
			xpTracker.arrivedAtSpot = true;
			travelArrived();
			xpTracker.lastXp = character.xp;
			xpTracker.lastLevel = character.level;
			xpTracker.lastCheckTime = Date.now();
			return;
		}

		// Still traveling. Judge the spot on failed travel ATTEMPTS, never on
		// elapsed time: this loop is independent of the one that travels, so a
		// clock here counts shard hops, live events and vendor trips against a
		// spot nobody tried to walk to. Three real failures - each of which has
		// already fallen back through town() - and Dexon hears about it.
		noteTravelTarget(destination);
		travelWatchdog(destination);
		unstickWatchdog();
		/* ...and never while the monsters we were sent for are right here. A
		   radius can be mistuned; this cannot. -> travelAtDestination */
		if (!xpTracker.reportedUnreachable && travelState.failures >= TRAVEL.maxAttempts
			&& !get_nearest_monster({ type: home })) {
			xpTracker.reportedUnreachable = true;
			const detail = travelFailureDetail();
			game_log(`Can't route to ${home}@${mobMap} (${detail}) - reporting to Dexon for blacklist`, 'red');
			plSend('Dexon', {
				message: 'blacklist_spot',
				home,
				mobMap,
				reason: `${character.name} couldn't route to ${home}@${mobMap} - ${detail}`,
				details: {
					attempts: travelState.failures,
					lastError: travelState.lastError,
					stoppedAt: travelState.lastDistance,
					assignedSecAgo: xpTracker.assignedAt ? Math.round((Date.now() - xpTracker.assignedAt) / 1000) : null,
				},
			});
		}
		return;
	}

	const now = Date.now();
	const elapsedSec = (now - xpTracker.lastCheckTime) / 1000;
	/* OFF THE FARM MAP IS NOT A BAD SPOT. arrivedAtSpot is a one-way latch,
	   cleared only by a NEW assignment, so a boss trip, vendor run or potion
	   run keeps this clock running against a spot we are not standing on -
	   three quiet samples and the spot is reported for blacklisting. Re-baseline
	   instead, so time away is invisible rather than damning. The travel branch
	   above already learned this lesson; the sampling branch never did. */
	if (character.map !== mobMap) {
		xpTracker.lastXp = character.xp;
		xpTracker.lastLevel = character.level;
		xpTracker.lastCheckTime = Date.now();
		return;
	}
	if (elapsedSec < 60) return; // sample roughly once a minute

	let xpGained;
	if (character.level > xpTracker.lastLevel) {
		// Leveled up during this window - character.xp resets at each
		// level, so a naive (current - previous) delta would read as a
		// huge false negative. Reconstruct the real total gained: finish
		// out the level we started the window on, add any full levels
		// passed through, then add however far into the current level we
		// are now. Multi-level-ups within one 60s window are rare, but
		// this handles them correctly rather than just the common
		// single-level case.
		let total = (G.levels[xpTracker.lastLevel] || 0) - xpTracker.lastXp;
		for (let lvl = xpTracker.lastLevel + 1; lvl < character.level; lvl++) {
			total += G.levels[lvl] || 0;
		}
		xpGained = total + character.xp;
	} else {
		xpGained = character.xp - xpTracker.lastXp; // can be negative - death xp loss with no offsetting kills this window
	}

	const xpPerSecond = xpGained / elapsedSec;

	if (xpPerSecond <= 0) {
		xpTracker.consecutiveBadSamples++;
		if (xpTracker.consecutiveBadSamples >= 3) {
			game_log(`Net-negative xp for ${xpTracker.consecutiveBadSamples} consecutive minutes at ${home}@${mobMap} - reporting to Dexon for blacklist`, 'red');
			plSend('Dexon', {
				message: 'blacklist_spot',
				home,
				mobMap,
				reason: `${character.name} net-negative xp/hr (${xpPerSecond.toFixed(2)} xp/s over ${xpTracker.consecutiveBadSamples} min)`,
			});
			xpTracker.consecutiveBadSamples = 0; // reset so we don't spam repeated reports for the same spot while waiting on Dexon to react
		}
	} else {
		xpTracker.consecutiveBadSamples = 0; // one good sample clears the streak
	}

	xpTracker.lastXp = character.xp;
	xpTracker.lastLevel = character.level;
	xpTracker.lastCheckTime = now;
}

// ============================================================================
// EQUIPMENT - built from MageofOz's actual equipped items, not guessed gear.
// Verify slot/level values against current inventory before relying on this;
// re-run mainframe_get_character('MageofOz') if you've re-geared since.
// ============================================================================
const equipmentSets = {
	current: [
		{ itemName: "mushroomstaff", slot: "mainhand", level: 4, l: "l" },
		{ itemName: "wcap", slot: "helmet", level: 4, l: "l" },
		{ itemName: "wattire", slot: "chest", level: 4, l: "l" },
		{ itemName: "wbreeches", slot: "pants", level: 4, l: "l" },
		{ itemName: "wshoes", slot: "shoes", level: 3, l: "l" },
		{ itemName: "wgloves", slot: "gloves", level: 4, l: "l" },
		{ itemName: "intamulet", slot: "amulet", level: 0, l: "l" },
	],
};

// ============================================================================
// CORE UTILITIES
// ============================================================================
/* COOPERATIVE BOSSES THAT allBosses DOES NOT LIST. Derived from
   G.monsters[x].cooperative on 2026-10-02: 19 cooperative monsters exist and
   allBosses names 13 of them, so without these six this file does not recognise
   a snowman, a tiger or a Rime Djinn as a boss at all.

   Added HERE rather than to allBosses on purpose. allBosses also feeds
   CONFIG.combat.manaBurst.targets, which decides what Mana Burst fires at, and widening it would change that too -
   a different decision from this one. */
const BOSS_SET = new Set([...allBosses,
	'pinkgoo', 'rharpy', 'rimedjinn', 'slenderman', 'snowman', 'tiger']);

function updateCache() {
	if (!cache.isValid()) {
		cache.target = findBestTarget();
		cache.energizeTarget = findEnergizeTarget();
		cache.lastUpdate = performance.now();
	}
}

/* Wrapped so every path out of the picker passes the rage hold-fire test;
   there are four returns inside and guarding one of them would have been a
   hole. -> rageHoldFire */
function findBestTarget() { return rageFilterTarget(findBestTargetInner()); }
function findBestTargetInner() {
	/* Focus fire first - everything below picks independently. */
	const shared = focusFireTarget();
	if (shared) return shared;

	/* ENGAGE A COOPERATIVE BOSS ONLY ONCE SOMEBODY ELSE IS ON IT.
	   `boss.target` is the whole test, and it mirrors the ranger's
	   attackIfTargeted, which resolves to the same `mob.target != null`.
	   Credit on a cooperative boss is shared by damage dealt, so joining a
	   fight in progress pays and opening one alone does not.
	   -> MageComments.md#engage-a-cooperative-boss-only-once-somebody */
	for (const bossType of BOSS_SET) {
		const boss = get_nearest_monster_v2({ type: bossType, max_distance: character.range });
		if (boss && boss.target) return boss;
	}

	// Protect whoever's named in targetPriority - attack whatever is
	// currently targeting them, same semantics as Ranger.js's COMBAT_SETS.
	const priorityNames = CONFIG.combat.targetPriority;
	if (priorityNames?.length) {
		const protectTarget = get_nearest_monster_v2({ target: priorityNames, max_distance: character.range });
		if (protectTarget) return protectTarget;
	}

	return home ? get_nearest_monster({ type: home }) : null;
}

function findEnergizeTarget() {
	const cfg = CONFIG.support.energize;
	if (!cfg.enabled) return null;
	const ally = get_player(cfg.target);
	if (!ally || ally.rip) return null;
	return ally;
}

// Adapted from Ranger.js/Priest.js's get_nearest_monster_v2 helper.
function get_nearest_monster_v2(args = {}) {
	let min_d = 999999;
	let target = null;

	for (let id in parent.entities) {
		let current = parent.entities[id];
		if (current.type !== 'monster' || !current.visible || current.dead) continue;

		if (args.type) {
			if (Array.isArray(args.type)) {
				if (!args.type.includes(current.mtype)) continue;
			} else if (current.mtype !== args.type) continue;
		}

		if (args.target && !args.target.includes(current.target)) continue;

		const c_dist = parent.distance(character, current);
		if (args.max_distance !== undefined && c_dist > args.max_distance) continue;

		if (c_dist < min_d) { min_d = c_dist; target = current; }
	}

	return target;
}

// ============================================================================
// MAIN TICK LOOP
// ============================================================================
// ============================================================================
// AWAIT HANG GUARD
// ============================================================================
// Every loop below is an async function that schedules its own next tick only
// after its body resolves. A THROW is already handled - each loop reschedules
// from its catch, or after it. A HANG is not: if an awaited call never
// settles, execution never reaches the reschedule and the chain simply ends,
// silently and permanently. setInterval work (buffs, loot, party keepalives)
// keeps running, so the character still looks alive on /hub while doing
// nothing at all.
// -> MageComments.md#main-tick-loop
const HANG_GUARD = {
	defaultMs: 10000,
	logEveryMs: 30000,   // the guard must log, or "hung" and "idle" look identical
};
let lastHangLogAt = 0;

function noHang(p, label, ms) {
	if (!p || typeof p.then !== 'function') return Promise.resolve(p);
	const limit = ms || HANG_GUARD.defaultMs;
	let timer = null;
	return Promise.race([
		Promise.resolve(p).finally(() => clearTimeout(timer)),
		new Promise((_, reject) => {
			timer = setTimeout(() => {
				const now = Date.now();
				if (now - lastHangLogAt >= HANG_GUARD.logEveryMs) {
					lastHangLogAt = now;
					game_log(`"${label}" did not settle in ${Math.round(limit / 1000)}s - dropping this tick`, 'orange');
				}
				reject(new Error(`hang guard: ${label}`));
			}, limit);
		}),
	]);
}

/* ---------------------------------------------------------------------------
   KITE TARGET SELECTION - identical shape in Ranger.js / Priest.js / Mage.js.

   Two independent paths into "should this be kited", deliberately separate:
   -> MageComments.md#kite-target-selection-identical-shape-in-ranger */
function kiteThreatRadius(mdef) {
	if (!mdef) return 0;
	let r = mdef.range || 0;
	const ab = mdef.abilities;
	if (ab) {
		for (const k in ab) {
			const a = ab[k];
			if (a && a.aura && typeof a.radius === 'number' && a.radius > r) r = a.radius;
		}
	}
	return r;
}

function kiteCandidateTypes(cfg) {
	const out = new Set(cfg.targets || cfg.avoidTypes || []);
	if (!cfg.autoBySpeed) return [...out];
	const G = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	if (!G || !G.monsters || typeof parent === 'undefined' || !parent.entities) return [...out];
	const mySpeed = character.speed || 0;
	const reach = (character.range || 0) - (cfg.attackMargin || 0);
	const ratio = cfg.speedRatio || 1.3;
	const buffer = cfg.rangeBuffer || 0;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (out.has(e.mtype)) continue;
		const mdef = G.monsters[e.mtype];
		if (!mdef) continue;
		if (mySpeed <= (mdef.speed || 0) * ratio) continue;
		if (kiteThreatRadius(mdef) + buffer > reach) continue;
		out.add(e.mtype);
	}
	return [...out];
}

function kiteBand(mtype, cfg) {
	const reposition = cfg.repositionThreshold || 20;
	const ov = (cfg.overrides || {})[mtype];
	if (ov) {
		const minD = ov.minDistance, optD = ov.optimalDistance;
		return { minD, optD, maxD: ov.maxDistance != null ? ov.maxDistance : Math.max(optD + reposition, minD + 10) };
	}
	const G = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	const minD = kiteThreatRadius((G && G.monsters) ? G.monsters[mtype] : null) + (cfg.rangeBuffer || 0);
	const maxD = Math.max(minD + 10, (character.range || 0) - 5);
	return { minD, optD: Math.max(minD + 5, maxD - reposition), maxD };
}

/* ---------------------------------------------------------------------------
   KITING - new in v54, ported from Ranger.js rangedKite() so all three files
   hold distance the same way. Attacks live in actionLoop, movement in mainLoop,
   so holding distance costs no attack uptime: a ranged character in this game
   attacks while moving. That is what makes this free under the party's standing
   rule - safety is preferred unless it costs exp/hr, and here it costs nothing.
   --------------------------------------------------------------------------- */
/* ---------------------------------------------------------------------------
   THREAT FIELD - added v59/v32/v55, after measurement.
   -> MageComments.md#threat-field-added-v59-v32-v55-after */

/* Every monster within reach that matters, with its own danger radius. */
function kiteThreats(cfg, types) {
	const set = (types && types.length) ? new Set(types) : null;
	const cx = character.real_x, cy = character.real_y;
	const buffer = cfg.rangeBuffer || 0;
	const reach = cfg.avoidRadius || cfg.maxKiteRange || 400;
	const G = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	const out = [];
	if (!G || !G.monsters || !parent.entities) return out;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (set && !set.has(e.mtype)) continue;
		const ex = (e.real_x != null ? e.real_x : e.x) || 0;
		const ey = (e.real_y != null ? e.real_y : e.y) || 0;
		const d = Math.hypot(ex - cx, ey - cy);
		if (d > reach) continue;
		const r = kiteThreatRadius(G.monsters[e.mtype]) + buffer;
		out.push({ x: ex, y: ey, r: r, d: d, danger: d < r, mtype: e.mtype });
	}
	return out;
}

/* How many monsters are targeting us. Compared against character.courage, which
   is the count tolerated before fear starts and actions stop. */
function kiteAttackerCount() {
	let n = 0;
	if (typeof parent === 'undefined' || !parent.entities) return n;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e && e.type === 'monster' && !e.dead && e.target === character.id) n++;
	}
	return n;
}

/* Signed, urgency-weighted distance gained across the whole threat field.

   Two deliberate differences from the gain-only version in Priest.js: a
   candidate that escapes one monster and walks into another is PENALISED rather
   than merely un-rewarded, and threats we are already deep inside weigh more
   than ones at the edge of their radius. Without the sign, "away from the
   nearest" and "into the other ten" score the same, which is the bug. */
function kiteMultiWeight(threats, px, py) {
	let w = 0;
	for (const t of threats) {
		if (!t.danger) continue;
		const dp = Math.hypot(px - t.x, py - t.y);
		const urgency = Math.max(1, t.r - t.d);
		w += (dp - t.d) * urgency;
	}
	return w;
}

/* Direction that points away from the whole field, for the ladder's base angle.
   Sum of unit vectors away from each threat in danger range; null when nothing
   is pressing, in which case the caller falls back to away-from-target. */
function kiteRepulsionAngle(threats) {
	const cx = character.real_x, cy = character.real_y;
	let vx = 0, vy = 0, any = false;
	for (const t of threats) {
		if (!t.danger) continue;
		const dx = cx - t.x, dy = cy - t.y;
		const m = Math.hypot(dx, dy) || 1;
		vx += dx / m; vy += dy / m; any = true;
	}
	if (!any || (vx === 0 && vy === 0)) return null;
	return Math.atan2(vy, vx);
}

/* Last-resort escape: escalating angles, then shorter steps.

   Borrowed in shape from the older Party.js handleKiting, which tried a fixed
   ladder first-fit and so always produced SOME move, where the scored sampler
   could find nothing and stand still. Two corrections to that original: it
   stopped at +-PI, i.e. straight into what it was fleeing, so this stops at
   +-120 degrees; and it never retried a shorter step, so a wall 30 units out
   blocked every candidate when 10 units of room existed. */
const KITE_LADDER = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3,
                     Math.PI / 2, -Math.PI / 2, 2 * Math.PI / 3, -2 * Math.PI / 3];
const KITE_STEP_FRACTIONS = [1, 0.5, 0.25];

function kiteLadderEscape(baseAngle, mag) {
	if (baseAngle == null) return null;
	const cx = character.real_x, cy = character.real_y;
	for (const frac of KITE_STEP_FRACTIONS) {
		const m = Math.max(6, mag * frac);
		for (const off of KITE_LADDER) {
			const a = baseAngle + off;
			const tx = cx + Math.cos(a) * m, ty = cy + Math.sin(a) * m;
			if (can_move_to(tx, ty)) return { x: tx, y: ty, mag: m, off: off };
		}
	}
	return null;
}

/* Distance from a threat to the straight-line move we are considering, not just
   to its endpoint. Added after the v59 harness caught endpoint-only scoring
   choosing a route THROUGH a monster: from inside a pack, the candidate 30 units
   past a mob sitting 10 units away scores as "10 units gained" while the path
   walks over it. Priest.js has tangent cones for this; Ranger and Mage had
   nothing at all. */
function kiteSegDist(px, py, qx, qy, tx, ty) {
	const dx = qx - px, dy = qy - py;
	const L2 = dx * dx + dy * dy;
	let u = L2 ? ((tx - px) * dx + (ty - py) * dy) / L2 : 0;
	u = u < 0 ? 0 : (u > 1 ? 1 : u);
	return Math.hypot(tx - (px + u * dx), ty - (py + u * dy));
}


/* ---------------------------------------------------------------------------
   COHESION, FOCUS FIRE AND THE ROUTE PENALTY - v60/v33/v56.

   The v59 measurement said the kiting work was treating a symptom. Two findings
   from the same window settled it:
   -> MageComments.md#cohesion-focus-fire-and-the-route-penalty */

/* Route incursion as a PENALTY rather than a veto.

   v59 vetoed any candidate whose path closed on a threat. Measured offline
   against the real geometry: with 4 cgoo at 20 units, 180 of 180 candidates
   passable and ZERO survived the veto; with 11 scattered at 25-70 units, again
   zero. So in the only situation that actually kills - being inside the pack -
   the whole-field scorer never ran, and every decision fell through to the
   crude ladder. A penalty keeps the ranking intact so the scorer can still pick
   the least-bad route when no clean one exists. */
function kitePathPenalty(threats, px, py) {
	const cx = character.real_x, cy = character.real_y;
	let pen = 0;
	for (const t of threats) {
		const dmin = kiteSegDist(cx, cy, px, py, t.x, t.y);
		const floor = Math.min(t.d, t.r) * 0.9;
		if (dmin < floor) pen += (floor - dmin) * Math.max(1, t.r - t.d) * 3;
	}
	return pen;
}

/* The leader's current target, when we are a follower and it is worth sharing.
   Returns null for the leader itself, so this is safe to call anywhere. */
function focusFireTarget() {
	const cfg = (CONFIG.combat && CONFIG.combat.focusFire) || {};
	if (cfg.enabled === false) return null;
	const group = (CONFIG.party && CONFIG.party.groupMembers) || [];
	const leaderName = group[0];
	if (!leaderName || leaderName === character.name) return null;
	if (typeof parent === 'undefined' || !parent.entities) return null;
	const leader = parent.entities[leaderName];
	if (!leader || !leader.target) return null;
	const t = parent.entities[leader.target];
	if (!t || t.type !== 'monster' || t.dead) return null;
	if (cfg.requireInRange !== false && !is_in_range(t)) return null;
	return t;
}

/* Close on the party when we drift out of heal range.

   Moves toward the CENTROID of the other members rather than at the leader, so
   the priest settles between the two he has to reach instead of hugging one and
   losing the other. Leader-exempt: Dexon drives the farm spot, and a leader that
   chases his own followers never arrives anywhere. */
async function holdCohesion() {
	const cfg = (CONFIG.party && CONFIG.party.cohesion) || {};
	if (!cfg.enabled) return false;
	const group = (CONFIG.party.groupMembers || []);
	if (group[0] === character.name) return false;
	if (typeof parent === 'undefined' || !parent.entities) return false;

	let fx = 0, fy = 0, n = 0, worst = 0;
	let leaderSeen = false;
	for (const nm of group) {
		if (nm === character.name) continue;
		/* Entity first - it is fresher - then party data. parent.entities holds
		   only what is ON SCREEN, so the member we have drifted away from is
		   exactly the one that drops out of it, and the old code removed him from
		   the centroid at the moment this function existed to close on him.
		   Measured 2026-09-29: Dexon was absent from MageofOz's entities on 55 of
		   55 samples while parent.party still carried his coordinates, leaving two
		   stranded followers homing on each other. */
		const e = parent.entities[nm];
		const p = (parent.party || {})[nm];
		let ex, ey;
		if (e && !e.rip) {
			ex = (e.real_x != null ? e.real_x : e.x) || 0;
			ey = (e.real_y != null ? e.real_y : e.y) || 0;
		} else if (p && p.x != null && (p.map || p.in) === character.map) {
			ex = p.x; ey = p.y;
		} else continue;
		if (nm === group[0]) leaderSeen = true;
		const d = Math.hypot(ex - character.real_x, ey - character.real_y);
		if (d > worst) worst = d;
		fx += ex; fy += ey; n++;
	}
	/* THE PARTY'S ANCHOR IS THE LEADER. Cross-map he is in neither
	   parent.entities (off-screen) nor the parent.party fallback (gated on
	   same map), so the centroid collapses to the OTHER follower and the two
	   of them home on each other. Closing on a fellow follower was never the
	   intent of this function. */
	if (!leaderSeen) return false;
	if (!n || worst <= (cfg.leash || 150)) return false;

	/* Past this gap, hand the trip to the pathfinder and do not touch movement.

	   xmove is a straight line: over a long gap it stops at the first wall, and
	   it INTERRUPTS any smart_move already running. Worse, returning true here
	   made mainLoop skip handleReturnHome(), the only path that pathfinds, counts
	   failures and arms travelWatchdog - so the further out we drifted, the more
	   certain it was that the one function able to fetch us would not run.
	   -> see the v34/v57 header note for the 43-minute measurement. */
	if (worst > (cfg.handoff || 400)) {
		if (cfg.debug) game_log('Cohesion: ' + Math.round(worst) + 'u - handing off to travel', '#7FD1FF');
		handleReturnHome();
		return true;
	}

	fx /= n; fy /= n;
	const a = Math.atan2(fy - character.real_y, fx - character.real_x);
	const gap = Math.hypot(fx - character.real_x, fy - character.real_y);
	const step = Math.max(20, Math.min(cfg.stepMax || 120, gap - (cfg.leash || 150) * 0.5));

	/* ASK WHETHER THE NUDGE IS POSSIBLE BEFORE EMITTING IT, AND NEVER REPEAT AN
	   IMPOSSIBLE ONE. The straight line can run into a wall, and when it did this
	   function retried the IDENTICAL unreachable destination for as long as the
	   character stayed wedged.
	   -> MageComments.md#ask-whether-the-nudge-is-possible-before */
	let picked = null;
	if (typeof can_move_to === 'function') {
		for (const spread of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
			const tx = character.real_x + Math.cos(a + spread) * step;
			const ty = character.real_y + Math.sin(a + spread) * step;
			if (can_move_to(tx, ty)) { picked = [tx, ty]; break; }
		}
	} else {
		/* typeof, never truthiness: referencing an absent helper THROWS, and a
		   ternary written as a guard is itself what explodes. -> CLAUDE.md */
		picked = [character.real_x + Math.cos(a) * step, character.real_y + Math.sin(a) * step];
	}

	if (!picked) {
		if (cfg.debug) game_log('Cohesion: ' + Math.round(worst) + 'u but walled off in every direction - handing off to travel', '#7FD1FF');
		handleReturnHome();
		return true;
	}

	/* A REJECTION HERE MUST NOT ESCAPE. mainLoop awaits this inside
	   noHang(holdCohesion(), 'holdCohesion'), so a throw does not merely abandon
	   the nudge - it loses the ENTIRE mainLoop tick, and everything below this
	   call, kiting included, is skipped with it. At the measured rate that was
	   every three seconds for as long as the character stayed stuck. Returning
	   false rather than true is deliberate and is v57's lesson restated: a true
	   means "movement handled" and hides handleReturnHome(), the one path that
	   pathfinds, counts failures and arms travelWatchdog. It logs unthrottled
	   because a silent default leaves "the move is impossible" and "the move
	   worked" indistinguishable. */
	try {
		await safeMove(picked[0], picked[1]);
	} catch (e) {
		game_log('Cohesion: xmove to ' + Math.round(picked[0]) + ',' + Math.round(picked[1])
			+ ' failed (' + ((e && (e.reason || e.message)) || e) + ') - leaving the trip to travel', 'orange');
		return false;
	}
	if (cfg.debug) game_log('Cohesion: closing ' + Math.round(worst) + 'u to party', '#7FD1FF');
	return true;
}

async function rangedKite() {
	const cfg = CONFIG.movement.kiting;
	if (!cfg || !cfg.enabled) return false;
	const types = kiteCandidateTypes(cfg);
	if (!types.length) return false;

	const threats = kiteThreats(cfg, types);
	const attackers = kiteAttackerCount();
	const courage = character.courage || 2;
	const disengage = cfg.disengageOnCourage !== false && attackers >= courage;

	if (smart.moving) {
		if (!disengage) return false;
		try { if (typeof stop === 'function') stop(); } catch (e) {}
	}

	const target = get_nearest_monster_v2({ type: types, max_distance: cfg.maxKiteRange });
	if (!target && !disengage) return false;

	const cx = character.real_x, cy = character.real_y;
	const band = target ? kiteBand(target.mtype, cfg) : null;
	const dist = target ? Math.hypot(target.real_x - cx, target.real_y - cy) : 0;

	/* reason 4 is disengage - the band is abandoned, not adjusted. */
	let reason = 0, need = 0;
	if (disengage) { reason = 4; need = cfg.disengageDistance || cfg.moveDistance; }
	else if (dist < band.minD) { reason = 1; need = band.optD - dist; }
	else if (dist > band.maxD) { reason = 2; need = dist - band.optD; }
	else if (Math.abs(dist - band.optD) > cfg.repositionThreshold) { reason = 3; need = Math.abs(dist - band.optD); }
	if (!reason) return true;

	const now = performance.now();
	if (now - rangedKite.lastMove <= cfg.moveThrottle) return true;

	const multi = (reason === 1 || reason === 4);
	const baseMag = Math.max(6, Math.min(cfg.moveDistance, Math.abs(need)));
	const step = Math.PI / cfg.sampleAngles, n = cfg.sampleAngles * 2;
	let bestW = -Infinity, bestX = 0, bestY = 0, found = false;
	for (const frac of KITE_STEP_FRACTIONS) {
		const mag = Math.max(6, baseMag * frac);
		for (let i = 0, a = 0; i < n; i++, a += step) {
			const tx = cx + mag * Math.cos(a), ty = cy + mag * Math.sin(a);
			if (!can_move_to(tx, ty)) continue;
			/* Route cost, not a veto - the veto eliminated every candidate whenever
			   we were inside the pack, which is the only case that kills. */
			let w;
			if (multi) w = kiteMultiWeight(threats, tx, ty) - kitePathPenalty(threats, tx, ty);
			else {
				const nd = Math.hypot(target.real_x - tx, target.real_y - ty);
				w = reason === 2 ? dist - nd : Math.abs(dist - band.optD) - Math.abs(nd - band.optD);
				if (nd < band.minD || nd > band.maxD) w -= 1000;
			}
			if (w > bestW) { bestW = w; bestX = tx; bestY = ty; found = true; }
		}
		if (found) break;
	}

	const awayAngle = (function () {
		const r = kiteRepulsionAngle(threats);
		if (r != null) return r;
		return target ? Math.atan2(cy - target.real_y, cx - target.real_x) : null;
	})();

	if (!found) {
		const esc = kiteLadderEscape(awayAngle, baseMag);
		if (esc) { bestX = esc.x; bestY = esc.y; found = true; }
	}

	if (!found) {
		if (attackers < courage && awayAngle != null) {
			const far = Math.max(cfg.moveDistance, 60);
			await safeMove(cx + Math.cos(awayAngle) * far, cy + Math.sin(awayAngle) * far);
			rangedKite.lastMove = now;
			if (cfg.debug) game_log('Kiting: pathfinder fallback', '#FFA500');
			return true;
		}
		return false;
	}

	await safeMove(bestX, bestY);
	rangedKite.lastMove = now;
	if (cfg.debug) game_log(`Kiting ${target ? target.mtype : 'field'}: r${reason} att${attackers} (${Math.round(dist)} \u2192 ${Math.round(Math.hypot(target.real_x - bestX, target.real_y - bestY))}, band ${Math.round(band.minD)}-${Math.round(band.maxD)})`, '#FFA500');
	return true;
}
rangedKite.lastMove = 0;

async function mainLoop() {
	try {
		/* Containment first, and the pull owns movement while it runs - the same
		   stand-down shape as sellingOff and mhBusy below. ragePullTick is NOT
		   awaited: a pull is two round trips and mainLoop is wrapped in the 10s
		   HANG_GUARD, which is exactly the trap restockTrip was detached to avoid. */
		if (await rageGuard()) return setTimeout(mainLoop, 250);
		if (ragePull.busy || rageNav.busy) return setTimeout(mainLoop, 250);
		if (ragePullActive()) ragePullTick().catch(e => rageLog('pull tick threw: ' + (e && e.message || e), 'red'));
		if (is_disabled(character)) return setTimeout(mainLoop, 250);
		if (state.waitingForMerchant) {
			if (Date.now() - state.waitingForMerchantSince > MERCHANT_WAIT_TIMEOUT_MS) {
				state.waitingForMerchant = false;
				game_log('Gave up waiting on the merchant - resuming on my own', 'red');
			} else {
				return setTimeout(mainLoop, 250);
			}
		}
		/* A Daisy trip owns movement. Same shape as the merchant wait: stand down
		   until it finishes, and it always finishes - mhGoDaisy is noHang-bounded. */
		if (mhBusy) return setTimeout(mainLoop, 250);
		if (await noHang(checkPotionEmergency(), 'checkPotionEmergency')) {
			return setTimeout(mainLoop, TICK_RATE.main);
		}
		if (!home || !mobMap || !destination) {
			return setTimeout(mainLoop, 250); // haven't heard from Dexon yet
		}

		updateCache();

		if (CONFIG.looting.enabled) await noHang(handleLooting(), 'handleLooting');

		if (shouldHandleEvents()) {
			handleEvents();
		} else if (CONFIG.movement.enabled) {
			/* Closing on the party outranks everything else - out of heal range is
			   how the 2026-09-26 cascades actually happened. */
			/* TRAVEL OUTRANKS COHESION, reversing the v34-era order.
			   -> MageComments.md#travel-outranks-cohesion-reversing-the-v34-era */
			if (!get_nearest_monster({ type: home })) {
				handleReturnHome();
			} else if (await noHang(holdCohesion(), 'holdCohesion')) {
			} else if (CONFIG.movement.kiting && CONFIG.movement.kiting.enabled) {
				/* Chained, not exclusive - rangedKite() returns false when nothing
				   kite-worthy is in reach, and walkInCircle() must still run then. */
				const kited = await noHang(rangedKite(), 'rangedKite');
				if (!kited && CONFIG.movement.circleWalk) walkInCircle();
			} else if (CONFIG.movement.circleWalk) {
				walkInCircle();
			}
		}

		if (CONFIG.equipment.autoSwapSets && state.skinReady) {
			if (!isSetEquipped('current')) equipSet('current');
		}

	} catch (e) {
		console.error('mainLoop error:', e);
	}

	setTimeout(mainLoop, TICK_RATE.main);
}

// ============================================================================
// ACTION LOOP - basic attack + Mana Burst
// ============================================================================
async function actionLoop() {
	try {
		if (is_disabled(character)) return setTimeout(actionLoop, 25);
		updateCache();

		const target = cache.target;
		if (!target || !is_in_range(target) || smart.moving) {
			return setTimeout(actionLoop, TICK_RATE.action);
		}

		const burstCfg = CONFIG.combat.manaBurst;
		const canBurst = burstCfg.enabled
			&& character.mp >= burstCfg.minMp
			&& !is_on_cooldown('burst')
			&& (burstCfg.targets.includes(target.mtype) || target.mtype === home);

		if (canBurst) {
			await noHang(use_skill('burst', target), 'use_skill burst');
		} else if (!is_on_cooldown('attack')) {
			await noHang(use_skill('attack', target), 'use_skill attack');
		}

	} catch (e) {
		// Was raw console.error(e) - game API rejections are often plain
		// objects, not real Error instances, so this printed a useless
		// "[object Object]" every time (confirmed spamming multiple times
		// per second live on 2026-09-17, with no way to see what was
		// actually failing). describeError() already existed and was used
		// by maintenanceLoop/potionLoop's catch blocks - just missing here.
		console.error('actionLoop error:', describeError(e));
	}

	setTimeout(actionLoop, TICK_RATE.action);
}

// ============================================================================
// SKILL LOOP - support skills (energize, magiport, blink)
// ============================================================================
async function skillLoop() {
	try {
		if (is_disabled(character)) return setTimeout(skillLoop, 250);
		updateCache();

		await noHang(handleEnergize(), 'handleEnergize');
		await noHang(handleMagiport(), 'handleMagiport');
		handleBlinkEscape();

	} catch (e) {
		console.error('skillLoop error:', e);
	}

	setTimeout(skillLoop, TICK_RATE.skill);
}

async function handleEnergize() {
	const cfg = CONFIG.support.energize;
	if (!cfg.enabled || is_on_cooldown('energize')) return;
	if (character.level < (G.skills.energize?.level || 0)) return; // not unlocked yet (level 20)

	const target = cache.energizeTarget;
	if (!target) return;
	if (character.mp < cfg.minSelfMp) return;
	if (!is_in_range(target, 'energize')) return;

	await use_skill('energize', target);
	state.lastEnergize = performance.now();
}

async function handleMagiport() {
	const cfg = CONFIG.support.magiport;
	if (!cfg.enabled || is_on_cooldown('magiport')) return;
	if (character.mp < (G.skills.magiport?.mp || 0)) return;

	const target = get_player(cfg.target);
	if (!target || target.rip) return;

	const dist = parent.distance(character, target);
	if (dist < cfg.triggerDistance) return;

	await use_skill('magiport', target);
	state.lastMagiport = performance.now();
}

function handleBlinkEscape() {
	const cfg = CONFIG.selfPreservation.blinkOnLowHp;
	if (!cfg.enabled || is_on_cooldown('blink')) return;
	if (character.hp / character.max_hp > cfg.hpThreshold) return;
	if (character.mp < (G.skills.blink?.mp || 0)) return; // can't afford it - no point attempting

	// Blink to a short random offset from current position - just needs to
	// break line-of-sight/aggro, not reach anywhere specific.
	const angle = Math.random() * Math.PI * 2;
	const bx = character.x + Math.cos(angle) * 150;
	const by = character.y + Math.sin(angle) * 150;
	use_skill('blink', [bx, by]);
	game_log('Blink: low HP escape', '#00FFFF');
}

// ============================================================================
// MAINTENANCE LOOP
// ============================================================================
async function maintenanceLoop() {
	try {
		if (CONFIG.potions.autoBuy) autoBuyPotions();
		if (CONFIG.party.autoManage) partyMaker();
		if (CONFIG.selling.enabled) sellItems();
		if (CONFIG.muling.enabled) muleToMerchant();
		checkOwnXpEconomics();

		if (character.rip) {
			await respawn();
			if (CONFIG.potions.autoBuy) {
				await sleep(1000);
				game_log('Respawned - topping up potions while in town', '#FFD700');
				await buyMissingPotions();
			}
		}
	} catch (e) {
		console.error('maintenanceLoop error:', describeError(e));
	}

	setTimeout(maintenanceLoop, TICK_RATE.maintenance);
}

// ============================================================================
// POTION LOOP
// ============================================================================
async function potionLoop() {
	let delay = 100;
	try {
		const hpThreshold = character.max_hp - CONFIG.potions.hpThreshold;
		const mpThreshold = character.max_mp - CONFIG.potions.mpThreshold;

		if (character.mp < mpThreshold && !is_on_cooldown('use_mp')) {
			use_skill('use_mp');
			reduce_cooldown('use_mp', (character.ping || 0) * 0.95);
			delay = ms_to_next_skill('use_mp');
		} else if (character.hp < hpThreshold && !is_on_cooldown('use_hp')) {
			use_skill('use_hp');
			reduce_cooldown('use_hp', (character.ping || 0) * 0.95);
			delay = ms_to_next_skill('use_hp');
		}
	} catch (e) {
		console.error('potionLoop error:', describeError(e));
	}

	setTimeout(potionLoop, delay || 2000);
}

function ms_to_next_skill(skill) {
	const next_skill = parent.next_skill[skill];
	if (next_skill === undefined || next_skill === null) return 0;

	// Normally a Date object exposing .getTime() - but Mainframe's runtime
	// sometimes hands this back as something else (a raw epoch-ms number,
	// or a value new Date() can still parse) with no .getTime() method,
	// which was throwing "next_skill.getTime is not a function" every
	// time it happened. That was previously invisible - console.error(e)
	// printed it as "[object Object]" - and it was silently non-fatal
	// only because use_hp/use_mp had already fired by the time this ran;
	// only the delay calculation afterward was crashing. Get the epoch ms
	// whichever shape we're actually given.
	let targetMs;
	if (typeof next_skill.getTime === 'function') {
		targetMs = next_skill.getTime();
	} else if (typeof next_skill === 'number') {
		targetMs = next_skill;
	} else {
		const parsed = new Date(next_skill).getTime();
		targetMs = Number.isNaN(parsed) ? Date.now() : parsed;
	}

	const ping = parent.pings?.length ? Math.min(...parent.pings) : 0;
	const ms = targetMs - Date.now() - ping;
	return ms < 0 ? 0 : ms;
}

function autoBuyPotions() {
	/* Only attempt the purchase where there is something to sell to us. This
	   runs on the 2s maintenance tick, and off-vendor it was emitting two
	   doomed buy calls every two seconds for as long as stock stayed low. */
	if (atPotionVendor()) {
		if (quantity('hpot1') < CONFIG.potions.minStock) buy('hpot1', CONFIG.potions.minStock);
		if (quantity('mpot1') < CONFIG.potions.minStock) buy('mpot1', CONFIG.potions.minStock);
	}

	const totalHp = quantity('hpot0') + quantity('hpot1');
	const totalMp = quantity('mpot0') + quantity('mpot1');
	if (totalHp < 500) plSend('Meltymerch', { message: 'low_potions', potion: 'hp', quantity: totalHp, x: character.x, y: character.y, map: character.map });
	if (totalMp < 500) plSend('Meltymerch', { message: 'low_potions', potion: 'mp', quantity: totalMp, x: character.x, y: character.y, map: character.map });
}

// Shared by both the emergency restock (below) and the post-respawn top-up
// in maintenanceLoop.
async function buyMissingPotions() {
	if (quantity('hpot0') + quantity('hpot1') < CONFIG.potions.minStock) {
		try { await buy('hpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy hpot1 failed:', e); }
	}
	if (quantity('mpot0') + quantity('mpot1') < CONFIG.potions.minStock) {
		try { await buy('mpot1', CONFIG.potions.minStock); } catch (e) { console.error('buy mpot1 failed:', e); }
	}
}

/* ---- Emergency restock: the trip has to be a TRIP, not a teleport ---------
   -> MageComments.md#emergency-restock-the-trip-has-to-be */

// The two legacy starting maps still carry a `pots` NPC, and `test` is not a
// place to send a character. Kept out of the candidate list rather than
// trusted to be unroutable.
const RESTOCK_SKIP_MAPS = new Set(['old_main', 'original_main', 'test']);

// How near counts as standing at the vendor. This is NOT a measured server
// constant - no client function carries the npc interaction radius, so being
// wrong here can only cost a short walk, never a failed buy: the trip always
// smart_moves onto the NPC's own coordinates.
const RESTOCK_AT_VENDOR = 200;

let potionVendorCache = null;

/* Every (map, position) in the game where both potion kinds are sold, read
   from live G rather than listed, so a vendor added to a new map is picked up
   without a code change. Cached only once G has actually answered - a call
   before the data is up must not poison the cache with an empty list. */
function potionVendors() {
	if (potionVendorCache) return potionVendorCache;
	const found = [];
	try {
		const ids = [];
		for (const [id, npc] of Object.entries(G.npcs || {})) {
			const items = npc.items || [];
			if (items.includes('hpot1') && items.includes('mpot1')) ids.push(id);
		}
		if (!ids.length) return found;
		for (const [mapName, map] of Object.entries(G.maps || {})) {
			if (RESTOCK_SKIP_MAPS.has(mapName)) continue;
			for (const npc of (map.npcs || [])) {
				if (ids.indexOf(npc.id) === -1) continue;
				const p = npc.position || (npc.positions && npc.positions[0]);
				if (!p) continue;
				found.push({ map: mapName, x: p[0], y: p[1], id: npc.id });
			}
		}
	} catch (e) {
		return found;
	}
	if (found.length) potionVendorCache = found;
	return found;
}

/* Where to go and buy: this map if it has a vendor, otherwise main's. */
function potionVendor() {
	const all = potionVendors();
	if (!all.length) return null;
	return all.find((v) => v.map === character.map)
		|| all.find((v) => v.map === 'main')
		|| all[0];
}

function potionsOnHand() {
	return {
		hp: quantity('hpot0') + quantity('hpot1'),
		mp: quantity('mpot0') + quantity('mpot1'),
	};
}

/* True when buy() has someone to talk to from where we are standing. */
function atPotionVendor() {
	const v = potionVendor();
	if (!v || v.map !== character.map) return false;
	return distance(character, v) <= RESTOCK_AT_VENDOR;
}

let restockState = { failedAt: 0, failures: 0, note: null };

/* The trip. Detached from checkPotionEmergency on purpose - see there. */
async function restockTrip() {
	const want = potionVendor();
	try {
		if (!want) throw new Error('no potion vendor anywhere in G');

		/* A farm trip may be mid-flight. Orphan it the way travelWatchdog does,
		   so the smart_move this walk preempts rejects into a no-op instead of
		   counting a strike against a farm spot we never stopped wanting. */
		if (travelState.inFlight) {
			travelState.attemptId++;
			travelState.inFlight = false;
		}

		if (!atPotionVendor()) {
			game_log(`[potions] walking to ${want.id} on ${want.map} to restock`, '#FFD700');
			await noHang(smart_move({ map: want.map, x: want.x, y: want.y }),
				'restock walk', CONFIG.potions.restockTripMs);
		}
		if (!atPotionVendor()) {
			throw new Error(`stopped on ${character.map}, ${want.id} is on ${want.map}`);
		}

		await noHang(buyMissingPotions(), 'restock buy', CONFIG.potions.restockBuyMs);

		/* buy() is a socket call and a rejection is not the only way it fails,
		   so the test is the count afterwards, not whether anything threw.
		   Gold is in the message because broke and out-of-range read the same
		   from here otherwise. */
		const after = potionsOnHand();
		if (!after.hp || !after.mp) {
			throw new Error(`still out at ${want.id} - hp ${after.hp}, mp ${after.mp}, gold ${character.gold}`);
		}

		restockState.failures = 0;
		restockState.note = null;
		game_log(`Restocked at ${want.id} on ${want.map} - heading back to the farm spot`, '#00FF00');
	} catch (e) {
		restockState.failures++;
		restockState.failedAt = Date.now();
		restockState.note = null;
		game_log(`[potions] restock attempt ${restockState.failures} failed: ${describeError(e)}`, 'red');
		console.error('Emergency potion restock failed:', e);
	} finally {
		state.restocking = false;
	}
}

// Self-sufficiency fallback: don't just wait on the merchant forever if HP or
// MP potions hit zero outright - go buy more directly.
async function checkPotionEmergency() {
	if (!CONFIG.potions.autoBuy) return false;
	if (state.restocking) return true;   // the trip owns movement until it ends

	const have = potionsOnHand();
	if (have.hp > 0 && have.mp > 0) {
		// A delivery that arrived while we were holding off clears the backoff.
		restockState.failures = 0;
		restockState.note = null;
		return false;
	}

	/* A failed trip must not be retried on the next tick. That retry is what
	   turned "no vendor on this map" into town() being fired over and over:
	   fighting on empty is bad, teleport-spamming on empty is worse, and the
	   request to the merchant still goes out on the maintenance tick either
	   way. Returning false here keeps the rest of the loop running rather
	   than standing the character still with nothing on the way. */
	const since = Date.now() - restockState.failedAt;
	if (restockState.failures && since < CONFIG.potions.restockRetryMs) {
		if (restockState.note !== 'backoff') {
			restockState.note = 'backoff';
			game_log(`[potions] restock failed ${restockState.failures}x - holding ${Math.round((CONFIG.potions.restockRetryMs - since) / 1000)}s before the next trip`, 'orange');
		}
		return false;
	}

	state.restocking = true;
	game_log(`Out of ${have.hp === 0 ? 'HP' : 'MP'} potions - going to a vendor to restock`, 'red');
	/* DETACHED ON PURPOSE. The call site in mainLoop wraps this function in a
	   10s hang guard (HANG_GUARD.defaultMs), and a cross-map walk to main is
	   far longer than that - awaiting the trip here would fire the guard on
	   every healthy restock and bury the real failures in "did not settle".
	   Same shape as a Daisy trip instead: set the flag, let mainLoop stand
	   down on it, and bound the trip from the inside so the flag always
	   clears. restockTrip() catches everything, so nothing escapes here. */
	restockTrip();
	return true;
}

/* Operator handles. restockStatus() answers "where would he go, and is he
   holding off after a failure"; restockNow() drops the backoff so the next
   empty tick takes the trip immediately. */
function restockStatus() {
	const v = potionVendor();
	const have = potionsOnHand();
	const waitMs = restockState.failures
		? Math.max(0, CONFIG.potions.restockRetryMs - (Date.now() - restockState.failedAt))
		: 0;
	const out = {
		map: character.map,
		hp: have.hp,
		mp: have.mp,
		gold: character.gold,
		vendor: v ? `${v.id} on ${v.map} at ${v.x},${v.y}` : 'none found in G',
		atVendor: atPotionVendor(),
		restocking: !!state.restocking,
		failures: restockState.failures,
		holdingForSec: Math.round(waitMs / 1000),
	};
	game_log('[potions] ' + JSON.stringify(out), '#9FD3FF');
	return out;
}

function restockNow() {
	restockState.failures = 0;
	restockState.failedAt = 0;
	restockState.note = null;
	game_log('[potions] backoff cleared - the next empty tick will take the trip', '#FFD700');
	return restockStatus();
}

// ============================================================================
// EQUIPMENT HELPERS
// ============================================================================
const equipBatch = async data => {
	if (!Array.isArray(data) || data.length > 15) return;

	const valid = data.reduce((acc, { itemName, slot, level, l }) => {
		if (!itemName) return acc;
		const current = character.slots[slot];
		if (current?.name === itemName && current.level === level && current.l === l) return acc;

		const i = character.items.findIndex(item =>
			item?.name === itemName && item.level === level && item.l === l
		);
		if (i !== -1) acc.push({ num: i, slot });
		return acc;
	}, []);

	if (!valid.length) return;

	try {
		parent.socket.emit('equip_batch', valid);
		await parent.push_deferred('equip_batch');
	} catch (e) {
		console.error('equipBatch:', e);
	}
};

function isSetEquipped(setName) {
	const set = equipmentSets[setName];
	if (!set) return false;
	return set.every(item =>
		character.slots[item.slot]?.name === item.itemName &&
		character.slots[item.slot]?.level === item.level
	);
}

const equipSet = name => equipmentSets[name] && equipBatch(equipmentSets[name]);

// ============================================================================
// SKIN CHANGER - removed per request (2026-09-17). This was already just a
// no-op stub (no mage skin config was ever defined), and state.skinReady is
// initialized true above anyway, so removing it changes nothing at runtime.
// ============================================================================

// ============================================================================
// MOVEMENT
// ============================================================================
// ============================================================================
// BOSS EVENTS - go, contribute from maximum range, come home.
// Cooperative bosses only, fought from max range, never expecting the kill.
// The reasoning and the measurements behind every number are in this version's
// entry in the header above; what follows is what the code needs.
// -> MageComments.md#movement
const BOSS_JOIN_SPOTS = {
	goobrawl: { map: 'goobrawl', x: null, y: null },
	crabxx: { map: 'main', x: -1000, y: 1700 },
	franky: { map: 'level2w', x: -300, y: 150 },
	icegolem: { map: 'winterland', x: 820, y: 425 },
	/* MISSING UNTIL 2026-10-22, AND THE GAP WAS LATENT RATHER THAN THE CAUSE
	   OF ANYTHING MEASURED. The server's horseman branch has the same SHAPE as
	   the three above - `transport_player_to(player, "halloween", [-405, -1560,
	   0, 40])` past a 200-unit skip, read at upstream 16881a27 - so it is a
	   taxi to an ordinary walkable map, and `halloween` carries five doors,
	   which is where bossTaxiWalkable() gets its answer from.
	   WHAT THE ABSENCE COST: bossApproach gates its ENTIRE join block on this
	   table, so horseman was walked to even when clean, with a free teleport
	   sitting there. WHAT IT DID NOT COST: the 2026-10-22 zero credit. Dexon
	   was already on `halloween` at 05:17:52Z with the boss at 24.46%, so the
	   walk arrived and `share > 0.0025` is the live explanation; adding this
	   row does not touch that.
	   THE LATENT HALF IS WHY IT IS WORTH A ROW NOW. isTaxiJoin() is
	   isJoinEvent() AND this table, and horseman carries `join: true` in
	   design/events.js - so without the row the hop gates treat it exactly
	   like goobrawl: refused outright while hop-sick, and charged the full
	   sickness wait in the window test. Those gates iterate
	   CONFIG.bossHop.targets, so they reach horseman only once it is listed
	   there, which is the operator's call; the 05:00Z measurement - five kills
	   at 391, 620, 686, 710 and 1322s against a 2400s window - is the argument
	   for making it, and this row means that edit cannot quietly arm the
	   goobrawl treatment.
	   The spot is inside halloween's fvampire/ghost boundary [-664, -1808,
	   -147, -1477], one fvampire and nine growing ghosts, which is where the
	   server drops you and not a choice of ours - this table's one invariant.
	   No rage rectangle on the map, so containment never refuses it. */
	horseman: { map: 'halloween', x: -405, y: -1560 },
	/* THE SERVER'S OWN SPOT, not ours, which is what every row above is: these
	   mirror node/server.js's join handler exactly. Its comment on this line
	   reads "Below the graveyard's stairs, out of the Mummies' reach", and the
	   coordinates check out - y -1030 is 100 units clear of the mummy rage
	   rectangle's -1130 edge, and outside both booboo boxes.
	   NOT (290,-990), which is the FARM park point the achievement queue uses
	   for the same corridor. Both are correct places to stand and only one is
	   where `join` actually puts you; this table's single invariant is that it
	   says where the teleport lands. The farm point keeps its measured
	   13-waypoint approach chain, which this one does not have - so a walk here
	   pays the route search that chain exists to save. */
	graveyard: { map: 'spookytown', x: 255, y: -1030 },
};

/* goobrawl is the ONE joinable event whose parent.S key is an EVENT name and
   not a monster name.
   -> MageComments.md#goobrawl-is-the-one-joinable-event-whose */
/* ONE EVENT CAN SPAWN MORE THAN ONE MONSTER TYPE, and this mapping was
   rgoo-ONLY until v105. goobrawl spawns BOTH rgoo and bgoo, and they are not
   interchangeable: from live G, rgoo is 1,000,000 hp carrying funtoken at rate
   20 and is the only `open` source, while bgoo is 100,000 hp at 0.25 - so the
   single-valued mapping pointed at the rarer and more valuable half of a
   two-type set and silently failed on the other.

   THE DEFECT WAS IN bossApproach. `get_nearest_monster({type:'rgoo'})` returns
   null on a goobrawl showing only bgoo, and because goobrawl is NOT walkable
   the fall-through re-emits the join - so the party teleports in, finds nothing
   it will posture against, and keeps re-joining while a live goo stands beside
   it. bossCooperative was safe either way (both types are cooperative) and the
   status line was cosmetic; one of the three call sites mattered.

   WHY IT HAD NOT VISIBLY FAILED: the single goobrawl in the bridge's retained
   log produced rgoo. The base rate is roughly one observation in ~75
   server-windows over 3.17 days, so this could have sat here for weeks.

   UNRESOLVED, flagged rather than theorised: `G.events.goobrawl.sprite` is
   "rgoo", and sprite is an ICON field. If the original single value came from
   there, it is a DISPLAY field read as a spawn-set claim - the same shape as
   the `never_observable` finding. Nobody knows that it did.
   -> RangerComments.md#bossFightTypes */
/* graveyard's waves, added 2026-10-22. THIS ENTRY IS WHAT MAKES THE EVENT
   ELIGIBLE AT ALL, which is not obvious from the name: bossCooperative() reads
   bossMonsterTypes(), so without it `graveyard` falls to the [name] default,
   finds no G.monsters.graveyard, answers NOT cooperative, and bossEligible()
   refuses the boss. The attack list and the eligibility gate are the same
   table.
   GARGOYLE IS DELIBERATELY ABSENT. It is 6,000,000 hp and cooperative, so
   three characters cannot take it - and its spawn is inside the mummy rage
   rectangle, which nothing can stand on while containment is on. The waves'
   points carry over to it either way (graveyard_fallen banks them and the wake
   copies them), so excluding it costs no share. Whether a crowd should flip
   this to include it is the operator's open call, not a default. */
const BOSS_FIGHT_TYPES = { goobrawl: ['rgoo', 'bgoo'], graveyard: ['zombie', 'ghoul'] };
function bossMonsterTypes(name) { return BOSS_FIGHT_TYPES[name] || [name]; }

/* The nearest of ANY of the event's monster types. Distance rather than
   first-found: on a goobrawl both may be up, and posturing against the far one
   walks past the near one. get_nearest_monster is called bare, as everywhere
   else in this file - it is measured present in all three combat contexts, and
   a catch here would return null, which is indistinguishable from "no monster"
   and is exactly the Form B lie. */
function bossNearestMonster(name) {
	let best = null, bestD = Infinity;
	for (const t of bossMonsterTypes(name)) {
		const m = get_nearest_monster({ type: t });
		if (!m) continue;
		const d = (typeof m.x === 'number' && typeof character.x === 'number')
			? Math.hypot(m.x - character.x, m.y - character.y) : 0;
		if (d < bestD) { best = m; bestD = d; }
	}
	return best;
}

// ============================================================================
// RAGE BOXES - the geometry the farm scorer did not know about
// -> MageComments.md#rage-boxes-the-geometry-the-farm-scorer

/* Dexon owns the knob. The followers have no CONFIG.achievements of their own,
   so without this, raising concurrent in Ranger.js would leave the priest and
   mage still gated at 1 - and the mage is the only one who can pull a mummy, so
   the throttle would land exactly where it hurts. Broadcast with the farm spot;
   null everywhere it has not arrived, which leaves the local default alone. */
let ragePullShared = null;
/* THE ONE RUNTIME LEVER FOR ENTRY, sibling to ragePullShared above. Entry IS
   containment coming off: safeMove falls through to xmove, rageGuard stops
   shoving us out and ragePullActive stops pulling, which is what "walk in"
   means. Expressed here rather than by writing CONFIG, because CONFIG is the
   operator's and a script that edits it makes their setting unreadable.
   MAP-WIDE while it is on, so spookytown's two booboo rectangles lose cover
   too. The graveyard field (y -1550..-1312) is nowhere near booboo
   (y -842..-562), so in practice nothing else is standing in one - but it is a
   real widening and not a scoped one. */
let rageEntryActive = false;
let rageEntryOkSince = 0;
let rageEntryHeard = null;

function rageCfg() {
	const a = (typeof CONFIG !== 'undefined' && CONFIG.achievements && CONFIG.achievements.pull) || {};
	return {
		enabled: a.enabled !== false && !rageEntryActive,
		/* THE KNOB. How many of the target monsters may be in flight at once.
		   1 is the proven-safe start. Raise it as the farm earns trust: the only
		   other gate is courage, which stops a pull when this character already
		   has its own limit of attackers. Nothing else in here assumes 1. */
		concurrent: Math.max(1, ragePullShared || a.concurrent || 1),
		/* Keep margin + step at or below 9 for this corridor. The pinch at its
		   entrance is 14-18 units wide and rageRoute demands margin + step of
		   clearance, so anything larger cannot fit.
		   -> MageComments.md#measured-2026-10-09-and-the-single */
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
	   -> MageComments.md#four-connected-on-nodes-only */
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

/* Walk a safe route leg by leg. Every leg is straight-line clear by
   construction, so xmove is enough and no pathfinder gets a say. */
/* Walks a safe route, re-planning when a leg is refused instead of giving up on
   the whole trip.
   -> MageComments.md#walks-a-safe-route-re-planning-when */
const rageNav = { busy: false };

/* An optional hand-pinned chain, tried before the search:
     CONFIG.movement.approaches['spookytown|415|-986'] = [[x1,y1],[x2,y2], ...]
   Measured 2026-10-09 across two monitored trips and 1,283 position samples,
   the pathfinder's own route to this park point never enters a rectangle, so
   nothing currently needs one - it exists so a spot CAN be pinned by hand
   without that being load-bearing. A chain whose own points sit inside a
   rectangle is refused rather than walked. */
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

/* Hold fire. Two separate reasons, and the second is the one that brought three
   booboo onto the priest: shooting a monster that is still INSIDE its rectangle
   is what wakes the pack, so the party only ever engages what has already come
   out. The first simply keeps the party from stopping to fight on the way in and
   never arriving. */
function rageHoldFire(mob) {
	if (!mob || !mob.mtype) return false;
	const cfg = rageCfg();
	if (!cfg.enabled || !ragePullActive()) return false;
	const ctx = ragePullCtx();
	if (ctx.types.indexOf(mob.mtype) < 0) return false;
	/* THE PARK POINT COMES FROM THE CONTEXT, so on a boss trip this is the join
	   spot rather than the farm target two maps away - without which the
	   distance test below reads a destination that has nothing to do with where
	   the party is standing. */
	if (typeof ctx.x !== 'number') return false;
	if (Math.hypot(character.x - ctx.x, character.y - ctx.y) > cfg.parkWithin) return true;
	return !!rageHit(character.map, mob.x, mob.y, 0);
}

function rageFilterTarget(t) { return rageHoldFire(t) ? null : t; }

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

// ---- one-at-a-time pulling -------------------------------------------------
/* Dexon sets this from the achievement entry's `also`; the followers get it on
   the farm_spot message. Empty everywhere else, which leaves `home` alone. */
let rageAlso = [];
const ragePull = { openedAt: {}, lastPull: 0, busy: false };

/* WHICH PARK POINT AND WHICH TYPES THE PULL IS WORKING FOR, AND IT IS NOT
   ALWAYS THE FARM'S - measured 2026-10-22, the graveyard's first live window.
   THE SYMPTOM: routing worked perfectly. bossPick() became graveyard, and two
   seconds after the window opened Dexon was standing on BOSS_JOIN_SPOTS at
   (255,-1030). The party then produced NOTHING - zombie +0, ghoul +0,
   gargoyle +0 - while the gargoyle on their own shard lived seven minutes and
   died at 0.01%. Present on shard, zero credit.
   THE CAUSE, read off the priest mid-window: `destination` was the FARM target
   (crabx on `main`), `rageAlso` was [], so ragePullTypes() answered ["crabx"]
   and ragePullActive() early-returned on `destination.map !== character.map`.
   Every target was inside the mummy rectangle, safeMove refuses every
   coordinate in it, and the ONLY engagement route from the join spot is the
   pull - which was idle.
   THE BOSS-EVENT PATH SETS NEITHER `destination` NOR `rageAlso`, and it should
   not: the farm layer owns those, and writing boss state into them is the
   mistake v108 made from the other end. So the pull READS the boss context
   instead, the same way movement already does - boss events own movement
   through shouldHandleEvents()/handleEvents(), and this makes the pull agree
   with that rather than with the farm it is not serving.
   `bossWalkTarget` IS THE PARK POINT FOR FREE, because v111's guard already
   falls it through to the join spot when the published coordinates land inside
   a rage rectangle. The two changes compose with nothing to keep in step. */
function ragePullCtx() {
	const trip = (typeof bossState !== 'undefined' && bossState && bossState.trip) ? bossState.trip : null;
	if (trip && trip.name && typeof bossWalkTarget === 'function') {
		const spot = bossWalkTarget(trip.name);
		if (spot && spot.map === character.map) {
			return { src: 'boss', map: spot.map, x: spot.x, y: spot.y,
				types: bossMonsterTypes(trip.name) };
		}
	}
	const out = [];
	if (typeof home === 'string' && home) out.push(home);
	for (const t of rageAlso) if (out.indexOf(t) < 0) out.push(t);
	return { src: 'farm', map: destination ? destination.map : null,
		x: destination ? destination.x : null, y: destination ? destination.y : null,
		types: out };
}

function ragePullTypes() { return ragePullCtx().types; }

/* IS ANY TYPE WE WANT CURRENTLY STANDING INSIDE A RECTANGLE. Position, not box
   type - which is the question the CANDIDATE scan has always asked, and the
   one the activation test did not. */
function rageBoxedTarget(map, types) {
	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	for (const id in E) {
		const e = E[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (types.indexOf(e.mtype) < 0) continue;
		if (rageHit(map, e.x, e.y, 0)) return true;
	}
	return false;
}
let rageActiveMemo = { at: 0, key: '', val: false };

/* Active only where it is needed: the spot we are working has to be one with a
   rage box on this map. Everywhere else the ordinary farm loop is untouched.
   TWO DISJUNCTS, AND THE SECOND IS A WIDENING RATHER THAN A REPLACEMENT. The
   box-TYPE test is what the mummy and booboo farms have always used, and it
   cannot see the graveyard: zombie, ghoul and the gargoyle are EVENT spawns
   with no rectangle of their own, so on spookytown the only box type is
   `mummy` and a graveyard trip matched nothing.
   REPLACING IT WITH THE POSITIONAL TEST WOULD HAVE BEEN A REGRESSION, which is
   why both are here. rageHoldFire() consults this, and its first job is to
   stop the party fighting on the way IN - so on an approach with no monster
   yet visible inside a rectangle, a purely positional test answers "inactive",
   hold-fire switches off, and the party stops to fight exactly where the old
   comment says it must not. Every case that was active stays active.
   MEMOISED for 250ms because the positional half walks parent.entities and
   rageHoldFire() asks per MOB, which would otherwise be quadratic. Keyed on
   the context and the map, so a change of either is seen at once. */

/* Active only where it is needed: the spot we are working has to be one with a
   rage box on this map. Everywhere else the ordinary farm loop is untouched.
   TWO DISJUNCTS, AND THE SECOND IS A WIDENING RATHER THAN A REPLACEMENT. The
   box-TYPE test is what the mummy and booboo farms have always used, and it
   cannot see the graveyard: zombie, ghoul and the gargoyle are EVENT spawns
   with no rectangle of their own, so on spookytown the only box type is
   `mummy` and a graveyard trip matched nothing.
   REPLACING IT WITH THE POSITIONAL TEST WOULD HAVE BEEN A REGRESSION, which is
   why both are here. rageHoldFire() consults this, and its first job is to
   stop the party fighting on the way IN - so on an approach with no monster
   yet visible inside a rectangle, a purely positional test answers "inactive",
   hold-fire switches off, and the party stops to fight exactly where the old
   comment says it must not. Every case that was active stays active.
   MEMOISED for 250ms because the positional half walks parent.entities and
   rageHoldFire() asks per MOB, which would otherwise be quadratic. Keyed on
   the context and the map, so a change of either is seen at once. */
function ragePullActive() {
	const cfg = rageCfg();
	if (!cfg.enabled) return false;
	const ctx = ragePullCtx();
	if (!ctx.map || ctx.map !== character.map) return false;
	const types = ctx.types;
	if (!types.length) return false;
	const boxes = rageBoxes(character.map);
	if (!boxes.length) return false;
	for (const b of boxes) if (types.indexOf(b.type) >= 0) return true;
	const key = character.map + '|' + ctx.src + '|' + types.join(',');
	const now = Date.now();
	if (rageActiveMemo.key === key && now - rageActiveMemo.at < 250) return rageActiveMemo.val;
	const val = rageBoxedTarget(character.map, types);
	rageActiveMemo = { at: now, key: key, val: val };
	return val;
}

function rageParty() {
	const names = (typeof CONFIG !== 'undefined' && CONFIG.party && CONFIG.party.groupMembers) || [];
	const out = [];
	for (const n of names) {
		if (n === character.name) { out.push({ name: n, range: character.range || 0, rip: !!character.rip, x: character.x, y: character.y }); continue; }
		const e = (typeof parent !== 'undefined' && parent.entities) ? parent.entities[n] : null;
		if (e && !e.rip) out.push({ name: n, range: e.range || 0, rip: false, x: e.x, y: e.y });
	}
	return out;
}

/* How far out a shooter has to be able to reach to hit this monster from the
   nearest point OUTSIDE its box. For booboo, whose rage equals its boundary,
   one at the near edge costs margin+2. For a mummy at its spawn edge the rage
   halo adds 163 on top, which is what puts it beyond the ranger's 163 and in
   reach of the priest at 201 and the mage at 235. */
function rageRequiredRange(map, mon, margin) {
	const cfg = rageCfg();
	const m = (typeof margin === 'number') ? margin : cfg.margin;
	const b = rageHit(map, mon.x, mon.y, 0);
	if (!b) return 0;
	const r = b.r;
	const d = Math.min(mon.x - r[0], r[2] - mon.x, mon.y - r[1], r[3] - mon.y);
	return d + m + 2;
}

/* Deterministic, so three characters deciding independently land on the same
   answer without a message: the longest range that can actually reach it, ties
   broken by name. */
function ragePuller(map, mon) {
	const need = rageRequiredRange(map, mon);
	let best = null;
	for (const p of rageParty()) {
		if (p.range < need) continue;
		if (!best || p.range > best.range || (p.range === best.range && p.name < best.name)) best = p;
	}
	return best;
}

/* HOW MANY MONSTERS INSIDE A RAGE BOX ON THIS MAP ARE BEING HELD BY SOMEONE
   WHO IS NOT US. That is the operator's "enough people show up to share the
   mummy attacks", expressed as the thing they actually said rather than as a
   headcount: a headcount guesses at how aggro will distribute, this observes
   it, and it notices a crowd thinning because it is recomputed every tick.

   OBSERVABLE FROM OUTSIDE THE BOX, which is the property that makes an entry
   gate possible at all. The obvious signal - attackers-per-character - cannot
   gate entry, because parked in the corridor pulling one at a time we HAVE no
   attackers to count: it only becomes available once we are already inside,
   which is the decision it was supposed to inform. Other players' aggro is
   visible from here and ours is not, so the gate reads theirs and the RETREAT
   reads ours.
   ONE PREMISE IS UNVERIFIED AND IS NOT MINE TO MEASURE: whether entities deep
   in the mummy field are within range from the corridor at all. The nearest
   spawn edge is ~263 units from the join spot. If they are not visible this
   returns 0 and the gate simply never opens, which is the safe direction and
   is distinguishable from a quiet field by `boxed`. */
function rageCrowdSoak(map) {
	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	const names = (typeof CONFIG !== 'undefined' && CONFIG.party && CONFIG.party.groupMembers) || [];
	let soaked = 0, boxed = 0;
	for (const id in E) {
		const e = E[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (!rageHit(map, e.x, e.y, 0)) continue;
		boxed++;
		if (e.target && names.indexOf(e.target) < 0) soaked++;
	}
	return { soaked: soaked, boxed: boxed };
}

/* Ours alone, for the retreat side. Counts bodies on THIS character, which is
   the quantity courage is measured in. */
function rageAttackersOnMe() {
	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	let n = 0;
	for (const id in E) {
		const e = E[id];
		if (e && e.type === 'monster' && !e.dead && e.target === character.name) n++;
	}
	return n;
}

/* Ours alone, for the retreat side. Counts bodies on THIS character, which is
   the quantity courage is measured in. */
function rageAttackersOnMe() {
	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	let n = 0;
	for (const id in E) {
		const e = E[id];
		if (e && e.type === 'monster' && !e.dead && e.target === character.name) n++;
	}
	return n;
}

function rageEntrySet(on, why) {
	if (!!rageEntryActive === !!on) return;
	rageEntryActive = !!on;
	rageLog((on ? 'ENTERING the rage box - ' : 'leaving the rage box - ') + why,
		on ? '#FFD700' : '#7FD98A');
}

/* THE GATE. Inert unless the operator turns it on; `enabled` is theirs and no
   comment here states which way it is set.

   BIASED TOWARD STAYING OUT, deliberately. Missing a graveyard costs almost
   nothing - another in two hours - while a wipe inside the rectangle with
   containment off costs downtime and leaves three bodies somewhere the party
   cannot easily walk back to. So entry needs the crowd SUSTAINED over
   `holdMs`, and a single tick below the threshold ends it immediately.

   THE RETREAT IS NOT courage. The file records courage failing as a
   whole-party wipe twice - "firing AT courage pre-empts the ... and all three
   characters died", and attackers going 3 to 9 at the band's own threshold -
   so `retreatAtAttackers` is its own number, meant to sit below courage, and
   escalation is fast enough that it has to. */
function rageEntryTick(map) {
	const cfg = (CONFIG.bossEvents && CONFIG.bossEvents.rageEntry) || {};
	if (!cfg.enabled) { rageEntryOkSince = 0; rageEntrySet(false, 'entry is off'); return; }

	/* THE RETREAT IS EVERY CHARACTER'S OWN AND IS NEVER DELEGATED. Bodies on
	   ME are a fact only I can see, and waiting for the leader to notice them
	   is how the thing this guards against happens. So it runs before the
	   leader check and applies to all three. */
	if (rageEntryActive && rageAttackersOnMe() >= (cfg.retreatAtAttackers || 3)) {
		rageEntryOkSince = 0;
		rageEntrySet(false, 'too many on me');
		return;
	}

	/* ENTERING IS THE LEADER'S CALL ALONE, AND THAT IS NOT TIDINESS - IT IS THE
	   ONLY THING THAT KEEPS THE PARTY TOGETHER. Entry is containment coming
	   off, so a character that enters while another does not has its safeMove
	   accepting a destination the other's still refuses: the leader walks into
	   the field, the followers hold at the corridor, and the party splits with
	   nothing logging a fault. Three characters evaluating the same predicate
	   from three entity views WILL disagree at the margin - the file's own
	   "two state machines over one decision" - so there is one evaluator and
	   the rest obey.
	   A FOLLOWER WITH NO RECENT WORD FALLS OUT, which is the safe direction: a
	   leader that disconnects or stops ticking leaves everyone outside rather
	   than leaving someone inside with nobody deciding. */
	if (!bossIsLeader()) {
		const fresh = rageEntryHeard && (Date.now() - rageEntryHeard.at) < (cfg.trustMs || 15000);
		if (!fresh) { rageEntrySet(false, 'no recent word from the leader'); return; }
		rageEntrySet(!!rageEntryHeard.on, 'the leader says ' + (rageEntryHeard.on ? 'in' : 'out'));
		return;
	}

	const soak = rageCrowdSoak(map);
	if (soak.soaked < (cfg.minSoaked || 6)) {
		rageEntryOkSince = 0;
		rageEntrySet(false, 'crowd is soaking only ' + soak.soaked + ' of ' + soak.boxed);
	} else {
		if (!rageEntryOkSince) rageEntryOkSince = Date.now();
		if (Date.now() - rageEntryOkSince >= (cfg.holdMs || 20000)) {
			rageEntrySet(true, soak.soaked + ' of ' + soak.boxed + ' held by others');
		}
	}
	/* Re-sent every tick rather than on the edge, because the followers time
	   out on silence and a dropped message would otherwise strand them. */
	rageEntryBroadcast(rageEntryActive);
}

function rageEntryBroadcast(on) {
	const members = (CONFIG.party && CONFIG.party.groupMembers) || [];
	for (const m of members) {
		if (m === character.name || m === 'Meltymerch') continue;
		try { plSend(m, { message: 'rageentry', on: !!on }); } catch (e) { }
	}
}

/* Heard from the leader. Only the leader's word counts, by the same rule
   bossOnCall applies to an unforced pick. */
function rageEntryOnCall(from, data) {
	if (from !== CONFIG.bossEvents.leaderName) return;
	rageEntryHeard = { on: !!data.on, at: Date.now() };
}

function rageEngagedCount(types) {
	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	const names = (typeof CONFIG !== 'undefined' && CONFIG.party && CONFIG.party.groupMembers) || [];
	const now = Date.now(), cfg = rageCfg();
	let n = 0;
	const counted = {};
	for (const id in E) {
		const e = E[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (types.indexOf(e.mtype) < 0) continue;
		if (e.target && names.indexOf(e.target) >= 0) { counted[id] = 1; n++; }
	}
	/* One we have opened on but which has not registered a target yet still
	   counts, or the gate lets a second pull through in the gap. */
	for (const id in ragePull.openedAt) {
		if (now - ragePull.openedAt[id] > cfg.pullTimeoutMs) { delete ragePull.openedAt[id]; continue; }
		if (!counted[id] && E[id] && !E[id].dead) n++;
	}
	return n;
}

/* Picks one monster still inside its box and brings it out. Returns true when
   it owns this tick. */
async function ragePullTick() {
	if (ragePull.busy) return true;
	if (!ragePullActive()) return false;
	const cfg = rageCfg();
	const map = character.map;
	const types = ragePullTypes();

	if (rageEngagedCount(types) >= cfg.concurrent) return false;
	if (Date.now() - ragePull.lastPull < cfg.repullGapMs) return false;
	if (cfg.respectCourage) {
		const courage = character.courage || 2;
		let onMe = 0;
		const E = (typeof parent !== 'undefined' && parent.entities) || {};
		for (const id in E) if (E[id] && E[id].target === character.name) onMe++;
		if (onMe >= courage) return false;
	}

	const E = (typeof parent !== 'undefined' && parent.entities) || {};
	let pick = null, pickD = Infinity;
	for (const id in E) {
		const e = E[id];
		if (!e || e.type !== 'monster' || e.dead) continue;
		if (types.indexOf(e.mtype) < 0) continue;
		if (e.target) continue;                       // already somebody's problem
		if (ragePull.openedAt[id]) continue;
		if (!rageHit(map, e.x, e.y, 0)) continue;     // already outside - the loop will take it
		const d = Math.hypot(e.x - character.x, e.y - character.y);
		if (d < pickD) { pick = e; pickD = d; }
	}
	if (!pick) return false;

	const puller = ragePuller(map, pick);
	if (!puller || puller.name !== character.name) return false;

	const need = rageRequiredRange(map, pick);
	const reach = Math.max(20, (character.range || 0) - 6);
	const b = rageHit(map, pick.x, pick.y, 0);
	if (!b) return false;
	/* Stand off the nearest edge, on the monster's side, as far back as our own
	   reach allows - never closer to the rectangle than the margin. */
	const r = b.r;
	const edges = [
		{ x: r[0] - cfg.margin - 2, y: pick.y }, { x: r[2] + cfg.margin + 2, y: pick.y },
		{ x: pick.x, y: r[1] - cfg.margin - 2 }, { x: pick.x, y: r[3] + cfg.margin + 2 },
	];
	edges.sort((p, q) => Math.hypot(p.x - pick.x, p.y - pick.y) - Math.hypot(q.x - pick.x, q.y - pick.y));
	const spot = edges[0];
	if (Math.hypot(spot.x - pick.x, spot.y - pick.y) > reach) return false;

	const pctx = ragePullCtx();
	const park = (typeof pctx.x === 'number') ? { x: pctx.x, y: pctx.y }
		: { x: character.x, y: character.y };
	ragePull.busy = true;
	try {
		rageLog('pulling ' + pick.mtype + ' (need ' + Math.round(need) + ', reach ' + Math.round(reach) + ')', '#FFD700');
		await safeMove(spot.x, spot.y);
		if (typeof attack === 'function' && typeof is_in_range === 'function' && is_in_range(pick)) {
			try { await attack(pick); ragePull.openedAt[pick.id] = Date.now(); ragePull.lastPull = Date.now(); }
			catch (e) { rageLog('open shot failed: ' + (e && e.reason || e && e.message || e), 'orange'); }
		}
		await safeMove(park.x, park.y);
	} finally {
		ragePull.busy = false;
	}
	return true;
}

function rageStatus() {
	const map = character.map;
	const boxes = rageBoxes(map);
	rageLog(map + ': ' + (boxes.length ? boxes.map(b => b.type + ' [' + b.r.join(',') + ']').join('  ') : 'no rage boxes'), '#8b98ab');
	const sctx = ragePullCtx();
	rageLog('pull ' + (ragePullActive() ? 'ACTIVE' : 'idle') + ' | for ' + sctx.src
		+ ' @ ' + sctx.map + ' (' + Math.round(sctx.x) + ',' + Math.round(sctx.y) + ')'
		+ ' | types ' + ragePullTypes().join(',')
		+ ' | concurrent ' + rageCfg().concurrent + ' | margin ' + rageCfg().margin
		+ ' | engaged ' + rageEngagedCount(ragePullTypes()), '#8b98ab');
	return { boxes: boxes, types: ragePullTypes(), cfg: rageCfg() };
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

const BOSS_KEY = 'boss_trip';
const bossState = {
	trip: null,         // { name, startedAt, deaths, wasRip, src }
	cooldown: {},       // name -> ms until we will consider it again
	fromLeader: null,   // { name, at } - the leader's current call
	forced: null,       // { name, at } - bossJoin() from the console
	lastNote: null,
};
/* The trip survives a reload, which matters because a redeploy mid-event would
   otherwise restart the clock and hand the party another full 20 minutes at a
   boss it had already given up on. */
try {
	const bossSaved = get(BOSS_KEY);
	if (bossSaved && typeof bossSaved === 'object') {
		bossState.trip = bossSaved.trip || null;
		bossState.cooldown = bossSaved.cooldown || {};
	}
} catch (e) { }
function bossSave() {
	try { set(BOSS_KEY, { trip: bossState.trip, cooldown: bossState.cooldown }); }
	catch (e) { bossLog('could not persist the trip - a reload will restart its clock', 'orange'); }
}
function bossLog(m, c) { try { game_log('[boss] ' + m, c || '#FFD700'); } catch (e) { } console.log('[boss] ' + m); }
/* Said once per distinct message: approach runs every tick and would otherwise
   be the loudest thing in the log. */
function bossNote(m) { if (bossState.lastNote !== m) { bossState.lastNote = m; bossLog(m, '#8b98ab'); } }
function bossIsLeader() { return character.name === CONFIG.bossEvents.leaderName; }

function bossCooperative(name) {
	const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : (typeof G !== 'undefined' ? G : null);
	if (!g || !g.monsters) return false;
	/* ANY of the event's types being cooperative settles it. Measured live,
	   rgoo and bgoo are both cooperative, so this changes no answer today -
	   but reading only the first would answer FALSE if G happened not to
	   carry it, and false here removes the boss from consideration. */
	for (const t of bossMonsterTypes(name)) {
		const m = g.monsters[t];
		if (m && m.cooperative) return true;
	}
	return false;
}

/* LIVENESS IS NOT ONE FIELD, AND goobrawl IS THE EVENT THAT PROVES IT.
   Read from upstream 16881a27 2026-10-22. Three shapes reach parent.S:
     - crabxx, franky, icegolem and horseman come out of one forEach in
       server_functions.js assigned {live, map, hp, max_hp, target, x, y, end}
     - graveyard_public() returns {live: true, ...}
     - goobrawl is assigned `E.goobrawl = { end: timers.goobrawl }` and
       `delete E.goobrawl` when the window closes - NO live field, no map, no
       hp. Its PRESENCE is the signal, because the server removes the key.
   So a bare `d.live` test could never see a goobrawl, which is why
   bossRank.goobrawl has been unreachable for as long as it has existed - the
   same state dragold is in under lunarnewyear, reached by a different route
   and with nothing recording it. The comment on BOSS_RANK says the table is
   keyed by the parent.S name "because that is what bossLiveNames() yields":
   true of every other entry and false of this one.
   WHAT THAT COST: bossPick() returned null for goobrawl on EVERY character, so
   shouldHandleEvents() stayed false, handleEvents() never ran, and the join was
   never emitted - by the leader or by a follower. The 70-to-0 bgoo credit split
   measured 2026-10-22 is therefore NOT a follower asymmetry; bossApproach is
   byte-identical in all three files and the relay suite pins it.
   WHY A NAMED SET AND NOT A RULE: this function iterates EVERY key of S, which
   also carries schedule, time_offset, night, dailies and nightlies. A general
   "key present means live" reads those as live bosses. Presence is sound for
   the names below and for nothing else, so the set is declared rather than
   derived - there is nothing client-side to derive it from. */
const BOSS_PRESENCE_LIVE = { goobrawl: true };

function bossEntryLive(name, d) {
	if (!d || typeof d !== 'object') return false;
	if (d.live) return true;
	return !!BOSS_PRESENCE_LIVE[name];
}

function bossLiveNames() {
	const S = (typeof parent !== 'undefined' && parent.S) || {};
	const out = [];
	for (const k in S) {
		if (bossEntryLive(k, S[k])) out.push(k);
	}
	return out;
}

/* The gate. Returns its reason rather than logging it, so bossStatus() can
   print the whole picture in one pass. */
function bossEligible(name) {
	const cfg = CONFIG.bossEvents;
	if (!cfg.enabled) return { ok: false, why: 'bossEvents.enabled is false' };
	if (cfg.exclude.has(name)) return { ok: false, why: 'excluded' };
	const byHand = cfg.include.indexOf(name) >= 0;
	if (cfg.cooperativeOnly && !byHand && !bossCooperative(name)) return { ok: false, why: 'not cooperative' };
	const until = bossState.cooldown[name] || 0;
	if (until > Date.now()) return { ok: false, why: 'gave up on it ' + Math.round((until - Date.now()) / 60000) + ' min ago' };
	return { ok: true, why: byHand ? 'included by hand' : 'cooperative' };
}

/* Which boss: an operator command first, then the leader's call, then our own
   reading. The own-reading tie-break is by NAME, not by iteration order,
   because three characters deciding independently have to land on the same
   answer or the party splits between two live bosses. */
function bossPick() {
	const cfg = CONFIG.bossEvents;
	if (bossState.forced && bossState.forced.name) {
		const f = bossState.forced.name;
		const d = (parent.S || {})[f];
		if (bossEntryLive(f, d)) return { name: f, src: 'command' };
		bossLog('dropping the forced pick ' + f + ' - it is not live', 'orange');
		bossState.forced = null;
	}
	if (!bossIsLeader() && bossState.fromLeader && bossState.fromLeader.name
		&& (Date.now() - bossState.fromLeader.at) < cfg.leaderTrustMs) {
		const n = bossState.fromLeader.name;
		const d = (parent.S || {})[n];
		if (bossEntryLive(n, d)) return { name: n, src: 'leader' };
	}
	let best = null;
	for (const n of bossLiveNames()) {
		if (!bossEligible(n).ok) continue;
		const d = parent.S[n];
		const ratio = (d && d.max_hp) ? (d.hp / d.max_hp) : 1;
		if (!best || ratio < best.ratio - 1e-9 || (Math.abs(ratio - best.ratio) < 1e-9 && n < best.name)) {
			best = { name: n, ratio: ratio };
		}
	}
	return best ? { name: best.name, src: 'own' } : null;
}

/* Outside their reach when ours is longer - which costs nothing - and otherwise
   the far edge of ours. Derived per boss from the live entity, never a
   constant: the difference between crabxx at 45 and franky at 948 is the whole
   decision. */
function bossHoldDistance(mon) {
	const cfg = CONFIG.bossEvents;
	const mine = Math.max(20, character.range || 100);
	const theirs = (mon && mon.range) || 0;
	let hold = Math.min(mine * cfg.holdFraction, mine - 5);
	const outside = theirs + cfg.rangeMargin;
	if (outside < mine && hold < outside) hold = outside;
	return Math.max(10, hold);
}

/* Stand at that distance, whether we are currently too close or too far. */
async function bossPosture(mon) {
	const hold = bossHoldDistance(mon);
	const dx = mon.x - character.x, dy = mon.y - character.y;
	const dist = Math.hypot(dx, dy) || 1;
	if (Math.abs(dist - hold) <= CONFIG.bossEvents.holdTolerance) return;
	if (smart.moving) return;
	const f = hold / dist;
	await safeMove(mon.x - dx * f, mon.y - dy * f);
}

/* TRUE when the join is a TAXI to somewhere reachable on foot, which is the
   only case where being refused the join still leaves the fight available.

   NOT the same question as isJoinEvent(). Measured against upstream 2148cf25
   at node/server.js:12659-12676, five events carry join:true and they split
   two ways: crabxx (main), franky (level2w) and icegolem (winterland) are
   transports to ordinary walkable maps, skipped entirely if you are already
   within 200 units - so the join saves a walk and nothing more. goobrawl's
   map has `doors: []` and no walkable entrance, and abtesting assigns teams
   and can answer join_too_late; for those two the join IS the only way in and
   refusing while sick is correct.

   Derived rather than listed: BOSS_JOIN_SPOTS gives goobrawl null coords
   because the server supplies no x/y for it, and G decides whether the
   destination map has doors. A map that gains or loses doors changes this
   answer without an edit here. */
function bossTaxiWalkable(name) {
	const spot = BOSS_JOIN_SPOTS[name];
	if (!spot || typeof spot.x !== 'number') return false;
	const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
	const m = g && g.maps && g.maps[spot.map];
	return !!(m && m.doors && m.doors.length);
}

function bossWalkTarget(name) {
	const d = (parent.S || {})[name];
	if (d && d.map && typeof d.x === 'number') {
		/* CALLED BARE, no try/catch, and that is deliberate. Both are top-level
		   declarations in THIS file - the `ms_to_next_skill is OURS` case, not
		   the maybe-missing-game-helper one - so a catch here could only
		   swallow a real fault and return the Form B lie, which in this
		   function means silently failing OPEN and walking into the rectangle.
		   The first draft had exactly that and the suite caught it: rageCfg()
		   threw in the harness, the catch answered "not contained", and the
		   guard reported the boxed point as fine. */
		if (!(rageCfg().enabled && rageHit(d.map, d.x, d.y))) return { map: d.map, x: d.x, y: d.y };
		bossNote(name + ' publishes a position inside a rage box - using the join spot');
	}
	for (const e of EVENT_LOCATIONS) if (e.name === name) return { map: e.map, x: e.x, y: e.y };
	const spot = BOSS_JOIN_SPOTS[name];
	if (spot && typeof spot.x === 'number') return { map: spot.map, x: spot.x, y: spot.y };
	return null;
}

async function bossApproach(name) {
	const mon = bossNearestMonster(name);
	if (mon) { await bossPosture(mon); return; }
	if (BOSS_JOIN_SPOTS[name]) {
		/* THE TELEPORT IS STILL PREFERRED. When it is available it costs
		   nothing and reaches the spot for free, which is what the previous
		   wording here was protecting and it was right to.
		   What changed in v94: being refused the join no longer means the
		   FIGHT is unreachable. The server refuses it while hop-sick
		   (node/server.js:12653) and the refusal is about the TAXI - for a
		   walkable destination the boss is still there to be walked to, and
		   credit while sick costs 5x in dwell rather than being denied.
		   So: not sick, teleport. Sick and walkable, fall through to the walk
		   below. Sick and NOT walkable (goobrawl, abtesting), still bail,
		   because for those the join really is the only way in. */
		if (!(character.s && character.s.hopsickness)) {
			bossNote('joining ' + name);
			try { parent.socket.emit('join', { name: name }); } catch (e) { bossLog('join emit failed: ' + e, 'red'); }
			return;
		}
		if (!bossTaxiWalkable(name)) { bossNote('hopsick - ' + name + ' has no walkable entrance, waiting it out'); return; }
		bossNote('hopsick - walking to ' + name + ' instead of joining');
		/* The probe is DEXON'S - he is the one whose credit is in question -
		   but the guard keeps this branch byte-identical in all three files,
		   which is what lets suite_relay.js assert they have not diverged.
		   v94 shipped the walk to Ranger alone and left the followers on the
		   unconditional bail; because shouldHandleEvents() owns movement
		   while a trip is live and holdCohesion() sits in its else, that
		   stranded them where they stood while the leader walked to the boss
		   - the 2026-09-26 "leader boss-side with no healer" failure reached
		   by a new route. The identity is the guard against the next one. */
		if (typeof taxiProbeNote === 'function') {
			taxiProbeNote(name, { walkedAt: Date.now(), sickMsAtWalk: bossHop.hopsickRemainingMs() });
		}
	}
	if (smart.moving) return;
	const where = bossWalkTarget(name);
	if (!where) { bossNote('no position known for ' + name + ' - cannot travel'); return; }
	bossNote('walking to ' + name + ' on ' + where.map);
	safeSmartMove({ map: where.map, x: where.x, y: where.y })
		.catch(e => rageLog('boss approach blocked: ' + (e && e.message || e), 'orange'));
}

/* forced marks an operator command, which outranks the gate on every character
   that hears it. An unforced call is the leader's ordinary pick, and only the
   leader's is believed. */
function bossBroadcast(name, forced) {
	const members = (CONFIG.party && CONFIG.party.groupMembers) || [];
	for (const m of members) {
		if (m === character.name || m === 'Meltymerch') continue;   // join refuses merchants outright
		try { plSend(m, { message: 'boss', name: name, forced: !!forced }); } catch (e) { }
	}
}

/* Heard from another character. Lives here rather than in on_cm so all three
   files carry one copy of the rule. */
function bossOnCall(from, data) {
	const members = (CONFIG.party && CONFIG.party.groupMembers) || [];
	if (members.indexOf(from) < 0) return;
	if (data.forced) {
		if (data.name) {
			bossState.forced = { name: data.name, at: Date.now() };
			bossState.cooldown[data.name] = 0;
			bossSave();
			bossLog(from + ' called everyone to ' + data.name, '#7FD98A');
		} else {
			bossState.forced = null;
			if (bossState.trip) bossEnd(from + ' called it off');
			else bossLog(from + ' called it off');
		}
		return;
	}
	if (from !== CONFIG.bossEvents.leaderName) return;
	bossState.fromLeader = { name: data.name || null, at: Date.now() };
	if (!data.name && bossState.trip) bossEnd('the leader moved on');
}

/* Terminal for one trip. The cooldown is set ONLY when we gave up rather than
   when the event ended on its own - otherwise the party turns round and walks
   back out to the boss that just outlasted it, which is the same loop under a
   different name. */
function bossEnd(why) {
	const t = bossState.trip;
	if (!t) return;
	const mins = Math.round((Date.now() - t.startedAt) / 60000);
	const gaveUp = why.indexOf('death') >= 0 || why.indexOf('cap') >= 0 || why.indexOf('by hand') >= 0;
	if (gaveUp) bossState.cooldown[t.name] = Date.now() + CONFIG.bossEvents.cooldownMs;
	bossState.trip = null;
	bossState.forced = null;
	bossState.lastNote = null;
	bossSave();
	bossLog('leaving ' + t.name + ' after ' + mins + ' min (' + why + ') - back to farming'
		+ (gaveUp ? ', and leaving it alone for ' + Math.round(CONFIG.bossEvents.cooldownMs / 60000) + ' min' : ''), 'orange');
	if (bossIsLeader()) bossBroadcast(null);
	try { if (typeof handleReturnHome === 'function') handleReturnHome(); } catch (e) { }
}

async function bossTick() {
	const cfg = CONFIG.bossEvents;
	const t0 = bossState.trip;
	// Deaths are counted from the rip EDGE, so one corpse is one death however
	// many ticks it lies there.
	if (t0) {
		if (character.rip && !t0.wasRip) {
			t0.deaths++; t0.wasRip = true;
			/* ATTACKERS AT THE MOMENT OF DEATH, because "died with 2 on me" and
			   "died with 9 on me" are different stories and one death is
			   otherwise an uninterpretable sample. Aggro assignment is
			   stochastic, so a single death is never evidence that an entry
			   gate was miscalibrated - the DEATH COUNTER integrates over
			   samples and is what maxDeaths already reads. This field is what
			   lets the threshold be set from data instead of guessed. */
			t0.attackersAtDeath = rageAttackersOnMe();
			t0.soakAtDeath = rageCrowdSoak(character.map).soaked;
			bossSave();
			bossLog('died at ' + t0.name + ' (' + t0.deaths + ' of ' + cfg.maxDeaths
				+ ') with ' + t0.attackersAtDeath + ' on me, crowd soaking '
				+ t0.soakAtDeath, 'red');
		} else if (!character.rip && t0.wasRip) {
			t0.wasRip = false;
			/* THE RETURN RE-CHECK. The operator's shape: "upon the return check
			   if there is enough characters to enter the rage box." Entry is
			   recomputed from scratch here rather than resumed, so a crowd that
			   thinned while we lay there keeps us out. */
			rageEntrySet(false, 'respawned - re-checking the crowd');
			bossSave();
		}
	}
	const pick = bossPick();
	if (!pick) {
		rageEntrySet(false, 'no boss trip');
		if (bossState.trip) bossEnd('nothing eligible is live');
		return false;
	}
	if (!bossState.trip || bossState.trip.name !== pick.name) {
		if (bossState.trip) bossEnd('switching to ' + pick.name);
		bossState.trip = { name: pick.name, startedAt: Date.now(), deaths: 0, wasRip: !!character.rip, src: pick.src };
		bossSave();
		bossLog('going to ' + pick.name + ' (' + pick.src + ', '
			+ (BOSS_JOIN_SPOTS[pick.name] ? 'joinable' : 'on foot') + ')');
		if (bossIsLeader()) bossBroadcast(pick.name);
	}
	const t = bossState.trip;
	/* Evaluated every tick while a trip is live, which is what lets a crowd
	   thinning put us back outside without waiting for a death. It reads the
	   map we are STANDING on, so parked in the corridor it sees the mummy
	   field and anywhere else it finds no boxes and stays off. */
	try { rageEntryTick(character.map); } catch (e) { rageLog('entry tick: ' + e, 'orange'); }
	if (t.deaths >= cfg.maxDeaths) { bossEnd(t.deaths + ' deaths'); return false; }
	if (Date.now() - t.startedAt > cfg.maxTripMs) { bossEnd('trip cap of ' + Math.round(cfg.maxTripMs / 60000) + ' min'); return false; }
	if (character.rip) return true;   // the respawn path owns us until we are up
	await bossApproach(t.name);
	return true;
}

/* ---- operator commands ---------------------------------------------------
   bossJoin('franky') goes now, whatever the gate thinks, and clears any
   cooldown on that name. From Dexon it takes the party; from anyone else it
   takes that character. bossHome() abandons the trip. bossStatus() prints what
   is live, what the gate says about each, and where we would stand. */
function bossJoin(name) {
	if (!name) {
		const live = bossLiveNames();
		bossLog('bossJoin("<name>") - live now: ' + (live.length ? live.join(', ') : 'nothing')
			+ ' | joinable: ' + Object.keys(BOSS_JOIN_SPOTS).join(', '));
		return;
	}
	bossState.forced = { name: name, at: Date.now() };
	bossState.cooldown[name] = 0;
	bossSave();
	bossLog('forced to ' + name + ' by hand', '#7FD98A');
	// From ANY character, not just the leader: "go now" has to mean the party,
	// not whichever console the operator happened to have open.
	bossBroadcast(name, true);
}
function bossHome() {
	bossState.forced = null;
	bossBroadcast(null, true);
	if (bossState.trip) bossEnd('bossHome() by hand');
	else bossLog('not on a boss trip');
}
function bossStatus() {
	const t = bossState.trip;
	bossLog('leader=' + CONFIG.bossEvents.leaderName + ' me=' + character.name
		+ ' trip=' + (t ? t.name + ' ' + Math.round((Date.now() - t.startedAt) / 60000) + 'min deaths=' + t.deaths + ' via ' + t.src : 'none'));
	const live = bossLiveNames();
	if (!live.length) bossLog('nothing live');
	for (const n of live) {
		const g = bossEligible(n);
		const d = parent.S[n];
		const mon = bossNearestMonster(n);
		const hold = mon ? Math.round(bossHoldDistance(mon)) : null;
		bossLog('  ' + n + ': ' + (g.ok ? 'ELIGIBLE' : 'skip') + ' (' + g.why + ')'
			+ (d && d.max_hp ? ' hp ' + Math.round(100 * d.hp / d.max_hp) + '%' : '')
			+ (BOSS_JOIN_SPOTS[n] ? ' joinable' : ' on foot')
			+ (hold != null ? ' hold at ' + hold + ' (my range ' + character.range + ', its ' + (mon.range || '?') + ')' : ''),
			g.ok ? '#7FD98A' : '#8b98ab');
	}
	for (const n in bossState.cooldown) {
		const left = bossState.cooldown[n] - Date.now();
		if (left > 0) bossLog('  cooling: ' + n + ' for ' + Math.round(left / 60000) + ' min', '#8b98ab');
	}
}


function shouldHandleEvents() {
	/* The gate is the boss policy now, not "is anything live". The old test
	   went through a local dynamic-events helper, since deleted, whose
	   EVENT_LOCATIONS listed dragold,
	   mrgreen and mrpumpkin UNCONDITIONALLY - so the farm was dropped for any
	   of the three the moment it spawned, with no question of whether the party
	   could contribute, and nothing to bring it home. */
	return !!bossPick() || !!bossState.trip;
}

function handleEvents() {
	/* Everything below here used to be an independent decision per character:
	   the same "most damaged live event" scan ran in all three files, so two
	   live bosses could send the ranger to one and the priest to the other, and
	   crabxx was in the ranger's list alone - he joined it while the other two
	   kept farming, boss-side with no healer. bossTick owns the decision now,
	   the leader broadcasts it, and the gate decides whether it is worth taking
	   at all. -> BOSS EVENTS */
	bossTick().catch(e => bossLog('tick threw: ' + (e && e.message || e), 'red'));
}

// ============================================================================
// TRAVEL HELPER - a smart_move that reports its own failures
// ============================================================================
// Ported from Merchant.js travelTo(). Two jobs.
//
// 1. SURFACE THE FAILURE. handleReturnHome() used to call smart_move() with no
//    await and no .catch(). A rejection became an unhandled promise rejection
//    and vanished, smart.moving went false, and the next tick re-issued it -
//    a silent hot loop indistinguishable, from outside, from walking there
//    slowly. Now every attempt ends in a verdict: arrived, or failed with a
//    reason and a distance.
//
// 2. FALL BACK THROUGH town(). A seasonal or event map can lose its route out
//    once the event ends. town() gets us somewhere routable, and the real
//    route is tried again from there.
// -> MageComments.md#travel-helper-a-smart-move-that-reports
const TRAVEL = {
	maxAttempts: 3,                  // failed attempts before the spot is judged unreachable
	attemptTimeoutMs: 3 * 60 * 1000, // an attempt that outlives this never settled
	// How close counts as arrived. -> travelAtDestination
	arrivalRadius: 200,
};

const travelState = {
	inFlight: false,
	attemptId: 0,
	startedAt: 0,
	failures: 0,         // consecutive failures against `target`
	lastError: null,
	lastDistance: null,  // readable: how far off we were when it failed
	target: null,
};

function travelKey(dest) {
	return dest ? `${dest.map}|${Math.round(dest.x)}|${Math.round(dest.y)}` : null;
}

function travelWhy(e) {
	return (e && (e.reason || e.message)) || String(e);
}

/* Where we ended up relative to the target, for the blacklist entry. Across
   maps an x/y distance is meaningless, so say that instead of printing a
   number that reads like one. */
function travelDistanceNote(dest) {
	if (!dest) return 'no destination';
	if (character.map !== dest.map) return `stuck on ${character.map}, target is on ${dest.map}`;
	return `${Math.round(distance(character, dest))} units short on ${dest.map}`;
}

/* ARRIVAL IS A RANGE, NOT A PROMISE THAT smart_move RESOLVED. The old test was
   purely "did smart_move settle without throwing", and kiting breaks that: a
   kite step is an ordinary move command, it PREEMPTS the pathfinder, smart_move
   rejects, and noteTravelFailure counts a failure against a spot we are standing
   on and fighting the intended monster at. Three of those and the spot is
   reported unreachable. Kite steps are moveDistance 50 / disengageDistance 70,
   so a few of them compound to well inside this radius while the fight is ON the
   destination. 200 sits clear of that and of the cohesion leash (150), and well
   under the handoff (400) so it cannot mask a route that left us hundreds short -
   travelDistanceNote still logs "N units short", so the figure is checkable. */
function travelAtDestination(dest) {
	if (!dest) return false;
	if (character.map !== dest.map) return false;
	return distance(character, dest) <= (TRAVEL.arrivalRadius || 200);
}

/* Failures count against ONE destination. A new spot starts at zero - without
   this, a spot inherits the previous spot's strikes and is condemned before it
   has been tried even once. */
function noteTravelTarget(dest) {
	const key = travelKey(dest);
	if (key === travelState.target) return;
	travelState.target = key;
	travelState.failures = 0;
	travelState.lastError = null;
	travelState.lastDistance = null;
}

function travelArrived() {
	travelState.failures = 0;
	travelState.lastError = null;
	travelState.lastDistance = null;
}

/* `note` is how close we got BEFORE town() moved us. Pass it whenever it is
   known: "142 units short" is the diagnostic that distinguishes a pathing
   problem at the target from a spot he never got near, and reading the
   position after the town() fallback would report where town is instead. */
function noteTravelFailure(dest, why, note) {
	/* Standing on it is not failing to reach it. -> travelAtDestination */
	if (travelAtDestination(dest)) {
		travelArrived();
		game_log(`Travel reported "${why}" but we are at ${dest.map} within ${TRAVEL.arrivalRadius || 200}u - counting it as arrived`, '#7FD98A');
		return;
	}
	travelState.failures++;
	travelState.lastError = why;
	travelState.lastDistance = note || travelDistanceNote(dest);
	game_log(`Travel attempt ${travelState.failures}/${TRAVEL.maxAttempts} failed: ${why} (${travelState.lastDistance})`, 'orange');
}

/* One sentence for a log line or a blacklist entry. */
function travelFailureDetail() {
	return `${travelState.failures} failed travel attempts; last error: ${travelState.lastError}; ${travelState.lastDistance}`;
}

async function travelTo(dest) {
	if (!dest || travelState.inFlight) return false;
	noteTravelTarget(dest);

	const myAttempt = ++travelState.attemptId;
	const mine = () => travelState.attemptId === myAttempt;
	travelState.inFlight = true;
	travelState.startedAt = Date.now();

	let closest = null;   // how near we got before town() relocated us
	try {
		try {
			await safeSmartMove(dest);
			if (mine()) travelArrived();
			return true;
		} catch (e) {
			if (!mine()) return false;   // the watchdog already gave up on this attempt
			travelState.lastError = travelWhy(e);
			closest = travelDistanceNote(dest);
		}

		// town() only reaches the CURRENT map's town point, so it is a way out
		// of a dead end rather than a way to the target - the real route still
		// has to be tried again afterwards.
		try {
			await town();
		} catch (e) {
			if (mine()) noteTravelFailure(dest, `no route (${travelState.lastError}) and town() failed too (${travelWhy(e)})`, closest);
			return false;
		}
		if (!mine()) return false;

		try {
			await safeSmartMove(dest);
			if (mine()) travelArrived();
			return true;
		} catch (e) {
			if (mine()) noteTravelFailure(dest, `still no route after town(): ${travelWhy(e)}`, closest);
			return false;
		}
	} finally {
		if (mine()) travelState.inFlight = false;
	}
}

/* A wedged pathfinder looks exactly like a working one.

   travelWatchdog only orphans an attempt while travelState.inFlight is true.
   Measured 2026-09-29 on MageofOz that flag was FALSE while smart.moving and
   smart.searching were both true with an empty plot, and he had not moved one
   unit in 55 consecutive one-second samples, 43 minutes after the last travel
   attempt began. Nothing in this file could recover that, and handleReturnHome()
   returns early while smart.moving is true - so the wedge blocked its own repair.

   Deliberately keyed off POSITION, not off any flag: every flag involved was
   lying. Threshold is generous because a legitimate long smart_move across a
   map still moves the character continuously. */
const stuckState = { x: null, y: null, since: 0, fires: 0 };

function unstickWatchdog() {
	const cfg = (CONFIG.party && CONFIG.party.cohesion) || {};
	const ms = cfg.stuckMs || 20000;
	const believesMoving = !!character.moving
		|| (typeof smart !== 'undefined' && smart && (smart.moving || smart.searching));
	if (!believesMoving || character.rip) { stuckState.x = null; return false; }

	const now = Date.now();
	if (stuckState.x === null
		|| Math.hypot(character.real_x - stuckState.x, character.real_y - stuckState.y) > 15) {
		stuckState.x = character.real_x;
		stuckState.y = character.real_y;
		stuckState.since = now;
		return false;
	}
	if (now - stuckState.since < ms) return false;

	try { stop(); } catch (e) { }
	if (typeof smart !== 'undefined' && smart) {
		smart.moving = false; smart.searching = false; smart.found = false; smart.plot = [];
	}
	/* Orphan any late resolution the same way travelWatchdog does, so a
	   smart_move that settles after we gave up cannot mark an arrival. */
	travelState.inFlight = false;
	travelState.attemptId++;
	stuckState.since = now;
	stuckState.fires++;
	game_log('[unstick] believed moving but held position for '
		+ Math.round(ms / 1000) + 's - cleared the path (' + stuckState.fires + ')', 'orange');
	return true;
}

function travelWatchdog(dest) {
	if (!travelState.inFlight) return;
	if (Date.now() - travelState.startedAt < TRAVEL.attemptTimeoutMs) return;
	travelState.attemptId++;        // orphan it: the late resolution becomes a no-op
	travelState.inFlight = false;
	noteTravelFailure(dest, `smart_move never returned after ${Math.round(TRAVEL.attemptTimeoutMs / 1000)}s`);
}

function handleReturnHome() {
	if (!destination) return;
	noteTravelTarget(destination);
	// Only compare positions on the same map - an x/y distance across maps is
	// meaningless, and a coincidental match would park us on the wrong map.
	if (character.map === destination.map && distance(character, destination) < 20) return;
	if (smart.moving || travelState.inFlight) return;
	travelTo(destination);   // handles its own failures; nothing here can reject
}

async function walkInCircle() {
	if (smart.moving) return;
	const center = destination, r = CONFIG.movement.circleRadius, now = performance.now();
	const dt = Math.min((now - state.lastAngleUpdate) / 1000, 0.5);
	state.lastAngleUpdate = now;
	state.angle = (state.angle + (character.speed / r) * dt) % (2 * Math.PI);
	if (!character.moving) await safeMove(center.x + Math.cos(state.angle) * r, center.y + Math.sin(state.angle) * r);
}

// ============================================================================
// LOOTING
// ============================================================================
const CHEST_STORAGE_KEY = 'loot_chest_ids';

function loadChestMap() {
	const data = get(CHEST_STORAGE_KEY);
	return typeof data === 'object' && data !== null ? data : {};
}
function saveChestMap(map) { set(CHEST_STORAGE_KEY, map); }
function removeChestId(id) {
	const stored = loadChestMap();
	if (stored[id]) { delete stored[id]; saveChestMap(stored); }
}
function updateChestsInStorage() {
	const stored = loadChestMap();
	const now = performance.now();
	for (const id of Object.keys(get_chests())) {
		if (!stored[id]) stored[id] = now;
	}
	saveChestMap(stored);
}

async function handleLooting() {
	const chestMap = loadChestMap();
	const ids = Object.keys(chestMap);
	if (!ids.length) return;

	// Date.now(), not performance.now() - see the version header.
	const now = Date.now();
	const cap = CONFIG.looting.maxPerPass || 25;
	const done = [];
	let looted = 0;

	for (const id of ids) {
		if (looted >= cap) break;
		const storedAt = chestMap[id];
		if (!storedAt) { done.push(id); continue; }
		const age = now - storedAt;
		// Negative age = a stamp from a dead clock. Loot rather than strand.
		if (age >= 0 && age < CONFIG.looting.lootCooldown) continue;
		try {
			await loot(id);
			looted++;
		} catch (e) {
			console.error('loot(' + id + ') failed, dropping:', e);
		}
		done.push(id);
	}

	// One write per pass rather than a whole-map rewrite per chest.
	if (done.length) {
		const stored = loadChestMap();
		for (const id of done) delete stored[id];
		saveChestMap(stored);
	}
}
setInterval(updateChestsInStorage, 250);

// ============================================================================
// SELLING -> CONFIG.selling. On, sellItems() offloads the whitelist to the
// nearest vendor; off, it is inert and nothing is sold.
// ============================================================================
function sellItems() {
	if (!CONFIG.selling.enabled) return;
	const whitelist = new Set(CONFIG.selling.whitelist);
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && whitelist.has(item.name) && item.p === undefined && item.l !== 'l') sell(i);
	}
}

// ============================================================================
// MULING -> CONFIG.muling. On, surplus is carried to muleName (falling back
// to fallbackMuleName); off, it is inert and loot just accumulates.
// ============================================================================
function muleToMerchant() {
	const cfg = CONFIG.muling;
	const mule = get_player(cfg.muleName) || get_player(cfg.fallbackMuleName);
	if (!mule || !is_in_range(mule, 'attack')) return;

	if (character.gold > cfg.goldReserve) {
		send_gold(mule, character.gold - cfg.goldReserve);
	}

	character.items.forEach((item, i) => {
		if (item && !cfg.excludeItems.has(item.name) && !item.l && !item.s) {
			send_item(mule.id, i, item.q ?? 1);
		}
	});
}

// ============================================================================
// TEMPORAL SURGE COORDINATION (shared rotation with Ranger.js / Priest.js)
// ============================================================================
function getTemporalRotation() {
	// get()/set() are the game's own storage functions - unlike localStorage
	// (a browser-only Web API), these work identically in a real browser tab
	// and on Mainframe's sandboxed runtime.
	const stored = get(CONFIG.temporal.storageKey);
	if (!stored) {
		const initial = { lastUser: null, nextIndex: 0, lastKillTime: 0 };
		set(CONFIG.temporal.storageKey, initial);
		return initial;
	}
	return stored;
}

function updateTemporalRotation() {
	const rotation = getTemporalRotation();
	rotation.lastUser = character.name;
	rotation.nextIndex = (rotation.nextIndex + 1) % CONFIG.temporal.characters.length;
	rotation.lastKillTime = Date.now();
	set(CONFIG.temporal.storageKey, rotation);
}

function isMyTurnForTemporal() {
	const rotation = getTemporalRotation();
	const myIndex = CONFIG.temporal.characters.indexOf(character.name);
	if (myIndex === -1) return false;
	return rotation.lastUser === null || rotation.nextIndex === myIndex;
}

async function handleTemporalSurge() {
	if (!CONFIG.temporal.enabled) return;
	if (!isMyTurnForTemporal()) return;

	const orbSlot = character.items.findIndex(i => i?.name === 'orboftemporal');
	if (orbSlot === -1) return; // MageofOz may not own this orb - silently skip

	try {
		equip(orbSlot, 'orb');
		use_skill(CONFIG.temporal.skillName);
		game_log(`Temporal Surge used on ${CONFIG.temporal.targetMob}!`, '#00FFFF');
		updateTemporalRotation();
	} catch (e) {
		console.error('Temporal surge error:', e);
	}
}

parent.socket.on('kill_credit', async (data) => {
	if (!CONFIG.temporal.enabled) return;
	if (data.mtype !== CONFIG.temporal.targetMob) return;
	if (!is_on_cooldown(CONFIG.temporal.skillName)) {
		await handleTemporalSurge();
	}
});

// ============================================================================
// PARTY MANAGEMENT (same leader/follower pattern as Ranger.js / Priest.js)
// ============================================================================
function partyMaker() {
	if (!CONFIG.party.autoManage) return;

	const group = CONFIG.party.groupMembers;
	const leaderName = group[0]; // Dexon leads
	const party = get_party() || {};
	const partyLead = get_entity(leaderName);

	if (character.name === leaderName) {
		for (let i = 1; i < group.length; i++) {
			const name = group[i];
			if (name === character.name || party[name]) continue;
			send_party_invite(name);
		}
	} else {
		if (!party[character.name] && partyLead) {
			send_party_request(leaderName);
		}
	}
}

function on_party_request(name) {
	if (CONFIG.party.groupMembers.includes(name)) accept_party_request(name);
}
function on_party_invite(name) {
	if (CONFIG.party.groupMembers.includes(name)) accept_party_invite(name);
}

// ============================================================================
// EVENT HANDLERS - CODE messages
// ============================================================================
// ============================================================================
// MONSTER HUNT - THE FOLLOWER HALF. BYTE-IDENTICAL IN Priest.js AND Mage.js.
// ============================================================================
/* Dexon owns every decision. This half only does the things that cannot be
   done on our behalf, and there are exactly two of them.
   -> MageComments.md#dexon-owns-every-decision-this-half-only */
const MH_LEADER = 'Dexon';
const MH_DAISY = { map: 'main', x: 126, y: -413 };
/* The server's own gate is B.sell_dist = 400 against G.maps.main.ref
   .monsterhunter. Stop well inside it: the client's idea of our position and
   the server's disagree while moving, and a request refused for distance is
   indistinguishable from one refused for any other reason. */
const MH_DAISY_RADIUS = 340;
const MH_TRIP_MS = 120000;

let mhMode = 'farm';     // what the leader last told us we are doing
let mhBusy = false;      // a Daisy trip owns movement; mainLoop stands down

function mhLog(m, c) { try { game_log('[mh] ' + m, c || '#9FD3FF'); } catch (e) { } console.log('[mh] ' + m); }

/* The shard string the server stamps into the hunt, rebuilt from the client.
   Measured 2026-10-03: the server writes 'region + " " + server_name' and a
   live hunt read back as sn: "US IV", which is exactly this. */
function mhShard() {
	try { return String(parent.server_region) + ' ' + String(parent.server_identifier); } catch (e) { return null; }
}

function mhHunt() { try { return (character.s && character.s.monsterhunt) || null; } catch (e) { return null; } }

function mhAtDaisy() {
	try {
		return character.map === MH_DAISY.map
			&& Math.hypot(character.x - MH_DAISY.x, character.y - MH_DAISY.y) <= MH_DAISY_RADIUS;
	} catch (e) { return false; }
}

/* Everything the leader needs in order to rank us - and, when we are useless,
   why. 'stale' is the one that matters most: hunt credit is shard-locked
   (monster_hunt_logic returns on its first line unless sn matches the current
   shard) and nothing in the game logs it, so a hop silently freezes progress. */
function mhReport(why) {
	const h = mhHunt();
	const shard = mhShard();
	const payload = {
		message: 'mh_report', why: why || 'asked',
		id: h ? h.id : null,
		c: h ? h.c : null,
		ms: h ? h.ms : null,
		sn: h ? h.sn : null,
		shard: shard,
		stale: !!(h && shard && h.sn !== shard),
		atDaisy: mhAtDaisy(),
		esize: character.esize,
	};
	try { plSend([MH_LEADER], payload); } catch (e) { mhLog('report failed: ' + e, 'orange'); }
	return payload;
}

async function mhGoDaisy() {
	if (mhAtDaisy()) return true;
	/* TAKE THE WHEEL FROM A TRIP ALREADY IN FLIGHT, OR LOSE THE RACE TO IT.

	   A farm or hunt trip started by mainLoop keeps running inside its own
	   travelTo() call after mainLoop stands down on mhBusy - standing down stops
	   NEW movement, it does not cancel movement already under way. Both trips
	   then own the one smart_move the client gives us, and the Daisy trip is the
	   one that loses, because travelTo's recovery path is far more aggressive
	   than ours: when its smart_move is interrupted it calls town(), which
	   TELEPORTS, and then re-issues smart_move(dest). So every Daisy attempt was
	   cut short, and the character was yanked back toward the farm target.
	   -> MageComments.md#take-the-wheel-from-a-trip-already */
	if (typeof travelState !== 'undefined' && travelState.inFlight) {
		mhLog('taking movement from a live trip to ' + travelState.target, '#8b98ab');
		travelState.attemptId++;      // orphan it: travelTo's mine() goes false
		travelState.inFlight = false;
	}
	try {
		await noHang(smart_move({ map: MH_DAISY.map, x: MH_DAISY.x, y: MH_DAISY.y }), 'mh daisy', MH_TRIP_MS);
	} catch (e) {
		mhLog('could not reach Daisy: ' + ((e && (e.reason || e.message)) || e), 'orange');
	}
	return mhAtDaisy();
}

/* ACCEPT. One emit, and the server's answer depends on state we have to check
   ourselves, because all three outcomes come back on the same channel:
   no hunt -> assigned, c > 0 -> "monsterhunt_already" and NOTHING changes,
   c === 0 -> turned in. Measured 2026-10-03. So a held hunt is reported as-is
   rather than re-emitted for: re-emitting cannot reroll it. */
async function mhAccept() {
	if (mhBusy) { mhLog('already on a Daisy trip', '#8b98ab'); return false; }
	mhBusy = true;
	try {
		const have = mhHunt();
		if (have && have.c) {
			mhLog('already holding ' + have.id + ' x' + have.c + ' - cannot reroll, reporting it', '#8b98ab');
			mhReport('already held');
			return true;
		}
		/* add_item needs somewhere to put the token. Without a slot the hunt can
		   be accepted and then not pay out, which is the worst of both. */
		if (!character.esize) {
			mhLog('no free inventory slot - not accepting', 'orange');
			mhReport('no slot');
			return false;
		}
		if (!(await mhGoDaisy())) { mhReport('could not reach Daisy'); return false; }
		try { parent.socket.emit('monsterhunt'); }
		catch (e) { mhLog('emit failed: ' + e, 'red'); mhReport('emit failed'); return false; }
		await sleep(1500);
		const h = mhHunt();
		if (h) mhLog('accepted ' + h.id + ' x' + h.c + ' on ' + h.sn, '#7FD98A');
		else mhLog('no hunt after the emit - the server refused it', 'orange');
		mhReport(h ? 'accepted' : 'refused');
		return !!h;
	} finally { mhBusy = false; }
}

/* TURN IN. Only when the count has actually reached zero - emitting early is
   the "monsterhunt_already" no-op, which is harmless but tells the leader
   nothing, so we check first and say so. */
async function mhTurnIn() {
	if (mhBusy) { mhLog('already on a Daisy trip', '#8b98ab'); return false; }
	const h = mhHunt();
	if (!h) { mhLog('nothing to turn in', '#8b98ab'); mhReport('nothing to turn in'); return false; }
	if (h.c) { mhLog(h.id + ' still needs ' + h.c, '#8b98ab'); mhReport('not finished'); return false; }
	mhBusy = true;
	try {
		if (!(await mhGoDaisy())) { mhReport('could not reach Daisy'); return false; }
		try { parent.socket.emit('monsterhunt'); }
		catch (e) { mhLog('emit failed: ' + e, 'red'); mhReport('emit failed'); return false; }
		await sleep(1500);
		const done = !mhHunt();
		mhLog(done ? 'turned in - token collected' : 'emitted but the hunt is still here', done ? '#7FD98A' : 'orange');
		mhReport(done ? 'turned in' : 'turn-in did not take');
		return done;
	} finally { mhBusy = false; }
}

/* The leader's instructions. Dispatched from on_cm, Dexon only. */
function mhOnMessage(data) {
	const m = data && data.message;
	if (m === 'mh_accept') { mhAccept().catch((e) => mhLog('accept threw: ' + ((e && e.message) || e), 'red')); return; }
	if (m === 'mh_turnin') { mhTurnIn().catch((e) => mhLog('turn-in threw: ' + ((e && e.message) || e), 'red')); return; }
	if (m === 'mh_ask') { mhReport('asked'); return; }
	if (m === 'mh_mode') {
		const was = mhMode;
		mhMode = data.mode === 'hunt' ? 'hunt' : 'farm';
		if (was !== mhMode || data.force) {
			mhLog(mhMode === 'hunt'
				? ('heading to a HUNT: ' + (data.target || '?') + '@' + (data.map || '?') + (data.why ? ' (' + data.why + ')' : ''))
				: ('back to FARMING' + (data.why ? ' (' + data.why + ')' : '')),
				mhMode === 'hunt' ? '#FFD700' : '#7FD98A');
		}
		return;
	}
	if (m === 'mh_release') { mhBusy = false; mhLog('released', '#8b98ab'); return; }
}

function mhStatus() {
	const h = mhHunt();
	const out = { mode: mhMode, busy: mhBusy, shard: mhShard(), atDaisy: mhAtDaisy(),
		hunt: h ? { id: h.id, c: h.c, minsLeft: Math.round((h.ms || 0) / 60000), sn: h.sn } : null,
		stale: !!(h && h.sn !== mhShard()), esize: character.esize };
	mhLog(JSON.stringify(out), '#9FD3FF');
	return out;
}

/* ============================================================================
   BOSS HOP - THE FOLLOWER HALF. BYTE-IDENTICAL IN Priest.js AND Mage.js.
   ============================================================================
   Dexon runs the scanner, Dexon decides, and these two only obey. There is no
   second opinion here on purpose: three independent pickers reading slightly
   different server_info snapshots would scatter the party across three shards,
   and a party split across shards earns the 1.00 solo multiplier instead of
   1.30. Whatever this does with the message, it must do the same in both
   files - hence the byte-identical rule, the same one the MONSTER HUNT
   follower half carries.

   WHY THEY HAVE TO COME AT ALL. Achievement score is a MAX across the account
   rather than a sum, so a follower's own credit is usually worth nothing. The
   party multiplier is not: 1 + 0.3/divider per own non-merchant party member,
   divider 2 on a cooperative boss. They are there for Dexon's multiplier, and
   that requires being LIVE IN THAT SHARD'S PROCESS WHEN THE BOSS DIES - the
   award loop resolves contributors through players[name_to_id[name]] and
   silently skips anyone who has left. Arriving late still counts; leaving
   early does not.
   -> MageComments.md#boss-hop-the-follower-half-byte-identical */
/* A FOLLOWER THAT FAILS TO HOP COULD NEVER RETRY, AND THAT IS WHY THE MARK IS
   NO LONGER WHAT GOES IN FIRST. Operator, 22:00 EU III franky window:
   "MageofOz did not hop with the party I had to do that."

   The acted-list mark had to be written BEFORE change_server, because nothing
   after that call runs - and the consequence was that a hop which THREW or
   no-opped became indistinguishable from one that succeeded, permanently: the
   plid is durable in CODE storage and the dedupe refuses every retry. The catch
   logged and gave up. Measured by the browser session with both followers on
   EU III: identical last acted plid on each, the priest's trip starting 12s
   after that plid's timestamp and the mage's 100s after it, which is when the
   operator moved him by hand. One message, two consumers, one completion - and
   the one that failed had already marked it. Background-tab throttling was ruled
   out rather than assumed: 60 ticks in 6s on both tabs.

   SO THE RECORD IS PENDING FIRST AND ACTED ONLY ON ARRIVAL. A hop that worked
   lands on the shard it was ordered to and confirms itself on the next
   evaluation; one that did not leaves a pending entry that retries. That is the
   only moment the two can be told apart, because the success case destroys the
   page before it could report anything.

   THREE THINGS BOUND IT, since a retry loop is worse than a missed hop:
   - PL_HOP_GRACE_MS before a silent navigation is called failed, so a hop still
     in flight is not retried on top of itself.
   - PL_HOP_TRIES_MAX, after which the plid IS marked acted and the order is
     abandoned loudly. A shard that refuses us forever must not reload forever.
   - A storage write that fails falls back to marking acted, because without a
     durable pending record the retry machinery cannot work and a replay loop is
     the worse failure. */
const PL_HOP_PENDING_KEY = 'pl_hop_pending';
/* Only a page teardown has to fit inside this, which is the same reasoning and
   the same value as the leader's own HOP_RELOAD_GRACE_MS. */
const PL_HOP_GRACE_MS = 15000;
const PL_HOP_TRIES_MAX = 3;

function plHopPendingRead() {
	try { return get(PL_HOP_PENDING_KEY) || null; }
	catch (e) { plLog('pending-hop read failed: ' + e, 'orange'); return null; }
}
function plHopPendingWrite(p) {
	try { set(PL_HOP_PENDING_KEY, p); return true; }
	catch (e) {
		plLog('could not record the pending hop (' + e + ') - this hop will not retry', 'red');
		return false;
	}
}
function plHopPendingClear() {
	try { set(PL_HOP_PENDING_KEY, null); }
	catch (e) { plLog('could not clear the pending hop: ' + e, 'orange'); }
}

/* Runs at module load - so a successful hop confirms itself the moment the new
   page evaluates, BEFORE the backlog that ordered it is re-read - and on an
   interval, so a hop that never navigated is retried without one. */
function plHopPendingResolve() {
	const p = plHopPendingRead();
	if (!p || !p.plid) return;
	let here = null;
	try {
		const rg = parent.server_region;
		const id = parent.server_identifier;
		/* BOTH HALVES HAVE TO BE REAL, and a bare concatenation does not check
		   that: `undefined + undefined` is the STRING "undefinedundefined",
		   which is truthy and compares unequal to every real shard - so the
		   `!here` guard below would never fire and an unreadable shard would
		   read as "wrong shard" and retry a hop that may already have landed.
		   Found by the suite rather than by reading. */
		if (typeof rg === 'string' && rg && typeof id === 'string' && id) here = rg + id;
	} catch (e) { plLog('pending-hop: cannot read the current shard (' + e + ')', 'orange'); }
	/* Cannot tell where we are, so decide nothing. Retrying blind would hop a
	   character that had already arrived. */
	if (!here) return;
	if (here === p.land) {
		plMarkActed(p.plid);
		plHopPendingClear();
		plLog('boss_hop ' + p.plid + ' landed on ' + p.land, '#8b98ab');
		return;
	}
	if (Date.now() - (p.at || 0) < PL_HOP_GRACE_MS) return;
	if ((p.tries || 0) >= PL_HOP_TRIES_MAX) {
		plMarkActed(p.plid);
		plHopPendingClear();
		plLog('boss_hop to ' + p.land + ' failed ' + p.tries + ' times - giving up on it', 'red');
		return;
	}
	p.tries = (p.tries || 0) + 1;
	p.at = Date.now();
	if (!plHopPendingWrite(p)) { plMarkActed(p.plid); return; }
	plLog('boss_hop to ' + p.land + ' did not take - retry ' + p.tries + ' of ' + PL_HOP_TRIES_MAX, 'orange');
	try { change_server(p.region, p.name); }
	catch (e) { plLog('boss_hop retry failed: ' + e, 'red'); }
}

plHopPendingResolve();
setInterval(plHopPendingResolve, PL_HOP_GRACE_MS);

function bossHopFollow(data) {
	if (!data || !data.region || !data.name) {
		game_log(`boss_hop ignored: no destination in ${JSON.stringify(data)}`, 'orange');
		return;
	}
	const shard = data.shard || `${data.region}${data.name}`;
	const mtype = data.mtype || 'a boss';
	/* ALREADY HERE. change_server to the shard we are standing on is a pure
	   page reload, and the reload is what re-reads the backlog that sent us
	   here - so without this the message becomes its own cause. This is the
	   shape the operator actually saw on 2026-10-18: two followers on US V,
	   each "hopping" to US V, reloading in place.
	   The `parent.` prefix is REQUIRED, not stylistic: measured live
	   2026-10-18, bare `server_region` is undefined in the CODE context and
	   only the parent-window form resolves. Simplifying it away would turn
	   this guard off without changing anything visible. */
	let here = null;
	try { here = parent.server_region + parent.server_identifier; }
	catch (e) { game_log(`boss_hop: cannot read the current shard (${e}) - same-shard guard off for this message, the acted-list below still applies`, 'orange'); }
	if (here && here === shard) {
		game_log(`boss_hop to ${shard} ignored - already there`, '#8b98ab');
		return;
	}
	/* ALREADY DONE. The same-shard guard above is not enough on its own: a
	   replayed boss_hop naming a DIFFERENT shard clears it, reloads, and the
	   party bounces between shards instead of reloading in place - the same
	   loop wearing movement. Only a DURABLE record separates a replay from a
	   fresh order, because plSeen dies with the page. */
	if (plActed(data._plid)) {
		game_log(`boss_hop ${data._plid} already acted on - not hopping again`, '#8b98ab');
		return;
	}
	/* ALREADY IN FLIGHT. plHopPendingResolve owns the retries for a plid it is
	   holding, so a replay of that same order must not fire a second
	   change_server on top of the first. */
	const inFlight = plHopPendingRead();
	if (inFlight && inFlight.plid === data._plid) {
		game_log(`boss_hop ${data._plid} already in flight - leaving it to the retry`, '#8b98ab');
		return;
	}
	/* Both of these go BEFORE change_server, for the same reason the leader
	   sends the message before hopping: nothing after that call runs. The log
	   used to sit after it, which is why the follower never logged its own
	   hop and the console looked empty while this was happening. */
	/* PENDING, not acted - see plHopPendingResolve above for why, and for what
	   bounds the retry. `land` is region+name rather than data.shard, because
	   that is where change_server actually sends us and therefore the only
	   string an arrival can be compared against. */
	if (inFlight && inFlight.plid) {
		/* A newer order supersedes an older one, and the old plid is marked so
		   abandoning it cannot leave it to replay later. */
		plMarkActed(inFlight.plid);
		plLog(`superseding the pending hop to ${inFlight.land}`, 'orange');
	}
	if (!plHopPendingWrite({
		plid: data._plid, region: data.region, name: data.name,
		land: `${data.region}${data.name}`, mtype: mtype, at: Date.now(), tries: 0,
	})) {
		plMarkActed(data._plid);
	}
	game_log(`🐉 Following Dexon to ${shard} for ${mtype}`, '#FFD700');
	try {
		change_server(data.region, data.name);
	} catch (e) {
		game_log(`boss_hop follow failed: ${e}`, 'red');
	}
}

function on_cm(name, data) {
	if (!plFirstTime(data && data._plid)) return;   // same message may arrive twice: in-game and relayed
	if (data.message === 'boss') { bossOnCall(name, data); return; }
	if (data.message === 'rageentry') { rageEntryOnCall(name, data); return; }
	if (name === 'Dexon' && typeof data.message === 'string' && data.message.indexOf('mh_') === 0) { mhOnMessage(data); return; }
	if (name === "Dexon" && data.message === 'farm_spot') {
		const changed = home !== data.home || mobMap !== data.mobMap;
		home = data.home;
		mobMap = data.mobMap;
		destination = { map: data.mobMap, x: data.x, y: data.y };
		rageAlso = Array.isArray(data.also) ? data.also.slice() : [];
		ragePullShared = (typeof data.pullConcurrent === 'number') ? data.pullConcurrent : null;
		if (changed) resetXpTracker();
	}
	// Dexon's "Return" button broadcasts its location to FatherToken and
	// MageofOz so they can respawn/regroup - same pattern as Priest.js.
	if (name === "Dexon" && data.message === "location") {
		respawn();
		smart_move({ x: data.x, y: data.y, map: data.map });
		game_log("Respawning & Moving to Dexon");
	}
	if (name === "Dexon" && data.message === "boss_hop") { bossHopFollow(data); }
	if (name === "Meltymerch" && data.message === "come_to_merchant") {
		state.waitingForMerchant = true;
		state.waitingForMerchantSince = Date.now();
		game_log('Meltymerch needs me to come to him', '#FFD700');
		smart_move({ x: data.x, y: data.y, map: data.map });
	}
	if (name === "Meltymerch" && data.message === "merchant_done") {
		state.waitingForMerchant = false;
		game_log('Merchant business done - resuming', '#00FF00');
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
// DPS SELF-REPORT - feeds Dexon's dynamic farm spot search, since he can't
// see MageofOz's exact live stats directly.
// ============================================================================
function reportDps() {
	const dps = (character.attack || 0) * (character.frequency || 0);
	// maxHp/level ride along so Dexon's farm-spot search can check whether
	// THIS character specifically would come out net-positive on xp at a
	// candidate spot, not just the party in aggregate.
	plSend('Dexon', { message: 'dps_report', damageType: 'magical', dps, maxHp: character.max_hp, level: character.level });
}
setInterval(reportDps, 10000);
reportDps();

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Game API rejections are often plain objects (e.g. {reason, message}), not
// real Error instances - console.error() on those just prints
// "[object Object]" with no way to see what actually went wrong. This pulls
// out whatever's actually useful: a real Error's .message, an object's own
// .message/.reason fields, or a JSON dump as a last resort.
function describeError(e) {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object') {
		if (e.message) return e.message;
		if (e.reason) return e.reason;
		try { return JSON.stringify(e); } catch { /* fall through */ }
	}
	return String(e);
}

// ============================================================================
// START ALL LOOPS
// ============================================================================
mainLoop();
actionLoop();
skillLoop();
maintenanceLoop();
potionLoop();

// ============================================================================
// BROWSER-ONLY UI EXTRAS (Kill Tracker, Gold Meter, Game Log Filter, DPS
// Meter v4, Party Frames) - these render DOM/jQuery UI and do nothing
// useful on Mainframe (per the game's own docs on UI/button functions), so
// this entire block is skipped there rather than erroring. Each piece is
// wrapped in its own IIFE so none of their internal variable names can
// collide with each other or with anything else in this script.
// ============================================================================
if (parent.$) {

	// --- Kill Tracker ---
	(function () {
		if (parent.killTrackerInitialized) return; // guard against duplicate 'death' listeners if this script ever re-runs without a full page reload
		parent.killTrackerInitialized = true;

		let deaths = 0; // Variable to track the number of deaths
		const killTime = new Date(); // Start time to calculate elapsed time

		game.on('death', function (data) {
			if (parent.entities[data.id]) { // Check if the entity exists
				const mob = parent.entities[data.id];
				const mobName = mob.type;

				// Check if the mob is a monster
				if (mobName === 'monster') {
					const mobTarget = mob.target; // Get the mob's target
					const party = get_party(); // Get your party members

					// If party exists, extract party member names into an array
					const partyMembers = party ? Object.keys(party) : [];

					// Check if the mob's target was the player or someone in the party
					if (mobTarget === character.name || partyMembers.includes(mobTarget)) {
						console.log(data); // Log the death event
						deaths++; // Increment the death count
						killHandler(); // Call the killHandler function
					}
				}
			}
		});

		function killHandler() {
			const elapsed = (new Date() - killTime) / 1000; // Calculate elapsed time in seconds
			if (elapsed > 0) { // Prevent division by zero
				const deathsPerSec = deaths / elapsed; // Calculate deaths per second
				const dailyKillRate = calculateKillRate(deathsPerSec); // Calculate deaths based on interval

				add_top_button("kpm", Math.round(dailyKillRate.kpm).toLocaleString() + ' kpm'); // Deaths per minute
				add_top_button("kph", Math.round(dailyKillRate.kph).toLocaleString() + ' kph'); // Deaths per hour
				add_top_button("kpd", Math.round(dailyKillRate.kpd).toLocaleString() + ' kpd'); // Deaths per day
			} else {
				console.warn("Elapsed time is zero, cannot calculate rates.");
			}
		}

		// Function to calculate deaths based on the interval
		function calculateKillRate(deathsPerSec) {
			let kpm = deathsPerSec * 60; // Convert to deaths per minute
			let kph = kpm * 60; // Convert to deaths per hour
			let kpd = kph * 24; // Convert to deaths per day
			return { kpm, kph, kpd };
		}
	})();

	// --- Gold Meter ---
	(function () {
		if (parent.goldMeterInitialized) return; // guard against duplicate 'loot' listeners if this script ever re-runs without a full page reload
		parent.goldMeterInitialized = true;

		let sumGold = 0, largestGoldDrop = 0, interval = 'hour';
		const startTime = performance.now();
		const intervals = { minute: 60000, hour: 3600000, day: 86400000 };

		const init = () => {
			const $ = parent.$;
			$('#bottomrightcorner').find('#goldtimer').remove();
			const container = $('<div id="goldtimer"></div>').css({ fontSize: '25px', color: 'white', textAlign: 'center', display: 'table', overflow: 'hidden', marginBottom: '-5px', width: "100%" });
			$('<div id="goldtimercontent"></div>').css({ display: 'table-cell', verticalAlign: 'middle' }).appendTo(container);
			$('#bottomrightcorner').children().first().after(container);

			const countPartyChars = () => {
				let count = 0;
				for (const name in parent.party) {
					if (name === character.name || parent.entities[name]?.owner === character.owner) count++;
				}
				return count;
			};

			character.on("loot", d => {
				if (d.gold && typeof d.gold === 'number' && !Number.isNaN(d.gold)) {
					const myGold = Math.round(d.gold * countPartyChars());
					sumGold += myGold;
					if (myGold > largestGoldDrop) largestGoldDrop = myGold;
				}
			});

			setInterval(() => {
				const elapsed = performance.now() - startTime;
				const divisor = elapsed / intervals[interval];
				const avg = divisor > 0 ? (sumGold / divisor | 0) : 0;
				$('#goldtimercontent').html(`<div>${avg.toLocaleString('en')} Gold/${interval[0].toUpperCase() + interval.slice(1)}</div><div>${largestGoldDrop.toLocaleString('en')} Jackpot</div>`).css({ backgroundColor: 'rgba(0,0,0,1)', border: 'solid gray', borderWidth: '4px 4px', height: '50px', lineHeight: '25px', fontSize: '25px', color: '#FFD700', textAlign: 'center' });
			}, 500);
		};

		const setGoldInterval = i => ['minute', 'hour', 'day'].includes(i) ? interval = i : console.warn("Invalid interval. Use 'minute', 'hour', or 'day'.");
		setTimeout(init, 1000);
	})();

	// --- Game Log Filter ---
	(function () {
		const FILTERS = {
			kills: { show: false, regex: /killed/, label: 'Kills' },
			gold: { show: true, regex: /gold/, label: 'Gold' },
			party: { show: true, regex: /party/, label: 'Party' },
			items: { show: true, regex: /found/, label: 'Items' },
			upgrade: { show: true, regex: /(upgrade|combination)/, label: 'Upgrades' },
			errors: { show: true, regex: /(error|line|column)/i, label: 'Errors' },
			/* Routine client chatter that says nothing actionable during farming.
			   A tab rather than a hard suppression, so whichever way `show` is
			   set these can be read back when they ARE the question being
			   debugged.
			   -> MageComments.md#routine-client-chatter-that-says-nothing-actionable */
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

	// --- DPS Meter v4 ---
	(function () {
		// All currently supported damageTypes: "Base", "Blast", "Burn", "HPS", "MPS", "DR", "RF" "DPS"
		const damageTypes = ["Base", "Blast", "HPS", "DPS"];
		let displayClassTypeColors = true, displayDamageTypeColors = true, showOverheal = false, showOverManasteal = true;

		const damageTypeColors = { Base: '#A92000', Blast: '#782D33', Burn: '#FF7F27', HPS: '#9A1D27', MPS: '#353C9C', DR: '#E94959', RF: '#D880F0', DPS: '#FFD700', "Dmg Taken": '#FF4C4C' };
		const classColors = { mage: '#3FC7EB', paladin: '#F48CBA', priest: '#FFFFFF', ranger: '#AAD372', rogue: '#FFF468', warrior: '#C69B6D' };

		const METER_START = performance.now();
		const playerData = {};

		const getEntry = id => playerData[id] || (playerData[id] = { t: performance.now(), bD: 0, blD: 0, baD: 0, h: 0, m: 0, dr: 0, rf: 0, dtP: 0, dtM: 0 });

		const fmt = v => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

		parent.$('#bottomrightcorner').find('#dpsmeter').remove();
		const container = parent.$("<div id='dpsmeter'></div>").css({ fontSize: '20px', color: 'white', textAlign: 'center', display: 'table', overflow: 'hidden', marginBottom: '-3px', width: '100%', backgroundColor: 'rgba(0,0,0,1)' });
		container.append(parent.$("<div id='dpsmetercontent'></div>").css({ display: 'table-cell', verticalAlign: 'middle', padding: '2px', border: '4px solid grey' }));
		parent.$('#bottomrightcorner').children().first().after(container);

		/* Replace OUR previous 'hit' listener, and survive any that outlived us.
		   -> MageComments.md#replace-our-previous-hit-listener-and-survive */
		if (parent.dps_hit_handler) parent.socket.removeListener('hit', parent.dps_hit_handler);
		const onHit = d => {
			if (!parent || !parent.party_list) return;
			const inParty = id => parent.party_list.includes(id);
			if (!inParty(d.hid) && !inParty(d.id)) return;

			try {
				const dmg = d.damage || 0, isPlayer = get_player(d.id), isAttacker = get_player(d.hid);

				// Damage taken tracking
				if (dmg && isPlayer) {
					const e = getEntry(d.id);
					d.damage_type === 'physical' ? e.dtP += dmg : e.dtM += dmg;
				}
				if (d.dreturn && isAttacker) getEntry(d.hid).dtP += d.dreturn;
				if (d.reflect && isAttacker) getEntry(d.hid).dtM += d.reflect;

				// DR/RF attribution (only mob→player)
				if (d.dreturn && isPlayer && !get_player(d.hid)) getEntry(d.id).dr += d.dreturn;
				if (d.reflect && isPlayer && !get_player(d.hid)) getEntry(d.id).rf += d.reflect;

				// Attacker actions
				if (isAttacker) {
					const e = getEntry(d.hid);

					// Damage breakdown
					if (dmg) {
						d.source === 'burn' ? e.bD += dmg : d.splash ? e.blD += dmg : e.baD += dmg;
					}

					// Healing
					if (d.heal || d.lifesteal) {
						const target = get_player(d.id);
						e.h += showOverheal ? (d.heal || 0) + (d.lifesteal || 0) :
							(d.heal ? Math.min(d.heal, (target?.max_hp || 0) - (target?.hp || 0)) : 0) +
							(d.lifesteal ? Math.min(d.lifesteal, isAttacker.max_hp - isAttacker.hp) : 0);
					}

					// Mana steal
					if (d.manasteal) {
						e.m += showOverManasteal ? d.manasteal : Math.min(d.manasteal, isAttacker.max_mp - isAttacker.mp);
					}
				}
			} catch (err) {
				console.error('hit handler error', err);
			}
		};
		parent.dps_hit_handler = onHit;
		parent.socket.on('hit', onHit);

		const calcVal = (type, e, elapsed) => {
			const r = 1000 / elapsed;
			const vals = {
				DPS: (e.baD + e.blD + e.bD + e.dr + e.rf) * r,
				Burn: e.bD * r,
				Blast: e.blD * r,
				Base: e.baD * r,
				HPS: e.h * r,
				MPS: e.m * r,
				DR: e.dr * r,
				RF: e.rf * r,
				'Dmg Taken': { phys: e.dtP * r | 0, mag: e.dtM * r | 0 }
			};
			return type === 'Dmg Taken' ? vals[type] : vals[type] | 0;
		};

		setInterval(() => {
			const $ = parent.$, c = $('#dpsmetercontent');
			if (!c.length) return;

			const now = performance.now(), elapsed = now - METER_START;
			const hrs = elapsed / 3600000 | 0, mins = (elapsed % 3600000) / 60000 | 0;

			let html = `<div>👑 Elapsed Time: ${hrs}h ${mins}m 👑</div><table border="1" style="width:100%"><tr><th></th>`;
			damageTypes.forEach(t => html += `<th style='color:${displayDamageTypeColors ? damageTypeColors[t] || 'white' : 'white'}'>${t}</th>`);
			html += '</tr>';

			// Sort by DPS
			const sorted = Object.entries(playerData).map(([id, e]) => ({ id, e, dps: calcVal('DPS', e, now - e.t) })).sort((a, b) => b.dps - a.dps);

			sorted.forEach(({ id, e }) => {
				const p = get_player(id);
				if (!p) return;
				html += `<tr><td style='color:${displayClassTypeColors ? classColors[p.ctype.toLowerCase()] || '#FFF' : '#FFF'}'>${p.name}</td>`;
				damageTypes.forEach(t => {
					const v = calcVal(t, e, now - e.t);
					html += t === 'Dmg Taken' ? `<td><span style='color:#F44'>${fmt(v.phys)}</span> | <span style='color:#6CF'>${fmt(v.mag)}</span></td>` : `<td>${fmt(v)}</td>`;
				});
				html += '</tr>';
			});

			// Totals
			html += `<tr><td style='color:${damageTypeColors.DPS}'>Total DPS</td>`;
			damageTypes.forEach(t => {
				if (t === 'Dmg Taken') {
					let totP = 0, totM = 0;
					Object.values(playerData).forEach(e => {
						const v = calcVal(t, e, now - e.t);
						totP += v.phys; totM += v.mag;
					});
					html += `<td><span style='color:#F44'>${fmt(totP)}</span> | <span style='color:#6CF'>${fmt(totM)}</span></td>`;
				} else {
					let tot = 0;
					Object.values(playerData).forEach(e => tot += calcVal(t, e, now - e.t));
					html += `<td>${fmt(tot)}</td>`;
				}
			});
			html += '</tr></table>';
			c.html(html);
		}, 250);
	})();

	// --- Party Frames ---
	(function () {
		if (parent.party_style_prepared) parent.$('#style-party-frames').remove();

		parent.$('head').append(`<style id="style-party-frames">
.party-container {position: absolute; top: 55px; left: 0; width: 1000px; height: 300px; font-family: 'pixel';}
</style>`);
		parent.party_style_prepared = true;

		const DISPLAY_BARS = ['hp', 'mp', 'xp', 'xprate', 'xpeta']; // <-- Add 'cc', 'ping', 'share' as needed
		const FRAME_WIDTH = 80;
		const INCLUDE = ['mp', 'max_mp', 'hp', 'max_hp', 'name', 'max_xp', 'xp', 'level', 'share', 'cc', 'max_cc'];
		const SHOW_IMG = true;

		const extractInfo = (char) => {
			const info = {};
			for (const key of INCLUDE) if (key in char) info[key] = char[key];
			for (const key of character.read_only) if (key in char) info[key] = char[key];
			return info;
		};

		setInterval(() => set(character.name + '_newparty_info', { ...extractInfo(character), lastSeen: Date.now() }), 200);

		const getIFramedChar = (name) => {
			for (const iframe of top.$('iframe')) {
				const char = iframe.contentWindow.character;
				if (char?.name === name) return char;
			}
		};

		/* `text` is the label. Pass an empty string for a bare row - the xp rate
		   and its ETA are self-describing ("22.9M xp/hr"), so a redundant
		   "XP/HR: " prefix only costs width. `fontSize` defaults to the 17px the
		   stat bars use. */
		const barHTML = (text, val, width, color, fontSize) =>
			`<div style="position:relative;width:100%;height:${fontSize ? 16 : 20}px;text-align:center;margin-top:3px;">
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:bold;font-size:${fontSize || 17}px;z-index:1;white-space:nowrap;text-shadow:-1px 0 black,0 2px black,2px 0 black,0 -1px black;">${text ? text + ': ' : ''}${val}</div>
<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-color:${color};width:${width}%;height:${fontSize ? 16 : 20}px;border:1px solid grey;"></div>
</div>`;

		// ========================================================================
		// XP/HR + TIME-TO-LEVEL - display-only, no effect on farming/combat.
		// Keeps a rolling {time, xp, level} history per party member
		// (in-memory, resets on reload), sampled opportunistically from the
		// render loop below and throttled to XP_SAMPLE_INTERVAL_MS apart.
		// ========================================================================
		const XP_SAMPLE_INTERVAL_MS = 5000; // minimum spacing between kept samples
		const XP_WINDOW_MS = 5 * 60 * 1000; // rolling window used for the rate calc
		const xpHistory = new Map(); // name -> [{t, xp, level}, ...], oldest first

		function updateXpHistory(name, info) {
			if (!info || info.xp === undefined || info.level === undefined) return null;
			const now = Date.now();
			const hist = xpHistory.get(name) || [];
			const last = hist[hist.length - 1];
			if (!last || now - last.t >= XP_SAMPLE_INTERVAL_MS) {
				hist.push({ t: now, xp: info.xp, level: info.level });
				while (hist.length && now - hist[0].t > XP_WINDOW_MS) hist.shift();
				xpHistory.set(name, hist);
			}
			return hist;
		}

		// xp resets to 0 each level, so a naive (new.xp - old.xp) is wrong
		// across a level-up - same fix as the fighter scripts' own xpTracker.
		function xpGainedBetween(oldSample, newSample) {
			if (newSample.level <= oldSample.level) return newSample.xp - oldSample.xp;
			let total = (G.levels[oldSample.level] || 0) - oldSample.xp;
			for (let lvl = oldSample.level + 1; lvl < newSample.level; lvl++) total += G.levels[lvl] || 0;
			return total + newSample.xp;
		}

		function formatXpRate(xpPerHour) {
			if (xpPerHour <= 0) return '0 xp/hr';
			if (xpPerHour >= 1000000) return (xpPerHour / 1000000).toFixed(1) + 'M xp/hr';
			if (xpPerHour >= 1000) return (xpPerHour / 1000).toFixed(1) + 'k xp/hr';
			return Math.round(xpPerHour) + ' xp/hr';
		}

		function formatDuration(hours) {
			if (!isFinite(hours) || hours < 0) return '—';
			if (hours < 1) return Math.round(hours * 60) + 'm';
			if (hours < 48) return hours.toFixed(1) + 'h';
			return Math.round(hours / 24) + 'd';
		}

		// Returns display strings, not raw numbers - keeps xprate's calc() simple.
		function computeXpRateAndEta(name, info) {
			const hist = updateXpHistory(name, info);
			if (!hist || hist.length < 2) return { rateStr: '—', etaStr: '—' };

			const oldest = hist[0];
			const newest = hist[hist.length - 1];
			const elapsedSec = (newest.t - oldest.t) / 1000;
			if (elapsedSec < 10) return { rateStr: '—', etaStr: '—' }; // too little data yet - avoid a wild first reading

			const gained = xpGainedBetween(oldest, newest);
			const xpPerHour = (gained / elapsedSec) * 3600;
			const rateStr = formatXpRate(xpPerHour);

			let etaStr = '—';
			if (xpPerHour > 0 && typeof G !== 'undefined' && G.levels) {
				const xpNeeded = (G.levels[info.level] || 0) - info.xp;
				etaStr = formatDuration(xpNeeded / xpPerHour);
			}
			return { rateStr, etaStr };
		}

		const barConfigs = {
			hp: { color: 'red', calc: (i) => ({ val: i.hp, width: i.hp / i.max_hp * 100 }) },
			mp: { color: 'blue', calc: (i) => ({ val: i.mp, width: i.mp / i.max_mp * 100 }) },
			xp: {
				color: 'green', calc: (i) => {
					const pct = i.xp / G.levels[i.level] * 100;
					return { val: pct.toFixed(2) + '%', width: pct };
				}
			},
			/* Two rows, not one. computeXpRateAndEta samples history on a timer, so
			   calling it twice a tick would be wasteful and could skew the window;
			   the render loop computes it once and passes it in as `xp`. */
			xprate: {
				color: 'purple', label: '',
				calc: (i, partyData, xp) => {
					if (!xp) return { val: '??', width: 0 };
					return { val: xp.rateStr, width: 0 };
				}
			},
			xpeta: {
				color: 'purple', label: '',
				calc: (i, partyData, xp) => {
					if (!xp) return { val: '??', width: 0 };
					return { val: `next ${xp.etaStr}`, width: 0 };
				}
			},
			cc: { color: 'grey', calc: (i) => ({ val: i.cc?.toFixed(2) ?? i.cc, width: i.cc / (i.max_cc || 200) * 100 }) },
			ping: { color: 'black', calc: () => ({ val: character.ping?.toFixed(0) ?? '??', width: 0 }) },
			share: {
				color: 'teal', calc: (i, partyData) => {
					const share = partyData?.share;
					return share != null ? { val: (share * 100).toFixed(2) + '%', width: share * 300 } : { val: '??', width: 0 };
				}
			}
		};

		/* Anchor the party block on the left edge of the code-button row.
		   -> MageComments.md#anchor-the-party-block-on-the-left */
		const findAnchor = () => {
			const cb = parent.document.querySelector('.codebuttons');
			if (!cb) return null;
			for (const el of cb.children) if (el.offsetWidth) return el;
			for (let el = cb.nextElementSibling; el; el = el.nextElementSibling) if (el.offsetWidth) return el;
			return null;
		};

		/* Only align a POSITIONED #newparty, and say so once if it is not.

		   What makes it positioned is our own `.party-container`, applied by the
		   render loop two lines before this runs - the game ships #newparty as a
		   static inline-block. So if the style block ever fails to inject, the
		   class goes inert, `left`/`right` would be ignored and writing `width`
		   into an in-flow child of #toprightcorner would widen that container,
		   move the anchor, and start a 250ms oscillation. Reading the computed
		   value catches exactly that. */
		let alignChecked = false;
		const partyFrameIsPositioned = (partyFrame) => {
			const pos = parent.getComputedStyle(partyFrame[0]).position;
			if (pos !== 'static') return true;
			if (!alignChecked) {
				alignChecked = true;
				game_log('Party frames: #newparty is position:static - not aligning (left/right would be ignored and width could move the toolbar)', 'orange');
			}
			return false;
		};

		/* Distance from `el` to `ancestor` in CSS pixels, by walking offsetParent.

		   NOT getBoundingClientRect(). The game UI is scaled - measured at 0.7502
		   on this client - so rects come back in device pixels while `left` and
		   `width` are interpreted as CSS pixels, and rect.left is viewport-relative
		   while `left` on a positioned element is relative to its offsetParent.
		   offsetLeft is already CSS px and already relative to offsetParent, so
		   accumulating it needs no origin correction and no scale factor, and
		   cannot drift if the client's scale changes. */
		const offsetLeftWithin = (el, ancestor) => {
			let x = 0, node = el;
			while (node && node !== ancestor) { x += node.offsetLeft; node = node.offsetParent; }
			return node === ancestor ? x : null;
		};

		const alignPartyFrames = (partyFrame, count) => {
			const anchor = findAnchor();
			if (!anchor || !count) return;
			if (!partyFrameIsPositioned(partyFrame)) return;

			const np = partyFrame[0];
			const anchorBox = np.offsetParent;
			if (!anchorBox) return;

			/* Both measured against the SAME offsetParent, or not at all: if the
			   anchor is not inside it the two numbers are in different coordinate
			   spaces and subtracting them would be meaningless. */
			const anchorLeft = offsetLeftWithin(anchor, anchorBox);
			if (anchorLeft === null || !isFinite(anchorLeft)) return;

			/* One row, always. max-content plus nowrap lets the row size itself,
			   so there is no arithmetic to get wrong and no member count at which
			   it silently wraps onto a second row. */
			if (partyFrame.data('alignedTo') === anchorLeft && partyFrame.data('alignedN') === count) return;
			partyFrame.css({ left: anchorLeft + 'px', right: 'auto', width: 'max-content', 'white-space': 'nowrap' });

			/* Second pass: whatever inset the first cell has once it is laid out
			   on one row, take it off, so the FIRST member's frame is flush with
			   the anchor rather than the container's padding edge. Measured after
			   the write because the inset is a product of that layout. */
			np.offsetWidth;
			const inset = np.children[0] ? np.children[0].offsetLeft : 0;
			if (inset) partyFrame.css('left', (anchorLeft - inset) + 'px');

			partyFrame.data('alignedTo', anchorLeft).data('alignedN', count);
		};

		setInterval(() => {
			const partyFrame = parent.$('#newparty').addClass('party-container');
			if (!partyFrame.length) return;

			/* The merchant gets no frame. Excluded by CLASS rather than by name, so
			   it survives a rename and cannot hide a different character who
			   happens to share the name. The game builds one cell per party member
			   in member order, so the cell is hidden in place and the count passed
			   to alignPartyFrames is the count of VISIBLE cells. */
			const members = Object.keys(parent.party);
			const frameHidden = (name) => ((parent.party[name] || {}).type === 'merchant');
			alignPartyFrames(partyFrame, members.filter((n) => !frameHidden(n)).length);
			partyFrame.children().each((x, el) => {
				const name = members[x];
				parent.$(el).toggle(!frameHidden(name));
				if (frameHidden(name)) return;
				let info = get(name + '_newparty_info');

				if (!info || Date.now() - info.lastSeen > 1000) {
					const iframed = getIFramedChar(name);
					info = iframed ? extractInfo(iframed) : (get_player(name) || { name });
				}

				const partyData = parent.party[name];
				let html = `<div style="width:${FRAME_WIDTH}px;height:20px;margin-top:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${info.name}</div>`;

				const xp = (info && info.name !== undefined && info.xp !== undefined && info.level !== undefined)
					? computeXpRateAndEta(info.name, info)
					: null;

				for (const key of DISPLAY_BARS) {
					const cfg = barConfigs[key];
					const { val, width } = cfg.calc(info, partyData, xp);
					if (val !== undefined && val !== '??') {
						/* label may be deliberately empty - only fall back to the key
						   when the config never declared one. */
						const label = cfg.label === undefined ? key.toUpperCase() : cfg.label;
						html += barHTML(label, val, width, cfg.color, cfg.fontSize);
					}
				}

				parent.$(el).children().first().css('display', SHOW_IMG ? 'inherit' : 'none');
				parent.$(el).children().last().html(`<div style="font-size:22px;" onclick='pcs(event);party_click("${name}");'>${html}</div>`);
			});
		}, 250);

		parent.$('#party-props-toggles').remove();
	})();

}
