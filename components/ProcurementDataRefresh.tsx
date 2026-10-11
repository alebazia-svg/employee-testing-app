'use client';

import { useCallback, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

const refreshIntervalMs = 120_000;
const resumeRefreshThresholdMs = 30_000;

export function ProcurementDataRefresh({
  checkedAt,
  label = 'Данные из 1С',
  intervalMs = refreshIntervalMs,
  refreshing = false,
  pauseWhileDialogOpen = false,
  compact = false,
}: {
  checkedAt: string;
  label?: string;
  intervalMs?: number;
  refreshing?: boolean;
  pauseWhileDialogOpen?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const lastRefreshRequestRef = useRef(Date.now());

  const refresh = useCallback((force = false) => {
    if (pauseWhileDialogOpen && document.querySelector('dialog[open]')) return;
    if (!force && document.visibilityState !== 'visible') return;
    if (refreshing || isPending) return;
    const now = Date.now();
    if (!force && now - lastRefreshRequestRef.current < resumeRefreshThresholdMs) return;
    lastRefreshRequestRef.current = now;
    startTransition(() => router.refresh());
  }, [router, refreshing, isPending, pauseWhileDialogOpen]);

  useEffect(() => {
    const refreshWhenVisible = () => refresh(false);
    const timer = window.setInterval(refreshWhenVisible, intervalMs);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('pageshow', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('pageshow', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh, intervalMs]);

  return (
    <button
      type='button'
      onClick={() => refresh(true)}
      disabled={isPending || refreshing}
      className={compact
        ? 'inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-xs text-slate-600 transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a66c43] disabled:cursor-wait disabled:opacity-70'
        : 'admin-material-control procurement-data-refresh inline-flex min-h-9 self-start items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:text-slate-800 disabled:cursor-wait disabled:opacity-70 sm:self-auto'}
      title={checkedAt ? `Данные на ${new Date(checkedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК. Обновить список` : 'Обновить список'}
    >
      <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isPending || refreshing ? 'animate-spin' : ''}`} />
      <span>
        {label}: {checkedAt ? new Date(checkedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', ...(compact ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } as const : {}) }) : 'данные недоступны'}
      </span>
    </button>
  );
}
