# Codex — Adventure Land market tooling

Self-hosted market watchlist, in-game scout bots, and the local bridge that
connects them.

| File | What it is |
|---|---|
| `al_market_watchlist.html` | The watchlist page — market, summary, arbitrage, Ponty |
| `aldata_explorer.html` | Full game-data explorer — items, monsters, drops, world, bank |
| `MerchantScout.js` | Scout bot. One script, both roles. Paste as a character's CODE |
| `market_bridge.py` | Local server: collects scans, coordinates scouts. Stdlib only |
| `_al_template.html`, `_tabs_*.js`, `build.py` | Sources for the two pages (see *Rebuilding*) |

Both HTML files are fully self-contained. **You do not need any of this setup to
use them** — open either one and it pulls live market data from
`aldata.earthiverse.ca`. The bridge and scouts are for adding your *own* data on
top, and for Ponty, which has no public API at all.

---

## Quick start — one roamer, no fleet

This is the smallest thing that works, and it's a good first test.

### 1. Start the bridge

```bash
cd Codex
python3 market_bridge.py
```

You should see:

```
[bridge] listening on http://127.0.0.1:8787
[bridge]   scouts POST -> /scan      page GET -> /merchants, /ponty
[bridge]   status       -> http://127.0.0.1:8787/status
```

Leave it running. Add `--state ./scouts.json` if you want collected data to
survive a restart.

### 2. Put your character in the roamer role

Open `MerchantScout.js` and edit `CONFIG.roles` near the top. Replace the
placeholder names with your real character name:

```js
roles: {
    YourMerchantName: 'roamer',
},
```

A character not listed here defaults to `parked`, so the name must match exactly.

### 3. Run it in the game

1. Open <https://adventure.land> **in a browser tab** and log the character in.
2. Open that character's **CODE** tab.
3. Paste the whole of `MerchantScout.js` in, and start it.

> **Browser tab, not Mainframe.** `parent.X.servers` and `change_server()` are
> page globals that Mainframe's sandbox doesn't expose — the same reason Dexon's
> cross-server dragold scan is browser-only. The scout detects this and falls
> back to scanning one shard rather than dying, but you lose server hopping.

You should see log lines like:

```
[scout] YourMerchantName starting as roamer - bridge http://127.0.0.1:8787
[scout] bridge connected
[scout] 7 stands on USII
[scout] Ponty: 23 items on USII
[scout] hopping USII -> EUI
```

### 4. Point the page at it

Open `al_market_watchlist.html`, and on any tab change the dropdown from
**Source: ALData** to:

- **Source: local scouts** — only your own data
- **Source: both (merged)** — ALData plus yours, fresher sighting wins

The **Ponty Stock** tab is bridge-only and will populate once the roamer has
stood in front of Ponty at least once.

Ponty's stock is also folded into the market, summary and arbitrage tables as a
pseudo-merchant, tagged **PONTY**, controlled by the *include Ponty* checkbox
next to the source selector. This matters for arbitrage: Ponty is an NPC, so
unlike a player stand he is still there when you get back, and only the buy side
of such a spread can evaporate. He sells but never posts buy orders, so he can
create a spread but never fill one.

---

## Full setup — 3 parked + 1 roamer

Same as above, but list all four characters:

```js
roles: {
    Scout1: 'parked',
    Scout2: 'parked',
    Scout3: 'parked',
    Scout4: 'roamer',
},
```

Paste the **same file** into all four characters' CODE tabs — the role is
resolved from the character's own name at runtime. Each needs its own browser
tab, logged in.

**You do not assign shards yourself.** The bridge does it, and it has to:
`send_cm` is realm-local, so scouts on different shards physically cannot talk
to each other and can't agree among themselves who sits where. The bridge ranks
shards by observed activity, hands each parked scout a different one, and
removes a shard from the pool the moment it's handed out — so two parked scouts
can never collide.

As the roamer discovers busier shards, parked scouts migrate toward them. A move
only happens when the new shard beats the current one by 25%, otherwise scouts
thrash between near-equal shards and every move costs a `change_server` plus the
walk back to the scan spot.

---

## Verifying it works

Open <http://127.0.0.1:8787/status> in a browser. You get something like:

```json
{
  "merchants": 34,
  "listings": 112,
  "shards": {
    "USI":  {"stands": 9, "listings": 31, "score": 58.0, "seenAgo": 42},
    "USII": {"stands": 4, "listings": 12, "score": 24.0, "seenAgo": 310}
  },
  "bots": {
    "Scout1": {"role": "parked", "on": "USI", "assigned": "USI", "live": true},
    "Scout4": {"role": "roamer", "on": "EUI", "assigned": null,  "live": true}
  },
  "ponty": {"USI": {"at": "...", "items": 23}}
}
```

Read it in this order:

1. **`bots` non-empty with `live: true`** → the scouts can reach the bridge.
   If it's empty, the POST is being blocked (see *Troubleshooting*).
2. **`merchants` > 0** → the in-game stand scanner works.
3. **`ponty` has entries** → the Ponty socket call works.
4. **`assigned` differs per parked scout** → coordination is working.

---

## Troubleshooting

**`bots` stays empty / scout logs `bridge lost`**

The browser is blocking the POST from `https://adventure.land` to
`127.0.0.1`. The bridge already sends `Access-Control-Allow-Private-Network` for
Chrome's Private Network Access preflight, which covers the usual case. If it's
still refused, check the browser console on the game tab for the actual error.
Nothing is lost while this is broken — the scout buffers its findings, keyed by
merchant, and ships them when the bridge comes back.

**`merchants` stays 0 but scouts are live**

The scanner isn't seeing stands. Either nobody is trading where the scout is
standing, or the scan spot is wrong. Scan spots are derived from the `main`
map's NPC positions; override them explicitly if your servers cluster elsewhere:

```js
scanSpots: [{ map: 'main', x: -100, y: -150 }],
```

**`ponty` stays empty**

The scout logs `Ponty returned nothing (out of range, or the call timed out)`.
Ponty only answers while you're standing next to him. Raise `pontyTimeoutMs` if
the shard is slow.

**Scouts never hop**

`[scout] server hopping unavailable here` means `change_server` or
`parent.X.servers` is missing — you're on Mainframe, not a browser tab.

**Page shows `ALData only (bridge unreachable)`**

Expected when the bridge isn't running. The page never breaks on this; ALData is
the floor and the bridge is a bonus.

---

## Tuning

Scout (`MerchantScout.js`, `CONFIG`):

| Setting | Default | Effect |
|---|---|---|
| `scanIntervalMs` | 4s | How often visible entities are swept |
| `postIntervalMs` | 15s | How often findings ship to the bridge |
| `roamDwellMs` | 90s | How long a roamer works one shard |
| `pontyEveryMs` | 10 min | Per-shard Ponty re-check interval |
| `minHopIntervalMs` | 30s | Floor between `change_server` calls |
| `skipServers` | `['PVP']` | A parked scout on PVP is a free kill |

Bridge (`market_bridge.py`, constants near the top):

| Constant | Default | Effect |
|---|---|---|
| `MERCHANT_TTL` | 20 min | Unconfirmed stands drop off `/merchants` |
| `BOT_TIMEOUT` | 3 min | A silent scout's shard is released |
| `REASSIGN_MARGIN` | 1.25 | How much better a shard must be to trigger a move |
| `ACTIVITY_HALFLIFE` | 15 min | How fast an activity observation decays |

---

## Rebuilding the pages

The two HTML files are generated. Edit the sources, never the HTML:

```bash
python3 build.py
```

`_al_template.html` holds everything shared (data loading, icons, tables, the
market section). `_tabs_explorer.js` and `_tabs_watchlist.js` hold each page's
own tabs. The generated files are committed alongside their sources so the pages
work straight from a clone.

---

## What has and hasn't been tested

Honest status, because some of this was never run against a live game.

**Verified** — `market_bridge.py` was exercised against a simulated fleet with
fabricated scan payloads. Assignment uniqueness, activity ranking, hysteresis,
roamer-alone operation, TTL eviction, and ALData-shaped output all behave
correctly. Both HTML pages parse and rebuild reproducibly.

**Not verified — needs a live game:**

- That `parent.entities` exposes other players' stand slots the way
  `scanStands()` assumes (trade goods in `trade1..N`, equipment filtered out)
- That `socket.emit('secondhands')` is the right call for Ponty, and its reply
  shape. Two plausible layouts are handled; a `get_secondhands()` helper may
  exist and would be a cleaner swap
- That `change_server()` behaves as expected inside the scout loops
- That Chrome permits the `https://adventure.land` → `127.0.0.1` POST

The quick start above is the fastest way to settle all four at once.
