const CACHE_NAME = 'giusto-static-v2'
const STATIC_ASSETS = ['/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png']
const CACHEABLE_DESTINATIONS = new Set(['script', 'style', 'font', 'image', 'audio'])

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.headers.has('authorization')) return
  if (url.pathname.startsWith('/api/')) return

  // Navigations and data requests always go to the network. In particular,
  // never cache index.html: it contains hashed module URLs that change on each
  // build and a stale copy leaves the app unable to start.
  if (!CACHEABLE_DESTINATIONS.has(request.destination)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (!response.ok || response.type !== 'basic') return response

        const copy = response.clone()
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)))
        return response
      })
    }),
  )
})
