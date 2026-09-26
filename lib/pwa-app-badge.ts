export type AppBadgeNavigator = {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export async function syncPwaAppBadge(
  count: number,
  target?: AppBadgeNavigator,
) {
  const badgeTarget = target ?? (
    typeof navigator === 'undefined' ? undefined : navigator as AppBadgeNavigator
  );
  if (!badgeTarget) return;

  const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  try {
    if (normalizedCount > 0) {
      await badgeTarget.setAppBadge?.(normalizedCount);
    } else if (badgeTarget.clearAppBadge) {
      await badgeTarget.clearAppBadge();
    } else {
      await badgeTarget.setAppBadge?.(0);
    }
  } catch {
    // App badges are an optional browser capability and must never block the UI.
  }
}
