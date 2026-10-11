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
tn_source = (
    "https://www.stationeryprinting.tn.gov.in/extraordinary/2025/721_Ex_II_1_2025.pdf"
)
# Gazette No. 721, G.O. Ms. 708, 11 November 2025; annexure transcribed
# from the official downloaded PDF. Annual schedule only, not later local orders.
for day, name, festival in [
    ("01-01", "New Year's Day", True),
    ("01-15", "Pongal", True),
    ("01-16", "Thiruvalluvar Day", False),
    ("01-17", "Uzhavar Thirunal", True),
    ("02-01", "Thai Poosam", True),
    ("03-19", "Telugu New Year's Day", True),
    ("03-21", "Ramzan (Idu'l Fitr)", True),
    ("03-31", "Mahaveer Jayanthi", True),
    ("04-03", "Good Friday", True),
    ("04-14", "Tamil New Year's Day / Dr. B. R. Ambedkar's Birthday", True),
    ("05-01", "May Day", False),
    ("05-28", "Bakrid (Idul Azha)", True),
    ("06-26", "Muharram", True),
    ("08-26", "Milad-un-Nabi", True),
    ("09-04", "Krishna Jayanthi", True),
    ("09-14", "Vinayakar Chathurthi", True),
    ("10-19", "Ayutha Pooja", True),
    ("10-20", "Vijaya Dasami", True),
    ("11-08", "Deepavali", True),
    ("12-25", "Christmas", True),
]:
    holidays.append(
        record(
            "2026-" + day,
            name,
            ["Tamil Nadu"],
            "state_public",
            tn_source,
            festival,
            "Tamil Nadu state-government offices and commercial/cooperative banks. Private employer schedules may differ. Sunday holidays remain on the published date; no substitute weekday is assumed.",
        )
    )
holidays.append(
    record(
        "2026-04-01",
        "Bank annual closing",
        ["Tamil Nadu"],
        "bank_holiday",
        tn_source,
        note="Commercial and cooperative banks only; not a general state-office holiday.",
    )
)
# National entries already represent Republic Day, Independence Day and Gandhi Jayanti.
holidays.append(
    record(
        "2026-04-23",
        "Tamil Nadu Assembly polling day",
        ["Tamil Nadu"],
        "state_public",
        "https://www.stationeryprinting.tn.gov.in/extraordinary/2026/208_Ex_II_1_2026.pdf",
        note="Statewide polling-day public holiday under G.O. Ms. 239, 26 March 2026. Limited constituency bye-election closures are not treated as statewide holidays.",
    )
)
# Keep separate jurisdiction-specific IDs for holidays with the same name/date.
for item in holidays:
    item["id"] = (
        str(item["id"])
        + "-"
        + "-".join(item["jurisdictions"]).lower().replace(" ", "-")
    )
data_dir = ROOT / "public" / "data"
data_dir.mkdir(parents=True, exist_ok=True)
for filename, value in [
    ("catalog.json", catalog),
    (
        "holidays.json",
        {
            "version": 1,
            "coverage": "Tamil Nadu 2026 annual public-holiday schedule (Gazette 721 / G.O. 708) plus the statewide 23 April polling holiday (Gazette 208 / G.O. 239), annual national holidays for 2026–2027, and selected Kerala 2026 records. Other state/UT schedules, later local orders, constituency-only election closures, school and district holidays are not complete. No 2027 state schedule is assumed. Absence of a record does not mean a working day.",
            "records": sorted(holidays, key=lambda item: item["date"]),
        },
    ),
]:
    (data_dir / filename).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
