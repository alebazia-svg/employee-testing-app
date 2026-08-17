import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  addEmployeeTerminalFiscalReviewMessage,
  normalizeTerminalFiscalReviewMessage,
} from '@/lib/terminal-fiscal-review-messages';

export async function POST(request: Request, context: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await request.json().catch(() => null);
  const message = normalizeTerminalFiscalReviewMessage(payload?.body);
  if (!message.ok) return Response.json({ error: message.error }, { status: 400 });
  try {
    const result = await addEmployeeTerminalFiscalReviewMessage({
      prisma,
      reviewId: context.params.id,
      employeeId: user.id,
      body: message.body,
    });
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'REVIEW_NOT_AVAILABLE') {
      return Response.json({ error: 'Проверка уже закрыта или недоступна.' }, { status: 409 });
    }
    throw error;
  }
}
