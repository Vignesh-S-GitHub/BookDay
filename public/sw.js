const CACHE = "bookday-v2-dynamic-planners-final";
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/calendar-export.js",
  "/controls.js",
  "/booking-fields.js",
  "/destinations.js",
  "/app.css",
  "/fonts/roboto-latin.woff2",
  "/vendor/htmx.min.js",
  "/data/catalog.json",
  "/data/holidays.json",
  "/manifest.webmanifest",
  "/art/logo.webp",
  "/art/celebration.webp",
  "/art/icons.svg",
  "/art/app-icon.svg",
  "/art/app_icon_192.png",
  "/art/app_icon_512.png",
  ...[
    "home_india",
    "train_journey",
    "india_festivals",
    "kerala_backwaters",
    "temple_darshan",
    "agra_taj",
    "jaipur_palace",
    "goa_coast",
    "andhra_coast",
    "arunachal_mountains",
    "assam_river",
    "bihar_bodhgaya",
    "chhattisgarh_falls",
    "gujarat_rann",
    "haryana_gardens",
    "himachal_valley",
    "jharkhand_falls",
    "karnataka_hampi",
    "madhya_sanchi",
    "maharashtra_mumbai",
    "manipur_lake",
    "meghalaya_bridge",
    "mizoram_hills",
    "nagaland_valley",
    "odisha_konark",
    "punjab_amritsar",
    "sikkim_mountains",
    "telangana_hyderabad",
    "tripura_palace",
    "uttarakhand_river",
    "bengal_kolkata",
    "andaman_beach",
    "chandigarh_lake",
    "daman_diu",
    "delhi_gate",
    "kashmir_lake",
    "ladakh_monastery",
    "lakshadweep_lagoon",
    "puducherry_coast",
  ].map((x) => `/art/banners/${x}.webp`),
  ...[
    "trains",
    "flights",
    "buses",
    "hotels",
    "movies",
    "temples",
    "events",
    "sports",
    "tourism",
    "appointments",
    "government",
    "education",
    "healthcare",
    "custom",
  ].map((x) => `/art/categories/${x}.webp`),
  ...[
    "trains",
    "flights",
    "buses",
    "hotels",
    "movies",
    "temples",
    "events",
    "tourism",
  ].map((x) => `/art/categories/quick_${x}.webp`),
  ...["railway", "upcoming_train"].map((x) => `/art/categories/${x}.webp`),
  ...["trains", "temples", "movies", "hotels", "government"].map(
    (x) => `/art/categories/saved_${x}.webp`,
  ),
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("bookday-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data === "activate-update") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/fragments/")
  )
    return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, copy)),
          );
        }
        return response;
      })
      .catch(
        async () =>
          (await caches.match(event.request)) ||
          (event.request.mode === "navigate"
            ? await caches.match("/index.html")
            : new Response("Offline asset unavailable", { status: 503 })),
      ),
  );
});
