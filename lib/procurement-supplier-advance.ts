import type { SupplierBalance } from './procurement-supplier-settlements';

// Stored in the existing paymentPurpose string: never infer an advance from a
// comment or change the meaning of historical supplier-debt requests.
export const SUPPLIER_ADVANCE = 'SUPPLIER_ADVANCE';
export const SUPPLIER_ADVANCE_LABEL = 'Аванс поставщику';
export const isAdvanceChoice = (ref: string) => ref.startsWith('advance:');
export const isSupplierChoice = (ref: string) => ref.startsWith('debt:') || isAdvanceChoice(ref);
export function supplierAdvanceChoices(balances: Record<string, SupplierBalance>, activeNames: string[], unavailable = false) {
  if (unavailable) return [];
  return Object.entries(balances).filter(([name]) => !activeNames.includes(name)).map(([name, balance]) => ({
    ref: `advance:${name}`, number: '', supplierPartner: name, supplierCounterparty: '',
    orderPaymentGap: 0, supplierDebt: balance.debt, plannedActiveAmount: 0, unplannedAmount: 0, orderComment: '',
  }));
}
export function supplierOnlyPaymentLabel(plan: { paymentPurpose?: string }) {
  return plan.paymentPurpose === SUPPLIER_ADVANCE ? SUPPLIER_ADVANCE_LABEL : 'В счёт долга поставщику';
}
