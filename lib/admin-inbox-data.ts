import { loadScheduleCoverageQuestions } from './schedule-coverage-reconciliation';
import 'server-only';
import { loadExpenseRouting } from './employee-expense-routing-snapshot';
import { adminExpenseRouteKey, adminExpenseRouteCopy, ADMIN_EXPENSE_ISSUE_SOURCE } from './employee-expense-routing';
import { refreshPendingExpenseStatuses } from './expense-request-status-refresh';
import { expenseSyncLastSuccess, sourceCheckIsStale } from './admin-inbox-source-health';
import { buyerDeadline, cashIssueDeadline, deadlineLabel, urgentDeadline } from './admin-inbox-deadlines';
import { loadDecisionCashiers, expenseCashboxRef } from './admin-inbox-deadline-source';
import { cashIssueKey, CASH_ISSUE_KIND } from './procurement-cash-issue-policy';
import { DELIVERY_PERSON } from './procurement-delivery-policy';
import { pushIdentity, pushText } from './admin-inbox-attention-policy';
import type { AttentionPushDetail, AttentionUrgency } from './admin-inbox-attention-policy';
import { readPaymentRevision } from './procurement-plan-revision';
import { ATTENTION_LIFECYCLE_SOURCES, selectAdminAttention, attentionKey, attentionDay, paymentReminderTiming } from './admin-inbox-attention-policy';
import { deliveryDetailsKey, readDeliveryDetails } from './procurement-delivery-request';
import { loadDeliveryNative } from './procurement-delivery-native-source';
import { deliveryRequestIsClosed, deliveryNativeFresh, deliveryCollectionAmount } from './procurement-delivery-native';

import { adminInboxActionLabel, adminInboxEventMeta, adminInboxSourceState } from '@/lib/admin-operations-view';
import {
  ADMIN_INBOX_TECHNICAL_EVENT_TYPES,
  adminInboxTechnicalSourceKey,
  effectiveAdminInboxReadAt,
  isAdminInboxTechnicalEvent,
} from '@/lib/admin-inbox-read-policy';
import { expenseRequestCurrentWhere } from '@/lib/expense-request-admin-lifecycle';
import { prisma } from '@/lib/prisma';
import {isPaymentReceipt} from './procurement-document-policy';
import { assessTaxLimitRisk, loadAusnReportCatalog, loadCurrentAusnReport } from './ausn-report-cache';
import { buildTaxDocumentPlan } from './tax-document-plan';
import { taxDocumentReminderEventKey, taxLimitReminderEventKey } from './tax-document-reminders';

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
    deadline?: string;
    urgency?: AttentionUrgency;
    technicalAttention?: boolean;
    push?: AttentionPushDetail;
  };
  meta: ReturnType<typeof adminInboxEventMeta>;
  sourceState: ReturnType<typeof adminInboxSourceState>;
};

export async function loadAdminInbox(input: { userId: number; limit: number; unreadOnly?: boolean; view?: 'attention' | 'history' | 'system'; now?: Date }) {
  // A failed/contended fast check must not break the inbox or resolve a task.
  if (!input.now) await refreshPendingExpenseStatuses().catch(() => null);
  const now = input.now ?? new Date();
  const today = attentionDay(now);
  const [displayRows, unreadRows, lifecycleRows] = await Promise.all([
    prisma.adminInboxReceipt.findMany({
      where: { userId: input.userId, ...(input.view === 'history' ? { event: { sourceType: { notIn: ['dependency', 'infrastructure'] } } } : input.view === 'system' ? { event: { OR: [{ sourceType: { in: ['dependency', 'infrastructure'] } }] } } : {}) },
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
      where: { userId: input.userId, event: { sourceType: { in: [...ATTENTION_LIFECYCLE_SOURCES, 'dependency', 'infrastructure', 'tax_control', 'tax_limit'] } } },
      include: { event: true }, orderBy: { event: { occurredAt: 'desc' } },
    }),
  ]);

  const rows = [...new Map([...displayRows, ...unreadRows, ...lifecycleRows].map((row) => [row.id, row])).values()];
  const scheduleQuestions = await loadScheduleCoverageQuestions(prisma, rows.filter(r=>r.event.sourceType==='work_schedule_coverage').map(r=>r.event.sourceId), now);
  const cashRouting = rows.some(r => r.event.sourceType === ADMIN_EXPENSE_ISSUE_SOURCE) ? await loadExpenseRouting(now) : null;
  const cashParts = new Map(cashRouting?.adminItems.map(i => [adminExpenseRouteKey(i), i]));
  const hasTaxReminder = rows.some((row) => row.event.sourceType === 'tax_control');
  const currentTaxEventKey = hasTaxReminder ? await Promise.all([
    loadAusnReportCatalog(),
    prisma.taxControlDocument.findMany({ select: { documentType: true, periodKey: true, coverageFrom: true, coverageTo: true, originalName: true } }),
  ]).then(([reports, documents]) => {
    const next = buildTaxDocumentPlan({ now, reports, documents: documents.map((document) => ({ ...document, source: 'portal' as const })) }).find((period) => period.status === 'missing');
    return next ? taxDocumentReminderEventKey(next) : undefined;
  }) : undefined;
  const hasTaxLimitReminder = rows.some((row) => row.event.sourceType === 'tax_limit');
  const currentTaxLimitEventKey = hasTaxLimitReminder ? await loadCurrentAusnReport().then((report) => {
    const risk = assessTaxLimitRisk(report);
    return risk.level === 'unknown' || risk.level === 'normal' ? undefined : taxLimitReminderEventKey({ level: risk.level, dataCutoff: report.dataCutoff });
  }) : undefined;
  const receiptIds=rows.filter(r=>r.event.sourceType==='supplier_payment_receipt').map(r=>r.event.sourceId);
  const currentReceipts=receiptIds.length?await prisma.supplierPaymentReceipt.findMany({where:{id:{in:receiptIds}},select:{id:true,purpose:true,replacedById:true}}):[];
  const activeReceiptIds=new Set(currentReceipts.filter(isPaymentReceipt).map(f=>f.id));

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
      select: { id: true, oneCRequestRef: true, notApprovedCycle: true, latestSourceHash: true, enteredNotApprovedAt: true, requestedByName: true, amount: true, oneCNumber: true, businessOperationName: true },
    }) : [],
    issueIds.length ? prisma.workdayControlIssue.findMany({
      where: { id: { in: issueIds } },
      select: { id: true, status: true, employeeActionRequired: true, sourceData:true },
    }) : [],
    reviewIds.length ? prisma.terminalFiscalEmployeeReview.findMany({
      where: { id: { in: reviewIds } },
      select: { id: true, status: true, reasonCode: true, amountKopecks: true, bankOperationAt: true },
    }) : [],
    exceptionIds.length ? prisma.workdayCloseExceptionRequest.findMany({
      where: { id: { in: exceptionIds } },
      select: { id: true, status: true, reasonCode: true, consumedAt: true, workDayEntry: { select: { date: true } } },
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
    ? await prisma.adminInboxEvent.findMany({ where: { sourceType: 'procurement_delivery' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, sourceId: true, type: true, occurredAt: true } }) : [];
  const activeDeliveryIds = new Set<string>();
  const deliverySources = new Set<string>();
  for (const event of deliveryEvents) {
    if (!deliverySources.has(event.sourceId) && event.type === 'procurement.delivery_requested') activeDeliveryIds.add(event.id);
    deliverySources.add(event.sourceId);
  }
  const activeDeliverySourceIds = new Set<string>();
  const linkedDeliveryExpenseRefs = new Set<string>();
  const evaluations = currentExpenses.length ? await prisma.expenseRequestAdminEvaluation.findMany({
    where: { OR: currentExpenses.map(c => ({ caseId: c.id, sourceHash: c.latestSourceHash })) },
    select: { caseId: true, normalizedSource: true },
  }) : [];
  const expenseCashboxes = new Map(currentExpenses.map(c => [c.oneCRequestRef, expenseCashboxRef(evaluations.find(e => e.caseId === c.id)?.normalizedSource)]));
  const nativeDeliveries = await Promise.all(deliveryEvents.filter(e => activeDeliveryIds.has(e.id)).map(async event => {
    const record = await prisma.adminInboxEvent.findUnique({ where: { eventKey: deliveryDetailsKey(event.id) }, select: { body: true } });
    const details = record ? readDeliveryDetails(record.body) : null;
    return { event, details, native: details ? await loadDeliveryNative(event.id, details) : undefined };
  }));
  const cashiers = await loadDecisionCashiers([...expenseCashboxes.values(), ...nativeDeliveries.map(d => d.native?.status?.cashboxRef)].filter((ref): ref is string => Boolean(ref)), now);
  const urgencies = new Map<string, AttentionUrgency>();
  const pushDetails = new Map<string, AttentionPushDetail>();
  for (const review of reviews) {
    const at = review.bankOperationAt.toLocaleString('ru-RU', {timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    pushDetails.set(`terminal_fiscal_review:${review.id}`, {
      identity: pushIdentity('Проверка чека', review.amountKopecks / 100),
      action: review.status === 'admin_review' ? 'Проверить чек' : 'Открыть проверку',
      detail: `Оплата ${at} МСК. ${review.status === 'admin_review' ? 'Требуется ваше решение.' : 'Вопрос ещё не закрыт.'}`,
    });
  }
  const deliveryHrefs = new Map<string, string>();
  const delayedDeliverySources = new Map<string, string>();
  const unavailableDeliverySources = new Set<string>();
  for (const c of currentExpenses) {
    const source = evaluations.find(e => e.caseId === c.id)?.normalizedSource;
    const comment = source && typeof source === 'object' && !Array.isArray(source) && 'comment' in source ? source.comment : '';
    pushDetails.set(`expense_request:${c.oneCRequestRef}`, { identity: pushIdentity(c.requestedByName, c.amount), action: 'Согласовать расход', reference: c.oneCNumber || undefined, detail: [c.oneCNumber ? `№ ${pushText(c.oneCNumber, 24)}.` : '', pushText(comment || c.businessOperationName, 75)].filter(Boolean).join(' ') });
    const ref = expenseCashboxes.get(c.oneCRequestRef);
    const urgency = urgentDeadline(ref ? cashiers.get(ref)?.deadlines(c.enteredNotApprovedAt ?? now) ?? [] : [], now);
    if (urgency) urgencies.set(`expense_request:${c.oneCRequestRef}`, urgency);
  }
  for (const { event, details, native } of nativeDeliveries) {
    const status = native?.status;
    // Unknown evidence is a source problem, never a new instruction to fund an
    // old request. Keep it inspectable under System without financial reminders.
    if (!native || native.state === 'unavailable' || native.state === 'unlinked' && Boolean(native.reviewReason) || native.state === 'linked' && (!status || status.state === 'review' || !deliveryNativeFresh(status, now.getTime()))) unavailableDeliverySources.add(event.sourceId);
    const awaitingCashier = native?.state === 'linked' && status && deliveryNativeFresh(status, now.getTime()) && deliveryCollectionAmount(status) !== null;
    const cashier = status?.cashboxRef ? cashiers.get(status.cashboxRef) : undefined;
    const deadlines = event.sourceId === DELIVERY_PERSON.ref ? [buyerDeadline(event.occurredAt)] : [];
    deadlines.push(...cashier?.deadlines(event.occurredAt) ?? []);
    if (awaitingCashier && cashier && status) {
      const notice = await prisma.workdayNotification.findUnique({ where: { fingerprint: cashIssueKey(status, cashier.userId) }, select: { scheduledAt: true, status: true, kind: true } });
      if (notice && notice.kind === CASH_ISSUE_KIND && notice.status !== 'cancelled') {
        const deadline = cashIssueDeadline(notice.scheduledAt, cashier.shift?.startedAt);
        if (Date.parse(deadline.at) <= +now) deadlines.push(deadline);
      }
    }
    const urgency = urgentDeadline(deadlines, now);
    const delayedIssue = awaitingCashier && Boolean(urgency);
    if (event.sourceId === DELIVERY_PERSON.ref) {
      const summary = { identity: pushIdentity('Астемир', delayedIssue ? status?.remaining : details?.amount), action: delayedIssue ? 'Проверить выдачу' : 'Решить по пополнению', detail: delayedIssue ? `${status?.cashbox ?? ''}. Полная выдача в 1С не подтверждена.` : pushText(details?.comment, 100) };
      for (const source of ['procurement_delivery', 'procurement_delivery_request']) {
        pushDetails.set(`${source}:${event.sourceId}`, summary);
        deliveryHrefs.set(`${source}:${event.sourceId}`, `/admin/expense-requests?deliveryRequest=${encodeURIComponent(event.id)}`);
      }
    }
    if (deliveryRequestIsClosed({ requestStateAvailable: true, nativeRequest: native }, now.getTime()) || awaitingCashier && !delayedIssue) activeDeliveryIds.delete(event.id);
    else {
      activeDeliverySourceIds.add(event.sourceId);
      if (urgency) {
        urgencies.set(`procurement_delivery:${event.sourceId}`, urgency);
        urgencies.set(`procurement_delivery_request:${event.sourceId}`, urgency);
      }
      if (delayedIssue && status) delayedDeliverySources.set(event.sourceId, `${status.recipientName || (event.sourceId === DELIVERY_PERSON.ref ? 'Астемир' : 'Получатель')} · ${Number(status.remaining).toLocaleString('ru-RU')} ₽ · ${status.cashbox}`);
    }
    if (native?.state === 'linked' && status) linkedDeliveryExpenseRefs.add(status.ref);
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
    const correctedReceipt=sourceType==='supplier_payment_receipt'&&!activeReceiptIds.has(sourceId);
    const lifecycleManaged = correctedReceipt||(ATTENTION_LIFECYCLE_SOURCES as readonly string[]).includes(sourceType);
    const sourceState = adminInboxSourceState({
      sourceType,
      eventType: row.event.type,
      current: sourceType === 'work_schedule_coverage' ? scheduleQuestions.get(sourceId)?.active === true : sourceType === ADMIN_EXPENSE_ISSUE_SOURCE ? cashParts.has(row.event.eventKey)
        : sourceType === 'tax_control' ? row.event.eventKey === currentTaxEventKey
        : sourceType === 'tax_limit' ? row.event.eventKey === currentTaxLimitEventKey
        : sourceType === 'procurement_delivery' ? activeDeliveryIds.has(row.event.id)
        : sourceType === 'procurement_delivery_request' ? activeDeliverySourceIds.has(sourceId) && deliveryEvents.some(e => activeDeliveryIds.has(e.id) && row.event.eventKey === `delivery:manual:${e.id}`)
        : currentExpenseKeys.has(row.event.eventKey),
      businessStatus: plansById.get(sourceId)?.status ?? issue?.status ?? review?.status ?? exception?.status ?? cashOperation?.status,
      reasonCode: exception?.reasonCode ?? review?.reasonCode,
      sourceDate: exception?.workDayEntry.date,
      today,
      employeeActionRequired: issue?.employeeActionRequired,
      adminVerificationRequired: row.event.type==='workday.kkm_shift_close_attention' && Boolean(issue?.sourceData && typeof issue.sourceData==='object' && !Array.isArray(issue.sourceData) && (issue.sourceData as Record<string,unknown>).ownerVerificationRequired===true),
      sourceCompleted: Boolean(exception?.consumedAt),
    });
    if (isAdminInboxTechnicalEvent(row.event.type) && latestTechnicalEventBySource.get(adminInboxTechnicalSourceKey(row.event)) !== row.event.id) {
      sourceState.active = false; sourceState.label = 'В истории'; sourceState.tone = 'history';
    }
    if(correctedReceipt){sourceState.active=false;sourceState.label='Назначение файла изменено';sourceState.tone='history';}
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
    if (sourceType === 'work_schedule_coverage' && sourceState.active) { const q=scheduleQuestions.get(sourceId)!; item.event.title=q.title; item.event.body=q.body; item.event.href=`/admin/attendance?date=${sourceId.split(':')[1]}`; }
    if (sourceType === ADMIN_EXPENSE_ISSUE_SOURCE) {
      const part = cashParts.get(row.event.eventKey);
      const unavailable = cashRouting?.state !== 'ready' || cashRouting.unavailableRefs.includes(row.event.eventKey.split(':')[1]);
      if (unavailable) {
        item.meta.category = 'system'; item.sourceState = { active: true, label: 'Статус не проверен', tone: 'neutral' };
        item.event.title = 'Статус выдачи не обновлён'; item.event.body = row.event.body.split('\n')[1] || 'Проверьте исполнение в 1С';
      } else if (part) {
        Object.assign(item.event, adminExpenseRouteCopy(part));
        item.sourceState = { active: true, label: 'Оформите расходник', tone: 'attention' };
        item.event.push = { identity: `${part.remaining.toLocaleString('ru-RU')} ₽ · ${part.cashbox}`, action: 'Оформите расходник', detail: part.reason, reference: part.number };
      } else {
        item.event.title = 'Выдача больше не ожидается'; item.event.body = row.event.body.split('\n').slice(1).join(' · ');
      }
    }
    if (sourceState.active && ['procurement_delivery', 'procurement_delivery_request'].includes(sourceType) && unavailableDeliverySources.has(sourceId)) {
      item.meta.category = 'system';
      item.meta.actionLabel = 'Проверить статус';
      item.sourceState.label = 'Статус не проверен';
      item.event.title = 'Не удалось проверить выдачу денег';
      item.event.body = 'Связь запроса с исполнением в 1С сейчас не подтверждена. Это не новый запрос денег. Проверьте связанную заявку и расходник в 1С, прежде чем оформлять повторную выдачу.';
      item.event.href = deliveryHrefs.get(`${sourceType}:${sourceId}`) ?? item.event.href;
    }
    if (sourceState.active && item.meta.category !== 'system') {
      item.event.push ??= pushDetails.get(`${sourceType}:${sourceId}`);
      item.event.href = deliveryHrefs.get(`${sourceType}:${sourceId}`) ?? item.event.href;
    }
    const urgency = sourceState.active && item.meta.category !== 'system' ? urgencies.get(`${sourceType}:${sourceId}`) : undefined;
    if (urgency) { item.event.urgency = urgency; item.event.deadline = deadlineLabel(urgency, now); }
    if (sourceState.active && ['procurement_delivery', 'procurement_delivery_request'].includes(sourceType) && delayedDeliverySources.has(sourceId)) {
      item.event.title = 'Проверьте выдачу денег';
      item.event.body = delayedDeliverySources.get(sourceId)!;
      item.sourceState.label = 'Проверьте расходник';
      item.meta.actionLabel = 'Проверить выдачу';
    }
    if (isAdminInboxTechnicalEvent(row.event.type) && sourceState.active && row.event.type.endsWith('.down') && sourceCheckIsStale(row.event.occurredAt, now)) {
      item.event.technicalAttention = true;
      item.event.title = `Данные долго не обновляются · ${row.event.title}`;
      item.event.body = 'Восстановление не подтверждено больше часа. Автоматическая проверка этого раздела может быть неполной. Проверьте источник данных; если доступ не восстановится, передайте проблему ответственному за связь.';
      item.event.push = { identity: 'Данные портала требуют проверки', action: 'Проверить связь', detail: 'Восстановление не подтверждено больше часа. Решения по деньгам сверяйте с 1С.' };
      item.event.href = '/admin/inbox?view=system';
      item.meta.actionLabel = 'Проверить связь';
    }
    return [row.id, item] as const;
  }));

  const allItems = [...itemsById.values()];
  // Batch notifications may name only the first plan. Build the decision list
  // from every real pending plan so resolving the first cannot hide the others.
  const pendingPlans: AdminInboxViewItem[] = plans.flatMap(plan => {
    const revision = plan.status === 'APPROVED' ? readPaymentRevision(plan.oneCCashEvidence) : null;
    if (plan.status !== 'SUBMITTED' && !revision) return [];
    // Include both the existing obligation and a proposed date change until reviewed.
    const currentTiming = paymentReminderTiming(plan.plannedDate, now);
    const proposedTiming = revision?.data.plannedDate ? paymentReminderTiming(revision.data.plannedDate, now) : currentTiming;
    const timing = proposedTiming.day && currentTiming.day && proposedTiming.day < currentTiming.day ? proposedTiming : currentTiming;
    if (!timing.active) return [];
    return [{ id: `plan:${plan.id}:${revision?.id ?? plan.events[0]?.id ?? plan.createdAt.toISOString()}:${timing.day}`, eventId: '', readAt: plan.createdAt.toISOString(),
      event: { type: 'procurement.payment_submitted', sourceType: 'supplier_payment_plan', sourceId: plan.id,
        title: revision ? `${timing.label} · изменения на согласование` : `${timing.label} · ${plan.supplierPartner}`,
        deadline: timing.deadline,
        push: { identity: pushIdentity(plan.supplierPartner, revision?.data.plannedAmount ?? plan.plannedAmount), action: 'Согласовать оплату', detail: `${plan.manager.name}. ${timing.label}.` },
        body: `${plan.manager.name} · ${plan.supplierPartner} · ${Number(revision?.data.plannedAmount ?? plan.plannedAmount).toLocaleString('ru-RU')} ₽`,
        href: '/admin/procurement', occurredAt: revision?.submittedAt ?? plan.events[0]?.createdAt.toISOString() ?? plan.createdAt.toISOString() },
      meta: adminInboxEventMeta('procurement.payment_submitted'), sourceState: { active: true, label: 'Нужно согласовать', tone: 'attention' as const } }];
  });
  const technicalItems = [...new Map(allItems.filter(i => i.meta.category === 'system' && i.sourceState.active && (!isAdminInboxTechnicalEvent(i.event.type) || latestTechnicalEventBySource.get(adminInboxTechnicalSourceKey(i.event)) === i.eventId)).map(i => [attentionKey(i),i])).values()];
  const latestExpenseSync = await expenseSyncLastSuccess();
  if (latestExpenseSync && sourceCheckIsStale(latestExpenseSync, now)) {
    technicalItems.unshift({id:'system:expense-sync',eventId:'',readAt:null,
      event:{type:'dependency.expense_sync_stale',sourceType:'dependency',sourceId:'expense-sync',occurredAt:latestExpenseSync.toISOString(),
        title:'Заявки из 1С давно не обновлялись',body:'Больше часа нет успешной синхронизации. Новые заявки менеджеров могут отсутствовать в портале. Проверьте заявки в 1С и передайте проблему ответственному за связь.',href:'/admin/expense-requests',technicalAttention:true},
      meta:{...adminInboxEventMeta('dependency.down'),actionLabel:'Открыть заявки'},sourceState:{active:true,label:'Данные устарели',tone:'attention'}});
  }
  // Keep technical evidence in System without adding an owner task or bell badge.
  const attention = selectAdminAttention([...allItems.filter(i => !i.event.technicalAttention && i.event.sourceType !== 'supplier_payment_plan' && !(i.event.sourceType === 'expense_request' && linkedDeliveryExpenseRefs.has(i.event.sourceId))), ...pendingPlans]);
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
