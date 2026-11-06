import type {DailyCurrency} from './procurement-daily-rate';
export type RateReference={rate:number;day:string;source:string};
type Plan={paymentMethod:string;exchangeRate?:string|number|null;evidence?:{verification?:string;state?:string;issuedAmount?:number;paidAmount?:number;paidForeignAmount?:number;actualExchangeRate?:number|null;paymentAmountNeedsConfirmation?:boolean;cashOrders?:{date?:string}[];currencyPayments?:{date?:string}[]}};
const dayOf=(date:string)=>/^\d{4}-\d{2}-\d{2}/.test(date)?date.slice(0,10):/^\d{2}\.\d{2}\.\d{4}/.test(date)?date.slice(6,10)+'-'+date.slice(3,5)+'-'+date.slice(0,2):'';
/** Display reference only; never promotes request terms to an approved daily quote. */
export function procurementRateReferences(plans:Plan[],today:string,fallbacks:Partial<Record<DailyCurrency,RateReference>>={}){
 const result={...fallbacks};
 for(const currency of ['USDT','CNY'] as const){
  const rows=plans.filter(p=>p.paymentMethod===currency&&p.evidence?.verification==='current'&&['PAID_BY_ONE_C','ISSUED_BY_ONE_C','SMALL_REMAINDER_COMPLETED'].includes(p.evidence.state||'')).flatMap(p=>{
   const e=p.evidence!,actual=currency==='USDT'&&!e.paymentAmountNeedsConfirmation&&Number(e.paidForeignAmount)>0&&Number(e.actualExchangeRate)>0;
   const rate=Number(actual?e.actualExchangeRate:p.exchangeRate);
   const day=[...(e.cashOrders||[]),...(e.currencyPayments||[])].map(r=>dayOf(r.date||'')).filter(d=>d&&d<=today).sort().at(-1);
   return Number.isFinite(rate)&&rate>0&&day?[{rate,day,source:actual?'Курс подтверждённой оплаты':'Сохранённый курс оплаченных заявок'}]:[];
  }).sort((a,b)=>b.day.localeCompare(a.day));
  const latest=rows[0];
  if(latest&&new Set(rows.filter(r=>r.day===latest.day).map(r=>r.rate)).size===1&&(!result[currency]||latest.day>result[currency]!.day))result[currency]=latest;
 }
 return result;
}
