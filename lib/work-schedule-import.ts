import type { ScheduleRow } from '@/lib/google-sheets';

export type ScheduleImportUser = {
  id: number;
  name: string;
  department: string;
};

export type ScheduleImportEntry = {
  userId: number;
  userName: string;
  department: string;
  date: string;
  status: 'working' | 'off';
};

function normalizeName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[ёЁ]/g, 'е')
    .toLocaleLowerCase('ru-RU')
    .replace(/[^а-яa-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseScheduleSourceDate(value: string) {
  const normalized = value.trim();
  const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(normalized);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  const parts = ru
    ? { year: Number(ru[3]), month: Number(ru[2]), day: Number(ru[1]) }
    : iso
      ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
      : null;
  if (!parts) return null;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) return null;
  return date.toISOString().slice(0, 10);
}

function matchingUsers(sourceName: string, users: ScheduleImportUser[]) {
  const normalizedSource = normalizeName(sourceName);
  if (!normalizedSource) return [];
  return users.filter((user) => {
    const normalizedUser = normalizeName(user.name);
    return normalizedUser === normalizedSource || normalizedUser.split(' ').includes(normalizedSource);
  });
}

export function buildScheduleImportEntries(rows: ScheduleRow[], users: ScheduleImportUser[]) {
  const entries = new Map<string, ScheduleImportEntry>();
  const mappings = new Map<string, ScheduleImportUser>();
  const unmappedNames = new Set<string>();
  const ambiguousNames = new Set<string>();
  const invalidDates = new Set<string>();
  const conflicts = new Set<string>();
  let skippedUnknownStatus = 0;

  for (const row of rows) {
    if (row.plannedWork === null) {
      skippedUnknownStatus += 1;
      continue;
    }
    const date = parseScheduleSourceDate(row.date);
    if (!date) {
      invalidDates.add(row.date);
      continue;
    }
    const matches = matchingUsers(row.employee, users);
    if (matches.length === 0) {
      unmappedNames.add(row.employee);
      continue;
    }
    if (matches.length > 1) {
      ambiguousNames.add(row.employee);
      continue;
    }

    const user = matches[0];
    mappings.set(row.employee, user);
    const entry: ScheduleImportEntry = {
      userId: user.id,
      userName: user.name,
      department: user.department,
      date,
      status: row.plannedWork ? 'working' : 'off',
    };
    const key = `${user.id}:${date}`;
    const previous = entries.get(key);
    if (previous && previous.status !== entry.status) {
      conflicts.add(`${row.employee}:${date}`);
      continue;
    }
    entries.set(key, entry);
  }

  return {
    entries: [...entries.values()].sort((left, right) => left.date.localeCompare(right.date) || left.userId - right.userId),
    mappings: [...mappings.entries()].map(([sourceName, user]) => ({ sourceName, userId: user.id, userName: user.name })),
    unmappedNames: [...unmappedNames],
    ambiguousNames: [...ambiguousNames],
    invalidDates: [...invalidDates],
    conflicts: [...conflicts],
    skippedUnknownStatus,
  };
}
