const reasons = new Set(['power', 'internet', 'one_c', 'kkm', 'other']);
export function closeReasonRequiresComment(reason: string) { return reason === 'other'; }
export function validateWorkdayCloseRequest(reason: unknown, value: unknown) {
  const reasonCode = typeof reason === 'string' ? reason : '';
  const comment = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!reasons.has(reasonCode)) return { ok: false as const, error: 'Выберите техническую причину' };
  if (closeReasonRequiresComment(reasonCode) && !comment) return { ok: false as const, error: 'Коротко опишите причину' };
  if (comment.length > 1000) return { ok: false as const, error: 'Комментарий должен быть не длиннее 1000 символов' };
  return { ok: true as const, reasonCode, comment };
}
