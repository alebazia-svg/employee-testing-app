import 'server-only';

import webpush from 'web-push';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
    .filter((notification) => !activeIds.has(notification.id))
    .map((notification) => notification.id);

  if (inactiveIds.length) {
    await db.workdayNotification.updateMany({
      where: { id: { in: inactiveIds }, status: 'sent', readAt: null },
      data: { status: 'cancelled' },
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

function notificationTargetKey(notification: { id: number; taskId: number | null; issueId: number | null; reviewId: string | null }) {
  if (notification.taskId) return `task:${notification.taskId}`;
  if (notification.issueId) return `issue:${notification.issueId}`;
  if (notification.reviewId) return `review:${notification.reviewId}`;
  return `notification:${notification.id}`;
}

export function workdayNotificationHref(notification: { issueId: number | null; reviewId: string | null }) {
  if (notification.reviewId) return `/employee/payment-checks/${notification.reviewId}`;
  if (notification.issueId) return `/employee/issues/${notification.issueId}`;
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

async function activeUnreadNotificationTargets(userId: number) {
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
  return new Set(active.map(notificationTargetKey));
}

export async function dispatchDueWorkdayNotifications(now = new Date()) {
  await reconcileStoredUnreadWorkdayNotifications();
  const due = await prisma.workdayNotification.findMany({
    where: { status: 'pending', scheduledAt: { lte: now } },
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
  const results: Array<{ id: number; status: string }> = [];
  const activeDue = await filterActiveWorkdayNotifications(prisma, due);
  const activeDueIds = new Set(activeDue.map((notification) => notification.id));

  for (const notification of due) {
    if (!activeDueIds.has(notification.id)) {
      await prisma.workdayNotification.update({ where: { id: notification.id }, data: { status: 'cancelled' } });
      results.push({ id: notification.id, status: 'cancelled' });
      continue;
    }

    let lastError = '';
    if (pushConfigured) {
      const unreadTargets = await activeUnreadNotificationTargets(notification.userId);
      const targetKey = notificationTargetKey(notification);
      const targetAlreadyUnread = unreadTargets.has(targetKey);
      unreadTargets.add(targetKey);
      const badgeCount = unreadTargets.size;
      const payload = JSON.stringify({
        ...(notification.task
          ? workdayTaskNotificationCopy(notification.task, notification.kind)
          : { title: notification.title, body: notification.body }),
        url: workdayNotificationHref(notification),
        notificationId: notification.id,
        badgeCount,
      });
      for (const subscription of targetAlreadyUnread ? [] : notification.user.pushSubscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          }, payload);
        } catch (error) {
          const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.workdayPushSubscription.update({ where: { id: subscription.id }, data: { disabledAt: now } });
          } else {
            lastError = error instanceof Error ? error.message.slice(0, 500) : 'Push delivery failed';
          }
        }
      }
    }

    await prisma.workdayNotification.update({
      where: { id: notification.id },
      data: {
        status: 'sent',
        sentAt: now,
        attemptCount: { increment: 1 },
        lastError: pushConfigured ? lastError : 'Web Push is not configured; notification is available in the portal.',
      },
    });
    results.push({ id: notification.id, status: 'sent' });
  }

  return { processed: results.length, results };
}
