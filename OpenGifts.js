// ============================================================================
// OpenGifts - stand at Xyn and open anniversary boxes until the bag fills
// ============================================================================
// Everything below is read from the game's own data at runtime, or was read
// out of the server source rather than remembered. The numbers that matter:
//
//   Xyn is the NPC with id "exchange". On main the map data puts him at
//   (-25, -478). Looked up live all the same - a hardcoded coordinate is a
//   coordinate that can go stale.
//
//   The range is B.sell_dist = 400, measured from G.maps.main.exchange, and
//   the check is skipped entirely if the character holds a computer. So a
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

	npc: { id: 'exchange', map: 'main', fallback: { x: -25, y: -478 } },

	// The server allows 400. Well inside it, because the check is made when
	// the request lands rather than when it was sent.
	standWithin: 250,

	// Give up after this many refusals in a row. Anything repeating is a
	// condition that will not clear by trying harder.
	maxConsecutiveFailures: 3,
};

function log(msg, color) {
	try { game_log('[gifts] ' + msg, color || '#8b98ab'); } catch (e) { console.log('[gifts]', msg); }
}

// Where Xyn is, per the running game rather than per this file.
function xynSpot() {
	try {
		const m = parent.G.maps[CONFIG.npc.map];
		for (const n of (m.npcs || [])) {
			if (n && n.id === CONFIG.npc.id && Array.isArray(n.position)) {
				return { map: CONFIG.npc.map, x: n.position[0], y: n.position[1] };
			}
		}
	} catch (e) { }
	log('Xyn not in the map data - falling back to the recorded position', 'orange');
	return { map: CONFIG.npc.map, x: CONFIG.npc.fallback.x, y: CONFIG.npc.fallback.y };
}

// A computer exempts the character from the distance check entirely, which is
// worth knowing before walking anywhere.
function hasComputer() {
	try {
		return (character.items || []).some((it) => it
			&& (it.name === 'computer' || it.name === 'supercomputer'));
	} catch (e) { return false; }
}

function atXyn(spot) {
	try {
		if (character.map !== spot.map) return false;
		return distance(character, spot) <= CONFIG.standWithin;
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

async function openGifts() {
	const spot = xynSpot();

	if (!atXyn(spot) && !hasComputer()) {
		log('walking to Xyn at ' + spot.x + ', ' + spot.y, '#55BDF0');
		try {
			await smart_move({ map: spot.map, x: spot.x, y: spot.y });
		} catch (e) {
			log('could not reach Xyn: ' + (e && e.reason ? e.reason : e), 'red');
			return;
		}
	} else if (hasComputer() && !atXyn(spot)) {
		log('using the computer - no walk needed', '#55BDF0');
	}

	const rewards = {};
	let opened = 0, failures = 0;
	const started = Date.now();
	log('starting with ' + countBoxes() + ' box(es) and ' + character.esize + ' free slot(s)', '#55BDF0');

	while (true) {
		if (character.esize <= CONFIG.minFreeSlots) {
			log('down to ' + character.esize + ' free slot(s) - stopping', '#E9C46A');
			break;
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
		} catch (e) {
			const why = (e && (e.reason || e.message)) ? (e.reason || e.message) : String(e);
			failures++;
			log('exchange refused (' + why + ')', 'orange');

			if (why === 'inventory_full') break;
			if (why === 'distance') {
				log('drifted out of range - walking back', 'orange');
				try { await smart_move({ map: spot.map, x: spot.x, y: spot.y }); }
				catch (e2) { log('could not get back to Xyn - stopping', 'red'); break; }
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

	const secs = Math.round((Date.now() - started) / 1000);
	log('opened ' + opened + ' box(es) in ' + secs + 's'
		+ (opened ? ' (' + (secs / opened).toFixed(1) + 's each)' : ''), '#55BDF0');
	const lines = Object.keys(rewards).sort((a, b) => rewards[b] - rewards[a]);
	for (const k of lines) log('  ' + rewards[k] + ' x ' + k, '#8b98ab');
	log(countBoxes() + ' box(es) left, ' + character.esize + ' free slot(s)', '#55BDF0');
	return { opened: opened, rewards: rewards, left: countBoxes() };
}

// Reachable from the console so a run can be repeated after banking, without
// re-engaging the slot.
try { parent.openGifts = openGifts; } catch (e) { }

openGifts();
