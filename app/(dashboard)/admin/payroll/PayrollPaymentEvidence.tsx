'use client';
import { useEffect, useState } from 'react';
import { employeeSalaryBalance, type PayrollBalanceRead } from '@/lib/payroll-one-c-balances';
import { resolvePayrollSettlementIdentity, type PayrollCashRead } from '@/lib/payroll-one-c-payments';
import { payrollPaymentMonth } from '@/lib/payroll-settlement-month';
import { payrollPostedAccrual, type PayrollLedgerRead } from '@/lib/payroll-one-c-ledger';
import { oldestPayrollDebt } from '@/lib/payroll-oldest-debt';

export type Evidence = { periodKey: string; balance: PayrollBalanceRead; cash: PayrollCashRead; ledger?: PayrollLedgerRead };
const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);
const date = (value: string) => value.split('-').reverse().join('.');
export function usePayrollPaymentEvidence(periodKey: string | null) {
  const [data, setData] = useState<Evidence | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!periodKey) return;
    const refresh = () => { if (document.visibilityState === 'visible') setRetry(x => x + 1); };
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [periodKey]);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    if (!periodKey) return () => controller.abort();
    fetch(`/api/admin/payroll/settlement?period=${encodeURIComponent(periodKey)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (response.status === 401 || response.status === 403) throw new Error('SESSION_EXPIRED'); const value = await response.json(); if (!response.ok) throw new Error(value.error); return value as Evidence; })
      .then(value => { if (!controller.signal.aborted && value.periodKey === periodKey) setData(value); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error && error.message === 'SESSION_EXPIRED' ? 'Вход в портал истёк или нет доступа. Обновите страницу и войдите снова.' : 'Выплаты из 1С сейчас недоступны. Повторите проверку.'); });
    return () => controller.abort();
  }, [periodKey, retry]);
  return { data: data?.periodKey === periodKey ? data : null, error, retry: () => setRetry(x => x + 1) };
}
export function paymentCardSummary(data: Evidence | null, employee: string, names: string[]) {
  if (!data) return null;
  const ref = resolvePayrollSettlementIdentity(employee, names, data.periodKey, data.cash, data.balance, data.ledger?.employees);
  const balance = employeeSalaryBalance(data.balance, ref);
  if (!ref || !balance) return null;
  const documents = data.cash.documents.filter(d => d.identityConfirmed && d.employeeRef.toLowerCase() === ref);
  const monthly = oldestPayrollDebt(employee, ref, data.periodKey, data.ledger, data.cash, balance.remainingMinor);
  const allocations = documents.map(document => ({document, parts: payrollPaymentMonth(employee, document)}));
  const advances = allocations.reduce((sum, {parts}) => sum + (parts?.period === data.periodKey ? Math.round(parts.advance * 100) : 0), 0) / 100;
  const periodPaid = allocations.reduce((sum, {document,parts}) => sum + (parts?.period === data.periodKey ? Math.round(document.amount * 100) : 0), 0) / 100;
  return { balance, documents, monthly, accruedInOneC: payrollPostedAccrual(data.ledger, ref, data.periodKey), advances: monthly?.advances ?? advances, periodPaid: monthly?.paid ?? periodPaid, unassigned: monthly ? 0 : allocations.filter(x=>!x.parts).length,
    paid: documents.reduce((s, d) => s + Math.round(d.amount * 100), 0) / 100 };
}
export default function PayrollPaymentEvidence({ periodKey, employee, names, read }: { periodKey: string; employee: string; names: string[]; read: ReturnType<typeof usePayrollPaymentEvidence> }) {
  const { data, error } = read;
  if (error) return <section role='status' className='rounded-xl border border-amber-200 p-4'><p>{error}</p><button data-payroll-read-action type='button' className='mt-3 underline' onClick={read.retry}>Повторить проверку</button></section>;
  if (!data || data.periodKey !== periodKey) return <p role='status' className='p-4'>Проверяем выплаты в 1С…</p>;
  const ref = resolvePayrollSettlementIdentity(employee, names, periodKey, data.cash, data.balance, data.ledger?.employees);
  const balance = employeeSalaryBalance(data.balance, ref);
  if (!ref || !balance) return <p className='rounded-xl border border-amber-200 p-4'>Не удалось однозначно сопоставить сотрудника с получателем в 1С. Остаток пока не подтверждён.</p>;
  const documents = data.cash.documents.filter(d => d.identityConfirmed && d.employeeRef.toLowerCase() === ref);
  const monthly = paymentCardSummary(data, employee, names)?.monthly;
  const current = monthly ? monthly.currentDocuments.flatMap(part => documents.filter(d => d.key === part.key).map(d => ({...d,amount:part.amount}))) : documents.filter(d => payrollPaymentMonth(employee,d)?.period === periodKey);
  const unresolved = monthly ? [] : documents.filter(d => !payrollPaymentMonth(employee,d));
  const documentList = (rows: typeof documents) => <ul className='divide-y divide-slate-200'>{rows.map(d => {
      const parts = payrollPaymentMonth(employee, d);
      return <li key={d.key} className='flex flex-wrap justify-between gap-2 py-3'><div className='min-w-0'><p>{date(d.documentDate)} · № {d.documentNumber}</p>
        {!parts && !monthly && <p className='text-sm font-medium text-amber-800'>Нужно уточнить, за какой месяц выдано</p>}
        {parts && (parts.days > 0 || parts.advance > 0) && <p className='mt-1 text-sm'>{parts.days > 0 ? `Выходы ${money(parts.days)} · аванс ${money(parts.advance)}` : `Аванс ${money(parts.advance)}`}</p>}
      </div><strong className='whitespace-nowrap'>{money(d.amount)}</strong></li>;
    })}</ul>;
  return <section className='space-y-4'>
    {employee === 'Тохов Астемир' && ['2026-09', '2026-10'].includes(periodKey) && <p className='rounded-lg bg-[#faf3ed] p-3 text-sm text-[#805b43]'>По договорённости: 1-го числа — 30 000 ₽ в счёт зарплаты за предыдущий месяц. Ниже показаны фактические выдачи.</p>}
    {monthly && <p className='text-sm text-slate-600'>Начислено в 1С после округления: <strong>{money(monthly.accrued)}</strong></p>}
    {balance.creditMinor > 0 && <p className='rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>Выдано больше, чем начислено в 1С: {money(balance.creditMinor / 100)}. Проверьте, внесены ли все начисления.</p>}
    <div><h3 className='font-bold'>Выдано сотруднику</h3><p className='mt-1 text-sm text-slate-500'>За выбранный месяц, включая выдачи в следующем месяце</p></div>
    {current.length ? documentList(current) : <p className='text-sm text-slate-600'>{monthly ? 'За этот месяц ещё не получено.' : 'Выплаты за этот месяц пока не подтверждены документами.'}</p>}
    {unresolved.length > 0 && <section className='rounded-lg border border-amber-200 bg-amber-50 p-3'><h4 className='text-sm font-semibold text-amber-900'>Уточнить месяц выплаты</h4>{documentList(unresolved)}</section>}
    {monthly && <details className='border-t border-slate-200 pt-3 text-sm'><summary className='cursor-pointer py-2 font-semibold'>Остаток за все месяцы</summary><div className='mt-2 space-y-2 text-slate-600'><p>За выбранный месяц: {money(monthly.remaining)}</p><p>За предыдущие месяцы: {money(monthly.olderDebt)}</p><p className='font-semibold text-slate-900'>Всего осталось: {money(balance.remainingMinor / 100)}</p><p>Выдачи без указанного месяца сначала погашают старый долг. Явно указанный месяц аванса имеет приоритет.</p></div></details>}
    {!monthly && <details className='border-t border-slate-200 pt-3 text-sm text-slate-500'><summary className='cursor-pointer py-2'>Как учтены выплаты</summary><p className='mt-2'>Авансы входят в выплаченную сумму и повторно не вычитаются. Обычные выплаты 1-го и 16-го относятся к предыдущему месяцу; месяц, указанный в расходнике, имеет приоритет. Выдачи без определённого месяца не включены в итог за месяц, но уже учтены в общем остатке 1С.</p></details>}
  </section>;
}
