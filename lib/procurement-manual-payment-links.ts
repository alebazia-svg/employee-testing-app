import type { SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';
import {PROCUREMENT_CARGO} from './procurement-cargo';

export type ManualPaymentLink = { ref: string; fingerprint: string };
/** RUB documents fund the budget even when the supplier receives USDT.
 * A USDT document is only admissible for a USDT request. */
export function manualPaymentCurrencyMatches(method: string, currency: string) {
  return ['RUB', 'РУБ'].includes(currency)
    ? ['CASH', 'BANK', 'ACCOUNTABLE_QR', 'CNY', 'USDT'].includes(method)
    : currency === 'USDT' && method === 'USDT';
}
export function manualPaymentLinks(value: unknown): ManualPaymentLink[] {
  if (!value || typeof value !== 'object' || !('manualRubleLinks' in value) || !Array.isArray(value.manualRubleLinks)) return [];
  return value.manualRubleLinks.filter((row): row is ManualPaymentLink => Boolean(row &&
    typeof row.ref === 'string' && typeof row.fingerprint === 'string'));
}
export function paymentFingerprint(row: SupplierCurrencyPaymentRow) {
  const fields: unknown[] = [row.ref.toLowerCase(), row.date, row.documentAmount, row.documentCurrency,
    row.baseDocumentRef.toLowerCase(), row.supplier || '', row.counterparty || '', row.contract || ''];
  // Preserve existing links byte-for-byte; a new register-based link must be
  // revalidated if its native document version or contract identity changes.
  if (row.registerContractBasis) fields.push(row.registerContractBasis);
  return JSON.stringify(fields);
}
export function samePaymentSupplier(plan: { supplierPartner: string; supplierCounterparty: string;paymentPurpose?:string }, row: SupplierCurrencyPaymentRow) {
  const normalize = (s: string) => s.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
  if(plan.paymentPurpose==='DELIVERY'){
    if(normalize(row.supplier||'')!==normalize(PROCUREMENT_CARGO.supplierPartner)||normalize(row.counterparty||'')!==normalize(PROCUREMENT_CARGO.supplierCounterparty))return false;
    const register=row.registerContractBasis?.contracts;
    const contractConfirmed=register?.length===1&&register[0].ref===PROCUREMENT_CARGO.contractRef;
    // Existing register-basis endpoint is RUB-only. A USDT RKO needs an explicit
    // native contract; no empty header is inferred from a supplier's balance.
    if(!contractConfirmed&&!(row.documentCurrency==='USDT'&&row.contract?.trim()===PROCUREMENT_CARGO.contractName))return false;
  }
  const names = [plan.supplierPartner, plan.supplierCounterparty].map(normalize).filter(Boolean);
  return [row.supplier || '', row.counterparty || ''].some((name) => names.includes(normalize(name)));
}
