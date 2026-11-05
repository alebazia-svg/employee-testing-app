'use client';
import React from 'react';
import {useProcurementDailyQuotes} from './useProcurementDailyQuotes';
import {ProcurementRequestRate} from './ProcurementRequestRate';
import {dailyRateBindingMatches,type DailyQuote,type DailyRatePlan} from '@/lib/procurement-daily-rate';
import {paymentPreparationDate} from '@/lib/procurement-schedule';
export function ProcurementSavedRate({plan}:{plan:any}){
 const day=paymentPreparationDate(plan);
 const {quotes,state}=useProcurementDailyQuotes(day);
 const quote=state==='ready'?quotes.find(q=>q.currency===plan.paymentMethod)??null:null;
 if(!['USDT','CNY'].includes(plan.paymentMethod))return null;
 const p={...plan,plannedAmount:Number(plan.plannedAmount),foreignAmount:plan.foreignAmount==null?null:Number(plan.foreignAmount),exchangeRate:plan.exchangeRate==null?null:Number(plan.exchangeRate)} as DailyRatePlan;
 const confirmed=dailyRateBindingMatches(p,quote);
 return <div><ProcurementRequestRate method={plan.paymentMethod} rate={plan.exchangeRate} evidence={plan.evidence}/>{confirmed?<p className="text-sm text-emerald-800">Утверждён на день оплаты</p>:null}</div>;
}
