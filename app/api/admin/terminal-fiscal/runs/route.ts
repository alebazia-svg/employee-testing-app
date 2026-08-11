import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const take = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
  const mappingId = url.searchParams.get('mappingId')?.trim();
  const runs = await prisma.terminalFiscalMatchRun.findMany({
    where: mappingId ? { mappingId } : undefined,
    take,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, runKey: true, algorithmVersion: true, mappingId: true, periodFrom: true, periodTo: true,
      status: true, cycleKey: true, attemptCount: true, tbankComplete: true, oneCComplete: true,
      ofdComplete: true, tbankCheckedAt: true, oneCCheckedAt: true, ofdCheckedAt: true,
      lastErrorCode: true, startedAt: true, completedAt: true, createdAt: true, updatedAt: true,
      _count: { select: { matches: true, evaluations: true } },
    },
  });
  return Response.json({ runs }, { headers: { 'Cache-Control': 'private, no-store' } });
}
