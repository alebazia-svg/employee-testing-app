import 'server-only';
import { Prisma, type PrismaClient } from '@prisma/client';
import { calendarCorrectionSourceId, CALENDAR_CORRECTION_SOURCE, parseCalendarWorkingCorrection } from './team-calendar-fact';
import { getMoscowDateKey } from './workday';
import { APP_ATTENDANCE_FROM } from './team-attendance';
import { isValidScheduleDateKey } from './workday-schedule';

export async function markCalendarWorking(db: PrismaClient, input: {
  employeeId: number; date: string; reason: string; status: 'working' | 'reset';
  requestId: string; expectedCorrectionId: string | null;
  actor: { id: number; name: string; role: string }; now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.actor.role !== 'ADMIN') throw new Error('CALENDAR_FORBIDDEN');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason || reason.length > 500 || typeof input.date !== 'string' || !isValidScheduleDateKey(input.date)
    || input.date < APP_ATTENDANCE_FROM || input.date > getMoscowDateKey(now)
    || !['working', 'reset'].includes(input.status)
    || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId)
    || !(input.expectedCorrectionId === null || typeof input.expectedCorrectionId === 'string')) throw new Error('CALENDAR_INVALID_CORRECTION');
  // Extend the existing immutable ADMIN repair-event audit. No receipts or
  // deliveries: calendar corrections never send inbox/push notifications.
  const sourceId = calendarCorrectionSourceId(input.employeeId, input.date);
  const eventKey = `calendar-fact-correction:${input.requestId}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const employee = await tx.user.findFirst({ where: { id: input.employeeId, role: 'EMPLOYEE', isActive: true,
          department: { in: ['retail', 'wholesale', 'procurement'] } }, select: { id: true } });
        if (!employee) throw new Error('CALENDAR_EMPLOYEE_NOT_FOUND');
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${employee.id} FOR UPDATE`;
        const existing = await tx.adminInboxEvent.findUnique({ where: { eventKey } });
        if (existing) {
          if (existing.sourceType !== CALENDAR_CORRECTION_SOURCE || existing.sourceId !== sourceId) throw new Error('CALENDAR_INVALID_CORRECTION');
          return existing;
        }
        const latest = await tx.adminInboxEvent.findFirst({ where: { sourceType: CALENDAR_CORRECTION_SOURCE, sourceId }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] });
        if ((latest?.id ?? null) !== input.expectedCorrectionId) throw new Error('CALENDAR_STALE_CORRECTION');
        if (input.status === 'reset' && (!latest || parseCalendarWorkingCorrection(latest.body)?.status !== 'working')) throw new Error('CALENDAR_INVALID_CORRECTION');
        return tx.adminInboxEvent.create({ data: {
          eventKey, type: 'workday.calendar_corrected', title: input.status === 'working' ? 'Учтён рабочий день без QR' : 'Отменено ручное исправление дня',
          body: JSON.stringify({ version: 1, userId: employee.id, date: input.date, status: input.status,
            actorId: input.actor.id, actorName: input.actor.name, reason, correctedAt: now.toISOString() }),
          href: `/admin/attendance?date=${input.date}`, sourceType: CALENDAR_CORRECTION_SOURCE,
          sourceId, occurredAt: now,
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code) && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('CALENDAR_STALE_CORRECTION');
}
