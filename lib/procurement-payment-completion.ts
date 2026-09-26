export const COMPLETED_WITHOUT_TOPUP = 'COMPLETED_WITHOUT_TOPUP';
export const isInactivePaymentPlan = (status:string)=>status==='CANCELLED'||status===COMPLETED_WITHOUT_TOPUP;
export type PaymentCompletion = {at:string;actorId:number;reason:string;remainingAmount:number;remainingForeignAmount:number|null;paidAmount:number;paidForeignAmount:number;paymentRefs:string[]};
export function paymentCompletion(value:unknown):PaymentCompletion|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const c=(value as {completion?:PaymentCompletion}).completion;
  return c&&typeof c.at==='string'&&Number.isFinite(Date.parse(c.at))&&Array.isArray(c.paymentRefs)?c:null;
}
export function completionRemainder(plan:{plannedAmount:unknown;foreignAmount?:unknown;paymentMethod:string},e:{state:string;issuedAmount:number;paidAmount:number;paidForeignAmount:number;remainingForeignAmount:number|null;paymentAmountNeedsConfirmation?:boolean}) {
  if(!['PARTIALLY_ISSUED','PARTIALLY_PAID_BY_ONE_C'].includes(e.state)||e.paymentAmountNeedsConfirmation)throw Error('Завершить можно только заявку с подтверждённой частичной оплатой.');
  const paid=e.issuedAmount+e.paidAmount;
  if(![paid,e.paidForeignAmount,Number(plan.plannedAmount)].every(Number.isFinite)||!(paid>0||e.paidForeignAmount>0))throw Error('Не удалось подтвердить оплату.');
  const remaining=Math.max(0,Math.round((Number(plan.plannedAmount)-paid)*100)/100);
  if(plan.paymentMethod==='USDT'&&Number(plan.foreignAmount)>0){
    if(e.remainingForeignAmount==null||!Number.isFinite(e.remainingForeignAmount)||e.remainingForeignAmount<=0)throw Error('Нет подтверждённого остатка USDT.');
    return {remainingAmount:remaining,remainingForeignAmount:e.remainingForeignAmount};
  }
  if(remaining<=0)throw Error('У заявки нет остатка для завершения.');
  return {remainingAmount:remaining,remainingForeignAmount:null};
}
