// Only new automatic snapshots opt into this gate. Legacy saved runs retain
// their existing approval workflow and are never silently recalculated.
export function automaticPayrollDisplayedTotal(rows: Array<Record<string, unknown>>, field: string): number {
  return rows.reduce((sum, row) => sum + Math.round((Number(row[field]) + Number.EPSILON) * 100), 0) / 100;
}

export function automaticPayrollApprovalIssues(summary: unknown, reviewCount: number): string[] {
  if (!summary || typeof summary !== 'object' || !('kind' in summary) || summary.kind !== 'automatic-1c-v1') return [];
  const data = summary as Record<string, unknown>;
  const issues = Array.isArray(data.approvalIssues) ? data.approvalIssues.filter((item): item is string => typeof item === 'string' && !!item.trim()) : ['Не сохранены результаты проверки расчёта.'];
  if (reviewCount > 0) issues.push('В сохранённой ведомости остались вопросы по сотрудникам.');
  const period = String(data.periodKey ?? '');
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) return [...issues, 'Не указан месяц расчёта.'];
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const expected = `${period}-${String(lastDay).padStart(2, '0')}`;
  if (String(data.verifiedThrough ?? '').slice(0, 10) !== expected) issues.push('Данные 1С ещё не охватывают весь месяц.');
  return [...new Set(issues)];
}
