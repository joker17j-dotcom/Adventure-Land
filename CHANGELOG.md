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
