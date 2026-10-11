import { getCurrentUser } from '@/lib/auth';
import { currentCashIssue } from '@/lib/procurement-cash-issue-notifications';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isActive || user.role !== 'EMPLOYEE' || user.portalArea !== 'WORKDAY') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const current = await currentCashIssue(new Date(), new URL(req.url).searchParams.get('fresh') === '1');
  const request = current.state === 'ready' && current.userId === user.id ? current.request : null;
  return Response.json({ request, unavailable: current.state === 'unknown', waitingForShift: current.state === 'waiting_shift' && current.userId === user.id }, { headers: { 'Cache-Control': 'no-store' } });
}
