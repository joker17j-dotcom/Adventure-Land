/* Small upkeep rules on the party scripts, 2026-11-09.

   Merchant v144 - mp from the free regen_mp skill, the operator's ruling of
   2026-11-08 20:30-20:32 EST: "use the skill, any time it would fully fill",
   and never ahead of an hp drink (it puts the shared potion cooldown up x2).

   Ranger v164 - Dexon leaves a party he does not lead. After a crypt
   hand-back the party was MageofOz's with Dexon in it; FatherToken's
   partyMaker left it, Dexon's invite put him back (the server's accept joins
   the INVITER's party), every ~2s. */

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
