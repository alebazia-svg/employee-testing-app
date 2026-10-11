import 'server-only';
import { readPaymentRevision } from './procurement-plan-revision';
import { ATTENTION_LIFECYCLE_SOURCES, selectAdminAttention } from './admin-inbox-attention-policy';
import { deliveryDetailsKey, readDeliveryDetails } from './procurement-delivery-request';
import { loadDeliveryNative } from './procurement-delivery-native-source';
import { deliveryRequestIsClosed } from './procurement-delivery-native';

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
  eventId: string;
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

export async function loadAdminInbox(input: { userId: number; limit: number; unreadOnly?: boolean; view?: 'attention' | 'history' | 'system' }) {
  const [displayRows, unreadRows, lifecycleRows] = await Promise.all([
    prisma.adminInboxReceipt.findMany({
      where: { userId: input.userId, ...(input.view === 'history' ? { event: { sourceType: { notIn: ['dependency', 'infrastructure'] }, type: { not: 'terminal_fiscal_review.created' } } } : input.view === 'system' ? { event: { OR: [{ sourceType: { in: ['dependency', 'infrastructure'] } }, { type: 'terminal_fiscal_review.created' }] } } : {}) },
      include: { event: true },
      orderBy: { event: { occurredAt: 'desc' } },
      take: input.limit,
    }),
    prisma.adminInboxReceipt.findMany({
      where: { userId: input.userId, readAt: null },
      include: { event: true },
      orderBy: { event: { occurredAt: 'desc' } },
    }),
    prisma.adminInboxReceipt.findMany({
      where: { userId: input.userId, event: { sourceType: { in: [...ATTENTION_LIFECYCLE_SOURCES, 'dependency', 'infrastructure'] } } },
      include: { event: true }, orderBy: { event: { occurredAt: 'desc' } },
    }),
  ]);

  const rows = [...new Map([...displayRows, ...unreadRows, ...lifecycleRows].map((row) => [row.id, row])).values()];

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
      select: { oneCRequestRef: true, notApprovedCycle: true },
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

  const currentExpenseKeys = new Set(currentExpenses.map((item) => `expense_request:not_approved:${item.oneCRequestRef}:${item.notApprovedCycle}`));
  const planIds = rows.filter(r => r.event.sourceType === 'supplier_payment_plan').map(r => r.event.sourceId);
  const plans = await prisma.supplierPaymentPlan.findMany({ where: { OR: [{ id: { in: planIds } }, { status: { in: ['SUBMITTED', 'APPROVED'] } }] }, include: { manager: { select: { name: true } }, events: { where: { action: { in: ['SUBMITTED', 'UPDATED'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { id: true, createdAt: true } } } });
  const plansById = new Map(plans.map(p => [p.id, p]));
  const deliveryEvents = rows.some(row => ['procurement_delivery', 'procurement_delivery_request'].includes(row.event.sourceType))
    ? await prisma.adminInboxEvent.findMany({ where: { sourceType: 'procurement_delivery' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, sourceId: true, type: true } }) : [];
  const activeDeliveryIds = new Set<string>();
  const deliverySources = new Set<string>();
  for (const event of deliveryEvents) {
    if (!deliverySources.has(event.sourceId) && event.type === 'procurement.delivery_requested') activeDeliveryIds.add(event.id);
    deliverySources.add(event.sourceId);
  }
  const activeDeliverySourceIds = new Set<string>();
  const linkedDeliveryExpenseRefs = new Set<string>();
  for (const event of deliveryEvents.filter(e => activeDeliveryIds.has(e.id))) {
    const record = await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryDetailsKey(event.id) }, select: { body: true } });
    const details = record ? readDeliveryDetails(record.body) : null;
    const native = details ? await loadDeliveryNative(event.id, details) : undefined;
    if (deliveryRequestIsClosed({ requestStateAvailable: true, nativeRequest: native })) activeDeliveryIds.delete(event.id);
    else {
      activeDeliverySourceIds.add(event.sourceId);
      if (native?.state === 'linked' && native.status) linkedDeliveryExpenseRefs.add(native.status.ref);
    }
  }
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
    const lifecycleManaged = (ATTENTION_LIFECYCLE_SOURCES as readonly string[]).includes(sourceType);
    const sourceState = adminInboxSourceState({
      sourceType,
      eventType: row.event.type,
      current: sourceType === 'procurement_delivery' ? activeDeliveryIds.has(row.event.id)
        : sourceType === 'procurement_delivery_request' ? activeDeliverySourceIds.has(sourceId) && deliveryEvents.some(e => activeDeliveryIds.has(e.id) && row.event.eventKey === `delivery:manual:${e.id}`)
        : currentExpenseKeys.has(row.event.eventKey),
      businessStatus: plansById.get(sourceId)?.status ?? issue?.status ?? review?.status ?? exception?.status ?? cashOperation?.status,
      reasonCode: exception?.reasonCode,
      employeeActionRequired: issue?.employeeActionRequired,
      sourceCompleted: Boolean(exception?.consumedAt),
    });
    if (isAdminInboxTechnicalEvent(row.event.type) && latestTechnicalEventBySource.get(adminInboxTechnicalSourceKey(row.event)) !== row.event.id) {
      sourceState.active = false; sourceState.label = 'В истории'; sourceState.tone = 'history';
    }
    const item: AdminInboxViewItem = {
      id: row.id,
      eventId: row.event.id,
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

  const allItems = [...itemsById.values()];
  // Batch notifications may name only the first plan. Build the decision list
  // from every real pending plan so resolving the first cannot hide the others.
  const pendingPlans: AdminInboxViewItem[] = plans.flatMap(plan => {
    const revision = plan.status === 'APPROVED' ? readPaymentRevision(plan.oneCCashEvidence) : null;
    if (plan.status !== 'SUBMITTED' && !revision) return [];
    return [{ id: `plan:${plan.id}:${revision?.id ?? plan.events[0]?.id ?? plan.createdAt.toISOString()}`, eventId: '', readAt: plan.createdAt.toISOString(),
      event: { type: 'procurement.payment_submitted', sourceType: 'supplier_payment_plan', sourceId: plan.id,
        title: revision ? 'Изменения оплаты на согласование' : `Оплата ${plan.planCode}`,
        body: `${plan.manager.name} · ${plan.supplierPartner} · ${Number(revision?.data.plannedAmount ?? plan.plannedAmount).toLocaleString('ru-RU')} ₽`,
        href: '/admin/procurement', occurredAt: revision?.submittedAt ?? plan.events[0]?.createdAt.toISOString() ?? plan.createdAt.toISOString() },
      meta: adminInboxEventMeta('procurement.payment_submitted'), sourceState: { active: true, label: 'Ожидает решения', tone: 'attention' as const } }];
  });
  const attention = selectAdminAttention([...allItems.filter(i => i.event.sourceType !== 'supplier_payment_plan' && !(i.event.sourceType === 'expense_request' && linkedDeliveryExpenseRefs.has(i.event.sourceId))), ...pendingPlans]);
  const technicalItems = allItems.filter(i => isAdminInboxTechnicalEvent(i.event.type) && latestTechnicalEventBySource.get(adminInboxTechnicalSourceKey(i.event)) === i.eventId && i.sourceState.active);
  const itemRows = input.unreadOnly ? unreadRows : displayRows;
  const items = itemRows
    .map((row) => itemsById.get(row.id))
    .filter((item): item is AdminInboxViewItem => Boolean(item))
    .filter((item) => !input.unreadOnly || item.readAt === null)
    .slice(0, input.limit);
  const unreadCount = unreadRows.reduce((count, row) => (
    itemsById.get(row.id)?.readAt === null ? count + 1 : count
  ), 0);

  return { items: input.view === 'attention' ? attention.slice(0, input.limit) : input.view === 'system' ? [...new Map([...technicalItems, ...items].map(i => [i.id, i])).values()] : items, unreadCount, attentionCount: attention.length, attention, technicalCount: technicalItems.length };
}
