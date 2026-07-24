export const shiftControlOneCAuditKey = 'oneCAudit';

export function stripShiftControlOneCAudit(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = { ...(value as Record<string, unknown>) };
  delete result[shiftControlOneCAuditKey];
  return result;
}
