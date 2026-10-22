'use client';
import {History} from 'lucide-react';
import './notification-inbox.css';

export function NotificationInboxSwitch({history,count,onChange,primaryLabel='Новые',historyLabel='Последние 30 дней'}:{history:boolean;count:number;onChange:(history:boolean)=>void;primaryLabel?:string;historyLabel?:string}) {
  return <div className="notification-inbox-switch">
    <strong>{history?historyLabel:primaryLabel}{!history&&count>0?<b>{count}</b>:null}</strong>
    <button type="button" onClick={()=>onChange(!history)}>{history?<>{primaryLabel}{count>0?` · ${count}`:''}</>:<><History size={16}/>История</>}</button>
  </div>;
}
