import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLateMinutes, getMoscowDateKey, getMoscowMinutes, getShiftOption, isShiftSupportedForDepartment, usesWorkdayShiftControl } from '@/lib/workday';

async function ensureShiftControlRun(user: { id: number; name: string; login: string; department: string }, workDay: { id: number; date: string; shiftCode: string }, now = new Date()) {
  if (!usesWorkdayShiftControl(user)) return null;

  const existingRun = await prisma.shiftControlRun.findUnique({
    where: { workDayEntryId: workDay.id },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
  });
  if (existingRun) return existingRun;

  const template = await prisma.shiftControlTemplate.findFirst({
    where: { department: user.department, shiftCode: workDay.shiftCode, isActive: true },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    orderBy: { version: 'desc' },
  });
  if (!template || template.tasks.length === 0) return null;

  return prisma.shiftControlRun.create({
    data: {
      workDayEntryId: workDay.id,
      userId: user.id,
      department: user.department,
      date: workDay.date,
      templateId: template?.id,
      status: 'active',
      startedAt: now,
      tasks: template
        ? {
            create: template.tasks.map((task) => ({
              templateTaskId: task.id,
              title: task.title,
              category: task.category,
              sortOrder: task.sortOrder,
              required: task.required,
              plannedTimeMinutes: task.plannedTimeMinutes,
              status: 'pending',
            })),
          }
        : undefined,
    },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { shiftCode, comment } = await req.json();
  const shift = getShiftOption(typeof shiftCode === 'string' ? shiftCode : '');
  const now = new Date();
  const date = getMoscowDateKey(now);
  const lateMinutes = getLateMinutes(shift.startMinutes, getMoscowMinutes(now));
  const hasShiftControl = usesWorkdayShiftControl(user);

  if (hasShiftControl && !isShiftSupportedForDepartment(user.department, shift.code)) {
    return Response.json({ error: 'Для этой смены нет чек-листа. Обратитесь к администратору.' }, { status: 400 });
  }

  const existing = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existing) {
    const shiftControlRun =
      existing.status !== 'completed' && !existing.endedAt
        ? await ensureShiftControlRun({ id: user.id, name: user.name, login: user.login, department: user.department }, existing, now)
        : null;
    return Response.json({
      workDay: existing,
      shiftControlRun,
      alreadyStarted: true,
      message: 'Рабочий день уже начат',
    });
  }

  const workDayData = {
    userId: user.id,
    date,
    department: user.department,
    shiftCode: shift.code,
    shiftLabel: shift.label,
    shiftStartMinutes: shift.startMinutes,
    shiftEndMinutes: shift.endMinutes,
    startedAt: now,
    lateMinutes,
    comment: lateMinutes > 0 && typeof comment === 'string' ? comment.trim() : '',
    status: 'active',
  };

  if (!hasShiftControl) {
    const workDay = await prisma.workDayEntry.create({ data: workDayData });
    return Response.json({ workDay, alreadyStarted: false });
  }

  const template = await prisma.shiftControlTemplate.findFirst({
    where: { department: user.department, shiftCode: shift.code, isActive: true },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    orderBy: { version: 'desc' },
  });

  if (!template || template.tasks.length === 0) {
    return Response.json({ error: 'Для этой смены нет чек-листа. Обратитесь к администратору.' }, { status: 400 });
  }

  const { workDay, shiftControlRun } = await prisma.$transaction(async (tx) => {
    const createdWorkDay = await tx.workDayEntry.create({ data: workDayData });

    const createdShiftControlRun = await tx.shiftControlRun.create({
      data: {
        workDayEntryId: createdWorkDay.id,
        userId: user.id,
        department: user.department,
        date,
        templateId: template.id,
        status: 'active',
        startedAt: now,
        tasks: {
          create: template.tasks.map((task) => ({
            templateTaskId: task.id,
            title: task.title,
            category: task.category,
            sortOrder: task.sortOrder,
            required: task.required,
            plannedTimeMinutes: task.plannedTimeMinutes,
            status: 'pending',
          })),
        },
      },
      include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    });

    return { workDay: createdWorkDay, shiftControlRun: createdShiftControlRun };
  });

  return Response.json({ workDay, shiftControlRun, alreadyStarted: false });
}
