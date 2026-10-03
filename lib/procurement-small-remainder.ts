/** Operational completion of a request, never a write-off of supplier debt. */
export const SMALL_REMAINDER_COMPLETED = 'SMALL_REMAINDER_COMPLETED';
export const SMALL_REMAINDER_MAX_RUB = 500;
export const SMALL_REMAINDER_MAX_PERCENT = 1;

export function isFinishedPaymentState(state?: string) {
  return state === 'ISSUED_BY_ONE_C' || state === 'PAID_BY_ONE_C' || state === SMALL_REMAINDER_COMPLETED;
}

type Plan = {
  plannedAmount: number; paymentMethod: string; status?: string;
  foreignAmount?: number | null; currency?: string; hasPendingRevision?: boolean;
};
const cents = (amount: number) => Number.isFinite(amount) && Number.isSafeInteger(Math.round(amount * 100))
  && Math.abs(amount * 100 - Math.round(amount * 100)) < .00001 ? Math.round(amount * 100) : NaN;

/** Both inclusive bounds must hold; use integer kopecks, not a rounded percent. */
export function smallRubleRemainder(plan: Plan, paid: number): number | null {
  if (plan.status !== 'APPROVED' || plan.hasPendingRevision ||
    !['CASH', 'BANK', 'ACCOUNTABLE_QR'].includes(plan.paymentMethod) ||
    (plan.currency && !['RUB', 'РУБ'].includes(plan.currency)) ||
    (plan.foreignAmount != null && plan.foreignAmount !== 0)) return null;
  const target = cents(plan.plannedAmount), received = cents(paid), remainder = target - received;
  if (!(received > 0 && target > received && remainder <= SMALL_REMAINDER_MAX_RUB * 100 &&
    remainder * 100 <= target * SMALL_REMAINDER_MAX_PERCENT)) return null;
  return remainder / 100;
}
