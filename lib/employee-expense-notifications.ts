import 'server-only';
import { prisma } from './prisma';
import { loadExpenseRouting, loadEmployeeExpenseRouting } from './employee-expense-routing-snapshot';
import { expenseRouteKey, expenseRouteCopy, adminExpenseRouteKey, adminExpenseRouteCopy, ADMIN_EXPENSE_ISSUE_SOURCE } from './employee-expense-routing';
import { EMPLOYEE_EXPENSE_KIND } from './employee-expense-policy';
import { employeePushNotBefore } from './employee-push-policy';

export async function expensePushDecision(notification: { fingerprint: string; userId: number }, now = new Date()) {
  const snapshot = await loadEmployeeExpenseRouting(notification.userId, now);
  if (!snapshot.employees.some(e => e.id === notification.userId)) return { state: 'cancel' as const };
  if (snapshot.state === 'unavailable' || snapshot.unavailableRefs.includes(notification.fingerprint.split(':')[3])) return { state: 'defer' as const, until: new Date(+now + 60000) };
  const item = snapshot.items.find(item => expenseRouteKey(item) === notification.fingerprint);
  if (!item) return { state: 'cancel' as const };
  if (!item.onShift) return { state: 'defer' as const, until: new Date(+now + 60000) };
  const until = employeePushNotBefore(now);
  if (until > now) return { state: 'defer' as const, until };
  return { state: 'send' as const, ...expenseRouteCopy(snapshot.items.filter(i => i.ref === item.ref && i.onShift)) };
}
/** One notice per recipient/cashbox/approval cycle. Reading never confirms issuance. */
export async function queueEmployeeExpensePushes(now = new Date()) {
  let snapshot = await loadExpenseRouting(now);
  if (snapshot.state === 'unavailable') return;
  // Durable assignment: once ADMIN receives a part, a later start must not
  // instruct an employee to issue the same money. One key per part/approval cycle.
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106259)`;
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
    for (const item of snapshot.adminItems) {
      const request = await tx.expenseRequestAdminCase.findUnique({ where: { oneCRequestRef: item.ref }, select: { id: true } });
      if (!request) continue;
      const event = await tx.adminInboxEvent.upsert({ where: { eventKey: adminExpenseRouteKey(item) }, update: {}, create: {
        eventKey: adminExpenseRouteKey(item), sourceType: ADMIN_EXPENSE_ISSUE_SOURCE, sourceId: adminExpenseRouteKey(item),
        type: 'expense_request.cash_issue', title: adminExpenseRouteCopy(item).title,
        body: [item.reason, item.cashbox, `Заявитель: ${item.applicant}`, `№ ${item.number}`].join('\n'),
        href: `/admin/expense-requests/${request.id}`, occurredAt: now,
      } });
      await tx.adminInboxReceipt.createMany({ data: admins.map(admin => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
    }
  });
  snapshot = await loadExpenseRouting(now);
  if (snapshot.state !== 'ready') return;
  // Include former recipients, so deactivation or reassignment retires their old notices.
  const old = await prisma.workdayNotification.findMany({ where: { kind: EMPLOYEE_EXPENSE_KIND, status: { not: 'cancelled' } }, select: { userId: true } });
  const userIds = [...new Set([...snapshot.employees.map(e => e.id), ...old.map(n => n.userId)])];
  for (const userId of userIds) {
    const items = snapshot.items.filter(item => item.userId === userId), keys = items.map(expenseRouteKey);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106258, ${userId}::integer)`;
      if (await tx.workdayNotification.findFirst({ where: { userId, kind: EMPLOYEE_EXPENSE_KIND, updatedAt: { gt: now } }, select: { id: true } })) return;
      await tx.workdayNotification.updateMany({ where: { userId, kind: EMPLOYEE_EXPENSE_KIND, status: { not: 'cancelled' },
        ...(keys.length ? { fingerprint: { notIn: keys } } : {}),
        ...(snapshot.unavailableRefs.length && snapshot.employees.some(e => e.id === userId) ? { NOT: snapshot.unavailableRefs.map(ref => ({ fingerprint: { contains: `:${ref}:` } })) } : {}),
      }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
      const scheduledAt = employeePushNotBefore(now);
      for (const item of items) {
        const copy = expenseRouteCopy(items.filter(i => i.ref === item.ref));
        const row = await tx.workdayNotification.upsert({ where: { fingerprint: expenseRouteKey(item) }, update: copy,
          create: { userId, kind: EMPLOYEE_EXPENSE_KIND, fingerprint: expenseRouteKey(item), ...copy, scheduledAt, nextPushAttemptAt: scheduledAt } });
        if (row.status === 'cancelled') await tx.workdayNotification.updateMany({ where: { id: row.id, status: 'cancelled' }, data: { status: 'pending', pushStatus: 'pending', readAt: null, sentAt: null, pushDeliveredAt: null, nextPushAttemptAt: scheduledAt, scheduledAt, attemptCount: 0, lastError: '' } });
      }
    });
  }
}
