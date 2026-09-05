import { Prisma, type WorkDayEntry } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { buildLatenessShadowSnapshot } from '@/lib/attendance-shadow';
import { prisma } from '@/lib/prisma';
import { activeEmployeeShiftTemplateTasks } from '@/lib/shift-control-policy';
import { getMoscowMinutes, getShiftOption, isShiftSupportedForDepartment, usesWorkdayShiftControl } from '@/lib/workday';
import { scheduleTaskNotifications } from '@/lib/workday-notifications';
import { loadWorkdayShiftSelection, permittedWorkdayShiftCodes } from '@/lib/workday-shift-selection';

const SHIFT_NO_LONGER_AVAILABLE = 'WORKDAY_SHIFT_NO_LONGER_AVAILABLE';

async function serializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === 2) throw error;
    }
  }
  throw new Error('WORKDAY_SERIALIZABLE_RETRY_EXHAUSTED');
}

async function assertShiftStillAvailable(
  tx: Prisma.TransactionClient,
  input: { department: string; userId: number; date: string; shiftCode: string },
) {
  const selection = await loadWorkdayShiftSelection(tx, {
    department: input.department,
    currentUserId: input.userId,
    date: input.date,
  });
  if (selection.mode !== 'unavailable' && !permittedWorkdayShiftCodes(selection).includes(input.shiftCode)) {
    throw new Error(SHIFT_NO_LONGER_AVAILABLE);
  }
}

async function ensureTaskNotifications(userId: number, date: string, tasks: Array<{ id: number; title: string; category: string; plannedTimeMinutes: number | null }>) {
  await scheduleTaskNotifications(prisma, tasks.map((task) => ({ ...task, userId, run: { date } })));
}

function employeeWorkDayResponse(entry: WorkDayEntry) {
  const {
    startIntentId: _startIntentId,
    qrAcceptedAt: _qrAcceptedAt,
    latenessPolicyVersion: _latenessPolicyVersion,
    latenessShadowPointsX2: _latenessShadowPointsX2,
    ...employeeEntry
  } = entry;
  return employeeEntry;
}

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
  const templateTasks = template ? activeEmployeeShiftTemplateTasks(user.department, template.tasks) : [];
  if (!template || templateTasks.length === 0) return null;

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
            create: templateTasks.map((task) => ({
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
  const payload = await req.json().catch(() => ({}));
  const { shiftCode, comment, startIntentId } = payload;
  const shift = getShiftOption(typeof shiftCode === 'string' ? shiftCode : '');
  const now = new Date();
  const hasShiftControl = usesWorkdayShiftControl(user);

  if (hasShiftControl && !isShiftSupportedForDepartment(user.department, shift.code)) {
    return Response.json({ error: 'Для этой смены нет чек-листа. Обратитесь к администратору.' }, { status: 400 });
  }

  if (typeof startIntentId !== 'string' || !startIntentId) {
    return Response.json({ error: 'QR-подтверждение не найдено. Отсканируйте код ещё раз.' }, { status: 400 });
  }

  const intent = await prisma.workdayStartIntent.findUnique({ where: { id: startIntentId } });
  if (!intent || intent.userId !== user.id || intent.department !== user.department) {
    return Response.json({ error: 'QR-подтверждение недействительно. Отсканируйте код ещё раз.' }, { status: 400 });
  }
  const date = intent.date;
  const existing = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existing) {
    const shiftControlRun =
      existing.status !== 'completed' && !existing.endedAt
        ? await ensureShiftControlRun({ id: user.id, name: user.name, login: user.login, department: user.department }, existing, now)
        : null;
    if (shiftControlRun) await ensureTaskNotifications(user.id, existing.date, shiftControlRun.tasks);
    return Response.json({
      workDay: employeeWorkDayResponse(existing),
      shiftControlRun,
      alreadyStarted: true,
      message: 'Рабочий день уже начат',
    });
  }

  if (intent.consumedAt || intent.expiresAt <= now) {
    return Response.json({ error: 'Время выбора смены истекло. Отсканируйте QR ещё раз.' }, { status: 409 });
  }

  const qrAcceptedAt = intent.qrAcceptedAt;
  const shadowResult = buildLatenessShadowSnapshot(shift.startMinutes, getMoscowMinutes(qrAcceptedAt));
  const lateMinutes = shadowResult.lateMinutes;

  const kkmAssignment = user.department === 'retail'
    ? await prisma.workdayKkmAssignment.findFirst({ where: { userId: user.id, date, effectiveTo: null }, orderBy: { effectiveFrom: 'desc' } })
    : null;

  const workDayData = {
    userId: user.id,
    date,
    department: user.department,
    shiftCode: shift.code,
    shiftLabel: shift.label,
    shiftStartMinutes: shift.startMinutes,
    shiftEndMinutes: shift.endMinutes,
    startedAt: qrAcceptedAt,
    qrAcceptedAt,
    startIntentId: intent.id,
    lateMinutes,
    latenessPolicyVersion: shadowResult.policyVersion,
    latenessShadowPointsX2: shadowResult.pointsX2,
    comment: lateMinutes > 0 && typeof comment === 'string' ? comment.trim() : '',
    status: 'active',
  };

  if (!hasShiftControl) {
    try {
      const workDay = await serializableTransaction(async (tx) => {
        await assertShiftStillAvailable(tx, { department: user.department, userId: user.id, date, shiftCode: shift.code });
        const consumed = await tx.workdayStartIntent.updateMany({
          where: { id: intent.id, userId: user.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw new Error('WORKDAY_START_INTENT_ALREADY_USED');
        const created = await tx.workDayEntry.create({ data: workDayData });
        if (kkmAssignment) {
          await tx.workdayKkmAssignment.update({ where: { id: kkmAssignment.id }, data: { workDayEntryId: created.id } });
        }
        return created;
      });
      return Response.json({ workDay: employeeWorkDayResponse(workDay), alreadyStarted: false });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const racedWorkDay = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
        if (racedWorkDay) return Response.json({ workDay: employeeWorkDayResponse(racedWorkDay), alreadyStarted: true, message: 'Рабочий день уже начат' });
      }
      if (error instanceof Error && error.message === SHIFT_NO_LONGER_AVAILABLE) {
        return Response.json({ error: 'Доступная смена уже изменилась. Отсканируйте QR ещё раз.' }, { status: 409 });
      }
      if (error instanceof Error && error.message === 'WORKDAY_START_INTENT_ALREADY_USED') {
        return Response.json({ error: 'QR-подтверждение уже использовано. Обновите экран.' }, { status: 409 });
      }
      throw error;
    }
  }

  const template = await prisma.shiftControlTemplate.findFirst({
    where: { department: user.department, shiftCode: shift.code, isActive: true },
    include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    orderBy: { version: 'desc' },
  });

  const templateTasks = template ? activeEmployeeShiftTemplateTasks(user.department, template.tasks) : [];
  if (!template || templateTasks.length === 0) {
    return Response.json({ error: 'Для этой смены нет чек-листа. Обратитесь к администратору.' }, { status: 400 });
  }

  try {
    const { workDay, shiftControlRun } = await serializableTransaction(async (tx) => {
      await assertShiftStillAvailable(tx, { department: user.department, userId: user.id, date, shiftCode: shift.code });
      const consumed = await tx.workdayStartIntent.updateMany({
        where: { id: intent.id, userId: user.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new Error('WORKDAY_START_INTENT_ALREADY_USED');

      const createdWorkDay = await tx.workDayEntry.create({ data: workDayData });
      if (kkmAssignment) {
        await tx.workdayKkmAssignment.update({ where: { id: kkmAssignment.id }, data: { workDayEntryId: createdWorkDay.id } });
      }

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
            create: templateTasks.map((task) => ({
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

    await ensureTaskNotifications(user.id, workDay.date, shiftControlRun.tasks);
    return Response.json({ workDay: employeeWorkDayResponse(workDay), shiftControlRun, alreadyStarted: false });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const racedWorkDay = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
      if (racedWorkDay) return Response.json({ workDay: employeeWorkDayResponse(racedWorkDay), alreadyStarted: true, message: 'Рабочий день уже начат' });
    }
    if (error instanceof Error && error.message === SHIFT_NO_LONGER_AVAILABLE) {
      return Response.json({ error: 'Доступная смена уже изменилась. Отсканируйте QR ещё раз.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'WORKDAY_START_INTENT_ALREADY_USED') {
      return Response.json({ error: 'QR-подтверждение уже использовано. Обновите экран.' }, { status: 409 });
    }
    throw error;
  }
}
