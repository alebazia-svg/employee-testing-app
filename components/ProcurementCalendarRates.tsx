'use client';
import React,{useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {DailyRateDialog} from './ProcurementDailyRates';
import {ProcurementRateOverview,rateOverviewState} from './ProcurementRateOverview';
import {useProcurementDailyQuotes} from './useProcurementDailyQuotes';
import {procurementRateReferences,type RateReference} from '@/lib/procurement-rate-references';
import type {DailyCurrency} from '@/lib/procurement-daily-rate';
import './procurement-calendar-tools.css';
type Props={today:string;admin?:boolean;plans:Parameters<typeof procurementRateReferences>[0];references?:Partial<Record<DailyCurrency,{rate:number|null;conversionAt?:string;sourceLabel?:string}>>};
export function ProcurementCalendarRates({today,admin=false,plans,references}:Props){
 const router=useRouter(),{quotes,state}=useProcurementDailyQuotes(today,true),[selected,select]=useState<DailyCurrency|null>(null);
 const fallback=useMemo(()=>{
  const initial:Partial<Record<DailyCurrency,RateReference>>={};
  for(const currency of ['USDT','CNY'] as const){const r=references?.[currency];if(r?.rate&&r.rate>0&&r.conversionAt&&r.conversionAt.slice(0,10)<=today)initial[currency]={rate:r.rate,day:r.conversionAt.slice(0,10),source:r.sourceLabel||'Последний курс из 1С'};}
  return procurementRateReferences(plans,today,initial);
 },[plans,references,today]);
 const active=selected?rateOverviewState(quotes,selected,today):null;
 return <><ProcurementRateOverview compactMobile today={today} day={today} quotes={quotes} references={fallback} sourceState={state} onDayChange={()=>{}} onOpen={select}/>
  {selected?<DailyRateDialog key={selected+today+(active?.quote?.id||'')} day={today} currency={selected} quote={active?.confirmed?active.quote:null} reference={active?.quote?.rate??fallback[selected]?.rate} admin={admin&&state==='ready'} close={()=>select(null)} onSaved={()=>{select(null);window.dispatchEvent(new Event('procurement-rates-changed'));router.refresh();}}/>:null}</>;
}
