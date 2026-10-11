/** The list never treats viewing/reviewing a request as its business completion. */
export type ExpenseListStage = 'decision' | 'issuance' | 'check' | 'closed';
export type ExpenseListItem = {
  id: string; nativeRef: string; number: string; person: string; amount: number | null;
  date: string | null; since: string | null; checkedAt: string; operation: string;
  purpose: string; comment: string; cashbox: string; department: string; article: string;
  recipient: string; basis: string; stage: ExpenseListStage; status: string;
  archived?: boolean; statusKey: string; missing: string[]; sourceComplete: boolean; nativeEnabled: boolean;
};
export const expenseRecord = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const expenseText = (v: unknown) => typeof v === 'string' ? v.trim() : '';
export const expenseName = (v: unknown) => expenseText(expenseRecord(v).name);
const minor = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) : null;
function completeBranch(v: unknown) {
  const b = expenseRecord(v);
  return b.complete === true && b.truncated !== true && (!Array.isArray(b.errors) || !b.errors.length) && (!Array.isArray(b.missing_fields) || !b.missing_fields.length);
}
export function expenseListStage(status: string, amount: number | null, source: unknown, complete: boolean, deleted: boolean): ExpenseListStage {
  if (deleted || status === 'rejected') return 'closed';
  const s = expenseRecord(source), e = expenseRecord(s.execution), links = expenseRecord(s.linkedCashExpenseOrders);
  const requestMinor = minor(amount);
  if (complete && requestMinor !== null && requestMinor > 0 && completeBranch(e) && completeBranch(links)
    && e.state === 'fully_executed' && minor(e.remaining_amount) === 0 && minor(e.executed_amount) === requestMinor && Array.isArray(links.rows)) {
    const refs = new Set<string>(); let paid = 0; let valid = true;
    for (const value of links.rows) {
      const r = expenseRecord(value), ref = expenseText(r.ref), executed = minor(r.executed_amount);
      if (!ref || refs.has(ref) || r.request_amount_conflict === true || typeof r.posted !== 'boolean' || typeof r.deletion_mark !== 'boolean') { valid = false; break; }
      refs.add(ref);
      if (!r.posted || r.deletion_mark) { if (executed !== 0) valid = false; continue; }
      if (executed === null || executed !== minor(r.request_amount) || minor(r.amount) === null || executed > minor(r.amount)!
        || !Array.isArray(r.source_paths) || !r.source_paths.some(p => p === 'header.request' || p === 'payment_line.request')) { valid = false; break; }
      paid += executed;
    }
    if (valid && paid === requestMinor) return 'closed';
  }
  if (status === 'not_approved' || status === 'approved') return 'decision';
  if (status === 'payable') return 'issuance';
  return 'check';
}
