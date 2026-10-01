import { cashNoticeBase, cashMorningKey } from './procurement-morning-policy';

export type WorkdayNotificationThreadTarget = {
  id: number;
  kind?: string;
  fingerprint?: string;
  taskId?: number | null;
  issueId?: number | null;
  reviewId?: string | null;
};

export function workdayNotificationThreadKey(notification: WorkdayNotificationThreadTarget) {
  if (notification.issueId) return `issue:${notification.issueId}`;
  if (notification.reviewId) return `review:${notification.reviewId}`;
  if (notification.taskId) return `task:${notification.taskId}`;
  const cash = cashNoticeBase(notification);
  if (cash) return `cash:${cash}`;
  return `notification:${notification.id}`;
}

export function workdayNotificationThreadWhere(notification: WorkdayNotificationThreadTarget) {
  if (notification.issueId) return { issueId: notification.issueId };
  if (notification.reviewId) return { reviewId: notification.reviewId };
  if (notification.taskId) return { taskId: notification.taskId };
  const cash = cashNoticeBase(notification);
  // Reading the evening message must not pre-read tomorrow's pending reminder.
  if (cash) return { kind: notification.kind, fingerprint: { in: [cash, cashMorningKey(cash)] }, status: 'sent' };
  return { id: notification.id };
}
