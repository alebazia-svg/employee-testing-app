import {paymentPreparationDate} from './procurement-schedule';
import {readPaymentRevision} from './procurement-plan-revision';
import {plannedFxRubles} from './procurement-planned-fx';

export type DailyCurrency = 'USDT'|'CNY';
export type DailyQuote = {id:string;day:string;currency:DailyCurrency;rate:number;revision:number;actor:string;createdAt:string};
export type DailyRateCommand = {day:string;currency:DailyCurrency;rate:number};
export function dailyRateCommand(raw:unknown):DailyRateCommand {
 const b=raw as Record<string,unknown>|null;
 if(!b||!['USDT','CNY'].includes(String(b.currency))||typeof b.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.day)||!Number.isFinite(Date.parse(b.day))||new Date(b.day).toISOString().slice(0,10)!==b.day)throw Error('Проверьте дату и валюту курса.');
 if(typeof b.rate!=='number'||!Number.isFinite(b.rate)||b.rate<=0||b.rate>=1e9||Math.abs(b.rate*1e6-Math.round(b.rate*1e6))>0.001)throw Error('Укажите положительный курс, не более 6 знаков после запятой.');
 return {day:b.day,currency:b.currency as DailyCurrency,rate:b.rate};
}
export type DailyRatePlan={id:string;planCode:string;supplierPartner:string;status:string;plannedDate:string;updatedAt:string;plannedAmount:number;paymentMethod:string;currency:string;foreignAmount:number|null;exchangeRate:number|null;fundingSource?:string|null;oneCCashEvidence?:unknown;oneCIssuedAmount?:number|null;commissionAmount?:number|null};
export type DailyRateEvidence={state:string;issuedAmount:number;paidAmount:number;paidForeignAmount:number;paymentAmountNeedsConfirmation?:boolean;rubleAllocationNeedsReview?:boolean;collection?:unknown;cashOrders?:unknown[];currencyPayments?:unknown[]};
export type DailyRateRow={id:string;code:string;supplier:string;version:string;before:number;after:number;foreignAmount:number|null;oldRate:number|null;reason?:string};
/** Complete, independently read payment evidence only. Unknown never means unpaid. */
export function dailyRateRows(plans:DailyRatePlan[],evidence:Map<string,DailyRateEvidence>,command:DailyRateCommand) {
 const rows:DailyRateRow[]=[],excluded:DailyRateRow[]=[];
 for(const p of [...plans].sort((a,b)=>a.id.localeCompare(b.id))){
  if(!['SUBMITTED','APPROVED'].includes(p.status)||p.paymentMethod!==command.currency||p.currency!==command.currency||paymentPreparationDate(p)!==command.day)continue;
  const e=evidence.get(p.id);
  let reason='';
  if(readPaymentRevision(p.oneCCashEvidence))reason='Изменения на согласовании';
  else if(p.fundingSource==='WALLET')reason='Оплата из остатка USDT';
  else if(!e||!['NO_EVIDENCE'].includes(e.state))reason='Оплата уже начата или требует проверки';
  else if(![e.issuedAmount,e.paidAmount,e.paidForeignAmount,Number(p.oneCIssuedAmount??0)].every(n=>Number.isFinite(n)&&n===0)||e.cashOrders?.length||e.currencyPayments?.length)reason='Есть документы оплаты';
  else if(e.collection||e.paymentAmountNeedsConfirmation||e.rubleAllocationNeedsReview)reason='Выдача назначена или сумма требует проверки';
  const amount=p.foreignAmount===null?p.plannedAmount:plannedFxRubles(p.foreignAmount,command.rate);
  if(amount===null||!Number.isFinite(amount)||amount<=0||!Number.isSafeInteger(Math.round(amount*100)))reason='Проверьте сумму заявки';
  // Existing USDT budgets may include negotiated costs. Never silently discard them.
  if(p.foreignAmount!==null&&p.paymentMethod==='USDT'&&(p.exchangeRate===null||Math.abs((plannedFxRubles(p.foreignAmount,p.exchangeRate)??0)-p.plannedAmount)>0.009))reason='Индивидуальный расчёт заявки';
  const row={id:p.id,code:p.planCode,supplier:p.supplierPartner,version:p.updatedAt,before:p.plannedAmount,after:amount??p.plannedAmount,foreignAmount:p.foreignAmount,oldRate:p.exchangeRate,...(reason?{reason}:{})};
  (reason?excluded:rows).push(row);
 }
 return {rows,excluded};
}
/** A confirmation applies to the exact saved terms; date/rate/amount edits invalidate it. */
export function dailyRateBindingMatches(plan:DailyRatePlan,quote:DailyQuote|null) {
 const binding=(plan.oneCCashEvidence as {dailyRate?:{quoteId?:string;rate?:number;rubles?:number;foreignAmount?:number|null}}|null)?.dailyRate;
 return !!quote&&quote.day===paymentPreparationDate(plan)&&quote.currency===plan.paymentMethod&&binding?.quoteId===quote.id&&Number(plan.exchangeRate)===quote.rate&&binding.rate===quote.rate&&binding.rubles===plan.plannedAmount&&binding.foreignAmount===plan.foreignAmount;
}
