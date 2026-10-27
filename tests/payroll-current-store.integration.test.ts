import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { readStoredPersonalCurrentPayroll } from '../lib/payroll-current-store';
import type { PayrollOneCControlSlice } from '../lib/payroll-one-c-control-snapshots';

test('real PostgreSQL current read uses persisted drafts, hides foreign rows and respects FINAL', { skip: !process.env.PAYROLL_DRAFT_TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.PAYROLL_DRAFT_TEST_DATABASE_URL!);
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname)
    && ['/payroll_owner_preview_20261021', '/payroll_pwa_repair_20261027'].includes(url.pathname));
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const periodKey = '2097-12';
  const date = `${periodKey}-01`;
  const name = `Payroll QA ${randomUUID()}`;
  let userId: number | undefined;
  let periodId: number | undefined;
  let sourceId: number | undefined;
  let attendanceId: number | undefined;
  let draftId: number | undefined;
  let runId: number | undefined;
  try {
    assert.equal(await db.payrollPeriod.count({ where: { periodKey } }), 0);
    assert.equal(await db.payrollOneCControlSnapshot.count({ where: { periodKey } }), 0);
    assert.equal(await db.payrollAttendanceSnapshot.count({ where: { periodKey } }), 0);
    assert.equal(await db.payrollDraftRevision.count({ where: { periodKey } }), 0);
    userId = (await db.user.create({ data: { name, login: name, passwordHash: 'not-a-login-fixture', role: 'EMPLOYEE', department: 'retail',
      payrollName: name, payrollSalaryType: 'fixed_salary', payrollFixedSalary: 43210 } })).id;
    periodId = (await db.payrollPeriod.create({ data: { periodKey, year: 2097, month: 11 } })).id;
    assert.equal(await readStoredPersonalCurrentPayroll(periodKey, userId, db), null);
    const slice: PayrollOneCControlSlice = { version: 2, dateFrom: date, dateTo: date,
      close: { date, ready: true, executionDate: date, finishedAt: date, costDocument: 'QA', blockingIssues: [] },
      source: { contractVersion: 'payroll-sales-facts-v2', checkedAt: date, extractedAt: date, pages: 1 },
      sales: { managerKeys: [], rows: [], summary: { sourceRows: 0, normalizedRows: 0, managerCount: 0, revenue: 0, cost: 0, grossProfit: 0,
        missingManagerRows: 0, missingCustomerRows: 0, missingProductRows: 0, costReviewRows: 0, costCalculationPendingRows: 0 } },
      purchases: { contractVersion: 'payroll-purchase-attribution-v1', employeeRef: 'QA', employeeName: 'Тохов Астемир', documentCount: 0,
        reviewDocumentCount: 0, ignoredOtherDocumentCount: 0, settlements: [] } };
    sourceId = (await db.payrollOneCControlSnapshot.create({ data: { periodKey, kind: 'DAILY', dateFrom: date, dateTo: date,
      payload: JSON.parse(JSON.stringify(slice)), contentHash: 'QA', sourceCheckedAt: new Date() } })).id;
    attendanceId = (await db.payrollAttendanceSnapshot.create({ data: { periodKey, sourceCheckedAt: new Date(), payload: {
      version: 1, period: { periodKey, year: 2097, monthIndex: 11 }, attendanceMode: 'google-sheets', attendanceMessage: '',
      scheduleMode: 'not-configured', scheduleMessage: '', formSummaries: [], scheduleSummaries: [],
    } } })).id;
    draftId = (await db.payrollDraftRevision.create({ data: { periodKey, revision: 1, requestId: randomUUID(), createdByUserId: userId,
      payload: { manual: {}, fixed: { [name]: { bonus: '789', advance: '', deduction: '', comment: 'QA' } },
        purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] } } })).id;
    let advanceReads = 0;
    const readAdvances = async () => { advanceReads++; return null; };
    const current = await readStoredPersonalCurrentPayroll(periodKey, userId, db, readAdvances);
    assert.equal(current?.grossPay, 43999);
    assert.equal(current?.userId, userId);
    assert.equal(current?.draftRevision, 1);
    assert.equal(current?.advance, null);
    assert.equal(await readStoredPersonalCurrentPayroll(periodKey, userId + 1000000, db, readAdvances), null);
    assert.equal(advanceReads, 1, 'unknown employee must not trigger 1C reads');
    assert.equal(await db.payrollDraftRevision.count({ where: { periodKey } }), 1, 'read creates no revisions');
    runId = (await db.payrollRun.create({ data: { periodId, runNumber: 1, status: 'FINAL' } })).id;
    assert.equal(await readStoredPersonalCurrentPayroll(periodKey, userId, db, readAdvances), null, 'daily must not replace final');
    await db.payrollRun.update({ where: { id: runId }, data: { status: 'DRAFT' } });
    await db.payrollPeriod.update({ where: { id: periodId }, data: { status: 'CLOSED' } });
    assert.equal(await readStoredPersonalCurrentPayroll(periodKey, userId, db, readAdvances), null, 'closed period must not be recomputed');
    assert.equal(advanceReads, 1, 'FINAL/CLOSED must not trigger advance refresh');
  } finally {
    if (runId) await db.payrollRun.delete({ where: { id: runId } });
    if (draftId) await db.payrollDraftRevision.delete({ where: { id: draftId } });
    if (attendanceId) await db.payrollAttendanceSnapshot.delete({ where: { id: attendanceId } });
    if (sourceId) await db.payrollOneCControlSnapshot.delete({ where: { id: sourceId } });
    if (periodId) await db.payrollPeriod.delete({ where: { id: periodId } });
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
});
