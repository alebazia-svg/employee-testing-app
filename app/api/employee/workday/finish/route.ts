import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const requestedWorkDayId = typeof payload?.workDayId === 'number' ? payload.workDayId : null;
  const closeStale = payload?.closeStale === true;
  const staleCloseReason = typeof payload?.staleCloseReason === 'string' ? payload.staleCloseReason.trim() : '';
  const staleCloseComment = typeof payload?.staleCloseComment === 'string' ? payload.staleCloseComment.trim() : '';
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

  if (closeStale && isStaleWorkDay) {
    if (!staleCloseReason) {
      return Response.json({ error: 'Выберите причину закрытия предыдущего дня без сдачи смены' }, { status: 400 });
    }
    if (!staleCloseComment) {
      return Response.json({ error: 'Напишите комментарий для администратора' }, { status: 400 });
    }
  }

  if (usesWorkdayShiftControl(user)) {
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
  const staleCloseViolationComment = closeStale && isStaleWorkDay
    ? [
        'НАРУШЕНИЕ: предыдущий рабочий день закрыт без сдачи смены.',
        `Причина: ${staleCloseReason}`,
        `Комментарий сотрудника: ${staleCloseComment}`,
      ].join('\n')
    : '';
  const workDay = await prisma.$transaction(async (tx) => {
    const updatedWorkDay = await tx.workDayEntry.update({
      where: { id: activeWorkDay.id },
      data: {
        endedAt: now,
        status: 'completed',
        comment: closeStale && isStaleWorkDay
          ? [activeWorkDay.comment, staleCloseViolationComment].filter(Boolean).join('\n')
          : activeWorkDay.comment,
      },
    });

    await tx.workdayKkmAssignment.updateMany({
      where: { workDayEntryId: activeWorkDay.id, workstationId: { not: null }, effectiveTo: null },
      data: { effectiveTo: now, changeReason: 'workday_completed' },
    });

    if (closeStale && isStaleWorkDay) {
      await tx.shiftControlRun.updateMany({
        where: { workDayEntryId: activeWorkDay.id, status: { not: 'completed' } },
        data: {
          status: 'completed',
          completedAt: now,
          closingComment: staleCloseViolationComment,
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
