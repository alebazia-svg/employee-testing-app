import 'server-only';
import { unstable_cache } from 'next/cache';
import { getAttendanceRows, getScheduleRows } from '@/lib/google-sheets';
function bounded<T>(task: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Google source timeout')), 12_000);
    task.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}
export const getTeamGoogleSnapshot = unstable_cache(async () => {
  const [plan, marks] = await Promise.allSettled([bounded(getScheduleRows()),bounded(getAttendanceRows())]);
  return {
    plans: plan.status === 'fulfilled' && plan.value.mode === 'google-sheets' ? plan.value.rows : [],
    marks: marks.status === 'fulfilled' && marks.value.mode === 'google-sheets' ? marks.value.rows : [],
    planAvailable: plan.status === 'fulfilled' && plan.value.mode === 'google-sheets',
    marksAvailable: marks.status === 'fulfilled' && marks.value.mode === 'google-sheets',
    readAt: new Date().toISOString(),
  };
}, ['team-google-readonly-v1'], { revalidate: 30 });
