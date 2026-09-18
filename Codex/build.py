#!/usr/bin/env python3
"""Generate the two standalone AL pages from one shared template.

Both outputs are fully self-contained single HTML files: no build step is
needed to *use* them, this script only keeps the shared core in sync.

    python3 build.py
"""
import pathlib
import json

HERE = pathlib.Path(__file__).parent
TEMPLATE = (HERE / "_al_template.html").read_text(encoding="utf-8")

TARGETS = [
    {
        "out": "aldata_explorer.html",
        "title": "AL Data Explorer (self-hosted)",
        "heading": "AL DATA EXPLORER",
        "tabs": "_tabs_explorer.js",
        "config": {"mode": "explorer"},
    },
    {
        "out": "al_market_watchlist.html",
        "title": "AL Market — Watchlist",
        "heading": "AL MARKET · WATCHLIST",
        "tabs": "_tabs_watchlist.js",
        "config": {"mode": "watchlist"},
    },
]


def build() -> None:
    for t in TARGETS:
        tabs = (HERE / t["tabs"]).read_text(encoding="utf-8")
        html = (
            TEMPLATE
            .replace("__PAGE_TITLE__", t["title"])
            .replace("__HEADING__", t["heading"])
            .replace("__CONFIG__", json.dumps(t["config"]))
            .replace("__TABS__", tabs)
        )
        assert "__TABS__" not in html and "__CONFIG__" not in html
        path = HERE / t["out"]
        path.write_text(html, encoding="utf-8")
        print(f"wrote {path.name:28} {len(html):>8,} bytes")


if __name__ == "__main__":
    build()
