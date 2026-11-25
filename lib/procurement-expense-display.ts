import 'server-only';
import { fetchExpenseRequestSnapshot, type ExpenseRequestSnapshot } from './expense-request-source';
import { createInFlightRead } from './procurement-inflight-read';

const read = createInFlightRead<ExpenseRequestSnapshot>();

// Display-only consumers can share a concurrent read. Mutations still read
// independently and no financial evidence is cached by this helper.
export function readProcurementExpenseDisplay(from: Date, to: Date) {
  return read(`${from.toISOString()}:${to.toISOString()}`, () =>
    fetchExpenseRequestSnapshot({ from, to, includeHistory: true, historyConcurrency: 2 }));
}
