/** New requests have exactly one basis. Historical multi-order plans use the edit API. */
export type PaymentChoice={ref:string;number:string;supplierPartner:string;supplierCounterparty:string};
/** Warn only against a verified order balance, not the gross order total. */
export function paymentOrderExcess(order:{ref:string;planningState?:string;unplannedAmount:number;receiptSettlement?:{debtRub:number;requiresAdvanceReview:boolean}},amount:string) {
  const value=Number(amount), balance=order.receiptSettlement;
  if(order.ref.startsWith('debt:')||order.planningState==='needs_review'||!balance||balance.requiresAdvanceReview
    ||!Number.isFinite(balance.debtRub)||balance.debtRub<0||!Number.isFinite(order.unplannedAmount)||order.unplannedAmount<0
    ||!Number.isFinite(value)||value<=0)return 0;
  return Math.max(0,Math.round((value-order.unplannedAmount)*100)/100);
}
export function compatiblePaymentOrders(first:PaymentChoice,next:PaymentChoice){
  return !first.ref.startsWith('debt:')&&!next.ref.startsWith('debt:')
    &&first.supplierPartner===next.supplierPartner&&first.supplierCounterparty===next.supplierCounterparty;
}
export function singlePaymentRequest(orders:PaymentChoice[],draft:{plannedDate:string;plannedAmount:string;paymentMethod:string;foreignAmount:string;exchangeRate:string;fundingSource:string;condition:string}){
  const first=orders[0];
  if(!first||orders.length!==1)throw Error('Выберите один заказ или долг поставщику.');
  const debt=first.ref.startsWith('debt:');
  const common={...draft,fundingSource:null};
  return debt?{url:'/api/procurement/payment-plans/batch',body:{plannedDate:draft.plannedDate,rows:[{...common,basis:'DEBT',supplierPartner:first.supplierPartner,orderRef:''}]}}
    :{url:'/api/procurement/payment-plans',body:{...common,supplierPartner:first.supplierPartner,supplierCounterparty:first.supplierCounterparty,orderRefs:orders.map(o=>o.ref),orderNumbers:orders.map(o=>o.number),currency:['USDT','CNY'].includes(draft.paymentMethod)?draft.paymentMethod:'RUB'}};
}
