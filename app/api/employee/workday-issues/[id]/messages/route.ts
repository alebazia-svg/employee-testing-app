import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addEmployeeWorkdayIssueMessage, normalizeWorkdayIssueMessage } from '@/lib/workday-control-issue-messages';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const issueId = Number((await context.params).id);
  if (!Number.isInteger(issueId) || issueId <= 0) return Response.json({ error: 'Некорректная проблема.' }, { status: 400 });
  const payload = await request.json().catch(() => null);
  const message = normalizeWorkdayIssueMessage(payload?.body);
  if (!message.ok) return Response.json({ error: message.error }, { status: 400 });
  try {
    const result = await addEmployeeWorkdayIssueMessage({ prisma, issueId, employeeId: user.id, body: message.body });
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'ISSUE_NOT_AVAILABLE') return Response.json({ error: 'Проблема уже закрыта или недоступна.' }, { status: 409 });
    throw error;
  }
}
