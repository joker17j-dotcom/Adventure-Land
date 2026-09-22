# Working conventions

Standing instructions from the user. These survive context compaction; the
conversation may not.

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

## Version headers

- **Prepend to the header, never replace it.** Line 2 of each character script
  accumulates version entries oldest-last; `Priest.js` carries five. Both
  sessions bump this line, so it is the one line that conflicts on almost every
  rebase - and resolving it by taking one side silently deletes the other
  side's history.
- **Watch for the deployment markers in there.** A note like "Not deployed to
  the live slot: Meltymerch stays on his older build" is the only in-file
  record that repo HEAD is ahead of what a character is actually running. It is
  exactly what someone needs before deploying, and exactly what a careless
  header resolution destroys. Lost once, in ba067df, restored after the other
  session caught it.

## Handing code to the other chat

- **Send diffs (`git format-patch`), never whole files.** A whole-file handoff
  carries every region whether or not it was touched, so a stale base silently
  reverts everything that moved underneath it — and it succeeds quietly rather
  than failing. Hunks make a stale base fail loudly as a rejected patch.
  This was learned the expensive way; see the v43/v44 exchange.

## Claims about the live game client

- **`kaansoral/adventureland` is a stale snapshot.** It has been wrong twice
  about the live DOM (missing `DIV.game-controls` entirely; describing
  `#newparty` styling that our own code supplies). Measure the running client
  before asserting anything about its markup, and never write an inferred
  claim into a code comment — in the file, it reads as documentation.

## The loaded copy vs this one

- **This file is canonical; `/home/claude/CLAUDE.md` in the container is what
  actually loads.** They are different files and they drifted badly: the loaded
  copy was a 438-byte subset that stated flatly "git push from the container
  fails", which is the unqualified phrasing the Git section above warns against.
  The loaded copy now points here and carries a drift check.
- **The loaded copy must never be auto-synced from this one.** A session that
  finds a difference reports it and stops, because this file is edited by both
  chat sessions and a difference may be something the user has not reviewed.
- **Container reads go through git, not the API.** `curl` to api.github.com is
  refused ("GitHub access to this repository is not enabled for this session").
  Use `git fetch origin main && git show origin/main:<path>`. From a browser tab
  the contents API works fine.

## Browser tabs - the keeper

- **Keep one tab parked on `https://adventure.land/` and never close it.** This
  is a deliberate exception to the habit of closing every tab you open. The MCP
  tab group auto-removes when its last tab closes, and that ejects every other
  tab in it, live character tabs included.
- **Never navigate the keeper.** `navigate` without an explicit `tabId` takes
  the group's FIRST tab - that is how a live Meltymerch tab was sent to GitHub
  mid-session and disconnected him.
- **Why that origin.** `adventure.land` is the only origin that can call
  `pull_merchants` (same-origin AND credentialed; cross-origin is blocked with
  no CORS headers, and `credentials: 'omit'` fails even same-origin), read
  `cstore_*` CODE storage, or call `api_call('save_code')`. The bridge on
  `127.0.0.1:8787`, ALData and the GitHub API are all reachable from it.

## Diagnosing a running character

- **Use the `adventureland` MCP server, not a browser tab.** `browser_code_eval`
  runs JS in a character's CODE context with no tab access at all, which makes
  the whole tab-dragging problem irrelevant for diagnostics. Call
  `browser_code_status` first: connected, and is CODE running.
- **It returns `queued`, never the value.** Round-trip results by writing to
  `parent.localStorage` in the snippet and reading that key from the keeper tab.
  Remove the keys afterwards.

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

- **Script functions live in the `maincode` iframe, not the top window.**
  At top level `window === parent`, so checking there returns `undefined` for
  everything and looks exactly like a silent load failure. v43 was wrongly
  called dead on that basis.
- **`const state`, `CONFIG`, `fleetState` are block-scoped and not on
  `window`.** Reach them with `frame.contentWindow.eval('...')`.

## javascript_tool mechanics

- **Async work returns `{}`.** Stash the result on `window.__X` inside the
  snippet and read it back with a follow-up synchronous call.

## Editing files in the GitHub web editor

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

- **Adventure Land refuses a second-tab takeover.** Navigating a new tab to
  `/character/<Name>/in/<REGION>/<ID>/` loads the character picker and leaves
  the running session untouched - tested, with the original still
  `online: true, code_running: true` throughout.
- To move a character into a tab Claude controls it must be disconnected
  first - send `disconnect();` with the commander below. The TOGGLE / `#dcode`
  recipe this bullet used to give was wrong; see the next section.

## Commanding a running character from /hub

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
