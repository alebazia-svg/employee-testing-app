import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const take = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
  const runId = url.searchParams.get('runId')?.trim();
  const status = url.searchParams.get('status')?.trim();
  const matches = await prisma.terminalFiscalMatch.findMany({
    where: { ...(runId ? { runId } : {}), ...(status ? { status } : {}) },
    take,
    orderBy: { checkedAt: 'desc' },
    select: {
      id: true, matchingId: true, runId: true, mappingId: true, algorithmVersion: true, status: true,
      reasonCode: true, operationType: true, bankOperationAt: true, bankOperationHash: true, oneCSourceRef: true,
      oneCSourceHash: true, ofdFiscalKeyHash: true, candidateCount: true, timeDifferenceSeconds: true,
      graceUntil: true, tbankComplete: true, oneCComplete: true, ofdComplete: true, checkedAt: true,
      createdAt: true, updatedAt: true,
      evaluations: {
        take: 20,
        orderBy: { evaluatedAt: 'desc' },
        select: {
          id: true, cycleKey: true, algorithmVersion: true, status: true, reasonCode: true,
          bankOperationAt: true, candidateCount: true, timeDifferenceSeconds: true, graceUntil: true,
          tbankComplete: true, oneCComplete: true, ofdComplete: true, evaluatedAt: true,
        },
      },
    },
  });
  return Response.json({ matches }, { headers: { 'Cache-Control': 'private, no-store' } });
}
