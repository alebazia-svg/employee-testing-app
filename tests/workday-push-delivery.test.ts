import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_WORKDAY_PUSH_ATTEMPTS, planWorkdayPushDelivery, suppressUnreadWorkdayPush } from '../lib/workday-push-delivery';

const now = new Date('2026-08-26T09:00:00.000Z');

test('scheduled handover pushes bypass unread suppression, including early finish', () => {
  for (const kind of ['planned', 'overdue', 'overdue_repeat', 'early_finish_reminder']) {
    const suppressed = suppressUnreadWorkdayPush({
      targetAlreadyUnread: true, kind,
      task: { category: 'handover', status: 'pending', run: { status: 'active' } },
    });
    assert.equal(suppressed, false);
    assert.equal(plan({ targetAlreadyUnread: suppressed, deliveredCount: 1 }).status, 'delivered');
  }
});

test('other notifications retain unread suppression', () => {
  for (const category of ['cash', 'opening', 'credit', 'closing']) {
    assert.equal(suppressUnreadWorkdayPush({
      targetAlreadyUnread: true, kind: 'overdue_repeat',
      task: { category, status: 'pending', run: { status: 'active' } },
    }), true);
  }
  assert.equal(suppressUnreadWorkdayPush({ targetAlreadyUnread: true, kind: 'issue_detected', task: null }), true);
  assert.equal(suppressUnreadWorkdayPush({ targetAlreadyUnread: false, kind: 'issue_detected', task: null }), false);
});

function plan(overrides: Partial<Parameters<typeof planWorkdayPushDelivery>[0]> = {}) {
  return planWorkdayPushDelivery({
    now,
    attemptNumber: 1,
    configured: true,
    targetAlreadyUnread: false,
    subscriptionCount: 1,
    deliveredCount: 0,
    transientFailureCount: 0,
    permanentFailureCount: 0,
    ...overrides,
  });
}

test('portal publication remains separate from successful push delivery', () => {
  assert.deepEqual(plan({ deliveredCount: 1 }), {
    status: 'delivered',
    nextAttemptAt: null,
    lastErrorCode: '',
  });
  assert.deepEqual(plan({ configured: false }), {
    status: 'not_configured',
    nextAttemptAt: new Date('2026-08-26T09:15:00.000Z'),
    lastErrorCode: 'WEB_PUSH_NOT_CONFIGURED',
  });
  assert.deepEqual(plan({ subscriptionCount: 0 }), {
    status: 'no_subscription',
    nextAttemptAt: new Date('2026-08-26T09:30:00.000Z'),
    lastErrorCode: 'WEB_PUSH_NO_SUBSCRIPTION',
  });
});

test('transient failures retry with backoff and stop after the limit', () => {
  assert.deepEqual(plan({ attemptNumber: 2, transientFailureCount: 1, lastErrorCode: 'WEB_PUSH_503' }), {
    status: 'retry_pending',
    nextAttemptAt: new Date('2026-08-26T09:05:00.000Z'),
    lastErrorCode: 'WEB_PUSH_503',
  });
  assert.deepEqual(plan({ attemptNumber: MAX_WORKDAY_PUSH_ATTEMPTS, transientFailureCount: 1 }), {
    status: 'failed',
    nextAttemptAt: null,
    lastErrorCode: 'WEB_PUSH_DELIVERY_FAILED',
  });
});

test('expired subscriptions and duplicate targets are explicit non-delivery outcomes', () => {
  assert.deepEqual(plan({ permanentFailureCount: 1, lastErrorCode: 'WEB_PUSH_410' }), {
    status: 'no_subscription',
    nextAttemptAt: new Date('2026-08-26T09:30:00.000Z'),
    lastErrorCode: 'WEB_PUSH_410',
  });
  assert.deepEqual(plan({ targetAlreadyUnread: true }), {
    status: 'suppressed_duplicate',
    nextAttemptAt: null,
    lastErrorCode: '',
  });
});
