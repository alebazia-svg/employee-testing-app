'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, FileSpreadsheet, Upload } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
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
  | 'RETAIL_REVIEW_TECH'
  | 'RETAIL_FILM_50'
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
  techBonus: number;
  accessoryBonus: number;
  wholesaleBonus: number;
  totalBonus: number;
};

type PayrollManualInput = {
  workedDays: string;
  lateCount: string;
  advance: string;
  comment: string;
  source?: PayrollDaysSource;
};

type PayrollDaysSource = 'manual' | 'attendance' | 'schedule' | 'manualCorrection';

type FullPayrollRow = BonusManagerSummary & {
  workedDays: number | null;
  lateCount: number | null;
  advance: number;
  comment: string;
  daysSource: PayrollDaysSource;
  dayRate: number;
  dayPay: number;
  salesBonus: number;
  disciplineBonus: number;
  grossPay: number;
  netPay: number;
  salaryRule: 'standard' | 'noDayPay' | 'belaPercent';
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
  detectedLevel: 'manager' | 'client' | 'category' | 'item' | 'ignored';
  currentManager: string;
  currentClient: string;
  currentCategory: string;
  revenue: number;
  grossProfit: number;
};

type PayrollAttendanceSourceType = 'form' | 'schedule_only' | 'manual_excluded' | 'manual_special';

type PayrollAttendanceConfig = {
  attendanceNames: string[];
  sourceType: PayrollAttendanceSourceType;
  comment: string;
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

type PayrollParseResult = {
  headerIndex: number;
  headerMap: HeaderMap | null;
  columns: string[];
  rows: SalesRow[];
  managers: string[];
  clients: string[];
  categories: string[];
  warnings: ParseWarning[];
  diagnostics: DiagnosticRow[];
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
  RETAIL_REVIEW_TECH: 'Розница: спорная техника',
  RETAIL_FILM_50: 'Поклейка/бронь: 50%',
  RETAIL_GROSS_PROFIT_10: 'Техника: 10% от ВП',
  RETAIL_ACCESSORY_5: 'Аксессуары: 5%',
};

const calculationFormulas: Record<CalculationType, string> = {
  WHOLESALE_EXCLUDED_TECH: 'не входит в базу опта',
  WHOLESALE_REVIEW_TECH: 'входит в базу опта, требует проверки',
  WHOLESALE_INCLUDED_1_75: 'выручка × 1.75%',
  CREDIT_GROSS_PROFIT: 'ВП × 0.91 × 10%',
  RETAIL_REVIEW_TECH: 'выручка × 5%, требует проверки',
  RETAIL_FILM_50: 'выручка × 50%',
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

  if (knownManagers.includes(normalizeText(cleanText))) return true;
  if (normalizeText(cleanText).includes('стажер')) return true;

  const parts = cleanText.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;

  return parts.every((part) => /^[А-ЯA-ZЁ][а-яa-zё-]+$/.test(part));
}

function isTotalRow(text: string) {
  const normalized = normalizeText(text);
  return normalized === 'итого' || normalized === 'всего' || normalized.startsWith('итого ') || normalized.startsWith('всего ');
}

function isHierarchyHeaderRow(text: string) {
  const normalized = normalizeText(text);
  return normalized === 'клиент' || normalized === 'номенклатура.вид номенклатуры' || normalized === 'номенклатура, артикул';
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

function buildResult(headerIndex: number, headerMap: HeaderMap | null, columns: string[], rows: SalesRow[], managers: Set<string>, clients: Set<string>, categories: Set<string>, warnings: ParseWarning[], diagnostics: DiagnosticRow[], strategy: string): PayrollParseResult {
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
    managers: Array.from(managers),
    clients: Array.from(clients),
    categories: Array.from(categories),
    warnings,
    diagnostics,
    strategy,
    managerSummaries,
    managerCategorySummaries,
    creditSummaries,
  };
}

function parseRowsWithStrategy(rows: SheetRow[], headerIndex: number, headerMap: HeaderMap, columns: string[], strategy: 'outline' | 'content') {
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
  let seenItemInClient = false;

  const addDiagnostic = (row: SheetRow, text: string, detectedLevel: DiagnosticRow['detectedLevel']) => {
    if (diagnostics.length >= 100) return;

    diagnostics.push({
      excelRow: row.excelRow,
      text,
      outlineLevel: row.outlineLevel,
      detectedLevel,
      currentManager,
      currentClient,
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
        detectedLevel = rowLevel <= 0 ? 'manager' : rowLevel === 1 ? 'client' : rowLevel === 2 ? 'category' : 'item';
      }
    }

    if (strategy === 'content' || detectedLevel === 'ignored') {
      const nextLooksCategory = isKnownCategory(nextText) || isBroadCategoryCandidate(nextText);

      if (looksLikeManagerName(text)) {
        detectedLevel = 'manager';
      } else if (!currentManager) {
        detectedLevel = 'ignored';
        warnings.push({ excelRow: row.excelRow, text, reason: 'Строка пропущена: до неё не найден менеджер.' });
      } else if (!currentClient) {
        detectedLevel = 'client';
      } else if (!currentCategory) {
        detectedLevel = 'category';
      } else if (isKnownCategory(text)) {
        detectedLevel = 'category';
      } else if (seenItemInClient && !isLikelyProduct(text) && nextLooksCategory) {
        detectedLevel = 'client';
      } else if (isBroadCategoryCandidate(text) && isLikelyProduct(nextText)) {
        detectedLevel = 'category';
      } else {
        detectedLevel = 'item';
      }
    }

    if (detectedLevel === 'manager') {
      currentManager = text;
      currentClient = '';
      currentCategory = '';
      seenItemInClient = false;
      managers.add(text);
      addDiagnostic(row, text, detectedLevel);
      return;
    }

    if (detectedLevel === 'client') {
      currentClient = text;
      currentCategory = '';
      seenItemInClient = false;
      clients.add(text);
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
        revenue: toNumber(row.values[headerMap.revenue]),
        cost: toNumber(row.values[headerMap.cost]),
        grossProfit: toNumber(row.values[headerMap.grossProfit]),
        profitability: headerMap.profitability >= 0 ? toNumber(row.values[headerMap.profitability]) : 0,
      });
      addDiagnostic(row, text, detectedLevel);
    }
  });

  return buildResult(headerIndex, headerMap, columns, salesRows, managers, clients, categories, warnings, diagnostics, strategy === 'outline' ? 'outlineLevel' : 'эвристика по содержимому');
}

function isSuspiciousParse(result: PayrollParseResult, sourceRowCount: number) {
  if (sourceRowCount > 1000 && result.rows.length < 100) return true;
  if (result.managers.length > 50) return true;
  if (result.categories.length > Math.max(1500, result.rows.length * 0.5)) return true;
  if (result.rows.length > 0 && result.categories.length > result.rows.length * 0.7) return true;
  return false;
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

  const sourceRowCount = rows.slice(headerIndex + 1).filter((row) => !isTotalRow(getHierarchyText(row, headerMap))).length;
  const outlineResult = parseRowsWithStrategy(rows, headerIndex, headerMap, columns, 'outline');
  const contentResult = parseRowsWithStrategy(rows, headerIndex, headerMap, columns, 'content');
  const outlineIsSuspicious = isSuspiciousParse(outlineResult, sourceRowCount);
  const result = !outlineIsSuspicious && outlineResult.rows.length >= contentResult.rows.length * 0.8 ? outlineResult : contentResult;

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

function isPhoneCategory(category: string) {
  return normalizeText(category) === 'телефоны';
}

function isAppleItem(item: string) {
  return containsAny(item, ['Apple', 'iPad', 'MacBook', 'Mac ', 'Айпад', 'Макбук']);
}

function isAppleOnlyExcludedCategory(row: SalesRow) {
  const category = normalizeText(row.category);
  return (category === 'планшеты' || category === 'ноутбуки') && isAppleItem(row.item);
}

function getArticle(item: string) {
  const parts = item.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function isFilmService(row: SalesRow) {
  return containsAny(row.item, ['Поклейка', 'Бронь', 'Бронепленка', 'Бронеплёнка']);
}

function hasDisputeMarkers(row: SalesRow) {
  return containsAny(`${row.category} ${row.item}`, ['Apple', 'Original', 'iPad', 'AirPods', 'Mac', 'Watch']);
}

function getCategoryReason(row: SalesRow) {
  if (isAccessoryCategory(row.category)) {
    return {
      kind: 'accessory' as const,
      reason: `аксессуарная категория: ${row.category}`,
      rule: 'accessory-category',
    };
  }

  if (isPhoneCategory(row.category)) {
    return {
      kind: 'phone' as const,
      reason: 'категория Телефоны: не исключается из опта',
      rule: 'phones-category-included',
    };
  }

  if (isExcludedTechCategory(row.category)) {
    return {
      kind: 'excludedTech' as const,
      reason: `исключаемая техника: категория ${row.category}`,
      rule: 'excluded-tech-category',
    };
  }

  if (isAppleOnlyExcludedCategory(row)) {
    return {
      kind: 'excludedTech' as const,
      reason: `исключаемая Apple-техника: категория ${row.category}`,
      rule: 'apple-only-excluded-tech',
    };
  }

  if (isReviewTechCategory(row.category)) {
    return {
      kind: 'reviewTech' as const,
      reason: `спорная техника: категория ${row.category}`,
      rule: 'review-tech-category',
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
    };
  }

  if (normalizeText(row.client).includes('кредит/рассрочка')) {
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
      classificationReason: 'клиент содержит Кредит/рассрочка',
      matchedRule: 'credit-client',
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
      classificationReason: 'номенклатура содержит Поклейка/Бронь/Бронепленка',
      matchedRule: 'film-service-item',
    };
  }

  if (categoryReason.kind === 'excludedTech') {
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
      techBonus,
      accessoryBonus,
      wholesaleBonus,
      totalBonus: creditBonus + filmBonus + techBonus + accessoryBonus + wholesaleBonus,
    };
  });

  return {
    rows: classifiedRows,
    wholesale,
    typeSummaries,
    managerSummaries,
    disputedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH' || (hasDisputeMarkers(row) && row.matchedRule === 'default-category')),
    accessoryExcludedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH' && isAccessoryCategory(row.category)),
    counts: {
      total: classifiedRows.length,
      wholesale: classifiedRows.filter((row) => row.department === 'Опт').length,
      retail: classifiedRows.filter((row) => row.department === 'Розница').length,
      credit: classifiedRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT').length,
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

function parseManualNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePersonName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isBelaManager(manager: string) {
  const normalized = normalizePersonName(manager);
  return normalized.includes('бэла') || normalized.includes('бела') || normalized.includes('кештова');
}

function isNoDayPayManager(manager: string) {
  return normalizePersonName(manager).includes('асад');
}

function getDayRate(department: Department) {
  return department === 'Опт' ? 500 : 600;
}

function buildFullPayrollRow(summary: BonusManagerSummary, manual: PayrollManualInput | undefined): FullPayrollRow {
  const manualWorkedDays = parseManualNumber(manual?.workedDays ?? '');
  const manualLateCount = parseManualNumber(manual?.lateCount ?? '');
  const salaryRule = isBelaManager(summary.manager) ? 'belaPercent' : isNoDayPayManager(summary.manager) ? 'noDayPay' : 'standard';
  const dayPayNotRequired = salaryRule !== 'standard';
  const workedDays = dayPayNotRequired ? null : manualWorkedDays;
  const lateCount = dayPayNotRequired ? null : manualLateCount;
  const advance = parseManualNumber(manual?.advance ?? '') ?? 0;
  const dayRate = dayPayNotRequired ? 0 : getDayRate(summary.department);
  const dayPay = workedDays === null ? 0 : workedDays * dayRate;
  const salesBonus = salaryRule === 'belaPercent' ? 0 : summary.totalBonus;
  const disciplineBonus = salaryRule === 'standard' && lateCount !== null && lateCount <= 3 ? 3000 : 0;
  const grossPay = dayPay + salesBonus + disciplineBonus;
  const netPay = grossPay - advance;
  const payrollReasons = [
    !dayPayNotRequired && workedDays === null ? 'Не заполнены отработанные дни' : '',
    !dayPayNotRequired && lateCount === null ? 'Не заполнено количество опозданий' : '',
    advance > grossPay ? 'Аванс больше начислений' : '',
  ].filter(Boolean);

  return {
    ...summary,
    workedDays,
    lateCount,
    advance,
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
  const otherNetPay = rows.filter((row) => row.salaryRule !== 'belaPercent').reduce((sum, row) => sum + row.netPay, 0);

  return rows.map((row) => {
    if (row.salaryRule !== 'belaPercent') return row;
    const grossPay = otherNetPay * 0.12;
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
  const credits = managerRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT').length;
  const negative = managerRows.filter((row) => row.grossProfit < 0).length;
  const zeroBase = managerRows.filter((row) => row.base === 0 && row.calculationType !== 'WHOLESALE_EXCLUDED_TECH').length;

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
  const [attendancePreview, setAttendancePreview] = useState<PayrollAttendancePreviewResponse | null>(null);
  const [attendancePreviewError, setAttendancePreviewError] = useState('');
  const [isAttendancePreviewLoading, setIsAttendancePreviewLoading] = useState(false);
  const [attendanceApplyResult, setAttendanceApplyResult] = useState<{
    fullApplied: number;
    daysOnlyApplied: number;
    skipped: number;
    preservedManualFields: number;
  } | null>(null);
  const [problemManagerFilter, setProblemManagerFilter] = useState('all');
  const [problemDepartmentFilter, setProblemDepartmentFilter] = useState('all');
  const [problemCategoryFilter, setProblemCategoryFilter] = useState('all');
  const [problemClientFilter, setProblemClientFilter] = useState('all');
  const [problemTypeFilter, setProblemTypeFilter] = useState<ProblemType>('all');
  const [problemSearch, setProblemSearch] = useState('');
  const [problemArticleSearch, setProblemArticleSearch] = useState('');
  const [detailSearch, setDetailSearch] = useState('');
  const [articleSearch, setArticleSearch] = useState('');

  const rows = selectedSheet && workbook ? workbook.sheets[selectedSheet] ?? [] : [];

  const parseResult = useMemo(() => parsePayrollReport(rows), [rows]);
  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);
  const classification = useMemo(() => classifySalesRows(parseResult.rows), [parseResult.rows]);
  const managerOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.manager))).sort((a, b) => a.localeCompare(b, 'ru')), [classification.rows]);
  const typeOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.calculationType))), [classification.rows]);
  const categoryOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.category))).sort((a, b) => a.localeCompare(b, 'ru')), [classification.rows]);
  const clientOptions = useMemo(() => Array.from(new Set(classification.rows.map((row) => row.client))).sort((a, b) => a.localeCompare(b, 'ru')), [classification.rows]);
  const negativeRows = useMemo(() => classification.rows.filter((row) => row.grossProfit < 0), [classification.rows]);
  const zeroBaseRows = useMemo(() => classification.rows.filter((row) => row.base === 0 && row.calculationType !== 'WHOLESALE_EXCLUDED_TECH'), [classification.rows]);
  const unclassifiedRows = useMemo(() => classification.rows.filter((row) => !row.calculationType), [classification.rows]);
  const wholesaleReviewRows = useMemo(() => classification.rows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH'), [classification.rows]);
  const retailReviewRows = useMemo(() => classification.rows.filter((row) => row.calculationType === 'RETAIL_REVIEW_TECH'), [classification.rows]);
  const excludedWholesaleRows = useMemo(() => classification.rows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH'), [classification.rows]);
  const creditRows = useMemo(() => classification.rows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT'), [classification.rows]);
  const totalRevenue = useMemo(() => classification.rows.reduce((sum, row) => sum + row.revenue, 0), [classification.rows]);
  const totalGrossProfit = useMemo(() => classification.rows.reduce((sum, row) => sum + row.grossProfit, 0), [classification.rows]);
  const totalBonus = useMemo(() => classification.managerSummaries.reduce((sum, row) => sum + row.totalBonus, 0), [classification.managerSummaries]);
  const fullPayrollRows = useMemo(
    () => applyBelaPercentRule(classification.managerSummaries.map((summary) => buildFullPayrollRow(summary, manualPayroll[summary.manager]))),
    [classification.managerSummaries, manualPayroll],
  );
  const payrollAttendanceMappingRows = useMemo(
    () =>
      fullPayrollRows.map((row) => {
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
    [fullPayrollRows],
  );
  const payrollAttendancePreviewRows = useMemo(() => {
    if (!attendancePreview) return [];

    return fullPayrollRows.map((row) => {
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
          lateCount: null,
          status,
          comment: uniqueScheduleMatches.length ? 'Сотрудник не отмечается в форме, опоздания невозможно посчитать автоматически.' : config.comment,
        };
      }

      const status = uniqueFormMatches.length === 0 ? 'не найден' : uniqueFormMatches.length > 1 ? 'несколько совпадений' : 'найдено по форме';
      const workedDays = uniqueFormMatches.reduce((sum, match) => sum + match.workedDays, 0);
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
        workedDays: uniqueFormMatches.length ? workedDays : null,
        lateCount,
        status,
        comment: config.comment,
      };
    });
  }, [attendancePreview, fullPayrollRows]);
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
  const retailCreditSummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT')), [retailRows]);
  const retailReviewSummary = useMemo(() => sumRows(retailReviewRows), [retailReviewRows]);
  const classificationErrorCount = classification.accessoryExcludedRows.length + unclassifiedRows.length;
  const selectedManagerSummary = useMemo(() => classification.managerSummaries.find((summary) => summary.manager === selectedManager) ?? null, [classification.managerSummaries, selectedManager]);
  const selectedManagerRows = useMemo(() => classification.rows.filter((row) => row.manager === selectedManager), [classification.rows, selectedManager]);
  const selectedManagerStatus = selectedManagerSummary ? getManagerStatus(selectedManagerSummary, classification.rows, classification.accessoryExcludedRows) : null;
  const selectedManagerCounts = useMemo(
    () => ({
      disputed: selectedManagerRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH').length,
      credits: selectedManagerRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT').length,
      negative: selectedManagerRows.filter((row) => row.grossProfit < 0).length,
      zeroBase: selectedManagerRows.filter((row) => row.base === 0 && row.calculationType !== 'WHOLESALE_EXCLUDED_TECH').length,
      unclassified: selectedManagerRows.filter((row) => !row.calculationType).length,
      accessoryExcluded: classification.accessoryExcludedRows.filter((row) => row.manager === selectedManager).length,
      invalidNumbers: selectedManagerRows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))).length,
      creditBase: selectedManagerRows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT').reduce((sum, row) => sum + row.base, 0),
      filmBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.base, 0),
      techBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10').reduce((sum, row) => sum + row.base, 0),
      accessoryBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_ACCESSORY_5' || row.calculationType === 'RETAIL_REVIEW_TECH').reduce((sum, row) => sum + row.base, 0),
    }),
    [selectedManagerRows, classification.accessoryExcludedRows, selectedManager],
  );
  const invalidNumberRows = useMemo(() => classification.rows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))), [classification.rows]);
  const problemDefinitions = useMemo(
    () => [
      { type: 'disputed' as const, label: 'Спорные товары', rows: classification.disputedRows },
      { type: 'credit' as const, label: 'Кредиты', rows: creditRows },
      { type: 'wholesaleReview' as const, label: 'Спорная техника опта', rows: wholesaleReviewRows },
      { type: 'retailReview' as const, label: 'Спорная техника розницы', rows: retailReviewRows },
      { type: 'negative' as const, label: 'Отрицательная ВП', rows: negativeRows },
      { type: 'zeroBase' as const, label: 'Нулевая база', rows: zeroBaseRows },
      { type: 'unclassified' as const, label: 'Без классификации', rows: unclassifiedRows },
      { type: 'accessoryExcluded' as const, label: 'Ошибочно исключённые аксессуары', rows: classification.accessoryExcludedRows },
      { type: 'invalidNumbers' as const, label: 'NaN/undefined', rows: invalidNumberRows },
    ],
    [classification.disputedRows, creditRows, wholesaleReviewRows, retailReviewRows, negativeRows, zeroBaseRows, unclassifiedRows, classification.accessoryExcludedRows, invalidNumberRows],
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

    const result = {
      fullApplied: 0,
      daysOnlyApplied: 0,
      skipped: 0,
      preservedManualFields: 0,
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

      if (row.sourceType === 'form' && row.status === 'найдено по форме' && row.workedDays !== null && row.lateCount !== null) {
        let appliedWorkedDays = false;
        let appliedLateCount = false;

        if (hasManualWorkedDays) {
          result.preservedManualFields += 1;
        } else {
          previous.workedDays = String(row.workedDays);
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
        } else {
          result.skipped += 1;
        }

        next[row.manager] = { ...previous };
        continue;
      }

      if (row.sourceType === 'schedule_only' && row.status === 'дни из графика, опоздания вручную' && row.workedDays !== null) {
        if (hasManualWorkedDays) {
          result.preservedManualFields += 1;
          result.skipped += 1;
        } else {
          next[row.manager] = {
            ...previous,
            workedDays: String(row.workedDays),
            source: 'schedule',
          };
          result.daysOnlyApplied += 1;
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

  return (
    <AdminShell>
      <div className='max-w-full overflow-x-hidden'>
      <div className='mb-6 flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Зарплата</h1>
          <p className='mt-1 max-w-3xl text-sm text-slate-500'>
            На этом этапе портал только проверяет Excel-отчёт из 1С. Расчёт зарплаты будет добавлен следующим шагом.
          </p>
        </div>
        <Badge className='w-fit bg-amber-100 text-amber-800'>Черновой импорт</Badge>
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

          <div className='grid gap-4 md:grid-cols-[180px_140px_1fr]'>
            <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
              Месяц
              <select value={month} onChange={(event) => setMonth(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
                {months.map((monthName, index) => (
                  <option key={monthName} value={index}>
                    {monthName}
                  </option>
                ))}
              </select>
            </label>

            <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
              Год
              <select value={year} onChange={(event) => setYear(event.target.value)} className='rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'>
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
          </div>

          {error && <p className='mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700'>{error}</p>}
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
                <Badge className={getCheckStatus(classificationErrorCount > 0 ? 'error' : classification.disputedRows.length || creditRows.length ? 'warning' : 'ok')}>
                  {classificationErrorCount > 0 ? 'Есть ошибки' : classification.disputedRows.length || creditRows.length ? 'Требует проверки' : 'Готово к проверке'}
                </Badge>
              </div>

              <div className='grid min-w-0 gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3'>
                {[
                  { label: 'Файл прочитан', detail: workbook.fileName, status: 'ok' as const, count: 0 },
                  { label: 'Шапка отчёта найдена', detail: parseResult.headerMap ? `строка ${rows[parseResult.headerIndex]?.excelRow}` : 'не найдена', status: parseResult.headerMap ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Товарные строки распознаны', detail: `${parseResult.rows.length}`, status: parseResult.rows.length > 100 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Менеджеры распознаны', detail: `${parseResult.managers.length}`, status: parseResult.managers.length > 0 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Клиенты распознаны', detail: `${parseResult.clients.length}`, status: parseResult.clients.length > 0 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Опт рассчитан', detail: `база ${formatMoney(classification.wholesale.base)}`, status: classification.wholesale.base > 0 ? 'ok' as const : 'error' as const, count: 0 },
                  { label: 'Ошибочно исключённые аксессуары', detail: `${classification.accessoryExcludedRows.length} строк`, status: classification.accessoryExcludedRows.length ? 'error' as const : 'ok' as const, count: classification.accessoryExcludedRows.length, problemType: 'accessoryExcluded' as ProblemType },
                  { label: 'Спорная техника опта', detail: `${wholesaleReviewRows.length} строк`, status: wholesaleReviewRows.length ? 'warning' as const : 'ok' as const, count: wholesaleReviewRows.length, problemType: 'wholesaleReview' as ProblemType },
                  { label: 'Спорная техника розницы', detail: `${retailReviewRows.length} строк`, status: retailReviewRows.length ? 'warning' as const : 'ok' as const, count: retailReviewRows.length, problemType: 'retailReview' as ProblemType },
                  { label: 'Строки без классификации', detail: `${unclassifiedRows.length} строк`, status: unclassifiedRows.length ? 'error' as const : 'ok' as const, count: unclassifiedRows.length, problemType: 'unclassified' as ProblemType },
                  { label: 'Отрицательная валовая прибыль', detail: `${negativeRows.length} строк`, status: negativeRows.length ? 'warning' as const : 'ok' as const, count: negativeRows.length, problemType: 'negative' as ProblemType },
                  { label: 'Строки с нулевой базой расчёта', detail: `${zeroBaseRows.length} строк`, status: zeroBaseRows.length ? 'warning' as const : 'ok' as const, count: zeroBaseRows.length, problemType: 'zeroBase' as ProblemType },
                  { label: 'Кредиты найдены', detail: `${creditRows.length} строк, требуется сверка`, status: creditRows.length ? 'warning' as const : 'ok' as const, count: creditRows.length, problemType: 'credit' as ProblemType },
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
                  </div>

                  <Card>
                    <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                      <h2 className='text-lg font-bold text-slate-900'>Итог по сотрудникам</h2>
                      <button type='button' onClick={() => setActivePayrollTab('Дни и авансы')} className='w-fit rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:text-slate-900'>
                        Редактировать дни и авансы
                      </button>
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
                                <td className='max-w-[210px] truncate px-2 py-2 font-semibold text-slate-900' title={summary.manager}>{summary.manager}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-slate-700'>{summary.department}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.workedDays ?? '—'}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.lateCount ?? '—'}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right font-semibold text-slate-900'>{formatMoney(summary.salesBonus)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{formatMoney(summary.disciplineBonus)}</td>
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
                          <th className='px-3 py-3'>Аванс</th>
                          <th className='px-3 py-3'>Комментарий</th>
                        </tr>
                      </thead>
                      <tbody>
                          {fullPayrollRows.map((row) => {
                            const manual = manualPayroll[row.manager] ?? { workedDays: '', lateCount: '', advance: '', comment: '' };
                            const workedDaysValue = manual.workedDays || (row.workedDays === null ? '' : String(row.workedDays));
                            const lateCountValue = manual.lateCount || (row.lateCount === null ? '' : String(row.lateCount));
                            return (
                            <tr key={row.manager} className='border-t border-border/70 align-top'>
                              <td className='px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                              <td className='px-3 py-2'>{row.department}</td>
                              <td className='px-3 py-2 text-slate-700'>{getPayrollDaysSourceLabel(row.daysSource)}</td>
                              <td className='px-3 py-2'><Input type='number' min='0' step='0.5' value={workedDaysValue} onChange={(event) => updateManualPayroll(row.manager, 'workedDays', event.target.value)} className='h-9 w-28' /></td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.dayRate)}</td>
                              <td className='px-3 py-2 text-right font-semibold'>{formatMoney(row.dayPay)}</td>
                              <td className='px-3 py-2'><Input type='number' min='0' step='1' value={lateCountValue} onChange={(event) => updateManualPayroll(row.manager, 'lateCount', event.target.value)} className='h-9 w-28' /></td>
                              <td className='px-3 py-2 text-right font-semibold'>{formatMoney(row.disciplineBonus)}</td>
                              <td className='px-3 py-2'><Input type='number' min='0' step='100' value={manual.advance} onChange={(event) => updateManualPayroll(row.manager, 'advance', event.target.value)} className='h-9 w-32' /></td>
                              <td className='px-3 py-2'><Input value={manual.comment} onChange={(event) => updateManualPayroll(row.manager, 'comment', event.target.value)} placeholder='Комментарий' className='h-9 min-w-[220px]' /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
                          <div className='mb-3 grid gap-2 text-sm sm:grid-cols-4'>
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
                  <div className='grid gap-3 md:grid-cols-5'>
                    {[
                      ['Техника 10%', `${retailTechSummary.rows} / ${formatMoney(retailTechSummary.base)} / ${formatMoney(retailTechSummary.bonus)}`],
                      ['Аксессуары 5%', `${retailAccessorySummary.rows} / ${formatMoney(retailAccessorySummary.base)} / ${formatMoney(retailAccessorySummary.bonus)}`],
                      ['Поклейка 50%', `${retailFilmSummary.rows} / ${formatMoney(retailFilmSummary.base)} / ${formatMoney(retailFilmSummary.bonus)}`],
                      ['Кредиты', `${retailCreditSummary.rows} / ${formatMoney(retailCreditSummary.base)} / ${formatMoney(retailCreditSummary.bonus)}`],
                      ['Спорная розница', `${retailReviewSummary.rows} / ${formatMoney(retailReviewSummary.revenue)}`],
                    ].map(([label, value]) => <Card key={label} className='p-4'><p className='text-xs font-semibold uppercase text-slate-500'>{label}</p><p className='mt-1 text-sm font-bold text-slate-900'>{value}</p></Card>)}
                  </div>
                  <Card>
                    <h2 className='mb-4 text-lg font-bold text-slate-900'>Розничные менеджеры</h2>
                    <div className='max-h-[520px] overflow-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[980px] text-sm'>
                        <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-3'>Менеджер</th><th className='px-3 py-3 text-right'>Выручка</th><th className='px-3 py-3 text-right'>ВП</th><th className='px-3 py-3 text-right'>Кредит</th><th className='px-3 py-3 text-right'>Поклейка</th><th className='px-3 py-3 text-right'>Техника</th><th className='px-3 py-3 text-right'>Аксессуары</th><th className='px-3 py-3 text-right'>Итого</th><th className='px-3 py-3 text-right'>Спорные</th></tr></thead>
                        <tbody>
                          {classification.managerSummaries.filter((row) => row.department === 'Розница').map((row) => (
                            <tr key={row.manager} className='border-t border-border/70'><td className='px-3 py-2 font-semibold'>{row.manager}</td><td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.creditBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.filmBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.techBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.accessoryBonus)}</td><td className='px-3 py-2 text-right font-bold'>{formatMoney(row.totalBonus)}</td><td className='px-3 py-2 text-right'>{retailReviewRows.filter((item) => item.manager === row.manager).length}</td></tr>
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
                      <option value='credit'>Кредиты</option>
                      <option value='wholesaleReview'>Спорная техника опта</option>
                      <option value='retailReview'>Спорная техника розницы</option>
                      <option value='negative'>Отрицательная ВП</option>
                      <option value='zeroBase'>Нулевая база</option>
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
                      <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Тип проблемы</th><th className='px-3 py-2'>Сотрудник</th><th className='px-3 py-2'>Отдел</th><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>Валовая прибыль</th><th className='px-3 py-2 text-right'>База расчёта</th><th className='px-3 py-2'>Тип расчёта</th><th className='px-3 py-2'>Причина</th><th className='px-3 py-2'>Правило</th></tr></thead>
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
                              <td className='px-3 py-2'>{row.article || '—'}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td>
                              <td className='px-3 py-2 text-right'>{formatMoney(row.base)}</td>
                              <td className='px-3 py-2'>{row.calculationLabel}</td>
                              <td className='px-3 py-2'>{row.classificationReason}</td>
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
                    {parseResult.columns.map((column) => <Badge key={column} className='bg-slate-100 text-slate-700'>{column}</Badge>)}
                  </div>
                  <div className='max-h-[620px] overflow-auto rounded-lg border border-border'>
                    <table className='w-full min-w-[1100px] text-xs'>
                      <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Строка</th><th className='px-3 py-2'>Значение</th><th className='px-3 py-2'>outlineLevel</th><th className='px-3 py-2'>Уровень</th><th className='px-3 py-2'>currentManager</th><th className='px-3 py-2'>currentClient</th><th className='px-3 py-2'>currentCategory</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>ВП</th></tr></thead>
                      <tbody>{parseResult.diagnostics.map((row, index) => <tr key={`${row.excelRow}-${index}`} className='border-t border-border/70'><td className='px-3 py-2'>#{row.excelRow}</td><td className='max-w-[320px] truncate px-3 py-2' title={row.text}>{row.text}</td><td className='px-3 py-2'>{row.outlineLevel ?? '—'}</td><td className='px-3 py-2'>{row.detectedLevel}</td><td className='px-3 py-2'>{row.currentManager || '—'}</td><td className='px-3 py-2'>{row.currentClient || '—'}</td><td className='px-3 py-2'>{row.currentCategory || '—'}</td><td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>

            {selectedManagerSummary && selectedManagerStatus && selectedManagerPayroll && (
              <div className='fixed inset-0 z-50 flex justify-end bg-slate-950/45'>
                <aside className='h-full w-full overflow-y-auto bg-white p-5 shadow-2xl md:w-[62vw] xl:w-[58vw]'>
                  <div className='mb-5 flex items-start justify-between gap-4 border-b border-border pb-4'>
                    <div className='min-w-0'>
                      <h2 className='truncate text-2xl font-bold text-slate-900'>{selectedManagerSummary.manager}</h2>
                      <p className='mt-1 text-sm text-slate-500'>{months[Number(month)]} {year} · {selectedManagerSummary.department}</p>
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
                            {selectedManagerCounts.zeroBase > 0 && <li>Нулевая база: {selectedManagerCounts.zeroBase} строк</li>}
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
                        {[
                          ['Ставка', formatMoney(selectedManagerPayroll.dayRate)],
                          ['Источник дней', getPayrollDaysSourceLabel(selectedManagerPayroll.daysSource)],
                          ['Дни', selectedManagerPayroll.workedDays ?? '—'],
                          ['Опоздания', selectedManagerPayroll.lateCount ?? '—'],
                          ['Имя в посещаемости', selectedManagerAttendanceNames.join(', ') || '—'],
                          ['Правило зарплаты', selectedManagerPayroll.salaryRule === 'belaPercent' ? '12% от итоговых ЗП сотрудников' : selectedManagerPayroll.salaryRule === 'noDayPay' ? 'Без оплаты выходов по дням' : 'Стандарт'],
                          ['Оплата по дням', formatMoney(selectedManagerPayroll.dayPay)],
                          ['Бонус продаж', formatMoney(selectedManagerPayroll.salesBonus)],
                          ['Бонус дисциплины', formatMoney(selectedManagerPayroll.disciplineBonus)],
                          ['Всего начислено', formatMoney(selectedManagerPayroll.grossPay)],
                        ].map(([label, value]) => (
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
                          ['Всего удержано', formatMoney(selectedManagerPayroll.advance)],
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

                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Структура бонусов</h3>
                      <p className='mb-3 text-sm text-slate-600'>
                        {selectedManagerSummary.department === 'Опт'
                          ? 'Схема расчёта: Опт — 1,75% от общей базы опта. Залина и Лиана получают каждая полный бонус, бонус не делится пополам.'
                          : 'Схема расчёта: Розница — кредитный бонус, поклейка / бронь 50%, техника 10% от ВП, аксессуары 5%.'}
                      </p>
                      <div className='overflow-x-auto rounded-lg border border-border'>
                        <table className='w-full min-w-[620px] text-sm'>
                          <thead className='bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-3'>Компонент</th><th className='px-3 py-3 text-right'>База</th><th className='px-3 py-3'>Формула</th><th className='px-3 py-3 text-right'>Бонус</th></tr></thead>
                          <tbody>
                            {(selectedManagerSummary.department === 'Опт'
                              ? [['Опт 1,75%', classification.wholesale.base, 'общая база опта × 1,75%, не делится пополам', selectedManagerSummary.wholesaleBonus]]
                              : [
                                  selectedManagerCounts.credits || selectedManagerSummary.creditBonus ? ['Кредитный бонус', selectedManagerCounts.creditBase, 'ВП × 0,91 × 10%', selectedManagerSummary.creditBonus] : null,
                                  selectedManagerCounts.filmBase || selectedManagerSummary.filmBonus ? ['Поклейка / бронь 50%', selectedManagerCounts.filmBase, 'выручка × 50%', selectedManagerSummary.filmBonus] : null,
                                  selectedManagerCounts.techBase || selectedManagerSummary.techBonus ? ['Техника 10% от ВП', selectedManagerCounts.techBase, 'ВП × 10%', selectedManagerSummary.techBonus] : null,
                                  selectedManagerCounts.accessoryBase || selectedManagerSummary.accessoryBonus ? ['Аксессуары 5%', selectedManagerCounts.accessoryBase, 'выручка × 5%', selectedManagerSummary.accessoryBonus] : null,
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
                          { label: 'Кредиты', count: selectedManagerCounts.credits, tone: 'warning', problemType: 'credit' as ProblemType },
                          { label: 'Нулевая база расчёта', count: selectedManagerCounts.zeroBase, tone: 'warning', problemType: 'zeroBase' as ProblemType },
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
                    <th className='px-4 py-3'>currentCategory</th>
                    <th className='px-4 py-3'>Выручка</th>
                    <th className='px-4 py-3'>Валовая прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.diagnostics.map((row, rowIndex) => (
                    <tr key={`${row.excelRow}-${rowIndex}`} className='border-t border-border/70'>
                      <td className='whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-400'>#{row.excelRow}</td>
                      <td className='max-w-[320px] truncate px-4 py-3 text-slate-700' title={row.text}>{row.text}</td>
                      <td className='whitespace-nowrap px-4 py-3 text-slate-700'>{row.outlineLevel ?? '—'}</td>
                      <td className='whitespace-nowrap px-4 py-3 font-semibold text-slate-900'>{row.detectedLevel}</td>
                      <td className='max-w-[220px] truncate px-4 py-3 text-slate-700' title={row.currentManager}>{row.currentManager || <span className='text-slate-300'>—</span>}</td>
                      <td className='max-w-[220px] truncate px-4 py-3 text-slate-700' title={row.currentClient}>{row.currentClient || <span className='text-slate-300'>—</span>}</td>
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
                  ['Поклейка/бронь', classification.counts.film],
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
                    <th className='px-4 py-3'>Поклейка 50%</th>
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
              <h2 className='mb-4 text-lg font-bold text-slate-900'>Сводка по кредитам</h2>
              <Table>
                <thead className='bg-slate-50 text-left text-slate-500'>
                  <tr>
                    <th className='px-4 py-3'>Менеджер</th>
                    <th className='px-4 py-3'>Валовая прибыль по кредитам</th>
                    <th className='px-4 py-3'>База после вычета 9%</th>
                    <th className='px-4 py-3'>Бонус 10%</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.creditSummaries.map((summary) => (
                    <tr key={summary.manager} className='border-t border-border/70'>
                      <td className='px-4 py-3 font-semibold text-slate-900'>{summary.manager}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.grossProfit)}</td>
                      <td className='px-4 py-3 text-right text-slate-700'>{formatMoney(summary.baseAfterNinePercent)}</td>
                      <td className='px-4 py-3 text-right font-semibold text-slate-900'>{formatMoney(summary.bonus)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {!parseResult.creditSummaries.length && <p className='mt-3 text-sm text-slate-500'>Строки с клиентом “Кредит/рассрочка” пока не найдены.</p>}
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
