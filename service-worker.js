/* =====================================================
   WETTER EUROPA — Service Worker
   Strategie: Static Assets cached, API-Calls live
   ===================================================== */

const CACHE = 'wetter-europa-v18';

const STATIC = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './apple-touch-icon.png',
    './favicon-32.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Installation: statische Dateien cachen
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC))
    );
    self.skipWaiting();
});

// Aktivierung: alte Caches löschen
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: API-Calls immer live, statisches aus Cache
self.addEventListener('fetch', e => {
    const url = e.request.url;

    // API-Requests: Network-first (immer aktuelle Daten)
    const isApi = url.includes('open-meteo.com') ||
                  url.includes('brightsky.dev') ||
                  url.includes('nominatim.openstreetmap.org') ||
                  url.includes('tile.openstreetmap.org');

    if (isApi) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
        return;
    }

    // Statische Dateien: Cache-first
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
