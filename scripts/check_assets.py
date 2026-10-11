"""Check source fixture dates, jurisdictions, and assets used by the UI."""

import json
from datetime import date
from pathlib import Path

root = Path(__file__).resolve().parents[1]
public = root / "public"
catalog = json.loads((public / "data/catalog.json").read_text(encoding="utf-8"))
holidays = json.loads((public / "data/holidays.json").read_text(encoding="utf-8"))
assert len(catalog["categories"]) == 14
assert len(set(catalog["states"])) == 36
for category in catalog["categories"]:
    assert (public / "art/categories" / f"{category['id']}.webp").is_file()
for record in holidays["records"] + holidays["festival_calendar"]:
    date.fromisoformat(record["date"])
    assert record["source"].startswith("https://")
    assert record["status"] in {"official", "tentative", "unverified"}
    assert all(
        state == "IN" or state in catalog["states"] for state in record["jurisdictions"]
    )
    if record["festival"]:
        assert record["festival_id"] in holidays["festival_art"]
for festival in holidays["festival_art"].values():
    assert (public / festival["image"].lstrip("/")).is_file(), festival["name"]
for asset in [
    "logo.webp",
    "celebration.webp",
    "app_icon_192.png",
    "app_icon_512.png",
    "icons.svg",
    "banners/home_india.webp",
    "banners/train_journey.webp",
    "banners/temple_darshan.webp",
    "banners/kerala_backwaters.webp",
    "banners/india_festivals.webp",
]:
    assert (public / "art" / asset).is_file(), asset
assert (public / "fonts/roboto-latin.woff2").is_file()
assert (public / "fonts/OFL.txt").is_file()
for file in ["app.js", "app.css", "index.html", "sw.js", "manifest.webmanifest"]:
    assert "/assets/" not in (public / file).read_text(encoding="utf-8"), file
print(
    f"Verified assets for 14 categories, 36 jurisdictions, {len(holidays['records'])} public-calendar records and {len(holidays['festival_calendar'])} yearly festival observances with {len(holidays['festival_art'])} artwork themes."
)
