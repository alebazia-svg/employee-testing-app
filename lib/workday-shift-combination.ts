type Department = 'retail' | 'wholesale';

export type ShiftCombinationStatus = 'valid' | 'waiting' | 'mismatch' | 'unavailable';

export type ShiftCombinationEvaluation = {
  department: Department;
  status: ShiftCombinationStatus;
  scheduledCount: number;
  startedCount: number;
  expectedShiftCodes: string[];
  actualShiftCodes: string[];
  unexpectedStartCount: number;
};

const expectedByDepartmentAndCount: Record<Department, Record<number, string[]>> = {
  retail: {
    1: ['09_20'],
    2: ['09_18', '11_20'],
  },
  wholesale: {
    1: ['09_19'],
    2: ['09_18', '10_19'],
  },
};

export function evaluateDepartmentShiftCombination(input: {
  department: Department;
  scheduledWorkingUserIds: number[];
  startedWorkdays: Array<{ userId: number; shiftCode: string }>;
}): ShiftCombinationEvaluation {
  const scheduledIds = new Set(input.scheduledWorkingUserIds);
  const expectedShiftCodes = expectedByDepartmentAndCount[input.department][scheduledIds.size] ?? [];
  const scheduledStarts = input.startedWorkdays.filter((entry) => scheduledIds.has(entry.userId));
  const unexpectedStartCount = input.startedWorkdays.length - scheduledStarts.length;
  const actualShiftCodes = scheduledStarts.map((entry) => entry.shiftCode).sort();
  const expectedSorted = [...expectedShiftCodes].sort();

  let status: ShiftCombinationStatus = 'unavailable';
  if (expectedShiftCodes.length > 0) {
    if (unexpectedStartCount > 0 || scheduledStarts.length > scheduledIds.size) status = 'mismatch';
    else if (scheduledStarts.length < scheduledIds.size) status = 'waiting';
    else status = actualShiftCodes.join('|') === expectedSorted.join('|') ? 'valid' : 'mismatch';
  }

  return {
    department: input.department,
    status,
    scheduledCount: scheduledIds.size,
    startedCount: scheduledStarts.length,
    expectedShiftCodes,
    actualShiftCodes,
    unexpectedStartCount,
  };
}
