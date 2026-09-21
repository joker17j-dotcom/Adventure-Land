# Merchant.js - the long comments

Rationale extracted from Merchant.js on 2026-09-21, because comments were 43.7%
of the file and the CODE slot has a ceiling. Merchant.js keeps a one-line
summary at each site plus a pointer here; the reasoning, the measurements and
the theories that were tried and discarded live below, under the anchor the
code names.

None of this is load-bearing for the script. It is load-bearing for the next
person who wonders why a number is what it is - and most of these numbers were
measured rather than chosen, which is exactly the kind of thing that gets
'tidied' away by someone who does not know that.

Anchors match the `-> MerchantComments.md#anchor` pointers in the source.

---

## stamp-where-the-sender-is

Stamp where the sender is standing. Doing it here rather than at each
   call site means every message type gets it for free, and the merchant can
   work out whether a request needs a shard change without the requester
   having to think about it.

## enabled

OFF, deliberately and temporarily.

	   Turned off by the operator while the live arbitrage run is being
	   watched: it keeps the merchant off the scan beat, off the bridge and
	   out of scoutGoHome, so the only thing moving the character is the
	   trade executor and anything it does is attributable.

	   ARBITRAGE IS UNAFFECTED. It reads the market from the bridge and
	   ALData, both of which other scouts fill - nothing in the flip finder
	   needs THIS character to have scanned. Turning scouting off does not
	   turn trading off; CONFIG.arbitrage.enabled is the switch for that.

	   Set back to true to resume. Everything below stays configured.

## parked

PARKED - hold the party's home shard and never hop just to scout.

	   The family's MerchantScout fleet now covers the rotation, so the
	   merchant's shard-hopping was duplicating work it is much worse at: a
	   hop reloads the page, and every hop risks stranding deliveries, the
	   stand and an in-flight trade behind a page load. A dedicated scout
	   pays that cost for nothing else; the merchant pays it with the party's
	   economy on its back.

	   Parked, it holds CONFIG.homeServer, rescans it every townScanMs, and
	   still scans wherever else the script legitimately takes it - arbitrage,
	   deliveries - it just never travels FOR a scan. Set false to restore
	   the old roaming rotation.

## aldata

earthiverse's ALData, the same feed the watchlist page defaults to. It
covers every server continuously and is not affected by whatever this
merchant happens to be doing, which matters during a probe: holding
the merchant still stops OUR scouting, and then our own bridge is the
worst market view available rather than the best. Serves the same row
shape as /merchants, so it is a peer source, not a special case.

## standRegion

Where the stands are, as a box in world coordinates.

	   This is what the scan gate tests, and it is a stronger test than the
	   one it replaces. "Within 60 of the first stand candidate" asked
	   whether we were standing on one particular point; this asks whether
	   the whole selling area is inside the vision box, which is the thing
	   that actually decides whether a reading is complete.

	   It matters because an empty scan REPLACES a shard's listings on the
	   bridge rather than merging into them. A read taken from somewhere
	   that cannot see the stands reports "nothing trading here" as fact,
	   and wipes a full market.

	   Numbers are FamilyFleet's: the observed cluster padded by about 100
	   each way. One sample put six stands inside x -147..161, y -110..92.
	   A snapshot rather than a stable distribution, so the padding is doing
	   real work and this is a knob, not a constant.

## kissGuardMs

Be home this long before an anniversary round starts. S.anniversary.next
is the round's start time, on the hour, so this is a real deadline
rather than a guess.

5m10s, not 6m. The requirement is to be in place five minutes early;
the extra minute was padding, and padding here is paid for in forgone
arbitrage, which is worth more than one kiss round. Ten seconds of
slack is kept because smart_move's last few steps are not instant.
Missing the window is not an error: the round is skipped and the
merchant carries on as though the event were not running until the
next round's guard opens.

## arbitrage

ARBITRAGE - the agreed specification, recorded here so it lives with the
code rather than in chat history. PHASE 0 uses only `probe`; every other
field is inert until Phase 1 flips `enabled`.

PRIORITY: arbitrage outranks queued delivery/pickup work and the
anniversary round. The combat characters buy their own potions when stock
hits zero, so a delayed delivery is an inconvenience rather than a death.
The one exception is jobPreemptMs below.

## dryRun

Belt and braces. Turning `enabled` on alone cannot spend gold: the
executor still runs every step - find, verify, approach, hop, ledger,
bank - but the two calls that move money are simulated from the
listed prices instead of made. Everything this code has been tested
against so far is a stub, and the live game has already contradicted
three confident readings, so the first run on the real market should
not be the first run that can lose something.

Dry-run events reach the ledger marked dryRun, so the whole recording
path is exercised too - a rehearsal that skipped it would not be
testing the thing most likely to be wrong. The bridge keeps them out
of realised P/L.

NOW FALSE - the rehearsal is over and the operator has taken this
live, having watched a run and confirmed it working. As of the
handover: 8 closed live trades, 60,469,850 spent, 21,063,085 net.

This MUST live in source rather than be set at runtime. mHopTo()
calls change_server, which reloads the page, and hopping to the buy
shard is the first step of nearly every trade - so a value set from
the console is gone before the buy leg runs, and the trade finishes
simulated after starting live.

## batchAboveGold

Below this much gold, one trade at a time. At or above it, batching is
allowed - multiple units of one item and multiple items in a visit -
but ONLY when every buy sits on one shard and every sell sits on one
shard. Splitting either leg across shards risks buying what cannot
then be sold.

## sellMaxAgeSec

A listing older than this is treated as gone rather than as an offer.
	   Gates BOTH legs in arbProbeFindFlips, despite the name.

	   Tightened from 15 minutes to 7. The old value matched the watchlist's
	   SPREAD_MAX_AGE_MS, which is the right window for something you are
	   looking at - a stale row is still worth showing. It is the wrong window
	   for something you travel to and spend gold on.

	   7 minutes is roughly three sweeps at the measured rate: Merchant.js's
	   scout swept 11 shards in about 2.4 minutes, so a row from our own
	   bridge is at most a sweep old when posted and this leaves margin for
	   two more before it is disbelieved. At 15 minutes a buy order could be
	   six sweeps stale and still be picked, and the case that costs real gold
	   - a fresh seller paired with a dead buyer - is exactly the one a wide
	   window lets through.

	   CAVEAT worth knowing before tightening further: the primary source is
	   ALData, not our bridge, and ALData's own refresh cadence has never been
	   measured. If its rows are typically older than this, the filter starts
	   rejecting the market rather than the stale part of it. The flip finder
	   now reports how many listings it dropped as stale and how fresh the
	   freshest rejected one was, so that shows up as a number rather than as
	   an unexplained absence of opportunities.

## approachUnits

How close to get to a stand before trading. Not a measured limit - a
deliberately conservative choice below two readings that disagree.

  566-619  a controlled walk-out from a stationary stand: loaded and
           fully readable at 450, 500 and 566, gone at 619 and 681.
  699+     an earlier incidental observation of a stand still visible,
           and "still climbing" - see the scan-spot comments, which
           rely on it.

They are not reconciled. Visibility may differ by map or by client
state, the first was controlled but done once against one target on
one map, and the second was incidental. Picking whichever is more
convenient is how this project produced a confident 1,307-unit trade
range that turned out to be an artefact.

350 sits comfortably inside both, and above the 208 units at which a
trade is known to have worked, so it costs nothing to be wrong about
either figure. Raise it once the disagreement is settled.

## usedCooldownMs

A listing this merchant has just traded against is suppressed for this
long. Measured need: the rehearsal re-picked the same route seventeen
times because nothing consumes stock in a rehearsal - but live, the
public feed still lists a stand we have just emptied, and worse, a buy
order we have just filled.

The two sides are not symmetric. A stale BUY listing costs nothing:
verification fires before any gold moves and the trade is abandoned
with nothing spent, which is exactly what the rehearsal showed nine
times. A stale SELL listing is only discovered after the purchase, on
another shard, and turns gold into an item nobody will buy. Without
this, the executor would re-fill an order it had just exhausted,
bank the goods, and go round again.

## taxBands

Tax applies ONLY to gold received from another ACCOUNT, and the
receiver pays it. Exactly one leg of an arbitrage round trip is
therefore taxed:

  buy from a player   - gold goes to them; they are taxed, we pay the
                        listed price and nothing more.
  buy from Ponty      - an NPC receives; nobody is taxed.
  sell to a player    - gold arrives here from their account: TAXED.
  sell to an NPC      - no account on the other side; untaxed, so
                        calculate_item_value is the true net.
  own characters      - same account, exempt.

  net = sellPrice * (1 - taxRate) - buyPrice      (player buyer)
  net = npcValue                  - buyPrice      (NPC buyer)

CONSEQUENCE: the sell side is a CHOICE, not a given. A player buy
order only beats the vendor once it clears the vendor's price by more
than the tax, so the comparison is

  max(npcValue, playerBuyPrice * (1 - taxRate))

and never playerBuyPrice on its own. At 4% a buy order must sit about
4.2% above vendor value merely to break even against vendoring, so a
buy order that looks better on the board can be worse in the hand.

SOURCE: kaansoral/adventureland, node/server.js, in
calculate_player_stats(), which assigns player.tax from a chain of
`level > N && rate` clauses. It is a STEP function, not a smooth
decay: no per-level taper, nothing below 1%, nothing above 5%. The
bands below were evaluated against that expression at every boundary
(1/20/21/50/51/60/61/70/71/80/81/100) and agree at all of them.

The published chain carries two consecutive `level > 80` clauses
(0.01 then 0.012). `||` short-circuits on the first truthy value, so
the second is unreachable and everything above 80 is simply 1%.
Transcribed here as the live behaviour rather than the apparent
intent, since the server runs the code and not the intent.

## townSpot

THE TOWN SPOT - one position that reaches five NPCs.

   Measured and tested live against game data 17083, not derived and not
   guessed. It is the centre of the smallest circle enclosing Lucas, Cue,
   Gabriel and Ponty, radius 286.05; Lucas and Ponty are 572.1 apart and
   form the diameter, so no point in town beats 286 on the worst case.

   Distances from it, all computed from the NPCs' own map positions:

     Gabriel  (basics, selling)     129.4   verified: buy
     Cue      (upgrade, compound)   150.6   verified: upgrade rolled
     Ernis    (potions)             169.8
     Lucas    (scrolls, cscrolls)   286.0   verified: buy
     Ponty    (secondhands)         286.1   verified: replied, 225 items

   Ernis was not in the original four and turns out to sit well inside the
   circle, so adding him does not move the optimum - the worst case goes
   from 286.05 to 286.09, which is the same two NPCs binding it.

   WHAT IS STILL A JOURNEY, and deliberately: Garwyn (offerings) is 616
   away and Crun (scroll3/cscroll3) is on `level2`. The upgrade planner can
   still choose those and will still travel for them.

   IF THE NPC SET CHANGES, recompute the smallest enclosing circle rather
   than nudging this point - the binding pair may change.

## aggressiveEnabled

Nothing else in this script actively guards against Meltymerch's
own 42 inventory slots filling up - the fighters' own muling logic
dumps items on him with no capacity check on his end. Once free
slots drop to/below this threshold, sell everything NOT protected
(see PROTECTED_ITEM_NAMES and isTier2OrTier3GearItem below)
instead of just the small whitelist above.

## mluck

mluck requires level 40 - Meltymerch is 19 at time of writing, so this
stays inert until he levels up. Ranger.js's own "location" broadcast
fires specifically when Dexon's current mluck isn't sourced from
Meltymerch (see needsUpdate in sendLocationUpdate()) - that's the
signal this listens for below.

## ensureStandClosed

TRAVEL HELPER - smart_move with a town() fallback, since a seasonal/event
map (e.g. halloween) may have no route out once that event ends.

STAND SAFETY - close the stand before any real movement, centralized here
in travelTo()/travelToBank() (the only functions that call smart_move/
town/xmove) rather than at each call site. Fixes a real bug: the stand
used to stay open during a mid-delivery potion restock trip, because that
trip ran before processBatch()'s own close step.

## character-stand-is-the-game

character.stand is the game's answer; state.standOpen only our note of it.
   They part on every shard hop: change_server reloads the page, so state
   returns with standOpen false while the stand, server side, still stands.
   The old early return believed the flag and skipped the close, so the
   merchant walked and hopped with it up. Seen live 2026-09-21 on EU III.

## mPos

Where we are, in WORLD coordinates.

  real_x/real_y where the client offers them, x/y otherwise. The top window
  reports .x/.y in screen space - measured (1147, 416) while the character
  stood at (-123, -52) - and NPC entities have .x === .real_x, so the
  discrepancy is invisible until something cross-checks the two. It cost this
  project a phantom 1,307-unit trade range once.

## mInTown

Can we see the whole selling area from here?

  All four corners, not the centre: a box is only fully visible when its
  furthest corner is, and a centre test passes from places where half the
  stands are off screen. This is the gate on every scan, because a scan that
  cannot see the stands reports an empty market as fact.

## SHARD_REGIONS

MESSAGE HANDLING
============================================================================
============================================================================
CROSS-SHARD SERVICE
============================================================================
send_cm is realm-local, so before the relay existed a request from another
shard simply never arrived and the question never came up. Now it does: a
job can name a shard this character is not on, and serving it means going
there and coming back.

Only reachable when the relay is up, i.e. in a browser tab. On Mainframe the
relay is off, so every request that arrives came in-game from someone on this
same shard and none of this engages.

## arbTaxRate

This merchant's tax rate on gold received from another account.

  Prefers the server's own number. calculate_player_stats assigns player.tax
  server-side, so if it reaches the client then it is authoritative and cannot
  drift when the bands are rebalanced. CONFIG.arbitrage.taxBands is the
  fallback, transcribed from the same function.

  Returning null is meaningful: it means neither source produced a usable rate,
  and the profit test must refuse rather than treat the tax as zero. Assuming
  zero over-trades, which is the expensive direction to be wrong in.

## TRIP_KEY

A cross-shard trip has to survive the hop itself.

  change_server() wipes runtime state in a browser tab - the script restarts -
  and processBatch has already spliced the whole queue OUT of state.queue into
  a local variable by then, so an in-flight batch would be lost twice over. The
  browser tab is also the ONLY place this feature runs, since the relay needs
  the bridge, so that is not an edge case, it is the normal case.

  So before every hop the not-yet-served jobs and the real home shard are
  written to storage, and a restart puts them back.

## mHomeShard

Where to return to once the trip is done. Read straight from CONFIG and
  never written: home is a decision, not an observation. Learning it from
  wherever the stand happened to open meant one failed return could redefine
  where the merchant lived, and it would then believe it was already home.

## visitOneStop

VISIT LOGIC - handles delivery and/or pickup jobs for one recipient,
as one stop within a larger batch (no travel-home step here).

Strategy: try everything at the current location first. Whatever can't be
done because the recipient isn't actually in range gets a "come to me"
summon instead of just failing - then waits for them to arrive before
retrying, and tells them to resume their normal routine once done.

## needed

To the town spot rather than to Ernis himself.

   He is 169.8 from it, comfortably inside the 300 this function already
   accepted as close enough - so nothing about the purchase changes, but
   the merchant ends up somewhere it can also buy scrolls, upgrade, sell
   and read Ponty without moving again. Standing on Ernis can do only the
   one thing.

## shouldHoldStand

A stand only belongs on the home shard.

  Every hop reloads the page, so STARTUP now runs on whatever shard the scout
  just landed on - and startup opened a stand there. That is the eight
  "Stand opened at (100, 0)" lines seen across one rotation: a stand raised on
  a remote shard nobody is looking at, closed again by the next tick, and
  raised again after the next hop. Pointless work, and it advertises the
  merchant somewhere it will not be in thirty seconds.

## sellTrash

Selling needs Gabriel in range - 129.4 from the town spot, and both buy and
  sell are confirmed working at that distance. So this is another thing the
  merchant does without moving, PROVIDED it is standing there; called from
  anywhere else it is the caller's business to have got in range, which is
  unchanged from before.

## PROTECTED_ITEM_NAMES

AGGRESSIVE SELLING WHEN LOW ON SPACE - see CONFIG.selling.aggressive*.
Never sells a tier 2/3 gear-progression item (per explicit instruction).
Tier 1 items are NOT protected - if one is mid-compound when space runs
low, this can sell it out from under the auto-combine logic. That's the
rule working as specified: tier 1 gear is treated as ordinary junk.

## not-called-here-it-now

NOT called here - it now references GEAR_PROGRESSION/PARTY_CLASSES from
the "GEAR PROGRESSION SYSTEM" section further down this file, which are
`const` declarations not yet initialized at this point in top-to-bottom
script load. Calling it immediately here would throw a
"Cannot access before initialization" error the moment this script
loads. Started instead from STARTUP, after that section has run.

## LEVEL_CODES

GEAR PROGRESSION SYSTEM (see [[gear-progression-system]] memory note).
Decides whether a muled-over item is worth upgrading/compounding toward
its class's gear plan, one step at a time. Also: auto-compounds any 3+
identical items at level 0/1 regardless of the plan (junk piles up fast),
and banks a plan item once it hits the highest level any class calls for.

GEAR_PROGRESSION only populates ranger/priest/mage (the party's classes).
Tier-3 levels use letter codes - see LEVEL_CODES. Several item names are
shared across classes; PARTY_CLASSES's order (ranger > priest > mage) is
the attribution priority when a shared-name item arrives, since there's
no way to know which character actually sent it.

## earring1

Uses the dexterity-stat set (dexbelt/dexring/dexamulet), not
the generic shared items. orbg@1 compound is the shared
tier1 orb goal across all three classes.
earring1: { item: 'dexearring', level: 1, method: 'compound' }, helmet: { item: 'helmet', level: 6, method: 'upgrade' }, earring2: { item: 'dexearring', level: 1, method: 'compound' }, amulet: { item: 'dexamulet', level: 2, method: 'compound' },
mainhand: { item: 'firebow', level: 5, method: 'upgrade' }, chest: { item: 'coat', level: 6, method: 'upgrade' }, offhand: { item: 't2quiver', level: 5, method: 'upgrade' }, cape: { item: 'bcape', level: 4, method: 'upgrade' },
ring1: { item: 'dexring', level: 2, method: 'compound' }, pants: { item: 'pants', level: 6, method: 'upgrade' }, ring2: { item: 'dexring', level: 2, method: 'compound' }, belt: { item: 'dexbelt', level: 1, method: 'compound' },
orb: { item: 'orbg', level: 1, method: 'compound' }, shoes: { item: 'shoes', level: 6, method: 'upgrade' }, gloves: { item: 'gloves', level: 6, method: 'upgrade' }, elixir: null,

## earring1-2

Uses the intelligence-stat set (intbelt/intamulet). orbg@1
compound is the shared tier1 orb goal across all three classes.
earring1: { item: 'intearring', level: 1, method: 'compound' }, helmet: { item: 'wcap', level: 5, method: 'upgrade' }, earring2: { item: 'intearring', level: 1, method: 'compound' }, amulet: { item: 'intamulet', level: 2, method: 'compound' },
mainhand: { item: 'firestaff', level: 5, method: 'upgrade' }, chest: { item: 'wattire', level: 5, method: 'upgrade' }, offhand: { item: 'wshield', level: 4, method: 'upgrade' }, cape: { item: 'bcape', level: 4, method: 'upgrade' },
ring1: { item: 'ringsj', level: 2, method: 'compound' }, pants: { item: 'wbreeches', level: 5, method: 'upgrade' }, ring2: { item: 'ringsj', level: 2, method: 'compound' }, belt: { item: 'intbelt', level: 1, method: 'compound' },
orb: { item: 'orbg', level: 1, method: 'compound' }, shoes: { item: 'wshoes', level: 5, method: 'upgrade' }, gloves: { item: 'wgloves', level: 5, method: 'upgrade' }, elixir: null,

## earring1-3

Plain-basics + Fiery Staff, not priest's Wanderer's set - mage
doesn't use that set. orbg@1 compound is the shared tier1 orb
goal across all three classes.
earring1: { item: 'intearring', level: 1, method: 'compound' }, helmet: { item: 'helmet', level: 6, method: 'upgrade' }, earring2: { item: 'intearring', level: 1, method: 'compound' }, amulet: { item: 'intamulet', level: 1, method: 'compound' },
mainhand: { item: 'firestaff', level: 5, method: 'upgrade' }, chest: { item: 'coat', level: 6, method: 'upgrade' }, offhand: { item: 'wbook0', level: 2, method: 'compound' }, cape: { item: 'bcape', level: 4, method: 'upgrade' },
ring1: { item: 'ringsj', level: 2, method: 'compound' }, pants: { item: 'pants', level: 6, method: 'upgrade' }, ring2: { item: 'ringsj', level: 2, method: 'compound' }, belt: { item: 'intbelt', level: 1, method: 'compound' },
orb: { item: 'orbg', level: 1, method: 'compound' }, shoes: { item: 'shoes', level: 6, method: 'upgrade' }, gloves: { item: 'gloves', level: 6, method: 'upgrade' }, elixir: null,

## buildCosts

----------------------------------------------------------------------------
COST / PROBABILITY MATH - reused from the Upgrade & Compound Cost
Calculator's pure probability functions (getUpgradeChance/getCompoundChance),
scoped down to a single greedy next-step choice rather than a full
multi-step plan, since execution re-evaluates after every real attempt
anyway (success/failure is random).
----------------------------------------------------------------------------

## BUYABLE_OFFERING_INDICES

Verified against live NPC data: 'offeringp' and 'offeringx' have NO
vendor anywhere in the game - offeringp is drop-only (bscorpion,
fvampire, market parcels), offeringx is craft-only (10x offering +
essences + 32,000,000 gold). Only index 0 ("none", no purchase needed)
and index 2 ("offering", sold by Garwyn) can actually be bought, so
those are the only ones the planner is allowed to select.

## pickBestUpgradeStep

Picks the single cheapest-expected-cost (cost / chance) scroll+offering
combo for the NEXT level only. Scroll grade capped at 3 (grades arrays
are always 4 entries, so this never excludes a real option) and offering
restricted to BUYABLE_OFFERING_INDICES, since offeringp/offeringx have
no vendor anywhere (drop/craft only) and would just fail every buy().

## SCROLL_NPC

----------------------------------------------------------------------------
EXECUTION - verified vendors:
  - Lucas ("scrolls") main (-464, -96): scroll0-2, cscroll0-2. No offerings.
  - Garwyn ("premium") main (192, -564): sells 'offering' (grade 2, 27.42M gold).
  - Crun ("thief") map "level2" (-133, -187): scroll3, cscroll3.
  - scroll4/cscroll4, offeringp, offeringx: no vendor anywhere - excluded
    via the scroll-grade cap and BUYABLE_OFFERING_INDICES above.
----------------------------------------------------------------------------

## MATERIAL_VENDORS

Maps each purchasable material name to the NPC that actually sells it.
Anything not listed here (offeringp, offeringx, scroll4, cscroll4) has
no real vendor - ensureUpgradeMaterials() below refuses to attempt a
buy() for those rather than travel nowhere and fail silently, but in
practice the planner functions above never select them in the first
place (see the scroll-grade cap and BUYABLE_OFFERING_INDICES).

## ensureUpgradeMaterials

Walk to ONE place and buy everything from there.

  Each material used to get its own travelTo, so a step needing a scroll and
  an offering made two journeys and the upgrade itself then happened wherever
  the last one left the character standing. For a plain scroll that was
  Lucas, from whom Cue is 285.4 away - right at the edge of range, and the
  reason the upgrade worked at all. From the town spot Cue is 150.6, and the
  scroll, the roll and the selling afterwards all happen without another
  step.

## findBaseDuplicateGroup

Finds the first group of 3+ identical (name, level) items at level 0/1,
regardless of GEAR_PROGRESSION - junk from muling piles up fast and is
worth consolidating on its own. Skips upgrade-only items (coat, pants,
weapons, etc.) - compounding one of those either fails outright or
silently blocks that item's real upgrade logic every tick.

## gearProgressionLoop

----------------------------------------------------------------------------
MAIN LOOP - mirrors queueLoop()'s own busy-flag pattern so the two never
fight over Meltymerch's movement at the same time. One action category
per tick (bank pass, then at most one spend action), re-evaluating from
scratch next tick rather than trying to plan multiple steps ahead.
----------------------------------------------------------------------------

## canSpend

Gated behind canStartSpending: without this, a plan candidate or
duplicate group sitting below the gold threshold made the loop
close/reopen the stand every cycle for nothing, since
attemptBestPlanStep()/autoCombineOneBaseDuplicateGroup() both
bail out silently at that same gold check anyway. hasBankable
stays independent since banking doesn't cost gold.

## combined

One walk, then everything. The bank pass above is its own
			   map and has to be its own trip, but from here on the scroll,
			   the compound and the upgrade are all reachable from a single
			   position - so go there once rather than letting each step
			   walk itself somewhere and leave the next one to find its own
			   way back. goToTownSpot returns early if we are already
			   standing there, which after a bank return we are not.

## featuredState

ANNIVERSARY KISS HUNTER - see CONFIG.anniversaryKiss above for the toggle.
Works on Mainframe and in browser. Primary source is parent.S.anniversary
(target/map/x/y) - structured game state, no chat or DOM dependency.
The public chat announcement ("Find X in Y!...") is kept as a secondary
source, though live testing 2026-09-17 found it didn't fire for an entire
round while parent.S.anniversary stayed correct the whole time - a
guessed-CSS-selector DOM lookup remains as a last-resort browser-only
fallback below both.

## primary-source-structured-game-state

Primary source - structured game state, no chat/DOM dependency at
all, works identically on Mainframe and in browser. Confirmed via
live testing 2026-09-17: the chat announcement below did NOT fire
for an entire round, but parent.S.anniversary.target was populated
and correct the whole time - this is the reliable source.

## hopSick

Are we carrying hop sickness right now?

  Worth a named helper rather than an inline check, because the condition is
  easy to reason about wrongly. The live rule (node/server_functions.js
  declares serverhop_logic twice; the SECOND declaration wins and the first,
  with its hop counting and tapering tiers, is dead code) is:

    arriving anywhere that is not player.p.home, at level >= 60, off PVP
    -> the flat condition from G: luck -80, gold -80, xp -80, output -20,
       for 12 minutes of online play

  Returning to p.home clears it immediately, because the same function deletes
  the condition before deciding whether to re-add it. Below level 60 it is
  never applied at all, which is why this reads the live flag rather than
  trying to predict it - the level gate, the home shard and the clock are all
  the server's business, and character.s is where it reports the answer.

## a-probe-hold-suppresses-this

A probe hold suppresses this outright. The kiss walks the merchant
across town at its own cadence, on a loop of its own that the scout
hold never touched - so a measurement could be halfway through a
positioning step when the round pulled the character away, and the
numbers would look like a game behaviour rather than an interruption.

Tied to the hold rather than a separate switch: the hold already
means "a probe is running", it survives a reload, and kissing resumes
by itself when the hold comes off, so there is no flag left stranded.
CONFIG.anniversaryKiss.enabled remains the permanent off switch.

## being-the-target-ourselves-is

Being the target ourselves is not a kiss we can perform: get_player
does not resolve our own name, so attemptKiss fell through to
smart_move-to-where-we-already-are and span there for the whole
round - with state.busy held the entire time, which also blocked
deliveries, the stand and scouting. Record it and do nothing.

## hop-sickness-blocks-kiss-rewards

Hop sickness blocks kiss rewards outright - G's own explanation
for the condition says so, and it is not in the modifier list, so
nothing about luck/gold/xp/output hints at it. Walking the round
while sick spends the trip, closes the stand and collects nothing.
Sit it out and say why, once per featured player.

## not-called-here-it-now-2

NOT called here. It now reads PROBE.hold, and PROBE is a const declared in
the probe section further down this file - referencing it at this point in
top-to-bottom load throws "Cannot access before initialization" on the very
first tick. Started from STARTUP instead, like maintenanceLoop and
gearProgressionLoop, once every section has run.

## scout

MARKET SCOUTING
============================================================================
Folds MerchantScout's roaming scan into the merchant, as a strictly lower
priority than everything it already does.

GATE: scouting runs only when the local bridge answers AND change_server is
available. On Mainframe the bridge lives on the operator's PC and is
unreachable by construction, so this never engages there and the merchant
behaves exactly as it did before - no flag to set, no separate build.

PRIORITY, highest first:
  1. queued delivery/pickup work      - scouting stands down entirely
  2. the anniversary round            - home kissGuardMs early, stays until
                                        the round has rolled over
  3. scouting                         - only with nothing else to do

While out scouting the stand is closed, so this trades stand uptime for
market coverage. It comes home for anything that matters and reopens.

## shards

Findings not yet accepted by the bridge, BUCKETED BY SHARD. Keying only
   by merchant id was wrong: a failed post left stands buffered, and the next
   successful one stamped the payload with wherever the scout had since
   hopped to, so merchants scanned on EU I were filed under US II. The bridge
   takes the shard from the payload, so that mis-attribution is what the
   watchlist quotes - and acting on it means travelling to a shard the
   merchant was never on. Ponty had the same flaw.

## scoutSave

change_server RELOADS THE PAGE in a browser tab - the script is destroyed and
  re-run from the top. Nothing after the hop in the same function ever executes,
  and every in-memory field resets. Anything that must outlive a hop therefore
  goes through the game's own CODE storage, and the loop is arranged so a hop is
  always the LAST thing a cycle does.

## scoutCurrentShardCount

Stands buffered for THIS shard only.

  scoutSettleScan used scoutBufferedCount(), which is every shard still being
  carried. With an unsent backlog that is non-zero before the new shard has
  been looked at even once, so the two-passes-agree test passed on the second
  pass and the sweep "settled" without observing anything. Settling exists to
  give a freshly landed client time to stream its entity list in, and a count
  that includes four other shards cannot measure that.

## scoutResetCurrentShardStands

Drop this shard's stands before a sweep starts.

  Accumulate WITHIN a sweep - the passes are there so a streaming entity list
  can finish arriving - but REPLACE between visits. Without this a returning
  roamer merged the new view into the old, so a stand that closed between
  visits was never removed and went on being reported as live every time the
  roamer came back. The bridge stores what it is sent; it cannot know a row is
  a ghost.

## scoutItemPrice

calculate_item_value() returns what Ponty PAID - buy_to_sell is already in
  it - so his asking price is that times secondhands_mult. Verified against
  four observations: mcape 480,000 -> 576,000, ringsj 24,000 -> 28,800, and
  two community samples. Passing the whole item lets the game handle level,
  grade and upgrade-vs-compound, which no formula fitted to samples could.

## do-not-walk-to-him

Do not walk to him from the town spot. He is 286.1 away from it and has
   answered a live query at exactly that distance with 225 items, so the
   walk buys nothing and costs the position everything else is reachable
   from. The walk is kept for anywhere else, because anywhere else means
   the merchant is mid-errand rather than parked.

## scoutReport

Posts every buffered shard, each stamped with the shard it was observed on -
  never with wherever the merchant happens to be standing now. A bucket clears
  only once the bridge acknowledges storing exactly what was sent; anything
  unconfirmed stays put, still attributed correctly, and goes out next time.

## role

Parked, and PINNED - two separate claims.

				   role tells the bridge to count this shard as covered so roamers
				   leave it out of their beats. Claiming 'roamer' while never
				   hopping would be worse than saying nothing: the bridge deals the
				   unparked shards between self-declared roamers, so a roamer that
				   never moves silently shrinks every real roamer's beat and its own
				   share goes unwalked.

				   pinned says the assignment is not the bridge's to make. Parked
				   scouts are normally reassigned greedily by score, and a merchant
				   that accepted one would advertise coverage of a shard it is not
				   standing on - which is worse than no claim, because roamers would
				   then skip a shard nobody is watching.

## scoutDropBuffer

Everything still unsent, dropped, with a count of what went.

  THE BUFFER IS NOT WORTH CARRYING ACROSS AN OUTAGE, and this is measured
  rather than assumed. The MerchantScout sweep with the bridge down took
  1338s against 241s with it up, and the per-hop cost CLIMBED by about 14s
  each time: every failed post leaves another bucket, every bucket costs the
  7s minimum post gap, and the report runs twice per hop. The character gets
  slower the longer the outage lasts, which is the opposite of degrading
  gracefully.

  And the data it is paying for is worthless by the time it lands. A stand
  list held through a ten-minute outage describes a market that has moved on;
  re-posting it would overwrite a shard with observations older than the ones
  already there. Better to go quiet and start fresh when the bridge returns.

  The immediate retries above are a different thing and are kept: those
  re-send data that is seconds old, to a bridge that answered. This only
  discards once that has been spent.

## scoutNextShard

Where to go next, steered by the bridge rather than a blind round-robin.

  Two hints come back with every accepted scan:
    parked   - shards a stationary scout is holding. Those are being reported
               continuously, so visiting one spends the rotation re-collecting
               data the bridge already has fresher than we could make it.
    rotation - every shard the bridge knows, ordered oldest observation first.

  Shards the bridge has never heard of outrank everything, since "no data at
  all" is staler than any timestamp. With no reply yet - first run, or the
  bridge down - this falls back to the plain round-robin, which is what a lone
  scout effectively gets anyway.

## beat

A beat of this roamer's own, dealt by the bridge so two roamers never
walk the same shard. Preferred over `rotation`, which every roamer
receives identically and which therefore sent them all to the same head.
Falls through when the bridge is older, or when there are more roamers
than free shards and someone's beat is empty - overlap is unavoidable
then, and standing still is worse.

## scoutGoToScanSpot

Stand where the stands are before reading them.

  Entity visibility is a radius. Two readings of it disagree - a stand was once
  seen at 699+ units and still climbing, while a controlled walk-out later put
  the unload boundary between 566 and 619 - and neither has been reconciled.
  Drifting between spots is cheap and covers both, so WHERE the scan
  happens decides what it sees. change_server drops the character wherever it
  left off, and an anniversary kiss can end anywhere on the map, so without
  this the scout would hop and scan from some arbitrary corner and report a
  near-empty shard as fact.

  Reuses CONFIG.stand.candidates rather than deriving a spot: that list is
  already tuned to the merchant plaza on this account, and it is where the
  stands being scanned actually are.

## two-phases-never-in-one

Two phases, never in one continuation, because a hop ends the script.

  TICK A - we are somewhere unscanned: travel, sweep, read Ponty, report, and
           record the shard as done. No hop.
  TICK B - this shard is already reported: hop. Whatever follows is unreachable
           in a browser tab, so nothing follows.

  The previous single-pass version did hop-then-scan, so in a tab it hopped,
  the page reloaded, and the scan and report were simply never reached. It
  rotated shards forever and posted nothing - matching exactly what was
  observed: constant hopping, zero POSTs, and the only report being the one
  scoutGoHome sends BEFORE its hop.

## scoutHeldScan

Keep this shard's listings current while a probe holds the merchant.

  Scan and report only - no travel, no Ponty trip, and never a hop. The
  no-travel rule is the important one: a probe may have walked the merchant
  600 units out to measure the trade distance, and dragging it back to the
  plaza mid-measurement would ruin the reading.

  That also means the scan is SKIPPED rather than taken from wherever the
  character happens to be standing. A sweep read from a corner reports a
  near-empty shard as fact, and a scan REPLACES its shard on the bridge - so a
  lazy read here would not just be useless, it would destroy good data.

## the-gate-is-now-can

The gate is now "can I see the whole stand region", not "am I within 60
   of the first stand candidate". The old test tied scanning to one point;
   this ties it to whether the reading would be complete, which is the
   thing that actually matters when an empty scan replaces a shard.

## home

This shard is already scanned. Roaming would hop to the next one here;
   parked, there is no next one.

   Off-home and idle means whatever took us here - a delivery, a finished
   trade - is done, so go back and hold the party's shard. The scan above
   has already run by then, so the trip out still contributed a reading;
   that is the whole of "scouts while doing its normal work", and it is
   opportunistic by nature. Note it will not fire mid-delivery or mid-trade:
   both hold state.busy (or ARB.cur) for their duration and scoutLoop stands
   clear of them deliberately, which is a guarantee worth more than an extra
   reading.

   At home, scoutHeldScan re-reads and re-posts on its own cadence, which is
   what keeps the shard from ageing out of the bridge. `scanned` is a
   one-shot latch, so without it a parked scout would post once and go
   quiet.

## gated-on-enabled-not-just

Gated on `enabled`, not just spaced out. Without this the probe kept
	   polling /health every reprobeMs with scouting switched off - pointless
	   traffic, and worse, its log line reads "bridge up - scouting enabled"
	   while scouting is in fact disabled, which is the sort of thing that
	   sends someone looking for a bug that is not there.

## a-scout-cycle-awaits-smart

A scout cycle awaits smart_move and change_server, and smart_move can
hang indefinitely on an unreachable path. state.busy is the merchant's
only mutual exclusion, so one stuck await silently freezes deliveries,
the stand and the anniversary kiss along with scouting - which is
precisely what an 8 minute silence after a single post looks like.
Release the lock and let the next tick start over; the abandoned
promise clearing it again later is harmless.

## a-probe-is-measuring-never

A probe is measuring. Never hop - a hop reloads the page and
would take the probe and its half-collected findings with it -
but DO keep scanning this shard and posting it.

Standing down entirely was wrong and self-defeating: holding
stopped the only thing that feeds the bridge, the bridge aged
out to zero stands, and arbProbeFindBuy/FindSell - which exist
precisely to read that data - silently fell back to whatever
was in the plaza. The hold was starving the probe it protected.

## ARB

Buy on one shard, sell on another, and survive being killed halfway.

  THE CONSTRAINT THAT SHAPES EVERYTHING HERE
  change_server reloads the page, which destroys every variable in this
  script. A cross-shard trade contains two of those reloads, and between them
  the merchant is holding an item it has paid for. So the trade lives in CODE
  storage, not in memory, and every phase is written BEFORE the hop that ends
  the script rather than after it. This file has been bitten by that twice
  already - the scout hopped before it scanned, and the probe hold evaporated
  on the reload it was meant to survive - and those only cost data.

  ONE STEP PER TICK. A phase does its work, records the outcome, and returns.
  Nothing chains a hop onto anything, because nothing after a hop runs.

  PHASES
    picked   a flip chosen, nothing spent   -> travel to the buy shard
    at_buy   on the buy shard               -> verify, then buy
    holding  item bought, gold spent        -> travel to the sell shard
    at_sell  on the sell shard              -> verify, then sell
    sold     gold received                  -> bank the share, then finish

  From `holding` onwards the trade is no longer optional. Gold has become an
  item, and the only ways out are selling it or banking it - never simply
  forgetting it, which would leave the ledger reporting an open trade forever
  and the merchant carrying stock nobody decided to keep.

## arbUsedKey

Listings this merchant has already traded against, and when they stop being
  suppressed. Keyed by shard|target|slot so the same merchant's other slots
  stay available - emptying one of a stand's six trade slots says nothing
  about the other five. Persisted, because the cooldown has to outlive the
  page reloads a trade causes.

## arbFailKey

Counterparties that keep failing, and how long to leave them alone.

  arbMarkUsed only fired on a CONSUMED listing, so an always-gone listing was
  re-picked the moment it reappeared. Measured 2026-09-21: Kazhag on EU I,
  slice_mint at 100,000 in all four slots, re-listed every couple of minutes,
  five trades opened inside 90 seconds, all abandoned at slot_gone, 707 on the
  day. No gold cost, since verification precedes the buy; throughput is.

  Keyed on shard|target, not the slot: four slots advertising the same item
  would otherwise burn four cycles before that stand went quiet. It does hold
  off the seller's other goods, which is right when the race is with them.

  Escalating, because a flat cooldown only makes a duty cycle - quiet, then
  another burst of doomed trades, forever. Doubling drops a stand we never win
  out of rotation while keeping one we sometimes win. Cleared by a success.

## arbApproach

Close enough to trade. A stand's trade slots stay fully readable right to the
  edge of visibility - there is no inner radius where you can see a stand but
  not read its prices - so there is nothing to gain from closing the last few
  hundred units. Already inside CONFIG.arbitrage.approachUnits counts as
  arrived, and the commonest case is that no movement is needed at all.

## past-the-in-range-return

Past the in-range return, so this only fires when we are actually going
to move. travelTo() is where stand safety normally lives, but the
executor does not use it - it smart_moves straight to a counterparty,
which is how a stand stayed open across a walk and a shard hop. Seen
live 2026-09-21: stand0 open, state.standOpen true, moving true, with a
trade picked for another shard.

## arbBankShareNow

Deposit the banked share, then return to the scan spot before anything else
  happens - the agreed rule. The bank is a door off the same map as the scan
  spot, so this is a short walk, measured at about six seconds for the round
  trip. Both legs are recorded: a deposit that happened but was not logged
  would quietly drift the running total.

## arbBankItem

Put an unsold item away rather than carry it. Inventory space is the scarcer
  resource, and an item in the bank is still an asset the ledger can account
  for - see the "abandoned" status, which keeps its spend out of realised P/L
  rather than reporting it as a loss.

## put-the-stand-back-once

Put the stand back once the trade is done.

	   shouldHoldStand() already says a stand and an in-flight trade do not
	   belong together, but only openStandAtBestSpot() consulted it, so the
	   rule only ever governed OPENING. Nothing closed the stand when a trade
	   started and nothing reopened it afterwards - every other reopen hangs
	   off a delivery batch, the gear loop, the kiss, a hop home, or script
	   load, none of which an arbitrage run touches.

	   The guards matter: shouldHoldStand() inside refuses while ARB.cur is
	   set or we are off the home shard, and standOpen stops this re-issuing
	   open_stand on every tick.

## nothing-in-this-section-runs

Nothing in this section runs on its own. Every function is called by hand
  from the Adventure Land code console while the merchant stands somewhere
  useful, and the results are read off the log.

  WHY A PROBE AT ALL
  The trade API is the one part of the arbitrage plan this codebase has never
  exercised. The obvious move is to write trade_buy(target, slot) and see what
  happens, but the last constant assumed in this project - Ponty's asking
  price - was wrong by a factor of two and took three rounds to catch, and
  that one only cost a wrong number on a webpage. This one spends gold. So
  the API is DISCOVERED: arbProbeFns and arbProbeSrc read the real function
  list and the real source, including the socket payload each one emits, and
  the operator builds the first call from that rather than from memory.

  SAFETY
  arbProbeCall is the only function here that can move gold. It refuses a slot
  priced above CONFIG.arbitrage.probe.maxPrice, demands an explicit confirm
  string, and reports the gold delta whether it succeeded or failed - a failed
  call is data too, since a rejection at a known distance is how the trade
  range gets measured without paying for it.

  Everything else reads, or walks.

  Procedure: Codex/PHASE0_PROBE.md.

## MERCHANT_BUILD

WHICH BUILD IS ACTUALLY RUNNING.

  A redeploy returns "queued", not "confirmed", so a reader needs a way to
  check that the code answering is the code just written. This file has form
  here: the v24 header survived thirteen commits of changes and led a handoff
  to record the file as untouched.

  So two answers, of different quality. `build` is a hand-bumped string and
  can go stale exactly as that header did - treat it as a hint. `api` is the
  live list of probe functions the running script actually exposes, and it
  cannot lie: if arbProbeDistanceCheck is in it, the build is at least the one
  that introduced it. Feature-detect against `api`, read `build` for context.

## arbitrage-2

Read from CONFIG, never transcribed into the build string. An earlier
version spelled the flags out in that string, which made a hand-kept
note the thing a reader checked before deciding whether a rehearsal
could spend gold - and a note that has to be kept in step with two
constants is a note that will eventually disagree with them. This
cannot: it is the value the executor itself consults.

## arbFetchJson

A market view from outside this character.

  ALData first, our own bridge second. The order is deliberate and was learned
  the hard way: holding the merchant for a probe stops OUR scouting, at which
  point the local bridge is the *worst* available view of the market rather
  than the best - one shard, frozen at whatever it last saw. ALData keeps
  covering every server regardless of what this merchant is doing.

  Both serve the same row shape, so neither is a special case. Returns the
  rows and says which source produced them; callers stamp that onto results so
  nobody has to infer it from the shape of an answer.

## o

no-store, and a cache-buster on top of it.

   Without this the browser serves its cached /merchants copy indefinitely,
   and the failure is silent in the worst way: a cached response carries a
   cached lastSeen, so ageSec is computed against a frozen timestamp and
   EVERY row reads as fresh forever. sellMaxAgeSec cannot catch it - the rows
   it is handed are, by its own measure, seconds old.

   Measured live on 2026-09-21. The executor spent hours re-picking
   Kazhag|trade1|EUI, a stand that had already left the market: ALData polled
   directly showed no Kazhag at all and the bridge held zero merchant rows,
   while the executor opened a FRESH trade against him every ~18 seconds and
   abandoned it at slot_gone. 399 abandons against 45 closed trades, and the
   two dominant reasons - slot_gone and not_loaded - are the same fact seen
   twice: counterparties that had left a market this copy never stopped
   describing. It costs almost no gold, because verification fires before any
   buy; it costs nearly all of the throughput.

   no-store covers this browser, the query param covers anything between here
   and the origin.

## arbMergeMarketRows

One row per merchant per shard, taking whichever source saw it more
  recently.

  This used to be winner-takes-all: 'auto' asked ALData, and if ALData
  answered with anything at all the bridge was never consulted. That was the
  right call while our scouts did not exist - ALData covers every shard
  continuously and a lone rotating scout produces a rolling snapshot of one
  shard at a time, so preferring ours wholesale meant reading the worst view
  of the market rather than the best.

  It is the wrong call once scouts are running. Freshness is not a property of
  a source, it is a property of a row: on the shard a parked scout is sitting
  on, our data is seconds old and ALData's is whatever its own refresh cadence
  gives; three shards away the opposite holds. So both are fetched and merged
  per merchant per shard, and the newer row wins.

  A union, not an intersection. A merchant only one source knows about is
  kept: absence from a source is not evidence of departure, because neither
  source claims to have looked everywhere. Only a CONFLICT is resolved, and
  only by age.

  A row with no readable timestamp always loses to one that has an age, for
  the same reason pAgeSec exists - an unknown age must never sort as fresh.

## arbProbePontyRows

Ponty's stock, from the local bridge, across every shard a scout has read.

  Always the bridge - ALData does not carry Ponty, which is exactly why this
  matters. It is the one buy source that is genuinely private: every spread
  visible on the public board is visible to everyone querying it, and Ponty's
  stock is not on that board at all.

  It is also the only buy leg with no counterparty risk. A player merchant can
  pack up between reading their price and arriving at their stand; Ponty
  cannot. His stock rotates, so a listing can still be gone - but he is always
  there, which removes the failure mode that makes a cross-shard round trip
  risky in the first place.

## arbProbeFindBuy

Candidates for the BUY leg, taken from what the scouts already recorded
  rather than from whatever happens to be standing here.

  Ordered by AGE, not by price. The cheapest listing on the board is worthless
  if the seller packed up twenty minutes ago, and every candidate here is under
  the probe cap anyway - so the question is not "which is cheapest" but "which
  is most likely to still be there when we arrive". Price breaks ties.

  Falls back to the in-view scan when the bridge is down or has nothing.

## local

Stamped and wrapped in an array. Returning a bare object here once
read as "the finder returns the single best candidate" rather than
"no market feed was consulted" - the opposite conclusion, and the one
that matters.

Falls THROUGH rather than returning: Ponty comes from the bridge, and
the bridge can have his stock while having no merchant rows at all.
Returning early here skipped the one buy source that is still ours
when the public feed is down, which is exactly when it matters most.

## arbProbeFindSell

Candidates for the SELL leg - the taxed one, and the one that otherwise
  stalls for want of a counterparty.

  Cross-references the merchant's OWN INVENTORY against every buy order the
  scouts have seen, so the question stops being "will someone turn up wanting
  what I bought" and becomes "who already wants something I am holding".
  Matched on name, level and special, the same way the watchlist groups them -
  a level 0 buy order does not pay for a level 3 item.

  Ordered by price, highest first: the tax measurement needs two sales at
  clearly different prices, and the top and bottom of this list are exactly
  that pair.

## FRESH

Freshness FIRST, then price. Sorting on price alone was wrong and it
showed: a four-day-old buy order for 60,000 outranked a 98-second-old one,
and the older merchant is long gone. A high price on a dead listing is not
a better trade, it is not a trade. findBuy already ordered by age; this
did not, which was simply an inconsistency.

## arbProbeWhyNoSell

Why findSell came back empty.

  "20 buy orders exist, none of them match" is a conclusion, not an
  observation, and the two things it could mean need different responses: a
  real gap in the market, or a matching rule that is too strict. So show the
  working - what is held, what is wanted, and in particular the NEAR MISSES:
  the same item name at a different level or special.

  A near miss is the informative case. A pile of them means the level+special
  match is throwing away trades; none at all means the market genuinely does
  not want what this merchant is carrying, and the sell leg has to wait.

## arbProbeFindFlips

THE MONEY QUERY: every buy-side listing that some player is paying more for
  than it costs, after tax, right now.

  This is the whole arbitrage thesis in one function. Buy side is player
  stands plus Ponty; sell side is player buy orders. Both sides must be fresh,
  because a spread between two dead listings is arithmetic, not an
  opportunity.

  Net is per unit and taxed on the sell leg only - the buyer pays the listed
  price, we receive gold from another account and are taxed on it:

      unitNet = sellPrice * (1 - taxRate) - buyPrice

  Quantity is capped by both sides: Ponty's stock and what the buyer will
  take. Profit is unitNet times that, so a thin margin on a large order can
  outrank a fat one on a single item - which is usually the real shape of
  this.

  A note on Ponty specifically: he sells at calculate_item_value times
  secondhands_mult, which is above what a vendor pays for the same item.
  Buying from Ponty to vendor is therefore always a loss, and the only
  profitable exit is a player buy order. That is not a limitation, it is the
  reason to look: those buy orders are on the public board but Ponty's stock
  is not, so the pairing is not one everyone else can see.

## show

QUIET MODE - for arbLookForWork, which calls this on every look.

   This began life as a hand-run probe and kept its probe manners: it ends
   in pShow(), which opens a modal, and narrates itself through pLog().
   Harmless when a person types it; not harmless on a 30-second beat. The
   operator watched modals stack up on screen all morning - and pLog also
   writes probe_log, which is capped at 200, so the automated caller was
   evicting the operator's own probe history in under two hours.

   Quiet suppresses the display and the narration and nothing else. The
   return value is unchanged, so the caller sees exactly what it saw
   before, and a probe run by hand still shows and narrates as always.

## missed

Count what freshness throws away, and how narrowly.

   Without this a tightened window is indistinguishable from a quiet market:
   both produce "no flips". The freshest REJECTED age is the useful half - if
   the best thing on the board missed by thirty seconds the window is too
   tight, and if it missed by an hour the window is doing its job.

## arbProbeNamed

The named check. Object.keys does not see identifiers declared in the
  runner's own scope, so the ones that actually matter are referenced
  directly and the ReferenceError caught. Verbose on purpose: a missing name
  here is a real finding, not a gap in the scan.

## arbProbeSrc

The most valuable single output of Phase 0. A runner function is a thin
  wrapper around a socket emit, so its source names the event and the exact
  payload keys - which is the argument order and shape, straight from the
  game, with nothing inferred.

## arbProbeStands

Every visible stand with its distance, so the operator can see what is in
  reach before touching anything. Deliberately built on the same reader the
  scout posts from, so what the probe sees and what the watchlist shows are
  the same rows.

## arbProbeInv

Inventory headroom. esize is the number the purchase gate will read, so it
  is worth confirming it means what it is assumed to mean rather than
  trusting the name. Stack counts are reported alongside because a stackable
  purchase may need no new slot at all.

## arbProbeBank

Walk to the bank, read what is actually there, and walk back - timed, since
  the agreed rule is that every sale is followed by a bank visit before
  scouting resumes, and that rule is only affordable if the trip is short.
  Reads only: no deposit, no withdrawal.

## stand-exactly-dist-units-from

Stand exactly `dist` units from a target stand, on the line between here and
  there. This is the distance walk-in: call it at decreasing distances and
  retry the trade at each, and the first distance that stops being rejected
  is the real trade range. Nothing about it is guessed or hardcoded, which is
  the point - whatever the number turns out to be, and whenever it changes,
  this measures it again.

## pDist

Distance, computed here rather than through the game's distance().

  distance(character, {x, y}) was returning numbers that had nothing to do
  with the real separation - 208 when the true gap was 1307, 47 when it was
  708 - so a plain {x,y} is evidently not what it expects. Whatever it does
  with one, this is eight lines of arithmetic and it cannot lie. Different
  maps are not comparable, so that returns null rather than a number.

## arbProbeDistanceCheck

How far apart are distance() and plain arithmetic, and why?

  MEASURED, not theorised. distance() is edge-to-edge: it subtracts one
  entity's base for a bare {x, y}, and both bases when handed two whole
  entities. Readings from a stationary character at (240,-90):

      same two points, bare {x,y}   game 287  arithmetic 300   short by 13
      same two points, whole entity game 273  arithmetic 300   short by 27
      an NPC                        game 264  arithmetic 284   short by 20
      1000 units due east           game 987  arithmetic 1000  short by 13

  So it can never equal centre-to-centre arithmetic, and an earlier version of
  this function called that disagreement and printed it in red. That was the
  wrong question: the merchant's long-standing calls ask "am I close enough to
  interact", which is exactly what edge-to-edge answers. No rewrite warranted
  there, and none was made.

  What this now checks is that the offset stays small and one-directional. A
  large gap, or arithmetic coming out SHORTER than the game's figure, would
  mean something other than collision geometry and would be worth chasing.

## arbProbeVerify

Is this listing real, here, now?

  A listing on ALData seven seconds old was walked to and was simply not
  present - no entity, no slots, nothing at the coordinates. The public feed
  carries stands that have already gone, and the merchant would otherwise hop
  a shard on the strength of one.

  So every flip verifies against the live client before any gold moves: the
  target loaded, the slot still holding the same item at the same price and
  side. A price that has moved is not a smaller opportunity, it is a different
  trade that has not been evaluated.

## show-2

Quiet, as arbProbeFindFlips in v37 and for the same reason: a hand-run
   probe the automated path also calls. arbStillThere verifies both legs of
   every trade, so each attempt opened a modal per leg - twelve identical
   boxes were stacked when this was found. Return value unchanged; the
   reason still reaches the ledger.

## arbProbeStep

Stand `dist` units from a target, and REPORT WHETHER IT ACTUALLY HAPPENED.

  The previous version claimed success while standing still. It awaited
  move(), which walks only in a straight line and, when the path is blocked,
  neither moves nor throws - so the smart_move fallback in the catch never
  ran. It then measured with the game's distance() against a plain {x,y},
  which returned a number unrelated to the real gap. Two independent faults,
  and between them it reported "standing 208 units from Griffin" while parked
  1307 units away and never having moved.

  So: smart_move first, since it is the one that pathfinds; positions read
  before and after; distance computed here; and the result says plainly
  whether the character moved at all. A caller must be able to distinguish
  "in position" from "still where it started but told otherwise".

## arbProbeCall

THE ONLY FUNCTION HERE THAT CAN MOVE GOLD.

  o = {
    fn:      'trade_buy',        // name discovered by arbProbeFns/arbProbeSrc
    target:  'SomeMerchant',     // stand owner, resolved to an entity
    slot:    'trade1',
    extra:   [1],                // anything after (target, slot) - e.g. qty
    leg:     'buy' | 'sell',     // 'buy' enforces the price cap
    confirm: 'YES'
  }

  Arguments are assembled as [entity, slot, ...extra]. If the source dump
  shows a different order, pass o.args directly - that path skips the price
  check, so it needs confirm 'YES-UNCHECKED' and the operator owns the risk.

  Gold, inventory and the counterparty's slot are recorded either side of the
  call. A REJECTION IS A RESULT, not a failure: the distance walk-in depends
  on collecting rejections, and the exact reason string is what the Phase 1
  error handling will have to branch on.

## the-whole-reason-for-the

The whole reason for the cheap trade. For a buy, anything paid beyond the
listed price is tax (or a fee by another name); for a sell, anything
short of it is.

Only on a resolved call that moved gold. A rejection moves nothing, and
deriving a "fee" from a zero delta produces a confident -100% that reads
exactly like a measurement and is not one.

## arbProbeNpcSell

Does calculate_item_value actually predict what a vendor pays?

  Not a tax measurement - NPC sales are untaxed, which is settled. This exists
  because Phase 1 has to CHOOSE a sell side: a player buy order is only worth
  taking once it clears the vendor's price by more than the tax, so
  calculate_item_value sits directly in the go/no-go comparison. This project
  has already been burned once by trusting that function's output for Ponty
  and being wrong by half, and that time it only misprinted a webpage.

  Cheap to check, and it needs no counterparty - every other measurement here
  waits on a stranger standing in the plaza with the right goods.

  idx is an INVENTORY SLOT NUMBER, not a name. Refuses gear-plan items and
  anything worth more than the probe cap.

## FILTERS

GAME LOG FILTER
============================================================================
The same filter bar the other three characters run. Guarded on parent.$
because this script also has to load where there is no game DOM at all -
on Mainframe there is no #gamelog to hang a tab bar on, and every call
below would throw on a null element.

Tab defaults are inherited rather than re-tuned for a merchant. The one
thing worth knowing: initTimestamps() takes over the socket's 'game_log'
listener wholesale, so from here on every server-pushed log line arrives
stamped. The merchant's own game_log() calls are unaffected - those go
through the client function, not the socket event.

## noise

Routine client chatter that says nothing actionable during farming.
		   Off by default, but a tab rather than a hard suppression so each
		   can be read back when it IS the question being debugged.

		     get closer  - emitted on every out-of-range action attempt.
		                   Measured on Dexon: 80 of 289 entries in a
		                   four-minute sample.
		     AP[...]     - achievement progress. A counter that resets on the
		                   wrong kind of last hit repeats the same fraction
		                   indefinitely rather than counting up - firehazard,
		                   which wants 20,000 CONSECUTIVE burn last-hits, sat
		                   at "1/20,000" on Dexon for exactly that reason.
		     scared /    - the courage mechanic. Merchants carry courage 1
		     terrified     and mcourage/pcourage 0, so a single magical or pure
		                   attacker frightens them outright. Rarely relevant
		                   standing in town, which is the point of hiding it.

## observeGamelog

Not every line in #gamelog comes through addLogEntry. The socket hook
	   below only replaces the `game_log` listener; the client writes others
	   itself through add_log, and those arrive as .gameentry nodes with no
	   inline display set - which is exactly how "Get closer" was slipping
	   past the filters. They were only ever hidden by filterGamelog(), so
	   they stayed visible until something happened to toggle a tab.

	   Watching for added nodes covers both paths, so the filter bar now
	   governs the whole log rather than only the half this code writes.
