import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { PayrollOneCControlSlice } from '../lib/payroll-one-c-control-snapshots';
export async function seedPreviewPayroll(db: PrismaClient, userId: number, name: string, periodKey: string) {
  const date = `${periodKey}-01`;
    const slice: PayrollOneCControlSlice = { version: 2, dateFrom: date, dateTo: date,
      close: { date, ready: true, executionDate: date, finishedAt: date, costDocument: 'QA', blockingIssues: [] },
      source: { contractVersion: 'payroll-sales-facts-v2', checkedAt: date, extractedAt: date, pages: 1 },
      sales: { managerKeys: [], rows: [], summary: { sourceRows: 0, normalizedRows: 0, managerCount: 0, revenue: 0, cost: 0, grossProfit: 0,
        missingManagerRows: 0, missingCustomerRows: 0, missingProductRows: 0, costReviewRows: 0, costCalculationPendingRows: 0 } },
      purchases: { contractVersion: 'payroll-purchase-attribution-v1', employeeRef: 'QA', employeeName: 'Тохов Астемир', documentCount: 0,
        reviewDocumentCount: 0, ignoredOtherDocumentCount: 0, settlements: [] } };
    const sourceId = (await db.payrollOneCControlSnapshot.create({ data: { periodKey, kind: 'DAILY', dateFrom: date, dateTo: date,
      payload: JSON.parse(JSON.stringify(slice)), contentHash: 'QA', sourceCheckedAt: new Date() } })).id;
    const attendanceId = (await db.payrollAttendanceSnapshot.create({ data: { periodKey, sourceCheckedAt: new Date(), payload: {
      version: 1, period: { periodKey, year: Number(periodKey.slice(0,4)), monthIndex: Number(periodKey.slice(5))-1 }, attendanceMode: 'google-sheets', attendanceMessage: '',
      scheduleMode: 'not-configured', scheduleMessage: '', formSummaries: [], scheduleSummaries: [],
    } } })).id;
    const draftId = (await db.payrollDraftRevision.create({ data: { periodKey, revision: 1, requestId: randomUUID(), createdByUserId: userId,
      payload: { manual: { [name]: { workedDays: '18', lateCount: '0', advance: '', comment: '', source: 'manualCorrection' } }, fixed: {},
        purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] } } })).id;
  return { sourceId, attendanceId, draftId };
}
