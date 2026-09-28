import React from 'react';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import { DELIVERY_RESERVE, deliveryFresh } from '@/lib/procurement-delivery-policy';

const money = (value: number) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} ₽`;
export function ProcurementDeliveryAdmin({ view, children, compactSummary = false }: { view: DeliveryView; children?: React.ReactNode; compactSummary?: boolean }) {
  const fresh = deliveryFresh(view.snapshot);
  const low = fresh && view.snapshot.balance! <= DELIVERY_RESERVE.warnAt;
  const needed = fresh ? Math.max(0, Math.round((DELIVERY_RESERVE.target - view.snapshot.balance!) * 100) / 100) : null;
  const request = view.requestStateAvailable && view.requestedByBuyer ? view.requestDetails : null;
  return <section id="delivery" aria-label="Пополнение подотчёта Астемира" className="mt-5 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold text-slate-950">Подотчёт Астемира</h2>
      {!fresh || low ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${low ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
        {!fresh ? 'Нет свежих данных' : 'Нужно пополнить'}
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
      {request ? <details><summary className="w-fit cursor-pointer py-1">Детали запроса</summary><p className="mt-1">При отправке: остаток по 1С {money(request.balance)} · {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(request.requestedAt))}</p></details> : null}
      <p>{fresh ? `Подотчёт на ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(view.snapshot.checkedAt))}` : 'Обновите страницу, чтобы повторить проверку.'}</p>
    </div>
    </div>
    {children ? <div className={compactSummary ? 'min-w-0 border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0' : ''}>{children}</div> : null}
    </div>
  </section>;
}
