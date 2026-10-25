import { AlertTriangle, CheckCircle2, Database, FileCheck2, FileWarning, Gauge, ReceiptText } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Card } from '@/components/ui/card';
import { loadCurrentAusnReport, assessTaxLimitRisk } from '@/lib/ausn-report-cache';
import { prisma } from '@/lib/prisma';
import { taxDocumentTypes } from '@/lib/tax-document-types';
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
  const [report, documents] = await Promise.all([
    loadCurrentAusnReport(),
    prisma.taxControlDocument.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { uploadedBy: { select: { name: true } } } }),
  ]);
  const risk = assessTaxLimitRisk(report);
  const defaultPeriod = report.dataCutoff?.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const latestByType = new Map(documents.filter((document) => document.periodKey === defaultPeriod).map((document) => [document.documentType, document]));

  return <AdminShell>
    <AdminPageHeader eyebrow='Финансовый контроль' title='Налоги' description='Лимит АУСН, полнота источников, сверка с ФНС и документы по налоговым периодам.' />
    <section className={`mt-5 flex items-start gap-4 rounded-2xl border p-5 ${riskTone[risk.level]}`}>
      {risk.level === 'normal' ? <CheckCircle2 className='mt-0.5 h-6 w-6 shrink-0' /> : <AlertTriangle className='mt-0.5 h-6 w-6 shrink-0' />}
      <div><p className='font-extrabold'>{risk.label}</p><p className='mt-1 text-sm font-medium'>{risk.explanation}</p>{report.dataCutoff && <p className='mt-2 text-xs font-bold opacity-70'>Данные по {report.dataCutoff} · запуск {runTime(report.runTimeUtc)} МСК</p>}</div>
    </section>
    <section className='mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
      <Metric icon={Gauge} label='Использовано лимита' value={report.usedPercent === undefined ? '—' : `${report.usedPercent.toLocaleString('ru-RU')}%`} />
      <Metric icon={ReceiptText} label='Доход с начала года' value={money(report.totalIncome)} />
      <Metric icon={AlertTriangle} label='Осталось до 60 млн' value={money(report.remaining)} />
      <Metric icon={Gauge} label='Прогноз до лимита' value={report.forecastDaysToLimit === undefined ? '—' : `≈ ${report.forecastDaysToLimit} дн.`} detail='По среднему темпу трёх последних полных месяцев' />
      <Metric icon={Database} label='Production runner' value={report.available ? 'Данные получены' : 'Нет свежих данных'} detail={report.agentApiVersion || report.reason} />
    </section>
    <section className='mt-5 grid gap-5 xl:grid-cols-2'>
      <Card className='admin-material-surface p-5'><h2 className='text-lg font-extrabold text-slate-950'>Полнота источников</h2><div className='mt-4 divide-y divide-slate-100'>{Object.keys(report.sourceCompleteness).length ? Object.entries(report.sourceCompleteness).map(([name, value]) => <div key={name} className='flex items-start gap-3 py-3'><CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-green-600' /><div><p className='text-sm font-extrabold text-slate-900'>{name}</p><p className='mt-0.5 text-xs font-medium text-slate-600'>{value}</p></div></div>) : <Empty text='Свежий отчёт не подключён. Без него портал не показывает безопасный статус.' />}</div></Card>
      <Card className='admin-material-surface p-5'><h2 className='text-lg font-extrabold text-slate-950'>Что требует внимания</h2><div className='mt-4 space-y-3'>{report.attention.length ? report.attention.map((text) => <div key={text} className='flex gap-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950'><AlertTriangle className='h-5 w-5 shrink-0 text-amber-600' />{text}</div>) : <Empty text={report.available ? 'В отчёте нет активных замечаний.' : 'Замечания появятся после подключения свежего отчёта.'} />}</div></Card>
    </section>
    <Card className='admin-material-surface mt-5 p-5'><div className='flex items-center gap-3'><FileCheck2 className='h-6 w-6 text-[#263b5c]' /><div><h2 className='text-lg font-extrabold text-slate-950'>Документы ФНС</h2><p className='text-sm font-medium text-slate-500'>Исходный файл хранится с контрольной суммой; повторная загрузка не создаёт дубль.</p></div></div><div className='mt-5'><TaxDocumentUpload defaultPeriod={defaultPeriod} /></div>
      <div className='mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>{Object.entries(taxDocumentTypes).map(([type, label]) => { const document = latestByType.get(type); return <div key={type} className='rounded-2xl border border-slate-200 bg-white p-4'><div className='flex items-start gap-3'>{document ? <FileCheck2 className='h-5 w-5 shrink-0 text-green-600' /> : <FileWarning className='h-5 w-5 shrink-0 text-slate-400' />}<div><p className='text-sm font-extrabold text-slate-900'>{label}</p><p className='mt-1 text-xs font-semibold text-slate-500'>{document ? `${document.originalName} · ${document.createdAt.toLocaleDateString('ru-RU')}` : `За ${defaultPeriod} не загружен`}</p></div></div></div>; })}</div>
      {documents.length > 0 && <div className='mt-6 overflow-x-auto'><table className='w-full min-w-[720px] text-left text-sm'><thead className='text-xs uppercase tracking-wide text-slate-500'><tr><th className='py-2'>Период</th><th>Документ</th><th>Файл</th><th>Статус</th><th>Загрузил</th></tr></thead><tbody className='divide-y divide-slate-100'>{documents.map((document) => <tr key={document.id}><td className='py-3 font-bold'>{document.periodKey}</td><td>{taxDocumentTypes[document.documentType as keyof typeof taxDocumentTypes] || document.documentType}</td><td className='max-w-[260px] truncate'>{document.originalName}</td><td><span className='rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800'>Загружен</span></td><td>{document.uploadedBy.name}</td></tr>)}</tbody></table></div>}
    </Card>
    <footer className='mt-4 text-xs font-medium text-slate-500'>Код отчёта: {report.codeVersion || '—'} · AgentAPI: {report.agentApiUser || '—'} / {report.agentApiVersion || '—'} · файл кэша: {report.sourceFile || '—'}</footer>
  </AdminShell>;
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Gauge; label: string; value: string; detail?: string }) { return <Card className='admin-material-surface p-5'><Icon className='h-5 w-5 text-[#263b5c]' /><p className='mt-4 text-xs font-extrabold uppercase tracking-wide text-slate-500'>{label}</p><p className='mt-1 text-xl font-extrabold text-slate-950'>{value}</p>{detail && <p className='mt-2 line-clamp-2 text-xs font-medium text-slate-500'>{detail}</p>}</Card>; }
function Empty({ text }: { text: string }) { return <p className='rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600'>{text}</p>; }
