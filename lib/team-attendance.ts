import { formatTime } from './workday';
import { clockLabel, clockMinutes, teamShiftState, type TeamGoogleDay } from './team-control';

// Owner-approved cutover. Historical primary-source selection stays unchanged.
export const APP_ATTENDANCE_FROM = '2026-10-24';
export const usesAppAttendance = (date: string) => date >= APP_ATTENDANCE_FROM;

type Source = 'app' | 'google' | null;
export type TeamAttendance = {
  start: string; end: string; shift: string; late: number;
  startSource: Source; endSource: Source; sourceLabel: string;
  active: boolean; marksAvailable: boolean; state: string;
};
type AppDay = {
  startedAt: Date | string; endedAt: Date | string | null;
  shiftLabel: string; lateMinutes: number; status: string;
};

export function resolveTeamAttendance(input: {
  date: string; today: string; workDay?: AppDay | null;
  google: TeamGoogleDay; googleAvailable: boolean; fallbackState: string;
}): TeamAttendance {
  const { workDay, google, googleAvailable, date, today } = input;
  const startSource: Source = workDay ? 'app' : googleAvailable && google.arrival !== null ? 'google' : null;
  const start = workDay ? formatTime(workDay.startedAt) : googleAvailable ? clockLabel(google.arrival) : '—';
  // A Google end preceding the selected app start cannot complete this shift.
  const googleEndValid = googleAvailable && google.departure !== null
    && (start === '—' || google.departure >= clockMinutes(start)!);
  const endSource: Source = workDay?.endedAt ? 'app' : googleEndValid ? 'google' : null;
  const end = workDay?.endedAt ? formatTime(workDay.endedAt) : endSource === 'google' ? clockLabel(google.departure) : '—';
  const active = Boolean(workDay && workDay.status !== 'completed' && !workDay.endedAt && end === '—');
  const sources = new Set([startSource, endSource].filter(Boolean));
  const sourceLabel = sources.size === 2 ? 'Приложение + Google' : sources.has('google') ? 'Google · резерв' : 'Приложение';
  return {
    start, end, startSource, endSource, sourceLabel, active,
    shift: workDay?.shiftLabel || google.shift,
    late: workDay ? workDay.lateMinutes : googleAvailable ? google.lateMinutes : 0,
    // No app mark plus unavailable fallback is not evidence of absence.
    marksAvailable: Boolean(workDay) || googleAvailable,
    state: workDay?.status === 'completed' && end === '—'
      ? 'Закрыта без времени завершения'
      : teamShiftState(date, today, start !== '—', active, end, input.fallbackState),
  };
}
