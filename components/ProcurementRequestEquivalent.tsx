import React from 'react';
import {paymentListRemainder} from '@/lib/procurement-list-amount';

type Plan={plannedAmount:string|number;foreignAmount?:string|number|null;paymentMethod:string;exchangeRate?:string|number|null;
  evidence?:{state:string;verification?:string;remainingAmount:number;remainingForeignAmount:number|null;paymentAmountNeedsConfirmation?:boolean}};

export function requestEquivalent(plan:Plan):{amount:number;currency:string}|null {
  if(!['CNY','USDT'].includes(plan.paymentMethod))return null;
  const rate=Number(plan.exchangeRate),rubles=Number(plan.plannedAmount),foreign=Number(plan.foreignAmount);
  if(!Number.isFinite(rate)||rate<=0||!Number.isFinite(rubles)||rubles<=0)return null;
  const e=plan.evidence;
  // A RUB expense alone cannot establish how much foreign currency remains.
  if(e?.state==='PARTIALLY_ISSUED'||e?.paymentAmountNeedsConfirmation||e?.state==='MISMATCH')return null;
  if(paymentListRemainder(plan)){
    if(e?.verification!=='current'||e.state!=='PARTIALLY_PAID_BY_ONE_C')return null;
    const amount=Number(e.remainingForeignAmount)*rate;
    return Number.isFinite(amount)&&amount>0?{amount,currency:'RUB'}:null;
  }
  if(Number.isFinite(foreign)&&foreign>0)return {amount:rubles,currency:'RUB'};
  const amount=rubles/rate;
  return Number.isFinite(amount)&&amount>0?{amount,currency:plan.paymentMethod}:null;
}

export function ProcurementRequestEquivalent({plan}:{plan:Plan}){
  const value=requestEquivalent(plan);
  if(!value)return null;
  return <p className="payment-request-equivalent text-sm font-medium tabular-nums text-slate-600">≈ {value.amount.toLocaleString('ru-RU',{maximumFractionDigits:value.currency==='RUB'?2:4})} {value.currency==='RUB'?'₽':value.currency}</p>;
}
