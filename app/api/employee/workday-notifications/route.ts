import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { workdayNotificationThreadWhere } from '@/lib/workday-notification-thread';
import { loadEmployeeNotifications } from '@/lib/employee-notification-snapshot';
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(await loadEmployeeNotifications(user));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await req.json().catch(() => null);
  const id = Number(payload?.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: 'Invalid notification id' }, { status: 400 });
  const notification = await prisma.workdayNotification.findFirst({
    where: { id, userId: user.id },
    select: { id: true, kind: true, fingerprint: true, taskId: true, issueId: true, reviewId: true },
  });
  if (!notification) return Response.json({ error: 'Notification not found' }, { status: 404 });
  await prisma.workdayNotification.updateMany({
    where: { userId: user.id, ...workdayNotificationThreadWhere(notification) },
    data: { readAt: new Date() },
  });
  return Response.json({ ok: true });
}
