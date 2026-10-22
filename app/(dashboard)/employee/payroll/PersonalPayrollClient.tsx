'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PremiumCardIcon, PremiumCalendarIcon, PremiumClockIcon } from '@/components/PwaPreviewIcons';
import type { EmployeeEarning } from '@/lib/employee-payroll-estimate';

type Salary = { month: string; state: 'unavailable' | 'current_estimate' | 'confirmed'; estimatedAccrued?: number; earnings?: EmployeeEarning[]; savedAdvance?: number | null; verifiedThrough?: string; accrued?: number; paid?: number | null; remaining?: number | null };
const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
const monthTitle = (period: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T12:00:00Z`));

export function PersonalPayrollClient({ currentMonth }: { currentMonth: string }) {
  const [month, setMonth] = useState(currentMonth);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const needsRetry = !!error || salary?.state === 'unavailable'
    || (salary?.state === 'current_estimate' && salary.savedAdvance == null)
    || (salary?.state === 'confirmed' && (salary.paid == null || salary.remaining == null));
  const months = Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(`${currentMonth}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - offset);
    return date.toISOString().slice(0, 7);
  });
  useEffect(() => {
    const controller = new AbortController();
    setSalary(null); setError('');
    void fetch(`/api/employee/payroll?month=${encodeURIComponent(month)}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error('Не удалось обновить расчёт. Попробуйте ещё раз.');
        const result = await response.json() as Salary;
        if (result.month !== month || !['unavailable', 'current_estimate', 'confirmed'].includes(result.state)
          || (result.state === 'current_estimate' && (!Number.isFinite(result.estimatedAccrued) || !Array.isArray(result.earnings)
            || result.earnings.some(row => typeof row.label !== 'string' || !Number.isFinite(row.amount))
            || result.earnings.reduce((sum, row) => sum + row.amount, 0) !== result.estimatedAccrued))
          || (result.state === 'confirmed' && !Number.isFinite(result.accrued))) throw Error('Расчёт пока недоступен.');
        if (!controller.signal.aborted) setSalary(result);
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Расчёт пока недоступен.'); });
    return () => controller.abort();
  }, [month, refresh]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setRefresh(value => value + 1); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, []);
  return <div className='salary-content personal-payroll-content'>
    <div className='salary-heading'><h1>Моя зарплата</h1><label className='salary-month-picker'>
      <span className='sr-only'>Месяц зарплаты</span><select value={month} onChange={event => { setSalary(null); setMonth(event.target.value); }} className='min-h-11 max-w-[190px] rounded-xl border border-[#e5e2da] bg-transparent px-2 font-semibold'>
        {months.map(period => <option key={period} value={period}>{monthTitle(period)}</option>)}
      </select>
    </label></div>
    <div aria-live='polite' aria-busy={!salary && !error}>
      {error ? <div role='alert' className='rounded-2xl border border-amber-200 bg-amber-50 p-5 text-base'>{error}</div>
        : !salary ? <p className='py-8 text-base'>Обновляем расчёт…</p>
        : salary.state === 'unavailable' ? <div className='salary-hero pwa-review-task'><p>Расчёт пока недоступен</p><p className='mt-3 text-base'>Он появится после проверки данных.</p></div>
        : <>
          <section className='salary-hero pwa-review-task' aria-label='Начисленная зарплата'>
            <p>Начислено за месяц</p><div className='salary-total'>{salary.state === 'confirmed' ? money(salary.accrued!) : `≈ ${money(salary.estimatedAccrued!)}`} <span>₽</span></div>
            <div className='salary-status'><span>{salary.state === 'current_estimate' ? 'Предварительный расчёт' : 'Подтверждённая сумма'}</span>
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
          {salary.state === 'current_estimate' && salary.savedAdvance == null
            && <p role='status' className='mt-2 text-base text-slate-600'>Не удалось проверить авансы. Попробуйте позже.</p>}
        </>}
    </div>
    {needsRetry && <button type='button' onClick={() => setRefresh(value => value + 1)} className='mt-4 min-h-11 rounded-xl border border-[#e5e2da] px-5 text-base font-semibold'>Повторить</button>}
    <nav aria-label='Основная навигация сотрудника' className='employee-material-nav fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2'>
      <div className='grid grid-cols-3 gap-1'>
        {[{ label: 'Рабочий день', href: '/employee', Icon: PremiumClockIcon }, { label: 'График', href: '/employee?tab=schedule', Icon: PremiumCalendarIcon }, { label: 'Моя зарплата', href: '/employee/payroll', Icon: PremiumCardIcon }].map(({ label, href, Icon }, index) => <Link
          key={href} href={href} aria-current={index === 2 ? 'page' : undefined}
          className={`employee-material-tab flex min-h-[52px] flex-col items-center justify-center gap-0 px-2 text-xs font-extrabold ${index === 2 ? 'is-active' : 'text-slate-500'}`}>
          <Icon className='h-6 w-6' color={index === 2 ? 'var(--portal-brand-strong)' : '#687078'} secondaryColor={index === 2 ? 'var(--portal-brand-colleague-blue)' : '#b6babd'} secondaryOpacity={index === 2 ? 1 : 0.82} />
          <span className='employee-material-tab-label'>{label}</span>
        </Link>)}
      </div>
    </nav>
  </div>;
}
