# Codex — Adventure Land market tooling

Self-hosted market watchlist, an in-game scout, a local bridge, and an
arbitrage executor that trades across shards.

| File | What it is |
|---|---|
| `al_market_watchlist.html` | The watchlist — market, summary, arbitrage, Ponty, trade ledger |
| `aldata_explorer.html` | Full game-data explorer — items, monsters, drops, world, bank |
| `boss_timers.html` | The boss page the bridge serves at `/boss_page`. Not built from the template |
| `market_bridge.py` | Local server: collects scans, coordinates scouts, keeps the trade ledger. Stdlib only |
| `PHASE0_PROBE.md` | The hand-driven probe procedure that measured the trade API |
| `relay/` | For running a scout on a second computer — see its own README |
| `MerchantScout.js` | Standalone scout, for a fleet — see *Which file is the scout* |
| `party_link.js` | Cross-shard party messaging — paste-in block for the four character scripts |
| `FamilyFleet.js` | The family's separate fleet, on its own account. Nothing here reads it |
| `_al_template.html`, `_tabs_*.js`, `build.py` | Sources for the two pages (see *Rebuilding*) |

> **Moved 2026-10-17.** `MerchantComments.md` — the long-form notes
> `Merchant.js` cites as `-> MerchantComments.md#anchor` — now lives at
> `Party/MerchantComments.md`, alongside the character scripts.

Both HTML files are fully self-contained. **You do not need any of this setup to
use them** — open either one and it pulls live market data from
`aldata.earthiverse.ca`. The bridge adds your own data on top, plus two things
the public feed does not have: Ponty's stock, and the trade ledger.

---

## Which file is the scout

`Party/Merchant.js` — at the repository root until the 2026-10-17 reorg.
Scouting was merged into the merchant, so one character both trades and scans.
That is the only scout that has ever run.

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
[bridge]   bosses       -> GET /bosses?type=&server= (ALData every 45s)
[bridge]   status       -> http://127.0.0.1:8787/status
```

Run it **from a directory you intend to keep**. `ledger.jsonl` is created there
and is permanent — it is the trade history, and the whole point of it is that no
timer and no restart clears it. `--ledger PATH` moves it; `--state ./scouts.json`
additionally persists the market snapshot, which is optional because that data
is meant to age out.

### 2. Run the merchant

1. Open <https://adventure.land> **in a browser tab** and log the character in.
2. Open its **CODE** tab, paste the whole of `Party/Merchant.js`, start it.

> **Browser tab, not Mainframe.** `parent.X.servers` and `change_server()` are
> page globals Mainframe's sandbox does not expose. Without them there is no
> shard hopping, so no rotation and no cross-shard trading.

Log lines to expect:

```
[probe] v27 / arb.4 ... loaded (0 stored entries) - arbProbeHelp() for commands
```

> **Scouting is ON.** Verified 2026-10-17: `CONFIG.scout.enabled` is `true`
> (`Party/Merchant.js:348`) and `parked` is `false` (`:352`), the operator's
> standing preference since 2026-10-01. So expect these:
>
> ```
> [scout] bridge up - scouting enabled
> [scout] 7 stands on USII - confirmed
> [scout] Ponty: 23 items on USII
> ```
>
> This section said the opposite until 2026-10-17, and had done since the
> values were flipped. The comment beside `enabled` in the file warns about
> exactly that: a stale "OFF, deliberately and temporarily" sitting next to a
> value that is already `true` is the sort of line a later reader fixes the
> wrong way. **Read the flag, not this README.** When scouting IS off, empty
> `/merchants` and `/ponty` on every shard are the configuration working rather
> than the bridge failing - a distinction that has already cost one wrong
> diagnosis.

### 3. Point the page at it

Open `al_market_watchlist.html`. The source dropdown offers **ALData**, **local
scouts**, or **both (merged)**, with ALData the default.

The **Ponty Stock** and **Trade Ledger** tabs are bridge-only.

---

## How many shards, and how fresh

The scout reads the game's own live server list (`parent.X.servers`) and skips
`PVP`. That was **11 shards** when last measured; it follows the game if that
changes.

One scout, rotating — a full sweep took about **2.4 minutes** when measured.
Any given shard is accurate at the moment it is scanned and up to a sweep old
afterwards. It never sees more than one shard at a time.

**That figure was measured on `Merchant.js`'s scout, and does not carry over to
`MerchantScout.js`.** The two gate their hops differently, and the difference
is larger than the measurement:

| | hop gating | sweep of 11 shards |
|---|---|---|
| `Merchant.js` (`mHopTo`) | none — settle until loaded, then `minPostGapMs` 7s | **2.4 min, measured** |
| `Codex/MerchantScout.js` (`hopTo`) | `minHopIntervalMs` **30 s**, enforced and persisted | **≥ 5.5 min floor, never measured** |

`MerchantScout.js` has never been run (see Fleet mode below), so its sweep time
is arithmetic, not a result: 11 × 30 s is the floor before a single scan,
settle, post or page load.

**The 30-second floor is a deliberate stability decision, not an accident.**
`change_server()` reloads the page, and a roamer sweeping continuously does
that thousands of times over a multi-day run. The concern — raised by the
family member who would be running these scouts — is the browser or the game
client degrading or crashing under that load. Halving the hop rate is the
agreed mitigation. It is not a knob to tune for freshness, and the cost in
sweep time is known and accepted.

Worth noting for consistency rather than as an argument against it:
`Merchant.js` has no such floor, and it hops both to scout and to execute
arbitrage. If the crash concern holds, that is the script more exposed to it.

This matters because the sweep time is what the source preference below rests
on, and it is also most of the `sellMaxAgeSec` budget. That budget is **7
minutes** (`sellMaxAgeSec: 7 * 60`), not the 15 this section claimed until
2026-09-22 - which inverted the conclusion drawn from it. At 2.4 minutes a
listing has already spent **a third** of its allowed life before it is posted;
at 5.5+ it has spent **four fifths**, before anyone acts on it.

**Neither source is preferred wholesale any more — they are merged per merchant
per shard, and the newer row wins.**

It used to be winner-takes-all: ALData was asked first, and if it answered with
anything at all the bridge was never consulted. That was right while no scouts
existed. ALData covers every shard continuously; a lone rotating scout produces
a rolling snapshot of one shard at a time. Measured side by side: 267 stands
across 11 shards from ALData against 8 stands on 1 shard from ours. Preferring
ours wholesale meant reading the worst view of the market rather than the best,
and a probe hold — which stops the rotation — made it worse silently.

It is the wrong rule once scouts are running, because **freshness is a property
of a row, not of a source**. On the shard a parked scout is sitting on, ours is
seconds old; three shards away ALData's is better. `arbMergeMarketRows` takes
both and resolves only the conflicts, by age.

It is a **union**, not an intersection: a merchant only one source knows about
is kept, because absence from a source is not evidence of departure — neither
source claims to have looked everywhere. A row with no readable timestamp
always loses to one with an age.

Pinning a source (`arbProbeSource('bridge')`) stays winner-takes-all on purpose:
it exists to answer "is the bridge feeding anything at all", and a merge would
hide exactly the answer it is asked for.

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

**You do not assign shards yourself.** `send_cm`'s *server* delivery is
realm-local, so scouts on different machines and different shards cannot talk to
each other and cannot agree who sits where.

> Measured 2026-09-22: `send_cm` also has a SECOND path. Characters "opened
> locally" - tabs in the same browser - get a fast local delivery that ignores
> shards entirely, and it resolves `{receivers, locals}` so you can see which
> path carried a message. One tab to another took 2ms across different shards.
> So the realm-local rule holds for a fleet spread over machines, which is the
> case this section is about, and is FALSE for four tabs on one computer. The bridge ranks shards by observed activity,
hands each parked scout a different one, and removes a shard from the pool the
moment it is handed out, so two parked scouts can never collide.

**A roamer's beat covers every shard, not only the scanned ones.** Until
2026-10-17 the beat was built from the bridge's `activity` table, which only
a completed scan writes — a closed loop, because a shard entered the beat
once it had been scanned and was scanned only once it was in the beat.
Whatever happened to be in the table when the beat first filled became the
roamer's whole world; measured on the live merchant, it was cycling **three
shards out of eleven**. The beat is now seeded from the full server list, and
unseen shards lead it for free because `staleness()` scores an absent entry
at `t - 0`. `GET /status` carries a `shardList` block so the list in use is
visible rather than inferred.

Fixed here rather than in the client on purpose. `scoutNextShard` in
`Party/Merchant.js` already prepends never-seen shards in its *rotation*
branch, but a roamer takes the *beat* branch above it — and patching that one
would have every roamer chase the same unscanned shard until the first scan
landed. Dealing them out round-robin on the bridge gives each roamer
different ones. Parked assignment is deliberately untouched and still draws
only on shards with real activity.

**Roamers are given a beat each.** The unparked shards are dealt out between
however many roamers are live, so no two ever walk the same one. Before this,
every roamer received the same staleness-ordered rotation and took its head —
two roamers therefore picked the same shard on every hop and shadowed each
other, measured at 8 ticks out of 8, with the second contributing nothing.

The deal is made from a name-sorted list rather than from the rotation, because
the rotation re-sorts by staleness on every request and partitioning it would
hand a roamer a different set each tick — the opposite of owning a beat.
Ownership is stable; within a beat, the stalest shard is still visited first.
A roamer that goes silent drops out of the split and the rest re-deal its
shards automatically.

A parked scout only moves when a new shard beats its current one by 25%.
Without that margin they thrash between near-equal shards, and every move costs
a `change_server` plus the walk back to the scan spot.

A character not listed in `CONFIG.roles` defaults to `parked`, so an extra scout
can be pasted in unmodified and still be assigned a shard.

**A scan reporting an empty merchants array replaces that shard's listings** —
an empty list is a real observation ("nothing trading here right now"), which is
what makes a stale stand disappear when it packs up. The consequence is that a
scout must never post before its entity list has streamed in, or it wipes a
shard that was full. Both scouts sweep until the count stops growing, and hold
zero open until every pass is spent, because "nothing yet" and "nothing here"
look identical for the first second or two.

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

The merchant can buy on one shard and sell on another.

> **`dryRun` is `false`. This spends real gold, continuously.** Until
> 2026-09-22 this section said it was `true` "by default in the sense that
> matters", which was the most dangerous sentence in the file: by then the
> ledger already held 894 live events, 280M deployed and 107M realised - along
> with a single trade that lost 63,485,800. Do not trust a README for this;
> read the flag.

`dryRun: true` simulates the only two calls that move money while running every
other step for real, which is what makes it a usable rehearsal.

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
| `fallbackMinRecovery` | 1.0 — a RESERVE PRICE on the fallback exit. Added 2026-09-22 |
| arbitrage-stock registry | Goods arbitrage has paid for are hidden from both NPC sell paths |
| `NO_TRADE_ITEM_NAMES` | Items never bought or sold at all, filtered at flip ingestion |
| verification | Both legs re-checked against the live client before trading |

The last three are all from 2026-09-22, and the first two exist because of the
same afternoon.

`arbFindBuyerFor` runs when the planned buyer has failed, and it used to take
the best bid on the board with no reference to what the goods cost - its own
comment reasoned that the question had become "is there any exit at all". It
bought feather0 x331 for 82,750,000 and sold the lot into a 60,000 bid twenty-
eight minutes later, for a net of **-63,485,800**. Every other trade that day
was positive. `fallbackMinRecovery` is the floor under that exit; below it the
goods are banked instead, which was always a supported outcome.

The registry exists because neither NPC sell path knew arbitrage existed.
`sellTrash` vendors anything on its whitelist on sight and the aggressive seller
vendors nearly anything once free slots reach 5 — both priced by NPC value, and
the slices arbitrage trades in millions vendor for **six gold**. It would also
have been invisible: NPC sales are recorded nowhere, not in this ledger and not
in the server's own `trade_history`, which logs player-to-player trades only.
`slice_blueberry` came off the `sellTrash` whitelist the same day, having been
on a list of things to vendor on sight while arbitrage paid 2,000,000 for one.

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

## Boss watch — `GET /bosses`

The bridge polls ALData for every boss type every 45s and serves the result,
filterable by `?type=mrgreen` and `?server=EU+III`.

**Why the bridge and not a character script.** `server.status` (`parent.S`)
describes only the shard the character holding it is connected to, so no script
can see a boss on another server.
Running one poller here also keeps the hp history across CODE restarts and
shard hops, and has one caller hit a free third-party API instead of four.

**An hp percentage does not tell you whether a boss is being killed.** Measured
2026-10-17 from the game's own `server.status`:

| shard | observation | reading |
|---|---|---|
| ASIA I | 28,088,505 hp at 10:16 and the identical value at 10:27 | 78%, **abandoned** |
| US III | unchanged over 80s | 42.8%, **abandoned** |
| US V | lost 1,075,988 hp in 47s | 22,866 aggregate dps, **active** |
| EU III | lost 2,836,886 hp in 132s | 21,561 aggregate dps, **active** |

Three servers looked part-killed; two were abandoned. A party sent on the
strength of a percentage arrives to solo a half-dead boss. Only a delta over
time, or a non-null `target`, separates those cases, so the endpoint computes
the delta rather than leaving every caller to keep its own state.

Each row carries `hp`, `max_hp`, `pct`, `target`, `lastSeen`, `age_sec`, `dps`,
`eta_sec`, `stale`, `live`, `estimated_respawn` and `respawn_sec`, plus a
`poller` health block on the response.

Two things about it that are easy to get wrong:

- **`dps: null` and `dps: 0` are different answers.** `null` means fewer than
  two refreshed readings — nothing is known. `0` means two readings that agree,
  which is the *evidence* a boss is sitting untouched, and the case worth not
  walking into. It therefore needs two readings ALData itself refreshed:
  samples dedupe on `lastSeen`, because re-reading its cache (entries measured
  12–30s stale) is one observation reported twice. An hp *increase* is treated
  as a respawn and clears the buffer rather than scoring as negative damage.
- **`max_hp` is observed, not game data.** It is the largest value the bridge
  has seen for that type since it started, labelled `max_hp_source:
  "observed"`. A bridge started while every shard's boss was half dead reads
  high on `pct` until one respawns.

The response schema is sparse. In the 2026-10-17 sample `target` was present on
4 of 13 entries and non-null on 1, and servers with nothing alive carried
`estimatedRespawn` with no `lastSeen` at all. Absent and null are kept apart
(`has_target_field`), and an unparseable timestamp reports `age_sec: null`
rather than becoming 1970 and reading as confidently stale.

If ALData is unreachable the route still answers, from cache, with the
staleness in the `poller` block — so "the bridge is down" and "ALData is down"
stay distinguishable to a game script that has no other way to tell.

Covered types are the 15 in `allBosses` plus the 6 cooperative monsters
`Party/Ranger.js` lists separately in `attackIfTargeted`. ALData's README
states `cutebee` and `goldenbat` are excluded from its results.

### Where the hp comes from — `server_info`, not ALData

The poller reads the game's **own** `server_info` broadcast over engine.io
HTTP long-polling, with no new dependency. `--boss-source aldata` switches
back to the original third-party poll, kept as a fallback.

| | ALData | `server_info` |
|---|---|---|
| source | third party | the game server |
| cadence | 45s poll, hit a 429 | pushed, no rate limit |
| `max_hp` | inferred from the largest value seen | **given** |
| respawn | a derivation | the server's own `spawn` field |
| full sweep | 45s | **5.3s measured** |

Polling is open on the socket: `node/server.js:52` builds the main io server
with no `transports` option, so it keeps the default
`["polling", "websocket"]` — only the msgpack server at `:60` is
websocket-only. No auth is needed either: `server_functions.js:2961` does
`broadcast("server_info", E)` and `broadcast()` blanket-emits to every
connected socket with no player check, so an anonymous socket that completes
the handshake receives it.

**It is event-driven, not polled.** `broadcast_e()` fires when something
changes, so a quiet server simply has nothing to say. Connections are held
open and accumulate; a server that has not spoken is **unknown, not dead**,
and keeps the `stale` / `dps: null` discipline. Reconnect is backed off.

Seeding is **per server**: the first sighting of a shard is recorded without
emitting a spawn, because a boss already up may have been up for hours and an
invented spawn makes an invented TTK. A push is also scoped to the server
that sent it — running the transition pass over every tracked key on one
server's push would read all the others as absent and manufacture deaths.

Two things this does NOT change. `dps` still needs two samples over time —
`server_info` gives hp at an instant, same as before. And the death time is
still `spawn - respawn_sec`: `server_functions.js:2589` sets that field from
`future_s(nominal respawn)`, **not** the randomised `monster_respawns` delay
at `server.js:13097`, so the subtraction still lands on the death. Because
the field is exact, such a death is logged `confidence: "high"` regardless of
the observation gap.

The server list comes from `X.servers` on the adventure.land page — where the
browser gets it, so it follows a new server — falling back to a 13-entry seed
list if that fetch fails.

### The kill log — `GET /boss_events`, `GET /boss_stats`

**A kill cannot be reconstructed after the fact, which is the whole reason
this is a file.** While a boss is dead its death time is recoverable as
`estimated_respawn - respawn_sec`; the moment it respawns that field goes
null, `lastSeen` with it, and the kill is gone. In-memory state would not
survive a bridge restart either. So the poller appends to
`boss_events.jsonl` (`--boss-events`, next to `ledger.jsonl`; both are
gitignored) at the instant it sees a transition.

`respawn_sec` is what makes the death time exact: ALData's `estimatedRespawn`
is death plus the NOMINAL respawn, so subtracting it recovers the moment of
death rather than the moment the poller noticed. Verified for `mrgreen`
(94*60 = 5640s). The server randomises the real respawn
(`node/server.js:13096`), so these constants decode a death; they do not
predict a return.

**The table is measured from the deployed client, and must not be
re-derived from the mongodb repo.** The two disagree: the source has
`greenjr: 480 && 12*72*60` and `jr: 480 && 6*72*60`, which evaluate to 51840
and 25920 in JavaScript, while the running client reports 480 for both.
`mvampire`, a plain `18*60` in the source, agrees at 1080 — so they part
company exactly where the source carries the `&&` form. `rimedjinn` is absent
from the source file and the client reports 12. This file shipped the
evaluated source values once; they were wrong, in precisely the way CLAUDE.md
warns about.

Three event types. `spawn` and `death` carry `id`, so a respawn under a new
instance id cannot be mistaken for the same fight, and `death` carries
`ttk_sec`, `method` and a `death_lo`/`death_hi` bracket.

**`lost` is the third, and it is never counted as a kill.** A boss vanishing
from the response is not a death — a 429 or a partial answer looks identical,
and one was observed on a real cycle (`HTTP Error 429`, recovered by itself).
Four guards keep that out of the statistics:

| Guard | Behaviour |
|---|---|
| Failed fetch | Returns before the comparison runs, so no transition is ever evaluated |
| Server missing from the response | Never a death, however many polls it lasts. Logged `lost` instead |
| Boss absent on a server that DID answer | A death, but only after 3 consecutive successful polls, and always `confidence: "low"` |
| Empty response while live bosses are tracked | Whole pass skipped, state untouched |
| First poll of a process | Seeds only. A boss already up gets `spawn_t: null`, so it can never produce an invented TTK |

The second and third rows are the distinction that matters: "this server did
not answer" and "this server answered and the boss was gone" look identical
in the data and mean opposite things. A death is otherwise recorded only on
POSITIVE evidence — the entry present, not alive, and carrying a respawn
estimate.

`poll_gap_sec` is per ENTRY, seconds since that entry was last observed, and
`confidence` is `high` only when it is within 2x the poll interval.

**Rate limiting.** 45s sits close to whatever ALData's limit is; a real cycle
returned `HTTP Error 429` and recovered on its own. Each consecutive failure
doubles the wait (capped at `BOSS_BACKOFF_MAX_SEC`, 15 min) and one success
returns to the configured interval.

`GET /boss_history` aggregates per (type, server): `kills_logged`,
`ttk_median_sec`, `ttk_p25_sec`/`ttk_p75_sec`, min/max, `kills_per_day`,
`last_kill_t`, `last_spawn_t`, `stalled_count`, `observed_window_sec` and
`confidence_counts`. Takes `?type=`, `?server=`, `?since=` and
`?include_low=1`.

Low-confidence kills are counted but kept OUT of the medians unless asked
for. A kill whose timestamp is bounded only by a wide poll gap still proves
the boss died there and says very little about how long it took.

`kills_per_day` is **capped at the physical maximum**, `86400 / respawn_sec`.
Measured 2026-10-17: EU IV mrgreen reported 152.11 kills/day off ONE kill in a
568-second window, against a ceiling of 15.32 — a short window divides a single
kill into an enormous rate, and the ranking sorts on exactly this number.
`kills_per_day_raw` and `kills_per_day_cap` are both kept so the capping is
visible, and `rate_capped` flags it. The ranking also partitions on
`enough_data` so thin rows fall BELOW every qualified row: capping alone does
not fix it, because a capped 15.32 off one kill still outranks a real 12
earned over days.

**`stalled_count` is the figure a median TTK cannot show,** and the reason
the ranking is not just a TTK table. A stall is a spawn whose next same-type,
same-server spawn arrives with no death in between: the boss spawned, got
nibbled, and was abandoned. Measured 2026-10-17, ASIA I held 28,088,505 hp
for 40+ minutes and US III 15,417,063 for 24+. That server produces no bad
TTK, because it produces no TTK at all, and it is the worst possible home.

## `GET /schedule` — daily and nightly windows

When each shard's daily and nightly windows open, as UTC instants the page
renders in America/New_York. Takes `?region=`, `?server=` and `?hours=`.

**The clock is per REGION, not per server.** `server.js:316` sets
`E.schedule.time_offset = TIMEO[region]`, and `server_functions.js:2321`
computes a game hour as `(UTC_hour + 24 + offset) % 24`, firing a daily when
it reaches an hour in `E.schedule.dailies` and a nightly for `.nightlies`. So
a window's UTC hour is `(game_hour - offset) mod 24`, and every shard in a
region opens at the same instant:

| Region | Offset | Dailies (game 13, 20) | Nightly (game 23) |
|---|---|---|---|
| EU | +1 | 12:00, 19:00 UTC | 22:00 UTC |
| US | −5 | 18:00, 01:00 UTC | 04:00 UTC |
| ASIA | +7 | 06:00, 13:00 UTC | 16:00 UTC |

**Those offsets are fixed and do not follow daylight saving**, so a window
sits at a constant UTC hour all year while its wall-clock time in
America/New_York moves. The US 18:00 UTC daily is 2:00 PM EDT today and 1:00
PM EST from 2026-11-01. That is the whole reason the page converts with a
named zone instead of a stored offset.

**Which event fires cannot be predicted.** `server.js:281-284` holds the
rotations `["crabxx", "goobrawl", "abtesting"]` and `["icegolem", "franky"]`
and `shuffle()`s BOTH at server start, so the order differs between shards
and changes on every restart. The route lists the candidates and fills in
`observed` from the kill log where it can: crabxx, icegolem and franky are
monsters and show up as spawns, so a spawn inside the window names what ran.
`goobrawl` and `abtesting` are not monsters and can never appear, so a null
`observed` means "not known", never "nothing happened".

> **Source-derived, not measured.** Every constant in this section comes from
> `kaansoral/adventureland_mongodb` and has not been confirmed against the
> running game. The respawn table above was built the same way once and was
> wrong. `S.schedule` IS exposed to the client — `js/functions.js:5765` reads
> `S.schedule.time_offset` — so this is one browser call away from being
> verified, and `SCHEDULE_*` in `market_bridge.py` is where to correct it.

Latent quirk, recorded while reading: `last_daily` at
`server_functions.js:2330` and `:2339` is one variable shared by both loops,
so a daily hour equal to a nightly hour would fire only one of them. The
configured hours do not collide.

## `GET /boss_page`

The page, served from the bridge so it is same-origin with the JSON. Read off
disk from `boss_timers.html` next to `market_bridge.py`, so it stays a
reviewable file in git; opening that file directly also works, because it
falls back to the absolute loopback address when the protocol is `file:`.

Four views. **Now** — every (type, server), live-and-dying first, with
either "respawns 12:43 PM" and a ticking countdown or "up, ~11 min left".
**Timers** — the next respawn per server for one type. **Schedule** — the
daily and nightly windows above, per server, with what was observed in each. **Server ranking** —
the decision view, sorted by kills per day, with the stall count and a sample
column; anything under `BOSS_MIN_KILLS_FOR_TREND` (5) logged kills is greyed
out and labelled, because a 1-kill server otherwise tops the table. `dps` is
deliberately absent there: it is a trailing average that reads low on a
ramping fight and would mislead a direct comparison.

Every timestamp crosses the wire as ISO-8601 UTC and is rendered by
`Intl.DateTimeFormat` with `timeZone: 'America/New_York'`. Nothing computes an
offset server-side and nothing hardcodes `-04:00` — **US DST ends
2026-11-01**, and a baked-in offset would go an hour wrong on every timer
that night.

---

## Verifying it works

<http://127.0.0.1:8787/status> for the market side, <http://127.0.0.1:8787/trades>
for the ledger, <http://127.0.0.1:8787/bosses> for the boss watch. From the game console:

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

**Bridge reachable but `stands: 0`** — nothing is posting. Check
`CONFIG.scout.enabled` FIRST: while it is `false`, empty is the correct answer
on every shard and says nothing about the bridge's health. It is `true` as of
2026-10-17, so empty is a real fault now - usually a probe hold with the
merchant away from the scan spot, or the merchant stopped. `/trades` and the party relay keep working throughout —
an empty `/merchants` is not evidence of a dead bridge.

**Finders return `SOURCE: in-view scan only`** — neither ALData nor the bridge
answered, and you are seeing one plaza rather than the market.

**A listing on the board is not there when you arrive** — ALData carries stands
that have already gone. This is normal and why both legs verify before trading;
`listing changed before buying` with `nothing_spent` is the system working.

---

## Tuning

Merchant (`Party/Merchant.js`, `CONFIG.scout`):

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
| `BOSS_POLL_SECONDS` | 45s | ALData boss poll interval (`--boss-interval`, `--no-bosses`) |
| `BOSS_SAMPLE_WINDOW` | 5 min | How far back a sample counts toward the dps delta |
| `BOSS_SAMPLE_CAP` | 48 | Ring-buffer bound per (type, server) |
| `BOSS_STALE_AFTER` | 120s | `age_sec` above this marks a `/bosses` row stale |

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
