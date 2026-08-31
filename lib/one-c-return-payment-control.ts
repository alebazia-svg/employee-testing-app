import 'server-only';

import type { OneCCheck } from '@/lib/terminal-fiscal-matching';
import { loadOneCKkmChecks } from '@/lib/terminal-fiscal-sources';

export type OneCReturnPaymentConflict = {
  sourceRef: string;
  number: string;
  dateTime: string;
  cashierName: string;
  totalKopecks: number;
  cashKopecks: number;
  activeCardKopecks: number;
};

export function detectOneCReturnPaymentConflicts(checks: OneCCheck[]): OneCReturnPaymentConflict[] {
  return checks.flatMap((check) => {
    if (check.sourceType !== 'refund_check' || check.operationType !== 'refund') return [];
    const activeCardKopecks = check.cardPayments.reduce((sum, payment) => sum + payment.amountKopecks, 0);
    const cashKopecks = check.cashKopecks ?? 0;
    if (cashKopecks <= 0 || activeCardKopecks <= 0) return [];
    if (cashKopecks + activeCardKopecks <= check.totalKopecks) return [];
    return [{
      sourceRef: check.sourceRef,
      number: check.number || check.sourceRef,
      dateTime: check.dateTime,
      cashierName: check.cashier.name,
      totalKopecks: check.totalKopecks,
      cashKopecks,
      activeCardKopecks,
    }];
  });
}

export async function loadOneCReturnPaymentConflicts(date: string) {
  const next = new Date(`${date}T12:00:00+03:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  const toDate = next.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
  const snapshot = await loadOneCKkmChecks({ fromDate: date, toDate });
  return {
    complete: snapshot.complete,
    checkedAt: snapshot.checkedAt,
    errorCode: snapshot.errorCode,
    conflicts: snapshot.complete ? detectOneCReturnPaymentConflicts(snapshot.data) : [],
  };
}
