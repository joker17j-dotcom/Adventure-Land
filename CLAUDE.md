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
  for byte: blob `a3b2965a`, 649 lines, identical to
  `git show fe70d60:TASKS.md`. Read it in the tree; there is no need to go
  digging in history for it, which is what this entry said to do until
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
  `Party/MageChangelog.md`, and the Merchant's (the browser session is renaming
  `Party/MerchantChangelog.md` to `Party/MerchantChangelog.md` to match). Prepend the
  new entry THERE, newest first, never rewrite an old one, and bump line 2 in
  the same commit.
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

## Kill credit and achievement score

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
  the home-server bonus.
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

## Stopping and restarting a character's CODE

**Browser-driven session only.** Needs a live character tab.

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
- **Look for an existing clone before pulling source through a browser.**
  Measured 2026-10-17: this container already held `/tmp/alrepo` (this repo) and
  `/tmp/almongo` (`adventureland_mongodb`, the game's server source), so
  `git -C /tmp/almongo grep` answered server-behaviour questions in one call.
  Claude instead spent a morning fetching that same source through
  `raw.githubusercontent.com` in a browser tab and fighting truncated results.
  The container is ephemeral, so treat those paths as a lead, not a guarantee:
  `find / -maxdepth 4 -name .git -type d` settles it.

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
