# Working conventions

Standing instructions from the user. These survive context compaction; the
conversation may not.

## Repo layout

**Both sessions.** Reorganised 2026-10-17; before that everything sat at the
root, so any path in an older note, comment or commit message may be stale.

- **The character scripts and their changelog live in `Party/`** -
  `Party/Ranger.js`, `Party/Priest.js`, `Party/Mage.js`, `Party/Merchant.js`,
  `Party/MerchantChangelog.md`, `Party/MerchantComments.md`. Verified at the move:
  Ranger, Priest and Mage kept byte-identical blobs, so nothing drifted.
- **`CaveRun.js` is still at the root**, with `Cleanout.js`,
  `ExchangeQuest.js`, `OpenGifts.js` and `UpgradeCompound.js`. It is run by all
  three combat characters but was deliberately left out of `Party/`.
- **`CLAUDE.md` stays at the root**, so the `git show origin/main:CLAUDE.md`
  recipe below keeps working.
- **`Crowns3bc/` is REFERENCE ONLY - never edit it, never deploy from it.**
  Another player's scripts, kept because the repo that hosted them went private
  or away, and whatever was useful in them was folded into our own scripts many
  versions ago. The files carry no extension and have spaces in their names, so
  a `*.js` glob and a type-filtered `git grep` skip them silently - which is
  why `git ls-files '*.js'` matches 0 of the 8. `node --check` does NOT skip
  them: measured 2026-10-17, `node --check 'Crowns3bc/DPS v4'` runs and exits
  0, spaces and all. It is whatever glob you feed it that drops them, so they
  can be syntax-checked by naming them.
  `Crowns3bc/Ranger` is 1,648 lines and `Crowns3bc/Priest` 1,478, which makes a
  bare "Ranger" or "Priest" ambiguous - write `Party/Ranger.js` when that is
  what is meant. Their commit messages read "Update print statement from
  'Hello' to 'Goodbye'", which is a Copilot default describing nothing; do not
  read meaning into them.
- **`Archived/` is retired work**: `Archived/Upgrade` and `Archived/TASKS.md`.
- **`TASKS.md` is at `Archived/TASKS.md`.** It was deleted from the root on
  2026-10-17 and restored under `Archived/` the same day in `aa409aa`, byte
  for byte AT THAT MOMENT: blob `a3b2965a`, 649 lines, identical to
  `git show fe70d60:TASKS.md`. **It is no longer that file**, and this entry
  claimed otherwise until 2026-10-18. `93e8035` rewrote task 2's Status block
  two hours after the restore, so the tree copy is blob `37660b87`, 651
  lines, 33,906 bytes. The difference is not cosmetic: task 2 now reads
  "DROPPED, not pending" where the deleted original read "remain on hold" -
  opposite meaning, reached by trusting a note that promised the two were the
  same file. Read the tree copy for the CURRENT state and
  `git show fe70d60:TASKS.md` for the pre-archive wording; there is still no
  need to go digging in history, which is what this entry said to do until
  2026-10-17.
  Every reference points at the new path as of 2026-10-17: the three that
  still read `TASKS.md` were fixed in `Codex/FamilyFleet.js` (a comment and an
  in-game log line, both "5e") and `Party/MerchantChangelog.md` ("item 1"), and
  `README.md` already did. Cite the file and its anchor rather than a line
  number - the `Party/MerchantChangelog.md` line this entry used to name drifted twice
  in one day, 2112 to 2168 to 2196, as entries were added above it.

## Which session are you

Two Claude sessions share this repo and this file. Almost everything here
applies to both, but a few things are true of only one, and getting that wrong
has cost real time. Every section below that is session-specific says so on the
line under its heading; an untagged section applies to both.

- **The Claude Code session** runs in a container, reaches GitHub through a
  connector, and pushes with `git`. It has no browser tabs, no `javascript_tool`
  and no live DOM.
- **The browser-driven session** runs in Chrome. It drives live character tabs,
  evaluates JS in the game, and commits through the GitHub web editor because
  its git proxy will not push this repo.

**Determine which you are by measuring, never by assuming.** Run
`git push --dry-run origin main` and believe the result. A 403 reading "not in
this session's authorized repository set" means you are the browser-driven
session and the web-editor route applies. Anything else, you can push.
Measured 2026-09-25 from the browser-driven container: refused, HTTP 403.

Do not restate either session's limits as a fact about the repo. "Claude pushes
through Chrome" would stop a session that *can* push from ever trying.

## Communication

- **Anything intended for the other chat goes in a paste block.** The user
  relays between two Claude sessions by copying. Text meant for the other
  session must be inside a fenced block so it can be copied in one action,
  with nothing addressed to them left loose in the reply.

## Git

- **Work on `main` only.** No feature branches for this work; commit and push
  to `main` on `joker17j-dotcom/Adventure-Land`.
- **Do not open pull requests** unless explicitly asked.
- **How you push depends on which session you are.** Try a normal
  `git push -u origin main` first and believe the result.
  - The Claude Code container session pushes directly and does so routinely.
  - The browser-driven session's git proxy will not inject credentials for
    this repo, so a push from there fails and commits go through the GitHub
    web editor instead.
  Stated unqualified ("Claude pushes through Chrome"), this reads as a fact
  about the repo and would stop a session that *can* push from trying.
- **`gh api` IS REFUSED FROM THE BROWSER-DRIVEN CONTAINER, AND THE FIX IT NAMES
  IS NOT AVAILABLE THERE - do not chase it.** Measured 2026-10-17 from that
  container: `gh api repos/joker17j-dotcom/Adventure-Land` returns HTTP 403,
  "GitHub access to this repository is not enabled for this session. Use
  add_repo to request access ... call add_repo again with access:\"push\" to
  attach the repository with credentials." That session holds no `add_repo` tool
  and the operator confirmed the same day that the feature is unavailable to
  them. **This is a fact about that session, not about the repo** - per the
  warning above: the Claude Code session DOES hold `add_repo`, has a `gh` binary
  on PATH, and reaches GitHub through its connector and the github MCP tools.
  That asymmetry is why both sessions exist; each has what the other lacks.
  Earlier wording called the fix "available", which would send the browser
  session hunting for something it cannot do.
- **Read a file before writing it in the web editor.** Opening `/new/<path>`
  for a file that already exists overwrites it wholesale rather than merging.
  One near miss already: `/new/main` for `CLAUDE.md` would have dropped every
  convention in `8026394`, and was caught by the file appearing in the sidebar
  rather than by anything deliberate. Open the existing file and edit it.

## Who commits

**The default differs by session.** This section used to be headed "hand it
over by default" and then open by saying the Claude Code session should simply
push, so the heading and the first bullet contradicted each other for one of
the two readers. Find your own session below; the rest of the section is the
browser-driven route and does not apply to the other.

- **Claude Code session: commit and push with `git`, without being asked.**
  It is one call, the result is verifiable against `origin/main`, and nothing
  below about handing a commit over applies. Routing a change through a human
  from here costs the operator time and buys nothing.
- **Browser-driven session: DEFAULT is to hand the commit to the operator.**
  Provide three things and stop - the content, the commit message, and the
  extended description. Do not open the web editor. That route was MEASURED on
  2026-10-17 at ~14 minutes for one `CLAUDE.md` commit, ~8 with the recipe
  followed exactly, against under a minute for the operator by hand.
- **Browser-driven session: commit directly only when told to, for that
  commit.** Standing permission to push is not a standing instruction to
  push.
- **How the content is handed over depends on size.** Markdown and short text
  go in a fenced block in the chat, copy-pasteable, tables preserved. A 400 KB
  character script does not - send that as a file. Never paste a whole script
  into the conversation.
- **Hand it to the operator even when the file is large.** A character script is
  already in their hands - they paste it into the CODE slot to deploy it - so
  routing the commit through the other session moves the same change twice.
- **The other session earns its keep on MULTI-FILE changes only.** The web
  editor costs the operator roughly a minute per file, because each file is its
  own open-edit-commit cycle, while a patch is one relay however many files it
  touches; break-even is about three. Same for a large file the operator has no
  other reason to hold - anything in `Codex/`, or a long document that never
  goes to a CODE slot. In both cases send `git format-patch`, never the whole
  file, per "Handing code to the other chat" below.
- **Verification MOVES, it does not disappear.** The hash gates in the
  web-editor route exist because a silent paste corruption has already happened
  here. State the expected byte and line counts with the handoff, then confirm
  after the commit: `git hash-object` of the local build against
  `git show origin/main:<path> | git hash-object --stdin`. One call, ten
  seconds, not optional. The 2026-10-17 commit was only provably correct
  because its blob matched `ff76723a` exactly.
- **VERIFY THE BLOB OF EVERY FILE A COMMIT TOUCHED, NOT JUST THE INTERESTING
  ONES.** `Party/MerchantChangelog.md` was committed EMPTY in `e8df0cc` and
  stayed that way for two commits - 196,051 bytes to 0. The commit verified
  `CLAUDE.md`, `Party/Merchant.js` and `Party/Ranger.js` against `origin/main`
  and not the changelog, because the changelog was the boring file. Three things
  that all looked like success: the writing script printed its own completion
  message, no assertion covered that file, and `git status --porcelain` showed
  `M` - which says a file CHANGED, never that it changed into what was intended.
  Loop the check over the whole `git diff --name-only` set; it is one call for
  all of them.
- **NEVER READ AND WRITE THE SAME FILE IN ONE EXPRESSION.** That is how the
  changelog went to zero:
  `io.open(p,'w').write(io.open(p).read().replace(a,b))`. Python evaluates the
  write handle FIRST, `open(p,'w')` truncates immediately, and the read argument
  then returns an empty string - so the file is replaced by `''.replace(a,b)`,
  which is `''`. It raises nothing and the surrounding script reports success.
  Read into a variable, then write, as two statements; and assert on the content
  you read before writing, which is what caught nothing here because the
  assertion was in a sibling branch of the same script.
- **Attribution stays on handed-over commits.** Operator's call 2026-10-17: the
  session that did the work gets the credit, so every extended description ends
  with the `Co-Authored-By: Claude Opus 5` and `Claude-Session:` lines even
  though the operator is the committer.
- **Routing commits away from this session is a cost accepted, not a demotion.**
  It is the session that can read the live game and verify claims against it,
  which is why it produces the content in the first place.
- **MCP code pushes follow the same rule as commits.** Operator's call
  2026-10-17: `save_code` through the `adventureland` MCP server is DIRECTED
  per push and never standing, exactly as a commit is, and the default stays
  the operator doing the deploy. Data PULLS through that same server need no
  instruction. The tool cannot actually carry a character script, though - see
  "Deploying a code slot".

## Version headers

**THE RULE INVERTED ON 2026-10-18. NO CHARACTER SCRIPT ACCUMULATES HISTORY IN
LINE 2 ANY MORE.** This section used to say "prepend to the header, never
replace it", with `Party/Merchant.js` named as the sole exception. All four are
now the same shape, so there is no exception and no prepending. A session
working from the old rule would put 60 KB back into a header that was just
emptied, which is the single most expensive mistake this file can cause.

- **Line 2 carries the CURRENT VERSION ONLY.** No parenthetical body, no
  history. Each script has its own changelog beside it:
  `Party/RangerChangelog.md`, `Party/PriestChangelog.md`,
  `Party/MageChangelog.md` and `Party/MerchantChangelog.md`. That last one was
  `Party/CHANGELOG.md` until 2026-10-18 and the rename is DONE - an older note
  describing it as in progress, or a reference to the old path, is stale.
  Prepend the new entry THERE, newest first, never rewrite an old one, and
  bump line 2 in the same commit.
- **THE "CURRENT VERSION ONLY" RULE IS NOW LOAD-BEARING FOR CODE, NOT JUST A
  CONVENTION.** As of Merchant v104, `merchantHeaderVersion()` reads line 2 at
  runtime with an END-ANCHORED regex (`/\bv(\d+)\s*$/`) and `parent.MERCHANT_VER`
  derives from it, so putting a parenthetical body back on that line does not
  merely violate the rule - it changes what the running script reports about
  itself. Anchoring to the FIRST match is not an alternative, because a slot
  token containing a lowercase v followed by digits would win it;
  `Tests/suite_merchantver.js` asserts that case.
  **END-ANCHORING ALONE WAS NOT ENOUGH, and v106 tightened it.** The buffer can
  hold ANOTHER SLOT's header, so a bare trailing-version match read OpenGifts
  and returned 2. The live pattern requires the whole header shape -
  `/^\/\/ .* \(Merchant\) - .* - v(\d+)\s*$/` - so a foreign buffer is null
  rather than a wrong number that then gets cached. The character name is
  deliberately not hardcoded; only the `(Merchant)` class marker is.
- **THE HISTORY-HEADER TRAP WAS MISLOCATED, AND THAT COST A LIVE DEFECT.** This
  bullet said the helper must not be COPIED into a root script, because a
  history-carrying line 2 ends with the OLDEST entry - on `OpenGifts.js` the
  read returns 2 against a v11 build. True, and not the real exposure: no
  copying was involved when the helper read OpenGifts' header anyway, because
  the EDITOR's buffer had that slot loaded. A hazard filed as "do not put this
  code there" was actually "this code will read that file from where it
  already is". When a trap is described by WHERE code lives, check whether the
  data can come to the code instead. The suite now asserts null rather than
  asserting the trap. Do not cite a character count for that line: it grew 14,727 -> 17,553
  in a day, and the durable fact is the ordering, not the size.
- **Why it changed.** Measured 2026-10-18 before the move: Ranger's header was
  86,133 bytes, 21% of the whole file, and ONE line of it was 64,673
  characters; Priest 45,771 and Mage 45,801. Extracting all three dropped
  Ranger 409 KB -> 282 KB, Priest 254 -> 186, Mage 236 -> 168. That is real
  headroom against the CODE slot ceiling, which is the same reason Merchant was
  emptied on 2026-09-21.
- **Long rationale lives beside the script too.** A line ending
  `-> <Name>Comments.md#anchor` is a SUMMARY; the measurements, the dates and
  the theories that were tried and discarded are in
  `Party/RangerComments.md`, `Party/PriestComments.md`, `Party/MageComments.md`
  and `Party/MerchantComments.md`. Read the anchor before changing the code it
  sits on, and update it in the same commit. The split rule used: if a reader
  editing that function would need it in front of them it stayed in the source;
  if it is archaeology it moved.
- **Watch for the deployment markers.** A note like "Not deployed to the live
  slot: Meltymerch stays on his older build" is the only record that repo HEAD
  is ahead of what a character is actually running. These now live in the
  changelog entry rather than line 2, so look there before deploying. Lost
  once, in ba067df, restored after the other session caught it. A LIVE SLOT CAN
  ALSO BE AHEAD OF THE REPO and nothing records that at all - see "Deploying a
  code slot".
- **No comment may state a flag's current or default value.** The operator
  flips these; a comment asserting a value is stale the moment they do, and one
  already was - Mage's "MULING (disabled by default)" sat above
  `CONFIG.muling.enabled: true`. Describe what each state DOES and who owns the
  choice. Merchant's "Inert while `enabled` is off" is the model: it describes
  behaviour in a state without claiming the flag is in it.

## Handing code to the other chat

- **Send diffs (`git format-patch`), never whole files.** A whole-file handoff
  carries every region whether or not it was touched, so a stale base silently
  reverts everything that moved underneath it — and it succeeds quietly rather
  than failing. Hunks make a stale base fail loudly as a rejected patch.
  This was learned the expensive way; see the v43/v44 exchange.

## Claims about the live game client

- **The creator's server source moved.** The current repository is
  `https://github.com/kaansoral/adventureland_mongodb`. The older
  `kaansoral/adventureland` is a stale snapshot and has been wrong twice about
  the live DOM (missing `DIV.game-controls` entirely; describing `#newparty`
  styling that our own code supplies).
- **Measure the running client before asserting anything about its markup**, and
  never write an inferred claim into a code comment — in the file, it reads as
  documentation. This holds for `adventureland_mongodb` as well: it is the
  server source, not a mirror of the deployed client.
- **A FUNCTION IN THAT SOURCE MAY BE DECLARED TWICE, AND THE LATER ONE IS THE
  LIVE ONE.** Grep for the DECLARATION and check the COUNT before reading any
  body. `serverhop_logic` is the worked example: two bare top-level
  `function serverhop_logic(player)` declarations in
  `node/server_functions.js`, same file, same scope, no conditional wrapper
  (`:1043` and `:1097` in one clone, `:1002` and `:1056` in another - the line
  numbers move, the duplication does not), and one call site. JavaScript takes
  the last, confirmed empirically rather than from the spec:
  `function f(){return 'FIRST'} function f(){return 'SECOND'}` gives SECOND.
  The first `serverhop_logic` is 60-odd lines of elaborate quadratic
  hop-sickness logic that has never run.
- **Why it is a trap rather than a curiosity.** Both sessions nearly acted on
  the dead one in October 2026, and it would have rewritten a correct constant
  to match a formula the server does not evaluate. Nothing in a printed line
  window hints that a second declaration exists eleven lines further on, and
  the dead body is longer and more detailed than the live one, so it reads as
  the more authoritative of the two.
- **A DESIGN VALUE MAY BE AN EXPRESSION, NOT A LITERAL. READ TO THE COMMA,
  NOT TO THE FIRST TOKEN.** `design/monsters.js:1100` is
  `"dragold":{ ... "hp":12800000*2,"xp":12000000*2, ... }`. A grep for the
  field and a read of the first number gives 12,800,000, which is half, and
  the file offers no hint - the whole definition is one line. It cost a
  2026-10-18 session a phantom hunt for an event multiplier that does not
  exist. maxHp feeds `requiredDwellSec` as `maxHp^0.65`, so a 2x error there
  is a 2x error in how long the party is told to stay. The real values:
  dragold 25,600,000, crabxx 960,000, franky 120,000,000, icegolem
  16,000,000, mrgreen 36,000,000, all `cooperative: true`.

## A comment is a claim, and claims rot

**Both sessions.** Added 2026-10-18 after the fifth instance.

- **An assertion in a comment or in this file needs checking as much as a
  branch does.** It is not commentary; a reader acts on it. Five recorded
  instances, all of them text that was TRUE WHEN WRITTEN: `bossSetSwapEnabled`
  described as read when nothing read it, `MERCHANT_VER`, `POPULATION_MAX_ROWS`
  promising a trim that did not exist, the v89 header that was never bumped,
  and the `Archived/TASKS.md` byte-for-byte claim above.
- **The strongest-looking claims rot too.** The TASKS.md entry cited a blob
  hash, a line count and a byte count - the most checkable form an assertion
  can take - and all three were wrong within two hours of being written,
  falsified by the very next commit to that file. Precision is not durability.
- **A FIX NOBODY IS NAMED FOR IS A FIX NOBODY MAKES.** Measured on itself,
  2026-10-19: a false `taxiProbeNote` claim sat in THIS file while each session
  believed it was the other's to correct - one had written it and assumed the
  other would carry it, the other had looked and reported it absent. Both
  declined for defensible reasons and the error survived on being someone
  else's. When a handoff mentions a fix, say who makes it and by when, or make
  it yourself.
- **A GREP THAT MISSES IS NOT EVIDENCE OF ABSENCE, BECAUSE PROSE WRAPS.**
  2026-10-19: "is live in Ranger v95 as `bossRank()`" straddles a line break in
  this file, so a search for the phrase found nothing while the claim sat there.
  Search for a distinctive single WORD, or use a multiline pattern - `grep -z`,
  `rg -U`, or a Python read of the whole file - but do not conclude a wrapped
  phrase is absent from a line-oriented search for it.
- **CHECK THE FILE YOU ACTUALLY MEAN, AT THE REVISION YOU ACTUALLY MEAN.** That
  same "it is not in the repo copy" report was produced by grepping the working
  tree one call BEFORE the `merge --ff-only` that brought the other session's
  commit in - a true reading of a stale file, stated as a fact about the repo.
  `git show origin/main:<path> | grep` answers the question that was being
  asked; a bare `grep` answers a different one and looks identical.
- **A CORRECT COMMENT THAT NOBODY ACTED ON IS INVISIBLE TO EVERY CHECK ABOVE.**
  `CaveRun.js:227` has said since v6 that `parent.party` is useless for distance -
  every member's x/y frozen across a 20.7s sample, the leader's own entry 396u from
  his real position - and then ended by explaining that `leaderPos()` uses it for
  distance as a fallback. Correct claim, contradicting code, sitting together through
  nine versions. Re-verification cannot find this: checking the claim CONFIRMS the
  claim, the hash confirms the file, and a grep finds the text present and right. It
  was found only when the browser session re-measured the same staleness from the live
  game (975u, 1418u, 2558u) and went looking for where it mattered. So when a comment
  states a limitation, read the code BESIDE it and ask what acts on it - a claim nobody
  acted on costs exactly as much as a claim that rotted, and announces itself less.
- **So re-verify rather than re-read.** `git hash-object <file>` against
  `git rev-parse origin/main:<file>` settles a file claim in one call; a
  `typeof` check settles a helper claim; an AST pass settles a "nothing reads
  this" claim where a regex does not (a regex counts the `// CONFIG.<path>`
  annotations in the TOGGLES blocks and reports a dead flag as live).

## Server hopping, home bonus and Realm Fatigue

**Both sessions must know this; only the browser-driven one can measure it.**
Every figure here was measured live on 2026-10-17 off `character.s` on each
character tab, with the operator's go-ahead for a disruptive test hop.

- **A hop re-stamps BOTH clocks on EVERY non-merchant character, and moving
  together does not help.** This is the measurement that kills the obvious
  chain-hop design. Three characters hopped inside one second - 274ms hop
  latency each - and all three Realm Fatigue timers jumped back to full:
  +504,779 / +508,866 / +506,390 ms against the no-restamp prediction. The
  trigger is the HOP ITSELF, not a desync window between characters, so
  synchronising the party buys exactly nothing. Hop Sickness resets the same
  way - a predicted 161,147 ms came back 688,306.
- **Hopping ONE character fatigues the ones who stayed**, after a lag of
  roughly 10-30 seconds. At +6s the two who stayed home still read clean, and
  reading that as "staying put is free" would have been a wrong conclusion;
  by the next read both carried ~1,774,000 ms. Do not call this one early.
- **Activity re-stamps it.** The two actively farming read ~26s elapsed while
  the idle one on another shard read 184s, so the timer tops back up rather
  than running down while any mismatch persists.
- **Reuniting does NOT clear it, and only then does it decay 1:1 with real
  time.** All three co-located on one shard still carried it; decay ratios
  measured 0.999 / 1.006 / 1.004 over 49-119 second windows.
- **Returning home clears Hop Sickness INSTANTLY; Realm Fatigue survives the
  trip.** All three arrived on the home shard with `hopsickness` absent despite
  ~11 minutes remaining moments earlier, while Realm Fatigue came home intact
  at 29.5 minutes. `G.conditions.hopsickness.explanation` says so outright,
  and also says the 12 minutes is "online play" - it does not tick down while
  the character is offline.
- **The merchant exemption is one-way, not total.** Meltymerch hopped through
  US I/II/III/V, EU I/II/III and ASIA I/II across the whole test: he never
  received Realm Fatigue and never inflicted it on anybody. He DOES take Hop
  Sickness - measured 11.9 minutes on EU III. So merchant arbitrage costs the
  combat party nothing, and costs the merchant only his own luck/gold while
  away, which arbitrage profit does not depend on.
- **So Realm Fatigue is the cheap half.** It blocks home bonuses and kiss
  rewards only, the home bonus does not apply off-home anyway, and it does not
  scale with how many shards get visited - its whole cost is delaying the home
  bonus resuming once back. Hop Sickness is the expensive one; see below.

Server-source reads, 2026-10-18, from `kaansoral/adventureland_mongodb`. Read
the double-declaration warning under "Claims about the live game client"
first - this section is what it was learned on.

- **The live Hop Sickness gate is three terms and nothing else.** From the
  SECOND `serverhop_logic`: `p.home != region + server_name && level >= 60 &&
  server_name != "PVP"`. There is no hop counting - `p.entries` is RESET to a
  single entry on every hop, so no accumulated history can exist - and the
  first line early-returns when `entries[0][0]` already names the shard being
  joined, so a reconnect to the same shard never re-applies it. `p.home` is
  the BEAN-SET home. A `main`-by-accumulated-hours gate appears only in the
  dead declaration.
- **`add_condition(player, "hopsickness")` passes no overrides**, so G's
  values are the real ones, not a worst case: duration 720000 (12 minutes
  flat), `luck/gold/xp -80`, `output -20`. The 12 minutes is online play and
  does not tick down while the character is offline.
- **WHETHER A HOP WILL MAKE YOU SICK IS COMPUTABLE BEFORE HOPPING.**
  `node/server.js` sends `cdata.home = player.p.home` in the login payload and
  `js/game.js` assigns it to `character.home`, updating it again on a
  `home_set` response - so the gate's own value is readable from a tab or from
  CODE: `character.home !== (parent.server_region + parent.server_identifier)
  && character.level >= 60 && server_name !== 'PVP'`. An earlier note here
  said the opposite, because it was reasoning from the dead declaration's
  `p.entries`-based gate; `p` itself is indeed absent client-side, but the one
  field that matters is mirrored.
- **The PVP exemption is real and is NOT an invitation.** `server_name !=
  "PVP"` does mean a PVP shard costs no Hop Sickness, but
  `issue_player_award` runs `if (is_in_pvp(target)) drop_something_pvp(...)`
  on any PLAYER kill there: 50% per equipped item, 30% mainhand and offhand,
  80% per non-stacking inventory item, 50% per stack, all into a chest the
  killer can take. Nothing is destroyed - the destroy branch is commented out
  - and monster deaths, instances (`generated_entry` bails first) and
  self-kills are all exempt. Verified from source 2026-10-18. Operator's
  call: PVP is off the table, so do not read the sickness exemption as a
  free staging shard.
- **Two cures, and both are instant.** Snakeoil, and `set_home` - which does
  `delete player.s.hopsickness` outright, but carries a 36-hour cooldown
  (`p.dt.last_homeset`, refused under `hsince < 36`), so it is not a routine
  tool. Returning to the home shard also clears it, as measured above.
- **Snakeoil IS a Hop Sickness cure, and cannot touch Realm Fatigue.** The
  mechanism is generic and never names the item, which is why grepping for
  "snakeoil" in the server finds nothing: the use handler runs
  `if (def.debuff) { for (var c in player.s) { if (G.conditions[c] &&
  G.conditions[c].debuff && (!G.conditions[c].persistent ||
  c == "hopsickness")) delete player.s[c]; } }`. `debuff: true` on an ITEM
  means "clears debuffs", not "is one", and snakeoil is the ONLY item in
  `design/items.js` carrying it. Hopsickness is persistent and would be
  excluded, so it is carved out BY NAME. Its `gives: [["hp", -100]]` is the
  PRICE, not a penalty.
  `realmfatigue` has NO `debuff` flag, so the loop never considers it - Realm
  Fatigue remains the irreducible cost of a hop, 30 minutes, flat in the
  number of hops, which is still the argument for batching.
  The same drink clears the 23 non-persistent debuffs (frozen, poisoned,
  stunned, cursed, deepfreezed, sundered and the rest), so it is a combat
  panic button too; of the six PERSISTENT debuffs - withdrawal, xshotted,
  notverified, authfail, hopsickness, block - only hopsickness is carved out.
- **Realm Fatigue's own G entry**: duration 1800000, persistent, and NO
  penalty fields at all - it is purely the home-bonus and kiss block described
  above. `realmfatigue_logic` opens
  `if (player.type == "merchant") { delete ...; return; }`, so the merchant
  exemption measured live is in the source too.
- **What the home bonus is worth, and what it is not.** Exactly two call
  sites, pinned by the creator's own test
  (`node/test/home_server_bonus.test.js:102` asserts
  `has_home_server_bonus(` appears twice): `mnet *= 5` at `server.js:13365`,
  guarded two lines above by `if (!m.cooperative) return;`, and the
  `monsters_home_server` drop table at `:2361`. NOT gold, NOT luck. See the
  "Kill credit, achievement score and drop rolls" for what the x5 does to
  required dwell, and for why the home-only drop table is worth little.

## Kill credit, achievement score and drop rolls

**Both sessions.** Server-source reads plus live measurement, 2026-10-17.

- **CREDIT REQUIRES BEING PRESENT WHEN THE MONSTER DIES.** The award loop
  resolves every contributor through `players[name_to_id[name]]` and skips any
  entry whose player is not live in THAT shard's process - the guard is a bare
  `if (current)` - so a departed player's accumulated `monster.points` is
  discarded and does not even contribute to `total`. Hop away before the kill
  and the damage earned nothing. Any design that banks damage at one boss and
  moves on is therefore broken; the party has to wait out the death.
- **Share formula.** `total = SUM(points^0.65)`;
  `share = points^0.65 / total`; credit if `share > 0.0025`. `points` is
  accumulated `mnet`, with `mnet /= 4` under Hop Sickness and `mnet *= 5` with
  the home-server bonus. **The x5 is COOPERATIVE MONSTERS ONLY** - the call
  site returns early on `if (!m.cooperative)` - and the home bonus's only
  other effect is the `monsters_home_server` drop table. It is not a gold or
  luck multiplier; verified from source 2026-10-18 and pinned by the
  creator's own test. So on a non-cooperative boss, being home changes the
  dwell requirement not at all.
- **Hop Sickness costs 5x in required participation time, not 4x.** `/4` on
  points AND `output: -20` on damage dealt gives a 0.2 factor. Because share
  scales as `(factor * T)^0.65`, that is 2.46x in share at a fixed dwell and
  exactly 5x in dwell. For mrgreen (36,000,000 HP) one character needs 10.1s
  clean against 50.1s hopsick at 40 other contributors, and 29.7s against
  147.0s at 300.
- **Score per credited kill is `1 + 0.3/divider` per own non-merchant party
  member, where `divider = 2` if the monster is `cooperative`.** Measured over
  11 monsters with the full three-character party: 1.58-1.59 for
  non-cooperative - asymptote 1.6, lifetime averages dragged down by older solo
  kills - and 1.30 for cooperative, crabxx landing on exactly 1.3000. Roughly
  0.63 kills per point on regular mobs, 0.77 on bosses.
- **Credit on a NON-COOPERATIVE monster needs no damage at all** - party
  membership plus presence suffices. Measured: a character with its runner
  stopped, standing still, took 113 credits in 56.4s (2.003/s) against 1.984/s
  and 1.942/s for the two actually fighting. Do NOT generalise this to bosses:
  `cooperative` monsters go through the share-gated path above, which is
  exactly why 12 crabxx runs produced only 7 credited kills.
- **Achievement score is a MAX across the account's characters, never a sum.**
  The effective value is `max(own p.stats total, max_stats[monster][0])`, and
  the tracker returns `max.monsters[name]` as `[value, holderName]`. Proven by
  the holders differing: poisio max 11,218.0 "MageofOz" against Dexon's own
  11,148.8, and snowman 22.1 "FatherToken" against Dexon's own 18.05. A second
  character earning credit therefore adds NOTHING unless it would overtake the
  holder - push ONE character, not three. Correction to an earlier note: the
  claim that 12/12 crabxx runs cleared the credit threshold was computed on
  party-combined points and is wrong; per-character it is 11/12, and the one
  failure is a wipe either way.
- **Read standings with the `tracker` socket event, not the NPC.** There is no
  `G.npcs.tracktrix`, no top-level function naming the fetch, and
  `character.p` is null on the client - so this is not guessable and cost real
  time to find. `socket.emit('tracker')` plus a listener on `tracker` returns
  `monsters` (kill counts), `monsters_diff` (score minus kills), `max`
  (`{monsters, level}` - the account maxima, each `[value, holder]`), and also
  `exchanges`, `maps`, `tables`, `drops`, `drops_home`,
  `monsters_home_server`, `global`, `global_static`. A monster's score is
  `monsters[n] + monsters_diff[n]`. Keep the raw payload on `window.__X` and
  report only derived numbers; it is large and trips the result filter.
- **`drops_home` is a home-shard-EXCLUSIVE drop table**, present for exactly
  eight monsters - crabxx, rharpy, phoenix, icegolem, dragold, franky, mrgreen,
  mrpumpkin - and additive to the normal table, which all eight also have. It
  is static reference data, NOT personal history; an attempt to use it for
  per-kill drop-rate history was a dead end. Operator's 2026-10-17 call: these
  are not worth planning around, the normal drops are.

Drop rolls, from source 2026-10-18. BOTH sessions read this backwards on the
same day, in opposite directions, so take the mechanism rather than anyone's
summary of it.

- **`item[0]` in `design/drops.js` is a RATE, NOT 1-in-N ODDS. HIGHER IS MORE
  LIKELY.** `shouldItemDrop` at `node/server.js:2325` is
  `playerRoll = Math.random() / rollModifier; return playerRoll < dropRate`,
  so the item drops iff `random() < item[0] * rollModifier`. A line reading
  `[1000, "funtoken"]` is a thousand times more likely than `[10, "funtoken"]`,
  and `[4.0/10000, "suckerpunch"]` is the rare one.
- **The modifier collapses to `share * luckm`.** It is
  `share * player.luckm * monster.level * monster_mult`, and `new_monster`
  sets `monster.level = 1` (`:13490`) and `monster.mult = 1` (`:13473`)
  unconditionally. `mult` is written once more, at `:17000`, inside
  `shutdown_routine` only. **`hp_mult` is NOT in this path** - the comment at
  `:2343` reads `// /hp_mult - removed [13/07/18]`. The three older roll forms
  above it do divide by `hp_mult`, but those serve the global_static, global
  and MAP tables, not the monster table. So a boss's HP does not suppress its
  own drops: being small buys nothing and being huge costs nothing.
- **A line saturates once `item[0] * share * luckm >= 1`.** Credit already
  requires `share > 0.0025`, so a `1000` line saturates at any `luckm >= 0.4`
  - which means a credited character takes every `1000` line on every kill,
  clean or hop-sick, and the lines cannot degrade while credit is being
  earned at all. Hop Sickness never touches `luckm`; its `-80 luck` does not
  enter this path.
- **A DROP TABLE IS ASSEMBLED AT MODULE LOAD, SO READ THE ASSEMBLED OBJECT,
  NOT THE LITERAL.** `design/drops.js` ends with ~26 `push` calls, a
  delete-and-reassign reorder loop, and a run of assignments that add to or
  REPLACE tables declared higher up. From a character tab the assembled
  state is `G.drops.monsters[type]`; the literal is safe only for a monster
  confirmed unmutated.
- **No regex over that file is sound, because the mutations take FIVE
  shapes, and FOURTEEN monster tables are mutated.** Measured 2026-10-18
  against upstream `2148cf25`:
  `drops["monsters"]["cutebee"]` (bracket); `drops.monsters.xmagex.push`
  (dot); `drops.monsters.cave_spider = [...]` (dot assign);
  `for (var cave_monster of [...]) drops.monsters[cave_monster] = [...]`
  (computed name, assign); and
  `for (var xmage of [...]) drops.monsters[xmage] =
  (drops.monsters[xmage] || []).concat([...])` at `:1667` (computed name,
  READ-MODIFY-WRITE).
- **That fifth shape is the one that defeats everything.** The other four
  hide the NAME; the concat form also hides the CONTENTS, because the final
  table is neither the literal nor the added rows but their concatenation -
  and the `|| []` means a name's absence from the literal proves nothing
  either way. You cannot enumerate a mutated table's contents by reading
  statements, only by reading the assembled object.
- **The fourteen.** Named: `cave_broodmother`, `cave_scorpion`,
  `cave_snake`, `cave_spider`, `cutebee`, `xmagex`. Loop-assigned and
  invisible to a name search: `cave_bat`, `cave_rat`, `cave_crab`,
  `cave_guard`, `cave_wolf`, `xmagen`, `xmagefi`, `xmagefz`. The last three
  are the easiest to miss BECAUSE `xmagex` is named - the siblings read as
  though they must be covered by it, and they are not.
- **The scan sequence is the evidence, not any one scan.** One session's
  pattern found six tables; another's found one, then two, then the real
  shape, and only reading raw statements got there. A regex that finds
  FEWER things each time it is made more careful is a method failing, and
  that is visible only if the failures are recorded. Neither pattern was
  careless - each happened to cover a different arbitrary subset of the
  five shapes.
- **The boss tables quoted above are complete, but by luck.** None of
  `dragold`, `franky`, `crabxx`, `icegolem`, `mrgreen`, `mrpumpkin`, `rgoo`
  or `bgoo` is mutated at load, so every figure here survives - it just was
  not established by a sound method. Two consequences that are not luck:
  the only funtoken sources in the whole file are crabxx (rates
  1000/1000/1000/10/10), rgoo (20), bgoo (0.25) and `cutebee` (1, added by
  a push), and FOUR of the mutated tables are `cave_*`, so anything
  reasoning about cave drops from the literal is reading a partial table.
  `cave_snake` carries `snakeoil` at 0.03 - the Hop Sickness cure, from a
  table a literal read would miss.
- **CROWDING MULTIPLIES THE ROLLS, ON COOPERATIVE MONSTERS ONLY.**
  `B.drop_table_multiplier = parseInt(1 + Math.floor(total_characters / 10))`
  at `:2734`, where `total_characters` counts contributors with
  `share > 0.0008`; the monster-table loop at `:2340` runs that many times,
  and `:2776` resets it. `issue_monster_award` reaches that code only
  `if (monster.cooperative)`. So a crowd cuts each roll's share AND multiplies
  the number of rolls, and where the lines are saturated the rolls win
  outright. Modelled on crabxx with equal contributions and `luckm` 1.5:
  5 funtokens a kill solo, 18.8 at 40 contributors, 30.4 at 80. A busy shard
  is BETTER for a funtoken run, which is the opposite of the obvious instinct.

- **THE HOME-ONLY DROP TABLES ARE WORTH ABOUT A FIFTH OF ONE ITEM PER KILL,
  WHICH IS THE NUMBER BEHIND THE OPERATOR'S "NOT WORTH PLANNING AROUND".**
  They use rates near `1.0`, not crabxx's `1000`s, so they go through the
  same `share * luckm` modifier and are NOT guaranteed. crabxx's
  `[1.0, "reefglass", 3]` at `luckm` 1.5, equal contributions:
  0.300 expected at K=5 and K=10, 0.225 at K=20, 0.188 at K=40, 0.169 at
  K=80, 0.160 at K=150. dragold's `essenceoffire` is identical (same rate)
  and its `embercore` at 0.005 is ~0.001. So the entire home-server bonus on
  a crabxx run is worth roughly one fifth of one reefglass per credited kill,
  against 19-30 funtokens from the normal table - which closes the chaining
  question: going off-home costs that fifth of a reefglass and the
  cooperative x5 on points, and nothing else.
  Verified 2026-10-18 by bracket-matching the whole `monsters_home_server`
  object rather than regexing it: exactly EIGHT entries as this file already
  claims, and no `funtoken` line in any of them. Two regex reads of that
  object disagreed first - one truncated at the first `]`, the other had
  dragold's two items reversed.

## Boss priority and the event schedule

**Both sessions.** The ranking is the operator's, given 2026-10-18. It is
declared in `Party/Ranger.js` as `bossRank()` and in no other script. This line
said "live in Ranger v95" and was wrong twice over: it landed in v95 but ships
in v97, and it had never EXECUTED at all, because Dexon was running
`Party/Mage.js` out of the Ranger slot until 2026-10-19. Nothing plans against
this ranking until a Ranger build is actually running on him.

- **The table.** dragold 1; franky 2; crabxx, wabbit and goobrawl 3; mrgreen 4;
  snowman, grinch and mrpumpkin 5; `BOSS_RANK_DEFAULT = 6` for everything else,
  icegolem included.
- **THE RATIONALE IS THE PART THAT STOPS IT BEING RE-DERIVED WRONG.** franky
  drops the keys the operator wants and goobrawl drops funtokens; keys outrank
  funtokens for now. franky is WALKABLE, so it can be taken hop-sick, while
  goobrawl needs the teleport. icegolem sits at default despite being a boss
  because only 10 kills complete its achievement, its drops are unimpressive,
  and the operator is not running the dungeon its key opens. goobrawl is treated
  as a boss even though it is several monsters and only a CHANCE at rgoo.
- **pinkgoo is deliberately ABSENT.** It was #1 in the operator's first pass and
  was dropped on measurement: 40 hp. It is an opportunistic attack, never a
  plan. The operator's own correction - they had confused pinkgoo with rgoo,
  which is the chance boss inside goobrawl.
- **Ties are equal order and fall through to the EXISTING priority system.** The
  chain in `bossPick()` is rank, then `need`, then `kills_to_rung`. Ranking
  decides which of several ALREADY-ALIVE bosses to take; it does not change
  which bosses are worth hopping for, and those were settled separately.
- **`kills_to_rung` ordering is NOT a bug.** A session called it one on the
  strength of a single sentence about funtokens. The operator: "While it may be
  a bug dragold is higher priority than funtokens." Do not promote one remark
  about one drop into a global objective function.
- **dragold is gated by `lunarnewyear: false`** and its event entry is a 15-day
  seasonal (`60*60*24*15`). Real-world Lunar New Year is 6 February; the in-game
  start is unknown. Operator's call: dragold is worth abandoning franky for, for
  now, to be re-evaluated once the event is actually live and they have seen how
  it runs.
- **A SCHEDULED SPAWN IS WORTH PLANNING FOR, NOT ABANDONING FOR.** Operator's
  call: ranks 1 and 2 are worth abandoning everything else, but both spawn on a
  known schedule, so the schedule is the thing to design around rather than an
  interrupt to absorb. Where a scheduled event is known for a slot, no
  higher-ranked boss outranks it, and it is not spawning on home, a PREPOSITION
  on that server is required.
- **THE NINE EVENT WINDOWS NEVER OVERLAP, so nothing ever has to arbitrate
  between two scheduled events.** Measured 2026-10-18: dailies at game-hours 13
  and 20, nightly at 23; windows 2400s except goobrawl at 540s; region offsets
  ASIA +7, EU +1, US -5. That lands them at 01:00, 04:00, 06:00, 12:00, 13:00,
  16:00, 18:00, 19:00 and 22:00 UTC - every adjacent pair at least an hour
  apart. The nine are a queue, not a contention problem.
- **goobrawl IS OBSERVABLE, AND THIS BULLET SAID THE OPPOSITE UNTIL 2026-10-20.**
  It read "CAN NEVER FIRE REACTIVELY ... a design that waits to OBSERVE a goobrawl
  waits forever", on the strength of the bridge reporting
  `never_observable: ["abtesting", "goobrawl"]`. **That field only ever meant "this
  event's own NAME is not a polled monster type", and the name said something much
  stronger.** goobrawl spawns `rgoo` and `bgoo`; both are polled, both are in
  `EVENT_WINDOW_SEC`, and the bridge's own despawn comment has described that
  mapping since 2026-10-18 - so one file asserted and contradicted it sixty lines
  apart. The operator caught it. Fixed at the source rather than documented around:
  `SCHEDULE_SPAWNS` plus `SCHEDULE_EVENT_OF` now derive observability from what an
  event SPAWNS, an rgoo row counts as evidence the goobrawl ran, and
  `never_observable` reads `["abtesting"]` alone. abtesting really does spawn
  nothing the bridge polls.
  **PREPOSITIONING STILL WINS, BUT ON THE BASE RATE RATHER THAN ON IMPOSSIBILITY.**
  Measured over 3,084 events spanning 2026-10-17 to 2026-10-20: exactly FOUR goo
  rows exist, all rgoo, all US III, one cluster - roughly one observation in ~75
  server-windows over 3.17 days, and nobody knows why it is that low. Detection lag
  was ~2 minutes against an 18:00 UTC open, which is 22% of a 540s window. So a
  reactive fallback is cheap and should exist; it just cannot be the plan. **A
  CONSUMER MUST TREAT ANY GOO PRESENT AS "EVENT LIVE", never a specific instance** -
  the variants die and respawn continuously, which is why `ev: "lost"` fires
  routinely during a HEALTHY goobrawl (spawn 18:01:58, lost 18:05:45, spawn
  18:05:45 the same second, death 18:15:10). `scanResults` flapping
  live/false/live during one is correct behaviour, not a defect.
  **THE GENERAL LESSON IS ABOUT THE FIELD NAME, NOT THE EVENT.** `never_observable`
  was computed from one narrow fact and named as a sweeping one, and both sessions
  believed the name over the file's own contents. When a derived field's name makes
  a stronger claim than its computation, the name is the bug.
- **THE NIGHTLY ROTATION ALTERNATES PER SERVER, AND IT HELD 13 OF 13.** Confirmed
  2026-10-19 across the 04:00 UTC window: US came out exactly as predicted on all six
  shards - I icegolem, II franky, III franky, IV icegolem, V franky, PVP icegolem -
  and EU and ASIA brought it to 13 of 13 server transitions alternating. The model is
  the operator's, not a derived one: a server's nightly alternates unless that server
  has been restarted. So WHICH nightly event is coming is a planning input rather
  than a surprise, which is what lets a queue preposition. Worth more than
  `/schedule`, which labels its own server source "NOT measured live".

## The bridge's boss log - despawn vs kill

**Both sessions.** `Codex/market_bridge.py`, fixed at write time and at read
time on 2026-10-18.

- **ABSENCE IS NOT A KILL.** An event boss that times out of its window
  disappears exactly as a killed one does, so a despawn was logging as a kill
  and inflating the kill record the chain would otherwise plan from.
- **The classifier is `stored_row_is_despawn()`**: a `death` row with no
  `estimated_respawn`, method `absent_on_responding_server`, whose elapsed lands
  inside the monster's event window. Constants `BOSS_DESPAWN_WINDOW_SLACK = 180`,
  `BOSS_DESPAWN_WINDOW_CEILING = 300`, `BOSS_DESPAWN_ALIVE_PCT = 5.0`.
- **THE CEILING IS LOAD-BEARING AND WAS ADDED AFTER A FALSE POSITIVE.** Without
  it, a US II crabxx at 4634s elapsed sitting at 7.61% hp would have been
  relabelled a despawn. It then protected a REAL kill: the US IV franky at 3612s.
- **THE EARLY SIDE AND THE LATE SIDE OF THE BAND ARE NOT SYMMETRIC, and the band
  alone cannot say so.** Added 2026-10-20 after the 14 retained despawn rows were
  measured: twelve went essentially untouched - `last_pct` 99.81 to 100 - clustered
  at `elapsed_sec` 2402-2556 against a 2400s window, and NOT ONE clean row sits
  below the window. The early side's only contribution to date was one row.
  Each signal alone has an innocent explanation and the PAIR does not. Early alone
  is a LATE-DETECTED SPAWN making `elapsed` read short, which is what
  `BOSS_DESPAWN_WINDOW_SLACK` is for and why it stays. Damaged alone on the late
  side is chip damage from a passer-by - crabxx US I at 97.52% and elapsed 2561,
  admitted by the CEILING, left alone. Both at once is crabxx EU III at `last_pct`
  63.19 and elapsed 2226 - window MINUS 174, admitted by SLACK with six seconds to
  spare, a third of its health gone: no timing artefact removes health, and a window
  expiry does not explain a boss that was being fought. `despawn_qualifies()` now
  vetoes that conjunction and only that conjunction, in ONE expression both paths
  call, with `BOSS_DESPAWN_INTACT_PCT = 95.0`.
  **Misclassifying a kill as a despawn DEFLATES the kill record**, which is the
  mirror of the inflation this classifier was written to fix, so it is a veto rather
  than a confidence downgrade - on the late side both stories are live and
  confidence is the honest answer, here one story is excluded.
  The log is APPEND-ONLY, so the EU III row is still on disk graded high;
  `stored_despawn_row_rejected()` is the filter a planner uses to drop it without
  rewriting anything.
- **CONFIDENCE GRADES NEARNESS TO DEATH, NOT DAMAGE, AND THAT WAS RE-DECIDED RATHER
  THAN INHERITED.** Widening it so any damaged boss reads low was considered on
  2026-10-20 and rejected: a boss at 4% that vanishes is very plausibly the killing
  blow landing, while a boss at 52% vanishing exactly at its window close is a
  coincidence and not a kill. The suite pins both ends - 5.01 high, 5.0 low - so
  those assertions are the MEANING and not an accident, and two of them would have
  had to be rewritten to widen it. Damage is handled by the veto above instead,
  where it proves something. The write path's inline copy of this inequality was
  also folded into `despawn_confidence()`; it had drifted apart from the read path's
  copy in the same neighbourhood as the function written to prevent exactly that.
- **A LOW hp READING IS THE COUNTER-EVIDENCE, AND THE READ PATH MUST KEEP IT.**
  A read path that checked only the window buried the live US III rgoo row at
  4.96% hp. That is what `stored_row_despawn_confidence` is for: the window says
  "possibly a despawn", the hp says "something was killing it", and the row has
  to carry both rather than be collapsed to one verdict.
- **A FILTER THAT NAMES A CAUSE ANSWERS A DIFFERENT QUESTION FROM ONE THAT
  NAMES AN OUTCOME, AND THIS SECTION IS WHERE THAT GOES WRONG.** Everything
  above grades HOW a boss stopped existing. A consumer asking whether to travel
  to one needs only THAT it stopped - and the two readings look identical when
  the despawn work is the thing freshly in mind. Measured 2026-10-20 over the
  2,499 retained events: death 1,116, despawn 15, lost 120, spawn 1,248. So a
  liveness check written as `ev=despawn` covers 15 of the 1,251 terminal
  events, ONE POINT TWO PERCENT, and misses every kill - which is how Ranger
  v100 was first designed, by this session, straight after building the
  classifier. The tell was on the page before the measurement arrived: this
  section's own opening says a despawn and a kill are indistinguishable at the
  transition, which is why the classifier had to exist at all. **A distinction
  that was expensive to draw is not a distinction to filter on when the
  question does not need it drawn.** Terminal is `BOSS_TERMINAL_EV` in
  `Codex/market_bridge.py`, enumerated so a fifth `ev` value has to be
  classified rather than defaulting in silence, and `lost` is inside it: it
  means two unrelated things - an instance id that changed, and a shard that
  went unlistable - and neither is worth a 30-minute Realm Fatigue trip, so the
  reason string never has to be parsed to classify it.
- **A SERVER-SIDE FILTER IS NOT A GUARANTEE, BECAUSE THE BRIDGE IGNORES QUERY
  PARAMETERS IT DOES NOT KNOW.** Measured 2026-10-20 against the live handler:
  `/boss_events?bogus=1` returns every row. The handler reads the parameters it
  recognises and never rejects an unknown one - so a script asking an OLDER
  bridge for `terminal=1` is answered with spawn rows still in the set, and one
  that trusted the filter would act on a boss APPEARING as though it had died,
  which is exactly inverted. The script and the bridge deploy independently and
  neither can see the other's version, so the consumer re-checks `ev` itself and
  the query filter is bandwidth only. **This generalises past this endpoint:
  wherever both sides of a deployed pair are edited here, the receiver validates
  and the sender's filter is an optimisation.** The unknown-parameter behaviour
  is asserted in `Tests/bridge/test_despawn.py` rather than remembered, so the
  comment in `Party/Ranger.js` that depends on it is a checked claim.
- **AN ESTIMATED TIMESTAMP IS NOT AN ORDERING KEY. A death row's `t` IS AN
  ESTIMATE; `death_hi` IS THE OBSERVATION.** Two of the three `death_t` forms
  are the poll-bracket midpoint `(last_alive_t + poll_t)/2` - only
  `respawn_offset` is exact - while `death_hi` is `iso(poll_t)`, the poll that
  proved the boss gone. Ranger v100 ordered a scanResults entry against `t` and
  therefore discarded the terminal whenever the true death fell in the later
  half of the bracket, which for an event boss is about half of them: the
  `server_info` key vanishes AT the death, so the entry's `at` lands there,
  after the midpoint. **THE EXPOSURE WAS 100% OF THE ROWS
  `applyTerminal` ACTS ON, AND THE FIRST MEASUREMENT OF IT WAS DERIVED WRONG.**
  Bracket width (`death_hi - t`) is not a proxy for how imprecise `t` is - a
  wide bracket on a `respawn_offset` row means the poller noticed LATE while
  the reconstruction stayed EXACT - so an initial "105 of 394 boss rows, worst
  2,290s" mixed two populations and meant nothing. By METHOD: `respawn_offset`
  1,151 rows, `absent_on_responding_server` 238, `poll_bracket` 0 in 2.5 days.
  All 238 carry the midpoint, none has gap 0, 174 (73%) exceed 30s, 44 exceed
  120s, max 348s, so roughly 119 were discarded; bossHop's targets inside the
  set are crabxx 21, icegolem 13, franky 12. **The partition is STRUCTURAL:
  `BOSS_RESPAWN_SEC` (17 types) and `EVENT_WINDOW_SEC` (5) are disjoint, and a
  boss with a known respawn keeps its `server_info` key and reports the dead
  shape - so `record()` writes `live: false` and `applyTerminal` returns at
  `r.live !== true` without ever reaching the guard.** The bridge terminal is
  the only signal for the vanishing-key population and redundant for all the
  rest, which is why the defect landed on the entire event-boss population and
  nowhere else. **A RATIO IS ONLY AS GOOD AS ITS DENOMINATOR BEING ONE
  POPULATION** - both figures here were honest measurements of the wrong set. `despawn` and `lost` rows carry no
  `death_hi` and their `t` IS the detection time, so `death_hi` falling back to
  `t` is correct for all three; parse it in two steps, because
  `Date.parse(e.death_hi || e.t)` yields NaN on a malformed `death_hi` and
  drops a real row in silence. Fixed in Ranger v101.
- **THE BULLET BELOW ALREADY SAID THIS, AND IT WAS STILL MISSED - A FACT FILED
  UNDER ONE CONSEQUENCE IS NOT FOUND WHEN YOU NEED ANOTHER.** The `ttk_sec`
  entry has stated since 2026-10-18 that `death_t` is the midpoint and that
  `death_hi` IS `iso(poll_t)`, which is the whole of what v100 needed. It was
  read, and it did not fire, because it is filed as "why ttk_sec runs short" -
  a question nobody was asking - rather than as "what `t` means". This is a
  different failure from the rot this file is mostly about: the claim was true,
  current, precise and present, and the index was wrong. **When a bullet
  establishes what a FIELD means, say so in its own sentence, not only as the
  premise of the bug it was written for.**
- **`ttk_sec` IS NOT THE WRITE PATH'S QUANTITY.** `death_t` is
  `(last_alive_t + poll_t)/2`, so `ttk_sec` runs SHORT by
  `(poll_t - last_alive_t)/2` and nothing the row reports bounds that. DO NOT
  correct it with `poll_gap_sec / 2`: `gap_for()` reads `last_obs_t`, which
  advances on every ABSENT poll while `last_alive_t` stays put, and
  `poll_gap_sec` reads 0 on all 37 rows, so that correction no-ops. `death_hi`
  IS `iso(poll_t)`, so `death_hi - spawn_t` reconstructs the true upper bound
  exactly. The fix was right; the derivation first offered for it was not, which
  is its own instance of "a comment is a claim".
- **ANSWERED 2026-10-19: THE EVENT WINDOW IS AN ARRIVAL DEADLINE, NOT A
  COMPLETION DEADLINE.** Measured across all 14 `despawn` rows the bridge retained
  for 2026-10-17 to 2026-10-20: TWELVE went at essentially full health - `last_pct`
  100, 100, 100, 100, 100, 99.99, 99.88, 99.81 and four more at 100 - clustered at
  `elapsed_sec` 2402-2556 against `window_sec` 2400. An UNTOUCHED boss goes at the
  window, reliably. Against that, US II franky on 2026-10-19 logged `spawn 04:00:01`
  and `death 04:43:49` - 2,628s, 228s past the window - with no despawn row at any
  point, because the party was fighting it. So the window governs how long an
  unengaged boss waits to be REACHED; a damaged one can outlive it. The chain
  queue's deadlines are arrival deadlines.
- **BUT "DAMAGED MEANS IT PERSISTS" HAS EXCEPTIONS, AND ONE MAY BE A
  MISCLASSIFICATION.** Two of the fourteen despawned while damaged: crabxx US I at
  `last_pct` 97.52, `elapsed_sec` 2561; and crabxx EU III at **63.19% with elapsed
  2226 - INSIDE its own window.** The second is exactly what this section already
  calls counter-evidence: a low hp reading says something was killing it. Treat it
  as a candidate false positive in `stored_row_is_despawn()` rather than a boss that
  vanished at 63%, and do not design a deadline around the two-exception case
  without re-measuring.
- **A DESPAWN ROW IS NOT A DEATH ROW, AND GUESSING ITS FIELD NAMES COSTS A FALSE
  NEGATIVE.** `despawn` is its own `ev` value, so a filter on `ev === 'death'` never
  sees one - the retained log holds 1,095 deaths and 14 despawns. Its fields are
  `last_hp`, `last_pct`, `spawn_t`, `window_sec`, `elapsed_sec`, `reason`, NOT the
  `hp`/`max_hp` that spawn and death rows carry. Reading `hp_pct` or `pct` off one
  returns undefined, which looks exactly like "the bridge records no hp at death" -
  a reading published on 2026-10-19 and retracted the same hour.
- **`taxiProbeNote` AND `bossRank` BEGAN EXECUTING 2026-10-19**, when Dexon was
  measured byte-identical to committed v97; until then he ran `Party/Mage.js` out of
  the Ranger slot and neither had ever run. Kept because the entry above was answered
  from BRIDGE data rather than from that probe, so the probe's state is still the
  thing to check before citing it.

## Stopping and restarting a character's CODE

**Browser-driven session only.** Needs a live character tab.

- **`start_runner()` SAVES THE EDITOR BUFFER INTO THE VIEWED SLOT BEFORE IT
  RUNS ANYTHING - read "Deploying a code slot" before using the advice in this
  section.** A slot was destroyed this way on 2026-10-19. In the normal case
  the buffer already matches the viewed slot and the save is a harmless no-op,
  which is exactly why this is easy to miss; it bites when something has
  written to the buffer or `load_code` has pointed it elsewhere. Every
  "engage the runner" instruction below carries that cost.
- **`stop_runner()` and `start_runner()`, both called with no arguments.**
  Measured off the game's own markup rather than guessed: the Disengage control
  carries `onclick="btc(event); stop_runner()"` and Engage `start_runner()`.
  `stop_character_code` does not exist in either context, and reading the
  function sources is useless - they come back `[BLOCKED]` because they contain
  the code-slot token.
- **Stopping the runner DESTROYS the `maincode` iframe, and every game helper
  with it.** `change_server`, `smart_move`, `move` and `xmove` all live in that
  sandbox and are gone after a stop. The top window keeps a plain `move(x,y)`
  but NOT `change_server`, so a hop REQUIRES the runner engaged. `code_move`
  and `code_travel` do exist at top level and silently no-op with the sandbox
  down - they return `undefined` and the character never moves. To park a
  character and then hop it, engage the runner only long enough to call
  `change_server` and stop it again on arrival.
- **Top-level `move(x,y)` is straight-line and clips at walls.** It sets
  `going_x`/`going_y` to the last reachable point, so a long trip needs a
  waypoint chain with a stall check. Pathfinding exists only as `smart_move`,
  inside the sandbox.
- **`code_active` reads false synchronously right after `start_runner()`.**
  The sandbox takes a second or two to boot; check it again before concluding
  the restart failed.
- **A character left with its runner stopped on a foreign shard will die.**
  Lost Dexon that way on 2026-10-17: his script was engaged during the hop
  window, wandered to desertland without the priest, and died. `respawn()`
  also lives in the sandbox, not at top level, so reviving him needed the
  runner back up first.

## The loaded copy and the repo copy

**Both sessions.** Written to be byte-identical in both copies, so a hash
mismatch always means something and never means "that is just the other side's
wording". Nothing in this section says "this file" or "this copy" for that
reason - the two are always named. What makes a section un-mirrorable is DEIXIS:
a document that points at itself cannot be copied without lying, and the
previous version of this section did exactly that - repo-side wording sitting in
the loaded copy, claiming that file was canonical and that it differed from
itself.

- **The REPO COPY is canonical: `CLAUDE.md` on `main` in
  `joker17j-dotcom/Adventure-Land`.** The LOADED COPY is the `CLAUDE.md` in a
  session's working directory, which is what actually loads into that session.
  They are the same file only in a session whose working directory IS a clone of
  the repo, so measure with `git rev-parse --show-toplevel` rather than assuming.
- **MEASURED, so neither session has to guess which case it is in.** The
  Claude Code container, 2026-10-20: the working directory IS the clone,
  `CLAUDE.md` at its root is the file that loads (same inode as the tracked
  file), and `/home/claude/CLAUDE.md` does not exist there. So that session
  maintains ONE file, its drift check is `git status` rather than a hash
  compare, and everything below about two copies is the browser-driven
  session's to run. The browser-driven session's working directory is
  `/home/claude` and is NOT a clone, so for it they are two different files.
- **The loaded copy began as a 438-byte subset** that stated flatly "git push
  from the container fails" - the unqualified phrasing the Git section above
  warns against. It now carries the full conventions and runs a drift check
  before the first repo write of a session.
- **THE TWO COPIES ARE MEANT TO BE IDENTICAL, so the drift check is one call.**
  `git hash-object <loaded copy>` against `git rev-parse origin/main:CLAUDE.md`.
  A mismatch means exactly one of two things: the other session committed
  something not yet reviewed, or this session edited its loaded copy and has not
  pushed it. **This REVERSES the earlier "expect cosmetic drift; it is not worth
  a stop on its own"**, which was correct while sections differed on purpose and
  defeats the check now that they do not. Measured 2026-09-25, before the
  rewrite: 14 shared sections differed, 13 of them only in punctuation and
  emphasis - em-dashes flattened to hyphens, `FULLY` lowercased, lines reflowed,
  one sentence dropped from Testing. That drift is what the rewrite exists to
  stop recurring, which is why the measurement is kept as the REASON rather than
  deleted.
- **EITHER COPY IS ALLOWED TO BE AHEAD, and drift is a two-way diff rather than
  a one-way correction.** The 2026-09-25 check found the `Party/Merchant.js`
  version-header exception present in the loaded copy and missing from the repo
  copy, which would have walked the other session into prepending to a header
  that does not accumulate; it was carried INTO the repo copy rather than deleted
  from the loaded one. The repo copy holds the better prose by convention, which
  is a tie-break on wording and not a claim that it is more correct.
- **NEITHER COPY IS EVER AUTO-SYNCED FROM THE OTHER.** A session that finds a
  difference reports it and stops, because both copies are edited by both chat
  sessions and a difference may be something the user has not reviewed. This is
  the operator's standing instruction, not a style preference.
- **A HASH MATCH PROVES FIDELITY TO WHATEVER YOU AIMED AT, NOT THAT YOU AIMED
  CORRECTLY, and that cost the loaded copy three sections.** 2026-10-19: the
  browser-driven container was replaced and its loaded copy was restored
  byte-exact from `origin/main`, verified by `git hash-object` on both sides.
  The operator had asked for the most recent LOADED copy, which carried
  intentional differences - so matching the repo hash was proof the WRONG file
  had been restored. Three sections existed only in the loaded copy and were
  recovered from a handoff copy the operator still had; of the three, one was
  superseded by better repo text, one wanted rewriting rather than restoring,
  and one was a genuine loss (the `add_repo` guidance, now a bullet under Git).
  The restore also auto-synced the loaded copy from the repo, which the bullet
  above forbids. Ask which copy is wanted before restoring either.
- **Container reads go through git, not the API.** `curl` to api.github.com is
  refused ("GitHub access to this repository is not enabled for this session").
  Use `git fetch origin main && git show origin/main:<path>`. From a browser tab
  the contents API works fine.
- **Look for an existing clone before pulling source through a browser**, and
  find it with the SWEEP, never by a remembered path. Measured 2026-10-17:
  a container already held a clone of this repo and one of
  `adventureland_mongodb`, the game's server source, so a `git grep` answered
  server-behaviour questions in one call while Claude spent a morning
  fetching that same source through `raw.githubusercontent.com` in a browser
  tab and fighting truncated results. The sweep is
  `find / -maxdepth 4 -name .git -type d`, and it is worth one call at the
  start of any source-reading task.
- **NAME THE SWEEP, NOT THE PATHS. The paths differ per container, per
  session, and between the two sessions at the same moment.** This bullet
  used to cite `/tmp/alrepo` and `/tmp/almongo` as though they were fixtures.
  Measured 2026-10-18, the same hour, both containers: the browser container
  returned FIVE - three clones of this repo and two of the server source -
  while the Claude Code container returned TWO relevant ones and no
  `/tmp/alrepo` at all, plus unrelated toolchain clones (`/opt/rbenv`,
  `/opt/nvm`) that a "first match wins" habit would hand you instead.
  Neither list is the other's, and neither matches what this bullet named.
- **A FOUND CLONE'S IDENTITY AND AGE ARE BOTH UNKNOWN UNTIL MEASURED. A PATH
  IS NOT AN IDENTITY.** Same hour, same path `/tmp/almongo`: the Claude Code
  container held `kaansoral/adventureland_mongodb` at `2148cf25`, equal to
  upstream HEAD; the browser container held the OPERATOR'S FORK,
  `joker17j-dotcom/adventureland_mongodb`, at `9005216` - a clean ancestor
  330 commits behind, with `node/server.js` differing by 599 insertions and
  218 deletions. Two sessions said "the clone at /tmp/almongo" to each other
  all day and meant different repositories. A stale clone of THIS repo is
  the same hazard wearing different clothes: one of the browser container's
  three sat at `f8eebcd`, a v88-era commit.
  Three lines settle it, before reading anything:
  `git -C <clone> remote -v`, then
  `git ls-remote https://github.com/kaansoral/adventureland_mongodb HEAD`,
  then compare against `git -C <clone> rev-parse HEAD`. If they differ,
  `git fetch origin main` and read from THAT commit, not from HEAD. For a
  clone of this repo, `git -C <clone> rev-parse HEAD` against
  `git rev-parse origin/main` is the same check.
- **So cite the MECHANISM, and treat every line number as clone-local.** A
  mechanism survives a rebase; a line number does not. The six citations the
  stale fork produced - `:2263`, `:13163`, `:13146`, `:2671`, `:2712`,
  `:2281` - all point at unrelated code in current source, and the only
  reason none of them reached this file is that the other session's numbers
  were checked against a second clone rather than taken on trust. Every
  number in the drop-rolls block and the Hop Sickness block was read from
  upstream `2148cf25` and re-confirmed there on 2026-10-18.
- **The container's clone is SHALLOW** - `git log --oneline | wc -l` returns
  1. That is fine for reading the tree, which is what these questions need,
  and useless for any question about history: no blame, no "when did this
  change", no comparing two revisions. `git fetch --unshallow` first if the
  question is a historical one.
- **SHALLOWNESS DOES NOT INVALIDATE A DISTANCE WHEN THE BOUNDARY IS THE
  COMMIT YOU ARE MEASURING FROM.** Measured 2026-10-18 on the browser
  container's fork clone: `.git/shallow` contained its OWN HEAD (`9005216`),
  so truncation was entirely BELOW it and the upstream fetch supplied the
  whole chain above it - which is why the 330 figure above is the true
  distance and not an artefact. The one-call cross-check is
  `git rev-list --count <upstream>` equalling distance + 1 (331 here); dates
  bracket it independently, HEAD 2026-09-21 against upstream 2026-10-07.
  Without this, a reader meets "shallow" in the bullet above and "330" three
  bullets up and concludes one of them is wrong. A session nearly sent a
  correction retracting a sound number on exactly that reasoning.

## Browser tabs - the keeper

**Browser-driven session only.** The Claude Code session has no tabs.

- **Keep one tab parked on `https://adventure.land/hub` and never close it.**
  This is a deliberate exception to the habit of closing every tab you open. The
  MCP tab group auto-removes when its last tab closes, and that ejects every
  other tab in it, live character tabs included. The OPERATOR owns this choice -
  /hub is the current keeper, set by them on 2026-10-04 - and Claude may move it
  when a task needs a different page, saying so when it does. Tabs leaving the
  group is not automatically a fault: twice on 2026-10-04 Claude read its own
  disappearing tabs as a bug when the operator was simply managing them.
- **Closing the keeper is the hazard; navigating it is not.** Operator's
  correction 2026-10-17: "You can navigate the keeper just not close the
  keeper." Moving it to another page and back is fine when a task needs it.
- **ALWAYS pass an explicit `tabId` to `navigate`.** Without one it takes the
  group's FIRST tab, which is not necessarily the keeper - that is how a live
  Meltymerch tab was sent to GitHub mid-session and disconnected him. The
  earlier wording here blamed "navigating the keeper", which banned the safe
  act and left the dangerous one described only in passing.
- **Why that origin.** `adventure.land` is the only origin that can call
  `pull_merchants` (same-origin AND credentialed; cross-origin is blocked with
  no CORS headers, and `credentials: 'omit'` fails even same-origin), read
  `cstore_*` CODE storage, or call `api_call('save_code')`. The bridge on
  `127.0.0.1:8787`, ALData and the GitHub API are all reachable from it.
- **Why /hub rather than the bare origin.** Same origin, so everything above
  holds, plus a BANK button no character tab has - see the next section.
- **/hub is NOT a full game page.** `calculate_item_value` and
  `calculate_item_properties` exist only on a CHARACTER tab. Read item values and
  stats there; read the bank and the bridge from /hub. Measured 2026-10-04:
  probing /hub for those functions returns an empty candidate list.
- **The server buttons switch which server /hub MONITORS, and `server.status`
  (`S`) reports THAT server - not the server any character is on.** Measured
  2026-10-17: with /hub on EU II and all four characters on US IV, `S.mrgreen`
  described EU II's boss and matched the bridge's EU II row exactly. So a /hub
  boss read covers one server, and the button is what selects it.
- **Calling `select_login_server(...)` directly is a silent no-op.** Measured
  2026-10-17: no reload followed and `S` never changed - `pageAgeSec` was still
  8462 afterwards, which proves the page never reloaded. Click the button.
- **Claude got this backwards once.** It reported that /hub "does not follow
  the active server" when its own click one call earlier had already changed
  it, and credited the change to a character hopping. When a reading shifts
  right after you acted on the page, suspect your own last action first.
- **A boss's hp PERCENTAGE is not evidence that anyone is fighting it.** Only a
  CHANGE in hp across two samples, or a non-null `target`, separates a live
  fight from an abandoned one. Measured 2026-10-17: ASIA I's mrgreen sat at
  exactly 28,088,505 hp (78%) for over five hours, and US III at 15,417,063 for
  24 minutes. Claude called the first "actively being fought" on the strength
  of the percentage alone. Sample twice before claiming a fight.

## Reading the bank without travelling

**Both sessions.** `api_call` is a function in the CODE context, not just on a
tab, so this is not browser-only.

- **`api_call('load_bank', {})` returns the whole bank FROM ANYWHERE.** No bank
  map, no character moved, no snapshot to keep in sync. It answers
  `{success, gold, packs}`, where `packs` is `items0..itemsN` arrays of
  `{name, level, q}`. Measured 2026-10-18 from TWO different characters' CODE
  contexts - Dexon on `halloween`, FatherToken on `main`, neither anywhere
  near a bank - both returning all 7 packs and 74,822 items.
- **This is what the /hub BANK button calls.** `render_comm_bank()` FETCHES
  despite the name; it is not a render over data that was already there. The
  button was never the mechanism, just the only caller anyone had noticed.
- **`character.bank` is still null anywhere but inside the bank map.** That is
  a fact about that one property, NOT about the account bank, and conflating
  the two is what made a bank read look like it required travel. `arbProbeBank()`
  in `Party/Merchant.js` exists to time that round trip; for READS it is now
  unnecessary. `Party/Merchant.js` v101 uses `load_bank` to cap Ponty purchases
  at one full stack already held.
- **`bank_packs` is NOT the contents.** It is the pack-name table (48 entries).
  The contents are `comm_items.bank` on /hub, or `packs` from `load_bank`
  anywhere. Measured 2026-10-18: the account owns 7 packs, so a 7-pack read is
  a COMPLETE one - do not read 7-of-48 as truncation.
- **ALData does NOT solve this and is not worth the key.** `PUT /bank/:owner/:key`
  UPLOADS a snapshot and `GET /bank/:owner` reads it back, so something still
  has to be in the bank to produce it - plus a 48,000-gold in-game mail for a
  key the docs themselves say is stored in plaintext. `load_bank` needs none of
  it. The script already uses ALData for market rows only, read-only, no key.

## Diagnosing a running character

**Both sessions.** The `adventureland` MCP server needs no tab; the
`parent.localStorage` round-trip at the end of this section does, so the
Claude Code session stops after `browser_code_eval`.

- **Use the `adventureland` MCP server, not a browser tab.** `browser_code_eval`
  runs JS in a character's CODE context with no tab access at all, which makes
  the whole tab-dragging problem irrelevant for diagnostics. Call
  `browser_code_status` first: connected, and is CODE running.
- **It returns `queued`, never the value.** Round-trip results by writing to
  `parent.localStorage` in the snippet and reading that key from the keeper tab.
  Remove the keys afterwards.
- **`[BLOCKED: ...]` SUPPRESSES THE RESULT, NOT THE EXECUTION.** The snippet
  ran. Reading a blocked result as "nothing happened" and re-sending it is how
  a probe that writes or deletes gets done twice - learned the expensive way
  when a blocked read had already removed the counter it was reporting on, so
  a completed probe read as a failed one. Never re-send a mutating snippet
  because its result came back blocked; re-read the state instead.
- **THE KEY-NAME RULE IS NOW MEASURED, AND IT IS PLAIN CASE-INSENSITIVE
  SUBSTRING MATCHING.** This bullet said "not predictable" until 2026-10-19 and
  that was too pessimistic for the key-name half. Controlled test, identical
  integer values with only the key name varying - BLOCKED: `token`, `auth`,
  `secret`, `password`, `apikey`/`api_key`, `credential`, `bearer`,
  `session_id`; `cookie` blocks with its own `[BLOCKED: Cookie access]`. NOT
  matched: a bare `key` - `keys`, `keyTest` and `monkey` all pass - and
  `passwd`. Because it is substring matching it eats ordinary words: `author`,
  `authority`, `coauthor`, `secretary`, `tokens`, `tokenize`, `subtokens`,
  `passwordless` are all suppressed. One asymmetry left unexplained rather than
  theorised about: `cookies` blocks but `nocookie` passes, while `subtokens`
  blocks - so `cookie` is not matched the way `token` is.
  **This explains all four earlier incidents at once**, including the one this
  bullet recorded as an unconfirmed lead: FatherToken's entry was blocked
  because his NAME contains "token", and the `Object.keys(PROBE_API).length`
  case that was briefly read as a counterexample was a second instance - the
  key was `probe_api_keys`, which contains `api_key`. A retraction was issued
  on that reading and then withdrawn.
  **So name result keys away from that list**, and for character-keyed data
  read `X[character.name]` into a local and emit derived fields only - the
  blocked KEY then never appears in the result. `Tests/suite_features.js`
  asserts no `PARTY_BUILD` feature key lands on the list; the character-name
  key cannot be fixed that way and does not need to be.
- **The VALUE side is still unpredictable, so keep it out of the payload.**
  Measured 2026-10-12: a 24-character instance id came back
  `[BLOCKED: Base64 encoded data]`. His attack and frequency are still
  unmeasured because of it. `document.hidden` and `document.visibilityState`
  trip it reliably. Report DERIVED facts - a length, a boolean, a brace depth,
  a count - and where the raw value is needed, have the GAME read it rather
  than moving it through a tool result:
  `enter("crypt", parent.localStorage.getItem('crypt_instance'))` never puts
  the id in a result at all.

## Deploying a code slot

- **`start_runner()` IS NOT A RUN BUTTON. IT SAVES THE EDITOR BUFFER INTO THE
  VIEWED SLOT, THEN RUNS IT. TREAT IT AS `save_code` WITH AN INVISIBLE TARGET.**
  This is the most destructive call in this file and it was learned by
  destroying a slot: a 3-line probe was `setValue`'d while the editor viewed
  Meltymerch's MERCHANT slot, `start_runner()` was called, and the slot became
  185 characters. Confirmed with `get_code`; the save-counter went 168 -> 171.
  The operator restored it from the repo in seconds, which is the only reason
  it cost nothing. **Before calling it, read `get_code_slot()` AND check what
  `codemirror_render` holds**; if the buffer is not what belongs in the viewed
  slot, that call overwrites the slot. Sibling hazard to "a live slot can be
  ahead of the repo": a live slot can also be REPLACED BY A STRAY EDITOR
  BUFFER, with no warning either way.
- **THE THREE FUNCTIONS, each measured 2026-10-19, and the model that fits every
  observation.** The editor VIEWS a slot and `codemirror_render` holds that
  slot's content; the ENGAGED slot is what a page load runs. They are not the
  same thing and nothing on screen says so.
  - `load_code('8')` changes the VIEWED slot ONLY, and is ASYNCHRONOUS -
    returns undefined, buffer changes about a second later. Engaged slot and
    running script untouched. This reproduces the "loaded but not engaged"
    hazard state on demand.
  - `load_code_s('8')` is a SILENT NO-OP: returns normally, changes nothing,
    throws nothing. An earlier entry here guessed it "may ENGAGE a slot" and
    was wrong. `load_code` is the loader.
  - `get_code_slot()` takes no arguments and returns the ENGAGED slot id. It is
    the ONLY read that separates engaged from viewed.
  So when viewed == engaged, a `start_runner()` change survives a reload,
  because the engaged slot's CONTENT changed. When viewed != engaged it runs
  now, the save lands on the OTHER slot, and a reload returns to the engaged
  slot - which LOOKS transient. One mechanism, two pairings; neither
  "transient" nor "durable" is true on its own. Unresolved and not worth
  chasing: whether the save is unconditional or only fires on a dirty buffer -
  where the buffer already matched the slot the two are indistinguishable, and
  the operational rule is the same either way.
- **`load_code` serves a cached copy, so the running script outlives a
  `save_code`.** The character keeps running the old build until the page is
  FULLY reloaded. `start_runner()` is the exception and not a counterexample:
  it runs the buffer immediately BECAUSE it saves it first. An earlier version
  of this bullet called that "engaging a slot swaps the script immediately",
  which reported the effect and missed the write. Verify by feature-
  detecting something only the new build has, not by the slot version number.
  The next two bullets are what "feature-detect" has to mean in practice;
  both measured by the browser session on 2026-10-18, on the same character,
  in the same probe.
- **Feature-detect FUNCTIONS, never persisted state.** CODE storage outlives
  the script that wrote it - which is the exact property the relay-cursor fix
  in Ranger v91 / Priest v52 / Mage v75 RELIES on - so a persisted key proves
  nothing about what is running. Measured: `get("pl_cursor")` returned 210 on
  Meltymerch while `plStatus`, `pontyStatus`, `arbNeverList`, `mluckOppDump`
  and `gearProbeTripwire` were every one undefined. The value was a leftover
  from the last time `Party/Merchant.js` ran. The same durability that makes
  the fix work makes its own key worthless as evidence of it.
- **A SLOT'S NAME IS NOT ITS CONTENTS, and this entry's own example was
  misdescribed because of it.** Measured 2026-10-19: there are twelve numbered
  slots plus one character slot each, and scripts are SELECTED rather than
  pasted between them. SLOT 8, NAMED "Exchange Xyn", CONTAINS `OpenGifts.js`
  v11 - 86,867 chars, 1,572 lines, a 17,553-character line 2, all eight
  OpenGifts CONFIG keys, `runLadders`/`castBuff`/`skillReport`/`bowAtTarget`
  present and `bowDone` absent. So the "Xyn exchange script" named below is not
  a separate script at all; it is OpenGifts in a slot whose NAME is stale. The
  lesson holds, the example did not. Merchant v104 did not displace OpenGifts
  either - different slots, which is why `OpenGifts.js` carries no `CH_` token
  in its header while all four party scripts do.
- **Absence of a feature can mean a DIFFERENT SCRIPT, not an older build.**
  Same character, same probe: no Merchant symbol resolved because
  `Party/Merchant.js` was not loaded at all - Meltymerch was running what that
  slot's stale name calls the Xyn exchange script, whose CONFIG keys are
  `boxes`, `minFreeSlots`, `autoSell`, `sellEvery`, `compound`, `bow`, `hub`,
  `maxConsecutiveFailures`.
  `CONFIG.homeServer` and `parent.MERCHANT_VER` coming back undefined read
  exactly like a stale pre-v100 merchant and were nothing of the kind; the
  slot held v103 throughout. Establish WHICH SCRIPT is loaded before
  concluding anything about WHICH VERSION - one positive identification of
  the running script beats any number of negative version probes. The browser
  session got this wrong in a paste block and retracted it.
- **The MCP `save_code` cannot carry a character script.** It is whole-slot
  REPLACE with no patch or append verb, and `code` is a single inline string,
  so the entire file has to be emitted as one tool argument. Measured
  2026-10-17: `Party/Mage.js` is 235,874 bytes and `Party/Ranger.js` 406,619,
  past what one response can produce - Ranger decisively. `get_code` is no
  help either, because it pulls that same full size INTO context. Both
  directions are full-size, so there is nothing for a delta to chunk against.
  The tool is fine for the small slots - Kill Count, Lucky Slot, Cave.
- **`codemirror_render` already holds the live slot source, with the CODE panel
  CLOSED.** This is the lever that makes a delta deploy possible at all. On a
  character tab it is a CodeMirror 5 instance exposing `getValue`, `setValue`
  and `replaceRange`, populated before anything is opened - measured
  2026-10-17 on Dexon at 372,989 units while `.cm-content` was absent from the
  DOM entirely. So the browser can fetch the target from the GitHub contents
  API, hash it, and set the document without the file ever passing through the
  conversation, which is what makes the size problem above irrelevant on this
  route. The save step itself is classifier-gated.
- **Do NOT pull the slot source into a tool result - the version-header line
  carries the slot token**, which is exactly what comes back `[BLOCKED]`.
  Report derived values instead: a length, a line count, a hash, per-block
  hashes. That is enough to identify a build exactly.
- **A LIVE SLOT CAN BE AHEAD OF THE REPO, AND NOTHING RECORDS IT.** The
  deployment markers in the version header only ever say the repo is ahead of
  the slot. There is no marker for the reverse, and the reverse is the one that
  bites, because a wholesale paste silently reverts it. Measured 2026-10-17:
  Dexon's live slot matched NO committed build - 372,989 UTF-16 units against
  v82's 372,979, same line count, no trailing newline - and block-hashing
  found five hand edits, every one of them deliberate operator config:
  `'mole'` appended to `singleTargetMobs`, `monsterHunt.enabled` false, the
  achievement queue `enabled` true, and both `booboo` entries commented out.
  Pasting the repo build over that would have flipped the party back to monster
  hunt and re-enabled booboo in the middle of an achievement grind. Priest and
  Mage were byte-identical to v47 and v70, so this is NOT uniform across the
  party - check each, never assume.
- **How to check, in three cheap steps.** Hash 100-line blocks of
  `codemirror_render.getValue()` inside the page and compare them with the same
  blocks computed from the candidate commit; for each block that differs, hash
  its individual lines and compare those; then read only the few differing
  lines, which is safe because the slot token is not on them. Three round trips
  located five changed lines in a 7,217-line file.

- **ANY MARKER PUBLISHED ON `parent.*` OUTLIVES THE SCRIPT THAT PUBLISHED IT.**
  Measured 2026-10-19 across four states: with OpenGifts v11 running after a
  `start_runner()` swapped the script in place, `parent.MERCHANT_VER` still read
  104 and `parent.PROBE_API` was still present. Nothing clears them, so the deploy marker answered "Merchant
  v104 is live" for a character not running Merchant at all - a confident false
  positive, the one answer a deploy check must never give. The iframe `typeof`
  answered correctly in all four states; both `parent.*` markers answered wrongly
  in the fourth.
  This is the same shape as "feature-detect FUNCTIONS, never persisted state"
  above, by a different mechanism - page globals rather than CODE storage - and
  it lands on every marker either session has built. **So read the live lexical
  scope, not the global.** None of the four PARTY scripts is IIFE-wrapped -
  measured by brace depth 2026-10-20, not inferred from indentation, and
  `CaveRun.js` IS wrapped by contrast - so `PARTY_SCRIPT` and the script's own
  functions are top-level bindings in the CODE context, destroyed and rebuilt
  with the script;
  `browser_code_eval` already runs there. `parent.PARTY_BUILD` and
  `parent.MERCHANT_VER` are for a reader who is NOT in that context, and a
  disagreement between the two means the GLOBAL is wrong.
  Partial mitigations shipped in Ranger v98 / Priest v56 / Mage v79:
  `parent.PARTY_BUILD` is replaced wholesale rather than merged, so a
  party-to-party swap is self-correcting, and each record carries `at`. Neither
  helps when the incoming script knows nothing about the marker, and no
  cross-clearing scheme fixes that without every script transcribing every
  other script's marker names.
- **THE BUFFER REPORTS THE SLOT THE EDITOR HAS LOADED, NOT THE SCRIPT THAT IS
  EXECUTING, and that is a stronger statement than this section's "it holds
  THIS character's active slot".** Measured 2026-10-19 with slot 8 loaded and
  NOT engaged while Merchant v104 ran: the buffer held OpenGifts. A header read
  taken then returns another script's version. `merchantHeaderVersion()` did
  exactly that and returned 2 - OpenGifts' oldest history entry - which v105's
  memoisation would have cached for the life of the page. Fixed in Merchant v106
  by requiring the full `(Merchant)` header shape so a foreign buffer yields
  null; see "Version headers". **The fix was then proven IN that state rather
  than argued**: with the editor viewing OpenGifts and Merchant v106 executing,
  `merchantHeaderVersion()` returned null, the ungated regex was measured
  beside it returning 2, and the memoised `merchantVersion()` held 106 with
  `parent.MERCHANT_VER` 106 and `merchantBuild()` "v106".
- **A DEPLOY IS PER-SLOT, AND IS NOT VERIFIED BY HAVING BEEN PERFORMED.** "The
  operator pushed the files" is not "the files are live on every character", and
  the gap is not visible from here. Three times on 2026-10-18 a session asserted
  a build was live on the strength of the deploy having happened and was wrong
  each time, including reporting Ranger on v96 while v95 was live, which the
  operator had to correct. Measure the slot you actually mean, each one, every
  time. Priest and Mage being byte-identical to their committed builds while
  Dexon's slot matched none of them, measured 2026-10-17, is the same lesson
  from the other direction: the party is not uniform.
- **WHICH SCRIPT IS RUNNING IS NOW PUBLISHED, AND IT IS A DIFFERENT QUESTION
  FROM WHICH VERSION.** Ranger v97 / Priest v55 / Mage v78 each set
  `parent.PARTY_BUILD[<character name>] = { script, features }`, where every
  value in the table is a live `typeof` of the identifier beside it, so an
  absent function is filtered out instead of published. The three key sets are
  disjoint, so ONE read names the script. Read it as
  `parent.PARTY_BUILD[character.name].script`, never as a wholesale dump of the
  object - FatherToken's key contains "token" and his entry is suppressed by the
  result filter, per "Diagnosing a running character".
  **It was built because a version number could not catch what happened**:
  Dexon, a RANGER, was found running `Party/Mage.js` out of the Ranger slot, and
  the slot header read v77 - a real, current, valid-looking version, just the
  wrong script's. A version marker would have reported that the deploy took.
  **It answers WHICH SCRIPT, not WHICH VERSION**: the list grows as features
  land, so a missing key cannot be told apart from a key nobody added. Version
  stays with feature-detecting the specific function a build introduced.
  `Party/Merchant.js` deliberately does NOT carry this - it publishes
  `arbProbeBuild()`'s `api` list, which is the same idea and predates it.
- **READING A SLOT HEADER IS CHEAP, AND THE REASON BOTH SESSIONS AVOIDED IT WAS
  NOT TRUE.** `get_code` returns whole slots, but the MCP writes an oversized
  result to a FILE rather than into context - so `jq`/`python` can pull just the
  first two lines of `code.code` with the `CH_` token masked. That is a full
  header read on a 464 KB slot for no context cost and nothing token-bearing in
  the result. The bullet above warning against pulling slot source still holds
  for pulling it INTO a result; it never applied to reading it out of a file.
  For the three slot functions and what each actually does see the model at the
  top of this section - `load_code_s` was guessed here to "may ENGAGE a slot"
  and is in fact a silent no-op.
- **WHEN THE SLOT ACTUALLY ARRIVES, measured 2026-10-19 on a cold load sampled
  from t=0.** `parent.codemirror_render` is PRESENT at t=1ms holding the game's
  1,118-character tutorial template; the real slot arrives at t=1833ms; CODE
  first evaluates at t=1961ms. So "present" and "holds the slot" are about two
  seconds apart and a presence check reports success for that whole window. A
  read at module load does win - by 128ms - but slot arrival moved to t=2224ms
  on the very next load of the same page, a 391ms swing, three times that
  margin. A third sample: slot 2,163ms, script up 2,298ms, margin 135ms. So the
  MARGIN is stable across loads (128/135ms) while slot ARRIVAL is not
  (1,833-2,224ms), which is the combination that keeps the retry justified -
  what varies is larger than what protects you. So a header read at load is correct in practice and must still retry;
  see `Party/MerchantComments.md#header-read-ordering`. The template's line 2
  carries no trailing v<digits>, so the pre-slot failure is FAIL-NULL and never
  FAIL-WRONG, which is the only thing that makes caching a first non-null read
  safe.
- **`codemirror_render` IS ALSO REACHABLE FROM THE CODE CONTEXT, not only from a
  tab, AND IT HOLDS THAT CHARACTER'S OWN ACTIVE SLOT** rather than whatever the
  editor last had open. The bullet above describes the tab-side instance; this is
  the same object reached as `parent.codemirror_render` from inside running CODE,
  which is what lets a script read its own header - `merchantHeaderVersion()` in
  Merchant v104 does exactly that, see "Version headers". Measured 2026-10-18:
  Meltymerch's buffer was the OpenGifts slot while OpenGifts was his running
  script, and Dexon's reported 95 while v95 was live. The residual is this
  section's own warning - it is the EDITOR's document, so between a `save_code`
  and a full reload it holds the NEW source while the OLD build runs, and a
  runner restart over a cached build would report the buffer. Feature detection
  stays the authority.

## Helpers that may not exist - use typeof, never truthiness

- **Referencing an undeclared identifier THROWS.** It does not evaluate to
  `undefined`. `typeof x === 'function'` is the only safe test, and a ternary
  written as a guard is itself what explodes.
- **Form A - the throw escapes and kills the caller.**
  `const nearby = (get_entities ? get_entities({...}) : []) || [];` was the
  first line of `attackWithRotation`. The rotation loop and the plain
  `attack()` below it never ran; `rangerTick`'s catch turned it into a
  console.error nobody read. Three rangers stood next to monsters for hours.
  Measured: 37 calls, 37 throws, 30 seconds.
- **Form B - a catch swallows it and returns a plausible lie.**
  `try { return ms_to_next_skill(name) <= 0; } catch (e) { return true; }`
  made every cooldown gate in FamilyFleet a no-op that always answered
  "ready". Worse than Form A: nothing looks broken.
- **`undefined + undefined` IS THE TRUTHY STRING "undefinedundefined", WHICH IS
  WHY A CONCATENATION OF TWO MAYBE-MISSING FIELDS CANNOT BE TESTED FOR
  TRUTHINESS.** 2026-10-20, in Priest/Mage v58/v81's pending-hop resolver:
  `here = parent.server_region + parent.server_identifier` followed by
  `if (!here) return;` never returned, because that string is non-empty - and
  it compares unequal to every real shard, so an UNREADABLE shard read as a
  WRONG shard and the resolver retried a hop that may already have landed. Both
  halves are type-checked before concatenating now. Found by the suite rather
  than by reading, which is the only way it was going to be found: the
  expression looks exactly like a guard.
  **The same bare concatenation is still in `bossHopFollow`'s same-shard guard,
  and there it is benign** - a garbage value simply fails to match, the guard
  turns itself off, and its own comment says so. So the hazard is not the
  expression, it is what the comparison DOES on a non-match: ignore it, or act
  on it.
- **A catch that returns a default must log,** or "the helper is missing" and
  "the default is correct" stay indistinguishable forever.
- **Which helpers exist is not guessable, AND IT VARIES BY CONTEXT.** There is
  no single "the live CODE context" - treat any recorded list as a lead, not a
  fact, and re-measure `typeof` in the context you are actually in.
  Measured in FamilyFleet's context: UNDEFINED - `get_entities`,
  `ms_to_next_skill`.
  Measured 2026-09-22 in Dexon's browser CODE context: `ms_to_next_skill` is a
  FUNCTION returning 0, while `get_entities` is still undefined.
  FUNCTION in both: `is_on_cooldown`, `get_chests`, `loot`,
  `get_nearest_monster`.
- **`ms_to_next_skill` is OURS, not the game's, and that is the whole of the
  difference.** The bullet above files it alongside `get_entities` as a
  context-varying game helper. It is not one: all three party scripts declare
  their own, so it is a FUNCTION wherever one of them is loaded and UNDEFINED
  in FamilyFleet for the single reason that `FamilyFleet.js` never declares it.
  Verified 2026-10-17 against the reorganised repo - `Party/Ranger.js:4374`,
  `Party/Priest.js:3873`, `Party/Mage.js:1520`. So read the 2026-09-22
  measurement as "Ranger.js was loaded in that context", never as "browser
  CODE contexts provide it" - the second reading would walk a new script
  straight into the Form B above, which is exactly what it did in FamilyFleet.
- **Trusting the recorded line cost a wrong diagnosis.** `actionLoop`'s
  `ms_to_next_skill('attack')` was named as the reason the party would not
  attack, on the strength of this file saying it was undefined. It was
  innocent; the real cause was background-tab throttling (see below). One
  `typeof` check would have skipped the detour.
- **CaveRun's Form A SURFACE WAS MEASURED INERT ON 2026-10-19 - do not reopen it on
  a reading.** Eight `isFn(` call sites pass a BARE identifier, which evaluates it
  and therefore throws if it is undeclared: `isFn(can_move_to)` is Form A, not a
  guard against it, and two of the eight sit outside any try/catch. Five identifiers
  are involved - `can_move_to` (3), `can_attack` (2), `is_on_cooldown`,
  `is_in_range`, `get_nearest_monster`. Measured live in the CODE context of all
  three combat characters: every one resolves, by `typeof` AND by the
  argument-passing test, and a live `can_move_to()` call returns a boolean. None is
  declared in `Party/*.js`, `CaveRun.js` or `Codex/`, so all five are game-provided
  and the measurement transfers between contexts - which is the check the
  `ms_to_next_skill` bullet above exists to force. Rewriting eight sites in a script
  that drives three live characters was correctly declined on the strength of this.
  CaveRun v16 carries the same note at the `isFn` declaration, where a reader of
  `isFn(can_move_to)` lands.

## Diagnose by instrumenting, not by reading

- **Wrap the live function and count.** Wrapping `farmTick` /
  `attackWithRotation` gave 37 calls and 37 throws in 30 seconds and found the
  bug immediately. Wrapping `smart_move` gave ZERO calls in two minutes, which
  is what disproved "he is firing movement commands too often" - he was never
  setting off.
- **Reading produces confident wrong theories.** Killed by measurement this
  way: requestAnimationFrame suspension, a 240 KiB CODE size cap, the
  placeholder roster, and caching as the cause of the repeated-listing loop.
  Every correct diagnosis came from instrumentation.
- **A NULL FROM A FIELD YOU NEVER CONFIRMED EXISTS IS NOT A MEASUREMENT.** It is
  indistinguishable from a null from a field that is genuinely empty, and it reads as
  a finding. 2026-10-19: a despawn row's health was read as `hp_pct` and then `pct`,
  neither of which that row carries, and the resulting nulls were published as "the
  bridge records no hp at death" - from a `limit=600` window running 06:28 to 01:00,
  which could not have contained the 04:40 rows in question either. Two independent
  errors, one conclusion, stated with confidence. `Object.keys` one real row before
  extracting from any of them, and read the time span of the sample you actually
  pulled rather than the one you meant to.

## Chrome throttles background tabs - it looks exactly like dead code

**Both sessions must know this; only the browser-driven one can observe it.**
If you cannot check `document.hidden` yourself, do not conclude a loop is dead -
ask the other session to measure first.

- **THIS IS THE FIRST THING TO CHECK when a character looks idle.** A hidden
  tab's timers are clamped to roughly 1s, then to about 1/minute after a few
  minutes hidden. Measured 2026-09-22: `setInterval(fn, 100)` fired every
  ~800ms in a hidden tab, and a 400ms sampler degraded to one tick per 17s.
- **Only ONE tab per window is `visible`.** Every other tab in that window is
  hidden regardless of where the window sits or whether it has focus. Creating
  a tab does not make it active, and a fresh tab starts hidden and throttled.
- **The character scripts are setTimeout chains, so a background character runs
  in slow motion.** Dexon landed 4 attacks/minute where 60-120 were due, while
  /hub showed him online with `code_running: true`.
- **This produced a WRONG diagnosis and a shipped fix that addressed nothing.**
  Loop-iteration counts of "0 in 20s" were read as a hung promise; they were
  throttling. Before concluding any loop is dead, check `document.hidden` AND
  measure a plain `setInterval(fn, 100)` in that same tab. If it is not firing
  ~10x/second, the tab is throttled and every rate measured there is
  meaningless.
- **Fix: start Chrome with throttling disabled.**
  `--disable-background-timer-throttling --disable-backgrounding-occluded-windows
  --disable-renderer-backgrounding`. There is a desktop shortcut on the user's
  machine, `Adventure Land (no throttle).cmd`. Verified 2026-09-22: the same
  hidden tab went from ~800ms gaps to a flat 100ms - 40 ticks in 4.0s.
- **The flags apply ONLY to a brand-new Chrome process.** If Chrome is already
  running, launching with flags hands the URL to the existing process and every
  flag is silently ignored, with no error and nothing visibly wrong. Chrome must
  be fully closed first, tray icon included. The shortcut refuses to launch when
  it detects a running chrome.exe, for exactly this reason.
- **Claude cannot fix this from inside the browser.** There is no tool to focus
  a Chrome tab (create and close only), and computer use grants Chrome tier
  `read`, so it cannot click one either. Only the user can change which tab is
  active - or launch with the flags, which makes focus irrelevant.

## Movement ownership - one strand at a time

**Both sessions.** Found 2026-10-18 from a symptom the operator noticed, not by
reading.

- **`bossApproach` and `holdCohesion` are MUTUALLY EXCLUSIVE strands, and that
  is how the party split.** `shouldHandleEvents()` is
  `holidaySpirit || !!bossPick() || !!bossState.trip`. While it is true,
  `handleEvents()` owns movement and `holdCohesion()` - which sits in the
  `else if (CONFIG.movement.enabled)` branch - never runs at all. So a boss
  being merely PICKED, with no trip under way, was enough to stop the party
  holding together. Fixed in Priest v54 / Mage v77 and verified live.
- **TWO STATE MACHINES OVER ONE DECISION WILL DISAGREE, AND THE ONE THAT ASKS
  FIRST WINS SILENTLY.** `bossHop.tick()` asks `localTarget()` before
  `pickTarget()`, and anything truthy commits FIGHTING and returns - so the
  give-up cooldown, which lived only in `bossEligible()` on the local-pick path,
  was invisible to the hop path. Observed live 2026-10-19: the combat side gave
  up on US II franky at 04:20 and cooled it down, while bossHop went on believing
  it was fighting it because `localTarget()` still saw 106M of live boss standing
  there. For 23 minutes `pickTarget()` was returning a franky two shards away at
  ~15.9 SECONDS of required dwell and no hop fired. Cost two franky credits and
  their keys. Ranger v99 gave both paths one `bossCooledDown()`.
  **The general rule: when two components can both decide the same thing, find
  the one that is asked FIRST and check what it does not know.** A disagreement
  there produces no error and no log line - it just produces inaction, which
  reads as "nothing was available" rather than as a fault.
- **v99 WAS HALF THAT FIX AND THIS FILE CALLED IT THE WHOLE ONE until
  2026-10-20. ARRIVING IS NOT FIGHTING.** `bossHop` commits FIGHTING from
  `localBossLive()` alone and performs no movement; what walks the party to a
  boss and attacks it is `handleEvents()`, gated by `shouldHandleEvents()` =
  `holidaySpirit || !!bossPick() || !!bossState.trip`. After a give-up the trip
  is null and `bossPick()` goes through `bossEligible()`, which a TYPE-keyed
  cooldown refused on every shard for 30 minutes - so v99 sent the party to US V
  and left it farming ordinary mobs beside the franky it had travelled for,
  until `maxFightMs` aborted. Fixed in v103 by keying the cooldown
  `(type, shard)`; see `Party/RangerComments.md#shardKeyedCooldown`. **A THIRD
  FAILURE MODE FOR TWO STATE MACHINES, after "they disagree" and "one cannot see
  the predicate": one of them is never ASKED.** `bossHop` decided to fight and
  `bossPick` decided whether to approach, and fixing the decider left the
  executor refusing.
- **SO ASSERT ON THE FAR SIDE OF A HANDOFF, NOT THE NEAR SIDE.** v99's suite
  asserted that `localTarget()` skips a cooled boss and that `pickTarget()` does
  not - both true, both still true, and both about which target is CHOSEN. Not
  one assertion covered whether the fight then happens, because that is
  authorised by a different function in a different subsystem. The assertion
  boundary stopped exactly where the defect began, which is why a green suite
  and a live loss coexisted for a day. Mutation testing cannot find this either:
  every mutation of the code under test failed a test, as it should.
- **TWO COHERENT CONFIGURATIONS, AND HALF OF EITHER IS A DEFECT.** v99's
  asymmetry (gate the HERE selector only) is correct with a TYPE-keyed cooldown,
  because a type-wide entry on `pickTarget` blocks the hop. v103's symmetry
  (both selectors gate, each on its own shard) is correct with a SHARD-keyed
  one. Changing the key without the placement, or the placement without the key,
  reinstates a measured loss - the suite pins both halves and the inverted
  assertion is kept rather than deleted so the pairing is visible.
- **A SHARED PREDICATE READ FROM ONLY ONE CALL SITE IS NOT YET SHARED.** The
  cooldown comparison was a single inline expression inside `bossEligible()`, so
  nothing had drifted and nothing looked wrong; it was simply unreachable from
  the other path. The hazard is the mirror of the drift this file warns about
  everywhere else - not two copies disagreeing, but one copy that half the code
  cannot see. Extracting it is the same remedy either way.
- **When one branch owns movement, check what the OTHER branch stopped doing.**
  The bug was not in the code that changed; it was in the code that silently
  stopped being reached.
- **The ranger diverged from the other two and the divergence was invisible.**
  It walked to an unreachable boss where priest and mage did not, because
  `bossTaxiWalkable` and the walk fall-through landed in Ranger v94 alone. See
  "Testing" for the byte-identity assertion that now catches this class of drift.

## Self-chained async loops: a real hazard, but NOT what was wrong

- **Every loop in Ranger/Priest/Mage is `async` and schedules its own next tick
  only after its body resolves.** A THROW is handled everywhere already - each
  loop reschedules from its catch, or after it. A HANG is not: an awaited call
  that never settles ends the chain, permanently and silently.
- **The hazard is real** - `use_skill()` and `smart_move()` can both leave a
  promise unsettled. The proven case is the travel deadlock
  (`travelState.inFlight` stuck true with `failures: 0`), which already had
  `travelWatchdog` for it.
- **But it was NOT why the party stood idle.** That was background-tab
  throttling (section above). `noHang()` shipped in Ranger v51 / Priest v26 /
  Mage v50 on evidence that did not support it. It is harmless defensive code
  and it stays, but do not cite it as the cure for an idle party, and do not
  repeat the reasoning that produced it.
- **`noHang(promise, label, ms)`** bounds an awaited call and rejects on timeout
  into the loop's own catch, so the tick is lost and the chain is not. It wraps
  only awaits appearing DIRECTLY in a loop body; a hang deeper in a helper
  propagates up to that await and is bounded there. It logs on a throttle.
- **A left-behind instrumentation wrapper is itself a confound.**
  `orig.apply(this, arguments)` from a bare call site passes a different `this`
  than the game does. Reload the tab to strip wrappers before any measurement
  you intend to report.

## Reading a running script's state

**Browser-driven session only.** Needs a live tab.

- **Script functions live in the `maincode` iframe, not the top window.**
  At top level `window === parent`, so checking there returns `undefined` for
  everything and looks exactly like a silent load failure. v43 was wrongly
  called dead on that basis.
- **`const state`, `CONFIG`, `fleetState` are block-scoped and not on
  `window`.** Reach them with `frame.contentWindow.eval('...')`.
- **COLUMN POSITION AND BRACE DEPTH ANSWER DIFFERENT QUESTIONS, AND BOTH
  SESSIONS COLLAPSED THEM INTO ONE ON 2026-10-20.** "Can `lift()` reach a
  declaration" is answered by COLUMN, because lift anchors its patterns at `^`.
  "Is the file wrapped, so are its internals reachable by indirect eval from the
  CODE context" is answered by BRACE DEPTH or by the opening token, and column
  position cannot answer it at all - an author can wrap a file without indenting
  the body, which is exactly what `CaveRun.js` does. One session argued not-wrapped
  from 86 column-0 declarations; the other argued wrapped from a trailing `})();`
  with no check of the declarations. Neither read the HEAD of the file, where
  `CaveRun.js:52` says "EVERYTHING IS WRAPPED IN AN IIFE" eight lines above the
  opener, and `:31`'s own changelog says "v4 ... IIFE wrapper". The cheap
  discriminator is `head -60 <file> | grep -n '(function'`.
- **A METHOD ON AN OBJECT LITERAL IS NOT A TOP-LEVEL BINDING, AND THE FALSE
  NEGATIVE IS IDENTICAL TO THE WRAPPED-FILE ONE.** 2026-10-20: a deploy check
  read `typeof applyTerminal` and got `undefined`, because it is
  `bossHop.applyTerminal` - a method on an object literal - and very nearly
  reported a successful deploy as not taken. Nothing distinguishes that
  `undefined` from a script that never loaded. It is the same shape as
  wrapped-versus-unwrapped above: both make a live identifier read as absent,
  and both are settled by reading the DECLARATION before probing the name.
  `typeof bossHop.applyTerminal` answers it; so does `PARTY_SCRIPT`, which is
  a top-level binding and is what the deploy authority should be read from.
- **MEASURED 2026-10-20 BY BRACE DEPTH, so neither question has to be re-argued.**
  `CaveRun.js` IS wrapped: opener at `:60`, closer on the last line, all 95
  column-0 `function` declarations at depth 1. `Party/Ranger.js`,
  `Party/Priest.js`, `Party/Mage.js` and `Party/Merchant.js` are NOT - their
  column-0 declarations sit at depth 0 and none has a column-0 `(function`
  opener, so Merchant's own comments claiming "this file's IIFE" were wrong and
  were corrected in v107. The consequence is operational: `PARTY_SCRIPT` and the
  party scripts' own functions ARE readable from the CODE context, which is what
  makes them the deploy authority, while CaveRun's internals are NOT - a live
  probe of it goes through its `window.*` exports (`caveDump()`, `caveStatus()`,
  `caveLeash()`) and nothing else will resolve.

## javascript_tool mechanics

**Browser-driven session only.**

- **Async work returns `{}`.** Stash the result on `window.__X` inside the
  snippet and read it back with a follow-up synchronous call.
- **Keep page-side sleeps under ~40s.** The CDP `Runtime.evaluate` behind the
  tool times out at 45,000ms and reports "The renderer may be frozen or
  unresponsive", which looks exactly like a hung tab and is not. Measured
  2026-10-17: three parallel 45s `await` calls all failed that way while the
  tabs were perfectly healthy and the characters still farming. Long waits
  belong in a stashed driver that returns immediately, polled with short calls.
- **A navigation mid-evaluation kills the call.** `change_server` reinitialises
  the page, so everything on `window` is wiped and an in-flight eval returns
  "Inspected target navigated or closed". To carry a value across a hop, write
  it to `localStorage`, which survives - and remove the key afterwards.

## Editing files in the GitHub web editor

**Browser-driven session only** - it is the one that cannot `git push`.
The Claude Code session commits with git and should never use this route.

- **Build the whole new text, hash it, then dispatch ONCE.** Dispatching a
  change array lets CodeMirror insert line by line, and it auto-indents every
  newline it inserts. Measured 2026-10-17: 27 ops carrying 6 inserted newlines
  came out 6 characters long, one extra leading space on each continuation
  line, and the hash gate caught it before the commit. Splicing the same
  offsets into a string and replacing `from: 0, to: doc.length` in one dispatch
  has no such behaviour - which is what the edit-script bullet below already
  says ("verify the new hash, THEN dispatch"), and deviating from that order is
  what produced the fault. Deletions are never auto-indented, so removing the
  stray spaces is the cheap repair if it happens anyway.
- **A hash match proves fidelity, not quality.** The same commit shipped three
  badly-wrapped orphan lines, because the gate confirms you wrote what you
  intended and says nothing about whether it was right. Re-read the rendered
  diff, or at least the paragraphs you touched, before committing.
- **Hash COMPARABLE UNITS, or the gate cries wolf.** JS string length and
  `charCodeAt` count UTF-16 code units; `wc -c`, Python `len(s.encode())` and
  `git hash-object` count UTF-8 BYTES. They differ on every non-ASCII
  character, so a container-side hash will never match a browser-side one on a
  file containing any. Measured 2026-10-17, twice in one hour: CLAUDE.md read
  29,778 in the editor against 29,782 expected, which is two em-dashes at
  lines 173 and 185 at 3 bytes each; and `Codex/boss_timers.html` read 17,913
  against 17,975, which is 32 non-ASCII characters, 29 of them em-dashes. Both
  looked exactly like the file having moved underneath, and the first nearly
  sent a session chasing a phantom conflict. Hash UTF-16 units on both sides
  (Python: `len(s.encode('utf-16-le'))//2`, NOT `len(s)` - that counts code
  points, which differ AGAIN on astral characters: a third mismatch the same
  day read `Party/Ranger.js` 372,969 against 372,979 expected, which is ten
  emoji, seven dragons and two crowns and one briefcase, each one code point
  but two UTF-16 units), or encode to UTF-8 on both sides with `TextEncoder`.
  Confirm a suspected mismatch against the blob hash before believing it -
  `git rev-parse origin/main:<path>` settles whether the file actually
  changed.
- **Set content with `view.dispatch`, not selectAll+paste.** The paste route
  silently APPENDED once - 27,816 chars where 16,181 was expected. Use
  `document.querySelector('.cm-content').cmTile.view.dispatch({changes:{from:0,
  to:doc.length,insert:...}})`, then hash the doc and compare before
  committing.
- **For large files transfer an edit script, not the file.** Fetch the base in
  the browser, verify its hash against the expected old hash, apply
  `[start, end, text]` offsets back-to-front, verify the new hash, then
  dispatch. This is what made ~190 KB pushes possible without moving the file
  through the conversation.
- **Do not gzip the payload.** A gzip+base64 transfer arrived corrupted
  ("invalid literal/lengths set"), and `DecompressionStream` via Blob/Response
  is CSP-blocked on GitHub. Plain base64 of the JSON works.

## Testing

- **There IS one now: `node Tests/run.js`.** This section said there was no
  harness until 2026-10-18, and the reasoning it gave is why there is one:
  both missing-helper bugs above were invisible to reading and obvious the
  instant anything executed. Neither is reachable by a static check. 114
  assertions across three suites, no framework and no dependency, exit 1 on
  any failure so it works as a gate. `node Tests/run.js relay` runs a subset.
  **COUNT AS OF 2026-10-20, LATE: 429 JS assertions across SEVEN suites, plus 124
  from the python bridge suite the runner shells out to and folds in, for
  `all 553 pass`.** It read 285 / 61 / 346 earlier the same day, and 114 before
  that - three figures in one file in one day, which is the point rather than
  an embarrassment: re-derive from a run, never from any note here.
  The figure above was true when written and is kept as the instance rather than
  overwritten - it is this file's own "claims rot" with the numbers to prove it. The
  handoff proposing this correction said "four suites"; it was six and is now
  SEVEN - `suite_relay`, `suite_bosshop`, `suite_opengifts`,
  `suite_merchantver`, `suite_features`, `suite_caverun` and `suite_priest`,
  the last added 2026-10-20 for the priest's skill paths - and quoting 346 as
  the JS total would overstate it by the python 61. Re-derive both from a run rather than from any note, including
  this one.
- **Suites lift the code out of the COMMITTED file, never a copy.**
  `Tests/lift.js` pulls a named declaration by brace-matching and evaluates
  it in a vm context; the only edit is `function x` -> `globalThis.x =
  function x`. So a passing suite is a statement about the file that ships.
  Write the stubs, not the subject.
- **It was built because the throwaway versions kept being rebuilt and kept
  being wrong.** Seventeen harnesses were written in the scratchpad on
  2026-10-18 alone, and two had counting bugs in the lifting machinery
  itself - one spun forever on a terminator that did not match, the other
  counted a brace inside a log message. Both looked exactly like the code
  under test being broken. The committed matcher ignores strings, template
  literals and comments.
- **A harness that passes for the wrong reason is worse than one that
  fails.** The first run of `suite_relay.js` asserted on the bare word
  `change_server` and matched a doc comment 1,700 bytes before the call; the
  code was right and the assertion was not. That is the failure mode to
  watch for here. Assert against the mechanism where you can.
- **IF A TEST CANNOT DISTINGUISH THE TWO BRANCHES IT IS COMPARING, THE SETUP IS
  DEGENERATE - SUSPECT IT BEFORE THE CODE.** `suite_caverun.js` first compared
  travel-mode against combat-mode kiting with the monster OPPOSITE the leader,
  where fleeing the monster shrinks the leader gap anyway, so both modes agree
  and the assertion failed against correct code. Worse than a false failure: the
  same setup would have PASSED against the broken version, because the guard
  under test never had to fire. Putting the monster BETWEEN follower and leader
  separates them. The general form: construct the case where the two branches
  must disagree, and if you cannot, the test is not testing the thing.
- **A `const X = new Set([...])` IS NOT LIFTABLE, AND THE FAILURE IS SILENT
  FIRST AND LOUD SECOND.** `lift()` brace-matches from the first `{` after the
  name, and that initialiser has none - so extracting `BOSS_SET` from
  `Party/Priest.js` ran past it and swallowed the `ZAPPER_MOB_SET` declaration
  and `updateHomeDependentSets` with it. First consequence: the lifted blob
  OVERWROTE the world's own `ZAPPER_MOB_SET`, so a zapper test quietly ran
  against the wrong set and failed for a reason that had nothing to do with the
  code. Second: a later lift in the same world threw "ZAPPER_MOB_SET has
  already been declared". The same shape as `let merchantVerCache = null` under
  "Version headers" - any initialiser whose first token is not a brace. Supply
  those in the world, and pin them against the source text so a change to
  either cannot leave every assertion testing a stale copy and still passing.
- **A HARNESS OVERRIDE THE HARNESS MERGES OVER IS A TEST OF NOTHING.**
  2026-10-20: `world({ parent: {} })` was meant to make the current shard
  unreadable, and `world()` supplies its own `parent` carrying a default shard,
  so the default survived and the case was never exercised - the assertion
  passed on code that would have retried. Fixed by deleting the fields from the
  object the lifted code actually reads, after the lift. **Assert the
  PRECONDITION, not only the outcome**, whenever a test depends on something
  being absent.
- **"PASSED FOR THE WRONG REASON" HAS A SECOND SHAPE: THE NAME AND THE
  MECHANISM DISAGREE.** Same day: an assertion named "does not mark the
  incoming plid acted" asserted that `plMarkActed(data._plid)` was PRESENT. It
  is present, once, inside a fallback - so it held while checking the opposite
  of what it said, and a reader scanning names would have been reassured by it.
  State the mechanism: a count, plus the same search over the body with the
  legitimate occurrence stripped out.
- **The divergence checks are the ones most likely to earn their keep.**
  `suite_relay.js` runs against Ranger, Priest AND Mage and fails if the
  relay block or `bossHopFollow` stop being identical.
  **BUT A DIVERGENCE CHECK COVERS THE NAMES AND FILES IT LISTS, AND NOTHING
  ELSE.** 2026-10-20: `BOSS_FIGHT_TYPE` sat in all three scripts with no
  assertion over it, and a handoff asserted that the relay check meant "all
  three move together or the divergence check fires". It does not - it names
  `plSaveCursor`, `plActed` and `plMarkActed`. **ATTRIBUTION MATTERS HERE AND
  THIS BULLET FIRST GOT IT WRONG, blaming the text.** The sentence above is
  SPECIFIC and was accurate: the relay block and `bossHopFollow` are both
  genuinely covered, and there is a separate block for `bossApproach`. Nothing
  understated its scope; a reader widened a correctly-stated scope to a third
  thing it never claimed, then relied on the widening. That is worse than
  misreading a vague bullet, because the specific version was in front of them -
  so the remedy is to re-read the loop body, never to trust a summary of what a
  suite covers, including this file's.
  **THE SAME TRAP HAS A SECOND LEVEL: THE FILE LIST.** The fix for the name list
  was to add four names - and the survival check was then scoped to
  `['Party/Ranger.js','Party/Priest.js','Party/Mage.js']`, so it read as
  repo-wide while covering three of FOUR copies. `Codex/FamilyFleet.js` carried
  the same single-valued mapping, with the same three call-site shape and a
  comment block that already named bgoo and recorded both products as
  cooperative. **So derive the file set, do not list it** - `suite_relay.js` now
  walks every tracked `.js` for the offending form. A `*.js` walk skips
  `Crowns3bc/` for free, which is the silent-skip hazard this file warns about
  and is correct here, that directory being reference-only. Merchant fixed the
  replay bug in v68 and it took three weeks and a live reload loop to reach
  the other three; a suite checking only one would not have noticed.

## Claiming a character in a manageable tab

**Browser-driven session only.**

- **Adventure Land refuses a second-tab takeover.** Navigating a new tab to
  `/character/<Name>/in/<REGION>/<ID>/` loads the character picker and leaves
  the running session untouched - tested, with the original still
  `online: true, code_running: true` throughout.
- To move a character into a tab Claude controls it must be disconnected
  first - send `disconnect();` with the commander below. The TOGGLE / `#dcode`
  recipe this bullet used to give was wrong; see the next section.

## Commanding a running character from /hub

**Browser-driven session only.** Needs a live `/hub` tab.

- **Skip the UI - the dispatch is one line.** Click the character's card, then
  `socket.emit("o:command", "<raw JS string>")`. Verified round trip ~1.0-1.2s.
- **The COMMAND button and `#dcode` are both dead ends.** `.click()` on the
  COMMAND gamebutton does not fire its inline `onclick`. `show_commander()`
  opens a CodeMirror modal, and `#dcode` is only the hidden template textarea
  it `.replaceWith()`s - writing `#dcode.value` reaches nothing, because
  `command_snippet()` reads `codemirror_render3.getValue()`.
- **TOGGLE is not needed.** All character cards are already visible on load:
  `div.gamebutton`, 204x80, innerText starting with the character name.
- **The target is the last card clicked, not anything in the payload.**
  `o:command` carries only the code string; the server resolves the recipient
  from the observe session. Check `window.observing.name` immediately before
  every emit - a stale selection sends to the wrong character with no error.
- **Code runs in the character's CODE context** (`character.*` resolves, so
  `disconnect()` is reachable) and the emit returns nothing. Round-trip results
  through `parent.localStorage` and remove the key afterwards.
