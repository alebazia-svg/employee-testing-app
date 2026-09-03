import 'server-only';

import { loadTBankCabinetOperations } from '@/lib/tbank-cabinet-snapshot';

export const TBANK_CABINET_WATCHDOG_SOURCE_ID = 'tbank_cabinet_operations';

export type TBankCabinetWatchdogProbe = { ok: boolean; checkedAt: Date; errorCode?: string };

export async function probeTBankCabinetSnapshot(input: { path: string; now?: Date }): Promise<TBankCabinetWatchdogProbe> {
  const now = input.now ?? new Date();
  const result = await loadTBankCabinetOperations({
    path: input.path,
    terminalKey: '1010808747019437',
    from: new Date(now.getTime() - 60_000).toISOString(),
    to: now.toISOString(),
    now,
  });
  return { ok: result.complete, checkedAt: now, errorCode: result.errorCode };
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
