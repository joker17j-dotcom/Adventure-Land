// ============================================================================
// FamilyFleet - one script, four characters, one account
// ============================================================================
// Three rangers farm and hold a shard each as stationary scouts; one merchant
// roams the rotation, runs the kiss event, and drives the account's gear
// economy through the bank.
//
// There is deliberately NO messaging between characters. They live on separate
// shards, so send_cm cannot reach them and there is no bridge relay on this
// account. Every schedule below is therefore derived from the wall clock and
// from the character's own index in CONFIG.characters - never negotiated. Two
// characters must never want the bank at the same moment, and the only way to
// guarantee that without talking is to give each a fixed slice of the hour.
//
// CHARACTER NAMES APPEAR EXACTLY ONCE, in CONFIG.characters. Adding a person
// means adding rows there and nothing else: role, bank slot and scan duties
// are all derived from that list.
// ============================================================================

const CONFIG = {

	// ---------------------------------------------------------------- roster
	// The ONLY place names appear. Order matters: it fixes each character's
	// bank window (index 0 gets :00, index 1 gets :05, and so on), which is
	// what keeps two of them from walking into the bank together.
	characters: {
		Ranger1: { role: 'ranger' },
		Ranger2: { role: 'ranger' },
		Ranger3: { role: 'ranger' },
		Merchant1: { role: 'merchant' },
	},

	bridge: 'http://127.0.0.1:8787',

	// ------------------------------------------------------------- the bank
	bank: {
		// Minutes past the hour for index 0; each later character is offset by
		// stagger. Four characters at 5 minutes apart occupy :00 :05 :10 :15,
		// leaving the rest of the hour clear.
		firstWindowMinute: 0,
		staggerMinutes: 5,
		// How long a character may consider the bank "its turn". Generous
		// enough to walk in, work and walk out; short enough that a stuck
		// character frees the slot before the next one arrives.
		windowMs: 4 * 60 * 1000,
		// Rangers deposit everything above this. The merchant's rule is the
		// mirror of it - see merchant.goldFloor.
		rangerKeepGold: 10000000,
		map: 'bank',
	},

	// ------------------------------------------------------------ the scan
	scout: {
		// Rangers hold one shard each and never hop. The merchant roams.
		scanEveryMs: 2 * 60 * 1000,     // the standing beat: town, scan, back out
		fullInventoryScanMs: 20 * 1000, // stuck with a full bag: scan harder while waiting
		townSpot: { map: 'main', x: 0, y: 0 },
		settleMs: 1500,
		maxSettlePasses: 5,
		minPostGapMs: 7000,
		postConfirmRetries: 3,
		pontyEveryMs: 10 * 60 * 1000,
		skipServers: ['PVP'],
	},

	// ----------------------------------------------------------- the hopping
	hop: {
		// Only the merchant hops. One per hour is the user's rule.
		//
		// HOP SICKNESS - measured, and NOT what an earlier read of the server
		// source said. node/server_functions.js declares serverhop_logic TWICE
		// (lines 928 and 982). The later declaration wins, so the first one -
		// with its hop counting, four-hour window and escalating -20/-30/-40/
		// -60/-80 tiers - is dead code. The live rule is the short one:
		//
		//   arriving on a server != player.p.home, at level >= 60, off PVP
		//   -> add_condition(player, 'hopsickness'), flat, from G:
		//      luck -80, gold -80, xp -80, output -20, for 720000ms (12 min)
		//
		// There is no mild band and no tapering. Every hop away from home is the
		// full penalty. Corroborated from the live datastore (game 17083):
		// G.conditions.hopsickness carries exactly those values and that
		// duration, which only makes sense if add_condition is what applies it.
		//
		// Two consequences for this fleet:
		//   - The gate is p.home, not time-spent. Coming back to home clears it
		//     immediately, because the same function deletes the condition before
		//     deciding whether to re-add it.
		//   - The gold -80 still does NOT touch trade income. It reaches goldm,
		//     which is only ever applied to chest loot. A scouting merchant is
		//     not farming, so luck/gold/xp cost it nothing real.
		minIntervalMs: 60 * 60 * 1000,
		// The one thing that DOES cost: G's own explanation says hop sickness
		// "blocks kiss rewards". So a sick merchant that walks the kiss event
		// spends the trip and collects nothing. Skip the kiss while sick rather
		// than discovering it as a silently missing reward.
		skipKissWhileSick: true,
		// Below this level the condition is never applied at all, so none of the
		// above matters. Merchants gain xp from buying and selling, so a scout
		// merchant drifts toward this on its own - the guard is written now so
		// that crossing it is a behaviour change rather than a surprise.
		sicknessMinLevel: 60,
		// set_home is the gate itself, not a cure, which makes it worth more
		// than it first looked - but server.js:4783 allows it once per 36 HOURS
		// (fail reason 'sh_time'). So it cannot follow the hop cycle. Attempted
		// opportunistically: if it takes, home moves; if it returns sh_time, we
		// note the hours and stop asking until then.
		//
		// G also says "Bean in Mainland can change your home" - an NPC route
		// distinct from the set_home call. Whether Bean shares the 36h cooldown
		// is unknown; the server source does not show a Bean re-home handler at
		// all, and that source has already proven stale here.
		trySetHome: true,
		setHomeCooldownMs: 36 * 60 * 60 * 1000,
	},

	// ------------------------------------------------------------ the ranger
	ranger: {
		// Only these two, in this order of preference. goo is the starter spot;
		// crabx is the graduation.
		spots: {
			goo:   { map: 'main', monster: 'goo' },
			crabx: { map: 'main', monster: 'crabx' },
		},
		// "Comfortably farming crabx" needs a number, so: survive the pack
		// indefinitely with headroom, and be able to kill inside a sane window.
		// Both are measured against live stats each time, not decided once.
		crabxReady: {
			minLevel: 40,
			// Incoming dps from the assumed number of attackers must leave this
			// much of our own regen+potion throughput spare.
			minSurvivalMargin: 1.5,
			maxAttackers: 3,
			// Kill a single target in at most this long, or we are not really
			// farming it, we are standing next to it.
			maxSecondsToKill: 12,
			// Re-check this often; graduate once, demote if it stops being true.
			checkEveryMs: 60 * 1000,
		},
		potions: {
			hpAt: 0.55,
			mpAt: 0.35,
			buyBelow: 200,
			buyTo: 500,
		},
		// Full bag and not our bank window: park in town and scan instead of
		// dropping anything.
		freeSlotsFloor: 2,
	},

	// ---------------------------------------------------------- the merchant
	merchant: {
		// Mirror of bank.rangerKeepGold. Below the floor the merchant draws the
		// bank down to leaveInBank; at or above it, it withdraws nothing.
		goldFloor: 10000000,
		leaveInBank: 1000000,
		kissEvent: true,
		// Ponty is checked before each hop. A gear-plan item is worth buying
		// only if we can pay for it AND carry it AND do not already hold
		// enough - which is why the bank contents have to survive the hop.
		ponty: { minFreeSlots: 3 },
	},

	// ------------------------------------------------------------ gear plan
	// Lifted from Merchant.js GEAR_PROGRESSION.ranger, with TIER 1 RESTORED -
	// it is commented out there because that party is past it; this account
	// starts at the bottom.
	//
	// Tier 3 is the "never sell" set. Tier levels use the same decode as the
	// merchant's LEVEL_CODES.
	gear: {
		// How many copies of a plan item bank + worn should hold between them:
		// one per character on the account that can use it.
		copiesWanted: 3,
		// The exception: compounding consumes three to make one, so an item
		// still below its target level is allowed to stack past copiesWanted.
		// Without this the cap starves the very upgrades it exists to serve.
		compoundOverstock: true,
	},

	verbose: true,
};

// A ranger's gear plan, tier 1 through 3. Tier 1 is the block commented out in
// Merchant.js - this account needs it.
const RANGER_GEAR = [
	{
		earring1: { item: 'dexearring', level: 1, method: 'compound' }, helmet: { item: 'helmet', level: 6, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 1, method: 'compound' }, amulet: { item: 'dexamulet', level: 2, method: 'compound' },
		mainhand: { item: 'firebow', level: 5, method: 'upgrade' },     chest: { item: 'coat', level: 6, method: 'upgrade' },
		offhand: { item: 't2quiver', level: 5, method: 'upgrade' },     cape: { item: 'bcape', level: 4, method: 'upgrade' },
		ring1: { item: 'dexring', level: 2, method: 'compound' },       pants: { item: 'pants', level: 6, method: 'upgrade' },
		ring2: { item: 'dexring', level: 2, method: 'compound' },       belt: { item: 'dexbelt', level: 1, method: 'compound' },
		orb: { item: 'orbg', level: 1, method: 'compound' },            shoes: { item: 'shoes', level: 6, method: 'upgrade' },
		gloves: { item: 'gloves', level: 6, method: 'upgrade' },        elixir: null,
	},
	{
		earring1: { item: 'dexearring', level: 4, method: 'compound' }, helmet: { item: 'fury', level: 4, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 4, method: 'compound' }, amulet: { item: 'dexamulet', level: 4, method: 'compound' },
		mainhand: { item: 'firebow', level: 9, method: 'upgrade' },     chest: { item: 'coat', level: 9, method: 'upgrade' },
		offhand: { item: 't2quiver', level: 7, method: 'upgrade' },     cape: { item: 'ecape', level: 7, method: 'upgrade' },
		ring1: { item: 'cring', level: 3, method: 'compound' },         pants: { item: 'pants', level: 9, method: 'upgrade' },
		ring2: { item: 'suckerpunch', level: 0, method: 'compound' },   belt: { item: 'dexbelt', level: 3, method: 'compound' },
		orb: { item: 'orbofdex', level: 3, method: 'compound' },        shoes: { item: 'wingedboots', level: 8, method: 'upgrade' },
		gloves: { item: 'supermittens', level: 5, method: 'upgrade' },  elixir: null,
	},
	{
		earring1: { item: 'dexearring', level: 5, method: 'compound' }, helmet: { item: 'fury', level: 8, method: 'upgrade' },
		earring2: { item: 'dexearring', level: 5, method: 'compound' }, amulet: { item: 'dexamulet', level: 5, method: 'compound' },
		mainhand: { item: 'firebow', level: 10, method: 'upgrade' },    chest: { item: 'tshirt9', level: 4, method: 'upgrade' },
		offhand: { item: 'alloyquiver', level: 9, method: 'upgrade' },  cape: { item: 'ecape', level: 9, method: 'upgrade' },
		ring1: { item: 'suckerpunch', level: 2, method: 'compound' },   pants: { item: 'pants', level: 10, method: 'upgrade' },
		ring2: { item: 'suckerpunch', level: 2, method: 'compound' },   belt: { item: 'dexbelt', level: 5, method: 'compound' },
		orb: { item: 'orbofdex', level: 5, method: 'compound' },        shoes: { item: 'wingedboots', level: 10, method: 'upgrade' },
		gloves: { item: 'supermittens', level: 6, method: 'upgrade' },  elixir: null,
	},
];

/* Every item named anywhere in tier 3. These are never sold to an NPC, at any
   level, even as junk - a tier-3 name in the bag is either progress or the
   raw material for it. Built from the plan rather than written out, so
   editing the plan cannot leave a stale sell-safe list behind. */
const NEVER_SELL = new Set(
	Object.values(RANGER_GEAR[2]).filter(Boolean).map((s) => s.item)
);

/* Which character am I, and what do I do? Everything role- and
   schedule-shaped is derived from CONFIG.characters so that adding a person is
   a one-line edit. */
function myName() {
	return character.name;
}

function myEntry() {
	return CONFIG.characters[myName()] || null;
}

function myRole() {
	const e = myEntry();
	return e ? e.role : null;
}

/* Position in the roster fixes the bank window. Object key order is insertion
   order for string keys, which is exactly the declaration order above - so the
   slot a character gets is visible by reading CONFIG.characters top to bottom,
   with no separate table to keep in step. */
function myIndex() {
	return Object.keys(CONFIG.characters).indexOf(myName());
}

/* Minutes past the hour when this character owns the bank. */
function myBankMinute() {
	const i = myIndex();
	if (i < 0) return null;
	return (CONFIG.bank.firstWindowMinute + i * CONFIG.bank.staggerMinutes) % 60;
}

function isMyBankWindow(now) {
	const minute = myBankMinute();
	if (minute === null) return false;
	const d = new Date(now || Date.now());
	const msIntoHour = d.getMinutes() * 60000 + d.getSeconds() * 1000;
	const start = minute * 60000;
	return msIntoHour >= start && msIntoHour < start + CONFIG.bank.windowMs;
}
