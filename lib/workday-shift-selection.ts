import { getShiftOptionsForDepartment } from '@/lib/workday';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type WorkdayShiftSelectionMode = 'solo' | 'first_of_pair' | 'remaining' | 'outside_schedule_remaining' | 'outside_schedule' | 'unavailable';

export type WorkdayShiftSelection = {
  mode: WorkdayShiftSelectionMode;
  scheduledCount: number;
  allowedShiftCodes: string[];
  exceptionShiftCodes: string[];
};

const shiftCodesByDepartmentAndCount: Record<'retail' | 'wholesale', Record<number, string[]>> = {
  retail: {
    1: ['09_20'],
    2: ['09_18', '11_20'],
  },
  wholesale: {
    1: ['09_19'],
    2: ['09_18', '10_19'],
  },
};

function fallbackSelection(department: string): WorkdayShiftSelection {
  return {
    mode: 'unavailable',
    scheduledCount: 0,
    allowedShiftCodes: getShiftOptionsForDepartment(department).map((shift) => shift.code),
    exceptionShiftCodes: [],
  };
}

export function deriveWorkdayShiftSelection(input: {
  department: string;
  currentUserId: number;
  scheduledWorkingUserIds: number[];
  startedWorkdays: Array<{ userId: number; shiftCode: string }>;
}): WorkdayShiftSelection {
  if (input.department !== 'retail' && input.department !== 'wholesale') {
    return fallbackSelection(input.department);
  }

  const scheduledIds = new Set(input.scheduledWorkingUserIds);
  const scheduledCount = scheduledIds.size;
  const expectedShiftCodes = shiftCodesByDepartmentAndCount[input.department][scheduledCount];
  if (!scheduledIds.has(input.currentUserId)) {
    const pairedShiftCodes = shiftCodesByDepartmentAndCount[input.department][2];
    const otherStarts = input.startedWorkdays.filter((entry) => entry.userId !== input.currentUserId);
    if (otherStarts.length === 1 && pairedShiftCodes.includes(otherStarts[0].shiftCode)) {
      return {
        mode: 'outside_schedule_remaining',
        scheduledCount,
        allowedShiftCodes: pairedShiftCodes.filter((code) => code !== otherStarts[0].shiftCode),
        exceptionShiftCodes: [],
      };
    }
    return {
      mode: 'outside_schedule',
      scheduledCount,
      allowedShiftCodes: getShiftOptionsForDepartment(input.department).map((shift) => shift.code),
      exceptionShiftCodes: [],
    };
  }
  if (!expectedShiftCodes) {
    return fallbackSelection(input.department);
  }

  if (scheduledCount === 1) {
    return { mode: 'solo', scheduledCount, allowedShiftCodes: expectedShiftCodes, exceptionShiftCodes: [] };
  }

  const otherStarts = input.startedWorkdays.filter(
    (entry) => entry.userId !== input.currentUserId && scheduledIds.has(entry.userId),
  );
  if (otherStarts.length === 0) {
    const soloShiftCode = shiftCodesByDepartmentAndCount[input.department][1] ?? [];
    return { mode: 'first_of_pair', scheduledCount, allowedShiftCodes: expectedShiftCodes, exceptionShiftCodes: soloShiftCode };
  }

  if (otherStarts.length === 1 && expectedShiftCodes.includes(otherStarts[0].shiftCode)) {
    return {
      mode: 'remaining',
      scheduledCount,
      allowedShiftCodes: expectedShiftCodes.filter((code) => code !== otherStarts[0].shiftCode),
      exceptionShiftCodes: [],
    };
  }

  return {
    mode: 'unavailable',
    scheduledCount,
    allowedShiftCodes: expectedShiftCodes,
    exceptionShiftCodes: [],
  };
}

export function permittedWorkdayShiftCodes(selection: WorkdayShiftSelection) {
  return [...selection.allowedShiftCodes, ...selection.exceptionShiftCodes];
}

export function workdayShiftSelectionHint(selection: WorkdayShiftSelection) {
  if (selection.mode === 'solo') return 'Сегодня в отделе один сотрудник — смена определена по графику.';
  if (selection.mode === 'remaining') return 'Коллега уже начал рабочий день — вам доступна оставшаяся смена.';
  if (selection.mode === 'outside_schedule_remaining') return 'Коллега уже начал рабочий день — оставшаяся смена определена автоматически.';
  if (selection.mode === 'outside_schedule') return 'В графике на сегодня нет вашей рабочей отметки. Выберите фактическую смену.';
  if (selection.mode === 'first_of_pair') return 'Выберите свою смену. Смена коллеги определится автоматически.';
  return 'Выберите свою смену на сегодня.';
}

type SelectionDb = Prisma.TransactionClient | typeof prisma;

export async function loadWorkdayShiftSelection(
  db: SelectionDb,
  input: { department: string; currentUserId: number; date: string },
) {
  const [schedules, startedWorkdays, vacations] = await Promise.all([
    db.workScheduleEntry.findMany({
      where: { department: input.department, date: input.date, status: 'working' },
      select: { userId: true },
    }),
    db.workDayEntry.findMany({
      where: { department: input.department, date: input.date },
      select: { userId: true, shiftCode: true },
    }),
    db.employeeVacation.findMany({
      where: {
        department: input.department,
        status: 'active',
        dateFrom: { lte: input.date },
        dateTo: { gte: input.date },
      },
      select: { userId: true },
    }),
  ]);
  const vacationUserIds = new Set(vacations.map((vacation) => vacation.userId));

  return deriveWorkdayShiftSelection({
    department: input.department,
    currentUserId: input.currentUserId,
    scheduledWorkingUserIds: schedules.map((entry) => entry.userId).filter((userId) => !vacationUserIds.has(userId)),
    startedWorkdays,
  });
}
