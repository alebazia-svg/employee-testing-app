self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('portal-offline-v6').then((cache) => cache.addAll([
      '/offline.html',
      '/portal-app-icon-192.png',
    ])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => (key.startsWith('offonika-offline-') || key.startsWith('portal-offline-')) && key !== 'portal-offline-v6')
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
  if (Number.isFinite(Number(data.badgeCount))) {
    const badgeCount = Math.max(0, Math.floor(Number(data.badgeCount)));
    if (badgeCount > 0 && 'setAppBadge' in self.navigator) {
      actions.push(self.navigator.setAppBadge(badgeCount));
    } else if (badgeCount === 0 && 'clearAppBadge' in self.navigator) {
      actions.push(self.navigator.clearAppBadge());
    } else if (badgeCount === 0 && 'setAppBadge' in self.navigator) {
      actions.push(self.navigator.setAppBadge(0));
    }
  }
  actions.push(self.registration.showNotification(data.title || 'MOBO', {
    body: data.body || 'Откройте портал, чтобы продолжить рабочий день.',
    icon: '/portal-app-icon-192.png',
    badge: '/portal-app-icon-192.png',
    data: { url: data.url || '/employee', notificationId: data.notificationId || null },
    tag: data.notificationId ? `${data.tagPrefix || 'workday'}-${data.notificationId}` : (data.tagPrefix || 'workday'),
    renotify: data.tagPrefix === 'admin' && data.renotify === true,
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

// Clear the old summary after the authenticated ADMIN has no remaining tasks.
// Employee notifications use another tag and are left intact.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'ADMIN_ATTENTION_CLEARED' || !event.source?.url) return;
  const source = new URL(event.source.url);
  if (source.origin !== self.location.origin || !source.pathname.startsWith('/admin')) return;
  event.waitUntil(self.registration.getNotifications().then(notifications => {
    for (const notification of notifications) {
      if (notification.tag.startsWith('admin-attention-')) notification.close();
    }
  }));
});
