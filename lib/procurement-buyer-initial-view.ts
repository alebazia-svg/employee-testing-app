import type {ComponentProps} from 'react';
import type Calendar from '@/app/(dashboard)/procurement/ProcurementPaymentCalendarClient';
import type {AdminPlans} from './procurement-admin-plans';
import {paymentEvidenceView} from './procurement-evidence-continuity';
import {matchProcurementPaymentEvidence} from './procurement-currency-payment-evidence';
import {readPaymentRevision} from './procurement-plan-revision';

/** Stored presentation only: never financial authority for creation or approval. */
export function buyerInitialView(plans:AdminPlans, ownerId:number, todayKey:string, cargoAllowed:boolean):ComponentProps<typeof Calendar> {
  const initialPlans=plans.filter(p=>p.managerUserId===ownerId).map(plan=>{
    const empty=matchProcurementPaymentEvidence([{...plan,plannedAmount:Number(plan.plannedAmount),
      foreignAmount:plan.foreignAmount==null?null:Number(plan.foreignAmount),
      orderRefs:Array.isArray(plan.orderRefs)?plan.orderRefs.map(String):[],
      plannedDate:plan.plannedDate.toISOString(),createdAt:plan.createdAt.toISOString(),
    }],[],[],[]).get(plan.id)!;
    const snapshot=plan.events[0]?.snapshot as Record<string,unknown>|undefined;
    return {...JSON.parse(JSON.stringify(plan)),revision:readPaymentRevision(plan.oneCCashEvidence),
      correctionReason:typeof snapshot?.correctionReason==='string'?snapshot.correctionReason:'',
      evidence:paymentEvidenceView(plan,empty,false,''),
    };
  });
  const balance={balance:null,checkedAt:'',sourceLabel:'',error:'NOT_CHECKED'};
  return {initialPlans,initialOrders:[],todayKey,cargoAllowed,checkedAt:'',
    sourceError:'SOURCE_LOADING',plansSourceError:false,evidenceSourceError:true,
    managerMappingError:false,supplierBalances:{},supplierDebtTotal:null,supplierDebtError:true,
    usdtBalance:balance,accountableBalance:balance,otherUsdtReserve:null,sourceRefreshing:true};
}
