export function procurementOrderCommentText(value: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text;
}

/** Payment-form presentation only; the original 1C comment remains unchanged. */
export function procurementPaymentCommentText(value: string): string {
  return procurementOrderCommentText(String(value || '').split(/\r?\n/)
    .filter(line => !/^\s*Мегапрайс\s*[-–—]\s*помощник\s+закупок[.!]?\s*$/i.test(line))
    .join('\n'));
}
