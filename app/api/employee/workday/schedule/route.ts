import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildDateRange, getMoscowDateKey, scheduleStatuses } from '@/lib/workday';
import { buildScheduleMonthRange, isValidScheduleDateKey, scheduleMonthKeyFromDate } from '@/lib/workday-schedule';

const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

function requestedDates(monthKey?: string | null) {
  if (!monthKey) return { monthKey: null, dates: buildDateRange(getMoscowDateKey(), 31) };
  return buildScheduleMonthRange(monthKey);
}

async function scheduleSnapshot(user: { id: number; department: string }, dates: string[], monthKey: string | null) {
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
  return {
    ownSchedule,
    departmentSchedule,
    range: { monthKey, from: dates[0], to: dates[dates.length - 1] },
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  const monthKey = new URL(req.url).searchParams.get('month');
  const range = requestedDates(monthKey);
  if (!range) return Response.json({ error: 'Некорректный месяц' }, { status: 400, headers: noStoreHeaders });
  return Response.json(await scheduleSnapshot(user, range.dates, range.monthKey), { headers: noStoreHeaders });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { date, status } = await req.json();
  if (typeof date !== 'string' || !isValidScheduleDateKey(date)) {
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

  const monthKey = scheduleMonthKeyFromDate(date);
  const range = monthKey ? requestedDates(monthKey) : null;
  if (!range) return Response.json({ error: 'Некорректная дата' }, { status: 400, headers: noStoreHeaders });
  return Response.json(await scheduleSnapshot(user, range.dates, range.monthKey), { headers: noStoreHeaders });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const date = new URL(req.url).searchParams.get('date');
  if (!date || !isValidScheduleDateKey(date)) {
    return Response.json({ error: 'Некорректная дата' }, { status: 400 });
  }

  await prisma.workScheduleEntry.deleteMany({ where: { userId: user.id, date } });

  const monthKey = scheduleMonthKeyFromDate(date);
  const range = monthKey ? requestedDates(monthKey) : null;
  if (!range) return Response.json({ error: 'Некорректная дата' }, { status: 400, headers: noStoreHeaders });
  return Response.json(await scheduleSnapshot(user, range.dates, range.monthKey), { headers: noStoreHeaders });
}
