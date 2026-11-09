import { requiredScheduleWeekDates, scheduleWeekStart, shiftScheduleDate } from './schedule-week-reminder';

/** Pure rules for the approved «Ваши дни на неделю» sheet (2026-11-08). */
export type WeekSheetStatus = 'working' | 'off';
export type WeekSheetDay = { date: string; label: string; status: WeekSheetStatus | null; vacation: boolean; highlight: boolean };
type Entry = { date: string; status: string };
type Vacation = { dateFrom: string; dateTo: string };

const weekday = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' });
const at = (date: string) => new Date(`${date}T12:00:00+03:00`);
const savedStatus = (entries: Entry[], date: string): WeekSheetStatus | null => {
  const status = entries.find((entry) => entry.date === date)?.status;
  return status === 'working' || status === 'off' ? status : null;
};
const onVacation = (vacations: Vacation[], date: string) => vacations.some((v) => v.dateFrom <= date && v.dateTo >= date);

/** Days from tomorrow through the end of the existing planning week. Today is
 * listed only while it is still unmarked and no QR start marked it. */
export function weekSheetDays(input: { today: string; entries: Entry[]; vacations: Vacation[]; includeToday: boolean }): WeekSheetDay[] {
  const tomorrow = shiftScheduleDate(input.today, 1);
  const dates = requiredScheduleWeekDates(input.today).filter((date) => date > input.today
    || (date === input.today && input.includeToday && !savedStatus(input.entries, date) && !onVacation(input.vacations, date)));
  return dates.map((date) => ({
    date,
    label: date === input.today ? 'Сегодня' : date === tomorrow ? `Завтра, ${weekday.format(at(date))} ${at(date).getDate()}` : `${weekday.format(at(date))}, ${dayMonth.format(at(date))}`,
    status: savedStatus(input.entries, date),
    vacation: onVacation(input.vacations, date),
    highlight: date === tomorrow,
  }));
}

export function weekSheetThroughLabel(days: WeekSheetDay[]) {
  const last = days[days.length - 1]?.date;
  return last ? dayMonth.format(at(last)) : '';
}

/** Tomorrow (unless on vacation) must be answered; any answer counts. */
export function weekSheetCanSave(days: WeekSheetDay[], draft: Record<string, WeekSheetStatus | null>) {
  const required = days.filter((day) => day.highlight && !day.vacation);
  return required.every((day) => Boolean(draft[day.date]));
}

export function weekSheetChanges(days: WeekSheetDay[], draft: Record<string, WeekSheetStatus | null>) {
  return days.flatMap((day) => {
    const next = draft[day.date];
    if (day.vacation || !next || next === day.status) return [];
    return [{ date: day.date, status: next, previousStatus: day.status }];
  });
}

/** The bulk endpoint accepts one bounded week per request (current or planning week). */
export function weekSheetRequests(changes: Array<{ date: string; status: WeekSheetStatus; previousStatus: WeekSheetStatus | null }>) {
  const groups = new Map<string, typeof changes>();
  for (const change of changes) {
    const key = scheduleWeekStart(change.date);
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, items]) => ({
    weekStart,
    monthKey: items[0].date.slice(0, 7),
    changes: items,
  }));
}

export function weekSheetLastWeek(days: WeekSheetDay[], entries: Entry[]) {
  return Object.fromEntries(days.map((day) => [day.date, savedStatus(entries, shiftScheduleDate(day.date, -7)) ?? undefined])) as Record<string, WeekSheetStatus | undefined>;
}

/** At most two automatic openings per day; opening from a reminder is not limited. */
export const WEEK_SHEET_DAILY_LIMIT = 2;
export function weekSheetAutoAllowed(shownToday: number) {
  return shownToday < WEEK_SHEET_DAILY_LIMIT;
}

/** The notifications sheet after QR is offered on at most three different days. */
export const PUSH_ASK_DAY_LIMIT = 3;
export function pushAskAllowed(askedDays: string[], today: string) {
  return askedDays.includes(today) ? false : new Set(askedDays).size < PUSH_ASK_DAY_LIMIT;
}
