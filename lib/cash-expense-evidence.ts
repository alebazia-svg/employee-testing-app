import type { EmployeeExpenseSnapshot, EmployeeExpense } from './employee-expense-policy';
import { expenseOutstanding } from './employee-expense-policy';
import { expenseRecord as record, expenseText as text } from './expense-request-list-view';
import { parseOneCDateTime } from './one-c-date';
export type CashExpenseEvidence = {
  state: 'awaiting_documents' | 'documented'; checkedAt: string; cashboxRef: string;
  requests: EmployeeExpense[]; confirmedAt?: string; documentRefs?: string[];
};
export function pendingCashExpenseEvidence(input: { actual: number; expected: number | null; capturedAt: string; cashboxRef: string; snapshot: EmployeeExpenseSnapshot }): CashExpenseEvidence | undefined {
  const { snapshot } = input;
  if (input.expected === null || snapshot.state !== 'ready' || !snapshot.checkedAt || !input.cashboxRef || !snapshot.pending.length) return;
  // Only the full pending amount may explain a shortage. Never search arbitrary subsets to make cash match.
  const total = snapshot.pending.reduce((sum, row) => sum + Math.round(row.remaining * 100), 0);
  if (total <= 0 || Math.round((input.expected - input.actual) * 100) !== total) return;
  const captured = Date.parse(input.capturedAt);
  if (!Number.isFinite(captured) || snapshot.pending.some(row => { const date = parseOneCDateTime(row.date); return !date || +date > captured; })) return;
  return { state: 'awaiting_documents', checkedAt: snapshot.checkedAt, cashboxRef: input.cashboxRef, requests: snapshot.pending };
}
/** Confirm only newly posted, directly allocated cash orders after the original count. */
export function confirmCashExpenseDocuments(evidence: CashExpenseEvidence, capturedAt: string, sources: unknown[]): string[] | null {
  const captured = Date.parse(capturedAt), documents: string[] = [];
  if (!Number.isFinite(captured)) return null;
  for (const pending of evidence.requests) {
    const matches = sources.map(record).filter(row => text(row.ref).toLowerCase() === pending.ref.toLowerCase());
    if (matches.length !== 1) return null;
    const s = matches[0];
    if (text(record(s.cashbox).ref).toLowerCase() !== evidence.cashboxRef.toLowerCase() || s.deletionMark !== false || s.posted !== true || expenseOutstanding(s) !== 0) return null;
    const rows = record(s.linkedCashExpenseOrders).rows;
    if (!Array.isArray(rows)) return null;
    let amount = 0;
    for (const value of rows) {
      const row = record(value), at = parseOneCDateTime(text(row.date));
      if (!row.posted || row.deletion_mark || !at || +at <= captured) continue;
      amount += Math.round(Number(row.executed_amount) * 100); documents.push(text(row.ref));
    }
    if (amount !== Math.round(pending.remaining * 100)) return null;
  }
  return [...new Set(documents)];
}
