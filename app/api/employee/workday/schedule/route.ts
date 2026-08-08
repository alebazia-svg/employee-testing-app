import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildDateRange, getMoscowDateKey, scheduleStatuses } from '@/lib/workday';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

async function scheduleSnapshot(user: { id: number; department: string }) {
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
  return { ownSchedule, departmentSchedule };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  return Response.json(await scheduleSnapshot(user), { headers: noStoreHeaders });
}

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

  return Response.json(await scheduleSnapshot(user), { headers: noStoreHeaders });
}
