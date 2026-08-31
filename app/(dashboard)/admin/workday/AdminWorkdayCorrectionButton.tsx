'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getShiftOptionsForDepartment } from '@/lib/workday';

type Props = {
  employee: { id: number; name: string; department: string };
  date: string;
  scheduleStatus?: string;
  workDay?: { shiftCode: string; status: string; endedAt: string | null } | null;
  vacation?: { id: string; dateFrom: string; dateTo: string } | null;
};

export function AdminWorkdayCorrectionButton({ employee, date, scheduleStatus, workDay, vacation }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shiftCode, setShiftCode] = useState(workDay?.shiftCode ?? '');
  const [dateFrom, setDateFrom] = useState(vacation?.dateFrom ?? date);
  const [dateTo, setDateTo] = useState(vacation?.dateTo ?? date);
  const shiftOptions = getShiftOptionsForDepartment(employee.department);

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/workday/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: employee.id, date, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить изменение');
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить изменение');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type='button' onClick={() => setOpen(true)} className='inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50'>
        <Pencil className='h-3.5 w-3.5' /> Изменить
      </button>
      {open && (
        <div className='fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5' role='dialog' aria-modal='true' aria-label={`Исправить данные ${employee.name}`} onClick={(event) => {
          if (event.target === event.currentTarget && !busy) setOpen(false);
        }}>
          <div className='max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[#f7f7f3] p-5 shadow-2xl sm:rounded-[24px]'>
            <div className='flex items-start justify-between gap-3'>
              <div><p className='text-xs font-black uppercase tracking-[0.12em] text-green-700'>Изменение с историей</p><h2 className='mt-1 text-xl font-black text-slate-950'>{employee.name}</h2><p className='mt-1 text-sm font-semibold text-slate-500'>{date}</p></div>
              <button type='button' className='flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-white' onClick={() => setOpen(false)} disabled={busy} aria-label='Закрыть'><X className='h-5 w-5' /></button>
            </div>
            {error && <p className='mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 ring-1 ring-rose-200'>{error}</p>}

            <section className='mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200'>
              <h3 className='font-extrabold text-slate-950'>График на этот день</h3>
              <p className='mt-1 text-xs font-semibold text-slate-500'>Текущая отметка: {scheduleStatus === 'working' ? 'работает' : scheduleStatus === 'off' ? 'выходной' : 'не заполнено'}.</p>
              <div className='mt-3 grid grid-cols-2 gap-2'><Button type='button' className='h-10 text-xs font-extrabold' disabled={busy} onClick={() => void submit({ action: 'set_schedule', status: 'working' })}>Работает</Button><Button type='button' className='h-10 bg-slate-800 text-xs font-extrabold text-white hover:bg-slate-900' disabled={busy} onClick={() => void submit({ action: 'set_schedule', status: 'off' })}>Выходной</Button></div>
            </section>

            <section className='mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200'>
              <h3 className='font-extrabold text-slate-950'>Отпуск</h3>
              <div className='mt-3 grid grid-cols-2 gap-2'><label className='grid gap-1 text-xs font-bold text-slate-500'>Начало<input type='date' value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className='h-10 min-w-0 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-950' /></label><label className='grid gap-1 text-xs font-bold text-slate-500'>Окончание<input type='date' min={dateFrom} value={dateTo} onChange={(event) => setDateTo(event.target.value)} className='h-10 min-w-0 rounded-lg border border-slate-200 px-2 text-sm font-bold text-slate-950' /></label></div>
              <Button type='button' className='mt-3 h-10 w-full text-xs font-extrabold' disabled={busy || !dateFrom || !dateTo} onClick={() => void submit({ action: 'save_vacation', vacationId: vacation?.id, dateFrom, dateTo })}>{vacation ? 'Изменить отпуск' : 'Отметить отпуск'}</Button>
              {vacation && <button type='button' className='mt-3 w-full text-center text-xs font-extrabold text-rose-700' disabled={busy} onClick={() => void submit({ action: 'cancel_vacation', vacationId: vacation.id })}>Убрать отпуск из графика</button>}
            </section>

            {workDay && !workDay.endedAt && workDay.status === 'active' && (
              <section className='mt-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200'>
                <h3 className='font-extrabold text-slate-950'>Выбранная смена</h3>
                <p className='mt-1 text-xs font-semibold leading-relaxed text-slate-500'>Безопасно меняется только пока сотрудник не начал выполнять чек‑лист и денежные операции.</p>
                <select value={shiftCode} onChange={(event) => setShiftCode(event.target.value)} className='mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950'>{shiftOptions.map((shift) => <option key={shift.code} value={shift.code}>{shift.label}</option>)}</select>
                <Button type='button' className='mt-3 h-10 w-full text-xs font-extrabold' disabled={busy || !shiftCode || shiftCode === workDay.shiftCode} onClick={() => void submit({ action: 'change_shift', toShiftCode: shiftCode })}>Исправить смену</Button>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
