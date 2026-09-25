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
| halt state | `arbHalted()` - returns null once the halt has expired |
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
  meaningful `net`. Abandons vastly outnumber closes all-time - 950 to 119 as of
  2026-09-25 - but quoting that raw ratio without the trend is misleading: it is
  88.9% all-time against 69% over the trailing 24h. Re-count both, and report the
  window beside the all-time figure.
- **Timestamps are `closedAt`/`openedAt`, ISO strings.** A generic `at`/`ts`
  probe finds nothing and silently yields an empty window.
- **NPC sales are recorded nowhere** - not in the bridge, not in the server's
  `trade_history`, which logs player trades only. Gold can move without any
  record explaining it.
- **A dry spell is usually data, not code.** Check `arbProbeFindFlips` with the
  age limit relaxed before blaming a build. `sellMaxAgeSec` is 420s. An earlier
  revision said it "routinely removes most candidates"; measured 2026-09-25 it
  removed 2 of 6 (4 strict, 6 relaxed to 24h). It is worth relaxing, but do not
  assume it is the cause - measure the two counts and say both. Restore the
  config value afterwards; the probe does not.
- **A dry spell can also be the executor being busy.** Only one trade runs at a
  time: `arbCanStart` returns "a trade is already in flight" and every other
  candidate waits. On 2026-09-25 a 85,540,000 trade at 3.2% blocked a 500,000
  one offering higher ABSOLUTE profit, for 4.7 hours with no closes. Check the
  in-flight trade before concluding the pipeline is dry.
- **`arbProbeHalt(true)` does not reliably write a halt.** `arbHalt(reason)` does.
- **Flip candidates and trade records name profit differently.** A closed trade
  record carries `net`. A candidate from `arbProbeFindFlips` carries `profit` and
  `unitNet` and has NO `net` field, so reading `.net` off a candidate yields
  `undefined` and prints as 0. That produced a first draft of the 2026-09-25
  report showing every live flip at "net 0" - a dead pipeline that was in fact
  four profitable candidates. Candidate fields: item, level, special, qty, spend,
  profit, unitNet, taxRate, buyFrom, buyPrice, buyShard, buyAgeSec, buyIsNpc,
  buySlot, sellTo, sellPrice, sellShard, sellAgeSec, sellSlot, buyMap, buyX,
  buyY, sellMap, sellX, sellY, sameShard, hops, affordable.
- **A CODE reload resets an in-flight trade's `startedAt`.** After redeploying,
  that timestamp measures the reload, not the trade, so trade age is unknowable
  for anything already running. Read it before reloading if it matters.

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
| level-scaled stats | `parent.calculate_item_properties({ ...G.items[name], name, level })` - the level must be ON the item, see traps |
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
- **Item `class` does not gate weapons.** `G.items.bow.class` is `undefined`.
  Usability comes from `G.classes[cls].mainhand` / `.doublehand`, keyed on the
  item's `wtype`: ranger bow/crossbow/fist/dagger, mage staff/wblade/wand/
  great_staff, priest pmace/staff/wand. Filtering on `class` alone recommended a
  bow to the mage AND the priest on 2026-09-25.
- **Sanity-check a synthetic score's weights against real values.** Weighting
  `frequency` at 400 - calibrated for values near 0.05 - turned
  `wingedboots+0`'s `frequency 3` into a "gain" of 1203 and floated a
  20,000,000 item to the top of the ranking. Rank on measured stat deltas; if a
  score does the sorting, print the stats beside it so a blown weight shows.
- **Level deltas lie; stat deltas do not.** `coat+7` and `coat+8` are BOTH armor
  12 - the level went up and the armor did not.
- **`calculate_item_properties` IGNORES `level` in its options argument.** It
  scales only when `level` is a property ON the item object. Measured
  2026-09-25: `CIP({...coat}, {level:7})` returns armor 8 - identical to base -
  while `CIP({...coat, level:7})` returns armor 12. The options form is a silent
  no-op, and it does not look broken, because it degrades BOTH sides of a
  comparison to base stats. It looks instead like cheap `+0` items beating the
  party's upgraded gear: it floated a 19,200-gold `xmassweater` over `coat+7`.
  An earlier revision of this file documented the options form. That was wrong.
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
  `BUYABLE_OFFERING_INDICES` because it has no NPC source, so the script never
  buys it.
- **RETRACTED 2026-09-25: `COSTS.offering` is not wrong.** An earlier revision
  of this file said it "assumes 480,000, which is ten times off". That conflated
  two things. 480,000 is `offeringp`'s game value `g` at array index 1, not the
  price of `offering` at index 2; and `COSTS` is rebuilt from live `G` by
  `buildCosts()`, so `KNOWN_COSTS_SNAPSHOT` is only a fallback. Measured: the
  snapshot matches live `G` exactly (480000 / 27420000 / 242064000), and
  `offering` is NPC-buyable from the `premium` NPC at 27,420,000 while players
  ask 35,000,000. The cost model is correct - do not "fix" it.
- **`g` is the NPC BUY price; `markup` measures resale loss, not a surcharge.**
  Only `scroll3` (markup 10) and `cscroll3` (markup 20) carry one.
  `calculate_item_value` returns 60% of `g`, except on those two where it
  returns `g/markup*0.6`. So `COSTS.scroll[3] = g = 480,000,000` is the correct
  NPC price, and the player market undercutting it at 297,000,000 is consistent.
  Reading `markup` as a multiplier on the buy price is the trap - it produces a
  confident "ten times too low" that is backwards.
- **The plan is not authoritative.** Tier 2's ranger chest goal is `coat+9` =
  armor 13 / resistance 11, while `mcape+6` sat on the market at 15,000,000 with
  armor 39 / resistance 31 / hp 340. Always price the alternatives.
- **Weighting armor against damage is the user's call**, not Claude's. Ask once,
  apply consistently, and print which weighting produced the ranking.
