import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLateMinutes, getMoscowDateKey, getMoscowMinutes, getShiftOption } from '@/lib/workday';

const noChecklistMessage = 'Для этой смены нет чек-листа, обратитесь к администратору';

function canUseShiftControl(department: string) {
  return department === 'retail' || department === 'wholesale';
}

async function findShiftControlTemplate(
  client: Pick<typeof prisma, 'shiftControlTemplate'>,
  department: string,
  shiftCode: string,
) {
  const template = await client.shiftControlTemplate.findFirst({
    where: { department, shiftCode, isActive: true },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    orderBy: { version: 'desc' },
  });

  return template?.tasks.length ? template : null;
}

function createTasksFromTemplate(template: NonNullable<Awaited<ReturnType<typeof findShiftControlTemplate>>>) {
  return {
    create: template.tasks.map((task) => ({
      templateTaskId: task.id,
      title: task.title,
      category: task.category,
      sortOrder: task.sortOrder,
      required: task.required,
      plannedTimeMinutes: task.plannedTimeMinutes,
      status: 'pending',
    })),
  };
}

async function ensureShiftControlRun(user: { id: number; department: string }, workDay: { id: number; date: string; shiftCode: string }, now = new Date()) {
  if (!canUseShiftControl(user.department)) return null;

  const existingRun = await prisma.shiftControlRun.findUnique({
    where: { workDayEntryId: workDay.id },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
  });
  if (existingRun) return existingRun;

  const template = await findShiftControlTemplate(prisma, user.department, workDay.shiftCode);
  if (!template) throw new Error(noChecklistMessage);

  return prisma.shiftControlRun.create({
    data: {
      workDayEntryId: workDay.id,
      userId: user.id,
      department: user.department,
      date: workDay.date,
      templateId: template?.id,
      status: 'active',
      startedAt: now,
      tasks: createTasksFromTemplate(template),
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

  const existing = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existing) {
    let shiftControlRun = null;
    try {
      shiftControlRun =
        existing.status !== 'completed' && !existing.endedAt
          ? await ensureShiftControlRun({ id: user.id, department: user.department }, existing, now)
          : null;
    } catch (error) {
      if (error instanceof Error && error.message === noChecklistMessage) {
        return Response.json({ error: noChecklistMessage }, { status: 400 });
      }
      throw error;
    }
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

  const hasShiftControl = canUseShiftControl(user.department);

  if (!hasShiftControl) {
    const workDay = await prisma.workDayEntry.create({ data: workDayData });
    return Response.json({ workDay, alreadyStarted: false });
  }

  let workDay;
  let shiftControlRun;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const createdWorkDay = await tx.workDayEntry.create({ data: workDayData });
      const template = await findShiftControlTemplate(tx, user.department, shift.code);
      if (!template) throw new Error(noChecklistMessage);

      const createdShiftControlRun = await tx.shiftControlRun.create({
        data: {
          workDayEntryId: createdWorkDay.id,
          userId: user.id,
          department: user.department,
          date,
          templateId: template?.id,
          status: 'active',
          startedAt: now,
          tasks: createTasksFromTemplate(template),
        },
        include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
      });

      return { workDay: createdWorkDay, shiftControlRun: createdShiftControlRun };
    });

    workDay = result.workDay;
    shiftControlRun = result.shiftControlRun;
  } catch (error) {
    if (error instanceof Error && error.message === noChecklistMessage) {
      return Response.json({ error: noChecklistMessage }, { status: 400 });
    }
    throw error;
  }

  return Response.json({ workDay, shiftControlRun, alreadyStarted: false });
}
