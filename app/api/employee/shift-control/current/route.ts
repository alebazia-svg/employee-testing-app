import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { usesWorkdayShiftControl } from '@/lib/workday';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!usesWorkdayShiftControl(user)) {
    return Response.json({ run: null, tasks: [] });
  }

  const currentRun = await prisma.shiftControlRun.findFirst({
    where: {
      userId: user.id,
      workDayEntry: {
        status: { in: ['active', 'missing_checkout'] },
        endedAt: null,
      },
    },
    include: {
      tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      workDayEntry: true,
      template: { select: { id: true, name: true, department: true, version: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (!currentRun) {
    return Response.json({ run: null, tasks: [] });
  }

  const { tasks, ...run } = currentRun;
  return Response.json({ run, tasks });
}
