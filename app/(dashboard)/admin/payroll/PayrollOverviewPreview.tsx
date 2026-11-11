'use client';
import { payrollIndividualNote } from '@/lib/payroll-individual-note';
import { payrollDisplayName } from '@/lib/payroll-display-name';
import { useState, type ReactNode } from 'react';
import { payrollDepartmentTone } from './payroll-department-tone';
import { payrollReviewPresentation, payrollEmployeeReviewPresentation, type PayrollReviewTarget } from '@/lib/payroll-review-presentation';
import PayrollReviewPreview from './PayrollProductReview';
import type { PayrollClassifiedSalesRow } from '@/lib/payroll-sales-classification';
import type { PayrollReviewDecision } from '@/lib/payroll-review-save';

type Row = { employeeName: string; shadowGrossPay: number; shadowNetPay: number; advance: number; requiresReview: boolean; detailDifferences: string[] };
type Props = {
  period: string; periodKey?: string; individualAttendanceNote?: string; date: string; updatedAt?: string; costVerified?: boolean; preliminary: boolean; stale: boolean;
  saveReasons?: string[]; exportReasons?: string[];
  periodPicker?: ReactNode;
  columns: { name: string; rows: Row[] }[][];
  issues: string[]; employeeIssues: { employeeName: string; reasons: string[] }[];
  advancesValid: boolean; exportDisabled: boolean; exportLabel?: string;
  saveDisabled?: boolean; onSave?: () => void; onReviewExport?: () => void; reviewExporting?: boolean;
  onEmployee: (name: string) => void; onExport: () => void; onSource: (target?: PayrollReviewTarget, issue?: string) => void;
  advancesLoading?: boolean; attendanceLoading?: boolean;
  advanceDocuments?: { documentNumber: string; documentDate: string; employeeName: string; amount: number }[];
  onProducts: () => Promise<PayrollClassifiedSalesRow[]>;
  onSaveProducts: (decisions: PayrollReviewDecision[]) => Promise<PayrollClassifiedSalesRow[]>;
};
const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);
const button = 'min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 disabled:opacity-40';

export default function PayrollOverviewPreview(p: Props) {
  const [review, setReview] = useState(false);
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

  if (products) return <section className="rounded-xl border border-slate-200 bg-white p-5"><button data-payroll-read-action className={button+' mb-4'} onClick={()=>setProducts(null)}>← Назад к зарплате</button><PayrollReviewPreview embedded rows={products} period={p.period+' · данные по '+p.date} onSave={async decisions=>{const updated=await p.onSaveProducts(decisions);setProducts(updated);}}/></section>;
  return <section id="payroll-overview" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Обзор зарплаты">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">{p.periodPicker ?? <h2 className="text-lg font-bold text-slate-950">{p.period}</h2>}<span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{p.preliminary ? 'Рабочий расчёт' : 'Сверка с финальным'}</span></div>
      <div className="flex flex-wrap gap-2">
        {p.exportDisabled && p.onReviewExport
          ? <button data-payroll-read-action className={button} type="button" disabled={p.reviewExporting} onClick={p.onReviewExport}>{p.reviewExporting ? 'Подготовка…' : 'Скачать для проверки'}</button>
          : <button data-payroll-read-action className={button} type="button" disabled={p.exportDisabled} onClick={p.onExport}>{p.exportLabel ?? 'Скачать ведомость'}</button>}
        {p.onSave && <button type="button" className={button} disabled={p.saveDisabled} onClick={p.onSave}>Сохранить ведомость</button>}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-sm" aria-label="Актуальность расчёта">
      <div><p className="font-bold text-slate-900">Рассчитано по {p.date} включительно</p>
      <p className={'mt-1 text-xs '+(p.costVerified ? 'text-emerald-800' : 'text-amber-800')}>{p.costVerified ? 'Себестоимость рассчитана в 1С' : 'Себестоимость требует проверки'}</p></div>
      {p.stale && <span role="status" className="text-xs text-amber-800">Не удалось обновить</span>}
    </div>
    <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
      {[['Начислено', money(total('shadowGrossPay'))], ['Авансы', p.advancesValid ? money(total('advance')) : 'Не проверены'], ['После авансов и удержаний', p.advancesValid ? money(total('shadowNetPay')) : 'Не подтверждено']].map(([label,value],i)=><div key={label}><p className="text-xs text-slate-500">{label}</p><p className={'mt-0.5 tabular-nums font-bold '+(i===0?'text-xl text-slate-950':'text-lg text-slate-800')}>{value}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 px-4 py-2">
      <button data-payroll-read-action type="button" onClick={()=>setReview(v=>!v)} aria-expanded={review} aria-controls="payroll-preview-checks" className={button+(count?' !border-amber-200 !bg-amber-50 !text-amber-950':'')}>{review?'Скрыть проверку':count?`Проверить · ${count}`:'Проверки пройдены'}</button>
      {p.attendanceLoading && <span role="status" className="text-xs text-slate-500">Рабочие дни обновляются…</span>}
      {(p.saveDisabled || p.exportDisabled) && <details className="max-w-full text-xs text-slate-600">
        <summary className="flex min-h-11 cursor-pointer items-center">Почему ведомость недоступна?</summary>
        <ul className="mb-2 max-w-xl list-disc space-y-1 pl-4">{[...new Set([...(p.saveDisabled ? p.saveReasons ?? [] : []), ...(p.exportDisabled ? p.exportReasons ?? [] : [])])].map(reason=><li key={reason}>{reason}</li>)}</ul>
        <p className="mb-2">Можно скачать начисления и замечания для проверки.</p>
      </details>}
    </div>
    {review&&<section id="payroll-preview-checks" className="border-b border-slate-200 bg-slate-50 p-4" aria-label="Проверка расчёта">
      {!count&&<p className="text-sm text-slate-600">Замечаний нет.</p>}
      <div className="grid gap-2">{sourceIssues.map(issue=>{
        const info=payrollReviewPresentation(issue);
        const busy = info.target === 'products' ? loading : info.target === 'advances' ? p.advancesLoading : info.target === 'attendance' ? p.attendanceLoading : false;
        const documents = info.target === 'advances' ? (p.advanceDocuments ?? []).filter(document => issue.includes(document.documentNumber)) : [];
        return <details key={issue} className="rounded-lg border border-slate-200 bg-white">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-slate-900">{info.title}<span className="ml-2 font-normal text-slate-600">{info.reason}</span></summary>
          <div className="border-t border-slate-100 px-3 py-3 text-sm">
            {documents.map(document=><p key={document.documentNumber+document.employeeName} className="mb-2 text-slate-600">{document.documentDate} · {document.employeeName} · {money(document.amount)}</p>)}
            <p className="text-slate-700">{info.hint}</p>
            {info.reason !== issue && <details className="mt-2 text-xs text-slate-500"><summary className="min-h-8 cursor-pointer">Подробнее</summary><p className="pb-2">{issue}</p></details>}
            <button data-payroll-read-action type="button" disabled={Boolean(busy)} className={button+' mt-3'} onClick={()=>{
              if(info.target!=='products'){p.onSource(info.target, issue);return;}
              setError('');setLoading(true);void p.onProducts().then(setProducts).catch(()=>setError('Не удалось открыть товары. Попробуйте ещё раз.')).finally(()=>setLoading(false));
            }}>{busy ? 'Проверяю…' : info.action}</button>
            {info.target==='products'&&error&&<p role="alert" className="mt-2 text-sm text-amber-800">{error}</p>}
          </div>
        </details>;
      })}
      {employeeIssues.map(e=><details key={e.employeeName} className="rounded-lg border border-slate-200 bg-white">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{payrollDisplayName(e.employeeName)}<span className="ml-2 font-normal text-slate-600">{e.reasons.join('; ') || 'Проверить начисление'}</span></summary>
        <div className="border-t border-slate-100 px-3 py-3 text-sm">
          {e.reasons.map(reason=><p key={reason} className="mb-2 text-slate-700">{payrollEmployeeReviewPresentation(reason).hint}</p>)}
          <button data-payroll-read-action type="button" className={button} onClick={()=>p.onEmployee(e.employeeName)}>Открыть карточку</button>
        </div>
      </details>)}
      {differences.map(r=><details key={r.employeeName} className="rounded-lg border border-slate-200 bg-white">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{payrollDisplayName(r.employeeName)} · отличается от утверждённого</summary>
        <div className="border-t border-slate-100 px-3 py-3"><p className="mb-3 text-sm text-slate-600">{r.detailDifferences.join(', ')}</p><button data-payroll-read-action className={button} onClick={()=>p.onEmployee(r.employeeName)}>Сравнить расчёт</button></div>
      </details>)}
      </div>
    </section>}
    <div className="grid gap-3 p-4 lg:grid-cols-2 min-[1100px]:grid-cols-3" aria-label="Начислено сотрудникам">
      {displayColumns.map((column, columnIndex) => <div key={columnIndex} className="grid min-w-0 content-start gap-3">
        {column.map(g => {
          if (!g.rows.length) return null;
          return <section key={g.name} className="overflow-hidden rounded-lg border border-slate-200" aria-label={g.name}>
            <h3 className={'px-3 py-2 text-xs font-bold '+payrollDepartmentTone(g.name)}>{g.name}</h3>
            <div className="divide-y divide-slate-100">{g.rows.map(r => {
              const needsReview = p.preliminary ? r.requiresReview : r.detailDifferences.length > 0;
              const reasons = employeeIssues.find(e => e.employeeName === r.employeeName)?.reasons ?? [];
              const reviewLabel = reasons.some(reason => /отработанн.*дн|не заполнены.*дни/i.test(reason)) ? 'Не заполнены дни'
                : reasons.some(reason => /опоздан/i.test(reason)) ? 'Не указаны опоздания'
                : reasons.length ? 'Уточнить данные сотрудника' : p.preliminary ? 'Открыть вопрос по сотруднику' : 'Есть отличия от финального';
              const deduction = Math.round((r.shadowGrossPay-r.advance-r.shadowNetPay)*100)/100;
              return <button data-payroll-read-action key={r.employeeName} type="button" onClick={()=>p.onEmployee(r.employeeName)} className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-600">
                <span className="min-w-0 break-words text-sm font-semibold text-slate-900">{payrollDisplayName(r.employeeName)}</span>
                <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-950">{money(r.shadowGrossPay)}</span>
                {payrollIndividualNote(r.employeeName, p.periodKey ?? '', p.individualAttendanceNote) && <span className="col-span-2 text-xs font-medium text-amber-800">{payrollIndividualNote(r.employeeName, p.periodKey ?? '', p.individualAttendanceNote)}</span>}
                {needsReview && reviewLabel && <span title={reasons.join('\n')} className="col-span-2 text-xs font-medium text-amber-800">{reviewLabel}</span>}
                {p.advancesValid && (r.advance!==0 || deduction!==0) && <span className="col-span-2 text-xs leading-relaxed text-slate-600">
                  {r.advance!==0&&<>Аванс: {money(r.advance)} · </>}{deduction!==0&&<>Удержания: {money(deduction)} · </>}После авансов: {money(r.shadowNetPay)}
                </span>}
              </button>;
            })}</div>
          </section>;
        })}
      </div>)}
    </div>
    {!rows.length&&<p className="px-4 pb-4 text-sm text-slate-500">За выбранный месяц сотрудники не найдены.</p>}
    <p className="px-4 pb-3 text-xs text-slate-500">{p.preliminary ? 'Предварительно · оклады и минимумы за полный месяц.' : 'Утверждённая ведомость не меняется.'} Сумма после авансов — не фактический долг; выплаты — во вкладке «Выплаты».</p>
  </section>;
}
