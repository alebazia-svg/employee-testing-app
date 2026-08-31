self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('offonika-offline-v1').then((cache) => cache.addAll([
      '/offline.html',
      '/offonika-wordmark-header.png',
      '/pwa-icon-192.png',
    ])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('offonika-offline-') && key !== 'offonika-offline-v1')
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith((async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      return await fetch(event.request, { signal: controller.signal });
    } catch {
      return (await caches.match('/offline.html')) || Response.error();
    } finally {
      clearTimeout(timeout);
    }
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const actions = [];
  if ('setAppBadge' in self.navigator && Number.isFinite(Number(data.badgeCount))) {
    actions.push(self.navigator.setAppBadge(Math.max(0, Number(data.badgeCount))));
  }
  actions.push(self.registration.showNotification(data.title || 'OFFONIKA', {
    body: data.body || 'Откройте портал, чтобы продолжить рабочий день.',
    icon: '/pwa-icon-192.png',
    badge: '/favicon-32x32.png',
    data: { url: data.url || '/employee', notificationId: data.notificationId || null },
    tag: data.notificationId ? `${data.tagPrefix || 'workday'}-${data.notificationId}` : (data.tagPrefix || 'workday'),
    renotify: false,
  }));
  event.waitUntil(Promise.all(actions));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/employee', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) {
        client.navigate(targetUrl);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  }));
});
