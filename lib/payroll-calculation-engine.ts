import type { PayrollAttendanceSourceSummary } from '@/lib/payroll-attendance-snapshot';
import { type PayrollAdvanceDocument } from '@/lib/payroll-one-c-advances';
import { getBelaMinimum, getPayrollBonusTotal, getRetailAccessoryTier, isBelaBaseEmployee, payrollMoney, type PayrollBonus } from '@/lib/payroll-compensation';
import { PAYROLL_WORKBOOK_UNCONFIGURED_GROUP, getPayrollWorkbookGroup, isPayrollWorkbookSalaryTypeConfigured } from '@/lib/payroll-workbook';
import { isPayrollEmployeeRuleActive } from '@/lib/payroll-employee-rules';
import { getPayrollSalesManagerNameForPeriod } from '@/lib/payroll-sales-classification';
import { FILM_TRAINEE_NAME, FILM_TRAINEE_PERIOD, isFilmTrainee } from '@/lib/payroll-trainee';

// Shared calculation primitives. No database, browser state or transport access.
export type CellValue = string | number | boolean | Date | null | undefined;

export type SalesRow = {
  manager: string;
  client: string;
  category: string;
  item: string;
  registrar: string;
  registrars: string[];
  revenue: number;
  cost: number;
  grossProfit: number;
  profitability: number;
  sourceCostReviewRows?: number;
  sourceCostCalculationPendingRows?: number;
};

export type Department = 'Опт' | 'Розница';

export type CalculationType =
  | 'WHOLESALE_EXCLUDED_TECH'
  | 'WHOLESALE_REVIEW_TECH'
  | 'WHOLESALE_INCLUDED_1_75'
  | 'CREDIT_GROSS_PROFIT'
  | 'CREDIT_ACCESSORY_NO_BONUS'
  | 'CREDIT_REVIEW_NO_BONUS'
  | 'RETAIL_REVIEW_TECH'
  | 'RETAIL_FILM_50'
  | 'RETAIL_PLOTTER_MATERIAL_COST_50'
  | 'RETAIL_GROSS_PROFIT_10'
  | 'RETAIL_ACCESSORY_5'
  | 'MANUAL_EXCLUDED';

export type ClassifiedSalesRow = SalesRow & {
  department: Department;
  calculationType: CalculationType;
  calculationLabel: string;
  article: string;
  base: number;
  percent: number;
  bonus: number;
  formula: string;
  includedInWholesaleBase: boolean | null;
  classificationReason: string;
  matchedRule: string;
  isCreditSale: boolean;
  creditProductType: 'tech' | 'accessory' | 'review' | null;
  creditIncludedInBonus: boolean;
};

export type BonusManagerSummary = {
  manager: string;
  department: Department;
  revenue: number;
  grossProfit: number;
  creditBonus: number;
  filmBonus: number;
  plotterBonus: number;
  techBonus: number;
  accessoryBase?: number;
  accessoryRate?: number;
  accessoryBonus: number;
  wholesaleBonus: number;
  totalBonus: number;
};

export type PayrollManualInput = {
  workedDays: string;
  lateCount: string;
  advance: string;
  agentCreditCommission?: string;
  comment: string;
  source?: PayrollDaysSource;
};

export type PayrollDaysSource = 'manual' | 'attendance' | 'schedule' | 'manualCorrection';

export type ConfiguredSalaryType = 'vl_percent' | 'wholesale_percent' | 'retail_sales_bonus' | 'fixed_salary' | 'purchase_manager' | 'purchase_daily';

export type SalaryType = ConfiguredSalaryType | 'unconfigured';

export type PayrollEmployee = {
  name: string;
  department: string;
  position: string;
  salaryType: ConfiguredSalaryType;
  salary?: number;
  dayRate?: number;
  agreedDays?: number;
  activeFromPeriod?: string;
  activeThroughPeriod?: string;
};

export type PayrollDirectoryUser = {
  id: number;
  name: string;
  role: string;
  department: string;
  isActive: boolean;
  payrollName: string | null;
  payrollSalaryType: string | null;
  payrollReportGroup: string | null;
  payrollFixedSalary: number | null;
  payrollRuleFrom: string | null;
  payrollRuleThrough: string | null;
};

export type FixedPayrollInput = {
  bonus: string;
  advance: string;
  deduction: string;
  comment: string;
};

export type PurchasePayrollInput = {
  advance: string;
  deduction: string;
  comment: string;
};

export type PurchaseReportState = {
  fileName: string;
  base: number | null;
  sourceRow: number | null;
};

export type FullPayrollRow = BonusManagerSummary & {
  advanceDocuments?: PayrollAdvanceDocument[];
  belaBase?: number;
  belaPercentAmount?: number;
  minimumGuaranteeAdjustment?: number;
  oneTimeBonus?: number;
  payrollDepartment: string;
  position: string;
  salaryType: SalaryType;
  workedDays: number | null;
  lateCount: number | null;
  advance: number;
  agentCreditCommission: number;
  fixedSalary: number;
  fixedBonus: number;
  fixedDeduction: number;
  purchaseBase: number | null;
  purchasePercent: number;
  purchasePercentAmount: number;
  purchaseTargetAdjustment: number;
  purchaseTargetSalary: number;
  comment: string;
  daysSource: PayrollDaysSource;
  dayRate: number;
  dayPay: number;
  salesBonus: number;
  disciplineBonus: number;
  grossPay: number;
  netPay: number;
  salaryRule: 'standard' | 'daily' | 'noDayPay' | 'belaPercent' | 'fixedSalary' | 'purchaseManager' | 'unconfigured';
  payrollStatus: 'OK' | 'Проверить';
  payrollReasons: string[];
};

export type PayrollAttendanceSourceType = 'form' | 'schedule_only' | 'manual_excluded' | 'manual_special';

export type PayrollAttendanceConfig = {
  attendanceNames: string[];
  sourceType: PayrollAttendanceSourceType;
  comment: string;
};

export const payrollEmployees: Record<string, PayrollEmployee> = {
  'Кештова Бэла': {
    name: 'Кештова Бэла',
    department: 'Финансы и операционный контроль',
    position: 'Финансово-операционный управляющий',
    salaryType: 'vl_percent',
  },
  'Ахобекова Залина': {
    name: 'Ахобекова Залина',
    department: 'Оптовый отдел',
    position: 'Менеджер по оптовым продажам',
    salaryType: 'wholesale_percent',
  },
  'Хурзокова Лиана': {
    name: 'Хурзокова Лиана',
    department: 'Оптовый отдел',
    position: 'Менеджер по оптовым продажам',
    salaryType: 'wholesale_percent',
  },
  'Чеченова Милана': {
    name: 'Чеченова Милана',
    department: 'Розничный отдел',
    position: 'Менеджер по розничным продажам',
    salaryType: 'retail_sales_bonus',
  },
  'Абшаева Зухра': {
    name: 'Абшаева Зухра',
    department: 'Розничный отдел',
    position: 'Менеджер по розничным продажам',
    salaryType: 'retail_sales_bonus',
  },
  'Костеренко Магомед': {
    name: 'Костеренко Магомед',
    department: 'Розничный отдел',
    position: 'Стажёр менеджера по продажам',
    salaryType: 'retail_sales_bonus',
  },
  'Икаев Асад': {
    name: 'Икаев Асад',
    department: 'Розничный отдел',
    position: 'Специалист по поклейке защитных плёнок',
    salaryType: 'retail_sales_bonus',
    activeThroughPeriod: '2026-08',
  },
  'Кумахова Диана': {
    name: 'Кумахова Диана',
    department: 'Розничный отдел',
    position: 'Старший менеджер розничного отдела',
    salaryType: 'retail_sales_bonus',
  },
  'Улубиев Марат': {
    name: 'Улубиев Марат',
    department: 'IT и техническая поддержка',
    position: 'Специалист по сопровождению 1С и IT-инфраструктуры',
    salaryType: 'fixed_salary',
    salary: 10000,
  },
  'Даудова Татьяна': {
    name: 'Даудова Татьяна',
    department: 'Хозяйственный отдел',
    position: 'Сотрудник хозяйственного отдела',
    salaryType: 'fixed_salary',
    salary: 15000,
  },
  'Дагиров Ибрагим': {
    name: 'Дагиров Ибрагим',
    department: 'Отдел закупок',
    position: 'Помощник менеджера по закупкам',
    salaryType: 'fixed_salary',
    salary: 40000,
    activeThroughPeriod: '2026-06',
  },
  'Атабиева Марианна': {
    name: 'Атабиева Марианна',
    department: 'Складской учёт и контроль брака',
    position: 'Специалист по учёту брака',
    salaryType: 'fixed_salary',
    salary: 30000,
  },
  'Жамбекова Саида': {
    name: 'Жамбекова Саида',
    department: 'SMM',
    position: 'SMM-специалист',
    salaryType: 'fixed_salary',
    salary: 30000,
  },
  'Тохов Астемир': {
    name: 'Тохов Астемир',
    department: 'Отдел закупок',
    position: 'Менеджер по закупкам',
    salaryType: 'purchase_manager',
  },
  'Кумыков Мухаммед': {
    name: 'Кумыков Мухаммед',
    department: 'Закупки',
    position: 'Помощник Астемира · с 12.10.2026',
    salaryType: 'purchase_daily',
    dayRate: 1500,
    activeFromPeriod: '2026-10',
  },
};

export function isConfiguredSalaryType(value: string | null): value is ConfiguredSalaryType {
  return Boolean(value && isPayrollWorkbookSalaryTypeConfigured(value));
}

export function buildPayrollEmployeeDirectory(users: PayrollDirectoryUser[], periodKey: string, reportManagerNames: Set<string> = new Set(), useAgreedDays = true) {
  const directory: Record<string, PayrollEmployee> = { ...payrollEmployees };
  if (useAgreedDays && periodKey >= '2026-10') directory['Кумыков Мухаммед'] = {
    ...directory['Кумыков Мухаммед'], agreedDays: periodKey === '2026-10' ? 16 : 20,
  };
  if (periodKey >= FILM_TRAINEE_PERIOD) directory[FILM_TRAINEE_NAME] = {
    name: FILM_TRAINEE_NAME, department: 'Розничные продажи',
    position: 'Стажёр по поклейке · услуги 70%', salaryType: 'retail_sales_bonus',
    activeFromPeriod: FILM_TRAINEE_PERIOD,
  };
  for (const user of users) {
    const name = user.payrollName?.trim() || user.name.trim();
    if (!name) continue;
    const salaryType = user.payrollSalaryType;
    const hasConfiguredRule = isConfiguredSalaryType(salaryType);
    const hasReportActivity = reportManagerNames.has(name);
    if ((hasConfiguredRule && !isPayrollEmployeeRuleActive(user, periodKey)) || (!user.isActive && !(hasConfiguredRule && hasReportActivity))) {
      delete directory[name];
      continue;
    }
    if (!hasConfiguredRule) continue;
    const existing = directory[name];
    directory[name] = {
      name,
      department: user.payrollReportGroup || getPayrollWorkbookGroup(salaryType),
      position: existing?.position || user.payrollReportGroup || getPayrollWorkbookGroup(salaryType),
      salaryType,
      salary: salaryType === 'fixed_salary' ? user.payrollFixedSalary ?? 0 : undefined,
      dayRate: existing?.dayRate,
      agreedDays: salaryType === 'purchase_daily' ? existing?.agreedDays : undefined,
      activeFromPeriod: user.payrollRuleFrom ?? existing?.activeFromPeriod,
      activeThroughPeriod: user.payrollRuleThrough ?? existing?.activeThroughPeriod,
    };
  }
  return Object.fromEntries(Object.entries(directory).filter(([, employee]) => isPayrollEmployeeActiveForPeriod(employee, periodKey)));
}

export function buildUnconfiguredPayrollRows(users: PayrollDirectoryUser[], directory: Record<string, PayrollEmployee>, periodKey: string, accountedEmployeeNames: Set<string>): FullPayrollRow[] {
  return users
    .filter((user) => {
      if (!user.isActive || user.role !== 'EMPLOYEE') return false;
      const name = user.payrollName?.trim() || user.name.trim();
      if (!name || directory[name] || accountedEmployeeNames.has(name) || payrollExcludedEmployeeNames.includes(name)) return false;
      return !isConfiguredSalaryType(user.payrollSalaryType) || !isPayrollEmployeeRuleActive(user, periodKey);
    })
    .map((user) => ({
      manager: user.payrollName?.trim() || user.name.trim(),
      department: user.department === 'wholesale' ? 'Опт' as const : 'Розница' as const,
      payrollDepartment: 'Требует настройки',
      position: 'Сотрудник',
      salaryType: 'unconfigured' as const,
      revenue: 0, grossProfit: 0, creditBonus: 0, filmBonus: 0, plotterBonus: 0, techBonus: 0, accessoryBonus: 0,
      wholesaleBonus: 0, totalBonus: 0, workedDays: null, lateCount: null, advance: 0, agentCreditCommission: 0,
      fixedSalary: 0, fixedBonus: 0, fixedDeduction: 0, purchaseBase: null, purchasePercent: 0, purchasePercentAmount: 0,
      purchaseTargetAdjustment: 0, purchaseTargetSalary: 0, comment: '', daysSource: 'manual' as const, dayRate: 0,
      dayPay: 0, salesBonus: 0, disciplineBonus: 0, grossPay: 0, netPay: 0, salaryRule: 'unconfigured' as const,
      payrollStatus: 'Проверить' as const,
      payrollReasons: ['Не настроено правило зарплаты для выбранного периода'],
    }));
}

export const payrollAttendanceConfig: Record<string, PayrollAttendanceConfig> = {
  'Кумыков Мухаммед': {
    attendanceNames: [],
    sourceType: 'manual_special',
    comment: 'Отработанные дни подтверждает администратор. Начало работы: 12.10.2026; ставка 1 500 ₽ за день.',
  },
  'Ахобекова Залина': {
    attendanceNames: ['Залина'],
    sourceType: 'form',
    comment: 'Дни и опоздания из Google-формы / рассчитанной посещаемости',
  },
  'Хурзокова Лиана': {
    attendanceNames: ['Ляна', 'Лиана'],
    sourceType: 'form',
    comment: 'Дни и опоздания из Google-формы / рассчитанной посещаемости',
  },
  'Чеченова Милана': {
    attendanceNames: ['Милана'],
    sourceType: 'form',
    comment: 'Дни и опоздания из Google-формы / рассчитанной посещаемости',
  },
  'Абшаева Зухра': {
    attendanceNames: ['Зухра'],
    sourceType: 'form',
    comment: 'Дни и опоздания из Google-формы / рассчитанной посещаемости',
  },
  'Костеренко Магомед': {
    attendanceNames: ['Магомед', 'Косторенко Магомед', 'Магомед Косторенко', 'Костанко Магомед', 'Магомед Костанко', 'Костаренко Магомед', 'Магомед Костаренко'],
    sourceType: 'form',
    comment: 'Варианты фамилии Магомеда считаются как Костеренко Магомед. СтажерРозница привязана к нему только для июня 2026.',
  },
  'Кумахова Диана': {
    attendanceNames: ['Диана', 'Кумахова Диана'],
    sourceType: 'schedule_only',
    comment: 'Не отмечается в Google-форме. Дни можно брать из графика, опоздания вручную.',
  },
  'Кештова Бэла': {
    attendanceNames: [],
    sourceType: 'manual_excluded',
    comment: 'Админ, не отмечается, графика нет. Только ручной ввод.',
  },
  'Икаев Асад': {
    attendanceNames: [],
    sourceType: 'manual_special',
    comment: 'Поклейщик. Пока ручной ввод, позже отдельная схема зарплаты.',
  },
};

export type PayrollAttendanceFormSummary = {
  employee: string;
  formRows: number;
  uniqueFormDates: number;
  workedDays: number;
  lateCount: number;
};

export type PayrollAttendanceScheduleSummary = {
  employee: string;
  scheduleDays: number;
};

export type PayrollAttendancePreviewResponse = {
  period: {
    monthIndex: number;
    year: number;
    periodKey: string;
  };
  attendanceMode: 'demo' | 'google-sheets' | 'google-sheets+pwa';
  attendanceSources?: PayrollAttendanceSourceSummary[];
  attendanceMessage: string;
  scheduleMode: 'not-configured' | 'google-sheets';
  scheduleMessage: string;
  formSummaries: PayrollAttendanceFormSummary[];
  scheduleSummaries: PayrollAttendanceScheduleSummary[];
  snapshot: {
    servedFrom: 'stored' | 'refreshed';
    sourceCheckedAt: string;
    savedAt: string;
    refreshError?: string;
  };
};

export const purchaseManagerName = 'Тохов Астемир';

export const purchaseTargetSalary = 100000;

export const purchaseStandardWorkedDays = 20;

export const purchaseDayRate = 600;

export const purchasePercent = 0.0175;

export const agentCreditCommissionEmployee = 'Кумахова Диана';

export const retailTraineePayrollName = 'Костеренко Магомед';

export const payrollExcludedEmployeeNames = ['Кештова Аслан', 'Кештова Амир', 'Кештов Аслан', 'Кештов Амир', 'Атабиева Муслим', 'Атабиев Муслим'];

export const payrollManagerAliases: Record<string, string> = {
  [normalizeText('Косторенко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Косторенко')]: retailTraineePayrollName,
  [normalizeText('Костеренко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костеренко')]: retailTraineePayrollName,
  [normalizeText('Костенко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костенко')]: retailTraineePayrollName,
  [normalizeText('Костанко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костанко')]: retailTraineePayrollName,
  [normalizeText('Костаренко Магомед')]: retailTraineePayrollName,
  [normalizeText('Магомед Костаренко')]: retailTraineePayrollName,
};

export const calculationFormulas: Record<CalculationType, string> = {
  WHOLESALE_EXCLUDED_TECH: 'не входит в базу опта',
  WHOLESALE_REVIEW_TECH: 'входит в базу опта, требует проверки',
  WHOLESALE_INCLUDED_1_75: 'выручка × 1.75%',
  CREDIT_GROSS_PROFIT: 'ВП × 0.91 × 10%',
  CREDIT_ACCESSORY_NO_BONUS: 'выручка × ставку команды',
  CREDIT_REVIEW_NO_BONUS: 'кредитная строка без начисления до классификации',
  RETAIL_REVIEW_TECH: 'выручка × 5%, требует проверки',
  RETAIL_FILM_50: 'выручка × 50%',
  RETAIL_PLOTTER_MATERIAL_COST_50: 'с/с × 50%',
  RETAIL_GROSS_PROFIT_10: 'ВП × 10%',
  RETAIL_ACCESSORY_5: 'выручка × ставку команды',
  MANUAL_EXCLUDED: 'не входит в начисления',
};

export function normalizeText(value: CellValue) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPayrollManagerName(manager: string) {
  const normalized = normalizeText(manager);
  if (normalized.includes('магомед') && /(косторенко|костеренко|костенко|костанко|костаренко)/.test(normalized)) {
    return retailTraineePayrollName;
  }
  return payrollManagerAliases[normalized] ?? manager;
}

export function mapLegacyRetailTraineeRowsForPeriod<T extends SalesRow>(rows: T[], month: string, year: string): T[] {
  const periodKey = `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
  return rows.flatMap((row) => {
    const manager = getPayrollSalesManagerNameForPeriod(row.manager, periodKey);
    return manager ? [{ ...row, manager }] : [];
  });
}

export function isCreditSale(row: SalesRow) {
  return normalizeText(row.client).includes('кредит/рассрочка');
}

export function isAccessoryBonusRow(row: ClassifiedSalesRow) {
  const calculationType = String(row.calculationType).trim();
  if (calculationType === 'RETAIL_ACCESSORY_5' || calculationType === 'CREDIT_ACCESSORY_NO_BONUS') return true;
  if (row.formula === calculationFormulas.RETAIL_ACCESSORY_5 && row.percent === 0.05) return true;
  if (normalizeText(row.calculationLabel).includes('аксессуар')) return true;
  if (normalizeText(row.classificationReason).includes('аксессуар')) return true;
  return row.matchedRule === 'accessory-category' || row.matchedRule === 'accessory-item-marker' || row.matchedRule.startsWith('credit-accessory:');
}

export function getAccessoryCalculationRows(rows: ClassifiedSalesRow[]) {
  return rows.filter((row) => isAccessoryBonusRow(row));
}

export function getAccessoryCalculationBase(row: ClassifiedSalesRow) {
  return row.revenue;
}

export function parseManualNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePersonName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isBelaManager(manager: string) {
  const normalized = normalizePersonName(manager);
  return normalized.includes('бэла') || normalized.includes('бела') || normalized.includes('кештова');
}

export function isNoDayPayManager(manager: string) {
  return normalizePersonName(manager).includes('асад') || isFilmTrainee(manager);
}

export function getDayRate(department: Department) {
  return department === 'Опт' ? 500 : 600;
}

export function getDefaultPayrollDepartment(employee: PayrollEmployee): Department {
  return employee.salaryType === 'wholesale_percent' ? 'Опт' : 'Розница';
}

export function isPayrollEmployeeActiveForPeriod(employee: PayrollEmployee, periodKey: string) {
  return (!employee.activeFromPeriod || periodKey >= employee.activeFromPeriod)
    && (!employee.activeThroughPeriod || periodKey <= employee.activeThroughPeriod);
}

export function buildEmptyManagerSummary(employee: PayrollEmployee): BonusManagerSummary {
  return {
    manager: employee.name,
    department: getDefaultPayrollDepartment(employee),
    revenue: 0,
    grossProfit: 0,
    creditBonus: 0,
    filmBonus: 0,
    plotterBonus: 0,
    techBonus: 0,
    accessoryBonus: 0,
    wholesaleBonus: 0,
    totalBonus: 0,
  };
}

export function mergeBonusManagerSummaries(managerSummaries: BonusManagerSummary[]) {
  const merged = new Map<string, BonusManagerSummary>();

  for (const summary of managerSummaries) {
    const manager = getPayrollManagerName(summary.manager);
    const current = merged.get(manager);
    if (!current) {
      merged.set(manager, { ...summary, manager });
      continue;
    }

    current.revenue += summary.revenue;
    current.grossProfit += summary.grossProfit;
    current.creditBonus += summary.creditBonus;
    current.filmBonus += summary.filmBonus;
    current.plotterBonus += summary.plotterBonus;
    current.techBonus += summary.techBonus;
    current.accessoryBonus += summary.accessoryBonus;
    current.wholesaleBonus += summary.wholesaleBonus;
    current.totalBonus += summary.totalBonus;
  }

  return Array.from(merged.values());
}

export function buildSalesPayrollSummaries(managerSummaries: BonusManagerSummary[], employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees) {
  const mergedManagerSummaries = mergeBonusManagerSummaries(managerSummaries);
  const summariesByManager = new Map(mergedManagerSummaries.map((summary) => [summary.manager, summary]));
  const payrollSalesSummaries = Object.values(employeeDirectory)
    .filter((employee) => employee.salaryType === 'vl_percent' || employee.salaryType === 'wholesale_percent' || employee.salaryType === 'retail_sales_bonus' || employee.salaryType === 'purchase_daily')
    .map((employee) => summariesByManager.get(employee.name) ?? buildEmptyManagerSummary(employee));
  const reportOnlySummaries = mergedManagerSummaries.filter((summary) => !employeeDirectory[summary.manager]);

  return [...payrollSalesSummaries, ...reportOnlySummaries];
}

export function applyRetailAccessoryTier(
  managerSummaries: BonusManagerSummary[],
  rows: ClassifiedSalesRow[],
  employeeDirectory: Record<string, PayrollEmployee>,
  periodKey: string,
) {
  const eligibleManagers = new Set(
    Object.values(employeeDirectory)
      .filter((employee) => employee.salaryType === 'retail_sales_bonus')
      .map((employee) => employee.name),
  );
  const eligibleRows = getAccessoryCalculationRows(rows).filter((row) => eligibleManagers.has(row.manager));
  const tier = getRetailAccessoryTier(periodKey, eligibleRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0));
  const basesByManager = eligibleRows.reduce<Map<string, number>>((bases, row) => {
    bases.set(row.manager, (bases.get(row.manager) ?? 0) + getAccessoryCalculationBase(row));
    return bases;
  }, new Map());

  const summaries = managerSummaries.map((summary) => {
    if (!eligibleManagers.has(summary.manager)) return summary;
    const accessoryBase = basesByManager.get(summary.manager) ?? 0;
    const accessoryBonus = accessoryBase * tier.rate;
    return {
      ...summary,
      accessoryBase,
      accessoryRate: tier.rate,
      accessoryBonus,
      totalBonus: summary.totalBonus - summary.accessoryBonus + accessoryBonus,
    };
  });

  return { summaries, eligibleManagers, eligibleRows, tier };
}

export function buildFullPayrollRow(summary: BonusManagerSummary, manual: PayrollManualInput | undefined, employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees): FullPayrollRow {
  const employee = employeeDirectory[summary.manager];
  if (!employee) {
    return {
      ...summary,
      payrollDepartment: PAYROLL_WORKBOOK_UNCONFIGURED_GROUP,
      position: 'Сотрудник',
      salaryType: 'unconfigured',
      workedDays: null,
      lateCount: null,
      advance: 0,
      agentCreditCommission: 0,
      fixedSalary: 0,
      fixedBonus: 0,
      fixedDeduction: 0,
      purchaseBase: null,
      purchasePercent: 0,
      purchasePercentAmount: 0,
      purchaseTargetAdjustment: 0,
      purchaseTargetSalary: 0,
      comment: manual?.comment ?? '',
      daysSource: 'manual',
      dayRate: 0,
      dayPay: 0,
      salesBonus: 0,
      disciplineBonus: 0,
      grossPay: 0,
      netPay: 0,
      salaryRule: 'unconfigured',
      payrollStatus: 'Проверить',
      payrollReasons: ['Не настроено правило зарплаты для выбранного периода'],
    };
  }
  const salaryType = employee.salaryType;
  const manualWorkedDays = parseManualNumber(manual?.workedDays ?? '');
  const manualLateCount = parseManualNumber(manual?.lateCount ?? '');
  const salaryRule = salaryType === 'purchase_daily' ? 'daily' : isBelaManager(summary.manager) ? 'belaPercent' : isNoDayPayManager(summary.manager) ? 'noDayPay' : 'standard';
  const dayPayNotRequired = salaryRule !== 'standard' && salaryRule !== 'daily';
  const workedDays = dayPayNotRequired ? null : employee.agreedDays ?? manualWorkedDays;
  const lateCount = dayPayNotRequired || salaryRule === 'daily' ? null : manualLateCount;
  const advance = parseManualNumber(manual?.advance ?? '') ?? 0;
  const agentCreditCommission = summary.manager === agentCreditCommissionEmployee ? parseManualNumber(manual?.agentCreditCommission ?? '') ?? 0 : 0;
  const dayRate = dayPayNotRequired ? 0 : salaryRule === 'daily' ? employee.dayRate ?? 0 : getDayRate(summary.department);
  const dayPay = workedDays === null ? 0 : workedDays * dayRate;
  const salesBonus = salaryRule === 'belaPercent' || salaryRule === 'daily' ? 0 : salaryType === 'wholesale_percent' ? summary.wholesaleBonus : summary.totalBonus;
  const disciplineBonus = salaryRule === 'standard' && lateCount !== null && lateCount <= 3 ? 3000 : 0;
  const grossPay = dayPay + salesBonus + disciplineBonus + agentCreditCommission;
  const netPay = grossPay - advance;
  const payrollReasons = [
    !dayPayNotRequired && workedDays === null ? 'Не заполнены отработанные дни' : '',
    salaryRule === 'standard' && lateCount === null ? 'Не указаны опоздания' : '',
    salaryRule === 'daily' && dayRate <= 0 ? 'Не задана ставка за день' : '',
    salaryRule === 'daily' && workedDays !== null && (workedDays < 0 || workedDays > 31) ? 'Укажите отработанные дни от 0 до 31' : '',
    advance > grossPay ? 'Аванс больше начислений' : '',
  ].filter(Boolean);

  return {
    ...summary,
    payrollDepartment: employee?.department ?? summary.department,
    position: employee?.position ?? 'Сотрудник',
    salaryType,
    workedDays,
    lateCount,
    advance,
    agentCreditCommission,
    fixedSalary: 0,
    fixedBonus: 0,
    fixedDeduction: 0,
    purchaseBase: null,
    purchasePercent: 0,
    purchasePercentAmount: 0,
    purchaseTargetAdjustment: 0,
    purchaseTargetSalary: 0,
    comment: manual?.comment ?? '',
    daysSource: manual?.source ?? 'manual',
    dayRate,
    dayPay,
    salesBonus,
    disciplineBonus,
    grossPay,
    netPay,
    salaryRule,
    payrollStatus: payrollReasons.length ? 'Проверить' : 'OK',
    payrollReasons,
  };
}

export function getPayrollManualInput(manager: string, manualPayroll: Record<string, PayrollManualInput>) {
  const direct = manualPayroll[manager];
  if (direct || manager !== retailTraineePayrollName) return direct;

  return (
    manualPayroll['Магомед Косторенко'] ??
    manualPayroll['Косторенко Магомед'] ??
    manualPayroll['Магомед Костеренко'] ??
    manualPayroll['Костеренко Магомед'] ??
    manualPayroll['Магомед Костенко'] ??
    manualPayroll['Костенко Магомед'] ??
    manualPayroll['Магомед Костанко'] ??
    manualPayroll['Костанко Магомед'] ??
    manualPayroll['Магомед Костаренко'] ??
    manualPayroll['Костаренко Магомед']
  );
}

export function applyBelaPercentRule(rows: FullPayrollRow[], periodKey: string): FullPayrollRow[] {
  const baseRows = rows.filter((row) => row.salaryRule !== 'belaPercent' && isBelaBaseEmployee(row.manager));
  const belaBaseGrossPay = baseRows.reduce((sum, row) => sum + row.grossPay - (row.oneTimeBonus ?? 0), 0);
  const minimum = getBelaMinimum(periodKey);

  return rows.map((row) => {
    if (row.salaryRule !== 'belaPercent') return row;
    const belaPercentAmount = minimum ? payrollMoney(belaBaseGrossPay * 0.12) : belaBaseGrossPay * 0.12;
    const minimumGuaranteeAdjustment = minimum ? payrollMoney(Math.max(0, minimum - belaPercentAmount)) : 0;
    const grossPay = belaPercentAmount + minimumGuaranteeAdjustment;
    const netPay = grossPay - row.advance;
    const payrollReasons = row.advance > grossPay ? ['Аванс больше начислений'] : [];
    return {
      ...row,
      belaBase: belaBaseGrossPay,
      belaPercentAmount,
      minimumGuaranteeAdjustment,
      grossPay,
      netPay,
      payrollStatus: payrollReasons.length ? 'Проверить' as const : 'OK' as const,
      payrollReasons,
    };
  });
}

export function applyPayrollBonuses(rows: FullPayrollRow[], bonuses: PayrollBonus[]): FullPayrollRow[] {
  return rows.map((row) => {
    const oneTimeBonus = getPayrollBonusTotal(bonuses, row.manager);
    const grossPay = row.grossPay + oneTimeBonus;
    const payrollReasons = row.payrollReasons.filter((reason) => reason !== 'Аванс больше начислений');
    if (row.advance > grossPay) payrollReasons.push('Аванс больше начислений');
    return { ...row, oneTimeBonus, grossPay, netPay: row.netPay + oneTimeBonus, payrollReasons, payrollStatus: payrollReasons.length ? 'Проверить' : 'OK' };
  });
}

export function buildFixedPayrollRows(inputs: Record<string, FixedPayrollInput>, periodKey: string, employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees): FullPayrollRow[] {
  return Object.values(employeeDirectory)
    .filter((employee) => employee.salaryType === 'fixed_salary' && isPayrollEmployeeActiveForPeriod(employee, periodKey))
    .map((employee) => {
      const input = inputs[employee.name];
      const fixedSalary = employee.salary ?? 0;
      const fixedBonus = parseManualNumber(input?.bonus ?? '') ?? 0;
      const advance = parseManualNumber(input?.advance ?? '') ?? 0;
      const fixedDeduction = parseManualNumber(input?.deduction ?? '') ?? 0;
      const grossPay = fixedSalary + fixedBonus;
      const netPay = grossPay - advance - fixedDeduction;
      const payrollReasons = fixedSalary > 0 ? [] : ['Не заполнен оклад'];

      return {
        manager: employee.name,
        department: 'Розница',
        payrollDepartment: employee.department,
        position: employee.position,
        salaryType: employee.salaryType,
        revenue: 0,
        grossProfit: 0,
        creditBonus: 0,
        filmBonus: 0,
        plotterBonus: 0,
        techBonus: 0,
        accessoryBonus: 0,
        wholesaleBonus: 0,
        totalBonus: 0,
        workedDays: null,
        lateCount: null,
        advance,
        agentCreditCommission: 0,
        fixedSalary,
        fixedBonus,
        fixedDeduction,
        purchaseBase: null,
        purchasePercent: 0,
        purchasePercentAmount: 0,
        purchaseTargetAdjustment: 0,
        purchaseTargetSalary: 0,
        comment: input?.comment ?? '',
        daysSource: 'manual',
        dayRate: 0,
        dayPay: 0,
        salesBonus: 0,
        disciplineBonus: 0,
        grossPay,
        netPay,
        salaryRule: 'fixedSalary',
        payrollStatus: payrollReasons.length ? 'Проверить' : 'OK',
        payrollReasons,
      } satisfies FullPayrollRow;
    });
}

export function buildPurchasePayrollRow(input: PurchasePayrollInput | undefined, report: PurchaseReportState | null, employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees): FullPayrollRow {
  const employee = employeeDirectory[purchaseManagerName] ?? payrollEmployees[purchaseManagerName];
  const purchaseBase = report?.base ?? null;
  const purchasePercentAmount = purchaseBase === null ? 0 : purchaseBase * purchasePercent;
  const dayPay = purchaseStandardWorkedDays * purchaseDayRate;
  const rawAdjustment = purchaseTargetSalary - dayPay - purchasePercentAmount;
  const purchaseTargetAdjustment = purchaseBase === null ? 0 : Math.max(rawAdjustment, 0);
  const advance = parseManualNumber(input?.advance ?? '') ?? 0;
  const fixedDeduction = parseManualNumber(input?.deduction ?? '') ?? 0;
  const grossPay = dayPay + purchasePercentAmount + purchaseTargetAdjustment;
  const netPay = grossPay - advance - fixedDeduction;
  const payrollReasons = [
    purchaseBase === null ? 'Отчёт закупок не загружен или сумма закупок не найдена' : '',
  ].filter(Boolean);

  return {
    manager: employee.name,
    department: 'Розница',
    payrollDepartment: employee.department,
    position: employee.position,
    salaryType: 'purchase_manager',
    revenue: 0,
    grossProfit: 0,
    creditBonus: 0,
    filmBonus: 0,
    plotterBonus: 0,
    techBonus: 0,
    accessoryBonus: 0,
    wholesaleBonus: 0,
    totalBonus: 0,
    workedDays: purchaseStandardWorkedDays,
    lateCount: null,
    advance,
    agentCreditCommission: 0,
    fixedSalary: 0,
    fixedBonus: 0,
    fixedDeduction,
    purchaseBase,
    purchasePercent,
    purchasePercentAmount,
    purchaseTargetAdjustment,
    purchaseTargetSalary,
    comment: input?.comment ?? '',
    daysSource: 'manual',
    dayRate: purchaseDayRate,
    dayPay,
    salesBonus: 0,
    disciplineBonus: 0,
    grossPay,
    netPay,
    salaryRule: 'purchaseManager',
    payrollStatus: payrollReasons.length ? 'Проверить' : 'OK',
    payrollReasons,
  };
}

export function findAttendanceMatches<T extends { employee: string }>(rows: T[], attendanceNames: string[]) {
  const normalizedNames = attendanceNames.map((name) => normalizePersonName(name)).filter(Boolean);

  return rows.filter((row) => {
    const normalizedEmployee = normalizePersonName(row.employee);
    return normalizedNames.some((name) => normalizedEmployee === name || normalizedEmployee.includes(name) || name.includes(normalizedEmployee));
  });
}

export function applyAutomaticAttendanceInputs(
  employeeNames: string[],
  currentInputs: Record<string, PayrollManualInput>,
  preview: PayrollAttendancePreviewResponse | null,
  periodKey: string,
) {
  if (!preview || preview.period.periodKey !== periodKey) return currentInputs;

  const next = { ...currentInputs };
  for (const employeeName of employeeNames) {
    const config = payrollAttendanceConfig[employeeName];
    if (!config || config.sourceType === 'manual_excluded' || config.sourceType === 'manual_special') continue;

    const previous = {
      ...(getPayrollManualInput(employeeName, currentInputs) ?? {
        workedDays: '',
        lateCount: '',
        advance: '',
        comment: '',
      }),
    };
    if (previous.source === 'manualCorrection') continue;

    if (config.sourceType === 'form') {
      const matches = Array.from(new Map(
        findAttendanceMatches(preview.formSummaries, config.attendanceNames)
          .map((match) => [normalizePersonName(match.employee), match]),
      ).values());
      if (matches.length !== 1) continue;
      previous.workedDays = String(matches[0].uniqueFormDates);
      previous.lateCount = String(matches[0].lateCount);
      previous.source = 'attendance';
      next[employeeName] = previous;
      continue;
    }

    const matches = Array.from(new Map(
      findAttendanceMatches(preview.scheduleSummaries, config.attendanceNames)
        .map((match) => [normalizePersonName(match.employee), match]),
    ).values());
    if (matches.length !== 1) continue;
    previous.workedDays = String(matches[0].scheduleDays);
    previous.source = 'schedule';
    next[employeeName] = previous;
  }

  return next;
}
