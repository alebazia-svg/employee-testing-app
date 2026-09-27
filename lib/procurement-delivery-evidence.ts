import { normalizeOneCDateTime, parseOneCDateTime } from './one-c-date';
import { DELIVERY_PERSON, DELIVERY_RESERVE, deliveryFresh } from './procurement-delivery-policy';
import type { DeliveryCashSnapshot } from '../components/ProcurementDeliveryCash';

type Row = Record<string, unknown>;
function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('DELIVERY_SOURCE_SHAPE');
  return value as Row;
}
function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) throw Error('DELIVERY_SOURCE_SHAPE');
  return value.map(object);
}
function minor(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('DELIVERY_AMOUNT_INVALID');
  const amount = Math.round(value * 100);
  if (!Number.isSafeInteger(amount) || Math.abs(value * 100 - amount) > 0.0001) throw Error('DELIVERY_AMOUNT_INVALID');
  return amount;
}
const dimensions = ['organization_ref', 'department_ref', 'purpose_ref', 'purpose_name', 'currency_ref'];
function key(row: Row) {
  if (dimensions.some(k => typeof row[k] !== 'string') || !row.organization_ref || !row.currency_ref) throw Error('DELIVERY_DIMENSIONS_INVALID');
  return JSON.stringify(dimensions.map(k => row[k]));
}

/** Validate the full monetary equation before netting departments within the exact org/currency. */
export function deliveryCashFromStatement(payload: unknown, window: { from: string; to: string }, now = Date.now()): DeliveryCashSnapshot {
  const data = object(payload);
  if (data.ok !== true || data.complete !== true || data.contract_version !== 'accountable-statement-v1'
    || data.mode !== 'read-only' || data.write_operations !== false || data.automatic_spending_allowed !== false
    || data.balance_meaning !== 'accounting_only_not_cash_on_hand') throw Error('DELIVERY_SOURCE_INCOMPLETE');
  if (data.person_ref !== DELIVERY_PERSON.ref || data.person_name !== DELIVERY_PERSON.name) throw Error('DELIVERY_IDENTITY_MISMATCH');
  if (data.date_from !== window.from || data.date_to !== window.to) throw Error('DELIVERY_PERIOD_MISMATCH');
  const checkedAt = normalizeOneCDateTime(data.as_of);
  if (!deliveryFresh({ balance: 0, checkedAt }, now)) throw Error('DELIVERY_SOURCE_STALE');
  const start = parseOneCDateTime(window.from)!.getTime();
  const end = parseOneCDateTime(data.end_exclusive)?.getTime();
  if (!end || end <= start || end > now + 60_000 || Math.abs(end - Date.parse(checkedAt)) > 1000) throw Error('DELIVERY_PERIOD_MISMATCH');
  const totals = new Map<string, [number, number]>();
  const add = (row: Row, sign: number) => {
    const k = key(row), current = totals.get(k) ?? [0, 0];
    current[0] += sign * minor(row.amount); current[1] += sign * minor(row.to_report);
    if (!current.every(Number.isSafeInteger)) throw Error('DELIVERY_AMOUNT_INVALID');
    totals.set(k, current);
  };
  const closing = rows(data.closing);
  for (const [section, sign] of [[rows(data.opening), 1], [closing, -1]] as const) {
    const seen = new Set<string>();
    for (const row of section) {
      const k = key(row);
      if (seen.has(k)) throw Error('DELIVERY_DUPLICATE_BALANCE');
      seen.add(k); add(row, sign);
    }
  }
  const seen = new Set<string>();
  for (const row of rows(data.movements)) {
    const k = JSON.stringify([row.document_ref, row.line_number]);
    if (typeof row.document_ref !== 'string' || !row.document_ref || !Number.isInteger(row.line_number) || seen.has(k)) throw Error('DELIVERY_DUPLICATE_MOVEMENT');
    seen.add(k);
    const at = parseOneCDateTime(row.period)?.getTime();
    if (at == null || at < start || at >= end || row.posted !== true || row.deleted !== false || ![1, -1].includes(row.sign as number)) throw Error('DELIVERY_MOVEMENT_INVALID');
    add(row, row.sign as number);
  }
  if ([...totals.values()].some(([amount, toReport]) => amount !== 0 || toReport !== 0)) throw Error('DELIVERY_RECONCILIATION_FAILED');
  const scoped = closing.filter(row => row.organization_ref === DELIVERY_PERSON.organizationRef && row.currency_ref === DELIVERY_PERSON.currencyRef);
  // A complete empty closing section means zero, not unavailable. Never use to_report as money.
  const balance = scoped.reduce((sum, row) => sum + minor(row.amount), 0);
  if (!Number.isSafeInteger(balance)) throw Error('DELIVERY_AMOUNT_INVALID');
  return { balance: balance / 100, checkedAt, lastIssue: null, reserveAdvice: DELIVERY_RESERVE };
}
