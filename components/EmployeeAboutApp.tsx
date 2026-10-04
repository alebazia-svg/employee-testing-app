'use client';

import { useEffect, useLayoutEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getReleaseInfo } from '@/lib/release-info';

export function EmployeeAboutApp({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 16, width: 288 });
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelId = useId();
  const { version, date, preview } = getReleaseInfo();
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const width = Math.min(280, viewportWidth - 32);
      const left = Math.max(16, Math.min(rect.left, viewportWidth - width - 16));
      setPosition({ width, left, top: rect.bottom + 8 });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && !panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);

  return <>
    <div className='pwa-composition-only pwa-composition-brand relative' style={{ display: 'none', content: 'normal', filter: 'none' }}>
      {children}
      <button ref={trigger} type='button' aria-label='О приложении MOBO'
        title='О приложении' aria-expanded={open} aria-controls={open ? panelId : undefined}
        className='absolute -inset-[5px] min-h-11 min-w-11 rounded-lg bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300'
        onClick={() => setOpen(value => !value)} />
    </div>
    {open && createPortal(
      <section ref={panel} id={panelId} role='region' aria-labelledby={titleId}
        style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }}
        className='fixed z-[120] overflow-y-auto rounded-3xl border border-[#44494f] bg-[#25292e] p-4 text-[#fafaf8] shadow-[0_8px_30px_#171b203d]'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 id={titleId} className='text-base font-bold'>О приложении</h2>
            <p className='mt-1 text-xs text-[#c2c6cb]'>MOBO · {preview ? 'тестовая сборка' : 'приложение сотрудника'}</p>
          </div>
          <button ref={closeButton} type='button' aria-label='Закрыть' onClick={dismiss}
            className='-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#363b42] text-[#f1f2f3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e4ad82]'>
            <X size={18} aria-hidden='true' />
          </button>
        </div>
        <dl className='mt-3 space-y-2 border-t border-[#44494f] pt-3 text-sm'>
          <div className='flex flex-wrap justify-between gap-x-3 gap-y-1'><dt className='text-[#c2c6cb]'>Версия</dt><dd className='font-semibold'>{version}</dd></div>
          <div className='flex flex-wrap justify-between gap-x-3 gap-y-1'><dt className='text-[#c2c6cb]'>Сборка</dt><dd className='font-medium'>{date ? `${date} МСК` : 'Дата не определена'}</dd></div>
        </dl>
      </section>, document.body,
    )}
  </>;
}
