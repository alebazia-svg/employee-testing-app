'use client';
import { useState } from 'react';
import { payrollReviewPresentation } from '@/lib/payroll-review-presentation';
import PayrollReviewPreview from './PayrollProductReview';
import type { PayrollClassifiedSalesRow } from '@/lib/payroll-sales-classification';
import type { PayrollReviewDecision } from '@/lib/payroll-review-save';

type Row = { employeeName: string; shadowGrossPay: number; shadowNetPay: number; advance: number; requiresReview: boolean; detailDifferences: string[] };
type Props = {
  period: string; date: string; preliminary: boolean; stale: boolean;
  columns: { name: string; rows: Row[] }[][];
  issues: string[]; employeeIssues: { employeeName: string; reasons: string[] }[];
  advancesValid: boolean; exportDisabled: boolean;
  onEmployee: (name: string) => void; onExport: () => void; onSource: (target?: 'source' | 'suppliers') => void;
  onProducts: () => Promise<PayrollClassifiedSalesRow[]>;
  onSaveProducts: (decisions: PayrollReviewDecision[]) => Promise<PayrollClassifiedSalesRow[]>;
};
const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);
const button = 'min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 disabled:opacity-40';

export default function PayrollOverviewPreview(p: Props) {
  const [review, setReview] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<PayrollClassifiedSalesRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const groups = p.columns.flat();
  const rows = groups.flatMap(g => g.rows);
  // Keep teams together, but avoid placing a second team below the longest column.
  const displayColumns = p.columns.map(column => [...column]);
  const columnWeight = (column: typeof groups) => column.reduce((sum, group) => sum + 1 + group.rows.reduce((weight, row) => weight + 1 + (row.advance !== 0 || row.requiresReview ? 0.5 : 0), 0), 0);
  if (displayColumns.length === 3) {
    const longest = displayColumns.reduce((best, column, index) => columnWeight(column) > columnWeight(displayColumns[best]) ? index : best, 0);
    const shortest = displayColumns.reduce((best, column, index) => columnWeight(column) < columnWeight(displayColumns[best]) ? index : best, 0);
    const tail = displayColumns[longest].at(-1);
    if (longest !== shortest && tail && displayColumns[longest].length > 1 && columnWeight(displayColumns[shortest]) + columnWeight([tail]) < columnWeight(displayColumns[longest])) {
      displayColumns[longest].pop();
      displayColumns[shortest].push(tail);
    }
  }
  const total = (key: 'shadowGrossPay' | 'shadowNetPay' | 'advance') => rows.reduce((sum, r) => sum + Math.round((r[key] + Number.EPSILON) * 100), 0) / 100;
  const sourceIssues = [...new Set(p.issues)];
  const employeeIssues = p.employeeIssues.map(e=>({...e,reasons:[...new Set(e.reasons)]}));
  const differences = p.preliminary ? [] : rows.filter(r=>r.detailDifferences.length && !employeeIssues.some(e=>e.employeeName===r.employeeName));
  const count = sourceIssues.length + employeeIssues.length + differences.length;
  const topics = [...new Set(sourceIssues.map(i=>payrollReviewPresentation(i).title))];
  if (employeeIssues.length) topics.push('Данные сотрудников');
  if (differences.length) topics.push('Различия с финальным');

  const tones = ['bg-amber-50/70', 'bg-blue-50/70', 'bg-emerald-50/60', 'bg-violet-50/60', 'bg-slate-100/70'];
  if (products) return <section className="rounded-xl border border-slate-200 bg-white p-5"><button className={button+' mb-4'} onClick={()=>setProducts(null)}>← Назад к зарплате</button><PayrollReviewPreview embedded rows={products} period={p.period+' · данные по '+p.date} onSave={async decisions=>{const updated=await p.onSaveProducts(decisions);setProducts(updated);}}/></section>;
  return <section id="payroll-overview" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Обзор зарплаты">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold text-slate-950">{p.period}</h2><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{p.preliminary ? 'Рабочий расчёт' : 'Сверка с финальным'}</span></div>
      <p className={'text-sm '+(p.stale?'text-amber-800':'text-slate-500')}>{p.stale?'Последние сохранённые данные':'Данные'} по {p.date}</p>
    </div>
    <div className="grid gap-4 px-5 py-5 min-[1100px]:grid-cols-3">
      {[['Начислено', money(total('shadowGrossPay'))], ['Выдано авансами', p.advancesValid ? money(total('advance')) : 'Нужно проверить'], ['После авансов', p.advancesValid ? money(total('shadowNetPay')) : 'Не подтверждено']].map(([label,value],i)=><div key={label}><p className="text-sm text-slate-500">{label}</p><p className={'mt-1 tabular-nums font-bold tracking-tight '+(i===0?'text-3xl text-slate-950':'text-2xl text-slate-800')}>{value}</p></div>)}
    </div>
    <div className="mx-5 mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
      {count ? <><strong className="text-amber-900">До утверждения: </strong>{topics.join(' · ')}. <span className="text-slate-500">Вопросов: {count}.</span></> : <><strong>В доступных данных вопросов нет.</strong> Расчёт не утверждается автоматически.</>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 px-5 py-3">
      <button type="button" onClick={()=>setReview(v=>!v)} aria-expanded={review} aria-controls="payroll-preview-checks" className={button+(count?' !border-amber-200 !bg-amber-50 !text-amber-950':'')}>{review?'Закрыть проверку':count?'Разобрать вопросы':'Посмотреть проверки'}</button>
      <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="payroll-employee-search">Найти сотрудника</label><input id="payroll-employee-search" type="search" placeholder="Найти сотрудника" value={query} onChange={e=>setQuery(e.target.value)} className="min-h-11 w-48 rounded-lg border border-slate-300 bg-white px-3 text-sm"/><button className={button} type="button" disabled={p.exportDisabled} onClick={p.onExport}>Скачать Excel</button></div>
    </div>
    {review&&<section id="payroll-preview-checks" className="border-b border-slate-200 bg-slate-50 p-5" aria-label="Проверка расчёта">
      <h3 className="mb-3 font-bold">Что нужно проверить</h3>
      {!count&&<p className="text-sm text-slate-600">В доступных данных вопросов не найдено. Это не утверждение ведомости.</p>}
      <div className="grid gap-2">{sourceIssues.map(issue=>{const info=payrollReviewPresentation(issue); return <article key={issue} className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h4 className="text-sm font-bold text-slate-900">{info.title}</h4><p className="mt-1 text-sm text-slate-700">{issue}</p></div>
        <button type="button" disabled={info.target==='products'&&loading} className={button} onClick={()=>{if(info.target!=='products'){p.onSource(info.target);return;}setError('');setLoading(true);void p.onProducts().then(setProducts).catch(()=>setError('Не удалось загрузить строки. Начисления не изменены. Повторите попытку.')).finally(()=>setLoading(false));}}>{info.target==='products'&&loading?'Загрузка строк…':info.action}</button></div>
        <p className="mt-2 text-sm text-slate-500">{info.hint}</p>
        {info.target==='products'&&error&&<p role="alert" className="mt-2 text-sm text-amber-800">{error}</p>}
      </article>;})}
      {employeeIssues.map(e=><div key={e.employeeName} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"><div><p className="text-sm font-semibold">{e.employeeName}</p><p className="mt-1 text-sm text-slate-600">{e.reasons.join('; ') || 'Проверить составляющие расчёта'}</p></div><button type="button" className={button} onClick={()=>p.onEmployee(e.employeeName)}>Открыть расчёт</button></div>)}
      {differences.map(r=><div key={r.employeeName} className="rounded-lg border border-slate-200 bg-white p-4"><h4 className="text-sm font-bold">{r.employeeName} · отличается от финального</h4><p className="my-2 text-sm text-slate-600">{r.detailDifferences.join(', ')}</p><button className={button} onClick={()=>p.onEmployee(r.employeeName)}>Сравнить расчёт</button></div>)}
      <p className="mt-2 text-xs text-slate-500">Вопрос считается решённым после сохранения и повторной проверки. Сохранённые ведомости не изменяются.</p></div>
    </section>}
    <p className="px-4 pt-3 text-xs text-slate-500">Напротив имени — начислено. Нажмите на сотрудника для подробностей.</p>
    <div className="grid gap-3 p-4 lg:grid-cols-2 min-[1100px]:grid-cols-3" aria-label="Начислено сотрудникам">
      {displayColumns.map((column, columnIndex) => <div key={columnIndex} className="grid min-w-0 content-start gap-3">
        {column.map(g => {
          const visible = g.rows.filter(r => r.employeeName.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
          if (!visible.length) return null;
          return <section key={g.name} className="overflow-hidden rounded-lg border border-slate-200" aria-label={g.name}>
            <h3 className={'px-3 py-2 text-xs font-bold text-slate-700 '+tones[groups.indexOf(g)%tones.length]}>{g.name}</h3>
            <div className="divide-y divide-slate-100">{visible.map(r => {
              const needsReview = p.preliminary ? r.requiresReview : r.detailDifferences.length > 0;
              const deduction = Math.round((r.shadowGrossPay-r.advance-r.shadowNetPay)*100)/100;
              return <button key={r.employeeName} type="button" onClick={()=>p.onEmployee(r.employeeName)} className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-600">
                <span className="min-w-0 break-words text-sm font-semibold text-slate-900">{r.employeeName}</span>
                <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-950">{money(r.shadowGrossPay)}</span>
                {needsReview&&<span className="col-span-2 text-xs font-medium text-amber-800">Проверить расчёт</span>}
                {!p.advancesValid ? <span className="col-span-2 text-xs text-amber-800">Авансы требуют проверки</span> : (r.advance!==0 || deduction!==0) && <span className="col-span-2 text-xs leading-relaxed text-slate-600">
                  {r.advance!==0&&<>Аванс: {money(r.advance)} · </>}{deduction!==0&&<>Удержания: {money(deduction)} · </>}После авансов: {money(r.shadowNetPay)}
                </span>}
              </button>;
            })}</div>
          </section>;
        })}
      </div>)}
    </div>
    {!rows.some(r=>r.employeeName.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))&&<p className="px-5 pb-4 text-sm text-slate-500">Сотрудник не найден. Измените поиск.</p>}
    <p className="px-5 py-3 text-xs text-slate-500">«После авансов» также учитывает удержания. Обычные выплаты зарплаты ещё не сверены — это не подтверждённый долг сотрудникам. {p.preliminary?'Месячные оклады и минимальная зарплата показаны полностью.':''}</p>
  </section>;
}
