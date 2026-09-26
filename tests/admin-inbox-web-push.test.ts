import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_INBOX_PUSH_MAX_EVENT_AGE_MS,
  adminInboxWebPushPayload,
  eligibleAdminInboxWebPushTypes,
  getAdminInboxPushEventCutoff,
  isAdminInboxWebPushEligible,
  isTechnicalAdminInboxDownEvent,
  subscriptionExistedWhenAdminInboxEventWasCreated,
} from '../lib/admin-inbox-web-push-policy';

test('admin push payload carries the current unread badge count', () => {
  assert.deepEqual(JSON.parse(adminInboxWebPushPayload({
    title: 'Новая заявка',
    body: 'Требуется решение',
    url: '/admin/inbox',
    notificationId: 'event-1',
    badgeCount: 4.9,
  })), {
    title: 'Новая заявка',
    body: 'Требуется решение',
    url: '/admin/inbox',
    notificationId: 'event-1',
    tagPrefix: 'admin',
    badgeCount: 4,
  });
});

test('admin web push only considers events created during the last thirty minutes', () => {
  const now = new Date('2026-08-29T18:40:00.000Z');
  assert.equal(ADMIN_INBOX_PUSH_MAX_EVENT_AGE_MS, 30 * 60 * 1000);
  assert.equal(getAdminInboxPushEventCutoff(now).toISOString(), '2026-08-29T18:10:00.000Z');
  assert.equal(isAdminInboxWebPushEligible({
    type: 'expense_request.created',
    eventCreatedAt: new Date('2026-08-29T18:09:59.999Z'),
    now,
  }), false);
});

test('ordinary business events use 09:00-22:00 Moscow quiet hours', () => {
  assert.equal(isAdminInboxWebPushEligible({
    type: 'expense_request.created', eventCreatedAt: new Date('2026-09-24T06:00:00.000Z'), now: new Date('2026-09-24T06:00:00.000Z'),
  }), true);
  assert.equal(isAdminInboxWebPushEligible({
    type: 'expense_request.created', eventCreatedAt: new Date('2026-09-24T18:59:00.000Z'), now: new Date('2026-09-24T18:59:00.000Z'),
  }), true);
  assert.equal(isAdminInboxWebPushEligible({
    type: 'expense_request.created', eventCreatedAt: new Date('2026-09-24T19:00:00.000Z'), now: new Date('2026-09-24T19:00:00.000Z'),
  }), false);
});

test('shift-closing blockers remain eligible until 23:00 Moscow', () => {
  assert.equal(isAdminInboxWebPushEligible({
    type: 'workday.close_exception_requested',
    eventCreatedAt: new Date('2026-09-24T19:30:00.000Z'),
    now: new Date('2026-09-24T19:30:00.000Z'),
  }), true);
  assert.equal(isAdminInboxWebPushEligible({
    type: 'workday.close_exception_requested',
    eventCreatedAt: new Date('2026-09-24T20:00:00.000Z'),
    now: new Date('2026-09-24T20:00:00.000Z'),
  }), false);
  assert.deepEqual(eligibleAdminInboxWebPushTypes(new Date('2026-09-24T21:00:00.000Z')), []);
});

test('recovery, expiry, update and routine review events stay inbox-only', () => {
  const types = eligibleAdminInboxWebPushTypes(new Date('2026-09-24T09:00:00.000Z'));
  assert.equal(types.includes('dependency.recovered'), false);
  assert.equal(types.includes('infrastructure.recovered'), false);
  assert.equal(types.includes('dependency.expiring'), false);
  assert.equal(types.includes('procurement.payment_updated'), false);
  assert.equal(types.includes('terminal_fiscal_review.created'), false);
  assert.equal(types.includes('work_schedule.coverage_gap'), false);
});

test('only sustained down event types receive technical push handling', () => {
  assert.equal(isTechnicalAdminInboxDownEvent('dependency.down'), true);
  assert.equal(isTechnicalAdminInboxDownEvent('infrastructure.down'), true);
  assert.equal(isTechnicalAdminInboxDownEvent('dependency.recovered'), false);
});

test('new subscriptions do not receive events created before the subscription', () => {
  const eventCreatedAt = new Date('2026-09-24T10:00:00.000Z');
  assert.equal(subscriptionExistedWhenAdminInboxEventWasCreated({
    subscriptionCreatedAt: new Date('2026-09-24T09:59:59.000Z'), eventCreatedAt,
  }), true);
  assert.equal(subscriptionExistedWhenAdminInboxEventWasCreated({
    subscriptionCreatedAt: new Date('2026-09-24T10:00:01.000Z'), eventCreatedAt,
  }), false);
});
