'use client';
import Link from 'next/link';
import { EmployeeNavigation } from '@/components/EmployeeNavigation';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import { useEffect, useRef, useState } from 'react';
import { employeePayrollErrorNotice, employeePayrollMonths, type EmployeePayrollView as Salary } from '@/lib/employee-payroll-view';
import { EmployeePayrollAccessError, loadEmployeePayroll } from '@/lib/employee-payroll-load';
import { useEmployeePayrollMonth } from '@/components/useEmployeePayrollMonth';
import { useEmployeePayrollSnapshots } from '@/components/EmployeePayrollSnapshots';
import { EmployeeActionReminder } from '@/components/workday/EmployeeActionReminder';
import { beginEmployeeOperation, useEmployeePeriodView } from '@/components/EmployeeOperationAudit';

const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
const monthTitle = (period: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T12:00:00Z`));

export function PersonalPayrollClient({ currentMonth, initialSalary = null, embedded = false, onOpenReminder }: { currentMonth: string; initialSalary?: Salary | null; embedded?: boolean; onOpenReminder?: () => void }) {
  const preview = useEmployeePreview();
  const request = preview?.request ?? fetch;
  const actionHref = (href:string) => {
    if(!preview)return href;
    const url=new URL(href,'https://preview.invalid');
    if(url.pathname==='/employee/payroll/day-reviews')return preview.href('/employee/payroll')+'&dayReview='+encodeURIComponent(url.searchParams.get('month')??currentMonth);
    if(url.searchParams.get('tab')==='schedule')return preview.href('/employee?tab=schedule')+(url.searchParams.get('date')?'&date='+encodeURIComponent(url.searchParams.get('date')!):'');
    return preview.href('/employee');
  };
  const activeMonth = useEmployeePayrollMonth(currentMonth);
  const months = employeePayrollMonths(activeMonth);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const month = selectedMonth && months.includes(selectedMonth) ? selectedMonth : activeMonth;
  useEmployeePeriodView('payroll_view', month);
  const store = useEmployeePayrollSnapshots();
  const remember = store?.remember, clear = store?.clear;
  const [loaded, setSalary] = useState<Salary | null>(initialSalary);
  const salary = store?.values.get(month) ?? (loaded?.month === month ? loaded : null);
  const hasAdvance = salary?.state === 'current_estimate' && (salary.savedAdvance ?? 0) > 0;
  const balance = hasAdvance ? (salary.estimatedAccrued ?? 0) - (salary.savedAdvance ?? 0) : 0;
  const through = salary?.verifiedThrough && new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', timeZone: 'UTC',
  }).format(new Date(salary.verifiedThrough + 'T12:00:00Z'));
  const [updating, setUpdating] = useState(true);
  const lastStarted = useRef(0);
  const [error, setError] = useState('');
  const errorNotice = employeePayrollErrorNotice(salary, error);
  const [refresh, setRefresh] = useState(0);
  const needsRetry = !updating && (!!error || salary?.state === 'unavailable'
    || salary?.sourceFallback
    || (salary?.state === 'confirmed' && (salary.paid == null || salary.remaining == null)));
  useEffect(() => {
    const controller = new AbortController();
    const finishAudit = beginEmployeeOperation('payroll_load', {disabled:!!preview,period:month});
    lastStarted.current = Date.now();
    setUpdating(true); setError('');
    void loadEmployeePayroll({ month, request, signal: controller.signal, hasSaved: !!salary && salary.state !== 'requires_action',
      onStored: result => { setSalary(result); remember?.(result, months); },
    })
      .then(result => {
        if (controller.signal.aborted) return;
        setSalary(result); remember?.(result, months);
        finishAudit(result.state === 'unavailable' ? 'failed' : 'completed', result.state === 'unavailable' ? 'unavailable' : undefined);
      }).catch(cause => { if (!controller.signal.aborted) {
        if (cause instanceof EmployeePayrollAccessError) { clear?.(); setSalary(null); }
        finishAudit('failed', navigator.onLine ? 'request' : 'network');
        setError(cause instanceof Error ? cause.message : 'Не удалось обновить расчёт. Попробуйте ещё раз.');
      } })
      .finally(() => { if (!controller.signal.aborted) setUpdating(false); });
    return () => controller.abort();
  }, [month, refresh, request, remember, clear, activeMonth, embedded]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - lastStarted.current >= 30000) setRefresh(value => value + 1); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
  return <div className='salary-content personal-payroll-content'>
    <EmployeeActionReminder view='payroll' onOpen={onOpenReminder} />
    <div className='salary-heading'><h1>Моя зарплата</h1><label className='salary-month-picker'>
      <span className='sr-only'>Месяц зарплаты</span><select value={month} onChange={event => { setError(''); setSelectedMonth(event.target.value === activeMonth ? null : event.target.value); }} className='min-h-11 max-w-[190px] rounded-xl border border-[#e5e2da] bg-transparent px-2 font-semibold'>
        {months.map(period => <option key={period} value={period}>{monthTitle(period)}</option>)}
      </select>
    </label></div>
    <div aria-live='polite' aria-busy={updating}>
      {errorNotice && <p role='alert' className='mb-3 text-sm text-amber-900'>{errorNotice}</p>}
      {!salary ? !error && <p className='py-8 text-base'>Обновляем расчёт…</p>
        : salary.state === 'requires_action' ? <section className='salary-breakdown rounded-[22px] border border-[#e5e2da] bg-white p-5'><h2 className='text-xl font-bold'>{salary.action!.title}</h2><p className='my-4 text-base leading-relaxed text-[#60636a]'>{salary.action!.message}</p><Link href={actionHref(salary.action!.href)} onClick={() => { if (salary.action?.kind === 'start' || salary.action?.kind === 'finish') onOpenReminder?.(); }} className='flex min-h-[50px] items-center justify-center rounded-[14px] bg-[#272b30] px-4 font-semibold text-white'>{salary.action!.label}</Link></section>
        : salary.state === 'unavailable' ? !errorNotice && <div className='salary-hero pwa-review-task'><p>Расчёт временно недоступен.</p></div>
        : salary.state === 'current_estimate' ? <div className='space-y-3'>
          <section aria-label='Начисленная зарплата' className='relative overflow-hidden rounded-[24px] border border-[#e4ddd3] bg-gradient-to-br from-[#ffffff] via-[#faf7f2] to-[#f2e9df] px-5 pb-5 pt-5 text-[#252c30] shadow-[0_8px_24px_rgba(74,55,40,0.08)]'>
            <p className='text-sm font-semibold text-[#67645f]'>Начислено за месяц</p>
            {!salary.daysUnmarked && salary.earnings?.length === 1 && <p className='mt-1 text-xs text-[#756f68]'>{salary.earnings[0].label}</p>}
            <p className='mb-4 mt-2 whitespace-nowrap text-[40px] font-bold leading-none tracking-tight tabular-nums'>≈ {money(salary.estimatedAccrued!)} <span className='text-[25px] text-[#67645f]'>₽</span></p>
            <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-t border-[#ded5ca] pt-3 text-xs'>
              <span className='rounded-full bg-[#eee1d4] px-2.5 py-1 font-semibold text-[#8a5739]'>Предварительный расчёт{updating && <span> · Обновляется…</span>}</span>
              {through && <span className='text-[#756f68]'>Продажи по {through}</span>}
            </div>
          </section>
          {(salary.daysUnmarked || (salary.earnings?.length ?? 0) > 1) && <section className='rounded-[20px] border border-[#e5ded4] bg-white px-4 py-3.5 shadow-sm'>
            <h2 className='text-sm font-bold'>Из чего складывается</h2>
            {salary.daysUnmarked && <div className='mt-3 flex justify-between gap-3 border-t border-[#eee8e1] pt-3 text-sm'><span>Выходы</span><strong>Не отмечены</strong></div>}
            {(salary.earnings ?? []).map(row => <div className='mt-3 flex justify-between gap-3 border-t border-[#eee8e1] pt-3 text-sm' key={row.label}><span>{row.label}</span><strong className='whitespace-nowrap'>≈ {money(row.amount)} ₽</strong></div>)}
            {salary.daysUnmarked && <p className='mt-3 border-t border-[#e5e2da] pt-3 text-[14px] leading-[1.45] text-[#50585c]'>Заполняйте график в календаре. Каждый выход подтверждайте QR-кодом в начале смены и отмечайте её завершение в приложении.</p>}
          </section>}
          {hasAdvance && <section aria-label='Выплаты' className='rounded-[22px] border border-[#e5ded4] bg-white px-4 py-4 shadow-sm'>
            <h2 className='mb-3 text-base font-bold text-[#24282d]'>Выплаты</h2>
            <div className='flex items-baseline justify-between gap-3 text-sm'><span>Получено авансом</span><strong className='whitespace-nowrap text-base tabular-nums'>{money(salary.savedAdvance!)} ₽</strong></div>
            <div className='mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#f8f1eb] px-3 py-3'>
              <div><span className='block text-sm font-semibold'>{balance < 0 ? 'Аванс больше начислений на' : balance === 0 ? 'Аванс равен начислениям' : 'Начислено за вычетом аванса'}</span></div>
              {balance !== 0 && <strong className={'whitespace-nowrap text-[19px] font-bold tabular-nums ' + (balance < 0 ? 'text-[#9b4039]' : '')}>≈ {money(Math.abs(balance))} ₽</strong>}
            </div>
          </section>}
        </div> : <>
          <section className='salary-hero pwa-review-task' aria-label='Начисленная зарплата'>
            <p>Начислено за месяц</p><div className='salary-total'>{money(salary.accrued!)} <span>₽</span></div>
            <div className='salary-status'><span>{salary.sourceFallback ? 'Последняя проверенная сумма' : 'Подтверждённая сумма'}{updating && <span className='text-slate-500'> · Обновляется…</span>}</span>
              {salary.verifiedThrough && <p className='salary-through'>Продажи по {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${salary.verifiedThrough}T12:00:00Z`))}</p>}
              {salary.sourceFallback && salary.checkedAt && <p className='salary-through'>Выплаты проверены {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(salary.checkedAt))}</p>}
            </div>
          </section>
          {<section className='salary-breakdown' aria-label='Выплата зарплаты'>
            <h2>Выплаты</h2>
            <div><span>Уже получено</span><strong>{salary.paid == null ? 'Проверяется' : `${money(salary.paid)} ₽`}</strong></div>
            {!!salary.creditedFromEarlier && <div><span>Учтено из ранее выданного</span><strong>{money(salary.creditedFromEarlier)} ₽</strong></div>}
            <div><span>Осталось получить</span><strong>{salary.remaining == null ? 'Проверяется' : `${money(salary.remaining)} ₽`}</strong></div>
          </section>}
        </>}
    </div>
    {needsRetry && <button type='button' onClick={() => setRefresh(value => value + 1)} className='mt-4 min-h-11 rounded-xl border border-[#e5e2da] px-5 text-base font-semibold'>Повторить</button>}
    {!embedded && <EmployeeNavigation active='payroll' payrollEnabled />}
  </div>;
}
