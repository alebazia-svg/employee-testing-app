'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Bell, BellOff, CalendarDays, ChevronRight, Clock3, QrCode, Share, Smartphone, Sunset } from 'lucide-react';
import styles from './EmployeeAppSetupProposal.module.css';

import { EmployeeAppSetupContext as Context, useAppSetupProposal, type SetupProposalState } from './EmployeeAppSetupContext';
import { auditExperience, experienceAttempt, ExperienceShown } from '../EmployeeExperienceAudit';
import { useEmployeeScreenLayer } from '../EmployeeScreenObservation';
import { useEmployeePreview } from '../EmployeePreviewProvider';
import { HelpSheet } from './EmployeeHelpSheet';
export { HelpSheet } from './EmployeeHelpSheet';
export { useAppSetupProposal, type SetupProposalState } from './EmployeeAppSetupContext';

/** Presentation-only state, supplied exclusively by the isolated authenticated preview route. */
export function AppSetupProposalProvider({ initialState, currentFinish = false, eveningPreview = false, previousDayCardPreview = false, demoBusy = false, demoError = false, children }: { initialState: SetupProposalState; currentFinish?: boolean; eveningPreview?: boolean; previousDayCardPreview?: boolean; demoBusy?: boolean; demoError?: boolean; children: ReactNode }) {
  const [state, setState] = useState(initialState);
  return <Context.Provider value={{ state, finishProposal: !currentFinish, demo: true, isPhone: true, isIos: true, eveningPreview, previousDayCard: previousDayCardPreview, busy: demoBusy, error: demoError ? 'Не удалось подключить уведомления. Повторите попытку.' : undefined, enable: () => setState('ready') }}>{children}</Context.Provider>;
}


export function EmployeeAppSetupProposal({ compact = false }: { compact?: boolean }) {
  const proposal = useAppSetupProposal();
  const preview=useEmployeePreview(), attempt=useRef(experienceAttempt());
  const [help, setHelp] = useState<'settings' | null>(null);
  useEmployeeScreenLayer(help ? {dialog:'push_settings'}:null,80);
  const closeSettings=()=>{if(!preview&&!proposal?.demo)auditExperience({target:'push_setup',stage:'settings_close',attemptId:attempt.current});setHelp(null);};
  if (!proposal || proposal.state === 'ready' || proposal.state === 'checking') return null;
  const install = proposal.state === 'safari';
  const offline = proposal.state === 'offline';
  const unsupported = proposal.state === 'unsupported';
  const reconnect = proposal.state === 'reconnect';
  const iphoneHelp = proposal.isIos ?? proposal.isPhone !== false;
  const title = unsupported ? 'Уведомления недоступны на этом устройстве' : install ? 'Установите МОБО на телефон' : offline ? 'Проверка уведомлений после подключения' : reconnect ? 'Уведомления не подключены' : 'Включите уведомления';
  const description = unsupported ? 'Продолжайте работать в приложении. Подключить уведомления можно на поддерживаемом телефоне.' : install ? 'Открывайте с иконки на экране «Домой».' : offline ? 'Нет связи. Настройки не изменены.' : reconnect ? 'Разрешение есть. Подключение нужно повторить.' : 'Чтобы не пропускать задания и напоминания.';
  const label = proposal.state === 'denied' ? 'Как включить' : reconnect ? 'Подключить' : 'Включить';
  if (install) return <section className={`${styles.notice} ${styles.install}`} aria-label='Как добавить приложение на телефон'>
    <span className={styles.icon} aria-hidden='true'><Smartphone size={22}/></span>
    <div className={styles.copy}><h2>Добавьте МОБО на экран «Домой»</h2></div>
    <ol className={styles.installSteps}>
      <li><span>1</span><p>В Safari нажмите <strong>«Поделиться»</strong> <Share size={15} aria-label='Квадрат со стрелкой вверх'/>.</p></li>
      <li><span>2</span><p>Выберите <strong>«На экран Домой»</strong>.<small>Переключатель открытия как приложения оставьте включённым, если он есть.</small></p></li>
      <li><span>3</span><p>Нажмите <strong>«Добавить»</strong> и откройте МОБО с новой иконки.</p></li>
    </ol>
  </section>;
  return <>
    <section className={`${styles.notice} ${styles.notificationRow} ${compact ? styles.compact : ''}`} aria-label='Настройка уведомлений'>
      {!preview&&!proposal.demo&&<ExperienceShown context={{target:'push_setup',stage:'shown',attemptId:attempt.current}}/>}
      <span className={styles.icon} aria-hidden='true'>{install ? <Smartphone size={22}/> : proposal.state === 'denied' ? <BellOff size={22}/> : <Bell size={22}/>}</span>
      <div className={styles.copy}><h2>{title}</h2><p>{description}</p></div>
      {!offline && !unsupported && <button type='button' disabled={proposal.busy} className={`employee-material-secondary-action ${styles.action}`} onClick={() => proposal.state === 'denied' ? (()=>{if(!preview&&!proposal.demo)auditExperience({target:'push_setup',stage:'settings_open',attemptId:attempt.current});setHelp('settings');})() : proposal.enable()}>{proposal.busy ? 'Подключаем…' : label}<ChevronRight size={16} aria-hidden='true'/></button>}
      {proposal.error && !offline && <p role='alert' className={styles.connectionError}>{proposal.error}</p>}
    </section>
    {help === 'settings' && <HelpSheet title='Включите уведомления МОБО' close={closeSettings}>
      <p className={styles.lead}>{iphoneHelp ? 'Разрешите уведомления в настройках телефона.' : 'Уведомления запрещены в настройках браузера.'}</p>
      {iphoneHelp ? <ol className={styles.steps}>
        <li><span>1</span><div><strong>Откройте «Настройки» на телефоне</strong></div></li>
        <li><span>2</span><div><strong>Нажмите «Уведомления»</strong><p>В списке приложений выберите «МОБО».</p></div></li>
        <li><span>3</span><div><strong>Включите «Допуск уведомлений»</strong><p>После этого вернитесь в МОБО.</p></div></li>
      </ol> : <ol className={styles.steps}>
        <li><span>1</span><div><strong>Откройте настройки этого сайта</strong><p>Перейдите в «Уведомления».</p></div></li>
        <li><span>2</span><div><strong>Разрешите уведомления для МОБО</strong><p>Включите допуск уведомлений.</p></div></li>
        <li><span>3</span><div><strong>Вернитесь в МОБО</strong></div></li>
      </ol>}
      <button type='button' className={`employee-material-primary-action ${styles.done}`} onClick={closeSettings}>Понятно</button>
    </HelpSheet>}
  </>;
}

/** An end-of-day action, distinct from the check shown after confirmed completion. */
export function EmployeeFinishDayIcon({ animate = false }: { animate?: boolean }) {
  const id = useId().replace(/:/g, '');
  const root = useRef<HTMLSpanElement>(null);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    setMoving(false);
    if (!animate || !root.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && document.visibilityState === 'visible') { setMoving(true); observer.disconnect(); }
    });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [animate]);
  return <span ref={root} className={styles.finishMark} aria-hidden='true' data-evening-animation={moving || undefined}>
    <svg className={styles.finishIcon} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
      <defs><clipPath id={`sunset-${id}`}><path d='M0 0h24v18H0z'/></clipPath></defs>
      <path d='M12 10V2m4 4-4 4-4-4'/>
      <g clipPath={`url(#sunset-${id})`}><g className={moving ? styles.settingSun : undefined}>
        <path d='m4.93 10.93 1.41 1.41m12.73-1.41-1.41 1.41M16 18a4 4 0 0 0-8 0'/>
      </g></g>
      <path d='M2 18h2m16 0h2M22 22H2'/>
    </svg>
  </span>;
}
