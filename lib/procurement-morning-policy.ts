type Notice = { kind?: string; fingerprint?: string };
const OFFSET = 3 * 60 * 60 * 1000;
const SUFFIX = ':morning';

export function cashNoticeBase(n: Notice): string | null {
  const prefix = n.kind === 'procurement_collection_ready' ? 'procurement-collection:'
    : n.kind === 'procurement_delivery_ready' ? 'procurement-delivery-ready:' : null;
  if (!prefix || !n.fingerprint?.startsWith(prefix)) return null;
  return n.fingerprint.endsWith(SUFFIX) ? n.fingerprint.slice(0, -SUFFIX.length) : n.fingerprint;
}
export function isCashMorning(n: Notice) {
  const base = cashNoticeBase(n);
  return base !== null && base !== n.fingerprint;
}
export const cashMorningKey = (base: string) => `${base}${SUFFIX}`;

/** One next-calendar-morning repeat of an actually sent evening push. */
export function cashMorningAt(deliveredAt: Date): Date | null {
  if (!Number.isFinite(deliveredAt.getTime())) return null;
  const local = new Date(deliveredAt.getTime() + OFFSET);
  if (local.getUTCHours() < 18) return null;
  local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(9, 0, 0, 0);
  return new Date(local.getTime() - OFFSET);
}

/** Retries also respect 09:00–18:00 Moscow; no evening repeat chain. */
export function cashMorningNotBefore(now: Date): Date {
  const local = new Date(now.getTime() + OFFSET);
  const hour = local.getUTCHours();
  if (hour >= 9 && hour < 18) return now;
  if (hour >= 18) local.setUTCDate(local.getUTCDate() + 1);
  local.setUTCHours(9, 0, 0, 0);
  return new Date(local.getTime() - OFFSET);
}
