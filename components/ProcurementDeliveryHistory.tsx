import React from 'react';
import Link from 'next/link';
import type { DeliveryHistoryRow } from '@/lib/procurement-delivery-reminders';
import { deliveryNativeFresh, deliveryRequestIsClosed } from '@/lib/procurement-delivery-native';

const money = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
export function ProcurementDeliveryHistory({ rows, nextCursor, now = Date.now() }: { rows: DeliveryHistoryRow[]; nextCursor: string | null; now?: number }) {
  return <section id="delivery-history" aria-label="История подотчёта" className="mt-4 rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-bold">Подотчёт Астемира · история</h2><Link href="/admin/expense-requests#delivery" className="text-xs font-semibold text-slate-600 underline underline-offset-4">К текущим запросам</Link></div>
    {!rows.length ? <p className="px-4 py-5 text-sm text-slate-500">Запросов на пополнение пока нет.</p> : <ul className="divide-y divide-slate-100">{rows.map(row => {
      return <li key={row.id}><ProcurementDeliveryHistoryRow row={row} now={now} /></li>;
    })}</ul>}
    {nextCursor ? <Link href={`/admin/expense-requests?view=all&deliveryCursor=${encodeURIComponent(nextCursor)}#delivery-history`} className="block border-t border-slate-100 px-4 py-3 text-sm font-semibold underline underline-offset-4">Более ранние запросы</Link> : null}
  </section>;
}

export function ProcurementDeliveryHistoryRow({ row, now = Date.now() }: { row: DeliveryHistoryRow; now?: number }) {
      const s = row.native.state === 'linked' && row.native.status && deliveryNativeFresh(row.native.status, now) ? row.native.status : null;
      const closed = deliveryRequestIsClosed({ requestStateAvailable: true, nativeRequest: row.native }, now);
      const label = closed ? s?.state === 'issued' ? 'Выдано · закрыта' : 'Отклонён' : s ? ({ waiting: 'Ожидает решения', approved: 'Согласовано в 1С', payable: 'Ожидает выдачи', partial: 'Выдано частично', review: 'Проверить статус', issued: 'Проверить выдачу', rejected: 'Проверить статус' }[s.state]) : row.native.state === 'unlinked' ? 'Не связан с заявкой 1С' : 'Статус не подтверждён';
      return <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6rem] sm:items-center"><div>
        <div className="flex flex-wrap items-baseline gap-2"><p className="font-extrabold text-slate-950">Астемир <span className="ml-2 text-sm">{row.details ? money(row.details.amount) : 'Сумма не указана'}</span> <span className="ml-2 text-xs font-normal text-slate-500">{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(new Date(row.requestedAt))}</span></p></div>
        <p className="mt-1 text-sm text-slate-600">Выдача подотчётнику</p>
        {s ? <p className="mt-1 text-xs text-slate-500">Заявка № {s.number}{s.cashbox ? ` · ${s.cashbox}` : ''}{s.state === 'partial' ? ` · осталось ${money(s.remaining!)}` : ''}</p> : null}
        {row.details?.comment ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">{row.details.comment}</p> : null}
      </div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${closed && s?.state === 'issued' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{label}</span></div>;
}
