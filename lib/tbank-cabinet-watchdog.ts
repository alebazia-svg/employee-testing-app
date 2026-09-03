import 'server-only';

import { readFile } from 'node:fs/promises';
import { parseTBankCabinetSnapshot, TBANK_CABINET_MAX_AGE_MS } from '@/lib/tbank-cabinet-snapshot';

export const TBANK_CABINET_WATCHDOG_SOURCE_ID = 'tbank_cabinet_operations';

export type TBankCabinetWatchdogProbe = { ok: boolean; checkedAt: Date; errorCode?: string };

export async function probeTBankCabinetSnapshot(input: { path: string; now?: Date }): Promise<TBankCabinetWatchdogProbe> {
  const now = input.now ?? new Date();
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(input.path, 'utf8'));
  } catch {
    return { ok: false, checkedAt: now, errorCode: 'TBANK_CABINET_SNAPSHOT_UNREADABLE' };
  }
  const snapshot = parseTBankCabinetSnapshot(raw);
  if (!snapshot || !snapshot.complete) {
    return { ok: false, checkedAt: now, errorCode: 'TBANK_CABINET_SNAPSHOT_INVALID' };
  }
  const age = now.getTime() - new Date(snapshot.generatedAt).getTime();
  if (age < -60_000 || age > TBANK_CABINET_MAX_AGE_MS) {
    return { ok: false, checkedAt: now, errorCode: 'TBANK_CABINET_SNAPSHOT_STALE' };
  }
  return { ok: true, checkedAt: now };
}

export function tbankCabinetWatchdogCopy(probe: TBankCabinetWatchdogProbe) {
  if (probe.ok) return {
    type: 'dependency.recovered',
    title: 'Связь с Т-Банком восстановлена',
    body: 'Операции по картам и QR снова поступают. Пропущенный период будет проверен автоматически.',
  };
  return {
    type: 'dependency.down',
    title: 'Нет новых данных Т-Банка',
    body: 'Операции по картам и QR не обновляются более 10 минут. Откройте отдельное окно Edge «OFFONIKA TBank Monitor» на Mac и восстановите вход.',
  };
}
