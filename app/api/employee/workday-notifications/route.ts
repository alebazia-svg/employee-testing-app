import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.workdayNotification.findMany({
    where: { userId: user.id, status: 'sent', readAt: null },
    orderBy: { sentAt: 'desc' },
    take: 30,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      sentAt: true,
      readAt: true,
      taskId: true,
      issueId: true,
      reviewId: true,
      task: { select: { status: true, run: { select: { status: true } } } },
      issue: { select: { status: true } },
      review: { select: { status: true } },
    },
  });
  const seenTargets = new Set<string>();
  const notifications = rows
    .filter((notification) => {
      if (notification.task) return notification.task.status === 'pending' && notification.task.run.status === 'active';
      if (notification.issue) return notification.issue.status === 'open';
      if (notification.review) return notification.review.status === 'open';
      return true;
    })
    .filter((notification) => {
      const target = notification.taskId ? `task:${notification.taskId}` : notification.issueId ? `issue:${notification.issueId}` : notification.reviewId ? `review:${notification.reviewId}` : `notification:${notification.id}`;
      if (seenTargets.has(target)) return false;
      seenTargets.add(target);
      return true;
    })
    .map(({ task: _task, issue: _issue, review: _review, ...notification }) => ({
      ...notification,
      href: notification.reviewId ? `/employee/payment-checks/${notification.reviewId}` : '/employee',
    }));
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
