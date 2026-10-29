import { getMoscowDateKey, usesWorkdayShiftControl } from './workday';

type AttendanceUser = { department?: string | null; name?: string | null; login?: string | null };
export const ATTENDANCE_END_MINUTES = 18 * 60;
export const attendanceWorkdayDefinition = { code: 'other', label: 'Рабочий день', startMinutes: null, endMinutes: null } as const;
export const WORKDAY_END_REMINDER_KIND = 'workday_end_reminder';
export function needsWorkdayEndReminder(user: AttendanceUser) {
  return user.department === 'procurement'
    || (user.department === 'retail' && !usesWorkdayShiftControl(user));
}
export const WORKDAY_END_REMINDER_OFFSETS = [0, 30, 60] as const;
export function workdayEndReminderKey(id: number, slot = 0) { return `workday-end:${id}${slot ? ':'+slot : ''}`; }
export function workdayEndReminderSlot(fingerprint: string) {
  const match = /^workday-end:([1-9]\d*)(?::([12]))?$/.exec(fingerprint);
  return match ? Number(match[2] || 0) : null;
}
export function workdayEndReminderId(fingerprint: string) {
  const match = /^workday-end:([1-9]\d*)(?::[12])?$/.exec(fingerprint);
  return match ? Number(match[1]) : null;
}
export function workdayEndReminderAt(day: { date: string; shiftEndMinutes?: number | null }, slot = 0) {
  const offset = WORKDAY_END_REMINDER_OFFSETS[slot];
  if (offset === undefined) return null;
  const minutes = ATTENDANCE_END_MINUTES + offset;
  const date = new Date(`${day.date}T00:00:00+03:00`);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + minutes * 60_000);
}
export function workdayEndReminderActive(day: {
  date: string; status: string; endedAt: Date | null; user: AttendanceUser & { isActive: boolean };
} | null, now: Date) {
  return Boolean(day && day.user.isActive && needsWorkdayEndReminder(day.user)
    && day.date === getMoscowDateKey(now) && !day.endedAt && ['active', 'missing_checkout'].includes(day.status));
}

/** A datetime-local value is always interpreted as Moscow time, independently of the phone timezone. */
export function validateReportedWorkdayEnd(value: unknown, startedAt: Date | string, now: Date) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return { ok: false as const, error: 'Укажите фактическую дату и время окончания (МСК)' };
  }
  const endedAt = new Date(`${value}:00+03:00`);
  // Date parsing can normalize impossible dates such as February 30.
  if (!Number.isFinite(endedAt.getTime()) || toMoscowDateTimeInput(endedAt) !== value) {
    return { ok: false as const, error: 'Проверьте дату и время окончания' };
  }
  if (endedAt.getTime() <= new Date(startedAt).getTime()) {
    return { ok: false as const, error: 'Окончание должно быть позже начала рабочего дня' };
  }
  if (endedAt > now) return { ok: false as const, error: 'Окончание не может быть в будущем' };
  return { ok: true as const, endedAt };
}
export function toMoscowDateTimeInput(date: Date | string) {
  return new Date(new Date(date).getTime() + 3 * 60 * 60_000).toISOString().slice(0, 16);
}
