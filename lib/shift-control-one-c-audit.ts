export const shiftControlOneCAuditKey = 'oneCAudit';
export const shiftControlEmployeeRevisionHistoryKey = '_employeeRevisionHistory';

export function stripShiftControlOneCAudit(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = { ...(value as Record<string, unknown>) };
  delete result[shiftControlOneCAuditKey];
  delete result[shiftControlEmployeeRevisionHistoryKey];
  delete result.cashComparison;
  delete result.cashRecountInputHistory;
  delete result.cashRecountAttempt;
  if (result.cashRecountStage !== 'comment_required') delete result.cashRecountStage;
  if (result.personalCash && typeof result.personalCash === 'object' && !Array.isArray(result.personalCash)) {
    const personalCash = { ...(result.personalCash as Record<string, unknown>) };
    const requiresComment = result.draft === true && personalCash.requiresComment === true;
    delete personalCash.discrepancyType;
    delete personalCash.discrepancyAmount;
    delete personalCash.requiresComment;
    if (requiresComment) personalCash.requiresComment = true;
    result.personalCash = personalCash;
  }
  return result;
}
