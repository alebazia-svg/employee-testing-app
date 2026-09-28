import { splitPaymentReview, buyerPaymentComment, PAYMENT_REVIEW_PREFIX } from "./procurement-buyer-comment";

/** Display only. The original condition and audit snapshots are never modified. */
export function adminPaymentComment(value: string, historical = false) {
  const parts = splitPaymentReview(value);
  if (!parts.review) return { warning: "", comment: value === "Оплата по выбранным заказам" ? "" : value };
  // Replace only exact generated phrases, retaining order references and every
  // other reason even when known and unknown reasons are present together.
  const reasons = parts.review.slice(PAYMENT_REVIEW_PREFIX.length, -"\nОснование закупщика: ".length)
    .replaceAll("Есть авансы поставщику — проверьте их зачёт перед новой предоплатой", historical ? "При согласовании были авансы поставщику." : "Есть аванс. Проверьте, учтён ли он в сумме заявки.")
    .replaceAll("По заказу нет подтверждённого приобретения; уточните основание оплаты", historical ? "Поступление товара тогда не было подтверждено." : "Поступление не подтверждено в 1С. Уточните основание оплаты.");
  return { warning: [reasons, historical ? "Сумма к оплате тогда не была подтверждена в 1С." : "Сумма к оплате в 1С пока не подтверждена."].filter(Boolean).join(" "), comment: buyerPaymentComment(value) };
}
