# Phase 0 — Arbitrage probe

Read-only reconnaissance of the Adventure Land trade and bank API, plus one
sanctioned cheap trade to measure the transfer tax.

**Nothing in this phase runs on its own.** Every command below is typed by hand
into the game's code console while Meltymerch is standing in the merchant plaza.

---

## Why this phase exists

The trade API is the one part of the arbitrage plan this codebase has never
exercised. Writing `trade_buy(target, slot)` and seeing what happens is the
obvious move, and it is how Ponty's price ended up wrong by a factor of two
earlier in this project — that mistake cost a wrong number on a webpage, and
this one spends gold.

So the API is **discovered, not assumed**. `arbProbeSrc` dumps a runner
function's real source, which names the socket event and the exact payload
keys. The first real call is built from that, not from memory.

Two numbers come out of this phase and both are needed before Phase 1:

1. **The trade distance.** Measured by collecting rejections at decreasing
   distances, which costs nothing.
2. **The transfer tax on the SELL leg.** See below — it is not symmetric, and
   the buy leg is expected to be free.

### Which leg is taxed

Tax applies **only to gold received from another account**, and the **receiver**
pays it. Exactly one leg of a round trip is affected:

| leg | who receives | taxed? |
|---|---|---|
| buy from a player stand | them | **no** — we pay the listed price, nothing more |
| buy from Ponty | an NPC | **no** |
| sell into a player buy order | **us** | **YES** — the whole round trip's tax |
| sell to an NPC vendor | us, from an NPC | **no** |
| anything with your own characters | same account | **no** — exempt |

```
net = sellPrice * (1 - taxRate) - buyPrice      (player buyer)
net = npcValue                   - buyPrice      (NPC buyer)
```

Not `sell - buy - tax` on both sides.

So **the sell-into-a-player-buy-order leg is the only measurement that matters**.
The buy leg is a confirmation: it should come back showing **zero**. If it does
not, the model is wrong and Phase 1 needs rethinking — report that loudly rather
than as a rounding oddity.

**Do not stage a trade with your own characters.** Same-account transfers are
exempt, so it would report a clean zero indistinguishable from a real result.
Both legs need a real stranger.

---

## Before you start

- Meltymerch running `Merchant.js` v26 or later, in a **browser tab** (not
  Mainframe — the probe needs the code console).
- Standing in the merchant plaza with other players' stands in view.
- `market_bridge.py` may be running or not; the probe does not use it.

Open the code console and run:

```js
arbProbeHelp()
```

Note the two `Find` commands — they read from the bridge, which means the probe
works off data the scouts already collected instead of waiting for something
useful to wander into the plaza. Prefer them over the in-view commands.

If that errors, the script has not loaded — check the tab, then retry. If the
console evaluates in a different scope, everything is also reachable as
`PROBE_API.help()`, `PROBE_API.pick(10000)` and so on.

---

## Step 1 — Freeze the merchant

```js
arbProbeHold(true)
```

This stops three things for the duration: shard hops (a hop reloads the page and
would kill a probe mid-measurement), gear spending, and `sellTrash`. That last
one matters most — left running it vendors junk inside the before/after window of
a measured trade, and the gold it earns is indistinguishable from a tax refund.

**Turn it off when you are done** with `arbProbeHold(false)`. Leaving it on costs
scouting, not correctness.

---

## Step 2 — Discover the API (read-only)

```js
arbProbeFns()      // name scan across the runner and parent scopes
arbProbeNamed()    // direct check of the names we expect
```

Then dump the source of every trade-ish and bank-ish function found. The source
goes to the **browser console**, not the game log, because it is long:

```js
arbProbeSrc('trade_buy')
arbProbeSrc('trade_sell')
arbProbeSrc('bank_deposit')
arbProbeSrc('bank_withdraw')
```

**Report back, verbatim:**

- The full output of `arbProbeFns()` and `arbProbeNamed()`.
- The complete source of anything that buys from or sells into a player stand.
- The complete source of the bank gold functions, if they exist at all — the
  repo has only ever used `bank_store` for items, so gold deposit is unverified.

From the source we need to read off: the socket event name, the payload keys,
the **argument order**, and whether quantity is an argument or implied.

---

## Step 3 — Survey (read-only)

```js
arbProbeStands()       // every visible stand with its distance
arbProbeBuyOrders()    // visible buy orders, highest price first
arbProbeInv()          // esize vs counted free slots, stacks, gold
```

`arbProbeInv()` prints either `(agree)` or `(DISAGREE - esize does not mean free
slots)`. **Report which.** The Phase 1 purchase gate is going to read `esize`,
and it should only do that if `esize` means what its name suggests.

---

## Step 4 — Bank round trip (read-only)

```js
await arbProbeBank()
```

Walks to the bank, reads what is there, walks back to the scan spot, and times
each leg. It deposits and withdraws nothing.

**Report:** `totalMs`, `bankVisible`, `bankGold`, and `freeBySlot`.

The agreed rule is that every sale is followed by a bank visit before scouting
resumes, and that rule is only affordable if this trip is short. The bank door is
off the same map as the scan spot, so it should be — confirm it.

Also confirm `bankVisible` is `true` **only** inside the bank. That is the reason
a pre-purchase bank-space check cannot be done from the field, and Phase 1 is
designed around it.

---

## Step 5 — Measure the trade distance (costs nothing)

Find a cheap target. Ask the **bridge** first — it holds every stand every scout
has recorded, on every shard, not just what happens to be in front of the
merchant right now:

```js
await arbProbeFindBuy(10000)
```

Candidates are ordered by **age, not price**. The cheapest listing on the board
is worthless if the seller packed up twenty minutes ago, and everything returned
is already under the cap, so the useful question is which is most likely to still
be there. Same-shard candidates rank above remote ones, because no hop beats a
hop.

If a good candidate is on another shard:

```js
await arbProbeGo('EUII')
```

**The page reloads and the script restarts** — that is what `change_server` does.
The hold and the probe log are both kept in storage, so they come back; anything
you were holding only in the console does not. After the reload you should see
`HOLD STILL ON` in the startup line.

If the bridge is down or has nothing under the cap, it falls back automatically
to `arbProbePick(10000)` — the in-view scan. You can also call that directly.
Either way, **do not raise the cap above 10,000**: that is the hard limit
`arbProbeCall` enforces.

Now walk in from far out, retrying the trade at each distance. Substitute the
real function name and argument order from Step 2:

```js
await arbProbeStep('SellerName', 600)
await arbProbeCall({ fn: 'trade_buy', target: 'SellerName', slot: 'trade1', confirm: 'YES' })
// rejected -> step closer and repeat
await arbProbeStep('SellerName', 400)
await arbProbeCall({ fn: 'trade_buy', target: 'SellerName', slot: 'trade1', confirm: 'YES' })
await arbProbeStep('SellerName', 300)
// ... 200, 150, 100, 60, 30
```

**A rejection is a result, not a failure.** Each one records the exact distance
and the exact reason string, and Phase 1's error handling will branch on those
strings. Collect them.

The first distance that stops being rejected is the real trade range — and it is
also the sanctioned trade from Step 6, so read that section first.

> `arbProbeStep` uses `move()`, which walks in a straight line. If the merchant
> gets stuck on plaza scenery it falls back to `smart_move`. Either way, the
> distance it reports afterwards is the true one, so trust the printed number
> over the one you asked for.

---

## Step 6 — The one real trade (spends gold)

The walk-in in Step 5 ends in a successful purchase. That success **is** the
sanctioned trade. Keep it under 10,000 gold — `arbProbeCall` refuses anything
dearer, and refuses entirely without `confirm: 'YES'`.

The moment it resolves, the log line reports:

```
RESOLVED - gold -420, slots +0, implied fee 20 (5%)
```

`implied fee` is the whole point: gold actually paid minus the listed price.

### The sell leg

This is the taxed leg and the one that otherwise stalls waiting for someone to
turn up wanting what you just bought. Don't wait — ask the other way round:

```js
await arbProbeFindSell()
```

That cross-references **the merchant's own inventory** against every buy order
the scouts have seen anywhere, so the question becomes "who already wants
something I am holding". Items are matched on name, level *and* special, the same
way the watchlist groups them — a level 0 buy order does not pay for a level 3
item.

Results are ordered by price, highest first, and the log prints the spread
between the top and bottom entries. **That spread is the two-point tax
measurement** — take the highest and the lowest, not two similar ones.

Then travel and sell:

```js
await arbProbeGo('EUII')          // if the buyer is elsewhere
await arbProbeStep('BuyerName', 60)
await arbProbeCall({ fn: 'trade_sell', target: 'BuyerName', slot: 'trade2',
                     extra: [1], leg: 'sell', confirm: 'YES' })
```

`leg: 'sell'` skips the price cap, because a sale cannot spend gold. The
`iHoldSlot` field in the finder's output tells you which inventory slot the item
is in, if the call signature from Step 2 needs it.

---

## Step 6b — Does `calculate_item_value` predict the vendor payout?

```js
arbProbeInv()                    // find a junk slot number
await arbProbeNpcSell(5, 'YES')  // slot NUMBER, not a name
```

Sells one junk item to a nearby vendor and compares the gold received against
`calculate_item_value`. Refuses gear-plan items and anything over the 10,000 cap.
Prints `EXACT` or `OFF BY n`.

Not a tax measurement — NPC sales are untaxed and that is settled. This matters
because Phase 1 has to **choose** a sell side. A player buy order is only worth
taking once it clears the vendor's price by more than the tax:

```
max( npcValue, playerBuyPrice * (1 - taxRate) )
```

never `playerBuyPrice` on its own. At a high enough rate, a generous-looking buy
order is worth less than simply vendoring the item. `calculate_item_value` sits
directly in that comparison, and this project has already been burned once by
trusting its output for Ponty and being wrong by half — that time it only
misprinted a webpage.

It also needs no counterparty, so it can be run immediately. **Run it early.**

---

## Recording the tax

**One data point cannot tell a flat fee from a percentage.** Get **two sell legs
into player buy orders at clearly different prices**. That is the only taxed leg,
so that is where both points are needed. If `impliedFeePct` matches at both, it
is a percentage; if `impliedFee` matches, it is flat.

Every record carries `characterLevel`, because the rate is reduced by some
unknown factor of merchant level. A rate measured today at one level is **not** a
constant. `CONFIG.arbitrage.tax` stays `null` until enough points exist to fit a
formula, and Phase 1's profit test must refuse to pass while it is null rather
than assume zero — assuming zero over-trades, which is the expensive direction to
be wrong in.

---

## Step 7 — Finish

```js
arbProbeDump()      // everything recorded, survives a page reload
arbProbeHold(false) // release the merchant
```

`arbProbeDump()` returns the full record from CODE storage. **Paste it back in
full.** It survives a reload, so if the tab refreshes mid-probe the findings are
still there.

---

## What to report back

1. `arbProbeFns()` and `arbProbeNamed()` output.
2. Full source of the trade and bank-gold functions.
3. `arbProbeInv()` — does `esize` agree with the counted free slots?
4. `arbProbeBank()` — timings, and whether the bank reads only from inside.
5. The distance ladder: every `{ distance, reason }` rejection, and the first
   distance that succeeded.
6. `arbProbeNpcSell` — `EXACT`, or `OFF BY` how much?
7. **Two sell legs into player buy orders at different prices**, with
   `impliedFee`, `impliedFeePct` and `characterLevel`. The critical measurement.
8. At least one buy leg — expected to show a zero fee. Say so either way.
9. The full `arbProbeDump()`.

---

## Safety summary

- `arbProbeCall` is the **only** function here that can move gold.
- It refuses without an explicit `confirm` string.
- On a buy it refuses any slot over `CONFIG.arbitrage.probe.maxPrice` (10,000).
- It reports the gold delta either way, so nothing moves unnoticed.
- The `o.args` escape hatch bypasses the price check and requires
  `confirm: 'YES-UNCHECKED'`. Use it only if Step 2 shows a different argument
  order, and pick a cheap slot yourself first.
- Everything else reads, or walks.

Nothing in Phase 0 changes existing merchant behaviour. `CONFIG.arbitrage.enabled`
is `false` and no automatic trading exists yet.
