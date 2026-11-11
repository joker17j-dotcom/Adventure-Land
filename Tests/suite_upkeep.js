/* Small upkeep rules on the party scripts, 2026-11-09.

   Merchant v144 - mp from the free regen_mp skill, the operator's ruling of
   2026-11-08 20:30-20:32 EST: "use the skill, any time it would fully fill",
   and never ahead of an hp drink (it puts the shared potion cooldown up x2).

   Ranger v164 - Dexon leaves a party he does not lead. After a crypt
   hand-back the party was MageofOz's with Dexon in it; FatherToken's
   partyMaker left it, Dexon's invite put him back (the server's accept joins
   the INVITER's party), every ~2s.

   Merchant v145 - a gear visit ends on the first unreachable town spot, and
   a walk another of his own walks took over is not "stuck": the restock
   waits for the lock and walks once more. */

const { lift, extract, world } = require('./lift');

function merchWorld(c) {
	const w = world({
		character: Object.assign({ name: 'Meltymerch', hp: 1000, max_hp: 1000, mp: 0, max_mp: 1000 }, c),
		CONFIG: { potions: { hpThreshold: 400 } },
		parent: { G: { skills: { regen_mp: { output: 100 } } } },
	});
	w.used = []; w.cd = {};
	w.use_skill = (s) => { w.used.push(s); };
	w.is_on_cooldown = (s) => !!w.cd[s];
	w.setTimeout = () => {};      // potionLoop reschedules itself
	lift(w, 'Party/Merchant.js', ['regenMpAmount', 'potionLoop']);
	return w;
}

function rangerWorld(c, party) {
	const w = world({ character: Object.assign({ name: 'Dexon' }, c), CONFIG: { party: { autoManage: true, groupMembers: ['Dexon', 'FatherToken', 'MageofOz'] } } });
	w.invites = []; w.left = 0; w.T = 1000000;
	w.Date = { now: () => w.T };
	w.get_party = () => party || {};
	w.get_entity = () => null;
	w.send_party_invite = (n) => w.invites.push(n);
	w.send_party_request = () => {};
	w.leave_party = () => { w.left++; };
	w.partyLeftAt = 0;
	w.PARTY_LEAVE_GAP_MS = 5000;
	lift(w, 'Party/Ranger.js', ['partyMaker']);
	return w;
}

module.exports = [
	{
		name: 'Merchant v144: regen_mp whenever it would fully fill, never ahead of an hp drink',
		async fn(t) {
			let w = merchWorld({ mp: 900 });
			await w.potionLoop();
			t.eq('100 missing: regen_mp', w.used, ['regen_mp']);
			w = merchWorld({ mp: 901 });
			await w.potionLoop();
			t.eq('99 missing: it would not fully fill - nothing', w.used, []);
			w = merchWorld({ mp: 0, hp: 599 });
			await w.potionLoop();
			t.eq('hp under the drink line: hp, not mp', w.used, ['use_hp']);
			w = merchWorld({ mp: 0, hp: 599 }); w.cd.use_hp = true;
			await w.potionLoop();
			t.eq('hp under the line with the potion on cooldown: still not regen_mp', w.used, []);
			w = merchWorld({ mp: 0, hp: 600 });
			await w.potionLoop();
			t.eq('hp at the line: regen_mp', w.used, ['regen_mp']);
			w = merchWorld({ mp: 0 }); w.cd.regen_mp = true;
			await w.potionLoop();
			t.eq('on cooldown: nothing', w.used, []);
			t.ok('never use_mp - the stack is not drunk', !/use_skill\('use_mp'\)/.test(extract('Party/Merchant.js', 'potionLoop')));
			w = merchWorld({ mp: 880 }); w.parent.G.skills.regen_mp.output = 150;
			await w.potionLoop();
			t.eq("the amount is G's, not a literal: 120 missing of a 150 skill - nothing", w.used, []);
		},
	},
	{
		name: 'Ranger v164: Dexon leaves a party he does not lead, then invites',
		fn(t) {
			let w = rangerWorld({ party: 'MageofOz' }, { MageofOz: {}, Dexon: {}, Meltymerch: {} });
			w.partyMaker();
			t.eq('in MageofOz\'s party: leaves it', w.left, 1);
			t.eq('and invites nobody into it', w.invites, []);
			t.ok('says so', w.logs.some((m) => /in MageofOz's party - leaving it to lead my own/.test(m)));
			w.T += 4999; w.partyMaker();
			t.eq('not again inside the gap', w.left, 1);
			w.T += 1; w.partyMaker();
			t.eq('again at the gap', w.left, 2);
			w = rangerWorld({ party: undefined }, {});
			w.partyMaker();
			t.eq('in no party: invites the others', w.invites, ['FatherToken', 'MageofOz']);
			t.eq('without leaving', w.left, 0);
			w = rangerWorld({ party: 'Dexon' }, { Dexon: {}, FatherToken: {} });
			w.partyMaker();
			t.eq('leading his own: invites the one missing', w.invites, ['MageofOz']);
			t.eq('and stays', w.left, 0);
		},
	},
];

function mvWorld(o) {
	const w = world({ character: { name: 'Meltymerch', map: 'halloween', x: 0, y: 0 }, CONFIG: { restockTakeoverWaitMs: 90000, npc: { x: 0, y: 0 } } });
	w.T = 1000000; w.Date = { now: () => w.T };
	w.lines = []; w.game_log = (m, c) => w.lines.push([String(m), c]);
	w.held = false; w.moveLockHeld = () => w.held;
	w.towns = 0;
	w.moveTo = o.moveTo; w.moveTown = o.moveTown || (async () => { w.towns++; });
	w.travelTookOverAt = 0;
	lift(w, 'Party/Merchant.js', ['travelTo']);
	return w;
}
const interrupted = () => { const e = new Error('interrupted'); e.reason = 'interrupted'; return e; };
const busy = () => { const e = new Error('busy'); e.reason = 'move_busy'; e.moveBusy = true; return e; };

module.exports.push(
	{
		name: 'Merchant v145: a walk his own summon took over backs off, not "stuck"',
		async fn(t) {
			let w = mvWorld({ moveTo: async () => { w.held = true; throw interrupted(); } });
			t.eq('interrupted with the lock now held: false', await w.travelTo('main', -179, -72), false);
			t.eq('no town fallback', w.towns, 0);
			t.ok('an orange line, not a red one', w.lines.length === 1 && w.lines[0][1] === 'orange' && /by another walk of mine - not falling back to town/.test(w.lines[0][0]));
			t.eq('and the takeover stamped', w.travelTookOverAt, w.T);

			w = mvWorld({ moveTo: async () => { throw interrupted(); } });
			await w.travelTo('main', -179, -72);
			t.eq('interrupted with the lock free: the town fallback as before', [w.towns, w.lines[0][1]].join(), '1,red');

			w = mvWorld({ moveTo: async () => { throw interrupted(); }, moveTown: async () => { throw busy(); } });
			t.eq('town refused move_busy: false', await w.travelTo('main', -179, -72), false);
			t.ok('saying he is NOT stuck', /holds the move lock - not stuck/.test(w.lines[1][0]) && w.lines[1][1] === 'orange');
			t.eq('stamped', w.travelTookOverAt, w.T);

			w = mvWorld({ moveTo: async () => { throw interrupted(); }, moveTown: async () => { throw interrupted(); } });
			await w.travelTo('main', -179, -72);
			t.ok('town failing any other way is still reported as stuck', /may be stuck on halloween/.test(w.lines[1][0]));

			w = mvWorld({ moveTo: async () => { throw busy(); } });
			t.eq('refused busy up front: silent false, stamped', [await w.travelTo('main', 0, 0), w.lines.length, w.travelTookOverAt === w.T].join(), 'false,0,true');
		},
	},
	{
		name: 'Merchant v145: the restock waits for the lock and walks once more',
		async fn(t) {
			const mk = (tookOver, freeAfter, second) => {
				const w = world({ character: { name: 'Meltymerch', map: 'halloween', x: 900, y: 900 }, CONFIG: { restockTakeoverWaitMs: 90000, npc: { x: 0, y: 0 } } });
				w.T = 1000000; w.Date = { now: () => w.T };
				w.sleep = async (ms) => { w.T += ms; };
				w.atTownSpot = () => false;
				w.distance = () => 1000;
				w.walks = 0;
				w.travelTookOverAt = 0;
				w.goToTownSpot = async () => { w.walks++; if (w.walks === 1) { if (tookOver) w.travelTookOverAt = w.T; return false; } return second; };
				const until = w.T + freeAfter;
				w.moveLockHeld = () => w.T < until;
				w.have = 500; w.quantity = () => w.have;
				w.buy_with_gold = async (n, q) => { w.have += q; };
				lift(w, 'Party/Merchant.js', ['ensureStock']);
				return w;
			};
			let w = mk(true, 5000, true);
			t.eq('taken over, lock free after 5s: stocked', await w.ensureStock('mpot1', 2500), true);
			t.eq('two walks, the second after the wait', [w.walks, w.T >= 1005000].join(), '2,true');
			w = mk(false, 0, true);
			t.eq('a plain failure: no wait, no second walk', [await w.ensureStock('mpot1', 2500), w.walks].join(), 'false,1');
			w = mk(true, 200000, true);
			t.eq('the lock never frees inside the wait: gives up without walking again', [await w.ensureStock('mpot1', 2500), w.walks].join(), 'false,1');
			t.ok('after restockTakeoverWaitMs', w.T - 1000000 >= 90000 && w.T - 1000000 < 91000);
			w = mk(true, 0, false);
			t.eq('the second walk failing too: false', [await w.ensureStock('mpot1', 2500), w.walks].join(), 'false,2');
		},
	},
	{
		name: 'Merchant v145: a gear visit ends on the first step that cannot reach the town spot',
		async fn(t) {
			const mk = (failAt) => {
				const w = world({
					character: { name: 'Meltymerch', gold: 1e9, items: [] },
					CONFIG: { gearProgression: { enabled: true, maxStepsPerVisit: 12, intervalMs: 1000 } },
					state: { busy: false, standOpen: false }, PROBE: { hold: false },
				});
				w.lines = []; w.game_log = (m, c) => w.lines.push([String(m), c]);
				w.setTimeout = () => {};
				w.isKnownGearItem = () => false; w.findCandidacy = () => null; w.gearHeldKeys = new Set(); w.gearHeldKey = () => '';
				w.canStartSpending = () => true; w.findBaseDuplicateGroup = () => null; w.gatherPlanCandidates = () => [1];
				w.standDwellHeld = () => false; w.goToTownSpot = async () => true;
				w.gearTownUnreachable = false;
				w.steps = 0;
				w.autoCombineOneBaseDuplicateGroup = async () => false;
				w.attemptBestPlanStep = async () => { w.steps++; if (w.steps >= failAt) w.gearTownUnreachable = true; return true; };
				lift(w, 'Party/Merchant.js', ['gearProgressionLoop']);
				return w;
			};
			let w = mk(1);
			await w.gearProgressionLoop();
			t.eq('unreachable on the first step: one attempt, not twelve', w.steps, 1);
			t.ok('no "N step(s)" line, one orange line', !w.lines.some((l) => /step\(s\) in one visit/.test(l[0])) && w.lines.some((l) => l[1] === 'orange' && /town spot is out of reach - ending this visit/.test(l[0])));
			t.eq('the visit lets go of busy', w.state.busy, false);
			w = mk(3);
			await w.gearProgressionLoop();
			t.ok('two good steps then unreachable: 3 attempts, "2 step(s)"', w.steps === 3 && w.lines.some((l) => /Gear progression: 2 step\(s\) in one visit/.test(l[0])));
			w = mk(99);
			await w.gearProgressionLoop();
			t.eq('never unreachable: the cap as before', w.steps, 12);
			w = mk(99);
			w.autoCombineOneBaseDuplicateGroup = async () => { w.gearTownUnreachable = true; return false; };
			await w.gearProgressionLoop();
			t.eq('the combine step unreachable: the plan step is not tried after it', w.steps, 0);
			/* the flag is cleared at the start of each visit */
			w = mk(99); w.gearTownUnreachable = true;
			await w.gearProgressionLoop();
			t.eq('a flag left by an earlier failure does not end the next visit', w.steps, 12);
			/* and ensureUpgradeMaterials is what sets it */
			const e = world({ character: { name: 'Meltymerch', items: [] } });
			e.gearTownUnreachable = false;
			e.quantity = () => 0; e.goToTownSpot = async () => false;
			e.SPOT_VENDORS = new Set(['cscroll0']); e.MATERIAL_VENDORS = {};
			lift(e, 'Party/Merchant.js', ['ensureUpgradeMaterials']);
			let threw = '';
			try { await e.ensureUpgradeMaterials('cscroll0', 'none'); } catch (x) { threw = String(x.message || x); }
			t.ok('an unreachable town spot throws, as before', /Could not reach the town spot for cscroll0/.test(threw));
			t.eq('and sets the flag', e.gearTownUnreachable, true);
		},
	},
);
