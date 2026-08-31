import type { EmployeeVacation } from '@prisma/client';
import { isValidScheduleDateKey } from '@/lib/workday-schedule';

export type EmployeeVacationSummary = {
  id: string;
  userId: number;
  department: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string; department: string };
};

export function serializeEmployeeVacation(
  vacation: EmployeeVacation & { user?: { id: number; name: string; department: string } },
): EmployeeVacationSummary {
  return {
    id: vacation.id,
    userId: vacation.userId,
    department: vacation.department,
    dateFrom: vacation.dateFrom,
    dateTo: vacation.dateTo,
    status: vacation.status,
    createdAt: vacation.createdAt.toISOString(),
    updatedAt: vacation.updatedAt.toISOString(),
    ...(vacation.user ? { user: vacation.user } : {}),
  };
}

export function vacationIncludesDate(
  vacation: Pick<EmployeeVacationSummary, 'dateFrom' | 'dateTo' | 'status'>,
  date: string,
) {
  return vacation.status === 'active' && vacation.dateFrom <= date && vacation.dateTo >= date;
}

export function validateVacationRange(dateFrom: unknown, dateTo: unknown, today: string) {
  if (typeof dateFrom !== 'string' || typeof dateTo !== 'string') return 'Укажите начало и окончание отпуска.';
  if (!isValidScheduleDateKey(dateFrom) || !isValidScheduleDateKey(dateTo)) return 'Проверьте даты отпуска.';
  if (dateFrom < today) return 'Прошедший отпуск нельзя изменить самостоятельно.';
  if (dateTo < dateFrom) return 'Дата окончания не может быть раньше начала.';
  const durationDays = Math.round((Date.parse(`${dateTo}T00:00:00Z`) - Date.parse(`${dateFrom}T00:00:00Z`)) / 86_400_000) + 1;
  if (durationDays > 120) return 'Период отпуска не может превышать 120 дней.';
  return null;
}

export function employeeVacationHasStarted(dateFrom: string, today: string) {
  return dateFrom <= today;
}

export function activeVacationOverlapWhere(userId: number, dateFrom: string, dateTo: string, excludeId?: string) {
  return {
    userId,
    status: 'active',
    dateFrom: { lte: dateTo },
    dateTo: { gte: dateFrom },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };
}
