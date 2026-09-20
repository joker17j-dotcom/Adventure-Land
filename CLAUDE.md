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
