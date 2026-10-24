"""The game-log capture: GameLog, its /gamelog POST and --gamelog-dir.

Imports the committed bridge, never a copy, exactly as test_despawn.py does.
"""
import importlib.util, json, pathlib, sys, tempfile, threading, time, urllib.request
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = ROOT / "Codex" / "market_bridge.py"
spec = importlib.util.spec_from_file_location("market_bridge", TARGET)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
b.QUIET = True

PASS, FAIL = [], []
def chk(name, got, want):
    (PASS if got == want else FAIL).append((name, got, want))

def nth(seq, i):
    return seq[i] if isinstance(seq, list) and -len(seq) <= i < len(seq) else {}

def read(path):
    try:
        return [json.loads(x) for x in path.read_text(encoding="utf-8").splitlines() if x.strip()]
    except OSError:
        return []

# Noon local time on a fixed day, so the local date cannot straddle midnight.
T0 = datetime(2026, 10, 24, 12, 0, 0).timestamp()
DAY = 86400.0

tmp = pathlib.Path(tempfile.mkdtemp(prefix="gamelog_test_"))
clock = {"t": T0}
g = b.GameLog(tmp / "gamelogs", clock=lambda: clock["t"])
chk("the folder is created if missing", (tmp / "gamelogs").is_dir(), True)

line = {"t_script": 1, "character": "Dexon", "server": "USII", "map": "main",
        "color": "#fff", "message": "Path not found!", "source": "game", "page": 7, "seq": 1}
r = g.append({"lines": [line, dict(line, seq=2, message="second", flavour="x"), "not-a-dict"]})
chk("ok", r.get("ok"), True)
chk("two written, one rejected", (r.get("written"), r.get("rejected")), (2, 1))
chk("the file is named by the LOCAL date", r.get("file"), "gamelog-2026-10-24.jsonl")
rows = read(tmp / "gamelogs" / "gamelog-2026-10-24.jsonl")
chk("two rows on disk", len(rows), 2)
chk("t is the bridge's clock", nth(rows, 0).get("t"), b.iso(T0))
chk("t_script is the sender's, beside it", nth(rows, 0).get("t_script"), 1)
chk("every field carried", {k: nth(rows, 0).get(k) for k in b.GAMELOG_FIELDS},
    {k: line[k] for k in b.GAMELOG_FIELDS})
chk("an unknown field survives under extra", nth(rows, 1).get("extra"), {"flavour": "x"})
chk("and no extra when there is none", "extra" in nth(rows, 0), False)

r = g.append({"lines": [dict(line, message=12345)]})
chk("a non-string message is stored as text", nth(read(tmp / "gamelogs" / r.get("file", "x")), -1).get("message"), "12345")
r = g.append({"lines": [dict(line, message="x" * (b.GAMELOG_MAX_MESSAGE + 50))]})
last = nth(read(tmp / "gamelogs" / r.get("file", "x")), -1).get("message") or ""
chk("an over-long message is cut and says so", last.endswith("[truncated by the bridge]")
    and len(last) < b.GAMELOG_MAX_MESSAGE + 40, True)

r = g.append({"lines": [line], "dropped": 3})
day = read(tmp / "gamelogs" / "gamelog-2026-10-24.jsonl")
marker = nth(day, -2)
chk("a sender's dropped count becomes a bridge row ahead of the batch",
    (marker.get("source"), marker.get("character"), "3 line(s) dropped" in (marker.get("message") or "")),
    ("bridge", "Dexon", True))
chk("written counts that row", r.get("written"), 2)
chk("dropped: true is not a count", g.append({"lines": [line], "dropped": True}).get("written"), 1)

chk("lines must be a list", g.append({"lines": "x"}).get("ok"), False)
chk("too many lines is refused, not truncated",
    g.append({"lines": [line] * (b.GAMELOG_MAX_LINES + 1)}).get("ok"), False)
chk("an empty batch is fine", g.append({"lines": []}).get("written"), 0)

# ------------------------------------------------------------- the day rolls
clock["t"] = T0 + DAY
r = g.append({"lines": [line]})
chk("next local day, next file", r.get("file"), "gamelog-2026-10-25.jsonl")

# ---------------------------------------------------------------- retention
d = tmp / "gamelogs"
for n in ("gamelog-2026-10-10.jsonl",   # 15 days before 10-25: goes
          "gamelog-2026-10-11.jsonl",   # 14 days: kept
          "gamelog-2026-10-01.jsonl",   # goes
          "boss_events.jsonl",          # not ours: never touched
          "gamelog-2026-10-01.jsonl.gz",# not the exact shape: never touched
          "gamelog-2026-13-40.jsonl",   # matches the shape, not a date: left alone
          "notes.txt"):
    (d / n).write_text("x", encoding="utf-8")
(d / "gamelog-2026-09-01.jsonl").mkdir()  # a directory with the name: left alone
gone = sorted(g.prune(T0 + DAY))
chk("only exact-shape day files older than 14 days are removed", gone,
    ["gamelog-2026-10-01.jsonl", "gamelog-2026-10-10.jsonl"])
left = sorted(p.name for p in d.iterdir())
chk("everything else is still there",
    [n for n in ("gamelog-2026-10-11.jsonl", "boss_events.jsonl", "gamelog-2026-10-01.jsonl.gz",
                 "gamelog-2026-13-40.jsonl", "notes.txt", "gamelog-2026-09-01.jsonl") if n in left],
    ["gamelog-2026-10-11.jsonl", "boss_events.jsonl", "gamelog-2026-10-01.jsonl.gz",
     "gamelog-2026-13-40.jsonl", "notes.txt", "gamelog-2026-09-01.jsonl"])
# Pruning runs on the first write of a new day, without being asked.
(d / "gamelog-2026-10-11.jsonl").write_text("x", encoding="utf-8")
clock["t"] = T0 + 2 * DAY
g.append({"lines": [line]})
chk("the first write of a new day prunes", (d / "gamelog-2026-10-11.jsonl").exists(), False)

# -------------------------------------------------------------- disabled
off = b.GameLog(None)
chk("no folder -> refused, with the reason", off.append({"lines": [line]}).get("ok"), False)

# ------------------------------------------- the endpoint, over real HTTP
b.Handler.gamelog = b.GameLog(tmp / "http", clock=lambda: T0)
srv = b.ThreadingHTTPServer(("127.0.0.1", 0), b.Handler)
th = threading.Thread(target=srv.serve_forever, daemon=True)
th.start()
try:
    url = f"http://127.0.0.1:{srv.server_address[1]}/gamelog"
    req = urllib.request.Request(url, data=json.dumps({"lines": [line]}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=5) as resp:
        body = json.loads(resp.read())
    chk("POST /gamelog is on the allowlist and writes", (body.get("ok"), body.get("written")), (True, 1))
    chk("into the configured folder", len(read(tmp / "http" / "gamelog-2026-10-24.jsonl")), 1)
finally:
    srv.shutdown()

# -------------------------------------------------------- the CLI option
src = TARGET.read_text(encoding="utf-8")
chk("--gamelog-dir defaults to ./data/gamelogs", 'GAMELOG_DIR = "./data/gamelogs"' in src
    and 'add_argument("--gamelog-dir", default=GAMELOG_DIR' in src, True)
chk("main() wires it to the handler", "Handler.gamelog = GameLog(a.gamelog_dir or None)" in src, True)

print(f"PASS {len(PASS)}   FAIL {len(FAIL)}")
for n, g_, w_ in FAIL: print(f"  FAIL {n}: got {g_!r} want {w_!r}")
sys.exit(1 if FAIL else 0)
