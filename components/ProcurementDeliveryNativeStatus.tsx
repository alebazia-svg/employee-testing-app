import React from 'react';
import { deliveryNativeFresh, type DeliveryNativeView } from '@/lib/procurement-delivery-native';
const money = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const titles = { waiting: 'Ожидает согласования', approved: 'Пополнение согласовано', payable: 'К выдаче', partial: 'Выдано частично', issued: 'Пополнение выдано', rejected: 'Заявка отклонена', review: 'Статус заявки уточняется' };
export function ProcurementDeliveryNativeStatus({ view, now, failed = false, audience = 'admin' }: { view?: DeliveryNativeView; now?: number; failed?: boolean; audience?: 'admin' | 'buyer' }) {
  if (!view || view.state === 'unlinked') return null;
  const s = view.status;
  if (failed || view.state === 'unavailable' || !s || !deliveryNativeFresh(s, now)) return <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{audience === 'buyer' ? 'Статус пополнения временно недоступен. Обновим автоматически.' : 'Статус заявки временно недоступен. Обновим автоматически.'}</p>;
  if (audience === 'buyer') {
    const labels = { waiting: 'На согласовании', approved: 'Согласовано', payable: s.cashbox ? 'Можно получить' : 'Выдача согласована', partial: 'Выдано', issued: 'Выдано', rejected: 'Пополнение отклонено', review: 'Статус пополнения уточняется' };
    return <div role="status" className={`mt-3 rounded-xl p-3 text-sm ${s.state === 'payable' || s.state === 'issued' ? 'bg-emerald-50 text-emerald-950' : 'bg-slate-50 text-slate-800'}`}>
      <p className="font-bold">{labels[s.state]}{!['review', 'rejected'].includes(s.state) ? <> <span className="whitespace-nowrap">{money(s.state === 'partial' || s.state === 'issued' ? s.issued! : s.amount)}</span></> : null}</p>
      {s.state === 'partial' ? <p className="mt-1">Осталось выдать: {money(s.remaining!)}</p> : null}
      {['payable', 'partial'].includes(s.state) && s.cashbox ? <p className="mt-1">{s.cashbox}</p> : null}
      {s.state === 'payable' && !s.cashbox ? <p className="mt-1">Касса уточняется</p> : null}
    </div>;
  }
  return <div role="status" className={`mt-3 rounded-xl p-3 text-sm ${s.state === 'issued' ? 'bg-emerald-50 text-emerald-950' : 'bg-slate-50 text-slate-800'}`}>
    <p className="font-bold">{titles[s.state]}</p>
    {s.state !== 'review' ? <>
      <p className="mt-1 text-xl font-black">{money(s.state === 'partial' || s.state === 'issued' ? s.issued! : s.amount)}</p>
      {s.state === 'partial' ? <p className="mt-1">Осталось выдать: {money(s.remaining!)}</p> : null}
      {['waiting', 'approved', 'payable', 'partial'].includes(s.state) && s.cashbox ? <p className="mt-2">По заявке: {s.cashbox}</p> : null}
      {['waiting', 'approved', 'payable'].includes(s.state) && s.desiredDate ? <p className="mt-1 text-xs">Желаемая дата: {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(new Date(s.desiredDate))}</p> : null}
      {['approved', 'payable'].includes(s.state) ? <p className="mt-2 text-xs text-slate-600">Деньги ещё не выданы.</p> : null}
    </> : <p className="mt-1 text-xs">Данные заявки изменились. Администратор проверит их.</p>}
    <p className="mt-2 text-xs text-slate-500">Заявка № {s.number}</p>
  </div>;
}
