import type { PrismaClient } from '@prisma/client';
import { calendarCorrectionSourceId, calendarQrAccepted, CALENDAR_CORRECTION_SOURCE, parseCalendarWorkingCorrection, type CalendarWorkingCorrection } from './team-calendar-fact';

type QrRow = { userId: number; date: string; qrAcceptedAt: Date | null };
export type CalendarEvidence = { qrAccepted: boolean; history: Array<CalendarWorkingCorrection & { id: string }> };
// Only a successfully created workday confirms a QR start; an unconsumed or
// expired scan intent never changes day accounting.
// Shared read-only evidence for ADMIN calendar and day control. Failed reads
// propagate: an unavailable QR source must never manufacture days off.
export async function loadTeamCalendarEvidence(db: Pick<PrismaClient, 'workDayEntry' | 'adminInboxEvent'>, input: {
  userIds: number[]; dates: string[]; now: Date; workdays?: QrRow[];
}) {
  const { userIds, dates, now } = input;
  const result = new Map<string, CalendarEvidence>();
  if (!userIds.length || !dates.length) return result;
  const sorted = [...dates].sort(), where = { userId: { in: userIds }, date: { gte: sorted[0], lte: sorted[sorted.length - 1] } };
  const [workdays, events] = await Promise.all([
    input.workdays ?? db.workDayEntry.findMany({ where, select: { userId: true, date: true, qrAcceptedAt: true } }),
    db.adminInboxEvent.findMany({ where: { sourceType: CALENDAR_CORRECTION_SOURCE, sourceId: { in: userIds.flatMap(id => dates.map(date => calendarCorrectionSourceId(id, date))) } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { id: true, sourceId: true, body: true } }),
  ]);
  for (const id of userIds) for (const date of dates) {
    const key = calendarCorrectionSourceId(id, date);
    const history = events.filter(e => e.sourceId === key).flatMap(e => {
      const correction = parseCalendarWorkingCorrection(e.body);
      return correction?.userId === id && correction.date === date ? [{ id: e.id, ...correction }] : [];
    });
    result.set(key, { qrAccepted: calendarQrAccepted(date, workdays.filter(r => r.userId === id && r.date === date).map(r => r.qrAcceptedAt), now), history });
  }
  return result;
}
