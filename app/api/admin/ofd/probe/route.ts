import { getCurrentUser } from '@/lib/auth';
import { runSabyOfdProbe } from '@/lib/saby-ofd';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const organizationInn = url.searchParams.get('organizationInn')?.trim() || undefined;
  const dateFrom = url.searchParams.get('dateFrom')?.trim() || undefined;
  const dateTo = url.searchParams.get('dateTo')?.trim() || undefined;
  const limitParam = Number(url.searchParams.get('limit') ?? 20);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.trunc(limitParam), 100) : 20;
  const result = await runSabyOfdProbe({ organizationInn, dateFrom, dateTo, limit });

  return Response.json(result, { status: result.ok ? 200 : 503 });
}
