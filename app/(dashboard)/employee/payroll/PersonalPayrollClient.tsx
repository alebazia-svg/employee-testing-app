'use client';
import { EmployeeNavigation } from '@/components/EmployeeNavigation';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import { useEffect, useRef, useState } from 'react';
import { PremiumCardIcon } from '@/components/PwaPreviewIcons';
import { employeePayrollMonths, type EmployeePayrollView as Salary } from '@/lib/employee-payroll-view';
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
  const activeMonth = useEmployeePayrollMonth(currentMonth);
  const months = employeePayrollMonths(activeMonth);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const month = selectedMonth && months.includes(selectedMonth) ? selectedMonth : activeMonth;
  useEmployeePeriodView('payroll_view', month);
  const store = useEmployeePayrollSnapshots();
  const remember = store?.remember, clear = store?.clear;
  const [loaded, setSalary] = useState<Salary | null>(initialSalary);
  const salary = store?.values.get(month) ?? (loaded?.month === month ? loaded : null);
  const [updating, setUpdating] = useState(true);
  const lastStarted = useRef(0);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const needsRetry = !updating && (!!error || salary?.state === 'unavailable'
    || salary?.sourceFallback
    || (salary?.state === 'confirmed' && (salary.paid == null || salary.remaining == null)));
  useEffect(() => {
    const controller = new AbortController();
    const finishAudit = beginEmployeeOperation('payroll_load', {disabled:!!preview,period:month});
    lastStarted.current = Date.now();
    setUpdating(true); setError('');
    void loadEmployeePayroll({ month, request, signal: controller.signal, hasSaved: !!salary,
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
      {error && <p role='alert' className='mb-3 text-sm text-amber-900'>{salary && salary.state !== 'unavailable' ? 'Показан последний загруженный расчёт. ' : ''}{error}</p>}
      {!salary ? !error && <p className='py-8 text-base'>Обновляем расчёт…</p>
        : salary.state === 'unavailable' ? <div className='salary-hero pwa-review-task'><p>Расчёт пока недоступен</p><p className='mt-3 text-base'>Он появится после проверки данных.</p></div>
        : <>
          <section className='salary-hero pwa-review-task' aria-label='Начисленная зарплата'>
            <p>Начислено за месяц</p><div className='salary-total'>{salary.state === 'confirmed' ? money(salary.accrued!) : `≈ ${money(salary.estimatedAccrued!)}`} <span>₽</span></div>
            <div className='salary-status'><span>{salary.state === 'current_estimate' ? 'Предварительный расчёт' : salary.sourceFallback ? 'Последняя проверенная сумма' : 'Подтверждённая сумма'}{updating && <span className='text-slate-500'> · Обновляется…</span>}</span>
              {salary.verifiedThrough && <p className='salary-through'>Продажи по {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${salary.verifiedThrough}T12:00:00Z`))}</p>}
              {salary.sourceFallback && salary.checkedAt && <p className='salary-through'>Выплаты проверены {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(salary.checkedAt))}</p>}
            </div>
          </section>
          {salary.state === 'current_estimate' && !!salary.earnings?.length && <section className='salary-breakdown' aria-label='Состав зарплаты'>
            <h2>Из чего складывается</h2>
            {salary.earnings!.map(row => <div key={row.label}><span>{row.label}</span><strong>≈ {money(row.amount)} ₽</strong></div>)}
          </section>}
          {salary.state === 'confirmed' ? <section className='salary-breakdown' aria-label='Выплата зарплаты'>
            <h2>Выплаты</h2>
            <div><span>Уже получено</span><strong>{salary.paid == null ? 'Проверяется' : `${money(salary.paid)} ₽`}</strong></div>
            {!!salary.creditedFromEarlier && <div><span>Учтено из ранее выданного</span><strong>{money(salary.creditedFromEarlier)} ₽</strong></div>}
            <div><span>Осталось получить</span><strong>{salary.remaining == null ? 'Проверяется' : `${money(salary.remaining)} ₽`}</strong></div>
          </section> : salary.savedAdvance != null && salary.savedAdvance > 0 ? <section className='salary-advance'><span className='salary-wallet'><PremiumCardIcon color='var(--portal-brand-strong)' size={28} /></span><div>Получено авансом</div>
            <strong>{money(salary.savedAdvance)} ₽</strong>
          </section> : null}
        </>}
    </div>
    {needsRetry && <button type='button' onClick={() => setRefresh(value => value + 1)} className='mt-4 min-h-11 rounded-xl border border-[#e5e2da] px-5 text-base font-semibold'>Повторить</button>}
    {!embedded && <EmployeeNavigation active='payroll' payrollEnabled />}
  </div>;
}
