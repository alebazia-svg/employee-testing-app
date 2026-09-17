import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { PrismaClient } from '@prisma/client';

test('manual payment route: real PostgreSQL persistence, concurrency, auth, revoke and stale source', async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/payment_test', 'isolated disposable DB only');
  const db = new PrismaClient();
  const g = globalThis as any;
  g.paymentTestDb = db;
  const ref = '11111111-1111-1111-1111-111111111111';
  const marker = `payment-test-${Date.now()}`;
  const user = await db.user.create({ data: { name: marker, login: marker, passwordHash: 'not-a-login', role: 'ADMIN' } });
  g.paymentTestAuth = { ok: true, user };
  g.paymentTestSource = { complete: true, conversions: [], payments: [{ ref, number: 'TEST', date: '16.09.2026 18:00:00', posted: true, deleted: false, documentCurrency: 'РУБ', documentAmount: 280000, baseDocumentRef: '', supplier: 'MEMS', contract: 'test contract' }] };
  g.paymentTestRequests = { complete: true, rows: [] };
  const make = (suffix: string) => db.supplierPaymentPlan.create({ data: { planCode: marker + suffix, managerUserId: user.id, supplierPartner: 'MEMS', orderRefs: [], orderNumbers: [], plannedDate: new Date('2026-09-16'), createdAt: new Date('2026-09-15'), plannedAmount: 280000, condition: 'FULL', paymentMethod: 'CASH', status: 'APPROVED' } });
  const plans = await Promise.all([make('a'), make('b')]);
  try {
    const mocks: Record<string, string> = {
      '@/lib/admin-api-auth': 'export const requireAdminApi = async () => globalThis.paymentTestAuth;',
      '@/lib/prisma': 'export const prisma = globalThis.paymentTestDb;',
      '@/lib/procurement-currency-payment-source': 'export const fetchSupplierCurrencyPaymentSnapshot = async () => globalThis.paymentTestSource;',
      '@/lib/expense-request-source': 'export const fetchExpenseRequestSnapshot = async () => globalThis.paymentTestRequests;',
    };
    const bundle = await build({ entryPoints: ['app/api/admin/procurement/payment-plans/[id]/payment-link/route.ts'], bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'test-boundaries', setup(b) { b.onResolve({ filter: /^@\/lib\// }, args => mocks[args.path] ? { path: args.path, namespace: 'test-boundaries' } : null); b.onLoad({ filter: /.*/, namespace: 'test-boundaries' }, args => ({ contents: mocks[args.path], loader: 'js' })); } }] });
    const { POST } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
    const send = (id: string, action = 'LINK') => POST(new Request('http://localhost/test', { method: 'POST', body: JSON.stringify({ ref, action }) }), { params: Promise.resolve({ id }) });
    g.paymentTestAuth = { ok: false, response: Response.json({}, { status: 403 }) };
    assert.equal((await send(plans[0].id)).status, 403);
    g.paymentTestAuth = { ok: true, user };
    const results = await Promise.all(plans.map(p => send(p.id)));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const winner = plans[results.findIndex(r => r.status === 200)];
    assert.equal((await send(winner.id)).status, 200, 'idempotent repeat');
    assert.equal(await db.supplierPaymentPlanEvent.count({ where: { planId: winner.id } }), 1);
    assert.equal((await send(winner.id, 'UNLINK')).status, 200);
    const saved = await db.supplierPaymentPlan.findUniqueOrThrow({ where: { id: winner.id } });
    assert.deepEqual((saved.oneCCashEvidence as any).manualRubleLinks, []);
    g.paymentTestSource.complete = false;
    assert.equal((await send(winner.id)).status, 503);
    g.paymentTestSource.complete = true;
    g.paymentTestSource.payments[0].supplier = 'Other';
    assert.equal((await send(winner.id)).status, 409);
  } finally {
    await db.supplierPaymentPlan.deleteMany({ where: { managerUserId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
