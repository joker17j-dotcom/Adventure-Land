/* =============================================================== ITEMS TAB */
tab("items", "Items", (host) => {
  const ctl = el("div", { class: "panel" });
  const q = el("input", { type: "search", placeholder: "name or key…", style: "min-width:220px" });
  const type = el("select", {}, el("option", { value: "" }, "All types"));
  const tier = el("select", {}, el("option", { value: "" }, "All tiers"));
  const out = el("div", { class: "panel" });

  const all = Object.entries(G.items || {}).map(([k, v]) => ({ key: k, ...v }));
  for (const t of [...new Set(all.map((i) => i.type).filter(Boolean))].sort()) {
    type.append(el("option", { value: t }, t));
  }
  for (const t of [...new Set(all.map((i) => i.tier).filter((x) => x != null))].sort((a, b) => a - b)) {
    tier.append(el("option", { value: t }, "tier " + t));
  }

  ctl.append(el("div", { class: "src", style: "margin-bottom:8px" },
    "From ", el("b", {}, "design/items.py"), " · executed in-browser via Pyodide"),
    el("div", { class: "row" }, q, type, tier));
  host.append(ctl, out);

  function draw() {
    out.innerHTML = "";
    const s = q.value.trim().toLowerCase();
    const rows = all.filter((i) => {
      if (type.value && i.type !== type.value) return false;
      if (tier.value && String(i.tier) !== tier.value) return false;
      if (!s) return true;
      return i.key.toLowerCase().includes(s) || (i.name || "").toLowerCase().includes(s);
    });
    sortableTable(out, rows, [
      { key: "icon", label: "", get: (r) => r.key, render: (r) => icon(r.key, 1.6) },
      { key: "name", label: "Name", get: (r) => r.name || r.key },
      { key: "key", label: "Key", get: (r) => r.key, render: (r) => el("span", { class: "dim" }, r.key) },
      { key: "type", label: "Type", get: (r) => r.type },
      { key: "tier", label: "Tier", num: true, get: (r) => r.tier },
      { key: "g", label: "Base gold", num: true, get: (r) => r.g, render: (r) => el("span", { class: "gold" }, fmt(r.g)) },
      { key: "stat", label: "Stat", num: true, get: (r) => r.stat },
      { key: "armor", label: "Armor", num: true, get: (r) => r.armor },
      { key: "attack", label: "Attack", num: true, get: (r) => r.attack },
      { key: "grades", label: "Grades", get: (r) => (r.grades || []).join("/") },
    ], { noun: " items", sortKey: "name" });
  }
  q.addEventListener("input", draw); type.addEventListener("change", draw); tier.addEventListener("change", draw);
  draw();
});

/* ============================================================ MONSTERS TAB */
tab("monsters", "Monsters", (host) => {
  const ctl = el("div", { class: "panel" });
  const q = el("input", { type: "search", placeholder: "monster name or key…", style: "min-width:220px" });
  const out = el("div", { class: "panel" });
  const gold = G.monster_gold || {};
  const all = Object.entries(G.monsters || {}).map(([k, v]) => ({ key: k, gold: gold[k], ...v }));

  ctl.append(el("div", { class: "src", style: "margin-bottom:8px" },
    "From ", el("b", {}, "design/monsters.py"), " (monsters + monster_gold)"),
    el("div", { class: "row" }, q));
  host.append(ctl, out);

  function draw() {
    out.innerHTML = "";
    const s = q.value.trim().toLowerCase();
    const rows = all.filter((m) => !s || m.key.toLowerCase().includes(s) || (m.name || "").toLowerCase().includes(s));
    sortableTable(out, rows, [
      { key: "name", label: "Name", get: (r) => r.name || r.key },
      { key: "key", label: "Key", get: (r) => r.key, render: (r) => el("span", { class: "dim" }, r.key) },
      { key: "hp", label: "HP", num: true, get: (r) => r.hp, render: (r) => short(r.hp) },
      { key: "attack", label: "Attack", num: true, get: (r) => r.attack, render: (r) => short(r.attack) },
      { key: "xp", label: "XP", num: true, get: (r) => r.xp, render: (r) => short(r.xp) },
      { key: "gold", label: "Gold", num: true, get: (r) => r.gold, render: (r) => el("span", { class: "gold" }, short(r.gold)) },
      { key: "speed", label: "Speed", num: true, get: (r) => r.speed },
      { key: "range", label: "Range", num: true, get: (r) => r.range },
      { key: "damage_type", label: "Dmg", get: (r) => r.damage_type },
      { key: "respawn", label: "Respawn", num: true, get: (r) => r.respawn },
      { key: "drops", label: "Drops", num: true,
        get: (r) => ((G.drops && G.drops.monsters && G.drops.monsters[r.key]) || []).length },
    ], { noun: " monsters", sortKey: "hp", sortDir: -1 });
  }
  q.addEventListener("input", draw);
  draw();
});

/* ============================================================= CLASSES TAB */
tab("classes", "Classes", (host) => {
  host.append(el("div", { class: "panel src" }, "From ", el("b", {}, "design/classes.py"), " + ", el("b", {}, "design/skills.py")));
  const grid = el("div", { class: "grid" });
  for (const [key, c] of Object.entries(G.classes || {})) {
    const card = el("div", { class: "card" });
    card.append(el("h4", {}, (key[0].toUpperCase() + key.slice(1))));
    if (c.description) card.append(el("div", { class: "dim", style: "margin-bottom:8px;font-size:12px" }, c.description));
    const kv = el("div", { class: "kv" });
    kv.append(el("b", {}, "main stat"), el("span", {}, c.main_stat || "—"));
    for (const [s, v] of Object.entries(c.stats || {})) {
      kv.append(el("b", {}, s), el("span", {}, String(v) + " (+" + ((c.lstats || {})[s] ?? 0) + "/lv)"));
    }
    const skills = Object.entries(G.skills || {}).filter(([, s]) =>
      s && (s.class ? (Array.isArray(s.class) ? s.class.includes(key) : s.class === key) : false));
    kv.append(el("b", {}, "skills"), el("span", {}, String(skills.length)));
    card.append(kv);
    if (skills.length) {
      card.append(el("div", { class: "dim", style: "margin-top:8px;font-size:11px" },
        skills.map(([k, s]) => (s.name || k)).join(", ")));
    }
    grid.append(card);
  }
  host.append(el("div", { class: "panel" }, grid));
});

/* =========================================================== COSMETICS TAB */
tab("cosmetics", "Cosmetics", (host) => {
  host.append(el("div", { class: "panel src" }, "From ", el("b", {}, "design/cosmetics.py")));
  const out = el("div", { class: "panel" });
  const rows = [];
  for (const [group, v] of Object.entries(G.cosmetics || {})) {
    if (Array.isArray(v)) for (const n of v) rows.push({ group, value: String(n) });
    else if (v && typeof v === "object") for (const [k2, v2] of Object.entries(v)) {
      rows.push({ group, value: k2 + (v2 && typeof v2 !== "object" ? " = " + v2 : "") });
    } else rows.push({ group, value: String(v) });
  }
  sortableTable(out, rows, [
    { key: "group", label: "Group", get: (r) => r.group },
    { key: "value", label: "Entry", get: (r) => r.value },
  ], { noun: " cosmetic entries", sortKey: "group" });
  host.append(out);
});

/* =============================================================== DROPS TAB */
tab("drops", "Drops", (host) => {
  const ctl = el("div", { class: "panel" });
  const q = el("input", { type: "search", placeholder: "filter by monster or item…", style: "min-width:260px" });
  const out = el("div", { class: "panel" });
  ctl.append(el("div", { class: "src", style: "margin-bottom:8px" },
    "From ", el("b", {}, "design/drops.py"), " · monster drop tables and map-wide drops. ",
    "Chance is per kill."),
    el("div", { class: "row" }, q));
  host.append(ctl, out);

  const rows = [];
  const md = (G.drops && G.drops.monsters) || {};
  for (const [mon, list] of Object.entries(md)) {
    for (const d of list || []) {
      if (!Array.isArray(d)) continue;
      const chance = d[0];
      const what = d[1];
      if (what === "open") rows.push({ source: mon, kind: "monster", item: d[2], chance, note: "via chest" });
      else rows.push({ source: mon, kind: "monster", item: what, chance, note: d[2] != null ? "x" + d[2] : "" });
    }
  }
  const mapd = (G.drops && G.drops.maps) || {};
  for (const [map, list] of Object.entries(mapd)) {
    for (const d of list || []) {
      if (!Array.isArray(d)) continue;
      if (d[1] === "open") rows.push({ source: map, kind: "map", item: d[2], chance: d[0], note: "via chest" });
      else rows.push({ source: map, kind: "map", item: d[1], chance: d[0], note: d[2] != null ? "x" + d[2] : "" });
    }
  }

  function draw() {
    out.innerHTML = "";
    const s = q.value.trim().toLowerCase();
    const f = rows.filter((r) => !s || r.source.toLowerCase().includes(s) ||
      String(r.item).toLowerCase().includes(s) || itemName(r.item).toLowerCase().includes(s));
    sortableTable(out, f, [
      { key: "icon", label: "", get: (r) => r.item, render: (r) => icon(r.item, 1.6) },
      { key: "item", label: "Item", get: (r) => itemName(r.item),
        render: (r) => el("span", {}, el("span", {}, itemName(r.item)), el("span", { class: "dim" }, " " + r.item)) },
      { key: "source", label: "Source", get: (r) => r.source },
      { key: "kind", label: "Kind", get: (r) => r.kind, render: (r) => el("span", { class: "tag" }, r.kind) },
      { key: "chance", label: "Chance", num: true, get: (r) => r.chance,
        render: (r) => el("span", {}, (r.chance * 100).toPrecision(3) + "%") },
      { key: "one", label: "1 in", num: true, get: (r) => (r.chance ? 1 / r.chance : null),
        render: (r) => el("span", { class: "dim" }, r.chance ? fmt(Math.round(1 / r.chance)) : "—") },
      { key: "note", label: "Note", get: (r) => r.note },
    ], { noun: " drop entries", sortKey: "chance", sortDir: -1 });
  }
  q.addEventListener("input", draw);
  draw();
});

/* =============================================================== WORLD TAB */
tab("world", "World", (host) => {
  host.append(el("div", { class: "panel src" }, "From ", el("b", {}, "design/maps.py"),
    " · ", el("b", {}, "design/npcs.py"), " · geometry from aldata (absent from repo)"));
  const out = el("div", { class: "panel" });
  const geo = G.geometry || {};
  const rows = Object.entries(G.maps || {}).map(([k, m]) => ({
    key: k, name: m.name || k,
    npcs: (m.npcs || []).length, monsters: (m.monsters || []).length,
    doors: (m.doors || []).length, spawns: (m.spawns || []).length,
    drop_norm: m.drop_norm, pvp: !!m.pvp, instance: !!m.instance,
    geo: geo[k] ? "yes" : "no",
  }));
  sortableTable(out, rows, [
    { key: "name", label: "Map", get: (r) => r.name },
    { key: "key", label: "Key", get: (r) => r.key, render: (r) => el("span", { class: "dim" }, r.key) },
    { key: "monsters", label: "Spawn groups", num: true, get: (r) => r.monsters },
    { key: "npcs", label: "NPCs", num: true, get: (r) => r.npcs },
    { key: "doors", label: "Doors", num: true, get: (r) => r.doors },
    { key: "spawns", label: "Spawns", num: true, get: (r) => r.spawns },
    { key: "drop_norm", label: "Drop norm", num: true, get: (r) => r.drop_norm },
    { key: "pvp", label: "PvP", get: (r) => (r.pvp ? "yes" : ""), render: (r) => r.pvp ? el("span", { class: "tag" }, "PVP") : null },
    { key: "geo", label: "Geometry", get: (r) => r.geo, render: (r) => el("span", { class: r.geo === "yes" ? "good" : "dim" }, r.geo) },
  ], { noun: " maps", sortKey: "name" });
  host.append(out);
});

/* ============================================================== MARKET TAB */
tab("market", "Market", (host) => renderMarket(host, {
  defaultFilter: "",
  blurb: "The open-source repo carries no live merchant stock, and adventure.land's public " +
    "player/merchant pages strip trade slots, so this section is the one part that cannot come from GitHub.",
}));

/* ================================================================ BANK TAB */
tab("bank", "Bank", (host) => {
  const ctl = el("div", { class: "panel" });
  const sel = el("select", { style: "min-width:260px" }, el("option", { value: "" }, "loading owners…"));
  const status = el("span", { class: "dim" }, "");
  const out = el("div", { class: "panel" });
  ctl.append(el("div", { class: "src", style: "margin-bottom:8px" },
    "From ", el("b", {}, "aldata.earthiverse.ca/active-owners"), " and ", el("b", {}, "/bank/<owner>"),
    " · only accounts that opted in are exposed. Saved snapshot, not live state."),
    el("div", { class: "row" }, sel, status));
  host.append(ctl, out);

  (async () => {
    try {
      if (!OWNERS) {
        const r = await fetch(ALDATA_API + "/active-owners");
        OWNERS = await r.json();
      }
      sel.innerHTML = "";
      sel.append(el("option", { value: "" }, "Choose an owner…"));
      for (const o of OWNERS) {
        sel.append(el("option", { value: o.owner },
          `${o.owner} — ${(o.characters || []).length} chars${o.discord ? " (" + o.discord + ")" : ""}`));
      }
    } catch (e) {
      sel.innerHTML = ""; sel.append(el("option", {}, "failed to load owners"));
      out.append(el("div", { class: "err" }, String(e.message)));
    }
  })();

  sel.addEventListener("change", async () => {
    out.innerHTML = "";
    if (!sel.value) return;
    status.textContent = "loading…";
    try {
      const r = await fetch(ALDATA_API + "/bank/" + encodeURIComponent(sel.value));
      if (!r.ok) throw new Error("bank " + r.status);
      const bank = await r.json();
      status.textContent = "";
      const packs = Object.keys(bank).filter((k) => k.startsWith("items"));
      const rows = [];
      for (const p of packs) {
        for (const it of bank[p] || []) {
          if (!it || !it.name) continue;
          rows.push({ pack: p, item: it.name, level: it.level ?? 0, q: it.q || 1, special: it.p || null });
        }
      }
      out.append(el("div", { class: "row", style: "margin-bottom:10px" },
        el("span", { class: "pill" }, "gold " + fmt(bank.gold)),
        el("span", { class: "pill" }, packs.length + " packs"),
        el("span", { class: "pill" }, fmt(rows.length) + " stacks")));
      sortableTable(out, rows, [
        { key: "icon", label: "", get: (r) => r.item, render: (r) => icon(r.item, 1.6) },
        { key: "item", label: "Item", get: (r) => itemName(r.item),
          render: (r) => el("span", {}, el("span", {}, itemName(r.item)), el("span", { class: "dim" }, " " + r.item)) },
        { key: "level", label: "Lv", num: true, get: (r) => r.level },
        { key: "q", label: "Qty", num: true, get: (r) => r.q },
        { key: "special", label: "Special", get: (r) => r.special },
        { key: "pack", label: "Pack", get: (r) => r.pack },
      ], { noun: " bank stacks", sortKey: "item" });
    } catch (e) {
      status.textContent = "";
      out.append(el("div", { class: "err" }, "Could not load bank: " + e.message));
    }
  });
});

/* ============================================================= SOURCES TAB */
tab("sources", "Sources", (host) => {
  const p = el("div", { class: "panel" });
  p.append(el("h4", { style: "margin:0 0 10px;color:var(--accent)" }, "Where every number on this page comes from"));

  const t = el("table");
  t.append(el("thead", {}, el("tr", {},
    el("th", {}, "Dataset"), el("th", {}, "Source"), el("th", { class: "num" }, "Records"))));
  const tb = el("tbody");
  const repoOf = {};
  for (const [m, vars] of Object.entries(EXPORTS)) for (const v of vars) repoOf[v] = `design/${m}.py`;
  const keys = Object.keys(G).filter((k) => !k.startsWith("__")).sort();
  for (const k of keys) {
    const src = repoOf[k]
      ? el("span", {}, el("span", { class: "good" }, "repo "), el("span", { class: "dim" }, repoOf[k]))
      : el("span", { class: "warn" }, "aldata /data.json (not in repo)");
    tb.append(el("tr", {},
      el("td", {}, k), el("td", {}, src),
      el("td", { class: "num" }, fmt(G[k] && typeof G[k] === "object" ? Object.keys(G[k]).length : 1))));
  }
  t.append(tb);
  p.append(el("div", { class: "scroll" }, t));
  host.append(p);

  const live = el("div", { class: "panel" });
  live.append(el("h4", { style: "margin:0 0 10px;color:var(--accent)" }, "Live endpoints"));
  const lt = el("table");
  lt.append(el("thead", {}, el("tr", {}, el("th", {}, "Endpoint"), el("th", {}, "Used for"), el("th", {}, "Auth"))));
  const ltb = el("tbody");
  for (const [u, why, auth] of [
    [ALDATA_API + "/merchants", "Market listings (buy + sell orders)", "none"],
    [ALDATA_API + "/active-owners", "Opted-in bank owners", "none"],
    [ALDATA_API + "/bank/<owner>", "Bank contents + gold", "none for opted-in owners"],
    [ALDATA_SITE + "/data.json", "geometry, images, docs (absent from repo)", "none"],
    [REPO + "/design/*.py", "29 game datasets, run through Pyodide", "none"],
    [REPO + "/images/tiles/items/*.png", "Item icons, cropped on canvas", "none"],
  ]) ltb.append(el("tr", {}, el("td", { class: "dim" }, u), el("td", {}, why), el("td", {}, auth)));
  lt.append(ltb);
  live.append(lt);
  host.append(live);

  const notes = el("div", { class: "panel" });
  notes.append(el("h4", { style: "margin:0 0 10px;color:var(--accent)" }, "Version skew"));
  const snap = G.__aldataSnapshot;
  const repoItems = G.items ? Object.keys(G.items).length : 0;
  const aldItems = META.aldataItemCount || 0;
  notes.append(el("div", {},
    `The open-source repo lags the deployed game. This page shows `,
    el("b", { class: "good" }, fmt(repoItems)),
    ` items from the repo; aldata's snapshot of the deployed game has `,
    el("b", { class: "warn" }, fmt(aldItems)),
    aldItems > repoItems ? ` — ${fmt(aldItems - repoItems)} newer items exist in the live game but not in the public source.` : "."));
  if (META.aldataTimestamp) {
    notes.append(el("div", { class: "dim", style: "margin-top:6px" },
      `aldata snapshot: version ${META.aldataVersion}, built ${META.aldataTimestamp}`));
  }
  if (META.failures && META.failures.length) {
    notes.append(el("div", { class: "bad", style: "margin-top:10px" },
      "Module issues: " + META.failures.join(" | ")));
  } else {
    notes.append(el("div", { class: "good", style: "margin-top:6px" }, "All design modules executed cleanly."));
  }
  host.append(notes);
});
