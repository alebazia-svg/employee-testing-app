import { getCurrentUser } from '@/lib/auth';
import { applyCreditRealizationEmployeeAction, type CreditRealizationEmployeeAction } from '@/lib/credit-realization-employee-actions';
import { prisma } from '@/lib/prisma';

const actions = new Set<CreditRealizationEmployeeAction>(['not_found', 'not_mine']);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const issueId = Number((await context.params).id);
  const payload = await request.json().catch(() => null);
  const action = String(payload?.action || '') as CreditRealizationEmployeeAction;
  if (!Number.isInteger(issueId) || issueId <= 0 || !actions.has(action)) return Response.json({ error: 'Некорректное действие.' }, { status: 400 });
  try {
    const result = await applyCreditRealizationEmployeeAction({ prisma, issueId, userId: user.id, action });
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ISSUE_NOT_AVAILABLE') return Response.json({ error: 'Проблема уже закрыта или недоступна.' }, { status: 409 });
    throw error;
  }
}
