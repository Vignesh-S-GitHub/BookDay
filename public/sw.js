const CACHE = "bookday-v1-1";
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/calendar-export.js",
  "/app.css",
  "/assets/theme.css",
  "/vendor/htmx.min.js",
  "/data/catalog.json",
  "/data/holidays.json",
  "/manifest.webmanifest",
  "/assets/brand/bookday_logo_horizontal.png",
  "/assets/brand/app_icon_192.png",
  "/assets/brand/app_icon_512.png",
  ...[
    "home_india",
    "train_journey",
    "india_festivals",
    "kerala_backwaters",
  ].map((x) => `/assets/banners/${x}.svg`),
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
  ].map((x) => `/assets/categories/${x}.svg`),
  ...[
    "home",
    "explore",
    "calendar",
    "saved",
    "more",
    "bell",
    "back",
    "search",
    "clock",
    "check",
    "location",
  ].map((x) => `/assets/icons/${x}.svg`),
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
