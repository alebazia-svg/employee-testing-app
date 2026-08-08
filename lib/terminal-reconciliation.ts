import type { OneCKkmRecentCheck } from '@/lib/one-c';
import type { TBankTerminalOperation } from '@/lib/tbank-acquiring';

const MONEY_TOLERANCE_RUBLES = 0.01;
const TIME_TOLERANCE_MS = 5 * 60 * 1000;

export const tBankTerminalOneCMapping: Record<string, { cashRegisterName: string; acquiringTerminalName: string }> = {
  '2332022071': {
    cashRegisterName: 'Касса Абшаева ККМ',
    acquiringTerminalName: 'Терминал Ногмова Бэла ИП',
  },
};

export type TerminalMatchedPair = {
  operation: TBankTerminalOperation;
  check: OneCKkmRecentCheck;
  timeDifferenceSeconds: number;
};

export type TerminalReconciliation = {
  matched: TerminalMatchedPair[];
  onlyTBank: TBankTerminalOperation[];
  onlyOneC: OneCKkmRecentCheck[];
  unsupportedReturns: TBankTerminalOperation[];
};

function timestamp(value: string, assumeMoscow = false) {
  // AIAgentAPI serializes the timezone-less 1C date as if it were UTC (with Z),
  // while its clock value is Moscow local time. Preserve the clock portion and
  // attach the real source timezone before comparing it with T-Bank UTC dates.
  const oneCClock = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  const oneCRussianClock = value.match(/^(\d{2})\.(\d{2})\.(\d{4})[ T](\d{2}:\d{2}:\d{2})/);
  const normalized = assumeMoscow && oneCClock
    ? `${oneCClock[1]}T${oneCClock[2]}+03:00`
    : assumeMoscow && oneCRussianClock
      ? `${oneCRussianClock[3]}-${oneCRussianClock[2]}-${oneCRussianClock[1]}T${oneCRussianClock[4]}+03:00`
      : value;
  const parsed = new Date(normalized).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeOneCDateTime(value: string) {
  const parsed = timestamp(value, true);
  return parsed === null ? value : new Date(parsed).toISOString();
}

function isCardCheck(check: OneCKkmRecentCheck) {
  const paymentForm = check.paymentForm.toLocaleLowerCase('ru-RU');
  return paymentForm.includes('карт') || paymentForm.includes('эквайр');
}

export function reconcileTerminalOperations({
  operations,
  checks,
  cashRegisterName,
}: {
  operations: TBankTerminalOperation[];
  checks: OneCKkmRecentCheck[];
  cashRegisterName: string;
}): TerminalReconciliation {
  const payments = operations.filter((operation) => operation.type === 'Debit');
  const unsupportedReturns = operations.filter((operation) => operation.type === 'Credit');
  const availableChecks = checks.filter((check) => (
    check.cashRegister.name === cashRegisterName
    && isCardCheck(check)
    && check.amount !== null
  ));
  const usedCheckIndexes = new Set<number>();
  const matched: TerminalMatchedPair[] = [];
  const onlyTBank: TBankTerminalOperation[] = [];

  for (const operation of [...payments].sort((left, right) => (
    (timestamp(left.transactionDate) ?? 0) - (timestamp(right.transactionDate) ?? 0)
  ))) {
    const operationTimestamp = timestamp(operation.transactionDate);
    let bestIndex = -1;
    let bestDifference = Number.POSITIVE_INFINITY;

    availableChecks.forEach((check, index) => {
      if (usedCheckIndexes.has(index) || check.amount === null || operationTimestamp === null) return;
      if (Math.abs(check.amount - operation.amountRubles) > MONEY_TOLERANCE_RUBLES) return;
      const checkTimestamp = timestamp(check.datetime, true);
      if (checkTimestamp === null) return;
      const difference = Math.abs(checkTimestamp - operationTimestamp);
      if (difference <= TIME_TOLERANCE_MS && difference < bestDifference) {
        bestIndex = index;
        bestDifference = difference;
      }
    });

    if (bestIndex < 0) {
      onlyTBank.push(operation);
      continue;
    }

    usedCheckIndexes.add(bestIndex);
    matched.push({
      operation,
      check: availableChecks[bestIndex],
      timeDifferenceSeconds: Math.round(bestDifference / 1000),
    });
  }

  return {
    matched,
    onlyTBank,
    onlyOneC: availableChecks.filter((_, index) => !usedCheckIndexes.has(index)),
    unsupportedReturns,
  };
}
