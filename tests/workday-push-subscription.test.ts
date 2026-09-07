import assert from 'node:assert/strict';
import test from 'node:test';
import { suppressPushBacklogOnNewSubscription } from '../lib/workday-push-subscription';

test('a new push subscription publishes old reminders in-app without pushing the backlog', async () => {
  const calls: unknown[] = [];
  const db = { workdayNotification: { updateMany: async (args: unknown) => { calls.push(args); return { count: 3 }; } } };
  const subscribedAt = new Date('2026-09-07T17:24:00.000Z');

  const result = await suppressPushBacklogOnNewSubscription(db as never, 5, subscribedAt);

  assert.deepEqual(result, { count: 3 });
  assert.deepEqual(calls, [{
    where: {
      userId: 5,
      scheduledAt: { lte: subscribedAt },
      OR: [
        { status: 'pending' },
        { status: 'sent', readAt: null, pushStatus: { in: ['no_subscription', 'not_configured', 'retry_pending'] } },
      ],
    },
    data: {
      status: 'sent',
      sentAt: subscribedAt,
      pushStatus: 'suppressed_duplicate',
      nextPushAttemptAt: null,
      lastError: '',
    },
  }]);
});
