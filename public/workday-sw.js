// Receipt reporting is independent of showing, opening and dismissing notifications.
// The endpoint verifies the signed account, owned notification and this session's subscription.
function reportEmployeePush(data, stage) {
  try {
    const id = Number(data?.notificationId);
    const target = new URL(data?.url || '/employee', self.location.origin);
    if (!Number.isSafeInteger(id) || id <= 0 || target.origin !== self.location.origin || !/^\/(employee|procurement)(\/|$)/.test(target.pathname)) return Promise.resolve();
    const body = JSON.stringify({ key: crypto.randomUUID(), kind: 'push_receipt', notificationId: id, stage });
    return (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch('/api/employee/activity', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body, signal: AbortSignal.timeout(4000),
          });
          if ([400, 401, 403].includes(response.status)) return;
          if (response.ok && (await response.json()).recorded === true) return;
        } catch { /* A missing receipt never affects delivery or navigation. */ }
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 250));
      }
    })();
  } catch { return Promise.resolve(); }
}

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
  const display = self.registration.showNotification(data.title || 'MOBO', {
    body: data.body || 'Откройте портал, чтобы продолжить рабочий день.',
    icon: '/portal-app-icon-192.png',
    badge: '/portal-app-icon-192.png',
    data: { url: data.url || '/employee', notificationId: data.notificationId || null },
    tag: data.notificationId ? `${data.tagPrefix || 'workday'}-${data.notificationId}` : (data.tagPrefix || 'workday'),
    renotify: data.tagPrefix === 'admin' && data.renotify === true,
  });
  actions.push(display);
  const received = reportEmployeePush(data, 'received');
  actions.push(received);
  actions.push(display.then(() => received.then(() => reportEmployeePush(data, 'display_requested')), () => received.then(() => reportEmployeePush(data, 'display_failed'))));
  event.waitUntil(Promise.all(actions));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/employee', self.location.origin).href;
  // A push tap is distinct from a successfully opened in-app message.
  event.waitUntil(reportEmployeePush(event.notification.data, 'clicked'));

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

self.addEventListener('notificationclose', (event) => {
  event.waitUntil(reportEmployeePush(event.notification.data, 'closed'));
});
