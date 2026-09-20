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
import os
import pathlib
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# A stand that has not been re-confirmed in this long is dropped from /merchants.
# Long enough to survive a roamer's full rotation, short enough that the page is
# not quoting prices from merchants who logged off an hour ago.
#
# Since each scan REPLACES its shard rather than merging, this cannot make
# anything fresher - it only decides how long a shard NOBODY IS VISITING stays
# listed. That makes it close to pure loss: deleting the last known state of a
# shard turns "the scout stopped 40 minutes ago" into "the market is empty",
# which are very different things and look identical once the rows are gone.
#
# The page already marks age on every listing, so keeping stale data is honest
# rather than misleading, and a board labelled 40 minutes old diagnoses a dead
# scout that an empty board hides. The real risk - a stale row ranking top of
# the arbitrage table - is handled where it belongs, by excluding old listings
# from the SPREAD maths rather than by destroying the underlying record.
#
# An hour, then, purely as a bound on unbounded growth.
MERCHANT_TTL = 60 * 60
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
# Relayed party messages are dropped after this. Long enough that a character
# reconnecting or hopping shards still collects what it missed, short enough
# that nobody acts on a half-hour-old "I need potions".
MESSAGE_TTL = 10 * 60


QUIET = False


def say(msg: str) -> None:
    """One line per meaningful event.

    The default HTTP logger is suppressed because it prints a line per request
    including every /merchants poll the page makes, which buries the handful of
    events worth seeing. This prints what actually happened instead."""
    if not QUIET:
        print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


def now() -> float:
    return time.time()


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def shard_key(region: str, name: str) -> str:
    return f"{region}{name}"


# Trade ledger events, in the order a trade can move through them. "open" is a
# purchase that has not been resolved; every trade ends "closed" (sold) or
# "abandoned" (given up on, item kept or vendored). "banked" records the half of
# net profit put away, "adjust" a hand correction from the page, "note" a
# free-text line.
LEDGER_EVENTS = ("open", "closed", "abandoned", "banked", "adjust", "note")

# Fields an "adjust" event is allowed to change. Deliberately narrow: the point
# of a hand correction is to record what really happened to an item the script
# could not see, not to let the page rewrite a trade's identity.
ADJUSTABLE = ("sellPrice", "received", "net", "status", "qty", "sellTo", "sellShard")


class Ledger:
    """Append-only trade history. Never expires, never rewritten.

    Separate from Store because it obeys the opposite rule. Store holds a market
    snapshot that is supposed to age out; this is the record of what was
    actually done, and the operator's requirement was that no timer and no
    restart may clear it.

    JSON Lines rather than one JSON document, for two reasons. A crash
    mid-write costs the last line instead of the file, and appending never has
    to read or rewrite what is already there - so the cost of a trade does not
    grow with the number of trades already recorded.

    Current state is derived by replaying the events, so the file stays the only
    source of truth and there is nothing to keep in step with it."""

    def __init__(self, path: pathlib.Path):
        self.path = path
        self.lock = threading.Lock()
        self.events: list[dict] = []
        self.seen: set[str] = set()      # eventId dedupe - see append()
        self.load()

    def load(self) -> None:
        if not self.path.exists():
            return
        bad = 0
        try:
            with self.path.open("r", encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        e = json.loads(line)
                    except Exception:
                        # One unreadable line must not cost the whole history;
                        # that is the reason for line-delimited records.
                        bad += 1
                        continue
                    if isinstance(e, dict) and e.get("id"):
                        self.events.append(e)
                        if e.get("eventId"):
                            self.seen.add(e["eventId"])
        except Exception as ex:
            print(f"[bridge] could not read the ledger: {ex}")
            return
        msg = f"[bridge] ledger: {len(self.events)} event(s) from {self.path}"
        if bad:
            msg += f" ({bad} unreadable line(s) skipped)"
        print(msg)

    def append(self, body: dict) -> dict:
        """Record one event. Idempotent on eventId.

        The merchant resends anything the bridge has not acknowledged, exactly
        as it does with scans, so the same event arrives twice whenever a reply
        is lost. Without dedupe a retried "banked" would double-count gold that
        moved once."""
        ev = str(body.get("event") or "").strip()
        if ev not in LEDGER_EVENTS:
            return {"ok": False, "error": f"event must be one of {', '.join(LEDGER_EVENTS)}"}
        tid = str(body.get("id") or "").strip()
        if not tid:
            return {"ok": False, "error": "id is required"}

        rec = {k: v for k, v in body.items() if k != "at"}
        rec["id"] = tid
        rec["event"] = ev
        rec["at"] = iso(now())

        with self.lock:
            eid = rec.get("eventId")
            if eid and eid in self.seen:
                say(f"ledger {ev} {tid} - duplicate, ignored")
                return {"ok": True, "duplicate": True, "id": tid, "events": len(self.events)}
            try:
                with self.path.open("a", encoding="utf-8") as fh:
                    fh.write(json.dumps(rec, separators=(",", ":")) + "\n")
                    fh.flush()
                    os.fsync(fh.fileno())
            except Exception as ex:
                # Refusing is the honest answer. Accepting an event we could not
                # write would have the merchant clear its buffer and lose it.
                return {"ok": False, "error": f"could not write the ledger: {ex}"}
            self.events.append(rec)
            if eid:
                self.seen.add(eid)

        bits = [f"ledger {ev} {tid}"]
        if rec.get("item"):
            bits.append(str(rec["item"]) + (f" x{rec['qty']}" if rec.get("qty") else ""))
        for k in ("spend", "net", "amount"):
            if rec.get(k) is not None:
                bits.append(f"{k}={rec[k]}")
        say("  ".join(bits))
        return {"ok": True, "id": tid, "events": len(self.events)}

    def state(self) -> dict:
        """Replay the events into per-trade rows plus running totals."""
        with self.lock:
            events = list(self.events)

        trades: dict[str, dict] = {}
        order: list[str] = []
        banked_total = 0
        for e in events:
            tid = e["id"]
            t = trades.get(tid)
            if t is None:
                t = {"id": tid, "status": "open", "banked": 0, "notes": [], "events": 0,
                     "dryRun": bool(e.get("dryRun"))}
                trades[tid] = t
                order.append(tid)
            t["events"] += 1
            ev = e["event"]
            if ev == "open":
                for k in ("item", "level", "special", "qty", "buyPrice", "buyFrom",
                          "buyShard", "spend", "taxRate"):
                    if e.get(k) is not None:
                        t[k] = e[k]
                t["openedAt"] = e["at"]
            elif ev == "closed":
                for k in ("sellPrice", "sellTo", "sellShard", "gross", "received", "tax", "net"):
                    if e.get(k) is not None:
                        t[k] = e[k]
                t["status"] = "closed"
                t["closedAt"] = e["at"]
            elif ev == "abandoned":
                t["status"] = "abandoned"
                t["closedAt"] = e["at"]
                if e.get("reason"):
                    t["reason"] = e["reason"]
                if e.get("disposition"):
                    t["disposition"] = e["disposition"]
            elif ev == "banked":
                amt = e.get("amount") or 0
                t["banked"] += amt
                if not t.get("dryRun"):
                    banked_total += amt
            elif ev == "adjust":
                f = e.get("field")
                if f in ADJUSTABLE:
                    t[f] = e.get("value")
                    t.setdefault("adjusted", []).append(f)
            elif ev == "note":
                if e.get("text"):
                    t["notes"].append({"at": e["at"], "text": e["text"]})

        all_rows = [trades[i] for i in order]
        # A rehearsal must never move the headline. Dry-run trades are kept and
        # shown - they are how the executor gets exercised against the real
        # market - but no gold changed hands, so counting them as profit would
        # make the one number the operator trusts a fiction.
        rows = [r for r in all_rows if not r.get("dryRun")]
        dry = [r for r in all_rows if r.get("dryRun")]
        realized = sum(r.get("net") or 0 for r in rows if r["status"] == "closed")
        open_rows = [r for r in rows if r["status"] == "open"]
        abandoned = [r for r in rows if r["status"] == "abandoned"]
        return {
            "trades": all_rows,
            "totals": {
                # Realised and unrealised kept apart on purpose. A bought item
                # that has not sold is gold turned into an asset, not a loss,
                # and folding the two together would report it as one.
                "realizedNet": realized,
                "closed": len([r for r in rows if r["status"] == "closed"]),
                "open": len(open_rows),
                "openSpend": sum(r.get("spend") or 0 for r in open_rows),
                "abandoned": len(abandoned),
                "abandonedSpend": sum(r.get("spend") or 0 for r in abandoned),
                "banked": banked_total,
                "events": len(events),
                # Reported alongside, never folded in.
                "dryRun": len(dry),
                "dryRunNet": sum(r.get("net") or 0 for r in dry if r["status"] == "closed"),
            },
            "path": str(self.path),
        }


class Store:
    """All mutable state. Guarded by one lock - traffic is tiny."""

    def __init__(self, state_path: pathlib.Path | None):
        self.lock = threading.Lock()
        self.state_path = state_path
        self.merchants: dict[str, dict] = {}   # "shard|merchantId" -> aldata-shaped row
        self.ponty: dict[str, dict] = {}       # shard -> {at, items}
        self.bots: dict[str, dict] = {}        # character -> {role, shard, last, assigned}
        self.activity: dict[str, dict] = {}    # shard -> {stands, listings, at}
        # Party relay. send_cm cannot cross shards, so the same message is sent
        # both ways: instantly in-game when the target is on the same shard, and
        # through here always. Receivers dedupe on msg id, so a double delivery
        # is harmless and neither channel is load-bearing on its own.
        self.messages: list[dict] = []
        self.seq = 0
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
        # A pinned scout holds the shard it is standing on and is not the
        # bridge's to move. The merchant sets this: it parks on the party's
        # home shard for reasons that have nothing to do with coverage, so an
        # assignment elsewhere would be ignored, and the bridge would then be
        # telling roamers that a shard nobody is on is covered.
        pinned = bool(body.get("pinned"))
        sh = body.get("shard") or {}
        region, name = str(sh.get("region") or ""), str(sh.get("name") or "")
        key = shard_key(region, name)
        t = now()

        with self.lock:
            self.bots[char] = {
                **self.bots.get(char, {}),
                "role": role, "shard": key, "last": t,
                "pinned": pinned,
                "region": region, "name": name,
            }

            stored_m = 0
            stored_p = 0

            seen = body.get("merchants")
            # A scan that reports no merchants array at all is a heartbeat, not
            # an observation - it must not wipe a shard we have good data for.
            if isinstance(seen, list):
                # Each visit is a COMPLETE sweep of that shard, so it replaces
                # what was there rather than merging into it. Accumulating across
                # visits meant a merchant seen two rotations ago stayed listed
                # long after packing up, and the watchlist quoted them - you
                # would travel to a stand that is not there. An empty list is a
                # real observation ("nothing trading here right now") and clears
                # the shard; only a heartbeat leaves it alone.
                dropped = 0
                for k in [k for k in self.merchants if k.startswith(key + "|")]:
                    del self.merchants[k]
                    dropped += 1

                for row in seen:
                    if not isinstance(row, dict) or not row.get("id"):
                        continue
                    stored_m += 1
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
                stored_p = len(pon)

            self._evict(t)
            reply = self._plan(char, t)
            # What was actually written, so the scout can confirm its payload
            # landed rather than trusting that an HTTP 200 meant anything. A
            # mismatch tells it to resend instead of moving on and losing the
            # scan.
            reply["accepted"] = {"merchants": stored_m, "ponty": stored_p}
            assigned = reply.get("assignment")
        self.save()

        bits = [f"{char} @{key}"]
        if isinstance(seen, list):
            bits.append(f"{stored_m} stands")
            if stored_m != len(seen):
                bits.append(f"({len(seen) - stored_m} rejected)")
            delta = stored_m - dropped
            if dropped:
                bits.append(f"[replaced {dropped}, {delta:+d}]")
        else:
            bits.append("heartbeat")
        if stored_p:
            bits.append(f"{stored_p} Ponty")
        if assigned:
            bits.append(f"-> assigned {assigned['region']}{assigned['name']}")
        say("scan  " + "  ".join(bits))
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

        parked_shards = {b.get("assigned") for c, b in live.items()
                         if b.get("role") == "parked" and b.get("assigned")}

        if me.get("role") == "roamer":
            # Every roamer used to receive the same staleness-ordered rotation
            # and take its head, so two roamers picked the same shard on every
            # single hop and shadowed each other forever - measured at 8 ticks
            # out of 8. The second one contributed nothing.
            #
            # So the unparked shards are dealt out between them, and each gets a
            # beat of its own that nobody else walks.
            #
            # Dealt from a NAME-sorted list, not from the rotation. The rotation
            # re-sorts by staleness on every request, so partitioning it would
            # hand a roamer a different set each tick - the opposite of owning a
            # beat. Ownership has to come from something that does not move.
            # Round-robin rather than contiguous blocks so the beats stay within
            # one shard of each other in size.
            roamers = sorted([c for c, b in live.items() if b.get("role") == "roamer"])
            free = sorted(k for k in known if k not in parked_shards)
            beat: list[str] = []
            if roamers and free:
                i = roamers.index(char) if char in roamers else 0
                beat = free[i::len(roamers)]
            # Staleness-ordered WITHIN the beat: stable ownership, and inside it
            # the stalest shard is still the one most worth visiting.
            beat = sorted(beat, key=staleness, reverse=True)
            return {"ok": True, "assignment": None, "rotation": rotation, "beat": beat,
                    "roamers": len(roamers),
                    "parked": {c: b.get("assigned") for c, b in live.items() if b.get("role") == "parked"}}

        parked = sorted([c for c, b in live.items() if b.get("role") == "parked"])
        ranked = sorted(known, key=lambda k: self._score(k, t), reverse=True)

        # Pinned scouts are placed first and are simply told where they already
        # are. Doing this BEFORE the greedy pass is what makes it correct: their
        # shards leave `free`, so no movable scout is sent to double up on one,
        # and `parked_shards` above reports the shard actually being held rather
        # than one the bridge wished for.
        pinned_result: dict[str, str | None] = {}
        for c in parked:
            b = live.get(c, {})
            if not b.get("pinned"):
                continue
            pinned_result[c] = b.get("shard")
        parked = [c for c in parked if c not in pinned_result]

        # Greedy, in a stable order so every bot computes the same picture:
        # each parked scout keeps its shard unless another free shard beats it
        # by the hysteresis margin. Uniqueness is structural - a shard is
        # removed from `free` the moment it is handed out.
        free = [k for k in ranked if k not in set(pinned_result.values())]
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

        result.update(pinned_result)
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

    # -------------------------------------------------------------- relay
    def post_message(self, body: dict) -> dict:
        frm = str(body.get("from") or "?")
        to = body.get("to")
        if isinstance(to, str):
            to = [to]
        elif not isinstance(to, list):
            to = None                      # None = broadcast to everyone
        t = now()
        with self.lock:
            self.seq += 1
            self.messages.append({
                "seq": self.seq, "at": iso(t), "ts": t, "frm": frm,
                "to": [str(x) for x in to] if to else None,
                "id": str(body.get("id") or f"{frm}-{self.seq}"),
                "payload": body.get("payload"),
            })
            cutoff = t - MESSAGE_TTL
            self.messages = [m for m in self.messages if m["ts"] >= cutoff]
            seq = self.seq
        kind = (body.get("payload") or {}).get("message", "?")
        say(f"relay {frm} -> {', '.join(to) if to else 'all'}  {kind}  #{seq}")
        return {"ok": True, "seq": seq}

    def get_messages(self, who: str, since: int) -> dict:
        t = now()
        with self.lock:
            cutoff = t - MESSAGE_TTL
            self.messages = [m for m in self.messages if m["ts"] >= cutoff]
            out = [
                {k: m[k] for k in ("seq", "at", "frm", "id", "payload")}
                for m in self.messages
                # Never hand a character its own message back: it already acted
                # on it locally, and the dedupe set may have expired by now.
                if m["seq"] > since and m["frm"] != who
                and (m["to"] is None or who in m["to"])
            ]
            return {"ok": True, "cursor": self.seq, "messages": out}

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
                "relay": {
                    "queued": len(self.messages),
                    "seq": self.seq,
                    "recent": [{"at": m["at"], "from": m["frm"], "to": m["to"],
                                "message": (m.get("payload") or {}).get("message")}
                               for m in self.messages[-8:]],
                },
            }


class Handler(BaseHTTPRequestHandler):
    store: Store = None            # set on the server instance below
    ledger: Ledger = None
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
        elif path == "/msg":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            who = (q.get("to") or [""])[0]
            try:
                since = int((q.get("since") or ["0"])[0])
            except ValueError:
                since = 0
            if not who:
                self._send({"ok": False, "error": "to= is required"}, 400)
            else:
                self._send(self.store.get_messages(who, since))
        elif path == "/trades":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            if (q.get("raw") or [""])[0] in ("1", "true"):
                with self.ledger.lock:
                    self._send({"events": list(self.ledger.events)})
            else:
                self._send(self.ledger.state())
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
        if path not in ("/scan", "/msg", "/trade"):
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
            if path == "/msg":
                self._send(self.store.post_message(body))
            elif path == "/trade":
                self._send(self.ledger.append(body))
            else:
                self._send(self.store.ingest(body))
        except Exception as e:
            self._send({"ok": False, "error": str(e)}, 500)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--state", default="", help="optional JSON file to survive restarts")
    # Defaulted ON, unlike --state. The market snapshot is allowed to be lost;
    # the trade history is not - the requirement was that no timer and no
    # restart clears it, and an off-by-default flag is a restart away from
    # breaking that.
    ap.add_argument("--ledger", default="./ledger.jsonl",
                    help="append-only trade history (default ./ledger.jsonl)")
    ap.add_argument("--quiet", action="store_true",
                    help="only print startup and errors, no per-event lines")
    a = ap.parse_args()

    global QUIET
    QUIET = a.quiet

    Handler.store = Store(pathlib.Path(a.state) if a.state else None)
    Handler.ledger = Ledger(pathlib.Path(a.ledger))
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"[bridge] listening on http://{a.host}:{a.port}")
    print(f"[bridge]   scouts POST -> /scan      page GET -> /merchants, /ponty")
    print(f"[bridge]   party relay  -> POST /msg, GET /msg?to=<name>&since=<seq>")
    print(f"[bridge]   trades       -> POST /trade, GET /trades (raw=1 for events)")
    print(f"[bridge]   status       -> http://{a.host}:{a.port}/status")
    print(f"[bridge]   logging {'off (--quiet)' if a.quiet else 'on - one line per scan and relayed message'}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] stopped")


if __name__ == "__main__":
    main()
