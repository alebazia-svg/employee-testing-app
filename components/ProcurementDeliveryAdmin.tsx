import React from 'react';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import { DELIVERY_RESERVE, deliveryFresh } from '@/lib/procurement-delivery-policy';

const money = (value: number) => `${value.toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} ₽`;
export function ProcurementDeliveryAdmin({ view, children, compactSummary = false }: { view: DeliveryView; children?: React.ReactNode; compactSummary?: boolean }) {
  const fresh = deliveryFresh(view.snapshot);
  const low = fresh && view.snapshot.balance! <= DELIVERY_RESERVE.warnAt;
  const needed = fresh ? Math.max(0, Math.round((DELIVERY_RESERVE.target - view.snapshot.balance!) * 100) / 100) : null;
  return <section id="delivery" aria-label="Пополнение подотчёта Астемира" className="mt-5 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold text-slate-950">Подотчёт Астемира</h2>
      {!fresh || low ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${low ? 'bg-amber-50 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
        {!fresh ? 'Нет свежих данных' : 'Нужно пополнить'}
      </span> : null}</div>
    {compactSummary ? <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 text-sm"><p className="text-slate-600">Остаток у Астемира</p><p className="text-xl font-black">{fresh ? money(view.snapshot.balance!) : '—'}</p></div> : <div className="mt-4 grid grid-cols-2 gap-4"><div><p className="min-h-8 text-xs text-slate-500">Остаток по 1С</p><p className="mt-1 text-xl font-black">{fresh ? money(view.snapshot.balance!) : '—'}</p></div>
      <div><p className="min-h-8 text-xs text-slate-500">Рекомендуем пополнить</p><p className="mt-1 text-xl font-black">{needed === null ? '—' : money(needed)}</p><p className="mt-1 text-xs text-slate-500">До запаса <span className="whitespace-nowrap">{money(DELIVERY_RESERVE.target)}</span></p></div></div>}
    {view.requestStateAvailable && view.requestedByBuyer && view.requestDetails ? <div className="mt-4 rounded-xl bg-slate-50 p-4">
      <p className="text-sm font-semibold">Астемир запросил <span className="text-lg font-black">{money(view.requestDetails.amount)}</span></p>
      {view.requestDetails.comment ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{view.requestDetails.comment}</p> : null}
      <p className="mt-2 text-xs text-slate-500">При отправке: остаток по 1С {money(view.requestDetails.balance)} · {new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(view.requestDetails.requestedAt))}</p>
    </div> : null}
    {view.requestStateAvailable && view.requestedByBuyer && !view.requestDetails ? <p className="mt-3 text-sm text-slate-600">Астемир запросил пополнение без указания суммы.</p> : null}
    {children}
    {!view.requestStateAvailable ? <p role="alert" className="mt-3 text-sm text-amber-800">Не удалось загрузить обращение на пополнение.</p> : null}
    <p className="mt-3 text-xs text-slate-500">{fresh ? `Подотчёт на ${new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(view.snapshot.checkedAt))}` : 'Обновите страницу, чтобы повторить проверку.'}</p>
  </section>;
}
