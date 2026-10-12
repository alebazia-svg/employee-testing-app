'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import React, { useEffect, useId, useRef, useState } from 'react';
import { ExpenseRequestWaitingAge } from './ExpenseRequestWaitingAge';
import { DeliveryDialogActionContext } from './ProcurementDeliveryDialogActions';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import { DELIVERY_RESERVE, deliveryFresh } from '@/lib/procurement-delivery-policy';
import { deliveryNativeFresh, deliveryRequestIsClosed } from '@/lib/procurement-delivery-native';

const money = (value: number) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} ₽`;
export function ProcurementDeliveryAdmin({ view, children, compactSummary = false, actionsEnabled = true, now = Date.now() }: { view: DeliveryView; children?: React.ReactNode; compactSummary?: boolean; actionsEnabled?: boolean; now?: number }) {
  const router = useRouter();
  const targetRequest = useSearchParams().get('deliveryRequest');
  const [open, setOpen] = useState(false);
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  const [moreTarget, setMoreTarget] = useState<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId(), titleId = useId();
  const closed = deliveryRequestIsClosed(view, now) || (view.requestStateAvailable && !view.requested);
  useEffect(() => { setOpen(false); }, [view.requestDetails?.requestedAt]);
  useEffect(() => { if (targetRequest && targetRequest === view.requestId && !closed && view.requestStateAvailable) setOpen(true); }, [targetRequest, view.requestId, closed, view.requestStateAvailable]);
  function closeDialog() {
    setOpen(false);
    if (targetRequest) { const url = new URL(window.location.href); url.searchParams.delete('deliveryRequest'); router.replace(url.pathname + url.search, { scroll: false }); }
  }
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open || closed) {
      if (dialog.open) { dialog.close(); triggerRef.current?.focus(); }
      return;
    }
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; if (dialog.open) dialog.close(); };
  }, [open, closed]);
  const fresh = deliveryFresh(view.snapshot, now);
  const native = view.requestStateAvailable && view.nativeRequest?.state === 'linked' && view.nativeRequest.status && deliveryNativeFresh(view.nativeRequest.status, now) ? view.nativeRequest.status : null;
  // Keep the refresh child mounted: cancellation of an RKO must reopen the row.
  if (closed) return <div hidden>{children}</div>;
  const low = fresh && view.snapshot.balance! <= DELIVERY_RESERVE.warnAt;
  const needed = fresh ? Math.max(0, Math.round((DELIVERY_RESERVE.target - view.snapshot.balance!) * 100) / 100) : null;
  const request = view.requestStateAvailable && view.requestedByBuyer ? view.requestDetails : null;
  if (compactSummary) {
    const checking = !view.requestStateAvailable || view.nativeRequest?.state === 'unavailable' || (view.nativeRequest?.state === 'linked' && !native);
    const label = checking ? 'Проверяем статус' : native ? ({ waiting: 'Проверить заявку', approved: 'Утвердить к оплате', payable: 'К оплате', partial: 'Выдано частично', review: 'Проверить статус', issued: 'Проверить выдачу', rejected: 'Отклонена' }[native.state]) : request ? 'Ждёт решения' : 'Проверить остаток';
    const date = request ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(request.requestedAt)) : '';
    return <section id="delivery" aria-label="Пополнение подотчёта Астемира" className="scroll-mt-6 bg-white">
      <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-controls={dialogId} onClick={() => setOpen(true)} className="group grid w-full grid-cols-1 items-start gap-x-5 gap-y-2 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[#f3e4d6] focus-visible:bg-[#f3e4d6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a66c43] sm:grid-cols-[minmax(0,1fr)_144px] sm:px-5 xl:grid-cols-[260px_minmax(0,1fr)_176px_144px]">
        <span className="min-w-0"><span className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="text-sm text-slate-950">Астемир</strong>{request && <span className="whitespace-nowrap text-base font-bold tabular-nums">{money(request.amount)}</span>}</span>{date && <span className="mt-1 block text-xs text-slate-500">{date}</span>}</span>
        <span className="min-w-0 sm:col-start-1 sm:row-start-2 xl:col-auto xl:row-auto"><span className="line-clamp-2 text-sm leading-5 text-slate-800">{request?.comment || 'Пополнение подотчёта'}</span><span className="mt-1 block text-xs leading-5 text-slate-600 xl:hidden">{native?.cashbox || 'Касса не выбрана'}</span></span>
        <span className="hidden min-w-0 text-sm text-slate-700 xl:block">{native?.cashbox || 'Касса не выбрана'}</span>
        <span className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 text-xs sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:border-0 sm:pt-0 xl:col-auto xl:row-auto"><span><span className="block font-semibold text-slate-800">{label}</span>{native?.state === 'partial' && <span className="mt-1 block text-slate-600">Осталось {money(native.remaining!)}</span>}</span><ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[#a66c43] transition-colors group-hover:text-[#7b482b] group-focus-visible:text-[#7b482b]"/><span className="sr-only">Открыть заявку</span></span>
      </button>
      <dialog ref={dialogRef} id={dialogId} aria-labelledby={titleId}
        onCancel={event => { event.preventDefault(); closeDialog(); }} onClose={() => { setOpen(false); triggerRef.current?.focus(); }}
        style={{ height: 'fit-content' }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-[860px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm">
        <DeliveryDialogActionContext.Provider value={{ target: actionsTarget, moreTarget, enabled: actionsEnabled && open }}><div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="shrink-0 border-b border-slate-200 px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div><h2 id={titleId} className="text-xl font-bold tracking-tight">Астемир</h2><p className="mt-1 text-xs text-slate-500">Выдача под отчёт{date ? ` · ${date}` : ''}</p></div>
              <div className="flex items-center gap-1">
                <details onKeyDown={event => { if (event.key === 'Escape' && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.open = false; }} className="relative hidden has-[button]:block"><summary aria-label="Дополнительные действия" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">⋯</summary><div ref={setMoreTarget} className="absolute right-0 top-10 z-10 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" /></details>
                <button type="button" aria-label="Закрыть заявку" onClick={closeDialog} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-slate-500 hover:bg-slate-100">×</button>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div><dt className="text-xs text-slate-500">Запрашивает</dt><dd className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{request ? money(request.amount) : 'Уточнить сумму'}</dd></div>
              <div className="border-l border-slate-200 pl-4"><dt className="text-xs text-slate-500">Сейчас под отчётом</dt><dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-700">{fresh ? money(view.snapshot.balance!) : 'Нет данных'}</dd><p className="mt-1 text-[11px] text-slate-400">{fresh ? `По 1С на ${new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(view.snapshot.checkedAt))}` : 'Ожидаем обновления 1С'}</p></div>
            </dl>
          </header>
          <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
            <p className="text-sm font-semibold text-slate-700">{label}{native?.number ? ` · № ${native.number}` : !checking ? ' · Заявка в 1С ещё не создана' : ''}</p>
            {request && !native && !checking && <ExpenseRequestWaitingAge since={request.requestedAt}/> }
            {request?.comment ? <div><p className="text-xs font-semibold text-slate-500">Назначение</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{request.comment}</p></div> : null}
            {children}

          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3"><button type="button" onClick={closeDialog} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">Закрыть</button><div ref={setActionsTarget} className="flex flex-wrap items-center justify-end gap-2" /></div>
        </div></DeliveryDialogActionContext.Provider>
      </dialog>
    </section>;
  }
  return <section id="delivery" aria-label="Пополнение подотчёта Астемира" className="mt-5 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold text-slate-950">Подотчёт Астемира</h2>
      {native || view.nativeRequest?.state === 'unavailable' || !fresh || low ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
        {native ? ({ waiting: 'Проверить заявку', approved: 'Утвердить к оплате', payable: 'Ожидает выдачи', partial: 'Выдано частично', review: 'Проверить статус', issued: 'Выдано', rejected: 'Отклонена' }[native.state]) : view.nativeRequest && view.nativeRequest.state !== 'unlinked' ? 'Проверяем статус' : !fresh ? 'Нет свежих данных' : 'Нужно пополнить'}
      </span> : null}</div>
    <div className={compactSummary && children ? 'mt-3 grid gap-4 md:grid-cols-2 md:gap-6' : ''}>
    <div className="min-w-0">
    {compactSummary ? <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      {request ? <p className="font-semibold">Запросил <span className="whitespace-nowrap text-lg font-black">{money(request.amount)}</span></p> : null}
      <p className="text-slate-600">Остаток <span className="whitespace-nowrap font-semibold text-slate-900">{fresh ? money(view.snapshot.balance!) : '—'}</span></p>
    </div> : <div className="mt-4 grid grid-cols-2 gap-4"><div><p className="min-h-8 text-xs text-slate-500">Остаток по 1С</p><p className="mt-1 text-xl font-black">{fresh ? money(view.snapshot.balance!) : '—'}</p></div>
      <div><p className="min-h-8 text-xs text-slate-500">Рекомендуем пополнить</p><p className="mt-1 text-xl font-black">{needed === null ? '—' : money(needed)}</p><p className="mt-1 text-xs text-slate-500">До запаса <span className="whitespace-nowrap">{money(DELIVERY_RESERVE.target)}</span></p></div></div>}
    {request ? <div className={compactSummary ? 'mt-1' : 'mt-4 rounded-xl bg-slate-50 p-4'}>
      {!compactSummary ? <p className="text-sm font-semibold">Астемир запросил <span className="text-lg font-black">{money(request.amount)}</span></p> : null}
      {request.comment ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{request.comment}</p> : null}
    </div> : null}
    {view.requestStateAvailable && view.requestedByBuyer && !view.requestDetails ? <p className="mt-3 text-sm text-slate-600">Астемир запросил пополнение без указания суммы.</p> : null}
    {!view.requestStateAvailable ? <p role="alert" className="mt-3 text-sm text-amber-800">Не удалось загрузить обращение на пополнение.</p> : null}
    <div className="mt-3 space-y-1 text-xs text-slate-500">
      {request ? <p className="font-semibold text-slate-700">Запрос от {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(request.requestedAt))}</p> : null}
      {request ? <details><summary className="w-fit cursor-pointer py-1">Детали запроса</summary><p className="mt-1">При отправке: остаток по 1С {money(request.balance)} · {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(request.requestedAt))}</p></details> : null}
      <p>{fresh ? `Остаток обновлён ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(view.snapshot.checkedAt))}` : 'Обновите страницу, чтобы повторить проверку.'}</p>
    </div>
    </div>
    {children ? <div className={compactSummary ? 'min-w-0 border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0' : ''}>{children}</div> : null}
    </div>
  </section>;
}
