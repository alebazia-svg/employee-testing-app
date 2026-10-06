import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '@prisma/client';
import { preservePaymentEvidenceViews, paymentEvidenceView, savedPaymentEvidence } from '../lib/procurement-evidence-continuity';
import type { ProcurementPaymentEvidence } from '../lib/procurement-currency-payment-evidence';

test('PostgreSQL evidence continuity: reload, nulls, throttle, concurrent edit and cancellation', async t => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/payment_test');
  const db = new PrismaClient();
  const marker = `evidence-continuity-${Date.now()}`;
  const owner = await db.user.create({ data: { name: marker, login: marker, passwordHash: 'not-login', role: 'EMPLOYEE', portalArea: 'PROCUREMENT' } });
  const now = new Date();
  const paid: ProcurementPaymentEvidence = { state: 'ISSUED_BY_ONE_C', actualSupplier: marker,
    issuedAmount: 47600, paidAmount: 0, paidForeignAmount: 0, remainingAmount: 0,
    remainingForeignAmount: null, actualExchangeRate: null, currencyPayments: [],
    cashOrders: [{ ref: 'demo-rko', number: 'DEMO', date: '30.09.2026 12:00:00', amount: 47600, cashbox: 'DEMO' }] };
  const unpaid: ProcurementPaymentEvidence = { ...paid, state: 'NO_EVIDENCE', issuedAmount: 0, remainingAmount: 47600, cashOrders: [] };
  const make = (suffix: string, meta: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput) => db.supplierPaymentPlan.create({ data: {
    managerUserId: owner.id, planCode: `${marker}-${suffix}`, supplierPartner: marker, orderRefs: ['order'], orderNumbers: ['DEMO'],
    plannedDate: new Date('2026-09-30T00:00:00Z'), plannedAmount: 47600, condition: 'TEST', paymentMethod: 'CASH', status: 'APPROVED', oneCCashEvidence: meta,
  } });
  const read = (id: string) => db.supplierPaymentPlan.findUniqueOrThrow({ where: { id } });
  const persist = (p: Awaited<ReturnType<typeof read>>, e = paid, complete = true, started = now) =>
    preservePaymentEvidenceViews([p], new Map([[p.id, e]]), complete, started, db.supplierPaymentPlan, new Date(now.getTime() + 1000));
  try {
    await t.test('DB null, JSON null and existing metadata persist without changing business version', async () => {
      for (const [i, meta] of [Prisma.DbNull, Prisma.JsonNull, { manualRubleLinks: [{ ref: 'manual', fingerprint: 'kept' }], other: 'keep' }].entries()) {
        const p = await make(String(i), meta);
        await persist(p);
        const reloaded = await read(p.id);
        assert.equal(reloaded.updatedAt.toISOString(), p.updatedAt.toISOString());
        assert.equal(savedPaymentEvidence(reloaded)?.evidence.state, 'ISSUED_BY_ONE_C');
        const view = paymentEvidenceView(reloaded, unpaid, false, now.toISOString());
        assert.equal(view.state, 'ISSUED_BY_ONE_C'); assert.equal(view.verification, 'last-confirmed');
        if (i === 2) assert.equal((reloaded.oneCCashEvidence as any).other, 'keep');
        const before = JSON.stringify(reloaded.oneCCashEvidence);
        await persist(reloaded, unpaid, false);
        assert.equal(JSON.stringify((await read(p.id)).oneCCashEvidence), before);
      }
    });
    await t.test('identical snapshot read from jsonb does not write again within five minutes', async () => {
      const p = await make('throttle', {}); await persist(p);
      const reloaded = await read(p.id);
      let writes = 0;
      await preservePaymentEvidenceViews([reloaded], new Map([[p.id, paid]]), true, now,
        { updateMany: async args => { writes++; return db.supplierPaymentPlan.updateMany(args); } }, new Date(now.getTime()+2000));
      assert.equal(writes, 0);
    });
    await t.test('stale view cannot overwrite a manual link change or newer cached evidence', async () => {
      const p = await make('race', {});
      await persist(p);
      await persist(p, unpaid);
      assert.equal(savedPaymentEvidence(await read(p.id))?.evidence.state, 'ISSUED_BY_ONE_C');
      const beforeEdit = await read(p.id);
      await db.supplierPaymentPlan.update({ where: { id: p.id }, data: {
        oneCCashEvidence: { ...(beforeEdit.oneCCashEvidence as Prisma.JsonObject), manualRubleLinks: [{ ref: 'new', fingerprint: 'new' }] },
      } });
      await persist(beforeEdit, unpaid);
      const after = await read(p.id);
      assert.deepEqual((after.oneCCashEvidence as any).manualRubleLinks, [{ref:'new',fingerprint:'new'}]);
      assert.equal(savedPaymentEvidence(after), null, 'manual allocation edit invalidates snapshot identity');
    });
    await t.test('a complete cancellation supersedes paid history and survives a new connection', async () => {
      const p = await make('cancel', {}); await persist(p);
      await persist(await read(p.id), unpaid, true, new Date(now.getTime()+500));
      const independent = new PrismaClient();
      try {
        const reloaded = await independent.supplierPaymentPlan.findUniqueOrThrow({where:{id:p.id}});
        assert.equal(savedPaymentEvidence(reloaded)?.evidence.state, 'NO_EVIDENCE');
        assert.equal(paymentEvidenceView(reloaded, paid, false, now.toISOString()).issuedAmount, 0);
      } finally { await independent.$disconnect(); }
    });
  } finally {
    await db.supplierPaymentPlan.deleteMany({ where: { managerUserId: owner.id } });
    await db.user.delete({ where: { id: owner.id } });
    await db.$disconnect();
  }
});
