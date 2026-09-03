export const MAX_WORKDAY_PUSH_ATTEMPTS = 5;

const RETRY_MINUTES = [1, 5, 15, 30, 60] as const;

export function suppressUnreadWorkdayPush(input: {
  targetAlreadyUnread: boolean;
  kind: string;
  task: { category: string; status: string; run: { status: string } } | null;
}) {
  const handoverReminder = input.task?.category === 'handover'
    && input.task.status === 'pending'
    && input.task.run.status === 'active'
    && ['planned', 'overdue', 'overdue_repeat', 'early_finish_reminder'].includes(input.kind);
  return input.targetAlreadyUnread && !handoverReminder;
}

export type WorkdayPushStatus =
  | 'pending'
  | 'delivered'
  | 'retry_pending'
  | 'no_subscription'
  | 'not_configured'
  | 'suppressed_duplicate'
  | 'failed'
  | 'cancelled'
  | 'legacy_unknown';

export function workdayPushRetryAt(now: Date, attemptNumber: number) {
  const retryIndex = Math.max(0, Math.min(RETRY_MINUTES.length - 1, attemptNumber - 1));
  return new Date(now.getTime() + RETRY_MINUTES[retryIndex] * 60_000);
}

export function planWorkdayPushDelivery(input: {
  now: Date;
  attemptNumber: number;
  configured: boolean;
  targetAlreadyUnread: boolean;
  subscriptionCount: number;
  deliveredCount: number;
  transientFailureCount: number;
  permanentFailureCount: number;
  lastErrorCode?: string;
}): { status: WorkdayPushStatus; nextAttemptAt: Date | null; lastErrorCode: string } {
  if (input.targetAlreadyUnread) {
    return { status: 'suppressed_duplicate', nextAttemptAt: null, lastErrorCode: '' };
  }
  if (!input.configured) {
    return {
      status: 'not_configured',
      nextAttemptAt: new Date(input.now.getTime() + 15 * 60_000),
      lastErrorCode: 'WEB_PUSH_NOT_CONFIGURED',
    };
  }
  if (input.subscriptionCount === 0) {
    return {
      status: 'no_subscription',
      nextAttemptAt: new Date(input.now.getTime() + 30 * 60_000),
      lastErrorCode: 'WEB_PUSH_NO_SUBSCRIPTION',
    };
  }
  if (input.deliveredCount > 0) {
    return {
      status: 'delivered',
      nextAttemptAt: null,
      lastErrorCode: input.transientFailureCount || input.permanentFailureCount ? 'WEB_PUSH_PARTIAL_DELIVERY' : '',
    };
  }
  if (input.transientFailureCount > 0 && input.attemptNumber < MAX_WORKDAY_PUSH_ATTEMPTS) {
    return {
      status: 'retry_pending',
      nextAttemptAt: workdayPushRetryAt(input.now, input.attemptNumber),
      lastErrorCode: input.lastErrorCode || 'WEB_PUSH_TRANSIENT_FAILURE',
    };
  }
  if (input.permanentFailureCount === input.subscriptionCount) {
    return {
      status: 'no_subscription',
      nextAttemptAt: new Date(input.now.getTime() + 30 * 60_000),
      lastErrorCode: input.lastErrorCode || 'WEB_PUSH_SUBSCRIPTION_EXPIRED',
    };
  }
  return {
    status: 'failed',
    nextAttemptAt: null,
    lastErrorCode: input.lastErrorCode || 'WEB_PUSH_DELIVERY_FAILED',
  };
}
