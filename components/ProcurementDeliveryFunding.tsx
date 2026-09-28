'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { DeliveryFunding } from '@/lib/procurement-delivery-funding';
import { DELIVERY_MAX_AGE_MS } from '@/lib/procurement-delivery-policy';
import { startVisibleSync } from '@/lib/visible-sync';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import { ProcurementDeliveryAdmin } from './ProcurementDeliveryAdmin';
import { ProcurementDeliveryCashboxChoice } from './ProcurementDeliveryCashboxChoice';
import { ProcurementDeliveryLink } from './ProcurementDeliveryLink';

const money = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const status: Record<string, string> = { approved: 'Согласована', payable: 'К оплате', not_approved: 'Не согласована', rejected: 'Отклонена', unknown: 'Проверить в 1С' };

export function DeliveryFundingContent({ data, view, now }: { data: DeliveryFunding; view?: DeliveryView; now?: number }) {
  return <div className="mt-4 border-t border-slate-200 pt-4">
    {data.topups.length ? <><h3 className="text-sm font-bold text-slate-950">Заявки на пополнение в 1С</h3><ul className="mb-4 mt-2 space-y-2">{data.topups.map(r => <li key={r.ref} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
      <div><p className="font-semibold">Заявка № {r.number}</p><p className="text-xs text-slate-500">{r.date ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow' }).format(new Date(r.date)) + ' · ' : ''}{status[r.status] ?? status.unknown}</p></div>
      <p className="font-bold">{r.remaining === null ? 'Остаток нужно проверить' : `К выдаче ${money(r.remaining)}`}</p>
    </li>)}</ul></> : null}
    {view ? <ProcurementDeliveryCashboxChoice key={`${view.requestedByBuyer ?? false}:${view.requestDetails?.requestedAt ?? ''}`} data={data} view={view} now={now} /> : <>
    <h3 className="text-sm font-bold text-slate-950">Остатки касс менеджеров</h3>
    <p className="mt-1 text-xs text-slate-500">По учёту 1С</p>
    <ul aria-label="Кассы менеджеров" className="mt-2 divide-y divide-slate-100">
      {data.cashboxes.map(box => <li key={box.ref} className="py-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 break-words">{box.name.replace(/^Касса\s+/i, '')}</span><span className={`shrink-0 whitespace-nowrap font-semibold tabular-nums ${box.balance < 0 ? 'text-amber-800' : 'text-slate-950'}`}>{money(box.balance)}</span></div>
        {box.pending === null ? <p className="mt-1 text-xs text-amber-800">Сумму по заявкам нужно проверить.</p> : box.pending > 0 ? <p className="mt-1 text-xs text-slate-500">Ещё не выдано по заявкам: {money(box.pending)}</p> : null}
      </li>)}
    </ul>
    {!data.cashboxes.length ? <p className="mt-2 text-sm text-slate-600">Кассы менеджеров не найдены. Проверьте привязки касс в разделе «Контроль дня».</p> : null}
    {data.cashboxes.some(b => b.pending !== null && b.pending > 0) ? <p className="mt-2 text-xs text-slate-500">Суммы по заявкам включают несогласованные и не вычтены из остатков.</p> : null}</>}
  </div>;
}

export function DeliveryFundingOrganizationReview({ data }: { data: DeliveryFunding }) {
  if (!data.unassignedCount && !data.reviewCount) return null;
  return <details className="mt-3 rounded-xl border border-slate-200 bg-white text-sm">
    <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-700">Проверка заявок организации</summary>
    <div className="space-y-2 px-4 pb-4 text-slate-600">
      {data.unassignedCount > 0 ? <p>В {data.unassignedCount} заявках на {money(data.unassignedAmount)} не указана касса. Перед выдачей проверьте источник денег в 1С.</p> : null}
      {data.reviewCount > 0 ? <p>По {data.reviewCount} документам нужно проверить остаток или источник выдачи в 1С.</p> : null}
      <p className="text-xs text-slate-500">Это заявки всей организации, не сумма пополнения Астемиру. Заявки без указанной кассы не включены в суммы по кассам выше.</p>
    </div>
  </details>;
}

export function ProcurementDeliveryFunding({ view }: { view?: DeliveryView } = {}) {
  const [currentView, setCurrentView] = useState(view);
  const [data, setData] = useState<DeliveryFunding | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef<AbortController | null>(null), lastRead = useRef(0);
  useEffect(() => {
    const refresh = async () => {
      if (active.current || Date.now() - lastRead.current < 10_000) return;
      lastRead.current = Date.now();
      const controller = new AbortController(); active.current = controller;
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch('/api/admin/procurement/delivery-funding', { method: 'GET', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('unavailable');
        const result = await response.json();
        if (active.current === controller) { setData(result); setFailed(false); setNow(Date.now()); }
      } catch { if (active.current === controller) { setFailed(true); setData(null); } }
      finally { clearTimeout(timeout); if (active.current === controller) active.current = null; }
    };
    const stop = startVisibleSync(refresh, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    window.addEventListener('online', refresh);
    return () => { stop(); clearInterval(tick); window.removeEventListener('online', refresh); const c = active.current; active.current = null; c?.abort(); lastRead.current = 0; };
  }, []);
  const age = data ? now - Date.parse(data.checkedAt) : NaN;
  const valid = !failed && data && Number.isFinite(age) && age <= DELIVERY_MAX_AGE_MS && age >= -60_000;
  const content = failed || (data && !valid)
    ? <p role="status" className="mt-4 text-sm text-amber-800">Кассы и заявки временно недоступны. Обновим автоматически.</p>
    : data ? <DeliveryFundingContent data={data} view={currentView} now={now} /> : <p role="status" className="mt-4 text-sm text-slate-500">Проверяем кассы и заявки…</p>;
  const hasExistingRequest = currentView?.nativeRequest && currentView.nativeRequest.state !== 'unlinked'
    || currentView?.requestDetails && data?.topups.length;
  return <>{currentView ? <ProcurementDeliveryAdmin view={currentView} compactSummary><ProcurementDeliveryLink onView={setCurrentView} />{hasExistingRequest ? null : content}</ProcurementDeliveryAdmin> : content}{valid && !hasExistingRequest ? <DeliveryFundingOrganizationReview data={data} /> : null}</>;
}
