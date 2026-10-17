# Working conventions

Standing instructions from the user. These survive context compaction; the
conversation may not.

## Repo layout

**Both sessions.** Reorganised 2026-10-17; before that everything sat at the
root, so any path in an older note, comment or commit message may be stale.

- **The character scripts and their changelog live in `Party/`** -
  `Party/Ranger.js`, `Party/Priest.js`, `Party/Mage.js`, `Party/Merchant.js`,
  `Party/CHANGELOG.md`, `Party/MerchantComments.md`. Verified at the move:
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
  for byte: blob `a3b2965a`, 649 lines, identical to
  `git show fe70d60:TASKS.md`. Read it in the tree; there is no need to go
  digging in history for it, which is what this entry said to do until
  2026-10-17.
  Three references still spell it as a root path and want the `Archived/`
  prefix: `Codex/FamilyFleet.js:497` and `:5183` (both "TASKS.md 5e") and
  `Party/CHANGELOG.md:2168` ("item 1"). The `README.md` entry already points
  at the new path.

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
- **Attribution stays on handed-over commits.** Operator's call 2026-10-17: the
  session that did the work gets the credit, so every extended description ends
  with the `Co-Authored-By: Claude Opus 5` and `Claude-Session:` lines even
  though the operator is the committer.
- **Routing commits away from this session is a cost accepted, not a demotion.**
  It is the session that can read the live game and verify claims against it,
  which is why it produces the content in the first place.

## Version headers

- **Prepend to the header, never replace it.** Line 2 of each character script
  accumulates version entries oldest-last; `Party/Priest.js` carries five. Both
  sessions bump this line, so it is the one line that conflicts on almost every
  rebase - and resolving it by taking one side silently deletes the other
  side's history.
- **Watch for the deployment markers in there.** A note like "Not deployed to
  the live slot: Meltymerch stays on his older build" is the only in-file
  record that repo HEAD is ahead of what a character is actually running. It is
  exactly what someone needs before deploying, and exactly what a careless
  header resolution destroys. Lost once, in ba067df, restored after the other
  session caught it.
- **`Party/Merchant.js` is the exception.** Its history was moved to
  `Party/CHANGELOG.md` on 2026-09-21 to stay under the CODE slot size cap, so
  line 2 there carries only the current version and the entry goes in
  `Party/CHANGELOG.md` instead. Do not prepend to a header that deliberately
  does not accumulate. Verified 2026-10-17: `Party/Merchant.js` line 2 ends at
  `v97`, and `Party/CHANGELOG.md` holds the rest. The v97 entry is deliberately
  NOT written yet - the operator's 2026-10-17 call was to leave the bump in
  place and fold v97's three changes (`parked: false`, `tracker` dropped from
  `pontyBuy.items`, eight key ids added) into the next change's entry.

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

## The loaded copy vs this one

**Both sessions.**

- **This file is canonical; `/home/claude/CLAUDE.md` in the container is what
  actually loads.** They are different files. The loaded copy began as a
  438-byte subset that stated flatly "git push from the container fails" - the
  unqualified phrasing the Git section above warns against. It now carries the
  full conventions, points here, and runs a drift check before the first repo
  write of a session.
- **Expect cosmetic drift; it is not worth a stop on its own.** Measured
  2026-09-25: 14 shared sections differed, 13 of them only in punctuation and
  emphasis - em-dashes flattened to hyphens, `FULLY` lowercased, lines reflowed,
  one sentence dropped from Testing. This file holds the better prose. Sync
  substance in both directions; do not degrade this copy to match the other's
  formatting.
- **The loaded copy is allowed to be ahead.** That same check found the
  `Party/Merchant.js` version-header exception present in the loaded copy and
  missing here, which would have walked the other session into prepending to a
  header that does not accumulate. It was carried into this file on 2026-09-25.
  Drift is a two-way diff, not a one-way correction.
- **The loaded copy must never be auto-synced from this one.** A session that
  finds a difference reports it and stops, because this file is edited by both
  chat sessions and a difference may be something the user has not reviewed.
- **Container reads go through git, not the API.** `curl` to api.github.com is
  refused ("GitHub access to this repository is not enabled for this session").
  Use `git fetch origin main && git show origin/main:<path>`. From a browser tab
  the contents API works fine.

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
- **Never navigate the keeper.** `navigate` without an explicit `tabId` takes
  the group's FIRST tab - that is how a live Meltymerch tab was sent to GitHub
  mid-session and disconnected him.
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

## Reading the bank without travelling

**Browser-driven session only.**

- **`character.bank` is null anywhere but inside the bank map.** That is why a
  bank read has meant walking a character there and back - `arbProbeBank()`
  in `Party/Merchant.js` exists to time that round trip, and it reports free
  slots and gold only, never contents.
- **The /hub BANK button sidesteps it completely.** Click it, then read
  `window.comm_items.bank`: an object of `items0..itemsN` arrays covering every
  pack, each entry `{name, level, q}`. Measured 2026-10-04: 109 distinct
  name+level lines, 14,964 items, with no character moved and no farming
  interrupted.
- **`bank_packs` is NOT the contents.** It is the pack-name table (48 entries).
  The contents are `comm_items.bank`, which has 4.

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
- **What trips it is not predictable, so keep the value you need OUT of the
  payload.** Measured 2026-10-12: a 24-character instance id came back
  `[BLOCKED: Base64 encoded data]`, and FatherToken's entry came back
  `[BLOCKED: Sensitive key]` in two unrelated probes while Dexon, MageofOz and
  Meltymerch came through both times - the only field name containing "Token",
  which is a LEAD and not confirmed. His attack and frequency are still
  unmeasured because of it. `document.hidden` and `document.visibilityState`
  trip it reliably. Report DERIVED facts - a length, a boolean, a brace depth,
  a count - and where the raw value is needed, have the GAME read it rather
  than moving it through a tool result:
  `enter("crypt", parent.localStorage.getItem('crypt_instance'))` never puts
  the id in a result at all.

## Deploying a code slot

- **`load_code` serves a cached copy.** After `save_code` the character keeps
  running the old build until the page is FULLY reloaded. Verify by feature-
  detecting something only the new build has, not by the slot version number.

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

## javascript_tool mechanics

**Browser-driven session only.**

- **Async work returns `{}`.** Stash the result on `window.__X` inside the
  snippet and read it back with a follow-up synchronous call.

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

- **There is no test harness in this repo.** Both missing-helper bugs above
  were invisible to reading and obvious the instant anything executed. Any
  harness that merely runs the file would have caught them.

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
