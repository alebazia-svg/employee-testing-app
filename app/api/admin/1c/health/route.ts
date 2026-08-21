import { getAIAgentHealth } from '@/lib/one-c';
import { requireAdminApi } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const health = await getAIAgentHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
}
