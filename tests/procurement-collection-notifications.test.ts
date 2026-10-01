import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const at = new Date('2026-10-01T18:00:00Z');
async function load(entry: string, mocks: Record<string, any>) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'mocks', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined); } }] });
  const mod = { exports: {} as any };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
async function setup(scenario = 'ready') {
  const rows = new Map<string, any>();
  const collection = { requestRef: 'request', amount: 68000, cashbox: 'Касса менеджера', date: '2026-10-02', cashboxRef: 'cashbox' };
  const evidence = Object.assign(new Map([['p', { collection: scenario === 'paid' ? undefined : collection }]]), { versions: new Map([['p', at.toISOString()]]) });
  const api = await load('lib/procurement-collection-notifications.ts', {
    './procurement-notification-evidence': { procurementNotificationEvidence: async () => scenario === 'offline' ? null : evidence },
    './prisma': { prisma: {
      supplierPaymentPlan: { findMany: async () => scenario === 'cancelled' ? [] : [{ id: 'p', updatedAt: scenario === 'edited' ? new Date() : at,
        managerUserId: 42, manager: { isActive: scenario !== 'disabled' }, supplierPartner: 'Supplier' }] },
      workdayNotification: { createMany: async ({ data, skipDuplicates }: any) => { assert.equal(skipDuplicates, true); for (const row of data) if (!rows.has(row.fingerprint)) rows.set(row.fingerprint, row); } },
    } },
  });
  return { api, rows };
}
test('GET is read-only, timer is idempotent, future date is explicit, recipient must match', async () => {
  const { api, rows } = await setup();
  assert.equal((await api.currentCollectionPushes(at)).notices.length, 1); assert.equal(rows.size, 0);
  await Promise.all([api.queueCollectionReadyPush(at), api.queueCollectionReadyPush(at)]);
  assert.equal(rows.size, 1);
  const notification = [...rows.values()][0];
  assert.match((await api.collectionPushDecision(notification, at)).title, /^Получить 2 октября/);
  assert.match((await api.collectionPushDecision(notification, new Date('2026-10-02T06:00:00Z'))).title, /^Можно получить/);
  assert.equal((await api.collectionPushDecision({ ...notification, userId: 99 }, at)).state, 'cancel');
  assert.equal((await api.collectionPushDecision({ ...notification, fingerprint: 'other-request' }, at)).state, 'cancel');
});
test('22:00–08:30 Moscow postpones; no nighttime dispatch authorization', async () => {
  const { api, rows } = await setup();
  const night = new Date('2026-10-01T19:00:00Z');
  await api.queueCollectionReadyPush(night);
  const notification = [...rows.values()][0];
  assert.equal(notification.scheduledAt.toISOString(), '2026-10-02T05:30:00.000Z');
  assert.equal((await api.collectionPushDecision(notification, night)).state, 'defer');
});
test('paid, cancelled and disabled retire; source failure or concurrent edit defers', async () => {
  for (const scenario of ['paid', 'cancelled', 'disabled', 'offline', 'edited']) {
    const { api, rows } = await setup(scenario);
    await api.queueCollectionReadyPush(at); assert.equal(rows.size, 0);
    const notice = { userId: 42, fingerprint: api.collectionPushKey('request', 'p', 42) };
    assert.equal((await api.collectionPushDecision(notice, at)).state, ['offline', 'edited'].includes(scenario) ? 'defer' : 'cancel', scenario);
  }
});
test('closed collection leaves the bell; outage does not pretend it was completed', async () => {
  for (const state of ['unknown', 'ready']) {
    const api = await load('lib/procurement-notification-lifecycle.ts', {
      './procurement-collection-notifications': { COLLECTION_READY_KIND: 'procurement_collection_ready', currentCollectionPushes: async () => ({ state, notices: [] }) },
    });
    const inactive = await api.inactiveProcurementNotifications({}, [{ id: 1, kind: 'procurement_collection_ready', fingerprint: 'old' }]);
    assert.equal(inactive.size, state === 'ready' ? 1 : 0);
  }
});

test('real dispatcher claims one send, routes to calendar and never pushes a stale cash instruction', async t => {
  const saved = { ...process.env }; t.after(() => { process.env = saved; });
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'test'; process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'test';
  for (const decision of ['send', 'defer', 'cancel']) {
    let claimed = false; const sent: any[] = [];
    const row = { id: 1, userId: 42, kind: 'procurement_collection_ready', fingerprint: 'current',
      taskId: null, issueId: null, reviewId: null, task: null, issue: null, review: null,
      updatedAt: at, status: 'pending', pushStatus: 'pending', attemptCount: 0, sentAt: null,
      user: { pushSubscriptions: [{ id: 1, endpoint: 'https://push.invalid', p256dh: 'test', auth: 'test' }] } };
    const api = await load('lib/workday-notifications.ts', {
      '@/lib/prisma': { prisma: { workdayNotification: {
        findMany: async (a: any) => a.include ? [row] : [], update: async () => {},
        updateMany: async (a: any) => {
          if (a.data.pushStatus === 'delivery_sending') { if (claimed) return { count: 0 }; claimed = true; }
          return { count: 1 };
        },
      } } },
      '@/lib/terminal-fiscal-admin-gate': { TERMINAL_FISCAL_ADMIN_FIRST: false },
      '@/lib/procurement-notification-lifecycle': { inactiveProcurementNotifications: async () => new Set() },
      '@/lib/procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', queueDeliveryReadyPush: async () => {} },
      '@/lib/procurement-collection-notifications': { COLLECTION_READY_KIND: 'procurement_collection_ready',
        COLLECTION_PUSH_COPY: { title: 'Деньги для оплаты', body: 'Проверьте сумму, дату и кассу в платёжном календаре.' },
        queueCollectionReadyPush: async () => {}, collectionPushDecision: async () => ({ state: decision, until: at, title: 'Можно получить 68 000 ₽', body: 'Касса' }) },
      'web-push': { setVapidDetails: () => {}, sendNotification: async (_s: any, payload: string) => sent.push(JSON.parse(payload)) },
    });
    await Promise.all([api.dispatchDueWorkdayNotifications(at), api.dispatchDueWorkdayNotifications(at)]);
    assert.equal(sent.length, decision === 'send' ? 1 : 0);
    if (sent.length) { assert.equal(sent[0].url, '/procurement'); assert.equal(sent[0].title, 'Деньги для оплаты'); assert.doesNotMatch(sent[0].body, /68|Можно получить/); }
  }
});

test('bell is personal, shows current cashbox and amount, uses neutral text on outage', async () => {
  for (const state of ['ready', 'unknown', 'anonymous']) {
    let reads = 0;
    const api = await load('app/api/employee/workday-notifications/route.ts', {
      '@/lib/auth': { getCurrentUser: async () => state === 'anonymous' ? null : { id: 42 } },
      '@/lib/prisma': { prisma: { workdayNotification: { findMany: async (a: any) => {
        reads++; assert.equal(a.where.userId, 42); return [{ id: 1, kind: 'procurement_collection_ready', fingerprint: 'key', title: 'stale', body: 'stale' }];
      } } } },
      '@/lib/workday-notifications': { reconcileActiveWorkdayNotifications: async (_d: any, rows: any) => rows, workdayNotificationHref: () => '/procurement' },
      '@/lib/procurement-collection-notifications': { COLLECTION_READY_KIND: 'procurement_collection_ready',
        COLLECTION_PUSH_COPY: { title: 'Деньги для оплаты', body: 'Проверьте сумму, дату и кассу в платёжном календаре.' },
        currentCollectionPushes: async () => ({ state, notices: [{ userId: 42, fingerprint: 'key', title: 'Можно получить 58 000 ₽', body: 'Касса менеджера · Supplier' }] }) },
    });
    const response = await api.GET();
    if (state === 'anonymous') { assert.equal(response.status, 401); assert.equal(reads, 0); continue; }
    const result = await response.json();
    assert.equal(result.notifications[0].title, state === 'ready' ? 'Можно получить 58 000 ₽' : 'Деньги для оплаты');
    assert.equal(result.notifications[0].href, '/procurement');
    assert.doesNotMatch(JSON.stringify(result), /stale/);
  }
});
