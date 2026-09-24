export const ADMIN_INBOX_PUSH_MAX_EVENT_AGE_MS = 30 * 60 * 1000;
export const ADMIN_INBOX_TECHNICAL_DEDUPE_MS = 2 * 60 * 60 * 1000;

const STANDARD_HOURS_EVENT_TYPES = [
  'expense_request.created',
  'procurement.payment_submitted',
  'workday_issue.employee_action',
  'workday_issue.employee_message',
  'terminal_fiscal_review.employee_action',
  'terminal_fiscal_review.employee_message',
  'dependency.down',
  'infrastructure.down',
] as const;

const SHIFT_CLOSE_EVENT_TYPES = [
  'workday.close_exception_requested',
  'workday.cash_encashment_exception_requested',
  'workday.cash_operation_failed',
  'workday.kkm_shift_close_attention',
] as const;

export const ADMIN_INBOX_WEB_PUSH_EVENT_TYPES = [
  ...STANDARD_HOURS_EVENT_TYPES,
  ...SHIFT_CLOSE_EVENT_TYPES,
] as const;

const STANDARD_HOURS_EVENT_TYPE_SET = new Set<string>(STANDARD_HOURS_EVENT_TYPES);
const SHIFT_CLOSE_EVENT_TYPE_SET = new Set<string>(SHIFT_CLOSE_EVENT_TYPES);
const TECHNICAL_DOWN_EVENT_TYPE_SET = new Set<string>([
  'dependency.down',
  'infrastructure.down',
]);

function moscowMinutesSinceMidnight(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export function getAdminInboxPushEventCutoff(now: Date) {
  return new Date(now.getTime() - ADMIN_INBOX_PUSH_MAX_EVENT_AGE_MS);
}

export function eligibleAdminInboxWebPushTypes(now: Date): string[] {
  const minutes = moscowMinutesSinceMidnight(now);
  if (minutes >= 9 * 60 && minutes < 22 * 60) {
    return [...ADMIN_INBOX_WEB_PUSH_EVENT_TYPES];
  }
  if (minutes >= 22 * 60 && minutes < 23 * 60) {
    return [...SHIFT_CLOSE_EVENT_TYPES];
  }
  return [];
}

export function isTechnicalAdminInboxDownEvent(type: string) {
  return TECHNICAL_DOWN_EVENT_TYPE_SET.has(type);
}

export function isAdminInboxWebPushEligible(input: {
  type: string;
  eventCreatedAt: Date;
  now: Date;
}) {
  const minutes = moscowMinutesSinceMidnight(input.now);
  const freshEnough = input.eventCreatedAt >= getAdminInboxPushEventCutoff(input.now)
    && input.eventCreatedAt <= input.now;
  if (!freshEnough) return false;
  if (SHIFT_CLOSE_EVENT_TYPE_SET.has(input.type)) {
    return minutes >= 9 * 60 && minutes < 23 * 60;
  }
  if (STANDARD_HOURS_EVENT_TYPE_SET.has(input.type)) {
    return minutes >= 9 * 60 && minutes < 22 * 60;
  }
  return false;
}

export function subscriptionExistedWhenAdminInboxEventWasCreated(input: {
  subscriptionCreatedAt: Date;
  eventCreatedAt: Date;
}) {
  return input.subscriptionCreatedAt <= input.eventCreatedAt;
}
