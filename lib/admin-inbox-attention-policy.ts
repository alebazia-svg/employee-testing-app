/** Business attention is independent from notification read state. */
export const ATTENTION_LIFECYCLE_SOURCES = ['expense_request', 'supplier_payment_plan', 'procurement_delivery', 'procurement_delivery_request', 'workday_close_exception', 'cash_operation', 'workday_control_issue', 'terminal_fiscal_review'] as const;
export const ATTENTION_PUSH_TYPES = ['expense_request.created', 'procurement.delivery_requested', 'procurement.delivery_manual_requested', 'procurement.payment_submitted', 'workday.close_exception_requested', 'workday.cash_encashment_exception_requested', 'workday.cash_operation_failed', 'workday.kkm_shift_close_attention', 'workday_issue.employee_action', 'workday_issue.employee_message', 'terminal_fiscal_review.employee_action', 'terminal_fiscal_review.employee_message'] as const;
export type AttentionItem = {
  id: string; readAt: string | null;
  event: { type: string; sourceType: string; sourceId: string; occurredAt: string };
  meta: { category: string }; sourceState: { active: boolean };
};
export function attentionKey(item: AttentionItem) {
  const source = item.event.sourceType === 'procurement_delivery_request' ? 'procurement_delivery' : item.event.sourceType;
  return `${source}:${item.event.sourceId}`;
}
export function needsAdminAttention(item: AttentionItem) {
  if (item.meta.category === 'system') return false;
  // A routine automatic fiscal check belongs in section control, not owner messages.
  if (item.event.type === 'terminal_fiscal_review.created') return false;
  if ((ATTENTION_LIFECYCLE_SOURCES as readonly string[]).includes(item.event.sourceType)) return item.sourceState.active;
  return item.readAt === null;
}
export function attentionPriority(item: AttentionItem) {
  if (['expense_request', 'procurement_delivery', 'procurement_delivery_request', 'cash_operation'].includes(item.event.sourceType)) return 0;
  if (item.event.sourceType === 'supplier_payment_plan') return 2;
  return 1;
}
export function selectAdminAttention<T extends AttentionItem>(items: T[]): T[] {
  const bySource = new Map<string, T>();
  for (const item of [...items].sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt) || b.id.localeCompare(a.id))) {
    if (needsAdminAttention(item) && !bySource.has(attentionKey(item))) bySource.set(attentionKey(item), item);
  }
  return [...bySource.values()].sort((a, b) => attentionPriority(a) - attentionPriority(b) || b.event.occurredAt.localeCompare(a.event.occurredAt) || b.id.localeCompare(a.id));
}
/** Moscow calendar dates; plannedDate is a PostgreSQL date, not an instant. */
export function attentionDay(now: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function paymentReminderTiming(value: Date | string | undefined, now: Date) {
  const raw = value instanceof Date ? (Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : '') : String(value ?? '').slice(0, 10);
  const stamp = Date.parse(`${raw}T00:00:00Z`);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === raw;
  // A missing date needs review instead of silently hiding a payment request.
  if (!valid) return { active: true, day: '', label: 'Проверьте срок оплаты', deadline: 'Срок оплаты не указан' };
  const today = attentionDay(now);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { active: raw <= tomorrow, day: raw,
    label: raw < today ? 'Срок оплаты прошёл' : raw === today ? 'Оплата сегодня' : raw === tomorrow ? 'Оплата завтра' : 'Плановая оплата',
    deadline: `Подготовить к ${raw.split('-').reverse().join('.')}` };
}
export type DigestState = { ids: string[]; repeat: boolean };
export function readDigestState(raw: string | null): DigestState {
  try { const v = JSON.parse(raw ?? ''); return Array.isArray(v.ids) && v.ids.every((id: unknown) => typeof id === 'string') ? { ids: v.ids, repeat: v.repeat === true } : { ids: [], repeat: false }; } catch { return { ids: [], repeat: false }; }
}
export function digestDue(input: { items: AttentionItem[]; previous: DigestState; sentAt: Date | null; now: Date }) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Moscow' }).format(input.now));
  if (!input.items.length || hour < 9 || hour >= 22) return null;
  const ids = input.items.map(item => item.id).sort();
  const hasNew = ids.some(id => !input.previous.ids.includes(id));
  const age = input.sentAt ? input.now.getTime() - input.sentAt.getTime() : Infinity;
  const onlyPlanned = input.items.every(item => item.event.sourceType === 'supplier_payment_plan');
  if (onlyPlanned && !hasNew && input.sentAt && attentionDay(input.sentAt) === attentionDay(input.now)) return null;
  const wait = hasNew ? 5 * 60_000 : input.previous.repeat ? 60 * 60_000 : 15 * 60_000;
  if (age < wait) return null;
  return { ids, repeat: !hasNew };
}
export function attentionCounts(items: AttentionItem[]) {
  let expenses = 0, accountable = 0, procurement = 0, other = 0;
  for (const item of items) {
    if (item.event.sourceType === 'expense_request') expenses++;
    else if (['procurement_delivery', 'procurement_delivery_request'].includes(item.event.sourceType)) accountable++;
    else if (item.event.sourceType === 'supplier_payment_plan') procurement++;
    else other++;
  }
  return { expenses, accountable, procurement, other };
}
export function attentionDigestText(items: AttentionItem[]) {
  const { expenses, accountable, procurement, other } = attentionCounts(items);
  return { title: `Требуют внимания: ${items.length}`, body: [expenses && `Расходные заявки: ${expenses}`, accountable && `Подотчёт: ${accountable}`, procurement && `Закупки: ${procurement}`, other && `Другие дела: ${other}`].filter(Boolean).join(' · ') + '. Откройте список и примите решение.' };
}
