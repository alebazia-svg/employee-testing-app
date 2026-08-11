import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
  const mappings = await prisma.terminalFiscalMapping.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true, label: true, terminalKey: true, tbankTerminalId: true,
      oneCAcquiringTerminalRef: true, oneCCashRegisterRef: true, kktRegistrationNumber: true,
      effectiveFrom: true, effectiveTo: true, source: true, isActive: true, createdAt: true, updatedAt: true,
    },
  });
  return Response.json({ mappings }, { headers: { 'Cache-Control': 'private, no-store' } });
}
