import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dismissFiscalReviewAsTestPayment } from '@/lib/terminal-fiscal-admin-gate';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Нет доступа.' }, { status: 403 });
  try {
    return Response.json({ ok: true, ...await dismissFiscalReviewAsTestPayment(prisma, (await context.params).id, admin.id) });
  } catch (error) {
    if (error instanceof Error && error.message === 'REVIEW_NOT_AVAILABLE') return Response.json({ error: 'Проверка уже закрыта.' }, { status: 409 });
    throw error;
  }
}
