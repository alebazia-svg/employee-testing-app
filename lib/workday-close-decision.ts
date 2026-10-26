import type { Prisma, PrismaClient } from '@prisma/client';
import { isCashEncashmentException } from './workday-cash-encashment-exception';
import { resolveCloseExceptionNotifications, resolveTaskNotifications } from './workday-notifications';

function record(value: unknown): Record<string, Prisma.InputJsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Prisma.InputJsonValue> : {};
}

// The decision and completion belong to one server transaction. A phone is
// only a reader of the result, including phones running an older PWA version.
export async function decideWorkdayCloseException(db: PrismaClient, input: {
  requestId: string;
  adminId: number;
  status: 'approved' | 'rejected';
  decisionComment: string;
}) {
  return db.$transaction(async (tx) => {
    const initial = await tx.workdayCloseExceptionRequest.findUnique({ where: { id: input.requestId } });
    if (!initial) return null;
    // Match the workday-first lock order used by employee completion. Requests
    // for the same workday and repeated admin clicks must serialize together.
    await tx.$queryRaw`SELECT id FROM "WorkDayEntry" WHERE id = ${initial.workDayEntryId} FOR UPDATE`;
    const request = await tx.workdayCloseExceptionRequest.findUniqueOrThrow({ where: { id: initial.id } });
    if (request.status !== 'pending') return { request, changed: false };
    const workDay = await tx.workDayEntry.findUniqueOrThrow({ where: { id: request.workDayEntryId } });
    if (workDay.userId !== request.employeeId) throw new Error('Сотрудник запроса не совпадает со сменой');

    const now = new Date();
    const cashException = isCashEncashmentException(request.reasonCode);
    const active = !workDay.endedAt && ['active', 'missing_checkout'].includes(workDay.status);
    const closing = input.status === 'approved' && active;
    const claimed = await tx.workdayCloseExceptionRequest.updateMany({
      where: { id: request.id, status: 'pending' },
      data: {
        status: input.status, decisionComment: input.decisionComment, decidedById: input.adminId, decidedAt: now,
        ...(input.status === 'approved' ? { consumedAt: workDay.endedAt ?? now } : {}),
      },
    });
    if (!claimed.count) return {
      request: await tx.workdayCloseExceptionRequest.findUniqueOrThrow({ where: { id: request.id } }), changed: false,
    };
    if (closing) {
      const audit = `Рабочий день завершён администратором по запросу ${request.id}. Невыполненные проверки не подтверждены.`;
      await tx.workDayEntry.update({
        where: { id: workDay.id },
        data: { status: 'completed', endedAt: now, comment: [workDay.comment, audit].filter(Boolean).join('\n') },
      });
      const run = await tx.shiftControlRun.findUnique({ where: { workDayEntryId: workDay.id }, include: { tasks: true } });
      if (run) {
        for (const task of run.tasks.filter((item) => item.category === 'handover' && item.status !== 'done')) {
          const draft = record(task.handoverData);
          await tx.shiftControlTask.update({
            where: { id: task.id },
            data: {
              // Keep the saved facts/photos and the draft status. Approval
              // does not attest that cash was transferred or checks were done.
              handoverData: {
                ...draft,
                adminClosure: { requestId: request.id, adminId: input.adminId, closedAt: now.toISOString() },
                ...(cashException ? { personalCash: { ...record(draft.personalCash), encashmentExceptionRequestId: request.id } } : {}),
              },
            },
          });
        }
        await tx.shiftControlTask.updateMany({
          where: { runId: run.id, status: 'pending' },
          data: { status: 'missed' },
        });
        await tx.shiftControlRun.update({
          where: { id: run.id },
          data: { status: 'completed', completedAt: now, closingComment: [run.closingComment, audit].filter(Boolean).join('\n') },
        });
        await resolveTaskNotifications(tx, run.tasks.map((task) => task.id), now);
      }
    }

    const updated = await tx.workdayCloseExceptionRequest.findUniqueOrThrow({ where: { id: request.id } });
    await resolveCloseExceptionNotifications(tx, {
      workDayEntryId: workDay.id, now,
      scope: closing ? 'all' : cashException ? 'cash_encashment' : 'required_issues',
    });
    if (closing || (active && input.status === 'rejected')) {
      await tx.workdayNotification.create({
        data: {
          userId: request.employeeId,
          fingerprint: `workday-close-exception:${request.id}:${input.status}`,
          kind: closing ? 'workday_closed_by_admin' : 'workday_close_exception_decision',
          title: closing ? 'Смена завершена' : 'Завершение не согласовано',
          body: closing
            ? `Смена за ${workDay.date} завершена. ${cashException ? 'Инкассация не подтверждена.' : 'Неисправленные проблемы остаются на контроле.'}`
            : input.decisionComment,
          scheduledAt: now,
        },
      });
    }
    return { request: updated, changed: true };
  });
}

// A handover can be waiting on 1C when an administrator closes its workday.
// Never let that late draft/check overwrite the retained closure evidence.
export async function updateActiveHandoverTask(db: PrismaClient, input: {
  workDayEntryId: number; taskId: number; data: Prisma.ShiftControlTaskUpdateInput; expectedUpdatedAt?:Date; expectedHandoverData?:unknown;
}) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "WorkDayEntry" WHERE id = ${input.workDayEntryId} FOR UPDATE`;
    const active = await tx.workDayEntry.findFirst({
      where: { id: input.workDayEntryId, endedAt: null, status: { in: ['active', 'missing_checkout'] } },
    });
    if (!active) return null;
    if (input.expectedUpdatedAt || 'expectedHandoverData' in input) {
      await tx.$queryRaw`SELECT id FROM "ShiftControlTask" WHERE id = ${input.taskId} FOR UPDATE`;
      const task=await tx.shiftControlTask.findUnique({where:{id:input.taskId},select:{updatedAt:true,handoverData:true}});
      if(!task || input.expectedUpdatedAt && +task.updatedAt!==+input.expectedUpdatedAt || 'expectedHandoverData' in input && JSON.stringify(task.handoverData)!==JSON.stringify(input.expectedHandoverData))return null;
    }
    return tx.shiftControlTask.update({ where: { id: input.taskId }, data: input.data });
  });
}
