# Tests

`node Tests/run.js` runs everything. Name a suite to run a subset:
`node Tests/run.js relay`, `node Tests/run.js bosshop opengifts`.

Exit code is 1 if anything failed, so it works as a gate without reading
the output.

## Why this exists

CLAUDE.md's Testing section said, for months, that there was no harness —
and that both missing-helper bugs were invisible to reading and obvious the
instant anything executed. `get_entities` threw on the first line of
`attackWithRotation` and left three rangers standing next to monsters for
hours; a `catch` around `ms_to_next_skill` made every cooldown gate in
FamilyFleet answer "ready". Neither is reachable by a static check. Both are
reachable by calling the function once.

Seventeen throwaway harnesses were written in the scratchpad on 2026-10-18
alone, each re-deriving the same machinery, and two of them had counting
bugs in that machinery that cost a round trip each. This is that machinery,
written once.

## How a suite works

A suite exports `[{ name, fn }]`. `fn(t)` records assertions and returns;
it may be `async`.

```js
const { lift, world } = require('./lift');

module.exports = [{ name: 'what this is about', fn(t) {
    const w = world({ character: { level: 70 } });
    lift(w, 'Party/Ranger.js', ['bossTaxiWalkable']);
    t.eq('crabxx is a taxi join', w.bossTaxiWalkable('crabxx'), true);
} }];
```

- `t.eq(name, got, want)` — deep-equal by JSON.
- `t.ok(name, got)` — truthy.
- `t.that(name, cond, detail)` — for a bound rather than a value; `detail`
  is printed on failure.
- `t.note(msg)` — a measurement worth showing, not an assertion.

## The rules that make it worth having

**The code under test is never copied.** `lift()` pulls a named declaration
out of the committed file by brace-matching and evaluates it in a vm
context. The only edit is `function x` → `globalThis.x = function x`, so the
suite reaches it. A passing suite is a statement about the file that ships,
not about a transcription that may have drifted.

**The brace matcher ignores strings, template literals and comments.** Two
of the throwaway versions did not, and both failed in ways that looked like
the code being wrong: one spun forever on a terminator that did not match,
the other counted a brace inside a log message.

**CODE storage is a real round trip through JSON**, because that is what the
live `set`/`get` does. A stub returning the same object reference hides
aliasing bugs, and the relay work depended on not having one.

**Assert against the mechanism, not the text where you can help it.** The
one assertion that failed on this suite's first run matched the bare word
`change_server` and found it in a doc comment 1,700 bytes before the call.
The code was right; the assertion was not. That is the fourth time that has
happened in a day, and it is the failure mode to watch for here — a harness
that passes for the wrong reason is worse than one that fails.

## What is covered

| suite | covers |
|---|---|
| `suite_relay.js` | the party-link relay across **all three** combat scripts, the durable acted-list, storage failures, and that the relay block and `bossHopFollow` have not diverged |
| `suite_bosshop.js` | the taxi-join predicate, the three gates it feeds, hop-sickness remaining-ms, the walk-in-sick probe, `goHomeIfIdle`, and the hop lock that stops a burst of `boss_hop` |
| `suite_bosstimers.js` | the Schedule tab of `Codex/boss_timers.html`: one row per start time, rank order within a row, the filter, live and ended windows, that its rank table matches `Party/Ranger.js`, and that the fields it reads are the ones `published_schedule()` emits |
| `suite_opengifts.js` | merchant buff skills and their level gating, the MP reserve, the overlap of the three server queues, and the bow ladder making fodder |

The divergence checks in `suite_relay.js` are the ones most likely to earn
their keep: Merchant fixed the replay bug in v68 and it took three weeks and
a live reload loop to reach the other three scripts. A suite that only
checked one of them would not have noticed.
