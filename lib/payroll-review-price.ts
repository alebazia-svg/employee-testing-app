/** A stored payroll row is aggregated, not an individual sale receipt. */
export function payrollReviewPrice(rows: { revenue: number; quantity?: number }[]) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  if (!rows.length || rows.some(row => !Number.isFinite(row.quantity) || !Number.isFinite(row.revenue))) {
    return { revenue, quantity: null, average: null, reason: 'В источнике нет количества' };
  }
  const quantity = rows.reduce((sum, row) => sum + row.quantity!, 0);
  if (rows.some(row => row.quantity! <= 0 || row.revenue < 0)) {
    return { revenue, quantity, average: null, reason: 'Возврат или нулевое количество — смотрите строки' };
  }
  return { revenue, quantity, average: revenue / quantity, reason: '' };
}
