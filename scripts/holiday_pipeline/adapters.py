"""Explicit TN English gazette adapter. Unknown layouts fail into review."""

import re
from datetime import date
from io import BytesIO

from .storage import slug

WEEKDAYS = "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"


def pdf_text(content: bytes) -> str:
    from pypdf import PdfReader
    from pypdf.errors import PyPdfError

    try:
        reader = PdfReader(BytesIO(content))
        if len(reader.pages) > 30:
            raise ValueError("Oversized notice: manual review required")
        return "\n".join(
            page.extract_text(extraction_mode="layout") for page in reader.pages
        )
    except PyPdfError as exc:
        raise ValueError("PDF extraction failed; source remains pending") from exc


def tamil_nadu(text: str, source: dict) -> list[dict]:
    """Parse English annexure only, retaining numbered identity across amendments."""
    year = source["year"]
    # Table starts at the first numbered English row and ends before Tamil version.
    first = re.search(r"(?m)^\s*1\.?\s+New\s+Year", text)
    if not first or "Public Holidays" not in text:
        raise ValueError(
            "English holiday table not found; scanned/changed format pending"
        )
    text = text[first.start() :]
    rows = []
    matches = list(
        re.finditer(
            r"(?m)^\s*(\d{1,2})\.\s+([^\n]+?)\s+(\d{2})\.(\d{2})\.(\d{4})\s+("
            + WEEKDAYS
            + r")\b",
            text,
        )
    )
    for match in matches:
        number, name, dd, mm, yyyy, weekday = match.groups()
        number = int(number)
        if int(yyyy) != year:
            raise ValueError("Wrong year in annual notice")
        day = date(year, int(mm), int(dd))
        if day.strftime("%A") != weekday:
            raise ValueError(f"Weekday mismatch at row {number}")
        name = " ".join(name.split()).replace("’", "'")
        if name == "*Annual closing of":
            name = (
                "Annual closing of Accounts for Commercial Banks & Co-operative Banks"
            )
        elif name == "Tamil New Year's Day /":
            if not re.search(r"Dr\.\s*B\.R\.\s*Ambedkar", text):
                raise ValueError("Missing wrapped Ambedkar birthday cell")
            name = "Tamil New Year's Day / Dr. B.R.Ambedkar's Birthday"
        # Page headings sometimes occur inside wrapped row 9; strip explicit header.
        name = re.sub(
            r"\d*\s*TAMIL NADU GOVERNMENT GAZETTE EXTRAORDINARY.*?(?=Annual|Accounts|for Commercial)",
            "",
            name,
        )
        bank = "closing" in name.lower()
        if bank:
            name = (
                "Annual closing of Accounts for Commercial Banks & Co-operative Banks"
            )
        rows.append(
            {
                "id": f"tn-{year}-annual-{number:02d}",
                "date": day.isoformat(),
                "name": name.lstrip("*"),
                "jurisdictions": ["Tamil Nadu"],
                "type": "bank_holiday" if bank else "state_public",
                "status": "official",
                "source": source["url"],
                "festival": False,
                "reviewed": None,
                "district": None,
                "scope": "bank" if bank else "state_government",
                "note": "Commercial/cooperative banks only."
                if bank
                else "Tamil Nadu annual government-office schedule; employer schedules and later amendments may differ.",
                "source_id": source["id"],
                "event_key": slug(name),
            }
        )
    if [int(r["id"].rsplit("-", 1)[1]) for r in rows] != list(
        range(1, source["expected_rows"] + 1)
    ):
        raise ValueError(
            f"Expected {source['expected_rows']} sequential table rows, found {len(rows)}; review extraction"
        )
    return rows


def parse(content: bytes, source: dict) -> list[dict]:
    if source["adapter"] == "tn-gazette-v1":
        return tamil_nadu(pdf_text(content), source)
    raise ValueError("No approved adapter for this source; manual review required")
