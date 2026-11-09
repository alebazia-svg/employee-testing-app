import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncSubscribedAccess } from '@/lib/push-access-sync';
import { cookies } from 'next/headers';
import { accessBrowserCookie } from '@/lib/portal-access-identity';
import { isOwnerInspectionBrowser, ownerInspectionBrowserMap } from '@/lib/push-owner-inspection';

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

  // The owner's phone signed in as an employee for an inspection must not take
  // over the employee's notifications (decision 2026-11-08).
  const browserId = (await cookies()).get(accessBrowserCookie)?.value;
  if (browserId) {
    const owner = await prisma.portalAccessBrowserOwner.findFirst({ where: { browserInstanceId: browserId, disabledAt: null }, select: { browserInstanceId: true, ownerUserId: true } });
    if (owner && isOwnerInspectionBrowser(browserId, user.id, ownerInspectionBrowserMap([owner]))) {
      return Response.json({ ok: true, active: false, ownerInspection: true });
    }
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const subscription = await tx.workdayPushSubscription.upsert({
        where: { endpoint },
        create: { userId: user.id, endpoint, p256dh, auth, userAgent: req.headers.get('user-agent') ?? '' },
        update: { userId: user.id, p256dh, auth, userAgent: req.headers.get('user-agent') ?? '', disabledAt: null },
      });
      const accessSynced = await syncSubscribedAccess(tx, user.id, subscription);
      await tx.workdayNotification.updateMany({
        where: {
          userId: user.id,
          status: 'sent',
          readAt: null,
          pushStatus: { in: ['no_subscription', 'retry_pending'] },
        },
        data: { pushStatus: 'retry_pending', nextPushAttemptAt: new Date(), lastError: '' },
      });
      return { ok: true, id: subscription.id, active: true, accessSynced };
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: 'Не удалось сохранить подключение. Попробуйте ещё раз.' }, { status: 503 });
  }
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
