import { expectedByDepartmentAndCount } from '@/lib/workday-shift-combination';

export function expectedColleagueShiftCode(input: {
  department: string;
  colleagueUserId: number;
  scheduledWorkingUserIds: number[];
  startedWorkdays: Array<{ userId: number; shiftCode: string }>;
}) {
  if (input.department !== 'retail' && input.department !== 'wholesale') return null;
  if (!input.scheduledWorkingUserIds.includes(input.colleagueUserId)) return null;

  const expectedCodes = expectedByDepartmentAndCount[input.department][input.scheduledWorkingUserIds.length] ?? [];
  if (expectedCodes.length === 1) return expectedCodes[0];

  const scheduledIds = new Set(input.scheduledWorkingUserIds);
  const startedScheduled = input.startedWorkdays.filter((entry) => (
    scheduledIds.has(entry.userId) && expectedCodes.includes(entry.shiftCode)
  ));
  if (expectedCodes.length === 2 && startedScheduled.length === 1 && startedScheduled[0].userId !== input.colleagueUserId) {
    return expectedCodes.find((code) => code !== startedScheduled[0].shiftCode) ?? null;
  }
  return null;
}
