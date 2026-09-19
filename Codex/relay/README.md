# Bridge relay — running a scout on a second computer

For when someone else, on their own account and their own machine, wants to run
a scout that feeds **your** bridge.

## Why a relay, and not just the IP address

The obvious thing is to open `MerchantScout.js` and change

```js
bridge: 'http://127.0.0.1:8787',
```

to your computer's address. **That does not work, and it fails silently.**

The scout runs inside `https://adventure.land`. A page served over HTTPS is not
allowed to fetch `http://` URLs — browsers call that *mixed content* and block
it before the request is made. There is one exception: `127.0.0.1` and
`localhost` are treated as trustworthy whatever the scheme, and that exception
is the only reason the single-computer setup works at all.

A LAN address like `http://192.168.1.50:8787` gets no exemption. The request
never leaves the browser, nothing appears in your bridge's log, and it looks
exactly like the bridge being down.

So the relay listens on the second computer's **own** `127.0.0.1` and forwards
over the network. The browser only ever talks to localhost, which it permits.
The relay talks machine to machine, where no browser rules apply.

**The scout needs no edit.** Its default `CONFIG.bridge` is already correct.

---

## Setup

### On your computer — the one with the bridge

```bash
python3 market_bridge.py --host 0.0.0.0
```

`--host 0.0.0.0` is the change: by default the bridge listens on loopback only
and refuses connections from anywhere else.

Then find your LAN address — `ipconfig` on Windows, `ip addr` or `ifconfig`
elsewhere. Something like `192.168.1.50`.

If the connection is refused later, the firewall is the usual reason. Windows
will normally prompt the first time; allow it on **private** networks only.

### On the second computer

```bash
python3 bridge_relay.py 192.168.1.50
```

```
[relay] forwarding http://127.0.0.1:8787  ->  http://192.168.1.50:8787
[relay] bridge answered /health - good
[relay] this machine is 192.168.1.61
[relay] leave the scout's CONFIG.bridge as http://127.0.0.1:8787
```

If it warns that the bridge did not answer, it still starts — the other computer
may simply not be ready. Every forward retries on its own.

Then paste `MerchantScout.js` into the character's CODE tab as normal, with the
character listed in `CONFIG.roles`. Leave `CONFIG.bridge` alone.

### Checking it

Open <http://127.0.0.1:8787/status> on the second computer. If you see the
bridge's status, the path is working end to end. Your own bridge's log will
start showing that scout's scans, tagged with its character name.

---

## Options

| Flag | Default | What it does |
|---|---|---|
| `host` | *(required)* | The other computer's IP or hostname |
| `--upstream-port` | 8787 | Port the bridge listens on over there |
| `--port` | 8787 | Local port the scout talks to |
| `--timeout` | 8.0 | Seconds to wait on the bridge |
| `--quiet` | off | Only startup and errors, no line per request |

It always binds to `127.0.0.1` and that is not configurable. The whole point is
that the browser trusts this address; listening wider would open a path into
someone else's machine and gain nothing.

---

## When something is wrong

**`relay could not reach the bridge`** — the other computer is off, the bridge
is not running, it was started without `--host 0.0.0.0`, the IP is wrong, or a
firewall is in the way. The scout treats this as the bridge being down: it keeps
its findings buffered and sends them when the connection returns, so an outage
costs time rather than data.

**Nothing in the browser console, nothing in either log** — the scout is
probably still pointed at a LAN address rather than `127.0.0.1`. That is the
mixed-content block described above, and it leaves no trace anywhere except the
browser's own console.

**`that is a loop`** — the relay was given this machine's own address. If the
bridge is on this computer, you do not need a relay.

---

## Worth knowing before you set this up

`--host 0.0.0.0` means **anything on your network can read and write your
bridge**, including the trade ledger. There is no authentication. On a home
network that is usually fine, but it is a real change from loopback-only and is
better decided deliberately than discovered later.
