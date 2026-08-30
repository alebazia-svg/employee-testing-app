import { Prisma } from '@prisma/client';
import { buildLatenessShadowSnapshot } from '@/lib/attendance-shadow';
import { prisma } from '@/lib/prisma';
import { getMoscowMinutes, getShiftOption, isShiftSupportedForDepartment } from '@/lib/workday';
import { scheduleTaskNotifications } from '@/lib/workday-notifications';
import { loadWorkdayShiftSelection, permittedWorkdayShiftCodes, workdayShiftSelectionHint } from '@/lib/workday-shift-selection';

export const EMPLOYEE_SHIFT_CORRECTION_WINDOW_MS = 5 * 60_000;

export class WorkdayShiftChangeError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function assertRunCanBeRebuilt(workDay: {
  cashOperations: Array<{ id: number }>;
  shiftControlRun: null | {
    status: string;
    tasks: Array<{
      status: string;
      completedAt: Date | null;
      numericValue: number | null;
      integerValue: number | null;
      booleanValue: boolean | null;
      textValue: string | null;
      handoverData: Prisma.JsonValue | null;
      comment: string;
      notifications: Array<{ status: string }>;
      controlIssues: Array<{ id: number }>;
    }>;
  };
}, options: { allowSentNotifications?: boolean } = {}) {
  if (workDay.cashOperations.length > 0) {
    throw new WorkdayShiftChangeError('SHIFT_ALREADY_IN_PROGRESS', 'Смена уже началась: исправить её может администратор.');
  }
  const run = workDay.shiftControlRun;
  if (!run) return;
  const taskChanged = run.status !== 'active' || run.tasks.some((task) =>
    task.status !== 'pending'
    || task.completedAt !== null
    || task.numericValue !== null
    || task.integerValue !== null
    || task.booleanValue !== null
    || task.textValue !== null
    || task.handoverData !== null
    || task.comment.trim() !== ''
    || task.controlIssues.length > 0
    || (!options.allowSentNotifications && task.notifications.some((notification) => notification.status === 'sent')),
  );
  if (taskChanged) {
    throw new WorkdayShiftChangeError('SHIFT_ALREADY_IN_PROGRESS', 'По смене уже начались действия: исправить её может администратор.');
  }
}

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

export async function getWorkdayShiftCorrectionState(input: {
  userId: number;
  department: string;
  date: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const workDay = await prisma.workDayEntry.findUnique({
    where: { userId_date: { userId: input.userId, date: input.date } },
    include: {
      cashOperations: { select: { id: true } },
      shiftControlRun: {
        include: {
          tasks: {
            include: {
              notifications: { select: { status: true } },
              controlIssues: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!workDay || workDay.endedAt || workDay.status !== 'active') {
    return { canCorrect: false, allowedShiftCodes: [], hint: '' };
  }
  if (now.getTime() > workDay.createdAt.getTime() + EMPLOYEE_SHIFT_CORRECTION_WINDOW_MS) {
    return { canCorrect: false, allowedShiftCodes: [], hint: '' };
  }
  try {
    assertRunCanBeRebuilt(workDay);
  } catch {
    return { canCorrect: false, allowedShiftCodes: [], hint: '' };
  }
  const selection = await loadWorkdayShiftSelection(prisma, {
    department: input.department,
    currentUserId: input.userId,
    date: input.date,
  });
  const allowedShiftCodes = permittedWorkdayShiftCodes(selection).filter((code) => code !== workDay.shiftCode);
  return {
    canCorrect: allowedShiftCodes.length > 0,
    allowedShiftCodes,
    hint: workdayShiftSelectionHint(selection),
  };
}

export async function changeWorkdayShift(input: {
  userId: number;
  department: string;
  date: string;
  toShiftCode: string;
  source: 'employee' | 'admin_repair';
  shiftControlEnabled: boolean;
  enforceEmployeeWindow?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const shift = getShiftOption(input.toShiftCode);
  if (!isShiftSupportedForDepartment(input.department, shift.code)) {
    throw new WorkdayShiftChangeError('SHIFT_UNSUPPORTED', 'Эта смена недоступна для отдела.');
  }

  const result = await serializableTransaction(async (tx) => {
    const workDay = await tx.workDayEntry.findUnique({
      where: { userId_date: { userId: input.userId, date: input.date } },
      include: {
        cashOperations: { select: { id: true } },
        shiftControlRun: {
          include: {
            tasks: {
              include: {
                notifications: { select: { status: true } },
                controlIssues: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!workDay || workDay.endedAt || workDay.status !== 'active') {
      throw new WorkdayShiftChangeError('WORKDAY_NOT_ACTIVE', 'Активный рабочий день не найден.');
    }
    if (workDay.shiftCode === shift.code) {
      return { workDay, tasks: [] as Array<{ id: number; title: string; category: string; plannedTimeMinutes: number | null }> };
    }
    if ((input.enforceEmployeeWindow ?? true) && now.getTime() > workDay.createdAt.getTime() + EMPLOYEE_SHIFT_CORRECTION_WINDOW_MS) {
      throw new WorkdayShiftChangeError('SHIFT_CORRECTION_EXPIRED', 'Время самостоятельного исправления истекло. Обратитесь к администратору.');
    }
    assertRunCanBeRebuilt(workDay, { allowSentNotifications: input.source === 'admin_repair' });

    const selection = await loadWorkdayShiftSelection(tx, {
      department: input.department,
      currentUserId: input.userId,
      date: input.date,
    });
    if (selection.mode !== 'unavailable' && !permittedWorkdayShiftCodes(selection).includes(shift.code)) {
      throw new WorkdayShiftChangeError('SHIFT_NOT_AVAILABLE', 'Эта смена уже недоступна. Обновите экран.');
    }

    const template = input.shiftControlEnabled
      ? await tx.shiftControlTemplate.findFirst({
          where: { department: input.department, shiftCode: shift.code, isActive: true },
          include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
          orderBy: { version: 'desc' },
        })
      : null;
    if (input.shiftControlEnabled && (!template || template.tasks.length === 0)) {
      throw new WorkdayShiftChangeError('SHIFT_TEMPLATE_MISSING', 'Для этой смены нет чек-листа. Обратитесь к администратору.');
    }

    const qrAcceptedAt = workDay.qrAcceptedAt ?? workDay.startedAt;
    const shadowResult = buildLatenessShadowSnapshot(shift.startMinutes, getMoscowMinutes(qrAcceptedAt));

    if (workDay.shiftControlRun) {
      await tx.shiftControlRun.delete({ where: { id: workDay.shiftControlRun.id } });
    }
    const updated = await tx.workDayEntry.update({
      where: { id: workDay.id },
      data: {
        shiftCode: shift.code,
        shiftLabel: shift.label,
        shiftStartMinutes: shift.startMinutes,
        shiftEndMinutes: shift.endMinutes,
        lateMinutes: shadowResult.lateMinutes,
        latenessPolicyVersion: shadowResult.policyVersion,
        latenessShadowPointsX2: shadowResult.pointsX2,
      },
    });
    await tx.workdayShiftChange.create({
      data: {
        workDayEntryId: workDay.id,
        userId: input.userId,
        source: input.source,
        fromShiftCode: workDay.shiftCode,
        fromShiftLabel: workDay.shiftLabel,
        toShiftCode: shift.code,
        toShiftLabel: shift.label,
        fromLateMinutes: workDay.lateMinutes,
        toLateMinutes: shadowResult.lateMinutes,
        fromShadowPointsX2: workDay.latenessShadowPointsX2,
        toShadowPointsX2: shadowResult.pointsX2,
        latenessPolicyVersion: shadowResult.policyVersion,
        changedAt: now,
      },
    });

    if (!template) return { workDay: updated, tasks: [] };
    const run = await tx.shiftControlRun.create({
      data: {
        workDayEntryId: workDay.id,
        userId: input.userId,
        department: input.department,
        date: input.date,
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
    return { workDay: updated, tasks: run.tasks };
  });

  if (result.tasks.length > 0) {
    await scheduleTaskNotifications(
      prisma,
      result.tasks.map((task) => ({ ...task, userId: input.userId, run: { date: input.date } })),
    );
  }
  return result.workDay;
}
