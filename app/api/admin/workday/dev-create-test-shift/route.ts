import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, getMoscowMinutes, getShiftOption, usesWorkdayShiftControl } from '@/lib/workday';

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  if (process.env.ENABLE_DEV_WORKDAY_TOOLS !== 'true') {
    return Response.json({ error: 'Dev workday tools are disabled' }, { status: 403 });
  }

  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const date = isDateKey(body.date) ? body.date : getMoscowDateKey();
  const shift = getShiftOption(typeof body.shiftCode === 'string' ? body.shiftCode : '');
  if (shift.code === 'other' || shift.startMinutes === null || shift.endMinutes === null) {
    return Response.json({ error: 'Invalid shift code' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, department: true, role: true, isActive: true },
  });

  if (!user || user.role !== 'EMPLOYEE' || !user.isActive) {
    return Response.json({ error: 'Employee not found' }, { status: 404 });
  }
  if (!usesWorkdayShiftControl(user)) {
    return Response.json({ error: 'Dev/Test shift control is not required for this employee' }, { status: 400 });
  }

  const template = await prisma.shiftControlTemplate.findFirst({
    where: { department: user.department, shiftCode: shift.code, isActive: true },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    orderBy: { version: 'desc' },
  });

  if (!template) {
    return Response.json({ error: `No active ${user.department} template for shift ${shift.label}` }, { status: 400 });
  }

  const existingWorkDay = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId, date } } });
  if (existingWorkDay) {
    return Response.json({ error: `За ${date} у сотрудника уже есть рабочий день. Сначала используйте Dev/Test: сбросить.` }, { status: 409 });
  }

  const now = new Date();
  const nowMinutes = Math.max(0, getMoscowMinutes(now) - 30);

  const result = await prisma.$transaction(async (tx) => {
    const workDay = await tx.workDayEntry.create({
      data: {
        userId,
        date,
        department: user.department,
        shiftCode: shift.code,
        shiftLabel: shift.label,
        shiftStartMinutes: shift.startMinutes,
        shiftEndMinutes: shift.endMinutes,
        startedAt: now,
        lateMinutes: 0,
        comment: 'Dev/Test смена создана из админки',
        status: 'active',
      },
    });

    const run = await tx.shiftControlRun.create({
      data: {
        workDayEntryId: workDay.id,
        userId,
        department: user.department,
        date,
        templateId: template.id,
        status: 'active',
        startedAt: now,
        tasks: {
          create: template.tasks.map((task, index) => ({
            templateTaskId: task.id,
            title: task.title,
            category: task.category,
            sortOrder: task.sortOrder,
            required: task.required,
            plannedTimeMinutes: Math.max(0, nowMinutes - template.tasks.length + index),
            status: 'pending',
          })),
        },
      },
      include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    });

    return { workDay, run };
  });

  return Response.json({
    ...result,
    date,
    message: `Dev/Test: создана ${user.department === 'wholesale' ? 'wholesale' : 'retail'} смена ${shift.label} за ${date}. Задачи доступны сейчас.`,
  });
}
