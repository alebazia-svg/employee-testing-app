'use client';

import { Input } from '@/components/ui/input';
import type { PayrollBonusDraft } from '@/lib/payroll-compensation';
import React, { useState } from 'react';

export function PayrollBonusesEditor({ drafts, employees, employeeName, error, disabled, onChange, legacyBonus }: {
  drafts: PayrollBonusDraft[];
  employees: string[];
  employeeName?: string;
  error: string;
  disabled: boolean;
  onChange: (drafts: PayrollBonusDraft[]) => void;
  legacyBonus?: { amount: string; onChange: (value: string) => void };
}) {
  const [removed, setRemoved] = useState<PayrollBonusDraft | null>(null);
  function update(id: string, field: keyof PayrollBonusDraft, value: string) {
    onChange(drafts.map((draft) => draft.id === id ? { ...draft, [field]: value } : draft));
  }
  return (
    <section aria-label={employeeName ? `Премии: ${employeeName}` : 'Премии без сопоставленного сотрудника'} className='min-w-0'>
      <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h3 className='text-sm font-bold text-slate-900'>{employeeName ? 'Премии' : 'Премии без сопоставленного сотрудника'}</h3>
        </div>
        {employeeName && <button type='button' disabled={disabled} onClick={() => onChange([...drafts, { id: crypto.randomUUID(), employeeName, amount: '', reason: '' }])} className='shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50'>Добавить премию</button>}
      </div>
      {error && <p role='alert' className='mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'>{error} Пока ошибка не исправлена, премии не включены в итог; сохранение и экспорт расчёта недоступны.</p>}
      <div className='grid gap-3'>
        {legacyBonus && <label className='grid gap-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-slate-700'>Премия по прежнему вводу, ₽
          <Input aria-label={`Прежняя премия: ${employeeName}`} disabled={disabled} type='number' min='0' step='100' value={legacyBonus.amount} onChange={(event) => legacyBonus.onChange(event.target.value)} />
          <span className='text-xs font-normal text-slate-600'>Уже учтена в зарплате. Не добавляйте ту же сумму повторно ниже.</span>
        </label>}
        {drafts.length === 0 && !legacyBonus && <p className='text-sm text-slate-500'>Премий в этом месяце нет.</p>}
        {drafts.map((draft, index) => (
          <fieldset key={draft.id} disabled={disabled} className='grid min-w-0 gap-3 rounded-lg border border-border p-3'>
            <legend className='px-1 text-xs font-semibold text-slate-500'>Премия {index + 1}</legend>
            {!employeeName && <label className='grid gap-1 text-sm font-semibold text-slate-700'>Сотрудник
              <select aria-label={`Сотрудник премии ${index + 1}`} value={draft.employeeName} onChange={(event) => update(draft.id, 'employeeName', event.target.value)} className='h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 font-normal'>
                <option value=''>Выберите сотрудника</option>
                {employees.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>}
            <div className='grid min-w-0 gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto]'>
            <label className='grid gap-1 text-sm font-semibold text-slate-700'>Сумма, ₽
              <Input aria-label={`Сумма премии ${index + 1}`} inputMode='decimal' value={draft.amount} onChange={(event) => update(draft.id, 'amount', event.target.value)} />
            </label>
            <label className='grid gap-1 text-sm font-semibold text-slate-700'>Основание
              <textarea aria-label={`Основание премии ${index + 1}`} rows={2} maxLength={1000} value={draft.reason} onChange={(event) => update(draft.id, 'reason', event.target.value)} className='min-w-0 rounded-lg border border-slate-200 px-3 py-2 font-normal' placeholder='За что назначена премия и чьё решение' />
            </label>
            <button type='button' onClick={() => { setRemoved(draft); onChange(drafts.filter((item) => item.id !== draft.id)); }} className='self-end rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-600'>Убрать</button>
            </div>
          </fieldset>
        ))}
      </div>
      {removed && <p className='mt-3 text-sm text-slate-600'>Премия убрана из черновика. <button type='button' disabled={disabled} onClick={() => { onChange([...drafts, removed]); setRemoved(null); }} className='font-semibold underline'>Вернуть премию</button></p>}
    </section>
  );
}
