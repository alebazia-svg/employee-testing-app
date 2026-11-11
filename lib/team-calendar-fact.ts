import { getMoscowDateKey, getMoscowMinutes } from './workday';
import { APP_ATTENDANCE_FROM } from './team-attendance';
import { isValidScheduleDateKey } from './workday-schedule';

// Owner-approved 2026-11-11. Calendar only: never changes a saved plan, payroll,
// QR/start/end timestamps, shift selection, tasks or employee notifications.
export const CALENDAR_DAY_END: Record<string, number> = { retail: 1200, wholesale: 1140, procurement: 1080 };
export const CALENDAR_CORRECTION_SOURCE = 'workday_calendar_fact';
export const calendarCorrectionSourceId = (userId: number, date: string) => `${userId}:${date}`;
export type CalendarWorkingCorrection = {
  version: 1; userId: number; date: string; status: 'working' | 'reset';
  actorId: number; actorName: string; reason: string; correctedAt: string;
};
export function parseCalendarWorkingCorrection(body: string): CalendarWorkingCorrection | null {
  try {
    const r = JSON.parse(body);
    return r?.version === 1 && Number.isInteger(r.userId) && r.userId > 0
      && typeof r.date === 'string' && isValidScheduleDateKey(r.date) && ['working', 'reset'].includes(r.status)
      && Number.isInteger(r.actorId) && r.actorId > 0 && typeof r.actorName === 'string'
      && typeof r.reason === 'string' && r.reason.trim().length > 0 && r.reason.length <= 500
      && typeof r.correctedAt === 'string' && Number.isFinite(Date.parse(r.correctedAt)) ? r : null;
  } catch { return null; }
}
export function calendarQrAccepted(date: string, values: Array<Date | string | null | undefined>, now: Date) {
  return values.some(value => {
    if (!value) return false;
    const accepted = new Date(value);
    return Number.isFinite(+accepted) && accepted <= now && getMoscowDateKey(accepted) === date;
  });
}
export function resolveCalendarFact(input: {
  date: string; department: string; plan: string; source: string; vacation: boolean;
  qrAccepted: boolean; correction?: CalendarWorkingCorrection | null; now: Date;
}) {
  const { date, now } = input, today = getMoscowDateKey(now);
  const eligible = isValidScheduleDateKey(date) && date >= APP_ATTENDANCE_FROM && date <= today;
  const correction = input.correction?.date === date && input.correction.status === 'working' ? input.correction : null;
  const endMinutes = CALENDAR_DAY_END[input.department];
  const closed = eligible && (date < today || endMinutes !== undefined && getMoscowMinutes(now) >= endMinutes);
  const factual = eligible && (input.qrAccepted || Boolean(correction) || closed);
  let state = input.plan, source = input.source, explanation = '';
  if (eligible && input.qrAccepted) {
    state = 'working'; source = 'По QR'; explanation = 'Начало по QR принято. День учитывается как рабочий.';
  } else if (eligible && correction) {
    state = 'working'; source = 'Исправлено администратором';
    explanation = `${correction.actorName}: ${correction.reason}`;
  } else if (closed && !input.vacation) {
    state = 'off'; source = 'Автоматически'; explanation = 'Рабочий день закончился. Отметки начала по QR нет.';
  }
  return { state, source, explanation, factual, canMarkWorking: eligible && !input.qrAccepted && !correction };
}
