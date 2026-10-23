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
- **`git push -u origin main` IS THE WRONG RECIPE IN THIS CONTAINER AND THE
  ERROR IT GIVES NAMES THE WRONG CAUSE.** Measured 2026-10-22: the Claude Code
  container's checkout is on a SESSION BRANCH, not on `main`, and local `main`
  sits 168 commits stale at `5511eb9`. A `push origin main` resolves the
  refspec against that LOCAL ref, so it tries to push the stale branch and is
  refused `non-fast-forward`, "a pushed branch tip is behind its remote
  counterpart" - which reads as "the other session committed, go and merge".
  Nothing had moved: `git ls-remote origin main` and `git fetch` both showed
  the remote exactly at this session's own last commit. **`git push origin
  HEAD:main` is the form that works**, and it is what every earlier push in
  this session used. Realign local `main` (`git branch -f main HEAD`) so the
  trap does not recur, and when a push is refused read `ls-remote` BEFORE
  believing the hint - the message describes the refspec, not the repository.
  **AND THE SESSION BRANCH NOW HAS AN UPSTREAM, SO A BARE `git push` NO LONGER
  REACHES `main`.** The container's stop-hook asks for the session branch to be
  pushed, which is satisfied by pointing it at the same commits - both refs sat
  at `57e293f` - but `-u` set the tracking branch, so an unqualified `git push`
  from here lands on `claude/new-session-*` and leaves `main` behind while
  reporting success. **That is the one failure mode worse than the refusal
  above**, because a refusal is loud and this is not. Push `HEAD:main`
  explicitly every time and verify blobs against `origin/main`, never against
  the tracking branch - the blob loop this file already requires is what makes
  the difference visible, since it names `origin/main` outright.
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
  **RE-READ FROM LIVE `G` ON 2026-10-21 AND EVERY ONE IS UNCHANGED, which
  RETRACTS the largest item on the patch-rot list.** The update notes say many
  monsters were changed "including Giga Crab and Dragold", and that was raised
  here as the change that would move every bossHop number. It moves NONE of
  them: the five figures above are intact, so `requiredDwellSec` is unaffected
  and the dwell maths needs no revision. Whatever changed about those monsters
  was not their hp. **A PATCH NOTE NAMING A MONSTER IS NOT A STATEMENT ABOUT THE
  FIELD YOU CARE ABOUT**, and reading the notes rather than `G` would have cost
  both sessions a day of re-derivation.
  Also read the same morning, worth having: mrpumpkin 36,000,000, grinch
  24,000,000, rgoo 1,000,000, bgoo 100,000, phoenix 160,000, snowman 1,200,
  horseman 30,000,000, zombie 9,000, ghoul 32,000, gargoyle 6,000,000 - all
  cooperative - and mummy 12,000, which is NOT cooperative.

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
- **A SAMPLE CANNOT PROVE A CLASS ABSENT, SO WHERE A SCHEMA QUESTION HAS A
  WRITE PATH, READ THE WRITE PATH.** 2026-10-21: a 1,200-row window answered
  which fields `spawn`, `death` and `despawn` rows carry, and could not show
  that a FOURTH class exists - `lost` happened not to appear in it, and a
  sample can only ever say what the sample contains. Enumerating every `_emit`
  payload in `Codex/market_bridge.py` answered it completely and showed `lost`
  carries no hp field of any kind. Neither session could have done the other's
  half: the live read caught that the old claim was false, the write-path read
  established what was true instead. Same family as the wrapped-prose grep
  above - a search that comes back empty has told you about your search.
- **A DELTA IS ONLY AS SOUND AS ITS WEAKER TERM, AND NOTHING IN THE SENTENCE
  SAYS WHICH TERM THAT IS.** 2026-10-21, the browser session's own naming of
  it: the crabxx home table was read LIVE, the normal table was quoted from
  THIS FILE, both had moved, and only one was checked - then the difference
  between them was reported as measured. Every figure in the block was
  individually defensible and the comparison was not.
  It is adjacent to "a ratio is only as good as its denominator being one
  population" under the bridge section, but the fault is PROVENANCE rather than
  population: two terms of different epistemic status, silently combined,
  with the prose giving a reader no way to tell them apart. **So when a claim
  is a comparison, say where EACH side came from** - and if one side is this
  file, that side is a lead and not a measurement.
- **DO NOT WRITE DOWN WHAT A SINGLE CALL ANSWERS.** 2026-10-21, found by the
  browser session: `Party/Merchant.js`'s `windbelt` note quoted bank contents -
  "1,963 stormfeather is 49 belts' worth, but there is no dexbelt+2 banked (1x
  +0, 2x +3)", "18 essenceofether held" - and the bank by then held 2,735
  stormfeather and exactly ONE dexbelt+2, the level the recipe consumes. The
  conclusion built on them read "tier 2 is short and contended, tier 3
  unreachable", which is the operator's call to make and was wrong toward
  PESSIMISM. `api_call('load_bank', {})` returns the whole bank from anywhere, so
  that comment was a CACHED COPY OF A LIVE QUERY - volatile and unnecessary at
  the same time, which is the worst pair to commit.
  **AND THE OPERATOR'S POINT IS WHAT MAKES IT A RULE RATHER THAN A FIX:
  refreshing the numbers only restarts the decay**, because Meltymerch banks a
  haul several times a day. So strip the quantities and keep what cannot move
  without a patch - the recipe, the 3-to-1 compounding ratio, the six-unit tier-2
  requirement, and WHICH INPUT BINDS AND WHY. Fixed in Merchant v113. This is the
  version-header lesson in another costume: "do not cite a character count, the
  durable fact is the ordering, not the size."
- **A `->` POINTER TO AN ANCHOR THAT DOES NOT EXIST IS A CLAIM THAT ROTS IN
  TOTAL SILENCE, AND THE FIX WAS MOSTLY DELETION.** Measured 2026-10-21: 253
  pointers across the four party scripts, 14 real dangles, ALL of them in
  `Party/Merchant.js` - Ranger, Priest and Mage were clean. A pointer naming a
  missing section reads as "the rationale is written down" and nothing checked
  it. **Ten carried their reasoning at the CALL SITE already, so the pointer went
  rather than an archive being written**: an archive nobody needs is a second
  place to keep in step, which is the drift this file warns about everywhere
  else. Two were written because they had real content (`isPontyBought`,
  `gtFailOpen`, the latter recording its open-over-closed preference as UNARGUED
  rather than reconstructing it). `planCoords` was worse than thin - its sentence
  was TRUNCATED MID-CLAUSE because the rationale was moved out and never written,
  which a pointer audit finds and a reader of the line never would. 236 pointers
  now, zero dangling, asserted with no allowlist in
  `Tests/suite_merchantbuy.js`.
- **A COMPLETE SEARCH OVER AN INCOMPLETE SET IS THE SAME ERROR AS ONE OVER THE
  WRONG COLUMN, AND IT RECURRED TWO DAYS APART.** The browser session's own
  naming, 2026-10-21: they reported that `market_bridge.py`'s handler held only
  `self.store` and `self.ledger`, so skip rows could not reach the poller's
  `_emit`. The three assignments are SIBLINGS SEVEN LINES APART -
  `Handler.store` at `:3108`, `Handler.ledger` at `:3109`, `Handler.bosses` at
  `:3116` - and they named the first two because the POST branches use them,
  without looking at where those came from. Same shape as enumerating the
  conditions carrying an `attack` field and reporting the absence as a property
  of the data. **Both times the tell was available from the author's side and
  not the reader's: they could name what they HAD checked and never asked what
  else could be there.** So the discipline is not "search harder", it is to
  state the SET a negative result was taken over, which makes its incompleteness
  visible to the next reader.
- **TWO INSTRUMENT-FAILURE RULES ARE A MATCHED PAIR ON ONE AXIS, and the quiet
  end is the dangerous one.** "A test that dies instead of reporting will be
  debugged as a test bug" is LOUD and misattributed - the traceback sends you to
  the wrong file, but you know something is wrong. "A broken instrument that
  returns plausible small numbers is worse than one that errors" is SILENT and
  BELIEVED - the comment-size measurer reported `TOGGLES` at 30 characters and
  nothing about that figure looked wrong. The first is recoverable for exactly
  the reason the second is not, which is why a tool that cannot fail loudly
  needs its output cross-checked against a read before anything is decided on
  it.
- **THE AUDIT TOOL PRODUCED FALSE POSITIVES BOTH TIMES IT WAS RUN, WHICH IS THE
  SEVENTH AND EIGHTH INSTANCE OF A SEARCH TELLING YOU ABOUT YOUR SEARCH THIS
  WEEK - FROM THE TOOL BUILT TO FIND THE OTHER SIX.** First the pointer scan
  counted the CONVENTION LINE at the top of each script ("a line ending
  `-> XComments.md#anchor` is a SUMMARY") as four dangling pointers. Then a
  second pass tried to measure each pointer's attached comment mechanically to
  decide delete-or-write, and its walk-back never fired on a block whose `/*`
  sits ABOVE the pointer line - it reported `TOGGLES` at 30 characters against a
  block of roughly 400 that had just been read by eye. **The numbers were
  discarded and the reads were used instead.** A judgement about whether prose
  suffices is not a character count, and a broken instrument that returns
  plausible small numbers is worse than one that errors.
- **A SILENTLY TRUNCATED SOURCE MANUFACTURES A CONFIDENT NEGATIVE, AND QUOTING
  THE RANGES YOU READ IS NOT COVERAGE.** The browser session, 2026-10-22: they
  told the operator FOUR TIMES that `market_bridge.py` contains no argparse
  block, having read it across four offset ranges. The file is 178,235
  characters and WebFetch was delivering 104,036 of them; the block is at line
  3,436 of 3,508, inside the 74K that never arrived. Fetching the raw file into
  a page and running a real regex found it in one call. **The lesson is
  narrower than "do not trust the fetcher": they quoted the ranges they had
  read and never checked those against the file's LENGTH**, which was available
  and which they had already printed for four other files that morning. Same
  family as stating the SET a negative was taken over - here the set was the
  bytes that actually arrived.
- **MUTATION TESTING EDITS THE SUBJECT FILE, SO A REVERT AIMED AT THE MUTATION
  DISCARDS EVERY UNCOMMITTED CHANGE WITH IT.** This session, 2026-10-22:
  `git checkout Codex/market_bridge.py` was reached for to undo one mutation
  and threw away the whole uncommitted skip-row implementation, because the
  work had not been committed yet and `checkout` reverts to HEAD rather than to
  the pre-mutation state. Recovered from the scratchpad copy taken before the
  first mutation, which is the only reason it cost minutes rather than the
  work. **Restore from the BACKUP COPY, never from git, while mutating** - the
  backup is the pre-mutation state and HEAD is not, and the two are
  indistinguishable in the moment because both "undo" something. The copy is
  already part of the recorded workflow; using git instead is what is new.
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
  The same drink clears the NON-PERSISTENT debuffs (frozen, poisoned,
  stunned, cursed, deepfreezed, sundered and the rest), so it is a combat
  panic button too; of the six PERSISTENT debuffs - withdrawal, xshotted,
  notverified, authfail, hopsickness, block - only hopsickness is carved out.
  **COUNTED LIVE 2026-10-21: 30 debuffs total, 6 persistent, 24
  non-persistent** - this read "23 non-persistent" until then, so ONE DIGIT
  MOVED AND NOTHING ELSE DID. Of the three conditions added by the Halloween
  patch only `hexed` is a debuff at all (`debuff` true, `persistent` false,
  duration 5000); `rising` and `spooked` are not debuffs. **THE SIX PERSISTENT
  DEBUFFS ARE UNCHANGED**, so the carve-out argument above survives untouched
  and the patch needed a recount rather than a rewrite.
  **`hexed` IS -20 SPEED AND MUMMIES APPLY IT INDEPENDENTLY OF THE PRIEST'S
  CURSE**, which makes it a live movement debuff in circulation against a leash
  band of 180/120 - relevant to the cohesion work rather than to snakeoil.
  `spooked` is +40 the other way.
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
- **`drops_home` is a home-shard-EXCLUSIVE drop table**, present for TEN
  monsters as of 2026-10-21 - crabxx, rharpy, phoenix, icegolem, dragold,
  franky, mrgreen, mrpumpkin, plus snowman and grinch added that day - and
  additive to the normal table, which all ten also have. It read EIGHT
  through 2026-10-18 and that reading was correct for its date; see the
  home-table bullet under "Drop rolls" for what moved, and do not read the
  count as the interesting part of the change. It
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
  the only funtoken sources in the whole file are crabxx - SPLIT ACROSS TWO
  TABLES since 2026-10-21, normal `1000/10/10` and home `1000/1000/1000`;
  this line read `1000/1000/1000/10/10` as one table and was correct then -
  rgoo (20), bgoo (0.25) and `cutebee` (1, added by
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
  outright. **THE MULTIPLIED LOOP IS THE NORMAL TABLE ONLY**, measured by
  brace depth 2026-10-21 rather than eyeballed: the `for (let d = 0; d <
  B.drop_table_multiplier; d++)` loop opens inside the
  `D.drops.monsters[type]` forEach and CLOSES four lines later, well before
  the `monsters_home_server` block, so THE HOME TABLE ROLLS EXACTLY ONCE
  however crowded the shard is. That asymmetry is the whole reason the home
  bonus is worth proportionally less the busier a shard gets, and it is
  invisible to a reader of either table.
  Modelled on crabxx with equal contributions and `luckm` 1.5, OFF-HOME:
  3 funtokens a kill at K=1 and K=5, 6 at K=10, 7.5 at K=20, 8.75 at K=40,
  12.4 at K=80, 19.2 at K=150. A busy shard is still BETTER for a funtoken
  run, which is the opposite of the obvious instinct - but the whole curve
  dropped on 2026-10-21: off-home K=80 went from 30.4 to 12.4, because three
  saturated lines left the multiplied loop for the once-only one.
  **THE SUPERSEDED FIGURES ARE 5 / 18.8 / 30.4 at K=1/40/80**, correct for the
  five-line normal table they were computed from, and kept because a note
  quoting 30.4 is reading a table that no longer exists.

- **THE HOME-ONLY DROP TABLES WERE WORTH ABOUT A FIFTH OF ONE ITEM PER KILL.
  ON 2026-10-21 crabxx's BECAME WORTH THREE GUARANTEED FUNTOKENS, SO THE
  CHAINING QUESTION THIS BULLET CLAIMED TO CLOSE IS REOPENED.** The browser
  session pulled the assembled `G.drops` from the live client; this session
  confirmed every figure independently from upstream source at `f0d331a7`. The
  two agree, so the change is LIVE and not merely committed.
  **THE ARITHMETIC WAS THEN IMPLEMENTED TWICE FROM TWO DIFFERENT SOURCES AND
  AGREES TO THE DECIMAL AT ALL SEVEN POINTS** - this session from the upstream
  literal, the browser session from the live assembled object, neither looking
  at the other's series before computing. That is a stronger warrant than
  either read alone, and it is the warrant these figures carry; the one piece
  with NO second source is the multiplier-loop boundary, because only the
  Claude Code container holds a clone of the server source. Brace depth is the
  right method for it, and it is still single-sourced - re-measure it there if
  anything ever turns on it.
  crabxx's home table now holds `[1.0, "reefglass", 3]`,
  `[1.0/1000, "suckerpunch"]` and `[1000, "funtoken"]` THREE TIMES. A
  rate-1000 line is saturated for anyone with credit at all - credit requires
  `share > 0.0025`, so `1000 * share * luckm >= 1` at any `luckm >= 0.4` - so
  those are three guaranteed funtokens per credited kill, additive to the
  normal table.
  **AND THE NORMAL TABLE LOST THEM. crabxx normal is now `[1000, "funtoken"]`
  ONCE plus two at `[10]`, where it carried three 1000s and two 10s before.**
  The patch did not simply add a home bonus; it MOVED three saturated lines
  out of the crowding-multiplied loop into the once-only one, which cuts the
  off-home yield by more than half on a busy shard and cuts the home yield
  too. Expected funtokens per credited kill, equal contributions, `luckm` 1.5:
  K=1 and K=5 3 away / 6 home; K=10 6 / 9; K=20 7.5 / 10.5; K=40 8.75 / 11.75;
  K=80 12.4 / 15.4; K=150 19.2 / 22.2.
  **THE TABLE-ONLY HOME ADVANTAGE IS A FLAT +3** - +100% solo, +24% at K=80 -
  because the three home lines are saturated and roll once, so the bonus is
  constant while the off-home yield grows with the crowd.
  **THE x5 ON POINTS IS NOT A SEPARATE SMALL TERM ONCE A LINE IS UNSATURATED,
  AND THIS IS WHERE THE HONEST ANSWER IS A BRACKET RATHER THAN A NUMBER.**
  Home multiplies `mnet` by 5 on a cooperative monster, which raises `share`
  (`Math.pow(points, 0.65) / total`, so 1/K for equal contributions), which
  raises every line still below saturation - INSIDE the multiplied loop. If
  every contributor is home the x5 cancels in the ratio and the advantage is
  the flat +3. If ours is the only one home at K=40, `points^0.65` scales by
  `5**0.65 = 2.63`, share goes 0.025 -> 0.063, crabxx's two `[10]` lines go
  from 0.375 to 0.95 each, and the advantage reaches +9.3. So the real figure
  sits between +3 and about +9 and DEPENDS ON HOW MANY OTHER CONTRIBUTORS
  SHARE THE HOME SHARD, which is not knowable before arriving. Quote the +3
  floor; never quote the ceiling as the expectation.
  **dragold's `embercore` IS `[1, "embercore", 2]` ON THE HOME TABLE**, against
  `[0.005, "embercore"]` on the normal one. This bullet recorded only the
  normal figure and called it "~0.001", which is wrong by three orders for a
  character on its home shard. Its home `essenceoffire` lines are `[50]`,
  `[40]`, `[30]` and `[1.0]`.
  **THE PATCH CUT THE YIELD RATHER THAN REDISTRIBUTING IT, which is the part a
  planner needs and neither column above states on its own.** Off-home K=80
  fell from the modelled 30.4 to 12.4, and even HOME-shard 15.4 is about half
  the old AWAY figure. So the home-versus-away question is a second-order one:
  whatever it resolves to, a crabxx run yields roughly half what it did, and
  anything planning against 19-30 funtokens per kill is planning against a
  world that ended on 2026-10-21.
  **THE SOURCE CENSUS IS OTHERWISE INTACT, CHECKED RATHER THAN ASSUMED.** All
  122 assembled monster tables scanned 2026-10-21: normal-table funtoken
  sources are crabxx `[1000, 10, 10]`, rgoo `[20]`, bgoo `[0.25]` and cutebee
  `[1]`; the only HOME-table source is crabxx. So the list above survives BY
  NAME and only crabxx's rates moved - worth recording as checked, because the
  same patch that moved them could have added one and a name-level re-read is
  what would have caught it.
  **franky's keys are rate 30 on the NORMAL table** - `[30, "cryptkey"]` and
  `[30, "tombkey"]`, saturated for anyone with credit - so the key supply the
  boss ranking is built on costs nothing to collect off-home, and its home
  table carries no key at all. The ranking's franky-over-funtokens rationale
  is therefore untouched by any of this.
  **SO: SETTLED, AND NOT.** Settled - the mechanism, the once-only loop, the
  +3 floor, and that going off-home now costs something material rather than a
  fifth of a reefglass. NOT settled, and the operator's to weigh: whether
  +3-to-+9 funtokens plus the reefglass outweigh reaching a boss at all, given
  that the window is an ARRIVAL deadline. Flagged REOPENED rather than
  answered; the operator's instinct that home may now be worth considering was
  right.
- **THE OLD READING IS KEPT BECAUSE IT WAS RIGHT WHEN TAKEN, AND THE HISTORY
  PROVES IT RATHER THAN EXCUSING IT.** This bullet read "exactly EIGHT entries
  ... and no `funtoken` line in any of them", verified 2026-10-18 by
  bracket-matching the whole object. `git log` on `design/drops.js` in a FULL
  clone settles that this was correct, not sloppy: `87f571e5` (2026-10-06,
  "Rebalance co-op drops between normal and home servers") first made the move
  and took the table to ten entries; `cd62207a` (2026-10-07) put drops.js back
  to the eight-entry, no-funtoken state; it stayed there through 2026-10-18,
  which is the window the measurement was taken in; and `f0d331a7`
  (2026-10-21, "Merge cooperative boss drop adjustments and correct Crabxx
  rewards") re-landed it. So a sound method gave a right answer and a merge
  three days later moved the ground under it. **PRECISION IS NOT DURABILITY,
  AND FRESHNESS IS A SEPARATE PROPERTY FROM RIGOUR** - the browser session's
  phrasing, on their own two falsified claims. The practical consequence is
  narrower than "re-measure everything": a figure read from a table the
  creator is actively rebalancing has a short shelf life, and THIS one
  flip-flopped twice in fifteen days, so the drop tables specifically are
  worth re-reading before any decision rests on them.
  Bracket-match the object rather than regexing it - two regex reads
  disagreed when this was first done, one truncating at the first `]` and the
  other reversing dragold's two items - and read the DATE as part of the
  answer.
- **AND ONE RECORDED SERIES DOES NOT FOLLOW FROM THE MECHANISM THIS FILE
  DOCUMENTS, WHICH IS A DIFFERENT FAULT FROM ROT.** The reefglass figures
  above used to read 0.300 at K=5 AND K=10, 0.225 at K=20, 0.188 at K=40,
  0.169 at K=80, 0.160 at K=150. Two different K giving the same value, and a
  tail flattening at 0.160, cannot come from `share = 1/K` - a 1/K law keeps
  halving. Recomputed from the documented roll
  (`min(1, rate * share * luckm) * qty`, `rate` 1.0, `qty` 3, `luckm` 1.5):
  0.900 at K=5, 0.450 at K=10, 0.225 at K=20, 0.113 at K=40, 0.056 at K=80,
  0.030 at K=150 - agreeing at K=20 only, which is presumably why it passed.
  The old series' derivation could not be reconstructed and is NOT retained as
  an alternative reading; it is recorded as unexplained. **A NUMBER THAT
  CANNOT BE RE-DERIVED FROM THE MECHANISM BESIDE IT IS A LOOSE NUMBER EVEN
  WHILE IT LOOKS PRECISE**, and unlike a stale figure it was never true.

## Boss priority and the event schedule

**Both sessions.** The ranking is the operator's, given 2026-10-18. It is
declared in `Party/Ranger.js` as `bossRank()` and in no other script. This line
said "live in Ranger v95" and was wrong twice over: it landed in v95 but ships
in v97, and it had never EXECUTED at all, because Dexon was running
`Party/Mage.js` out of the Ranger slot until 2026-10-19. Nothing plans against
this ranking until a Ranger build is actually running on him.

- **The table, as of the operator's 2026-10-21 insertion (Ranger v107).**
  dragold 1; franky 2; crabxx, wabbit and goobrawl 3; **horseman 4**; mrgreen 5;
  snowman, grinch and mrpumpkin 6; `BOSS_RANK_DEFAULT = 7` for everything else,
  icegolem included. It read mrgreen 4 / snowman group 5 / default 6 until then,
  so a note quoting those is reading the pre-horseman table.
  **THE RULE THE INSERTION EXPRESSES, which is the part that stops it being
  re-derived wrong: PERISHABLE-BUT-FREQUENT SITS BELOW RARE-AND-PERMANENT AND
  ABOVE ALWAYS-AVAILABLE.** Horseman ends with Halloween, which argues for
  urgency - but it runs NIGHTLY across three regions and about six shards, so
  the season holds dozens of chances at it. wabbit is rare and does not expire,
  so when both are up wabbit (3) is the right grab, and mrgreen is still going
  to be there in January. **A DEADLINE IS NOT THE SAME THING AS SCARCITY**, and
  ranking by "ends soonest" puts horseman above wabbit on exactly that
  confusion.
  **IT IS AN INSERTION RATHER THAN A TIE AT 4, and that was deliberate.** A tie
  falls through to `need` and then `kills_to_rung` - achievement distance, the
  very thing this table replaced - so a tie would have handed the decision back
  to the mechanism the ranking exists to override. The insertion is
  order-preserving: every pairwise relationship that held before still holds.
  **AND THE DEFAULT MOVED FOR A REASON, NOT AS A SPARE GAP.** It must sit
  strictly above the largest assigned rank, which the shift took from 5 to 6; at
  6 the unranked set would TIE with snowman/grinch/mrpumpkin. Pinned as
  `> max(assigned)` rather than as the literal 7, so the next insertion cannot
  leave it behind.
  **SEASONAL ENTRIES STAY IN THE TABLE YEAR-ROUND - removing horseman in
  November is a no-op NOT to perform.** Verified rather than assumed:
  `bossRank()` is a pure keyed lookup with a default, NOTHING iterates
  `BOSS_RANK`, and all three call sites pass a name that already came off a live
  candidate list. So an entry for a non-spawning boss is UNREACHABLE rather than
  merely harmless, which is what dragold at rank 1 has been demonstrating for as
  long as `lunarnewyear` has been false. The no-enumeration property is asserted
  against the SOURCE TEXT, because that is what makes the year-round entry safe
  and a lookup test cannot see it.
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
- **THE NINE BASE WINDOWS NEVER OVERLAP, AND THAT HELD UP EXACTLY - BUT THE
  "NOT A CONTENTION PROBLEM" HALF IS FALSE DURING A SEASON.** The base
  arithmetic is CONFIRMED against upstream `43b2c8fc`: dailies at realm hours 13
  and 20, nightly at 23, offsets `TIMEO = {EU: 1, US: -5, ASIA: 7}`, and
  `realm = (UTC + offset) % 24` so `UTC = realm - offset`. Recomputed rather
  than re-derived by hand, it reproduces 01:00, 04:00, 06:00, 12:00, 13:00,
  16:00, 18:00, 19:00 and 22:00 UTC exactly - which is the check that the method
  is right, not just the answer.
  **HALLOWEEN ADDS 22 CROSS-EVENT OVERLAPS, so a queue DOES have to arbitrate.**
  `SLOTS` in `node/logic/event_schedule.js` carries three seasonal slots beyond
  the two pools, and they collide in two distinct ways:
  (1) `graveyard` runs at realm ODD hours, minute 30, for 600s - which lands on
  EVEN UTC hours at :30 in ALL THREE regions at once, 12 times a day each. The
  pool slots run :00 to :40 (2400s), so graveyard overlaps the LAST TEN MINUTES
  of six of the nine base windows - 04, 06, 12, 16, 18 and 22 UTC, the even ones
  - in every region. 18 of the 22. The three ODD base hours (01, 13, 19) are
  untouched, because graveyard never lands on an odd UTC hour.
  (2) `witchcipher` (realm 6 and 18, 1680s) and `horseman` (realm 0, 2400s)
  open SIMULTANEOUSLY ON DIFFERENT REGIONS at 05:00, 17:00 and 23:00 UTC - four
  collisions, because 23:00 carries witchcipher on BOTH US and ASIA against
  horseman on EU. Three events at one instant, on three different shards, and
  the party can be on one.
  So "the nine are a queue, not a contention problem" was true of the base three
  slots and is not true of the live lineup. **A NO-CONTENTION PROPERTY PROVED
  OVER ONE SLOT SET DOES NOT SURVIVE THE SET GROWING**, and seasons grow it.
- **`horseman` IS ITS OWN SLOT AT REALM HOUR 0, NOT A THIRD MEMBER OF THE
  NIGHTLY POOL - which settles a question `G.events` could not.** Its `G` entry
  reads `type: "nightly"` with the same shape as franky and icegolem, so it
  looked as though the nightly rotation might have gone three-way; the patch
  notes placing it at 00:00 realm looked like a contradiction. `SLOTS` resolves
  it: `{ hours: [0], event: "horseman", season: "halloween" }` is a DEDICATED
  slot, outside `pool: "nightlies"`. **So the nightly pool is still two
  elements and its exact alternation is untouched.** `type` on a `G.events`
  entry describes the event's own shape (duration, join); the SCHEDULE decides
  when it runs, and only `SLOTS` answers that. Monster `horseman`, hp
  30,000,000, cooperative - so as a boss it is a drop-in: one `EVENT_WINDOW_SEC`
  entry at 2400 and one `bossRank` entry.
- **`witchcipher` IS IN THE DAILIES QUEUE BUT SKIPPED WHILE ITS OWN SEASONAL
  SLOT IS OPEN.** The pool pick computes `own` as the events holding an open
  seasonal slot and refuses queue entries in it, and the source comment says the
  rest of the year it is simply one of the dailies. So during Halloween it runs
  at realm 6 and 18 instead of in the 13/20 rotation, and afterwards it rejoins
  that rotation without anything changing. Not a boss: `duration` 1680,
  `gathering` 1200, `slots` 5, `mixes` 5, `loot` 0.003, payout 1 per right
  answer and 50 per crack, with four ingredients dropping at 0.003 from
  ORDINARY farm monsters the party already kills (verdantspore from
  goo/bee/spider/croc, frostscale from arcticbee/boar/wolfie/iceroamer,
  embercoal from plantoid/porcupine/fireroamer/gscorpion, gloomfeather from
  snake/osnake/minimush/ghost). The gathering half is close to free; the 5-mix
  daily cap is the limit. **So its only claim on the scripts is NOT VENDORING
  THE FOUR INGREDIENTS**, which is a sell-protection question rather than an
  event one.
- **`graveyard` IS CHEAPER THAN IT WAS FIRST CALLED, and the first estimate was
  retracted by its own author.** It was guessed to need state tracking for a
  multi-stage sequence. It does not: the waves are DECLARED in `G` with their
  offsets - `[[0,{zombie:12}],[180,{zombie:16,ghoul:3}],[360,{zombie:20,ghoul:6}]]`
  - the gargoyle has a FIXED spawn coordinate `[255,-1545]`, there are 24 fixed
  grave positions, and the whole thing is 600s. zombie 9,000, ghoul 32,000,
  gargoyle 6,000,000, all cooperative; mummy 12,000 and NOT cooperative. The
  gargoyle is the prize and its position is known in advance, which is most of
  what makes goobrawl hard. Against that, halloween ends 2026-11-03, so the
  shelf life is short and the economics may still not justify it - but the cost
  estimate was wrong and the decision is the operator's on corrected numbers.
  **AND THE COST ESTIMATE WAS STILL WRONG, IN THE OTHER DIRECTION: THE EVENT
  SITS ENTIRELY INSIDE THE spookytown MUMMY RAGE BOX.** Read from upstream
  `design/maps.js` at `16881a27` while building the farm override the operator
  asked for on 2026-10-21: the mummy spawn is `boundary [31,-1571,480,-1293]`,
  `count: 9`, `grow: true`, `rage: [-124,-1631,614,-1130]`. The 24 grave plots
  span x 65..447 and y -1550..-1312, so the graves are inside the mummy SPAWN
  boundary and the whole field is inside its RAGE rectangle. **Graveyard Rising
  is not near the mummy field - it IS the mummy field**, and the "waves are
  declared in G, the gargoyle position is fixed, so this is cheap" reading
  missed that entirely because it was taken from `design/events.js` alone.
  **SO A NAIVE OVERRIDE WOULD HAVE BEEN INERT RATHER THAN WRONG**, which is the
  failure mode this file keeps paying for: `safeMove` refuses every coordinate
  in a rage rectangle, so the party would never have arrived and nothing would
  have logged a fault. The answer is the park-and-pull pattern the repo had
  already arrived at for this exact rectangle - park at (290,-990) in the
  corridor band outside BOTH rectangles, `ragePull` one at a time - rather than
  relaxing containment. **IT IS NOT IN THE SCRIPT AND IS NOT GOING TO BE**; see
  the correction three bullets down.
  **THE GARGOYLE IS UNREACHABLE FROM OUTSIDE THE BOX AND THAT IS THE OPERATOR'S
  DECISION, NOT A TUNING GAP.** Its spawn is fixed at [255,-1545], 555 units
  from the park point against the longest reach in the party (the mage's 235).
  Taking it means entering the box with 9 growing mummies applying `hexed` (-20
  speed, independent of the priest's curse) against a 180/120 leash band. NOT
  built; `enterRageBox` is where it would go.
  **THE DELIVERABLE IS A PASTED SNIPPET AND NOTHING IN THE REPO. IT TOOK TWO
  CORRECTIONS TO GET THERE AND THE SECOND ONE IS THE LESSON.** v108 shipped
  `CONFIG.graveyard` plus a `gyTick()` polling `parent.S.graveyard` every five
  seconds. Operator: "not a script change / it should be an override I run" -
  so v109 removed the automation and shipped `gyFarm()` / `gyOff()` /
  `gyStatus()` as console commands beside `achvStop()` and `mhOn()`. Operator
  again: **"I did not want the ranger script updated. I wanted an override code
  I could paste and execute."** Both are reverted; Ranger v110 is byte-identical
  to v107 but for the version number.
  **A COMMAND IN THE FILE IS STILL A FILE CHANGE, and reading "not a script
  change" as "not an AUTOMATIC script change" is how one rejected shape became
  two.** The first correction named the property the operator did not want
  (the script deciding); the obvious repair preserved the property they did not
  want either (the script carrying it at all), because the narrower reading was
  the one that let the existing work survive. **WHEN A CORRECTION CAN BE READ
  NARROWLY OR BROADLY, THE NARROW READING IS THE ONE THAT KEEPS YOUR WORK - so
  it is the one to distrust**, and the cheap check is to ask what the operator
  would have to do differently under each, which here was "nothing, they still
  deploy a file".
  **THE AUTOMATION WAS CARRYING ITS OWN EXCEPTION, AND THAT PART IS STILL THE
  REUSABLE ONE.** v108 had to edit `achvTick()` to exempt its takeover from the
  queue's hand-move check, or a ten-minute event would have stood the queue
  down until `achvResume()`. An override the operator pastes IS a hand move, so
  the queue's existing contract was already right and the exemption went out
  with the automation - as did the whole file change, eventually. It had looked
  like a necessary integration rather than a cost the wrong design was paying:
  **when a new subsystem needs an exception carved into an old one, ask whether
  the exception is the price of the shape rather than a feature of the
  problem.**
  **THE SNIPPET NEEDS `mummy` IN `rageAlso` AND THAT IS THE ONE PART A READER
  WOULD GET WRONG.** `ragePullActive()` matches `ragePullTypes()` against the
  rage BOXES on the map (`types.indexOf(b.type) >= 0`), and spookytown's only
  box is the mummy's - zombie, ghoul and the gargoyle are EVENT spawns with no
  box of their own - so `home: 'zombie'` alone leaves the pull machinery idle
  and nothing ever leaves the field. The CANDIDATE scan is POSITION-based
  (`rageHit(map, e.x, e.y, 0)` on the monster's own coordinates), so once the
  machinery is running a zombie standing on a grave is pullable exactly like a
  mummy, and `rageRequiredRange` measures it off the mummy rectangle's edges.
  **TWO GATES ON ONE MECHANISM, ONE KEYED ON TYPE AND ONE ON POSITION**, and
  reading either alone gives a confident wrong answer about whether the
  override works. Pinned by mechanism in `Tests/suite_bosshop.js`.
  One smaller fact survives the command going away because it is about the
  game rather than about us: graveyard liveness is `.live` and never `hp`,
  since `graveyard_public()` carries no hp field at all until the Gargoyle
  wakes.
  **READING ONE DESIGN FILE ANSWERED THE EVENT AND NOT THE GROUND IT STANDS
  ON.** `design/events.js` gave the waves, the grave coordinates and the
  duration, and every one of those was right - the obstacle was in
  `design/maps.js`, a file nobody thought to open because the question looked
  like an event question. Same shape as "a patch note naming a monster is not a
  statement about the field you care about": the answer was complete about the
  thing asked and silent about the thing that mattered.
- **THE GARGOYLE WAKE IS A BRACKET, NOT A CONSTANT, AND THE DERIVATION OFFERED
  AS THE DURABLE ONE IS THE FRAGILE ONE.** Measured live by the browser session
  on EU IV, 1 Hz for 901s: `live` at 22:30:00.956, `gargoyle` at 22:39:00.977,
  gap 540.021s. They decomposed it as "exactly ONE WAVE INTERVAL after the last
  wave" (360 + 180) and recommended that over a 540 literal because it "survives
  a wave-table change". Read from `graveyard_tick` at upstream `16881a27`, the
  real condition is `wave >= waves.length && (!ids.length || now - start >=
  (duration - 60) * 1000)` - every wave SPAWNED, then EITHER the field CLEARED
  or the late bound. With `duration` 600 that late bound is **540 = duration -
  60**, which is the measurement exactly, and the agreement with 360+180 is a
  COINCIDENCE OF THIS WAVE TABLE. A fourth wave at 540 moves the interval form
  to 720 and leaves the real wake at 540; a duration change moves the real wake
  and leaves the interval form alone. **So the recommended form survives exactly
  the change it was recommended for and nothing else**, and it was derived from
  a single observation of the one case that makes the two agree.
  **AND 540 IS THE LATE END: THE GARGOYLE WAKES AS SOON AS THE WAVES ARE DEAD.**
  `!graveyard.ids.length` fires the moment the field is cleared, so the bracket
  is **[360, 540]** - up to three minutes early for a party that kills what it
  spawned. The 540 was observed BECAUSE nobody cleared the field, which the
  operator's own "expected result as other players did not show up" says
  outright. **A CONSTANT MEASURED IN THE DEGENERATE CASE LOOKS EXACTLY LIKE A
  CONSTANT.** Neither form is used: the bridge branch keys on the `gargoyle`
  field appearing, which is exact in both directions and needs no wave table.
- **THE EVENT OUTLIVING ITS 600s WINDOW IS THE DESIGN, NOT THE ARRIVAL-DEADLINE
  PATTERN SHOWING UP AGAIN.** `graveyard.gargoyle_end = now + duration * 1000`
  is set AT WAKE, so the Gargoyle gets a full 600s of its own starting whenever
  it woke; past that it leaves once nobody has hit it for 20 seconds. Total
  ceiling `(duration - 60) + duration + ~20s`, about 1,160s, and a `live: true`
  at 901s is comfortably inside it rather than an overrun. The two look
  identical from outside and the consequence differs: an arrival-deadline
  overrun is a boss being kept alive by damage, this is a clock that had not
  started yet.
  **MEASURED FROM THE GARGOYLE'S OWN SPAWN THE WINDOW IS FLAT 600**, which is
  what lets `EVENT_WINDOW_SEC["gargoyle"]` be a constant where the wake cannot
  be. `end` is also published per-instance on the row once awake and the bridge
  carries it, so a consumer has the exact deadline and the derived one, and a
  disagreement between them is a finding rather than a nuisance.
- **WAVE POINTS CARRY OVER TO THE GARGOYLE, WHICH IS THE ANSWER TO THE SHARE
  PROBLEM AND NOBODY WAS LOOKING FOR IT.** `graveyard_fallen()` adds each fallen
  wave monster's `points` into `graveyard.points`, `gargoyle.points =
  Object.assign({}, graveyard.points)` at wake, and the file's own comment says
  "the points everyone earned on them carry over to the Gargoyle, so the whole
  fight counts toward its reward". Credit on the Gargoyle is share-gated -
  cooperative, confirmed at exactly 1.300/kill from the tracker - and three
  characters against 6,000,000 hp is a share problem as much as a time one.
  **So the nine minutes of zombies and ghouls are not a warm-up to sit out: they
  are how the share is banked**, and the corridor farm the pasted override sets
  up is accumulating toward the Gargoyle the whole time, whether or not the
  party can ever stand on its spawn. A design that waited at the corridor doing
  nothing until the Gargoyle woke would arrive with zero points.
- **THE +446s FRANKY KILL DOES NOT THREATEN `BOSS_DESPAWN_WINDOW_CEILING`, AND
  CHECKING WHY IS WORTH MORE THAN THE ANSWER.** Window closed 22:40:01, the boss
  died by 22:47:29 with the party on it throughout - 446s past window against a
  ceiling of 300, nearly double the previous 228s record. The ceiling admits
  `[win - 180, win + 300]`, so +446 falls OUTSIDE the band and
  `despawn_window_hit` returns false: the row is recorded as a kill, which is
  what it was. The ceiling fails in the direction of calling a despawn a kill,
  never the reverse, and a widening to cover +446 would start admitting real
  late kills as despawns - deflating the kill record, the mirror of the
  inflation the classifier was built to fix. **A MEASUREMENT THAT BLOWS PAST A
  THRESHOLD IS NOT AUTOMATICALLY AN ARGUMENT TO MOVE IT**; which side of the
  threshold the error lands on is the question, and here the overshoot is the
  safe side.
- **A COUNTER WITH NO BASELINE IS NOT A MEASUREMENT** - the browser session's
  own filing, after the party left level2w, crossed main, reached spookytown and
  returned without leaving EU IV, and franky then died with them present. That
  was a free natural experiment on whether the award loop's `if (current)` guard
  is shard-scoped or map-scoped, and the post-kill franky 10 / 12.85 is equally
  consistent with credit landing and with it having read 10 an hour earlier. The
  question is still open and was answerable right up until nobody read the
  counter. Same shape as the despawn-row nulls. Rule: **tracker baseline BEFORE
  any credit experiment**, not after.
  Incidental and useful: `max.monsters.franky` is `[15.0, "Dexon"]`, so the
  account max is held by our own ranger and pushing franky on anyone else adds
  nothing until they pass 15.
- **A SHORT-WINDOW DPS SAMPLE IS A LOWER BOUND ON A CROWD, NOT AN ESTIMATE, AND
  IT WAS OFF BY 20% IN THE DIRECTION THAT LOSES FIGHTS.** An 18s window gave
  42,124 hp/s against a true 25-minute average of 50,890; the projected death at
  22:52:24 happened by 22:47:29, five minutes early. The crowd's rate is NOT
  stationary - contributors keep arriving - so an extrapolation from a short
  window systematically under-promises. That bears directly on `ttk_upper_*` and
  on any "will it die inside our budget" gate: the error is toward declining a
  fight that would in fact have finished, which is the expensive direction and
  the one a skip row records as `declined_on: "dps"`.
- **GRAVEYARD IS AUTOMATIC AS OF Ranger v111 / Priest v59 / Mage v82, THROUGH
  THE BOSS-EVENT LAYER - AND THE TWO INSTRUCTIONS THAT LOOKED CONTRADICTORY
  NEVER WERE.** "I did not want the ranger script updated. I wanted an override
  code I could paste and execute" was about THE TOOL FOR ONE NIGHT'S
  OBSERVATION, a throwaway snippet. The standing instruction - "I do want it
  automatically handled similar to goo brawl and at the same rank as horseman" -
  was never cancelled. So v110's revert was right for what it reverted (a
  COMMAND in the file is a file change wearing a command's clothes) and the
  feature was still owed. **THE BROWSER SESSION CAUGHT THEIR OWN WIDENING
  BEFORE SENDING A BLOCK TELLING THIS SESSION TO UNDO THE REVERT**, so it cost
  a delay and not a second wrong shape. The tell they name is worth keeping:
  **two instructions that cannot both be true usually means a reader widened
  one** - which is the `never_observable` failure in another costume, and the
  THIRD time this week a narrow statement was read as a sweeping one.
- **THE LAYER WAS THE WHOLE DESIGN, AND THE EXEMPTION WAS THE TELL POINTING AT
  IT.** v108 had to edit `achvTick()` to exempt its takeover from the queue's
  hand-move check. This file already recorded that as "the automation was
  carrying its own exception"; the sharper reading is that the exception was the
  price of the FARM layer, not of automation. Boss events own movement through
  `shouldHandleEvents()`/`handleEvents()`, so the same feature on that layer
  needs no exemption at all - four table rows and a guard. **WHEN A NEW
  SUBSYSTEM NEEDS AN EXCEPTION CARVED INTO AN OLD ONE, THE QUESTION IS WHICH
  LAYER IT BELONGS ON** - the earlier phrasing asked only whether the exception
  was the price of the shape, and stopped one step short of the answer.
- **THE FOUR ENTRIES ALONE WOULD HAVE SHIPPED AN INERT APPROACH, AND THE
  PUBLISHED COORDINATES ARE WHY.** `bossWalkTarget` reads `parent.S[name]`
  FIRST, and `parent.S.graveyard` carries x/y **255,-1545 from the first wave** -
  they are `rules.gargoyle`, the Gargoyle's fixed spawn, present long before the
  Gargoyle is. That point is inside the mummy rage rectangle, `safeSmartMove`
  refuses it, and the hop-sick walk would simply never arrive: one orange line,
  no fault logged. The guard is DERIVED - any event whose published point lands
  in a rage rectangle falls through to the join spot, via `rageHit`, the same
  predicate `safeMove` consults - and it is GATED ON `rageCfg().enabled`, so
  turning containment off to enter the box also turns the guard off and the walk
  aims at the real Gargoyle. One guard, both cases.
  **A PUBLISHED POSITION IS THE MONSTER'S, NOT A PLACE TO STAND**, and for every
  other boss those coincide. That is the reusable half.
- **THE JOIN SPOT IS THE SERVER'S OWN (255,-1030), NOT THE FARM PARK POINT.**
  `node/server.js`'s join handler reads `transport_player_to(player,
  "spookytown", [255, -1030, 0, 30])` with the comment "Below the graveyard's
  stairs, out of the Mummies' reach" - and it checks out, clearing the rage
  rectangle's -1130 edge by 100 units and both booboo boxes. The proposal in
  hand was (290,-990), the achievement queue's park point in the same corridor.
  Both are correct places to STAND; only one is where `join` actually puts you,
  which is `BOSS_JOIN_SPOTS`' single invariant - every other row mirrors that
  handler exactly. The farm point keeps its measured 13-waypoint approach chain,
  which (255,-1030) does not have, so a walk there pays the route search.
- **`BOSS_FIGHT_TYPES` IS THE ELIGIBILITY GATE AS WELL AS THE ATTACK LIST, AND
  ITS NAME SAYS ONLY THE SECOND.** `bossCooperative()` reads
  `bossMonsterTypes()`, so without a `graveyard` row the name falls to the
  `[name]` default, finds no `G.monsters.graveyard`, answers NOT cooperative,
  and `bossEligible()` refuses the event outright. Nothing about "fight types"
  suggests that, and the row looks like a nicety until you delete it. Pinned by
  the inverted assertion.
- **`bossRank.graveyard` IS 4, TYING HORSEMAN, AND THE TIE IS UNREACHABLE RATHER
  THAN MERELY UNLIKELY.** horseman is realm hour 0 - UTC 23/05/17, all ODD -
  while graveyard is odd realm hours minus odd offsets, landing on EVEN UTC at
  :30; minimum separation 20 minutes. So the fall-through to `need` and
  `kills_to_rung` that the horseman INSERTION was shaped to avoid can never be
  reached here, which is what makes a tie acceptable this time. **CONTINGENT ON
  `TIMEO` BEING ALL-ODD** - the same parity the graveyard-simultaneity bullet
  rests on - so it is asserted in the suite rather than described, and a fourth
  region at an even offset exposes it with no code change.
  Rank 4 over the 6 first argued: twelve a day and ~144 before season end is an
  ABUNDANCE argument, and abundance is the wrong axis when every window banks
  share toward a 6,000,000 cooperative boss.
- **MY FIRST DRAFT OF THE GUARD FAILED OPEN, AND THE SUITE CAUGHT IT RATHER THAN
  A READER.** It wrapped `rageCfg()` and `rageHit()` in try/catch; `rageCfg`
  threw in the harness over a missing `ragePullShared`, the catch answered "not
  contained", and the boxed point was reported as fine - the Form B lie, in the
  one function where it means walking into the rectangle. Both are top-level
  declarations in the SAME file, so they are called bare now. **A DEFENSIVE
  CATCH AROUND YOUR OWN FILE'S FUNCTIONS CAN ONLY CONVERT A FAULT INTO A WRONG
  ANSWER**, which is the `ms_to_next_skill is OURS` distinction arriving from a
  new direction.
- **AND THE DIVERGENCE CHECK EARNED ITS KEEP TWICE IN ONE COMMIT.** Changing
  Ranger alone failed `BOSS_JOIN_SPOTS` and `BOSS_FIGHT_TYPES` identity
  immediately. `bossWalkTarget` was NOT on the list and was three identical
  one-liners until this commit - the moment it carried a guard, an unchecked
  copy in two of three files became exactly the invisible drift the block exists
  for, and the symptom would have been followers walking somewhere the leader
  refuses. It is on the list now. **A FUNCTION JOINS THE DIVERGENCE LIST WHEN IT
  STOPS BEING TRIVIAL, NOT WHEN IT IS WRITTEN**, and nothing prompts that review
  except noticing it.
- **ONE STALE TEST PATTERN, FIXED RATHER THAN DELETED.** `no CONFIG.graveyard
  block` matched any one-tab `graveyard: {`, and `BOSS_JOIN_SPOTS` now
  legitimately has one, so a correct change turned a guard assertion red. The
  repair narrows it to the CONFIG toggle shape and adds a precondition asserting
  the new row IS present - **a pattern that cannot tell the thing it forbids
  from the thing that replaced it is worse than no pattern.**
- **`const X = [` IS THE ARRAY FORM OF THE NON-LIFTABLE INITIALISER, AND IT
  THROWS INSTEAD OF SILENTLY SWALLOWING.** `lift()` brace-matches from the first
  `{`, which for `const EVENT_LOCATIONS = [` is the first ELEMENT, so the match
  runs to end-of-file and reports "Unexpected end of input". Same family as
  `const X = new Set([...])`, and louder - the Set case swallowed a neighbouring
  declaration and failed a different test. Supplied in the world and PINNED from
  the source text, because `bossWalkTarget` consults `EVENT_LOCATIONS` BEFORE
  `BOSS_JOIN_SPOTS`: a graveyard row there would take precedence and the guard
  assertion would be testing nothing. `let ragePullShared = null` is the same
  shape and had to be supplied too.
- **ENTERING THE RAGE BOX IS BUILT (Ranger v112 / Priest v60 / Mage v83) AND
  SHIPS OFF.** Operator's ruling: "that still needs to happen if enough people
  show up to share the mummy attacks." `CONFIG.bossEvents.rageEntry` is the
  block; `minSoaked`, `holdMs`, `retreatAtAttackers` and `trustMs` are
  PROVISIONAL, because nobody has measured a crowded graveyard and the rip edge
  now records the two fields that would settle them.
- **THE RECOMMENDED SIGNAL COULD NOT GATE ENTRY, AND THE REASON GENERALISES.**
  attackers-per-character is the right quantity and it is UNAVAILABLE AT THE
  MOMENT OF THE DECISION: parked in the corridor pulling one mummy at a time we
  have no attackers to count, so it only exists once we are already inside -
  which is the decision it was meant to inform. **A SIGNAL THAT ONLY APPEARS
  AFTER THE ACTION CANNOT GATE THE ACTION**, and it reads as the obvious choice
  precisely because it is the quantity that matters. What IS visible from
  outside is OTHER players' aggro: `rageCrowdSoak()` counts monsters inside a
  rage rectangle whose `target` is a name not in our party. So the gate reads
  theirs and the retreat reads ours, and the headcount objection is answered
  without a headcount - it observes the distribution rather than guessing it,
  and notices thinning because it recomputes every tick.
  Unverified and flagged as the browser session's: whether entities deep in the
  mummy field are in range from the corridor at all, ~263 units to the nearest
  spawn edge. If not, `soaked` reads 0 and the gate never opens - the safe
  direction, and `boxed` tells that apart from a quiet field.
- **ENTRY IS A PARTY-WIDE MOVEMENT MODE, WHICH NEITHER SESSION'S DESIGN
  ACCOUNTED FOR.** `rageCfg().enabled` now consults `rageEntryActive`, so entry
  IS containment coming off - `safeMove` falls through to `xmove`, `rageGuard`
  stops shoving us out, `ragePullActive` stops pulling. A character that enters
  while another does not accepts a destination the other still refuses: the
  leader walks into the field, the followers hold at the corridor, and the party
  splits with nothing logging a fault - the "movement ownership" section's
  failure reached by a new route. So the leader alone evaluates and broadcasts a
  `rageentry` relay message; three characters computing one predicate from three
  entity views is "two state machines over one decision" with a third added.
  A follower hearing nothing for `trustMs` falls OUT, so a leader that stops
  ticking strands nobody inside - and the RETREAT runs before the leader check,
  because bodies on me are a fact only I can see.
- **AND THE BLUNT LEVER THE HANDOFF OFFERED AS THE WORKAROUND WOULD HAVE CAUSED
  EXACTLY THAT SPLIT.** "`rageCfg().enabled` comes from
  `CONFIG.achievements.pull.enabled`, and false opens all three gates at once -
  that IS walk in" is true ON THE RANGER and nowhere else: **Priest and Mage
  have no `CONFIG.achievements` block at all**, so `a` is `{}`, `enabled` is
  hard-true, and flipping the Ranger's toggle disables containment on Dexon
  alone. Found by porting rather than by reading, and it is the
  `rageRequiredRange` correction's sibling - a mechanism read correctly in one
  file and assumed to be the party's.
- **`rageCfg` COULD NOT JOIN THE DIVERGENCE LOOP, AND LEAVING IT OUT IS WHAT THE
  MUTATION CAUGHT.** Its three bodies differ by exactly one token - the
  `-> <X>Comments.md#anchor` pointer, per-file BY DESIGN - so byte-identity
  fails against correct code and the tempting repair is to omit it. Omitted, a
  mutation dropping `!rageEntryActive` from PRIEST's copy alone passed every
  assertion in the suite: the party-splitting change, invisible. The working
  form NORMALISES the one thing allowed to differ and compares the rest, with an
  inverted assertion proving the normaliser is doing work rather than hiding a
  real difference. **WHEN A CHECK CANNOT BE APPLIED AS WRITTEN, THE ANSWER IS TO
  NARROW WHAT IT IGNORES, NOT TO DROP THE SUBJECT** - and the tell that it was
  dropped was a mutation scoring zero, not anything visible in the file.
- **A DEATH IS A TRIGGER, NOT A VERDICT** - the operator's correction, and the
  rip edge now carries `attackersAtDeath` and `soakAtDeath` so a single sample
  stops being uninterpretable. Aggro assignment is stochastic, so one death
  cannot show a gate was miscalibrated; the death COUNTER integrates over
  samples and `maxDeaths` already reads it. Two layers, and the existing trip
  record already encoded the distinction: the `!character.rip && wasRip` branch
  handles variance (crowd still there, go back) by recomputing entry from
  scratch, and the counter handles a bad gate.
- **THE GRAVEYARD ROUTE WORKED ON ITS FIRST LIVE WINDOW AND KILLED NOTHING, AND
  THE CAUSE IS THIS FILE'S OWN WARNING APPLIED TO THE OTHER PATH.** Measured
  2026-10-22, 06:30Z: `bossPick()` became graveyard and TWO SECONDS after the
  open Dexon was standing on `BOSS_JOIN_SPOTS` at (255,-1030) - the first clean
  demonstration that rank 4 moves the party by itself, and that `c80a346`
  including the `bossWalkTarget` guard works end to end. Then zombie +0,
  ghoul +0, gargoyle +0, while the gargoyle on their own shard lived seven
  minutes and died at 0.01%. **PRESENT ON SHARD, ZERO CREDIT.**
  Read off the priest mid-window: `destination` was the FARM target (crabx on
  `main`), `rageAlso` was `[]`, `ragePullTypes()` answered `["crabx"]`, and
  `ragePullActive()` early-returned on `destination.map !== character.map`.
  Every target was inside the mummy rectangle, `safeMove` refuses every
  coordinate in it, so the ONLY engagement route from the join spot is the
  PULL - and it was idle.
  **THIS FILE ALREADY CARRIED THE WARNING, ABOUT THE MANUAL OVERRIDE: "mummy
  has to be in `rageAlso` ... `home: 'zombie'` alone leaves the pull machinery
  idle."** The snippet worked because it set `manualOverride` AND `rageAlso` AND
  ran `runFarmSearch()`. The automatic path sets none of the three. So a hazard
  written up for one route was live on the other the whole time, and nobody
  checked - the `CaveRun.js:227` shape again: a correct claim nobody carried
  across to the neighbouring caller.
  Fixed in Ranger v113 / Priest v61 / Mage v84 by having the pull READ the boss
  context (`ragePullCtx()`) rather than having the boss path write into farm
  state, which is v108's mistake from the other end. `bossWalkTarget` supplies
  the park point for free, since v111's guard already falls it through to the
  join spot.
  **AND AN EARLIER EXPLANATION IS RETRACTED BY ITS OWN AUTHOR**: that
  horseman/gargoyle being absent from `CONFIG.combat.alwaysAttack` and
  `attackIfTargeted` was the cause. The pull is the binding constraint for the
  graveyard and it is measured; the lists may still matter for horseman, which
  sits in no rage box and had no pull dependency at all.
- **A WIDENING AND A REPLACEMENT LOOK IDENTICAL UNTIL YOU ASK WHO ELSE READS
  THE PREDICATE.** The obvious fix was to swap `ragePullActive()`'s box-TYPE
  test for a POSITIONAL one, since position is what the candidate scan has
  always asked and the type test is what cannot see an event spawn. That would
  have regressed the mummy and booboo farms: `rageHoldFire()` consults the same
  predicate, and its FIRST job is to stop the party fighting on the way in - so
  on an approach with nothing yet inside a rectangle, a positional test answers
  "inactive", hold-fire switches off, and the party stops to fight exactly where
  its own comment says it must not. Both disjuncts ship, and the regression case
  is an assertion rather than a memory.
- **HORSEMAN IS KILLABLE AND THE POLL CHANGE IS PROVEN, 05:00Z 2026-10-22.**
  267 rows, SIX spawns at 05:00:02Z one per US shard, hp 30,000,000. Five kills
  at 391s, 620s, 686s, 710s and 1322s against a 2400s window - so comfortably
  inside it, which settles "worth hopping for" with data rather than ranking.
  All five graded `low` via `absent_on_responding_server`, which is CORRECT by
  construction and is exactly the population `ttk_upper_*` exists for.
  **ROUTING ALSO WORKED THERE AND ALSO PAID NOTHING, AND THE TWO EXPLANATIONS
  CANNOT BE SEPARATED.** At 05:17:52Z `bossPick` was horseman, the trip was
  horseman, Dexon was on `halloween`, and the boss was at 24.46% - so the party
  arrived with a crowd three quarters done, and `share > 0.0025` is a complete
  alternative to any attack-list problem. `max.monsters.horseman` is still
  "none" - but see the `max`-versus-`own` correction below before reading that
  as "no character has ever killed one"; the baseline that actually settles it
  is `own=0` on all three, measured 2026-10-22T11:30Z.
  **HORSEMAN SPAWNS REGION-WIDE IN ONE SECOND, NOT PER-SHARD:** 2026-10-22T05:00:02Z
  on all six US shards at once - I, II, III, IV, V and PVP - so a single window
  offers six chances rather than one. US III was still being fought at elapsed
  2,971s and died 05:49:32Z, the arrival-deadline rule holding again.
- **AND A THIRD EXPLANATION WAS SITTING IN A TABLE NOBODY REVISITED: horseman
  HAD NO `BOSS_JOIN_SPOTS` ROW, SO THE SERVER'S FREE TELEPORT WAS NEVER USED.**
  Read from upstream `16881a27` 2026-10-22: the join handler's horseman branch
  is `transport_player_to(player, "halloween", [-405, -1560, 0, 40])` behind a
  200-unit skip, the same SHAPE as crabxx, franky and icegolem - so it is a taxi
  to an ordinary walkable map, and `halloween` carries five doors, which is what
  `bossTaxiWalkable()` reads. `bossApproach` gates its ENTIRE join block on that
  table, so horseman was walked to even when clean. **IT DOES NOT EXPLAIN THE
  ZERO**, and must not be read as having closed the bullet above: the walk
  arrived, Dexon was on `halloween` with the boss at 24.46%, and the share gate
  is still the live answer.
  **THE LATENT HALF IS WHY IT MATTERED, AND IT WAS ARMED BY AN EDIT NOBODY WOULD
  CONNECT TO IT.** `isTaxiJoin()` is `isJoinEvent()` AND that table, and
  horseman carries `join: true`, so without the row the three hop gates treated
  it exactly like goobrawl - refused outright while hop-sick, given the larger
  pre-spawn buffer, and charged the full sickness wait in the window test. All
  three iterate `CONFIG.bossHop.targets`, so the mistreatment was UNREACHABLE
  while that list omitted horseman - and the 05:00Z measurement above is exactly
  the argument for adding it. **A DEFECT GATED BEHIND AN OPERATOR CONFIG EDIT
  CANNOT BE FOUND BY WATCHING THE THING RUN**, which is the `GEAR_PROGRESSION`
  repeal of dexbelt's sell guard from the other direction: a data edit elsewhere
  decides whether a guard applies, and nothing at either site says so. Fixed in
  Ranger v114 / Priest v62 / Mage v85; the inversion is pinned, and dropping the
  row from the PRIEST alone fails the relay divergence check.
  **HOW IT WAS MISSED IS THE REUSABLE PART: horseman ARRIVED AS A RANKING
  ENTRY.** One `bossRank` row and one bridge window row, 2026-10-21, and nothing
  about adding a boss to a PRIORITY table prompts the question "can we be
  teleported to it". The join table's own comment derives walkability from `G`
  so the game can change the answer - and derivation cannot help a name that
  was never entered.
- **goobrawl PUBLISHES NO `live` FIELD, SO THE BOSS-EVENT LAYER COULD NEVER
  HANDLE IT ON ANY CHARACTER - AND THE 70-TO-0 bgoo SPLIT IS NOT A FOLLOWER
  ASYMMETRY.** Read from upstream `16881a27` 2026-10-22, after the browser
  session measured bgoo own: Dexon 70, FatherToken 0, MageofOz 0. THREE shapes
  reach `parent.S`: crabxx, franky, icegolem and horseman come out of one
  `forEach` carrying `{live, map, hp, max_hp, target, x, y, end}`;
  `graveyard_public()` returns `live: true`; and goobrawl is
  `E.goobrawl = { end: timers.goobrawl }` with `delete E.goobrawl` at the
  close - no `live`, no map, no hp, so its PRESENCE is the only signal it has.
  `bossPick()` gated all three of its paths on that field (forced and leader on
  `d && d.live`, the own reading through `bossLiveNames()` filtering `v.live`),
  so it returned null for goobrawl on every character, `shouldHandleEvents()`
  stayed false, `handleEvents()` never ran and the join was never emitted by
  anybody. **`bossApproach` IS BYTE-IDENTICAL IN ALL THREE FILES and the relay
  suite pins it, so there was never a leader-only join path to find** - the
  question "can a follower enter goobrawl" had a leader-shaped answer and the
  defect was upstream of both.
  Fixed in Ranger v115 / Priest v63 / Mage v86 with ONE predicate,
  `bossEntryLive(name, d)`, read from all three gates - the give-up cooldown
  lesson applied before it could bite: a shared predicate read from only one
  call site is not yet shared, and what it produces is inaction with no log
  line. **PRESENCE IS A NAMED SET, NOT A RULE**: `bossLiveNames()` iterates
  EVERY key of `S`, and `S` is the whole `server_info` payload rather than a
  boss table. That widening is an inverted assertion, and so is the dropped row
  (9 failures), one gate reverted to a bare `d.live` (3) and a PRIEST-only
  drift (the divergence check).
  **AND THE KEY LIST THIS BULLET FIRST GAVE AS THE EVIDENCE DID NOT EXIST.** It
  named `time_offset`, `night`, `dailies` and `nightlies` as keys of `S`; all
  four are FIELDS INSIDE `schedule`, which the schedule section of this very
  file already states. The browser session caught it against a live read hours
  after it was written. **MEASURED, US II 2026-10-22, ten keys:** `schedule`,
  `event_flags`, `event_ends`, `blessed_minutes`, `blessed_by`, `halloween`,
  `witchcipher`, `slenderman`, `mrgreen`, `mrpumpkin` - so the keys a general
  rule would actually swallow are `event_flags`, `blessed_by` and `halloween`.
  The conclusion is untouched and was never in doubt; the FIXTURE was exercising
  a payload shape the game does not produce, so the widening assertion passed
  against fiction. Corrected in the three scripts and in
  `Tests/suite_bosshop.js`; the re-run mutation still fails 4.
  **THIS IS "A COMMENT IS A CLAIM" ON A COMMENT WRITTEN TO EXPLAIN A FIX FOR A
  CLAIM THAT ROTTED**, inside the same day - and the tell was available to its
  author, who had the schedule section's own field list in front of them and
  reached for a remembered set instead of the measured one.
  **`slenderman` IS THE KEY THAT MAKES THE NAMED SET LOOK WRONG AND DOES NOT
  MAKE IT WRONG.** It carries the FULL boss shape - `live: true`, map, hp
  66,666, max_hp - so it reaches `bossLiveNames()` on its own `live` field and
  always has, with no presence rule involved. It is `cooperative: true` in
  `design/monsters.js`, so `bossCooperative` would admit it; what refuses it is
  `CONFIG.bossEvents.exclude`, whose own comment records why (the server sends
  `{name, map}` with no x/y so `bossWalkTarget` returns null, and approaching
  him warps him away). So a reader who finds him live and unranked should look
  at the exclude set. Asserted from the SOURCE TEXT, because that set is a
  non-liftable `new Set([...])` and a fixture copy would prove nothing.
  **AND THE RANKING TABLE CITED goobrawl AS ITS OWN EXAMPLE, WHICH IS HOW THIS
  HID FOR AS LONG AS IT DID.** `BOSS_RANK`'s comment explains the event-name
  keying "because that is what `bossLiveNames()` yields - goobrawl, not rgoo":
  true of every other entry and false of the one it names, so
  `bossRank.goobrawl = 3` was UNREACHABLE from the day it was written. Same
  state as dragold under `lunarnewyear`, except that one is recorded in the
  file and this one was not. **A COMMENT'S EXAMPLE IS A CLAIM TOO, and an
  example chosen to illustrate a convention is the least likely part of it to
  be checked.**
  **TWO HYPOTHESES DIED ON THE MECHANISM, AND ONE HAD BEEN REFUTED BY THE WRONG
  ROUTE.** The followers' empty `CONFIG.combat.alwaysAttack` and
  `attackIfTargeted` - genuinely absent from both files, not operator config -
  were ruled out from the crabxx/franky/icegolem credit row. Right verdict,
  wrong mechanism: those lists are not what engages a follower on a boss.
  `findBestTargetInner()` asks `BOSS_SET` membership AND `boss.target` AND
  `max_distance: character.range`, and `BOSS_SET` spreads `allBosses`, which
  names `bgoo` and `rgoo` - so the followers could always engage a targeted goo
  in range. **A REFUTATION THAT REACHES THE RIGHT VERDICT BY THE WRONG ROUTE
  LEAVES THE NEXT READER BELIEVING THE WRONG MECHANISM**, and here it pointed
  at the combat lists.
  **WHAT IT DOES NOT ESTABLISH: that the followers will now earn credit.** It
  removes the reason nobody could be ROUTED there; presence at the kills, and
  range, are a live question for the next window. Dexon's 70 were earned
  without this path at all, so something else put him on that map - the
  operator's "I have even joined them but the script immediately goes to
  another boss and does not stay" fits a manual join plus a farm layer owning
  movement because `shouldHandleEvents()` was false.
- **DEXON HAS HIS FIRST-EVER ZOMBIE CREDITS, 0 -> 11, AND THE GRAVEYARD
  ASYMMETRY THIS FILE CALLED STRUCTURAL IS NOT.** Measured 18:45Z 2026-10-22
  against the 11:30Z baseline: zombie Dexon 0 -> 11, FatherToken 12 -> 31,
  MageofOz 17 -> 51; ghoul Dexon still 0, followers 1 -> 2; mummy 1620 -> 1628;
  bgoo 70/0/0 UNCHANGED.
  **THE EXPLANATION ON THE PAGE WAS ABOUT MUMMIES AND WAS LET TO COVER
  ZOMBIES** - the browser session's own naming. "Dexon's 163 reach against the
  mummy halo, so he holds the corridor and earns nothing" is sound for the
  mummy field and says nothing about the graveyard's OWN spawns, which are a
  different monster at different coordinates. He is crediting them now.
  **WHAT IS NOT ESTABLISHED IS WHICH WINDOW DID IT.** The gap is 7h15m,
  graveyard is a `repeat` slot so more than one window may have opened, and the
  party was on spookytown fighting mrgreen in between - a wandering zombie near
  that fight is a complete alternative to graveyard attendance. The honest
  claim is first-ever ranger zombie credit inside the window in which v113 was
  the only change, NOT that v113 did it. The 18:30Z window was not sampled.
  **THE BASELINE IS THE ONLY REASON ANY OF THIS IS RECOVERABLE**, which is the
  tracker-baseline rule earning its keep rather than a near miss - and bgoo
  holding at 70/0/0 means the goobrawl baseline is still clean for the next
  window, with the 2.6:1:1 spread-shot expectation unspent.
- **THE GARGOYLE "DEFECT" WAS ONE RECORDED DECISION PLUS ONE TIMING ARTEFACT,
  AND THE SUITE REFUSED THE FIX BEFORE A READER DID - THE SECOND TIME AN
  ASSERTION HAS OBJECTED ON THE OPERATOR'S BEHALF.** The browser session
  measured four causes live on 2026-10-22 during a graveyard the operator had
  to force the party into by hand: `bossMonsterTypes('graveyard')` lacking
  gargoyle, the combat lists lacking it, `bossRank('gargoyle')` at the default
  7, and `parent.S.graveyard` ABSENT at 20:47:03 while a dashboard showed a
  gargoyle at 48.4%. Three of the four dissolve on reading.
  **THE EXCLUSION IS DELIBERATE AND ITS OWN WORDS SAY SO.** Adding `gargoyle`
  to `BOSS_FIGHT_TYPES` was written, and three assertions went red, one of them
  "the gargoyle is deliberately NOT in the fight list". The flattened
  all-tracked-files search found the rationale in `Party/RangerChangelog.md`:
  6,000,000 hp and cooperative so three characters cannot take it, its spawn
  inside the mummy rectangle, and **the waves' points carry over to it anyway -
  `graveyard_fallen()` banks them and the wake copies them - so excluding it
  costs no share**, closing with "whether a crowd should flip this is the
  operator's open call, not a default". Reverted unbuilt, exactly as CaveRun
  item 2 was. **A GREEN SUITE MEANS NOTHING I KNOW OF OBJECTS, and this is the
  second red that was a policy conflict rather than a defect.**
  **AND THAT SAME CLAUSE EXPLAINS THE CREDIT WITHOUT THE FORCING.** MageofOz
  gargoyle 6 -> 7 was offered with the honest caveat that no counterfactual
  exists; the carried-over wave points mean credit lands from farming the waves
  and being present at the death, with no gargoyle damage required at all. So
  the observation is evidence FOR the recorded design rather than against it.
  **`bossRank('gargoyle')` IS UNREACHABLE AND MEASURING IT MEASURES NOTHING.**
  The gargoyle is published INSIDE the `graveyard` entry, so `bossLiveNames()`
  yields `graveyard`, which is ranked 4. There is no path that asks the
  ranking for a gargoyle - the same state as `bossRank.goobrawl` before v115,
  except this one is correct rather than a latent bug.
- **THE VANISHING `S.graveyard` IS THE EVENT HAVING ENDED, AND THE ARITHMETIC
  IS ON THE PAGE ALREADY.** Read from upstream `16881a27`: `delete E.graveyard`
  exists at EXACTLY ONE site, inside `graveyard_finish`, and the gargoyle
  branch of `graveyard_tick` reaches it two ways - `graveyard.defeated`, or
  `now > graveyard.gargoyle_end && ssince(gargoyle.last.attacked) > 20`.
  `gargoyle_end` is stamped AT WAKE as `now + duration * 1000`, so for a wake
  observed at 20:36:08Z it is **20:46:08Z** - and the "gone" reading was taken
  at 20:47:03Z, FIFTY-FIVE SECONDS PAST IT. Both endings predict exactly what
  was seen. **No path in the source deletes that key while the gargoyle lives
  on that shard**, so there is no publisher defect to design around.
  **AND MY OWN EXPLANATION OF WHY WAS WRONG, CORRECTED BY THE BROWSER SESSION
  THE SAME DAY - IT WAS A TIME ERROR, NOT A PROVENANCE ONE.** This bullet said
  the 48.4% came from a dashboard covering every shard against a character's
  `S` covering one, and called that two terms of different provenance. The row
  carried `US II` IN ITS OWN COLUMN, the same shard as Dexon, so the shards
  matched and that explanation is retracted.
  **NOR WAS IT THE TIMEOUT.** `gargoyle_end` at 20:46:08Z is right, but removal
  ALSO needs `ssince(gargoyle.last.attacked) > 20`, and at 20:46 the boss was
  taking 31,738 dps - the second clause was false. What fired was `defeated`:
  the operator reported the fight over at 20:47 and the probe was at 20:47:03.
  **The boss died inside the gap between the two readings.**
  So the fault is TREATING TWO READINGS A MINUTE APART AS SIMULTANEOUS, across
  the one minute that mattered. It is worth separating from provenance because
  the REMEDY differs: for provenance you check which shard each side came
  from, for this you ask whether anything happened in the gap. **A COMPARISON
  NEEDS BOTH TERMS' TIMES AS WELL AS BOTH TERMS' SOURCES**, and the honest form
  of the original claim was always "S lacked the key 55 seconds after a kill",
  which asserts nothing at all.
  **A WRONG DIAGNOSIS OF A WRONG DIAGNOSIS PROPAGATES FURTHER THAN THE
  ORIGINAL**, because it arrives wearing a correction's authority - this one
  was committed to this file and would have taught the next reader to reach
  for a shard check on a timing bug.
- **WHAT WAS REAL IS ONE LAYER FURTHER IN, AND IT IS FIXED IN Ranger v117 /
  Priest v65 / Mage v88: THE ATTACK GATE COULD NOT SEE AN EVENT'S OWN
  MONSTERS.** `allBosses` names no event spawn - not zombie, not ghoul, not
  horseman, not gargoyle - and the ranger's `attackIfTargeted` and the
  followers' `BOSS_SET` are both built from it. So on a graveyard trip Dexon
  shot a zombie only when that zombie was on FatherToken, the one name in
  `targetPriority`: aggro luck rather than a rule, and it fits the ranger's
  0 -> 11 zombie credits against the followers' 12 -> 31 and 17 -> 51.
  **THE PULL AND THE GATE ARE DIFFERENT LAYERS AND v113 FIXED THE OTHER ONE** -
  the pull brings the monster to us, the gate decides whether we shoot it, and
  a correct pull with a blind gate produces a party standing in range doing
  nothing.
  `bossFightTypes()` returns the live trip's `bossMonsterTypes()` and `[]`
  otherwise, so the widening exists only on the event. **NOT done by widening
  `alwaysAttack`, which is a SORT KEY in `updateCache` as well as a filter** -
  a zombie there would outrank the farm target on every map, the argument the
  `rageAlso` check already records.
  **THAT IS ITS OWN HAZARD CLASS AND THE BROWSER SESSION NAMED IT: A FIELD TWO
  SUBSYSTEMS READ FOR DIFFERENT PURPOSES CANNOT BE WIDENED BY EITHER ALONE.**
  `alwaysAttack` answers "may I shoot this" to the filter and "how important is
  it" to the sort, and a name added for the first silently changes the second
  everywhere, forever - no error, no log line, and the damage is on maps the
  editor was not thinking about. It is adjacent to `pontyWanted()` doubling as
  a sell guard and to `CONFIG.achievements.pull.enabled` gating three things at
  once, which makes three recorded instances: **before adding to a list, find
  every reader, because the one you know about is the one that prompted the
  edit.** The ranger OPENS (its clause excludes any
  type those sets already name, so goobrawl keeps its `.target` rule) and the
  followers JOIN (their loop gains the types and keeps `.target`).
- **TWO MUTATIONS SCORED ZERO IN A ROW ON THE SAME CHANGE, AND THE SECOND IS
  THE ONE WORTH KEEPING.** Reverting the MAGE's loop moved no assertion,
  because the ranger assertions cover a different function in a different
  file - the `assert on the far side of a handoff` lesson, with the handoff
  being a shared predicate read by two unlike call sites. Fixed, and then
  reverting the PRIEST's moved nothing either, because the behavioural test
  lifts from the Mage alone. Their `findBestTargetInner` bodies legitimately
  differ, so byte-identity cannot take them and the tempting repair is to drop
  the subject; the working form narrows the check to the ONE LINE both files
  must carry, with the `.target` half asserted beside it. **A SHARED PREDICATE
  ON THE DIVERGENCE LIST DOES NOT COVER THE CALL SITES THAT READ IT.**
- **A THIRD NON-LIFTABLE SHAPE: A DEFAULT PARAMETER.**
  `function get_nearest_monster_v2(args = {})` cannot be lifted - `lift()`
  brace-matches from the first `{`, which here is the DEFAULT PARAMETER VALUE,
  so the match runs to end-of-file and throws "Unexpected end of input". Same
  family as `const X = new Set([` and `const X = [`, reached through a
  parameter list rather than an initialiser, and it fails LOUD like the array
  form rather than silently swallowing a neighbour.
- **`max.monsters[X]` ABSENT DOES NOT MEAN NOBODY HAS EVER CREDITED ONE.** The
  browser session's correction to this session, 2026-10-22: ghoul reads
  `own=1 diff=0.3` on BOTH followers while `max.monsters.ghoul` is "none", so
  absence coexists with a credited kill. Whether `max` populates only when
  ANOTHER character holds it, or only above a floor, is NOT established and was
  deliberately not theorised. **So pair `max` with `own` whenever the question
  is "has this ever happened"** - `max` alone cannot answer it. The horseman
  reading survives because `own=0` on all three, which is the direct measure;
  it was the inference that was too strong, which is the `never_observable`
  shape in a tracker field.
  **TRACKER BASELINE, 2026-10-22T11:30Z, BEFORE ANY HORSEMAN WINDOW:** horseman
  `own=0` on Dexon, FatherToken and MageofOz, `max` none. rgoo `0/0/0`, max
  none - the account has never credited an rgoo. bgoo `70/0/0`. zombie
  `0/12/17` and ghoul `0/1/1` - **the graveyard is the MIRROR of goobrawl**, the
  ranger earning nothing where the followers earn, which already has its own
  explanation in Dexon's 163 reach against the mummy halo. crabxx `13/11`,
  franky `13/12`, icegolem `9/11` across the followers.
- **THE GARGOYLE WAKE IS BIMODAL, AND THE 540 WAS ONE MODE MEASURED ONCE.** 25
  observations across two windows on 2026-10-22, roughly half at each end of
  the [360, 540] bracket: the 06:30Z window alone gave US V 372, US IV 375,
  EU IV 378, EU I 382, US I 383, ASIA II 499, then seven shards at 540-541, and
  04:30Z gave seven early at 368-441 against five at 541. **NEITHER BOUND IS
  "THE" CONSTANT**, which is the strongest possible vindication of keying the
  bridge branch on the `gargoyle` field and writing both bounds down as
  constants used by nothing. The browser session's own framing: "540, exact, to
  the second" was one mode of a bimodal distribution, measured in the
  degenerate case. Nine gargoyle deaths that window at 0.01-0.9%, all real
  kills.
- **A ZERO MEASURED IN THE EMPTIEST POSSIBLE MOMENT IS NOT EVIDENCE.**
  `rageCrowdSoak()` returned `{soaked: 0, boxed: 0}` - three samples, all
  between 06:30:02 and 06:30:08, six seconds into a window with 12 zombies up
  and nobody else arrived yet. So whether the entry gate can ever open is STILL
  OPEN, the four `rageEntry` numbers still have nothing under them, and the
  operator has deferred them on exactly that basis. The browser session's own
  two errors behind it, both recorded: the first sampler was stored on `window`,
  which a hop wipes - this file says so and they had used `localStorage`
  correctly an hour earlier - and the second recorded only when a graveyard
  existed OR the party was south, so it wrote nothing at all while running.
  **A SAMPLER WITH A CONDITION ON WHEN IT RECORDS CAN RUN PERFECTLY AND PRODUCE
  AN EMPTY LOG**, which reads exactly like the thing being absent.
- **`G.events` NOW HOLDS FIVE NAMES THE BRIDGE DOES NOT KNOW**: `witchcipher`,
  `horseman`, `graveyard`, `trickortreat` and `halloween`, alongside `dreams` and the
  pre-existing anniversary, abtesting, goobrawl, crabxx, franky, icegolem,
  holidayseason, lunarnewyear, valentines and egghunt. Read from live `G` on
  2026-10-21.
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
- **`/boss_events` CAPS AT 5,000 ROWS, AND `hp` IS NOW THE PLURALITY OF THE
  LOG - SO A ROW-COUNTED LIMIT BUYS FAR LESS HISTORY THAN IT USED TO.**
  Measured 2026-10-22: a `limit=40000` request returned 5,000 rows, of which
  hp 1,828 (36%), spawn 1,587, death 1,519, despawn 66, lost 0 - against the
  2026-10-20 census of death 1,116 / despawn 15 / lost 120 / spawn 1,248, where
  hp did not exist. That is about six and a half hours of history and exactly
  ONE horseman spawn group, which is why the nightly cadence is not derivable
  from a 5,000-row pull.
  **THE SIX AND A HALF HOURS IS RETRACTED BY ITS OWN AUTHOR AND WAS WRONG BY
  8.5x. MEASURED 2026-10-22: 5,000 rows span 2026-10-20T12:36:09Z to
  2026-10-22T19:41:16Z = 55.09 HOURS, 90.8 rows/hour.** The span was never
  measured - it was INFERRED from the set containing only one horseman spawn
  group, and that was SPARSE SAMPLING rather than a boundary: 8 horseman spawn
  rows exist in 55 hours where six shards across two nights would predict
  dozens. **A THIN OBSERVATION READ AS AN EDGE**, which is the unchanging-hp-
  percentage mistake in a new costume, and the second time in this file's own
  idiom. The horseman clause above is wrong for the same reason and is wrong
  about its own cause.
  **THE MECHANISM SURVIVES AND IS NOW BETTER EVIDENCED THAN THE STATIC FIGURE
  WAS.** The cap is row-counted, so the span still floats with how chatty
  sampling is - and the float is measured rather than asserted: hp was 1,828 of
  5,000 (36.6%) at 11:29Z and **3,024 of 5,000 (60.5%) at 19:41Z**, nearly
  doubling in eight hours of heavy fighting. So the time span genuinely moves by
  about 2x inside one day. What changes is URGENCY: ~200 schedule change rows a
  day against ~2,180 boss rows a day is about 9% of the span, not a
  catastrophe. **THE CONCLUSION HELD AND THE ALARM ATTACHED TO IT DID NOT**,
  which is worth separating because the alarm is what a planner acts on.
  **AND `lost` IS ZERO ACROSS ALL 55 HOURS**, against the 2026-10-20 census of
  120 lost rows in 2,499. Either the condition has stopped arising or retention
  differs; flagged rather than theorised. It matters because `lost` is inside
  `BOSS_TERMINAL_EV` and a terminal class that no longer occurs changes what
  that enumeration is protecting - and the open "nobody has had a real `lost`
  row to `Object.keys`" question is now open over a much larger window than
  anyone thought they were looking at. **A planner reading "the last N events" is reading a
  window whose TIME span now depends on how chatty hp sampling is**, and it
  shortens silently with no error.
  **AND `ev !== 'spawn'` IS NOT "TERMINAL" ANY MORE - the browser session wrote
  exactly that filter and got 1,828 hp rows in a terminals list, one day after
  this file recorded the cause-versus-outcome lesson.** `BOSS_TERMINAL_EV` is
  enumerated precisely so a new `ev` value has to be classified rather than
  defaulting, and negating `spawn` bypasses the enumeration instead of testing
  membership. `hp` appears in neither `BOSS_TERMINAL_EV` nor
  `BOSS_TRANSITION_EV`. **A NEGATION IS NOT A MEMBERSHIP TEST, and it silently
  absorbs every class added after it was written.**
- **AND THE CAP IS NOT THE URGENT ITEM, BECAUSE EVERY FILTER RUNS BEFORE IT.
  MEASURED 2026-10-22 AGAINST THE LIVE HANDLER, not read: `ev=death` is capped
  at 5,000 DEATHS, not at 5,000 rows of which some are deaths.** So the span a
  consumer sees depends on ITS QUERY and not on how chatty hp sampling was -
  the 87%-and-climbing hp share shortens the UNFILTERED pull and nothing else,
  and at ~90 non-hp rows an hour a `terminal=1` pull still reaches back about
  55 hours. `boss_events_load` reads the whole file and caps nothing, so none
  of this is retention either: the rows are on disk whatever the endpoint
  answers, and `since=` makes an incremental consumer lossless outright.
  **THE EXISTING ASSERTIONS COULD NOT TELL THE TWO ORDERS APART, which is why
  this was worth measuring rather than reading.** `terminal=1&limit=1` answers
  `lost` either way, because the newest row overall is also the newest
  terminal. The discriminating case is `ev=spawn&limit=1`: filter-first answers
  the newest SPAWN, cap-first slices to the `lost` and then filters it away,
  answering EMPTY. Pinned now, with `total`/`returned`/`truncated` beside it.
  **SO THE ALARM MOVED AND THE MEASUREMENT DID NOT.** The browser session's
  numbers are right and their conclusion - that the row-counted cap is now the
  more urgent item - is true of the default pull only. A planner wanting
  terminals asks for terminals; the schedule store will too. Nothing to build.
  **AND ONE MUTATION OF MINE SCORED ZERO WITHOUT THE CODE BEING UNTESTED.** The
  first attempt inserted a `rows[-5000:]` ahead of the filters, against a
  five-row fixture, so it was a NO-OP rather than a mutation. Moving the real
  `limit` slice fails four assertions. Same tell as the `rageCfg` omission -
  a mutation that moves nothing is a claim about the mutation first.
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
- **AN ESTIMATED TIMESTAMP IS NOT AN ORDERING KEY ANYWHERE, INCLUDING WITHIN
  ONE FIGHT'S OWN ROWS. A death row's `t` IS AN ESTIMATE; `death_hi` IS THE
  OBSERVATION.** The "anywhere" was added 2026-10-21 after the second
  consumer: v100 compared `t` against an observation and discarded real
  terminals, then the closing `hp` row showed `t` reordering rows inside a
  SINGLE fight. Both failures came from reasonably assuming that local
  ordering was safe even where global ordering was not, so the scope has to be
  stated or it gets re-narrowed by the next reader. Two of the three `death_t` forms
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
- **THE LOG IS APPEND-ORDERED AND `t` IS NOT MONOTONIC WITH IT, WITHIN A
  SINGLE FIGHT.** Made concrete 2026-10-21 by driving the real poller: the
  closing `hp` row is WRITTEN BEFORE the death row and carries a LATER
  timestamp, because a death row's `t` is the poll-bracket midpoint while the
  closing row's `t` is the poll that observed the end. In the fixture the death
  reads 1157.5 against a closing sample at 1225, so sorting those rows by `t`
  puts the death BEFORE the final hp reading of the fight it ended. Same hazard
  as Ranger v100's ordering guard from the other direction - there an estimate
  was compared against an observation, here it reorders rows inside one fight -
  and it is asserted in both directions so neither reading can drift.
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
- **AN EVENT BOSS CAN NEVER PRODUCE A ttk MEDIAN, AND THAT IS STRUCTURAL
  RATHER THAN A SAMPLING ACCIDENT.** `boss_history`'s `ttk_median_sec` is
  high-confidence only by design, and "high" is reached only by the
  `respawn_offset` method, which requires a `BOSS_RESPAWN_SEC` entry.
  `EVENT_WINDOW_SEC` and `BOSS_RESPAWN_SEC` are DISJOINT, so crabxx, franky,
  icegolem, rgoo and bgoo are excluded BY CONSTRUCTION. Measured on the live log
  2026-10-20: event bosses held 29 logged kills and zero medians, while phoenix,
  greenjr and jr - all three respawn bosses - had populated percentiles. The
  chain queue's opening decision is about exactly those five, so the default
  view answered "no data" for the entire population being asked about. **THIRD
  TIME IN ONE DAY THAT A FILTER OR A NAME HID THE POPULATION OF INTEREST**,
  after `never_observable` and `ev=despawn`; the shared tell is that the
  excluded set was defined by a mechanism nobody re-read, not by the data.
- **`ttk_upper_*` EXCLUDES RECLASSIFIED DESPAWNS, AND IT DOES SO POSITIONALLY -
  NOTHING AT THE COLLECTION SITE SAYS SO.** `boss_history` rewrites `ev` to
  "despawn" at the top of its loop, so a reclassified row never reaches the
  `elif ev == "death"` branch where BOTH `kills_logged` and the bound are
  collected. That is the right answer - the count and the bound then describe
  ONE population - but it is a property of WHERE the four lines sit, not of
  anything they say, and dedenting them one level reinstates the 20
  untouched-boss rows at ~2402s into the pessimistic end a budget decision
  reads. **A CORRECTNESS PROPERTY THAT RESTS ON POSITION IS INVISIBLE TO A
  READER OF THE SITE**, which is a different hazard from the drift this file
  mostly warns about: there is no second copy and no stale claim, just a
  silence. `Tests/bridge/test_despawn.py` pins it with the precondition as well
  as the outcome - `stored_row_elapsed` IS `death_hi - spawn_t`, the same
  quantity the bound collects, so a reclassified despawn is exactly a row whose
  bound would otherwise have been admissible, and the test asserts that it is
  computable and dropped anyway. Measured by mutation: dedenting the collection
  fails three assertions, one of them the population invariant
  (`ttk_upper_sample + ttk_upper_no_spawn <= kills_logged`, an inequality
  because an unbounded death is still a kill).
- **THE PATTERN THIS FILE INSTALLED YESTERDAY HAS NOW PRODUCED ITS FIRST FALSE
  POSITIVE, AND THAT IS WORTH AS MUCH AS THE THREE TRUE ONES.** After
  `never_observable`, `ev=despawn` and `ttk_median_sec` all hid exactly the
  population of interest in one day, the browser session drafted a FOURTH -
  that `ttk_upper_*` would be contaminated by despawn rows - and withdrew it on
  checking the code, because the exclusion above was already there. Three
  instances in a day is enough to make "a filter is hiding the population" the
  first thing anyone reaches for, and a heuristic that strong starts generating
  suspects rather than findings. The discipline that made this one cheap is the
  one that made the three expensive ones findable: they checked the mechanism
  before sending. **So the rule is not "suspect filters", it is "read the
  mechanism" - which sometimes exonerates it.**
- **SO `ttk_upper_*` IS THE FIELD THOSE BOSSES ACTUALLY HAVE, and an upper bound
  is what a budget question wants anyway.** `death_hi - spawn_t` is EXACT for
  every death row regardless of confidence - `death_hi` IS `iso(poll_t)`, the
  poll that proved the boss gone - so it needs no `include_low` and carries no
  estimate. "Does it die inside our budget" is a question about the pessimistic
  end, not the median, so this is the better input even where a median exists.
  `ttk_upper_no_spawn` counts the death rows whose spawn was never observed,
  because "no samples" and "samples we cannot bound" are different answers and
  a bare null conflates them.
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
- **THE STRONGEST ARRIVAL-DEADLINE INSTANCE IS A MATCHED PAIR IN ONE REGION,
  AND IT PUTS THE WINDOW AT 1.86x OF ITS OWN LENGTH.** The bullet above cites
  US II franky at 2,628s, 228s past window. Measured 2026-10-20 in the 22:00
  UTC EU window, two frankys spawning the SAME SECOND:
  EU III `spawn 22:00:01` -> `despawn 22:40:02`, `last_pct` 100, elapsed 2401;
  EU IV `spawn 22:00:01` -> `death 23:14:15`, elapsed 4454. One took ZERO
  damage across its whole window while the other was killed 34 minutes past
  window close. So INSTANCE CHOICE INSIDE ONE REGION swings the outcome
  between "dies late" and "never touched", and `eta_sec` on EU IV read
  hopeless at spawn and correct an hour later.
  **THE OPERATIONAL CONSEQUENCE IS THE PART TO KEEP:
  `CONFIG.bossHop.maxFightMs` at 15 minutes would have aborted that kill
  ELEVEN TIMES OVER.** A hard abort sized for a typical fight is a hard abort
  against the late-join case this same data argues for.
  **DO NOT LET THIS BULLET BECOME EVIDENCE FOR A RISING-DPS MODEL.** The
  120,000,000 / 4,454 = ~26,900 dps, about thirteen typical players sustained,
  is a MEAN over two end-points and says nothing about whether dps rose during
  the fight - see the attribution split under "Falsifying a design" below. It
  is equally consistent with the party's dps rising and with the static
  estimate having always been too low.
  **ANSWERED 2026-10-21, AND THE ANSWER BREAKS BOTH MODELS: dps DIRECTION IS A
  PROPERTY OF THE INSTANCE, NOT OF FIGHTS.** The browser session pulled the hp
  series - 105 rows over 11 instances - and two icegolems spawning the SAME
  SECOND ran OPPOSITE curves. US II: 44 rows, elapsed 130->2635, `min_pct` 0.07,
  killed, `dps_since` 2462.1 rising to 8399.8 - a 3.4x climb. US IV: 43 rows,
  elapsed 99->3972, `min_pct` 0.01, killed, `dps_since` 3272.7 FALLING to
  1498.2, 46% of its opening rate. So the operator's "franky's dps drastically
  increased" is reproduced as data, AND so is its opposite. **A MODEL THAT
  ASSUMES EITHER DIRECTION IS WRONG ABOUT HALF THE INSTANCES**, which is a
  stronger constraint than either hypothesis this bullet was weighing.
  **AND THE SLOW ONE IS THE ONE THAT PERSISTED** - US IV died at elapsed 3972
  against a 2400s window, 1,572s over, with dps falling the whole way. Two of
  the three engaged instances in that window ran past their windows, which is
  the arrival-deadline model arriving from a third independent direction.
  **THE DENSITY IS BIMODAL AND THAT IS A CONSTRAINT ON ANY CONSUMER.** Those two
  carried 44 and 43 rows; crabxx EU I carried 10 (dps 116 falling to 11,
  `min_pct` 73.45, never killed); the other EIGHT instances carried exactly ONE
  row each at elapsed ~2400, `pct` ~100, dps 0 - the closing flush on an
  untouched boss. So a trend is computable only for CONTESTED kills, which is
  the population that matters, and degenerate everywhere else. **A CONSUMER MUST
  BRANCH ON n EXPLICITLY**: a single row is a measurement that nothing touched
  the boss, not a thin curve, and computing a slope from it would manufacture a
  direction out of the flush row the sampler adds.
- **AN EVENT-TRIGGERED INSTRUMENT IS ASYMMETRIC IN THE THING IT MEASURES, AND
  THE SILENT DIRECTION WAS THE ONE THAT SUPPORTED THE HYPOTHESIS.** The alive-hp
  sampler (`ev: "hp"`, 2026-10-20) fires on hp MOVING, so rows bunch up as dps
  rises and go sparse as it falls - and a fully stalled fight emitted none at
  all. The hypothesis it was built to test is about dps GROWING, so the
  detectable direction was the one that REJECTS and the undetectable one the one
  that SUPPORTS: a fight that starts fast, stalls at 40% and despawns is strong
  evidence that declining was right, and it read as a burst followed by nothing.
  The browser session caught it. **A THRESHOLD IS A BOUND ON VOLUME AND A BIAS
  ON EVIDENCE AT THE SAME TIME**, and the second does not announce itself the
  way the first does.
  **THE DEFENCE THAT LOOKED SUFFICIENT WAS NOT, AND WHY IS THE DURABLE PART.**
  The stall was ALREADY reconstructible - death and despawn rows both carry
  `last_hp` and `last_pct`, so the closing interval is the last hp row against
  the terminal row. But that join crosses ROW CLASSES into DIFFERENTLY-NAMED
  fields, and this file already records `hp_pct`/`pct` read off a despawn row
  returning undefined, published as a finding and retracted the same hour. So
  "the data is technically present" was an argument for building the fix rather
  than against it: `_hp_final()` writes one closing row in the sampler's own
  field names at every terminal that observed an end. An untouched window now
  emits exactly one row saying zero, where it used to emit nothing.
  **`dps_since` IS 0.0 ON A STALL, NEVER NULL.** Everywhere else in that class a
  null dps means "not computable"; there zero IS the finding, and collapsing the
  two rebuilds the silence the row exists to remove. Pinned by mutation - making
  it null fails three assertions.
  **NOT emitted on an instance-change `lost`**, the one terminal where the old
  instance's end was never observed and the new instance's hp is already the
  current reading, so a flush there would be the only row whose hp might belong
  to a different instance.
- **THE DESPAWN VETO'S FIRST LIVE WINDOW BEHAVED, 2026-10-20.** franky EU III
  `last_pct` 100 elapsed 2401, and icegolem EU PVP `last_pct` 100 elapsed 2442
  - both intact and at the window, both in the 2402-2556 cluster the band
  bullet describes (2401 is one second under, admitted by SLACK as intended),
  both at or above `BOSS_DESPAWN_INTACT_PCT` so `despawn_qualifies()` does not
  veto. Twelve-of-fourteen becomes fourteen-of-sixteen without the shape
  changing.
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
  `last_hp`, `last_pct`, `spawn_t`, `window_sec`, `elapsed_sec`, `reason`.
  Reading `hp_pct` or `pct` off one returns undefined, which looks exactly like
  "the bridge records no hp at death" - a reading published on 2026-10-19 and
  retracted the same hour.
  **THIS BULLET THEN MISDIRECTED ABOUT WHICH CLASS DIFFERS, until 2026-10-21.**
  It ended "NOT the `hp`/`max_hp` that spawn and DEATH rows carry", and a death
  row carries no `hp`/`max_hp` at all - it carries `last_hp`/`last_pct` exactly
  like a despawn row. So following the bullet written to prevent this trap, to
  read `hp` off a death row, returns undefined: the original error relocated
  into its own warning. The browser session caught it against the live log and
  it was re-derived from the write path the same hour.
  **THE SPLIT IS NOT death-vs-despawn AND NOT spawn-vs-terminal EITHER. There
  are FOUR classes, by what KIND of reading the row holds:**
  `spawn` -> `hp`, `max_hp`; `hp` (the observation row) -> `hp`, `max_hp`,
  `pct`; `death` and `despawn` -> `last_hp`, `last_pct`; `lost` -> NEITHER, no
  hp field of any kind. So a LIVE reading is `hp` and a LAST-KNOWN reading is
  `last_hp`, `lost` has nothing, and "terminal" is not the predicate - `lost`
  is terminal with no hp while an `hp` row is non-terminal with one. Enumerated
  from the `_emit` payloads rather than from a sample, so a fifth class cannot
  hide behind a window that happened to contain no examples.
- **TWO FIELDS THE SERVER PUBLISHES ON EVERY LIVE BOSS ENTRY WERE BEING
  DISCARDED, AND THE CAUSE OF ONE IS A MEASURED SHAPE CONSULTED AS A
  PROTOCOL.** Fixed 2026-10-22; row COUNT is unchanged, which matters because
  the `/boss_events` cap is row-counted.
  **`end` IS THE PER-INSTANCE WINDOW CLOSE AND IT WAS DROPPED AT THE DOOR.**
  Read from upstream `16881a27`: the live branch of the four-boss `forEach` in
  `node/server_functions.js:2554` is `{live, map, hp, max_hp, target, x, y,
  end: timers[name]}`, and `timers[name] = future_s(G.events[name].duration)`
  is stamped at spawn - so the server publishes the exact close for crabxx,
  franky, icegolem and horseman. `future_s` returns a JS `Date`
  (`js/old_common_functions.js:2128`), which serialises to the same ISO string
  `estimatedRespawn` already arrives as, so `parse_ts` reads it and no new
  parsing was needed. `server_info_entries` did not carry it; its own docstring
  listed `{live, map, hp, max_hp, target, x, y}` as "shapes measured
  2026-10-17" - accurate for its date, taken before horseman existed - and the
  code was written to that list. **A MEASURED SHAPE IS A CLAIM WITH A DATE ON
  IT, AND THIS ONE WAS RECORDED HONESTLY AND THEN READ AS THE WIRE FORMAT.**
  The tell was available all along: `graveyard_entries`, written five days
  later from source rather than from a sample, carried `end` in the same file.
  **`target` REACHED `/bosses` AND DIED THERE.** It is in `meta` and in the
  live snapshot and was on no event row, so the one field that separates a boss
  being FOUGHT from one standing untouched never reached the log - leaving the
  threshold-gated hp series, which this file already records as biased toward
  the direction that REJECTS, as the only evidence. Now on `spawn` as `target`
  and on `death`/`despawn` as `last_target`.
  **THE NAMING IS THE FIX, NOT A STYLE CHOICE.** The four-class split above is
  by what KIND of reading a row holds, and reading `hp_pct` off a despawn row
  was published as a finding and retracted the same hour, then the warning
  written to prevent it misdirected about which class differs. So a LIVE
  reading is `target` and a LAST-KNOWN one is `last_target`, exactly as `hp`
  and `last_hp` already are; a row carrying both names would reinstate the
  trap. **`lost` DELIBERATELY STILL CARRIES NOTHING** - the same argument that
  keeps `_hp_final` off an instance-change `lost` applies to a last-known
  target there, since it is unclear WHICH instance the reading belongs to.
  Adding one for symmetry is the tempting repair and it destroys the only
  property that makes the classes tellable apart, so the invariant is now
  ASSERTED rather than described, with a precondition proving a target was
  observable at the time.
  **`window_end` IS RECORDED AND NOT CONSULTED, AND THAT IS A DECISION RATHER
  THAN AN OMISSION.** Every `BOSS_DESPAWN_*` constant was MEASURED against
  `window_sec` (this file's `EVENT_WINDOW_SEC`) and an `elapsed_sec` taken off
  a DERIVED `spawn_t` - both terms ours - which is precisely why the
  despawn-clock retraction cost nothing. Feeding the server's published close
  into `despawn_qualifies()` would invalidate that calibration rather than
  sharpen it, so the band must not learn the field exists; it is in the row so
  a reader can compare the two and say where each side came from. Pinned by a
  source-text assertion over the classifier bodies, and the first form of that
  assertion was OVER-TIGHT - bare membership would have failed against a future
  reader documenting why the field is ignored, which is a pattern that cannot
  tell what it forbids from what replaced it. Comments are stripped now, and
  the stripper is fixture-tested because the live body contains no comment to
  exercise it: mutated both ways, a real read fails and a comment does not.
- **`end - window` IS AN EXACT SPAWN TIME, SO IT AUDITS THE DERIVED `spawn_t`
  RATHER THAN REPLACING `window_sec` - THE BROWSER SESSION'S CHALLENGE,
  ACCEPTED.** The calibration argument above is correct as a reason not to SWAP
  the terms and was too broad as a reason to ignore the field. `timers[name]`
  is assigned ONCE under `if (!timers[name])` and only ever deleted, so `end`
  is constant for an instance's life and `end - duration` recovers the spawn
  tick. That is a VALIDATION INSTRUMENT for the quantity `elapsed_sec` is
  measured from, and the band never has to know it exists.
  **WHY IT IS WORTH AUDITING: AN UNENGAGED BOSS CANNOT DESPAWN BEFORE ITS
  TIMER.** Removal needs `c > timers[name] && (!monster ||
  !monster.last.attacked || ssince(...) > 20)`, and for an untouched boss the
  second clause is already true, so removal waits on the timer alone. There is
  no mechanism that produces an early despawn - so `BOSS_DESPAWN_WINDOW_SLACK`,
  which admits rows up to 180s EARLY, can only ever be populated by
  spawn-detection error. The file's own record already agreed without anyone
  noticing: "the early side's only contribution to date was one row."
  **SO THE VETO BECOMES A MEASUREMENT.** crabxx EU III at `last_pct` 63.19 and
  elapsed 2226 - window minus 174, admitted by SLACK with six seconds to spare
  - forced `despawn_qualifies()` to adjudicate damaged-and-early as a
  conjunction precisely because the true elapsed was unknown. For the five
  publishing bosses it is now computable, so the conjunction stops having to
  decide under uncertainty. Misclassifying a kill as a despawn DEFLATES the
  kill record, which is why that was a veto rather than a confidence
  downgrade; this is the route to not having to choose.
  **THE SET IS NAMED, NOT DERIVED, AND goobrawl IS WHY - BUT NOT FOR THE REASON
  FIRST COMMITTED, AND THE CORRECTION IS THE BETTER FINDING.**
  `start_event("goobrawl")` sets `timers.goobrawl = future_s(45)` - a
  pre-announcement timer - against a duration of 540, so the arithmetic is
  wrong by 495 SECONDS on that path. **THE SCHEDULED PATH DOES NOT GO THROUGH
  IT**: `event_schedule_tick` does `events[occurrence.event] = true` directly,
  leaving the timer unset, so the tick's own `!timers.goobrawl` branch stamps
  `future_s(540)` and the arithmetic WOULD be right. So the real disqualifier
  is not a reassignment at all - **THE PROPERTY IS PATH-DEPENDENT AND THE
  PAYLOAD DOES NOT SAY WHICH PATH RAN.** A field whose meaning depends on
  unobservable upstream state cannot be audited against, which is a stronger
  and more durable reason than the one the first commit gave.
  **AND THE SAME READ CLEARS v115's PRESENCE RULE FOR A SCHEDULED goobrawl**,
  which matters because the browser session's next measurement rests on it: on
  the scheduled path the `!timers.goobrawl` branch publishes
  `E.goobrawl = { end }`, so the presence signal `bossEntryLive` keys on does
  arrive. Only the `start_event` path would publish nothing - and on that path
  the event also ends 45 seconds in, which looks like a game-side oddity rather
  than anything of ours. The stamp-once property is PER NAME
  and was checked per name: `server_functions.js:2561` assigned once, deleted
  at `:2574` and `:2585`; `gargoyle_end` likewise assigned exactly once in
  `halloween_events.js:174`. `SPAWN_EXACT_FROM_END` is therefore crabxx,
  franky, icegolem, horseman and gargoyle. Deriving it as "EVENT_WINDOW_SEC
  minus the goos" would be right TODAY BY LUCK - the goos are excluded because
  they are never `E` keys at all, a different reason - and would silently adopt
  the next event whose timer behaves like goobrawl's. **A SET OF NAMES IS ONLY
  AS GOOD AS THE PROPERTY BEING CHECKED PER NAME**, which is the `BOSS_TYPES`
  lesson from a second direction.
  Shipped on the rows: `spawn_t_exact` and a signed `spawn_t_err_sec` on the
  spawn row, `elapsed_exact_sec` on the despawn row, `ttk_exact_upper_sec` on
  the death row - so for these five the fight length stops being an estimate at
  either end, `death_hi` having already fixed the end. Pinned by a timeline
  where a spawn detected 150s LATE is admitted by SLACK while the exact elapsed
  is an ordinary on-time expiry, with the lateness and the admission both
  asserted as PRECONDITIONS so the comparison cannot pass on a case that never
  touched the band's early edge. The classifier's blindness is asserted over
  three function bodies.
- **`boss_hp_sampled`'s OWN COMMENT NAMES A FOLLOW-UP WHOSE CONDITION IS NOW
  MET, AND IT IS DELIBERATELY NOT TAKEN IN THE SAME COMMIT.** It scopes hp
  sampling to `EVENT_WINDOW_SEC` and says the scope is "a CHOICE, not a
  property of the data: the browser session asked for sampling scoped to bosses
  with an open skip row, and skip rows are written by the script, which the
  bridge cannot see. Widen it here when they exist." They exist bridge-side as
  of 2026-10-22. **The widening is what the attribution split actually needs** -
  joining a skip row to an hp series requires the series to exist for a boss we
  DECLINED, and a declined respawn boss has none. It is held because hp is
  already 60.5% of a row-counted log and widening the sampler raises that
  further, so it wants a volume measurement or the operator's call first - and
  because two changes landing together is how each looks proven by the other's
  work. Named here so it does not fall out of all three queues the way the
  oscillation fix did.
- **CONTRIBUTOR COUNT IS NOT OBTAINABLE FROM THE BRIDGE'S INPUTS AT ALL, so the
  dps-direction hypothesis is not waiting on a field.** The browser session's
  finding, 2026-10-22, closing out the proposal to put `target` on the hp rows:
  `B.drop_table_multiplier`'s `total_characters` counts contributors with
  `share > 0.0008`, computed server-side at award time and never published -
  `parent.S` does not carry it and neither does any payload we poll. So the
  skip row's `contributors_at_decision` has to come from the SCRIPT's own view
  and can never be reconstructed bridge-side. Worth recording so nobody goes
  hunting for the right field later; a question that is unanswerable from a
  source looks exactly like a question whose field has not been found yet.
  **`target` ON THE hp ROWS IS DEFERRED, NOT REFUSED, AND THE USE CASE IS A
  MISTAKE ALREADY MADE.** It is a single name, so it answers "is anyone on it"
  and never "how many" - no value for the dps question. But ASIA I's mrgreen
  sat at exactly 28,088,505 hp for over five hours and was called "actively
  being fought" from the percentage alone, and `target` sampled over time
  answers that in one field. So: no value for the hypothesis, real value for
  stalled-boss detection, and it lands the moment that becomes a planner input.
- **AND THE 20-SECOND GRACE IS GENERIC, NOT A GARGOYLE PROPERTY - WHICH
  EXPLAINS EVERY LATE KILL WITH NO ARRIVAL-DEADLINE THEORY AT ALL.** This file
  records "it leaves once nobody has hit it for 20 seconds" as a fact about the
  Gargoyle. Read in the same pass, the four-boss removal condition is
  `c > timers[name] && (!monster || !monster.last.attacked ||
  ssince(monster.last.attacked) > 20)`, so crabxx, franky, icegolem and
  horseman all get it: past its window a boss is removed only once twenty
  seconds pass with nobody attacking. That is the mechanism behind franky at
  2,628s, franky at 4,454s and horseman at 2,971s, and it is the same rule the
  Gargoyle was credited with alone. It CONFIRMS the browser session's
  `duration` retraction from the server side rather than resting on the despawn
  cluster. **A MECHANISM FILED AS A PROPERTY OF ONE INSTANCE IS NOT FOUND WHEN
  THE GENERAL CASE IS THE QUESTION** - the same indexing failure as the
  `death_t` midpoint sitting under "why ttk_sec runs short".
- **A NEGATIVE SIGNAL'S MEANING DEPENDS ON STATE THAT CAN CHANGE UNDER IT, AND
  ONE HERE INVERTED WITHIN HOURS OF BEING WRITTEN.** Before the bridge was
  restarted, "no `ev: hp` rows in this window" was sound evidence that the
  restart was still pending, and it was used that way correctly. The operator
  restarted the bridge at ~02:30Z on 2026-10-21 and the same observation
  immediately stopped meaning anything: the sampler is scoped to
  `EVENT_WINDOW_SEC`, the last event-type boss alive was crabxx US V which
  despawned at 02:00:10Z - half an hour BEFORE the restart - and only mrpumpkin,
  a respawn boss, has been alive since. So zero rows is exactly what the design
  predicts and is NOT a deploy failure. **A check whose conclusion flips when a
  deploy lands has to be retired at the deploy, not left standing**, because the
  reader who runs it next has no way to see which side of the change they are
  on. Read as failure, this would have been the CaveRun `ver: 14` mistake again
  with different nouns, hours apart. First real verification is an event-type
  boss being alive at all - the 04:00 UTC nightly window.
- **THE hp SAMPLER AND ITS CLOSING FLUSH ARE VERIFIED IN PRODUCTION, 04:00 UTC
  2026-10-21.** Over a 900-row window spanning 2026-10-20T12:48:22Z to
  2026-10-21T13:25:51Z: death 389, spawn 396, despawn 12, **hp 103 of which 9
  carry `final: true`**, lost 0. First hp row at 04:01:41Z, the 04:00 window on
  cue. Threshold rows carry real dps - icegolem US IV `pct` 97.98, `since_sec`
  99, `hp_lost` 323,011, `dps_since` 3272.7, and two more at 2462.1 and 4748.2.
  And the case the flush was built for fires exactly as designed: at 04:40:02
  and 04:40:03, three untouched bosses closed with `dps_since` 0.9, 0 and 0 over
  `since_sec` 2400/2401/2400. **An untouched boss now emits one row saying zero
  where it used to emit nothing, and `dps_since` 0.0 rather than null is doing
  its job on live data.**
- **THE `lost` ROW QUESTION IS OPEN AND WAS CORRECTLY LEFT OPEN.** That same
  900-row window held ZERO `lost` rows, so nobody has had a real one to
  `Object.keys`, and whether the `reason` string separates
  instance-changed from shard-unlistable is unverified. Reported rather than
  inferred from the two emit sites, which is the rule this file already carries
  about nulls from fields nobody confirmed. The skip-row shape will carry a
  THIRD unresolvable cause - a skip resolved against a `lost` terminal, which
  carries no hp and whose `t` is a detection time - marked unverified until a
  `lost` row exists to look at. A 1,500-row window on 2026-10-21 held zero
  `lost` rows either, so this is still unverified and is the only field in the
  shape below that is.
- **THE BRIDGE ALREADY HAS A WRITE PATH, AND THE POLLER/HANDLER BOUNDARY THE
  SKIP-ROW DESIGN WAS WORRIED ABOUT DOES NOT EXIST.** Measured 2026-10-21 in
  `Codex/market_bridge.py`: `do_POST` exists with an allowlist of `/scan`,
  `/msg` and `/trade` - anything else 404s - the body must be a JSON dict,
  `do_OPTIONS` answers CORS, and `/trade` appends to an append-only JSONL
  ledger that loads on startup and is defaulted ON. So the transport is one
  `elif` plus a store method, and the DURABILITY argument for skip rows is
  already made and already won by precedent in the same file.
  **THE FORK WAS: skip rows to their own ledger-style store (A) or into the boss
  log beside the terminal and hp rows (B).** The browser session leaned B and
  flagged that their spec assumes the join is cheap, which under A it is not -
  every verdict becomes a cross-store join on `spawn_t` across two files with
  two retention policies, and a retention mismatch can silently drop one side.
  **B, AND THE COST ASSIGNED TO IT IS ZERO, because the handler already holds
  the poller and already takes its lock.** `Handler.bosses` is set at startup;
  the handler reads `self.bosses.events_path` at three sites and already does
  `with self.bosses.lock:`. `_emit` only appends to `self._pending` and
  `_flush_events` owns the file, so one public queue method on `BossWatch`
  taking that same lock puts skip rows in the boss log with no new writer and no
  boundary crossed. The fork was premised on a separation that the `/boss_events`
  GET had already dissolved - **read the coupling that exists before designing
  around the one you expect.**
- **THE RECEIVING HALF IS BUILT, 2026-10-22: `/skip` POSTs into
  `BossWatch.queue_skip()`, the only public writer.** Fork B as recorded below,
  and it did cost nothing - one method taking the lock the handler already
  takes, `_emit` into `_pending`, `_flush_events` outside it, no new writer.
  The SCRIPT half still needs a deploy; the bridge half is testable now and is.
  **THE MONSTER FIELD IS STORED AS `type`, NOT THE SPEC'S `mtype`, AND THE
  DEVIATION WAS FOUND BY MUTATION RATHER THAN BY READING.** Every other row in
  the log calls it `type` and `boss_history` groups on `d.get("type")`, so a
  stored `mtype` makes a skip row silently unjoinable to the log's own
  grouping - the `hp_pct`-off-a-despawn-row trap exactly, one concept under two
  key names across row classes. Both spellings are ACCEPTED on the wire so an
  older script is never refused, and exactly one is stored.
  **AND THE ASSERTION THAT WAS SUPPOSED TO COVER THIS PROVED NOTHING, WHICH IS
  HOW THE DEVIATION SURFACED.** A mutation admitting `"skip"` to
  `boss_history`'s `elif ev == "death"` moved NO assertion - because the row
  carried `mtype` and never reached the grouping at all. The comment beside it
  claimed the protection was "a property of WHERE the branches sit"; the real
  protection is the TRANSITION ALLOWLIST (`if not boss_ev_is_transition(...):
  continue`), whose own comment already said it is an allowlist so a sixth `ev`
  cannot join the aggregation. **THIRD TIME IN ONE SESSION THAT A COMMENT OF
  MINE NAMED THE WRONG MECHANISM FOR A RIGHT CONCLUSION**, after `window_end`'s
  over-tight assertion and the `goobrawl` timer. Both comments are corrected and
  the suite now asserts the OUTCOME across the two layers rather than claiming
  either, with the mutation that catches each one named.
  **OUR CLOCK ORDERS THE LOG, SO `t` IS THE BRIDGE'S AND `t_script` SITS BESIDE
  IT.** Every other row's `t` comes from `now()` in that process; a skip row's
  would come from a BROWSER, so trusting it puts a second clock with unbounded
  invisible skew into the ordering key - strictly worse than the
  estimate-versus-observation hazard this file already carries, because that
  one at least shares a clock. Keeping both makes a disagreement measurable.
  **UNKNOWN FIELDS SURVIVE UNDER `extra` RATHER THAN BEING DROPPED.** Both
  failure modes are silent and only one is recoverable: a newer script's field
  dropped by an older bridge looks exactly like a field that was never sent,
  while a typo parked in `extra` is visibly un-validated. `mtype` is a known
  INPUT name even though it is never a stored one, or the spec's own spelling
  would land there.
  **THE DEDUP SPLIT IS NOT THE SPEC'S "materially", AND THE SPLIT IS THE
  POINT.** The SCRIPT owns when a decline is worth re-stating, because only it
  can see whether an input moved materially. The BRIDGE owns IDEMPOTENCE: an
  identical re-post - same instance, same `declined_on`, same `reason` - is
  dropped, which covers a retry loop or a double POST without second-guessing a
  judgement it cannot make. A NULL `spawn_t` IS NEVER DEDUPED, because it cannot
  discriminate instances and collapsing on it would merge two different bosses
  on one shard.
  **A SKIP CARRIES A THIRD READING-NAME FAMILY AND THE SUFFIX IS WHAT KEEPS IT
  APART.** The log has LIVE readings (`hp`, `target`) and LAST-KNOWN ones
  (`last_hp`, `last_target`); a skip's are DECISION-TIME - the boss was alive
  and we were not there - hence `hp_at_decision`/`hp_pct_at_decision`, asserted
  to carry neither of the other families' names so no consumer can read a skip
  row through an existing convention and get a plausible wrong answer.
- **AND A SKIP ROW NEEDS TWO SUBJECT FIELDS, BECAUSE FOR FOUR OF THE SIX BOSSES
  THEY LOOK LIKE ONE.** The browser session's finding, extending their own
  spec, which named only the monster field: crabxx, franky, icegolem and
  horseman publish under their own monster name, so `type` carries both
  meanings there and nothing in a row hints that they are separable - while
  goobrawl spawns `rgoo`/`bgoo` and graveyard spawns
  `gargoyle`/`zombie`/`ghoul`, so a decision about THE EVENT has no single
  monster type while the hp series it must join is keyed on the VARIANT. One
  field forces a choice between a `type` that joins nothing and an event
  identity that is lost. `event` ships beside `type` in the bridge.
  **EMITTED UNCONDITIONALLY, NOT NULL-WHEN-COINCIDING, which is the one place
  the implementation departs from the proposal.** A field present only when it
  differs from another is indistinguishable from a field the consumer forgot to
  read - the rule already asserted here for `window_end` and `last_target` two
  commits earlier. The half an `in` test cannot reach is the eventless boss:
  every entry of `BOSS_RESPAWN_SEC` carries an EXPLICIT null, or "this boss has
  no event" and "a bridge too old to send this field" are one observation.
  **AND IT IS DERIVED WHERE IT CAN BE, so the receiver validates AND
  completes.** `SCHEDULE_EVENT_OF` already mapped monster to event, so a script
  sending only `type: "rgoo"` gets `event: "goobrawl"` for free rather than a
  null, and only an event the bridge has never heard of has to be sent
  explicitly - which is trusted over the derivation, because that vocabulary
  grows game-side and the bridge must not be the half that deploys first.
  **`type` IS NULLED FOR THE TWO EVENT-ONLY NAMES, which is the honest value
  rather than a gap**: `type: "goobrawl"` looks joinable to every other row
  class and matches nothing, which is the `hp_pct`-off-a-despawn-row trap in
  the exact field this suite was written to protect.
  **"EVENT-ONLY" IS DERIVED FROM `SCHEDULE_SPAWNS` AND NOT LISTED** - an event
  is event-only when it spawns monsters and is not one of them - so adding a
  self-spawning row to that map cannot silently start nulling a real monster
  type. A bare `name in SCHEDULE_SPAWNS` would, and that is the inverted
  assertion.
  **THE DEDUP KEY MOVED TO `(event or type, server, spawn_t)`, because the
  decision identity is event-plus-shard-plus-window and not the variant.**
  Declining `rgoo` and then `bgoo` inside one goobrawl window is ONE decision
  restated; keying on `type` records it twice, which is how a decline count
  silently becomes a variant count. The `or type` is what covers an eventless
  boss - without it every `BOSS_RESPAWN_SEC` entry shares a null key and
  collapses into its neighbours on one shard, and that is its own assertion
  with the no-event precondition stated.
  Eight mutations, eight named failures. **The uncovered line is the console
  `say()` string**, which renders a null `type` as the word "None" - cosmetic,
  fixed, and flagged as untested rather than claimed.
- **THE SPEC, AS WRITTEN 2026-10-21 BY THE BROWSER SESSION. THE IMPLEMENTER IS
  THIS SESSION** - recorded by name because a fix
  nobody is named for is a fix nobody makes, and this one sat outside both
  sessions' stated queues.
  Written by the SCRIPT at decision time, never derived at read time, because
  the bridge cannot see our state and both of the operator's exclusions depend
  on it. `ev: "skip"` carrying `t`, `mtype`, `server`, `spawn_t` (the join key
  onto the hp series), `declined_on` (`dps` | `window` | `cost`), `reason`,
  `excluded` (`outranked` | `shard_not_candidate` | null), `committed_to`,
  `rank`, `eta_sec_at_decision`, `contributors_at_decision`,
  `dps_assumed_at_decision`, `hp_at_decision`, `hp_pct_at_decision`,
  `required_dwell_sec` at THAT contributor count, and `remaining_window_sec`.
  **ONLY `declined_on == "dps"` BEARS ON H0.** `window` and `cost` are the
  arrival-deadline question - live, different, and merging them is how a miss
  count silently becomes a FOMO counter.
  **`excluded` IS RECORDED, NOT FILTERED**, because neither value is
  reconstructable later: `outranked` needs what we took INSTEAD at that moment,
  and `shard_not_candidate` is a judgement about reachability under the fatigue
  and queue state then in force. A read-time filter can only approximate both.
  **THE ATTRIBUTION SPLIT IS NOW FALSIFIABLE, which is why the sampler had to
  come first.** Join the skip row to the hp series on `(type, server, spawn_t)`,
  take `early_dps` over the first third of elapsed and `late_dps` over the last:
  `late/early >= R` with `early` near `dps_assumed_at_decision` means DPS ROSE
  and rejects H0; `early >> dps_assumed_at_decision` means our ESTIMATE was low,
  H0 stands and `typicalPlayerDps` wants raising; `declined_on == "window"` says
  nothing about H0 either way. R is pinned by a fixture rather than argued.
  Verdicts use `latest_viable_join_t = death_t - required_dwell_sec`:
  `skip_correct` (despawned, or died outside any viable join window),
  `skip_wrong_then` (we should have gone at decision time) and
  `skip_wrong_timing` (we should have queued a LATE arrival). Only the middle is
  a defect in the decision rule; the third is the arrive-for-the-end branch
  measured rather than assumed, and the bimodal data above predicts it
  dominates.
  Mechanics: dedup one row per `(mtype, server, spawn_t)`, re-emitted only when
  `declined_on` or `reason` changes or an input moves materially, because a
  40-minute decline would otherwise emit hundreds. Name the headline
  `declined_then_killed` - what it counts, not why, per the `never_observable`
  lesson. And GRADE rather than binarise: carry predicted `eta` against the
  actual bound (`death_hi - spawn_t`), because that residual is the fit
  measurement for `typicalPlayerDps`, `fallbackDps` and `dexonDps`.
- **THE DAMAGE FORMULA IS READABLE FROM SOURCE, WHICH UNBLOCKS dexonDps - the
  browser session lacked a server clone and this session has one.** Read from
  upstream 2026-10-21. SOURCE-DERIVED, so a lead about the live game, not a
  fact about it.
  The normal-attack chain is two statements at `node/server.js:4111-4115`:
  `ceil(combo_m * attack * (0.9 + (attack && Math.random()*0.2 || 0)))`, then
  `ceil(attack * dmg_mult * damage_multiplier(defense - attacker[pierce] -
  info[pierce]))`. So the spread is uniform 0.9-1.1 with MEAN 1.0 and does not
  bias an expectation; PIERCE IS SUBTRACTED FROM TWO SOURCES, the attacker's
  own and the skill's; and `dmg_mult` is 1 unless the target carries `for`.
  Crit is applied before that, at `:4068`: `cmult = 2 + critdamage/100`, rolled
  against `crit` as a PERCENT, so the expected factor is
  `1 + (crit/100)*(1 + critdamage/100)`.
  **`damage_multiplier(defense)` IS DECLARED TWICE AND THE DUPLICATION IS
  EXONERATED** - the double-declaration rule fired and the check cleared it.
  `js/old_common_functions.js:851` and `js/progression/stats.js:202` carry
  byte-equivalent coefficients and the same `[10/12/17]` marker, one merely
  reformatted, so load order cannot change the answer. It is a piecewise
  taper: 0.00100 per point over the first two hundreds, then 0.00095, 0.00090,
  0.00082, 0.00070, 0.00060, 0.00050 and 0.00040 beyond 800, clamped to
  [0.05, 1.32], with a separate NEGATIVE ladder (0.00100 / 0.00075 / 0.00050 /
  0.00025) that is what makes armor piercing past zero keep paying.
  **FULLY CHARACTERISED 2026-10-22, AND THE TWO SIDES ARE NOT MIRRORS: THE
  POSITIVE SEGMENTS ARE 100 POINTS WIDE AND THE NEGATIVE ONES 50.** The browser
  session scanned the LIVE function 0..3000 at step 1 and differenced for slope
  changes; this session read the source body. They agree on every breakpoint,
  and the negative side - which they measured only at three spot values and
  flagged as unscanned - falls out of the source exactly, so it needed no scan:
  `max(0,min(50,0-d))*0.00100 + max(0,min(50,-50-d))*0.00075 +
  max(0,min(50,-100-d))*0.00050 + max(0,-150-d)*0.00025`. Reproduced: -38 ->
  1.03800, -100 -> 1.08750, -200 -> 1.12500, their three readings to five
  figures. **SO IT DOES NOT SATURATE AT -200** - past -150 it keeps paying
  0.00025/point with no further segment, and the 1.32 CEILING binds at
  **defense -980**.
  **BOTH CLAMP BOUNDS NOW HAVE LOCATIONS, WHICH IS WHAT MAKES THEM CHECKABLE
  RATHER THAN DECORATIVE.** The 0.05 FLOOR binds at **defense 1558** - the
  positive sum reaches 0.647 at 800 and needs 757.5 more points at 0.00040 to
  reach 0.950 - which is the browser session's measured floor point exactly,
  derived and observed independently. Floor 0.05 is a 95% reduction cap and
  never immunity, and no monster in the defence table is remotely near 1558
  (icegolem's 800 is the highest), so the floor is unreachable in practice and
  the taper is the whole story for every boss we fight.
  **A HAND COMPUTATION THAT CLAMPS AT 1.0 IS WRONG WHERE PIERCING EXCEEDS
  RESISTANCE, AND THAT IS THE LIVE CASE RATHER THAN A CORNER.** MageofOz's
  rpiercing 238 against bgoo's resistance 200 is -38, so x1.03800 - a 3.8%
  BONUS on every magical hit, and clamping to 1.0 is the natural thing to
  write. The gargoyle figure already in this file rests on the same mechanism.
  **AND THERE IS A THIRD NAME IN THIS FAMILY: `dps_multiplier`, SAME LADDER,
  NO CLAMP.** `js/old_common_functions.js` declares it immediately after
  `damage_multiplier` with a byte-identical coefficient ladder and no
  `min(1.32, max(0.05, ...))` around it, so it returns 0.00020 at 1682 and goes
  NEGATIVE above 1683. The double-declaration rule fires on the pair and
  CLEARS it for a different reason than last time: these are two DIFFERENT
  FUNCTIONS rather than two copies of one, so load order is irrelevant and
  what matters is which name a reader lands on. Its single call site is
  `node/server_functions.js`, inside an item-scoring expression that passes
  `def.attack + apiercing/2 + rpiercing/2` - an ITEM's offence, not a target's
  defence - so the missing clamp is deliberate there and the hazard is LATENT:
  nothing in the game feeds it a defence value, and nothing of ours calls it.
  Recorded because a grep for the coefficient ladder finds THREE bodies and
  only two of them are the combat formula.
  **A `/2.0` ON THE DEFENCE TERM EXISTS AND IS THE HEAL PATH, NOT AN ATTACK** -
  `:4044`, inside `if (info.heal)`. Reading it as the attack formula would
  have halved every effective armor figure below.
  **AND MY FIRST GREP FOR THE SPREAD FOUND ONLY THE HEAL SITE**, because the
  attack path writes the same idea as
  `0.9 + ((attack && Math.random() * 0.2) || 0)` and the pattern did not match.
  One more instance of a search telling you about your search.
  **THE dps FIGURES THIS BULLET CARRIED ARE RETRACTED - THE OFFENCE READING
  THEY RESTED ON WAS BUFFED.** They read crabxx 2,569, dragold 2,825, horseman
  2,633, gargoyle 1,532, icegolem 1,333 off attack 1792 / frequency 1.394.
  The browser session re-read the same characters a day later: Dexon 1792 ->
  1162 and MageofOz 2358 -> 1529, **ratio 0.6485 on BOTH to four figures**. One
  shared multiplicative term, present in one reading and absent in the other -
  so every figure above is one multiplication away from right and none is right.
  The DEFENCE half of the calculation is unaffected and is below; it is design
  data and gear, and does not move.
- **THE VOLATILE TERM IS `output`, NOT `attack`, WHICH IS WHY AN ENUMERATION OF
  CONDITIONS CARRYING AN `attack` FIELD FOUND NOTHING.** `node/server.js:1679`
  is `player.attack = (player.attack * player.output) / 100.0`, so a condition
  moves damage by moving `output` and never touches `attack` at all. From
  `design/conditions.js`: `darkblessing` **+25**, `mfrenzy` +40, `purifier`
  +20, `anniversary_kiss` +6, `halloween1` +2, `halloween2` +3, and on the
  other side `hopsickness` **-20** and `cursed` -20, plus `hexed` **-20**,
  counted 2026-10-21 - NINE conditions in all.
  **THE TERMS SUM AS PERCENTAGES AND THE WHOLE THING IS NOW CONFIRMED TO SIX
  FIGURES: `character.attack = base * (1 + SUM(output)/100)`.** Measured by the
  browser session on two characters: Dexon hopsick 1162 against clean 1442 is
  0.80583, predicted `(1 - 0.20 + 0.03) / 1.03` = 0.80583 EXACT; buffed 1792
  against clean 1442 is 1.242718, predicted `1.28 / 1.03` = 1.242718 EXACT;
  MageofOz reproduces both within integer rounding.
  **AND THE ~1% RESIDUAL THIS BULLET LEFT OPEN IS CLOSED - IT WAS `halloween2`
  +3, PRESENT IN BOTH READINGS.** The prediction recorded here was 80/125 =
  0.6400 against a measured 0.6485, with the seasonal entries named as
  candidates and deliberately not fitted. Carrying halloween2 through both
  terms gives 83/128 = **0.6484375**, which is the measurement to four figures.
  So the candidate list was right, the arithmetic was one term short, and
  leaving it open rather than fitting it is what let the closure be a
  confirmation instead of a coincidence.
  **`rspeed` IS A FLAT +0.08 ON FREQUENCY, NOT A PERCENTAGE** - the mage read
  1.03528 without it and 1.11528 with, Dexon 1.3936 and 1.4736. So frequency
  does not take the `output` treatment and must not be normalised the same way.
- **AN EXHAUSTIVE SEARCH OVER THE WRONG COLUMN IS NOT A NEGATIVE RESULT, AND
  THAT IS A DISTINCT SHAPE FROM THE FOUR OTHER SEARCH FAILURES THIS WEEK.** The
  browser session's own naming of it: they enumerated the conditions carrying an
  `attack` field, found them genuinely empty, and reported that ABSENCE as a
  property of the data - "attack cannot be decomposed the way speed was, only a
  parked clean reading will do". The enumeration was complete and correct; the
  FIELD LIST was wrong, because the volatile term is `output`. Compare the other
  four - an integer-only `"s":\d+` scan, an apostrophe-pairing name parser, a
  comment-counting extractor, and a partial grep for the damage spread - every
  one of those UNDER-MATCHED a field it was aimed at, which eventually shows up
  as an inconsistency. This one matched its target exhaustively and was aimed at
  the wrong target, so nothing about the result looks incomplete. **A complete
  search over the wrong column returns a confident, internally consistent
  nothing**, and the only tell is asking what else could carry the effect.
  **SO NO PARKED CLEAN READING IS NEEDED - THE CORRECTION IS DIVISION BY A
  FIELD THE CLIENT ALREADY HAS.** `output` sits in the same server-sent
  property list as `attack`, `frequency`, `apiercing`, `rpiercing`, `crit` and
  `critdamage` (`server.js:1414-1440`), every one of which is already read off
  `character`. So the stable stat is `attack * 100 / output`, and for LIVE dps
  the attack value as-read is already correct because `output` genuinely
  changes damage dealt. Record the normalised one; compute with the live one.
  **AND THE OTHER THREE MULTIPLIERS ARE READABLE STATES TOO**, so the
  normalisation is complete rather than partial: `invis` x1.25 (`:1725`),
  `invincible` x0.45 (`:1728`), and a `fear` ladder x0.2 / x0.4 / x0.6 for
  `fear` > 2 / > 1 / >= 1 (`:1766-1776`). `priest` carries a flat x1.6
  (`:1617`) which is CLASS and not volatile. Divide out whichever are set and
  the result is a stat rather than a snapshot.
- **THE DEFENCE TABLE, FROM THE ASSEMBLED `G.monsters` - and it CONFIRMS the
  literal read, so ABSENCE IS GENUINELY ABSENT and not a load-time artefact.**
  Measured by the browser session 2026-10-21: crabxx armor 320 / no resistance;
  franky NEITHER; icegolem 800/800; dragold 240/320; mrgreen no armor /
  resistance 900; mrpumpkin NEITHER; rgoo 300/300; bgoo 200/200; horseman
  300/300; gargoyle armor 700 / resistance 200; grinch no armor /
  resistance 150; phoenix no armor / resistance 160; snowman NEITHER.
  This is the half worth keeping, because the caution recorded here - that
  `new_monster` scaling might supply a missing armor - turned out not to apply.
  **TWO CLASS ASYMMETRIES FALL OUT, AND NEITHER DEPENDS ON THE VOLATILE TERM**,
  which is what makes them usable now rather than after a re-measurement.
  mrgreen IS A PHYSICAL BOSS: resistance 900 and no armor, so the mage's
  multiplier is 0.4258 where the ranger's is ~1.12, nearly 3x in favour of
  physical. THE GARGOYLE IS THE EXACT REVERSE AND MORE SHARPLY THAN ARMOR
  ALONE IMPLIES: MageofOz's rpiercing 238 against resistance 200 is NEGATIVE
  38, which lands on the negative ladder at 1.038 - above 1.0 - against Dexon's
  0.4784, so the mage's multiplier is 2.17x the ranger's. The piercing makes
  it stronger than a 700-versus-200 comparison suggests, and the operator was
  told the weaker version.
  **ONE CROSS-CHECK AGAINST THEIR LIVE SERIES, OFFERED AS A HYPOTHESIS AND NOT
  A FINDING.** icegolem US IV opened at `dps_since` 3272.7 and fell to 1498.2,
  and 1,333 is this table's figure for Dexon ALONE on that armor. So the
  falling curve is at least consistent with other contributors LEAVING rather
  than with any mechanic - which would make dps DIRECTION a function of
  contributor count and reframe the bimodal result entirely.
  **IT IS NOT ESTABLISHED, AND WHAT IS MISSING IS NAMED: the party is THREE
  characters**, so a floor of ~1,500 is below what Dexon plus priest plus mage
  should manage, and the priest's and mage's per-boss terms are unmeasured. The
  test is the skip row's `contributors_at_decision` against the hp series, not
  this arithmetic.
  **THE HYPOTHESIS SURVIVES THE RETRACTION ABOVE, AND THAT IS WORTH STATING
  BECAUSE IT LOOKS AS THOUGH IT SHOULD NOT.** The browser session's point: both
  the observed 1498.2 and the computed 1,333 move together under the 0.6485
  correction, so the COINCIDENCE between them is preserved even though neither
  value is right. A retraction that scales both sides of a comparison equally
  leaves the comparison standing.
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
  behind upstream, with `node/server.js` differing.
  **THE "330 COMMITS BEHIND" AND ITS CROSS-CHECK WERE BOTH SHALLOW ARTEFACTS,
  corrected 2026-10-21.** In a FULL clone the true distance from `9005216` was
  73, not 330: `rev-list --count fork/main` 513 plus 73 equals `rev-list --count
  origin/main` 586, exactly. The 330 came from a clone whose `.git/shallow` was
  bounded at the fork's own HEAD, so every fetched upstream commit read as
  unreachable-from-fork and the "distance" was just the size of the fetched
  pack. **The cross-check recorded below as proof (331 = 330 + 1) confirmed the
  artefact, because both numbers were computed from the same truncated graph** -
  which is the real lesson: a cross-check drawn from the same degenerate source
  is not independent evidence. `node/server.js` measured +916/-549 at the same
  time, against the +599/-218 recorded here, so that figure moved
  too. Two sessions said "the clone at /tmp/almongo" to each other
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
- **TWO CHROME INSTANCES CAN BE CONNECTED AT ONCE AND `browser_code_eval`
  SUCCEEDS AGAINST THE WRONG ONE, WHICH MAKES EVERY DEPLOY VERIFICATION
  SUSPECT.** The browser session's finding, 2026-10-22, after a restart left
  the pre-restart browser still showing as connected and their session
  auto-selected it. The call reaches the character through the /hub relay,
  which is BROWSER-AGNOSTIC, so the snippet runs and writes to
  `parent.localStorage` in the REAL browser while the read comes back null from
  the other one. **The failure returns `queued: true` and then "absent", which
  is INDISTINGUISHABLE FROM A BUILD NOT BEING DEPLOYED OR A FUNCTION NOT
  EXISTING** - the one answer a deploy check must never give, arriving by a
  second mechanism after `parent.*` markers outliving their script.
  **THE GUARD IS TWO CALLS AND RUNS FIRST after any restart, reconnect or
  tab-group loss**: write a marker via `browser_code_eval`, read it back from
  the tab. Theirs came back ABSENT on the wrong browser and PRESENT at 6s after
  switching. Same class as the `None`-tolerating accessor rule - distinguish
  "absent" from "could not see" mechanically rather than by remembering.
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
- **AND CODE STORAGE IS NOT CHARACTER-SCOPED, SO IT IS SHARED STATE BETWEEN
  EVERY CHARACTER IN THE BROWSER. NOTHING AT A CALL SITE SAYS SO AND THE
  BULLET ABOVE ASSUMES OTHERWISE.** Read from the client at upstream
  `16881a27`: `set(name, value)` is
  `window.localStorage.setItem("cstore_" + name, JSON.stringify(value))` and
  `get` the mirror of it. The key carries no character anywhere, every
  character tab is the same `adventure.land` origin, so `cstore_<key>` is ONE
  SLOT for Dexon, FatherToken, MageofOz and Meltymerch together. `pset`/`pget`
  are a different pair (string values, through `parent.storage_*`) and are not
  what the party scripts use. **So the 210 above is a leftover from whichever
  character wrote last, not necessarily from `Party/Merchant.js`** - the
  conclusion that bullet draws is strengthened and its attribution is a guess.
- **THAT THE CONTEXTS REALLY DO SHARE ONE `localStorage` IS MEASURED BY THE
  GAME ITSELF, NOT INFERRED FROM THE SOURCE.** `local_cm_logic` walks
  `Object.keys(localStorage)` for `cm_<my name>_*` entries that ANOTHER
  character's `send_local_cm` wrote, and that is how `send_cm`'s LOCAL copy
  arrives at all - which this party depends on every time `plFirstTime` drops
  the relay duplicate of a message that also came in-game. A cross-character
  transport built on the sharing is a stronger warrant than reading the
  accessor, and it was already running here.
- **IT COST A SHARED BOSS TRIP, AND THE SYMPTOM WAS A FIELD THAT CANNOT CHANGE
  OBSERVED CHANGING.** `const BOSS_KEY = 'boss_trip'` was byte-identical in
  all three party scripts, so the trip, the shard-keyed cooldowns and the
  give-up counts were one blob - each `bossSave()` clobbering the other two,
  each load reading the last writer. Measured 2026-10-22: Dexon's mrgreen trip
  read `src='own'` at 22:58:18 and `src='leader'` at 23:01:20 across a
  redeploy, same `startedAt`. `src: 'leader'` sits behind `!bossIsLeader()` and
  there is exactly one write to `trip.src` in the file, so the leader cannot
  mint one - he had loaded a FOLLOWER's save. **A FIELD WITH ONE WRITER,
  SEEN TO CHANGE, IS A STATEMENT ABOUT THE CONTAINER RATHER THAN ABOUT THE
  FIELD**, and reading it as mutation sends you hunting a writer that does not
  exist. Fixed in Ranger v119 / Priest v67 / Mage v90 by keying on
  `character.name`; deliberately NOT migrated from the legacy key, since
  reading it once is the foreign-trip import being removed.
- **AND THE FIX FOR IT HAD A SECOND WAY TO HAVE THE SAME BUG, WHICH v119
  SHIPPED.** `const BOSS_KEY = 'boss_trip_' + character.name` is evaluated at
  MODULE SCOPE, and `runner_functions.js` builds `character` as a PROXY filled
  by `proxy_all()`, whose own comment reads "Not all properties are sadly
  available right away" - so the const can capture an empty name and mint one
  shared `boss_trip_undefined` for all three characters. v119 also introduced
  the first bare `character.name` at top level in a file that guards it at
  `:127` and `:195`, and that existing style was the tell nobody read.
  Fixed in Ranger v120 / Priest v68 / Mage v91: `scopeKey(base)` resolves at
  EVERY use and returns null on an unreadable name, so a lost read is the worst
  case and a write to the shared key is impossible. **A FIX THAT BAKES THE
  CORRECTION INTO A CONSTANT INHERITS WHATEVER THAT CONSTANT WAS BUILT FROM**,
  which here is a field the game fills asynchronously.
- **THE SCOPING CONVENTION ALREADY EXISTED IN FOUR SUBSYSTEMS, SO THIS WAS
  NEVER AN UNKNOWN PROPERTY - IT WAS ONE APPLIED UNEVENLY.** The browser
  session censused the live namespace 2026-10-22: 55 `cstore_*` keys, and
  `<name>_newparty_info`, `luckyslot_<name>`, `pl_delivered_<name>_<pot>` and
  `pl_mlucked_<name>` were already per-character. `merch_trip` is its own key,
  so Meltymerch was never in the boss-trip collision - it was the three party
  scripts alone. Same shape as `rageEntryBroadcast` having the heartbeat
  `bossBroadcast` lacked: one subsystem complete, its neighbour half-built,
  nothing connecting them. **THE OPERATOR HAD ALSO SAID IT IN PLAIN WORDS** -
  "we already know it is shared as it is used for cross shard messaging" - and
  the browser session acknowledged it, wrote it up, then watched `trip.src`
  change and reached for mutation instead. A current, correct fact, from the
  person who knew, acknowledged in the same session, and not applied to the
  first symptom of it that appeared.
- **TWO READERS NOW, AND THE DIFFERENCE IS PROVENANCE RATHER THAN CAUTION.**
  `scopedGet` is scoped only; `scopedGetLegacy` falls back to the bare key
  once. The fall-back is correct exactly where the legacy value cannot be
  another character's - a key no other script ever wrote (`achv_queue`,
  `taxi_probe`, `crabxx_contrib`, `farm_spot_blacklist`, `fear_log`,
  `mh_state`), or one whose entries cannot be mistaken for a sibling's
  (`pl_acted`, because `plSend` mints `_plid` per call so no two characters
  ever see one id). It is wrong for `boss_trip` and `pl_hop_pending`, where
  reading the legacy value once IS the import being removed.
  **AND THE MIGRATION IS LOAD-BEARING FOR A LIVE OPERATOR FEATURE:**
  `achv_queue` is what they were told to use for a farm override that survives
  hops, so scoping it without the fall-back would have wiped what they had just
  set up. Scoping a key is not free the moment somebody is standing on it.
- **`pl_hop_pending` WAS ON NOBODY'S LIST AND THE ASSERTION FOUND IT ON ITS
  FIRST RUN.** `Tests/suite_bosshop.js` now DERIVES every `const *_KEY` /
  `*_STORE` declaration from the source of each party script and requires each
  to appear in exactly one of two lists - scoped, or deliberately shared - so a
  new key has to be classified rather than defaulting into the shared
  namespace. It immediately failed naming a pending-hop record shared by Priest
  and Mage: one follower could resolve a hop the other ordered, which is the
  `boss_trip` defect with different nouns. **A HAND-WRITTEN LIST WOULD HAVE
  SHIPPED WITHOUT IT**, and that is the `BOSS_TERMINAL_EV` enumeration lesson
  landing somewhere new - derive the set, then make membership a decision.
- **THE TWO THAT STAY SHARED ARE ASSERTED AS SHARED**, so that scoping either
  has to confront the argument rather than look like an oversight: `pl_cursor`
  because `plPoll` ends every poll at `Math.max(plCursor, r.cursor)` and
  `r.cursor` is the bridge's GLOBAL head (`self.seq`, one counter for all
  recipients), so all four converge there each tick and adopting a sibling's
  value is adopting your own; `loot_chest_ids` because sharing it is harmless.
- **`__probe_rt` IS LITTER IN THAT NAMESPACE, OWNER UNKNOWN.** Four bytes,
  sitting in `cstore_` where all four characters read. Recorded rather than
  cleared, because this session has no tab - and because a forgotten
  diagnostic key in a shared namespace is exactly the thing the census was
  worth running to find.
- **THE OTHER SHARED KEYS WERE LEFT AND THE REASONS DIFFER, WHICH IS THE PART
  WORTH KEEPING.** `pl_cursor` is shared with the merchant too and is a no-op:
  `plPoll` ends every poll at `Math.max(plCursor, r.cursor)` where `r.cursor`
  is the bridge's GLOBAL head (`self.seq`, one counter for all recipients), so
  all four converge there each tick and adopting a sibling's value is adopting
  your own. `pl_acted` cannot cross-suppress, because `plSend` mints `_plid`
  per call and `bossBroadcast` calls it once per member, so no two followers
  ever see one id - the only cost is its cap of 20 split three ways.
  `loot_chest_ids` is harmless to share. The Ranger-only keys - `taxi_probe`,
  `crabxx_contrib`, `farm_spot_blacklist`, `fear_log`, `achv_queue`,
  `mh_state` - are unshared ONLY because no other script happens to use the
  name, which is "a guard that works as a side effect of something else's data
  is a coincidence with good timing" in a new place: adding any of those names
  to Priest or Mage silently crosses two characters' state with nothing
  failing.
- **A TRIP'S AGE IS NOT EVIDENCE THAT THE SCRIPT WAS RUNNING FOR IT.** The
  browser session's own second finding, and scoping the key does not touch it:
  `bossState.trip` is restored at load by design, so a `startedAt` of 22:58:13
  read at 23:01 says nothing about whether anything executed in between -
  which is exactly how one would misread the 22:42 graveyard pick. A trip
  whose event has ENDED does self-correct, on the first `bossTick`:
  `bossPick()` returns null and `bossEnd('nothing eligible is live')` fires.
  The stale trip is not the hazard; the inference from its age is.
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
- **A SLOT HASH AGAINST THE REPO IS THE STRONGEST DEPLOY CHECK THERE IS, AND
  IT MUST NAME A COMMIT RATHER THAN A BRANCH.** The browser session's method,
  2026-10-22: `get_code` reads the SLOT, so no character need be online - which
  retires the hopping-merchant problem that had defeated six `browser_code_eval`
  attempts in a day - and a hash says which commit a slot IS, or that it is
  none of them. **That is what feature detection cannot do**: Dexon's five hand
  edits on 2026-10-17 would have passed every `typeof` probe ever written.
  Measured: all four slots matched their repo blobs exactly, slot bytes plus
  the trailing newline a CODE slot drops.
  **AND THE METHOD HAS ITS OWN TRAP, FOUND BY WALKING INTO IT.** They measured
  the repo sizes at 17:00Z and the slots at 18:45Z, with v117 landing in
  between - **comparing a fixed artefact against a MOVING ref manufactures
  drift at the other session's commit cadence**, and would have reported three
  hand edits where there were none. That is the line-numbers-are-clone-local
  lesson in hash form: the left side is pinned and the right side is not, and
  only one of them says so. The procedure is read the slot header's version,
  resolve THAT version's commit, fetch at `?ref=<sha>`, compare.
  **AND THE RULER MATTERS HERE TOO, differently from the em-dash cases above.**
  Merchant is pure ASCII so all three counts agreed and the one-unit gap was
  provably the newline; the three party scripts are not - Ranger measured
  367,750 code points, 367,831 utf-8 bytes and 367,765 utf-16 units, 81 bytes
  of multi-byte content and 15 surrogate pairs. **git blobs are utf-8, so utf-8
  is the only correct ruler**, and code points would have been wrong by 81 on a
  comparison whose entire output is match-or-not.
  Checked at the same time and worth recording as RESOLVED: Dexon's four
  operator edits - `'mole'` in `singleTargetMobs`, `monsterHunt` off, the
  booboo entry commented out - are in the COMMITTED file, so the 2026-10-17
  divergence was folded upstream rather than still being live.
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
- **"DEPLOYED" AND "RUNNING" ARE A THIRD PAIR, AFTER viewed-vs-engaged AND
  repo-vs-slot, AND MELTYMERCH IS IN IT RIGHT NOW BY DESIGN.** Operator,
  2026-10-21: OpenGifts v11 is LIVE IN ITS SLOT BUT NOT ACTIVE, and becomes
  active the next time they have the merchant open boxes. So a probe of
  Meltymerch legitimately finds `Party/Merchant.js` today and `OpenGifts.js`
  tomorrow with NOTHING having been deployed in between - the slot content did
  not change, the operator's rotation did. This is the confound that already
  produced a retracted paste block, where `CONFIG.homeServer` and
  `parent.MERCHANT_VER` reading undefined looked exactly like a stale merchant
  and was a different script entirely. `parent.PARTY_BUILD[...].script` and the
  live lexical scope answer WHICH SCRIPT; neither answers WHEN the operator
  will next rotate it, and nothing in the repo records that.
- **MEASURED 2026-10-21: MERCHANT v112 IS LIVE AND ACTIVE**, by
  `merchantHeaderVersion()` and `merchantVersion()` both returning 112 from
  inside the running CODE context - the feature-detect rather than the header.
  **AND `CONFIG` IS NOT REACHABLE AS A PROPERTY OF THE IFRAME'S WINDOW**, because
  it is a `const` and lives in script scope, while the two functions are
  reachable being function declarations. This file already records that under
  "Reading a running script's state" and the browser session still reached for
  the property first - so it is worth noting as RECURRENT rather than new:
  indirect eval through the frame is the documented bridge.
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
- **AND `document.hidden` MAPPED TO A SINGLE LETTER PASSES THE RESULT FILTER,
  WHICH IS WHY THAT HALF OF THE CHECK HAS NEVER ACTUALLY BEEN RUN.** The raw
  property trips the filter reliably, so both sessions have measured the
  interval and INFERRED the visibility - and this diagnosis has now been guessed
  wrong twice in this repo on exactly that gap. Write
  `parent.localStorage.setItem(k, document.hidden ? 'H' : 'V')`, which is the
  derived form the "report DERIVED facts" bullet already prescribes. Measured
  2026-10-22 on all three characters: it comes back clean.
- **THE SECOND WRONG GUESS, AND THE REFUTATION WAS IN THE SAME PARAGRAPH AS THE
  CONCLUSION.** 2026-10-22: MageofOz read 1.25 ticks/s and was reported
  throttled with the operator asked to move his tab. Re-measured with each tab
  reporting its OWN visibility: all three hidden, all three 9.97/s, 60 ticks in
  ~6,015 ms, `setTimeout(...,0)` returning in 0 ms - **THE NO-THROTTLE FLAGS ARE
  ACTIVE** and the proposed fix addressed nothing. The sentence "two unthrottled
  tabs rules out the flags being missing at process level" was written one line
  from the conclusion it falsifies: flags off means AT MOST ONE unthrottled tab,
  flags on means ALL THREE, and two were in hand. Both branches were already
  dead on the page. The operator saying "he is in the same window" is what made
  it get read.
  **SO: A SIGNATURE MATCH IS NOT A MEASUREMENT OF THE THING THE SIGNATURE
  NAMES.** ~800ms was called "exactly the hidden-tab signature" against an
  untested hypothesis - the same move as matching a blob hash to the wrong
  target file. The real cause was main-thread occupancy for a bounded stretch:
  two consecutive samples, clean eight minutes later.
  **CONSEQUENCE FOR THE OPEN MEASUREMENTS: THEY ARE NOT BLOCKED.** The 90/30
  scoring, the constant-velocity re-measure and the attack/loot rates are all
  takeable - and a rate sample should carry its own visibility letter AND tick
  count, so a transient busy period cannot be read as a behavioural finding.
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
- **A TRUST WINDOW WITH NO HEARTBEAT IS A TIMER THAT ALWAYS EXPIRES, AND IT IS
  THE FOURTH FAILURE MODE FOR TWO STATE MACHINES: THE SECOND ONE IS NEVER
  TOLD.** After "they disagree", "one cannot see the predicate" and "one is
  never asked". Fixed in Ranger v118 / Priest v66 / Mage v89.
  `bossBroadcast(pick.name)` fired only where the trip STARTS or CHANGES, and
  a follower trusts `bossState.fromLeader` for `leaderTrustMs` = 20s. A
  graveyard window is 600s and a horseman window 2400s, so for all but the
  first twenty seconds of every trip the followers were on their OWN pick -
  **and that is a DIFFERENT RULE rather than a copy**: the ranger orders by
  `bossRank` first with an incumbent tie-break, the followers by lowest hp
  ratio alone, since `bossRank` is declared in `Party/Ranger.js` and nowhere
  else. Same `parent.S`, two rules, three characters.
  **THE SYMPTOM WAS A THREE-MAP SPLIT AND THE BROWSER SESSION REPORTED IT AS AN
  OBSERVATION RATHER THAN A CLAIM** - Dexon on spookytown, FatherToken on main,
  MageofOz on halloween, during one graveyard trip, with "could be a regroup;
  could be the movement-ownership class again; I have no second sample and am
  not calling it either way". A single unexplained sample, handed over without
  a theory attached, was enough to find a mechanism from the source in one
  pass. **THAT IS THE HANDOFF WORKING**, and it is the opposite of the
  signature-match failure this file records twice.
  **`rageEntryBroadcast` ALREADY HAD IT RIGHT, AND THAT IS THE DURABLE HALF.**
  It re-sends EVERY tick, so its `trustMs` expires only when the leader really
  has gone quiet. The same mechanism was built complete in one subsystem and
  half-built in the other, three weeks apart, and nothing connected them. **A
  TRUST WINDOW AND ITS HEARTBEAT ARE ONE MECHANISM** - shipping the window
  alone leaves a feature that works for twenty seconds and then silently stops,
  which is indistinguishable from it never having been wired.
  The EXPIRY is correct and unchanged: a leader that has stopped ticking must
  release the followers, which is pinned through `bossPick`'s `src` crossing
  from `leader` to `own` at the boundary.
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
- **A TRUNCATED RESULT IS REPORTED AS TRUNCATED, AND IT COSTS ONE MORE CALL.**
  2026-10-21: a session watched a result get truncated, said "everything's
  captured, go ahead and switch", and had stashed the dumps on `window` rather
  than `localStorage`. The operator then changed servers - which reinitialises
  the page, the hazard in the bullet directly above, quoted to them from this
  file two hours earlier - and an 80-row event log, `friendly`, `objectives`,
  `doorShape` and `skillFail` were lost. Cave is one run per day, so that was a
  day. **Anything that must survive a hop goes to `localStorage` AND IS READ
  BACK to confirm it landed, before anyone is told it is safe to proceed.**
  Knowing the rule is not the same as applying it under time pressure, which is
  why it is written as a sequence rather than as advice.
  **THE RULE WAS BROKEN AGAIN THE NEXT MORNING, BY ITS OWN AUTHOR, AND THE
  SECOND INSTANCE GIVES IT A STRONGER FORM.** 2026-10-21: a `G.drops` pull
  requested dragold, franky, snowman, grinch AND crabxx; the result truncated
  during snowman; the block was written anyway, quoting crabxx's normal table
  from this file instead of from the read that had been cut off. Both had moved.
  **A TRUNCATED RESULT MEANS THE FIELDS YOU DID NOT SEE ARE UNREAD, NOT
  UNCHANGED** - and the tell is that you can NAME exactly which ones they were,
  which is what makes this cheap to check and inexcusable to skip. Under
  twenty-four hours between paying for this twice.

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

## Selling, banking and what must never be vendored

**Both sessions.** Operator's rulings 2026-10-20, in force on BOTH the merchant
and the ranger. Analysis by the browser session; the figures were measured live.

- **FOUR THINGS ARE NEVER SOLD, on either character.** (a) `dexbelt` and
  `intbelt`, which are not plentiful; (b) exchangeables, restating the
  2026-10-03 rule that currently exists in `Party/Merchant.js` and nowhere
  else; (c) anything valuable on the MARKET; (d) and when the bag is full and
  cannot be emptied safely, THE BANK IS THE NEXT RUNG, NOT THE VENDOR.
- **`CONFIG.selling.whitelist` IN `Party/Ranger.js` IS CLOSED - DO NOT "FIX"
  IT.** `dexamulet`, `intamulet`, `harmor` and `wbook0` sit on it and look like
  live `GEAR_PROGRESSION` items. Operator's call: wbook0's slot has been moved
  past, and the amulets are plentiful enough that losing one is not a real
  loss. This is a recorded decision in the same class as the
  angelwings/puppyer/tshirt7 removals in the OpenGifts changelog.
- **THE VENDOR PRICE LIES ABOUT A WHOLE CLASS OF ITEM, AND A CHEAPEST-FIRST
  SORT PUTS EXACTLY THAT CLASS FIRST.** `Party/Merchant.js` has carried the
  warning since OpenGifts v3, naming the two worked examples: `cxjar` vendors
  for 1 and sells for ~1,000,000; `tshirt3` vendors for 72 and sells for
  ~200,000,000. `runInventoryRelief()` in `Party/Ranger.js` then reimplemented
  a cheapest-first sort - `reliefSellable()` orders ASCENDING by
  `calculate_item_value` - without the guard that warning exists for, and
  `targetFreeSlots` is 21, so a run works a long way down the list. Measured
  live in departure order: cxjar 1, ashleaf 21, tshirt3 72, reefglass 108,
  snakeoil 120, feather0/seashell 480, stormfeather 1,080, leather 1,800,
  funtoken/monstertoken 7,200, voidthread 14,400,
  essenceofether/essenceoffire 24,000, then all five DUNGEON keys and
  dexbelt+0 at 30,000. The three BANK keys survive BY ACCIDENT ONLY - dkey
  43,200,000, ukey 30,000,000, bkey 3,000,000 sort to the bottom. `neverSell`
  is 19 potions, boosters and scrolls and catches none of it.
  **A WARNING IN ONE SCRIPT DOES NOT PROTECT ANOTHER**, which is the same shape
  as the single-valued goobrawl mapping sitting in four files.
- **THE FREE PRICE SOURCE IS THE ONE THAT CANNOT DO THE JOB.**
  `scoutItemPrice()` is the obvious thing to reach for - no network, already
  written, already used - and it is `calculate_item_value(it)` times
  `G.multipliers.secondhands_mult`, so it is derived from THE SAME NUMBER that
  lies about this class. cxjar stays ~1 gold through it; tshirt3 stays ~72. It
  is a sound replacement-cost anchor and useless as a market guard, so reaching
  for it because it is cheap produces a rule that passes review and protects
  nothing. Rule (c) needs a real feed: ALData or `pull_merchants`.
- **THERE ARE THREE INDEPENDENT PRICE SOURCES AND NONE OF THEM IS THE BRIDGE** -
  `aldata.earthiverse.ca`, the game's own
  `https://adventure.land/api/pull_merchants`, and `scoutItemPrice()` which
  touches no network at all. A "protections and caps want opposite fail-safes"
  dilemma was raised and WITHDRAWN on the operator's correction: it only bites
  with all three down at once, and the review pack removes even that corner.
- **THE RANGER NEEDS NO NEW INFRASTRUCTURE TO READ A REAL FEED, and the
  reasoning that said otherwise was wrong in an instructive way.**
  `Party/Ranger.js` has ZERO market plumbing and does already speak to the
  bridge for boss events, and that pair was read as "rule (c) REQUIRES the
  bridge". It does not: the ranger runs at the `adventure.land` origin, so
  `pull_merchants` is same-origin and credentialed from its own CODE context -
  which `Party/Merchant.js` proves by construction, fetching that exact URL
  from exactly there. **THE BRIDGE IS A PUBLISHER, NOT A SOURCE.** What stays
  true is the reason the bridge was attractive, which was never the data: do
  NOT duplicate the merchant's market client in the ranger. `gtQuote`,
  `gvBaseValue`, the fallback chain, the caching and the pacing are a few
  hundred lines that exist because the feed needs handling, and a second copy
  drifting from the first is the whole-file-handoff hazard in another costume.
  So: ONE computed never-sell set - names whose best market bid materially
  exceeds their vendor value - published where both scripts can read it, with
  the bridge as the natural publisher BECAUSE BOTH ALREADY POLL IT.
- **RELIEF MUST NOT REUSE `CONFIG.selling.whitelist`, AND THE REASON IS THAT IT
  WOULD BE INERT RATHER THAN WRONG.** One curated list with two consumers looks
  like the elegant answer. `sellItems()` runs every `maintenanceLoop` tick and
  vendors every whitelist name on sight, so by the time the pack is full there
  are no whitelist items left in it - the bag fills with precisely the
  non-whitelist set a whitelisted relief would refuse to touch. Dead code in
  every state that matters, retracted by its own author before anyone built it.
- **(a) AND (b) ARE ALREADY HALF DONE ON THE MERCHANT, measured not assumed.**
  `isExchangeable()` gates both sell paths, so (b) is done. `intbelt` is
  already covered because `isTier2OrTier3GearItem('intbelt')` is TRUE - priest
  tier2 belt intbelt@4, mage tier2 intbelt@4, mage tier3 intbelt@5 - while
  `dexbelt` has ZERO `GEAR_PROGRESSION` entries since `windbelt` took the
  ranger belt slot. So the merchant needs `dexbelt` alone, and it must NOT lean
  on `CONFIG.pontyBuy.items` membership for it: that list already does double
  duty as a sell guard via `pontyWanted()`, undocumented until now, so making a
  scarcity protection depend on a BUY preference means removing the buy
  silently reopens the vendor path.
  **THIS BULLET'S "HALF DONE" AND "needs dexbelt alone" ARE NOW HISTORICAL -
  both landed in Merchant v109**, two bullets down, where the measurement that
  turned the inference into a finding is recorded. Read this one for the
  reasoning and that one for the state.
- **THE LEVEL GUARD IS ASYMMETRIC AND THAT IS WORTH KNOWING RATHER THAN
  FLATTENING.** Relief checks `level > 0`; the merchant's aggressive pass has no
  level check at all. So a `dexbelt+2` is safe in Dexon's bag and exposed in
  Meltymerch's.
- **DONE ON THE MERCHANT IN v109, AND IT WAS A MEASURED HOLE RATHER THAN THE
  HARDENING THIS FILE EXPECTED.** `dexbelt` and `intbelt` are now explicit
  entries in `PROTECTED_ITEM_NAMES`, which both of the merchant's vendoring
  paths already consult. Measured 2026-10-21 by lifting the real functions out
  of the committed file: dexbelt returned FALSE on every guard those paths
  apply - not exchangeable, not a kept material, not arbitrage stock, not on
  the Ponty buy list, and `isTier2OrTier3GearItem('dexbelt')` false. So it was
  not merely uncovered by the rule, it was reachable.
  **THE SILENT REPEAL IS THE DURABLE PART.** dexbelt WAS covered by the
  tier-2/3 check until windbelt took the ranger belt slot on 2026-10-10, so a
  `GEAR_PROGRESSION` edit withdrew a sell protection that nobody had filed as
  one. Nothing failed, nothing logged, and the protection was never named in
  the place it was acting. `intbelt` is therefore listed too, even though that
  same check still covers it - the operator's rule is about SCARCITY, not about
  being a current gear goal, and an explicit name cannot be withdrawn by a goal
  edit. **A GUARD THAT WORKS AS A SIDE EFFECT OF SOMETHING ELSE'S DATA IS NOT A
  GUARD, IT IS A COINCIDENCE WITH GOOD TIMING.**
  **AND THE EXPOSED ITEM WAS THE EXACT ONE ANOTHER GUARD EXISTS TO PRESERVE** -
  a sharper version of the asymmetry bullet above. `CONFIG.craftInputCaps.dexbelt`
  is 2 because `G.craft.windbelt` consumes a dexbelt+2, and it stops that +2
  being compounded into a spent +3; the aggressive pass, with no level check,
  would have vendored the same +2 for its ~30,000. Two guards on one object,
  each correct in isolation, with nothing covering the gap between them.
- **DONE ON THE RANGER IN v106: (a) AND (b) NOW REACH BOTH OF ITS SELL PATHS,
  AND NEITHER RULE EXISTED THERE AT ALL.** `isExchangeable()` is derived the
  merchant's way (the seed unioned with every `G.items` entry carrying `.e`,
  cached only once the derived half read something), and `dexbelt`/`intbelt` are
  an explicit `SCARCE_ITEM_NAMES` set rather than a gear-table lookup - for the
  reason the merchant's repeal gives. Both are applied in `reliefSellable()` AND
  `sellItems()`, which fail differently: relief refused `level > 0` so only a +0
  belt was reachable there, while `sellItems()` has no level check and runs
  every `maintenanceLoop` tick.
  **ONE NAME'S BEHAVIOUR CHANGED AND IT IS A RECORDED DECISION, NOT A SIDE
  EFFECT.** `lostearring` sits on `CONFIG.selling.whitelist` and carries `e=1`,
  so `sellItems()` vendored it on sight; rule (b) now outranks the whitelist for
  it, exactly as the same guard outranks `gem0` and `seashell` on the merchant's.
  That whitelist is the operator's and is CLOSED - this is not an edit to it -
  and the operator can overrule by name if that sale was wanted.
  **THE DUPLICATION IS DELIBERATE AND PINNED.** Two CODE slots share no module,
  so the remedy for a copied predicate is an assertion that the copies stay
  equal: the suite now checks the two exchangeable seeds are IDENTICAL and that
  both scripts derive as well as seed.
- **THERE ARE THREE SELL PATHS ON THE MERCHANT, NOT THE TWO THIS SECTION
  IMPLIED**, and the omission-safety it describes applies IDENTICALLY to the
  ranger - the browser session's catch. `sellItems()` is whitelist-driven with
  no level check, so the belts are safe there only by ABSENCE from a list the
  operator edited on 2026-10-20. Asserted in the suite on BOTH files now, so
  adding a belt to either whitelist fails rather than passing quietly.** `sellTrash()` is whitelist-driven and consults
  `PROTECTED_ITEM_NAMES` not at all - it sells only names present on
  `CONFIG.selling.whitelist`. So the belts are beyond its reach while that list
  does not name them, which is a DIFFERENT KIND OF SAFETY from a guard: it
  holds by what the list omits rather than by anything the code checks, and the
  operator edits that list. `Tests/suite_merchantsell.js` asserts the absence
  deliberately, so the protected set cannot be read as covering all three, and
  adding a belt to that whitelist fails an assertion rather than passing
  quietly.
- **THE dexbelt PONTY CURVE, MEASURED 2026-10-21, AND THE ONE COMBINATION THAT
  IS HARMFUL.** Ponty's ask is `calculate_item_value(item)` x
  `G.multipliers.secondhands_mult`, and that multiplier read 2 live. Per level:
  +0 30,000 npc -> 60,000 Ponty; +1 98,667 -> 197,334; +2 318,400 -> 636,800;
  +3 1,118,880 -> 2,237,760; +4 3,680,416 -> 7,360,832. `G.craft.windbelt`
  consumes a dexbelt+2 EXACTLY and a +3 is a SPENT belt, which is what
  `CONFIG.craftInputCaps.dexbelt` is for - so a ceiling anywhere in
  (636,800 , 2,237,760) admits the +2 and refuses the +3. The browser session's
  recommendation is `maxPrice: { dexbelt: 1000000 }`: round, clear margin both
  sides, and it turns a level-blind buy rule into a level filter without adding
  one. `intbelt+0` prices identically, so the same ceiling works there.
  **INSTALLED IN MERCHANT v112, ON THE OPERATOR'S RULING: "+0, +1, +2 ONLY -
  they are an ingredient, higher is not acceptable."** Both lines landed
  together, as they had to: `maxPrice` alone is inert while the id is off the
  buy list, and the buy alone is uncapped (`maxPrice`'s default is NO CEILING),
  which would buy +3s at 2,237,760 and +4s at 7,360,832 - exactly the
  spent-belt purchase `craftInputCaps` exists to prevent.
  **AND A THIRD LINE WAS ADDED THAT THE AGREED PLAN DID NOT HAVE: THE RULING IS
  ABOUT LEVELS AND A PRICE CEILING EXPRESSES IT THROUGH A NUMBER THAT IS NOT
  OURS.** 1,000,000 implements "+2 and no higher" only because
  `G.multipliers.secondhands_mult` read 2 when the curve was measured; at mult 4
  the +2 asks 1,273,600 and the SAME ceiling starts refusing the belt the craft
  needs. That is this file's own "a guard that works as a side effect of
  something else's data is not a guard, it is a coincidence with good timing",
  caught BEFORE it cost anything rather than after - so `CONFIG.pontyBuy
  .maxLevel` states the level rule as a level and the price ceiling stays as a
  cost guard beside it. Absent means unrestricted, preserving the list's own
  "any level found is bought" default, and a row with no `level` reads as 0 so a
  non-upgradeable item is never refused.
- **PUTTING `dexbelt` ON THE BUY LIST GAVE IT A SECOND SELL GUARD, AND THE SUITE
  CAUGHT THAT AS A FAILING PRECONDITION RATHER THAN A PASSING ONE.**
  `pontyWanted()` doubles as a sell guard, so the buy makes `PROTECTED_ITEM_NAMES`
  no longer dexbelt's only protection - and `suite_merchantsell.js` asserted the
  ABSENCE as the precondition establishing exactly that, so v112 could not land
  without confronting it. **The explicit name must stay regardless**: the buy
  list is the operator's and marked EDIT THIS, so dropping the buy would repeal
  the derived guard in precisely the silent way the `GEAR_PROGRESSION` edit did
  in v109 - same hazard, opposite direction. `intbelt` is still off the list, so
  for it the explicit name remains the only guard, and the asymmetry is asserted
  rather than flattened. A reader who finds two guards must not conclude either
  is redundant.
- **`cscroll4` REMOVED FROM THE BUY LIST in v112**, on the operator's ruling. The
  list is 58 ids either side of the edit - one out, one in.
  **THE ECONOMICS ARGUE FOR BUYING +2s RATHER THAN TOLERATING THEM.**
  Compounding is 3-to-1 per level, so a +2 built from scratch is 9x dexbelt+0 =
  540,000 at Ponty BEFORE compound failures, which destroy all three inputs; a
  +2 bought outright is 636,800 with no variance. Within ~18% before failures
  and the bought route wins after them. The tier-2 goal needs SIX dexbelt+2
  (windbelt@2 from the +1 Dexon wears) = ~3.8M against 1.79B banked, so GOLD IS
  NOT THE CONSTRAINT - Ponty stock is, which makes the stack-cap exemption
  matter more than the price cap: without it the buy never fires at all.
- **THAT STACK-CAP EXEMPTION IS NOW AUTOMATIC, AND THE RULING THAT SUPPLIED IT
  UNCOVERED A SECOND DEFECT NOBODY HAD REPORTED.** Operator 2026-10-21: "For
  items that do not stack there is not supposed to be a buy cap from ponty."
  `pontyStackCap()` returned `it.s || 1`, so every unstackable id capped at ONE
  COPY - 23 of the 58 on the buy list, dexbelt included once it is added, which
  is why the bullet above needed an exemption at all. Fixed in Merchant v110;
  no exemption line is needed any more.
- **`G.items[name].s` IS A TRUTHINESS FLAG CARRYING AN OPTIONAL SIZE, AND THE
  SOURCE AND THE LIVE CLIENT CARRY DIFFERENT SHAPES OF IT.** `design/items.js`
  holds `s: true` on 201 of 671 entries, byte-identical at upstream HEAD
  `16881a27`. **LIVE G HOLDS NO BOOLEAN AT ALL** - 653 entries read off a
  character tab 2026-10-21, 216 reading 9999, 411 absent, 26 specific counts,
  not one `true`. **THE RESOLUTION SITE IS UNEXPLAINED AND IS RECORDED THAT WAY**:
  there is no normaliser anywhere in the server source, and the two sites that
  consume `s` resolve the boolean INLINE - `(G.items[n].s === true && 9999 ||
  G.items[n].s)` in `can_stack()` at `js/old_common_functions.js:409`, and the
  same at `:505` - which is exactly what you write when the data really does
  carry booleans. This is the first time the source-is-a-lead rule has
  landed on ITEM FLAGS rather than on the DOM or monster data, and the direction
  matters: **a source read makes this look like a type bug the client has
  already fixed.**
  **ANSWERED 2026-10-21: IT IS AN EXPORT STEP, NOT RUNTIME.** The browser
  session fetched `/data.js`, the payload the client actually loads, and
  censused the RAW TEXT: 2,820,908 bytes, `"s":true` ZERO times, `"s":9999`
  **216 times** - exactly the live-G count. So the served payload already
  carries 9999 and nothing converts it in the browser. That it is TARGETED
  rather than a blanket coercion is settled by the same census: `:true`
  survives 1,496 times elsewhere in that file. The resolution therefore sits
  between `design/items.js` and `/data.js`, in an export the served source does
  not contain, which is why it is invisible from a clone. **The two inline
  resolvers are dead against this payload and would come alive for any consumer
  fed the design files directly**, which is the category `pontyStackCap()`'s
  `=== true` branch is in: inert against today's G, correct against the data
  the game is built from.
- **`G.version` IS A FREE IDENTITY STAMP FOR EVERY TABLE IN THIS FILE** - 18183
  as of 2026-10-21. One read says whether the tables moved since a figure was
  recorded, and given that the drop tables flip-flopped twice in fifteen days
  that is worth more beside a number than its date is. The browser session's
  suggestion; adopt it when recording anything read from `G`.
- **SO MERCHANT v110 CLAIMED TWO DEFECTS AND THERE WAS ONE. THE SECOND IS
  RETRACTED.** Real: `it.s || 1` returns `1` for an item with no `s`, capping
  every unstackable id at a single copy - 23 of the 58 live buy-list ids, the
  operator's reported defect. Retracted: that a further 19 ids returned the
  BOOLEAN, which `have >= stackCap` coerces to 1, so leather, funtoken,
  monstertoken, the boxes, the six cake slices, the scrolls and the essences
  were each capped at one copy. The coercion is real arithmetic and the
  conclusion was false - on the buy list the 19 "booleans" and the 4 explicit
  9999s are the SAME 23 ids, all reading 9999, and those items were buying fine.
  **THE SHARP PART: `pontyStackCap` READS G IN THE SCRIPT'S OWN CONTEXT, SO LIVE
  G IS NOT A SECOND COPY THAT MIGHT DISAGREE - IT IS THE INPUT TO THE
  FUNCTION.** There was never a gap between what was measured and what the code
  saw, which is what makes this a plain inference error rather than version
  skew, and why "the source is a lead" was not a hedge that could have covered
  it. The fix itself stands unchanged and handles both shapes; only the
  rationale moved, in v111.
- **A FALSE DEFECT GENERATES ITS OWN CORROBORATING NARRATIVE, AND THAT IS THE
  EXPENSIVE HALF.** v110 also reported the comment above `pontyStackCap()` -
  "23 stack at 9,999" - as a correct claim sitting on top of contradicting code,
  filed as the `CaveRun.js:227` shape from a third direction. It was nothing of
  the kind: the comment was right, the code returned 9999 for exactly those ids,
  and the two agreed all along. Having "found" the bug, the next move was to ask
  why nobody had caught it, and a tidy answer arrived for a question that should
  never have been asked. **So a finding that explains its own invisibility
  deserves MORE scrutiny than one that does not**, because the explanation is
  evidence about the finder rather than about the code.
- **AND THE CLONE WAS STALE WHILE ALL OF THIS WAS READ FROM IT.** `/tmp/almongo`
  sat at `43b2c8fc` while upstream HEAD was `16881a27`, and the three-line
  freshness check under "The loaded copy and the repo copy" was not run until
  after the browser session's correction arrived. `design/items.js` turned out
  unchanged between the two, so nothing rests on it - which is luck, not
  method, and the second time in two days that reading upstream without the
  check preceded a retraction.
- **MY FIRST SCAN OF THE BUY LIST MISCLASSIFIED THE 9999 GROUP**, because it
  matched `"s"\s*:\s*(\d+)` and an integer pattern cannot see `true`. Same
  family as "a design value may be an expression, not a literal": the regex
  answered a question about integers and was read as an answer about
  stackability.
- **A QUOTE SCAN OVER SOURCE TEXT THAT DOES NOT STRIP LINE COMMENTS COUNTS
  COMMENTED-OUT ENTRIES, AND BOTH SESSIONS HIT IT THE SAME DAY.** The live
  `pontyBuy.items` list is 58 ids; a scan without comment-stripping returns 59,
  because `jacko` sits on it as `//'jacko', too many durring halloween event`.
  The browser session's otherwise-decisive live-G census reported 59 and "24
  absent" for that reason, against 58 and 23. Identical class to the apostrophe
  bug in `suite_merchantsell.js`'s name parser, which is why that helper strips
  comments before parsing. Neither error touched its block's conclusion, and the
  pair is worth keeping precisely because the same defect appeared in two
  different tools within hours.
- **`cscroll4` IS NOT AN ITEM, CONFIRMED FROM BOTH SIDES.** The game has
  cscroll0 through cscroll3 - against scroll0 through scroll4, which is where
  the mistake comes from - so that id on `CONFIG.pontyBuy.items` matches nothing
  Ponty can offer. Read from source here and from live `G.items` by the browser
  session, independently. Reported rather than removed: that list is marked EDIT
  THIS and is the operator's.
- **THE REVIEW PACK IS THE OPEN CHANNEL, AND IT IS WHAT MAKES THIS A SYSTEM
  RATHER THAN A GUESS.** The ladder: the mule collects; else sell the
  classified-safe set; else bank the remainder TO ONE DEDICATED REVIEW PACK;
  else carry on. The operator drains that pack by hand and rules on each item.
  The derived rules are a CLOSED set and "the vendor price lies about this
  item" is not a type, so they can never cover the class completely - cxjar and
  tshirt3 are known only because somebody hit them once and wrote it down.
  Closed rules plus an open discovery channel improves; closed rules alone rot.
  **SO THE CORRECT RESPONSE TO A BAG THAT KEEPS FILLING IS TO READ THE PACK,
  NEVER TO WIDEN WHAT RELIEF WILL SELL.** Widening is the tempting fix and it
  is the one that silently reopens everything above.
- **STANDING CONVENTION: THE SCRIPTS MUST NOT ENCODE THE OPERATOR'S PACK
  CATEGORISATION.** Operator 2026-10-20: the packs are roughly categorised and
  that scheme is explicitly IN FLUX, so a script mirroring it becomes a second
  thing to keep in step with something still moving. The scripts therefore know
  exactly ONE pack name - the review pack - and use the no-pack default for
  everything else, which is why `Party/Merchant.js`'s seven `bank_store()` call
  sites keep passing no pack and the server keeps choosing. A proposal to name
  the packs at each site was WITHDRAWN. Teaching a script which pack holds what
  is precisely the improvement a future session will offer; it is the thing not
  to do.
- **ON A FULL OR MISSING REVIEW PACK, STOP AND REPORT - DO NOT FALL BACK TO THE
  DEFAULT.** This is the one place the explicit pack matters, and the obvious
  safety net is what breaks the instrument: a `storage_full` spill into the
  default pack scatters unclassified items through 294 slots of categorised
  stock, silently, which is the exact state the pack exists to prevent. Carrying
  on full is bounded and already logged; a buried signal is not recoverable.
- **BANK STATE, 2026-10-21: 8 packs, 42 slots each, 336 total, 93 FREE.**
  `items7` HAS BEEN BOUGHT, so the review pack exists and the banking rung's
  prerequisite is met. The previous reading - 7 packs, 294 total, 51 free, 82.7%
  full, per-pack 0/14/18/4/4/1/10 - is kept as the instance rather than
  overwritten, because a note quoting 51-of-294 after this is reading a figure
  that moved within a day. Operator's call stands either way: the free runway is
  ample at the current fill rate, so where no-pack deposits land is not a
  problem to design around.
- **THE OPERATOR'S BANK ACCESS AND THE SCRIPT'S ARE DIFFERENT OPERATIONS, so a
  hand-run UI test measures the wrong mechanism.** They must click a bank NPC to
  open one specific pack and must be in range, and the packs are not all in
  range of the entrance; the SCRIPT reaches every pack from anywhere in the bank
  map once `character.bank` populates, with no UI involved. A proposed test -
  buy a pack, deposit one non-stackable with no pack argument, see where it
  lands - could not have worked for this reason. It also explains why
  `api_call('load_bank')` returns all seven packs from anywhere and why
  `bank_store(idx, pack)` needs no positioning.
- **THE BANK IS 336/336 FULL AND 22.9% OF IT IS ONE ITEM AT ONE LEVEL.**
  Measured 2026-10-22: **77x dexbelt@0**, and levelled items do not stack, so
  that is 77 slots. 0 at @1, 4 at @2, 2 at @3. The 93-free reading from
  2026-10-21 is kept as the instance above; it was gone inside a day.
- **AND THE FIX WAS SOURCING, NOT MECHANICS - THE OPERATOR'S OWN NARROWING OF
  THEIR OWN REQUEST.** They asked for withdraw-and-compound, then clarified that
  the compound mechanics ALREADY EXIST: `autoCombineOneBaseDuplicateGroup()`
  merges any three identical copies at level 0 or 1,
  `ensureUpgradeMaterials()` BUYS the scrolls (so the empty bank's lack of
  cscroll0 was never a blocker), and `CONFIG.craftInputCaps.dexbelt` 2 already
  permits 0->1 and 1->2 and refuses 2->3. **`findBaseDuplicateGroup()` READS
  `character.items` AND NOTHING ELSE**, which is the entire reason a bank full
  of triples compounded nothing. Shipped as `retrieveCompoundTriples()` in
  Merchant v114; not one mechanic changed.
  **A REQUEST THAT SOUNDS LIKE A FEATURE CAN BE A WIRING GAP, AND THE OPERATOR
  FOUND THAT BEFORE EITHER SESSION DID** by knowing their own script better
  than its reader.
- **RETRIEVING SOMETHING THE COMPOUNDER WILL THEN REFUSE IS WORSE THAN
  RETRIEVING NOTHING** - three inventory slots spent and the bank exactly as
  full - so the sweep calls `isCompoundableItem()` and
  `compoundWouldOvershootCap()` rather than re-deriving their rules. That is
  also what makes it cover the NEXT craft input for free: nothing in the sweep
  names dexbelt, asserted. Complete triples only, level 1 before level 0 (both
  free two slots, only the 1->2 produces the level windbelt consumes), and a
  2-slot reserve because the compounder BUYS its scrolls and being one slot
  short means a compound that cannot start after the retrieval already spent
  the slots.
  Worth arithmetically: 77 slots -> 11, freeing ~66, plus 8 more windbelt
  inputs. **THE REAL YIELD LANDS UNDER THAT**, because a compound destroys all
  three inputs on failure and `getCompoundChance` prices it.
- **`isCompoundableItem()` READS BARE `G`, NOT `parent.G`, AND THAT COST FOUR
  TEST FAILURES.** Most of `Party/Merchant.js` reaches through `parent.G`; that
  one guards on `typeof G !== 'undefined' && G.items`. A world supplying only
  `parent.G` fails the typeof, falls through to the function's
  `GEAR_PROGRESSION` scan, and returns its "unknown item, assume compoundable"
  DEFAULT - so a deliberately non-compoundable fixture read as compoundable and
  the assertion caught a fixture bug. **A FALL-THROUGH DEFAULT TURNS A MISSING
  STUB INTO A PLAUSIBLE ANSWER**, which is the Form B lie wearing a test
  harness; the tell was that the precondition failed, not the outcome.
- **AND ONE GUARD PAIR SHIPPED INERT, LABELLED AS SUCH.** Removing BOTH
  `if (triples < 1) continue` and `if (take.length < 3) continue` from the plan
  loop changes no behaviour, because a group of two yields `triples` 0 and the
  slice takes nothing; `Math.min(g.triples * 3, ...)` is what enforces complete
  triples, and removing THAT fails two assertions. Kept as cheap early-outs and
  commented as inert rather than left looking load-bearing - the
  comment-strip/newline-guard lesson applied before anyone had to re-measure
  it.
- **MELTYMERCH WAS FOUND IN JAIL OVERNIGHT, CAUSE UNKNOWN.** Online and fine
  afterwards; his tab hops too fast to hold a reading. Recorded because nothing
  in the repo addresses it and the next session should not read it as new.
- **`Party/Ranger.js` HAS NO BANK PLUMBING AT ALL - this is new capability, not
  config.** Measured: zero `bank_store`, zero `bank_retrieve`, no `CONFIG.bank`,
  no bank map. Every "bank" string in that file is monster-hunt token language
  ("banking a hunt"), which is the false positive a name search invites. It
  needs `CONFIG.bank = { map: 'bank' }` in the merchant's shape, a `smart_move`
  into that map, and `bank_store(idx, reviewPack)`. Read the merchant's banking
  first so the `storage_full` and `not_in_bank` handling matches -
  `character.bank` populates on ARRIVAL rather than with the map change, and
  `arbStockRetrieve` already carries a branch for "at the bank but
  `character.bank` is empty". One hazard, not a blocker: relief already leaves
  the farm spot and sets `state.sellingOff`, so an excursion is sanctioned, but
  the bank is a MAP TRANSITION - check what `holdCohesion` does while a bank run
  is in flight.

## The cave run - leash, roles and the party's real speeds

**Both sessions.** Measured by the browser session over one 24-minute run on
CaveRun v16, 2026-10-21. Cave is roughly one run per day, so a lost dump costs
a day.

- **FATHERTOKEN IS THE PARTY LEADER, not Dexon.** Nothing in this file said so
  until now, and every mental model either session has brought to the cave
  assumed the ranger leads. It does not.
- **`character.speed` IS A LIVE BUFFED VALUE AND NOT A STAT, SO THE "PARTY
  SPEEDS" FILED HERE ON 2026-10-21 WERE SNAPSHOTS AND ARE RETRACTED.** They read
  FatherToken 63, Dexon 67, MageofOz 58, and the browser session then read Dexon
  three times in one evening: 67, 74, 87. The differences are exactly `rspeed`
  (+7) and `warcry` (+20) entering and leaving. Decomposed: ranger base 45, gear
  +7.75 (windbelt+1 2.75, bowofthedead+8 -12, paradequiver+6 1, frankypants+7 1,
  wingedboots+7 15), remainder from conditions - so even the LOWEST of the three
  readings is not an unbuffed figure. **NO UNBUFFED SPEED WAS KNOWN FOR ANY OF
  THE THREE UNTIL 2026-10-21, WHEN THEY WERE MEASURED PROPERLY - SEE THE NEXT
  BULLET. The retracted claim turned out to be TRUE.**
- **THE RESTING SPEEDS, AND THE METHOD THAT MAKES THEM A MEASUREMENT.** Read
  each character on its own tab, enumerate the active conditions carrying a
  `speed` field in `G`, and subtract. Two of the three had NO speed condition
  active, so their observed values ARE resting values with nothing to subtract:
  FatherToken 62 observed / none active / **62 resting** (the LEADER);
  Dexon 73 / `rspeed` +7 / **66**; MageofOz 57 / none / **57**.
  So Dexon is +6.5% against the leader and MageofOz is -8.1%, which REPRODUCES
  the retracted 63/67/58 reading: the mage really is about 8% slower than the
  leader and cannot close a gap while the leader moves. Reinstated on the
  resting figures and the method, never on the snapshots.
  **AND THE RETRACTION WAS STILL THE RIGHT CALL - this is the half worth
  keeping.** A true claim resting on an unsound measurement is not a finding, it
  is a coincidence that has not been caught yet. The cheap lesson here is "you
  retracted something true"; the useful one is the opposite, and a session that
  learns the cheap one will start defending numbers it cannot support.
  **ONE RESIDUAL IS FLAGGED UNEXPLAINED RATHER THAN THEORISED.** Class base is
  45 for all three and gear speed is +7.75 / +15 / +15, so base+gear gives
  52.75 / 60 / 60 against resting 66 / 62 / 57. The residuals +13.25 / +2 / -3
  share no story - not level (77/73/73 does not fit), not gear. Something else
  contributes to speed and nobody has found it. It does not move the
  COMPARATIVE figures, which is what the cohesion work needs.
  **WHAT THAT RETRACTS AND WHAT IT DOES NOT.** The `bowofthedead` speed -12 IS
  proven, from the live slot's own gear sum. The claim that the mage is "8%
  slower than the leader and cannot close a gap while the leader moves" rested
  on three single-instant readings that may have carried different buffs, so it
  is NOT established - do not plan against it; re-measure unbuffed first. The
  `MOVE.closeAt` root cause and the fixed-cost-per-hold argument below depend on
  neither figure and both stand unchanged.
  **A "Dexon is the fastest of the three at 78" CLAIM IS IN THE REPO, IN
  `Party/Merchant.js`** - the `bowofthedead` note inside `GEAR_PROGRESSION` -
  and was corrected there in v108, since 78 is one more buffed instant. **THIS
  BULLET PREVIOUSLY SAID IT WAS NOT IN THE REPO COPY, WHICH WAS FALSE, AND THE
  WAY IT WENT WRONG IS WORTH MORE THAN THE FIX.** Two errors stacked. The
  browser session cited `CLAUDE.md` for a line it had read in `Party/Merchant.js`
  - "CHECK THE FILE YOU ACTUALLY MEAN" from the other end, reading a real file
  and then naming a different one. This session then searched only the file it
  had been handed and phrased the conclusion as being about THE REPO, so a
  one-file miss was published as repo-wide absence. **THE SEARCH THAT SETTLES IT
  IS EVERY TRACKED FILE AT THE REVISION, WHITESPACE-FLATTENED** - `git ls-tree
  -r --name-only origin/main` into a flattened read of each - which found it
  immediately, and a plain `grep` over the working tree missed it AGAIN because
  the phrase wraps across lines exactly as the wrapped-prose bullet warns.
- **ONE CONSTANT IN TWO ROLES IS THE ROOT CAUSE OF THE HOLD OSCILLATION, AND IT
  IS NOT A TUNING PROBLEM.** `MOVE.closeAt` is 180 and is read by BOTH the
  leader's hold (`worst > MOVE.closeAt`) and the followers' recovery latch
  (`gap > L.closeAt`, combat-mode `L` built from the same constants). So a
  follower does not BEGIN closing until the gap reaches the exact value at which
  the leader GIVES UP and stops: the follower's start condition IS the leader's
  stop condition. Release is 120 for both, so the follower stops 60 short and
  the gap re-opens at once. Measured over one run: leader holds 142, holdStops
  571, holdResumes 131, holdGaveUp 9, 571,250 ms held - **40% of the run
  stopped** - with `outrunWarnTicks` 3,158 of 6,655 (47%); followers recoveries
  141 and 133, maxDistLeader 216 and 210. The event tail against one fixed
  destination is a ~3.3s cycle: hold at gap 183, resume 1.4s later, hold again
  1.9s after that, alternating between whichever follower trips first.
- **THE GAP RE-OPENS FASTER THAN SPEED EXPLAINS, and the arithmetic is the
  evidence rather than the theory.** 60+ units in 1.9s against a
  leader/slowest-follower differential of 5 units/sec, which accounts for about
  10. The remainder is the follower being STATIONARY at resume - the operator's
  own diagnosis, supported rather than restated.
- **SO MANY SHORT HOLDS IS THE EXPENSIVE ARRANGEMENT, NOT THE CHEAP ONE.**
  Follower start latency is a FIXED COST PAID PER HOLD: waiting once for 150
  units pays it once, waiting three times for 60 pays it three times over the
  same ground. 142 holds bought about 1.9s of travel each. The fix is a
  SEPARATION - give the hold its own pair of constants so its release can go to
  ~20-30 - and NOT a retune, because changing `MOVE.releaseAt` in place moves
  three behaviours at once: the hold, the followers' combat release, and the
  close-step sizing (`gap - leash().releaseAt * 0.6`). Baseline to measure any
  change against: 571s held, 142 holds, 9 give-ups.
- **BUILT IN CaveRun v18: THE HOLD HAS ITS OWN PAIR, `MOVE.holdAt` 180 /
  `MOVE.holdReleaseAt` 30.** Read at exactly one site, the hold's `need`
  expression; `closeAt`/`releaseAt` stay 180/120 and keep building the
  followers' combat band, the kite rejection and the close-step sizing, so one
  behaviour moved and nothing else. `holdAt` MATCHES `closeAt` on purpose - the
  trigger was never the fault, and raising it out of combat is Option B, still
  the operator's call and still held. `caveLeash()` reports the new pair
  alongside the bands so a live probe sees what the LEADER is doing.
  **THE PREDICTION IS RECORDED SO THE NEXT RUN CAN FALSIFY IT**, which is the
  only reason the baseline was worth keeping: holds ~57 against 142, total held
  ~325s against 571s, each individual hold LONGER. If holds do not fall by
  roughly 2.5x the fixed-cost-per-hold argument is wrong and should be retracted
  rather than retuned.
  **AND THE RISK IS NAMED RATHER THAN DESIGNED AROUND: `holdGaveUp`.** A
  follower stalled between 30 and 120 now keeps the leader waiting where it was
  released before, so that count can rise from 9. The lever is `HOLD.maxMs`
  (20000), patchable live through `caveLeash({maxMs: ...})` with no redeploy -
  deliberately NOT changed in the same commit, because two tuning changes landing
  together is how each one looks proven by the other's work.
- **THAT RISK WAS THE DEFAULT PATH, NOT AN EDGE, AND 120 IS A FLOOR RATHER THAN
  THE BUG. CaveRun v19 PUTS IT BACK.** Measured live by the browser session
  2026-10-21: v18 could not COMPLETE a hold - holds 8, `holdGaveUp` 5 (62%),
  `outrunWarnTicks` 650 of 2555 - and because the give-up LATCHES the leader
  then stopped holding at all and the party trailed freely. The operator's
  report was that movement was worse than before, and it was.
  **THE MECHANISM IS A ONE-WAY COUPLING, WHICH IS WHY IT IS NOT A TUNING
  PROBLEM.** A follower stops closing at HIS OWN `releaseAt` - 120 in the combat
  band - so the hold's exit condition can only ever be satisfied by follower
  movement that stops there. **THE LEADER'S RELEASE CANNOT BE SET BELOW THE
  FOLLOWERS' RELEASE**, at any timeout. The bullet above names the hazard as "a
  follower stalled between 30 and 120" and modelled it as rare; that band is not
  a stall, it is the followers' RESTING STATE. v18's own rationale had the
  diagnosis exactly inverted - it called releasing at 120 the fault, when 120 is
  the only gap the followers will actually deliver.
  **SO THE SEPARATION IS NUMERICALLY INERT AND STRUCTURALLY LIVE, a state the
  suite had no way to express.** It still buys a threshold the hold OWNS, movable
  without dragging the kite rejection and the close-step sizing along; what it
  cannot buy is a tighter release. Moving it UP is the untested direction and is
  where Option B lives.
  **THE PREDICTION CANNOT BE SCORED EITHER WAY, AND THAT IS THE HONEST VERDICT.**
  The bullet above says to retract the fixed-cost-per-hold argument if holds do
  not fall ~2.5x. Observed 8 against 142 - but that is the give-up latch
  switching the feature OFF, not fewer-and-longer holds. The experiment did not
  run, so the argument is neither confirmed nor falsified, and the browser
  session declined to claim either. **A RESULT IN THE PREDICTED DIRECTION
  PRODUCED BY A MECHANISM THE PREDICTION DID NOT DESCRIBE IS NOT A
  CONFIRMATION**, and it would have read as a strong one.
  **THE END-OF-RUN COUNTERS SPAN THREE CONFIGURATIONS AND MUST NOT BE SCORED** -
  v18 as shipped, then `holdReleaseAt` 120, then a live-patched 60/30 band. A
  ratio is only as good as its denominator being one population and this
  denominator is three. The only clean single-configuration numbers are two 70s
  sampler windows at 60/30: Dexon kite 8 / recoveries 20 / gaps 2-74 / hp ended
  FULL, MageofOz kite 8 / 16 / 5-65 / hp 89%->85%.
- **MY `caveLeash()` RETURNED `hold:` TWICE, SO THE PAIR v18 ADDED FOR
  OBSERVABILITY NEVER REACHED A READER - THE OBJECT-LITERAL FORM OF THE
  `serverhop_logic` TRAP, IN THE FILE WHOSE OWN HEADER DOCUMENTS THAT TRAP.**
  The later literal silently wins, exactly as the later function declaration
  does. Merged into one key in v19 and pinned by a depth-tracked duplicate-key
  scan over the returned literal - depth-tracked rather than regexed because the
  keys are not one per line and nested objects legitimately reuse names
  (`closeAt` appears in `travel`, in `combat` and at the top level, so a flat
  scan reports three false duplicates).
  **AND IT COST A WRONG DEPLOY CALL, WHICH IS THE EXPENSIVE HALF.** The browser
  session feature-detected rather than trusting `ver` - correct, and `ver` reads
  18 regardless - and chose the new hold pair as the feature. Absent, so they
  reported pre-v18 running. The build WAS v18. **A FEATURE ADDED IN THE SAME
  COMMIT AS THE BEHAVIOUR IT REPORTS IS THE WORST POSSIBLE DEPLOY PROBE**,
  because nothing has ever confirmed it reaches a reader - the probe and the
  thing being probed fail together and the failure reads as "not deployed".
  Settled instead with `caveLeash.toString().indexOf('holdReleaseAt')`, a derived
  boolean, which should have been the first probe. This sharpens
  "feature-detect, not version-detect" rather than contradicting it: prefer a
  feature that has ALREADY been observed reaching a reader, and where none
  exists, probe the source text rather than the output.
  `msHolding` is on `tel`, not `counters`, so it is not pullable where the v18
  handoff asked for it.
- **THE OSCILLATION INVARIANT, WHICH EXPLAINS BOTH SHIPPED BANDS AND CONSTRAINS
  EVERY FUTURE ONE.** The browser session's finding: the sawtooth fires when
  `releaseAt + kiteStep > closeAt`. A follower sitting at `releaseAt` takes a
  free outward kite step - the no-ratchet guard is INACTIVE below `releaseAt` in
  combat - and if that step lands past `closeAt` he latches and closes back in,
  forever.
  combat `120 + 55 = 175 < 180` is SAFE BY FIVE UNITS; travel
  `30 + 55 = 85 > 60` VIOLATES it and survives only because the no-ratchet is
  UNCONDITIONAL in travel (`gapNow > L.releaseAt || L.mode === 'travel'`); a
  live-patched 60/30 combat band oscillated at a measured 1 recovery per 3.5s.
  **So combat satisfies it ACCIDENTALLY, and the tight band plus the
  unconditional no-ratchet are ONE change rather than two.** Pinned in both
  directions in `Tests/suite_caverun.js` so neither half can land alone.
- **THE BAND SELECTOR IS GATED ENTIRELY ON FOLLOWER-SIDE FACTS AND ASKS NOTHING
  ABOUT WHETHER THE LEADER IS GOING ANYWHERE - third sighting of the
  wrong-actor shape.** `computeLeash()` picks the loose band on `engaged() ||
  attackersOnMe() || troubleNow.length`. Caught live: leader STATIONARY, Dexon
  171u away, `recovering` false, `moving` false, `closeAt` 180 - nobody objects
  to 171. **AND ON OPEN GROUND, DOING NOTHING, `engagedNow` WAS TRUE ALL
  SESSION**, so the travel band never applied at all and every dry-run figure
  below is the COMBAT band. Tuning `travelCloseAt` would have been near-pointless.
  Not yet built; it is item 1 of the three code changes below and the only one
  that reaches the 171u standoff, which no constant does.
- **`MOVE.staleSlack` SETS HOW TIGHTLY FOLLOWERS TRACK A MOVING LEADER, AND
  NEITHER SESSION KNEW IT EXISTED.** `recoverStep` aims at a CACHED leader point
  and refreshes it only once the leader is more than `staleSlack` (60) from it,
  so a follower in pursuit chases where the leader WAS. Measured by the browser
  session over sustained travel on the same route, varying only that constant:
  Dexon at 60 mean 44 / p50 39 / p90 73 / max 84 (n=165) against 15 giving mean
  18 / p50 16 / p90 30 / max 55 (n=121); MageofOz at 60 mean 37 / p50 35 on the
  SAME trip as Dexon-at-15 as a simultaneous control, and at 15 mean 10 / p50 3
  / max 36 (n=125). Three comparisons - sequential, simultaneous control and
  within-subject - all agreeing, and the SLOWER character tightened most, so
  speed is not the driver.
  **THE APPARENT CONTRADICTION WITH THE "CANNOT CONVERGE" CLAIM MOSTLY
  DISSOLVES, AND IT DISSOLVES FOR A REASON NEITHER SESSION EXPECTED: THAT CLAIM
  WAS MEASURED WITH A LEADER WE NO LONGER USE.** The browser session measured the
  mage holding mean 10 / p50 3 against a leader at 62-63 and flagged it as
  contradicting `CaveRun.js`, asking for a check. Checked, and the file does
  carry the claim - THREE times - but all three rest on ONE measurement, at
  `CaveRun.js:102`: "2026-10-06: Dexon 74 speed, FatherToken 59, MageofOz 55 ...
  driving Dexon gave closing rates of -15 and -19 u/s". **Its own conclusion is
  "Drive the priest", the operator did, and FatherToken has led ever since** - so
  the measurement establishing the claim was taken in the configuration it was
  written to argue AGAINST. The deficit it measured is 15-19 u/s; against the
  current leader it is 5 (resting 62 / 66 / 57).
  **AND EVERY SPEED IN BOTH SUPPORTING MEASUREMENTS IS A BUFFED SNAPSHOT, so the
  `character.speed` retraction this file already carries had never been carried
  into the code that depends on it.** 74/59/55 are instants and 74 is the exact
  figure recorded here as a buffed Dexon reading; the second site's "mage 57
  against leader 65, 8u/s of bleed" uses a buffed FatherToken whose resting value
  is 62, making it 5 u/s and the band last 12s rather than 7.5. Scoped at all
  three sites in CaveRun v20, comment-only, with nothing behavioural changed.
  **A RETRACTION IS NOT FINISHED WHEN THE CLAIM IS WITHDRAWN - IT IS FINISHED
  WHEN EVERYTHING DERIVED FROM IT HAS BEEN RE-DERIVED.** The buffed-speed
  retraction was made carefully, kept its instance, and named what it did and did
  not retract - and three live comments went on quoting the withdrawn figures,
  because nobody asked what had been BUILT on them. That is a different failure
  from rot: the correction existed and was correct, and did not propagate.
  **TWO SMALLER THINGS WORTH KEEPING.** The confound the browser session named
  themselves - the leader under `smart_move`, which paths and pauses, so his
  effective speed was below 62 - makes the deficit smaller again, so the clean
  constant-velocity re-measure is still the right next step before any tight
  number is planned on. And their cited `:470-476` points at the RIP/trouble
  comment rather than at this claim: **line numbers are build-local, and that
  citation was already stale when it was written** - the flattened all-tracked-
  files search this file prescribes is what located the real sites, a plain grep
  having missed them across line breaks exactly as recorded.
- **`closeAt` SETS THE FOLLOWER START LAG, AND IT IS ARITHMETIC:
  `closeAt / leaderSpeed + tickMs/2`.** Measured at `closeAt` 60: Dexon mean
  957ms, MageofOz mean 926ms over 8 events - IDENTICAL despite resting speeds 66
  and 57, because it is the LEADER's speed that sets it. Model says 1085ms and a
  200ms sampler detects the leader's start ~100ms late, which biases the
  measurement low by about that. **At the committed 180 that is 2.9 SECONDS
  before a follower twitches**, and the follower is not reacting late - waiting
  for `closeAt` IS his trigger.
  **THIS PRICES THE FIXED-COST-PER-HOLD ARGUMENT RATHER THAN COMPETING WITH
  IT.** Many short holds are expensive BECAUSE each pays that reaction delay;
  remove the delay and a low `holdAt` becomes affordable. The operator's spec
  and the v18 argument are the same change from two ends.
- **TWO CLAIMS THE DRY RUN KILLED, both the browser session's own.** (1) "Kiting
  is largely suppressed by a tight `releaseAt`" is FALSE - past `releaseAt` a
  kite step may hold or shrink the gap but never grow it, so kiting goes
  TANGENTIAL rather than stopping: 8 kite steps per ~70s per follower at
  `releaseAt` 30, against a cave run's own 114/65 and 154/80 `kiteRejected` /
  `kiteSteps`, a 64% rejection rate that is already the normal regime at 120. No
  health cost either. (2) The band-selector claim above retracts their drafted
  conclusion that no follower trigger could ever meet the operator's spec.
- **THREE CODE CHANGES PROPOSED, IN VALUE ORDER, AND `closeAt` 20 IS
  DELIBERATELY NOT AMONG THEM.** (1) Gate the band selector on LEADER MOTION, so
  a stationary leader uses the travel band regardless of follower engagement.
  (2) Make the no-ratchet unconditional in combat - drop the
  `gapNow > L.releaseAt` half - which is what makes tight combat numbers safe at
  all. (3) Follower start-on-leader-motion, inferred from successive
  `leaderPos()` readings since it returns `{x,y}` with no `moving` flag (a stale
  source never changes, so it fails safe to the existing band), and it needs a
  LIGHTER follow step than the `recovering` latch.
  **`closeAt` 20 IS HELD on two unmeasured risks**: it violates the oscillation
  invariant above, and `recovering` is UNINTERRUPTIBLE and stops kiting AND
  LOOTING, so followers would be near-permanently recovering. That matters
  because the cave run shows `lootOutOfRange` ~1030 against ~15 successful
  `lootCalls` on both followers - roughly 65:1 - and `attackFail` exceeding
  `attacks` on both (358/249, 378/216). **Those two are flagged as QUESTIONS,
  not defects**, because nobody has read those counters' call sites; a tight
  `closeAt` could make both worse and nothing measured so far touches it.
  **DRY RUNS ARE NOW AVAILABLE ON DEMAND** - operator's word - via `caveDry()`
  plus `caveLeash()` patching, with Chrome verified unthrottled first (40 ticks
  in 4.011s, the signature this file records). So a tuning loop no longer costs
  a day and no longer waits on a cave run, which retires the once-daily time-box
  that applied to v18.
- **ITEM 2 WAS BUILT AND REVERTED UNBUILT, BECAUSE IT CONTRADICTS A RECORDED
  OPERATOR RULING THAT NEITHER SESSION HAD IN FRONT OF IT. THE OPERATOR HAS TO
  RULE BEFORE IT CAN LAND.** Written as CaveRun v21 on 2026-10-21 - the clause
  `gapNow > L.releaseAt || L.mode === 'travel'` deleted so the no-ratchet rule
  is unconditional - and three assertions in `Tests/suite_caverun.js` went red
  on it. Not stale assertions: one of them carries **"COMBAT IS DELIBERATELY
  UNCHANGED - the operator's rule is that kite range is normal in combat and may
  be exceeded out of combat"**, and the other two pin the retreat still being
  allowed below the combat `releaseAt`. So the change removes a freedom the
  operator decided to keep.
  **THE SUITE CAUGHT A POLICY CONFLICT RATHER THAN A DEFECT, which is a use it
  was not designed for and the most valuable red it has produced.** Everything
  else this file records about the harness is about catching code that is wrong;
  this was correct code implementing an agreed plan, refused because an earlier
  decision said otherwise. **A GREEN SUITE MEANS "NOTHING I KNOW OF OBJECTS",
  AND AN ASSERTION THAT ENCODES A RULING IS THE ONLY THING THAT CAN OBJECT ON
  THE OPERATOR'S BEHALF WHEN THEY ARE NOT IN THE ROOM.**
  **AND REVERTING WAS THE CALL EVEN THOUGH THE PLAN WAS AGREED**, because the
  agreement was between the two sessions: the browser session proposed item 2,
  this session accepted the packaging, and neither of us had seen the ruling.
  Two Claudes agreeing is not an operator decision, and the tempting move -
  rewrite the three assertions to match the new behaviour - would have erased
  the only record of the ruling in the process.
  **THE TENSION IS REAL AND WORTH STATING PRECISELY, so the operator is not
  asked a vague question.** The ruling is about kite RANGE: in combat the band
  is 180/120 and a follower may stray further. Item 2 does not narrow that band
  - it removes DIRECTION freedom, so a follower inside `releaseAt` could
  retreat from a threat and no longer could, kiting tangentially instead. So the
  two are not flatly contradictory, and the question is whether "kite range is
  normal in combat" was meant to cover retreating at close range or only the
  width of the band. Against allowing it: the oscillation mechanism lives
  exactly there, and a tighter combat band is unsafe until it is gone. For
  keeping it: kiting is a survival mechanism and the mage has died to a single
  attacker before.
  **ITS PROVENANCE IS THIN AND THAT IS RECORDED RATHER THAN USED AS A REASON TO
  OVERRIDE IT.** Searched every tracked file at the revision,
  whitespace-flattened: the ruling appears ONCE, in that test comment, and
  nowhere in `CLAUDE.md`, `CaveRun.js` or any changelog. So it is single-sourced
  and undated, which makes it worth re-confirming with the operator - but a
  thinly-sourced ruling is still a ruling, and "I could only find it in one
  place" is not authority to reverse it.
- **THE OSCILLATION FIX FELL OUT OF ALL THREE QUEUES AT ONCE, AND THAT IS A
  SHARPER FORM OF "A FIX NOBODY IS NAMED FOR IS A FIX NOBODY MAKES".** On
  2026-10-21 this session's queue read "skip row, then (c), then banking", the
  browser session's read "nothing", and the operator's read "nothing
  outstanding" - while the most expensive measured defect in the repo (40% of a
  cave run stopped) sat unbuilt and unmentioned in all three. The earlier rule
  says to name an owner when a handoff mentions a fix; this instance adds the
  detection method, because naming failed here by OMISSION rather than by
  dispute. **It was caught by reading all three lists TOGETHER** - the browser
  session noticed the gap between them, not inside any one of them, exactly as
  the skip row was. So the check is cross-queue and belongs to whoever writes
  the status block, since a queue cannot report what is missing from itself.
- **AND IT WAS TIME-BOXED WITHOUT ANYONE SAYING SO.** The operator is holding
  Option B until a cave run on the updated script, and the cave is ONE RUN PER
  DAY - so the separation landing before that run buys a measurement against a
  baseline already in hand, and landing after it costs 24 hours and re-measures
  the same baseline. A dependency on a once-daily event is a deadline even when
  nothing in the handoff is phrased as one.
- **WHY v15 HELPED WITHOUT FIXING IT, which also kills a mode-disagreement
  theory.** `computeLeash()` returns the travel band only when NOT engaged, and
  `engaged()` is a recency timer. Measured: leader engaged 35% of ticks,
  followers 81% - so the followers ran on the COMBAT band 81% of the time and
  v15 tightened the band that applies to the other 19%. `travelLeashTicks` is
  the complement of `engagedTicks` BY CONSTRUCTION, so the 64/18 split that
  looked like the two sides disagreeing about mode is an ENGAGEMENT difference:
  the leader walks past mobs the followers aggro.
- **OPERATOR'S CALL: DO NOT MAKE THE LEADER STOP FOR ORDINARY FOLLOWER
  COMBAT.** Followers handle cave mobs fine and stopping for each would likely
  be slower overall. A proposal to treat a mate's beacon `atk >= 1` as
  engagement was WITHDRAWN for two reasons worth keeping: mechanically it aimed
  at the wrong function, since `engaged` only selects which leash BAND the
  leader uses while the hold reads `MOVE.*` regardless; and the path is already
  wired - the hold already reads `troubleNow.length`, the beacon already
  publishes raw `atk` and `hpFrac` every 250ms, and TROUBLE gates them at
  `atkAt` 3 / `hpAt` 0.55. Deliberately conservative, and the operator's
  position is that those thresholds already catch what needs catching.
- **DOOR TRANSITIONS WORK: doorTry 2 / doorOk 2 on Dexon, 1/1 on MageofOz,
  leader 0/0.** Three transitions, three successes, zero failures. That closes
  the door question.
- **CaveRun's `ver` FIELD IS A STALE LITERAL AND IT COST A WRONG DEPLOY
  REPORT.** `ver: 14` is hardcoded in THREE places - the dump, the load event
  and the `clog('v14 loaded as ...')` line - while v16 was live, and nothing
  derives from it, so it is a lie rather than a defect. This bullet said TWICE
  until v17 fixed it, because a `ver:` search finds the two FIELDS and not the
  string that prints the number to a human on every load. It was believed over feature detection, and the second signal that
  agreed with it measured nothing either: `noDoor` is NOT A COUNTER but an
  `ev('noDoor', lm)` event, so its absence from a counter table was never going
  to mean anything. The live leash settled it from the MECHANISM - travel 60/30
  and combat 180/120 are exactly v15's values, where v14 was 120/60.
  **Feature-detect, not version-detect**, demonstrated on the session that
  wrote the rule.
- **FIXING THAT FIELD HAS TWO TRAPS THE MERCHANT'S RECIPE DOES NOT COVER.**
  Porting `merchantHeaderVersion()` is right in principle - CaveRun is
  IIFE-wrapped, so a reader outside it CANNOT feature-detect its internals and
  the dump is the only window, which is the whole argument for having an
  honest version field at all. But: (1) the marker is on LINE 1, not line 2,
  and the line ends `(TEST BUILD)`, so an end-anchored `/\bv(\d+)\s*$/`
  returns null - anchor on the file marker instead, `/^\/\/ CaveRun\.js\b.* -
  v(\d+)\b/`, line 1 only; and (2) **CaveRun is a ROOT script, so it is NOT
  covered by the current-version-only rule and its header ACCUMULATES
  HISTORY** - 13 lines match `^// v<digits>` as of v17, so any read taking the LAST match
  returns the OLDEST entry, which is precisely the OpenGifts failure that
  returned 2 against a v11 build. Line 1 only, never a header scan. The retry
  requirement carries over unchanged, and the pre-slot failure is FAIL-NULL
  because the tutorial template's line 1 does not match `CaveRun.js`.
  **DONE IN CaveRun v17, AND THE RECIPE WAS WRONG ABOUT THE COUNT: THERE WERE
  THREE LITERALS, NOT TWO.** `clog('v14 loaded as ...')` is a third
  hand-maintained 14 that a `ver:` search does not find, and it is the one a
  human actually READS on every load - so the count this file gave would have
  left the most visible copy stale. A search shaped by the field name missed
  the string that prints it.
  `caveHeaderVersion()` anchors on the FILE MARKER for both traps above, and
  `caveDump()` now reports line 1 VERBATIM as `build`, which is the point:
  text over any hand-maintained number. This was the THIRD stale version
  literal in the project after the v89 header and `MERCHANT_VER`.
  **THE MARKER IS LOAD-BEARING IN TWO PLACES INDEPENDENTLY**, found by
  mutation rather than by design: it gates the line AND it sits inside the
  version pattern, so deleting either one alone still fails null. The three
  traps are pinned in `Tests/suite_caverun.js` with their inverted assertions
  kept beside them - a header scan returning the OLDEST entry, the merchant's
  end-anchored pattern matching nothing here, and an unmarked pattern reading
  a foreign buffer's version - so the pairing cannot be half-reverted. The
  suite also pins the COMMITTED line 1 against the reader, because every other
  fixture is synthetic and a reshaped header would otherwise go null forever
  with the suite still green.
- **THREE SMALLER FINDINGS, noted rather than claimed.** `kiteRejected` exceeds
  `kiteSteps` on both followers (137/56 and 159/44), so the
  `gapNew > gapNow + 1` guard fires most times it is consulted - unknown
  whether correct or over-tight. `noTargetWhileEngaged` 2,687 on Dexon, 44% of
  ticks. And `friendly_target` 324 on the priest (175 attack, 149 curse) is the
  SERVER'S REFUSAL REASON, not a record of attacking friendlies - cave NPCs
  flip hostile/friendly with the choices and are reused, so it is expected
  noise; the only open question is whether those refusals displace real
  attacks, which the counts cannot answer.

## The published event schedule - upstream's new mechanism

**Both sessions.** Read from upstream source 2026-10-21 at `43b2c8fc`, after
the operator's fork was fast-forwarded to it. **SOURCE-DERIVED, SO EVERY CLAIM
HERE IS A LEAD ABOUT THE LIVE GAME AND NOT A FACT ABOUT IT** - the standing
rule under "Claims about the live game client" applies in full, and the live
probes are listed at the end as still-open.

- **THE GAME NOW PUBLISHES A SEVEN-DAY EVENT LINEUP, which replaces inference
  with a read.** `node/logic/event_schedule.js` (server) with a client copy at
  `js/event_schedule.js`. Its own opening line: "The published event lineup:
  seven days of named occurrences on the realm clock." It reaches the client as
  **`server.status.schedule`, i.e. `S.schedule`** - `S.schedule.events` is the
  lineup and `S.schedule.server_time` exists so a consumer can correct its own
  clock (`schedule_offset = S.schedule.server_time - Date.now()`).
  **`S.schedule` IS RIGHT FROM THE CLIENT'S SEAT AND NAMES A DIFFERENT OBJECT
  ON THE SERVER, WHICH IS WORTH STATING BECAUSE BOTH ARE REAL.** Read from
  upstream `16881a27` on 2026-10-21. Server-side there are TWO: `S.schedule` is
  the internal PERSISTED state (`{version, offset, queues, until, occurrences,
  slots, seasons}` - the rotation queues and every occurrence's mutable status),
  while `E.schedule` is the PUBLISHED one. `broadcast_e()` does
  `Object.assign(E.schedule, event_schedule_state().publish())` and then
  `broadcast("server_info", E)`; the client's handler is
  `socket.on("server_info", data => { S = data; ... })`, so **the client's `S`
  IS the server's `E`**. That reconciles the two readings and explains why
  `js/game.js` can read `S.schedule.time_offset`, a field the server's own
  `S.schedule` does not have.
  **SO THE BRIDGE ALREADY HOLDS THIS, AND NOT BY ANALOGY: `_on_server_info` IS
  HANDED THE SAME `E` OBJECT A CHARACTER TAB CALLS `S`.** No new connection, no
  new polling, no character involved - the lineup has been arriving and being
  dropped on the floor.
  **THE LEGACY FIELDS SURVIVE THE `Object.assign` AND ARE NOW INERT.**
  `E.schedule` is initialised `{time_offset, dailies: [13, 20],
  nightlies: [23], night}` and `publish()` returns none of those keys, so all
  four persist alongside the new ones. `time_offset` and `night` are still
  written and read; **`dailies` and `nightlies` are read by NOTHING** - the
  `last_daily`/`last_nightly` firing loop they served has been DELETED (a grep
  for either name across `node/` and `js/` returns nothing), and with it the
  shared-variable quirk `Codex/market_bridge.py` recorded as "latent rather
  than live". Events now fire from `event_schedule_tick`. A consumer reading
  `schedule.dailies` gets the right hours for the wrong reason and learns
  nothing about the three seasonal slots.
- **AN OCCURRENCE IS `{ id, event, at, status }`** plus optional `pool`,
  `season`, `repeat` and `late`. `event` is the event NAME and `at` is a UTC
  MILLISECOND timestamp, so "which event, on this shard, at what absolute time"
  is answered directly. Statuses seen in the source include `scheduled`,
  `live` and `missed`; `LATE` is one hour (a restart at 13:20 still runs the
  13:00 slot, never later) and `KEEP` is six hours (finished and missed stay
  visible that long).
  **THAT IS THE INTERNAL OCCURRENCE. `publish()` EMITS A NARROWER ONE, AND THE
  DIFFERENCE IS EXACTLY THE FIELDS A CONSUMER WOULD REACH FOR.** The published
  entry is `{id, event, at, status}` plus `season`, `started` and `ended` when
  set - it carries **no `pool`, no `repeat`, no `late`**. Those three live only
  on the state object, so a consumer cannot tell from the payload which pool an
  occurrence came out of, nor that an entry is a repeat. Read off a character
  tab or the bridge you get the narrow shape; `pool` is reachable only from the
  server's `S.schedule.occurrences`, which nothing outside the process sees.
- **THE PUBLISHED PAYLOAD HAS FOUR KEYS AND `events` IS NOT ALL OF IT. A
  `repeat` SLOT NEVER APPEARS IN `events` AT ALL.** `publish()` returns
  `{realm, server_time, events, repeats}`. `graveyard` is the only `repeat: true`
  slot, so it is in `repeats` as ONE line - the live occurrence, else the
  earliest scheduled - carrying an extra `every` field, `DAY / hours.length`,
  which is 7,200,000 ms. **Pinned by the creator's own test rather than
  inferred**: `node/test/event_schedule.test.js` asserts
  `events.some(o => o.event === "graveyard") === false` and
  `repeats` deep-equal `[["graveyard", <at>, 2 * HOUR]]` in the same block that
  pins 14 witchcipher entries over seven days. So a consumer reading only
  `S.schedule.events` sees Graveyard Rising **never**, and nothing about the
  absence looks like a missing field - this is the `never_observable` shape
  again, where the data is complete and the obvious read of it is not.
  Expanding graveyard's twelve daily occurrences means `at` plus `every`, which
  the payload gives; it does not need the slot table.
- **SO THE BRIDGE SHOULD NOT MIRROR `SLOTS`, AND THE PROPOSAL TO DO SO WAS
  AIMED AT A PROBLEM THE PAYLOAD HAS ALREADY SOLVED.** The structural
  complaint was sound - `schedule_windows()` iterates two hardcoded
  `(label, hours, events)` pool tuples and genuinely cannot express a dedicated
  hour, a `:30` minute offset or a seasonal slot. But mirroring the table would
  re-derive, from constants that have to be kept in step with a file this
  container is the only one that can read, what the lineup already states
  outright: **every occurrence named, with an absolute UTC `at`, seven days
  ahead, per shard.** The hour/offset/pool arithmetic becomes dead weight
  rather than a fourth special case. Mirror `SLOTS` only for the one thing the
  payload drops - expanding a `repeat` line - and `at` plus `every` covers even
  that. **THE HOURS TABLE IS STILL NEEDED FOR `--boss-source aldata`**, which
  fetches `monsters/<types>` and carries no schedule, so it is a fallback and
  no longer the mechanism.
- **`SLOTS`' FIELD SET, FOR THE FALLBACK AND FOR READING THE SOURCE.** Seven
  fields, `hours` the only required one: `hours` (realm hours, iterated
  unconditionally), `minute` (realm minute, `slot.minute || 0`), `pool` (a
  rotation queue name), `event` (a fixed event), `season` (gated by
  `season_open(season, at)`), `repeat` (shown as one published line) and `late`
  (per-slot override of the one-hour `LATE`; graveyard's is 600,000 ms). The
  five live slots are the two pools, `witchcipher` at realm 6/18, `horseman` at
  realm 0, and `graveyard` at the twelve odd realm hours, minute 30.
- **POOL MEMBERSHIP IS NOT IN `SLOTS`, AND THE BRIDGE'S DAILY POOL WAS 3 OF 4.**
  `pools` is a separate argument to `create_schedule`, supplied from
  `node/server.js` as `dailies = ["crabxx", "goobrawl", "abtesting",
  "witchcipher"]` and `nightlies = ["icegolem", "franky"]`. **witchcipher is a
  DAILY pool member**, skipped only while its own seasonal slot is open, so
  after Halloween it rejoins the 13/20 rotation with nothing else changing -
  which makes the dailies pool FOUR, and `SCHEDULE_DAILY_EVENTS` named three
  until 2026-10-21. Both lists are still `shuffle()`d at boot, but that now
  sets only the INITIAL queue order: `create_schedule` keeps the saved order
  for known events and appends new ones, so the shuffle is the starting phase
  and a restart does not reshuffle a saved lineup.
- **IT IS PER-SHARD, NOT PER-REGION, AND THAT DECIDES WHO CAN COLLECT IT.**
  `create_schedule` is called with `realm: region + server_name` and its output
  is stored back as `S.schedule`, which is also passed in as `saved` - so each
  shard process owns and persists its own lineup. A character therefore sees
  ONE shard's lineup, its own. Enough to know when the window it is standing in
  ends; NOT enough to choose between shards, which is what prepositioning needs.
- **THE ROTATION IS A SAVED ROUND-ROBIN QUEUE, AND THAT EXPLAINS THE 13-OF-13
  ALTERNATION RATHER THAN REPLACING IT.** `SLOTS` declares
  `{hours:[13,20], pool:"dailies"}` and `{hours:[23], pool:"nightlies"}` -
  exactly the game-hours this file measured empirically, now stated in
  source.
  A pool pick does `queue.splice(pick, 1)` then `queue.push(event)`, so a
  TWO-ELEMENT nightly pool IS exact alternation: the operator's model was right
  and is now explained. Two refinements the bare model does not carry: the
  queues live in the server's SAVED data ("a restart neither reshuffles what
  players were shown nor starts an occurrence twice"), which is why a restart
  resets the apparent alternation; and there is a SWAP rule - an event that ran
  at this hour last time trades places with the next in line when that one ran
  at another hour, so an even pool still moves every event between the slot
  hours. A naive "it alternates" would mispredict a pool larger than two.
- **HALLOWEEN ADDS ITS OWN SLOTS**, which is why the nine-window picture is not
  the whole lineup any more: `witchcipher` at realm hours 6 and 18 (two rounds
  twelve hours apart so other time zones can play, one daily limit covering
  both), `horseman` at hour 0, and `graveyard` every two hours at minute 30 as a
  `repeat` slot with its own shorter `late` of ten minutes. A pool skips an
  event while that event's own seasonal slot is open.
- **SEASONS ARE NOW CENTRALISED WITH EXACT END TIMES**, in the new
  `design/event_flags.js`: `event_flags` holds the booleans (anniversary,
  holidayseason, lunarnewyear, valentines, egghunt, halloween), `event_ends`
  holds a UTC end per season, and `get_event_flags(gameplay, now)` switches a
  season off once past it. `event_flag_overrides` gives hardcore the egghunt and
  disables every season in dungeon. At `43b2c8fc` halloween was the open season
  with an end of `2026-11-03T00:00:00.000Z` (last day November 2). Per this
  file's own rule, that is what the SOURCE said at that commit and not a claim
  about what the operator's live realm is running.
  **`lunarnewyear` was still false**, so dragold stays gated - but the END of a
  season is now published once it opens, while the START is still a deploy-time
  flag flip. So the dragold entry's "the in-game start is unknown" still holds,
  and "when does it end" stops being unknown the moment it begins.
- **THE BRIDGE ALREADY RECEIVES THIS AND THROWS IT AWAY.** In `server_info`
  mode `BossWatch` holds a `ServerInfoClient` per server and
  `_on_server_info(server, payload)` is handed that shard's WHOLE `S` object -
  the handler's own comment already names `schedule` as one of its fields.
  `server_info_entries()` extracts boss entries and the rest is dropped, so a
  seven-day lineup per shard has been arriving and being discarded. Reading it
  is additive: no new connection, no new polling, no character involved.
  **CONDITIONAL ON THE MODE, THOUGH.** `--boss-source` chooses `server_info` or
  `aldata`, and the ALData path fetches `monsters/<types>` only - a monster
  list with no schedule in it. So the bridge can collect this in one mode and
  cannot in the other, and which one is running is the operator's to say.
- **THE BRIDGE IS STILL THE RIGHT COLLECTOR, BUT THE COST ARGUMENT FOR IT WAS
  WRONG AND THE OPERATOR CORRECTED IT.** This bullet said sending the merchant
  round the shards "would cost him Hop Sickness per shard". **HOPPING COSTS THE
  MERCHANT EFFECTIVELY NOTHING, AND THIS FILE ALREADY SAID SO** - see the
  merchant exemption under "Server hopping": he never takes Realm Fatigue and
  never inflicts either condition on the party, and Hop Sickness's `luck`/`gold`
  penalties apply to LOOTING, which he does not do. He is ALREADY hopping
  continuously for scouting and arbitrage, so a schedule read on a shard he was
  visiting anyway is free. Writing a cost argument that the file refutes three
  sections earlier is the same failure as the `ev=despawn` design: the answer
  was on the page and the freshly-active reasoning won.
  **THE REAL ARGUMENT IS SIMULTANEITY, NOT COST.** A merchant visit yields ONE
  shard's lineup at ONE moment; the bridge holds a socket to every shard at
  once and sees all of them continuously, which is the thing no character can
  do. That argument survives the correction intact, and it is the only one that
  was ever load-bearing. The merchant becomes a genuinely useful SUPPLEMENT
  rather than a fallback - he can confirm a shard's lineup from inside the game
  while he is there, which is an independent check on the bridge's copy, and
  the only route at all if the bridge is running `--boss-source aldata`.
- **TWO OF THE THREE HALLOWEEN EVENTS ARE PUBLISHED AS BOSS ENTRIES AND ONE IS
  NOT, WHICH TURNED A TWO-NAME CHANGE INTO A ONE-NAME CHANGE.** The plan was to
  add `horseman` and `gargoyle` to `BOSS_TYPES` so the events stopped being
  UNOBSERVED. Measured from source instead of assumed:
  **`horseman` IS published.** It is the fourth name in `server_functions.js`'s
  `["crabxx", "franky", "icegolem", "horseman"].forEach(...)` loop, assigned
  `E[name] = {live, map, hp, max_hp, target, x, y, end}` - the exact shape
  `server_info_entries` already translates - and `event_schedule_tick` sets
  `events.horseman = true` to start it. So one name in `BOSS_TYPES` is the
  whole change, and it landed.
  **`gargoyle` IS NOT, AND ADDING IT WOULD HAVE POLLED A KEY THAT NEVER
  EXISTS.** Graveyard Rising publishes under the EVENT's key -
  `E.graveyard = graveyard_public()` in `node/logic/halloween_events.js` -
  and there is no `E.gargoyle` at all.
  **AND THE OBVIOUS REPAIR IS WORSE THAN THE GAP.** Adding `"graveyard"`
  instead would pass `server_info_entries`' `d.get("live")` test from the first
  wave onward, because `graveyard_public()` returns `{live: true, map, x, y,
  start, wave, waves, left}` and only `Object.assign`s `{gargoyle: true, hp,
  max_hp, target, end}` once the Gargoyle wakes - so it would record `hp: None`
  for the first several minutes of every graveyard. That is "a null from a field
  you never confirmed exists", which this file already carries as a finding
  published and retracted within the hour. Collecting it needs a translation
  branch keyed on `gargoyle: true`, not a name in a list.
  **"THE FIRST SEVERAL MINUTES" WAS NINE MINUTES OF TEN - 540 of 714 live
  samples carried no hp at all**, measured 1 Hz on EU IV 2026-10-21. The
  estimate was wrong by half and the gating it argued for was right, which is
  the better half of being wrong.
  **BUILT 2026-10-22 as `graveyard_entries()`.** `gargoyle` IS in `BOSS_TYPES`
  now, but as a DECLARATION OF INTEREST rather than a polled key: the branch
  honours the name and the main loop is made to skip it by `BRANCH_ONLY_TYPES`.
  That skip is unreachable today and exists because the test asked for it -
  `"gargoyle"` in `wanted` meant the main loop matched a literal top-level
  `gargoyle` key, so the day the creator publishes one it would emit a SECOND
  entry for the same monster in the ordinary boss shape, without `end` or
  `spawnInRageBox`. **A DUPLICATE IN A DIFFERENT SHAPE IS WORSE THAN A MISS AND
  NOTHING ABOUT IT WOULD LOOK WRONG**; it was found by writing the assertion,
  not by reading the loop.
  **THE ROW CARRIES `spawnInRageBox: true`, WHICH IS A FIELD BECAUSE A COMMENT
  COULD NOT REACH THE READER WHO NEEDS IT.** The browser session asked for "a
  field or a note, or the chain queue will one day route three characters at a
  6,000,000 hp cooperative gargoyle sitting inside a rage rectangle" - and a
  consumer reads JSON, not this file. It publishes the FACT (the fixed spawn
  (255,-1545) is inside spookytown's mummy rage rectangle) rather than the
  judgement (unreachable), because the rectangle is game data and the
  reachability verdict belongs to whatever script is doing the routing.
  **THE HALF-FINDING IS THE REUSABLE PART: A SET OF NAMES TO POLL IS ONLY AS
  GOOD AS EACH NAME BEING A KEY THE PUBLISHER ACTUALLY WRITES**, and nothing in
  a monster's existence, its hp, its cooperativeness or its event membership
  implies that. Two names from one event, both real monsters, and only one is
  addressable - by a branch, once one was written.
- **`SCHEDULE_OBSERVABLE` IS NOW DERIVED FROM WHAT IS POLLED, AND THE OLD FORM
  WOULD HAVE GOT `graveyard` WRONG.** It was
  `{"crabxx", "icegolem", "franky"} | set(SCHEDULE_SPAWNS)`, which took an
  event's PRESENCE in the spawn map as proof that something it spawns is
  polled. graveyard has three spawns and not one of them is in `BOSS_TYPES`, so
  that form calls it observable and the derived form does not. **The
  `never_observable` lesson one level deeper** - there the field's NAME claimed
  more than its computation, here the computation itself assumed its own input.
  Asserted as a one-directional soundness invariant ("nothing is called
  observable without a polled monster behind it") rather than as an expected
  set, because a literal set is what broke when these two events landed and
  would break again on the next one while saying nothing about the rule.
  Measured by mutation: reverting the derivation fails three assertions,
  dropping `horseman` fails one.
  **AND IT PAID OFF ON 2026-10-22 WITHOUT BEING TOUCHED.** `graveyard` flipped
  to observable the moment `gargoyle` joined `BOSS_TYPES`, because the rule
  re-ran on a changed input - no edit to the derivation, and the two assertions
  that recorded the old answer were rewritten rather than deleted, since what
  they pinned was the mechanism and only one input moved. A hand-maintained set
  would have needed an edit nobody would have remembered to make, and would
  have gone on reporting `false` beside a working collector.
- **ANSWERED 2026-10-21 FROM THE DEPLOYED CLIENT, EU IV, AND EVERY
  SOURCE-DERIVED CLAIM IN THIS SECTION HELD.** The browser session read
  `S.schedule` live. Keys: `time_offset`, `dailies`, `nightlies`, `night`,
  `realm`, `server_time`, `events`, `repeats` - so the published fields and the
  INERT legacy ones sit side by side exactly as the `Object.assign` predicted.
  `events` 45 entries carrying `{id, event, at, status, season, started,
  ended}`, `at` spanning 2026-10-21T17:00Z to 2026-10-28T22:00Z (7.21 days) as
  absolute UTC ms. `realm` "EUIV" IS the connected shard, so PER-SHARD is
  confirmed from the client as well as from the source. `graveyard` absent from
  `events` - the creator's own test assertion reproduces live - and `repeats`
  holding exactly ONE entry, `every` 7,200,000, with `every` present on the
  published entry as predicted. Counts: horseman 7, witchcipher 15, crabxx 5,
  goobrawl 5, abtesting 5, franky 4, icegolem 4 - **horseman 7-in-7-days is the
  nightly dedicated slot confirmed from data.** That closes (1), (2) and (3)
  below; only `--boss-source` remains, and it is the operator's to say.
  The mirror proposal is withdrawn by its own author on this read.
- **GRAVEYARD'S TWELVE DAILY WINDOWS ARE GLOBALLY SIMULTANEOUS, SO THERE IS NO
  REGIONAL STAGGER TO CHAIN.** The browser session's finding: every shard in
  every region opens graveyard at the same even-UTC `:30`, twelve times a day,
  all coincident - so hopping between regions for graveyard gains NOTHING, and
  the twelve occurrences are twelve chances at one clock rather than thirty-six.
  **THE MECHANISM IS A PARITY COINCIDENCE AND NOT A STRUCTURAL PROPERTY, which
  is worth separating because only one of those is durable.** `UTC = realm -
  offset`, graveyard runs at ODD realm hours, and all three regional offsets are
  ODD - `TIMEO = {EU: 1, US: -5, ASIA: 7}` - so odd minus odd is even in every
  region. Computed rather than eyeballed: all three produce exactly
  `[0, 2, 4, ..., 22]`. **A fourth region with an EVEN offset would stagger
  graveyard immediately**, and nothing in the schedule code would need to
  change for that to happen - so record the simultaneity as contingent on the
  offset table, and re-derive it if `TIMEO` ever grows.
- **READ LIVE FROM A CHARACTER'S CODE CONTEXT, 2026-10-22T17:17Z, US II - SO
  QUESTION (2) IS ANSWERED FROM THE SEAT THAT MATTERS AND THE SCHEDULE IS
  USABLE BY THE SCRIPTS, NOT ONLY BY THE BRIDGE.** `parent.S.schedule` on Dexon:
  `realm` USII, `time_offset` -5, `server_time`, 43 `events` entries carrying
  `{id, event, at, status}` plus `season`/`started`/`ended`, and ONE `repeats`
  entry. **IDs ARE `USII-2026-10-22-1300-goobrawl` - realm date and REALM
  HOUR**, so the offset arithmetic both sessions have been doing from memory is
  published: realm 13 at offset -5 IS 18:00Z, which is where the logged
  goobrawl detection at 18:01:58 sits, and realm 0 IS 05:00Z, which is this
  morning's six-shard horseman spawn.
  **THE DAILY SLOTS ROTATE AND THE NIGHTLY ALTERNATION IS A SPECIAL CASE OF
  IT.** Realm-13 was goobrawl on the 22nd and crabxx on the 23rd; realm-20 was
  abtesting then goobrawl. So "a server's nightly alternates unless it has been
  restarted" is a hand-built model of something the server states outright,
  with `status` attached - which SUPERSEDES `/schedule` (whose own source is
  labelled "NOT measured live") and supersedes preposition-by-base-rate for
  anything on the list. **A QUEUE CAN READ ITS DEADLINES INSTEAD OF ESTIMATING
  THEM.**
  **AND `graveyard` IS IN `repeats` AND NOT IN `events`, LIVE, exactly as the
  creator's own test asserts** - so a consumer reading only `events` sees the
  whole schedule except the graveyard. Third sighting of this shape after
  `never_observable` and goobrawl's missing `live`: the data is complete and the
  obvious read of it is not. Read both arrays.
- **`duration` IS EVENT END MINUS EVENT START, AND THE "DESPAWN CLOCK" READING
  OF IT IS RETRACTED BY ITS OWN AUTHOR.** `S.witchcipher` published
  `start`/`end` 1,680,000 ms apart against `G.events.witchcipher.duration`
  1680 - exact. So the plain reading covers every observation: the EVENT runs
  for `duration`, and monsters it spawned can be fought after it ends. That is
  why franky died at 2,628s and horseman at 2,971s while untouched bosses go at
  2402-2556, and it needed no arrival-deadline theory to explain. **A MODEL THAT
  FITS THE DATA IS NOT THEREBY THE MECHANISM**, and this one was reasoned off
  the despawn cluster rather than read.
  Nothing in the classifier changes - `BOSS_DESPAWN_*` were measured against the
  window rather than derived from a theory of it, which is why the retraction
  costs nothing. **THE GRAVEYARD IS WHERE IT DOES BITE**: duration 600, the
  gargoyle wake gated at `duration - 60`, and `gargoyle_end` stamped FRESH at
  wake, so legitimate content runs to ~1,160s against a 600s window and a row
  from the gargoyle phase sits inside a window that already expired once.
- **ANSWERED 2026-10-22: THE BRIDGE IS IN `server_info` AND ALWAYS HAS BEEN, SO
  THE SCHEDULE STORE IS UNBLOCKED.** `BOSS_SOURCE = "server_info"` is the
  argparse default and the operator runs `python market_bridge.py --state
  scouts.json` with no `--boss-source`, so the default applies. The dependency
  was satisfied before either session asked about it, and nothing needs
  changing.
  **AND ALDATA'S PROVENANCE IS WHY IT IS NOT A PEER SOURCE.** The operator's
  own context: it is a community service written by someone on Discord so
  humans could parse game data and the market, and THIS BRIDGE EXISTS BECAUSE
  THEY WANTED MORE SPECIFIC DATA THAN IT OFFERS. So `aldata` is the generic
  tool the bridge was built to exceed - 45s polling, max_hp inferred from the
  largest value seen, no schedule, and it has already returned a 429. Using it
  to look up prices is a different risk class from putting it in the loop that
  decides where three characters travel, and `Crowns3bc/` is already the
  recorded precedent for a community repo going away.
- **STILL OPEN - NOTHING, AND THE ITEM BELOW IS KEPT AS THE INSTANCE.** Which
  `--boss-source` the bridge is running: `server_info` carries the schedule and `aldata` fetches
  `monsters/<types>` with no schedule in it, so the bridge can collect this in
  one mode and cannot in the other. Nothing should be built on collecting it
  until that is settled. The three questions below were ANSWERED by the live
  read above and are kept as the instance.
  (1) Does the DEPLOYED game carry this at all - `43b2c8fc` landed hours before
  this was written, and the live realm may lag the source. (2) Is `S` reachable
  from a CHARACTER's CODE context? This file documents `S` on /hub and nothing
  establishes it inside CODE. (3) If it is, does a character's `S` describe its
  OWN shard? On /hub `S` reports the MONITORED server and NOT the server any
  character is on, so the semantics differ by page and that asymmetry is exactly
  the trap to check rather than assume. (4) Which `--boss-source` the bridge is
  running. Nothing should be built on this section until (1) and (4) are
  measured.

## Trick or Treat

**Both sessions.** Read from upstream `16881a27` on 2026-10-23, so SOURCE-
DERIVED and a lead about the live game. The operator wants it; nothing existed
for it in any script before Ranger v121 / Merchant v115.

- **THE CAP IS PER ACCOUNT, NOT PER CHARACTER - 14 knocks, 7 doors.** So two
  characters covering all seven doors each hits it exactly and a third
  contributes nothing. That is the allocation rather than a tuning choice, and
  the operator had assumed per character.
- **THE LIMIT IS READABLE BEFORE KNOCKING, NOT ONLY DISCOVERABLE BY HITTING
  IT.** `trick_or_treat_status(player)` is published as `character.trickortreat`
  = `{doors, doors_left, stamps}`, and `doors_left` is
  `min(7 - mine_today, account_knocks_left)` - so one field answers both "this
  character has done them all" and "the account is out", with no counter to
  drift and no UTC-midnight bookkeeping. A reject-driven loop works and is
  strictly worse: it spends a round trip to learn what is already on the
  character.
  **IT IS REFRESHED ONLY ON THE KNOCKER'S OWN SHARD**, though -
  `trick_or_treat_settle` walks `for (var id in players)` after a knock - so a
  sibling on ANOTHER shard carries a stale `doors_left` until it knocks. Fine
  for a co-located party and exactly the trap if one is away.
- **THERE IS A FIFTH REJECT REASON THE CONTRACT DOES NOT LIST: `cant_in_bank`**
  (`if (player.user)`), beyond `trickortreat_season`, `_door`, `_knocked` and
  `_limit`. That matters for the ranger banking work, which is queued and would
  put a character in exactly that state mid-route. A loop that advances on
  `knocked` and stops on `limit` has no branch for it.
- **A `limit` REJECTION DOES NOT CONSUME THE DOOR.** The door is claimed into
  `record.doors` BEFORE the account check and rolled back with a `splice` on
  failure, so a knock refused by the cap can be re-tried tomorrow at the same
  door. The claim-first order is deliberate - its own comment says it stops a
  second request doubling up.
- **PROXIMITY IS 80 UNITS, not standing on the tile.** `trick_or_treat_door`
  takes the nearest door on the character's own map within 80, so the route has
  real tolerance and `knock()` can be called without a precise park point.
- **THE COSTUME MUST BE EQUIPPED AND THE SLOT IS THE GAME'S CHOICE.** The test
  is `player.slots.helmet` against `G.events.trickortreat.costumes`, and
  phelmet, gphelmet and horsemanpumpkin are all `"type":"helmet"`. Holding one
  does nothing. 85% treat against 70% bare - +15 points flat, about +21%
  relative.
- **THE TREAT TABLE IS A SECOND SUPPLIER OF THE WITCH'S CIPHER INGREDIENTS.**
  `[[50,"candy1",3],[20,"candy0",1],[5,"verdantspore",2],[5,"frostscale",2],
  [5,"embercoal",2],[5,"gloomfeather",2],[10,"witchparcel",1]]` - those four
  are exactly the names the witchcipher entry already says must not be
  vendored, so the sell-protection question there now has two sources feeding
  it rather than one.
- **`stamps` IS A REWARD LADDER, NOT JUST A READOUT**: `{"parcel":10,
  "laugh":40}`, account-wide and keyed by YEAR (`stamps:<owner>:<year>`), so
  every 10th knock pays a Witch's Parcel and the 40th a Sinister Laugh jar.
  That is an argument for running the route daily rather than opportunistically
  - and it is still not the cap signal, which is `doors_left`.
- **GEOGRAPHY FAVOURS IT**: 5 of the 7 doors are on spookytown, where the party
  already goes for graveyards, mummies and mrgreen; only 2 are on halloween.
- **THE COST IS A GHOST.** Tricks are 15% costumed, `[[1,"spooked"],
  [1,"ghost"]]` so half of those, `ghost_time` 120 - about one ghost per
  14-knock run and two minutes of it. That argues for running the route right
  after the 00:00Z reset rather than inside a boss window.
- **PROTECTING THE EQUIPPED PIECE NEEDS NO CODE AND THE EXPOSED ONE IS THE
  OPPOSITE OF WHAT IT LOOKS LIKE.** Every sell path on both characters iterates
  `character.items`; `character.slots` is never a sell source. So what is at
  risk is whichever helmet is NOT worn - the costume between routes, and THE
  NORMAL GEAR during one. The costumes are protected as of Ranger v121 /
  Merchant v115; the normal gear is NOT, because
  `CONFIG.selling.whitelist` names `helmet`, `helmet1`, `hhelmet` and
  `oxhelmet` against a `sellItems()` with no level check, that whitelist is the
  operator's and CLOSED, and the right guard is on what came OFF - state the
  equip code owns and the equip code does not exist yet.
- **STILL OPEN, AND BOTH ARE THE BROWSER SESSION'S**: whether equip/unequip
  round-trips cleanly mid-route, and what a ghost landing between the two does
  to the swap.

## Testing

- **There IS one now: `node Tests/run.js`.** This section said there was no
  harness until 2026-10-18, and the reasoning it gave is why there is one:
  both missing-helper bugs above were invisible to reading and obvious the
  instant anything executed. Neither is reachable by a static check. 114
  assertions across three suites, no framework and no dependency, exit 1 on
  any failure so it works as a gate. `node Tests/run.js relay` runs a subset.
  **COUNT AS OF 2026-10-22, LATEST: 757 JS assertions across NINE suites, plus
  287 from the python bridge suite the runner shells out to and folds in, for
  `all 1044 pass`.** The ninth is `suite_merchantbuy`, split from
  `suite_merchantsell` rather than added to it because the stack cap is a BUY
  concern and the sell suite's name would have stopped being true of its
  contents - the `never_observable` lesson applied before it cost anything.
  It read 1084, 1076, 1056, 1044, 1018, 994, 992, 977, 967, 944, 908, 878 and 845 earlier on 2026-10-22; 789, 782, 770, 753, 730, 702, 690, 673,
  668 and 646 on 2026-10-21; 586
  and 575 the day before, 285 / 61 / 346 before that, and 114 before that -
  EIGHTEEN figures in three days, which is the point rather than an embarrassment:
  re-derive from a run, never from any note here. Each supersession is appended here rather than
  erased, which is what the sentence below means by kept as the instance - the
  CURRENT figure is the only one that moves.
  The figure above was true when written and is kept as the instance rather than
  overwritten - it is this file's own "claims rot" with the numbers to prove it. The
  handoff proposing this correction said "four suites"; it was six and is now
  SEVEN - `suite_relay`, `suite_bosshop`, `suite_opengifts`,
  `suite_merchantver`, `suite_features`, `suite_caverun` and `suite_priest`,
  the last added 2026-10-20 for the priest's skill paths. Quoting the combined
  figure as the JS total overstates it by whatever the python suite currently
  contributes, which is its own moving number - so re-derive BOTH from a run
  rather than from any note, including this one.
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
- **AN ASSERTION THAT A SUPERSEDED FIGURE IS GONE CONTRADICTS THIS REPO'S OWN
  KEEP-THE-INSTANCE CONVENTION, AND POSITION IS WHAT IT SHOULD CHECK INSTEAD.**
  2026-10-21: the v113 windbelt assertions were first written as "the stale
  stormfeather count is gone" and failed against correct code, because the new
  comment QUOTES all three rotted figures inside an explicit retraction - which
  is what this file does everywhere ("kept as the instance rather than
  overwritten"). A string search cannot tell quoted-as-superseded from
  asserted-as-current. The working form finds the retraction marker and asserts
  each stale figure appears AFTER it and exactly once, which is a question about
  POSITION - the same shape as `ttk_upper_*`'s positional exclusion in the bridge
  suite.
- **A TEST THAT DIES INSTEAD OF REPORTING WILL BE DEBUGGED AS A TEST BUG.**
  Measured twice in `Tests/bridge/test_despawn.py` on 2026-10-21, both times
  while the assertion was CORRECTLY catching a real mutation: `str.index` raised
  when a call site was missing, and `seq[i]` raised when the row set came back
  short. A raise aborts before the summary line, so the output is a traceback
  rather than a named failure - and a traceback inside the harness presents a
  caught defect as broken tooling, which is the one failure mode guaranteed to
  be investigated in the wrong file. **Whatever a test looks up to prove
  something is ABSENT must tolerate the absence**: `find` returning -1 rather
  than `index` raising, a `row(seq, i)` helper returning `{}` rather than bare
  subscripting. The hardened versions turn the same two mutations into 5 and 10
  named failures.
  **THIRD INSTANCE, 2026-10-22, AND IT WAS WRITTEN BY THE SESSION THAT HAD JUST
  QUOTED THIS RULE.** The spawn-audit assertions compared
  `_dsp.get("elapsed_exact_sec") >= _W_FRANKY` and subtracted
  `_dsp["elapsed_exact_sec"]`, so the mutation that DROPS that field - the one
  those assertions exist to catch - produced `None >= 2400`, a TypeError, and
  NO PASS LINE AT ALL. Caught only because the mutation's grep came back empty
  rather than showing a failure, which is the one tell available. Both are
  number-safe now and the same mutation reports two named failures. **Knowing
  the rule is not applying it**, which this file already says about
  `localStorage` under time pressure; the cheap mechanical guard is that any
  comparison or arithmetic on a field under test goes through a
  `None`-tolerating accessor, never a bare subscript or operator.
- **A TEST HELPER IS CODE, AND THE ONE WRITTEN TO AVOID A KNOWN TRAP FELL INTO
  A NEIGHBOURING ONE.** 2026-10-21: `const X = new Set([...])` is not liftable,
  so `suite_merchantsell.js` parses those literals out of the source text
  instead - and the parse used `/'[^']*'/`, which pairs an apostrophe in
  ordinary PROSE ("operator's rule") with the next one and swallows every real
  name between them. The merchant set parsed as 23 "names", mostly comment
  fragments, and the suite reported `dexbelt` ABSENT from a set that contained
  it two lines below. Same class as the committed lift matcher ignoring strings
  and comments. Strip comments before parsing, and test the helper on fixtures.
- **WHETHER THAT NAIVE PARSE CORRUPTS ANYTHING DEPENDS ON THE PARITY OF
  APOSTROPHES IN THE PROSE ABOVE IT, WHICH IS WHY IT IS INTERMITTENT.** With an
  EVEN count the pairs close inside the comment and the real names survive BY
  LUCK; with an ODD count the first real quote is consumed. The inverted
  assertion written to prove the guard necessary FAILED on its first attempt
  because its fixture had two apostrophes - the parser was correctly broken and
  the test was wrong. **So a passing naive parse is evidence of nothing**, and
  both parities are now fixtures.
- **TWO FIXES LANDING IN ONE EDIT CAN EACH LOOK PROVEN BY THE OTHER'S WORK.**
  The comment strip and a newline guard were added together; mutating away the
  strip then broke NOTHING, because the newline guard silently covered it, and
  the strip would have sat there looking load-bearing while inert. Measured the
  other way round it is the strip that does the work and the newline guard that
  is inert. The comment beside them now says which, because the first version
  claimed both were pinned. **Mutate each half of a combined fix separately, or
  neither is tested.**
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
