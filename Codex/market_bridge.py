#!/usr/bin/env python3
"""Local bridge between the in-game merchant scouts and the watchlist page.

Two jobs, and the second one is the reason this exists at all:

 1. Collect merchant-stand and Ponty scans POSTed by the scout bots and serve
    them back in exactly the shape aldata.earthiverse.ca/merchants uses, so the
    page consumes them with no special-casing.

 2. Act as the scouts' ONLY coordination channel. The game's send_cm is
    realm-local: two characters on different shards cannot message each other,
    so the bots physically cannot agree among themselves on who sits where.
    The bridge holds the shard-activity table, hands out assignments, and is
    what guarantees no two parked scouts ever land on the same shard.

Standard library only.

    python3 market_bridge.py                 # 127.0.0.1:8787
    python3 market_bridge.py --port 9000 --state ./scouts.json
"""
# Keeps every type annotation in this file a lazy string instead of something
# Python evaluates at import time. Without it the "Path | None" and "dict[str,
# dict]" hints below are syntax the interpreter has to understand at startup,
# which needs 3.10 and 3.9 respectively - and the failure is a TypeError before
# a single line of the bridge runs. With it, the file loads on 3.7+.
from __future__ import annotations

import argparse
import json
import pathlib
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# A stand that has not been re-confirmed in this long is dropped from /merchants.
# Long enough to survive a roamer's full rotation, short enough that the page is
# not quoting prices from merchants who logged off an hour ago.
MERCHANT_TTL = 20 * 60
# A scout that has not POSTed in this long has its shard assignment released so
# another scout can take it.
BOT_TIMEOUT = 3 * 60
# Reassign a parked scout only when the target shard beats its current one by
# this much. Without hysteresis the scouts thrash between near-equal shards,
# and every move costs a change_server plus a walk back to the scan spot.
REASSIGN_MARGIN = 1.25
# Activity observations decay: a shard seen busy 40 minutes ago is not evidence
# that it is busy now.
ACTIVITY_HALFLIFE = 15 * 60


def now() -> float:
    return time.time()


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def shard_key(region: str, name: str) -> str:
    return f"{region}{name}"


class Store:
    """All mutable state. Guarded by one lock - traffic is tiny."""

    def __init__(self, state_path: pathlib.Path | None):
        self.lock = threading.Lock()
        self.state_path = state_path
        self.merchants: dict[str, dict] = {}   # "shard|merchantId" -> aldata-shaped row
        self.ponty: dict[str, dict] = {}       # shard -> {at, items}
        self.bots: dict[str, dict] = {}        # character -> {role, shard, last, assigned}
        self.activity: dict[str, dict] = {}    # shard -> {stands, listings, at}
        self.load()

    # ---------------------------------------------------------------- disk
    def load(self) -> None:
        if not self.state_path or not self.state_path.exists():
            return
        try:
            d = json.loads(self.state_path.read_text(encoding="utf-8"))
            self.merchants = d.get("merchants", {})
            self.ponty = d.get("ponty", {})
            self.activity = d.get("activity", {})
        except Exception as e:                       # corrupt state must not stop the bridge
            print(f"[bridge] ignoring unreadable state file: {e}")

    def save(self) -> None:
        if not self.state_path:
            return
        try:
            tmp = self.state_path.with_suffix(".tmp")
            tmp.write_text(json.dumps({
                "merchants": self.merchants, "ponty": self.ponty, "activity": self.activity,
            }), encoding="utf-8")
            tmp.replace(self.state_path)
        except Exception as e:
            print(f"[bridge] could not save state: {e}")

    # ------------------------------------------------------------- ingest
    def ingest(self, body: dict) -> dict:
        char = str(body.get("character") or "?")
        role = "roamer" if body.get("role") == "roamer" else "parked"
        sh = body.get("shard") or {}
        region, name = str(sh.get("region") or ""), str(sh.get("name") or "")
        key = shard_key(region, name)
        t = now()

        with self.lock:
            self.bots[char] = {
                **self.bots.get(char, {}),
                "role": role, "shard": key, "last": t,
                "region": region, "name": name,
            }

            seen = body.get("merchants")
            # A scan that reports no merchants array at all is a heartbeat, not
            # an observation - it must not wipe a shard we have good data for.
            if isinstance(seen, list):
                for row in seen:
                    if not isinstance(row, dict) or not row.get("id"):
                        continue
                    self.merchants[f"{key}|{row['id']}"] = {
                        "id": row["id"],
                        "serverRegion": region,
                        "serverIdentifier": name,
                        "map": row.get("map"),
                        "x": row.get("x"), "y": row.get("y"),
                        "slots": row.get("slots") or {},
                        "lastSeen": iso(t),
                        "via": char,
                    }
                stands = len(seen)
                listings = sum(len(r.get("slots") or {}) for r in seen if isinstance(r, dict))
                self.activity[key] = {"stands": stands, "listings": listings, "at": t}

            pon = body.get("ponty")
            if isinstance(pon, list):
                self.ponty[key] = {"at": iso(t), "items": pon}

            self._evict(t)
            reply = self._plan(char, t)
        self.save()
        return reply

    def _evict(self, t: float) -> None:
        for k in [k for k, m in self.merchants.items()
                  if t - datetime.fromisoformat(m["lastSeen"].replace("Z", "+00:00")).timestamp() > MERCHANT_TTL]:
            del self.merchants[k]

    # --------------------------------------------------------- assignment
    def _score(self, key: str, t: float) -> float:
        a = self.activity.get(key)
        if not a:
            return 0.0
        age = max(0.0, t - a.get("at", 0))
        decay = 0.5 ** (age / ACTIVITY_HALFLIFE)
        # Stands matter more than raw slot count: ten merchants each listing one
        # item is a busier market than one merchant listing ten.
        return (a.get("stands", 0) * 3 + a.get("listings", 0)) * decay

    def _live_bots(self, t: float) -> dict[str, dict]:
        return {c: b for c, b in self.bots.items() if t - b.get("last", 0) <= BOT_TIMEOUT}

    def _plan(self, char: str, t: float) -> dict:
        """Assignment for `char`, plus the roamer's next-shard hint.

        Roamers are never parked - they self-direct, and we only tell them which
        shards are most stale so the rotation covers the blind spots first. That
        also means a roamer running completely alone is fully functional: it
        gets a rotation, nobody competes for shards, and no parked scout is
        required for any of it.
        """
        live = self._live_bots(t)
        me = live.get(char) or self.bots.get(char, {})
        known = sorted(self.activity.keys())

        # Staleness order drives the roamer: oldest observation first, and any
        # shard we have never seen sorts ahead of everything.
        def staleness(k: str) -> float:
            return t - self.activity.get(k, {}).get("at", 0)
        rotation = sorted(known, key=staleness, reverse=True)

        if me.get("role") == "roamer":
            return {"ok": True, "assignment": None, "rotation": rotation,
                    "parked": {c: b.get("assigned") for c, b in live.items() if b.get("role") == "parked"}}

        parked = sorted([c for c, b in live.items() if b.get("role") == "parked"])
        ranked = sorted(known, key=lambda k: self._score(k, t), reverse=True)

        # Greedy, in a stable order so every bot computes the same picture:
        # each parked scout keeps its shard unless another free shard beats it
        # by the hysteresis margin. Uniqueness is structural - a shard is
        # removed from `free` the moment it is handed out.
        free = list(ranked)
        result: dict[str, str | None] = {}
        for c in parked:
            cur = self.bots.get(c, {}).get("assigned")
            if cur in free:
                best = next((k for k in free if self._score(k, t) > self._score(cur, t) * REASSIGN_MARGIN), None)
                pick = best or cur
            else:
                pick = free[0] if free else None
            result[c] = pick
            if pick in free:
                free.remove(pick)

        for c, pick in result.items():
            if c in self.bots:
                self.bots[c]["assigned"] = pick

        mine = result.get(char)
        out = None
        if mine:
            # Split "US" + "II" back apart. Regions are a closed set, so a
            # prefix test is unambiguous.
            for reg in ("ASIA", "US", "EU"):
                if mine.startswith(reg):
                    out = {"region": reg, "name": mine[len(reg):]}
                    break
        return {"ok": True, "assignment": out, "rotation": rotation,
                "parked": {c: v for c, v in result.items()}}

    # ------------------------------------------------------------ serving
    def merchant_rows(self) -> list[dict]:
        t = now()
        with self.lock:
            self._evict(t)
            return list(self.merchants.values())

    def status(self) -> dict:
        t = now()
        with self.lock:
            return {
                "now": iso(t),
                "merchants": len(self.merchants),
                "listings": sum(len(m.get("slots") or {}) for m in self.merchants.values()),
                "shards": {k: {**v, "score": round(self._score(k, t), 1),
                               "seenAgo": round(t - v.get("at", 0))}
                           for k, v in sorted(self.activity.items())},
                "bots": {c: {"role": b.get("role"), "on": b.get("shard"),
                             "assigned": b.get("assigned"),
                             "silentFor": round(t - b.get("last", 0)),
                             "live": t - b.get("last", 0) <= BOT_TIMEOUT}
                         for c, b in sorted(self.bots.items())},
                "ponty": {k: {"at": v.get("at"), "items": len(v.get("items") or [])}
                          for k, v in sorted(self.ponty.items())},
            }


class Handler(BaseHTTPRequestHandler):
    store: Store = None            # set on the server instance below
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass                        # the default logger is far too chatty

    def _send(self, obj, code=200):
        raw = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        # The page may be opened from file:// or http://localhost, and the game
        # posts from https://adventure.land. All three are different origins, so
        # this has to be open. The bridge binds to loopback only.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        # Chrome's Private Network Access check: a page on the public internet
        # (https://adventure.land) reaching a private address (127.0.0.1) gets a
        # preflight asking for this specific opt-in. Without it the scouts' POST
        # is rejected by the browser before it ever reaches us.
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self._send({"ok": True})

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/") or "/"
        if path == "/merchants":
            self._send(self.store.merchant_rows())
        elif path == "/ponty":
            with self.store.lock:
                self._send(self.store.ponty)
        elif path in ("/status", "/"):
            self._send(self.store.status())
        elif path == "/health":
            self._send({"ok": True, "service": "al-market-bridge"})
        else:
            self._send({"ok": False, "error": "no such endpoint"}, 404)

    def do_POST(self):
        path = self.path.split("?")[0].rstrip("/")
        if path != "/scan":
            self._send({"ok": False, "error": "no such endpoint"}, 404)
            return
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception as e:
            self._send({"ok": False, "error": f"bad body: {e}"}, 400)
            return
        if not isinstance(body, dict):
            self._send({"ok": False, "error": "body must be an object"}, 400)
            return
        try:
            self._send(self.store.ingest(body))
        except Exception as e:
            self._send({"ok": False, "error": str(e)}, 500)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--state", default="", help="optional JSON file to survive restarts")
    a = ap.parse_args()

    Handler.store = Store(pathlib.Path(a.state) if a.state else None)
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"[bridge] listening on http://{a.host}:{a.port}")
    print(f"[bridge]   scouts POST -> /scan      page GET -> /merchants, /ponty")
    print(f"[bridge]   status       -> http://{a.host}:{a.port}/status")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] stopped")


if __name__ == "__main__":
    main()
