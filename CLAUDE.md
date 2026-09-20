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
- **Claude pushes through Chrome.** A push from the container fails: its git proxy will not inject credentials for this repo, so commits are made in the GitHub web editor.

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
