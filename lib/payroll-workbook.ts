export type PayrollWorkbookEmployee = {
  employeeName: string;
  salaryType: string;
  grossPay: number;
};

export type PayrollWorkbookReviewEmployee = PayrollWorkbookEmployee & {
  status: string;
};

const payrollGroupOrder: Record<string, number> = {
  purchase_manager: 0,
  wholesale_percent: 1,
  retail_sales_bonus: 2,
  vl_percent: 3,
  fixed_salary: 4,
};

export const PAYROLL_WORKBOOK_UNCONFIGURED_GROUP = 'Требует настройки';

export function isPayrollWorkbookSalaryTypeConfigured(salaryType: string) {
  return Object.hasOwn(payrollGroupOrder, salaryType);
}

export function getPayrollWorkbookGroup(salaryType: string) {
  if (salaryType === 'purchase_manager') return 'Закупки';
  if (salaryType === 'wholesale_percent') return 'Оптовые продажи';
  if (salaryType === 'vl_percent') return 'Операционное управление';
  if (salaryType === 'retail_sales_bonus') return 'Розничные продажи';
  if (salaryType === 'fixed_salary') return 'Фиксированный оклад';
  return PAYROLL_WORKBOOK_UNCONFIGURED_GROUP;
}

export function sortPayrollWorkbookEmployees<T extends PayrollWorkbookEmployee>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const groupDifference = (payrollGroupOrder[left.salaryType] ?? 99) - (payrollGroupOrder[right.salaryType] ?? 99);
    if (groupDifference !== 0) return groupDifference;
    const salaryDifference = right.grossPay - left.grossPay;
    if (salaryDifference !== 0) return salaryDifference;
    return left.employeeName.localeCompare(right.employeeName, 'ru');
  });
}

export function getPayrollWorkbookStatusLabel(status: string) {
  return status === 'OK' ? 'Готово' : 'Проверить';
}

export function getPayrollWorkbookReviewCount(
  employeeRows: PayrollWorkbookReviewEmployee[],
  checkRows: Array<Array<string | number | null>>,
) {
  const reviewItems = new Set<string>();

  employeeRows.forEach((row) => {
    if (row.status !== 'Готово' || !isPayrollWorkbookSalaryTypeConfigured(row.salaryType)) {
      reviewItems.add(`employee:${row.employeeName}`);
    }
  });

  checkRows.forEach((row) => {
    if (isPayrollWorkbookPaidAdvanceCheck(row)) return;
    const status = String(row[3] ?? '');
    if (status !== 'Проверить' && status !== 'Ошибка') return;
    const employeeName = String(row[0] ?? '');
    const reason = String(row[1] ?? 'замечание');
    reviewItems.add(employeeName && employeeName !== 'Расчёт в целом'
      ? `employee:${employeeName}`
      : `check:${reason}`);
  });

  return reviewItems.size;
}

export function isPayrollWorkbookPaidAdvanceCheck(row: Array<string | number | null>) {
  const check = `${String(row[1] ?? '')} ${String(row[4] ?? '')}`.toLocaleLowerCase('ru-RU');
  return check.includes('аванс') && (check.includes('выплачен') || check.includes('выдан'));
}

function formatWorkbookMoney(value: number) {
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function getPayrollWorkbookCalculationText(
  component: string,
  base: string | number | null,
  formula: string,
  amount: number,
) {
  const normalized = component.toLocaleLowerCase('ru-RU');
  const numericBase = typeof base === 'number' && Number.isFinite(base) ? base : null;
  const result = formatWorkbookMoney(amount);

  if (numericBase !== null) {
    if (normalized.includes('1,75%')) return `${formatWorkbookMoney(numericBase)} × 1,75% = ${result}`;
    if (normalized.includes('12%')) return `${formatWorkbookMoney(numericBase)} × 12% = ${result}`;
    if (normalized.includes('услуг') && normalized.includes('50%')) return `${formatWorkbookMoney(numericBase)} × 50% = ${result}`;
    if (normalized.includes('плоттер') && normalized.includes('50%')) return `${formatWorkbookMoney(numericBase)} × 50% = ${result}`;
    if (normalized.includes('техник') && normalized.includes('10%')) return `${formatWorkbookMoney(numericBase)} × 10% = ${result}`;
    if (normalized.includes('аксессуар') && normalized.includes('5%')) return `${formatWorkbookMoney(numericBase)} × 5% = ${result}`;
    if (normalized.includes('кредит')) return `${formatWorkbookMoney(numericBase)} × 91% × 10% = ${result}`;
    if (normalized.includes('доплата до миним')) return `${formatWorkbookMoney(numericBase)} − ${formatWorkbookMoney(numericBase - amount)} = ${result}`;
    if (normalized.includes('оклад')) return `${formatWorkbookMoney(numericBase)} = ${result}`;
  }

  if (normalized.includes('оплата') && normalized.includes('дн')) return `${formula} = ${result}`;
  if (normalized === 'аванс') return `Выплачено: ${formatWorkbookMoney(Math.abs(amount))}`;
  if (normalized.includes('удержан')) return `Удержано: ${formatWorkbookMoney(Math.abs(amount))}`;
  return formula ? `${formula} = ${result}` : result;
}

export function getPayrollWorkbookComponentLabel(component: string) {
  const labels: Record<string, string> = {
    'Фиксированный оклад': 'Оклад',
    'Услуги оказываемые 50%': 'Услуги: 50% выручки',
    'Плоттерные материалы 50% от с/с': 'Плоттер: 50% себестоимости материалов',
    'Техника 10% от ВП': 'Техника: 10% валовой прибыли',
    'Аксессуары 5%': 'Аксессуары: 5% выручки',
    'Кредитный бонус': 'Кредиты: 10% валовой прибыли после вычета 9% налогов и издержек',
    'Дисциплина': 'Бонус за дисциплину',
    'Начисление 12%': '12% от начислений команды',
    'Доплата закупщику до минимальной зарплаты': 'Доплата до минимальной зарплаты',
  };

  return labels[component] ?? component;
}
