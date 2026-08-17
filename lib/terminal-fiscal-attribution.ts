import type { MatchingReasonCode, MatchingStatus } from '@/lib/terminal-fiscal-matching';

export type TerminalFiscalAttributionInput = {
  status: MatchingStatus;
  reasonCode: MatchingReasonCode;
  oneCCashierRef: string | null;
};

export type TerminalFiscalCashierEmployeeMapping = {
  userId: number;
  oneCCashierRef: string;
};

export type TerminalFiscalAttributionResult = {
  employeeId: number | null;
  effectiveStatus: MatchingStatus;
  source: 'one_c_cashier' | 'conflict' | 'none';
  adminProblem: boolean;
};

function normalizedPersonName(value: string) {
  return value.normalize('NFKC').replace(/[ёЁ]/g, 'е').toLocaleLowerCase('ru-RU').replace(/[^а-яa-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function suggestTerminalFiscalCashierMappings(
  cashiers: Array<{ ref: string; name: string }>,
  employees: Array<{ userId: number; name: string }>,
) {
  return cashiers.map((cashier) => {
    const candidates = cashier.ref && cashier.name
      ? employees.filter((employee) => normalizedPersonName(employee.name) === normalizedPersonName(cashier.name))
      : [];
    return {
      cashierRef: cashier.ref,
      cashierName: cashier.name,
      employeeId: candidates.length === 1 ? candidates[0].userId : null,
      candidateCount: candidates.length,
      confirmationRequired: true,
    };
  });
}

export function attributeTerminalFiscalEmployee(
  record: TerminalFiscalAttributionInput,
  cashierMappings: TerminalFiscalCashierEmployeeMapping[],
): TerminalFiscalAttributionResult {
  const adminProblem = record.reasonCode === 'ONE_C_CANDIDATE_NOT_FOUND';
  const cashierCandidates = record.oneCCashierRef
    ? cashierMappings.filter((mapping) => mapping.oneCCashierRef === record.oneCCashierRef)
    : [];

  if (cashierCandidates.length === 1) {
    return { employeeId: cashierCandidates[0].userId, effectiveStatus: record.status, source: 'one_c_cashier', adminProblem };
  }

  if (cashierCandidates.length > 1) {
    return { employeeId: null, effectiveStatus: 'needs_review', source: 'conflict', adminProblem: true };
  }

  return {
    employeeId: null,
    effectiveStatus: record.status,
    source: 'none',
    adminProblem,
  };
}
