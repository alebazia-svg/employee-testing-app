import { buildDateRange } from './workday';
import { isValidScheduleDateKey } from './workday-schedule';

export const SCHEDULE_NEAR_KIND = 'schedule_near_fill_request';
export function scheduleNearDates(today: string) { return buildDateRange(today, 2); }
export function scheduleNearNoticeRef(fingerprint: string) {
  const match = /^schedule-near:(retail|wholesale):(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(fingerprint);
  if (!match || !isValidScheduleDateKey(match[2]) || !Number.isSafeInteger(Number(match[3])) || Number(match[3]) <= 0) return null;
  return { department: match[1], date: match[2], userId: Number(match[3]) };
}
export function scheduleCalendarHref(date: string, editSingleDay = false) {
  return `/employee?tab=schedule&date=${date}${editSingleDay ? '&edit=1' : ''}`;
}
/** Reminder horizon only: the calendar itself remains open for any future month. */
export function scheduleNearReminder(input: {
  today: string;
  entries: Array<{ date: string; status: string }>;
  vacations: Array<{ dateFrom: string; dateTo: string }>;
}) {
  const dates = scheduleNearDates(input.today);
  const saved = new Set(input.entries.filter(e => ['working', 'off'].includes(e.status)).map(e => e.date));
  const missing = dates.filter(date => !saved.has(date) && !input.vacations.some(v => v.dateFrom <= date && v.dateTo >= date));
  const todayMissing = missing.includes(dates[0]), tomorrowMissing = missing.includes(dates[1]);
  const qualifier = todayMissing && tomorrowMissing ? 'Сегодня и завтра не заполнены' : todayMissing ? 'Сегодня не заполнен' : tomorrowMissing ? 'Завтра не заполнен' : '';
  return { active: missing.length > 0, missing, todayMissing, tomorrowMissing, qualifier,
    title: 'Заполните график', body: `${qualifier ? qualifier + '. ' : ''}Отметьте рабочий день или выходной.` };
}
