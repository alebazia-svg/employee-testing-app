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

function serializeShiftControl(run: {
  id: number;
  workDayEntryId: number;
  userId: number;
  department: string;
  date: string;
  templateId: number | null;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  completedAt: Date | null;
  closingComment: string;
  createdAt: Date;
  updatedAt: Date;
  tasks: Array<{
    id: number;
    runId: number;
    templateTaskId: number | null;
    title: string;
    category: string;
    sortOrder: number;
    required: boolean;
    plannedTimeMinutes: number | null;
    status: string;
    completedAt: Date | null;
    numericValue: number | null;
    integerValue: number | null;
    booleanValue: boolean | null;
    textValue: string | null;
    handoverData: unknown;
    comment: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
} | null) {
  if (!run) return { run: null, tasks: [] };
  const { tasks, ...shiftControlRun } = run;
  return {
    run: {
      ...shiftControlRun,
      startedAt: shiftControlRun.startedAt.toISOString(),
      submittedAt: shiftControlRun.submittedAt?.toISOString() ?? null,
      completedAt: shiftControlRun.completedAt?.toISOString() ?? null,
      createdAt: shiftControlRun.createdAt.toISOString(),
      updatedAt: shiftControlRun.updatedAt.toISOString(),
    },
    tasks: tasks.map((task) => ({
      ...task,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}

function serializeCashOperation(operation: {
  id: number;
  userId: number;
  workDayEntryId: number;
  date: string;
  direction: string;
  amount: number;
  photoPath: string;
  comment: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: operation.id,
    userId: operation.userId,
    workDayEntryId: operation.workDayEntryId,
    date: operation.date,
    direction: operation.direction as 'phone_reserve' | 'deposit_safe',
    amount: operation.amount,
    photoPath: operation.photoPath,
    comment: operation.comment,
    status: operation.status,
    createdAt: operation.createdAt.toISOString(),
  };
}

export default async function Employee() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const today = getMoscowDateKey();
  const dates = buildDateRange(today, 31);

  const [attestations, ownSchedule, departmentSchedule, departmentUsers, todayWorkDay, unfinishedWorkDay, shiftControlRun, cashOperations] = await Promise.all([
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
    user.department === 'retail' || user.department === 'wholesale'
      ? prisma.shiftControlRun.findFirst({
          where: {
            userId: user.id,
            workDayEntry: {
              status: { in: ['active', 'missing_checkout'] },
              endedAt: null,
            },
          },
          include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
          orderBy: { startedAt: 'desc' },
        })
      : null,
    prisma.cashOperation.findMany({
      where: { userId: user.id, date: today },
      orderBy: { createdAt: 'desc' },
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
      shiftControl={serializeShiftControl(shiftControlRun)}
      cashOperations={cashOperations.map(serializeCashOperation)}
    />
  );
}
