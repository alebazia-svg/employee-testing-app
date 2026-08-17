import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const result = await prisma.adminInboxReceipt.updateMany({
    where: { userId: admin.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true, updated: result.count }, { headers: { 'Cache-Control': 'private, no-store' } });
}
