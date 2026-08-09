import 'server-only';

import webpush from 'web-push';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type DbClient = Prisma.TransactionClient | typeof prisma;

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

function notificationTitle(task: Pick<NotificationTask, 'category' | 'title'>) {
  if (task.category === 'cash') return 'Пора пересчитать кассу';
  if (task.category === 'opening') return 'Откройте смену ККМ';
  if (task.category === 'closing') return 'Закройте смену ККМ';
  if (task.category === 'acquiring') return 'Проверьте операции терминала';
  if (task.category === 'credit') return 'Проверьте кредиты и рассрочки';
  if (task.category === 'handover') return 'Пора сдать смену';
  return task.title;
}

function notificationBody(task: Pick<NotificationTask, 'category' | 'title'>, kind: string) {
  const overdue = kind !== 'planned';
  if (task.category === 'cash') return overdue ? 'Проверка наличных просрочена. Пересчитайте кассу сейчас.' : 'Пересчитайте наличные и внесите фактический остаток.';
  if (task.category === 'opening') return overdue ? 'Открытие смены ККМ ещё не подтверждено.' : 'Откройте смену на кассе и подтвердите выполнение.';
  if (task.category === 'closing') return overdue ? 'Закрытие смены ККМ ещё не подтверждено.' : 'Закройте смену на кассе и подтвердите выполнение.';
  if (task.category === 'acquiring') return overdue ? 'Проверка операций терминала просрочена.' : 'Проверьте новые операции после предыдущей проверки.';
  if (task.category === 'credit') return overdue ? 'Проверка кредитов и рассрочек просрочена.' : 'Проверьте операции кредитов и рассрочек.';
  if (task.category === 'handover') return overdue ? 'Смена ещё не сдана.' : 'Выполните итоговые действия и сдайте смену.';
  return overdue ? `Задание просрочено: ${task.title}` : `Пора выполнить: ${task.title}`;
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
      userId: task.userId,
      taskId: task.id,
      fingerprint: `task:${task.id}:${entry.kind}`,
      kind: entry.kind,
      title: notificationTitle(task),
      body: notificationBody(task, entry.kind),
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

function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? '';
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim() || 'mailto:admin@offonika.ru';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function dispatchDueWorkdayNotifications(now = new Date()) {
  const due = await prisma.workdayNotification.findMany({
    where: { status: 'pending', scheduledAt: { lte: now } },
    include: {
      task: { include: { run: { select: { status: true } } } },
      issue: true,
      user: { include: { pushSubscriptions: { where: { disabledAt: null } } } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 200,
  });
  const pushConfigured = configureWebPush();
  const results: Array<{ id: number; status: string }> = [];

  for (const notification of due) {
    const taskFinished = notification.task && (notification.task.status === 'done' || notification.task.status === 'missed' || notification.task.run.status !== 'active');
    const issueFinished = notification.issue && notification.issue.status !== 'open';
    if (taskFinished || issueFinished) {
      await prisma.workdayNotification.update({ where: { id: notification.id }, data: { status: 'cancelled' } });
      results.push({ id: notification.id, status: 'cancelled' });
      continue;
    }

    let lastError = '';
    if (pushConfigured) {
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        url: '/employee',
        notificationId: notification.id,
      });
      for (const subscription of notification.user.pushSubscriptions) {
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
