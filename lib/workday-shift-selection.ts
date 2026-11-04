import { getMoscowMinutes, getShiftOptionsForDepartment, getShiftOption } from '@/lib/workday';
import type { Prisma } from '@prisma/client';
import type { prisma } from '@/lib/prisma';

type WorkdayRecommendationMode = 'incomplete_schedule' | 'solo' | 'first_of_pair' | 'remaining' | 'outside_schedule_remaining' | 'outside_schedule' | 'unavailable';

type Recommendation = {
  mode: WorkdayRecommendationMode;
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

function fallbackSelection(department: string): Recommendation {
  return {
    mode: 'unavailable',
    scheduledCount: 0,
    allowedShiftCodes: getShiftOptionsForDepartment(department).map((shift) => shift.code),
    exceptionShiftCodes: [],
  };
}

function deriveShiftRecommendation(input: {
  department: string;
  currentUserId: number;
  scheduledWorkingUserIds: number[];
  missingScheduleUserIds?: number[];
  startedWorkdays: Array<{ userId: number; shiftCode: string }>;
}): Recommendation {
  if (input.department !== 'retail' && input.department !== 'wholesale') {
    return fallbackSelection(input.department);
  }

  const scheduledIds = new Set(input.scheduledWorkingUserIds);
  const scheduledCount = scheduledIds.size;
  // An empty colleague date is unknown availability, never a confirmed day off.
  if (input.missingScheduleUserIds?.length) {
    return {
      mode: 'incomplete_schedule', scheduledCount,
      allowedShiftCodes: getShiftOptionsForDepartment(input.department).map((shift) => shift.code),
      exceptionShiftCodes: [],
    };
  }
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
    const pairedShiftCodes = shiftCodesByDepartmentAndCount[input.department][2];
    const otherStarts = input.startedWorkdays.filter((entry) => entry.userId !== input.currentUserId);
    if (otherStarts.length === 1 && pairedShiftCodes.includes(otherStarts[0].shiftCode)) {
      return {
        mode: 'remaining',
        scheduledCount,
        allowedShiftCodes: pairedShiftCodes.filter((code) => code !== otherStarts[0].shiftCode),
        exceptionShiftCodes: [],
      };
    }
    if (otherStarts.length > 0) {
      return {
        mode: 'unavailable',
        scheduledCount,
        allowedShiftCodes: expectedShiftCodes,
        exceptionShiftCodes: [],
      };
    }
    return { mode: 'solo', scheduledCount, allowedShiftCodes: expectedShiftCodes, exceptionShiftCodes: [] };
  }

  const allOtherStarts = input.startedWorkdays.filter((entry) => entry.userId !== input.currentUserId);
  if (allOtherStarts.some((entry) => !scheduledIds.has(entry.userId))) {
    return {
      mode: 'unavailable',
      scheduledCount,
      allowedShiftCodes: expectedShiftCodes,
      exceptionShiftCodes: [],
    };
  }
  const otherStarts = allOtherStarts;
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

export type WorkdayShiftSelection = {
  mode: 'manual' | 'unavailable';
  scheduledCount: number | null;
  allowedShiftCodes: string[];
  exceptionShiftCodes: string[];
  recommendedShiftCodes: string[];
  recommendationHint: string;
};

type SelectionInput = { department: string; currentUserId: number; scheduledWorkingUserIds?: number[];
  missingScheduleUserIds?: number[]; startedWorkdays?: Array<{userId:number;shiftCode:string}>; qrAcceptedAt?: Date };

/** The calendar can suggest hours, never restrict an employee's actual choice. */
export function deriveWorkdayShiftSelection(input: SelectionInput): WorkdayShiftSelection {
  const recommendation = input.scheduledWorkingUserIds ? deriveShiftRecommendation({
    ...input, scheduledWorkingUserIds:input.scheduledWorkingUserIds, startedWorkdays:input.startedWorkdays ?? [],
  }) : null;
  const usable = recommendation && !['unavailable','incomplete_schedule','outside_schedule'].includes(recommendation.mode);
  let recommendedShiftCodes=usable?recommendation.allowedShiftCodes:[];
  let recommendationHint=usable?(['remaining','outside_schedule_remaining'].includes(recommendation.mode)?'С учётом смены коллеги':'По графику на сегодня'):'';
  if(input.department==='retail'||input.department==='wholesale') {
    const lateCode=input.department==='retail'?'11_20':'10_19';
    const lateStart=getShiftOption(lateCode).startMinutes!;
    const qrMinute=input.qrAcceptedAt && Number.isFinite(+input.qrAcceptedAt)?getMoscowMinutes(input.qrAcceptedAt):null;
    const nearLate=qrMinute!==null && qrMinute>=lateStart-30;
    const others=(input.startedWorkdays??[]).filter(day=>day.userId!==input.currentUserId);
    const pair=shiftCodesByDepartmentAndCount[input.department][2];
    const counterpart=others.length===1&&pair.includes(others[0].shiftCode)?pair.find(code=>code!==others[0].shiftCode):null;
    if(counterpart && !(counterpart==='09_18' && nearLate)) {
      recommendedShiftCodes=[counterpart];recommendationHint='С учётом смены коллеги';
    } else if(nearLate) {
      recommendedShiftCodes=[lateCode];recommendationHint='По времени отметки';
    } else if(qrMinute!==null && recommendation?.mode==='first_of_pair') {
      recommendedShiftCodes=['09_18'];recommendationHint='По графику на сегодня';
    }
  }
  return {
    mode:['retail','wholesale'].includes(input.department)?'manual':'unavailable',
    scheduledCount:recommendation?.scheduledCount ?? null,
    allowedShiftCodes:getShiftOptionsForDepartment(input.department).map(shift=>shift.code),
    exceptionShiftCodes:[],
    recommendedShiftCodes,
    recommendationHint,
  };
}
export function permittedWorkdayShiftCodes(selection: WorkdayShiftSelection) {
  return [...selection.allowedShiftCodes,...selection.exceptionShiftCodes];
}
export function workdayShiftSelectionHint(_selection: WorkdayShiftSelection) {
  return 'Выберите свою смену на сегодня.';
}

type SelectionDb = Prisma.TransactionClient | typeof prisma;

async function readWorkdayShiftRecommendation(
  db: SelectionDb,
  input: { department: string; currentUserId: number; date: string; qrAcceptedAt?: Date },
) {
  const [schedules, startedWorkdays, vacations, employees] = await Promise.all([
    db.workScheduleEntry.findMany({
      where: { department: input.department, date: input.date, user: { role: 'EMPLOYEE', isActive: true, department: input.department } },
      select: { userId: true, status: true },
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
    db.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true, department: input.department },
      select: { id: true },
    }),
  ]);
  const vacationUserIds = new Set(vacations.map((vacation) => vacation.userId));

  const filledUserIds = new Set(schedules.filter((entry) => entry.status === 'working' || entry.status === 'off').map((entry) => entry.userId));
  return deriveWorkdayShiftSelection({
    department: input.department,
    currentUserId: input.currentUserId,
    missingScheduleUserIds: employees.filter((employee) => !filledUserIds.has(employee.id) && !vacationUserIds.has(employee.id)).map((employee) => employee.id),
    scheduledWorkingUserIds: schedules.filter((entry) => entry.status === 'working').map((entry) => entry.userId).filter((userId) => !vacationUserIds.has(userId)),
    startedWorkdays,
    qrAcceptedAt: input.qrAcceptedAt,
  });
}

/** Only the QR picker requests a bounded hint. Starting/correcting never waits for the plan. */
export async function loadWorkdayShiftSelection(db: SelectionDb, input: {
  department:string;currentUserId:number;date:string;recommendation?:boolean;qrAcceptedAt?:Date;
}) {
  const fallback=deriveWorkdayShiftSelection(input);
  if(!input.recommendation)return fallback;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    return await Promise.race([
      readWorkdayShiftRecommendation(db,input),
      new Promise<WorkdayShiftSelection>(resolve=>{timer=setTimeout(()=>resolve(fallback),1500);}),
    ]);
  } catch { return fallback; }
  finally { if(timer)clearTimeout(timer); }
}
