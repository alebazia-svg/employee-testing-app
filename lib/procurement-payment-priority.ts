type ReviewableOrder = {
  ref: string;
  date: string;
  receiptAmount: number;
  paymentAmount: number;
  unplannedAmount: number;
  currentState?: string;
  controlGroup?: string;
};

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

      if (!fulfilled && !needsPrepayment && !hasReceipt && !partiallyPaid && !isOld) return null;

      const reviewReason = fulfilled
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
