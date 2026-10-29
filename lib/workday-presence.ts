import { formatTime } from './workday';

export type ColleaguePresence = 'active' | 'completed' | 'scheduled' | 'off' | 'missing';

type WorkdayPresenceInput = {
  status: string;
  endedAt: string | Date | null;
} | null | undefined;

export function colleaguePresence(scheduleStatus: string | null | undefined, workday: WorkdayPresenceInput): ColleaguePresence {
  if (workday && !workday.endedAt && ['active', 'missing_checkout'].includes(workday.status)) return 'active';
  if (workday && (Boolean(workday.endedAt) || workday.status === 'completed')) return 'completed';
  if (scheduleStatus === 'working') return 'scheduled';
  if (scheduleStatus === 'off') return 'off';
  return 'missing';
}

/** Factual attendance only; never substitute a planned shift or invent checkout. */
export function actualColleagueWorkday(workday: { status: string; startedAt: string | Date; endedAt: string | Date | null } | null | undefined) {
  if (!workday || !Number.isFinite(new Date(workday.startedAt).getTime())) return null;
  const start = formatTime(workday.startedAt);
  if (workday.endedAt && Number.isFinite(new Date(workday.endedAt).getTime())) return `${start}–${formatTime(workday.endedAt)}`;
  return `С ${start} · ${workday.status === 'completed' ? 'окончание не указано' : 'день не завершён'}`;
}
