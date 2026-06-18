// Service worker (PRD §5.16 FR-PWA-2/3). App-shell precache + offline fallback.
// Strategy: cache-first for the static shell; network-first for API GETs with a
// cache fallback so the roster/calendar remain viewable offline.
//
// Security (FR-PWA constraint): only the static shell and non-sensitive GETs are
// cached. Authorization headers are never stored, and we skip caching anything
// that looks like medical/PII or any non-GET.
const SHELL_CACHE = "troopers-shell-v1";
const DATA_CACHE = "troopers-data-v1";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache mutations

  const url = new URL(request.url);
  const isApi = url.pathname.startsWith("/api/");
  // Do not cache sensitive resources offline.
  const sensitive = /medical|document|payment/i.test(url.pathname);

  if (isApi && !sensitive) {
    // Network-first, fall back to last-known cache.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(DATA_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Static shell: cache-first.
  event.respondWith(caches.match(request).then((c) => c || fetch(request)));
});

// ponytail: Web Push handler omitted (needs VAPID keys + a push service).
// Upgrade path -> self.addEventListener('push', ...) wired to the reminders
// engine (PRD §5.13). iOS requires the PWA be installed to Home Screen.
