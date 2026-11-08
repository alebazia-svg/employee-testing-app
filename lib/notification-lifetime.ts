/** Inbox lifetime, independent of reading and of push delivery limits. Unknown
 * kinds are deliberately not time-limited. Business-source reconciliation may
 * close any notification earlier when its requirement is no longer current. */
export const INFORMATIONAL_NOTIFICATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const EMPLOYEE_INFORMATIONAL_NOTIFICATION_KINDS = [
  'procurement_payment_approved',
  'procurement_payment_cancelled',
  'procurement_payment_updated',
  'procurement_receipt_added',
  'workday_closed_by_admin',
  'workday_shift_extension',
] as const;

export const EMPLOYEE_ACTION_NOTIFICATION_KINDS = [
  'procurement_payment_needs_changes',
  'procurement_qr_check',
  'procurement_cash_issue',
  'procurement_collection_ready',
  'procurement_delivery_ready',
  'employee_expense_payable',
  'schedule_fill_request',
  'schedule_replacement_request',
  'schedule_replacement_digest',
  'schedule_week_fill_request',
  'schedule_near_fill_request',
  'workday_end_reminder',
  'workday_close_exception_decision',
] as const;

type Notice = {
  kind?: string; fingerprint?: string;
  taskId?: number | null; issueId?: number | null; reviewId?: string | null;
  sentAt?: Date | string | null;
};

export function employeeNotificationRequiresAction(notice: Notice) {
  // Discussion messages retain their own read markers; the primary issue/review
  // notification carries the still-open task, not every reply in its thread.
  if (notice.kind?.endsWith('_reply')) return false;
  return Boolean(notice.taskId || notice.issueId || notice.reviewId)
    || (EMPLOYEE_ACTION_NOTIFICATION_KINDS as readonly string[]).includes(notice.kind ?? '');
}

export function informationalNotificationExpired(notice: Notice, now = new Date()) {
  // A source-linked task always wins over an informational kind.
  if (employeeNotificationRequiresAction(notice)) return false;
  const informational = (EMPLOYEE_INFORMATIONAL_NOTIFICATION_KINDS as readonly string[]).includes(notice.kind ?? '')
    || notice.kind === 'payroll_days_decision' && /^payroll-days:[^:]+:approved$/.test(notice.fingerprint ?? '');
  if (!informational) return false;
  // Start when the portal publishes the message, never when a queued push is
  // rescheduled or a retry is delivered. Unpublished rows have no lifetime yet.
  const value = notice.sentAt;
  const at = value instanceof Date ? value.getTime() : Date.parse(value ?? '');
  return Number.isFinite(at) && now.getTime() - at >= INFORMATIONAL_NOTIFICATION_LIFETIME_MS;
}
