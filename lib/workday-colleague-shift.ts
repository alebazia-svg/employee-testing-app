type ColleagueShiftInput = {
  department: string;
  colleagueUserId: number;
  scheduledWorkingUserIds: number[];
  missingScheduleUserIds?: number[];
  startedWorkdays: Array<{ userId: number; shiftCode: string }>;
};

/** A calendar working day cannot establish another employee's chosen hours. */
function resolveColleagueShift(input: ColleagueShiftInput): { code: string | null; conflict: boolean } {
  if (input.department !== 'retail' && input.department !== 'wholesale') return { code: null, conflict: false };
  const actual = [...new Set(input.startedWorkdays.filter(day => day.userId === input.colleagueUserId).map(day => day.shiftCode))];
  return { code: actual.length === 1 ? actual[0] : null, conflict: actual.length > 1 };
}

export function expectedColleagueShiftCode(input: ColleagueShiftInput) {
  return resolveColleagueShift(input).code;
}

export function hasColleagueShiftConflict(input: ColleagueShiftInput) {
  return resolveColleagueShift(input).conflict;
}
