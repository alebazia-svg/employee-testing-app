import { getMoscowDateKey, getMoscowMinutes } from './workday';
import { APP_ATTENDANCE_FROM } from './team-attendance';
import { isValidScheduleDateKey } from './workday-schedule';

// Owner-approved 2026-11-11. ADMIN day accounting: never changes a saved plan, payroll,
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
  date: string; department: string; employeeLogin?: string; plan: string; source: string; vacation: boolean;
  qrAccepted: boolean; appStarted?: boolean; googleArrival?: number | null; googleDeparture?: number | null; googleMarksAvailable: boolean;
  planFromQr?: boolean; correction?: CalendarWorkingCorrection | null; now: Date;
}) {
  const { date, now } = input, today = getMoscowDateKey(now);
  const eligible = isValidScheduleDateKey(date) && date >= APP_ATTENDANCE_FROM && date <= today;
  const correction = input.correction?.date === date && input.correction.status === 'working' ? input.correction : null;
  const endMinutes = CALENDAR_DAY_END[input.department];
  // Timur received app access on 19 November. Blank dates in November before
  // his onboarding are not evidence of a missed start or a day off.
  const beforeTimurOnboarding = input.employeeLogin === 't.nazranov'
    && date >= '2026-11-01' && date < '2026-11-19'
    && ['unset', 'unknown', 'unavailable'].includes(input.plan);
  const closed = eligible && !beforeTimurOnboarding
    && (date < today || endMinutes !== undefined && getMoscowMinutes(now) >= endMinutes);
  const appStarted = input.qrAccepted || Boolean(input.appStarted);
  const validGoogleTime = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 1440;
  const googleMarked = !appStarted && input.googleMarksAvailable
    && (validGoogleTime(input.googleArrival) || validGoogleTime(input.googleDeparture));
  // Google is an optional positive reserve. Its outage or lack of setup never
  // blocks accounting based on the successfully read application source.
  const factual = eligible && (appStarted || googleMarked || Boolean(correction) || closed);
  let state = input.plan, source = input.source, explanation = '';
  if (eligible && input.qrAccepted) {
    state = 'working'; source = 'По QR'; explanation = 'Начало по QR принято. День учитывается как рабочий.';
  } else if (eligible && appStarted) {
    state = 'working'; source = 'Приложение'; explanation = 'Начало рабочего дня отмечено в приложении.';
  } else if (eligible && googleMarked) {
    state = 'working'; source = 'Google · резерв'; explanation = validGoogleTime(input.googleArrival)
      ? 'Начало рабочего дня отмечено в Google. Отметки начала в приложении нет.'
      : 'Окончание рабочего дня отмечено в Google. Время начала в приложении не записано.';
  } else if (eligible && correction) {
    state = 'working'; source = 'Исправлено администратором';
    explanation = `${correction.actorName}: ${correction.reason}`;
  } else if (closed && !input.vacation && input.plan !== 'off') {
    state = 'off'; source = 'Автоматически'; explanation = 'Рабочий день закончился. Отметки начала в приложении нет; подтверждения из Google не получено.';
  }
  // Keep provenance in day details. The main calendar only needs an extra
  // caption when accounting differs from the saved plan or supplied that plan.
  const matchesPlan = eligible && (
    state === 'off' && input.plan === 'off' && source === input.source
    || state === 'working' && input.plan === 'working' && (appStarted || googleMarked) && !input.planFromQr
  );
  return { state, source, explanation, factual, caption: matchesPlan ? '' : source,
    usesGoogleAttendance: eligible && source === 'Google · резерв',
    canMarkWorking: eligible && !appStarted && !googleMarked && !correction };
}
