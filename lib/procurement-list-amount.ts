type Plan={plannedAmount:string|number;foreignAmount?:string|number|null;paymentMethod:string;evidence?:{state:string;remainingAmount:number;remainingForeignAmount:number|null;paymentAmountNeedsConfirmation?:boolean}};
/** Never reconstruct actual USDT paid from a RUB expense. */
export function paymentListRemainder(plan:Plan):string|null {
 const e=plan.evidence;
 if(!e||e.paymentAmountNeedsConfirmation||!['PARTIALLY_ISSUED','PARTIALLY_PAID_BY_ONE_C'].includes(e.state))return null;
 if(['USDT','CNY'].includes(plan.paymentMethod))return e.remainingForeignAmount!==null&&Number.isFinite(e.remainingForeignAmount)&&e.remainingForeignAmount>0?`Доплатить ${e.remainingForeignAmount.toLocaleString('ru-RU',{maximumFractionDigits:4})} ${plan.paymentMethod}`:null;
 return Number.isFinite(e.remainingAmount)&&e.remainingAmount>0?`Доплатить ${e.remainingAmount.toLocaleString('ru-RU')} ₽`:null;
}
