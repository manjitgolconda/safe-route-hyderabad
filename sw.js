/* ============================================================
   SafeRoute Hyderabad — Service Worker
   ============================================================
   Strategy:
     - CACHE FIRST for static assets (CSS, JS, JSON, fonts, icons)
     - NETWORK FIRST for API calls (OSRM, tile server)
     - Offline fallback for map tiles (cached on first load)
   ============================================================ */

const CACHE_NAME = 'saferoute-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/ai-engine.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/data/crime-zones.json',
    '/data/crime-data.json',
    '/data/crime-trends.json',
    '/data/poorly-lit-areas.json',
    '/data/police-stations.json',
    '/data/severity-engine.json',
    '/data/high-severity-incidents.json',
    '/data/law-enforcement.json',
];

// External resources to cache on first use
const CACHEABLE_ORIGINS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'unpkg.com',
];

// ── Install: Pre-cache static assets ─────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// ── Activate: Clean up old caches ────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: Cache strategy router ─────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Map tiles — Cache first, network fallback (cache on first load)
    if (url.hostname.includes('basemaps.cartocdn.com')) {
        event.respondWith(cacheFirst(event.request, true));
        return;
    }

    // OSRM API — Network first (routing must be fresh)
    if (url.hostname.includes('router.project-osrm.org')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // External cacheable resources (fonts, CDN libraries)
    if (CACHEABLE_ORIGINS.some((origin) => url.hostname.includes(origin))) {
        event.respondWith(cacheFirst(event.request, true));
        return;
    }

    // Static assets — Cache first
    event.respondWith(cacheFirst(event.request, false));
});

// ── Cache-First Strategy ─────────────────────────────────────
async function cacheFirst(request, cacheOnFetch) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (cacheOnFetch && response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        // Return offline fallback for tiles
        return new Response('', { status: 408, statusText: 'Offline' });
    }
}

// ── Network-First Strategy ───────────────────────────────────
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
            JSON.stringify({ error: 'Offline — no cached route available.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
