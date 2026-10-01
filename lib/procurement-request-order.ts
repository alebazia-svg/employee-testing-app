import type { ExpenseRequestSourceRow } from './expense-request-source';

const key = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const empty = '00000000-0000-0000-0000-000000000000';
const cents = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  const result = Math.round(value * 100);
  return Number.isSafeInteger(result) && result > 0 ? result : undefined;
};

/** Native UI "Объект расчетов" is the Заказ cell, NOT ДокументОснование.
 * A whole request can belong to one order only when every allocation agrees.
 * Missing/partial/conflicting line evidence must never turn into a money guess.
 * Old servers retain the established header-only path until the new contract arrives.
 */
export function requestSettlementOrderRef(request: ExpenseRequestSourceRow): string | undefined {
  const header = key(request.source_document?.ref);
  const branch = request.payment_breakdown;
  if (branch === undefined) return header && header !== empty ? header : undefined;
  if (!branch || branch.contract !== 'expense-request-breakdown-v1' || branch.complete !== true ||
      branch.truncated !== false || !Array.isArray(branch.errors) || branch.errors.length ||
      !Array.isArray(branch.missing_fields) || branch.missing_fields.length ||
      !Array.isArray(branch.rows) || branch.rows.length > 200) return undefined;
  // Some native operations have no payment lines. Preserve their explicit header.
  if (!branch.rows.length) return header && header !== empty ? header : undefined;
  const total = cents(request.amount);
  if (total === undefined) return undefined;
  const seen = new Set<number>();
  const orders = new Set<string>();
  let allocated = 0;
  for (const row of branch.rows) {
    if (!row || !Number.isSafeInteger(row.line_number) || row.line_number! <= 0 || seen.has(row.line_number!)) return undefined;
    seen.add(row.line_number!);
    const order = row.fields?.Заказ, amount = row.fields?.Сумма;
    const ref = key(order?.ref);
    if (order?.filled !== true || order.type !== 'Заказ поставщику' || !uuid.test(ref) || ref === empty ||
        amount?.type !== 'Число') return undefined;
    const sum = cents(amount.value);
    if (sum === undefined) return undefined;
    // A line belonging to a different partner cannot inherit the header supplier.
    const partner = row.fields?.Партнер;
    if (partner?.filled === true && (!key(request.partner?.ref) || key(partner.ref) !== key(request.partner?.ref))) return undefined;
    orders.add(ref);
    allocated += sum;
    if (!Number.isSafeInteger(allocated)) return undefined;
  }
  if (orders.size !== 1 || allocated !== total) return undefined;
  const ref = [...orders][0];
  return header && header !== empty && header !== ref ? undefined : ref;
}
