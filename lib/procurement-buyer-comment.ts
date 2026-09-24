/** Compatibility boundary for the exact review envelope already stored in condition.
 * Unknown free text is never parsed heuristically or deleted. ADMIN retains the
 * original envelope; buyer views show only the buyer's part. No data migration. */
export const PAYMENT_REVIEW_PREFIX = 'Нужна сверка перед оплатой. Сумма указана закупщиком, не подтверждена как долг заказа. ';
const marker = '\nОснование закупщика: ';
export function splitPaymentReview(value: string) {
  const at = value.indexOf(marker);
  return value.startsWith(PAYMENT_REVIEW_PREFIX) && at >= PAYMENT_REVIEW_PREFIX.length
    ? { review: value.slice(0, at + marker.length), comment: value.slice(at + marker.length) }
    : { review: '', comment: value };
}
export function buyerPaymentComment(value: string) {
  let current = value;
  for (;;) {
    const parts = splitPaymentReview(current);
    if (!parts.review) break;
    current = parts.comment;
  }
  return ['Оплата по выбранным заказам', 'В счёт долга поставщику'].includes(current) ? '' : current;
}
export function preservePaymentReview(previous: string, incoming: string) {
  if (splitPaymentReview(incoming).review) return incoming;
  const review = splitPaymentReview(previous).review;
  return review ? review + incoming : incoming;
}
