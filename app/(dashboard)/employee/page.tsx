import { redirect } from 'next/navigation';
import { EmployeeTodayClient } from './EmployeeTodayClient';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildDateRange, getMoscowDateKey } from '@/lib/workday';

export const dynamic = 'force-dynamic';

function serializeWorkDay(entry: Awaited<ReturnType<typeof prisma.workDayEntry.findFirst>>) {
  if (!entry) return null;
  return {
    ...entry,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function serializeScheduleEntry(entry: {
  id: number;
  userId: number;
  date: string;
  department: string;
  status: string;
  user?: { id: number; name: string; department: string };
}) {
  return {
    id: entry.id,
    userId: entry.userId,
    date: entry.date,
    department: entry.department,
    status: entry.status,
    user: entry.user,
  };
}

export default async function Employee() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const today = getMoscowDateKey();
  const dates = buildDateRange(today, 31);

  const [attestations, ownSchedule, departmentSchedule, departmentUsers, todayWorkDay, unfinishedWorkDay] = await Promise.all([
    prisma.attestation.findMany({
      where: { status: 'ACTIVE' },
      include: {
        results: { where: { userId: user.id }, orderBy: { date: 'desc' }, take: 1 },
        progresses: { where: { userId: user.id } },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.workScheduleEntry.findMany({
      where: { userId: user.id, date: { in: dates } },
      orderBy: { date: 'asc' },
    }),
    prisma.workScheduleEntry.findMany({
      where: { department: user.department, date: { in: dates } },
      include: { user: { select: { id: true, name: true, department: true } } },
      orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
    }),
    prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true, department: user.department },
      select: { id: true, name: true, department: true },
      orderBy: { name: 'asc' },
    }),
    prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date: today } } }),
    prisma.workDayEntry.findFirst({
      where: { userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null, date: { not: today } },
      orderBy: { startedAt: 'desc' },
    }),
  ]);

  return (
    <EmployeeTodayClient
      user={{ id: user.id, name: user.name, department: user.department }}
      today={today}
      ownSchedule={ownSchedule.map(serializeScheduleEntry)}
      departmentSchedule={departmentSchedule.map(serializeScheduleEntry)}
      departmentUsers={departmentUsers}
      todayWorkDay={serializeWorkDay(todayWorkDay)}
      unfinishedWorkDay={serializeWorkDay(unfinishedWorkDay)}
      attestations={attestations.map((attestation) => ({
        id: attestation.id,
        title: attestation.title,
        resultStatus: attestation.results[0]?.status ?? null,
        hasProgress: Boolean(attestation.progresses[0]),
      }))}
    />
  );
}
