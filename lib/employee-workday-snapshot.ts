import { prisma } from '@/lib/prisma';
import { stripShiftControlOneCAudit } from '@/lib/shift-control-one-c-audit';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';

type WorkDayForSnapshot = Awaited<ReturnType<typeof prisma.workDayEntry.findFirst>>;

export function serializeWorkDayForEmployee(entry: WorkDayForSnapshot) {
  if (!entry) return null;
  return {
    ...entry,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function serializeShiftControlForEmployee(run: Awaited<ReturnType<typeof findCurrentShiftControlRun>>) {
  if (!run) return { run: null, tasks: [] };
  const { tasks, workDayEntry: _workDayEntry, template: _template, ...shiftControlRun } = run;
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
      handoverData: stripShiftControlOneCAudit(task.handoverData),
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}

export function serializeCashOperationForEmployee(operation: Awaited<ReturnType<typeof findTodayCashOperations>>[number]) {
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

async function findCurrentShiftControlRun(userId: number) {
  return prisma.shiftControlRun.findFirst({
    where: {
      userId,
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
}

async function findTodayCashOperations(userId: number, today: string) {
  return prisma.cashOperation.findMany({
    where: { userId, date: today },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getEmployeeWorkdaySnapshot(user: { id: number; department: string }) {
  const today = getMoscowDateKey();
  const shiftControlEnabled = usesWorkdayShiftControl(user);

  const [todayWorkDay, unfinishedWorkDay, shiftControlRun, cashOperations] = await Promise.all([
    prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date: today } } }),
    prisma.workDayEntry.findFirst({
      where: { userId: user.id, status: { in: ['active', 'missing_checkout'] }, endedAt: null, date: { not: today } },
      orderBy: { startedAt: 'desc' },
    }),
    shiftControlEnabled ? findCurrentShiftControlRun(user.id) : null,
    findTodayCashOperations(user.id, today),
  ]);

  return {
    today,
    workDay: serializeWorkDayForEmployee(todayWorkDay),
    unfinishedWorkDay: serializeWorkDayForEmployee(unfinishedWorkDay),
    shiftControl: serializeShiftControlForEmployee(shiftControlRun),
    cashOperations: cashOperations.map(serializeCashOperationForEmployee),
  };
}
