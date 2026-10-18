import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { portalDisplayMode } from '../lib/portal-display-mode';
import { accessLastPushView, accessModeLabel } from '../lib/portal-access-view';

export async function withMockDb(entry: string, db: unknown) {
  const bundled = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'db', setup(b) {
    b.onResolve({ filter: /^\.\/prisma$/ }, a => ({ path: a.path, external: true }));
  } }] });
  const module = { exports: {} as any }; const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)((name: string) => name === './prisma' ? { prisma: db } : name === 'server-only' ? {} : require(name), module, module.exports);
  return module.exports;
}

test('display mode reports this window, never infers installation from Safari or fullscreen', () => {
  assert.equal(portalDisplayMode(q => q === '(display-mode: browser)'), 'browser');
  for (const mode of ['standalone', 'minimal-ui', 'window-controls-overlay']) assert.equal(portalDisplayMode(q => q === `(display-mode: ${mode})`), 'app');
  assert.equal(portalDisplayMode(() => false, true), 'app');
  assert.equal(portalDisplayMode(q => q === '(display-mode: fullscreen)'), 'unknown');
  assert.equal(portalDisplayMode(() => { throw Error(); }), 'unknown');
  assert.equal(accessModeLabel(null), 'Не определён');
});

test('old activity clients remain valid; context is strictly bounded and contains no caller identity', async () => {
  const { parsePushObservation } = await withMockDb('lib/portal-access-journal.ts', {});
  assert.deepEqual(parsePushObservation({ permission: 'unknown' }), { permission: 'unknown' });
  assert.equal(parsePushObservation({ permission: 'default', displayMode: 'app' }).displayMode, 'app');
  for (const bad of [{ permission: ['granted'] }, { permission: 'granted', displayMode: ['app'] }, { permission: 'granted', displayMode: 'iphone' }, { permission: 'granted', userId: 1 }, { permission: 'granted', deviceId: 'fingerprint' }]) assert.equal(parsePushObservation(bad), null);
});

test('audit never resends or converts provider success/failure into a different outcome', async () => {
  const writes: any[] = []; let auditFails = false;
  const tx = { $executeRaw: async () => 0, workdayPushSubscription: { updateMany: async (q: any) => { writes.push(q); if (auditFails) throw Error('private DB details'); } } };
  const { observePushAttempt } = await withMockDb('lib/push-attempt-observation.ts', { $transaction: async (fn: any, limits: any) => { assert.deepEqual(limits, { maxWait: 250, timeout: 750 }); return fn(tx); } });
  let calls = 0;
  const result = { statusCode: 201 };
  assert.equal(await observePushAttempt({ id: 7, userId: 9 }, async () => { calls++; return result; }), result);
  assert.equal(writes[0].where.userId, 9);
  assert.equal(writes[0].data.lastPushUserId, 9);
  assert.equal(writes[0].data.lastPushOutcome, 'accepted');
  assert.equal(writes[0].where.OR[1].lastPushAttemptAt.lt, writes[0].data.lastPushAttemptAt);
  const error = Object.assign(Error('private endpoint and payload'), { statusCode: 410 });
  await assert.rejects(observePushAttempt({ id: 7, userId: 9 }, async () => { calls++; throw error; }), e => e === error);
  assert.equal(writes[1].data.lastPushErrorCode, 'HTTP_410');
  assert.equal(writes[1].data.lastPushOutcome, 'rejected');
  assert.doesNotMatch(JSON.stringify(writes), /private|endpoint|payload/);
  auditFails = true;
  assert.equal(await observePushAttempt({ id: 7, userId: 9 }, async () => { calls++; return result; }), result);
  await assert.rejects(observePushAttempt({ id: 7, userId: 9 }, async () => { calls++; throw error; }), e => e === error);
  assert.equal(calls, 4);
});

test('labels separate provider acceptance from receipt, sound and old missing evidence', () => {
  assert.match(accessLastPushView(null).explanation, /не означает, что раньше уведомлений не было/);
  const base = { attemptedAt: '2026-10-18T06:00:00Z', resultAt: '2026-10-18T06:00:01Z', outcome: 'accepted', errorCode: null };
  assert.equal(accessLastPushView(base).label, 'Принято сервисом доставки');
  assert.match(accessLastPushView(base).explanation, /не подтверждаются/);
  assert.match(accessLastPushView({ ...base, outcome: 'rejected', errorCode: 'HTTP_410' }).label, /больше не действует/);
  assert.match(accessLastPushView({ ...base, outcome: 'failed' }).label, /Нет подтверждения/);
});
