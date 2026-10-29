import { requireAdminApi } from '@/lib/admin-api-auth';
import { requestAusnRefresh } from '@/lib/ausn-processing';
import { loadPortalReports } from '@/lib/ausn-portal-view';
import { reportChanges } from '@/lib/ausn-month-review';

export const dynamic = 'force-dynamic';
export const maxDuration = 900;

const latestFullReport = () => loadPortalReports().then((reports) => reports.find((report) => report.kind === 'full')).catch(() => undefined);

// «Обновить цифры»: asks the runner for a fresh canonical calculation without a
// document and reports what changed. The portal itself calculates nothing.
export async function POST() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const before = await latestFullReport();
  const processing = await requestAusnRefresh().catch(() => ({ status: 'failed' as const, message: 'Не удалось запустить пересчёт.' }));
  const changes = processing.status === 'completed' ? reportChanges(before, await latestFullReport()) : [];
  return Response.json({ processing, changes }, { status: processing.status === 'completed' ? 200 : 502 });
}
