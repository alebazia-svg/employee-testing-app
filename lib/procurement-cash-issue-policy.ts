import { deliveryCollectionAmount, deliveryNativeFresh, type DeliveryNativeStatus } from './procurement-delivery-native';

export const CASH_ISSUE_KIND = 'procurement_cash_issue';
// Push may arrive after an assignment changes. The authenticated screen always
// rechecks who may issue money; the lock-screen message is deliberately neutral.
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
    subtitle: 'Заявка готова · оформите расходник',
  };
}
