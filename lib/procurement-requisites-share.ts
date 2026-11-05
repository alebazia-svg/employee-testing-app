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
/** Plain decimal for copying into a transfer amount field: no grouping or scientific notation. */
export function transferAmountText(amount:number){
 if(!Number.isFinite(amount)||amount<=0)throw Error('Укажите сумму перевода.');
 const value=amount.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:8});
 if(Number(value)<=0)throw Error('Укажите сумму не меньше 0.00000001.');
 return value;
}
/** Only transfer instructions. Supplier, request, comments and rates are excluded by contract. */
export function requisitesShareText({amount,currency,text,network,hasFile}:{amount:number;currency:string;text:string;network?:string;hasFile:boolean}){
 if(!['CNY','USDT'].includes(currency)||!Number.isFinite(amount)||amount<=0)throw Error('Укажите сумму перевода.');
 const recipient=hasFile?'':text.trim();if(!recipient&&!hasFile)throw Error('Добавьте реквизиты для оплаты.');
 if(currency==='USDT'&&recipient&&!network?.trim())throw Error('Укажите сеть кошелька.');
 const plain=transferAmountText(amount);
 const printable=hasFile?Number(plain).toLocaleString('ru-RU',{maximumFractionDigits:8}):plain;
 return [`${printable} ${currency}`,currency==='USDT'&&recipient?network!.trim():'',recipient].filter(Boolean).join('\n');
}
