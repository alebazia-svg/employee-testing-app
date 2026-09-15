type Row = {
  date: string;
  items: { amountMinor: number | null }[];
  safeOutMinor: number;
  cardsOutMinor: number;
  safeBeforeMinor: number | null;
  cardsBeforeMinor: number | null;
};

/** Later unknown expenses must not invalidate earlier known funding. */
export function forecastCoverageLabel(rows: Row[], date: string) {
  const throughDate = rows.filter(row => row.date <= date);
  if (throughDate.some(row => row.items.some(item => item.amountMinor === null))) {
    return "Нужна сумма выплаты";
  }
  if (throughDate.some(row => row.safeBeforeMinor === null || row.cardsBeforeMinor === null)) {
    return "Не получены остатки 1С";
  }
  if (throughDate.some(row => row.safeOutMinor + row.cardsOutMinor !== row.items.reduce((sum, item) => sum + (item.amountMinor ?? 0), 0))) {
    return "Нужно выбрать источник денег";
  }
  return "Деньги предусмотрены";
}
