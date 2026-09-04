import assert from 'node:assert/strict';
import test from 'node:test';
import { tbankPushEventId } from '../lib/tbank-cabinet-notification-policy';

const down = { id: 'incident', type: 'dependency.down', occurredAt: new Date('2026-09-03T20:00:00Z') };
test('night outage is deferred and remains eligible at nine Moscow', () => {
  assert.equal(tbankPushEventId(down, new Date('2026-09-03T20:10:00Z')), null);
  assert.equal(tbankPushEventId(down, new Date('2026-09-04T05:59:59Z')), null);
  assert.equal(tbankPushEventId(down, new Date('2026-09-04T06:00:00Z')), 'incident');
  assert.equal(tbankPushEventId(down, new Date('2026-09-04T19:00:00Z')), null);
});
test('recovered or absent incident never pushes, including in morning', () => {
  assert.equal(tbankPushEventId({ ...down, type: 'dependency.recovered' }, new Date('2026-09-04T06:00:00Z')), null);
  assert.equal(tbankPushEventId(null, new Date('2026-09-04T06:00:00Z')), null);
});
test('daytime outage waits five minutes after watchdog detects it', () => {
  const recent = { ...down, occurredAt: new Date('2026-09-04T07:00:00Z') };
  assert.equal(tbankPushEventId(recent, new Date('2026-09-04T07:04:59Z')), null);
  assert.equal(tbankPushEventId(recent, new Date('2026-09-04T07:05:00Z')), 'incident');
});
