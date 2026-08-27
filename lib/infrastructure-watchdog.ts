export type InfrastructureCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
};

export function parseInfrastructureChecks(raw: string | undefined): InfrastructureCheck[] {
  if (!raw?.trim()) throw new Error('INFRASTRUCTURE_CHECKS_JSON is required');
  const value = JSON.parse(raw) as unknown;
  if (!Array.isArray(value)) throw new Error('INFRASTRUCTURE_CHECKS_JSON must be an array');
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid infrastructure check');
    const row = entry as Record<string, unknown>;
    const key = String(row.key ?? '').trim();
    const label = String(row.label ?? '').trim();
    const detail = String(row.detail ?? '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (!/^[a-z0-9_.-]{1,80}$/.test(key) || !label || typeof row.ok !== 'boolean') {
      throw new Error('Invalid infrastructure check');
    }
    return { key, label, ok: row.ok, detail };
  });
}
