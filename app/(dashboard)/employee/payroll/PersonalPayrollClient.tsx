'use client';
import { EmployeeNavigation } from '@/components/EmployeeNavigation';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';
import { useEffect, useRef, useState } from 'react';
import { PremiumCardIcon } from '@/components/PwaPreviewIcons';
import { employeePayrollMonths, validEmployeePayrollView, type EmployeePayrollView as Salary } from '@/lib/employee-payroll-view';
import { useEmployeePayrollMonth } from '@/components/useEmployeePayrollMonth';
import { useEmployeePayrollSnapshots } from '@/components/EmployeePayrollSnapshots';
import { EmployeeActionReminder } from '@/components/workday/EmployeeActionReminder';

const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
const monthTitle = (period: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T12:00:00Z`));

export function PersonalPayrollClient({ currentMonth, initialSalary = null, refreshEnabled = true }: { currentMonth: string; initialSalary?: Salary | null; refreshEnabled?: boolean }) {
  const preview = useEmployeePreview();
  const request = preview?.request ?? fetch;
  const activeMonth = useEmployeePayrollMonth(currentMonth);
  const months = employeePayrollMonths(activeMonth);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const month = selectedMonth && months.includes(selectedMonth) ? selectedMonth : activeMonth;
  const store = useEmployeePayrollSnapshots();
  const remember = store?.remember, clear = store?.clear;
  const [loaded, setSalary] = useState<Salary | null>(initialSalary);
  const salary = store?.values.get(month) ?? (loaded?.month === month ? loaded : null);
  const [updating, setUpdating] = useState(true);
  const lastStarted = useRef(0);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const needsRetry = !updating && (!!error || salary?.state === 'unavailable'
    || (salary?.state === 'current_estimate' && salary.savedAdvance == null)
    || (salary?.state === 'confirmed' && (salary.paid == null || salary.remaining == null)));
  useEffect(() => {
    // The streaming fallback uses the same UI/cache without starting a second
    // expensive payroll read while the server snapshot is still on its way.
    if (!refreshEnabled) return;
    const controller = new AbortController();
    lastStarted.current = Date.now();
    setUpdating(true); setError('');
    const timer = window.setTimeout(() => controller.abort('timeout'), 15000);
    void request(`/api/employee/payroll?month=${encodeURIComponent(month)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (controller.signal.aborted) return;
        if ([401, 403, 404, 410].includes(response.status)) { clear?.(); setSalary(null); throw Error('Войдите в приложение заново.'); }
        if (!response.ok) throw Error('Не удалось обновить расчёт. Попробуйте ещё раз.');
        const result: unknown = await response.json();
        if (!validEmployeePayrollView(result, month)) throw Error('Расчёт пока недоступен.');
        if (!controller.signal.aborted) { setSalary(result); remember?.(result, months); }
      }).catch(cause => { if (!controller.signal.aborted || controller.signal.reason === 'timeout') setError(cause instanceof Error && !controller.signal.aborted ? cause.message : 'Не удалось обновить расчёт. Попробуйте ещё раз.'); })
      .finally(() => { window.clearTimeout(timer); if (!controller.signal.aborted || controller.signal.reason === 'timeout') setUpdating(false); });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [month, refresh, request, remember, clear, activeMonth, refreshEnabled]);
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
    <EmployeeActionReminder view='payroll' />
    <div className='salary-heading'><h1>Моя зарплата</h1><label className='salary-month-picker'>
      <span className='sr-only'>Месяц зарплаты</span><select disabled={!refreshEnabled} value={month} onChange={event => { setError(''); setSelectedMonth(event.target.value === activeMonth ? null : event.target.value); }} className='min-h-11 max-w-[190px] rounded-xl border border-[#e5e2da] bg-transparent px-2 font-semibold'>
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
            <div className='salary-status'><span>{salary.state === 'current_estimate' ? 'Предварительный расчёт' : 'Подтверждённая сумма'}{updating && <span className='text-slate-500'> · Обновляется…</span>}</span>
              {salary.verifiedThrough && <p className='salary-through'>Продажи учтены по {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${salary.verifiedThrough}T12:00:00Z`))}</p>}
            </div>
          </section>
          {salary.state === 'current_estimate' && !!salary.earnings?.length && <section className='salary-breakdown' aria-label='Состав зарплаты'>
            <h2>Из чего складывается</h2>
            {salary.earnings!.map(row => <div key={row.label}><span>{row.label}</span><strong>≈ {money(row.amount)} ₽</strong></div>)}
          </section>}
          {salary.state === 'confirmed' ? <section className='salary-breakdown' aria-label='Выплата зарплаты'>
            <h2>Выплаты</h2>
            <div><span>Уже получено</span><strong>{salary.paid == null ? 'Проверяется' : `${money(salary.paid)} ₽`}</strong></div>
            <div><span>Осталось получить</span><strong>{salary.remaining == null ? 'Проверяется' : `${money(salary.remaining)} ₽`}</strong></div>
          </section> : salary.savedAdvance != null && salary.savedAdvance > 0 ? <section className='salary-advance'><span className='salary-wallet'><PremiumCardIcon color='var(--portal-brand-strong)' size={28} /></span><div>Получено авансом</div>
            <strong>{money(salary.savedAdvance)} ₽</strong>
          </section> : null}
          {salary.state === 'current_estimate' && salary.savedAdvance == null && !updating
            && <p role='status' className='mt-2 text-base text-slate-600'>Не удалось проверить авансы. Попробуйте позже.</p>}
        </>}
    </div>
    {needsRetry && <button type='button' onClick={() => setRefresh(value => value + 1)} className='mt-4 min-h-11 rounded-xl border border-[#e5e2da] px-5 text-base font-semibold'>Повторить</button>}
    <EmployeeNavigation active='payroll' payrollEnabled />
  </div>;
}
