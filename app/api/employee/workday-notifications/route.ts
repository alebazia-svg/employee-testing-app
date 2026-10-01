import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { workdayIssueView } from '@/lib/workday-control-issue-view';
import { reconcileActiveWorkdayNotifications, workdayNotificationHref, workdayTaskNotificationCopy } from '@/lib/workday-notifications';
import { workdayNotificationThreadWhere } from '@/lib/workday-notification-thread';
import { currentDeliveryPush, DELIVERY_READY_KIND } from '@/lib/procurement-delivery-notifications';
import { DELIVERY_PUSH_COPY } from '@/lib/employee-push-policy';
import { COLLECTION_READY_KIND, COLLECTION_PUSH_COPY, currentCollectionPushes } from '@/lib/procurement-collection-notifications';

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
      task: { select: { status: true, category: true, title: true, run: { select: { status: true } } } },
      issue: { select: { status: true, employeeActionRequired: true, ruleKey: true, title: true, detail: true, sourceData: true } },
      review: { select: { status: true } },
    },
  });
  const seenTargets = new Set<string>();
  const activeRows = await reconcileActiveWorkdayNotifications(prisma, rows);
  const delivery = activeRows.some(row => row.kind === DELIVERY_READY_KIND) ? await currentDeliveryPush() : null;
  const collections = activeRows.some(row => row.kind === COLLECTION_READY_KIND) ? await currentCollectionPushes() : null;
  const notifications = activeRows
    .filter((notification) => {
      const reply = notification.kind.endsWith('_reply');
      const target = reply ? `reply:${notification.id}` : notification.taskId ? `task:${notification.taskId}` : notification.issueId ? `issue:${notification.issueId}` : notification.reviewId ? `review:${notification.reviewId}` : `notification:${notification.id}`;
      if (seenTargets.has(target)) return false;
      seenTargets.add(target);
      return true;
    })
    .map(({ task, issue, review: _review, ...notification }) => {
      const issueView = issue && !notification.kind.endsWith('_reply') ? workdayIssueView(issue) : null;
      const taskCopy = task ? workdayTaskNotificationCopy(task, notification.kind) : null;
      const deliveryCopy = notification.kind === DELIVERY_READY_KIND && delivery?.state === 'ready'
        && delivery.fingerprint === notification.fingerprint && delivery.userId === user.id ? delivery : null;
      const collectionCopy = collections?.state === 'ready' ? collections.notices.find(n => n.userId === user.id && n.fingerprint === notification.fingerprint) : null;
      const copy = notification.kind === DELIVERY_READY_KIND ? deliveryCopy ?? DELIVERY_PUSH_COPY
        : notification.kind === COLLECTION_READY_KIND ? collectionCopy ?? COLLECTION_PUSH_COPY : null;
      return {
        ...notification,
        title: copy?.title || issueView?.summaryTitle || taskCopy?.title || notification.title,
        body: copy?.body || issueView?.notificationBody || taskCopy?.body || notification.body,
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
  const notification = await prisma.workdayNotification.findFirst({
    where: { id, userId: user.id },
    select: { id: true, taskId: true, issueId: true, reviewId: true },
  });
  if (!notification) return Response.json({ error: 'Notification not found' }, { status: 404 });
  await prisma.workdayNotification.updateMany({
    where: { userId: user.id, ...workdayNotificationThreadWhere(notification) },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true });
}
