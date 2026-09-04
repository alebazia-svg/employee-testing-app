import { expectedByDepartmentAndCount } from '@/lib/workday-shift-combination';

type ColleagueShiftInput = {
  department: string;
  colleagueUserId: number;
  scheduledWorkingUserIds: number[];
  startedWorkdays: Array<{ userId: number; shiftCode: string }>;
};

function resolveColleagueShift(input: ColleagueShiftInput): { code: string | null; conflict: boolean } {
  if (input.department !== 'retail' && input.department !== 'wholesale') return { code: null, conflict: false };
  if (!input.scheduledWorkingUserIds.includes(input.colleagueUserId)) return { code: null, conflict: false };

  const scheduledIds = new Set(input.scheduledWorkingUserIds);
  const scheduledCount = scheduledIds.size;
  const pairedCodes = expectedByDepartmentAndCount[input.department][2] ?? [];
  const otherStarts = input.startedWorkdays.filter((entry) => entry.userId !== input.colleagueUserId);

  if (scheduledCount === 1) {
    if (otherStarts.length === 0) {
      return { code: expectedByDepartmentAndCount[input.department][1]?.[0] ?? null, conflict: false };
    }
    if (otherStarts.length === 1 && pairedCodes.includes(otherStarts[0].shiftCode)) {
      return { code: pairedCodes.find((code) => code !== otherStarts[0].shiftCode) ?? null, conflict: false };
    }
    return { code: null, conflict: true };
  }

  const expectedCodes = expectedByDepartmentAndCount[input.department][scheduledCount] ?? [];
  if (expectedCodes.length !== 2) return { code: null, conflict: otherStarts.length > 0 };

  if (otherStarts.some((entry) => !scheduledIds.has(entry.userId))) return { code: null, conflict: true };
  if (otherStarts.length === 0) return { code: null, conflict: false };
  if (otherStarts.length === 1 && expectedCodes.includes(otherStarts[0].shiftCode)) {
    return { code: expectedCodes.find((code) => code !== otherStarts[0].shiftCode) ?? null, conflict: false };
  }
  return { code: null, conflict: true };
}

export function expectedColleagueShiftCode(input: ColleagueShiftInput) {
  return resolveColleagueShift(input).code;
}

export function hasColleagueShiftConflict(input: ColleagueShiftInput) {
  return resolveColleagueShift(input).conflict;
}
