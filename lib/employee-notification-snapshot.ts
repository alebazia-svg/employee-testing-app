import { employeeReplyMessageId, employeeReplyCopy } from './employee-reply-author';
import 'server-only';
import { loadEmployeeExpenseRouting } from './employee-expense-routing-snapshot';
import { expenseRouteKey, expenseRouteCopy } from './employee-expense-routing';
import { EMPLOYEE_EXPENSE_KIND } from './employee-expense-policy';
import { prisma } from '@/lib/prisma';
import { workdayIssueView } from '@/lib/workday-control-issue-view';
import { filterActiveWorkdayNotifications, reconcileActiveWorkdayNotifications, workdayNotificationHref, workdayTaskNotificationCopy } from '@/lib/workday-notifications';
import { workdayNotificationThreadKey } from '@/lib/workday-notification-thread';
import { cashNoticeBase } from '@/lib/procurement-morning-policy';
import { currentDeliveryPush, DELIVERY_READY_KIND } from '@/lib/procurement-delivery-notifications';
import { DELIVERY_PUSH_COPY } from '@/lib/employee-push-policy';
import { COLLECTION_READY_KIND, COLLECTION_PUSH_COPY, currentCollectionPushes } from '@/lib/procurement-collection-notifications';
import { CASH_ISSUE_KIND, CASH_ISSUE_PUSH_COPY, cashIssueForUser } from '@/lib/procurement-cash-issue-policy';
import { currentCashIssue } from '@/lib/procurement-cash-issue-notifications';
import { loadScheduleNearReminders } from './work-schedule-notifications';
import { SCHEDULE_NEAR_KIND, scheduleCalendarHref } from './schedule-near-reminder';

export async function loadEmployeeNotifications(user: { id: number }, readOnly = false) {
  const rows = await prisma.workdayNotification.findMany({
    where: { userId: user.id, sentAt: { not: null }, OR: [
      { status: 'sent', readAt: null },
      { status: { in: ['sent', 'cancelled'] }, sentAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    ] },
    take: 200,
    orderBy: { sentAt: 'desc' },
    select: {
      id: true,
      status: true,
      kind: true,
      fingerprint: true,
      title: true,
      body: true,
      sentAt: true,
      readAt: true,
      taskId: true,
      issueId: true,
      reviewId: true,
      task: { select: { status: true, category: true, title: true, run: { select: { status: true } } } },
      issue: { select: { status: true, employeeActionRequired: true, ruleKey: true, title: true, detail: true, sourceData: true } },
      review: { select: { status: true } },
    },
  });
  const replyRows = rows.map(row => ({ row, messageId: employeeReplyMessageId(row) })).filter(item => item.messageId);
  const issueMessageIds = replyRows.filter(item => item.row.kind === 'workday_issue_reply').map(item => item.messageId!);
  const reviewMessageIds = replyRows.filter(item => item.row.kind === 'terminal_fiscal_review_reply').map(item => item.messageId!);
  const [issueMessages, reviewMessages] = await Promise.all([
    issueMessageIds.length ? prisma.workdayControlIssueMessage.findMany({where:{id:{in:issueMessageIds},issueId:{in:replyRows.flatMap(item=>item.row.issueId?[item.row.issueId]:[])},author:{role:'ADMIN'}},select:{id:true,issueId:true,body:true,author:{select:{name:true,payrollName:true}}}}) : [],
    reviewMessageIds.length ? prisma.terminalFiscalReviewMessage.findMany({where:{id:{in:reviewMessageIds},reviewId:{in:replyRows.flatMap(item=>item.row.reviewId?[item.row.reviewId]:[])},author:{role:'ADMIN'}},select:{id:true,reviewId:true,body:true,author:{select:{name:true,payrollName:true}}}}) : [],
  ]);
  const seenTargets = new Set<string>();
  const activeRows = await (readOnly ? filterActiveWorkdayNotifications : reconcileActiveWorkdayNotifications)(prisma, rows.filter(row => row.status === 'sent'));
  const activeIds = new Set(activeRows.map(row => row.id));
  const scheduleNear = activeRows.some(row=>row.kind===SCHEDULE_NEAR_KIND) ? (await loadScheduleNearReminders(prisma,[user.id])).get(user.id) : null;
  const expenses = activeRows.some(row => row.kind === EMPLOYEE_EXPENSE_KIND) ? await loadEmployeeExpenseRouting(user.id) : null;
  if (expenses && expenses.state !== 'unavailable') {
    const keys = new Set(expenses.items.map(expenseRouteKey));
    for (const row of rows) if (row.kind === EMPLOYEE_EXPENSE_KIND && !keys.has(row.fingerprint) && !expenses.unavailableRefs.includes(row.fingerprint.split(':')[3])) activeIds.delete(row.id);
  }
  const delivery = activeRows.some(row => row.kind === DELIVERY_READY_KIND) ? await currentDeliveryPush() : null;
  const collections = activeRows.some(row => row.kind === COLLECTION_READY_KIND) ? await currentCollectionPushes() : null;
  const cashIssue = activeRows.some(row => row.kind === CASH_ISSUE_KIND) ? await currentCashIssue() : null;
  const notifications = [...rows].sort((a,b) => Number(activeIds.has(b.id)) - Number(activeIds.has(a.id)))
    .filter((notification) => {
      const reply = notification.kind.endsWith('_reply');
      const target = reply ? `reply:${notification.id}` : notification.taskId ? `task:${notification.taskId}` : notification.issueId ? `issue:${notification.issueId}` : notification.reviewId ? `review:${notification.reviewId}` : workdayNotificationThreadKey(notification);
      if (seenTargets.has(target)) return false;
      seenTargets.add(target);
      return true;
    })
    .map(({ task, issue, review: _review, ...notification }) => {
      const messageId = employeeReplyMessageId(notification);
      const message = notification.kind === 'workday_issue_reply' ? issueMessages.find(m=>m.id===messageId&&m.issueId===notification.issueId) : reviewMessages.find(m=>m.id===messageId&&m.reviewId===notification.reviewId);
      const replyCopy = ['workday_issue_reply','terminal_fiscal_review_reply'].includes(notification.kind) ? employeeReplyCopy(notification.kind, message) : null;
      const scheduleCopy = notification.kind===SCHEDULE_NEAR_KIND && activeIds.has(notification.id) ? scheduleNear : null;
      const issueView = issue && !notification.kind.endsWith('_reply') ? workdayIssueView(issue) : null;
      const taskCopy = task ? workdayTaskNotificationCopy(task, notification.kind) : null;
      const deliveryCopy = notification.kind === DELIVERY_READY_KIND && delivery?.state === 'ready'
        && delivery.fingerprint === (cashNoticeBase(notification) ?? notification.fingerprint) && delivery.userId === user.id ? delivery : null;
      const collectionCopy = collections?.state === 'ready' ? collections.notices.find(n => n.userId === user.id && n.fingerprint === (cashNoticeBase(notification) ?? notification.fingerprint)) : null;
      const ownIssue = cashIssue ? cashIssueForUser(cashIssue, user.id) : null;
      const issueCopy = ownIssue?.fingerprint === notification.fingerprint ? ownIssue : null;
      const expenseItems = expenses?.items.filter(item => item.ref === notification.fingerprint.split(':')[3]) ?? [];
      const copy = notification.kind === EMPLOYEE_EXPENSE_KIND && expenseItems.length ? expenseRouteCopy(expenseItems) : notification.kind === CASH_ISSUE_KIND ? issueCopy ?? { ...CASH_ISSUE_PUSH_COPY, body: 'Статус выдачи уточняется. Откройте заявку перед выдачей денег.' }
        : notification.kind === DELIVERY_READY_KIND ? deliveryCopy ?? DELIVERY_PUSH_COPY
        : notification.kind === COLLECTION_READY_KIND ? collectionCopy ?? COLLECTION_PUSH_COPY : null;
      return {
        ...notification,
        active: activeIds.has(notification.id),
        ...(issue ? { attentionKind: issue.ruleKey === 'kkm_shift_not_closed' ? 'closing' as const : 'receipt' as const } : {}),
        title: replyCopy?.title || (notification.kind === 'workday_closed_by_admin' ? 'Смена завершена' : '') || (activeIds.has(notification.id) ? scheduleCopy?.title || copy?.title || issueView?.summaryTitle || taskCopy?.title || notification.title : notification.title),
        body: replyCopy?.body || (activeIds.has(notification.id) ? scheduleCopy?.body || copy?.body || issueView?.notificationBody || taskCopy?.body || notification.body : notification.body).replace(/^Администратор завершил рабочий день за (\d{4}-\d{2}-\d{2})\./u, 'Смена за $1 завершена.'),
        href: scheduleCopy?.active ? scheduleCalendarHref(scheduleCopy.missing[0]) : workdayNotificationHref(notification),
      };
    })
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))
    .slice(0, 100);
  return { notifications };
}
