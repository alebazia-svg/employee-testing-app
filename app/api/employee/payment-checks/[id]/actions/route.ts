import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyTerminalFiscalEmployeeAction, type TerminalFiscalEmployeeAction } from '@/lib/terminal-fiscal-review-actions';

const actions = new Set<TerminalFiscalEmployeeAction>(['open', 'help', 'not_mine', 'undo_not_mine']);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await request.json().catch(() => null);
  const action = payload?.action as TerminalFiscalEmployeeAction;
  if (!actions.has(action)) return Response.json({ error: 'Неизвестное действие.' }, { status: 400 });
  try {
    return Response.json({ ok: true, ...(await applyTerminalFiscalEmployeeAction({ prisma, reviewId: (await context.params).id, userId: user.id, action })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'REVIEW_NOT_AVAILABLE') return Response.json({ error: 'Проверка уже закрыта или недоступна.' }, { status: 409 });
    throw error;
  }
}
