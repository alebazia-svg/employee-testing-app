'use client';
import React from 'react';
import {ProcurementDailyRates} from './ProcurementDailyRates';
import {ProcurementAdminList} from './ProcurementAdminList';
import type {DayPreparation} from '@/lib/procurement-day-preparation';
import './procurement-preparation-list.css';
type Props=React.ComponentProps<typeof ProcurementAdminList>&{dailyRateCurrencies?:Map<string,string[]>;preparation:Map<string,DayPreparation>};
const money=(n:number)=>n.toLocaleString('ru-RU',{maximumFractionDigits:2})+' ₽';
function dayLabel(group:string|undefined,day:string|null|undefined){
 if(!day)return group;
 const date=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 if(group==='Предстоящие')return date;
 return group?.includes(date)?group:group?`${group} · ${date}`:date;
}
export function ProcurementPreparationList({preparation,items,dailyRateCurrencies,...props}:Props){
 const days=new Map<string,typeof items>();
 for(const item of items){const r=preparation.get(item.id);const key=(r?.day||'9999')+'|'+(item.group||'');days.set(key,[...(days.get(key)||[]),item]);}
 const ordered:typeof items=[];
 const totals=new Map<string,{amount:number|null;estimated:boolean;label:string}[]>();
 for(const [,dayItems] of [...days.entries()].sort(([a],[b])=>a.localeCompare(b))){
  const buckets=new Map<string,typeof items>();
  for(const item of dayItems){const r=preparation.get(item.id);const key=r?.route||'unknown';buckets.set(key,[...(buckets.get(key)||[]),item]);}
  for(const [route,rows] of buckets){
   for(const item of rows){const r=preparation.get(item.id);ordered.push({...item,group:dayLabel(item.group,r?.day),prepareAmount:!r||r.amount===null?'Уточняется':r.amount===0?r.reason||'Не требуется':(r.estimated?'≈ ':'')+money(r.amount)});}

  }
 }
 // Totals use the complete projection, never just the currently selected tab.
 const dayRows=new Map<string,typeof items>();
 for(const item of ordered){const day=preparation.get(item.id)?.day;if(day)dayRows.set(day,[...(dayRows.get(day)||[]),item]);}
 for(const [day,visible] of dayRows){
  for(const route of ['cash','bank','wallet','unknown'] as const){
   const all=[...preparation.values()].filter(r=>r.day===day&&r.route===route&&r.amount!==0);
   if(!all.length)continue;
   const matching=visible.filter(p=>preparation.get(p.id)?.route===route);
   const hidden=all.some(r=>!visible.some(p=>p.id===r.id));
   if(all.length<2&&!hidden)continue;
   const anchor=(matching.at(-1)||visible.at(-1))!.id;
   const label=(route==='cash'?'Наличными':route==='bank'?'Переводом':route==='wallet'?'Из кассы USDT':'Источник уточняется')+' за день · все заявки';
   const known=all.every(r=>r.amount!==null);
   const total={label,amount:known?all.reduce((n,r)=>n+Math.round(r.amount!*100),0)/100:null,estimated:all.some(r=>r.estimated)};
   totals.set(anchor,[...(totals.get(anchor)||[]),total]);
  }
 }
 return <ProcurementAdminList {...props} groupedDates showPreparation items={ordered} renderGroupAccessory={group=>{const item=ordered.find(p=>p.group===group);const day=item?preparation.get(item.id)?.day:null;const currencies=day?dailyRateCurrencies?.get(day):undefined;return day&&currencies?.length?<ProcurementDailyRates day={day} admin currencies={currencies}/>:null;}} renderAfterItem={id=>{
  return !props.searchQuery?.trim()?totals.get(id)?.map(total=><div key={total.label} className="procurement-prepare-total"><strong>{total.label}</strong><strong>{total.amount===null?'Уточняется':(total.estimated?'≈ ':'')+money(total.amount)}</strong></div>):null;
 }}/>;
}
