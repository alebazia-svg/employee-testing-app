export type AttentionPushDetail = { identity: string; detail: string; action: string; reference?: string };
export type AttentionUrgency = { key: string; at: string; label: string; phase: 'upcoming' | 'due'; signals?: string[] };
/** Business attention is independent from notification read state. */
export const ATTENTION_LIFECYCLE_SOURCES = ['expense_request', 'supplier_payment_plan', 'procurement_delivery', 'procurement_delivery_request', 'workday_close_exception', 'cash_operation', 'workday_control_issue', 'terminal_fiscal_review'] as const;
export const ATTENTION_PUSH_TYPES = ['expense_request.created', 'procurement.delivery_requested', 'procurement.delivery_manual_requested', 'procurement.payment_submitted', 'workday.close_exception_requested', 'workday.cash_encashment_exception_requested', 'workday.cash_operation_failed', 'workday.kkm_shift_close_attention', 'workday_issue.employee_action', 'workday_issue.employee_message', 'terminal_fiscal_review.employee_action', 'terminal_fiscal_review.employee_message'] as const;
export type AttentionItem = {
  id: string; readAt: string | null;
  event: { type: string; sourceType: string; sourceId: string; occurredAt: string; title?: string; body?: string; href?: string; deadline?: string; push?: AttentionPushDetail; urgency?: AttentionUrgency; technicalAttention?: boolean };
  meta: { category: string }; sourceState: { active: boolean };
};
export function attentionKey(item: AttentionItem) {
  const source = item.event.sourceType === 'procurement_delivery_request' ? 'procurement_delivery' : item.event.sourceType;
  return `${source}:${item.event.sourceId}`;
}
export function needsAdminAttention(item: AttentionItem) {
  // Technical health is visible in System, not an unresolved owner decision.
  if (item.meta.category === 'system' || item.event.technicalAttention === true) return false;
  // A routine automatic fiscal check belongs in section control, not owner messages.
  if (item.event.type === 'terminal_fiscal_review.created') return false;
  if ((ATTENTION_LIFECYCLE_SOURCES as readonly string[]).includes(item.event.sourceType)) return item.sourceState.active;
  return item.readAt === null;
}
export function attentionPriority(item: AttentionItem) {
  if (item.meta.category === 'system') return 3;
  if (['expense_request', 'procurement_delivery', 'procurement_delivery_request', 'cash_operation'].includes(item.event.sourceType)) return 0;
  if (item.event.sourceType === 'supplier_payment_plan') return 2;
  return 1;
}
export function selectAdminAttention<T extends AttentionItem>(items: T[]): T[] {
  const bySource = new Map<string, T>();
  for (const item of [...items].sort((a, b) => b.event.occurredAt.localeCompare(a.event.occurredAt) || b.id.localeCompare(a.id))) {
    if (needsAdminAttention(item) && !bySource.has(attentionKey(item))) bySource.set(attentionKey(item), item);
  }
  return [...bySource.values()].sort((a, b) => Number(Boolean(b.event.urgency)) - Number(Boolean(a.event.urgency)) || (a.event.urgency && b.event.urgency ? a.event.urgency.at.localeCompare(b.event.urgency.at) : 0) || attentionPriority(a) - attentionPriority(b) || b.event.occurredAt.localeCompare(a.event.occurredAt) || b.id.localeCompare(a.id));
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
export type DigestState = { ids: string[]; repeat: boolean; signals?: string[]; seen?: string[] };
export function readDigestState(raw: string | null): DigestState {
  try { const v = JSON.parse(raw ?? ''); return Array.isArray(v.ids) && v.ids.every((id: unknown) => typeof id === 'string') ? { ids: v.ids, repeat: v.repeat === true, ...(Array.isArray(v.seen) && v.seen.every((id: unknown) => typeof id === 'string') ? { seen: v.seen.slice(-2048) } : {}), ...(Array.isArray(v.signals) && v.signals.every((x: unknown) => typeof x === 'string') ? { signals: v.signals } : {}) } : { ids: [], repeat: false }; } catch { return { ids: [], repeat: false }; }
}
export function digestDue(input: { items: AttentionItem[]; previous: DigestState; sentAt: Date | null; now: Date }) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Moscow' }).format(input.now));
  if (!input.items.length || hour < 9 || hour >= 22) return null;
  const ids = input.items.map(item => item.id).sort();
  const hasNew = ids.some(id => !(input.previous.seen ?? input.previous.ids).includes(id));
  const currentSignals = input.items.flatMap(item => item.event.urgency ? (item.event.urgency.signals ?? [`${item.event.urgency.key}:${item.event.urgency.phase}`]).map(signal => `${attentionKey(item)}:${signal}`) : []).sort();
  const signals = [...new Set([...(input.previous.signals ?? []), ...currentSignals])].slice(-2048);
  const hasSignal = currentSignals.some(key => !input.previous.signals?.includes(key));
  const age = input.sentAt ? input.now.getTime() - input.sentAt.getTime() : Infinity;
  const onlyPlanned = input.items.every(item => item.event.sourceType === 'supplier_payment_plan' || item.event.technicalAttention === true);
  if (onlyPlanned && !hasNew && input.sentAt && attentionDay(input.sentAt) === attentionDay(input.now)) return null;
  const wait = hasNew || hasSignal ? 5 * 60_000 : input.previous.repeat ? 60 * 60_000 : 15 * 60_000;
  if (age < wait) return null;
  const seen = [...new Set([...(input.previous.seen ?? input.previous.ids), ...ids])].slice(-2048);
  return { ids, ...(seen.some(id => !ids.includes(id)) ? { seen } : {}), repeat: hasSignal && !hasNew ? input.previous.repeat : !hasNew, ...(signals.length ? { signals } : {}) };
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
/** Compact concrete summary; every send still replaces the same OS card. */
export function pushText(value: unknown, max: number) {
  const text = String(value ?? '').replace(/[\s\u0000-\u001f]+/g, ' ').trim();
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, max - 1).join('').trimEnd() + '…';
}
export function pushIdentity(name: string | null | undefined, amount: unknown) {
  const number = amount === null || amount === undefined || amount === '' ? NaN : Number(amount);
  return `${pushText(name || 'Заявитель не указан', 38)} · ${Number.isFinite(number) ? number.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽' : 'сумма не указана'}`;
}
export function attentionDigestText(items: AttentionItem[], previous: DigestState = { ids: [], repeat: false }) {
  const fallbackUrl = '/admin/inbox?view=attention';
  if (!items.length) return { title: 'Нет нерешённых дел', body: '', url: fallbackUrl };
  const details = (item: AttentionItem): AttentionPushDetail => item.event.push ?? { identity: item.event.title || 'Рабочая заявка', detail: item.event.body || '', action: 'Проверить' };
  const isNew = (item: AttentionItem) => !(previous.seen ?? previous.ids).includes(item.id);
  if (items.length === 1) {
    const item = items[0], data = details(item);
    const title = item.event.urgency ? `Срочно: ${data.identity}` : isNew(item) ? `${data.identity} — ${data.action}` : `Напоминание: ${data.identity}`;
    // Source links are local ADMIN destinations; never accept an external push target.
    const href = item.event.href;
    const url = href && !href.includes('..') && /^\/admin\/[a-zA-Z0-9/?#%&=._:-]+$/.test(href) ? href : fallbackUrl;
    return { title: pushText(title, 110), body: [isNew(item) ? 'Новое.' : '', `${data.action}.`, pushText(data.detail, 100), pushText(item.event.deadline, 90)].filter(Boolean).join(' '), url };
  }
  // A new request must be identifiable even when older overdue work ranks first.
  const newest = items.filter(item => isNew(item) && !item.event.technicalAttention).sort((a,b) => b.event.occurredAt.localeCompare(a.event.occurredAt))[0];
  const first = newest ?? items[0];
  const second = items.find(item => item.id !== first.id)!;
  const lines = [first, second].map(item => `${isNew(item) ? 'Новое · ' : item.event.urgency ? 'Срочно · ' : ''}${pushText(details(item).identity, 70)}${details(item).reference ? ' · № ' + pushText(details(item).reference, 16) : ''} — ${pushText(details(item).action, 30)}`);
  if (items.length > 2) lines.push(`Ещё ${items.length - 2} требуют решения`);
  return { title: `Требуют внимания: ${items.length}`, body: lines.join('\n'), url: fallbackUrl };
}
