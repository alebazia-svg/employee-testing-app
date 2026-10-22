import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { savePayrollDraft } from '../lib/payroll-draft-store';
import type { PayrollDraft } from '../lib/payroll-draft';

test('real PostgreSQL protects revisions, retries, parallel writes, actor history and final periods', { skip: !process.env.PAYROLL_DRAFT_TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.PAYROLL_DRAFT_TEST_DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/payroll_owner_preview_20261021', 'isolated local database required');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const payload: PayrollDraft = { manual: {}, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] };
  let periodId: number | undefined;
  let runId: number | undefined;
  let period = '';
  try {
    for (let month = 1; month <= 12; month++) {
      const key = `2098-${String(month).padStart(2, '0')}`;
      if (!await db.payrollPeriod.findUnique({ where: { periodKey: key } }) && !await db.payrollDraftRevision.count({ where: { periodKey: key } })) { period = key; break; }
    }
    assert.ok(period);
    const input = { period, revision: 0, requestId: randomUUID(), payload };
    const first = await savePayrollDraft(db, input, 901);
    periodId = (await db.payrollPeriod.findUniqueOrThrow({ where: { periodKey: period } })).id;
    assert.equal(first.revision, 1);
    assert.deepEqual(await savePayrollDraft(db, input, 901), first);
    await assert.rejects(savePayrollDraft(db, input, 902), /REQUEST_REUSED/);
    await assert.rejects(savePayrollDraft(db, { ...input, payload: { ...payload, purchase: { ...payload.purchase, advance: '123' } } }, 901), /REQUEST_REUSED/);
    const attempts = await Promise.allSettled([901, 902].map(actor => savePayrollDraft(db, {
      ...input, revision: 1, requestId: randomUUID(), payload: { ...payload, purchase: { ...payload.purchase, comment: String(actor) } },
    }, actor)));
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
    const records = await db.payrollDraftRevision.findMany({ where: { periodKey: period }, orderBy: { revision: 'asc' } });
    assert.equal(records.length, 2); assert.equal(records[0].createdByUserId, 901);
    assert.deepEqual(records[0].payload, payload);
    assert.ok(records.every(record => record.createdAt instanceof Date));
    assert.equal((await savePayrollDraft(db, input, 901)).revision, 2, 'lost old response returns current state');
    await assert.rejects(savePayrollDraft(db, { ...input, requestId: randomUUID() }, 901), /REVISION_CONFLICT/);
    runId = (await db.payrollRun.create({ data: { periodId, runNumber: 1, status: 'FINAL' } })).id;
    await assert.rejects(savePayrollDraft(db, { ...input, revision: 2, requestId: randomUUID() }, 901), /PERIOD_LOCKED/);
    assert.equal(await db.payrollDraftRevision.count({ where: { periodKey: period } }), 2);
    await db.payrollRun.update({ where: { id: runId }, data: { status: 'DRAFT' } });
    await db.payrollPeriod.update({ where: { id: periodId }, data: { status: 'CLOSED' } });
    await assert.rejects(savePayrollDraft(db, { ...input, revision: 2, requestId: randomUUID() }, 901), /PERIOD_LOCKED/);
  } finally {
    if (periodId) {
      if (runId) await db.payrollRun.delete({ where: { id: runId } });
      await db.payrollDraftRevision.deleteMany({ where: { periodKey: period } });
      await db.payrollPeriod.delete({ where: { id: periodId } });
    }
    await db.$disconnect();
  }
});
