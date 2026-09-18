/* ==================================================== MARKET (WATCHLIST) */
/* Same market section as the full explorer, but the filter box is pre-loaded
   with the tracked item list. Clear the box to see the whole market. */

const WATCHLIST = [
  "alloyquiver", "bcape", "cearring", "coat", "cring", "dexamulet", "dexbelt",
  "dexearring", "ecape", "firebow", "firestaff", "fury", "gcape", "gstaff",
  "harmor", "hhelmet", "intamulet", "intbelt", "jacko", "lmace", "mageshood",
  "mpxamulet", "mpxgloves", "mshield", "orbofdex", "pants", "rabbitsfoot",
  "sbelt", "starkillers", "suckerpunch", "supermittens", "t2quiver", "tshirt9",
  "vattire", "wbook0", "wingedboots", "xhelmet", "zapper",
];

tab("market", "Watchlist Market", (host) => {
  renderMarket(host, {
    defaultFilter: WATCHLIST.join(", "),
    blurb: el("span", {}, "Pre-filtered to the ",
      el("b", {}, String(WATCHLIST.length) + " tracked items"),
      ". Clear the box to browse the whole market."),
  });
});

/* ======================================================= SUMMARY ENGINE  */
/* Shared by the two summary tabs below so their numbers cannot drift apart:
   the only differences are which items are kept and whether losing rows are
   shown. */

/* One row per item + upgrade level + special title. An arbitrage number is
   only meaningful between identical goods: a level 0 sell and a level 5 buy
   order are two different markets, and a shiny is not a plain one. Pooling
   them reports a spread nobody can capture. */
function summaryGroupKey(r) {
  return [String(r.item).toLowerCase(), r.level || 0, r.special || ""].join("|");
}

/* rows -> one record per group. `keep` is a Set of item keys to restrict to,
   or null for every item currently on the market. */
function summarizeMarket(rows, keep) {
  const by = new Map();
  for (const r of rows) {
    const key = String(r.item).toLowerCase();
    if (keep && !keep.has(key)) continue;
    const gk = summaryGroupKey(r);
    let g = by.get(gk);
    if (!g) {
      g = { item: key, level: r.level || 0, special: r.special || null, sells: [], buys: [] };
      by.set(gk, g);
    }
    (r.buying ? g.buys : g.sells).push(r);
  }
  return [...by.values()].map((g) => {
    /* A row with no usable price must never reach the min/max reduce. null
       loses every numeric comparison, so a priceless listing would win
       "cheapest" outright and then "best.price - null" would report the buy
       order's full value as profit - an invented spread on a trade that does
       not exist. Ponty entries can arrive priceless, so this is load-bearing.
       The listing still shows in the market table; it just cannot price one. */
    const priced = (r) => typeof r.price === "number" && isFinite(r.price);
    const sells = g.sells.filter(priced);
    const buys = g.buys.filter(priced);
    const cheapest = sells.length ? sells.reduce((a, c) => (c.price < a.price ? c : a)) : null;
    const best = buys.length ? buys.reduce((a, c) => (c.price > a.price ? c : a)) : null;
    return {
      item: g.item, level: g.level, special: g.special,
      nSell: sells.length, nBuy: buys.length,
      unpriced: (g.sells.length - sells.length) + (g.buys.length - buys.length),
      cheapest: cheapest ? cheapest.price : null,
      cheapestWho: cheapest ? `${cheapest.merchant} (${cheapest.server})` : null,
      cheapestSeen: cheapest ? cheapest.lastSeen : null,
      /* An NPC seller does not log off. When the cheap side of a spread is
         Ponty, only the buy order can evaporate, so the trade is materially
         more likely to complete than a player-to-player one. */
      cheapestNpc: cheapest ? !!cheapest.npc : false,
      best: best ? best.price : null,
      bestWho: best ? `${best.merchant} (${best.server})` : null,
      bestSeen: best ? best.lastSeen : null,
      spread: (cheapest && best) ? best.price - cheapest.price : null,
      listed: true,
    };
  });
}

/* Both sides of a spread need their own freshness: a merchant last confirmed
   hours ago may well be gone, and a spread is only capturable while BOTH ends
   are still standing. Stale is flagged, never hidden - the listing can still
   be good, it just has not been seen recently. */
const SEEN_STALE_MS = 60 * 60 * 1000;
function seenCell(iso) {
  if (!iso) return el("span", { class: "dim" }, "—");
  const stale = (Date.now() - new Date(iso).getTime()) > SEEN_STALE_MS;
  return el("span", { class: stale ? "warn" : "dim" }, ago(iso));
}
function seenSort(iso) { return iso ? -new Date(iso).getTime() : null; }

function summaryColumns() {
  return [
    { key: "icon", label: "", get: (r) => r.item, render: (r) => icon(r.item, 1.6) },
    { key: "name", label: "Item", get: (r) => itemName(r.item),
      render: (r) => el("span", {}, el("span", {}, itemName(r.item)),
        el("span", { class: "dim" }, " " + r.item)) },
    { key: "level", label: "Lv", num: true, get: (r) => r.level,
      render: (r) => r.level == null ? el("span", { class: "dim" }, "—")
        : el("span", { class: r.level ? "warn" : "dim" }, String(r.level)) },
    { key: "special", label: "Special", get: (r) => r.special,
      render: (r) => r.special ? el("span", { class: "tag" }, r.special)
        : el("span", { class: "dim" }, "—") },
    { key: "cheapest", label: "Cheapest sell", num: true, get: (r) => r.cheapest,
      render: (r) => el("span", { class: r.cheapest ? "gold" : "dim" },
        r.cheapest ? fmt(r.cheapest) : (r.listed ? "none" : "not listed")) },
    { key: "cheapestWho", label: "From", get: (r) => r.cheapestWho,
      render: (r) => r.cheapestWho
        ? el("span", {},
            r.cheapestNpc ? el("span", { class: "tag npc", style: "margin-right:5px" }, "PONTY") : null,
            el("span", { class: "dim" }, r.cheapestWho))
        : el("span", { class: "dim" }, "—") },
    { key: "cheapestSeen", label: "Sell seen", get: (r) => seenSort(r.cheapestSeen),
      render: (r) => r.cheapestNpc
        ? el("span", { class: "dim", title: "NPC - stock rotates, but he is always there" },
            ago(r.cheapestSeen))
        : seenCell(r.cheapestSeen) },
    { key: "best", label: "Best buy offer", num: true, get: (r) => r.best,
      render: (r) => el("span", { class: r.best ? "good" : "dim" }, r.best ? fmt(r.best) : "none") },
    { key: "bestWho", label: "By", get: (r) => r.bestWho,
      render: (r) => el("span", { class: "dim" }, r.bestWho || "—") },
    { key: "bestSeen", label: "Buy seen", get: (r) => seenSort(r.bestSeen),
      render: (r) => seenCell(r.bestSeen) },
    { key: "spread", label: "Spread", num: true, get: (r) => r.spread,
      render: (r) => r.spread == null ? el("span", { class: "dim" }, "—")
        : el("span", { class: r.spread > 0 ? "good" : "bad" },
          (r.spread > 0 ? "+" : "") + fmt(r.spread)) },
    { key: "nSell", label: "#Sell", num: true, get: (r) => r.nSell },
    { key: "nBuy", label: "#Buy", num: true, get: (r) => r.nBuy },
  ];
}

/* opts: {items: [keys]|null, positiveOnly: bool, blurb} */
function renderSummary(host, opts) {
  opts = opts || {};
  const keep = opts.items ? new Set(opts.items) : null;
  const positiveOnly = !!opts.positiveOnly;

  const ctl = el("div", { class: "panel" });
  const status = el("span", { class: "dim" }, "loading…");
  ctl.append(
    el("div", { class: "src", style: "margin-bottom:8px" }, opts.blurb || ""),
    el("div", { class: "row" },
      el("button", { class: "act", onclick: () => go(true) }, "REFRESH DATA"),
      sourceSelect(() => go(true)), pontyToggle(() => go(true)), status));
  const out = el("div", { class: "panel" });
  host.append(ctl, out);

  function draw() {
    out.innerHTML = "";
    const rows = marketRows(MERCHANTS);
    let summary = summarizeMarket(rows, keep);
    const groupsScanned = summary.length;
    const present = new Set(summary.map((s) => s.item));
    const positives = summary.filter((s) => s.spread != null && s.spread > 0).length;

    if (positiveOnly) {
      summary = summary.filter((s) => s.spread != null && s.spread > 0);
    } else if (keep) {
      /* A tracked item nobody is trading at any level still gets a row, so the
         table always accounts for the whole watchlist. */
      for (const k of opts.items) {
        if (present.has(k)) continue;
        summary.push({
          item: k, level: null, special: null, nSell: 0, nBuy: 0,
          cheapest: null, cheapestWho: null, cheapestSeen: null,
          best: null, bestWho: null, bestSeen: null, spread: null, listed: false,
        });
      }
    }

    const pills = keep
      ? [`${present.size} of ${opts.items.length} tracked items listed right now`]
      : [`${fmt(present.size)} distinct items on the market`];
    const npcBacked = summary.filter((x) => x.cheapestNpc && x.spread != null && x.spread > 0).length;
    if (positiveOnly) {
      pills.push(`${fmt(summary.length)} of ${fmt(groupsScanned)} groups have a positive spread`);
      if (npcBacked) pills.push(`${npcBacked} bought from Ponty (seller can't vanish)`);
    } else {
      pills.push(`${fmt(groupsScanned)} item/level groups`);
      pills.push(`${positives} with a positive level-matched spread`);
    }
    pills.push(`${fmt(rows.length)} total listings scanned`);
    out.append(el("div", { class: "row", style: "margin-bottom:10px" },
      pills.map((t) => el("span", { class: "pill" }, t))));

    if (positiveOnly && !summary.length) {
      out.append(el("div", { class: "dim" },
        "Nothing on the market has a positive level-matched spread right now."));
      return;
    }

    sortableTable(out, summary, summaryColumns(), {
      noun: " item/level groups",
      sortKey: positiveOnly ? "spread" : "name",
      sortDir: positiveOnly ? -1 : 1,
    });
  }

  async function go(force) {
    status.textContent = "loading…";
    try {
      await loadMerchants(force);
      status.textContent = `${fmt(MERCHANTS.length)} merchants`;
      draw();
    } catch (e) {
      status.textContent = "";
      out.innerHTML = "";
      out.append(el("div", { class: "err" }, "Could not load merchant data: " + e.message));
    }
  }
  go(false);
}

/* A quick at-a-glance summary of the watchlist across all servers. */
tab("summary", "Watchlist Summary", (host) => renderSummary(host, {
  items: WATCHLIST,
  positiveOnly: false,
  blurb: el("span", {}, "Best current prices for each tracked item, across every server. ",
    el("b", {}, "Cheapest sell"), " is what you'd pay to buy it; ",
    el("b", {}, "best buy"), " is the most anyone is currently paying. ",
    "One row per item AND upgrade level: a spread only means something between identical goods. ",
    el("b", {}, "Sell seen"), " and ", el("b", {}, "buy seen"),
    " are when each side's merchant was last confirmed; anything over an hour old is flagged."),
}));

/* The same table over the WHOLE market rather than the watchlist, kept to the
   rows that actually show a gap. This is the "what could I flip right now"
   view, so losing and flat rows are noise and are dropped. */
tab("arbitrage", "Arbitrage · All Items", (host) => renderSummary(host, {
  items: null,
  positiveOnly: true,
  blurb: el("span", {}, "Every item on the market, not just the watchlist, ",
    "reduced to the rows where the best buy order sits ", el("b", {}, "above"),
    " the cheapest sell at the same item, level and special. ",
    "A spread is not free money: both merchants have to still be standing, the buy order has ",
    "to have quantity left, and you pay the trip between them — so read ",
    el("b", {}, "sell seen"), " and ", el("b", {}, "buy seen"),
    " before acting on a row, and treat a flagged one as probably gone."),
}));

/* ================================================================ PONTY TAB */
/* Ponty (the "secondhands" NPC) resells what other players have sold to NPCs.
   His stock is per shard and rotates, and there is no public API for it - the
   only way to read it is to stand next to him and ask, which is exactly what
   the roaming scout does on every shard it lands on. So this tab is bridge-only
   by nature; with no bridge running there is simply nothing to show. */
tab("ponty", "Ponty Stock", (host) => {
  const ctl = el("div", { class: "panel" });
  const status = el("span", { class: "dim" }, "loading…");
  const q = el("input", { type: "search", placeholder: "filter by item…", style: "min-width:220px" });
  const watchOnly = el("input", { type: "checkbox" });
  const watchLabel = el("label", { class: "row", style: "gap:6px;cursor:pointer" },
    watchOnly, el("span", {}, "Watchlist items only"));
  ctl.append(
    el("div", { class: "src", style: "margin-bottom:8px" },
      "Ponty's resale stock per shard, collected by the roaming scout via ",
      el("b", {}, "market_bridge.py"), ". Stock rotates and is shard-local, so a ",
      "shard is only as current as the last time a scout stood in front of him."),
    el("div", { class: "row" },
      el("button", { class: "act", onclick: () => go() }, "REFRESH"), q, watchLabel, status));
  const out = el("div", { class: "panel" });
  host.append(ctl, out);

  let DATA = null;
  const watch = new Set(WATCHLIST);

  function draw() {
    out.innerHTML = "";
    if (!DATA) { out.append(el("div", { class: "dim" }, "No data.")); return; }
    const shards = Object.keys(DATA).sort();
    if (!shards.length) {
      out.append(el("div", { class: "dim" },
        "The bridge is up but no scout has reported Ponty stock yet. The roamer "
        + "checks him once per shard per visit, so give it a rotation."));
      return;
    }
    const needle = q.value.trim().toLowerCase();
    const rows = [];
    for (const sh of shards) {
      const rec = DATA[sh] || {};
      for (const it of (rec.items || [])) {
        if (!it || !it.name) continue;
        const key = String(it.name).toLowerCase();
        if (watchOnly.checked && !watch.has(key)) continue;
        if (needle && !key.includes(needle) && !itemName(it.name).toLowerCase().includes(needle)) continue;
        rows.push({ shard: sh, at: rec.at, ...it, tracked: watch.has(key) });
      }
    }
    out.append(el("div", { class: "row", style: "margin-bottom:10px" },
      el("span", { class: "pill" }, `${shards.length} shard${shards.length > 1 ? "s" : ""} reported`),
      el("span", { class: "pill" }, `${fmt(rows.length)} entries shown`),
      el("span", { class: "pill" }, `${rows.filter((r) => r.tracked).length} on the watchlist`)));

    sortableTable(out, rows, [
      { key: "icon", label: "", get: (r) => r.name, render: (r) => icon(r.name, 1.6) },
      { key: "item", label: "Item", get: (r) => itemName(r.name),
        render: (r) => el("span", {},
          el("span", { class: r.tracked ? "good" : "" }, itemName(r.name)),
          el("span", { class: "dim" }, " " + r.name)) },
      { key: "level", label: "Lv", num: true, get: (r) => r.level,
        render: (r) => el("span", { class: r.level ? "warn" : "dim" }, String(r.level || 0)) },
      { key: "price", label: "Price", num: true,
        get: (r) => (typeof r.price === "number" ? r.price : pontyPrice(r)),
        render: (r) => {
          const v = (typeof r.price === "number" ? r.price : pontyPrice(r));
          if (v != null) return el("span", { class: "gold", title: "base value x buy_to_sell x secondhands_mult" }, fmt(v));
          return el("span", {
            class: "dim",
            title: (r.level || 0) > 0
              ? "upgraded item - the public data does not say how level scales value, so this is left unpriced rather than guessed"
              : "no base value for this item in the game data",
          }, (r.level || 0) > 0 ? "lv>0" : "—");
        } },
      /* Reference only, and deliberately NOT fed to the spread tables. This is
         design/items.py's base gold value, which is what the item is nominally
         worth - not what Ponty charges for it. He sells at a markup nobody here
         has measured yet, so quoting this as his price would overstate every
         Ponty-backed spread and lose real gold. It is shown because knowing an
         item is a 60k item rather than a 600k one is still worth something
         while the real price is unresolved. */
      { key: "base", label: "Base value", num: true,
        get: (r) => (G.items && G.items[r.name] && G.items[r.name].g) || null,
        render: (r) => {
          const g = (G.items && G.items[r.name] && G.items[r.name].g);
          return el("span", { class: "dim", title: "base item value, NOT Ponty's asking price" },
            g == null ? "—" : "~" + fmt(g));
        } },
      { key: "q", label: "Qty", num: true, get: (r) => r.q },
      { key: "p", label: "Special", get: (r) => r.p,
        render: (r) => r.p ? el("span", { class: "tag" }, r.p) : el("span", { class: "dim" }, "—") },
      { key: "shard", label: "Shard", get: (r) => r.shard },
      { key: "at", label: "Scanned", get: (r) => seenSort(r.at), render: (r) => seenCell(r.at) },
    ], { noun: " Ponty entries", sortKey: "item" });
  }

  async function go() {
    status.textContent = "loading…";
    try {
      const r = await fetch(BRIDGE + "/ponty");
      if (!r.ok) throw new Error("bridge " + r.status);
      DATA = await r.json();
      status.textContent = "";
      draw();
    } catch (e) {
      status.textContent = "";
      out.innerHTML = "";
      out.append(el("div", { class: "err" },
        "Could not reach the bridge at " + BRIDGE + " — " + e.message
        + "\n\nPonty stock has no public API, so this tab needs market_bridge.py running "
        + "and at least one scout that has visited Ponty."));
    }
  }
  q.addEventListener("input", draw);
  watchOnly.addEventListener("change", draw);
  go();
});
