import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function DELETE(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const { userId } = body;
  const targetUserId = Number(userId);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    const queryUserId = Number(url.searchParams.get('userId'));
    if (!Number.isInteger(queryUserId) || queryUserId <= 0) {
      return Response.json({ error: 'Invalid user id' }, { status: 400 });
    }
  }

  const userIdToReset = Number.isInteger(targetUserId) && targetUserId > 0 ? targetUserId : Number(url.searchParams.get('userId'));
  const target = await prisma.user.findUnique({ where: { id: userIdToReset }, select: { login: true } });
  if (process.env.ENABLE_DEV_WORKDAY_TOOLS !== 'true' && target?.login !== 'kkm_test') return Response.json({ error: 'Dev workday tools are disabled' }, { status: 403 });
  const requestedDate = isDateKey(body.date) ? body.date : url.searchParams.get('date');
  const date = isDateKey(requestedDate) ? requestedDate : getMoscowDateKey();
  const result = await prisma.$transaction(async (tx) => {
    const shiftRuns = await tx.shiftControlRun.findMany({
      where: { userId: userIdToReset, date },
      select: { id: true },
    });
    const runIds = shiftRuns.map((run) => run.id);

    // Dev/Test reset must also remove issues created by the simulated run.
    // Otherwise an old KKM failure survives the deleted task (taskId becomes
    // null) and blocks the next test shift for the same employee and date.
    const deletedIssues = await tx.workdayControlIssue.deleteMany({
      where: {
        userId: userIdToReset,
        originDate: date,
      },
    });

    const deletedTasks = runIds.length
      ? await tx.shiftControlTask.deleteMany({
          where: { runId: { in: runIds } },
        })
      : { count: 0 };

    const deletedRuns = await tx.shiftControlRun.deleteMany({
      where: { userId: userIdToReset, date },
    });

    const deletedWorkDays = await tx.workDayEntry.deleteMany({
      where: {
        userId: userIdToReset,
        date,
      },
    });

    return {
      deletedTasks: deletedTasks.count,
      deletedRuns: deletedRuns.count,
      deletedWorkDays: deletedWorkDays.count,
      deletedIssues: deletedIssues.count,
    };
  });

  return Response.json({
    ...result,
    date,
    message:
      result.deletedWorkDays || result.deletedRuns || result.deletedTasks
        ? `Рабочий день и задачи сотрудника за ${date} сброшены`
        : `За ${date} нечего сбрасывать`,
  });
}
