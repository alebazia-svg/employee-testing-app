import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const requestedWorkDayId = typeof payload?.workDayId === 'number' ? payload.workDayId : null;
  const closeStale = payload?.closeStale === true;
  const today = getMoscowDateKey();

  const activeWorkDay = requestedWorkDayId
    ? await prisma.workDayEntry.findFirst({
        where: { id: requestedWorkDayId, userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null },
      })
    : await prisma.workDayEntry.findFirst({
        where: { userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });

  if (!activeWorkDay) {
    return Response.json({ error: 'Нет активного рабочего дня' }, { status: 404 });
  }

  const isStaleWorkDay = activeWorkDay.date < today;

  if (user.department === 'retail' || user.department === 'wholesale') {
    const shiftControlRun = await prisma.shiftControlRun.findUnique({
      where: { workDayEntryId: activeWorkDay.id },
      include: { tasks: { where: { category: 'handover' }, take: 1 } },
    });
    const handoverTask = shiftControlRun?.tasks[0];

    if (shiftControlRun && handoverTask && handoverTask.status !== 'done' && !(closeStale && isStaleWorkDay)) {
      return Response.json({ error: 'Сначала сдайте смену', code: 'SHIFT_CONTROL_HANDOVER_REQUIRED' }, { status: 409 });
    }
  }

  const now = new Date();
  const staleCloseComment = 'Зависший рабочий день закрыт позже без сдачи смены.';
  const workDay = await prisma.$transaction(async (tx) => {
    const updatedWorkDay = await tx.workDayEntry.update({
      where: { id: activeWorkDay.id },
      data: {
        endedAt: now,
        status: 'completed',
        comment: closeStale && isStaleWorkDay
          ? [activeWorkDay.comment, staleCloseComment].filter(Boolean).join('\n')
          : activeWorkDay.comment,
      },
    });

    if (closeStale && isStaleWorkDay) {
      await tx.shiftControlRun.updateMany({
        where: { workDayEntryId: activeWorkDay.id, status: { not: 'completed' } },
        data: {
          status: 'completed',
          completedAt: now,
          closingComment: staleCloseComment,
        },
      });
    }

    return updatedWorkDay;
  });

  return Response.json({
    workDay,
    staleClosed: closeStale && isStaleWorkDay,
  });
}
