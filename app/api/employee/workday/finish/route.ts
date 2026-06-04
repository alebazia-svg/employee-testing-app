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

  const workDay = await prisma.workDayEntry.update({
    where: { id: activeWorkDay.id },
    data: { endedAt: new Date(), status: 'completed' },
  });

  return Response.json({ workDay });
}
