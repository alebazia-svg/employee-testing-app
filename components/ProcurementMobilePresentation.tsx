'use client';
import React, {createContext,useContext} from 'react';
import {createPortal} from 'react-dom';
import {ChevronRight} from 'lucide-react';
import {EmployeeNoticeIcon} from './workday/EmployeeNoticeIcon';
import type {ReceiptEntryView} from './ProcurementReceipts';

type Presentation={target:HTMLElement|null;openAccountable:()=>void};
export const ProcurementMobilePresentation=createContext<Presentation|null>(null);

/** UI slots only. Existing receipt/delivery components own data and eligibility. */
export function ProcurementMobileAction({title,caption,kind='money',count,onOpen}:{title:string;caption?:string;kind?:'money'|'receipt';count?:number;onOpen:()=>void}){
 const presentation=useContext(ProcurementMobilePresentation);
 if(!presentation?.target)return null;
 return createPortal(<button type='button' className='employee-attention-row' data-action-kind={kind} onClick={onOpen}>
  <EmployeeNoticeIcon kind={kind} animated/>
  <span className='min-w-0 flex-1'><strong>{title}</strong>{caption?<small className='employee-attention-caption'>{caption}</small>:null}</span>
  {count!==undefined?<span className='shrink-0 text-xs font-bold tabular-nums text-stone-500'>{count}</span>:null}
  <ChevronRight size={18} aria-hidden='true'/>
 </button>,presentation.target);
}
export function ProcurementMobileReceiptEntry({pending,ready,loadError,open}:ReceiptEntryView){
 if(loadError)return <ProcurementMobileAction kind='receipt' title='Чеки недоступны' caption='Открыть и повторить загрузку' onOpen={()=>open()}/>;
 if(!ready)return <ProcurementMobileAction kind='receipt' title='Проверяем чеки…' onOpen={()=>open()}/>;
 if(!pending.length)return null;
 return <ProcurementMobileAction kind='receipt' title='Нужны чеки' count={pending.length} onOpen={()=>open()}/>;
}
export function useProcurementMobilePresentation(){return useContext(ProcurementMobilePresentation);}
