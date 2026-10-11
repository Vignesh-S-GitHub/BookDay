/** Calendar fields refer to the opening, never the journey. IST has no DST. */
export function eventFields(plan) {
  if (!plan.result.opening_date)
    throw new Error("An opening date is needed for calendar export.");
  const title = `BookDay: ${plan.categoryLabel} ${plan.reminder_time ? "booking reminder" : "booking opens"}${plan.title && plan.title !== plan.categoryLabel + " booking opens" ? " — " + plan.title : ""}`;
  const location = [plan.origin, plan.destination].filter(Boolean).join(" → ");
  const description = [
    "Booking opens: " +
      plan.result.opening_date +
      (plan.result.opening_time
        ? " " + plan.result.opening_time + " Asia/Kolkata"
        : " (time unknown; all-day reminder)"),
    "Journey/event date: " + plan.event_date,
    plan.reminder_time
      ? "Your chosen reminder time: " +
        plan.reminder_time +
        " IST (not a provider opening-time claim)"
      : "",
    plan.duration ? "Stay: " + plan.duration + " nights" : "",
    plan.quantity ? "People / tickets: " + plan.quantity : "",
    "Applied rule: " + plan.result.rule,
    "Verification: " + (plan.result.verification_status || "Rule Unverified"),
    "Service: " + (plan.service || plan.categoryLabel),
    location ? "Route: " + location : "",
    plan.source ? "Policy source: " + plan.source : "",
    "Opening date is separate from ticket or slot availability.",
  ]
    .filter(Boolean)
    .join("\n");
  const time = plan.reminder_time || plan.result.opening_time;
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Reminder time must be a valid HH:mm time.");
  const allDay = !time;
  const start = allDay
    ? plan.result.opening_date.replaceAll("-", "")
    : stamp(new Date(`${plan.result.opening_date}T${time}:00+05:30`));
  const end = allDay
    ? stamp(
        new Date(
          Date.parse(plan.result.opening_date + "T00:00:00Z") + 86400000,
        ),
      ).slice(0, 8)
    : stamp(
        new Date(
          Date.parse(`${plan.result.opening_date}T${time}:00+05:30`) + 900000,
        ),
      );
  return { title, location, description, allDay, start, end };
}
const stamp = (date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
export function googleCalendarUrl(plan) {
  const event = eventFields(plan);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${event.start}/${event.end}`,
    stz: "Asia/Kolkata",
    etz: "Asia/Kolkata",
    ctz: "Asia/Kolkata",
    details: event.description,
    location: event.location,
  });
  // www.google.com/render avoids mobile Calendar's /r/eventedit app-link route,
  // which can discard template fields and show only the current month.
  return "https://www.google.com/calendar/render?" + params;
}
export function escapeText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}
export function foldLine(line) {
  let result = "",
    segment = "",
    bytes = 0;
  const encoder = new TextEncoder();
  for (const char of line) {
    const count = encoder.encode(char).length;
    if (bytes + count > 75) {
      result += segment + "\r\n";
      segment = " ";
      bytes = 1;
    }
    segment += char;
    bytes += count;
  }
  return result + segment;
}
export function createICS(plan, offsets = [0], now = new Date()) {
  const event = eventFields(plan);
  const uid = String(plan.id).replace(/[^a-zA-Z0-9-]/g, "") + "@bookday.app";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BookDay//Booking reminders v1//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    "UID:" + uid,
    "DTSTAMP:" + stamp(now),
    "SUMMARY:" + escapeText(event.title),
    "DESCRIPTION:" + escapeText(event.description),
    "LOCATION:" + escapeText(event.location),
    (event.allDay ? "DTSTART;VALUE=DATE:" : "DTSTART:") + event.start,
    (event.allDay ? "DTEND;VALUE=DATE:" : "DTEND:") + event.end,
  ];
  for (const offset of [...new Set(offsets)]) {
    if (!Number.isInteger(offset) || offset < 0 || offset > 525600)
      throw new Error("Reminder offset must be 0–525600 minutes.");
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + escapeText("Booking opens: " + event.title),
      "TRIGGER:" + (offset === 0 ? "PT0M" : `-PT${offset}M`),
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
export function bookingSummary(plan) {
  const event = eventFields(plan);
  return event.title + "\n" + event.description;
}
