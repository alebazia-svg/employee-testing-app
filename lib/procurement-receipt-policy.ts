export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_ADMIN_EVENT = 'procurement.receipt_added';
export const RECEIPT_EMPLOYEE_KIND = 'procurement_receipt_added';
type ReceiptPaymentPlan = {
  evidence?: {
    state?: string;
    verification?: string;
    issuedAmount?: number;
    paidAmount?: number;
    paidForeignAmount?: number;
  };
};

/** Receipt collection is independent of full payment/operational completion.
 * Use already reconciled amounts, never unmatched RKO candidates or approval.
 * Retain last-confirmed proof during a source outage, like the calendar does.
 */
export function hasConfirmedReceiptPayment(plan: ReceiptPaymentPlan) {
  const evidence = plan.evidence;
  if (!evidence || evidence.verification === 'unavailable' || ![
    'PARTIALLY_ISSUED', 'PARTIALLY_PAID_BY_ONE_C',
    'ISSUED_BY_ONE_C', 'PAID_BY_ONE_C', 'SMALL_REMAINDER_COMPLETED',
  ].includes(evidence.state || '')) return false;
  return [evidence.issuedAmount, evidence.paidAmount, evidence.paidForeignAmount]
    .some(amount => typeof amount === 'number' && Number.isFinite(amount) && amount > 0);
}

export function receiptPaymentAmount(plan: ReceiptPaymentPlan & { plannedAmount: string | number }) {
  const positive = (amount?: number) => typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : 0;
  const foreign = positive(plan.evidence?.paidForeignAmount);
  if (foreign) return `${foreign.toLocaleString('ru-RU')} USDT`;
  const rubles = positive(plan.evidence?.issuedAmount) + positive(plan.evidence?.paidAmount);
  return `${Number(rubles || plan.plannedAmount).toLocaleString('ru-RU')} ₽`;
}
// Owner-approved rollout: no retroactive collection of old payment receipts.
export const RECEIPT_TRACKING_FROM = '2026-10-10';
// The owner explicitly requested receipts for these two rollout payments.
// Their legacy plans are marked CASH although the supplier was paid by transfer.
// Keep accounting fields unchanged; this exception affects only the receipt queue.
const ROLLOUT_TRANSFER_CASH_ORDERS = new Set(['00OF-001871', '00OF-001872']);
export function receiptPaymentDate(value:string) {
  const local=/^(\d{2})\.(\d{2})\.(\d{4})/.exec(value);
  if(local) return `${local[3]}-${local[2]}-${local[1]}`;
  if(value.includes('T') && Number.isFinite(Date.parse(value))) return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
  return /^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):'';
}
export function needsReceiptSinceRollout(plan:{paymentMethod?:string;createdAt?:string;evidence?:{cashOrders?:{date?:string;number?:string}[];currencyPayments?:{date?:string}[]}},receiptCount:number) {
  if(receiptCount>0)return false;
  const rolloutTransfer=plan.evidence?.cashOrders?.some(row=>
    receiptPaymentDate(row.date||'')===RECEIPT_TRACKING_FROM &&
    ROLLOUT_TRANSFER_CASH_ORDERS.has(row.number||''));
  if(rolloutTransfer)return true;
  if(!requiresProcurementReceipt(plan.paymentMethod||'')) return false;
  const latest=[...(plan.evidence?.cashOrders||[]),...(plan.evidence?.currencyPayments||[])].map(row=>receiptPaymentDate(row.date||'')).sort().at(-1)||'';
  // No invented "received" flags for legacy history. Missing dates are not proof
  // of a new payment; new plans created since rollout remain in scope.
  return latest ? latest>=RECEIPT_TRACKING_FROM : receiptPaymentDate(plan.createdAt||'')>=RECEIPT_TRACKING_FROM;
}
export function canAccessProcurementReceipts(user: {id:number;role:string;portalArea:string;isActive:boolean}, ownerId:number) {
  return user.isActive && (user.role === 'ADMIN' || user.role === 'EMPLOYEE' && user.portalArea === 'PROCUREMENT' && user.id === ownerId);
}
export function requiresProcurementReceipt(method:string) {
  return ['BANK','ACCOUNTABLE_QR','USDT','CNY'].includes(method);
}
export function receiptFilename(name:string) {
  return name.split(/[\\/]/).at(-1)!.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,180) || 'Чек';
}
export function receiptFormat(bytes:Uint8Array,mime:string) {
  if (!bytes.length || bytes.length > RECEIPT_MAX_BYTES) throw new Error('Размер файла должен быть от 1 байта до 10 МБ.');
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
  const extension = mime==='image/jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 ? 'jpg'
    : mime==='image/png' && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b) ? 'png'
    : mime==='image/webp' && ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP' ? 'webp'
    : mime==='application/pdf' && ascii(0,5)==='%PDF-' ? 'pdf' : null;
  if (!extension) throw new Error('Выберите настоящий JPG, PNG, WebP или PDF.');
  return extension;
}
export function receiptHref(planId:string,admin:boolean) {
  return `${admin?'/admin/procurement':'/procurement'}?receipts=${encodeURIComponent(planId)}`;
}
export function receiptPlanFromFingerprint(fingerprint:string) {
  return /^procurement-receipt:([^:]+):[^:]+$/.exec(fingerprint)?.[1] || null;
}
