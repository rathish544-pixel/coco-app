/* Thulasi service worker.
 *
 * Its one important job: catch Web Push messages from the backend and turn
 * them into a real notification on the phone, even when the app is closed.
 */

const CACHE = 'thulasi-shell-v1'
const SHELL = ['/', '/index.html', '/icon.svg', '/icon-192.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

/* Network-first, falling back to cache when offline. */
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return
  }
  if (request.url.includes('/api/')) {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined)
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/index.html'))),
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Thulasi', body: event.data ? event.data.text() : 'I miss you ❤️' }
  }

  const title = data.title || 'Thulasi'
  const options = {
    body: data.body || 'I miss you ❤️',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || 'thulasi',
    renotify: true,
    requireInteraction: Boolean(data.requireInteraction),
    vibrate: data.type === 'miss-you' ? [200, 100, 200, 100, 200] : [120],
    data: { url: data.url || '/', type: data.type || 'general' },
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
