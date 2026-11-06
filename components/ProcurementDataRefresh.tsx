'use client';
import { procurementMobileFreshness } from '@/lib/procurement-mobile-view';

import { useCallback, useEffect, useRef, useTransition, useSyncExternalStore } from 'react';
import {createPortal} from 'react-dom';
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
  mobileSummary = false,
  unavailable = false,
  desktopTarget = null,
}: {
  checkedAt: string;
  label?: string;
  intervalMs?: number;
  refreshing?: boolean;
  pauseWhileDialogOpen?: boolean;
  compact?: boolean;
  mobileSummary?: boolean;
  unavailable?: boolean;
  desktopTarget?: HTMLElement|null;
}) {
  const wide=useSyncExternalStore(subscribeDesktop,desktopSnapshot,()=>false);
  const inToolbar=wide&&desktopTarget!==null;
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

  const shortStamp=checkedAt?new Date(checkedAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).replace(/ г\./,''):'данные недоступны';
  const button=(
    <button
      type='button'
      onClick={() => refresh(true)}
      disabled={isPending || refreshing}
      className={compact||inToolbar
        ? 'inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-left text-xs text-slate-600 transition hover:bg-white/70 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#a66c43] disabled:cursor-wait disabled:opacity-70'
        : 'admin-material-control procurement-data-refresh inline-flex min-h-9 self-start items-center gap-2 rounded-xl bg-white px-3 py-2 text-left text-xs font-semibold text-slate-500 transition hover:text-slate-800 disabled:cursor-wait disabled:opacity-70 sm:self-auto'}
      title={checkedAt ? `${label}. Данные на ${new Date(checkedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК. Обновить список` : 'Обновить список'}
    >
      <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isPending || refreshing ? 'animate-spin' : ''}`} />
      {inToolbar?<span>{isPending||refreshing?'Обновляем 1С…':unavailable?'1С · недоступно':(label.startsWith('Последняя')?'1С · последняя сверка ':'1С · ')+shortStamp}</span>:<>
      <span className={mobileSummary ? 'hidden sm:inline' : undefined}>
        {label}: {checkedAt ? new Date(checkedAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', ...(compact ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } as const : {}) }) : 'данные недоступны'}
      </span>
      {mobileSummary && <span className='sm:hidden'>{procurementMobileFreshness(checkedAt, new Date(), isPending || refreshing, unavailable)}</span>}
      </>}
    </button>
  );
  return inToolbar?createPortal(button,desktopTarget!):button;
}

const subscribeDesktop=(notify:()=>void)=>{const q=window.matchMedia('(min-width:901px)');q.addEventListener('change',notify);return()=>q.removeEventListener('change',notify);};
const desktopSnapshot=()=>window.matchMedia('(min-width:901px)').matches;
