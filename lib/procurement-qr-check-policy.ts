import {documentState,paymentRequisites,qrIsConfirmed,type PaymentDocument} from './procurement-document-policy';
import {isFinishedPaymentState} from './procurement-small-remainder';
export const QR_CHECK_KIND='procurement_qr_check';
type Plan=Parameters<typeof qrIsConfirmed>[1];
export function qrCheckPlan(fingerprint:string){return /^procurement-qr-check:([^:]+):manual:\d{4}-\d{2}-\d{2}:[a-f0-9]{64}$/.exec(fingerprint)?.[1]||null;}
export function qrCheckRequestDay(fingerprint:string){return qrCheckPlan(fingerprint)?fingerprint.split(':')[3]:null;}
/** Eligibility for an explicit administrator request, never a timer producer. */
export function needsQrCheck(plan:Plan,files:PaymentDocument[],today:string){
  const state=plan.documentState??documentState(plan.oneCCashEvidence);
  const qr=files.filter(file=>file.purpose==='QR'&&!file.replacedById);
  return plan.status==='APPROVED'&&paymentRequisites(plan.paymentMethod)?.qr===true
    &&!state.pendingRevision&&!state.deferred&&(!qr.length||qr.some(file=>!qrIsConfirmed(file,plan,today)));
}
export function qrPaymentState(state?:string){
  if(isFinishedPaymentState(state))return 'closed' as const;
  return ['NO_EVIDENCE','PARTIALLY_ISSUED','PARTIALLY_PAID_BY_ONE_C'].includes(state||'')?'open' as const:'unknown' as const;
}
