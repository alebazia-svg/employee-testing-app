'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, X } from 'lucide-react';
import { ExpenseNativeClient } from '@/app/(dashboard)/admin/expense-requests/[id]/native/ExpenseNativeClient';
import type { ExpenseListItem } from '@/lib/expense-request-list-view';
import { ExpenseRequestWaitingAge } from './ExpenseRequestWaitingAge';
import { ExpenseRequestSeenClient } from '@/app/(dashboard)/admin/expense-requests/ExpenseRequestSeenClient';

const money = (n: number | null) => n === null ? 'Сумма не передана' : `${n.toLocaleString('ru-RU', {maximumFractionDigits: 2})} ₽`;
const date = (s: string | null) => s ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s)) : 'Дата не передана';
export function ExpenseRequestDialogRow({ item, initialOpen = false, detailOnly = false }: { item: ExpenseListItem; initialOpen?: boolean; detailOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen), [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false), [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; dialog.current?.close(); trigger.current?.focus(); };
  }, [open]);
  function finishClose() { setOpen(false); if (detailOnly) { const url=new URL(window.location.href);url.searchParams.delete('request');router.replace(url.pathname+url.search,{scroll:false}); } }
  function close() { if (busy) return; if (dirty) setDiscard(true); else finishClose(); }
  const label = item.archived && item.stage !== 'closed' ? 'Архив 1С' : item.stage === 'decision' ? item.missing.length ? 'Нужно заполнить' : 'Ждёт решения' : item.stage === 'issuance' ? 'К оплате · ждёт выдачи' : item.stage === 'closed' ? item.statusKey === 'rejected' ? 'Отклонена' : item.status === 'Удалена в 1С' ? item.status : 'Выдача подтверждена' : 'Проверить статус';
  const facts = [['Операция',item.operation],['Статья ДДС',item.article],['Касса',item.cashbox],['Подразделение',item.department],['Получатель / контрагент',item.recipient],['Основание',item.basis]];
  return <>
    {!detailOnly && <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => {setDirty(false);setDiscard(false);setOpen(true);}} className="group grid w-full grid-cols-1 items-start gap-x-5 gap-y-2 px-4 py-3.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a66c43] sm:grid-cols-[minmax(0,1fr)_192px] sm:px-5 xl:grid-cols-[220px_minmax(0,1fr)_176px_224px] min-[1600px]:grid-cols-[240px_minmax(0,1fr)_220px_240px]">
      <span className="min-w-0"><span className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="text-sm text-slate-950">{item.person || 'Заявитель не указан'}</strong><span className="whitespace-nowrap text-base font-bold tabular-nums">{money(item.amount)}</span></span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.number || 'Без номера'} · {date(item.date)}</span></span>
      <span className="min-w-0 sm:col-start-1 sm:row-start-2 xl:col-auto xl:row-auto"><span className="line-clamp-2 text-sm leading-5 text-slate-800">{item.purpose || item.comment || 'Назначение не заполнено'}</span><span className="mt-1 block text-xs leading-5 text-slate-600 xl:hidden">{item.cashbox || 'Касса не указана'}</span></span>
      <span className="hidden min-w-0 text-sm text-slate-700 xl:block">{item.cashbox || 'Не указана'}<span className="mt-1 block text-xs leading-5 text-slate-600">{item.department}</span></span>
      <span className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-xs sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:border-0 sm:pt-0 xl:col-auto xl:row-auto"><span><span className={`block font-semibold ${item.stage === 'closed' ? 'text-emerald-800' : item.missing.length || item.stage === 'check' ? 'text-amber-800' : 'text-slate-800'}`}>{label}</span><span className="mt-1 block leading-5 text-slate-600">{item.stage === 'decision' ? item.missing.join(', ') : item.stage === 'check' ? item.status : null}</span>{item.stage === 'decision' && !item.archived && <ExpenseRequestWaitingAge since={item.since}/>}</span><ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[#a66c43]"/><span className="sr-only">Открыть заявку</span></span>
    </button>}
    {open && <dialog ref={dialog} aria-labelledby={`expense-title-${item.id}`} onCancel={e => {e.preventDefault();close();}} className="m-auto w-[calc(100%-24px)] max-w-[860px] max-h-[calc(100dvh-32px)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/45" style={{height:'fit-content'}}>
      <div className="flex max-h-[calc(100dvh-32px)] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><h2 id={`expense-title-${item.id}`} className="text-xl font-bold text-slate-950">{item.person || 'Заявка'} · {money(item.amount)}</h2><p className="mt-1 text-xs text-slate-500">Заявка {item.number || 'без номера'} · {date(item.date)}</p></div><button autoFocus type="button" aria-label="Закрыть заявку" disabled={busy} onClick={close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <ExpenseRequestSeenClient caseId={item.id}/>
          {item.nativeEnabled ? <ExpenseNativeClient caseId={item.id} onDirtyChange={setDirty} onBusyChange={setBusy}/> : <>
            <p className="mb-4 text-sm font-semibold text-slate-800">{label}</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{facts.map(([name,value]) => <div key={name}><dt className="text-xs text-slate-500">{name}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value || 'Не заполнено'}</dd></div>)}</dl>
            <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">Назначение платежа</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.purpose || 'Не заполнено'}</p>{item.comment && item.comment !== item.purpose && <><p className="mt-3 text-xs text-slate-500">Комментарий</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.comment}</p></>}</div>
            <p className="mt-4 text-xs text-slate-500">Данные из 1С обновлены {date(item.checkedAt)}.{!item.sourceComplete && ' Ответ 1С неполный.'}</p>
          </>}
        </div>
        <div className="shrink-0 border-t border-slate-200 px-5 py-3">
          {discard ? <div role="alert"><p className="text-sm font-semibold">Закрыть без сохранения исправлений?</p><div className="mt-2 flex flex-wrap gap-3"><button type="button" className="min-h-11 rounded-lg border px-3 text-sm font-semibold" onClick={() => setDiscard(false)}>Продолжить редактирование</button><button type="button" className="min-h-11 px-3 text-sm text-red-700" onClick={finishClose}>Закрыть без сохранения</button></div></div> : !item.nativeEnabled ? <p className="text-sm text-slate-600">{item.stage === 'closed' ? 'Заявка завершена. Сохранена в истории.' : 'Исправление и утверждение этой заявки пока выполняются в 1С. Портал обновит статус после синхронизации.'}</p> : <p className="text-xs text-slate-500">«К оплате» остаётся в работе до подтверждения расходника.</p>}
        </div>
      </div>
    </dialog>}
  </>;
}
