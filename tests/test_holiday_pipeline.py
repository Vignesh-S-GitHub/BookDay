"""Coverage cannot be inflated from empty datasets or assumed annual repeats."""
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("holiday_pipeline", ROOT / "scripts/holiday_pipeline.py")
pipeline = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pipeline)


def test_reviewed_fixture_and_partial_coverage():
    fixture = json.loads((ROOT / "public/data/holidays.json").read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / "public/data/catalog.json").read_text(encoding="utf-8"))
    output = pipeline.build(fixture, catalog)
    manifest = output["manifest.json"]
    assert len(manifest["jurisdictions"]) == 37
    assert manifest["jurisdictions"]["Tamil Nadu"]["2026"]["coverage"] == "partial"
    assert manifest["jurisdictions"]["Assam"]["2026"]["coverage"] == "not_verified"
    assert manifest["jurisdictions"]["Tamil Nadu"]["2027"]["file"] is None
    assert output["2026/tamil-nadu.json"]["records"]
    assert "2026/assam.json" not in output
    assert "2027/tamil-nadu.json" not in output


def test_rejects_duplicate_ids_and_unsourced_claims():
    good = {"id": "1", "date": "2026-01-26", "name": "Example",
            "jurisdictions": ["IN"], "type": "national_public",
            "status": "official", "source": "https://example.gov.in",
            "reviewed": "2026-10-11"}
    with pytest.raises(ValueError, match="duplicate"):
        pipeline.validate([good, dict(good)], {"Tamil Nadu"})
    with pytest.raises(ValueError, match="HTTPS source"):
        pipeline.validate([{**good, "source": ""}], {"Tamil Nadu"})
    with pytest.raises(ValueError, match="Invalid date"):
        pipeline.validate([{**good, "date": "2026-02-30"}], {"Tamil Nadu"})
