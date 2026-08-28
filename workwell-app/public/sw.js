/**
 * Offline fallback, and nothing else.
 *
 * This worker caches exactly one file: /offline.html. It never caches an
 * app page, a script or a stylesheet, which is deliberate — a worker that
 * caches the app shell is a worker that can serve a stale build for days
 * after a deploy, and that failure is far worse than the dinosaur it was
 * meant to replace. The only thing intercepted is a navigation that could
 * not reach the network at all.
 *
 * Bump CACHE when offline.html changes; the old one is deleted on activate.
 */
const CACHE = 'workwell-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // `reload` so installing never picks the page up from the HTTP cache,
      // which is how a worker ends up serving a fallback older than itself.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }))
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  // Only whole-page navigations. Anything else — an API call, a chunk, an
  // image — is left entirely alone, so the app's own error handling stays
  // the thing that decides what a failed request means.
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    (async () => {
      try {
        return await fetch(event.request)
      } catch {
        // The only branch that serves from cache: the network was
        // unreachable, so there is no fresher answer to prefer.
        const cache = await caches.open(CACHE)
        const cached = await cache.match(OFFLINE_URL)
        return (
          cached ??
          new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        )
      }
    })()
  )
})
