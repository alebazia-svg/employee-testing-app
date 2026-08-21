import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { workdayIssueView } from '@/lib/workday-control-issue-view';
import { reconcileActiveWorkdayNotifications, workdayNotificationHref } from '@/lib/workday-notifications';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.workdayNotification.findMany({
    where: { userId: user.id, status: 'sent', readAt: null },
    orderBy: { sentAt: 'desc' },
    select: {
      id: true,
      kind: true,
      fingerprint: true,
      title: true,
      body: true,
      sentAt: true,
      readAt: true,
      taskId: true,
      issueId: true,
      reviewId: true,
      task: { select: { status: true, run: { select: { status: true } } } },
      issue: { select: { status: true, employeeActionRequired: true, ruleKey: true, title: true, detail: true, sourceData: true } },
      review: { select: { status: true } },
    },
  });
  const seenTargets = new Set<string>();
  const activeRows = await reconcileActiveWorkdayNotifications(prisma, rows);
  const notifications = activeRows
    .filter((notification) => {
      const target = notification.taskId ? `task:${notification.taskId}` : notification.issueId ? `issue:${notification.issueId}` : notification.reviewId ? `review:${notification.reviewId}` : `notification:${notification.id}`;
      if (seenTargets.has(target)) return false;
      seenTargets.add(target);
      return true;
    })
    .map(({ task: _task, issue, review: _review, ...notification }) => {
      const issueView = issue ? workdayIssueView(issue) : null;
      return {
        ...notification,
        title: issueView?.summaryTitle || notification.title,
        body: issueView?.notificationBody || notification.body,
        href: workdayNotificationHref(notification),
      };
    })
    .slice(0, 30);
  return Response.json({ notifications });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await req.json().catch(() => null);
  const id = Number(payload?.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: 'Invalid notification id' }, { status: 400 });
  await prisma.workdayNotification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
  return Response.json({ ok: true });
}
