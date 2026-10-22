import 'server-only';
import { prisma } from './prisma';
import { employeeExpenseSnapshot } from './employee-expense-policy';

/** Reuse the existing three-minute 1C sync. Employee polling never writes to 1C or starts a batch read. */
export async function loadEmployeeExpenses(userId: number, now = new Date()) {
  const mapping = await prisma.userOneCCashboxMapping.findUnique({ where: { userId } });
  const cashboxRef = mapping?.isActive ? mapping.oneCCashboxRef : '';
  const owners = cashboxRef ? await prisma.userOneCCashboxMapping.count({ where: { isActive: true, oneCCashboxRef: cashboxRef, user: { isActive: true } } }) : 0;
  const run = cashboxRef && owners === 1 ? await prisma.expenseRequestSyncRun.findFirst({ where: { status: { not: 'running' } }, orderBy: { startedAt: 'desc' } }) : null;
  // Include old outstanding cases too: a request outside the sync window is unknown, never silently completed.
  const cases = run ? await prisma.expenseRequestAdminCase.findMany({ where: { deletionMark: false, currentStatusKey: { in: ['payable', 'approved', 'not_approved'] } } }) : [];
  const evaluations = cases.length ? await prisma.expenseRequestAdminEvaluation.findMany({ where: { OR: cases.map(row => ({ caseId: row.id, sourceHash: row.latestSourceHash })) }, select: { caseId: true, sourceHash: true, normalizedSource: true } }) : [];
  const sources = new Map(evaluations.map(row => [row.caseId, row.normalizedSource]));
  return { cashboxRef, ...employeeExpenseSnapshot({ cashboxRef, uniqueOwner: owners === 1, now: +now,
    complete: run?.status === 'completed' && run.sourceComplete,
    checkedAt: run?.completedAt?.toISOString() ?? null,
    rows: cases.map(row => ({ source: sources.has(row.id) ? sources.get(row.id) : { cashbox: { ref: cashboxRef }, status: { key: 'payable' } }, seenAt: row.lastSeenAt.toISOString(), cycle: row.notApprovedCycle })),
  }) };
}
