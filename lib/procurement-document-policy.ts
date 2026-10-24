import { receiptPaymentDate, type ReceiptPaymentPlan } from './procurement-receipt-policy';

export type DocumentPurpose = 'RECEIPT' | 'REQUISITES' | 'QR';
/** Payment instructions depend on the method, not on how the money was funded.
 * ACCOUNTABLE_QR is the existing cash-out workflow, not an uploaded QR image.
 * This controls new UI actions only: historical files must remain accessible. */
export function paymentRequisites(method?: string) {
  switch (method) {
    case 'USDT': return {qr:true, qrLabel:'QR кошелька', fileLabel:'Реквизиты кошелька', hint:'Адрес кошелька и сеть можно указать в комментарии заявки.'};
    case 'CNY': return {qr:true, qrLabel:'QR Alipay', fileLabel:'Другие реквизиты', hint:'QR Alipay или реквизиты получателя.'};
    case 'BANK': return {qr:false, qrLabel:'', fileLabel:'Реквизиты получателя', hint:'Телефон или номер карты, банк и получатель — в комментарии заявки.'};
    default: return null;
  }
}
export function documentPurpose(value: unknown): DocumentPurpose {
  if (!['RECEIPT', 'REQUISITES', 'QR'].includes(String(value))) throw new Error('Выберите назначение файла.');
  return value as DocumentPurpose;
}
export type PaymentDocument = {
  id: string; purpose?: string; replacedById?: string | null; revision?: number;
  qrConfirmedAt?: string | Date | null; qrConfirmationContext?: string | null;
  paymentRefs?: unknown;paymentSnapshots?:unknown;receiptPlanContext?:string|null;createdAt?:string|Date;
};
/** Old API rows were all receipts. New requisites never satisfy receipt tasks. */
export function isPaymentReceipt(file: PaymentDocument) {
  return (!file.purpose || file.purpose === 'RECEIPT') && !file.replacedById;
}
type QrContextPlan = {
  id: string; status: string; plannedDate: string | Date; plannedAmount: unknown;
  paymentMethod: string; supplierPartner: string; supplierCounterparty?: string;
  foreignAmount?: unknown; currency?: string; orderRefs?: unknown; oneCCashEvidence?: unknown;updatedAt?:string|Date;
  documentState?: {pendingRevision:boolean;deferred:boolean;paymentMatchFrom:string|null};
};
export function documentState(meta: unknown) {
  const value = meta as Record<string,unknown> | null;
  return {pendingRevision:!!value?.pendingRevision,deferred:!!value?.fundingDeferral,
    paymentMatchFrom:typeof value?.paymentMatchFrom==='string'?value.paymentMatchFrom:null};
}
/** Stable across source refreshes; invalidated by date/basis/sum/revision/deferral changes. */
export function qrConfirmationContext(plan: QrContextPlan, day: string) {
  const state = plan.documentState ?? documentState(plan.oneCCashEvidence);
  return JSON.stringify([plan.id, day, plan.status,plan.updatedAt instanceof Date?plan.updatedAt.toISOString():plan.updatedAt||null,
    String(plan.plannedDate instanceof Date ? plan.plannedDate.toISOString().slice(0, 10) : plan.plannedDate.slice(0, 10)),
    String(plan.plannedAmount), plan.paymentMethod, plan.supplierPartner, plan.supplierCounterparty || '',
    String(plan.foreignAmount ?? ''), plan.currency || '', plan.orderRefs ?? [],
    state.pendingRevision, state.deferred, state.paymentMatchFrom]);
}
export function qrIsConfirmed(file: PaymentDocument, plan: QrContextPlan, day: string) {
  return file.purpose === 'QR' && !file.replacedById && !!file.qrConfirmedAt && Number.isFinite(new Date(file.qrConfirmedAt).getTime())
    && receiptPaymentDate(new Date(file.qrConfirmedAt).toISOString()) === day
    && file.qrConfirmationContext === qrConfirmationContext(plan, day);
}
export type DocumentPaymentPlan = ReceiptPaymentPlan & {id?:string;supplierPartner?:string;supplierCounterparty?:string;plannedAmount?:unknown;foreignAmount?:unknown;currency?:string;orderRefs?:unknown};
export function receiptPlanContext(plan:DocumentPaymentPlan) {
  return JSON.stringify([plan.id,plan.supplierPartner,plan.supplierCounterparty||'',plan.paymentMethod,plan.currency||'',String(plan.plannedAmount??''),String(plan.foreignAmount??''),plan.orderRefs??[]]);
}
/** Namespaced exact source identities; never match on supplier name or amount. */
export function documentPaymentRefs(plan: DocumentPaymentPlan): string[] {
  return [...new Set([
    ...(plan.evidence?.cashOrders || []).filter(row => row.ref).map(row => `cash:${row.ref}`),
    ...(plan.evidence?.currencyPayments || []).filter(row => row.ref).map(row => `currency:${row.ref}`),
  ])].sort();
}
/** A corrected amount/date on the same source document needs renewed review. */
export function documentPaymentSnapshots(plan:DocumentPaymentPlan,refs:string[]){
  return Object.fromEntries([
    ...(plan.evidence?.cashOrders||[]).filter(r=>r.ref&&refs.includes(`cash:${r.ref}`)).map(r=>[`cash:${r.ref}`,JSON.stringify([r.amount??null,r.date||'',r.number||''])]),
    ...(plan.evidence?.currencyPayments||[]).filter(r=>r.ref&&refs.includes(`currency:${r.ref}`)).map(r=>[`currency:${r.ref}`,JSON.stringify([r.foreignAmount??null,r.date||'',r.number||''])]),
  ]);
}
export function receiptCoverageCount(plan: DocumentPaymentPlan, files: PaymentDocument[]) {
  const receipts = files.filter(isPaymentReceipt);
  const refs = documentPaymentRefs(plan);
  if (!refs.length) return receipts.filter(file => file.paymentRefs == null ||
    Array.isArray(file.paymentRefs) && file.paymentRefs.includes('pending-qr')).length;
  // Preserve legacy semantics until an owner explicitly classifies/links a file.
  if (receipts.some(file => file.paymentRefs == null)) return receipts.length;
  if(receipts.some(file=>pendingQrCoversPayment(plan,file)))return receipts.length;
  const current=documentPaymentSnapshots(plan,refs);
  const covered = new Set(receipts.flatMap(file => Array.isArray(file.paymentRefs) ? file.paymentRefs.filter(ref=>{
    // Legacy exact links retain their semantics. New links pin the source values.
    if(file.paymentSnapshots==null)return true;
    return typeof ref==='string'&&typeof file.paymentSnapshots==='object'&&!Array.isArray(file.paymentSnapshots)
      &&(file.paymentSnapshots as Record<string,unknown>)[ref]===current[ref]&&current[ref]!==undefined;
  }) : []));
  return refs.every(ref => covered.has(ref)) ? receipts.length : 0;
}
/** Only the first, single, fully reconciled QR expense may consume the early
 * receipt for the unchanged request. Partial/multiple/new-basis payments require
 * exact explicit association; no amount-only matching is introduced. */
export function pendingQrCoversPayment(plan:DocumentPaymentPlan,file:PaymentDocument){
  if(plan.paymentMethod!=='ACCOUNTABLE_QR'||!isPaymentReceipt(file)||!Array.isArray(file.paymentRefs)||!file.paymentRefs.includes('pending-qr')||!file.receiptPlanContext||file.receiptPlanContext!==receiptPlanContext(plan))return false;
  if(plan.evidence?.verification==='unavailable'||!['ISSUED_BY_ONE_C','PAID_BY_ONE_C','SMALL_REMAINDER_COMPLETED'].includes(plan.evidence?.state||'')||documentPaymentRefs(plan).length!==1)return false;
  const paidDate=[...(plan.evidence?.cashOrders||[]),...(plan.evidence?.currencyPayments||[])].map(p=>receiptPaymentDate(p.date||'')).filter(Boolean).sort().at(-1);
  const uploaded=file.createdAt?receiptPaymentDate(file.createdAt instanceof Date?file.createdAt.toISOString():file.createdAt):'';
  return !!uploaded&&!!paidDate&&paidDate>=uploaded;
}
