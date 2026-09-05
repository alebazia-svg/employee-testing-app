export const employeeKkmReportPhotosRequired = false;

const automatedRetailTaskCategories = new Set(['acquiring']);

export function activeEmployeeShiftTemplateTasks<T extends { category: string }>(department: string, tasks: T[]): T[] {
  if (department !== 'retail') return tasks;
  return tasks.filter((task) => !automatedRetailTaskCategories.has(task.category));
}

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
  isStoreClosingShift: boolean;
  requiresKkmClose: boolean;
  requireKkmReportPhoto?: boolean;
}): ShiftHandoverStep[] {
  const requiresEncashment = input.personalCashBalance !== null && input.personalCashBalance > 50_000;
  const requireKkmReportPhoto = input.requireKkmReportPhoto ?? employeeKkmReportPhotosRequired;

  return [
    'personalCashBalance',
    ...(input.cashCommentRequired ? ['discrepancy' as const] : []),
    ...(input.isRetail && input.isStoreClosingShift ? ['reserveCashBalance' as const] : []),
    ...(requiresEncashment ? ['encashment' as const] : []),
    ...(input.requiresKkmClose && requireKkmReportPhoto ? ['zReportPhoto' as const] : []),
  ];
}
