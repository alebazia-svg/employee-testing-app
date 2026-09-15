export type SupplierOrderExposure = {
  supplier: string;
  orderPaymentGapMinor: number;
};

export type SupplierDebtExposure = {
  supplier: string;
  debtMinor: number;
  verified: boolean;
};

export type SupplierIntelligence = {
  id: string;
  supplier: string;
  level: 'urgent' | 'attention';
  openOrderCount: number;
  openOrdersMinor: number;
  medianOrderMinor: number | null;
  debtMinor: number | null;
  attentionThresholdMinor: number;
  urgentThresholdMinor: number;
  primaryMetric: 'open_orders' | 'debt';
  primaryAmountMinor: number;
  reason: string;
  action: string;
  confidence: 'current_snapshot' | 'needs_review';
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU')
  .replaceAll('ё', 'е').replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ');

const median = (values: number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
};

const isNinetyFiveRu = (value: string) => /^95[\s-]*ru$/.test(normalize(value));

/**
 * Recalculates operational supplier attention from the current 1C snapshot.
 * It does not claim a historical trend until snapshot history exists.
 */
export function buildSupplierIntelligence(input: {
  orders: SupplierOrderExposure[];
  debts: SupplierDebtExposure[];
}): SupplierIntelligence[] {
  const groups = new Map<string, {
    supplier: string; gaps: number[]; debtMinor: number | null; debtVerified: boolean;
  }>();
  for (const order of input.orders) {
    if (!order.supplier.trim() || !Number.isSafeInteger(order.orderPaymentGapMinor) || order.orderPaymentGapMinor <= 0) continue;
    const key = normalize(order.supplier);
    const group = groups.get(key) ?? { supplier: order.supplier.trim(), gaps: [], debtMinor: null, debtVerified: true };
    group.gaps.push(order.orderPaymentGapMinor);
    groups.set(key, group);
  }
  for (const debt of input.debts) {
    if (!debt.supplier.trim() || !Number.isSafeInteger(debt.debtMinor) || debt.debtMinor < 0) continue;
    const key = normalize(debt.supplier);
    const group = groups.get(key) ?? { supplier: debt.supplier.trim(), gaps: [], debtMinor: null, debtVerified: true };
    group.debtMinor = (group.debtMinor ?? 0) + debt.debtMinor;
    group.debtVerified = group.debtVerified && debt.verified;
    groups.set(key, group);
  }

  return [...groups.entries()].flatMap(([id, group]) => {
    const openOrdersMinor = group.gaps.reduce((sum, value) => sum + value, 0);
    const medianOrderMinor = median(group.gaps);
    const attentionThresholdMinor = isNinetyFiveRu(group.supplier) ? 100_000_000 : 30_000_000;
    const scaleBasedUrgent = medianOrderMinor === null ? 0
      : group.gaps.length >= 2 ? medianOrderMinor * 2 : 100_000_000;
    const urgentThresholdMinor = isNinetyFiveRu(group.supplier)
      ? 200_000_000
      : Math.max(60_000_000, scaleBasedUrgent);
    const largestSignal = Math.max(openOrdersMinor, group.debtMinor ?? 0);
    if (largestSignal < attentionThresholdMinor) return [];
    const level = largestSignal >= urgentThresholdMinor ? 'urgent' : 'attention';
    const primaryMetric = openOrdersMinor >= (group.debtMinor ?? 0) ? 'open_orders' : 'debt';
    const triggeredBy = [
      openOrdersMinor >= attentionThresholdMinor ? 'остаток по активным заказам' : '',
      (group.debtMinor ?? 0) >= attentionThresholdMinor ? 'долг по взаиморасчётам' : '',
    ].filter(Boolean).join(' и ');
    return [{
      id, supplier: group.supplier, level,
      openOrderCount: group.gaps.length, openOrdersMinor, medianOrderMinor,
      debtMinor: group.debtMinor, attentionThresholdMinor, urgentThresholdMinor,
      primaryMetric, primaryAmountMinor: largestSignal,
      reason: `${triggeredBy.charAt(0).toUpperCase()}${triggeredBy.slice(1)} превышает порог внимания для этого поставщика.`,
      action: level === 'urgent'
        ? 'Определить сумму и дату ближайшей оплаты с учётом обязательных расходов.'
        : 'Проверить договорённость и решить, нужен ли частичный платёж.',
      confidence: group.debtVerified ? 'current_snapshot' : 'needs_review',
    } satisfies SupplierIntelligence];
  }).sort((left, right) => {
    if (left.level !== right.level) return left.level === 'urgent' ? -1 : 1;
    return Math.max(right.openOrdersMinor, right.debtMinor ?? 0)
      - Math.max(left.openOrdersMinor, left.debtMinor ?? 0);
  });
}
