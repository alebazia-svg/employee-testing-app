import { getPayrollWorkbookGroup, isPayrollWorkbookSalaryTypeConfigured } from '@/lib/payroll-workbook';

export type PayrollEmployeeRuleInput = {
  payrollSalaryType: string | null;
  payrollReportGroup: string | null;
  payrollFixedSalary: number | null;
  payrollRuleFrom: string | null;
  payrollRuleThrough: string | null;
};

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export class PayrollEmployeeRuleValidationError extends Error {}

function optionalPeriod(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.trim();
  if (!periodPattern.test(normalized)) throw new PayrollEmployeeRuleValidationError('Период правила должен быть в формате ГГГГ-ММ.');
  return normalized;
}

export function parsePayrollEmployeeRuleInput(payload: Record<string, unknown>): PayrollEmployeeRuleInput {
  const salaryType = typeof payload.payrollSalaryType === 'string' ? payload.payrollSalaryType.trim() : '';
  if (!salaryType) {
    return {
      payrollSalaryType: null,
      payrollReportGroup: null,
      payrollFixedSalary: null,
      payrollRuleFrom: null,
      payrollRuleThrough: null,
    };
  }
  if (!isPayrollWorkbookSalaryTypeConfigured(salaryType)) throw new PayrollEmployeeRuleValidationError('Выберите известное правило зарплаты.');

  const from = optionalPeriod(payload.payrollRuleFrom);
  const through = optionalPeriod(payload.payrollRuleThrough);
  if (from && through && from > through) throw new PayrollEmployeeRuleValidationError('Окончание действия правила не может быть раньше начала.');

  const fixedSalaryValue = payload.payrollFixedSalary === '' || payload.payrollFixedSalary === null || payload.payrollFixedSalary === undefined
    ? null
    : Number(payload.payrollFixedSalary);
  if (salaryType === 'fixed_salary' && (!Number.isFinite(fixedSalaryValue) || Number(fixedSalaryValue) < 0)) {
    throw new PayrollEmployeeRuleValidationError('Для фиксированного оклада укажите корректную сумму.');
  }

  return {
    payrollSalaryType: salaryType,
    payrollReportGroup: getPayrollWorkbookGroup(salaryType),
    payrollFixedSalary: salaryType === 'fixed_salary' ? Number(fixedSalaryValue) : null,
    payrollRuleFrom: from,
    payrollRuleThrough: through,
  };
}

export function isPayrollEmployeeRuleActive(rule: { payrollRuleFrom?: string | null; payrollRuleThrough?: string | null }, periodKey: string) {
  if (rule.payrollRuleFrom && periodKey < rule.payrollRuleFrom) return false;
  if (rule.payrollRuleThrough && periodKey > rule.payrollRuleThrough) return false;
  return true;
}
