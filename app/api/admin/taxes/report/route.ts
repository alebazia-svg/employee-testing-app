import { requireAdminApi } from '@/lib/admin-api-auth';
import { loadPortalReports, portalFreshness } from '@/lib/ausn-portal-view';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const file = new URL(request.url).searchParams.get('file');
  if (!file || !/^ausn-executive-(?:full|current|20\d{2}-\d{2})-\d{8}T\d{6}\.md$/.test(file)) {
    return Response.json({ error: 'Некорректный идентификатор отчёта.' }, { status: 400 });
  }
  const report = (await loadPortalReports()).find((item) => item.sourceFile === file);
  if (!report || portalFreshness(report).state === 'blocked') {
    return Response.json({ error: 'Полный подтверждённый отчёт не найден.' }, { status: 404 });
  }
  // Preserve the canonical UTF-8 text byte for byte; no HTML/Telegram formatting.
  return new Response(report.canonicalText, { headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': `attachment; filename="${report.sourceFile}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
