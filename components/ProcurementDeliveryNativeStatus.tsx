import React from 'react';
import { deliveryCollectionAmount, deliveryNativeFresh, type DeliveryNativeView } from '@/lib/procurement-delivery-native';
const money = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const titles = { waiting: 'Ожидает согласования', approved: 'Пополнение согласовано', payable: 'К выдаче', partial: 'Выдано частично', issued: 'Пополнение выдано', rejected: 'Заявка отклонена', review: 'Статус заявки уточняется' };
export function ProcurementDeliveryNativeStatus({ view, now, failed = false, audience = 'admin' }: { view?: DeliveryNativeView; now?: number; failed?: boolean; audience?: 'admin' | 'buyer' }) {
  if (!view || view.state === 'unlinked') return null;
  const s = view.status;
  if (failed || view.state === 'unavailable' || !s || !deliveryNativeFresh(s, now)) return <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{audience === 'buyer' ? 'Статус пополнения временно недоступен. Обновим автоматически.' : 'Статус заявки временно недоступен. Обновим автоматически.'}</p>;
  if (audience === 'buyer') {
    const amount = deliveryCollectionAmount(s);
    if (amount === null) return null;
    return <div role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
      <p className="font-bold">Можно получить <span className="whitespace-nowrap">{money(amount)}</span></p>
      <p className="mt-1">{s.cashbox}</p>
    </div>;
  }
  return <div role="status" className={`min-w-0 text-sm ${s.state === 'issued' ? 'text-emerald-950' : 'text-slate-800'}`}>
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-bold"><span>{titles[s.state]}</span>{s.state !== 'review' ? <span className="whitespace-nowrap text-lg font-black">{money(s.state === 'partial' || s.state === 'issued' ? s.issued! : s.amount)}</span> : null}</p>
    {s.state !== 'review' ? <>
      {s.state === 'partial' ? <p className="mt-1">Осталось выдать: {money(s.remaining!)}</p> : null}
      {['waiting', 'approved', 'payable', 'partial'].includes(s.state) && s.cashbox ? <p className="mt-1 break-words">По заявке: {s.cashbox}</p> : null}
    </> : <p className="mt-1 text-xs">Данные заявки изменились. Администратор проверит их.</p>}
    <details className="mt-2 text-xs text-slate-500"><summary className="w-fit cursor-pointer py-1">Документы 1С</summary>
      <p className="mt-1">Заявка № {s.number}</p>
      {s.desiredDate ? <p className="mt-1">Желаемая дата: {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(s.desiredDate))}</p> : null}
      {['approved', 'payable'].includes(s.state) ? <p className="mt-1">Деньги ещё не выданы.</p> : null}
    </details>
  </div>;
}
