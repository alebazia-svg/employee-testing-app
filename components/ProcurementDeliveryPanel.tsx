'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProcurementDeliveryCash } from './ProcurementDeliveryCash';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import { DELIVERY_RESERVE, deliveryFresh } from '@/lib/procurement-delivery-policy';
import { startVisibleSync } from '@/lib/visible-sync';

export function ProcurementDeliveryPanel({ initial }: { initial: DeliveryView }) {
  const [view, setView] = useState(initial);
  const [pending, setPending] = useState<'GET' | 'POST' | null>(null);
  const [error, setError] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const lastRead = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const fresh = deliveryFresh(view.snapshot, now);
  const act = useCallback(async (method: 'GET' | 'POST') => {
    // Focus, pageshow and visibility events often arrive together.
    if (activeRequest.current || (method === 'GET' && Date.now() - lastRead.current < 10_000)) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    if (method === 'GET') lastRead.current = Date.now();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    setPending(method); setNow(Date.now());
    if (method === 'POST') setError('');
    try {
      const response = await fetch('/api/procurement/delivery', { method, cache: 'no-store', signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw Error('DELIVERY_UNAVAILABLE');
      if (activeRequest.current !== controller) return;
      setView(data); setNow(Date.now());
      setRefreshFailed(false);
      if (data.requestStateAvailable && data.requested) setError('');
    } catch {
      if (activeRequest.current !== controller) return;
      if (method === 'GET') setRefreshFailed(true);
      else setError('Не удалось подтвердить отправку. Проверим автоматически.');
    } finally {
      clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setPending(null);
      }
    }
  }, []);
  useEffect(() => {
    const refresh = () => act('GET');
    const stop = startVisibleSync(refresh, 60_000);
    window.addEventListener('online', refresh);
    return () => {
      stop();
      window.removeEventListener('online', refresh);
      const controller = activeRequest.current;
      activeRequest.current = null;
      controller?.abort();
      lastRead.current = 0;
    };
  }, [act]);
  const snapshot = fresh ? view.snapshot : { ...view.snapshot, reserveAdvice: undefined };
  return <ProcurementDeliveryCash snapshot={snapshot} reserveDetails={false}>
    {view.requested ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700" role="status">Запрос на пополнение отправлен</p>
      : <button type="button" disabled={pending !== null || refreshFailed || !fresh || !view.requestStateAvailable || view.snapshot.balance! >= DELIVERY_RESERVE.target}
        onClick={() => act('POST')} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{pending === 'POST' ? 'Подождите…' : 'Запросить пополнение'}</button>}
    {refreshFailed || !fresh || !view.requestStateAvailable ? <p role="status" className="mt-2 text-xs text-amber-800">{pending === 'GET' ? 'Обновляем данные…' : 'Данные временно недоступны. Обновим автоматически.'}</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
  </ProcurementDeliveryCash>;
}
