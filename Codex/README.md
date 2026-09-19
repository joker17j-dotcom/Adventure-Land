# Codex — Adventure Land market tooling

Self-hosted market watchlist, an in-game scout, a local bridge, and an
arbitrage executor that trades across shards.

| File | What it is |
|---|---|
| `al_market_watchlist.html` | The watchlist — market, summary, arbitrage, Ponty, trade ledger |
| `aldata_explorer.html` | Full game-data explorer — items, monsters, drops, world, bank |
| `market_bridge.py` | Local server: collects scans, coordinates scouts, keeps the trade ledger. Stdlib only |
| `PHASE0_PROBE.md` | The hand-driven probe procedure that measured the trade API |
| `relay/` | For running a scout on a second computer — see its own README |
| `MerchantScout.js` | Standalone scout, for a fleet — see *Which file is the scout* |
| `_al_template.html`, `_tabs_*.js`, `build.py` | Sources for the two pages (see *Rebuilding*) |

Both HTML files are fully self-contained. **You do not need any of this setup to
use them** — open either one and it pulls live market data from
`aldata.earthiverse.ca`. The bridge adds your own data on top, plus two things
the public feed does not have: Ponty's stock, and the trade ledger.

---

## Which file is the scout

`Merchant.js` in the repository root. Scouting was merged into the merchant, so
one character both trades and scans. That is the only scout that has ever run.

`MerchantScout.js` is the standalone version, for adding scouts beyond the
merchant. It scans, hands over, confirms and only then hops — the same ordering
`Merchant.js` uses, and for the same reason: `change_server` reloads the page, so
anything after a hop never runs. An early version had that backwards and spent
thirty-five minutes hopping without posting once.

Both persist their unsent findings, their rotation position and their Ponty
clock to CODE storage before hopping, because module scope does not survive the
reload.

The scouting code stays inert unless the bridge answers, so `Merchant.js` behaves
exactly as before on Mainframe, where `127.0.0.1` is not the operator's PC.

---

## Quick start

### 1. Start the bridge

```bash
cd Codex
python3 market_bridge.py
```

```
[bridge] listening on http://127.0.0.1:8787
[bridge]   scouts POST -> /scan      page GET -> /merchants, /ponty
[bridge]   party relay  -> POST /msg, GET /msg?to=<name>&since=<seq>
[bridge]   trades       -> POST /trade, GET /trades (raw=1 for events)
[bridge]   status       -> http://127.0.0.1:8787/status
```

Run it **from a directory you intend to keep**. `ledger.jsonl` is created there
and is permanent — it is the trade history, and the whole point of it is that no
timer and no restart clears it. `--ledger PATH` moves it; `--state ./scouts.json`
additionally persists the market snapshot, which is optional because that data
is meant to age out.

### 2. Run the merchant

1. Open <https://adventure.land> **in a browser tab** and log the character in.
2. Open its **CODE** tab, paste the whole of `Merchant.js`, start it.

> **Browser tab, not Mainframe.** `parent.X.servers` and `change_server()` are
> page globals Mainframe's sandbox does not expose. Without them there is no
> shard hopping, so no rotation and no cross-shard trading.

Log lines to expect:

```
[scout] bridge up - scouting enabled
[scout] 7 stands on USII - confirmed
[scout] Ponty: 23 items on USII
[probe] v27 / arb.4 ... loaded (0 stored entries) - arbProbeHelp() for commands
```

### 3. Point the page at it

Open `al_market_watchlist.html`. The source dropdown offers **ALData**, **local
scouts**, or **both (merged)**, with ALData the default.

The **Ponty Stock** and **Trade Ledger** tabs are bridge-only.

---

## How many shards, and how fresh

The scout reads the game's own live server list (`parent.X.servers`) and skips
`PVP`. That was **11 shards** when last measured; it follows the game if that
changes.

One scout, rotating — a full sweep takes about **2.4 minutes**, so any given
shard is accurate at the moment it is scanned and up to a sweep old afterwards.
It never sees more than one shard at a time.

This is why **ALData is the default source and the local bridge is second**.
ALData covers every shard continuously; a rotating scout produces a rolling
snapshot. Measured side by side: 267 stands across 11 shards from ALData against
8 stands on 1 shard from ours. Reverse the preference and a probe hold — which
stops the rotation — silently leaves you reading the worst view of the market
rather than the best.

What ALData cannot give you is **Ponty**, who has no public API. That is the
scout's remaining edge, and it is the one buy source the competition is not
reading the same rows on.

---

## Fleet mode — 3 parked + 1 roamer

Supported by the bridge but never run: only the merchant has ever scouted. Paste
`MerchantScout.js` into each extra character and list them in `CONFIG.roles` —
the role is resolved from the character's own name at runtime, so it is the same
file everywhere. Each needs its own browser tab.

A scout on a **second computer** needs `Codex/relay/`. Pointing it at your LAN
address does not work: the scout runs inside `https://adventure.land`, and a
secure page may not fetch `http://` except to `127.0.0.1` or `localhost`. The
relay gives it a localhost address to talk to and forwards over the network.

**You do not assign shards yourself.** `send_cm` is
realm-local, so scouts on different shards physically cannot talk to each other
and cannot agree who sits where. The bridge ranks shards by observed activity,
hands each parked scout a different one, and removes a shard from the pool the
moment it is handed out, so two parked scouts can never collide.

A parked scout only moves when a new shard beats its current one by 25%.
Without that margin they thrash between near-equal shards, and every move costs
a `change_server` plus the walk back to the scan spot.

A character not listed in `CONFIG.roles` defaults to `parked`, so an extra scout
can be pasted in unmodified and still be assigned a shard.

**Two scouts can briefly appear on the same shard, and that is not a fault.**
The bridge's own picture is always collision-free — a shard is removed from the
pool the moment it is handed out — but a scout only learns its assignment from
the reply to its own scan. Between one scout being reassigned and the other
posting again, the *scouts* disagree with the bridge even though the bridge does
not disagree with itself. It resolves on the next post. Verified up to eight
parked scouts against three known shards: never a duplicate, and the surplus
scouts are given nothing rather than a shared shard.

---

## Arbitrage

The merchant can buy on one shard and sell on another. **It is off by default in
the sense that matters:** `CONFIG.arbitrage.dryRun` is `true`, which simulates
the only two calls that move money while running every other step for real.

Check which mode is actually live from the game console:

```js
arbProbeBuild()
```

```
arbitrage: ENABLED, dryRun ON -> rehearsal only, no gold moves
```

Read that line, not the build string — the flags are deliberately not
transcribed into the string, because a hand-kept note that must stay in step
with two constants will eventually disagree with them.

There is no runtime toggle for `enabled`, on purpose. One persisted in CODE
storage would outlive a redeploy, so a build pushed with it false could still be
trading.

### The tax, which decides the arithmetic

Tax applies **only to gold received from another account**, and the receiver
pays. Exactly one leg of a round trip is taxed:

| leg | taxed? |
|---|---|
| buy from a player stand | no — list price, nothing more |
| buy from Ponty | no |
| **sell into a player buy order** | **yes** |
| sell to an NPC vendor | no |
| your own characters | no — same account, exempt |

```
net = sellPrice × (1 − taxRate) − buyPrice
```

The rate is a step function on character level, from `node/server.js` in
`kaansoral/adventureland`: 5% at ≤20, **4%** for 21–50, 3%, 2.5%, 2%, and 1%
above 80. Confirmed live — a 100,000 sale returned exactly 96,000.

Consequence worth knowing: a player buy order only beats the vendor once it
clears the vendor's price by more than the tax, so the comparison is
`max(npcValue, playerBuyPrice × (1 − taxRate))` and never the raw price.

### Safety rails

| Rail | Behaviour |
|---|---|
| `dryRun` | Simulates `trade_buy`/`trade_sell`; everything else runs |
| `goldFloor` | 10,000,000 — a hard reserve on what is *left* after a purchase |
| `minProfit` | 500,000, per item, after tax |
| `usedCooldownMs` | 20 min — a listing just traded against is not re-picked |
| `maxConsecutiveStrandings` | 2 — the executor stops itself and says why in the ledger |
| verification | Both legs re-checked against the live client before trading |

The cooldown exists because the two sides are not symmetric. A stale *buy*
listing costs nothing — verification fires before gold moves. A stale *sell*
listing is only discovered after the purchase, on another shard, and turns gold
into stock nobody wants. Without suppression the executor would re-fill an order
it had itself emptied, bank the goods, and go round again.

### Surviving a reload

`change_server` reloads the page and destroys every variable. A cross-shard
trade contains two of those, and between them the merchant holds an item it has
paid for. So the trade lives in CODE storage and **every phase is written before
the hop, never after**. Confirmed in the field:

```
[arb] resuming marketparcel x2 in phase "holding" - 2000000 gold already committed
```

---

## The trade ledger

`POST /trade` appends, `GET /trades` replays. JSON Lines, never rewritten: a
crash mid-write costs the last line rather than the file, appending never has to
read what is already there, and one corrupt line is skipped instead of taking
the history with it.

Events are idempotent on `eventId`, because the merchant resends anything the
bridge has not acknowledged — without that, one lost reply turns a retried
`banked` into gold counted twice.

**Realised and unrealised are never summed.** A bought item that has not sold is
gold turned into an asset, not a loss. `abandoned` is its own status carrying its
own spend for the same reason. Dry-run rows are kept, flagged, and excluded from
every headline figure.

The **Trade Ledger** tab shows all of it and can write back — *mark sold*, *write
off*, *set net*, *add note*. Each edit appends an event rather than correcting a
row, so the history of the correction survives too. Items have no unique id in
this game, so reconciling a manual sale is best-effort by design: you pick the
row.

---

## Verifying it works

<http://127.0.0.1:8787/status> for the market side, <http://127.0.0.1:8787/trades>
for the ledger. From the game console:

```js
arbProbeBuild()                     // which build, and can it spend gold
await arbProbeBridge()              // which feed is answering, and how much is in it
await arbProbeFindFlips()           // profitable buy->sell pairs right now
arbProbeHelp()                      // everything else
```

`arbProbeHold(true)` freezes the merchant for measurement: no hops, no gear
spending, no `sellTrash`, no anniversary kissing. It survives a reload. The
current shard is still rescanned every 30s — an earlier version stood scouting
down entirely, which starved the bridge the probe was meant to be reading.

---

## Troubleshooting

**Page shows `ALData only (bridge unreachable)`** — expected when the bridge is
not running. ALData is the floor; the bridge is a bonus.

**Bridge reachable but `stands: 0`** — nothing is posting. Usually a probe hold
with the merchant away from the scan spot, or the merchant stopped.

**Finders return `SOURCE: in-view scan only`** — neither ALData nor the bridge
answered, and you are seeing one plaza rather than the market.

**A listing on the board is not there when you arrive** — ALData carries stands
that have already gone. This is normal and why both legs verify before trading;
`listing changed before buying` with `nothing_spent` is the system working.

---

## Tuning

Merchant (`Merchant.js`, `CONFIG.scout`):

| Setting | Default | Effect |
|---|---|---|
| `tickMs` | 5s | Scout loop interval |
| `settleMs` / `maxSettlePasses` | 1.5s / 5 | Waiting for the entity list to finish streaming |
| `pontyEveryMs` | 10 min | Per-shard Ponty re-check |
| `minPostGapMs` | 7s | Floor between posts from one scout |
| `heldScanMs` | 30s | Rescan cadence while a probe hold is on |
| `kissGuardMs` | 5m10s | Be home this long before an anniversary round |
| `maxCycleMs` | 3 min | A shard visit longer than this is assumed hung |
| `skipServers` | `['PVP']` | A parked scout on PVP is a free kill |

Arbitrage (`CONFIG.arbitrage`) — see *Safety rails*, plus `approachUnits` (350;
see *The visibility radius* below) and `batchAboveGold` (100M; below it, one
trade at a time).

### The visibility radius

A stand's trade slots stay fully readable right to the edge of visibility —
there is no inner radius where you can see a stand but cannot read its prices —
so a merchant never needs to path all the way to one. Where that edge is has two
readings that **disagree and have not been reconciled**:

| reading | how |
|---|---|
| **566–619 units** | A controlled walk-out from a stationary stand: loaded and fully readable at 450, 500 and 566; gone at 619 and 681 |
| **699+ units** | An earlier incidental sighting, "still climbing" when sampling stopped. The scan-spot drifting still relies on it |

They may both be true if visibility varies by map or client state. The first was
controlled but done once, on one map, against one target; the second was
incidental.

`approachUnits` is **350** — below both, and above the 208 units at which a trade
is known to have worked, so it costs nothing to be wrong about either figure.
Raise it once the disagreement is settled. Picking whichever number is more
convenient is how this project produced a confident 1,307-unit trade range that
turned out to be an artefact.

Bridge (`market_bridge.py`):

| Constant | Default | Effect |
|---|---|---|
| `MERCHANT_TTL` | 60 min | Bound on growth, not a freshness rule — the page ages every row and the spread maths excludes old ones |
| `BOT_TIMEOUT` | 3 min | A silent scout's shard is released |
| `REASSIGN_MARGIN` | 1.25 | How much better a shard must be to trigger a move |
| `ACTIVITY_HALFLIFE` | 15 min | How fast an activity observation decays |
| `MESSAGE_TTL` | 10 min | Party relay retention |

---

## Rebuilding the pages

The two HTML files are generated. Edit the sources, never the HTML:

```bash
python3 build.py
```

`_al_template.html` holds everything shared; `_tabs_explorer.js` and
`_tabs_watchlist.js` hold each page's own tabs. The generated files are
committed alongside their sources so the pages work straight from a clone.

---

## What has been established, and what has not

**Measured against the live game:** the tax rate and which leg carries it; that
`trade_buy`/`trade_sell` take `(target, slot, quantity)`; that `bank_deposit`
and `bank_withdraw` exist; that `esize` is free inventory slots; that a bank
round trip is about 6 seconds; that a stand's slots stay readable to the edge of
visibility, wherever exactly that edge is (see *The visibility radius*); that `parent.entities` exposes stand slots
under `entity.slots` keyed `trade1..N` with equipment mixed in, so a scanner
must filter on the prefix; that `socket.emit('secondhands')` is the right call
for Ponty; that Chrome permits the `adventure.land` → `127.0.0.1` POST; and that
a trade survives the two page reloads its own shard hops cause.

**Not established:**

- Where the visibility radius actually is. Two readings disagree; neither has
  been re-run. `approachUnits: 350` sits under both.
- Whether a server-side trade-distance gate exists between 208 and 566 units.
  Confirmed trades exist only at 47 and 208; nothing cheap enough to test with
  was available further out. 350 is inside the proven band's upper reach and
  well past its lower one.
- Cross-map trading — never tested, same cause.
- The real opportunity rate. The one rehearsal ran 26 trades in 23 minutes but
  re-picked two routes seventeen times, because nothing is consumed in a
  rehearsal. With the cooldown in place that figure will be smaller and honest;
  it has not been re-run.
- Anything about live trading. `dryRun` has never been off.

**A note on reading numbers from outside the CODE frame:** `parent.character`
and the frame's own `character` are different objects. Reading position from the
top window produced a confident 1,307-unit trade range that was an artefact, and
a distance function was blamed for a fault it did not have. Use `PROBE_API`,
which closes over the frame, or run inside it.
