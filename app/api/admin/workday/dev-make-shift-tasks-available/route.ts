import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, getMoscowMinutes } from '@/lib/workday';

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function PATCH(req: Request) {
  if (process.env.ENABLE_DEV_WORKDAY_TOOLS !== 'true') {
    return Response.json({ error: 'Dev workday tools are disabled' }, { status: 403 });
  }

  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const date = isDateKey(body.date) ? body.date : getMoscowDateKey();
  const nowMinutes = Math.max(0, getMoscowMinutes() - 30);

  const result = await prisma.$transaction(async (tx) => {
    const run = await tx.shiftControlRun.findFirst({
      where: {
        userId,
        date,
        department: { in: ['retail', 'wholesale'] },
      },
      include: {
        tasks: {
          where: { status: { not: 'done' } },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!run) {
      return { foundRun: false, updatedTasks: 0 };
    }

    await Promise.all(
      run.tasks.map((task, index) =>
        tx.shiftControlTask.update({
          where: { id: task.id },
          data: { plannedTimeMinutes: Math.max(0, nowMinutes - run.tasks.length + index) },
        }),
      ),
    );

    return { foundRun: true, updatedTasks: run.tasks.length };
  });

  return Response.json({
    ...result,
    date,
    message: result.foundRun
      ? `Dev/Test: задачи контроля смены за ${date} доступны. Обновлено: ${result.updatedTasks}`
      : `За ${date} нет активного контроля смены для сотрудника`,
  });
}
