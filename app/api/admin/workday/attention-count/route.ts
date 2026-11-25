import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
import { readWorkdayDecisionCount } from '@/lib/workday-admin-attention';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return new Response(access.response.body, { status: access.response.status, headers });
  try {
    return Response.json(await readWorkdayDecisionCount(prisma, getMoscowDateKey()), { headers });
  } catch {
    return Response.json(null, { status: 503, headers });
  }
}
