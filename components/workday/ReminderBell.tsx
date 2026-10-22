import styles from './ReminderBell.module.css';

/** Action-only visual; no notification side effects. */
export function ReminderBell() {
  return <svg aria-hidden='true' className={styles.icon} width='38' height='34' viewBox='-7 -3 38 30' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
    <g className={styles.bell}>
      <path fill='currentColor' d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' />
      <path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />
    </g>
    <g className={styles.signals} strokeWidth='1.35'>
      <path d='M-2 5 -4 8 -2 11 -4 14' />
      <path d='M26 5 28 8 26 11 28 14' />
    </g>
  </svg>;
}
