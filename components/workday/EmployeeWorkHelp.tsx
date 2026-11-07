'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CircleHelp } from 'lucide-react';
import { HelpSheet } from './EmployeeHelpSheet';
import { useAppSetupProposal } from './EmployeeAppSetupContext';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import { startVisibleSync } from '@/lib/visible-sync';
import { scheduleCalendarHref } from '@/lib/schedule-near-reminder';
import { WORK_HELP_VERSION, type WorkHelpSnapshot } from '@/lib/employee-work-help';
import styles from './EmployeeWorkHelp.module.css';

type Help = { open: () => void };
const Context = createContext<Help | null>(null);

/** One shared guide and server-confirmed daily acknowledgement across mobile tabs. */
export function EmployeeWorkHelpProvider({ department, enabled = true, attendanceOnly = department === 'procurement', newGuidePreview = true, children }: { department: string; enabled?: boolean; attendanceOnly?: boolean; newGuidePreview?: boolean; children: ReactNode }) {
  const preview = useEmployeePreview();
  const setup = useAppSetupProposal();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WorkHelpSnapshot | null>(null);
  const [mode, setMode] = useState<'manual' | 'automatic' | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const attempted = useRef(false), flight = useRef<AbortController | null>(null), revision = useRef(0);
  const modeRef = useRef(mode); modeRef.current = mode;
  const refresh = useCallback(async (force = false) => {
    if (!enabled || preview || flight.current && !force) return;
    flight.current?.abort();
    const before = revision.current;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    flight.current = controller;
    try {
      const response = await fetch('/api/employee/work-help', { cache: 'no-store', signal: controller.signal });
      const data = response.ok ? await response.json() : null;
      if (!data || data.version !== WORK_HELP_VERSION || !Array.isArray(data.missingDates) || typeof data.due !== 'boolean') return;
      if (before === revision.current) {
        setSnapshot(data);
        if (!data.due && modeRef.current === 'automatic') setMode(null);
      }
    } catch { /* Unknown availability is not a new employee obligation. */ }
    finally { clearTimeout(timer); if (flight.current === controller) flight.current = null; }
  }, [enabled, preview]);
  useEffect(() => {
    if (!enabled || preview) return;
    const stop = startVisibleSync(() => refresh(), 60000);
    const sourceChanged = () => { revision.current++; void refresh(true); };
    const storageChanged = (event: StorageEvent) => { if (event.key === 'mobo-work-help-refresh') sourceChanged(); };
    const returned = () => { if (document.visibilityState === 'hidden') attempted.current = false; };
    window.addEventListener('mobo:attention-refresh', sourceChanged);
    window.addEventListener('storage', storageChanged);
    document.addEventListener('visibilitychange', returned);
    return () => { stop(); revision.current++; flight.current?.abort(); flight.current = null; window.removeEventListener('mobo:attention-refresh', sourceChanged); window.removeEventListener('storage', storageChanged); document.removeEventListener('visibilitychange', returned); };
  }, [enabled, preview, refresh]);
  useEffect(() => {
    if (!enabled || preview || !snapshot?.due || setup?.state === 'safari' || setup?.state === 'checking') return;
    const tryOpen = () => {
      if (attempted.current || modeRef.current || document.visibilityState !== 'visible' || !window.matchMedia('(max-width: 767px)').matches) return;
      if (document.querySelector('dialog[open], [role=dialog][aria-modal=true]') || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName ?? '')) return;
      attempted.current = true; setError(''); setMode('automatic');
    };
    tryOpen();
    const observer = new MutationObserver(tryOpen); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', tryOpen);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', tryOpen); };
  }, [enabled, preview, snapshot, setup?.state]);
  const open = useCallback(() => { attempted.current = true; setError(''); setMode('manual'); }, []);
  const close = () => { if (!busy) setMode(null); };
  const acknowledge = async () => {
    if (preview) { preview.blocked(); return; }
    if (busy) return;
    setBusy(true); setError('');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/employee/work-help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: WORK_HELP_VERSION }), signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.recorded !== true || !data.acknowledgedAt || data.version !== WORK_HELP_VERSION) throw Error();
      revision.current++; setSnapshot(data); setMode(null);
      try { localStorage.setItem('mobo-work-help-refresh', String(Date.now())); } catch { /* Only a cross-tab refresh signal; the acknowledgement is on the server. */ }
    } catch { setError('Не удалось сохранить подтверждение. Попробуйте ещё раз.'); }
    finally { clearTimeout(timer); setBusy(false); }
  };
  const goToSchedule = () => {
    if (!snapshot?.missingDates.length || busy) return;
    setMode(null);
    const date = snapshot.missingDates[0], edit = snapshot.missingDates.length === 1;
    if (document.getElementById('pwa-work-help-target')) requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('mobo:schedule-open', { detail: { date, edit, source: 'work-help' } })));
    else router.push(scheduleCalendarHref(date, edit));
  };
  return <Context.Provider value={enabled ? { open } : null}>{children}
    {enabled && mode && <HelpSheet title={newGuidePreview ? 'Работа в приложении' : 'Как пользоваться приложением'} close={close}>
      {mode === 'automatic' && snapshot?.missingDates.length ? <p className={styles.reason}>{snapshot.qualifier}. График нужен, чтобы знать, кто выйдет на работу.</p> : null}
      <ol className={styles.steps}>
        <li><div><strong>График</strong><p>{newGuidePreview ? 'План рабочих дней и выходных. Заполняйте заранее — на завтра, неделю или дольше — и обновляйте при изменении планов.' : 'График — план работы отдела, выходных и замен, а не отметка прихода. Заполнять его нужно заранее и обновлять при изменении планов.'}</p></div></li>
        <li><div><strong>{newGuidePreview ? 'QR-код' : 'Приход'}</strong><p>{newGuidePreview ? 'Подтверждает присутствие на работе и фиксирует время начала дня. Сканируйте при приходе.' : 'QR-код фиксирует присутствие и время начала работы. Сканировать его нужно при приходе.'}</p></div></li>
        {!attendanceOnly && <li><div><strong>Проверки кассы</strong><p>{newGuidePreview ? 'В указанное время каждой проверки пересчитайте деньги и введите остаток для сверки с 1С.' : 'Плановая сверка наличных с 1С. Каждую проверку нужно выполнять в указанное время: пересчитать деньги и ввести остаток.'}</p></div></li>}
        <li><div><strong>{attendanceOnly ? 'Окончание работы' : 'Сдача смены'}</strong><p>{attendanceOnly ? (newGuidePreview ? 'Перед уходом завершите день в приложении для учёта отработанного времени.' : 'Для учёта фактически отработанного времени. Завершать день в приложении нужно перед уходом.') : 'Итоговая сверка кассы и подтверждение остатков на конец смены.'}</p></div></li>
      </ol>
      {error && <p role='alert' className={styles.error}>{error}</p>}
      <button type='button' className={`employee-material-primary-action ${styles.understood}`} disabled={busy} onClick={() => void acknowledge()}>{busy ? 'Сохранение…' : 'Понятно'}</button>
      {!!snapshot?.missingDates.length && <button type='button' className={styles.scheduleAction} disabled={busy} onClick={goToSchedule}>{snapshot.missingDates.length === 1 ? 'Отметить день в графике' : 'Заполнить график'}</button>}
    </HelpSheet>}
  </Context.Provider>;
}

export function EmployeeWorkHelpButton() {
  const help = useContext(Context);
  if (!help) return null;
  return <button type='button' className={`employee-material-header-action ${styles.helpButton}`} aria-label='Справка' title='Справка' aria-haspopup='dialog' onClick={help.open}><CircleHelp size={21} strokeWidth={1.7} aria-hidden='true'/></button>;
}
