import { validatePayrollDraft, type PayrollDraft } from './payroll-draft';

/** Corrections start from the saved inputs; the original run stays immutable. */
export function payrollCorrectionDraft(run: {
  sourceSummary?: unknown;
  manualInputs: Array<{ employeeName: string; inputType: string; workedDays: string | null; lateCount: string | null; advance: string | null; agentCreditCommission: string | null; fixedBonus: string | null; fixedDeduction: string | null; purchaseAdvance: string | null; purchaseDeduction: string | null; comment: string; source?: string | null }>;
  employeeResults: Array<{ employeeName: string; calculationDetails?: Array<{ component: string; comment: string }>; adjustments?: Array<{ id: number; type: string; amount: number; reason: string }> }>;
}): PayrollDraft {
  const automatic = Boolean(run.sourceSummary && typeof run.sourceSummary === 'object'
    && 'kind' in run.sourceSummary && run.sourceSummary.kind === 'automatic-1c-v1');
  const importedAdvances = new Set(automatic ? run.employeeResults.filter(employee => employee.calculationDetails?.some(
    detail => detail.component === 'Аванс' && detail.comment.startsWith('Расходник №'),
  )).map(employee => employee.employeeName) : []);
  const draft: PayrollDraft = { manual: {}, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] };
  for (const input of run.manualInputs) {
    // Only documented 1C advances are re-read. Preserve genuine manual advances.
    const advance = importedAdvances.has(input.employeeName) ? '' : input.advance ?? '';
    if (input.inputType === 'sales') draft.manual[input.employeeName] = {
      workedDays: input.workedDays ?? '', lateCount: input.lateCount ?? '', advance,
      agentCreditCommission: input.agentCreditCommission ?? '', comment: input.comment,
      source: (input.source ?? 'manual') as NonNullable<PayrollDraft['manual'][string]['source']>,
    };
    if (input.inputType === 'fixed') draft.fixed[input.employeeName] = {
      bonus: input.fixedBonus ?? '', advance, deduction: input.fixedDeduction ?? '', comment: input.comment,
    };
    if (input.inputType === 'purchase') draft.purchase = {
      advance: importedAdvances.has(input.employeeName) ? '' : input.purchaseAdvance ?? '', deduction: input.purchaseDeduction ?? '', comment: input.comment,
    };
  }
  draft.bonuses = run.employeeResults.flatMap(employee => (employee.adjustments ?? [])
    .filter(row => row.type === 'ONE_TIME_BONUS')
    .map(row => ({ id: `saved-${row.id}`, employeeName: employee.employeeName, amount: String(row.amount), reason: row.reason })));
  return validatePayrollDraft(draft);
}

export function payrollCorrectionMatches(finalId: number | undefined, requested: unknown): boolean {
  return typeof requested === 'number' && Number.isSafeInteger(requested) && requested > 0 && requested === finalId;
}
