import 'server-only';

import { prisma } from './prisma';
import { fetchOwnerMoneyForCashForecast } from './procurement-cash-forecast-one-c';
import { buildOwnerCashForecastShadow } from './procurement-cash-forecast-shadow';

/** Internal read-only runner. Do not expose this without the admin role gate. */
export async function loadOwnerCashForecastShadow(asOf: string) {
  const [moneyResult, rowsResult] = await Promise.allSettled([
    fetchOwnerMoneyForCashForecast(asOf),
    prisma.supplierPaymentPlan.findMany({
      where: { status: { in: ['SUBMITTED', 'APPROVED'] } },
      select: { id: true, planCode: true, supplierPartner: true, paymentMethod: true,
        currency: true, status: true, plannedDate: true, plannedAmount: true, oneCIssuedAmount: true },
      orderBy: [{ plannedDate: 'asc' }, { createdAt: 'asc' }],
      take: 501,
    }),
  ]);
  if (rowsResult.status === 'rejected') throw rowsResult.reason;
  const rows = rowsResult.value;
  if (rows.length > 500) throw new Error('FORECAST_PLAN_SOURCE_LIMIT');
  // A temporary 1C outage must not hide new employee requests stored in the portal.
  const money = moneyResult.status === 'fulfilled' ? moneyResult.value : null;
  const shadow = money ? buildOwnerCashForecastShadow({
    asOf, money,
    plans: rows.map((plan) => ({
      id: plan.id, status: plan.status,
      plannedDate: plan.plannedDate.toISOString().slice(0, 10),
      plannedAmountRub: plan.plannedAmount.toFixed(2),
    })),
  }) : null;
  return {
    forecast: shadow?.forecast ?? null,
    money,
    activePlanCount: rows.length,
    sourceWarnings: shadow?.sourceWarnings ?? ['money_source_unavailable'],
    portalPlans: rows.map((plan) => ({
      id: plan.id, planCode: plan.planCode, supplier: plan.supplierPartner,
      paymentMethod: plan.paymentMethod, currency: plan.currency, status: plan.status,
      plannedDate: plan.plannedDate.toISOString().slice(0, 10),
      requestedRub: plan.plannedAmount.toFixed(2),
      issuedRub: plan.oneCIssuedAmount?.toFixed(2) ?? null,
    })),
  };
}
