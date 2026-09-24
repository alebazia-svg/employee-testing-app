import type { SupplierBalance } from './procurement-supplier-settlements';
import { isBuyerPaymentHistory } from './procurement-payment-priority';

/** Legacy/unverified balances must not look like a confirmed zero or payable. */
export function supplierPosition(balance?: SupplierBalance) {
  if (!balance || balance.reviewRequired !== false || !Number.isFinite(balance.debt) || !Number.isFinite(balance.advance)) return 'review';
  return balance.debt > 0.009 ? 'debt' : 'no-debt';
}

export function buyerOrderPurpose(order: Parameters<typeof isBuyerPaymentHistory>[0] & {noAcquisitions?:unknown}, balance?: SupplierBalance) {
  if (isBuyerPaymentHistory(order)) return 'history';
  if (order.noAcquisitions) return 'prepayment';
  const position = supplierPosition(balance);
  return position === 'review' ? 'review' : position === 'no-debt' ? 'history' : 'order';
}

export function supplierPositionSummary(balances: Record<string, SupplierBalance>) {
  const entries = Object.entries(balances);
  return {
    debt: entries.reduce((sum,[,b]) => sum + (supplierPosition(b) === 'debt' ? Math.round(b.debt*100) : 0),0)/100,
    reviewCount: entries.filter(([,b])=>supplierPosition(b)==='review').length,
  };
}
