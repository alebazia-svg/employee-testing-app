'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { startVisibleSync } from '@/lib/visible-sync';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import type { DeliveryNativeCandidate } from '@/lib/procurement-delivery-native';
import { ProcurementDeliveryNativeStatus } from './ProcurementDeliveryNativeStatus';

type Data = { view: DeliveryView; reminderId: string | null; linkedRef: string | null; candidates: DeliveryNativeCandidate[]; candidatesAvailable: boolean };
export function ProcurementDeliveryLink({ onView }: { onView: (v: DeliveryView) => void }) {
  const [data, setData] = useState<Data | null>(null), [date, setDate] = useState('');
  const [failed, setFailed] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [choice, setChoice] = useState<DeliveryNativeCandidate | 'unlink' | null>(null);
  const [now, setNow] = useState(Date.now());
  const active = useRef<AbortController | null>(null), sequence = useRef(0), writing = useRef(false);
  const refresh = useCallback(async () => {
    if (active.current || writing.current) return;
    const controller = new AbortController(); active.current = controller;
    const generation = ++sequence.current;
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(`/api/admin/procurement/delivery-request${date ? `?date=${encodeURIComponent(date)}` : ''}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error('unavailable');
      const result = await response.json();
      if (sequence.current === generation) { setData(result); onView(result.view); setFailed(false); setNow(Date.now()); }
    } catch { if (sequence.current === generation) setFailed(true); }
    finally { clearTimeout(timer); if (active.current === controller) active.current = null; }
  }, [date, onView]);
  useEffect(() => {
    const stop = startVisibleSync(refresh, 60_000), tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => { stop(); clearInterval(tick); ++sequence.current; active.current?.abort(); active.current = null; };
  }, [refresh]);
  const save = async () => {
    if (!data?.reminderId || !choice || pending || failed) return;
    setPending(true); writing.current = true; setError('');
    ++sequence.current; active.current?.abort(); active.current = null;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch('/api/admin/procurement/delivery-request', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(choice === 'unlink'
          ? { action: 'unlink', reminderId: data.reminderId, ref: data.linkedRef }
          : { action: 'link', reminderId: data.reminderId, ref: choice.status.ref, quote: choice.quote, ...(date ? { date } : {}) }) });
      if (!response.ok) throw Error('changed');
      setChoice(null);
    } catch { setChoice(null); setError('Не удалось подтвердить изменение. Проверяем состояние; при необходимости повторите.'); }
    finally { clearTimeout(timer); writing.current = false; setPending(false); await refresh(); }
  };
  const linked = data?.view.nativeRequest && data.view.nativeRequest.state !== 'unlinked';
  return <div>
    {failed ? <p role="status" className="text-sm text-amber-800">Статус пополнения недоступен. Обновим автоматически.</p> : !data ? <p className="text-sm text-slate-500">Проверяем заявку в 1С…</p> : data.reminderId ? <>
      {linked ? <><ProcurementDeliveryNativeStatus view={data.view.nativeRequest} now={now} />
        {data.linkedRef ? <button type="button" disabled={pending} onClick={() => { setChoice('unlink'); setError(''); }} className="mt-2 text-xs font-semibold text-slate-500 underline">Изменить связь</button> : null}</> : <>
        {data.view.nativeRequest?.reviewReason ? <p className="mb-2 text-sm text-amber-800">{data.view.nativeRequest.reviewReason === 'ambiguous' ? 'Найдено несколько заявок. Выберите нужную.' : 'Проверьте, какая заявка относится к запросу.'}</p> : null}
        {data.candidates.map(c => <div key={c.status.ref} className="rounded-xl bg-slate-50 p-3 [&+div]:mt-2">
          <ProcurementDeliveryNativeStatus view={{ state: 'linked', status: c.status }} now={now} />
          <button type="button" disabled={pending} onClick={() => { setChoice(c); setError(''); }} className="mt-3 w-fit shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Выбрать заявку</button>
        </div>)}
        {!data.candidates.length ? <p className="mt-2 text-sm text-slate-600">{data.candidatesAvailable ? 'Заявка на эту сумму не найдена. Если она уже создана, укажите её дату.' : 'Не удалось проверить заявки. Укажите дату документа или дождитесь обновления.'}</p> : null}
        <details className="mt-2 text-xs text-slate-500"><summary className="w-fit cursor-pointer py-1">Другая дата заявки</summary><label className="mt-2 block">Дата документа<input aria-label="Дата документа" type="date" value={date} onChange={e => { setChoice(null); setDate(e.target.value); }} className="ml-2 rounded-lg border p-2 text-sm" /></label></details>
      </>}
      {choice ? <div className="mt-3 rounded-xl border border-slate-300 bg-white p-3" role="group" aria-label="Подтверждение связи">
        <p className="text-sm font-semibold">{choice === 'unlink' ? 'Убрать связь с этой заявкой?' : `Связать запрос с заявкой № ${choice.status.number}?`}</p>
        <p className="mt-1 text-xs text-slate-500">Документы в 1С не изменятся.</p>
        <div className="mt-3 flex gap-2"><button type="button" disabled={pending} onClick={save} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{pending ? 'Сохраняем…' : 'Подтвердить'}</button><button type="button" disabled={pending} onClick={() => setChoice(null)} className="rounded-lg border px-4 py-2 text-sm">Отмена</button></div>
      </div> : null}
    </> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-amber-800">{error}</p> : null}
  </div>;
}
