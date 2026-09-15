'use client';

import { BillListIcon as PremiumBillListIcon } from '@solar-icons/react/bold-duotone';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type EmployeeBlockingItem = { id: number; href: string; title: string; meta: string };

export function EmployeeCloseBlockedSheet({
  open,
  items,
  savedBalanceLabel,
  helpPending,
  onClose,
  onRequestHelp,
}: {
  open: boolean;
  items: EmployeeBlockingItem[];
  savedBalanceLabel: string;
  helpPending: boolean;
  onClose: () => void;
  onRequestHelp: () => void;
}) {
  if (!open || items.length === 0) return null;
  const first = items[0];

  return <div className='employee-workday-sheet-overlay fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] md:items-center md:p-6' role='dialog' aria-modal='true' aria-labelledby='close-blocked-title'>
    <section className='employee-material-sheet flex w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]'>
      <div className='mx-auto mt-3 h-1.5 w-12 rounded-full bg-slate-300' />
      <div className='flex items-start justify-between gap-3 px-5 pb-2 pt-4'>
        <div><h2 id='close-blocked-title' className='text-[22px] font-black leading-tight text-slate-950'>Смена не закрыта</h2><p className='mt-1 text-sm font-semibold text-slate-500'>{items.length === 1 ? 'Исправьте 1 задачу' : `Исправьте задачи: ${items.length}`}</p></div>
        <button type='button' onClick={onClose} className='employee-material-sheet-close flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600' aria-label='Закрыть'><X className='h-5 w-5' /></button>
      </div>
      <div className='px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2'>
        <p className='mb-3 rounded-2xl bg-[#edf2f7] px-3 py-2.5 text-xs font-bold leading-snug text-[#526779]'>{savedBalanceLabel} сохранён.</p>
        <div className='flex min-h-[72px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm'>
          <PremiumBillListIcon color='#9a5a13' secondaryColor='#f1ce91' secondaryOpacity={0.92} className='h-6 w-6 shrink-0' />
          <span className='min-w-0 flex-1'><span className='block text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#9a5a13]'>Блокирует закрытие</span><span className='mt-1 block text-sm font-black text-slate-950'>{first.title}</span><span className='block text-xs font-bold text-slate-500'>{first.meta}</span></span>
        </div>
        {items.length > 1 ? <p className='mt-2 text-center text-xs font-extrabold text-slate-500'>И ещё обязательных задач: {items.length - 1}</p> : null}
        <a href={first.href} className='employee-material-primary-action mt-4 flex h-14 w-full items-center justify-center rounded-2xl text-base font-black text-white shadow-sm'>Исправить чек</a>
        <Button type='button' disabled={helpPending} onClick={onRequestHelp} className='employee-material-secondary-action mt-2 h-12 w-full rounded-2xl text-sm font-extrabold'>{helpPending ? 'Администратор уведомлён' : 'Сообщить о проблеме'}</Button>
      </div>
    </section>
  </div>;
}
