import type { ExpenseRequestSourceRow } from '@/lib/expense-request-source';
import { matchCashEvidence } from '@/lib/procurement-payment-control';
import type { CurrencyConversionRow, SupplierCurrencyPaymentRow } from '@/lib/procurement-currency-payment-source';
import { applyRublePaymentEvidence, uniqueSupplierPayments, confirmedRubleRemainderPayments } from './procurement-ruble-payment-evidence';
import { paymentFingerprint, samePaymentSupplier } from './procurement-manual-payment-links';
import {COMPLETED_WITHOUT_TOPUP} from './procurement-payment-completion';
import { attachRequestOrderLinks } from './procurement-request-payment-link';
import {hasConfirmedPaymentBasis} from './procurement-payment-basis';
import { procurementCollections, type ProcurementCollection } from './procurement-collection';
import { SMALL_REMAINDER_COMPLETED, smallRubleRemainder, smallForeignRubleFundingRemainder } from './procurement-small-remainder';

export type EvidencePlan = {
  paymentPurpose?: string;
  id: string;
  planCode: string;
  supplierPartner: string;
  supplierCounterparty: string;
  orderRefs: string[];
  plannedAmount: number;
  paymentMethod: string;
  foreignAmount?: number | null;
  managerName?: string;
  plannedDate?: string;
  createdAt?: string;
  status?: string;
  currency?: string;
  hasPendingRevision?: boolean;
  completedPaymentRefs?:string[];
  manualRubleLinks?: import('./procurement-manual-payment-links').ManualPaymentLink[];
};

export type ProcurementPaymentEvidence = Omit<ReturnType<typeof matchCashEvidence>, 'state'> & {
  qrFunding?: import('./procurement-qr-funding').QrFunding;
  state: ReturnType<typeof matchCashEvidence>['state'] | 'PAID_BY_ONE_C' | 'PARTIALLY_PAID_BY_ONE_C' | typeof SMALL_REMAINDER_COMPLETED | 'SOURCE_UNAVAILABLE';
  paidAmount: number;
  paidForeignAmount: number;
  remainingAmount: number;
  remainingForeignAmount: number | null;
  actualExchangeRate: number | null;
  currencyPayments: { ref: string; number: string; date: string; foreignAmount: number; documentForeignAmount?: number; unallocatedForeignAmount?: number }[];
  manualPaymentCount?: number;
  paymentAmountNeedsConfirmation?: boolean;
  completionByRubleEstimate?: boolean;
  collection?: ProcurementCollection;
  rubleAllocationNeedsReview?: boolean;
};

function oneCDateTimestamp(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  return match
    ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]) - 3, Number(match[5]), Number(match[6]))
    : Number.NaN;
}

function conversionRateBefore(payment: SupplierCurrencyPaymentRow, conversions: CurrencyConversionRow[], referenceOnly = false) {
  const paymentAt = oneCDateTimestamp(payment.date);
  if (!Number.isFinite(paymentAt)) return null;
  const conversion = conversions
    .filter((row) => {
      const at = oneCDateTimestamp(row.date);
      return row.posted && !row.deleted && row.currency.includes('РУБ') &&
        row.conversionCurrency === 'USDT' && row.linkedCashbox.toLocaleLowerCase('ru-RU').includes('usdt') &&
        Number.isFinite(at) && at <= paymentAt && (referenceOnly || paymentAt - at <= 24 * 60 * 60 * 1000) && row.conversionRate > 0;
    })
    .sort((a, b) => oneCDateTimestamp(b.date) - oneCDateTimestamp(a.date))[0];
  return conversion?.conversionRate || null;
}

const tolerance = (target: number) => Math.max(0.01, target * 0.001);

export function matchProcurementPaymentEvidence(
  plans: EvidencePlan[],
  requests: ExpenseRequestSourceRow[],
  currencyPayments: SupplierCurrencyPaymentRow[],
  conversions: CurrencyConversionRow[],
  options: { allowSmallRemainder?: boolean } = {},
) {
  const linkedPayments = attachRequestOrderLinks(currencyPayments, requests);
  const uniquePayments = uniqueSupplierPayments(linkedPayments);
  const knownOrders = plans.flatMap(plan => plan.orderRefs);
  const evidence = new Map<string, ProcurementPaymentEvidence>();
  const allocations = new Map<string, { rubles: number; foreign: number; referenceRubles: number; rateRubles: number; rateForeign: number; unknownEquivalent: boolean; payments: ProcurementPaymentEvidence['currencyPayments'] }>();
  for (const plan of plans) {
    const cash = matchCashEvidence(plan, plan.orderRefs.length ? requests : requests.filter(request =>
      `${request.comment || ''} ${request.payment_purpose || ''}`.toUpperCase().includes(plan.planCode.toUpperCase())));
    const cashOrders = cash.cashOrders.filter(row => {
      if(plan.paymentPurpose==='DELIVERY'&&!uniquePayments.some(p=>p.ref.toLowerCase()===row.ref.toLowerCase()&&p.posted&&!p.deleted&&samePaymentSupplier(plan,p)))return false;
      // A portal plan code identifies the request, but cannot manufacture a
      // missing native contract/order basis for a supplier-debt payment.
      if (plan.paymentMethod !== 'USDT' && !plan.orderRefs.length && !uniquePayments.some(payment => payment.ref.toLowerCase() === row.ref.toLowerCase() &&
        payment.posted && !payment.deleted && hasConfirmedPaymentBasis(payment, knownOrders))) return false;
      const owners = plans.filter(p => p.status === COMPLETED_WITHOUT_TOPUP && p.completedPaymentRefs?.includes(row.ref));
      return (!owners.length || owners.length === 1 && owners[0].id === plan.id) &&
        (plan.status !== COMPLETED_WITHOUT_TOPUP || plan.completedPaymentRefs?.includes(row.ref));
    });
    evidence.set(plan.id, {
      // Native requests require an explicit plan code for supplier-only plans.
      // Unclaimed RUB payments are reconciled separately, across ALL plans,
      // by applyRublePaymentEvidence's unique supplier-debt rule.
      ...cash,
      state: cash.state === 'MISMATCH' || cashOrders.length === cash.cashOrders.length ? cash.state : cashOrders.length ? 'PARTIALLY_ISSUED' : 'NO_EVIDENCE',
      cashOrders,
      issuedAmount: cashOrders.reduce((sum,row)=>sum+row.amount,0),
      paidAmount: 0,
      paidForeignAmount: 0,
      remainingAmount: Math.max(0, plan.plannedAmount),
      remainingForeignAmount: plan.paymentMethod === 'USDT' && plan.foreignAmount ? Math.max(0, plan.foreignAmount) : null,
      actualExchangeRate: null,
      currencyPayments: [],
    });
    allocations.set(plan.id, { rubles: 0, foreign: 0, referenceRubles: 0, rateRubles: 0, rateForeign: 0, unknownEquivalent: false, payments: [] });
  }
  const eligiblePlans = plans
    .filter((plan) => plan.status !== 'CANCELLED' && plan.paymentMethod === 'USDT')
    .sort((a, b) => (a.plannedDate || '').localeCompare(b.plannedDate || '') || (a.createdAt || '').localeCompare(b.createdAt || '') || a.planCode.localeCompare(b.planCode));
  const payments = uniqueSupplierPayments(currencyPayments)
    .filter((payment) => payment.posted && !payment.deleted && payment.documentCurrency === 'USDT' && payment.documentAmount > 0)
    .sort((a, b) => oneCDateTimestamp(a.date) - oneCDateTimestamp(b.date));

  // Only the new supplier-debt fallback needs this chronological coverage view.
  // Keep the established allocation pass intact and do not persist this view.
  const coveredBefore = (at: number) => {
    const coverage = new Map([...evidence].map(([id, row]) => [id, {
      ...structuredClone(row), cashOrders: row.cashOrders.filter(p => oneCDateTimestamp(p.date) < at),
    }] as const));
    for (const plan of plans) {
      const row = coverage.get(plan.id)!, prior = allocations.get(plan.id)!;
      const target = Number(plan.foreignAmount || 0);
      const complete = target > 0 ? prior.foreign + tolerance(target) >= target :
        prior.rubles + (prior.unknownEquivalent ? prior.referenceRubles : 0) + tolerance(plan.plannedAmount) >= plan.plannedAmount;
      if (prior.foreign > 0 && row.state !== 'MISMATCH') Object.assign(row, {
        state: complete ? 'PAID_BY_ONE_C' : 'PARTIALLY_PAID_BY_ONE_C',
        paidForeignAmount: prior.foreign, paidAmount: prior.rubles, currencyPayments: prior.payments,
      });
    }
    const earlier = uniquePayments.filter(p => oneCDateTimestamp(p.date) < at);
    applyRublePaymentEvidence(plans, earlier, coverage, options.allowSmallRemainder === true);
    return {rows: coverage, covered: (plan: EvidencePlan) => {
      const row = coverage.get(plan.id)!;
      if (row.state === 'MISMATCH' || row.state === 'NEEDS_REVIEW' || row.rubleAllocationNeedsReview) return false;
      if (row.state === 'PAID_BY_ONE_C' && row.currencyPayments.length &&
          row.currencyPayments.every(p => oneCDateTimestamp(p.date) < at)) return true;
      const orders = [...new Map(row.cashOrders.map(p => [p.ref.toLowerCase(), p])).values()];
      if (!orders.length || orders.some(p => !p.ref || !(p.amount > 0) || !Number.isFinite(p.amount) ||
        !(oneCDateTimestamp(p.date) < at) || [...coverage.values()].filter(other =>
          other.cashOrders.some(r => r.ref.toLowerCase() === p.ref.toLowerCase())).length !== 1)) return false;
      const issuedMinor = orders.reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
      if (!Number.isSafeInteger(issuedMinor)) return false;
      const issued = issuedMinor / 100;
      return issuedMinor >= Math.round(plan.plannedAmount * 100) || options.allowSmallRemainder === true &&
        (smallRubleRemainder(plan, issued) !== null || !row.currencyPayments.length && smallForeignRubleFundingRemainder(plan, issued) !== null) &&
        confirmedRubleRemainderPayments(plan, orders, earlier);
    }};
  };
  const ambiguousDebtPlans = new Set<string>();

  for (const payment of payments) {
    const completedOwners = plans.filter(p => p.status === COMPLETED_WITHOUT_TOPUP && p.completedPaymentRefs?.includes(payment.ref));
    const manualOwners = plans.filter((plan) => plan.manualRubleLinks?.some((link) => link.ref.toLowerCase() === payment.ref.toLowerCase()));
    const rate = conversionRateBefore(payment, conversions);
    let availableForeign = payment.documentAmount;
    const paymentAt = oneCDateTimestamp(payment.date);
    const orderRef=(payment.baseDocumentRef||payment.settlementOrderRef||'').trim().toLowerCase();
    // A register proves the order, not which of several open requests to pay.
    // Unlike the old header-based allocator, this fallback must not guess FIFO.
    const settlementOwners=payment.baseDocumentRef?[]:eligiblePlans.filter(candidate=>{
      const created=Date.parse(candidate.createdAt||'');
      const prior=allocations.get(candidate.id)!;
      const covered=(Number(candidate.foreignAmount)>0
        ? prior.foreign>=Number(candidate.foreignAmount)
        : prior.rubles>=candidate.plannedAmount) && prior.payments.every(row=>oneCDateTimestamp(row.date)<paymentAt);
      return ['APPROVED',COMPLETED_WITHOUT_TOPUP].includes(candidate.status||'') &&
        (candidate.status!==COMPLETED_WITHOUT_TOPUP||candidate.completedPaymentRefs?.includes(payment.ref)) &&
        (!completedOwners.length||completedOwners.length===1&&completedOwners[0].id===candidate.id) &&
        Number.isFinite(created)&&created<=paymentAt&&!covered&&samePaymentSupplier(candidate,payment)&&
        candidate.orderRefs.some(ref=>ref.trim().toLowerCase()===orderRef);
    });
    if(!manualOwners.length && !payment.baseDocumentRef && settlementOwners.length>1){
      for(const owner of settlementOwners){const current=evidence.get(owner.id)!;evidence.set(owner.id,{...current,state:'NEEDS_REVIEW'});}
    }
    let lastAllocation: ProcurementPaymentEvidence['currencyPayments'][number] | undefined;
    const cargoOwners=!orderRef&&!manualOwners.length?eligiblePlans.filter(candidate=>{
      const prior=allocations.get(candidate.id)!;
      return candidate.status==='APPROVED'&&Date.parse(candidate.createdAt||'')<=paymentAt&&samePaymentSupplier(candidate,payment)&&
        (Number(candidate.foreignAmount)>0?prior.foreign<Number(candidate.foreignAmount):prior.rubles<candidate.plannedAmount);
    }):[];
    const cargoOwner=cargoOwners.length===1&&cargoOwners[0].paymentPurpose==='DELIVERY'?cargoOwners[0]:undefined;
    let debtOwner: EvidencePlan | undefined;
    const cancelledOrderOwner = plans.some(p => p.status === 'CANCELLED' && orderRef &&
      p.orderRefs.some(ref => ref.trim().toLowerCase() === orderRef));
    if (!manualOwners.length && !completedOwners.length && !cargoOwner && !cancelledOrderOwner && Number.isFinite(paymentAt) && paymentAt <= Date.now() && hasConfirmedPaymentBasis(payment) &&
        eligiblePlans.some(p => p.status === 'APPROVED' && !p.orderRefs.length &&
          Date.parse(p.createdAt || '') <= paymentAt && samePaymentSupplier(p,payment)) &&
        ![...evidence.values()].some(row => row.cashOrders.some(p => p.ref.toLowerCase() === payment.ref.toLowerCase()))) {
      const {covered, rows: priorEvidence} = coveredBefore(paymentAt);
      const outstanding = plans.filter(p => p.status === 'APPROVED' && Number.isFinite(Date.parse(p.createdAt || '')) &&
        Date.parse(p.createdAt!) <= paymentAt && samePaymentSupplier(p, payment) && !covered(p));
      // A current exact order owner wins; paid historical owners keep their
      // original RKOs but do not compete for this later debt payment.
      const exactOwner = eligiblePlans.some(p => orderRef && Date.parse(p.createdAt || '') <= paymentAt &&
        samePaymentSupplier(p,payment) && !covered(p) && p.orderRefs.some(ref => ref.trim().toLowerCase() === orderRef) &&
        (p.status !== COMPLETED_WITHOUT_TOPUP || p.completedPaymentRefs?.includes(payment.ref)));
      if (outstanding.some(p => !p.orderRefs.length) && !exactOwner && !outstanding.some(p => orderRef &&
        p.orderRefs.some(ref => ref.trim().toLowerCase() === orderRef))) {
        const candidate = outstanding.length === 1 ? outstanding[0] : undefined;
        const target = Number(candidate?.foreignAmount || 0);
        const prior = candidate ? allocations.get(candidate.id)! : undefined;
        const conflict = candidate?.supplierCounterparty.trim() && payment.counterparty?.trim() &&
          !samePaymentSupplier({supplierPartner:'',supplierCounterparty:candidate.supplierCounterparty}, {...payment,supplier:''});
        const supplierConflict = candidate?.supplierPartner.trim() && payment.supplier?.trim() &&
          !samePaymentSupplier({supplierPartner:candidate.supplierPartner,supplierCounterparty:''}, {...payment,counterparty:''});
        if (candidate?.paymentMethod === 'USDT' && !candidate.orderRefs.length && !candidate.hasPendingRevision &&
            target > 0 && Number.isFinite(target) && !conflict && !supplierConflict && prior &&
            !priorEvidence.get(candidate.id)!.cashOrders.length &&
            payment.documentAmount <= Math.max(0, target - prior.foreign) + tolerance(target)) debtOwner = candidate;
        else for (const p of outstanding) if (p.paymentMethod === 'USDT') ambiguousDebtPlans.add(p.id);
      }
    }
    for (const plan of eligiblePlans) {
      if (debtOwner && debtOwner.id !== plan.id) continue;
      if(completedOwners.length && (completedOwners.length !== 1 || completedOwners[0].id !== plan.id))continue;
      if(plan.status===COMPLETED_WITHOUT_TOPUP&&!plan.completedPaymentRefs?.includes(payment.ref))continue;
      if (availableForeign <= 0.0000001) break;
      if (manualOwners.length) {
        if (manualOwners.length !== 1 || manualOwners[0].id !== plan.id || !['APPROVED',COMPLETED_WITHOUT_TOPUP].includes(plan.status||'') ||
            !plan.manualRubleLinks?.some((link) => link.fingerprint === paymentFingerprint(payment)) || !samePaymentSupplier(plan, payment)) continue;
      } else if (cargoOwner?.id!==plan.id&&debtOwner?.id!==plan.id&&(!orderRef || !plan.orderRefs.some((ref) => ref.trim().toLowerCase() === orderRef) ||
        (!payment.baseDocumentRef && (settlementOwners.length!==1||settlementOwners[0].id!==plan.id)))) continue;
      const createdAt = plan.createdAt ? new Date(plan.createdAt).getTime() : Number.NaN;
      if (Number.isFinite(createdAt) && Number.isFinite(paymentAt) && createdAt > paymentAt) continue;
      const allocation = allocations.get(plan.id)!;
      const targetForeign = Number(plan.foreignAmount || 0);
      // A posted payment is evidence even without a recent exchange. Do not
      // invent a ruble equivalent or assign one payment to ambiguous requests.
      if (!targetForeign && !rate) {
        const uniqueOwner = manualOwners.length === 1 || (!payment.baseDocumentRef ? settlementOwners.length===1 : eligiblePlans.filter(candidate =>
          candidate.orderRefs.some(ref => ref.trim().toLowerCase() === orderRef),
        ).length === 1);
        if (!['APPROVED',COMPLETED_WITHOUT_TOPUP].includes(plan.status||'') || !uniqueOwner) continue;
        allocation.foreign += availableForeign;
        // The owner plans a RUB budget, not an exact exchange transaction.
        // A historical reference can prove coverage of that budget, but must
        // never be exposed as an actual RUB payment or actual exchange rate.
        allocation.referenceRubles += availableForeign * (conversionRateBefore(payment, conversions, true) || 0);
        allocation.unknownEquivalent = true;
        allocation.payments.push({ref: payment.ref, number: payment.number, date: payment.date, foreignAmount: availableForeign});
        availableForeign = 0;
        continue;
      }
      const takeForeign = targetForeign > 0
        ? Math.min(availableForeign, Math.max(0, targetForeign - allocation.foreign))
        : rate
          ? Math.min(availableForeign, Math.max(0, plan.plannedAmount - allocation.rubles) / rate)
          : 0;
      if (takeForeign <= 0.0000001) continue;
      const takeRubles = rate ? takeForeign * rate : 0;
      allocation.foreign += takeForeign;
      allocation.rubles += takeRubles;
      if (rate) {
        allocation.rateRubles += takeRubles;
        allocation.rateForeign += takeForeign;
      }
      lastAllocation={ ref: payment.ref, number: payment.number, date: payment.date, foreignAmount: takeForeign, documentForeignAmount: payment.documentAmount };
      allocation.payments.push(lastAllocation);
      availableForeign -= takeForeign;
    }
    // Preserve the remainder exactly once, outside request coverage/totals.
    // It is not automatically supplier overpayment or a new payment request.
    if(lastAllocation && availableForeign>0.0000001)lastAllocation.unallocatedForeignAmount=Math.round(availableForeign*1e8)/1e8;
  }

  for (const plan of plans) {
    const current = evidence.get(plan.id)!;
    const allocation = allocations.get(plan.id)!;
    const targetForeign = Number(plan.foreignAmount || 0);
    const estimateCovered = allocation.unknownEquivalent && targetForeign <= 0 &&
      allocation.rubles + allocation.referenceRubles + tolerance(plan.plannedAmount) >= plan.plannedAmount;
    const complete = targetForeign > 0
      ? allocation.foreign + tolerance(targetForeign) >= targetForeign
      : estimateCovered || allocation.rubles + tolerance(plan.plannedAmount) >= plan.plannedAmount;
    const unresolvedDebt = ambiguousDebtPlans.has(plan.id) && !(allocation.foreign > 0 && complete);
    evidence.set(plan.id, {
      ...current,
      state: unresolvedDebt || allocation.unknownEquivalent && !estimateCovered ? 'NEEDS_REVIEW' : allocation.foreign > 0 ? complete ? 'PAID_BY_ONE_C' : 'PARTIALLY_PAID_BY_ONE_C' : current.state,
      paymentAmountNeedsConfirmation: allocation.unknownEquivalent && !estimateCovered,
      completionByRubleEstimate: estimateCovered,
      paidAmount: allocation.rubles,
      paidForeignAmount: allocation.foreign,
      remainingAmount: estimateCovered ? 0 : Math.max(0, plan.plannedAmount - allocation.rubles),
      remainingForeignAmount: plan.paymentMethod === 'USDT' && targetForeign > 0 ? Math.max(0, targetForeign - allocation.foreign) : null,
      actualExchangeRate: allocation.rateForeign > 0 ? allocation.rateRubles / allocation.rateForeign : null,
      currencyPayments: allocation.payments,
      manualPaymentCount: allocation.payments.filter((row) => plan.manualRubleLinks?.some((link) => link.ref === row.ref)).length,
    });
  }
  applyRublePaymentEvidence(plans, linkedPayments, evidence, options.allowSmallRemainder === true);
  // Derived only from a complete fresh read. Keep all actual amounts and RKO
  // ownership; a removed/unposted payment makes the request active again.
  if (options.allowSmallRemainder === true) for (const plan of plans) {
    const row = evidence.get(plan.id)!;
    if (row.state === 'PARTIALLY_ISSUED' && !row.rubleAllocationNeedsReview && !row.paymentAmountNeedsConfirmation &&
      row.cashOrders.length > 0 && row.cashOrders.every(p => p.ref && Number.isFinite(p.amount) && p.amount > 0) &&
      confirmedRubleRemainderPayments(plan, row.cashOrders, uniquePayments) &&
      (smallRubleRemainder(plan, row.issuedAmount) !== null ||
        (!row.currencyPayments.length && row.paidForeignAmount === 0 && smallForeignRubleFundingRemainder(plan, row.issuedAmount) !== null))) row.state = SMALL_REMAINDER_COMPLETED;
  }
  for (const [id, collection] of procurementCollections(plans, requests, evidence)) evidence.get(id)!.collection = collection;
  return evidence;
}
