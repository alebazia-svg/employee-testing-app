type Plan={paymentMethod?:string;exchangeRate?:number|string|null;evidence?:{verification?:string;state?:string;actualExchangeRate:number|null;paidForeignAmount:number;paidAmount?:number;issuedAmount?:number;paymentAmountNeedsConfirmation?:boolean}};
function rateValue(plan:Plan){
 if(!['USDT','CNY'].includes(plan.paymentMethod||''))return;
 const e=plan.evidence,actual=Number(e?.actualExchangeRate),saved=Number(plan.exchangeRate);
 const actualKnown=plan.paymentMethod==='USDT'&&e?.verification==='current'&&['PAID_BY_ONE_C','PARTIALLY_PAID_BY_ONE_C'].includes(e.state||'')&&e.paidForeignAmount>0&&!e.paymentAmountNeedsConfirmation&&Number.isFinite(actual)&&actual>0;
 const rate=actualKnown?actual:saved;
 return Number.isFinite(rate)&&rate>0?{rate,actual:actualKnown}:undefined;
}
/** Never use today's quote to describe a historical payment. */
export function procurementHistoryRate(plan:Plan):string|undefined{
 const value=rateValue(plan);if(!value)return;
 return `Курс: ${value.rate.toLocaleString('ru-RU',{maximumFractionDigits:6})} ₽ / ${plan.paymentMethod}`;
}
const number=(n:number)=>n.toLocaleString('ru-RU',{maximumFractionDigits:4});
const rub=(n:number)=>n.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
export function procurementHistoryListMoney(plan:Plan&{plannedAmount:string|number;foreignAmount?:string|number|null},completion?:{paidForeignAmount:number;paidAmount:number}|null){
 const e=plan.evidence,method=plan.paymentMethod,foreign=completion?.paidForeignAmount??e?.paidForeignAmount??0;
 const rubles=completion?.paidAmount??Number((method==='USDT'&&foreign>0?e?.paidAmount:e?.issuedAmount)||e?.paidAmount||e?.issuedAmount||0);
 const value=rateValue(plan),plannedForeign=Number(plan.foreignAmount);
 const usdt=method==='USDT'&&foreign>0&&!e?.paymentAmountNeedsConfirmation;
 // CNY foreign units are saved request terms, not independently observed in RUB RKO.
 // Use them only for fully covered requests. The compact label does not change the source.
 const cny=method==='CNY'&&!completion&&['ISSUED_BY_ONE_C','PAID_BY_ONE_C'].includes(e?.state||'')&&Number.isFinite(plannedForeign)&&plannedForeign>0&&Math.abs(rubles-Number(plan.plannedAmount))<0.01;
 const amount=usdt?number(foreign)+' USDT':cny?number(plannedForeign)+' ¥':rub(rubles);
 const parts:string[]=[];
 if((usdt||cny)&&Number.isFinite(rubles)&&rubles>0)parts.push(rub(rubles));
 if(value)parts.push(`Курс ${number(value.rate)}${!usdt&&!cny?' ₽/'+(method==='CNY'?'¥':'USDT'):''}`);
 return {amount,secondary:parts.join(' · ')||undefined};
}

/** Separate recorded request terms from independently observed payment amounts. */
export function procurementHistorySummary(plan:Plan&{plannedAmount:string|number;foreignAmount?:string|number|null},completion?:{paidForeignAmount:number;paidAmount:number}|null){
 const e=plan.evidence,method=plan.paymentMethod,paidForeign=completion?.paidForeignAmount??e?.paidForeignAmount??0;
 const paidRubles=completion?.paidAmount??Number((method==='USDT'&&paidForeign>0?e?.paidAmount:e?.issuedAmount)||e?.paidAmount||e?.issuedAmount||0);
 const requestForeign=Number(plan.foreignAmount),requestRubles=Number(plan.plannedAmount),fx=['USDT','CNY'].includes(method||'');
 const observedForeign=method==='USDT'&&paidForeign>0&&!e?.paymentAmountNeedsConfirmation;
 const foreign=observedForeign?paidForeign:fx&&Number.isFinite(requestForeign)&&requestForeign>0?requestForeign:null;
 const value=rateValue(plan);
 return {
  foreign:foreign===null?undefined:number(foreign)+' '+(method==='CNY'?'¥':'USDT'),
  foreignNote:foreign!==null&&!observedForeign?'По заявке':undefined,
  rubles:paidRubles>0?rub(paidRubles):fx&&requestRubles>0?'≈ '+rub(requestRubles):undefined,
  rubleNote:!(paidRubles>0)&&fx&&requestRubles>0?'По заявке':undefined,
  rate:value?'Курс '+number(value.rate):undefined,
 };
}
export function procurementListRate(plan:Pick<Plan,'paymentMethod'|'exchangeRate'>){
 const n=Number(plan.exchangeRate);
 return ['CNY','USDT'].includes(plan.paymentMethod||'')&&Number.isFinite(n)&&n>0?'Курс '+number(n):undefined;
}
