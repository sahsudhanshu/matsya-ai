// MatsyaAI Service Worker - Basic offline caching for static assets
const CACHE_NAME = 'matsyaai-v2';
const STATIC_URLS = [
    '/',
    '/manifest.json',
];

// Install: cache shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: network-first with fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API calls – let them go to network (the app handles offline queuing)
    if (event.request.url.includes('/api/')) return;

    // Skip Next.js internal assets – these change on every build/HMR cycle and
    // must never be served from a stale cache.
    if (event.request.url.includes('/_next/')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone and cache successful responses
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Background sync stub - will fire when connectivity returns
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-images') {
        // The actual sync logic is handled by the offline-queue module in the app
        // This event just triggers the flush via a postMessage to clients
        event.waitUntil(
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => client.postMessage({ type: 'SYNC_IMAGES' }));
            })
        );
    }
});
