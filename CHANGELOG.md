# Merchant.js changelog

Meltymerch (Merchant) - CODE slot `CH_aLtHealaSgKdmOsDWpNl8scE9NhXk`

Moved out of the Merchant.js header on 2026-09-21. Adventure Land will not run a
CODE slot past roughly 240 KiB (245,760 chars): v37 at 244,398 ran, v38 at
247,463 was accepted by save_code and then silently never evaluated - the runner
came up with `character` defined and every script function undefined, with
nothing in the console. The changelog had reached 9,255 chars of that budget, so
the file was one ordinary commit from failing whatever the commit did. It lives
here now, and the header carries a pointer instead.

Newest first. Entries are verbatim from the header they replaced.

## v51

one closer, one opener.

v50 fixed the rate of stand churn. This fixes the RACE, which v50 did not
touch: measured 2026-09-25, travelToBank closed the stand correctly - the spy
caught the close - and something reopened it 1.2 seconds later, mid-walk. He
finished the trip to the bank at speed 10 with state.busy false, no trade in
flight, and nothing claiming to be doing anything.

WHAT THE INVENTORY SHOWED, and it was not what was expected. All 14 movement
call sites live in 7 functions, and every one of those 7 ALREADY closed the
stand. There was no mover that forgot. The only close-side gap in the whole
file was mHopTo, which changes shard without closing. So consolidating the
closers - which is the obvious fix and the one asked for - would have fixed
almost nothing on its own.

The gap was on the open side: six reopen sites, none of which checked whether
the character was walking, two of them firing on timers.

CLOSER. travelBegin/travelEnd plus moveTo / moveTown / moveNudge. Every mover
routes through them. The load-bearing part is not the close - that was already
universal - it is that state.travelling is held for the WHOLE duration of the
move rather than only its first instant. A close-before-move wrapper closes at
t=0 of an await that runs for minutes and has nothing to say about second 1.2.

state.travelling is a COUNTER, not a boolean, because travel nests: travelTo
falls back to town() and then moves again, and a boolean would clear on the
inner unwind while the outer move was still running.

moveNudge deliberately does NOT close the stand. The two nudge sites
(travelToRecipient's xmove, arbProbeStep's move fallback) are a few units of
in-map repositioning, and closing for those would reintroduce the exact
teardown-per-unit-of-work granularity v50 removed. It still takes the lock.

mHopTo now closes before change_server.

OPENER. Six sites become one. processBatch, gearProgressionLoop,
anniversaryKissLoop, scoutGoHome and resumeInterruptedTrip lose their reopens;
arbLoop's moves into standLoop(). Five were imperative restores ("I closed it,
so I put it back") and arbLoop's was already a reconciler - so the reconciler
is what survives, and it is declarative: if nothing is happening, we are home,
and there is no stand, raise one. Every former caller is covered because they
all end by clearing the flag they took. Cost is up to reconcileMs (4s) of
latency before the stand returns.

resumeInterruptedTrip's call was not even awaited. Deleting it fixes that for
free.

WHY standLoop IS ITS OWN LOOP rather than a line inside arbLoop: arbLoop is a
self-chained async loop and Merchant.js never got noHang() - that shipped in
Ranger v51 / Priest v26 / Mage v50 only. If any await in arbLoop never settles
the chain ends silently, and leaving the sole stand-opener inside it would make
the stand's existence inherit arbLoop's liveness. The redundancy that would
currently mask such a hang is exactly what collapsing six openers into one
removes, so the two changes must not be combined.

PROBE.hold is now honoured. The old arbLoop line sat outside that guard, so a
probe hold stopped everything except stand churn. As the sole owner that
inconsistency would have become the only behaviour.

state.standSuppressed added: the reconciler opens whenever idle-and-home-and-
down, which loses the wasStandOpen intent the old restores carried. Without an
explicit flag there would be no way to keep the stand down while idle at home.

No harness in this repo, so the lock and the guard were extracted and run
standalone: 22 cases, including nesting, release-after-throw, nudge-does-not-
close, and a direct reproduction of the bug (a reconciler check during an
in-flight move must not fire). All pass.

NOT FIXED HERE, observed live while writing this: the stand was found open at
(-179,-72), which is CONFIG.townSpot and 106.9 units from the nearest candidate
spot against a 20-unit threshold. That is travelTo's tail returning true after
the town() fallback without verifying arrival, so openStandAtBestSpot believes
it reached a candidate and opens where it stands. Known since 2026-09-24, still
unfixed, and unrelated to the stand race.

## v50

stand thrash: stop paying a cross-town round trip per gear step.

MEASURED, not read. A stand spy wrapping open_stand/close_stand recorded 3 opens
and 3 closes in 33 seconds, and the console carried twelve unbroken minutes of
`smart_move: main 100 0` alternating with `smart_move: main -179 -72`.

Two wrong diagnoses died on the way, both recorded here because the reasoning is
the reusable part:

- "Two loops fighting over the stand with no lock." Wrong. gearProgressionLoop
  and anniversaryKissLoop both guard on state.busy and they alternate correctly.
  The stack traces showed both loops touching the stand, which is not the same
  as showing them racing.
- "The loop spins doing nothing." Also wrong. attemptBestPlanStep returns false
  when no candidate has an affordable available step, and the gate above it only
  checks that candidates EXIST - so a uselessly spinning loop was plausible. It
  is not what was happening: firebow at level 4 toward target 9 was a genuinely
  eligible upgrade at 40,000 gold, affordable, every single tick.

The real fault is granularity. gearProgressionLoop ran every 8s and performed
exactly ONE step per cycle, with a stand teardown and rebuild wrapped around it.
So one 40,000-gold upgrade attempt cost a close, a speed-clamped walk to
(-179,-72), and a walk back to (100,0) to reopen. Firebow needs five more
levels, so this was set to continue indefinitely.

Three changes:

- CONFIG.stand.minDwellMs (3 min) and state.standOpenedAt, with standDwellHeld()
  gating gearProgressionLoop. A floor, not a lock - callers still decide whether
  they want the stand. Arbitrage is deliberately exempt: a trade in flight has
  gold committed to a destination and has to travel.
- gearProgressionLoop batches up to CONFIG.gearProgression.maxStepsPerVisit (12)
  steps per visit instead of one. Both inner calls re-read character.gold and
  both return false when nothing is affordable, which ends the visit.
- gearProgression.intervalMs 8000 -> 30000. 8s was never sensible for a loop
  that crosses town.

NOT fixed here, because it was not measured: anniversaryKissLoop sets
state.kissAttemptedFor only on SUCCESS, so a kiss that keeps failing retries
every 5s forever, tearing the stand down each time. The kiss path was dormant
(findFeaturedPlayerName() returned null) when the driver was identified, so
there is no evidence it is currently misbehaving and no fix is being shipped on
a guess. The minDwellMs floor would blunt it; wiring the kiss to respect the
floor needs thought, since an event round is only 5 minutes long.

Throughput note: worst case is now 12 steps per 3 minutes (4/min) against the
old 1 step per 8s (7.5/min), in exchange for roughly one walk instead of
twenty-two. Raise maxStepsPerVisit if the ceiling ever binds.

## v49

Backfilled 2026-09-25 from commit 0a59254; shipped without an entry.

make the stranding breaker actually stop, and cap nightberry.

The breaker had never once stopped a trade. It fired 18 times across two days -
"executor stopped itself after 2 ... 3 ... 4 ... 5 ... 6 ... 7 consecutive
strandings" - and trading continued straight through every time.

Cause: it only set CONFIG.arbitrage.enabled = false, which is in-memory, and
change_server RELOADS THE PAGE. The next shard hop rebuilt CONFIG from the saved
build and undid it. The stranding COUNTER is persisted, which is why it climbed
2 -> 7 instead of resetting: it re-tripped one higher on each hop. Same root
cause as three other bugs found that week - state that does not survive the
reload.

71,981,480 of gold went into unsold stock behind it on 2026-09-23 alone, against
24,275,984 of profit over the same window. Every closed trade was profitable;
the losses were all in capital that stopped being liquid.

The halt is now persisted in CODE storage and bounded three ways, so a stored
stop can never outlive its usefulness - which is what the existing "no runtime
toggle for enabled" rule was protecting against, and why this is not simply a
persisted flag:

  - it expires after haltMs (1 hour)
  - it is ignored when MERCHANT_BUILD has changed, so a redeploy clears it and a
    build can never ship silently halted
  - arbProbeHalt(false) clears it by hand and resets the counter

SECOND CHANGE: CONFIG.arbitrage.itemCapitalCap, a per-item ceiling on what one
trade may spend. slice_nightberry set to 10,000,000. It earned 5,560,000 on
closes while stranding 62,100,000 - including a single lot of 52 units for
46,800,000 that found no buyer at all. Three days of data said the same thing:
7.8%, then 8.5%, on more deployed capital than every other item combined. Not a
bad spread - a thin spread bought in sizes this market cannot absorb. The cap
would have blocked that 46.8M lot outright.

KNOWN DEFECT, found 2026-09-24 while diagnosing something else: MERCHANT_BUILD
was never bumped across v45-v49 and still reads "v27 / arb.4 / 2026-09-19". The
build-changed test above therefore never fires, so a halt DOES survive a
redeploy. The escape hatch is inert until that string is maintained.

## v48

Backfilled 2026-09-25 from commit d4ccc80; shipped without an entry.

close the stand before the anniversary kiss chase.

Caught in the act: Meltymerch walking out to the party's farm spot with his
stand still deployed. The server clamps speed hard for that, in node/server.js:

    if (player.p.stand || player.s.hardshell) player.speed = 10;

A quarter of his normal pace, for the whole trip.

Audited every mover in the file rather than patching what was in front of me.
travelTo() already closes the stand itself, so all eight of its callers were
covered, and the six raw smart_move sites each had an explicit close - except
two, both inside attemptKiss(). The first read of this blamed
openStandAtBestSpot(); that was wrong, it goes through travelTo and is fine.

attemptKiss is the worst possible place for the gap. It chases
parent.S.anniversary.target, who can be anywhere on the map - including standing
next to the party at crabs - and the chase loop reruns for a full 30-minute
featured round, re-issuing smart_move every couple of seconds.

Second change, same function family. The stand candidate list is tried strictly
in order and the spots are deliberately spread out "in case one spot is
blocked", so ending up on candidate 3 is a normal outcome.
openStandAtBestSpot() would then march him back to candidate 1 on every call -
closing the stand to travel, reopening at the far end, for no gain over the
perfectly valid spot already under his feet. It now tries whichever candidate he
is already standing on first.

NOTE, 2026-09-24: this did not cure "the merchant is moving with his stand out".
It closed two real gaps, but the dominant cause was gearProgressionLoop's
teardown/rebuild cycle - see v50.

## v47

Backfilled 2026-09-25 from commit bf89752; shipped without an entry.

stop the merchant selling arbitrage stock at a loss. Two ends of the same hole,
both found by tracing where 63.5M went.

1. RESERVE PRICE on the fallback exit. arbFindBuyerFor runs after the planned
buyer fails, and it took the best bid on the board with no reference to what the
goods cost - its own comment said the question had become "is there any exit at
all". On 2026-09-22 it bought feather0 x331 from Zintaro for 82,750,000 and sold
the lot into MuaBan's 60,000 bid 28 minutes later: received 19,264,200, net
-63,485,800. Every other trade that day was positive; without this one the day
was +75.6M rather than +12.1M.

CONFIG.arbitrage.fallbackMinRecovery (1.0) now floors that exit. Checked against
the real numbers: 60,000 x 331 x 0.97 = 19,264,200 against a need of 82,750,000,
so the bid is refused and the goods are banked instead - already a supported
outcome with its own stranding breaker. The refusal logs, because otherwise
"nobody was buying" and "everyone was buying too cheaply" stay indistinguishable
forever.

2. ARBITRAGE STOCK hidden from both NPC sell paths. Neither sell path knew
arbitrage existed. sellTrash vendors anything on its whitelist on sight; the
aggressive seller vendors nearly anything once free slots drop to 5. Both price
by NPC value, and the slices arbitrage trades in millions vendor for SIX GOLD.
slice_nightberry absorbed 124,200,000 in one day and vendors at 6/unit. Free
slots were 9 when this was found.

Worse, it would have been invisible: NPC sales are recorded nowhere - not in the
bridge ledger, not in the server's trade_history, which logs player trades only.

ARB_HELD_KEY registry, keyed by NAME because stacks move and merge, consulted by
sellTrash, sellAggressivelyIfLowOnSpace and ssVendorBound. Conservative on
purpose: ordinary loot sharing a name with live stock is protected too, which
costs a little vendor gold and risks nothing. Self-healing - a name the bag no
longer carries is dropped on the next read, so a stale entry cannot protect an
item forever.

3. slice_blueberry off the sellTrash whitelist. Arbitrage has paid 2,000,000 for
one; the NPC pays 6. It was on a list of things to vendor on sight.

## v46

Backfilled 2026-09-25 from commit 0574e5a; shipped without an entry.

never buy or sell the two event boxes. marketparcel and anniversarygift are
protected end to end: not vendored, not listed on the stand, not traded by
arbitrage.

Two changes were needed, because PROTECTED_ITEM_NAMES does not do what its name
suggests. It is consulted in exactly two places - the aggressive NPC dump and
ssVendorBound - and arbitrage never looks at it. Not a guess: offeringp had been
on that list since forever and was still bought and flipped for 5,980,935 net.

So NO_TRADE_ITEM_NAMES is a second set, applied at flip INGESTION in
arbProbeFindFlips rather than at the point of sale. A name filtered out of the
buys/sells feed cannot reach any caller, hand-run probes included. The Ponty row
loop gets the same filter.

WHY THESE TWO - measured from the live drop tables and the server's own
chest_exchange (one weighted pick per box, nested "open" recurses, no _bonus
tables for either):

  marketparcel     contents EV  8,232 vendor gold vs unopened NPC value 60 (137x)
  anniversarygift  contents EV 21,907 vendor gold vs unopened NPC value 60 (365x)

Vendoring either unopened throws away almost all of its value, which is the
failure this prevents. The player market pays more again - 23 marketparcels sold
to CrownMerch for 45,999,997, roughly 240x the vendor value of the contents -
but these are being kept rather than sold, so that price is declined knowingly.

Buy thresholds if ever wanted: 8,232 and 21,907. Market is 120-240x that, so no
price near trading justifies buying them to vendor the contents. Chasing the
five 0.0222% rares in a marketparcel is worse - about 900 boxes per rare, 900M
at market, for items whose vendor value is 192k-744k.

## (unversioned) stand sales disabled

Backfilled 2026-09-25 from commit 784cff3; shipped without an entry. Sits
between v45 and v46 and carries no version bump of its own.

Observed in production within ten minutes of deploying v45.

The first pass worked exactly as designed: five vendor-bound stacks listed on
the home shard, each priced at the cheapest competing listing minus 1g and each
above its NPC floor (marketparcel x3 @1999999, anniversarygift x80 @999999, cake
@119, confetti x7 @39, beewings x10 @29). Verified against a fresh market read:
every ourPrice was exactly cheapestOther - 1, and ssCheapest correctly excluded
our own stand.

Then the arbitrage loop hopped Meltymerch to EU III. change_server reloads the
page, and after the reload character.slots had no trade keys at all and none of
the five stacks were in inventory either.

Disabled rather than deleted, because everything except lifetime is measured and
working.

CORRECTED 2026-09-24: the goods were NOT lost, and this rollback was not needed.
The client receives player.cslots, not player.slots (node/server.js:867), and
reslot_player() deletes every trade slot from cslots and repopulates only from
get_trade_slots(player), which returns [] when the stand is closed. So a closed
stand makes trade slots invisible CLIENT-SIDE while the goods remain server-side.
Confirmed live: anniversarygift x39 and marketparcel x2 were still held. The
feature can be re-enabled; v47's ARB_HELD_KEY registry independently fixes the
NPC-dump risk this entry worried about.

## v45

stand sales: the best vendor-bound goods are listed on the stand instead of
being sold to an NPC.

Five trade slots (1-5) are owned by the feature. Every five minutes, and on
each stand open, it ranks everything that the NPC sell paths would otherwise
vendor by what it would actually net sold to a player, and keeps the best five
listed. Price is the cheapest live competing listing minus 1g, floored at
ceil(npcValue / (1 - tax)) so a listing can never net less than the vendor
would have paid; below that floor the item is simply left for the NPC.

FOUR THINGS MEASURED FIRST, none of them guessable from the code:

trade(invSlot, tradeSlot, price, qty) takes a 1-INDEXED trade slot. Slot 0 is
an equipment slot and answers "cant_equip". CONFIG.stand.listing.tradeSlot was
0, so ensureListing() has never once succeeded - every call threw and was
swallowed by its own catch under the message "Likely already listed from a
previous run - not critical". That listing is now on slot 16, clear of the
five this feature owns.

Listing MOVES goods out of character.items and into character.slots.tradeN.
They are therefore already invisible to both NPC sell paths, so the "reserve
five slots from the aggressive seller" this feature was asked for needs no
code at all - the exclusion is automatic.

There is no unlist API. The verified removal is
parent.socket.emit('unequip', { slot: 'tradeN' }), after which the goods
return to inventory and restack. trade(..., 0) answers "slot_occuppied".

Because listing frees an inventory slot and unlisting consumes one, this
RELIEVES inventory pressure rather than adding to it. The guard is therefore
on unlisting while nearly full, not on listing.

Market data comes from the bridge when it has any and the game feed otherwise,
and the bridge's answer is validated rather than trusted: it was reporting
zero listings on every shard while pull_merchants returned 659, and an
unvalidated read would have parked the feature silently.

The cadence runs off a timestamp in CODE storage, not a setInterval, because
change_server reloads the page and would reset any in-memory timer.

## v44

the merchant could not approach anyone he was not already standing next to.

arbApproach opened with pEntity(targetName) and gave up the instant it came
back empty. character.vision is [700, 500] and it is a BOX, so pEntity only
ever resolves someone already close - and a shard hop keeps the old position,
which puts the seller well outside it. Three ticks at 4s each, abandoned in
twelve seconds, never a step taken.

The ledger had been saying this all along and nobody read it that way: 333
abandons on "could not reach the seller: not_loaded" against exactly ONE on
"still N units away". Almost nothing was failing to arrive. It was failing to
set off. That is 43% of 774 recorded trades.

The position was known the whole time and thrown away two steps before it was
needed. The market row carries map/x/y, the flip assembly dropped them, so
arbPlan had nothing to copy - despite its own comment promising "everything the
later phases need is copied in now". Flip and trade record now carry
buyMap/buyX/buyY and sellMap/sellX/sellY, and an unloaded seller means "walk to
where they were last seen and look again" rather than "give up".

Two new reasons separate the cases the old one collapsed: not_loaded_at_last_known
(standing on their spot, still nothing - really gone) and not_loaded_on_arrival
(walked there, still nothing). Plain not_loaded now only means no position was
recorded at all, which for a Ponty row is legitimate - those carry x/y null.

## v43

the game's own merchant feed joins the merge as a third source. POST to
https://adventure.land/api/pull_merchants with an empty body returns every
listed merchant on every shard in one ~300ms call - the data behind the
Communicator's "All Merchants" panel. arbFetchGameMerchants maps it into
aldata's row shape and arbMergeMarketRows now takes three arrays instead of
two. Nothing else changed: age still decides, so the bridge wins whenever it
has a row and aldata wins while it is fresher.

It is a CONFIRMER and never a denier, and that distinction is the whole
design. The obvious use - drop an aldata row when the merchant is absent from
the game feed - was tested and rejected. Sampled against in-game vision on US
IV every 15s for 226s: Tricksy and Gn. Spence stood with open stands for the
entire window and never appeared in the feed once, while its US IV count fell
from 10 to 7 as the stands actually visible held at 11-13. It sheds merchants
who never moved. Not the appearance lag, not map, position or afk state - all
ten were on main, PhatTrader at -150,-70 sits inside the cluster of merchants
that ARE listed, and AceShop and CrownMerch are afk=true and excluded anyway.
Sampling or rotation fits; the mechanism is unknown. An absence-veto would have
pruned two live stands on the one shard it was tested on.

The positive signal is sound. Every merchant the feed listed matched ground
truth exactly - position to six decimals, afk state, slot contents and prices.
So the gain is the case aldata cannot cover: merchant still standing, item sold
or price moved. Mapping verified live before deploy - 55 rows, 0 unrecognised
server tags, 51 of 55 keys colliding with aldata's so the merge dedupes rather
than double-counts, the remaining 4 being merchants aldata had not recorded.

gameFeedAgeSec is 128, measured not chosen. A listing placed at t0 was
confirmed server-side instantly, still absent from the feed at t+114s, present
at t+128s. A closed stand was still listed at t1+48s and gone by t1+75s.
Stamping the slower of the two is deliberate: game rows then lose to anything
genuinely fresher and win only against aldata rows aged past ~2 minutes, which
is exactly where aldata starts advertising stands that have gone.

Both latencies are n=1 on one shard, and the 128/75 asymmetry may be
cache-cycle phase rather than two different latencies - that was not separated.
Treat them as "about two minutes", not as precise figures.

This also corrects two claims made while investigating and before the tests
were run. The feed is not live - it was called live on the strength of nothing
more than a count drifting between calls. And a phantom rate of 39% was
computed against it as if it were ground truth; that number inherits the feed's
own ~2 minute lag and should not be quoted.

## v42

the long comments move to Codex/MerchantComments.md. They were 43.7% of the
file - 107,305 chars of 245,699 - and the file had been trimmed twice in one
evening just to keep deploying, once down to seven characters of headroom.
Merchant.js is now 189,886.

111 block and run comments were lifted. Each site keeps its first line as a
summary and gains a pointer, "-> MerchantComments.md#anchor"; the full text
lives under that anchor, which is the function or config key it sat on. Every
pointer resolves: 111 pointers, 111 anchors, none missing, orphaned or
duplicated. The extraction was mechanical and the result verified by stripping
all comments from the before and after and comparing - the code is byte
identical, same SHA. Nothing was rewritten, only relocated.

The header now says so, because a summary that looks like the whole comment is
worse than no comment: most of these numbers were measured live rather than
chosen, and several record a theory that was tried and discarded, both of which
invite tidying by someone who only sees the one-liner.

Two claims in the header were also corrected rather than carried forward. The
"240 KiB" ceiling was wrong - 245,706 loaded and 238,214 did not, so size alone
does not explain that failure. And the backtick rule was overstated: the bisect
that produced it was real, but Codex/FamilyFleet.js carries backticks in
comments and runs, so it is not general and the mechanism is unknown. Both now
say what was actually observed and tell the next person to bisect rather than
trust a number.

## v41

the trade verifier stops opening a modal on every leg. arbProbeVerify is a
hand-run probe that returns through pShow, and arbStillThere calls it to check
both legs of every trade - so each attempt put one modal on screen per leg.
Twelve identical MuaBan/trade10 boxes were stacked when this was found, which
is the same fault v37 fixed in arbProbeFindFlips and the same cause: a probe
written for a person, reused by the automated path with its display side
effects intact. It gains the same quiet option, passed by arbStillThere only;
the return value is byte-identical, so selection and verification behaviour do
not move, and the reason still reaches the ledger through arbFinish.

Worth noting for whoever edits this next: the file is now 245,699 chars and
the largest size PROVEN to load is 245,706. That is seven characters of room.
The 240 KiB figure in the header is not trustworthy - it was inferred before
the backtick bisect and a 238,214-char build later failed to load while a
245,706-char one succeeded, so size and that failure are not the same thing.
Before adding anything substantial here, either establish the real limit or
spend a pass trimming prose, of which there is plenty.

## v40

two fixes, both cases of a cached value drifting from the truth. The stand
first: ensureStandClosed early-returned on state.standOpen, which is only our
note of the stand, not the stand. change_server reloads the page on every shard
hop, so state comes back with standOpen false while the stand itself, being
server side, is still standing - the close was then skipped and the merchant
walked and hopped with it up. Caught live on EU III: stand0 open,
state.standOpen false, moving true, mid-trade. It now asks the game
(character.stand) as well as the flag. v39 closed the stand in arbApproach,
which was necessary and not sufficient; this is the other half.

Second, the abandon path now records the failure. arbMarkUsed only ever fired
on a consumed listing, so a listing that is real, freshly advertised and always
gone on arrival was re-picked the moment it reappeared in the feed. Kazhag on
EU I is the case: slice_mint at 100,000 in all four trade slots, genuinely
re-listed every couple of minutes with a lastSeen two minutes old, and five
separate trades opened against him inside 90 seconds, every one abandoned at
slot_gone. 707 abandons on the day. This is NOT the v38 cache bug - v38 is
confirmed running, and the row really was fresh through the merchant's own
arbProbeMarketRows; he simply loses the race every time, which a 10x spread on
a public feed guarantees. Failures are now keyed on shard|target with an
escalating hold (2 min doubling to 60), forgotten two hours after the hold
lapses, and cleared by any completed trade. Keyed on the seller rather than the
slot because four slots advertising one item would otherwise burn four cycles
before that stand went quiet, and escalating because a flat cooldown only turns
a permanent loop into a duty cycle.

## v39

the stand no longer stays open while the merchant walks. Stand safety was
centralised in travelTo()/travelToBank() on the stated grounds that they were
"the only functions that call smart_move/town/xmove" - true when written, false
since the arbitrage executor arrived. arbApproach smart_moves straight to a
counterparty and arbProbeStep does the same, so neither ever reached
ensureStandClosed(); scoutPontyCheck has the same hole, dormant only because
scouting is off. Caught live 2026-09-21: stand0 open, state.standOpen true,
moving true, at (12,23) on main with a trade picked against AriaHarper on US
III. attemptKiss looked like a fourth case and is not - its caller closes the
stand first. The reopen was missing too, and that half is the subtler bug:
shouldHoldStand() already refuses a stand while ARB.cur is set, but only
openStandAtBestSpot() consulted it, so the rule governed opening and nothing
else. Nothing closed the stand when a trade started, and nothing put it back
when one finished - every existing reopen hangs off a delivery batch, the gear
loop, the kiss, a hop home, or script load, none of which an arbitrage run
touches. arbLoop now reopens when idle, guarded on ARB.cur, ARB.busy,
state.busy and standOpen so it cannot fight another subsystem or re-issue
open_stand every tick. Consequences of the old behaviour: listings stayed live
while in transit, so a stand could be traded against at a position already
left; state.standOpen drifted from the truth; and the best-spot placement was
defeated, since the stand ended up wherever the arbitrage walk stopped.

## v38

the market fetch no longer reads the browser cache. arbFetchJson called fetch with no cache option and no cache-buster, so /merchants was served from cache indefinitely - and because a cached response carries a cached lastSeen, ageSec was computed against a frozen timestamp and every row read as fresh forever. sellMaxAgeSec could not catch it: by its own measure the rows it was handed were seconds old. Measured live on 2026-09-21 - the executor spent hours re-picking Kazhag|trade1|EUI, opening a FRESH trade against him every ~18 seconds and abandoning it at slot_gone, while ALData polled directly showed no Kazhag at all and the bridge held zero merchant rows. 399 abandons against 45 closed trades; slot_gone (168) and not_loaded (189) are the same fact seen twice - counterparties that had left a market this copy never stopped describing. Near-zero gold cost, because verification fires before the buy, which is how it hid inside a profitable day; the cost was almost all of the throughput. Fix is cache: 'no-store' plus a _=Date.now() param, applied to scoutFetch and plFetch as well - the bridge half of the same path, and /msg?to=X&since=N repeats its URL exactly whenever the cursor plateaus. Selection logic is untouched. Worth re-testing on live data before acting on anything concluded from the frozen copy: the 90% abandon rate, the absent arb_used markers, and whether any listing genuinely recurs often enough to be worth pre-positioning for.

## v37

arbProbeFindFlips gains a quiet mode and arbLookForWork uses it. That function is a hand-run probe the automated path had been calling on its 30-second beat, so every look opened a modal - they stacked up on screen through a live run - and narrated itself into probe_log, which is capped at 200 and was therefore evicting the operator's own probe history in under two hours. Quiet suppresses the display and the narration and nothing else; the return value is byte-identical, so selection behaviour does not move. Left alone deliberately: the slice(0, 20) on the return, which is a display limit the automated caller also inherits - worth revisiting, but changing which flips are visible to a live money path is not a popup fix.

## v36

LIVE: dryRun false, and this is now the build on the live slot. The rehearsal is over - the operator watched a run and confirmed it working, and the ledger agrees: 8 closed live trades, 60,469,850 spent, 84,930,141 gross, 3,397,206 tax, 21,063,085 net. dryRun has to be false in SOURCE, not set from the console: mHopTo calls change_server, which reloads the page, and the hop to the buy shard is the first step of nearly every trade, so a console value is gone before the buy leg runs and the trade finishes simulated after starting live. Scouting stays off from v35 and that is safe for trading - the executor finds its counterparties through pEntity/parent.entities and get_player, which the client fills regardless, and the flip finder reads arbMarketRows; the scout only ever fed reporting. Every earlier 'not deployed to the live slot' marker below is superseded by this line.

## v35

scouting OFF, deliberately and temporarily, for the live arbitrage run - it keeps the merchant off the scan beat, off the bridge and out of scoutGoHome, so the trade executor is the only thing moving the character and anything it does is attributable. Arbitrage is untouched and unaffected: the flip finder reads the bridge and ALData, both filled by other scouts, and nothing in it needs THIS character to have scanned. The two are separate switches. Also gates scoutProbe on the same flag - it was outside it, so with scouting off it kept polling /health every 60s and logging 'bridge up - scouting enabled' while scouting was disabled, which is the sort of line that sends someone hunting a bug that is not there. Set scout.enabled back to true to resume; everything else stays configured. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v34

the town scan now matches FamilyFleet, and unsent scans are dropped rather than carried. The beat is 20s, and the gate is whether the whole standRegion is inside the vision box rather than whether we are within 60 of the first stand candidate - a stronger test, because an empty scan REPLACES a shard on the bridge, so a reading taken where the stands are not visible reports an empty market as fact. Vision is a box, [700, 500], not a radius: a radius would accept a point 600 north that the box rejects, and reject one at (600, 400) that it accepts. Buffered scans are now discarded once the immediate retries are spent. Measured, not assumed - the MerchantScout sweep with the bridge down took 1338s against 241s with it up, and the per-hop cost climbed about 14s each time, because every failed post leaves another bucket and every bucket costs the 7s post gap twice a hop. The data was worthless by the time it would have landed anyway. The same-pass retries are kept: that data is seconds old and the bridge answered. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v33

all five Mainland NPC errands now happen from one measured position, (-179, -72): Lucas for scrolls, Cue for upgrade and compound, Gabriel for basics and selling, Ernis for potions, Ponty for secondhands. It is the centre of the smallest circle enclosing the four that were measured live - Gabriel 129.4, Cue 150.6, Lucas 286.0, Ponty 286.1 - and Ernis turns out to sit inside it at 169.8, so adding him does not move the optimum. The gear loop walks there ONCE and then buys the scroll, compounds and upgrades without another step; before, each material had its own travelTo and the roll then happened wherever the last one left the character, which for a plain scroll was Lucas, from whom Cue is 285.4 - at the very edge of range and the only reason it worked. Ponty is no longer walked to from the spot, and potions go to the spot rather than to Ernis, who can do only the one thing. Garwyn (616 away) and Crun (on level2) are out of reach of anywhere in the cluster and still travel. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v32

two scan-buffer bugs ported from FamilyFleet, both in live-gold paths. scoutSettleScan measured settling with scoutBufferedCount - every shard still being carried - so an unsent backlog made the two-passes-agree test pass on the second pass before the new shard had been looked at once, and the roamer posted whatever it happened to hold. It now counts THIS shard. And the buffer never cleared a shard between visits, so a stand that closed was merged forward and re-reported as live on every return; sweeps now replace rather than accumulate, which is what stops the bridge being fed ghosts it has no way to detect. scoutPostGap's wait is also clamped, since a backwards clock made it a number setTimeout cannot hold. (Superseded: deployed to the live slot on 2026-09-21 - see v36.

## v31

market rows from ALData and our bridge are now merged per merchant per shard, newer row wins, rather than ALData winning wholesale whenever it answered. Freshness is a property of a row, not a source: on a shard a parked scout holds, ours is seconds old; three shards away ALData's is better. A union, so a merchant only one source knows is kept - absence from a source is not evidence of departure. Pinning a source stays winner-takes-all, since that is what it is asked for.

## v30

sellMaxAgeSec tightened from 15 minutes to 7 - about three sweeps at the measured 2.4-minute rate, where 15 allowed a buy order six sweeps stale to be travelled to. The flip finder now reports how many listings it dropped as stale and how fresh the freshest rejected one was, so a window that is too tight shows up as a number rather than as an unexplained absence of opportunities.

## v29

skip the anniversary kiss while hop sick. G's explanation for the condition says it blocks kiss rewards - an effect absent from its modifier list - so a sick merchant walks the round, closes its stand and collects nothing. Also corrects the model behind it: serverhop_logic is declared twice in node/server_functions.js and the later declaration wins, so the hop-counted tapering tiers an earlier read reported are dead code. The live rule is flat, from G: off p.home at level 60+ gives luck/gold/xp -80 and output -20 for 12 minutes. Inert at level 30, but merchants gain xp from trading.

## v28

parked scout: the merchant now holds CONFIG.homeServer and never hops for the sake of a scan. The family's MerchantScout fleet covers the rotation, and a hop reloads the page - a dedicated scout pays that for nothing else, the merchant pays it with deliveries, the stand and in-flight trades behind the load. It still scans wherever the script legitimately takes it, and now tells the bridge role:'parked' with pinned:true instead of claiming to be a roamer that never moves. Set CONFIG.scout.parked false to restore roaming. Also gains the game log filter the other three characters run - tab bar over #gamelog in rows of four, a Noise tab off by default for 'get closer', AP[...] achievement progress and the courage messages, and a MutationObserver so lines the client writes through add_log are filtered on arrival. Guarded on parent.$ so it no-ops where there is no game DOM. (Superseded: deployed to the live slot on 2026-09-21 - see v36.)
