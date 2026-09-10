'use client';

import { useCallback, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

const refreshIntervalMs = 120_000;
const resumeRefreshThresholdMs = 30_000;

export function ProcurementDataRefresh({
  checkedAt,
  label = 'Данные из 1С',
}: {
  checkedAt: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastRefreshRequestRef = useRef(Date.now());

  const refresh = useCallback((force = false) => {
    if (!force && document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (!force && now - lastRefreshRequestRef.current < resumeRefreshThresholdMs) return;
    lastRefreshRequestRef.current = now;
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    const refreshWhenVisible = () => refresh(false);
    const timer = window.setInterval(refreshWhenVisible, refreshIntervalMs);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  return (
    <button
      type='button'
      onClick={() => refresh(true)}
      disabled={isPending}
      className='admin-material-control inline-flex min-h-9 items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:text-slate-800 disabled:cursor-wait disabled:opacity-70'
      title='Обновить данные сейчас'
    >
      <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isPending ? 'animate-spin' : ''}`} />
      <span>
        {label}: {checkedAt ? new Date(checkedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) : 'данные недоступны'}
      </span>
    </button>
  );
}
