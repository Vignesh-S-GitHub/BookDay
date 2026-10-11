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
    assert (public / "assets/categories" / f"{category['id']}.svg").is_file()
for record in holidays["records"]:
    date.fromisoformat(record["date"])
    assert record["source"].startswith("https://")
    assert record["status"] in {"official", "tentative", "unverified"}
    assert all(
        state == "IN" or state in catalog["states"] for state in record["jurisdictions"]
    )
for asset in [
    "brand/bookday_logo_horizontal.png",
    "brand/app_icon_192.png",
    "brand/app_icon_512.png",
    "banners/home_india.svg",
    "banners/train_journey.svg",
    "banners/temple_darshan.svg",
    "banners/hotel_stay.svg",
    "banners/kerala_backwaters.svg",
]:
    assert (public / "assets" / asset).is_file(), asset
print(
    f"Verified assets for 14 categories, 36 jurisdictions and {len(holidays['records'])} sourced calendar records."
)
