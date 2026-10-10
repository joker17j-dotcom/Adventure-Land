# Gear Progression Tracker

Live state as of 2026-10-10 18:30 ET. Companion to `Gear_Progression_Review.md`,
which holds the reasoning and the measurements behind these goals. This file is
the part that goes stale, so it is kept separate and short.

Everything below was measured on the running clients and from `G` at game
version 17665, not inferred. Figures carried over from the review are marked.

## Treasury

| Holder | Gold |
| --- | --- |
| Meltymerch | 180,128,065 |
| Bank | 21,978,885 |
| Dexon | 788,155 |
| FatherToken | 500,000 |
| MageofOz | 500,000 |
| **Total** | **203,895,105** |

**Down 78.6% from the 951,083,388 the review was written against** — a drop of
747.2M. This is the single most important line in the file, because the review's
long-term section priced campaigns against the old number. Re-read any cost in
it against this total before committing.

## Action scoreboard

The six numbered actions from the review.

| # | Action | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Type the stat pools with pscrolls | **Ranger done. Other two open.** | Dexon's five scrollable items all carry `stat_type: "dex"`; dex 227 → 278. FatherToken and MageofOz report `type:NONE` on all ten |
| 2 | Spare xgloves+6 onto Dexon | **Void — no spare exists** | No `xgloves` line anywhere in the bank. FatherToken wears the only copy. Superseded: Dexon now wears `thundergrips+5`, the v92 tier-2 goal |
| 3 | Drive bowofthedead to +7 | **Done** | Equipped on Dexon, and three more `bowofthedead+7` are banked |
| 4 | Buy slice_mint ×96 at 250,000 | **N/A — not pursued** | 18 held; sixcake line left closed by choice |
| 5 | Buy bowofthedead+0 in bulk | **Ongoing** | Working stepwise toward the tier-3 goal. See *Long term* |
| 6 | Cave of Many Dreams → loaded die | **Ran once, tuning** | 45 `cave_amber`, 1 `cave_counterweight`, 1 `cave_tunnelaxe` banked |

## Next up, ordered by gain per gold

| Priority | Do this | Cost | Gain | Blocker |
| --- | --- | --- | --- | --- |
| **1** | Type FatherToken + MageofOz stat pools | **5,840,000** | +23.4% int and +20.0% int | **You hold 0 intscroll.** Buy 730 from Lucas |
| **2** | Craft 4 × cave_loaded_die, equip one on Dexon | **64,000** | crit +8, critdamage +10 in the orb slot | none |
| 3 | thundergrips +5 → +7 (tier-2 goal) | TBD | closes Dexon's last level gap on a met-item slot | **You hold 0 scroll1** |
| 4 | MageofOz cape ecape +6 → +7 | TBD | closes a 1-level gap | scroll grade unmeasured |
| 5 | FatherToken belt/amulet to @4 | TBD | closes two 1–2 level compound gaps | cscroll stock unmeasured |

Priority 1 is 2.9% of the treasury for roughly a fifth more main stat on two of
three fighters. Nothing else on any list comes close to that ratio.

### Priority 1 priced exactly

Your grade table — `needed = [1, 10, 100, 1000, 9999, 9999, 9999]` indexed by
grade — settles the question the review left open ("how many scrolls per item").
It is not ~100 flat; it is grade-dependent, and grade comes from
`G.items[x].grades` against the item's level.

**FatherToken** — int 188 → 232, main stat **+23.4%**

| Item | Grades | Grade | Scrolls | Gold | Pool |
| --- | --- | --- | --- | --- | --- |
| xhelmet+6 | `[0,0,8,10]` | 2 | 100 | 800,000 | 10 |
| xarmor+5 | `[0,0,8,10]` | 2 | 100 | 800,000 | 9 |
| starkillers+5 | `[0,0,9,10]` | 2 | 100 | 800,000 | 6 |
| xgloves+6 | `[0,0,8,10]` | 2 | 100 | 800,000 | 10 |
| wingedboots+7 | `[4,8,10,12]` | 1 | 10 | 80,000 | 9 |
| **Total** | | | **410** | **3,280,000** | **44** |

**MageofOz** — int 195 → 234, main stat **+20.0%**

| Item | Grades | Grade | Scrolls | Gold | Pool |
| --- | --- | --- | --- | --- | --- |
| mmhat+7 | `[0,7,10,12]` | 2 | 100 | 800,000 | 10 |
| mmarmor+7 | `[0,7,10,12]` | 2 | 100 | 800,000 | 10 |
| starkillers+6 | `[0,0,9,10]` | 2 | 100 | 800,000 | 7 |
| wingedboots+4 | `[4,8,10,12]` | 1 | 10 | 80,000 | 5 |
| poker+6 | `[4,8,10,12]` | 1 | 10 | 80,000 | 7 |
| **Total** | | | **320** | **2,560,000** | **39** |

**730 intscroll, 5,840,000 gold.** The mage is cheaper because two of his items
are still grade 1 — scroll his boots and gloves *before* either crosses +8, or
the price per item goes up tenfold.

Two cautions. `poker+6` is a stopgap glove, so its 80,000 is wasted if that slot
changes — do it last. And your **343 vitscroll** cannot help here: both of these
characters are int. That stock is dead for main-stat purposes.

## Gap to plan tier 2

Measured from `character.slots` against `GEAR_PROGRESSION` in Merchant v93.

### Dexon — ranger L76, dex 278. 6 of 15 slots met

| Slot | Worn | Tier-2 goal | Gap |
| --- | --- | --- | --- |
| mainhand | bowofthedead+7 | bowofthedead@7 | **met** |
| chest | mrnarmor+7 | mrnarmor@7 | **met** |
| cape | ecape+7 | ecape@7 | **met** |
| amulet | dexamulet+4 | dexamulet@4 | **met** |
| pants | frankypants+7 | frankypants@6 | **exceeds +1** |
| helmet | fury+5 | fury@4 | **exceeds +1** |
| gloves | thundergrips+5 | thundergrips@7 | 2 levels |
| earring2 | dexearring+3 | dexearring@4 | 1 level |
| earring1 | dexearring+2 | dexearring@4 | 2 levels |
| shoes | xboots+6 | wingedboots@8 | wrong item — **deliberate**, see review |
| offhand | paradequiver+6 | t2quiver@7 | wrong item |
| orb | ftrinket+2 | orbofdex@3 | wrong item — die supersedes, below |
| ring1 | suckerpunch+0 | cring@3 | wrong item, but it is the **tier-3** item already |
| ring2 | ringsj+4 | suckerpunch@0 | wrong item |
| belt | windbelt+1 | dexbelt@3 | wrong item — 2 × dexbelt+3 banked |

His dex rose 51, not the 44 the pools account for; the balance came from the
gear swaps in the same session (thundergrips, dexamulet+4, suckerpunch, windbelt).

### FatherToken — priest L72, int 188. 3 of 15 slots met

| Slot | Worn | Tier-2 goal | Gap |
| --- | --- | --- | --- |
| helmet | xhelmet+6 | xhelmet@6 | **met** |
| pants | starkillers+5 | starkillers@5 | **met** |
| offhand | mshield+7 | mshield@6 | **exceeds +1** (spare mshield+7 banked) |
| shoes | wingedboots+7 | wingedboots@8 | 1 level |
| belt | intbelt+3 | intbelt@4 | 1 level |
| amulet | intamulet+2 | intamulet@4 | 2 levels |
| chest | xarmor+5 | harmor@6 | wrong item — xarmor **beats the tier-3 goal** |
| gloves | xgloves+6 | supermittens@5 | wrong item — xgloves is better, no supermittens supply |
| mainhand | firestaff+7 | lmace@6 | wrong item — still holding the mage's weapon |
| cape | bcape+5 | gcape@7 | wrong item — bcape is the tier-3 cape, 3 short of @8 |
| orb | ftrinket+2 | rabbitsfoot@1 | wrong item |
| ring1 / ring2 | ringsj+3 ×2 | cring@3 ×2 | wrong item |
| earring1 / earring2 | intearring+2 ×2 | cearring@3 ×2 | wrong item |

### MageofOz — mage L72, int 195. 4 of 14 slots met

| Slot | Worn | Tier-2 goal | Gap |
| --- | --- | --- | --- |
| helmet | mmhat+7 | mmhat@7 | **met** |
| chest | mmarmor+7 | mmarmor@7 | **met** |
| orb | jacko+4 | jacko@3 | **exceeds +1** |
| mainhand | sparkstaff+7 | firestaff@9 | **exceeds** — 113/115 vs 94/94 |
| offhand | empty | wbook0@4 | **N/A** — sparkstaff is two-handed |
| cape | ecape+6 | ecape@7 | 1 level |
| belt | intbelt+3 | intbelt@4 | 1 level |
| amulet | intamulet+3 | intamulet@4 | 1 level |
| shoes | wingedboots+4 | wingedboots@8 | 4 levels |
| pants | starkillers+6 | frankypants@6 | wrong item |
| gloves | poker+6 | supermittens@5 | wrong item, no supply |
| ring1 / ring2 | ringsj+3, intring+3 | cring@3 ×2 | wrong item |
| earring1 / earring2 | intearring+2 ×2 | cearring@3 ×2 | wrong item |

## Long term

### 1. bowofthedead to +9 (ranger tier 3) — gated on gold, not bows

Tier 2 at +7 is **met**. Stock on hand: 1 worn + **3 banked at +7**.

Ladder costs are carried from the review, priced from +0:

| Target | Copies consumed | All-in gold |
| --- | --- | --- |
| +7 (tier 2) | 30.5 | 36.7M |
| +8 | 218 | 273M |
| +9 (tier 3) | 2,357 | 3.27bn |

Against 203.9M total, **+8 is no longer affordable and +9 is far out of reach.**
The scrolls dominate, not the bows, so buying more bows in bulk is not what
unblocks this. Hold the three +7 spares — they are the correct stock — and treat
the next milestone as gold accumulation. Revisit when liquid gold clears ~300M.

High-grade upgrade stock on hand: `scroll3` ×5, `scroll2` ×2, `cscroll3` ×1,
`offeringp` ×24. **No `scroll1` at all**, which is what blocks the cheap grade-1
steps listed under *Next up*.

### 2. Cave of Many Dreams → loaded die — now actionable

`G.craft.cave_loaded_die` = 16,000 gold + **10 cave_amber** + 8 seashell + 2 reefglass.

| Input | Held | Dice supported |
| --- | --- | --- |
| cave_amber | 45 | **4** ← binding |
| seashell | 2,503 | 312 |
| reefglass | 1,702 | 851 |

One run produced 45 amber, so **~4 dice per run**, better than the review's
estimate of ~3. Craft all four for 64,000.

The swap on Dexon's orb: `cave_loaded_die+0` is crit 8 / critdamage 10, against
`ftrinket+2`'s armor 15, vit 8, speed 2.5 and 2 to each stat. A damage slot for a
survivability slot — the review measured this at +8.9% expected damage.

**Compounding is blocked.** Its grades are `[0,0,6,7]`, so it is grade 2 from +0
and wants `cscroll2`, of which you hold none. Equip one at +0 and bank the other
three against a future compound.

### 3. wingedboots — unchanged, still long

1,172 feather0 = 58 boots. The ladder needs 25.6 boots for +7 and 170.5 for +8;
three characters at tier-2 @8 is ~10,230 feathers. You hold 11% of that. Carried
from the review and not re-measured.

### 4. Retired goals

| Slot | Retired goal | Why |
| --- | --- | --- |
| ranger / mage gloves | supermittens@5 / @6 | bids only on the feed, never an ask — unbuyable |
| mage offhand | wbook0@4 | sparkstaff is two-handed; tier 3 already says `null` |
| mage mainhand | firestaff@9 | sparkstaff+7 already beats it |
| ranger gloves (tier 2) | — | replaced by thundergrips@7 in v92 |

## Open / unmeasured

- **Does recasting mluck reset its duration?** Merchant v93 instruments this.
  Read `parent.MLUCK_OPP().verified` after a trip for `RESET WORKS` / `NO RESET`.
- **Scroll costs for grade-1 and compound steps** in *Next up* rows 3–5 — not
  yet priced.
- **scroll3 market depth.** The review lists asks from 280M upward. Prices move;
  re-measure before quoting.
- `cave_counterweight` ×1 and `cave_tunnelaxe` ×1 — purpose not yet looked up.
