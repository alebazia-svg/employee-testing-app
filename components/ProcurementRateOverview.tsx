'use client';
import React from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import type {DailyCurrency,DailyQuote} from '@/lib/procurement-daily-rate';
import './procurement-rate-overview.css';
export type RateReference={rate:number;day:string;source:string};
export type RateOverviewProps={sourceState?:'loading'|'ready'|'error';references?:Partial<Record<DailyCurrency,RateReference>>;compactMobile?:boolean;today:string;day:string;quotes:DailyQuote[];onDayChange:(day:string)=>void;onOpen:(currency:DailyCurrency)=>void};
const shift=(day:string,delta:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);};
const date=(day:string)=>new Date(day+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'});
export function rateOverviewState(quotes:DailyQuote[],currency:DailyCurrency,day:string){
 const quote=quotes.filter(q=>q.currency===currency&&q.day<=day).sort((a,b)=>b.day.localeCompare(a.day)||b.revision-a.revision)[0]??null;
 return {quote,confirmed:quote?.day===day};
}
/** Shared candidate view. Fixture data belongs to the review route, never this component. */
export function ProcurementRateOverview({compactMobile=false,references={},sourceState='ready',today,day,quotes,onDayChange,onOpen}:RateOverviewProps){
 const title=day===today?'На сегодня':day===shift(today,1)?'На завтра':day===shift(today,2)?'На послезавтра':'На '+date(day);
 return <section className="procurement-rate-overview" data-compact-mobile={compactMobile||undefined} aria-label="Курсы для оплат" aria-busy={sourceState==='loading'||undefined}>
  <header><h2>Курсы</h2>{!compactMobile&&<div className="rate-overview-date"><button type="button" aria-label="Предыдущий день курсов" onClick={()=>onDayChange(shift(day,-1))}><ChevronLeft size={16}/></button><button type="button" className="rate-overview-day" onClick={()=>onDayChange(today)} aria-label={'Курсы на '+date(day)+'. Вернуться к сегодня'}>{title}</button><button type="button" aria-label="Следующий день курсов" onClick={()=>onDayChange(shift(day,1))}><ChevronRight size={16}/></button></div>}</header>
  <div className="rate-overview-values">{(['USDT','CNY'] as const).map(currency=>{const {quote,confirmed}=rateOverviewState(quotes,currency,day);const reference=!quote?references[currency]:undefined;const shownRate=quote?.rate??reference?.rate;return <button type="button" key={currency} className="rate-overview-value" data-currency={currency} data-confirmed={confirmed&&day>=today&&sourceState==='ready'} onClick={()=>onOpen(currency)} aria-label={`${currency}: ${shownRate?shownRate.toLocaleString('ru-RU')+' рублей':'курс не задан'}. ${sourceState==='error'?'Не удалось обновить курс':confirmed?'Утверждён на выбранный день':quote?'Последний утверждённый за '+date(quote.day):reference?reference.source+', от '+date(reference.day):'Нет утверждённого курса'}`}>
   <span className="rate-overview-logo" aria-hidden="true">{currency==='USDT'?'₮':'¥'}</span><span className="rate-overview-amount"><span><b>{currency}</b><strong>{shownRate?shownRate.toLocaleString('ru-RU',{maximumFractionDigits:6})+' ₽':'—'}</strong></span><small>{sourceState==='error'?'Не проверен':confirmed&&day===today?'На сегодня':confirmed&&day>today?'На '+date(day):quote?'От '+date(quote.day):reference?'От '+date(reference.day):'Не задан'}</small></span>
  </button>;})}</div>
 </section>;
}
