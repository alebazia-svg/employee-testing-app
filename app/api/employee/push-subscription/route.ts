import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { suppressPushBacklogOnNewSubscription } from '@/lib/workday-push-subscription';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });
  return Response.json({ publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '' });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await req.json().catch(() => null);
  const endpoint = readString(payload?.endpoint);
  const p256dh = readString(payload?.keys?.p256dh);
  const auth = readString(payload?.keys?.auth);
  if (!endpoint || !p256dh || !auth) return Response.json({ error: 'Некорректная push-подписка' }, { status: 400 });

  const subscribedAt = new Date();
  const subscription = await prisma.$transaction(async (tx) => {
    const existing = await tx.workdayPushSubscription.findUnique({
      where: { endpoint },
      select: { userId: true, disabledAt: true },
    });
    const saved = await tx.workdayPushSubscription.upsert({
      where: { endpoint },
      create: { userId: user.id, endpoint, p256dh, auth, userAgent: req.headers.get('user-agent') ?? '' },
      update: { userId: user.id, p256dh, auth, userAgent: req.headers.get('user-agent') ?? '', disabledAt: null },
    });
    if (!existing || existing.userId !== user.id || existing.disabledAt) {
      await suppressPushBacklogOnNewSubscription(tx, user.id, subscribedAt);
    }
    return saved;
  });
  return Response.json({ ok: true, id: subscription.id });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'EMPLOYEE') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await req.json().catch(() => null);
  const endpoint = readString(payload?.endpoint);
  if (!endpoint) return Response.json({ error: 'Некорректная push-подписка' }, { status: 400 });
  await prisma.workdayPushSubscription.updateMany({ where: { userId: user.id, endpoint }, data: { disabledAt: new Date() } });
  return Response.json({ ok: true });
}
