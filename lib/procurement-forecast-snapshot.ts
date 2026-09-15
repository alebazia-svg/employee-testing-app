import { createHash } from 'node:crypto';

import { buildSupplierIntelligence } from './procurement-supplier-intelligence';

export const PROCUREMENT_FORECAST_SNAPSHOT_VERSION = 1;

export type ProcurementForecastSnapshotPayload = {
  version: 1;
  asOf: string;
  sources: {
    ownerMoney: boolean;
    supplierOrders: boolean;
    supplierDebts: boolean;
    payroll: boolean;
    tbank: 'verified' | 'review' | 'unavailable';
    procurementManagerMapping: boolean;
  };
  liquidity: {
    accounts: Array<{ name: string; balanceMinor: number }>;
    totalMinor: number | null;
    vtbCardDailyWithdrawalLimitMinor: number;
    tbank: {
      renewsOn: string;
      transferredMinor: number | null;
      packagesPurchased: number | null;
      freeRemainingMinor: number | null;
      tierOneRemainingMinor: number | null;
      tierFiveRemainingMinor: number | null;
      currentRateBps: number | null;
    };
  };
  commitments: {
    salaryPayableMinor: number | null;
    rentEstimateMinor: number;
    plans: Array<{
      id: string;
      code: string;
      supplier: string;
      date: string;
      status: string;
      requestedMinor: number;
      issuedMinor: number;
      outstandingMinor: number;
      paymentMethod: string;
      currency: string;
    }>;
  };
  suppliers: Array<{
    key: string;
    name: string;
    openOrderCount: number;
    openOrdersMinor: number;
    medianOrderMinor: number | null;
    debtMinor: number | null;
    debtVerified: boolean;
    level: 'urgent' | 'attention' | null;
    attentionThresholdMinor: number | null;
    urgentThresholdMinor: number | null;
  }>;
};

type SnapshotInput = {
  asOf: string;
  sourceStatus: ProcurementForecastSnapshotPayload['sources'];
  accounts: Array<{ name: string; balanceMinor: number }>;
  salaryPayableMinor: number | null;
  rentEstimateMinor: number;
  plans: ProcurementForecastSnapshotPayload['commitments']['plans'];
  orders: Array<{ supplier: string; orderPaymentGapMinor: number }>;
  debts: Array<{ supplier: string; debtMinor: number; verified: boolean }>;
  tbank: ProcurementForecastSnapshotPayload['liquidity']['tbank'];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase('ru-RU')
  .replaceAll('ё', 'е').replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ');

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function checkedMinor(value: number, allowNegative = false) {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) throw new Error('FORECAST_SNAPSHOT_INVALID_AMOUNT');
  return value;
}

export function buildProcurementForecastSnapshot(input: SnapshotInput): ProcurementForecastSnapshotPayload {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.asOf)) throw new Error('FORECAST_SNAPSHOT_INVALID_DATE');
  const accounts = [...input.accounts]
    .map((row) => ({ name: row.name.trim(), balanceMinor: checkedMinor(row.balanceMinor, true) }))
    .filter((row) => row.name)
    .sort((left, right) => left.name.localeCompare(right.name, 'ru-RU'));
  const totalMinor = input.sourceStatus.ownerMoney
    ? accounts.reduce((sum, row) => checkedMinor(sum + row.balanceMinor, true), 0)
    : null;
  const groups = new Map<string, { name: string; gaps: number[]; debtMinor: number | null; debtVerified: boolean }>();
  for (const row of input.orders) {
    if (!row.supplier.trim() || row.orderPaymentGapMinor <= 0) continue;
    const key = normalize(row.supplier);
    const group = groups.get(key) ?? { name: row.supplier.trim(), gaps: [], debtMinor: null, debtVerified: true };
    group.gaps.push(checkedMinor(row.orderPaymentGapMinor));
    groups.set(key, group);
  }
  for (const row of input.debts) {
    if (!row.supplier.trim() || row.debtMinor < 0) continue;
    const key = normalize(row.supplier);
    const group = groups.get(key) ?? { name: row.supplier.trim(), gaps: [], debtMinor: null, debtVerified: true };
    group.debtMinor = checkedMinor((group.debtMinor ?? 0) + checkedMinor(row.debtMinor));
    group.debtVerified = group.debtVerified && row.verified;
    groups.set(key, group);
  }
  const signals = new Map(buildSupplierIntelligence({ orders: input.orders, debts: input.debts })
    .map((signal) => [signal.id, signal]));
  const suppliers = [...groups.entries()].map(([key, group]) => {
    const signal = signals.get(key);
    return {
      key,
      name: group.name,
      openOrderCount: group.gaps.length,
      openOrdersMinor: group.gaps.reduce((sum, value) => checkedMinor(sum + value), 0),
      medianOrderMinor: median(group.gaps),
      debtMinor: group.debtMinor,
      debtVerified: group.debtVerified,
      level: signal?.level ?? null,
      attentionThresholdMinor: signal?.attentionThresholdMinor ?? null,
      urgentThresholdMinor: signal?.urgentThresholdMinor ?? null,
    };
  }).sort((left, right) => left.key.localeCompare(right.key, 'ru-RU'));
  const plans = [...input.plans]
    .map((plan) => ({
      ...plan,
      supplier: plan.supplier.trim(),
      requestedMinor: checkedMinor(plan.requestedMinor),
      issuedMinor: checkedMinor(plan.issuedMinor),
      outstandingMinor: checkedMinor(plan.outstandingMinor),
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.code.localeCompare(right.code));
  return {
    version: PROCUREMENT_FORECAST_SNAPSHOT_VERSION,
    asOf: input.asOf,
    sources: { ...input.sourceStatus },
    liquidity: {
      accounts,
      totalMinor,
      vtbCardDailyWithdrawalLimitMinor: 35_000_000,
      tbank: { ...input.tbank },
    },
    commitments: {
      salaryPayableMinor: input.salaryPayableMinor === null ? null : checkedMinor(input.salaryPayableMinor),
      rentEstimateMinor: checkedMinor(input.rentEstimateMinor),
      plans,
    },
    suppliers,
  };
}

export function procurementForecastSnapshotHash(payload: ProcurementForecastSnapshotPayload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Never turn a disconnected 1C snapshot or a missing Astemir mapping into history. */
export function procurementForecastSnapshotReady(payload: ProcurementForecastSnapshotPayload) {
  return payload.sources.ownerMoney
    && payload.sources.supplierOrders
    && payload.sources.supplierDebts
    && payload.sources.procurementManagerMapping;
}

export type ProcurementForecastSnapshotChange = {
  liquidityDeltaMinor: number | null;
  tbankTransferCapacityDeltaMinor: number | null;
  salaryDeltaMinor: number | null;
  planOutstandingDeltaMinor: number;
  planChanges: Array<{
    id: string;
    code: string;
    supplier: string;
    date: string;
    status: string;
    paymentMethod: string;
    currency: string;
    previousOutstandingMinor: number;
    currentOutstandingMinor: number;
    deltaMinor: number;
    kind: 'new' | 'closed' | 'increased' | 'reduced';
  }>;
  supplierChanges: Array<{
    key: string;
    name: string;
    openOrdersDeltaMinor: number;
    debtDeltaMinor: number | null;
    previousLevel: 'urgent' | 'attention' | null;
    currentLevel: 'urgent' | 'attention' | null;
  }>;
};

/** Compares only like-for-like complete source fields; unavailable values stay unknown. */
export function compareProcurementForecastSnapshots(
  previous: ProcurementForecastSnapshotPayload,
  current: ProcurementForecastSnapshotPayload,
): ProcurementForecastSnapshotChange {
  const liquidityDeltaMinor = previous.liquidity.totalMinor === null || current.liquidity.totalMinor === null
    ? null : current.liquidity.totalMinor - previous.liquidity.totalMinor;
  const tbankCapacity = (payload: ProcurementForecastSnapshotPayload) => {
    const values = [
      payload.liquidity.tbank.freeRemainingMinor,
      payload.liquidity.tbank.tierOneRemainingMinor,
      payload.liquidity.tbank.tierFiveRemainingMinor,
    ];
    return values.some((value) => value === null)
      ? null
      : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  };
  const previousTbankCapacity = tbankCapacity(previous);
  const currentTbankCapacity = tbankCapacity(current);
  const tbankTransferCapacityDeltaMinor = previousTbankCapacity === null || currentTbankCapacity === null
    ? null : currentTbankCapacity - previousTbankCapacity;
  const salaryDeltaMinor = !previous.sources.payroll || !current.sources.payroll
    || previous.commitments.salaryPayableMinor === null || current.commitments.salaryPayableMinor === null
    ? null : current.commitments.salaryPayableMinor - previous.commitments.salaryPayableMinor;
  const planTotal = (payload: ProcurementForecastSnapshotPayload) => payload.commitments.plans
    .reduce((sum, plan) => checkedMinor(sum + plan.outstandingMinor), 0);
  const planOutstandingDeltaMinor = planTotal(current) - planTotal(previous);
  const plans = new Map<string, {
    previous?: ProcurementForecastSnapshotPayload['commitments']['plans'][number];
    current?: ProcurementForecastSnapshotPayload['commitments']['plans'][number];
  }>();
  for (const plan of previous.commitments.plans) plans.set(plan.id, { previous: plan });
  for (const plan of current.commitments.plans) plans.set(plan.id, { ...plans.get(plan.id), current: plan });
  const planChanges = [...plans.values()].flatMap((rows) => {
    const previousOutstandingMinor = rows.previous?.outstandingMinor ?? 0;
    const currentOutstandingMinor = rows.current?.outstandingMinor ?? 0;
    const deltaMinor = currentOutstandingMinor - previousOutstandingMinor;
    if (deltaMinor === 0) return [];
    const plan = rows.current ?? rows.previous!;
    return [{
      id: plan.id,
      code: plan.code,
      supplier: plan.supplier,
      date: plan.date,
      status: plan.status,
      paymentMethod: plan.paymentMethod,
      currency: plan.currency,
      previousOutstandingMinor,
      currentOutstandingMinor,
      deltaMinor,
      kind: !rows.previous ? 'new' as const
        : !rows.current || currentOutstandingMinor === 0 ? 'closed' as const
          : deltaMinor > 0 ? 'increased' as const : 'reduced' as const,
    }];
  }).sort((left, right) => {
    const priority = { new: 0, increased: 1, reduced: 2, closed: 3 };
    return priority[left.kind] - priority[right.kind]
      || Math.abs(right.deltaMinor) - Math.abs(left.deltaMinor)
      || left.supplier.localeCompare(right.supplier, 'ru-RU');
  });
  const suppliers = new Map<string, {
    previous?: ProcurementForecastSnapshotPayload['suppliers'][number];
    current?: ProcurementForecastSnapshotPayload['suppliers'][number];
  }>();
  for (const row of previous.suppliers) suppliers.set(row.key, { previous: row });
  for (const row of current.suppliers) suppliers.set(row.key, { ...suppliers.get(row.key), current: row });
  const supplierSourcesComparable = previous.sources.supplierOrders && current.sources.supplierOrders
    && previous.sources.supplierDebts && current.sources.supplierDebts;
  const supplierChanges = supplierSourcesComparable ? [...suppliers.entries()].flatMap(([key, rows]) => {
    const openOrdersDeltaMinor = (rows.current?.openOrdersMinor ?? 0) - (rows.previous?.openOrdersMinor ?? 0);
    const debtDeltaMinor = (rows.current?.debtMinor ?? 0) - (rows.previous?.debtMinor ?? 0);
    const previousLevel = rows.previous?.level ?? null;
    const currentLevel = rows.current?.level ?? null;
    if (openOrdersDeltaMinor === 0 && debtDeltaMinor === 0 && previousLevel === currentLevel) return [];
    return [{ key, name: rows.current?.name ?? rows.previous?.name ?? key,
      openOrdersDeltaMinor, debtDeltaMinor, previousLevel, currentLevel }];
  }).sort((left, right) => {
    const magnitude = (row: typeof left) => Math.max(Math.abs(row.openOrdersDeltaMinor), Math.abs(row.debtDeltaMinor ?? 0));
    return magnitude(right) - magnitude(left) || left.name.localeCompare(right.name, 'ru-RU');
  }) : [];
  return { liquidityDeltaMinor, tbankTransferCapacityDeltaMinor, salaryDeltaMinor, planOutstandingDeltaMinor, planChanges, supplierChanges };
}

export function isProcurementForecastSnapshot(value: unknown): value is ProcurementForecastSnapshotPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Partial<ProcurementForecastSnapshotPayload>;
  return payload.version === PROCUREMENT_FORECAST_SNAPSHOT_VERSION
    && typeof payload.asOf === 'string'
    && Boolean(payload.sources && typeof payload.sources.ownerMoney === 'boolean')
    && Boolean(payload.liquidity && Array.isArray(payload.liquidity.accounts))
    && Boolean(payload.commitments && Array.isArray(payload.commitments.plans))
    && Array.isArray(payload.suppliers);
}
