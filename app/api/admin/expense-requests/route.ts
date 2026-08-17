import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { expenseRequestCurrentWhere } from '@/lib/expense-request-admin-lifecycle';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const countOnly = url.searchParams.get('countOnly') === 'true';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 200);
  const where = { ...expenseRequestCurrentWhere, ...(unreadOnly ? { seenAt: null } : {}) };
  if (countOnly) {
    return Response.json({ count: await prisma.expenseRequestAdminCase.count({ where }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const cases = await prisma.expenseRequestAdminCase.findMany({
    where,
    take: limit,
    orderBy: [{ seenAt: { sort: 'asc', nulls: 'first' } }, { oneCDate: 'desc' }],
    include: {
      evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 },
      feedback: { orderBy: { createdAt: 'desc' }, take: 1, include: { reviewedBy: { select: { id: true, name: true } } } },
    },
  });
  return Response.json({ cases }, { headers: { 'Cache-Control': 'private, no-store' } });
}
