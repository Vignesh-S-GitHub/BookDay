"""Regression checks for the independent artwork and offline application shell."""

import json
import re
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"


def test_new_artwork_is_complete_and_encoded() -> None:
    items = json.loads((ROOT / "docs/artwork.json").read_text(encoding="utf-8"))
    assert len(items) == 70
    assert len({item["path"] for item in items}) == len(items)
    for item in items:
        contents = (PUBLIC / item["path"].lstrip("/")).read_bytes()
        assert contents[:4] == b"RIFF"
        assert contents[8:12] == b"WEBP"
        assert item["width"] >= 320
        assert item["generatedBy"] == "Built-in image_gen"


def test_old_design_kit_is_not_served_or_referenced() -> None:
    assert not (PUBLIC / "assets").exists()
    for name in ["index.html", "app.js", "app.css", "sw.js", "manifest.webmanifest"]:
        assert "/assets/" not in (PUBLIC / name).read_text(encoding="utf-8")
    assert (PUBLIC / "fonts/roboto-latin.woff2").read_bytes()[:4] == b"wOF2"
    assert "SIL OPEN FONT LICENSE" in (PUBLIC / "fonts/OFL.txt").read_text(
        encoding="utf-8"
    )


def test_navigation_and_category_symbols_exist() -> None:
    tree = ElementTree.parse(PUBLIC / "art/icons.svg")
    ids = {node.get("id") for node in tree.iter()}
    catalog = json.loads((PUBLIC / "data/catalog.json").read_text(encoding="utf-8"))
    assert {item["id"] for item in catalog["categories"]} <= ids
    for symbol in [
        "flag",
        "megaphone",
        "home",
        "explore",
        "calendar",
        "saved",
        "more",
        "bell",
        "search",
        "back",
    ]:
        assert symbol in ids
    for source in re.findall(
        r'href="(/art/icons\.svg#\w+)"',
        (PUBLIC / "index.html").read_text(encoding="utf-8"),
    ):
        assert source.split("#")[1] in ids


def test_self_hosted_font_is_permitted_by_csp() -> None:
    headers = (PUBLIC / "_headers").read_text(encoding="utf-8")
    assert "font-src 'self'" in headers
    assert "style-src 'self';" in headers
    assert "fonts.googleapis.com" not in (PUBLIC / "app.css").read_text(
        encoding="utf-8"
    )


def test_service_worker_caches_new_art_and_preserves_first_visit_result() -> None:
    worker = (PUBLIC / "sw.js").read_text(encoding="utf-8")
    assert "bookday-v2" in worker
    assert "/fonts/roboto-latin.woff2" in worker
    assert "/art/icons.svg" in worker
    assert "quick_" in worker
    assert "saved_" in worker
    assert "upcoming_train" in worker
    assert "railway" in worker
    client = (PUBLIC / "app.js").read_text(encoding="utf-8")
    assert "if (alreadyControlled) location.reload()" in client
