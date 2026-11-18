import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function CashChecklistSheet({hidden,handle,audit,title,step,total,onClose,busy,children}:{hidden?:boolean;handle:ReactNode;audit?:ReactNode;title:string;step:number;total:number;onClose:()=>void;busy:boolean;children:ReactNode}){
  return (
        <div className='employee-workday-sheet-overlay fixed inset-0 z-[115] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] md:items-center md:p-6' role='dialog' aria-modal='true' aria-hidden={hidden} aria-labelledby='handover-sheet-title'>
          <div className='employee-material-sheet flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:max-h-[calc(100dvh-3rem)] md:rounded-[28px]'>
            <div className='shrink-0 px-5 pt-4'>
              {handle}
              <div className='flex items-start justify-between gap-3'>
                <div>
                  {audit}
                  <h2 id='handover-sheet-title' className='text-xl font-black leading-tight text-slate-950'>{title}</h2>
                  {total>0 && <p className='mt-1 text-sm font-semibold text-slate-500'>Шаг {step} из {total}</p>}
                </div>
                <button type='button' onClick={onClose} disabled={busy} className='employee-material-sheet-close flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600' aria-label='Закрыть'><X className='h-5 w-5' /></button>
              </div>
            </div>
            <div className='min-w-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]'>
              {children}
            </div>
          </div>
        </div>
  );
}

export function CashChecklistAmount({value,onChange,error}:{value:string;onChange:(value:string)=>void;error?:string|null}){
  return (
          <label className='grid gap-2 text-sm font-extrabold text-slate-800'>
            Фактический остаток, ₽
            <input
              type='number'
              inputMode='decimal'
              min='0'
              step='0.01'
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className='h-11 rounded-lg border border-slate-200 bg-white px-3 text-base font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
              placeholder='0'
            />
            {error && <span className='text-xs font-bold text-amber-700'>{error}</span>}
          </label>
  );
}
