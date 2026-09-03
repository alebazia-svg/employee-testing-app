import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';
import { findApprovedCloseException, findOpenRequiredWorkdayIssues } from '@/lib/workday-required-issues';
import { resolveCloseExceptionNotifications } from '@/lib/workday-notifications';
import { notifyAdminsAboutCarriedWorkdayIssues, staleWorkdayCloseAuditComment, validateStaleWorkdayClose } from '@/lib/workday-stale-close';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const requestedWorkDayId = typeof payload?.workDayId === 'number' ? payload.workDayId : null;
  const closeStale = payload?.closeStale === true;
  const staleCloseReason = payload?.staleCloseReason;
  const staleCloseComment = payload?.staleCloseComment;
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

  if (isStaleWorkDay && !closeStale) {
    return Response.json({ error: 'Закройте предыдущую смену через форму причины', code: 'STALE_CLOSE_REASON_REQUIRED' }, { status: 409 });
  }

  const staleCloseInput = closeStale && isStaleWorkDay
    ? validateStaleWorkdayClose({ reason: staleCloseReason, comment: staleCloseComment })
    : null;
  if (staleCloseInput && !staleCloseInput.ok) return Response.json({ error: staleCloseInput.error }, { status: 400 });

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

  const requiredIssues = await findOpenRequiredWorkdayIssues(prisma, user.id, activeWorkDay.date);
  const requiredIssueIds = requiredIssues.map((issue) => issue.id).sort((a, b) => a - b);
  const closeException = requiredIssueIds.length
    ? await findApprovedCloseException(prisma, activeWorkDay.id, requiredIssueIds)
    : null;
  if (requiredIssueIds.length && !closeException && !(closeStale && isStaleWorkDay)) {
    return Response.json({
      error: 'Есть обязательная неисправленная ошибка. Исправьте её или запросите разрешение администратора при технической невозможности.',
      code: 'OPEN_REQUIRED_ISSUES',
      issues: requiredIssues,
    }, { status: 409 });
  }

  const now = new Date();
  const staleCloseViolationComment = staleCloseInput?.ok
    ? staleWorkdayCloseAuditComment({ reasonLabel: staleCloseInput.reason.label, comment: staleCloseInput.comment })
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

    if (closeStale && isStaleWorkDay) {
      await tx.shiftControlRun.updateMany({
        where: { workDayEntryId: activeWorkDay.id, status: { not: 'completed' } },
        data: {
          status: 'completed',
          completedAt: now,
          closingComment: staleCloseViolationComment,
        },
      });
      await tx.shiftControlTask.updateMany({
        where: {
          run: { workDayEntryId: activeWorkDay.id },
          required: true,
          status: { not: 'done' },
        },
        data: {
          status: 'missed',
          comment: 'Не выполнено до закрытия предыдущего рабочего дня',
        },
      });
      await notifyAdminsAboutCarriedWorkdayIssues({
        db: tx,
        employeeId: user.id,
        currentDate: today,
        issues: requiredIssues,
        occurredAt: now,
      });
    }

    if (closeException) {
      await tx.workdayCloseExceptionRequest.update({ where: { id: closeException.id }, data: { consumedAt: now } });
    }

    await resolveCloseExceptionNotifications(tx, {
      workDayEntryId: activeWorkDay.id,
      now,
      scope: 'all',
    });

    return updatedWorkDay;
  });

  return Response.json({
    workDay,
    staleClosed: closeStale && isStaleWorkDay,
  });
}
