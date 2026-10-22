import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { confirmCashExpenseDocuments, type CashExpenseEvidence } from './cash-expense-evidence';
import { EXPENSE_SOURCE_MAX_AGE_MS } from './employee-expense-policy';
import { expenseRecord as record } from './expense-request-list-view';
/** Complete only the captured expense explanation; never rewrite the counted cash or original 1C balance. */
export async function reconcileCashExpenseEvidence(now = new Date()) {
  const run = await prisma.expenseRequestSyncRun.findFirst({ where: { status: { not: 'running' } }, orderBy: { startedAt: 'desc' } });
  if (!run?.sourceComplete || run.status !== 'completed' || !run.completedAt || +now - +run.completedAt > EXPENSE_SOURCE_MAX_AGE_MS) return;
  const issues = await prisma.workdayControlIssue.findMany({ where: { status: { in: ['open', 'resolved'] }, ruleKey: 'cash_recount_mismatch', OR: [{ sourceData: { path: ['expenseEvidence', 'state'], equals: 'awaiting_documents' } }, { sourceData: { path: ['expenseEvidence', 'state'], equals: 'documented' } }] }, include: { task: true } });
  for (const issue of issues) {
    const data = record(issue.sourceData), evidence = record(data.expenseEvidence);
    if (!['awaiting_documents', 'documented'].includes(String(evidence.state)) || !Array.isArray(evidence.requests) || !issue.task) continue;
    const captured = evidence as CashExpenseEvidence;
    const cases = await prisma.expenseRequestAdminCase.findMany({ where: { oneCRequestRef: { in: captured.requests.map(item => item.ref) }, lastSeenAt: { gte: new Date(+now - EXPENSE_SOURCE_MAX_AGE_MS) } } });
    const evaluations = cases.length ? await prisma.expenseRequestAdminEvaluation.findMany({ where: { OR: cases.map(row => ({ caseId: row.id, sourceHash: row.latestSourceHash })) }, select: { normalizedSource: true } }) : [];
    const sources = evaluations.map(row => row.normalizedSource);
    const documentRefs = confirmCashExpenseDocuments(captured, String(data.capturedAt), sources);
    if (cases.length !== captured.requests.length || sources.length !== captured.requests.length) continue;
    const documented = Boolean(documentRefs?.length);
    if (!documented && evidence.state !== 'documented') continue;
    if (documented && evidence.state === 'documented') continue;
    const taskData = record(issue.task.handoverData), comparison = record(taskData.cashComparison);
    if (record(comparison.expenseEvidence).state !== evidence.state || comparison.capturedAt !== data.capturedAt) continue;
    const confirmed = { ...captured, state: documented ? 'documented' : 'awaiting_documents', documentRefs: documentRefs ?? [], confirmedAt: now.toISOString() };
    await prisma.$transaction(async tx => {
      const updated = await tx.workdayControlIssue.updateMany({ where: { id: issue.id, status: issue.status, updatedAt: issue.updatedAt }, data: { status: documented ? 'resolved' : 'open', resolvedAt: documented ? now : null, nextReminderAt: null, title: documented ? 'Расходники по заявкам подтверждены' : 'Расходники по заявкам требуют повторной проверки', sourceData: { ...data, expenseEvidence: confirmed } as Prisma.InputJsonValue } });
      if (!updated.count) return;
      const taskUpdated = await tx.shiftControlTask.updateMany({ where: { id: issue.task!.id, updatedAt: issue.task!.updatedAt }, data: { handoverData: { ...taskData, cashComparison: { ...comparison, expenseEvidence: confirmed } } as Prisma.InputJsonValue } });
      if (!taskUpdated.count) throw new Error('CASH_EXPENSE_RECOUNT_CHANGED');
    });
  }
}
