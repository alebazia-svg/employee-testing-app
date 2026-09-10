export function procurementOrderCommentText(value: string): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text;
}
