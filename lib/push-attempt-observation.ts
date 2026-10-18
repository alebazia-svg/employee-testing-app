import 'server-only';
import { prisma } from './prisma';

export function pushFailureObservation(error: unknown) {
  const status = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
  return Number.isInteger(status) && status >= 400 && status <= 599
    ? { lastPushOutcome: 'rejected', lastPushErrorCode: `HTTP_${status}` }
    : { lastPushOutcome: 'failed', lastPushErrorCode: 'NETWORK_OR_PROVIDER_ERROR' };
}

/** Observe the actual send once. Never retry, change scheduling or turn an
 * accepted push into a failed delivery because optional diagnostics failed. */
export async function observePushAttempt<T>(subscription: { id: number; userId: number }, send: () => Promise<T>): Promise<T> {
  const attemptedAt = new Date();
  async function record(outcome: { lastPushOutcome: string; lastPushErrorCode: string | null }) {
    try {
      await prisma.$transaction(async tx => {
        // A contended subscription row must not stall the sender's normal work.
        await tx.$executeRaw`SET LOCAL lock_timeout = '400ms'`;
        return tx.workdayPushSubscription.updateMany({ where: {
        id: subscription.id, userId: subscription.userId,
        OR: [{ lastPushAttemptAt: null }, { lastPushAttemptAt: { lt: attemptedAt } }],
      }, data: { ...outcome, lastPushUserId: subscription.userId, lastPushAttemptAt: attemptedAt, lastPushResultAt: new Date() } });
      }, { maxWait: 250, timeout: 750 });
    } catch { /* No payload, endpoint, key or raw provider error in logs. */ }
  }
  let result: T;
  try { result = await send(); }
  catch (error) { await record(pushFailureObservation(error)); throw error; }
  await record({ lastPushOutcome: 'accepted', lastPushErrorCode: null });
  return result;
}
