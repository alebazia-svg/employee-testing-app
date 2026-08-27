export type WorkdayNotificationThreadTarget = {
  id: number;
  taskId?: number | null;
  issueId?: number | null;
  reviewId?: string | null;
};

export function workdayNotificationThreadKey(notification: WorkdayNotificationThreadTarget) {
  if (notification.issueId) return `issue:${notification.issueId}`;
  if (notification.reviewId) return `review:${notification.reviewId}`;
  if (notification.taskId) return `task:${notification.taskId}`;
  return `notification:${notification.id}`;
}

export function workdayNotificationThreadWhere(notification: WorkdayNotificationThreadTarget) {
  if (notification.issueId) return { issueId: notification.issueId };
  if (notification.reviewId) return { reviewId: notification.reviewId };
  if (notification.taskId) return { taskId: notification.taskId };
  return { id: notification.id };
}
