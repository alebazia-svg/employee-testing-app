import 'server-only';
import { currentCashIssue } from './procurement-cash-issue-notifications';
import { cashIssueForUser } from './procurement-cash-issue-policy';
import { prisma } from './prisma';
import { loadEmployeeExpenses } from './employee-expense-snapshot';
import { EMPLOYEE_EXPENSE_KIND, expenseNotificationKey } from './employee-expense-policy';
import { employeePushNotBefore } from './employee-push-policy';
import { getMoscowDateKey } from './workday';

export async function expensePushDecision(notification: { fingerprint: string; userId: number }, now = new Date()) {
  const snapshot = await loadEmployeeExpenses(notification.userId, now);
  if (snapshot.state === 'unavailable') return { state: 'defer' as const, until: new Date(+now + 60000) };
  if (snapshot.state !== 'ready' || !snapshot.payable.some(item => expenseNotificationKey(notification.userId, snapshot.cashboxRef, item) === notification.fingerprint)) return { state: 'cancel' as const };
  const shift = await prisma.workDayEntry.findFirst({ where: { userId: notification.userId, date: getMoscowDateKey(now), status: 'active', endedAt: null }, select: { id: true } });
  if (!shift) return { state: 'defer' as const, until: new Date(+now + 60000) };
  return { state: 'send' as const, title: 'Есть заявки к оплате', body: 'Оформите расходники в 1С.' };
}
/** One notice per approval cycle; reads do not acknowledge the financial work. */
export async function queueEmployeeExpensePushes(now = new Date()) {
  const nativeCash = await currentCashIssue(now);
  const users = await prisma.user.findMany({ where: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail', 'wholesale'] }, oneCCashboxMapping: { is: { isActive: true } } }, select: { id: true } });
  for (const user of users) {
    const snapshot = await loadEmployeeExpenses(user.id, now);
    if (snapshot.state === 'unavailable') continue;
    const handledRef = cashIssueForUser(nativeCash, user.id)?.request.ref;
    const keys = snapshot.payable.filter(item => item.ref !== handledRef).map(item => expenseNotificationKey(user.id, snapshot.cashboxRef, item));
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106258, ${user.id}::integer)`;
      // Do not let an older source read cancel a newer queue operation.
      if (await tx.workdayNotification.findFirst({ where: { userId: user.id, kind: EMPLOYEE_EXPENSE_KIND, updatedAt: { gt: now } }, select: { id: true } })) return;
      await tx.workdayNotification.updateMany({ where: { userId: user.id, kind: EMPLOYEE_EXPENSE_KIND, status: { not: 'cancelled' }, ...(keys.length ? { fingerprint: { notIn: keys } } : {}) }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
      const scheduledAt = employeePushNotBefore(now);
      for (const fingerprint of keys) {
        const row = await tx.workdayNotification.upsert({ where: { fingerprint }, update: {}, create: { userId: user.id, kind: EMPLOYEE_EXPENSE_KIND, fingerprint, title: 'Есть заявки к оплате', body: 'Оформите расходники в 1С.', scheduledAt, nextPushAttemptAt: scheduledAt } });
        if (row.status === 'cancelled') await tx.workdayNotification.updateMany({ where: { id: row.id, status: 'cancelled' }, data: { status: 'pending', pushStatus: 'pending', readAt: null, sentAt: null, pushDeliveredAt: null, nextPushAttemptAt: scheduledAt, scheduledAt, attemptCount: 0, lastError: '' } });
      }
    });
  }
}
