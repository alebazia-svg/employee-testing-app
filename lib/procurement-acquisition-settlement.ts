import { parseOneCDateTime } from '@/lib/one-c-date';

type Row = Record<string, unknown>;
export type AcquisitionSettlement = {
  orderRef: string;
  asOf: string | null;
  state: 'verified' | 'unavailable';
  reason: string | null;
  // This is receipt evidence, never authority to change a portal plan or 1C.
  automaticCompletionAllowed: false;
  receipts: Array<{
    ref: string;
    number: string;
    currencyRef: string;
    currencyName: string;
    documentAmountMinor: number;
    outstandingMinor: number | null;
    status: 'debt' | 'settled' | 'needs_review';
  }>;
};

function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_ROW');
  return value as Row;
}
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw new Error('MISSING_ROWS');
  return value.map(object);
}
function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('MISSING_IDENTIFIER');
  return value.trim();
}
function minor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new Error('INVALID_AMOUNT');
  }
  return Math.round(value * 100);
}
function unique(items: Row[], keys: string[]) {
  const seen = new Set<string>();
  for (const item of items) {
    const key = JSON.stringify(keys.map((k) => item[k] ?? null));
    if (seen.has(key)) throw new Error('DUPLICATE_GRAIN');
    seen.add(key);
  }
}
export function unavailableAcquisitionSettlement(orderRef: string, reason: string): AcquisitionSettlement {
  return { orderRef, asOf: null, state: 'unavailable', reason, automaticCompletionAllowed: false, receipts: [] };
}

/** Strict, read-only adapter for 414. No supplier totals, FX estimates or order
 * document amounts are substitutes for acquisition settlement register balances.
 * Whole receipt values must NOT be summed across orders: a receipt can be shared.
 */
export function evaluateAcquisitionSettlement(payload: unknown, orderRef: string): AcquisitionSettlement {
  try {
    const p = object(payload);
    if (p.ok !== true || p.complete !== true || p.mode !== 'read-only' || p.write_operations !== false
      || p.automatic_completion_allowed !== false || p.contract_version !== 'supplier-document-evidence-v1'
      || p.new_settlement_architecture !== true
      || p.due_date_balance_scope !== 'exact_settlement_documents_all_history_through_as_of'
      || p.receipt_source_movement_scope !== 'linked_receipt_registrars_all_history_through_as_of'
      || p.due_date_movement_scope !== 'requested_window_exact_receipt_links_or_order_object'
      || p.receipt_amount_scope !== 'whole_receipt_not_allocated_to_order') throw new Error('UNSUPPORTED_OR_INCOMPLETE_SOURCE');
    const asOf = parseOneCDateTime(p.as_of);
    const from = parseOneCDateTime(p.movement_date_from);
    if (!asOf || !from || from > asOf) throw new Error('INVALID_SOURCE_DATES');
    const orders = rows(p.order);
    if (orders.length !== 1 || orders[0].order_ref !== orderRef || orders[0].posted !== true || orders[0].deleted !== false) {
      throw new Error('ORDER_SCOPE_MISMATCH');
    }
    const receipts = rows(p.receipts);
    const balances = rows(p.due_date_balances);
    const movements = rows(p.due_date_movements);
    const sources = rows(p.receipt_source_movements);
    // Require the complete contract even though the legacy ledger is not used.
    rows(p.balances); rows(p.movements);
    unique(receipts, ['receipt_ref']);
    unique(balances, ['analytics_ref', 'organization_ref', 'supplier_ref', 'counterparty_ref', 'contract_ref',
      'settlement_object_ref', 'settlement_document_ref', 'currency_ref', 'due_date', 'arising_date']);
    unique(movements, ['recorder_ref', 'line_number']);
    unique(sources, ['recorder_ref', 'line_number']);
    const allowed = new Set([orderRef, ...receipts.map((r) => requiredText(r.receipt_ref))]);
    for (const b of balances) {
      if (!allowed.has(requiredText(b.settlement_document_ref))) throw new Error('UNRELATED_BALANCE');
      requiredText(b.analytics_ref); requiredText(b.currency_ref); requiredText(b.settlement_object_ref);
      minor(b.raw_debt_balance); minor(b.raw_prepayment_balance);
    }
    const result = receipts.map((r) => {
      const ref = requiredText(r.receipt_ref);
      const currencyRef = requiredText(r.currency_ref);
      const receiptDate = parseOneCDateTime(r.receipt_date);
      if (r.posted !== true || !receiptDate || receiptDate > asOf) throw new Error('INVALID_RECEIPT');
      const bs = balances.filter((b) => b.settlement_document_ref === ref);
      const ms = movements.filter((m) => m.settlement_document_ref === ref);
      const ss = sources.filter((s) => s.recorder_ref === ref);
      const result = {
        ref, number: requiredText(r.receipt_number), currencyRef, currencyName: requiredText(r.currency_name),
        documentAmountMinor: minor(r.document_amount), outstandingMinor: null as number | null,
        status: 'needs_review' as 'debt' | 'settled' | 'needs_review',
      };
      // Unsupported FX must not become a RUB zero or a paid receipt.
      if ([...bs, ...ms, ...ss].some((row) => row.currency_ref !== currencyRef)) return result;
      const debt = bs.reduce((sum, b) => sum + Math.max(0, minor(b.raw_debt_balance)), 0);
      if (!Number.isSafeInteger(debt)) throw new Error('INVALID_AMOUNT');
      if (debt > 0) return { ...result, outstandingMinor: debt, status: 'debt' as const };
      // Empty balances alone are not proof. Require a complete movement window
      // since receipt creation and independently recorded acquisition + offset.
      if (receiptDate < from || !ms.length || result.documentAmountMinor <= 0) return result;
      const groups = new Map<string, { incoming: number; outgoing: number; recognized: number }>();
      for (const m of ms) {
        const date = parseOneCDateTime(m.movement_date);
        if (!date || date < from || date > asOf || !['Приход', 'Расход'].includes(String(m.movement_type))) return result;
        const value = minor(m.raw_debt);
        if (value < 0) return result; // correction/return requires separate policy
        const key = JSON.stringify([requiredText(m.analytics_ref), requiredText(m.settlement_object_ref), currencyRef]);
        const g = groups.get(key) ?? { incoming: 0, outgoing: 0, recognized: 0 };
        if (m.movement_type === 'Приход') {
          g.incoming += value;
          if (m.source_recorder_ref === ref) g.recognized += value;
        } else g.outgoing += value;
        groups.set(key, g);
      }
      const recognized = [...groups.values()].reduce((sum, g) => sum + g.recognized, 0);
      const acquisitionRecorded = ss.some((s) => minor(s.raw_amount) > 0);
      // Conservative: a correction, allocation ambiguity, or mixed analytics does
      // not earn a settled badge. A reconciled zero is not called cash paid.
      if (acquisitionRecorded && recognized === result.documentAmountMinor
        && [...groups.values()].every((g) => g.incoming === g.outgoing && g.recognized > 0)
        && bs.every((b) => minor(b.raw_debt_balance) === 0 && minor(b.raw_prepayment_balance) === 0)) {
        return { ...result, outstandingMinor: 0, status: 'settled' as const };
      }
      return result;
    });
    return { orderRef, asOf: asOf.toISOString(), state: 'verified', reason: null,
      automaticCompletionAllowed: false, receipts: result };
  } catch (error) {
    return unavailableAcquisitionSettlement(orderRef, error instanceof Error ? error.message : 'INVALID_SOURCE');
  }
}
