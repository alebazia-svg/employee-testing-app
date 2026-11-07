'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './EmployeeAppSetupProposal.module.css';

export function HelpSheet({ title, children, close, lockScroll = true }: { title: string; children: ReactNode; close: () => void; lockScroll?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const start = useRef<number | null>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const overflow = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';
    node.showModal();
    return () => { node.close(); if (lockScroll) document.body.style.overflow = overflow; };
  }, [lockScroll]);
  return <dialog ref={dialog} className={`employee-material-sheet ${styles.sheet}`} aria-labelledby='app-help-title'
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }}>
    <div className={styles.handle} aria-hidden='true' onPointerDown={event => {
      start.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerUp={event => { if (start.current !== null && event.clientY - start.current > 65) close(); start.current = null; }}><span /></div>
    <header className={styles.sheetHeading}><h2 id='app-help-title'>{title}</h2><button type='button' className='employee-material-sheet-close' aria-label='Закрыть' onClick={close}><X size={20}/></button></header>
    <div className={styles.sheetBody}>{children}</div>
  </dialog>;
}
