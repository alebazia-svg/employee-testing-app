import 'server-only';
import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { accessBrowserCookie, validAccessBrowserId } from './portal-access-identity';
import { accessSessionIdentity } from './portal-access-journal';
import { sessionCookieName } from './session';

/** Called inside the subscription transaction. Never infer a device from IP/UA
 * or move a session to a new browser. A missing journal row is not a push error. */
export async function syncSubscribedAccess(tx: Prisma.TransactionClient, userId: number,
  subscription: { id: number; userId: number; disabledAt: Date | null }) {
  const jar = await cookies();
  const browserId = jar.get(accessBrowserCookie)?.value;
  const now = new Date();
  const identity = accessSessionIdentity(jar.get(sessionCookieName)?.value, userId, now);
  if (!identity || !validAccessBrowserId(browserId) || subscription.userId !== userId) return false;
  const result = await tx.portalAccessSession.updateMany({
    where: { sessionHash: identity.sessionHash, userId, browserInstanceId: browserId,
      OR: [{ observedBrowserId: null }, { observedBrowserId: browserId }],
      loggedOutAt: null, expiresAt: { gt: now } },
    data: { pushState: subscription.disabledAt ? 'not_connected' : 'connected',
      pushSubscriptionId: subscription.id, pushCheckedAt: now, lastSeenAt: now },
  });
  // Advancing lastSeenAt also prevents an in-flight older heartbeat from
  // overwriting this confirmation (journal writes use optimistic concurrency).
  return result.count === 1;
}
