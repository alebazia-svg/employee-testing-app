import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveAdminInboxReadAt } from '../lib/admin-inbox-read-policy';

const occurredAt = new Date('2026-09-26T09:00:00.000Z');

function readAt(overrides: Partial<Parameters<typeof effectiveAdminInboxReadAt>[0]> = {}) {
  return effectiveAdminInboxReadAt({
    storedReadAt: null,
    occurredAt,
    eventId: 'event-1',
    eventType: 'expense_request.created',
    lifecycleManaged: false,
    sourceActive: true,
    ...overrides,
  });
}

test('informational payment updates stay in history without raising the unread badge', () => {
  assert.equal(readAt({ eventType: 'procurement.payment_updated' }), occurredAt);
});

test('technical recovery resolves itself and the earlier outage', () => {
  assert.equal(readAt({
    eventId: 'recovered',
    eventType: 'dependency.recovered',
    latestTechnicalEventId: 'recovered',
  }), occurredAt);
  assert.equal(readAt({
    eventId: 'down',
    eventType: 'dependency.down',
    latestTechnicalEventId: 'recovered',
  }), occurredAt);
});

test('only the latest active technical outage remains unread', () => {
  assert.equal(readAt({
    eventId: 'latest-down',
    eventType: 'infrastructure.down',
    latestTechnicalEventId: 'latest-down',
  }), null);
  assert.equal(readAt({
    eventId: 'old-down',
    eventType: 'infrastructure.down',
    latestTechnicalEventId: 'latest-down',
  }), occurredAt);
});

test('stored read state and resolved business lifecycles keep their existing behavior', () => {
  const storedReadAt = new Date('2026-09-26T10:00:00.000Z');
  assert.equal(readAt({ storedReadAt }), storedReadAt);
  assert.equal(readAt({ lifecycleManaged: true, sourceActive: false }), occurredAt);
  assert.equal(readAt({ lifecycleManaged: true, sourceActive: true }), null);
});
