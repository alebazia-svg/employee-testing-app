import { AlertTriangle, CheckCircle2, Database, FileCheck2, FileWarning, Gauge, ReceiptText } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminMetricCard } from '@/components/admin/AdminMetricCard';
import { Card } from '@/components/ui/card';
import { loadAusnReportCatalog, loadCurrentAusnReport, assessTaxLimitRisk } from '@/lib/ausn-report-cache';
import { prisma } from '@/lib/prisma';
import { taxDocumentTypes } from '@/lib/tax-document-types';
import { buildTaxDocumentPlan, taxDocumentHelp } from '@/lib/tax-document-plan';
import { TaxDocumentUpload } from './TaxDocumentUpload';

export const dynamic = 'force-dynamic';

const money = (value?: number) => value === undefined ? '—' : `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const runTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(date);
};
const riskTone = { unknown: 'border-slate-200 bg-slate-50 text-slate-700', normal: 'border-green-200 bg-green-50 text-green-800', early: 'border-amber-200 bg-amber-50 text-amber-900', plan: 'border-orange-200 bg-orange-50 text-orange-900', urgent: 'border-red-200 bg-red-50 text-red-800' } as const;

export default async function TaxesPage() {
  const [report, reports, documents] = await Promise.all([
    loadCurrentAusnReport(),
    loadAusnReportCatalog(),
    prisma.taxControlDocument.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { uploadedBy: { select: { name: true } } } }),
  ]);
  const risk = assessTaxLimitRisk(report);
  const defaultPeriod = report.dataCutoff?.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const periodPlan = buildTaxDocumentPlan({ now: new Date(), reports, documents: documents.map((document) => ({ documentType: document.documentType, periodKey: document.periodKey, originalName: document.originalName, source: 'portal' as const })) });
  const nextMissing = periodPlan.find((period) => period.status === 'missing');
  const declarationFile = documents.find((document) => document.documentType === 'USN_DECLARATION');
  const transitionFile = documents.find((document) => document.documentType === 'AUSN_TRANSITION_NOTICE');

  return <AdminShell>
    <AdminPageHeader eyebrow='Финансовый контроль' title='Налоги' description='Лимит АУСН, полнота источников, сверка с ФНС и документы по налоговым периодам.' />
    <section className={`mt-5 flex items-start gap-4 rounded-2xl border p-5 ${riskTone[risk.level]}`}>
      {risk.level === 'normal' ? <CheckCircle2 className='mt-0.5 h-6 w-6 shrink-0' /> : <AlertTriangle className='mt-0.5 h-6 w-6 shrink-0' />}
      <div><p className='font-extrabold'>{risk.label}</p><p className='mt-1 text-sm font-medium'>{risk.explanation}</p>{report.dataCutoff && <p className='mt-2 text-xs font-bold opacity-70'>Данные по {report.dataCutoff} · запуск {runTime(report.runTimeUtc)} МСК</p>}</div>
    </section>
    <section className='mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5'>
      <AdminMetricCard icon={Gauge} label='Использовано лимита' value={report.usedPercent === undefined ? '—' : `${report.usedPercent.toLocaleString('ru-RU')}%`} tone={risk.level === 'urgent' ? 'red' : risk.level === 'plan' || risk.level === 'early' ? 'amber' : 'green'} />
      <AdminMetricCard icon={ReceiptText} label='Доход с начала года' value={money(report.totalIncome)} tone='slate' />
      <AdminMetricCard icon={AlertTriangle} label='Осталось до 60 млн' value={money(report.remaining)} tone={risk.level === 'urgent' ? 'red' : 'amber'} />
      <AdminMetricCard icon={Gauge} label='Прогноз до лимита' value={report.forecastDaysToLimit === undefined ? '—' : `≈ ${report.forecastDaysToLimit} дн.`} detail='По среднему темпу трёх последних полных месяцев' tone='slate' />
      <AdminMetricCard icon={Database} label='Production runner' value={report.available ? 'Данные получены' : 'Нет свежих данных'} detail={report.agentApiVersion || report.reason} tone={report.available ? 'green' : 'red'} />
    </section>
    <section className='mt-5 grid gap-5 xl:grid-cols-2'>
      <Card className='admin-material-surface p-5'><h2 className='text-lg font-extrabold text-slate-950'>Полнота источников</h2><div className='mt-4 divide-y divide-slate-100'>{Object.keys(report.sourceCompleteness).length ? Object.entries(report.sourceCompleteness).map(([name, value]) => <div key={name} className='flex items-start gap-3 py-3'><CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-green-600' /><div><p className='text-sm font-extrabold text-slate-900'>{name}</p><p className='mt-0.5 text-xs font-medium text-slate-600'>{value}</p></div></div>) : <Empty text='Свежий отчёт не подключён. Без него портал не показывает безопасный статус.' />}</div></Card>
      <Card className='admin-material-surface p-5'><h2 className='text-lg font-extrabold text-slate-950'>Что требует внимания</h2><div className='mt-4 space-y-3'>{report.attention.length ? report.attention.map((text) => <div key={text} className='flex gap-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950'><AlertTriangle className='h-5 w-5 shrink-0 text-amber-600' />{text}</div>) : <Empty text={report.available ? 'В отчёте нет активных замечаний.' : 'Замечания появятся после подключения свежего отчёта.'} />}</div></Card>
    </section>
    <Card className='admin-material-surface mt-5 overflow-hidden p-0'><SectionHeader title='Документы ФНС' description='Портал ведёт периоды по порядку и показывает первый незакрытый месяц без пропусков.' />
      <div className='p-4 sm:p-5'>
      <p className='text-xs font-extrabold uppercase tracking-[0.08em] text-slate-500'>Постоянный архив</p>
      <div className='mt-3 grid gap-3 lg:grid-cols-2'>
        <PermanentDocumentCard title='УСН до 31.03.2026' present={Boolean(declarationFile)} documentId={declarationFile?.id} summary={`${report.usnBaseline ? `${money(report.usnBaseline)} уже учтено production runner.` : 'Подтверждённая сумма в текущем runner не найдена.'} ${declarationFile ? 'Оригинал декларации сохранён в постоянном архиве.' : 'Самого файла декларации в портале пока нет — его нужно загрузить один раз для архива.'}`} helpTitle='Где взять декларацию' help={`${taxDocumentHelp.USN_DECLARATION.instruction} Источник: ${taxDocumentHelp.USN_DECLARATION.source}.`} attention={!declarationFile} />
        <PermanentDocumentCard title='Подтверждение перехода на АУСН' present={Boolean(transitionFile)} documentId={transitionFile?.id} summary={transitionFile ? 'Документ сохранён в постоянном архиве.' : 'Файла в портале пока нет. Его достаточно загрузить один раз.'} helpTitle='Где взять' help={`${taxDocumentHelp.AUSN_TRANSITION_NOTICE.instruction} Источник: ${taxDocumentHelp.AUSN_TRANSITION_NOTICE.source}.`} />
      </div>
      {nextMissing ? <div className='mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4'><p className='font-extrabold text-amber-950'>Следующий незакрытый период — {nextMissing.periodKey}</p><p className='mt-1 text-sm font-semibold text-amber-900'>Не хватает: {nextMissing.missing.map((type) => taxDocumentTypes[type]).join(', ')}.</p></div> : <div className='mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 font-bold text-green-800'>Все наступившие периоды закрыты документами.</div>}
      <div className='mt-5'><TaxDocumentUpload defaultPeriod={nextMissing?.periodKey || defaultPeriod} /></div>
      <div className='mt-6 space-y-3'>{periodPlan.map((period) => <details key={period.periodKey} className={`rounded-2xl border p-4 ${period.status === 'complete' ? 'border-green-200 bg-green-50/40' : 'border-slate-200 bg-white'}`} open={period.periodKey === nextMissing?.periodKey}><summary className='flex cursor-pointer list-none items-center justify-between gap-3'><span className='flex items-center gap-3'>{period.status === 'complete' ? <FileCheck2 className='h-5 w-5 text-green-600' /> : <FileWarning className='h-5 w-5 text-amber-600' />}<span><span className='block font-extrabold text-slate-950'>{period.periodKey}</span><span className='text-xs font-semibold text-slate-500'>{period.status === 'complete' ? 'Комплект подтверждён' : `Не хватает ${period.missing.length} из ${period.present.length + period.missing.length}`}</span></span></span><span className='text-xs font-bold text-[#263b5c]'>Состав и источники</span></summary><div className='mt-4 grid gap-3 md:grid-cols-3'>{(['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION'] as const).map((type) => { const present = period.present.includes(type); return <div key={type} className='rounded-xl border border-slate-200 bg-white p-3'><p className='flex items-center gap-2 text-sm font-extrabold text-slate-900'>{present ? <CheckCircle2 className='h-4 w-4 text-green-600' /> : <FileWarning className='h-4 w-4 text-amber-600' />}{taxDocumentTypes[type]}</p><p className='mt-2 text-xs font-semibold text-slate-500'>{present ? 'Есть в runner или загружено в портал' : `Где взять: ${taxDocumentHelp[type].source}`}</p><p className='mt-1 text-xs leading-relaxed text-slate-600'>{taxDocumentHelp[type].instruction}</p></div>; })}</div><p className='mt-3 text-xs font-semibold text-slate-500'>Детализация ККТ и документы корректировок загружаются только при расхождениях, поэтому отсутствие этих файлов не создаёт пропуск.</p></details>)}</div>
      {documents.length > 0 && <div className='mt-6 overflow-x-auto rounded-xl border border-slate-200'><table className='w-full min-w-[820px] text-left text-sm'><thead className='bg-slate-50 text-xs uppercase tracking-wide text-slate-500'><tr><th className='px-4 py-3'>Период</th><th>Документ</th><th>Файл</th><th>Статус</th><th>Загрузил</th><th>Действия</th></tr></thead><tbody className='divide-y divide-slate-100'>{documents.map((document) => <tr key={document.id} className='hover:bg-slate-50/70'><td className='px-4 py-3 font-bold'>{document.periodKey}</td><td>{taxDocumentTypes[document.documentType as keyof typeof taxDocumentTypes] || document.documentType}</td><td className='max-w-[260px] truncate'>{document.originalName}</td><td><span className='rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800'>Загружен</span></td><td>{document.uploadedBy.name}</td><td className='space-x-3 font-bold'><a className='text-[#263b5c] hover:text-[#1d304e]' href={`/api/admin/taxes/documents/${document.id}`} target='_blank'>Открыть</a><a className='text-[#263b5c] hover:text-[#1d304e]' href={`/api/admin/taxes/documents/${document.id}?download=1`}>Скачать</a></td></tr>)}</tbody></table></div>}
      </div>
    </Card>
    <footer className='mt-4 text-xs font-medium text-slate-500'>Код отчёта: {report.codeVersion || '—'} · AgentAPI: {report.agentApiUser || '—'} / {report.agentApiVersion || '—'} · файл кэша: {report.sourceFile || '—'}</footer>
  </AdminShell>;
}

function Empty({ text }: { text: string }) { return <p className='rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600'>{text}</p>; }

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <div className='flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5'><div className='admin-material-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#263b5c]'><FileCheck2 className='h-5 w-5' /></div><div><h2 className='text-lg font-extrabold text-slate-950'>{title}</h2><p className='text-sm font-medium text-slate-500'>{description}</p></div></div>;
}

function PermanentDocumentCard({ title, present, documentId, summary, helpTitle, help, attention = false }: { title: string; present: boolean; documentId?: string; summary: string; helpTitle: string; help: string; attention?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${present ? 'border-green-200 bg-green-50/60' : attention ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}><div className='flex items-start gap-3'>{present ? <FileCheck2 className='mt-0.5 h-5 w-5 shrink-0 text-green-700' /> : <FileWarning className={`mt-0.5 h-5 w-5 shrink-0 ${attention ? 'text-amber-700' : 'text-slate-500'}`} />}<div className='min-w-0'><p className='font-extrabold text-slate-950'>{title}</p><p className='mt-1 text-sm font-semibold leading-relaxed text-slate-600'>{summary}</p>{present && documentId && <p className='mt-2 flex flex-wrap gap-3 text-sm font-bold'><a className='text-[#263b5c] hover:text-[#1d304e]' href={`/api/admin/taxes/documents/${documentId}`} target='_blank'>Открыть документ</a><a className='text-[#263b5c] hover:text-[#1d304e]' href={`/api/admin/taxes/documents/${documentId}?download=1`}>Скачать</a></p>}<details className='mt-2 text-sm'><summary className='cursor-pointer font-bold text-[#263b5c]'>{helpTitle}</summary><p className='mt-2 leading-relaxed text-slate-600'>{help}</p></details></div></div></div>;
}
