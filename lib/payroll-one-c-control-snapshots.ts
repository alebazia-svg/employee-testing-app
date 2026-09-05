import type { PayrollOneCCloseState, PayrollPurchaseAttribution } from '@/lib/payroll-one-c-control-source';
import type { PayrollOneCPreviewSummary } from '@/lib/payroll-one-c';
import type { PayrollSupplierSettlement } from '@/lib/payroll-purchase-suppliers';

export const PAYROLL_ONE_C_SNAPSHOT_VERSION = 1;
export const PAYROLL_ONE_C_ROLLING_DAYS = 3;

export type PayrollOneCControlSlice = {
  version: 1;
  dateFrom: string;
  dateTo: string;
  close: PayrollOneCCloseState;
  source: {
    contractVersion: string;
    checkedAt: string;
    extractedAt: string;
    pages: number;
  };
  sales: {
    summary: PayrollOneCPreviewSummary;
    managerKeys: string[];
  };
  purchases: PayrollPurchaseAttribution;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function listDates(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  for (let date = dateFrom; date <= dateTo; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function getPayrollOneCRefreshDates(
  periodKey: string,
  verifiedThrough: string,
  existingDates: Iterable<string>,
  rollingDays = PAYROLL_ONE_C_ROLLING_DAYS,
) {
  const dateFrom = `${periodKey}-01`;
  const existing = new Set(existingDates);
  const dates = listDates(dateFrom, verifiedThrough);
  const rollingStart = addDays(verifiedThrough, -(Math.max(1, rollingDays) - 1));
  return dates.filter((date) => !existing.has(date) || date >= rollingStart);
}

export function isPayrollOneCControlSlice(value: unknown): value is PayrollOneCControlSlice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const slice = value as Partial<PayrollOneCControlSlice>;
  const summary = slice.sales?.summary as Partial<PayrollOneCPreviewSummary> | undefined;
  const summaryKeys: Array<keyof PayrollOneCPreviewSummary> = [
    'sourceRows', 'normalizedRows', 'managerCount', 'revenue', 'cost', 'grossProfit',
    'missingManagerRows', 'missingCustomerRows', 'missingProductRows', 'costReviewRows', 'costCalculationPendingRows',
  ];
  const finite = (number: unknown) => typeof number === 'number' && Number.isFinite(number);
  return slice.version === PAYROLL_ONE_C_SNAPSHOT_VERSION
    && typeof slice.dateFrom === 'string'
    && typeof slice.dateTo === 'string'
    && Boolean(slice.close && typeof slice.close === 'object' && slice.close.ready === true && Array.isArray(slice.close.blockingIssues))
    && Boolean(slice.source
      && typeof slice.source.contractVersion === 'string'
      && typeof slice.source.checkedAt === 'string'
      && typeof slice.source.extractedAt === 'string'
      && finite(slice.source.pages))
    && Boolean(summary && summaryKeys.every((key) => finite(summary[key])))
    && Boolean(slice.sales?.managerKeys.every((key) => typeof key === 'string'))
    && Boolean(slice.purchases
      && slice.purchases.contractVersion === 'payroll-purchase-attribution-v1'
      && typeof slice.purchases.employeeRef === 'string'
      && typeof slice.purchases.employeeName === 'string'
      && finite(slice.purchases.documentCount)
      && finite(slice.purchases.reviewDocumentCount)
      && finite(slice.purchases.ignoredOtherDocumentCount)
      && Array.isArray(slice.purchases.settlements)
      && slice.purchases.settlements.every((row) => row
        && typeof row.supplierName === 'string'
        && typeof row.organizationName === 'string'
        && typeof row.currency === 'string'
        && finite(row.debtIncrease)
        && finite(row.sourceRows)));
}

export function aggregatePayrollOneCControlSlices(slices: PayrollOneCControlSlice[]) {
  if (!slices.length) throw new Error('Нет сохранённых контрольных данных 1С.');
  const ordered = [...slices].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  const salesContract = ordered[0].source.contractVersion;
  const purchaseContract = ordered[0].purchases.contractVersion;
  if (ordered.some((slice) => slice.source.contractVersion !== salesContract || slice.purchases.contractVersion !== purchaseContract)) {
    throw new Error('Версии сохранённых источников 1С различаются; нужна полная перепроверка.');
  }

  const managerKeys = new Set<string>();
  const settlements = new Map<string, PayrollSupplierSettlement>();
  const salesSummary: PayrollOneCPreviewSummary = {
    sourceRows: 0,
    normalizedRows: 0,
    managerCount: 0,
    revenue: 0,
    cost: 0,
    grossProfit: 0,
    missingManagerRows: 0,
    missingCustomerRows: 0,
    missingProductRows: 0,
    costReviewRows: 0,
    costCalculationPendingRows: 0,
  };
  let documentCount = 0;
  let reviewDocumentCount = 0;
  let ignoredOtherDocumentCount = 0;

  for (const slice of ordered) {
    for (const manager of slice.sales.managerKeys) managerKeys.add(manager);
    for (const key of Object.keys(salesSummary) as Array<keyof PayrollOneCPreviewSummary>) {
      if (key !== 'managerCount') salesSummary[key] += slice.sales.summary[key];
    }
    documentCount += slice.purchases.documentCount;
    reviewDocumentCount += slice.purchases.reviewDocumentCount;
    ignoredOtherDocumentCount += slice.purchases.ignoredOtherDocumentCount;
    for (const row of slice.purchases.settlements) {
      const key = JSON.stringify([row.supplierName.trim(), row.organizationName.trim(), row.currency.trim()]);
      const current = settlements.get(key) ?? { ...row, debtIncrease: 0, sourceRows: 0 };
      current.debtIncrease += row.debtIncrease;
      current.sourceRows += row.sourceRows;
      settlements.set(key, current);
    }
  }

  salesSummary.managerCount = managerKeys.size;
  salesSummary.revenue = roundMoney(salesSummary.revenue);
  salesSummary.cost = roundMoney(salesSummary.cost);
  salesSummary.grossProfit = roundMoney(salesSummary.grossProfit);
  const latest = ordered[ordered.length - 1];

  return {
    period: { dateFrom: ordered[0].dateFrom, verifiedThrough: latest.dateTo },
    close: latest.close,
    source: {
      contractVersion: salesContract,
      checkedAt: ordered.reduce((latestValue, slice) => slice.source.checkedAt > latestValue ? slice.source.checkedAt : latestValue, ''),
      extractedAt: ordered.reduce((latestValue, slice) => slice.source.extractedAt > latestValue ? slice.source.extractedAt : latestValue, ''),
      pages: ordered.reduce((sum, slice) => sum + slice.source.pages, 0),
    },
    sales: { summary: salesSummary },
    purchases: {
      contractVersion: purchaseContract,
      employeeRef: latest.purchases.employeeRef,
      employeeName: latest.purchases.employeeName,
      documentCount,
      reviewDocumentCount,
      ignoredOtherDocumentCount,
      settlements: Array.from(settlements.values()),
    },
  };
}
