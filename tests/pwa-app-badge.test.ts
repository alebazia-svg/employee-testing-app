import assert from 'node:assert/strict';
import test from 'node:test';
import { syncPwaAppBadge } from '../lib/pwa-app-badge';

test('PWA badge shows the normalized unread count', async () => {
  const calls: number[] = [];
  await syncPwaAppBadge(7.8, { setAppBadge: async (count = 0) => { calls.push(count); } });
  assert.deepEqual(calls, [7]);
});

test('PWA badge clears when there are no unread notifications', async () => {
  let cleared = false;
  await syncPwaAppBadge(0, { clearAppBadge: async () => { cleared = true; } });
  assert.equal(cleared, true);
});

test('unsupported or rejected badge operations do not break the portal', async () => {
  await assert.doesNotReject(syncPwaAppBadge(2, {}));
  await assert.doesNotReject(syncPwaAppBadge(2, { setAppBadge: async () => { throw new Error('unsupported'); } }));
});
