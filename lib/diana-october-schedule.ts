export const DIANA_SCHEDULE_PERIOD = '2026-10';
export const DIANA_PAYROLL_NAME = 'Кумахова Диана';
type Person = { id?: number; name: string; department: string; role?: string; isActive?: boolean };
export function isDianaSchedulePilot(user: Person, period: string) {
  return period === DIANA_SCHEDULE_PERIOD && user.name.trim() === DIANA_PAYROLL_NAME
    && user.department === 'retail' && (!user.role || user.role === 'EMPLOYEE') && user.isActive !== false;
}
export function canEditDianaPastSchedule(user: Person, date: string, today: string) {
  return today.startsWith(DIANA_SCHEDULE_PERIOD + '-') && /^2026-10-(0[1-9]|[12]\d|3[01])$/.test(date)
    && date < today && isDianaSchedulePilot(user, date.slice(0, 7));
}

