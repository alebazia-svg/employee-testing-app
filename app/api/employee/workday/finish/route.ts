import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const activeWorkDay = await prisma.workDayEntry.findFirst({
    where: { userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });

  if (!activeWorkDay) {
    return Response.json({ error: 'Нет активного рабочего дня' }, { status: 404 });
  }

  if (user.department === 'retail' || user.department === 'wholesale') {
    const shiftControlRun = await prisma.shiftControlRun.findUnique({
      where: { workDayEntryId: activeWorkDay.id },
      include: { tasks: { where: { category: 'handover' }, take: 1 } },
    });
    const handoverTask = shiftControlRun?.tasks[0];

    if (shiftControlRun && handoverTask && handoverTask.status !== 'done') {
      return Response.json({ error: 'Сначала сдайте смену', code: 'SHIFT_CONTROL_HANDOVER_REQUIRED' }, { status: 409 });
    }
  }

  const workDay = await prisma.workDayEntry.update({
    where: { id: activeWorkDay.id },
    data: { endedAt: new Date(), status: 'completed' },
  });

  return Response.json({ workDay });
}
