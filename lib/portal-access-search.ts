import type { Prisma } from '@prisma/client';

export type AccessHistoryFilters = { from: string; to: string; dateField: 'contact' | 'login'; error?: string };

function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function accessHistoryFilters(params: { from?: string; to?: string; dateField?: string }): AccessHistoryFilters {
  const from = params.from ?? '', to = params.to ?? '';
  const dateField = params.dateField === 'login' ? 'login' : 'contact';
  const invalid = Boolean(from && !validDay(from) || to && !validDay(to));
  return { from: invalid ? '' : from, to: invalid ? '' : to, dateField,
    ...(invalid ? { error: 'Укажите корректные даты периода.' } : from && to && from > to ? { error: 'Начало периода должно быть не позже окончания.' } : {}) };
}

/** Apply the search before pagination, including labels bound to exact browser IDs. */
export function accessHistoryWhere(query: string, namedBrowserIds: string[], filters: AccessHistoryFilters): Prisma.PortalAccessSessionWhereInput {
  const where: Prisma.PortalAccessSessionWhereInput = {};
  if (query) where.OR = [
    { user: { name: { contains: query, mode: 'insensitive' } } },
    { user: { login: { contains: query, mode: 'insensitive' } } },
    { device: { contains: query, mode: 'insensitive' } },
    { browser: { contains: query, mode: 'insensitive' } },
    { browserInstanceId: { contains: query, mode: 'insensitive' } },
    { observedBrowserId: { contains: query, mode: 'insensitive' } },
    ...(namedBrowserIds.length ? [{ browserInstanceId: { in: namedBrowserIds } }] : []),
  ];
  if (filters.from || filters.to) {
    const range = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00+03:00`) } : {}),
      ...(filters.to ? { lt: new Date(+new Date(`${filters.to}T00:00:00+03:00`) + 86400000) } : {}),
    };
    if (filters.dateField === 'login') where.loginAt = range;
    else where.lastSeenAt = range;
  }
  return where;
}
