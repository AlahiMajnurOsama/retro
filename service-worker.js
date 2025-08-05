// Define a name for our cache
const CACHE_NAME = 'retroflix-v1';

// List all the files that make up the "app shell"
// This includes the core HTML, CSS, JS, and essential icons.
const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css'
];

// --- 1. Install the Service Worker & Cache the App Shell ---
self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// --- 2. Intercept Network Requests (Fetch Event) ---
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // Strategy: Network falling back to Cache
    // Try to get the latest version from the network first.
    // If the network request fails (e.g., user is offline),
    // then serve the file from the cache.
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// --- 3. Activate the Service Worker & Clean Up Old Caches ---
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]; // The name of the current cache

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If a cache is found that is not our current one, delete it.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});