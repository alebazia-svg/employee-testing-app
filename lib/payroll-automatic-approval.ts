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

// Explicit allow-list: unknown issues, source completeness and calculation errors
// remain blocking. Acceptance never changes attendance or payroll amounts.
export function payrollApprovalReview(summary: unknown, reviewCount: number, accepted: unknown = [], comment: unknown = '') {
  const issues = automaticPayrollApprovalIssues(summary, reviewCount);
  const notice = 'В сохранённой ведомости остались вопросы по сотрудникам.';
  const reviewable = issues.filter(issue => /^.+: (Не указаны опоздания|Посещаемость по форме не подтверждена)$/.test(issue));
  const selected = Array.isArray(accepted) ? accepted.filter((item): item is string => typeof item === 'string') : [];
  const note = typeof comment === 'string' ? comment.trim() : '';
  const valid = note.length >= 5 && note.length <= 1000 && selected.length > 0
    && selected.length === new Set(selected).size && selected.every(item => reviewable.includes(item));
  const acceptedIssues = valid ? selected : [];
  const pending = issues.filter(issue => !acceptedIssues.includes(issue)
    && !(issue === notice && reviewable.length >= reviewCount && reviewable.length > 0 && reviewable.every(item => acceptedIssues.includes(item))));
  return { pending, reviewable, acceptedIssues, comment: note };
}

export function payrollApprovalAcceptanceText(summary: unknown): string | null {
  if (!summary || typeof summary !== 'object') return null;
  const value = (summary as Record<string, unknown>).approvalAcceptance;
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.comment !== 'string' || !Array.isArray(entry.issues)) return null;
  const date = typeof entry.at === 'string' ? new Date(entry.at) : null;
  const when = date && Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' МСК' : '';
  return `Утверждено с замечаниями: ${entry.issues.filter(item => typeof item === 'string').join('; ')}. Решение: ${entry.comment.replace(/[.\s]+$/, '')}. Администратор №${entry.userId}${when ? `, ${when}` : ''}`;
}
