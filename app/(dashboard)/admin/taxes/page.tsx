import { AlertTriangle, ArrowRight, BellRing, CheckCircle2, FileCheck2, FileWarning, FolderArchive } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
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
const monthLabel = (value: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  const label = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date).replace(/\sг\.$/, '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const dateLabel = (value?: string) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
};
const documentCountLabel = (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'документ' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'документа' : 'документов'}`;
const riskTone = { unknown: 'border-slate-200 bg-slate-50 text-slate-700', normal: 'border-green-200 bg-green-50 text-green-800', early: 'border-amber-200 bg-amber-50 text-amber-900', plan: 'border-orange-200 bg-orange-50 text-orange-900', urgent: 'border-red-200 bg-red-50 text-red-800' } as const;

export default async function TaxesPage() {
  const [report, reports, documents] = await Promise.all([
    loadCurrentAusnReport(),
    loadAusnReportCatalog(),
    prisma.taxControlDocument.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { uploadedBy: { select: { name: true } } } }),
  ]);
  const risk = assessTaxLimitRisk(report);
  const defaultPeriod = report.dataCutoff?.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const periodPlan = buildTaxDocumentPlan({ now: new Date(), reports, documents: documents.map((document) => ({ documentType: document.documentType, periodKey: document.periodKey, coverageFrom: document.coverageFrom, coverageTo: document.coverageTo, originalName: document.originalName, status: document.status, source: 'portal' as const })) });
  const latestDuePeriod = periodPlan.at(-1)?.periodKey || defaultPeriod;
  const nextMissing = periodPlan.find((period) => period.status === 'missing');
  const declarationFile = documents.find((document) => document.documentType === 'USN_DECLARATION');
  const transitionFile = documents.find((document) => document.documentType === 'AUSN_TRANSITION_NOTICE');
  const failedDocuments = documents.filter((document) => document.status === 'PROCESSING_FAILED');
  const sourceCount = Object.keys(report.sourceCompleteness).length;
  const completedPeriods = periodPlan.filter((period) => period.status === 'complete').length;
  const forecastDate = report.dataCutoff && report.forecastDaysToLimit !== undefined
    ? new Date(new Date(`${report.dataCutoff}T12:00:00Z`).getTime() + report.forecastDaysToLimit * 86_400_000)
    : undefined;
  const forecastDateText = forecastDate && !Number.isNaN(forecastDate.getTime())
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(forecastDate)
    : undefined;
  const meaningfulAttention = report.attention.filter((text) => !text.toLowerCase().includes('до лимита аусн'));
  const nextActionTitle = nextMissing
    ? nextMissing.missing.length === 1
      ? `${taxDocumentTypes[nextMissing.missing[0]]} за ${monthLabel(nextMissing.periodKey).toLowerCase()}`
      : `Документы за ${monthLabel(nextMissing.periodKey).toLowerCase()}`
    : 'Документы в порядке';
  const nextLimitNotice = risk.level === 'normal'
    ? 'Первое предупреждение: 80% лимита или 60 дней до его достижения.'
    : risk.level === 'early'
      ? 'Следующее усиление: 90% лимита или 45 дней до его достижения.'
      : risk.level === 'plan'
        ? 'Следующее усиление: 95% лимита или 30 дней до его достижения.'
        : risk.level === 'urgent'
          ? 'Достигнут самый высокий уровень предупреждения.'
          : 'Уведомления начнутся после получения полного отчёта.';

  return <AdminShell pageTitle='Налоги' pageDescription={<span className='md:whitespace-nowrap'>Лимит АУСН и документы по периодам.</span>}>
    <Card className='admin-material-surface overflow-hidden p-0'>
      <div className='flex items-center gap-3 border-b border-slate-200 px-5 py-4'><div className='admin-material-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#263b5c]'>{risk.level === 'normal' ? <CheckCircle2 className='h-5 w-5' /> : <AlertTriangle className='h-5 w-5' />}</div><div><h2 className='text-lg font-extrabold text-slate-950'>Контроль лимита АУСН</h2><p className='text-sm font-medium text-slate-500'>Данные актуальны по {dateLabel(report.dataCutoff)}</p></div></div>
      <div className='p-4 sm:p-5'>
        <div className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${riskTone[risk.level]}`}><div><p className='font-extrabold'>{risk.label}</p><p className='mt-0.5 text-sm font-semibold opacity-80'>{forecastDateText ? `При текущем темпе лимит может быть достигнут около ${forecastDateText}` : risk.explanation}</p></div><p className='shrink-0 text-xs font-bold opacity-65'>Обновлено {runTime(report.runTimeUtc)}</p></div>
        <div className='mt-4 grid divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
          <ExecutiveMetric label='Использовано' value={report.usedPercent === undefined ? '—' : `${report.usedPercent.toLocaleString('ru-RU')}%`} />
          <ExecutiveMetric label='Осталось до лимита' value={report.remaining === undefined ? '—' : `${(report.remaining / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} млн ₽`} />
          <ExecutiveMetric label='Прогноз' value={report.forecastDaysToLimit === undefined ? '—' : `≈ ${report.forecastDaysToLimit} дней`} />
        </div>
      </div>
    </Card>

    <Card className='admin-material-surface mt-4 overflow-hidden p-0'>
      <div className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'><div className='flex min-w-0 gap-3'>{nextMissing ? <FileWarning className='mt-0.5 h-6 w-6 shrink-0 text-amber-600' /> : <CheckCircle2 className='mt-0.5 h-6 w-6 shrink-0 text-green-600' />}<div><p className='text-sm font-bold text-slate-500'>Ближайшее действие</p><h2 className='mt-0.5 text-lg font-extrabold text-slate-950'>{nextActionTitle}</h2></div></div>{nextMissing && <details className='shrink-0'><summary className='inline-flex cursor-pointer list-none items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-slate-800'>Загрузить <ArrowRight className='h-4 w-4 text-[#a77550]' /></summary><div className='mt-4 border-t border-slate-100 pt-4 sm:min-w-[620px]'><TaxDocumentUpload defaultPeriod={nextMissing.periodKey} latestDuePeriod={latestDuePeriod} defaultDocumentType={nextMissing.missing[0]} /></div></details>}</div>
      {meaningfulAttention.length > 0 && <div className='border-t border-slate-100 px-5 py-3'><ul className='space-y-2'>{meaningfulAttention.slice(0, 2).map((text) => <li key={text} className='flex gap-2 text-sm font-semibold leading-relaxed text-slate-600'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-amber-600' />{text}</li>)}</ul></div>}
      {failedDocuments.length > 0 && <div className='border-t border-red-100 bg-red-50 px-5 py-3 text-sm font-bold text-red-800'><AlertTriangle className='mr-2 inline h-4 w-4' />{failedDocuments.length === 1 ? 'Один документ сохранён, но не обновил отчёт. Повторите загрузку.' : `${failedDocuments.length} документов сохранены, но не обновили отчёт. Повторите загрузку.`}</div>}
    </Card>

    <Card className='admin-material-surface mt-4 overflow-hidden p-0'>
      <SectionHeader title='Документы по периодам' description={`${completedPeriods} из ${periodPlan.length} периодов закрыты`} />
      <div className='grid grid-cols-[145px_1fr_110px] gap-3 border-b border-slate-200 bg-[#f4f1ec] px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-500'><span>Период</span><span>Состояние</span><span className='text-right'>Документы</span></div>
      <div className='divide-y divide-slate-100'>{periodPlan.map((period) => { const isNext = period.periodKey === nextMissing?.periodKey; return <details key={period.periodKey} className='group px-5 py-3' open={isNext}><summary className='grid cursor-pointer list-none grid-cols-[145px_1fr_110px] items-center gap-3'><span className='font-extrabold text-slate-950'>{monthLabel(period.periodKey)}</span><span className={`text-sm font-bold ${period.status === 'complete' ? 'text-green-700' : isNext ? 'text-amber-800' : 'text-slate-600'}`}>{period.status === 'complete' ? 'Все документы загружены' : `Не хватает: ${documentCountLabel(period.missing.length)}`}</span><span className='text-right'><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${period.status === 'complete' ? 'bg-green-50 text-green-700' : isNext ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{period.status === 'complete' ? 'Готово' : period.missing.length}</span></span></summary><div className='mt-3 ml-[157px] border-l-2 border-slate-100 pl-4'><div className='space-y-2'>{(['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION'] as const).map((type) => { const present = period.present.includes(type); return <div key={type} className='text-xs font-semibold text-slate-600'><span className={present ? 'text-green-700' : 'text-amber-700'}>{present ? '✓' : '○'}</span> {taxDocumentTypes[type]}{!present && <span className='block pt-1 text-slate-500'>Где взять: {taxDocumentHelp[type].source}</span>}</div>; })}</div>{period.status === 'missing' && <details className='mt-3'><summary className='inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-[#d8c5b6] bg-white px-3 py-2 text-sm font-extrabold text-[#845333] shadow-sm hover:bg-[#fcf8f3]'>Добавить документ <ArrowRight className='h-4 w-4 text-[#a77550]' /></summary><div className='mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4'><TaxDocumentUpload defaultPeriod={period.periodKey} latestDuePeriod={latestDuePeriod} defaultDocumentType={period.missing[0]} /></div></details>}</div></details>; })}</div>
    </Card>

    <details className='admin-material-surface mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white'>
      <summary className='flex cursor-pointer list-none items-center justify-between gap-4 p-5'><span className='flex items-center gap-3'><BellRing className='h-5 w-5 text-[#263b5c]' /><span><span className='block font-extrabold text-slate-950'>Уведомления о лимите</span><span className='text-sm font-semibold text-slate-500'>Портал и подключённый Telegram · {nextLimitNotice}</span></span></span><span className='text-sm font-extrabold text-[#263b5c]'>Правила</span></summary>
      <div className='grid gap-3 border-t border-slate-100 p-5 md:grid-cols-3'><NoticeRule title='Заранее' value='80% или 60 дней' active={risk.level === 'early'} /><NoticeRule title='Нужен план' value='90% или 45 дней' active={risk.level === 'plan'} /><NoticeRule title='Срочно' value='95% или 30 дней' active={risk.level === 'urgent'} /></div>
    </details>

    <details className='admin-material-surface mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white'>
      <summary className='flex cursor-pointer list-none items-center justify-between gap-4 p-5'><span className='flex items-center gap-3'><FolderArchive className='h-5 w-5 text-[#263b5c]' /><span><span className='block font-extrabold text-slate-950'>Архив документов</span><span className='text-sm font-semibold text-slate-500'>{documents.length} файлов · постоянные документы и выгрузки ФНС</span></span></span><span className='text-sm font-extrabold text-[#263b5c]'>Открыть</span></summary>
      <div className='border-t border-slate-100 p-5'><div className='grid gap-3 lg:grid-cols-2'><PermanentDocumentCard title='УСН до 31.03.2026' present={Boolean(declarationFile)} documentId={declarationFile?.id} summary={`${report.usnBaseline ? `${money(report.usnBaseline)} учтено в отчёте.` : 'Подтверждённая сумма не найдена.'} ${declarationFile ? 'Декларация сохранена.' : 'Декларацию нужно загрузить один раз.'}`} helpTitle='Где взять декларацию' help={`${taxDocumentHelp.USN_DECLARATION.instruction} Источник: ${taxDocumentHelp.USN_DECLARATION.source}.`} attention={!declarationFile} /><PermanentDocumentCard title='Переход на АУСН' present={Boolean(transitionFile)} documentId={transitionFile?.id} summary={transitionFile ? 'Подтверждение сохранено.' : 'Документ нужно загрузить один раз.'} helpTitle='Где взять' help={`${taxDocumentHelp.AUSN_TRANSITION_NOTICE.instruction} Источник: ${taxDocumentHelp.AUSN_TRANSITION_NOTICE.source}.`} /></div>{documents.length > 0 && <div className='mt-5 overflow-x-auto rounded-xl border border-slate-200'><table className='w-full min-w-[840px] text-left text-sm'><thead className='bg-slate-50 text-xs uppercase tracking-wide text-slate-500'><tr><th className='px-4 py-3'>Период</th><th>Документ</th><th>Обработка</th><th>Файл</th><th>Действия</th></tr></thead><tbody className='divide-y divide-slate-100'>{documents.map((document) => <tr key={document.id}><td className='px-4 py-3 font-bold'>{document.coverageFrom && document.coverageTo && document.coverageFrom !== document.coverageTo ? `${document.coverageFrom}–${document.coverageTo}` : document.periodKey}</td><td>{taxDocumentTypes[document.documentType as keyof typeof taxDocumentTypes] || document.documentType}</td><td><span className={`rounded-full px-2 py-1 text-xs font-extrabold ${document.status === 'PROCESSED' ? 'bg-green-50 text-green-700' : document.status === 'PROCESSING_FAILED' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{document.status === 'PROCESSED' ? 'Отчёт обновлён' : document.status === 'PROCESSING_FAILED' ? 'Нужна повторная загрузка' : 'В архиве'}</span></td><td className='max-w-[260px] truncate'>{document.originalName}</td><td className='space-x-3 font-bold'><a className='text-[#263b5c]' href={`/api/admin/taxes/documents/${document.id}`} target='_blank'>Открыть</a><a className='text-[#263b5c]' href={`/api/admin/taxes/documents/${document.id}?download=1`}>Скачать</a></td></tr>)}</tbody></table></div>}</div>
    </details>

    <div className='mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3'><p className='flex items-center gap-2 text-sm font-extrabold text-green-800'><CheckCircle2 className='h-5 w-5' />Данные актуальны по {dateLabel(report.dataCutoff)}{sourceCount ? ` · ${sourceCount} источников получены` : ''}</p><details className='text-sm'><summary className='cursor-pointer font-bold text-green-900'>Источники и технические сведения</summary><div className='mt-3 max-w-3xl space-y-2 text-xs font-semibold text-slate-600'>{Object.entries(report.sourceCompleteness).map(([name, value]) => <p key={name}><strong>{name}:</strong> {value}</p>)}<p>Код отчёта: {report.codeVersion || '—'} · AgentAPI: {report.agentApiUser || '—'} / {report.agentApiVersion || '—'} · файл: {report.sourceFile || '—'}</p></div></details></div>
  </AdminShell>;
}

function ExecutiveMetric({ label, value }: { label: string; value: string }) { return <div className='min-w-0 px-4 py-3'><p className='text-[10px] font-extrabold uppercase tracking-wide text-slate-500'>{label}</p><p className='mt-1 truncate text-lg font-black text-slate-950'>{value}</p></div>; }

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <div className='flex items-center gap-3 border-b border-slate-200 px-4 py-4 sm:px-5'><div className='admin-material-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#263b5c]'><FileCheck2 className='h-5 w-5' /></div><div><h2 className='text-lg font-extrabold text-slate-950'>{title}</h2><p className='text-sm font-medium text-slate-500'>{description}</p></div></div>;
}

function NoticeRule({ title, value, active }: { title: string; value: string; active: boolean }) {
  return <div className={`rounded-xl border px-4 py-3 ${active ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}><p className={`text-sm font-extrabold ${active ? 'text-amber-900' : 'text-slate-700'}`}>{title}{active ? ' · сейчас' : ''}</p><p className='mt-1 text-sm font-semibold text-slate-500'>{value}</p></div>;
}

function PermanentDocumentCard({ title, present, documentId, summary, helpTitle, help, attention = false }: { title: string; present: boolean; documentId?: string; summary: string; helpTitle: string; help: string; attention?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${present ? 'border-green-200 bg-green-50/60' : attention ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}><div className='flex items-start gap-3'>{present ? <FileCheck2 className='mt-0.5 h-5 w-5 shrink-0 text-green-700' /> : <FileWarning className={`mt-0.5 h-5 w-5 shrink-0 ${attention ? 'text-amber-700' : 'text-slate-500'}`} />}<div className='min-w-0'><p className='font-extrabold text-slate-950'>{title}</p><p className='mt-1 text-sm font-semibold leading-relaxed text-slate-600'>{summary}</p>{present && documentId && <p className='mt-2 flex flex-wrap gap-3 text-sm font-bold'><a className='text-[#263b5c] hover:text-[#1d304e]' href={`/api/admin/taxes/documents/${documentId}`} target='_blank'>Открыть документ</a><a className='text-[#263b5c] hover:text-[#1d304e]' href={`/api/admin/taxes/documents/${documentId}?download=1`}>Скачать</a></p>}<details className='mt-2 text-sm'><summary className='cursor-pointer font-bold text-[#263b5c]'>{helpTitle}</summary><p className='mt-2 leading-relaxed text-slate-600'>{help}</p></details></div></div></div>;
}
