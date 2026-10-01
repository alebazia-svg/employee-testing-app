import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('today’s request-based payment retires its notification through the real evidence loader', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-30T16:00:00Z') });
  const env = { ...process.env }; t.after(() => { process.env = env; });
  process.env['1C_BASE_URL'] = 'https://one-c.invalid'; process.env['1C_API_USER'] = 'test'; process.env['1C_API_PASSWORD'] = 'test';
  for (const scenario of ['paid', 'partial', 'unposted', 'incomplete', 'offline', 'edited', 'debt-paid', 'debt-partial', 'debt-unposted', 'debt-no-basis']) {
    const supplierDebt = scenario.startsWith('debt-');
    const fullyPaid = scenario === 'paid' || scenario === 'debt-paid';
    const updatedAt = new Date('2026-09-29T10:00:00Z');
    const plan = { id: 'plan', planCode: 'PAY-TEST', status: 'APPROVED', supplierPartner: 'Supplier', supplierCounterparty: '',
      orderRefs: supplierDebt ? [] : ['order'], plannedAmount: scenario.includes('partial') ? 50000 : 47600, foreignAmount: null, paymentMethod: 'CASH',
      plannedDate: new Date('2026-09-30T00:00:00Z'), createdAt: updatedAt, updatedAt, oneCCashEvidence: null,
      manager: { name: 'Buyer', oneCManagerName: '' } };
    const payment = { ref: 'rko', number: 'TEST-RKO', date: '30.09.2026 15:27:43', posted: !scenario.includes('unposted'), deleted: false,
      documentAmount: 47600, documentCurrency: 'РУБ', baseDocumentRef: '', supplier: 'Supplier', contract: supplierDebt && scenario !== 'debt-no-basis' ? 'Supplier contract' : '' };
    const request = { ref: 'request', date: '30.09.2026 15:27:00', posted: true, deletion_mark: false, amount: 47600,
      partner: { name: 'Supplier' }, currency: { name: 'руб' }, source_document: { ref: 'order' },
      completeness: { request: true, linked_cash_expense_orders: true },
      linked_cash_expense_orders: { complete: true, truncated: false, errors: [], missing_fields: [], rows: [
        { ref: 'rko', date: payment.date, posted: payment.posted, deletion_mark: false, amount: 47600,
          request_amount: 47600, executed_amount: 47600, request_amount_conflict: false },
      ] } };
    const periods: string[][] = [], writes: any[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
      assert.equal(options.method, 'GET');
      if (scenario === 'offline') throw Error('offline');
      const query = new URL(input).searchParams, from = query.get('from')!, to = query.get('to')!;
      periods.push([from, to]);
      return Response.json({ ok: true, rows: !supplierDebt && from <= '2026-09-30' && to > '2026-09-30' ? [request] : [],
        completeness: { complete: scenario !== 'incomplete' } });
    });
    const db = { supplierPaymentPlan: { findMany: async (args: any) => [scenario === 'edited' && args.select
      ? { ...plan, updatedAt: new Date('2026-09-30T15:59:00Z') } : plan] },
      workdayNotification: { updateMany: async (args: any) => { writes.push(args); return { count: 1 }; } } };
    const mocks: Record<string, any> = {
      './prisma': { prisma: db }, '@/lib/prisma': { prisma: db },
      './procurement-currency-payment-source': { fetchSupplierCurrencyPaymentSnapshot: async () => ({ complete: true, payments: [payment], conversions: [] }) },
      './procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', currentDeliveryPush: async () => ({ state: 'inactive' }) },
    };
    const bundle = await build({ entryPoints: ['lib/workday-notifications.ts'], bundle: true, write: false,
      platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'mocks', setup(b) {
        b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined);
      } }] });
    const mod = { exports: {} as any };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
    const notice = { id: 1, kind: 'procurement_payment_approved', fingerprint: 'procurement-payment:plan:approved:event',
      taskId: null, issueId: null, reviewId: null, task: null, issue: null, review: null };
    const active = await mod.exports.reconcileActiveWorkdayNotifications(db, [notice]);
    assert.equal(active.length, fullyPaid ? 0 : 1, scenario);
    assert.equal(writes.length, fullyPaid ? 1 : 0, scenario);
    if (fullyPaid) {
      assert.equal(periods.at(-1)?.[1], '2026-10-01', 'exclusive end includes today');
      assert.deepEqual(writes[0], { where: { id: { in: [1] }, status: 'sent', readAt: null },
        data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
      assert.deepEqual(await mod.exports.filterActiveWorkdayNotifications(db, [notice]), [], 'pending push is also suppressed');
    }
  }
});
