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

/** A small excess may cover one confirmed RUB budget; never split or discard
 * the actual RKO amount. Both bounds apply to the still-unpaid budget. */
export function rublePaymentFitsRemaining(remaining: number, amount: number, allowSmallExcess = false) {
  const target = cents(remaining), paid = cents(amount);
  if (!(target > 0 && paid > 0)) return false;
  const excess = paid - target;
  return excess <= 0 || (allowSmallExcess && excess <= SMALL_REMAINDER_MAX_RUB * 100 &&
    excess * 100 <= target * SMALL_REMAINDER_MAX_PERCENT);
}

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

/** Owner-approved cash-to-exchanger flow. Only call after exact RUB RKO proof;
 * this closes the RUB funding budget, never invents a USDT transfer amount. */
export function smallUsdtRubleFundingRemainder(plan: Plan, paid: number): number | null {
  if (plan.paymentMethod !== 'USDT' || (plan.currency && plan.currency !== 'USDT')) return null;
  return smallRubleRemainder({...plan, paymentMethod:'CASH', currency:'RUB', foreignAmount:null}, paid);
}
