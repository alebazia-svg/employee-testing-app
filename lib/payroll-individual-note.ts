// Owner decision 2026-11-11: ADMIN attendance remark only; never change amounts.
export function payrollIndividualNote(employeeName: string, periodKey: string, note?: string): string | null {
  return employeeName === 'Кумахова Диана' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(periodKey) && periodKey >= '2026-11' ? note ?? null : null;
}
export function withPayrollIndividualNote<T extends { manager: string; payrollReasons: string[]; payrollStatus: 'OK' | 'Проверить'; comment: string }>(row: T, periodKey: string, privateNote?: string): T {
  const note = payrollIndividualNote(row.manager, periodKey, privateNote);
  if (!note) return row;
  const payrollReasons = row.payrollReasons.filter(reason => reason !== 'Не заполнены отработанные дни' && reason !== 'Не указаны опоздания');
  return { ...row, payrollReasons, payrollStatus: payrollReasons.length ? 'Проверить' : 'OK',
    comment: row.comment.includes(note) ? row.comment : [row.comment, note].filter(Boolean).join('\n') };
}
