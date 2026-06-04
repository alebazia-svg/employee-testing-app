import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildDateRange, getMoscowDateKey, scheduleStatuses } from '@/lib/workday';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { date, status } = await req.json();
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: 'Некорректная дата' }, { status: 400 });
  }
  if (!scheduleStatuses.includes(status)) {
    return Response.json({ error: 'Некорректный статус графика' }, { status: 400 });
  }

  await prisma.workScheduleEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, status, department: user.department },
    update: { status, department: user.department },
  });

  const dates = buildDateRange(getMoscowDateKey(), 31);
  const [ownSchedule, departmentSchedule] = await Promise.all([
    prisma.workScheduleEntry.findMany({
      where: { userId: user.id, date: { in: dates } },
      orderBy: { date: 'asc' },
    }),
    prisma.workScheduleEntry.findMany({
      where: { department: user.department, date: { in: dates } },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
    }),
  ]);

  return Response.json({ ownSchedule, departmentSchedule });
}
