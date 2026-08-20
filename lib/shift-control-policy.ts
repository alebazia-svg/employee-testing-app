export const employeeKkmReportPhotosRequired = false;

export type ShiftHandoverStep =
  | 'personalCashBalance'
  | 'discrepancy'
  | 'reserveCashBalance'
  | 'encashment'
  | 'terminalQuestion'
  | 'terminalReconciliation'
  | 'terminalReceipts'
  | 'tbankQuestion'
  | 'tbankReceipts'
  | 'tbankTerminal'
  | 'zReportPhoto';

export function buildShiftHandoverSteps(input: {
  personalCashBalance: number | null;
  cashCommentRequired: boolean;
  isRetail: boolean;
  isClosingShift: boolean;
  requireKkmReportPhoto?: boolean;
}): ShiftHandoverStep[] {
  const requiresEncashment = input.personalCashBalance !== null && input.personalCashBalance > 50_000;
  const requireKkmReportPhoto = input.requireKkmReportPhoto ?? employeeKkmReportPhotosRequired;

  return [
    'personalCashBalance',
    ...(input.cashCommentRequired ? ['discrepancy' as const] : []),
    ...(input.isRetail && input.isClosingShift ? ['reserveCashBalance' as const] : []),
    ...(requiresEncashment ? ['encashment' as const] : []),
    ...(input.isClosingShift && requireKkmReportPhoto ? ['zReportPhoto' as const] : []),
  ];
}
