import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
import {
  lateArrivalThresholdMinutes,
  validateDeviationReason,
  validateEarlyFinishMinutes,
  type WorkdayDeviationKind,
} from '@/lib/workday-deviation';
import { moscowTaskTime } from '@/lib/workday-notifications';

function serializeDeviation(deviation: {
  id: string;
  workDayEntryId: number;
  kind: string;
  reasonCode: string;
  comment: string;
  lateMinutesSnapshot: number | null;
  requestedEndMinutes: number | null;
  reportedAt: Date;
}) {
  return { ...deviation, reportedAt: deviation.reportedAt.toISOString() };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const kind = payload.kind as WorkdayDeviationKind;
  if (!['late_arrival', 'early_finish'].includes(kind)) {
    return Response.json({ error: 'Неизвестный тип изменения рабочего дня.' }, { status: 400 });
  }
  const reason = validateDeviationReason(kind, payload.reasonCode, payload.comment);
  if (!reason.ok) return Response.json({ error: reason.error }, { status: 400 });

  const today = getMoscowDateKey();
  const workDay = await prisma.workDayEntry.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
    include: {
      deviations: true,
      shiftControlRun: { include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } },
    },
  });
  if (!workDay || workDay.endedAt || workDay.status !== 'active') {
    return Response.json({ error: 'Активный рабочий день не найден.' }, { status: 409 });
  }

  const existing = workDay.deviations.find((item) => item.kind === kind);
  if (existing) return Response.json({ deviation: serializeDeviation(existing), alreadySubmitted: true });

  if (kind === 'late_arrival' && workDay.lateMinutes < lateArrivalThresholdMinutes) {
    return Response.json({ error: 'При опоздании до 5 минут причина не требуется.' }, { status: 409 });
  }

  const earlyTime = kind === 'early_finish'
    ? validateEarlyFinishMinutes(payload.requestedEndTime, workDay.shiftStartMinutes, workDay.shiftEndMinutes)
    : null;
  if (earlyTime && !earlyTime.ok) return Response.json({ error: earlyTime.error }, { status: 400 });
  if (kind === 'early_finish' && (workDay.shiftControlRun?.status !== 'active'
    || !workDay.shiftControlRun.tasks.some((task) => task.category === 'handover' && task.status === 'pending'))) {
    return Response.json({ error: 'Сдача смены для этого рабочего дня недоступна.' }, { status: 409 });
  }

  try {
    const deviation = await prisma.$transaction(async (tx) => {
      // Serialize against concurrent closure of the same workday.
      await tx.$queryRaw`SELECT id FROM "WorkDayEntry" WHERE id = ${workDay.id} FOR UPDATE`;
      const current = await tx.workDayEntry.findUnique({
        where: { id: workDay.id },
        include: { deviations: true, shiftControlRun: { include: { tasks: true } } },
      });
      if (!current || current.endedAt || current.status !== 'active' || current.date !== getMoscowDateKey()) {
        throw new Error('WORKDAY_NO_LONGER_ACTIVE');
      }
      const alreadySaved = current.deviations.find((item) => item.kind === kind);
      if (alreadySaved) return alreadySaved;
      if (kind === 'early_finish' && (current.shiftControlRun?.status !== 'active'
        || !current.shiftControlRun.tasks.some((task) => task.category === 'handover' && task.status === 'pending'))) {
        throw new Error('WORKDAY_NO_LONGER_ACTIVE');
      }
      const created = await tx.workdayDeviation.create({
        data: {
          workDayEntryId: workDay.id,
          userId: user.id,
          kind,
          reasonCode: reason.reasonCode,
          comment: reason.comment,
          lateMinutesSnapshot: kind === 'late_arrival' ? workDay.lateMinutes : null,
          requestedEndMinutes: earlyTime?.ok ? earlyTime.requestedEndMinutes : null,
        },
      });

      if (kind === 'early_finish' && current.shiftControlRun && earlyTime?.ok) {
        const taskIds = current.shiftControlRun.tasks.map((task) => task.id);
        await tx.workdayNotification.updateMany({
          where: {
            taskId: { in: taskIds },
            OR: [
              { status: 'pending' },
              { status: 'sent', readAt: null, pushStatus: { in: ['retry_pending', 'no_subscription', 'not_configured'] } },
            ],
          },
          data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null },
        });
        const handoverTask = current.shiftControlRun.tasks.find((task) => task.category === 'handover');
        if (handoverTask) {
          const scheduledAt = moscowTaskTime(workDay.date, earlyTime.requestedEndMinutes);
          const reminders = [
            { suffix: 'due', scheduledAt },
            { suffix: 'repeat', scheduledAt: new Date(scheduledAt.getTime() + 15 * 60_000) },
          ];
          for (const reminder of reminders) {
            await tx.workdayNotification.create({
              data: {
                userId: user.id,
                taskId: handoverTask.id,
                fingerprint: `workday-deviation:${created.id}:${reminder.suffix}`,
                kind: 'early_finish_reminder',
                title: 'Завершите рабочий день',
                body: 'Продолжите сдачу смены.',
                scheduledAt: reminder.scheduledAt,
              },
            });
          }
        }
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ deviation: serializeDeviation(deviation), alreadySubmitted: false });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKDAY_NO_LONGER_ACTIVE') {
      return Response.json({ error: 'Состояние смены изменилось. Обновите экран.' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return Response.json({ error: 'Состояние смены изменилось. Повторите сохранение.' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.workdayDeviation.findUnique({
        where: { workDayEntryId_kind: { workDayEntryId: workDay.id, kind } },
      });
      if (raced) return Response.json({ deviation: serializeDeviation(raced), alreadySubmitted: true });
    }
    throw error;
  }
}
