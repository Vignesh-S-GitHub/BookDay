// Local published dates take precedence over the India-wide observance guide.
// Artwork is keyed by the festival identity, never by a recurring date.
export function calendarRecords(data, state) {
  const local = data.records.filter(
    (row) =>
      row.jurisdictions.includes("IN") || row.jurisdictions.includes(state),
  );
  const localFestivals = new Set(
    local
      .filter((row) => row.festival_id)
      .map((row) => `${row.date.slice(0, 4)}:${row.festival_id}`),
  );
  return [
    ...local,
    ...(data.festival_calendar || []).filter(
      (row) =>
        (row.jurisdictions.includes("IN") ||
          row.jurisdictions.includes(state)) &&
        !localFestivals.has(`${row.date.slice(0, 4)}:${row.festival_id}`),
    ),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function festivalImage(data, row, fallback) {
  return data.festival_art?.[row?.festival_id]?.image || fallback;
}

export function yearFestivals(data, state, year) {
  const groups = new Map();
  for (const row of calendarRecords(data, state)) {
    if (!row.festival_id || !row.date.startsWith(`${year}-`)) continue;
    if (!groups.has(row.festival_id)) groups.set(row.festival_id, []);
    groups.get(row.festival_id).push(row);
  }
  return [...groups.entries()]
    .map(([id, rows]) => {
      const primary = (data.festival_calendar || []).find(
        (row) => row.festival_id === id && row.date.startsWith(`${year}-`),
      );
      // Show the main day of a family (Good Friday, Pongal, Onam) while
      // retaining its distinct related local observances in day details.
      return rows.find((row) => row.date === primary?.date) || rows[0];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
