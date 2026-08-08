export const shiftControlOneCAuditKey = 'oneCAudit';
export const shiftControlEmployeeRevisionHistoryKey = '_employeeRevisionHistory';

export function stripShiftControlOneCAudit(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = { ...(value as Record<string, unknown>) };
  delete result[shiftControlOneCAuditKey];
  delete result[shiftControlEmployeeRevisionHistoryKey];
  return result;
}
