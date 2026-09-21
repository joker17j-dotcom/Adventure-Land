#!/usr/bin/env python3
"""Run this on a SECOND computer so its scout can reach the bridge on the first.

WHY THIS EXISTS, AND WHY POINTING THE SCOUT AT THE LAN IP DOES NOT WORK

The scout runs inside https://adventure.land. A page served over HTTPS may not
fetch http:// URLs - the browser calls that mixed content and blocks it before
the request is ever made. There is exactly one exception: 127.0.0.1 and
localhost, which browsers treat as trustworthy regardless of scheme. That
exception is the only reason the single-machine setup works at all.

A LAN address like http://192.168.1.50:8787 gets no such exemption, so editing
CONFIG.bridge to the other computer's IP fails silently in the browser console
and looks exactly like the bridge being down.

So: this listens on the second computer's own 127.0.0.1 and forwards everything
to the real bridge over the network. The browser only ever talks to localhost,
which it allows. The relay talks machine to machine, where no browser rules
apply. The scout keeps its default CONFIG.bridge and needs no edit at all.

    python3 bridge_relay.py 192.168.1.50          # the first computer's IP

Standard library only, same as the bridge.
"""
from __future__ import annotations

import argparse
import json
import socket
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Bodies here are scan payloads - a few hundred KB at the outside.
MAX_BODY = 8 * 1024 * 1024
QUIET = False


def say(msg: str) -> None:
    if not QUIET:
        print(f"{time.strftime('%H:%M:%S')} {msg}", flush=True)


def guess_lan_ip() -> str:
    """This machine's address on the LAN, for the hint printed at startup.

    Connects nowhere - a UDP socket with no traffic just makes the OS pick the
    interface it would route through, which is the address worth showing."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("192.0.2.1", 1))     # TEST-NET-1, reserved, unroutable
            return s.getsockname()[0]
        finally:
            s.close()
    except Exception:
        return "?"


class Relay(BaseHTTPRequestHandler):
    upstream = ""
    timeout = 8.0
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        pass                                 # one line per forward instead, below

    # ------------------------------------------------------------ responses
    def _cors(self):
        # The browser is talking to THIS server, so these headers have to come
        # from here - the upstream bridge's copies never reach it.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        # Chrome's Private Network Access check: a page on the public internet
        # reaching a loopback address gets a preflight asking for this opt-in.
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send(self, raw: bytes, code: int = 200, ctype: str = "application/json"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self._cors()
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            pass                             # the tab navigated away mid-reply

    def _error(self, msg: str, code: int = 502):
        # Shaped like the bridge's own errors so the scout's existing handling
        # applies: it treats a failure as "bridge unreachable", keeps its
        # findings buffered, and resends when the bridge returns. A relay
        # outage is therefore a pause, not a loss.
        self._send(json.dumps({"ok": False, "error": msg}).encode(), code)

    # ------------------------------------------------------------- handlers
    def do_OPTIONS(self):
        # Answered here rather than forwarded. A preflight carries no payload
        # and the answer is always the same, so a round trip over the network
        # would add latency to every single POST for nothing.
        self._send(b'{"ok": true}')

    def do_GET(self):
        self._forward("GET", None)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._error("bad Content-Length", 400)
        if n > MAX_BODY:
            return self._error(f"body too large ({n} bytes)", 413)
        try:
            body = self.rfile.read(n) if n else b""
        except Exception as e:
            return self._error(f"could not read body: {e}", 400)
        self._forward("POST", body)

    def _forward(self, method: str, body):
        url = self.upstream.rstrip("/") + self.path
        req = urllib.request.Request(url, data=body, method=method)
        if body is not None:
            req.add_header("Content-Type",
                           self.headers.get("Content-Type", "application/json"))
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                raw = r.read()
                ctype = r.headers.get("Content-Type", "application/json")
                say(f"{method} {self.path} -> {r.status} ({len(raw)}b)")
                self._send(raw, r.status, ctype)
        except urllib.error.HTTPError as e:
            # A 404 or 400 from the bridge is a real answer and belongs to the
            # caller unchanged, not rewritten into a relay failure.
            raw = e.read() or json.dumps({"ok": False, "error": str(e)}).encode()
            say(f"{method} {self.path} -> {e.code} (from bridge)")
            self._send(raw, e.code, e.headers.get("Content-Type", "application/json"))
        except (urllib.error.URLError, TimeoutError, socket.timeout) as e:
            reason = getattr(e, "reason", e)
            say(f"{method} {self.path} -> upstream unreachable: {reason}")
            self._error(f"relay could not reach the bridge at {self.upstream}: {reason}")
        except Exception as e:
            say(f"{method} {self.path} -> relay error: {e}")
            self._error(f"relay error: {e}")


def probe(upstream: str, timeout: float) -> bool:
    try:
        with urllib.request.urlopen(upstream.rstrip("/") + "/health", timeout=timeout) as r:
            return json.loads(r.read()).get("ok") is True
    except Exception as e:
        print(f"[relay] the bridge did not answer: {e}")
        return False


def main():
    ap = argparse.ArgumentParser(
        description="Forward a local port to a market bridge on another computer.")
    ap.add_argument("host", help="the OTHER computer's IP or hostname, e.g. 192.168.1.50")
    ap.add_argument("--upstream-port", type=int, default=8787,
                    help="port the bridge listens on there (default 8787)")
    # Loopback, and not configurable to anything else without meaning it. The
    # whole point is that the browser trusts this address; binding it wider
    # would expose a relay into someone else's machine for no gain.
    ap.add_argument("--port", type=int, default=8787,
                    help="local port the scout talks to (default 8787)")
    ap.add_argument("--timeout", type=float, default=8.0)
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    global QUIET
    QUIET = a.quiet

    if a.host in ("127.0.0.1", "localhost", "::1"):
        print("[relay] upstream is this machine's own loopback - that is a loop, "
              "and it means you do not need a relay at all. Point the scout "
              "straight at the bridge.")
        return 2

    upstream = f"http://{a.host}:{a.upstream_port}"
    print(f"[relay] forwarding http://127.0.0.1:{a.port}  ->  {upstream}")

    if probe(upstream, a.timeout):
        print("[relay] bridge answered /health - good")
    else:
        # Not fatal: the other computer may simply not be up yet, and every
        # forward retries independently. Said plainly so a silent scout is not
        # mistaken for a broken relay.
        print(f"[relay] WARNING: no answer from {upstream} yet. Check that the")
        print(f"[relay]   bridge there was started with --host 0.0.0.0, that the")
        print(f"[relay]   IP is right, and that its firewall allows port "
              f"{a.upstream_port}.")
        print(f"[relay]   Starting anyway - it will connect when the bridge does.")

    print(f"[relay] this machine is {guess_lan_ip()}")
    # The PORT WE ACTUALLY BOUND, not the default. Printing 8787 while
    # listening on something else sends the reader to an address nothing is
    # serving, and the symptom - a scout that never connects - looks exactly
    # like the bridge being down, which is the one thing this line exists to
    # rule out.
    print(f"[relay] leave the scout's CONFIG.bridge as http://127.0.0.1:{a.port}")

    Relay.upstream = upstream
    Relay.timeout = a.timeout
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), Relay)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n[relay] stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
