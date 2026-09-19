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

**The receiving account pays the tax.** That asymmetry decides everything:

| leg | gold goes to | who is taxed | what it costs us |
|---|---|---|---|
| buying from a stand | the seller | **them** | exactly the listed price |
| selling into a buy order | us | **us** | the whole round trip's tax |

So the profit formula is:

```
net = sellPrice * (1 - taxRate) - buyPrice
```

Not `sell - buy - tax` on both sides.

This makes the **sell leg the critical measurement** and the buy leg a
confirmation. A buy that comes back with a zero fee is a real result — it
validates the model from our side — but it is not the number Phase 1 needs.

**Same-account trades are exempt.** Using your own characters to stage a trade
would report a clean zero that looks exactly like a genuine measurement. Do not
do it. Both legs need a real stranger.

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

Pick a cheap target:

```js
arbProbePick(10000)    // cheapest sell slot under 10k, with target + slot ready
```

If it returns `null`, nothing cheap is in view — wait for the plaza to change, or
raise the cap, but **do not raise it above 10,000**: that is the hard cap
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

Then sell the same item back into any buy order you can reach, to measure the
other leg:

```js
arbProbeBuyOrders()
await arbProbeStep('BuyerName', 60)
await arbProbeCall({ fn: 'trade_sell', target: 'BuyerName', slot: 'trade2',
                     extra: [1], leg: 'sell', confirm: 'YES' })
```

`leg: 'sell'` skips the price cap, because a sale cannot spend gold.

---

## Step 6b — NPC sale control (needs no counterparty)

```js
arbProbeInv()                    // find a junk slot number
await arbProbeNpcSell(5, 'YES')  // slot NUMBER, not a name
```

Sells one junk item to a nearby vendor and compares the gold received against
`calculate_item_value`. Refuses gear-plan items and anything over the 10,000 cap.

Gold arrives at our account here too, so if the tax is charged on **received
gold** generally, this shows a shortfall; if it is charged only on gold received
**from another account**, this comes back clean. Those two readings imply
different profit formulas, and Ponty purchases sit on the same question.

Its practical value is that it needs nobody. Every other measurement waits on a
stranger with the right goods; this one runs the moment Meltymerch is next to a
vendor. **Run it first** — it is the one tax reading guaranteed to be obtainable.

---

## Recording the tax

**One data point cannot tell a flat fee from a percentage.** Get **two sell legs
at clearly different prices** — the sell leg is where the tax lands, so that is
where the two points are needed. If `impliedFeePct` matches at both, it is a
percentage; if `impliedFee` matches, it is flat.

Run at least one buy leg too. It is expected to come back with **zero** implied
fee. If it does not, the receiver-pays model is wrong and Phase 1 needs
rethinking — report it loudly rather than as a rounding oddity.

Every record carries `characterLevel`, because the rate is said to be reduced by
some factor of merchant level. A rate measured today at one level is **not** a
constant. `CONFIG.arbitrage.tax` stays `null` until enough points exist to fit a
formula, and Phase 1's profit test must refuse to pass while it is null rather
than assume zero — assuming zero over-trades, which is the expensive direction
to be wrong in.

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
6. `arbProbeNpcSell` — does an NPC sale show a shortfall against
   `calculate_item_value`, or come back clean?
7. **Two sell-leg trades at different prices**, with `impliedFee`,
   `impliedFeePct` and `characterLevel`. This is the critical measurement.
8. At least one buy-leg trade — expected to show a zero fee. Say so either way.
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
