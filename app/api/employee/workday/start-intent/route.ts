import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';
import { parseWorkdayQrDepartment, workdayStartIntentExpiresAt } from '@/lib/workday-qr';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const qrPayload = typeof payload.qrPayload === 'string' ? payload.qrPayload : '';
  const department = parseWorkdayQrDepartment(qrPayload);
  if (!department) {
    return Response.json({ error: 'Это не QR-код начала рабочего дня.' }, { status: 400 });
  }
  if (department !== user.department) {
    return Response.json({ error: department === 'retail' ? 'Этот QR-код для розницы.' : 'Этот QR-код для опта.' }, { status: 400 });
  }

  const now = new Date();
  const date = getMoscowDateKey(now);
  const existingWorkDay = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existingWorkDay) {
    return Response.json({
      alreadyStarted: true,
      workDayId: existingWorkDay.id,
      qrAcceptedAt: (existingWorkDay.qrAcceptedAt ?? existingWorkDay.startedAt).toISOString(),
    });
  }

  const existingIntent = await prisma.workdayStartIntent.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existingIntent && !existingIntent.consumedAt && existingIntent.expiresAt > now) {
    return Response.json({
      startIntentId: existingIntent.id,
      qrAcceptedAt: existingIntent.qrAcceptedAt.toISOString(),
      expiresAt: existingIntent.expiresAt.toISOString(),
      reused: true,
    });
  }

  const intent = await prisma.workdayStartIntent.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: {
      userId: user.id,
      date,
      department,
      qrAcceptedAt: now,
      expiresAt: workdayStartIntentExpiresAt(now),
    },
    update: {
      department,
      qrAcceptedAt: now,
      expiresAt: workdayStartIntentExpiresAt(now),
      consumedAt: null,
    },
  });

  return Response.json({
    startIntentId: intent.id,
    qrAcceptedAt: intent.qrAcceptedAt.toISOString(),
    expiresAt: intent.expiresAt.toISOString(),
    reused: false,
  });
}
