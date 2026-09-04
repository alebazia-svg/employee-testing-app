export const TBANK_NOTIFICATION_SOURCE = 'tbank_cabinet_operations';
export const TBANK_DOWN_PUSH_DELAY_MS = 5 * 60 * 1000;

// Freshness watchdog already waits ten minutes; allow another five minutes
// before waking the owner. Recovery and superseded incidents stay inbox-only.
export function tbankPushEventId(
  latest: { id: string; type: string; occurredAt: Date } | null,
  now: Date,
): string | null {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', hour: '2-digit', hourCycle: 'h23',
  }).format(now));
  if (hour < 9 || hour >= 22 || latest?.type !== 'dependency.down') return null;
  if (now.getTime() - latest.occurredAt.getTime() < TBANK_DOWN_PUSH_DELAY_MS) return null;
  return latest.id;
}
