const MOSCOW_TIME_ZONE = 'Europe/Moscow';
const MOSCOW_OFFSET = '+03:00';

function validDateParts(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return false;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return false;
  return Number.isInteger(second) && second >= 0 && second <= 59;
}

function moscowDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  if (!validDateParts(year, month, day, hour, minute, second)) return null;
  return new Date(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}${MOSCOW_OFFSET}`);
}

export function parseOneCDateTime(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const source = typeof value === 'string' ? value.trim() : '';
  if (!source) return null;

  const russian = source.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (russian) {
    return moscowDate(
      Number(russian[3]),
      Number(russian[2]),
      Number(russian[1]),
      Number(russian[4] ?? 0),
      Number(russian[5] ?? 0),
      Number(russian[6] ?? 0),
    );
  }

  const compact = source.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compact) {
    return moscowDate(
      Number(compact[1]),
      Number(compact[2]),
      Number(compact[3]),
      Number(compact[4]),
      Number(compact[5]),
      Number(compact[6]),
    );
  }

  const isoWithoutZone = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?)?$/);
  if (isoWithoutZone) {
    return moscowDate(
      Number(isoWithoutZone[1]),
      Number(isoWithoutZone[2]),
      Number(isoWithoutZone[3]),
      Number(isoWithoutZone[4] ?? 0),
      Number(isoWithoutZone[5] ?? 0),
      Number(isoWithoutZone[6] ?? 0),
    );
  }

  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeOneCDateTime(value: unknown) {
  return parseOneCDateTime(value)?.toISOString() ?? '';
}

export function oneCDateTimestamp(value: unknown) {
  return parseOneCDateTime(value)?.getTime() ?? null;
}

export function moscowDateKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}
