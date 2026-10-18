export type CurrentPayrollSettlement = {
  employeeName: string;
  paid: number | null;
  advance: number | null;
  remaining: number | null;
  totalDebt: number | null;
  accruedInOneC?: number | null;
};

/** A zero 1C balance confirms no salary debt. A positive all-period balance
 * must never be presented as the debt for an arbitrarily selected month. */
export function currentPayrollSettlement(employeeName: string, summary: {
  periodPaid: number; advances: number; unassigned: number;
  balance: { remainingMinor: number; creditMinor: number };
  monthly?: { remaining: number; accrued?: number } | null;
  accruedInOneC?: number | null;
} | null): CurrentPayrollSettlement {
  return {
    employeeName,
    paid: summary && !summary.unassigned ? summary.periodPaid : null,
    advance: summary ? summary.advances : null,
    remaining: summary?.monthly?.remaining ?? (summary && summary.balance.remainingMinor === 0 && summary.balance.creditMinor === 0 ? 0 : null),
    totalDebt: summary ? summary.balance.remainingMinor / 100 : null,
    accruedInOneC: summary?.monthly?.accrued ?? summary?.accruedInOneC ?? null,
  };
}

export function completeSettlementTotal(rows: CurrentPayrollSettlement[], key: 'paid' | 'advance' | 'remaining') {
  return rows.every(row => row[key] !== null)
    ? rows.reduce((sum, row) => sum + Math.round(row[key]! * 100), 0) / 100 : null;
}
