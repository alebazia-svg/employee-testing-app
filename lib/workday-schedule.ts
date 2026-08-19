import { buildDateRange } from '@/lib/workday';

const monthKeyPattern = /^(\d{4})-(\d{2})$/;
const dateKeyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function isValidScheduleMonthKey(value: string) {
  const match = monthKeyPattern.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function isValidScheduleDateKey(value: string) {
  const match = dateKeyPattern.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function scheduleMonthKeyFromDate(value: string) {
  if (!isValidScheduleDateKey(value)) return null;
  return value.slice(0, 7);
}

export function buildScheduleMonthRange(monthKey: string) {
  if (!isValidScheduleMonthKey(monthKey)) return null;

  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  const start = new Date(first);
  const end = new Date(last);

  start.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  end.setUTCDate(last.getUTCDate() + (6 - ((last.getUTCDay() + 6) % 7)));

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return {
    monthKey,
    from: utcDateKey(start),
    to: utcDateKey(end),
    dates: buildDateRange(utcDateKey(start), days),
  };
}
