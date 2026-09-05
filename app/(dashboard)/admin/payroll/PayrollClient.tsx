'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Eye, FileSpreadsheet, Upload } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Table } from '@/components/ui/table';
import { PayrollBonusesEditor } from './PayrollBonusesEditor';
import { PayrollFinboxImport } from './PayrollFinboxImport';
import { PayrollDailyOneCControl } from './PayrollDailyOneCControl';
import { PAYROLL_COMPENSATION_VERSION, getBelaMinimum, getInitialPayrollBonuses, getPayrollBonusTotal, getRetailAccessoryTier, isBelaBaseEmployee, payrollMoney, readPayrollBonusDrafts, validatePayrollBonuses, type PayrollBonus, type PayrollBonusDraft } from '@/lib/payroll-compensation';
import {
  PAYROLL_WORKBOOK_UNCONFIGURED_GROUP,
  getPayrollWorkbookComponentLabel,
  getPayrollWorkbookCalculationText,
  getPayrollWorkbookGroup,
  getPayrollWorkbookReviewCount,
  getPayrollWorkbookStatusLabel,
  isPayrollWorkbookPaidAdvanceCheck,
  isPayrollWorkbookSalaryTypeConfigured,
  sortPayrollWorkbookEmployees,
} from '@/lib/payroll-workbook';
import { isPayrollEmployeeRuleActive } from '@/lib/payroll-employee-rules';

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
  | 'RETAIL_ACCESSORY_5'
  | 'MANUAL_EXCLUDED';

type PayrollClassificationRule = {
  id: number;
  title: string | null;
  isActive: boolean;
  priority: number;
  matchType: 'EXACT_ITEM' | 'CONTAINS_ITEM' | 'CATEGORY' | 'CATEGORY_AND_CONTAINS_ITEM' | 'ARTICLE';
  itemText: string | null;
  categoryText: string | null;
  article: string | null;
  department: 'all' | 'retail' | 'wholesale' | string | null;
  saleContext: 'all' | 'credit' | 'regular' | string | null;
  targetCalculationType: CalculationType | 'REVIEW_ONLY';
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

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
  accessoryBase?: number;
  accessoryRate?: number;
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
type ConfiguredSalaryType = 'vl_percent' | 'wholesale_percent' | 'retail_sales_bonus' | 'fixed_salary' | 'purchase_manager';
type SalaryType = ConfiguredSalaryType | 'unconfigured';

type PayrollEmployee = {
  name: string;
  department: string;
  position: string;
  salaryType: ConfiguredSalaryType;
  salary?: number;
  activeThroughPeriod?: string;
};

type PayrollDirectoryUser = {
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

type PayrollSourceFileSnapshot = {
  type: 'sales' | 'purchase';
  originalName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  selectedSheet?: string;
  rowCount?: number;
  parsedRowCount?: number;
  status: string;
  warnings?: unknown[];
  metadata?: Record<string, unknown>;
};

type PayrollAnalyticsRowSnapshot = {
  sourceFileType: 'sales';
  sourceFileName: string;
  employeeName: string;
  employeeId: number | null;
  department: string;
  location: string | null;
  client: string;
  category: string;
  nomenclatureType: string | null;
  itemName: string;
  article: string;
  quantity: number | null;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number | null;
  markupPercent: number | null;
  calculationType: CalculationType;
  componentType: string;
  commissionAmount: number;
  isCredit: boolean;
  isReturn: boolean;
  isNegative: boolean;
  isManualRuleApplied: boolean;
  manualRuleLabel: string | null;
  problemFlags: string[];
  checkReason: string | null;
};

type SavedPayrollRunSummary = {
  id: number;
  runNumber: number;
  status: string;
  employeeCount: number;
  reviewCount: number;
  grossPay: number;
  netPay: number;
  sourceSummary?: unknown;
  createdAt: string;
  finalizedAt?: string | null;
  supersededAt?: string | null;
  supersededByRun?: { id: number; runNumber: number } | null;
};

type PayrollFinalReplacement = {
  periodKey: string;
  targetRun: SavedPayrollRunSummary;
  existingFinal: SavedPayrollRunSummary;
};

type SavedPayrollPeriod = {
  id: number;
  year: number;
  month: number;
  periodKey: string;
  status: string;
  runs: SavedPayrollRunSummary[];
};

type SavedPayrollCalculationDetail = {
  id: number;
  component: string;
  base: number | null;
  formula: string;
  amount: number;
  comment: string;
  order: number;
};

type SavedPayrollEmployeeResult = {
  id: number;
  employeeName: string;
  payrollDepartment: string;
  department: string;
  position: string;
  salaryType: string;
  reportGroup?: string;
  salaryRule: string;
  workedDays: number | null;
  lateCount: number | null;
  daysSource: string;
  dayRate: number;
  dayPay: number;
  revenue: number;
  grossProfit: number;
  creditBonus: number;
  filmBonus: number;
  plotterBonus: number;
  techBonus: number;
  accessoryBonus: number;
  wholesaleBonus: number;
  salesBonus: number;
  totalBonus: number;
  disciplineBonus: number;
  fixedSalary: number;
  fixedBonus: number;
  fixedDeduction: number;
  purchaseBase: number | null;
  purchasePercent: number;
  purchasePercentAmount: number;
  purchaseTargetAdjustment: number;
  purchaseTargetSalary: number;
  agentCreditCommission: number;
  advance: number;
  grossPay: number;
  netPay: number;
  status: string;
  reasons?: unknown;
  comment: string;
  calculationDetails: SavedPayrollCalculationDetail[];
  adjustments?: Array<{ id: number; type: string; amount: number; reason: string; createdAt: string; createdByUserId: number | null }>;
};

type SavedPayrollSourceFile = {
  id: number;
  type: string;
  originalName: string;
  sha256: string | null;
  selectedSheet: string | null;
  rowCount: number | null;
  parsedRowCount: number | null;
  uploadedAt: string;
};

type SavedPayrollManualInput = {
  id: number;
  employeeName: string;
  inputType: string;
  workedDays: string | null;
  lateCount: string | null;
  advance: string | null;
  fixedBonus: string | null;
  fixedDeduction: string | null;
  purchaseAdvance: string | null;
  purchaseDeduction: string | null;
  comment: string;
};

type SavedPayrollRunDetail = SavedPayrollRunSummary & {
  period: SavedPayrollPeriod;
  sourceFiles: SavedPayrollSourceFile[];
  manualInputs: SavedPayrollManualInput[];
  employeeResults: SavedPayrollEmployeeResult[];
  finalizedBy?: { id: number; name: string } | null;
  supersededBy?: { id: number; name: string } | null;
};

type PayrollWorkbookMainRow = {
  employeeName: string;
  category: string;
  salaryType: string;
  grossPay: number;
  workedDays: number | null;
  basePay: number;
  performancePay: number;
  specialPay: number;
  disciplinePay: number;
  additionalPay: number;
  advance: number;
  deduction: number;
  netPay: number;
  status: string;
  comment: string;
};

type PayrollWorkbookModel = {
  periodLabel: string;
  versionLabel: string;
  generatedAt: string;
  employeeRows: PayrollWorkbookMainRow[];
  accrualRows: Array<Array<string | number | null>>;
  checkRows: Array<Array<string | number | null>>;
  sourceRows: Array<Array<string | number | null>>;
  fileName: string;
};

async function downloadPayrollWorkbook(model: PayrollWorkbookModel) {
  const XLSX = (await import('xlsx-js-style')).default;
  const workbookExport = XLSX.utils.book_new();
  const moneyFormat = '#,##0.00 "₽";[Red]-#,##0.00 "₽"';
  const integerFormat = '#,##0';
  const thinBottom = { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } };
  const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
  const totalStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { vertical: 'center' } };
  const setCellStyle = (sheet: Record<string, unknown>, address: string, style: object) => {
    const cell = sheet[address] as { s?: object } | undefined;
    if (cell) cell.s = { ...(cell.s ?? {}), ...style };
  };
  const setRowStyle = (sheet: Record<string, unknown>, rowNumber: number, fromCol: number, toCol: number, style: object) => {
    for (let col = fromCol; col <= toCol; col += 1) setCellStyle(sheet, XLSX.utils.encode_cell({ r: rowNumber - 1, c: col }), style);
  };
  const setColumnNumberFormat = (sheet: Record<string, unknown>, firstRow: number, lastRow: number, columns: number[], format: string) => {
    for (let rowIndex = firstRow - 1; rowIndex <= lastRow - 1; rowIndex += 1) {
      columns.forEach((col) => {
        const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: col })] as { z?: string } | undefined;
        if (cell) {
          cell.z = format;
          setCellStyle(sheet, XLSX.utils.encode_cell({ r: rowIndex, c: col }), { numFmt: format });
        }
      });
    }
  };

  const totalGross = model.employeeRows.reduce((sum, row) => sum + row.grossPay, 0);
  const totalWithheld = model.employeeRows.reduce((sum, row) => sum + row.advance + row.deduction, 0);
  const totalNet = model.employeeRows.reduce((sum, row) => sum + row.netPay, 0);
  const unconfiguredRows = model.employeeRows.filter((row) => !isPayrollWorkbookSalaryTypeConfigured(row.salaryType));
  const reviewCount = getPayrollWorkbookReviewCount(model.employeeRows, model.checkRows);
  const summaryRows: Array<Array<string | number | null>> = [
    [`Зарплатная ведомость — ${model.periodLabel}`],
    [`${model.versionLabel} · сформировано ${model.generatedAt} · «Начислено» — зарплата до вычета авансов и удержаний.`],
    ['Сотрудников', '', 'Начислено за месяц', '', 'Выплачено / удержано', '', 'Осталось выплатить', '', 'Нужно проверить', ''],
    [model.employeeRows.length, '', totalGross, '', totalWithheld, '', totalNet, '', reviewCount, ''],
  ];
  const tableHeader = ['Сотрудник', 'Начислено', 'Дни', 'Оплата / оклад / доплата', 'Процентная часть', 'Бонус за дисциплину', 'Премии и агентские', 'Выплачено / удержано', 'Осталось выплатить', 'Комментарий'];
  const tableRows: Array<{ kind: 'group' | 'employee'; salaryType: string; values: Array<string | number | null> }> = [];
  let currentCategory = '';
  model.employeeRows.forEach((row) => {
    if (row.category !== currentCategory) {
      currentCategory = row.category;
      tableRows.push({ kind: 'group', salaryType: row.salaryType, values: [row.category.toLocaleUpperCase('ru-RU'), '', '', '', '', '', '', '', '', ''] });
    }
    tableRows.push({
      kind: 'employee',
      salaryType: row.salaryType,
      values: [
        row.employeeName,
        row.grossPay,
        row.workedDays ?? '',
        row.basePay + row.specialPay || '',
        row.performancePay || '',
        row.disciplinePay || '',
        row.additionalPay || '',
        row.advance + row.deduction || '',
        row.netPay,
        row.status === 'Готово' ? row.comment : `Проверить: ${row.comment || 'есть замечания к расчёту'}`,
      ],
    });
  });
  const totalRow = [
    'ИТОГО',
    totalGross,
    '',
    model.employeeRows.reduce((sum, row) => sum + row.basePay + row.specialPay, 0),
    model.employeeRows.reduce((sum, row) => sum + row.performancePay, 0),
    model.employeeRows.reduce((sum, row) => sum + row.disciplinePay, 0),
    model.employeeRows.reduce((sum, row) => sum + row.additionalPay, 0),
    totalWithheld,
    totalNet,
    '',
  ];
  const headerRow = summaryRows.length + 1;
  const totalRowNumber = headerRow + tableRows.length + 1;
  const sheetRows = [
    ...summaryRows,
    tableHeader,
    ...tableRows.map((row) => row.values),
    totalRow,
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(sheetRows);
  for (let rowNumber = 1; rowNumber <= totalRowNumber; rowNumber += 1) {
    setRowStyle(summarySheet, rowNumber, 0, 9, { fill: { fgColor: { rgb: 'FFFFFF' } }, font: { color: { rgb: '0F172A' } } });
  }
  summarySheet['!cols'] = [25, 15, 7, 20, 18, 17, 19, 18, 15, 38].map((wch) => ({ wch }));
  summarySheet['!rows'] = [{ hpt: 28 }, { hpt: 26 }, { hpt: 24 }, { hpt: 26 }, { hpt: 38 }];
  summarySheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    ...[0, 2, 4, 6, 8].flatMap((col) => [
      { s: { r: 2, c: col }, e: { r: 2, c: col + 1 } },
      { s: { r: 3, c: col }, e: { r: 3, c: col + 1 } },
    ]),
    ...tableRows
      .map((row, index) => row.kind === 'group' ? { s: { r: headerRow + index, c: 0 }, e: { r: headerRow + index, c: 9 } } : null)
      .filter((merge): merge is { s: { r: number; c: number }; e: { r: number; c: number } } => Boolean(merge)),
  ];
  summarySheet['!freeze'] = { xSplit: 0, ySplit: headerRow, topLeftCell: `A${headerRow + 1}`, activePane: 'bottomLeft', state: 'frozen' };
  setRowStyle(summarySheet, 1, 0, 9, { font: { bold: true, color: { rgb: '0F172A' }, sz: 16 }, alignment: { vertical: 'center' }, border: { bottom: { style: 'medium', color: { rgb: '1E3A5F' } } } });
  setRowStyle(summarySheet, 2, 0, 9, { font: { italic: true, color: { rgb: '64748B' } }, alignment: { vertical: 'center', wrapText: true } });
  [0, 2, 4, 6, 8].forEach((col) => {
    setCellStyle(summarySheet, XLSX.utils.encode_cell({ r: 2, c: col }), { font: { bold: true, color: { rgb: '475569' } }, fill: { fgColor: { rgb: 'F1F5F9' } }, alignment: { horizontal: 'center' } });
    setCellStyle(summarySheet, XLSX.utils.encode_cell({ r: 3, c: col }), { font: { bold: true, color: { rgb: '0F172A' }, sz: 12 }, fill: { fgColor: { rgb: 'F1F5F9' } }, alignment: { horizontal: 'center' } });
  });
  const reviewFill = reviewCount > 0 ? 'FEF3C7' : 'DCFCE7';
  const reviewColor = reviewCount > 0 ? '92400E' : '166534';
  [3, 4].forEach((rowIndex) => setCellStyle(summarySheet, XLSX.utils.encode_cell({ r: rowIndex - 1, c: 8 }), { fill: { fgColor: { rgb: reviewFill } }, font: { bold: true, color: { rgb: reviewColor }, sz: rowIndex === 4 ? 12 : 11 }, alignment: { horizontal: 'center' } }));
  setRowStyle(summarySheet, headerRow, 0, 9, headerStyle);
  tableRows.forEach((row, index) => {
    const rowNumber = headerRow + index + 1;
    const groupFill = row.salaryType === 'purchase_manager' ? 'FAF3DD' : row.salaryType === 'wholesale_percent' ? 'EAF3FA' : row.salaryType === 'retail_sales_bonus' ? 'ECF7F0' : row.salaryType === 'vl_percent' ? 'F1ECF8' : 'F3F4F6';
    if (row.kind === 'group') {
      setRowStyle(summarySheet, rowNumber, 0, 9, { fill: { fgColor: { rgb: groupFill } }, font: { bold: true, color: { rgb: '334155' } }, border: { top: { style: 'medium', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } }, alignment: { vertical: 'center' } });
      return;
    }
    setRowStyle(summarySheet, rowNumber, 0, 9, { border: thinBottom, alignment: { vertical: 'center', wrapText: true } });
    setCellStyle(summarySheet, `A${rowNumber}`, { font: { bold: true } });
    setCellStyle(summarySheet, `B${rowNumber}`, { font: { bold: true, color: { rgb: '166534' } }, fill: { fgColor: { rgb: 'DCFCE7' } }, alignment: { horizontal: 'right' } });
    setCellStyle(summarySheet, `J${rowNumber}`, { border: { ...thinBottom, left: { style: 'medium', color: { rgb: 'CBD5E1' } } }, alignment: { vertical: 'center', wrapText: true } });
    if (String(row.values[9] ?? '').startsWith('Проверить:')) {
      setCellStyle(summarySheet, `J${rowNumber}`, { fill: { fgColor: { rgb: 'FEF3C7' } }, font: { color: { rgb: '92400E' }, bold: true } });
    }
  });
  setRowStyle(summarySheet, totalRowNumber, 0, 9, totalStyle);
  setColumnNumberFormat(summarySheet, headerRow + 1, totalRowNumber, [1, 3, 4, 5, 6, 7, 8], moneyFormat);
  setColumnNumberFormat(summarySheet, headerRow + 1, totalRowNumber, [2], integerFormat);
  setColumnNumberFormat(summarySheet, 4, 4, [2, 4, 6], moneyFormat);
  XLSX.utils.book_append_sheet(workbookExport, summarySheet, 'Итоги');

  const addTableSheet = (name: string, subtitle: string, header: string[], rows: Array<Array<string | number | null>>, widths: number[], moneyColumns: number[] = [], collapsedRows: Set<number> = new Set()) => {
    const safeRows = rows.length ? rows : [['—', 'Данных для отображения нет']];
    const statusColumn = header.indexOf('Статус');
    const sheet = XLSX.utils.aoa_to_sheet([[`${name} — ${model.periodLabel}`], [subtitle], [], header, ...safeRows]);
    const lastColumn = header.length - 1;
    const headerRowNumber = 4;
    const firstDataRowNumber = 5;
    for (let rowNumber = 1; rowNumber <= safeRows.length + 4; rowNumber += 1) {
      setRowStyle(sheet, rowNumber, 0, lastColumn, { fill: { fgColor: { rgb: 'FFFFFF' } }, font: { color: { rgb: '0F172A' } } });
    }
    sheet['!cols'] = widths.map((wch) => ({ wch }));
    sheet['!rows'] = [{ hpt: 28 }, { hpt: 26 }, { hpt: 8 }, { hpt: 38 }];
    if (collapsedRows.size) sheet['!outline'] = { above: true, left: false };
    sheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColumn } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColumn } },
    ];
    sheet['!autofilter'] = { ref: `A${headerRowNumber}:${XLSX.utils.encode_col(lastColumn)}${safeRows.length + 4}` };
    sheet['!freeze'] = { xSplit: 0, ySplit: headerRowNumber, topLeftCell: `A${firstDataRowNumber}`, activePane: 'bottomLeft', state: 'frozen' };
    setRowStyle(sheet, 1, 0, lastColumn, { font: { bold: true, color: { rgb: '0F172A' }, sz: 15 }, alignment: { vertical: 'center' }, border: { bottom: { style: 'medium', color: { rgb: '1E3A5F' } } } });
    setRowStyle(sheet, 2, 0, lastColumn, { font: { italic: true, color: { rgb: '64748B' } }, alignment: { vertical: 'center', wrapText: true } });
    setRowStyle(sheet, headerRowNumber, 0, lastColumn, headerStyle);
    for (let rowNumber = firstDataRowNumber; rowNumber <= safeRows.length + 4; rowNumber += 1) {
      setRowStyle(sheet, rowNumber, 0, lastColumn, { border: thinBottom, alignment: { vertical: 'center', wrapText: true } });
      const row = safeRows[rowNumber - firstDataRowNumber];
      if (collapsedRows.has(rowNumber - firstDataRowNumber)) {
        const rowInfo = (sheet['!rows'] as Array<Record<string, unknown>>)[rowNumber - 1] ?? {};
        (sheet['!rows'] as Array<Record<string, unknown>>)[rowNumber - 1] = { ...rowInfo, level: 1, hidden: true };
      }
      const isSectionRow = row?.slice(1).every((value) => value === '' || value === null || value === undefined);
      if (isSectionRow) {
        const sectionName = String(row?.[0] ?? '').toLocaleLowerCase('ru-RU');
        const sectionFill = sectionName.includes('закуп') ? 'FAF3DD'
          : sectionName.includes('оптов') ? 'EAF3FA'
            : sectionName.includes('рознич') ? 'ECF7F0'
              : sectionName.includes('операцион') ? 'F1ECF8'
                : 'F3F4F6';
        setRowStyle(sheet, rowNumber, 0, lastColumn, { fill: { fgColor: { rgb: sectionFill } }, font: { bold: true, color: { rgb: '334155' } }, border: { top: { style: 'medium', color: { rgb: 'CBD5E1' } }, bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } }, alignment: { vertical: 'center' } });
      }
      if (name === 'Расшифровка') {
        const isEmployeeSummary = Boolean(row?.[0]) && Boolean(row?.[4]);
        if (isEmployeeSummary) {
          const needsReview = row?.[4] === 'Проверить';
          const rowInfo = (sheet['!rows'] as Array<Record<string, unknown>>)[rowNumber - 1] ?? {};
          (sheet['!rows'] as Array<Record<string, unknown>>)[rowNumber - 1] = { ...rowInfo, collapsed: true };
          setRowStyle(sheet, rowNumber, 0, lastColumn, { fill: { fgColor: { rgb: needsReview ? 'FEF3C7' : 'EFF6FF' } }, font: { bold: true, color: { rgb: needsReview ? '92400E' : '1E3A5F' } }, border: { top: { style: 'medium', color: { rgb: needsReview ? 'FCD34D' : '93C5FD' } }, bottom: { style: 'thin', color: { rgb: needsReview ? 'FDE68A' : 'BFDBFE' } } }, alignment: { vertical: 'center', wrapText: true } });
        }
        if (row?.[5] === 'Итого начислено') {
          setRowStyle(sheet, rowNumber, 0, lastColumn, { fill: { fgColor: { rgb: 'F0FDF4' } }, font: { bold: true, color: { rgb: '166534' } }, border: { top: { style: 'thin', color: { rgb: '86EFAC' } }, bottom: { style: 'thin', color: { rgb: 'BBF7D0' } } }, alignment: { vertical: 'center', wrapText: true } });
        }
      }
      if (name === 'Контроль расчёта' && statusColumn >= 0) {
        const status = row?.[statusColumn];
        if (status === 'Ошибка' || status === 'Проверить') setRowStyle(sheet, rowNumber, 0, lastColumn, { fill: { fgColor: { rgb: status === 'Ошибка' ? 'FEE2E2' : 'FEF3C7' } }, border: thinBottom, alignment: { vertical: 'center', wrapText: true } });
      }
    }
    if (moneyColumns.length) setColumnNumberFormat(sheet, firstDataRowNumber, safeRows.length + 4, moneyColumns, moneyFormat);
    XLSX.utils.book_append_sheet(workbookExport, sheet, name);
  };

  const getAccrualSource = (component: string) => {
    const normalized = component.toLocaleLowerCase('ru-RU');
    if (normalized.includes('начислено за месяц') || normalized.includes('к выплате') || normalized.includes('доплата до миним')) return 'Расчёт портала';
    if (normalized.includes('12%')) return 'Расчёт зарплаты сотрудников';
    if (normalized.includes('дисциплин') || normalized.includes('отработанн') || normalized.includes('дн')) return 'Посещаемость';
    if (normalized.includes('закуп')) return 'Отчёт закупок 1С';
    if (normalized.includes('finbox') || normalized.includes('агентск')) return 'Отчёт Finbox';
    if (normalized.includes('прем') || normalized.includes('решени')) return 'Решение руководителя';
    if (normalized.includes('аванс') || normalized.includes('удержан')) return 'Внесено администратором';
    if (normalized.includes('фиксирован') || normalized.includes('оклад')) return 'Утверждённый оклад';
    return 'Отчёт продаж 1С';
  };
  const workbookAccrualRows: Array<Array<string | number | null>> = [];
  const collapsedAccrualRows = new Set<number>();
  let currentAccrualGroup = '';
  let currentAccrualEmployee = '';
  let currentAccrualComponents: number[] = [];
  const employeeRowsByName = new Map(model.employeeRows.map((row) => [row.employeeName, row]));
  model.accrualRows.forEach((row) => {
    const employee = String(row[0] ?? '');
    const group = String(row[1] ?? '');
    const component = String(row[3] ?? '');
    if (group && group !== currentAccrualGroup) {
      currentAccrualGroup = group;
      currentAccrualEmployee = '';
      workbookAccrualRows.push([group.toLocaleUpperCase('ru-RU'), '', '', '', '', '', '', '', '']);
    }
    if (employee !== currentAccrualEmployee) {
      currentAccrualComponents = [];
      const employeeSummary = employeeRowsByName.get(employee);
      if (employeeSummary) {
        workbookAccrualRows.push([
          employee,
          employeeSummary.grossPay,
          employeeSummary.advance + employeeSummary.deduction || '',
          employeeSummary.netPay,
          employeeSummary.status,
          '',
          '',
          '',
          employeeSummary.comment,
        ]);
      }
    }
    const base = typeof row[4] === 'number' ? row[4] : row[4] ?? null;
    const amount = Number(row[6] ?? 0);
    if (component !== 'К выплате') {
      const isGrossTotal = component === 'Начислено за месяц';
      const displayedComponent = isGrossTotal ? 'Итого начислено' : component;
      const calculation = isGrossTotal
        ? getPayrollWorkbookCalculationText(displayedComponent, null, currentAccrualComponents.map((value) => formatMoney(value)).join(' + '), amount)
        : getPayrollWorkbookCalculationText(component, base, String(row[5] ?? ''), amount);
      collapsedAccrualRows.add(workbookAccrualRows.length);
      workbookAccrualRows.push([
        '',
        '',
        '',
        '',
        '',
        displayedComponent,
        calculation,
        getAccrualSource(component),
        row[7] ?? '',
      ]);
      if (!isGrossTotal && component !== 'Аванс' && component !== 'Удержание' && Math.abs(amount) > 0.005) currentAccrualComponents.push(amount);
    }
    currentAccrualEmployee = employee;
  });
  addTableSheet('Расшифровка', 'По умолчанию видны итоги. Нажмите «+» слева от строк, чтобы раскрыть составляющие и числовые формулы.', ['Сотрудник', 'Начислено', 'Выплачено / удержано', 'Осталось выплатить', 'Статус', 'Составляющая', 'Числовой расчёт', 'Источник', 'Комментарий'], workbookAccrualRows, [28, 18, 20, 20, 16, 38, 58, 28, 48], [1, 2, 3], collapsedAccrualRows);
  const workbookCheckRows = [
    ...unconfiguredRows.map((row) => [
      row.employeeName,
      'Не настроено правило зарплаты',
      'Проверить',
      1,
      'Сотрудник включён в отчёт, но расчёт нельзя считать полным, пока администратор не выберет правило зарплаты.',
    ]),
    ...model.checkRows.map((row) => {
      const paidAdvance = isPayrollWorkbookPaidAdvanceCheck(row);
      return [
        row[0] ?? '',
        [row[1], row[5], row[6], row[7]].filter(Boolean).join(' · '),
        paidAdvance ? 'Учтено' : row[3] ?? '',
        row[2] ?? '',
        paidAdvance ? 'Аванс уже выплачен и уменьшает только остаток к выплате' : row[4] ?? '',
      ];
    }),
  ];
  const detailTotals = new Map<string, { gross: number | null; net: number | null }>();
  model.accrualRows.forEach((row) => {
    const employeeName = String(row[0] ?? '');
    if (!employeeName) return;
    const totals = detailTotals.get(employeeName) ?? { gross: null, net: null };
    if (row[3] === 'Начислено за месяц') totals.gross = Number(row[6] ?? 0);
    if (row[3] === 'К выплате') totals.net = Number(row[6] ?? 0);
    detailTotals.set(employeeName, totals);
  });
  const grossMismatchCount = model.employeeRows.filter((row) => {
    const detailGross = detailTotals.get(row.employeeName)?.gross;
    return detailGross === null || detailGross === undefined || Math.abs(detailGross - row.grossPay) > 0.011;
  }).length;
  const netMismatchCount = model.employeeRows.filter((row) => {
    const detailNet = detailTotals.get(row.employeeName)?.net;
    return detailNet === null || detailNet === undefined || Math.abs(detailNet - row.netPay) > 0.011;
  }).length;
  workbookCheckRows.push(
    ['СВЕРКА ИТОГОВ', '', '', '', ''],
    ['Расчёт в целом', 'Сотрудники в ведомости', 'Готово', model.employeeRows.length, `Включено сотрудников: ${model.employeeRows.length}`],
    ['Расчёт в целом', 'Начислено: «Итоги» и «Расшифровка»', grossMismatchCount ? 'Ошибка' : 'Готово', grossMismatchCount, grossMismatchCount ? 'Есть расхождения по начисленной зарплате' : 'Начисления по каждому сотруднику совпадают'],
    ['Расчёт в целом', 'Осталось выплатить: «Итоги» и «Расшифровка»', netMismatchCount ? 'Ошибка' : 'Готово', netMismatchCount, netMismatchCount ? 'Есть расхождения по остатку к выплате' : 'Остатки к выплате по каждому сотруднику совпадают'],
  );
  addTableSheet('Контроль расчёта', 'Замечания, которые требуют решения, и выполненные контрольные сверки.', ['Сотрудник', 'Что проверить', 'Статус', 'Количество', 'Что это означает'], workbookCheckRows, [28, 58, 18, 14, 74]);
  const workbookSourceRows = [
    ['ИСПОЛЬЗОВАННЫЕ ИСТОЧНИКИ', '', '', '', '', ''],
    ...model.sourceRows.map((row) => {
      const sourceName = String(row[0] ?? '');
      const normalizedSourceName = sourceName.toLocaleLowerCase('ru-RU');
      const indicators = normalizedSourceName.includes('период')
        ? 'Месяц и год расчёта'
        : normalizedSourceName.includes('продаж')
          ? 'Документы, выручка, валовая прибыль и категории товаров'
          : normalizedSourceName.includes('дн')
            ? 'Отработанные дни и опоздания'
            : 'Показатели, указанные в источнике';
      return [sourceName, row[1] ?? '', indicators, 'Получено порталом', model.periodLabel, row[2] ?? ''];
    }),
    ['ДЕЙСТВУЮЩИЕ ПРАВИЛА', '', '', '', '', ''],
    ['Закупки', 'Правило портала', 'Дни, 1,75% от утверждённых закупок и доплата до минимума', 'Рассчитывается автоматически', model.periodLabel, 'Только документы закупщика по утверждённым поставщикам'],
    ['Оптовые продажи', 'Правило портала', 'Дни, 1,75% от базы оптовых продаж и дисциплина', 'Рассчитывается автоматически', model.periodLabel, 'Сотрудники отдела получают одинаковый процент от общей базы опта'],
    ['Розничные продажи', 'Правило портала', 'Дни, проценты за услуги, технику, аксессуары и кредиты', 'Рассчитывается автоматически', model.periodLabel, 'Для кредитов: 10% от валовой прибыли после вычета 9% налогов и издержек'],
    ['Операционное управление', 'Правило портала', '12% от основных начислений выбранных сотрудников', 'Рассчитывается автоматически', model.periodLabel, 'Если результат ниже 100 000 ₽, портал добавляет разницу'],
    ['Фиксированный оклад', 'Карточка сотрудника', 'Утверждённый месячный оклад', 'Подставляется автоматически', model.periodLabel, 'Премии, авансы и удержания показываются отдельно'],
  ];
  addTableSheet('Источники и правила', 'Использованные данные и действующие правила расчёта зарплаты.', ['Что рассчитываем', 'Источник', 'Какие показатели берём', 'Как данные попали в расчёт', 'Период', 'Для чего используется'], workbookSourceRows, [34, 28, 52, 38, 18, 72]);

  XLSX.writeFile(workbookExport, model.fileName, { bookType: 'xlsx' });
}

function getSavedRunReviewReasons(run: { sourceSummary?: unknown }) {
  const summary = run.sourceSummary;
  if (!summary || typeof summary !== 'object' || !('reviewReasons' in summary)) return [];
  const reviewReasons = (summary as { reviewReasons?: unknown }).reviewReasons;
  if (!Array.isArray(reviewReasons)) return [];
  return reviewReasons
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const reason = (item as { reason?: unknown }).reason;
      const count = (item as { count?: unknown }).count;
      return typeof reason === 'string' ? { reason, count: Number(count) || 0 } : null;
    })
    .filter((item): item is { reason: string; count: number } => Boolean(item));
}

function getSavedEmployeeReasons(row: { reasons?: unknown }) {
  return Array.isArray(row.reasons) ? row.reasons.filter((reason): reason is string => typeof reason === 'string') : [];
}

function getSavedInputTypeLabel(inputType: string) {
  if (inputType === 'sales') return 'Продажи, дни и авансы';
  if (inputType === 'fixed') return 'Фиксированная зарплата';
  if (inputType === 'purchase') return 'Закупки и авансы';
  return 'Ручные данные';
}

function getSavedSourceTypeLabel(sourceType: string) {
  if (sourceType === 'sales') return 'Продажи';
  if (sourceType === 'purchase') return 'Закупки';
  return 'Источник данных';
}

function getSavedRetailAccessoryTier(sourceSummary: unknown) {
  if (!sourceSummary || typeof sourceSummary !== 'object' || !('retailAccessoryTier' in sourceSummary)) return null;
  const value = (sourceSummary as { retailAccessoryTier?: unknown }).retailAccessoryTier;
  if (!value || typeof value !== 'object') return null;
  const tier = value as Record<string, unknown>;
  if (![tier.teamBase, tier.threshold, tier.rate].every((item) => typeof item === 'number' && Number.isFinite(item))) return null;
  return {
    teamBase: tier.teamBase as number,
    threshold: tier.threshold as number,
    rate: tier.rate as number,
    elevated: tier.elevated === true,
  };
}

type FullPayrollRow = BonusManagerSummary & {
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
  salaryRule: 'standard' | 'noDayPay' | 'belaPercent' | 'fixedSalary' | 'purchaseManager' | 'unconfigured';
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
};

function isConfiguredSalaryType(value: string | null): value is ConfiguredSalaryType {
  return Boolean(value && isPayrollWorkbookSalaryTypeConfigured(value));
}

function buildPayrollEmployeeDirectory(users: PayrollDirectoryUser[], periodKey: string) {
  const directory: Record<string, PayrollEmployee> = { ...payrollEmployees };
  for (const user of users) {
    const name = user.payrollName?.trim() || user.name.trim();
    if (!name) continue;
    if (!user.isActive || (isConfiguredSalaryType(user.payrollSalaryType) && !isPayrollEmployeeRuleActive(user, periodKey))) {
      delete directory[name];
      continue;
    }
    if (!isConfiguredSalaryType(user.payrollSalaryType)) continue;
    const existing = directory[name];
    directory[name] = {
      name,
      department: user.payrollReportGroup || getPayrollWorkbookGroup(user.payrollSalaryType),
      position: existing?.position || user.payrollReportGroup || getPayrollWorkbookGroup(user.payrollSalaryType),
      salaryType: user.payrollSalaryType,
      salary: user.payrollSalaryType === 'fixed_salary' ? user.payrollFixedSalary ?? 0 : undefined,
      activeThroughPeriod: user.payrollRuleThrough ?? existing?.activeThroughPeriod,
    };
  }
  return directory;
}

function buildUnconfiguredPayrollRows(users: PayrollDirectoryUser[], directory: Record<string, PayrollEmployee>, periodKey: string, accountedEmployeeNames: Set<string>): FullPayrollRow[] {
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
  detailRows: SalesRow[];
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
function formatPayrollMonthKey(monthIndex: number) {
  return String(monthIndex + 1).padStart(2, '0');
}

function getDefaultPayrollPeriod(currentDate = new Date()) {
  const payrollDate = new Date(currentDate);
  if (currentDate.getDate() <= 7) {
    payrollDate.setMonth(payrollDate.getMonth() - 1);
  }

  return {
    month: String(payrollDate.getMonth()),
    year: String(payrollDate.getFullYear()),
  };
}

const purchaseManagerName = 'Тохов Астемир';
const purchaseTargetSalary = 100000;
const purchaseStandardWorkedDays = 20;
const purchaseDayRate = 600;
const purchasePercent = 0.0175;
const agentCreditCommissionEmployee = 'Кумахова Диана';
const asadManagerName = 'Икаев Асад';
const retailTraineePayrollName = 'Костеренко Магомед';
const legacyRetailTraineeSourceName = 'СтажерРозница';
const payrollExcludedEmployeeNames = ['Кештова Аслан', 'Кештова Амир', 'Кештов Аслан', 'Кештов Амир', 'Атабиева Муслим', 'Атабиев Муслим'];
const payrollExcludedEmployeeKeys = new Set(payrollExcludedEmployeeNames.map(normalizeText));
const payrollManagerAliases: Record<string, string> = {
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
  'Косторенко Магомед',
  'Магомед Косторенко',
  'Костеренко Магомед',
  'Магомед Костеренко',
  'Костенко Магомед',
  'Магомед Костенко',
  'Костанко Магомед',
  'Магомед Костанко',
  'Костаренко Магомед',
  'Магомед Костаренко',
  ...payrollExcludedEmployeeNames,
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
  CREDIT_ACCESSORY_NO_BONUS: 'Кредитный аксессуар',
  CREDIT_REVIEW_NO_BONUS: 'Кредит: требуется классификация',
  RETAIL_REVIEW_TECH: 'Розница: спорная техника',
  RETAIL_FILM_50: 'Услуги оказываемые: 50%',
  RETAIL_PLOTTER_MATERIAL_COST_50: 'Плоттерные материалы: 50% от с/с',
  RETAIL_GROSS_PROFIT_10: 'Техника: 10% от ВП',
  RETAIL_ACCESSORY_5: 'Аксессуары',
  MANUAL_EXCLUDED: 'Исключено вручную',
};

const calculationFormulas: Record<CalculationType, string> = {
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

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

async function sha256ArrayBuffer(buffer: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) return '';
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function buildSourceFileSnapshot(
  file: File,
  buffer: ArrayBuffer,
  type: PayrollSourceFileSnapshot['type'],
  extra: Partial<PayrollSourceFileSnapshot> = {},
): Promise<PayrollSourceFileSnapshot> {
  return {
    type,
    originalName: file.name,
    extension: getFileExtension(file.name),
    mimeType: file.type,
    sizeBytes: file.size,
    sha256: await sha256ArrayBuffer(buffer),
    status: 'UPLOADED',
    ...extra,
  };
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

function getPayrollManagerName(manager: string) {
  const normalized = normalizeText(manager);
  if (normalized.includes('магомед') && /(косторенко|костеренко|костенко|костанко|костаренко)/.test(normalized)) {
    return retailTraineePayrollName;
  }
  return payrollManagerAliases[normalized] ?? manager;
}

function isLegacyRetailTraineeSource(manager: string) {
  const normalized = normalizeText(manager);
  return normalized === normalizeText(legacyRetailTraineeSourceName) || normalized === normalizeText('СтажёрРозница');
}

function shouldMapLegacyRetailTraineeToMagomed(month: string, year: string) {
  return month === '5' && year === '2026';
}

function mapLegacyRetailTraineeForPeriod(result: PayrollParseResult, month: string, year: string): PayrollParseResult {
  if (!shouldMapLegacyRetailTraineeToMagomed(month, year)) {
    const rows = result.rows.filter((row) => !isLegacyRetailTraineeSource(row.manager));
    const detailRows = result.detailRows.filter((row) => !isLegacyRetailTraineeSource(row.manager));

    return {
      ...result,
      rows,
      detailRows,
      managers: Array.from(new Set(rows.map((row) => row.manager))),
    };
  }

  const mapRow = (row: SalesRow): SalesRow => (
    isLegacyRetailTraineeSource(row.manager)
      ? { ...row, manager: retailTraineePayrollName }
      : row
  );

  const rows = result.rows.map(mapRow);
  const detailRows = result.detailRows.map(mapRow);

  return {
    ...result,
    rows,
    detailRows,
    managers: Array.from(new Set(rows.map((row) => row.manager))),
  };
}

function isPayrollExcludedEmployee(manager: string) {
  return payrollExcludedEmployeeKeys.has(normalizeText(getPayrollManagerName(manager)));
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
    detailRows?: SalesRow[];
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
    detailRows: options.detailRows ?? rows,
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
      currentManager = getPayrollManagerName(text);
      currentClient = '';
      currentRegistrar = '';
      currentCategory = '';
      seenItemInClient = false;
      managers.add(currentManager);
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
    detailRows: salesRows,
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
      currentManager = getPayrollManagerName(text);
      currentClient = '';
      currentCategory = '';
      lastSalesRow = null;
      managers.add(currentManager);
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
    detailRows: salesRows,
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
  if (rule === 'accessory-category' || rule === 'accessory-item-marker') return 'кредит + аксессуар: 5% от выручки';
  if (rule === 'button-phone-accessory') return 'кредит + кнопочный телефон: 5% от выручки';
  if (rule === 'airpods-copy-accessory') return 'кредит + неоригинальные AirPods / TWS / копия: 5% от выручки';
  if (rule === 'non-apple-watch-accessory') return 'кредит + не-Apple смарт-часы: 5% от выручки';
  return `кредит + аксессуар: 5% от выручки (${row.category})`;
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
      calculationType: 'RETAIL_ACCESSORY_5',
      calculationLabel: 'Кредитная продажа, аксессуар: 5%',
      article,
      base: row.revenue,
      percent: 0.05,
      bonus: row.revenue * 0.05,
      formula: calculationFormulas.RETAIL_ACCESSORY_5,
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

function getRuleTargetDetails(
  row: SalesRow,
  currentDetails: Omit<ClassifiedSalesRow, keyof SalesRow>,
  targetCalculationType: PayrollClassificationRule['targetCalculationType'],
): Omit<ClassifiedSalesRow, keyof SalesRow> {
  const article = getArticle(row.item);
  const isCredit = currentDetails.isCreditSale;
  const target: CalculationType =
    targetCalculationType === 'REVIEW_ONLY'
      ? isCredit
        ? 'CREDIT_REVIEW_NO_BONUS'
        : currentDetails.department === 'Опт'
          ? 'WHOLESALE_REVIEW_TECH'
          : 'RETAIL_REVIEW_TECH'
      : targetCalculationType;

  const baseByTarget: Record<CalculationType, number> = {
    WHOLESALE_EXCLUDED_TECH: 0,
    WHOLESALE_REVIEW_TECH: row.revenue,
    WHOLESALE_INCLUDED_1_75: row.revenue,
    CREDIT_GROSS_PROFIT: row.grossProfit * 0.91,
    CREDIT_ACCESSORY_NO_BONUS: row.revenue,
    CREDIT_REVIEW_NO_BONUS: 0,
    RETAIL_REVIEW_TECH: row.revenue,
    RETAIL_FILM_50: row.revenue,
    RETAIL_PLOTTER_MATERIAL_COST_50: row.cost,
    RETAIL_GROSS_PROFIT_10: row.grossProfit,
    RETAIL_ACCESSORY_5: row.revenue,
    MANUAL_EXCLUDED: 0,
  };
  const percentByTarget: Record<CalculationType, number> = {
    WHOLESALE_EXCLUDED_TECH: 0,
    WHOLESALE_REVIEW_TECH: 0.0175,
    WHOLESALE_INCLUDED_1_75: 0.0175,
    CREDIT_GROSS_PROFIT: 0.1,
    CREDIT_ACCESSORY_NO_BONUS: 0.05,
    CREDIT_REVIEW_NO_BONUS: 0,
    RETAIL_REVIEW_TECH: 0.05,
    RETAIL_FILM_50: 0.5,
    RETAIL_PLOTTER_MATERIAL_COST_50: 0.5,
    RETAIL_GROSS_PROFIT_10: 0.1,
    RETAIL_ACCESSORY_5: 0.05,
    MANUAL_EXCLUDED: 0,
  };
  const base = baseByTarget[target];
  const percent = percentByTarget[target];

  return {
    department: currentDetails.department,
    calculationType: target,
    calculationLabel: isCredit && target === 'RETAIL_ACCESSORY_5' ? 'Кредитная продажа, аксессуар' : calculationLabels[target],
    article,
    base,
    percent,
    bonus: base * percent,
    formula: calculationFormulas[target],
    includedInWholesaleBase:
      target === 'WHOLESALE_EXCLUDED_TECH'
        ? false
        : target === 'WHOLESALE_REVIEW_TECH' || target === 'WHOLESALE_INCLUDED_1_75'
          ? true
          : null,
    classificationReason: currentDetails.classificationReason,
    matchedRule: currentDetails.matchedRule,
    isCreditSale: isCredit,
    creditProductType:
      target === 'CREDIT_GROSS_PROFIT'
        ? 'tech'
        : target === 'CREDIT_ACCESSORY_NO_BONUS' || (isCredit && target === 'RETAIL_ACCESSORY_5')
          ? 'accessory'
          : target === 'CREDIT_REVIEW_NO_BONUS'
            ? 'review'
            : null,
    creditIncludedInBonus: target === 'CREDIT_GROSS_PROFIT',
  };
}

function doesClassificationRuleMatch(row: SalesRow, details: Omit<ClassifiedSalesRow, keyof SalesRow>, rule: PayrollClassificationRule) {
  if (!rule.isActive) return false;

  const department = isWholesaleManager(row.manager) ? 'wholesale' : 'retail';
  const saleContext = details.isCreditSale ? 'credit' : 'regular';
  const ruleDepartment = rule.department || 'all';
  const ruleSaleContext = rule.saleContext || 'all';

  if (ruleDepartment !== 'all' && ruleDepartment !== department) return false;
  if (ruleSaleContext !== 'all' && ruleSaleContext !== saleContext) return false;

  const item = normalizeText(row.item);
  const category = normalizeText(row.category);
  const article = normalizeText(getArticle(row.item));
  const ruleItem = normalizeText(rule.itemText ?? '');
  const ruleCategory = normalizeText(rule.categoryText ?? '');
  const ruleArticle = normalizeText(rule.article ?? '');

  if (rule.matchType === 'EXACT_ITEM') {
    return Boolean(ruleItem) && item === ruleItem && (!ruleCategory || category === ruleCategory) && (!ruleArticle || article === ruleArticle);
  }
  if (rule.matchType === 'CONTAINS_ITEM') return Boolean(ruleItem) && item.includes(ruleItem);
  if (rule.matchType === 'CATEGORY') return Boolean(ruleCategory) && category === ruleCategory;
  if (rule.matchType === 'CATEGORY_AND_CONTAINS_ITEM') {
    return Boolean(ruleCategory && ruleItem) && category === ruleCategory && item.includes(ruleItem);
  }
  if (rule.matchType === 'ARTICLE') return Boolean(ruleArticle) && article === ruleArticle;

  return false;
}

function applyClassificationRules(
  row: SalesRow,
  details: Omit<ClassifiedSalesRow, keyof SalesRow>,
  rules: PayrollClassificationRule[],
): Omit<ClassifiedSalesRow, keyof SalesRow> {
  const matchedRule = rules
    .filter((rule) => rule.isActive)
    .sort((left, right) => left.priority - right.priority || left.id - right.id)
    .find((rule) => doesClassificationRuleMatch(row, details, rule));

  if (!matchedRule) return details;

  const overriddenDetails = getRuleTargetDetails(row, details, matchedRule.targetCalculationType);
  const ruleLabel = matchedRule.title || matchedRule.reason || `#${matchedRule.id}`;
  const manualReason =
    overriddenDetails.calculationType === 'RETAIL_ACCESSORY_5'
      ? 'manual-accessory'
      : overriddenDetails.calculationType === 'RETAIL_GROSS_PROFIT_10' || overriddenDetails.calculationType === 'CREDIT_GROSS_PROFIT'
        ? 'manual-tech'
        : overriddenDetails.calculationType === 'MANUAL_EXCLUDED'
          ? 'manual-excluded'
          : 'manual-rule';

  return {
    ...overriddenDetails,
    classificationReason: `${manualReason}: ${ruleLabel}. ${matchedRule.reason || overriddenDetails.classificationReason}`,
    matchedRule: `manual-rule:${matchedRule.id}`,
  };
}

function classifySalesRows(rows: SalesRow[], classificationRules: PayrollClassificationRule[] = []): ClassificationResult {
  const normalizedRows = rows
    .map((row) => ({ ...row, manager: getPayrollManagerName(row.manager) }))
    .filter((row) => !isPayrollExcludedEmployee(row.manager));
  const classifiedRows = normalizedRows.map((row) => {
    const details = getCalculationDetails(row);
    return { ...row, ...applyClassificationRules(row, details, classificationRules) };
  });
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
    const creditBonus = getCreditTechCalculationRows(managerRows).reduce((sum, row) => sum + getCreditTechCalculationBase(row) * 0.91 * 0.1, 0);
    const filmBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.bonus, 0);
    const plotterBonus = managerRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50').reduce((sum, row) => sum + row.bonus, 0);
    const techBonus = getRetailTechCalculationRows(managerRows).reduce((sum, row) => sum + getRetailTechCalculationBase(row) * 0.1, 0);
    const accessoryBonus = getAccessoryCalculationRows(managerRows).reduce((sum, row) => sum + getAccessoryCalculationBase(row) * 0.05, 0);
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
    disputedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH' || row.calculationType === 'CREDIT_REVIEW_NO_BONUS' || (hasDisputeMarkers(row) && row.matchedRule === 'default-category')),
    accessoryExcludedRows: classifiedRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH' && isAccessoryCategory(row.category)),
    expensiveReviewRows: classifiedRows.filter((row) => row.matchedRule === 'new-expensive-review'),
    counts: {
      total: classifiedRows.length,
      wholesale: classifiedRows.filter((row) => row.department === 'Опт').length,
      retail: classifiedRows.filter((row) => row.department === 'Розница').length,
      credit: classifiedRows.filter((row) => row.isCreditSale).length,
      film: classifiedRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').length,
      retailTech: classifiedRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10').length,
      accessory: classifiedRows.filter((row) => isAccessoryBonusRow(row) || row.calculationType === 'RETAIL_REVIEW_TECH').length,
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
  return row.base === 0 && row.calculationType !== 'WHOLESALE_EXCLUDED_TECH' && row.calculationType !== 'MANUAL_EXCLUDED';
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

const accessoryDiagnosticKeywords = [
  'чехол',
  'чехлы',
  'накладка',
  'стекло',
  'защитное стекло',
  'пленка',
  'плёнка',
  'кабель',
  'зарядка',
  'блок питания',
  'адаптер',
  'ремешок',
  'держатель',
  'аксессуары',
  'защитные стекла',
  'защитные стёкла',
  'защитные стекла и пленки',
  'защитные стёкла и плёнки',
  'чехлы, накладки, сумки и бампера',
];

function isServiceLikeRow(row: ClassifiedSalesRow) {
  const category = normalizeText(row.category);
  const item = normalizeText(row.item);
  return category.includes('услуги оказываемые') || item.includes('услуги оказываемые');
}

function isAccessoryLikeRow(row: ClassifiedSalesRow) {
  const haystack = normalizeText(row.category + ' ' + row.item);
  return accessoryDiagnosticKeywords.some((keyword) => haystack.includes(normalizeText(keyword)));
}

function looksLikeTechAuditRow(row: ClassifiedSalesRow) {
  const item = normalizeText(row.item);
  const accessoryMarkers = ['кабель', 'провод', 'зарядка', 'зарядное', 'блок питания', 'адаптер', 'переходник', 'чехол', 'стекло', 'пленка', 'плёнка', 'держатель', 'ремешок'];
  if (accessoryMarkers.some((marker) => item.includes(normalizeText(marker)))) return false;
  return ['airpods', 'airpods pro', 'apple watch', 'ipad', 'iphone', 'macbook', 'playstation', 'ps5'].some((marker) => item.includes(marker));
}

function getNotIncludedInServiceReason(row: ClassifiedSalesRow) {
  if (row.calculationType === 'RETAIL_FILM_50') return 'Вошла в услуги 50%';
  if (row.grossProfit < 0) return 'Не вошла: отрицательная ВП, требуется проверка';
  return 'Не вошла: текущий тип расчёта ' + row.calculationLabel;
}

function getNotIncludedInAccessoryReason(row: ClassifiedSalesRow) {
  if (row.calculationType === 'RETAIL_ACCESSORY_5' || row.calculationType === 'CREDIT_ACCESSORY_NO_BONUS') return 'Вошла в аксессуары 5%';
  if (row.grossProfit < 0) return 'Не вошла: отрицательная ВП, требуется проверка';
  if (row.calculationType === 'CREDIT_GROSS_PROFIT') return 'Не вошла: классифицирована как кредитная техника';
  if (row.calculationType === 'RETAIL_FILM_50') return 'Не вошла: классифицирована как услуга 50%';
  if (row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50') return 'Не вошла: плоттерные материалы Асада 50% от с/с';
  return 'Не вошла: текущий тип расчёта ' + row.calculationLabel;
}

function isUnresolvedReviewRow(row: ClassifiedSalesRow) {
  return (
    !row.calculationType ||
    row.calculationType === 'WHOLESALE_REVIEW_TECH' ||
    row.calculationType === 'RETAIL_REVIEW_TECH' ||
    row.calculationType === 'CREDIT_REVIEW_NO_BONUS' ||
    row.matchedRule === 'new-expensive-review'
  );
}

function isServiceNotIncludedRow(row: ClassifiedSalesRow) {
  return row.department === 'Розница' && isServiceLikeRow(row) && row.calculationType !== 'RETAIL_FILM_50' && row.calculationType !== 'MANUAL_EXCLUDED';
}

function isPotentialAccessoryNotIncludedRow(row: ClassifiedSalesRow) {
  return row.department === 'Розница' && row.calculationType !== 'MANUAL_EXCLUDED' && !isPlotterCalculationRow(row) && !isAccessoryBonusRow(row) && isAccessoryLikeRow(row);
}

function isCriticalZeroBaseRow(row: ClassifiedSalesRow) {
  if (!hasUnexpectedZeroBase(row)) return false;
  if (row.calculationType === 'WHOLESALE_EXCLUDED_TECH') return false;
  if (row.calculationType === 'MANUAL_EXCLUDED') return false;
  if (row.department === 'Опт') return false;
  if (row.revenue === 0 && row.grossProfit === 0 && row.calculationType) return false;
  if (isUnresolvedReviewRow(row)) return true;
  return row.base === 0 && row.percent === 0 && row.grossProfit !== 0;
}

function isSuspiciousTechCostRow(row: ClassifiedSalesRow) {
  const isTechCalculation = row.calculationType === 'RETAIL_GROSS_PROFIT_10' || row.calculationType === 'CREDIT_GROSS_PROFIT';
  if (!isTechCalculation || row.revenue <= 0) return false;
  const costRatio = row.cost / row.revenue;
  const grossProfitRatio = row.grossProfit / row.revenue;
  return row.cost === 0 || costRatio <= 0.05 || grossProfitRatio >= 0.95;
}

function getSuspiciousTechCostReason(row: ClassifiedSalesRow) {
  if (row.cost === 0) return 'Возможна нерассчитанная себестоимость в 1С: себестоимость = 0';
  if (row.cost / row.revenue <= 0.05) return 'Возможна нерассчитанная себестоимость в 1С: себестоимость подозрительно низкая';
  return 'Возможна нерассчитанная себестоимость в 1С: ВП почти равна выручке';
}

function getAnalyticsProblemFlags(row: ClassifiedSalesRow) {
  const flags: string[] = [];
  if (isUnresolvedReviewRow(row)) flags.push('requires-classification');
  if (isPotentialAccessoryNotIncludedRow(row)) flags.push('potential-accessory-not-included');
  if (isServiceNotIncludedRow(row)) flags.push('service-not-included');
  if (isCriticalZeroBaseRow(row)) flags.push('critical-zero-base');
  if (isSuspiciousTechCostRow(row)) flags.push('suspicious-tech-cost');
  if (row.matchedRule === 'new-expensive-review') flags.push('new-expensive-review');
  if (row.grossProfit < 0) flags.push('negative-gross-profit');
  if (row.revenue < 0) flags.push('negative-revenue');
  if (row.isCreditSale) flags.push('credit-sale');
  if (hasRegistrarFragment(row, 'Возврат')) flags.push('return');
  if (row.matchedRule.startsWith('manual-rule:')) flags.push('manual-rule');
  return flags;
}

function getAnalyticsCheckReason(row: ClassifiedSalesRow, flags: string[]) {
  if (flags.includes('suspicious-tech-cost')) return getSuspiciousTechCostReason(row);
  if (flags.includes('requires-classification')) return row.classificationReason;
  if (flags.includes('potential-accessory-not-included')) return getNotIncludedInAccessoryReason(row);
  if (flags.includes('service-not-included')) return getNotIncludedInServiceReason(row);
  if (flags.includes('critical-zero-base')) return getSalesProblemReason(row, 'zeroBase');
  if (flags.includes('negative-gross-profit')) return getSalesProblemReason(row, 'negative');
  return row.classificationReason || null;
}

function isPlotterCalculationRow(row: ClassifiedSalesRow) {
  return row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50' || row.matchedRule === 'asad-plotter-material' || isPlotterMaterial(row);
}

function isAccessoryBonusRow(row: ClassifiedSalesRow) {
  const calculationType = String(row.calculationType).trim();
  if (calculationType === 'RETAIL_ACCESSORY_5' || calculationType === 'CREDIT_ACCESSORY_NO_BONUS') return true;
  if (row.formula === calculationFormulas.RETAIL_ACCESSORY_5 && row.percent === 0.05) return true;
  if (normalizeText(row.calculationLabel).includes('аксессуар')) return true;
  if (normalizeText(row.classificationReason).includes('аксессуар')) return true;
  return row.matchedRule === 'accessory-category' || row.matchedRule === 'accessory-item-marker' || row.matchedRule.startsWith('credit-accessory:');
}

function getAccessoryCalculationRows(rows: ClassifiedSalesRow[]) {
  return rows.filter((row) => isAccessoryBonusRow(row));
}

function getAccessoryCalculationBase(row: ClassifiedSalesRow) {
  return row.revenue;
}

function getRetailTechCalculationRows(rows: ClassifiedSalesRow[]) {
  return rows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10');
}

function getCreditTechCalculationRows(rows: ClassifiedSalesRow[]) {
  return rows.filter((row) => row.calculationType === 'CREDIT_GROSS_PROFIT');
}

function getRetailTechCalculationBase(row: ClassifiedSalesRow) {
  return row.grossProfit;
}

function getCreditTechCalculationBase(row: ClassifiedSalesRow) {
  return row.grossProfit;
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

function isNoDayPayManager(manager: string) {
  return normalizePersonName(manager).includes('асад');
}

function getDayRate(department: Department) {
  return department === 'Опт' ? 500 : 600;
}

function getDefaultPayrollDepartment(employee: PayrollEmployee): Department {
  return employee.salaryType === 'wholesale_percent' ? 'Опт' : 'Розница';
}

function isPayrollEmployeeActiveForPeriod(employee: PayrollEmployee, periodKey: string) {
  return !employee.activeThroughPeriod || periodKey <= employee.activeThroughPeriod;
}

function buildEmptyManagerSummary(employee: PayrollEmployee): BonusManagerSummary {
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

function mergeBonusManagerSummaries(managerSummaries: BonusManagerSummary[]) {
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

function buildSalesPayrollSummaries(managerSummaries: BonusManagerSummary[], employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees) {
  const mergedManagerSummaries = mergeBonusManagerSummaries(managerSummaries);
  const summariesByManager = new Map(mergedManagerSummaries.map((summary) => [summary.manager, summary]));
  const payrollSalesSummaries = Object.values(employeeDirectory)
    .filter((employee) => employee.salaryType === 'vl_percent' || employee.salaryType === 'wholesale_percent' || employee.salaryType === 'retail_sales_bonus')
    .map((employee) => summariesByManager.get(employee.name) ?? buildEmptyManagerSummary(employee));
  const reportOnlySummaries = mergedManagerSummaries.filter((summary) => !employeeDirectory[summary.manager]);

  return [...payrollSalesSummaries, ...reportOnlySummaries];
}

function applyRetailAccessoryTier(
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

function buildFullPayrollRow(summary: BonusManagerSummary, manual: PayrollManualInput | undefined, employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees): FullPayrollRow {
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
  const salaryRule = isBelaManager(summary.manager) ? 'belaPercent' : isNoDayPayManager(summary.manager) ? 'noDayPay' : 'standard';
  const dayPayNotRequired = salaryRule !== 'standard';
  const workedDays = dayPayNotRequired ? null : manualWorkedDays;
  const lateCount = dayPayNotRequired ? null : manualLateCount;
  const advance = parseManualNumber(manual?.advance ?? '') ?? 0;
  const agentCreditCommission = summary.manager === agentCreditCommissionEmployee ? parseManualNumber(manual?.agentCreditCommission ?? '') ?? 0 : 0;
  const dayRate = dayPayNotRequired ? 0 : getDayRate(summary.department);
  const dayPay = workedDays === null ? 0 : workedDays * dayRate;
  const salesBonus = salaryRule === 'belaPercent' ? 0 : salaryType === 'wholesale_percent' ? summary.wholesaleBonus : summary.totalBonus;
  const disciplineBonus = salaryRule === 'standard' && lateCount !== null && lateCount <= 3 ? 3000 : 0;
  const grossPay = dayPay + salesBonus + disciplineBonus + agentCreditCommission;
  const netPay = grossPay - advance;
  const payrollReasons = [
    !dayPayNotRequired && workedDays === null ? 'Не заполнены отработанные дни' : '',
    !dayPayNotRequired && lateCount === null ? 'Посещаемость по форме не подтверждена' : '',
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

function getPayrollManualInput(manager: string, manualPayroll: Record<string, PayrollManualInput>) {
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

function applyBelaPercentRule(rows: FullPayrollRow[], periodKey: string): FullPayrollRow[] {
  const baseRows = rows.filter((row) => row.salaryRule !== 'belaPercent' && isBelaBaseEmployee(row.manager));
  const belaBaseGrossPay = baseRows.reduce((sum, row) => sum + row.grossPay - (row.oneTimeBonus ?? 0), 0);
  const minimum = getBelaMinimum(periodKey);

  return rows.map((row) => {
    if (row.salaryRule !== 'belaPercent') return row;
    const belaPercentAmount = minimum ? payrollMoney(belaBaseGrossPay * 0.12) : belaBaseGrossPay * 0.12;
    const minimumGuaranteeAdjustment = minimum ? payrollMoney(Math.max(0, minimum - belaPercentAmount)) : 0;
    const grossPay = belaPercentAmount + minimumGuaranteeAdjustment;
    const netPay = grossPay - row.advance;
    const payrollReasons = [
      ...(row.advance > grossPay ? ['Аванс больше начислений'] : []),
      ...(minimum && baseRows.some((baseRow) => baseRow.payrollReasons.length > 0) ? ['Не полностью проверена база расчёта 12%'] : []),
    ];
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

function applyPayrollBonuses(rows: FullPayrollRow[], bonuses: PayrollBonus[]): FullPayrollRow[] {
  return rows.map((row) => {
    const oneTimeBonus = getPayrollBonusTotal(bonuses, row.manager);
    const grossPay = row.grossPay + oneTimeBonus;
    const payrollReasons = row.payrollReasons.filter((reason) => reason !== 'Аванс больше начислений');
    if (row.advance > grossPay) payrollReasons.push('Аванс больше начислений');
    return { ...row, oneTimeBonus, grossPay, netPay: row.netPay + oneTimeBonus, payrollReasons, payrollStatus: payrollReasons.length ? 'Проверить' : 'OK' };
  });
}

function buildFixedPayrollRows(inputs: Record<string, FixedPayrollInput>, periodKey: string, employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees): FullPayrollRow[] {
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

function buildPurchasePayrollRow(input: PurchasePayrollInput | undefined, report: PurchaseReportState | null, employeeDirectory: Record<string, PayrollEmployee> = payrollEmployees): FullPayrollRow {
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
  if (salaryType === 'vl_percent') return '12% от начислений сотрудников';
  if (salaryType === 'wholesale_percent') return 'Оптовый процент';
  return 'Розничный бонус продаж';
}

function getSalaryFormulaLabel(salaryType: SalaryType, periodKey = '') {
  if (salaryType === 'purchase_manager') return '20 × 600 + бонус с закупок 1,75% + доплата до минимальной зарплаты − аванс − удержание';
  if (salaryType === 'fixed_salary') return 'оклад + премия - аванс - удержание';
  if (salaryType === 'vl_percent') return getBelaMinimum(periodKey) ? '12% от обычных начислений выбранных сотрудников + доплата до минимальной зарплаты − аванс; разовая премия сверху' : '12% от обычных начислений выбранных сотрудников';
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

  const disputed = managerRows.filter(isUnresolvedReviewRow).length;
  const serviceNotIncluded = managerRows.filter(isServiceNotIncludedRow).length;
  const potentialAccessories = managerRows.filter(isPotentialAccessoryNotIncludedRow).length;
  const zeroBase = managerRows.filter(isCriticalZeroBaseRow).length;
  const suspiciousTechCost = managerRows.filter(isSuspiciousTechCostRow).length;

  if (disputed || serviceNotIncluded || potentialAccessories || zeroBase || suspiciousTechCost) {
    const reasons = [
      disputed ? `спорные строки ${disputed}` : '',
      serviceNotIncluded ? `услуги не вошли ${serviceNotIncluded}` : '',
      potentialAccessories ? `похожие на аксессуары ${potentialAccessories}` : '',
      zeroBase ? `нулевая база без понятного расчёта ${zeroBase}` : '',
      suspiciousTechCost ? `подозрительная себестоимость техники ${suspiciousTechCost}` : '',
    ].filter(Boolean);
    return { status: 'Проверить', reason: reasons.join(', ') };
  }

  return { status: 'OK', reason: 'замечаний нет' };
}

export default function AdminPayrollPage() {
  const defaultPayrollPeriod = getDefaultPayrollPeriod();
  const [month, setMonth] = useState(defaultPayrollPeriod.month);
  const [year, setYear] = useState(defaultPayrollPeriod.year);
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
  const [activePayrollTab, setActivePayrollTab] = useState('Итог ЗП');
  const [expandedManager, setExpandedManager] = useState<string | null>(null);
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [manualPayroll, setManualPayroll] = useState<Record<string, PayrollManualInput>>({});
  const [fixedPayroll, setFixedPayroll] = useState<Record<string, FixedPayrollInput>>({});
  const [purchasePayroll, setPurchasePayroll] = useState<PurchasePayrollInput>({ advance: '', deduction: '', comment: '' });
  const [purchaseReport, setPurchaseReport] = useState<PurchaseReportState | null>(null);
  const [bonusState, setBonusState] = useState<{ periodKey: string; drafts: PayrollBonusDraft[]; error: string }>({ periodKey: '', drafts: [], error: '' });
  const [bonusStorageWarning, setBonusStorageWarning] = useState('');
  const [salesSourceFile, setSalesSourceFile] = useState<PayrollSourceFileSnapshot | null>(null);
  const [purchaseSourceFile, setPurchaseSourceFile] = useState<PayrollSourceFileSnapshot | null>(null);
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
  const [savedPeriods, setSavedPeriods] = useState<SavedPayrollPeriod[]>([]);
  const [isSavedPeriodsLoading, setIsSavedPeriodsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);
  const [lastSavedRunId, setLastSavedRunId] = useState<number | null>(null);
  const [payrollHistoryActionId, setPayrollHistoryActionId] = useState<string | null>(null);
  const [payrollFinalReplacement, setPayrollFinalReplacement] = useState<PayrollFinalReplacement | null>(null);
  const [selectedSavedRun, setSelectedSavedRun] = useState<SavedPayrollRunDetail | null>(null);
  const [isSavedRunLoading, setIsSavedRunLoading] = useState(false);
  const [isSavedRunExporting, setIsSavedRunExporting] = useState(false);
  const [classificationRules, setClassificationRules] = useState<PayrollClassificationRule[]>([]);
  const [isClassificationRulesLoading, setIsClassificationRulesLoading] = useState(false);
  const [classificationRuleActionId, setClassificationRuleActionId] = useState<string | null>(null);
  const [classificationRuleMessage, setClassificationRuleMessage] = useState('');
  const [classificationRuleError, setClassificationRuleError] = useState('');
  const [payrollDirectoryUsers, setPayrollDirectoryUsers] = useState<PayrollDirectoryUser[]>([]);
  const [payrollDirectoryError, setPayrollDirectoryError] = useState('');
  const [isPayrollDirectoryLoading, setIsPayrollDirectoryLoading] = useState(true);
  const loadedManualPayrollKey = useRef('');
  const skipNextManualPayrollSave = useRef(true);

  const rows = selectedSheet && workbook ? workbook.sheets[selectedSheet] ?? [] : [];
  const payrollManualStorageKey = `payroll-manual-${year}-${month}`;
  const selectedPayrollPeriodKey = `${year}-${formatPayrollMonthKey(Number(month))}`;
  const bonusesReady = bonusState.periodKey === selectedPayrollPeriodKey;
  const bonusDrafts = bonusesReady ? bonusState.drafts : [];

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`payroll-bonuses-v1-${selectedPayrollPeriodKey}`);
      setBonusState({ periodKey: selectedPayrollPeriodKey, drafts: saved === null ? getInitialPayrollBonuses(selectedPayrollPeriodKey) : readPayrollBonusDrafts(JSON.parse(saved)), error: '' });
    } catch {
      setBonusState({ periodKey: selectedPayrollPeriodKey, drafts: [], error: 'Сохранённый черновик премий не прочитан. Добавьте премии заново или перезагрузите страницу для повторного чтения.' });
    }
    setBonusStorageWarning('');
  }, [selectedPayrollPeriodKey]);

  useEffect(() => {
    if (!bonusesReady || bonusState.error) return;
    try {
      window.localStorage.setItem(`payroll-bonuses-v1-${selectedPayrollPeriodKey}`, JSON.stringify(bonusState.drafts));
      setBonusStorageWarning('');
    } catch {
      setBonusStorageWarning('Браузер не сохранил черновик премий. Сохраните расчёт в историю до закрытия страницы.');
    }
  }, [bonusesReady, bonusState, selectedPayrollPeriodKey]);

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

  useEffect(() => {
    void loadSavedPayrollPeriods();
    void loadClassificationRules();
    void fetch('/api/admin/employees', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить правила сотрудников.');
        setPayrollDirectoryUsers(await response.json() as PayrollDirectoryUser[]);
        setPayrollDirectoryError('');
      })
      .catch((caughtError) => setPayrollDirectoryError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить правила сотрудников.'))
      .finally(() => setIsPayrollDirectoryLoading(false));
  }, []);

  useEffect(() => {
    setAttendancePreview(null);
    setAttendancePreviewError('');
    setAttendanceApplyResult(null);
  }, [selectedPayrollPeriodKey]);

  const parseResult = useMemo(() => mapLegacyRetailTraineeForPeriod(parsePayrollReport(rows), month, year), [rows, month, year]);
  const previewRows = useMemo(() => rows.slice(0, 20), [rows]);
  const classification = useMemo(() => classifySalesRows(parseResult.rows, classificationRules), [parseResult.rows, classificationRules]);
  // TODO: For deeper audit, add parseResult.auditRows from document-level rows when the source Excel contains per-document revenue/grossProfit. Do not use auditRows for payroll calculation.
  const auditClassification = useMemo(
    () => (parseResult.detailRows === parseResult.rows ? classification : classifySalesRows(parseResult.detailRows, classificationRules)),
    [classification, parseResult.detailRows, parseResult.rows, classificationRules],
  );
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
  const payrollEmployeeDirectory = useMemo(
    () => buildPayrollEmployeeDirectory(payrollDirectoryUsers, selectedPayrollPeriodKey),
    [payrollDirectoryUsers, selectedPayrollPeriodKey],
  );
  const payrollAccessoryCalculation = useMemo(
    () => applyRetailAccessoryTier(classification.managerSummaries, classification.rows, payrollEmployeeDirectory, selectedPayrollPeriodKey),
    [classification.managerSummaries, classification.rows, payrollEmployeeDirectory, selectedPayrollPeriodKey],
  );
  const payrollManagerSummaries = payrollAccessoryCalculation.summaries;
  const retailAccessoryTier = payrollAccessoryCalculation.tier;
  const totalBonus = useMemo(() => payrollManagerSummaries.reduce((sum, row) => sum + row.totalBonus, 0), [payrollManagerSummaries]);
  const salesPayrollRows = useMemo(
    () => buildSalesPayrollSummaries(payrollManagerSummaries, payrollEmployeeDirectory).map((summary) => buildFullPayrollRow(summary, getPayrollManualInput(summary.manager, manualPayroll), payrollEmployeeDirectory)),
    [payrollManagerSummaries, manualPayroll, payrollEmployeeDirectory],
  );
  const fixedPayrollRows = useMemo(() => buildFixedPayrollRows(fixedPayroll, selectedPayrollPeriodKey, payrollEmployeeDirectory), [fixedPayroll, selectedPayrollPeriodKey, payrollEmployeeDirectory]);
  const purchasePayrollRow = useMemo(() => buildPurchasePayrollRow(purchasePayroll, purchaseReport, payrollEmployeeDirectory), [purchasePayroll, purchaseReport, payrollEmployeeDirectory]);
  const unconfiguredPayrollRows = useMemo(
    () => buildUnconfiguredPayrollRows(payrollDirectoryUsers, payrollEmployeeDirectory, selectedPayrollPeriodKey, new Set(salesPayrollRows.map((row) => row.manager))),
    [payrollDirectoryUsers, payrollEmployeeDirectory, salesPayrollRows, selectedPayrollPeriodKey],
  );
  const regularPayrollRows = useMemo(() => applyBelaPercentRule([...salesPayrollRows, ...fixedPayrollRows, purchasePayrollRow, ...unconfiguredPayrollRows], selectedPayrollPeriodKey), [salesPayrollRows, fixedPayrollRows, purchasePayrollRow, unconfiguredPayrollRows, selectedPayrollPeriodKey]);
  const bonusValidation = useMemo(() => {
    try {
      if (!bonusesReady) throw new Error('Загружается черновик премий.');
      if (bonusState.error) throw new Error(bonusState.error);
      return { bonuses: validatePayrollBonuses(bonusState.drafts, regularPayrollRows.map((row) => row.manager)), error: '' };
    } catch (error) {
      return { bonuses: [] as PayrollBonus[], error: error instanceof Error ? error.message : 'Проверьте премии.' };
    }
  }, [bonusState, bonusesReady, regularPayrollRows]);
  const fullPayrollRows = useMemo(() => applyPayrollBonuses(regularPayrollRows, bonusValidation.bonuses), [regularPayrollRows, bonusValidation.bonuses]);
  const unmappedBonusDrafts = bonusDrafts.filter((draft) => !regularPayrollRows.some((row) => row.manager === draft.employeeName));
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
  const isAttendancePreviewPeriodCurrent = attendancePreview?.period.periodKey === selectedPayrollPeriodKey;
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
  const currentSavedPeriod = useMemo(
    () => savedPeriods.find((period) => period.year === Number(year) && period.month === Number(month)) ?? null,
    [savedPeriods, year, month],
  );
  const isCurrentPeriodClosed = currentSavedPeriod?.status === 'CLOSED';
  const wholesaleTotalBonus = classification.wholesale.bonusEach * 2;
  const retailTotalBonus = payrollManagerSummaries.filter((row) => row.department === 'Розница').reduce((sum, row) => sum + row.totalBonus, 0);
  const wholesaleCategorySummaries = useMemo(() => buildWholesaleCategorySummaries(classification.rows), [classification.rows]);
  const retailRows = useMemo(() => classification.rows.filter((row) => row.department === 'Розница'), [classification.rows]);
  const retailTechSummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'RETAIL_GROSS_PROFIT_10')), [retailRows]);
  const retailAccessorySummary = useMemo(() => ({
    ...sumRows(payrollAccessoryCalculation.eligibleRows),
    base: retailAccessoryTier.teamBase,
    bonus: payrollManagerSummaries
      .filter((row) => payrollAccessoryCalculation.eligibleManagers.has(row.manager))
      .reduce((sum, row) => sum + row.accessoryBonus, 0),
  }), [payrollAccessoryCalculation, payrollManagerSummaries, retailAccessoryTier.teamBase]);
  const payrollTypeSummaries = useMemo(
    () =>
      classification.typeSummaries.map((summary) => {
        if (summary.type !== 'RETAIL_ACCESSORY_5' && summary.type !== 'CREDIT_ACCESSORY_NO_BONUS') return summary;
        const accessoryRows = payrollAccessoryCalculation.eligibleRows.filter((row) => row.calculationType === summary.type);
        const base = accessoryRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
        return {
          ...summary,
          label: `${summary.type === 'CREDIT_ACCESSORY_NO_BONUS' ? 'Кредитные' : 'Обычные'} аксессуары ${retailAccessoryTier.ratePercent}%`,
          rows: accessoryRows.length,
          revenue: accessoryRows.reduce((sum, row) => sum + row.revenue, 0),
          grossProfit: accessoryRows.reduce((sum, row) => sum + row.grossProfit, 0),
          base,
          formula: `выручка × ${retailAccessoryTier.ratePercent}%`,
          bonus: base * retailAccessoryTier.rate,
        };
      }),
    [classification.typeSummaries, payrollAccessoryCalculation.eligibleRows, retailAccessoryTier.rate, retailAccessoryTier.ratePercent],
  );
  const retailFilmSummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'RETAIL_FILM_50')), [retailRows]);
  const retailPlotterSummary = useMemo(() => sumRows(retailRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50')), [retailRows]);
  const retailCreditSummary = useMemo(() => sumRows(creditTechRows), [creditTechRows]);
  const retailReviewSummary = useMemo(() => sumRows(retailReviewRows), [retailReviewRows]);
  const classificationErrorCount = classification.accessoryExcludedRows.length + unclassifiedRows.length;
  const payrollReviewItems = useMemo(
    () =>
      fullPayrollRows
        .map((row) => ({ row, reasons: getPayrollRowReviewReasons(row) }))
        .filter((item) => item.reasons.length > 0),
    [fullPayrollRows, classification.rows, classification.accessoryExcludedRows],
  );
  const payrollReviewCount = payrollReviewItems.length;
  const payrollOkCount = fullPayrollRows.length - payrollReviewCount;
  const payrollReviewReasonCounts = useMemo(() => {
    const reasonCounts = new Map<string, number>();
    payrollReviewItems.forEach((item) => {
      item.reasons.forEach((reason) => reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1));
    });
    return Array.from(reasonCounts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ru'));
  }, [payrollReviewItems]);
  const payrollHasCriticalCostIssue = payrollReviewReasonCounts.some(([reason]) => reason === 'Подозрительно нулевая / неполная себестоимость техники');
  const registrarParseUnsafe = parseResult.isRegistrarReport && (!parseResult.isSafeForPayrollCalculation || payrollReviewCount > 20);
  const selectedManagerSummary = useMemo(() => payrollManagerSummaries.find((summary) => summary.manager === selectedManager) ?? null, [payrollManagerSummaries, selectedManager]);
  const selectedManagerRows = useMemo(() => classification.rows.filter((row) => row.manager === selectedManager), [classification.rows, selectedManager]);
  const selectedManagerStatus = selectedManagerPayroll && (selectedManagerPayroll.salaryType === 'fixed_salary' || selectedManagerPayroll.salaryType === 'purchase_manager' || selectedManagerPayroll.salaryType === 'vl_percent')
    ? { status: selectedManagerPayroll.payrollStatus, reason: selectedManagerPayroll.payrollReasons.join(', ') || 'замечаний нет' }
    : selectedManagerSummary
      ? getManagerStatus(selectedManagerSummary, classification.rows, classification.accessoryExcludedRows)
      : null;
  const selectedManagerCounts = useMemo(
    () => ({
      disputed: selectedManagerRows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH' || row.calculationType === 'RETAIL_REVIEW_TECH' || row.calculationType === 'CREDIT_REVIEW_NO_BONUS' || row.matchedRule === 'new-expensive-review').length,
      credits: selectedManagerRows.filter((row) => row.isCreditSale).length,
      negative: selectedManagerRows.filter((row) => row.grossProfit < 0).length,
      zeroBase: selectedManagerRows.filter(isCriticalZeroBaseRow).length,
      unclassified: selectedManagerRows.filter((row) => !row.calculationType).length,
      accessoryExcluded: classification.accessoryExcludedRows.filter((row) => row.manager === selectedManager).length,
      invalidNumbers: selectedManagerRows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))).length,
      creditReview: selectedManagerRows.filter((row) => row.calculationType === 'CREDIT_REVIEW_NO_BONUS').length,
      potentialAccessories: selectedManagerRows.filter(isPotentialAccessoryNotIncludedRow).length,
      serviceNotIncluded: selectedManagerRows.filter(isServiceNotIncludedRow).length,
      suspiciousTechCost: selectedManagerRows.filter(isSuspiciousTechCostRow).length,
      classifiedCredits: selectedManagerRows.filter((row) => row.isCreditSale && row.calculationType !== 'CREDIT_REVIEW_NO_BONUS').length,
      accountedNegative: selectedManagerRows.filter((row) => row.grossProfit < 0 && !isUnresolvedReviewRow(row)).length,
      informationalZeroBase: selectedManagerRows.filter((row) => hasUnexpectedZeroBase(row) && !isCriticalZeroBaseRow(row)).length,
      creditBase: getCreditTechCalculationRows(selectedManagerRows).reduce((sum, row) => sum + getCreditTechCalculationBase(row), 0),
      filmBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.base, 0),
      plotterBase: selectedManagerRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50').reduce((sum, row) => sum + row.base, 0),
      techBase: getRetailTechCalculationRows(selectedManagerRows).reduce((sum, row) => sum + getRetailTechCalculationBase(row), 0),
      accessoryBase: getAccessoryCalculationRows(selectedManagerRows).reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0),
    }),
    [selectedManagerRows, classification.accessoryExcludedRows, selectedManager],
  );
  const selectedManagerServiceRows = useMemo(() => selectedManagerRows.filter(isServiceLikeRow), [selectedManagerRows]);
  const selectedManagerPlotterRows = useMemo(() => selectedManagerRows.filter(isPlotterCalculationRow), [selectedManagerRows]);
  const selectedManagerAccessoryRows = useMemo(() => getAccessoryCalculationRows(selectedManagerRows), [selectedManagerRows]);
  const selectedManagerPotentialAccessoryRows = useMemo(
    () => selectedManagerRows.filter(isPotentialAccessoryNotIncludedRow),
    [selectedManagerRows],
  );
  const selectedManagerSuspiciousTechCostRows = useMemo(() => selectedManagerRows.filter(isSuspiciousTechCostRow), [selectedManagerRows]);
  const selectedManagerProblemSalesRows = useMemo(
    () =>
      selectedManagerRows.filter(
        (row) =>
          row.calculationType === 'WHOLESALE_REVIEW_TECH' ||
          row.calculationType === 'RETAIL_REVIEW_TECH' ||
          row.calculationType === 'CREDIT_REVIEW_NO_BONUS' ||
          row.matchedRule === 'new-expensive-review' ||
          (row.grossProfit < 0 && !isPlotterCalculationRow(row)) ||
          !row.calculationType,
      ),
    [selectedManagerRows],
  );
  const selectedManagerDiagnostics = useMemo(() => {
    const includedService = selectedManagerServiceRows.filter((row) => row.calculationType === 'RETAIL_FILM_50');
    const excludedService = selectedManagerServiceRows.filter((row) => row.calculationType !== 'RETAIL_FILM_50');
    const serviceIncludedRevenue = includedService.reduce((sum, row) => sum + row.revenue, 0);
    const serviceExcludedRevenue = excludedService.reduce((sum, row) => sum + row.revenue, 0);
    const negativeAccessoryRows = selectedManagerAccessoryRows.filter((row) => row.revenue < 0 || row.grossProfit < 0 || row.base < 0);
    const negativeAccessoryRevenue = negativeAccessoryRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
    const negativeCreditAccessoryRows = negativeAccessoryRows.filter((row) => row.isCreditSale && row.creditProductType === 'accessory');
    const negativeRegularAccessoryRows = negativeAccessoryRows.filter((row) => !negativeCreditAccessoryRows.includes(row));
    const positiveRegularAccessoryRevenue = selectedManagerAccessoryRows
      .filter((row) => !row.isCreditSale && getAccessoryCalculationBase(row) > 0)
      .reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
    const positiveCreditAccessoryRevenue = selectedManagerAccessoryRows
      .filter((row) => row.isCreditSale && getAccessoryCalculationBase(row) > 0)
      .reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
    const negativeRegularAccessoryRevenue = negativeRegularAccessoryRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
    const negativeCreditAccessoryRevenue = negativeCreditAccessoryRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
    const finalRegularAccessoryRevenue = positiveRegularAccessoryRevenue + negativeRegularAccessoryRevenue;
    const finalCreditAccessoryRevenue = positiveCreditAccessoryRevenue + negativeCreditAccessoryRevenue;
    const finalAccessoryBase = finalRegularAccessoryRevenue + finalCreditAccessoryRevenue;
    const retailTechRows = getRetailTechCalculationRows(selectedManagerRows);
    const creditTechRowsForManager = getCreditTechCalculationRows(selectedManagerRows);
    const positiveRetailTechGrossProfit = retailTechRows.filter((row) => getRetailTechCalculationBase(row) > 0).reduce((sum, row) => sum + getRetailTechCalculationBase(row), 0);
    const negativeRetailTechGrossProfit = retailTechRows.filter((row) => getRetailTechCalculationBase(row) < 0).reduce((sum, row) => sum + getRetailTechCalculationBase(row), 0);
    const negativeRetailTechCount = retailTechRows.filter((row) => getRetailTechCalculationBase(row) < 0).length;
    const retailTechGrossProfitBase = positiveRetailTechGrossProfit + negativeRetailTechGrossProfit;
    const positiveCreditTechGrossProfit = creditTechRowsForManager.filter((row) => getCreditTechCalculationBase(row) > 0).reduce((sum, row) => sum + getCreditTechCalculationBase(row), 0);
    const negativeCreditTechGrossProfit = creditTechRowsForManager.filter((row) => getCreditTechCalculationBase(row) < 0).reduce((sum, row) => sum + getCreditTechCalculationBase(row), 0);
    const negativeCreditTechCount = creditTechRowsForManager.filter((row) => getCreditTechCalculationBase(row) < 0).length;
    const creditTechGrossProfitBase = positiveCreditTechGrossProfit + negativeCreditTechGrossProfit;
    const negativeTechCount = negativeRetailTechCount + negativeCreditTechCount;
    const negativeTechGrossProfit = negativeRetailTechGrossProfit + negativeCreditTechGrossProfit;
    const techGrossProfitBase = retailTechGrossProfitBase + creditTechGrossProfitBase;
    const techBonus = retailTechGrossProfitBase * 0.1 + creditTechGrossProfitBase * 0.91 * 0.1;
    const potentialAccessoryRevenue = selectedManagerPotentialAccessoryRows.reduce((sum, row) => sum + row.revenue, 0);
    const selectedAccessoryRate = selectedManagerSummary?.accessoryRate ?? 0.05;

    return {
      serviceIncludedRevenue,
      serviceExcludedRevenue,
      serviceTotalRevenue: serviceIncludedRevenue + serviceExcludedRevenue,
      serviceBonus: serviceIncludedRevenue * 0.5,
      positiveRegularAccessoryRevenue,
      negativeRegularAccessoryRevenue,
      regularAccessoryRevenue: finalRegularAccessoryRevenue,
      positiveCreditAccessoryRevenue,
      negativeCreditAccessoryRevenue,
      creditAccessoryRevenue: finalCreditAccessoryRevenue,
      accessoryRevenue: finalAccessoryBase,
      accessoryBonus: finalAccessoryBase * selectedAccessoryRate,
      negativeAccessoryCount: negativeAccessoryRows.length,
      negativeAccessoryRevenue,
      positiveRetailTechGrossProfit,
      negativeRetailTechGrossProfit,
      retailTechGrossProfitBase,
      positiveCreditTechGrossProfit,
      negativeCreditTechGrossProfit,
      creditTechGrossProfitBase,
      negativeTechCount,
      negativeTechGrossProfit,
      techGrossProfitBase,
      techBonus,
      variableSalesBonus: serviceIncludedRevenue * 0.5 + finalAccessoryBase * selectedAccessoryRate + techBonus,
      potentialAccessoryRevenue,
    };
  }, [selectedManagerAccessoryRows, selectedManagerPotentialAccessoryRows, selectedManagerRows, selectedManagerServiceRows, selectedManagerSummary?.accessoryRate]);
  const payrollDiagnosticsByEmployee = useMemo(
    () =>
      fullPayrollRows.map((payrollRow) => {
        const employeeRows = classification.rows.filter((row) => row.manager === payrollRow.manager);
        const serviceRows = employeeRows.filter(isServiceLikeRow);
        const serviceIncludedRows = serviceRows.filter((row) => row.calculationType === 'RETAIL_FILM_50');
        const accessoryRows = getAccessoryCalculationRows(employeeRows);
        const techRows = getRetailTechCalculationRows(employeeRows);
        const creditTechRowsForEmployee = getCreditTechCalculationRows(employeeRows);
        const serviceBase = serviceIncludedRows.reduce((sum, row) => sum + row.base, 0);
        const serviceMissedBase = serviceRows.filter((row) => row.calculationType !== 'RETAIL_FILM_50').reduce((sum, row) => sum + row.revenue, 0);
        const negativeAccessoryRows = accessoryRows.filter((row) => row.revenue < 0 || row.grossProfit < 0 || row.base < 0);
        const negativeAccessoryBase = negativeAccessoryRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
        const negativeCreditAccessoryRows = negativeAccessoryRows.filter((row) => row.isCreditSale && row.creditProductType === 'accessory');
        const negativeRegularAccessoryRows = negativeAccessoryRows.filter((row) => !negativeCreditAccessoryRows.includes(row));
        const positiveRegularAccessoryBase = accessoryRows
          .filter((row) => !row.isCreditSale && getAccessoryCalculationBase(row) > 0)
          .reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
        const positiveCreditAccessoryBase = accessoryRows
          .filter((row) => row.isCreditSale && getAccessoryCalculationBase(row) > 0)
          .reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
        const regularAccessoryBase = positiveRegularAccessoryBase + negativeRegularAccessoryRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
        const creditAccessoryBase = positiveCreditAccessoryBase + negativeCreditAccessoryRows.reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0);
        const accessoryBase = regularAccessoryBase + creditAccessoryBase;
        const techGrossProfitBase = techRows.reduce((sum, row) => sum + getRetailTechCalculationBase(row), 0);
        const creditTechGrossProfitBase = creditTechRowsForEmployee.reduce((sum, row) => sum + getCreditTechCalculationBase(row), 0);
        const techBonus = techGrossProfitBase * 0.1 + creditTechGrossProfitBase * 0.91 * 0.1;

        return {
          manager: payrollRow.manager,
          salaryType: payrollRow.salaryType,
          workedDays: payrollRow.workedDays,
          dayPay: payrollRow.dayPay,
          serviceBase,
          serviceBonus: serviceBase * 0.5,
          serviceMissedBase,
          regularAccessoryBase,
          creditAccessoryBase,
          accessoryBase,
          accessoryBonus: accessoryBase * (payrollRow.accessoryRate ?? 0.05),
          negativeAccessoryCount: negativeAccessoryRows.length,
          negativeAccessoryBase,
          techGrossProfitBase,
          creditTechGrossProfitBase,
          techBonus,
          salesBonus: payrollRow.salesBonus,
          grossPay: payrollRow.grossPay,
        };
      }),
    [classification.rows, fullPayrollRows],
  );
  const payrollDiagnosticsWithCreditAccessories = useMemo(
    () => payrollDiagnosticsByEmployee.filter((row) => row.creditAccessoryBase > 0),
    [payrollDiagnosticsByEmployee],
  );
  const payrollDiagnosticsWithMissedServices = useMemo(
    () => payrollDiagnosticsByEmployee.filter((row) => row.serviceMissedBase > 0),
    [payrollDiagnosticsByEmployee],
  );
  const invalidNumberRows = useMemo(() => classification.rows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))), [classification.rows]);
  const productReviewGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        item: string;
        category: string;
        article: string;
        rows: ClassifiedSalesRow[];
        managers: Set<string>;
        clients: Set<string>;
        reasons: Set<string>;
        revenue: number;
        grossProfit: number;
        actionRow: ClassifiedSalesRow;
        problemType: ProblemType;
      }
    >();
    const seenRows = new Set<string>();
    const candidateRows = [
      ...classification.accessoryExcludedRows,
      ...unclassifiedRows,
      ...invalidNumberRows,
      ...classification.expensiveReviewRows,
      ...wholesaleReviewRows,
      ...retailReviewRows,
      ...creditReviewRows,
      ...zeroBaseRows.filter(isCriticalZeroBaseRow),
    ];

    for (const row of candidateRows) {
      const rowKey = [row.manager, row.client, row.category, row.item, row.article, row.revenue, row.grossProfit, row.matchedRule].join('\u0000');
      if (seenRows.has(rowKey)) continue;
      seenRows.add(rowKey);

      const groupKey = [normalizeText(row.item), normalizeText(row.category), normalizeText(row.article || '-')].join('\u0000');
      const existing =
        groups.get(groupKey) ??
        ({
          key: groupKey,
          item: row.item,
          category: row.category,
          article: row.article,
          rows: [],
          managers: new Set<string>(),
          clients: new Set<string>(),
          reasons: new Set<string>(),
          revenue: 0,
          grossProfit: 0,
          actionRow: row,
          problemType: row.isCreditSale ? 'credit' : row.calculationType === 'WHOLESALE_REVIEW_TECH' ? 'wholesaleReview' : row.calculationType === 'RETAIL_REVIEW_TECH' ? 'retailReview' : row.matchedRule === 'new-expensive-review' ? 'expensiveUnclassified' : 'disputed',
        } satisfies {
          key: string;
          item: string;
          category: string;
          article: string;
          rows: ClassifiedSalesRow[];
          managers: Set<string>;
          clients: Set<string>;
          reasons: Set<string>;
          revenue: number;
          grossProfit: number;
          actionRow: ClassifiedSalesRow;
          problemType: ProblemType;
        });

      existing.rows.push(row);
      existing.managers.add(row.manager);
      existing.clients.add(row.client);
      existing.revenue += row.revenue;
      existing.grossProfit += row.grossProfit;
      if (!existing.article && row.article) existing.article = row.article;
      if (classification.accessoryExcludedRows.includes(row)) existing.reasons.add('аксессуар исключён из расчёта');
      if (!row.calculationType) existing.reasons.add('нет классификации');
      if ([row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))) existing.reasons.add('ошибка в числах');
      if (row.matchedRule === 'new-expensive-review') existing.reasons.add('новый дорогой товар');
      if (row.calculationType === 'WHOLESALE_REVIEW_TECH') existing.reasons.add('спорная техника опта');
      if (row.calculationType === 'RETAIL_REVIEW_TECH') existing.reasons.add('спорная техника розницы');
      if (row.calculationType === 'CREDIT_REVIEW_NO_BONUS') existing.reasons.add('кредитный товар требует решения');
      if (isCriticalZeroBaseRow(row)) existing.reasons.add('нулевая база без понятного расчёта');
      if (!getManualRuleId(existing.actionRow) && getManualRuleId(row)) {
        existing.actionRow = row;
      }
      groups.set(groupKey, existing);
    }

    return Array.from(groups.values()).sort((left, right) => right.rows.length - left.rows.length || Math.abs(right.revenue) - Math.abs(left.revenue));
  }, [classification.accessoryExcludedRows, classification.expensiveReviewRows, creditReviewRows, invalidNumberRows, retailReviewRows, unclassifiedRows, wholesaleReviewRows, zeroBaseRows]);
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
  const auditInvalidNumberRows = useMemo(() => auditClassification.rows.filter((row) => [row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))), [auditClassification.rows]);
  const auditSuspiciousTechCostRows = useMemo(() => auditClassification.rows.filter(isSuspiciousTechCostRow), [auditClassification.rows]);
  const auditUnclassifiedRows = useMemo(() => auditClassification.rows.filter((row) => !row.calculationType), [auditClassification.rows]);
  const auditRetailReviewRows = useMemo(() => auditClassification.rows.filter((row) => row.calculationType === 'RETAIL_REVIEW_TECH'), [auditClassification.rows]);
  const auditWholesaleReviewRows = useMemo(() => auditClassification.rows.filter((row) => row.calculationType === 'WHOLESALE_REVIEW_TECH'), [auditClassification.rows]);
  const auditActionRows = useMemo(() => {
    const seen = new Set<string>();
    const rows = [
      ...auditUnclassifiedRows,
      ...auditInvalidNumberRows,
      ...auditSuspiciousTechCostRows,
      ...auditClassification.accessoryExcludedRows,
      ...auditRetailReviewRows,
      ...auditWholesaleReviewRows,
      ...auditClassification.expensiveReviewRows,
    ];

    return rows.filter((row) => {
      const key = [row.manager, row.client, row.category, row.item, row.article, row.revenue, row.grossProfit, row.matchedRule].join('\u0000');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [auditClassification.accessoryExcludedRows, auditClassification.expensiveReviewRows, auditInvalidNumberRows, auditRetailReviewRows, auditSuspiciousTechCostRows, auditUnclassifiedRows, auditWholesaleReviewRows]);
  const topRetailAccessoryAuditRows = useMemo(
    () => auditClassification.rows.filter((row) => row.calculationType === 'RETAIL_ACCESSORY_5').sort((left, right) => right.revenue - left.revenue).slice(0, 30),
    [auditClassification.rows],
  );
  const topWholesaleAccessoryAuditRows = useMemo(
    () => auditClassification.rows.filter((row) => row.calculationType === 'WHOLESALE_INCLUDED_1_75').sort((left, right) => right.revenue - left.revenue).slice(0, 30),
    [auditClassification.rows],
  );
  const topBonusAuditRows = useMemo(
    () => auditClassification.rows.filter((row) => Number.isFinite(row.bonus) && row.bonus !== 0).sort((left, right) => Math.abs(right.bonus) - Math.abs(left.bonus)).slice(0, 30),
    [auditClassification.rows],
  );
  const expensiveAutomaticAuditRows = useMemo(
    () =>
      auditClassification.rows
        .filter((row) => !row.matchedRule.startsWith('manual-rule:') && !['manual-accessory', 'manual-tech', 'manual-excluded'].some((marker) => row.classificationReason.includes(marker)))
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 30),
    [auditClassification.rows],
  );
  const newExpensiveAuditRows = useMemo(
    () => [...auditClassification.expensiveReviewRows].sort((left, right) => right.revenue - left.revenue),
    [auditClassification.expensiveReviewRows],
  );
  const serviceAuditRows = useMemo(
    () => auditClassification.rows.filter((row) => row.calculationType === 'RETAIL_FILM_50').sort((left, right) => Math.abs(right.revenue) - Math.abs(left.revenue)),
    [auditClassification.rows],
  );
  const asadPlotterAuditRows = useMemo(
    () => auditClassification.rows.filter(isPlotterCalculationRow).sort((left, right) => Math.max(Math.abs(right.bonus), Math.abs(right.cost)) - Math.max(Math.abs(left.bonus), Math.abs(left.cost))),
    [auditClassification.rows],
  );
  const manualClassificationAuditRows = useMemo(
    () => auditClassification.rows.filter((row) => row.matchedRule.startsWith('manual-rule:')),
    [auditClassification.rows],
  );

  function openProblemRows(problemType: ProblemType, manager = 'all') {
    setProblemTypeFilter(problemType);
    setProblemManagerFilter(manager);
    setProblemDepartmentFilter('all');
    setProblemCategoryFilter('all');
    setProblemClientFilter('all');
    setProblemSearch('');
    setProblemArticleSearch('');
    setActivePayrollTab('Аудит расчёта');
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

  function replaceBonusDrafts(previousDrafts: PayrollBonusDraft[], drafts: PayrollBonusDraft[]) {
    const previousIds = new Set(previousDrafts.map((draft) => draft.id));
    setBonusState((current) => current.periodKey !== selectedPayrollPeriodKey ? current : {
      periodKey: current.periodKey,
      drafts: [...current.drafts.filter((draft) => !previousIds.has(draft.id)), ...drafts],
      error: '',
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
    setAttendancePreview(null);
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
    if (attendancePreview.period.periodKey !== selectedPayrollPeriodKey) {
      setAttendanceApplyResult(null);
      setAttendancePreviewError(`Предпросмотр посещаемости загружен за ${attendancePreview.period.periodKey}, а выбран период ${selectedPayrollPeriodKey}. Загрузите предпросмотр заново.`);
      return;
    }

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
      const preservedManualFields = [previous.advance, previous.comment, previous.agentCreditCommission].filter((value) => Boolean(value?.trim())).length;

      if (row.sourceType === 'form' && row.status === 'найдено по форме' && row.daysToApply !== null && row.lateCount !== null) {
        previous.workedDays = String(row.daysToApply);
        previous.lateCount = String(row.lateCount);
        previous.source = 'attendance';
        result.preservedManualFields += preservedManualFields;
        result.fullApplied += 1;
        result.rows.push({
          manager: row.manager,
          sourceType: row.sourceType,
          appliedWorkedDays: row.daysToApply,
          daySourceField: row.daySourceField,
          appliedLateCount: row.lateCount,
        });
        next[row.manager] = { ...previous };
        continue;
      }

      if (row.sourceType === 'schedule_only' && row.status === 'дни из графика, опоздания вручную' && row.daysToApply !== null) {
        next[row.manager] = {
          ...previous,
          workedDays: String(row.daysToApply),
          source: 'schedule',
        };
        result.preservedManualFields += preservedManualFields;
        result.daysOnlyApplied += 1;
        result.rows.push({
          manager: row.manager,
          sourceType: row.sourceType,
          appliedWorkedDays: row.daysToApply,
          daySourceField: row.daySourceField,
          appliedLateCount: null,
        });
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
      const selectedRows = nextSelectedSheet ? sheets[nextSelectedSheet] ?? [] : [];
      const sourceSnapshot = await buildSourceFileSnapshot(file, buffer, 'sales', {
        selectedSheet: nextSelectedSheet,
        rowCount: selectedRows.length,
      });

      setWorkbook({ fileName: file.name, sheetNames: parsed.SheetNames, sheets });
      setSelectedSheet(nextSelectedSheet);
      setSalesSourceFile(sourceSnapshot);
    } catch (caughtError) {
      setWorkbook(null);
      setSelectedSheet('');
      setSalesSourceFile(null);
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
    setPurchaseSourceFile(null);

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
      const purchaseRows = sheetToRows(XLSX, sheet);
      const result = parsePurchaseReport(purchaseRows);

      if (result.base === null) {
        throw new Error('Не найдена сумма по колонке “Увеличение нашего долга”.');
      }

      setPurchaseReport({
        fileName: file.name,
        base: result.base,
        sourceRow: result.sourceRow,
      });
      setPurchaseSourceFile(await buildSourceFileSnapshot(file, buffer, 'purchase', {
        selectedSheet: sheetName,
        rowCount: purchaseRows.length,
        parsedRowCount: 1,
        metadata: {
          base: result.base,
          sourceRow: result.sourceRow,
        },
      }));
    } catch (caughtError) {
      setPurchaseReport(null);
      setPurchaseSourceFile(null);
      setPurchaseError(caughtError instanceof Error ? caughtError.message : 'Не удалось прочитать отчёт закупок.');
    }
  }

  function getPayrollRowStatus(row: FullPayrollRow) {
    return getPayrollRowReviewReasons(row).length ? 'Проверить' : 'OK';
  }

  function getPayrollRowReviewReasons(row: FullPayrollRow) {
    const reasons = [...row.payrollReasons];
    const managerRows = classification.rows.filter((item) => item.manager === row.manager);
    const checks = [
      ['Строки без классификации', managerRows.filter((item) => !item.calculationType).length],
      ['Ошибочно исключённые аксессуары', classification.accessoryExcludedRows.filter((item) => item.manager === row.manager).length],
      ['NaN/undefined в расчётах', managerRows.filter((item) => [item.revenue, item.grossProfit, item.base, item.bonus].some((value) => !Number.isFinite(value))).length],
      ['Спорные / нерешённые строки', managerRows.filter(isUnresolvedReviewRow).length],
      ['Услуги не вошли в 50%', managerRows.filter(isServiceNotIncludedRow).length],
      ['Похожие на аксессуары, но не вошли', managerRows.filter(isPotentialAccessoryNotIncludedRow).length],
      ['Нулевая база без понятного расчёта', managerRows.filter(isCriticalZeroBaseRow).length],
      ['Подозрительно нулевая / неполная себестоимость техники', managerRows.filter(isSuspiciousTechCostRow).length],
    ];

    checks.forEach(([reason, count]) => {
      if (Number(count) > 0) reasons.push(String(reason));
    });

    return Array.from(new Set(reasons));
  }

  function getPayrollRowExportComment(row: FullPayrollRow) {
    const comments = [getPayrollExportShortType(row)];
    const managerRows = classification.rows.filter((item) => item.manager === row.manager);
    if (row.lateCount !== null) comments.push(`Опозд.: ${row.lateCount}`);
    getPayrollRowReviewReasons(row).forEach((reason) => comments.push(reason));
    if (row.comment) comments.push(row.comment);
    return comments.filter(Boolean).join(' · ');
  }

  async function loadClassificationRules() {
    setIsClassificationRulesLoading(true);
    setClassificationRuleError('');

    try {
      const response = await fetch('/api/admin/payroll/classification-rules', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить правила классификации.');
      setClassificationRules(await response.json() as PayrollClassificationRule[]);
    } catch (caughtError) {
      setClassificationRuleError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить правила классификации.');
    } finally {
      setIsClassificationRulesLoading(false);
    }
  }

  function getManualRuleActionId(action: string, row: ClassifiedSalesRow) {
    return `${action}-${row.item}-${row.category}-${row.article}`;
  }

  function getManualRuleId(row: ClassifiedSalesRow) {
    const match = row.matchedRule.match(/^manual-rule:(\d+)$/);
    return match ? Number(match[1]) : null;
  }

  async function createManualClassificationRule(
    row: ClassifiedSalesRow,
    targetCalculationType: PayrollClassificationRule['targetCalculationType'],
    manualReason: 'manual-accessory' | 'manual-tech' | 'manual-excluded',
    successMessage: string,
  ) {
    const actionId = getManualRuleActionId(manualReason, row);
    setClassificationRuleActionId(actionId);
    setClassificationRuleError('');
    setClassificationRuleMessage('');

    try {
      const response = await fetch('/api/admin/payroll/classification-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: row.article ? `${row.article} · ${row.item}` : row.item,
          matchType: 'EXACT_ITEM',
          itemText: row.item,
          categoryText: row.category,
          article: row.article || null,
          department: row.department === 'Опт' ? 'wholesale' : 'retail',
          saleContext: row.isCreditSale ? 'credit' : 'regular',
          targetCalculationType,
          reason: `${manualReason}: точечное правило по номенклатуре${row.article ? ', артикулу' : ''} и категории.`,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Не удалось создать правило.');
      }

      const savedRule = await response.json() as PayrollClassificationRule;
      setClassificationRules((currentRules) => {
        const withoutSavedRule = currentRules.filter((rule) => rule.id !== savedRule.id);
        return [savedRule, ...withoutSavedRule].sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.priority - right.priority || left.id - right.id);
      });
      void loadClassificationRules();
      setClassificationRuleMessage(successMessage);
    } catch (caughtError) {
      setClassificationRuleError(caughtError instanceof Error ? caughtError.message : 'Не удалось создать правило.');
    } finally {
      setClassificationRuleActionId(null);
    }
  }

  async function createTechClassificationRule(row: ClassifiedSalesRow) {
    return createManualClassificationRule(
      row,
      row.isCreditSale ? 'CREDIT_GROSS_PROFIT' : 'RETAIL_GROSS_PROFIT_10',
      'manual-tech',
      row.isCreditSale
        ? 'Точечное правило сохранено. Позиция пересчитана как кредитная техника.'
        : 'Точечное правило сохранено. Позиция пересчитана как техника 10% от ВП.',
    );
  }

  async function createExcludedClassificationRule(row: ClassifiedSalesRow) {
    return createManualClassificationRule(
      row,
      'MANUAL_EXCLUDED',
      'manual-excluded',
      'Точечное правило сохранено. Позиция исключена из начислений.',
    );
  }

  async function createAccessoryClassificationRule(row: ClassifiedSalesRow) {
    return createManualClassificationRule(
      row,
      'RETAIL_ACCESSORY_5',
      'manual-accessory',
      'Точечное правило сохранено. Позиция пересчитана как аксессуар 5%.',
    );
  }

  async function createCreditTechClassificationRule(row: ClassifiedSalesRow) {
    return createTechClassificationRule(row);
  }

  async function disableClassificationRule(ruleId: number) {
    const actionId = `disable-${ruleId}`;
    setClassificationRuleActionId(actionId);
    setClassificationRuleError('');
    setClassificationRuleMessage('');

    try {
      const response = await fetch(`/api/admin/payroll/classification-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Не удалось отключить правило.');
      }

      await loadClassificationRules();
      setClassificationRuleMessage('Правило отключено. Расчёт обновлён.');
    } catch (caughtError) {
      setClassificationRuleError(caughtError instanceof Error ? caughtError.message : 'Не удалось отключить правило.');
    } finally {
      setClassificationRuleActionId(null);
    }
  }

  function canCreateAccessoryRule(row: ClassifiedSalesRow, problemType?: ProblemType) {
    if (row.grossProfit < 0) return false;
    if (row.matchedRule.startsWith('manual-rule:')) return false;
    if (row.calculationType === 'RETAIL_ACCESSORY_5') return false;
    return !problemType || ['credit', 'disputed', 'wholesaleReview', 'retailReview', 'expensiveUnclassified', 'accessoryExcluded'].includes(problemType);
  }

  function canCreateCreditTechRule(row: ClassifiedSalesRow, problemType?: ProblemType) {
    if (!row.isCreditSale) return false;
    if (row.grossProfit < 0) return false;
    if (row.matchedRule.startsWith('manual-rule:')) return false;
    if (row.calculationType === 'CREDIT_GROSS_PROFIT') return false;
    return !problemType || ['credit', 'disputed', 'retailReview', 'expensiveUnclassified'].includes(problemType);
  }

  function canCreateTechRule(row: ClassifiedSalesRow, problemType?: ProblemType) {
    if (row.grossProfit < 0) return false;
    if (row.matchedRule.startsWith('manual-rule:')) return false;
    if (row.calculationType === (row.isCreditSale ? 'CREDIT_GROSS_PROFIT' : 'RETAIL_GROSS_PROFIT_10')) return false;
    return !problemType || ['credit', 'disputed', 'wholesaleReview', 'retailReview', 'expensiveUnclassified', 'accessoryExcluded'].includes(problemType);
  }

  function canCreateExcludedRule(row: ClassifiedSalesRow, problemType?: ProblemType) {
    if (row.matchedRule.startsWith('manual-rule:')) return false;
    if (row.calculationType === 'MANUAL_EXCLUDED') return false;
    return !problemType || ['credit', 'disputed', 'wholesaleReview', 'retailReview', 'expensiveUnclassified', 'accessoryExcluded', 'zeroBase'].includes(problemType);
  }

  function renderAccessoryRuleButton(row: ClassifiedSalesRow, problemType?: ProblemType) {
    const manualRuleId = getManualRuleId(row);
    const accessoryActionId = getManualRuleActionId('manual-accessory', row);
    const techActionId = getManualRuleActionId('manual-tech', row);
    const excludeActionId = getManualRuleActionId('manual-excluded', row);
    const accessoryEnabled = canCreateAccessoryRule(row, problemType);
    const techEnabled = canCreateTechRule(row, problemType);
    const excludeEnabled = canCreateExcludedRule(row, problemType);

    if (manualRuleId) {
      const disableActionId = `disable-${manualRuleId}`;

      return (
        <div className='flex min-w-[150px] flex-col gap-1'>
          <button
            type='button'
            onClick={() => void disableClassificationRule(manualRuleId)}
            disabled={classificationRuleActionId === disableActionId}
            className='rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
            title='Отключить ручное правило и вернуть автоматическую классификацию'
          >
            Сбросить ручное правило
          </button>
          <span className='text-[11px] leading-tight text-emerald-700'>Применено ручное правило.</span>
        </div>
      );
    }

    return (
      <div className='flex min-w-[150px] flex-col gap-1'>
        <button
          type='button'
          onClick={() => void createAccessoryClassificationRule(row)}
          disabled={!accessoryEnabled || classificationRuleActionId === accessoryActionId}
          className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50'
          title='Создать точечное правило аксессуара по item + category + article, если артикул есть'
        >
          В аксессуары
        </button>
        <button
          type='button'
          onClick={() => void createTechClassificationRule(row)}
          disabled={!techEnabled || classificationRuleActionId === techActionId}
          className='rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50'
          title='Создать точечное правило техники по item + category + article, если артикул есть'
        >
          {row.isCreditSale ? 'В кредитную технику' : 'В технику'}
        </button>
        <button
          type='button'
          onClick={() => void createExcludedClassificationRule(row)}
          disabled={!excludeEnabled || classificationRuleActionId === excludeActionId}
          className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50'
          title='Создать точечное правило исключения по item + category + article, если артикул есть'
        >
          Исключить из расчёта
        </button>
        {row.grossProfit < 0 && <span className='text-[11px] leading-tight text-amber-700'>Отрицательная ВП — проверить отдельно.</span>}
      </div>
    );
  }

  function getAuditActionReason(row: ClassifiedSalesRow) {
    const reasons = [];
    if (!row.calculationType) reasons.push('нет классификации');
    if ([row.revenue, row.grossProfit, row.base, row.bonus].some((value) => !Number.isFinite(value))) reasons.push('NaN/undefined в числах');
    if (isSuspiciousTechCostRow(row)) reasons.push(getSuspiciousTechCostReason(row));
    if (auditClassification.accessoryExcludedRows.includes(row)) reasons.push('аксессуар ошибочно исключён из расчёта');
    if (row.calculationType === 'RETAIL_REVIEW_TECH') reasons.push('спорная техника розницы');
    if (row.calculationType === 'WHOLESALE_REVIEW_TECH') reasons.push('спорная техника опта');
    if (row.matchedRule === 'new-expensive-review') reasons.push('новый дорогой товар требует классификации');
    return reasons.join(' · ') || row.classificationReason;
  }

  function renderAuditRowsTable(
    rows: ClassifiedSalesRow[],
    getReason: (row: ClassifiedSalesRow) => ReactNode,
    options: { showActions?: boolean; emptyText: string },
  ) {
    if (!rows.length) return <p className='rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-600'>{options.emptyText}</p>;

    return (
      <div className='max-h-[420px] overflow-auto rounded-lg border border-border'>
        <table className='w-full min-w-[1280px] text-sm'>
          <thead className='sticky top-0 z-10 bg-slate-50 text-left text-slate-500'>
            <tr>
              <th className='px-3 py-2'>Сотрудник</th>
              <th className='px-3 py-2'>Клиент</th>
              <th className='px-3 py-2'>Категория</th>
              <th className='px-3 py-2'>Номенклатура</th>
              <th className='px-3 py-2'>Артикул</th>
              <th className='px-3 py-2 text-right'>Выручка строки/агрегата</th>
              <th className='px-3 py-2 text-right'>ВП строки/агрегата</th>
              <th className='px-3 py-2'>Тип расчёта</th>
              <th className='px-3 py-2 text-right'>Начисление строки/агрегата</th>
              <th className='px-3 py-2'>Причина / пометка</th>
              {options.showActions !== false && <th className='px-3 py-2'>Действие</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.manager}-${row.item}-${row.article}-${index}`} className='border-t border-border/70 align-top'>
                <td className='px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                <td className='px-3 py-2 text-slate-700'>{row.client || '—'}</td>
                <td className='px-3 py-2 text-slate-700'>{row.category}</td>
                <td className='max-w-[360px] px-3 py-2 font-semibold leading-snug text-slate-900' title={row.item}>
                  <span className='line-clamp-2'>{row.item}</span>
                </td>
                <td className='px-3 py-2 text-slate-700'>{row.article || '—'}</td>
                <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.revenue)}</td>
                <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.grossProfit)}</td>
                <td className='px-3 py-2 text-slate-700'>{row.calculationLabel}</td>
                <td className='px-3 py-2 text-right font-semibold text-slate-900'>{formatMoney(row.bonus)}</td>
                <td className='px-3 py-2 text-slate-600'>{getReason(row)}</td>
                {options.showActions !== false && <td className='px-3 py-2'>{renderAccessoryRuleButton(row, row.isCreditSale ? 'credit' : 'disputed')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderProductReviewCard() {
    return (
      <Card>
        <div className='mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <h2 className='text-lg font-bold text-slate-900'>Что нужно решить по товарам</h2>
            <p className='mt-1 text-sm text-slate-500'>Одинаковые спорные позиции сгруппированы. Решите товар один раз, и портал создаст точечное правило для следующих расчётов.</p>
          </div>
          <div className='grid grid-cols-2 gap-2 text-sm sm:grid-cols-4'>
            <div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2'>
              <p className='text-xs font-semibold uppercase text-amber-700'>Товаров решить</p>
              <p className='text-xl font-bold text-amber-950'>{productReviewGroups.length}</p>
            </div>
            <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2'>
              <p className='text-xs font-semibold uppercase text-slate-500'>Строк</p>
              <p className='text-xl font-bold text-slate-900'>{productReviewGroups.reduce((sum, group) => sum + group.rows.length, 0)}</p>
            </div>
            <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2'>
              <p className='text-xs font-semibold uppercase text-slate-500'>Выручка</p>
              <p className='text-xl font-bold text-slate-900'>{formatMoney(productReviewGroups.reduce((sum, group) => sum + group.revenue, 0))}</p>
            </div>
            <div className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2'>
              <p className='text-xs font-semibold uppercase text-emerald-700'>С правилами</p>
              <p className='text-xl font-bold text-emerald-950'>{manualClassificationAuditRows.length}</p>
            </div>
          </div>
        </div>

        {productReviewGroups.length ? (
          <div className='max-h-[520px] overflow-auto rounded-lg border border-border'>
            <table className='w-full min-w-[1080px] text-sm'>
              <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'>
                <tr>
                  <th className='px-3 py-3'>Товар</th>
                  <th className='px-3 py-3'>Категория</th>
                  <th className='px-3 py-3'>Менеджеры</th>
                  <th className='px-3 py-3 text-right'>Строк</th>
                  <th className='px-3 py-3 text-right'>Выручка</th>
                  <th className='px-3 py-3 text-right'>ВП</th>
                  <th className='px-3 py-3'>Почему спорно</th>
                  <th className='px-3 py-3'>Решение</th>
                </tr>
              </thead>
              <tbody>
                {productReviewGroups.slice(0, 30).map((group) => (
                  <tr key={group.key} className='border-t border-border/70 align-top'>
                    <td className='max-w-[340px] px-3 py-3'>
                      <p className='font-semibold text-slate-900'>{group.item}</p>
                      <p className='mt-1 text-xs text-slate-500'>Артикул: {group.article || '—'} · клиентов: {group.clients.size}</p>
                    </td>
                    <td className='px-3 py-3 text-slate-700'>{group.category}</td>
                    <td className='max-w-[180px] px-3 py-3 text-slate-700'>{Array.from(group.managers).join(', ')}</td>
                    <td className='px-3 py-3 text-right font-semibold text-slate-900'>{group.rows.length}</td>
                    <td className='px-3 py-3 text-right text-slate-700'>{formatMoney(group.revenue)}</td>
                    <td className='px-3 py-3 text-right text-slate-700'>{formatMoney(group.grossProfit)}</td>
                    <td className='max-w-[260px] px-3 py-3'>
                      <div className='flex flex-wrap gap-1'>
                        {Array.from(group.reasons).map((reason) => (
                          <Badge key={reason} className='bg-amber-100 text-amber-900'>{reason}</Badge>
                        ))}
                      </div>
                      <p className='mt-1 text-xs text-slate-500'>{group.actionRow.calculationLabel}</p>
                    </td>
                    <td className='px-3 py-3'>{renderAccessoryRuleButton(group.actionRow, group.problemType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800'>Спорных товаров для решения не найдено.</p>
        )}
        {productReviewGroups.length > 30 && (
          <p className='mt-3 text-sm text-slate-500'>Показаны первые 30 групп. Остальные доступны ниже в технических блоках аудита.</p>
        )}
      </Card>
    );
  }

  function getPayrollExportMainAmount(row: FullPayrollRow) {
    if (row.salaryType === 'fixed_salary') return row.fixedSalary;
  if (row.salaryType === 'purchase_manager') return row.purchasePercentAmount + row.purchaseTargetAdjustment;
  if (row.salaryType === 'vl_percent') return row.grossPay;
  if (row.salaryType === 'wholesale_percent') return row.wholesaleBonus;
  return row.salesBonus;
}

  function getPayrollExportCategory(row: FullPayrollRow) {
    if (row.salaryType === 'purchase_manager') return 'Закупки';
    if (row.salaryType === 'fixed_salary') return 'Фиксированная ЗП';
    if (row.salaryType === 'vl_percent') return 'Операционное управление';
    if (row.salaryType === 'wholesale_percent') return 'Опт';
    return 'Розница';
  }

  function getPayrollExportShortType(row: FullPayrollRow) {
    if (row.salaryType === 'purchase_manager') return 'Закупщик';
    if (row.salaryType === 'fixed_salary') return 'Оклад';
    if (row.salaryType === 'vl_percent') return 'Начислено 12%';
    if (row.salaryType === 'wholesale_percent') return 'Опт 1,75%';
    return 'Розница';
  }

  function toExportMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  function getManagerComponentBases(manager: string) {
    const managerRows = classification.rows.filter((row) => row.manager === manager);
    return {
      credit: getCreditTechCalculationRows(managerRows).reduce((sum, row) => sum + getCreditTechCalculationBase(row), 0),
      film: managerRows.filter((row) => row.calculationType === 'RETAIL_FILM_50').reduce((sum, row) => sum + row.base, 0),
      plotter: managerRows.filter((row) => row.calculationType === 'RETAIL_PLOTTER_MATERIAL_COST_50').reduce((sum, row) => sum + row.base, 0),
      tech: getRetailTechCalculationRows(managerRows).reduce((sum, row) => sum + getRetailTechCalculationBase(row), 0),
      accessory: getAccessoryCalculationRows(managerRows).reduce((sum, row) => sum + getAccessoryCalculationBase(row), 0),
    };
  }

  function buildAccrualExportRows() {
    return fullPayrollRows.flatMap((row) => {
      const baseColumns = [row.manager, getPayrollExportCategory(row), getPayrollExportShortType(row)] as const;
      const rowsForEmployee: Array<Array<string | number | null>> = [];
      const push = (component: string, base: string | number | null, formula: string, amount: number, comment = '') => {
        rowsForEmployee.push([...baseColumns, component, typeof base === 'number' ? toExportMoney(base) : base, formula, toExportMoney(amount), comment]);
      };
      const pushBonuses = () => bonusValidation.bonuses.filter((bonus) => bonus.employeeName === row.manager).forEach((bonus) => push('Разовая премия', null, 'сверх обычного расчёта и гарантии; вне базы 12% Бэлы', bonus.amount, bonus.reason));

      if (row.salaryType === 'fixed_salary') {
        push('Фиксированный оклад', row.fixedSalary, 'оклад', row.fixedSalary, row.position);
        if (row.fixedBonus) push('Премия', row.fixedBonus, 'ручной ввод', row.fixedBonus);
        pushBonuses();
        push('Начислено за месяц', null, 'оклад + премии', row.grossPay);
        if (row.advance) push('Аванс', row.advance, 'вычитается после начисления зарплаты', -row.advance);
        if (row.fixedDeduction) push('Удержание', row.fixedDeduction, 'вычитается после начисления зарплаты', -row.fixedDeduction);
        push('К выплате', row.grossPay, 'оклад + премия - аванс - удержание', row.netPay, row.comment);
        return rowsForEmployee;
      }

      if (row.salaryType === 'purchase_manager') {
        push('Оплата по дням', purchaseStandardWorkedDays, `${purchaseStandardWorkedDays} × ${purchaseDayRate}`, row.dayPay, `ставка ${formatMoney(purchaseDayRate)}`);
        push('Закупки 1,75%', row.purchaseBase, 'закупки × 1,75%', row.purchasePercentAmount);
        push('Доплата закупщику до минимальной зарплаты', row.purchaseTargetSalary, 'минимальная зарплата − оплата дней − бонус с закупок 1,75%', row.purchaseTargetAdjustment);
        pushBonuses();
        push('Начислено за месяц', null, 'оплата за дни + процент с закупок + доплата + премии', row.grossPay);
        if (row.advance) push('Аванс', row.advance, 'вычитается после начисления зарплаты', -row.advance);
        if (row.fixedDeduction) push('Удержание', row.fixedDeduction, 'вычитается после начисления зарплаты', -row.fixedDeduction);
        push('К выплате', row.grossPay, getSalaryFormulaLabel(row.salaryType), row.netPay, row.comment);
        return rowsForEmployee;
      }

      if (row.dayPay) push('Оплата по дням', row.workedDays, `${row.workedDays ?? 0} × ${row.dayRate}`, row.dayPay, getPayrollDaysSourceLabel(row.daysSource));

      if (row.salaryType === 'vl_percent') {
        push('Начисление 12%', row.belaBase ?? 0, '12% от обычных начислений выбранных сотрудников, без разовых премий', row.belaPercentAmount ?? 0);
        if (getBelaMinimum(selectedPayrollPeriodKey)) push('Доплата до минимальной зарплаты', getBelaMinimum(selectedPayrollPeriodKey), 'не менее 100 000 ₽ за месяц', row.minimumGuaranteeAdjustment ?? 0);
      } else if (row.salaryType === 'wholesale_percent') {
        push('Бонус опта 1,75%', classification.wholesale.base, 'общая база опта × 1,75%', row.wholesaleBonus);
      } else {
        const bases = getManagerComponentBases(row.manager);
        if (row.filmBonus) push('Услуги оказываемые 50%', bases.film, 'выручка × 50%', row.filmBonus);
        if (row.plotterBonus) push('Плоттерные материалы 50% от с/с', bases.plotter, 'с/с × 50%', row.plotterBonus);
        if (row.techBonus) push('Техника 10% от ВП', bases.tech, 'ВП × 10%', row.techBonus);
        if (row.accessoryBonus) {
          const ratePercent = Math.round((row.accessoryRate ?? 0.05) * 100);
          push(
            `Аксессуары ${ratePercent}%`,
            bases.accessory,
            `личная база × ${ratePercent}%`,
            row.accessoryBonus,
            `Общая база команды ${formatMoney(retailAccessoryTier.teamBase)}; порог ${formatMoney(retailAccessoryTier.threshold)}`,
          );
        }
        if (row.creditBonus) push('Кредитный бонус', bases.credit, 'ВП × 0,91 × 10%', row.creditBonus);
      }

      if (row.disciplineBonus) push('Дисциплина', row.lateCount, 'опозданий ≤ 3', row.disciplineBonus);
      if (row.agentCreditCommission > 0) push('Агентские по кредитам', null, 'ручной ввод', row.agentCreditCommission, 'Отдельное ручное начисление');
      pushBonuses();
      push('Начислено за месяц', null, 'сумма начислений до аванса и удержаний', row.grossPay);
      if (row.advance) push('Аванс', row.advance, 'вычитается после начисления зарплаты', -row.advance);
      push('К выплате', row.grossPay, `${getSalaryFormulaLabel(row.salaryType, selectedPayrollPeriodKey)}${row.oneTimeBonus ? '; + разовая премия' : ''}`, row.netPay, row.comment);

      return rowsForEmployee;
    });
  }

  function buildPayrollCheckRows() {
    const employeeCheckRows = fullPayrollRows.flatMap((row) => {
      const managerRows = classification.rows.filter((item) => item.manager === row.manager);
      const payrollReasonRows = row.payrollReasons.map((reason) => [
        row.manager,
        reason,
        1,
        'Проверить',
        reason === 'Посещаемость по форме не подтверждена'
          ? 'Дни рассчитаны по Google Sheets "График посещений". Отметок прихода/ухода из Google-формы нет, поэтому опоздания и фактическое присутствие нужно проверить вручную.'
          : reason,
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
      const checks = [
        ['Спорные / нерешённые строки', managerRows.filter(isUnresolvedReviewRow).length, 'Проверить', 'Требуется ручная классификация строки'],
        ['Похожие на аксессуары, но не вошли', managerRows.filter(isPotentialAccessoryNotIncludedRow).length, 'Проверить', 'Проверьте, нужно ли создать ручное правило'],
        ['Услуги не вошли в 50%', managerRows.filter(isServiceNotIncludedRow).length, 'Проверить', 'Строка похожа на услуги, но не попала в расчёт услуг'],
        ['Нулевая база без понятного расчёта', managerRows.filter(isCriticalZeroBaseRow).length, 'Проверить', 'База расчёта равна нулю, но строка может влиять на зарплату'],
        ['Строки без классификации', managerRows.filter((item) => !item.calculationType).length, 'Ошибка', 'Нет классификации строки'],
        ['NaN/undefined в расчётах', managerRows.filter((item) => [item.revenue, item.grossProfit, item.base, item.bonus].some((value) => !Number.isFinite(value))).length, 'Ошибка', 'В строке есть некорректные числовые значения'],
        ['Ошибочно исключённые аксессуары', classification.accessoryExcludedRows.filter((item) => item.manager === row.manager).length, 'Ошибка', 'Аксессуар исключён из расчёта и требует проверки'],
        ['Ручная корректировка дней', row.daysSource === 'manualCorrection' ? 1 : 0, 'Контроль / учтено', 'Дни или опоздания изменены вручную'],
      ];

      return [
        ...payrollReasonRows,
        ...checks
        .filter(([, count]) => Number(count) > 0)
        .map(([check, count, status, comment]) => [row.manager, check, count, status, comment, '', '', '', '', '', '']),
      ];
    });

    const suspiciousCostRows = classification.rows
      .filter(isSuspiciousTechCostRow)
      .map((row) => [
        row.manager,
        'Подозрительно нулевая / неполная себестоимость техники',
        1,
        'Проверить',
        getSuspiciousTechCostReason(row),
        row.category,
        row.item,
        row.article || '',
        toExportMoney(row.revenue),
        toExportMoney(row.cost),
        toExportMoney(row.grossProfit),
      ]);

    return [...employeeCheckRows, ...suspiciousCostRows];
  }

  async function loadSavedPayrollPeriods() {
    setIsSavedPeriodsLoading(true);
    try {
      const response = await fetch('/api/admin/payroll/periods', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить сохранённые расчёты.');
      setSavedPeriods(await response.json() as SavedPayrollPeriod[]);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить сохранённые расчёты.');
    } finally {
      setIsSavedPeriodsLoading(false);
    }
  }

  function getPayrollRunStatusLabel(status: string) {
    if (status === 'FINAL') return 'Финальный';
    if (status === 'CHECKED') return 'Проверен';
    if (status === 'SUPERSEDED') return 'Заменён';
    return 'Черновик';
  }

  function getPayrollRunStatusClass(status: string) {
    if (status === 'FINAL') return 'bg-green-100 text-green-800';
    if (status === 'CHECKED') return 'bg-blue-100 text-blue-800';
    if (status === 'SUPERSEDED') return 'bg-slate-200 text-slate-700';
    return 'bg-slate-100 text-slate-700';
  }

  function requestPayrollRunFinal(period: SavedPayrollPeriod, run: SavedPayrollRunSummary) {
    const existingFinal = period.runs.find((candidate) => candidate.status === 'FINAL' && candidate.id !== run.id);
    if (existingFinal) {
      setPayrollFinalReplacement({ periodKey: period.periodKey, targetRun: run, existingFinal });
      return;
    }
    void updatePayrollRunStatus(run.id, 'FINAL');
  }

  async function updatePayrollRunStatus(runId: number, status: 'CHECKED' | 'FINAL', replaceExistingFinal = false) {
    setPayrollHistoryActionId(`run-${runId}-${status}`);
    setSaveError('');
    setSaveStatus('');

    try {
      const response = await fetch(`/api/admin/payroll/runs/${runId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, replaceExistingFinal }),
      });

      const body = await response.json().catch(() => ({})) as {
        error?: unknown;
        runNumber?: unknown;
        replacedFinal?: { runNumber?: unknown } | null;
      };

      if (!response.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Не удалось изменить статус расчёта.');
      }

      const replacedRunNumber = typeof body.replacedFinal?.runNumber === 'number' ? body.replacedFinal.runNumber : null;
      const updatedRunNumber = typeof body.runNumber === 'number' ? body.runNumber : null;
      setSaveStatus(status === 'FINAL'
        ? replacedRunNumber && updatedRunNumber
          ? `Расчёт №${updatedRunNumber} назначен финальным. Расчёт №${replacedRunNumber} сохранён в истории как заменённый.`
          : 'Расчёт отмечен как финальный.'
        : 'Расчёт отмечен как проверенный.');
      setPayrollFinalReplacement(null);
      await loadSavedPayrollPeriods();
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : 'Не удалось изменить статус расчёта.');
    } finally {
      setPayrollHistoryActionId(null);
    }
  }

  async function updatePayrollPeriodStatus(periodId: number, status: 'OPEN' | 'CLOSED') {
    setPayrollHistoryActionId(`period-${periodId}-${status}`);
    setSaveError('');
    setSaveStatus('');

    try {
      const response = await fetch(`/api/admin/payroll/periods/${periodId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Не удалось изменить статус периода.');
      }

      setSaveStatus(status === 'CLOSED' ? 'Период закрыт.' : 'Период открыт.');
      await loadSavedPayrollPeriods();
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : 'Не удалось изменить статус периода.');
    } finally {
      setPayrollHistoryActionId(null);
    }
  }

  async function openSavedPayrollRun(runId: number) {
    setIsSavedRunLoading(true);
    setSaveError('');

    try {
      const response = await fetch(`/api/admin/payroll/runs/${runId}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось открыть сохранённый расчёт.');
      setSelectedSavedRun(await response.json() as SavedPayrollRunDetail);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : 'Не удалось открыть сохранённый расчёт.');
    } finally {
      setIsSavedRunLoading(false);
    }
  }

  async function exportSavedPayrollWorkbook() {
    if (!selectedSavedRun) return;
    setIsSavedRunExporting(true);
    setSaveError('');
    setSaveStatus('');

    try {
      const sortedRows = sortPayrollWorkbookEmployees(selectedSavedRun.employeeResults);
      const savedAccessoryTier = getSavedRetailAccessoryTier(selectedSavedRun.sourceSummary);
      const employeeRows = sortedRows.map((row) => {
        const savedDetailAmount = (component: string) => row.calculationDetails
          .filter((detail) => detail.component === component)
          .reduce((sum, detail) => sum + detail.amount, 0);
        const performancePay = row.salaryType === 'purchase_manager'
          ? row.purchasePercentAmount
          : row.salaryType === 'wholesale_percent' || row.salaryType === 'retail_sales_bonus'
            ? row.salesBonus
            : row.salaryType === 'vl_percent'
              ? savedDetailAmount('Начисление 12%')
              : 0;
        const basePay = row.salaryType === 'fixed_salary' ? row.fixedSalary : row.dayPay;
        const oneTimeBonus = (row.adjustments ?? []).filter((adjustment) => adjustment.type === 'ONE_TIME_BONUS').reduce((sum, adjustment) => sum + adjustment.amount, 0);
        const additionalPay = row.fixedBonus + row.agentCreditCommission + oneTimeBonus;
        const specialPay = row.salaryType === 'purchase_manager'
          ? row.purchaseTargetAdjustment
          : row.salaryType === 'vl_percent'
            ? savedDetailAmount('Доплата до минимальной зарплаты')
            : row.grossPay - basePay - performancePay - row.disciplineBonus - additionalPay;
        return {
          employeeName: row.employeeName,
          category: row.reportGroup || getPayrollWorkbookGroup(row.salaryType),
          salaryType: row.salaryType,
          grossPay: toExportMoney(row.grossPay),
          workedDays: row.workedDays,
          basePay: toExportMoney(basePay),
          performancePay: toExportMoney(performancePay),
          specialPay: toExportMoney(specialPay),
          disciplinePay: toExportMoney(row.disciplineBonus),
          additionalPay: toExportMoney(additionalPay),
          advance: toExportMoney(row.advance),
          deduction: toExportMoney(row.fixedDeduction),
          netPay: toExportMoney(row.netPay),
          status: getPayrollWorkbookStatusLabel(row.status),
          comment: [row.comment, ...getSavedEmployeeReasons(row)].filter(Boolean).join(' · '),
        };
      });
      const accrualRows = sortedRows.flatMap((employee) => {
        const reportGroup = employee.reportGroup || getPayrollWorkbookGroup(employee.salaryType);
        const visibleDetails = employee.calculationDetails
          .filter((detail) => !(detail.amount === 0 && ['Премия', 'Аванс', 'Удержание'].includes(detail.component)))
          .map((detail) => [
            employee.employeeName,
            reportGroup,
            employee.position || reportGroup,
            getPayrollWorkbookComponentLabel(detail.component),
            detail.base,
            detail.formula || 'Не сохранено в этой версии',
            detail.amount,
            detail.comment,
          ] as Array<string | number | null>);
        const payoutIndex = visibleDetails.findIndex((detail) => detail[3] === 'К выплате');
        if (!visibleDetails.some((detail) => detail[3] === 'Начислено за месяц')) {
          visibleDetails.splice(payoutIndex >= 0 ? payoutIndex : visibleDetails.length, 0, [
            employee.employeeName,
            reportGroup,
            employee.position || reportGroup,
            'Начислено за месяц',
            null,
            'сумма начислений до аванса и удержаний',
            employee.grossPay,
            '',
          ]);
        }
        if (!visibleDetails.some((detail) => detail[3] === 'К выплате')) {
          visibleDetails.push([
            employee.employeeName,
            reportGroup,
            employee.position || reportGroup,
            'К выплате',
            employee.grossPay,
            'начислено за месяц − аванс − удержания',
            employee.netPay,
            employee.comment,
          ]);
        }
        return visibleDetails;
      });
      const checkRows = sortedRows.flatMap((employee) => {
        const reasons = getSavedEmployeeReasons(employee);
        return reasons.map((reason) => [employee.employeeName, reason, 1, 'Проверить', reason, '', '', '', '', '', '']);
      });
      const reviewRows = getSavedRunReviewReasons(selectedSavedRun).map((item) => ['Расчёт в целом', item.reason, item.count, 'Проверить', item.reason, '', '', '', '', '', '']);
      const sourceRows: Array<Array<string | number | null>> = [
        ['Период', selectedSavedRun.period.periodKey, 'Месяц расчёта'],
        ['Версия расчёта', `Расчёт №${selectedSavedRun.runNumber} · ${getPayrollRunStatusLabel(selectedSavedRun.status)}`, 'Экспортируется зафиксированная версия без повторного пересчёта'],
        ['Сохранён', new Date(selectedSavedRun.createdAt).toLocaleString('ru-RU'), 'Дата фиксации расчёта в портале'],
        ['Всего начислено', selectedSavedRun.grossPay, 'Сохранённый итог по всем сотрудникам'],
        ['К выплате', selectedSavedRun.netPay, 'После авансов и удержаний'],
        ...(savedAccessoryTier ? [
          ['Уровень аксессуаров', `${formatMoney(savedAccessoryTier.teamBase)} / порог ${formatMoney(savedAccessoryTier.threshold)}`, savedAccessoryTier.elevated ? 'Порог превышен' : 'Порог не превышен'],
          ['Ставка аксессуаров', `${Math.round(savedAccessoryTier.rate * 100)}%`, 'Зафиксированная ставка сохранённого расчёта'],
        ] : []),
        ...selectedSavedRun.sourceFiles.map((file) => [
          `Источник: ${getSavedSourceTypeLabel(file.type)}`,
          file.originalName,
          `Лист: ${file.selectedSheet ?? 'не сохранён'}; строк: ${file.rowCount ?? 'не сохранено'}; распознано: ${file.parsedRowCount ?? 'не сохранено'}`,
        ]),
        ...selectedSavedRun.manualInputs.map((input) => [
          `Ручные данные: ${input.employeeName}`,
          getSavedInputTypeLabel(input.inputType),
          [`дни ${input.workedDays ?? '—'}`, `опоздания ${input.lateCount ?? '—'}`, `аванс ${input.advance ?? input.purchaseAdvance ?? '—'}`, `премия ${input.fixedBonus ?? '—'}`, `удержание ${input.fixedDeduction ?? input.purchaseDeduction ?? '—'}`, input.comment].filter(Boolean).join('; '),
        ]),
      ];
      const savedRules = Array.from(new Map(sortedRows.flatMap((employee) => employee.calculationDetails).map((detail) => [
        `${detail.component}|${detail.formula}`,
        [getPayrollWorkbookComponentLabel(detail.component), detail.formula || 'Не сохранено в этой версии', 'Формула из зафиксированной расшифровки'],
      ])).values());
      sourceRows.push(...savedRules);

      await downloadPayrollWorkbook({
        periodLabel: `${months[selectedSavedRun.period.month]} ${selectedSavedRun.period.year}`,
        versionLabel: `Сохранённый расчёт №${selectedSavedRun.runNumber} · ${getPayrollRunStatusLabel(selectedSavedRun.status)}`,
        generatedAt: new Date().toLocaleString('ru-RU'),
        employeeRows,
        accrualRows,
        checkRows: [...reviewRows, ...checkRows],
        sourceRows,
        fileName: `Зарплата_${months[selectedSavedRun.period.month]}_${selectedSavedRun.period.year}_расчёт_${selectedSavedRun.runNumber}.xlsx`,
      });
      setSaveStatus(`Ведомость по сохранённому расчёту №${selectedSavedRun.runNumber} скачана.`);
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : 'Не удалось сформировать ведомость сохранённого расчёта.');
    } finally {
      setIsSavedRunExporting(false);
    }
  }

  function buildCalculationDetailsByEmployee() {
    return buildAccrualExportRows().reduce<Record<string, Array<{ component: string; base: number | null; formula: string; amount: number; comment: string; order: number }>>>((acc, detailRow) => {
      const employeeName = String(detailRow[0] ?? '');
      if (!employeeName) return acc;
      const currentRows = acc[employeeName] ?? [];
      currentRows.push({
        component: String(detailRow[3] ?? ''),
        base: typeof detailRow[4] === 'number' ? detailRow[4] : null,
        formula: String(detailRow[5] ?? ''),
        amount: typeof detailRow[6] === 'number' ? detailRow[6] : Number(detailRow[6] ?? 0) || 0,
        comment: String(detailRow[7] ?? ''),
        order: currentRows.length,
      });
      acc[employeeName] = currentRows;
      return acc;
    }, {});
  }

  function buildPayrollAnalyticsRowsPayload(): PayrollAnalyticsRowSnapshot[] {
    if (!salesSourceFile) return [];

    return classification.rows.map((row) => {
      const marginPercent = row.revenue !== 0 ? (row.grossProfit / row.revenue) * 100 : null;
      const markupPercent = row.cost !== 0 ? (row.grossProfit / row.cost) * 100 : null;
      const problemFlags = getAnalyticsProblemFlags(row);

      return {
        sourceFileType: 'sales',
        sourceFileName: salesSourceFile.originalName,
        employeeName: row.manager,
        employeeId: null,
        department: row.department,
        location: row.department,
        client: row.client,
        category: row.category,
        nomenclatureType: null,
        itemName: row.item,
        article: row.article,
        quantity: null,
        revenue: row.revenue,
        cost: row.cost,
        grossProfit: row.grossProfit,
        marginPercent,
        markupPercent,
        calculationType: row.calculationType,
        componentType: isAccessoryBonusRow(row) && payrollAccessoryCalculation.eligibleManagers.has(row.manager)
          ? `Аксессуары: ${retailAccessoryTier.ratePercent}%`
          : row.calculationLabel,
        commissionAmount: isAccessoryBonusRow(row) && payrollAccessoryCalculation.eligibleManagers.has(row.manager)
          ? getAccessoryCalculationBase(row) * retailAccessoryTier.rate
          : row.bonus,
        isCredit: row.isCreditSale,
        isReturn: hasRegistrarFragment(row, 'Возврат'),
        isNegative: row.revenue < 0 || row.grossProfit < 0,
        isManualRuleApplied: row.matchedRule.startsWith('manual-rule:'),
        manualRuleLabel: row.matchedRule.startsWith('manual-rule:') ? row.matchedRule : null,
        problemFlags,
        checkReason: getAnalyticsCheckReason(row, problemFlags),
      };
    });
  }

  function buildPayrollSnapshotPayload() {
    const detailsByEmployee = buildCalculationDetailsByEmployee();
    const reviewCount = fullPayrollRows.filter((row) => getPayrollRowStatus(row) !== 'OK').length;
    const deductions = fullPayrollRows.reduce((sum, row) => sum + row.fixedDeduction, 0);
    const sourceFiles = [
      salesSourceFile
        ? {
            ...salesSourceFile,
            parsedRowCount: parseResult.rows.length,
            warnings: parseResult.warnings,
            metadata: {
              ...(salesSourceFile.metadata ?? {}),
              isRegistrarReport: parseResult.isRegistrarReport,
              isSafeForPayrollCalculation: parseResult.isSafeForPayrollCalculation,
              sourceRowCount: parseResult.sourceRowCount,
              detailRowCount: parseResult.detailRowCount,
              managerCount: parseResult.managers.length,
              clientCount: parseResult.clients.length,
            },
          }
        : null,
      purchaseSourceFile,
    ].filter(Boolean);

    return {
      compensationVersion: PAYROLL_COMPENSATION_VERSION,
      bonuses: bonusDrafts,
      period: {
        year: Number(year),
        month: Number(month),
      },
      totals: {
        employeeCount: fullPayrollRows.length,
        reviewCount,
        grossPay: payrollTotals.grossPay,
        netPay: payrollTotals.netPay,
        advance: payrollTotals.advance,
        deductions,
        dayPay: payrollTotals.dayPay,
        salesBonus: payrollTotals.salesBonus,
        disciplineBonus: payrollTotals.disciplineBonus,
      },
      sourceSummary: {
        status: reviewCount > 0 || registrarParseUnsafe || classificationErrorCount > 0 ? 'REVIEW' : 'DRAFT',
        periodLabel: `${months[Number(month)]} ${year}`,
        totalRevenue,
        totalGrossProfit,
        totalBonus,
        wholesaleTotalBonus,
        retailTotalBonus,
        retailAccessoryTier: {
          teamBase: retailAccessoryTier.teamBase,
          threshold: retailAccessoryTier.threshold,
          rate: retailAccessoryTier.rate,
          elevated: retailAccessoryTier.elevated,
          eligibleEmployees: Array.from(payrollAccessoryCalculation.eligibleManagers),
        },
        purchaseBase: purchasePayrollRow.purchaseBase,
        classificationErrorCount,
        payrollReviewCount: reviewCount,
        reviewReasons: payrollReviewReasonCounts.map(([reason, count]) => ({ reason, count })),
        reviewEmployees: payrollReviewItems.map((item) => ({
          employeeName: item.row.manager,
          reasons: item.reasons,
          netPay: item.row.netPay,
        })),
        manualClassificationRuleCount: classification.rows.filter((row) => row.matchedRule.startsWith('manual-rule:')).length,
        manualClassificationRows: classification.rows
          .filter((row) => row.matchedRule.startsWith('manual-rule:'))
          .map((row) => ({
            manager: row.manager,
            category: row.category,
            item: row.item,
            article: row.article,
            calculationType: row.calculationType,
            calculationLabel: row.calculationLabel,
            classificationReason: row.classificationReason,
            matchedRule: row.matchedRule,
          })),
      },
      sourceFiles,
      analyticsRows: buildPayrollAnalyticsRowsPayload(),
      manualInputs: [
        ...Object.entries(manualPayroll).map(([employeeName, input]) => ({
          employeeName,
          inputType: 'sales',
          workedDays: input.workedDays,
          lateCount: input.lateCount,
          advance: input.advance,
          agentCreditCommission: input.agentCreditCommission ?? '',
          comment: input.comment,
          source: input.source ?? '',
        })),
        ...Object.entries(fixedPayroll).map(([employeeName, input]) => ({
          employeeName,
          inputType: 'fixed',
          advance: input.advance,
          fixedBonus: input.bonus,
          fixedDeduction: input.deduction,
          comment: input.comment,
        })),
        {
          employeeName: purchaseManagerName,
          inputType: 'purchase',
          purchaseAdvance: purchasePayroll.advance,
          purchaseDeduction: purchasePayroll.deduction,
          comment: purchasePayroll.comment,
        },
      ],
      employeeResults: fullPayrollRows.map((row, index) => ({
        belaBase: row.belaBase,
        belaPercentAmount: row.belaPercentAmount,
        minimumGuaranteeAdjustment: row.minimumGuaranteeAdjustment ?? 0,
        oneTimeBonus: row.oneTimeBonus ?? 0,
        employeeName: row.manager,
        department: row.department,
        payrollDepartment: row.payrollDepartment,
        position: row.position,
        salaryType: row.salaryType,
        reportGroup: getPayrollWorkbookGroup(row.salaryType),
        salaryRule: row.salaryRule,
        workedDays: row.workedDays,
        lateCount: row.lateCount,
        daysSource: row.daysSource,
        dayRate: row.dayRate,
        dayPay: row.dayPay,
        revenue: row.revenue,
        grossProfit: row.grossProfit,
        creditBonus: row.creditBonus,
        filmBonus: row.filmBonus,
        plotterBonus: row.plotterBonus,
        techBonus: row.techBonus,
        accessoryBonus: row.accessoryBonus,
        wholesaleBonus: row.wholesaleBonus,
        salesBonus: row.salesBonus,
        totalBonus: row.totalBonus,
        disciplineBonus: row.disciplineBonus,
        fixedSalary: row.fixedSalary,
        fixedBonus: row.fixedBonus,
        fixedDeduction: row.fixedDeduction,
        purchaseBase: row.purchaseBase,
        purchasePercent: row.purchasePercent,
        purchasePercentAmount: row.purchasePercentAmount,
        purchaseTargetAdjustment: row.purchaseTargetAdjustment,
        purchaseTargetSalary: row.purchaseTargetSalary,
        agentCreditCommission: row.agentCreditCommission,
        advance: row.advance,
        grossPay: row.grossPay,
        netPay: row.netPay,
        status: getPayrollRowStatus(row),
        reasons: getPayrollRowReviewReasons(row),
        comment: row.comment,
        order: index,
        calculationDetails: detailsByEmployee[row.manager] ?? [],
      })),
    };
  }

  async function savePayrollSnapshot() {
    if (!fullPayrollRows.length) return;
    if (isPayrollDirectoryLoading) { setSaveError('Правила сотрудников ещё загружаются. Подождите несколько секунд.'); return; }
    if (payrollDirectoryError) { setSaveError(`${payrollDirectoryError} Расчёт не сохранён, чтобы не пропустить нового сотрудника.`); return; }
    if (bonusValidation.error) { setSaveError(bonusValidation.error); return; }
    if (isCurrentPeriodClosed) {
      setSaveError('Период закрыт. Новые расчёты за этот месяц запрещены.');
      return;
    }

    setIsSavingPayroll(true);
    setSaveError('');
    setSaveStatus('');

    try {
      const response = await fetch('/api/admin/payroll/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayrollSnapshotPayload()),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Не удалось сохранить расчёт.');
      }

      const run = await response.json() as { id: number; runNumber: number };
      setLastSavedRunId(run.id);
      setSaveStatus(
        `Расчёт сохранён в PostgreSQL как ${payrollReviewCount > 0 ? 'черновик / требует проверки' : 'черновик без критичных проверок'}. Его можно открыть в блоке “Сохранённые расчёты”. Запуск #${run.runNumber}.`,
      );
      await loadSavedPayrollPeriods();
    } catch (caughtError) {
      setSaveError(caughtError instanceof Error ? caughtError.message : 'Не удалось сохранить расчёт.');
    } finally {
      setIsSavingPayroll(false);
    }
  }

  async function exportCurrentPayrollWorkbook() {
    if (isPayrollDirectoryLoading) { setSaveError('Правила сотрудников ещё загружаются. Подождите несколько секунд.'); return; }
    if (payrollDirectoryError) { setSaveError(`${payrollDirectoryError} Ведомость не сформирована, чтобы не пропустить нового сотрудника.`); return; }
    if (bonusValidation.error) { setSaveError(bonusValidation.error); return; }
    const sortedRows = sortPayrollWorkbookEmployees(fullPayrollRows.map((row) => ({ ...row, employeeName: row.manager })));
    const employeeRows = sortedRows.map((row) => {
      const performancePay = row.salaryType === 'purchase_manager'
        ? row.purchasePercentAmount
        : row.salaryType === 'wholesale_percent' || row.salaryType === 'retail_sales_bonus'
          ? row.salesBonus
          : row.salaryType === 'vl_percent'
            ? row.belaPercentAmount ?? 0
            : 0;
      const basePay = row.salaryType === 'fixed_salary' ? row.fixedSalary : row.dayPay;
      const specialPay = row.salaryType === 'purchase_manager' ? row.purchaseTargetAdjustment : row.salaryType === 'vl_percent' ? row.minimumGuaranteeAdjustment ?? 0 : 0;
      const additionalPay = row.fixedBonus + (row.oneTimeBonus ?? 0) + row.agentCreditCommission;
      return {
        employeeName: row.manager,
        category: getPayrollWorkbookGroup(row.salaryType),
        salaryType: row.salaryType,
        grossPay: toExportMoney(row.grossPay),
        workedDays: row.workedDays,
        basePay: toExportMoney(basePay),
        performancePay: toExportMoney(performancePay),
        specialPay: toExportMoney(specialPay),
        disciplinePay: toExportMoney(row.disciplineBonus),
        additionalPay: toExportMoney(additionalPay),
        advance: toExportMoney(row.advance),
        deduction: toExportMoney(row.fixedDeduction),
        netPay: toExportMoney(row.netPay),
        status: getPayrollWorkbookStatusLabel(getPayrollRowStatus(row)),
        comment: getPayrollRowExportComment(row),
      };
    });
    const accrualRows = buildAccrualExportRows()
      .sort((left, right) => {
        const order = new Map(sortedRows.map((row, index) => [row.manager, index]));
        return (order.get(String(left[0])) ?? 999) - (order.get(String(right[0])) ?? 999);
      })
      .map((row) => row.map((value, index) => index === 1 ? getPayrollWorkbookGroup(fullPayrollRows.find((employee) => employee.manager === row[0])?.salaryType ?? '') : index === 3 ? getPayrollWorkbookComponentLabel(String(value ?? '')) : value));
    const sourceRows: Array<Array<string | number | null>> = [
      ['Период', `${months[Number(month)]} ${year}`, 'Выбранный месяц и год'],
      ['Источник продаж', workbook?.fileName ?? 'не загружен', 'Резервный отчёт 1С, загруженный вручную'],
      ['Источник закупок', purchaseReport?.fileName ?? 'не загружен', 'Резервный отчёт по закупкам 1С'],
      ['Источник дней', 'Google Sheets / ручные корректировки', 'Временный источник; в дальнейшем можно заменить на отметки PWA без изменения ведомости'],
      ['Всего товарных строк', parseResult.rows.length, 'После разбора отчёта продаж'],
      ['Общая выручка', totalRevenue, 'По строкам продаж'],
      ['Общая валовая прибыль', totalGrossProfit, 'По строкам продаж'],
      ['База опта', classification.wholesale.base, 'После утверждённых исключений'],
      ['Бонус менеджера опта', classification.wholesale.bonusEach, '1,75% от общей базы опта'],
      ['База закупок', purchasePayrollRow.purchaseBase ?? '', 'Только документы закупщика и утверждённые поставщики'],
      ['Бонус закупщика', purchasePayrollRow.purchasePercentAmount, '1,75% от базы закупок'],
      ['Минимальная зарплата закупщика', purchaseTargetSalary, 'Если обычное начисление ниже, добавляется доплата'],
      ['Кредиты', 'Валовая прибыль × 91% × 10%', '10% от прибыли, оставшейся после 9% налогов и издержек'],
      ['Уровень аксессуаров', `${formatMoney(retailAccessoryTier.teamBase)} / порог ${formatMoney(retailAccessoryTier.threshold)}`, retailAccessoryTier.elevated ? 'Порог превышен' : 'Порог не превышен'],
      ['Ставка аксессуаров', `${retailAccessoryTier.ratePercent}%`, `Применяется ко всей личной базе аксессуаров сотрудников с формулой «Розничные продажи»`],
      ['Операционное управление', '12% от обычных начислений выбранных сотрудников', 'Разовые премии в базу не входят; с августа 2026 действует минимум 100 000 ₽'],
    ];

    await downloadPayrollWorkbook({
      periodLabel: `${months[Number(month)]} ${year}`,
      versionLabel: 'Текущий расчёт из загруженных данных',
      generatedAt: new Date().toLocaleString('ru-RU'),
      employeeRows,
      accrualRows,
      checkRows: buildPayrollCheckRows(),
      sourceRows,
      fileName: `Зарплата_${months[Number(month)]}_${year}.xlsx`,
    });
  }

  return (
    <AdminShell>
      <div className='max-w-full overflow-x-hidden'>
      <div className='mb-5 flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between'>
        <div>
          <AdminBreadcrumbs current='Зарплата' />
          <h1 className='text-[26px] font-extrabold tracking-normal text-slate-950 md:text-[28px]'>Зарплата</h1>
          <p className='mt-1 max-w-3xl text-base font-medium text-slate-500'>
            Расчёт начислений и контроль выплат
          </p>
        </div>
        <Badge className='w-fit bg-green-100 text-green-800'>Рабочий расчёт</Badge>
      </div>

      <div className='grid gap-4'>
        <PayrollDailyOneCControl month={month} year={year} />

        <Card className='p-4'>
          <div className='mb-4 flex items-center gap-3'>
            <span className='flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700'>
              <FileSpreadsheet className='h-5 w-5' />
            </span>
            <div>
              <h2 className='text-lg font-bold text-slate-900'>Ручная загрузка из 1С</h2>
              <p className='text-sm text-slate-500'>Резервный способ расчёта: файл используется только на этой странице и не сохраняется в базе.</p>
            </div>
          </div>

          <div className='grid gap-3 md:grid-cols-[170px_120px_minmax(260px,1fr)_minmax(260px,1fr)]'>
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
          <p className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900'>
            Загруженный Excel и текущий расчёт хранятся на странице временно. Чтобы сохранить расчёт в историю, нажмите “Сохранить расчёт”.
          </p>
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

              <details className='rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-2'>
                <summary className='cursor-pointer text-sm font-bold text-slate-800'>Техническая диагностика загрузки файла</summary>
                <div className='mt-3 grid min-w-0 gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3'>
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
              </details>

            </Card>

            <div className='min-w-0'>
              <div className='mb-5 flex flex-wrap gap-2'>
                {['Итог ЗП', 'Дни, авансы и премии', 'Аудит расчёта'].map((tab) => (
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

              {bonusStorageWarning && <p role='alert' className='mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'>{bonusStorageWarning}</p>}
              {bonusValidation.error && <p role='alert' className='mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800'>{bonusValidation.error} Премии не включены в итог; сохранение и экспорт недоступны до исправления. {activePayrollTab !== 'Дни, авансы и премии' && <button type='button' onClick={() => setActivePayrollTab('Дни, авансы и премии')} className='font-semibold underline'>Проверить премии</button>}</p>}

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
                        <span>Минимальная зарплата: {formatMoney(purchaseTargetSalary)}</span>
                        <span>Ориентир базы: {formatMoney(purchaseTargetBase)}</span>
                        <span>Выполнение: {purchaseCompletionPercent.toFixed(2)}%</span>
                      </div>
                    </Card>
                  </div>

                  {productReviewGroups.length > 0 && (
                    <Card className='border-amber-200 bg-amber-50/70'>
                      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                        <div>
                          <h2 className='text-base font-bold text-amber-950'>Есть товары для проверки</h2>
                          <p className='mt-1 text-sm text-amber-900'>
                            Нужно решить {productReviewGroups.length} товарных групп перед финальной выплатой. Подробная проверка находится во вкладке “Аудит расчёта”.
                          </p>
                        </div>
                        <button
                          type='button'
                          onClick={() => setActivePayrollTab('Аудит расчёта')}
                          className='w-fit rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700'
                        >
                          Открыть аудит
                        </button>
                      </div>
                    </Card>
                  )}

                  <details className='rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)]'>
                    <summary className='group cursor-pointer list-none'>
                      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex min-w-0 items-start gap-2'>
                          <ChevronDown className='mt-1 h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180' />
                          <div className='min-w-0'>
                          <h2 className='text-lg font-bold text-slate-900'>Сверка начислений по всем сотрудникам</h2>
                          <p className='text-sm text-slate-500'>Диагностика по текущему загруженному отчёту: услуги, аксессуары, кредитные аксессуары, техника и дни.</p>
                          </div>
                        </div>
                        <div className='flex flex-wrap gap-2 text-xs font-semibold text-slate-500'>
                          <span className='rounded-full bg-slate-100 px-3 py-1'>Кредитные аксессуары: {payrollDiagnosticsWithCreditAccessories.length}</span>
                          <span className='rounded-full bg-slate-100 px-3 py-1'>Услуги не вошли: {payrollDiagnosticsWithMissedServices.length}</span>
                        </div>
                      </div>
                    </summary>
                    <div className='mt-4'>
                    <div className='max-h-[420px] overflow-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[1220px] text-sm'>
                        <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'>
                          <tr>
                            <th className='px-3 py-2'>Сотрудник</th>
                            <th className='px-3 py-2 text-right'>Услуги база</th>
                            <th className='px-3 py-2 text-right'>Услуги 50%</th>
                            <th className='px-3 py-2 text-right'>Услуги не вошли</th>
                            <th className='px-3 py-2 text-right'>Аксессуары</th>
                            <th className='px-3 py-2 text-right'>Кредитные акс.</th>
                            <th className='px-3 py-2 text-right'>Акс. база</th>
                            <th className='px-3 py-2 text-right'>Акс. 5%</th>
                            <th className='px-3 py-2 text-right'>Минус акс.</th>
                            <th className='px-3 py-2 text-right'>Техника ВП</th>
                            <th className='px-3 py-2 text-right'>Техника бонус</th>
                            <th className='px-3 py-2 text-right'>Дни</th>
                            <th className='px-3 py-2 text-right'>Дни сумма</th>
                            <th className='px-3 py-2 text-right'>Итого начислено</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollDiagnosticsByEmployee.map((row) => (
                            <tr key={'payroll-diagnostic-' + row.manager} className='border-t border-border/70 align-top'>
                              <td className='min-w-[190px] px-3 py-2 font-semibold text-slate-900'>{row.manager}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.serviceBase)}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.serviceBonus)}</td>
                              <td className='px-3 py-2 text-right font-semibold text-amber-700'>{formatMoney(row.serviceMissedBase)}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.regularAccessoryBase)}</td>
                              <td className='px-3 py-2 text-right font-semibold text-emerald-700'>{formatMoney(row.creditAccessoryBase)}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.accessoryBase)}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.accessoryBonus)}</td>
                              <td className='px-3 py-2 text-right font-semibold text-amber-700'>{row.negativeAccessoryCount ? `${row.negativeAccessoryCount} / ${formatMoney(row.negativeAccessoryBase)}` : '—'}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.techGrossProfitBase)}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.techBonus)}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{row.workedDays ?? '—'}</td>
                              <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.dayPay)}</td>
                              <td className='px-3 py-2 text-right font-bold text-slate-900'>{formatMoney(row.grossPay)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {payrollDiagnosticsWithMissedServices.length > 0 && (
                      <div className='mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900'>
                        <p className='font-semibold'>Услуги, не вошедшие в расчёт</p>
                        <p className='mt-1'>Проверьте сотрудников: {payrollDiagnosticsWithMissedServices.map((row) => row.manager + ' — ' + formatMoney(row.serviceMissedBase)).join('; ')}.</p>
                      </div>
                    )}
                    </div>
                  </details>

                  <Card>
                    <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                      <h2 className='text-lg font-bold text-slate-900'>Итог по сотрудникам</h2>
                      <div className='flex flex-wrap gap-2'>
                        <button type='button' onClick={savePayrollSnapshot} disabled={isSavingPayroll || fullPayrollRows.length === 0 || isCurrentPeriodClosed || Boolean(bonusValidation.error) || isPayrollDirectoryLoading || Boolean(payrollDirectoryError)} className='w-fit rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-slate-300'>
                          {isSavingPayroll ? 'Сохраняю...' : 'Сохранить расчёт'}
                        </button>
                        <button type='button' onClick={exportCurrentPayrollWorkbook} disabled={Boolean(bonusValidation.error) || isPayrollDirectoryLoading || Boolean(payrollDirectoryError)} className='w-fit rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50'>
                          Скачать ведомость Excel
                        </button>
                        <button type='button' onClick={() => setActivePayrollTab('Дни, авансы и премии')} className='w-fit rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary/40 hover:text-slate-900'>
                          Редактировать дни, авансы и премии
                        </button>
                      </div>
                    </div>
                    {isCurrentPeriodClosed && <p className='mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900'>Период закрыт. Новые расчёты за этот месяц запрещены.</p>}
                    {payrollDirectoryError && <p className='mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800'>{payrollDirectoryError} Сохранение и выгрузка текущей ведомости временно недоступны, чтобы не пропустить сотрудника.</p>}
                    <div className={`mb-4 rounded-lg border px-3 py-3 ${payrollReviewCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
                      <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                        <div>
                          <p className='text-sm font-bold'>{payrollReviewCount > 0 ? 'Требует проверки' : 'Готово к выплате'}</p>
                          <p className='mt-1 text-sm'>
                            Готово: {payrollOkCount} · Проверить: {payrollReviewCount}
                          </p>
                          {payrollReviewReasonCounts.length > 0 && (
                            <div className='mt-2 flex flex-wrap gap-2'>
                              {payrollReviewReasonCounts.slice(0, 5).map(([reason, count]) => (
                                <Badge key={reason} className='bg-white/80 text-slate-800'>{reason}: {count}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge className={payrollReviewCount > 0 ? 'w-fit bg-amber-100 text-amber-900' : 'w-fit bg-emerald-100 text-emerald-800'}>
                          {payrollReviewCount > 0 ? 'Черновик / не финально' : 'Без критичных проверок'}
                        </Badge>
                      </div>
                      {payrollHasCriticalCostIssue && (
                        <p className='mt-3 rounded-md border border-amber-300 bg-white/70 px-3 py-2 text-sm font-semibold text-amber-950'>
                          Ведомость нельзя считать финальной, пока не проверена себестоимость в 1С / закрытие месяца.
                        </p>
                      )}
                    </div>
                    {saveStatus && <p className='mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800'>{saveStatus}</p>}
                    {saveError && <p className='mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700'>{saveError}</p>}
                    <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[780px] text-sm'>
                        <thead className='bg-slate-50 text-left text-slate-500'>
                          <tr>
                            <th className='w-[210px] px-2 py-2'>Сотрудник</th>
                            <th className='w-[80px] px-2 py-2'>Отдел</th>
                            <th className='w-[54px] px-2 py-2 text-right'>Дни</th>
                            <th className='w-[60px] px-2 py-2 text-right'>Опозд.</th>
                            <th className='w-[112px] px-2 py-2 text-right'>Продажи</th>
                            <th className='w-[96px] px-2 py-2 text-right'>Дисц.</th>
                            <th className='w-[96px] px-2 py-2 text-right'>Раз. премии</th>
                            <th className='w-[96px] px-2 py-2 text-right'>Аванс</th>
                            <th className='w-[112px] px-2 py-2 text-right'>Выплата</th>
                            <th className='w-[92px] px-2 py-2'>Статус</th>
                            <th className='w-[76px] px-2 py-2'></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fullPayrollRows.map((summary) => {
                            const combinedStatus = getPayrollRowStatus(summary);
                            return (
                              <tr key={summary.manager} className='border-t border-border/70 align-top'>
                                <td className='max-w-[210px] truncate px-2 py-2 font-semibold text-slate-900' title={`${summary.manager} · ${summary.position}`}>
                                  <span className='block truncate'>{summary.manager}</span>
                                  <span className='block truncate text-[11px] font-medium text-slate-500'>{summary.position}</span>
                                  {summary.salaryRule === 'belaPercent' && getBelaMinimum(selectedPayrollPeriodKey) > 0 && <span className='block text-[11px] font-medium text-slate-600'>Доплата до минимума: {formatMoney(summary.minimumGuaranteeAdjustment ?? 0)}</span>}
                                </td>
                                <td className='whitespace-nowrap px-2 py-2 text-slate-700'>{summary.payrollDepartment}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.workedDays ?? '—'}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.lateCount ?? '—'}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right font-semibold text-slate-900'>{formatMoney(summary.salesBonus)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{summary.salaryType === 'fixed_salary' || summary.salaryType === 'purchase_manager' ? '—' : formatMoney(summary.disciplineBonus)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{formatMoney(summary.oneTimeBonus ?? 0)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right text-slate-700'>{formatMoney(summary.advance)}</td>
                                <td className='whitespace-nowrap px-2 py-2 text-right font-bold text-slate-900'>{formatMoney(summary.netPay)}</td>
                                <td className='px-2 py-2'>
                                  <Badge className={combinedStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{combinedStatus === 'OK' ? 'Готово' : 'Проверить'}</Badge>
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

                  <Card>
                    <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                      <div>
                        <h2 className='text-lg font-bold text-slate-900'>Сохранённые расчёты</h2>
                        <p className='text-sm text-slate-500'>Последние сохранённые версии по месяцам.</p>
                      </div>
                      {lastSavedRunId && <Badge className='w-fit bg-green-100 text-green-800'>Последний расчёт: № {lastSavedRunId}</Badge>}
                    </div>
                    {isSavedPeriodsLoading ? (
                      <p className='text-sm text-slate-500'>Загружаю сохранённые расчёты...</p>
                    ) : savedPeriods.length === 0 ? (
                      <p className='rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-600'>Сохранённых расчётов пока нет.</p>
                    ) : (
                      <div className='grid gap-2'>
                        {savedPeriods.slice(0, 6).map((period) => {
                          const hasFinalRun = period.runs.some((run) => run.status === 'FINAL');
                          return (
                          <div key={period.id} className='rounded-lg border border-border bg-white px-3 py-2'>
                            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                              <div>
                                <p className='text-sm font-bold text-slate-900'>{months[period.month] ?? period.periodKey} {period.year}</p>
                                <p className='text-xs text-slate-500'>Период {period.periodKey}</p>
                              </div>
                              <div className='flex flex-wrap gap-2'>
                                <Badge className={period.status === 'CLOSED' ? 'w-fit bg-amber-100 text-amber-900' : 'w-fit bg-slate-100 text-slate-700'}>{period.status === 'CLOSED' ? 'Период закрыт' : 'Период открыт'}</Badge>
                                <Badge className='w-fit bg-slate-100 text-slate-700'>Версий: {period.runs.length}</Badge>
                                {period.status !== 'CLOSED' && hasFinalRun && (
                                  <button type='button' onClick={() => updatePayrollPeriodStatus(period.id, 'CLOSED')} disabled={payrollHistoryActionId === `period-${period.id}-CLOSED`} className='rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60'>
                                    Закрыть период
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className='mt-2 grid gap-2 md:grid-cols-2'>
                              {period.runs.map((run) => (
                                <div key={run.id} className='rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm'>
                                  <div className='flex items-center justify-between gap-2'>
                                    <span className='font-semibold text-slate-900'>Расчёт №{run.runNumber}</span>
                                    <span className='text-xs text-slate-500'>{new Date(run.createdAt).toLocaleString('ru-RU')}</span>
                                  </div>
                                  <div className='mt-2 flex flex-wrap items-center gap-2'>
                                    <Badge className={getPayrollRunStatusClass(run.status)}>{getPayrollRunStatusLabel(run.status)}</Badge>
                                    {run.status === 'DRAFT' && period.status !== 'CLOSED' && (
                                      <button type='button' onClick={() => updatePayrollRunStatus(run.id, 'CHECKED')} disabled={payrollHistoryActionId === `run-${run.id}-CHECKED`} className='rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-bold text-blue-800 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-60'>
                                        Отметить проверенным
                                      </button>
                                    )}
                                    {(run.status === 'DRAFT' || run.status === 'CHECKED') && period.status !== 'CLOSED' && (
                                      <button type='button' onClick={() => requestPayrollRunFinal(period, run)} disabled={payrollHistoryActionId === `run-${run.id}-FINAL`} className='rounded-md border border-green-200 bg-white px-2 py-1 text-xs font-bold text-green-800 transition hover:border-green-300 disabled:cursor-not-allowed disabled:opacity-60'>
                                        {hasFinalRun ? 'Заменить финальный' : 'Сделать финальным'}
                                      </button>
                                    )}
                                    <button type='button' onClick={() => openSavedPayrollRun(run.id)} disabled={isSavedRunLoading} className='rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60'>
                                      Открыть сохранённый расчёт
                                    </button>
                                  </div>
                                  {run.status === 'SUPERSEDED' && run.supersededByRun && (
                                    <p className='mt-2 text-xs font-semibold text-slate-500'>Заменён расчётом №{run.supersededByRun.runNumber}{run.supersededAt ? ` · ${new Date(run.supersededAt).toLocaleString('ru-RU')}` : ''}</p>
                                  )}
                                  <div className='mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-3'>
                                    <span>Сотрудников: {run.employeeCount}</span>
                                    <span>Проверить: {run.reviewCount}</span>
                                    <span>К выплате: {formatMoney(run.netPay)}</span>
                                  </div>
                                  {getSavedRunReviewReasons(run).length > 0 && (
                                    <div className='mt-2 flex flex-wrap gap-1'>
                                      {getSavedRunReviewReasons(run).slice(0, 4).map((item) => (
                                        <Badge key={item.reason} className='bg-amber-100 text-amber-900'>{item.reason}: {item.count}</Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )})}
                      </div>
                    )}
                  </Card>

                  {selectedSavedRun && (
                    <Card>
                      <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                        <div>
                          <h2 className='text-lg font-bold text-slate-900'>Сохранённый расчёт №{selectedSavedRun.runNumber}</h2>
                          <p className='mt-1 text-sm text-slate-500'>
                            {selectedSavedRun.period.periodKey} · {getPayrollRunStatusLabel(selectedSavedRun.status)} · {new Date(selectedSavedRun.createdAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                          <button type='button' onClick={exportSavedPayrollWorkbook} disabled={isSavedRunExporting} className='w-fit rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50'>
                            {isSavedRunExporting ? 'Формирую…' : 'Скачать ведомость'}
                          </button>
                          <button type='button' onClick={() => setSelectedSavedRun(null)} className='w-fit rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary/40'>
                            Закрыть просмотр
                          </button>
                        </div>
                      </div>

                      <p className='mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900'>
                        Это зафиксированная версия расчёта. Сохранены итоговые суммы, расшифровка и сведения об источниках; сам исходный файл не хранится.
                      </p>
                      {selectedSavedRun.status === 'SUPERSEDED' && selectedSavedRun.supersededByRun && (
                        <p className='mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700'>
                          Этот финальный расчёт заменён расчётом №{selectedSavedRun.supersededByRun.runNumber}{selectedSavedRun.supersededAt ? ` ${new Date(selectedSavedRun.supersededAt).toLocaleString('ru-RU')}` : ''}{selectedSavedRun.supersededBy ? ` · ${selectedSavedRun.supersededBy.name}` : ''}.
                        </p>
                      )}
                      {selectedSavedRun.employeeResults.some((row) => row.adjustments?.length) && <div className='mb-4 rounded-lg border border-border p-3'>
                        <h3 className='font-bold text-slate-900'>Зафиксированные разовые премии</h3>
                        {selectedSavedRun.employeeResults.flatMap((row) => (row.adjustments ?? []).filter((bonus) => bonus.type === 'ONE_TIME_BONUS').map((bonus) => <p key={bonus.id} className='mt-2 text-sm text-slate-700'>{row.employeeName} · {formatMoney(bonus.amount)} · {bonus.reason}<span className='block text-xs text-slate-500'>Внесено: {new Date(bonus.createdAt).toLocaleString('ru-RU')} · администратор ID {bonus.createdByUserId ?? '—'}</span></p>))}
                      </div>}
                      {getSavedRunReviewReasons(selectedSavedRun).length > 0 && (
                        <div className='mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950'>
                          <p className='font-bold'>Основные причины проверки</p>
                          <div className='mt-2 flex flex-wrap gap-2'>
                            {getSavedRunReviewReasons(selectedSavedRun).map((item) => (
                              <Badge key={item.reason} className='bg-white text-amber-900'>{item.reason}: {item.count}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className='mb-4 grid gap-3 md:grid-cols-4'>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Сотрудников</p>
                          <p className='mt-1 text-xl font-bold text-slate-900'>{selectedSavedRun.employeeCount}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Проверить</p>
                          <p className='mt-1 text-xl font-bold text-slate-900'>{selectedSavedRun.reviewCount}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Начислено</p>
                          <p className='mt-1 text-xl font-bold text-slate-900'>{formatMoney(selectedSavedRun.grossPay)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>К выплате</p>
                          <p className='mt-1 text-xl font-bold text-slate-900'>{formatMoney(selectedSavedRun.netPay)}</p>
                        </div>
                      </div>

                      <div className='grid gap-4 xl:grid-cols-2'>
                        <div>
                          <h3 className='mb-2 text-sm font-bold text-slate-900'>Сотрудники</h3>
                          <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                            <table className='w-full min-w-[900px] text-xs'>
                              <thead className='bg-slate-50 text-left text-slate-500'>
                                <tr>
                                  <th className='px-3 py-2'>Сотрудник</th>
                                  <th className='px-3 py-2'>Отдел</th>
                                  <th className='px-3 py-2 text-right'>Дни</th>
                                  <th className='px-3 py-2 text-right'>Начислено</th>
                                  <th className='px-3 py-2 text-right'>К выплате</th>
                                  <th className='px-3 py-2'>Статус</th>
                                  <th className='px-3 py-2'>Причины</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedSavedRun.employeeResults.map((row) => (
                                  <tr key={row.id} className='border-t border-border/70'>
                                    <td className='px-3 py-2 font-semibold text-slate-900'>{row.employeeName}</td>
                                    <td className='px-3 py-2 text-slate-700'>{row.payrollDepartment}</td>
                                    <td className='px-3 py-2 text-right text-slate-700'>{row.workedDays ?? '—'}</td>
                                    <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.grossPay)}</td>
                                    <td className='px-3 py-2 text-right font-bold text-slate-900'>{formatMoney(row.netPay)}</td>
                                    <td className='px-3 py-2'><Badge className={row.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{row.status === 'OK' ? 'Готово' : 'Проверить'}</Badge></td>
                                    <td className='px-3 py-2 text-slate-600'>{getSavedEmployeeReasons(row).join('; ') || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className='grid gap-4'>
                          <div>
                            <h3 className='mb-2 text-sm font-bold text-slate-900'>Исходные файлы</h3>
                            <div className='grid gap-2'>
                              {selectedSavedRun.sourceFiles.length ? selectedSavedRun.sourceFiles.map((file) => (
                                <div key={file.id} className='rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm'>
                                  <p className='font-semibold text-slate-900'>{file.originalName}</p>
                                  <p className='text-xs text-slate-500'>{getSavedSourceTypeLabel(file.type)} · лист {file.selectedSheet ?? '—'} · строк {file.rowCount ?? '—'} · распознано {file.parsedRowCount ?? '—'}</p>
                                  {file.sha256 && <p className='mt-1 break-all text-xs text-slate-400'>sha256: {file.sha256}</p>}
                                </div>
                              )) : <p className='rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-600'>Файлы не сохранены.</p>}
                            </div>
                          </div>

                          <div>
                            <h3 className='mb-2 text-sm font-bold text-slate-900'>Ручные вводы</h3>
                            <div className='max-h-52 overflow-auto rounded-lg border border-border'>
                              {selectedSavedRun.manualInputs.length ? selectedSavedRun.manualInputs.map((input) => (
                                <div key={input.id} className='border-b border-border bg-white px-3 py-2 text-xs last:border-b-0'>
                                  <p className='font-semibold text-slate-900'>{input.employeeName} · {getSavedInputTypeLabel(input.inputType)}</p>
                                  <p className='text-slate-600'>дни {input.workedDays ?? '—'} · опозд. {input.lateCount ?? '—'} · аванс {input.advance ?? input.purchaseAdvance ?? '—'} · премия {input.fixedBonus ?? '—'} · удержание {input.fixedDeduction ?? input.purchaseDeduction ?? '—'}</p>
                                  {input.comment && <p className='mt-1 text-slate-500'>{input.comment}</p>}
                                </div>
                              )) : <p className='px-3 py-2 text-sm text-slate-600'>Ручных вводов нет.</p>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className='mt-4'>
                        <h3 className='mb-2 text-sm font-bold text-slate-900'>Расшифровка начислений</h3>
                        <div className='max-h-80 overflow-auto rounded-lg border border-border'>
                          {selectedSavedRun.employeeResults.flatMap((employee) =>
                            employee.calculationDetails.map((detail) => ({ employee, detail })),
                          ).map(({ employee, detail }) => (
                            <div key={detail.id} className='grid gap-2 border-b border-border bg-white px-3 py-2 text-xs last:border-b-0 md:grid-cols-[1.2fr_1fr_1fr_1fr]'>
                              <span className='font-semibold text-slate-900'>{employee.employeeName}</span>
                              <span className='text-slate-700'>{detail.component}</span>
                              <span className='text-slate-600'>{detail.formula}</span>
                              <span className='text-right font-bold text-slate-900'>{formatMoney(detail.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  )}

                </div>
              )}

              {activePayrollTab === 'Дни, авансы и премии' && (
                <Card>
                  <div className='mb-4'>
                    <h2 className='text-lg font-bold text-slate-900'>Дни, авансы и премии</h2>
                    <p className='mt-1 text-sm text-slate-500'>Раскройте сотрудника: все ручные суммы и итог к выплате находятся в одном месте.</p>
                    <p className='mt-2 text-xs text-slate-500'>Новые премии прибавляются сверх обычного расчёта и доведения до минимума, не входят в базу 12% Бэлы и не переносятся в следующий месяц. «Сохранить расчёт» фиксирует суммы, основания и автора в истории. Записи в 1С не создаются.</p>
                  </div>
                  <div className='grid min-w-0 gap-3'>
                    {fullPayrollRows.map((row) => {
                      const fixed = row.salaryType === 'fixed_salary';
                      const purchase = row.salaryType === 'purchase_manager';
                      const salesInput = manualPayroll[row.manager] ?? { workedDays: '', lateCount: '', advance: '', comment: '' };
                      const fixedInput = fixedPayroll[row.manager] ?? { bonus: '', advance: '', deduction: '', comment: '' };
                      const input = fixed ? fixedInput : purchase ? purchasePayroll : salesInput;
                      const employeeDrafts = bonusDrafts.filter((draft) => draft.employeeName === row.manager);
                      const changeInput = (field: 'advance' | 'comment', value: string) => {
                        if (fixed) updateFixedPayroll(row.manager, field, value);
                        else if (purchase) updatePurchasePayroll(field, value);
                        else updateManualPayroll(row.manager, field, value);
                      };
                      const showsLegacyBonus = fixed && (Boolean(fixedInput.bonus) || !getBelaMinimum(selectedPayrollPeriodKey));
                      return (
                        <details key={`${selectedPayrollPeriodKey}-${row.manager}`} className='min-w-0 rounded-lg border border-border bg-white'>
                          <summary aria-label={`Данные зарплаты: ${row.manager}`} className='cursor-pointer rounded-lg px-4 py-3 text-sm marker:text-slate-400'>
                            <span className='inline-grid w-[calc(100%_-_20px)] min-w-0 gap-2 align-top sm:grid-cols-[minmax(0,1fr)_auto]'>
                              <span className='min-w-0'>
                                <span className='block font-bold text-slate-900'>{row.manager}</span>
                                <span className='block text-xs text-slate-500'>{row.payrollDepartment} · {row.position}</span>
                                {row.payrollReasons.length > 0 && <span className='block text-xs text-amber-800'>Требует проверки · {row.payrollReasons.length}</span>}
                                {employeeDrafts.length > 0 && <span className='block text-xs text-slate-600'>Премии: {bonusValidation.error ? 'проверьте ввод' : formatMoney((row.oneTimeBonus ?? 0) + row.fixedBonus)}</span>}
                              </span>
                              <span className='sm:text-right'>
                                <span className='block text-xs text-slate-500'>К выплате{bonusValidation.error ? ' · без разовых премий' : ''}</span>
                                <span className='block font-bold text-slate-900'>{formatMoney(row.netPay)}</span>
                                <span className='block text-xs text-slate-500'>Раскрыть / свернуть</span>
                              </span>
                            </span>
                          </summary>
                          <div className='min-w-0 space-y-4 border-t border-border p-4'>
                            <div className='grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3'>
                              <p>Обычное начисление: <strong>{formatMoney(row.grossPay - (row.oneTimeBonus ?? 0))}</strong></p>
                              {fixed && <p>Оклад: <strong>{formatMoney(row.fixedSalary)}</strong></p>}
                              {purchase && <><p>Дни: {row.workedDays} × {formatMoney(row.dayRate)}</p><p>Закупки для расчёта: {row.purchaseBase === null ? 'нет отчёта' : formatMoney(row.purchaseBase)}</p><p>Бонус с закупок — 1,75%: {formatMoney(row.purchasePercentAmount)}</p><p>Доплата до минимума: {formatMoney(row.purchaseTargetAdjustment)}</p></>}
                              {row.salaryRule === 'belaPercent' && <><p>Начисления сотрудников для расчёта 12%: {formatMoney(row.belaBase ?? 0)}</p><p>Начислено 12%: {formatMoney(row.belaPercentAmount ?? 0)}</p>{getBelaMinimum(selectedPayrollPeriodKey) > 0 && <p>Доплата до минимальной зарплаты: <strong>{formatMoney(row.minimumGuaranteeAdjustment ?? 0)}</strong></p>}</>}
                              {!fixed && !purchase && row.salaryRule === 'standard' && <><p>Оплата по дням: {formatMoney(row.dayPay)}</p><p>Дисциплина: {formatMoney(row.disciplineBonus)}</p><p>Источник дней: {getPayrollDaysSourceLabel(row.daysSource)}</p></>}
                            </div>
                            <fieldset disabled={isCurrentPeriodClosed || isSavingPayroll} className='grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                              {!fixed && !purchase && row.salaryRule === 'standard' && <>
                                <label className='grid gap-1 text-sm font-semibold text-slate-700'>Отработано дней
                                  <Input aria-label={`Дни: ${row.manager}`} type='number' min='0' step='0.5' value={salesInput.workedDays || (row.workedDays === null ? '' : String(row.workedDays))} onChange={(event) => updateManualPayroll(row.manager, 'workedDays', event.target.value)} />
                                </label>
                                <label className='grid gap-1 text-sm font-semibold text-slate-700'>Опоздания
                                  <Input aria-label={`Опоздания: ${row.manager}`} type='number' min='0' step='1' value={salesInput.lateCount || (row.lateCount === null ? '' : String(row.lateCount))} onChange={(event) => updateManualPayroll(row.manager, 'lateCount', event.target.value)} />
                                </label>
                              </>}
                              {row.manager === agentCreditCommissionEmployee && <label className='grid gap-1 text-sm font-semibold text-slate-700'>Агентские, ₽
                                <Input aria-label={`Агентские: ${row.manager}`} type='number' min='0' step='0.01' value={salesInput.agentCreditCommission ?? ''} onChange={(event) => updateManualPayroll(row.manager, 'agentCreditCommission', event.target.value)} />
                              </label>}
                              <label className='grid gap-1 text-sm font-semibold text-slate-700'>Аванс, ₽
                                <Input aria-label={`Аванс: ${row.manager}`} type='number' min='0' step='100' value={input.advance} onChange={(event) => changeInput('advance', event.target.value)} />
                              </label>
                              {(fixed || purchase) && <label className='grid gap-1 text-sm font-semibold text-slate-700'>Удержание, ₽
                                <Input aria-label={`Удержание: ${row.manager}`} type='number' min='0' step='100' value={fixed ? fixedInput.deduction : purchasePayroll.deduction} onChange={(event) => fixed ? updateFixedPayroll(row.manager, 'deduction', event.target.value) : updatePurchasePayroll('deduction', event.target.value)} />
                              </label>}
                              <label className='grid gap-1 text-sm font-semibold text-slate-700 sm:col-span-2 lg:col-span-3'>Комментарий
                                <Input aria-label={`Комментарий: ${row.manager}`} value={input.comment} onChange={(event) => changeInput('comment', event.target.value)} />
                              </label>
                            </fieldset>
                            {row.manager === agentCreditCommissionEmployee && <PayrollFinboxImport
                              key={`${selectedPayrollPeriodKey}-finbox`}
                              periodKey={selectedPayrollPeriodKey}
                              currentAmount={salesInput.agentCreditCommission ?? ''}
                              disabled={isCurrentPeriodClosed || isSavingPayroll}
                              onApply={(amount) => updateManualPayroll(row.manager, 'agentCreditCommission', amount)}
                            />}
                            <PayrollBonusesEditor
                              key={`${selectedPayrollPeriodKey}-bonuses-${row.manager}`}
                              employeeName={row.manager}
                              employees={[]}
                              drafts={employeeDrafts}
                              error=''
                              disabled={!bonusesReady || isCurrentPeriodClosed || isSavingPayroll}
                              onChange={(drafts) => replaceBonusDrafts(employeeDrafts, drafts)}
                              legacyBonus={showsLegacyBonus ? { amount: fixedInput.bonus, onChange: (value) => updateFixedPayroll(row.manager, 'bonus', value) } : undefined}
                            />
                            {row.payrollReasons.length > 0 && <p className='rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>{row.payrollReasons.join(' · ')}</p>}
                            <p className='border-t border-border pt-3 text-sm text-slate-700'>Всего начислено: <strong>{formatMoney(row.grossPay)}</strong> · К выплате: <strong>{formatMoney(row.netPay)}</strong>{bonusValidation.error && ' · разовые премии не учтены до исправления ошибки'}</p>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                  {unmappedBonusDrafts.length > 0 && <div className='mt-4 rounded-lg border border-amber-200 p-4'>
                    <PayrollBonusesEditor key={`unmapped-${selectedPayrollPeriodKey}`} drafts={unmappedBonusDrafts} employees={regularPayrollRows.map((row) => row.manager)} error='Выберите сотрудника для оставшихся премий или уберите лишние записи.' disabled={!bonusesReady || isCurrentPeriodClosed || isSavingPayroll} onChange={(drafts) => replaceBonusDrafts(unmappedBonusDrafts, drafts)} />
                  </div>}
                  <div className='mt-4 flex flex-wrap items-center gap-3'>
                    <button type='button' onClick={savePayrollSnapshot} disabled={isSavingPayroll || isCurrentPeriodClosed || Boolean(bonusValidation.error) || isPayrollDirectoryLoading || Boolean(payrollDirectoryError)} className='rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'>{isSavingPayroll ? 'Сохранение...' : 'Сохранить расчёт'}</button>
                    <button type='button' onClick={() => setActivePayrollTab('Итог ЗП')} className='rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700'>К итоговой ведомости</button>
                    {saveError && <p role='alert' className='text-sm text-red-700'>{saveError}</p>}
                    {saveStatus && <p className='text-sm text-green-700'>{saveStatus}</p>}
                  </div>
                  <div className='mt-5'>
                    <div className='mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                      <div>
                        <h3 className='text-base font-bold text-slate-900'>Сопоставление с посещаемостью</h3>
                        <p className='mt-1 text-sm text-slate-500'>Ручная карта имён для будущей автоподстановки дней. Выбран период: {months[Number(month)]} {year}.</p>
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
                            <Badge className={isAttendancePreviewPeriodCurrent ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-700'}>
                              Период посещаемости: {attendancePreview.period.periodKey}
                            </Badge>
                          </div>
                          <button
                            type='button'
                            onClick={applyAttendancePreviewDays}
                            disabled={!isAttendancePreviewPeriodCurrent}
                            className='w-fit rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
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

              {activePayrollTab === 'Аудит расчёта' && (
                <div className='grid gap-5'>
                  <Card>
                    <div className='mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between'>
                      <div>
                        <h2 className='text-lg font-bold text-slate-900'>Аудит расчёта</h2>
                        <p className='text-sm text-slate-500'>Проверка зарплаты перед сохранением: критичные строки, дорогие позиции и ручные исправления.</p>
                        <p className='mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900'>
                          Аудит показывает строки расчёта из ВВП. В некоторых форматах отчёта строка может быть агрегатом по товару/клиенту/менеджеру, если сам ВВП отдаёт её как итог по номенклатуре. Расчёт зарплаты от этого не меняется.
                        </p>
                      </div>
                    </div>
                    {classificationRuleMessage && <p className='mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'>{classificationRuleMessage}</p>}
                    {classificationRuleError && <p className='mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{classificationRuleError}</p>}
                    <div className='grid gap-2 md:grid-cols-3 xl:grid-cols-8'>
                      {[
                        ['Требует действия', auditActionRows.length],
                        ['Аксессуары розницы', topRetailAccessoryAuditRows.length],
                        ['Аксессуары опта', topWholesaleAccessoryAuditRows.length],
                        ['Большие начисления', topBonusAuditRows.length],
                        ['Без ручного правила', expensiveAutomaticAuditRows.length],
                        ['Новые дорогие', newExpensiveAuditRows.length],
                        ['Услуги 50%', serviceAuditRows.length],
                        ['Ручные правила', manualClassificationAuditRows.length],
                      ].map(([label, count]) => (
                        <div key={label} className='rounded-lg border border-border bg-white px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                          <p className='mt-1 text-xl font-bold text-slate-900'>{count}</p>
                        </div>
                      ))}
                    </div>
                    {auditActionRows.length === 0 && (
                      <p className='mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800'>
                        Критичных проблем не найдено. Проверьте дорогие строки и ручные исправления перед сохранением.
                      </p>
                    )}
                  </Card>

                  {renderProductReviewCard()}

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Требует действия</h3>
                    <p className='mb-3 text-sm text-slate-500'>Только строки, где нужно принять решение: классификация, себестоимость, ошибочное исключение или некорректные числа.</p>
                    {renderAuditRowsTable(auditActionRows, getAuditActionReason, { emptyText: 'Критичных строк для ручного решения не найдено.' })}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Самые дорогие аксессуары розницы</h3>
                    <p className='mb-3 text-sm text-slate-500'>TOP-30 розничных строк RETAIL_ACCESSORY_5 по выручке. Пометка не меняет классификацию, только помогает быстро найти технику среди аксессуаров.</p>
                    {renderAuditRowsTable(
                      topRetailAccessoryAuditRows,
                      (row) => (
                        <span>
                          {looksLikeTechAuditRow(row) && <Badge className='mr-2 bg-amber-100 text-amber-900'>Похоже на технику — проверь</Badge>}
                          {row.classificationReason} · {row.matchedRule}
                        </span>
                      ),
                      { emptyText: 'Розничные аксессуары 5% не найдены.' },
                    )}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Самые дорогие аксессуары опта</h3>
                    <p className='mb-3 text-sm text-slate-500'>TOP-30 оптовых строк WHOLESALE_INCLUDED_1_75 по выручке. Блок отделён от розницы, чтобы оптовые позиции Залины и Лианы не мешали проверке розничной зарплаты.</p>
                    {renderAuditRowsTable(topWholesaleAccessoryAuditRows, (row) => `${row.classificationReason} · ${row.matchedRule}`, { emptyText: 'Оптовые строки в базе 1,75% не найдены.' })}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Самые большие начисления</h3>
                    <p className='mb-3 text-sm text-slate-500'>TOP-30 строк по модулю начисления. Эти позиции сильнее всего влияют на итоговую зарплату.</p>
                    {renderAuditRowsTable(topBonusAuditRows, (row) => `${row.formula} · ${row.classificationReason} · ${row.matchedRule}`, { emptyText: 'Начисления по строкам не найдены.' })}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Дорогие товары без ручного правила</h3>
                    <p className='mb-3 text-sm text-slate-500'>Самые дорогие строки, которые портал классифицировал автоматически. Используйте блок для проверки товаров, которые могут быть ошибочно отнесены к аксессуарам, технике, услугам или другим категориям.</p>
                    {renderAuditRowsTable(expensiveAutomaticAuditRows, (row) => `${row.classificationReason} · ${row.matchedRule}`, { emptyText: 'Автоматически классифицированные дорогие строки не найдены.' })}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Новые дорогие товары</h3>
                    <p className='mb-3 text-sm text-slate-500'>Используется только существующая логика new-expensive-review, без нового порога “дорого”.</p>
                    {renderAuditRowsTable(newExpensiveAuditRows, (row) => `${row.classificationReason} · ${row.matchedRule}`, { emptyText: 'Новых дорогих товаров по правилу new-expensive-review нет.' })}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Услуги 50%</h3>
                    <p className='mb-3 text-sm text-slate-500'>Строки, вошедшие в услуги 50%, включая отрицательные строки с минусом.</p>
                    {renderAuditRowsTable(serviceAuditRows, (row) => `${row.revenue < 0 ? 'Отрицательная строка учтена · ' : ''}${row.classificationReason} · ${row.matchedRule}`, { showActions: false, emptyText: 'Строк услуг 50% не найдено.' })}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Плёнки / антигравийные материалы Асада</h3>
                    <p className='mb-3 text-sm text-slate-500'>Строки Асада, вошедшие в отдельный расчёт себестоимость × 50%.</p>
                    {renderAuditRowsTable(asadPlotterAuditRows, (row) => `${row.revenue < 0 || row.grossProfit < 0 ? 'Возврат / минус учтён · ' : ''}${row.classificationReason} · ${row.matchedRule}`, { showActions: false, emptyText: 'Плёнки / антигравийные материалы Асада не найдены.' })}
                  </Card>

                  <Card>
                    <h3 className='mb-2 text-base font-bold text-slate-900'>Ручные исправления</h3>
                    <p className='mb-3 text-sm text-slate-500'>Строки текущего расчёта, где сработало сохранённое ручное правило classification-rules.</p>
                    {renderAuditRowsTable(manualClassificationAuditRows, (row) => `${row.classificationReason} · ${row.matchedRule}`, { emptyText: 'Ручные правила в текущем расчёте не применялись.' })}
                  </Card>
                </div>
              )}

              <details open={['Опт', 'Розница', 'Детализация строк', 'Диагностика файла'].includes(activePayrollTab)} className='rounded-lg border border-dashed border-slate-300 bg-slate-50/70 px-4 py-3'>
                <summary className='cursor-pointer text-sm font-bold text-slate-800'>
                  Техническая диагностика (для отладки)
                </summary>
                <p className='mt-1 text-sm text-slate-500'>
                  Здесь оставлены служебные срезы по опту, рознице, строкам и распознаванию файла. Для ежедневной проверки используйте вкладку “Аудит расчёта”.
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {['Опт', 'Розница', 'Детализация строк', 'Диагностика файла'].map((tab) => (
                    <button
                      key={tab}
                      type='button'
                      onClick={() => setActivePayrollTab(tab)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activePayrollTab === tab ? 'bg-slate-900 text-white shadow-sm' : 'border border-border bg-white text-slate-600 hover:border-primary/40 hover:text-slate-900'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className='mt-4'>

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
                      [`Аксессуары ${retailAccessoryTier.ratePercent}%`, `${retailAccessorySummary.rows} / ${formatMoney(retailAccessorySummary.base)} / ${formatMoney(retailAccessorySummary.bonus)}`],
                      ['Услуги 50%', `${retailFilmSummary.rows} / ${formatMoney(retailFilmSummary.base)} / ${formatMoney(retailFilmSummary.bonus)}`],
                      ['Плоттер 50% с/с', `${retailPlotterSummary.rows} / ${formatMoney(retailPlotterSummary.base)} / ${formatMoney(retailPlotterSummary.bonus)}`],
                      ['Кредиты', `${creditRows.length} строк · техника ${creditTechRows.length} / аксессуары ${creditAccessoryRows.length} / спорные ${creditReviewRows.length} · бонус ${formatMoney(retailCreditSummary.bonus)}`],
                      ['Спорная розница', `${retailReviewSummary.rows} / ${formatMoney(retailReviewSummary.revenue)}`],
                    ].map(([label, value]) => <Card key={label} className='p-4'><p className='text-xs font-semibold uppercase text-slate-500'>{label}</p><p className='mt-1 text-sm font-bold text-slate-900'>{value}</p></Card>)}
                  </div>
                  <div className={`rounded-xl border px-4 py-3 ${retailAccessoryTier.elevated ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
                    <p className='font-bold'>Ставка команды по аксессуарам: {retailAccessoryTier.ratePercent}%</p>
                    <p className='mt-1 text-sm'>
                      База команды {formatMoney(retailAccessoryTier.teamBase)} {retailAccessoryTier.elevated ? 'превысила' : 'не превысила'} порог {formatMoney(retailAccessoryTier.threshold)}.
                      {' '}Ставка {retailAccessoryTier.ratePercent}% применяется ко всей личной базе аксессуаров всех сотрудников с формулой «Розничные продажи».
                    </p>
                  </div>
                  <Card>
                    <h2 className='mb-4 text-lg font-bold text-slate-900'>Розничные менеджеры</h2>
                    <div className='max-h-[520px] overflow-auto rounded-lg border border-border'>
                      <table className='w-full min-w-[980px] text-sm'>
                        <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-3'>Менеджер</th><th className='px-3 py-3 text-right'>Выручка</th><th className='px-3 py-3 text-right'>ВП</th><th className='px-3 py-3 text-right'>Кредит</th><th className='px-3 py-3 text-right'>Услуги</th><th className='px-3 py-3 text-right'>Плоттер</th><th className='px-3 py-3 text-right'>Техника</th><th className='px-3 py-3 text-right'>Аксессуары</th><th className='px-3 py-3 text-right'>Итого</th><th className='px-3 py-3 text-right'>Спорные</th></tr></thead>
                        <tbody>
                          {payrollManagerSummaries.filter((row) => row.department === 'Розница').map((row) => (
                            <tr key={row.manager} className='border-t border-border/70'><td className='px-3 py-2 font-semibold'>{row.manager}</td><td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.creditBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.filmBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.plotterBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.techBonus)}</td><td className='px-3 py-2 text-right'>{formatMoney(row.accessoryBonus)}</td><td className='px-3 py-2 text-right font-bold'>{formatMoney(row.totalBonus)}</td><td className='px-3 py-2 text-right'>{retailReviewRows.filter((item) => item.manager === row.manager).length}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
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
              </details>
            </div>

            {selectedManagerStatus && selectedManagerPayroll && (
              <div className='fixed inset-0 z-50 flex justify-end bg-slate-950/45'>
                <aside className='admin-dialog-panel h-full w-full overflow-y-auto bg-white p-4 shadow-2xl md:w-[62vw] xl:w-[58vw]'>
                  <div className='mb-4 flex items-start justify-between gap-4 border-b border-border pb-4'>
                    <div className='min-w-0'>
                      <h2 className='truncate text-[22px] font-bold text-slate-900'>{selectedManagerPayroll.manager}</h2>
                      <p className='mt-1 text-sm text-slate-500'>{months[Number(month)]} {year} · {selectedManagerPayroll.payrollDepartment} · {selectedManagerPayroll.position}</p>
                      <div className='mt-3 flex flex-wrap items-center gap-2'>
                        <Badge className={selectedManagerStatus.status === 'OK' && selectedManagerPayroll.payrollStatus === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                          {selectedManagerStatus.status === 'OK' && selectedManagerPayroll.payrollStatus === 'OK' ? 'OK' : 'Проверить'}
                        </Badge>
                      </div>
                      <div className='mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700'>
                        <p className='font-semibold text-slate-900'>Требует проверки</p>
                        {selectedManagerStatus.status === 'OK' && selectedManagerPayroll.payrollReasons.length === 0 ? (
                          <p className='mt-1'>Замечаний нет</p>
                        ) : (
                          <ul className='mt-1 grid gap-1'>
                            {selectedManagerCounts.disputed > 0 && <li>Спорные строки: {selectedManagerCounts.disputed}</li>}
                            {selectedManagerCounts.serviceNotIncluded > 0 && <li>Услуги не вошли в 50%: {selectedManagerCounts.serviceNotIncluded}</li>}
                            {selectedManagerCounts.potentialAccessories > 0 && <li>Похоже на аксессуары, но не вошло: {selectedManagerCounts.potentialAccessories}</li>}
                            {selectedManagerCounts.zeroBase > 0 && <li>Нулевая база без понятного расчёта: {selectedManagerCounts.zeroBase}</li>}
                            {selectedManagerCounts.suspiciousTechCost > 0 && <li>Подозрительно нулевая / неполная себестоимость техники: {selectedManagerCounts.suspiciousTechCost}</li>}
                            {selectedManagerCounts.unclassified > 0 && <li>Строки без классификации: {selectedManagerCounts.unclassified}</li>}
                            {selectedManagerCounts.accessoryExcluded > 0 && <li>Ошибочно исключённые аксессуары: {selectedManagerCounts.accessoryExcluded}</li>}
                            {selectedManagerCounts.invalidNumbers > 0 && <li>NaN/undefined в расчётах: {selectedManagerCounts.invalidNumbers}</li>}
                            {selectedManagerPayroll.payrollReasons.map((reason) => (
                              <li key={reason}>
                                {reason === 'Посещаемость по форме не подтверждена'
                                  ? 'Дни рассчитаны по Google Sheets “График посещений”. Отметок прихода/ухода из Google-формы нет, поэтому опоздания и фактическое присутствие нужно проверить вручную.'
                                  : reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className='mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900'>
                        <p className='font-semibold'>Контроль / уже учтено</p>
                        <ul className='mt-1 grid gap-1 text-blue-800'>
                          {selectedManagerCounts.classifiedCredits > 0 && <li>Кредиты с понятным расчётом: {selectedManagerCounts.classifiedCredits}</li>}
                          {selectedManagerCounts.accountedNegative > 0 && <li>Отрицательная ВП учтена в своём типе расчёта: {selectedManagerCounts.accountedNegative}</li>}
                          {selectedManagerCounts.informationalZeroBase > 0 && <li>Нулевая база как контроль: {selectedManagerCounts.informationalZeroBase}</li>}
                          {selectedManagerCounts.classifiedCredits === 0 && selectedManagerCounts.accountedNegative === 0 && selectedManagerCounts.informationalZeroBase === 0 && <li>Контрольных флагов нет</li>}
                        </ul>
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
                              ['Доплата до минимальной зарплаты', formatMoney(selectedManagerPayroll.purchaseTargetAdjustment)],
                              ['Минимальная зарплата', formatMoney(selectedManagerPayroll.purchaseTargetSalary)],
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
                              ['Формула расчёта', getSalaryFormulaLabel(selectedManagerPayroll.salaryType, selectedPayrollPeriodKey)],
                              ['Ставка', formatMoney(selectedManagerPayroll.dayRate)],
                              ['Источник дней', getPayrollDaysSourceLabel(selectedManagerPayroll.daysSource)],
                              ['Дни', selectedManagerPayroll.workedDays ?? '—'],
                              ['Опоздания', selectedManagerPayroll.lateCount ?? '—'],
                              ['Имя в посещаемости', selectedManagerAttendanceNames.join(', ') || '—'],
                              ['Правило зарплаты', selectedManagerPayroll.salaryRule === 'belaPercent' ? getSalaryFormulaLabel('vl_percent', selectedPayrollPeriodKey) : selectedManagerPayroll.salaryRule === 'noDayPay' ? 'Без оплаты выходов по дням' : 'Стандарт'],
                              ['Оплата по дням', formatMoney(selectedManagerPayroll.dayPay)],
                              ['Бонус продаж', formatMoney(selectedManagerPayroll.salesBonus)],
                              ...(selectedManagerPayroll.agentCreditCommission > 0 ? [['Агентские по кредитам', formatMoney(selectedManagerPayroll.agentCreditCommission)]] : []),
                              ['Бонус дисциплины', formatMoney(selectedManagerPayroll.disciplineBonus)],
                              ['Всего начислено', formatMoney(selectedManagerPayroll.grossPay)],
                            ]).concat([
                              ...(selectedManagerPayroll.salaryRule === 'belaPercent' ? [
                                ['База 12% без разовых премий', formatMoney(selectedManagerPayroll.belaBase ?? 0)],
                                ['Расчёт 12%', formatMoney(selectedManagerPayroll.belaPercentAmount ?? 0)],
                                ...(getBelaMinimum(selectedPayrollPeriodKey) ? [['Доплата до минимальной зарплаты', formatMoney(selectedManagerPayroll.minimumGuaranteeAdjustment ?? 0)]] : []),
                              ] : []),
                              ['Разовые премии сверху', formatMoney(selectedManagerPayroll.oneTimeBonus ?? 0)],
                            ]).map(([label, value]) => (
                          <div key={label} className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                            <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                            <p className='font-bold text-slate-900'>{value}</p>
                          </div>
                        ))}
                      </div>
                      {bonusValidation.bonuses.filter((bonus) => bonus.employeeName === selectedManagerPayroll.manager).map((bonus) => <p key={bonus.id} className='mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700'>Разовая премия {formatMoney(bonus.amount)}: {bonus.reason}</p>)}
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
                          : `Схема расчёта: Розница — услуги оказываемые 50%, плоттерные материалы Асада 50% от с/с, техника 10% от ВП, аксессуары ${retailAccessoryTier.ratePercent}% по уровню общей базы команды, кредитный бонус.`}
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
                                  selectedManagerCounts.accessoryBase || selectedManagerSummary.accessoryBonus ? [`Аксессуары ${Math.round((selectedManagerSummary.accessoryRate ?? 0.05) * 100)}%`, selectedManagerCounts.accessoryBase, `личная база × ${Math.round((selectedManagerSummary.accessoryRate ?? 0.05) * 100)}%`, selectedManagerSummary.accessoryBonus] : null,
                                  selectedManagerCounts.credits || selectedManagerSummary.creditBonus ? ['Кредитный бонус', selectedManagerCounts.creditBase, 'ВП × 0,91 × 10%', selectedManagerSummary.creditBonus] : null,
                                ].filter((component): component is [string, number, string, number] => Boolean(component))
                            ).map(([component, base, formula, bonus]) => (
                              <tr key={String(component)} className='border-t border-border/70'><td className='px-3 py-2 font-semibold'>{component}</td><td className='px-3 py-2 text-right'>{formatMoney(Number(base))}</td><td className='px-3 py-2'>{formula}</td><td className='px-3 py-2 text-right font-bold'>{formatMoney(Number(bonus))}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>


                    {selectedManagerSummary.department === 'Опт' && (
                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Диагностика оптового расчёта</h3>
                      <p className='mb-4 text-sm text-slate-500'>Показывает оптовую базу 1,75%, исключения и начисления сотрудника. Розничные блоки 5% для опта не применяются.</p>
                      <div className='grid gap-3 md:grid-cols-3'>
                        {[
                          ['База опта', formatMoney(classification.wholesale.base)],
                          ['Ставка', '1,75%'],
                          ['Бонус опта', formatMoney(selectedManagerSummary.wholesaleBonus)],
                          ['Дни', selectedManagerPayroll.workedDays ?? '—'],
                          ['Оплата по дням', formatMoney(selectedManagerPayroll.dayPay)],
                          ['Бонус дисциплины', formatMoney(selectedManagerPayroll.disciplineBonus)],
                          ['Всего начислено', formatMoney(selectedManagerPayroll.grossPay)],
                          ['К выплате', formatMoney(selectedManagerPayroll.netPay)],
                        ].map(([label, value]) => (
                          <div key={String(label)} className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                            <p className='text-xs font-semibold uppercase text-slate-500'>{label}</p>
                            <p className='font-bold text-slate-900'>{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Строки сотрудника в базе опта</p>
                          <p className='font-bold text-slate-900'>{selectedManagerRows.filter((row) => row.calculationType === 'WHOLESALE_INCLUDED_1_75').length}</p>
                          <p className='mt-1 text-xs text-slate-500'>Сумма строк сотрудника: {formatMoney(selectedManagerRows.filter((row) => row.calculationType === 'WHOLESALE_INCLUDED_1_75').reduce((sum, row) => sum + row.revenue, 0))}</p>
                          <p className='mt-1 text-xs text-slate-400'>Бонус считается от общей базы опта: {formatMoney(classification.wholesale.base)}</p>
                        </div>
                        <div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-amber-700'>Исключено из базы опта</p>
                          <p className='font-bold text-amber-900'>{selectedManagerRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH').length}</p>
                          <p className='mt-1 text-xs text-amber-700'>Сумма: {formatMoney(selectedManagerRows.filter((row) => row.calculationType === 'WHOLESALE_EXCLUDED_TECH').reduce((sum, row) => sum + row.revenue, 0))}</p>
                        </div>
                      </div>
                    </Card>
                    )}

                    {selectedManagerSummary.department !== 'Опт' && (
                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Диагностика расчёта по сотруднику</h3>
                      <p className='mb-4 text-sm text-slate-500'>Показывает строки текущего загруженного отчёта, из которых портал собирает услуги, аксессуары и спорные позиции. Формулы здесь не меняются.</p>

                      <div className='grid gap-3 md:grid-cols-3'>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Услуги вошли</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.serviceIncludedRevenue)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Услуги не вошли</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.serviceExcludedRevenue)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Все услуги</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.serviceTotalRevenue)}</p>
                        </div>
                      </div>

                      <div className='mt-3 grid gap-3 md:grid-cols-4'>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Услуги бонус 50%</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.serviceBonus)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Обычные аксессуары</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.regularAccessoryRevenue)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Кредитные аксессуары</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.creditAccessoryRevenue)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Итого переменная часть</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.variableSalesBonus)}</p>
                        </div>
                      </div>

                      <div className='mt-3 grid gap-3 md:grid-cols-3'>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Общая база аксессуаров</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.accessoryRevenue)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Бонус аксессуаров 5%</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.accessoryBonus)}</p>
                        </div>
                        <div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-amber-700'>Отрицательные аксессуары</p>
                          <p className='font-bold text-amber-900'>{selectedManagerDiagnostics.negativeAccessoryCount} / {formatMoney(selectedManagerDiagnostics.negativeAccessoryRevenue)}</p>
                        </div>
                        <div className='rounded-lg border border-border bg-slate-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-slate-500'>Техника ВП / бонус</p>
                          <p className='font-bold text-slate-900'>{formatMoney(selectedManagerDiagnostics.techGrossProfitBase)} / {formatMoney(selectedManagerDiagnostics.techBonus)}</p>
                        </div>
                        <div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2'>
                          <p className='text-xs font-semibold uppercase text-amber-700'>Отрицательная техника ВП</p>
                          <p className='font-bold text-amber-900'>{selectedManagerDiagnostics.negativeTechCount} / {formatMoney(selectedManagerDiagnostics.negativeTechGrossProfit)}</p>
                        </div>
                      </div>

                      <div className='mt-5 space-y-5'>
                        <div>
                          <h4 className='mb-2 text-sm font-bold text-slate-900'>Услуги оказываемые — строки</h4>
                          {selectedManagerServiceRows.length ? (
                            <div className='max-h-72 overflow-auto rounded-lg border border-border'>
                              <table className='w-full min-w-[980px] text-xs'>
                                <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>ВП</th><th className='px-3 py-2'>Тип</th><th className='px-3 py-2'>Вошла?</th></tr></thead>
                                <tbody>{selectedManagerServiceRows.map((row, index) => (
                                  <tr key={'service-diagnostic-' + row.item + '-' + index} className='border-t border-border/70'>
                                    <td className='px-3 py-2'>{row.client || '—'}</td>
                                    <td className='px-3 py-2'>{row.category}</td>
                                    <td className='max-w-[320px] truncate px-3 py-2' title={row.item}>{row.item}</td>
                                    <td className='px-3 py-2'>{row.article || '—'}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td>
                                    <td className='px-3 py-2'>{row.calculationLabel}</td>
                                    <td className='px-3 py-2'>{getNotIncludedInServiceReason(row)} · {row.matchedRule}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          ) : <p className='text-sm text-slate-500'>Строк “Услуги оказываемые” по сотруднику не найдено.</p>}
                        </div>

                        {isAsadManager(selectedManagerSummary.manager) && (
                          <div>
                            <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
                              <h4 className='text-sm font-bold text-slate-900'>Плоттерные / антигравийные плёнки Асада</h4>
                              <p className='text-xs text-slate-500'>База {formatMoney(selectedManagerPlotterRows.reduce((sum, row) => sum + row.base, 0))} · бонус {formatMoney(selectedManagerPlotterRows.reduce((sum, row) => sum + row.bonus, 0))}</p>
                            </div>
                            {selectedManagerPlotterRows.length ? (
                              <div className='max-h-72 overflow-auto rounded-lg border border-border'>
                                <table className='w-full min-w-[1120px] text-xs'>
                                  <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>Себестоимость / база</th><th className='px-3 py-2'>Формула</th><th className='px-3 py-2 text-right'>Бонус</th><th className='px-3 py-2'>Статус</th></tr></thead>
                                  <tbody>{selectedManagerPlotterRows.map((row, index) => {
                                    const isNegativePlotterRow = row.revenue < 0 || row.cost < 0 || row.base < 0 || row.bonus < 0 || row.grossProfit < 0;
                                    return (
                                      <tr key={'plotter-diagnostic-' + row.item + '-' + index} className='border-t border-border/70'>
                                        <td className='px-3 py-2'>{row.client || '—'}</td>
                                        <td className='px-3 py-2'>{row.category}</td>
                                        <td className='max-w-[340px] truncate px-3 py-2' title={row.item}>{row.item}</td>
                                        <td className='px-3 py-2'>{row.article || '—'}</td>
                                        <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                                        <td className='px-3 py-2 text-right'>{formatMoney(row.base)}</td>
                                        <td className='px-3 py-2'>себестоимость × 50%</td>
                                        <td className='px-3 py-2 text-right font-semibold'>{formatMoney(row.bonus)}</td>
                                        <td className='px-3 py-2'>{isNegativePlotterRow ? <Badge className='bg-amber-100 text-amber-800'>Возврат / минус / отрицательная ВП учтена</Badge> : <Badge className='bg-green-100 text-green-800'>Учтено</Badge>}</td>
                                      </tr>
                                    );
                                  })}</tbody>
                                </table>
                              </div>
                            ) : <p className='text-sm text-slate-500'>Плоттерных / антигравийных строк по Асаду не найдено.</p>}
                          </div>
                        )}

                        <div>
                          <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
                            <h4 className='text-sm font-bold text-slate-900'>Подозрительная себестоимость техники / проверь 1С</h4>
                            <p className='text-xs text-slate-500'>{selectedManagerSuspiciousTechCostRows.length} строк</p>
                          </div>
                          {selectedManagerSuspiciousTechCostRows.length ? (
                            <div className='max-h-72 overflow-auto rounded-lg border border-amber-200'>
                              <table className='w-full min-w-[1180px] text-xs'>
                                <thead className='sticky top-0 bg-amber-50 text-left text-amber-800'><tr><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>Себестоимость</th><th className='px-3 py-2 text-right'>ВП</th><th className='px-3 py-2'>Тип расчёта</th><th className='px-3 py-2'>Причина</th></tr></thead>
                                <tbody>{selectedManagerSuspiciousTechCostRows.map((row, index) => (
                                  <tr key={'suspicious-tech-cost-' + row.item + '-' + index} className='border-t border-amber-100 align-top'>
                                    <td className='px-3 py-2'>{row.client || '—'}</td>
                                    <td className='px-3 py-2'>{row.category}</td>
                                    <td className='max-w-[340px] truncate px-3 py-2' title={row.item}>{row.item}</td>
                                    <td className='px-3 py-2'>{row.article || '—'}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.cost)}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td>
                                    <td className='px-3 py-2'>{row.calculationLabel}</td>
                                    <td className='px-3 py-2'>{getSuspiciousTechCostReason(row)} / проверь закрытие месяца</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          ) : <p className='text-sm text-slate-500'>Подозрительной себестоимости техники по сотруднику не найдено.</p>}
                        </div>

                        <div>
                          <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
                            <h4 className='text-sm font-bold text-slate-900'>Аксессуары {Math.round((selectedManagerSummary.accessoryRate ?? 0.05) * 100)}% — вошли в расчёт</h4>
                            <p className='text-xs text-slate-500'>База {formatMoney(selectedManagerDiagnostics.accessoryRevenue)} · бонус {formatMoney(selectedManagerDiagnostics.accessoryBonus)}</p>
                          </div>
                          {selectedManagerAccessoryRows.length ? (
                            <div className='max-h-72 overflow-auto rounded-lg border border-border'>
                              <table className='w-full min-w-[980px] text-xs'>
                                <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>ВП</th><th className='px-3 py-2'>Причина / правило</th><th className='px-3 py-2'>Действие</th></tr></thead>
                                <tbody>{selectedManagerAccessoryRows.map((row, index) => (
                                  <tr key={'accessory-diagnostic-' + row.item + '-' + index} className='border-t border-border/70'>
                                    <td className='px-3 py-2'>{row.client || '—'}</td>
                                    <td className='px-3 py-2'>{row.category}</td>
                                    <td className='max-w-[360px] truncate px-3 py-2' title={row.item}>{row.item}</td>
                                    <td className='px-3 py-2'>{row.article || '—'}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td>
                                    <td className='px-3 py-2'>{row.classificationReason} · {row.matchedRule.startsWith('manual-rule:') ? 'ручное правило' : row.matchedRule}</td>
                                    <td className='px-3 py-2'>{renderAccessoryRuleButton(row, row.isCreditSale ? 'credit' : 'disputed')}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          ) : <p className='text-sm text-slate-500'>Строк аксессуаров по сотруднику не найдено.</p>}
                        </div>

                        <div>
                          <div className='mb-2 flex flex-wrap items-center justify-between gap-3'>
                            <h4 className='text-sm font-bold text-slate-900'>Похоже на аксессуары, но не вошло</h4>
                            <p className='text-xs text-slate-500'>Потенциальная сумма {formatMoney(selectedManagerDiagnostics.potentialAccessoryRevenue)}</p>
                          </div>
                          {selectedManagerPotentialAccessoryRows.length ? (
                            <div className='max-h-72 overflow-auto rounded-lg border border-border'>
                              <table className='w-full min-w-[1080px] text-xs'>
                                <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2'>Артикул</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2'>Текущий тип</th><th className='px-3 py-2'>Почему не вошла</th><th className='px-3 py-2'>Действие</th></tr></thead>
                                <tbody>{selectedManagerPotentialAccessoryRows.map((row, index) => (
                                  <tr key={'potential-accessory-' + row.item + '-' + index} className='border-t border-border/70 align-top'>
                                    <td className='px-3 py-2'>{row.client || '—'}</td>
                                    <td className='px-3 py-2'>{row.category}</td>
                                    <td className='max-w-[320px] truncate px-3 py-2' title={row.item}>{row.item}</td>
                                    <td className='px-3 py-2'>{row.article || '—'}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                                    <td className='px-3 py-2'>{row.calculationLabel}</td>
                                    <td className='px-3 py-2'>{getNotIncludedInAccessoryReason(row)} · {row.matchedRule}</td>
                                    <td className='px-3 py-2'>{renderAccessoryRuleButton(row, 'disputed')}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          ) : <p className='text-sm text-slate-500'>Похожих на аксессуары пропущенных строк не найдено.</p>}
                        </div>

                        <div>
                          <h4 className='mb-2 text-sm font-bold text-slate-900'>Спорные строки сотрудника</h4>
                          {selectedManagerProblemSalesRows.length ? (
                            <div className='max-h-72 overflow-auto rounded-lg border border-border'>
                              <table className='w-full min-w-[1040px] text-xs'>
                                <thead className='sticky top-0 bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Клиент</th><th className='px-3 py-2'>Категория</th><th className='px-3 py-2'>Номенклатура</th><th className='px-3 py-2 text-right'>Выручка</th><th className='px-3 py-2 text-right'>ВП</th><th className='px-3 py-2'>Тип</th><th className='px-3 py-2'>Причина</th><th className='px-3 py-2'>Действие</th></tr></thead>
                                <tbody>{selectedManagerProblemSalesRows.map((row, index) => (
                                  <tr key={'problem-sales-' + row.item + '-' + index} className='border-t border-border/70 align-top'>
                                    <td className='px-3 py-2'>{row.client || '—'}</td>
                                    <td className='px-3 py-2'>{row.category}</td>
                                    <td className='max-w-[320px] truncate px-3 py-2' title={row.item}>{row.item}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.revenue)}</td>
                                    <td className='px-3 py-2 text-right'>{formatMoney(row.grossProfit)}</td>
                                    <td className='px-3 py-2'>{row.calculationLabel}</td>
                                    <td className='px-3 py-2'>{row.grossProfit < 0 ? 'Отрицательная ВП — проверить' : row.classificationReason} · {row.matchedRule}</td>
                                    <td className='px-3 py-2'>{row.grossProfit < 0 && !getManualRuleId(row) ? 'Проверить' : renderAccessoryRuleButton(row, row.isCreditSale ? 'credit' : 'disputed')}</td>
                                  </tr>
                                ))}</tbody>
                              </table>
                            </div>
                          ) : <p className='text-sm text-slate-500'>Спорных строк по сотруднику не найдено.</p>}
                        </div>
                      </div>
                    </Card>
                    )}

                    <Card>
                      <h3 className='mb-3 text-base font-bold text-slate-900'>Проверка по сотруднику</h3>
                      <h4 className='mb-2 text-sm font-bold text-slate-900'>Требует решения</h4>
                      <div className='grid gap-2 sm:grid-cols-2'>
                        {[
                          { label: 'Строки без классификации', count: selectedManagerCounts.unclassified, tone: 'error', problemType: 'unclassified' as ProblemType },
                          { label: 'NaN/undefined', count: selectedManagerCounts.invalidNumbers, tone: 'error', problemType: 'invalidNumbers' as ProblemType },
                          { label: 'Спорные товары', count: selectedManagerCounts.disputed, tone: 'warning', problemType: 'disputed' as ProblemType },
                          { label: 'Услуги не вошли в 50%', count: selectedManagerCounts.serviceNotIncluded, tone: 'warning', problemType: 'disputed' as ProblemType },
                          { label: 'Похоже на аксессуары, но не вошло', count: selectedManagerCounts.potentialAccessories, tone: 'warning', problemType: 'disputed' as ProblemType },
                          { label: 'Нулевая база без понятного расчёта', count: selectedManagerCounts.zeroBase, tone: 'warning', problemType: 'zeroBase' as ProblemType },
                          { label: 'Подозрительно нулевая / неполная себестоимость техники', count: selectedManagerCounts.suspiciousTechCost, tone: 'warning', problemType: 'disputed' as ProblemType },
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
                      <h4 className='mb-2 mt-4 text-sm font-bold text-slate-900'>Контроль / уже учтено</h4>
                      <div className='grid gap-2 sm:grid-cols-2'>
                        {[
                          { label: 'Кредитные продажи с понятным расчётом', count: selectedManagerCounts.classifiedCredits, problemType: 'credit' as ProblemType },
                          { label: 'Отрицательная ВП учтена в расчёте', count: selectedManagerCounts.accountedNegative, problemType: 'negative' as ProblemType },
                          { label: 'Нулевая база как контроль', count: selectedManagerCounts.informationalZeroBase, problemType: 'zeroBase' as ProblemType },
                        ].map(({ label, count, problemType }) => {
                          const isClickable = Number(count) > 0;
                          return (
                            <button
                              key={label}
                              type='button'
                              disabled={!isClickable}
                              onClick={() => {
                                openProblemRows(problemType, selectedManagerSummary.manager);
                                setSelectedManager(null);
                              }}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${isClickable ? 'cursor-pointer border-blue-100 bg-blue-50/50 hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm' : 'cursor-default border-border bg-white'}`}
                            >
                              <span className='min-w-0'>
                                <span className='block text-sm font-semibold text-slate-700'>{label}</span>
                                <span className='block text-xs text-slate-500'>{count} строк</span>
                              </span>
                              <span className='shrink-0'>
                                <Badge className={`${Number(count) === 0 ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'} ${isClickable ? 'ring-1 ring-current/20' : ''}`}>
                                  {Number(count) === 0 ? 'OK' : 'Учтено'}
                                  {isClickable && <ArrowRight className='ml-1 inline h-3.5 w-3.5' />}
                                </Badge>
                              </span>
                            </button>
                          );
                        })}
                      </div>
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
                  ['Строки аксессуаров', classification.counts.accessory],
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
                  {payrollTypeSummaries.map((summary) => (
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
                    <th className='px-4 py-3'>Аксессуары</th>
                    <th className='px-4 py-3'>Опт 1.75%</th>
                    <th className='px-4 py-3'>Итого бонусов без оклада</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollManagerSummaries.map((summary) => (
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
              <div className='mb-4 flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h2 className='text-lg font-bold text-slate-900'>Правила классификации</h2>
                      <p className='mt-1 text-sm text-slate-500'>Чтобы убрать позицию из спорных, нажмите “В аксессуары”. Будет создано точечное правило по этой номенклатуре: item + category + article, если он есть.</p>
                </div>
                <button
                  type='button'
                  onClick={() => void loadClassificationRules()}
                  disabled={isClassificationRulesLoading}
                  className='rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  Обновить
                </button>
              </div>
              {classificationRuleMessage && <p className='mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'>{classificationRuleMessage}</p>}
              {classificationRuleError && <p className='mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>{classificationRuleError}</p>}
              {classificationRules.length ? (
                <Table>
                  <thead className='bg-slate-50 text-left text-slate-500'>
                    <tr>
                      <th className='px-4 py-3'>Статус</th>
                      <th className='px-4 py-3'>Что ищем</th>
                      <th className='px-4 py-3'>Во что классифицируем</th>
                      <th className='px-4 py-3'>Причина</th>
                      <th className='px-4 py-3'>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classificationRules.slice(0, 50).map((rule) => (
                      <tr key={rule.id} className='border-t border-border/70'>
                        <td className='px-4 py-3'><Badge className={rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{rule.isActive ? 'Активно' : 'Отключено'}</Badge></td>
                        <td className='px-4 py-3 text-slate-700'>
                          <p className='font-semibold'>{rule.matchType}</p>
                          <p className='max-w-[420px] truncate text-xs text-slate-500' title={rule.itemText ?? ''}>{rule.itemText || '—'}</p>
                          <p className='text-xs text-slate-500'>{rule.categoryText || '—'}{rule.article ? ` · ${rule.article}` : ''}</p>
                        </td>
                        <td className='px-4 py-3 font-semibold text-slate-900'>{rule.targetCalculationType === 'REVIEW_ONLY' ? 'Проверить вручную' : calculationLabels[rule.targetCalculationType]}</td>
                        <td className='px-4 py-3 text-slate-700'>{rule.reason || '—'}</td>
                        <td className='px-4 py-3'>
                          {rule.isActive ? (
                            <button
                              type='button'
                              onClick={() => void disableClassificationRule(rule.id)}
                              disabled={classificationRuleActionId === `disable-${rule.id}`}
                              className='rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
                            >
                              Отключить
                            </button>
                          ) : (
                            <span className='text-xs text-slate-400'>Отключено</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className='text-sm text-slate-500'>{isClassificationRulesLoading ? 'Правила загружаются.' : 'Активных ручных правил пока нет.'}</p>
              )}
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
                      <th className='px-4 py-3'>Причина</th>
                      <th className='px-4 py-3'>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classification.disputedRows.slice(0, 50).map((row, rowIndex) => (
                      <tr key={`${row.item}-${rowIndex}`} className='border-t border-border/70'>
                        <td className='px-4 py-3 text-slate-700'>{row.manager}</td>
                        <td className='px-4 py-3 text-slate-700'>{row.category}</td>
                        <td className='max-w-[520px] truncate px-4 py-3 text-slate-700' title={row.item}>{row.item}</td>
                        <td className='px-4 py-3 font-semibold text-slate-900'>{row.calculationLabel}</td>
                        <td className='max-w-[360px] px-4 py-3 text-slate-700'>{row.classificationReason}</td>
                        <td className='px-4 py-3'>{renderAccessoryRuleButton(row, 'disputed')}</td>
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
                    <th className='px-4 py-3'>Прибыль после вычета 9% расходов</th>
                    <th className='px-4 py-3'>Бонус 10%</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollManagerSummaries.filter((summary) => summary.creditBonus !== 0).map((summary) => {
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
        {!workbook && (
          <>
            <Card>
              <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <h2 className='text-lg font-bold text-slate-900'>Сохранённые расчёты</h2>
                  <p className='text-sm text-slate-500'>Сохранённые расчёты доступны без повторной загрузки Excel.</p>
                </div>
                {lastSavedRunId && <Badge className='w-fit bg-green-100 text-green-800'>Последний расчёт: № {lastSavedRunId}</Badge>}
              </div>
              {isSavedPeriodsLoading ? (
                <p className='text-sm text-slate-500'>Загружаю сохранённые расчёты...</p>
              ) : savedPeriods.length === 0 ? (
                <p className='rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-slate-600'>Сохранённых расчётов пока нет.</p>
              ) : (
                <div className='grid gap-2'>
                  {savedPeriods.slice(0, 6).map((period) => {
                    const hasFinalRun = period.runs.some((run) => run.status === 'FINAL');
                    return (
                    <div key={period.id} className='rounded-lg border border-border bg-white px-3 py-2'>
                      <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                        <div>
                          <p className='text-sm font-bold text-slate-900'>{months[period.month] ?? period.periodKey} {period.year}</p>
                          <p className='text-xs text-slate-500'>Период {period.periodKey}</p>
                        </div>
                        <Badge className={period.status === 'CLOSED' ? 'w-fit bg-amber-100 text-amber-900' : 'w-fit bg-slate-100 text-slate-700'}>{period.status === 'CLOSED' ? 'Период закрыт' : 'Период открыт'}</Badge>
                      </div>
                      <div className='grid gap-2 md:grid-cols-2'>
                        {period.runs.map((run) => (
                          <div key={run.id} className='rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm'>
                            <div className='flex items-center justify-between gap-2'>
                              <span className='font-semibold text-slate-900'>Расчёт №{run.runNumber}</span>
                              <span className='text-xs text-slate-500'>{new Date(run.createdAt).toLocaleString('ru-RU')}</span>
                            </div>
                            <div className='mt-2 flex flex-wrap items-center gap-2'>
                              <Badge className={getPayrollRunStatusClass(run.status)}>{getPayrollRunStatusLabel(run.status)}</Badge>
                              {run.status === 'DRAFT' && period.status !== 'CLOSED' && (
                                <button type='button' onClick={() => updatePayrollRunStatus(run.id, 'CHECKED')} disabled={payrollHistoryActionId === `run-${run.id}-CHECKED`} className='rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-bold text-blue-800 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-60'>
                                  Отметить проверенным
                                </button>
                              )}
                              {(run.status === 'DRAFT' || run.status === 'CHECKED') && period.status !== 'CLOSED' && (
                                <button type='button' onClick={() => requestPayrollRunFinal(period, run)} disabled={payrollHistoryActionId === `run-${run.id}-FINAL`} className='rounded-md border border-green-200 bg-white px-2 py-1 text-xs font-bold text-green-800 transition hover:border-green-300 disabled:cursor-not-allowed disabled:opacity-60'>
                                  {hasFinalRun ? 'Заменить финальный' : 'Сделать финальным'}
                                </button>
                              )}
                              <button type='button' onClick={() => openSavedPayrollRun(run.id)} disabled={isSavedRunLoading} className='rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60'>
                                Открыть сохранённый расчёт
                              </button>
                            </div>
                            {run.status === 'SUPERSEDED' && run.supersededByRun && (
                              <p className='mt-2 text-xs font-semibold text-slate-500'>Заменён расчётом №{run.supersededByRun.runNumber}{run.supersededAt ? ` · ${new Date(run.supersededAt).toLocaleString('ru-RU')}` : ''}</p>
                            )}
                            <div className='mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-3'>
                              <span>Сотрудников: {run.employeeCount}</span>
                              <span>Проверить: {run.reviewCount}</span>
                              <span>К выплате: {formatMoney(run.netPay)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {selectedSavedRun && (
              <Card>
                <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div>
                    <h2 className='text-lg font-bold text-slate-900'>Сохранённый расчёт №{selectedSavedRun.runNumber}</h2>
                    <p className='mt-1 text-sm text-slate-500'>{selectedSavedRun.period.periodKey} · {getPayrollRunStatusLabel(selectedSavedRun.status)} · {new Date(selectedSavedRun.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <button type='button' onClick={exportSavedPayrollWorkbook} disabled={isSavedRunExporting} className='w-fit rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50'>
                      {isSavedRunExporting ? 'Формирую…' : 'Скачать ведомость'}
                    </button>
                    <button type='button' onClick={() => setSelectedSavedRun(null)} className='w-fit rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary/40'>
                      Закрыть просмотр
                    </button>
                  </div>
                </div>
                <p className='mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900'>
                  Это зафиксированная версия расчёта. Сохранены итоговые суммы, расшифровка и сведения об источниках; сам исходный файл не хранится.
                </p>
                {selectedSavedRun.status === 'SUPERSEDED' && selectedSavedRun.supersededByRun && (
                  <p className='mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700'>
                    Этот финальный расчёт заменён расчётом №{selectedSavedRun.supersededByRun.runNumber}{selectedSavedRun.supersededAt ? ` ${new Date(selectedSavedRun.supersededAt).toLocaleString('ru-RU')}` : ''}{selectedSavedRun.supersededBy ? ` · ${selectedSavedRun.supersededBy.name}` : ''}.
                  </p>
                )}
                <div className='mb-4 grid gap-3 md:grid-cols-4'>
                  <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'><p className='text-xs font-semibold uppercase text-slate-500'>Сотрудников</p><p className='mt-1 text-xl font-bold text-slate-900'>{selectedSavedRun.employeeCount}</p></div>
                  <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'><p className='text-xs font-semibold uppercase text-slate-500'>Проверить</p><p className='mt-1 text-xl font-bold text-slate-900'>{selectedSavedRun.reviewCount}</p></div>
                  <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'><p className='text-xs font-semibold uppercase text-slate-500'>Начислено</p><p className='mt-1 text-xl font-bold text-slate-900'>{formatMoney(selectedSavedRun.grossPay)}</p></div>
                  <div className='rounded-lg border border-border bg-slate-50 px-3 py-3'><p className='text-xs font-semibold uppercase text-slate-500'>К выплате</p><p className='mt-1 text-xl font-bold text-slate-900'>{formatMoney(selectedSavedRun.netPay)}</p></div>
                </div>
                <div className='max-w-full overflow-x-auto rounded-lg border border-border'>
                  <table className='w-full min-w-[760px] text-xs'>
                    <thead className='bg-slate-50 text-left text-slate-500'><tr><th className='px-3 py-2'>Сотрудник</th><th className='px-3 py-2'>Отдел</th><th className='px-3 py-2 text-right'>Дни</th><th className='px-3 py-2 text-right'>Начислено</th><th className='px-3 py-2 text-right'>К выплате</th><th className='px-3 py-2'>Статус</th></tr></thead>
                    <tbody>
                      {selectedSavedRun.employeeResults.map((row) => (
                        <tr key={row.id} className='border-t border-border/70'>
                          <td className='px-3 py-2 font-semibold text-slate-900'>{row.employeeName}</td>
                          <td className='px-3 py-2 text-slate-700'>{row.payrollDepartment}</td>
                          <td className='px-3 py-2 text-right text-slate-700'>{row.workedDays ?? '—'}</td>
                          <td className='px-3 py-2 text-right text-slate-700'>{formatMoney(row.grossPay)}</td>
                          <td className='px-3 py-2 text-right font-bold text-slate-900'>{formatMoney(row.netPay)}</td>
                          <td className='px-3 py-2'><Badge className={row.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{row.status === 'OK' ? 'Готово' : 'Проверить'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className='mt-4 grid gap-4 xl:grid-cols-3'>
                  <div><h3 className='mb-2 text-sm font-bold text-slate-900'>Исходные файлы</h3>{selectedSavedRun.sourceFiles.map((file) => <p key={file.id} className='rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs text-slate-600'>{file.originalName} · {getSavedSourceTypeLabel(file.type)} · строк {file.rowCount ?? '—'} · распознано {file.parsedRowCount ?? '—'}</p>)}</div>
                  <div><h3 className='mb-2 text-sm font-bold text-slate-900'>Ручные данные</h3><div className='max-h-48 overflow-auto rounded-lg border border-border'>{selectedSavedRun.manualInputs.map((input) => <p key={input.id} className='border-b border-border px-3 py-2 text-xs last:border-b-0'>{input.employeeName} · {getSavedInputTypeLabel(input.inputType)} · аванс {input.advance ?? input.purchaseAdvance ?? '—'} · {input.comment}</p>)}</div></div>
                  <div><h3 className='mb-2 text-sm font-bold text-slate-900'>Расшифровка</h3><div className='max-h-48 overflow-auto rounded-lg border border-border'>{selectedSavedRun.employeeResults.flatMap((employee) => employee.calculationDetails.map((detail) => <p key={detail.id} className='border-b border-border px-3 py-2 text-xs last:border-b-0'>{employee.employeeName} · {detail.component} · {formatMoney(detail.amount)}</p>))}</div></div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
      </div>
      {payrollFinalReplacement && (
        <div className='fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-[1px] sm:items-center' role='presentation'>
          <div className='w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl' role='dialog' aria-modal='true' aria-labelledby='replace-payroll-final-title'>
            <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-xl' aria-hidden='true'>!</div>
            <h2 id='replace-payroll-final-title' className='mt-4 text-xl font-extrabold text-slate-950'>Заменить финальный расчёт?</h2>
            <p className='mt-2 text-sm leading-6 text-slate-600'>
              За период {payrollFinalReplacement.periodKey} уже выбран финальный расчёт. Суммы не пересчитаются: изменится только утверждённая версия, а прежняя останется в истории.
            </p>
            <div className='mt-4 grid gap-3 sm:grid-cols-2'>
              <div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
                <p className='text-xs font-bold uppercase tracking-wide text-slate-500'>Сейчас финальный</p>
                <p className='mt-2 font-extrabold text-slate-900'>Расчёт №{payrollFinalReplacement.existingFinal.runNumber}</p>
                <p className='mt-1 text-lg font-bold text-slate-700'>{formatMoney(payrollFinalReplacement.existingFinal.netPay)}</p>
                <p className='mt-1 text-xs text-slate-500'>Получит статус «Заменён»</p>
              </div>
              <div className='rounded-xl border border-green-200 bg-green-50 p-4'>
                <p className='text-xs font-bold uppercase tracking-wide text-green-700'>Станет финальным</p>
                <p className='mt-2 font-extrabold text-slate-950'>Расчёт №{payrollFinalReplacement.targetRun.runNumber}</p>
                <p className='mt-1 text-lg font-bold text-green-800'>{formatMoney(payrollFinalReplacement.targetRun.netPay)}</p>
                <p className='mt-1 text-xs text-green-700'>Будет использоваться как итоговый</p>
              </div>
            </div>
            <p className='mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-5 text-blue-900'>
              В истории сохранятся администратор, время замены и связь между двумя расчётами.
            </p>
            <div className='mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
              <button type='button' onClick={() => setPayrollFinalReplacement(null)} disabled={payrollHistoryActionId !== null} className='rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60'>
                Отмена
              </button>
              <button type='button' onClick={() => void updatePayrollRunStatus(payrollFinalReplacement.targetRun.id, 'FINAL', true)} disabled={payrollHistoryActionId !== null} className='rounded-lg bg-green-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60'>
                {payrollHistoryActionId ? 'Сохраняю…' : 'Да, заменить финальный'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
