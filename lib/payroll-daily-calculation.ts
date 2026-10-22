import {
  agentCreditCommissionEmployee, applyAutomaticAttendanceInputs, applyBelaPercentRule,
  buildFixedPayrollRows, buildFullPayrollRow, buildPurchasePayrollRow,
  buildSalesPayrollSummaries, buildUnconfiguredPayrollRows, getPayrollManualInput,
  type BonusManagerSummary, type FixedPayrollInput, type PayrollAttendancePreviewResponse,
  type PayrollDirectoryUser, type PayrollEmployee, type PayrollManualInput, type PurchasePayrollInput,
} from './payroll-calculation-engine';

// Shared by the ADMIN working calculation and the private server reader.
// Transport, browser drafts, saved FINAL runs and settlement do not belong here.
export function prepareDailyPayrollInputs(input: {
  directory: Record<string, PayrollEmployee>;
  manual: Record<string, PayrollManualInput>;
  attendance: PayrollAttendancePreviewResponse | null;
  periodKey: string;
  finboxAmount: string | null;
}) {
  const manual = { ...applyAutomaticAttendanceInputs(
    Object.values(input.directory)
      .filter(employee => ['wholesale_percent', 'retail_sales_bonus', 'vl_percent', 'purchase_daily'].includes(employee.salaryType))
      .map(employee => employee.name),
    input.manual, input.attendance, input.periodKey,
  ) };
  const empty = () => ({ workedDays: '', lateCount: '', advance: '', comment: '' });
  const assistant = input.directory['Кумыков Мухаммед'];
  if (assistant?.agreedDays !== undefined) manual[assistant.name] = {
    ...(manual[assistant.name] ?? empty()), workedDays: String(assistant.agreedDays),
  };
  manual[agentCreditCommissionEmployee] = {
    ...(manual[agentCreditCommissionEmployee] ?? empty()), agentCreditCommission: input.finboxAmount ?? '',
  };
  return manual;
}

export function buildDailyPayrollBase(input: {
  periodKey: string;
  directory: Record<string, PayrollEmployee>;
  users: PayrollDirectoryUser[];
  summaries: BonusManagerSummary[];
  manual: Record<string, PayrollManualInput>;
  fixed: Record<string, FixedPayrollInput>;
  purchase: PurchasePayrollInput;
  purchaseBase: number;
}) {
  const sales = buildSalesPayrollSummaries(input.summaries, input.directory)
    .map(summary => buildFullPayrollRow(summary, getPayrollManualInput(summary.manager, input.manual), input.directory));
  const fixed = buildFixedPayrollRows(input.fixed, input.periodKey, input.directory);
  const purchase = buildPurchasePayrollRow(input.purchase, {
    fileName: 'Автоматические данные 1С', base: input.purchaseBase, sourceRow: null,
  }, input.directory);
  const unconfigured = buildUnconfiguredPayrollRows(input.users, input.directory, input.periodKey, new Set(sales.map(row => row.manager)));
  return applyBelaPercentRule([...sales, ...fixed, purchase, ...unconfigured], input.periodKey);
}
