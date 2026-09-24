/** Display policy only. Age, supplier net balance and 1C order status are
 * deliberately NOT evidence of payment. No balances are changed here. */
export const PROCUREMENT_WORKING_DAYS = 90;

type WorkingOrder = { ref: string; date?: string; controlGroup?: string; orderPaymentGap: number };

function day(value: string | undefined): number | null {
  const raw = value?.trim() || '';
  const ru = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s|$)/);
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s|$)/);
  const key = ru ? `${ru[3]}-${ru[2]}-${ru[1]}` : iso?.[1];
  if (!key) return null;
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === key ? time : null;
}

export function procurementWorkingOrders<T extends WorkingOrder>(
  orders: readonly T[], today: string, activeOrderRefs: readonly string[] = [],
) {
  const now = day(today);
  const active = new Set(activeOrderRefs);
  const working: T[] = [], historical: T[] = [], small: T[] = [];
  for (const order of orders) {
    // An unfinished request remains visible even after its source balance falls.
    if (active.has(order.ref)) { working.push(order); continue; }
    if (Number.isFinite(order.orderPaymentGap) && order.orderPaymentGap <= 500) {
      small.push(order); continue;
    }
    const created = day(order.date);
    // Missing/invalid dates must never silently remove a live order.
    if (now === null || created === null || created >= now - PROCUREMENT_WORKING_DAYS * 86400000
      || order.controlGroup === 'verified_receipt_debt') working.push(order);
    else historical.push(order);
  }
  return { working, historical, small };
}
