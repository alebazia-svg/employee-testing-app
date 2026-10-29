'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const reasons = [
  { code: 'forgot_close', label: 'Забыл закрыть' },
  { code: 'left_early', label: 'Ушёл раньше' },
  { code: 'no_internet', label: 'Нет интернета' },
  { code: 'portal_unavailable', label: 'Сбой портала' },
  { code: 'other', label: 'Другое' },
] as const;

export function StaleWorkdayCloseSheet(props: {
  open: boolean;
  shiftLabel: string;
  reason: string;
  comment: string;
  saving: boolean;
  actualEnd?: { value: string; min: string; max: string; error?: string; onChange: (value: string) => void };
  onReasonChange: (reason: string) => void;
  onCommentChange: (comment: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!props.open) return null;
  return (
    <div className='employee-workday-sheet-overlay fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px]' role='dialog' aria-modal='true' aria-label='Закрыть предыдущую смену' onClick={props.onClose}>
      <div className='employee-material-sheet max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[28px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5' onClick={(event) => event.stopPropagation()}>
        <div className='mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300' aria-hidden='true' />
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-2xl font-black leading-tight text-slate-950'>{props.actualEnd ? 'Предыдущий рабочий день' : 'Предыдущая смена'}</h2>
            <p className='mt-2 text-sm font-semibold leading-snug text-slate-500'>
              {props.shiftLabel && <>{props.shiftLabel} · </>}<span className='text-amber-800'>Не закрыта</span>
            </p>
          </div>
          <button type='button' onClick={props.onClose} className='employee-material-sheet-close flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600' aria-label='Закрыть'>
            <X className='h-5 w-5' />
          </button>
        </div>
        <div className='mt-5 grid gap-3'>
          {props.actualEnd && <label className='grid gap-2 text-sm font-bold text-slate-800'>Когда фактически закончили работу? (МСК)
            <input type='datetime-local' required value={props.actualEnd.value} min={props.actualEnd.min} max={props.actualEnd.max} onInput={event => props.actualEnd?.onChange(event.currentTarget.value)} onChange={event => props.actualEnd?.onChange(event.target.value)} className='h-12 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-base' />
            <span className='text-xs font-medium text-slate-500'>Укажите реальное окончание. День не закрывается автоматически.</span>
            {props.actualEnd.error && <span role='alert' className='text-sm text-red-700'>{props.actualEnd.error}</span>}
          </label>}
          <fieldset className='employee-material-form rounded-xl p-3'>
            <legend className='px-1 text-sm font-extrabold text-slate-800'>Почему не завершили день?</legend>
            <div className='mt-1 grid grid-cols-2 gap-2'>
              {reasons.map((reason) => (
                <button key={reason.code} type='button' aria-pressed={props.reason === reason.code} onClick={() => props.onReasonChange(reason.code)} className={cn('employee-material-reason-choice flex min-h-12 min-w-0 items-center justify-center rounded-xl px-2 text-center text-sm font-bold leading-tight ring-1 transition', reason.code === 'other' && 'col-span-2', props.reason === reason.code ? 'is-selected bg-blue-50 text-slate-900 ring-blue-300' : 'bg-white text-slate-600 ring-slate-200')}>{reason.label}</button>
              ))}
            </div>
            {props.reason === 'other' && <textarea value={props.comment} onChange={(event) => props.onCommentChange(event.target.value)} maxLength={1000} rows={2} className='mt-3 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100' placeholder='Коротко опишите причину' />}
          </fieldset>
          <Button type='button' className='employee-material-green-action h-14 w-full rounded-xl text-base font-black' disabled={props.saving || Boolean(props.actualEnd && (!props.actualEnd.value || props.actualEnd.error)) || !props.reason || (props.reason === 'other' && !props.comment.trim())} onClick={props.onSubmit}>
            {props.saving ? 'Сохраняем…' : props.actualEnd ? 'Сохранить окончание дня' : 'Закрыть смену'}
          </Button>
        </div>
      </div>
    </div>
  );
}
