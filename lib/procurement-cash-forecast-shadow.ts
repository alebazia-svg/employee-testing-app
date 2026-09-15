import {
  buildProcurementCashForecast, type CashForecast, type ForecastEvent,
} from './procurement-cash-forecast';
import type { OwnerMoneySource } from './procurement-cash-forecast-source';

export type ShadowSupplierPlan = {
  id: string;
  status: string;
  plannedDate: string;
  plannedAmountRub: string;
};

function rublesToMinor(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('FORECAST_INVALID_PLAN_AMOUNT');
  const [rubles, kopecks = ''] = value.split('.');
  const result = Number(rubles) * 100 + Number(kopecks.padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result <= 0) throw new Error('FORECAST_INVALID_PLAN_AMOUNT');
  return result;
}

/**
 * Plans stay unplaced until their remaining amount and funding source have
 * been reconciled with 1C. This also handles the valid zero-plan state.
 */
export function buildOwnerCashForecastShadow(input: {
  asOf: string;
  money: OwnerMoneySource;
  plans: ShadowSupplierPlan[];
}): { forecast: CashForecast; activePlanCount: number; sourceWarnings: string[]; money: OwnerMoneySource } {
  if (input.plans.some((plan) => !['SUBMITTED', 'APPROVED', 'CANCELLED'].includes(plan.status))) {
    throw new Error('FORECAST_UNKNOWN_PLAN_STATUS');
  }
  const active = input.plans.filter((plan) => plan.status !== 'CANCELLED');
  const events: ForecastEvent[] = active.map((plan) => ({
    id: `supplier-plan:${plan.id}`,
    source: 'portal_supplier_plan_unreconciled',
    dueOn: plan.plannedDate,
    bucketId: null,
    currency: 'RUB',
    amountMinor: rublesToMinor(plan.plannedAmountRub),
    direction: 'out',
    certainty: plan.status === 'APPROVED' ? 'confirmed' : 'proposed',
  }));
  return {
    forecast: buildProcurementCashForecast({
      asOf: input.asOf, positions: input.money.positions, events,
      // Payroll, rent, supplier debts, 1C payment evidence and bank withdrawal
      // capacity are still not joined. Never report this as a full forecast.
      sourcesComplete: false,
    }),
    activePlanCount: active.length,
    sourceWarnings: input.money.warnings,
    money: input.money,
  };
}
