'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './EmployeeUnfinishedDayCard.module.css';

/** Approved previous-day presentation; the caller retains the existing completion action. */
export function EmployeeUnfinishedDayCard({ dateLabel, startLabel, onOpen }: { dateLabel: string; startLabel: string; onOpen: () => void }) {
  const icon = useRef<HTMLSpanElement>(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    if (!icon.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let inView = false;
    const begin = () => {
      if (!inView || document.visibilityState !== 'visible') return;
      setAnimated(true);
      observer.disconnect();
      document.removeEventListener('visibilitychange', begin);
    };
    const observer = new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      begin();
    });
    observer.observe(icon.current);
    document.addEventListener('visibilitychange', begin);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', begin); };
  }, []);
  return <section className={styles.card} aria-label='Предыдущий день не завершён'>
    <div className={styles.top}>
      <span ref={icon} className={styles.icon} aria-hidden='true' data-sunset-motion={animated ? 'started' : 'idle'}>
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M12 10V2m4 4-4 4-4-4'/>
          <g className={`${styles.sun} ${animated ? styles.moving : ''}`}>
            <path d='m4.93 10.93 1.41 1.41m12.73-1.41-1.41 1.41M16 18a4 4 0 0 0-8 0'/>
          </g>
          <path d='M2 18h2m16 0h2M22 22H2'/>
        </svg>
      </span>
      <div className={styles.facts}>
        <h2>Предыдущий день не завершён</h2>
        <p>{dateLabel} · Начало {startLabel}</p>
      </div>
    </div>
    <button type='button' className={`employee-material-primary-action ${styles.action}`} aria-haspopup='dialog' onClick={onOpen}>Завершить день</button>
  </section>;
}
