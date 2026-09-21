type DraftAmount = { paymentMethod: string; plannedAmount: string; foreignAmount: string };
const positive = (value: string) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

/** Draft display only: never reserves funds or changes saved plan amounts. */
export function summarizeDraftUsdt(rows: DraftAmount[], rate: number | null) {
  const entries = rows.filter(row => row.paymentMethod === 'USDT');
  const validRate = rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
  const exactUsdt = entries.reduce((sum, row) => sum + positive(row.foreignAmount), 0);
  const rubleOnly = entries.filter(row => !positive(row.foreignAmount));
  const rublesAwaitingUsdt = rubleOnly.reduce((sum, row) => sum + positive(row.plannedAmount), 0);
  const incomplete = entries.some(row => !positive(row.plannedAmount) && !positive(row.foreignAmount));
  // Exact foreign amount wins for the display estimate; a typed ruble amount
  // is a separate reference, not a second payment.
  const estimatedRubles = incomplete || (exactUsdt > 0 && !validRate)
    ? null : rublesAwaitingUsdt + exactUsdt * (validRate || 0);
  const requiredUsdt = incomplete || (rublesAwaitingUsdt > 0 && !validRate)
    ? null : exactUsdt + (validRate ? rublesAwaitingUsdt / validRate : 0);
  return { count: entries.length, exactUsdt, rublesAwaitingUsdt, estimatedRubles, requiredUsdt, incomplete };
}
