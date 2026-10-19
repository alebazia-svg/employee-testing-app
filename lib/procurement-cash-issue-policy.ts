import { deliveryCollectionAmount, deliveryNativeFresh, type DeliveryNativeStatus } from './procurement-delivery-native';
import { DELIVERY_PHONE_RESERVE_REF } from './procurement-delivery-reserve';

export const CASH_ISSUE_KIND = 'procurement_cash_issue';
export type CashIssueNotice = { userId: number; fingerprint: string; title: string; body: string;
  request: NonNullable<ReturnType<typeof cashIssuePermission>>; checkedAt: string };
export type CashIssueState = { state: 'unknown' | 'inactive'; checkedAt: string }
  | { state: 'waiting_shift'; userId: number; fingerprint: string; checkedAt: string }
  | ({ state: 'ready' } & CashIssueNotice)
  | { state: 'shared'; notices: CashIssueNotice[]; checkedAt: string };
export function cashIssueNotices(current: CashIssueState): CashIssueNotice[] {
  return current.state === 'ready' ? [current] : current.state === 'shared' ? current.notices : [];
}
export function cashIssueForUser(current: CashIssueState, userId: number) {
  return cashIssueNotices(current).find(notice => notice.userId === userId) ?? null;
}
// Fallback only while live details are unavailable. The sender uses
// cashIssuePushCopy after rechecking the assignment and payable request; the
// authenticated screen rechecks them again when the cashier opens it.
export const CASH_ISSUE_PUSH_COPY = { title: 'Заявка на выдачу денег готова', body: 'Проверьте сумму и получателя. После выдачи оформите расходник в 1С.' };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function cashIssueKey(status: DeliveryNativeStatus, userId: number) {
  return `accountable-cash-issue:${status.ref}:${status.cashboxRef}:${userId}:${Math.round(status.amount * 100)}`;
}
export function cashIssueRef(fingerprint?: string) {
  const parts = fingerprint?.split(':');
  return parts?.[0] === 'accountable-cash-issue' && uuid.test(parts[1] ?? '') ? parts[1] : null;
}
export function cashIssueHref(fingerprint?: string) {
  const ref = cashIssueRef(fingerprint);
  return ref ? `/employee/cash-issue?request=${encodeURIComponent(ref)}` : '/employee';
}
export function cashIssuePermission(status: DeliveryNativeStatus, now: Date) {
  const amount = deliveryCollectionAmount(status);
  if (!deliveryNativeFresh(status, now.getTime()) || status.canCollect !== true || amount === null
    || !uuid.test(status.ref) || !uuid.test(status.cashboxRef ?? '') || !status.recipientName?.trim()
    || !Number.isFinite(status.amount) || status.amount <= 0) return null;
  return { ref: status.ref, number: status.number, recipient: status.recipientName,
    cashbox: status.cashbox!, cashboxRef: status.cashboxRef!, amount, issued: status.issued ?? 0,
    total: status.amount, checkedAt: status.checkedAt };
}

export function cashIssueCompactCopy(request: NonNullable<ReturnType<typeof cashIssuePermission>>) {
  const recipient = request.recipient.trim() === 'Тохов Астемир' ? 'Астемиру' : request.recipient;
  const amount = request.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return {
    title: `Выдать ${recipient}${request.issued > 0 ? ' ещё' : ''} ${amount} ₽`,
    subtitle: request.cashboxRef === DELIVERY_PHONE_RESERVE_REF ? `Из кассы «${request.cashbox}»` : 'Заявка готова · оформите расходник',
  };
}

export function cashIssuePushCopy(request: NonNullable<ReturnType<typeof cashIssuePermission>>) {
  return {
    title: cashIssueCompactCopy(request).title,
    body: `Из кассы «${request.cashbox}». После выдачи оформите расходник в 1С.`,
  };
}
