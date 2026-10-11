# Illustrated Indian festival calendar

BookDay has 34 reusable festival artwork themes and 65 separately reviewed annual observance dates: 34 in 2026 and 31 in 2027. Festival identities select images; civil dates come from the published calendar for that year. No lunar festival dates are inferred by repeating last year's month/day.

## Sources and scope

- [NHAI official 2026 calendar](https://nhai.gov.in/assets/pdf/NHAI_Table_Calendar-2026.pdf): central gazetted and restricted festival observances.
- [PFRDA official 2027 holiday order](https://pfrda.org.in/documents/33652/0/list_holidays_2027.pdf), published 14 August 2026: 2027 compulsory and restricted observances. This is an authority-specific holiday schedule, not a declaration of statewide leave across India.
- [Tamil Nadu Gazette 721 / G.O. 708](https://www.stationeryprinting.tn.gov.in/extraordinary/2025/721_Ex_II_1_2025.pdf): local 2026 public holidays, including Pongal on 15 January, Ayutha Pooja on 19 October and Bakrid on 28 May.
- [Kerala official 2026 holidays](https://gad.kerala.gov.in/sites/default/files/inline-files/public-holidays-2026_0.pdf): local Vishu on 15 April, Karkadaka Vavu on 12 August, Onam series and Vijayadashami on 21 October.

The festival guide includes main Indian festivals and selected regional observances, including Pongal, Sankranti, Vasant Panchami, Thai Poosam, Maha Shivratri, Holi, Ugadi/Gudi Padwa, Eid al-Fitr, Ram Navami, Mahavir Jayanti, Good Friday, Easter, Puthandu, Vishu, Vaisakhi, Bohag Bihu, Buddha Purnima, Bakrid, Muharram, Rath Yatra, Karkadaka Vavu, Milad, Onam, Raksha Bandhan, Janmashtami, Ganesh Chaturthi, Durga Puja, Ayutha Pooja/Mahanavami, Dussehra, Diwali, Chhath, Gurpurab, Christmas and New Year's Day. It is a curated guide, not an exhaustive list of India's religious and community occasions. Multi-day Onam and related local observances share appropriate festival-family artwork.

## Date precedence

The 45 existing public-calendar records remain separate from the 65 festival observances. The frontend merges these for display. If the selected state has local records for a festival and year, those records replace the central guide entry for that festival/year, including when the dates differ. Distinct local days, such as the Onam series, remain available in calendar details. The annual illustrated guide shows the main day once per festival identity, preferring the reviewed main date when it matches a local day, otherwise the first local date.

Festival guide entries are labelled **Festival observance**. They do not create statewide leave or derived long weekends. Only verified national/state public holidays contribute to long-weekend calculations. Travel demand remains a calendar heuristic, with no live crowd or price predictions. Islamic dates may be revised after local moon sighting.

Thai Poosam, Vishu and Karkadaka Vavu have reviewed 2026 dates only. Their 2027 entries await a reviewed local source. Years beyond 2027 show a clear absence-of-reviewed-dates message; they are not filled with copied or calculated dates. State public-holiday coverage remains as described in `holidays.json`.

## UI and artwork

- Home chooses the next reviewed festival and displays its matching artwork, title and high-contrast date badge. The date and navigation arrow occupy a separate flexible footer. Clicking opens the exact calendar date.
- Calendar details display the matching festival thumbnail and an explicit date outside the image. Public holidays and festival observances retain source links and review notes.
- The year-specific festival guide shows artwork, names and dates in separate areas. Cards navigate to their date. The Festivals layer controls the guide.
- Nearby festival travel insights display the relevant thumbnail.
- All 34 generated WebP images are in `public/art/festivals/`, with prompts and provenance in `artwork.json`. They contain no baked-in titles or dates, so artwork can be reused across years and text cannot collide with image labels.
- The service worker precaches the complete artwork set and annual fixtures for offline browsing. Changing `CACHE` releases the new shell through the existing explicit update flow.

## Maintaining reviewed dates

### Selected-state display and symbols

The annual publisher derives `festival_regions` from approved official state records. The calendar, Home upcoming card and Travel Insights only use festival identities associated with the selected state (or an explicit state-scoped observance). National public holidays remain visible. This filters the central Durga Puja entry out of Tamil Nadu while retaining its reviewed Ayutha Pooja entry. Unknown regional coverage remains explicitly incomplete; association does not establish future-year public leave.

Year-specific observance dates and all 34 reusable artworks remain stored. Tamil Nadu currently displays 17 associated themes in 2026 and 16 reviewed dates in 2027; Kerala displays nine themes in 2026 and seven in 2027. The manifest carries state associations even when only a future-year dataset is loaded.

Small vector markers use a lamp for Hindu festivals, crescent/star for Muslim festivals, cross for Christian festivals, Khanda for Sikh festivals, Dharma wheel for Buddhist festivals and Ahimsa hand for Jain festivals. Civil/unknown identities use a neutral calendar. Multiple distinct faith symbols can share a date. The symbol references follow [IDC IIT Bombay's religious-symbol gallery](https://www.dsource.in/gallery/religious-symbols-india); the artwork is original SVG code.

Date controls use a chevron to open the themed calendar. Travel Date retains one leading calendar icon, which also opens the picker and supports keyboard activation.

1. Obtain the relevant year's official central/state/authority calendar and check regional differences.
2. Update `scripts/festival_data.py` with the actual civil dates and source URLs. Leave missing dates unset.
3. Update any new applicable state public-holiday records in `scripts/prepare_data.py`; avoid promoting festival observances to public holidays.
4. Run `uv run scripts/prepare_data.py` and update date regressions.
5. Run the repository quality gate, asset checks and `tests/festivals-regression.js` through Playwright CLI.

No scheduled external data fetch or automatic new-year publication is implemented. New-year dates require source review and a release.
