"""Generate versioned public fixtures from reviewed official records."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
categories = [
    ("trains", "Trains", "Rail journeys, general advance reservation and Tatkal"),
    ("flights", "Flights", "Domestic and international journeys"),
    ("buses", "Buses", "Intercity bus journeys"),
    ("hotels", "Hotels & stays", "Hotel rooms and holiday stays"),
    ("movies", "Movies", "Cinema releases and screenings"),
    ("temples", "Temples", "Pilgrimage and darshan announcements"),
    ("events", "Events & concerts", "Concerts, festivals and live events"),
    ("sports", "Sports", "Matches and sports tickets"),
    ("tourism", "Tourism", "Attractions and tours"),
    ("appointments", "Appointments", "Personal appointments and slots"),
    ("government", "Government", "Passport and government service slots"),
    ("education", "Education", "Examination and admission dates"),
    ("healthcare", "Healthcare", "Doctor visits and healthcare appointments"),
    ("custom", "Custom", "Your own dates, services and booking rules"),
]
states = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
]
rail_source = "https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=2065879"
tatkal_source = "https://contents.irctc.co.in/en/tatkal_faq.pdf"
catalog = {
    "version": 1,
    "states": states,
    "categories": [
        {
            "id": key,
            "label": label,
            "description": description,
            "default_mode": "days" if key == "trains" else "unknown",
            "provider_url": "https://www.irctc.co.in/nget/train-search"
            if key == "trains"
            else None,
        }
        for key, label, description in categories
    ],
    "rail": {
        "advance_days": 60,
        "source": rail_source,
        "tatkal_source": tatkal_source,
        "reviewed": "2026-10-11",
        "warning": "Route and service exceptions may apply. Verify with IRCTC; dates do not imply seat availability.",
    },
}
national_source = "https://www.incredibleindia.gov.in/en/plan-your-trip/public-holidays"
kerala_source = "https://gad.kerala.gov.in/sites/default/files/inline-files/public-holidays-2026_0.pdf"
holidays = []


def record(
    day: str,
    name: str,
    jurisdiction: list[str],
    kind: str,
    source: str,
    festival: bool = False,
    note: str = "",
) -> dict[str, object]:
    return {
        "id": f"{day}-{name.lower().replace(' ', '-')}",
        "date": day,
        "name": name,
        "jurisdictions": jurisdiction,
        "districts": [],
        "type": kind,
        "festival": festival,
        "status": "official",
        "source": source,
        "reviewed": "2026-10-11",
        "note": note,
    }


for year in (2026, 2027):
    for suffix, name in [
        ("01-26", "Republic Day"),
        ("08-15", "Independence Day"),
        ("10-02", "Gandhi Jayanti"),
    ]:
        holidays.append(
            record(
                f"{year}-{suffix}",
                name,
                ["IN"],
                "national_public",
                national_source,
                note="Fixed annual national holiday; employer schedules may differ.",
            )
        )
for day, name, festival in [
    ("01-02", "Mannam Jayanthi", False),
    ("04-02", "Maundy Thursday", True),
    ("04-03", "Good Friday", True),
    ("04-14", "Dr. B. R. Ambedkar Jayanthi", False),
    ("04-15", "Vishu", True),
    ("05-01", "May Day", False),
    ("08-12", "Karkadaka Vavu", True),
    ("08-26", "Thiruvonam", True),
    ("08-27", "Third Onam", True),
    ("08-28", "Fourth Onam / Sree Narayana Guru Jayanthi / Ayyankali Jayanthi", True),
    ("09-04", "Sreekrishna Jayanthi", True),
    ("09-21", "Sree Narayana Guru Samadhi Day", False),
    ("10-20", "Mahanavami", True),
    ("10-21", "Vijayadasami", True),
    ("12-25", "Christmas", True),
]:
    holidays.append(
        record(
            "2026-" + day,
            name,
            ["Kerala"],
            "state_public",
            kerala_source,
            festival,
            "Public offices under the Government of Kerala; private employer holidays may differ.",
        )
    )
holidays.append(
    record(
        "2026-11-08",
        "Deepavali",
        ["Kerala"],
        "religious_festival",
        kerala_source,
        True,
        "Falls on Sunday; listed as an occasion, not an additional weekday public holiday.",
    )
)
holidays.append(
    record(
        "2026-04-01",
        "Bank annual closing",
        ["Kerala"],
        "bank_holiday",
        kerala_source,
        note="Commercial and cooperative banks; not a general public holiday.",
    )
)
data_dir = ROOT / "public" / "data"
data_dir.mkdir(parents=True, exist_ok=True)
for filename, value in [
    ("catalog.json", catalog),
    (
        "holidays.json",
        {
            "version": 1,
            "coverage": "Curated examples: annual national holidays for 2026–2027 and selected Kerala 2026 records. State/UT, school, district and festival coverage is incomplete. Absence of a record does not mean a working day.",
            "records": sorted(holidays, key=lambda item: item["date"]),
        },
    ),
]:
    (data_dir / filename).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
