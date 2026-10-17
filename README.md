# Adventure Land — a four-character party that plays itself

Scripts for [Adventure Land](https://adventure.land), a code-based MMORPG where
your characters are driven by JavaScript you write. Three of them farm; the
fourth runs a cross-shard arbitrage business to pay for it.

> **Reorganised 2026-10-17.** The character scripts moved from the repository
> root into `Party/`. Any path in an older note, code comment or commit message
> may still point at the old location.

## The party

Each file is pasted into that character's own CODE slot. Versions and sizes are
as of 2026-10-17.

| File | Character | Slot | Size |
|---|---|---|---|
| `Party/Ranger.js` | Dexon — ranger, the damage, and the one that picks the farm spot | `CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB` | v82, 7.2k lines |
| `Party/Priest.js` | FatherToken — priest, keeps everyone alive | `CH_hae5t3g8gBezOVTdR6ToTagikbTbF` | v47, 5.1k lines |
| `Party/Mage.js` | MageofOz — mage | `CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom` | v70, 4.4k lines |
| `Party/Merchant.js` | Meltymerch — merchant, trader and mule | `CH_aLtHealaSgKdmOsDWpNl8scE9NhXk` | v97, 9.5k lines |

Dexon chooses the farm spot and broadcasts it; the priest and mage adopt his
`home`/`mobMap` and focus-fire his target rather than picking independently.

`Party/Merchant.js` keeps only its current version on line 2 — its history lives
in `Party/CHANGELOG.md`, to stay under the CODE slot size cap. The other three
accumulate their version entries in the line-2 header.

## Run by hand

Standalone scripts, pasted into a slot when wanted rather than left running.

| File | What it does |
|---|---|
| `CaveRun.js` | Cave of Many Dreams. The **same file** goes in all three combat slots; `caveLead(name)` picks the leader. Entry is manual by design — one visit per account per day, and an accidental `enter()` burns it. v13 |
| `UpgradeCompound.js` | Works whatever is in **slot 0** up to its target level, upgrading or compounding. A stop is never a dead end: it fingerprints the situation and clears itself the moment the bag changes. v7 |
| `Cleanout.js` | Sells an inventory down, to the best player bid or else to an NPC. v3 |
| `OpenGifts.js` | Stands at the hub, opens anniversary boxes, sells the chaff. v8 |
| `ExchangeQuest.js` | The complement of `OpenGifts.js` — exchanges the quest-routed exchangeables at their own NPCs. v1 |
| `LuckySlotFinder.js` | Finds **this character's** lucky upgrade slot. `p.item_num` is rolled once per character and never reassigned, and in that slot 60% of upgrade rolls are compressed downward. Measures the roll distribution rather than the success rate, because accumulated grace drifts the latter and the roll's distribution does not. Normal upgrades only — the comparison does not exist on the compound or pscroll paths, so compounding gains nothing from it. Parks at the newupgrade NPC, which reaches buy, upgrade and sell without moving. Loading it **stops whatever was running in that slot.** |

## Market tooling — `Codex/`

The bridge, the watchlist page, the game-data explorer, the trade ledger, and
the family's separate fleet. It has [its own README](Codex/README.md), and the
second-computer relay has [another](Codex/relay/README.md).

The bridge also polls ALData for every boss type and serves `GET /bosses`, which
is how a character learns about a boss on a shard it is not connected to —
`server.status` only ever describes the shard that character holds.

## Where the documentation lives

| File | What it holds |
|---|---|
| `CLAUDE.md` | Conventions for AI sessions working on this repo. **Read first** |
| `Party/CHANGELOG.md` | `Merchant.js` version history, and what was measured to justify each change |
| `Party/MerchantComments.md` | The long-form notes `Merchant.js` cites as `-> MerchantComments.md#anchor` |
| `Codex/README.md` | The market tooling, the bridge, arbitrage safety rails |
| `Codex/relay/README.md` | Running a scout on a second computer |
| `REPORTS.md` | Named reports the operator asks for by phrase. Produced by Claude querying the live game, not by any script |
| `Gear_Progression_Review.md` | Gear goals, the reasoning behind them, and the live state they were measured against |
| `Archived/TASKS.md` | Retired task list, kept for the context in it |

## Reference and archive

- **`Crowns3bc/` is reference only — never edit it, never deploy from it.**
  Another player's scripts, kept because the repository that hosted them went
  away. Whatever was useful in them was folded into our own scripts many
  versions ago. The files carry no extension and have spaces in their names, so
  a `*.js` glob skips them silently — which also means `Crowns3bc/Ranger` and
  `Party/Ranger.js` are different files, and a bare "Ranger" is ambiguous.
- **`Archived/`** is retired work: `Archived/Upgrade` and `Archived/TASKS.md`.

## Deploying

Each character runs in **its own browser tab** at `adventure.land`, with the
file pasted into that character's CODE slot. Not Mainframe: `parent.X.servers`
and `change_server()` are page globals its sandbox does not expose, and without
them there is no shard hopping, so no cross-shard trading.

After saving a slot, `load_code` still serves a cached copy — **the character
keeps running the old build until the page is fully reloaded.** Verify a deploy
by feature-detecting something only the new build has, never by the slot version
number.

## The trap that costs the most time

**Chrome throttles background tabs, and it looks exactly like dead code.**

A hidden tab's timers are clamped to roughly 1s, then to about 1/minute after a
few minutes hidden. Only ONE tab per window is `visible`; every other tab in
that window is hidden regardless of focus. The character scripts are `setTimeout`
chains, so a background character runs in slow motion while `/hub` cheerfully
reports `code_running: true`. Measured: a ranger landing 4 attacks/minute where
60–120 were due.

Before concluding any loop is dead, check `document.hidden` and measure a plain
`setInterval(fn, 100)` in that same tab. If it is not firing ~10x/second, every
rate you measure there is meaningless.

The fix is to start Chrome with throttling disabled:

```
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
```

These apply **only to a brand-new Chrome process**. If Chrome is already
running, launching with flags hands the URL to the existing process and every
flag is silently ignored. Close Chrome fully first, tray icon included.

## Current operational state

Flags verified against `Party/Merchant.js` on 2026-10-17. **Read the flag, not
this table** — it is the sort of thing that goes stale between releases, and
has.

- **Arbitrage is LIVE.** `CONFIG.arbitrage.enabled: true` and `dryRun: false`
  (lines 407 and 410). It spends real gold continuously. Safety rails are in
  `Codex/README.md`.
- **Scouting is ON.** `CONFIG.scout.enabled: true` and `parked: false`
  (lines 348 and 352) — the operator's standing preference since 2026-10-01.
  This README said the opposite until 2026-10-17, which is exactly the failure
  the comment beside `enabled` warns about: a stale "OFF, deliberately and
  temporarily" sitting next to a value that is already `true`.
- **Stand sales are OFF.** `CONFIG.standSales.enabled: false`. Rolled back
  2026-09-22 on the belief that listed goods vanish on a shard hop; that was
  disproved on 2026-09-24 (they persist server-side - a closed stand only
  hides them client-side) and re-confirmed by the operator 2026-10-17. The
  rollback reason no longer holds; re-enabling is a decision, not a fix.

## A note on method

The comments in these files are unusually long, and deliberately so. Most record
a measurement and the wrong theory it killed — background-tab throttling, a
`3shot` firing at targets four times out of range, an unlist path that is a
socket emit rather than any `trade()` call, an item's contents worth 137x the
unopened box. Reading this code produces confident wrong answers; the comments
exist so the next person measures instead.

If you change something here, measure it first and record what the measurement
ruled out.
