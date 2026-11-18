import type { Prisma } from '@prisma/client';
import { getMoscowDateKey, usesRetailCashHandover } from './workday';
import { needsWorkdayEndReminder, WORKDAY_END_REMINDER_KIND, workdayEndReminderActive, workdayEndReminderAt, workdayEndReminderId, workdayEndReminderKey, workdayEndReminderSlot, WORKDAY_END_REMINDER_OFFSETS } from './workday-end-policy';

type Db = Pick<Prisma.TransactionClient, 'workDayEntry' | 'workdayNotification'>;
const include = { user: { select: { department: true, name: true, login: true, isActive: true, workdayControlMode: true } }, cashHandover: {select:{handedAt:true}} } as const;
export async function queueWorkdayEndReminders(db: Db, now: Date) {
  const days = await db.workDayEntry.findMany({ where: { date: getMoscowDateKey(now), endedAt: null, status: { in: ['active', 'missing_checkout'] }, user: { isActive: true, role: 'EMPLOYEE' } }, include });
  for (const day of days) {
    const cash = usesRetailCashHandover(day.user);
    if (cash ? day.cashHandover?.handedAt || day.status !== 'active' : !needsWorkdayEndReminder(day.user)) continue;
    const title = 'Закончили работу?';
    const body = cash ? 'Пересчитайте наличные и сдайте кассу.' : 'Если вы закончили работу, отметьте окончание рабочего дня.';
    for (const slot of WORKDAY_END_REMINDER_OFFSETS.keys()) {
      const scheduledAt = workdayEndReminderAt(day, slot);
      if (!scheduledAt) continue;
      const fingerprint = workdayEndReminderKey(day.id, slot);
      await db.workdayNotification.upsert({
        where: { fingerprint },
        create: { userId: day.userId, fingerprint, kind: WORKDAY_END_REMINDER_KIND, title, body, scheduledAt },
        update: {},
      });
      await db.workdayNotification.updateMany({
        where: { fingerprint, status: 'pending', OR: [
          { scheduledAt: { not: scheduledAt } }, ...(cash ? [{ body: { not: body } }] : []),
        ] },
        data: cash ? { scheduledAt, title, body } : { scheduledAt },
      });
    }
  }
}
export async function activeWorkdayEndReminders(db: Db, rows: Array<{ id: number; userId?: number; kind: string; fingerprint: string }>, now: Date) {
  const reminders = rows.filter(row => row.kind === WORKDAY_END_REMINDER_KIND);
  const ids = reminders.map(row => workdayEndReminderId(row.fingerprint)).filter((id): id is number => id !== null);
  if (!ids.length) return new Set<number>();
  const days = await db.workDayEntry.findMany({ where: { id: { in: ids } }, include });
  const byId = new Map(days.map(day => [day.id, day]));
  return new Set(reminders.filter(row => {
    const day = byId.get(workdayEndReminderId(row.fingerprint) ?? -1);
    const slot=workdayEndReminderSlot(row.fingerprint);
    const at=day&&slot!==null?workdayEndReminderAt(day,slot):null;
    const next=day&&slot!==null?workdayEndReminderAt(day,slot+1):null;
    if (!day || !at || now < at || (next && now >= next) || (row.userId !== undefined && row.userId !== day.userId)) return false;
    return reminderNeeded(day, now);
  }).map(row => row.id));
}

export async function workdayEndReminderDelivery(db: Db, notification: { userId: number; fingerprint: string }, now: Date) {
  const id = workdayEndReminderId(notification.fingerprint);
  const day = id ? await db.workDayEntry.findUnique({ where: { id }, include }) : null;
  if (!day || day.userId !== notification.userId || !reminderNeeded(day, now)) return { state: 'cancel' as const };
  const slot=workdayEndReminderSlot(notification.fingerprint);
  const scheduledAt = slot===null?null:workdayEndReminderAt(day,slot);
  const next=slot===null?null:workdayEndReminderAt(day,slot+1);
  if(next&&now>=next)return { state: 'cancel' as const };
  if (!scheduledAt) return { state: 'cancel' as const };
  if (usesRetailCashHandover(day.user) && !next) {
    const expiresAt = new Date(+scheduledAt + 60_000);
    if (now >= expiresAt) return { state: 'cancel' as const };
    if (now >= scheduledAt) return { state: 'send' as const, expiresAt };
  }
  if (usesRetailCashHandover(day.user) && next && now >= scheduledAt) return { state: 'send' as const, expiresAt: next };
  return scheduledAt > now ? { state: 'defer' as const, until: scheduledAt } : { state: 'send' as const };
}


function reminderNeeded(day: Prisma.WorkDayEntryGetPayload<{include: typeof include}>, now: Date) {
  if (!usesRetailCashHandover(day.user)) return workdayEndReminderActive(day, now);
  return day.user.isActive && day.status === 'active' && !day.endedAt
    && !day.cashHandover?.handedAt && day.date === getMoscowDateKey(now);
}
