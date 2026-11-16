import type { SupplierOrderFinanceRow } from './procurement-payment-source';
import type { SupplierBalance } from './procurement-supplier-settlements';
import type { PlannedRateReference } from './procurement-planned-fx';
import { calculateOrderPlanning } from './procurement-payment-control';
import { ordersForRequest } from './procurement-order-selection';
import { isInactivePaymentPlan } from './procurement-payment-completion';
import { isFinishedPaymentState } from './procurement-small-remainder';

export type ProcurementCreateView = {
  orders: ReturnType<typeof creationOrderChoices>['orders'];
  supplierBalances: Record<string, SupplierBalance>;
  activeOrderRefs: string[];
  activeSupplierNames: string[];
  cargoAllowed: boolean;
  todayKey: string;
  availableUsdt: number | null;
  usdtRateReference?: { rate: number | null; checkedAt: string; sourceLabel: string; conversionAt?: string };
  cnyRateReference?: PlannedRateReference;
};
type Plan = { orderRefs: unknown; supplierPartner: string; status: string; plannedAmount: number; evidence: {state: string; issuedAmount: number; paidAmount: number} };

/** The same availability rules as the buyer calendar, without changing its UI. */
export function creationOrderChoices(source: SupplierOrderFinanceRow[], plans: Plan[], today: string) {
  const working = plans.filter(plan => !isInactivePaymentPlan(plan.status) && !isFinishedPaymentState(plan.evidence.state));
  const planning = calculateOrderPlanning(source, working.map(plan => ({
    ...plan, orderRefs: Array.isArray(plan.orderRefs) ? plan.orderRefs.map(String) : [],
    issuedAmount: plan.evidence.state === 'MISMATCH' ? 0 : plan.evidence.issuedAmount + plan.evidence.paidAmount,
  })));
  return {
    orders: ordersForRequest(planning, today),
    activeOrderRefs: planning.filter(order => working.some(plan =>
      Array.isArray(plan.orderRefs) && plan.orderRefs.includes(order.ref))).map(order => order.ref),
    activeSupplierNames: working.map(plan => plan.supplierPartner),
  };
}
