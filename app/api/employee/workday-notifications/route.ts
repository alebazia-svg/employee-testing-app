import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const notifications = await prisma.workdayNotification.findMany({
    where: { userId: user.id, status: 'sent' },
    orderBy: [{ readAt: 'asc' }, { sentAt: 'desc' }],
    take: 30,
    select: { id: true, kind: true, title: true, body: true, sentAt: true, readAt: true, taskId: true, issueId: true },
  });
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
