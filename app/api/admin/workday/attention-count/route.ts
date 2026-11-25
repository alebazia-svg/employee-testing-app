import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
import { readWorkdayAttention } from '@/lib/workday-review-attention';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return new Response(access.response.body, { status: access.response.status, headers });
  try {
    return Response.json(await readWorkdayAttention(prisma, getMoscowDateKey()), { headers });
  } catch {
    return Response.json(null, { status: 503, headers });
  }
}
