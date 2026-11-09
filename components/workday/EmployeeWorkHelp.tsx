'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CircleHelp } from 'lucide-react';
import { auditExperience, experienceAttempt, ExperienceShown } from '../EmployeeExperienceAudit';
import { useEmployeeScreenLayer } from '../EmployeeScreenObservation';
import { HelpSheet, type HelpCloseReason } from './EmployeeHelpSheet';
import { useAppSetupProposal } from './EmployeeAppSetupContext';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import { startVisibleSync } from '@/lib/visible-sync';
import { scheduleCalendarHref } from '@/lib/schedule-near-reminder';
import { WORK_HELP_VERSION, type WorkHelpSnapshot } from '@/lib/employee-work-help';
import styles from './EmployeeWorkHelp.module.css';

type Help = { open: () => void };
const AUTOMATIC_GUIDE = false;
const Context = createContext<Help | null>(null);

/** One shared guide and server-confirmed daily acknowledgement across mobile tabs. */
export function EmployeeWorkHelpProvider({ department, enabled = true, attendanceOnly = department === 'procurement', newGuidePreview = true, children }: { department: string; enabled?: boolean; attendanceOnly?: boolean; newGuidePreview?: boolean; children: ReactNode }) {
  const preview = useEmployeePreview();
  const setup = useAppSetupProposal();
  const previewRequest = preview?.request;
  const observed=preview?.deviceSnapshot?.connections.find(c=>c.id===preview.deviceSnapshot?.selectedId);
  const observedGuide=preview?.followScreen&&observed?.live&&observed.runtime?.screen?.dialog==='guide';
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WorkHelpSnapshot | null>(null);
  const [mode, setMode] = useState<'manual' | 'automatic' | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const guideAttempt = useRef(''), guideShown = useRef(false);
  const attempted = useRef(false), flight = useRef<AbortController | null>(null), revision = useRef(0);
  const modeRef = useRef(mode); modeRef.current = mode;
  const refresh = useCallback(async (force = false) => {
    if (!enabled || flight.current && !force) return;
    flight.current?.abort();
    const before = revision.current;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    flight.current = controller;
    try {
      const response = await (previewRequest ?? fetch)('/api/employee/work-help', { cache: 'no-store', signal: controller.signal });
      const data = response.ok ? await response.json() : null;
      if (!data || data.version !== WORK_HELP_VERSION || !Array.isArray(data.missingDates) || typeof data.due !== 'boolean') return;
      if (before === revision.current) {
        setSnapshot(data);
        if (!data.due && modeRef.current === 'automatic') { if(!preview && guideShown.current)auditExperience({target:'guide',stage:'replaced',attemptId:guideAttempt.current}); setMode(null); }
      }
    } catch { /* Unknown availability is not a new employee obligation. */ }
    finally { clearTimeout(timer); if (flight.current === controller) flight.current = null; }
  }, [enabled, previewRequest]);
  useEffect(() => {
    if (!enabled) return;
    const stop = startVisibleSync(() => refresh(), 60000);
    const sourceChanged = () => { revision.current++; void refresh(true); };
    const storageChanged = (event: StorageEvent) => { if (event.key === 'mobo-work-help-refresh') sourceChanged(); };
    const returned = () => { if (document.visibilityState === 'hidden') attempted.current = false; };
    window.addEventListener('mobo:attention-refresh', sourceChanged);
    window.addEventListener('storage', storageChanged);
    document.addEventListener('visibilitychange', returned);
    return () => { stop(); revision.current++; flight.current?.abort(); flight.current = null; window.removeEventListener('mobo:attention-refresh', sourceChanged); window.removeEventListener('storage', storageChanged); document.removeEventListener('visibilitychange', returned); };
  }, [enabled, refresh]);
  useEffect(() => {
    // Approved 2026-11-08: the guide no longer opens by itself; a missing schedule is
    // asked with the weekly sheet instead. The guide stays available from «?».
    if (!AUTOMATIC_GUIDE) return;
    if (preview?.followScreen || !enabled || !snapshot?.due || setup?.state === 'safari' || setup?.state === 'checking') return;
    const tryOpen = () => {
      if (attempted.current || modeRef.current || document.visibilityState !== 'visible' || !window.matchMedia('(max-width: 767px)').matches) return;
      if (document.querySelector('dialog[open], [role=dialog][aria-modal=true]') || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName ?? '')) return;
      attempted.current = true; guideAttempt.current=experienceAttempt();guideShown.current=false; setError(''); setMode('automatic');
    };
    tryOpen();
    const observer = new MutationObserver(tryOpen); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', tryOpen);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', tryOpen); };
  }, [enabled, snapshot, setup?.state,preview?.followScreen]);
  useEmployeeScreenLayer(mode ? {dialog:'guide',guideMode:mode,guideError:!!error,guideBusy:busy,guideReason:snapshot?.qualifier==='Сегодня и завтра не заполнены'?'both':snapshot?.qualifier==='Сегодня не заполнен'?'today':snapshot?.qualifier==='Завтра не заполнен'?'tomorrow':'none'}:null,90);
  useEffect(()=>{
    if(preview||!mode)return;
    const visibility=()=>{if(guideShown.current)auditExperience({target:'guide',stage:document.visibilityState==='visible'?'returned':'hidden',attemptId:guideAttempt.current});};
    const pageLeft=()=>{if(guideShown.current)auditExperience({target:'guide',stage:'page_left',attemptId:guideAttempt.current});};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pageLeft);return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pageLeft);if(modeRef.current&&guideShown.current)auditExperience({target:'guide',stage:'interrupted',attemptId:guideAttempt.current});};
  },[mode,Boolean(preview)]);
  const open = useCallback(() => { preview?.setFollowScreen(false); guideAttempt.current=experienceAttempt();guideShown.current=false; attempted.current = true; setError(''); setMode('manual'); }, [preview?.setFollowScreen]);
  const close = (reason:HelpCloseReason='button') => { if(preview?.followScreen){preview.setFollowScreen(false);setMode(null);return;} if (!busy) {if(!preview && guideShown.current)auditExperience({target:'guide',stage:({button:'close_button',outside:'close_outside',swipe:'close_swipe',escape:'close_escape'} as const)[reason],attemptId:guideAttempt.current});setMode(null);} };
  const acknowledge = async () => {
    if (preview) { preview.blocked();preview.setFollowScreen(false); setMode(null); return; }
    if (busy) return;
    auditExperience({target:'guide',stage:'acknowledge_clicked',attemptId:guideAttempt.current});
    setBusy(true); setError('');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await (previewRequest ?? fetch)('/api/employee/work-help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: WORK_HELP_VERSION }), signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.recorded !== true || !data.acknowledgedAt || data.version !== WORK_HELP_VERSION) throw Error();
      revision.current++; setSnapshot(data); setMode(null);
      try { localStorage.setItem('mobo-work-help-refresh', String(Date.now())); } catch { /* Only a cross-tab refresh signal; the acknowledgement is on the server. */ }
    } catch { auditExperience({target:'guide',stage:'acknowledge_failed',attemptId:guideAttempt.current});setError('Не удалось сохранить подтверждение. Попробуйте ещё раз.'); }
    finally { clearTimeout(timer); setBusy(false); }
  };
  const goToSchedule = () => {
    if (!snapshot?.missingDates.length || busy) return;
    if(!preview)auditExperience({target:'guide',stage:'schedule_clicked',attemptId:guideAttempt.current});
    setMode(null);
    const date = snapshot.missingDates[0], edit = snapshot.missingDates.length === 1;
    if (document.getElementById('pwa-work-help-target')) requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('mobo:schedule-open', { detail: { date, edit, source: 'work-help' } })));
    else { const target = scheduleCalendarHref(date, edit); if (preview) { const query = new URL(target,'https://preview.invalid').searchParams; const destination = new URL(preview.href('/employee?tab=schedule'),window.location.origin); query.forEach((value,key)=>{if(key!=='tab')destination.searchParams.set(key,value);}); router.push(destination.pathname+destination.search); } else router.push(target); }
  };
  const displayMode=preview?.followScreen ? (observedGuide?observed!.runtime!.screen!.guideMode||'manual':null) : mode;
  const displayError=preview?.followScreen&&observedGuide ? observed?.runtime?.screen?.guideError?'Не удалось сохранить подтверждение. Попробуйте ещё раз.':'' : error;
  const displayBusy=preview?.followScreen&&observedGuide ? observed?.runtime?.screen?.guideBusy : busy;
  const displayQualifier=preview?.followScreen&&observedGuide ? ({both:'Сегодня и завтра не заполнены',today:'Сегодня не заполнен',tomorrow:'Завтра не заполнен',none:''}[observed?.runtime?.screen?.guideReason||'none']) : snapshot?.qualifier;
  return <Context.Provider value={enabled ? { open } : null}>{children}
    {enabled && displayMode && <HelpSheet title={newGuidePreview ? 'Работа в приложении' : 'Как пользоваться приложением'} close={close}>
      {!preview && <ExperienceShown context={{target:'guide',stage:mode==='automatic'?'automatic_shown':'manual_shown',attemptId:guideAttempt.current}} onShown={()=>{guideShown.current=true;}}/>}
      {displayMode === 'automatic' && displayQualifier ? <p className={styles.reason}>{displayQualifier}. График нужен, чтобы знать, кто выйдет на работу.</p> : null}
      <ol className={styles.steps}>
        <li><div><strong>График</strong><p>{newGuidePreview ? 'План рабочих дней и выходных. Заполняйте заранее — на завтра, неделю или дольше — и обновляйте при изменении планов.' : 'График — план работы отдела, выходных и замен, а не отметка прихода. Заполнять его нужно заранее и обновлять при изменении планов.'}</p></div></li>
        <li><div><strong>{newGuidePreview ? 'QR-код' : 'Приход'}</strong><p>{newGuidePreview ? 'Подтверждает присутствие на работе и фиксирует время начала дня. Сканируйте при приходе.' : 'QR-код фиксирует присутствие и время начала работы. Сканировать его нужно при приходе.'}</p></div></li>
        {!attendanceOnly && <li><div><strong>Проверки кассы</strong><p>{newGuidePreview ? 'В указанное время каждой проверки пересчитайте деньги и введите остаток для сверки с 1С.' : 'Плановая сверка наличных с 1С. Каждую проверку нужно выполнять в указанное время: пересчитать деньги и ввести остаток.'}</p></div></li>}
        <li><div><strong>{attendanceOnly ? 'Окончание работы' : 'Сдача смены'}</strong><p>{attendanceOnly ? (newGuidePreview ? 'Перед уходом завершите день в приложении для учёта отработанного времени.' : 'Для учёта фактически отработанного времени. Завершать день в приложении нужно перед уходом.') : 'Итоговая сверка кассы и подтверждение остатков на конец смены.'}</p></div></li>
      </ol>
      {displayError && <p role='alert' className={styles.error}>{displayError}</p>}
      <button type='button' className={`employee-material-primary-action ${styles.understood}`} disabled={displayBusy} onClick={() => void acknowledge()}>{displayBusy ? 'Сохранение…' : 'Понятно'}</button>
      {!!snapshot?.missingDates.length && <button type='button' className={styles.scheduleAction} disabled={busy} onClick={goToSchedule}>{snapshot.missingDates.length === 1 ? 'Отметить день в графике' : 'Заполнить график'}</button>}
    </HelpSheet>}
  </Context.Provider>;
}

export function EmployeeWorkHelpButton() {
  const help = useContext(Context);
  if (!help) return null;
  return <button type='button' className={`employee-material-header-action ${styles.helpButton}`} aria-label='Справка' title='Справка' aria-haspopup='dialog' onClick={help.open}><CircleHelp size={21} strokeWidth={1.7} aria-hidden='true'/></button>;
}
