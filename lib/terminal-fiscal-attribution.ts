import type { MatchingReasonCode, MatchingStatus } from '@/lib/terminal-fiscal-matching';

export type TerminalFiscalAttributionInput = {
  status: MatchingStatus;
  reasonCode: MatchingReasonCode;
  bankOperationAt: Date | null;
  oneCCashRegisterRef: string | null;
  oneCCashierRef: string | null;
};

export type TerminalFiscalCashierEmployeeMapping = {
  userId: number;
  oneCCashierRef: string;
};

export type TerminalFiscalAssignmentInterval = {
  userId: number;
  oneCCashRegisterRef: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type TerminalFiscalAttributionResult = {
  employeeId: number | null;
  effectiveStatus: MatchingStatus;
  source: 'one_c_cashier' | 'kkm_assignment' | 'conflict' | 'none';
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
  assignments: TerminalFiscalAssignmentInterval[],
): TerminalFiscalAttributionResult {
  const adminProblem = record.reasonCode === 'ONE_C_CANDIDATE_NOT_FOUND';
  const operationAt = record.bankOperationAt?.getTime();
  const assignmentCandidates = operationAt === undefined || !record.oneCCashRegisterRef ? [] : assignments.filter((assignment) => (
    assignment.oneCCashRegisterRef === record.oneCCashRegisterRef
    && assignment.effectiveFrom.getTime() <= operationAt
    && (!assignment.effectiveTo || operationAt < assignment.effectiveTo.getTime())
  ));
  const cashierCandidates = record.oneCCashierRef
    ? cashierMappings.filter((mapping) => mapping.oneCCashierRef === record.oneCCashierRef)
    : [];

  if (cashierCandidates.length === 1) {
    const cashierUserId = cashierCandidates[0].userId;
    if (assignmentCandidates.length === 1 && assignmentCandidates[0].userId !== cashierUserId) {
      return { employeeId: null, effectiveStatus: 'needs_review', source: 'conflict', adminProblem: true };
    }
    if (assignmentCandidates.length > 1) {
      return { employeeId: null, effectiveStatus: 'needs_review', source: 'conflict', adminProblem: true };
    }
    return { employeeId: cashierUserId, effectiveStatus: record.status, source: 'one_c_cashier', adminProblem };
  }

  if (cashierCandidates.length > 1) {
    return { employeeId: null, effectiveStatus: 'needs_review', source: 'conflict', adminProblem: true };
  }

  // A bank operation without a 1C check has no independent employee identity.
  // A terminal/workplace assignment alone must not personalize this admin problem.
  if (adminProblem) {
    return { employeeId: null, effectiveStatus: record.status, source: 'none', adminProblem: true };
  }

  if (assignmentCandidates.length === 1) {
    return { employeeId: assignmentCandidates[0].userId, effectiveStatus: record.status, source: 'kkm_assignment', adminProblem };
  }

  return {
    employeeId: null,
    effectiveStatus: assignmentCandidates.length > 1 ? 'needs_review' : record.status,
    source: assignmentCandidates.length > 1 ? 'conflict' : 'none',
    adminProblem: adminProblem || assignmentCandidates.length > 1,
  };
}
