import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/AdminShell';
import { TaxesWorkspace, taxTabs, type TaxTab } from '@/components/taxes/TaxesWorkspace';
import { loadPortalReports } from '@/lib/ausn-portal-view';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildTaxWorkspace } from '@/lib/tax-workspace-data';
import { TaxDocumentUpload } from './TaxDocumentUpload';
import { RefreshFigures } from '@/components/taxes/RefreshFigures';

export const dynamic = 'force-dynamic';

export default async function TaxesPage(props: { searchParams?: Promise<{ tab?: string }> }) {
  // Authorize before report files or tax-document queries, independently of layout.
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/login');
  const query = (await props.searchParams) || {};
  const tab: TaxTab = taxTabs.some(([key]) => key === query.tab) ? query.tab as TaxTab : 'overview';
  const [reports, documents] = await Promise.all([
    loadPortalReports(),
    prisma.taxControlDocument.findMany({ orderBy: { createdAt: 'desc' }, include: { uploadedBy: { select: { name: true } } } }),
  ]);
  const now = new Date();
  const data = buildTaxWorkspace({ reports, documents, now });
  const latestDuePeriod = data.plan.at(-1)?.periodKey || now.toISOString().slice(0, 7);
  return <AdminShell pageTitle='Налоги' pageDescription='Лимит дохода, налог по месяцам и сверка с налоговой.'>
    <TaxesWorkspace
      tab={tab}
      base='/admin/taxes'
      {...data}
      documents={documents.map((document) => ({ ...document, uploadedBy: document.uploadedBy?.name }))}
      upload={({ documentType, periodKey }) => <TaxDocumentUpload fixedType={documentType as never} defaultDocumentType={documentType as never} defaultPeriod={periodKey} latestDuePeriod={latestDuePeriod} />}
      refresh={<RefreshFigures />}
      generalUpload={<TaxDocumentUpload defaultDocumentType='AUSN_KKT' defaultPeriod={latestDuePeriod} latestDuePeriod={latestDuePeriod} />}
    />
  </AdminShell>;
}
