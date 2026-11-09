"""Who may POST to the bridge - post_origin_ok() and the do_POST gate.

2026-11-08: any page open in the operator's browser could POST /msg as
"Dexon" (CORS *, no Origin check). Imports the committed bridge, never a copy.
"""
import importlib.util, json, pathlib, sys, tempfile, threading, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = ROOT / "Codex" / "market_bridge.py"
spec = importlib.util.spec_from_file_location("market_bridge", TARGET)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
b.QUIET = True

PASS, FAIL = [], []
def chk(name, got, want):
    (PASS if got == want else FAIL).append((name, got, want))

ok = b.post_origin_ok
chk("no Origin (python, curl): allowed", ok("/msg", None), True)
chk("the game: allowed", ok("/msg", "https://adventure.land"), True)
chk("loopback with a port: allowed", ok("/msg", "http://127.0.0.1:8787"), True)
chk("localhost: allowed", ok("/gamelog", "http://localhost:8787"), True)
chk("[::1]: allowed", ok("/skip", "http://[::1]:8787"), True)
chk("another site: refused on /msg", ok("/msg", "https://evil.example"), False)
for p in ("/scan", "/trade", "/skip", "/gamelog", "/cipher"):
    chk("another site: refused on " + p, ok(p, "https://evil.example"), False)
chk("a lookalike of the game: refused", ok("/msg", "https://adventure.land.evil.example"), False)
chk("http, not https, game: refused", ok("/msg", "http://adventure.land"), False)
chk("a loopback lookalike host: refused", ok("/msg", "http://127.0.0.1.evil.example"), False)
chk("https loopback is not a bridge page: refused", ok("/msg", "https://127.0.0.1:8787"), False)
chk("null on /trade (the ledger page from a file): allowed", ok("/trade", "null"), True)
for p in ("/msg", "/scan", "/skip", "/gamelog", "/cipher"):
    chk("null on " + p + ": refused", ok(p, "null"), False)
chk("an empty Origin is not absent: refused", ok("/msg", ""), False)

# ------------------------------------------- the endpoint, over real HTTP
calls = []
class FakeStore:
    def post_message(self, body):
        calls.append(body); return {"ok": True}
b.Handler.store = FakeStore()
srv = b.ThreadingHTTPServer(("127.0.0.1", 0), b.Handler)
th = threading.Thread(target=srv.serve_forever, daemon=True)
th.start()

def post(path, origin, body=None):
    h = {"Content-Type": "application/json"}
    if origin is not None:
        h["Origin"] = origin
    req = urllib.request.Request(f"http://127.0.0.1:{srv.server_address[1]}{path}",
                                 data=json.dumps(body or {"from": "Dexon", "to": "FatherToken", "payload": {}}).encode(),
                                 headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

try:
    st, body = post("/msg", "https://evil.example")
    chk("another site's /msg: 403", (st, body.get("error")), (403, "origin not allowed"))
    chk("and the store never saw it", len(calls), 0)
    st, body = post("/msg", "https://adventure.land")
    chk("the game's /msg: served", (st, body.get("ok")), (200, True))
    chk("and reached the store", len(calls), 1)
    st, body = post("/msg", None)
    chk("no Origin: served", st, 200)
    st, body = post("/nope", "https://evil.example")
    chk("an unknown route stays 404, whatever the origin", st, 404)
finally:
    srv.shutdown()

src = TARGET.read_text(encoding="utf-8")
i_gate = src.find("if not post_origin_ok(path, origin):")
i_read = src.find('n = int(self.headers.get("Content-Length") or 0)')
chk("the gate is ahead of reading the body", 0 < i_gate < i_read, True)

print(f"PASS {len(PASS)}   FAIL {len(FAIL)}")
for n, g_, w_ in FAIL: print(f"  FAIL {n}: got {g_!r} want {w_!r}")
sys.exit(1 if FAIL else 0)
