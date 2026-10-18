'use client';
import type { ReactNode } from 'react';
import { payrollDepartmentTone } from './payroll-department-tone';
import { getPayrollWorkbookGroup, sortPayrollWorkbookEmployees } from '@/lib/payroll-workbook';
type Employee = { employeeName: string; salaryType: string; reportGroup?: string; grossPay: number; advance: number; netPay: number; fixedDeduction: number; reasons?: unknown };
const money = (value: number) => value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
export default function PayrollFinalOverview({ employees, periodPicker, runNumber, onEmployee, onExport, exporting, onCompare, comparing }: { employees: Employee[]; periodPicker: ReactNode; runNumber: number; onEmployee: (name: string) => void; onExport: () => void; exporting: boolean; onCompare: () => void; comparing: boolean }) {
  const groups = new Map<string, Employee[]>();
  const total = (key: 'grossPay' | 'advance' | 'netPay') => employees.reduce((sum, row) => sum + Math.round(row[key] * 100), 0) / 100;
  const remarks = (row: Employee) => Array.isArray(row.reasons) ? row.reasons.filter((reason): reason is string => typeof reason === 'string' && Boolean(reason.trim())) : [];
  for (const row of sortPayrollWorkbookEmployees(employees)) {
    const group = row.reportGroup || getPayrollWorkbookGroup(row.salaryType);
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  return <section className='rounded-xl border border-slate-200 bg-white p-4' aria-label='Утверждённое начисление'>
    <div className='flex flex-wrap items-center justify-between gap-3'><div className='flex flex-wrap items-center gap-3'>{periodPicker}<span className='text-sm font-semibold'>Утверждено · ведомость №{runNumber}</span></div><button type='button' disabled={exporting} onClick={onExport} className='min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50'>Скачать ведомость</button></div>
    <div className='my-3 grid gap-3 sm:grid-cols-3'>{[['Начислено за месяц', total('grossPay')], ['Авансы в ведомости', total('advance')], ['После авансов и удержаний', total('netPay')]].map(([label,value]) => <div key={label}><p className='text-xs text-slate-600'>{label}</p><strong className='text-lg'>{money(Number(value))}</strong></div>)}</div>
    <p className='mb-3 text-xs text-slate-500'>Суммы на момент утверждения. Последующие выдачи и текущий остаток — во вкладке «Выплаты».</p>
    <div className='columns-1 gap-3 lg:columns-3'>{Array.from(groups, ([group, rows]) => <section key={group} className='mb-3 break-inside-avoid overflow-hidden rounded-lg border border-slate-200'><h3 className={'px-3 py-2 text-xs font-bold '+payrollDepartmentTone(group)}>{group}</h3>{rows.map(row => <button key={row.employeeName} type='button' onClick={() => onEmployee(row.employeeName)} className='grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50'><span className='min-w-0 break-words'>{row.employeeName}</span><strong className='whitespace-nowrap'>{money(row.grossPay)}</strong>
      {(row.advance !== 0 || row.fixedDeduction !== 0) && <span className='col-span-2 text-xs text-slate-600'>{row.advance !== 0 && <>Аванс: {money(row.advance)} · </>}{row.fixedDeduction !== 0 && <>Удержано: {money(row.fixedDeduction)} · </>}После авансов и удержаний: {money(row.netPay)}</span>}
      {remarks(row).length > 0 && <span className='col-span-2 text-xs text-slate-600'>В утверждённом расчёте: {remarks(row).join('; ')}</span>}
    </button>)}</section>)}</div>
    <div className='mt-3 flex flex-wrap items-center justify-between gap-3'><p className='text-xs text-slate-500'>Начисления сохранены. Обновление данных 1С не меняет утверждённую ведомость.</p><button type='button' onClick={onCompare} className='min-h-11 text-sm font-semibold underline'>{comparing ? 'Скрыть сверку' : 'Сверить с текущими данными'}</button></div>
  </section>;
}
