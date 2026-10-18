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
import re
import threading
import time
import urllib.request
from collections import deque
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


# ---------------------------------------------------------------- bosses
#
# Why the poller lives here and not in a character script: server.status
# (parent.S) describes only the shard the character holding it is connected
# to, so no script can see a boss on another server. ALData is the only
# cross-server source. Running one poller in the bridge also means the hp
# history survives a CODE restart or a character hop, and four characters
# share one caller against a free third-party API instead of opening four.
ALDATA_BASE = "https://aldata.earthiverse.ca"
# Measured from a browser on 2026-10-17: ALData entries were 12-30s stale when
# sampled, so polling much faster mostly re-reads the same cached value. At 45s
# a 36M boss dying at ~22k dps still yields roughly 27 samples over its life.
BOSS_POLL_SECONDS = 45
BOSS_HTTP_TIMEOUT = 15
# How far back a sample stays eligible for the dps window.
BOSS_SAMPLE_WINDOW = 5 * 60
# Hard cap per (type, server), so a long-lived boss cannot grow a buffer
# without bound.
BOSS_SAMPLE_CAP = 48
# age_sec above this marks a row stale.
BOSS_STALE_AFTER = 120

# Kill log. Append-only JSONL, written by the poller AT THE TRANSITION, because
# the death timestamp cannot be recovered afterwards: once a boss respawns,
# `estimated_respawn` goes null and `lastSeen` with it, so polling /bosses after
# the fact can never reconstruct a kill. Default lives next to ledger.jsonl.
BOSS_EVENTS_PATH = "./data/boss_events.jsonl"
# A boss going ABSENT from the response is not a death - a 429 or a partial
# answer looks identical. Measured 2026-10-17 on a real cycle:
# last_error "HTTPError: HTTP Error 429: Too Many Requests", recovered by
# itself. Absence is only ever recorded as `lost`, never as a kill, and not
# until this many consecutive SUCCESSFUL polls have failed to list it.
BOSS_ABSENT_CONFIRM = 3
# A transition seen across a gap wider than this many poll intervals is logged
# `confidence: "low"` - the event is real, the timestamp is poorly bounded.
# Low rows stay in the file and are excluded from medians by default.
BOSS_GAP_HIGH_CONF = 2

# Nominal respawn seconds per type. MEASURED FROM THE DEPLOYED CLIENT by the
# browser session on 2026-10-17, reading G.monsters[<type>].respawn, and that
# is the only reason these are trustworthy.
#
# The creator's design/monsters.js DISAGREES with the running client on two of
# them, and the shape of the disagreement is worth keeping. There, greenjr
# reads `480 && 12*72*60` and jr `480 && 6*72*60`; evaluated as JavaScript
# those are 51840 and 25920, because && yields the right operand. The client
# reports 480 for both. mvampire, whose source entry is a plain `18*60`,
# agrees at 1080 - so source and client part company exactly where the source
# carries the && form, and nowhere else. rimedjinn is absent from the source
# file altogether and the client reports 12.
#
# This file previously carried the evaluated source values. They were wrong,
# and they were wrong in the way CLAUDE.md warns about: the mongodb repo is
# the SERVER SOURCE, not a mirror of what is deployed. Do not re-derive this
# table from it.
#
# What the table is for: ALData's estimatedRespawn is death plus the nominal
# respawn, so death = estimatedRespawn - this. Verified for mrgreen, where
# 94*60 = 5640 reproduced a death time projected independently from hp and
# dps. It decodes a death; it does NOT predict a return, because the server
# randomises the actual respawn (node/server.js:13096 schedules a respawn
# above 200 at respawn * (720 + random*480) ms).
#
# -1 in the client means event-only, no automatic respawn. Those types are
# omitted rather than stored, so a lookup miss is the single "unknown" path
# and no timer is ever computed for them: franky, icegolem, crabxx, bgoo,
# rgoo.
BOSS_RESPAWN_SEC = {
    "mrgreen": 5640,
    "mrpumpkin": 3240,
    "greenjr": 480,
    "jr": 480,
    "phoenix": 32,
    "rharpy": 400,
    "slenderman": 600,
    "snowman": 3600,
    "dragold": 10800,
    "grinch": 43200,
    "wabbit": 3600,
    "pinkgoo": 3600,
    "tiger": 1800,
    "mvampire": 1080,    # not in BOSS_TYPES; kept so the constant is not lost
    "bscorpion": 6,
    "ent": 12,
    "rimedjinn": 12,
}
# ---------------------------------------------------- daily / nightly windows
#
# READ FROM THE SERVER SOURCE, NOT MEASURED. Everything in this block comes
# from kaansoral/adventureland_mongodb and has NOT been confirmed against the
# running game. The respawn table above was derived the same way once and was
# wrong, so treat these as a lead: S.schedule IS exposed to the client
# (js/functions.js:5765 reads S.schedule.time_offset), which makes them
# checkable from a browser in one call.
#
# The mechanism, server_functions.js:2321-2345. Each server computes a game
# hour `ch = (UTC_hour + 24 + E.schedule.time_offset) % 24` and fires a daily
# when ch hits an hour in E.schedule.dailies, a nightly for E.schedule
# .nightlies. So a window's UTC hour is (game_hour - offset) mod 24, and the
# offset is per REGION, not per server: server.js:316 sets
# E.schedule.time_offset = TIMEO[region]. Every US shard therefore runs the
# same clock as every other US shard.
#
# Quirk worth knowing: `last_daily` at server_functions.js:2330 and :2339 is
# ONE variable shared by both loops, so if a daily hour ever equalled a
# nightly hour only one of them would fire. The configured hours do not
# collide, so this is latent rather than live.
SCHEDULE_REGION_OFFSET = {"EU": 1, "US": -5, "ASIA": 7}   # server.js:291 TIMEO
SCHEDULE_DAILY_HOURS = [13, 20]                           # server.js:164
SCHEDULE_NIGHTLY_HOURS = [23]                             # server.js:165
# server.js:281-284. BOTH LISTS ARE shuffle()d AT SERVER START, so which event
# a given window fires is per-process, differs between shards and changes on
# every restart. It cannot be predicted from outside - only observed, which is
# what the `observed` field below does.
SCHEDULE_DAILY_EVENTS = ["crabxx", "goobrawl", "abtesting"]
SCHEDULE_NIGHTLY_EVENTS = ["icegolem", "franky"]
# design/events.js durations, seconds.
SCHEDULE_EVENT_SEC = {"crabxx": 2400, "goobrawl": 540, "abtesting": 480,
                      "icegolem": 2400, "franky": 2400}
# Only events that spawn a MONSTER can ever be observed through ALData, so
# goobrawl and abtesting are permanently invisible here - their absence from
# a window says nothing about whether they ran.
SCHEDULE_OBSERVABLE = {"crabxx", "icegolem", "franky"}
# Seed list for servers the poller has not seen yet. Measured by the browser
# session 2026-10-17; the live set from ALData is preferred whenever there is
# one.
SCHEDULE_SEED_SERVERS = [
    "ASIA I", "ASIA II", "EU I", "EU II", "EU III", "EU IV", "EU PVP",
    "US I", "US II", "US III", "US IV", "US PVP", "US V",
]

# Shards a scout is never sent to. Mirrors CONFIG.scout.skipServers in
# Party/Merchant.js; the README's reason is that a parked scout on PVP is a
# free kill. The client filters too, so this is belt and braces - but it also
# keeps PVP out of the PARKED assignment pool below, which the client cannot
# do for itself.
SCOUT_SKIP_SHARDS = {"PVP"}
# How often the shard list is re-read from the page.
SHARD_LIST_REFRESH_SEC = 6 * 60 * 60

# POPULATION HISTORY. The shard list above refreshes four times a day, which
# is enough to keep the scout pool correct and useless for the question this
# records: which shard is quiet IN THE HOURS SOMEONE ACTUALLY PLAYS. A 6h
# sample cannot resolve a play window, so population gets its own cadence.
# 15 minutes is 96 page reads a day against a page the bridge already reads;
# raise POPULATION_SAMPLE_SEC if that is not wanted.
#
# One spot reading is actively misleading, which is the reason this exists:
# measured 2026-10-18, US IV showed 33 players and US II 53, so the shard
# that was abandoned for being busy now reads as the emptiest non-PVP US
# server. Either number alone argues the wrong move.
POPULATION_SAMPLE_SEC = 15 * 60
POPULATION_PATH = "./data/population.jsonl"
POPULATION_MAX_ROWS = 40000          # ~14 months at 96/day; trimmed on startup

# A server needs at least this many logged kills before its ranking row counts
# as a trend rather than an anecdote. The page greys out anything below it.
BOSS_MIN_KILLS_FOR_TREND = 5
# 429 backoff. The 45s interval sits close to whatever ALData's rate limit is -
# a real cycle on 2026-10-17 returned "HTTP Error 429: Too Many Requests" and
# recovered on its own. Each consecutive failure doubles the wait, capped here;
# one success returns to the configured interval.
BOSS_BACKOFF_MAX_SEC = 15 * 60

# Boss data source. "server_info" is the game's own broadcast, reached over
# engine.io long-polling; "aldata" is the original third-party poll, kept
# selectable as a fallback. server_info wins on every axis that matters:
# first-party rather than a third party, pushed rather than polled so no rate
# limit (the ALData path really did hit a 429), max_hp GIVEN rather than
# inferred from the largest value seen, and `spawn` the server's own field
# rather than a derivation. A full sweep measured 5.3s against 45s.
BOSS_SOURCE = "server_info"
SI_HTTP_TIMEOUT = 15
SI_READ_SLACK = 5           # added to pingTimeout for the long-poll read
SI_RECONNECT_BASE = 5
SI_RECONNECT_MAX = 5 * 60
SI_SERVER_LIST_URL = "https://adventure.land"
# Seed list, measured 2026-10-17. The live list is fetched from the page
# first - that is where the browser gets it, so it follows a new server - and
# this is the fallback when that fetch fails.
SI_SEED_SERVERS = [
    {"name": "I", "region": "EU", "address": "de.adventure.land", "path": "/ws1/"},
    {"name": "II", "region": "EU", "address": "de.adventure.land", "path": "/ws2/"},
    {"name": "III", "region": "EU", "address": "de.adventure.land", "path": "/ws3/"},
    {"name": "IV", "region": "EU", "address": "de.adventure.land", "path": "/ws4/"},
    {"name": "PVP", "region": "EU", "address": "de.adventure.land", "path": "/wspvp/"},
    {"name": "I", "region": "US", "address": "na2.adventure.land", "path": "/ws1/"},
    {"name": "II", "region": "US", "address": "na2.adventure.land", "path": "/ws2/"},
    {"name": "III", "region": "US", "address": "na2.adventure.land", "path": "/ws3/"},
    {"name": "IV", "region": "US", "address": "na2.adventure.land", "path": "/ws4/"},
    {"name": "V", "region": "US", "address": "na2.adventure.land", "path": "/ws5/"},
    {"name": "PVP", "region": "US", "address": "na2.adventure.land", "path": "/wspvp/"},
    {"name": "I", "region": "ASIA", "address": "sg.adventure.land", "path": "/ws1/"},
    {"name": "II", "region": "ASIA", "address": "sg.adventure.land", "path": "/ws2/"},
]

# The 15 ids in allBosses plus the 6 cooperative monsters Ranger.js lists
# separately in attackIfTargeted. Verified against Party/Ranger.js:186 and
# :256 on 2026-10-17. ALData's README states cutebee and goldenbat are
# excluded from its results; that exclusion was not re-checked from here, so
# treat adding either as untested rather than as a fix.
BOSS_TYPES = [
    "bgoo", "bscorpion", "crabxx", "dragold", "ent", "franky", "greenjr",
    "grinch", "icegolem", "jr", "mrgreen", "mrpumpkin", "phoenix", "rgoo",
    "wabbit",
    "pinkgoo", "rharpy", "rimedjinn", "slenderman", "snowman", "tiger",
]


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


# ---------------------------------------------------------- the shard list
#
# Shared by the boss poller and the scout planner, and READ-ONLY where it
# matters: _plan() runs inside the Store lock, so it must never do I/O. This
# is pre-seeded from the measured list, refreshed off the lock by a daemon,
# and simply read by the planner.
_SHARD_KEYS: dict = {"keys": [], "source": "seed", "at": 0.0}
_SHARD_LOCK = threading.Lock()


def shard_keys() -> list:
    with _SHARD_LOCK:
        return list(_SHARD_KEYS["keys"])


def shard_list_state() -> dict:
    with _SHARD_LOCK:
        return {"source": _SHARD_KEYS["source"], "count": len(_SHARD_KEYS["keys"]),
                "age_sec": round(now() - _SHARD_KEYS["at"]) if _SHARD_KEYS["at"] else None}


def set_shard_keys(servers, source: str) -> None:
    """Publish a server list. An empty one is ignored, so a failed fetch
    leaves the seed in place rather than emptying the pool."""
    keys = [shard_key(str(sv.get("region")), str(sv.get("name")))
            for sv in (servers or [])
            if sv.get("region") and sv.get("name")
            and str(sv.get("name")) not in SCOUT_SKIP_SHARDS]
    if not keys:
        return
    with _SHARD_LOCK:
        _SHARD_KEYS.update({"keys": keys, "source": source, "at": now()})


def fetch_shard_list() -> list:
    """The live list from the page. Caller runs this OFF the Store lock."""
    req = urllib.request.Request(SI_SERVER_LIST_URL,
                                 headers={"User-Agent": "al-market-bridge"})
    with urllib.request.urlopen(req, timeout=SI_HTTP_TIMEOUT) as r:
        return servers_from_html(r.read().decode("utf-8", "replace"))


def shard_list_refresher(stop_evt) -> None:
    while True:
        try:
            rows = fetch_shard_list()
            if rows:
                set_shard_keys(rows, SI_SERVER_LIST_URL)
                say("[scout] shard list: %d from %s" % (len(shard_keys()), SI_SERVER_LIST_URL))
            else:
                say("[scout] shard list: page gave none, keeping %d" % len(shard_keys()))
        except Exception as e:
            say("[scout] shard list: %s: %s - keeping %d"
                % (type(e).__name__, e, len(shard_keys())))
        if stop_evt.wait(SHARD_LIST_REFRESH_SEC):
            return


def population_row(servers) -> dict:
    """One sample: every shard's player count at one instant.

    PVP is KEPT here even though SCOUT_SKIP_SHARDS drops it from the scout
    pool - it costs two integers and a PVP shard's population is a real
    signal about where people went."""
    counts = {}
    for sv in (servers or []):
        if not (sv.get("region") and sv.get("name")):
            continue
        if not isinstance(sv.get("players"), int):
            continue
        counts[shard_key(str(sv["region"]), str(sv["name"]))] = sv["players"]
    return {"at": round(now(), 1), "counts": counts}


def population_append(row: dict, path: str) -> None:
    """Append one sample. Same shape as the boss-event ledger: one JSON
    object per line, opened per write rather than held, so a crash costs the
    current sample and never the file."""
    if not row.get("counts"):
        return
    try:
        p = pathlib.Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, separators=(",", ":")) + "\n")
    except Exception as e:
        say("[pop] append failed: %s: %s" % (type(e).__name__, e))


def population_read(path: str, hours: float | None = None) -> list:
    """Rows newest-last. A short file is read whole; hours trims the window.
    A malformed line is skipped rather than failing the read, because one bad
    append must not make the history unreadable."""
    cut = (now() - hours * 3600.0) if hours else None
    out = []
    try:
        p = pathlib.Path(path)
        if not p.exists():
            return []
        with p.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                if not isinstance(row, dict) or "counts" not in row:
                    continue
                if cut is not None and float(row.get("at") or 0) < cut:
                    continue
                out.append(row)
    except Exception as e:
        say("[pop] read failed: %s: %s" % (type(e).__name__, e))
    return out


def population_summary(rows: list) -> dict:
    """Per shard: samples, min, max, mean, and the latest reading.

    The MEAN is the number worth moving house on and the single reading is
    the one that misleads - see the US II / US IV note at POPULATION_*."""
    agg = {}
    for row in rows:
        for key, n in (row.get("counts") or {}).items():
            if not isinstance(n, int):
                continue
            a = agg.setdefault(key, {"n": 0, "sum": 0, "min": n, "max": n, "last": n})
            a["n"] += 1
            a["sum"] += n
            a["min"] = min(a["min"], n)
            a["max"] = max(a["max"], n)
            a["last"] = n
    out = {}
    for key, a in agg.items():
        out[key] = {"samples": a["n"], "min": a["min"], "max": a["max"],
                    "mean": round(a["sum"] / a["n"], 1) if a["n"] else None,
                    "last": a["last"]}
    return out


def population_by_hour(rows: list, key: str) -> dict:
    """One shard's mean population per hour of the LOCAL day.

    This is the whole point of sampling at 15 minutes instead of 6 hours: a
    shard that is quiet at 03:00 and heaving at 20:00 is not a quiet shard if
    20:00 is when it gets played."""
    buckets = {}
    for row in rows:
        n = (row.get("counts") or {}).get(key)
        if not isinstance(n, int):
            continue
        h = time.localtime(float(row.get("at") or 0)).tm_hour
        b = buckets.setdefault(h, {"n": 0, "sum": 0})
        b["n"] += 1
        b["sum"] += n
    return {str(h): round(b["sum"] / b["n"], 1)
            for h, b in sorted(buckets.items()) if b["n"]}


def population_sampler(stop_evt) -> None:
    """Its own thread and its own interval, deliberately not folded into
    shard_list_refresher: that one runs every 6h because the scout pool does
    not move, and a 6h population sample answers nothing."""
    while True:
        try:
            rows = fetch_shard_list()
            row = population_row(rows)
            if row.get("counts"):
                population_append(row, POPULATION_PATH)
            else:
                say("[pop] page gave no player counts this pass")
        except Exception as e:
            say("[pop] sample failed: %s: %s" % (type(e).__name__, e))
        if stop_evt.wait(POPULATION_SAMPLE_SEC):
            return


def html_escape(s: str) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def shard_key(region: str, name: str) -> str:
    return f"{region}{name}"

def parse_ts(v) -> float | None:
    """Seconds since the epoch from whatever shape a timestamp arrives in.

    Returns None rather than guessing. The exact shape ALData uses for
    lastSeen was not verified from the container that wrote this, so both the
    numeric and the ISO-8601 readings are attempted and an unrecognised value
    is reported as unknown. Silently becoming 1970 would turn a missing
    timestamp into an enormous age_sec, which reads as a confident "very
    stale" instead of "we do not know"."""
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        # Milliseconds if far larger than a plausible epoch second.
        return float(v) / 1000.0 if v > 1e11 else float(v)
    if not isinstance(v, str):
        return None
    s = v.strip()
    if not s:
        return None
    if s.endswith("Z") or s.endswith("z"):
        s = s[:-1] + "+00:00"
    # fromisoformat rejects more than 6 fractional digits before 3.11.
    m = re.match(r"^(.*\.\d{6})\d+(.*)$", s)
    if m:
        s = m.group(1) + m.group(2)
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()



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

        # WHEN THE STANDS WERE SEEN, not when the post arrived.
        #
        # These were the same thing until the scout learned to buffer. They are
        # not the same thing after an outage: unsent findings are held, stamped
        # with the shard they were seen on, and flushed when the bridge returns
        # - and a measured run left an 8-shard backlog sitting in storage for an
        # hour. Stamping those with ingest time would publish hour-old stands as
        # seconds old, which is precisely what sellMaxAgeSec exists to prevent,
        # and the executor would travel to them.
        #
        # Note the consequence for a LONG outage: an observation older than
        # MERCHANT_TTL is stored and then evicted in the same call, so the
        # scout is told it was accepted and clears its buffer. That is the
        # right outcome - the bridge's own TTL says data that old is worthless,
        # and the alternative is a scout carrying dead rows forever - but it
        # means a flush after an hour down is a discard, not a recovery.
        #
        # Clamped so a skewed clock cannot buy freshness: never newer than the
        # bridge's own now. The relay crosses a LAN for the second account, so
        # the two clocks are not guaranteed to agree. Unparseable falls back to
        # ingest time, which is the old behaviour and is the safe direction for
        # a source that cannot say when it looked.
        seen_at = t
        raw_at = body.get("at")
        if raw_at:
            try:
                parsed = datetime.fromisoformat(str(raw_at).replace("Z", "+00:00")).timestamp()
                seen_at = min(parsed, t)
            except (ValueError, TypeError):
                pass

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

                # A character is on exactly ONE shard at a time, so seeing a
                # merchant here is positive evidence it is not where we last
                # saw it. Rows are keyed "<shard>|<name>", so a merchant that
                # hopped left a copy behind on its old shard - and nothing
                # removed it, because only its old shard's own rescan deletes
                # those, and that may be a whole rotation away. Until then the
                # watchlist showed the same trader in two places, and a
                # merchant acting on the stale one would hop to a shard the
                # trader had already left: a page reload, and hop sickness,
                # spent on nothing.
                #
                # Character names are unique account-wide and cannot contain
                # "|", so splitting on the first one is safe.
                here = {r["id"] for r in seen
                        if isinstance(r, dict) and r.get("id")}
                for k in [k for k in self.merchants
                          if not k.startswith(key + "|")
                          and k.split("|", 1)[-1] in here]:
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
                        "lastSeen": iso(seen_at),
                        "via": char,
                    }
                stands = len(seen)
                listings = sum(len(r.get("slots") or {}) for r in seen if isinstance(r, dict))
                # Activity drives the staleness ranking a roamer is steered by,
                # so it wants the observation time too - a flushed backlog must
                # not make a shard look freshly covered.
                self.activity[key] = {"stands": stands, "listings": listings, "at": seen_at}

            pon = body.get("ponty")
            if isinstance(pon, list):
                self.ponty[key] = {"at": iso(seen_at), "items": pon}
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
            # EVERY shard, not only the ones already scanned. `known` comes
            # from self.activity, which only a completed scan writes, so a
            # beat built from it alone is a closed loop: a shard enters the
            # beat once it has been scanned, and is scanned only once it is in
            # the beat. Whatever happened to be in the table when the beat
            # first filled became the merchant's whole world - measured
            # 2026-10-17, it was cycling three shards out of eleven.
            #
            # The rotation branch in Merchant.js's scoutNextShard already
            # prepends never-seen shards for exactly this reason, but a roamer
            # takes the BEAT branch above it and that one had no equivalent.
            # Fixing it here rather than there also avoids a race: dealing the
            # unseen shards out round-robin below means two roamers are handed
            # different ones, where a client-side fix would have every roamer
            # chase the same unscanned shard until the first scan landed.
            #
            # Unseen shards lead the beat for free: staleness() scores an
            # absent entry at `t - 0`, which sorts first.
            free = sorted({k for k in known if k not in parked_shards}
                          | {k for k in shard_keys() if k not in parked_shards})
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
                "shardList": shard_list_state(),
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


# ---------------------------------------------------------------- kill log
#
# Readers for the append-only file BossWatch writes. Kept out of the class
# because they are pure functions of the file, and the page polls them far
# more often than the poller writes.
_BOSS_CACHE = {"sig": None, "rows": None}


def boss_events_load(path) -> list[dict]:
    """Every event in the log, oldest first. Cached on (mtime, size).

    One corrupt line is skipped rather than taking the history with it -
    the same rule the trade ledger uses, and for the same reason: this file
    is appended to by a thread that can be killed mid-write."""
    if not path:
        return []
    try:
        st = os.stat(path)
    except OSError:
        return []
    sig = (st.st_mtime_ns, st.st_size)
    if _BOSS_CACHE["sig"] == sig:
        return _BOSS_CACHE["rows"]
    rows = []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                if isinstance(d, dict) and d.get("ev"):
                    rows.append(d)
    except OSError:
        return []
    _BOSS_CACHE["sig"], _BOSS_CACHE["rows"] = sig, rows
    return rows


def _pct(xs, q):
    """Linear-interpolated percentile, q in 0..1. None for an empty list."""
    s = sorted(xs)
    if not s:
        return None
    if len(s) == 1:
        return float(s[0])
    pos = q * (len(s) - 1)
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    frac = pos - lo
    return round(s[lo] + (s[hi] - s[lo]) * frac, 1)


def schedule_windows(servers, path=None, hours_ahead=48, hours_back=24) -> dict:
    """Daily and nightly windows per server, as UTC instants.

    Everything crossing the wire here is UTC, exactly like /bosses. The page
    renders it with Intl and a named zone. Nothing computes a local offset
    server-side: the game's own region offsets are FIXED (EU +1, US -5,
    ASIA +7) and do not follow daylight saving, so a window sits at a
    constant UTC hour all year while its wall-clock time in America/New_York
    moves an hour when US DST ends on 2026-11-01. A hardcoded -04:00 would be
    silently wrong from that night on; a named zone is not.

    `observed` closes the loop where it can. Which event a window fires is
    shuffled per server process and unknowable from outside, but crabxx,
    icegolem and franky are monsters, so a spawn logged inside the window
    names the event that actually ran. goobrawl and abtesting are not
    monsters and can never appear, so a null `observed` is "not known",
    never "nothing happened"."""
    t_now = now()
    spawns: dict = {}
    for d in boss_events_load(path):
        if d.get("ev") != "spawn" or d.get("type") not in SCHEDULE_OBSERVABLE:
            continue
        ts = parse_ts(d.get("t"))
        if ts:
            spawns.setdefault(d.get("server"), []).append((ts, d["type"]))

    out = []
    for server in sorted(set(servers) or set(SCHEDULE_SEED_SERVERS)):
        region = server.split(" ")[0].upper()
        offset = SCHEDULE_REGION_OFFSET.get(region)
        if offset is None:
            continue                       # unknown region: no clock to compute
        rows = []
        for kind, game_hours, pool in (
                ("daily", SCHEDULE_DAILY_HOURS, SCHEDULE_DAILY_EVENTS),
                ("nightly", SCHEDULE_NIGHTLY_HOURS, SCHEDULE_NIGHTLY_EVENTS)):
            for gh in game_hours:
                utc_hour = (gh - offset + 24) % 24
                # Walk whole UTC days around now so a window that already
                # opened today is still listed while it is running.
                base = (t_now // 86400) * 86400
                for day in range(-(hours_back // 24) - 1, hours_ahead // 24 + 2):
                    at = base + day * 86400 + utc_hour * 3600
                    if at < t_now - hours_back * 3600 or at > t_now + hours_ahead * 3600:
                        continue
                    longest = max(SCHEDULE_EVENT_SEC.get(e, 0) for e in pool)
                    seen = None
                    for ts, mtype in spawns.get(server, []):
                        if at <= ts <= at + longest:
                            seen = mtype
                            break
                    rows.append({
                        "kind": kind, "game_hour": gh, "utc_hour": utc_hour,
                        "at": iso(at), "in_sec": round(at - t_now),
                        "candidates": list(pool),
                        "observable": sorted(set(pool) & SCHEDULE_OBSERVABLE),
                        "observed": seen,
                        "window_sec": longest,
                        "running": at <= t_now <= at + longest,
                    })
        rows.sort(key=lambda r: r["at"])
        out.append({"server": server, "region": region, "time_offset": offset,
                    "windows": rows})
    return {
        "now": iso(t_now),
        "source": "server source (kaansoral/adventureland_mongodb), NOT measured live",
        "region_offset": SCHEDULE_REGION_OFFSET,
        "daily_hours_game": SCHEDULE_DAILY_HOURS,
        "nightly_hours_game": SCHEDULE_NIGHTLY_HOURS,
        "daily_events": SCHEDULE_DAILY_EVENTS,
        "nightly_events": SCHEDULE_NIGHTLY_EVENTS,
        "never_observable": sorted(
            set(SCHEDULE_DAILY_EVENTS + SCHEDULE_NIGHTLY_EVENTS) - SCHEDULE_OBSERVABLE),
        "servers": out,
    }


def boss_history(path, want_type=None, want_server=None, since=None,
                 include_low=False) -> dict:
    """Per (type, server) kill history - the view the home-server call rests on.

    Low-confidence rows stay in the file and are counted, but are kept OUT of
    the medians and percentiles unless asked for: a kill whose timestamp is
    bounded only by a wide poll gap still tells you the boss died there, and
    tells you very little about how long it took.

    stalled_count is the figure that a median TTK cannot show. A server where
    the boss spawns and is then nibbled and abandoned looks fine on TTK -
    there simply are no TTKs - and is the worst possible home. Measured
    2026-10-17: ASIA I held 28,088,505 hp for 40+ minutes and US III
    15,417,063 for 24+. A stall is a spawn whose next same-type, same-server
    spawn arrives with no death in between."""
    rows = boss_events_load(path)
    if since:
        rows = [r for r in rows if (r.get("t") or "") >= since]
    agg: dict[tuple, dict] = {}
    seq: dict[tuple, list] = {}
    for d in rows:
        mtype, server = d.get("type"), d.get("server")
        if not mtype or not server:
            continue
        if want_type and mtype.lower() != want_type:
            continue
        if want_server and server.lower() != want_server:
            continue
        k = (mtype, server)
        a = agg.setdefault(k, {
            "type": mtype, "server": server, "kills_logged": 0, "spawns": 0,
            "lost": 0, "ttks": [], "last_kill_t": None, "last_spawn_t": None,
            "first_t": None, "last_t": None,
            "confidence_counts": {"high": 0, "low": 0},
        })
        seq.setdefault(k, []).append(d)
        t = d.get("t")
        if t:
            if a["first_t"] is None or t < a["first_t"]:
                a["first_t"] = t
            if a["last_t"] is None or t > a["last_t"]:
                a["last_t"] = t
        ev = d.get("ev")
        if ev == "spawn":
            a["spawns"] += 1
            if t and (a["last_spawn_t"] is None or t > a["last_spawn_t"]):
                a["last_spawn_t"] = t
        elif ev == "lost":
            a["lost"] += 1
        elif ev == "death":
            a["kills_logged"] += 1
            c = "high" if d.get("confidence") == "high" else "low"
            a["confidence_counts"][c] += 1
            if t and (a["last_kill_t"] is None or t > a["last_kill_t"]):
                a["last_kill_t"] = t
            if isinstance(d.get("ttk_sec"), (int, float)) and (include_low or c == "high"):
                a["ttks"].append(d["ttk_sec"])

    out = []
    for k, a in agg.items():
        # Stall: spawn -> next spawn with no death between the two.
        ordered = sorted(seq[k], key=lambda d: d.get("t") or "")
        stalls, open_spawn = 0, False
        for d in ordered:
            if d.get("ev") == "spawn":
                if open_spawn:
                    stalls += 1
                open_spawn = True
            elif d.get("ev") == "death" and open_spawn:
                open_spawn = False
        a["stalled_count"] = stalls
        ttks = a.pop("ttks")
        a["ttk_median_sec"] = _pct(ttks, 0.5)
        a["ttk_p25_sec"] = _pct(ttks, 0.25)
        a["ttk_p75_sec"] = _pct(ttks, 0.75)
        a["ttk_min_sec"] = min(ttks) if ttks else None
        a["ttk_max_sec"] = max(ttks) if ttks else None
        a["ttk_sample"] = len(ttks)
        lo, hi = parse_ts(a.pop("first_t")), parse_ts(a.pop("last_t"))
        win = round(hi - lo) if (lo and hi and hi > lo) else 0
        a["observed_window_sec"] = win
        # Capped at the physical maximum. Measured 2026-10-17: EU IV mrgreen
        # reported 152.11 kills/day off ONE kill in a 568-second window,
        # against a ceiling of 15.32 for a 5,640s respawn - a short window
        # divides a single kill into a huge rate, and boss_timers.html sorts
        # the home-server table on exactly this number, so the least reliable
        # row led it. Both the raw and the cap are kept so the capping is
        # visible rather than silent.
        rs = BOSS_RESPAWN_SEC.get(a["type"])
        raw = (a["kills_logged"] / (win / 86400.0)) if win else None
        cap = (86400.0 / rs) if rs else None
        a["kills_per_day_raw"] = round(raw, 2) if raw is not None else None
        a["kills_per_day_cap"] = round(cap, 2) if cap else None
        a["rate_capped"] = bool(raw is not None and cap and raw > cap)
        a["kills_per_day"] = (round(min(raw, cap), 2) if (raw is not None and cap)
                              else (round(raw, 2) if raw is not None else None))
        a["enough_data"] = a["kills_logged"] >= BOSS_MIN_KILLS_FOR_TREND
        out.append(a)
    # Thin rows sort BELOW every qualified row, not merely lower. Capping
    # alone does not fix the defect above: a capped 15.32 off one kill still
    # outranks a real 12 earned over days.
    out.sort(key=lambda r: (not r["enough_data"], -(r["kills_per_day"] or 0),
                            r["type"], r["server"]))
    return {
        "now": iso(now()),
        "log": str(path) if path else None,
        "min_kills_for_trend": BOSS_MIN_KILLS_FOR_TREND,
        "medians_include_low_confidence": bool(include_low),
        "events": len(rows),
        "deaths": sum(1 for d in rows if d.get("ev") == "death"),
        "spawns": sum(1 for d in rows if d.get("ev") == "spawn"),
        "lost": sum(1 for d in rows if d.get("ev") == "lost"),
        "first_event": rows[0].get("t") if rows else None,
        "last_event": rows[-1].get("t") if rows else None,
        "history": out,
    }


# ------------------------------------------------- engine.io / socket.io v4
#
# The boss poller talks to the game's own servers rather than a third party,
# and it does so over engine.io HTTP long-polling with nothing but
# urllib.request. No python-socketio, and the zero-dependency property of
# this file is deliberate.
#
# Polling is open on the socket we want: node/server.js:52 constructs the main
# io server with path, pingInterval, pingTimeout and cors and NO `transports`
# option, so it keeps the default ["polling", "websocket"]. Only the separate
# msgpack server at :60 is websocket-only.
#
# No auth is needed. server_functions.js:2961 does broadcast("server_info", E)
# and broadcast() blanket-emits to every connected socket with no player
# check, which is why an anonymous socket that completes the handshake
# receives it.
#
# The exchange:
#   GET  {path}socket.io/?EIO=4&transport=polling
#        -> 0{"sid":...,"pingInterval":4000,"pingTimeout":12000}
#   POST {path}socket.io/?EIO=4&transport=polling&sid=SID   body: 40
#   GET  {path}socket.io/?EIO=4&transport=polling&sid=SID
#        -> 40{"sid":...}   then   42["server_info",{...}]
#
# Packets in one polling body are separated by U+001E. Engine.io types: 0
# open, 1 close, 2 ping, 3 pong, 4 message. Socket.io rides on 4: 40 CONNECT,
# 42 EVENT. A ping MUST be answered with a pong or the server drops the
# socket at pingTimeout.
EIO_SEP = "\x1e"


def eio_packets(body: str) -> list:
    """Split one polling body into engine.io packets."""
    return [p for p in (body or "").split(EIO_SEP) if p != ""]


def eio_parse(pkt: str):
    """One engine.io packet -> (kind, name, data).

    kind is 'open', 'ping', 'close', 'connect', 'event' or 'other'. Anything
    unrecognised is 'other' rather than an exception: this is a wire format
    from a server we do not control, and a packet shape we have not seen
    before must not take the poller down."""
    if not pkt:
        return ("other", None, None)
    t = pkt[0]
    if t == "0":
        try:
            return ("open", None, json.loads(pkt[1:]))
        except Exception:
            return ("open", None, {})
    if t == "2":
        return ("ping", None, None)
    if t == "1":
        return ("close", None, None)
    if t != "4":
        return ("other", None, None)

    body = pkt[1:]
    if not body:
        return ("other", None, None)
    st, rest = body[0], body[1:]
    # Optional namespace: present only when it is not the default "/".
    if rest.startswith("/"):
        i = rest.find(",")
        rest = rest[i + 1:] if i >= 0 else ""
    # Optional ack id, digits between the namespace and the payload.
    j = 0
    while j < len(rest) and rest[j].isdigit():
        j += 1
    rest = rest[j:]

    if st == "0":
        try:
            return ("connect", None, json.loads(rest) if rest else None)
        except Exception:
            return ("connect", None, None)
    if st == "2":
        try:
            arr = json.loads(rest)
        except Exception:
            return ("other", None, None)
        if isinstance(arr, list) and arr:
            return ("event", arr[0], arr[1] if len(arr) > 1 else None)
    return ("other", None, None)


def servers_from_html(html: str) -> list:
    """Pull X.servers out of the adventure.land page.

    This is where the browser itself gets the list, so it stays correct when
    a server is added. A failure here is soft - the caller falls back to the
    seed list - because a layout change on a page we do not control must not
    stop the poller."""
    m = re.search(r"X\.servers\s*=\s*(\[.*?\])\s*;", html or "", re.S)
    if not m:
        return []
    try:
        rows = json.loads(m.group(1))
    except Exception:
        return []
    out = []
    for r in rows if isinstance(rows, list) else []:
        if isinstance(r, dict) and r.get("address") and r.get("name") and r.get("region"):
            row = {"name": str(r["name"]), "region": str(r["region"]),
                   "address": str(r["address"]), "path": str(r.get("path") or "/")}
            # players/online/pvp ride along in the SAME payload and were being
            # dropped here. set_shard_keys still reads only region+name, so
            # carrying them changes nothing upstream; the population sampler
            # is the only consumer.
            if isinstance(r.get("players"), int):
                row["players"] = r["players"]
            if isinstance(r.get("online"), bool):
                row["online"] = r["online"]
            if isinstance(r.get("pvp"), bool):
                row["pvp"] = r["pvp"]
            out.append(row)
    return out


class ServerInfoClient(threading.Thread):
    """Holds one long-polling socket open to one game server.

    Event-driven, NOT polled: broadcast_e() fires from the server's event
    loop when something changes, so a quiet server simply has nothing to say.
    Measured across all 13 on 2026-10-17: 11 answered, slowest 5,344ms, 2 did
    not answer within 9 seconds. A server that has not spoken is UNKNOWN, not
    dead - the connection is held open and the row stays stale rather than
    being reported live:false, which is the regression that would log false
    deaths."""

    def __init__(self, server: dict, on_event, stop_evt: threading.Event):
        super().__init__(name="si-" + server["region"] + server["name"], daemon=True)
        self.server = server
        self.on_event = on_event
        self._stop = stop_evt
        self.connected = False
        self.events = 0
        self.last_event = 0.0
        self.last_error: str | None = None
        self.fails = 0

    def _url(self, sid=None):
        s = self.server
        base = "https://%s%ssocket.io/?EIO=4&transport=polling" % (
            s["address"], s["path"] if s["path"].endswith("/") else s["path"] + "/")
        return base + ("&sid=" + sid if sid else "")

    def _get(self, url, timeout):
        req = urllib.request.Request(url, headers={"Accept": "*/*",
                                                   "User-Agent": "al-market-bridge"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")

    def _post(self, url, payload, timeout):
        req = urllib.request.Request(
            url, data=payload.encode("utf-8"), method="POST",
            headers={"Content-Type": "text/plain;charset=UTF-8",
                     "User-Agent": "al-market-bridge"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                self._session()
                self.fails = 0
            except Exception as e:
                self.connected = False
                self.fails += 1
                self.last_error = "%s: %s" % (type(e).__name__, e)
                if self.fails == 1:
                    say("[bosses] %s %s: %s" % (self.server["region"],
                                                self.server["name"], self.last_error))
            # Backoff on a dropped or refused socket, capped.
            if not self._stop.is_set():
                self._stop.wait(min(SI_RECONNECT_BASE * (2 ** min(self.fails, 6)),
                                    SI_RECONNECT_MAX))

    def _session(self) -> None:
        opened = self._get(self._url(), SI_HTTP_TIMEOUT)
        sid = ping_timeout = None
        for pkt in eio_packets(opened):
            kind, _n, data = eio_parse(pkt)
            if kind == "open" and isinstance(data, dict):
                sid = data.get("sid")
                ping_timeout = data.get("pingTimeout")
        if not sid:
            raise RuntimeError("no sid in handshake")
        # socket.io CONNECT on the default namespace.
        self._post(self._url(sid), "40", SI_HTTP_TIMEOUT)
        self.connected = True
        read_to = (float(ping_timeout or 12000) / 1000.0) + SI_READ_SLACK

        while not self._stop.is_set():
            body = self._get(self._url(sid), read_to)
            pong = False
            for pkt in eio_packets(body):
                kind, name, data = eio_parse(pkt)
                if kind == "ping":
                    pong = True
                elif kind == "close":
                    return                      # server hung up; reconnect
                elif kind == "event" and name == "server_info":
                    self.events += 1
                    self.last_event = now()
                    try:
                        self.on_event(self.server, data)
                    except Exception as e:
                        print("[bridge] server_info handler failed: %s" % e)
            if pong:
                # Unanswered, the server drops us at pingTimeout.
                self._post(self._url(sid), "3", SI_HTTP_TIMEOUT)


def server_info_entries(server: dict, payload, types) -> list:
    """Translate one server_info payload into ALData-shaped entries.

    Deliberately a translation layer rather than a second pipeline: the
    sampling, dps delta, transition guards and persistence below are
    unchanged and keep being exercised by the same code paths.

    Shapes measured 2026-10-17 across all 13 servers:
      live  {live, map, hp, max_hp, target, x, y}
      dead  {live, spawn}
    `target` stays sparse - a name, null, or the field absent on an
    untouched boss - so presence is preserved and has_target_field still
    means what it meant.

    lastSeen becomes OUR receive time, which is honest: the payload is
    pushed, so the moment it arrived IS the moment it was current. Each push
    therefore carries a distinct stamp and counts as a real observation,
    which is what the sample dedupe below wants."""
    out = []
    if not isinstance(payload, dict):
        return out
    seen_at = iso(now())
    wanted = set(types)
    for mtype, d in payload.items():
        if mtype not in wanted or not isinstance(d, dict):
            continue
        e = {"type": mtype, "serverRegion": server["region"],
             "serverIdentifier": server["name"]}
        if d.get("live"):
            e["hp"] = d.get("hp")
            e["max_hp"] = d.get("max_hp")
            e["map"] = d.get("map")
            e["x"] = d.get("x")
            e["y"] = d.get("y")
            e["lastSeen"] = seen_at
            if "target" in d:
                e["target"] = d.get("target")
        else:
            # Dead: the server's OWN scheduled respawn, not a derivation.
            # server_functions.js:2589 sets it as future_s(nominal respawn),
            # so subtracting BOSS_RESPAWN_SEC still recovers the death time -
            # that path uses the nominal value, not the randomised
            # monster_respawns delay at server.js:13097.
            if d.get("spawn"):
                e["estimatedRespawn"] = d.get("spawn")
        out.append(e)
    return out


class BossWatch:
    """Polls ALData for every boss type and keeps a short per-server hp history.

    The history is the whole point. An hp percentage does NOT distinguish a
    boss being actively killed from one abandoned half-dead. Measured
    2026-10-17 from the game's own server.status: ASIA I held 28,088,505 hp at
    10:16 and the identical value at 10:27 while sitting at 78%, and US III
    was unchanged over 80s at 42.8%, while US V lost 1,075,988 hp in 47s
    (22,866 aggregate dps) and EU III lost 2,836,886 in 132s (21,561). Three
    servers looked part-killed; two were abandoned. A party sent on the
    strength of a percentage arrives to solo a half-dead boss.

    Only a delta over time, or a non-null target, separates those cases, so
    this computes the delta once here rather than leaving four scripts to
    each keep their own state across hops and CODE restarts."""

    def __init__(self, types, interval: int = BOSS_POLL_SECONDS, enabled: bool = True,
                 events_path=None, source: str = BOSS_SOURCE):
        self.lock = threading.Lock()
        self.events_path = events_path
        self.fights: dict[tuple, dict] = {}      # (type, region, ident) -> fight state
        self.events_written = 0
        self.events_error: str | None = None
        self._pending: list[dict] = []
        self.source = source
        self.clients: list = []
        self.servers: list = []
        self._seeded_servers: set = set()   # per server, not per process
        self._last_poll_t = 0.0
        self.types = list(types)
        self.interval = max(5, int(interval))
        self.enabled = enabled
        self.samples: dict[tuple, object] = {}   # (type, region, ident) -> deque
        self.meta: dict[tuple, dict] = {}        # same key -> latest reading
        self.max_hp: dict[str, float] = {}       # type -> largest hp seen since start
        # server_info GIVES max_hp, so it stops being an inference. Kept
        # separate from the observed maximum so max_hp_source stays honest.
        self.max_hp_given: dict[str, float] = {}
        self.last_attempt = 0.0
        self.last_success = 0.0
        self.last_error: str | None = None
        self.fails = 0
        self.entries_last_poll = 0
        self._stop = threading.Event()

    # ------------------------------------------------------------- polling
    def start(self) -> None:
        if not self.enabled:
            return
        if self.source == "server_info":
            self.servers = self._server_list()
            for srv in self.servers:
                c = ServerInfoClient(srv, self._on_server_info, self._stop)
                self.clients.append(c)
                c.start()
            say("[bosses] server_info: holding %d sockets open" % len(self.clients))
            return
        threading.Thread(target=self._loop, name="bosswatch", daemon=True).start()

    def _server_list(self) -> list:
        """The live list from the page, falling back to the seed.

        A missing server is a soft failure by design - the fallback keeps the
        poller running on the 13 that were measured rather than crashing on a
        layout change in a page we do not control."""
        try:
            req = urllib.request.Request(SI_SERVER_LIST_URL,
                                         headers={"User-Agent": "al-market-bridge"})
            with urllib.request.urlopen(req, timeout=SI_HTTP_TIMEOUT) as r:
                rows = servers_from_html(r.read().decode("utf-8", "replace"))
            if rows:
                say("[bosses] server list: %d from %s" % (len(rows), SI_SERVER_LIST_URL))
                set_shard_keys(rows, SI_SERVER_LIST_URL)   # shared with the scout planner
                return rows
            say("[bosses] server list: page gave none, using the %d seeded"
                % len(SI_SEED_SERVERS))
        except Exception as e:
            say("[bosses] server list: %s: %s - using the %d seeded"
                % (type(e).__name__, e, len(SI_SEED_SERVERS)))
        return list(SI_SEED_SERVERS)

    def _on_server_info(self, server: dict, payload) -> None:
        """One pushed payload from one server.

        Scoped to THAT server. Running the transition pass over every tracked
        key on a single server's push would read all the others as absent and
        manufacture deaths for them, which is the one bug in here that would
        produce plausible numbers rather than an error."""
        entries = server_info_entries(server, payload, self.types)
        key = (str(server["region"]), str(server["name"]))
        t = now()
        seen = set()
        for e in entries:
            k = self._record(e)
            if k:
                seen.add(k)
        with self.lock:
            for k, m in self.meta.items():
                if (k[1], k[2]) == key:
                    m["present"] = k in seen
            self.last_success = t
            self.last_error = None
            self.fails = 0
            self.entries_last_poll = len(entries)
            try:
                self._transitions(t, len(entries), {key}, only_server=key,
                                  complete=isinstance(payload, dict) and bool(payload))
            except Exception as ex:
                print("[bridge] boss transition pass failed: %s" % ex)
        self._flush_events()

    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                self.poll_once()
            except Exception as e:
                # A poller must never take the bridge down. /merchants, /msg and
                # /trades are the live services here; boss data is an extra.
                print(f"[bridge] boss poller error: {e}")
            self._stop.wait(self._next_wait())

    def _next_wait(self) -> float:
        """Seconds until the next poll. Doubles per consecutive failure.

        45s sits close to whatever ALData's rate limit is - a real cycle
        returned 429 and recovered - so hammering the fixed interval through a
        rate-limit response is the one thing guaranteed to prolong it. One
        success returns to the configured interval."""
        with self.lock:
            fails = self.fails
        if fails <= 0:
            return self.interval
        return min(self.interval * (2 ** min(fails, 10)), BOSS_BACKOFF_MAX_SEC)

    def _fetch(self) -> list:
        # A comma-separated type list is one request for all of them. Types
        # with nothing alive are simply absent from the response.
        url = f"{ALDATA_BASE}/monsters/{','.join(self.types)}"
        req = urllib.request.Request(url, headers={
            "Accept": "application/json",
            "User-Agent": "al-market-bridge",
        })
        with urllib.request.urlopen(req, timeout=BOSS_HTTP_TIMEOUT) as r:
            code = getattr(r, "status", None) or r.getcode()
            if code != 200:
                raise RuntimeError(f"HTTP {code}")
            raw = r.read()
        data = json.loads(raw.decode("utf-8"))
        if isinstance(data, dict):
            return [data]
        if not isinstance(data, list):
            raise RuntimeError(f"expected a JSON array, got {type(data).__name__}")
        return data

    def poll_once(self) -> bool:
        self.last_attempt = now()
        try:
            data = self._fetch()
        except Exception as e:
            with self.lock:
                self.fails += 1
                self.last_error = f"{type(e).__name__}: {e}"
                first = self.fails == 1
                err = self.last_error
            # Logged on the transition only. At 45s a hard-down ALData would
            # otherwise print ~80 identical lines an hour and bury the scan log.
            if first:
                say(f"[bosses] ALData unreachable ({err}); serving cached rows")
            return False

        seen, servers_seen = set(), set()
        for entry in data:
            k = self._record(entry)
            if k:
                seen.add(k)
                servers_seen.add((k[1], k[2]))     # guard 2: this server answered
        poll_t = now()
        with self.lock:
            for k, m in self.meta.items():
                m["present"] = k in seen
            recovered = self.fails > 0
            self.fails = 0
            self.last_error = None
            self.last_success = poll_t
            self.entries_last_poll = len(data)
            # Only ever reached on a fully successful fetch - a throw above
            # returned long before this, so a failed poll can never be read
            # as "every boss vanished".
            try:
                self._transitions(poll_t, len(data), servers_seen)
            except Exception as e:
                print(f"[bridge] boss transition pass failed: {e}")
        self._flush_events()          # file IO outside the lock
        if recovered:
            say(f"[bosses] ALData back; {len(data)} entries")
        return True

    def _record(self, entry) -> tuple | None:
        if not isinstance(entry, dict):
            return None
        mtype = entry.get("type")
        if not mtype:
            return None
        key = (str(mtype), str(entry.get("serverRegion") or "?"),
               str(entry.get("serverIdentifier") or "?"))
        t = now()
        hp = entry.get("hp")
        hp = float(hp) if isinstance(hp, (int, float)) and not isinstance(hp, bool) else None
        # 'target' was present on only 4 of 13 entries in the 2026-10-17 sample
        # and non-null on 1, so absent and null are different answers and both
        # are kept. Never index this blindly.
        has_target = "target" in entry
        seen_raw = entry.get("lastSeen")
        seen_ts = parse_ts(seen_raw)

        with self.lock:
            if hp is not None:
                mg = entry.get('max_hp')
                if isinstance(mg, (int, float)) and not isinstance(mg, bool) and mg > 0:
                    self.max_hp_given[mtype] = float(mg)
                prev = self.max_hp.get(mtype)
                if prev is None or hp > prev:
                    self.max_hp[mtype] = hp
            buf = self.samples.get(key)
            if buf is None:
                buf = self.samples[key] = deque(maxlen=BOSS_SAMPLE_CAP)
            # Only readings ALData itself refreshed count as observations.
            # Re-reading its cache would otherwise look like a second
            # measurement and turn "unknown" into a confident 0 dps - which is
            # exactly the distinction this endpoint exists to preserve.
            if hp is not None and seen_raw is not None:
                prior = buf[-1] if buf else None
                if prior is None or prior["seen_raw"] != seen_raw:
                    if prior is not None and hp > prior["hp"]:
                        buf.clear()      # hp went UP: a new spawn, not damage
                    buf.append({"hp": hp, "seen_raw": seen_raw,
                                "seen_ts": seen_ts, "at": t})
            if hp:
                f = self.fights.get(key)
                if f is not None and f.get("alive"):
                    mx = self.max_hp.get(mtype)
                    f["last_hp"] = hp
                    f["last_pct"] = round(hp / mx * 100.0, 2) if mx else None
            self.meta[key] = {
                "entry": entry, "at": t, "hp": hp,
                "target": entry.get("target") if has_target else None,
                "has_target": has_target,
                "seen_raw": seen_raw, "seen_ts": seen_ts,
                "present": True,
            }
        return key

    # ------------------------------------------------------- the kill log
    #
    # Written at the transition and nowhere else. While a boss is dead its
    # death time is recoverable as estimated_respawn - BOSS_RESPAWN_SEC; the
    # moment it respawns that field goes null and the kill is gone for good.
    # `tracked` is memory only, so a bridge restart would lose it too. Hence
    # a file, appended the instant the poller sees the change.

    def _emit(self, ev: dict) -> None:
        """Queue one event. Written to disk by the caller, outside the lock."""
        self._pending.append(ev)

    def _flush_events(self) -> None:
        if not self._pending:
            return
        batch, self._pending = self._pending, []
        if not self.events_path:
            return
        try:
            with open(self.events_path, "a", encoding="utf-8") as fh:
                for ev in batch:
                    fh.write(json.dumps(ev, sort_keys=False) + "\n")
            self.events_written += len(batch)
            self.events_error = None
        except Exception as e:
            # Never let the log take the poller down; /bosses keeps working.
            self.events_error = f"{type(e).__name__}: {e}"
            print(f"[bridge] boss event log write failed: {self.events_error}")
        for ev in batch:
            if ev["ev"] == "death":
                ttk = ev.get("ttk_sec")
                say(f"[bosses] KILL {ev['type']} on {ev['server']}"
                    + (f" in {int(ttk // 60)}m{int(ttk % 60):02d}s" if ttk else " (ttk unknown)")
                    + f" [{ev['confidence']}]")
            elif ev["ev"] == "spawn":
                say(f"[bosses] up   {ev['type']} on {ev['server']} [{ev['confidence']}]")
            elif ev["ev"] == "lost":
                say(f"[bosses] lost {ev['type']} on {ev['server']} - {ev['reason']}"
                    f" (NOT counted as a kill)")

    def _transitions(self, poll_t: float, n_entries: int, servers_seen: set,
                     only_server: tuple | None = None, complete: bool = False) -> None:
        """Compare this poll against the last and record spawns and deaths.

        Reached ONLY from a fully successful fetch - guard 1. Everything else
        here exists because the alternative silently poisons the TTK figures
        rather than failing visibly, and plausible wrong numbers are worse
        than a crash."""
        def gap_for(f):
            last = (f or {}).get("last_obs_t") or self._last_poll_t
            return (poll_t - last) if last else 0.0

        def conf_for(gap):
            return "high" if (self._last_poll_t and gap
                              and gap <= self.interval * BOSS_GAP_HIGH_CONF) else "low"

        # GUARD: an empty answer while live bosses are tracked is a partial
        # response, not a world where everything died at once.
        #
        # `complete` is the exception, and it matters for server_info. That
        # payload is the server's whole S object, so one carrying `schedule`
        # and `event_flags` but no boss key is POSITIVE evidence that no boss
        # is live there - server_functions.js:2612 deletes E[type] outright
        # once the monster is gone. Without this a boss that dies as its
        # event ends would read as stale forever and the death would never be
        # logged. A payload that is empty, or not a dict, is still truncated.
        scope = (lambda k: (k[1], k[2]) == only_server) if only_server else (lambda k: True)
        prior_live = sum(1 for k, f in self.fights.items()
                         if f.get("alive") and scope(k))
        if n_entries == 0 and prior_live > 0 and not complete:
            say(f"[bosses] empty response while tracking {prior_live} live - "
                f"ignored, no transitions recorded")
            return

        for key, m in self.meta.items():
            if not scope(key):
                continue                   # another server's push says nothing here
            mtype, region, ident = key
            # GUARD: the first sighting of a SERVER has nothing to compare
            # against. Seed it and emit nothing. Per server rather than per
            # process, so a shard first seen on the fifth poll is seeded too
            # rather than reading as a spawn.
            seeding = (region, ident) not in self._seeded_servers
            server = f"{region} {ident}".strip()
            entry = m["entry"]
            cur_id = entry.get("id")
            present = m["present"]
            alive = bool(present and m["hp"] and m["seen_raw"] is not None)
            er_raw = entry.get("estimatedRespawn")
            er = parse_ts(er_raw)
            # Positive evidence of death: listed, not alive, carrying a
            # respawn estimate. Absence is NOT this.
            dead_reported = bool(present and not alive and er_raw is not None)
            # GUARD 2: did this server answer at all on this poll? "Server
            # missing from the response" and "boss absent on a server that did
            # respond" are different facts and only the second can be a death.
            server_answered = (region, ident) in servers_seen
            f = self.fights.get(key)

            if seeding:
                # spawn_t stays None for a boss already up: it may have been
                # alive for hours, and an invented spawn time makes an
                # invented TTK, which is worse than no TTK at all.
                self.fights[key] = {
                    "alive": alive, "id": cur_id if alive else None, "spawn_t": None,
                    "last_alive_t": poll_t if alive else 0.0, "last_obs_t": poll_t,
                    "absent": 0, "respawn_at": er if dead_reported else None,
                    "last_hp": m["hp"] if alive else None, "last_pct": None}
                continue

            if alive:
                gap = gap_for(f)
                new_instance = f is not None and f.get("alive") and f.get("id") != cur_id
                if new_instance:
                    self._emit({"ev": "lost", "t": iso(poll_t), "type": mtype,
                                "server": server, "id": f.get("id"),
                                "reason": "instance id changed without an observed death",
                                "poll_gap_sec": round(gap), "confidence": "low"})
                if f is None or not f.get("alive") or new_instance:
                    pending = f.get("respawn_at") if f else None
                    if pending and 0 <= poll_t - pending <= max(gap, self.interval) * 2:
                        spawn_t, how, c = pending, "respawn_estimate", "high"
                    else:
                        spawn_t, how, c = poll_t, "observed_poll", conf_for(gap)
                    self._emit({"ev": "spawn", "t": iso(spawn_t), "type": mtype,
                                "server": server, "id": cur_id, "hp": m["hp"],
                                "max_hp": self.max_hp.get(mtype), "method": how,
                                "poll_gap_sec": round(gap), "confidence": c})
                    mx = self.max_hp.get(mtype)
                    self.fights[key] = {
                        "alive": True, "id": cur_id, "spawn_t": spawn_t,
                        "last_alive_t": poll_t, "last_obs_t": poll_t, "absent": 0,
                        "respawn_at": None, "last_hp": m["hp"],
                        "last_pct": round(m["hp"] / mx * 100.0, 2) if (mx and m["hp"]) else None}
                else:
                    f["last_alive_t"] = f["last_obs_t"] = poll_t
                    f["absent"] = 0
                    f["id"] = cur_id

            elif dead_reported or (not present and server_answered
                                   and f is not None and f.get("alive")):
                # The second branch is guard 2 satisfied: the boss is gone from
                # a server that DID answer. Confirmed over consecutive
                # successful polls before it counts, because one partial body
                # can still drop a single entry.
                if not dead_reported:
                    f["absent"] = f.get("absent", 0) + 1
                    f["last_obs_t"] = poll_t
                    if f["absent"] < BOSS_ABSENT_CONFIRM:
                        continue
                if f is not None and f.get("alive"):
                    gap = gap_for(f)
                    rs = BOSS_RESPAWN_SEC.get(mtype)
                    if er is not None and rs:
                        # The server's own scheduled respawn minus the nominal
                        # interval is an exact death time, so the observation gap
                        # neither bounds it nor downgrades it.
                        death_t, how, dconf = er - rs, "respawn_offset", "high"
                    elif dead_reported:
                        lo = f.get("last_alive_t") or (poll_t - gap)
                        death_t, how, dconf = (lo + poll_t) / 2.0, "poll_bracket", "low"
                    else:
                        lo = f.get("last_alive_t") or (poll_t - gap)
                        death_t = (lo + poll_t) / 2.0
                        how, dconf = "absent_on_responding_server", "low"
                    spawn_t = f.get("spawn_t")
                    ttk = round(death_t - spawn_t) if (spawn_t and death_t > spawn_t) else None
                    self._emit({
                        "ev": "death", "t": iso(death_t), "type": mtype, "server": server,
                        "id": f.get("id"), "last_hp": f.get("last_hp"),
                        "last_pct": f.get("last_pct"),
                        "spawn_t": iso(spawn_t) if spawn_t else None, "ttk_sec": ttk,
                        "method": how,
                        "death_lo": iso(f.get("last_alive_t") or (poll_t - gap)),
                        "death_hi": iso(poll_t), "estimated_respawn": er_raw,
                        "poll_gap_sec": round(gap), "confidence": dconf})
                self.fights[key] = {
                    "alive": False, "id": None, "spawn_t": None,
                    "last_alive_t": (f or {}).get("last_alive_t", 0.0),
                    "last_obs_t": poll_t, "absent": 0, "respawn_at": er,
                    "last_hp": None, "last_pct": None}

            else:
                # Absent while its server did NOT answer, or present but
                # unreadable. Never a death - this is the 429 / partial-body
                # case, and it recovers on its own.
                if f is not None and f.get("alive"):
                    f["absent"] = f.get("absent", 0) + 1
                    if f["absent"] >= BOSS_ABSENT_CONFIRM:
                        self._emit({
                            "ev": "lost", "t": iso(poll_t), "type": mtype, "server": server,
                            "id": f.get("id"),
                            "reason": f"server {server} absent from "
                                      f"{f['absent']} consecutive successful polls",
                            "poll_gap_sec": round(gap_for(f)), "confidence": "low"})
                        f["alive"] = False
                        f["spawn_t"] = None

        for key in self.meta:
            if scope(key):
                self._seeded_servers.add((key[1], key[2]))
        for rg in servers_seen:
            self._seeded_servers.add(rg)
        self._last_poll_t = poll_t

    # -------------------------------------------------------------- output
    @staticmethod
    def _dps(buf):
        """(dps, window_sec, samples). None and 0 are DIFFERENT answers.

        None means fewer than two refreshed readings, so nothing is known. 0
        means two readings that agree - the evidence that a boss is sitting
        untouched, which is the case worth not walking into."""
        n = len(buf) if buf else 0
        if n < 2:
            return None, None, n
        t = now()
        usable = [s for s in buf if t - s["at"] <= BOSS_SAMPLE_WINDOW]
        if len(usable) < 2:
            return None, None, len(usable)
        a, b = usable[0], usable[-1]
        # Prefer ALData's own timestamps: they are when it saw the boss, where
        # ours are only when we read its cache.
        if a["seen_ts"] is not None and b["seen_ts"] is not None:
            dt = b["seen_ts"] - a["seen_ts"]
        else:
            dt = b["at"] - a["at"]
        if dt <= 0:
            return None, None, len(usable)
        lost = a["hp"] - b["hp"]
        if lost < 0:
            return None, round(dt), len(usable)   # healed or respawned mid-window
        return round(lost / dt, 1), round(dt), len(usable)

    def rows(self, want_type: str | None = None, want_server: str | None = None) -> list[dict]:
        t = now()
        out = []
        with self.lock:
            for key, m in self.meta.items():
                mtype, region, ident = key
                if want_type and mtype.lower() != want_type:
                    continue
                server = f"{region} {ident}".strip()
                if want_server and want_server not in (server.lower(), ident.lower()):
                    continue
                entry = m["entry"]
                hp = m["hp"]
                # max_hp is the largest hp this process has seen for the type,
                # NOT a figure from game data - the bridge has none. A bridge
                # started while every shard's boss was half dead will read high
                # on pct until one respawns. Labelled so a caller can tell.
                mx = self.max_hp_given.get(mtype) or self.max_hp.get(mtype)
                pct = round(hp / mx * 100.0, 2) if (hp is not None and mx) else None
                age = round(t - m["seen_ts"]) if m["seen_ts"] is not None else None
                dps, win, nsamp = self._dps(self.samples.get(key))
                eta = round(hp / dps) if (dps and dps > 0 and hp) else None
                out.append({
                    "type": mtype,
                    "serverRegion": region,
                    "serverIdentifier": ident,
                    "server": server,
                    "id": entry.get("id"),
                    "map": entry.get("map"),
                    "x": entry.get("x"),
                    "y": entry.get("y"),
                    "level": entry.get("level"),
                    "s": entry.get("s"),
                    "hp": hp,
                    "max_hp": mx,
                    "max_hp_source": ("server" if self.max_hp_given.get(mtype)
                                      else ("observed" if mx else None)),
                    "pct": pct,
                    "target": m["target"],
                    "has_target_field": m["has_target"],
                    "lastSeen": m["seen_raw"],
                    "age_sec": age,
                    "dps": dps,
                    "dps_window_sec": win,
                    "dps_samples": nsamp,
                    "eta_sec": eta,
                    "stale": True if age is None else age > BOSS_STALE_AFTER,
                    "live": bool(m["present"] and hp and m["seen_raw"] is not None),
                    "estimated_respawn": entry.get("estimatedRespawn"),
                    "respawn_sec": BOSS_RESPAWN_SEC.get(mtype),
                    "observed_ago_sec": round(t - m["at"]),
                })
        out.sort(key=lambda r: (r["type"], r["serverRegion"], r["serverIdentifier"]))
        return out

    def health(self) -> dict:
        t = now()
        with self.lock:
            return {
                "enabled": self.enabled,
                "interval_sec": self.interval,
                "types": len(self.types),
                "last_attempt": iso(self.last_attempt) if self.last_attempt else None,
                "last_success": iso(self.last_success) if self.last_success else None,
                "last_success_age_sec": (round(t - self.last_success)
                                         if self.last_success else None),
                "consecutive_failures": self.fails,
                "last_error": self.last_error,
                "entries_last_poll": self.entries_last_poll,
                "tracked": len(self.meta),
                "fights_live": sum(1 for f in self.fights.values() if f.get("alive")),
                "events_log": str(self.events_path) if self.events_path else None,
                "events_written": self.events_written,
                "events_error": self.events_error,
                "source": self.source,
                "seeded_servers": len(self._seeded_servers),
                "sockets": [{"server": c.server["region"] + " " + c.server["name"],
                             "connected": c.connected, "events": c.events,
                             "silent_for_sec": (round(now() - c.last_event)
                                                if c.last_event else None),
                             "fails": c.fails, "last_error": c.last_error}
                            for c in self.clients],
            }


class Handler(BaseHTTPRequestHandler):
    store: Store = None            # set on the server instance below
    ledger: Ledger = None
    bosses: "BossWatch" = None
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

    def _send_html(self, body: str, code=200):
        raw = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        # Same headers as _send. Serving the page from the bridge makes it
        # same-origin with the JSON routes, so these are belt and braces.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
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
        elif path == "/bosses":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            wt = (q.get("type") or [""])[0].strip().lower() or None
            ws = (q.get("server") or [""])[0].strip().lower() or None
            rows = self.bosses.rows(wt, ws)
            # Answers even when ALData is unreachable: cached rows, with the
            # poller block carrying the staleness. Returning an error instead
            # would make "the bridge is down" and "ALData is down" identical
            # to the caller, and the caller is a game script with no other way
            # to tell them apart.
            self._send({"now": iso(now()), "poller": self.bosses.health(),
                        "count": len(rows), "bosses": rows})
        elif path == "/boss_events":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            rows = boss_events_load(self.bosses.events_path)
            wt = (q.get("type") or [""])[0].strip().lower() or None
            ws = (q.get("server") or [""])[0].strip().lower() or None
            we = (q.get("ev") or [""])[0].strip().lower() or None
            if wt: rows = [r for r in rows if (r.get("type") or "").lower() == wt]
            if ws: rows = [r for r in rows if (r.get("server") or "").lower() == ws]
            if we: rows = [r for r in rows if (r.get("ev") or "").lower() == we]
            try:
                limit = max(1, min(5000, int((q.get("limit") or ["500"])[0])))
            except ValueError:
                limit = 500
            self._send({"now": iso(now()), "total": len(rows),
                        "returned": min(limit, len(rows)), "events": rows[-limit:]})
        elif path == "/boss_history":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            self._send(boss_history(
                self.bosses.events_path,
                (q.get("type") or [""])[0].strip().lower() or None,
                (q.get("server") or [""])[0].strip().lower() or None,
                (q.get("since") or [""])[0].strip() or None,
                (q.get("include_low") or [""])[0] in ("1", "true", "yes")))
        elif path == "/schedule":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            with self.bosses.lock:
                live = {f"{r} {i}".strip() for (_t, r, i) in self.bosses.meta}
            servers = live or set(SCHEDULE_SEED_SERVERS)
            wr = (q.get("region") or [""])[0].strip().upper() or None
            ws = (q.get("server") or [""])[0].strip().lower() or None
            if wr: servers = {s for s in servers if s.split(" ")[0].upper() == wr}
            if ws: servers = {s for s in servers if s.lower() == ws}
            try:
                ahead = max(1, min(336, int((q.get("hours") or ["48"])[0])))
            except ValueError:
                ahead = 48
            d = schedule_windows(servers, self.bosses.events_path, ahead)
            d["servers_from"] = "alData" if live else "seed list"
            self._send(d)
        elif path == "/boss_page":
            # Served from disk rather than embedded, so the page stays a
            # reviewable file in Codex/ and git sees its diffs. Resolved
            # against this script's own directory, not the working one.
            f = pathlib.Path(__file__).resolve().parent / "boss_timers.html"
            try:
                self._send_html(f.read_text(encoding="utf-8"))
            except OSError as e:
                self._send_html(
                    "<!doctype html><meta charset=utf-8><title>missing</title>"
                    f"<p>boss_timers.html not found next to market_bridge.py<br>"
                    f"<code>{html_escape(str(f))}</code><br>{html_escape(str(e))}", 500)
        elif path == "/population":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            raw = (q.get("hours") or [""])[0].strip()
            try:
                hours = float(raw) if raw else None
            except ValueError:
                hours = None
            rows = population_read(POPULATION_PATH, hours)
            body = {"ok": True, "samples": len(rows), "window_hours": hours,
                    "sample_sec": POPULATION_SAMPLE_SEC,
                    "shards": population_summary(rows)}
            shard = (q.get("shard") or [""])[0].strip()
            if shard:
                body["by_hour"] = {shard: population_by_hour(rows, shard)}
            self._send(body)
        elif path == "/population_rows":
            from urllib.parse import parse_qs, urlparse
            q = parse_qs(urlparse(self.path).query)
            raw = (q.get("hours") or ["24"])[0].strip()
            try:
                hours = float(raw) if raw else 24.0
            except ValueError:
                hours = 24.0
            rows = population_read(POPULATION_PATH, hours)
            self._send({"ok": True, "window_hours": hours, "rows": rows})
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
    ap.add_argument("--no-bosses", action="store_true",
                    help="do not poll ALData for boss hp")
    ap.add_argument("--boss-interval", type=int, default=BOSS_POLL_SECONDS,
                    help=f"seconds between ALData boss polls (default {BOSS_POLL_SECONDS})")
    ap.add_argument("--boss-source", default=BOSS_SOURCE, choices=["server_info", "aldata"],
                    help=f"where boss hp comes from (default {BOSS_SOURCE}); "
                         f"aldata is the old third-party poll, kept as a fallback")
    ap.add_argument("--boss-events", default=BOSS_EVENTS_PATH,
                    help=f"append-only boss spawn/kill log (default {BOSS_EVENTS_PATH}); "
                         f"empty string disables it")
    a = ap.parse_args()

    global QUIET
    QUIET = a.quiet

    Handler.store = Store(pathlib.Path(a.state) if a.state else None)
    Handler.ledger = Ledger(pathlib.Path(a.ledger))
    _ev = pathlib.Path(a.boss_events) if a.boss_events else None
    if _ev:
        try:
            _ev.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            print(f"[bridge] cannot create {_ev.parent}: {e}")
    Handler.bosses = BossWatch(BOSS_TYPES, a.boss_interval, not a.no_bosses, _ev,
                               a.boss_source)
    Handler.bosses.start()
    _shard_stop = threading.Event()
    set_shard_keys(SI_SEED_SERVERS, "seed")
    threading.Thread(target=population_sampler, args=(_shard_stop,),
                     name="pop-sampler", daemon=True).start()
    threading.Thread(target=shard_list_refresher, args=(_shard_stop,),
                     name="shardlist", daemon=True).start()

    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"[bridge] listening on http://{a.host}:{a.port}")
    print(f"[bridge]   scouts POST -> /scan      page GET -> /merchants, /ponty")
    print(f"[bridge]   party relay  -> POST /msg, GET /msg?to=<name>&since=<seq>")
    print(f"[bridge]   trades       -> POST /trade, GET /trades (raw=1 for events)")
    if a.no_bosses:
        print(f"[bridge]   bosses       -> GET /bosses (poller OFF, --no-bosses)")
    else:
        src = ("the game's own server_info broadcast, pushed"
               if a.boss_source == "server_info"
               else f"ALData every {Handler.bosses.interval}s")
        print(f"[bridge]   bosses       -> GET /bosses?type=&server= ({src})")
        print(f"[bridge]   kill log     -> GET /boss_events, /boss_history"
              f" ({a.boss_events or 'OFF'})")
        print(f"[bridge]   schedule     -> GET /schedule?region=&server=&hours=")
        print(f"[bridge]   page         -> http://{a.host}:{a.port}/boss_page")
    print(f"[bridge]   status       -> http://{a.host}:{a.port}/status")
    print(f"[bridge]   logging {'off (--quiet)' if a.quiet else 'on - one line per scan and relayed message'}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] stopped")


if __name__ == "__main__":
    main()
