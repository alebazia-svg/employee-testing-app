export const WORKDAY_TIME_ZONE = 'Europe/Moscow';

export const scheduleStatuses = ['working', 'off'] as const;
export type ScheduleStatus = (typeof scheduleStatuses)[number];

export const workDayStatuses = ['not_started', 'active', 'completed', 'missing_checkout'] as const;
export type WorkDayStatus = (typeof workDayStatuses)[number];

export const shiftOptions = [
  { code: '09_18', label: '09:00-18:00', startMinutes: 9 * 60, endMinutes: 18 * 60 },
  { code: '09_19', label: '09:00-19:00', startMinutes: 9 * 60, endMinutes: 19 * 60 },
  { code: '09_20', label: '09:00-20:00', startMinutes: 9 * 60, endMinutes: 20 * 60 },
  { code: '10_18', label: '10:00-18:00', startMinutes: 10 * 60, endMinutes: 18 * 60 },
  { code: '10_19', label: '10:00-19:00', startMinutes: 10 * 60, endMinutes: 19 * 60 },
  { code: '11_20', label: '11:00-20:00', startMinutes: 11 * 60, endMinutes: 20 * 60 },
  { code: 'other', label: 'Другая смена', startMinutes: null, endMinutes: null },
] as const;

export type ShiftCode = (typeof shiftOptions)[number]['code'];

export const supportedShiftCodesByDepartment: Record<string, ShiftCode[]> = {
  retail: ['09_18', '11_20', '09_20'],
  wholesale: ['09_18', '09_19', '10_19'],
};

type WorkdayControlUser = {
  department?: string | null;
  name?: string | null;
  login?: string | null;
};

function normalizeWorkdayControlText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9]+/g, ' ')
    .trim();
}

// Pilot exception: senior retail manager currently needs only start/end marks.
// Later this should become an admin-configured workday control mode in the DB.
function isCashControlExcludedUser(user: WorkdayControlUser) {
  const name = normalizeWorkdayControlText(user.name);
  const login = normalizeWorkdayControlText(user.login);
  return name === 'кумахова диана' || login === 'кумахова' || login === 'kumakhova';
}

export function usesWorkdayShiftControl(user: WorkdayControlUser) {
  if (user.department !== 'retail' && user.department !== 'wholesale') return false;
  return !isCashControlExcludedUser(user);
}

export function getShiftOptionsForDepartment(department: string | null | undefined) {
  const supportedCodes = department ? supportedShiftCodesByDepartment[department] : null;
  if (!supportedCodes) return shiftOptions;
  return shiftOptions.filter((shift) => supportedCodes.includes(shift.code));
}

export function isShiftSupportedForDepartment(department: string | null | undefined, code: string) {
  const supportedCodes = department ? supportedShiftCodesByDepartment[department] : null;
  if (!supportedCodes) return true;
  return supportedCodes.includes(code as ShiftCode);
}

export function getMoscowDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WORKDAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getMoscowMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WORKDAY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function formatTime(value: Date | string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: WORKDAY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function buildDateRange(startDateKey: string, days: number) {
  const [year, month, day] = startDateKey.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    return current.toISOString().slice(0, 10);
  });
}

export function getShiftOption(code: string) {
  return shiftOptions.find((shift) => shift.code === code) ?? shiftOptions[shiftOptions.length - 1];
}

export function getLateMinutes(shiftStartMinutes: number | null, actualMinutes: number) {
  if (shiftStartMinutes === null) return 0;
  return Math.max(0, actualMinutes - shiftStartMinutes);
}

export function departmentLabel(department: string | null | undefined) {
  if (department === 'wholesale') return 'Опт';
  if (department === 'operations') return 'Операции';
  return 'Розница';
}

export function scheduleStatusLabel(status: string | null | undefined) {
  if (status === 'working') return 'работаю';
  if (status === 'off') return 'выходной';
  return 'не заполнено';
}

export function workDayStatusLabel(status: string | null | undefined) {
  if (status === 'active') return 'идёт рабочий день';
  if (status === 'completed') return 'завершён';
  if (status === 'missing_checkout') return 'не завершил рабочий день';
  return 'не начат';
}
