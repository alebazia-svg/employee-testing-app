export const PAYROLL_COMPENSATION_VERSION = 'payroll-accessory-tier-v2';
export const BELA_MINIMUM_START_PERIOD = '2026-08';
export const BELA_MINIMUM = 100_000;
export const RETAIL_ACCESSORY_TIER_START_PERIOD = '2026-08';
export const RETAIL_ACCESSORY_TIER_THRESHOLD = 1_000_000;
export const RETAIL_ACCESSORY_BASE_RATE = 0.05;
export const RETAIL_ACCESSORY_ELEVATED_RATE = 0.07;

export type PayrollBonusDraft = {
  id: string;
  employeeName: string;
  amount: string;
  reason: string;
};

export type PayrollBonus = Omit<PayrollBonusDraft, 'amount'> & {
  type: 'ONE_TIME_BONUS';
  amount: number;
};

export function payrollMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getBelaMinimum(periodKey: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey) && periodKey >= BELA_MINIMUM_START_PERIOD ? BELA_MINIMUM : 0;
}

export function getRetailAccessoryTier(periodKey: string, teamBase: number) {
  const normalizedBase = payrollMoney(teamBase);
  const elevated = /^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)
    && periodKey >= RETAIL_ACCESSORY_TIER_START_PERIOD
    && normalizedBase > RETAIL_ACCESSORY_TIER_THRESHOLD;
  const rate = elevated ? RETAIL_ACCESSORY_ELEVATED_RATE : RETAIL_ACCESSORY_BASE_RATE;

  return {
    teamBase: normalizedBase,
    threshold: RETAIL_ACCESSORY_TIER_THRESHOLD,
    rate,
    ratePercent: Math.round(rate * 100),
    elevated,
  };
}

export function validatePayrollCompensationVersion(version: unknown, bonuses: unknown, periodKey: string) {
  if (version !== undefined && version !== PAYROLL_COMPENSATION_VERSION) throw new Error('Неизвестная версия правил зарплаты.');
  if (getBelaMinimum(periodKey) && version !== PAYROLL_COMPENSATION_VERSION) {
    throw new Error('С августа 2026 требуется актуальная версия расчёта. Сохраните исходные файлы и ручные данные, затем обновите страницу и пересчитайте зарплату.');
  }
  if (version !== PAYROLL_COMPENSATION_VERSION && bonuses !== undefined) throw new Error('Для премий требуется новая версия расчёта.');
}

// Owner-approved starting draft, not a recurring monthly award or a finalized run.
export function getInitialPayrollBonuses(periodKey: string): PayrollBonusDraft[] {
  if (periodKey !== '2026-08') return [];
  return [
    { id: '2026-08-astemir', employeeName: 'Тохов Астемир', amount: '20000', reason: 'Рекордные результаты оптового отдела. Решение руководителя.' },
    { id: '2026-08-zalina', employeeName: 'Ахобекова Залина', amount: '15000', reason: 'Рекордные результаты оптового отдела. Основной вклад в продажи; решение руководителя.' },
    { id: '2026-08-liana', employeeName: 'Хурзокова Лиана', amount: '5000', reason: 'Рекордные результаты оптового отдела. С учётом участия в месяце отпуска; решение руководителя.' },
  ];
}

export function readPayrollBonusDrafts(value: unknown): PayrollBonusDraft[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error('Некорректный список премий.');
  const ids = new Set<string>();
  return value.map((item) => {
    if (!item || typeof item !== 'object' || !['id', 'employeeName', 'amount', 'reason'].every((key) => typeof item[key] === 'string')) {
      throw new Error('Не удалось прочитать сохранённый черновик премий.');
    }
    const draft = item as PayrollBonusDraft;
    if (!draft.id || draft.id.length > 100 || ids.has(draft.id)) throw new Error('Повтор записи премии.');
    ids.add(draft.id);
    return { id: draft.id, employeeName: draft.employeeName, amount: draft.amount, reason: draft.reason };
  });
}

export function validatePayrollBonuses(value: unknown, employeeNames: string[]): PayrollBonus[] {
  const drafts = readPayrollBonusDrafts(value);
  return drafts.map((draft) => {
    if (!employeeNames.includes(draft.employeeName)) throw new Error('Выберите сотрудника для каждой премии.');
    const normalized = draft.amount.trim().replace(/\s/g, '').replace(',', '.');
    const amount = Number(normalized);
    if (!/^\d+(\.\d{1,2})?$/.test(normalized) || !Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      throw new Error(`Премия: ${draft.employeeName} — укажите положительную сумму, не более двух знаков после запятой.`);
    }
    const reason = draft.reason.trim();
    if (!reason || reason.length > 1000) throw new Error(`Премия: ${draft.employeeName} — укажите причину (до 1000 символов).`);
    return { ...draft, amount: payrollMoney(amount), reason, type: 'ONE_TIME_BONUS' };
  });
}

export function getPayrollBonusTotal(bonuses: PayrollBonus[], employeeName: string) {
  return payrollMoney(bonuses.filter((bonus) => bonus.employeeName === employeeName).reduce((sum, bonus) => sum + bonus.amount, 0));
}

export function isBelaBaseEmployee(manager: string) {
  const normalized = manager.trim().toLowerCase().replace(/\s+/g, ' ');
  return ['тохов', 'астемир', 'ахобекова', 'залина', 'хурцокова', 'хурзокова', 'ляна', 'лиана', 'кумакова', 'кумахова', 'диана', 'чиченова', 'чеченова', 'милана', 'абшаева', 'зухра', 'икаев', 'асад', 'магомед', 'стажеррозница', 'стажёррозница'].some((part) => normalized.includes(part));
}

function validatePayrollCalculationDetails(row: Record<string, unknown>, bonuses: PayrollBonus[], periodKey: string, accessoryRate: number) {
  const fail = () => { throw new Error(`Расшифровка начислений не совпадает с расчётом: ${row.employeeName}. Обновите расчёт перед сохранением.`); };
  const amount = (field: string) => {
    const value = row[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) return fail();
    return value;
  };
  const expected: Array<{ component: string; amount: number; comment?: string }> = [];
  const add = (component: string, field: string, optional = false, sign = 1) => {
    const value = amount(field) * sign;
    if (!optional || value !== 0) expected.push({ component, amount: value });
  };
  if (row.salaryType === 'fixed_salary') {
    add('Фиксированный оклад', 'fixedSalary');
    add('Премия', 'fixedBonus');
  } else if (row.salaryType === 'purchase_manager') {
    add('Оплата по дням', 'dayPay');
    add('Закупки 1,75%', 'purchasePercentAmount');
    add('Доведение закупщика до 100 000', 'purchaseTargetAdjustment');
  } else {
    add('Оплата по дням', 'dayPay', true);
    if (row.salaryType === 'vl_percent') {
      add('ВЛ 12%', 'belaPercentAmount');
      if (getBelaMinimum(periodKey)) add('Доведение Бэлы до 100 000', 'minimumGuaranteeAdjustment');
    } else if (row.salaryType === 'wholesale_percent') {
      add('Бонус опта 1,75%', 'wholesaleBonus');
    } else {
      add('Услуги оказываемые 50%', 'filmBonus', true);
      add('Плоттерные материалы 50% от с/с', 'plotterBonus', true);
      add('Техника 10% от ВП', 'techBonus', true);
      add(`Аксессуары ${Math.round(accessoryRate * 100)}%`, 'accessoryBonus', true);
      add('Кредитный бонус', 'creditBonus', true);
    }
    add('Дисциплина', 'disciplineBonus', true);
    if (amount('agentCreditCommission') > 0) add('Агентские по кредитам', 'agentCreditCommission');
  }
  for (const bonus of bonuses.filter((item) => item.employeeName === row.employeeName)) {
    expected.push({ component: 'Разовая премия', amount: bonus.amount, comment: bonus.reason });
  }
  add('Аванс', 'advance', false, -1);
  if (row.salaryType === 'fixed_salary' || row.salaryType === 'purchase_manager') add('Удержание', 'fixedDeduction', false, -1);
  // Compare unrounded components first. Displayed components are rounded separately
  // by the existing Excel builder; do not change historical rounding/formulas.
  if (Math.abs(expected.reduce((sum, item) => sum + item.amount, 0) - amount('netPay')) > 0.005) fail();
  add('К выплате', 'netPay');
  if (!Array.isArray(row.calculationDetails) || row.calculationDetails.length !== expected.length) return fail();
  const remaining = [...expected];
  for (const detail of row.calculationDetails) {
    if (!detail || typeof detail !== 'object' || typeof detail.amount !== 'number' || !Number.isFinite(detail.amount)) return fail();
    const index = remaining.findIndex((item) => item.component === detail.component
      && Math.abs(Math.round(item.amount * 100) / 100 - detail.amount) < 0.000001
      && (item.comment === undefined || item.comment === detail.comment));
    if (index === -1) return fail();
    remaining.splice(index, 1);
  }
}

export function validatePayrollCompensationSnapshot(rows: Array<Record<string, unknown>>, bonuses: PayrollBonus[], periodKey: string, totals: Record<string, unknown>) {
  const names = rows.map((row) => row.employeeName);
  if (new Set(names).size !== names.length) throw new Error('В расчёте повторяется сотрудник.');
  const number = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('В расчёте отсутствует корректная сумма.');
    return value;
  };
  const equal = (actual: unknown, expected: number) => {
    if (Math.abs(number(actual) - expected) > 0.005) throw new Error('Суммы расчёта и премий не совпадают. Обновите расчёт перед сохранением.');
  };
  const accessoryTeamBase = rows
    .filter((row) => row.salaryType === 'retail_sales_bonus')
    .flatMap((row) => Array.isArray(row.calculationDetails) ? row.calculationDetails : [])
    .filter((detail): detail is Record<string, unknown> => Boolean(detail) && typeof detail === 'object' && /^Аксессуары (5|7)%$/.test(String(detail.component)))
    .reduce((sum, detail) => {
      if (typeof detail.base === 'number' && Number.isFinite(detail.base)) return sum + detail.base;
      if (periodKey >= RETAIL_ACCESSORY_TIER_START_PERIOD) throw new Error('В расчёте отсутствует база аксессуаров для проверки ставки.');
      return sum;
    }, 0);
  const accessoryTier = getRetailAccessoryTier(periodKey, accessoryTeamBase);
  for (const row of rows) {
    const bonus = getPayrollBonusTotal(bonuses, String(row.employeeName));
    equal(row.oneTimeBonus, bonus);
    equal(row.netPay, number(row.grossPay) - number(row.advance) - number(row.fixedDeduction));
    if (row.salaryRule === 'belaPercent') {
      const base = rows.filter((item) => item.salaryRule !== 'belaPercent' && isBelaBaseEmployee(String(item.employeeName))).reduce((sum, item) => sum + number(item.grossPay) - getPayrollBonusTotal(bonuses, String(item.employeeName)), 0);
      const minimum = getBelaMinimum(periodKey);
      const percent = minimum ? payrollMoney(base * 0.12) : base * 0.12;
      const topUp = minimum ? payrollMoney(Math.max(0, minimum - percent)) : 0;
      equal(row.belaBase, base);
      equal(row.belaPercentAmount, percent);
      equal(row.minimumGuaranteeAdjustment, topUp);
      equal(row.grossPay, percent + topUp + bonus);
    }
    validatePayrollCalculationDetails(row, bonuses, periodKey, accessoryTier.rate);
  }
  for (const field of ['grossPay', 'netPay', 'advance']) equal(totals[field], rows.reduce((sum, row) => sum + number(row[field]), 0));
}
