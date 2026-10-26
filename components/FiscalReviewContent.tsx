'use client';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type {FiscalReviewData} from '@/lib/fiscal-review-data';
import {FiscalAdminApproval} from './FiscalAdminApproval';
import {FiscalTestPaymentButton} from './FiscalTestPaymentButton';
import {FiscalDayReconciledButton} from './FiscalDayReconciledButton';
import {FiscalArchiveUnresolvedButton} from './FiscalArchiveUnresolvedButton';
import {TerminalFiscalChainEvidence} from './TerminalFiscalChainEvidence';
import {TerminalFiscalReviewConversation} from './TerminalFiscalReviewConversation';
export function FiscalReviewContent({detail:d,onChanged,onBusyChange}:{detail:FiscalReviewData;onChanged?:()=>void;onBusyChange?:(busy:boolean)=>void}) {
 const explanations:Record<string,[string,string]>={
  ONE_C_CANDIDATE_PENDING:['Чек 1С пока не найден','Оплата есть, связанный чек пока не найден. Проверьте продажу перед отправкой сотруднику.'],
  ONE_C_CANDIDATE_NOT_FOUND:['Чек в 1С не найден','В загруженных документах не найдена связь с оплатой. Это основание проверить продажу, а не требование пробить чек повторно.'],
  OFD_RECEIPT_PENDING:['Ожидается чек ОФД','Документ 1С найден. Фискальное подтверждение ещё ожидается.'],
  OFD_RECEIPT_NOT_FOUND:['Нет подтверждения ОФД','Документ 1С найден, но соответствующий фискальный чек не найден. Проверьте фискализацию.'],
  OFD_TOTAL_AMOUNT_MISMATCH:['Различаются суммы','Сумма чека ОФД отличается от документа 1С. Проверьте оба документа.'],
  OFD_ELECTRONIC_AMOUNT_MISMATCH:['Различается оплата картой','Безналичная часть чека ОФД отличается от документа 1С.'],
  OFD_ITEMS_MISMATCH:['Различаются товары','В связанных документах отличается состав товаров.'],
 };
 const unknown=!d.resolved&&d.sources.bank===null&&d.sources.oneC===null;
 const explanation=unknown?['Нужна повторная сверка','Сохранённого результата нет. Проверка остаётся у вас до обновления данных.']:!d.resolved?explanations[d.reasonCode]:undefined;
 const waiting=!d.resolved&&(d.reasonCode.startsWith('SOURCE_')||!d.sources.bank||!d.sources.oneC||d.reasonCode==='OFD_RECEIPT_PENDING');
 const missingCheck=!d.resolved&&!waiting&&!d.hasOneCCheck&&['ONE_C_CANDIDATE_PENDING','ONE_C_CANDIDATE_NOT_FOUND'].includes(d.reasonCode);
 const status=d.resolved?d.view.statusLabel:waiting?'Ожидаются данные':d.pendingAdmin?'Нужно проверить продажу':'Проверка активна';
 return <div className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${d.archivedUnresolved?'bg-slate-100 text-slate-700':d.resolved?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-900'}`}>{d.resolved?<CheckCircle2 size={14}/>:<AlertCircle size={14}/>} {status}</span>
   <span className="text-xs text-stone-500">{d.at} МСК</span>
  </div>
  {missingCheck ? <div>
   <h3 className="text-2xl font-semibold tracking-tight text-stone-900">Оплата {d.amount} без найденного чека 1С</h3>
   <p className="mt-3 text-sm leading-relaxed text-stone-600">Терминал принял оплату. При последней сверке соответствующий чек в 1С не найден.</p>
  </div> : <div><p className="text-3xl font-semibold tracking-tight text-stone-900">{d.amount}</p><h3 className="mt-2 text-lg font-semibold text-stone-800">{explanation?.[0]||(d.simpleCheck?'Чек в 1С не найден':d.view.title)}</h3><p className="mt-2 text-sm leading-relaxed text-stone-600">{explanation?.[1]||d.message}</p></div>}
  <dl className="grid gap-x-5 gap-y-4 border-y border-stone-100 py-4 text-sm sm:grid-cols-2">
   <div className={missingCheck?'sm:col-span-2':undefined}><dt className="text-xs text-stone-500">Рабочее место</dt><dd className="mt-1 font-medium text-stone-800">{d.workstation||'Не определено'}</dd>{missingCheck&&d.responsible&&<p className="mt-2 text-xs leading-relaxed text-stone-500">Ответственный определён по рабочему месту и отметке смены. Ошибка сотрудника ещё не подтверждена.</p>}</div>
   {!missingCheck&&<div><dt className="text-xs text-stone-500">Эквайринговый терминал</dt><dd className="mt-1 font-medium text-stone-800">{d.terminal||'Не привязан'}</dd></div>}
   {(!missingCheck||!d.responsible)&&<div className="sm:col-span-2"><dt className="text-xs text-stone-500">{d.manager?'Кассир в 1С':d.responsible?'Ответственный по смене':d.googleHint?'По составу смены':'Менеджер'}</dt><dd className="mt-1 font-medium text-stone-800">{d.manager||d.responsible||d.googleHint?.name||'Пока не определён'}</dd>{!d.manager&&d.responsible&&<p className="mt-1 text-xs text-stone-500">По рабочему месту и отметке в приложении · не подтверждено чеком 1С</p>}{!d.manager&&!d.responsible&&d.googleHint&&<p className="mt-1 text-xs text-stone-500">{d.googleHint.basis} · не подтверждено чеком 1С</p>}</div>}
  </dl>
  {missingCheck&&<section aria-label="Что сделать" className="space-y-2">
   <h4 className="text-sm font-semibold text-stone-800">Что сделать</h4>
   <p className="text-sm leading-relaxed text-stone-600">Проверьте продажу в 1С. Если причина неясна — передайте менеджеру для уточнения.</p>
   <p className="text-xs leading-relaxed text-stone-500">Повторно пробивать чек до проверки не нужно.</p>
  </section>}
  {d.canApprove&&!waiting&&<FiscalAdminApproval reviewId={d.id} recipients={d.proposed.users} primary={d.proposed.primary} confidence={d.proposed.confidence} compact={missingCheck} onDone={onChanged} onBusyChange={onBusyChange}/>}
  <details className="border-t border-stone-100 pt-4">
   <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-stone-600">Подробности сверки</summary>
   <div className="mt-3 space-y-3">
   {missingCheck&&<p className="text-sm text-stone-600">Эквайринговый терминал: {d.terminal||'Не привязан'}</p>}
  <section className="rounded-lg border border-stone-200 bg-stone-50/60 px-4 py-3" aria-label="Основание проверки">
   <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-stone-500"><span>Последняя сверка</span><span>{d.checkedAt} МСК</span></div>
   <dl className="space-y-2 text-sm">{[['Оплаты',d.sources.bank===null?'Нет результата сверки':d.sources.bank?'Загружены':'Данные неполные'],['Документы 1С',d.sources.oneC===null?'Нет результата сверки':!d.sources.oneC?'Данные неполные':d.hasOneCCheck?'Связанный документ найден':'Связанный документ не найден'],['ОФД',d.sources.ofd===null?'Нет результата сверки':d.sources.ofd?'Данные загружены':'Данные неполные']].map(([label,value])=><div key={label} className="flex justify-between gap-4"><dt className="text-stone-500">{label}</dt><dd className="text-right text-stone-800">{value}</dd></div>)}</dl>
  </section>

  {d.rawType&&<p className="text-xs text-stone-500">Тип операции банка: {d.rawType}</p>}
   </div>
  </details>
  {d.chain&&<TerminalFiscalChainEvidence chain={d.chain}/>}
  {d.chainUnavailable&&<p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-600">Состав цепочки пока не подтверждён. Проверка остаётся открытой.</p>}
  {(d.canReconcileDay||d.canArchiveUnresolved||d.canTest)&&<details className="border-t border-stone-100 pt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-stone-600">Другие действия</summary><div className="mt-3 space-y-4">
  {d.canReconcileDay&&<p className="text-xs leading-relaxed text-stone-500">Если вы сверили итог дня вручную, можно закрыть проверку. Она больше не появится, даже если связь с чеком не найдена.</p>}
  {d.canReconcileDay&&<FiscalDayReconciledButton reviewId={d.id} onDone={onChanged} onBusyChange={onBusyChange}/>}
  {d.canArchiveUnresolved&&<p className="text-xs leading-relaxed text-stone-500">Архив убирает проверку из активных, сохраняя её как неисправленную.</p>}
  {d.canArchiveUnresolved&&<FiscalArchiveUnresolvedButton reviewId={d.id} onDone={onChanged} onBusyChange={onBusyChange}/>}
  {d.canTest&&<p className="text-xs leading-relaxed text-stone-500">Тестовая оплата будет исключена из контроля чеков.</p>}
  {d.canTest&&<FiscalTestPaymentButton reviewId={d.id} onDone={onChanged} onBusyChange={onBusyChange}/>}
  </div></details>}
  {d.pendingAdmin&&d.hasOneCCheck&&<p className="text-sm text-stone-600">Документ в 1С есть. Проверьте расхождение; просьба пробить повторный чек не отправляется.</p>}
  {!d.pendingAdmin&&!d.resolved&&<p className="text-xs text-stone-500">Передано: {d.recipientLabel}</p>}
  {d.showDiscussion&&<div className="border-t border-stone-100 pt-4"><h3 className="mb-3 text-sm font-semibold text-stone-800">Обсуждение</h3><TerminalFiscalReviewConversation initialMessages={d.messages} currentUserId={d.currentUserId} endpoint={`/api/admin/terminal-fiscal/reviews/${d.id}/messages`} disabled={!d.open} disabledMessage={d.view.discussionMessage} disabledTone={d.view.tone==='admin'?'admin':'resolved'}/></div>}
 </div>;
}
