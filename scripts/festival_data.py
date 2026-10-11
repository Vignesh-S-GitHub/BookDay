"""Reviewed festival observances: yearly dates are data, never recurrence guesses."""

SOURCE_2026 = "https://nhai.gov.in/assets/pdf/NHAI_Table_Calendar-2026.pdf"
SOURCE_2027 = "https://pfrda.org.in/documents/33652/0/list_holidays_2027.pdf"
TN_2026 = (
    "https://www.stationeryprinting.tn.gov.in/extraordinary/2025/721_Ex_II_1_2025.pdf"
)
KERALA_2026 = "https://gad.kerala.gov.in/sites/default/files/inline-files/public-holidays-2026_0.pdf"

# id, display name, 2026 date, 2027 date. None means no reviewed date;
# it does not mean that the festival does not occur that year.
FESTIVALS = [
    ("new_year", "New Year's Day", "01-01", "01-01"),
    ("pongal", "Pongal", "01-15", "01-15"),
    ("sankranti", "Makar Sankranti", "01-14", "01-14"),
    ("vasant_panchami", "Vasant Panchami", "01-23", "02-11"),
    ("thai_poosam", "Thai Poosam", "02-01", None),
    ("shivratri", "Maha Shivratri", "02-15", "03-06"),
    ("holi", "Holi", "03-04", "03-23"),
    ("ugadi", "Ugadi / Gudi Padwa", "03-19", "04-07"),
    ("eid_fitr", "Eid al-Fitr", "03-21", "03-10"),
    ("ram_navami", "Ram Navami", "03-26", "04-15"),
    ("mahavir_jayanti", "Mahavir Jayanti", "03-31", "04-19"),
    ("good_friday", "Good Friday", "04-03", "03-26"),
    ("easter", "Easter", "04-05", "03-28"),
    ("tamil_new_year", "Tamil New Year / Puthandu", "04-14", "04-14"),
    # Kerala's gazette overrides the central 2026 restricted-holiday date.
    # Await a reviewed Kerala source for 2027 rather than copy its date.
    ("vishu", "Vishu", "04-15", None),
    ("vaisakhi", "Vaisakhi", "04-14", "04-14"),
    ("bihu", "Bohag Bihu", "04-15", "04-15"),
    ("buddha_purnima", "Buddha Purnima", "05-01", "05-20"),
    ("eid_adha", "Eid al-Adha / Bakrid", "05-27", "05-17"),
    ("muharram", "Muharram", "06-26", "06-16"),
    ("rath_yatra", "Rath Yatra", "07-16", "07-05"),
    ("karkadaka_vavu", "Karkadaka Vavu", "08-12", None),
    ("milad", "Milad-un-Nabi", "08-26", "08-15"),
    ("onam", "Onam / Thiruvonam", "08-26", "09-12"),
    ("raksha_bandhan", "Raksha Bandhan", "08-28", "08-17"),
    ("janmashtami", "Krishna Janmashtami", "09-04", "08-25"),
    ("ganesh_chaturthi", "Ganesh Chaturthi", "09-14", "09-04"),
    ("durga_puja", "Durga Puja / Maha Ashtami", "10-19", "10-07"),
    ("ayutha_pooja", "Ayutha Pooja / Mahanavami", "10-19", "10-08"),
    ("dussehra", "Dussehra / Vijayadashami", "10-20", "10-09"),
    ("diwali", "Diwali / Deepavali", "11-08", "10-29"),
    ("chhath", "Chhath Puja", "11-15", "11-04"),
    ("gurpurab", "Guru Nanak Jayanti", "11-24", "11-14"),
    ("christmas", "Christmas", "12-25", "12-25"),
]

ALIASES = {
    "New Year's Day": "new_year",
    "Pongal": "pongal",
    "Uzhavar Thirunal": "pongal",
    "Thai Poosam": "thai_poosam",
    "Telugu New Year's Day": "ugadi",
    "Ramzan (Idu'l Fitr)": "eid_fitr",
    "Mahaveer Jayanthi": "mahavir_jayanti",
    "Good Friday": "good_friday",
    "Maundy Thursday": "good_friday",
    "Tamil New Year's Day / Dr. B. R. Ambedkar's Birthday": "tamil_new_year",
    "Vishu": "vishu",
    "Bakrid (Idul Azha)": "eid_adha",
    "Muharram": "muharram",
    "Milad-un-Nabi": "milad",
    "Krishna Jayanthi": "janmashtami",
    "Sreekrishna Jayanthi": "janmashtami",
    "Vinayakar Chathurthi": "ganesh_chaturthi",
    "Ayutha Pooja": "ayutha_pooja",
    "Mahanavami": "ayutha_pooja",
    "Vijaya Dasami": "dussehra",
    "Vijayadasami": "dussehra",
    "Deepavali": "diwali",
    "Karkadaka Vavu": "karkadaka_vavu",
    "Thiruvonam": "onam",
    "Third Onam": "onam",
    "Fourth Onam / Sree Narayana Guru Jayanthi / Ayyankali Jayanthi": "onam",
    "Christmas": "christmas",
}


def festival_catalog() -> dict[str, dict[str, str]]:
    return {
        key: {"name": name, "image": f"/art/festivals/{key}.webp"}
        for key, name, _, _ in FESTIVALS
    }


def festival_observances() -> list[dict[str, object]]:
    rows = []
    for key, name, day_2026, day_2027 in FESTIVALS:
        for year, suffix in ((2026, day_2026), (2027, day_2027)):
            if suffix is None:
                continue
            source = SOURCE_2026 if year == 2026 else SOURCE_2027
            scope = "Central government calendar; regional observance dates may differ"
            if year == 2026 and key in {"pongal", "thai_poosam", "ayutha_pooja"}:
                source = TN_2026
                scope = "Tamil Nadu calendar"
            if year == 2026 and key in {"vishu", "karkadaka_vavu"}:
                source = KERALA_2026
                scope = "Kerala calendar"
            note = (
                f"{scope}. Festival observance, not a general public holiday in every state. "
                "Local schedules may differ."
            )
            if key in {"eid_fitr", "eid_adha", "muharram", "milad"}:
                note += " Lunar dates are subject to local moon sighting and official revisions."
            rows.append(
                {
                    "id": f"festival-{year}-{key}",
                    "festival_id": key,
                    "date": f"{year}-{suffix}",
                    "name": name,
                    "jurisdictions": ["IN"],
                    "districts": [],
                    "type": "religious_festival",
                    "festival": True,
                    "status": "official",
                    "source": source,
                    "scope": scope,
                    "reviewed": "2026-10-11",
                    "note": note,
                }
            )
    return sorted(rows, key=lambda row: str(row["date"]))
