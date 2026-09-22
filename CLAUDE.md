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
- **Claude cannot move an existing tab into the group.** The toolset is only
  create-group / create-new-tab / close-tab, and computer use cannot substitute:
  Chrome resolves at tier `read`, so it can screenshot but not click or drag.
  Only the user can drag a tab in.
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

## Browsers

- **Identify browsers by deviceId, never display name.** The names are
  reassigned on reconnect - "Browser 1" and "Browser 2" swapped within one day.
  `544a5d47-8c01-4b89-86ca-0fa269019ebd` is the user's ("Mychrome");
  `50c019a9-c170-4bb8-a6b8-045119627487` is the family's ("famchrome").

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
- **Which helpers exist is not guessable.** Measured in the live CODE context:
  UNDEFINED - `get_entities`, `ms_to_next_skill`.
  FUNCTION - `is_on_cooldown`, `get_chests`, `loot`, `get_nearest_monster`.

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
  first: /hub, TOGGLE, select the character, COMMAND (hidden until one is
  selected; `onclick="show_commander()"`, textarea `#dcode`), `disconnect();`.
