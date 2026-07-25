import { getMoscowDateKey, getMoscowMinutes, getShiftOption, supportedShiftCodesByDepartment } from '@/lib/workday';

export type WorkdayTimingTask = {
  id: number;
  title: string;
  plannedTimeMinutes: number | null;
  status: string;
  completedAt: Date | string | null;
};

export type WorkdayTimingEntry = {
  status: string;
  shiftStartMinutes: number | null;
  shiftEndMinutes: number | null;
  startedAt: Date | string;
  endedAt: Date | string | null;
  lateMinutes: number;
};

export type WorkdayTimingViolation = {
  id: string;
  kind: 'workday_not_started' | 'late_start' | 'missing_checkout' | 'task_late' | 'task_overdue';
  label: string;
  detail: string;
  minutesLate: number | null;
  taskId: number | null;
};

type EvaluateWorkdayTimingInput = {
  dateKey: string;
  department?: string | null;
  scheduleStatus?: string | null;
  workDay?: WorkdayTimingEntry | null;
  tasks?: WorkdayTimingTask[];
  now?: Date;
  todayDateKey?: string;
  nowMinutes?: number;
};

function minutesToTime(minutes: number | null) {
  if (minutes === null) return '—';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function moscowDateAndMinutes(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function dateKeyDifferenceInDays(fromDateKey: string, toDateKey: string) {
  const [fromYear, fromMonth, fromDay] = fromDateKey.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDateKey.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((to - from) / 86_400_000);
}

function latestShiftStartMinutes(department: string | null | undefined) {
  const supportedShiftCodes = department ? supportedShiftCodesByDepartment[department] : null;
  if (!supportedShiftCodes) return null;
  const starts = supportedShiftCodes
    .map((code) => getShiftOption(code))
    .map((shift) => shift.startMinutes)
    .filter((value): value is number => value !== null);
  return starts.length > 0 ? Math.max(...starts) : null;
}

export function evaluateWorkdayTiming({
  dateKey,
  department,
  scheduleStatus,
  workDay = null,
  tasks = [],
  now = new Date(),
  todayDateKey = getMoscowDateKey(now),
  nowMinutes = getMoscowMinutes(now),
}: EvaluateWorkdayTimingInput) {
  const violations: WorkdayTimingViolation[] = [];
  const isPastDate = dateKey < todayDateKey;
  const isToday = dateKey === todayDateKey;

  if (!workDay && scheduleStatus === 'working') {
    const latestStart = latestShiftStartMinutes(department);
    if (isPastDate || (isToday && latestStart !== null && nowMinutes > latestStart)) {
      violations.push({
        id: 'workday-not-started',
        kind: 'workday_not_started',
        label: 'Рабочий день не начат',
        detail: isPastDate
          ? 'По графику был рабочий день, но отметки о начале нет.'
          : `Рабочий день не начат после самой поздней доступной смены ${minutesToTime(latestStart)}.`,
        minutesLate: isToday && latestStart !== null ? nowMinutes - latestStart : null,
        taskId: null,
      });
    }
  }

  if (workDay) {
    if (workDay.lateMinutes > 0) {
      violations.push({
        id: 'late-start',
        kind: 'late_start',
        label: 'Опоздание на входе',
        detail: `Начало ${minutesToTime(moscowDateAndMinutes(workDay.startedAt).minutes)} при плане ${minutesToTime(workDay.shiftStartMinutes)} · +${workDay.lateMinutes} мин.`,
        minutesLate: workDay.lateMinutes,
        taskId: null,
      });
    }

    const checkoutOverdue = !workDay.endedAt && (
      workDay.status === 'missing_checkout'
      || isPastDate
      || (isToday && workDay.shiftEndMinutes !== null && nowMinutes > workDay.shiftEndMinutes)
    );
    if (checkoutOverdue) {
      violations.push({
        id: 'missing-checkout',
        kind: 'missing_checkout',
        label: 'Рабочий день не завершён',
        detail: workDay.shiftEndMinutes === null
          ? 'После окончания дня нет отметки о завершении.'
          : `После окончания смены ${minutesToTime(workDay.shiftEndMinutes)} нет отметки о завершении.`,
        minutesLate: isToday && workDay.shiftEndMinutes !== null ? nowMinutes - workDay.shiftEndMinutes : null,
        taskId: null,
      });
    }
  }

  for (const task of tasks) {
    if (task.plannedTimeMinutes === null) continue;

    if (task.status === 'done' && task.completedAt) {
      const completed = moscowDateAndMinutes(task.completedAt);
      const dayDifference = dateKeyDifferenceInDays(dateKey, completed.dateKey);
      const minutesLate = dayDifference * 24 * 60 + completed.minutes - task.plannedTimeMinutes;
      if (dayDifference >= 0 && minutesLate > 0) {
        violations.push({
          id: `task-late-${task.id}`,
          kind: 'task_late',
          label: task.title,
          detail: `План ${minutesToTime(task.plannedTimeMinutes)}, выполнено ${minutesToTime(completed.minutes)}${dayDifference > 0 ? ` на следующий день (+${dayDifference} дн.)` : ''} · +${minutesLate} мин.`,
          minutesLate,
          taskId: task.id,
        });
      }
      continue;
    }

    if (isPastDate || (isToday && nowMinutes > task.plannedTimeMinutes)) {
      violations.push({
        id: `task-overdue-${task.id}`,
        kind: 'task_overdue',
        label: task.title,
        detail: `Срок ${minutesToTime(task.plannedTimeMinutes)}, задача не выполнена.`,
        minutesLate: isToday ? nowMinutes - task.plannedTimeMinutes : null,
        taskId: task.id,
      });
    }
  }

  return violations;
}
