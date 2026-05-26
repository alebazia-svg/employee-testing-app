'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, FileSpreadsheet, Upload } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Table } from '@/components/ui/table';

type CellValue = string | number | boolean | Date | null | undefined;
type Row = CellValue[];

type SheetRow = {
  values: Row;
  excelRow: number;
  outlineLevel?: number;
  indentLevel: number;
};

type ParsedWorkbook = {
  fileName: string;
  sheetNames: string[];
  sheets: Record<string, SheetRow[]>;
};

type HeaderMap = {
  manager: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  profitability: number;
};

type SalesRow = {
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
};

type Department = 'Опт' | 'Розница';

type CalculationType =
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
  | 'RETAIL_ACCESSORY_5';

type ClassifiedSalesRow = SalesRow & {
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

type ProblemType =
  | 'all'
  | 'credit'
  | 'disputed'
  | 'wholesaleReview'
  | 'retailReview'
  | 'negative'
  | 'zeroBase'
  | 'unclassified'
  | 'accessoryExcluded'
  | 'expensiveUnclassified'
  | 'invalidNumbers'
  | 'disciplineBonusRemoved';

type SalesProblemType = Exclude<ProblemType, 'all' | 'disciplineBonusRemoved'>;

type ProblemRow =
  | {
      kind: 'sales';
      row: ClassifiedSalesRow;
      type: SalesProblemType;
      label: string;
    }
  | {
      kind: 'payroll';
      row: FullPayrollRow;
      type: Exclude<ProblemType, 'all' | SalesProblemType>;
      label: string;
    };

type CalculationTypeSummary = {
  type: CalculationType;
  label: string;
  rows: number;
  revenue: number;
  grossProfit: number;
  base: number;
  formula: string;
  bonus: number;
};

type BonusManagerSummary = {
  manager: string;
  department: Department;
  revenue: number;
  grossProfit: number;
  creditBonus: number;
  filmBonus: number;
  plotterBonus: number;
  techBonus: number;
  accessoryBonus: number;
  wholesaleBonus: number;
  totalBonus: number;
};

type PayrollManualInput = {
  workedDays: string;
  lateCount: string;
  advance: string;
  agentCreditCommission?: string;
  comment: string;
  source?: PayrollDaysSource;
};

type PayrollDaysSource = 'manual' | 'attendance' | 'schedule' | 'manualCorrection';
type SalaryType = 'vl_percent' | 'wholesale_percent' | 'retail_sales_bonus' | 'fixed_salary' | 'purchase_manager';

type PayrollEmployee = {
  name: string;
  department: string;
  position: string;
  salaryType: SalaryType;
  salary?: number;
};

type FixedPayrollInput = {
  bonus: string;
  advance: string;
  deduction: string;
  comment: string;
};

type PurchasePayrollInput = {
  advance: string;
  deduction: string;
  comment: string;
};

type PurchaseReportState = {
  fileName: string;
  base: number | null;
  sourceRow: number | null;
};

type FullPayrollRow = BonusManagerSummary & {
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
  salaryRule: 'standard' | 'noDayPay' | 'belaPercent' | 'fixedSalary' | 'purchaseManager';
  payrollStatus: 'OK' | 'Проверить';
  payrollReasons: string[];
};

type WholesaleCalculation = {
  zalinaRevenue: number;
  lianaRevenue: number;
  totalRevenue: number;
  excludedTechRevenue: number;
  base: number;
  bonusEach: number;
};

type ClassificationResult = {
  rows: ClassifiedSalesRow[];
  wholesale: WholesaleCalculation;
  typeSummaries: CalculationTypeSummary[];
  managerSummaries: BonusManagerSummary[];
  disputedRows: ClassifiedSalesRow[];
  accessoryExcludedRows: ClassifiedSalesRow[];
  expensiveReviewRows: ClassifiedSalesRow[];
  counts: {
    total: number;
    wholesale: number;
    retail: number;
    credit: number;
    film: number;
    retailTech: number;
    accessory: number;
    wholesaleExcludedTech: number;
  };
};

type ManagerSummary = {
  manager: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  profitability: number;
};

type CategorySummary = {
  manager: string;
  category: string;
  revenue: number;
  grossProfit: number;
};

type CreditSummary = {
  manager: string;
  grossProfit: number;
  baseAfterNinePercent: number;
  bonus: number;
};

type WholesaleCategorySummary = {
  category: string;
  rows: number;
  revenue: number;
  grossProfit: number;
  includedInWholesaleBase: boolean;
  status: string;
};

type ParseWarning = {
  excelRow: number;
  text: string;
  reason: string;
};

type DiagnosticRow = {
  excelRow: number;
  text: string;
  outlineLevel?: number;
  detectedLevel: 'manager' | 'client' | 'registrar' | 'category' | 'item' | 'document' | 'ignored';
  currentManager: string;
  currentClient: string;
  currentRegistrar: string;
  currentCategory: string;
  revenue: number;
  grossProfit: number;
};

type DiagnosticLevelSummary = {
  level: DiagnosticRow['detectedLevel'];
  count: number;
  examples: string[];
};

type PayrollAttendanceSourceType = 'form' | 'schedule_only' | 'manual_excluded' | 'manual_special';

type PayrollAttendanceConfig = {
  attendanceNames: string[];
  sourceType: PayrollAttendanceSourceType;
  comment: string;
};

const payrollEmployees: Record<string, PayrollEmployee> = {
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
  'СтажерРозница': {
    name: 'СтажерРозница',
    department: 'Розничный отдел',
    position: 'Стажёр менеджера по продажам',
    salaryType: 'retail_sales_bonus',
  },
  'Икаев Асад': {
    name: 'Икаев Асад',
    department: 'Розничный отдел',
    position: 'Специалист по поклейке защитных плёнок',
    salaryType: 'retail_sales_bonus',
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
};

const payrollAttendanceConfig: Record<string, PayrollAttendanceConfig> = {
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
  'СтажерРозница': {
    attendanceNames: ['Магомед'],
    sourceType: 'form',
    comment: 'Магомед в посещаемости = СтажерРозница в зарплате',
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

type PayrollAttendanceFormSummary = {
  employee: string;
  formRows: number;
  uniqueFormDates: number;
  workedDays: number;
  lateCount: number;
};

type PayrollAttendanceScheduleSummary = {
  employee: string;
  scheduleDays: number;
};

type PayrollAttendancePreviewResponse = {
  period: {
    monthIndex: number;
    year: number;
    periodKey: string;
  };
  attendanceMode: 'demo' | 'google-sheets';
  attendanceMessage: string;
  scheduleMode: 'not-configured' | 'google-sheets';
  scheduleMessage: string;
  formSummaries: PayrollAttendanceFormSummary[];
  scheduleSummaries: PayrollAttendanceScheduleSummary[];
};

type AttendanceApplyResult = {
  fullApplied: number;
  daysOnlyApplied: number;
  skipped: number;
  preservedManualFields: number;
  rows: Array<{
    manager: string;
    sourceType: PayrollAttendanceSourceType;
    appliedWorkedDays: number | null;
    daySourceField: string;
    appliedLateCount: number | null;
  }>;
};

type PayrollParseResult = {
  headerIndex: number;
  headerMap: HeaderMap | null;
  columns: string[];
  rows: SalesRow[];
  isRegistrarReport: boolean;
  isSafeForPayrollCalculation: boolean;
  safetyWarnings: ParseWarning[];
  sourceRowCount: number;
  detailRowCount: number;
  managers: string[];
  clients: string[];
  categories: string[];
  warnings: ParseWarning[];
  diagnostics: DiagnosticRow[];
  levelSummaries: DiagnosticLevelSummary[];
  strategy: string;
  managerSummaries: ManagerSummary[];
  managerCategorySummaries: CategorySummary[];
  creditSummaries: CreditSummary[];
};

type SheetLike = {
  [cell: string]: unknown;
  '!ref'?: string;
  '!rows'?: Array<{ level?: number; hidden?: boolean } | undefined>;
};

const months = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const years = Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 3 + index);
const purchaseManagerName = 'Тохов Астемир';
const purchaseTargetSalary = 100000;
const purchaseStandardWorkedDays = 20;
const purchaseDayRate = 600;
const purchasePercent = 0.0175;
const agentCreditCommissionEmployee = 'Кумахова Диана';
const asadManagerName = 'Икаев Асад';

const headerAliases = {
  manager: ['менеджер'],
  revenue: ['выручка'],
  cost: ['себестоимость товаров', 'себестоимость'],
  grossProfit: ['валовая прибыль'],
  profitability: ['рентабельность, %', 'рентабельность %', 'рентабельность'],
};

const knownManagers = [
  'Ахобекова Залина',
  'Хурзокова Лиана',
  'Чеченова Милана',
  'Абшаева Зухра',
  'Кумахова Диана',
  'Кештова Бэла',
  'СтажерРозница',
  'Икаев Асад',
].map(normalizeText);

const knownCategoryHints = [
  'зарядные устройства',
  'защитные стекла',
  'защитные стекла и пленки',
  'смартфоны',
  'смартфоны (хар-ки)',
  'чехлы',
  'чехлы, накладки, сумки и бампера',
  'кабели',
  'наушники',
  'наушники и гарнитура',
  'услуги оказываемые',
  'аксессуары',
  'аккумуляторы',
  'блоки питания',
  'колонки',
  'карты памяти',
  'переходники',
  'ремешки',
  'умные часы',
  'планшеты',
  'гаджеты',
  'прочее',
].map(normalizeText);

const wholesaleManagers = ['Ахобекова Залина', 'Хурзокова Лиана'];

const calculationLabels: Record<CalculationType, string> = {
  WHOLESALE_EXCLUDED_TECH: 'Опт: исключённая техника',
  WHOLESALE_REVIEW_TECH: 'Опт: спорная техника',
  WHOLESALE_INCLUDED_1_75: 'Опт: база 1.75%',
  CREDIT_GROSS_PROFIT: 'Кредит: ВП × 0.91 × 10%',
  CREDIT_ACCESSORY_NO_BONUS: 'Кредитный аксессуар: без бонуса',
  CREDIT_REVIEW_NO_BONUS: 'Кредит: требуется классификация',
  RETAIL_REVIEW_TECH: 'Розница: спорная техника',
  RETAIL_FILM_50: 'Услуги оказываемые: 50%',
  RETAIL_PLOTTER_MATERIAL_COST_50: 'Плоттерные материалы: 50% от с/с',
  RETAIL_GROSS_PROFIT_10: 'Техника: 10% от ВП',
  RETAIL_ACCESSORY_5: 'Аксессуары: 5%',
};

const calculationFormulas: Record<CalculationType, string> = {
  WHOLESALE_EXCLUDED_TECH: 'не входит в базу опта',
  WHOLESALE_REVIEW_TECH: 'входит в базу опта, требует проверки',
  WHOLESALE_INCLUDED_1_75: 'выручка × 1.75%',
  CREDIT_GROSS_PROFIT: 'ВП × 0.91 × 10%',
  CREDIT_ACCESSORY_NO_BONUS: 'не входит в кредитный бонус',
  CREDIT_REVIEW_NO_BONUS: 'кредитная строка без начисления до классификации',
  RETAIL_REVIEW_TECH: 'выручка × 5%, требует проверки',
  RETAIL_FILM_50: 'выручка × 50%',
  RETAIL_PLOTTER_MATERIAL_COST_50: 'с/с × 50%',
  RETAIL_GROSS_PROFIT_10: 'ВП × 10%',
  RETAIL_ACCESSORY_5: 'выручка × 5%',
};

const accessoryCategories = [
  'Зарядные устройства',
  'Чехлы, накладки, сумки и бампера',
  'Защитные стекла и пленки',
  'Кабели',
  'Наушники и гарнитура',
  'Внешний аккумулятор',
  'Карты памяти и накопители',
  'Периферия для ПК',
  'Держатели',
  'Колонки Микрофоны',
  'Переходники (Адаптеры)',
  'Ремешки',
  'Моноподы',
  'Аккумуляторные батареи',
  'Расходные материалы',
  'Инструмент',
  'Автовизитки',
  'Геймпады (Джостики)',
  'Товары для блогеров',
  'Фото-видео камеры',
  'Игрушки',
].map(normalizeText);

const excludedTechCategories = ['Смартфоны (хар-ки)'].map(normalizeText);
const reviewTechCategories = ['Смарт-часы (без хар-к)', 'Электроника'].map(normalizeText);

function normalizeText(value: CellValue) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatCell(value: CellValue) {
  if (value instanceof Date) return value.toLocaleDateString('ru-RU');
  if (value === null || value === undefined) return '';
  return String(value);
}

function isFilledRow(row: Row) {
  return row.some((cell) => formatCell(cell).trim() !== '');
}

function getFirstText(row: Row) {
  const firstCell = row.find((cell) => formatCell(cell).trim() !== '');
  return formatCell(firstCell).trim();
}

function toNumber(value: CellValue) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = formatCell(value)
    .replace(/\s/g, '')
    .replace('%', '');

  if (text.includes(',') && text.includes('.')) {
    text = text.replaceAll(',', '');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

function formatPercent(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function formatPercentRate(value: number) {
  return `${formatPercent(value * 100)}%`;
}

function getCellValue(cell: unknown): CellValue {
  if (!cell || typeof cell !== 'object') return '';
  const typedCell = cell as { v?: CellValue; w?: string };
  return typedCell.w ?? typedCell.v ?? '';
}

function getIndentLevel(value: CellValue) {
  const text = String(value ?? '');
  const match = text.match(/^(\s+)/);
  return match ? match[1].replace(/\t/g, '    ').length : 0;
}

function sheetToRows(XLSX: typeof import('xlsx'), sheet: SheetLike): SheetRow[] {
  if (!sheet['!ref']) return [];

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows: SheetRow[] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const values: Row = [];

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      values.push(getCellValue(sheet[cellAddress]));
    }

    if (isFilledRow(values)) {
      rows.push({
        values,
        excelRow: rowIndex + 1,
        outlineLevel: sheet['!rows']?.[rowIndex]?.level,
        indentLevel: getIndentLevel(values[0]),
      });
    }
  }

  return rows;
}

function findHeader(rows: SheetRow[]) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const normalizedCells = rows[rowIndex].values.map(normalizeText);
    const hasManager = normalizedCells.some((cell) => headerAliases.manager.some((alias) => cell.includes(alias)));
    const hasRevenue = normalizedCells.some((cell) => headerAliases.revenue.some((alias) => cell.includes(alias)));
    const hasCost = normalizedCells.some((cell) => headerAliases.cost.some((alias) => cell.includes(alias)));
    const hasGrossProfit = normalizedCells.some((cell) => headerAliases.grossProfit.some((alias) => cell.includes(alias)));

    if (hasManager && hasRevenue && hasCost && hasGrossProfit) {
      const findColumn = (aliases: string[]) => normalizedCells.findIndex((cell) => aliases.some((alias) => cell.includes(alias)));
      return {
        headerIndex: rowIndex,
        headerMap: {
          manager: findColumn(headerAliases.manager),
          revenue: findColumn(headerAliases.revenue),
          cost: findColumn(headerAliases.cost),
          grossProfit: findColumn(headerAliases.grossProfit),
          profitability: findColumn(headerAliases.profitability),
        },
      };
    }
  }

  return { headerIndex: -1, headerMap: null };
}

function getHeaderColumns(rows: SheetRow[], headerIndex: number) {
  if (headerIndex < 0) return [];
  return rows[headerIndex].values.map((cell, index) => formatCell(cell).trim() || `Колонка ${index + 1}`);
}

function looksLikeManagerName(text: string) {
  const cleanText = text.trim();
  if (!cleanText || cleanText.includes('/') || cleanText.includes('(')) return false;
  if (normalizeText(cleanText).includes('итого')) return false;

  if (isKnownManagerName(cleanText)) return true;
  if (normalizeText(cleanText).includes('стажер')) return true;

  const parts = cleanText.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;

  return parts.every((part) => /^[А-ЯA-ZЁ][а-яa-zё-]+$/.test(part));
}

function isKnownManagerName(text: string) {
  return knownManagers.includes(normalizeText(text));
}

function isTotalRow(text: string) {
  const normalized = normalizeText(text);
  return normalized === 'итого' || normalized === 'всего' || normalized.startsWith('итого ') || normalized.startsWith('всего ');
}

function isRegistrarDocument(text: string) {
  return containsAny(text, [
    'Реализация товаров и услуг',
    'Возврат товаров от клиента',
    'Корректировка',
    'Заказ клиента',
    'Отчет о розничных продажах',
    'Отчёт о розничных продажах',
    'Регистратор',
  ]);
}

function isHierarchyHeaderRow(text: string) {
  const normalized = normalizeText(text);
  return normalized === 'клиент' || normalized === 'регистратор' || normalized === 'номенклатура.вид номенклатуры' || normalized === 'номенклатура, артикул' || normalized === 'заказ клиента / реализация';
}

function isKnownCategory(text: string) {
  const normalized = normalizeText(text);
  return knownCategoryHints.some((category) => normalized === category || normalized.includes(category));
}

function hasProductMarkers(text: string) {
  const normalized = normalizeText(text);
  return (
    /\d/.test(normalized) ||
    normalized.includes(',') ||
    normalized.includes('iphone') ||
    normalized.includes('airpods') ||
    normalized.includes('type-c') ||
    normalized.includes('usb') ||
    normalized.includes('mah') ||
    normalized.includes('gb') ||
    normalized.includes('original') ||
    normalized.includes('копия') ||
    normalized.includes('apple') ||
    normalized.includes('samsung') ||
    normalized.includes('xiaomi') ||
    normalized.includes('hoco') ||
    normalized.includes('borofone')
  );
}

function hasClientProductMarkers(text: string) {
  return containsAny(text, [
    'кабель',
    'чехол',
    'накладка',
    'стекло',
    'плёнка',
    'пленка',
    'переходник',
    'адаптер',
    'зарядка',
    'блок питания',
    'аккумулятор',
    'батарейка',
    'смартфон',
    'телефон',
    'iphone',
    'samsung',
    'xiaomi',
    'hoco',
    'remax',
    'borofone',
    'apple watch',
    'airpods',
    'наушники',
    'ремешок',
    'камера',
    'видеорегистратор',
    'фен',
    'пылесос',
  ]);
}

function isBroadCategoryCandidate(text: string) {
  const normalized = normalizeText(text);
  if (!normalized || isTotalRow(text) || looksLikeManagerName(text)) return false;
  if (hasProductMarkers(text)) return false;
  if (normalized.includes('покупатель') || normalized.includes('кредит') || normalized.includes('рассрочка') || normalized.includes('store')) return false;
  return text.length <= 80;
}

function isLikelyProduct(text: string) {
  const normalized = normalizeText(text);
  if (!normalized || isTotalRow(text) || looksLikeManagerName(text) || isKnownCategory(text)) return false;
  return hasProductMarkers(text) || text.length > 55;
}

function getHierarchyText(row: SheetRow, headerMap: HeaderMap) {
  return formatCell(row.values[headerMap.manager]).trim();
}

function getOutlineLevel(row: SheetRow, hasOutlineLevels: boolean, baseIndentLevel: number) {
  if (typeof row.outlineLevel === 'number') return row.outlineLevel;
  if (hasOutlineLevels) return 0;
  if (row.indentLevel > baseIndentLevel) return row.indentLevel - baseIndentLevel;
  return null;
}

function sumByKey<T extends Record<string, unknown>>(rows: SalesRow[], keyGetter: (row: SalesRow) => string, create: (row: SalesRow) => T, add: (target: T, row: SalesRow) => void) {
  const map = new Map<string, T>();

  rows.forEach((row) => {
    const key = keyGetter(row);
    const current = map.get(key) ?? create(row);
    add(current, row);
    map.set(key, current);
  });

  return Array.from(map.values());
}

function hasRegistrarHierarchy(rows: SheetRow[], headerIndex: number) {
  return rows
    .slice(headerIndex + 1, headerIndex + 80)
    .some((row) => normalizeText(getFirstText(row.values)) === 'регистратор');
}

function hasDocumentUnderItemHierarchy(rows: SheetRow[], headerIndex: number) {
  const headers = rows.slice(headerIndex + 1, headerIndex + 8).map((row) => normalizeText(getFirstText(row.values)));

  return (
    headers.includes('клиент') &&
    headers.includes('номенклатура.вид номенклатуры') &&
    headers.includes('номенклатура, артикул') &&
    headers.some((header) => header.includes('заказ клиента') && header.includes('реализация'))
  );
}

function getUniqueRegistrars(rows: SalesRow[]) {
  return Array.from(new Set(rows.flatMap((row) => row.registrars.length ? row.registrars : row.registrar ? [row.registrar] : []).filter(Boolean)));
}

function aggregateRowsByProduct(rows: SalesRow[]) {
  const map = new Map<string, SalesRow[]>();

  rows.forEach((row) => {
    const key = [row.manager, row.client, row.category, row.item].map(normalizeText).join('::');
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  });

  return Array.from(map.values()).map((group) => {
    const first = group[0];
    const revenue = group.reduce((sum, row) => sum + row.revenue, 0);
    const cost = group.reduce((sum, row) => sum + row.cost, 0);
    const grossProfit = group.reduce((sum, row) => sum + row.grossProfit, 0);
    const registrars = getUniqueRegistrars(group);

    return {
      ...first,
      registrar: registrars.join(' | '),
      registrars,
      revenue,
      cost,
      grossProfit,
      profitability: revenue ? (grossProfit / revenue) * 100 : 0,
    };
  });
}

function addRegistrarToRow(row: SalesRow, documentName: string) {
  if (!documentName || row.registrars.includes(documentName)) return;
  row.registrars.push(documentName);
  row.registrar = row.registrars.join(' | ');
}

function buildLevelSummaries(diagnostics: DiagnosticRow[]): DiagnosticLevelSummary[] {
  const levels: DiagnosticRow['detectedLevel'][] = ['manager', 'client', 'registrar', 'category', 'item', 'document', 'ignored'];

  return levels.map((level) => {
    const levelRows = diagnostics.filter((row) => row.detectedLevel === level);

    return {
      level,
      count: levelRows.length,
      examples: Array.from(new Set(levelRows.map((row) => row.text).filter(Boolean))).slice(0, 20),
    };
  });
}

function buildResult(
  headerIndex: number,
  headerMap: HeaderMap | null,
  columns: string[],
  rows: SalesRow[],
  managers: Set<string>,
  clients: Set<string>,
  categories: Set<string>,
  warnings: ParseWarning[],
  diagnostics: DiagnosticRow[],
  strategy: string,
  options: {
    isRegistrarReport?: boolean;
    isSafeForPayrollCalculation?: boolean;
    safetyWarnings?: ParseWarning[];
    sourceRowCount?: number;
    detailRowCount?: number;
  } = {},
): PayrollParseResult {
  const managerSummaries = sumByKey<ManagerSummary>(
    rows,
    (row) => row.manager,
    (row) => ({ manager: row.manager, revenue: 0, cost: 0, grossProfit: 0, profitability: 0 }),
    (target, row) => {
      target.revenue += row.revenue;
      target.cost += row.cost;
      target.grossProfit += row.grossProfit;
      target.profitability = target.revenue ? (target.grossProfit / target.revenue) * 100 : 0;
    },
  );

  const managerCategorySummaries = sumByKey<CategorySummary>(
    rows,
    (row) => `${row.manager}::${row.category}`,
    (row) => ({ manager: row.manager, category: row.category, revenue: 0, grossProfit: 0 }),
    (target, row) => {
      target.revenue += row.revenue;
      target.grossProfit += row.grossProfit;
    },
  );

  const creditSummaries = sumByKey<CreditSummary>(
    rows.filter((row) => normalizeText(row.client).includes('кредит/рассрочка')),
    (row) => row.manager,
    (row) => ({ manager: row.manager, grossProfit: 0, baseAfterNinePercent: 0, bonus: 0 }),
    (target, row) => {
      target.grossProfit += row.grossProfit;
      target.baseAfterNinePercent = target.grossProfit * 0.91;
      target.bonus = target.baseAfterNinePercent * 0.1;
    },
  );

  return {
    headerIndex,
    headerMap,
    columns,
    rows,
    isRegistrarReport: options.isRegistrarReport ?? false,
    isSafeForPayrollCalculation: options.isSafeForPayrollCalculation ?? true,
    safetyWarnings: options.safetyWarnings ?? [],
    sourceRowCount: options.sourceRowCount ?? rows.length,
    detailRowCount: options.detailRowCount ?? rows.length,
    managers: Array.from(managers),
    clients: Array.from(clients),
    categories: Array.from(categories),
    warnings,
    diagnostics,
    levelSummaries: buildLevelSummaries(diagnostics),
    strategy,
    managerSummaries,
    managerCategorySummaries,
    creditSummaries,
  };
}

function parseRowsWithStrategy(rows: SheetRow[], headerIndex: number, headerMap: HeaderMap, columns: string[], strategy: 'outline' | 'content', hasRegistrar: boolean) {
  const warnings: ParseWarning[] = [];
  const salesRows: SalesRow[] = [];
  const managers = new Set<string>();
  const clients = new Set<string>();
  const categories = new Set<string>();
  const diagnostics: DiagnosticRow[] = [];
  const hierarchyRows = rows.slice(headerIndex + 1).filter((row) => formatCell(row.values[headerMap.manager]).trim() !== '');
  const meaningfulRows = hierarchyRows.filter((row) => {
    const text = getHierarchyText(row, headerMap);
    return !isTotalRow(text) && !isHierarchyHeaderRow(text);
  });
  const outlineLevels = meaningfulRows.map((row) => row.outlineLevel).filter((level): level is number => typeof level === 'number');
  const hasOutlineLevels = outlineLevels.length > 0;
  const indentLevels = meaningfulRows.map((row) => row.indentLevel).filter((level) => level > 0);
  const baseIndentLevel = indentLevels.length ? Math.min(...indentLevels) : 0;
  let currentManager = '';
  let currentClient = '';
  let currentRegistrar = '';
  let currentCategory = '';
  let seenItemInClient = false;

  const addDiagnostic = (row: SheetRow, text: string, detectedLevel: DiagnosticRow['detectedLevel']) => {
    diagnostics.push({
      excelRow: row.excelRow,
      text,
      outlineLevel: row.outlineLevel,
      detectedLevel,
      currentManager,
      currentClient,
      currentRegistrar,
      currentCategory,
      revenue: toNumber(row.values[headerMap.revenue]),
      grossProfit: toNumber(row.values[headerMap.grossProfit]),
    });
  };

  meaningfulRows.forEach((row, rowIndex) => {
    const text = getHierarchyText(row, headerMap);
    const nextText = meaningfulRows[rowIndex + 1] ? getHierarchyText(meaningfulRows[rowIndex + 1], headerMap) : '';
    let detectedLevel: DiagnosticRow['detectedLevel'] = 'ignored';

    if (!text || isTotalRow(text)) {
      addDiagnostic(row, text, 'ignored');
      return;
    }

    if (strategy === 'outline') {
      const rowLevel = getOutlineLevel(row, hasOutlineLevels, baseIndentLevel);
      if (rowLevel !== null) {
        detectedLevel = hasRegistrar
          ? rowLevel <= 0 ? 'manager' : rowLevel === 1 ? 'client' : rowLevel === 2 ? 'registrar' : rowLevel === 3 ? 'category' : 'item'
          : rowLevel <= 0 ? 'manager' : rowLevel === 1 ? 'client' : rowLevel === 2 ? 'category' : 'item';
      }
    }

    if (strategy === 'content' || detectedLevel === 'ignored') {
      const nextLooksCategory = isKnownCategory(nextText) || isBroadCategoryCandidate(nextText);

      if (hasRegistrar ? isKnownManagerName(text) : looksLikeManagerName(text)) {
        detectedLevel = 'manager';
      } else if (!currentManager) {
        detectedLevel = 'ignored';
        warnings.push({ excelRow: row.excelRow, text, reason: 'Строка пропущена: до неё не найден менеджер.' });
      } else if (hasRegistrar && isRegistrarDocument(text)) {
        detectedLevel = 'registrar';
      } else if (!currentClient && !hasClientProductMarkers(text)) {
        detectedLevel = 'client';
      } else if (!currentCategory) {
        detectedLevel = 'category';
      } else if (isKnownCategory(text)) {
        detectedLevel = 'category';
      } else if (seenItemInClient && !isLikelyProduct(text) && !hasClientProductMarkers(text) && nextLooksCategory) {
        detectedLevel = 'client';
      } else if (isBroadCategoryCandidate(text) && isLikelyProduct(nextText)) {
        detectedLevel = 'category';
      } else {
        detectedLevel = 'item';
      }
    }

    if (hasRegistrar && isRegistrarDocument(text)) {
      detectedLevel = 'registrar';
    }

    if (hasRegistrar && !currentClient && detectedLevel !== 'manager' && detectedLevel !== 'registrar' && hasClientProductMarkers(text)) {
      warnings.push({
        excelRow: row.excelRow,
        text,
        reason: 'Файл с регистратором распознан нестабильно: товарная строка встретилась там, где ожидался клиент. Разбор небезопасен для расчёта зарплаты.',
      });
      addDiagnostic(row, text, 'ignored');
      return;
    }

    if (hasRegistrar && detectedLevel === 'client' && hasClientProductMarkers(text)) {
      warnings.push({
        excelRow: row.excelRow,
        text,
        reason: 'Файл с регистратором распознан нестабильно: товарная строка попала на уровень клиента. Разбор небезопасен для расчёта зарплаты.',
      });
      addDiagnostic(row, text, 'ignored');
      return;
    }

    if (detectedLevel === 'manager') {
      currentManager = text;
      currentClient = '';
      currentRegistrar = '';
      currentCategory = '';
      seenItemInClient = false;
      managers.add(text);
      addDiagnostic(row, text, detectedLevel);
      return;
    }

    if (detectedLevel === 'client') {
      currentClient = text;
      currentRegistrar = '';
      currentCategory = '';
      seenItemInClient = false;
      clients.add(text);
      addDiagnostic(row, text, detectedLevel);
      return;
    }

    if (detectedLevel === 'registrar') {
      currentRegistrar = text;
      currentCategory = '';
      seenItemInClient = false;
      addDiagnostic(row, text, detectedLevel);
      return;
    }

    if (detectedLevel === 'category') {
      currentCategory = text;
      seenItemInClient = false;
      categories.add(text);
      addDiagnostic(row, text, detectedLevel);
      return;
    }

    if (detectedLevel === 'item') {
      if (!currentManager || !currentClient || !currentCategory) {
        warnings.push({
          excelRow: row.excelRow,
          text,
          reason: 'Номенклатура пропущена: не хватает контекста менеджера, клиента или категории.',
        });
        addDiagnostic(row, text, 'ignored');
        return;
      }

      seenItemInClient = true;
      salesRows.push({
        manager: currentManager,
        client: currentClient,
        category: currentCategory,
        item: text,
        registrar: currentRegistrar,
        registrars: currentRegistrar ? [currentRegistrar] : [],
        revenue: toNumber(row.values[headerMap.revenue]),
        cost: toNumber(row.values[headerMap.cost]),
        grossProfit: toNumber(row.values[headerMap.grossProfit]),
        profitability: headerMap.profitability >= 0 ? toNumber(row.values[headerMap.profitability]) : 0,
      });
      addDiagnostic(row, text, detectedLevel);
    }
  });

  const parsedRows = hasRegistrar ? aggregateRowsByProduct(salesRows) : salesRows;
  const strategyLabel = hasRegistrar
    ? `${strategy === 'outline' ? 'outlineLevel' : 'эвристика по содержимому'} + регистратор`
    : strategy === 'outline' ? 'outlineLevel' : 'эвристика по содержимому';

  return buildResult(headerIndex, headerMap, columns, parsedRows, managers, clients, categories, warnings, diagnostics, strategyLabel, {
    isRegistrarReport: hasRegistrar,
    sourceRowCount: meaningfulRows.length,
    detailRowCount: salesRows.length,
  });
}

function parseRowsWithDocumentUnderItem(rows: SheetRow[], headerIndex: number, headerMap: HeaderMap, columns: string[]) {
  const warnings: ParseWarning[] = [];
  const salesRows: SalesRow[] = [];
  const managers = new Set<string>();
  const clients = new Set<string>();
  const categories = new Set<string>();
  const diagnostics: DiagnosticRow[] = [];
  const hierarchyRows = rows.slice(headerIndex + 1).filter((row) => formatCell(row.values[headerMap.manager]).trim() !== '');
  const meaningfulRows = hierarchyRows.filter((row) => {
    const text = getHierarchyText(row, headerMap);
    return !isTotalRow(text) && !isHierarchyHeaderRow(text);
  });
  const outlineLevels = meaningfulRows.map((row) => row.outlineLevel).filter((level): level is number => typeof level === 'number');
  const hasOutlineLevels = outlineLevels.length > 0;
  const indentLevels = meaningfulRows.map((row) => row.indentLevel).filter((level) => level > 0);
  const baseIndentLevel = indentLevels.length ? Math.min(...indentLevels) : 0;
  let currentManager = '';
  let currentClient = '';
  let currentCategory = '';
  let lastSalesRow: SalesRow | null = null;

  const addDiagnostic = (row: SheetRow, text: string, detectedLevel: DiagnosticRow['detectedLevel']) => {
    diagnostics.push({
      excelRow: row.excelRow,
      text,
      outlineLevel: row.outlineLevel,
      detectedLevel,
      currentManager,
      currentClient,
      currentRegistrar: lastSalesRow?.registrar ?? '',
      currentCategory,
      revenue: toNumber(row.values[headerMap.revenue]),
      grossProfit: toNumber(row.values[headerMap.grossProfit]),
    });
  };

  meaningfulRows.forEach((row) => {
    const text = getHierarchyText(row, headerMap);
    const rowLevel = getOutlineLevel(row, hasOutlineLevels, baseIndentLevel);

    if (!text || isTotalRow(text)) {
      addDiagnostic(row, text, 'ignored');
      return;
    }

    if (isKnownManagerName(text)) {
      currentManager = text;
      currentClient = '';
      currentCategory = '';
      lastSalesRow = null;
      managers.add(text);
      addDiagnostic(row, text, 'manager');
      return;
    }

    if (!currentManager) {
      warnings.push({
        excelRow: row.excelRow,
        text,
        reason: 'Строка пропущена: в формате с документом под товаром до неё не найден менеджер из справочника payroll.',
      });
      addDiagnostic(row, text, 'ignored');
      return;
    }

    if (isRegistrarDocument(text)) {
      if (lastSalesRow) addRegistrarToRow(lastSalesRow, text);
      addDiagnostic(row, text, 'document');
      return;
    }

    if ((rowLevel === null || rowLevel === 0) && !isKnownCategory(text) && !hasClientProductMarkers(text)) {
      currentClient = text;
      currentCategory = '';
      lastSalesRow = null;
      clients.add(text);
      addDiagnostic(row, text, 'client');
      return;
    }

    if (rowLevel === 1 || (isKnownCategory(text) && !hasProductMarkers(text))) {
      currentCategory = text;
      lastSalesRow = null;
      categories.add(text);
      addDiagnostic(row, text, 'category');
      return;
    }

    if (!currentClient || !currentCategory) {
      warnings.push({
        excelRow: row.excelRow,
        text,
        reason: 'Номенклатура пропущена: не хватает контекста клиента или категории в формате document-under-item.',
      });
      addDiagnostic(row, text, 'ignored');
      return;
    }

    const salesRow: SalesRow = {
      manager: currentManager,
      client: currentClient,
      category: currentCategory,
      item: text,
      registrar: '',
      registrars: [],
      revenue: toNumber(row.values[headerMap.revenue]),
      cost: toNumber(row.values[headerMap.cost]),
      grossProfit: toNumber(row.values[headerMap.grossProfit]),
      profitability: headerMap.profitability >= 0 ? toNumber(row.values[headerMap.profitability]) : 0,
    };

    salesRows.push(salesRow);
    lastSalesRow = salesRow;
    addDiagnostic(row, text, 'item');
  });

  const parsedRows = aggregateRowsByProduct(salesRows);

  return buildResult(headerIndex, headerMap, columns, parsedRows, managers, clients, categories, warnings, diagnostics, 'outlineLevel + документ под товаром', {
    isRegistrarReport: true,
    sourceRowCount: meaningfulRows.length,
    detailRowCount: salesRows.length,
  });
}

function isSuspiciousParse(result: PayrollParseResult, sourceRowCount: number) {
  if (sourceRowCount > 1000 && result.rows.length < 100) return true;
  if (result.managers.length > 50) return true;
  if (result.categories.length > Math.max(1500, result.rows.length * 0.5)) return true;
  if (result.rows.length > 0 && result.categories.length > result.rows.length * 0.7) return true;
  return false;
}

function getRegistrarSafetyWarnings(result: PayrollParseResult, sourceRowCount: number): ParseWarning[] {
  if (!result.isRegistrarReport) return [];

  const warnings: ParseWarning[] = [];
  const productClients = result.clients.filter(hasClientProductMarkers);
  const productManagers = result.managers.filter(hasClientProductMarkers);
  const documentManagers = result.managers.filter(isRegistrarDocument);
  const categoryManagers = result.managers.filter(isKnownCategory);
  const unknownManagers = result.managers.filter((manager) => !isKnownManagerName(manager));
  const registrarRows = result.diagnostics.filter((row) => row.detectedLevel === 'registrar' || row.detectedLevel === 'document').length;

  if (result.managers.length > 20) {
    warnings.push({
      excelRow: 0,
      text: `${result.managers.length} менеджеров`,
      reason: 'Файл с регистратором распознан нестабильно: менеджеров слишком много. Возможен сдвиг уровней manager/client.',
    });
  }

  if (unknownManagers.length > 0) {
    warnings.push({
      excelRow: 0,
      text: unknownManagers.slice(0, 5).join(', '),
      reason: 'Файл с регистратором распознан нестабильно: среди менеджеров есть строки вне справочника реальных менеджеров.',
    });
  }

  if (productManagers.length > 0 || documentManagers.length > 0 || categoryManagers.length > 0) {
    warnings.push({
      excelRow: 0,
      text: [...productManagers, ...documentManagers, ...categoryManagers].slice(0, 5).join(', '),
      reason: 'Файл с регистратором распознан нестабильно: товар, документ 1С или категория попали на уровень менеджера.',
    });
  }

  if (productClients.length > 0) {
    warnings.push({
      excelRow: 0,
      text: productClients.slice(0, 5).join(', '),
      reason: 'Файл с регистратором распознан нестабильно: среди клиентов найдены товарные названия. Расчёт зарплаты по нему небезопасен.',
    });
  }

  if (result.clients.length < 50 || result.clients.length > 260) {
    warnings.push({
      excelRow: 0,
      text: `${result.clients.length} клиентов`,
      reason: 'Файл с регистратором распознан нестабильно: количество клиентов выглядит нехарактерно для отчёта, проверьте уровни client/registrar.',
    });
  }

  if (result.clients.length > Math.max(220, result.managers.length * 24)) {
    warnings.push({
      excelRow: 0,
      text: `${result.clients.length} клиентов`,
      reason: 'Файл с регистратором распознан нестабильно: количество клиентов резко выше ожидаемого, возможен сдвиг уровней.',
    });
  }

  if (result.detailRowCount > 0 && registrarRows === 0) {
    warnings.push({
      excelRow: 0,
      text: '',
      reason: 'Файл похож на отчёт с документами, но строки документов 1С не распознаны стабильно.',
    });
  }

  if (sourceRowCount > 1000 && result.rows.length < 100) {
    warnings.push({
      excelRow: 0,
      text: '',
      reason: 'Файл с регистратором распознан нестабильно: после агрегации осталось слишком мало товарных строк.',
    });
  }

  if (warnings.length > 0) {
    warnings.unshift({
      excelRow: 0,
      text: '',
      reason: 'Файл с регистратором распознан нестабильно. Расчёт зарплаты по нему небезопасен. Используйте обычный отчёт без регистратора для расчёта, а файл с регистратором — только для диагностики.',
    });
  }

  return warnings;
}

function parsePayrollReport(rows: SheetRow[]): PayrollParseResult {
  const { headerIndex, headerMap } = findHeader(rows);
  const columns = getHeaderColumns(rows, headerIndex);

  if (!headerMap) {
    return buildResult(
      headerIndex,
      headerMap,
      columns,
      [],
      new Set(),
      new Set(),
      new Set(),
      [{ excelRow: 0, text: '', reason: 'Не найдена шапка с колонками Менеджер, Выручка, Себестоимость товаров и Валовая прибыль.' }],
      [],
      'не определена',
    );
  }

  const hasDocumentUnderItem = hasDocumentUnderItemHierarchy(rows, headerIndex);
  const hasRegistrar = !hasDocumentUnderItem && hasRegistrarHierarchy(rows, headerIndex);
  const sourceRowCount = rows.slice(headerIndex + 1).filter((row) => !isTotalRow(getHierarchyText(row, headerMap))).length;
  const documentUnderItemResult = hasDocumentUnderItem ? parseRowsWithDocumentUnderItem(rows, headerIndex, headerMap, columns) : null;
  const outlineResult = parseRowsWithStrategy(rows, headerIndex, headerMap, columns, 'outline', hasRegistrar);
  const contentResult = parseRowsWithStrategy(rows, headerIndex, headerMap, columns, 'content', hasRegistrar);
  const outlineIsSuspicious = isSuspiciousParse(outlineResult, sourceRowCount);
  const result = documentUnderItemResult ?? (hasRegistrar ? contentResult : !outlineIsSuspicious && outlineResult.rows.length >= contentResult.rows.length * 0.8 ? outlineResult : contentResult);
  const registrarSafetyWarnings = getRegistrarSafetyWarnings(result, sourceRowCount);

  result.safetyWarnings = registrarSafetyWarnings;
  result.isSafeForPayrollCalculation = registrarSafetyWarnings.length === 0;
  if (registrarSafetyWarnings.length > 0) {
    result.warnings.unshift(...registrarSafetyWarnings);
  }

  if (sourceRowCount > 1000 && result.rows.length < 100) {
    result.warnings.unshift({
      excelRow: 0,
      text: '',
      reason: 'Парсер определил слишком мало товарных строк — проверьте диагностику уровней.',
    });
  }

  return result;
}

function isWholesaleManager(manager: string) {
  return wholesaleManagers.some((name) => normalizeText(name) === normalizeText(manager));
}

function containsAny(text: string, fragments: string[]) {
  const normalized = normalizeText(text);
  return fragments.some((fragment) => normalized.includes(normalizeText(fragment)));
}

function getCategoryMatch(category: string, options: string[]) {
  const normalizedCategory = normalizeText(category);
  return options.find((option) => normalizedCategory === option || normalizedCategory.includes(option));
}

function isAccessoryCategory(category: string) {
  return Boolean(getCategoryMatch(category, accessoryCategories));
}

function isExcludedTechCategory(category: string) {
  return Boolean(getCategoryMatch(category, excludedTechCategories));
}

function isReviewTechCategory(category: string) {
  return Boolean(getCategoryMatch(category, reviewTechCategories));
}

function isTabletCategory(category: string) {
  return normalizeText(category) === 'планшеты';
}

function isPhoneCategory(category: string) {
  return normalizeText(category) === 'телефоны';
}

function hasExplicitAccessoryMarker(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  const hasAccessoryItemMarker = containsAny(text, [
    'чехол',
    'чехлы',
    'накладка',
    'бампер',
    'стекло',
    'стекла',
    'пленка',
    'плёнка',
    'кабель',
    'провод',
    'зарядка',
    'зарядное',
    'блок питания',
    'адаптер',
    'держатель',
    'ремешок',
    'magsafe',
    'lightning',
    'стилус',
    'penpro',
    'переходник',
  ]);
  const hasAccessoryCategory = isAccessoryCategory(row.category) && !hasAirPods(row);

  return hasAccessoryCategory || hasAccessoryItemMarker;
}

function isButtonPhone(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, [
    'кнопочный телефон',
    'телефон кнопочный',
    'кнопочные телефоны',
    'мобильный телефон bq',
    'bq 1858',
    'bq 3590',
    'bq 2820',
    'nokia 1202',
    'philips xenium',
    'maxvi',
    'texet',
    'teXet',
  ]);
}

function isSmartphone(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isExcludedTechCategory(row.category) || containsAny(text, [
    'смартфон',
    'смартфоны',
    'iphone',
    'galaxy',
    'redmi',
    'poco',
    'realme',
    'honor',
    'tecno',
    'infinix',
    'vivo',
    'oppo',
    'huawei',
    'motorola',
  ]);
}

function isAmbiguousPhone(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isPhoneCategory(row.category) || containsAny(text, ['телефон']);
}

function isTablet(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isTabletCategory(row.category) || containsAny(text, ['планшет', 'ipad', 'айпад', 'tablet', 'tg30']);
}

function isAppleWatch(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['apple watch']);
}

function isMacBookOrAppleNotebook(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['macbook', 'макбук', 'ноутбук apple', 'apple notebook']);
}

function isPlayStation(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['playstation', 'sony playstation', 'ps5', 'ps4', 'консоль sony']);
}

function hasAirPods(row: SalesRow) {
  return containsAny(row.item, ['airpods', 'аирподс', 'эйрподс']);
}

function hasAirPodsCopyMarker(row: SalesRow) {
  return containsAny(row.item, ['hoco', 'borofone', 'celebrat', 'tws', 'copy', 'копия', 'replica', 'aaa', 'аналог', 'совместимые', 'неоригинал']);
}

function isOriginalAirPods(row: SalesRow) {
  return hasAirPods(row) && !hasAirPodsCopyMarker(row) && containsAny(row.item, ['apple', 'original', 'оригинал', 'оригинальные', 'airpods pro', 'airpods 2', 'airpods 3']);
}

function isAmbiguousAirPods(row: SalesRow) {
  return hasAirPods(row) && !hasAirPodsCopyMarker(row) && !isOriginalAirPods(row);
}

function isNonAppleSmartWatch(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isReviewTechCategory(row.category) && !isAppleWatch(row) && containsAny(text, ['hoco', 'hk', 'hk11', 'hk ultra', 'garmin', 'watch', 'часы', 'смарт-часы']);
}

function isKnownPremiumTech(row: SalesRow) {
  return isAppleWatch(row) || isMacBookOrAppleNotebook(row) || isOriginalAirPods(row) || isPlayStation(row);
}

function isBroadReviewCategory(category: string) {
  return isReviewTechCategory(category) || isTabletCategory(category) || normalizeText(category) === 'прочее';
}

function isWholesaleCameraOrRecorder(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return isWholesaleManager(row.manager) && containsAny(text, ['камера', 'wi-fi камера', 'wifi камера', '4g камера', 'видеорегистратор', 'регистратор', 'dvr', 'faizfull']);
}

function isToyOrRobot(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['игрушка', 'игрушки', 'робот собака', 'робот-собака', 'детский робот']);
}

function isSmartGlasses(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['умные очки', 'smart glasses', 'g2 glasses', 'очки с камерой', 'очки солнцезащитные с наушником', 'очки с микрофоном', 'hn-w088']);
}

function isAffordableHairDryer(row: SalesRow) {
  const text = `${row.category} ${row.item}`;
  return containsAny(text, ['фен xiaomi', 'фен hoco', 'xiaomi mijia', 'hoco hp10']) && row.revenue < 15000;
}

function isVoiceRecorder(row: SalesRow) {
  return containsAny(row.item, ['диктофон', 'remax rp3']);
}

function isReplicaLikePhone(row: SalesRow) {
  return containsAny(row.item, ['17 pro max mini']) && !containsAny(row.item, ['apple', 'iphone']);
}

function getNewExpensiveReviewReason(row: SalesRow) {
  if (containsAny(row.item, ['dyson'])) return 'найдено слово Dyson';
  if (containsAny(row.item, ['фен']) && !isAffordableHairDryer(row)) return 'найдено слово фен';
  if (containsAny(row.item, ['стайлер'])) return 'найдено слово стайлер';
  if (containsAny(row.item, ['робот-пылесос'])) return 'найдено слово робот-пылесос';
  if (containsAny(row.item, ['пылесос'])) return 'найдено слово пылесос';
  if (containsAny(row.item, ['playstation', 'ps5', 'ps4', 'консоль'])) return 'найдена игровая консоль';
  if (containsAny(row.item, ['камера']) && !isWholesaleCameraOrRecorder(row) && !isToyOrRobot(row) && !isSmartGlasses(row)) return 'найдено слово камера';
  if (isBroadReviewCategory(row.category) && row.revenue >= 15000) return `дорогой товар в широкой категории ${row.category}`;
  return '';
}

function getArticle(item: string) {
  const parts = item.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isFilmService(row: SalesRow) {
  const category = normalizeText(row.category);
  return category === 'услуги оказываемые' || category.includes('услуги оказываемые');
}

function isAsadManager(manager: string) {
  return normalizeText(manager) === normalizeText(asadManagerName);
}

function isPlotterMaterial(row: SalesRow) {
  if (!isAsadManager(row.manager)) return false;

  const category = normalizeText(row.category);
  const item = normalizeText(row.item);
  const isProtectiveFilmCategory = category === 'защитные стекла и пленки' || category.includes('защитные стекла и пленки');
  const hasProtectiveFilmName = item.includes('защитная пленка');
  const hasPlotterMaterialMarker = containsAny(row.item, ['антигравийная', 'плоттера', '3m skin', 'матовая', 'глянцевая', 'текстурная']);
  const isGlassOrLens = item.includes('защитное стекло') || item.includes('защитные линзы') || item.includes('защитная линза');

  return isProtectiveFilmCategory && hasProtectiveFilmName && hasPlotterMaterialMarker && !isGlassOrLens;
}

function hasDisputeMarkers(row: SalesRow) {
  return containsAny(`${row.category} ${row.item}`, ['Apple', 'Original', 'iPad', 'AirPods', 'Mac', 'Watch']);
}

function isCreditSale(row: SalesRow) {
  return normalizeText(row.client).includes('кредит/рассрочка');
}

function getCreditTechReason(row: SalesRow, rule: string) {
  if (rule === 'smartphone-tech') return 'кредит + смартфон: входит в кредитный бонус';
  if (rule === 'tablet-tech-included-wholesale') return 'кредит + планшет: входит в кредитный бонус';
  if (rule === 'playstation-tech') return 'кредит + PlayStation: входит в кредитный бонус';
  if (rule === 'apple-watch-tech') return 'кредит + Apple Watch: входит в кредитный бонус';
  if (rule === 'macbook-tech') return 'кредит + MacBook: входит в кредитный бонус';
  if (rule === 'original-airpods-tech') return 'кредит + оригинальные AirPods: входит в кредитный бонус';
  return `кредит + техника: входит в кредитный бонус (${row.category})`;
}

function getCreditAccessoryReason(row: SalesRow, rule: string) {
  if (rule === 'accessory-category' || rule === 'accessory-item-marker') return 'кредит + аксессуар: не входит в кредитный бонус';
  if (rule === 'button-phone-accessory') return 'кредит + кнопочный телефон: не входит в кредитный бонус';
  if (rule === 'airpods-copy-accessory') return 'кредит + неоригинальные AirPods / TWS / копия: не входит в кредитный бонус';
  if (rule === 'non-apple-watch-accessory') return 'кредит + не-Apple смарт-часы: не входит в кредитный бонус';
  return `кредит + аксессуар: не входит в кредитный бонус (${row.category})`;
}

function getCategoryReason(row: SalesRow) {
  if (hasAirPods(row) && hasAirPodsCopyMarker(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'неоригинальные AirPods / TWS / копия — аксессуар / обычная база',
      rule: 'airpods-copy-accessory',
    };
  }

  if (hasExplicitAccessoryMarker(row)) {
    return {
      kind: 'accessory' as const,
      reason: containsAny(row.item, ['watch']) && containsAny(row.item, ['ремешок'])
        ? 'Ремешок Apple Watch — аксессуар, слово Watch не исключает'
        : containsAny(row.item, ['стилус', 'penpro'])
          ? 'Стилус — аксессуар'
          : `явный аксессуар по категории/названию: ${row.category}`,
      rule: isAccessoryCategory(row.category) ? 'accessory-category' : 'accessory-item-marker',
    };
  }

  if (isButtonPhone(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'кнопочный телефон — обычная база',
      rule: 'button-phone-accessory',
    };
  }

  if (isSmartphone(row)) {
    return {
      kind: 'excludedTech' as const,
      reason: 'Смартфон — техника, для опта исключён из базы',
      rule: 'smartphone-tech',
    };
  }

  if (isAmbiguousPhone(row)) {
    if (isReplicaLikePhone(row)) {
      return {
        kind: 'accessory' as const,
        reason: 'похоже на копию/неоригинальный телефон — обычная база, не iPhone без Apple/iPhone в названии',
        rule: 'replica-like-phone-accessory',
      };
    }

    return {
      kind: 'reviewTech' as const,
      reason: 'неясно: смартфон или кнопочный телефон',
      rule: 'ambiguous-phone-review',
    };
  }

  if (isTablet(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'Планшет — техника, но для опта входит в оптовую базу',
      rule: 'tablet-tech-included-wholesale',
    };
  }

  if (isAppleWatch(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'Apple Watch — техника',
      rule: 'apple-watch-tech',
    };
  }

  if (isNonAppleSmartWatch(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'Hoco/HK/Garmin или другие не-Apple смарт-часы — аксессуар / обычная база',
      rule: 'non-apple-watch-accessory',
    };
  }

  if (isMacBookOrAppleNotebook(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'MacBook / ноутбук Apple — техника',
      rule: 'macbook-tech',
    };
  }

  if (isOriginalAirPods(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'Оригинальные AirPods — техника',
      rule: 'original-airpods-tech',
    };
  }

  if (isAmbiguousAirPods(row)) {
    return {
      kind: 'reviewTech' as const,
      reason: 'AirPods: неясно, оригинал или копия',
      rule: 'ambiguous-airpods-review',
    };
  }

  if (isPlayStation(row)) {
    return {
      kind: 'retailTech' as const,
      reason: 'PlayStation — техника',
      rule: 'playstation-tech',
    };
  }

  if (isWholesaleCameraOrRecorder(row)) {
    return {
      kind: 'other' as const,
      reason: 'камера/видеорегистратор у опта — входит в оптовую базу',
      rule: 'wholesale-camera-recorder-base',
    };
  }

  if (isToyOrRobot(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'игрушка/робот — обычная база',
      rule: 'toy-robot-accessory',
    };
  }

  if (isSmartGlasses(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'умные очки / очки с камерой — обычная база',
      rule: 'smart-glasses-accessory',
    };
  }

  if (isAffordableHairDryer(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'недорогой фен Xiaomi/Hoco — обычная база',
      rule: 'affordable-hair-dryer-accessory',
    };
  }

  if (isVoiceRecorder(row)) {
    return {
      kind: 'accessory' as const,
      reason: 'диктофон — обычная база',
      rule: 'voice-recorder-accessory',
    };
  }

  const expensiveReviewReason = getNewExpensiveReviewReason(row);
  if (expensiveReviewReason) {
    return {
      kind: 'reviewTech' as const,
      reason: `${expensiveReviewReason} — требуется классификация`,
      rule: 'new-expensive-review',
    };
  }

  if (isReviewTechCategory(row.category)) {
    return {
      kind: 'reviewTech' as const,
      reason: `Категория ${row.category} слишком широкая, правило по названию не найдено`,
      rule: 'broad-review-category',
    };
  }

  return {
    kind: 'other' as const,
    reason: `прочая категория: ${row.category}`,
    rule: 'default-category',
  };
}

function getCalculationDetails(row: SalesRow): Omit<ClassifiedSalesRow, keyof SalesRow> {
  const department: Department = isWholesaleManager(row.manager) ? 'Опт' : 'Розница';
  const categoryReason = getCategoryReason(row);
  const article = getArticle(row.item);
  const creditSale = isCreditSale(row);

  if (department === 'Опт') {
    const calculationType: CalculationType =
    categoryReason.kind === 'excludedTech'
        ? 'WHOLESALE_EXCLUDED_TECH'
        : categoryReason.kind === 'reviewTech'
          ? 'WHOLESALE_REVIEW_TECH'
          : 'WHOLESALE_INCLUDED_1_75';
    const includedInWholesaleBase = calculationType !== 'WHOLESALE_EXCLUDED_TECH';
    const base = includedInWholesaleBase ? row.revenue : 0;
    const percent = includedInWholesaleBase ? 0.0175 : 0;

    return {
      department,
      calculationType,
      calculationLabel: calculationLabels[calculationType],
      article,
      base,
      percent,
      bonus: base * percent,
      formula: calculationFormulas[calculationType],
      includedInWholesaleBase,
      classificationReason: categoryReason.reason,
      matchedRule: categoryReason.rule,
      isCreditSale: false,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (isFilmService(row)) {
    return {
      department,
      calculationType: 'RETAIL_FILM_50',
      calculationLabel: calculationLabels.RETAIL_FILM_50,
      article,
      base: row.revenue,
      percent: 0.5,
      bonus: row.revenue * 0.5,
      formula: calculationFormulas.RETAIL_FILM_50,
      includedInWholesaleBase: null,
      classificationReason: 'категория / вид номенклатуры = Услуги оказываемые',
      matchedRule: 'service-category',
      isCreditSale: creditSale,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (isPlotterMaterial(row)) {
    return {
      department,
      calculationType: 'RETAIL_PLOTTER_MATERIAL_COST_50',
      calculationLabel: calculationLabels.RETAIL_PLOTTER_MATERIAL_COST_50,
      article,
      base: row.cost,
      percent: 0.5,
      bonus: row.cost * 0.5,
      formula: calculationFormulas.RETAIL_PLOTTER_MATERIAL_COST_50,
      includedInWholesaleBase: null,
      classificationReason: 'Икаев Асад + плоттерные плёнки / материалы для плоттера',
      matchedRule: 'asad-plotter-material',
      isCreditSale: creditSale,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (creditSale && (categoryReason.kind === 'excludedTech' || categoryReason.kind === 'retailTech')) {
    return {
      department,
      calculationType: 'CREDIT_GROSS_PROFIT',
      calculationLabel: calculationLabels.CREDIT_GROSS_PROFIT,
      article,
      base: row.grossProfit * 0.91,
      percent: 0.1,
      bonus: row.grossProfit * 0.91 * 0.1,
      formula: calculationFormulas.CREDIT_GROSS_PROFIT,
      includedInWholesaleBase: null,
      classificationReason: getCreditTechReason(row, categoryReason.rule),
      matchedRule: `credit-tech:${categoryReason.rule}`,
      isCreditSale: true,
      creditProductType: 'tech',
      creditIncludedInBonus: true,
    };
  }

  if (creditSale && categoryReason.kind === 'accessory') {
    return {
      department,
      calculationType: 'CREDIT_ACCESSORY_NO_BONUS',
      calculationLabel: calculationLabels.CREDIT_ACCESSORY_NO_BONUS,
      article,
      base: 0,
      percent: 0,
      bonus: 0,
      formula: calculationFormulas.CREDIT_ACCESSORY_NO_BONUS,
      includedInWholesaleBase: null,
      classificationReason: getCreditAccessoryReason(row, categoryReason.rule),
      matchedRule: `credit-accessory:${categoryReason.rule}`,
      isCreditSale: true,
      creditProductType: 'accessory',
      creditIncludedInBonus: false,
    };
  }

  if (creditSale) {
    return {
      department,
      calculationType: 'CREDIT_REVIEW_NO_BONUS',
      calculationLabel: calculationLabels.CREDIT_REVIEW_NO_BONUS,
      article,
      base: 0,
      percent: 0,
      bonus: 0,
      formula: calculationFormulas.CREDIT_REVIEW_NO_BONUS,
      includedInWholesaleBase: null,
      classificationReason: `кредит + товар спорный: требуется классификация. ${categoryReason.reason}`,
      matchedRule: `credit-review:${categoryReason.rule}`,
      isCreditSale: true,
      creditProductType: 'review',
      creditIncludedInBonus: false,
    };
  }

  if (categoryReason.kind === 'excludedTech' || categoryReason.kind === 'retailTech') {
    return {
      department,
      calculationType: 'RETAIL_GROSS_PROFIT_10',
      calculationLabel: calculationLabels.RETAIL_GROSS_PROFIT_10,
      article,
      base: row.grossProfit,
      percent: 0.1,
      bonus: row.grossProfit * 0.1,
      formula: calculationFormulas.RETAIL_GROSS_PROFIT_10,
      includedInWholesaleBase: null,
      classificationReason: categoryReason.reason,
      matchedRule: categoryReason.rule,
      isCreditSale: false,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  if (categoryReason.kind === 'reviewTech') {
    return {
      department,
      calculationType: 'RETAIL_REVIEW_TECH',
      calculationLabel: calculationLabels.RETAIL_REVIEW_TECH,
      article,
      base: row.revenue,
      percent: 0.05,
      bonus: row.revenue * 0.05,
      formula: calculationFormulas.RETAIL_REVIEW_TECH,
      includedInWholesaleBase: null,
      classificationReason: categoryReason.reason,
      matchedRule: categoryReason.rule,
      isCreditSale: false,
      creditProductType: null,
      creditIncludedInBonus: false,
    };
  }

  return {
    department,
    calculationType: 'RETAIL_ACCESSORY_5',
    calculationLabel: calculationLabels.RETAIL_ACCESSORY_5,
    article,
    base: row.revenue,
    percent: 0.05,
    bonus: row.revenue * 0.05,
    formula: calculationFormulas.RETAIL_ACCESSORY_5,
    includedInWholesaleBase: null,
    classificationReason: categoryReason.reason,
    matchedRule: categoryReason.rule,
    isCreditSale: false,
    creditProductType: null,
    creditIncludedInBonus: false,
  };
}

function classifySalesRows(rows: SalesRow[]): ClassificationResult {
  const classifiedRows = rows.map((row) => ({ ...row, ...getCalculationDetails(row) }));
  const wholesaleRows = classifiedRows.filter((row) => row.department === 'Опт');
  const zalinaRevenue = wholesaleRows.filter((row) => normalizeText(row.manager) === normalizeText('Ахобекова Залина')).reduce((sum, row) => sum + row.revenue, 0);
  const lianaRevenue = wholesaleRows.filter((row) => normalizeText(row.manager) === normalizeText('Хурзокова Лиана')).reduce((sum, row) => sum + row.revenue, 0);
  const wholesale = {
    zalinaRevenue,
    lianaRevenue,
    totalRevenue: wholesaleRows.reduce((sum, row) => sum + row.revenue, 0),
    excludedTechRevenue: wholesaleRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH').reduce((sum, row) => sum + row.revenue, 0),
    base: 0,
    bonusEach: 0,
  };
  wholesale.base = wholesale.totalRevenue - wholesale.excludedTechRevenue;
  wholesale.bonusEach = wholesale.base * 0.0175;

  const typeSummaries = (Object.keys(calculationLabels) as CalculationType[]).map((type) => {
    const typeRows = classifiedRows.filter((row) => row.calculationType === type);
    const base = type === 'WHOLESALE_INCLUDED_1_75' ? wholesale.base : typeRows.reduce((sum, row) => sum + row.base, 0);
    const bonus = type === 'WHOLESALE_INCLUDED_1_75' ? wholesale.bonusEach : typeRows.reduce((sum, row) => sum + row.bonus, 0);

    return {
      type,
      label: calculationLabels[type],
      rows: typeRows.length,
      revenue: typeRows.reduce((sum, row) => sum + row.revenue, 0),
      grossProfit: typeRows.reduce((sum, row) => sum + row.grossProfit, 0),
      base,
      formula: calculationFormulas[type],
      bonus,
    };
  });

  const managers = Array.from(new Set(classifiedRows.map((row) => row.manager)));
  const managerSummaries = managers.map((manager) => {
    const managerRows = classifiedRows.filter((row) => row.manager === manager);
    const department: Department = isWholesaleManager(manager) ? 'Опт' : 'Розница';
    const creditBonus = managerRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT').reduce((sum, row) => sum + row.bonus, 0);
    const filmBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.bonus, 0);
    const plotterBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50').reduce((sum, row) => sum + row.bonus, 0);
    const techBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10').reduce((sum, row) => sum + row.bonus, 0);
    const accessoryBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_ACCESSORY_5').reduce((sum, row) => sum + row.bonus, 0);
    const wholesaleBonus = department === 'Опт' ? wholesale.bonusEach : 0;

    return {
      manager,
      department,
      revenue: managerRows.reduce((sum, row) => sum + row.revenue, 0),
      grossProfit: managerRows.reduce((sum, row) => sum + row.grossProfit, 0),
      creditBonus,
      filmBonus,
      plotterBonus,
      techBonus,
      accessoryBonus,
      wholesaleBonus,
      totalBonus: creditBonus + filmBonus + plotterBonus + techBonus + accessoryBonus + wholesaleBonus,
    };
  });

  return {
    rows: classifiedRows,
    wholesale,
    typeSummaries,
    managerSummaries,
    disputedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH' || (hasDisputeMarkers(row) && row.matchedRule === 'default-category')),
    accessoryExcludedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH' && isAccessoryCategory(row.category)),
    expensiveReviewRows: classifiedRows.filter((row) => row.matchedRule === 'new-expensive-review'),
    counts: {
      total: classifiedRows.length,
      wholesale: classifiedRows.filter((row) => row.department === 'Опт').length,
      retail: classifiedRows.filter((row) => row.department === 'Розница').length,
      credit: classifiedRows.filter((row) => row.isCreditSale).length,
      film: classifiedRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').length,
      retailTech: classifiedRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10').length,
      accessory: classifiedRows.filter((row) => row.calculationType === 'RETAIL_ACCESSORY_5' || row.calculationType === 'RETAIL_REVIEW_TECH').length,
      wholesaleExcludedTech: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH').length,
    },
  };
}

function getCheckStatus(status: 'ok' | 'warning' | 'error') {
  if (status === 'ok') return 'bg-green-100 text-green-800';
  if (status === 'warning') return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-700';
}

function getRowStatus(row: ClassifiedSalesRow) {
  if (row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH') return 'Требует проверки';
  if (row.grossProfit < 0) return 'Отрицательная ВП';
  return 'OK';
}

function getRowStatusClass(status: string) {
  if (status === 'OK') return 'bg-green-100 text-green-800';
  if (status === 'Отрицательная ВП') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-800';
}

function sumRows(rows: ClassifiedSalesRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.rows += 1;
      acc.revenue += row.revenue;
      acc.grossProfit += row.grossProfit;
      acc.base += row.base;
      acc.bonus += row.bonus;
      return acc;
    },
    { rows: 0, revenue: 0, grossProfit: 0, base: 0, bonus: 0 },
  );
}

function hasUnexpectedZeroBase(row: ClassifiedSalesRow) {
  return row.base === 0 && row.calculationType !== 'WHOLESALE_EXCLUDED_TECH' && row.calculationType !== 'CREDIT_ACCESSORY_NO_BONUS';
}

function hasRegistrarFragment(row: SalesRow, fragment: string) {
  return row.registrars.some((registrar) => normalizeText(registrar).includes(normalizeText(fragment))) || normalizeText(row.registrar).includes(normalizeText(fragment));
}

function getRegistrarSummary(row: SalesRow) {
  return row.registrars.length ? row.registrars.join(' | ') : row.registrar;
}

function getSalesProblemReason(row: ClassifiedSalesRow, type: SalesProblemType) {
  const hasReturn = hasRegistrarFragment(row, 'Возврат товаров от клиента');
  const hasSale = hasRegistrarFragment(row, 'Реализация товаров и услуг') || hasRegistrarFragment(row, 'Отчет о розничных продажах') || hasRegistrarFragment(row, 'Отчёт о розничных продажах');
  const hasCorrection = hasRegistrarFragment(row, 'Корректировка');

  if (type === 'zeroBase' && row.revenue === 0 && row.grossProfit > 0 && (hasReturn || hasSale || hasCorrection)) {
    if (hasSale && hasReturn) return 'реализация + возврат: продажа и возврат свернулись в 0 выручки, остаточная ВП — контроль 1С, бонус не начисляется';
    if (hasReturn) return 'найден возврат по регистратору: строка с нулевой выручкой требует контроля 1С';
    if (hasSale) return 'найдена реализация по регистратору: нулевая выручка с остаточной ВП требует контроля 1С';
    return 'найдена корректировка по регистратору: нулевая выручка требует контроля 1С';
  }

  if (type === 'negative') {
    if (hasReturn) return 'отрицательная ВП связана с возвратом';
    if (hasSale) return 'отрицательная ВП по реализации — проверить продажу ниже себестоимости/скидку/себестоимость';
    if (hasCorrection) return 'отрицательная ВП по корректировке — проверить документ 1С';
  }

  return row.classificationReason;
}

function parseManualNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReportNumber(value: CellValue) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/\s/g, '');
  const normalized = compact.includes('.') ? compact.replace(/,/g, '') : compact.replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePersonName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isBelaManager(manager: string) {
  const normalized = normalizePersonName(manager);
  return normalized.includes('бэла') || normalized.includes('бела') || normalized.includes('кештова');
}

function isBelaBaseEmployee(manager: string) {
  const normalized = normalizePersonName(manager);
  return (
    normalized.includes('тохов') ||
    normalized.includes('астемир') ||
    normalized.includes('ахобекова') ||
    normalized.includes('залина') ||
    normalized.includes('хурцокова') ||
    normalized.includes('хурзокова') ||
    normalized.includes('ляна') ||
    normalized.includes('лиана') ||
    normalized.includes('кумакова') ||
    normalized.includes('кумахова') ||
    normalized.includes('диана') ||
    normalized.includes('чиченова') ||
    normalized.includes('чеченова') ||
    normalized.includes('милана') ||
    normalized.includes('абшаева') ||
    normalized.includes('зухра') ||
    normalized.includes('икаев') ||
    normalized.includes('асад') ||
    normalized.includes('магомед') ||
    normalized.includes('стажеррозница') ||
    normalized.includes('стажёррозница')
  );
}

function isNoDayPayManager(manager: string) {
  return normalizePersonName(manager).includes('асад');
}

function getDayRate(department: Department) {
  return department === 'Опт' ? 500 : 600;
}

function buildFullPayrollRow(summary: BonusManagerSummary, manual: PayrollManualInput | undefined): FullPayrollRow {
  const employee = payrollEmployees[summary.manager];
  const manualWorkedDays = parseManualNumber(manual?.workedDays ?? '');
  const manualLateCount = parseManualNumber(manual?.lateCount ?? '');
  const salaryRule = isBelaManager(summary.manager) ? 'belaPercent' : isNoDayPayManager(summary.manager) ? 'noDayPay' : 'standard';
  const dayPayNotRequired = salaryRule !== 'standard';
  const workedDays = dayPayNotRequired ? null : manualWorkedDays;
  const lateCount = dayPayNotRequired ? null : manualLateCount;
  const advance = parseManualNumber(manual?.advance ?? '') ?? 0;
  const agentCreditCommission = summary.manager === agentCreditCommissionEmployee ? parseManualNumber(manual?.agentCreditCommission ?? '') ?? 0 : 0;
  const dayRate = dayPayNotRequired ? 0 : getDayRate(summary.department);
  const dayPay = workedDays === null ? 0 : workedDays * dayRate;
  const salesBonus = salaryRule === 'belaPercent' ? 0 : summary.totalBonus;
  const disciplineBonus = salaryRule === 'standard' && lateCount !== null && lateCount <= 3 ? 3000 : 0;
  const grossPay = dayPay + salesBonus + disciplineBonus + agentCreditCommission;
  const netPay = grossPay - advance;
  const payrollReasons = [
    !dayPayNotRequired && workedDays === null ? 'Не заполнены отработанные дни' : '',
    !dayPayNotRequired && lateCount === null ? 'Не заполнено количество опозданий' : '',
    advance > grossPay ? 'Аванс больше начислений' : '',
  ].filter(Boolean);

  return {
    ...summary,
    payrollDepartment: employee?.department ?? summary.department,
    position: employee?.position ?? 'Сотрудник',
    salaryType: employee?.salaryType ?? (summary.department === 'Опт' ? 'wholesale_percent' : 'retail_sales_bonus'),
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

function applyBelaPercentRule(rows: FullPayrollRow[]): FullPayrollRow[] {
  const belaBaseGrossPay = rows
    .filter((row) => row.salaryRule !== 'belaPercent' && isBelaBaseEmployee(row.manager))
    .reduce((sum, row) => sum + row.grossPay, 0);

  return rows.map((row) => {
    if (row.salaryRule !== 'belaPercent') return row;
    const grossPay = belaBaseGrossPay * 0.12;
    const netPay = grossPay - row.advance;
    return {
      ...row,
      grossPay,
      netPay,
      payrollStatus: row.advance > grossPay ? 'Проверить' as const : 'OK' as const,
      payrollReasons: row.advance > grossPay ? ['Аванс больше начислений'] : [],
    };
  });
}

function buildFixedPayrollRows(inputs: Record<string, FixedPayrollInput>): FullPayrollRow[] {
  return Object.values(payrollEmployees)
    .filter((employee) => employee.salaryType === 'fixed_salary')
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

function parsePurchaseReport(rows: SheetRow[]) {
  const headerIndex = rows.findIndex((row) => row.values.some((value) => String(value ?? '').trim() === 'Увеличение нашего долга'));
  if (headerIndex === -1) return { base: null, sourceRow: null };

  const columnIndex = rows[headerIndex].values.findIndex((value) => String(value ?? '').trim() === 'Увеличение нашего долга');
  const valueRow = rows.slice(headerIndex + 1).find((row) => parseReportNumber(row.values[columnIndex]) !== null);
  const base = valueRow ? parseReportNumber(valueRow.values[columnIndex]) : null;

  return {
    base,
    sourceRow: valueRow?.excelRow ?? null,
  };
}

function buildPurchasePayrollRow(input: PurchasePayrollInput | undefined, report: PurchaseReportState | null): FullPayrollRow {
  const employee = payrollEmployees[purchaseManagerName];
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
    rawAdjustment < 0 ? 'Проверить: расчёт по закупкам выше целевой ЗП' : '',
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

function getPayrollStatusClass(status: 'OK' | 'Проверить') {
  return status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800';
}

function getPayrollAttendanceSourceLabel(sourceType: PayrollAttendanceSourceType) {
  if (sourceType === 'form') return 'форма';
  if (sourceType === 'schedule_only') return 'график';
  if (sourceType === 'manual_excluded') return 'исключён';
  return 'ручной ввод';
}

function getPayrollDaysSourceLabel(source: PayrollDaysSource) {
  if (source === 'attendance') return 'Посещаемость';
  if (source === 'schedule') return 'График + опоздания вручную';
  if (source === 'manualCorrection') return 'Ручная корректировка';
  return 'Ручной ввод';
}

function getSalaryTypeLabel(salaryType: SalaryType) {
  if (salaryType === 'purchase_manager') return 'Закупщик';
  if (salaryType === 'fixed_salary') return 'Фиксированная зарплата';
  if (salaryType === 'vl_percent') return 'ВЛ процент';
  if (salaryType === 'wholesale_percent') return 'Оптовый процент';
  return 'Розничный бонус продаж';
}

function getSalaryFormulaLabel(salaryType: SalaryType) {
  if (salaryType === 'purchase_manager') return '20 × 600 + закупки × 1,75% + доведение до 100 000 - аванс - удержание';
  if (salaryType === 'fixed_salary') return 'оклад + премия - аванс - удержание';
  if (salaryType === 'vl_percent') return '12% от итого начислено выбранных сотрудников';
  if (salaryType === 'wholesale_percent') return 'оптовый бонус + дни + дисциплина - аванс';
  return 'дни + бонусы продаж + дисциплина - аванс';
}

function findAttendanceMatches<T extends { employee: string }>(rows: T[], attendanceNames: string[]) {
  const normalizedNames = attendanceNames.map((name) => normalizePersonName(name)).filter(Boolean);

  return rows.filter((row) => {
    const normalizedEmployee = normalizePersonName(row.employee);
    return normalizedNames.some((name) => normalizedEmployee === name || normalizedEmployee.includes(name) || name.includes(normalizedEmployee));
  });
}

function buildProblemRows(definitions: Array<{ type: SalesProblemType; label: string; rows: ClassifiedSalesRow[] }>) {
  return definitions.flatMap(({ type, label, rows }) =>
    rows.map((row) => ({
      kind: 'sales' as const,
      row,
      type,
      label,
    })),
  );
}

function buildPayrollProblemRows(definitions: Array<{ type: Exclude<ProblemType, 'all' | SalesProblemType>; label: string; rows: FullPayrollRow[] }>) {
  return definitions.flatMap(({ type, label, rows }) =>
    rows.map((row) => ({
      kind: 'payroll' as const,
      row,
      type,
      label,
    })),
  );
}

function buildWholesaleCategorySummaries(rows: ClassifiedSalesRow[]): WholesaleCategorySummary[] {
  const map = new Map<string, WholesaleCategorySummary>();

  rows
    .filter((row) => row.department === 'Опт')
    .forEach((row) => {
      const current =
        map.get(row.category) ??
        ({
          category: row.category,
          rows: 0,
          revenue: 0,
          grossProfit: 0,
          includedInWholesaleBase: row.includedInWholesaleBase !== false,
          status:
            row.calculationType === 'WHOLESALE_REVIEW_TECH'
              ? 'спорная техника, но входит в базу'
              : row.includedInWholesaleBase === false
                ? 'исключено из базы'
                : 'входит в базу',
        } satisfies WholesaleCategorySummary);

      current.rows += 1;
      current.revenue += row.revenue;
      current.grossProfit += row.grossProfit;
      current.includedInWholesaleBase = current.includedInWholesaleBase && row.includedInWholesaleBase !== false;
      if (row.calculationType === 'WHOLESALE_REVIEW_TECH') current.status = 'спорная техника, но входит в базу';
      if (row.includedInWholesaleBase === false) current.status = 'исключено из базы';
      map.set(row.category, current);
    });

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

function getManagerStatus(summary: BonusManagerSummary, rows: ClassifiedSalesRow[], accessoryExcludedRows: ClassifiedSalesRow[]) {
  const managerRows = rows.filter((row) => row.manager === summary.manager);
  const missingClassification = managerRows.filter((row) => !row.calculationType).length;
  const accessoryExcluded = accessoryExcludedRows.filter((row) => row.manager === summary.manager).length;
  const invalidNumbers = managerRows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))).length;
  const missingContext = managerRows.filter((row) => !row.manager || !row.client || !row.category).length;

  if (missingClassification || accessoryExcluded || invalidNumbers || missingContext || !Number.isFinite(summary.totalBonus)) {
    const reasons = [
      missingClassification ? 'есть строки без классификации' : '',
      accessoryExcluded ? 'ошибочно исключены аксессуары' : '',
      invalidNumbers ? 'есть NaN/undefined в суммах' : '',
      missingContext ? 'не распознан контекст строки' : '',
      !Number.isFinite(summary.totalBonus) ? 'бонус не может быть рассчитан' : '',
    ].filter(Boolean);
    return { status: 'Ошибка', reason: reasons.join(', ') };
  }

  const disputed = managerRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH').length;
  const credits = managerRows.filter((row) => row.isCreditSale).length;
  const negative = managerRows.filter((row) => row.grossProfit < 0).length;
  const zeroBase = managerRows.filter(hasUnexpectedZeroBase).length;

  if (disputed || credits || negative || zeroBase) {
    const reasons = [
      disputed ? `спорная техника ${disputed}` : '',
      credits ? `кредиты ${credits}` : '',
      negative ? `отрицательная ВП ${negative}` : '',
      zeroBase ? `нулевая база ${zeroBase}` : '',
    ].filter(Boolean);
    return { status: 'Проверить', reason: reasons.join(', ') };
  }

  return { status: 'OK', reason: 'замечаний нет' };
}

export default function AdminPayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth()));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [specialFilter, setSpecialFilter] = useState('all');
  const [activePayrollTab, setActivePayrollTab] = useState('summary');
  const [expandedManager, setExpandedManager] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [manualPayroll, setManualPayroll] = useState<Record<string, PayrollManualInput>>({});
  const [fixedPayroll, setFixedPayroll] = useState<Record<string, FixedPayrollInput>>({});
  const [purchasePayroll, setPurchasePayroll] = useState<PurchasePayrollInput>({ advance: '', deduction: '', comment: '' });
  const [purchaseReport, setPurchaseReport] = useState<PurchaseReportState | null>(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [attendancePreview, setAttendancePreview] = useState<PayrollAttendancePreviewResponse | null>(null);
  const [attendancePreviewError, setAttendancePreviewError] = useState('');
  const [isAttendancePreviewLoading, setIsAttendancePreviewLoading] = useState(false);
  const [attendanceApplyResult, setAttendanceApplyResult] = useState<AttendanceApplyResult | null>(null);
  const [problemManagerFilter, setProblemManagerFilter] = useState('all');
  const [problemDepartmentFilter, setProblemDepartmentFilter] = useState('all');
  const [problemCategoryFilter, setProblemCategoryFilter] = useState('all');
  const [problemClientFilter, setProblemClientFilter] = useState('all');
  const [problemTypeFilter, setProblemTypeFilter] = useState<ProblemType>('all');
  const [problemSearch, setProblemSearch] = useState('');
  const [problemArticleSearch, setProblemArticleSearch] = useState('');
  const [detailSearch, setDetailSearch] = useState('');
  const [articleSearch, setArticleSearch] = useState('');
  const loadedManualPayrollKey = useRef('');
  const skipNextManualPayrollSave = useRef(true);

  const rows = selectedSheet && workbook ? workbook.sheets[selectedSheet] ?? [] : [];
  const payrollManualStorageKey = `payroll-manual-${year}-${month}`;

  useEffect(() => {
    skipNextManualPayrollSave.current = true;
    try {
      const saved = window.localStorage.getItem(payrollManualStorageKey);
      setManualPayroll(saved ? JSON.parse(saved) as Record<string, PayrollManualInput> : {});
    } catch {
      setManualPayroll({});
    }
    loadedManualPayrollKey.current = payrollManualStorageKey;
  }, [payrollManualStorageKey]);

  useEffect(() => {
    if (loadedManualPayrollKey.current !== payrollManualStorageKey) return;
    if (skipNextManualPayrollSave.current) {
      skipNextManualPayrollSave.current = false;
      return;
    }
    window.localStorage.setItem(payrollManualStorageKey, JSON.stringify(manualPayroll));
  }, [manualPayroll, payrollManualStorageKey]);

  const parseResult = useMemo(() => parsePayrollReport(rows), [rows]);
  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);
  const classification = useMemo(() => classifySalesRows(parseResult.rows), [parseResult.rows]);
  const managerOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.manager))).sort((a, b) => a.localeCompare(b, 'ru')), [classification.rows]);
  const typeOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.calculationType))), [classification.rows]);
  const categoryOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.category))).sort((a, b) => a.localeCompare(b, 'ru')), [classification.rows]);
  const clientOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.client))).sort((a, b) => a.localeCompare(b, 'ru')), [classification.rows]);
  const negativeRows = useMemo(() => classification.rows.filter((row) => row.grossProfit < 0), [classification.rows]);
  const zeroBaseRows = useMemo(() => classification.rows.filter(hasUnexpectedZeroBase), [classification.rows]);
  const unclassifiedRows = useMemo(() => classification.rows.filter((row) => !row.calculationType), [classification.rows]);
  const wholesaleReviewRows = useMemo(() => classification.rows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH'), [classification.rows]);
  const retailReviewRows = useMemo(() => classification.rows.filter((row) => row.calculationType === 'RETAIL_REVIEW_TECH'), [classification.rows]);
  const excludedWholesaleRows = useMemo(() => classification.rows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH'), [classification.rows]);
  const creditRows = useMemo(() => classification.rows.filter((row) => row.isCreditSale), [classification.rows]);
  const creditTechRows = useMemo(() => creditRows.filter((row) => row.creditProductType === 'tech'), [creditRows]);
  const creditAccessoryRows = useMemo(() => creditRows.filter((row) => row.creditProductType === 'accessory'), [creditRows]);
  const creditReviewRows = useMemo(() => creditRows.filter((row) => row.creditProductType === 'review'), [creditRows]);
  const totalRevenue = useMemo(() => classification.rows.reduce((sum, row) => sum + row.revenue, 0), [classification.rows]);
  const totalGrossProfit = useMemo(() => classification.rows.reduce((sum, row) => sum + row.grossProfit, 0), [classification.rows]);
  const totalBonus = useMemo(() => classification.managerSummaries.reduce((sum, row) => sum + row.totalBonus, 0), [classification.managerSummaries]);
  const salesPayrollRows = useMemo(
    () => classification.managerSummaries.map((summary) => buildFullPayrollRow(summary, manualPayroll[summary.manager])),
    [classification.managerSummaries, manualPayroll],
  );
  const fixedPayrollRows = useMemo(() => buildFixedPayrollRows(fixedPayroll), [fixedPayroll]);
  const purchasePayrollRow = useMemo(() => buildPurchasePayrollRow(purchasePayroll, purchaseReport), [purchasePayroll, purchaseReport]);
  const fullPayrollRows = useMemo(() => applyBelaPercentRule([...salesPayrollRows, ...fixedPayrollRows, purchasePayrollRow]), [salesPayrollRows, fixedPayrollRows, purchasePayrollRow]);
  const purchaseTargetBase = purchaseTargetSalary / purchasePercent;
  const purchaseCompletionPercent = (purchasePayrollRow.purchasePercentAmount / purchaseTargetSalary) * 100;
  const payrollAttendanceMappingRows = useMemo(
    () =>
      salesPayrollRows.map((row) => {
        const config = payrollAttendanceConfig[row.manager];
        const attendanceNames = config?.attendanceNames ?? [];
        return {
          manager: row.manager,
          attendanceNames,
          source: config ? getPayrollAttendanceSourceLabel(config.sourceType) : 'не задано',
          status: config ? 'задано' : 'проверить',
          comment: config?.comment ?? 'Нет ручного соответствия в карте.',
        };
      }),
    [salesPayrollRows],
  );
  const payrollAttendancePreviewRows = useMemo(() => {
    if (!attendancePreview) return [];

    return salesPayrollRows.map((row) => {
      const config = payrollAttendanceConfig[row.manager];
      const attendanceNames = config?.attendanceNames ?? [];
      const formMatches = findAttendanceMatches(attendancePreview.formSummaries, attendanceNames);
      const scheduleMatches = findAttendanceMatches(attendancePreview.scheduleSummaries, attendanceNames);
      const uniqueFormMatches = Array.from(new Map(formMatches.map((match) => [normalizePersonName(match.employee), match])).values());
      const uniqueScheduleMatches = Array.from(new Map(scheduleMatches.map((match) => [normalizePersonName(match.employee), match])).values());
      const formRows = uniqueFormMatches.reduce((sum, match) => sum + match.formRows, 0);
      const uniqueFormDates = uniqueFormMatches.reduce((sum, match) => sum + match.uniqueFormDates, 0);
      const scheduleDays = uniqueScheduleMatches.reduce((sum, match) => sum + match.scheduleDays, 0);

      if (!config) {
        return {
          manager: row.manager,
          sourceType: null,
          source: 'не задано',
          sourceNames: '—',
          matchedNames: '—',
          formRows,
          uniqueFormDates,
          scheduleDays,
          workedDays: null,
          daysToApply: null,
          daySourceField: 'manual',
          lateCount: null,
          status: 'проверить',
          comment: 'Нет настройки источника для предпросмотра.',
        };
      }

      if (config.sourceType === 'manual_excluded') {
        return {
          manager: row.manager,
          sourceType: config.sourceType,
          source: getPayrollAttendanceSourceLabel(config.sourceType),
          sourceNames: attendanceNames.join(', ') || '—',
          matchedNames: '—',
          formRows: 0,
          uniqueFormDates: 0,
          scheduleDays: 0,
          workedDays: null,
          daysToApply: null,
          daySourceField: 'manual',
          lateCount: null,
          status: 'исключена из автоподстановки',
          comment: config.comment,
        };
      }

      if (config.sourceType === 'manual_special') {
        return {
          manager: row.manager,
          sourceType: config.sourceType,
          source: getPayrollAttendanceSourceLabel(config.sourceType),
          sourceNames: attendanceNames.join(', ') || '—',
          matchedNames: '—',
          formRows: 0,
          uniqueFormDates: 0,
          scheduleDays: 0,
          workedDays: null,
          daysToApply: null,
          daySourceField: 'manual',
          lateCount: null,
          status: 'ручной ввод / отдельная схема позже',
          comment: config.comment,
        };
      }

      if (config.sourceType === 'schedule_only') {
        const status = uniqueScheduleMatches.length === 0 ? 'не найден' : uniqueScheduleMatches.length > 1 ? 'несколько совпадений' : 'дни из графика, опоздания вручную';

        return {
          manager: row.manager,
          sourceType: config.sourceType,
          source: getPayrollAttendanceSourceLabel(config.sourceType),
          sourceNames: attendanceNames.join(', ') || '—',
          matchedNames: uniqueScheduleMatches.map((match) => match.employee).join(', ') || '—',
          formRows,
          uniqueFormDates,
          scheduleDays,
          workedDays: uniqueScheduleMatches.length ? scheduleDays : null,
          daysToApply: uniqueScheduleMatches.length ? scheduleDays : null,
          daySourceField: 'scheduleDays',
          lateCount: null,
          status,
          comment: uniqueScheduleMatches.length ? 'Сотрудник не отмечается в форме, опоздания невозможно посчитать автоматически.' : config.comment,
        };
      }

      const status = uniqueFormMatches.length === 0 ? 'не найден' : uniqueFormMatches.length > 1 ? 'несколько совпадений' : 'найдено по форме';
      const lateCount = uniqueFormMatches.length ? uniqueFormMatches.reduce((sum, match) => sum + match.lateCount, 0) : null;

      return {
        manager: row.manager,
        sourceType: config.sourceType,
        source: getPayrollAttendanceSourceLabel(config.sourceType),
        sourceNames: attendanceNames.join(', ') || '—',
        matchedNames: uniqueFormMatches.map((match) => match.employee).join(', ') || '—',
        formRows,
        uniqueFormDates,
        scheduleDays,
        workedDays: uniqueFormMatches.length ? uniqueFormDates : null,
        daysToApply: uniqueFormMatches.length ? uniqueFormDates : null,
        daySourceField: 'formUniqueDates',
        lateCount,
        status,
        comment: config.comment,
      };
    });
  }, [attendancePreview, salesPayrollRows]);
  const selectedManagerPayroll = useMemo(() => fullPayrollRows.find((summary) => summary.manager === selectedManager) ?? null, [fullPayrollRows, selectedManager]);
  const selectedManagerAttendanceNames = selectedManagerPayroll ? payrollAttendanceConfig[selectedManagerPayroll.manager]?.attendanceNames ?? [] : [];
  const payrollTotals = useMemo(
    () =>
      fullPayrollRows.reduce(
        (acc, row) => {
          acc.dayPay += row.dayPay;
          acc.salesBonus += row.salesBonus;
          acc.disciplineBonus += row.disciplineBonus;
          acc.advance += row.advance;
          acc.grossPay += row.grossPay;
          acc.netPay += row.netPay;
          return acc;
        },
        { dayPay: 0, salesBonus: 0, disciplineBonus: 0, advance: 0, grossPay: 0, netPay: 0 },
      ),
    [fullPayrollRows],
  );
  const wholesaleTotalBonus = classification.wholesale.bonusEach * 2;
  const retailTotalBonus = classification.managerSummaries.filter((row) => row.department === 'Розница').reduce((sum, row) => sum + row.totalBonus, 0);
  const wholesaleCategorySummaries = useMemo(() => buildWholesaleCategorySummaries(classification.rows), [classification.rows]);
  const retailRows = useMemo(() => classification.rows.filter((row) => row.department === 'Розница'), [classification.rows]);
  const retailTechSummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10')), [retailRows]);
  const retailAccessorySummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'RETAIL_ACCESSORY_5')), [retailRows]);
  const retailFilmSummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'RETAIL_FILM_50')), [retailRows]);
  const retailPlotterSummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50')), [retailRows]);
  const retailCreditSummary = useMemo(() => sumRows(creditTechRows), [creditTechRows]);
  const retailReviewSummary = useMemo(() => sumRows(retailReviewRows), [retailReviewRows]);
  const classificationErrorCount = classification.accessoryExcludedRows.length + unclassifiedRows.length;
  const payrollReviewCount = fullPayrollRows.filter((row) => row.payrollStatus === 'Проверить').length;
  const registrarParseUnsafe = parseResult.isRegistrarReport && (!parseResult.isSafeForPayrollCalculation || payrollReviewCount > 20);
  const selectedManagerSummary = useMemo(() => classification.managerSummaries.find((summary) => summary.manager === selectedManager) ?? null, [classification.managerSummaries, selectedManager]);
  const selectedManagerRows = useMemo(() => classification.rows.filter((row) => row.manager === selectedManager), [classification.rows, selectedManager]);
  const selectedManagerStatus = selectedManagerPayroll && (selectedManagerPayroll.salaryType === 'fixed_salary' || selectedManagerPayroll.salaryType === 'purchase_manager')
    ? { status: selectedManagerPayroll.payrollStatus, reason: selectedManagerPayroll.payrollReasons.join(', ') || 'замечаний нет' }
    : selectedManagerSummary
      ? getManagerStatus(selectedManagerSummary, classification.rows, classification.accessoryExcludedRows)
      : null;
  const selectedManagerCounts = useMemo(
    () => ({
      disputed: selectedManagerRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH').length,
      credits: selectedManagerRows.filter((row) => row.isCreditSale).length,
      negative: selectedManagerRows.filter((row) => row.grossProfit < 0).length,
      zeroBase: selectedManagerRows.filter(hasUnexpectedZeroBase).length,
      unclassified: selectedManagerRows.filter((row) => !row.calculationType).length,
      accessoryExcluded: classification.accessoryExcludedRows.filter((row) => row.manager === selectedManager).length,
      invalidNumbers: selectedManagerRows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))).length,
      creditBase: selectedManagerRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT').reduce((sum, row) => sum + row.base, 0),
      filmBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.base, 0),
      plotterBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50').reduce((sum, row) => sum + row.base, 0),
      techBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10').reduce((sum, row) => sum + row.base, 0),
      accessoryBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_ACCESSORY_5' || row.calculationType === 'RETAIL_REVIEW_TECH').reduce((sum, row) => sum + row.base, 0),
    }),
    [selectedManagerRows, classification.accessoryExcludedRows, selectedManager],
  );
  const invalidNumberRows = useMemo(() => classification.rows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))), [classification.rows]);
  const problemDefinitions = useMemo(
    () => [
      { type: 'disputed' as const, label: 'Спорные товары', rows: classification.disputedRows },
      { type: 'credit' as const, label: 'Кредитные продажи — сверка', rows: creditRows },
      { type: 'wholesaleReview' as const, label: 'Спорная техника опта', rows: wholesaleReviewRows },
      { type: 'retailReview' as const, label: 'Спорная техника розницы', rows: retailReviewRows },
      { type: 'expensiveUnclassified' as const, label: 'Новые дорогие товары / требуют классификации', rows: classification.expensiveReviewRows },
      { type: 'negative' as const, label: 'Отрицательная ВП', rows: negativeRows },
      { type: 'zeroBase' as const, label: 'Подозрительная нулевая база', rows: zeroBaseRows },
      { type: 'unclassified' as const, label: 'Без классификации', rows: unclassifiedRows },
      { type: 'accessoryExcluded' as const, label: 'Ошибочно исключённые аксессуары', rows: classification.accessoryExcludedRows },
      { type: 'invalidNumbers' as const, label: 'NaN/undefined', rows: invalidNumberRows },
    ],
    [classification.disputedRows, creditRows, wholesaleReviewRows, retailReviewRows, classification.expensiveReviewRows, negativeRows, zeroBaseRows, unclassifiedRows, classification.accessoryExcludedRows, invalidNumberRows],
  );
  const payrollProblemDefinitions = useMemo(
    () => [
      { type: 'disciplineBonusRemoved' as const, label: 'Бонус дисциплины снят', rows: fullPayrollRows.filter((row) => (row.lateCount ?? 0) > 3) },
    ],
    [fullPayrollRows],
  );
  const problemRows = useMemo(() => {
    const search = normalizeText(problemSearch);
    const articleSearch = normalizeText(problemArticleSearch);
    const selectedRows =
      problemTypeFilter === 'all'
        ? [...buildProblemRows(problemDefinitions.filter((definition) => definition.type !== 'disputed')), ...buildPayrollProblemRows(payrollProblemDefinitions)]
        : [
            ...buildProblemRows(problemDefinitions.filter((definition) => definition.type === problemTypeFilter)),
            ...buildPayrollProblemRows(payrollProblemDefinitions.filter((definition) => definition.type === problemTypeFilter)),
          ];

    return selectedRows.filter(
      (problem) => {
        if (problemManagerFilter !== 'all' && problem.row.manager !== problemManagerFilter) return false;
        if (problemDepartmentFilter !== 'all' && problem.row.department !== problemDepartmentFilter) return false;
        if (problem.kind === 'payroll') return !search && !articleSearch;

        return (
          (problemCategoryFilter === 'all' || problem.row.category === problemCategoryFilter) &&
          (problemClientFilter === 'all' || problem.row.client === problemClientFilter) &&
          (!search || normalizeText(problem.row.item).includes(search)) &&
          (!articleSearch || normalizeText(problem.row.article).includes(articleSearch))
        );
      },
    );
  }, [problemDefinitions, payrollProblemDefinitions, problemTypeFilter, problemManagerFilter, problemDepartmentFilter, problemCategoryFilter, problemClientFilter, problemSearch, problemArticleSearch]);

  function openProblemRows(problemType: ProblemType, manager = 'all') {
    setProblemTypeFilter(problemType);
    setProblemManagerFilter(manager);
    setProblemDepartmentFilter('all');
    setProblemCategoryFilter('all');
    setProblemClientFilter('all');
    setProblemSearch('');
    setProblemArticleSearch('');
    setActivePayrollTab('Проверка');
  }

  function updateManualPayroll(manager: string, field: keyof PayrollManualInput, value: string) {
    setManualPayroll((current) => {
      const previous = current[manager] ?? {
        workedDays: '',
        lateCount: '',
        advance: '',
        comment: '',
      };
      const nextSource = field === 'workedDays' || field === 'lateCount' ? 'manualCorrection' : previous.source;

      return {
        ...current,
        [manager]: {
          ...previous,
          [field]: value,
          source: nextSource,
        },
      };
    });
  }

  function updateFixedPayroll(manager: string, field: keyof FixedPayrollInput, value: string) {
    setFixedPayroll((current) => {
      const previous = current[manager] ?? {
        bonus: '',
        advance: '',
        deduction: '',
        comment: '',
      };

      return {
        ...current,
        [manager]: {
          ...previous,
          [field]: value,
        },
      };
    });
  }

  function updatePurchasePayroll(field: keyof PurchasePayrollInput, value: string) {
    setPurchasePayroll((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadAttendancePreview() {
    setAttendancePreviewError('');
    setAttendanceApplyResult(null);
    setIsAttendancePreviewLoading(true);

    try {
      const response = await fetch(`/api/admin/payroll/attendance-preview?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`, { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Не удалось загрузить предпросмотр посещаемости.');
      }

      setAttendancePreview(payload as PayrollAttendancePreviewResponse);
    } catch (caught) {
      setAttendancePreview(null);
      setAttendancePreviewError(caught instanceof Error ? caught.message : 'Не удалось загрузить предпросмотр посещаемости.');
    } finally {
      setIsAttendancePreviewLoading(false);
    }
  }

  function applyAttendancePreviewDays() {
    if (!attendancePreview) return;

    const result: AttendanceApplyResult = {
      fullApplied: 0,
      daysOnlyApplied: 0,
      skipped: 0,
      preservedManualFields: 0,
      rows: [],
    };
    const next = { ...manualPayroll };

    for (const row of payrollAttendancePreviewRows) {
      const previous = {
        ...(next[row.manager] ?? {
          workedDays: '',
          lateCount: '',
          advance: '',
          comment: '',
        }),
      };
      const hasManualWorkedDays = Boolean(previous.workedDays.trim());
      const hasManualLateCount = Boolean(previous.lateCount.trim());

      if (row.sourceType === 'form' && row.status === 'найдено по форме' && row.daysToApply !== null && row.lateCount !== null) {
        let appliedWorkedDays = false;
        let appliedLateCount = false;

        if (hasManualWorkedDays) {
          result.preservedManualFields += 1;
        } else {
          previous.workedDays = String(row.daysToApply);
          appliedWorkedDays = true;
        }

        if (hasManualLateCount) {
          result.preservedManualFields += 1;
        } else {
          previous.lateCount = String(row.lateCount);
          appliedLateCount = true;
        }

        if (appliedWorkedDays || appliedLateCount) {
          previous.source = 'attendance';
          if (appliedWorkedDays && appliedLateCount) result.fullApplied += 1;
          else result.daysOnlyApplied += 1;
          result.rows.push({
            manager: row.manager,
            sourceType: row.sourceType,
            appliedWorkedDays: appliedWorkedDays ? row.daysToApply : null,
            daySourceField: row.daySourceField,
            appliedLateCount: appliedLateCount ? row.lateCount : null,
          });
        } else {
          result.skipped += 1;
        }

        next[row.manager] = { ...previous };
        continue;
      }

      if (row.sourceType === 'schedule_only' && row.status === 'дни из графика, опоздания вручную' && row.daysToApply !== null) {
        if (hasManualWorkedDays) {
          result.preservedManualFields += 1;
          result.skipped += 1;
        } else {
          next[row.manager] = {
            ...previous,
            workedDays: String(row.daysToApply),
            source: 'schedule',
          };
          result.daysOnlyApplied += 1;
          result.rows.push({
            manager: row.manager,
            sourceType: row.sourceType,
            appliedWorkedDays: row.daysToApply,
            daySourceField: row.daySourceField,
            appliedLateCount: null,
          });
        }
        continue;
      }

      result.skipped += 1;
    }

    setManualPayroll(next);
    setAttendanceApplyResult(result);
  }

  const filteredClassifiedRows = useMemo(
    () =>
      classification.rows.filter(
        (row) =>
          (departmentFilter === 'all' || row.department === departmentFilter) &&
          (managerFilter === 'all' || row.manager === managerFilter) &&
          (typeFilter === 'all' || row.calculationType === typeFilter) &&
          (categoryFilter === 'all' || row.category === categoryFilter) &&
          (clientFilter === 'all' || row.client === clientFilter) &&
          (specialFilter === 'all' ||
            (specialFilter === 'excluded-wholesale' && row.calculationType === 'WHOLESALE_EXCLUDED_TECH') ||
            (specialFilter === 'accessory-excluded' && row.calculationType === 'WHOLESALE_EXCLUDED_TECH' && isAccessoryCategory(row.category)) ||
            (specialFilter === 'review-tech' && (row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH')) ||
            (specialFilter === 'phones' && isPhoneCategory(row.category)) ||
            (specialFilter === 'electronics-watch' && isReviewTechCategory(row.category))) &&
          (!detailSearch || normalizeText(row.item).includes(normalizeText(detailSearch))) &&
          (!articleSearch || normalizeText(row.article).includes(normalizeText(articleSearch))),
      ),
    [classification.rows, departmentFilter, managerFilter, typeFilter, categoryFilter, clientFilter, specialFilter, detailSearch, articleSearch],
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setIsParsing(true);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !['xlsx', 'csv'].includes(extension)) {
        throw new Error('Загрузите файл в формате .xlsx или .csv.');
      }

      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const parsed = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        cellStyles: true,
        raw: false,
      });

      const sheets = parsed.SheetNames.reduce<Record<string, SheetRow[]>>((acc, sheetName) => {
        const sheet = parsed.Sheets[sheetName] as SheetLike;
        acc[sheetName] = sheetToRows(XLSX, sheet);
        return acc;
      }, {});

      const nextSelectedSheet = parsed.SheetNames.includes('TDSheet') ? 'TDSheet' : parsed.SheetNames[0] ?? '';

      setWorkbook({ fileName: file.name, sheetNames: parsed.SheetNames, sheets });
      setSelectedSheet(nextSelectedSheet);
    } catch (caughtError) {
      setWorkbook(null);
      setSelectedSheet('');
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось прочитать файл.');
    } finally {
      setIsParsing(false);
    }
  }

  async function handlePurchaseFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPurchaseError('');
    setPurchaseReport(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !['xlsx', 'csv'].includes(extension)) {
        throw new Error('Загрузите отчёт закупок в формате .xlsx или .csv.');
      }

      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const parsed = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        cellStyles: true,
        raw: false,
      });
      const sheetName = parsed.SheetNames.includes('TDSheet') ? 'TDSheet' : parsed.SheetNames[0] ?? '';
      const sheet = parsed.Sheets[sheetName] as SheetLike;
      const result = parsePurchaseReport(sheetToRows(XLSX, sheet));

      if (result.base === null) {
        throw new Error('Не найдена сумма по колонке “Увеличение нашего долга”.');
      }

      setPurchaseReport({
        fileName: file.name,
        base: result.base,
        sourceRow: result.sourceRow,
      });
    } catch (caughtError) {
      setPurchaseReport(null);
      setPurchaseError(caughtError instanceof Error ? caughtError.message : 'Не удалось прочитать отчёт закупок.');
    }
  }

  function getPayrollRowStatus(row: FullPayrollRow) {
    if (row.salaryType === 'fixed_salary' || row.salaryType === 'purchase_manager') return row.payrollStatus;
    const statusInfo = getManagerStatus(row, classification.rows, classification.accessoryExcludedRows);
    return statusInfo.status === 'OK' && row.payrollStatus === 'OK' ? 'OK' : 'Проверить';
  }

  function getPayrollExportMainAmount(row: FullPayrollRow) {
    if (row.salaryType === 'fixed_salary') return row.fixedSalary;
    if (row.salaryType === 'purchase_manager') return row.purchasePercentAmount + row.purchaseTargetAdjustment;
    if (row.salaryType === 'vl_percent') return row.grossPay;
    return row.salesBonus;
  }

  function getPayrollExportCategory(row: FullPayrollRow) {
    if (row.salaryType === 'purchase_manager') return 'Закупки';
    if (row.salaryType === 'fixed_salary') return 'Фиксированная ЗП';
    if (row.salaryType === 'vl_percent') return 'ВЛ';
    if (row.salaryType === 'wholesale_percent') return 'Опт';
    return 'Розница';
  }

  function getPayrollExportShortType(row: FullPayrollRow) {
    if (row.salaryType === 'purchase_manager') return 'Закупщик';
    if (row.salaryType === 'fixed_salary') return 'Оклад';
    if (row.salaryType === 'vl_percent') return 'ВЛ 12%';
    if (row.salaryType === 'wholesale_percent') return 'Опт 1,75%';
    return 'Розница';
  }

  function toExportMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  function getManagerComponentBases(manager: string) {
    const managerRows = classification.rows.filter((row) => row.manager === manager);
    return {
      credit: managerRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT').reduce((sum, row) => sum + row.base, 0),
      film: managerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.base, 0),
      plotter: managerRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50').reduce((sum, row) => sum + row.base, 0),
      tech: managerRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10').reduce((sum, row) => sum + row.base, 0),
      accessory: managerRows.filter((row) => row.calculationType === 'RETAIL_ACCESSORY_5' || row.calculationType === 'RETAIL_REVIEW_TECH').reduce((sum, row) => sum + row.base, 0),
    };
  }

  function buildAccrualExportRows() {
    return fullPayrollRows.flatMap((row) => {
      const baseColumns = [row.manager, getPayrollExportCategory(row), getPayrollExportShortType(row)] as const;
      const rowsForEmployee: Array<Array<string | number | null>> = [];
      const push = (component: string, base: string | number | null, formula: string, amount: number, comment = '') => {
        rowsForEmployee.push([...baseColumns, component, typeof base === 'number' ? toExportMoney(base) : base, formula, toExportMoney(amount), comment]);
      };

      if (row.salaryType === 'fixed_salary') {
        push('Фиксированный оклад', row.fixedSalary, 'оклад', row.fixedSalary, row.position);
        push('Премия', row.fixedBonus, 'ручной ввод', row.fixedBonus);
        push('Аванс', row.advance, 'удержание', -row.advance);
        push('Удержание', row.fixedDeduction, 'ручной ввод', -row.fixedDeduction);
        push('К выплате', row.grossPay, 'оклад + премия - аванс - удержание', row.netPay, row.comment);
        return rowsForEmployee;
      }

      if (row.salaryType === 'purchase_manager') {
        push('Оплата по дням', purchaseStandardWorkedDays, `${purchaseStandardWorkedDays} × ${purchaseDayRate}`, row.dayPay, `ставка ${formatMoney(purchaseDayRate)}`);
        push('Закупки 1,75%', row.purchaseBase, 'закупки × 1,75%', row.purchasePercentAmount);
        push('Доведение закупщика до 100 000', row.purchaseTargetSalary, 'целевая ЗП - дни - закупки 1,75%', row.purchaseTargetAdjustment);
        push('Аванс', row.advance, 'удержание', -row.advance);
        push('Удержание', row.fixedDeduction, 'ручной ввод', -row.fixedDeduction);
        push('К выплате', row.grossPay, getSalaryFormulaLabel(row.salaryType), row.netPay, row.comment);
        return rowsForEmployee;
      }

      if (row.dayPay) push('Оплата по дням', row.workedDays, `${row.workedDays ?? 0} × ${row.dayRate}`, row.dayPay, getPayrollDaysSourceLabel(row.daysSource));

      if (row.salaryType === 'vl_percent') {
        push('ВЛ 12%', row.grossPay / 0.12, '12% от итого начислено выбранных сотрудников', row.grossPay);
      } else if (row.salaryType === 'wholesale_percent') {
        push('Бонус опта 1,75%', classification.wholesale.base, 'общая база опта × 1,75%', row.wholesaleBonus);
      } else {
        const bases = getManagerComponentBases(row.manager);
        if (row.filmBonus) push('Услуги оказываемые 50%', bases.film, 'выручка × 50%', row.filmBonus);
        if (row.plotterBonus) push('Плоттерные материалы 50% от с/с', bases.plotter, 'с/с × 50%', row.plotterBonus);
        if (row.techBonus) push('Техника 10% от ВП', bases.tech, 'ВП × 10%', row.techBonus);
        if (row.accessoryBonus) push('Аксессуары 5%', bases.accessory, 'выручка × 5%', row.accessoryBonus);
        if (row.creditBonus) push('Кредитный бонус', bases.credit, 'ВП × 0,91 × 10%', row.creditBonus);
      }

      if (row.disciplineBonus) push('Дисциплина', row.lateCount, 'опозданий ≤ 3', row.disciplineBonus);
      if (row.agentCreditCommission > 0) push('Агентские по кредитам', null, 'ручной ввод', row.agentCreditCommission, 'Отдельное ручное начисление');
      push('Аванс', row.advance, 'удержание', -row.advance);
      push('К выплате', row.grossPay, getSalaryFormulaLabel(row.salaryType), row.netPay, row.comment);

      return rowsForEmployee;
    });
  }

  function buildPayrollCheckRows() {
    return fullPayrollRows.flatMap((row) => {
      const managerRows = classification.rows.filter((item) => item.manager === row.manager);
      const checks = [
        ['Спорные товары', managerRows.filter((item) => item.calculationType === 'WHOLESALE_REVIEW_TECH' || item.calculationType === 'RETAIL_REVIEW_TECH').length, 'Проверить', 'Проверьте спорную технику и товары'],
        ['Отрицательная валовая прибыль', managerRows.filter((item) => item.grossProfit < 0).length, 'Проверить', 'Возможны возвраты или корректировки'],
        ['Строки с подозрительной нулевой базой', managerRows.filter(hasUnexpectedZeroBase).length, 'Проверить', 'База расчёта равна нулю без ожидаемого исключения'],
        ['Кредиты', managerRows.filter((item) => item.isCreditSale).length, 'Проверить', 'Кредитные продажи требуют сверки'],
        ['Строки без классификации', managerRows.filter((item) => !item.calculationType).length, 'Ошибка', 'Нет классификации строки'],
        ['Не заполнены дни', row.workedDays === null && row.salaryType !== 'fixed_salary' ? 1 : 0, 'Проверить', 'Заполните дни вручную или через предпросмотр'],
        ['Не заполнены опоздания', row.lateCount === null && row.salaryType !== 'fixed_salary' && row.salaryType !== 'purchase_manager' ? 1 : 0, 'Проверить', 'Заполните опоздания вручную'],
        ['Ручная корректировка дней', row.daysSource === 'manualCorrection' ? 1 : 0, 'Проверить', 'Дни или опоздания изменены вручную'],
        ['Особая схема расчёта', row.salaryType === 'fixed_salary' || row.salaryType === 'purchase_manager' || row.salaryType === 'vl_percent' ? 1 : 0, 'OK', getSalaryTypeLabel(row.salaryType)],
      ];

      return checks
        .filter(([, count]) => Number(count) > 0)
        .map(([check, count, status, comment]) => [row.manager, check, count, status, comment]);
    });
  }

  async function exportPayrollWorkbook() {
    const XLSX = (await import('xlsx-js-style')).default;
    const workbookExport = XLSX.utils.book_new();
    const periodLabel = `${months[Number(month)]} ${year}`;
    const generatedAt = new Date().toLocaleString('ru-RU');
    const moneyFormat = '# ##0';
    const accrualMoneyFormat = '# ##0,00 ₽;[Red]-# ##0,00 ₽';
    const integerFormat = '#,##0';
    const border = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };
    const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border };
    const titleStyle = { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center', vertical: 'center' }, border };
    const summaryLabelStyle = { font: { bold: true, color: { rgb: '475569' } }, fill: { fgColor: { rgb: 'F8FAFC' } }, alignment: { horizontal: 'center' }, border };
    const summaryValueStyle = { font: { bold: true, color: { rgb: '0F172A' } }, fill: { fgColor: { rgb: 'E2E8F0' } }, alignment: { horizontal: 'center' }, border };
    const totalStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, border };
    const warningStyle = { fill: { fgColor: { rgb: 'FEF3C7' } } };
    const retailGroupStyle = { fill: { fgColor: { rgb: 'F3F8F6' } }, border };
    const wholesaleGroupStyle = { fill: { fgColor: { rgb: 'F2F7FB' } }, border };
    const purchaseGroupStyle = { fill: { fgColor: { rgb: 'FAF7EF' } }, border };
    const mutedGroupStyle = { fill: { fgColor: { rgb: 'F5F4F7' } }, border };
    const fixedColumnStyle = { fill: { fgColor: { rgb: 'E5E7EB' } }, border };
    const dayColumnStyle = { fill: { fgColor: { rgb: 'FFEDD5' } }, border };
    const salesColumnStyle = { fill: { fgColor: { rgb: 'DBEAFE' } }, border };
    const purchaseColumnStyle = { fill: { fgColor: { rgb: 'EDE9FE' } }, border };
    const greenColumnStyle = { fill: { fgColor: { rgb: 'DCFCE7' } }, border };
    const deductionColumnStyle = { fill: { fgColor: { rgb: 'FCE7F3' } }, border };
    const payoutColumnStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'E0F2FE' } }, border };
    const disciplineRemovedStyle = { font: { bold: true, color: { rgb: '92400E' } }, fill: { fgColor: { rgb: 'FDE68A' } }, border };
    const checkErrorStyle = { fill: { fgColor: { rgb: 'FEE2E2' } } };
    const checkWarningStyle = { fill: { fgColor: { rgb: 'FEF3C7' } } };
    const baseCellStyle = { border, alignment: { vertical: 'center' } };
    const fileInfoStyle = { border, alignment: { vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: 'F8FAFC' } } };
    const accrualHeaderStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border,
    };
    const accrualBlockBorder = {
      top: { style: 'medium', color: { rgb: '64748B' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };
    const accrualPayoutBorder = {
      top: { style: 'medium', color: { rgb: '0F766E' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };
    const setCellStyle = (sheet: Record<string, unknown>, address: string, style: object) => {
      const cell = sheet[address] as { s?: object } | undefined;
      if (cell) cell.s = { ...(cell.s ?? {}), ...style };
    };
    const mergeCellStyle = (sheet: Record<string, unknown>, rowNumber: number, col: number, style: object) => {
      setCellStyle(sheet, XLSX.utils.encode_cell({ r: rowNumber - 1, c: col }), style);
    };
    const setRowStyle = (sheet: Record<string, unknown>, rowNumber: number, fromCol: number, toCol: number, style: object) => {
      for (let col = fromCol; col <= toCol; col += 1) setCellStyle(sheet, XLSX.utils.encode_cell({ r: rowNumber - 1, c: col }), style);
    };
    const setColumnNumberFormat = (sheet: Record<string, unknown>, firstRow: number, lastRow: number, columns: number[], format: string) => {
      for (let rowIndex = firstRow - 1; rowIndex <= lastRow - 1; rowIndex += 1) {
        for (const col of columns) {
          const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: col })] as { z?: string } | undefined;
          if (cell) cell.z = format;
        }
      }
    };

    const statusCounts = fullPayrollRows.reduce(
      (acc, row) => {
        const status = getPayrollRowStatus(row);
        if (status === 'OK') acc.ok += 1;
        else acc.review += 1;
        return acc;
      },
      { ok: 0, review: 0 },
    );
    const totalDeductions = fullPayrollRows.reduce((sum, row) => sum + row.fixedDeduction, 0);
    const totalMainAmount = fullPayrollRows.reduce((sum, row) => sum + getPayrollExportMainAmount(row), 0);
    const totalFixedBonus = fullPayrollRows.reduce((sum, row) => sum + row.fixedBonus, 0);

    const summaryRows = [
      ['Зарплатная ведомость — ' + periodLabel],
      ['Дата формирования', '', generatedAt, 'Файл продаж', workbook?.fileName ?? 'не загружен', '', '', 'Файл закупок', purchaseReport?.fileName ?? 'не загружен'],
      [],
      ['Всего сотрудников', '', fullPayrollRows.length, '', 'Всего начислено', '', toExportMoney(payrollTotals.grossPay), '', 'Всего авансов', '', toExportMoney(payrollTotals.advance), ''],
      ['Всего удержаний', '', toExportMoney(totalDeductions), '', 'Итого к выплате', '', toExportMoney(payrollTotals.netPay), '', 'OK', statusCounts.ok, 'Проверить', statusCounts.review],
      [],
    ];
    const tableHeader = ['№', 'Сотрудник', 'Категория', 'Итого начислено', 'Фикс / оклад', 'Дни', 'Ставка', 'Оплата дней', 'Продажи / бонус', 'Закупки / бонус', 'Доведение', 'ВЛ', 'Дисциплина', 'Премия', 'Агентские', 'Аванс', 'Удержание', 'К выплате', 'Статус', 'Комментарий'];
    const tableRows = fullPayrollRows.map((row, index) => [
      index + 1,
      row.manager,
      getPayrollExportCategory(row),
      toExportMoney(row.grossPay),
      row.salaryType === 'fixed_salary' ? toExportMoney(row.fixedSalary) : '',
      row.workedDays ?? '',
      row.dayRate || '',
      toExportMoney(row.dayPay),
      row.salaryType === 'retail_sales_bonus' || row.salaryType === 'wholesale_percent' ? toExportMoney(row.salesBonus) : '',
      row.salaryType === 'purchase_manager' ? toExportMoney(row.purchasePercentAmount) : '',
      row.salaryType === 'purchase_manager' ? toExportMoney(row.purchaseTargetAdjustment) : '',
      row.salaryType === 'vl_percent' ? toExportMoney(row.grossPay) : '',
      row.salaryType === 'fixed_salary' || row.salaryType === 'purchase_manager' ? '' : toExportMoney(row.disciplineBonus),
      toExportMoney(row.fixedBonus),
      toExportMoney(row.agentCreditCommission),
      toExportMoney(row.advance),
      toExportMoney(row.fixedDeduction),
      toExportMoney(row.netPay),
      getPayrollRowStatus(row),
      [getPayrollExportShortType(row), row.lateCount === null ? '' : `Опозд.: ${row.lateCount}`, row.comment].filter(Boolean).join(' · '),
    ]);
    const totalPurchaseBonus = fullPayrollRows.reduce((sum, row) => sum + (row.salaryType === 'purchase_manager' ? row.purchasePercentAmount : 0), 0);
    const totalPurchaseAdjustment = fullPayrollRows.reduce((sum, row) => sum + (row.salaryType === 'purchase_manager' ? row.purchaseTargetAdjustment : 0), 0);
    const totalVlAmount = fullPayrollRows.reduce((sum, row) => sum + (row.salaryType === 'vl_percent' ? row.grossPay : 0), 0);
    const totalFixedSalary = fullPayrollRows.reduce((sum, row) => sum + (row.salaryType === 'fixed_salary' ? row.fixedSalary : 0), 0);
    const totalAgentCreditCommission = fullPayrollRows.reduce((sum, row) => sum + row.agentCreditCommission, 0);
    const totalRow = ['ИТОГО', '', '', toExportMoney(payrollTotals.grossPay), toExportMoney(totalFixedSalary), '', '', toExportMoney(payrollTotals.dayPay), toExportMoney(totalBonus), toExportMoney(totalPurchaseBonus), toExportMoney(totalPurchaseAdjustment), toExportMoney(totalVlAmount), toExportMoney(payrollTotals.disciplineBonus), toExportMoney(totalFixedBonus), toExportMoney(totalAgentCreditCommission), toExportMoney(payrollTotals.advance), toExportMoney(totalDeductions), toExportMoney(payrollTotals.netPay), '', ''];
    const summarySheet = XLSX.utils.aoa_to_sheet([...summaryRows, tableHeader, ...tableRows, totalRow]);
    const tableHeaderRow = summaryRows.length + 1;
    const totalRowNumber = tableHeaderRow + tableRows.length + 1;
    summarySheet['!cols'] = [5, 24, 13, 13, 11, 6, 8, 11, 13, 13, 11, 9, 10, 9, 10, 10, 10, 12, 11, 28].map((wch) => ({ wch }));
    summarySheet['!rows'] = [{ hpt: 28 }, { hpt: 38 }, { hpt: 8 }, { hpt: 26 }, { hpt: 26 }, { hpt: 8 }, { hpt: 38 }];
    summarySheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 19 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      { s: { r: 1, c: 4 }, e: { r: 1, c: 6 } },
      { s: { r: 1, c: 8 }, e: { r: 1, c: 11 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
      { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
      { s: { r: 3, c: 6 }, e: { r: 3, c: 7 } },
      { s: { r: 3, c: 8 }, e: { r: 3, c: 9 } },
      { s: { r: 3, c: 10 }, e: { r: 3, c: 11 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
      { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } },
      { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },
      { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } },
    ];
    summarySheet['!autofilter'] = { ref: `A${tableHeaderRow}:T${totalRowNumber}` };
    summarySheet['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow, topLeftCell: `A${tableHeaderRow + 1}`, activePane: 'bottomLeft', state: 'frozen' };
    setRowStyle(summarySheet, 1, 0, 19, titleStyle);
    [0, 2, 3, 4, 7, 8].forEach((col) => mergeCellStyle(summarySheet, 2, col, fileInfoStyle));
    [0, 3, 7].forEach((col) => mergeCellStyle(summarySheet, 2, col, { ...fileInfoStyle, font: { bold: true, color: { rgb: '475569' } } }));
    [0, 4, 8].forEach((col) => mergeCellStyle(summarySheet, 4, col, summaryLabelStyle));
    [2, 6, 10].forEach((col) => mergeCellStyle(summarySheet, 4, col, summaryValueStyle));
    [0, 4, 8, 10].forEach((col) => mergeCellStyle(summarySheet, 5, col, summaryLabelStyle));
    [2, 6, 9, 11].forEach((col) => mergeCellStyle(summarySheet, 5, col, summaryValueStyle));
    setRowStyle(summarySheet, tableHeaderRow, 0, 19, headerStyle);
    setRowStyle(summarySheet, totalRowNumber, 0, 19, totalStyle);
    tableRows.forEach(([, , category, , , , , , , , , , , , , , , , status], index) => {
      const rowNumber = tableHeaderRow + index + 1;
      for (let col = 0; col <= 19; col += 1) mergeCellStyle(summarySheet, rowNumber, col, baseCellStyle);
      if (category === 'Розница') [1, 2].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, retailGroupStyle));
      if (category === 'Опт') [1, 2].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, wholesaleGroupStyle));
      if (category === 'Закупки') [1, 2].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, purchaseGroupStyle));
      if (category === 'ВЛ' || category === 'Фиксированная ЗП') [1, 2].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, mutedGroupStyle));
      mergeCellStyle(summarySheet, rowNumber, 4, fixedColumnStyle);
      [5, 6, 7].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, dayColumnStyle));
      mergeCellStyle(summarySheet, rowNumber, 8, salesColumnStyle);
      [9, 10].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, purchaseColumnStyle));
      [11, 12].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, greenColumnStyle));
      [15, 16].forEach((col) => mergeCellStyle(summarySheet, rowNumber, col, deductionColumnStyle));
      mergeCellStyle(summarySheet, rowNumber, 17, payoutColumnStyle);
      const payrollRow = fullPayrollRows[index];
      if (payrollRow.salaryType !== 'fixed_salary' && payrollRow.salaryType !== 'purchase_manager' && payrollRow.lateCount !== null && payrollRow.lateCount > 3 && payrollRow.disciplineBonus === 0) {
        mergeCellStyle(summarySheet, rowNumber, 12, disciplineRemovedStyle);
      }
      if (status === 'Проверить') mergeCellStyle(summarySheet, rowNumber, 18, warningStyle);
    });
    mergeCellStyle(summarySheet, tableHeaderRow, 4, { ...headerStyle, fill: { fgColor: { rgb: '6B7280' } } });
    [5, 6, 7].forEach((col) => mergeCellStyle(summarySheet, tableHeaderRow, col, { ...headerStyle, fill: { fgColor: { rgb: 'C2410C' } } }));
    mergeCellStyle(summarySheet, tableHeaderRow, 8, { ...headerStyle, fill: { fgColor: { rgb: '1D4ED8' } } });
    [9, 10].forEach((col) => mergeCellStyle(summarySheet, tableHeaderRow, col, { ...headerStyle, fill: { fgColor: { rgb: '6D28D9' } } }));
    [11, 12].forEach((col) => mergeCellStyle(summarySheet, tableHeaderRow, col, { ...headerStyle, fill: { fgColor: { rgb: '15803D' } } }));
    [15, 16].forEach((col) => mergeCellStyle(summarySheet, tableHeaderRow, col, { ...headerStyle, fill: { fgColor: { rgb: 'BE185D' } } }));
    mergeCellStyle(summarySheet, tableHeaderRow, 17, { ...headerStyle, fill: { fgColor: { rgb: '0F766E' } } });
    setColumnNumberFormat(summarySheet, tableHeaderRow + 1, totalRowNumber, [3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], moneyFormat);
    setColumnNumberFormat(summarySheet, 4, 5, [1, 3, 5, 7], moneyFormat);
    setColumnNumberFormat(summarySheet, tableHeaderRow + 1, totalRowNumber, [0, 5], integerFormat);
    XLSX.utils.book_append_sheet(workbookExport, summarySheet, 'Ведомость ЗП');

    const accrualHeader = ['Сотрудник', 'Категория', 'Тип расчёта', 'Компонент', 'База', 'Формула', 'Сумма', 'Комментарий'];
    const accrualRows = buildAccrualExportRows();
    const accrualSheet = XLSX.utils.aoa_to_sheet([accrualHeader, ...accrualRows]);
    accrualSheet['!cols'] = [30, 18, 18, 38, 18, 48, 18, 50].map((wch) => ({ wch }));
    accrualSheet['!autofilter'] = { ref: `A1:H${accrualRows.length + 1}` };
    accrualSheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
    accrualSheet['!rows'] = [{ hpt: 34 }, ...accrualRows.map((row) => ({ hpt: row[3] === 'К выплате' ? 26 : 22 }))];
    setRowStyle(accrualSheet, 1, 0, 7, accrualHeaderStyle);
    for (let rowNumber = 2; rowNumber <= accrualRows.length + 1; rowNumber += 1) {
      const row = accrualRows[rowNumber - 2];
      const previousRow = accrualRows[rowNumber - 3];
      const isNewEmployee = !previousRow || previousRow[0] !== row[0];
      const isPayoutRow = row[3] === 'К выплате';
      const isZebraRow = rowNumber % 2 === 0;
      const rowBorder = isPayoutRow ? accrualPayoutBorder : isNewEmployee ? accrualBlockBorder : border;
      const rowStyle = {
        border: rowBorder,
        fill: { fgColor: { rgb: isPayoutRow ? 'E0F2FE' : isNewEmployee ? 'EEF2FF' : isZebraRow ? 'F8FAFC' : 'FFFFFF' } },
        font: { bold: isPayoutRow },
        alignment: { vertical: 'center', wrapText: true },
      };
      setRowStyle(accrualSheet, rowNumber, 0, 7, rowStyle);
      mergeCellStyle(accrualSheet, rowNumber, 0, { font: { bold: isNewEmployee || isPayoutRow } });
      [4, 6].forEach((col) => {
        const value = row[col];
        const isNegative = typeof value === 'number' && value < 0;
        mergeCellStyle(accrualSheet, rowNumber, col, {
          alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
          font: { bold: isPayoutRow, color: isNegative ? { rgb: 'B91C1C' } : { rgb: '0F172A' } },
        });
      });
      [1, 2, 3, 5, 7].forEach((col) => {
        mergeCellStyle(accrualSheet, rowNumber, col, { alignment: { vertical: 'center', wrapText: true } });
      });
    }
    setColumnNumberFormat(accrualSheet, 2, accrualRows.length + 1, [4, 6], accrualMoneyFormat);
    XLSX.utils.book_append_sheet(workbookExport, accrualSheet, 'Расшифровка начислений');

    const checkHeader = ['Сотрудник', 'Тип проверки', 'Количество', 'Статус', 'Комментарий'];
    const checkRows = buildPayrollCheckRows();
    const checkSheet = XLSX.utils.aoa_to_sheet([checkHeader, ...checkRows]);
    checkSheet['!cols'] = [24, 32, 12, 14, 48].map((wch) => ({ wch }));
    checkSheet['!autofilter'] = { ref: `A1:E${checkRows.length + 1}` };
    checkSheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
    setRowStyle(checkSheet, 1, 0, 4, headerStyle);
    checkRows.forEach((row, index) => {
      const rowNumber = index + 2;
      setRowStyle(checkSheet, rowNumber, 0, 4, baseCellStyle);
      if (row[3] === 'Ошибка') setRowStyle(checkSheet, rowNumber, 0, 4, { ...checkErrorStyle, border });
      if (row[3] === 'Проверить') setRowStyle(checkSheet, rowNumber, 0, 4, { ...checkWarningStyle, border });
    });
    XLSX.utils.book_append_sheet(workbookExport, checkSheet, 'Проверка');

    const sourceRows = [
      ['Показатель', 'Значение', 'Комментарий'],
      ['Период', periodLabel, 'Выбранный месяц и год'],
      ['Файл продаж', workbook?.fileName ?? 'не загружен', 'Основной отчёт 1С'],
      ['Файл закупок', purchaseReport?.fileName ?? 'не загружен', 'Отчёт по закупкам 1С'],
      ['Всего товарных строк', parseResult.rows.length, 'После разбора файла продаж'],
      ['Менеджеров', parseResult.managers.length, 'Распознано в файле продаж'],
      ['Клиентов', parseResult.clients.length, 'Распознано в файле продаж'],
      ['Общая выручка', totalRevenue, 'По строкам продаж'],
      ['Общая валовая прибыль', totalGrossProfit, 'По строкам продаж'],
      ['База опта', classification.wholesale.base, 'После исключений'],
      ['Бонус опта', classification.wholesale.bonusEach, '1,75% от базы опта'],
      ['База закупок', purchasePayrollRow.purchaseBase ?? '', 'Колонка “Увеличение нашего долга”'],
      ['1,75% от закупок', purchasePayrollRow.purchasePercentAmount, 'Аналитика закупщика'],
      ['Целевая ЗП закупщика', purchaseTargetSalary, 'Тохов Астемир'],
      ['Закупок нужно для 100 000 при 1,75%', purchaseTargetBase, '100000 / 0,0175'],
    ];
    const sourceSheet = XLSX.utils.aoa_to_sheet(sourceRows);
    sourceSheet['!cols'] = [36, 24, 48].map((wch) => ({ wch }));
    setRowStyle(sourceSheet, 1, 0, 2, headerStyle);
    for (let rowNumber = 2; rowNumber <= sourceRows.length; rowNumber += 1) setRowStyle(sourceSheet, rowNumber, 0, 2, baseCellStyle);
    setColumnNumberFormat(sourceSheet, 2, sourceRows.length, [1], moneyFormat);
    XLSX.utils.book_append_sheet(workbookExport, sourceSheet, 'Исходные итоги');

    XLSX.writeFile(workbookExport, `payroll_${months[Number(month)]}_${year}.xlsx`, { bookType: 'xlsx' });
  }

  return (
    <AdminShell>
      <div className='max-w-full overflow-x-hidden'>
      <div className='mb-7 flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div>
          <AdminBreadcrumbs current='Зарплата' />
          <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>Зарплата</h1>
          <p className='mt-1 max-w-3xl text-base font-medium text-slate-500'>
            Расчёт начислений и контроль выплат
          </p>
        </div>
        <Badge className='w-fit bg-green-100 text-green-800'>Финансовый расчёт</Badge>
      </div>

      <div className='grid gap-5'>
        <Card>
          <div className='mb-5 flex items-center gap-3'>
            <span className='flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700'>
              <FileSpreadsheet className='h-5 w-5' />
            </span>
            <div>
              <h2 className='text-lg font-bold text-slate-900'>Загрузка отчёта 1С</h2>
              <p className='text-sm text-slate-500'>Файл читается временно и не сохраняется в базу.</p>
            </div>
          </div>

          <div className='grid gap-4 md:grid-cols-[180px_140px_1fr_1fr]'>
            <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
              Месяц
              <select value={month} onChange={(event) => setMonth(event.target.value)} className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                {months.map((monthName, index) => (
                  <option key={monthName} value={index}>
                    {monthName}
                  </option>
                ))}
              </select>
            </label>

            <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
              Год
              <select value={year} onChange={(event) => setYear(event.target.value)} className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                {years.map((yearValue) => (
                  <option key={yearValue} value={yearValue}>
                    {yearValue}
                  </option>
                ))}
              </select>
            </label>

            <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
              Excel или CSV
              <span className='relative flex items-center'>
                <Upload className='pointer-events-none absolute left-3 h-4 w-4 text-slate-400' />
                <Input type='file' accept='.xlsx,.csv' onChange={handleFileChange} className='pl-10 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700' />
              </span>
            </label>

            <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
              Отчёт по закупкам 1С
              <span className='relative flex items-center'>
                <Upload className='pointer-events-none absolute left-3 h-4 w-4 text-slate-400' />
                <Input type='file' accept='.xlsx,.csv' onChange={handlePurchaseFileChange} className='pl-10 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700' />
              </span>
            </label>
          </div>

          {error && <p className='mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700'>{error}</p>}
          {purchaseError && <p className='mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700'>{purchaseError}</p>}
          {purchaseReport && <p className='mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800'>Отчёт закупок загружен: {purchaseReport.fileName}, база {formatMoney(purchaseReport.base ?? 0)}{purchaseReport.sourceRow ? `, строка ${purchaseReport.sourceRow}` : ''}.</p>}
          {isParsing && <p className='mt-4 text-sm text-slate-500'>Читаю файл...</p>}
        </Card>

        {workbook && (
          <>
            <Card>
              <div className='mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
                <div>
                  <h2 className='text-lg font-bold text-slate-900'>Проверка расчёта</h2>
                  <p className='text-sm text-slate-500'>{workbook.fileName} · {months[Number(month)]} {year}</p>
                </div>
                <Badge className={getCheckStatus(registrarParseUnsafe || classificationErrorCount > 0 ? 'error' : classification.disputedRows.length || creditRows.length ? 'warning' : 'ok')}>
                  {registrarParseUnsafe ? 'Небезопасный файл с регистратором' : classificationErrorCount > 0 ? 'Есть ошибки' : classification.disputedRows.length || creditRows.length ? 'Требует проверки' : 'Готово к проверке'}
                </Badge>
              </div>

              {registrarParseUnsafe && (
                <p className='mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900'>
                  Файл с регистратором распознан нестабильно. Расчёт зарплаты по нему небезопасен: используйте обычный отчёт без регистратора для расчёта, а файл с регистратором только для диагностики возвратов и корректировок.
                </p>
              )}

              <div className='grid min-w-0 gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3'>
                {[
                  { label: 'Файл прочитан', detail: workbook.fileName, status: 'ok' as const, count: 0 },
                  { label: 'Тип отчёта', detail: parseResult.isRegistrarReport ? 'с регистратором' : 'обычный', status: parseResult.isRegistrarReport && registrarParseUnsafe ? 'warning' as const : 'ok' as const, count: 0 },
                  { label: 'Безопасность расчёта', detail: parseResult.isRegistrarReport ? (!registrarParseUnsafe ? 'регистратор распознан стабильно' : 'только диагностика') : 'основной формат', status: !registrarParseUnsafe ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Шапка отчёта найдена', detail: parseResult.headerMap ? `строка ${rows[parseResult.headerIndex]?.excelRow}` : 'не найдена', status: parseResult.headerMap ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Товарные строки распознаны', detail: parseResult.isRegistrarReport ? `${parseResult.rows.length} после агрегации из ${parseResult.detailRowCount}` : `${parseResult.rows.length}`, status: parseResult.rows.length > 100 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Менеджеры распознаны', detail: `${parseResult.managers.length}`, status: parseResult.managers.length > 0 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Клиенты распознаны', detail: `${parseResult.clients.length}`, status: parseResult.clients.length > 0 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Опт рассчитан', detail: `база ${formatMoney(classification.wholesale.base)}`, status: classification.wholesale.base > 0 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Ошибочно исключённые аксессуары', detail: `${classification.accessoryExcludedRows.length} строк`, status: classification.accessoryExcludedRows.length ? 'error' as const : 'ok' as const, count: classification.accessoryExcludedRows.length, problemType: 'accessoryExcluded' as ProblemType },
                  { label: 'Спорная техника опта', detail: `${wholesaleReviewRows.length} строк`, status: wholesaleReviewRows.length ? 'warning' as const : 'ok' as const, count: wholesaleReviewRows.length, problemType: 'wholesaleReview' as ProblemType },
                  { label: 'Спорная техника розницы', detail: `${retailReviewRows.length} строк`, status: retailReviewRows.length ? 'warning' as const : 'ok' as const, count: retailReviewRows.length, problemType: 'retailReview' as ProblemType },
                  { label: 'Строки без классификации', detail: `${unclassifiedRows.length} строк`, status: unclassifiedRows.length ? 'error' as const : 'ok' as const, count: unclassifiedRows.length, problemType: 'unclassified' as ProblemType },
                  { label: 'Отрицательная валовая прибыль', detail: `${negativeRows.length} строк`, status: negativeRows.length ? 'warning' as const : 'ok' as const, count: negativeRows.length, problemType: 'negative' as ProblemType },
                  { label: 'Строки с подозрительной нулевой базой', detail: `${zeroBaseRows.length} строк`, status: zeroBaseRows.length ? 'warning' as const : 'ok' as const, count: zeroBaseRows.length, problemType: 'zeroBase' as ProblemType },
                  { label: 'Кредитные продажи — сверка', detail: `${creditRows.length} строк: техника ${creditTechRows.length}, аксессуары ${creditAccessoryRows.length}, спорные ${creditReviewRows.length}`, status: creditRows.length ? 'warning' as const : 'ok' as const, count: creditRows.length, problemType: 'credit' as ProblemType },
                ].map((item) => {
                  const isClickable = Boolean(item.problemType && item.count > 0);
                  const clickableClass =
                    item.status === 'error'
                      ? 'cursor-pointer border-red-100 bg-red-50/20 hover:border-red-200 hover:bg-red-50/60 hover:shadow-sm'
                      : 'cursor-pointer border-amber-100 bg-amber-50/20 hover:border-amber-200 hover:bg-amber-50/60 hover:shadow-sm';
                  return (
                  <button key={item.label} type='button' disabled={!isClickable} onClick={() => item.problemType && openProblemRows(item.problemType)} className={`flex min-w-0 flex-col gap-2 rounded-lg border px-3 py-2 text-left transition sm:flex-row sm:items-center sm:justify-between ${isClickable ? clickableClass : 'cursor-default border-border bg-white'}`}>
                    <div className='min-w-0'>
                      <p className='text-sm font-semibold text-slate-900'>{item.label}</p>
                      <p className='break-words text-xs text-slate-500'>{item.detail}</p>
                    </div>
                    <span className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${getCheckStatus(item.status)} ${isClickable ? 'ring-1 ring-current/20' : ''}`}>
                      {item.status === 'ok' ? 'OK' : item.status === 'warning' ? 'Проверить' : 'Ошибка'}
                      {isClickable && <ArrowRight className='h-3.5 w-3.5' />}
                    </span>
                  </button>
                )})}
              </div>

            </Card>

            <div>
              <div className='mb-5 flex flex-wrap gap-2'>
                {['Итог ЗП', 'Дни и авансы', 'Опт', 'Розница', 'Проверка', 'Детализация строк', 'Диагностика файла'].map((tab) => (
                  <button
                    key={tab}
                    type='button'
                    onClick={() => setActivePayrollTab(tab)}
                    className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${activePayrollTab === tab ? 'bg-primary text-white shadow-sm' : 'border border-border bg-white text-slate-600 hover:border-primary/40 hover:text-slate-900'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activePayrollTab === 'Итог ЗП' && (
                <div className='grid gap-5'>
                  <div className='grid gap-3 md:grid-cols-4'>
                    {[
                      ['Период', `${months[Number(month)]} ${year}`],
                      ['Всего оплаты по дням', formatMoney(payrollTotals.dayPay)],
                      ['Всего бонусов продаж', formatMoney(payrollTotals.salesBonus)],
                      ['Всего бонусов дисциплины', formatMoney(payrollTotals.disciplineBonus)],
                      ['Всего авансов', formatMoney(payrollTotals.advance)],
                      ['Всего начислено', formatMoney(payrollTotals.grossPay)],
                      ['Всего к выплате', formatMoney(payrollTotals.netPay)],
                      ['Проверить сотрудников', fullPayrollRows.filter((row) => row.payrollStatus === 'Проверить').length],
                    ].map(([label, value]) => (
                      <Card key={label} className='min-w-0 p-4'>
                        <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                        <p className='mt-1 break-words text-xl font-bold text-slate-900'>{value}</p>
                      </Card>
                    ))}
                    <Card className='min-w-0 p-4 md:col-span-2'>
                      <p className='text-xs font-semibold uppercase text-slate-500'>Контроль продаж</p>
                      <p className='mt-1 text-xl font-bold text-slate-900'>{formatMoney(totalBonus)}</p>
                      <div className='mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3'>
                        <span>Опт: {formatMoney(wholesaleTotalBonus)}</span>
                        <span>Розница: {formatMoney(retailTotalBonus)}</span>
                        <span>ВП: {formatMoney(totalGrossProfit)}</span>
                      </div>
                    </Card>
                    <Card className='min-w-0 p-4 md:col-span-2'>
                      <p className='text-xs font-semibold uppercase text-slate-500'>Контроль закупок</p>
                      <p className='mt-1 text-xl font-bold text-slate-900'>{purchasePayrollRow.purchaseBase === null ? 'Отчёт не загружен' : formatMoney(purchasePayrollRow.purchaseBase)}</p>
                      <div className='mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2'>
                        <span>1,75%: {formatMoney(purchasePayrollRow.purchasePercentAmount)}</span>
                        <span>Целевая ЗП: {formatMoney(purchaseTargetSalary)}</span>
                        <span>Ориентир базы: {formatMoney(purchaseTargetBase)}</span>
                        <span>Выполнение: {purchaseCompletionPercent.toFixed(2)}%</span>
                      </div>
                    </Card>
                  </div>

                  <Card>
                    <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                      <h2 className='text-lg font-bold text-slate-900'>Итог по сотрудникам</h2>
                      <div className='flex flex-wrap gap-2'>
                        <button type='button' onClick={exportPayrollWorkbook} className='w-fit rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90'>
                          Скачать ведомость Excel
                        </button>
                        <button type='button' onClick={() => setActivePayrollTab('Дни и авансы')} className='w-fit rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:text-slate-900'>
                          Редактировать дни и авансы
                        </button>
                      </div>
                    </div>
                    <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[780px] text-xs'>
                        <thead className='bg-slate-50 text-left text-slate-500'>
                          <tr>
                            <th className='w-[210px] px-2 py-2'>Сотрудник</th>
                            <th className='w-[80px] px-2 py-2'>Отдел</th>
                            <th className='w-[54px] px-2 py-2 text-right'>Дни</th>
                            <th className='w-[60px] px-2 py-2 text-right'>Опозд.</th>
                            <th className='w-[112px] px-2 py-2 text-right'>Продажи</th>
                            <th className='w-[96px] px-2 py-2 text-right'>Дисц.</th>
                            <th className='w-[96px] px-2 py-2 text-right'>Аванс</th>
                            <th className='w-[112px] px-2 py-2 text-right'>Выплата</th>
                            <th className='w-[92px] px-2 py-2'>Статус</th>
                            <th className='w-[76px] px-2 py-2'></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullPayrollRows.map((summary) => {
                            const statusInfo = getManagerStatus(summary, classification.rows, classification.accessoryExcludedRows);
                            const combinedStatus = statusInfo.status === 'OK' && summary.payrollStatus === 'OK' ? 'OK' : 'Проверить';
                            return (
                              <tr key={summary.manager} className='border-t border-border/70 align-top'>
                                <td className='max-w-[210px] truncate px-2 py-2 font-semibold text-slate-900' title={`${summary.manager} · ${summary.position}`}>
                                  <span className='block truncate'>{summary.manager}</span>
                                  <span className='block truncate text-[11px] font-medium text-slate-500'>{summary.position}</span>
                                </td>
                                <td className='whitespace-nowrap px-2 py-2 text-slate-700'>{summary.payrollDepartment}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.workedDays ?? '—'}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.lateCount ?? '—'}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right font-semibold text-slate-900'>{formatMoney(summary.salesBonus)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.salaryType === 'fixed_salary' || summary.salaryType === 'purchase_manager' ? '—' : formatMoney(summary.disciplineBonus)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{formatMoney(summary.advance)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right font-bold text-slate-900'>{formatMoney(summary.netPay)}</td>
                                <td className='px-2 py-2'>
                                  <Badge className={combinedStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{combinedStatus}</Badge>
                                </td>
                                <td className='px-2 py-2 text-right'>
                                  <button type='button' onClick={() => setSelectedManager(summary.manager)} className='rounded-lg border border-border px-2 py-1 text-xs font-semibold text-slate-700 hover:border-primary/40'>
                                    Открыть
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                </div>
              )}

              {activePayrollTab === 'Дни и авансы' && (
                <Card>
                  <div className='mb-4'>
                    <h2 className='text-lg font-bold text-slate-900'>Дни и авансы</h2>
                    <p className='mt-1 text-sm text-slate-500'>Ручной ввод дней, опозданий, авансов и комментариев по сотрудникам.</p>
                  </div>
                  <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                    <table className='w-full min-w-[1180px] text-sm'>
                      <thead className='bg-slate-50 text-left text-slate-500'>
                        <tr>
                          <th className='px-3 py-3'>Сотрудник</th>
                          <th className='px-3 py-3'>Отдел</th>
                          <th className='px-3 py-3'>Источник</th>
                          <th className='px-3 py-3'>Отработано дней</th>
                          <th className='px-3 py-3 text-right'>Ставка</th>
                          <th className='px-3 py-3 text-right'>Оплата по дням</th>
                          <th className='px-3 py-3'>Опоздания</th>
                          <th className='px-3 py-3 text-right'>Бонус дисциплины</th>
                          <th className='px-3 py-3'>Агентские</th>
                          <th className='px-3 py-3'>Аванс</th>
                          <th className='px-3 py-3'>Комментарий</th>
                        </tr>
                      </thead>
                      <tbody>
                          {salesPayrollRows.map((row) => {
                            const manual = manualPayroll[row.manager] ?? { workedDays: '', lateCount: '', advance: '', comment: '' };
                            const workedDaysValue = manual.workedDays || (row.workedDays === null ? '' : String(row.workedDays));
                            const lateCountValue = manual.lateCount || (row.lateCount === null ? '' : String(row.lateCount));
                            return (
                            <tr key={row.manager} className='border-t border-border/70 align-top'>
                              <td className='px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                              <td className='px-3 py-2'>{row.payrollDepartment}</td>
                              <td className='px-3 py-2 text-slate-700'>{getPayrollDaysSourceLabel(row.daysSource)}</td>
                              <td className='px-3 py-2'><Input type='number' min='0' step='0.5' value={workedDaysValue} onChange={(event) => updateManualPayroll(row.manager, 'workedDays', event.target.value)} className='h-9 w-28' /></td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.dayRate)}</td>
                              <td className='px-3 py-2 text-right font-semibold'>{formatMoney(row.dayPay)}</td>
                              <td className='px-3 py-2'><Input type='number' min='0' step='1' value={lateCountValue} onChange={(event) => updateManualPayroll(row.manager, 'lateCount', event.target.value)} className='h-9 w-28' /></td>
                              <td className='px-3 py-2 text-right font-semibold'>{formatMoney(row.disciplineBonus)}</td>
                              <td className='px-3 py-2'>
                                {row.manager === agentCreditCommissionEmployee ? (
                                  <Input type='number' min='0' step='100' value={manual.agentCreditCommission ?? ''} onChange={(event) => updateManualPayroll(row.manager, 'agentCreditCommission', event.target.value)} className='h-9 w-32' />
                                ) : (
                                  <span className='text-slate-400'>—</span>
                                )}
                              </td>
                              <td className='px-3 py-2'><Input type='number' min='0' step='100' value={manual.advance} onChange={(event) => updateManualPayroll(row.manager, 'advance', event.target.value)} className='h-9 w-32' /></td>
                              <td className='px-3 py-2'><Input value={manual.comment} onChange={(event) => updateManualPayroll(row.manager, 'comment', event.target.value)} placeholder='Комментарий' className='h-9 min-w-[220px]' /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className='mt-5'>
                    <div className='mb-3'>
                      <h3 className='text-base font-bold text-slate-900'>Фиксированная зарплата</h3>
                      <p className='mt-1 text-sm text-slate-500'>Отдельный ручной блок для сотрудников без расчёта по продажам.</p>
                    </div>
                    <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[1180px] text-sm'>
                        <thead className='bg-slate-50 text-left text-slate-500'>
                          <tr>
                            <th className='px-3 py-3'>Сотрудник</th>
                            <th className='px-3 py-3'>Отдел / должность</th>
                            <th className='px-3 py-3 text-right'>Оклад</th>
                            <th className='px-3 py-3'>Премия</th>
                            <th className='px-3 py-3'>Аванс</th>
                            <th className='px-3 py-3'>Удержание</th>
                            <th className='px-3 py-3 text-right'>К выплате</th>
                            <th className='px-3 py-3'>Комментарий</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fixedPayrollRows.map((row) => {
                            const manual = fixedPayroll[row.manager] ?? { bonus: '', advance: '', deduction: '', comment: '' };
                            return (
                              <tr key={row.manager} className='border-t border-border/70 align-top'>
                                <td className='px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                                <td className='px-3 py-2 text-slate-700'>
                                  <span className='block font-semibold'>{row.payrollDepartment}</span>
                                  <span className='text-xs text-slate-500'>{row.position}</span>
                                </td>
                                <td className='px-3 py-2 text-right font-semibold'>{formatMoney(row.fixedSalary)}</td>
                                <td className='px-3 py-2'><Input type='number' min='0' step='100' value={manual.bonus} onChange={(event) => updateFixedPayroll(row.manager, 'bonus', event.target.value)} className='h-9 w-32' /></td>
                                <td className='px-3 py-2'><Input type='number' min='0' step='100' value={manual.advance} onChange={(event) => updateFixedPayroll(row.manager, 'advance', event.target.value)} className='h-9 w-32' /></td>
                                <td className='px-3 py-2'><Input type='number' min='0' step='100' value={manual.deduction} onChange={(event) => updateFixedPayroll(row.manager, 'deduction', event.target.value)} className='h-9 w-32' /></td>
                                <td className='px-3 py-2 text-right font-bold'>{formatMoney(row.netPay)}</td>
                                <td className='px-3 py-2'><Input value={manual.comment} onChange={(event) => updateFixedPayroll(row.manager, 'comment', event.target.value)} placeholder='Комментарий' className='h-9 min-w-[220px]' /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className='mt-5'>
                    <div className='mb-3'>
                      <h3 className='text-base font-bold text-slate-900'>Закупщик</h3>
                      <p className='mt-1 text-sm text-slate-500'>Расчёт по отчёту закупок 1С: дни фиксированы, аванс и удержание заполняются вручную.</p>
                    </div>
                    <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[1180px] text-sm'>
                        <thead className='bg-slate-50 text-left text-slate-500'>
                          <tr>
                            <th className='px-3 py-3'>Сотрудник</th>
                            <th className='px-3 py-3'>Отдел / должность</th>
                            <th className='px-3 py-3 text-right'>Дни</th>
                            <th className='px-3 py-3 text-right'>Ставка</th>
                            <th className='px-3 py-3 text-right'>База закупок</th>
                            <th className='px-3 py-3 text-right'>1,75%</th>
                            <th className='px-3 py-3 text-right'>Доведение</th>
                            <th className='px-3 py-3'>Аванс</th>
                            <th className='px-3 py-3'>Удержание</th>
                            <th className='px-3 py-3 text-right'>К выплате</th>
                            <th className='px-3 py-3'>Комментарий</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className='border-t border-border/70 align-top'>
                            <td className='px-3 py-2 font-semibold text-slate-900'>{purchasePayrollRow.manager}</td>
                            <td className='px-3 py-2 text-slate-700'>
                              <span className='block font-semibold'>{purchasePayrollRow.payrollDepartment}</span>
                              <span className='text-xs text-slate-500'>{purchasePayrollRow.position}</span>
                            </td>
                            <td className='px-3 py-2 text-right'>{purchasePayrollRow.workedDays}</td>
                            <td className='px-3 py-2 text-right'>{formatMoney(purchasePayrollRow.dayRate)}</td>
                            <td className='px-3 py-2 text-right'>{purchasePayrollRow.purchaseBase === null ? '—' : formatMoney(purchasePayrollRow.purchaseBase)}</td>
                            <td className='px-3 py-2 text-right'>{formatMoney(purchasePayrollRow.purchasePercentAmount)}</td>
                            <td className='px-3 py-2 text-right'>{formatMoney(purchasePayrollRow.purchaseTargetAdjustment)}</td>
                            <td className='px-3 py-2'><Input type='number' min='0' step='100' value={purchasePayroll.advance} onChange={(event) => updatePurchasePayroll('advance', event.target.value)} className='h-9 w-32' /></td>
                            <td className='px-3 py-2'><Input type='number' min='0' step='100' value={purchasePayroll.deduction} onChange={(event) => updatePurchasePayroll('deduction', event.target.value)} className='h-9 w-32' /></td>
                            <td className='px-3 py-2 text-right font-bold'>{formatMoney(purchasePayrollRow.netPay)}</td>
                            <td className='px-3 py-2'><Input value={purchasePayroll.comment} onChange={(event) => updatePurchasePayroll('comment', event.target.value)} placeholder='Комментарий' className='h-9 min-w-[220px]' /></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className='mt-5'>
                    <div className='mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                      <div>
                        <h3 className='text-base font-bold text-slate-900'>Сопоставление с посещаемостью</h3>
                        <p className='mt-1 text-sm text-slate-500'>Ручная карта имён для будущей автоподстановки дней. Дни и опоздания пока заполняются вручную.</p>
                      </div>
                      <button
                        type='button'
                        onClick={loadAttendancePreview}
                        disabled={isAttendancePreviewLoading}
                        className='inline-flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        <Eye className='h-4 w-4' />
                        {isAttendancePreviewLoading ? 'Загрузка...' : 'Предпросмотр дней из посещаемости'}
                      </button>
                    </div>
                    <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[760px] text-sm'>
                        <thead className='bg-slate-50 text-left text-slate-500'>
                          <tr>
                            <th className='px-3 py-3'>Сотрудник в ЗП</th>
                            <th className='px-3 py-3'>Источник</th>
                            <th className='px-3 py-3'>Имя/варианты имени в посещаемости</th>
                            <th className='px-3 py-3'>Статус</th>
                            <th className='px-3 py-3'>Комментарий</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollAttendanceMappingRows.map((row) => (
                            <tr key={row.manager} className='border-t border-border/70'>
                              <td className='px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                              <td className='px-3 py-2 text-slate-700'>{row.source}</td>
                              <td className='px-3 py-2 text-slate-700'>{row.attendanceNames.join(', ') || '—'}</td>
                              <td className='px-3 py-2'>
                                <Badge className={row.status === 'задано' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                                  {row.status}
                                </Badge>
                              </td>
                              <td className='px-3 py-2 text-slate-600'>{row.comment}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {attendancePreviewError && <p className='mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700'>{attendancePreviewError}</p>}
                    {attendancePreview && (
                      <div className='mt-4'>
                        <div className='mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                          <div className='flex flex-wrap gap-2'>
                            <Badge className={attendancePreview.attendanceMode === 'google-sheets' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
                              Посещаемость: {attendancePreview.attendanceMode}
                            </Badge>
                            <Badge className={attendancePreview.scheduleMode === 'google-sheets' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
                              График: {attendancePreview.scheduleMode}
                            </Badge>
                          </div>
                          <button
                            type='button'
                            onClick={applyAttendancePreviewDays}
                            className='w-fit rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90'
                          >
                            Применить найденные дни
                          </button>
                        </div>
                        {attendanceApplyResult && (
                          <div className='mb-3 grid gap-3'>
                            <div className='grid gap-2 text-sm sm:grid-cols-4'>
                              <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                                <p className='text-xs font-semibold uppercase text-slate-500'>Применено полностью</p>
                                <p className='font-bold text-slate-900'>{attendanceApplyResult.fullApplied}</p>
                              </div>
                              <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                                <p className='text-xs font-semibold uppercase text-slate-500'>Только дни</p>
                                <p className='font-bold text-slate-900'>{attendanceApplyResult.daysOnlyApplied}</p>
                              </div>
                              <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                                <p className='text-xs font-semibold uppercase text-slate-500'>Пропущено</p>
                                <p className='font-bold text-slate-900'>{attendanceApplyResult.skipped}</p>
                              </div>
                              <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                                <p className='text-xs font-semibold uppercase text-slate-500'>Ручных полей сохранено</p>
                                <p className='font-bold text-slate-900'>{attendanceApplyResult.preservedManualFields}</p>
                              </div>
                            </div>
                            <div className='overflow-x-auto rounded-lg border border-border'>
                              <table className='w-full min-w-[720px] text-xs'>
                                <thead className='bg-slate-50 text-left text-slate-500'>
                                  <tr>
                                    <th className='px-3 py-2'>Сотрудник</th>
                                    <th className='px-3 py-2'>sourceType</th>
                                    <th className='px-3 py-2 text-right'>appliedWorkedDays</th>
                                    <th className='px-3 py-2'>Поле-источник дней</th>
                                    <th className='px-3 py-2 text-right'>appliedLateCount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attendanceApplyResult.rows.map((row) => (
                                    <tr key={`${row.manager}-${row.daySourceField}`} className='border-t border-border/70'>
                                      <td className='px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                                      <td className='px-3 py-2'>{row.sourceType}</td>
                                      <td className='px-3 py-2 text-right'>{row.appliedWorkedDays ?? '—'}</td>
                                      <td className='px-3 py-2'>{row.daySourceField}</td>
                                      <td className='px-3 py-2 text-right'>{row.appliedLateCount ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                          <table className='w-full min-w-[820px] text-sm'>
                            <thead className='bg-slate-50 text-left text-slate-500'>
                              <tr>
                                <th className='px-3 py-3'>Сотрудник в ЗП</th>
                                <th className='px-3 py-3'>Источник</th>
                                <th className='px-3 py-3'>Имя/варианты имени в источнике</th>
                                <th className='px-3 py-3 text-right'>Строк формы за период</th>
                                <th className='px-3 py-3 text-right'>Уникальных дат формы</th>
                                <th className='px-3 py-3 text-right'>Дней по графику</th>
                                <th className='px-3 py-3 text-right'>Отработано дней для предпросмотра</th>
                                <th className='px-3 py-3 text-right'>Дней к подстановке</th>
                                <th className='px-3 py-3 text-right'>Опозданий для предпросмотра</th>
                                <th className='px-3 py-3'>Статус</th>
                                <th className='px-3 py-3'>Комментарий</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payrollAttendancePreviewRows.map((row) => (
                                <tr key={row.manager} className='border-t border-border/70'>
                                  <td className='px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                                  <td className='px-3 py-2 text-slate-700'>{row.source}</td>
                                  <td className='px-3 py-2 text-slate-700'>
                                    <span className='font-semibold text-slate-900'>{row.matchedNames}</span>
                                    <span className='mt-1 block text-xs text-slate-500'>карта: {row.sourceNames}</span>
                                  </td>
                                  <td className='px-3 py-2 text-right text-slate-700'>{row.formRows}</td>
                                  <td className='px-3 py-2 text-right text-slate-700'>{row.uniqueFormDates}</td>
                                  <td className='px-3 py-2 text-right text-slate-700'>{row.scheduleDays}</td>
                                  <td className='px-3 py-2 text-right text-slate-700'>{row.workedDays ?? '—'}</td>
                                  <td className='px-3 py-2 text-right font-semibold text-slate-900'>
                                    {row.daysToApply ?? '—'}
                                    <span className='block text-xs font-medium text-slate-500'>{row.daySourceField}</span>
                                  </td>
                                  <td className='px-3 py-2 text-right text-slate-700'>{row.lateCount ?? '—'}</td>
                                  <td className='px-3 py-2'>
                                    <Badge className={row.status === 'найдено по форме' ? 'bg-green-100 text-green-800' : row.status === 'не найден' ? 'bg-red-100 text-red-700' : row.status === 'исключена из автоподстановки' || row.status === 'ручной ввод / отдельная схема позже' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'}>
                                      {row.status}
                                    </Badge>
                                  </td>
                                  <td className='px-3 py-2 text-slate-600'>{row.comment}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {activePayrollTab === 'Опт' && (
                <div className='grid gap-5'>
                  <div className='grid gap-3 md:grid-cols-4'>
                    {[
                      ['Выручка Залины', formatMoney(classification.wholesale.zalinaRevenue)],
                      ['Выручка Лианы', formatMoney(classification.wholesale.lianaRevenue)],
                      ['Опт до исключений', formatMoney(classification.wholesale.totalRevenue)],
                      ['Исключённая техника', formatMoney(classification.wholesale.excludedTechRevenue)],
                      ['База после исключений', formatMoney(classification.wholesale.base)],
                      ['Бонус 1,75%', formatMoney(classification.wholesale.bonusEach)],
                      ['Бонус Залины', formatMoney(classification.wholesale.bonusEach)],
                      ['Бонус Лианы', formatMoney(classification.wholesale.bonusEach)],
                      ['Спорные строки опта', wholesaleReviewRows.length],
                      ['Ошибочно исключённые аксессуары', classification.accessoryExcludedRows.length],
                    ].map(([label, value]) => (
                      <Card key={label} className='p-4'>
                        <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                        <p className='mt-1 text-xl font-bold text-slate-900'>{value}</p>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <h2 className='mb-4 text-lg font-bold text-slate-900'>Опт по категориям</h2>
                    <div className='max-h-[520px] overflow-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[900px] text-sm'>
                        <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'>
                          <tr><th className='px-3 py-3'>Категория</th><th className='px-3 py-3 text-right'>Строк</th><th className='px-3 py-3 text-right'>Выручка</th><th className='px-3 py-3 text-right'>ВП</th><th className='px-3 py-3'>Входит в базу</th><th className='px-3 py-3'>Статус</th><th className='px-3 py-3'></th></tr>
                        </thead>
                        <tbody>
                          {wholesaleCategorySummaries.map((row) => (
                            <tr key={row.category} className='border-t border-border/70'>
                              <td className='px-3 py-2 font-semibold text-slate-900'>{row.category}</td>
                              <td className='px-3 py-2 text-right'>{row.rows}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td>
                              <td className='px-3 py-2'>{row.includedInWholesaleBase ? 'да' : 'нет'}</td>
                              <td className='px-3 py-2'><Badge className={row.status.includes('спорная') ? 'bg-amber-100 text-amber-800' : row.status.includes('исключено') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-800'}>{row.status}</Badge></td>
                              <td className='px-3 py-2'><button type='button' onClick={() => { setCategoryFilter(row.category); setDepartmentFilter('Опт'); setActivePayrollTab('Детализация строк'); }} className='rounded-lg border border-border px-2 py-1 text-xs font-semibold'>Показать строки</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

              {activePayrollTab === 'Розница' && (
                <div className='grid gap-5'>
                  <div className='grid gap-3 md:grid-cols-6'>
                    {[
                      ['Техника 10%', `${retailTechSummary.rows} / ${formatMoney(retailTechSummary.base)} / ${formatMoney(retailTechSummary.bonus)}`],
                      ['Аксессуары 5%', `${retailAccessorySummary.rows} / ${formatMoney(retailAccessorySummary.base)} / ${formatMoney(retailAccessorySummary.bonus)}`],
                      ['Услуги 50%', `${retailFilmSummary.rows} / ${formatMoney(retailFilmSummary.base)} / ${formatMoney(retailFilmSummary.bonus)}`],
                      ['Плоттер 50% с/с', `${retailPlotterSummary.rows} / ${formatMoney(retailPlotterSummary.base)} / ${formatMoney(retailPlotterSummary.bonus)}`],
                      ['Кредиты', `${creditRows.length} строк · техника ${creditTechRows.length} / аксессуары ${creditAccessoryRows.length} / спорные ${creditReviewRows.length} · бонус ${formatMoney(retailCreditSummary.bonus)}`],
                      ['Спорная розница', `${retailReviewSummary.rows} / ${formatMoney(retailReviewSummary.revenue)}`],
                    ].map(([label, value]) => <Card key={label} className='p-4'><p className='text-xs font-semibold uppercase text-slate-500'>{label}</p><p className='mt-1 text-sm font-bold text-slate-900'>{value}</p></Card>)}
                  </div>
                  <Card>
                    <h2 className='mb-4 text-lg font-bold text-slate-900'>Розничные менеджеры</h2>
                    <div className='max-h-[520px] overflow-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[980px] text-sm'>
                        <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-3'>Менеджер</th><th className='px-3 py-3 text-right'>Выручка</th><th className='px-3 py-3 text-right'>ВП</th><th className='px-3 py-3 text-right'>Кредит</th><th className='px-3 py-3 text-right'>Услуги</th><th className='px-3 py-3 text-right'>Плоттер</th><th className='px-3 py-3 text-right'>Техника</th><th className='px-3 py-3 text-right'>Аксессуары</th><th className='px-3 py-3 text-right'>Итого</th><th className='px-3 py-3 text-right'>Спорные</th></tr></thead>
                        <tbody>
                          {classification.managerSummaries.filter((row) => row.department === 'Розница').map((row) => (
                            <tr key={row.manager} className='border-t border-border/70'><td className='px-3 py-2 font-semibold'>{row.manager}</td><td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.creditBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.filmBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.plotterBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.techBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.accessoryBonus)}</td><td className='px-3 py-2 text-right font-bold'>{formatMoney(row.totalBonus)}</td><td className='px-3 py-2 text-right'>{retailReviewRows.filter((item) => item.manager === row.manager).length}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              )}

              {activePayrollTab === 'Проверка' && (
                <Card>
                  <div className='mb-4 flex flex-col gap-1 md:flex-row md:items-end md:justify-between'>
                    <div>
                      <h2 className='text-lg font-bold text-slate-900'>Проверка</h2>
                      <p className='text-sm text-slate-500'>Проблемные строки после текущих фильтров: {problemRows.length}</p>
                    </div>
                  </div>
                  <div className='mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7'>
                    <select value={problemTypeFilter} onChange={(event) => setProblemTypeFilter(event.target.value as ProblemType)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'>
                      <option value='all'>Все проблемы</option>
                      <option value='credit'>Кредитные продажи — сверка</option>
                      <option value='wholesaleReview'>Спорная техника опта</option>
                      <option value='retailReview'>Спорная техника розницы</option>
                      <option value='expensiveUnclassified'>Новые дорогие товары / требуют классификации</option>
                      <option value='negative'>Отрицательная ВП</option>
                      <option value='zeroBase'>Подозрительная нулевая база</option>
                      <option value='unclassified'>Без классификации</option>
                      <option value='accessoryExcluded'>Ошибочно исключённые аксессуары</option>
                      <option value='invalidNumbers'>NaN/undefined</option>
                      <option value='disputed'>Спорные товары</option>
                      <option value='disciplineBonusRemoved'>Бонус дисциплины снят из-за опозданий</option>
                    </select>
                    <select value={problemManagerFilter} onChange={(event) => setProblemManagerFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все сотрудники</option>{managerOptions.map((manager) => <option key={manager} value={manager}>{manager}</option>)}</select>
                    <select value={problemDepartmentFilter} onChange={(event) => setProblemDepartmentFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все отделы</option><option value='Опт'>Опт</option><option value='Розница'>Розница</option></select>
                    <select value={problemCategoryFilter} onChange={(event) => setProblemCategoryFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все категории</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                    <select value={problemClientFilter} onChange={(event) => setProblemClientFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все клиенты</option>{clientOptions.map((client) => <option key={client} value={client}>{client}</option>)}</select>
                    <Input value={problemSearch} onChange={(event) => setProblemSearch(event.target.value)} placeholder='Поиск по товару' />
                    <Input value={problemArticleSearch} onChange={(event) => setProblemArticleSearch(event.target.value)} placeholder='Поиск по артикулу' />
                  </div>
                  <div className='max-h-[560px] overflow-auto rounded-lg border border-border'>
                    <table className='w-full min-w-[1500px] text-xs'>
                      <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Тип проблемы</th><th className='px-3 py-2'>Сотрудник</th><th className='px-3 py-2'>Отдел</th><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Регистратор</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>Валовая прибыль</th><th className='px-3 py-2 text-right'>База расчёта</th><th className='px-3 py-2'>Тип расчёта</th><th className='px-3 py-2'>Причина</th><th className='px-3 py-2'>Правило</th></tr></thead>
                      <tbody>{problemRows.slice(0, 500).map((problem, index) => {
                        const isErrorProblem = problem.type === 'unclassified' || problem.type === 'accessoryExcluded' || problem.type === 'invalidNumbers';
                        if (problem.kind === 'sales') {
                          const row = problem.row;
                          return (
                            <tr key={`${problem.type}-${row.manager}-${row.item}-${index}`} className='border-t border-border/70'>
                              <td className='px-3 py-2'><Badge className={isErrorProblem ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}>{problem.label}</Badge></td>
                              <td className='px-3 py-2'>{row.manager}</td>
                              <td className='px-3 py-2'>{row.department}</td>
                              <td className='px-3 py-2'>{row.client}</td>
                              <td className='px-3 py-2'>{row.category}</td>
                              <td className='max-w-[360px] truncate px-3 py-2' title={row.item}>{row.item}</td>
                              <td className='max-w-[320px] truncate px-3 py-2' title={getRegistrarSummary(row)}>{getRegistrarSummary(row) || '—'}</td>
                              <td className='px-3 py-2'>{row.article || '—'}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.base)}</td>
                              <td className='px-3 py-2'>{row.calculationLabel}</td>
                              <td className='px-3 py-2'>{getSalesProblemReason(row, problem.type)}</td>
                              <td className='px-3 py-2'>{row.matchedRule}</td>
                            </tr>
                          );
                        }

                        const row = problem.row;
                        return (
                          <tr key={`${problem.type}-${row.manager}-${index}`} className='border-t border-border/70'>
                            <td className='px-3 py-2'><Badge className={isErrorProblem ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}>{problem.label}</Badge></td>
                            <td className='px-3 py-2'>{row.manager}</td>
                            <td className='px-3 py-2'>{row.department}</td>
                            <td className='px-3 py-2'>—</td>
                            <td className='px-3 py-2'>—</td>
                            <td className='max-w-[360px] truncate px-3 py-2' title={row.comment}>{row.comment || '—'}</td>
                            <td className='px-3 py-2'>—</td>
                            <td className='px-3 py-2'>—</td>
                            <td className='px-3 py-2 text-right'>—</td>
                            <td className='px-3 py-2 text-right'>—</td>
                            <td className='px-3 py-2 text-right'>{`${row.workedDays ?? '—'} дн. / ${row.lateCount ?? '—'} опозд.`}</td>
                            <td className='px-3 py-2'>Зарплата</td>
                            <td className='px-3 py-2'>{row.payrollReasons.join(', ') || 'Бонус дисциплины снят: опозданий больше 3'}</td>
                            <td className='px-3 py-2'>Ручной ввод</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </Card>
              )}

              {activePayrollTab === 'Детализация строк' && (
                <Card>
                  <h2 className='mb-4 text-lg font-bold text-slate-900'>Строки продаж с классификацией</h2>
                  <div className='mb-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8'>
                    <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все отделы</option><option value='Опт'>Опт</option><option value='Розница'>Розница</option></select>
                    <select value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все менеджеры</option>{managerOptions.map((manager) => <option key={manager} value={manager}>{manager}</option>)}</select>
                    <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все клиенты</option>{clientOptions.map((client) => <option key={client} value={client}>{client}</option>)}</select>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все категории</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все типы</option>{typeOptions.map((type) => <option key={type} value={type}>{calculationLabels[type]}</option>)}</select>
                    <select value={specialFilter} onChange={(event) => setSpecialFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm'><option value='all'>Все проверки</option><option value='excluded-wholesale'>Исключены из опта</option><option value='review-tech'>Спорные</option><option value='phones'>Телефоны</option><option value='electronics-watch'>Электроника/часы</option></select>
                    <Input value={detailSearch} onChange={(event) => setDetailSearch(event.target.value)} placeholder='Номенклатура' />
                    <Input value={articleSearch} onChange={(event) => setArticleSearch(event.target.value)} placeholder='Артикул' />
                  </div>
                  <div className='max-h-[620px] overflow-auto rounded-lg border border-border'>
                    <table className='w-full min-w-[1500px] text-xs'>
                      <thead className='sticky top-0 z-20 bg-slate-50 text-left text-slate-500'><tr><th className='sticky left-0 z-30 bg-slate-50 px-3 py-2'>Менеджер</th><th className='sticky left-[150px] z-30 bg-slate-50 px-3 py-2'>Категория</th><th className='sticky left-[330px] z-30 bg-slate-50 px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>ВП</th><th className='px-3 py-2'>Тип</th><th className='px-3 py-2'>В базе опта</th><th className='px-3 py-2 text-right'>База</th><th className='px-3 py-2'>Процент</th><th className='px-3 py-2 text-right'>Бонус</th><th className='px-3 py-2'>Формула</th><th className='px-3 py-2'>Причина</th><th className='px-3 py-2'>Правило</th></tr></thead>
                      <tbody>{filteredClassifiedRows.map((row, index) => <tr key={`${row.item}-${index}`} className='border-t border-border/70'><td className='sticky left-0 bg-white px-3 py-2 font-semibold'>{row.manager}</td><td className='sticky left-[150px] max-w-[180px] truncate bg-white px-3 py-2' title={row.category}>{row.category}</td><td className='sticky left-[330px] max-w-[280px] truncate bg-white px-3 py-2' title={row.item}>{row.item}</td><td className='px-3 py-2'>{row.client}</td><td className='px-3 py-2'>{row.article || '—'}</td><td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td><td className='px-3 py-2'>{row.calculationLabel}</td><td className='px-3 py-2'>{row.includedInWholesaleBase === null ? '—' : row.includedInWholesaleBase ? 'да' : 'нет'}</td><td className='px-3 py-2 text-right'>{formatMoney(row.base)}</td><td className='px-3 py-2'>{formatPercentRate(row.percent)}</td><td className='px-3 py-2 text-right font-semibold'>{formatMoney(row.bonus)}</td><td className='px-3 py-2'>{row.formula}</td><td className='px-3 py-2'>{row.classificationReason}</td><td className='px-3 py-2'>{row.matchedRule}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Card>
              )}

              {activePayrollTab === 'Диагностика файла' && (
                <Card>
                  <h2 className='mb-4 text-lg font-bold text-slate-900'>Диагностика файла</h2>
                  <div className='mb-4 flex flex-wrap gap-2'>
                    <Badge className='bg-slate-100 text-slate-700'>Шапка: строка {rows[parseResult.headerIndex]?.excelRow ?? '—'}</Badge>
                    <Badge className='bg-slate-100 text-slate-700'>Стратегия: {parseResult.strategy}</Badge>
                    {parseResult.isRegistrarReport && (
                      <Badge className={!registrarParseUnsafe ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-700'}>
                        {!registrarParseUnsafe ? 'Регистратор распознан стабильно' : 'Регистратор: только диагностика'}
                      </Badge>
                    )}
                    {parseResult.isRegistrarReport && (
                      <Badge className='bg-slate-100 text-slate-700'>Детальные строки: {parseResult.detailRowCount} · после агрегации: {parseResult.rows.length}</Badge>
                    )}
                    {parseResult.columns.map((column) => <Badge key={column} className='bg-slate-100 text-slate-700'>{column}</Badge>)}
                  </div>
                  <div className='mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                    {parseResult.levelSummaries.map((summary) => (
                      <div key={summary.level} className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                        <div className='mb-2 flex items-center justify-between gap-3'>
                          <p className='text-sm font-bold text-slate-900'>{summary.level}</p>
                          <Badge className='bg-white text-slate-700'>{summary.count}</Badge>
                        </div>
                        <p className='line-clamp-4 text-xs text-slate-600' title={summary.examples.join(' · ')}>
                          {summary.examples.length ? summary.examples.join(' · ') : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className='max-h-[620px] overflow-auto rounded-lg border border-border'>
                    <table className='w-full min-w-[1100px] text-xs'>
                      <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Строка</th><th className='px-3 py-2'>Значение</th><th className='px-3 py-2'>outlineLevel</th><th className='px-3 py-2'>Уровень</th><th className='px-3 py-2'>currentManager</th><th className='px-3 py-2'>currentClient</th><th className='px-3 py-2'>currentRegistrar</th><th className='px-3 py-2'>currentCategory</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>ВП</th></tr></thead>
                      <tbody>{parseResult.diagnostics.slice(0, 500).map((row, index) => <tr key={`${row.excelRow}-${index}`} className='border-t border-border/70'><td className='px-3 py-2'>#{row.excelRow}</td><td className='max-w-[320px] truncate px-3 py-2' title={row.text}>{row.text}</td><td className='px-3 py-2'>{row.outlineLevel ?? '—'}</td><td className='px-3 py-2'>{row.detectedLevel}</td><td className='px-3 py-2'>{row.currentManager || '—'}</td><td className='px-3 py-2'>{row.currentClient || '—'}</td><td className='max-w-[240px] truncate px-3 py-2' title={row.currentRegistrar}>{row.currentRegistrar || '—'}</td><td className='px-3 py-2'>{row.currentCategory || '—'}</td><td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            {selectedManagerStatus && selectedManagerPayroll && (
              <div className='fixed inset-0 z-50 flex justify-end bg-slate-950/45'>
                <aside className='h-full w-full overflow-y-auto bg-white p-5 shadow-2xl md:w-[62vw] xl:w-[58vw]'>
                  <div className='mb-5 flex items-start justify-between gap-4 border-b border-border pb-4'>
                    <div className='min-w-0'>
                      <h2 className='truncate text-2xl font-bold text-slate-900'>{selectedManagerPayroll.manager}</h2>
                      <p className='mt-1 text-sm text-slate-500'>{months[Number(month)]} {year} · {selectedManagerPayroll.payrollDepartment} · {selectedManagerPayroll.position}</p>
                      <div className='mt-3 flex flex-wrap items-center gap-2'>
                        <Badge className={selectedManagerStatus.status === 'OK' && selectedManagerPayroll.payrollStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                          {selectedManagerStatus.status === 'OK' && selectedManagerPayroll.payrollStatus === 'OK' ? 'OK' : 'Проверить'}
                        </Badge>
                      </div>
                      <div className='mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700'>
                        <p className='font-semibold text-slate-900'>Требует проверки</p>
                        {selectedManagerStatus.reason === 'замечаний нет' && selectedManagerPayroll.payrollReasons.length === 0 ? (
                          <p className='mt-1'>Замечаний нет</p>
                        ) : (
                          <ul className='mt-1 grid gap-1'>
                            {selectedManagerCounts.disputed > 0 && <li>Спорная техника: {selectedManagerCounts.disputed} строк</li>}
                            {selectedManagerCounts.negative > 0 && <li>Отрицательная ВП: {selectedManagerCounts.negative} строк</li>}
                            {selectedManagerCounts.zeroBase > 0 && <li>Подозрительная нулевая база: {selectedManagerCounts.zeroBase} строк</li>}
                            {selectedManagerCounts.credits > 0 && <li>Кредиты: {selectedManagerCounts.credits} строк</li>}
                            {selectedManagerCounts.unclassified > 0 && <li>Строки без классификации: {selectedManagerCounts.unclassified}</li>}
                            {selectedManagerCounts.accessoryExcluded > 0 && <li>Ошибочно исключённые аксессуары: {selectedManagerCounts.accessoryExcluded}</li>}
                            {selectedManagerCounts.invalidNumbers > 0 && <li>NaN/undefined в расчётах: {selectedManagerCounts.invalidNumbers}</li>}
                            {selectedManagerPayroll.payrollReasons.map((reason) => <li key={reason}>{reason}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className='shrink-0 text-right'>
                      <p className='text-xs font-semibold uppercase text-slate-500'>К выплате</p>
                      <p className='text-xl font-bold text-slate-900'>{formatMoney(selectedManagerPayroll.netPay)}</p>
                      <button type='button' onClick={() => setSelectedManager(null)} className='mt-3 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 hover:border-primary/40'>
                        Закрыть
                      </button>
                    </div>
                  </div>

                  <div className='grid gap-5'>
                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Начисления</h3>
                      <div className='grid gap-3 sm:grid-cols-3'>
                        {(selectedManagerPayroll.salaryType === 'purchase_manager'
                          ? [
                              ['Отдел', selectedManagerPayroll.payrollDepartment],
                              ['Должность', selectedManagerPayroll.position],
                              ['Тип расчёта', getSalaryTypeLabel(selectedManagerPayroll.salaryType)],
                              ['Стандарт дней', purchaseStandardWorkedDays],
                              ['Ставка за выход', formatMoney(selectedManagerPayroll.dayRate)],
                              ['Оплата по дням', formatMoney(selectedManagerPayroll.dayPay)],
                              ['База закупок', selectedManagerPayroll.purchaseBase === null ? '—' : formatMoney(selectedManagerPayroll.purchaseBase)],
                              ['Процент закупок', '1,75%'],
                              ['Расчёт по закупкам', formatMoney(selectedManagerPayroll.purchasePercentAmount)],
                              ['Доведение до целевой ЗП', formatMoney(selectedManagerPayroll.purchaseTargetAdjustment)],
                              ['Целевая ЗП', formatMoney(selectedManagerPayroll.purchaseTargetSalary)],
                              ['Аванс', formatMoney(selectedManagerPayroll.advance)],
                              ['Удержание', formatMoney(selectedManagerPayroll.fixedDeduction)],
                              ['Формула', getSalaryFormulaLabel(selectedManagerPayroll.salaryType)],
                              ['К выплате', formatMoney(selectedManagerPayroll.netPay)],
                            ]
                          : selectedManagerPayroll.salaryType === 'fixed_salary'
                          ? [
                              ['Отдел', selectedManagerPayroll.payrollDepartment],
                              ['Должность', selectedManagerPayroll.position],
                              ['Тип расчёта', getSalaryTypeLabel(selectedManagerPayroll.salaryType)],
                              ['Оклад', formatMoney(selectedManagerPayroll.fixedSalary)],
                              ['Премия', formatMoney(selectedManagerPayroll.fixedBonus)],
                              ['Аванс', formatMoney(selectedManagerPayroll.advance)],
                              ['Удержание', formatMoney(selectedManagerPayroll.fixedDeduction)],
                              ['Формула', getSalaryFormulaLabel(selectedManagerPayroll.salaryType)],
                              ['К выплате', formatMoney(selectedManagerPayroll.netPay)],
                            ]
                          : [
                              ['Отдел', selectedManagerPayroll.payrollDepartment],
                              ['Должность', selectedManagerPayroll.position],
                              ['Тип расчёта', getSalaryTypeLabel(selectedManagerPayroll.salaryType)],
                              ['Формула расчёта', getSalaryFormulaLabel(selectedManagerPayroll.salaryType)],
                              ['Ставка', formatMoney(selectedManagerPayroll.dayRate)],
                              ['Источник дней', getPayrollDaysSourceLabel(selectedManagerPayroll.daysSource)],
                              ['Дни', selectedManagerPayroll.workedDays ?? '—'],
                              ['Опоздания', selectedManagerPayroll.lateCount ?? '—'],
                              ['Имя в посещаемости', selectedManagerAttendanceNames.join(', ') || '—'],
                              ['Правило зарплаты', selectedManagerPayroll.salaryRule === 'belaPercent' ? '12% от итого начислено выбранных сотрудников' : selectedManagerPayroll.salaryRule === 'noDayPay' ? 'Без оплаты выходов по дням' : 'Стандарт'],
                              ['Оплата по дням', formatMoney(selectedManagerPayroll.dayPay)],
                              ['Бонус продаж', formatMoney(selectedManagerPayroll.salesBonus)],
                              ...(selectedManagerPayroll.agentCreditCommission > 0 ? [['Агентские по кредитам', formatMoney(selectedManagerPayroll.agentCreditCommission)]] : []),
                              ['Бонус дисциплины', formatMoney(selectedManagerPayroll.disciplineBonus)],
                              ['Всего начислено', formatMoney(selectedManagerPayroll.grossPay)],
                            ]).map(([label, value]) => (
                          <div key={label} className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                            <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                            <p className='font-bold text-slate-900'>{value}</p>
                          </div>
                        ))}
                      </div>
                      {(selectedManagerPayroll.lateCount ?? 0) > 3 && <p className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800'>Бонус дисциплины снят: опозданий больше 3</p>}
                    </Card>

                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Удержания</h3>
                      <div className='grid gap-3 sm:grid-cols-2'>
                        {[
                          ['Аванс', formatMoney(selectedManagerPayroll.advance)],
                          ['Удержание', selectedManagerPayroll.salaryType === 'fixed_salary' ? formatMoney(selectedManagerPayroll.fixedDeduction) : '—'],
                          ['Всего удержано', formatMoney(selectedManagerPayroll.advance + selectedManagerPayroll.fixedDeduction)],
                        ].map(([label, value]) => (
                          <div key={label} className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                            <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                            <p className='font-bold text-slate-900'>{value}</p>
                          </div>
                        ))}
                      </div>
                      {selectedManagerPayroll.comment && <p className='mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600'>{selectedManagerPayroll.comment}</p>}
                    </Card>

                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Итог</h3>
                      <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                        <p className='text-xs font-semibold uppercase text-slate-500'>К выплате</p>
                        <p className='text-xl font-bold text-slate-900'>{formatMoney(selectedManagerPayroll.netPay)}</p>
                      </div>
                    </Card>

                    {selectedManagerPayroll.salaryType !== 'fixed_salary' && selectedManagerSummary && (
                      <>
                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Структура бонусов</h3>
                      <p className='mb-3 text-sm text-slate-600'>
                        {selectedManagerSummary.department === 'Опт'
                          ? 'Схема расчёта: Опт — 1,75% от общей базы опта. Залина и Лиана получают каждая полный бонус, бонус не делится пополам.'
                          : 'Схема расчёта: Розница — услуги оказываемые 50%, плоттерные материалы Асада 50% от с/с, техника 10% от ВП, аксессуары 5%, кредитный бонус.'}
                      </p>
                      <div className='overflow-x-auto rounded-lg border border-border'>
                        <table className='w-full min-w-[620px] text-sm'>
                          <thead className='bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-3'>Компонент</th><th className='px-3 py-3 text-right'>База</th><th className='px-3 py-3'>Формула</th><th className='px-3 py-3 text-right'>Бонус</th></tr></thead>
                          <tbody>
                            {(selectedManagerSummary.department === 'Опт'
                              ? [['Опт 1,75%', classification.wholesale.base, 'общая база опта × 1,75%, не делится пополам', selectedManagerSummary.wholesaleBonus]]
                              : [
                                  selectedManagerCounts.filmBase || selectedManagerSummary.filmBonus ? ['Услуги оказываемые 50%', selectedManagerCounts.filmBase, 'выручка × 50%', selectedManagerSummary.filmBonus] : null,
                                  selectedManagerCounts.plotterBase || selectedManagerSummary.plotterBonus ? ['Плоттерные материалы 50% от с/с', selectedManagerCounts.plotterBase, 'с/с × 50%', selectedManagerSummary.plotterBonus] : null,
                                  selectedManagerCounts.techBase || selectedManagerSummary.techBonus ? ['Техника 10% от ВП', selectedManagerCounts.techBase, 'ВП × 10%', selectedManagerSummary.techBonus] : null,
                                  selectedManagerCounts.accessoryBase || selectedManagerSummary.accessoryBonus ? ['Аксессуары 5%', selectedManagerCounts.accessoryBase, 'выручка × 5%', selectedManagerSummary.accessoryBonus] : null,
                                  selectedManagerCounts.credits || selectedManagerSummary.creditBonus ? ['Кредитный бонус', selectedManagerCounts.creditBase, 'ВП × 0,91 × 10%', selectedManagerSummary.creditBonus] : null,
                                ].filter((component): component is [string, number, string, number] => Boolean(component))
                            ).map(([component, base, formula, bonus]) => (
                              <tr key={String(component)} className='border-t border-border/70'><td className='px-3 py-2 font-semibold'>{component}</td><td className='px-3 py-2 text-right'>{formatMoney(Number(base))}</td><td className='px-3 py-2'>{formula}</td><td className='px-3 py-2 text-right font-bold'>{formatMoney(Number(bonus))}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Проверка по сотруднику</h3>
                      <div className='grid gap-2 sm:grid-cols-2'>
                        {[
                          { label: 'Строки без классификации', count: selectedManagerCounts.unclassified, tone: 'error', problemType: 'unclassified' as ProblemType },
                          { label: 'Кредитные продажи', count: selectedManagerCounts.credits, tone: 'warning', problemType: 'credit' as ProblemType },
                          { label: 'Подозрительная нулевая база', count: selectedManagerCounts.zeroBase, tone: 'warning', problemType: 'zeroBase' as ProblemType },
                          { label: 'NaN/undefined', count: selectedManagerCounts.invalidNumbers, tone: 'error', problemType: 'invalidNumbers' as ProblemType },
                          { label: 'Спорные товары', count: selectedManagerCounts.disputed, tone: 'warning', problemType: 'disputed' as ProblemType },
                          { label: 'Отрицательная валовая прибыль', count: selectedManagerCounts.negative, tone: 'warning', problemType: 'negative' as ProblemType },
                          { label: 'Ошибочно исключённые аксессуары', count: selectedManagerCounts.accessoryExcluded, tone: 'error', problemType: 'accessoryExcluded' as ProblemType },
                        ].map(({ label, count, tone, problemType }) => {
                          const status = Number(count) === 0 ? 'OK' : tone === 'error' ? 'Ошибка' : 'Проверить';
                          const isClickable = Number(count) > 0;
                          const clickableClass =
                            tone === 'error'
                              ? 'cursor-pointer border-red-100 bg-red-50/20 hover:border-red-200 hover:bg-red-50/60 hover:shadow-sm'
                              : 'cursor-pointer border-amber-100 bg-amber-50/20 hover:border-amber-200 hover:bg-amber-50/60 hover:shadow-sm';
                          return (
                            <button
                              key={label}
                              type='button'
                              disabled={!isClickable}
                              onClick={() => {
                                openProblemRows(problemType, selectedManagerSummary.manager);
                                setSelectedManager(null);
                              }}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${isClickable ? clickableClass : 'cursor-default border-border bg-white'}`}
                            >
                              <span className='min-w-0'>
                                <span className='block text-sm font-semibold text-slate-700'>{label}</span>
                                <span className='block text-xs text-slate-500'>{count} строк</span>
                              </span>
                              <span className='shrink-0'>
                                <Badge className={`${getRowStatusClass(status === 'OK' ? 'OK' : status === 'Ошибка' ? 'Отрицательная ВП' : 'Требует проверки')} ${isClickable ? 'ring-1 ring-current/20' : ''}`}>
                                  {status}
                                  {isClickable && <ArrowRight className='ml-1 inline h-3.5 w-3.5' />}
                                </Badge>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedManagerCounts.negative > 0 && <p className='mt-3 text-xs text-slate-500'>Отрицательная ВП может быть возвратом или корректировкой. Проверьте строки.</p>}
                    </Card>
                      </>
                    )}
                  </div>
                </aside>
              </div>
            )}

            {false && (
              <>
            <Card>
              <div className='mb-4 grid gap-4 md:grid-cols-[1fr_240px] md:items-end'>
                <div>
                  <h2 className='text-lg font-bold text-slate-900'>{workbook!.fileName}</h2>
                  <p className='text-sm text-slate-500'>
                    Период расчёта: {months[Number(month)]} {year}
                  </p>
                </div>
                <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
                  Лист Excel
                  <select value={selectedSheet} onChange={(event) => setSelectedSheet(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                    {workbook!.sheetNames.map((sheetName) => (
                      <option key={sheetName} value={sheetName}>
                        {sheetName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className='grid gap-3 md:grid-cols-4'>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Товарных строк</p>
                  <p className='text-2xl font-bold text-slate-900'>{parseResult.rows.length}</p>
                </div>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Менеджеров</p>
                  <p className='text-2xl font-bold text-slate-900'>{parseResult.managers.length}</p>
                </div>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Клиентов</p>
                  <p className='text-2xl font-bold text-slate-900'>{parseResult.clients.length}</p>
                </div>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Категорий</p>
                  <p className='text-2xl font-bold text-slate-900'>{parseResult.categories.length}</p>
                </div>
              </div>

              <div className='mt-4 flex flex-wrap gap-2'>
                {parseResult.headerMap ? (
                  <Badge className='bg-green-100 text-green-800'>
                    <CheckCircle2 className='mr-1 inline h-3.5 w-3.5' />
                    Шапка отчёта найдена: строка {rows[parseResult.headerIndex]?.excelRow}
                  </Badge>
                ) : (
                  <Badge className='bg-red-100 text-red-700'>
                    <AlertTriangle className='mr-1 inline h-3.5 w-3.5' />
                    Шапка отчёта не найдена
                  </Badge>
                )}
                {parseResult.warnings.length > 0 && (
                  <Badge className='bg-amber-100 text-amber-800'>
                    <AlertTriangle className='mr-1 inline h-3.5 w-3.5' />
                    Предупреждений: {parseResult.warnings.length}
                  </Badge>
                )}
                <Badge className='bg-slate-100 text-slate-700'>Стратегия: {parseResult.strategy}</Badge>
              </div>

              {rows.length > 1000 && parseResult.rows.length < 100 && (
                <p className='mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800'>
                  Парсер определил слишком мало товарных строк — проверьте диагностику уровней.
                </p>
              )}
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Диагностика уровней</h2>
              <div className='mb-4'>
                <h3 className='mb-2 text-sm font-bold text-slate-900'>Найденные колонки шапки</h3>
                <div className='flex flex-wrap gap-2'>
                  {parseResult.columns.map((column) => (
                    <Badge key={column} className='bg-slate-100 text-slate-700'>
                      {column}
                    </Badge>
                  ))}
                  {!parseResult.columns.length && <p className='text-sm text-slate-500'>Колонки не найдены.</p>}
                </div>
              </div>

              <h3 className='mb-2 text-sm font-bold text-slate-900'>Первые 100 строк после шапки</h3>
              <Table>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>Строка</th>
                    <th className='px-4 py-3'>Значение</th>
                    <th className='px-4 py-3'>outlineLevel</th>
                    <th className='px-4 py-3'>Уровень</th>
                    <th className='px-4 py-3'>currentManager</th>
                    <th className='px-4 py-3'>currentClient</th>
                    <th className='px-4 py-3'>currentRegistrar</th>
                    <th className='px-4 py-3'>currentCategory</th>
                    <th className='px-4 py-3'>Выручка</th>
                    <th className='px-4 py-3'>Валовая прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.diagnostics.slice(0, 100).map((row, rowIndex) => (
                    <tr key={`${row.excelRow}-${rowIndex}`} className='border-t border-border/70'>
                      <td className='whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-400'>#{row.excelRow}</td>
                      <td className='max-w-[320px] truncate px-4 py-3 text-slate-700' title={row.text}>{row.text}</td>
                      <td className='whitespace-nowrap px-4 py-3 text-slate-700'>{row.outlineLevel ?? '—'}</td>
                      <td className='whitespace-nowrap px-4 py-3 font-semibold text-slate-900'>{row.detectedLevel}</td>
                      <td className='max-w-[220px] truncate px-4 py-3 text-slate-700' title={row.currentManager}>{row.currentManager || <span className='text-slate-300'>—</span>}</td>
                      <td className='max-w-[220px] truncate px-4 py-3 text-slate-700' title={row.currentClient}>{row.currentClient || <span className='text-slate-300'>—</span>}</td>
                      <td className='max-w-[260px] truncate px-4 py-3 text-slate-700' title={row.currentRegistrar}>{row.currentRegistrar || <span className='text-slate-300'>—</span>}</td>
                      <td className='max-w-[220px] truncate px-4 py-3 text-slate-700' title={row.currentCategory}>{row.currentCategory || <span className='text-slate-300'>—</span>}</td>
                      <td className='whitespace-nowrap px-4 py-3 text-right text-slate-700'>{formatMoney(row.revenue)}</td>
                      <td className='whitespace-nowrap px-4 py-3 text-right text-slate-700'>{formatMoney(row.grossProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!parseResult.diagnostics.length && <p className='mt-3 text-sm text-slate-500'>Диагностика появится после загрузки отчёта и распознавания шапки.</p>}
            </Card>

            {parseResult.warnings.length > 0 && (
              <Card>
                <h2 className='mb-4 text-lg font-bold text-slate-900'>Предупреждения парсера</h2>
                <div className='grid gap-2'>
                  {parseResult.warnings.slice(0, 20).map((warning, index) => (
                    <div key={`${warning.excelRow}-${index}`} className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800'>
                      {warning.excelRow > 0 && <span className='font-bold'>Строка {warning.excelRow}: </span>}
                      {warning.reason}
                      {warning.text && <span className='text-amber-700'> — {warning.text}</span>}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Классификация продаж</h2>
              <div className='grid gap-3 md:grid-cols-4'>
                {[
                  ['Строк всего', classification.counts.total],
                  ['Строк опта', classification.counts.wholesale],
                  ['Строк розницы', classification.counts.retail],
                  ['Кредитные строки', classification.counts.credit],
                  ['Услуги оказываемые', classification.counts.film],
                  ['Техника 10%', classification.counts.retailTech],
                  ['Аксессуары 5%', classification.counts.accessory],
                  ['Исключённая техника опта', classification.counts.wholesaleExcludedTech],
                ].map(([label, value]) => (
                  <div key={label} className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                    <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                    <p className='text-2xl font-bold text-slate-900'>{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Проверка базы опта</h2>
              {classification.accessoryExcludedRows.length > 0 && (
                <p className='mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700'>
                  Аксессуарная категория ошибочно исключена из базы опта.
                </p>
              )}
              <div className='grid gap-3 md:grid-cols-4'>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Общая выручка Залины</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.zalinaRevenue)}</p>
                </div>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Общая выручка Лианы</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.lianaRevenue)}</p>
                </div>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Опт до исключений</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.totalRevenue)}</p>
                </div>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Сумма исключённой техники</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.excludedTechRevenue)}</p>
                </div>
              </div>
              <div className='mt-3 grid gap-3 md:grid-cols-4'>
                <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>База после исключений</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.base)}</p>
                </div>
                <div className='rounded-lg border border-border bg-white px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Бонус 1.75%</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.bonusEach)}</p>
                </div>
                <div className='rounded-lg border border-border bg-white px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Бонус Залины</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.bonusEach)}</p>
                </div>
                <div className='rounded-lg border border-border bg-white px-3 py-3'>
                  <p className='text-xs font-semibold uppercase text-slate-500'>Бонус Лианы</p>
                  <p className='text-xl font-bold text-slate-900'>{formatMoney(classification.wholesale.bonusEach)}</p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Сводка по типам расчёта</h2>
              <Table>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>Тип расчёта</th>
                    <th className='px-4 py-3'>Строк</th>
                    <th className='px-4 py-3'>Выручка</th>
                    <th className='px-4 py-3'>Валовая прибыль</th>
                    <th className='px-4 py-3'>База расчёта</th>
                    <th className='px-4 py-3'>Формула</th>
                    <th className='px-4 py-3'>Бонус</th>
                  </tr>
                </thead>
                <tbody>
                  {classification.typeSummaries.map((summary) => (
                    <tr key={summary.type} className='border-t border-border/70'>
                      <td className='px-4 py-3 font-semibold text-slate-900'>{summary.label}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{summary.rows}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.revenue)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.grossProfit)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.base)}</td>
                      <td className='px-4 py-3 text-slate-700'>{summary.formula}</td>
                      <td className='px-4 py-3 text-right font-semibold text-slate-900'>{formatMoney(summary.bonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Сводка по менеджерам</h2>
              <Table>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>Менеджер</th>
                    <th className='px-4 py-3'>Подразделение</th>
                    <th className='px-4 py-3'>Выручка</th>
                    <th className='px-4 py-3'>Валовая прибыль</th>
                    <th className='px-4 py-3'>Кредитный бонус</th>
                    <th className='px-4 py-3'>Услуги 50%</th>
                    <th className='px-4 py-3'>Плоттер 50% с/с</th>
                    <th className='px-4 py-3'>Техника 10% от ВП</th>
                    <th className='px-4 py-3'>Аксессуары 5%</th>
                    <th className='px-4 py-3'>Опт 1.75%</th>
                    <th className='px-4 py-3'>Итого бонусов без оклада</th>
                  </tr>
                </thead>
                <tbody>
                  {classification.managerSummaries.map((summary) => (
                    <tr key={summary.manager} className='border-t border-border/70'>
                      <td className='px-4 py-3 font-semibold text-slate-900'>{summary.manager}</td>
                      <td className='px-4 py-3 text-slate-700'>{summary.department}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.revenue)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.grossProfit)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.creditBonus)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.filmBonus)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.plotterBonus)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.techBonus)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.accessoryBonus)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.wholesaleBonus)}</td>
                      <td className='px-4 py-3 text-right font-bold text-slate-900'>{formatMoney(summary.totalBonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Спорные товары</h2>
              {classification.disputedRows.length ? (
                <Table>
                  <thead className='bg-slate-50 text-left text-slate-500'>
                    <tr>
                      <th className='px-4 py-3'>Менеджер</th>
                      <th className='px-4 py-3'>Категория</th>
                      <th className='px-4 py-3'>Номенклатура</th>
                      <th className='px-4 py-3'>Тип расчёта</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classification.disputedRows.slice(0, 50).map((row, rowIndex) => (
                      <tr key={`${row.item}-${rowIndex}`} className='border-t border-border/70'>
                        <td className='px-4 py-3 text-slate-700'>{row.manager}</td>
                        <td className='px-4 py-3 text-slate-700'>{row.category}</td>
                        <td className='max-w-[520px] truncate px-4 py-3 text-slate-700' title={row.item}>{row.item}</td>
                        <td className='px-4 py-3 font-semibold text-slate-900'>{row.calculationLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className='text-sm text-slate-500'>Спорных товаров не найдено.</p>
              )}
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Строки продаж с классификацией</h2>
              <div className='mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6'>
                <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                  <option value='all'>Все подразделения</option>
                  <option value='Опт'>Опт</option>
                  <option value='Розница'>Розница</option>
                </select>
                <select value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                  <option value='all'>Все менеджеры</option>
                  {managerOptions.map((manager) => <option key={manager} value={manager}>{manager}</option>)}
                </select>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                  <option value='all'>Все типы расчёта</option>
                  {typeOptions.map((type) => <option key={type} value={type}>{calculationLabels[type]}</option>)}
                </select>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                  <option value='all'>Все категории</option>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                  <option value='all'>Все клиенты</option>
                  {clientOptions.map((client) => <option key={client} value={client}>{client}</option>)}
                </select>
                <select value={specialFilter} onChange={(event) => setSpecialFilter(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                  <option value='all'>Все проверки</option>
                  <option value='excluded-wholesale'>Только исключённые из базы опта</option>
                  <option value='accessory-excluded'>Аксессуары, ошибочно исключённые</option>
                  <option value='review-tech'>Только спорная техника</option>
                  <option value='phones'>Только категория Телефоны</option>
                  <option value='electronics-watch'>Электроника и Смарт-часы</option>
                </select>
              </div>
              <Table>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>Менеджер</th>
                    <th className='px-4 py-3'>Клиент</th>
                    <th className='px-4 py-3'>Категория</th>
                    <th className='px-4 py-3'>Номенклатура</th>
                    <th className='px-4 py-3'>Артикул</th>
                    <th className='px-4 py-3'>Выручка</th>
                    <th className='px-4 py-3'>Валовая прибыль</th>
                    <th className='px-4 py-3'>Тип расчёта</th>
                    <th className='px-4 py-3'>Входит в базу опта</th>
                    <th className='px-4 py-3'>База</th>
                    <th className='px-4 py-3'>Процент</th>
                    <th className='px-4 py-3'>Бонус</th>
                    <th className='px-4 py-3'>Формула</th>
                    <th className='px-4 py-3'>Причина классификации</th>
                    <th className='px-4 py-3'>Правило</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClassifiedRows.slice(0, 100).map((row, rowIndex) => (
                    <tr key={`${row.manager}-${row.item}-${rowIndex}`} className='border-t border-border/70'>
                      <td className='px-4 py-3 text-slate-700'>{row.manager}</td>
                      <td className='px-4 py-3 text-slate-700'>{row.client}</td>
                      <td className='px-4 py-3 text-slate-700'>{row.category}</td>
                      <td className='max-w-[320px] truncate px-4 py-3 text-slate-700' title={row.item}>{row.item}</td>
                      <td className='px-4 py-3 text-slate-700'>{row.article || <span className='text-slate-300'>—</span>}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(row.revenue)}</td>
                      <td className='px-4 py-3 text-right font-semibold text-slate-900'>{formatMoney(row.grossProfit)}</td>
                      <td className='px-4 py-3 font-semibold text-slate-900'>{row.calculationLabel}</td>
                      <td className='px-4 py-3 text-slate-700'>{row.includedInWholesaleBase === null ? '—' : row.includedInWholesaleBase ? 'да' : 'нет'}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(row.base)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatPercentRate(row.percent)}</td>
                      <td className='px-4 py-3 text-right font-semibold text-slate-900'>{formatMoney(row.bonus)}</td>
                      <td className='px-4 py-3 text-slate-700'>{row.formula}</td>
                      <td className='px-4 py-3 text-slate-700'>{row.classificationReason}</td>
                      <td className='px-4 py-3 text-slate-700'>{row.matchedRule}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!filteredClassifiedRows.length && <p className='mt-3 text-sm text-slate-500'>Строки по выбранным фильтрам не найдены.</p>}
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Сводка менеджер + категория</h2>
              <Table>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>Менеджер</th>
                    <th className='px-4 py-3'>Категория</th>
                    <th className='px-4 py-3'>Выручка</th>
                    <th className='px-4 py-3'>Валовая прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.managerCategorySummaries.map((summary) => (
                    <tr key={`${summary.manager}-${summary.category}`} className='border-t border-border/70'>
                      <td className='px-4 py-3 text-slate-700'>{summary.manager}</td>
                      <td className='px-4 py-3 font-semibold text-slate-900'>{summary.category}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.revenue)}</td>
                      <td className='px-4 py-3 text-right font-semibold text-slate-900'>{formatMoney(summary.grossProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            <Card>
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Сводка по кредитной технике</h2>
              <Table>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>Менеджер</th>
                    <th className='px-4 py-3'>Валовая прибыль по кредитной технике</th>
                    <th className='px-4 py-3'>База после вычета 9%</th>
                    <th className='px-4 py-3'>Бонус 10%</th>
                  </tr>
                </thead>
                <tbody>
                  {classification.managerSummaries.filter((summary) => summary.creditBonus !== 0).map((summary) => {
                    const managerCreditTechRows = creditTechRows.filter((row) => row.manager === summary.manager);
                    const creditGrossProfit = managerCreditTechRows.reduce((sum, row) => sum + row.grossProfit, 0);
                    const creditBase = managerCreditTechRows.reduce((sum, row) => sum + row.base, 0);

                    return (
                    <tr key={summary.manager} className='border-t border-border/70'>
                      <td className='px-4 py-3 font-semibold text-slate-900'>{summary.manager}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(creditGrossProfit)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(creditBase)}</td>
                      <td className='px-4 py-3 text-right font-semibold text-slate-900'>{formatMoney(summary.creditBonus)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </Table>
              {!creditRows.length && <p className='mt-3 text-sm text-slate-500'>Строки с клиентом “Кредит/рассрочка” пока не найдены.</p>}
            </Card>
              </>
            )}
          </>
        )}
      </div>
      </div>
    </AdminShell>
  );
}
