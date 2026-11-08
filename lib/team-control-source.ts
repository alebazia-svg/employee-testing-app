import 'server-only';
import { boundedTeamRead } from './team-source-deadline';
import { unstable_cache } from 'next/cache';
import { createInFlightRead } from './procurement-inflight-read';
import { getAttendanceRows, getScheduleRows } from '@/lib/google-sheets';
const shareSnapshot = createInFlightRead<{
  plans: Awaited<ReturnType<typeof getScheduleRows>>['rows'];
  marks: Awaited<ReturnType<typeof getAttendanceRows>>['rows'];
  planAvailable: boolean; marksAvailable: boolean; readAt: string;
}>();
export const getTeamGoogleSnapshot = unstable_cache(() => shareSnapshot('team-google-current', async () => {
  const [plan, marks] = await Promise.allSettled([boundedTeamRead(signal => getScheduleRows({ signal })),boundedTeamRead(signal => getAttendanceRows({ signal }))]);
  return {
    plans: plan.status === 'fulfilled' && plan.value.mode === 'google-sheets' ? plan.value.rows : [],
    marks: marks.status === 'fulfilled' && marks.value.mode === 'google-sheets' ? marks.value.rows : [],
    planAvailable: plan.status === 'fulfilled' && plan.value.mode === 'google-sheets',
    marksAvailable: marks.status === 'fulfilled' && marks.value.mode === 'google-sheets',
    readAt: new Date().toISOString(),
  };
}), ['team-google-readonly-v1'], { revalidate: 30 });
