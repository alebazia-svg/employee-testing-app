import type { Prisma } from '@prisma/client';
import { getMoscowDateKey } from './workday';
import { needsWorkdayEndReminder, WORKDAY_END_REMINDER_KIND, workdayEndReminderActive, workdayEndReminderAt, workdayEndReminderId, workdayEndReminderKey, workdayEndReminderSlot, WORKDAY_END_REMINDER_OFFSETS } from './workday-end-policy';

type Db = Pick<Prisma.TransactionClient, 'workDayEntry' | 'workdayNotification'>;
const include = { user: { select: { department: true, name: true, login: true, isActive: true } } } as const;
export async function queueWorkdayEndReminders(db: Db, now: Date) {
  const days = await db.workDayEntry.findMany({ where: { date: getMoscowDateKey(now), endedAt: null, status: { in: ['active', 'missing_checkout'] }, user: { isActive: true, role: 'EMPLOYEE' } }, include });
  for (const day of days) {
    for (const slot of WORKDAY_END_REMINDER_OFFSETS.keys()) {
    const scheduledAt = workdayEndReminderAt(day,slot);
    if (!needsWorkdayEndReminder(day.user) || !scheduledAt) continue;
    await db.workdayNotification.upsert({
      where: { fingerprint: workdayEndReminderKey(day.id,slot) },
      create: { userId: day.userId, fingerprint: workdayEndReminderKey(day.id,slot), kind: WORKDAY_END_REMINDER_KIND,
        title: 'Закончили работу?', body: 'Если вы закончили работу, отметьте окончание рабочего дня.', scheduledAt },
      // Three bounded reminders; never replay a delivered slot.
      update: {},
    });
    await db.workdayNotification.updateMany({ where: { fingerprint: workdayEndReminderKey(day.id,slot), status: 'pending' }, data: { scheduledAt } });
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
    return at && (!next||now<next) && day && (row.userId === undefined || day.userId === row.userId) && workdayEndReminderActive(day, now);
  }).map(row => row.id));
}

export async function workdayEndReminderDelivery(db: Db, notification: { userId: number; fingerprint: string }, now: Date) {
  const id = workdayEndReminderId(notification.fingerprint);
  const day = id ? await db.workDayEntry.findUnique({ where: { id }, include }) : null;
  if (!day || day.userId !== notification.userId || !workdayEndReminderActive(day, now)) return { state: 'cancel' as const };
  const slot=workdayEndReminderSlot(notification.fingerprint);
  const scheduledAt = slot===null?null:workdayEndReminderAt(day,slot);
  const next=slot===null?null:workdayEndReminderAt(day,slot+1);
  if(next&&now>=next)return { state: 'cancel' as const };
  if (!scheduledAt) return { state: 'cancel' as const };
  return scheduledAt > now ? { state: 'defer' as const, until: scheduledAt } : { state: 'send' as const };
}
