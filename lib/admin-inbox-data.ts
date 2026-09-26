import 'server-only';

import { adminInboxActionLabel, adminInboxEventMeta, adminInboxSourceState } from '@/lib/admin-operations-view';
import {
  ADMIN_INBOX_TECHNICAL_EVENT_TYPES,
  adminInboxTechnicalSourceKey,
  effectiveAdminInboxReadAt,
  isAdminInboxTechnicalEvent,
} from '@/lib/admin-inbox-read-policy';
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
  const [displayRows, unreadRows] = await Promise.all([
    prisma.adminInboxReceipt.findMany({
      where: { userId: input.userId },
      include: { event: true },
      orderBy: { event: { occurredAt: 'desc' } },
      take: input.limit,
    }),
    prisma.adminInboxReceipt.findMany({
      where: { userId: input.userId, readAt: null },
      include: { event: true },
      orderBy: { event: { occurredAt: 'desc' } },
    }),
  ]);

  const rows = [...new Map([...displayRows, ...unreadRows].map((row) => [row.id, row])).values()];

  const expenseRefs = rows.filter((row) => row.event.sourceType === 'expense_request').map((row) => row.event.sourceId);
  const issueIds = rows.filter((row) => row.event.sourceType === 'workday_control_issue').map((row) => Number(row.event.sourceId)).filter(Number.isInteger);
  const reviewIds = rows.filter((row) => row.event.sourceType === 'terminal_fiscal_review').map((row) => row.event.sourceId);
  const exceptionIds = rows.filter((row) => row.event.sourceType === 'workday_close_exception').map((row) => row.event.sourceId);
  const cashOperationIds = rows.filter((row) => row.event.sourceType === 'cash_operation').map((row) => Number(row.event.sourceId)).filter(Number.isInteger);
  const technicalSources = [...new Map(rows
    .filter((row) => isAdminInboxTechnicalEvent(row.event.type))
    .map((row) => [adminInboxTechnicalSourceKey(row.event), {
      sourceType: row.event.sourceType,
      sourceId: row.event.sourceId,
    }])).values()];

  const [currentExpenses, issues, reviews, exceptions, cashOperations, technicalEvents] = await Promise.all([
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
      select: { id: true, status: true, reasonCode: true, consumedAt: true },
    }) : [],
    cashOperationIds.length ? prisma.cashOperation.findMany({
      where: { id: { in: cashOperationIds } },
      select: { id: true, status: true },
    }) : [],
    technicalSources.length ? prisma.adminInboxEvent.findMany({
      where: {
        type: { in: [...ADMIN_INBOX_TECHNICAL_EVENT_TYPES] },
        OR: technicalSources,
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, sourceType: true, sourceId: true },
    }) : [],
  ]);

  const currentExpenseRefs = new Set(currentExpenses.map((item) => item.oneCRequestRef));
  const issuesById = new Map(issues.map((item) => [String(item.id), item]));
  const reviewsById = new Map(reviews.map((item) => [item.id, item]));
  const exceptionsById = new Map(exceptions.map((item) => [item.id, item]));
  const cashOperationsById = new Map(cashOperations.map((item) => [String(item.id), item]));
  const latestTechnicalEventBySource = new Map<string, string>();
  for (const event of technicalEvents) {
    const key = adminInboxTechnicalSourceKey(event);
    if (!latestTechnicalEventBySource.has(key)) latestTechnicalEventBySource.set(key, event.id);
  }

  const itemsById = new Map(rows.map((row) => {
    const sourceType = row.event.sourceType;
    const sourceId = row.event.sourceId;
    const issue = issuesById.get(sourceId);
    const review = reviewsById.get(sourceId);
    const exception = exceptionsById.get(sourceId);
    const cashOperation = cashOperationsById.get(sourceId);
    const meta = adminInboxEventMeta(row.event.type);
    const lifecycleManaged = ['expense_request', 'workday_control_issue', 'terminal_fiscal_review', 'workday_close_exception', 'cash_operation'].includes(sourceType);
    const sourceState = adminInboxSourceState({
      sourceType,
      eventType: row.event.type,
      current: currentExpenseRefs.has(sourceId),
      businessStatus: issue?.status ?? review?.status ?? exception?.status ?? cashOperation?.status,
      reasonCode: exception?.reasonCode,
      employeeActionRequired: issue?.employeeActionRequired,
      sourceCompleted: Boolean(exception?.consumedAt),
    });
    const item: AdminInboxViewItem = {
      id: row.id,
      readAt: effectiveAdminInboxReadAt({
        storedReadAt: row.readAt,
        occurredAt: row.event.occurredAt,
        eventId: row.event.id,
        eventType: row.event.type,
        lifecycleManaged,
        sourceActive: sourceState.active,
        latestTechnicalEventId: latestTechnicalEventBySource.get(adminInboxTechnicalSourceKey(row.event)),
      })?.toISOString() ?? null,
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
    return [row.id, item] as const;
  }));

  const itemRows = input.unreadOnly ? unreadRows : displayRows;
  const items = itemRows
    .map((row) => itemsById.get(row.id))
    .filter((item): item is AdminInboxViewItem => Boolean(item))
    .filter((item) => !input.unreadOnly || item.readAt === null)
    .slice(0, input.limit);
  const unreadCount = unreadRows.reduce((count, row) => (
    itemsById.get(row.id)?.readAt === null ? count + 1 : count
  ), 0);

  return { items, unreadCount };
}
