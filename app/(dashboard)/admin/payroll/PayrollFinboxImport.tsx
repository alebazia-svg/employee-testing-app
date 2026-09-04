'use client';

import React, { useMemo, useRef, useState } from 'react';
import { parseFinboxReport } from '@/lib/payroll-finbox';

const money = (value: number) => value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });

export function PayrollFinboxImport({ periodKey, currentAmount, disabled, onApply }: {
  periodKey: string;
  currentAmount: string;
  disabled: boolean;
  onApply: (amount: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const preview = useMemo(() => checked ? parseFinboxReport(text, periodKey) : null, [checked, text, periodKey]);
  const monthLabel = new Date(`${periodKey}-01T12:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  function close() { setOpen(false); setText(''); setChecked(false); trigger.current?.focus(); }
  return (
    <section aria-label='Отчёт Finbox: агентские Дианы' className='min-w-0 rounded-lg border border-border bg-slate-50/60 p-3 sm:p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h3 className='text-sm font-bold text-slate-900'>Агентские из Finbox</h3>
          <p className='mt-1 text-xs text-slate-500'>Начисления за {monthLabel.replace(/\.$/, '')}. Перечисления и остатки в зарплату не входят.</p>
        </div>
        <button ref={trigger} type='button' disabled={disabled} aria-expanded={open} onClick={() => { setOpen(true); setApplied(null); }} className='shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50'>Вставить отчёт Finbox</button>
      </div>
      {applied && !open && <p role='status' className='mt-3 text-sm text-slate-700'>{currentAmount === applied ? `В черновик подставлено ${money(Number(applied))}. Для истории сохраните расчёт.` : 'Сумма агентских изменена вручную после подстановки из Finbox.'}</p>}
      {open && <fieldset disabled={disabled} className='mt-4 min-w-0 space-y-3'>
        <label className='grid gap-2 text-sm font-semibold text-slate-700'>Таблица Finbox за {monthLabel}
          <textarea autoFocus aria-label='Таблица Finbox' value={text} maxLength={100000} rows={6} onChange={event => { setText(event.target.value); setChecked(false); }} className='w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary/30' placeholder='Скопируйте таблицу с датами, операциями, суммами и обоими остатками. Можно вставить таблицу из браузера или сообщения.' />
        </label>
        {preview && <div aria-live='polite' className='space-y-3'>
          {preview.errors.length > 0 ? <div role='alert' className='rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'><p className='font-semibold'>Сумма пока не подставлена</p><ul className='mt-2 list-disc space-y-1 pl-5'>{preview.errors.map(error => <li key={error}>{error}</li>)}</ul></div> : <div className='rounded-lg border border-border bg-white p-3'>
            <p className='text-xs text-slate-500'>Агентские за выбранный месяц · {preview.accrualCount} начислений</p>
            <p className='mt-1 text-2xl font-bold text-slate-900'>{money(Number(preview.amount))}</p>
            <p className='mt-2 text-sm text-slate-600'>Остатки сошлись. Перечисления {money(Math.abs(preview.transfers))} не вычитаются из агентских.</p>
            <p className='mt-2 text-sm text-slate-600'>Заменит текущее значение {currentAmount.trim() ? money(Number(currentAmount.replace(',', '.'))) : '«не заполнено»'}. Повторная вставка не прибавляет сумму ещё раз.</p>
            {preview.notes.map((note, i) => <p key={i} className='mt-2 text-xs text-slate-500'>{note}</p>)}
          </div>}
        </div>}
        <div className='flex flex-wrap gap-2'>
          {preview && !preview.errors.length ? <button type='button' onClick={() => { if (disabled) return; onApply(preview.amount); setApplied(preview.amount); close(); }} className='rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>Подтвердить и подставить</button> : <button type='button' onClick={() => setChecked(true)} className='rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>Проверить сумму</button>}
          <button type='button' onClick={close} className='rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-slate-600'>Отмена</button>
        </div>
        <p className='text-xs text-slate-500'>Таблица используется только для проверки. В зарплату попадёт подтверждённая сумма; исходный текст отчёта не сохраняется.</p>
      </fieldset>}
    </section>
  );
}
