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

export function normalizePayrollWorkbookReviewReason(reason: string) {
  const normalized = reason.trim().replace(/^(Проверить:\s*)+/i, '');
  if (normalized === 'расчёт по закупкам выше целевой ЗП') return null;
  if (normalized === 'Не полностью проверена база расчёта 12%') return null;
  if (normalized === 'Посещаемость по форме не подтверждена') return 'Не указаны опоздания';
  return normalized || null;
}

export function formatPayrollWorkbookNote(status: string, note: string) {
  const normalized = note.trim().replace(/^(Проверить:\s*)+/i, '');
  if (status === 'Готово') return normalized;
  return normalized ? `Проверить: ${normalized}` : 'Проверить';
}

export function formatPayrollWorkbookBonusReason(employeeName: string, reason: string) {
  const normalizedReason = reason.trim();
  const normalizedEmployee = employeeName.trim().toLocaleLowerCase('ru-RU');
  if (normalizedEmployee.includes('астемир') && normalizedReason === 'Рекордные результаты оптового отдела. Решение руководителя.') return 'Результат по закупкам свыше 100 000 ₽';
  if (normalizedEmployee.includes('залин') && normalizedReason === 'Рекордные результаты оптового отдела. Основной вклад в продажи; решение руководителя.') return 'Основной вклад в рекорд оптовых продаж';
  if ((normalizedEmployee.includes('лиан') || normalizedEmployee.includes('лян')) && normalizedReason === 'Рекордные результаты оптового отдела. С учётом участия в месяце отпуска; решение руководителя.') return 'Участие в рекорде опта с учётом отпуска';
  return normalizedReason;
}

export function buildPayrollWorkbookEmployeeComment(input: {
  employeeName: string;
  lateCount: number | null;
  deduction: number;
  manualComment: string;
  reviewReasons: string[];
  bonuses: Array<{ amount: number; reason: string }>;
}) {
  const comments: string[] = [];
  const manualComment = input.manualComment.trim();
  const bonuses = input.bonuses.filter((bonus) => Number.isFinite(bonus.amount) && bonus.amount > 0);

  bonuses.forEach((bonus) => {
    const reason = formatPayrollWorkbookBonusReason(input.employeeName, bonus.reason);
    comments.push(`Премия ${formatWorkbookMoney(bonus.amount)}${reason ? ` — ${reason}` : ''}`);
  });

  if (Number.isFinite(input.deduction) && input.deduction > 0) {
    comments.push(`Удержание ${formatWorkbookMoney(input.deduction)}${manualComment ? ` — ${manualComment}` : ''}`);
  } else if (manualComment && !bonuses.some((bonus) => bonus.reason.trim() === manualComment)) {
    comments.push(`Корректировка: ${manualComment}`);
  }

  if (input.lateCount !== null && Number.isFinite(input.lateCount) && input.lateCount > 0) {
    comments.push(`Опоздания: ${input.lateCount}`);
  }

  input.reviewReasons.forEach((reason) => {
    const normalized = normalizePayrollWorkbookReviewReason(reason);
    if (normalized) comments.push(normalized);
  });

  return Array.from(new Set(comments)).join(' · ');
}

export function getPayrollWorkbookAccessorySummary(rows: Array<Array<string | number | null>>) {
  const tier = rows.find((row) => String(row[0] ?? '') === 'Уровень аксессуаров');
  const rate = rows.find((row) => String(row[0] ?? '') === 'Ставка аксессуаров');
  if (!rate) return '';

  const rateText = String(rate[1] ?? '');
  if (!tier) return rateText ? `Аксессуары: фиксированная ставка ${rateText}` : '';

  const [teamBase = '', threshold = ''] = String(tier[1] ?? '').split(' / порог ');
  const comparison = String(tier[2] ?? '').includes('не превышен') ? '≤' : '>';
  const compactMoney = (value: string) => value.replace(',00 ₽', ' ₽');
  return teamBase && threshold && rateText
    ? `Аксессуары ${rateText}: ${compactMoney(teamBase)} ${comparison} ${compactMoney(threshold)}`
    : '';
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
    if (normalized.includes('аксессуар') && (normalized.includes('5%') || normalized.includes('7%'))) {
      const rate = normalized.includes('7%') ? '7%' : '5%';
      return `${formatWorkbookMoney(numericBase)} × ${rate} = ${result}`;
    }
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
  const accessoryMatch = component.match(/^Аксессуары (5|7)%$/);
  if (accessoryMatch) return `Аксессуары: ${accessoryMatch[1]}% выручки`;
  const labels: Record<string, string> = {
    'Фиксированный оклад': 'Оклад',
    'Услуги оказываемые 50%': 'Услуги: 50% выручки',
    'Плоттерные материалы 50% от с/с': 'Плоттер: 50% себестоимости материалов',
    'Техника 10% от ВП': 'Техника: 10% валовой прибыли',
    'Кредитный бонус': 'Кредиты: 10% валовой прибыли после вычета 9% налогов и издержек',
    'Дисциплина': 'Бонус за дисциплину',
    'Начисление 12%': '12% от начислений команды',
    'ВЛ 12%': '12% от начислений команды',
    'Доплата закупщику до минимальной зарплаты': 'Доплата до минимальной зарплаты',
    'Доведение закупщика до 100 000': 'Доплата до минимальной зарплаты',
    'Доведение Бэлы до 100 000': 'Доплата до минимальной зарплаты',
  };

  return labels[component] ?? component;
}
