import 'server-only';
import { freshEvidence } from './procurement-plan-revision-server';

// One in-flight read for payment closure and cash invitations. TTL starts after
// the remote read completes, so a slow 1C response cannot multiply requests.
let cached: { until: number; value: Promise<Awaited<ReturnType<typeof freshEvidence>> | null> } | null = null;
export function procurementNotificationEvidence() {
  if (cached && cached.until > Date.now()) return cached.value;
  const value = freshEvidence().catch(() => null).finally(() => {
    if (cached?.value === value) cached.until = Date.now() + 5000;
  });
  cached = { until: Infinity, value };
  return value;
}
