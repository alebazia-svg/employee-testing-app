import { dispatchDueWorkdayNotifications } from '@/lib/workday-notifications';
import { recheckOpenKkmShiftCloseIssues } from '@/lib/kkm-shift-close-control';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const expected = process.env.WORKDAY_NOTIFICATION_SECRET?.trim() ?? '';
  const received = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!expected || received !== expected) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const [notifications, kkmShiftClose] = await Promise.all([
    dispatchDueWorkdayNotifications(),
    recheckOpenKkmShiftCloseIssues(),
  ]);
  return Response.json({ ...notifications, kkmShiftClose });
}
