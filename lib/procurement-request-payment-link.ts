import type { ExpenseRequestSourceRow } from './expense-request-source';
import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';
import { samePaymentSupplier } from './procurement-manual-payment-links';
import { parseOneCDateTime } from './one-c-date';
import { requestSettlementOrderRef } from './procurement-request-order';

const key = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
const ruble = (value: string | null | undefined) => ['rub', 'руб', '₽'].includes(key(value));
const equalAmount = (a: unknown, b: number) => typeof a === 'number' && Number.isFinite(a) && a > 0 && Math.round(a * 100) === Math.round(b * 100);

/** A posted request's exact source/settlement order + whole-RKO link, never a money/date guess.
 * Keep the original basis/fingerprint intact. Recompute derived links every read.
 * Multi-request/split RKOs need an allocation contract and remain unassigned here. */
export function attachRequestOrderLinks(payments: SupplierCurrencyPaymentRow[], requests: ExpenseRequestSourceRow[]) {
  return payments.map(payment => {
    const clean = { ...payment, requestOrderRef: undefined };
    if (!payment.posted || payment.deleted || !ruble(payment.documentCurrency) || !Number.isFinite(payment.documentAmount) || payment.documentAmount <= 0) return clean;
    const owners = requests.filter(request => request.linked_cash_expense_orders?.rows?.some(row => key(row.ref) === key(payment.ref)));
    if (owners.length !== 1) return clean;
    const request = owners[0], branch = request.linked_cash_expense_orders!;
    const source = requestSettlementOrderRef(request), header = key(payment.baseDocumentRef);
    const requestAt = parseOneCDateTime(request.date ?? ''), paidAt = parseOneCDateTime(payment.date);
    if (!source || !request.ref || request.posted !== true || request.deletion_mark !== false ||
        request.completeness?.request !== true || request.completeness?.linked_cash_expense_orders !== true ||
        !ruble(request.currency?.name) || !requestAt || !paidAt || requestAt > paidAt ||
        !samePaymentSupplier({ supplierPartner: request.partner?.name ?? '', supplierCounterparty: request.counterparty?.name ?? '' }, payment) ||
        (header && header !== key(request.ref) && header !== source) ||
        (payment.settlementOrderRef && key(payment.settlementOrderRef) !== source) ||
        branch.complete !== true || branch.truncated !== false ||
        !Array.isArray(branch.errors) || branch.errors.length || !Array.isArray(branch.missing_fields) || branch.missing_fields.length) return clean;
    const links = branch.rows!.filter(row => key(row.ref) === key(payment.ref));
    if (links.length !== 1) return clean;
    const link = links[0];
    if (link.posted !== true || link.deletion_mark !== false || link.request_amount_conflict !== false ||
        parseOneCDateTime(link.date ?? '')?.getTime() !== paidAt.getTime() ||
        !equalAmount(link.amount, payment.documentAmount) || !equalAmount(link.request_amount, payment.documentAmount) ||
        !equalAmount(link.executed_amount, payment.documentAmount)) return clean;
    return { ...clean, requestOrderRef: source };
  });
}
