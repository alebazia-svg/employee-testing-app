import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { cashMorningAt, cashMorningNotBefore, cashMorningKey, cashNoticeBase } from '../lib/procurement-morning-policy';
import { workdayNotificationThreadKey, workdayNotificationThreadWhere } from '../lib/workday-notification-thread';
const require = createRequire(import.meta.url);
const kind = 'procurement_collection_ready';
const base = 'procurement-collection:request:plan:42';
const night = new Date('2026-10-01T17:37:02.203Z');
const morning = new Date('2026-10-02T06:00:00Z');
async function load(entry: string, mocks: Record<string, any>) {
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'mocks', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined); } }] });
  const mod = { exports: {} as any };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)((n: string) => mocks[n] ?? require(n), mod, mod.exports);
  return mod.exports;
}
test('18:00 boundary, Moscow calendar and 09:00 repeat, not a daily reminder', () => {
  assert.equal(cashMorningAt(new Date('2026-10-01T14:59:59.999Z')), null);
  assert.equal(cashMorningAt(new Date('2026-10-01T15:00:00Z'))?.toISOString(), morning.toISOString());
  assert.equal(cashMorningAt(night)?.toISOString(), morning.toISOString());
  assert.equal(cashMorningAt(new Date('2026-12-31T18:00:00Z'))?.toISOString(), '2027-01-01T06:00:00.000Z');
  assert.equal(cashMorningAt(new Date('invalid')), null);
  for (const t of ['2026-10-01T19:00:00Z', '2026-10-02T05:30:00Z', '2026-10-02T05:59:59Z']) {
    assert.equal(cashMorningNotBefore(new Date(t)).toISOString(), morning.toISOString());
  }
  assert.equal(cashMorningNotBefore(morning), morning);
  assert.equal(cashMorningNotBefore(new Date('2026-10-02T15:00:00Z')).toISOString(), '2026-10-03T06:00:00.000Z');
});
test('one personal morning job survives restart, including an already-read evening message', async () => {
  for (const scenario of ['active', 'paid', 'offline', 'daytime', 'delivery', 'disabled']) {
    const rows = new Map<string, any>();
    const isDelivery = scenario === 'delivery';
    const fingerprint = isDelivery ? 'procurement-delivery-ready:request:42' : base;
    const noticeKind = isDelivery ? 'procurement_delivery_ready' : kind;
    const api = await load('lib/procurement-morning-notifications.ts', {
      './procurement-delivery-reminders': { deliveryMappedUser: async () => { if (scenario === 'disabled') throw Error('no mapping'); return { id: 42 }; } },
      './prisma': { prisma: { workdayNotification: {
        findMany: async ({ where }: any) => {
          assert.equal(where.userId, 42); assert.equal(where.pushStatus, 'delivered'); assert.equal(where.readAt, undefined);
          assert.equal(where.pushDeliveredAt.gte.toISOString(), new Date(night.getTime() - 86400000).toISOString());
          return [{ userId: 42, kind: noticeKind, fingerprint, pushDeliveredAt: scenario === 'daytime' ? new Date('2026-10-01T10:00:00Z') : night, readAt: night },
            { userId: 42, kind: noticeKind, fingerprint: cashMorningKey(fingerprint), pushDeliveredAt: night }];
        },
        createMany: async ({ data, skipDuplicates }: any) => { assert.equal(skipDuplicates, true); for (const n of data) if (!rows.has(n.fingerprint)) rows.set(n.fingerprint, n); },
      } } },
      './procurement-collection-notifications': { COLLECTION_READY_KIND: kind, COLLECTION_PUSH_COPY: { title: 'Деньги для оплаты', body: 'Календарь' },
        currentCollectionPushes: async () => ({ state: scenario === 'offline' ? 'unknown' : 'ready', notices: scenario === 'paid' ? [] : [{ fingerprint, userId: 42 }] }) },
      './procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', currentDeliveryPush: async () => ({ state: 'ready', userId: 42, fingerprint }) },
    });
    if (scenario === 'disabled') { await assert.rejects(api.queueCashMorningPushes(night)); assert.equal(rows.size, 0); continue; }
    await Promise.all([api.queueCashMorningPushes(night), api.queueCashMorningPushes(night)]);
    await api.queueCashMorningPushes(night);
    assert.equal(rows.size, ['active', 'delivery'].includes(scenario) ? 1 : 0, scenario);
    if (rows.size) { const row = [...rows.values()][0]; assert.equal(row.fingerprint, cashMorningKey(fingerprint)); assert.equal(row.scheduledAt.toISOString(), morning.toISOString()); }
  }
});
test('evening and morning stay one bell thread; reading cannot consume a future reminder', () => {
  const original = { id: 1, kind, fingerprint: base };
  const reminder = { id: 2, kind, fingerprint: cashMorningKey(base) };
  assert.equal(workdayNotificationThreadKey(original), workdayNotificationThreadKey(reminder));
  assert.deepEqual(workdayNotificationThreadWhere(reminder), { kind, fingerprint: { in: [base, cashMorningKey(base)] }, status: 'sent' });
  assert.equal(cashNoticeBase({ ...reminder, kind: 'planned' }), null);
});
test('morning rechecks current remaining amount; payment/cancellation retire, outage defers', async () => {
  for (const scenario of ['partial', 'paid', 'cancelled', 'offline']) {
    const date = new Date('2026-10-01T10:00:00Z');
    const map = Object.assign(new Map([['plan', { collection: scenario === 'paid' ? undefined : {
      requestRef: 'request', amount: 10000, date: '2026-10-02', cashbox: 'Касса', cashboxRef: 'cash',
    } }]]), { versions: new Map([['plan', date.toISOString()]]) });
    const api = await load('lib/procurement-collection-notifications.ts', {
      './procurement-notification-evidence': { procurementNotificationEvidence: async () => scenario === 'offline' ? null : map },
      './prisma': { prisma: { supplierPaymentPlan: { findMany: async () => scenario === 'cancelled' ? [] : [{ id: 'plan', updatedAt: date, managerUserId: 42, manager: { isActive: true }, supplierPartner: 'Supplier' }] } } },
    });
    const row = { fingerprint: cashMorningKey(base), userId: 42 };
    const decision = await api.collectionPushDecision(row, morning);
    assert.equal(decision.state, scenario === 'partial' ? 'send' : scenario === 'offline' ? 'defer' : 'cancel', scenario);
    if (scenario === 'partial') {
      assert.match(decision.title, /10\s000/);
      assert.equal((await api.collectionPushDecision(row, new Date('2026-10-02T05:30:00Z'))).state, 'defer');
      assert.equal((await api.collectionPushDecision({ ...row, userId: 99 }, morning)).state, 'cancel');
    }
  }
});
test('dispatcher sends morning once even if evening is unread; badge remains one', async t => {
  const saved = { ...process.env }; t.after(() => { process.env = saved; });
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'test'; process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'test';
  let claimed = false; const sent: any[] = [];
  const row = { id: 2, userId: 42, kind, fingerprint: cashMorningKey(base), taskId: null, issueId: null, reviewId: null,
    task: null, issue: null, review: null, updatedAt: morning, status: 'pending', pushStatus: 'pending', attemptCount: 0, sentAt: null,
    user: { pushSubscriptions: [{ id: 1, endpoint: 'https://push.invalid', p256dh: 'test', auth: 'test' }] } };
  const original = { ...row, id: 1, fingerprint: base, status: 'sent', pushStatus: 'delivered' };
  const api = await load('lib/workday-notifications.ts', {
    '@/lib/prisma': { prisma: { workdayNotification: { findMany: async (a: any) => a.include ? [row] : [original],
      updateMany: async (a: any) => { if (a.data.pushStatus === 'delivery_sending') { if (claimed) return { count: 0 }; claimed = true; } return { count: 1 }; } } } },
    '@/lib/terminal-fiscal-admin-gate': { TERMINAL_FISCAL_ADMIN_FIRST: false },
    '@/lib/procurement-notification-lifecycle': { inactiveProcurementNotifications: async () => new Set() },
    '@/lib/procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', queueDeliveryReadyPush: async () => {} },
    '@/lib/procurement-collection-notifications': { COLLECTION_READY_KIND: kind, COLLECTION_PUSH_COPY: { title: 'Деньги для оплаты', body: 'Календарь' }, queueCollectionReadyPush: async () => {}, collectionPushDecision: async () => ({ state: 'send' }) },
    '@/lib/procurement-morning-notifications': { queueCashMorningPushes: async () => {} },
    'web-push': { setVapidDetails: () => {}, sendNotification: async (_: any, payload: string) => sent.push(JSON.parse(payload)) },
  });
  await Promise.all([api.dispatchDueWorkdayNotifications(morning), api.dispatchDueWorkdayNotifications(morning)]);
  assert.equal(sent.length, 1); assert.equal(sent[0].badgeCount, 1); assert.equal(sent[0].url, '/procurement');
});

test('real bell returns one fresh card and reading it updates only the user’s sent thread', async () => {
  const reminder = { id: 2, userId: 42, kind, fingerprint: cashMorningKey(base), title: 'stale', body: 'stale' };
  let readWhere: any;
  const api = await load('app/api/employee/workday-notifications/route.ts', {
    '@/lib/auth': { getCurrentUser: async () => ({ id: 42 }) },
    '@/lib/prisma': { prisma: { workdayNotification: {
      findMany: async ({ where }: any) => { assert.equal(where.userId, 42); return [reminder, { ...reminder, id: 1, fingerprint: base }]; },
      findFirst: async ({ where }: any) => { assert.equal(where.userId, 42); return reminder; },
      updateMany: async ({ where }: any) => { readWhere = where; },
    } } },
    '@/lib/workday-notifications': { reconcileActiveWorkdayNotifications: async (_: any, rows: any) => rows, workdayNotificationHref: () => '/procurement' },
    '@/lib/procurement-collection-notifications': { COLLECTION_READY_KIND: kind, currentCollectionPushes: async () => ({ state: 'ready', notices: [{ userId: 42, fingerprint: base, title: 'Можно получить 10 000 ₽', body: 'Касса' }] }) },
  });
  const result = await (await api.GET()).json();
  assert.equal(result.notifications.length, 1); assert.equal(result.notifications[0].id, 2);
  assert.equal(result.notifications[0].title, 'Можно получить 10 000 ₽');
  assert.equal((await api.POST(new Request('http://local', { method: 'POST', body: JSON.stringify({ id: 2 }) }))).status, 200);
  assert.deepEqual(readWhere, { userId: 42, kind, fingerprint: { in: [base, cashMorningKey(base)] }, status: 'sent' });
});
test('both cash invitation kinds retire morning and original together, not during outage', async () => {
  for (const k of [kind, 'procurement_delivery_ready']) for (const state of ['active', 'paid', 'offline']) {
    const key = k === kind ? base : 'procurement-delivery-ready:request:42';
    const api = await load('lib/procurement-notification-lifecycle.ts', {
      './procurement-collection-notifications': { COLLECTION_READY_KIND: kind, currentCollectionPushes: async () => ({ state: state === 'offline' ? 'unknown' : 'ready', notices: state === 'paid' ? [] : [{ fingerprint: key }] }) },
      './procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', currentDeliveryPush: async () => ({ state: state === 'offline' ? 'unknown' : state === 'paid' ? 'inactive' : 'ready', fingerprint: key }) },
    });
    const inactive = await api.inactiveProcurementNotifications({}, [{ id: 1, kind: k, fingerprint: key }, { id: 2, kind: k, fingerprint: cashMorningKey(key) }]);
    assert.deepEqual([...inactive], state === 'paid' ? [1, 2] : [], `${k}: ${state}`);
  }
});
test('delivery reminder checks current amount and 09:00 boundary independently', async () => {
  const ref = 'request'; const key = 'procurement-delivery-ready:request:42';
  for (const state of ['payable', 'issued', 'offline']) {
    const api = await load('lib/procurement-delivery-notifications.ts', {
      './procurement-delivery-reminders': { deliveryMappedUser: async () => ({ id: 42 }), loadDeliveryView: async () => ({
        requestStateAvailable: state !== 'offline', nativeRequest: { state: 'linked', status: { ref, state, remaining: state === 'issued' ? 0 : 15000, cashbox: 'Касса', checkedAt: morning.toISOString() } },
      }) },
    });
    const row = { kind: 'procurement_delivery_ready', userId: 42, fingerprint: cashMorningKey(key) };
    const decision = await api.deliveryPushDecision(row, morning);
    assert.equal(decision.state, state === 'payable' ? 'send' : state === 'issued' ? 'cancel' : 'defer');
    if (state === 'payable') assert.match(decision.title, /15\s000/);
  }
});
