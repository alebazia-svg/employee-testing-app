import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('PWA identity is neutral and every declared icon exists', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'));

  assert.equal(manifest.name, 'Портал команды');
  assert.equal(manifest.short_name, 'Портал');
  assert.equal(manifest.theme_color, '#171c24');
  await Promise.all(manifest.icons.map((icon) => access(`public${icon.src}`)));
});

test('offline recovery keeps automatic and manual connection checks', async () => {
  const offline = await readFile('public/offline.html', 'utf8');

  assert.match(offline, /fetch\('\/api\/health\?connection-check=1'/);
  assert.match(offline, /window\.addEventListener\('online', checkConnection\)/);
  assert.match(offline, /window\.setInterval\(checkConnection, 10000\)/);
  assert.match(offline, /retry\.addEventListener\('click', checkConnection\)/);
  assert.match(offline, /window\.location\.replace\('\/employee'\)/);
});

test('service worker keeps push delivery and notification navigation', async () => {
  const worker = await readFile('public/workday-sw.js', 'utf8');

  assert.match(worker, /self\.addEventListener\('push'/);
  assert.match(worker, /showNotification\(data\.title \|\| 'Портал команды'/);
  assert.match(worker, /self\.addEventListener\('notificationclick'/);
  assert.match(worker, /clients\.openWindow\(targetUrl\)/);
});

test('workday posters keep scanner payloads while using neutral files', async () => {
  const qrCodes = await readFile('app/(dashboard)/admin/workday/WorkdayQrCodes.tsx', 'utf8');

  assert.match(qrCodes, /portal-workday-retail-a5\.png/);
  assert.match(qrCodes, /portal-workday-wholesale-a5\.png/);
  assert.match(qrCodes, /value: 'offonika-workday-start:retail'/);
  assert.match(qrCodes, /value: 'offonika-workday-start:wholesale'/);
});

test('login keeps role-based routing after visual redesign', async () => {
  const login = await readFile('app/login/page.tsx', 'utf8');

  assert.match(login, /data\.role === 'ADMIN' \? '\/admin'/);
  assert.match(login, /data\.portalArea === 'PROCUREMENT' \? '\/procurement' : '\/employee'/);
});
