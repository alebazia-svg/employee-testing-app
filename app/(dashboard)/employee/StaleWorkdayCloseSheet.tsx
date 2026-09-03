'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const reasons = [
  { code: 'forgot_close', label: 'Забыл закрыть смену' },
  { code: 'left_early', label: 'Ушёл раньше' },
  { code: 'no_internet', label: 'Не было интернета' },
  { code: 'portal_unavailable', label: 'Портал не открывался' },
  { code: 'other', label: 'Другое' },
] as const;

export function StaleWorkdayCloseSheet(props: {
  open: boolean;
  shiftLabel: string;
  reason: string;
  comment: string;
  saving: boolean;
  onReasonChange: (reason: string) => void;
  onCommentChange: (comment: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className='fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px]' role='dialog' aria-modal='true' aria-label='Закрыть предыдущую смену' onClick={props.onClose}>
      <div className='employee-material-sheet max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5' onClick={(event) => event.stopPropagation()}>
        <div className='mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300' aria-hidden='true' />
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='text-xs font-black uppercase tracking-[0.14em] text-amber-700'>Предыдущий рабочий день</p>
            <h2 className='mt-1 text-2xl font-black leading-tight text-slate-950'>Закройте предыдущую смену</h2>
            <p className='mt-1 text-sm font-semibold leading-snug text-slate-500'>Выберите причину.</p>
          </div>
          <button type='button' onClick={props.onClose} className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600' aria-label='Закрыть'>
            <X className='h-5 w-5' />
          </button>
        </div>
        <div className='mt-5 grid gap-3'>
          <div className='rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-amber-100'>
            <div className='flex items-center justify-between gap-3'><span className='text-xs font-extrabold text-amber-800'>Смена</span><span className='text-sm font-black text-slate-950'>{props.shiftLabel || 'Предыдущая'}</span></div>
            <div className='mt-2 flex items-center justify-between gap-3 border-t border-amber-200/70 pt-2'><span className='text-xs font-extrabold text-amber-800'>Статус</span><span className='text-sm font-black text-amber-800'>Не закрыта</span></div>
          </div>
          <fieldset className='employee-material-form rounded-xl p-3'>
            <legend className='px-1 text-sm font-extrabold text-slate-800'>Причина</legend>
            <div className='mt-1 flex flex-wrap gap-2'>
              {reasons.map((reason) => (
                <button key={reason.code} type='button' onClick={() => props.onReasonChange(reason.code)} className={cn('min-h-10 rounded-full px-3 text-xs font-extrabold ring-1 transition', props.reason === reason.code ? 'bg-amber-100 text-amber-950 ring-amber-300' : 'bg-white text-slate-600 ring-slate-200')}>{reason.label}</button>
              ))}
            </div>
            {props.reason === 'other' && <textarea value={props.comment} onChange={(event) => props.onCommentChange(event.target.value)} maxLength={1000} rows={2} className='mt-3 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100' placeholder='Коротко опишите причину' />}
          </fieldset>
          <Button type='button' className='employee-material-green-action h-14 w-full rounded-xl text-base font-black' disabled={props.saving || !props.reason || (props.reason === 'other' && !props.comment.trim())} onClick={props.onSubmit}>
            {props.saving ? 'Закрываем…' : 'Закрыть предыдущую смену'}
          </Button>
        </div>
      </div>
    </div>
  );
}
