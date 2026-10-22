'use client';
import { useState, type ReactNode } from 'react';
import { paymentCardSummary, type usePayrollPaymentEvidence } from './PayrollPaymentEvidence';
import { payrollPaymentMonth, payrollPaymentDateColumn } from '@/lib/payroll-settlement-month';
import { currentPayrollSettlement, completeSettlementTotal } from '@/lib/payroll-current-export';
const money=(v:number)=>v.toLocaleString('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2});
export default function PayrollLivePayments({enabled,read,names,periodPicker,onEmployee,children}:{enabled:boolean;read:ReturnType<typeof usePayrollPaymentEvidence>;names:string[];periodPicker:ReactNode;onEmployee:(name:string)=>void;children:ReactNode}) {
  const [tab,setTab]=useState('accruals');
  if(!enabled)return <>{children}</>;
  const summaries=names.map(name=>({name,value:paymentCardSummary(read.data,name,names)}));
  const allMatched = summaries.length > 0 && summaries.every(row => row.value !== null);
  const monthlyRemaining = summaries.length ? completeSettlementTotal(summaries.map(row => currentPayrollSettlement(row.name, row.value)), 'remaining') : null;
  const summaryTotal = (key: 'paid' | 'advances' | 'remaining') => summaries.reduce((sum, row) => sum + (row.value ? key === 'remaining' ? row.value.balance.remainingMinor : Math.round((key === 'paid' ? row.value.periodPaid : row.value.advances) * 100) : 0), 0) / 100;
  const period=read.data?.periodKey;
  const paymentMonth=period ? new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),1)).toLocaleDateString('ru-RU',{month:'2-digit',year:'numeric',timeZone:'UTC'}) : '';
  const earningLabel=period ? new Date(`${period}-01T00:00:00Z`).toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).replace(' г.','') : 'выбранный месяц';
  const payoutLabel=period ? new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),1)).toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).replace(' г.','') : 'следующий месяц';
  // Display-only owner-confirmed terms for the reviewed periods; never allocate money from these labels.
  const firstPaymentNote = (name: string) => period === '2026-09' || period === '2026-10'
    ? name === 'Тохов Астемир' ? 'По договорённости'
      : ['Абшаева Зухра', 'Хурзокова Лиана'].includes(name) ? 'По графику — полностью' : null
    : null;
  const paymentRows = summaries.map(({name,value}) => {
    const totals={first:0,second:0,advance:0,other:0};
    const advanceDocuments=new Set<string>();
    for(const doc of value?.documents??[]){
      const part=payrollPaymentMonth(name,doc);
      if(!part || part.period!==period)continue;
      totals.advance+=Math.round(part.advance*100);
      if(part.advance>0)advanceDocuments.add(doc.key.split(':')[0]);
      totals[payrollPaymentDateColumn(period!,doc.documentDate)]+=Math.round(doc.amount*100)-Math.round(part.advance*100);
    }
    if(value?.monthly){
      totals.first=0;totals.second=0;totals.other=0;totals.advance=Math.round(value.monthly.advances*100);
      for(const part of value.monthly.currentDocuments){
        const doc=value.documents.find(d=>d.key===part.key)!;
        if(!doc.advancePeriod)totals[payrollPaymentDateColumn(period!,doc.documentDate)]+=Math.round(part.amount*100);
      }
    }
    return {name,value,totals,advanceDocuments};
  });
  const paymentsComplete=allMatched && summaries.every(row=>!row.value?.unassigned);
  const columnTotal=(key:'first'|'second'|'advance'|'other')=>paymentsComplete
    ? money(paymentRows.reduce((sum,row)=>sum+row.totals[key],0)/100) : 'Нужна сверка';
  return <>
    <div className='admin-section-tabs mb-4' role='tablist' aria-label='Разделы зарплаты'>
      <button data-payroll-read-action type='button' role='tab' aria-selected={tab==='accruals'} className={`admin-section-tab ${tab==='accruals'?'is-active':''}`} onClick={()=>setTab('accruals')}>Начисления</button>
      <button data-payroll-read-action type='button' role='tab' aria-selected={tab==='payments'} className={`admin-section-tab ${tab==='payments'?'is-active':''}`} onClick={()=>setTab('payments')}>Выплаты</button>
    </div>
    <div hidden={tab!=='accruals'}>{children}</div>
    {tab==='payments'&&<section className='payroll-settlement-statement rounded-xl border border-slate-200 bg-white p-4' aria-label='Выплаты сотрудникам'>
      <div className='flex flex-wrap items-center justify-between gap-3'>{periodPicker}<button data-payroll-read-action type='button' onClick={read.retry} className='min-h-11 rounded-lg border px-4 text-sm font-semibold'>Обновить выплаты</button></div>
      <p className='my-2 text-sm text-slate-600'>Зарплата за {earningLabel} · основные выплаты: {payoutLabel}. Авансы включены в выданную сумму.</p>
      {read.error?<p role='alert'>{read.error}</p>:!read.data?<p role='status'>Проверяем выплаты в 1С…</p>:<>
        <div className='payroll-payment-totals mb-3 grid gap-3 sm:grid-cols-3'>{[['Выдано за месяц', 'paid'], ['В том числе авансы', 'advances'], ['Осталось за месяц', 'remaining']].map(([label,key]) => <div key={key} className={`rounded-lg px-3 py-2 ${key === 'remaining' && allMatched && (monthlyRemaining ?? 0) > 0 ? 'bg-amber-50' : key === 'advances' && allMatched && summaryTotal('advances') > 0 ? 'bg-blue-50' : 'bg-slate-50'}`}><p className='text-xs text-slate-600'>{label}</p><strong className={`text-lg ${allMatched && key === 'advances' && summaryTotal('advances') > 0 ? 'text-blue-800' : allMatched && key === 'remaining' && (monthlyRemaining ?? 0) > 0 ? 'text-amber-900' : ''}`}>{key === 'remaining' ? monthlyRemaining === null ? 'Нужна сверка' : money(monthlyRemaining) : allMatched ? money(summaryTotal(key as 'paid' | 'advances')) : 'Нужна сверка'}</strong><p className='text-xs text-slate-500'>{key === 'remaining' ? allMatched ? `Всего за все месяцы: ${money(summaryTotal('remaining'))}` : 'Общий долг пока не подтверждён' : key === 'paid' && summaries.some(row => row.value?.unassigned) ? 'Есть выдачи с неуточнённым месяцем' : key === 'advances' ? 'Уже включены в выданное' : 'По сотрудникам в списке'}</p></div>)}</div>
        <div className='overflow-x-auto'><table className='payroll-settlement-table payroll-live-payments-table text-sm'><thead><tr className='border-b bg-slate-50 text-left'>
          {['Сотрудник',`01.${paymentMonth}`,`16.${paymentMonth}`,'Авансы','В другие дни','Выдано за месяц','Осталось за месяц'].map(x=><th key={x} className='p-3 font-semibold'>{x}</th>)}
        </tr></thead><tbody>{paymentRows.map(({name,value,totals,advanceDocuments})=>{
          const remaining = currentPayrollSettlement(name, value).remaining;
          return <tr key={name} className='border-b border-slate-100 hover:bg-slate-50'><td className='px-3 py-2'><button data-payroll-read-action type='button' className='payroll-employee-open min-h-11 text-left font-semibold' onClick={()=>onEmployee(name)}><span>{name}</span><svg aria-hidden='true' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.6'><path d='m9 5 7 7-7 7'/></svg></button>{Boolean(value?.unassigned)&&<p className='text-xs text-amber-800'>Уточнить месяц выплат: {value!.unassigned}</p>}</td>
            {[totals.first,totals.second,totals.advance,totals.other].map((v,i)=><td key={i} data-label={[`01.${paymentMonth}`,`16.${paymentMonth}`,'Авансы','В другие дни'][i]} className={`p-3 tabular-nums ${i===0 && firstPaymentNote(name) ? 'bg-[#faf3ed]' : i===2 && value && v>0 ? 'bg-blue-50/70' : ''}`}><span className={`whitespace-nowrap ${value && v===0 ? 'text-slate-400' : i===2 && value && v>0 ? 'font-semibold text-blue-800' : ''}`}>{value?money(v/100):'—'}</span>{i===0 && firstPaymentNote(name) && <p className='mt-1 max-w-32 text-xs leading-4 text-[#805b43]'>{firstPaymentNote(name)}</p>}{i===2 && value && v>0 && advanceDocuments.size>0 && <p className='mt-1 text-xs text-blue-700'>Выдач: {advanceDocuments.size}</p>}</td>)}
            <td data-label='Выдано за месяц' className='whitespace-nowrap p-3 font-semibold tabular-nums'>{value?value.periodPaid===0&&value.unassigned?'Не сверено':money(value.periodPaid):'Не сопоставлено'}</td>
            <td data-label='Осталось за месяц' className={`whitespace-nowrap p-3 tabular-nums ${remaining !== null && remaining>0 ? 'bg-amber-50 font-semibold text-amber-900' : remaining===0 ? 'text-slate-500' : 'text-slate-700'}`}>{remaining !== null ? money(remaining) : 'Нужна сверка'}{value && value.balance.remainingMinor>0 && <p className='mt-1 max-w-32 whitespace-normal text-xs font-normal text-slate-600'>Всего за все месяцы: <span className='whitespace-nowrap'>{money(value.balance.remainingMinor/100)}</span></p>}</td>
          </tr>;
        })}</tbody><tfoot className='border-t-2 border-slate-200 bg-slate-50 font-semibold tabular-nums'><tr>
          <th scope='row' className='p-3 text-left'>Итого по списку</th>
          {(['first','second','advance','other'] as const).map((key,i)=><td key={key} data-label={[`01.${paymentMonth}`,`16.${paymentMonth}`,'Авансы','В другие дни'][i]} className='whitespace-nowrap p-3'>{columnTotal(key)}</td>)}
          <td data-label='Выдано за месяц' className='whitespace-nowrap p-3'>{paymentsComplete?money(summaryTotal('paid')):'Нужна сверка'}</td>
          <td data-label='Осталось за месяц' className='whitespace-nowrap p-3'>{monthlyRemaining===null?'Нужна сверка':money(monthlyRemaining)}</td>
        </tr></tfoot></table></div>
        {summaries.some(x=>x.value?.unassigned)&&<p className='mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>У отмеченных сотрудников нужно уточнить месяц отдельных выплат. Нажмите на имя, чтобы посмотреть документы. Эти деньги уже учтены в общем остатке, но не в итоге за выбранный месяц.</p>}
        <p className='mt-3 text-xs text-slate-500'>Остатки на {read.data.balance.asOf.split('-').reverse().join('.')} · обновлено {new Date(read.data.balance.checkedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}</p>
      </>}
    </section>}
  </>;
}
