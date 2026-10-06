const CACHE_NAME = 'aura-nails-v9';
const ASSETS = [
  './',
  './index.html',
  './public/aura.html',
  './public/disenios.html',
  './public/inicio.html',
  './public/reservar.html',
  './public/gracias.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/css/home.css',
  './assets/js/supabase-config.js',
  './assets/img/aura-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

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

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const notification = event.data.json();
  event.waitUntil(
    self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: './assets/img/aura-icon.png',
      data: { url: notification.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => 'focus' in client);
      if (existingClient) {
        existingClient.navigate(target.href);
        return existingClient.focus();
      }
      return self.clients.openWindow(target.href);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || event.request.headers.has('authorization')) return;

  if (event.request.mode === 'navigate') {
    const navigationUrl = new URL(event.request.url);
    const scopeUrl = new URL(self.registration.scope);
    if (navigationUrl.pathname === scopeUrl.pathname) {
      navigationUrl.searchParams.set('aura-release', CACHE_NAME);
    }

    event.respondWith(
      fetch(navigationUrl, { cache: 'no-store' }).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      }).catch(async () =>
        (await caches.match(event.request, { ignoreSearch: true })) || Response.error()
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      }).catch(() => cached || Response.error());
    })
  );
});
