import { getCurrentAdmin } from '@/lib/auth';
import { adminPushRegistrationModeForRequest } from '@/lib/admin-push-subscription-policy';
import { prisma } from '@/lib/prisma';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const registrationMode = adminPushRegistrationModeForRequest(req);
  return Response.json({
    publicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '',
    registrationAllowed: registrationMode !== 'legacy-disabled',
  });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await req.json().catch(() => null);
  const endpoint = readString(payload?.endpoint);
  const p256dh = readString(payload?.keys?.p256dh);
  const auth = readString(payload?.keys?.auth);
  if (!endpoint || !p256dh || !auth) return Response.json({ error: 'Некорректная push-подписка' }, { status: 400 });
  const registrationMode = adminPushRegistrationModeForRequest(req);
  const now = new Date();
  const userAgent = req.headers.get('user-agent') ?? '';
  const subscription = await prisma.$transaction(async (tx) => {
    const saved = await tx.workdayPushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: admin.id,
        endpoint,
        p256dh,
        auth,
        userAgent,
        disabledAt: registrationMode === 'legacy-disabled' ? now : null,
      },
      update: {
        userId: admin.id,
        p256dh,
        auth,
        userAgent,
        disabledAt: registrationMode === 'legacy-disabled' ? now : null,
      },
    });
    if (registrationMode === 'primary-single') {
      await tx.workdayPushSubscription.updateMany({
        where: { userId: admin.id, id: { not: saved.id }, disabledAt: null },
        data: { disabledAt: now },
      });
    }
    return saved;
  });
  return Response.json({ ok: true, id: subscription.id, active: registrationMode !== 'legacy-disabled' });
}

export async function DELETE(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const payload = await req.json().catch(() => null);
  const endpoint = readString(payload?.endpoint);
  if (!endpoint) return Response.json({ error: 'Некорректная push-подписка' }, { status: 400 });
  await prisma.workdayPushSubscription.updateMany({ where: { userId: admin.id, endpoint }, data: { disabledAt: new Date() } });
  return Response.json({ ok: true });
}
