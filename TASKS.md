# Open tasks

Things deliberately left unfinished, with enough context to pick them up cold.

---

## 1. The farm-spot auto-blacklist ratchets until nothing is left to farm

**Status:** root cause identified, not yet fixed; whitelist workaround in place.
Priority: high — it disables farming outright.

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

### Root cause (found 2026-09-20 — supersedes the guesses that were here)

**The timer is not measuring what its name says.** `checkFarmEconomics()` runs in
`maintenanceLoop()` (`Ranger.js` ~L770). Travel runs in `mainLoop()` (~L652).
They are two independent `setTimeout` chains. The timeout measures *wall-clock
since the spot was assigned* — not time spent trying to travel, and not failed
route attempts. It fires whether or not `smart_move` was ever called.

And `mainLoop()` has eight early exits ahead of the movement branch, each of
which means no travel is attempted on that tick:

| `mainLoop()` guard | how long it can hold |
| --- | --- |
| `is_disabled(character)` | as long as the condition lasts |
| `state.sellingOff` | a round trip to Ernis and back (v37 inventory relief) |
| `state.waitingForMerchant` | up to `MERCHANT_WAIT_TIMEOUT_MS` = 90s |
| `checkPotionEmergency()` | until potions are sorted |
| `dragold.tick() === 'block'` | a shard hop, repeatedly |
| `character.map === "jail"` | until the jailer is reached |
| `shouldHandleEvents()` | **as long as any event is live** |
| `!CONFIG.movement.enabled` | forever |

`shouldHandleEvents()` is the big one: it takes the branch *instead of* movement,
and it is true whenever `holidayseason` is on without the buff, or any of
dragold / mrgreen / mrpumpkin / wabbit is live. None of that is rare.

Whichever guard holds, the sequence is the same: three minutes pass, the current
spot is blacklisted "couldn't reach", `runFarmSearch()` picks the next one,
`arrivalState.assignedAt` resets, three minutes later that one goes too. That is
exactly the observed ladder — uniform 180-second intervals, every entry reading
"couldn't reach", marching straight down the candidate list. **The spots were
never the problem, and in most of these cases `smart_move` was never called.**

Note the movement branch also only runs when `!get_nearest_monster({type: home})`,
so a visible home-type mob suppresses travel too.

### Secondary: travel failures are swallowed

`handleReturnHome()` in all three scripts (`Ranger.js` ~L1167, `Priest.js` ~L1169,
`Mage.js` ~L898) calls `smart_move(destination)` fire-and-forget — no `await`, no
`.catch()`. A rejection becomes an unhandled promise rejection and vanishes;
`smart.moving` goes false; the next tick re-issues it. If the destination is
genuinely unroutable this is a silent hot loop that looks identical, from the
outside, to "walking there slowly".

`Merchant.js` already solves this: `travelTo()` (~L512) awaits `smart_move`,
catches the rejection, falls back to `town()`, and retries the real route from
there — written because a seasonal map can lose its route out once the event
ends. Porting it gives the other three both the fallback and, more valuably, an
actual error message instead of silence.

### The fix

1. **Change the unit.** Count *failed travel attempts*, not elapsed wall-clock.
   Only advance the counter when travel was actually attempted and failed. This
   alone kills the ladder: no attempt, no count, no blacklist.
2. **Port `travelTo()`** into `Ranger.js` / `Priest.js` / `Mage.js`, with an
   in-flight guard (same shape as `state.sellingOff`) so the tick loop cannot
   stack concurrent attempts on an async helper.
3. **Bound the town fallback.** N retries (3 is reasonable), then blacklist.
   Do *not* make the timer pause-and-reset on reaching town without a cap:
   nearly every map has a town and `town()` works from almost anywhere, so an
   uncapped version can never fire — a genuinely unreachable spot would loop
   town → attempt → fail → town forever, never blacklisted and never farmed.
   That trades one no-exit loop for another.
4. **Record what happened.** `distance(character, destination)` and the
   rejection reason at the moment of the verdict, in the blacklist entry.
5. Still worth doing from the original list: expire entries rather than keeping
   them forever, and give routing verdicts and economics verdicts separate
   lifetimes.

### Ruled out

`ARRIVAL_RADIUS` being too tight is unlikely to matter: `handleReturnHome()`
keeps moving until within **20** units while `hasReachedFarmSpot()` accepts
**100**, so if `smart_move` ever returns he counts as arrived. The earlier
"he may already be there" theory is much weaker than the loop decoupling above.

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
