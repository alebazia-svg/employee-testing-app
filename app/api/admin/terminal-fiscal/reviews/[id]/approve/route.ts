import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { approveFiscalReview } from '@/lib/terminal-fiscal-admin-gate';
import { terminalFiscalEmployeeReviewText } from '@/lib/terminal-fiscal-employee-review';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Нет доступа.' }, { status: 403 });
  const payload = await request.json().catch(() => null);
  if (!Array.isArray(payload?.recipientIds) || !payload.recipientIds.every(Number.isInteger)) return Response.json({ error: 'Обновите список получателей.' }, { status: 400 });
  try {
    return Response.json({ ok: true, ...await approveFiscalReview(prisma, (await context.params).id, admin.id, payload.recipientIds,
      (operationAt, amountKopecks) => terminalFiscalEmployeeReviewText({ operationAt, amountKopecks, sharedShift: true })) });
  } catch (error) {
    const messages: Record<string, string> = { FORBIDDEN: 'Нет доступа.', REVIEW_NOT_AVAILABLE: 'Проверка уже закрыта или изменена. Обновите страницу.',
      NO_RECIPIENTS: 'За этот день нет отмеченных сотрудников розницы. Проверка остаётся у администратора.',
      RECIPIENTS_CHANGED: 'Состав получателей изменился. Обновите страницу перед отправкой.',
      CHECK_ALREADY_EXISTS: 'Чек найден или результат сверки изменился. Сначала обновите страницу.' };
    const message = error instanceof Error ? messages[error.message] : undefined;
    if (message) return Response.json({ error: message }, { status: 409 });
    throw error;
  }
}
