import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const caseRow = await prisma.expenseRequestAdminCase.findUnique({ where: { id: (await context.params).id }, select: { oneCRequestRef: true } });
  if (!caseRow) return Response.json({ error: 'Заявка не найдена.' }, { status: 404 });
  const now = new Date();
  const result = await prisma.$transaction(async (db) => {
    const viewed = await db.expenseRequestAdminCase.updateMany({
      where: { id: (await context.params).id, seenAt: null },
      data: { seenAt: now, seenById: admin.id },
    });
    await db.adminInboxReceipt.updateMany({
      where: { userId: admin.id, readAt: null, event: { sourceType: 'expense_request', sourceId: caseRow.oneCRequestRef } },
      data: { readAt: now },
    });
    return viewed;
  });
  return Response.json({ ok: true, updated: result.count }, { headers: { 'Cache-Control': 'private, no-store' } });
}
