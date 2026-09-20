# Open tasks

Things deliberately left unfinished, with enough context to pick them up cold.

---

## 1. The farm-spot auto-blacklist ratchets until nothing is left to farm

**Status:** worked around, not fixed. Priority: high — it disables farming outright.

### What happens

`listBlacklist()` on Dexon currently shows ~55 entries. Nearly every one reads

> `Dexon couldn't reach this spot (stuck 180s without arriving)`

and their timestamps are 180 seconds apart, one after another. That spacing is the
whole story: the timeout fires, a new spot is picked, that one times out too, and
the search walks straight down the candidate list burning it as it goes. Nothing
ever expires, so the damage only accumulates. Given enough uptime it blacklists
every spot in the game and the party stands still.

### Where it lives

- `Ranger.js` — `checkFarmEconomics()`, the `UNREACHABLE_TIMEOUT_MS` (3 min) branch.
  This is the one doing the damage.
- `Ranger.js` — `hasReachedFarmSpot()` and `ARRIVAL_RADIUS` (100 units) decide
  whether he "arrived".
- `Ranger.js` — `handleReturnHome()` issues the `smart_move` that is supposedly failing.
- `Priest.js` ~L468 and `Mage.js` ~L425 send the same verdict to Dexon as
  `blacklist_spot`; Dexon owns the list, they only report.

### Two halves to work out

**(a) Why does he not arrive?** Candidates, cheapest to check first:

1. **He may already be there.** `ARRIVAL_RADIUS` is 100 units and the destination
   is the *midpoint of the spot's boundary box*. `smart_move` stops where it stops.
   If it routinely settles more than 100 units from that midpoint, Dexon is
   blacklisting the ground he is standing on. Log `distance(character, destination)`
   at the moment the timeout fires — this single number probably answers it.
2. **The midpoint may be unreachable geometry.** A boundary box can straddle
   terrain; its centre can sit inside a wall or across water.
3. **The router may refuse the map** — doors, instances, keys, level gates.
4. **`smart_move` may be silently failing** and `smart.moving` staying false, so
   `handleReturnHome()` re-issues it forever without progress.

**(b) Whatever the cause, the verdict must stop being permanent and absolute.**
Even a correct reachability test should not behave like this:

- Expire entries (a day? a week?) instead of keeping them forever.
- Require N failures across separate attempts, not one.
- Record how close he actually got, so "stopped 120 units away" is told apart
  from "never left the starting map".
- Consider making the blacklist per-reason, so an economics verdict and a
  routing verdict do not share a lifetime.

### What is in place meanwhile (v38)

`Ranger.js` has two coded lists just above `spotKey()`:

- `PERMANENT_WHITELIST` — `crab@main`, `arcticbee@winterland`, `snake@main`.
  Can never be blacklisted; incoming reports are refused, and entries already in
  storage are dropped the next time the list is read, so the three the ratchet
  already ate come back on their own. If scoring somehow rejects everything,
  these are used unscored rather than farming nothing.
- `PERMANENT_BLACKLIST` — `gscorpion@desertland`, `mrpumpkin@halloween`,
  `mummy@level3`, `ghost@halloween`, `mummy@level4`. Never scored at all.

`clearBlacklist()` was added as a console helper for wiping stored entries
(the coded lists are unaffected).

This guarantees the party always has somewhere to farm. It does not stop the
ratchet from eating everything else.
