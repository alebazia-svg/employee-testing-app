import type { ComponentProps } from 'react';
import type AdminProcurementClient from '@/app/(dashboard)/admin/procurement/AdminProcurementClient';
import type { AdminPlans } from './procurement-admin-plans';
import { paymentEvidenceView, savedPaymentEvidence } from './procurement-evidence-continuity';
import { matchProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import { buildAdminProcurementForecast } from './procurement-admin-forecast';
import { readPaymentRevision } from './procurement-plan-revision';

/** Presentation only: never input to allocation, funding, notifications or writes. */
export function adminInitialView(plans: AdminPlans, todayKey: string): ComponentProps<typeof AdminProcurementClient> {
  const initialPlans = plans.map(plan => {
    const empty = matchProcurementPaymentEvidence([{...plan, plannedAmount:Number(plan.plannedAmount),
      foreignAmount:plan.foreignAmount==null?null:Number(plan.foreignAmount),
      orderRefs:Array.isArray(plan.orderRefs)?plan.orderRefs.map(String):[],
      plannedDate:plan.plannedDate.toISOString(), createdAt:plan.createdAt.toISOString(),
    }], [], [], []).get(plan.id)!;
    return {...JSON.parse(JSON.stringify(plan)), evidence:paymentEvidenceView(plan, empty, false, '')};
  });
  const times = plans.flatMap(p => {const saved=savedPaymentEvidence(p);return saved?[saved.verifiedAt]:[];}).sort();
  const balance = {balance:null,checkedAt:'',sourceLabel:'',error:'NOT_CHECKED'};
  return {
    initialPlans, todayKey, sourceCheckedAt:times[0]||'', sourceWarnings:[], refreshState:'loading',
    revisionCount:plans.filter(p=>readPaymentRevision(p.oneCCashEvidence)).length,
    unplannedOrderCount:null,openOrderCount:null,orderPaymentGapTotal:null,unplannedCashCount:null,supplierDebtTotal:null,
    usdtBalance:balance,accountableBalance:balance,
    ...buildAdminProcurementForecast({todayKey,plansComplete:false,ordersComplete:false,
      plansWithOrderContext:[],scopedOrders:[],managerOrders:[],usdtBalance:balance,accountableBalance:balance},null),
  };
}
