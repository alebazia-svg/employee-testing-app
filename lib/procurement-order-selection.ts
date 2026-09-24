/** Linking a request to an order is not confirmation of its outstanding debt. */
export function ordersForRequest<T extends { date?: string }>(rows: T[], today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())): T[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  const start = end - 89 * 86400000;
  return rows.filter(row => {
    const value = row.date || '';
    const ru = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
    const date = ru ? `${ru[3]}-${ru[2]}-${ru[1]}` : value.slice(0, 10);
    const time = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(time) && time >= start && time <= end;
  });
}

export function reviewRequestCondition(rows: { planningState?: string; number?: string; planningReason?: string }[], condition: string) {
  const review = rows.filter(row => row.planningState === 'needs_review');
  if (!review.length) return condition;
  const note = review.map(row => `Заказ ${row.number || '1С'}: ${row.planningReason || 'остаток требует сверки'}`).join('; ');
  return `Нужна сверка перед оплатой. Сумма указана закупщиком, не подтверждена как долг заказа. ${note}\nОснование закупщика: ${condition}`;
}
