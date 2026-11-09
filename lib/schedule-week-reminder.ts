import { buildDateRange } from './workday';
import { isValidScheduleDateKey } from './workday-schedule';

export const SCHEDULE_WEEK_KIND = 'schedule_week_fill_request';
const dayMs = 86400000;
export function shiftScheduleDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * dayMs).toISOString().slice(0, 10);
}
export function scheduleWeekStart(date: string) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftScheduleDate(date, -((weekday + 6) % 7));
}
export function schedulePlanningWeek(today: string) {
  const current = scheduleWeekStart(today);
  return today >= shiftScheduleDate(current, 4) ? shiftScheduleDate(current, 7) : current;
}
export function scheduleWeekNoticeRef(fingerprint: string) {
  const match = /^schedule-week:(retail|wholesale):(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(fingerprint);
  if (!match || !isValidScheduleDateKey(match[2]) || scheduleWeekStart(match[2]) !== match[2] || !Number.isSafeInteger(Number(match[3])) || Number(match[3]) <= 0) return null;
  return { department: match[1], weekStart: match[2], userId: Number(match[3]) };
}
export function requiredScheduleWeekDates(today: string) {
  const end = shiftScheduleDate(schedulePlanningWeek(today), 6);
  return buildDateRange(today, Math.round((Date.parse(end) - Date.parse(today)) / dayMs) + 1);
}
/** A bounded weekly editor may save the current week, or next week from Friday. */
export function scheduleWeekAllowsDate(weekStart: string, date: string, today: string) {
  return isValidScheduleDateKey(weekStart) && [scheduleWeekStart(today), schedulePlanningWeek(today)].includes(weekStart)
    && date >= today && date <= shiftScheduleDate(weekStart, 6);
}
