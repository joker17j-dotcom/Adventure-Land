# Adventure Land — a four-character party that plays itself

Scripts for [Adventure Land](https://adventure.land), a code-based MMORPG where
your characters are driven by JavaScript you write. Three of them farm; the
fourth runs a cross-shard arbitrage business to pay for it.

| File | Character | Slot | Size |
|---|---|---|---|
| `Ranger.js` | Dexon — ranger, the damage | `CH_IVnVbKQEQ8Ec0SaiZkZTtqLJRVJZB` | v51, 3.9k lines |
| `Priest.js` | FatherToken — priest, keeps everyone alive | `CH_hae5t3g8gBezOVTdR6ToTagikbTbF` | v26, 2.9k lines |
| `Mage.js` | MageofOz — mage | `CH_VEKJb9RqL1IoBTK8llTtOmRMcuNom` | v50, 2.1k lines |
| `Merchant.js` | Meltymerch — merchant, trader and mule | `CH_aLtHealaSgKdmOsDWpNl8scE9NhXk` | v47, 5.2k lines |
| `OpenGifts.js` | — | run by hand | opens event boxes at Xyn |

`Codex/` is the market tooling the merchant leans on: a local bridge, a
watchlist page, a game-data explorer, a trade ledger. It has
[its own README](Codex/README.md).

## Where the documentation lives

| File | What it holds |
|---|---|
| `CLAUDE.md` | Conventions for AI sessions working on this repo. **Read first** |
| `CHANGELOG.md` | What changed, why, and what was measured to justify it |
| `TASKS.md` | Open problems, with enough context to pick up cold |
| `Codex/README.md` | The market tooling, the bridge, arbitrage safety rails |
| `Codex/MerchantComments.md` | Long-form notes `Merchant.js` cites as `-> MerchantComments.md#anchor` |

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

- **Arbitrage is LIVE.** `CONFIG.arbitrage.dryRun` is `false` and it spends real
  gold continuously. Safety rails are in `Codex/README.md`; read the flag, not a
  document, before assuming otherwise.
- **Scouting is OFF** — `CONFIG.scout.enabled: false`, deliberately and
  temporarily. While it holds, the bridge's `/merchants` and `/ponty` answer
  empty on every shard. That is configuration, not a broken bridge.
- **Stand sales are OFF** — `CONFIG.standSales.enabled: false`, pending a
  re-test. The feature worked; the rollback was based on a misreading of how
  trade slots report when a stand is closed.

## A note on method

The comments in these files are unusually long, and deliberately so. Most record
a measurement and the wrong theory it killed — background-tab throttling, a
`3shot` firing at targets four times out of range, an unlist path that is a
socket emit rather than any `trade()` call, an item's contents worth 137x the
unopened box. Reading this code produces confident wrong answers; the comments
exist so the next person measures instead.

If you change something here, measure it first and record what the measurement
ruled out.
