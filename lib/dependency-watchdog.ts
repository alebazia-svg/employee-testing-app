export type DependencyProbe = {
  key: string;
  label: string;
  ok: boolean;
  checkedAt: Date;
  detail?: string;
};

export type DependencyExpiry = {
  key: string;
  label: string;
  expiresOn: string;
  renewalUrl?: string;
};

export const EXPIRY_WARNING_DAYS = [30, 14, 7, 3, 1, 0] as const;

export function daysUntilExpiry(expiresOn: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return null;
  const expiry = new Date(`${expiresOn}T00:00:00+03:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  const today = new Date(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now) + 'T00:00:00+03:00');
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

export function expiryWarning(expiry: DependencyExpiry, now = new Date()) {
  const days = daysUntilExpiry(expiry.expiresOn, now);
  if (days === null || days > 30) return null;
  const threshold = [...EXPIRY_WARNING_DAYS].filter((value) => days <= value).at(-1) ?? 0;
  return {
    days,
    threshold,
    state: days < 0 ? 'expired' : 'expiring',
    eventKey: `dependency:${expiry.key}:expiry:${expiry.expiresOn}:${threshold}`,
  } as const;
}

export function parseDependencyExpiries(raw: string | undefined): DependencyExpiry[] {
  if (!raw?.trim()) return [];
  const value = JSON.parse(raw) as unknown;
  if (!Array.isArray(value)) throw new Error('DEPENDENCY_EXPIRIES_JSON must be an array');
  return value.flatMap((entry): DependencyExpiry[] => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const key = String(row.key ?? '').trim();
    const label = String(row.label ?? '').trim();
    const expiresOn = String(row.expiresOn ?? '').trim();
    const renewalUrl = String(row.renewalUrl ?? '').trim();
    if (!key || !label || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return [];
    return [{ key, label, expiresOn, renewalUrl: renewalUrl || undefined }];
  });
}
