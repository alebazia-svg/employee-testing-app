import 'server-only';

import { adminInboxActionLabel, adminInboxEventMeta, adminInboxSourceState } from '@/lib/admin-operations-view';
import { expenseRequestCurrentWhere } from '@/lib/expense-request-admin-lifecycle';
import { prisma } from '@/lib/prisma';

export type AdminInboxViewItem = {
  id: string;
  readAt: string | null;
  event: {
    type: string;
    title: string;
    body: string;
    href: string;
    sourceType: string;
    sourceId: string;
    occurredAt: string;
  };
  meta: ReturnType<typeof adminInboxEventMeta>;
  sourceState: ReturnType<typeof adminInboxSourceState>;
};

export async function loadAdminInbox(input: { userId: number; limit: number; unreadOnly?: boolean }) {
  const [rows, unreadCount] = await Promise.all([
    prisma.adminInboxReceipt.findMany({
      where: { userId: input.userId, ...(input.unreadOnly ? { readAt: null } : {}) },
      include: { event: true },
      orderBy: { event: { occurredAt: 'desc' } },
      take: input.limit,
    }),
    prisma.adminInboxReceipt.count({ where: { userId: input.userId, readAt: null } }),
  ]);

  const expenseRefs = rows.filter((row) => row.event.sourceType === 'expense_request').map((row) => row.event.sourceId);
  const issueIds = rows.filter((row) => row.event.sourceType === 'workday_control_issue').map((row) => Number(row.event.sourceId)).filter(Number.isInteger);
  const reviewIds = rows.filter((row) => row.event.sourceType === 'terminal_fiscal_review').map((row) => row.event.sourceId);
  const exceptionIds = rows.filter((row) => row.event.sourceType === 'workday_close_exception').map((row) => row.event.sourceId);

  const [currentExpenses, issues, reviews, exceptions] = await Promise.all([
    expenseRefs.length ? prisma.expenseRequestAdminCase.findMany({
      where: { ...expenseRequestCurrentWhere, oneCRequestRef: { in: expenseRefs } },
      select: { oneCRequestRef: true },
    }) : [],
    issueIds.length ? prisma.workdayControlIssue.findMany({
      where: { id: { in: issueIds } },
      select: { id: true, status: true, employeeActionRequired: true },
    }) : [],
    reviewIds.length ? prisma.terminalFiscalEmployeeReview.findMany({
      where: { id: { in: reviewIds } },
      select: { id: true, status: true },
    }) : [],
    exceptionIds.length ? prisma.workdayCloseExceptionRequest.findMany({
      where: { id: { in: exceptionIds } },
      select: { id: true, status: true },
    }) : [],
  ]);

  const currentExpenseRefs = new Set(currentExpenses.map((item) => item.oneCRequestRef));
  const issuesById = new Map(issues.map((item) => [String(item.id), item]));
  const reviewsById = new Map(reviews.map((item) => [item.id, item]));
  const exceptionsById = new Map(exceptions.map((item) => [item.id, item]));

  const items: AdminInboxViewItem[] = rows.map((row) => {
    const sourceType = row.event.sourceType;
    const sourceId = row.event.sourceId;
    const issue = issuesById.get(sourceId);
    const review = reviewsById.get(sourceId);
    const exception = exceptionsById.get(sourceId);
    const meta = adminInboxEventMeta(row.event.type);
    const sourceState = adminInboxSourceState({
      sourceType,
      current: currentExpenseRefs.has(sourceId),
      businessStatus: issue?.status ?? review?.status ?? exception?.status,
      employeeActionRequired: issue?.employeeActionRequired,
    });
    return {
      id: row.id,
      readAt: row.readAt?.toISOString() ?? null,
      event: {
        type: row.event.type,
        title: row.event.title,
        body: row.event.body,
        href: row.event.href,
        sourceType,
        sourceId,
        occurredAt: row.event.occurredAt.toISOString(),
      },
      meta: { ...meta, actionLabel: adminInboxActionLabel({ sourceType, defaultLabel: meta.actionLabel, sourceState }) },
      sourceState,
    };
  });

  return { items, unreadCount };
}
