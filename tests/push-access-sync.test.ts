import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { savePushSubscription } from '../lib/push-subscription-client';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { createSessionToken } from '../lib/session';

async function load(entry: string, mocks: Record<string, unknown>) {
  const built = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'mock', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined); } }] });
  const mod = { exports: {} as any }; const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', built.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
const browserId = 'f4c9081c-d028-4499-8910-3c7e69e41a40';

test('subscription confirmation immediately updates only the signed current session and exact browser', async () => {
  const writes: any[] = []; let cookie: string | undefined = browserId; let valid = true;
  const { syncSubscribedAccess } = await load('lib/push-access-sync.ts', {
    'server-only': {}, 'next/headers': { cookies: async () => ({ get: (name: string) => ({ value: name === 'mobo_access_browser' ? cookie : 'signed-test-token' }) }) },
    './portal-access-journal': { accessSessionIdentity: (token: string, user: number) => valid && token === 'signed-test-token' && user === 7 ? { sessionHash: 'verified-hash' } : null },
  });
  const tx = { portalAccessSession: { updateMany: async (q: any) => { writes.push(q); return { count: 1 }; } } };
  const sub = { id: 25, userId: 7, disabledAt: null };
  assert.equal(await syncSubscribedAccess(tx, 7, sub), true);
  assert.deepEqual(writes[0].where, { sessionHash: 'verified-hash', userId: 7, browserInstanceId: browserId,
    OR: [{ observedBrowserId: null }, { observedBrowserId: browserId }], loggedOutAt: null, expiresAt: { gt: writes[0].data.lastSeenAt } });
  assert.equal(writes[0].data.pushState, 'connected');
  assert.equal(writes[0].data.pushSubscriptionId, 25);
  assert.equal(writes[0].data.pushCheckedAt, writes[0].data.lastSeenAt);
  assert.doesNotMatch(JSON.stringify(writes), /isService|deviceGroupId|owner|displayMode|lastIp/);
  await syncSubscribedAccess(tx, 7, { ...sub, disabledAt: new Date() });
  assert.equal(writes[1].data.pushState, 'not_connected');
  assert.equal(await syncSubscribedAccess(tx, 7, { ...sub, userId: 8 }), false);
  cookie = undefined; assert.equal(await syncSubscribedAccess(tx, 7, sub), false);
  cookie = browserId; valid = false; assert.equal(await syncSubscribedAccess(tx, 7, sub), false);
  assert.equal(writes.length, 2);
  valid = true;
  assert.equal(await syncSubscribedAccess({ portalAccessSession: { updateMany: async () => ({ count: 0 }) } }, 7, sub), false);
});

for (const audience of ['employee', 'admin']) {
  test(`${audience}: subscription and journal confirmation share a transaction; failures never return success`, async () => {
    let user: any = { id: 7, role: audience === 'admin' ? 'ADMIN' : 'EMPLOYEE' };
    let mode = 'primary-multi'; let fail = false; let stored: any = null; let confirms = 0; let retries = 0;
    const tx = { workdayPushSubscription: { upsert: async (q: any) => ({ id: 25, ...q.create }) },
      workdayNotification: { updateMany: async (q: any) => { retries++; assert.deepEqual(q.where.pushStatus, { in: ['no_subscription', 'retry_pending'] }); } } };
    const route = await load(`app/api/${audience}/push-subscription/route.ts`, {
      '@/lib/auth': { getCurrentUser: async () => user, getCurrentAdmin: async () => user },
      '@/lib/admin-push-subscription-policy': { adminPushRegistrationModeForRequest: () => mode },
      '@/lib/prisma': { prisma: { $transaction: async (fn: any) => { const result = await fn(tx); stored = result; return result; } } },
      '@/lib/push-access-sync': { syncSubscribedAccess: async (client: any, id: number, sub: any) => {
        assert.equal(client, tx); assert.equal(id, 7); assert.equal(sub.userId, 7); confirms++;
        if (fail) throw Error('private-db-error'); return true;
      } },
    });
    const post = (payload: any = { endpoint: 'https://push.invalid/test', keys: { auth: 'test', p256dh: 'test' } }) =>
      route.POST(new Request(`https://team.mobo-opt.ru/api/${audience}/push-subscription`, { method: 'POST', body: JSON.stringify(payload) }));
    let res = await post(); assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, id: 25, active: true, accessSynced: true });
    assert.equal(confirms, 1); assert.equal(retries, audience === 'employee' ? 1 : 0);
    stored = null; fail = true; res = await post(); assert.equal(res.status, 503); assert.equal(stored, null);
    assert.doesNotMatch(await res.text(), /private-db-error/);
    fail = false; assert.equal((await post({})).status, 400);
    if (audience === 'admin') { mode = 'legacy-disabled'; assert.equal((await (await post()).json()).active, false); }
    else { user = { id: 7, role: 'ADMIN' }; assert.equal((await post()).status, 403); }
    user = null; assert.equal((await post()).status, audience === 'admin' ? 403 : 401);
  });
}

test('client accepts only confirmed active persistence; failures remain retryable', async () => {
  const original = globalThis.fetch;
  const sub = { toJSON: () => ({ endpoint: 'https://push.invalid/test' }) } as unknown as PushSubscription;
  try {
    for (const payload of [{ ok: true }, { ok: true, id: 25, active: false }, { ok: true, id: 0, active: true }]) {
      globalThis.fetch = async () => Response.json(payload);
      await assert.rejects(savePushSubscription('/api/employee/push-subscription', sub), /не подтверждено/);
    }
    globalThis.fetch = async () => new Response('not-json');
    await assert.rejects(savePushSubscription('/api/employee/push-subscription', sub), /не подтверждено/);
    globalThis.fetch = async () => { throw new TypeError('network'); };
    await assert.rejects(savePushSubscription('/api/employee/push-subscription', sub), /Проверьте интернет/);
    globalThis.fetch = async (_url, opts) => {
      assert.equal(opts?.method, 'POST'); assert.ok(opts?.signal);
      return Response.json({ ok: true, id: 25, active: true, accessSynced: true });
    };
    assert.equal((await savePushSubscription('/api/employee/push-subscription', sub)).id, 25);
  } finally { globalThis.fetch = original; }
});

const testDb = process.env.PUSH_ACCESS_TEST_DB ?? '';
test('isolated PostgreSQL: atomic confirmation, repeat, stale heartbeat and mismatch protection', {
  skip: !/^postgresql:\/\/postgres:push-sync-local-only@127\.0\.0\.1:\d+\/push_sync_test$/.test(testDb),
}, async () => {
  const db = new PrismaClient({ datasources: { db: { url: testDb } } });
  const marker = `push-sync-${crypto.randomUUID()}`;
  const oldSecret = process.env.PORTAL_SESSION_SECRET;
  process.env.PORTAL_SESSION_SECRET = 'isolated-push-sync-test-secret-at-least-32-characters';
  const user = await db.user.create({ data: { name: marker, login: marker, role: 'EMPLOYEE', passwordHash: 'not-a-login' } });
  try {
    const token = createSessionToken(user.id);
    const oldSeen = new Date(Date.now() - 1000);
    const current = await db.portalAccessSession.create({ data: {
      userId: user.id, sessionHash: createHash('sha256').update(`portal-access-v1:${token}`).digest('hex'),
      browserInstanceId: browserId, observedBrowserId: browserId, device: 'iPhone', browser: 'Safari',
      expiresAt: new Date(Date.now() + 600000), lastSeenAt: oldSeen, pushState: 'not_connected', pushCheckedAt: oldSeen,
    } });
    const other = await db.portalAccessSession.create({ data: {
      userId: user.id, sessionHash: marker, browserInstanceId: crypto.randomUUID(),
      device: 'iPhone', browser: 'Safari', expiresAt: new Date(Date.now() + 600000), pushState: 'not_connected',
    } });
    let failAfterSync = false;
    const wrapper = { $transaction: (fn: any) => db.$transaction(tx => fn(failAfterSync ? new Proxy(tx, {
      get(target, key) { return key === 'workdayNotification' ? { updateMany: async () => { throw Error('test rollback'); } } : Reflect.get(target, key); },
    }) : tx)) };
    const route = await load('app/api/employee/push-subscription/route.ts', {
      'server-only': {}, '@/lib/auth': { getCurrentUser: async () => user },
      '@/lib/prisma': { prisma: wrapper }, './prisma': { prisma: db },
      'next/headers': { cookies: async () => ({ get: (name: string) => ({ value: name === 'mobo_access_browser' ? browserId : token }) }) },
    });
    const post = () => route.POST(new Request('https://portal.invalid/api/employee/push-subscription', {
      method: 'POST', body: JSON.stringify({ endpoint: `https://push.invalid/${marker}`, keys: { auth: 'test', p256dh: 'test' } }),
    }));
    let response = await post(); assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.accessSynced, true);
    const saved = await db.portalAccessSession.findUniqueOrThrow({ where: { id: current.id } });
    assert.equal(saved.pushState, 'connected'); assert.equal(saved.pushSubscriptionId, result.id);
    assert.ok(saved.lastSeenAt > oldSeen);
    assert.equal((await db.portalAccessSession.findUniqueOrThrow({ where: { id: other.id } })).pushState, 'not_connected');
    const stale = await db.portalAccessSession.updateMany({ where: { id: current.id, lastSeenAt: oldSeen }, data: { pushState: 'not_connected' } });
    assert.equal(stale.count, 0, 'older heartbeat cannot overwrite subscription confirmation');
    assert.equal((await (await post()).json()).id, result.id, 'repeat is idempotent');
    assert.equal(await db.workdayPushSubscription.count({ where: { userId: user.id } }), 1);

    await db.workdayPushSubscription.update({ where: { id: result.id }, data: { disabledAt: oldSeen } });
    await db.portalAccessSession.update({ where: { id: current.id }, data: { pushState: 'not_connected' } });
    failAfterSync = true; response = await post(); assert.equal(response.status, 503);
    assert.ok((await db.workdayPushSubscription.findUniqueOrThrow({ where: { id: result.id } })).disabledAt);
    assert.equal((await db.portalAccessSession.findUniqueOrThrow({ where: { id: current.id } })).pushState, 'not_connected');
    failAfterSync = false;
    await db.portalAccessSession.update({ where: { id: current.id }, data: { observedBrowserId: crypto.randomUUID() } });
    assert.equal((await (await post()).json()).accessSynced, false);
    assert.equal((await db.portalAccessSession.findUniqueOrThrow({ where: { id: current.id } })).pushState, 'not_connected');
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
    if (oldSecret === undefined) delete process.env.PORTAL_SESSION_SECRET;
    else process.env.PORTAL_SESSION_SECRET = oldSecret;
  }
});
