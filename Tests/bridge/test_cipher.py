"""The Witch's Cipher on the bridge: cipher_snapshot(), cipher_transitions(),
cipher_live(), cipher_row_normalise(), and the hook in BossWatch._on_server_info
that keeps one snapshot per shard and logs each crack and round end.

Imports the committed bridge, never a copy, exactly as test_despawn.py does.
"""
import importlib.util, json, pathlib, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
TARGET = ROOT / "Codex" / "market_bridge.py"
spec = importlib.util.spec_from_file_location("market_bridge", TARGET)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
b.QUIET = True

PASS, FAIL = [], []
def chk(name, got, want):
    (PASS if got == want else FAIL).append((name, got, want))

# A test that DIES instead of reporting gets debugged as a test bug (CLAUDE.md,
# "Testing"), so every lookup that a mutation can empty goes through these.
def nth(seq, i):
    return seq[i] if isinstance(seq, list) and -len(seq) <= i < len(seq) else {}

T0 = 1_761_390_000.0
MS = lambda t: int(t * 1000)
FIT = "0" * 255 + "8"
REC = ["verdantspore", "frostscale", "embercoal", "gloomfeather", "verdantspore"]

def wc(**over):
    """The live S.witchcipher shape the browser session measured on US II."""
    w = {"live": True, "phase": "brewing", "id": "USII-2026-10-25-0600-witchcipher",
         "start": MS(T0), "gather_end": MS(T0 + 1200), "end": MS(T0 + 1680),
         "board": [{"mix": REC, "right": 2}], "possible": 40, "fit": FIT,
         "mixes": 1, "cracks": 0}
    w.update(over)
    return {"witchcipher": w}

# ------------------------------------------------------------ snapshot shape
chk("non-dict payload -> None", b.cipher_snapshot(None), None)
chk("payload without the key -> None", b.cipher_snapshot({"crabxx": {"live": True}}), None)
s = b.cipher_snapshot(wc())
chk("times read as milliseconds", (s.get("start"), s.get("end")), (T0, T0 + 1680))
chk("fit kept verbatim", s.get("fit"), FIT)
chk("counts kept", (s.get("possible"), s.get("mixes"), s.get("cracks")), (40, 1, 0))
chk("board kept", nth(s.get("board"), 0), {"mix": REC, "right": 2})
chk("no crack yet -> cracked None", s.get("cracked"), None)
ck = b.cipher_snapshot(wc(cracks=1, cracked={"by": "Red_Merch", "recipe": REC}))
chk("cracked by and recipe kept", ck.get("cracked"), {"by": "Red_Merch", "recipe": REC})
# The round-end shape: witch_cipher_finish() republishes with live false and
# between rounds the key holds {live: false} alone.
chk("a finished round reads live false", b.cipher_snapshot(wc(live=False)).get("live"), False)
chk("the between-rounds shape parses", b.cipher_snapshot({"witchcipher": {"live": False}}).get("id"), None)
chk("a non-string fit is dropped, not guessed", b.cipher_snapshot(wc(fit=123)).get("fit"), None)
chk("a boolean count is not a count", b.cipher_snapshot(wc(possible=True)).get("possible"), None)

# ------------------------------------------------------------ transitions
P = b.cipher_snapshot(wc())
chk("a first sighting writes nothing", b.cipher_transitions(None, P, "US II", T0 + 600), [])
chk("no change writes nothing", b.cipher_transitions(P, P, "US II", T0 + 600), [])
C = b.cipher_snapshot(wc(cracks=1, possible=1024, mixes=0, board=[], cracked={"by": "Red_Merch", "recipe": REC}))
rows = b.cipher_transitions(P, C, "US II", T0 + 437)
r0 = nth(rows, 0)
chk("a crack writes one cipher_crack row", [r.get("ev") for r in rows], ["cipher_crack"])
chk("naming who and what", (r0.get("by"), r0.get("recipe")), ("Red_Merch", REC))
chk("how long into the round", r0.get("since_start_sec"), 437)
chk("and the board BEFORE it reset", (r0.get("possible_before"), r0.get("mixes_before")), (40, 1))
chk("on which shard and round", (r0.get("server"), r0.get("round")), ("US II", P["id"]))
C2 = b.cipher_snapshot(wc(cracks=2, cracked={"by": "X", "recipe": REC}))
chk("two cracks between pushes: one row, the gap counted",
    nth(b.cipher_transitions(P, C2, "US II", T0 + 500), 0).get("unseen"), 1)
E = b.cipher_snapshot(wc(live=False, possible=3, mixes=5))
rows = b.cipher_transitions(P, E, "US II", T0 + 1681)
chk("live to not-live writes a cipher_end", [r.get("ev") for r in rows], ["cipher_end"])
chk("with the final board", (nth(rows, 0).get("possible"), nth(rows, 0).get("mixes"), nth(rows, 0).get("end_seen")), (3, 5, True))
chk("an end seen twice is written once", b.cipher_transitions(E, E, "US II", T0 + 1700), [])
N = b.cipher_snapshot(wc(id="USII-2026-10-25-1800-witchcipher", start=MS(T0 + 43200), end=MS(T0 + 44880)))
rows = b.cipher_transitions(P, N, "US II", T0 + 43300)
chk("a new round while the old read live closes the old one", [r.get("ev") for r in rows], ["cipher_end"])
chk("marked as an end never seen", (nth(rows, 0).get("round"), nth(rows, 0).get("end_seen")), (P["id"], False))
chk("a new round after a seen end writes nothing", b.cipher_transitions(E, N, "US II", T0 + 43300), [])
# Two id-less snapshots are not one round: a crack count read across them would
# compare two unrelated boards.
chk("an id-less pair never reads as a crack",
    [r.get("ev") for r in b.cipher_transitions(b.cipher_snapshot({"witchcipher": {"live": True, "cracks": 0}}),
                                               b.cipher_snapshot({"witchcipher": {"live": True, "cracks": 3}}), "US II", T0)
     if r.get("ev") == "cipher_crack"], [])

# ------------------------------------------------------------ when it happened
# 2026-10-29: crack rows at possible_before 1024 / mixes_before 0, the same
# second on two shards, and Meltymerch's ASIA II crack logged 2.5 minutes late
# against a "before" board older than his own mixes. The diff was right - one
# round id, count up - and the timing was whatever the last push said. So every
# row carries the bracket, and a reconnect inside it is marked, never vetoed.
SA, SB = T0 - 3000.0, T0 + 300.0
Pt = dict(P, received_t=T0 + 140, session_t=SA)
Cs = dict(C, received_t=T0 + 296, session_t=SA)
Cr = dict(C, received_t=T0 + 437, session_t=SB)
r1 = nth(b.cipher_transitions(Pt, Cs, "ASIA II", T0 + 296), 0)
chk("the crack row says when the last push before it came", r1.get("before_t"), b.iso(T0 + 140))
chk("and how wide the bracket is", r1.get("bracket_sec"), 156.0)
chk("since_start_lo_sec is the bracket's start, since_start_sec its end",
    (r1.get("since_start_lo_sec"), r1.get("since_start_sec")), (140, 296))
chk("one socket throughout reads False, not None", r1.get("across_reconnect"), False)
chk("with the socket's opening time", r1.get("socket_opened"), b.iso(SA))
r2 = nth(b.cipher_transitions(Pt, Cr, "US I", T0 + 437), 0)
chk("a crack first seen on a NEW socket is marked across_reconnect", r2.get("across_reconnect"), True)
chk("and is still written - the count rose within one round", (r2.get("ev"), r2.get("by")), ("cipher_crack", "Red_Merch"))
chk("unstamped pushes read None, never False",
    (r0.get("across_reconnect"), r0.get("before_t"), r0.get("bracket_sec"), r0.get("since_start_lo_sec")),
    (None, None, None, None))
chk("half-stamped is still unknown",
    nth(b.cipher_transitions(dict(P, session_t=SA), C, "US II", T0 + 437), 0).get("across_reconnect"), None)
Et = dict(E, received_t=T0 + 1690, session_t=SB)
chk("a seen end carries the bracket too",
    (nth(b.cipher_transitions(Pt, Et, "US II", T0 + 1690), 0).get("ev"),
     nth(b.cipher_transitions(Pt, Et, "US II", T0 + 1690), 0).get("across_reconnect")), ("cipher_end", True))
Nt = dict(N, received_t=T0 + 43300, session_t=SA)
chk("so does an end never seen",
    nth(b.cipher_transitions(Pt, Nt, "US II", T0 + 43300), 0).get("bracket_sec"), 43160.0)

# ------------------------------------------------------------ /cipher_live
store = {"US II": dict(P, received_t=T0 + 590), "EU I": dict(E, received_t=T0 + 600)}
live = b.cipher_live(store, T0 + 600)
chk("every shard listed", sorted(live["servers"]), ["EU I", "US II"])
chk("times as epoch ms for the merchant", live["servers"]["US II"].get("end_ms"), MS(T0 + 1680))
chk("and ISO for a reader", str(live["servers"]["US II"].get("end", "")).endswith("Z"), True)
chk("age per shard", live["servers"]["US II"].get("age_sec"), 10)
chk("fit carried", live["servers"]["US II"].get("fit"), FIT)
chk("received_t is not leaked", "received_t" in live["servers"]["US II"], False)
live2 = b.cipher_live({"US II": dict(P, received_t=T0 + 590, session_t=SA)}, T0 + 600)
chk("session_t is published as socket_opened, not raw",
    ("session_t" in live2["servers"]["US II"], live2["servers"]["US II"].get("socket_opened")), (False, b.iso(SA)))
chk("now_ms for a clock check", live.get("now_ms"), MS(T0 + 600))

# ------------------------------------------------------------ POST /cipher rows
row, err = b.cipher_row_normalise({"kind": "mix", "server": "US II", "round": "r", "mix": REC,
                                   "right": 3, "fits": True, "parcels": 1, "t": "2026-10-25T11:05:00Z",
                                   "character": "Meltymerch", "novel": 7})
chk("a mix row is accepted", (err, row.get("ev")), (None, "cipher_mix"))
chk("our clock orders it, theirs sits beside", (bool(row.get("t")), row.get("t_script")), (True, "2026-10-25T11:05:00Z"))
chk("known fields kept", (row.get("mix"), row.get("right"), row.get("fits")), (REC, 3, True))
chk("unknown fields survive under extra", row.get("extra"), {"novel": 7})
chk("an unknown kind is refused", b.cipher_row_normalise({"kind": "crack", "server": "US II"})[1] is not None, True)
chk("a missing server is refused", b.cipher_row_normalise({"kind": "mix"})[1], "server required")
chk("slow and watch are kinds", sorted(b.CIPHER_POST_KINDS), ["mix", "slow", "watch"])

# ------------------------------------------------------------ the hook and the log
tmp = pathlib.Path(tempfile.mkdtemp()) / "boss_events.jsonl"
w = b.BossWatch(["crabxx"], interval=45, enabled=False, events_path=tmp)
srv = {"region": "US", "name": "II"}
w._on_server_info(srv, wc())
chk("a payload with the key is stored under 'REGION NAME'", sorted(w.ciphers), ["US II"])
chk("stored with received_t", isinstance(w.ciphers.get("US II", {}).get("received_t"), float), True)
chk("no client for the server -> session_t None", w.ciphers.get("US II", {}).get("session_t", "absent"), None)
class _Cl:
    pass
cl = _Cl(); cl.server = srv2 = {"region": "US", "name": "IV"}; cl.session_t = T0 - 50.0
w.clients.append(cl)
w._on_server_info(srv2, wc(id="USIV-r"))
chk("the hook stamps the delivering socket's session_t", w.ciphers.get("US IV", {}).get("session_t"), T0 - 50.0)
cl.session_t = T0 + 10.0
w._on_server_info(srv2, wc(id="USIV-r", cracks=1, possible=1024, mixes=0, board=[], cracked={"by": "Riff", "recipe": REC}))
w._on_server_info(srv, {"crabxx": {"live": False}})
chk("a payload WITHOUT the key leaves the stored one alone", w.ciphers.get("US II", {}).get("possible"), 40)
w._on_server_info(srv, wc(cracks=1, possible=1024, mixes=0, board=[], cracked={"by": "Red_Merch", "recipe": REC}))
w._on_server_info(srv, wc(live=False, cracks=1, possible=900, mixes=2))
logged = [json.loads(l) for l in tmp.read_text().splitlines()] if tmp.exists() else []
chk("the crack and the end reach the boss log", [r.get("ev") for r in logged if r.get("server") == "US II"], ["cipher_crack", "cipher_end"])
riff = next((r for r in logged if r.get("by") == "Riff"), {})
chk("a reconnect between two pushes reaches the log as across_reconnect", riff.get("across_reconnect"), True)
r = w.queue_cipher({"kind": "watch", "server": "US II", "round": "r", "possible": 12})
logged = [json.loads(l) for l in tmp.read_text().splitlines()] if tmp.exists() else []
chk("a posted row goes through the same writer", (r.get("ok"), nth(logged, -1).get("ev")), (True, "cipher_watch"))
chk("a refused post writes nothing", (w.queue_cipher({"kind": "nope", "server": "x"}).get("ok"), len(logged)), (False, 4))
off = b.BossWatch(["crabxx"], interval=45, enabled=False, events_path=None)
chk("with the log disabled a post is refused, not dropped", off.queue_cipher({"kind": "mix", "server": "US II"}).get("ok"), False)

# ------------------------------------------------------------ the allowlists
chk("cipher rows are not boss transitions", [b.boss_ev_is_transition(e) for e in b.CIPHER_EV], [False] * len(b.CIPHER_EV))
chk("nor terminals", [b.boss_ev_is_terminal(e) for e in b.CIPHER_EV], [False] * len(b.CIPHER_EV))

print(f"PASS {len(PASS)}   FAIL {len(FAIL)}")
for n, g, w_ in FAIL: print(f"  FAIL {n}: got {g!r} want {w_!r}")
sys.exit(1 if FAIL else 0)
