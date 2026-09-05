import type { OneCPayrollSalesReportRow } from '@/lib/one-c';

export type PayrollOneCPreviewRow = {
  manager: string;
  managerRef: string;
  client: string;
  clientRef: string;
  category: string;
  categoryRef: string;
  item: string;
  productRef: string;
  article: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  sourceRows: number;
  costReviewRows: number;
  costCalculationPendingRows: number;
};

export type PayrollOneCPreviewSummary = {
  sourceRows: number;
  normalizedRows: number;
  managerCount: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  missingManagerRows: number;
  missingCustomerRows: number;
  missingProductRows: number;
  costReviewRows: number;
  costCalculationPendingRows: number;
};

type MutablePreviewRow = PayrollOneCPreviewRow;

function addUniquePart(parts: string[], value: string) {
  const normalized = value.trim();
  if (!normalized || parts.some((part) => part.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'))) return;
  parts.push(normalized);
}

function buildItemName(fact: OneCPayrollSalesReportRow) {
  const parts: string[] = [];
  addUniquePart(parts, fact.productName || fact.productCode || fact.productRef);
  addUniquePart(parts, fact.characteristicName);
  addUniquePart(parts, fact.productArticle);
  // The accepted Excel renders an empty article as a trailing comma. Existing
  // EXACT_ITEM rules retain it. Reproduce that source format rather than
  // stripping punctuation from stored rules or broadening the shared matcher.
  // Only the proven product-only representation is compatible here. Keep
  // characteristic-bearing names unchanged; flattening them could match a
  // different product with a comma in its name. A real trailing comma in a
  // product name is preserved in addition to the empty-article separator.
  return parts.join(', ') + (fact.productArticle.trim() || fact.characteristicName.trim() ? '' : ',');
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getCostReviewFlags(facts: OneCPayrollSalesReportRow[]) {
  const flags = facts.map((fact) => fact.costReviewRequired === true || (fact.revenue !== 0 && fact.cost === 0));
  const movements = new Map<string, { indexes: number[]; cost: number; hasCostMovement: boolean; pending: boolean }>();
  facts.forEach((fact, index) => {
    // Monthly/product totals must not let another document hide a missing cost.
    // Legacy compact rows without document identity retain their warnings.
    if (!fact.recorderRef || !fact.period || !fact.managerRef || !fact.customerRef || !fact.productRef) return;
    const key = JSON.stringify([
      fact.recorderRef, fact.period, fact.organizationRef ?? '', fact.warehouseRef ?? '',
      fact.managerRef, fact.customerRef, fact.productRef, fact.characteristicRef,
      Math.sign(fact.revenue || fact.quantity || fact.cost),
    ]);
    const group = movements.get(key) ?? { indexes: [], cost: 0, hasCostMovement: false, pending: false };
    group.indexes.push(index);
    group.cost += fact.cost;
    group.hasCostMovement ||= fact.revenue === 0 && fact.cost !== 0;
    group.pending ||= fact.costCalculationPending === true;
    movements.set(key, group);
  });
  for (const group of movements.values()) {
    if (!group.hasCostMovement || roundMoney(group.cost) === 0 || group.pending) continue;
    for (const index of group.indexes) {
      const fact = facts[index];
      // v2 flags each revenue-only movement; resolve only this explained case.
      // Explicit warnings on nonzero-cost rows remain visible.
      if (fact.revenue !== 0 && fact.cost === 0) flags[index] = false;
    }
  }
  return flags;
}

export function buildPayrollOneCPreview(facts: OneCPayrollSalesReportRow[]) {
  const grouped = new Map<string, MutablePreviewRow>();
  let missingManagerRows = 0;
  let missingCustomerRows = 0;
  let missingProductRows = 0;
  let costReviewRows = 0;
  let costCalculationPendingRows = 0;

  const costReviewFlags = getCostReviewFlags(facts);
  for (const [index, fact] of facts.entries()) {
    if (!fact.managerRef || !fact.managerName) missingManagerRows += 1;
    if (!fact.customerRef || !fact.customerName) missingCustomerRows += 1;
    if (!fact.productRef || !fact.productName) missingProductRows += 1;
    const costReviewRequired = costReviewFlags[index];
    if (costReviewRequired) costReviewRows += 1;
    if (fact.costCalculationPending) costCalculationPendingRows += 1;

    const manager = fact.managerName || fact.managerRef || 'Менеджер не указан';
    const client = fact.customerName || fact.customerRef || 'Покупатель не указан';
    // The accepted Excel groups by Вид номенклатуры, not Товарная категория.
    const category = fact.productKindName || 'Вид номенклатуры не указан';
    const categoryRef = fact.productKindRef;
    const item = buildItemName(fact);
    const key = [fact.managerRef || manager, fact.customerRef || client, fact.productRef || item, fact.characteristicRef, categoryRef || category].join('|');
    const current = grouped.get(key) ?? {
      manager,
      managerRef: fact.managerRef,
      client,
      clientRef: fact.customerRef,
      category,
      categoryRef,
      item,
      productRef: fact.productRef,
      article: fact.productArticle,
      quantity: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      sourceRows: 0,
      costReviewRows: 0,
      costCalculationPendingRows: 0,
    };

    current.quantity += fact.quantity;
    current.revenue += fact.revenue;
    current.cost += fact.cost;
    current.grossProfit += fact.grossProfit;
    current.sourceRows += 1;
    if (costReviewRequired) current.costReviewRows += 1;
    if (fact.costCalculationPending) current.costCalculationPendingRows += 1;
    grouped.set(key, current);
  }

  const rows = Array.from(grouped.values())
    .map((row) => ({
      ...row,
      quantity: roundMoney(row.quantity),
      revenue: roundMoney(row.revenue),
      cost: roundMoney(row.cost),
      grossProfit: roundMoney(row.grossProfit),
    }))
    .sort((a, b) => a.manager.localeCompare(b.manager, 'ru') || b.revenue - a.revenue);

  const summary: PayrollOneCPreviewSummary = {
    sourceRows: facts.length,
    normalizedRows: rows.length,
    managerCount: new Set(rows.map((row) => row.managerRef || row.manager)).size,
    revenue: roundMoney(facts.reduce((sum, fact) => sum + fact.revenue, 0)),
    cost: roundMoney(facts.reduce((sum, fact) => sum + fact.cost, 0)),
    grossProfit: roundMoney(facts.reduce((sum, fact) => sum + fact.grossProfit, 0)),
    missingManagerRows,
    missingCustomerRows,
    missingProductRows,
    costReviewRows,
    costCalculationPendingRows,
  };

  return { rows, summary };
}
