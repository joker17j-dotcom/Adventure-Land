#!/usr/bin/env python3
"""Tests/bridge/test_despawn.py - the bridge's despawn-vs-kill classification.

    python3 Tests/bridge/test_despawn.py        (exit 1 on any failure)

A SIBLING OF THE NODE HARNESS, NOT PART OF IT. `node Tests/run.js` lifts JS
declarations into a vm context and cannot reach Python, and its central rule is
that the code under test is never copied - so porting this predicate to JS
would break exactly the rule the harness exists to keep. This imports the
COMMITTED Codex/market_bridge.py and calls the real functions, which is the same
guarantee by a shorter route.

WHY IT EXISTS. A timed event boss that vanishes at its window close was logged
`ev: "death"`. A kill publishes `estimatedRespawn` and a despawn publishes
nothing, so the two land in the same branch; and crabxx/franky/icegolem have no
BOSS_RESPAWN_SEC entry (respawn -1), so the high-confidence respawn_offset path
can never fire for them either. Measured on the live log: 20 of 37 event-boss
"deaths" were despawns.
"""
import importlib.util, json, os, sys, tempfile, time, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = ROOT / "Codex" / "market_bridge.py"

spec = importlib.util.spec_from_file_location("market_bridge", TARGET)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
b.QUIET = True

PASS, FAIL = [], []
def chk(name, got, want):
    (PASS if got == want else FAIL).append((name, got, want))

# --------------------------------------------------------------- write path
def drive(mtype, spawn_ago, present, er_offset_sec, server_answered=True,
          spawn_known=True, last_pct=52.1):
    w = b.BossWatch([mtype], interval=45, enabled=False, events_path=None)
    key = (mtype, "US", "II"); poll_t = time.time()
    w._seeded_servers.add(("US", "II")); w._last_poll_t = poll_t - 45
    entry = {"id": "x1"}
    if er_offset_sec is not None:
        entry["estimatedRespawn"] = (datetime.datetime.now(datetime.timezone.utc)
            + datetime.timedelta(seconds=er_offset_sec)).isoformat()
    w.meta[key] = {"entry": entry, "at": poll_t, "hp": None, "target": None,
                   "has_target": False, "seen_raw": None, "seen_ts": None,
                   "present": present}
    w.fights[key] = {"alive": True, "id": "x1",
                     "spawn_t": (poll_t - spawn_ago) if spawn_known else None,
                     "last_alive_t": poll_t - 45, "last_obs_t": poll_t - 45,
                     "absent": b.BOSS_ABSENT_CONFIRM - 1, "respawn_at": None,
                     "last_hp": 500, "last_pct": last_pct}
    w._transitions(poll_t, 1, {("US", "II")} if server_answered else set(), complete=True)
    return [e["ev"] for e in w._pending], w._pending

evs, raw = drive("crabxx", 2400, False, None)
chk("crabxx despawns at window close", evs, ["despawn"])
chk("records the window", raw[0]["window_sec"], 2400)
chk("hp left -> high confidence", raw[0]["confidence"], "high")
chk("mid-window kill with a respawn estimate is a death", drive("crabxx", 600, False, 1800)[0], ["death"])
chk("early vanish stays a death", drive("crabxx", 600, False, None)[0], ["death"])
chk("non-event boss untouched", drive("mrgreen", 9999, False, None)[0], ["death"])
chk("no spawn_t -> no claim", drive("crabxx", 2400, False, None, spawn_known=False)[0], ["death"])
chk("silent server is never a death", [e for e in drive("crabxx", 2400, False, None, server_answered=False)[0]
                                       if e in ("death", "despawn")], [])
chk("stale spawn_t past the ceiling stays a death", drive("crabxx", 4634, False, None)[0], ["death"])
chk("nearly dead at window close -> despawn, LOW confidence",
    drive("crabxx", 2400, False, None, last_pct=1.2)[1][0]["confidence"], "low")
for t in ("franky", "icegolem"):
    chk(f"{t} shares the 2400s window", drive(t, 2400, False, None)[0], ["despawn"])

# THE GOOBRAWL GAP: the event is named goobrawl, the monster is rgoo.
chk("rgoo is keyed by MONSTER type, window 540", b.EVENT_WINDOW_SEC.get("rgoo"), 540)
chk("bgoo likewise", b.EVENT_WINDOW_SEC.get("bgoo"), 540)
chk("the event name is NOT a monster key", b.EVENT_WINDOW_SEC.get("goobrawl"), None)
chk("rgoo despawns at its 540s close", drive("rgoo", 540, False, None)[0], ["despawn"])
chk("rgoo at 565s (the live row) despawns", drive("rgoo", 565, False, None)[0], ["despawn"])
chk("rgoo early stays a death", drive("rgoo", 120, False, None)[0], ["death"])

# ---------------------------------------------------------------- read path
def row(mtype, ttk, pct, er=None, method="absent_on_responding_server", ev="death"):
    d = {"ev": ev, "t": "2026-10-18T12:40:00+00:00", "type": mtype, "server": "US II",
         "ttk_sec": ttk, "last_pct": pct, "method": method, "confidence": "low"}
    if er: d["estimated_respawn"] = er
    return d

chk("stored crabxx row at window close reclassifies", b.stored_row_is_despawn(row("crabxx", 2400, 100)), True)
chk("stored franky row at close reclassifies", b.stored_row_is_despawn(row("franky", 2401, 100)), True)
chk("stored rgoo row at 565s reclassifies", b.stored_row_is_despawn(row("rgoo", 565, 100)), True)
chk("the real franky KILL is protected by the ceiling",
    b.stored_row_is_despawn(row("franky", 3612, 4.94)), False)
chk("a row carrying a respawn estimate is a real kill",
    b.stored_row_is_despawn(row("crabxx", 2400, 100, er="2026-10-18T13:00:00+00:00")), False)
chk("a respawn_offset row is never touched",
    b.stored_row_is_despawn(row("crabxx", 2400, 100, method="respawn_offset")), False)
chk("no ttk_sec -> no claim", b.stored_row_is_despawn(row("crabxx", None, 100)), False)
chk("a non-event type is never touched", b.stored_row_is_despawn(row("mrgreen", 2400, 100)), False)
chk("an already-logged despawn is not double-counted",
    b.stored_row_is_despawn(row("crabxx", 2400, 100, ev="despawn")), False)

# boss_history end to end
fd, path = tempfile.mkstemp(suffix=".jsonl"); os.close(fd)
hist = [
    {"ev": "spawn", "t": "2026-10-18T12:00:00+00:00", "type": "crabxx", "server": "US II", "confidence": "high"},
    row("crabxx", 2400, 100),                                     # pre-fix despawn
    {"ev": "spawn", "t": "2026-10-18T18:00:00+00:00", "type": "crabxx", "server": "US II", "confidence": "high"},
    dict(row("crabxx", 600, 0.4), t="2026-10-18T18:10:00+00:00",
         estimated_respawn="2026-10-18T18:40:00+00:00"),           # real kill
]
with open(path, "w") as fh:
    for r in hist: fh.write(json.dumps(r) + "\n")
h = b.boss_history(path); r0 = h["history"][0]
chk("kills_logged counts only the real kill", r0["kills_logged"], 1)
chk("the pre-fix row lands in despawns", r0["despawns"], 1)
chk("and is marked as reclassified", r0["despawns_reclassified"], 1)
chk("spawns unaffected", r0["spawns"], 2)
chk("no phantom stall", r0["stalled_count"], 0)
chk("summary deaths excludes it", h["deaths"], 1)
chk("summary despawns includes it", h["despawns"], 1)
os.unlink(path)

# ------------------------------------------------- the real log, replayed
# Pulled from the live bridge 2026-10-18. Real data through the real function
# is the only reason the band constants are defensible rather than tuned, and
# the US IV row is the one that matters: a genuine franky kill at 4.94% hp
# whose spawn reference had gone stale, which a floor-only test would relabel.
LIVE_FRANKY = [("ASIA I", None, 100), ("ASIA II", None, 100), ("EU II", 2400, 100),
               ("EU I", 2254, 100), ("EU PVP", 2254, 100), ("US I", 2400, 100),
               ("US PVP", 2400, 100), ("US IV", 3612, 4.94), ("EU III", None, 99.85)]
moved = sum(b.stored_row_is_despawn(row("franky", ttk, pct)) for _, ttk, pct in LIVE_FRANKY)
chk("5 of the 9 live franky rows reclassify", moved, 5)
chk("the US IV kill is NOT among them", b.stored_row_is_despawn(row("franky", 3612, 4.94)), False)
chk("a row with no spawn time is declined, however it looks",
    b.stored_row_is_despawn(row("franky", None, 100)), False)

# ------------------------------- elapsed is rebuilt, not read off ttk_sec
# `ttk_sec` is death_t - spawn_t with death_t the BRACKET MIDPOINT, so it runs
# short by (poll_t - last_alive_t)/2 - and that is NOT poll_gap_sec/2, because
# gap_for() reads last_obs_t, which advances on every absent poll while
# last_alive_t stays at the last ALIVE sighting. poll_gap_sec is 0 on all 37
# live rows, so a gap-based correction would be a silent no-op.
def srow(mtype, ttk, pct, hi=None, sp=None, **kw):
    d = row(mtype, ttk, pct, **kw)
    if hi: d["death_hi"] = hi
    if sp: d["spawn_t"] = sp
    return d

T0 = "2026-10-18T12:00:00+00:00"
chk("elapsed comes from death_hi - spawn_t, not ttk_sec",
    b.stored_row_elapsed(srow("crabxx", 1950, 100, hi="2026-10-18T12:40:00+00:00", sp=T0)), 2400.0)
chk("ttk_sec is the fallback when death_hi is absent",
    b.stored_row_elapsed(row("crabxx", 2400, 100)), 2400)
chk("no usable field at all -> None", b.stored_row_elapsed(row("crabxx", None, 100)), None)

# The case the fix exists for: a wide absence makes ttk_sec read far short.
wide = srow("crabxx", 1950, 100, hi="2026-10-18T12:40:00+00:00", sp=T0)
chk("a despawn seen after a long absence IS reclassified", b.stored_row_is_despawn(wide), True)
chk("and would have been DECLINED on ttk_sec alone",
    b.despawn_window_hit("crabxx", wide["ttk_sec"]), False)

# The live US III rgoo row, rebuilt: 633s against a 540s window.
RGOO = srow("rgoo", 566, 4.96, hi="2026-10-18T12:10:33+00:00", sp=T0)
chk("the live rgoo row rebuilds to 633s", round(b.stored_row_elapsed(RGOO)), 633)

# NO IN-BAND VERDICT CHANGES ON TODAY'S DATA - the slack was absorbing the
# skew, so this is a correctness fix against future backoff. Asserted so the
# rebuild is not "simplified" back to ttk_sec on the grounds that it changes
# nothing. (ttk, hi-sp) pairs are the live rows.
LIVE = [("rgoo", 566, 633, 540, True), ("crabxx", 2422, 2490, 2400, True),
        ("franky", 2254, 2414, 2400, True), ("franky", 2400, 2402, 2400, True),
        ("crabxx", 4634, 4792, 2400, False), ("icegolem", 893, 894, 2400, False),
        ("crabxx", 339, 407, 2400, False), ("crabxx", 972, 1130, 2400, False)]
for mtype, ttk, hisp, win, want in LIVE:
    chk(f"live {mtype} ttk {ttk} / rebuilt {hisp}: despawn={want} either way",
        (b.despawn_window_hit(mtype, ttk), b.despawn_window_hit(mtype, hisp)), (want, want))

# ---------------------------------------- hp grades the read path, as it does
# the write path. A kill finished in the last minutes looks identical from the
# listing, which is why hp sets CONFIDENCE rather than reclassifying - and a
# read path that lost that distinction would bury exactly the rows the write
# path takes care to flag. US III rgoo at 4.96% is such a row and is in the log.
chk("plenty of hp left -> high", b.stored_row_despawn_confidence(row("crabxx", 2400, 100)), "high")
chk("just above the threshold -> high", b.stored_row_despawn_confidence(row("crabxx", 2400, 5.01)), "high")
chk("exactly at the threshold -> low", b.stored_row_despawn_confidence(row("crabxx", 2400, 5.0)), "low")
chk("nearly dead -> low, it may have been a kill", b.stored_row_despawn_confidence(row("crabxx", 2400, 1.2)), "low")
chk("UNKNOWN hp -> low; 7 of 37 live rows are missing fields",
    b.stored_row_despawn_confidence(row("crabxx", 2400, None)), "low")
chk("not a despawn at all -> None", b.stored_row_despawn_confidence(row("mrgreen", 2400, 100)), None)
chk("the live rgoo row grades LOW", b.stored_row_despawn_confidence(RGOO), "low")

# and boss_history separates the count
fd, path = tempfile.mkstemp(suffix=".jsonl"); os.close(fd)
with open(path, "w") as fh:
    fh.write(json.dumps({"ev": "spawn", "t": "2026-10-18T11:00:00+00:00", "type": "crabxx",
                         "server": "US II", "confidence": "high"}) + "\n")
    fh.write(json.dumps(dict(row("crabxx", 2400, 100), t="2026-10-18T12:00:00+00:00")) + "\n")
    fh.write(json.dumps(dict(row("crabxx", 2400, 2.0), t="2026-10-18T13:00:00+00:00")) + "\n")
h = b.boss_history(path); r0 = h["history"][0]
chk("both reclassify", r0["despawns_reclassified"], 2)
chk("only the nearly-dead one is flagged uncertain", r0["despawns_reclassified_low"], 1)
chk("neither counts as a kill", r0["kills_logged"], 0)
os.unlink(path)

# ------------------------------------------------- the early side is asymmetric
# All 14 retained despawn rows, measured 2026-10-19: twelve untouched (99.81-100)
# clustered at elapsed 2402-2556 against a 2400s window, NOT ONE below it. The two
# damaged rows are different cases and only one is suspect.
EU3 = {"ev": "despawn", "type": "crabxx", "server": "EU III",
       "elapsed_sec": 2226, "window_sec": 2400, "last_pct": 63.19,
       "last_hp": 606608, "confidence": "high"}
US1 = {"ev": "despawn", "type": "crabxx", "server": "US I",
       "elapsed_sec": 2561, "window_sec": 2400, "last_pct": 97.52,
       "last_hp": 936223, "confidence": "high"}

chk("EARLY and DAMAGED is not a despawn - no artefact explains both",
    b.despawn_qualifies("crabxx", 2226, 63.19), False)
chk("EARLY but INTACT is kept; a late-detected spawn reads short",
    b.despawn_qualifies("crabxx", 2226, 100), True)
chk("LATE and damaged is kept; chip damage from a passer-by",
    b.despawn_qualifies("crabxx", 2561, 97.52), True)
chk("exactly AT the window is not early, so damage does not veto",
    b.despawn_qualifies("crabxx", 2400, 52.1), True)
chk("early with UNKNOWN hp is kept - absence of evidence vetoes nothing",
    b.despawn_qualifies("crabxx", 2226, None), True)
chk("the intact threshold is inclusive at 95.0",
    b.despawn_qualifies("crabxx", 2226, 95.0), True)
chk("and a hair below it vetoes", b.despawn_qualifies("crabxx", 2226, 94.99), False)
chk("outside the band entirely is still not a despawn",
    b.despawn_qualifies("crabxx", 600, 100), False)
chk("past the ceiling is still not a despawn",
    b.despawn_qualifies("crabxx", 4634, 7.61), False)

# the write path must not emit the EU III shape as a despawn any more
chk("write path: the EU III shape stays a death",
    drive("crabxx", 2226, False, None, last_pct=63.19)[0], ["death"])
chk("write path: early but intact still despawns",
    drive("crabxx", 2226, False, None, last_pct=100)[0], ["despawn"])
chk("write path: the US I shape still despawns",
    drive("crabxx", 2561, False, None, last_pct=97.52)[0], ["despawn"])

# the read path agrees, which is the whole point of one shared predicate
chk("read path: early and damaged death row is NOT reclassified",
    b.stored_row_is_despawn(row("crabxx", 2226, 63.19)), False)
chk("read path: early and intact death row still is",
    b.stored_row_is_despawn(row("crabxx", 2226, 100)), True)
chk("read path: confidence follows, None once it is not a despawn",
    b.stored_row_despawn_confidence(row("crabxx", 2226, 63.19)), None)

# already-written despawn rows: the log is append-only, so they need a filter
chk("the EU III row on disk is rejected by the current rule",
    b.stored_despawn_row_rejected(EU3), True)
chk("the US I row on disk is not", b.stored_despawn_row_rejected(US1), False)
chk("a death row is not a despawn row", b.stored_despawn_row_rejected(row("crabxx", 2400, 100)), None)
chk("nor is a spawn row", b.stored_despawn_row_rejected({"ev": "spawn", "type": "crabxx"}), None)

# confidence semantics are UNCHANGED, and that was a decision - see the docstring
chk("damage alone does not downgrade confidence", b.despawn_confidence(52.1), "high")
chk("near death still does", b.despawn_confidence(1.2), "low")
chk("one expression now serves both paths",
    b.despawn_confidence(100), b.stored_row_despawn_confidence(row("crabxx", 2400, 100)))

# ------------------------------------------- terminal events (liveness, not cause)
# WHY THIS IS A SEPARATE QUESTION FROM EVERYTHING ABOVE. The despawn
# classifier grades HOW a boss stopped existing; a consumer asking whether to
# plan a trip towards it needs only to know THAT it did. Measured over the
# 2,499 retained events on 2026-10-20: death 1,116, despawn 15, lost 120,
# spawn 1,248 - so a consumer filtering on `ev=despawn` to answer the liveness
# question would have seen 15 of the 1,251 terminal events, 1.2% of them.
chk("death is terminal", b.boss_ev_is_terminal("death"), True)
chk("despawn is terminal", b.boss_ev_is_terminal("despawn"), True)
# `lost` means two different things - an instance id that changed under the
# poller, and a shard that stopped being listable - and is terminal for both,
# because neither is a boss worth travelling to. Pinned so the inclusion is
# the MEANING and not an accident.
chk("lost is terminal, for both of its causes", b.boss_ev_is_terminal("lost"), True)
chk("spawn is NOT", b.boss_ev_is_terminal("spawn"), False)
chk("the set is exactly those three", sorted(b.BOSS_TERMINAL_EV), ["death", "despawn", "lost"])
chk("case does not matter", b.boss_ev_is_terminal("DEATH"), True)
for junk in (None, "", "spawned", "unknown_future_ev", 0, [], {}):
    chk(f"junk is not terminal: {junk!r}", b.boss_ev_is_terminal(junk), False)

# ------------------------------------------------- the route, over a real socket
# Driven through ThreadingHTTPServer rather than by calling the filter inline,
# because the filters live in the /boss_events branch of a long if/elif and
# that branch IS the thing a consumer meets. A test that re-implemented the
# query parsing would pass while the route stayed broken.
import threading, urllib.request
from http.server import ThreadingHTTPServer

_tmp = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
T0 = time.time() - 3600
EV_ROWS = [
    {"ev": "spawn",   "t": b.iso(T0 + 0),   "type": "crabxx", "server": "US II"},
    {"ev": "death",   "t": b.iso(T0 + 100), "type": "crabxx", "server": "US II"},
    {"ev": "spawn",   "t": b.iso(T0 + 200), "type": "franky",  "server": "EU I"},
    {"ev": "despawn", "t": b.iso(T0 + 300), "type": "franky",  "server": "EU I"},
    {"ev": "lost",    "t": b.iso(T0 + 400), "type": "dragold", "server": "ASIA I"},
]
for r in EV_ROWS:
    _tmp.write(json.dumps(r) + "\n")
_tmp.close()

b.Handler.bosses = b.BossWatch(["crabxx"], interval=45, enabled=False,
                               events_path=_tmp.name)
_srv = ThreadingHTTPServer(("127.0.0.1", 0), b.Handler)
threading.Thread(target=_srv.serve_forever, daemon=True).start()
_base = f"http://127.0.0.1:{_srv.server_address[1]}"

def get(q):
    with urllib.request.urlopen(_base + "/boss_events" + q, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))

def evs(q):
    return [(e["ev"], e["type"]) for e in get(q)["events"]]

chk("unfiltered: every row, oldest first", evs(""),
    [("spawn", "crabxx"), ("death", "crabxx"), ("spawn", "franky"),
     ("despawn", "franky"), ("lost", "dragold")])
chk("terminal=1 drops the spawns and keeps all three terminal kinds",
    evs("?terminal=1"),
    [("death", "crabxx"), ("despawn", "franky"), ("lost", "dragold")])
chk("ev= is still single-value equality", evs("?ev=despawn"), [("despawn", "franky")])
chk("terminal=true and terminal=yes read the same",
    evs("?terminal=true"), evs("?terminal=yes"))
chk("terminal=0 does not filter", len(evs("?terminal=0")), 5)

# `since` is STRICTLY after, so a caller handing back the `now` of its own
# previous answer is never served that boundary row twice.
chk("since is strictly after", evs(f"?since={b.iso(T0 + 200)}"),
    [("despawn", "franky"), ("lost", "dragold")])
chk("since composes with terminal", evs(f"?terminal=1&since={b.iso(T0 + 100)}"),
    [("despawn", "franky"), ("lost", "dragold")])
chk("an unparseable since is ignored rather than emptying the answer",
    len(evs("?since=not-a-timestamp")), 5)
chk("a since in the future returns nothing, and says so",
    get(f"?since={b.iso(time.time() + 86400)}")["total"], 0)

# truncated: the tail slice keeps the NEWEST rows, so a `since` caller losing
# the oldest of its new rows cannot otherwise tell that it happened.
one = get("?terminal=1&limit=1")
chk("limit truncates from the OLDEST end", [(e["ev"]) for e in one["events"]], ["lost"])
chk("and reports it", one["truncated"], True)
chk("total counts what matched, not what was returned", one["total"], 3)
chk("returned counts what was sent", one["returned"], 1)
chk("an untruncated answer says so", get("?terminal=1")["truncated"], False)

# THE PREMISE OF THE RANGER'S CLIENT-SIDE ev CHECK, asserted here rather than
# only claimed in a comment there. The handler reads the parameters it knows
# and never rejects an unknown one, so a bridge predating `terminal` answers a
# `terminal=1` query with spawns mixed in. That is why applyTerminal() in
# Party/Ranger.js re-checks ev and treats the query filter as bandwidth only.
chk("an unknown parameter is ignored, not refused", len(evs("?bogus=1")), 5)
chk("which is exactly what an older bridge does with terminal=1",
    len(evs("?unknown_future_filter=1")), 5)

_srv.shutdown()
os.unlink(_tmp.name)

# ------------------------------------------- window_ends_at: the generation end
# A consumer deciding "how long to stop considering this boss" needs the END of
# the current generation, which is not a duration any constant approximates: a
# 30-minute cooldown against a 2400s window expires INSIDE the window for a
# give-up in the first ten minutes and runs past the NEXT window's open for one
# in the last ten. So the bridge serves the end rather than spawn_t - sending
# spawn_t would make every caller transcribe EVENT_WINDOW_SEC client-side.
_w = b.BossWatch(["crabxx", "dragold"], interval=45, enabled=False, events_path=None)
_t = time.time()
def _seed(key, spawn_t, er=None):
    _w.meta[key] = {"entry": {"id": "x", "estimatedRespawn": er}, "hp": 500,
                    "present": True, "seen_ts": _t, "seen_raw": "x",
                    "target": None, "has_target": True, "at": _t}
    _w.fights[key] = {"spawn_t": spawn_t}
_seed(("crabxx", "US", "II"), _t - 600)
_seed(("crabxx", "EU", "I"), None)
_seed(("dragold", "US", "II"), None, er="2026-10-20T23:00:00Z")
_byserver = {(r["type"], r["server"]): r for r in _w.rows()}

# THREE DISTINGUISHABLE STATES, which is why null and absent are not the same
# answer. A consumer reading absent as "not an event boss" without separating
# null would treat an already-up crabxx as a respawn boss.
chk("an event boss whose spawn was seen carries a window end",
    _byserver[("crabxx", "US II")]["window_ends_at"],
    b.iso(_t - 600 + b.EVENT_WINDOW_SEC["crabxx"]))
chk("an event boss found ALREADY UP carries null, not a guess",
    _byserver[("crabxx", "EU I")]["window_ends_at"], None)
chk("and the key is PRESENT in that case",
    "window_ends_at" in _byserver[("crabxx", "EU I")], True)
chk("a respawn boss omits the key entirely",
    "window_ends_at" in _byserver[("dragold", "US II")], False)
chk("and still serves estimated_respawn, which is its own generation end",
    _byserver[("dragold", "US II")]["estimated_respawn"], "2026-10-20T23:00:00Z")
chk("spawn_t itself is NOT exposed - the end is the quantity, not the start",
    "spawn_t" in _byserver[("crabxx", "US II")], False)

# ------------------------------------------------ goobrawl IS observable
# `never_observable` only ever meant "this event's own name is not a polled
# monster type", and the field name said something much stronger - it cost the
# other session two wrong sections of a design spec, which asserted that a
# reactive design waits forever for a goobrawl. goobrawl spawns rgoo and bgoo,
# both polled and both in EVENT_WINDOW_SEC.
chk("goobrawl is observable, through what it spawns", "goobrawl" in b.SCHEDULE_OBSERVABLE, True)
chk("abtesting genuinely is not", "abtesting" in b.SCHEDULE_OBSERVABLE, False)
chk("only abtesting remains unobservable",
    sorted(set(b.SCHEDULE_DAILY_EVENTS + b.SCHEDULE_NIGHTLY_EVENTS) - b.SCHEDULE_OBSERVABLE),
    ["abtesting"])
chk("both spawn products map back to the event", b.SCHEDULE_EVENT_OF,
    {"rgoo": "goobrawl", "bgoo": "goobrawl"})
chk("a non-product type maps to itself",
    b.SCHEDULE_EVENT_OF.get("crabxx", "crabxx"), "crabxx")
# BOTH products, not just the first: the scripts' BOSS_FIGHT_TYPE names only
# rgoo, so a bgoo-only goobrawl would read as unobserved on that mapping.
chk("bgoo counts too, not only rgoo", b.SCHEDULE_EVENT_OF.get("bgoo"), "goobrawl")

# --------------------------------- ttk for the bosses the chain queue is about
# WHY THE EVENT BOSSES HAD NO ttk AT ALL, which is the question the browser
# session's spec revision was blocked on. `ttk_median_sec` is high-confidence
# only BY DESIGN, and "high" is reached only by the respawn_offset method,
# which requires a BOSS_RESPAWN_SEC entry. EVENT_WINDOW_SEC and
# BOSS_RESPAWN_SEC are DISJOINT, so an event boss can never reach it: the
# exclusion is structural, not a sampling accident. Measured on the live log
# 2026-10-20 - 29 event-boss kills, zero medians, while phoenix/greenjr/jr all
# had percentiles and all three are respawn bosses.
chk("the two sets are disjoint, which is what makes it structural",
    sorted(set(b.EVENT_WINDOW_SEC) & set(b.BOSS_RESPAWN_SEC)), [])
for t in b.EVENT_WINDOW_SEC:
    chk(f"{t} has no respawn constant, so respawn_offset is unreachable for it",
        b.BOSS_RESPAWN_SEC.get(t), None)
for t in ("phoenix", "greenjr", "jr"):
    chk(f"{t} does, which is why it has percentiles",
        isinstance(b.BOSS_RESPAWN_SEC.get(t), int), True)

_hf = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
def _hrow(**kw):
    _hf.write(json.dumps(kw) + "\n")
# An EVENT boss: low confidence by construction, spawn observed.
_hrow(ev="spawn", t="2026-10-20T22:00:01Z", type="franky", server="EU III")
_hrow(ev="death", t="2026-10-20T22:30:00Z", type="franky", server="EU III",
      confidence="low", method="absent_on_responding_server", ttk_sec=1799,
      spawn_t="2026-10-20T22:00:01Z", death_hi="2026-10-20T22:31:00Z")
# A RESPAWN boss: high confidence, so it has both numbers.
_hrow(ev="spawn", t="2026-10-20T20:00:00Z", type="phoenix", server="EU III")
_hrow(ev="death", t="2026-10-20T20:05:00Z", type="phoenix", server="EU III",
      confidence="high", method="respawn_offset", ttk_sec=300,
      spawn_t="2026-10-20T20:00:00Z", death_hi="2026-10-20T20:05:30Z")
# A RECLASSIFIED DESPAWN, which is the case the browser session nearly filed a
# correction about on 2026-10-20 - that ttk_upper_* would be contaminated by the
# 20 untouched-boss rows sitting at ~2402s. It is not, and the reason is
# POSITIONAL rather than argued: the read path rewrites `ev` to "despawn" at the
# top of the loop, so a reclassified row never reaches the `elif ev == "death"`
# branch where BOTH `kills_logged` and the bound are collected. Nothing in the
# collection site says so, so moving it one branch outward would reinstate the
# contamination with every other assertion in this file still passing.
#
# THE SETUP IS NON-DEGENERATE FOR A SHARP REASON: `stored_row_elapsed` is
# `death_hi - spawn_t`, the SAME quantity `ttk_hi` collects. So a reclassified
# despawn is precisely a row whose bound WOULD have been admissible - the
# assertions below pin that it is computable and excluded anyway.
_hrow(ev="spawn", t="2026-10-20T04:00:00Z", type="franky", server="US IV")
_hrow(ev="death", t="2026-10-20T04:40:00Z", type="franky", server="US IV",
      confidence="low", method="absent_on_responding_server", ttk_sec=2400,
      last_pct=100.0, spawn_t="2026-10-20T04:00:00Z",
      death_hi="2026-10-20T04:40:50Z")
# A death whose spawn was never observed: no bound is possible at all.
_hrow(ev="death", t="2026-10-20T13:30:00Z", type="crabxx", server="US I",
      confidence="low", method="absent_on_responding_server",
      spawn_t=None, death_hi="2026-10-20T13:31:00Z")
_hf.close()
_h = b.boss_history(_hf.name)
_by = {(r["type"], r["server"]): r for r in _h["history"]}

# THE DEFECT, stated as an assertion so it cannot be read as an accident.
chk("an event boss still has NO high-confidence median",
    _by[("franky", "EU III")]["ttk_median_sec"], None)
chk("but it DOES have an exact upper bound now",
    _by[("franky", "EU III")]["ttk_upper_median_sec"], 1859.0)
chk("which is death_hi - spawn_t and nothing else",
    _by[("franky", "EU III")]["ttk_upper_sample"], 1)
# A respawn boss keeps its median AND gains the bound, which is wider - the
# bound includes the poll bracket the median's method resolved away.
chk("a respawn boss keeps its median", _by[("phoenix", "EU III")]["ttk_median_sec"], 300.0)
chk("and its bound is wider than its estimate",
    _by[("phoenix", "EU III")]["ttk_upper_median_sec"] > 300.0, True)
# "No samples" and "samples we cannot bound" are different answers.
chk("a death with no observed spawn yields no bound",
    _by[("crabxx", "US I")]["ttk_upper_median_sec"], None)
chk("and is COUNTED, so the reason is visible rather than looking like no data",
    _by[("crabxx", "US I")]["ttk_upper_no_spawn"], 1)
chk("while a bounded row counts zero unbounded",
    _by[("franky", "EU III")]["ttk_upper_no_spawn"], 0)

# --- the reclassified despawn: excluded, and from the SAME branch as the count.
# PRECONDITION FIRST, because the whole test is that an admissible bound is
# dropped: if the row stopped qualifying as a despawn, every assertion below
# would pass for the wrong reason.
chk("the row does qualify as a despawn, so the exclusion is exercised",
    b.stored_row_despawn_confidence(
        {"ev": "death", "type": "franky", "method": "absent_on_responding_server",
         "last_pct": 100.0, "spawn_t": "2026-10-20T04:00:00Z",
         "death_hi": "2026-10-20T04:40:50Z"}) is not None, True)
chk("and its would-be bound is computable, and is 2450s",
    b.stored_row_elapsed(
        {"spawn_t": "2026-10-20T04:00:00Z", "death_hi": "2026-10-20T04:40:50Z"}), 2450.0)
chk("it was in fact reclassified", _by[("franky", "US IV")]["despawns_reclassified"], 1)
chk("so it contributes NO bound", _by[("franky", "US IV")]["ttk_upper_sample"], 0)
chk("and no median either", _by[("franky", "US IV")]["ttk_upper_median_sec"], None)
# THE INVARIANT, which is stronger than "despawns are excluded": the count and
# the bound are collected in one branch, so they describe one population. A
# bucket reporting kills it has no bounds for, or bounds for kills it does not
# report, means the two have been separated.
chk("it is not counted as a kill either", _by[("franky", "US IV")]["kills_logged"], 0)
for _k, _r in _by.items():
    chk(f"{_k[0]} {_k[1]}: bounds never outnumber the kills they came from",
        _r["ttk_upper_sample"] + _r["ttk_upper_no_spawn"] <= _r["kills_logged"], True)
# An unbounded row is still a kill, which is what makes the <= above an
# inequality rather than an equality - crabxx US I has the kill and no bound.
chk("crabxx US I: the kill is counted though the bound is not",
    (_by[("crabxx", "US I")]["kills_logged"],
     _by[("crabxx", "US I")]["ttk_upper_sample"]), (1, 0))

# The payload says the asymmetry out loud, because it is not guessable from it.
chk("the payload declares the median's confidence restriction",
    _h["ttk_median_high_confidence_only"], True)
chk("and names the bosses that can never satisfy it",
    _h["event_bosses_cannot_reach_high_confidence"], sorted(b.EVENT_WINDOW_SEC))
chk("include_low is still reported for the median",
    _h["medians_include_low_confidence"], False)
# include_low remains the other route and still works.
_hl = b.boss_history(_hf.name, include_low=True)
_byl = {(r["type"], r["server"]): r for r in _hl["history"]}
chk("include_low=1 surfaces the low-confidence median too",
    _byl[("franky", "EU III")]["ttk_median_sec"], 1799.0)
chk("and the bound is unchanged by it - it never depended on confidence",
    _byl[("franky", "EU III")]["ttk_upper_median_sec"],
    _by[("franky", "EU III")]["ttk_upper_median_sec"])
os.unlink(_hf.name)

# ------------------------- alive-hp observation rows (the dps-curve falsifier)
# WHY THIS ROW CLASS EXISTS: two end-points give a MEAN dps and nothing about
# its shape, so "dps rose after we declined" and "our static estimate was
# always too low" are indistinguishable - and they call for opposite fixes.
chk("hp is NOT terminal, so terminal=1 consumers never see one",
    b.boss_ev_is_terminal("hp"), False)
chk("it is an observation", b.boss_ev_is_observation("hp"), True)
chk("and not a transition", b.boss_ev_is_transition("hp"), False)
chk("transitions are exactly spawn plus the terminals",
    b.BOSS_TRANSITION_EV, ("spawn",) + b.BOSS_TERMINAL_EV)
# BOTH predicates are allowlists, so a sixth value joins neither set and
# perturbs no existing number while it waits to be classified.
chk("an unclassified sixth value is not terminal",
    b.boss_ev_is_terminal("quux"), False)
chk("and not a transition either", b.boss_ev_is_transition("quux"), False)
# Scope is a CHOICE and is pinned so widening it is deliberate.
chk("event bosses are sampled", b.boss_hp_sampled("franky"), True)
chk("respawn bosses are not", b.boss_hp_sampled("phoenix"), False)
for _t in b.EVENT_WINDOW_SEC:
    chk(f"{_t} is in scope", b.boss_hp_sampled(_t), True)

# THE KILL RECORD MUST NOT MOVE. This is the assertion that makes the
# allowlist in boss_history load-bearing rather than decorative: the same log
# with hp rows interleaved has to produce an EQUAL history, because an
# aggregated observation row would widen first_t/last_t - the `window` that
# kills_per_day divides by.
_f1 = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
_f2 = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
_base = [
    dict(ev="spawn", t="2026-10-20T22:00:01Z", type="franky", server="EU IV"),
    dict(ev="death", t="2026-10-20T23:14:15Z", type="franky", server="EU IV",
         confidence="high", method="respawn_offset", ttk_sec=4454,
         spawn_t="2026-10-20T22:00:01Z", death_hi="2026-10-20T23:14:15Z"),
]
# THE FIRST VERSION OF THIS FIXTURE WAS DEGENERATE AND ONLY MUTATION TESTING
# SAID SO. It put both hp rows strictly BETWEEN a spawn and its death, which
# is the realistic shape and cannot distinguish the branches: bracketed rows
# move neither first_t nor last_t, and the ev dispatch ignores an unknown
# value anyway, so the equality held with the allowlist REMOVED. The two
# shapes below are the ones that actually separate them.
_hp_rows = [
    # (a) bracketed - realistic, and on its own proves nothing.
    dict(ev="hp", t="2026-10-20T22:30:00Z", type="franky", server="EU IV",
         hp=90000000, max_hp=120000000, pct=75.0, dps_since=16666.7),
    # (b) AN ONGOING FIGHT: the latest row for its bucket is an observation,
    # so aggregating it advances last_t and widens the `window` that
    # kills_per_day divides by.
    dict(ev="spawn", t="2026-10-20T23:30:00Z", type="crabxx", server="US V"),
    dict(ev="hp", t="2026-10-21T01:00:00Z", type="crabxx", server="US V",
         hp=400000, max_hp=960000, pct=41.67, dps_since=62.0),
    # (c) A BOSS ALREADY UP WHEN THE BRIDGE STARTED: the seeding branch sets a
    # sample baseline with spawn_t None and emits no spawn row, so this bucket
    # holds observations and NOTHING else. Aggregated, it invents a whole
    # history entry for a boss with no recorded transitions.
    dict(ev="hp", t="2026-10-21T02:00:00Z", type="icegolem", server="ASIA I",
         hp=8000000, max_hp=16000000, pct=50.0, dps_since=900.0),
]
for _r in [r for r in _base + _hp_rows if r["ev"] != "hp"]:
    _f1.write(json.dumps(_r) + "\n")
for _r in sorted(_base + _hp_rows, key=lambda r: r["t"]):
    _f2.write(json.dumps(_r) + "\n")
_f1.close(); _f2.close()
chk("hp rows do not change the kill record at all",
    b.boss_history(_f2.name)["history"], b.boss_history(_f1.name)["history"])
# PRECONDITION: the two logs really do differ, or the equality above is a
# test of nothing.
chk("the two logs are genuinely different lengths",
    len(b.boss_events_load(_f2.name)) - len(b.boss_events_load(_f1.name)),
    len(_hp_rows) - 1)   # (b) contributes a real spawn row to both
# PRECONDITIONS, each naming the branch it separates. Without these the
# equality above is the no-op it originally was.
chk("the ongoing fight's bucket exists in both",
    sorted({(r["type"], r["server"]) for r in b.boss_history(_f1.name)["history"]}),
    [("crabxx", "US V"), ("franky", "EU IV")])
chk("and the observation-only bucket exists in NEITHER",
    [r for r in b.boss_history(_f2.name)["history"]
     if r["type"] == "icegolem"], [])
chk("and the kill is still counted once",
    b.boss_history(_f2.name)["history"][0]["kills_logged"], 1)
os.unlink(_f1.name); os.unlink(_f2.name)

# ---- the sampler itself, driven directly against the real class
_bw = b.BossWatch(["franky"], enabled=False)
_bw.max_hp["franky"] = 120000000.0
def _fight(hp, t, spawn_t=1000.0):
    return {"alive": True, "id": "i1", "spawn_t": spawn_t,
            "hp_s_hp": hp, "hp_s_t": t}
def _sample(f, hp, t, mtype="franky"):
    _bw._pending = []
    _bw._hp_sample(f, (mtype, "EU", "IV"), "EU IV", "i1", hp, t)
    return list(_bw._pending)

# 2% of 120M is 2.4M: below it nothing is written.
_f = _fight(120000000.0, 1000.0)
chk("a move under the threshold writes nothing",
    _sample(_f, 118000000.0, 1045.0), [])
chk("and does not move the baseline", _f["hp_s_hp"], 120000000.0)
_out = _sample(_f, 117000000.0, 1090.0)
chk("a move over it writes one row", len(_out), 1)
chk("carrying the percentage", _out[0]["pct"], 97.5)
chk("the loss", _out[0]["hp_lost"], 3000000)
chk("the interval", _out[0]["since_sec"], 90)
chk("and dps over that interval", _out[0]["dps_since"], round(3000000/90.0, 1))
chk("elapsed runs from spawn, not from the previous sample",
    _out[0]["elapsed_sec"], 90)
# THE BASELINE MUST ADVANCE TO THE EMITTED SAMPLE, not stay at spawn - else
# dps_since is a mean from spawn wearing an interval's label, which is the
# very conflation this row class exists to break.
chk("the baseline advances to what was written", _f["hp_s_hp"], 117000000.0)
chk("and so does its timestamp", _f["hp_s_t"], 1090.0)
_out2 = _sample(_f, 114000000.0, 1180.0)
chk("so the next row measures from the last sample",
    (_out2[0]["hp_lost"], _out2[0]["since_sec"]), (3000000, 90))

# Scope, checked through the sampler and not only through the predicate.
chk("an out-of-scope type writes nothing even past the threshold",
    _sample(_fight(1000000.0, 1000.0), 1.0, 1090.0, mtype="phoenix"), [])
# No max: counted, never guessed.
_bw2 = b.BossWatch(["franky"], enabled=False)
_before = _bw2.hp_samples_no_max
chk("without a max_hp no row is written",
    (lambda f: (_bw2._pending.clear(),
                _bw2._hp_sample(f, ("franky", "EU", "IV"), "EU IV", "i1",
                                1.0, 1090.0),
                list(_bw2._pending))[-1])(_fight(120000000.0, 1000.0)), [])
chk("and the skip is counted rather than silent",
    _bw2.hp_samples_no_max - _before, 1)
# An hp RISE inside one instance: the row is written for the curve, but
# dps_since is null rather than negative.
_rise = _sample(_fight(10000000.0, 1000.0), 60000000.0, 1090.0)
chk("a rise still writes a row", len(_rise), 1)
chk("but reports no dps", _rise[0]["dps_since"], None)
chk("and no loss", _rise[0]["hp_lost"], None)

# THE VOLUME BOUND IS A CLAIM IN THE COMMENT, so it is measured. A fight from
# full health to zero cannot exceed 100/BOSS_HP_SAMPLE_PCT rows however fast
# it dies - which is why there is no minimum interval between samples.
_f3 = _fight(120000000.0, 0.0)
_rows = 0
for _i in range(1, 2001):
    _hp = 120000000.0 * (1.0 - _i / 2000.0)
    _rows += len(_sample(_f3, _hp, float(_i)))
chk("a full fight is bounded by the threshold alone",
    _rows <= int(100 / b.BOSS_HP_SAMPLE_PCT), True)
chk("and is not degenerately small either", _rows >= 40, True)
# An UNTOUCHED boss is the case the bound is really for: the 2026-10-20 EU III
# franky took zero damage across its whole window.
_f4 = _fight(120000000.0, 0.0)
chk("an untouched boss emits nothing across a whole window",
    sum(len(_sample(_f4, 120000000.0, float(_i * 45))) for _i in range(1, 54)), 0)

print(f"PASS {len(PASS)}   FAIL {len(FAIL)}")
for n, g, w in FAIL: print(f"  FAIL {n}: got {g!r} want {w!r}")
sys.exit(1 if FAIL else 0)
