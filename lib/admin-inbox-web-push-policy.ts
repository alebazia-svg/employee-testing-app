export const ADMIN_INBOX_PUSH_MAX_EVENT_AGE_MS = 30 * 60 * 1000;
export const RECEIPT_PUSH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const RECEIPT_PUSH_TYPE = 'procurement.receipt_added';
export const ADMIN_INBOX_TECHNICAL_DEDUPE_MS = 2 * 60 * 60 * 1000;

const STANDARD_HOURS_EVENT_TYPES = [
  'fiscal_manager.attention',
  'terminal_fiscal_review.help_requested',
  'procurement.delivery_requested',
  'expense_request.created',
  'procurement.payment_submitted',
  'workday_issue.employee_action',
  'workday_issue.employee_message',
  'terminal_fiscal_review.created',
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
  const receipts=minutes>=8*60+30 && minutes<22*60?[RECEIPT_PUSH_TYPE]:[];
  if (minutes >= 9 * 60 && minutes < 22 * 60) {
    return [...ADMIN_INBOX_WEB_PUSH_EVENT_TYPES,...receipts];
  }
  if (minutes >= 22 * 60 && minutes < 23 * 60) {
    return [...SHIFT_CLOSE_EVENT_TYPES];
  }
  return receipts;
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
  if(input.type===RECEIPT_PUSH_TYPE) return minutes>=8*60+30 && minutes<22*60
    && input.eventCreatedAt<=input.now && input.eventCreatedAt.getTime()>=input.now.getTime()-RECEIPT_PUSH_MAX_AGE_MS;
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

export function adminInboxWebPushPayload(input: {
  title: string;
  body: string;
  url: string;
  notificationId: string;
  badgeCount: number;
  renotify?: boolean;
}) {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    notificationId: input.notificationId,
    tagPrefix: 'admin',
    ...(input.renotify ? { renotify: true } : {}),
    badgeCount: Math.max(0, Math.floor(input.badgeCount)),
  });
}
