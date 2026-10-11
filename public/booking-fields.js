/** Service-specific labels and fields; no universal release window is assumed. */
export const bookingFields = {
  trains: {
    date: "Journey Date",
    route: true,
    service: "Train / operator",
    origin: "Chennai (MAS)",
    destination: "Madurai (MDU)",
  },
  flights: {
    date: "Departure Date",
    route: true,
    service: "Airline / flight",
    origin: "Chennai (MAA)",
    destination: "Delhi (DEL)",
    count: "Passengers",
  },
  buses: {
    date: "Journey Date",
    route: true,
    service: "Bus operator",
    origin: "Chennai",
    destination: "Bengaluru",
    count: "Passengers",
  },
  hotels: {
    date: "Check-in Date",
    place: "Place",
    service: "Hotel / stay",
    count: "Guests",
    nights: true,
  },
  movies: {
    date: "Screening Date",
    place: "Cinema / city",
    service: "Movie",
    count: "Tickets",
  },
  temples: {
    date: "Darshan Date",
    place: "Temple / place",
    service: "Darshan / entry type",
    count: "Visitors",
  },
  events: {
    date: "Event Date",
    place: "Venue / city",
    service: "Event / concert",
    count: "Tickets",
  },
  sports: {
    date: "Match Date",
    place: "Stadium / venue",
    service: "Match / sport",
    count: "Tickets",
  },
  tourism: {
    date: "Visit Date",
    place: "Place",
    service: "Attraction / tour",
    count: "Travellers",
  },
  appointments: {
    date: "Appointment Date",
    place: "Location",
    service: "Appointment / service",
  },
  government: {
    date: "Appointment Date",
    place: "Office / place",
    service: "Government service",
  },
  education: {
    date: "Exam / Admission Date",
    place: "Institution / city",
    service: "Exam / course",
  },
  healthcare: {
    date: "Appointment Date",
    place: "Clinic / hospital",
    service: "Doctor / specialty",
  },
  custom: { date: "Event Date", place: "Place", service: "Service / activity" },
};
