import React from 'react';
import {TerminalFiscalTransactionTable} from './TerminalFiscalTransactionTable';
import type {FiscalSettlement} from '@/lib/terminal-fiscal-settlement';
import type { DailyFiscalReport } from '@/lib/terminal-fiscal-daily-report';
const money=(n:number)=>`${(n/100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})} ₽`;
const time=(s:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
export function TerminalFiscalDailyReport({report}:{report:DailyFiscalReport & {configurationComplete?:boolean;updatedAt?:string;settlement?:FiscalSettlement}}) {
 const settlement=report.settlement;
 const states:Record<string,string>={incomplete:'Данные неполные',difference:'Есть разница',review:'Суммы равны · есть проверки',balanced:'Суммы равны'};
 const figures=(r:DailyFiscalReport['total'],total=false)=><tr key={r.key} className={total?'border-t-2 border-stone-200 bg-stone-50 font-semibold':'border-t border-stone-100'}>
  <th scope='row' className='px-4 py-3 text-left font-medium'>{r.name}</th>
  <td className='px-4 py-3 text-right tabular-nums whitespace-nowrap'>{money(r.bankKopecks)}{!report.complete.bank?' *':''}</td>
  <td className='px-4 py-3 text-right tabular-nums whitespace-nowrap'>{money(r.oneCKopecks)}{!report.complete.oneC?' *':''}</td>
  <td className='px-4 py-3 text-right tabular-nums whitespace-nowrap'>{money(r.ofdKopecks)}{!report.complete.ofd?' *':''}</td>
  <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${r.bankDifferenceKopecks?'font-semibold text-amber-800':'text-stone-500'}`}>{report.complete.bank&&report.complete.oneC?money(r.bankDifferenceKopecks):'—'}</td>
  <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${r.fiscalDifferenceKopecks?'font-semibold text-amber-800':'text-stone-500'}`}>{report.complete.oneC&&report.complete.ofd?money(r.fiscalDifferenceKopecks):'—'}</td>
 </tr>;
 return <><section aria-label='Дневная сверка оплат' className='mb-5 overflow-hidden rounded-xl border border-stone-200 bg-white'>
  <div className='flex flex-wrap items-start justify-between gap-3 px-5 py-4'><div><h2 className='text-lg font-semibold'>Сверка за день</h2><p className='mt-1 text-sm text-stone-500'>Безналичные оплаты за вычетом возвратов</p></div><span className={`rounded-md px-3 py-1 text-xs font-semibold ${report.status==='balanced'?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800'}`}>{states[report.status]}</span></div>
  <div className='overflow-x-auto'><table className='w-full min-w-[780px] text-sm'><thead className='border-t border-stone-200 bg-stone-50 text-xs text-stone-500'><tr>{['Менеджер','Терминалы','Документы 1С','ОФД','Терминалы − 1С','1С − ОФД'].map((h,i)=><th key={h} scope='col' className={`px-4 py-3 font-medium ${i?'text-right':'text-left'}`}>{h}</th>)}</tr></thead><tbody>{report.rows.map(r=>figures(r))}{figures(report.total,true)}</tbody></table></div>
  <div className='space-y-2 border-t border-stone-100 px-5 py-3 text-xs text-stone-500'>
   {report.configurationComplete===false&&<p>Для части рабочих мест нет однозначной привязки терминала и ККМ.</p>}
   {report.updatedAt&&<p>Обновлено {time(report.updatedAt)} МСК</p>}
   {report.status==='incomplete'&&<p>* Получена только часть данных. Разница пока не рассчитывается.</p>}
   {report.unlinkedAcquiringCount>0&&<p>Эквайринговые документы без однозначной связи: {report.unlinkedAcquiringCount} · {money(report.unlinkedAcquiringKopecks)}. Не добавлены повторно к чекам 1С.</p>}
   {report.unresolved>0&&<p>Оплат без однозначного сопоставления: {report.unresolved}. Равенство итогов их не закрывает.</p>}
   {report.lateLinkedKopecks!==0&&<p>Оплаты с документом другого дня: {money(report.lateLinkedKopecks)}. В таблице каждый источник показан по дате своей операции.</p>}
   <p>Менеджер — по документу 1С. Состав продаж показан ниже.</p>
  </div>
  {settlement&&<div className='border-t border-stone-200 px-5 py-4'><div className='flex flex-wrap items-center justify-between gap-2'><h3 className='text-sm font-semibold'>Выписка и чеки 1С</h3><span className={`rounded-md px-2 py-1 text-xs font-medium ${settlement.status==='amount_equal'?'bg-emerald-50 text-emerald-800':settlement.status==='incomplete'?'bg-stone-100 text-stone-600':'bg-amber-50 text-amber-900'}`}>{settlement.status==='amount_equal'?'Суммы равны':settlement.status==='incomplete'?'Данные неполные':settlement.selected.length?'Есть разница':'Нужна сверка'}</span></div><dl className='mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3'><div><dt className='text-xs text-stone-500'>Чеки 1С · безналичными</dt><dd className='mt-1 font-semibold tabular-nums'>{money(settlement.fiscalKopecks)}</dd></div><div><dt className='text-xs text-stone-500'>Зачисления по выписке</dt><dd className='mt-1 font-semibold tabular-nums'>{money(settlement.settlementKopecks)}{!settlement.complete?' *':''}</dd></div><div><dt className='text-xs text-stone-500'>Разница</dt><dd className='mt-1 font-semibold tabular-nums'>{settlement.complete&&settlement.selected.length?money(settlement.differenceKopecks):'—'}</dd></div></dl><details className='mt-3 text-xs'><summary className='cursor-pointer font-medium text-stone-600'>Состав зачислений</summary><div className='mt-2 space-y-2 text-stone-500'><p>Карты — документ следующего дня; СБП — дня продажи. Предварительная сверка итогов, без подтверждения отдельных оплат.</p>{settlement.warnings.map(w=><p key={w} className='text-amber-800'>{w}</p>)}<table className='w-full'><thead><tr><th className='py-2 text-left font-medium'>Зачислено</th><th className='text-left font-medium'>Документ выписки</th><th className='text-right font-medium'>Сумма</th></tr></thead><tbody>{settlement.selected.map(c=><tr key={`${c.day}-${c.number}`} className='border-t border-stone-100'><td className='py-2'>{c.day.split('-').reverse().join('.')}</td><td>№ {c.number} · {c.kind==='sbp'?'СБП':'Эквайринг'} · {c.documentDay.split('-').reverse().join('.')}</td><td className='text-right tabular-nums'>{money(c.amountKopecks)}</td></tr>)}</tbody></table></div></details></div>}
 </section><TerminalFiscalTransactionTable rows={report.transactions}/></>;
}
