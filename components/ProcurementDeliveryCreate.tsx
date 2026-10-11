'use client';
import { cashboxShiftLabel, cashboxShiftWarning, type CashboxShift } from '@/lib/procurement-cashbox-shift-policy';
import React, { useEffect, useState } from 'react';
import { ProcurementDeliveryFundingNotice } from './ProcurementDeliveryFundingNotice';
import { ProcurementDeliveryDialogActions } from './ProcurementDeliveryDialogActions';
import type { DeliveryCreateSummary } from '@/lib/procurement-delivery-create-policy';
type State = { cashboxShift?: CashboxShift; enabled?: boolean; reminderId?: string; state?: string; previewId?: string; expiresAt?: number; summary?: DeliveryCreateSummary };
export function ProcurementDeliveryCreate({ cashboxRef, ready, onReviewChange }: { cashboxRef?: string; ready: boolean; onReviewChange?: (reviewing: boolean) => void }) {
  const [state, setState] = useState<State>({}), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [loaded, setLoaded] = useState(false), [loadFailed, setLoadFailed] = useState(false);
  async function refresh() {
    const response = await fetch('/api/admin/procurement/delivery-create', { cache: 'no-store' });
    if (!response.ok) throw Error();
    const value = await response.json(); setState(value); return value;
  }
  useEffect(() => { let alive = true; fetch('/api/admin/procurement/delivery-create', { cache: 'no-store' }).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(s => { if (alive) { setState(s); setLoaded(true); } }).catch(() => { if (alive) { setLoadFailed(true); setLoaded(true); } }); return () => { alive = false; }; }, []);
  async function act(action: string) {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/procurement/delivery-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, reminderId: state.reminderId, previewId: state.previewId, cashboxRef, reportDate }) });
      const value = await response.json();
      if (!response.ok) { await refresh(); throw Error(value.error); }
      setState(value); setCancelled(false);
      if (value.state === 'committed') window.dispatchEvent(new Event('delivery-request-updated'));
    } catch (e) { setError(e instanceof Error && e.message ? e.message : 'Не удалось проверить результат. Повторите проверку.'); }
    finally { setBusy(false); }
  }
  const activeReview = Boolean(state.state === 'preview' && state.summary && state.summary.cashboxRef === cashboxRef && (!reportDate || state.summary.reportDate === reportDate) && ready && state.expiresAt && state.expiresAt > Date.now() && !cancelled);
  useEffect(() => { onReviewChange?.(Boolean(state.enabled && (activeReview || ['checking', 'confirming', 'review', 'committed'].includes(state.state || '')))); }, [onReviewChange, state.enabled, state.state, activeReview]);
  if (!loaded) return <p role="status" className="mt-3 text-xs text-slate-500">Проверяем возможность оформления…</p>;
  if (loadFailed) return <p role="alert" className="mt-3 text-xs text-amber-800">Не удалось проверить оформление заявки. Обновите страницу.</p>;
  if (!state.enabled) return <p className="mt-3 text-xs text-slate-500">Это подбор кассы, не согласование. Заявку пока оформите в 1С.</p>;
  if (!state.reminderId) return null;
  const summary = state.summary;
  const awaiting = ['checking', 'confirming', 'review'].includes(state.state || '');
  return <div className="mt-3" aria-label="Создание заявки в 1С">

    {state.state === 'committed' && summary ? <p role="status" className="mt-2 text-sm font-semibold text-emerald-800">Заявка №{summary.number} создана · К оплате. Расходник оформляет сотрудник.</p> : awaiting ? <>
      <p role="status" className="mt-2 text-sm">Нужно проверить результат предыдущей попытки. Повторная заявка не создаётся.</p>
      <ProcurementDeliveryDialogActions><button type="button" disabled={busy} onClick={() => act('recover')} className="mt-2 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">{busy ? 'Проверяем…' : 'Проверить результат в 1С'}</button></ProcurementDeliveryDialogActions>
    </> : activeReview && summary ? <>
      <h3 className="text-sm font-semibold text-slate-950">Проверьте перед созданием</h3>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-slate-500">Получатель</dt><dd className="text-right font-medium">{summary.recipient}</dd><dt className="text-slate-500">Сумма</dt><dd className="text-right font-medium">{summary.amount.toLocaleString('ru-RU')} ₽</dd><dt className="text-slate-500">Касса</dt><dd className="text-right font-medium">{summary.cashbox}</dd><dt className="text-slate-500">Отчитаться до</dt><dd className="text-right font-medium">{summary.reportDate.split('-').reverse().join('.')}</dd><dt className="text-slate-500">Статус в 1С</dt><dd className="text-right font-medium">К оплате</dd></dl>
      <p className="mt-3 text-sm text-slate-600">{state.cashboxShift?.employee} · {cashboxShiftLabel(state.cashboxShift)}</p>
      {cashboxShiftWarning(state.cashboxShift) ? <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{cashboxShiftWarning(state.cashboxShift)}</p> : null}
      <p className="my-3 text-xs text-slate-500">{summary.organization} · проверено в 1С. Заявка ещё не создана.</p>
      {summary.funding.unallocated_count > 0 || summary.funding.other_review_count > 0 ? <ProcurementDeliveryFundingNotice beforeCreate /> : null}
      <p className="mt-1 text-xs text-slate-500">В кассе {summary.funding.cash_balance.toLocaleString('ru-RU')} ₽ · по её заявкам к выдаче {summary.funding.allocated_pending.toLocaleString('ru-RU')} ₽</p>
      <ProcurementDeliveryDialogActions><div className="flex flex-wrap items-center justify-end gap-2"><button type="button" disabled={busy} onClick={() => setCancelled(true)} className="min-h-11 px-3 text-sm">Изменить данные</button><button type="button" disabled={busy} onClick={() => act('confirm')} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Проверяем и создаём…' : 'Создать заявку к оплате'}</button></div></ProcurementDeliveryDialogActions>
    </> : <div className="space-y-2"><label className="block text-xs font-semibold text-slate-600">Отчитаться до<input type="date" aria-label="Отчитаться до" aria-describedby="delivery-report-hint" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3 text-sm" /></label>
      <p id="delivery-report-hint" className="text-xs text-slate-500">{!reportDate ? 'Укажите срок отчёта, чтобы продолжить.' : 'Сначала проверка в 1С, затем ваше подтверждение.'}</p>
      <ProcurementDeliveryDialogActions><button type="button" disabled={busy || !ready || !cashboxRef || !reportDate} aria-describedby="delivery-report-hint" onClick={() => act('preview')} className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Проверяем в 1С…' : 'Проверить заявку'}</button></ProcurementDeliveryDialogActions>
    </div>}


    {!ready && !awaiting && state.state !== 'committed' ? <p className="mt-2 text-xs text-amber-800">Нужны сумма запроса Астемира и касса, в которой её хватает с учётом назначенных выплат.</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-amber-800">{error}</p> : null}
  </div>;
}
