/**
 * A phone marked as the owner's (PortalAccessBrowserOwner) that is signed in
 * as an employee for an inspection must not receive that employee's pushes.
 * Pure helper: the caller loads owner browsers and the subscription sessions.
 */
export type OwnerBrowser = { browserInstanceId: string; ownerUserId: number };
export type SubscriptionWithSessions = { userId: number; accessSessions?: Array<{ browserInstanceId: string | null }> };

export function ownerInspectionBrowserMap(owners: OwnerBrowser[]) {
  return new Map(owners.map((owner) => [owner.browserInstanceId, owner.ownerUserId]));
}

export function isOwnerInspectionSubscription(subscription: SubscriptionWithSessions, owners: Map<string, number>) {
  return (subscription.accessSessions ?? []).some((session) => {
    if (!session.browserInstanceId) return false;
    const ownerUserId = owners.get(session.browserInstanceId);
    return ownerUserId !== undefined && ownerUserId !== subscription.userId;
  });
}

export function withoutOwnerInspectionSubscriptions<T extends SubscriptionWithSessions>(subscriptions: T[], owners: Map<string, number>) {
  return subscriptions.filter((subscription) => !isOwnerInspectionSubscription(subscription, owners));
}

export function isOwnerInspectionBrowser(browserInstanceId: string | undefined | null, userId: number, owners: Map<string, number>) {
  if (!browserInstanceId) return false;
  const ownerUserId = owners.get(browserInstanceId);
  return ownerUserId !== undefined && ownerUserId !== userId;
}
