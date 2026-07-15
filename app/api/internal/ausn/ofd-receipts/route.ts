import { timingSafeEqual } from 'node:crypto';
import { getCurrentUser } from '@/lib/auth';
import { exportSabyOfdReceipts } from '@/lib/saby-ofd';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function isAuthorized(req: Request) {
  const configuredToken = process.env.AUSN_OFD_EXPORT_TOKEN?.trim();
  const authorization = req.headers.get('authorization') ?? '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';

  if (configuredToken && bearer && safeEquals(bearer, configuredToken)) {
    return true;
  }

  const admin = await getCurrentUser();
  return Boolean(admin && admin.role === 'ADMIN');
}

function parseDateParam(url: URL, name: string) {
  const value = url.searchParams.get(name)?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return value;
}

function daysBetween(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00Z`);
  const to = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function intParam(url: URL, name: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const dateFrom = parseDateParam(url, 'dateFrom');
  const dateTo = parseDateParam(url, 'dateTo');
  if (!dateFrom || !dateTo) {
    return Response.json({ error: 'dateFrom and dateTo are required in YYYY-MM-DD format' }, { status: 400 });
  }
  if (dateFrom > dateTo) {
    return Response.json({ error: 'dateFrom must be earlier than or equal to dateTo' }, { status: 400 });
  }
  if (daysBetween(dateFrom, dateTo) > 62) {
    return Response.json({ error: 'Requested period is too large; use 62 days or less' }, { status: 400 });
  }

  const organizationInn =
    url.searchParams.get('organizationInn')?.trim() ||
    process.env.SABY_OFD_ORGANIZATION_INN?.trim() ||
    '071306665560';
  const queryLimit = intParam(url, 'queryLimit', 1000, 100, 1000);
  const maxDocuments = intParam(url, 'maxDocuments', 10000, 1, 20000);

  const result = await exportSabyOfdReceipts({
    organizationInn,
    dateFrom,
    dateTo,
    queryLimit,
    maxDocuments,
  });

  return Response.json(result, { status: result.ok ? 200 : 503 });
}
