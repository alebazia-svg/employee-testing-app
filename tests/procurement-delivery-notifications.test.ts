import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ref = 'ed241171-bb79-11f1-8f11-002590803daf';
const morning = new Date('2026-09-29T05:30:00Z');
async function moduleWithMocks(entry: string, mocks: Record<string, unknown>) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'mocks', setup(b) {
    b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined);
  } }] });
  const mod = { exports: {} as any };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
function view(now: Date, patch: Record<string, unknown> = {}) {
  return { requestStateAvailable: true, nativeRequest: { state: 'linked', status: {
    ref, state: 'payable', remaining: 15000, cashbox: 'Касса Чеченова', checkedAt: now.toISOString(), ...patch,
  } } };
}
async function producer(data: any) {
  const records = new Map(); let writes = 0;
  const api = await moduleWithMocks('lib/procurement-delivery-notifications.ts', {
    './prisma': { prisma: { workdayNotification: { createMany: async (args: any) => {
      writes++; for (const row of args.data) if (!records.has(row.fingerprint)) records.set(row.fingerprint, row);
      assert.equal(args.skipDuplicates, true);
    } } } },
    './procurement-delivery-reminders': { deliveryMappedUser: async () => ({ id: 42 }), loadDeliveryView: async () => data },
  });
  return { api, records, writes: () => writes };
}
test('one-time Moscow 08:30 gate only defers the approved current document', async () => {
  const { api } = await producer(view(morning));
  const night = new Date('2026-09-28T22:00:00Z');
  assert.equal(api.deliveryPushNotBefore(ref, night).toISOString(), morning.toISOString());
  assert.equal(api.deliveryPushNotBefore('other-document', night), night);
  assert.equal(api.deliveryPushNotBefore(ref, morning), morning);
  const later = new Date('2026-09-29T06:00:00Z');
  assert.equal(api.deliveryPushNotBefore(ref, later), later);
});
test('reading a delivery state never queues; the producer queues only once with a stable fingerprint', async () => {
  const night = new Date('2026-09-28T22:00:00Z');
  const { api, records, writes } = await producer(view(night));
  const current = await api.currentDeliveryPush(night);
  assert.equal(current.state, 'ready'); assert.equal(writes(), 0);
  await Promise.all([api.queueDeliveryReadyPush(night), api.queueDeliveryReadyPush(night)]);
  assert.equal(records.size, 1);
  const record = [...records.values()][0];
  assert.equal(record.userId, 42); assert.equal(record.scheduledAt.toISOString(), morning.toISOString());
  assert.equal(record.nextPushAttemptAt.toISOString(), morning.toISOString());
  assert.equal(record.title, 'Пополнение подотчёта');
  assert.equal((await api.deliveryPushDecision({ ...record }, night)).state, 'defer');
});
test('fresh permission supplies current sum and cashbox; wrong recipient/document never sends', async () => {
  const { api } = await producer(view(morning, { state: 'partial', remaining: 10000, canCollect: true }));
  const notification = { userId: 42, kind: api.DELIVERY_READY_KIND, fingerprint: api.deliveryPushKey(ref, 42) };
  const result = await api.deliveryPushDecision(notification, morning);
  assert.equal(result.state, 'send'); assert.match(result.title, /10\s000/); assert.equal(result.body, 'Касса Чеченова');
  assert.equal((await api.deliveryPushDecision({ ...notification, userId: 1 }, morning)).state, 'cancel');
  assert.equal((await api.deliveryPushDecision({ ...notification, fingerprint: 'another' }, morning)).state, 'cancel');
});
test('fully issued, unapproved, rejected, no cashbox or unconfirmed partial never invites collection', async () => {
  for (const patch of [{ state: 'issued', remaining: 0 }, { state: 'waiting' }, { state: 'approved' }, { state: 'rejected' }, { cashbox: null }, { state: 'partial', canCollect: false }]) {
    const { api, records } = await producer(view(morning, patch));
    assert.equal((await api.currentDeliveryPush(morning)).state, 'inactive');
    await api.queueDeliveryReadyPush(morning); assert.equal(records.size, 0);
    assert.equal((await api.deliveryPushDecision({ userId: 42, fingerprint: api.deliveryPushKey(ref, 42) }, morning)).state, 'cancel');
  }
});
test('outage, ambiguity, stale source and unavailable portal request defer rather than assert completion', async () => {
  for (const data of [{ requestStateAvailable: false }, { requestStateAvailable: true, nativeRequest: { state: 'unavailable' } },
    { requestStateAvailable: true, nativeRequest: { state: 'unlinked', reviewReason: 'ambiguous' } }, view(morning, { checkedAt: '2026-09-28T00:00:00Z' })]) {
    const { api, records } = await producer(data);
    assert.equal((await api.currentDeliveryPush(morning)).state, 'unknown');
    assert.equal((await api.deliveryPushDecision({ userId: 42, fingerprint: 'test' }, morning)).state, 'defer');
    await api.queueDeliveryReadyPush(morning); assert.equal(records.size, 0);
  }
});

test('closed and fully paid plan alerts retire; partial, uncertain and changed-version alerts stay', async () => {
  const date = new Date();
  const plans = [
    ['closed', 'COMPLETED_WITHOUT_TOPUP'], ['cancelled', 'CANCELLED'], ['paid', 'APPROVED'], ['issued', 'APPROVED'],
    ['partial', 'APPROVED'], ['unknown', 'APPROVED'], ['edited', 'APPROVED'], ['revision-rejected', 'APPROVED'],
  ].map(([id, status]) => ({ id, status, updatedAt: date }));
  const paid = Object.assign(new Map([['paid', { state: 'PAID_BY_ONE_C' }], ['issued', { state: 'ISSUED_BY_ONE_C' }], ['partial', { state: 'PARTIALLY_PAID' }], ['edited', { state: 'PAID_BY_ONE_C' }]]),
    { versions: new Map(plans.map(p => [p.id, p.id === 'edited' ? 'older' : date.toISOString()])) });
  const api = await moduleWithMocks('lib/procurement-notification-lifecycle.ts', {
    './procurement-plan-revision-server': { freshEvidence: async () => paid },
    './procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', currentDeliveryPush: async () => ({ state: 'inactive' }) },
  });
  const rows = [...plans, { id: 'missing' }].map((p, i) => ({ id: i + 1, fingerprint: `procurement-payment:${p.id}:approved:event`, kind: p.id === 'revision-rejected' ? 'procurement_payment_needs_changes' : 'procurement_payment_approved' }));
  const inactive = await api.inactiveProcurementNotifications({ supplierPaymentPlan: { findMany: async () => plans } }, rows);
  assert.deepEqual([...inactive], [1, 2, 3, 4, 9]);
});
test('failed 1C reconciliation does not retire an open payment alert', async () => {
  const api = await moduleWithMocks('lib/procurement-notification-lifecycle.ts', {
    './procurement-plan-revision-server': { freshEvidence: async () => { throw Error('offline'); } },
    './procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready' },
  });
  const rows = [{ id: 1, fingerprint: 'procurement-payment:p:approved:event', kind: 'procurement_payment_approved' }];
  assert.equal((await api.inactiveProcurementNotifications({ supplierPaymentPlan: { findMany: async () => [{ id: 'p', status: 'APPROVED', updatedAt: new Date() }] } }, rows)).size, 0);
});
test('delivered top-up notification retires on confirmed issue but not on source outage', async () => {
  for (const state of ['inactive', 'unknown', 'ready']) {
    const api = await moduleWithMocks('lib/procurement-notification-lifecycle.ts', {
      './procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', currentDeliveryPush: async () => ({ state, fingerprint: 'current' }) },
    });
    const rows = [{ id: 1, kind: 'procurement_delivery_ready', fingerprint: 'current' }];
    assert.equal((await api.inactiveProcurementNotifications({}, rows)).size, state === 'inactive' ? 1 : 0);
  }
});

test('overlapping dispatchers send one push; deferred or cancelled permission never sends', async () => {
  const previous = { public: process.env.WEB_PUSH_VAPID_PUBLIC_KEY, private: process.env.WEB_PUSH_VAPID_PRIVATE_KEY };
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'mock-public'; process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'mock-private';
  try {
    for (const decision of ['send', 'defer', 'cancel']) {
      let claimed = false; const sent: any[] = []; const updates: any[] = [];
      const notification = { id: 1, userId: 42, kind: 'procurement_delivery_ready', fingerprint: 'current',
        taskId: null, issueId: null, reviewId: null, task: null, issue: null, review: null,
        updatedAt: morning, status: 'pending', pushStatus: 'pending', attemptCount: 0, sentAt: null,
        user: { pushSubscriptions: [{ id: 1, endpoint: 'https://push.example.invalid', p256dh: 'test', auth: 'test' }] } };
      const db = { workdayNotification: {
        findMany: async (args: any) => args.include ? [notification] : [],
        update: async (args: any) => { updates.push(args); },
        updateMany: async (args: any) => {
          updates.push(args);
          if (args.data.pushStatus === 'delivery_sending') { if (claimed) return { count: 0 }; claimed = true; }
          return { count: 1 };
        },
      } };
      const api = await moduleWithMocks('lib/workday-notifications.ts', {
        '@/lib/prisma': { prisma: db },
        '@/lib/terminal-fiscal-admin-gate': { TERMINAL_FISCAL_ADMIN_FIRST: false },
        '@/lib/procurement-notification-lifecycle': { inactiveProcurementNotifications: async () => new Set() },
        '@/lib/procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', queueDeliveryReadyPush: async () => {},
          deliveryPushDecision: async () => ({ state: decision, title: 'Можно получить 15 000 ₽', body: 'Касса Чеченова', until: morning }) },
        'web-push': { setVapidDetails: () => {}, sendNotification: async (_subscription: any, payload: string, options: any) => { sent.push({ ...JSON.parse(payload), options }); } },
      });
      await Promise.all([api.dispatchDueWorkdayNotifications(morning), api.dispatchDueWorkdayNotifications(morning)]);
      assert.equal(sent.length, decision === 'send' ? 1 : 0);
      if (decision === 'send') {
        assert.equal(sent[0].title, 'Можно получить 15 000 ₽'); assert.equal(sent[0].body, 'Касса Чеченова');
        assert.equal(sent[0].url, '/procurement#delivery'); assert.equal(sent[0].options.TTL, 300);
        assert.equal(updates.filter(a => a.data.pushStatus === 'delivered').length, 1);
      }
    }
  } finally {
    if (previous.public === undefined) delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY; else process.env.WEB_PUSH_VAPID_PUBLIC_KEY = previous.public;
    if (previous.private === undefined) delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY; else process.env.WEB_PUSH_VAPID_PRIVATE_KEY = previous.private;
  }
});
