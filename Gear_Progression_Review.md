# Gear Progression Review

Oct 9, 2026 · @Jay

Switch the ranger's mainhand to bowofthedead at both tiers. ADOPTED 2026-10-10 at +7 for tier 2 rather than the +8 recommended below, because OpenGifts already compounds bowofthedead to +7, so the goal names the level the supply line is already working toward; tier 3 stands at +9. bowofthedead+8 matches firebow+9 on attack and range, adds str 20 and crit 2.75, and costs 273M against firebow+9's 1.11bn. The bigger finding is outside the plan entirely — 2,161 stormfeather, 2,503 seashell and 278 drapes in the bank craft directly into ranger gear, and the only thing blocking them is essenceofether, which nobody on the feed is selling.

## What you have

Two unrelated things get called "tier" here, so this document keeps them apart. **Item tier** is the game's own label, `G.items[x].tier` — xgloves is item tier 4, firebow item tier 2, bowofthedead 2.4. **Plan tier** is a row in your `GEAR_PROGRESSION`: the tier-2 and tier-3 goal sets. They are independent, and a high item tier does not make something the better choice — xpants+0 is item tier 4 and still loses to frankypants+7 at item tier 3, because level outweighs tier. Unqualified "tier-2 goal" always means your plan.

Total gold is 951.1M, two thirds of it banked. That is enough to fund the bow project and the short-term list together with room to spare.

| Holder | Gold |
| --- | --- |
| Bank | 622,677,330 |
| Meltymerch | 326,906,058 |
| Dexon | 500,000 |
| FatherToken | 500,000 |
| MageofOz | 500,000 |
| **Total** | **951,083,388** |

The bank holds 17,819 items across 6 packs, 176 of 221 slots used, 45 free. 65 of the 120 distinct lines are equipment. The ones that matter:

| Item | Levels held | Note |
| --- | --- | --- |
| xgloves | +6 | item tier 4; value 24.4M — the most valuable thing you own |
| xpants | +0 ×2 | item tier 4; 4.68M each, nobody wearing them |
| xhelmet | +0 | item tier 4; spare for FatherToken's +6 |
| mshield | +0, +6 | item tier 3; +6 is worth 11.7M |
| frankypants | +6 | item tier 3; spare |
| scroll3 | ×5 | 480M each to replace, 28.8M each to sell |
| cscroll3 | ×1 | 1.84bn to replace |
| offering | ×1 | 27.4M each, and every grade-2+ ladder wants them |
| sparkstaff | +0 ×13, +6 | the mage's tier-3 mainhand, 13 spare at +0 |
| firestaff | +0 ×8 | the mage's tier-2 mainhand |
| gbow | +0 ×2 | tier 2.5 |
| reunionbow | +0 | item tier 2.75; ranger-only |
| talkingskull | +0 ×2, +1 ×2, +2 ×2 | OpenGifts is compounding these to +3 |
| jacko | +0 ×2, +1 ×2, +2 ×2, +3 ×2 | mage orb, tier-3 goal is +5 |
| bowofthedead | none | nothing banked, despite the +7 target |

Materials, largest first: pumpkinspice 3,383 · seashell 2,503 · stormfeather 2,161 · reefglass 1,702 · candy0 1,674 · feather0 1,160 · candy1 684 · slice\_blueberry 545 · rattail 467 · leather 458 · gem1 451 · vitscroll 343 · drapes 278 · funtoken 223 · monstertoken 190 · anniversarygift 168 · bwing 164 · frostcore 119 · gem0 103 · gemfragment 73 · essenceoffrost 30 · tombkey 18 · slice\_mint 18 · cryptkey 13.

Worn gear against the plan — only the gaps:

| Character | Slot | Worn | Plan tier-2 goal | Gap |
| --- | --- | --- | --- | --- |
| Dexon | mainhand | firebow+7 | firebow@9 | 2 levels short — right item for the plan as written; see the mainhand section on changing the goal |
| Dexon | cape | cape+7 | ecape@7 | wrong item |
| Dexon | gloves | poker+6 | supermittens@5 | wrong item, no market supply |
| Dexon | orb | ftrinket+2 | orbofdex@3 | wrong item |
| Dexon | ring2 | ringsj+4 | cring@3 | wrong item |
| Dexon | earrings | dexearring+2, +3 | dexearring@4 ×2 | 1–2 levels each |
| FatherToken | mainhand | firestaff+7 | lmace@6 | wrong item — he is holding the mage's weapon |
| FatherToken | cape | bcape+5 | gcape@7 | bcape is the tier-3 cape, 3 short of its own goal |
| FatherToken | shoes | wingedboots+7 | wingedboots@8 | 1 level |
| FatherToken | rings, amulet, belt, earrings, orb | ringsj+3, intamulet+2, intbelt+3, intearring+2, ftrinket+2 | cring@3, intamulet@4, intbelt@4, cearring@3, rabbitsfoot@1 | all wrong item or short |
| MageofOz | offhand | empty | wbook0@4 | not a gap — sparkstaff is two-handed and blocks the slot |
| MageofOz | cape | ecape+6 | ecape@7 | 1 level |
| MageofOz | shoes | wingedboots+4 | wingedboots@8 | 4 levels |
| MageofOz | gloves | poker+6 | supermittens@5 | wrong item |

Dexon's pants (frankypants+7) and FatherToken's xarmor+5 and xgloves+6 already beat their plan tier-3 goals. Those are the temporary-looking discrepancies you mentioned, and they are upgrades rather than regressions. Dexon's shoes are a genuine trade rather than a clear win — see below.

### Dexon's shoes: armour against attack rate

First, a correction to the obvious framing: **wingedboots carry no dexterity.** Neither boot does — both are 0 dex at every level. The only damage axis here is `frequency`, and `speed` is movement, not attack speed.

| Shoes | Armor | Resist | Dex | Frequency | Move speed |
| --- | --- | --- | --- | --- | --- |
| xboots+6 (worn) | 63 | 31 | 0 | 0 | 16 |
| xboots+8 | 84 | 41 | 0 | 0 | 20 |
| wingedboots+8 (plan tier-2 goal) | 19 | 33 | 0 | **8** | 17 |
| wingedboots+10 (plan tier-3 goal) | 27 | 41 | 0 | **12** | 22 |

Swapping xboots+6 for wingedboots+8 costs 44 armor off his 384. Through the game's own `damage_multiplier` that is 0.6294 → 0.6690, so **+6.3% physical damage taken**. Resistance moves +2, which is nothing.

The gain is larger than it looks, because **mrnarmor+7 is the only item he wears that carries frequency at all, and it carries 1.** So the boots take his item frequency from 1 to 9 — about **+8% attack rate**, 811 ms between shots down to roughly 751 ms. Item frequency reads as an additive percentage, which the two characters corroborate: solving `ratio = (1 + mainstat·k)(1 + freq/100)` gives k = 0.0090 for Dexon at 1 frequency and k = 0.0096 for FatherToken at 8, within 6% of each other, where ignoring frequency entirely would put them 18% apart. Different classes, so this is support rather than proof.

So: **+8% damage for +6.3% damage taken.** Close to a wash, tilted toward damage whenever survival is not the binding constraint — and your own history says it sometimes is, with the wipes at cgoo recorded in the Priest v32/v33 notes. Treat it as a per-spot choice rather than a permanent one; the farm scorer already computes incoming dps, so it has the input it would need to make the call.

It is moot until the feather campaign delivers. There are **zero spare wingedboots** — FatherToken wears +7, MageofOz +4, none banked, and not one ask across the feed. Keeping xboots+6 for now is right. Raising it is not cheap either: xboots is graded 0/0/8/10, grade 2 from the first level.

MageofOz is a special case worth stating plainly: he is already past his plan tier-2 mainhand and offhand, not behind them. `sparkstaff` has wtype `great_staff`, which sits in `G.classes.mage.doublehand` — it is two-handed, so the empty offhand is structural rather than an oversight. And **sparkstaff+7 is attack 113 / range 115 against firestaff+9's 94 / 94**, so he beats the plan tier-2 mainhand goal two levels below his own. The plan already encodes this correctly: the mage tier-3 row is `sparkstaff@9` with `offhand: null`. His real mainhand gap is sparkstaff +7 → +9, and 13 spare sparkstaff+0 are banked for it. The doublehand cost is speed −12, frequency −10% and mp\_cost +160, which is already in his live frequency of 0.955.

## The ranger's mainhand

Yes — switch both tiers to bowofthedead. It is strictly better than firebow at every level from +7 up, so the comparison that decides it is equal-outcome, not equal-level.

Stats are from the client's own `calculate_item_properties`. Costs are all-in gold to end up holding one at that level, built from +0, with every destroyed copy charged at its acquisition price — that is the number that matters, because a failure sends you back to +0 and none of these bows is sold by an NPC.

| Bow | Level | Attack | Range | Extras | Copies consumed | All-in gold |
| --- | --- | --- | --- | --- | --- | --- |
| firebow (now worn) | +7 | 76 | 105 | — | 30.5 | 11.5M |
| firebow | +8 | 85 | 118 | — | 171 | 73.7M |
| firebow | +9 (current plan tier 2) | 97 | 135 | — | 1,854 | 1.11bn |
| firebow | +10 (current plan tier 3) | 115 | 160 | — | 41,905 | 36.6bn |
| bowofthedead | +7 | 82 | 121 | str 20, crit 2.45 | 30.5 | 36.7M |
| bowofthedead | +8 (proposed plan tier 2) | 92 | 134 | str 20, crit 2.75 | 218 | 273M |
| bowofthedead | +9 (proposed plan tier 3) | 104 | 151 | str 20, crit 3.15 | 2,357 | 3.27bn |
| bowofthedead | +10 | 124 | 177 | str 20, crit 3.75 | 53,280 | 85.4bn |
| reunionbow | +7 | 87 | 131 | crit 1, ranger-only | 21.8 | 373M |
| reunionbow | +9 | 111 | 161 | crit 1, ranger-only | 890 | 20.5bn |
| gbow | +7 | 83 | 133 | str 3 | 34.5 | 684M |

The two comparisons that answer the question:

- **bowofthedead+8 against firebow+9**: 5 attack and 1 range behind, 20 str and 2.75 crit ahead, for **273M against 1.11bn**. Four times cheaper for the same weapon, effectively.
- **bowofthedead+9 against firebow+10**: 11 attack and 9 range behind, same str and crit advantage, for **3.27bn against 36.6bn**. Eleven times cheaper.

Why firebow looked like the right pick when the plan was written, and why it no longer is: the grade bands decide the cost, and firebow's are 0/8/10/12 — it stays grade 1 all the way to +7, so cheap scroll1s carry it most of the way. bowofthedead is 0/5/10/12, grade 2 from +5. Per level firebow genuinely is the cheaper ladder. But bowofthedead carries 20 str and a crit roll firebow has none of, and more base attack and range at equal level, so you need fewer levels of it — and the level is what costs exponentially.

Those firebow figures price a copy at its 178,000 base value. The only live firebow+0 ask on the whole feed is 3,000,000, and at that price firebow+9 costs 4.76bn rather than 1.11bn, which widens the gap to 17×. bowofthedead+0 is asking 228,000 on EUIV, exactly its base value, and you said Ponty is carrying it through the Halloween event. So bowofthedead is both the better item and the one you can actually buy in bulk.

Drop gbow and reunionbow as mainhand candidates. gbow's bands are 0/0/10/12, grade 2 from the very first level, which is why +7 costs 684M despite its item tier of 2.5. reunionbow is the best base attack of the four and ranger-locked, but grade 2 from +3 and grade 3 from +9 make it 373M at +7 — ten times bowofthedead+7 for 5 more attack. Keep the one you have as a curiosity, not a project.

Three config edits in `GEAR_PROGRESSION.ranger` — tier 2 mainhand, tier 3 mainhand, tier 2 gloves. Shipped in Merchant v92 on 2026-10-10:

```
mainhand: { item: 'bowofthedead', level: 7, method: 'upgrade' }
mainhand: { item: 'bowofthedead', level: 9, method: 'upgrade' }
gloves:   { item: 'thundergrips', level: 7, method: 'upgrade' }   // tier 2 only
```

OpenGifts already drives bowofthedead to +7, so the supply line is built. Adopting +7 as the tier-2 goal on 2026-10-10 therefore costs nothing to put in place — it names the level that pipeline is already working toward. Raising the goal to +8 costs 218 bows against 30.5, which is why it was left where it is: worth doing deliberately, not by default. Nothing is banked yet, so the bank table above still shows bowofthedead at none.

## The ranger's gloves

thundergrips are crafted, not bought outright, from an item purchased with huntertokens. That is why the earlier reading of the Hunter shop as gear the party had outgrown was wrong: the shop is a materials source, not a gear source, and six craft recipes pull from the token shops.

supermittens are the better glove and stay the long-term answer for this slot, but they are not obtainable right now. Until they are, thundergrips+7 is the best available item for the ranger's gloves, and it is the tier 2 config entry as of 2026-10-10.

Tier 3 deliberately leaves gloves unset. The answer there is supermittens, and naming thundergrips at a higher level would spend craft materials on a slot that is already scheduled to be replaced.

The craft consumes essenceofether at 12 per copy, against 18 held on 2026-10-10 — so +7 is a single-life target rather than something to iterate on. essenceofether is on both the ponty buy list and the keep-and-bank list for exactly this reason.

## Short term

### Every worn item has an unallocated stat pool

This outranks everything else below. **127 points of main stat are sitting unassigned across 16 worn items, on all three fighters.**

An item's `Stat: 10` is not a bonus to the wearer's main stat. It is an unallocated pool that does nothing until the item *instance* carries a `stat_type`, and then the whole pool goes to that one attribute. Measured on xboots+6: `calculate_item_properties({name:'xboots',level:6})` returns dex 0; the same call with `stat_type:'dex'` returns **dex 10**, and with `'vit'` returns **vit 10**. Dexon's boots are stored as `{"name":"xboots","level":6}` with no `stat_type` at all, which is why unequipping them changed nothing.

You set it with a **pscroll** — Dexterity, Intelligence, Strength, Vitality, Fortitude or Luck Scroll, 8,000 gold each — applied through the same `upgrade(item, scroll)` call as an upgrade scroll. The docs list `{success: true, stat: true, stat_type: "str"}` among its fulfilled results. Lucas (the `scrolls` NPC) stocks dexscroll, intscroll and strscroll; you also hold **343 vitscroll** and 1 dexscroll in the bank.

| Character | Main stat | Scrollable pool | Live stat | After | Gain |
| --- | --- | --- | --- | --- | --- |
| Dexon | dex | 44 over 5 items | 227 | 271 | **+19.4%** |
| FatherToken | int | 44 over 5 items | 188 | 232 | **+23.4%** |
| MageofOz | int | 39 over 5 items | 195 | 234 | **+20.0%** |

Not everything takes a scroll, and I checked rather than assumed: **capes and shields carry a pool but have no `scroll` flag**, so FatherToken's mshield+7 pool of 14 and all three capes' pools are permanently inert. Weapons have no pool at all. The pool also grows with upgrade level — most gear adds +1 per level — so a +7 item is worth more than a +4 to scroll.

The one number I do not have is **how many scrolls one item takes**. The docs show a `scroll_quantity` rejection carrying `need: 100, have: 24`, so it is plausibly around 100 per item, which would be about 800,000 a slot and roughly 13M for all 16. Settle it for free before buying: put one dexscroll in Dexon's inventory and run `upgrade(locate_item('xboots'), locate_item('dexscroll'), null, true)` — calculation mode consumes nothing, and the rejection reports `need` against `have`.

A note for the plan: the `GEAR_PROGRESSION` comment comparing coat+9 at "stat 15" with mrnarmor+7 at "stat 10" was comparing two inert pools. Neither was contributing anything when that call was made.

The first two cost nothing — spare items already in your bank that beat what is being worn, though none of them replaces a plan goal outright.

| # | Action | Gain | Cost |
| --- | --- | --- | --- |
| 1 | **Type the stat pools** with pscrolls (above) | +19–23% main stat on all three | 8,000/scroll at the scrolls NPC; copies per item (needed = [1, 10, 100, 1000, 9999, 9999, 9999] indexed by grade — so grade 0 costs 1 scroll, grade 1 costs 10, grade 2 costs 100. Your helmet is grade 2. A grade 3 item would want 1,000.) |
| 2 | Spare **xgloves+6** onto Dexon (lower armor/resistance than MageofOz; both wear poker+6) | +61 armor, +48 resistance for −0.5 crit | free |
| 3 | Drive **bowofthedead to +7** | 82/121 + str 20 + crit 2.45, over firebow+7's 76/105 | 36.7M |
| 4 | Buy **slice\_mint ×96 at 250,000** on USIV | unblocks the sixcake line — see Mechanics | 24M |
| 5 | Buy **bowofthedead+0 in bulk at 228,000** while the event runs | the supply for +8 later | 228,000 each |
| 6 | Run Cave of Many Dreams and craft cave\_loaded\_die for Dexon's orb slot | +8.9% expected damage at +0; \~3 dice per run; no XP or item loss on death inside | one daily account visit + 16,000 per die |

Detail on the three free ones, because each also says something about the plan:

- **Gloves.** poker+6 is armor 20, resistance 15. xgloves+6 is 81 and 63, class-unrestricted, and one is sitting in the bank while FatherToken wears the other. Both Dexon and MageofOz are in poker+6. The plan tier-2 and tier-3 goal for that slot is supermittens@5 and @6 — and supermittens appears on the feed only as bids (400M at +7, 700M at +8, 1bn at +9), never an ask. You cannot buy one. Make xgloves the goal instead; you already own it.
- **Mage offhand.** Retracted. I first read the empty slot as an oversight and suggested putting the spare mshield+6 in it. That is impossible: sparkstaff's wtype is \`great\_staff\`, listed in \`G.classes.mage.doublehand\`, so it occupies both hands and nothing can go in the offhand while he holds it. The plan's own mage tier-3 row says \`offhand: null\` for exactly this reason. wbook0@4 is only reachable if he moves back to a one-handed staff, and that costs him 19 attack and 21 range — not worth it for wbook0+4's int 26.
- **Ranger helmet.** Retracted — I had this backwards. I compared fury against xhelmet on armor, resistance and dex only, and those three are not what fury is for. **fury+5 carries apiercing 70 and crit 8.5; fury+8 carries apiercing 108 and crit 10.375. xhelmet has neither at any level — it is armor and resistance and nothing else.** Measured against the monsters Dexon actually farms, fury+5's apiercing 70 alone is worth +9.4% damage on gscorpion (armor 300), +8.3% on crab, +10.8% on bscorpion and +6.5% even against zero-armor mobs, since the game amplifies damage once effective armor goes negative. Add crit 8.5 on top and the helmet is carrying roughly +15–19% of his damage. The xhelmet+0 swap would have bought about 2% less damage taken for that. A clear no. fury stays in both ranger rows, and the plan was right to treat that slot as a damage slot. The 30bn to reach +8 from scratch is still real, but it buys apiercing +38 and crit +1.9 over the +5 he wears — judge it on that, not on armor.

Four config edits follow from the above and from the bow section, all in `GEAR_PROGRESSION`:

| Class | Slot | Current goal | Change to |
| --- | --- | --- | --- |
| ranger | mainhand | firebow@9 / @10 | bowofthedead@7 / @9 — ADOPTED 2026-10-10 in v92 |
| ranger | helmet | fury@4 / @8 | **no change** — apiercing and crit, not armor |
| ranger | gloves | supermittens@5 / @6 | thundergrips@7 at tier 2 — ADOPTED 2026-10-10 in v92; supermittens stays the tier 3 goal and is unobtainable for now |
| mage | gloves | supermittens@5 / @6 | **no change** — supermittens carries apiercing 47, rpiercing 47 and frequency 3; xgloves is a stopgap over poker, not a replacement goal |
| mage | mainhand | firestaff@9 (tier 2) | sparkstaff — he already exceeds the firestaff goal |
| mage | offhand | wbook0@4 (tier 2) | drop it; tier 3 already says `null` for the two-handed staff |

One caution on xhelmet and xgloves: both are graded 0/0/8/10, so they are grade 2 from the very first level and every upgrade step is expensive. Equip them at the levels you have, and treat raising them as a separate decision rather than an automatic ladder.

## Long term

Three campaigns are worth committing to. Several current goals are not, and the numbers say so clearly enough that retiring them is the bigger win.

**1. bowofthedead to +8 — 273M, and there are now three ways in, not one.** The bows are the cheap half: a live read of the bridge's `/ponty` at 21:35 UTC found **50 copies of `bowofthedead@0` at 273,600 on 10 of the 11 shards**, plus one `@3` at 393,600. That is \~14M of bows against \~223M of scrolls, so the scrolls dominate and the bow price barely matters. Ponty stock is a rolling snapshot, so treat the 50 as what was there at that minute rather than a standing figure.

The third route is the one I had missed: **`bowofthedead` is craftable** — `G.craft.bowofthedead` is 1 `mbones` + 1 `bow` + 120,000 gold, at Leo. Whichever of the three is cheapest on the day, buy or craft in bulk and keep the spares: a failed normal upgrade destroys the item, so the whole ladder is priced off the replacement cost, and at a quarter of a million a copy destruction stops being something worth buying protection against. `lock_item` the copy you are not risking — the shrine refuses a locked item rather than rolling it.

**2. wingedboots — a feather campaign, and longer than it looks.** One boot is 1 shoes (12,100 from `basics`) + 20 feather0 + 120,000, so your 1,160 feathers are 58 boots. The ladder needs 25.6 boots for a +7 and **170.5 for a +8**. Three characters at plan tier-2 (@8) is about 10,230 feathers; you have 11% of that. FatherToken already wears a +7, so the sensible order is: craft a second boot up to +7 (512 feathers) as a spare, then roll his worn +7 at the 15% step with a replacement in hand. There is a wingedboots+9 bid of 500M on USIII, but +9 costs about 475M all-in to reach — break-even, not a business.

**3. Buy scroll3 on the market, never from the NPC.** The NPC charges 480M. The feed has 280M ×2 on USIII, 300M on EUI, 350M ×29 on USV, 385M ×5 on USI and 417M ×33 on EUI. Every grade-3 step wants one and you hold five. At 280M that is a 200M saving per scroll with real depth behind it.

What to retire, with the reason as a number. These are all-in costs to reach the goal from +0, with destroyed copies charged at their acquisition price:

| Goal | Owner | All-in to reach | Verdict |
| --- | --- | --- | --- |
| firebow@10 | ranger t3 | 36.6bn | replaced by bowofthedead@9 at 3.27bn |
| fury@8 | ranger t3 | 30.0bn | keep it — apiercing 108 and crit 10.375; judge the 30bn on damage, not armor |
| mshield@9 | priest t3 | 23.4bn | 1,603 copies; +7 is worn and fine |
| wingedboots@10 | all t3 | 15.0bn | 72,489 boots — 1.45M feathers |
| wbook0@4 | mage t2 | 8.0bn | unreachable while he holds a two-handed staff |
| dexamulet@5 | ranger t3 | 4.1bn | 7,207 copies; +4 is worn |
| starkillers@8 | mage t3 | 3.5bn | park it; +6 is worn |
| jacko@5 | mage t3 | 2.5bn | 15,584 copies; +4 is worn |
| cring@3 | all t2 | 632M | and no asks on the feed, only bids — unbuyable |
| supermittens@5 / @6 | ranger, mage | — | zero asks across 822 stand slots; replaced by xgloves |

The cheapest open gap on the board is the mage's cape: **ecape+6 to +7 is a 24% roll, and rebuilding one from +0 is 6.7M.** That is his tier-2 cape finished for pocket change. Do it before anything on this list.

The best odds anywhere are **talkingskull +2 to +3 at 40%**, which OpenGifts already drives, with two +2s banked and one worn.

One structural note. Your stated policy — spend gold efficiently, but protect items whose supply is limited — is exactly the right objective, and it is what I modelled: the planner charges every destroyed copy at what it costs to replace, so it buys offerings and higher scrolls precisely when the item is scarce and cheap scrolls when it is not. That is why bowofthedead at 228,000 wants plain scroll2s, while fury at 457M wants an offering on nearly every step. If you ever change the acquisition price of something, the optimal scroll path changes with it.

## Mechanics you are not using

You listed exchanges, cheap-buy upgrading, the watchlist, unsinging farmed gear and the feather project. The gap is **crafting**: several of your largest bank stacks are direct inputs to gear in the plan, and you are holding them as loot rather than as materials.

| Stack | Held | Crafts into | At |
| --- | --- | --- | --- |
| stormfeather | 2,161 | thundergrips (gloves), windbelt (belt), stormquiver (offhand), reunionbow, paradequiver | 80 / 40 / 80 / 20 / 6 each |
| seashell | 2,503 | stillwaterlens, cave\_loaded\_die | 8 each |
| drapes | 278 | homecominghelm, homecomingcoat, homecomingcape, keepsakependant | 20 / 60 / 80 / 20 |
| bwing | 164 | moonshardearring, knifebelt, silkgrips, scribeorb | 40 / 20 / 20 / 50 |
| gem1 | 451 | charmer | 20 each |
| essenceoffrost | 30 | frostbow | 3 each, plus a `bow` from `basics` |
| gemfragment | 73 | stillwaterlens, cave\_deepaxe | 6 / 10 |

Three of those — thundergrips, windbelt, stormquiver — are the ranger's gloves, belt and offhand, which are three of his open slots.

**windbelt is a better belt goal than dexbelt@5, and by a wide margin.** Both are compound items, but windbelt is graded 1/5/6/7 against dexbelt's 2/5/6/7 — it sits on the top compound row at +0 — and its dex curve is steeper, so +3 lands where dexbelt needs +5:

| Belt | Dex | Armor | Speed | Base items | All-in gold |
| --- | --- | --- | --- | --- | --- |
| dexbelt+3 (worn) | 13 | — | — | 90.9 | 5.4M |
| dexbelt+5 (plan tier-3 goal) | 20 | — | — | 13,143 | 940M |
| **windbelt+3** | **19** | **22** | **4** | 90.9 windbelts | **110M** |
| windbelt+5 | 24 | 31 | 6 | 9,912 windbelts | 13.4bn |

windbelt+3 matches dexbelt+5's dex to within a point, adds 22 armor and 4 speed on top, and costs **8.5× less**. Stop at +3; +5 is another two orders of magnitude.

The catch is the same one as everywhere else in this section. One windbelt+0 is 300,000 plus 40 stormfeather, 4 essenceofether and a dexbelt+2 (itself 12.1 dexbelts, about 640,000) — roughly 1.17M all in. Ninety of them means **3,636 stormfeather** against the 2,161 you hold, and **364 essenceofether** against the zero you hold. The same material gates thundergrips at 12 each and stormquiver at 8 each, so one material stands between you and the ranger's belt, gloves and offhand together.

**The thing standing in the way is `essenceofether`.** Every stormfeather recipe needs 4 to 12 of it, and across 822 stand slots on the feed there is not one ask for it — only bids, at 48,000 for 7 and 320,000 for 1. People are buying it and nobody is selling. Its sources are now known, and they are the reason this line is stalled. The recipes also need a base item each (alloyquiver+5 for stormquiver, mrngloves+6 for thundergrips, dexbelt+2 for windbelt), and you already hold dexbelt+2 copies on the merchant.

| Source | Rate | Status |
| --- | --- | --- |
| **booboo** (spookytown) | 0.5000% | the only real source — and currently unfarmable, below |
| lglitch | 0.3709% | glitch event, not on demand |
| cutebee | 0.3709% | avoidance 99.9 — effectively unkillable, already flagged in Ranger v72 |
| glitch (exchange) | 0.2185% | glitch event, not on demand |
| **rgoo** (goobrawl) | 1 in 10,784 | so goo brawl *is* a source — at 0.0093%, 54× worse than booboo |

That settles the goo brawl question from the last section: rgoo spawns only on the goobrawl map, so the event does drop what you need, at a rate too low to plan around.

**Why booboo is closed, and why no gear in this document opens it.** booboo is hp 8,000, attack 220, frequency 1.2, **range 420**, rage 1.5, respawn 48s, nine of them on spookytown — and `damage_type: pure`. Pure damage ignores armor and resistance completely, so Dexon's 424 armor and 400 resistance count for nothing against it, and every defensive upgrade in this review is irrelevant to that fight. Range 420 also out-reaches all three characters (163 / 201 / 235), so there is no standing position it cannot hit from — the same property that put Slenderman out of reach in the Priest v40 note.

The hp is not the problem: 8,000 against Dexon's 2,083 dps is under four seconds. The problem is pulling more than one. One booboo is 264 dps straight through armor; three is 792, which takes Dexon from full to dead in about ten seconds. The gate is burst and heal throughput, plus not pulling a second — not defence. Your own scorer already agrees: `mhEvaluate('booboo')` returns `null`.

**Scale check before committing to this line.** windbelt+3 needs 90.9 windbelts, which is 364 essenceofether, which at 0.5% is about **72,800 booboo kills**. Even at a perfect nine-per-48-seconds that is over 100 hours of uptime. Treat the stormfeather line as a project that opens when booboo becomes farmable, not a near-term one — and note that a single windbelt+0 (4 essence) is 11 dex against the dexbelt+3 he already wears at 13, so there is no partial win to bank on the way.

**The gate is one material across eight recipes, and it is harder than "cannot farm booboo".** Your own reading of this was right. Reading `G.craft` in full, every crafted improvement in reach of this party that is blocked at all is blocked on the same input:

| Recipe | essenceofether | Other inputs |
| --- | --- | --- |
| `windbelt` | **4** | `dexbelt+2`, 40 stormfeather, 300,000 |
| `scribeorb` | **4** | `wbook0+3`, 12 voidthread, 50 bwing, 280,000 |
| `moonshardearring` | **4** | `intearring+2`, 8 voidthread, 40 bwing, 240,000 |
| `reunionbow` | **4** | 2 sixcake, `t2bow`, 20 stormfeather, 4,000,000 |
| `gloampendant` | 6 | `dexamulet+2`, 30 voidthread, 80 bwing, 6,400,000 |
| `stormquiver` | 8 | `alloyquiver+5`, 80 stormfeather, 500,000 |
| `thundergrips` | 12 | `mrngloves+6`, 80 stormfeather, 800,000 |
| `starcloak` | 40 | `cape+7`, 40 voidthread, 1 platinumnugget, 1,800,000 |

One correction to the windbelt figure above: **a single `windbelt+0` costs 4, not 364.** The 364 was the cost of compounding to +3, which needs twenty-seven +0 copies. One craft is four essences, and `windbelt+0` already carries dex 11, armor 10 and speed 2 against the `dexbelt+3` Dexon wears today, which is dex 13 and nothing else.

What makes the gate hard is that four of the five sources are not reachable at all, rather than merely dangerous:

- **booboo**, 0.5% — measured on 2026-10-09 and the party cannot approach it, let alone farm it. Three deaths, zero kills, never reached the spawn.
- **cutebee**, 0.3709% — trivial to kill at hp 300 and attack 16, but it spawns **once per 480,000 bee spawns**. A lottery, not a farm.
- **glitch** 0.2185% and **lglitch** 0.3709% — these are **not in the deployed client data at all**. `G.monsters.glitch`, `G.monsters.lglitch` and `G.maps.glitch` are all undefined; only their drop tables exist in `G.drops`. Nothing about them can be located or planned for from here.
- **rgoo**, 1 in 10,784 — reachable only inside Goo Brawl, which until today the boss code silently skipped.

So enabling Goo Brawl is, as of today, **the only tap this party has on essenceofether.** It is a thin one at 1 in 10,784 per kill, but it is the difference between a slow trickle and nothing, and it costs no farming time because a brawl is nine minutes.

**One clean rule-out.** `knifebelt` needs no essenceofether — `dexbelt+2` + 30 spidersilk + 8 voidthread + 20 bwing + 12 poison + 350,000 — which makes it look like the way around the gate. It is not: **`knifebelt` does not scale with level.** `knifebelt+0` and `knifebelt+3` are identical, int 2, dex 8, armor 12, mp\_reduction 3. It is strictly worse than both windbelt and dexbelt at every level, and the ungated recipe is ungated because the item is a dead end. Worth pricing instead, all free of ether: `thistlequiver` (`quiver+5` + 10 pleather + 40 ashleaf + 5 essenceofnature + 140,000), `anchorbelt` (`hpbelt+2` + 150 reefglass + 1 cshell + 260,000, and the bank holds 1,702 reefglass), and `stillwaterlens` (240 rimeglass + 6 gemfragment + 8 seashell + `orbofint+0` + 800,000).

**sixcake is a 552M arbitrage you can run today.** It costs 100,000 to craft from one each of six cake slices, and it gates the homecoming set, paradequiver, reunionbow and keepsakependant. Your slices: blueberry 545, strawberry 163, honey 105, nightberry 77, citrus 44, **mint 18**. Mint is the only binding constraint, so you can make 18 sixcakes right now. On the feed, slice\_mint is 250,000 for 96 on USIV and free ×10 three times over on EUI; slice\_nightberry is free ×150 on USIV; slice\_citrus is free ×200 twice on USI. Meanwhile **sixcake itself asks 6,000,000, with 566 of them on EUIV.** Buying 96 mint for 24M yields 96 sixcakes that would cost 576M to buy outright.

**You are sitting on roughly 424M of idle tokens.**

| Token | Held | Best bid on the feed | Worth |
| --- | --- | --- | --- |
| monstertoken | 190 | 1,000,000 (q1,550 EUI) | up to 190M |
| funtoken | 223 | 1,050,000 (q532 EUIV) | up to 234M |
| cryptkey | 13 | asks around 9,000,000 | about 117M |
| tombkey | 18 | asks 1.16M–5M | about 21M |

Do not simply sell the monstertokens. `Merchant.js` records that mrnarmor costs 12 monstertokens from the monsterhunter and notes it is token-only — "the planner can never acquire one" — which is why Dexon's mrnarmor+7 was supplied by hand. **190 tokens is 15 mrnarmor**, and spare copies are exactly what an upgrade ladder consumes. That turns a slot the plan calls unobtainable into a supplied one. The keys are dungeon entries you have never spent; run them or sell them, but 138M sitting in a bank slot is neither.

**Goo brawl is now a boss event** — shipped in Ranger v76 / Priest v43 / Mage v66 on your instruction that the rewards are worth it. It had been silently skipped, and the cause was a single data quirk: it is the only one of the four joinable events whose `parent.S` key is an *event* name rather than a monster name. `G.monsters.crabxx`, `.franky` and `.icegolem` all exist and all carry `cooperative: true`; `G.monsters.goobrawl` does not exist at all. So `bossCooperative('goobrawl')` read undefined, answered false, and `cooperativeOnly` rejected it as "not cooperative" every time it went live. A second site failed the same way and would never have shown: `bossApproach` asked `get_nearest_monster({type:'goobrawl'})` and got null on every tick, so even a forced `bossJoin('goobrawl')` would have teleported in and then stood on the arrival point without ever taking a firing posture. A `BOSS_FIGHT_TYPE` map from the event name to `rgoo` fixes both, and relaxes no policy — goo brawl now passes the cooperative test for the same reason the other three do, rather than being waved through `include`.

The fight itself is a favourable one. `rgoo` is hp 1,000,000, attack 320 physical, frequency 1.2, armor 300, resistance 300, xp 48,000,000, `cooperative: true`, aggro 0.1, rage 0 — and **range 64** against the party's \~163. That is the free-shot band, alongside crabxx at 45 and icegolem at 64, not franky's hopeless 948. `bgoo` is hp 100,000, attack 5, range 15, xp 100,000. Both were already in `allBosses`, so the attack side needed no change at all. `G.events.goobrawl` gives `duration: 540` and `type: 'daily'`, so a brawl ends on its own well inside the 20-minute trip cap and leaves no cooldown behind; the map carries no `pvp` flag, and `on_death` is `['goobrawl', 0]`, so a death respawns inside the brawl rather than ejecting — `maxDeaths: 2` still bounds it.

The reward is the one thing I still cannot price, and the gap is narrower than before rather than closed. You report funtoken as a large drop. Game data does not carry the mechanism: `rgoo.drops` and `bgoo.drops` are both null, `G.drops` has no `goobrawl` table, and the only two drop tables containing funtoken are `glitch` and `lglitch`, at weight 1 each. What does line up is the item's own text — `G.items.funtoken` is g 12,000, stack 9,999, type token, "Collect them from Daily events" — and goo brawl's `type` is exactly `daily`. So the payout is server-side event logic that `G` does not publish, and the 223 funtoken already banked is the only empirical record of it. One joined brawl with a before/after inventory count settles the rate.

### Cave of Many Dreams — the Loaded Die is crafted, not won

This is the most underused mechanic on the list, and the reason is a wrong assumption that the good items come off a 0.1% table. They do not. `G.craft.cave_loaded_die` is **10 `cave_amber` + 8 `seashell` + 2 `reefglass` + 16,000 gold** at Cole, and the bank already holds **2,503 seashell and 1,702 reefglass**. The only input you do not have is Amber, and Amber is what a cave run pays out in quantity.

Amber per complete run, from the live `G.drops` tables plus the guaranteed chests the guide describes:

| Source | Reward table | Guaranteed chest |
| --- | --- | --- |
| Each cleared monster pack (3 per camp) | 57% → 1, 20% → 2 | 1 Amber + 1,500 cave gold |
| Each floor keeper (3 floors) | 55% → 3 | 4,000 cave gold |
| Completing floor 3 | 45% → 5 | 5 Amber + 10,000 cave gold |
| Parcels, trials, timed hunts | 50% → 1, 22% → 2 | — |
| Rescues and escorts | 60% → 2, 20% → 3 | — |

Nine packs across three camps, three keepers and a floor-3 finish comes to **about 30 Amber for a full clear**, before any traveler encounters — so **roughly three Loaded Dice per run**. The two rare finds are craftable on the same currency and skip their 0.1% chances entirely: `cave_deepaxe` is 200 Amber (\~7 runs) and `cave_ambercoat` is 300 (\~10). Amber is tradeable between players, so it can also simply be bought.

**Where the Die goes.** Every character has a dedicated `orb` slot, which I had been conflating with the offhand. Dexon and FatherToken wear `ftrinket+2` there — int 2, str 2, dex 2, vit 8, armor 15, speed 3, and **no crit at all**. MageofOz wears `jacko+4`, which is rpiercing 80 and worth more to a magical attacker than crit. So the first Die goes to **Dexon**:

|  | crit | critdamage | expected damage |
| --- | --- | --- | --- |
| Dexon with `ftrinket+2` | 11 | 0 | 1 + 0.11 × 1.00 = **1.110** |
| Dexon with `cave_loaded_die+0` | 19 | 10 | 1 + 0.19 × 1.10 = **1.209** |

**+8.9% expected damage at +0**, against the loss of 15 armor and 8 vit. Crit is double damage per the attribute guide, and critdamage adds to that multiplier; the two readings of how it adds coincide here, so the figure does not rest on the ambiguity.

**Do not compound it.** Three copies make a +1 worth +0.7%, and twenty-seven make a +3 worth +2.6%. At one run a day that is a month of runs for a rounding error. Wear it at +0 and spend the Amber on the axe and the coat.

Two constraints to plan the dry run around. The visit is **one per account per day**, shared by all four characters and resetting at midnight on the home server, so a rehearsal spends the day's attempt — though a server restart that ends a visit refunds it, while reloading or disconnecting does not. And **you lose no XP, gold or items when you die inside**: the survivability wall that made the booboo test unworkable simply does not apply, which makes this the one place where being under-geared costs time rather than progress. Reviving at the floor doorway is free; Nera revives you where you fell for 1 Amber each.

The hazard worth naming is the rare **Dark Mage**, who deals 100,000 magic damage and targets mages first — MageofOz — and can only be killed by his own reflected spell. The cornered rogue carries `cave_backstabber` ("Last Word") 1% of the time, but only if monsters kill him before he betrays you; if he lives there is a 50% chance he turns on anyone within 200 pixels. The whole API is already live in the CODE context: `cave_info`, `cave_enter`, `cave_reply`, `cave_buy`, `cave_exit`, `cave_talk`, with `character.cave.floor` and `character.cave.paused` to drive a script. Cave map IDs change every visit, so movement has to read `character.map`.

## Where the numbers come from

You asked twice which method I picked so you can use the same one going forward. Here it is, and one of the four answers is a correction to what I said earlier.

**The bank: the /hub BANK button, not a character.** I did not pause Meltymerch and did not move anyone. Clicking BANK on `/hub` and reading `window.comm_items.bank` returns every pack as `items0..itemsN` arrays of `{name, level, q}` — 109 distinct name-and-level lines over 14,964 items on the first read, with no character travelled and no farming interrupted. `character.bank` is null anywhere outside the bank map, which is why reading it has historically meant a round trip. Note `bank_packs` is the pack-name table, not the contents. **Banked gold is not in `comm_items`** — you pointed this out and you were right: it is rendered in the bank UI header (`BANK · GOLD: 622,677,330`), which is where the 951,083,388 total comes from rather than the 328M I first reported.

**The market and Ponty: the local bridge, which I wrongly treated as unavailable.** `http://127.0.0.1:8787` is running and answering, and it is the right source for both. Its full surface, read from `Codex/market_bridge.py`:

| Endpoint | What it returns |
| --- | --- |
| `GET /status` or `/` | per-shard scan freshness: stands, listings, `at`, `score`, `seenAgo` |
| `GET /merchants` | every stand with full `slots`, each `{name, price, level, b, q, stat_type}` |
| `GET /ponty` | Ponty stock per shard, `{at, items:[{name, level, q, rid, price}]}` |
| `GET /trades` | the trade ledger state, or `?raw=1` for raw events |
| `GET /msg?to=&since=` | the party relay inbox |
| `POST /scan`, `/msg`, `/trade` | scout ingest, relay send, ledger append |

On the 2026-10-09 read that was **3,497 listings across all 11 shards, none more than 10 minutes stale**, and 80 stands with full slot detail. **`/ponty` is the one source with no substitute**: the Codex README is explicit that Ponty has no public API, which makes it the only buy source the competition is not reading the same rows on. Use the bridge first and ALData second — they are merged per merchant per shard with the newer row winning, because freshness is a property of a row rather than of a source.

**Item stats and recipes: the live client, on a character tab.** `calculate_item_properties({name, level})` is the only honest way to get a worn stat at a level, and it exists **only on a character tab**, not on `/hub`. `G.items[x].stat` is the base pool at +0 and not what the item carries when worn — that distinction is what made the stat-pool totals come out right at 44 / 44 / 39. `G.craft` and `G.dismantle` hold every recipe and can be read with no risk to an item. Game data also answers directly through the `adventureland` MCP server's `get_game_data` and `search_game_data`, which needs no tab at all and is the better route for a whole section like `craft`.

**The trade ledger, which I had not read at all.** `GET /trades` reports **2,116,716,890 realised net** over 523 closed trades, 994,558,160 banked, 4,609 events, and **2,370 abandoned against 121,629,033 of spend**. Two things follow. The arbitrage engine has returned more than twice the party's entire current gold, so it is the largest single contributor to the gear budget and worth protecting ahead of any farming change. And the abandon rate — 2,370 abandoned against 523 closed — is worth a look on its own; `abandonedSpend` is real gold, not an accounting artefact. Note also that the README's "`dryRun` has never been off" under *Not established* is now stale: only 36 of 4,609 events are dry-run.

## What I could not measure

- ~~**Where `essenceofether` comes from.**~~ **Resolved, and I had the wrong lookup.** Drop tables are not under `G.monsters[x].drops` — they live in `G.drops`, keyed by table name, and they are in the client. The full source list and why four of the five are out of reach is in *Mechanics you are not using* above.
- ~~**Ponty stock.**~~ **Resolved, and the earlier statement was wrong.** `/ponty` does not return zero rows; it returned **3,497 listings across all 11 shards**, under 10 minutes stale. The bowofthedead claim no longer rests on one EUIV ask. If `/ponty` ever does come back empty, the thing to check is whether a merchant is actually scouting, not whether the endpoint exists.
- **What Goo Brawl actually pays.** Still open, but narrower. `rgoo.drops` and `bgoo.drops` are both null and `G.drops` has no `goobrawl` table, so the payout is server-side event logic. funtoken appears only in the `glitch` and `lglitch` tables, at weight 1 each, while `G.items.funtoken`'s own text says "Collect them from Daily events" and Goo Brawl's `type` is `daily`. One joined brawl with a before-and-after inventory count settles it.
- **How many copies of a stat scroll each item needs.** Server-side: the guide says higher-grade armor consumes more and the shrine shows the figure, and `scroll_quantity` appears nowhere in the client except the socket error handler. One scroll in inventory plus a calculation-mode `upgrade()` answers it without consuming anything.
- **What candy0 exchanges into.** Unchanged — answerable by experiment or by reading `adventureland_mongodb`, not by inspection.
- **Prices of 0 on the feed.** xgloves+0, xarmor+0 ×2, xpants+0, suckerpunch+0 and several cake slices are listed at a price of zero. That is usually a display slot rather than a giveaway. Worth a look on the way past, not worth planning around.

One caveat that applies to every cost in this document. GRACE — the hidden per-item, per-player and server-wide bonus to upgrade odds — is invisible from the client, and the planner models it as zero, exactly as `UpgradeCompound` does. Real odds are therefore at least as good as modelled and every figure here is an **upper bound**. The relative comparisons are unaffected, since every option is modelled the same way.

The arithmetic itself is a port of `UpgradeCompound.js`'s own `ucUpgradeChance` and `ucCompoundChance`, including the real `UC_UPGRADES` and `UC_COMPOUNDS` tables, the scroll grade gate, the higher-grade-scroll bonus, the offering multipliers and the caps. I validated it against three results computed earlier against the same code — bowofthedead+7 at 30.5 copies, talkingskull+3 at 90.9, fury+8 at 38.28 copies and 12.52bn of consumables — and it reproduces all three, including fury's exact scroll path. My first attempt had the compound table wrong from memory and disagreed with the known talkingskull figure; reading the real table out of the file fixed it.

## Decisions taken 2026-10-10

These supersede the recommendations above wherever they differ. All of them shipped in Merchant v92.

- **Ranger tier 2 mainhand: bowofthedead+7**, not the +8 recommended earlier. OpenGifts already compounds bowofthedead to +7, so the goal matches the supply line that is already running instead of adding a new cost. The +8 step costs 218 bows against 30.5 and was not worth taking by default.
- **Ranger tier 3 mainhand: bowofthedead+9.**
- **Ranger tier 2 gloves: thundergrips+7.** supermittens are better but unavailable; revisit the slot when they are obtainable.
- **stormfeather is not on any buy list.** 1,963 held and easy to farm. It was added to `materials.keepAndBank` so the merchant stops selling them and banks them on trips it was already making.
- **ashleaf, embercore and essenceoffire were added to `pontyBuy`** and to `materials.keepAndBank`. They were deliberately not added to `standBuy` — merchant stands are not a purchase route for these — and not to `NO_TRADE`.
- **Kept materials are now actually banked.** `CONFIG.materials.keepAndBank` was documented as "banked on sight", but `isKeptMaterial()` was read only by the two sell guards, so nothing ever stored them. `bankFullyProgressedItems()` now collects kept materials after its early return — so they ride existing trips rather than causing new ones — and stores them alongside fully-progressed gear in one combined descending pass, because `bank_store` shifts every index behind the slot it empties.
- **No extra tracker purchases.** All four characters already carry one.
