import { isInactivePaymentPlan } from './procurement-payment-completion';
/** Read-only reservation in USDT. Ruble references are never proof of exchange. */
export type UsdtReservePlan = {
  status: string; paymentMethod: string; plannedAmount: string | number;
  foreignAmount: string | number | null;
  evidence?: { state: string; remainingForeignAmount: number | null; remainingAmount: number };
};
const nonnegative = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
export function usdtReservedByPlans(plans: UsdtReservePlan[], rate: number | null): number | null {
  let total = 0;
  for (const plan of plans) {
    if (isInactivePaymentPlan(plan.status) || plan.paymentMethod !== 'USDT') continue;
    if (plan.evidence?.state === 'PAID_BY_ONE_C') continue;
    if (['MISMATCH', 'NEEDS_REVIEW'].includes(plan.evidence?.state || '')) return null;
    const foreign = nonnegative(plan.foreignAmount);
    if (foreign != null && foreign > 0) {
      const remaining = plan.evidence?.remainingForeignAmount == null
        ? foreign : nonnegative(plan.evidence.remainingForeignAmount);
      if (remaining == null) return null;
      total += remaining;
    } else {
      const rubles = nonnegative(plan.evidence?.remainingAmount ?? plan.plannedAmount);
      if (rubles == null || !Number.isFinite(rate) || !rate || rate <= 0) return null;
      total += rubles / rate;
    }
  }
  return total;
}
