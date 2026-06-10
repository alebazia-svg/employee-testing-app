import { getAIAgentHealth } from '@/lib/one-c';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await getAIAgentHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
}
