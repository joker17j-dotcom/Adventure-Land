# Reports

Named reports the user asks for by phrase - "arbitrage report", "gear report".

**These are produced by Claude, not by the script.** There is no `arbitrageReport()`
in Merchant.js and there should not be one. Claude queries the live character, the
bridge and ALData, then writes the report in the reply. That matters for two
reasons: the CODE slot size cap does not apply, and the judgement calls that make
these reports useful - spotting that an item's name lies about its slot, that a
"free arbitrage" is negative after tax - are exactly what a scoring function gets
wrong.

This file exists because the arbitrage report went undocumented for weeks. Its
shape was carried in conversation only, so every context compaction rebuilt it
from whatever survived. Written down, it stops drifting.

---

## Shared rules

Both reports follow these. They are the difference between a report and a guess.

- **Measure, never recall.** Prices, gold and gear change constantly. Anything
  stated as current gets read that turn.
- **Show provenance and age on every price.** Live game feed or ALData, and how
  old. The live feed covers `main` and `bank` ONLY - roughly 30 of 277 merchants
  stand elsewhere and are ALData-only, so those quotes are stale by construction.
  Never let a 3-day-old price drive a decision without saying so.
- **Quantity and shard, always.** One unit on ASIAI is not the same
  recommendation as 300 units on USIII.
- **Tax is 3%** on player trades and it applies to both legs. A bid above an ask
  is not automatically profit - check it net.
- **State what was NOT measured.** If a number is inferred rather than observed,
  say which.
- **Corrections go in the report.** If a previous report was wrong, say so plainly
  rather than quietly emitting a different number.

---

## Arbitrage report

Answers: is the merchant making money, is the pipeline healthy, and what is in
the way.

### Sources

| what | how |
|---|---|
| closed and abandoned trades | `fetch('http://127.0.0.1:8787/trades')` from an adventure.land origin |
| bank gold and contents | `POST /api/load_bank`, empty body, `credentials:'same-origin'` |
| pocket gold, position, stand | `character.*` in the CODE context |
| in-flight trade | `arbLoadTrade()` |
| halt state | `arbHalted()` - returns null when expired or stale-build |
| blocked vendors | `arbLoadFails()` |
| pipeline health | `arbProbeFindFlips({quiet:true})`, and again with `maxAgeSec` relaxed |

Trade records carry: `status`, `item`, `qty`, `buyPrice`, `buyFrom`, `buyShard`,
`spend`, `taxRate`, `openedAt`, `sellPrice`, `sellTo`, `sellShard`, `gross`,
`received`, `tax`, `net`, `closedAt`, `notes`. `net` is profit, already net of
`spend` and `tax`.

### Sections

1. **Position** - pocket, bank, total, and the delta since the last report.
2. **Window** - trades closed, capital deployed, profit, ROI, amount banked.
3. **Top items by profit** in the window.
4. **Cadence** - closes per hour, and the last close in full.
5. **All-time** - closes, deployed, profit, ROI.
6. **What is in the way** - blocked vendors with their consecutive-failure count
   and backoff expiry, halt state, bank_deposit failures, abandon ratio.

### Traps

- **`status` splits `closed` from `abandoned`.** Only `closed` trades have a
  meaningful `net`. Abandons vastly outnumber closes historically (928 to 106);
  quoting the raw ratio without noting the trend is misleading.
- **Timestamps are `closedAt`/`openedAt`, ISO strings.** A generic `at`/`ts`
  probe finds nothing and silently yields an empty window.
- **NPC sales are recorded nowhere** - not in the bridge, not in the server's
  `trade_history`, which logs player trades only. Gold can move without any
  record explaining it.
- **A dry spell is usually data, not code.** Check `arbProbeFindFlips` with the
  age limit relaxed before blaming a build. `sellMaxAgeSec` is 420s and routinely
  removes most candidates.
- **`arbProbeHalt(true)` does not reliably write a halt.** `arbHalt(reason)` does.

---

## Gear report

Answers: what should the merchant work on next, and is the gear plan's own target
the right thing to aim at.

### Sources

| what | how |
|---|---|
| the plan | `GEAR_PROGRESSION` in Merchant.js, by class and tier |
| what the party wears | `cstore_<name>_newparty_info` in `parent.localStorage` - carries `slots` AND `lastSeen` |
| who wears which class | `parent.party[name].type` |
| market | `arbFetchGameMerchants(ms)` plus ALData, merged |
| item definitions | `parent.G.items[name]` - `type`, `set`, `level`, `class` |
| level-scaled stats | `parent.calculate_item_properties(item, { level })` |
| upgrade odds and costs | `pickBestUpgradeStep(item)`, `pickBestCompoundStep(item)`, `COSTS`, `OFFERING_NAMES` |

`parent.party` carries NO slots and `parent.entities` is proximity-bound, so the
party_link cache is the only source that works while the party is off farming.
Verified 2026-09-25 against Dexon's own tab: identical, 14 slots, age 0s.

### Sections

1. **Buy finished** - item, level, price, who for, stat delta, net cost after
   selling what it displaces, units/shard/age.
2. **Buy and build** - entry level and price, the per-step path with success
   rates, where offerings start paying and at what price, total expected cost
   including expected destruction.
3. **Off-plan alternatives** - anything beating the plan's own target for that
   slot. This is where the mcape and bcape findings surfaced.
4. **No action** - slots where nothing is available at any price, stated
   explicitly rather than left blank.

Header carries pocket gold, the 100,000,000 gear floor, the stat weighting used,
and feed freshness.

### Traps

- **An item's name can lie about its slot.** `mcape` ("Dracul's Attire") is
  `type: "chest"`, not a cape. Print `type` from `G.items` on every line.
- **Level deltas lie; stat deltas do not.** `coat+7` and `coat+8` are BOTH armor
  12 - the level went up and the armor did not.
- **`calculate_item_properties` does not scale unless you pass the level.** The
  bare definition returns base stats, so `+0` and `+9` look identical. That looks
  exactly like the item not scaling at all.
- **Empty slots are categorically different** from marginal upgrades. All three
  party members had `cape: null` on 2026-09-25. Sort those first.
- **Buy-vs-build flips with level.** Measured 2026-09-25 on firebow: BUILD wins
  1.6x at +3->+4 and 3.4x at +4->+5, then BUY wins 1.7x at +5->+6 and 1.4x at
  +6->+7. Success rates collapse (68% to 24%) faster than prices rise. The
  crossover was +5. Recompute it - it moves with the market.
- **A failed upgrade destroys the item** unless the scroll is grade 3.6
  (`scroll4`, 640,000,000, exclusive). `pscroll` items are stat scrolls, not
  protection. Offerings raise the odds; they do not protect.
- **The offering decision is per-step, not one global crossover**, because the
  item's value changes at every level. Break-even was 10,500,000 on 2026-09-25
  with `offeringp` at 5,000,000 - but `offeringp` is NOT in
  `BUYABLE_OFFERING_INDICES` because it has no NPC source. It has to be bought on
  the player market, and the script's `COSTS.offering` assumes 480,000, which is
  ten times off.
- **The plan is not authoritative.** Tier 2's ranger chest goal is `coat+9` =
  armor 13 / resistance 11, while `mcape+6` sat on the market at 15,000,000 with
  armor 39 / resistance 31 / hp 340. Always price the alternatives.
- **Weighting armor against damage is the user's call**, not Claude's. Ask once,
  apply consistently, and print which weighting produced the ranking.
