import { parseOneCDateTime } from './one-c-date';

type Row = Record<string, unknown>;
const dimensions = ['analytics_ref', 'organization_ref', 'counterparty_ref', 'contract_ref', 'currency_ref'] as const;
export type SettlementBucket = {
  key: string;
  currencyRef: string;
  netMinor: number;
  debtMinor: number;
  advanceMinor: number;
  state: 'needs_review' | 'debt' | 'advance' | 'settled';
};
export type SupplierReconciliation = {
  state: 'available' | 'unavailable';
  reason: string | null;
  asOf: string | null;
  buckets: SettlementBucket[];
  documents?: Array<{ key: string; name: string; objectName: string; contract: string;
    currency: string; debtMinor: number; advanceMinor: number }>;
  automaticCompletionAllowed: false;
  automaticPaymentAllowed: false;
};
function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ROW');
  return value as Row;
}
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error('MISSING_ROWS');
  return value.map(record);
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('MISSING_IDENTITY');
  return value;
}
function minor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || !Number.isSafeInteger(Math.round(value * 100))
    || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) throw new Error('INVALID_AMOUNT');
  return Math.round(value * 100);
}
function add(a: number, b: number) {
  if (!Number.isSafeInteger(a + b)) throw new Error('AMOUNT_OVERFLOW');
  return a + b;
}
export function unavailableSupplierReconciliation(reason: string): SupplierReconciliation {
  return { state: 'unavailable', reason, asOf: null, buckets: [],
    automaticCompletionAllowed: false, automaticPaymentAllowed: false };
}

/** Supplier-wide evidence, not a list of payable orders. Never sum repeated
 * responses obtained through different anchor orders for the same supplier. */
export function reconcileSupplier(payload: unknown, expectedSupplierRef: string): SupplierReconciliation {
  try {
    const p = record(payload);
    if (p.contract_version !== 'supplier-reconciliation-v1'
      || p.ok !== true || p.complete !== true || p.ledger_complete !== true || p.documents_complete !== true
      || p.write_operations !== false || p.automatic_completion_allowed !== false
      || p.automatic_payment_recommendation_allowed !== false) throw new Error('INCOMPLETE_SOURCE');
    const supplier = rows(p.supplier);
    if (supplier.length !== 1 || supplier[0].supplier_ref !== expectedSupplierRef) throw new Error('SUPPLIER_MISMATCH');
    const asOf = parseOneCDateTime(p.as_of);
    if (!asOf) throw new Error('INVALID_AS_OF');
    const buckets = new Map<string, SettlementBucket>();
    for (const collection of ['ledger_balances', 'document_balances'] as const) {
      const seen = new Set<string>();
      for (const row of rows(p[collection])) {
        const key = JSON.stringify(dimensions.map(d => text(row[d])));
        const extra = collection === 'ledger_balances' ? ['settlement_object_ref']
          : ['settlement_object_ref', 'settlement_document_ref', 'due_date', 'arising_date'];
        const identity = JSON.stringify([key, ...extra.map(d => {
          if (typeof row[d] !== 'string') throw new Error('MISSING_DIMENSION');
          return row[d];
        })]);
        if (seen.has(identity)) throw new Error('DUPLICATE_BALANCE');
        seen.add(identity);
        const b = buckets.get(key) ?? { key, currencyRef: text(row.currency_ref), netMinor: 0,
          debtMinor: 0, advanceMinor: 0, state: 'settled' as const };
        if (collection === 'ledger_balances') b.netMinor = add(b.netMinor, minor(row.raw_balance));
        else {
          const debt = minor(row.raw_debt_balance), advance = minor(row.raw_prepayment_balance);
          if (debt < 0 || advance < 0) throw new Error('NEGATIVE_RESOURCE');
          b.debtMinor = add(b.debtMinor, debt);
          b.advanceMinor = add(b.advanceMinor, advance);
        }
        buckets.set(key, b);
      }
    }
    for (const b of buckets.values()) {
      if (b.netMinor !== add(b.advanceMinor, -b.debtMinor)) throw new Error('REGISTER_MISMATCH');
      b.state = b.debtMinor > 0 && b.advanceMinor > 0 ? 'needs_review'
        : b.debtMinor > 0 ? 'debt' : b.advanceMinor > 0 ? 'advance' : 'settled';
    }
    const documents = rows(p.document_balances).map(row => ({
      key: JSON.stringify([...dimensions, 'settlement_object_ref', 'settlement_document_ref', 'due_date', 'arising_date'].map(k => row[k])),
      name: typeof row.settlement_document_name === 'string' ? row.settlement_document_name : text(row.settlement_document_ref),
      objectName: typeof row.settlement_object_name === 'string' ? row.settlement_object_name : text(row.settlement_object_ref),
      contract: typeof row.contract_name === 'string' && row.contract_name.trim() ? row.contract_name : 'Без договора',
      currency: typeof row.currency_name === 'string' && row.currency_name.trim() ? row.currency_name : text(row.currency_ref),
      debtMinor: minor(row.raw_debt_balance), advanceMinor: minor(row.raw_prepayment_balance),
    }));
    return { state: 'available', reason: null, asOf: asOf.toISOString(), buckets: [...buckets.values()], documents,
      automaticCompletionAllowed: false, automaticPaymentAllowed: false };
  } catch (error) {
    return unavailableSupplierReconciliation(error instanceof Error ? error.message : 'INVALID_SOURCE');
  }
}

/** Only explicitly matched, outstanding, approved debt payments belong here.
 * Prepayments must remain separate. Caller supplies one exact settlement bucket.
 * Null means unknown/blocked, never zero available funds. */
export function debtPlanningCoverage(bucket: SettlementBucket, plans: Array<{ id: string; remainingMinor: number }>) {
  const seen = new Set<string>();
  let planned = 0;
  for (const plan of plans) {
    if (!plan.id || seen.has(plan.id) || !Number.isSafeInteger(plan.remainingMinor) || plan.remainingMinor < 0) {
      throw new Error('INVALID_OR_DUPLICATE_PLAN');
    }
    seen.add(plan.id);
    planned = add(planned, plan.remainingMinor);
  }
  const debt = Math.max(0, -bucket.netMinor);
  return { plannedMinor: planned, unplannedDebtMinor: bucket.state === 'needs_review' ? null : Math.max(0, debt - planned),
    // Do not add the full debt again on top of plans.
    excessPlannedMinor: Math.max(0, planned - debt), requiresReview: bucket.state === 'needs_review' || planned > debt };
}
