import { EMPLOYEE_EXPENSE_KIND } from './employee-expense-policy';
import { cashNoticeBase, cashMorningKey } from './procurement-morning-policy';
import {QR_CHECK_KIND,qrCheckPlan} from './procurement-qr-check-policy';

export type WorkdayNotificationThreadTarget = {
  id: number;
  kind?: string;
  fingerprint?: string;
  taskId?: number | null;
  issueId?: number | null;
  reviewId?: string | null;
};

export function workdayNotificationThreadKey(notification: WorkdayNotificationThreadTarget) {
  if(notification.kind===QR_CHECK_KIND&&qrCheckPlan(notification.fingerprint||''))return `qr-check:${qrCheckPlan(notification.fingerprint!)}`;
  if (notification.kind === EMPLOYEE_EXPENSE_KIND) return `expense:${notification.fingerprint?.split(':')[3] || notification.id}`;
  if (notification.issueId) return `issue:${notification.issueId}`;
  if (notification.reviewId) return `review:${notification.reviewId}`;
  if (notification.taskId) return `task:${notification.taskId}`;
  const cash = cashNoticeBase(notification);
  if (cash) return `cash:${cash}`;
  return `notification:${notification.id}`;
}

export function workdayNotificationThreadWhere(notification: WorkdayNotificationThreadTarget) {
  if(notification.kind===QR_CHECK_KIND&&qrCheckPlan(notification.fingerprint||''))return {kind:QR_CHECK_KIND,fingerprint:{startsWith:`procurement-qr-check:${qrCheckPlan(notification.fingerprint!)}:`},status:'sent'};
  if (notification.kind === EMPLOYEE_EXPENSE_KIND) return notification.fingerprint?.split(':')[3] ? { kind: EMPLOYEE_EXPENSE_KIND, fingerprint: { contains: `:${notification.fingerprint.split(':')[3]}:` }, status: 'sent' } : { id: notification.id };
  if (notification.issueId) return { issueId: notification.issueId };
  if (notification.reviewId) return { reviewId: notification.reviewId };
  if (notification.taskId) return { taskId: notification.taskId };
  const cash = cashNoticeBase(notification);
  // Reading the evening message must not pre-read tomorrow's pending reminder.
  if (cash) return { kind: notification.kind, fingerprint: { in: [cash, cashMorningKey(cash)] }, status: 'sent' };
  return { id: notification.id };
}
