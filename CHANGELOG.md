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
