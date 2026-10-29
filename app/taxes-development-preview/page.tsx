import { notFound } from 'next/navigation';
import { AdminIdentityProvider } from '@/components/AdminIdentityProvider';
import { AdminShell } from '@/components/AdminShell';
import { TaxesWorkspace, taxTabs, type TaxTab } from '@/components/taxes/TaxesWorkspace';
import { parsePortalReport } from '@/lib/ausn-portal-view';
import { reportChanges } from '@/lib/ausn-month-review';
import { buildTaxWorkspace } from '@/lib/tax-workspace-data';
import { RefreshFigures } from '@/components/taxes/RefreshFigures';
import { TaxDocumentUpload, UploadChanges } from '../(dashboard)/admin/taxes/TaxDocumentUpload';
import { ownerFullReport, ownerFullReportAfterEns } from './owner-scenario';

export const dynamic = 'force-dynamic';

// Archive as it is in production on 29.10.2026 (file names, types, coverage, statuses).
const archive = [
  ['ENS_OPERATIONS', '2026-06', '2026-08', 'PROCESSED', 'Операции_ЕНС_071306665560_с_26.07.2026_по_26.10.2026.zip', '2026-10-26T00:22:45+03:00'],
  ['AUSN_CALCULATION', '2026-04', '2026-09', 'PROCESSED', 'Справка о состоянии доходов за 2026г (1).pdf', '2026-10-25T21:40:00+03:00'],
  ['USN_DECLARATION_RECEIPT', null, '2025', 'UPLOADED', 'Квитанция о приёме налоговой декларации по УСН за 2025 год.pdf', '2026-10-25T14:00:00+03:00'],
  ['USN_DECLARATION', null, '2025', 'UPLOADED', 'Декларация по УСН c печатью.pdf', '2026-10-25T14:00:00+03:00'],
  ['ENS_OPERATIONS', '2026-04', '2026-07', 'PROCESSED', 'Операции_ЕНС_071306665560_с_01.01.2026_по_07.09.2026.zip', '2026-10-25T13:00:00+03:00'],
  ['ENS_OPERATIONS', '2026-04', '2026-06', 'UPLOADED', 'Операции_ЕНС_071306665560_с_01.04.2026_по_14.08.2026.zip', '2026-10-25T13:00:00+03:00'],
  ['AUSN_INCOME', '2026-04', '2026-09', 'PROCESSED', 'Отчет по операциям от 15.10.2026 18_54.xlsx', '2026-10-25T13:00:00+03:00'],
  ['AUSN_CALCULATION', '2026-04', '2026-06', 'UPLOADED', 'Справка о состоянии доходов за 2026г.pdf', '2026-10-25T13:00:00+03:00'],
  ['AUSN_TRANSITION_NOTICE', null, '2026-04', 'UPLOADED', 'Справка о применении АУСН.pdf', '2026-10-25T13:00:00+03:00'],
  ['USN_DECLARATION_RECEIPT', null, '2026-03', 'UPLOADED', 'Квитанция о приёме налоговой декларации по УСН за 2026 год.pdf', '2026-10-25T13:00:00+03:00'],
  ['USN_DECLARATION', null, '2026-03', 'UPLOADED', 'Декларация по УСН c печатью (1).pdf', '2026-10-25T13:00:00+03:00'],
] as const;

// Real production components with local data only: no database, no writes,
// no production reports, no Telegram. Returns 404 outside development.
export default async function TaxDevelopmentPreview(props: { searchParams?: Promise<{ tab?: string; scenario?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const query = (await props.searchParams) || {};
  const tab: TaxTab = taxTabs.some(([key]) => key === query.tab) ? query.tab as TaxTab : 'overview';
  const scenario = query.scenario === 'today' || query.scenario === 'broken' ? query.scenario : 'fresh';
  const now = scenario === 'fresh' ? new Date('2026-10-25T13:00:00+03:00') : new Date();
  // The archive's latest ENS upload (26.10) covers August, so the shown run is the one after it.
  const full = parsePortalReport(scenario === 'broken' ? ownerFullReportAfterEns.replace('полнота: да', 'полнота: нет') : ownerFullReportAfterEns, 'ausn-executive-full-20261025T080512.md');
  const documents = archive.map(([documentType, coverageFrom, coverageTo, status, originalName, createdAt], index) => ({ id: `preview-${index}`, documentType, coverageFrom, coverageTo, periodKey: coverageTo, status: scenario === 'broken' && index === 0 ? 'PROCESSING_FAILED' : status, originalName, createdAt: new Date(createdAt), uploadedBy: 'Кештова Бэла' }));
  const data = buildTaxWorkspace({ reports: [full], documents, now });
  const changes = reportChanges(parsePortalReport(ownerFullReport, 'ausn-executive-full-20261025T074847.md'), parsePortalReport(ownerFullReportAfterEns, 'ausn-executive-full-20261025T080512.md'));
  const latestDuePeriod = data.plan.at(-1)?.periodKey || '2026-09';
  const demoUpload = (documentType: string, periodKey: string, fixed = true) => <fieldset disabled><TaxDocumentUpload fixedType={fixed ? documentType as never : undefined} defaultDocumentType={documentType as never} defaultPeriod={periodKey} latestDuePeriod={latestDuePeriod} /><p className='mt-2 text-xs font-semibold text-[#866014]'>В демонстрации загрузка выключена.</p></fieldset>;
  const scenarios: Array<[string, string]> = [['fresh', 'свежие данные'], ['today', 'как сейчас'], ['broken', 'поломка']];
  const notice = <div className='tax-callout' data-tone='warn'>
    <strong>Просмотр, ничего не записывается.</strong> Часть цифр — пример. <span className='inline-flex flex-wrap gap-x-3'>{scenarios.map(([key, label]) => <a key={key} href={`/taxes-development-preview?scenario=${key}${tab === 'overview' ? '' : `&tab=${tab}`}`} className='tax-link' style={scenario === key ? { textDecoration: 'underline' } : undefined}>{label}</a>)}</span>
  </div>;
  return <AdminIdentityProvider name='Кештова Бэла'><AdminShell pageTitle='Налоги' pageDescription='Лимит дохода, налог по месяцам и сверка с налоговой.'>
    <TaxesWorkspace
      tab={tab}
      base={`/taxes-development-preview?scenario=${scenario}`}
      {...data}
      documents={documents}
      notice={notice}
      refresh={<RefreshFigures demo />}
      afterUpload={<UploadChanges title='Пример результата загрузки' changes={changes} />}
      upload={({ documentType, periodKey }) => demoUpload(documentType, periodKey)}
      generalUpload={demoUpload('AUSN_KKT', latestDuePeriod, false)}
    />
  </AdminShell></AdminIdentityProvider>;
}
