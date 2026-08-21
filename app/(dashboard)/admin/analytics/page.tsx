import Link from 'next/link';
import { AlertTriangle, CheckCircle2, ChevronRight, FileWarning, LineChart } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { prisma } from '@/lib/prisma';
import { ExtendedVgpUpload } from './ExtendedVgpUpload';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getLatestPayrollRun(period?: string) {
  return prisma.payrollRun.findFirst({
    where: period ? { period: { periodKey: period } } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      period: true,
      employeeResults: { orderBy: [{ order: 'asc' }, { employeeName: 'asc' }] },
      sourceFiles: { orderBy: { uploadedAt: 'asc' } },
      analyticsRows: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          employeeName: true,
          department: true,
          client: true,
          category: true,
          nomenclatureType: true,
          itemName: true,
          article: true,
          quantity: true,
          revenue: true,
          cost: true,
          grossProfit: true,
          marginPercent: true,
          markupPercent: true,
          calculationType: true,
          componentType: true,
          commissionAmount: true,
          isCredit: true,
          isReturn: true,
          isNegative: true,
          isManualRuleApplied: true,
          manualRuleLabel: true,
          problemFlags: true,
          checkReason: true,
        },
      },
    },
  });
}

async function getLatestExtendedReportHeader() {
  return prisma.salesAnalyticsReport.findFirst({
    where: { sourceReportType: 'extended_vgp' },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      period: true,
      fileName: true,
      uploadedAt: true,
      rowsCount: true,
    },
  });
}

async function getExtendedReport(period: string) {
  return prisma.salesAnalyticsReport.findFirst({
    where: { period, sourceReportType: 'extended_vgp' },
    orderBy: { uploadedAt: 'desc' },
    include: {
      rows: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          sourceReportType: true,
          employeeName: true,
          department: true,
          client: true,
          category: true,
          nomenclatureType: true,
          itemName: true,
          article: true,
          quantity: true,
          revenue: true,
          cost: true,
          grossProfit: true,
          marginPercent: true,
          markupPercent: true,
          documentName: true,
          documentType: true,
          documentDate: true,
          isCredit: true,
          isReturn: true,
          isRealReturn: true,
          isNegative: true,
          problemFlags: true,
          checkReason: true,
        },
      },
    },
  });
}

async function getAvailablePeriods() {
  const [extendedPeriods, payrollPeriods] = await Promise.all([
    prisma.salesAnalyticsReport.findMany({
      where: { sourceReportType: 'extended_vgp' },
      distinct: ['period'],
      orderBy: { period: 'desc' },
      select: { period: true },
    }),
    prisma.payrollPeriod.findMany({
      orderBy: { periodKey: 'desc' },
      select: { periodKey: true },
    }),
  ]);

  return Array.from(new Set([
    ...extendedPeriods.map((item) => item.period),
    ...payrollPeriods.map((item) => item.periodKey),
  ])).sort((left, right) => right.localeCompare(left));
}

type LatestPayrollRun = NonNullable<Awaited<ReturnType<typeof getLatestPayrollRun>>>;
type EmployeeResult = LatestPayrollRun['employeeResults'][number];
type PayrollAnalyticsRow = LatestPayrollRun['analyticsRows'][number];
type ExtendedReport = NonNullable<Awaited<ReturnType<typeof getExtendedReport>>>;
type ExtendedAnalyticsRow = ExtendedReport['rows'][number];
type SourceKind = 'extended_vgp' | 'payroll_snapshot';
type SourceMode = 'auto' | 'extended_vgp' | 'payroll_snapshot';

type AnalyticsRow = {
  id: number;
  employeeName: string;
  department: string | null;
  client: string | null;
  category: string | null;
  nomenclatureType: string | null;
  itemName: string;
  article: string | null;
  quantity: number | null;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number | null;
  markupPercent: number | null;
  calculationType: string;
  componentType: string | null;
  documentName: string | null;
  documentDate: Date | null;
  commissionAmount: number;
  isCredit: boolean;
  isReturn: boolean;
  isNegative: boolean;
  isManualRuleApplied: boolean;
  manualRuleLabel: string | null;
  problemFlags: unknown;
  checkReason: string | null;
};

type CategorySummary = {
  group: string;
  rows: number;
  revenue: number;
  cost: number;
  grossProfit: number;
};

type SalespersonSummary = {
  employeeName: string;
  direction: string;
  rows: number;
  revenue: number;
  grossProfit: number;
  creditRevenue: number;
  grossPay: number;
  salesProblems: string[];
};

type PriceControlRow = {
  row: AnalyticsRow;
  reasons: string[];
  severity: number;
};

type CreditProductSummary = {
  group: 'tech' | 'accessory' | 'service' | 'plotterMaterial' | 'other';
  itemName: string;
  category: string;
  rows: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  sellers: Set<string>;
};

type InsightStatus = 'Хорошо' | 'Нормально' | 'Проверить' | 'Критично' | 'Нет данных' | 'Инфо';

type MonthInsight = {
  status: InsightStatus;
  title: string;
  text: string;
};

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'нет данных';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'нет данных';
  return value.toLocaleString('ru-RU');
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'нет данных';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDate(date: Date | null | undefined) {
  if (!date) return 'нет данных';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getStatusClass(status: InsightStatus) {
  if (status === 'Хорошо') return 'bg-green-100 text-green-800';
  if (status === 'Нормально') return 'bg-blue-100 text-blue-800';
  if (status === 'Проверить') return 'bg-amber-100 text-amber-800';
  if (status === 'Критично') return 'bg-red-100 text-red-700';
  if (status === 'Нет данных') return 'bg-slate-100 text-slate-700';
  return 'bg-slate-100 text-slate-700';
}

function StatusBadge({ status }: { status: InsightStatus }) {
  return <Badge className={getStatusClass(status)}>{status}</Badge>;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function readReviewEmployees(source: Record<string, unknown>) {
  const value = source.reviewEmployees;
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asObject(item);
      const employeeName = typeof row.employeeName === 'string' ? row.employeeName : '';
      return {
        employeeName,
        reasons: readStringArray(row.reasons),
        netPay: typeof row.netPay === 'number' && Number.isFinite(row.netPay) ? row.netPay : null,
      };
    })
    .filter((item) => item.employeeName);
}

function readFlags(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizePayrollRows(rows: PayrollAnalyticsRow[]): AnalyticsRow[] {
  return rows.map((row) => ({
    ...row,
    nomenclatureType: row.nomenclatureType ?? null,
    documentName: null,
    documentDate: null,
  }));
}

function normalizeExtendedRows(rows: ExtendedAnalyticsRow[]): AnalyticsRow[] {
  return rows.map((row) => ({
    id: row.id,
    employeeName: row.employeeName,
    department: row.department,
    client: row.client,
    category: row.category || row.nomenclatureType,
    nomenclatureType: row.nomenclatureType,
    itemName: row.itemName,
    article: row.article,
    quantity: row.quantity,
    revenue: row.revenue,
    cost: row.cost,
    grossProfit: row.grossProfit,
    marginPercent: row.marginPercent,
    markupPercent: row.markupPercent,
    calculationType: row.documentType,
    componentType: row.sourceReportType,
    documentName: row.documentName,
    documentDate: row.documentDate,
    commissionAmount: 0,
    isCredit: row.isCredit,
    isReturn: row.isReturn || row.isRealReturn,
    isNegative: row.isNegative,
    isManualRuleApplied: false,
    manualRuleLabel: null,
    problemFlags: row.problemFlags,
    checkReason: row.checkReason,
  }));
}

function sumRows(rows: AnalyticsRow[], key: 'revenue' | 'cost' | 'grossProfit' | 'commissionAmount') {
  return rows.reduce((total, row) => total + row[key], 0);
}

function sumEmployees(employees: EmployeeResult[], key: 'revenue' | 'grossProfit' | 'grossPay' | 'netPay') {
  return employees.reduce((total, employee) => total + employee[key], 0);
}

function margin(revenue: number, grossProfit: number) {
  return revenue !== 0 ? (grossProfit / revenue) * 100 : null;
}

function markup(cost: number, grossProfit: number) {
  return cost !== 0 ? (grossProfit / cost) * 100 : null;
}

function isWholesaleText(value: string | null | undefined) {
  const text = String(value ?? '').toLowerCase();
  return text.includes('опт') || text.includes('wholesale');
}

function isAccessoryRow(row: AnalyticsRow) {
  const text = `${row.calculationType} ${row.componentType ?? ''} ${row.category ?? ''}`.toLowerCase();
  return text.includes('accessory') || text.includes('аксессуар');
}

function isTechRow(row: AnalyticsRow) {
  const text = `${row.calculationType} ${row.category ?? ''} ${row.itemName}`.toLowerCase();
  return (
    row.calculationType === 'RETAIL_GROSS_PROFIT_10' ||
    row.calculationType === 'CREDIT_GROSS_PROFIT' ||
    text.includes('смартфон') ||
    text.includes('iphone') ||
    text.includes('телефон') ||
    text.includes('техника') ||
    text.includes('apple watch') ||
    text.includes('ipad') ||
    text.includes('macbook')
  );
}

function isWorkServiceRow(row: AnalyticsRow) {
  const text = `${row.calculationType} ${row.componentType ?? ''} ${row.category ?? ''} ${row.itemName}`.toLowerCase();
  return (
    row.calculationType === 'RETAIL_FILM_50' ||
    text.includes('услуги оказываемые') ||
    text.includes('поклейка') ||
    text.includes('обклейка') ||
    text.includes('установка') ||
    text.includes('монтаж') ||
    text.includes('сервисная работа') ||
    text.includes('работа по нанесению') ||
    text.includes('работа по монтажу')
  );
}

function isPlotterMaterialRow(row: AnalyticsRow) {
  const text = `${row.calculationType} ${row.componentType ?? ''} ${row.category ?? ''} ${row.itemName}`.toLowerCase();
  return (
    row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50' ||
    text.includes('антигравийная плёнка') ||
    text.includes('антигравийная пленка') ||
    text.includes('защитная плёнка') ||
    text.includes('защитная пленка') ||
    text.includes('плоттерная плёнка') ||
    text.includes('плоттерная пленка') ||
    text.includes('материалы для плоттера') ||
    text.includes('матовая плёнка') ||
    text.includes('матовая пленка') ||
    text.includes('глянцевая плёнка') ||
    text.includes('глянцевая пленка') ||
    text.includes('текстурная плёнка') ||
    text.includes('текстурная пленка') ||
    text.includes('3m skin')
  );
}

function isCreditAccessoryDisplayRow(row: AnalyticsRow) {
  const text = `${row.calculationType} ${row.componentType ?? ''} ${row.category ?? ''} ${row.itemName}`.toLowerCase();
  const accessoryMarkers = [
    'accessory',
    'аксессуар',
    'стекло',
    'защитн',
    'пленка',
    'плёнка',
    'чехол',
    'чехлы',
    'накладк',
    'зарядк',
    'сетев',
    'кабель',
    'провод',
    'держател',
    'ремеш',
    'адаптер',
    'переходник',
    'блок питания',
  ];
  return row.calculationType === 'RETAIL_ACCESSORY_5' || accessoryMarkers.some((marker) => text.includes(marker));
}

function isCreditTechDisplayRow(row: AnalyticsRow) {
  if (row.calculationType === 'CREDIT_GROSS_PROFIT') return true;
  const text = `${row.calculationType} ${row.componentType ?? ''} ${row.category ?? ''} ${row.itemName}`.toLowerCase();
  const techMarkers = [
    'смартфон',
    'iphone',
    'android',
    'телефон',
    'apple watch',
    'смарт-часы',
    'smart watch',
    'airpods',
    'приставк',
    'playstation',
    'ps5',
    'xbox',
    'бытовая техника',
    'пылесос',
    'парогенератор',
    'планшет',
    'ipad',
    'macbook',
  ];
  return techMarkers.some((marker) => text.includes(marker));
}

function getCreditProductGroup(row: AnalyticsRow): CreditProductSummary['group'] {
  if (isWorkServiceRow(row)) return 'service';
  if (isPlotterMaterialRow(row)) return 'plotterMaterial';
  if (isCreditAccessoryDisplayRow(row)) return 'accessory';
  if (isCreditTechDisplayRow(row)) return 'tech';
  return 'other';
}

function getBusinessGroup(row: AnalyticsRow) {
  if (isWorkServiceRow(row)) return 'Услуги / работы';
  if (isPlotterMaterialRow(row)) return 'Плоттерные материалы / антигравийка';
  if (row.isCredit && isAccessoryRow(row)) return 'Кредитные аксессуары';
  if (row.calculationType === 'WHOLESALE_INCLUDED_1_75' || isWholesaleText(row.department)) return 'Опт';
  if (isTechRow(row)) return 'Техника / смартфоны';
  if (isAccessoryRow(row)) return 'Аксессуары';
  return row.category || 'Прочее';
}

function isExcludedFromSalesEfficiency(employee: EmployeeResult) {
  const haystack = `${employee.employeeName} ${employee.department} ${employee.payrollDepartment} ${employee.position} ${employee.salaryType}`.toLowerCase();
  const excludedMarkers = [
    'кештова бэла',
    'финанс',
    'операцион',
    'закуп',
    'it',
    'техподдерж',
    'хозяй',
    'склад',
    'брак',
    'smm',
    'fixed_salary',
    'purchase_manager',
    'vl_percent',
  ];
  return excludedMarkers.some((marker) => haystack.includes(marker));
}

function getSalesProblemReasons(rows: AnalyticsRow[]) {
  const reasons = new Set<string>();

  rows.forEach((row) => {
    const flags = readFlags(row.problemFlags);
    if (row.grossProfit < 0 || flags.includes('negative-gross-profit')) reasons.add('отрицательная ВП');
    if (row.isReturn || row.isNegative || flags.includes('negative-revenue')) reasons.add('возврат / отрицательная строка');
    if (flags.includes('suspicious-tech-cost')) reasons.add('подозрительная себестоимость');
    if (flags.includes('requires-classification') || flags.includes('potential-accessory-not-included') || flags.includes('new-expensive-review')) reasons.add('спорная классификация');
  });

  return Array.from(reasons);
}

function buildCategorySummaries(rows: AnalyticsRow[]) {
  const groups = new Map<string, CategorySummary>();

  rows.forEach((row) => {
    const group = getBusinessGroup(row);
    const current = groups.get(group) ?? { group, rows: 0, revenue: 0, cost: 0, grossProfit: 0 };
    current.rows += 1;
    current.revenue += row.revenue;
    current.cost += row.cost;
    current.grossProfit += row.grossProfit;
    groups.set(group, current);
  });

  return Array.from(groups.values()).sort((left, right) => right.grossProfit - left.grossProfit);
}

function buildSalespeople(rows: AnalyticsRow[], employees: EmployeeResult[], sourceKind: SourceKind) {
  const employeeByName = new Map(employees.map((employee) => [employee.employeeName, employee]));
  const rowsByEmployee = new Map<string, AnalyticsRow[]>();
  const summaries = new Map<string, SalespersonSummary>();

  rows.forEach((row) => {
    rowsByEmployee.set(row.employeeName, [...(rowsByEmployee.get(row.employeeName) ?? []), row]);
  });

  rows.forEach((row) => {
    const employee = employeeByName.get(row.employeeName);
    if (sourceKind === 'payroll_snapshot' && (!employee || isExcludedFromSalesEfficiency(employee))) return;
    if (row.revenue === 0 && row.grossProfit === 0) return;

    const current = summaries.get(row.employeeName) ?? {
      employeeName: row.employeeName,
      direction: employee?.payrollDepartment || employee?.department || row.department || 'нет данных',
      rows: 0,
      revenue: 0,
      grossProfit: 0,
      creditRevenue: 0,
      grossPay: employee?.grossPay ?? 0,
      salesProblems: [],
    };

    current.rows += 1;
    current.revenue += row.revenue;
    current.grossProfit += row.grossProfit;
    if (row.isCredit) current.creditRevenue += row.revenue;
    current.salesProblems = getSalesProblemReasons(rowsByEmployee.get(row.employeeName) ?? []);
    summaries.set(row.employeeName, current);
  });

  return Array.from(summaries.values()).sort((left, right) => right.grossProfit - left.grossProfit);
}

function buildPriceControlRows(rows: AnalyticsRow[], sourceKind: SourceKind) {
  const rowsByProduct = new Map<string, AnalyticsRow[]>();

  rows.forEach((row) => {
    const key = row.article ? `article:${row.article}` : `item:${row.itemName.toLowerCase()}`;
    rowsByProduct.set(key, [...(rowsByProduct.get(key) ?? []), row]);
  });

  return rows
    .map((row): PriceControlRow | null => {
      const isExtendedReturn = sourceKind === 'extended_vgp' && row.calculationType === 'RETURN';
      const isExtendedSale = sourceKind !== 'extended_vgp' || row.calculationType === 'SALE' || row.calculationType === 'RETAIL_SALE';
      if (isExtendedReturn || !isExtendedSale) return null;

      const reasons: string[] = [];
      const rowMargin = margin(row.revenue, row.grossProfit);
      const rowMarkup = markup(row.cost, row.grossProfit);
      let severity = 99;

      if (row.grossProfit < 0 && (sourceKind !== 'extended_vgp' || row.revenue > 0)) {
        reasons.push(sourceKind === 'extended_vgp' ? 'Отрицательная ВП по продаже' : 'ВП отрицательная');
        severity = Math.min(severity, 1);
      }
      if (row.revenue < row.cost && (sourceKind !== 'extended_vgp' || row.revenue > 0)) {
        reasons.push(sourceKind === 'extended_vgp' ? 'Продажа ниже себестоимости' : 'Цена ниже себестоимости');
        severity = Math.min(severity, 2);
      }
      if (isTechRow(row) && rowMargin !== null && rowMargin < 10) {
        reasons.push(sourceKind === 'extended_vgp' && row.isCredit ? 'Кредитная продажа с низкой маржей' : sourceKind === 'extended_vgp' ? 'Низкая маржа техники' : 'Маржа техники < 10%');
        severity = Math.min(severity, 3);
      }
      if (isTechRow(row) && row.cost > 0 && rowMarkup !== null && rowMarkup < 10) {
        reasons.push('Наценка техники < 10%');
        severity = Math.min(severity, 4);
      }
      if (sourceKind === 'extended_vgp' && isTechRow(row) && row.revenue > 0 && row.cost === 0) {
        reasons.push('Проверить себестоимость');
        severity = Math.min(severity, 2);
      }

      if (row.quantity && row.quantity > 0) {
        const key = row.article ? `article:${row.article}` : `item:${row.itemName.toLowerCase()}`;
        const comparable = (rowsByProduct.get(key) ?? []).filter((item) => item.quantity && item.quantity > 0);
        if (comparable.length >= 3) {
          const avgPrice = comparable.reduce((sum, item) => sum + item.revenue / Number(item.quantity), 0) / comparable.length;
          const rowPrice = row.revenue / row.quantity;
          if (rowPrice < avgPrice * 0.75) {
            reasons.push('Цена ниже средней');
            severity = Math.min(severity, 5);
          }
        }
      }

      return reasons.length ? { row, reasons, severity } : null;
    })
    .filter((item): item is PriceControlRow => Boolean(item))
    .sort((left, right) => left.severity - right.severity || Math.abs(right.row.grossProfit) - Math.abs(left.row.grossProfit));
}

function buildCreditProductSummaries(rows: AnalyticsRow[]) {
  const summaries = new Map<string, CreditProductSummary>();

  rows.forEach((row) => {
    if (!row.isCredit) return;
    const group = getCreditProductGroup(row);
    const key = `${group}|${row.article || row.itemName}|${row.category || ''}`;
    const current = summaries.get(key) ?? {
      group,
      itemName: row.itemName,
      category: row.category || 'нет данных',
      rows: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      sellers: new Set<string>(),
    };
    current.rows += 1;
    current.revenue += row.revenue;
    current.cost += row.cost;
    current.grossProfit += row.grossProfit;
    current.sellers.add(row.employeeName);
    summaries.set(key, current);
  });

  return Array.from(summaries.values()).sort((left, right) => right.grossProfit - left.grossProfit).slice(0, 30);
}

function MetricCard({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <Card className='p-5'>
      <p className='text-sm font-bold text-slate-500'>{title}</p>
      <p className='mt-2 whitespace-nowrap text-2xl font-extrabold text-slate-950'>{value}</p>
      {note ? <p className='mt-1 text-xs font-medium leading-snug text-slate-500'>{note}</p> : null}
    </Card>
  );
}

function buildMonthInsights(rows: AnalyticsRow[], categories: CategorySummary[], priceRows: PriceControlRow[], creditRows: AnalyticsRow[]): MonthInsight[] {
  if (!rows.length) {
    return [{ status: 'Нет данных', title: 'Нет строк аналитики', text: 'Для выводов нужно пересохранить расчёт, чтобы появились analyticsRows.' }];
  }

  const totalRevenue = sumRows(rows, 'revenue');
  const totalGrossProfit = sumRows(rows, 'grossProfit');
  const avgMargin = margin(totalRevenue, totalGrossProfit);
  const topRevenueCategory = [...categories].sort((left, right) => right.revenue - left.revenue)[0];
  const topProfitCategory = [...categories].sort((left, right) => right.grossProfit - left.grossProfit)[0];
  const negativeProfitRows = priceRows.filter((item) => item.row.grossProfit < 0);
  const lowMarginTechRows = priceRows.filter((item) => isTechRow(item.row) && item.row.marginPercent !== null && item.row.marginPercent < 10);
  const creditTechLowMarginRows = creditRows.filter((row) => isCreditTechDisplayRow(row) && row.marginPercent !== null && row.marginPercent < 10);

  const insights: MonthInsight[] = [
    {
      status: totalGrossProfit < 0 ? 'Критично' : 'Хорошо',
      title: totalGrossProfit < 0 ? 'Месяц в минусе по ВП' : 'Месяц в плюсе по валовой прибыли',
      text: totalGrossProfit < 0 ? `ВП ${formatMoney(totalGrossProfit)} при выручке ${formatMoney(totalRevenue)}. Проверьте отрицательные строки и себестоимость.` : `ВП ${formatMoney(totalGrossProfit)} при выручке ${formatMoney(totalRevenue)}. Смотрите, какие категории дали основной вклад.`,
    },
    {
      status: avgMargin === null ? 'Нет данных' : avgMargin >= 20 ? 'Хорошо' : avgMargin >= 12 ? 'Нормально' : 'Проверить',
      title: 'Средняя маржа месяца',
      text: avgMargin === null ? 'Данных недостаточно для вывода по марже.' : `${formatPercent(avgMargin)}. Если маржа ниже ожиданий, начните с блока “Контроль цен и наценки”.`,
    },
  ];

  if (topRevenueCategory) {
    insights.push({
      status: 'Инфо',
      title: 'Основная выручка',
      text: `${topRevenueCategory.group}: ${formatMoney(topRevenueCategory.revenue)} (${formatPercent(margin(totalRevenue, topRevenueCategory.revenue))} выручки). Проверьте маржу этой категории.`,
    });
  }

  if (topProfitCategory) {
    insights.push({
      status: 'Инфо',
      title: 'Основная валовая прибыль',
      text: `${topProfitCategory.group}: ${formatMoney(topProfitCategory.grossProfit)} (${formatPercent(margin(totalGrossProfit, topProfitCategory.grossProfit))} ВП). Используйте это как главный драйвер месяца.`,
    });
  }

  if (negativeProfitRows.length || lowMarginTechRows.length || creditTechLowMarginRows.length) {
    insights.push({
      status: negativeProfitRows.length ? 'Критично' : 'Проверить',
      title: 'Есть строки для контроля цены',
      text: `${negativeProfitRows.length} с отрицательной ВП, ${lowMarginTechRows.length} техники с маржей ниже 10%, ${creditTechLowMarginRows.length} кредитной техники с низкой маржей. Проверьте топ-20 строк в блоке “Контроль цен и наценки”.`,
    });
  }

  return insights.slice(0, 5);
}

function MonthInsights({ insights }: { insights: MonthInsight[] }) {
  return (
    <Card className='mb-5 p-4'>
      <div className='mb-3 flex items-center justify-between gap-3'>
        <h2 className='text-lg font-extrabold text-slate-950'>Краткий вывод месяца</h2>
        <span className='text-xs font-semibold uppercase text-slate-400'>автоматическая интерпретация</span>
      </div>
      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
        {insights.map((insight) => (
          <div key={`${insight.title}-${insight.text}`} className='rounded-lg border border-slate-200/80 bg-slate-50 px-4 py-3'>
            <div className='mb-2 flex items-center gap-2'>
              <StatusBadge status={insight.status} />
              <p className='font-bold text-slate-950'>{insight.title}</p>
            </div>
            <p className='text-sm font-medium leading-relaxed text-slate-600'>{insight.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReadingHelp() {
  return (
    <details className='mt-3 w-fit rounded-lg border border-slate-200/80 bg-white px-4 py-2 text-sm shadow-sm'>
      <summary className='cursor-pointer font-bold text-primary'>Как читать маржу и наценку</summary>
      <div className='mt-2 max-w-2xl space-y-1 text-sm font-medium leading-relaxed text-slate-600'>
        <p>Маржа — какая часть цены продажи осталась валовой прибылью.</p>
        <p>Наценка — насколько цена продажи выше себестоимости.</p>
        <p>Для контроля цен важны обе цифры: маржа показывает прибыльность продажи, наценка показывает, насколько цена выше закупки.</p>
      </div>
    </details>
  );
}

function MoneyCell({ value, danger = false, strong = false }: { value: number | null | undefined; danger?: boolean; strong?: boolean }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-right ${danger ? 'text-red-700' : strong ? 'text-slate-950' : 'text-slate-800'} font-semibold`}>{formatMoney(value)}</td>;
}

function PercentCell({ value, danger = false }: { value: number | null | undefined; danger?: boolean }) {
  return <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${danger ? 'text-red-700' : 'text-slate-800'}`}>{formatPercent(value)}</td>;
}

function SalesOverview({ rows, totalGrossPay, totalNetPay, sourceKind }: { rows: AnalyticsRow[]; totalGrossPay: number; totalNetPay: number; sourceKind: SourceKind }) {
  const creditRows = rows.filter((row) => row.isCredit);
  const regularRows = rows.filter((row) => !row.isCredit);
  const returnRows = rows.filter((row) => row.isReturn);
  const negativeRows = rows.filter((row) => row.isNegative);
  const totalRevenue = sumRows(rows, 'revenue');
  const totalGrossProfit = sumRows(rows, 'grossProfit');
  const creditRevenue = sumRows(creditRows, 'revenue');
  const creditGrossProfit = sumRows(creditRows, 'grossProfit');
  const regularRevenue = sumRows(regularRows, 'revenue');
  const regularGrossProfit = sumRows(regularRows, 'grossProfit');
  const totalQuantity = rows.reduce((total, row) => total + (typeof row.quantity === 'number' ? row.quantity : 0), 0);

  return (
    <section className='mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
      <MetricCard title='Общая выручка' value={formatMoney(totalRevenue)} note={`${formatNumber(rows.length)} строк продаж`} />
      <MetricCard title='Валовая прибыль' value={formatMoney(totalGrossProfit)} note={`Средняя маржа: ${formatPercent(margin(totalRevenue, totalGrossProfit))}`} />
      <MetricCard title={sourceKind === 'extended_vgp' ? 'Выручка без возвратов' : 'Кредитная выручка'} value={formatMoney(sourceKind === 'extended_vgp' ? rows.filter((row) => !row.isReturn).reduce((sum, row) => sum + row.revenue, 0) : creditRevenue)} note={sourceKind === 'extended_vgp' ? `${formatNumber(returnRows.length)} RETURN-строк` : `Доля кредитов: ${formatPercent(margin(totalRevenue, creditRevenue))}`} />
      <MetricCard title={sourceKind === 'extended_vgp' ? 'Количество товаров' : 'ВП по кредитам'} value={sourceKind === 'extended_vgp' ? formatNumber(totalQuantity) : formatMoney(creditGrossProfit)} note={sourceKind === 'extended_vgp' ? `${formatNumber(negativeRows.length)} отрицательных строк` : `Не кредит: ${formatMoney(regularGrossProfit)}`} />
      <MetricCard title={sourceKind === 'extended_vgp' ? 'Возвраты RETURN' : 'Выручка без кредитов'} value={sourceKind === 'extended_vgp' ? formatNumber(returnRows.length) : formatMoney(regularRevenue)} note={sourceKind === 'extended_vgp' ? `Доля: ${formatPercent(margin(rows.length, returnRows.length))}` : `${formatNumber(regularRows.length)} строк`} />
      {sourceKind === 'payroll_snapshot' ? (
        <>
          <MetricCard title='Начислено сотрудникам' value={formatMoney(totalGrossPay)} note={`Доля от ВП: ${formatPercent(margin(totalGrossProfit, totalGrossPay))}`} />
          <MetricCard title='К выплате' value={formatMoney(totalNetPay)} note='После авансов и удержаний' />
          <MetricCard title='Источник' value='payroll snapshot' note='Read-only данные сохранённого расчёта' />
        </>
      ) : (
        <>
          <MetricCard title='Строк продаж' value={formatNumber(rows.length)} note='Расширенный ВВП, без зарплатных расчётов' />
          <MetricCard title='Средняя маржа' value={formatPercent(margin(totalRevenue, totalGrossProfit))} note='По строкам расширенного ВВП' />
          <MetricCard title='Источник' value='extended_vgp' note='Не влияет на расчёт зарплаты' />
        </>
      )}
    </section>
  );
}

function CategoryTable({ summaries, totalRevenue, totalGrossProfit, sourceKind }: { summaries: CategorySummary[]; totalRevenue: number; totalGrossProfit: number; sourceKind: SourceKind }) {
  const topRevenue = [...summaries].sort((left, right) => right.revenue - left.revenue)[0];
  const topProfit = [...summaries].sort((left, right) => right.grossProfit - left.grossProfit)[0];
  const highRevenueWeakMargin = summaries.find((item) => totalRevenue > 0 && item.revenue / totalRevenue >= 0.15 && (margin(item.revenue, item.grossProfit) ?? 100) < 12);
  const smallerStrongMargin = summaries.find((item) => totalRevenue > 0 && item.revenue / totalRevenue < 0.15 && (margin(item.revenue, item.grossProfit) ?? 0) >= 25);

  return (
    <Card className='mb-5 p-0'>
      <div className='border-b border-slate-200/80 px-5 py-4'>
        <h2 className='text-lg font-extrabold text-slate-950'>Продажи по категориям</h2>
        <p className='mt-1 text-sm font-medium text-slate-500'>
          {sourceKind === 'extended_vgp' ? 'Группировка по категориям расширенного ВВП.' : 'Группировка по бизнес-направлениям на основе сохранённых calculationType/category.'}
        </p>
      </div>
      {summaries.length ? (
        <div className='grid gap-3 border-b border-slate-200/80 p-4 md:grid-cols-2 xl:grid-cols-4'>
          {topRevenue ? <p className='rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600'><span className='font-bold text-slate-950'>Основная выручка:</span> {topRevenue.group}.</p> : null}
          {topProfit ? <p className='rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600'><span className='font-bold text-slate-950'>Основная ВП:</span> {topProfit.group}.</p> : null}
          {highRevenueWeakMargin ? <p className='rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800'><span className='font-bold'>Высокая выручка, слабая маржа:</span> {highRevenueWeakMargin.group}.</p> : null}
          {smallerStrongMargin ? <p className='rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800'><span className='font-bold'>Небольшая выручка, хорошая маржа:</span> {smallerStrongMargin.group}.</p> : null}
        </div>
      ) : null}
      <Table>
        <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
          <tr>
            <th className='px-4 py-3'>Категория / направление</th>
            <th className='px-4 py-3 text-right'>Строк</th>
            <th className='px-4 py-3 text-right'>Выручка</th>
            <th className='px-4 py-3 text-right'>Себестоимость</th>
            <th className='px-4 py-3 text-right'>ВП</th>
            <th className='px-4 py-3 text-right'>Маржа</th>
            <th className='px-4 py-3 text-right'>Наценка</th>
            <th className='px-4 py-3 text-right'>Доля выручки</th>
            <th className='px-4 py-3 text-right'>Доля ВП</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((item) => (
            <tr key={item.group} className='border-t border-slate-200/80'>
              <td className='px-4 py-3 font-bold text-slate-950'>{item.group}</td>
              <td className='whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800'>{formatNumber(item.rows)}</td>
              <MoneyCell value={item.revenue} />
              <MoneyCell value={item.cost} />
              <MoneyCell value={item.grossProfit} strong />
              <PercentCell value={margin(item.revenue, item.grossProfit)} />
              <PercentCell value={markup(item.cost, item.grossProfit)} />
              <PercentCell value={margin(totalRevenue, item.revenue)} />
              <PercentCell value={margin(totalGrossProfit, item.grossProfit)} />
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function SalespeopleTable({ salespeople, sourceKind }: { salespeople: SalespersonSummary[]; sourceKind: SourceKind }) {
  const showDirection = sourceKind === 'payroll_snapshot' || salespeople.some((item) => item.direction && item.direction !== 'нет данных');

  return (
    <Card className='mb-5 p-0'>
      <div className='border-b border-slate-200/80 px-5 py-4'>
        <h2 className='text-lg font-extrabold text-slate-950'>Эффективность продажников</h2>
        <p className='mt-1 text-sm font-medium text-slate-500'>Продажная аналитика без сотрудников, которые не участвуют в продажах.</p>
      </div>
      {salespeople.length ? (
        <Table>
          <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
            <tr>
              <th className='px-4 py-3'>Сотрудник</th>
              {showDirection ? <th className='px-4 py-3'>Направление</th> : null}
              <th className='px-4 py-3 text-right'>Выручка</th>
              <th className='px-4 py-3 text-right'>ВП</th>
              <th className='px-4 py-3 text-right'>Маржа</th>
              <th className='px-4 py-3 text-right'>Строк</th>
              <th className='px-4 py-3 text-right'>Средняя продажа</th>
              <th className='px-4 py-3 text-right'>Доля кредитов</th>
              {sourceKind === 'payroll_snapshot' ? (
                <>
                  <th className='px-4 py-3 text-right'>Начислено</th>
                  <th className='px-4 py-3 text-right'>Начислено от ВП</th>
                </>
              ) : null}
              <th className='px-4 py-3'>Проблемы продаж</th>
            </tr>
          </thead>
          <tbody>
            {salespeople.map((item) => (
              <tr key={item.employeeName} className='border-t border-slate-200/80 align-top'>
                <td className='px-4 py-3 font-bold text-slate-950'>{item.employeeName}</td>
                {showDirection ? <td className='px-4 py-3 text-slate-600'>{item.direction}</td> : null}
                <MoneyCell value={item.revenue} />
                <MoneyCell value={item.grossProfit} strong />
                <PercentCell value={margin(item.revenue, item.grossProfit)} />
                <td className='whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800'>{formatNumber(item.rows)}</td>
                <MoneyCell value={item.rows ? item.revenue / item.rows : null} />
                <PercentCell value={margin(item.revenue, item.creditRevenue)} />
                {sourceKind === 'payroll_snapshot' ? (
                  <>
                    <MoneyCell value={item.grossPay} />
                    <PercentCell value={margin(item.grossProfit, item.grossPay)} />
                  </>
                ) : null}
                <td className='px-4 py-3'>
                  {item.salesProblems.length ? (
                    <Badge className='bg-amber-100 text-amber-800'>Проверить</Badge>
                  ) : (
                    <Badge className='bg-green-100 text-green-800'>OK</Badge>
                  )}
                  {item.salesProblems.length ? <p className='mt-1 text-xs font-medium text-slate-500'>{item.salesProblems.join(' · ')}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className='px-5 py-8 text-sm font-medium text-slate-500'>Нет строк продаж для таблицы эффективности. Нужен сохранённый расчёт с analyticsRows.</p>
      )}
    </Card>
  );
}

function PriceControlTable({ rows, sourceKind }: { rows: PriceControlRow[]; sourceKind: SourceKind }) {
  const showDocumentColumns = sourceKind === 'extended_vgp';

  return (
    <Table>
      <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
        <tr>
          <th className='px-4 py-3'>Сотрудник</th>
          {showDocumentColumns ? <th className='px-4 py-3'>Дата</th> : null}
          {showDocumentColumns ? <th className='px-4 py-3'>Тип документа</th> : null}
          {showDocumentColumns ? <th className='px-4 py-3'>Документ</th> : null}
          {showDocumentColumns ? <th className='px-4 py-3'>Клиент</th> : null}
          <th className='px-4 py-3'>Товар</th>
          <th className='px-4 py-3'>Артикул</th>
          <th className='px-4 py-3'>Категория</th>
          {showDocumentColumns ? <th className='px-4 py-3 text-right'>Кол-во</th> : null}
          {showDocumentColumns ? <th className='px-4 py-3'>Кредит</th> : null}
          <th className='px-4 py-3 text-right'>Выручка</th>
          <th className='px-4 py-3 text-right'>Себестоимость</th>
          <th className='px-4 py-3 text-right'>ВП</th>
          <th className='px-4 py-3 text-right'>Маржа</th>
          <th className='px-4 py-3 text-right'>Наценка</th>
          <th className='px-4 py-3'>Причина</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ row, reasons }) => (
          <tr key={row.id} className='border-t border-slate-200/80 align-top'>
            <td className='px-4 py-3 font-bold text-slate-950'>{row.employeeName}</td>
            {showDocumentColumns ? <td className='whitespace-nowrap px-4 py-3 text-slate-600'>{formatDate(row.documentDate)}</td> : null}
            {showDocumentColumns ? <td className='whitespace-nowrap px-4 py-3 font-semibold text-slate-700'>{row.calculationType}</td> : null}
            {showDocumentColumns ? <td className='min-w-[220px] px-4 py-3 text-slate-600'>{row.documentName || 'нет данных'}</td> : null}
            {showDocumentColumns ? <td className='min-w-[180px] px-4 py-3 text-slate-600'>{row.client || 'нет данных'}</td> : null}
            <td className='min-w-[240px] px-4 py-3 font-semibold text-slate-900'>{row.itemName}</td>
            <td className='whitespace-nowrap px-4 py-3 text-slate-600'>{row.article || 'нет данных'}</td>
            <td className='px-4 py-3 text-slate-600'>{row.category || 'нет данных'}</td>
            {showDocumentColumns ? <td className='whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800'>{formatNumber(row.quantity)}</td> : null}
            {showDocumentColumns ? <td className='whitespace-nowrap px-4 py-3'>{row.isCredit ? <Badge className='bg-blue-100 text-blue-800'>кредит</Badge> : <span className='text-slate-400'>нет</span>}</td> : null}
            <MoneyCell value={row.revenue} />
            <MoneyCell value={row.cost} />
            <MoneyCell value={row.grossProfit} danger={row.grossProfit < 0} />
            <PercentCell value={row.marginPercent} danger={row.marginPercent !== null && row.marginPercent < 10} />
            <PercentCell value={row.markupPercent} danger={row.markupPercent !== null && row.markupPercent < 10} />
            <td className='px-4 py-3 text-slate-600'>{reasons.join(' · ')}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function PriceControl({ rows, sourceRows, sourceKind }: { rows: PriceControlRow[]; sourceRows: AnalyticsRow[]; sourceKind: SourceKind }) {
  const topRows = rows.slice(0, 20);
  const hiddenRows = rows.slice(20);
  const hiddenPreviewRows = hiddenRows.slice(0, 200);
  const returnRowsCount = sourceKind === 'extended_vgp'
    ? sourceRows.filter((row) => row.calculationType === 'RETURN').length
    : sourceRows.filter((row) => row.isReturn).length;
  const negativeNonReturnCount = sourceRows.filter((row) => row.calculationType !== 'RETURN' && (row.isNegative || row.revenue < 0 || row.grossProfit < 0)).length;

  return (
    <Card className='mb-5 p-0'>
      <div className='border-b border-slate-200/80 px-5 py-4'>
        <h2 className='text-lg font-extrabold text-slate-950'>Контроль цен и наценки</h2>
        <p className='mt-1 text-sm font-medium text-slate-500'>
          {sourceKind === 'extended_vgp'
            ? 'В этот блок не входят документы RETURN. Здесь показаны продажи, где цена/маржа выглядят проблемно: продажа ниже себестоимости, отрицательная ВП или низкая маржа.'
            : 'Топ-20 самых критичных продаж. Порог 10% — предварительный контроль для техники/смартфонов; строки попадают сюда из-за отрицательной ВП, цены ниже себестоимости, низкой маржи или низкой наценки.'}
        </p>
        {sourceKind === 'extended_vgp' ? (
          <div className='mt-3 flex flex-wrap gap-2'>
            <Badge className='bg-slate-100 text-slate-700'>Возвраты RETURN: {returnRowsCount}</Badge>
            <Badge className={rows.length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>Проблемные продажи без RETURN: {rows.length}</Badge>
            <Badge className={negativeNonReturnCount ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>Отрицательные строки вне RETURN: {negativeNonReturnCount}</Badge>
          </div>
        ) : null}
      </div>
      {rows.length ? (
        <>
          <PriceControlTable rows={topRows} sourceKind={sourceKind} />
          {hiddenRows.length ? (
            <details className='border-t border-slate-200/80'>
              <summary className='cursor-pointer px-5 py-4 text-sm font-bold text-primary hover:bg-slate-50'>Показать дополнительные подозрительные продажи ({hiddenRows.length}, на экране первые {hiddenPreviewRows.length})</summary>
              <PriceControlTable rows={hiddenPreviewRows} sourceKind={sourceKind} />
            </details>
          ) : null}
        </>
      ) : (
        <p className='px-5 py-8 text-sm font-medium text-slate-500'>Подозрительных продаж по текущим порогам не найдено.</p>
      )}
    </Card>
  );
}

function CreditProductsTable({ products }: { products: CreditProductSummary[] }) {
  if (!products.length) return <p className='px-5 py-4 text-sm font-medium text-slate-500'>Нет строк в этой группе.</p>;

  return (
    <Table>
      <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
        <tr>
          <th className='px-4 py-3'>Товар</th>
          <th className='px-4 py-3'>Категория</th>
          <th className='px-4 py-3 text-right'>Строк</th>
          <th className='px-4 py-3 text-right'>Выручка</th>
          <th className='px-4 py-3 text-right'>Себестоимость</th>
          <th className='px-4 py-3 text-right'>ВП</th>
          <th className='px-4 py-3 text-right'>Маржа</th>
          <th className='px-4 py-3 text-right'>Наценка</th>
          <th className='px-4 py-3'>Продавцы</th>
        </tr>
      </thead>
      <tbody>
        {products.map((item) => (
          <tr key={`${item.group}-${item.itemName}-${item.category}`} className='border-t border-slate-200/80 align-top'>
            <td className='min-w-[240px] px-4 py-3 font-bold text-slate-950'>{item.itemName}</td>
            <td className='px-4 py-3 text-slate-600'>{item.category}</td>
            <td className='whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-800'>{formatNumber(item.rows)}</td>
            <MoneyCell value={item.revenue} />
            <MoneyCell value={item.cost} />
            <MoneyCell value={item.grossProfit} strong />
            <PercentCell value={margin(item.revenue, item.grossProfit)} />
            <PercentCell value={markup(item.cost, item.grossProfit)} />
            <td className='px-4 py-3 text-slate-600'>{Array.from(item.sellers).join(', ')}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function CreditSales({ rows, products }: { rows: AnalyticsRow[]; products: CreditProductSummary[] }) {
  const techRows = rows.filter((row) => getCreditProductGroup(row) === 'tech');
  const accessoryRows = rows.filter((row) => getCreditProductGroup(row) === 'accessory');
  const serviceRows = rows.filter((row) => getCreditProductGroup(row) === 'service');
  const plotterMaterialRows = rows.filter((row) => getCreditProductGroup(row) === 'plotterMaterial');
  const lowMarginTechRows = techRows.filter((row) => row.marginPercent !== null && row.marginPercent < 10);
  const techProducts = products.filter((item) => item.group === 'tech');
  const accessoryProducts = products.filter((item) => item.group === 'accessory');
  const serviceProducts = products.filter((item) => item.group === 'service');
  const plotterMaterialProducts = products.filter((item) => item.group === 'plotterMaterial');
  const otherProducts = products.filter((item) => item.group === 'other');
  const revenue = sumRows(rows, 'revenue');
  const cost = sumRows(rows, 'cost');
  const grossProfit = sumRows(rows, 'grossProfit');

  return (
    <Card className='mb-5 p-0'>
      <div className='border-b border-slate-200/80 px-5 py-4'>
        <h2 className='text-lg font-extrabold text-slate-950'>Кредитные продажи</h2>
        <p className='mt-1 text-sm font-medium text-slate-500'>Сводка по кредитным строкам без вывода сырого списка первым экраном.</p>
      </div>
      <div className='grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4'>
        <MetricCard title='Кредитных строк' value={formatNumber(rows.length)} note={`${formatNumber(techRows.length)} техника · ${formatNumber(accessoryRows.length)} аксессуары · ${formatNumber(serviceRows.length)} работы · ${formatNumber(plotterMaterialRows.length)} материалы`} />
        <MetricCard title='Выручка кредитов' value={formatMoney(revenue)} note={`Себестоимость: ${formatMoney(cost)}`} />
        <MetricCard title='ВП кредитов' value={formatMoney(grossProfit)} note={`Маржа: ${formatPercent(margin(revenue, grossProfit))}`} />
        <MetricCard title='Средняя наценка' value={formatPercent(markup(cost, grossProfit))} note='ВП / себестоимость' />
      </div>
      {rows.length ? (
        <div className='grid gap-3 border-t border-slate-200/80 px-5 py-4 md:grid-cols-3'>
          <p className='rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600'>
            <span className='font-bold text-slate-950'>Кредиты:</span> средняя маржа {formatPercent(margin(revenue, grossProfit))}.
          </p>
          <p className={lowMarginTechRows.length ? 'rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800' : 'rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800'}>
            <span className='font-bold'>Кредитная техника:</span> {lowMarginTechRows.length ? `${lowMarginTechRows.length} строк с маржей ниже 10% — стоит проверить.` : 'низкая маржа не найдена.'}
          </p>
          <p className='rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600'>
            <span className='font-bold text-slate-950'>Кредитные аксессуары:</span> {accessoryRows.length ? `${accessoryRows.length} строк, это не ошибка само по себе.` : 'не найдены.'}
          </p>
        </div>
      ) : null}
      {products.length ? (
        <div className='divide-y divide-slate-200/80'>
          <section>
            <div className='px-5 py-3'>
              <h3 className='font-extrabold text-slate-950'>Кредитная техника / смартфоны</h3>
              <p className='text-sm font-medium text-slate-500'>Сначала товары, которые выглядят как техника или идут по кредитной технике.</p>
            </div>
            <CreditProductsTable products={techProducts} />
          </section>
          <section>
            <div className='px-5 py-3'>
              <h3 className='font-extrabold text-slate-950'>Кредитные аксессуары</h3>
            </div>
            <CreditProductsTable products={accessoryProducts} />
          </section>
          {serviceProducts.length ? (
            <section>
              <div className='px-5 py-3'>
                <h3 className='font-extrabold text-slate-950'>Кредитные услуги / работы</h3>
              </div>
              <CreditProductsTable products={serviceProducts} />
            </section>
          ) : null}
          {plotterMaterialProducts.length ? (
            <section>
              <div className='px-5 py-3'>
                <h3 className='font-extrabold text-slate-950'>Кредитные плоттерные материалы / антигравийка</h3>
              </div>
              <CreditProductsTable products={plotterMaterialProducts} />
            </section>
          ) : null}
          {otherProducts.length ? (
            <section>
              <div className='px-5 py-3'>
                <h3 className='font-extrabold text-slate-950'>Прочие кредитные товары</h3>
              </div>
              <CreditProductsTable products={otherProducts} />
            </section>
          ) : null}
        </div>
      ) : null}
      <details className='border-t border-slate-200/80'>
        <summary className='cursor-pointer px-5 py-4 text-sm font-bold text-primary hover:bg-slate-50'>Показать кредитные строки</summary>
        <RawRows rows={rows.slice(0, 200)} />
      </details>
    </Card>
  );
}

function RawRows({ rows }: { rows: AnalyticsRow[] }) {
  return (
    <Table>
      <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
        <tr>
          <th className='px-4 py-3'>Сотрудник</th>
          <th className='px-4 py-3'>Клиент</th>
          <th className='px-4 py-3'>Категория</th>
          <th className='px-4 py-3'>Товар</th>
          <th className='px-4 py-3'>Артикул</th>
          <th className='px-4 py-3 text-right'>Выручка</th>
          <th className='px-4 py-3 text-right'>Себестоимость</th>
          <th className='px-4 py-3 text-right'>ВП</th>
          <th className='px-4 py-3 text-right'>Маржа</th>
          <th className='px-4 py-3 text-right'>Наценка</th>
          <th className='px-4 py-3'>Тип / флаги</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className='border-t border-slate-200/80 align-top'>
            <td className='px-4 py-3 font-bold text-slate-950'>{row.employeeName}</td>
            <td className='px-4 py-3 text-slate-600'>{row.client || 'нет данных'}</td>
            <td className='px-4 py-3 text-slate-600'>{row.category || 'нет данных'}</td>
            <td className='min-w-[240px] px-4 py-3 font-semibold text-slate-900'>{row.itemName}</td>
            <td className='whitespace-nowrap px-4 py-3 text-slate-600'>{row.article || 'нет данных'}</td>
            <MoneyCell value={row.revenue} />
            <MoneyCell value={row.cost} />
            <MoneyCell value={row.grossProfit} danger={row.grossProfit < 0} />
            <PercentCell value={row.marginPercent} />
            <PercentCell value={row.markupPercent} />
            <td className='min-w-[220px] px-4 py-3 text-slate-600'>
              <p>{row.calculationType}</p>
              <p className='mt-1 text-xs font-medium text-slate-500'>{readFlags(row.problemFlags).join(' · ') || row.checkReason || 'нет флагов'}</p>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function DataQuality({ rows, reviewEmployees, sourceKind }: { rows: AnalyticsRow[]; reviewEmployees: ReturnType<typeof readReviewEmployees>; sourceKind: SourceKind }) {
  const manualRuleRows = rows.filter((row) => row.isManualRuleApplied || readFlags(row.problemFlags).includes('manual-rule'));
  const suspiciousCostRows = rows.filter((row) => readFlags(row.problemFlags).includes('suspicious-tech-cost'));
  const disputedRows = rows.filter((row) => readFlags(row.problemFlags).some((flag) => flag === 'requires-classification' || flag === 'potential-accessory-not-included' || flag === 'new-expensive-review'));
  const creditRows = rows.filter((row) => row.isCredit);
  const sections = sourceKind === 'extended_vgp'
    ? [
      { title: 'Возвраты RETURN', rows: rows.filter((row) => row.calculationType === 'RETURN' || row.isReturn) },
      { title: 'Отрицательные строки вне RETURN', rows: rows.filter((row) => row.calculationType !== 'RETURN' && (row.isNegative || row.revenue < 0 || row.grossProfit < 0)) },
      { title: 'UNKNOWN documentType', rows: rows.filter((row) => row.calculationType === 'UNKNOWN') },
      { title: 'Подозрительная себестоимость', rows: suspiciousCostRows },
      { title: 'Спорные категории', rows: disputedRows },
      { title: 'Кредитные строки', rows: creditRows },
    ]
    : [
      { title: 'Отрицательная ВП', rows: rows.filter((row) => row.grossProfit < 0 || readFlags(row.problemFlags).includes('negative-gross-profit')) },
      { title: 'Возвраты / отрицательные строки', rows: rows.filter((row) => row.isReturn || row.isNegative) },
      { title: 'Ручные правила классификации', rows: manualRuleRows },
      { title: 'Подозрительная себестоимость', rows: suspiciousCostRows },
      { title: 'Спорные категории', rows: disputedRows },
      { title: 'Кредитные строки', rows: creditRows },
    ];

  return (
    <Card className='p-0'>
      <div className='border-b border-slate-200/80 px-5 py-4'>
        <div className='flex items-center gap-3'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700'>
            <FileWarning className='h-5 w-5' />
          </div>
          <div>
            <h2 className='text-lg font-extrabold text-slate-950'>Качество данных / контроль</h2>
            <p className='text-sm font-medium text-slate-500'>
              {sourceKind === 'extended_vgp'
                ? 'Возвраты определяются по documentType RETURN. Отрицательные строки вне RETURN и подозрительная себестоимость выводятся как контроль качества данных.'
                : 'Технические флаги ниже бизнес-аналитики. Возвраты сейчас определяются по отрицательным строкам ВВП. Для точного анализа возвратов нужен отдельный расширенный отчёт с документами реализации/возврата.'}
            </p>
          </div>
        </div>
      </div>
      <div className='grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3'>
        {sections.map((section) => (
          <details key={section.title} className='rounded-lg border border-slate-200/80 bg-slate-50'>
            <summary className='flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-bold text-slate-950'>
              {section.title}
              <Badge className={section.rows.length ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>{section.rows.length}</Badge>
            </summary>
            {section.rows.length ? <RawRows rows={section.rows.slice(0, 100)} /> : null}
          </details>
        ))}
      </div>
      {reviewEmployees.length ? (
        <div className='border-t border-slate-200/80 px-5 py-4'>
          <h3 className='font-extrabold text-slate-950'>Сотрудники на проверке по payroll snapshot</h3>
          <div className='mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {reviewEmployees.map((employee) => (
              <div key={employee.employeeName} className='rounded-lg border border-slate-200/80 bg-white px-4 py-3'>
                <p className='font-bold text-slate-950'>{employee.employeeName}</p>
                <p className='mt-1 text-sm font-medium text-slate-500'>{employee.reasons.join(' · ') || 'Причина не сохранена'}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function getSourceMode(value: unknown): SourceMode {
  return value === 'extended_vgp' || value === 'payroll_snapshot' ? value : 'auto';
}

function SourceControls({ period, sourceMode, periods }: { period: string; sourceMode: SourceMode; periods: string[] }) {
  return (
    <form key={`${period}-${sourceMode}`} className='mt-4 grid gap-3 md:grid-cols-[180px_220px_auto] md:items-end'>
      <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
        Период
        <input
          name='period'
          type='month'
          defaultValue={period}
          list='analytics-periods'
          className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
        />
        <datalist id='analytics-periods'>
          {periods.map((item) => <option key={item} value={item} />)}
        </datalist>
      </label>
      <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
        Источник
        <select
          name='source'
          defaultValue={sourceMode}
          className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
        >
          <option value='auto'>Авто</option>
          <option value='extended_vgp'>Расширенный ВВП</option>
          <option value='payroll_snapshot'>Payroll snapshot</option>
        </select>
      </label>
      <button className='h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary/90'>
        Обновить
      </button>
    </form>
  );
}

type PageSearchParams = {
  period?: string;
  source?: string;
};

export default async function AdminAnalyticsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const sourceMode = getSourceMode(searchParams?.source);
  const [latestExtendedHeader, latestRunForDefault, periods] = await Promise.all([
    getLatestExtendedReportHeader(),
    getLatestPayrollRun(),
    getAvailablePeriods(),
  ]);
  const selectedPeriod = typeof searchParams?.period === 'string' && /^\d{4}-\d{2}$/.test(searchParams.period)
    ? searchParams.period
    : latestExtendedHeader?.period || latestRunForDefault?.period.periodKey || new Date().toISOString().slice(0, 7);

  const [extendedReport, payrollRun] = await Promise.all([
    sourceMode === 'payroll_snapshot' ? Promise.resolve(null) : getExtendedReport(selectedPeriod),
    sourceMode === 'extended_vgp' ? Promise.resolve(null) : getLatestPayrollRun(selectedPeriod),
  ]);

  const activeSourceKind: SourceKind | null = sourceMode === 'extended_vgp'
    ? (extendedReport ? 'extended_vgp' : null)
    : sourceMode === 'payroll_snapshot'
      ? (payrollRun ? 'payroll_snapshot' : null)
      : extendedReport
        ? 'extended_vgp'
        : payrollRun
          ? 'payroll_snapshot'
          : null;

  const activeExtendedReport = activeSourceKind === 'extended_vgp' ? extendedReport : null;
  const activePayrollRun = activeSourceKind === 'payroll_snapshot' ? payrollRun : null;
  const employees = activePayrollRun?.employeeResults ?? [];
  const rows = activeExtendedReport
    ? normalizeExtendedRows(activeExtendedReport.rows)
    : activePayrollRun
      ? normalizePayrollRows(activePayrollRun.analyticsRows)
      : [];
  const hasRows = rows.length > 0;
  const summary = asObject(activePayrollRun?.sourceSummary);
  const fallbackRevenue = readNumber(summary, 'totalRevenue') ?? sumEmployees(employees, 'revenue');
  const fallbackGrossProfit = readNumber(summary, 'totalGrossProfit') ?? sumEmployees(employees, 'grossProfit');
  const totalRevenue = hasRows ? sumRows(rows, 'revenue') : fallbackRevenue;
  const totalGrossProfit = hasRows ? sumRows(rows, 'grossProfit') : fallbackGrossProfit;
  const totalGrossPay = activePayrollRun ? activePayrollRun.grossPay || sumEmployees(employees, 'grossPay') : 0;
  const totalNetPay = activePayrollRun ? activePayrollRun.netPay || sumEmployees(employees, 'netPay') : 0;
  const categorySummaries = hasRows ? buildCategorySummaries(rows) : [];
  const salespeople = hasRows && activeSourceKind ? buildSalespeople(rows, employees, activeSourceKind) : [];
  const priceControlRows = hasRows && activeSourceKind ? buildPriceControlRows(rows, activeSourceKind) : [];
  const creditRows = rows.filter((row) => row.isCredit);
  const creditProducts = buildCreditProductSummaries(rows);
  const monthInsights = buildMonthInsights(rows, categorySummaries, priceControlRows, creditRows);
  const reviewEmployees = activePayrollRun ? readReviewEmployees(summary) : [];
  const latestFile = activePayrollRun?.sourceFiles[activePayrollRun.sourceFiles.length - 1];
  const sourceTitle = activeExtendedReport
    ? 'extended_vgp · ' + activeExtendedReport.period + ' · файл ' + activeExtendedReport.fileName
    : activePayrollRun
      ? 'payroll snapshot · ' + activePayrollRun.period.periodKey + ' · расчёт №' + activePayrollRun.runNumber
      : 'Источник не найден';
  const sourceSubtitle = activeExtendedReport
    ? 'Обновлён: ' + formatDateTime(activeExtendedReport.uploadedAt) + ' · ' + formatNumber(activeExtendedReport.rowsCount) + ' строк · не влияет на зарплату'
    : activePayrollRun
      ? 'Обновлён: ' + formatDateTime(activePayrollRun.createdAt) + (latestFile ? ' · файл: ' + latestFile.originalName : '')
      : 'За период ' + selectedPeriod + ' нет данных выбранного источника.';

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Аналитика' />
      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>Аналитика продаж</h1>
          <p className='mt-1 text-base font-medium text-slate-500'>Продажи месяца по выбранному read-only источнику для аналитики продаж.</p>
          <ReadingHelp />
        </div>
        <Link href='/admin/payroll' className='inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-primary ring-1 ring-green-200 transition hover:bg-green-50'>
          Открыть зарплату
          <ChevronRight className='h-4 w-4' />
        </Link>
      </div>

      <Card className='mb-5 p-5'>
        <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
          <div>
            <p className='text-sm font-bold uppercase tracking-wide text-slate-500'>Источник данных</p>
            <h2 className='mt-1 text-2xl font-extrabold text-slate-950'>Источник: {sourceTitle}</h2>
            <p className='mt-1 text-sm font-medium text-slate-500'>{sourceSubtitle}</p>
            <SourceControls period={selectedPeriod} sourceMode={sourceMode} periods={periods} />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Badge className={hasRows ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{hasRows ? String(rows.length) + ' строк' : 'нет строк'}</Badge>
            <Badge className='bg-slate-100 text-slate-700'>{activeSourceKind ?? sourceMode}</Badge>
            {sourceMode === 'auto' ? <Badge className='bg-blue-100 text-blue-800'>Авто</Badge> : null}
            {activePayrollRun ? <Badge className='bg-slate-100 text-slate-700'>{activePayrollRun.status}</Badge> : null}
          </div>
        </div>
      </Card>

      <div className='mb-5'>
        <ExtendedVgpUpload initialPeriod={selectedPeriod} />
      </div>

      {!hasRows ? (
        <Card className='mb-5 border-amber-200 bg-amber-50 p-5'>
          <div className='flex gap-3'>
            <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
            <div>
              <p className='font-extrabold text-amber-950'>Нет строк для выбранного периода и источника.</p>
              <p className='mt-1 text-sm font-medium leading-relaxed text-amber-800'>В режиме “Авто” страница сначала ищет расширенный ВВП за выбранный период, затем payroll snapshot за тот же период. Данные разных месяцев не смешиваются.</p>
            </div>
          </div>
        </Card>
      ) : null}

      {activeSourceKind === 'extended_vgp' ? (
        <Card className='mb-5 border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800'>
          Эти показатели построены по расширенному ВВП и не влияют на зарплату. Зарплатные суммы доступны только при источнике “Payroll snapshot”.
        </Card>
      ) : null}

      <SalesOverview rows={rows} totalGrossPay={totalGrossPay} totalNetPay={totalNetPay} sourceKind={activeSourceKind ?? 'payroll_snapshot'} />

      <MonthInsights insights={monthInsights} />

      <CategoryTable summaries={categorySummaries} totalRevenue={totalRevenue} totalGrossProfit={totalGrossProfit} sourceKind={activeSourceKind ?? 'payroll_snapshot'} />

      <SalespeopleTable salespeople={salespeople} sourceKind={activeSourceKind ?? 'payroll_snapshot'} />

      <PriceControl rows={priceControlRows} sourceRows={rows} sourceKind={activeSourceKind ?? 'payroll_snapshot'} />

      <CreditSales rows={creditRows} products={creditProducts} />

      <DataQuality rows={rows} reviewEmployees={reviewEmployees} sourceKind={activeSourceKind ?? 'payroll_snapshot'} />
    </AdminShell>
  );
}
