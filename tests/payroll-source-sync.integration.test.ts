import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { withPayrollSourceLock } from '../lib/payroll-source-lock';
import { isPayrollSourceSyncEligible } from '../lib/payroll-source-sync-store';

test('PostgreSQL serializes source writers and excludes unsaved, final and closed periods', { skip: !process.env.PAYROLL_DRAFT_TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.PAYROLL_DRAFT_TEST_DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/payroll_owner_preview_20261021');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const periodKey = '2096-11';
  let userId: number | undefined, periodId: number | undefined;
  try {
    assert.equal(await db.payrollPeriod.count({ where: { periodKey } }), 0);
    assert.equal(await isPayrollSourceSyncEligible(periodKey, db), false);
    periodId = (await db.payrollPeriod.create({ data: { periodKey, year: 2096, month: 10 } })).id;
    assert.equal(await isPayrollSourceSyncEligible(periodKey, db), false, 'no invented draft');
    const name = `sync-qa-${randomUUID()}`;
    userId = (await db.user.create({ data: { name, login: name, passwordHash: 'not-a-login-fixture', role: 'ADMIN' } })).id;
    await db.payrollDraftRevision.create({ data: { periodKey, revision: 1, requestId: randomUUID(), createdByUserId: userId, payload: {} } });
    assert.equal(await isPayrollSourceSyncEligible(periodKey, db), true);
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const ready = new Promise<void>(r => { entered = r; });
    const first = withPayrollSourceLock(async () => { entered(); await gate; return 'first'; }, db);
    await ready;
    try {
      assert.equal(await withPayrollSourceLock(async () => { throw Error('parallel source write'); }, db), null);
    } finally { release(); }
    assert.equal(await first, 'first');
    await assert.rejects(withPayrollSourceLock(async () => { throw Error('source failure'); }, db));
    assert.equal(await withPayrollSourceLock(async () => 'released', db), 'released');
    await db.payrollRun.create({ data: { periodId, runNumber: 1, status: 'FINAL' } });
    assert.equal(await isPayrollSourceSyncEligible(periodKey, db), false);
    await db.payrollRun.updateMany({ where: { periodId }, data: { status: 'DRAFT' } });
    await db.payrollPeriod.update({ where: { id: periodId }, data: { status: 'CLOSED' } });
    assert.equal(await isPayrollSourceSyncEligible(periodKey, db), false);
  } finally {
    if (periodId) {
      await db.payrollRun.deleteMany({ where: { periodId } });
      await db.payrollDraftRevision.deleteMany({ where: { periodKey } });
      await db.payrollPeriod.delete({ where: { id: periodId } });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
});
