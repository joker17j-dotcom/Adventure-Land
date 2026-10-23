"""The published event lineup: schedule_snapshot(), published_schedule(), and
the hook in BossWatch._on_server_info that stores one per shard.

Imports the committed bridge, never a copy, exactly as test_despawn.py does.
"""
import importlib.util, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = ROOT / "Codex" / "market_bridge.py"
spec = importlib.util.spec_from_file_location("market_bridge", TARGET)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
b.QUIET = True

PASS, FAIL = [], []
def chk(name, got, want):
    (PASS if got == want else FAIL).append((name, got, want))

HOUR = 3600.0
T0 = 1_761_240_000.0          # a fixed "now", seconds
MS = lambda t: int(t * 1000)  # the game publishes `at` in milliseconds

# A test that DIES instead of reporting gets debugged as a test bug (CLAUDE.md,
# "Testing"), so every lookup that a mutation can empty goes through these.
def nth(seq, i):
    return seq[i] if isinstance(seq, list) and -len(seq) <= i < len(seq) else {}
def num(v):
    return v if isinstance(v, (int, float)) else None

def payload(events=None, repeats=None, realm="USII"):
    return {"schedule": {"realm": realm, "server_time": MS(T0),
                         "time_offset": -5, "dailies": [13, 20], "nightlies": [23],
                         "events": events if events is not None else [],
                         "repeats": repeats if repeats is not None else []}}

# ------------------------------------------------------------ snapshot shape
chk("non-dict payload -> None", b.schedule_snapshot(None), None)
chk("payload without schedule -> None", b.schedule_snapshot({"crabxx": {"live": True}}), None)
chk("schedule without either array -> None",
    b.schedule_snapshot({"schedule": {"time_offset": -5}}), None)

snap = b.schedule_snapshot(payload(
    events=[{"id": "USII-x-1300-goobrawl", "event": "goobrawl", "at": MS(T0 + HOUR), "status": "scheduled"},
            {"id": "bad", "event": "crabxx"},                       # no `at`
            {"id": "bad2", "at": MS(T0 + HOUR)},                     # no `event`
            "not-a-dict"],
    repeats=[["graveyard", MS(T0 + 0.5 * HOUR), 7_200_000]]))
chk("rows missing `at` or `event` are dropped, not guessed", len(snap["events"]), 1)
chk("`at` read as milliseconds", nth(snap["events"], 0).get("at"), T0 + HOUR)
chk("realm carried", snap["realm"], "USII")
chk("array-shaped repeat accepted", len(snap["repeats"]), 1)
chk("`every` read as milliseconds -> 7200 s", nth(snap["repeats"], 0).get("every"), 7200.0)

obj = b.schedule_snapshot(payload(repeats=[{"event": "graveyard", "at": MS(T0), "every": 7_200_000, "status": "live"}]))
chk("object-shaped repeat accepted", (len(obj["repeats"]), nth(obj["repeats"], 0).get("status")), (1, "live"))
# THE MEASURED WIRE SHAPE, verbatim from MageofOz's live parent.S.schedule on US
# II, 2026-10-23: an ARRAY OF OBJECTS carrying id and season as well, `at` and
# `every` both epoch ms. It is the object branch above; pinned separately
# because that branch was written before anyone had seen a real entry.
LIVE_REP = {"id": "USII-2026-10-23-1930-graveyard", "event": "graveyard",
            "at": 1792801800000, "status": "scheduled", "season": "halloween",
            "every": 7200000}
live = b.schedule_snapshot({"schedule": {"time_offset": -5, "dailies": [13, 20],
    "nightlies": [23], "night": False, "realm": "USII", "server_time": 1792800000000,
    "events": [], "repeats": [LIVE_REP]}})
chk("measured live repeat parses: at 2026-10-24T00:30:00Z",
    b.iso(num(nth((live or {}).get("repeats"), 0).get("at")) or 0), "2026-10-24T00:30:00Z")
chk("measured live repeat parses: every 2h", nth((live or {}).get("repeats"), 0).get("every"), 7200.0)
_lp = b.published_schedule({"US II": dict(live or {}, received_t=1792800000.0)},
                           1792800000.0, hours_ahead=5)["occurrences"]
chk("measured live repeat expands to graveyard at 00:30, 02:30, 04:30Z",
    [o.get("at") for o in _lp if o.get("event") == "graveyard"],
    ["2026-10-24T00:30:00Z", "2026-10-24T02:30:00Z", "2026-10-24T04:30:00Z"])
chk("an unrecognised repeat entry is skipped",
    len(b.schedule_snapshot(payload(repeats=["graveyard", {"event": "x"}]))["repeats"]), 0)

# ------------------------------------------------------- flattening + expand
store = {
    "US II": dict(b.schedule_snapshot(payload(
        events=[{"id": "a", "event": "goobrawl", "at": MS(T0 + HOUR), "status": "scheduled"},
                {"id": "b", "event": "crabxx", "at": MS(T0 - 10 * 60), "status": "live"},     # running
                {"id": "c", "event": "franky", "at": MS(T0 - 5 * HOUR), "status": "ended"},    # long gone
                {"id": "d", "event": "icegolem", "at": MS(T0 + 100 * HOUR), "status": "scheduled"}],
        repeats=[["graveyard", MS(T0 + 0.5 * HOUR), 7_200_000]])), received_t=T0 - 30),
    "EU I": dict(b.schedule_snapshot(payload(realm="EUI",
        events=[{"id": "e", "event": "horseman", "at": MS(T0 + HOUR), "status": "scheduled"}])),
        received_t=T0 - 5),
}
out = b.published_schedule(store, T0, hours_ahead=48)
occ = out["occurrences"]
ev = lambda name: [o for o in occ if o["event"] == name]

chk("source names itself", out["source"], "published")
chk("a RUNNING event is kept until its window closes", len(ev("crabxx")), 1)
chk("an event that closed hours ago is dropped", len(ev("franky")), 0)
chk("an event past the horizon is dropped", len(ev("icegolem")), 0)
# THE ONE A READER OF `events` ALONE MISSES. 30 min + every 2 h through 48 h.
chk("graveyard EXPANDED from its repeat line: 24 in 48 h", len(ev("graveyard")), 24)
chk("expanded rows are marked repeat", all(o["repeat"] for o in ev("graveyard")), True)
chk("expansion steps by `every`", (num(nth(ev("graveyard"), 1).get("at_ms")) or 0) - (num(nth(ev("graveyard"), 0).get("at_ms")) or 0), 7_200_000)
chk("window_sec from SCHEDULE_EVENT_SEC", nth(ev("goobrawl"), 0).get("window_sec"), 540)
chk("sorted by time across servers",
    [o["at_ms"] for o in occ] == sorted(o["at_ms"] for o in occ), True)
chk("same-instant rows tie-break by event then server",
    [(o["event"], o["server"]) for o in occ if o["at_ms"] == MS(T0 + HOUR)],
    [("goobrawl", "US II"), ("horseman", "EU I")])
chk("in_sec relative to now", nth(ev("goobrawl"), 0).get("in_sec"), 3600)
chk("at is ISO UTC", str(nth(ev("goobrawl"), 0).get("at", "")).endswith("Z"), True)
chk("per-server age reported", (out["servers"]["US II"]["age_sec"], out["servers"]["EU I"]["age_sec"]), (30, 5))
chk("an unknown event's window is null, not zero",
    b.published_schedule({"X": {"events": [{"id": 1, "event": "mystery", "at": T0 + 60}], "repeats": []}},
                         T0)["occurrences"] and nth(b.published_schedule({"X": {"events": [{"id": 1, "event": "mystery", "at": T0 + 60}], "repeats": []}}, T0)["occurrences"], 0).get("window_sec", "MISSING"), None)
chk("empty store -> empty list", b.published_schedule({}, T0)["occurrences"], [])

# ----------------------------------------------- the hook in _on_server_info
w = b.BossWatch(["crabxx"], interval=45, enabled=False, events_path=None)
srv = {"region": "US", "name": "II"}
w._on_server_info(srv, payload(events=[{"id": "a", "event": "goobrawl", "at": MS(T0 + HOUR)}]))
chk("a payload with a lineup is stored under 'REGION NAME'", sorted(w.schedules), ["US II"])
chk("stored with received_t", isinstance(w.schedules.get("US II", {}).get("received_t"), float), True)
w._on_server_info(srv, {"crabxx": {"live": False}})
chk("a payload WITHOUT a lineup leaves the stored one alone", len(w.schedules.get("US II", {}).get("events") or []), 1)

print(f"PASS {len(PASS)}   FAIL {len(FAIL)}")
for n, g, w_ in FAIL: print(f"  FAIL {n}: got {g!r} want {w_!r}")
sys.exit(1 if FAIL else 0)
