// ==========================================================================
// Dexon (Ranger) - Mainframe slot CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB - v155
//
// CHANGELOG: read Party/RangerChangelog.md in this repo. Do not put version
// history back in this file, and do not reconstruct it from git log - that
// file is the record. Prepend new entries there, newest first, never rewrite
// an old one, and bump the version on the line above in the same commit.
//
// CONSOLE COMMANDS - type these in the game console. They have no internal
// callers BY DESIGN; a static scan will report every one as dead and it is
// wrong. Do not delete them.
//   achvStatus()              achievement queue, current target and progress
//   achvStop()                stand the queue down and hand the spot back to the scorer
//   achvResume()              undo achvStop()
//   achvSkip()                abandon the current achievement and take the next
//   achvReset(i)              reset progress on queue entry i
//   bossJoin(name)            join the named boss fight, bypassing the gate
//   bossHome()                abandon the boss trip and go back to the farm spot
//   bossStatus()              boss gate, current pick and trip state
//   crabxxReport()            the crabxx contribution log, runs and damage
//   listBlacklist()           farm spots currently blacklisted, with why and when
//   clearBlacklist()          empty the blacklist
//   removeFromBlacklist(key)  un-blacklist one spot
//   farmFearReport()          the stored fear log
//   clearFearReport()         empty it
//   farmUiDiag()              why the farm panel is or is not on screen
//   mhOn()                    take monster hunts from now on
//   mhOff()                   stop taking them and hand the spot back
//   mhForget()                drop the stored choice and obey CONFIG again
//   mhSkip()                  abandon the current hunt
//   plStatus()                party-link state
//   rageStatus()              rage boxes on the current map
//   removeChestId(id)         drop one chest id from the persisted chest map
//   restockNow()              clear the potion-restock backoff so the next empty tick travels
//
// Also typeable, but these HAVE internal callers, so a dead-code scan
// would not flag them and they are listed for reference rather than
// protection:
//   mhStatus()           monster-hunt state for this character and the party
//   restockStatus()      potion vendor, backoff and last attempt
//   fearRecentSummary()  fear over the recent sample windows
// COMMENTS: a line ending "-> RangerComments.md#anchor" is a SUMMARY, not the
// whole comment. The reasoning behind it - what was measured, what was tried
// and discarded, why a number is that number - lives in Party/RangerComments.md
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
const PARTY_SCRIPT = 'Ranger';
const PARTY_FEATURE_PROBE = {
	achvScore: typeof achvScore,
	achvRefresh: typeof achvRefresh,
	bossRank: typeof bossRank,
	addToBlacklist: typeof addToBlacklist,
	checkFarmEconomics: typeof checkFarmEconomics,
	combineItems: typeof combineItems,
	totStatus: typeof totStatus,
	prepStatus: typeof prepStatus,
	cipherStatus: typeof cipherStatus,
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

let home = null;
let mobMap = null;
/* FIRST-BROADCAST GATE. The farm spot is not announced until one boss
   evaluation (mainLoop) and one achievement tick (achvTick) have both run, so
   a hop lands on the boss decision and the queue's choice rather than on
   whatever the farm search answered first. Both are one-way latches. */
let farmBootBossEval = false;
let farmBootAchvTick = false;
function farmSpotBootReady() { return farmBootBossEval && farmBootAchvTick; }
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
/* -- PER-CHARACTER CODE STORAGE -------------------------------------
   `set`/`get` ARE NOT CHARACTER-SCOPED. From the client at upstream 16881a27,
   `set(name, value)` is `window.localStorage.setItem("cstore_" + name, ...)`:
   no character in the key, and every character tab is the same
   `adventure.land` origin, so a bare key is ONE SLOT shared by Dexon,
   FatherToken, MageofOz and Meltymerch. That the CODE contexts really do share
   one localStorage is the game's own design - `local_cm_logic` reads
   `cm_<my name>_*` entries another character's `send_local_cm` wrote, which is
   how send_cm's local copy arrives at all.
   The convention already existed in four subsystems before this one -
   `<name>_newparty_info`, `luckyslot_<name>`, `pl_delivered_<name>_<pot>`,
   `pl_mlucked_<name>` - so the party keys were the outlier, not the unsolved
   case.

   RESOLVED AT EVERY USE, NEVER FROZEN IN A `const`. `runner_functions.js`
   builds `character` as a PROXY and fills it with `proxy_all()`, whose own
   comment reads "Not all properties are sadly available right away". A key
   baked at module scope can therefore capture an empty name and produce one
   shared `..._undefined` key for all of us - the exact bug this removes,
   silently, and v119 shipped that shape. A function cannot.
   An unreadable name yields null and the caller does nothing: never a write to
   the shared key, and a lost read is the safe direction. */
function scopeKey(base) {
	const who = (typeof character !== 'undefined' && character && character.name) || '';
	return who ? base + '_' + who : null;
}
function scopedSet(base, value) {
	const k = scopeKey(base);
	if (!k) return false;
	return set(k, value);
}
/* Scoped only. For state whose legacy value is AMBIGUOUS - any key more than
   one script wrote - where reading it once is the cross-character import being
   removed. */
function scopedGet(base) {
	const k = scopeKey(base);
	return k ? get(k) : null;
}
/* Does the SCOPED key EXIST, as against holding null? `get()` cannot say:
   it is `JSON.parse(localStorage.getItem('cstore_' + k))`, so a missing item
   and a stored "null" both come back null. The raw item is the only thing
   that separates them. The catch cannot be the Form B lie - `get()` above
   reaches the same localStorage and would have thrown first, so there is no
   state in which this silently substitutes for a missing one. */
function scopedHas(base) {
	const k = scopeKey(base);
	if (!k) return false;
	try { return window.localStorage.getItem('cstore_' + k) !== null; }
	catch (e) { return false; }
}
/* Scoped, falling back to the legacy key once. Correct ONLY where the legacy
   value is unambiguously this character's: a key no other script has ever
   written, or one whose entries cannot be mistaken for another character's.
   That is the whole difference from `scopedGet` - not caution, provenance. */
function scopedGetLegacy(base) {
	const k = scopeKey(base);
	if (!k) return null;
	const v = get(k);
	if (v !== null && v !== undefined) return v;
	/* Null is TWO states and only one of them wants the legacy value: never
	   written (migrate), or deliberately cleared - `mhForget()` writes null -
	   where adopting the legacy value UNDOES the clear. Deleting the key on a
	   clear does not fix that and looks as though it would: it merges the
	   cleared state INTO the never-written one, which is the wrong direction. */
	return scopedHas(base) ? v : get(base);
}

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
/* DELIBERATELY UNREFERENCED IN THIS FILE, and a dead-code scan will say so.
   plActed/plMarkActed exist to stop a handler that RELOADS THE PAGE from
   acting on the same message twice. Dexon has no such handler: on_cm takes
   six message types and none of them reaches change_server, whose only call
   site is in the bossHop driver. The in-memory plFirstTime covers the
   in-game/relay duplicate, and the persisted cursor above covers the reload.
   They stay so the relay block is the same in all three files - the next fix
   ports once rather than three times - and so that a future Dexon handler
   that does hop has them to hand. If one is added, bracket it exactly as
   bossHopFollow does in Priest.js and Mage.js. */
function plActed(id) {
	if (!id) return false;
	try { return (scopedGetLegacy(PL_ACTED_KEY) || []).indexOf(id) !== -1; }
	catch (e) { plLog('acted-list read failed: ' + e, 'orange'); return false; }
}

function plMarkActed(id) {
	if (!id) return;
	try {
		const list = scopedGetLegacy(PL_ACTED_KEY) || [];
		if (list.indexOf(id) === -1) list.push(id);
		while (list.length > PL_ACTED_MAX) list.shift();
		scopedSet(PL_ACTED_KEY, list);
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
   mhOn()/mhOff() and the other console commands above already do. */
const TOGGLES = {
	combat:                          true,   // CONFIG.combat.enabled
	scare:                           true,   // CONFIG.combat.scare.enabled
	focusFire:                       true,   // CONFIG.combat.focusFire.enabled
	focusFirePreferSingleTarget:     false,  // CONFIG.combat.focusFire.preferSingleTarget
	focusFireLeaderPicksLowestHp:    true,   // CONFIG.combat.focusFire.leaderPicksLowestHp
	combatIgnoreAddsDuringCrabxx:    true,   // CONFIG.combat.ignoreAddsDuringCrabxx
	combatUseHuntersMark:            true,   // CONFIG.combat.useHuntersMark
	combatUseSupershot:              true,   // CONFIG.combat.useSupershot
	movement:                        true,   // CONFIG.movement.enabled
	movementCircleWalk:              true,   // CONFIG.movement.circleWalk
	rangedKiting:                    true,   // CONFIG.movement.rangedKiting.enabled
	rangedKitingAutoBySpeed:         false,  // CONFIG.movement.rangedKiting.autoBySpeed
	rangedKitingDisengageOnCourage:  true,   // CONFIG.movement.rangedKiting.disengageOnCourage
	rangedKitingDebug:               false,  // CONFIG.movement.rangedKiting.debug
	equipmentCapeSwapEnabled:        false,  // CONFIG.equipment.capeSwapEnabled
	equipmentCoatSwapEnabled:        true,   // CONFIG.equipment.coatSwapEnabled
	equipmentBossSetSwapEnabled:     true,   // CONFIG.equipment.bossSetSwapEnabled
	equipmentXpSetSwapEnabled:       false,  // CONFIG.equipment.xpSetSwapEnabled
	equipmentUseLicence:             false,  // CONFIG.equipment.useLicence
	potionsAutoBuy:                  true,   // CONFIG.potions.autoBuy
	partyAutoManage:                 true,   // CONFIG.party.autoManage
	looting:                         true,   // CONFIG.looting.enabled
	selling:                         true,   // CONFIG.selling.enabled
	upgrading:                       false,  // CONFIG.upgrading.enabled
	combining:                       false,  // CONFIG.combining.enabled
	characterStarter:                false,  // CONFIG.characterStarter.enabled
	inventoryRelief:                 true,   // CONFIG.inventoryRelief.enabled
	locationBroadcast:               true,   // CONFIG.locationBroadcast.enabled
	bossHop:                         true,   // CONFIG.bossHop.enabled
	bossHopReturnHome:               true,   // CONFIG.bossHop.returnHome
	bossHopPreposition:              true,   // CONFIG.bossHop.preposition.enabled
	bossEvents:                      true,   // CONFIG.bossEvents.enabled
	bossEventsCooperativeOnly:       true,   // CONFIG.bossEvents.cooperativeOnly
	monsterHunt:                     false,  // CONFIG.monsterHunt.enabled
	monsterHuntTurnInImmediately:    true,   // CONFIG.monsterHunt.turnInImmediately
	monsterHuntReAcceptAtDaisy:      true,   // CONFIG.monsterHunt.reAcceptAtDaisy
	achievements:                    true,   // CONFIG.achievements.enabled
	achievementsPull:                true,   // CONFIG.achievements.pull.enabled
	rageEntry:                       true, // CONFIG.bossEvents.rageEntry.enabled
	achievementsPullRespectCourage:  true,   // CONFIG.achievements.pull.respectCourage
	muling:                          true,   // CONFIG.muling.enabled
	trickOrTreat:                    true,   // CONFIG.trickOrTreat.enabled
	cipherFarm:                      true,   // CONFIG.cipherFarm.enabled
	cipherFarmHop:                   true,   // CONFIG.cipherFarm.hop
};

const CONFIG = {
	combat: {
		enabled: TOGGLES.combat,
		/* Scare clears everything currently targeting us. Needs a jacko in the bag
		   (it equips, casts, then swaps the previous orb back): 50 mp, 5s cooldown.
		   courageOffset shifts the trigger relative to character.courage - 0 fires
		   at courage itself, +1 waits until fear has already begun. */
		scare: { enabled: TOGGLES.scare, courageOffset: 0, minHeldMs: 250 },
		/* Focus fire. preferSingleTarget skips the AoE branches entirely: 5shot
		   lands at a 0.5 damage multiplier and 3shot at 0.7, so against cgoo's
		   2,400 hp a 5shot needs 5.5 casts per target where single-target needs
		   2.7 - it keeps five monsters alive and swinging instead of removing one
		   every ~2.3s. At a respawn-capped spot that throughput buys nothing:
		   cgoo is limited to 8 spawns / 48s = 0.167 kills per second and the
		   party already exceeds that roughly fivefold, so the surplus is better
		   spent on provoking fewer monsters. leaderPicksLowestHp finishes wounded
		   mobs instead of opening on the healthiest, which is what inRange[0]
		   gave - sortedByHP sorts b.hp - a.hp, healthiest first. */
		/* singleTargetMobs is a curated list, maintained by hand: add a monster
		   when splitting fire across a crowd of them is the wrong trade, and
		   remove it once it stops being one.
		   -> RangerComments.md#singletargetmobs-is-a-curated-list-maintained-by */
		focusFire: {
			enabled: TOGGLES.focusFire,
			preferSingleTarget: TOGGLES.focusFirePreferSingleTarget,
			singleTargetMobs: ['cgoo', 'bigbird', 'mummy', 'prat', 'plantoid', 'fireroamer', 'boar', 'cutebee', 'mole'],
			leaderPicksLowestHp: TOGGLES.focusFireLeaderPicksLowestHp
		},
		targetPriority: ['FatherToken'],
		alwaysAttack: ['crabx', 'wabbit'],
		// See shouldAttackMob: while crabxx is live the 1,000 crabx adds are
		// ignored so the shots land on the boss instead of the swarm.
		ignoreAddsDuringCrabxx: TOGGLES.combatIgnoreAddsDuringCrabxx,
		/* COOPERATIVE BOSSES ARE ENGAGED ONLY ONCE SOMEBODY ELSE IS ON THEM.
		   attackIfTargeted resolves to `mob.target != null`, which is exactly the
		   operator's rule: credit on a cooperative boss is shared by damage dealt,
		   so joining a fight in progress pays, and opening one alone does not.
		   -> RangerComments.md#cooperative-bosses-are-engaged-only-once-somebody */
		attackIfTargeted: [...allBosses, 'phoenix',
			'pinkgoo', 'rharpy', 'rimedjinn', 'slenderman', 'snowman', 'tiger'],
		neverAttack: ['nerfedmummy', 'target_ar500red', 'target_ar900', 'target', 'target_a500', 'target_a750', 'target_r500', 'target_r750'],
		useHuntersMark: TOGGLES.combatUseHuntersMark,
		useSupershot: TOGGLES.combatUseSupershot,
		minTargetsFor5Shot: 4,
		minTargetsFor3Shot: 2,
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
		circleRadius: 75,
		clumpRadius: 85,
		/* Per-spot standing position, overriding the spawn-boundary centre that
		   scoreAllFarmSpots hands back. Measured off G.geometry.level2s with 24
		   sampled directions at 50 units: within 120 units of the cgoo spawn
		   centre (34,503) the average open approach lane count is 23.9 of 24 -
		   a fully open field, which is what nine simultaneous attackers looks
		   like. (-86,683) is 3 of 24, reachable in the same flood-fill region,
		   222 units out, with 2 lanes facing the spawn so they still come. It is
		   a funnel to pull into, not a firing position - nothing there has line
		   of fire to the spawn centre. Free at a respawn-capped spot. */
		anchors: {
			'cgoo@level2s': { x: -86, y: 683 }
		},
		rangedKiting: {
			enabled: TOGGLES.rangedKiting,
			/* Hand-tuned list - authoritative, never derived. See kiteThreatRadius(). */
			targets: ['bscorpion'],
			overrides: {
				/* Measured tuning preserved verbatim. optimalDistance 170 deliberately
				   EXCEEDS Dexon's 160 range: against bscorpion this is an avoid, not a
				   kite-and-shoot, because the threat is weakness_aura (radius 100) and
				   not the 32 attack range. maxDistance 400 preserves the old convergence
				   toward 170 instead of letting the corrected band push him further out. */
				bscorpion: { minDistance: 155, optimalDistance: 170, maxDistance: 400 }
			},
			/* FALSE deliberately. True made kiteCandidateTypes() add every monster we
			   outrun by speedRatio, which grew the list from the 1 hand-tuned entry to
			   13 and made `targets` authoritative in name only. Measured on the live
			   slot 2026-09-28: the operator had already turned it off there. Turn it
			   back on only alongside a measurement of what the derived list adds. */
			autoBySpeed: TOGGLES.rangedKitingAutoBySpeed,
			speedRatio: 1.3,
			attackMargin: 15,
			/* Disengage abandons the hold band once this many monsters are on us.
			   Default is character.courage, the count tolerated before fear starts
			   and actions stop. Holding optD is right against one monster and fatal
			   against nine - measured 2026-09-26, nearest went 92 to 10 while
			   attackers went 3 to 9, and he died at the band's own threshold. */
			disengageOnCourage: TOGGLES.rangedKitingDisengageOnCourage,
			disengageDistance: 60,
			/* Fallbacks only - per-target values come from kiteBand(). */
			minDistance: 155,
			maxDistance: null,
			rangeBuffer: 20,
			optimalDistance: 170,
			moveThrottle: 100,
			sampleAngles: 90,
			moveDistance: 30,
			repositionThreshold: 20,
			maxKiteRange: 400,
			debug: TOGGLES.rangedKitingDebug
		}
	},

	equipment: {
		bossHpThresholds: {
			mrpumpkin: 100000,
			mrgreen: 100000,
			crabxx: 100000,
			grinch: 100000,
			dragold: 200000,
			wabbit: 5000,
		},
		mpThresholds: { upper: 1700, lower: 2100 },
		chestThreshold: 12,
		swapCooldown: 500,
		capeSwapEnabled: TOGGLES.equipmentCapeSwapEnabled,
		coatSwapEnabled: TOGGLES.equipmentCoatSwapEnabled,
		/* NOT IMPLEMENTED - no boss-set swap code exists anywhere in this file.
		   The knob is kept deliberately: the swap is planned now that boss
		   hopping is live. Reading it as working config is the trap. */
		bossSetSwapEnabled: TOGGLES.equipmentBossSetSwapEnabled,
		xpSetSwapEnabled: TOGGLES.equipmentXpSetSwapEnabled,
		xpMonsters: ['sparkbot'],
		xpMobHpThreshold: 12000,
		useLicence: TOGGLES.equipmentUseLicence,
	},

	potions: {
		autoBuy: TOGGLES.potionsAutoBuy,
		hpThreshold: 400,
		mpThreshold: 500,
		minStock: 1000,
		// autoBuyPotions runs on the 2s maintenance tick, and the low-stock
		// condition it fires on is not transient: away from a vendor, or broke,
		// buy() fails and the count stays under the threshold. That sent two
		// messages every two seconds, indefinitely, from every fighter.
		//
		// The cooldown is the real fix and the gate below is an optimisation on
		// top of it. That ordering matters: the gate can be wrong about
		// reachability, but the cooldown bounds the cost either way.
		requestCooldownMs: 30000,

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
		groupMembers: ['Dexon', 'MageofOz', 'FatherToken', 'Meltymerch']
	},

	looting: {
		enabled: TOGGLES.looting,
		delayMs: 180000,
		// Bounds one pass so draining a large backlog cannot become a single
		// unbroken chain of socket calls. 25 x 4 passes/sec = 100 loots/sec.
		maxPerPass: 25,
	},

	selling: {
		enabled: TOGGLES.selling,
		whitelist: [
			'angelwings', 'candycanesword', 'carrotsword', 'coat1',
			'crabclaw', 'cupid', 'dexring', 'eears', 'eggnog', 'epyjamas', 'eslippers',
			'gloves', 'gloves1', 'helmet', 'helmet1', 'hhelmet', 'harmor', 'hpants',
			'hboots', 'hgloves', 'hotchocolate', 'hpamulet', 'hpbelt', 'iceskates',
			'intring', 'lantern', 'lostearring', 'merry', 'mittens', 'mushroomstaff',
			'ornamentstaff', 'oxhelmet', 'pants', 'pants1', 'pinkie',
			'pstem', 'quiver', 'rednose', 'ringsj', 'santasbelt', 'skullamulet',
			'stramulet', 'dexamulet', 'intamulet', 'shoes1', 'smoke', 'snowball',
			'snowflakes', 'spear', 'strring', 't2bow', 'throwingstars', 'tshirt0',
			'tshirt1', 'tshirt2', 'vitearring', 'vitring', 'warmscarf', 'wbook0',
			'wgloves', 'wcap', 'wattire', 'wbreeches', 'wshoes', 'xmashat',
			'xmasshoes', 'xmassweater', 'xmaspants'
		],
	},

	upgrading: { enabled: TOGGLES.upgrading, whitelist: {} },
	combining: {
		enabled: TOGGLES.combining,
		whitelist: {
			dexamulet: { targetLevel: 3, primling: 3, prim: 4 },
			intamulet: { targetLevel: 3, primling: 3, prim: 4 },
			stramulet: { targetLevel: 3, primling: 3, prim: 4 }
		}
	},

	characterStarter: {
		enabled: TOGGLES.characterStarter,
		characters: {
			MERCHANT: { name: 'Meltymerch', codeSlot: 'CH_aLtHealaSgKdmOsDWpNl8scE9NhXk' },
			PRIEST: { name: 'FatherToken', codeSlot: 'CH_hae5t3g8gBezOVTdR6ToTagikbTbF' },
			MAGE: { name: 'MageofOz', codeSlot: 'CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom' }
		}
	},

	/* When the pack is full and no mule is coming, sell junk rather than stop.

	   DESTRUCTIVE, so the protections are the important part of this block and
	   not the thresholds. Nothing upgraded, nothing special, nothing locked and
	   nothing named below is ever sold, whatever it is worth - an item's vendor
	   price is a poor guide to whether you wanted to keep it, which is exactly
	   why "sell the cheapest" needs a floor under it rather than a sort alone. */
	inventoryRelief: {
		enabled: TOGGLES.inventoryRelief,
		// How long the pack must stay full, with the merchant unreachable,
		// before selling. Long enough that a merchant mid-hop or mid-trade gets
		// to arrive first; this is a last resort, not a first response.
		graceMs: 90000,
		targetFreeSlots: 21,
		// Ernis in Mainland - the same NPC the merchant restocks potions from,
		// so it is a known-good vendor location in this codebase rather than a
		// guess. Any NPC that buys would do.
		vendor: { map: 'main', x: -35, y: -162 },
		neverSell: new Set([
			'hpot1', 'mpot1', 'xptome', 'xpbooster', 'luckbooster',
			'goldbooster', 'pumpkinspice', 'licence', 'tracker', 'ancientcomputer',
			'computer', 'supercomputer', 'cscroll0', 'cscroll1', 'cscroll2',
			'scroll0', 'scroll1', 'scroll2', 'stand0', 'stand1',
		]),
	},

	locationBroadcast: {
		enabled: TOGGLES.locationBroadcast,
		targetPlayer: 'Meltymerch',
		checkInterval: 1000,
		lowInventorySlots: 3,
		// The pickup request fires on a one-second tick off a condition that
		// only clears when someone else acts. Same shape as the potion request.
		pickupCooldownMs: 15000,
		// Only used if the game's own skill table cannot be read. The real
		// requirement comes from G.skills.mluck.level at runtime, so it cannot
		// go stale if the game changes it - this is a floor for the case where
		// G is unavailable, not a second source of truth.
		mluckLevelFallback: 40,
	},

	/* CROSS-SHARD BOSS HOP -> bossHop below. Generalised from the dragold-only
	   scanner on 2026-10-17; the state machine was already general and only
	   six places named dragold.

	   The three numbers that decide whether a hop is worth making, all
	   measured 2026-10-17 - see the CLAUDE.md sections "Kill credit and
	   achievement score" and "Server hopping, home bonus and Realm Fatigue".

	   CREDIT REQUIRES BEING PRESENT WHEN THE BOSS DIES - a departed player's
	   points are discarded. Required dwell is NOT a constant; it scales as
	   maxHp^0.65. Push ONE character, not three.
	   -> RangerComments.md#cross-shard-boss-hop-bosshop-below-generalised */
	bossHop: {
		/* The operator owns this one. On, Dexon chains cross-shard boss hops
		   and the party is permanently hop-sick, which is a real cost to
		   everything else it does; off, the scanner never starts and he farms.
		   EITHER WAY, CHANGING IT NEEDS A RELOAD, not just an edit:
		   startScanning() runs once at load and returns early while the flag is
		   false, so the sockets never open and tick() has nothing to pick from. */
		enabled: TOGGLES.bossHop,
		preSpawnBuffer: 3000,
		/* Extra lead time on top of hop sickness for a join-type event, so the
		   clock is actually clear when the event opens rather than clearing on
		   the same tick. -> RangerComments.md#joinWhileHopsick */
		joinClearMarginMs: 30000,
		hopLatencyMs: 1500,          // measured 274ms per change_server + margin
		safetyMarginMs: 15000,
		maxFightMs: 15 * 60 * 1000,  // hard abort only, NOT a credit timer
		/* Go home once the chain ENDS - nothing eligible anywhere. Parking on
		   a foreign shard forfeits the HOME shard's own boss spawns, and those
		   are the only ones paying the home-server bonus and the drops_home
		   table. This is NOT the between-kills routing v86 removed; that stays
		   removed. returnHomeAfterMs debounces it, so a boss flickering across
		   the eligibility floor cannot ping-pong the party between shards. */
		returnHome: TOGGLES.bossHopReturnHome,
		returnHomeAfterMs: 90 * 1000,
		/* PREPOSITIONING FOR A SCHEDULED EVENT. The operator's ruling: a known
		   scheduled event that nothing outranks and that is not on home REQUIRES
		   the party to be on that shard before it opens - NARROWED 2026-10-24 to
		   events whose entrance requires not being hop-sick (join-only), plus any
		   name in alsoFor where arriving early is shown to be worth it. A
		   walkable boss is left to the reactive hop, which reaches it within
		   minutes of spawn AND runs the dwell check this planner does not. The input is the
		   bridge's /schedule_live, every shard's published lineup in one list.
		   Without it, or without a fresh lineup for HOME, nothing is
		   prepositioned - "is it on home" cannot be answered, and guessing it
		   is not would hop the party off a shard running the same event.
		   joinOnly events (no walkable entrance - goobrawl) lead by the FULL
		   hop sickness, read live from G: the hop re-stamps it on arrival and
		   the server refuses the join until it clears. An alsoFor name leads
		   by walkLeadMs, which is NOT a measured figure - the one measurement
		   is Dexon's ~90s walk from main to spookytown, 2026-10-24.
		   minUsefulMs is how much of the window must still be left once we
		   can actually engage; a later trip is refused rather than taken to
		   arrive after the event ended, which is what the 2026-10-24 08:30
		   EDT graveyard looked like from outside.
		   -> RangerComments.md#preposition */
		preposition: {
			enabled: TOGGLES.bossHopPreposition,
			alsoFor: [],                     // walkable events worth arriving early for; empty by design
			walkLeadMs: 3 * 60 * 1000,
			marginMs: 60 * 1000,
			minUsefulMs: 2 * 60 * 1000,
			feedMaxAgeMs: 5 * 60 * 1000,     // our last good /schedule_live fetch
			lineupMaxAgeSec: 30 * 60,        // one shard's lineup, as the bridge last heard it
		},
		/* Dexon's own dps, the denominator of requiredDwellSec(). Measured
		   against mrgreen, which is a MAGICAL-resistance fight - resistance
		   900, apiercing 122 - so it is a first approximation elsewhere:
		   crabxx is armor 320 physical and franky lists no resistance at all.
		   It matters least where the maxHp term dominates and most at
		   mrgreen, where a 2x error moves the gate from 50s to 100s. A target
		   may carry its own dexonDps to override this; none does yet, and
		   per-boss figures want measuring rather than estimating. */
		dexonDps: 2605,
		/* Used to turn an observed shard dps into a contributor count, since
		   no feed reports one. Not measured - a stand-in for "one other
		   player", deliberately round. */
		typicalPlayerDps: 2000,
		minContributors: 5,
		maxContributors: 200,
		/* Used only when the bridge has no fresh dps for that shard and boss -
		   either it is down, or it has not sampled this fight yet. NOT a
		   per-boss measurement: it is the whole-server figure the bridge read
		   at mrgreen on 2026-10-17, 22,866 on US V and 21,561 on EU III,
		   rounded down. A boss with fewer players on it will be slower than
		   this and one at a weekend peak faster, so treat a fallback-sourced
		   secsToDeath as an order of magnitude, not a number. ShowBossHop
		   labels every row with which of the two it used. */
		fallbackDps: 20000,
		/* Priority is kills to this boss's next achievement rung, used ONLY to
		   break a tie on time-to-death. */
		targets: [
			{ mtype: 'dragold', kills_to_rung: 1 },
			{ mtype: 'franky', kills_to_rung: 68 },
			{ mtype: 'crabxx', kills_to_rung: 70 },
			{ mtype: 'horseman', kills_to_rung: 70 },
		],
	},

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
		minSoaked: 5,            // AVERAGE monsters in the box held by non-party players
		holdMs: 20000,           // averaged over this long before we go in
		leaveSoaked: 3.5,        // once in, the average must fall BELOW this to bring us out
		minInsideMs: 30000,      // and not before we have been in this long
		retreatAtAttackers: 3,   // on THIS character - meant to sit below courage
		retreatHoldMs: 60000,    // after anyone's retreat on bodies, the party stays out this long
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

	/* ACHIEVEMENT QUEUE -> ACHIEVEMENT QUEUE below. On, the queue drives which
	   achievement Dexon is grinding toward. The queue is still READ while this
	   is off: huntParkPoint() resolves a rage-boxed hunt's park point out of it
	   and achvCfg() has no enabled gate, so emptying the queue would silently
	   disable rage-boxed hunts as well. */
	/* MONSTER HUNT -> MONSTER HUNT below. On, the party takes and works monster
	   hunts; off restores ordinary farming and hands the spot straight back to
	   the scorer.
	   mhOn() and mhOff() flip 'enabled' at runtime. */
	monsterHunt: {
		enabled: TOGGLES.monsterHunt,
		/* The backstop on waiting for everyone, NOT the rule. The rule is in
		   mhSettled(): a member holding an unexpired hunt counts as settled,
		   because the server answers monsterhunt_already and leaves it
		   untouched, so they cannot reroll and waiting for them to "accept"
		   would never finish. This timer only covers a character gone quiet. */
		acceptWaitMs: 90 * 1000,
		askMs: 20 * 1000,               // how often to poll the other two for progress
		/* BOUND THE GRIND BY TIME, NEVER BY KILL COUNT. The server sets the
		   count as (20*60*times)/(max_hp/1000)/(respawn+0.25), so it scales
		   INVERSELY with how tough the monster is: a x500 assignment is bees,
		   a x1 is an 80,000 hp skeletor. The first guard here was maxCount:150
		   and it had the sign backwards - measured live 2026-10-04, it refused
		   a bee x500 that mhEvaluate priced at 200 SECONDS (main, 5-pack, 2.5
		   kills/s, uptime 1.0) and a minimush x500 at 250s, while a count-based
		   rule would happily admit a single 80,000 hp target. Count is not a
		   proxy for effort; seconds are. 0 disables this bound, and the hunt's
		   own 30-minute clock still applies either way just below. */
		maxEstMin: 15,
		huntCapMs: 25 * 60 * 1000,      // give up on one target after this
		/* BANK EACH HUNT THE MOMENT IT FINISHES, AND TAKE THE NEXT ONE ON THE SPOT.
		   Previously a finished hunt was only held in mhDone while the party
		   chained through the other members' hunts, and the whole batch was banked
		   at the end of the cycle. That is cheaper in Daisy trips and strictly
		   riskier in tokens: a hunt carries its own 30-minute clock, so anything
		   held unbanked can expire, and turnInMarginMs below existed only to guess
		   how much clock to keep spare for it. Immediate turn-in removes the guess
		   and the risk together, at the cost of one trip per hunt rather than one
		   per batch. Set false to go back to batching. */
		turnInImmediately: TOGGLES.monsterHuntTurnInImmediately,
		/* Ask for the next hunt without leaving Daisy. Accepting and turning in are
		   THE SAME CALL - parent.socket.emit('monsterhunt') with no arguments - and
		   the server decides which one it means from whether a finished hunt is
		   held. So the emit that banks a token and the emit that hands out the next
		   one are one after the other, from the spot we are already standing on.
		   Measured 2026-10-09 in the live client: exactly ONE client function emits
		   'monsterhunt' at all, npc_right_click, and it passes no second argument -
		   so the game's own Daisy panel sends a byte-identical request to this one.
		   Having to close and reopen her prompt in the UI is therefore a property
		   of the PANEL, not of the server: closing and reopening is simply how you
		   make npc_right_click fire a second time. There is no dialog state to
		   reset, and nothing for this path to reopen. */
		reAcceptAtDaisy: TOGGLES.monsterHuntReAcceptAtDaisy,
		/* Only consulted while turnInImmediately is false - see above. */
		turnInMarginMs: 7 * 60 * 1000,  // clock kept spare to bank what is already done
		retryMs: 5 * 60 * 1000,         // after a cycle with nothing viable, hold off this long
	},

	achievements: {
		/* -> ACHIEVEMENT QUEUE below. The queue stays live whether or not this
		   is on; see huntParkPoint(). The booboo boundary centre (415,-702)
		   that used to sit in the queue was removed in v86 - inside the rage
		   box, rejected by huntParkPoint, and the achievement path never did
		   use it differently. The booboo entry that remains is the verified
		   park point (290,-990); comment it out to stop running booboo. The
		   operator turned it on 2026-10-24 because booboo's drop, not dexbelt,
		   is now what limits windbelt production. */
		enabled: TOGGLES.achievements,
		/* Consecutive failed travel attempts to an achievement spot before the
		   override is released. Needed because the breaker in the farm loop
		   blacklists a spot, and an achievement spot is whitelisted against
		   exactly that, so there was no way to give up. -> the release valve */
		maxTravelFailures: 10,
		refreshMs: 5 * 60 * 1000,   // how often to ask the server for a fresh tracker
		reassertMs: 30 * 1000,      // how often to check the override is still ours
		/* One-at-a-time pulling for a spot that sits beside a rage rectangle.
		   concurrent IS THE KNOB: how many of the target monsters may be in flight
		   at once. 1 is the measured-safe start - one un-enraged booboo is 264 dps
		   and one mummy 317 after armor, against FatherToken's ~1,499 hps, so the
		   ceiling is roughly four before healing loses. Raise it a step at a time;
		   courage still caps attackers on any one character independently. It
		   counts EVERY pulled type together, so on the booboo entry it covers the
		   `also` mummies as well. The operator raised it 2026-10-24; it reaches the
		   priest and mage through ragePullShared, broadcast with the farm spot. */
		pull: {
			enabled: TOGGLES.achievementsPull,
			concurrent: 3,
			margin: 4,           // margin + step must stay <= 9 - see rageCfg
			guardMargin: 0,      // the guard trips only on a REAL breach - see rageCfg
			step: 5,             // route-search grid, in units
			maxCells: 200000,
			parkWithin: 45,
			pullTimeoutMs: 20000,
			repullGapMs: 1200,
			respectCourage: TOGGLES.achievementsPullRespectCourage,
		},
		/* Each entry: the monster, where to stand, and the rung to stop at. rung is
		   the threshold out of G.monsters[m].achievements[0][0]; coordinates are the
		   same spots the manual overrides used. Edit, reorder or extend freely - the
		   saved position is an index, so achvReset(n) after a reorder. */
		queue: [
			/* Both spookytown rage-box spots, parked on the corridor between them -
			   the band outside BOTH rectangles, y -1130..-842. (415,-986) was the
			   old spot and it is NOT REACHABLE: a flood from it dies after 385 cells,
			   walled to east and west, and smart_move refuses it too. The corridor
			   is entered from the WEST, and (290,-990) sits in the part that connects
			   - 148 from the booboo rectangle, 140 from the mummy one, and arrived at
			   live with zero breaches. booboo is pulled by Dexon; a mummy at its spawn
			   edge needs 173 of reach, past the ranger's 163 and inside the priest's
			   201 and the mage's 235, so ragePuller hands those to them on range
			   alone, with no special case. `also` runs both from one entry
			   because booboo respawns every 48s against mummy's 24 and would otherwise
			   idle most of the trip; the rung still tracks `m`. rung null means run
			   until the toggle goes off or achvStop(). */
			/* The operator's spot, 2026-10-24, put first for now: the corridor
			   spot below has competition. */
			{ m: 'booboo', map: 'spookytown', x: -530, y: -785, rung: null, also: [] },
			{ m: 'booboo', map: 'spookytown', x: 290, y: -990, rung: null, also: ['mummy'] },
			{ m: 'stoneworm',  map: 'spookytown',  x:  677, y:   129, rung: 100000 },
			{ m: 'mole',       map: 'tunnel',      x:   14, y: -1072, rung: 10000  },
			{ m: 'armadillo',  map: 'main',        x:  526, y:  1846, rung: 100000 },
			{ m: 'porcupine',  map: 'desertland',  x: -829, y:   135, rung: 100000 },
			{ m: 'croc',       map: 'main',        x:  801, y:  1710, rung: 100000 },
			{ m: 'iceroamer',  map: 'winterland',  x:  824, y:   -45, rung: 100000 },
			{ m: 'poisio',     map: 'main',        x: -121, y:  1360, rung: 100000 },
			{ m: 'crabx',      map: 'main',        x: -984, y:  1762, rung: 100000 },
			{ m: 'squig',      map: 'main',        x:-1175, y:   422, rung: 100000 },
			{ m: 'tortoise',   map: 'main',        x:-1124, y:  1118, rung: 100000 },
			{ m: 'bbpompom',   map: 'winter_cave', x:  -82, y:  -949, rung: 100000 },
			{ m: 'bat',        map: 'batcave',     x:   66, y:     8, rung: 100000 }, 
			{ m: 'boar',       map: 'winterland',  x:   20, y: -1109, rung: 100000 },
			{ m: 'cgoo',       map: 'level2s',     x:   34, y:   503, rung: 100000 },
			{ m: 'spider',     map: 'main',        x:  948, y:  -144, rung: 100000 },
			{ m: 'ghost',      map: 'halloween',   x: -405, y: -1642, rung: 100000 },
			{ m: 'wolfie',     map: 'winterland',  x: -169, y: -2026, rung: 100000 },
			{ m: 'scorpion',   map: 'main',        x: 1578, y:  -168, rung: 100000 },
			{ m: 'gscorpion',  map: 'desertland',  x:  391, y: -1422, rung: 100000 },
			{ m: 'osnake',     map: 'halloween',   x: -509, y:  -626, rung: 100000, also: ['snake'] },
		],
	},

	muling: {
		enabled: TOGGLES.muling,
		muleName: 'Meltymerch',
		goldReserve: 500000,
		excludeItems: new Set(['hpot1', 'mpot1', 'tracker', 'luckbooster', 'xpbooster', 'pumpkinspice', 'xptome']),
	},

	/* Trick or Treat knock route. The operator's spec, 2026-10-23: knock when
	   no boss is on, read the knocks left from the game rather than counting,
	   and take the first knock at the soonest moment outside a boss window.
	   -> TRICK OR TREAT */
	trickOrTreat: {
		enabled: TOGGLES.trickOrTreat,
		tickMs: 20000,
		/* Do not START a route when a ranked event opens on this shard within
		   this long. graveyard is the exception - see totBossSoon(). */
		leadMs: 5 * 60 * 1000,
		retryMs: 10 * 60 * 1000,    // after a route that ended with doors still open
		moveMs: 120000,             // noHang bound on one walk to a door
		reach: 80,                  // the server's own door radius
	},
	/* WITCH'S CIPHER INGREDIENT FARMING - operator's rulings 2026-10-24.
	   Farm only while Meltymerch holds fewer than `target` of ANY of the four
	   ingredients IN HIS OWN BAG, and only during a gathering window (the first
	   `gathering` seconds of a round, read live from G). The count reaches us as
	   a `cipher_stock` message from him; one older than stockMaxAgeMs is
	   unknown, and an unknown count farms nothing. Bosses and events outrank it
	   throughout: it holds the party on a shard and points the farm spot, and
	   nothing it does interrupts the boss layers. `hop` lets it take the party
	   to another shard's window; home is preferred, but only inside home's own
	   window. Off-shard it hops early enough to clear hop sickness first.
	   -> RangerComments.md#cipherFarm */
	cipherFarm: {
		enabled: TOGGLES.cipherFarm,
		hop: TOGGLES.cipherFarmHop,
		target: 25,                       // per ingredient, in Meltymerch's own bag
		stockMaxAgeMs: 15 * 60 * 1000,
		tickMs: 15000,
		walkLeadMaxMs: 10 * 60 * 1000,    // how early an on-shard window is planned for
		marginMs: 60 * 1000,              // added to every lead
		minUsefulMs: 3 * 60 * 1000,       // gathering left once there, or the trip is refused
		pathFactor: 1.5,                  // door-graph distance to walking distance
		unknownTravelSec: 300,            // no door route found - assume a long walk
		switchFactor: 1.25,               // a held pick yields only to one this much better
		askEveryMs: 2 * 60 * 1000,        // how often to ask Meltymerch for a count while ours is stale
	},
};

const TICK_RATE = { main: 100, action: 15, mark: 40, equipment: 25, maintenance: 2000 };
const MERCHANT_WAIT_TIMEOUT_MS = 90000;
const COOLDOWNS = { cc: 135 };
const CACHE_TTL = 50;

const EVENT_LOCATIONS = [
	{ name: 'dragold', map: 'cave', x: 1150, y: -850 },
	{ name: 'mrgreen', map: 'spookytown', x: 610, y: 1000 },
	{ name: 'mrpumpkin', map: 'halloween', x: -222, y: 720 }
];

const getDynamicEvents = () => {
	const out = [...EVENT_LOCATIONS];
	const w = parent.S?.wabbit;
	if (w?.live) out.push({ name: 'wabbit', map: w.map, x: w.x, y: w.y });
	// Giga Crab is a daily with G.events.crabxx.join === true, so arrival is an
	// event join rather than a walk - no map or coordinates needed, and there is
	// no static monster pack to walk to anyway. handleEvents() already emits the
	// join for any entry carrying join: true.
	const c = parent.S?.crabxx;
	if (c?.live) out.push({ name: 'crabxx', join: true, map: c.map, x: c.x, y: c.y });
	return out;
};

const REGIONS = ['US', 'EU', 'ASIA'];

const COMBAT_SETS = {
	neverAttack: new Set(CONFIG.combat.neverAttack),
	attackIfTargeted: new Set(CONFIG.combat.attackIfTargeted),
	alwaysAttack: new Set(CONFIG.combat.alwaysAttack),
	targetPriority: new Set(CONFIG.combat.targetPriority),
	xpMonsters: new Set(CONFIG.equipment.xpMonsters),
	bosses: new Set(allBosses),
};

const state = {
	skinReady: false,
	lastEquipTime: 0,
	lastBoosterSwap: 0,
	lastCapeSwap: 0,
	lastCoatSwap: 0,
	lastBossSetSwap: 0,
	lastXpSwap: 0,
	angle: 0,
	lastAngleUpdate: performance.now(),
	waitingForMerchant: false,
	waitingForMerchantSince: 0,
	sellingOff: false,          // freeing slots at a vendor; mainLoop stands down
	restocking: false,
};

const cache = {
	targets: { sortedByHP: [], inRange: [], outOfRange: [], clumped: [] },
	healTarget: null,
	priestTargets: 0,
	hasLowHpXpMob: false,
	lastUpdate: 0,
	isValid() { return performance.now() - this.lastUpdate < CACHE_TTL; }
};


let destination = null;

const equipmentSets = {
	single: [
		{ itemName: "bowofthedead", slot: "mainhand", level: 11, l: "l" },
		{ itemName: "t2quiver", slot: "offhand", level: 9, l: "l" },
	],
	dead: [
		{ itemName: "bowofthedead", slot: "mainhand", level: 11, l: "l" },
		{ itemName: "t2quiver", slot: "offhand", level: 9, l: "l" },
	],
	deadx: [
		{ itemName: "bowofthedead", slot: "mainhand", level: 11, l: "l" },
		{ itemName: "alloyquiver", slot: "offhand", level: 10, l: "l" },
	],
	boom: [
		{ itemName: "pouchbow", slot: "mainhand", level: 13, l: "l" },
		{ itemName: "alloyquiver", slot: "offhand", level: 10, l: "l" },
	],
	heal: [{ itemName: "cupid", slot: "mainhand", level: 9, l: "l" }],
	dps: [
		{ itemName: "dexearring", slot: "earring2", level: 5, l: "l" },
		{ itemName: "dexearring", slot: "earring1", level: 5, l: "l" },
		{ itemName: "suckerpunch", slot: "ring1", level: 3, l: "l" },
		{ itemName: "suckerpunch", slot: "ring2", level: 3, l: "u" },
	],
	luck: [
		{ itemName: "mearring", slot: "earring1", level: 0, l: "l" },
		{ itemName: "mearring", slot: "earring2", level: 0, l: "u" },
		{ itemName: "rabbitsfoot", slot: "orb", level: 2, l: "l" },
		{ itemName: "ringofluck", slot: "ring2", level: 0, l: "u" },
		{ itemName: "ringofluck", slot: "ring1", level: 0, l: "l" }
	],
	xp: [
		{ itemName: "talkingskull", slot: "orb", level: 4, l: "l" },
		{ itemName: "northstar", slot: "amulet", level: 2, l: "l" },
	],
	orb: [
		{ itemName: "orbofdex", slot: "orb", level: 5, l: "l" },
		{ itemName: "dexamulet", slot: "amulet", level: 6, l: "l" },
	],
	stealth: [{ itemName: "stealthcape", slot: "cape", level: 0, l: "l" }],
	cape: [{ itemName: "vcape", slot: "cape", level: 6, l: "l" }],
	mana: [{ itemName: "tshirt9", slot: "chest", level: 7, l: "l" }],
	stat: [{ itemName: "coat", slot: "chest", level: 12, l: "s" }],
};

const shouldAttackMob = (mob) => {
	if (!mob || mob.dead) return false;
	if (rageHoldFire(mob)) return false;
	if (COMBAT_SETS.neverAttack.has(mob.mtype)) return false;
	/* Giga Crab spawns 1,000 crabx, and alwaysAttack would commit us to every
	   one of them. Measured 2026-09-25: a crabx hits for 189 after mitigation
	   against a 4,621 HP pool - 24 hits - so the swarm is what kills a ranger
	   here, not the boss. The boss itself hits for 12,572, which is 2.7x the
	   whole pool, so trading with it is never an option either; the plan is to
	   stand outside its 45 range with our 160 and contribute damage. Ignoring
	   the adds keeps the shots on the boss, which is what earns cooperative
	   credit. Flip ignoreAddsDuringCrabxx to false to go back to the swarm. */
	if (mob.mtype === 'crabx' && CONFIG.combat.ignoreAddsDuringCrabxx && parent?.S?.crabxx?.live) return false;
	if (mob.mtype === home) return true;
	/* `also` monsters from the achievement entry are farmed alongside `home`.
	   achvApply() has always read the list, whitelisted them against the
	   economics check and fed them to ragePullTypes() - so a snake at the
	   osnake spot was pulled and protected, and then never shot, because the
	   attack filter did not look at the list. It fell through to the
	   targetPriority fallback at the bottom, which only says yes while the mob
	   is hitting FatherToken. Checked HERE, at the same precedence as `home`,
	   and deliberately NOT by adding it to CONFIG.combat.alwaysAttack: that set
	   is a SORT KEY in updateCache as well as a filter, so snake there would
	   rank every snake above the osnakes the achievement is counting, and would
	   do it on every map rather than only at the spot. */
	if (rageAlso.length && rageAlso.indexOf(mob.mtype) >= 0) return true;
	/* THE EVENT WE ARE ON, for the types no existing selector names. Scoped
	   by those two exclusions rather than placed after them, so it changes
	   exactly the monsters that had NO rule and leaves every monster that had
	   one alone: rgoo and bgoo are in allBosses and therefore in
	   attackIfTargeted, so a goobrawl keeps its deliberate "engage a
	   cooperative boss only once somebody else is on it" rule, while gargoyle,
	   zombie, ghoul and horseman become ours to OPEN on. The ranger opens and
	   the followers join through their own BOSS_SET loop, which still requires
	   `.target` - that division is the existing design, not a new one. */
	if (bossFightTypes().indexOf(mob.mtype) >= 0
		&& !COMBAT_SETS.alwaysAttack.has(mob.mtype)
		&& !COMBAT_SETS.attackIfTargeted.has(mob.mtype)) return true;
	if (COMBAT_SETS.alwaysAttack.has(mob.mtype)) return true;
	if (COMBAT_SETS.attackIfTargeted.has(mob.mtype)) {
		return mob.target !== null && mob.target !== undefined;
	}
	return COMBAT_SETS.targetPriority.has(mob.target);
};

const EXPLOSION_RADIUS = { boom: 68 / 3.6, dead: 23 / 3.6 };

const updateCache = () => {
	if (!cache.isValid()) {
		const now = performance.now();
		/* `destination` shapes ONLY the clumped bucket. This used to return
		   early without it, which left cache.targets empty - and handleAttack
		   with nothing to shoot - for any boss trip that starts before the farm
		   search has answered, which after a hop is every one of them. */
		const homeX = destination ? destination.x : null;
		const homeY = destination ? destination.y : null;
		const clumpRadius = CONFIG.movement.clumpRadius;
		const xpHpThreshold = CONFIG.equipment.xpMobHpThreshold;

		cache.priestTargets = 0;
		cache.hasLowHpXpMob = false;
		cache.untargeted = [];

		const sortedByHP = [];

		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (e.type !== 'monster') continue;

			if (e.target === 'FatherToken') cache.priestTargets++;

			if (!cache.hasLowHpXpMob && !e.dead &&
				(COMBAT_SETS.xpMonsters.has(e.mtype) || e.mtype === home) &&
				e.hp < xpHpThreshold) {
				cache.hasLowHpXpMob = true;
			}

			if (e.target == null && !COMBAT_SETS.alwaysAttack.has(e.mtype)) {
				cache.untargeted.push(e);
			}

			if (shouldAttackMob(e)) sortedByHP.push(e);
		}

		sortedByHP.sort((a, b) => {
			const aBoss = COMBAT_SETS.attackIfTargeted.has(a.mtype);
			const bBoss = COMBAT_SETS.attackIfTargeted.has(b.mtype);
			if (aBoss !== bBoss) return bBoss - aBoss;

			const aPriority = COMBAT_SETS.alwaysAttack.has(a.mtype);
			const bPriority = COMBAT_SETS.alwaysAttack.has(b.mtype);
			if (aPriority !== bPriority) return bPriority - aPriority;

			const aCurse = a.s?.curse ? 1 : 0, bCurse = b.s?.curse ? 1 : 0;
			if (aCurse !== bCurse) return bCurse - aCurse;

			const aMarked = a.s?.marked ? 1 : 0, bMarked = b.s?.marked ? 1 : 0;
			if (aMarked !== bMarked) return bMarked - aMarked;

			return b.hp - a.hp;
		});

		const inRange = [], outOfRange = [], clumped = [];
		for (const mob of sortedByHP) {
			if (is_in_range(mob)) {
				inRange.push(mob);
				if (destination && Math.hypot(mob.x - homeX, mob.y - homeY) <= clumpRadius) {
					clumped.push(mob);
				}
			} else {
				outOfRange.push(mob);
			}
		}

		cache.targets = { sortedByHP, inRange, outOfRange, clumped };
		cache.healTarget = findHealTarget();
		cache.lastUpdate = now;
	}
};

const aoeUnsafe = (targets, radius) => {
	for (const t of targets) {
		for (const e of cache.untargeted) {
			if (Math.hypot(e.x - t.x, e.y - t.y) <= radius) return true;
		}
	}
	return false;
};

const findHealTarget = () => {
	const healer = get_entity('FatherToken');
	const threshold = (!healer || healer.rip) ? 0.9 : 0.5;
	const party = Object.keys(get_party() || {});

	let target = null, minPct = 1;

	for (const name of party) {
		if (name === character.name) continue;
		const ally = get_player(name);
		if (ally?.hp && ally?.max_hp && !ally.rip) {
			const pct = ally.hp / ally.max_hp;
			if (pct < minPct) { minPct = pct; target = ally; }
		}
	}

	return minPct < threshold ? target : null;
};

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
// -> RangerComments.md#await-hang-guard
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

async function mainLoop() {
	try {
		/* Containment first, and the pull owns movement while it runs - the same
		   stand-down shape as sellingOff and mhBusy below. ragePullTick is NOT
		   awaited: a pull is two round trips and mainLoop is wrapped in the 10s
		   HANG_GUARD, which is exactly the trap restockTrip was detached to avoid. */
		if (await rageGuard()) return setTimeout(mainLoop, 250);
		if (ragePull.busy || rageNav.busy) return setTimeout(mainLoop, 250);
		if (ragePullActive()) ragePullTick().catch(e => rageLog('pull tick threw: ' + errText(e), 'red'));
		if (is_disabled(character)) return setTimeout(mainLoop, 250);
		// Selling junk off to make room. Same shape as waiting for the merchant:
		// stand down until it finishes, and it always finishes.
		if (state.sellingOff) return setTimeout(mainLoop, 250);
		/* A Daisy trip owns movement. Same shape as the merchant wait: stand down
		   until it finishes, and it always finishes - mhGoDaisy is noHang-bounded. */
		if (mhBusy) return setTimeout(mainLoop, 250);
		/* A knock route owns movement the same way. */
		if (totBusy) return setTimeout(mainLoop, 250);
		if (state.waitingForMerchant) {
			if (Date.now() - state.waitingForMerchantSince > MERCHANT_WAIT_TIMEOUT_MS) {
				state.waitingForMerchant = false;
				game_log('Gave up waiting on the merchant - resuming on my own', 'red');
			} else {
				return setTimeout(mainLoop, 250);
			}
		}
		if (await noHang(checkPotionEmergency(), 'checkPotionEmergency')) {
			return setTimeout(mainLoop, TICK_RATE.main);
		}
		updateCache();

		if (CONFIG.equipment.useLicence) {
			let slot = locate_item("licence");
			if (slot === -1 && (character?.s?.licenced?.ms ?? 0) < 5000) {
				const p = buyWhereSold('licence', 1, 'licence');
				if (p) { await p; slot = locate_item("licence"); }
			}
			if ((character?.s?.licenced?.ms ?? 0) < 250 && slot !== -1) {
				await consume(slot);
			}
		}

		if (await noHang(bossHop.tick(), 'bossHop.tick') === 'block') {
			return setTimeout(mainLoop, TICK_RATE.main);
		}
		if (character.map === "jail" && !smart.moving) {
			log("Jail escape plan!");
			return smart_move(find_npc("jailer")).then(() => {
				parent.socket.emit("leave");
			});
		}

		/* BOOT ORDER. The farm gate used to sit ABOVE this chain, so after a hop
		   nothing evaluated a boss until the farm search had answered - and the
		   farm spot was decided (and, on the leader, broadcast) before any boss
		   was considered. The event branch needs none of home/mobMap/destination
		   (measured by extracting every function it reaches), so it runs first
		   and the gate guards only the farm-dependent movement branch below. */
		const eventsNow = shouldHandleEvents();
		farmBootBossEval = true;   // one boss evaluation has completed - sendFarmSpot reads this
		if (eventsNow) {
			handleEvents();
		}
		else if (!home || !mobMap || !destination) {
			return setTimeout(mainLoop, 250);   // farm not decided yet; events above still ran
		}
		else if (CONFIG.movement.enabled) {
			if (!get_nearest_monster({ type: home })) {
				handleReturnHome();
			} else if (CONFIG.movement.rangedKiting.enabled) {
				/* Chained, not exclusive. rangedKite() returns false when nothing
				   kite-worthy is in reach, and this was an `else if` - so merely
				   enabling kiting would have retired walkInCircle() altogether and
				   left him standing still at every ordinary farm spot. */
				const kited = await noHang(rangedKite(), 'rangedKite');
				if (!kited && CONFIG.movement.circleWalk) walkInCircle();
			} else if (CONFIG.movement.circleWalk) {
				walkInCircle();
			}
		}
	} catch (e) {
		console.error('mainLoop error:', e);
	}

	setTimeout(mainLoop, TICK_RATE.main);
}

const ACTION_MIN_DELAY = 15;

const actionLoop = async () => {
	try {
		if (is_disabled(character)) return setTimeout(actionLoop, 25);
		updateCache();
		const ms = ms_to_next_skill('attack') - 1.5;
		if (ms < 3) {
			if (cache.healTarget) { equipSet('heal'); await noHang(use_skill('attack', cache.healTarget), 'use_skill heal'); }
			else await noHang(handleAttack(), 'handleAttack');
			return setTimeout(actionLoop, ACTION_MIN_DELAY);
		}
		return setTimeout(actionLoop, ms > 8 ? ms - 6 : ACTION_MIN_DELAY);
	} catch { return setTimeout(actionLoop, ACTION_MIN_DELAY); }
};

/* ---- Slenderman: hits of opportunity, never a trip ------------------------
   He is in CONFIG.bossEvents.exclude, so the boss code will not walk to him.
   That is not squeamishness - it is that the walk cannot work:

     * The spawn broadcast carries only { name, map }. Every other boss also
       sends x/y. bossWalkTarget() therefore returns null for him, forever.
     * event_loop runs once a second and relocates him to a random walkable
       node on a random one of cave/halloween/spookytown if ANY non-invisible
       player on his map comes within 600 units, if any projectile targets
       him, or if 2 minutes have passed. Our range is 165. We cannot close
       435 units without being the thing that teleports him away.
     * Only s.invis suppresses the proximity trigger, and step_out_of_invis()
       sits in the shared attack path, so even a rogue drops invis on its own
       first swing. Nobody holds him. He has sat at 66,666/66,666 all event.

   So the only shot that exists is the one where he materialises on top of us.
   This runs at attack cadence and takes exactly that shot and nothing else:
   no movement, no target commitment, no trip.

   PHYSICAL ATTACKERS ONLY. reflection:96 is gated on defense == 'resistance',
   which is set for MAGICAL damage only, so a mage or priest would send 96% of
   each cast into their own face. The ranger is clean: slenderman carries no
   armor, no resistance and no evasion, so physical lands in full. The class is
   read from G at runtime rather than hardcoded so this block stays correct if
   it is ever copied into the other two files - there it simply never fires. */
const SLENDER_MAPS = new Set(['cave', 'halloween', 'spookytown']);
let slenderLastNote = 0;
function slenderNote() {
	if (Date.now() - slenderLastNote < 1000) return;
	slenderLastNote = Date.now();
	try { game_log('[slender] in range - taking the shot', '#B388FF'); } catch (e) { }
	console.log('[slender] in range - taking the shot');
}
function slenderOpportunity() {
	try {
		if (typeof parent === 'undefined' || !parent.entities) return null;
		const S = parent.S || {};
		if (!S.slenderman || !S.slenderman.live) return null;
		if (!SLENDER_MAPS.has(character.map)) return null;
		/* typeof, not truthiness: an undeclared identifier THROWS. */
		const cls = (parent.G && parent.G.classes) ? parent.G.classes[character.ctype] : null;
		if (!cls || cls.damage_type !== 'physical') return null;
		for (const id in parent.entities) {
			const e = parent.entities[id];
			if (!e || e.type !== 'monster' || e.mtype !== 'slenderman' || e.dead) continue;
			if (typeof is_in_range === 'function' && !is_in_range(e)) return null;
			return e;
		}
		return null;
	} catch (err) {
		/* A default returned from a catch must say so, or 'the helper is missing'
		   and 'there is no slenderman here' stay indistinguishable forever. */
		console.error('[slender] opportunity check threw:', err);
		return null;
	}
}

const handleAttack = async () => {
	// FIRE ONLY AT WHAT IS ACTUALLY IN RANGE.
	// `sortedByHP` is every monster on screen, sorted by HP descending and NOT
	// filtered by range. top5/top3 used to slice from it, and of the six branches
	// below only the last one ever checked range - so the aoe branches routinely
	// fired at the three or five HEALTHIEST mobs on screen, which are the ones
	// still at full HP precisely because nobody can reach them. The `clumped`
	// guard did not help: it proves SOME mob is close, then the shot goes to
	// top3 anyway. Measured 2026-09-22: 33 consecutive 3shot casts at crabs
	// 683-715 units away with a range of 158, and 0 xp from all 33.
	// `inRange` is the same list in the same HP order, minus that mistake, so
	// every branch below inherits the range check for free.
	/* Slenderman first, and only if he is already standing in our range. See
	   slenderOpportunity() for why there is no path to him and never will be.
	   Checked before the inRange guard below on purpose: he is not in
	   alwaysAttack and not `home`, so shouldAttackMob() keeps him out of
	   cache.targets entirely and inRange is routinely empty while he is
	   literally on top of us. */
	const slender = slenderOpportunity();
	if (slender) {
		change_target(slender);
		slenderNote();
		await noHang(use_skill('attack', slender), 'use_skill slenderman');
		return;
	}

	const { inRange, clumped } = cache.targets;
	if (!inRange.length) return;

	/* Concentrate. Aggro scales with how many DISTINCT monsters have been
	   provoked, and a focused target dies ~3x sooner so it stops swinging. */
	const ff = CONFIG.combat.focusFire || {};
	const crowded = ff.enabled !== false && kiteAttackerCount() >= (character.courage || 2);
	/* Built per call rather than hoisted into COMBAT_SETS, so the list can be
	   edited live from the console without a redeploy. Ten names at attack
	   cadence costs nothing. */
	const stSet = new Set(ff.singleTargetMobs || []);
	const listedHome = (typeof home !== 'undefined') && stSet.has(home);
	const listedHere = stSet.size > 0 && inRange.some(function (m) { return stSet.has(m.mtype); });
	if (ff.enabled !== false && (listedHome || listedHere || ff.preferSingleTarget || crowded)) {
		const pick = ff.leaderPicksLowestHp !== false
			? inRange.reduce(function (a, b) { return (a && a.hp <= b.hp) ? a : b; }, null)
			: inRange[0];
		if (pick) {
			change_target(pick);
			equipSet('single');
			await noHang(use_skill('attack', pick), 'use_skill focus');
			return;
		}
	}

	const min5 = CONFIG.combat.minTargetsFor5Shot;
	const min3 = CONFIG.combat.minTargetsFor3Shot;
	const can5 = character.level >= (G.skills['5shot']?.level || 0) && character.mp >= (G.skills['5shot']?.mp || 0);
	const can3 = character.level >= (G.skills['3shot']?.level || 0) && character.mp >= (G.skills['3shot']?.mp || 0);
	const top5 = can5 && inRange.length >= min5 ? inRange.slice(0, 5) : null;
	const top3 = can3 && inRange.length >= min3 ? inRange.slice(0, 3) : null;

	if (can5 && clumped.length >= min5) {
		const slice = clumped.slice(0, 5);
		if (!aoeUnsafe(slice, EXPLOSION_RADIUS.boom)) {
			equipSet('boom');
			await use_skill('5shot', slice.map(e => e.id));
			return;
		}
	}
	if (top5 && !aoeUnsafe(top5, EXPLOSION_RADIUS.dead)) {
		equipSet('dead'); await use_skill('5shot', top5.map(e => e.id)); return;
	}
	if (top3 && clumped.length >= min3 && !aoeUnsafe(top3, EXPLOSION_RADIUS.dead)) {
		equipSet('deadx'); await use_skill('3shot', top3.map(e => e.id)); return;
	}
	if (top3 && !aoeUnsafe(top3, EXPLOSION_RADIUS.dead)) {
		equipSet('dead'); await use_skill('3shot', top3.map(e => e.id)); return;
	}
	if (top5) {
		equipSet('dead'); await use_skill('5shot', top5.map(e => e.id));
	} else if (top3) {
		equipSet('dead'); await use_skill('3shot', top3.map(e => e.id));
	} else {
		// inRange[0] is in range by construction. The old form tested
		// sortedByHP[0], so when the healthiest mob on screen was out of reach
		// this fell through and attacked nothing at all, even with mobs at melee.
		equipSet('single'); await noHang(use_skill('attack', inRange[0]), 'use_skill single');
	}
};

const skillLoop = async () => {
	let delay = 15;
	try {
		if (!CONFIG.combat.useHuntersMark && !CONFIG.combat.useSupershot) return;
		if (is_disabled(character)) return setTimeout(skillLoop, 250);

		updateCache();

		const { sortedByHP } = cache.targets;
		if (!sortedByHP.length) return setTimeout(skillLoop, 250);

		const target = sortedByHP[0];
		if (!target || !is_in_range(target)) return setTimeout(skillLoop, 250);

		const msHunter = ms_to_next_skill('huntersmark');
		const msSuper = ms_to_next_skill('supershot');
		const minMs = Math.min(msHunter, msSuper);

		if (minMs < (character.ping || 0) / 10) {
			change_target(target);

			if (CONFIG.combat.useHuntersMark && msHunter === 0 && !target.s?.marked && target.hp >= target.max_hp * 0.01 && character.mp >= (G.skills.huntersmark?.mp || 0)) {
				await noHang(use_skill('huntersmark', target), 'use_skill huntersmark');
			}

			if (CONFIG.combat.useSupershot && msSuper === 0 && character.mp >= (G.skills.supershot?.mp || 0)) {
				await noHang(use_skill('supershot', target), 'use_skill supershot');
			}
		} else {
			delay = minMs > 200 ? 100 : minMs > 50 ? 20 : 15;
		}
	} catch (e) {
		console.error("skillLoop error:", e);
		delay = 15;
	}
	setTimeout(skillLoop, delay);
};

const maintenanceLoop = async () => {
	try {
		if (CONFIG.potions.autoBuy) autoBuyPotions();
		if (CONFIG.party.autoManage) partyMaker();
		if (CONFIG.selling.enabled) sellItems();
		if (CONFIG.upgrading.enabled) upgradeItems();
		if (CONFIG.combining.enabled) combineItems();

		if (CONFIG.muling.enabled) clearInventory();
		checkFarmEconomics();

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

async function equipmentLoop() {
	const delay = TICK_RATE.equipment;

	try {
		if (!state.skinReady || character.cc > COOLDOWNS.cc) {
			return setTimeout(equipmentLoop, delay);
		}

		const now = performance.now();
		const swapCooldown = CONFIG.equipment.swapCooldown;

		const mainhand = character.slots?.mainhand?.name;
		if (mainhand === 'cupid') return setTimeout(equipmentLoop, delay);

		let activeBossName = null, activeBossData = null;
		for (const e of getDynamicEvents()) {
			const d = parent.S[e.name];
			if (d?.live) { activeBossName = e.name; activeBossData = d; break; }
		}

		if (now - state.lastBoosterSwap > swapCooldown) {
			let desiredBooster = activeBossData && activeBossData.hp < CONFIG.equipment.bossHpThresholds[activeBossName]
				? 'luckbooster'
				: 'xpbooster';

			const currentBoosterSlot = locate_item(desiredBooster);
			if (currentBoosterSlot === -1) {
				const otherBoosterSlot = findBoosterSlot();
				if (otherBoosterSlot !== null) {
					shift(otherBoosterSlot, desiredBooster);
					state.lastBoosterSwap = now;
				}
			}
		}

		if (CONFIG.equipment.capeSwapEnabled && now - state.lastCapeSwap > swapCooldown) {
			const chestCount = getNumChests();
			const numTargets = cache.priestTargets;
			const targetCapeSet = chestCount >= CONFIG.equipment.chestThreshold && numTargets < 6
				? 'stealth'
				: 'cape';

			if (targetCapeSet && !isSetEquipped(targetCapeSet)) {
				equipSet(targetCapeSet);
				state.lastCapeSwap = now;
			}
		}

		if (CONFIG.equipment.coatSwapEnabled && now - state.lastCoatSwap > swapCooldown) {
			const targetCoatSet = character.mp > CONFIG.equipment.mpThresholds.upper
				? 'stat'
				: character.mp < CONFIG.equipment.mpThresholds.lower && 'mana';

			if (targetCoatSet && !isSetEquipped(targetCoatSet)) {
				equipSet(targetCoatSet);
				state.lastCoatSwap = now;
			}
		}

		if (now - state.lastBossSetSwap > swapCooldown) {
			if (activeBossData && activeBossData.hp <= CONFIG.equipment.bossHpThresholds[activeBossName]) {
				if (!isSetEquipped('luck')) {
					equipSet('luck');
					state.lastBossSetSwap = now;
				}
			} else {
				if (activeBossName || character.map === mobMap) {
					if (!isSetEquipped('dps')) {
						equipSet('dps');
						state.lastBossSetSwap = now;
					}
				}

				if (CONFIG.equipment.xpSetSwapEnabled && now - state.lastXpSwap > swapCooldown) {
					const targetOrb = cache.hasLowHpXpMob ? 'xp' : 'orb';
					if (!isSetEquipped(targetOrb)) {
						equipSet(targetOrb);
						state.lastXpSwap = now;
					}
				}
			}
		}

		scare();

	} catch (e) {
		console.error('equipmentLoop error:', e);
	}

	setTimeout(equipmentLoop, delay);
}

const BOOSTER_NAMES = new Set(['xpbooster', 'goldbooster', 'luckbooster']);
function findBoosterSlot() {
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (item && BOOSTER_NAMES.has(item.name)) return i;
	}
	return null;
}

function getNumChests() {
	let n = 0;
	for (const _ in get_chests()) n++;
	return n;
}

// ============================================================================
// BOSS EVENTS - go, contribute from maximum range, come home.
// Cooperative bosses only, fought from max range, never expecting the kill.
// The reasoning and the measurements behind every number are in this version's
// entry in the header above; what follows is what the code needs.
// -> RangerComments.md#boss-events-go-contribute-from-maximum-range
/* TAXI PROBE. The claim this whole mechanism rests on - that a hop-sick
   character can WALK to a join event and still earn credit - is derived from
   the server source and has never been observed. This records each episode
   so it can be, and persists to CODE storage because a hop reloads the page
   and wipes anything in memory. Read it with ShowTaxiProbe().
   -> RangerComments.md#taxiWalkProbe */
const TAXI_PROBE_KEY = 'taxi_probe';
const TAXI_PROBE_MAX = 30;

function taxiProbeRead() {
	try { return scopedGetLegacy(TAXI_PROBE_KEY) || []; }
	catch (e) { bossLog('taxi probe read failed: ' + e, 'orange'); return []; }
}

function taxiProbeWrite(list) {
	try {
		while (list.length > TAXI_PROBE_MAX) list.shift();
		scopedSet(TAXI_PROBE_KEY, list);
	} catch (e) { bossLog('taxi probe write failed: ' + e, 'orange'); }
}

/* One row per walk-in-sick episode, keyed on event+shard+spawn so a reload
   mid-fight updates the row it already started rather than opening a new
   one. */
function taxiProbeNote(name, fields) {
	const shard = (typeof parent !== 'undefined')
		? (parent.server_region + parent.server_identifier) : '?';
	const list = taxiProbeRead();
	let row = null;
	for (let i = list.length - 1; i >= 0; i--) {
		if (list[i].name === name && list[i].shard === shard && !list[i].closed) { row = list[i]; break; }
	}
	if (!row) {
		row = { name, shard, started: Date.now(), closed: false };
		list.push(row);
	}
	for (const k in fields) row[k] = fields[k];
	taxiProbeWrite(list);
	return row;
}

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

/* WHERE TO STAND ONCE RAGE ENTRY HAS TAKEN THE PARTY INTO AN EVENT'S BOX.
   Operator's ruling 2026-10-24: the middle of the graveyard, where the zombie
   and ghoul kills are, and NOT the Gargoyle's spawn. The 24 graves span x
   65..447 and y -1550..-1312, so (256,-1430) is their centre, about 115 from
   the spawn at (255,-1545). S.graveyard publishes that spawn from wave 1, and
   with entry on bossWalkTarget's rage guard is off, so on 2026-10-24 22:30Z all
   three walked onto it eight seconds into the first wave. Stand here through
   the waves and fight from here after the wake. */
const BOSS_FIELD_SPOTS = {
	graveyard: { map: 'spookytown', x: 256, y: -1430 },
};
const BOSS_FIELD_HOLD = 40;   // walk back to the spot when further than this from it

/* goobrawl and graveyard are the joinable events whose parent.S key is an
   EVENT name and not a monster name. This read "goobrawl is the ONE" until
   2026-10-22; `parent.S.graveyard` is the second, confirmed live, and the
   count was load-bearing nowhere - but a reader checking whether the
   event-name case was still a single special case would have been told yes.
   -> RangerComments.md#goobrawl-is-the-one-joinable-event-whose */
/* THE OPERATOR'S PRIORITY, 2026-10-18. Equal numbers mean equal priority.

   WHAT IT DECIDES AND WHAT IT DOES NOT. Operator's words: "The bosses worth
   hopping do not change - this is priority to pick while multiple are alive,
   either on the same server or for the ones already identified as worth
   hopping for." So it is a TIE-BREAK ON THE ELIGIBLE SET, never an
   eligibility test. Nothing here admits a boss that requiredDwellSec, the
   arrival test or the join-window test rejected, and nothing here adds or
   removes a hop target - CONFIG.bossHop.targets still decides that.

   WHY IT REPLACED WHAT WAS THERE. The three selectors were each ordering by
   something that was never a statement about worth: bossPick by lowest hp
   ratio (finish whatever is nearest dead), and both bossHop selectors by
   kills_to_rung, which measures ACHIEVEMENT DISTANCE. Neither had been given
   a priority, so each inferred one. This is the given one.

   KEYED BY THE parent.S NAME, which is the event name where one exists -
   goobrawl, not rgoo - because that is what bossLiveNames() yields and what
   bossPick compares. bossMonsterTypes() maps it the other way for the fight,
   one event to possibly SEVERAL monster types.

   AND THAT JUSTIFICATION WAS FALSE FOR THE goobrawl ROW ITSELF UNTIL v115,
   WHICH MADE THIS ENTRY UNREACHABLE FROM THE DAY IT WAS WRITTEN. The server
   publishes `E.goobrawl = { end: ... }` with no `live` field, so the one name
   this clause cites as its example was the one name bossLiveNames() could never
   yield. The keying convention was right; the reason given for it was not, and
   nothing checked the reason. Same unreachable state as dragold under
   lunarnewyear, except that one is recorded below and this one was not - see
   bossEntryLive for the fix and for what the absence cost.

   UNRANKED IS THE DEFAULT BELOW, the operator's "all others", so an unlisted
   boss sorts last rather than being excluded. snowman is ranked but is NOT in
   allBosses, so it can never reach these selectors today; the entry is
   harmless and costs nothing if it is ever added.

   HORSEMAN WENT IN ABOVE mrgreen, OPERATOR'S RULING 2026-10-21, AND EVERYTHING
   AT OR BELOW SHIFTED DOWN ONE. The rule it expresses, so it is not re-derived wrong:
   PERISHABLE-BUT-FREQUENT SITS BELOW RARE-AND-PERMANENT AND ABOVE
   ALWAYS-AVAILABLE. Horseman ends with Halloween, which argues for urgency -
   but it runs NIGHTLY across three regions and about six shards, so the season
   holds dozens of chances at it. wabbit is rare and does not expire, so when
   both are up wabbit is the right grab. mrgreen is always available and will
   still be there in January, so it sits below both.
   A DEADLINE IS NOT THE SAME THING AS SCARCITY, and ranking by "ends soonest"
   would have put horseman above wabbit on exactly that confusion.

   IT IS AN ORDER-PRESERVING INSERTION, which a TIE WITH mrgreen WOULD NOT HAVE BEEN.
   Every pairwise relationship that held before still holds; only horseman is
   new in the order. A tie would have fallen through to `need` and then
   `kills_to_rung`, and neither of those knows a deadline exists - so the tie
   would have been decided by achievement distance, which is the very thing
   this table replaced.

   SEASONAL ENTRIES STAY IN THIS TABLE YEAR-ROUND, and removing horseman in
   November is a no-op NOT to perform. Verified rather than assumed:
   `bossRank()` below is a pure lookup with a default and NOTHING iterates
   BOSS_RANK, while all three call sites pass a name that already came off a
   live candidate list. So an entry for a non-spawning boss is UNREACHABLE
   rather than merely harmless - which is what dragold at the top has been
   demonstrating for as long as `lunarnewyear` has been false.

   GOOBRAWL ALONE, OPERATOR'S RULING 2026-10-25, AND EVERYTHING BELOW IT MOVED
   DOWN ONE. Prompted by 12:09Z that day, when a crabxx on another shard pulled
   the party out of a running goobrawl it tied with. Order-preserving again:
   the only relationships that moved are goobrawl over crabxx and wabbit, which
   used to tie. crabxx over the graveyard falls out of the same table, and the
   operator confirmed it.

   witchcipher IS IN THE TABLE, OPERATOR'S RULING 2026-10-25 20:00 EDT, BETWEEN
   THE HALLOWEEN EVENTS AND mrgreen. Before it the cipher held at a constant one
   past the default, below every boss. The only relationships that moved are the
   cipher over mrgreen, snowman, grinch and mrpumpkin. IT IS NEVER APPROACHED AS
   A BOSS: parent.S.witchcipher is live, so bossLiveNames() yields it, but it has
   no G.monsters entry, bossCooperative() is false and bossEligible() refuses it
   under cooperativeOnly - so the entry only ranks the gathering hold (holdRank,
   cipherPlan) against a boss hop. totBossSoon() names it as unranked, because
   the knock route must not wait on a gathering window.

   NO RANK NUMBER IS QUOTED IN THESE COMMENTS ANY MORE, because every ruling
   above moved some of them and the quotes went stale each time. The table is
   the only statement of the numbers; the comments say why the ORDER is what it
   is. */
const BOSS_RANK = {
	dragold: 1,
	franky: 2,
	goobrawl: 3,
	crabxx: 4, wabbit: 4,
	horseman: 5, graveyard: 5,
	witchcipher: 6,
	mrgreen: 7,
	snowman: 8, grinch: 8, mrpumpkin: 8,
};
/* graveyard TIES horseman on the operator's ruling, and a tie is normally
   the thing this table avoids - it falls through to `need` and then
   kills_to_rung, the mechanism the ranking exists to override. It is safe here
   because THE TWO CAN NEVER BE LIVE TOGETHER: horseman runs at realm hour 0,
   which is UTC 23/05/17 - all ODD - while graveyard runs at odd realm hours
   minus odd offsets, which lands on EVEN UTC at :30. Minimum separation 20
   minutes, so the tie is unreachable rather than merely unlikely.
   CONTINGENT ON TIMEO BEING ALL-ODD ({EU:1, US:-5, ASIA:7}). A fourth region
   with an even offset would make graveyard collide with horseman and expose
   this tie, and nothing in the schedule code would have to change for that to
   happen - so re-derive it if TIMEO ever grows.
   WHY WITH HORSEMAN AND NOT WITH THE ALWAYS-UP BOSSES BELOW: twelve graveyards
   a day and ~144 before the season ends is an abundance argument, and
   abundance is the wrong axis when every window banks share toward a 6,000,000
   cooperative boss. */
/* MUST STAY ABOVE THE LARGEST ASSIGNED RANK, so it is DERIVED as one past it -
   operator's approval 2026-10-25 - rather than written as a literal that every
   insertion has to remember to bump. Equal to the largest, the unranked set
   would TIE with the bottom group and sort by kills_to_rung against it, which
   is the failure the table exists to stop.
   THIS IS THE ONE PLACE THE TABLE IS ENUMERATED, and it reads only the largest
   value: an entry for a boss that never spawns can still raise the default, and
   nothing else. bossRank() below stays a keyed lookup, which is what keeps a
   seasonal entry unreachable. Tests/suite_bosshop.js allows this line and no
   other. */
const BOSS_RANK_DEFAULT = Math.max.apply(null, Object.values(BOSS_RANK)) + 1;
function bossRank(name) {
	const r = BOSS_RANK[name];
	return typeof r === 'number' ? r : BOSS_RANK_DEFAULT;
}

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
   copies them), so excluding it costs no share. It stays out of THIS table
   because the table also feeds the rage pull and the eligibility gate, and the
   pull must never reach for a 6,000,000 hp boss from the corridor. The
   operator's call came 2026-10-24 - enter the box for it - and it is taken
   in bossFightTypes(), which adds the Gargoyle only while we are inside. */
const BOSS_FIGHT_TYPES = { goobrawl: ['rgoo', 'bgoo'], graveyard: ['zombie', 'ghoul'], horseman: ['horseman', 'jackowalker'] };
function bossMonsterTypes(name) { return BOSS_FIGHT_TYPES[name] || [name]; }
/* THE EVENT'S OWN MONSTERS, AND ONLY WHILE A TRIP IS LIVE. The attack
   selectors ask `allBosses` (via COMBAT_SETS on the ranger, BOSS_SET on the
   followers), and that list names NONE of the event spawns - not gargoyle,
   not horseman, not zombie, not ghoul. So a character standing in front of
   the Gargoyle had no rule that said to shoot it and engaged only when the
   boss happened to target the one name in `targetPriority`. That is aggro
   luck, and it is how the 2026-10-22 kill landed after the operator forced
   the party into the box by hand.
   NOT FIXED BY WIDENING THOSE SETS. On the ranger `alwaysAttack` is a SORT
   KEY in updateCache as well as a filter, so a zombie there would outrank the
   farm target on every map forever - the same argument the `rageAlso` check
   records two lines above its own call site. Gating on `bossState.trip` makes
   the widening exist only while we are actually on the event, which is the
   one window in which these monsters are what we travelled for. */
function bossFightTypes() {
	const trip = (typeof bossState !== 'undefined' && bossState && bossState.trip) ? bossState.trip : null;
	if (!trip || !trip.name) return [];
	const types = bossMonsterTypes(trip.name);
	/* INSIDE THE RAGE BOX THE GARGOYLE IS A TARGET TOO. Entry is for the waves
	   (rageEntryNotWanted), but once the Gargoyle is up the party inside is
	   standing at its spawn. rageEntryActive is containment off, which is also
	   what points the walk at that spawn rather than the join spot
	   (bossWalkTarget), so the two widen together. */
	if (trip.name === 'graveyard' && rageEntryActive) return types.concat(['gargoyle']);
	return types;
}

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
// -> RangerComments.md#rage-boxes-the-geometry-the-farm-scorer

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
let rageEntryInSince = 0;
let rageEntryWindow = [];
let rageEntryHeard = null;
let rageEntryRetreatAt = 0;

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
		   -> RangerComments.md#measured-2026-10-09-and-the-single */
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

/* THE WAY OUT OF A BOX FOR A CHARACTER ALREADY STANDING IN ONE - Ranger v150 /
   Priest v83 / Mage v106. rageEscape takes the NEAREST edge, and from the
   graveyard field that is the wall north of it; rageRoute seeds from the
   nearest open cell within 14 cells, which from the middle of the field is
   none, so every safeSmartMove out refused - measured 12:33Z 2026-10-25 on
   EU II, "no safe route to 255,-1030 ... refusing to let the pathfinder cut
   through a rage box" on all three. A leg that only EXITS cannot cut through
   anything. This weighs each edge by where we are going and prefers one a
   straight leg reaches: the four points rageEscape considers, plus each edge's
   point nearest the destination. A point inside another box, or one nobody
   can stand on, is dropped. null when we are not in a box or nothing is left,
   and the caller falls back to what it did before. */
function rageExitPoint(map, from, to, margin) {
	const b = rageHit(map, from.x, from.y, margin);
	if (!b) return null;
	const r = b.r, m = margin + 2;
	const cx = (v) => Math.max(r[0] - m, Math.min(r[2] + m, v));
	const cy = (v) => Math.max(r[1] - m, Math.min(r[3] + m, v));
	const cands = [
		{ x: r[0] - m, y: from.y }, { x: r[2] + m, y: from.y },
		{ x: from.x, y: r[1] - m }, { x: from.x, y: r[3] + m },
	];
	if (to) cands.push({ x: r[0] - m, y: cy(to.y) }, { x: r[2] + m, y: cy(to.y) },
		{ x: cx(to.x), y: r[1] - m }, { x: cx(to.x), y: r[3] + m });
	const base = character.base;
	const line = (a, p) => {
		if (typeof can_move !== 'function') return null;
		try { return !!can_move({ map: map, x: a.x, y: a.y, going_x: p.x, going_y: p.y, base: base }); }
		catch (e) { return false; }
	};
	let best = null;
	for (const p of cands) {
		if (rageHit(map, p.x, p.y, margin)) continue;
		if (line(p, p) === false) continue;
		const clear = line(from, p) !== false;
		const cost = Math.hypot(p.x - from.x, p.y - from.y) + (to ? Math.hypot(to.x - p.x, to.y - p.y) : 0);
		if (!best || (clear && !best.clear) || (clear === best.clear && cost < best.cost))
			best = { x: p.x, y: p.y, clear: clear, cost: cost };
	}
	return best ? { x: best.x, y: best.y, clear: best.clear } : null;
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
	   -> RangerComments.md#four-connected-on-nodes-only */
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
   -> RangerComments.md#walks-a-safe-route-re-planning-when */
const rageNav = { busy: false };

/* An optional hand-pinned chain, tried before the search:
     CONFIG.movement.approaches['spookytown|415|-986'] = [[x1,y1],[x2,y2], ...]
   Measured 2026-10-09 across two monitored trips and 1,283 position samples,
   the pathfinder's own route to this park point never enters a rectangle, so
   nothing currently needs one - it exists so a spot CAN be pinned by hand
   without that being load-bearing. A chain whose own points sit inside a
   rectangle is refused rather than walked. */
function rageWaypoints(map, to, margin) {
	/* ALREADY INSIDE A BOX: walk the exit leg, then route from where it lands.
	   See rageExitPoint. A route that cannot continue from the exit is no
	   route, because rageWalk would report having arrived at the edge. */
	const here = { x: character.x, y: character.y };
	if (rageHit(map, here.x, here.y, 0)) {
		const ex = rageExitPoint(map, here, to, margin);
		if (ex) {
			const rest = rageRoute(map, ex, to, margin);
			return rest ? [[ex.x, ex.y]].concat(rest) : null;
		}
	}
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
	if (!hit) { rageEscapeEp.joinAt = 0; return false; }
	/* A TOWN CHANNEL IS UNDER WAY - any move would cancel it. */
	if (character.c && character.c.town) return true;
	rageLog('inside the ' + hit.type + ' rage box at ' + Math.round(character.x) + ',' + Math.round(character.y) + ' - leaving now', 'red');
	try { if (typeof stop === 'function') stop(); } catch (e) { }
	/* Toward the park point we are working, by a leg we can walk - not the
	   nearest edge, which from the graveyard field is a wall. */
	const ctx = ragePullCtx();
	const aim = (ctx.map === character.map && typeof ctx.x === 'number') ? { x: ctx.x, y: ctx.y } : null;
	const e2 = rageExitPoint(character.map, { x: character.x, y: character.y }, aim, cfg.margin)
		|| rageEscape(character.map, character.x, character.y, cfg.margin);
	let why = 'no xmove';
	if (typeof xmove === 'function') {
		try { await xmove(e2.x, e2.y); return true; } catch (err) { why = errText(err); }
	}
	rageLog('escape move failed: ' + why, 'red');
	await rageEscapeLadder(e2, why);
	return true;
}

/* THE ESCAPE LADDER, operator's ruling 2026-10-24, for when the pathfinder
   cannot get us out. Measured that evening on EU III: Dexon sat on the
   Gargoyle spawn for eight minutes logging "Path not found!" every tick while
   can_move_to(255,-1030) - the graveyard's join spot - was TRUE, and he and
   the mage died inside the box after the event had ended. The pathfinder's
   target is the NEAREST point outside the rectangle, which there is the wall
   north of the field. In order:
   (1) a straight-line move to that point, or to the join spot of an event on
       this map, wherever can_move_to says the line is clear;
   (2) the event's own join, which moves anyone more than 200 from the spot
       back onto it - only while the event is live, once per stay inside;
   (3) town. Not refused for attackers the way rageStuckTown is: inside the
       box something is always on us, and staying is what killed them. */
const RAGE_ESCAPE_JOIN_WAIT_MS = 6000;   // let a join's teleport land before town
const RAGE_ESCAPE_TOWN_GAP_MS = 20000;
const rageEscapeEp = { joinAt: 0, townAt: 0 };
async function rageEscapeLadder(out, why) {
	const now = Date.now();
	const S = (typeof parent !== 'undefined' && parent.S) || {};
	const targets = [{ x: out.x, y: out.y, name: null }];
	for (const n in BOSS_JOIN_SPOTS) {
		const s = BOSS_JOIN_SPOTS[n];
		if (s && s.map === character.map && typeof s.x === 'number') targets.push({ x: s.x, y: s.y, name: n });
	}
	if (typeof can_move_to === 'function' && typeof move === 'function') {
		for (const p of targets) {
			if (!can_move_to(p.x, p.y)) continue;
			rageLog('pathfinder failed (' + why + ') - straight line to ' + Math.round(p.x) + ',' + Math.round(p.y), '#FFD700');
			try { await move(p.x, p.y); return 'straight'; }
			catch (e) { rageLog('straight move failed: ' + errText(e), 'orange'); }
		}
	}
	if (!rageEscapeEp.joinAt) {
		for (const p of targets) {
			if (!p.name || !bossEntryLive(p.name, S[p.name])) continue;
			rageEscapeEp.joinAt = now;
			rageLog('no straight line out - joining ' + p.name + ' to be moved to its spot', '#FFD700');
			try { parent.socket.emit('join', { name: p.name }); } catch (e) { rageLog('join emit failed: ' + errText(e), 'orange'); }
			return 'join';
		}
	} else if (now - rageEscapeEp.joinAt < RAGE_ESCAPE_JOIN_WAIT_MS) return 'waiting';
	if (now - rageEscapeEp.townAt < RAGE_ESCAPE_TOWN_GAP_MS) return 'waiting';
	rageEscapeEp.townAt = now;
	rageLog('no way out on foot - using town', '#FFD700');
	try { if (typeof use_skill === 'function') await use_skill('use_town'); }
	catch (e) { rageLog('town refused: ' + errText(e), 'orange'); }
	return 'town';
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
		/* A TRIP TO ANOTHER MAP SERVES NO PULL HERE (v150/v83/v106). Falling
		   back to the farm pulled booboo on spookytown while the trip walked
		   to crabxx on main, and Dexon and MageofOz died in the west box at
		   06:30Z 2026-10-25. */
		return { src: 'trip', map: null, x: null, y: null, types: [] };
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

function rageEntrySet(on, why) {
	if (!!rageEntryActive === !!on) return;
	rageEntryActive = !!on;
	rageEntryInSince = on ? Date.now() : 0;
	rageLog((on ? 'ENTERING the rage box - ' : 'leaving the rage box - ') + why,
		on ? '#FFD700' : '#7FD98A');
}

/* THE GATE. Inert unless the operator turns it on; `enabled` is theirs and no
   comment here states which way it is set.

   BIASED TOWARD STAYING OUT, deliberately. Missing a graveyard costs almost
   nothing - another in two hours - while a wipe inside the rectangle with
   containment off costs downtime and leaves three bodies somewhere the party
   cannot easily walk back to. So entry needs the crowd's AVERAGE over
   `holdMs` to clear `minSoaked`, and the average dropping below it brings the
   party out. It was a run of consecutive ticks until 2026-10-24, which a crowd
   count that swings 2-9 every two seconds could never satisfy.

   THE RETREAT IS NOT courage. The file records courage failing as a
   whole-party wipe twice - "firing AT courage pre-empts the ... and all three
   characters died", and attackers going 3 to 9 at the band's own threshold -
   so `retreatAtAttackers` is its own number, meant to sit below courage, and
   escalation is fast enough that it has to. */
/* Why the leader should stay out right now, or null. ENTRY IS FOR THE WAVES -
   operator, 2026-10-24: being inside the box gets more kills of the event's own
   monsters (zombie, ghoul) while the party waits on the Gargoyle, and those are
   achievements that exist only for Halloween. So any live graveyard qualifies
   from wave 1, crowd permitting. Until then entry waited for `gargoyle: true`,
   which put the whole wave phase - where those kills are - out of reach. */
function rageEntryNotWanted() {
	const trip = (typeof bossState !== 'undefined' && bossState && bossState.trip) ? bossState.trip : null;
	if (!trip || trip.name !== 'graveyard') return 'not on a graveyard trip';
	const S = (typeof parent !== 'undefined' && parent.S) || {};
	if (!S.graveyard) return 'the graveyard is not live';
	return null;
}

function rageEntryTick(map) {
	const cfg = (CONFIG.bossEvents && CONFIG.bossEvents.rageEntry) || {};
	if (!cfg.enabled) { rageEntryOkSince = 0; rageEntryWindow = []; rageEntrySet(false, 'entry is off'); return; }

	/* THE RETREAT IS EVERY CHARACTER'S OWN AND IS NEVER DELEGATED. Bodies on
	   ME are a fact only I can see, and waiting for the leader to notice them
	   is how the thing this guards against happens. So it runs before the
	   leader check and applies to all three. */
	if (rageEntryActive && rageAttackersOnMe() >= (cfg.retreatAtAttackers || 3)) {
		rageEntryOkSince = 0; rageEntryWindow = [];
		rageEntryRetreatAt = Date.now();
		rageEntrySet(false, 'too many on me');
		if (bossIsLeader()) rageEntryBroadcast(false);
		else { try { plSend(CONFIG.bossEvents.leaderName, { message: 'rageentry', on: false, retreat: true }); } catch (e) { } }
		return;
	}
	/* ONE RETREAT TAKES THE PARTY OUT, AND KEEPS IT OUT FOR retreatHoldMs -
	   Ranger v151 / Priest v84 / Mage v107. Measured 12:30Z 2026-10-25 on EU
	   II: two of three entries ended within 0-5s on "too many on me", with
	   FatherToken terrified each time, so 3 is not early and is kept. What was
	   wrong is what followed. A follower that retreated obeyed the leader's
	   standing "in" again as soon as the bodies dropped, walking back into what
	   drove it out; and the healer alone outside is the party split this
	   section exists to prevent. So a follower's retreat is sent to the
	   leader, the leader takes everyone out, and nobody goes back in until the
	   hold has run. */
	if (rageEntryRetreatAt && Date.now() - rageEntryRetreatAt < (cfg.retreatHoldMs || 0)) {
		rageEntryOkSince = 0; rageEntryWindow = [];
		rageEntrySet(false, 'holding out after a retreat');
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

	const notNow = rageEntryNotWanted();
	if (notNow) {
		rageEntryOkSince = 0; rageEntryWindow = [];
		rageEntrySet(false, notNow);
		rageEntryBroadcast(rageEntryActive);
		return;
	}

	/* THE CROWD IS AVERAGED OVER `holdMs`, NOT REQUIRED ON EVERY TICK. Measured
	   live 2026-10-24 on a 10:30 EDT graveyard with six other players: `soaked`
	   read 6,5,7,3,5,3,5,8,6,4,8,6,5,6,6,6,2,3,5,9 at 2s intervals, so a run of
	   >= 6 never lasted more than three samples and a "sustained" gate reset on
	   every dip - it could not open for any crowd. That series averages 5.4.
	   The window starts when the leader starts watching and is cleared by
	   anything that puts the box out of bounds; the retreat above still answers
	   to bodies on each character, tick by tick. */
	const soak = rageCrowdSoak(map);
	const now = Date.now(), holdMs = cfg.holdMs || 20000, need = cfg.minSoaked || 5;
	rageEntryWindow.push([now, soak.soaked]);
	while (rageEntryWindow.length && now - rageEntryWindow[0][0] > holdMs) rageEntryWindow.shift();
	if (!rageEntryOkSince) rageEntryOkSince = now;
	let sum = 0;
	for (const x of rageEntryWindow) sum += x[1];
	const mean = sum / rageEntryWindow.length;
	/* TWO THRESHOLDS AND A DWELL, because one threshold flapped. Measured live
	   2026-10-24 12:30 EDT on US II: the 20s average sat right at minSoaked
	   while the raw count swung 0-17 per 2s sample, so the gate crossed both
	   ways again and again - inside for 2s, 16s, 24s, 4s, then 106s, about a
	   quarter of the window, and every crossing a walk in or out during the
	   waves. Once in, the party stays until the average falls below
	   `leaveSoaked`, and not before `minInsideMs`. The retreat on bodies above
	   is not subject to either. */
	const leave = typeof cfg.leaveSoaked === 'number' ? cfg.leaveSoaked : need;
	const dwell = cfg.minInsideMs || 0;
	if (rageEntryActive) {
		if (mean < leave && now - rageEntryInSince >= dwell) {
			rageEntrySet(false, 'crowd averaging ' + mean.toFixed(1) + ', under ' + leave + ' to stay in (' + soak.soaked + ' of ' + soak.boxed + ' now)');
		}
	} else if (mean < need) {
		rageEntrySet(false, 'crowd averaging ' + mean.toFixed(1) + ' of ' + need + ' (' + soak.soaked + ' of ' + soak.boxed + ' now)');
	} else if (now - rageEntryOkSince >= holdMs) {
		rageEntrySet(true, 'crowd averaging ' + mean.toFixed(1) + ' held by others over ' + Math.round(holdMs / 1000) + 's');
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
	/* A member's retreat on bodies, heard by the leader: everyone out. */
	if (data && data.retreat && bossIsLeader()) {
		const members = (CONFIG.party && CONFIG.party.groupMembers) || [];
		if (members.indexOf(from) < 0) return;
		rageEntryRetreatAt = Date.now();
		rageEntryOkSince = 0; rageEntryWindow = [];
		rageEntrySet(false, from + ' retreated - too many on them');
		rageEntryBroadcast(false);
		return;
	}
	if (from !== CONFIG.bossEvents.leaderName) return;
	rageEntryHeard = { on: !!data.on, at: Date.now() };
}

/* ENTRY ENDS WITH THE TRIP, ON EVERY CHARACTER, AND THE LEADER SAYS SO.
   Measured 2026-10-24 16:41 EDT: the graveyard ended and both followers were
   still in entry mode - containment off, parked beside the mummy box - seven
   minutes later. A follower's trip ends through bossOnCall ("the leader moved
   on"), bossPick() is then null, shouldHandleEvents() goes false, and bossTick
   - which held both the reset and the follower's trust timeout - never ran
   again. So bossEnd clears it, the leader sends an explicit "out", and the
   timeout runs from the beat's own timer (rageEntryExpire) rather than from a
   loop that stops being reached exactly when it is needed. */
function rageEntryEnd(why) {
	rageEntryOkSince = 0; rageEntryWindow = []; rageEntryHeard = null;
	rageEntrySet(false, why);
	if (bossIsLeader()) { try { rageEntryBroadcast(false); } catch (e) { } }
}

/* A follower's "in" lasts only as long as the leader keeps saying it. */
function rageEntryExpire() {
	if (!rageEntryActive || bossIsLeader()) return;
	const cfg = (CONFIG.bossEvents && CONFIG.bossEvents.rageEntry) || {};
	const fresh = rageEntryHeard && (Date.now() - rageEntryHeard.at) < (cfg.trustMs || 15000);
	if (!fresh) rageEntrySet(false, 'no recent word from the leader');
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
	/* Dead, nothing can be pulled: measured 2026-10-25 06:30Z, both followers
	   logged "pull tick threw: unable" several times a second while rip. */
	if (character.rip) return false;
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
	/* A REFUSED DESTINATION IS REMEMBERED FOR retryMs, so a caller asking every
	   tick does not re-plan and re-log every tick - 26% of the 2026-10-24 game
	   log was this refusal and its echo. */
	const key = rageBlockKey(map, dest), blk = rageBlocked[key];
	if (blk && Date.now() - blk.at < RAGE_BLOCK.retryMs) throw new Error('rage_route_blocked');
	let ok = await rageWalk(map, { x: dest.x, y: dest.y }, cfg.margin);
	if (!ok) ok = await rageViaStaging(map, dest, cfg.margin);
	if (ok) { delete rageBlocked[key]; return true; }
	const b = rageBlocked[key] = { at: Date.now(), n: (blk ? blk.n : 0) + 1, logged: blk ? blk.logged : 0 };
	if (!b.logged || Date.now() - b.logged >= RAGE_BLOCK.logMs) {
		b.logged = Date.now();
		rageLog('no safe route to ' + Math.round(dest.x) + ',' + Math.round(dest.y) + ' on ' + map
			+ ' - refusing to let the pathfinder cut through a rage box' + (b.n > 1 ? ' (x' + b.n + ')' : ''), 'red');
	}
	if (b.n >= RAGE_BLOCK.townAfter) await rageStuckTown(map);
	throw new Error('rage_route_blocked');
}

/* THE REFUSAL MEMO AND ITS THRESHOLDS - Ranger v140 / Priest v75 / Mage v98.
   townAfter is the operator's ruling of 2026-10-24: two refusals of the same
   destination in a row means stuck, and stuck means town. */
const RAGE_BLOCK = { retryMs: 20000, logMs: 60000, townAfter: 2, townGapMs: 120000 };
const rageBlocked = {};
function rageBlockKey(map, d) { return map + ':' + Math.round(d.x / 10) * 10 + ',' + Math.round(d.y / 10) * 10; }

/* TWO LEGS VIA THE MAP'S SPAWN WHEN ONE LEG HAS NO ROUTE. rageRoute's grid spans
   from, to, every rectangle and a pad, and doubles its step past maxCells - so a
   long trip loses the 14-18 unit pinch beside the spookytown farm spot that
   only step 5 resolves. Measured 2026-10-24 on Dexon, planning only: park
   (290,-990) to mrgreen (568,920) NULL, park to the spawn (0,0) OK, spawn to
   mrgreen OK. Each leg's grid is small enough to stay at step 5. */
async function rageViaStaging(map, dest, margin) {
	const s = rageStaging(map);
	if (!s) return false;
	if (Math.hypot(s.x - character.x, s.y - character.y) < 30 || Math.hypot(s.x - dest.x, s.y - dest.y) < 30) return false;
	const leg = async (p) => {
		if (rageClips(map, character.x, character.y, p.x, p.y, margin)) return rageWalk(map, { x: p.x, y: p.y }, margin);
		try { await smart_move({ map: map, x: p.x, y: p.y }); return true; } catch (e) { return false; }
	};
	if (!(await leg(s))) return false;
	return leg(dest);
}

/* STUCK - USE TOWN, the operator's ruling of 2026-10-24. Not while anything is
   on us, and not more than once per townGapMs. The leader also tells the other
   two, who town with it if they are on the same map and free. */
let rageTownAt = 0;
async function rageStuckTown(map, heard) {
	if (Date.now() - rageTownAt < RAGE_BLOCK.townGapMs) return false;
	if (character.map !== map) return false;
	if (rageAttackersOnMe() > 0) { rageLog('stuck, but something is on me - not using town', 'orange'); return false; }
	rageTownAt = Date.now();
	rageLog('stuck - using town' + (heard ? ' with the leader' : ''), '#FFD700');
	if (!heard && bossIsLeader()) {
		const members = (CONFIG.party && CONFIG.party.groupMembers) || [];
		for (const m of members) {
			if (m === character.name || m === 'Meltymerch') continue;
			try { plSend(m, { message: 'ragetown', map: map }); } catch (e) { }
		}
	}
	try { if (typeof use_skill === 'function') await use_skill('use_town'); }
	catch (e) { rageLog('town refused: ' + ((e && (e.reason || e.message)) || e), 'orange'); return false; }
	return true;
}
function rageTownOnCall(from, data) {
	if (from !== CONFIG.bossEvents.leaderName || !data || !data.map) return;
	rageStuckTown(data.map, true).catch(() => { });
}

/* SCOPED BY CHARACTER, BECAUSE `set`/`get` ARE NOT. Read from the client at
   upstream 16881a27: `set(name, value)` is
   `window.localStorage.setItem("cstore_" + name, ...)`. The key carries no
   character anywhere and every character tab is the same `adventure.land`
   origin, so a bare 'boss_trip' was ONE SLOT shared by Dexon, FatherToken and
   MageofOz - each bossSave() clobbering the other two, each load reading
   whichever had written last. The trip, the shard-keyed cooldowns and the
   give-up counts all ride in that one blob.
   That the CODE contexts really do share a localStorage is not an inference
   from the source: `local_cm_logic` picks up `cm_<my name>_*` keys that ANOTHER
   character's `send_local_cm` wrote, which is how send_cm's local copy reaches
   us at all.
   MEASURED 2026-10-22: Dexon's mrgreen trip read src='own' at 22:58:18 and
   src='leader' at 23:01:20 across a redeploy, same startedAt. `src: 'leader'`
   is reachable only under `!bossIsLeader()`, so the leader cannot produce one -
   he loaded a FOLLOWER's saved trip.
   DELIBERATELY NOT MIGRATED from the legacy key: reading it once is exactly the
   foreign-trip import this removes. The cost is one trip clock restarting at
   the deploy.
   The other shared keys are left alone and the reasons differ - 'pl_cursor'
   converges to the bridge's global head on every poll so sharing it is a no-op,
   'loot_chest_ids' is harmless to share, and the Ranger-only keys are unshared
   only because no other script happens to use the name. */
const BOSS_KEY = 'boss_trip';
/* How many SHARD-level give-ups on one boss type before the type itself is
   cooled down. Without it, shard-keyed cooldowns let the party walk a boss it
   cannot kill across five shards in turn. 2 is a starting value and wants
   measuring rather than asserting. */
const BOSS_TYPE_GIVEUP_MAX = 2;
const bossState = {
	trip: null,         // { name, shard, startedAt, deaths, wasRip, src }
	/* KEYED BY '<name>|<shard>' FOR A GIVE-UP, and by the bare '<name>' for
	   the type-level backstop below. Both are consulted, so a bare key still
	   forbids the type everywhere - which is also what makes the persisted
	   pre-v103 map safe to load: its bare keys read as type backstops, which
	   is over-restrictive for at most one cooldown and never permissive. */
	cooldown: {},       // key -> ms until we will consider it again
	giveUps: {},        // name -> [ms] shard-level give-ups, pruned to the window
	lastGiveUp: null,   // { name, shard, why, at, startedAt, deaths } - WHY, for the next window; PERSISTED
	fromLeader: null,   // { name, at } - the leader's current call
	forced: null,       // { name, at } - bossJoin() from the console
	lastNote: null,
};
/* The trip survives a reload, which matters because a redeploy mid-event would
   otherwise restart the clock and hand the party another full 20 minutes at a
   boss it had already given up on. */
try {
	const bossSaved = scopedGet(BOSS_KEY);
	if (bossSaved && typeof bossSaved === 'object') {
		bossState.trip = bossSaved.trip || null;
		bossState.cooldown = bossSaved.cooldown || {};
		bossState.giveUps = bossSaved.giveUps || {};
		/* A hop trip ALWAYS ends in a reload - the hop home - so a reason held in
		   memory alone was destroyed before anyone could read it. Measured
		   2026-10-23: twenty minutes on ASIA II, give-up, franky untouched, and
		   the only record on disk was a cooldown timestamp. */
		bossState.lastGiveUp = bossSaved.lastGiveUp || null;
	}
} catch (e) { }
function bossSave() {
	try { scopedSet(BOSS_KEY, { trip: bossState.trip, cooldown: bossState.cooldown,
		giveUps: bossState.giveUps, lastGiveUp: bossState.lastGiveUp }); }
	catch (e) { bossLog('could not persist the trip - a reload will restart its clock', 'orange'); }
}
function bossLog(m, c) { try { game_log('[boss] ' + m, c || '#FFD700'); } catch (e) { } console.log('[boss] ' + m); }
/* Said once per distinct message: approach runs every tick and would otherwise
   be the loudest thing in the log. */
/* ONCE PER MESSAGE PER TRIP, NOT "UNTIL A DIFFERENT ONE" - Ranger v140 / Priest
   v75 / Mage v98. Two notes alternating every tick defeat a last-message test:
   on a graveyard trip "publishes a position inside a rage box" and "joining
   graveyard" took turns and wrote ~49,000 lines into the 2026-10-24 game log,
   42% of its bytes. Keyed by the trip's start, so a new trip says it again, and
   repeated after BOSS_NOTE_MS so a long trip still shows it is alive. */
const BOSS_NOTE_MS = 120000;
const bossNoteSeen = new Map();
function bossNote(m) {
	const now = Date.now();
	const key = ((bossState.trip && bossState.trip.startedAt) || 0) + '|' + m;
	const last = bossNoteSeen.get(key);
	if (last && now - last < BOSS_NOTE_MS) return;
	if (bossNoteSeen.size > 200) bossNoteSeen.clear();
	bossNoteSeen.set(key, now);
	bossState.lastNote = m;
	bossLog(m, '#8b98ab');
}
/* A rejection is usually an object with `reason`, which "tick threw: [object
   Object]" hid 548 times on 2026-10-24 - each one a smart_move "Path not
   found". Said once a minute per reason. */
const bossThrewSeen = new Map();
function bossThrew(e) {
	const text = errText(e);
	const why = (e && (e.message || e.reason)) || text;
	const now = Date.now(), last = bossThrewSeen.get(why);
	if (last && now - last < 60000) return;
	if (bossThrewSeen.size > 50) bossThrewSeen.clear();
	bossThrewSeen.set(why, now);
	bossLog('tick threw: ' + text, 'red');
}

/* A rejection the game hands back is an OBJECT - {reason: "failed", place:
   "smart_move", ...} - so its message alone said "failed" and a template
   string said "[object Object]", both measured in the 2026-10-24 log. This
   keeps the reason and adds every scalar field beside it. */
function errText(e) {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object') {
		let s = String(e.message || e.reason || '');
		const extra = {};
		for (const k of Object.keys(e)) {
			if (k === 'message' || k === 'reason' || k === 'success') continue;
			const v = e[k];
			if (v === null || typeof v !== 'object') extra[k] = v;
		}
		const tail = JSON.stringify(extra);
		if (tail !== '{}') s += (s ? ' ' : '') + tail;
		if (s) return s.slice(0, 240);
		try { return JSON.stringify(e).slice(0, 240); } catch (x) { }
	}
	return String(e);
}
function bossIsLeader() { return character.name === CONFIG.bossEvents.leaderName; }
/* THE TRUST WINDOW NEEDS A HEARTBEAT, OR IT IS A TIMER THAT ALWAYS EXPIRES.
   `bossBroadcast(pick.name)` fires only where the trip STARTS or CHANGES, and
   a follower trusts `fromLeader` for `leaderTrustMs` (20s). A graveyard window
   is 600s and a horseman window 2400s, so for all but the first twenty seconds
   of every trip the followers were falling through to their OWN pick - and
   that path is NOT the leader's: the ranger ranks first and the followers
   order by lowest hp ratio alone, `bossRank` being declared in Ranger.js and
   nowhere else. Same `S`, two rules, so the three characters can pick three
   different bosses and walk to three different maps, which is what was
   observed on 2026-10-22 during a graveyard trip - Dexon on spookytown,
   FatherToken on main, MageofOz on halloween.
   `rageEntryBroadcast` already had this right and is the model: it re-sends
   every tick, so its own `trustMs` expires only when the leader really has
   stopped. The expiry is CORRECT and stays - a leader that stops ticking must
   release the followers. What was missing is the leader saying anything while
   it is still deciding.
   Throttled well inside the window so two lost messages do not drop a
   follower, and no-op on a follower, which is what keeps this byte-identical
   in all three files. */
const BOSS_RECAST_MS = 8000;
function bossRecast() {
	if (!bossIsLeader()) return;
	const t = bossState.trip;
	const now = Date.now();
	if (now - (bossState.lastCast || 0) < BOSS_RECAST_MS) return;
	bossState.lastCast = now;
	/* AN IDLE LEADER SAYS SO TOO, so the followers hold back rather than pick
	   for themselves - see bossPick. A forced pick still outranks it. */
	bossBroadcast(t && t.name ? t.name : null);
}

/* THE BEAT RUNS ON ITS OWN TIMER - Ranger v140, kept byte-identical in all
   three and a no-op on a follower. bossRecast() used to be called only from
   bossTick(), which runs only when mainLoop reaches handleEvents() - and
   mainLoop returns early while the rage pull is busy, which at a graveyard is
   most of the time. Measured 2026-10-24 12:30 EDT: the leader's first word
   reached both followers in 0.1s, nothing followed for 63-86s, and both
   dropped the trust at exactly leaderTrustMs and went to mrpumpkin. The rage
   entry decision rides the same beat, because rageEntryTick sat behind the
   same gate and the followers fall out on its silence too. */
/* A FARM VERDICT IS ABOUT THE FARM, AND A BOSS TRIP IS NOT FARMING. Measured
   2026-10-24: 46 follower requests to blacklist the farm spot in one day, one
   every ~3 min during mrgreen trips and just after, "0.00 xp/s over 3 min".
   The earlier guard re-baselined only OFF the farm map, and booboo and mrgreen
   are both on spookytown - so a follower standing at the boss, earning nothing
   until it died, counted every minute against the spot. Dexon turned them all
   down only because that spot happens to be whitelisted. Held during any trip
   and for FARM_VERDICT_GRACE_MS after, which covers the walk back; the beat
   calls this every 2s so the trip's end is seen even when nothing else asks. */
const FARM_VERDICT_GRACE_MS = 180000;
let farmVerdictBusyAt = 0;
function farmVerdictHeld() {
	const now = Date.now();
	const onTrip = !!(bossState && bossState.trip)
		|| (typeof bossHop !== 'undefined' && !!bossHop && !!bossHop.state && bossHop.state !== 'IDLE');
	if (onTrip) farmVerdictBusyAt = now;
	return onTrip || (farmVerdictBusyAt > 0 && now - farmVerdictBusyAt < FARM_VERDICT_GRACE_MS);
}

const BOSS_BEAT_MS = 2000;
function bossBeat() {
	try { rageEntryExpire(); } catch (e) { }
	try { farmVerdictHeld(); } catch (e) { }
	if (!bossIsLeader() || !bossState.trip) return;
	try { bossRecast(); } catch (e) { }
	try { rageEntryBroadcast(rageEntryActive); } catch (e) { }
}
setInterval(bossBeat, BOSS_BEAT_MS);

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
   WHY A NAMED SET AND NOT A RULE: this function iterates EVERY key of S, and S
   is the whole server_info payload rather than a boss table. MEASURED on US II
   2026-10-22, ten keys: schedule, event_flags, event_ends, blessed_minutes,
   blessed_by, halloween, witchcipher, slenderman, mrgreen, mrpumpkin. A general
   "key present means live" reads event_flags, blessed_by and halloween as live
   bosses. Presence is sound for the names below and for nothing else, so the
   set is declared rather than derived - there is nothing client-side to derive
   it from.
   THIS COMMENT FIRST NAMED time_offset, night, dailies and nightlies as the
   non-boss keys, and all four are FIELDS INSIDE schedule rather than keys of S.
   The browser session caught it against a live read hours after it was written -
   the conclusion was unaffected and the evidence cited for it did not exist,
   which is this file's own "a comment is a claim" on a comment written to
   explain a fix for a claim that rotted.
   slenderman is the one key carrying the full boss shape (live, map, hp,
   max_hp) and it is NOT here: it is refused by CONFIG.bossEvents.exclude, for
   the reason recorded there - he cannot be walked to or chased. So a reader who
   finds him live and unranked should look at the exclude set, not at this one. */
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
/* ONE EXPRESSION FOR THE GIVE-UP COOLDOWN, read by bossEligible AND by
   bossHop.localTarget(). It was read in exactly one place until 2026-10-20, and
   that place was on the LOCAL-pick path only, which is how the hop path came to
   ignore a give-up entirely - see localTarget for what that cost. */
/* Our own shard, by the same expression bossHop.currentShard() uses. Declared
   here rather than calling that method because this runs from bossEligible,
   which is above bossHop in the file. */
function bossShard() {
	try { return (parent.server_region || '') + (parent.server_identifier || ''); }
	catch (e) { return ''; }
}
function bossCooldownKey(name, shard) { return name + '|' + shard; }

/* SHARD-KEYED AS OF v103, AND THAT IS WHAT MAKES THE v99 FIX ACTUALLY PAY.
   v99 stopped a given-up boss pinning the party to its shard, and the party
   then hopped correctly - but could not FIGHT when it arrived. The reason is
   two state machines again: bossHop commits FIGHTING on arrival from
   localBossLive() alone, while what MOVES the party to the boss and attacks it
   is handleEvents(), gated by shouldHandleEvents() = holidaySpirit ||
   !!bossPick() || !!bossState.trip. A type-keyed give-up made bossEligible()
   refuse that name on EVERY shard for 30 minutes, so bossPick() returned null
   at the destination, no trip was opened, and the party stood on the right
   shard farming ordinary mobs beside a live franky until maxFightMs aborted.
   The 2026-10-19 loss therefore needed BOTH halves; v99 was half of it.
   -> RangerComments.md#shardKeyedCooldown

   `shard` defaults to ours, which is the right default for every HERE-style
   caller (bossEligible, localTarget); the hop path passes the CANDIDATE's
   shard. The bare type key is still honoured so the backstop can forbid a
   type outright. */
function bossCooledDown(name, shard) {
	const now = Date.now();
	if ((bossState.cooldown[name] || 0) > now) return true;
	const sh = (shard === undefined || shard === null) ? bossShard() : shard;
	return (bossState.cooldown[bossCooldownKey(name, sh)] || 0) > now;
}

/* Clearing is BY TYPE, so it has to take the shard keys with it - an operator
   calling the party to a boss must not be silently refused by a shard entry
   they cannot see. */
function bossClearCooldown(name) {
	bossState.cooldown[name] = 0;
	const pre = name + '|';
	for (const k in bossState.cooldown) {
		if (k.indexOf(pre) === 0) bossState.cooldown[k] = 0;
	}
	if (bossState.giveUps) bossState.giveUps[name] = [];
}

function bossEligible(name, shard) {
	const cfg = CONFIG.bossEvents;
	if (!cfg.enabled) return { ok: false, why: 'bossEvents.enabled is false' };
	if (cfg.exclude.has(name)) return { ok: false, why: 'excluded' };
	const byHand = cfg.include.indexOf(name) >= 0;
	if (cfg.cooperativeOnly && !byHand && !bossCooperative(name)) return { ok: false, why: 'not cooperative' };
	if (bossCooledDown(name, shard)) {
		/* Which of the two keys bit is the useful half of the message: "this
		   shard" means another shard is still worth hopping to, "everywhere"
		   means the backstop fired and it is not. */
		const sh = (shard === undefined || shard === null) ? bossShard() : shard;
		const typeUntil = bossState.cooldown[name] || 0;
		const wide = typeUntil > Date.now();
		const until = wide ? typeUntil : (bossState.cooldown[bossCooldownKey(name, sh)] || 0);
		return { ok: false, why: 'gave up on it ' + Math.round((until - Date.now()) / 60000)
			+ ' min from now' + (wide ? ' EVERYWHERE (' + BOSS_TYPE_GIVEUP_MAX + ' shards failed)' : ' on ' + sh) };
	}
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
	if (!bossIsLeader() && bossState.fromLeader
		&& (Date.now() - bossState.fromLeader.at) < cfg.leaderTrustMs) {
		const n = bossState.fromLeader.name;
		/* A FRESH "NO BOSS" FROM THE LEADER IS AN ANSWER, NOT SILENCE. Until
		   v144 a follower read it as nothing heard and fell to its own pick -
		   2026-10-24 on EU III, MageofOz went to franky twice, alone, on his
		   own type-wide reading, while Dexon had given up on it there and was
		   idle, and died both times. bossRecast() now repeats the null. */
		if (!n) return null;
		const d = (parent.S || {})[n];
		if (bossEntryLive(n, d)) return { name: n, src: 'leader' };
	}
	/* RANK FIRST, then the hp ratio this used to lead on. Lowest remaining hp
	   is a sensible way to choose between two bosses of EQUAL worth - finish
	   the one nearest dead - and a poor way to choose between unequal ones,
	   which is what it was doing: a half-dead greenjr beat a fresh mrgreen
	   every time.

	   THE INCUMBENT WINS A TIE, and that is a behaviour change worth naming.
	   The caller switches trips whenever this returns a different name, so
	   with a continuously-moving key like hp ratio two equally-ranked bosses
	   could trade the trip back and forth as their ratios crossed. Rank is
	   static, so rank-first already makes switching rarer; holding the
	   current trip on an exact tie closes the rest. A higher-ranked boss
	   going live still takes the trip, which is the point of a priority. */
	const held = bossState.trip && bossState.trip.name;
	let best = null;
	for (const n of bossLiveNames()) {
		if (!bossEligible(n).ok) continue;
		const d = parent.S[n];
		const ratio = (d && d.max_hp) ? (d.hp / d.max_hp) : 1;
		const cand = { name: n, ratio: ratio, rank: bossRank(n) };
		if (!best) { best = cand; continue; }
		if (cand.rank !== best.rank) { if (cand.rank < best.rank) best = cand; continue; }
		if (cand.name === held) { best = cand; continue; }
		if (best.name === held) continue;
		if (ratio < best.ratio - 1e-9) { best = cand; continue; }
		if (Math.abs(ratio - best.ratio) < 1e-9 && n < best.name) best = cand;
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

/* Where to stand, best first. The point on our bearing at `hold` was the only
   answer until Ranger v153 / Priest v86 / Mage v109, and from the farm side of
   mrgreen's arena it is often ground nobody can stand on: "cannot hold off
   mrgreen: failed" 24 times in 19 minutes on 2026-10-25, every one a
   smart_move "Path not found". So the ring at `hold` is tried every 30 degrees
   from our bearing outward. A point the BOSS can walk to in a straight line is
   on its side of every wall; one we can also reach in a straight line is
   better. A point inside a rage box is dropped. With no can_move, or nothing
   passing, the bearing point alone - the old behaviour. */
function bossHoldSpots(mon, hold) {
	const map = character.map, base = character.base;
	const a0 = Math.atan2(character.y - mon.y, character.x - mon.x);
	const line = (a, p) => {
		if (typeof can_move !== 'function') return null;
		try { return !!can_move({ map: map, x: a.x, y: a.y, going_x: p.x, going_y: p.y, base: base }); }
		catch (e) { return false; }
	};
	const near = [], far = [];
	for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]) {
		const a = a0 + k * Math.PI / 6;
		const p = { x: mon.x + Math.cos(a) * hold, y: mon.y + Math.sin(a) * hold };
		if (k && rageHit(map, p.x, p.y, 0)) continue;
		const theirs = line(mon, p);
		if (theirs === null) return [p];
		if (!theirs) continue;
		(line(character, p) ? near : far).push(p);
	}
	const out = near.concat(far);
	return out.length ? out : [{ x: mon.x + Math.cos(a0) * hold, y: mon.y + Math.sin(a0) * hold }];
}

/* Refusals in a row against one boss; each one moves the next try along the
   list, so a spot the pathfinder refuses is not asked for again every tick. */
let bossPostureMiss = { id: null, n: 0 };

/* Stand at that distance, whether we are currently too close or too far. */
async function bossPosture(mon) {
	const hold = bossHoldDistance(mon);
	const dx = mon.x - character.x, dy = mon.y - character.y;
	const dist = Math.hypot(dx, dy) || 1;
	if (Math.abs(dist - hold) <= CONFIG.bossEvents.holdTolerance) { bossPostureMiss.n = 0; return; }
	if (smart.moving) return;
	const id = mon.id || mon.mtype;
	if (bossPostureMiss.id !== id) bossPostureMiss = { id: id, n: 0 };
	const spots = bossHoldSpots(mon, hold);
	const p = spots[bossPostureMiss.n % spots.length];
	/* A REFUSED MOVE IS NOTED, NOT THROWN: "Path not found!" rejected out of
	   bossTick 275 times on 2026-10-25, skipping the rest of the tick. */
	try { await safeMove(p.x, p.y); }
	catch (e) {
		bossPostureMiss.n++;
		bossNote('cannot hold off ' + mon.mtype + ': ' + ((e && (e.reason || e.message)) || e));
	}
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

/* Closes the open row for `name` on THIS shard, if a walk-in-sick opened
   one. Records what the episode is actually evidence for: that we were still
   present when it died, how long we had been there, and whether we were
   still sick at the end. Credit itself is awarded server-side and is not
   visible from here - compare the row against the tracker's kill count for
   that monster if you want the final confirmation. */
function taxiProbeClose(name, dwellMs) {
	const shard = (typeof parent !== 'undefined')
		? (parent.server_region + parent.server_identifier) : '?';
	const list = taxiProbeRead();
	for (let i = list.length - 1; i >= 0; i--) {
		const r = list[i];
		if (r.name === name && r.shard === shard && !r.closed && r.walkedAt) {
			r.closed = true;
			r.diedAt = Date.now();
			r.presentAtDeath = true;
			r.dwellSec = Math.round((dwellMs || 0) / 1000);
			r.sickMsAtDeath = bossHop.hopsickRemainingMs();
			r.sickThroughout = r.sickMsAtDeath > 0;
			taxiProbeWrite(list);
			bossLog('taxi probe: present at ' + name + ' death after ' + r.dwellSec
				+ 's, ' + (r.sickThroughout ? 'still hop-sick' : 'sickness had cleared'), '#7FD98A');
			return;
		}
	}
}

/* THE PUBLISHED POINT IS THE MONSTER'S POSITION, AND FOR ONE EVENT THAT IS
   SOMEWHERE NOTHING CAN STAND. `parent.S.graveyard` carries x/y 255,-1545 from
   the FIRST WAVE - they are `rules.gargoyle`, the Gargoyle's fixed spawn - and
   that point is inside spookytown's mummy rage rectangle. safeSmartMove
   refuses it, so taking it would make the whole approach INERT rather than
   wrong: the party never arrives, "boss approach blocked" logs once in orange,
   and nothing says why. That is the failure mode this repo keeps paying for,
   caught here before it shipped rather than after.
   DERIVED, NOT A GRAVEYARD SPECIAL CASE: any event whose published coordinates
   land in a rage rectangle gets the join spot instead, and rageHit is the same
   predicate safeMove itself consults, so the two cannot disagree.
   GATED ON CONTAINMENT BEING ON, which is what makes this one guard serve both
   cases. With `CONFIG.achievements.pull.enabled` off, safeMove falls through to
   xmove and the rectangle stops being a wall - so the walk should go to the
   real Gargoyle position, which is exactly what entering the box means. Turn
   containment off and this guard turns itself off with it. */
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

/* THE JOIN IS A TAXI TO THE EVENT, NOT A WAY TO STAY AT IT. The server moves
   anyone more than 200 from the join spot back onto it (100 for icegolem), so
   a join sent from INSIDE the fight is a teleport out of it - measured
   2026-10-24 at the graveyard, where rage entry walked the party toward the
   Gargoyle at 515 from the spot and the next tick with nothing in view joined
   them straight back. So: join from another map, or from far across this one;
   never while rage entry has taken the party into the box; and on goobrawl's
   own map never at all, where the server does nothing with it anyway. */
const BOSS_JOIN_NEAR = 1000;
function bossJoinWanted(name) {
	const spot = BOSS_JOIN_SPOTS[name];
	if (!spot) return false;
	if (rageEntryActive) return false;
	if (character.map !== spot.map) return true;
	if (spot.x == null) return false;
	return Math.hypot(character.x - spot.x, character.y - spot.y) > BOSS_JOIN_NEAR;
}

async function bossApproach(name) {
	/* THE TRIP OWNS MOVEMENT, SO A FARM WALK STILL UNDER WAY IS STOPPED HERE.
	   12:00Z 2026-10-25, EU I: a travelTo for the farm spot outlived the
	   goobrawl join and walked Dexon out of the event four times. */
	if (travelCancel()) bossNote('stopped a farm walk - the ' + name + ' trip owns movement');
	/* INSIDE THE BOX, HOLD THE FIELD SPOT AND LET THE ATTACK LOOP SHOOT FROM
	   IT, rather than posturing off whichever monster is nearest - which on the
	   graveyard walks the party onto the Gargoyle spawn. */
	const field = rageEntryActive ? BOSS_FIELD_SPOTS[name] : null;
	if (field && character.map === field.map) {
		if (smart.moving) return;
		if (Math.hypot(character.x - field.x, character.y - field.y) <= BOSS_FIELD_HOLD) return;
		bossNote('holding the middle of ' + name);
		try { await safeMove(field.x, field.y); }
		catch (e) { bossNote('cannot reach the middle of ' + name + ': ' + ((e && (e.reason || e.message)) || e)); }
		return;
	}
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
		const sick = !!(character.s && character.s.hopsickness);
		if (!sick && bossJoinWanted(name)) {
			bossNote('joining ' + name);
			try { parent.socket.emit('join', { name: name }); } catch (e) { bossLog('join emit failed: ' + e, 'red'); }
			return;
		}
		if (!sick && BOSS_JOIN_SPOTS[name].x == null) { bossNote('on ' + name + ' - nothing in view yet'); return; }
		if (sick && !bossTaxiWalkable(name)) { bossNote('hopsick - ' + name + ' has no walkable entrance, waiting it out'); return; }
		if (sick) bossNote('hopsick - walking to ' + name + ' instead of joining');
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
		.catch(e => { const why = (e && (e.message || e.reason)) || e; if (why !== 'rage_route_blocked') bossNote('boss approach blocked: ' + why); });
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
			bossClearCooldown(data.name);
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

/* WHEN THIS BOSS'S CURRENT GENERATION ENDS, and whether that end is TYPE-WIDE.
   The give-up cooldown is approximating "stop considering this until the thing
   we judged too strong is gone", which is not a duration at all - and no
   constant can be right, because a 30-minute cooldown against a 2400s window
   expires INSIDE the window for a give-up in the first ten minutes and runs
   PAST the next window's open for one in the last ten. Measured by the browser
   session across the 60-minute inter-window gap.

   THE TWO CLASSES NEED DIFFERENT FIELDS, and only one of them is type-wide:
   - An EVENT boss (the EVENT_WINDOW_SEC five) has every shard's instance
     spawning on the same scheduled hour and dying at the same window close, so
     `window_ends_at` is the end AND it is type-wide.
   - A RESPAWN boss has no window and no synchronised generation at all: each
     shard's timer runs independently. `estimated_respawn` is exactly right for
     THIS shard's instance and says nothing whatever about the others - so it
     serves the shard key and the TYPE-level backstop has nothing to align to
     and keeps the constant. The other session recommended estimated_respawn for
     both; it is wrong for the type key for that reason.
   Unknown answers fall back to cooldownMs rather than inventing a deadline.
   -> RangerComments.md#shardKeyedCooldown */
function bossGenerationEnd(name, shard) {
	let row = null;
	try { row = bossHop.bridgeRow(shard, name); } catch (e) { }
	if (!row) return { at: null, typeWide: false };
	if (row.hasWindow) return { at: row.windowEndsAt || null, typeWide: true };
	return { at: row.estimatedRespawn || null, typeWide: false };
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
	let wide = false;
	if (gaveUp) {
		const sh = t.shard || bossShard();
		const now = Date.now();
		const gen = bossGenerationEnd(t.name, sh);
		const genLeft = (gen.at && gen.at > now) ? (gen.at - now) : null;
		bossState.cooldown[bossCooldownKey(t.name, sh)] = now + (genLeft || CONFIG.bossEvents.cooldownMs);
		/* WHY, kept because "we could not kill it" and "we arrived too late"
		   want different answers next window, and the reason string is the only
		   place that distinction exists. */
		bossState.lastGiveUp = { name: t.name, shard: sh, why: why, at: now,
			startedAt: t.startedAt || null, deaths: t.deaths || 0 };
		/* THE TYPE-LEVEL BACKSTOP. Pruned to one event window so give-ups from
		   a previous window never add up. Its duration runs to the generation
		   end only where that end is TYPE-WIDE, which is event bosses alone -
		   see bossGenerationEnd above for why a respawn boss has no such end
		   and keeps the constant. */
		const win = (typeof bossHop !== 'undefined' && bossHop.eventWindowMs)
			? (bossHop.eventWindowMs(t.name) || CONFIG.bossEvents.cooldownMs)
			: CONFIG.bossEvents.cooldownMs;
		if (!bossState.giveUps) bossState.giveUps = {};
		const hist = (bossState.giveUps[t.name] || []).filter(x => now - x < win);
		hist.push(now);
		bossState.giveUps[t.name] = hist;
		/* Distinct SHARDS, not attempts: two give-ups on the same shard say
		   nothing new about the other four. */
		const shards = {};
		shards[sh] = 1;
		for (const k in bossState.cooldown) {
			if (k.indexOf(t.name + '|') === 0 && bossState.cooldown[k] > now) {
				shards[k.slice(t.name.length + 1)] = 1;
			}
		}
		if (Object.keys(shards).length >= BOSS_TYPE_GIVEUP_MAX) {
			bossState.cooldown[t.name] = now
				+ ((gen.typeWide && genLeft) ? genLeft : CONFIG.bossEvents.cooldownMs);
			wide = true;
		}
	}
	bossState.trip = null;
	bossState.forced = null;
	bossState.lastNote = null;
	rageEntryEnd('the trip ended');
	bossSave();
	bossLog('leaving ' + t.name + ' after ' + mins + ' min (' + why + ') - back to farming'
		+ (gaveUp ? ', and leaving it alone for ' + Math.round(CONFIG.bossEvents.cooldownMs / 60000)
			+ ' min' + (wide ? ' EVERYWHERE - ' + BOSS_TYPE_GIVEUP_MAX + ' shards failed this window'
				: ' on ' + (t.shard || bossShard()) + ' only') : ''), 'orange');
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
	const pick = bossPickRanked();
	if (!pick) {
		rageEntrySet(false, 'no boss trip');
		if (bossState.trip) bossEnd(cipherOutranks(bossState.trip.name)
			? 'the cipher gathering outranks it' : 'nothing eligible is live');
		return false;
	}
	if (!bossState.trip || bossState.trip.name !== pick.name) {
		if (bossState.trip) bossEnd('switching to ' + pick.name);
		/* The shard is recorded at trip START so a give-up is attributed to where
		   the fight actually was, not to wherever we happen to stand when the
		   budget runs out. */
		bossState.trip = { name: pick.name, shard: bossShard(), startedAt: Date.now(), deaths: 0, wasRip: !!character.rip, src: pick.src };
		bossSave();
		bossLog('going to ' + pick.name + ' (' + pick.src + ', '
			+ (BOSS_JOIN_SPOTS[pick.name] ? 'joinable' : 'on foot') + ')');
		if (bossIsLeader()) bossBroadcast(pick.name);
		bossState.lastCast = Date.now();
	}
	bossRecast();
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
	bossClearCooldown(name);
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
		/* A key with no '|' is the type-level backstop, which is the one worth
		   calling out - it is the difference between "try another shard" and
		   "this boss is out of reach tonight". */
		if (left > 0) bossLog('  cooling: ' + n + (n.indexOf('|') < 0 ? ' (ALL shards)' : '')
			+ ' for ' + Math.round(left / 60000) + ' min', '#8b98ab');
	}
	const lg = bossState.lastGiveUp;
	if (lg) bossLog('  last give-up: ' + lg.name + ' on ' + lg.shard + ' (' + lg.why + ') '
		+ Math.round((Date.now() - lg.at) / 60000) + ' min ago', '#8b98ab');
}


function shouldHandleEvents() {
	const holidaySpirit = parent?.S?.holidayseason && !character?.s?.holidayspirit;
	/* The gate is the boss policy now, not "is anything live". The old test
	   went through getDynamicEvents(), whose EVENT_LOCATIONS lists dragold,
	   mrgreen and mrpumpkin UNCONDITIONALLY - so the farm was dropped for any
	   of the three the moment it spawned, with no question of whether the party
	   could contribute, and nothing to bring it home. */
	return holidaySpirit || !!bossPickRanked() || !!bossState.trip;
}

/* bossPick() AS THE LEADER ACTS ON IT: an own pick the cipher gathering
   outranks is no pick - v155, operator's ruling 2026-10-25 20:00 EDT, cipher
   above mrgreen. bossPick() itself is byte-identical in all three files and
   knows nothing of the cipher, so the rule lives here, on the leader, and the
   followers hear it as the leader's "no boss" (cipherBeat). A forced pick and
   a follower's leader-word pick are never overruled. */
function bossPickRanked() {
	const p = bossPick();
	if (p && p.src === 'own' && cipherOutranks(p.name)) return null;
	return p;
}

function handleEvents() {
	if (parent?.S?.holidayseason && !character?.s?.holidayspirit) {
		if (!smart.moving) {
			smart_move({ to: 'town' }, () => {
				parent.socket.emit('interaction', { type: 'newyear_tree' });
			});
		}
		return;
	}

	/* Everything below here used to be an independent decision per character:
	   the same "most damaged live event" scan ran in all three files, so two
	   live bosses could send the ranger to one and the priest to the other, and
	   crabxx was in the ranger's list alone - he joined it while the other two
	   kept farming, boss-side with no healer. bossTick owns the decision now,
	   the leader broadcasts it, and the gate decides whether it is worth taking
	   at all. -> BOSS EVENTS */
	bossTick().catch(bossThrew);
}


/* ============================================================================
   GIGA CRAB CONTRIBUTION LOG

   Persisted with set()/get(), so it lives in CODE storage and survives the page
   reload that change_server performs on every shard hop - the same property the
   chest map needed and did not have until v54. Nothing here is in memory only.

   Query it any day with crabxxReport() in the console, or the GigaCrab top
   button while the event is live. The point is to answer, from real data rather
   than estimate, whether it is worth generalising the dragold cross-shard
   hunter to this boss: at ~491 effective DPS into 960,000 HP behind armor 320
   and phresistance 30, the open question is how much damage he actually lands
   before other players finish it.
   -> RangerComments.md#giga-crab-contribution-log */
const CRABXX_KEY = 'crabxx_contrib';

function crabxxLoad() {
	try { const d = scopedGetLegacy(CRABXX_KEY); return (d && typeof d === 'object' && Array.isArray(d.runs)) ? d : { runs: [] }; }
	catch (e) { return { runs: [] }; }
}
function crabxxSave(v) {
	try { scopedSet(CRABXX_KEY, v); } catch (e) { console.error('crabxx log save failed:', e); }
}
function crabxxShard() {
	try { return String(parent.server_region || '?') + String(parent.server_identifier || '?'); }
	catch (e) { return '?'; }
}
/* One run per shard per day: a daily event, and a hop to another shard is a
   genuinely separate contribution worth accounting separately. */
function crabxxRunId() {
	return crabxxShard() + ':' + new Date().toISOString().slice(0, 10);
}

let crabxxPendingDmg = 0, crabxxPendingHits = 0, crabxxLastFlush = 0, crabxxHooked = false, crabxxWasRip = false;

/* Damage is read from the game's own hit events rather than inferred from our
   attack calls - only hits that actually landed count, and only ours. */
function crabxxHook() {
	if (crabxxHooked || !parent?.socket) return;
	crabxxHooked = true;
	parent.socket.on('hit', (d) => {
		try {
			if (!d || d.hid !== character.id || !d.damage) return;
			const t = parent.entities?.[d.id];
			if (!t || t.mtype !== 'crabxx') return;
			crabxxPendingDmg += d.damage;
			crabxxPendingHits++;
		} catch (e) { }
	});
}

function crabxxFlush(force) {
	const now = Date.now();
	// Batched: one write per 10s, never one per hit. A per-hit write would
	// rewrite the whole log every time, which is the O(n^2) trap v54 removed
	// from the chest map.
	if (!force && (now - crabxxLastFlush < 10000 || !crabxxPendingDmg)) return;
	crabxxLastFlush = now;
	if (!crabxxPendingDmg && !crabxxPendingHits && !force) return;
	const s = parent?.S?.crabxx;
	const log = crabxxLoad();
	const id = crabxxRunId();
	let run = log.runs.find(r => r.id === id);
	if (!run) {
		run = { id, shard: crabxxShard(), startedAt: new Date(now).toISOString(),
			damage: 0, hits: 0, deaths: 0, hpAtJoin: s?.hp ?? null, maxHp: s?.max_hp ?? null };
		log.runs.push(run);
		while (log.runs.length > 60) log.runs.shift();
	}
	run.damage += crabxxPendingDmg;
	run.hits += crabxxPendingHits;
	run.endedAt = new Date(now).toISOString();
	if (s) { run.hpLast = s.hp; run.maxHp = s.max_hp; run.liveLast = !!s.live; }
	crabxxPendingDmg = 0; crabxxPendingHits = 0;
	crabxxSave(log);
}

function crabxxTick() {
	try {
		crabxxHook();
		const live = parent?.S?.crabxx?.live === true;
		// Deaths are worth knowing: they are the cost side of showing up.
		if (live) {
			if (character.rip && !crabxxWasRip) {
				crabxxWasRip = true;
				const log = crabxxLoad();
				const run = log.runs.find(r => r.id === crabxxRunId());
				if (run) { run.deaths = (run.deaths || 0) + 1; crabxxSave(log); }
			} else if (!character.rip) {
				crabxxWasRip = false;
			}
		}
		crabxxFlush(!live && (crabxxPendingDmg > 0 || crabxxPendingHits > 0));
	} catch (e) { }
}
setInterval(crabxxTick, 5000);

/* Console-friendly summary. Safe to call any day - it reads the persisted log,
   not live state, so a hop or a reload loses nothing. */
function crabxxReport() {
	const log = crabxxLoad();
	if (!log.runs.length) { game_log('crabxx: no runs recorded yet', '#8b98ab'); return { runs: [] }; }
	let dmg = 0, hits = 0, deaths = 0;
	for (const r of log.runs) { dmg += r.damage || 0; hits += r.hits || 0; deaths += r.deaths || 0; }
	const out = {
		runs: log.runs.length, totalDamage: dmg, totalHits: hits, totalDeaths: deaths,
		avgDamagePerRun: Math.round(dmg / log.runs.length),
		shareOfOneBoss: Math.round((dmg / 960000) * 1000) / 10 + '% of a 960,000 HP Giga Crab',
		detail: log.runs.slice(-10)
	};
	console.log('crabxx contribution', out);
	game_log(`crabxx: ${log.runs.length} run(s), ${dmg.toLocaleString()} damage, ${deaths} death(s)`, '#FFD700');
	return out;
}

/* ============================================================================
   CROSS-SHARD BOSS HOP
   ============================================================================
   Generalised 2026-10-17 from the dragold-only scanner that shipped in v62.
   The state machine was already general; only six places named dragold - the
   server_info filter, the local-liveness probe, the scanResults shape, the
   config key, the relay message and the log strings.

   TWO FEEDS, AND THE BRIDGE IS NOT REQUIRED.

   1. SOCKETS, always on. One parent.io connection per non-PVP shard,
      listening for the game's own server_info broadcast. That is the same
      payload the bridge polls, so this is first-hand data, not a mirror:
      {live, map, hp, max_hp, target, x, y} when the boss is up and
      {live, spawn} when it is not. It gives liveness and hp everywhere, for
      every target type, with no external process at all.

   2. THE BRIDGE /bosses ENDPOINT, when it answers. It adds the one thing a
      single snapshot cannot: dps, measured from its own sample series on
      that shard. hp/dps is the whole selection rule, so with the bridge up
      the decision rests on an observed figure and without it on
      CONFIG.bossHop.fallbackDps.

   Written this way round deliberately. Dexon keeps hopping when the bridge is
   down - he just picks worse - rather than the hunt stopping with it.

   SELECTION. For each target boss on another shard:

       secsToDeath = hp / shardDps(shard, mtype)
       arriveSec   = (hopLatency + safety) / 1000
       (1) a LIVE boss must outlast the trip:  secsToDeath >= arriveSec
           a PENDING one is exempt - we land before it exists
       (2) enough must remain after landing:
           remainingSec = live ? secsToDeath - arriveSec : secsToDeath
           remainingSec >= requiredDwellSec(maxHp, contributors, hopsick)
       choose      = the SMALLEST secsToDeath among the eligible
       tie-break   = the lowest kills_to_rung

   NO HOME ROUTING BETWEEN HOPS, and FIGHTING EXITS ON DEATH OR A HARD
   ABORT AND NOTHING ELSE. Both are load-bearing invariants, not tuning;
   the measurements behind them are in the comments file.
   -> RangerComments.md#cross-shard-boss-hop */
/* How long a server_info push stays usable. Not a measured period: it is a
   generous multiple of the push rate, chosen so an ordinary gap never
   discards a good shard while a dead socket drops out within minutes. */
const SCAN_STALE_MS = 5 * 60 * 1000;
/* Consecutive failed change_server calls before the target is abandoned.
   Without it an unreachable shard wedges the hunter on a retry loop that
   never picks anything else. */
const HOP_ATTEMPT_CAP = 3;

/* How long to hold the hop lock after change_server before deciding the
   navigation is not coming. Only a page teardown has to fit inside it. */
const HOP_RELOAD_GRACE_MS = 15000;

const bossHop = {
	state: 'IDLE',
	targetShard: null,
	targetType: null,
	hopping: false,
	hoppingSince: 0,
	hopAttempts: 0,
	arrivedAt: 0,
	fightStart: 0,
	/* When IDLE first found nothing eligible while off the home shard.
	   Cleared by reset() after every fight, so it never goes stale. */
	idleSince: 0,
	// shard|mtype -> { shard, mtype, live, hp, maxHp, spawnTime, at }
	scanResults: [],
	// shard|mtype -> { dps, etaSec, hp, stale } from the bridge, or empty
	bridgeRows: [],
	bridgeAt: 0,
	bridgeErr: null,
	/* Cursor for the terminal-event feed: the SERVER's own `now` from the
	   last successful answer, never a local clock. Null until one succeeds. */
	termCursor: null,
	termAt: 0,
	termErr: null,
	/* /schedule_live, flattened: { shard, event, at, windowSec, status }.
	   schedServers is shard -> { ageSec } as of schedAt. */
	schedRows: [],
	schedServers: {},
	schedAt: 0,
	schedErr: null,
	/* The last hold announced, so the log says it once rather than per tick. */
	prepSaid: null,

	targetCfg(mtype) {
		return CONFIG.bossHop.targets.find(t => t.mtype === mtype) || null;
	},

	targetTypes() {
		return CONFIG.bossHop.targets.map(t => t.mtype);
	},

	startScanning() {
		if (!CONFIG.bossHop.enabled) return;
		if (typeof parent.io !== 'function') {
			game_log('Cross-shard boss scanning unavailable here - bosses will still be fought locally when they spawn', 'orange');
			return;
		}
		const servers = parent?.X?.servers;
		if (!servers) return;

		const wanted = this.targetTypes();
		for (const server of servers) {
			if (server.name === 'PVP') continue;
			const shard = server.region + server.name;
			const socket = parent.io(`https://${server.address}`, { path: server.path + 'socket.io', transports: ['websocket'] });
			socket.on('server_info', (data) => {
				if (!data) return;
				const at = Date.now();
				for (const mtype of wanted) {
					const d = data[mtype];
					if (!d) continue;
					/* Both shapes, kept apart on purpose: a live boss carries hp
					   and max_hp and no spawn, a dead one carries spawn and no
					   hp. Reading one field off the other shape yields
					   undefined, which would read as "hp 0" downstream. */
					this.record({
						shard,
						mtype,
						live: d.live === true,
						hp: typeof d.hp === 'number' ? d.hp : null,
						maxHp: typeof d.max_hp === 'number' ? d.max_hp : null,
						spawnTime: d.spawn ? new Date(d.spawn).getTime() : null,
						at,
					});
				}
			});
		}
		this.refreshBridge();
		this.refreshTerminal();
		this.refreshSchedule();
		setInterval(() => { this.refreshBridge(); this.refreshTerminal(); this.refreshSchedule(); }, 30000);
	},

	record(entry) {
		const idx = this.scanResults.findIndex(
			r => r.shard === entry.shard && r.mtype === entry.mtype);
		if (idx >= 0) this.scanResults[idx] = entry;
		else this.scanResults.push(entry);
	},

	/* Enrichment only, and deliberately fire-and-forget: nothing in tick()
	   awaits it, so a slow or dead bridge costs the hunt nothing. On failure
	   the rows are dropped rather than left to rot, because a stale dps is
	   worse than no dps - fallbackDps is at least honestly labelled. */
	refreshBridge() {
		if (!CONFIG.bossHop.enabled) return;
		plFetch('/bosses').then((j) => {
			const rows = Array.isArray(j?.bosses) ? j.bosses : (Array.isArray(j) ? j : []);
			this.bridgeRows = rows.map(r => ({
				shard: (r.serverRegion || '') + (r.serverIdentifier || ''),
				mtype: r.type,
				dps: typeof r.dps === 'number' ? r.dps : null,
				hp: typeof r.hp === 'number' ? r.hp : null,
				etaSec: typeof r.eta_sec === 'number' ? r.eta_sec : null,
				stale: r.stale === true,
				/* THREE STATES, and hasWindow is what separates the two that
				   look alike. The bridge omits window_ends_at for a boss with
				   no event window, and sends it as NULL for an event boss it
				   found already up - so absent means "respawn boss, use
				   estimatedRespawn" while null means "event boss, window
				   unknown". Collapsing them would read an already-up crabxx as
				   a respawn boss. */
				hasWindow: Object.prototype.hasOwnProperty.call(r, 'window_ends_at'),
				windowEndsAt: typeof r.window_ends_at === 'string' ? Date.parse(r.window_ends_at) : null,
				estimatedRespawn: typeof r.estimated_respawn === 'string' ? Date.parse(r.estimated_respawn) : null,
			}));
			this.bridgeAt = Date.now();
			this.bridgeErr = null;
		}, (e) => {
			this.bridgeRows = [];
			this.bridgeErr = String(e);
		});
	},

	/* Same fire-and-forget shape as refreshBridge. On failure the rows are
	   KEPT and schedAt is not advanced, so they age out through feedMaxAgeMs
	   rather than vanishing on one dropped poll - a plan that blinks off for
	   30s would let goHomeIfIdle start its clock against a shard we are
	   holding on. Shard names arrive as "US II"; ours have no space. */
	refreshSchedule() {
		if (!CONFIG.bossHop.enabled) return;
		plFetch('/schedule_live?hours=3').then((j) => {
			const occ = Array.isArray(j?.occurrences) ? j.occurrences : [];
			const rows = [];
			for (const o of occ) {
				const shard = String(o && o.server || '').replace(/\s+/g, '');
				const at = typeof o?.at_ms === 'number' ? o.at_ms : Date.parse(o?.at);
				if (!shard || !o.event || !isFinite(at)) continue;
				rows.push({
					shard, event: o.event, at,
					windowSec: typeof o.window_sec === 'number' ? o.window_sec : null,
					status: o.status || null,
				});
			}
			const servers = {};
			for (const k in (j?.servers || {})) {
				const a = j.servers[k] && j.servers[k].age_sec;
				servers[String(k).replace(/\s+/g, '')] = { ageSec: typeof a === 'number' ? a : null };
			}
			this.schedRows = rows;
			this.schedServers = servers;
			this.schedAt = Date.now();
			this.schedErr = null;
		}, (e) => {
			this.schedErr = String(e);
		});
	},

	/* How old a shard's lineup is NOW, in seconds, or null if the bridge has
	   never heard one. The bridge's age is as of its answer; ours is added. */
	lineupAgeSec(shard, now) {
		const s = this.schedServers[shard];
		if (!s || typeof s.ageSec !== 'number') return null;
		return s.ageSec + Math.max(0, (now - this.schedAt) / 1000);
	},

	/* One occurrence as a preposition candidate, or null. DUE means the hop
	   time has arrived; VIABLE means we can still engage with minUsefulMs of
	   window left. Only an event with an EXPLICIT rank qualifies - the default
	   rank is "everything nobody ranked", and prepositioning for icegolem on
	   that basis is not what the ruling asked for. */
	prepCandidate(o, cur, now) {
		const c = CONFIG.bossHop, p = c.preposition;
		if (!Object.prototype.hasOwnProperty.call(BOSS_RANK, o.event)) return null;
		if (o.status && o.status !== 'scheduled' && o.status !== 'live') return null;
		const age = this.lineupAgeSec(o.shard, now);
		if (age === null || age > p.lineupMaxAgeSec) return null;
		if (!bossEligible(o.event, o.shard).ok) return null;
		const winMs = o.windowSec ? o.windowSec * 1000 : this.eventWindowMs(o.event);
		if (!winMs) return null;
		const closesAt = o.at + winMs;
		if (now >= closesAt) return null;
		const joinOnly = this.isJoinEvent(o.event) && !this.isTaxiJoin(o.event);
		if (!joinOnly && (p.alsoFor || []).indexOf(o.event) < 0) return null;
		const lead = joinOnly ? this.hopsickMs() : p.walkLeadMs;
		const hopAt = o.at - lead - p.marginMs - c.hopLatencyMs;
		if (now < hopAt) return null;
		/* Already there costs no hop; sickness we already carry still has to
		   clear for a join-only event, and only what REMAINS of it. */
		const readyAt = o.shard === cur
			? now + (joinOnly ? this.hopsickRemainingMs() : 0)
			: now + c.hopLatencyMs + lead;
		if (readyAt > closesAt - p.minUsefulMs) return null;
		return { shard: o.shard, event: o.event, at: o.at, closesAt, hopAt, readyAt,
			rank: bossRank(o.event), joinOnly };
	},

	/* The occurrence to be on, or null. Rank first. Then HOME, which is the
	   "not on home" half of the ruling read as a preference: an equal-ranked
	   occurrence on home means stay (or go) home rather than preposition -
	   and going home also clears hop sickness at once, so a taxi join there is
	   a teleport rather than a sick walk. Then where we already stand, so two
	   equal shards cannot trade the party back and forth. Then earliest, then
	   by name so the answer is deterministic. */
	prepPlan(cur) {
		const p = CONFIG.bossHop.preposition;
		if (!p || !p.enabled) return null;
		const now = Date.now();
		if (!this.schedAt || now - this.schedAt > p.feedMaxAgeMs) return null;
		const home = (typeof character !== 'undefined' && character && character.home) || null;
		if (!home) return null;
		const homeAge = this.lineupAgeSec(home, now);
		if (homeAge === null || homeAge > p.lineupMaxAgeSec) return null;
		let best = null;
		for (const o of this.schedRows) {
			const x = this.prepCandidate(o, cur, now);
			if (!x) continue;
			x.home = x.shard === home;
			if (!best) { best = x; continue; }
			if (x.rank !== best.rank) { if (x.rank < best.rank) best = x; continue; }
			if (x.home !== best.home) { if (x.home) best = x; continue; }
			const xc = x.shard === cur, bc = best.shard === cur;
			if (xc !== bc) { if (xc) best = x; continue; }
			if (x.at !== best.at) { if (x.at < best.at) best = x; continue; }
			if (x.shard < best.shard) best = x;
		}
		return best;
	},

	/* The cipher gathering window to be on, or null. Same feed and the same
	   freshness rules as prepPlan; a lower rank than any boss, so this is only
	   ever acted on when nothing else is. Due on another shard once the hop
	   would still clear hop sickness by the opening; due on home or here once
	   the walk is close. Home first - "prefer home, but only in home's own
	   window", and the window is what makes home a candidate at all - then
	   here, then the one with the most gathering left.
	   -> RangerComments.md#cipherFarm */
	cipherPlan(cur) {
		const cf = CONFIG.cipherFarm, p = CONFIG.bossHop.preposition;
		if (!cf || !cf.enabled || !cf.hop) return null;
		const now = Date.now();
		const short = cipherShort(now);
		if (!short || !short.length) return null;
		if (!this.schedAt || now - this.schedAt > p.feedMaxAgeMs) return null;
		const home = (typeof character !== 'undefined' && character && character.home) || null;
		/* prepPlan's rule, for prepPlan's reason: without a fresh lineup for
		   home, "is home in its own window" cannot be answered, and guessing no
		   would hop the party off home in the middle of home's gathering. */
		if (!home) return null;
		const homeAge = this.lineupAgeSec(home, now);
		if (homeAge === null || homeAge > p.lineupMaxAgeSec) return null;
		const gather = cipherGatherMs();
		let best = null;
		for (const o of this.schedRows) {
			if (o.event !== CIPHER_EVENT) continue;
			if (o.status && o.status !== 'scheduled' && o.status !== 'live') continue;
			const age = this.lineupAgeSec(o.shard, now);
			if (age === null || age > p.lineupMaxAgeSec) continue;
			const end = o.at + gather;
			if (now >= end - cf.minUsefulMs) continue;
			const here = o.shard === cur, isHome = !!home && o.shard === home;
			/* Going home clears hop sickness at once, so home leads like here. */
			const lead = (here || isHome) ? cf.walkLeadMaxMs
				: this.hopsickMs() + cf.marginMs + CONFIG.bossHop.hopLatencyMs;
			if (now < o.at - lead) continue;
			/* A window that needs a HOP is refused when a hop target is
			   scheduled to open inside it, on any shard: bossHop will go to that
			   boss the moment it spawns, so the cipher hop is wasted and the
			   party lands sick somewhere it is about to leave. Horseman meets a
			   gathering window three times a day (05:00Z EU against US, 17:00Z
			   EU against ASIA, 23:00Z US and ASIA against EU). Home and here
			   need no hop, so they farm until the boss pulls the party off. */
			if (!here && !isHome && this.targetOpensWithin(now, end)) continue;
			const x = { shard: o.shard, event: CIPHER_EVENT, at: o.at, end, home: isHome, here, rank: bossRank(CIPHER_EVENT) };
			if (!best) { best = x; continue; }
			if (x.home !== best.home) { if (x.home) best = x; continue; }
			if (x.here !== best.here) { if (x.here) best = x; continue; }
			if (x.end !== best.end) { if (x.end > best.end) best = x; continue; }
			if (x.shard < best.shard) best = x;
		}
		return best;
	},

	/* A bossHop target scheduled to OPEN in [from, to), on any shard, by the
	   published lineup. Opening only: one already live has been weighed by
	   pickTarget() already, and if it was declined it should not block. */
	targetOpensWithin(from, to) {
		for (const r of this.schedRows) {
			if (!r || !this.targetCfg(r.event) || typeof r.at !== 'number') continue;
			if (r.status && r.status !== 'scheduled') continue;
			if (r.at >= from && r.at < to) return r;
		}
		return null;
	},

	/* The rank of what keeps the party HERE, or null. Two things do: a
	   preposition whose shard is this one, and a boss-event trip that is live
	   on this shard. The second is not a preposition at all - it is the gap
	   goHomeIfIdle's own comment predicted, "any future local-only case has
	   the same shape": localTarget() sees only bossHop.targets, so a
	   graveyard or a goobrawl being fought here was invisible to it and the
	   party went home 90s into the fight. */
	holdRank(cur, prep) {
		let r = null;
		if (prep && prep.shard === cur) r = prep.rank;
		const trip = bossState.trip;
		/* NOT for a bossHop target. Those have localTarget() and FIGHTING, and
		   when localTarget() has declined one here - its share unreachable -
		   the right move is a hop to the same boss on a shard where it is
		   reachable. Holding on the trip blocked that equal-ranked hop in v132
		   and v133, which is the cross-shard horseman chain itself. */
		if (trip && trip.name && !this.targetCfg(trip.name) && (!trip.shard || trip.shard === cur)
			&& bossEntryLive(trip.name, (parent.S || {})[trip.name])) {
			const tr = bossRank(trip.name);
			if (r === null || tr < r) r = tr;
		}
		/* A third: a cipher window here that Meltymerch's bag still wants, at
		   its own rank in the table. A hop is admitted only for a boss ranked
		   above the cipher, and the stronger of this and a trip holds. */
		const cp = this.cipherPlan(cur);
		if (cp && cp.shard === cur) {
			const c = bossRank(CIPHER_EVENT);
			if (r === null || c < r) r = c;
		}
		return r;
	},

	prepStatus() {
		const cur = this.currentShard();
		const plan = this.prepPlan(cur);
		const iso = (ms) => ms ? new Date(ms).toISOString() : null;
		return {
			cur, home: (character && character.home) || null,
			plan: plan && { shard: plan.shard, event: plan.event, rank: plan.rank,
				joinOnly: plan.joinOnly, at: iso(plan.at), hopAt: iso(plan.hopAt),
				closesAt: iso(plan.closesAt), home: plan.home },
			hold: this.holdRank(cur, plan),
			rows: this.schedRows.length,
			feedAgeSec: this.schedAt ? Math.round((Date.now() - this.schedAt) / 1000) : null,
			err: this.schedErr,
			state: this.state,
		};
	},

	/* A boss that dies or despawns VANISHES from server_info rather than
	   reporting itself dead: `if (!d) continue` in startScanning has nothing
	   to write, so the last `live: true` push sits in scanResults until
	   SCAN_STALE_MS retires it five minutes later. For those five minutes a
	   dead boss is the candidate the picker likes BEST, because a frozen hp
	   is an hp that never falls. The bridge logs the transition within one
	   45s poll, so asking it closes a 300s hole to about 75s.

	   TERMINAL events, not despawns. Measured over the 2,499 retained events
	   on 2026-10-20: death 1,116, despawn 15, lost 120, spawn 1,248. Asking
	   for `ev=despawn` would have covered 15 of the 1,251 terminal events,
	   because despawn-vs-kill grades HOW a boss stopped existing and this
	   code cares only THAT it did.
	   -> RangerComments.md#terminalInvalidation */
	refreshTerminal() {
		if (!CONFIG.bossHop.enabled) return;
		/* No cursor on the first call, which pulls the whole retained log on
		   purpose: the ordering guard in applyTerminal is what makes that
		   safe, so there is no cold-start branch to get wrong. A truncated
		   answer drops the OLDEST of the new rows, which that same guard
		   already renders harmless. */
		const q = '/boss_events?terminal=1&limit=2000'
			+ (this.termCursor ? '&since=' + encodeURIComponent(this.termCursor) : '');
		plFetch(q).then((j) => {
			const evs = Array.isArray(j?.events) ? j.events : [];
			for (const e of evs) this.applyTerminal(e);
			/* Advanced only on success and only to the answer's own clock.
			   Holding it back on failure re-reads a few rows, which is
			   idempotent; advancing past a failed fetch would drop them. */
			if (typeof j?.now === 'string') this.termCursor = j.now;
			this.termAt = Date.now();
			this.termErr = null;
		}, (e) => {
			/* Recorded, not swallowed: without this "the bridge is down" and
			   "nothing has died" are the same silence. The cursor is left
			   where it was, so no event is lost by a failed poll. */
			this.termErr = String(e);
		});
	},

	/* One terminal event against one scanResults entry. Split out from the
	   fetch so it can be driven without a bridge. */
	applyTerminal(e) {
		/* THIS CHECK IS THE AUTHORITY; `terminal=1` on the query is bandwidth
		   only. A bridge predating that parameter ignores it in silence - the
		   handler reads the params it knows and never rejects an unknown one -
		   and answers with spawns mixed in, so a script trusting the server
		   filter would clear entries on a boss APPEARING. Deploy order
		   between the two is not something this script can observe. */
		const ev = String(e && e.ev || '').toLowerCase();
		if (ev !== 'death' && ev !== 'despawn' && ev !== 'lost') return;
		const mtype = e.type;
		if (!mtype) return;
		/* "US II" in the log against "USII" in scanResults, which builds its
		   shard as region + name with no separator. An unnormalised compare
		   matches nothing at all, and matching nothing is indistinguishable
		   from no boss ever having died. */
		const shard = String(e.server || '').replace(/\s+/g, '');
		if (!shard) return;
		/* death_hi, NOT t. On a death row `t` is a RECONSTRUCTION of when the
		   boss probably died - two of its three forms are the midpoint of the
		   poll bracket, (last_alive_t + poll_t)/2 - while death_hi is iso(poll_t),
		   the observation that proved it gone. The guard below is about which
		   INSTANCE a push belongs to, so it has to compare against the
		   observation: a push after death_hi genuinely postdates the absence,
		   a push between t and death_hi belongs to the instance that died.
		   Comparing against t discarded the terminal whenever the true death
		   fell in the later half of the bracket, because an event boss's key
		   vanishes AT the death so `at` lands there - and nothing arrives
		   afterwards to correct it, which left exactly the frozen-hp entry this
		   whole function exists to clear. Measured BY METHOD, because bracket
		   width is not a proxy for imprecision - a wide bracket on a
		   respawn_offset row means the poller noticed late while the
		   reconstruction stayed exact: respawn_offset 1,151 rows,
		   absent_on_responding_server 238, poll_bracket 0. All 238 carry the
		   midpoint, 174 of them over 30s, max 348s, so roughly 119 terminals
		   were discarded in 2.5 days. That set is ALSO exactly the one this
		   function acts on at all - BOSS_RESPAWN_SEC and EVENT_WINDOW_SEC are
		   disjoint, and a boss with a known respawn reports the dead shape
		   rather than vanishing, so record() has already written live:false
		   and the `r.live !== true` return below fires first.
		   despawn and lost rows carry no death_hi and their `t` IS the
		   detection time, so the fallback is correct rather than a concession.

		   GOO ENTRIES FLAP DURING A HEALTHY GOOBRAWL, AND THAT IS NOT A BUG.
		   goo variants die and are replaced continuously through the event, so
		   `ev: "lost"` ("instance id changed without an observed death") fires
		   routinely - the browser session measured the whole of it in the only
		   goo cluster the log holds: spawn 18:01:58, lost 18:05:45, spawn
		   18:05:45 at the SAME second, death 18:15:10. So an rgoo or bgoo entry
		   will go live -> false -> live repeatedly while a goobrawl runs. The
		   replacement spawn arrives in the same poll and record() re-adds it,
		   which is the self-healing property that made treating `lost` as
		   terminal safe in the first place. Do not "fix" the flapping.
		   Parsed in two steps so a malformed death_hi falls back instead of
		   dropping a real terminal. */
		let t = Date.parse(e.death_hi);
		if (!(t > 0)) t = Date.parse(e.t);
		if (!(t > 0)) return;
		const r = this.scanResults.find(x => x.shard === shard && x.mtype === mtype);
		if (!r || r.live !== true) return;
		/* ORDERING GUARD, and it is what carries the cold start. server_info
		   is the direct feed; the bridge is a derivative of it running up to
		   45s behind. So a push NEWER than the event describes a later
		   instance and wins - which is also why replaying the entire retained
		   log on the first fetch cannot clear a live entry, since every
		   historical row predates the push that created it. */
		if (r.at > t) return;
		r.live = false;
		r.hp = null;
		r.clearedBy = ev;
		r.clearedAt = t;
	},

	bridgeRow(shard, mtype) {
		if (Date.now() - this.bridgeAt > 120000) return null;
		return this.bridgeRows.find(
			r => r.shard === shard && r.mtype === mtype && !r.stale) || null;
	},

	/* Observed dps on that shard when the bridge has it, the measured
	   aggregate otherwise. Never zero: a zero would make secsToDeath infinite
	   and every candidate eligible, which is the opposite of safe. */
	shardDps(shard, mtype) {
		const row = this.bridgeRow(shard, mtype);
		if (row && row.dps > 0) return row.dps;
		return CONFIG.bossHop.fallbackDps;
	},

	currentShard() {
		return parent.server_region + parent.server_identifier;
	},

	/* typeof, not G?. - optional chaining does NOT save an UNDECLARED
	   identifier from throwing, and every caller here sits inside a loop
	   whose catch would turn that throw into a silent no-op. */
	gameData() {
		return (typeof parent !== 'undefined' && parent.G) ? parent.G
			: (typeof G !== 'undefined' ? G : null);
	},

	/* The boss's FULL pool, which is what the dwell requirement turns on -
	   not the hp left when Dexon lands. Contributors' points for damage dealt
	   before he arrives are still in `total` when the award loop runs. */
	maxHpOf(mtype, observed) {
		return observed ?? this.gameData()?.monsters?.[mtype]?.hp ?? null;
	},

	/* Minimum seconds Dexon must be present before the boss dies to clear
	   share > 0.0025. Derivation, from the share model: others collectively
	   deal the whole pool, split K ways, so their contribution to `total` is
	   K * (maxHp/K)^E = K^(1-E) * maxHp^E. Dexon clears the threshold when
	   his own points^E exceed THR/(1-THR) of that. Checked against the
	   browser session's independent table for all seven targets at K =
	   10/40/80: agreement is better than 0.9%, the residual being rounding
	   and well inside the uncertainty on dexonDps itself. */
	requiredDwellSec(maxHp, contributors, hopsick, mtype) {
		const E = 0.65, THR = 0.0025;
		const cfg = this.targetCfg(mtype);
		const dps = (cfg && cfg.dexonDps) || CONFIG.bossHop.dexonDps;
		/* Hop Sickness is output -20 AND points /= 4, so 0.8 * 0.25 = 0.2. */
		const ptFactor = hopsick ? 0.20 : 1.0;
		const k = Math.max(1, contributors);
		const needPoints = Math.pow(
			(THR / (1 - THR)) * Math.pow(k, 1 - E) * Math.pow(maxHp, E), 1 / E);
		return needPoints / (dps * ptFactor);
	},

	/* No feed gives a contributor count, so derive it from the dps we can
	   see. Self-consistent rather than accurate: more dps means both more
	   players and a faster death, and both push the gate the same way. */
	contributors(shard, mtype) {
		const c = CONFIG.bossHop;
		const k = Math.round(this.shardDps(shard, mtype) / c.typicalPlayerDps);
		return Math.min(c.maxContributors, Math.max(c.minContributors, k));
	},

	/* G.conditions.hopsickness.duration, read live rather than hardcoded.
	   Measured 2026-10-18: 720,000ms, with luck/gold/xp -80 and output -20. */
	hopsickMs() {
		const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
		const d = g && g.conditions && g.conditions.hopsickness && g.conditions.hopsickness.duration;
		return typeof d === 'number' ? d : 720000;
	},

	/* Arrival is an event JOIN rather than a walk, and the server REFUSES a
	   join while hop-sick - "You can't do this when you are sick!". Hopping
	   re-stamps hop sickness on arrival, so a hop timed to land AT spawn lands
	   unable to join at all, which is what v87 did for crabxx every time.
	   Derived from the game rather than from a list here, so a new daily
	   behaves correctly without an edit.
	   -> RangerComments.md#joinWhileHopsick */
	isJoinEvent(mtype) {
		const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
		return !!(g && g.events && g.events[mtype] && g.events[mtype].join === true);
	},

	/* How long the event stays open once it spawns, in ms. Measured
	   2026-10-18: crabxx 2,400s, which is the only reason waiting out 720s of
	   hop sickness inside the window is affordable. */
	eventWindowMs(mtype) {
		const g = (typeof parent !== 'undefined' && parent.G) ? parent.G : null;
		const d = g && g.events && g.events[mtype] && g.events[mtype].duration;
		return typeof d === 'number' ? d * 1000 : null;
	},

	isHopsick() {
		const s = (typeof character !== 'undefined' && character && character.s) || {};
		return !!s.hopsickness;
	},

	/* What is ACTUALLY left, not the full duration. hopsickMs() returns G's
	   720000 whatever the clock says, so a character 80% of the way through
	   was being charged the whole twelve minutes by every gate that used it.
	   The live field is on the condition itself; falls back to the full
	   duration when it is absent, which is the conservative direction. */
	hopsickRemainingMs() {
		const s = (typeof character !== 'undefined' && character && character.s) || {};
		const h = s.hopsickness;
		if (!h) return 0;
		return (typeof h.ms === 'number' && h.ms >= 0) ? h.ms : this.hopsickMs();
	},

	/* A join whose refusal does NOT put the fight out of reach - see
	   bossTaxiWalkable() for why this is a different question from
	   isJoinEvent(). The gates below use THIS one; isJoinEvent stays because
	   it answers its own question correctly and is deliberately open-ended
	   over G, which is exactly why it must not be the predicate here. */
	isTaxiJoin(mtype) {
		return this.isJoinEvent(mtype) && bossTaxiWalkable(mtype);
	},

	localBossLive(mtype) {
		return parent?.S?.[mtype]?.live === true;
	},

	/* Any target boss live in this shard right now, by the operator's rank.
	   Checked before any hop: a boss standing here costs no latency and no
	   hop sickness, so it always wins. */
	localTarget() {
		/* No latency and no NEW hop sickness, so test (2) only - but it is
		   still a test. v84 let this path commit FIGHTING to a boss whose
		   share was unreachable, which is a quarter of an hour spent for
		   nothing. hopsick is read LIVE rather than assumed: if the clock has
		   run out the requirement is 5x smaller, and that is exactly the case
		   where a boss standing in front of him is most worth taking. */
		const hopsick = this.isHopsick();
		let best = null;
		for (const t of CONFIG.bossHop.targets) {
			if (!this.localBossLive(t.mtype)) continue;
			/* A BOSS THE COMBAT SIDE HAS GIVEN UP ON IS NOT A REASON TO STAY,
			   AND UNTIL 2026-10-20 IT WAS. tick() asks localTarget() FIRST and
			   anything truthy commits FIGHTING and returns, so pickTarget() is
			   never reached - which means a live-but-abandoned boss at home
			   pinned the party to its shard for as long as it stayed alive.

			   Observed live on the 2026-10-19 nightly window: all three
			   committed to US II franky at 04:00:01.5; by 04:20 it had gone
			   120,000,000 -> 106,000,000 at ~11,400 dps, about 2.9 HOURS to
			   finish, and the combat side gave up at its 1,200s trip budget and
			   cooled franky down. From 04:20 to 04:43 pickTarget() was returning
			   US V franky at ~15.9 SECONDS of required dwell with ~6,000s of
			   window left and NO HOP EVER FIRED, because localTarget() still saw
			   106M of live franky standing here. Cost: two franky credits and
			   their keys, from bosses that needed sixteen seconds of presence.

			   v99 PUT THE ASYMMETRY HERE; v103 DISSOLVED IT, and the order
			   matters if this is ever revisited. While the cooldown was keyed
			   by TYPE it could not say "this franky", so gating only the HERE
			   selector was the one placement that supplied the missing shard -
			   and gating pickTarget() too would have blocked the hop the fix
			   exists to allow. The cooldown is now keyed (type, shard), so both
			   selectors gate on it and each asks about its own shard; this call
			   defaults to ours. Do not restore the asymmetry without first
			   making the key type-wide again, and do not make the key
			   type-wide without restoring the asymmetry - either alone
			   reinstates a measured defect.

			   v99 WAS ONLY HALF THE FIX, and that was not visible until the
			   shard key landed: hopping away is not fighting. bossHop commits
			   FIGHTING from localBossLive() alone, while the party only
			   APPROACHES and attacks a boss when shouldHandleEvents() is true,
			   which needs bossPick() - and bossPick() goes through
			   bossEligible(), which a type-wide give-up refused on every shard.
			   So v99 sent the party to US V and left it farming ordinary mobs
			   beside the franky it had travelled for.
			   -> RangerComments.md#shardKeyedCooldown */
			if (bossCooledDown(t.mtype)) continue;
			/* Only skip when the join is the ONLY way in. For a taxi join the
			   refusal costs the lift, not the fight: the boss is on a walkable
			   map and bossApproach walks to it. Skipping here was the worst of
			   the three over-restrictions this gate had - it walked the party
			   away from a live boss standing in front of them.
			   -> RangerComments.md#joinWhileHopsick */
			if (hopsick && this.isJoinEvent(t.mtype) && !this.isTaxiJoin(t.mtype)) continue;
			const cur = this.currentShard();
			const st = parent?.S?.[t.mtype];
			const hp = typeof st?.hp === 'number' ? st.hp : null;
			const maxHp = this.maxHpOf(t.mtype, typeof st?.max_hp === 'number' ? st.max_hp : null) ?? hp;
			/* Unknown hp is NOT a reason to skip a boss that is standing
			   here: there is nothing to lose by trying, and the alternative
			   is hopping away from a free fight on missing data. */
			if (hp > 0 && maxHp > 0) {
				const k = this.contributors(cur, t.mtype);
				const need = this.requiredDwellSec(maxHp, k, hopsick, t.mtype);
				if (hp / this.shardDps(cur, t.mtype) < need) continue;
			}
			/* Rank, then the operator's delegated tie-break: cheapest dwell
			   first, because banking the cheap one does not cost the other,
			   then kills_to_rung LAST - it is achievement distance, not
			   worth, and leading on it is what this replaces.
			   No change against today's three targets, whose kills_to_rung
			   order happens to match their rank; it stops the NEXT target
			   added from silently inheriting an ordering nobody chose. */
			const need = (hp > 0 && maxHp > 0)
				? this.requiredDwellSec(maxHp, this.contributors(cur, t.mtype), hopsick, t.mtype)
				: Infinity;
			const cand = { mtype: t.mtype, kills_to_rung: t.kills_to_rung, rank: bossRank(t.mtype), need };
			if (!best
				|| cand.rank < best.rank
				|| (cand.rank === best.rank && cand.need < best.need)
				|| (cand.rank === best.rank && cand.need === best.need
					&& cand.kills_to_rung < best.kills_to_rung)) best = cand;
		}
		return best?.mtype ?? null;
	},

	/* Every (shard, boss) worth considering, each with the secsToDeath the
	   selection rule turns on. A boss that has not spawned yet is admitted
	   only inside preSpawnBuffer and is costed at full health, which ranks it
	   last among the eligible - correct, since arriving early means waiting. */
	candidates() {
		const now = Date.now();
		const cur = this.currentShard();
		const out = [];

		for (const r of this.scanResults) {
			if (r.shard === cur) continue;
			/* A socket that has quietly died leaves its last push sitting in
			   scanResults forever, and a frozen hp reads as a live boss that
			   never loses health - which is exactly the candidate the picker
			   likes best. server_info is pushed on a short period, so an
			   entry this old means the feed is gone, not that nothing moved. */
			if (now - r.at > SCAN_STALE_MS) continue;
			const cfg = this.targetCfg(r.mtype);
			if (!cfg) continue;

			let hp = null;
			if (r.live) {
				const row = this.bridgeRow(r.shard, r.mtype);
				hp = r.hp ?? row?.hp ?? r.maxHp;
			} else if (r.spawnTime) {
				const untilSpawn = r.spawnTime - now;
				/* A join-type event has to be reached EARLY, not at spawn. The
				   hop re-stamps hop sickness on arrival and the join is refused
				   for its whole duration, so landing hopsickMs + margin ahead
				   means the clock clears about when the event opens.
				   -> RangerComments.md#joinWhileHopsick */
				const buffer = (this.isJoinEvent(r.mtype) && !this.isTaxiJoin(r.mtype))
					? this.hopsickRemainingMs() + CONFIG.bossHop.joinClearMarginMs
					: CONFIG.bossHop.preSpawnBuffer;
				if (untilSpawn <= 0 || untilSpawn > buffer) continue;
				hp = this.maxHpOf(r.mtype, r.maxHp);
			} else {
				continue;
			}
			if (!(hp > 0)) continue;

			/* secsToDeath takes CURRENT hp - when will it die - while the
			   dwell gate takes the FULL pool. They are different questions
			   and conflating them is what shipped in v84. */
			const maxHp = this.maxHpOf(r.mtype, r.maxHp) ?? hp;

			out.push({
				shard: r.shard,
				mtype: r.mtype,
				hp,
				maxHp,
				live: r.live,
				secsToDeath: hp / this.shardDps(r.shard, r.mtype),
				kills_to_rung: cfg.kills_to_rung,
				spawnTime: r.spawnTime || null,
			});
		}
		return out;
	},

	/* TWO tests, not one floor. v84 added the dwell requirement to the trip
	   cost and compared the sum against secsToDeath, which rejects snowman
	   outright: it needs ~0s of dwell but dies far inside the hop latency, so
	   it is only ever reachable PRE-SPAWN - and the pre-spawn path must not
	   be charged arrival latency, because we land before the boss exists and
	   catch the whole fight. */
	pickTarget() {
		const c = CONFIG.bossHop;
		const hopsick = this.isHopsick();
		const arriveSec = (c.hopLatencyMs + c.safetyMarginMs) / 1000;

		const eligible = this.candidates().filter(x => {
			/* GATED AS OF v103, WHICH v99's COMMENT EXPRESSLY FORBADE - read
			   localTarget() before changing this back. The prohibition was
			   sound while the cooldown was keyed by TYPE, because a type-wide
			   entry here would have blocked the very hop the fix exists to
			   allow. Keyed by (type, shard) it says "not THAT franky", so the
			   candidate's own shard is the right question and the asymmetry
			   has nothing left to do. candidates() already skips our own
			   shard, so this only fires for a shard we abandoned and left. */
			if (bossCooledDown(x.mtype, x.shard)) return false;
			const k = this.contributors(x.shard, x.mtype);
			x.requiredDwellSec = this.requiredDwellSec(x.maxHp, k, hopsick, x.mtype);
			x.contributors = k;
			// (1) a LIVE boss has to outlast the trip. A pending one does not.
			if (x.live && x.secsToDeath < arriveSec) return false;
			/* A join-type event is worth the trip only if we can be CLEAN
			   inside its window. We land hop-sick for hopsickMs whatever we
			   do, and cannot join until that clears, so the test is whether
			   enough window remains AFTER it clears to satisfy the dwell. */
			if (this.isJoinEvent(x.mtype)) {
				const win = this.eventWindowMs(x.mtype);
				if (win) {
					/* A TAXI join charges no sickness wait: we walk in sick and
					   pay 5x in dwell, which every one of these windows
					   absorbs - franky at 200 contributors needs 398s of 2400.
					   Only a join with no walkable entrance has to wait the
					   clock out, and only what REMAINS of it, not the full
					   duration. */
					const wait = this.isTaxiJoin(x.mtype) ? 0 : this.hopsickRemainingMs();
					const joinableAt = Date.now() + c.hopLatencyMs + c.safetyMarginMs + wait;
					const closesAt = (x.live ? Date.now() : (x.spawnTime || Date.now())) + win;
					if ((closesAt - joinableAt) / 1000 < x.requiredDwellSec) return false;
				}
			}
			// (2) enough fight has to remain AFTER we land.
			x.remainingSec = x.live ? x.secsToDeath - arriveSec : x.secsToDeath;
			return x.remainingSec >= x.requiredDwellSec;
		});
		if (!eligible.length) return null;
		/* Rank, then the operator's delegated tie-break - cheapest dwell,
		   then earliest deadline, then kills_to_rung last. secsToDeath used
		   to lead, which answered "which dies soonest" rather than "which is
		   worth most"; it is still the right SECOND question and keeps its
		   place. No change against today's candidate set: dragold is inert
		   with lunarnewyear off, and no two event bosses can be live at once
		   because no two windows overlap. */
		eligible.sort((a, b) =>
			bossRank(a.mtype) - bossRank(b.mtype)
			|| a.requiredDwellSec - b.requiredDwellSec
			|| a.secsToDeath - b.secsToDeath
			|| a.kills_to_rung - b.kills_to_rung);
		return eligible[0];
	},

	/* The chain has ended: nothing eligible on any shard. Go home, because
	   parking away forfeits the home shard's OWN boss spawns - the only ones
	   carrying the home-server bonus and drops_home. Deliberately not the
	   between-kills routing v86 deleted: that round trip bought nothing
	   between two targets and re-armed both clocks for the next hop. Here
	   there IS no next hop, so the only thing left to protect is home.
	   character.home is the Bean-set home and is already in currentShard()
	   format, so nothing is hardcoded. Routes through changeServer(), so the
	   followers are told first and come along. */
	async goHomeIfIdle(cur) {
		const c = CONFIG.bossHop;
		/* NEVER leave a boss that is live where we stand. candidates() opens
		   with `if (r.shard === cur) continue;`, so a locally-live target is
		   structurally invisible to pickTarget - which means "nothing
		   eligible anywhere" can be true of the picker while a boss is on
		   screen. Before v94 the two gates between them produced exactly
		   that: the local gate skipped a sick taxi join, the picker could not
		   see it, and 90s later the party hopped home, clearing the sickness
		   instantly and abandoning a boss still running on the shard it just
		   left. Fixing the taxi gates narrows this; it does not close it,
		   because any future local-only case has the same shape. */
		if (this.localTarget()) { this.idleSince = 0; return 'continue'; }
		/* The same rule for what localTarget() cannot see: a planned event on
		   this shard, or an event-layer trip live here. Checked here as well
		   as in tick() so no route into a home hop skips it. */
		if (this.holdRank(cur, this.prepPlan(cur)) !== null) { this.idleSince = 0; return 'continue'; }
		if (!c.returnHome) { this.idleSince = 0; return 'continue'; }
		const home = (typeof character !== 'undefined' && character && character.home) || null;
		if (!home || cur === home) { this.idleSince = 0; return 'continue'; }
		if (!this.idleSince) { this.idleSince = Date.now(); return 'continue'; }
		if (Date.now() - this.idleSince < c.returnHomeAfterMs) return 'continue';
		this.idleSince = 0;
		game_log(`🐉 Nothing eligible anywhere — heading home to ${home}`, '#FFD700');
		if (await this.lootBeforeHop()) return 'block';
		await this.changeServer(home, 'home');
		return 'block';
	},

	async lootBeforeHop() {
		const chests = Object.keys(get_chests());
		if (chests.length === 0) return false;

		for (const id of chests) {
			try { await loot(id); } catch (e) { }
		}
		return true;
	},

	parseShard(shard) {
		for (const region of REGIONS) {
			if (shard.startsWith(region)) return { region, name: shard.slice(region.length) };
		}
		return null;
	},

	async changeServer(shard, mtype) {
		const parsed = this.parseShard(shard);
		if (!parsed) {
			game_log(`bossHop: can't parse shard "${shard}"`, 'red');
			return false;
		}
		game_log(`🐉 Hopping to ${shard} for ${mtype}`, '#FFD700');
		this.hopping = true;
		this.hoppingSince = Date.now();
		try {
			/* Tell the followers BEFORE change_server: it reloads the page, so
			   anything after it in this function may never run. The leader
			   decides and they only obey - they run no scanner of their own. */
			plSend(['FatherToken', 'MageofOz'], {
				message: 'boss_hop',
				shard,
				mtype,
				region: parsed.region,
				name: parsed.name
			});
			change_server(parsed.region, parsed.name);
			/* `hopping` DELIBERATELY STAYS TRUE HERE. change_server does not
			   block: it starts a navigation and returns, and this page keeps
			   running for a few hundred ms more. Clearing the flag on this
			   line - which is what it used to do - let the next mainLoop tick
			   100ms later find state HOPPING with currentShard() still
			   reporting the OLD shard, call changeServer again, and send
			   another boss_hop. Measured on the live party 2026-10-18 off the
			   followers' acted-list: 2-5 boss_hop per hop episode, ~105ms
			   apart, which is TICK_RATE.main exactly. The followers' same-shard
			   guard absorbed every one of them, so nothing broke, but each
			   burst message burned an entry of their 20-id acted-list.
			   Nothing after a real navigation runs, so leaving it true costs
			   nothing; hopWatchdog() below covers a navigation that never
			   arrives. */
			return true;
		} catch (e) {
			game_log(`bossHop: server change failed — ${e}`, 'red');
			this.hopping = false;
			this.hoppingSince = 0;
			return false;
		}
	},

	/* `hopping` is held across the navigation change_server starts, so on the
	   normal path nothing clears it - the page goes away instead. That makes
	   a navigation which never arrives wedge the flag on, and because tick()
	   answers 'block' while it is set, that would stall the WHOLE main loop,
	   not just bossHop. So bound it. The window only has to outlast a page
	   teardown, measured in hundreds of ms; 15s is far beyond that and still
	   short enough that a stall is a blip rather than an outage. */
	hopWatchdog() {
		if (!this.hopping) return false;
		if (Date.now() - this.hoppingSince < HOP_RELOAD_GRACE_MS) return true;
		game_log(`bossHop: no reload ${Math.round(HOP_RELOAD_GRACE_MS / 1000)}s after change_server - releasing the hop lock`, 'orange');
		this.hopping = false;
		this.hoppingSince = 0;
		return false;
	},

	async tick() {
		if (!CONFIG.bossHop.enabled) return 'continue';
		if (this.hopWatchdog()) return 'block';

		const cur = this.currentShard();

		switch (this.state) {
			case 'IDLE': {
				/* A preposition elsewhere that STRICTLY outranks the boss in
				   front of us is the one case a live local boss does not win:
				   "no higher-ranked boss outranks it" read from the other side. */
				const prep = this.prepPlan(cur);
				const here = this.localTarget();
				if (here && !(prep && prep.shard !== cur && prep.rank < bossRank(here))) {
					this.state = 'FIGHTING';
					this.targetShard = cur;
					this.targetType = here;
					this.arrivedAt = this.arrivedAt || Date.now();
					this.fightStart = Date.now();
					game_log(`🐉 ${here} live here — entering FIGHTING`, '#FFD700');
					return 'continue';
				}

				/* Something holding us here admits only a STRICTLY better hop,
				   so an equal-ranked boss elsewhere cannot pull the party off a
				   goobrawl it waited twelve minutes for. */
				const hold = this.holdRank(cur, prep);
				let cipher = null;
				let pick = this.pickTarget();
				if (pick && hold !== null && !(bossRank(pick.mtype) < hold)) pick = null;
				if (pick && prep && prep.shard !== cur && !(bossRank(pick.mtype) < prep.rank)) pick = null;

				if (!pick && prep && prep.shard !== cur && (hold === null || prep.rank < hold)) {
					this.idleSince = 0;
					this.state = 'HOPPING';
					this.targetShard = prep.shard;
					this.targetType = prep.event;
					game_log(`🐉 Prepositioning on ${prep.shard} for ${prep.event} at ${new Date(prep.at).toISOString().slice(11, 16)}Z`
						+ (prep.joinOnly ? ' (join-only: clearing hop sickness first)' : ''), '#FFD700');
				} else if (pick) {
					this.idleSince = 0;
					this.state = 'HOPPING';
					this.targetShard = pick.shard;
					this.targetType = pick.mtype;
					game_log(`🐉 ${pick.mtype} on ${pick.shard}: ~${Math.round(pick.secsToDeath)}s to death — hopping`, '#FFD700');
				} else if (hold === null && !(prep && prep.shard !== cur) && (cipher = this.cipherPlan(cur)) && cipher.shard !== cur) {
					/* Last of all: nothing to fight, nothing planned, nothing
					   holding us - a gathering window elsewhere. */
					this.idleSince = 0;
					this.state = 'HOPPING';
					this.targetShard = cipher.shard;
					this.targetType = CIPHER_EVENT;
					game_log(`🐉 Hopping to ${cipher.shard} for the cipher gathering at ${new Date(cipher.at).toISOString().slice(11, 16)}Z`
						+ (cipher.home ? ' (home)' : ''), '#C9A0FF');
				} else if (hold !== null) {
					this.idleSince = 0;
					const why = prep && prep.shard === cur ? prep.event + '|' + prep.at
						: (hold === bossRank(CIPHER_EVENT) ? 'cipher' : 'trip');
					const key = cur + '|' + why;
					if (this.prepSaid !== key) {
						this.prepSaid = key;
						game_log(prep && prep.shard === cur
							? `🐉 Holding on ${cur} for ${prep.event} at ${new Date(prep.at).toISOString().slice(11, 16)}Z`
							: hold === bossRank(CIPHER_EVENT)
								? `🐉 Holding on ${cur} for the cipher gathering`
								: `🐉 Holding on ${cur} - an event fight is live here`, '#FFD700');
					}
					return 'continue';
				} else {
					return await this.goHomeIfIdle(cur);
				}
			}

			case 'HOPPING': {
				if (cur === this.targetShard) {
					this.arrivedAt = Date.now();
					/* S.witchcipher reads live: true for the whole round, so
					   localBossLive would commit FIGHTING to it - fifteen minutes
					   of a state that admits nothing. Back to IDLE, where the
					   cipher hold keeps us and cipherTick points the spot. */
					if (this.targetType === CIPHER_EVENT) {
						game_log(`🐉 Arrived on ${cur} for the cipher gathering`, '#C9A0FF');
						this.reset();
						return 'continue';
					}
					if (this.localBossLive(this.targetType)) {
						this.state = 'FIGHTING';
						this.fightStart = Date.now();
						game_log(`🐉 Arrived — ${this.targetType} is live, FIGHTING`, '#FFD700');
						return 'continue';
					}
					game_log(`🐉 Arrived but ${this.targetType} is not live here — back to IDLE`, '#FFD700');
					this.reset();
					return 'continue';
				}

				if (await this.lootBeforeHop()) return 'block';

				if (!await this.changeServer(this.targetShard, this.targetType)) {
					if (++this.hopAttempts >= HOP_ATTEMPT_CAP) {
						game_log(`🐉 Giving up on ${this.targetShard} after ${this.hopAttempts} failed hops`, 'orange');
						this.reset();
						return 'continue';
					}
				}
				return 'block';
			}

			case 'FIGHTING': {
				if (cur !== this.targetShard) {
					/* Something else moved him. Credit for this fight is gone
					   whatever happens now, so stop pretending otherwise. */
					game_log(`🐉 Left ${this.targetShard} mid-fight — abandoning ${this.targetType}`, 'orange');
					this.reset();
					return 'continue';
				}
				if (this.localBossLive(this.targetType)) {
					const fought = Date.now() - this.fightStart;
					if (fought > CONFIG.bossHop.maxFightMs) {
						game_log(`🐉 ${this.targetType} still up after ${Math.round(fought / 60000)}m — hard abort`, 'orange');
						this.reset();
						return 'continue';
					}
					return 'continue';
				}
				const dwell = Date.now() - (this.arrivedAt || this.fightStart);
				game_log(`🐉 ${this.targetType} dead on ${this.targetShard} after ${Math.round(dwell / 1000)}s here — next target`, '#FFD700');
				/* PRESENT AT DEATH is the thing credit actually requires, and
				   this branch is the only place we know it happened. Only
				   closes a row an earlier walk-in-sick opened, so an ordinary
				   teleported fight records nothing. */
				taxiProbeClose(this.targetType, dwell);
				/* Straight back to IDLE, NOT home - see NO HOME ROUTING above.
				   Credit was already awarded where it died. */
				this.reset();
				return 'continue';
			}

			default:
				this.reset();
				return 'continue';
		}
	},

	reset() {
		this.state = 'IDLE';
		this.targetShard = null;
		this.targetType = null;
		this.hopAttempts = 0;
		this.arrivedAt = 0;
		this.fightStart = 0;
		this.idleSince = 0;
	}
};

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
// -> RangerComments.md#travel-helper-a-smart-move-that-reports
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
   destination. 200 sits clear of that, and well
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

/* ORPHAN A FARM TRIP AND STOP ITS WALK. Bumping attemptId makes the late
   resolution a no-op and does nothing to the walk itself: the game went on
   moving Dexon toward spookytown from inside a goobrawl, 12:02Z 2026-10-25.
   stop('smart') ends the smart_move and leaves the step under way alone. */
function travelCancel() {
	if (!travelState.inFlight) return false;
	travelState.attemptId++;
	travelState.inFlight = false;
	try { if (typeof stop === 'function') stop('smart'); } catch (e) { }
	return true;
}

function travelWatchdog(dest) {
	if (!travelState.inFlight) return;
	if (Date.now() - travelState.startedAt < TRAVEL.attemptTimeoutMs) return;
	travelCancel();
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
	if (smart.moving || !destination) return;
	const center = destination, r = CONFIG.movement.circleRadius, now = performance.now();
	const dt = Math.min((now - state.lastAngleUpdate) / 1000, 0.5);
	state.lastAngleUpdate = now;
	state.angle = (state.angle + (character.speed / r) * dt) % (2 * Math.PI);
	if (!character.moving) await safeMove(center.x + Math.cos(state.angle) * r, center.y + Math.sin(state.angle) * r);
}

/* ---------------------------------------------------------------------------
   KITE TARGET SELECTION - identical shape in Ranger.js / Priest.js / Mage.js.

   Two independent paths into "should this be kited", deliberately separate:
   -> RangerComments.md#kite-target-selection-identical-shape-in-ranger */
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
   THREAT FIELD - added v59/v32/v55, after measurement.
   -> RangerComments.md#threat-field-added-v59-v32-v55-after */

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
   -> RangerComments.md#cohesion-focus-fire-and-the-route-penalty */

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

async function rangedKite() {
	const cfg = CONFIG.movement.rangedKiting;
	if (!cfg.enabled) return false;
	const types = kiteCandidateTypes(cfg);
	if (!types.length) return false;

	const threats = kiteThreats(cfg, types);
	const attackers = kiteAttackerCount();
	const courage = character.courage || 2;
	const disengage = cfg.disengageOnCourage !== false && attackers >= courage;

	/* smart_move used to veto kiting outright, so a character pathing anywhere
	   could not defend itself at all. It still yields during ordinary travel,
	   but a crowd at or over courage cancels the path rather than being ignored. */
	if (smart.moving) {
		if (!disengage) return false;
		try { if (typeof stop === 'function') stop(); } catch (e) {}
	}

	const target = get_nearest_monster_v2({ type: types, max_distance: cfg.maxKiteRange });
	if (!target && !disengage) return false;

	/* Band is per-target now. The old code read cfg.maxDistance, which was null,
	   so `dist > cfg.maxDistance` coerced to `dist > 0` and reason 2 fired on
	   every tick reason 1 did not - which made repositionThreshold unreachable
	   dead config and made the `nd > maxDistance` penalty below a no-op that
	   scored every candidate -1000 alike. Both work as designed now. */
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

	/* Direction from the whole field when retreating or disengaging; from the
	   governing target when closing or recentring, which measured correct. */
	const multi = (reason === 1 || reason === 4);
	const baseMag = Math.max(6, Math.min(cfg.moveDistance, Math.abs(need)));
	const step = Math.PI / cfg.sampleAngles, n = cfg.sampleAngles * 2;
	let bestW = -Infinity, bestX = 0, bestY = 0, found = false;
	for (const frac of KITE_STEP_FRACTIONS) {
		const mag = Math.max(6, baseMag * frac);
		for (let i = 0, a = 0; i < n; i++, a += step) {
			const tx = cx + mag * Math.cos(a), ty = cy + mag * Math.sin(a);
			if (!can_move_to(tx, ty)) continue;
			/* Route cost, not a veto - the old hard veto eliminated every
			   candidate whenever we were inside the pack, which is the only case
			   that kills. Do not reinstate it. */
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
		/* Pathfinder last resort. xmove falls back to smart_move when the straight
		   line is blocked, and the scored pass never reaches it because every
		   candidate is pre-filtered through can_move_to. smart_move routes around
		   walls but is blind to monsters, so this is gated on an uncrowded field -
		   a path through the pack is worse than standing still. */
		if (attackers < courage && awayAngle != null) {
			const far = Math.max(cfg.moveDistance, 60);
			await safeMove(cx + Math.cos(awayAngle) * far, cy + Math.sin(awayAngle) * far);
			rangedKite.lastMove = now;
			if (cfg.debug) game_log('Kiting: pathfinder fallback', '#FFA500');
			return true;
		}
		/* Say so rather than claiming the tick - the call site can walkInCircle. */
		return false;
	}

	await safeMove(bestX, bestY);
	rangedKite.lastMove = now;
	if (cfg.debug) game_log(`Kiting ${target ? target.mtype : 'field'}: r${reason} att${attackers} (${Math.round(dist)} → ${Math.round(Math.hypot(target.real_x - bestX, target.real_y - bestY))})`, '#FFA500');
	return true;
}
rangedKite.lastMove = 0;

const CHEST_STORAGE_KEY = 'loot_chest_ids';

function loadChestMap() {
	const data = get(CHEST_STORAGE_KEY);
	return typeof data === 'object' && data !== null ? data : {};
}

function saveChestMap(map) {
	set(CHEST_STORAGE_KEY, map);
}

function removeChestId(id) {
	const stored = loadChestMap();
	if (stored[id]) {
		delete stored[id];
		saveChestMap(stored);
	}
}

function updateChestsInStorage() {
	const stored = loadChestMap();
	const now = performance.now();
	for (const id of Object.keys(get_chests())) {
		if (!stored[id]) {
			stored[id] = now;
		}
	}
	saveChestMap(stored);
}

async function handleLooting() {
	if (!CONFIG.looting.enabled) return;

	const chestMap = loadChestMap();
	const ids = Object.keys(chestMap);
	if (!ids.length) return;

	// Date.now(), not performance.now() - see the version header. performance
	// .now() restarts at ~0 on every page load while this map survives in CODE
	// storage, so stored stamps came from a dead clock and the age test below
	// went negative forever.
	const now = Date.now();
	const cap = CONFIG.looting.maxPerPass || 25;
	const done = [];
	let looted = 0;

	for (const id of ids) {
		if (looted >= cap) break;
		const storedAt = chestMap[id];
		if (!storedAt) { done.push(id); continue; }
		const age = now - storedAt;
		// age < 0 means the stamp came from a different clock than ours - a
		// legacy performance.now() value, or a wall-clock jump. Never strand
		// it: loot it now rather than wait for a deadline that cannot arrive.
		if (age >= 0 && age < CONFIG.looting.delayMs) continue;
		// try INSIDE the loop. It used to wrap the whole pass, so one throw
		// killed every remaining chest and left the offender at the head of the
		// map - and the next pass aborted on the same id.
		try {
			await loot(id);
			looted++;
		} catch (e) {
			console.error('loot(' + id + ') failed, dropping:', e);
		}
		done.push(id);
	}

	// One write per pass. removeChestId() reloads and rewrites the whole map
	// per chest, which is O(n) each and O(n^2) over a backlog of thousands.
	if (done.length) {
		const stored = loadChestMap();
		for (const id of done) delete stored[id];
		saveChestMap(stored);
	}

	if (looted > 0) {
		console.log(`Looted ${looted} chest(s), ${ids.length - done.length} still queued`);
	}
}

function lootInterval() {
	updateChestsInStorage();
	handleLooting();
}
setInterval(lootInterval, 250);

const clearInventory = () => {
	const cfg = CONFIG.muling;
	/* Mid-knock the ordinary helmet sits in the bag for a moment, unlocked
	   unless the operator locked it. -> TRICK OR TREAT */
	if (totBusy) return;
	const mule = get_player(cfg.muleName);
	if (!mule) return;

	if (character.gold > cfg.goldReserve) send_gold(mule, character.gold - cfg.goldReserve);

	character.items.forEach((item, i) => {
		if (item && !cfg.excludeItems.has(item.name) && !item.l && !item.s && is_in_range(mule, 'attack'))
			send_item(mule.id, i, item.q ?? 1);
	});
};

/* There was an inventorySorter() here until v57. It pinned seven item names to
   slots 0-6 every 2s, and because swap() is an exchange it evicted anything the
   operator dragged into one of those slots - measured reverting a hand move
   within 500ms. Slot order is arranged by hand now. Nothing reads a numeric
   index into character.items in this file. */

/* Can a message to the merchant actually arrive?

   Two channels with different reach. The bridge relay crosses shards, so if it
   is up the merchant hears us wherever it is. send_cm is realm-local, so it
   only works when the merchant is on this shard - and the one thing we can
   check for certain is whether it is visible to this client.

   Anything else is UNKNOWN, not "no". A merchant parked two maps away on this
   same shard is perfectly reachable by send_cm and invisible to get_player, so
   treating unknown as unreachable would suppress requests that would have
   worked. Callers decide what to do with unknown; for a request that is merely
   repeated too often, the cooldown already bounds the cost, so sending is the
   right answer. */
function merchantReach(name) {
	if (plUp) return { ok: true, how: 'bridge' };
	try { if (get_player(name)) return { ok: true, how: 'same shard, in view' }; } catch (e) { }
	return { ok: false, how: 'bridge down and not in view', unknown: true };
}

let potionAskAt = { hp: 0, mp: 0 };
let potionGateNote = null;

/* Ask the merchant for a resupply, at most once per cooldown. */
function askForPotions(kind, have) {
	const now = Date.now();
	if (now - (potionAskAt[kind] || 0) < CONFIG.potions.requestCooldownMs) return;
	const target = CONFIG.locationBroadcast.targetPlayer;
	const reach = merchantReach(target);
	// Unknown reachability still sends: see merchantReach. Only a confident
	// "no" would be worth suppressing, and we cannot have one.
	if (!reach.ok && !reach.unknown) {
		if (potionGateNote !== reach.how) {
			potionGateNote = reach.how;
			game_log(`[potions] holding requests: ${reach.how}`, '#8b98ab');
		}
		return;
	}
	potionGateNote = null;
	potionAskAt[kind] = now;
	plSend(target, {
		message: 'low_potions', potion: kind, quantity: have,
		x: character.x, y: character.y, map: character.map,
	});
}

/* Can buy(name) be served from where we stand? The server answers a buy only
   from a vendor of THAT item on the buyer's own map within B.sell_dist, 400
   units (node/server.js, the "buy" handler), and refuses anything else with
   "distance" - which the client prints as "Get closer". A buy made without
   asking this fired on every tick it was wanted and filled the game log with
   that line. Read from live G, so a moved or added vendor needs no edit; the
   margin keeps a reading at the edge from passing here and failing there. */
const VENDOR_REACH = 380;

function vendorInReach(name) {
	const map = G.maps && G.maps[character.map];
	if (!map || !map.npcs || !G.npcs) return false;
	for (const n of map.npcs) {
		const def = G.npcs[n.id];
		if (!def || !def.items || def.items.indexOf(name) === -1) continue;
		const spots = n.position ? [n.position] : (n.positions || []);
		for (const p of spots) {
			if (Math.hypot(character.x - p[0], character.y - p[1]) < VENDOR_REACH) return true;
		}
	}
	return false;
}

/* Can sell() be served from where we stand? The server's "sell" handler takes
   the nearest of its map's MERCHANTS - an npc with a single `position` and an
   `items` list, which is how the client builds G.maps[map].merchants - within
   B.sell_dist, 400, and refuses anything else with "distance", printed as
   "Get closer". Dexon's sellItems() fired from wherever he stood: 389 of 389
   refusals in a 14-minute recording on 2026-10-25, pstem, stramulet and
   wgloves, about one every two seconds while one sat in the bag. Read from
   live G, with the margin VENDOR_REACH keeps. */
function sellerInReach() {
	const map = G.maps && G.maps[character.map];
	if (!map || !map.npcs || !G.npcs) return false;
	for (const n of map.npcs) {
		const def = G.npcs[n.id];
		if (!def || !def.items || !n.position) continue;
		if (Math.hypot(character.x - n.position[0], character.y - n.position[1]) < VENDOR_REACH) return true;
	}
	return false;
}

/* buy() where the item's vendor is in reach, else nothing. A caller that
   passes `why` wants to hear about the shortfall, once per item per half
   hour; a caller with another supply route (the merchant, the restock trip)
   passes none. Returns buy()'s promise, or null when nothing was sent. */
const buyShortSaid = new Map();

function buyWhereSold(name, qty, why) {
	if (vendorInReach(name)) return buy(name, qty);
	if (why) {
		const now = Date.now();
		if (now - (buyShortSaid.get(name) || 0) >= 1800000) {
			buyShortSaid.set(name, now);
			game_log(`[buy] want ${name} (${why}) - no vendor of it within reach on ${character.map}`, 'orange');
		}
	}
	return null;
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
	if (totalHp < 500) askForPotions('hp', totalHp);
	if (totalMp < 500) askForPotions('mp', totalMp);
}

// Away from a vendor this sends nothing: the merchant's delivery and the
// restock trip are the supply there, and a respawn refused on cooldown used to
// land here every tick while the character was still dead.
async function buyMissingPotions() {
	if (quantity('hpot0') + quantity('hpot1') < CONFIG.potions.minStock) {
		const p = buyWhereSold('hpot1', CONFIG.potions.minStock);
		if (p) try { await p; } catch (e) { console.error('buy hpot1 failed:', e); }
	}
	if (quantity('mpot0') + quantity('mpot1') < CONFIG.potions.minStock) {
		const p = buyWhereSold('mpot1', CONFIG.potions.minStock);
		if (p) try { await p; } catch (e) { console.error('buy mpot1 failed:', e); }
	}
}

/* ---- Emergency restock: the trip has to be a TRIP, not a teleport ---------
   -> RangerComments.md#emergency-restock-the-trip-has-to-be */

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


const targetStartTimes = new Map();

const scare = () => {
	const cfg = (CONFIG.combat && CONFIG.combat.scare) || {};
	if (cfg.enabled === false) return;
	const slot = character.items.findIndex(i => i?.name === 'jacko');
	const now = performance.now();
	const minHeld = cfg.minHeldMs != null ? cfg.minHeldMs : 250;
	let held = 0;

	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e.type === 'monster' && e.target === character.name && e.mtype !== 'grinch') {
			let t = targetStartTimes.get(id);
			if (t === undefined) targetStartTimes.set(id, t = now);
			if (now - t > minHeld) held++;
		} else if (targetStartTimes.has(id)) {
			targetStartTimes.delete(id);
		}
	}

	/* Count attackers, do not merely detect one. Courage is how many attackers
	   are tolerated before fear starts, and a feared character stops ACTING -
	   for the priest that means it stops healing, which is the measured
	   mechanism behind the 2026-09-26 cgoo wipe: FatherToken absorbed 190 of
	   the party's 294 hits and sat over courage for 49 of 239 one-second
	   samples, and all three characters died. Firing AT courage pre-empts the
	   third attacker. The old gate fired on the FIRST monster to hold aggro for
	   250ms, so the 5s cooldown was routinely already spent when it mattered. */
	const threshold = Math.max(1, (character.courage || 2) + (cfg.courageOffset || 0));
	const shouldScare = held >= threshold;

	if (shouldScare && !is_on_cooldown('scare') && slot !== -1) {
		equip(slot);
		use_skill('scare');
		equip(slot);
	}

	const paused = parent?.paused;
	if (character?.afk && !paused) { pause(); parent.no_graphics = true; }
	else if (!character?.afk && paused) { pause(); parent.no_graphics = false; }
};

function partyMaker() {
	if (!CONFIG.party.autoManage) return;

	const group = CONFIG.party.groupMembers;
	const leaderName = group[0];
	const party = get_party() || {};
	const partyLead = get_entity(leaderName);

	if (character.name === leaderName) {
		for (let i = 1; i < group.length; i++) {
			const name = group[i];
			if (name === character.name) continue;
			if (party[name]) continue;

			send_party_invite(name);
		}
	} else {
		if (!party[character.name] && partyLead) {
			send_party_request(leaderName);
		}
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function describeError(e) {
	if (e instanceof Error) return e.message;
	if (e && typeof e === 'object') {
		if (e.message) return e.message;
		if (e.reason) return e.reason;
		try { return JSON.stringify(e); } catch { /* fall through */ }
	}
	return String(e);
}

function teamStarter() {
	if (!CONFIG.characterStarter.enabled) return;

	const activeCharacters = get_active_characters();

	for (const [key, char] of Object.entries(CONFIG.characterStarter.characters)) {
		if (!activeCharacters[char.name]) {
			start_character(char.name, char.codeSlot);
		}
	}
}
setInterval(teamStarter, 3000);

/* What level a merchant must be before mluck exists for it at all. Read from
   the game's own skill table rather than written down here: a number this file
   remembers is a number that can disagree with the game later. */
function mluckLevelRequired() {
	try {
		const lvl = parent?.G?.skills?.mluck?.level;
		if (typeof lvl === 'number' && isFinite(lvl)) return lvl;
	} catch (e) { }
	return CONFIG.locationBroadcast.mluckLevelFallback;
}

/* Is the merchant we ping actually able to cast mluck at us?

   Three answers, not two. Absent from the party means no - nobody is coming.
   Present but below the level means no - it cannot cast the skill whatever we
   tell it. Present at an unreadable level means YES: the old behaviour is
   preserved rather than silently disabling a working feature on missing data.

   mluckState is returned rather than a bare boolean so the caller can say
   which of those it is, once, instead of going quiet for an unexplained
   reason. */
function mluckState() {
	const want = CONFIG.locationBroadcast.targetPlayer;
	const party = (typeof get_party === 'function' ? get_party() : null) || {};
	const m = party[want];
	if (!m) return { ok: false, why: `${want} is not in the party` };
	const type = m.type || m.ctype;
	if (type && type !== 'merchant') return { ok: false, why: `${want} is a ${type}, not a merchant` };
	const need = mluckLevelRequired();
	const lvl = m.level;
	if (typeof lvl !== 'number') return { ok: true, why: `${want}'s level is unreadable - assuming it can` };
	if (lvl < need) return { ok: false, why: `${want} is level ${lvl}, mluck needs ${need}` };
	return { ok: true, why: `${want} is level ${lvl}` };
}

let mluckGateNote = null;
let pickupAskedAt = 0;
let packFullSince = 0;
let reliefRunning = false;

/* Items this character is willing to part with, cheapest first.

   Sorted by what a vendor would pay, per the game's own valuation rather than
   anything this file guesses. Everything excluded below is excluded on a rule,
   not a price: an upgraded or special item represents work, a locked one was
   deliberately protected, and the named list is things whose usefulness has
   nothing to do with their vendor value. */
/* NEVER SOLD: EXCHANGEABLES (rule b) AND THE SCARCE BELTS (rule a).
   Operator's rulings 2026-10-20, in force on BOTH this character and the
   merchant. Neither existed here until v106 - the merchant had both and this
   file had neither, which is the "a warning in one script does not protect
   another" hazard with the warning on the other side.

   WHY A SEED UNIONED WITH THE DERIVED SET, rather than either alone. An
   exchangeable is one Wizard/Ponty trades for a random reward: G.items[name].e,
   which is the QUANTITY the exchange consumes and not a boolean. Deriving it
   means a game update that adds one is covered without a redeploy. But a
   DERIVED-ONLY set that reads an empty or missing G.items is EMPTY, and an
   empty protection set protects nothing - silently, which is the worst shape a
   guard can fail in. So the seed is the floor and the derived half extends it;
   neither can shrink the other. Mirrored from Party/Merchant.js, whose
   measurement this seed is, and pinned against it in Tests/suite_merchantsell.js
   so the two cannot drift.

   THE CACHE IS ONLY TAKEN ONCE THE DERIVED HALF READ SOMETHING. Caching a
   failed read would freeze the seed-only gap in for the whole session.

   THIS GUARD OUTRANKS CONFIG.selling.whitelist AND CHANGES ONE NAME'S
   BEHAVIOUR. `lostearring` is on that whitelist and carries e=1, so sellItems()
   vendored it on sight; it is now kept. That list is the operator's and is
   closed, so this is NOT an edit to it - rule (b) simply outranks it, exactly
   as the same guard outranks gem0 and seashell on the merchant's whitelist.
   The operator can overrule by name if that sale was wanted.

   THE BELTS ARE NAMED EXPLICITLY AND NOT DERIVED FROM ANY GEAR TABLE, because
   on the merchant that is precisely how the protection was silently repealed:
   dexbelt was covered by a tier-2/3 lookup until windbelt took the ranger belt
   slot, and a GEAR_PROGRESSION edit withdrew a sell guard with nothing failing
   and nothing logging. A name cannot be withdrawn by a goal edit.
   -> CLAUDE.md "Selling, banking and what must never be vendored" */
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
	if (out.size > EXCHANGEABLE_SEED.length) exchangeableCache = out;
	return out;
}
function isExchangeable(name) { return !!name && exchangeableNames().has(String(name)); }

/* Scarce enough that losing one is a real loss, at ANY level. Relief already
   refuses level > 0, but sellItems() applies no level check at all, so a
   whitelisted belt would go whatever its level - and the merchant's exposure
   was exactly a dexbelt+2, the windbelt craft input. */
/* cave_amber and cave_loaded_die since v137 - operator's ruling 2026-10-24.
   The cave is run for Loaded Dice, and Amber is what one is made from. Amber
   vendors for 120, so it sorts FIRST in relief's cheapest-first list. */
/* snakeoil since v138 - it is the only Hop Sickness cure, and relief sold it
   early at ~120. */
/* sbelt since v142 - operator, 2026-10-24. The Belt of Hallowed Trials is a
   rare drop the merchant already keeps twice over (Ponty buy list, priest gear
   goal), and the ranger named it nowhere - a third copy was muled to Dexon. */
const SCARCE_ITEM_NAMES = new Set(['dexbelt', 'intbelt', 'cave_amber', 'cave_loaded_die', 'snakeoil', 'sbelt']);
function isScarceItem(name) { return !!name && SCARCE_ITEM_NAMES.has(String(name)); }

/* THE TRICK-OR-TREAT COSTUMES, AND THE SLOT IS NOT A CHOICE WE GET TO MAKE.
   `trick_or_treat_settle` reads `player.slots.helmet` and asks whether the
   name is in `G.events.trickortreat.costumes`, so the costume must be EQUIPPED
   and all three - phelmet, gphelmet, horsemanpumpkin - are `"type":"helmet"`.
   It is worth 85% treat against 70% bare.
   ONLY horsemanpumpkin IS KEPT - the operator's narrowing, 2026-10-23: phelmet
   and gphelmet are plentiful and deliberately left sellable. horsemanpumpkin
   is named because sort order is not a guard: `reliefSellable()` sorts
   ASCENDING by `calculate_item_value` and refuses only `level > 0`, and its
   +0 value of 2,880,000 merely puts it near the bottom of that list.
   `calculate_item_value` is what an NPC pays (60% of G's `g` at +0), so G's
   4,800,000 is not a vendor price; measured live, phelmet+0 is 43,200 and
   gphelmet+0 19,200.
   SEPARATE FROM SCARCE_ITEM_NAMES on purpose: that set means "not plentiful"
   and this one means "the event wants it worn". One set read by two rules for
   two reasons is the hazard this file already records against `alwaysAttack`
   and `pontyWanted`. */
const COSTUME_ITEM_NAMES = new Set(['horsemanpumpkin']);
function isCostumeItem(name) { return !!name && COSTUME_ITEM_NAMES.has(String(name)); }

/* WITCH'S CIPHER INGREDIENTS - operator's ruling 2026-10-23: never sold.
   They drop ONLY during the first 20 minutes of a cipher round
   (`witch_cipher_loot(on)` adds the drop rows at round start and strips them
   at gather end), each mix consumes five, and an account gets five mixes a
   UTC day - so a stack sold is a stack that cannot be re-farmed until the
   next round. g 1200 each, which is inside what relief reaches. */
const CIPHER_INGREDIENT_NAMES = new Set(['verdantspore', 'frostscale', 'embercoal', 'gloomfeather']);
function isCipherIngredient(name) { return !!name && CIPHER_INGREDIENT_NAMES.has(String(name)); }

function reliefSellable() {
	const cfg = CONFIG.inventoryRelief;
	const out = [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (!it || !it.name) continue;
		if (cfg.neverSell.has(it.name)) continue;
		if (isExchangeable(it.name)) continue;      // rule (b) - never sold at any price
		if (isScarceItem(it.name)) continue;        // rule (a) - dexbelt / intbelt
		if (isCostumeItem(it.name)) continue;       // worn for trick-or-treat
		if (isCipherIngredient(it.name)) continue;  // Witch's Cipher input
		if (it.l === 'l') continue;                 // locked by hand
		if (it.p) continue;                         // special / shiny
		if ((it.level || 0) > 0) continue;          // upgraded: someone paid for that
		let value = null;
		try { value = parent.calculate_item_value(it); } catch (e) { }
		out.push({ slot: i, name: it.name, q: it.q || 1, value: (typeof value === 'number' && isFinite(value)) ? value : 0 });
	}
	out.sort((a, b) => a.value - b.value);
	return out;
}

function freeSlots() {
	return character.items.filter((it) => it === null).length;
}

/* No mule is coming and the pack is full. Sell the cheapest junk until there
   is room, then carry on. Runs once at a time and always clears its own flag,
   because a fighter stuck in a sell that threw would simply stop fighting. */
async function runInventoryRelief() {
	const cfg = CONFIG.inventoryRelief;
	if (reliefRunning) return;
	if (totBusy) return;   // a knock route owns movement -> TRICK OR TREAT
	reliefRunning = true;
	state.sellingOff = true;
	try {
		const want = cfg.targetFreeSlots;
		let sellable = reliefSellable();
		if (!sellable.length) {
			game_log(`Pack full, no mule, and nothing safe to sell - carrying on full`, 'red');
			return;
		}
		game_log(`No mule reachable - selling junk for ${want} free slots`, '#FFD700');
		try {
			await smart_move({ map: cfg.vendor.map, x: cfg.vendor.x, y: cfg.vendor.y });
		} catch (e) {
			game_log(`Could not reach the vendor: ${e?.reason || e}`, 'red');
			return;
		}
		let sold = 0;
		for (const item of sellable) {
			if (freeSlots() >= want) break;
			// Re-read the slot: selling shifts nothing, but a mule pickup or a
			// death could have emptied it since the list was built.
			const live = character.items[item.slot];
			if (!live || live.name !== item.name) continue;
			try {
				await sell(item.slot, live.q || 1);
				sold++;
				await new Promise((r) => setTimeout(r, 250));
			} catch (e) {
				game_log(`sell failed for ${item.name}: ${e?.reason || e}`, 'orange');
			}
		}
		game_log(`Sold ${sold} stack(s); ${freeSlots()} slots free`, sold ? '#7FD98A' : 'orange');
	} catch (e) {
		console.error('inventory relief failed:', e);
	} finally {
		state.sellingOff = false;
		reliefRunning = false;
		packFullSince = 0;      // whatever happened, start the clock again
	}
}

async function sendLocationUpdate() {
	if (!CONFIG.locationBroadcast.enabled) return;

	try {
		// Gated on the merchant being able to cast it. Without this the
		// condition below is permanently true whenever mluck is out of reach -
		// an unreachable state, not a transient one - and this fired a location
		// ping every second forever, asking for a buff nobody could give.
		const gate = mluckState();
		const mluckLive = !!(character.s.mluck
			&& character.s.mluck.f === CONFIG.locationBroadcast.targetPlayer);
		const needsUpdate = gate.ok && !mluckLive;

		/* Keyed off the DECISION, not the gate. gate.ok only says the merchant COULD
		   cast it, so the old line printed "requesting" for the whole hour a fresh
		   buff was running - and on 2026-09-28 that cost a wrong diagnosis, because
		   the log said "requesting" while the merchant was seen travelling and the
		   two looked like one event when neither was the request. The note now names
		   which of the two reasons applies, and the throttle compares the whole note
		   rather than gate.why, so a buff expiring still prints. */
		const gateNote = needsUpdate
			? `requesting: ${gate.why}`
			: mluckLive
				? `not requesting: mluck is live from ${character.s.mluck.f}`
				: `not requesting: ${gate.why}`;
		if (gateNote !== mluckGateNote) {
			mluckGateNote = gateNote;
			game_log(`[mluck] ${gateNote}`, needsUpdate ? '#7FD98A' : '#8b98ab');
		}
		const nullCount = character.items.filter(item => item === null).length;

		// The inventory branch is deliberately outside the mluck gate: a full
		// pack needs the mule whether or not anyone can buff us.
		const target = CONFIG.locationBroadcast.targetPlayer;
		const lowInv = nullCount <= CONFIG.locationBroadcast.lowInventorySlots;
		const now = Date.now();

		if (!lowInv) packFullSince = 0;
		else if (!packFullSince) packFullSince = now;

		let askPickup = false;
		if (lowInv) {
			const reach = merchantReach(target);
			if (reach.ok) {
				// Reachable: ask, at most once per cooldown. Whichever channel
				// carries it, the message gets there.
				askPickup = now - pickupAskedAt >= CONFIG.locationBroadcast.pickupCooldownMs;
				if (askPickup) pickupAskedAt = now;
			} else if (CONFIG.inventoryRelief.enabled
				&& !reliefRunning
				&& now - packFullSince >= CONFIG.inventoryRelief.graceMs) {
				// Not reachable by either channel, and long enough that a mule
				// mid-hop would have arrived. Free the slots ourselves rather
				// than stand there full.
				runInventoryRelief();
			}
		}

		if (needsUpdate || askPickup) {
			/* needsMluck carries the INTENT, and it is the whole point of v62.
			   -> RangerComments.md#needsmluck-carries-the-intent-and-it-is */
			plSend(target, {
				message: 'location',
				needsMluck: needsUpdate,
				x: character.x,
				y: character.y,
				map: character.map
			});
		}

		if (askPickup) {
			plSend(target, {
				message: 'inventory_almost_full',
				emptySlots: nullCount,
				x: character.x,
				y: character.y,
				map: character.map
			});
		}
	} catch (error) {
		console.error('Failed to send location update:', error);
	}
}
setInterval(sendLocationUpdate, CONFIG.locationBroadcast.checkInterval);

const SELL_WHITELIST = new Set(CONFIG.selling.whitelist);
function sellItems() {
	if (!CONFIG.selling.enabled) return;
	if (totBusy) return;   // the swapped-out helmet is in the bag -> TRICK OR TREAT
	if (!sellerInReach()) return;   // the whitelist waits for a merchant npc - sellerInReach()
	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (!item || !SELL_WHITELIST.has(item.name)) continue;
		if (item.p !== undefined || item.l === 'l') continue;
		/* THE WHITELIST IS NOT THE LAST WORD. lostearring is on it and is
		   exchangeable; these two guards outrank it. */
		if (isExchangeable(item.name)) continue;
		if (isScarceItem(item.name)) continue;
		if (isCostumeItem(item.name)) continue;
		if (isCipherIngredient(item.name)) continue;
		sell(i);
	}
}

async function upgradeItems() {
	if (!CONFIG.upgrading.enabled) return;

	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (!item || item.p || !CONFIG.upgrading.whitelist[item.name]) continue;

		const config = CONFIG.upgrading.whitelist[item.name];
		if (item.level >= config.targetLevel) continue;

		const grades = G.items[item.name].grades;
		let scrollname;

		if (item.level < grades[0]) scrollname = 'scroll0';
		else if (item.level < grades[1]) scrollname = 'scroll1';
		else scrollname = 'scroll2';

		const scrollSlot = locate_item(scrollname);
		if (scrollSlot === -1) {
			buyWhereSold(scrollname, 1, 'upgrade');
			return;
		}

		let offeringSlot = null;
		if (item.level >= config.prim) {
			offeringSlot = locate_item('offering');
		} else if (item.level >= config.primling) {
			offeringSlot = locate_item('offeringp');
		}

		if (character.q.upgrade === undefined) {
			try {
				await upgrade(i, scrollSlot, offeringSlot);
			} catch (e) {
				console.error('Upgrade failed:', e);
			}
		}
		return;
	}
}

async function combineItems() {
	if (!CONFIG.combining.enabled) return;

	const toCompound = new Map();

	for (let i = 0; i < character.items.length; i++) {
		const item = character.items[i];
		if (!item || !CONFIG.combining.whitelist[item.name]) continue;

		const config = CONFIG.combining.whitelist[item.name];
		if (item.level >= config.targetLevel) continue;

		const key = item.name + item.level;
		const grade = item_grade(item);

		if (!toCompound.has(key)) {
			toCompound.set(key, [item.level, grade, i]);
		} else {
			toCompound.get(key).push(i);
		}
	}

	for (const group of toCompound.values()) {
		const itemLevel = group[0];
		const grade = group[1];
		const scrollName = 'cscroll' + grade;

		for (let i = 2; i + 2 < group.length; i += 3) {
			const scrollSlot = locate_item(scrollName);
			if (scrollSlot === -1) {
				buyWhereSold(scrollName, 1, 'compound');
				return;
			}

			const item = character.items[group[i]];
			const config = CONFIG.combining.whitelist[item.name];

			let offeringSlot = null;
			if (itemLevel >= config.prim) {
				offeringSlot = locate_item('offering');
			} else if (itemLevel >= config.primling) {
				offeringSlot = locate_item('offeringp');
			}

			if (character.q.compound === undefined) {
				try {
					await compound(group[i], group[i + 1], group[i + 2], scrollSlot, offeringSlot);
				} catch (e) {
					console.error('Compound failed:', e);
				}
			}
			return;
		}
	}
}

function pingButton() {
	add_top_button('Ping', (character.ping ?? 0).toFixed(0));
}
setInterval(pingButton, 1000);

function topButtons() {
	/* Was gated on parent.S.lunarnewyear, which was right while the hunter
	   only knew about dragold - he spawns in that event and nowhere else. The
	   target list now spans seven bosses with unrelated calendars, so the
	   gate is the feature's own switch. */
	if (CONFIG.bossHop.enabled) {
		/* The probe is the only thing that can turn "the source says a sick
		   character can walk in and still earn credit" into something
		   observed. Each row is one walk-in-sick episode. */
		add_top_button('ShowTaxiProbe', '🚶', () => {
			const rows = taxiProbeRead();
			if (!rows.length) {
				game_log('taxi probe: no walk-in-sick episodes recorded yet', '#8b98ab');
				return { episodes: 0 };
			}
			const out = rows.map(r => ({
				boss: r.name,
				shard: r.shard,
				walked: r.walkedAt ? new Date(r.walkedAt).toISOString().slice(11, 19) : null,
				sickMinAtWalk: r.sickMsAtWalk != null ? +(r.sickMsAtWalk / 60000).toFixed(1) : null,
				presentAtDeath: !!r.presentAtDeath,
				dwellSec: r.dwellSec != null ? r.dwellSec : null,
				sickThroughout: r.sickThroughout === true,
				open: !r.closed,
			}));
			const closed = out.filter(r => !r.open);
			const present = closed.filter(r => r.presentAtDeath).length;
			game_log(`taxi probe: ${out.length} episode(s), ${closed.length} closed, `
				+ `${present} present at death`, '#FFD700');
			/* The sick-throughout rows are the ones that prove the point: a
			   death we attended while the sickness never cleared. */
			const proof = closed.filter(r => r.presentAtDeath && r.sickThroughout).length;
			game_log(`  ${proof} of those were still hop-sick at the kill`,
				proof ? '#7FD98A' : '#8b98ab');
			return { episodes: out.length, closed: closed.length, presentAtDeath: present, sickAtKill: proof, rows: out };
		});

		add_top_button('ShowBossHop', '🐉', () => {
			const now = Date.now();
			const c = CONFIG.bossHop;
			const hopsick = bossHop.isHopsick();
			const arriveSec = (c.hopLatencyMs + c.safetyMarginMs) / 1000;
			const info = {
				state: bossHop.state,
				targetShard: bossHop.targetShard,
				targetType: bossHop.targetType,
				currentShard: bossHop.currentShard(),
				localTarget: bossHop.localTarget(),
				/* Hop Sickness is the 5x on every requiredDwellSec below, so
				   it belongs on screen next to them. */
				hopsick,
				arriveSec: Math.round(arriveSec),
				/* Sorted the way the picker sorts, so the top ELIGIBLE row is
				   the next hop. A rejected row has to say WHY, because with a
				   per-boss gate the reason stopped being guessable - one
				   75-second number no longer explains every rejection. */
				candidates: bossHop.candidates()
					.sort((a, b) => a.secsToDeath - b.secsToDeath || a.kills_to_rung - b.kills_to_rung)
					.map(x => {
						const k = bossHop.contributors(x.shard, x.mtype);
						const need = bossHop.requiredDwellSec(x.maxHp, k, hopsick, x.mtype);
						const outlasts = !x.live || x.secsToDeath >= arriveSec;
						const remaining = x.live ? x.secsToDeath - arriveSec : x.secsToDeath;
						return {
							shard: x.shard,
							mtype: x.mtype,
							live: x.live,
							hp: Math.round(x.hp),
							maxHp: Math.round(x.maxHp),
							dps: Math.round(bossHop.shardDps(x.shard, x.mtype)),
							dpsSource: bossHop.bridgeRow(x.shard, x.mtype)?.dps > 0 ? 'bridge' : 'fallback',
							contributors: k,
							secsToDeath: Math.round(x.secsToDeath),
							remainingSec: Math.round(remaining),
							requiredDwellSec: Math.round(need * 100) / 100,
							eligible: outlasts && remaining >= need,
							rejectedBecause: !outlasts ? 'dies before we land'
								: (remaining < need ? 'not enough fight left to earn a share' : null),
							kills_to_rung: x.kills_to_rung,
						};
					}),
				scanResults: bossHop.scanResults
					.slice()
					.sort((a, b) => (a.spawnTime ?? 0) - (b.spawnTime ?? 0))
					.map(r => ({
						shard: r.shard,
						mtype: r.mtype,
						live: r.live,
						hp: r.hp,
						spawnTime: r.spawnTime ? new Date(r.spawnTime).toLocaleString() : null
					}))
			};
			show_json(info);
		});
	}

	add_top_button('Return', 'R&M', () => {
		plSend(['FatherToken', 'MageofOz'], {
			message: 'location',
			x: character.x,
			y: character.y,
			map: character.map
		});
	});

	add_top_button('showLoot', '💼', displayLoot);

	/* Freezes the graphics (parent.pause() is a renderer toggle - the character
	   keeps playing) and arms teamStarter, which restarts any of the three
	   teammates that isn't running, rechecking every 3s.

	   There is deliberately no matching off-switch button. The old one paired
	   this with stop_character('Meltymerch'), which removes that character's
	   iframe outright: a hard kill with no on_destroy, taking the merchant
	   offline and losing whatever was in state.queue unless a hop had happened
	   to persist it. Disarming is not worth that - CONFIG is module scope, so
	   reloading Dexon (or any change_server hop) already resets enabled to
	   false. */
	add_top_button('Pause2', '⏸️', () => {
		pause();
		CONFIG.characterStarter.enabled = true
	});
}
topButtons();
function displayLoot() {
	const savedLoot = get('lootItems' + new Date().toLocaleString('en', { month: 'long' })) || {};
	const sortedLoot = Object.fromEntries(Object.keys(savedLoot).sort().map(k => [k, savedLoot[k]]));
	console.log("Saved Loot (Sorted):", sortedLoot);
	show_json(sortedLoot);
}

function get_nearest_monster_v2(args = {}) {
	let min_d = 999999;
	let target = null;
	let optimal_hp = args.check_max_hp ? 0 : 999999999;

	for (let id in parent.entities) {
		let current = parent.entities[id];
		if (current.type !== 'monster' || !current.visible || current.dead) continue;

		if (args.type) {
			if (Array.isArray(args.type)) {
				if (!args.type.includes(current.mtype)) continue;
			} else {
				if (current.mtype !== args.type) continue;
			}
		}

		if (args.min_level !== undefined && current.level < args.min_level) continue;
		if (args.max_level !== undefined && current.level > args.max_level) continue;
		if (args.target && !args.target.includes(current.target)) continue;
		if (args.no_target && current.target && current.target !== character.name) continue;

		if (args.statusEffects && !args.statusEffects.every(effect => current.s[effect])) continue;

		if (args.min_xp !== undefined && current.xp < args.min_xp) continue;
		if (args.max_xp !== undefined && current.xp > args.max_xp) continue;

		if (args.max_att !== undefined && current.attack > args.max_att) continue;

		if (args.path_check && !can_move_to(current)) continue;

		let c_dist = args.point_for_distance_check
			? Math.hypot(args.point_for_distance_check[0] - current.x, args.point_for_distance_check[1] - current.y)
			: parent.distance(character, current);

		if (args.max_distance !== undefined && c_dist > args.max_distance) continue;

		if (args.check_min_hp || args.check_max_hp) {
			let c_hp = current.hp;
			if ((args.check_min_hp && c_hp < optimal_hp) || (args.check_max_hp && c_hp > optimal_hp)) {
				optimal_hp = c_hp;
				target = current;
			}
			continue;
		}

		if (c_dist < min_d) {
			min_d = c_dist;
			target = current;
		}
	}

	return target;
}

function ms_to_next_skill(skill) {
	const next_skill = parent.next_skill[skill];
	if (next_skill === undefined || next_skill === null) return 0;

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

state.skinReady = true;

const FARM_SEARCH = {
	reevaluateIntervalMs: 15 * 60 * 1000,
	mitigationConstant: 900,        // fallback only; defenseMultiplier() prefers the game's damage_multiplier
	avgDeathDowntimeSec: 45,
	minUptimeFraction: 0.5,
	maxConcurrentAttackers: 4,
	goldToXpRatioGuess: 0.05,
	minGoldMarginRatio: 1.2,
	maxViableHp: 50000000,
	xpLossPerDeathFraction: 0.03,
};

const partyDpsReports = {
	FatherToken: { type: 'magical', dps: 0, maxHp: 0, level: 0, receivedAt: 0 },
	MageofOz: { type: 'magical', dps: 0, maxHp: 0, level: 0, receivedAt: 0 },
};

const economicsTracker = {
	lastGold: character.gold,
	lastCheckTime: Date.now(),
};

const ARRIVAL_RADIUS = 100;

const arrivalState = {
	assignedAt: null,
	reachedAt: null,
	reported: false,
};

function hasReachedFarmSpot() {
	if (!destination || character.map !== mobMap) return false;
	return distance(character, destination) < ARRIVAL_RADIUS;
}

const BLACKLIST_STORAGE_KEY = 'farm_spot_blacklist';

// ============================================================================
// CODED LISTS - the two verdicts the auto-blacklist is not allowed to make
// ============================================================================
// The unreachable heuristic further down (3 minutes without arriving -> blacklist
// forever) has been firing on spots that are perfectly fine to farm, and nothing
// ever expires, so it ratchets: ~55 spots are blacklisted already, nearly all of
// them "stuck 180s without arriving" at exactly 180-second intervals - i.e. the
// timeout fired, the next spot was picked, that one timed out too, and so on down
// the list. Run long enough it blacklists everything and the party farms nothing.
//
// These two lists bound it from both ends. They are a floor under the damage,
// not the fix - see the TASK note below them.

// Never blacklisted, whatever Dexon or the healers report. An incoming report
// naming one of these is refused, AND any entry already sitting in storage is
// dropped on the next read - so the three spots the ratchet already ate come
// back on their own, without the user clearing anything by hand.
const PERMANENT_WHITELIST = new Set([
	'crab@main',
	'arcticbee@winterland',
	'snake@main',
]);

// Never scored as a candidate at all. Cheaper than blacklisting them (they
// never reach the UI list, never become the auto pick, never become a manual
// override) and it cannot be undone by removeFromBlacklist() the way a stored
// entry can - to change it, edit this list.
const PERMANENT_BLACKLIST = new Set([
	//testing if no longer needed as characters have advanced significantly since this was implmented
	//'gscorpion@desertland',
	'mrpumpkin@halloween',//boss not valid farm
	'mrgreen@spookytown',//boss not valid farm
	//'mummy@level3',
	//'mummy@level4',
]);

// TASK - come back to this. The lists above are a stopgap; the real bug is the
// reachability verdict in checkFarmEconomics(). Two halves to it:
//   1. Why does smart_move keep failing to arrive? Candidates: doors/instances
//      the router won't cross, a spot whose boundary midpoint sits inside
//      geometry, or ARRIVAL_RADIUS (100) being tighter than where smart_move
//      actually stops - in which case Dexon IS there and is blacklisting the
//      spot he is standing in.
//   2. Whatever the cause, the verdict must stop being permanent and absolute:
//      expire entries after a while, require N failures rather than one, and
//      record how close he actually got so a near-miss is told apart from a
//      spot the router genuinely cannot reach.
// Until that is done the whitelist is the only thing guaranteeing the party has
// anywhere to farm at all.

let whitelistFallbackLogged = false;

function spotKey(home, mobMap) {
	return `${home}@${mobMap}`;
}

function isWhitelistedSpot(key) {
	return PERMANENT_WHITELIST.has(key);
}

function isPermanentlyBlacklisted(key) {
	return PERMANENT_BLACKLIST.has(key);
}

function getBlacklist() {
	const stored = scopedGetLegacy(BLACKLIST_STORAGE_KEY) || {};
	// Self-healing: a whitelisted spot blacklisted before this list existed is
	// dropped here and the pruned map written back, so it stays gone.
	let pruned = false;
	for (const key in stored) {
		if (!isWhitelistedSpot(key)) continue;
		delete stored[key];
		pruned = true;
	}
	if (pruned) scopedSet(BLACKLIST_STORAGE_KEY, stored);
	return stored;
}

// Returns the key on success, or null if the spot is whitelisted and the
// report was refused. Callers must check - "nothing was blacklisted" is a
// different outcome from "blacklisted", not an error.
function addToBlacklist(home, mobMap, reason, reportedBy, details) {
	const key = spotKey(home, mobMap);
	if (isWhitelistedSpot(key)) {
		game_log(`Refused to blacklist "${key}" - permanent whitelist (was: ${reason})`, 'orange');
		return null;
	}
	const blacklist = getBlacklist();
	blacklist[key] = { reason, reportedBy, blacklistedAt: Date.now() };
	if (details) blacklist[key].details = details;
	scopedSet(BLACKLIST_STORAGE_KEY, blacklist);
	return key;
}

function removeFromBlacklist(key) {
	if (isPermanentlyBlacklisted(key)) {
		game_log(`"${key}" is on the permanent blacklist in the script - edit PERMANENT_BLACKLIST to change that`, 'orange');
		return false;
	}
	const blacklist = getBlacklist();
	if (!blacklist[key]) {
		game_log(`"${key}" isn't on the blacklist`, 'orange');
		return false;
	}
	delete blacklist[key];
	scopedSet(BLACKLIST_STORAGE_KEY, blacklist);
	game_log(`Removed "${key}" from the farm spot blacklist`, '#00FF00');
	return true;
}

function clearBlacklist() {
	const count = Object.keys(getBlacklist()).length;
	scopedSet(BLACKLIST_STORAGE_KEY, {});
	game_log(`Cleared ${count} stored blacklist entries (the coded lists are unaffected)`, '#00FF00');
	return count;
}

function listBlacklist() {
	const view = {
		permanentWhitelist: [...PERMANENT_WHITELIST],
		permanentBlacklist: [...PERMANENT_BLACKLIST],
		blacklisted: getBlacklist(),
	};
	show_json(view);
	return view;
}

function myOwnDps() {
	return (character.attack || 0) * (character.frequency || 0);
}

function getPartyDps() {
	let physical = myOwnDps();
	let magical = 0;
	for (const name in partyDpsReports) {
		const r = partyDpsReports[name];
		if (r.type === 'physical') physical += r.dps;
		else magical += r.dps;
	}
	return { physical, magical };
}

/* Damage mitigation, taken from the game rather than approximated.
   -> RangerComments.md#damage-mitigation-taken-from-the-game-rather */
let mitigationFallbackLogged = false;
function defenseMultiplier(defenseStat) {
	const d = Number.isFinite(defenseStat) ? defenseStat : 0;
	if (typeof parent !== 'undefined' && typeof parent.damage_multiplier === 'function') {
		const m = parent.damage_multiplier(d);
		if (typeof m === 'number' && isFinite(m)) return m;
	}
	if (!mitigationFallbackLogged) {
		mitigationFallbackLogged = true;
		console.error('farm scoring: parent.damage_multiplier unavailable, using the /(x+'
			+ FARM_SEARCH.mitigationConstant + ') approximation, which overestimates our damage against defense above ~400');
	}
	return 1 - (d / (d + FARM_SEARCH.mitigationConstant));
}

function mitigated(dps, defenseStat) {
	return dps * defenseMultiplier(defenseStat);
}

/* EVASION AND AVOIDANCE ARE STRAIGHT MISSES, so they scale effective dps
   the way armour scales damage - a swing that is dodged lands nothing
   at all, and the mitigation maths below has to account for it.
   -> RangerComments.md#evasion-and-avoidance-are-straight-misses-so */
function dodgeMultiplier(mobData) {
	if (!mobData) return 1;
	const ev = Math.max(0, Math.min(100, mobData.evasion || 0));
	const av = Math.max(0, Math.min(100, mobData.avoidance || 0));
	return (1 - ev / 100) * (1 - av / 100);
}

function isMapSafeForFarming(mapData) {
	if (!mapData) return false;
	if (mapData.pvp) return false;
	if (mapData.instance) return false;
	return true;
}

function estimateHealThroughput() {
	return 400 / 0.2;
}

function getTrackedPartyMembers() {
	const members = [{ name: character.name, maxHp: character.max_hp, level: character.level }];
	for (const name in partyDpsReports) {
		const r = partyDpsReports[name];
		if (r.maxHp && r.level) members.push({ name, maxHp: r.maxHp, level: r.level });
	}
	return members;
}

/* The kill-rate and survival half of a spot's score: how fast the party kills
   this spawn, and what fraction of the time it is alive to do so. Nothing here
   is about xp, which is why the cipher farm reads it too. */
function farmSpotKill(mobData, spot, dps, healThroughput, partyEffectiveHp) {
	const effPhysical = mitigated(dps.physical, mobData.armor || 0);
	const effMagical = mitigated(dps.magical, mobData.resistance || 0);
	const totalEffDps = Math.max((effPhysical + effMagical) * dodgeMultiplier(mobData), 1);

	const ttk = mobData.hp / totalEffDps;
	const rawKillRate = 1 / ttk;
	const respawn = mobData.respawn || 1;
	const sustainableKillRate = spot.count / respawn;
	const killRate = Math.min(rawKillRate, sustainableKillRate);

	const attackers = Math.min(spot.count, FARM_SEARCH.maxConcurrentAttackers);
	/* THIS IS THE RAW HIT, with none of OUR mitigation taken off it, and that
	   is a standing decision rather than an oversight.
	   -> RangerComments.md#this-is-the-raw-hit-with-none */
	const incomingDps = (mobData.attack || 0) * (mobData.frequency || 1) * attackers;
	const survivabilityMargin = healThroughput - incomingDps;

	let uptimeFraction = 1;
	if (survivabilityMargin < 0) {
		const timeToDeathSec = partyEffectiveHp / Math.abs(survivabilityMargin);
		const deathsPerHour = 3600 / timeToDeathSec;
		const downtimePerHour = deathsPerHour * FARM_SEARCH.avgDeathDowntimeSec;
		uptimeFraction = Math.max(0, (3600 - downtimePerHour) / 3600);
	}
	return { killRate, incomingDps, uptimeFraction };
}

function scoreAllFarmSpots() {
	if (!parent.G || !parent.G.maps || !parent.G.monsters) return [];

	const dps = getPartyDps();
	const healThroughput = estimateHealThroughput();
	const partyEffectiveHp = 3 * (character.max_hp || 2000);
	const blacklist = getBlacklist();

	const candidates = [];

	for (const mapName in parent.G.maps) {
		const mapData = parent.G.maps[mapName];
		if (!isMapSafeForFarming(mapData) || !mapData.monsters) continue;

		for (const spot of mapData.monsters) {
			const mobData = parent.G.monsters[spot.type];
			if (!mobData || !mobData.hp || !mobData.xp) continue;
			if (mobData.hp > FARM_SEARCH.maxViableHp) continue;
			const key = spotKey(spot.type, mapName);
			if (isPermanentlyBlacklisted(key)) continue;
			if (blacklist[key]) continue;

			const kill = farmSpotKill(mobData, spot, dps, healThroughput, partyEffectiveHp);
			const rawExpPerSecond = kill.killRate * mobData.xp;
			const incomingDps = kill.incomingDps;
			const uptimeFraction = kill.uptimeFraction;
			if (uptimeFraction < FARM_SEARCH.minUptimeFraction) continue;

			let allMembersNetPositive = true;
			for (const member of getTrackedPartyMembers()) {
				const memberMargin = healThroughput - incomingDps;
				if (memberMargin >= 0) continue;
				const memberTimeToDeathSec = member.maxHp / Math.abs(memberMargin);
				const memberDeathsPerHour = 3600 / memberTimeToDeathSec;
				const xpToNextLevel = parent.G.levels?.[member.level] || 0;
				const xpLossPerDeath = xpToNextLevel * FARM_SEARCH.xpLossPerDeathFraction;
				const memberUptimeFraction = Math.max(0, (3600 - memberDeathsPerHour * FARM_SEARCH.avgDeathDowntimeSec) / 3600);
				const memberNetXpPerSecond = (rawExpPerSecond * memberUptimeFraction) - (memberDeathsPerHour * xpLossPerDeath / 3600);
				if (memberNetXpPerSecond <= 0) { allMembersNetPositive = false; break; }
			}
			if (!allMembersNetPositive) continue;

			const adjustedExpPerSecond = rawExpPerSecond * uptimeFraction;

			const estGoldPerSecond = adjustedExpPerSecond * FARM_SEARCH.goldToXpRatioGuess;
			const estPotionCostPerSecond = incomingDps > 0 ? incomingDps * 0.002 : 0.5;
			if (estGoldPerSecond < estPotionCostPerSecond * FARM_SEARCH.minGoldMarginRatio) continue;

			if (!Array.isArray(spot.boundary) || spot.boundary.length < 4) continue;
			const [bx1, by1, bx2, by2] = spot.boundary;
			candidates.push({
				home: spot.type,
				mobMap: mapName,
				x: (bx1 + bx2) / 2,
				y: (by1 + by2) / 2,
				expPerSecond: adjustedExpPerSecond,
				uptimeFraction,
			});
		}
	}

	candidates.sort((a, b) => b.expPerSecond - a.expPerSecond);
	if (candidates.length) {
		whitelistFallbackLogged = false;
		return candidates;
	}

	// Nothing survived scoring. Rather than stand still, fall back to the
	// whitelisted spots unscored - they are hand-picked, so "is it worth it"
	// is already answered. Only reachable from here, so it changes nothing
	// whenever the normal path produces even one candidate.
	const fallback = whitelistFallbackCandidates();
	if (fallback.length && !whitelistFallbackLogged) {
		whitelistFallbackLogged = true;
		game_log(`No spot passed scoring - falling back to the ${fallback.length} whitelisted spot(s)`, 'orange');
	}
	return fallback;
}

function whitelistFallbackCandidates() {
	if (!parent.G || !parent.G.maps) return [];
	const out = [];
	for (const mapName in parent.G.maps) {
		const mapData = parent.G.maps[mapName];
		if (!mapData || !mapData.monsters) continue;
		for (const spot of mapData.monsters) {
			if (!isWhitelistedSpot(spotKey(spot.type, mapName))) continue;
			if (!Array.isArray(spot.boundary) || spot.boundary.length < 4) continue;
			const [bx1, by1, bx2, by2] = spot.boundary;
			out.push({
				home: spot.type,
				mobMap: mapName,
				x: (bx1 + bx2) / 2,
				y: (by1 + by2) / 2,
				expPerSecond: 0,
				uptimeFraction: 1,
				whitelistFallback: true,
			});
		}
	}
	return out;
}


let manualOverride = null;
let lastCandidates = [];

function runFarmSearch() {
	try {
		lastCandidates = scoreAllFarmSpots();
		const result = manualOverride || lastCandidates[0];

		if (!result) {
			game_log('Farm search found no viable candidates (waiting on DPS reports or game data)', 'red');
			updateFarmUI();
			return;
		}
		const changed = home !== result.home || mobMap !== result.mobMap;
		home = result.home;
		mobMap = result.mobMap;
		/* An anchor, where one is configured, replaces the spawn-boundary centre.
		   Standing in the middle of the spawn is what makes 24-lane surrounds
		   possible; see CONFIG.movement.anchors. */
		const anchor = (CONFIG.movement.anchors || {})[spotKey(result.home, result.mobMap)];
		destination = anchor
			? { map: result.mobMap, x: anchor.x, y: anchor.y }
			: { map: result.mobMap, x: result.x, y: result.y };
		if (changed) {
			const tag = manualOverride ? '(manual override)' : '(auto)';
			game_log(
				`Farm spot ${tag}: ${home} @ ${mobMap} (~${result.expPerSecond.toFixed(1)} xp/s, ${(result.uptimeFraction * 100).toFixed(0)}% uptime)`,
				'#00FF00'
			);
			arrivalState.assignedAt = Date.now();
			arrivalState.reachedAt = null;
			arrivalState.reported = false;
			noteTravelTarget(destination);
		}
		sendFarmSpot();
		updateFarmUI();
	} catch (e) {
		console.error('runFarmSearch error:', e);
	}
}

/* FEAR INSTRUMENTATION - observation only. Nothing branches on any of this.
   -> RangerComments.md#fear-instrumentation-observation-only-nothing-branches-on */
const FEAR_STORE = 'fear_log';
const fearWatch = { lastSample: Date.now(), fearedMs: 0, windowMs: 0, peak: 0, recent: [] };

function fearAttackerCount() {
	let n = 0;
	for (const id in parent.entities) {
		const e = parent.entities[id];
		if (e && e.type === 'monster' && e.target === character.name) n++;
	}
	return n;
}

function sampleFear() {
	const now = Date.now();
	const dt = now - fearWatch.lastSample;
	fearWatch.lastSample = now;
	/* A throttled tab or a reload leaves a gap that is not observed time.
	   Counting it would inflate both numerator and denominator with fiction. */
	if (dt <= 0 || dt > 5000) return;
	fearWatch.windowMs += dt;
	if (character.fear > 0) fearWatch.fearedMs += dt;
	const n = fearAttackerCount();
	if (n > fearWatch.peak) fearWatch.peak = n;
}

function flushFearWindow(key) {
	const windowMs = fearWatch.windowMs;
	const fearedMs = fearWatch.fearedMs;
	const peak = fearWatch.peak;
	fearWatch.windowMs = 0; fearWatch.fearedMs = 0; fearWatch.peak = 0;
	if (windowMs <= 0) return null;

	const pct = Math.round((fearedMs / windowMs) * 100);
	fearWatch.recent.push({ pct, sec: Math.round(fearedMs / 1000), peak });
	if (fearWatch.recent.length > 6) fearWatch.recent.shift();

	try {
		const log = scopedGetLegacy(FEAR_STORE) || { since: Date.now(), bySpot: {} };
		const row = log.bySpot[key] || { observedMs: 0, fearedMs: 0, peak: 0, windows: 0, abandons: 0 };
		row.observedMs += windowMs;
		row.fearedMs += fearedMs;
		row.windows += 1;
		if (peak > row.peak) row.peak = peak;
		log.bySpot[key] = row;
		scopedSet(FEAR_STORE, log);
	} catch (e) { /* storage is best effort; the live numbers still log */ }

	return { pct, sec: Math.round(fearedMs / 1000), peak };
}

function noteFearAbandon(key) {
	try {
		const log = scopedGetLegacy(FEAR_STORE) || { since: Date.now(), bySpot: {} };
		const row = log.bySpot[key] || { observedMs: 0, fearedMs: 0, peak: 0, windows: 0, abandons: 0 };
		row.abandons = (row.abandons || 0) + 1;
		log.bySpot[key] = row;
		scopedSet(FEAR_STORE, log);
	} catch (e) { /* as above */ }
}

function fearRecentSummary() {
	if (!fearWatch.recent.length) return 'no fear samples yet';
	const sec = fearWatch.recent.reduce((a, r) => a + r.sec, 0);
	const peak = Math.max(...fearWatch.recent.map((r) => r.peak));
	return `feared ${sec}s over the last ${fearWatch.recent.length} window(s), peak ${peak} attacker(s), courage ${character.courage}`;
}

/* Console helper. The whole point of the exercise - read this after a few
   hours of farming and the fear-versus-spot question answers itself. */
function farmFearReport() {
	const log = scopedGetLegacy(FEAR_STORE);
	if (!log || !log.bySpot || !Object.keys(log.bySpot).length) {
		game_log('fear report: nothing recorded yet', 'orange');
		return null;
	}
	const rows = Object.entries(log.bySpot).map(([key, r]) => ({
		spot: key,
		minutes: +(r.observedMs / 60000).toFixed(1),
		fearedPct: r.observedMs ? +((r.fearedMs / r.observedMs) * 100).toFixed(1) : 0,
		fearedMin: +(r.fearedMs / 60000).toFixed(1),
		peakAttackers: r.peak,
		abandons: r.abandons || 0,
	})).sort((a, b) => b.fearedPct - a.fearedPct);
	game_log(`fear report: ${rows.length} spot(s) since ${new Date(log.since).toLocaleString()}`, '#7FD98A');
	return show_json({ courage: character.courage, mcourage: character.mcourage, pcourage: character.pcourage, spots: rows });
}

function clearFearReport() { scopedSet(FEAR_STORE, { since: Date.now(), bySpot: {} }); game_log('fear report cleared', 'orange'); }

setInterval(sampleFear, 1000);

function checkFarmEconomics() {
	if (!home || !mobMap) return;

	if (!hasReachedFarmSpot()) {
		economicsTracker.lastGold = character.gold;
		economicsTracker.lastCheckTime = Date.now();
		economicsTracker.consecutiveBadSamples = 0;

		// The verdict runs on failed travel ATTEMPTS, not on elapsed time. This
		// loop is independent of the one that travels, so a clock here measures
		// shard hops, live events, potion runs and vendor trips just as happily
		// as it measures a bad route - which is how the blacklist ate ~55 spots
		// at exactly 180-second intervals without ever calling smart_move.
		noteTravelTarget(destination);
		travelWatchdog(destination);

		/* THE RELEASE VALVE, and it sits above the breaker deliberately.
		   The breaker below BLACKLISTS a spot it cannot route to, and achvApply
		   deliberately whitelists the achievement spot so that cannot happen -
		   which left "whitelisted, so staying put and still trying" as the only
		   outcome, and arrivalState.reported makes that log ONCE. Measured
		   2026-10-09: 41 consecutive failures standing on spookytown's (0,0)
		   spawn, with nothing in the script noticing. The whitelist is right;
		   what was missing is a way to give up on the OVERRIDE rather than on
		   the spot. This is checked every tick, not once, because `reported`
		   latches. */
		if (typeof achvIsOurs === 'function' && achvIsOurs()
			&& travelState.failures >= ((CONFIG.achievements && CONFIG.achievements.maxTravelFailures) || 10)) {
			achvLog('cannot route to ' + home + '@' + mobMap + ' after ' + travelState.failures
				+ ' attempts (' + travelFailureDetail() + ') - releasing the spot to the scorer and standing the '
				+ 'queue down. achvResume() to pick it up again.', 'red');
			achvPaused = true;
			rageAlso = [];
			manualOverride = null;
			travelArrived();                      // clear the counter for the next spot
			try { runFarmSearch(); } catch (e) { }
			return;
		}

		/* ...and never while the monsters we were sent for are right here. A
		   radius can be mistuned; this cannot. -> travelAtDestination */
		if (!arrivalState.reported && travelState.failures >= TRAVEL.maxAttempts
			&& !get_nearest_monster({ type: home })) {
			arrivalState.reported = true;
			const detail = travelFailureDetail();
			if (isWhitelistedSpot(spotKey(home, mobMap))) {
				// Whitelisted: keep walking. handleReturnHome() re-issues travelTo()
				// whenever nothing is in flight, so staying here means "keep
				// trying", not "give up". reported stays true so this logs once
				// instead of every tick.
				game_log(`Can't route to ${home}@${mobMap} (${detail}) - whitelisted, so staying put and still trying`, 'orange');
				return;
			}
			const assignedSec = arrivalState.assignedAt ? Math.round((Date.now() - arrivalState.assignedAt) / 1000) : null;
			game_log(`Can't route to ${home}@${mobMap} (${detail}) - blacklisting as unreachable`, 'red');
			addToBlacklist(home, mobMap, `Dexon couldn't route here - ${detail}`, 'Dexon', {
				attempts: travelState.failures,
				lastError: travelState.lastError,
				stoppedAt: travelState.lastDistance,
				assignedSecAgo: assignedSec,
			});
			runFarmSearch();
		}
		return;
	}

	if (arrivalState.reachedAt === null) {
		arrivalState.reachedAt = Date.now();
		travelArrived();
		economicsTracker.lastGold = character.gold;
		economicsTracker.lastCheckTime = Date.now();
		economicsTracker.consecutiveBadSamples = 0;
		return;
	}
	if (farmVerdictHeld()) {   // a boss near the spot is not the spot - see farmVerdictHeld
		economicsTracker.lastGold = character.gold;
		economicsTracker.lastCheckTime = Date.now();
		economicsTracker.consecutiveBadSamples = 0;
		return;
	}

	const now = Date.now();
	const elapsedSec = (now - economicsTracker.lastCheckTime) / 1000;
	if (elapsedSec < 60) return;

	const goldGained = character.gold - economicsTracker.lastGold;
	const goldPerSecond = goldGained / elapsedSec;

	const spot = spotKey(home, mobMap);
	const fear = flushFearWindow(spot);

	if (goldPerSecond <= 0) {
		economicsTracker.consecutiveBadSamples = (economicsTracker.consecutiveBadSamples || 0) + 1;
		/* Say whether fear was present rather than blaming the spot silently.
		   This only annotates the verdict - the verdict itself is unchanged. */
		if (fear && fear.pct > 0) {
			game_log(`No net gold this minute, and ${fear.pct}% of it was spent feared (peak ${fear.peak} attackers)`, 'orange');
		}
		if (economicsTracker.consecutiveBadSamples >= 3) {
			noteFearAbandon(spot);
			game_log(`Current farm spot shows no net gold gain for ${economicsTracker.consecutiveBadSamples} consecutive minutes (${fearRecentSummary()}) - re-evaluating`, 'red');
			runFarmSearch();
			economicsTracker.consecutiveBadSamples = 0;
		}
	} else {
		economicsTracker.consecutiveBadSamples = 0;
	}

	economicsTracker.lastGold = character.gold;
	economicsTracker.lastCheckTime = now;
}

setTimeout(runFarmSearch, 8000);
setInterval(runFarmSearch, FARM_SEARCH.reevaluateIntervalMs);

// ============================================================================
// ACHIEVEMENT QUEUE - work a list of monster rungs without being driven by hand
// ============================================================================
/* The achievement queue is PERSISTED in CODE storage and re-asserted on a
   timer: a runtime manualOverride is lost both by a reload and by
   checkFarmEconomics blacklisting the spot it points at. Progress is READ
   from a refreshed tracker, never counted, and that needs a tracker ITEM
   in the bag - Dexon carries one in slot 0.
   -> RangerComments.md#why-this-exists-a-farm-spot-lives */
const ACHV_KEY = 'achv_queue';
let achvKills = 0;        // kill_credit for the current target since the last read
let achvLastRefresh = 0;
let achvPaused = false;   // the operator moved the party by hand; stay out of the way
let achvWarned = false;

function achvCfg() { return CONFIG.achievements || { enabled: false, queue: [] }; }
function achvLog(m, c) { try { game_log('[achv] ' + m, c || '#9FD3FF'); } catch (e) { } console.log('[achv] ' + m); }

function achvLoad() {
	let s = null;
	try { s = scopedGetLegacy(ACHV_KEY); } catch (e) { }
	if (!s || typeof s !== 'object') s = { i: 0, done: [] };
	if (typeof s.i !== 'number') s.i = 0;
	if (!Array.isArray(s.done)) s.done = [];
	return s;
}
function achvSave(s) { try { scopedSet(ACHV_KEY, s); } catch (e) { achvLog('could not persist the queue', 'red'); } }

function achvTarget() {
	const q = achvCfg().queue || [];
	const s = achvLoad();
	return (s.i >= 0 && s.i < q.length) ? q[s.i] : null;
}

/* max(own + diff, account best) - the same expression node/server.js uses to
   decide whether a rung is earned, so this cannot disagree with the game. */
function achvScore(m) {
	const t = (typeof parent !== 'undefined' && parent.tracker) || {};
	const own = t.monsters || {}, d = t.monsters_diff || {}, mx = (t.max && t.max.monsters) || {};
	return Math.max((own[m] || 0) + (d[m] || 0), (mx[m] || [0, 0])[0]);
}

function achvRefresh() {
	return new Promise((resolve) => {
		let restored = false;
		const P = parent;
		const orig = P.render_tracker;
		const restore = () => { if (!restored) { restored = true; try { P.render_tracker = orig; } catch (e) { } } };
		try {
			P.render_tracker = function () { };
			P.socket.emit('tracker');
		} catch (e) { restore(); return resolve(false); }
		setTimeout(() => { restore(); resolve(true); }, 2200);
	});
}

/* Everything the spot needs to survive: whitelisted so checkFarmEconomics cannot
   take it, pruned out of any blacklist already holding it, then set. */
function achvApply(t) {
	try { PERMANENT_WHITELIST.add(spotKey(t.m, t.map)); getBlacklist(); } catch (e) { }
	manualOverride = { home: t.m, mobMap: t.map, x: t.x, y: t.y, expPerSecond: 0, uptimeFraction: 1 };
	/* `also` monsters are farmed alongside t.m and must survive the economics
	   check the same way, or the spot is dropped the moment one of them scores
	   badly on its own. */
	rageAlso = Array.isArray(t.also) ? t.also.slice() : [];
	try { for (const a of rageAlso) PERMANENT_WHITELIST.add(spotKey(a, t.map)); } catch (e) { }
	achvKills = 0;
	try { runFarmSearch(); } catch (e) { achvLog('runFarmSearch threw: ' + e, 'red'); }
}

function achvIsOurs() {
	const t = achvTarget();
	return !!(t && manualOverride && manualOverride.home === t.m && manualOverride.mobMap === t.map);
}

function achvAdvance(reason) {
	const s = achvLoad(), t = achvTarget();
	if (t) s.done.push({ m: t.m, rung: t.rung, at: Date.now(), why: reason });
	s.i++;
	achvSave(s);
	const n = achvTarget();
	if (n) { achvLog('next: ' + n.m + '@' + n.map + ' for ' + n.rung, '#7FD98A'); achvApply(n); }
	else {
		achvLog('queue finished - handing the spot back to the scorer', '#FFD700');
		manualOverride = null;
		try { runFarmSearch(); } catch (e) { }
	}
}

async function achvTick() {
	const cfg = achvCfg();
	if (!cfg.enabled || achvPaused) return;
	/* The monster hunt owns the farm spot while a cycle is live, and the override
	   check further down would read that as the operator moving the party by
	   hand - which stands the queue down PERMANENTLY until achvResume(). Return
	   before that happens; the queue picks up again when mhOff() releases. */
	if (typeof mhOwnsSpot === 'function' && mhOwnsSpot()) return;
	/* The cipher farm likewise, for the length of a gathering window. */
	if (typeof cipherOwnsSpot === 'function' && cipherOwnsSpot()) return;
	const t = achvTarget();
	if (!t) return;

	if (!achvWarned && !(typeof parent !== 'undefined' && parent.tracker)) {
		achvWarned = true;
		achvLog('no tracker data - a tracker item must be in the bag or progress cannot be read', 'orange');
	}

	/* An override that is neither ours nor empty means the operator moved the
	   party by hand, and that outranks the queue. Empty means a reload or a
	   blacklist cleared it, which is the case this exists to repair. */
	if (manualOverride && !achvIsOurs()) {
		achvPaused = true;
		achvLog('override points at ' + manualOverride.home + '@' + manualOverride.mobMap
			+ ' - standing down, achvResume() to take it back', 'orange');
		return;
	}
	if (!achvIsOurs()) { achvLog('re-asserting ' + t.m + '@' + t.map, '#8b98ab'); achvApply(t); }

	/* On a timer, and early when the kills counted since the last read could
	   already have crossed. 1.3 UNDER-states score per kill (1.589 measured for a
	   co-located trio) so the eager check fires before the rung, never after. */
	const base = achvScore(t.m);
	/* rung null = run until the toggle goes off or achvStop(), so there is no
	   threshold to race and nothing to refresh early for. */
	if (t.rung == null) { if (Date.now() - achvLastRefresh < cfg.refreshMs) return; }
	else if (Date.now() - achvLastRefresh < cfg.refreshMs && base + achvKills * 1.3 < t.rung) return;

	achvLastRefresh = Date.now();
	try { await noHang(achvRefresh(), 'achv tracker refresh', 6000); } catch (e) { }
	achvKills = 0;
	const now = achvScore(t.m);
	if (t.rung == null) achvLog(t.m + ': ' + Math.round(now) + ' (no rung - running until stopped)', '#8b98ab');
	else if (now >= t.rung) { achvLog(t.m + ' reached ' + t.rung + ' (' + Math.round(now) + ')', '#00FF00'); achvAdvance('reached'); }
	else achvLog(t.m + ': ' + Math.round(now) + ' / ' + t.rung, '#8b98ab');
}

// ---- console helpers -------------------------------------------------------
function achvStatus() {
	const cfg = achvCfg(), s = achvLoad();
	achvLog(cfg.enabled ? (achvPaused ? 'ENABLED, stood down' : 'ENABLED') : 'disabled',
		cfg.enabled && !achvPaused ? '#7FD98A' : '#8b98ab');
	(cfg.queue || []).forEach((q, i) => {
		const sc = Math.round(achvScore(q.m));
		achvLog((i === s.i ? ' -> ' : '    ') + q.m + '@' + q.map + '  ' + sc + ' / ' + q.rung
			+ (sc >= q.rung ? '  DONE' : ''), i === s.i ? '#FFD700' : '#8b98ab');
	});
	return { i: s.i, target: achvTarget(), paused: achvPaused, done: s.done };
}
/* The stop command. Clears the override so the scorer takes the spot back,
   and stays stood down until achvResume() - the toggle is the other way out. */
function achvStop() {
	achvPaused = true;
	rageAlso = [];
	if (achvIsOurs()) { manualOverride = null; try { runFarmSearch(); } catch (e) { } }
	achvLog('stopped by hand - spot handed back to the scorer; achvResume() to pick up again', '#FFD700');
	return true;
}
function achvResume() { achvPaused = false; achvLog('resumed', '#7FD98A'); const t = achvTarget(); if (t) achvApply(t); return true; }
function achvSkip() { achvLog('skipped by hand', '#FFD700'); achvAdvance('skipped'); return achvTarget(); }
function achvReset(i) {
	const s = achvLoad();
	s.i = (typeof i === 'number') ? i : 0;
	s.done = [];
	achvSave(s);
	achvPaused = false;
	achvLog('queue index set to ' + s.i, '#FFD700');
	const t = achvTarget();
	if (t) achvApply(t);
	return t;
}

/* Counted only to decide when to spend a refresh early, never as progress. */
try {
	parent.socket.on('kill_credit', (d) => {
		if (!achvCfg().enabled || achvPaused) return;
		const t = achvTarget();
		if (t && d && d.mtype === t.m) achvKills++;
	});
} catch (e) { }

/* At boot and then on the interval. The first tick used to arrive at
   reassertMs (30s), long after the farm spot had been broadcast; the farm spot
   now waits for it (farmSpotBootReady). The latch is set on SETTLE, not on
   success: a tick that throws is logged above and must not hold the farm spot
   hostage, and the tracker refresh inside is noHang-bounded so a hang cannot
   either. */
function achvTickRun() {
	return achvTick()
		.catch((e) => achvLog('tick threw: ' + ((e && e.message) || e), 'red'))
		.finally(() => { farmBootAchvTick = true; });
}
/* NEXT TURN, NOT INLINE - v140. Called inline it ran before `let mhToggle`
   further down this file had been initialised, and threw "Cannot access
   'mhToggle' before initialization" once per page load. */
setTimeout(achvTickRun, 0);
setInterval(achvTickRun, (CONFIG.achievements && CONFIG.achievements.reassertMs) || 30000);

setInterval(() => {
	mhTick().catch((e) => mhLog('tick threw: ' + ((e && e.message) || e), 'red'));
}, (CONFIG.monsterHunt && CONFIG.monsterHunt.tickMs) || 5000);

/* ============================================================================
   WITCH'S CIPHER INGREDIENT FARMING  -> CONFIG.cipherFarm, RangerComments.md#cipherFarm

   For the first `gathering` seconds of a cipher round, sixteen ordinary
   monsters carry one of the four ingredients in their usual loot, at
   `loot * hp / 1000` per kill - so the yield of a spot is its kill rate times
   that, which comes to the damage the party lands. Read from the server at
   upstream 16881a27 (`witch_cipher_loot`); the monster list is read LIVE from
   G.events.witchcipher.ingredients, and the copy below is only the fallback.

   What this owns: the farm spot, while a window is open here and Meltymerch is
   short, and a hold on this shard while that is true. What it never owns:
   movement while a boss layer has it. A window elsewhere is bossHop's to act
   on, through cipherPlan(), at the cipher's own rank in BOSS_RANK. And while it
   owns the spot it outranks a boss-event trip the table ranks below it - see
   cipherOutranks().
   ============================================================================ */
const CIPHER_EVENT = 'witchcipher';
/* ITS RANK IS BOSS_RANK.witchcipher, read through bossRank(CIPHER_EVENT) at
   every use - operator's ruling 2026-10-25 20:00 EDT. Until v155 it was a
   constant one past the default, below every boss. */
const CIPHER_INGREDIENTS_FALLBACK = [
	['verdantspore', ['goo', 'bee', 'spider', 'croc']],
	['frostscale', ['arcticbee', 'boar', 'wolfie', 'iceroamer']],
	['embercoal', ['plantoid', 'porcupine', 'fireroamer', 'gscorpion']],
	['gloomfeather', ['snake', 'osnake', 'minimush', 'ghost']],
];
const cipherFarm = { stock: null, stockAt: 0, loaded: false, pick: null, key: '', said: '', askedAt: 0 };
/* Meltymerch's last count, kept across a hop. In memory alone it died with
   every page load, and Dexon reloads on every hop - 14 "no fresh count" lines
   in one night. Scoped: it is what THIS character last heard. */
const CIPHER_STOCK_KEY = 'cipher_stock';

function cipherLog(m, c) { try { game_log('[cipher] ' + m, c || '#C9A0FF'); } catch (e) { } console.log('[cipher] ' + m); }
/* Once per distinct message, so a 15s tick repeating the same reason is quiet. */
function cipherSay(m, c) { if (cipherFarm.said === m) return; cipherFarm.said = m; cipherLog(m, c); }

function cipherRules() {
	const e = parent.G && parent.G.events && parent.G.events[CIPHER_EVENT];
	return e || null;
}
function cipherIngredients() {
	const r = cipherRules();
	const live = r && Array.isArray(r.ingredients) ? r.ingredients.filter((x) => Array.isArray(x) && x[0] && Array.isArray(x[1])) : [];
	return live.length ? live : CIPHER_INGREDIENTS_FALLBACK;
}
function cipherGatherMs() {
	const r = cipherRules();
	return (r && typeof r.gathering === 'number' && r.gathering > 0 ? r.gathering : 1200) * 1000;
}
function cipherLootRate() {
	const r = cipherRules();
	return r && typeof r.loot === 'number' && r.loot > 0 ? r.loot : 0.003;
}

/* Meltymerch's own bag, as he last reported it. The receiver validates: only
   finite non-negative counts are kept, and the four names are read from G so a
   renamed ingredient is a missing count rather than a stale one. */
function cipherOnStock(data) {
	const c = data && data.counts;
	if (!c || typeof c !== 'object') return;
	const counts = {};
	for (const [name] of cipherIngredients()) {
		const n = c[name];
		counts[name] = (typeof n === 'number' && isFinite(n) && n >= 0) ? n : null;
	}
	/* Aged from when he COUNTED, not when we heard: the bridge holds a message
	   for a character mid-hop and hands it over on the next page, so a
	   delivery can be minutes old. Same browser, same clock. A stamp from the
	   future or none at all is read as now. */
	const now = Date.now();
	const at = (typeof data.at === 'number' && isFinite(data.at) && data.at > 0 && data.at <= now + 60000)
		? Math.min(data.at, now) : now;
	if (cipherFarm.stock && cipherFarm.stockAt > at) return;   // an older count arriving late
	cipherFarm.stock = counts;
	cipherFarm.stockAt = at;
	try { scopedSet(CIPHER_STOCK_KEY, { counts, at }); } catch (e) { }
}

/* The persisted count, once per page - the name is not readable at module
   load, so this runs from the first read rather than at the top level. */
function cipherStockLoad() {
	if (cipherFarm.stock || cipherFarm.loaded) return;
	const v = scopedGet(CIPHER_STOCK_KEY);
	if (scopeKey(CIPHER_STOCK_KEY)) cipherFarm.loaded = true;
	if (v && v.counts && typeof v.at === 'number') { cipherFarm.stock = v.counts; cipherFarm.stockAt = v.at; }
}

/* Asked, not waited for: Meltymerch reports on a change and every five
   minutes, but he hops so often that a report can be a long time coming,
   and with no count nothing is farmed. Throttled, and only while ours is
   stale. */
function cipherAskForStock(now) {
	if (now - cipherFarm.askedAt < CONFIG.cipherFarm.askEveryMs) return false;
	cipherFarm.askedAt = now;
	try { plSend('Meltymerch', { message: 'cipher_stock_request' }); return true; }
	catch (e) { cipherLog('could not ask Meltymerch for a count: ' + e, 'orange'); return false; }
}

/* The ingredients he is short of, or NULL when that cannot be known - no
   report, a stale one, or a name it does not carry. Null farms nothing. */
function cipherShort(now) {
	const cf = CONFIG.cipherFarm;
	cipherStockLoad();
	if (!cipherFarm.stock || !cipherFarm.stockAt) return null;
	if ((now || Date.now()) - cipherFarm.stockAt > cf.stockMaxAgeMs) return null;
	const out = [];
	for (const [name] of cipherIngredients()) {
		const n = cipherFarm.stock[name];
		if (typeof n !== 'number') return null;
		if (n < cf.target) out.push(name);
	}
	return out;
}

/* The gathering window on THIS shard: the live round from S when one is
   gathering, else the next scheduled occurrence from the bridge. S is exact
   (`gather_end` is the server's own); the schedule is the only source for a
   round that has not started. */
function cipherWindowHere(now) {
	const w = parent.S && parent.S[CIPHER_EVENT];
	if (w && w.live === true && w.phase === 'gathering' && typeof w.gather_end === 'number' && w.gather_end > now) {
		return { start: typeof w.start === 'number' ? w.start : now, end: w.gather_end, open: true };
	}
	const cur = bossHop.currentShard();
	const gather = cipherGatherMs();
	let best = null;
	for (const o of (bossHop.schedRows || [])) {
		if (o.event !== CIPHER_EVENT || o.shard !== cur) continue;
		if (o.status && o.status !== 'scheduled') continue;
		if (o.at <= now || (best && o.at >= best.start)) continue;
		best = { start: o.at, end: o.at + gather, open: false };
	}
	return best;
}

/* Straight-line distance over the door graph, from where we stand to (map, x,
   y), or null if no chain of doors connects them. Doors only: the transporter
   is not modelled, so a far map can read longer than smart_move makes it. It
   is a ranking term - which spot pays more in what is left of a window - not
   a schedule. */
function cipherDoorDistance(fromMap, fx, fy, toMap, tx, ty) {
	const maps = parent.G && parent.G.maps;
	if (!maps || !maps[fromMap] || !maps[toMap]) return null;
	if (fromMap === toMap) return Math.hypot(tx - fx, ty - fy);
	const open = [{ map: fromMap, x: fx, y: fy, d: 0 }];
	const done = new Set();
	let best = null;
	while (open.length && done.size < 400) {
		open.sort((a, b) => a.d - b.d);
		const n = open.shift();
		if (best !== null && n.d >= best) break;
		const key = n.map + '|' + Math.round(n.x) + '|' + Math.round(n.y);
		if (done.has(key)) continue;
		done.add(key);
		if (n.map === toMap) {
			const t = n.d + Math.hypot(tx - n.x, ty - n.y);
			if (best === null || t < best) best = t;
			continue;
		}
		for (const door of (maps[n.map].doors || [])) {
			if (!Array.isArray(door) || door.length < 6) continue;
			const there = maps[door[4]];
			const sp = there && Array.isArray(there.spawns) ? there.spawns[door[5]] : null;
			if (!Array.isArray(sp)) continue;
			open.push({ map: door[4], x: sp[0], y: sp[1], d: n.d + Math.hypot(door[0] - n.x, door[1] - n.y) });
		}
	}
	return best;
}

function cipherTravelSec(map, x, y) {
	const cf = CONFIG.cipherFarm;
	const d = cipherDoorDistance(character.map, character.real_x != null ? character.real_x : character.x,
		character.real_y != null ? character.real_y : character.y, map, x, y);
	const speed = Math.max(1, character.speed || 50);
	return d === null ? cf.unknownTravelSec : (d * cf.pathFactor) / speed;
}

/* Every spot of a monster carrying a short ingredient, by expected quantity in
   the window [start, end]: kills per second (the farm scorer's own model) times
   the per-kill chance, over the time left once we have walked there. The same
   safety gates as the xp scorer - unsafe maps, the coded and stored
   blacklists, the uptime floor - and none of its xp or gold gates, which are
   about a question this is not asking. */
function cipherSpots(short, start, end, now) {
	const G = parent.G;
	if (!G || !G.maps || !G.monsters) return [];
	const want = {};
	for (const [name, types] of cipherIngredients()) if (short.indexOf(name) >= 0) for (const t of types) want[t] = name;
	const loot = cipherLootRate();
	const dps = getPartyDps();
	const heal = estimateHealThroughput();
	const ehp = 3 * (character.max_hp || 2000);
	const blacklist = getBlacklist();
	const out = [];
	for (const mapName in G.maps) {
		const mapData = G.maps[mapName];
		if (!isMapSafeForFarming(mapData) || !mapData.monsters) continue;
		for (const spot of mapData.monsters) {
			const ing = want[spot.type];
			if (!ing) continue;
			const mob = G.monsters[spot.type];
			if (!mob || !mob.hp || mob.hp > FARM_SEARCH.maxViableHp) continue;
			const key = spotKey(spot.type, mapName);
			if (isPermanentlyBlacklisted(key) || blacklist[key]) continue;
			if (!Array.isArray(spot.boundary) || spot.boundary.length < 4) continue;
			const kill = farmSpotKill(mob, spot, dps, heal, ehp);
			if (!(kill.uptimeFraction >= FARM_SEARCH.minUptimeFraction)) continue;
			const perSec = kill.killRate * kill.uptimeFraction * Math.min(1, loot * mob.hp / 1000);
			if (!isFinite(perSec) || perSec <= 0) continue;
			const x = (spot.boundary[0] + spot.boundary[2]) / 2, y = (spot.boundary[1] + spot.boundary[3]) / 2;
			const travelSec = cipherTravelSec(mapName, x, y);
			const from = Math.max(now + travelSec * 1000, start);
			const qty = perSec * Math.max(0, (end - from) / 1000);
			const held = cipherHeld(ing);
			out.push({ home: spot.type, mobMap: mapName, x, y, ingredient: ing, perSec, travelSec, qty,
				held, useful: cipherUseful(qty, held), uptimeFraction: kill.uptimeFraction });
		}
	}
	/* BY WHAT THE BAG STILL NEEDS - v155. By raw qty a spot could win on drops
	   the bag cannot use: 2026-10-25 23:00Z Meltymerch held embercoal 6 and
	   frostscale 0, so an embercoal spot expecting 40 would beat a frostscale
	   one expecting 30, though only 19 embercoal were wanted and every recipe
	   left needed frostscale. Capped at the deficit they read 19 against 25.
	   No tie-break on the count held: two different ingredients tie on `useful`
	   only when both are capped at equal deficits, which means equal counts. */
	out.sort((a, b) => (b.useful - a.useful) || (b.qty - a.qty) || (b.perSec - a.perSec)
		|| (spotKey(a.home, a.mobMap) < spotKey(b.home, b.mobMap) ? -1 : 1));
	return out;
}

/* Meltymerch's count of one ingredient, 0 when unknown - cipherShort() has
   already refused a stale or partial reading before any spot is scored. */
function cipherHeld(name) {
	const n = cipherFarm.stock && cipherFarm.stock[name];
	return typeof n === 'number' ? n : 0;
}

/* The part of a spot's expected drops the bag can use: no more than it is
   short of the target. */
function cipherUseful(qty, held) {
	return Math.min(qty, Math.max(0, CONFIG.cipherFarm.target - held));
}

function cipherOwnsSpot() {
	const p = cipherFarm.pick;
	return !!(p && manualOverride && manualOverride.home === p.home && manualOverride.mobMap === p.mobMap);
}

/* THE CIPHER OUTRANKS A BOSS THE TABLE RANKS BELOW IT, while it owns the spot -
   which is from the walk-in before a window opens to the window's end, the
   same span cipherTick holds it. Without this the rank was decoration: a live
   mrgreen or mrpumpkin made bossPick() non-null, shouldHandleEvents() handed
   movement to the boss layer, and the farm spot was never walked to. */
function cipherOutranks(name) {
	return !!name && cipherOwnsSpot() && bossRank(CIPHER_EVENT) < bossRank(name);
}

/* THE FOLLOWERS HEAR IT AS THE LEADER'S "NO BOSS". Their own bossPick() would
   otherwise take the same mrgreen 20s after the leader's last word - they do
   not know the cipher - and split the party. bossBeat() repeats only while a
   trip exists, so this repeats the null while the farm holds us and no trip
   does. A higher-ranked boss starts a trip, which stops this and broadcasts
   that boss instead. */
function cipherBeat() {
	if (!bossIsLeader() || bossState.trip || !cipherOwnsSpot()) return;
	const now = Date.now();
	if (now - (bossState.lastCast || 0) < BOSS_RECAST_MS) return;
	bossState.lastCast = now;
	bossBroadcast(null);
}
setInterval(() => { try { cipherBeat(); } catch (e) { cipherLog('beat threw: ' + ((e && e.message) || e), 'red'); } }, BOSS_BEAT_MS);

/* Pinned the way the achievement queue and the hunt pin theirs, for the same
   reason: checkFarmEconomics would otherwise judge a spot chosen for a reason
   it cannot see. rageAlso is the queue's; its re-assert restores it after. */
function cipherApply(p) {
	try { PERMANENT_WHITELIST.add(spotKey(p.home, p.mobMap)); getBlacklist(); } catch (e) { }
	manualOverride = { home: p.home, mobMap: p.mobMap, x: p.x, y: p.y, expPerSecond: 0, uptimeFraction: p.uptimeFraction || 1 };
	rageAlso = [];
	try { runFarmSearch(); } catch (e) { cipherLog('runFarmSearch threw: ' + e, 'red'); }
}

function cipherRelease(why) {
	if (cipherOwnsSpot()) {
		manualOverride = null;
		try { runFarmSearch(); } catch (e) { }
	}
	if (cipherFarm.pick) cipherLog('released ' + cipherFarm.pick.home + '@' + cipherFarm.pick.mobMap + ' - ' + why, '#8b98ab');
	cipherFarm.pick = null;
	cipherFarm.key = '';
}

/* Why nothing is being farmed, or null when something should be. */
function cipherIdleReason(short, win, now) {
	if (!CONFIG.cipherFarm.enabled) return 'turned off';
	if (short === null) return 'no fresh count from Meltymerch';
	if (!short.length) return 'Meltymerch holds ' + CONFIG.cipherFarm.target + ' of each';
	if (!win) return 'no gathering window on this shard';
	if (!win.open && win.start - now > CONFIG.cipherFarm.walkLeadMaxMs) return 'next window here opens ' + new Date(win.start).toISOString().slice(11, 16) + 'Z';
	return null;
}

/* NO SEASON END - operator 2026-10-25. The cipher stays in the daily rotation
   after Halloween, so the farming does too, and Meltymerch keeps the
   ingredients in his bag year-round, which keeps his count meaningful. */

function cipherTick() {
	const now = Date.now();
	const short = cipherShort(now);
	const win = cipherWindowHere(now);
	const idle = cipherIdleReason(short, win, now);
	if (short === null && CONFIG.cipherFarm.enabled) cipherAskForStock(now);
	if (idle) {
		if (cipherFarm.pick) cipherRelease(idle);
		cipherSay(idle, '#8b98ab');
		return;
	}
	/* A hand-set override outranks this, as it outranks the queue. Ours, the
	   queue's and the hunt's are the only automatic ones. */
	if (manualOverride && !cipherOwnsSpot() && !achvIsOurs() && !mhOwnsSpot()) {
		cipherSay('the farm spot was set by hand - standing aside', 'orange');
		return;
	}
	/* The window by its five-minute bucket, not its exact start: before the
	   open the start is the schedule's `at`, after it the server's own
	   `start`, a few seconds apart - and a key on the exact value re-picked
	   at every opening, throwing away the walk the preposition had just made
	   (arcticbee for spider at 11:00:10Z 2026-10-25, 20.8 against 19.6). */
	const key = Math.round(win.start / 300000) + '|' + short.join(',');
	if (!cipherFarm.pick || cipherFarm.key !== key) {
		const spots = cipherSpots(short, win.start, win.end, now);
		if (!spots.length) {
			if (cipherFarm.pick) cipherRelease('no viable spot');
			cipherSay('no viable spot for ' + short.join(', '), 'orange');
			return;
		}
		/* STICKY: a held pick still in the list - its ingredient still short,
		   the spot still safe - is kept unless the best is materially better,
		   re-scored from where we stand now. Estimates a few percent apart are
		   noise against a walk already made. */
		const held = cipherFarm.pick
			&& spots.find((s) => s.home === cipherFarm.pick.home && s.mobMap === cipherFarm.pick.mobMap);
		const keep = !!held && !(spots[0].useful > held.useful * CONFIG.cipherFarm.switchFactor);
		cipherFarm.pick = keep ? held : spots[0];
		cipherFarm.key = key;
	}
	const p = cipherFarm.pick;
	/* Not open yet: set off only once the walk would land at the opening. */
	if (!win.open && now < win.start - p.travelSec * 1000 - CONFIG.cipherFarm.marginMs) {
		cipherSay('window opens ' + new Date(win.start).toISOString().slice(11, 16) + 'Z - will walk to '
			+ p.home + '@' + p.mobMap + ' (~' + Math.round(p.travelSec) + 's) for ' + p.ingredient, '#8b98ab');
		return;
	}
	if (!cipherOwnsSpot()) {
		cipherApply(p);
		cipherSay('farming ' + p.home + '@' + p.mobMap + ' for ' + p.ingredient + ' (short: ' + short.join(', ')
			+ '; ~' + p.qty.toFixed(1) + ' expected, until ' + new Date(win.end).toISOString().slice(11, 16) + 'Z)', '#C9A0FF');
	}
}

function cipherStatus() {
	const now = Date.now();
	const short = cipherShort(now);
	const win = cipherWindowHere(now);
	const out = { enabled: !!CONFIG.cipherFarm.enabled, stock: cipherFarm.stock,
		stockAgeSec: cipherFarm.stockAt ? Math.round((now - cipherFarm.stockAt) / 1000) : null,
		short, window: win && { start: new Date(win.start).toISOString(), end: new Date(win.end).toISOString(), open: win.open },
		idle: cipherIdleReason(short, win, now),
		pick: cipherFarm.pick && { spot: cipherFarm.pick.home + '@' + cipherFarm.pick.mobMap, ingredient: cipherFarm.pick.ingredient,
			qty: +cipherFarm.pick.qty.toFixed(2), travelSec: Math.round(cipherFarm.pick.travelSec) },
		ownsSpot: cipherOwnsSpot(), plan: bossHop.cipherPlan(bossHop.currentShard()) };
	console.log('[cipher]', out);
	return out;
}

setTimeout(() => { try { cipherTick(); } catch (e) { cipherLog('tick threw: ' + ((e && e.message) || e), 'red'); } }, 12000);
setInterval(() => { try { cipherTick(); } catch (e) { cipherLog('tick threw: ' + ((e && e.message) || e), 'red'); } },
	(CONFIG.cipherFarm && CONFIG.cipherFarm.tickMs) || 15000);

/* ============================================================================
   TRICK OR TREAT - the knock route.  -> CLAUDE.md "Trick or Treat"

   Seven doors, each knockable once per character per UTC day, 14 knocks per
   ACCOUNT. Dexon takes seven and Meltymerch the other seven; nobody else runs
   a route. Everything below rests on facts measured live 2026-10-24 or read
   from the server at upstream 16881a27:

   * `character.trickortreat` is {doors, doors_left, stamps}. `doors` is what
     THIS character knocked today; `doors_left` is min(7 - mine, account left)
     but the account half is cached per server process, so on a shard where
     the knocks were not taken it OVERSTATES. It decides whether to set off;
     the `trickortreat_limit` refusal is what stops the route.
   * The costume must be WORN when the knock settles, not merely when it is
     sent. `equip(idx)` swaps the bag item with the worn one in one call, needs
     no free slot, keeps a lock on both items, and does not stop a walk.
   * The door radius is 80 units on the character's own map.
   * A full bag loses nothing: the server's add_item appends past the end.

   Not on a boss, ever: mainLoop stands down while this runs (totBusy), so the
   route itself re-checks shouldHandleEvents() before every door and stops the
   moment a boss or event wants the party. bossHop cannot tick while we hold
   movement either, which is why a route never STARTS within leadMs of a
   ranked event on this shard.
   ============================================================================ */
let totBusy = false;       // a knock route owns movement; mainLoop stands down
let totPauseUntil = 0;     // after a season refusal or a route that left doors open
let totDoneDay = null;     // UTC day the account limit was hit - nothing more today
let totLast = null;        // last route summary, for totStatus()
/* Door index -> the stand point a walk last reached it from. Mirrored to the
   shared TOT_STAND_KEY store - see totStandLoad. */
let totStand = {};

function totLog(msg, color) { game_log('[tot] ' + msg, color || '#F5A05B'); }
function totG() { return (typeof parent !== 'undefined' && parent.G) || (typeof G !== 'undefined' ? G : null); }
function totRules() { const g = totG(); return (g && g.events && g.events.trickortreat) || null; }
function totUtcDay(ms) { return new Date(ms).toISOString().slice(0, 10); }

/* The season is open when the server says so. S.halloween is the live flag the
   game's own event panel reads; the rules come from live G, never from the
   source's field names (the cipher payload taught that). */
function totSeasonOpen() {
	const S = (typeof parent !== 'undefined') ? parent.S : null;
	const r = totRules();
	return !!(S && S.halloween && r && Array.isArray(r.doors) && r.doors.length);
}

/* Door indices this character has NOT knocked today, ordered for one walk:
   the map we are on first, then halloween before spookytown - spookytown is
   reached through halloween and holds five of the seven doors, so the route
   ends where the graveyard is. Nearest-neighbour inside each map. */
function totRemainingDoors() {
	const r = totRules();
	const t = character.trickortreat;
	if (!r || !t) return [];
	const done = new Set(Array.isArray(t.doors) ? t.doors : []);
	const left = [];
	r.doors.forEach((d, i) => { if (!done.has(i) && Array.isArray(d)) left.push({ i, map: d[0], x: d[1], y: d[2] }); });
	const mapOrder = [character.map, 'halloween', 'spookytown'];
	const maps = [...new Set(mapOrder.concat(left.map((d) => d.map)))];
	const out = [];
	let px = character.real_x != null ? character.real_x : character.x;
	let py = character.real_y != null ? character.real_y : character.y;
	let pmap = character.map;
	for (const m of maps) {
		const pool = left.filter((d) => d.map === m);
		while (pool.length) {
			let best = 0, bd = Infinity;
			pool.forEach((d, k) => {
				const dd = (m === pmap) ? Math.hypot(d.x - px, d.y - py) : 0;
				if (dd < bd) { bd = dd; best = k; }
			});
			const d = pool.splice(best, 1)[0];
			out.push(d);
			px = d.x; py = d.y; pmap = m;
		}
	}
	return out;
}

/* Milliseconds until the soonest RANKED event opens on this shard, read from
   the published lineup. graveyard is skipped: it opens in spookytown, which is
   where this route ends, so a knock run just before it is "on the way to a
   graveyard trip" in the operator's words. Both arrays are read, because a
   repeat slot (graveyard) appears ONLY in `repeats`.
   RANKED MEANS AN ENTRY IN BOSS_RANK, asked of the table directly rather than
   as "below the default", which said the same thing only while the default sat
   above every entry. witchcipher is skipped by name since v155 put it in the
   table: it is a gathering window, not a fight, and the merchant knocks
   through it. The other entries the lineup never names - mrgreen, mrpumpkin,
   snowman, grinch, wabbit - are respawn or seasonal bosses with no schedule
   row, so this test cannot reach them either way. */
function totBossSoon(now) {
	const sch = (typeof parent !== 'undefined' && parent.S && parent.S.schedule) || null;
	if (!sch) return Infinity;
	const ranked = (name) => !!name && name !== 'graveyard' && name !== CIPHER_EVENT
		&& Object.prototype.hasOwnProperty.call(BOSS_RANK, name);
	let soon = Infinity;
	for (const o of (Array.isArray(sch.events) ? sch.events : [])) {
		if (!o || !ranked(o.event) || typeof o.at !== 'number') continue;
		if (o.at >= now && o.at - now < soon) soon = o.at - now;
	}
	for (const raw of (Array.isArray(sch.repeats) ? sch.repeats : [])) {
		const o = Array.isArray(raw) ? { event: raw[0], at: raw[1], every: raw[2] } : raw;
		if (!o || !ranked(o.event) || typeof o.at !== 'number') continue;
		let at = o.at;
		if (typeof o.every === 'number' && o.every > 0 && at < now) at += Math.ceil((now - at) / o.every) * o.every;
		if (at >= now && at - now < soon) soon = at - now;
	}
	return soon;
}

/* Why a route may not start right now, or null when it may. One predicate,
   read by the tick and by totStatus(), so the status says what the tick saw. */
function totBlocked(now) {
	const cfg = CONFIG.trickOrTreat || {};
	if (!cfg.enabled) return 'disabled';
	if (totBusy) return 'running';
	if (now < totPauseUntil) return 'paused';
	if (totDoneDay === totUtcDay(now)) return 'account limit reached today';
	if (!totSeasonOpen()) return 'season closed';
	const t = character.trickortreat;
	if (!t || typeof t.doors_left !== 'number') return 'no trickortreat status';
	if (t.doors_left <= 0) return 'no doors left';
	if (!totRemainingDoors().length) return 'all doors knocked';
	if (character.rip || character.map === 'jail' || is_disabled(character)) return 'not able to move';
	if (state.sellingOff || mhBusy || state.waitingForMerchant || ragePull.busy || rageNav.busy || reliefRunning) return 'movement is busy';
	if (bossHop.state !== 'IDLE' || bossHop.hopping) return 'boss hop ' + bossHop.state;
	if (shouldHandleEvents()) return 'a boss or event is on';
	if (totBossSoon(now) < (cfg.leadMs || 0)) return 'a ranked event opens soon';
	return null;
}

function totCostumeIdx() {
	const r = totRules();
	const names = (r && Array.isArray(r.costumes)) ? r.costumes : [];
	for (let i = 0; i < character.items.length; i++) {
		const it = character.items[i];
		if (it && names.includes(it.name)) return i;
	}
	return -1;
}
function totWearing() {
	const r = totRules();
	const h = character.slots && character.slots.helmet;
	return !!(h && r && Array.isArray(r.costumes) && r.costumes.includes(h.name));
}

async function totKnock(i) {
	const fn = (typeof knock === 'function') ? knock
		: (typeof parent !== 'undefined' && typeof parent.knock_request === 'function') ? parent.knock_request : null;
	if (!fn) return { failed: true, reason: 'no knock function' };
	try { return await noHang(Promise.resolve(fn(i)), 'knock', 15000); }
	catch (e) { return (e && e.reason) ? e : { failed: true, reason: (e && e.message) || String(e) }; }
}

/* Put the costume on for one knock and take it off again after the knock has
   SETTLED. Returns the bag index to swap back through, or -1 when no swap
   happened (already wearing one, or none in the bag - a bare knock is 70%
   rather than 85%, still worth taking). */
async function totCostumeOn() {
	if (totWearing()) return -1;
	const idx = totCostumeIdx();
	if (idx < 0) return -1;
	try { await noHang(Promise.resolve(equip(idx)), 'tot equip', 5000); } catch (e) { totLog('costume swap failed: ' + ((e && (e.reason || e.message)) || e), 'orange'); }
	return totWearing() ? idx : -1;
}
async function totCostumeOff(idx) {
	if (idx < 0) return;
	const back = character.items[idx];
	try {
		if (back) await noHang(Promise.resolve(equip(idx)), 'tot equip back', 5000);
		else await noHang(Promise.resolve(unequip('helmet')), 'tot unequip', 5000);   // no helmet was worn before
	} catch (e) { totLog('swap back failed: ' + ((e && (e.reason || e.message)) || e), 'red'); }
	if (totWearing()) totLog('still wearing the costume after the swap back - check the helmet slot', 'red');
}

function totNear(d) {
	const x = character.real_x != null ? character.real_x : character.x;
	const y = character.real_y != null ? character.real_y : character.y;
	return character.map === d.map && Math.hypot(d.x - x, d.y - y) <= (CONFIG.trickOrTreat.reach || 80);
}

/* The door coordinates are not always places a character can be walked to.
   Measured 2026-10-24: all five spookytown doors returned smart_move's "Path
   not found!" within about 2s while the trip onto the map had arrived, and
   halloween door 0 was walked to exactly. The server's test is distance only -
   within 80 of the player, no line of sight (trick_or_treat_door in
   halloween_events.js) - so any pathable point in reach will do. Candidates:
   the stand point that worked last time, the door itself, then rings at 40 and
   65 units. South first is a guess, unmeasured; the order only changes how
   many probes a door costs, never which doors can be reached. */
function totStandPoints(d) {
	const out = [];
	const known = totStand[d.i];
	if (known && isFinite(known.x) && isFinite(known.y)
		&& Math.hypot(known.x - d.x, known.y - d.y) <= (CONFIG.trickOrTreat.reach || 80)) {
		out.push({ x: known.x, y: known.y });
	}
	out.push({ x: d.x, y: d.y });
	const dirs = [[0, 1], [-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [0, -1]];
	for (const r of [40, 65]) {
		for (const v of dirs) {
			const n = Math.hypot(v[0], v[1]);
			out.push({ x: Math.round(d.x + v[0] / n * r), y: Math.round(d.y + v[1] / n * r) });
		}
	}
	return out;
}

/* Persisted, and deliberately SHARED between characters: a stand point is a
   fact about the map, not about whoever found it, and the merchant reloads on
   every hop. Measured 2026-10-24: every spookytown door point is refused, so
   an in-memory cache lost to a reload cost one dead probe per door per route.
   totStandPoints only uses a stored point that is still in reach of its door,
   so a bad value in the shared store costs a probe and nothing else. */
const TOT_STAND_KEY = 'tot_stand';
function totStandLoad() {
	try {
		const v = get(TOT_STAND_KEY);
		if (v && typeof v === 'object') totStand = Object.assign({}, v, totStand);
	} catch (e) { totLog('stand points not loaded: ' + ((e && e.message) || e), 'orange'); }
}
function totStandSave() {
	try { set(TOT_STAND_KEY, totStand); }
	catch (e) { totLog('stand points not saved: ' + ((e && e.message) || e), 'orange'); }
}
/* A walk ended in reach from p. Saved, and logged once, only when it is new. */
function totStandKeep(d, p) {
	const was = totStand[d.i];
	if (was && was.x === p.x && was.y === p.y) return;
	totStand[d.i] = { x: p.x, y: p.y };
	totStandSave();
	if (p.x !== d.x || p.y !== d.y) totLog('door ' + d.i + ': stand point ' + (p.x - d.x) + ',' + (p.y - d.y) + ' from the door, kept');
}
function totStandForget(d) {
	if (!totStand[d.i]) return;
	delete totStand[d.i];
	totStandSave();
}

/* Walk into reach of a door, trying stand points until one is reached. A
   failure that leaves us OFF the door's map is the trip failing, not the last
   leg, so a nearer point would not help and the door is given up. moveMs
   bounds each walk and, once on the map, the probing as a whole. */
async function totWalk(d) {
	/* Take the wheel from a farm trip already in flight, exactly as the Daisy
	   trip does - standing mainLoop down stops NEW movement only. */
	if (typeof travelState !== 'undefined' && travelState.inFlight) {
		travelState.attemptId++;
		travelState.inFlight = false;
	}
	totStandLoad();
	if (totNear(d)) return true;
	let tried = 0, why = null, onMapAt = null;
	for (const p of totStandPoints(d)) {
		if (character.rip) break;
		tried++;
		try { await noHang(safeSmartMove({ map: d.map, x: p.x, y: p.y }), 'tot walk', CONFIG.trickOrTreat.moveMs); }
		catch (e) { why = (e && (e.reason || e.message)) || String(e); }
		if (totNear(d)) { totStandKeep(d, p); return true; }
		if (character.map !== d.map) break;
		if (onMapAt === null) onMapAt = Date.now();
		else if (Date.now() - onMapAt > CONFIG.trickOrTreat.moveMs) break;
	}
	totStandForget(d);
	/* ON THE DOOR, so the route summary carries it: totLog is the game log
	   only, and that had scrolled the first time this mattered. */
	d.why = (why || 'arrived out of reach') + (character.map !== d.map ? ' on ' + character.map : '') + ' after ' + tried;
	totLog('door ' + d.i + ': no stand point reached (' + tried + ' tried, last: ' + why + ')', 'orange');
	return false;
}

/* One route. Every exit leaves totBusy false and the ordinary helmet back on. */
async function totRoute() {
	const doors = totRemainingDoors();
	const sum = { at: Date.now(), knocked: 0, treats: [], tricks: 0, stopped: null, failed: [] };
	totLog('setting off: ' + doors.length + ' door(s), ' + character.trickortreat.doors_left + ' knock(s) left');
	totBusy = true;
	try {
		for (const d of doors) {
			if (shouldHandleEvents()) { sum.stopped = 'a boss or event came on'; break; }
			if (character.rip) { sum.stopped = 'died'; break; }
			if (!(await totWalk(d))) { sum.failed.push(d.i + ':unreached' + (d.why ? ':' + d.why : '')); continue; }
			const swapped = await totCostumeOn();
			let res;
			try { res = await totKnock(d.i); }
			finally { await totCostumeOff(swapped); }
			if (res && res.success) {
				sum.knocked++;
				if (res.treat) sum.treats.push(res.treat.name + ' x' + (res.treat.q || 1));
				if (res.trick) sum.tricks++;
				totLog('door ' + d.i + ': ' + (res.treat ? res.treat.name + ' x' + (res.treat.q || 1) : 'trick (' + res.trick + ')')
					+ ', stamps ' + res.stamps, res.treat ? '#7FD98A' : '#AD91DC');
				continue;
			}
			const why = (res && res.reason) || 'unknown';
			if (why === 'trickortreat_knocked') continue;
			if (why === 'trickortreat_limit') { totDoneDay = totUtcDay(Date.now()); sum.stopped = 'account limit'; break; }
			if (why === 'trickortreat_season') { totPauseUntil = Date.now() + 60 * 60 * 1000; sum.stopped = 'season closed'; break; }
			if (why === 'cant_in_bank') { sum.stopped = 'in the bank'; break; }
			sum.failed.push(d.i + ':' + why);
		}
	} finally {
		totBusy = false;
	}
	/* Retry later only for doors that FAILED this route. Not "doors still listed
	   as open": the game refreshes character.trickortreat about a second after
	   each knock (measured 2026-10-24), so the last door can still read open
	   when a fully successful route ends. */
	if (!sum.stopped && sum.failed.length) totPauseUntil = Date.now() + (CONFIG.trickOrTreat.retryMs || 0);
	totLast = sum;
	totLog('route done: ' + sum.knocked + ' knocked' + (sum.treats.length ? ' (' + sum.treats.join(', ') + ')' : '')
		+ (sum.stopped ? ' - stopped: ' + sum.stopped : '') + (sum.failed.length ? ' - failed ' + sum.failed.join(' ') : ''),
		sum.failed.length ? 'orange' : '#7FD98A');
	return sum;
}

async function totTick() {
	if (totBlocked(Date.now())) return;
	await totRoute();
}

/* Why a route is or is not running, and how the last one went. Logs a [tot]
   line for console use; totStatus(true) returns the same object silently, for
   a sampler - polling the logging form scrolls real [tot] lines out of the
   game log, which is where a route's failure reasons are read. */
/* The preposition planner's view, for the console and for the other session's
   probe: what it would be on now, what is holding it, and how fresh its input
   is. Read-only. */
function prepStatus() {
	return bossHop.prepStatus();
}

function totStatus(quiet) {
	const now = Date.now();
	const t = character.trickortreat || null;
	const out = {
		blocked: totBlocked(now), busy: totBusy, season: totSeasonOpen(),
		doors: t ? t.doors : null, doorsLeft: t ? t.doors_left : null, stamps: t ? t.stamps : null,
		next: totRemainingDoors().map((d) => d.map + '#' + d.i),
		wearingCostume: totWearing(), costumeInBag: totCostumeIdx() >= 0,
		rankedEventInMin: Math.round(totBossSoon(now) / 60000), pausedForSec: Math.max(0, Math.round((totPauseUntil - now) / 1000)),
		last: totLast,
	};
	if (!quiet) totLog(JSON.stringify(out), '#8b98ab');
	return out;
}

setInterval(() => {
	totTick().catch((e) => { totBusy = false; totLog('tick threw: ' + ((e && e.message) || e), 'red'); });
}, (CONFIG.trickOrTreat && CONFIG.trickOrTreat.tickMs) || 20000);

/* The toolbar is static markup in the game's index.html, so it is normally
   there long before any CODE runs and the dock succeeds first time. If it
   somehow is not, keep checking for a while rather than leaving the panel
   floating for the rest of the session. Only the fallback branch schedules
   this, so a successful dock costs nothing. */
const FARM_UI_REDOCK = { tries: 0, max: 10, everyMs: 1000 };

/* Where the panel ended up and why. Read it from the console with
   farmUiDiag() when the panel is not where it should be - guessing at the
   live client's markup from the open-source snapshot has already cost one
   round. */
const FARM_UI_DIAG = { docked: null, via: null, toprightcorner: null, codebuttons: null, at: null };

function farmUiDiag() {
	const $ = parent.$;
	const out = Object.assign({}, FARM_UI_DIAG);
	if ($) {
		const $panel = $('#farm-spot-ui');
		out.panelExists = $panel.length > 0;
		out.panelParent = $panel.length ? ($panel.parent().attr('id') || $panel.parent().attr('class') || $panel.parent().prop('tagName')) : null;
		out.panelPosition = $panel.length ? $panel.css('position') : null;
		const $cb = $('.codebuttons').first();
		out.codebuttonsParent = $cb.length ? ($cb.parent().attr('id') || $cb.parent().attr('class') || $cb.parent().prop('tagName')) : null;
		out.codebuttonsChain = [];
		let node = $cb;
		for (let i = 0; i < 6 && node.length && node.prop('tagName') !== 'BODY'; i++) {
			out.codebuttonsChain.push(node.prop('tagName') + (node.attr('id') ? '#' + node.attr('id') : '') + (node.attr('class') ? '.' + String(node.attr('class')).split(/\s+/).join('.') : ''));
			node = node.parent();
		}
		out.redockTries = FARM_UI_REDOCK.tries;
	}
	show_json(out);
	return out;
}

function scheduleFarmUiRedock() {
	if (FARM_UI_REDOCK.tries >= FARM_UI_REDOCK.max) return;
	FARM_UI_REDOCK.tries++;
	setTimeout(() => {
		if (!parent.$) return;
		if (parent.$('#toprightcorner').children('.codebuttons').length === 0) {
			scheduleFarmUiRedock();
			return;
		}
		initializeFarmUI();   // removes the floating panel and rebuilds it docked
	}, FARM_UI_REDOCK.everyMs);
}

function initializeFarmUI() {
	if (character.name !== 'Dexon') return;
	if (!parent.$) return;
	const $ = parent.$;
	/* THE DOCUMENT THE PANEL LIVES IN, AND NOT THE ONE THIS SCRIPT RUNS IN.
	   -> RangerComments.md#the-document-the-panel-lives-in-and */
	const doc = parent.document;

	/* Rebuild rather than bail when a panel already exists.
	   -> RangerComments.md#rebuild-rather-than-bail-when-a-panel */
	$('#farm-spot-ui').remove();

	/* Dock into the game's own top-right toolbar, immediately left of the first
	   code button (R&M), rather than floating over the map.

	   Two details decide the insertion point:

	   - It goes NEXT TO .codebuttons, never inside it. clear_buttons() is
	     `$('.codebuttons').html("")` - anything living in that span gets wiped
	     with the buttons.

	   - #toprightcorner carries `bpclicks`: pointer-events:none on itself,
	     with `.bpclicks > *` restoring auto for DIRECT children only. A direct
	     child gets clicks back and its own descendants inherit that, so the
	     candidate chips and the Auto button stay clickable. A deeper insertion
	     point would render but swallow every click.
	   -> RangerComments.md#dock-into-the-game-s-own-top */
	/* Anchor on .codebuttons unscoped, exactly as the game's own
	   add_top_button does (`parent.$(".codebuttons").append(...)`).
	   -> RangerComments.md#anchor-on-codebuttons-unscoped-exactly-as-the */
	const $dock = $('.codebuttons').first();
	const docked = $dock.length > 0;
	FARM_UI_DIAG.docked = docked;
	FARM_UI_DIAG.via = docked ? '.codebuttons' : 'nothing matched - floating';
	FARM_UI_DIAG.toprightcorner = $('#toprightcorner').length;
	FARM_UI_DIAG.codebuttons = $('.codebuttons').length;
	FARM_UI_DIAG.at = new Date().toLocaleTimeString();

	// Docked, it flows in the toolbar row, so it is sized rather than
	// positioned - and kept off the left edge on a narrow window. Floating, it
	// keeps the old fixed placement, drag and resize.
	const frameStyle = docked
		? 'display: inline-block; vertical-align: top; width: 600px; max-width: 60vw; pointer-events: auto;'
		: 'position: fixed; top: 180px; left: 10px; width: 1000px; min-width: 400px; resize: both;';
	const headerCursor = docked ? 'default' : 'move';

	const uiHtml = `
		<div id="farm-spot-ui" style="${frameStyle} min-height: 60px; background: rgba(0, 0, 0, 0.9); color: #fff; border-radius: 6px; font-family: monospace; font-size: 11px; z-index: 9999; box-shadow: 0 4px 6px rgba(0,0,0,0.3); box-sizing: border-box; user-select: none; overflow: auto;">
			<div id="farm-spot-header" style="padding: 6px 12px; background: rgba(30, 30, 30, 0.95); border-top-left-radius: 6px; border-top-right-radius: 6px; cursor: ${headerCursor}; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #555;">
				<div style="font-weight: bold; display: flex; align-items: center; gap: 6px;">
					<span>Farm Spot</span>
					<button id="ui-reset-override" style="background: #444; color: #fff; border: 1px solid #777; cursor: pointer; font-size: 9px; padding: 2px 5px; border-radius: 3px;">Auto</button>
				</div>
				<button id="ui-toggle-expand" style="background: #444; color: #fff; border: 1px solid #777; cursor: pointer; font-size: 10px; padding: 1px 6px; border-radius: 3px;">_</button>
			</div>
			<div id="farm-spot-body" style="padding: 6px 12px; display: flex; align-items: center; gap: 10px; height: calc(100% - 31px); min-height: 42px;">
				<div id="ui-mob-list" style="display: flex; gap: 8px; overflow-x: auto; width: 100%; white-space: nowrap; padding-bottom: 2px; align-items: center; height: 100%;"></div>
			</div>
		</div>
	`;

	if (docked) {
		$dock.before(uiHtml);
	} else {
		$('body').append(uiHtml);
		scheduleFarmUiRedock();
	}

	let isDragging = false;
	let startX, startY;

	if (!docked) $(doc).off("mousedown", "#farm-spot-header").on("mousedown", "#farm-spot-header", function (e) {
		if ($(e.target).is("button")) return;
		isDragging = true;
		startX = e.clientX - $("#farm-spot-ui").offset().left;
		startY = e.clientY - $("#farm-spot-ui").offset().top;
		$("#farm-spot-ui").css("transform", "none");
		e.preventDefault();
	});

	$(doc).off("mousemove").on("mousemove", function (e) {
		if (!isDragging) return;
		const newX = e.clientX - startX;
		const newY = e.clientY - startY;
		$("#farm-spot-ui").css({ left: newX + "px", top: newY + "px", bottom: "auto" });
	});

	$(doc).off("mouseup").on("mouseup", function () { isDragging = false; });

	let isExpanded = true;
	$(doc).off("click", "#ui-toggle-expand").on("click", "#ui-toggle-expand", function () {
		isExpanded = !isExpanded;
		if (isExpanded) {
			$("#farm-spot-body").css("display", "flex");
			$(this).text("_");
		} else {
			$("#farm-spot-body").css("display", "none");
			$(this).text("+");
		}
	});

	$(doc).off("click", "#ui-reset-override").on("click", "#ui-reset-override", function () {
		manualOverride = null;
		runFarmSearch();
	});

	$(doc).off("click", ".farm-spot-row").on("click", ".farm-spot-row", function () {
		const idx = $(this).data("idx");
		const candidate = lastCandidates[idx];
		if (!candidate) return;
		if (manualOverride && manualOverride.home === candidate.home && manualOverride.mobMap === candidate.mobMap) {
			manualOverride = null;
		} else {
			manualOverride = candidate;
		}
		runFarmSearch();
	});

	game_log(`Farm Spot UI: ${docked ? 'docked' : 'FLOATING'} (${FARM_UI_DIAG.via}) - farmUiDiag() for details`, docked ? '#00FF00' : 'orange');

	updateFarmUI();
}

function updateFarmUI() {
	if (character.name !== 'Dexon') return;
	if (!parent.$) return;
	if (lastCandidates.length === 0) lastCandidates = scoreAllFarmSpots();
	const $ = parent.$;
	const $list = $('#ui-mob-list');
	if ($list.length === 0) return;

	const rows = lastCandidates.slice(0, 20).map((c, idx) => {
		const isActive = manualOverride
			? (manualOverride.home === c.home && manualOverride.mobMap === c.mobMap)
			: (idx === 0 && !manualOverride);
		const bg = isActive ? '#2a6' : '#333';
		return `
			<div class="farm-spot-row" data-idx="${idx}" style="cursor: pointer; background: ${bg}; border: 1px solid #777; border-radius: 3px; padding: 4px 8px; display: inline-block;">
				<div style="font-weight: bold;">${c.home}</div>
				<div style="font-size: 9px; opacity: 0.85;">${c.mobMap} - ${c.expPerSecond.toFixed(1)} xp/s - ${(c.uptimeFraction * 100).toFixed(0)}% up</div>
			</div>
		`;
	}).join('');

	$('#ui-reset-override').css('background', manualOverride ? '#444' : '#2a6');
	$list.html(rows || '<div style="opacity:0.7;">No viable candidates yet</div>');
}

// ============================================================================
// MONSTER HUNT - THE LEADER HALF. Dexon decides; Priest.js and Mage.js obey.
// ============================================================================
/* THE TOGGLE IS CONFIG.monsterHunt.enabled, default FALSE, and mhOn()/mhOff()
   flip it at runtime. Off means the party farms exactly as it did before: this
   block releases the override it set, tells the other two they are farming
   again, and stops touching anything.
   -> RangerComments.md#the-toggle-is-config-monsterhunt-enabled-default */
const MH_DAISY = { map: 'main', x: 126, y: -413 };
const MH_DAISY_RADIUS = 340;
const MH_FOLLOWERS = ['FatherToken', 'MageofOz'];
const MH_KEY = 'mh_state';

let mhPhase = 'off';          // off | gather | hunt | turnin
let mhPool = {};              // name -> last report
let mhPick = null;            // { owner, id, map, x, y, c, estSec, b }
let mhPickAt = 0;             // when it was chosen - a follower report older than this cannot refute it
let mhSpotFixed = false;      // have we already terrain-checked this pick's centre
let mhPhaseSince = 0;
let mhAskedAt = 0;
let mhModeSent = null;
let mhDone = [];              // owners whose hunt reached zero this cycle
let mhBusy = false;           // a Daisy trip owns movement; mainLoop stands down

/* THE TOGGLE SURVIVES A SHARD HOP.
   -> RangerComments.md#the-toggle-survives-a-shard-hop-mhon */
let mhToggle = null;   // null = follow the source; true/false = stored choice

function mhStored() {
	try { const s = scopedGetLegacy(MH_KEY); return (s && typeof s === 'object') ? s : null; } catch (e) { return null; }
}

function mhCfg() {
	const c = CONFIG.monsterHunt || { enabled: false };
	if (mhToggle === null) return c;
	return Object.assign({}, c, { enabled: mhToggle });
}

function mhSaveToggle(v) {
	mhToggle = v;
	try { scopedSet(MH_KEY, { enabled: v, at: new Date().toISOString() }); }
	catch (e) { mhLog('could not persist the toggle - it will not survive a hop', 'red'); }
}

/* Read once at load, so a reload picks the operator's choice back up. */
(function () {
	const st = mhStored();
	if (st && typeof st.enabled === 'boolean') mhToggle = st.enabled;
})();
function mhLog(m, c) { try { game_log('[mh] ' + m, c || '#9FD3FF'); } catch (e) { } console.log('[mh] ' + m); }
function mhShard() { try { return String(parent.server_region) + ' ' + String(parent.server_identifier); } catch (e) { return null; } }
function mhSelfHunt() { try { return (character.s && character.s.monsterhunt) || null; } catch (e) { return null; } }
function mhAtDaisy() {
	try {
		return character.map === MH_DAISY.map
			&& Math.hypot(character.x - MH_DAISY.x, character.y - MH_DAISY.y) <= MH_DAISY_RADIUS;
	} catch (e) { return false; }
}

/* Our own report, in the same shape the followers send, so the pool is uniform
   and the ranking does not special-case the leader. */
function mhSelfReport() {
	const h = mhSelfHunt(), shard = mhShard();
	return { id: h ? h.id : null, c: h ? h.c : null, ms: h ? h.ms : null, sn: h ? h.sn : null,
		shard: shard, stale: !!(h && shard && h.sn !== shard), atDaisy: mhAtDaisy(),
		esize: character.esize, why: 'self', at: Date.now() };
}

function mhRefresh() { mhPool[character.name] = mhSelfReport(); }

/* SAFETY AND COST, from the party's own model. Returns null when this monster
   is not something the party should be standing in. */
/* How far a park point may sit from the rectangle it serves. Two real data
   points set it and neither is near the line: the measured points are 140 and
   148 out, and the nearest WRONG-pack match is 861. 400 has wide margin on
   both sides rather than being tuned to either. */
const HUNT_PARK_MAX_GAP = 400;

function rectGap(x, y, r) {
	if (!Array.isArray(r) || r.length < 4) return null;
	const dx = Math.max(r[0] - x, 0, x - r[2]);
	const dy = Math.max(r[1] - y, 0, y - r[3]);
	return Math.hypot(dx, dy);
}

/* The park point for a rage-boxed spot, taken from the achievement queue.

   WHY A LOOKUP AND NOT rageEscape(). rageEscape returns the nearest point
   outside the rectangle - pure geometry, no knowledge of walls. v80 is the
   record of why that is not enough: (415,-986) sits outside everything and is
   genuinely unreachable, a flood from it stopping after 385 cells with
   smart_move refusing the trip. Computing a park point and trusting it is the
   failure this version exists to stop repeating. The queue's points were
   walked. (290,-990) is 140 from the mummy rage rectangle and 148 from
   booboo's - ONE point serving both packs, which a nearest-exit rule cannot
   produce because it optimises distance rather than usefulness.
   -> RangerComments.md#the-park-point-for-a-rage-boxed */
function huntParkPoint(monster, mapName, rect) {
	let q = null;
	try { q = achvCfg().queue; } catch (e) { return null; }
	if (!Array.isArray(q)) return null;
	let best = null;
	for (let i = 0; i < q.length; i++) {
		const e = q[i];
		if (!e || e.map !== mapName) continue;
		if (e.m !== monster && !(Array.isArray(e.also) && e.also.indexOf(monster) >= 0)) continue;
		if (typeof e.x !== 'number' || typeof e.y !== 'number') continue;
		let inside = true;
		try { inside = !!((typeof rageHit === 'function') ? rageHit(mapName, e.x, e.y) : true); }
		catch (err) { inside = true; }
		if (inside) continue;
		const gap = rectGap(e.x, e.y, rect);
		if (gap === null || gap > HUNT_PARK_MAX_GAP) continue;
		if (!best || gap < best.gap) best = { x: e.x, y: e.y, via: e.m, gap: Math.round(gap), idx: i };
	}
	return best;
}

function mhEvaluate(id) {
	if (!id) return null;
	if (!parent.G || !parent.G.maps || !parent.G.monsters) return null;
	const mob = parent.G.monsters[id];
	if (!mob || !mob.hp) return null;
	/* THE PURE-DAMAGE REFUSAL WAS REMOVED IN v81, and what it got wrong is worth
	   keeping because the shape recurs.
	   -> RangerComments.md#the-pure-damage-refusal-was-removed-in */

	const dps = getPartyDps();
	const heal = estimateHealThroughput();
	const blacklist = getBlacklist();
	let best = null;

	for (const mapName in parent.G.maps) {
		const mapData = parent.G.maps[mapName];
		if (!isMapSafeForFarming(mapData) || !mapData.monsters) continue;
		for (const spot of mapData.monsters) {
			if (spot.type !== id) continue;
			if (!Array.isArray(spot.boundary) || spot.boundary.length < 4) continue;
			const key = spotKey(id, mapName);
			if (isPermanentlyBlacklisted(key)) { /* whitelisted spots are fine */ }
			else if (blacklist[key]) continue;

			const eff = Math.max((mitigated(dps.physical, mob.armor || 0) + mitigated(dps.magical, mob.resistance || 0)) * dodgeMultiplier(mob), 1);
			/* A RAGE-BOXED SPOT IS PULLED, NOT WADED INTO, and the planner has
			   to know that or it prices a fight nobody takes. Modelling the
			   whole pack put booboo at 220 x 1.2 x 4 = 1,056 dps incoming
			   against a party that meets 264, which is the entire point of the
			   rage routing.

			   READ OFF THE SPOT RECORD, so this names no monster and needs no
			   table: spot.rage is the same G.maps[map].monsters[i].rage that
			   rageBoxes() reads, so every rage-boxed spot on every map is
			   covered the day the game adds one. When the pull is disabled the
			   pack really does all come, and the pessimistic count is correct
			   again - which is why this is a branch and not a replacement. */
			const raged = Array.isArray(spot.rage) && spot.rage.length === 4;
			const rcfg = (typeof rageCfg === 'function') ? rageCfg() : null;
			const pulled = raged && !!(rcfg && rcfg.enabled);
			const attackers = pulled
				? Math.max(1, (rcfg && rcfg.concurrent) || 1)
				: Math.min(spot.count || 1, FARM_SEARCH.maxConcurrentAttackers);
			/* Raw hit, our own mitigation not applied - see the long note in
			   scoreAllFarmSpots. Pessimistic deliberately; it can only refuse a
			   hunt spot, never admit a lethal one. */
			const incoming = (mob.attack || 0) * (mob.frequency || 1) * attackers;

			let uptime = 1;
			if (heal - incoming < 0) {
				const ttd = (3 * (character.max_hp || 2000)) / Math.abs(heal - incoming);
				const deathsPerHour = 3600 / ttd;
				uptime = Math.max(0, (3600 - deathsPerHour * FARM_SEARCH.avgDeathDowntimeSec) / 3600);
			}
			if (uptime < FARM_SEARCH.minUptimeFraction) continue;

			/* Throughput is the lesser of how fast we can kill and how fast they
			   come back - a four-spawn pack on a 60s respawn is supply-bound no
			   matter how hard the party hits. */
			const killRate = Math.min(eff / mob.hp, (spot.count || 1) / (mob.respawn || 1));
			if (!(killRate > 0)) continue;
			const [bx1, by1, bx2, by2] = spot.boundary;

			/* THE CENTRE OF A RAGE BOX IS THE ONE PLACE WE MUST NOT GO, and for
			   booboo the rage rectangle IS the boundary, so the centre is not
			   merely inside it - it is the furthest point from any exit.
			   Travelling there cannot work: refusing it is rageRoute's whole
			   job, and it refuses in a loop, which is how the party spent an
			   hour on travel attempt 1033.

			   No qualifying park point means SKIP THE SPOT, not guess one.
			   Returning null propagates to mhScore's `if (!ev) return null` and
			   the hunt is declined, costing one slot and a clock. */
			let sx = (bx1 + bx2) / 2, sy = (by1 + by2) / 2, park = null;
			if (raged) {
				park = huntParkPoint(id, mapName, spot.rage);
				if (!park) {
					mhLog('skipping ' + id + '@' + mapName + ' - rage-boxed, and no park point in '
						+ 'CONFIG.achievements.queue is both outside the boxes and within '
						+ HUNT_PARK_MAX_GAP + ' of this pack; refusing rather than guessing', 'orange');
					continue;
				}
				sx = park.x; sy = park.y;
			}

			const cand = { id: id, map: mapName, x: sx, y: sy,
				/* keep the spawn box: the centre may be unstandable and mhWalkableSpot
				   needs somewhere to look for a point that is not. */
				b: [bx1, by1, bx2, by2],
				park: park || undefined,
				uptime: uptime, killRate: killRate * uptime, count: spot.count || 1 };
			if (!best || cand.killRate > best.killRate) best = cand;
		}
	}
	return best;
}

/* Seconds to clear this hunt, or null when it should not be attempted. */
function mhScore(rep) {
	if (!rep || !rep.id || !rep.c) return null;
	if (rep.stale) return null;
	const cfg = mhCfg();
	const ev = mhEvaluate(rep.id);
	if (!ev) return null;
	const sec = rep.c / ev.killRate;
	if (cfg.maxEstMin && sec > cfg.maxEstMin * 60) return null;
	/* No point starting something the hunt's own clock will outlive. */
	const leftSec = Math.max(0, (rep.ms || 0) / 1000);
	if (sec > leftSec) return null;
	return Object.assign({}, ev, { estSec: sec, c: rep.c, msLeft: rep.ms });
}

/* THE WAIT RULE. Choose only once every member has settled, where settled means
   we have heard SOMETHING definite from them: a hunt they accepted, a hunt they
   were already holding and cannot reroll (the operator's exception - its timer
   has not expired, so waiting for them to accept would be waiting for ever), or
   a flat refusal. A member we have heard nothing at all from is not settled, and
   acceptWaitMs is the backstop so one silent character cannot stall the cycle. */
function mhSettled(name) {
	const r = mhPool[name];
	if (!r) return false;
	if (r.id) return true;                       // holding or accepted something
	return r.why === 'refused' || r.why === 'no slot'
		|| r.why === 'could not reach Daisy' || r.why === 'emit failed';
}

function mhRoster() { return [character.name].concat(MH_FOLLOWERS.filter((n) => mhInParty(n))); }

function mhInParty(name) {
	try { const p = (typeof get_party === 'function' ? get_party() : null) || {}; return !!p[name]; }
	catch (e) { return false; }
}

function mhAllSettled() {
	const roster = mhRoster();
	const unsettled = roster.filter((n) => !mhSettled(n));
	if (!unsettled.length) return { ready: true, why: 'all ' + roster.length + ' settled' };
	if (Date.now() - mhPhaseSince > (mhCfg().acceptWaitMs || 90000))
		return { ready: true, why: 'waited out ' + unsettled.join(', ') };
	return { ready: false, waiting: unsettled };
}

/* The notification the operator asked for: are we walking to a hunt, or to a
   farm? Sent on every transition and whenever the target changes, so the other
   two always have a reason for where they are being taken. */
function mhSendMode(mode, target, map, why) {
	const sig = mode + '|' + (target || '') + '|' + (map || '') + '|' + (why || '');
	if (sig === mhModeSent) return;
	mhModeSent = sig;
	try { plSend(MH_FOLLOWERS, { message: 'mh_mode', mode: mode, target: target || null, map: map || null, why: why || null }); }
	catch (e) { mhLog('mode broadcast failed: ' + e, 'orange'); }
	mhLog(mode === 'hunt' ? ('hunting ' + target + '@' + map + (why ? ' - ' + why : '')) : ('farming' + (why ? ' - ' + why : '')),
		mode === 'hunt' ? '#FFD700' : '#7FD98A');
}

function mhTell(names, message, extra) {
	try { plSend(names, Object.assign({ message: message }, extra || {})); }
	catch (e) { mhLog(message + ' to ' + names + ' failed: ' + e, 'orange'); }
}

/* Pin the spot the same way the achievement queue does, for the same reason:
   checkFarmEconomics will otherwise blacklist a spot chosen for a reason it
   cannot see, and PERMANENT_WHITELIST is rebuilt from source on load so the
   addition has to be re-made rather than assumed. */
/* THE SPOT IS A BOUNDING-BOX CENTRE, AND A CENTRE NEED NOT BE STANDABLE.
   -> RangerComments.md#the-spot-is-a-bounding-box-centre */
function mhWalkableSpot(pick) {
	if (!pick || !pick.b || typeof can_move_to !== 'function') return null;
	if (character.map !== pick.map) return null;
	if (can_move_to(pick.x, pick.y)) return null;
	const x1 = pick.b[0], y1 = pick.b[1], x2 = pick.b[2], y2 = pick.b[3];
	const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
	const hw = Math.abs(x2 - x1) / 2, hh = Math.abs(y2 - y1) / 2;
	let best = null, bestD = Infinity;
	for (let i = -3; i <= 3; i++) {
		for (let j = -3; j <= 3; j++) {
			if (!i && !j) continue;
			const x = cx + (hw * i) / 3, y = cy + (hh * j) / 3;
			if (!can_move_to(x, y)) continue;
			const d = Math.hypot(x - cx, y - cy);
			if (d < bestD) { best = [x, y]; bestD = d; }
		}
	}
	return best;
}

function mhApply(pick) {
	try { PERMANENT_WHITELIST.add(spotKey(pick.id, pick.map)); getBlacklist(); } catch (e) { }
	manualOverride = { home: pick.id, mobMap: pick.map, x: pick.x, y: pick.y, expPerSecond: 0, uptimeFraction: pick.uptime || 1 };
	try { runFarmSearch(); } catch (e) { mhLog('runFarmSearch threw: ' + e, 'red'); }
	mhSendMode('hunt', pick.id, pick.map, pick.owner + "'s hunt, " + pick.c + ' left, ~' + Math.round(pick.estSec / 60) + ' min');
}

function mhOwnsSpot() {
	return !!(mhCfg().enabled && mhPick && manualOverride
		&& manualOverride.home === mhPick.id && manualOverride.mobMap === mhPick.map);
}

function mhRelease(why) {
	if (mhPick && manualOverride && manualOverride.home === mhPick.id && manualOverride.mobMap === mhPick.map) {
		manualOverride = null;
		try { runFarmSearch(); } catch (e) { }
	}
	mhPick = null;
	mhPickAt = 0;
	mhSpotFixed = false;
	mhSendMode('farm', null, null, why || null);
}

function mhReset(why, phase) {
	mhRelease(why);
	mhPool = {};
	mhDone = [];
	mhPhase = phase || 'off';
	mhPhaseSince = Date.now();
	mhAskedAt = 0;
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
	   -> RangerComments.md#take-the-wheel-from-a-trip-already */
	if (typeof travelState !== 'undefined' && travelState.inFlight) {
		mhLog('taking movement from a live trip to ' + travelState.target, '#8b98ab');
		travelState.attemptId++;      // orphan it: travelTo's mine() goes false
		travelState.inFlight = false;
	}
	try { await noHang(smart_move({ map: MH_DAISY.map, x: MH_DAISY.x, y: MH_DAISY.y }), 'mh daisy', 120000); }
	catch (e) { mhLog('could not reach Daisy: ' + ((e && (e.reason || e.message)) || e), 'orange'); }
	return mhAtDaisy();
}

async function mhAcceptSelf() {
	const have = mhSelfHunt();
	if (have && have.c) { mhRefresh(); mhPool[character.name].why = 'already held'; return true; }
	if (!character.esize) { mhRefresh(); mhPool[character.name].why = 'no slot'; mhLog('no free slot - not accepting', 'orange'); return false; }
	/* The flag has to span the walk, the emit AND the settle sleep, not just the
	   walk: mainLoop would otherwise start dragging us back to the farm spot
	   between arriving and the server answering. */
	mhBusy = true;
	try {
		if (!(await mhGoDaisy())) { mhRefresh(); mhPool[character.name].why = 'could not reach Daisy'; return false; }
		try { parent.socket.emit('monsterhunt'); } catch (e) { mhLog('emit failed: ' + e, 'red'); mhRefresh(); mhPool[character.name].why = 'emit failed'; return false; }
		await sleep(1500);
		mhRefresh();
		const h = mhSelfHunt();
		mhPool[character.name].why = h ? 'accepted' : 'refused';
		mhLog(h ? ('accepted ' + h.id + ' x' + h.c) : 'the server refused the hunt', h ? '#7FD98A' : 'orange');
		return !!h;
	} finally { mhBusy = false; }
}

async function mhTurnInSelf() {
	const h = mhSelfHunt();
	if (!h || h.c) return false;
	mhBusy = true;
	try {
		if (!(await mhGoDaisy())) return false;
		try { parent.socket.emit('monsterhunt'); } catch (e) { mhLog('emit failed: ' + e, 'red'); return false; }
		await sleep(1500);
		const done = !mhSelfHunt();
		mhLog(done ? 'turned in - token collected' : 'turn-in did not take', done ? '#7FD98A' : 'orange');
		mhRefresh();
		return done;
	} finally { mhBusy = false; }
}

/* Follower reports arrive here, routed from on_cm. */
function mhOnReport(name, data) {
	mhPool[name] = { id: data.id || null, c: data.c, ms: data.ms, sn: data.sn, shard: data.shard,
		stale: !!data.stale, atDaisy: !!data.atDaisy, esize: data.esize, why: data.why || 'asked', at: Date.now() };
	mhLog(name + ': ' + (data.id ? (data.id + ' x' + data.c + (data.stale ? ' STALE(' + data.sn + ' vs ' + data.shard + ')' : '')) : ('none - ' + data.why)), '#8b98ab');
}

function mhStale() {
	const shard = mhShard();
	const bad = [];
	for (const n in mhPool) { const r = mhPool[n]; if (r && r.id && r.sn && shard && r.sn !== shard) bad.push(n); }
	return bad;
}

async function mhTick() {
	const cfg = mhCfg();
	if (!cfg.enabled) {
		if (mhPhase !== 'off') { mhLog('disabled - handing the spot back', '#FFD700'); mhReset('monster hunt turned off', 'off'); }
		return;
	}
	if (mhPhase === 'off') { mhPhase = 'gather'; mhPhaseSince = Date.now(); mhPool = {}; mhDone = []; mhLog('enabled - collecting hunts', '#FFD700'); }
	/* A cipher gathering window has the spot. The hunt would re-assert its own
	   pick every tick and the two would trade the party back and forth; it
	   waits instead, and picks up again when the window closes. */
	if (typeof cipherOwnsSpot === 'function' && cipherOwnsSpot()) return;

	/* Our own live state first, THEN the staleness judgement. Reading the pool
	   before refreshing it meant our own shard change was only ever noticed on
	   the FOLLOWING tick, because nothing had written our current sn yet - the
	   harness caught that, and a tick of grinding for no credit is exactly what
	   this check exists to prevent. */
	mhRefresh();

	/* A hop invalidates every hunt taken on the old shard, silently. Catch it
	   before the party spends the window killing things for no credit. */
	const stale = mhStale();
	if (stale.length && mhPhase !== 'gather') {
		mhLog('shard changed - ' + stale.join(', ') + " hunt(s) no longer count, restarting", 'orange');
		mhReset('shard changed', 'gather');
		return;
	}

	if (mhPhase === 'gather') {
		mhRefresh();
		if (!mhSettled(character.name)) {
			mhSendMode('farm', null, null, 'collecting hunts');
			await mhAcceptSelf();
		}
		if (Date.now() - mhAskedAt > (cfg.askMs || 20000)) {
			mhAskedAt = Date.now();
			for (const n of MH_FOLLOWERS) {
				if (!mhInParty(n)) continue;
				mhTell([n], mhSettled(n) ? 'mh_ask' : 'mh_accept');
			}
		}
		const s = mhAllSettled();
		if (!s.ready) return;

		const ranked = mhRoster().map((n) => {
			const sc = mhScore(mhPool[n]);
			return sc ? Object.assign({ owner: n }, sc) : null;
		}).filter(Boolean).sort((a, b) => a.estSec - b.estSec);

		if (!ranked.length) {
			const held = mhRoster().filter((n) => mhPool[n] && mhPool[n].id);
			mhLog('nothing worth hunting (' + s.why + '): '
				+ (held.length ? held.map((n) => n + '=' + mhPool[n].id + ' x' + mhPool[n].c).join(', ') : 'no hunts at all')
				+ ' - farming until they expire', 'orange');
			mhReset('no acceptable target', 'gather');
			mhPhaseSince = Date.now() + (cfg.retryMs || 300000) - (cfg.acceptWaitMs || 90000);
			return;
		}
		mhPick = ranked[0];
		mhPickAt = Date.now();
		mhSpotFixed = false;
		mhLog('picked ' + mhPick.owner + "'s " + mhPick.id + ' x' + mhPick.c + ' (~'
			+ Math.round(mhPick.estSec / 60) + ' min) from ' + ranked.length + ' viable; ' + s.why, '#FFD700');
		mhPhase = 'hunt';
		mhPhaseSince = Date.now();
		mhApply(mhPick);
		return;
	}

	if (mhPhase === 'hunt') {
		if (!mhPick) { mhPhase = 'gather'; mhPhaseSince = Date.now(); return; }
		if (!mhOwnsSpot()) { mhLog('re-asserting ' + mhPick.id + '@' + mhPick.map, '#8b98ab'); mhApply(mhPick); }

		mhRefresh();
		if (Date.now() - mhAskedAt > (cfg.askMs || 20000)) {
			mhAskedAt = Date.now();
			for (const n of MH_FOLLOWERS) if (mhInParty(n)) mhTell([n], 'mh_ask');
		}

		/* THE PICK CAN DIE UNDER US, AND NOTHING LOOKED. The only test below is
		   "the owner still holds this hunt AND has finished it". There was no
		   branch at all for the owner's hunt having ROLLED OVER to a different
		   one, so a dead pick fell through to the huntCapMs check and the party
		   kept walking to it for up to twenty-five minutes.
		   -> RangerComments.md#the-pick-can-die-under-us-and */
		const cur = mhPool[mhPick.owner];
		const refutable = cur && (mhPick.owner === character.name || (cur.at || 0) > mhPickAt);
		if (refutable && cur.id !== mhPick.id) {
			mhLog(mhPick.owner + ' no longer holds ' + mhPick.id + ' (now '
				+ (cur.id ? cur.id + ' x' + cur.c : 'nothing') + ') - pick is dead, re-gathering', 'orange');
			mhReset('pick no longer held', 'gather');
			return;
		}

		/* We are on the pick's map now, so the terrain question can finally be
		   asked. Once per pick: a repeated scan would re-apply every tick. */
		if (!mhSpotFixed && character.map === mhPick.map) {
			mhSpotFixed = true;
			const fix = mhWalkableSpot(mhPick);
			if (fix) {
				mhLog('spot centre ' + Math.round(mhPick.x) + ',' + Math.round(mhPick.y)
					+ ' is not standable - using ' + Math.round(fix[0]) + ',' + Math.round(fix[1]), '#FFD700');
				mhPick.x = fix[0];
				mhPick.y = fix[1];
				mhApply(mhPick);
			}
		}

		const owner = mhPool[mhPick.owner];
		if (owner && owner.id === mhPick.id && !owner.c) {
			mhLog(mhPick.owner + ' finished ' + mhPick.id, '#7FD98A');
			if (mhDone.indexOf(mhPick.owner) < 0) mhDone.push(mhPick.owner);

			/* Straight to Daisy. The latency floor here is the tick, not the walk:
			   mhTick runs every CONFIG.monsterHunt.tickMs (5s), so a hunt is banked
			   within one tick of its count reaching zero rather than at the end of a
			   cycle that could still have another 25-minute target in it. */
			if (cfg.turnInImmediately !== false) {
				mhPhase = 'turnin';
				mhPhaseSince = Date.now();
				mhSendMode('farm', null, null, 'banking ' + mhPick.id + ' now');
				return;
			}

			/* Another hunt still worth doing, and enough clock left on the ones
			   already finished to bank them afterwards? Then keep going. */
			const next = mhRoster().filter((n) => n !== mhPick.owner && mhDone.indexOf(n) < 0)
				.map((n) => { const sc = mhScore(mhPool[n]); return sc ? Object.assign({ owner: n }, sc) : null; })
				.filter(Boolean).sort((a, b) => a.estSec - b.estSec);
			const margin = Math.min.apply(null, mhDone.map((n) => (mhPool[n] && mhPool[n].ms) || 0).concat([Infinity]));
			if (next.length && margin > (cfg.turnInMarginMs || 420000)) {
				mhPick = next[0];
				mhPickAt = Date.now();
				mhSpotFixed = false;
				mhLog('next: ' + mhPick.owner + "'s " + mhPick.id + ' x' + mhPick.c, '#FFD700');
				mhApply(mhPick);
				return;
			}
			mhPhase = 'turnin';
			mhPhaseSince = Date.now();
			mhSendMode('farm', null, null, 'banking ' + mhDone.length + ' token(s)');
			return;
		}

		if (Date.now() - mhPhaseSince > (cfg.huntCapMs || 1500000)) {
			mhLog('gave up on ' + mhPick.id + ' after ' + Math.round((Date.now() - mhPhaseSince) / 60000) + ' min', 'orange');
			mhPhase = mhDone.length ? 'turnin' : 'gather';
			mhPhaseSince = Date.now();
			mhRelease('hunt cap reached');
		}
		return;
	}

	if (mhPhase === 'turnin') {
		mhRelease('turning in');
		mhBusy = true;
		let reached;
		try { reached = await mhGoDaisy(); } finally { mhBusy = false; }
		if (!reached) {
			if (Date.now() - mhPhaseSince > 180000) { mhLog('cannot reach Daisy - giving up on this cycle', 'red'); mhReset('could not bank', 'gather'); }
			return;
		}
		const banked = await mhTurnInSelf();

		/* Ask for the next one here, while still standing at her. mhAcceptSelf
		   guards itself - it returns early when a live hunt is already held, so
		   this cannot reroll a hunt the party is part-way through, and it emits
		   nothing in that case. When the finished hunt belonged to a FOLLOWER we
		   hold a live one of our own, so that guard is what makes this safe to
		   call unconditionally. */
		if (cfg.reAcceptAtDaisy !== false) {
			const got = await mhAcceptSelf();
			if (banked) mhLog(got ? 'banked and took the next hunt in one trip' : 'banked, but no new hunt was issued', got ? '#7FD98A' : 'orange');
		}

		/* THE FOLLOWERS CANNOT BE TOLD BOTH THINGS AT ONCE. Their mhAccept and
		   mhTurnIn share a single mhBusy flag, and each refuses outright while the
		   other holds it - an mh_accept arriving behind an mh_turnin is answered
		   with "already on a Daisy trip" and dropped, not queued. So only the
		   turn-in is sent here, and their re-accept comes from the gather phase,
		   which mhReset below primes by zeroing mhAskedAt: gather asks every
		   unsettled follower on its very next pass and keeps asking every askMs
		   until it lands, so a follower still walking to Daisy is simply picked up
		   on a later pass. Nothing is lost by not racing it. */
		for (const n of MH_FOLLOWERS) if (mhInParty(n) && mhDone.indexOf(n) >= 0) mhTell([n], 'mh_turnin');
		await sleep(3000);
		mhLog('banked ' + mhDone.length + ' hunt(s) - re-gathering', '#7FD98A');
		mhReset('cycle complete', 'gather');
		return;
	}
}

// ---- console helpers -------------------------------------------------------
function mhOn() { mhSaveToggle(true); mhLog('ON - and it will stay on across a shard hop', '#7FD98A'); return mhStatus(); }
function mhOff() { mhSaveToggle(false); mhReset('turned off by hand', 'off'); mhLog('OFF - farming as normal, and it stays off across a hop', '#FFD700'); return mhStatus(); }
/* Drop the stored choice and go back to obeying CONFIG.monsterHunt.enabled. */
function mhForget() {
	mhToggle = null;
	try { scopedSet(MH_KEY, null); } catch (e) { }
	mhLog('stored toggle cleared - following the source default ('
		+ ((CONFIG.monsterHunt && CONFIG.monsterHunt.enabled) ? 'ON' : 'OFF') + ') again', '#FFD700');
	return mhStatus();
}
function mhSkip() {
	if (!mhPick) { mhLog('nothing picked', '#8b98ab'); return null; }
	mhLog('skipping ' + mhPick.id + ' by hand', '#FFD700');
	mhRelease('skipped by hand');
	mhPhase = 'gather';
	mhPhaseSince = Date.now();
	return mhStatus();
}
function mhStatus() {
	mhRefresh();
	const rows = {};
	for (const n of mhRoster()) {
		const r = mhPool[n];
		const sc = mhScore(r);
		rows[n] = r ? ((r.id ? r.id + ' x' + r.c + ' (' + Math.round((r.ms || 0) / 60000) + ' min)' : 'none')
			+ (r.stale ? ' STALE' : '') + ' - ' + r.why
			+ (r.id ? (sc ? '  viable ~' + Math.round(sc.estSec / 60) + ' min' : '  REFUSED') : '')) : 'no report';
	}
	const out = { enabled: !!mhCfg().enabled,
		toggle: mhToggle === null ? 'from source' : ('stored ' + (mhToggle ? 'ON' : 'OFF')),
		phase: mhPhase, busy: mhBusy, shard: mhShard(),
		pick: mhPick ? (mhPick.owner + ':' + mhPick.id + '@' + mhPick.map) : null,
		done: mhDone.slice(), reports: rows, ownsSpot: mhOwnsSpot(),
		waiting: mhAllSettled().waiting || null };
	console.log('[mh]', out);
	return out;
}

function on_cm(name, data) {
	if (!plFirstTime(data && data._plid)) return;   // same message may arrive twice: in-game and relayed
	if (data.message === 'boss') { bossOnCall(name, data); return; }
	if (data.message === 'rageentry') { rageEntryOnCall(name, data); return; }
	if (data.message === 'ragetown') { rageTownOnCall(name, data); return; }
	if (data.message === 'mh_report' && (name === 'FatherToken' || name === 'MageofOz')) { mhOnReport(name, data); return; }
	if (data.message === 'dps_report' && partyDpsReports[name]) {
		partyDpsReports[name] = { type: data.damageType, dps: data.dps, maxHp: data.maxHp, level: data.level, receivedAt: Date.now() };
		return;
	}

	if ((name === 'FatherToken' || name === 'MageofOz') && data.message === 'blacklist_spot') {
		/* THE RECEIVER VALIDATES TOO: a follower's verdict taken during a trip,
		   or just after one, is about the trip. Refused until farmVerdictHeld()
		   lets go, whatever the follower's build. */
		if (farmVerdictHeld()) {
			game_log(`Ignored ${name}'s blacklist request for ${data.home}@${data.mobMap} - on or just off a boss trip`, 'orange');
			return;
		}
		const key = addToBlacklist(data.home, data.mobMap, data.reason, name, data.details);
		if (!key) return;   // whitelisted - addToBlacklist said so, and nothing changed
		game_log(`Blacklisted "${key}" - ${data.reason} (reported by ${name})`, 'red');
		if (manualOverride && spotKey(manualOverride.home, manualOverride.mobMap) === key) {
			manualOverride = null;
			game_log(`Cleared manual override - it pointed at the spot just blacklisted`, 'orange');
		}
		runFarmSearch();
		return;
	}

	if (name !== 'Meltymerch') return;

	if (data.message === 'come_to_merchant') {
		state.waitingForMerchant = true;
		state.waitingForMerchantSince = Date.now();
		game_log('Meltymerch needs me to come to him', '#FFD700');
		smart_move({ x: data.x, y: data.y, map: data.map });
	}
	if (data.message === 'merchant_done') {
		state.waitingForMerchant = false;
		game_log('Merchant business done - resuming', '#00FF00');
	}
	if (data.message === 'cipher_stock') cipherOnStock(data);
}

function on_party_request(name) {
	if (CONFIG.party.groupMembers.includes(name)) {
		console.log('Accepting party request from ' + name);
		accept_party_request(name);
	}
}

function on_party_invite(name) {
	if (CONFIG.party.groupMembers.includes(name)) {
		console.log('Accepting party invite from ' + name);
		accept_party_invite(name);
	}
}

function sendUpdates() {
	if (!parent.$) return;
	parent.socket.emit('send_updates', {});
}
setInterval(sendUpdates, 20000);

/* Tell the party where we are farming.
   -> RangerComments.md#tell-the-party-where-we-are-farming */
const FARM_SPOT = {
	burstMs: 5000,
	burstForMs: 60000,
	keepaliveMs: 30000,
	audience: ['FatherToken', 'MageofOz'],
};

let farmSpotLast = null;       // the spot as last announced
let farmSpotSentAt = 0;
let farmSpotBurstUntil = 0;
let farmSpotKnownParty = new Set();

function farmSpotKey() {
	if (!home || !mobMap || !destination) return null;
	return `${home}|${mobMap}|${Math.round(destination.x)}|${Math.round(destination.y)}`;
}

/* Who is in the party that we care about, right now. */
function farmSpotAudienceInParty() {
	const party = (typeof get_party === 'function' ? get_party() : null) || {};
	return new Set(FARM_SPOT.audience.filter((n) => party[n]));
}

function sendFarmSpot(reason) {
	if (!home || !mobMap || !destination) return false;
	if (!farmSpotBootReady()) return false;   // see farmBootBossEval
	plSend(FARM_SPOT.audience, {
		message: 'farm_spot',
		home,
		mobMap,
		x: destination.x,
		y: destination.y,
		also: rageAlso,
		pullConcurrent: rageCfg().concurrent,
	});
	farmSpotLast = farmSpotKey();
	farmSpotSentAt = Date.now();
	if (reason) plLog(`farm spot -> ${reason}`, '#8b98ab');
	return true;
}

function farmSpotTick() {
	const key = farmSpotKey();
	if (!key) return;
	const now = Date.now();

	const present = farmSpotAudienceInParty();
	const joined = [...present].filter((n) => !farmSpotKnownParty.has(n));
	farmSpotKnownParty = present;

	if (key !== farmSpotLast) {
		farmSpotBurstUntil = now + FARM_SPOT.burstForMs;
		sendFarmSpot('spot changed');
		return;
	}
	if (joined.length) {
		farmSpotBurstUntil = now + FARM_SPOT.burstForMs;
		sendFarmSpot(`${joined.join(', ')} joined`);
		return;
	}
	const due = (now < farmSpotBurstUntil) ? FARM_SPOT.burstMs : FARM_SPOT.keepaliveMs;
	if (now - farmSpotSentAt >= due) sendFarmSpot(null);
}

setInterval(farmSpotTick, 1000);

mainLoop();
actionLoop();
skillLoop();
equipmentLoop();
bossHop.startScanning();
maintenanceLoop();
potionLoop();
farmSpotTick();
initializeFarmUI();
if (parent.$) {

	(function () {
		if (parent.killTrackerInitialized) return;
		parent.killTrackerInitialized = true;

		let deaths = 0;
		const killTime = new Date();

		game.on('death', function (data) {
			if (parent.entities[data.id]) {
				const mob = parent.entities[data.id];
				const mobName = mob.type;

				if (mobName === 'monster') {
					const mobTarget = mob.target;
					const party = get_party();
					const partyMembers = party ? Object.keys(party) : [];

					if (mobTarget === character.name || partyMembers.includes(mobTarget)) {
						console.log(data);
						deaths++;
						killHandler();
					}
				}
			}
		});

		function killHandler() {
			const elapsed = (new Date() - killTime) / 1000;
			if (elapsed > 0) {
				const deathsPerSec = deaths / elapsed;
				const dailyKillRate = calculateKillRate(deathsPerSec);

				add_top_button("kpm", Math.round(dailyKillRate.kpm).toLocaleString() + ' kpm');
				add_top_button("kph", Math.round(dailyKillRate.kph).toLocaleString() + ' kph');
				add_top_button("kpd", Math.round(dailyKillRate.kpd).toLocaleString() + ' kpd');
			} else {
				console.warn("Elapsed time is zero, cannot calculate rates.");
			}
		}

		function calculateKillRate(deathsPerSec) {
			let kpm = deathsPerSec * 60;
			let kph = kpm * 60;
			let kpd = kph * 24;
			return { kpm, kph, kpd };
		}
	})();

	(function () {
		if (parent.goldMeterInitialized) return;
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

			     get closer  - emitted on every out-of-range action attempt;
			                   80 of 289 entries in a four-minute sample.
			     AP[...]     - achievement progress. Mostly firehazard, which
			                   wants 20,000 CONSECUTIVE burn last-hits, so a
			                   physical last hit resets it and the line repeats
			                   "1/20,000" forever rather than counting up.
			     scared /    - the courage mechanic. Rangers have base courage 2,
			     terrified     so a third attacker starts fear. Worth seeing
			                   while tuning courage, worth hiding otherwise. */
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
			/* The game-log file sees server messages through here: this filter
			   replaced the listener that would have sent them to add_log. */
			try { const g = parent.__gamelog; if (g && typeof g.capture === 'function') g.capture(message, color, 'game'); } catch (e) { }
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

	(function () {
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
		   -> RangerComments.md#replace-our-previous-hit-listener-and-survive */
		if (parent.dps_hit_handler) parent.socket.removeListener('hit', parent.dps_hit_handler);
		const onHit = d => {
			if (!parent || !parent.party_list) return;
			const inParty = id => parent.party_list.includes(id);
			if (!inParty(d.hid) && !inParty(d.id)) return;

			try {
				const dmg = d.damage || 0, isPlayer = get_player(d.id), isAttacker = get_player(d.hid);

				if (dmg && isPlayer) {
					const e = getEntry(d.id);
					d.damage_type === 'physical' ? e.dtP += dmg : e.dtM += dmg;
				}
				if (d.dreturn && isAttacker) getEntry(d.hid).dtP += d.dreturn;
				if (d.reflect && isAttacker) getEntry(d.hid).dtM += d.reflect;

				if (d.dreturn && isPlayer && !get_player(d.hid)) getEntry(d.id).dr += d.dreturn;
				if (d.reflect && isPlayer && !get_player(d.hid)) getEntry(d.id).rf += d.reflect;

				if (isAttacker) {
					const e = getEntry(d.hid);

					if (dmg) {
						d.source === 'burn' ? e.bD += dmg : d.splash ? e.blD += dmg : e.baD += dmg;
					}

					if (d.heal || d.lifesteal) {
						const target = get_player(d.id);
						e.h += showOverheal ? (d.heal || 0) + (d.lifesteal || 0) :
							(d.heal ? Math.min(d.heal, (target?.max_hp || 0) - (target?.hp || 0)) : 0) +
							(d.lifesteal ? Math.min(d.lifesteal, isAttacker.max_hp - isAttacker.hp) : 0);
					}

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

	(function () {
		if (parent.party_style_prepared) parent.$('#style-party-frames').remove();

		parent.$('head').append(`<style id="style-party-frames">
.party-container {position: absolute; top: 55px; right: 0; width: 1000px; height: 300px; font-family: 'pixel';}
</style>`);
		parent.party_style_prepared = true;

		const DISPLAY_BARS = ['hp', 'mp', 'xp', 'xprate', 'xpeta'];
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

		/* `text` is the label. Pass an empty string for a bare row - the xp rate and
		   its ETA are self-describing ("22.9M xp/hr"), and at 78px of frame a
		   redundant "XP/HR: " prefix is what pushed the line past the edge.
		   `fontSize` defaults to the 17px the stat bars use; the two xp rows ask
		   for less so the whole string fits inside the frame. */
		const barHTML = (text, val, width, color, fontSize) =>
			`<div style="position:relative;width:100%;height:${fontSize ? 16 : 20}px;text-align:center;margin-top:3px;">
<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-weight:bold;font-size:${fontSize || 17}px;z-index:1;white-space:nowrap;text-shadow:-1px 0 black,0 2px black,2px 0 black,0 -1px black;">${text ? text + ': ' : ''}${val}</div>
<div style="position:absolute;top:0;left:0;right:0;bottom:0;background-color:${color};width:${width}%;height:${fontSize ? 16 : 20}px;border:1px solid grey;"></div>
</div>`;

		const XP_SAMPLE_INTERVAL_MS = 5000;
		const XP_WINDOW_MS = 5 * 60 * 1000;
		const xpHistory = new Map();

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

		function computeXpRateAndEta(name, info) {
			const hist = updateXpHistory(name, info);
			if (!hist || hist.length < 2) return { rateStr: '—', etaStr: '—' };

			const oldest = hist[0];
			const newest = hist[hist.length - 1];
			const elapsedSec = (newest.t - oldest.t) / 1000;
			if (elapsedSec < 10) return { rateStr: '—', etaStr: '—' };

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

		/* Left-align the party block under the R&M button.

		   The game does not position #newparty at all - it ships as a static
		   inline-block. WE position it: `.party-container` above sets
		   `position: absolute; right: 0; width: 1000px`, and the render loop
		   applies that class with addClass() immediately before calling in here.
		   So the right-anchoring that pinned the block to the viewport edge -
		   pushing the rightmost frame's text to 1734 against a 1718 viewport -
		   is ours, and so is the fix.

		   (An earlier draft of this comment blamed "the game's own id rule".
		   There is no such rule; the measurement matched .party-container
		   exactly. Left in the record because a false claim about the DOM, sitting
		   in the file, reads as documentation - the same reason the dead
		   `#toprightcorner > .codebuttons` branch was deleted rather than kept.)

		   Written inline because inline beats the class rule we just applied,
		   which is what otherwise holds `right: 0` and `width: 1000px`.

		   The anchor is read from the live button rather than hard-coded: the
		   toolbar is itself right-anchored, so R&M's x moves with the window and
		   any fixed number would be wrong at another size. If the button cannot
		   be found the block is left exactly where it was - a misaligned panel
		   beats one flung off screen. */
		let rmButton = null;
		const findRmButton = () => {
			if (rmButton && rmButton.isConnected) return rmButton;
			rmButton = null;
			parent.$('#toprightcorner *').each((i, el) => {
				if (rmButton || el.children.length) return;
				if (/^\s*R&M\s*$/.test(el.textContent || '')) rmButton = el;
			});
			return rmButton;
		};

		/* Only align a POSITIONED #newparty, and say so once if it is not.

		   This rests on #newparty being out of normal flow. It is inside
		   #toprightcorner, which is `position: fixed; right: 0` with auto width -
		   so its width is the widest of its IN-FLOW children. If #newparty were
		   static, writing `width` here would widen that container, which extends
		   leftward, which moves R&M, which changes the anchor we just read, which
		   writes a new width: a 250ms oscillation. And `left`/`right` would be
		   ignored outright, so the alignment could not work anyway.

		   What makes it positioned is our own `.party-container`, applied by the
		   render loop two lines before this runs - not anything the game does.
		   That is a dependency on our own style block having injected, so it is
		   worth checking rather than assuming: if `<style id="style-party-frames">`
		   is ever removed, desynced via party_style_prepared, or refactored away,
		   the class goes inert and #newparty falls back to the static inline-block
		   the game ships. Reading the computed value catches exactly that -
		   positioned, align; static, decline and say so once - instead of writing
		   a width into an in-flow element and starting the oscillation above. */
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
		   `width` are interpreted as CSS pixels. Mixing the two was wrong twice
		   over: rect.left is also viewport-relative, while `left` on a positioned
		   element is relative to its offsetParent. Reading R&M's rect.left of 901
		   and writing `left: 901px` put the block 297 CSS px right of where it
		   belonged, because the true offset within #toprightcorner is 604.
		   offsetLeft is already CSS px and already relative to offsetParent, so
		   accumulating it needs no origin correction and no scale factor, and
		   cannot drift if the client's scale changes. */
		const offsetLeftWithin = (el, ancestor) => {
			let x = 0, node = el;
			while (node && node !== ancestor) { x += node.offsetLeft; node = node.offsetParent; }
			return node === ancestor ? x : null;
		};

		const alignPartyFrames = (partyFrame, count) => {
			const rm = findRmButton();
			if (!rm || !count) return;
			if (!partyFrameIsPositioned(partyFrame)) return;

			const np = partyFrame[0];
			const anchorBox = np.offsetParent;
			if (!anchorBox) return;

			/* Both measured against the SAME offsetParent, or not at all: if R&M
			   is not inside it the two numbers are in different coordinate spaces
			   and subtracting them would be meaningless. */
			const rmLeft = offsetLeftWithin(rm, anchorBox);
			if (rmLeft === null || !isFinite(rmLeft)) return;

			/* One row, always. The previous width was pitch * count computed from
			   device-pixel rects, which at 0.75 scale came out ~25% short - 327 CSS
			   px for four 104px cells - and the fourth member wrapped onto a second
			   row. max-content plus nowrap lets the row size itself, so there is no
			   arithmetic left to get wrong and no count at which it silently wraps. */
			if (partyFrame.data('alignedTo') === rmLeft && partyFrame.data('alignedN') === count) return;
			partyFrame.css({ left: rmLeft + 'px', right: 'auto', width: 'max-content', 'white-space': 'nowrap' });

			/* Second pass: whatever inset the first cell has once it is laid out on
			   one row, take it off, so the FIRST member's frame is flush with R&M
			   rather than the container's padding edge. Measured after the write
			   because the inset is a product of that layout - it reads 5 while the
			   block is wrapped and 0 once it is not, and subtracting the stale one
			   overshoots by exactly that much. */
			np.offsetWidth;
			const inset = np.children[0] ? np.children[0].offsetLeft : 0;
			if (inset) partyFrame.css('left', (rmLeft - inset) + 'px');

			partyFrame.data('alignedTo', rmLeft).data('alignedN', count);
		};

		setInterval(() => {
			const partyFrame = parent.$('#newparty').addClass('party-container');
			if (!partyFrame.length) return;

			/* The merchant gets no frame. It is excluded by CLASS rather than by
			   name, so it keeps working if the merchant is renamed or replaced,
			   and it does not quietly hide a second character who happens to
			   share the name. The game builds one cell per party member in
			   member order, so the cell is hidden in place and the count passed
			   to alignPartyFrames is the count of VISIBLE cells - otherwise the
			   row would be sized for a frame that is not drawn. */
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

// === CAVE MAIL BEGIN === byte-identical in Party/Ranger.js, Party/Priest.js and
// Party/Mage.js; Tests/suite_relay.js holds them to it.
/* CLAIM WHAT THE CAVE MAILED. A cave reward goes to a random member's bag, and
   when that bag is full or the member is offline the server mails it instead -
   from "Dorr", subject "From the cave" - and only the character named on the
   letter can take it (`mail_take_item` refuses wrong_character). Muling never
   sees mail, so without this the item sits in the mailbox until someone opens
   it by hand. The newest 40 letters come back from /api/pull_mail; each item
   letter carries `to`, `fro`, `id` and `taken`. Runs 20s after load and every
   30 minutes, and stops for the pass when the bag is full.

   READ STRAIGHT FROM /api/pull_mail, NEVER THROUGH api_call. The server puts
   the letters INSIDE `infs` (`{success, infs: [{type: 'mail', mail}, ...]}`),
   and api_call deletes `infs` before it resolves and then passes them to
   handle_information(), a top-window function the CODE frame does not have.
   So every api_call read answered "no list" and threw "handle_information is
   not defined" into the game log, on all three, 20s after each load. Same POST
   as the merchant's pull_merchants read: empty body, cookie auth, the method
   in the path only. */
const CAVE_MAIL_FROM = 'Dorr';
async function caveMailList() {
	const o = { method: 'POST', cache: 'no-store', credentials: 'same-origin', body: '' };
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(function () { try { ac.abort(); } catch (e) { } }, 10000);
	}
	let payload = null;
	try {
		const r = await fetch(parent.location.origin + '/api/pull_mail', o);
		if (!r.ok) throw new Error('HTTP ' + r.status);
		payload = await r.json();
	} finally { if (stop) clearTimeout(stop); }
	if (payload && payload.failed) throw new Error(payload.reason || 'failed');
	const infs = (payload && Array.isArray(payload.infs)) ? payload.infs : [];
	for (const inf of infs) {
		if (inf && inf.type === 'mail' && Array.isArray(inf.mail)) return inf.mail;
	}
	return null;
}
async function claimCaveMail() {
	let list;
	try { list = await caveMailList(); }
	catch (e) { game_log('cave mail: pull_mail failed - ' + ((e && (e.reason || e.message)) || e), 'orange'); return null; }
	if (!list) { game_log('cave mail: pull_mail answered without a mail block', 'orange'); return null; }
	let claimed = 0;
	for (const m of list) {
		if (!m || m.fro !== CAVE_MAIL_FROM || !m.item || m.taken || m.to !== character.name) continue;
		if ((character.esize || 0) < 1) { game_log('cave mail: bag full - letters left for the next pass', 'orange'); break; }
		try { parent.socket.emit('mail_take_item', { id: m.id }); claimed++; } catch (e) { }
		await new Promise((r) => setTimeout(r, 600));
	}
	if (claimed) game_log('cave mail: took ' + claimed + ' item(s) from ' + CAVE_MAIL_FROM, '#D4BB88');
	return claimed;
}
setTimeout(function caveMailLoop() {
	claimCaveMail().catch(function () { });
	setTimeout(caveMailLoop, 30 * 60 * 1000);
}, 20000);
// === CAVE MAIL END ===

// === GAMELOG BEGIN === byte-identical in Party/Ranger.js, Party/Priest.js,
// Party/Mage.js, Party/Merchant.js and CaveRun.js; Tests/suite_gamelog.js
// holds them to it.
/* EVERY GAME LOG LINE TO A FILE ON THE BRIDGE. Operator's request 2026-10-24:
   the game keeps 480 lines and then cuts to the newest 160, and the evidence
   for that morning's spookytown door diagnosis existed only in that
   scrollback.

   THE CAPTURE LIVES IN THE PAGE, THE SENDER IN THIS SCRIPT. parent.add_log is
   the game's one log writer: the client's own messages, the default
   server-message handler and every script's game_log() all reach it. The
   wrapper and its buffer are built with the PAGE's Function, so a runner
   restart, which destroys this iframe, leaves them working, and each load
   just picks the buffer up and drains it. The party scripts' log filter
   replaces the server-message listener and writes the line itself, so it calls
   capture() directly - without that, every server message would be missed
   while the filter runs.

   NOTHING IS LOST TO A HOP OR A BRIDGE OUTAGE, UP TO `keep` LINES. A failed
   POST leaves its lines in the buffer, and the page saves whatever is unsent
   to localStorage as it unloads, keyed by character because that storage is
   shared by every character in the browser. Each line carries the page's start
   time and a sequence number, so a batch sent twice can be told apart at read
   time.

   WHAT THE FILE DOES NOT GET LINE BY LINE - the operator's rulings of
   2026-10-25. The screen is untouched by all of it; only the file changes.
   - The pathfinder's "Searching for a path...", "Path found!" and "Path not
     found!" become one count row a minute.
   - The party broadcasts "<X> killed a <Y>" and "N gold" become one row a
     minute per character: each monster killed with its count, and the
     window's loot gold as one total, because the gold line names no monster.
     A kill counts only on the killer's own row and the others drop it, since
     every member receives the broadcast. The gold line is this member's own
     share, sent to each member separately: the server splits a chest by
     `share`, which is equal across one account's characters, so the party's
     loot is the SUM of the rows and equal figures on all three are expected.
     Only lines the GAME wrote are summarised, never our own game_log().
     "Received N gold" is a different line and is kept.
   - A line a script sends through gamelogScreenOnly() is shown and not kept.
   - A line matching a rule a script registered with gamelogFileOnChange() is
     kept only when its text differs from the last one kept under that rule,
     remembered across hops.
   The open minute is written out before the page unloads, so a hop loses
   none of it. `v` rebuilds a page state left by an older build, which would
   otherwise outlive a runner restart and go on capturing the old way. */
const GAMELOG = {
	base: 'http://127.0.0.1:8787', path: '/gamelog',
	everyMs: 3000, batch: 400, keep: 600, timeoutMs: 5000,
	unsentKey: 'gamelog_unsent_', seenKey: 'gamelog_seen_', minuteMs: 60000, v: 4,
};

/* Evaluated in whichever realm builds it - the page's by preference. Plain
   ES5 on purpose, since it is a string that is never parsed by our tooling. */
function gamelogPageSource() {
	return [
		'var TS = /^\\d{1,2}:\\d{2}:\\d{2} \\| /;',
		'var st = { v: ver, realm: realm, buf: [], dropped: 0, seq: 0, page: Date.now(), src: null, quiet: false,',
		'  sent: 0, flushingSince: 0, lastOk: 0, lastErr: null, restored: false, orig: P.add_log,',
		'  rules: {}, seen: null, seenFor: null, win: null };',
		'st.fresh = function () { return { start: 0, kills: {}, gold: 0, golds: 0, pfn: 0,',
		'  pf: { searching: 0, found: 0, not_found: 0 } }; };',
		'st.win = st.fresh();',
		'st.row = function (message, color, source, extra) {',
		'  var c = P.character || {};',
		'  var r = { page: st.page, seq: ++st.seq, t_script: Date.now(), character: c.name || null,',
		'    server: ((P.server_region || "") + (P.server_identifier || "")) || null, map: c.map || null,',
		'    color: color, message: message, source: source };',
		'  if (extra) for (var k in extra) r[k] = extra[k];',
		'  st.buf.push(r);',
		'  if (st.buf.length > keep) { st.dropped += st.buf.length - keep; st.buf.splice(0, st.buf.length - keep); }',
		'};',
		'st.roll = function (now, force) {',
		'  var w = st.win;',
		'  if (!w.start || (!force && now - w.start < minuteMs)) return false;',
		'  st.win = st.fresh();',
		'  var end = force ? now : w.start + minuteMs;',
		'  var names = Object.keys(w.kills).sort(), parts = [];',
		'  for (var i = 0; i < names.length; i++) parts.push(names[i] + " " + w.kills[names[i]]);',
		'  if (parts.length || w.golds) st.row("[minute] kills: " + (parts.join(", ") || "none") + " | own share of loot gold " + w.gold',
		'    + " (" + w.golds + " drops)", null, "summary", { kind: "party_minute", window_start: w.start,',
		'    window_end: end, kills: w.kills, gold: w.gold, gold_drops: w.golds });',
		'  if (w.pfn) st.row("[minute] pathfinder: searching " + w.pf.searching + ", found " + w.pf.found',
		'    + ", not found " + w.pf.not_found, null, "summary", { kind: "pathfinder_minute", window_start: w.start,',
		'    window_end: end, pathfinder: w.pf });',
		'  return true;',
		'};',
		'st.tally = function (body, source, now) {',
		'  var w = st.win, m = /^(Searching for a path|Path found|Path not found)/.exec(body);',
		'  if (m) {',
		'    if (!w.start) w.start = now;',
		'    w.pf[m[1] === "Path found" ? "found" : m[1] === "Path not found" ? "not_found" : "searching"]++;',
		'    w.pfn++;',
		'    return true;',
		'  }',
		'  if (source !== "game") return false;',
		'  m = /^(\\S+) killed (?:(?:a|an|the) )?(.+?)\\s*$/.exec(body);',
		'  if (m) {',
		'    if (m[1] !== "You" && m[1] !== ((P.character && P.character.name) || "")) return true;',
		'    if (!w.start) w.start = now; w.kills[m[2]] = (w.kills[m[2]] || 0) + 1; return true;',
		'  }',
		'  m = /^([\\d,]+) gold\\s*$/.exec(body);',
		'  if (m) { if (!w.start) w.start = now; w.gold += parseInt(m[1].replace(/,/g, ""), 10) || 0; w.golds++; return true; }',
		'  return false;',
		'};',
		'st.watch = function (name, source, flags) {',
		'  try { st.rules[name] = new RegExp(source, String(flags || "").replace(/g/g, "")); } catch (e) {}',
		'};',
		'st.changed = function (body) {',
		'  for (var n in st.rules) {',
		'    if (!st.rules[n].test(body)) continue;',
		'    var who = (P.character && P.character.name) || "";',
		'    if (st.seenFor !== who) {',
		'      st.seenFor = who; st.seen = {};',
		'      try { st.seen = JSON.parse(P.localStorage.getItem(seenKey + who) || "{}") || {}; } catch (e) {}',
		'    }',
		'    if (st.seen[n] === body) return false;',
		'    st.seen[n] = body;',
		'    try { if (who) P.localStorage.setItem(seenKey + who, JSON.stringify(st.seen)); } catch (e) {}',
		'    return true;',
		'  }',
		'  return true;',
		'};',
		'st.capture = function (message, color, source) {',
		'  try {',
		'    if (st.quiet) return;',
		'    var now = Date.now();',
		'    st.roll(now, false);',
		'    var m = message;',
		'    if (m !== null && typeof m === "object") { try { m = JSON.stringify(m); } catch (e) { m = "[object]"; } }',
		'    m = String(m);',
		'    var src = source || st.src || "game", body = m.replace(TS, "");',
		'    if (st.tally(body, src, now)) return;',
		'    if (!st.changed(body)) return;',
		'    st.row(m, color == null ? null : String(color), src);',
		'  } catch (e) {}',
		'};',
		'P.add_log = function (message, color) { st.capture(message, color, null); return st.orig.apply(this, arguments); };',
		'P.add_log.__gamelog = true;',
		'try {',
		'  P.addEventListener("pagehide", function () {',
		'    try { st.roll(Date.now(), true); } catch (e) {}',
		'    try {',
		'      var n = P.character && P.character.name;',
		'      if (n && st.buf.length) P.localStorage.setItem(unsentKey + n, JSON.stringify(st.buf.slice(-keep)));',
		'    } catch (e) {}',
		'  });',
		'} catch (e) {}',
		'return st;',
	].join('\n');
}

/* Returns the page's capture state, building it if absent. A state built in a
   CODE iframe (the page refused its Function) may outlive that iframe, and one
   from an older build would go on capturing the old way, so either is rebuilt
   on the next load, carrying its lines and its open minute over; a current
   page-realm one is reused as it is. */
function gamelogInstall() {
	let P = null;
	try { P = parent; } catch (e) { return null; }
	if (!P || typeof P.add_log !== 'function') return null;
	let st = P.__gamelog || null;
	if (st && st.realm === 'page' && st.v === GAMELOG.v) return st;
	if (st && typeof st.roll === 'function') { try { st.roll(Date.now(), true); } catch (e) { } }
	const carry = (st && Array.isArray(st.buf)) ? st.buf : [];
	const rules = (st && st.rules) || null;
	if (st && typeof st.orig === 'function' && P.add_log && P.add_log.__gamelog) P.add_log = st.orig;
	if (st) st.buf = [];   // its own pagehide handler then saves nothing over ours
	const src = gamelogPageSource();
	const args = ['P', 'keep', 'realm', 'unsentKey', 'seenKey', 'minuteMs', 'ver', src];
	let make = null, realm = 'page';
	try { make = P.Function.apply(null, args); }
	catch (e) { make = Function.apply(null, args); realm = 'code'; }
	st = make(P, GAMELOG.keep, realm, GAMELOG.unsentKey, GAMELOG.seenKey, GAMELOG.minuteMs, GAMELOG.v);
	if (carry.length) st.buf = carry.concat(st.buf).slice(-GAMELOG.keep);
	if (rules) for (const n in rules) { try { st.watch(n, rules[n].source, rules[n].flags); } catch (e) { } }
	P.__gamelog = st;
	return st;
}

/* Marks our own game_log() lines as `script` rather than `game`. Wraps the
   runner's game_log once per CODE context. */
function gamelogMarkScript() {
	try {
		if (typeof game_log !== 'function' || game_log.__gamelog) return false;
		const inner = game_log;
		const wrapped = function () {
			let st = null;
			try { st = parent.__gamelog || null; } catch (e) { }
			if (st) st.src = 'script';
			try { return inner.apply(this, arguments); } finally { if (st) st.src = null; }
		};
		wrapped.__gamelog = true;
		window.game_log = wrapped;
		return true;
	} catch (e) { return false; }
}

/* Runs fn with the capture off: whatever it logs is shown and not kept. */
function gamelogQuietly(fn) {
	let st = null;
	try { st = parent.__gamelog || null; } catch (e) { }
	if (st) st.quiet = true;
	try { return fn(); } finally { if (st) st.quiet = false; }
}

/* game_log() for a line that belongs on the screen and not in the file. */
function gamelogScreenOnly(message, color) {
	return gamelogQuietly(() => game_log(message, color));
}

/* Lines matching `source` (a RegExp source string, built in the page) reach
   the file only when their text changed since the last one kept under `name`.
   A string rather than a RegExp, because a RegExp made here belongs to this
   iframe and the capture outlives it. */
function gamelogFileOnChange(name, source, flags) {
	const st = gamelogInstall();
	if (!st || typeof st.watch !== 'function') return false;
	st.watch(name, source, flags);
	return !!st.rules[name];
}

function gamelogName() {
	try { return (character && character.name) || null; } catch (e) { return null; }
}

/* The lines a hop unloaded before they were sent, put back in front of
   anything captured since. Read once per page, by name. */
function gamelogRestore(st, name) {
	try {
		const key = GAMELOG.unsentKey + name;
		const raw = parent.localStorage.getItem(key);
		if (!raw) return 0;
		parent.localStorage.removeItem(key);
		const old = JSON.parse(raw);
		if (!Array.isArray(old) || !old.length) return 0;
		st.buf = old.concat(st.buf).slice(-GAMELOG.keep);
		return old.length;
	} catch (e) { return 0; }
}

function gamelogPost(body) {
	if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch'));
	const o = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
	let stop = null;
	if (typeof AbortController === 'function') {
		const ac = new AbortController();
		o.signal = ac.signal;
		stop = setTimeout(() => { try { ac.abort(); } catch (e) { } }, GAMELOG.timeoutMs);
	}
	return fetch(GAMELOG.base + GAMELOG.path, o).then(
		(r) => { if (stop) clearTimeout(stop); return r.json(); },
		(e) => { if (stop) clearTimeout(stop); throw e; });
}

/* One batch. Lines leave the buffer only once the bridge has them, and by
   identity rather than by position, because the capture trims the front of
   the buffer when it is full and may have done so while the POST was out. A
   flush older than twice the timeout is taken as abandoned - its iframe was
   destroyed mid-await - so it cannot block the next script for ever. Each
   call also closes a minute that has run out, so a quiet one is still
   written within a flush of its end. */
async function gamelogFlush() {
	const st = gamelogInstall();
	if (!st) return 'not installed';
	const now = Date.now();
	try { st.roll(now, false); } catch (e) { }
	if (st.flushingSince && now - st.flushingSince < 2 * GAMELOG.timeoutMs) return 'busy';
	const name = gamelogName();
	if (name && !st.restored) { st.restored = true; gamelogRestore(st, name); }
	if (!st.buf.length) return 'empty';
	const lines = st.buf.slice(0, GAMELOG.batch);
	const dropped = st.dropped;
	st.flushingSince = now;
	try {
		const r = await gamelogPost({ lines: lines, dropped: dropped });
		if (r && r.ok) {
			const out = new Set(lines);
			st.buf = st.buf.filter((l) => !out.has(l));
			st.sent += lines.length;
			st.dropped = Math.max(0, st.dropped - dropped);
			st.lastOk = Date.now();
			st.lastErr = null;
			return 'sent';
		}
		st.lastErr = (r && r.error) || 'refused';
		return 'refused';
	} catch (e) {
		st.lastErr = String((e && e.message) || e);
		return 'failed';
	} finally {
		st.flushingSince = 0;
	}
}

/* The console view: what is waiting, what was lost, when the bridge last took
   a batch, and the minute still open. Read-only. */
function gamelogStatus() {
	let st = null;
	try { st = parent.__gamelog || null; } catch (e) { }
	if (!st) return { installed: false };
	const w = st.win || {};
	return {
		installed: true, v: st.v || 1, realm: st.realm, buffered: st.buf.length, dropped: st.dropped, sent: st.sent,
		lastOk: st.lastOk ? new Date(st.lastOk).toISOString() : null, lastErr: st.lastErr,
		minuteOpen: w.start ? new Date(w.start).toISOString() : null,
		changeRules: Object.keys(st.rules || {}),
	};
}

function gamelogStart() {
	gamelogInstall();
	gamelogMarkScript();
	try { if (window.__gamelogTimer) clearInterval(window.__gamelogTimer); } catch (e) { }
	try { window.__gamelogTimer = setInterval(() => { gamelogFlush().catch(() => { }); }, GAMELOG.everyMs); } catch (e) { }
}
gamelogStart();
// === GAMELOG END ===
