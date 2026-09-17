import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';

export type ManualPaymentLink = { ref: string; fingerprint: string };
export function manualPaymentLinks(value: unknown): ManualPaymentLink[] {
  if (!value || typeof value !== 'object' || !('manualRubleLinks' in value) || !Array.isArray(value.manualRubleLinks)) return [];
  return value.manualRubleLinks.filter((row): row is ManualPaymentLink => Boolean(row &&
    typeof row.ref === 'string' && typeof row.fingerprint === 'string'));
}
export function paymentFingerprint(row: SupplierCurrencyPaymentRow) {
  return JSON.stringify([row.ref.toLowerCase(), row.date, row.documentAmount, row.documentCurrency,
    row.baseDocumentRef.toLowerCase(), row.supplier || '', row.counterparty || '', row.contract || '']);
}
export function samePaymentSupplier(plan: { supplierPartner: string; supplierCounterparty: string }, row: SupplierCurrencyPaymentRow) {
  const normalize = (s: string) => s.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
  const names = [plan.supplierPartner, plan.supplierCounterparty].map(normalize).filter(Boolean);
  return [row.supplier || '', row.counterparty || ''].some((name) => names.includes(normalize(name)));
}
