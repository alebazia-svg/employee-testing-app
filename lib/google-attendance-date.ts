type GoogleAttendanceTimestamp = { date: string; dateKey: string; time: string };

function civil(year: number, month: number, day: number, hour: number, minute: number, second: number): GoogleAttendanceTimestamp | null {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > days[month - 1]
    || hour > 23 || minute > 59 || second > 59) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = String(year).padStart(4, '0');
  return { date: `${pad(day)}.${pad(month)}.${y}`, dateKey: `${y}-${pad(month)}-${pad(day)}`, time: `${pad(hour)}:${pad(minute)}` };
}

/** Never let Date guess DD.MM as MM.DD. Preserve the existing ISO display convention. */
export function parseGoogleAttendanceTimestamp(value: string): GoogleAttendanceTimestamp | null {
  const source = value.trim();
  const ru = source.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (ru) return civil(+ru[3], +ru[2], +ru[1], +ru[4], +ru[5], +(ru[6] ?? 0));
  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!iso || !civil(+iso[1], +iso[2], +iso[3], +iso[4], +iso[5], +(iso[6] ?? 0))) return null;
  if (!iso[7]) return civil(+iso[1], +iso[2], +iso[3], +iso[4], +iso[5], +(iso[6] ?? 0));
  const stamp = new Date(source.replace(' ', 'T'));
  if (!Number.isFinite(+stamp)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(stamp).map(p => [p.type, p.value]));
  return civil(+parts.year, +parts.month, +parts.day, +parts.hour, +parts.minute, +parts.second);
}
