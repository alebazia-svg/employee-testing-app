import {isFinishedPaymentState} from './procurement-small-remainder';
type Plan={paymentMethod:string;foreignAmount:unknown;evidence?:{state:string;verification?:string;remainingForeignAmount?:number|null;paidForeignAmount?:number;issuedAmount?:number;paidAmount?:number}};
/** Never calculate foreign outstanding from a RUB expense or a stale snapshot. */
export function requisitesShareAmount(plan:Plan):number|null{
 const e=plan.evidence;
 if(!['USDT','CNY'].includes(plan.paymentMethod)||!e||e.verification!=='current'||isFinishedPaymentState(e.state))return null;
 if(e.state==='NO_EVIDENCE'){const amount=Number(plan.foreignAmount);return amount>0&&Number.isFinite(amount)?amount:null;}
 if(e.state==='PARTIALLY_PAID_BY_ONE_C'&&Number(e.remainingForeignAmount)>0&&Number.isFinite(e.remainingForeignAmount))return e.remainingForeignAmount!;
 return null;
}
/** Only transfer instructions. Supplier, request, comments and rates are excluded by contract. */
export function requisitesShareText({amount,currency,text,network,hasFile}:{amount:number;currency:string;text:string;network?:string;hasFile:boolean}){
 if(!['CNY','USDT'].includes(currency)||!Number.isFinite(amount)||amount<=0)throw Error('Укажите сумму перевода.');
 const recipient=hasFile?'':text.trim();if(!recipient&&!hasFile)throw Error('Добавьте реквизиты для оплаты.');
 if(currency==='USDT'&&recipient&&!network?.trim())throw Error('Укажите сеть кошелька.');
 return [`${amount.toLocaleString('ru-RU',{maximumFractionDigits:8})} ${currency}`,currency==='USDT'&&recipient?network!.trim():'',recipient].filter(Boolean).join('\n');
}
