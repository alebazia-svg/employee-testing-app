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

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
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
      const checkTimestamp = timestamp(check.datetime);
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
