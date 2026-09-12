import type { ExpenseRequestSourceRow } from '@/lib/expense-request-source';
import { matchCashEvidence } from '@/lib/procurement-payment-control';
import type { CurrencyConversionRow, SupplierCurrencyPaymentRow } from '@/lib/procurement-currency-payment-source';

export type EvidencePlan = {
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
};

export type ProcurementPaymentEvidence = Omit<ReturnType<typeof matchCashEvidence>, 'state'> & {
  state: ReturnType<typeof matchCashEvidence>['state'] | 'PAID_BY_ONE_C' | 'PARTIALLY_PAID_BY_ONE_C';
  paidAmount: number;
  paidForeignAmount: number;
  remainingAmount: number;
  remainingForeignAmount: number | null;
  actualExchangeRate: number | null;
  currencyPayments: { ref: string; number: string; date: string; foreignAmount: number }[];
};

function oneCDateTimestamp(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  return match
    ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]) - 3, Number(match[5]), Number(match[6]))
    : Number.NaN;
}

function conversionRateBefore(payment: SupplierCurrencyPaymentRow, conversions: CurrencyConversionRow[]) {
  const paymentAt = oneCDateTimestamp(payment.date);
  if (!Number.isFinite(paymentAt)) return null;
  const conversion = conversions
    .filter((row) => {
      const at = oneCDateTimestamp(row.date);
      return row.posted && !row.deleted && row.currency.includes('РУБ') &&
        row.conversionCurrency === 'USDT' && row.linkedCashbox.toLocaleLowerCase('ru-RU').includes('usdt') &&
        Number.isFinite(at) && at <= paymentAt && paymentAt - at <= 24 * 60 * 60 * 1000 && row.conversionRate > 0;
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
) {
  const evidence = new Map<string, ProcurementPaymentEvidence>();
  const allocations = new Map<string, { rubles: number; foreign: number; rateRubles: number; rateForeign: number; payments: ProcurementPaymentEvidence['currencyPayments'] }>();
  for (const plan of plans) {
    evidence.set(plan.id, {
      ...matchCashEvidence(plan, requests),
      paidAmount: 0,
      paidForeignAmount: 0,
      remainingAmount: Math.max(0, plan.plannedAmount),
      remainingForeignAmount: plan.foreignAmount ? Math.max(0, plan.foreignAmount) : null,
      actualExchangeRate: null,
      currencyPayments: [],
    });
    allocations.set(plan.id, { rubles: 0, foreign: 0, rateRubles: 0, rateForeign: 0, payments: [] });
  }
  const eligiblePlans = plans
    .filter((plan) => plan.status !== 'CANCELLED' && plan.paymentMethod === 'USDT')
    .sort((a, b) => (a.plannedDate || '').localeCompare(b.plannedDate || '') || (a.createdAt || '').localeCompare(b.createdAt || '') || a.planCode.localeCompare(b.planCode));
  const payments = currencyPayments
    .filter((payment) => payment.posted && !payment.deleted && payment.documentCurrency === 'USDT' && payment.documentAmount > 0 && payment.baseDocumentRef)
    .sort((a, b) => oneCDateTimestamp(a.date) - oneCDateTimestamp(b.date));

  for (const payment of payments) {
    const rate = conversionRateBefore(payment, conversions);
    let availableForeign = payment.documentAmount;
    const paymentAt = oneCDateTimestamp(payment.date);
    for (const plan of eligiblePlans) {
      if (availableForeign <= 0.0000001) break;
      if (!plan.orderRefs.some((ref) => ref.trim().toLowerCase() === payment.baseDocumentRef)) continue;
      const createdAt = plan.createdAt ? new Date(plan.createdAt).getTime() : Number.NaN;
      if (Number.isFinite(createdAt) && Number.isFinite(paymentAt) && createdAt > paymentAt) continue;
      const allocation = allocations.get(plan.id)!;
      const targetForeign = Number(plan.foreignAmount || 0);
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
      allocation.payments.push({ ref: payment.ref, number: payment.number, date: payment.date, foreignAmount: takeForeign });
      availableForeign -= takeForeign;
    }
  }

  for (const plan of plans) {
    const current = evidence.get(plan.id)!;
    const allocation = allocations.get(plan.id)!;
    const targetForeign = Number(plan.foreignAmount || 0);
    const complete = targetForeign > 0
      ? allocation.foreign + tolerance(targetForeign) >= targetForeign
      : allocation.rubles + tolerance(plan.plannedAmount) >= plan.plannedAmount;
    evidence.set(plan.id, {
      ...current,
      state: allocation.foreign > 0 ? complete ? 'PAID_BY_ONE_C' : 'PARTIALLY_PAID_BY_ONE_C' : current.state,
      paidAmount: allocation.rubles,
      paidForeignAmount: allocation.foreign,
      remainingAmount: Math.max(0, plan.plannedAmount - allocation.rubles),
      remainingForeignAmount: targetForeign > 0 ? Math.max(0, targetForeign - allocation.foreign) : null,
      actualExchangeRate: allocation.rateForeign > 0 ? allocation.rateRubles / allocation.rateForeign : null,
      currencyPayments: allocation.payments,
    });
  }
  return evidence;
}
