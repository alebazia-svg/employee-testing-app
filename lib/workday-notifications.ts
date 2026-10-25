import 'server-only';
import { activeScheduleNotices, scheduleNoticeKinds, scheduleNoticeRef } from './work-schedule-notifications';
import { reconcileCashExpenseEvidence } from './cash-expense-reconciliation';
import { EMPLOYEE_EXPENSE_KIND, expensePushTtl } from './employee-expense-policy';
import { loadExpenseRouting } from './employee-expense-routing-snapshot';
import { expenseRouteKey } from './employee-expense-routing';
import { expensePushDecision, queueEmployeeExpensePushes } from './employee-expense-notifications';
import { observePushAttempt } from './push-attempt-observation';
import {RECEIPT_EMPLOYEE_KIND,receiptHref,receiptPlanFromFingerprint} from './procurement-receipt-policy';

import webpush from 'web-push';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { planWorkdayPushDelivery, suppressUnreadWorkdayPush } from '@/lib/workday-push-delivery';
import { TERMINAL_FISCAL_ADMIN_FIRST, fiscalApprovalKey } from '@/lib/terminal-fiscal-admin-gate';
import { inactiveProcurementNotifications } from '@/lib/procurement-notification-lifecycle';
import { DELIVERY_READY_KIND, deliveryPushDecision, queueDeliveryReadyPush } from '@/lib/procurement-delivery-notifications';
import { COLLECTION_READY_KIND, COLLECTION_PUSH_COPY, collectionPushDecision, queueCollectionReadyPush } from '@/lib/procurement-collection-notifications';
import { employeePushNotBefore, employeePushTtl, DELIVERY_PUSH_COPY } from '@/lib/employee-push-policy';
import { queueCashMorningPushes } from '@/lib/procurement-morning-notifications';
import { isCashMorning, cashMorningNotBefore } from '@/lib/procurement-morning-policy';
import { workdayNotificationThreadKey } from '@/lib/workday-notification-thread';
import { CASH_ISSUE_KIND, cashIssueHref } from '@/lib/procurement-cash-issue-policy';
import { cashIssuePushDecision, queueCashIssuePush } from '@/lib/procurement-cash-issue-notifications';
import {QR_CHECK_KIND,qrCheckPlan} from './procurement-qr-check-policy';
import {qrCheckPushDecision} from './procurement-qr-check-notifications';

type DbClient = Prisma.TransactionClient | typeof prisma;

type NotificationLifecycleRow = {
  id: number;
  kind: string;
  fingerprint: string;
  taskId: number | null;
  issueId: number | null;
  reviewId: string | null;
  task: { status: string; run: { status: string } } | null;
  issue: { status: string; employeeActionRequired: boolean } | null;
  review: { status: string } | null;
};

type CloseExceptionScope = 'required_issues' | 'cash_encashment' | 'all';

function closeExceptionScope(reasonCode: string) {
  return reasonCode.startsWith('cash_encashment_') ? 'cash_encashment' : 'required_issues';
}

export function closeExceptionNotificationRef(notification: Pick<NotificationLifecycleRow, 'kind' | 'fingerprint'>) {
  if (notification.kind !== 'workday_close_exception_decision') return null;
  const match = /^workday-close-exception:([^:]+):(approved|rejected)$/.exec(notification.fingerprint);
  return match ? { requestId: match[1], decision: match[2] } : null;
}

export async function filterActiveWorkdayNotifications<T extends NotificationLifecycleRow>(db: DbClient, rows: T[]) {
  const routing = rows.some(row => row.kind === EMPLOYEE_EXPENSE_KIND) ? await loadExpenseRouting().catch(() => null) : null;
  const expenseKeys = new Set(routing?.items.map(expenseRouteKey));
  const activeSchedule = await activeScheduleNotices(db, rows);
  const inactiveProcurement = await inactiveProcurementNotifications(db, rows);
  const refs = rows.map(closeExceptionNotificationRef).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const requestIds = [...new Set(refs.map((item) => item.requestId))];
  const referencedRequests = requestIds.length ? await db.workdayCloseExceptionRequest.findMany({
    where: { id: { in: requestIds } },
    select: {
      id: true,
      workDayEntryId: true,
      status: true,
      reasonCode: true,
      consumedAt: true,
      workDayEntry: { select: { status: true, endedAt: true } },
    },
  }) : [];
  const workDayEntryIds = [...new Set(referencedRequests.map((request) => request.workDayEntryId))];
  const decidedRequests = workDayEntryIds.length ? await db.workdayCloseExceptionRequest.findMany({
    where: { workDayEntryId: { in: workDayEntryIds }, status: { in: ['approved', 'rejected'] } },
    select: { id: true, workDayEntryId: true, status: true, reasonCode: true },
    orderBy: [{ decidedAt: 'desc' }, { requestedAt: 'desc' }],
  }) : [];
  const latestByWorkdayAndScope = new Map<string, string>();
  for (const request of decidedRequests) {
    const key = `${request.workDayEntryId}:${closeExceptionScope(request.reasonCode)}`;
    if (!latestByWorkdayAndScope.has(key)) latestByWorkdayAndScope.set(key, request.id);
  }
  const requestsById = new Map(referencedRequests.map((request) => [request.id, request]));

  return rows.filter((notification) => {
    if (notification.kind === EMPLOYEE_EXPENSE_KIND && routing?.state === 'ready' && !routing.unavailableRefs.includes(notification.fingerprint?.split(':')[3] ?? '') && !expenseKeys.has(notification.fingerprint ?? '')) return false;
    if (inactiveProcurement.has(notification.id)) return false;
    if (scheduleNoticeKinds.includes(notification.kind) && !activeSchedule.has(notification.id)) return false;
    if (notification.kind === 'cash_operation_created') return false;
    if (notification.task) return notification.task.status === 'pending' && notification.task.run.status === 'active';
    if (notification.issue) return notification.issue.status === 'open' && notification.issue.employeeActionRequired;
    if (notification.review) return notification.review.status === 'open';
    const ref = closeExceptionNotificationRef(notification);
    if (!ref) return true;
    const request = requestsById.get(ref.requestId);
    if (!request || request.status !== ref.decision || request.consumedAt) return false;
    if (request.workDayEntry.endedAt || !['active', 'missing_checkout'].includes(request.workDayEntry.status)) return false;
    const latestKey = `${request.workDayEntryId}:${closeExceptionScope(request.reasonCode)}`;
    return latestByWorkdayAndScope.get(latestKey) === request.id;
  });
}

export async function reconcileActiveWorkdayNotifications<T extends NotificationLifecycleRow>(db: DbClient, rows: T[]) {
  const activeRows = await filterActiveWorkdayNotifications(db, rows);
  const activeIds = new Set(activeRows.map((notification) => notification.id));
  const inactiveIds = rows
    .filter((notification) => !activeIds.has(notification.id) && !scheduleNoticeKinds.includes(notification.kind))
    .map((notification) => notification.id);

  const resolvedScheduleIds = rows.filter(row => !activeIds.has(row.id) && scheduleNoticeKinds.includes(row.kind)).map(row => row.id);
  if (resolvedScheduleIds.length) await db.workdayNotification.updateMany({
    where: { id: { in: resolvedScheduleIds }, status: { in: ['pending', 'sent'] } },
    data: { status: 'resolved', pushStatus: 'cancelled', nextPushAttemptAt: null },
  });
  if (inactiveIds.length) {
    await db.workdayNotification.updateMany({
      where: { id: { in: inactiveIds }, status: 'sent', readAt: null },
      data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null },
    });
  }

  return activeRows;
}

export async function resolveCloseExceptionNotifications(db: DbClient, input: {
  workDayEntryId: number;
  now: Date;
  scope?: CloseExceptionScope;
}) {
  const requests = await db.workdayCloseExceptionRequest.findMany({
    where: { workDayEntryId: input.workDayEntryId },
    select: { id: true, reasonCode: true },
  });
  const requestIds = requests
    .filter((request) => !input.scope || input.scope === 'all' || closeExceptionScope(request.reasonCode) === input.scope)
    .map((request) => request.id);
  if (!requestIds.length) return;
  const fingerprints = requestIds.flatMap((id) => [
    `workday-close-exception:${id}:approved`,
    `workday-close-exception:${id}:rejected`,
  ]);
  await db.workdayNotification.updateMany({
    where: { fingerprint: { in: fingerprints }, status: 'sent', readAt: null },
    data: { readAt: input.now },
  });
  await db.workdayNotification.updateMany({
    where: { fingerprint: { in: fingerprints }, status: 'pending' },
    data: { status: 'cancelled' },
  });
}

type NotificationTask = {
  id: number;
  userId: number;
  title: string;
  category: string;
  plannedTimeMinutes: number | null;
  run: { date: string };
};

const graceMinutesByCategory: Record<string, number> = {
  opening: 15,
  cash: 15,
  credit: 30,
  acquiring: 30,
  handover: 15,
  closing: 15,
};

const repeatMinutesByCategory: Record<string, number> = {
  opening: 15,
  cash: 15,
  credit: 30,
  acquiring: 30,
  handover: 15,
  closing: 15,
};

export function workdayTaskNotificationCopy(task: Pick<NotificationTask, 'category' | 'title'>, kind: string) {
  if (task.category === 'handover' && kind === 'early_finish_reminder') return {
    title: 'Завершите рабочий день',
    body: 'Продолжите сдачу смены.',
  };
  const overdue = kind !== 'planned';
  const overduePrefix = overdue ? 'Задание просрочено. ' : '';
  const acceptingCashbox = task.category === 'cash' && /принять кассу/i.test(task.title);
  if (acceptingCashbox) return {
    title: 'Примите кассу',
    body: `${overduePrefix}Пересчитайте наличные и внесите остаток.`,
  };
  if (task.category === 'cash') return {
    title: 'Пересчитайте кассу',
    body: `${overduePrefix}Внесите фактический остаток.`,
  };
  if (task.category === 'opening') return {
    title: 'Откройте смену ККМ',
    body: `${overduePrefix}Откройте смену и подтвердите выполнение.`,
  };
  if (task.category === 'closing') return {
    title: 'Закройте смену ККМ',
    body: `${overduePrefix}Закройте смену и подтвердите выполнение.`,
  };
  if (task.category === 'acquiring') return {
    title: 'Проверьте терминал',
    body: `${overduePrefix}Проверьте новые операции.`,
  };
  if (task.category === 'credit') return {
    title: 'Проверьте кредиты',
    body: `${overduePrefix}Проверьте кредиты и рассрочки.`,
  };
  if (task.category === 'handover') return {
    title: 'Сдайте смену',
    body: `${overduePrefix}Выполните итоговые действия.`,
  };
  return {
    title: task.title,
    body: `${overduePrefix}Откройте задание в приложении.`,
  };
}

export function moscowTaskTime(dateKey: string, minutes: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
}

export async function scheduleTaskNotifications(db: DbClient, tasks: NotificationTask[]) {
  const rows = tasks.flatMap((task) => {
    if (task.plannedTimeMinutes === null) return [];
    const plannedAt = moscowTaskTime(task.run.date, task.plannedTimeMinutes);
    const graceMinutes = graceMinutesByCategory[task.category] ?? 20;
    const repeatMinutes = repeatMinutesByCategory[task.category] ?? 30;
    const entries = [
      { kind: 'planned', scheduledAt: plannedAt },
      { kind: 'overdue', scheduledAt: new Date(plannedAt.getTime() + graceMinutes * 60_000) },
      { kind: 'overdue_repeat', scheduledAt: new Date(plannedAt.getTime() + (graceMinutes + repeatMinutes) * 60_000) },
    ];
    return entries.map((entry) => ({
      ...workdayTaskNotificationCopy(task, entry.kind),
      userId: task.userId,
      taskId: task.id,
      fingerprint: `task:${task.id}:${entry.kind}`,
      kind: entry.kind,
      scheduledAt: entry.scheduledAt,
    }));
  });

  for (const row of rows) {
    await db.workdayNotification.upsert({
      where: { fingerprint: row.fingerprint },
      create: row,
      update: {
        title: row.title,
        body: row.body,
        scheduledAt: row.scheduledAt,
      },
    });
  }
}

export async function cancelPendingTaskNotifications(db: DbClient, taskId: number) {
  await db.workdayNotification.updateMany({
    where: { taskId, status: 'pending' },
    data: { status: 'cancelled' },
  });
}

export async function resolveTaskNotifications(db: DbClient, taskIds: number[], now: Date) {
  if (!taskIds.length) return;
  await db.workdayNotification.updateMany({
    where: { taskId: { in: taskIds }, status: 'sent', readAt: null },
    data: { readAt: now },
  });
  await db.workdayNotification.updateMany({
    where: { taskId: { in: taskIds }, status: 'pending' },
    data: { status: 'cancelled' },
  });
}

function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? '';
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || 'mailto:admin@offonika.ru';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function notificationTargetKey(notification: { id: number; taskId: number | null; issueId: number | null; reviewId: string | null; kind?: string; fingerprint?: string }) {
  if (notification.taskId) return `task:${notification.taskId}`;
  if (notification.issueId) return `issue:${notification.issueId}`;
  if (notification.reviewId) return `review:${notification.reviewId}`;
  const schedule = scheduleNoticeRef(notification.fingerprint ?? '');
  if (schedule && scheduleNoticeKinds.includes(notification.kind ?? '')) return `schedule:${schedule.department}:${schedule.date.slice(0, 7)}`;
  const digest = notification.kind === 'schedule_replacement_digest' ? /^schedule-coverage-digest:([^:]+):(\d{4}-\d{2}):/.exec(notification.fingerprint ?? '') : null;
  if (digest) return `schedule:${digest[1]}:${digest[2]}`;
  return workdayNotificationThreadKey(notification);
}

export function workdayNotificationHref(notification: { issueId: number | null; reviewId: string | null; kind?: string; fingerprint?: string }) {
  if(notification.kind===QR_CHECK_KIND){const id=qrCheckPlan(notification.fingerprint||'');return id?receiptHref(id,false):'/procurement';}
  if (notification.kind === EMPLOYEE_EXPENSE_KIND) return '/employee?attention=cash';
  if (notification.kind === CASH_ISSUE_KIND) return cashIssueHref(notification.fingerprint);
  if(notification.kind===RECEIPT_EMPLOYEE_KIND) {
    const plan=receiptPlanFromFingerprint(notification.fingerprint||'');
    return plan?receiptHref(plan,false):'/procurement';
  }
  if (notification.kind === DELIVERY_READY_KIND) return '/procurement#delivery';
  if (notification.kind === COLLECTION_READY_KIND) return '/procurement';
  if (notification.kind?.startsWith('procurement_payment_')) return '/procurement';
  if (notification.reviewId) return `/employee/payment-checks/${notification.reviewId}`;
  if (notification.issueId) return `/employee/issues/${notification.issueId}`;
  if (notification.kind === 'schedule_replacement_request' || notification.kind === 'schedule_fill_request') {
    const date = notification.fingerprint?.match(/^schedule-coverage:[^:]+:(\d{4}-\d{2}-\d{2}):/)?.[1];
    return date ? `/employee?attention=schedule&item=schedule%3A${date}` : '/employee?attention=schedule';
  }
  if (notification.kind === 'schedule_replacement_digest') {
    return '/employee?attention=schedule';
  }
  return '/employee';
}

async function reconcileStoredUnreadWorkdayNotifications() {
  const rows = await prisma.workdayNotification.findMany({
    where: { status: 'sent', readAt: null },
    select: {
      id: true,
      kind: true,
      fingerprint: true,
      taskId: true,
      issueId: true,
      reviewId: true,
      task: { select: { status: true, run: { select: { status: true } } } },
      issue: { select: { status: true, employeeActionRequired: true } },
      review: { select: { status: true } },
    },
  });
  await reconcileActiveWorkdayNotifications(prisma, rows);
}

async function activeUnreadNotificationTargets(userId: number, excludeNotificationId?: number) {
  const rows = await prisma.workdayNotification.findMany({
    where: { userId, status: 'sent', readAt: null },
    select: {
      id: true,
      kind: true,
      fingerprint: true,
      taskId: true,
      issueId: true,
      reviewId: true,
      task: { select: { status: true, run: { select: { status: true } } } },
      issue: { select: { status: true, employeeActionRequired: true } },
      review: { select: { status: true } },
    },
  });
  const active = await reconcileActiveWorkdayNotifications(prisma, rows);
  return new Set(active.filter((notification) => notification.id !== excludeNotificationId).map(notificationTargetKey));
}

export async function dispatchDueWorkdayNotifications(now = new Date()) {
  const startedAt = Date.now();
  // Remote source reads or a slow provider may cross 22:00 during one run.
  const dispatchTime = () => new Date(now.getTime() + Date.now() - startedAt);
  // A crashed sender may already have delivered its push. Keep its inbox item, but
  // never automatically replay an uncertain delivery and wake the employee twice.
  await prisma.workdayNotification.updateMany({ where: {
    kind: { in: [DELIVERY_READY_KIND, COLLECTION_READY_KIND, CASH_ISSUE_KIND, EMPLOYEE_EXPENSE_KIND, QR_CHECK_KIND] }, pushStatus: 'delivery_sending', nextPushAttemptAt: { lte: now },
    status: { in: ['pending', 'sent'] },
  }, data: { status: 'sent', sentAt: now, pushStatus: 'delivery_unknown', nextPushAttemptAt: null, lastError: 'DELIVERY_RESULT_UNKNOWN' } });
  // The delivery producer is idempotent; a source outage must not block other domains.
  await queueDeliveryReadyPush(now).catch(() => undefined);
  await queueCashIssuePush(now).catch(() => undefined);
  await queueEmployeeExpensePushes(now).catch(() => undefined);
  await reconcileCashExpenseEvidence(now).catch(() => undefined);
  await queueCollectionReadyPush(now).catch(() => undefined);
  await queueCashMorningPushes(now).catch(() => undefined);
  await reconcileStoredUnreadWorkdayNotifications();
  const due = await prisma.workdayNotification.findMany({
    where: {
      OR: [
        { status: 'pending', pushStatus: { not: 'delivery_sending' }, scheduledAt: { lte: now } },
        {
          status: 'sent',
          readAt: null,
          pushStatus: { in: ['retry_pending', 'no_subscription', 'not_configured'] },
          nextPushAttemptAt: { lte: now },
        },
      ],
    },
    include: {
      task: { include: { run: { select: { status: true } } } },
      issue: true,
      review: true,
      user: { include: { pushSubscriptions: { where: { disabledAt: null } } } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 200,
  });
  const pushConfigured = configureWebPush();
  const results: Array<{ id: number; status: string; pushStatus: string }> = [];
  const activeDue = await filterActiveWorkdayNotifications(prisma, due);
  const activeDueIds = new Set(activeDue.map((notification) => notification.id));

  for (const notification of due) {
    const delivery = notification.kind === EMPLOYEE_EXPENSE_KIND ? await expensePushDecision(notification, dispatchTime())
      : notification.kind === QR_CHECK_KIND ? await qrCheckPushDecision(notification,dispatchTime())
      : notification.kind === CASH_ISSUE_KIND ? await cashIssuePushDecision(notification, dispatchTime())
      : notification.kind === DELIVERY_READY_KIND ? await deliveryPushDecision(notification, dispatchTime())
      : notification.kind === COLLECTION_READY_KIND ? await collectionPushDecision(notification, dispatchTime()) : null;
    if (delivery?.state === 'defer') {
      await prisma.workdayNotification.update({ where: { id: notification.id }, data: { scheduledAt: delivery.until, nextPushAttemptAt: delivery.until } });
      continue;
    }
    if (delivery?.state === 'cancel') {
      await prisma.workdayNotification.update({ where: { id: notification.id }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
      continue;
    }
    if (TERMINAL_FISCAL_ADMIN_FIRST) {
      const unapprovedReview = notification.reviewId && !await prisma.adminInboxEvent.findUnique({ where: { eventKey: fiscalApprovalKey(notification.reviewId) }, select: { id: true } });
      if (unapprovedReview || notification.issue?.ruleKey === 'terminal_fiscal_mismatch') {
        await prisma.workdayNotification.update({ where: { id: notification.id }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
        results.push({ id: notification.id, status: 'cancelled', pushStatus: 'cancelled' });
        continue;
      }
    }
    if (!activeDueIds.has(notification.id)) {
      const status = scheduleNoticeKinds.includes(notification.kind) ? 'resolved' : 'cancelled';
      await prisma.workdayNotification.updateMany({
        where: { id: notification.id, ...(scheduleNoticeKinds.includes(notification.kind) ? { status: { in: ['pending', 'sent'] } } : {}) },
        data: { status, pushStatus: 'cancelled', nextPushAttemptAt: null },
      });
      results.push({ id: notification.id, status, pushStatus: 'cancelled' });
      continue;
    }

    // Recheck calendar state immediately before delivery: a colleague may have
    // answered while the dispatcher was processing another notification.
    if (scheduleNoticeKinds.includes(notification.kind) && !(await activeScheduleNotices(prisma, [notification])).has(notification.id)) continue;
    const sendTime = dispatchTime();
    const notBefore = employeePushNotBefore(sendTime);
    if (notBefore > sendTime) {
      await prisma.workdayNotification.updateMany({ where: {
        id: notification.id, updatedAt: notification.updatedAt, status: notification.status,
      }, data: { scheduledAt: notBefore, nextPushAttemptAt: notBefore } });
      continue;
    }

    const unreadTargets = await activeUnreadNotificationTargets(notification.userId, notification.id);
    const targetKey = notificationTargetKey(notification);
    const targetAlreadyUnread = suppressUnreadWorkdayPush({
      targetAlreadyUnread: unreadTargets.has(targetKey) && !isCashMorning(notification),
      kind: notification.kind,
      task: notification.task,
    });
    unreadTargets.add(targetKey);
    const badgeCount = unreadTargets.size;
    if (delivery?.state === 'send') {
      // CAS guards both the timer and an overlapping internal dispatcher request.
      const claimed = await prisma.workdayNotification.updateMany({ where: {
        id: notification.id, updatedAt: notification.updatedAt, status: notification.status,
        pushStatus: notification.pushStatus, readAt: null,
      }, data: { pushStatus: 'delivery_sending', nextPushAttemptAt: new Date(now.getTime() + 600000) } });
      if (!claimed.count) continue;
    }
    const attemptNumber = notification.attemptCount + 1;
    let deliveredCount = 0;
    let transientFailureCount = 0;
    let permanentFailureCount = 0;
    let lastErrorCode = '';
    let providerAttemptCount = 0;

    if (pushConfigured && !targetAlreadyUnread && notification.user.pushSubscriptions.length > 0) {
      const payload = JSON.stringify({
        ...(notification.task
          ? workdayTaskNotificationCopy(notification.task, notification.kind)
          : scheduleNoticeKinds.includes(notification.kind) ? { title: 'Вопросы по графику', body: 'Откройте приложение и отметьте рабочие дни или выходные.' } : delivery?.state === 'send' ? [CASH_ISSUE_KIND, EMPLOYEE_EXPENSE_KIND, QR_CHECK_KIND].includes(notification.kind) ? { title: delivery.title, body: delivery.body } : notification.kind === COLLECTION_READY_KIND ? COLLECTION_PUSH_COPY : DELIVERY_PUSH_COPY : { title: notification.title, body: notification.body }),
        url: scheduleNoticeKinds.includes(notification.kind) ? '/employee?attention=schedule' : workdayNotificationHref(notification),
        notificationId: notification.id,
        badgeCount,
      });
      for (const subscription of notification.user.pushSubscriptions) {
        const attemptTime = dispatchTime();
        if (employeePushNotBefore(attemptTime) > attemptTime || employeePushTtl(attemptTime) === 0
          || isCashMorning(notification) && cashMorningNotBefore(attemptTime) > attemptTime) {
          transientFailureCount += 1;
          lastErrorCode = 'WEB_PUSH_QUIET_HOURS';
          continue;
        }
        try {
          providerAttemptCount += 1;
          await observePushAttempt(subscription, () => webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          }, payload, { TTL: notification.kind === EMPLOYEE_EXPENSE_KIND ? expensePushTtl(attemptTime) : employeePushTtl(attemptTime), timeout: 10000 }));
          deliveredCount += 1;
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.workdayPushSubscription.update({ where: { id: subscription.id }, data: { disabledAt: now } });
            permanentFailureCount += 1;
          } else {
            transientFailureCount += 1;
          }
          lastErrorCode = statusCode ? `WEB_PUSH_${statusCode}` : 'WEB_PUSH_FAILED';
        }
      }
    }

    if (!providerAttemptCount && lastErrorCode === 'WEB_PUSH_QUIET_HOURS') {
      const until = isCashMorning(notification) ? cashMorningNotBefore(dispatchTime()) : employeePushNotBefore(dispatchTime());
      await prisma.workdayNotification.updateMany({ where: {
        id: notification.id, ...(delivery?.state === 'send' ? { pushStatus: 'delivery_sending' } : {}),
      }, data: { pushStatus: 'retry_pending', scheduledAt: until, nextPushAttemptAt: until } });
      continue;
    }

    const pushOutcome = planWorkdayPushDelivery({
      now: dispatchTime(),
      attemptNumber,
      configured: pushConfigured,
      targetAlreadyUnread,
      subscriptionCount: notification.user.pushSubscriptions.length,
      deliveredCount,
      transientFailureCount,
      permanentFailureCount,
      lastErrorCode,
    });
    await prisma.workdayNotification.updateMany({
      where: { id: notification.id, ...(scheduleNoticeKinds.includes(notification.kind) ? { status: { in: ['pending', 'sent'] } } : {}), ...(delivery?.state === 'send' ? { pushStatus: 'delivery_sending', status: { in: ['pending', 'sent'] } } : {}) },
      data: {
        status: 'sent',
        sentAt: notification.sentAt ?? now,
        attemptCount: { increment: 1 },
        lastError: pushOutcome.lastErrorCode,
        pushStatus: pushOutcome.status,
        pushDeliveredAt: pushOutcome.status === 'delivered' ? now : notification.pushDeliveredAt,
        nextPushAttemptAt: pushOutcome.nextAttemptAt,
      },
    });
    results.push({ id: notification.id, status: 'sent', pushStatus: pushOutcome.status });
  }

  return { processed: results.length, results };
}
