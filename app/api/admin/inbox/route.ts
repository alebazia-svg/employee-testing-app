import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const [items, unreadCount] = await Promise.all([
    prisma.adminInboxReceipt.findMany({
      where: { userId: admin.id, ...(unreadOnly ? { readAt: null } : {}) },
      include: { event: true },
      orderBy: { event: { occurredAt: 'desc' } },
      take: limit,
    }),
    prisma.adminInboxReceipt.count({ where: { userId: admin.id, readAt: null } }),
  ]);
  return Response.json({ items, unreadCount }, { headers: { 'Cache-Control': 'private, no-store' } });
}
