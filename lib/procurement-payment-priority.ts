import { hasRecordedPaidClosure } from './procurement-order-payment-closure';

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
export const MIN_SUGGESTED_PAYMENT_RUB = 1000;

/** Presentation only: unknown amounts and prepayments must stay discoverable. */
export function isSmallPaymentSuggestion(order: {ref: string; unplannedAmount: number; noAcquisitions?: unknown; receiptSettlement?: {debtRub: number}}) {
  if (order.noAcquisitions) return false;
  const amount = order.ref.startsWith('debt:') ? order.unplannedAmount : order.receiptSettlement?.debtRub;
  return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount < MIN_SUGGESTED_PAYMENT_RUB;
}

type BuyerArchiveOrder = {
  paymentClosure?: import('./procurement-order-payment-closure').OrderPaymentClosure;
  receiptSettlement?: import('./procurement-planning-verification').OrderReceiptSettlement;
};
/** Measured zero is not cash-payment proof. Keep both kinds in searchable history. */
export function isBuyerPaymentHistory(order: BuyerArchiveOrder): boolean {
  const e = order.receiptSettlement;
  return hasRecordedPaidClosure(order) || Boolean(e && e.debtRub === 0 && e.receipts.length
    && e.receipts.every(r => r.remainingRub === 0));
}

export function orderMissingAmountLabel(order: {noAcquisitions?: {checkedAt: string}; planningState?: string}) {
  return order.noAcquisitions ? 'Приобретений пока нет' : 'Остаток по заказу не подтверждён';
}

/** Filter suggestions only, never the evidence catalogue or existing plans. */
export function ordersForNewPayment<T extends BuyerArchiveOrder & { orderPaymentGap: number; unplannedAmount: number; planningState?: string }>(orders: T[]): T[] {
  return orders.filter(order => {
    if (isBuyerPaymentHistory(order)) return false;
    if (order.planningState === 'receipt_debt') {
      return order.orderPaymentGap > SMALL_ORDER_PAYMENT_BALANCE_RUB && order.unplannedAmount > 0.009;
    }
    return true;
  });
}

export function sortByUnplannedAmount<T extends { unplannedAmount: number }>(orders: T[]): T[] {
  return [...orders].sort((a, b) => b.unplannedAmount - a.unplannedAmount);
}

export function sortPaymentPickerOrders<T extends { supplierPartner: string; orderPaymentGap: number; unplannedAmount: number; ref: string; date?: string; planningState?: string; receiptSettlement?: {debtRub: number} }>(orders: T[]): T[] {
  const amount = (order: T) => order.ref.startsWith('debt:') ? order.unplannedAmount : order.orderPaymentGap;
  const confirmed = (order: T) => order.ref.startsWith('debt:') || order.planningState === 'receipt_debt';
  return [...orders].sort((a, b) => {
    if (!a.ref.startsWith('debt:') && !b.ref.startsWith('debt:')) {
      const aDate = orderDateKey(a.date || '');
      const bDate = orderDateKey(b.date || '');
      if (aDate || bDate) return bDate.localeCompare(aDate);
    }
    const tier = (order: T) => confirmed(order) && amount(order) > 500 ? 0
      : order.receiptSettlement && order.receiptSettlement.debtRub > 500 ? 1
      : order.planningState === 'prepayment' ? 2
      : order.receiptSettlement && order.receiptSettlement.debtRub > 0 ? 3
      : order.receiptSettlement?.debtRub === 0 ? 5 : 4;
    if (tier(a) !== tier(b)) return tier(a) - tier(b);
    return amount(b) - amount(a);
  });
}

/** A display window only, never a cutoff for debt or evidence validity. */
export function isRecentPaymentOrder(order: {date?: string}, today: string) {
  const age = ageInDays(order.date || '', today);
  return age !== null && age < 90 && orderDateKey(order.date || '') <= today;
}

export function paymentActionPriority(plan: { status: string }) {
  return plan.status === 'NEEDS_CHANGES' ? 0 : plan.status === 'SUBMITTED' ? 1 : 2;
}

/** A short numeric query matches the order suffix, never a supplier's digits. */
export function matchesPaymentOrderSearch(order: { number: string; supplierPartner: string }, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('ru-RU');
  if (!needle) return true;
  if (/^\d{1,3}$/.test(needle) && order.number) {
    return (order.number.match(/\d+$/)?.[0] || '').endsWith(needle);
  }
  return `${order.supplierPartner} ${order.number}`.toLocaleLowerCase('ru-RU').includes(needle);
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
