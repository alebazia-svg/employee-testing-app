import 'server-only';
import { prisma } from './prisma';
import { ACTIVITY_DAILY_LIMIT, ACTIVITY_RETENTION_DAYS, type ActivityInput } from './employee-activity-policy';

let nextCleanup = 0;
/** Independent, best effort telemetry; no business mutation depends on its success. */
export async function writeEmployeeActivity(userId: number, sessionHash: string, input: ActivityInput, now = new Date()) {
  try {
    const saved = await prisma.$transaction(async tx => {
      const session = await tx.portalAccessSession.findUnique({ where: { sessionHash } });
      if (!session || session.userId !== userId || session.isService || session.loggedOutAt || session.expiresAt <= now) return false;
      const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock(73106270, ${userId}::integer) AS acquired`;
      if (!lock[0]?.acquired) return false;
      const since = new Date(+now - 86400000);
      if (await tx.portalActivityEvent.count({ where: { userId, createdAt: { gte: since } } }) >= ACTIVITY_DAILY_LIMIT) return false;
      if (input.kind === 'notification_open' && !await tx.workdayNotification.findFirst({ where: { id: input.notificationId, userId, sentAt: { not: null } }, select: { id: true } })) return false;
      const section = input.kind === 'visit' ? input.section : 'notifications';
      // Suppress reloads, StrictMode and duplicate tabs; retain intentional later returns.
      if (input.kind === 'visit') {
        const previous = await tx.portalActivityEvent.findFirst({ where: { userId, kind: 'visit' }, orderBy: { createdAt: 'desc' } });
        if (previous?.section === section && +now - +previous.createdAt < 30000) return true;
      }
      await tx.portalActivityEvent.createMany({ skipDuplicates: true, data: [{ userId, sessionId: session.id, section, kind: input.kind,
        eventKey: input.kind === 'notification_open' ? `notification:${input.notificationId}` : input.key,
        notificationId: input.kind === 'notification_open' ? input.notificationId : null, createdAt: now }] });
      return true;
    }, { maxWait: 500, timeout: 2000 });
    // Bounded retention maintenance, at most hourly per process. Never scans business tables.
    if (+now >= nextCleanup) {
      nextCleanup = +now + 3600000;
      const cutoff = new Date(+now - ACTIVITY_RETENTION_DAYS * 86400000);
      await prisma.$executeRaw`DELETE FROM "PortalActivityEvent" WHERE id IN (SELECT id FROM "PortalActivityEvent" WHERE "createdAt" < ${cutoff} ORDER BY "createdAt" LIMIT 1000)`;
    }
    return saved;
  } catch { return false; }
}
