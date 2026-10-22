'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { startVisibleSync } from '@/lib/visible-sync';
import type { EmployeeAttentionItem } from '@/lib/employee-attention';
import { employeeActionReminder, type ReminderWorkday } from '@/lib/employee-action-reminder';
import { EmployeeNoticeIcon } from './EmployeeNoticeIcon';
import { employeeReminderIconKind } from '@/lib/employee-notice-icons';
import styles from './EmployeeActionReminder.module.css';
import { useCashIssue } from '@/app/(dashboard)/employee/CashIssueClient';
import { cashIssueCompactCopy } from '@/lib/procurement-cash-issue-policy';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';

type State = {
  action: ReturnType<typeof employeeActionReminder>; deferred: boolean; error: boolean;
  defer: () => void; refresh: () => Promise<void>; setView: (view: string) => void;
  publishWorkday: (value: ReminderWorkday) => void;
  publishAttention: (value: EmployeeAttentionItem[], failed: boolean) => void;
};
const Context = createContext<State | null>(null);

export function useActionReminderEnabled() {
  return useContext(Context) !== null;
}

function revealChecklist() {
  const card = document.getElementById('pwa-current-action');
  if (!card) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  if (document.activeElement === card) card.blur();
  if (reduced) return;
  card.getAnimations().filter(animation => animation.id === 'local-reminder-reveal').forEach(animation => animation.cancel());
  const animation = card.animate([
    { outline: '2px solid transparent', outlineOffset: '3px', offset: 0 },
    { outline: '2px solid #a77550', outlineOffset: '3px', offset: .15 },
    { outline: '2px solid #a77550', outlineOffset: '3px', offset: .65 },
    { outline: '2px solid transparent', outlineOffset: '3px', offset: 1 },
  ], { duration: 2000, easing: 'ease-in-out', iterations: 1 });
  animation.id = 'local-reminder-reveal';
}

/** Reuses authorized current-work reads, without notification-read writes. */
export function EmployeeActionReminderProvider({ children }: { children: ReactNode }) {
  const preview = useEmployeePreview();
  const requestRead = preview?.request ?? fetch;
  const cashIssue = useCashIssue();
  const pathname = usePathname();
  const [view, setView] = useState('day');
  const [workday, setWorkday] = useState<ReminderWorkday | null>(null);
  const [attention, setAttention] = useState<EmployeeAttentionItem[] | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [error, setError] = useState(false);
  const [attentionError, setAttentionError] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const workdayVersion = useRef(0), attentionVersion = useRef(0);
  const publishWorkday = useCallback((value: ReminderWorkday) => { workdayVersion.current++; setWorkday(value); }, []);
  const publishAttention = useCallback((value: EmployeeAttentionItem[], failed: boolean) => { attentionVersion.current++; if (!failed) setAttention(value); setAttentionError(failed); }, []);
  const payroll = pathname.includes('/payroll');
  const offDay = payroll || view === 'schedule' || view === 'payroll';
  const refresh = useCallback(async (forceAttention = false) => {
    if (abort.current) return;
    const controller = new AbortController(); abort.current = controller;
    const revision = workdayVersion.current, attentionRevision = attentionVersion.current;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 10000);
    try {
      const response = await requestRead('/api/employee/workday/today', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error();
      const snapshot = await response.json();
      if (!snapshot.shiftControl || !Array.isArray(snapshot.shiftControl.tasks)) throw Error();
      if (revision === workdayVersion.current) setWorkday(snapshot);
      // On Workday/Schedule the existing AttentionPanel supplies this snapshot.
      // Salary has no such panel, so read the same endpoint only there.
      if (payroll || forceAttention) {
        const response = await requestRead('/api/employee/workday-attention', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error();
        const snapshot = await response.json();
        if (!Array.isArray(snapshot.items)) throw Error();
        if (attentionRevision === attentionVersion.current) { setAttention(snapshot.items); setAttentionError(false); }
      }
      setError(false);
    } catch { if (timedOut || !controller.signal.aborted) setError(true); }
    finally { window.clearTimeout(timer); if (abort.current === controller) abort.current = null; }
  }, [payroll, requestRead]);
  useEffect(() => {
    if (!offDay) return;
    const stop = startVisibleSync(() => refresh(), 60000);
    return () => { stop(); abort.current?.abort(); abort.current = null; };
  }, [offDay, refresh]);
  useEffect(() => {
    const resume = () => { if (document.visibilityState === 'visible') setDeferred(false); };
    document.addEventListener('visibilitychange', resume);
    // iOS may restore a standalone window without changing visibilityState.
    const restore = () => setDeferred(false);
    window.addEventListener('focus', restore);
    window.addEventListener('pageshow', restore);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', restore);
      window.removeEventListener('pageshow', restore);
    };
  }, []);
  const request = cashIssue?.snapshot.request;
  const cashItem: EmployeeAttentionItem[] = request ? [{ id: `cash-issue:${request.ref}`, title: cashIssueCompactCopy(request).title, kind: 'cash_issue', state: 'action', status: '', priority: 0, date: request.checkedAt, detail: '' }] : [];
  const action = employeeActionReminder(workday, [...(attention ?? []).filter(item => item.kind !== 'cash_issue'), ...cashItem]);
  useEffect(() => { setDeferred(false); }, [action?.id]);
  return <Context.Provider value={{ action, deferred, error: error || attentionError, defer: () => setDeferred(true), refresh: () => refresh(true), setView, publishWorkday, publishAttention }}>{children}</Context.Provider>;
}

export function usePublishWorkdayReminder(value: ReminderWorkday) {
  const publish = useContext(Context)?.publishWorkday;
  useEffect(() => { publish?.(value); }, [publish, value.workDay, value.unfinishedWorkDay, value.shiftControl]);
}
export function usePublishAttentionReminder(items: EmployeeAttentionItem[], ready: boolean, failed = false) {
  const publish = useContext(Context)?.publishAttention;
  const signature = JSON.stringify(items);
  useEffect(() => { if (ready || failed) publish?.(JSON.parse(signature), failed); }, [publish, signature, ready, failed]);
}

export function EmployeeActionReminder({ view, onOpen }: { view: string; onOpen?: () => void }) {
  const state = useContext(Context);
  const preview = useEmployeePreview();
  const cashIssue = useCashIssue();
  const highlightedVisit = useRef(false);
  const setView = state?.setView;
  useEffect(() => { setView?.(view); }, [setView, view]);
  useEffect(() => {
    if (view !== 'actual-day') { highlightedVisit.current = false; return; }
    if (!state || state.action?.target !== 'checklist' || highlightedVisit.current) return;
    // Also applies to ordinary bottom-tab navigation, once per Workday visit.
    // Snapshot refreshes and form edits must not restart the animation.
    const frame = requestAnimationFrame(() => { revealChecklist(); highlightedVisit.current = true; });
    return () => cancelAnimationFrame(frame);
  }, [view, state?.action?.id, state?.action?.target]);
  if (!state || ['day', 'actual-day'].includes(view) || state.deferred) return null;
  // Source availability is not an employee task. Keep known real actions;
  // never turn a failed background read into a new scary action banner.
  const action = state.action;
  if (!action) return null;
  const href = preview ? `${preview.href('/employee')}${new URL(action.href, 'https://preview.invalid').search}${new URL(action.href, 'https://preview.invalid').hash}` : action.href;
  const open = () => {
    if (action.target === 'cash_issue') { cashIssue?.open(action.id.slice('cash-issue:'.length)); }
    else if (action.target === 'checklist') { onOpen?.(); }
    else {
      const url = new URL(action.href, window.location.origin);
      onOpen?.();
      requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('mobo:attention-open', { detail: { kind: url.searchParams.get('attention'), id: url.searchParams.get('item') } })));
    }
  };
  return <ActionReminderNotice title={action.title} icon={<EmployeeNoticeIcon kind={employeeReminderIconKind(action)} animated />} onOpen={onOpen || action.target === 'cash_issue' ? open : undefined} href={href} onDefer={state.defer} />;
}

/** Shared presentation: the isolated comparison uses the actual notice UI. */
export function ActionReminderNotice({ title, icon = <EmployeeNoticeIcon kind='notice' />, onOpen, href, onDefer }: {
  title: string; icon?: ReactNode; onOpen?: () => void; href?: string; onDefer: () => void;
}) {
  return <aside role='status' aria-label='Напоминание о задании' className={`${styles.notice} mb-2 flex min-h-12 min-w-0 items-center gap-1 rounded-xl px-2 text-slate-800`}>
    {icon}
    <p className='min-w-0 flex-1 text-sm font-semibold leading-snug'>{title}</p>
    {onOpen ? <button type='button' className={styles.open} onClick={onOpen}>Открыть</button> : <Link href={href!} className={styles.open}>Открыть</Link>}
    <button type='button' aria-label='Напомнить позже' title='Напомнить позже' className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600' onClick={onDefer}><X size={18} aria-hidden='true' /></button>
  </aside>;
}
