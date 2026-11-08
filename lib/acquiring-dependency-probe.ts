import type { DependencyProbe } from './dependency-watchdog';

type Config = { aqsiKey: boolean; mappings?: string; legacyKey?: string; legacyId?: string };
type ReadOperations = (input: { terminalKey: string; from: string; to: string }) => Promise<{ complete: boolean }>;

export function confirmsCabinetReplacement(input: { cabinetEnabled: boolean; source?: string; ok: boolean; latestType?: string }) {
  return !input.cabinetEnabled && input.source === 'aqsi' && input.ok && input.latestType === 'dependency.down';
}

/** Probe the same configured acquiring path used by fiscal reconciliation. */
export async function probeAcquiringDependency(input: {
  config: Config;
  readOperations: ReadOperations;
  readLegacyTerminals: () => Promise<{ ok: boolean; error?: string }>;
  now?: Date;
}): Promise<DependencyProbe & { source: 'aqsi' | 'legacy' }> {
  const checkedAt = input.now ?? new Date();
  const base = { key: 'tbank_acquiring', label: 'Т-Банк — терминалы', checkedAt };
  if (!input.config.aqsiKey) {
    try {
      const result = await input.readLegacyTerminals();
      return { ...base, source: 'legacy', ok: result.ok, detail: result.ok ? '' : (result.error?.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Проверка подключения Т-Банка не прошла') };
    } catch { return { ...base, source: 'legacy', ok: false, detail: 'Проверка подключения Т-Банка не завершилась' }; }
  }
  const mappings = new Map<string, string>();
  let invalid = false;
  for (const pair of (input.config.mappings ?? '').split(',').filter(value => value.trim())) {
    const [key, id, extra] = pair.split('=').map(value => value.trim());
    if (!key || !id || extra !== undefined || mappings.has(key)) { invalid = true; continue; }
    mappings.set(key, id);
  }
  if (!mappings.size && input.config.legacyKey?.trim() && input.config.legacyId?.trim()) {
    mappings.set(input.config.legacyKey.trim(), input.config.legacyId.trim());
  }
  if (invalid || !mappings.size) return { ...base, source: 'aqsi', ok: false, detail: 'Не подтверждены настройки терминалов aQsi' };
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(checkedAt);
  const results = await Promise.all([...mappings.keys()].map(async terminalKey => {
    try { return (await input.readOperations({ terminalKey, from: `${day}T00:00:00+03:00`, to: checkedAt.toISOString() })).complete; }
    catch { return false; }
  }));
  const ok = results.every(Boolean);
  return { ...base, source: 'aqsi', ok, detail: ok ? '' : `Не подтверждена полнота данных aQsi: ${results.filter(Boolean).length} из ${results.length} терминалов` };
}
