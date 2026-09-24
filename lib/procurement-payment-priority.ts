type ReviewableOrder = {
  planningState?: string;
  ref: string;
  date: string;
  receiptAmount: number;
  paymentAmount: number;
  unplannedAmount: number;
  currentState?: string;
  controlGroup?: string;
};

/** Display order only: never changes balances or payment urgency signals. */
export const SMALL_ORDER_PAYMENT_BALANCE_RUB = 500;

/** Hide small order balances only from new planning, never from accounting or existing plans. */
export function ordersForNewPayment<T extends { orderPaymentGap: number; unplannedAmount: number; planningState?: string }>(orders: T[]): T[] {
  return orders.filter(order => order.planningState !== 'needs_review' && order.planningState !== 'settled' && order.orderPaymentGap > SMALL_ORDER_PAYMENT_BALANCE_RUB && order.unplannedAmount > 0.009);
}

export function sortByUnplannedAmount<T extends { unplannedAmount: number }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => b.unplannedAmount - a.unplannedAmount);
}

export function sortPaymentPickerOrders<T extends { supplierPartner: string; orderPaymentGap: number; unplannedAmount: number; ref: string }>(orders: T[]): T[] {
  const amount = (order: T) => order.ref.startsWith('debt:') ? order.unplannedAmount : order.orderPaymentGap;
  const groups = new Map<string, T[]>();
  for (const order of orders) {
    const group = groups.get(order.supplierPartner) || [];
    group.push(order);
    groups.set(order.supplierPartner, group);
  }
  return [...groups.entries()]
    .map(([supplier, rows]) => ({ supplier, rows, total: rows.reduce((sum, row) => sum + amount(row), 0) }))
    .sort((a, b) => b.total - a.total || a.supplier.localeCompare(b.supplier, 'ru'))
    .flatMap(group => [...group.rows].sort((a, b) => amount(b) - amount(a)));
}

export type ProcurementReviewOrder<T extends ReviewableOrder> = T & {
  reviewReason: string;
  reviewPriority: number;
};

function orderDateKey(value: string) {
  const ruDate = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ruDate) return `${ruDate[3]}-${ruDate[2]}-${ruDate[1]}`;
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return isoDate ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}` : "";
}

function ageInDays(value: string, todayKey: string) {
  const dateKey = orderDateKey(value);
  const orderTime = Date.parse(`${dateKey}T00:00:00.000Z`);
  const todayTime = Date.parse(`${todayKey}T00:00:00.000Z`);
  if (!Number.isFinite(orderTime) || !Number.isFinite(todayTime)) return null;
  return Math.max(0, Math.floor((todayTime - orderTime) / 86_400_000));
}

export function buildProcurementReviewQueue<T extends ReviewableOrder>(
  orders: T[],
  todayKey: string,
): ProcurementReviewOrder<T>[] {
  return orders
    .map((order) => {
      const age = ageInDays(order.date, todayKey);
      const state = (order.currentState || "").toLocaleLowerCase("ru-RU");
      const fulfilled = order.controlGroup === "fulfilled_goods_order" || state.includes("после поступления");
      const needsPrepayment = state.includes("предоплат");
      const hasReceipt = Number(order.receiptAmount || 0) > 0.009;
      const partiallyPaid = Number(order.paymentAmount || 0) > 0.009;
      const isOld = age != null && age >= 14;

      if (!order.planningState && !fulfilled && !needsPrepayment && !hasReceipt && !partiallyPaid && !isOld) return null;

      const reviewReason = order.planningState === 'receipt_debt'
        ? 'Долг по приобретению подтверждён'
        : order.planningState === 'prepayment'
          ? 'Предоплата — товар ещё не поступил'
        : fulfilled
        ? "Товар поступил — оплата не закрыта"
        : needsPrepayment
          ? "Нужна предоплата — уточните дату"
          : hasReceipt
            ? "Есть поступление — оплата не закрыта"
        : partiallyPaid
          ? "Оплачен частично"
          : "Давно создан — проверьте срок";
      const ageScore = age == null ? 0 : Math.min(30, age);
      const reviewPriority = (fulfilled ? 120 : 0) +
        (needsPrepayment ? 80 : 0) +
        (hasReceipt ? 60 : 0) +
        (partiallyPaid ? 40 : 0) +
        ageScore;

      return { ...order, reviewReason, reviewPriority };
    })
    .filter((order): order is ProcurementReviewOrder<T> => Boolean(order))
    .sort((a, b) =>
      b.reviewPriority - a.reviewPriority ||
      Number(b.unplannedAmount || 0) - Number(a.unplannedAmount || 0) ||
      a.date.localeCompare(b.date),
    );
}
