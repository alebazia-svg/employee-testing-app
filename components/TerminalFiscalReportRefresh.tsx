'use client';
import { useEffect, useState, useRef } from 'react';
import {hasCompleteFiscalSources,selectFiscalReportRefresh} from '@/lib/terminal-fiscal-report-refresh';
import { RefreshCw } from 'lucide-react';
import { TerminalFiscalDailyReport } from './TerminalFiscalDailyReport';
import type { SavedFiscalReport } from '@/lib/terminal-fiscal-report-cache';
export function TerminalFiscalReportRefresh({day,initial}:{day:string;initial:SavedFiscalReport|null}) {
  const [report,setReport]=useState(initial);
  const current=useRef(initial);
  const [busy,setBusy]=useState(true);
  const [message,setMessage]=useState(initial?'Показана сохранённая сверка. Обновляем…':'Получаем оплаты, чеки и выписку…');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setBusy(true);
    setMessage(current.current?'Показана сохранённая сверка. Обновляем…':'Получаем оплаты, чеки и выписку…');
    fetch(`/api/admin/terminal-fiscal/daily-report?date=${day}`, {cache:'no-store',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw Error();return response.json();})
      .then(({report:fresh,saved}:{report:SavedFiscalReport;saved:boolean})=>{
        if(!active)return;
        const selected=selectFiscalReportRefresh(current.current,fresh);
        if(selected.retained) {
          setMessage(selected.retained==='older'?'Получен более ранний результат. Показана последняя сверка.':'Не все источники ответили. Показана сохранённая сверка.');
        } else {
          current.current=selected.report;
          setReport(selected.report);
          setMessage(!hasCompleteFiscalSources(fresh)?'Получена часть данных.':!saved?'Данные обновлены, но сохранить отчёт не удалось.':selected.report.settlementReused?'Чеки и оплаты обновлены. Показана сохранённая выписка.':!fresh.settlement.complete?'Выписка получена не полностью.':'');
        }
      })
      .catch(()=>{if(active)setMessage(current.current?'Не удалось обновить. Показаны последние полученные данные.':'Не удалось загрузить сверку.');})
      .finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;controller.abort();};
  },[day,initial,retry]);
  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500" role="status" aria-live="polite">
      <span className="flex items-center gap-2">{busy&&<RefreshCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin"/>}{message}</span>
      {!busy&&<button type="button" className="rounded-md border border-stone-200 bg-white px-3 py-1.5 font-medium text-stone-700" onClick={()=>setRetry(n=>n+1)}>Обновить</button>}
    </div>
    {report&&<TerminalFiscalDailyReport report={report}/>}
  </>;
}
