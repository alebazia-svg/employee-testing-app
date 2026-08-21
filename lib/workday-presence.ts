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
