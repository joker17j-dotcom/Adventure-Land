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

print(f"PASS {len(PASS)}   FAIL {len(FAIL)}")
for n, g, w in FAIL: print(f"  FAIL {n}: got {g!r} want {w!r}")
sys.exit(1 if FAIL else 0)
