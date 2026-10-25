import { expenseRecord as record, expenseText as text, expenseName as name } from './expense-request-list-view';
import { employeePushTtl } from './employee-push-policy';

export const EMPLOYEE_EXPENSE_KIND = 'employee_expense_payable';
export const EXPENSE_SOURCE_MAX_AGE_MS = 6 * 60_000;
// An actionable cash instruction must not wait on an offline phone all day.
// The current obligation remains available in the authenticated PWA.
export function expensePushTtl(now: Date) { return Math.min(180, employeePushTtl(now)); }
export type EmployeeExpense = { ref: string; number: string; purpose: string; remaining: number; date: string; cycle: number };
export type EmployeeExpenseSnapshot = { state: 'ready' | 'unavailable' | 'unmapped'; checkedAt: string | null; payable: EmployeeExpense[]; pending: EmployeeExpense[] };
const minor = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
const complete = (value: unknown) => {
  const b = record(value);
  return b.complete === true && b.truncated !== true && (!Array.isArray(b.errors) || !b.errors.length) && (!Array.isArray(b.missing_fields) || !b.missing_fields.length);
};
/** Direct posted RKO allocations, not the document total (one order may pay several requests). */
export function expenseOutstanding(source: unknown): number | null {
  return expenseRemaining(source, true);
}
export function expenseRemaining(source: unknown, requireRequestCashbox: boolean): number | null {
  const s = record(source), execution = record(s.execution), links = record(s.linkedCashExpenseOrders);
  const total = minor(s.amount), remaining = minor(execution.remaining_amount), executed = minor(execution.executed_amount);
  if (record(s.completeness).complete === false || execution.amounts_consistent === false || total === null || total === 0 || remaining === null || executed === null || remaining + executed !== total
    || !complete(execution) || !complete(links) || !Array.isArray(links.rows)) return null;
  const refs = new Set<string>(); let paid = 0;
  for (const value of links.rows) {
    const r = record(value), ref = text(r.ref).toLowerCase(), allocation = minor(r.executed_amount);
    if (!ref || refs.has(ref) || r.request_amount_conflict === true || typeof r.posted !== 'boolean' || typeof r.deletion_mark !== 'boolean') return null;
    refs.add(ref);
    if (!r.posted || r.deletion_mark) { if (allocation !== 0) return null; continue; }
    if (allocation === null || allocation !== minor(r.request_amount) || minor(r.amount) === null || allocation > minor(r.amount)!
      || !Array.isArray(r.source_paths) || !r.source_paths.some(p => p === 'header.request' || p === 'payment_line.request')
      || !text(record(r.cashbox).ref)
      || requireRequestCashbox && text(record(r.cashbox).ref).toLowerCase() !== text(record(s.cashbox).ref).toLowerCase()) return null;
    paid += allocation;
  }
  return paid === executed ? remaining / 100 : null;
}
export function employeeExpenseSnapshot(input: { cashboxRef: string; uniqueOwner: boolean; complete: boolean; checkedAt: string | null; now: number;
  rows: Array<{ source: unknown; seenAt: string; cycle: number }> }): EmployeeExpenseSnapshot {
  const result: EmployeeExpenseSnapshot = { state: 'unavailable', checkedAt: input.checkedAt, payable: [], pending: [] };
  if (!input.cashboxRef || !input.uniqueOwner) return { ...result, state: 'unmapped' };
  const checked = Date.parse(input.checkedAt ?? '');
  if (!input.complete || !Number.isFinite(checked) || checked > input.now || input.now - checked > EXPENSE_SOURCE_MAX_AGE_MS) return result;
  result.state = 'ready'; const refs = new Set<string>();
  for (const row of input.rows) {
    const s = record(row.source);
    if (text(record(s.cashbox).ref).toLowerCase() !== input.cashboxRef.toLowerCase()) continue;
    if (s.deletionMark === true || text(record(s.status).key) === 'rejected') continue;
    const payment = record(s.paymentForm);
    if (payment.cash === false) continue;
    const status = text(record(s.status).key);
    if (!['payable', 'not_approved', 'approved'].includes(status)) continue;
    // A request can be fully paid by several cashboxes. Retire that obligation,
    // but retain strict own-cashbox proof for partial work and recount evidence.
    if (expenseRemaining(s, false) === 0) continue;
    const remaining = expenseOutstanding(s);
    const seen = Date.parse(row.seenAt), ref = text(s.ref).toLowerCase();
    if (!ref || refs.has(ref) || !Number.isFinite(seen) || seen > input.now || input.now - seen > EXPENSE_SOURCE_MAX_AGE_MS
      || !['руб', 'руб.', 'rub', 'rur', '₽'].includes(name(s.currency).toLowerCase())
      || s.posted !== true || s.deletionMark !== false || payment.cash !== true || payment.cashless === true || payment.card === true) {
      result.state = 'unavailable'; continue;
    }
    refs.add(ref);
    if (remaining === null) { result.state = 'unavailable'; continue; }
    const item = { ref, number: text(s.number), purpose: name(s.cashFlowItem) || name(s.counterparty) || name(s.businessOperation) || 'Расход', remaining, date: text(s.date), cycle: row.cycle };
    (status === 'payable' ? result.payable : result.pending).push(item);
  }
  // A partial response may inform ADMIN; it must not claim that employee work disappeared.
  if (result.state !== 'ready') { result.payable = []; result.pending = []; }
  return result;
}
export function employeeExpenseHint(snapshot: EmployeeExpenseSnapshot) {
  if (snapshot.state !== 'ready') return '';
  if (snapshot.payable.length && snapshot.pending.length) return 'По заявкам к оплате оформите расходники в 1С. Несогласованные заявки будут учтены при сверке.';
  if (snapshot.payable.length) return 'Есть заявки к оплате. Оформите расходники в 1С.';
  return snapshot.pending.length ? 'Есть несогласованные заявки. Они будут учтены при сверке.' : '';
}
export function expenseNotificationKey(userId: number, cashboxRef: string, item: EmployeeExpense) {
  return `employee-expense:${userId}:${cashboxRef}:${item.ref}:${item.cycle}`;
}
