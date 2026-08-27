import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const issueId = Number((await context.params).id);
  if (!Number.isInteger(issueId) || issueId <= 0) return Response.json({ error: 'Некорректная проблема.' }, { status: 400 });
  const issue = await prisma.workdayControlIssue.findFirst({
    where: { id: issueId, status: 'open', ruleKey: 'credit_realization_mismatch' },
    select: { id: true },
  });
  if (!issue) return Response.json({ error: 'Активная проверка не найдена.' }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.workdayControlIssue.update({
      where: { id: issue.id },
      data: { status: 'dismissed', employeeActionRequired: false, resolvedAt: new Date(), nextReminderAt: null },
    });
    await tx.workdayNotification.updateMany({
      where: { issueId: issue.id, status: { in: ['pending', 'sent'] } },
      data: { status: 'cancelled' },
    });
  });
  redirect(`/admin/workday/issues/${issue.id}`);
}
