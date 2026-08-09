self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(self.registration.showNotification(data.title || 'OFFONIKA', {
    body: data.body || 'Откройте портал, чтобы продолжить рабочий день.',
    icon: '/pwa-icon-192.png',
    badge: '/favicon-32x32.png',
    data: { url: data.url || '/employee', notificationId: data.notificationId || null },
    tag: data.notificationId ? `workday-${data.notificationId}` : 'workday',
    renotify: false,
  }));
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
