import test from 'node:test';
import assert from 'node:assert/strict';
import { employeePushNotBefore, employeePushTtl, DELIVERY_PUSH_COPY } from '../lib/employee-push-policy';
import { planWorkdayPushDelivery } from '../lib/workday-push-delivery';

test('Moscow quiet boundary: 22:00 inclusive, 08:30 exclusive; midnight/month/year rollover', () => {
  for (const [input, expected] of [
    ['2026-09-29T18:59:59Z', '2026-09-29T18:59:59Z'],
    ['2026-09-29T19:00:00Z', '2026-09-30T05:30:00Z'],
    ['2026-09-29T23:00:00Z', '2026-09-30T05:30:00Z'],
    ['2026-09-30T05:29:59Z', '2026-09-30T05:30:00Z'],
    ['2026-09-30T05:30:00Z', '2026-09-30T05:30:00Z'],
    ['2026-09-30T19:00:00Z', '2026-10-01T05:30:00Z'],
    ['2026-12-31T19:00:00Z', '2027-01-01T05:30:00Z'],
  ]) assert.equal(employeePushNotBefore(new Date(input)).toISOString(), new Date(expected).toISOString());
});
test('offline push lives until tonight, never contains a stale instruction to collect cash', () => {
  assert.equal(employeePushTtl(new Date('2026-09-29T05:30:00Z')), 48600);
  assert.equal(employeePushTtl(new Date('2026-09-29T18:59:59Z')), 1);
  assert.equal(employeePushTtl(new Date('2026-09-29T19:00:00Z')), 0);
  assert.equal(employeePushTtl(new Date('2026-09-29T02:00:00Z')), 0);
  assert.doesNotMatch(JSON.stringify(DELIVERY_PUSH_COPY), /Можно получить|\d|Чеченова/);
});
test('network/configuration/no-subscription retries crossing 22:00 wait until morning', () => {
  const base = { now: new Date('2026-09-29T18:59:30Z'), attemptNumber: 1, configured: true,
    targetAlreadyUnread: false, subscriptionCount: 1, deliveredCount: 0, transientFailureCount: 1, permanentFailureCount: 0 };
  for (const patch of [{}, { configured: false }, { subscriptionCount: 0 }, { transientFailureCount: 0, permanentFailureCount: 1 }]) {
    assert.equal(planWorkdayPushDelivery({ ...base, ...patch }).nextAttemptAt?.toISOString(), '2026-09-30T05:30:00.000Z');
  }
});
