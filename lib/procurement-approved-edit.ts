import { validatePaymentPlan, type PaymentMethod } from './procurement-payment-control';
import { preservePaymentReview } from './procurement-buyer-comment';
import type { RevisionData } from './procurement-plan-revision';

const editable = ['plannedDate','plannedAmount','foreignAmount','exchangeRate','paymentMethod','condition'] as const;
export function approvedEditData(plan:Record<string,any>,payload:unknown,today:string) {
  const body=payload as Record<string,unknown>|null;
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>![...editable,'reason','version'].includes(k)))throw Error('Проверьте данные изменения.');
  if(typeof body.version!=='string'||body.version!==new Date(plan.updatedAt).toISOString())throw Error('Заявка изменилась. Обновите страницу.');
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(reason.length<3||reason.length>500)throw Error('Укажите причину изменения: от 3 до 500 символов.');
  const before:RevisionData={
    paymentPurpose:plan.paymentPurpose||'GOODS',fundingSource:plan.fundingSource??null,
    supplierPartner:plan.supplierPartner,supplierCounterparty:plan.supplierCounterparty,
    orderRefs:Array.isArray(plan.orderRefs)?[...plan.orderRefs]:[],orderNumbers:Array.isArray(plan.orderNumbers)?[...plan.orderNumbers]:[],
    plannedDate:new Date(plan.plannedDate).toISOString().slice(0,10),plannedAmount:Number(plan.plannedAmount),
    foreignAmount:plan.foreignAmount==null?null:Number(plan.foreignAmount),exchangeRate:plan.exchangeRate==null?null:Number(plan.exchangeRate),
    paymentMethod:plan.paymentMethod as PaymentMethod,currency:plan.currency,condition:plan.condition,
    commissionAmount:plan.commissionAmount==null?null:Number(plan.commissionAmount),exchangerName:plan.exchangerName,supplierConfirmation:plan.supplierConfirmation,
  };
  let data={...before};
  if(body.plannedDate!==undefined){
    const d=String(body.plannedDate);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d||(d!==before.plannedDate&&d<today))throw Error('Выберите сегодняшнюю или будущую дату.');
    data.plannedDate=d;
  }
  if(body.condition!==undefined){if(typeof body.condition!=='string'||body.condition.length>5000)throw Error('Проверьте комментарий.');data.condition=preservePaymentReview(before.condition,body.condition);}
  const financialChanged=['plannedAmount','foreignAmount','exchangeRate','paymentMethod'].some(k=>body[k]!==undefined&&(k==='paymentMethod'?body[k]!==plan[k]:Number(body[k]||0)!==Number(plan[k]||0)));
  if(financialChanged){
    const method=String(body.paymentMethod??before.paymentMethod);
    const checked=validatePaymentPlan({...data,...Object.fromEntries(editable.filter(k=>k!=='condition'&&k!=='plannedDate'&&body[k]!==undefined).map(k=>[k,body[k]])),
      fundingSource:null,currency:method==='USDT'?'USDT':method==='CNY'?'CNY':'RUB',
      ...(!['USDT','CNY'].includes(method)?{foreignAmount:null,exchangeRate:null}:{})},!before.orderRefs.length);
    if(!checked.ok||!checked.data.plannedAmount)throw Error(checked.errors.join(' ')||'Укажите сумму оплаты.');
    data={...checked.data,condition:data.condition};
  }
  // Date/comment-only edits preserve the exact approved RUB estimate and FX terms.
  return {data,reason,financialChanged};
}
