import 'server-only';
import { readOneCRuntimeEnv } from './one-c-env';
import { latestCnyCommentRate, type CnyCommentSource } from './procurement-planned-fx';

/** Uses the existing read-only cash document diagnostics, not a new 1C endpoint. */
export function cnyExpenseCommentSources(payload: unknown): CnyCommentSource[] {
  const root = payload as Record<string, unknown> | null;
  if (!root || root.ok !== true || !Array.isArray(root.cash_expense_orders) ||
      root.cash_expense_orders.length >= 1000 || !Array.isArray(root.source_errors) || root.source_errors.length) return [];
  return root.cash_expense_orders.flatMap((row: Record<string, unknown>) => {
    if (!row || row.document_type !== 'cash_expense_order' || row.posted !== true || row.deleted !== false ||
        !['руб', 'rub', 'руб.'].includes(String(row.currency).toLowerCase()) ||
        String(row.operation).replace(/\s/g, '').toLowerCase() !== 'оплатапоставщику' || typeof row.date !== 'string') return [];
    return [{comment: row.comment, date: row.date, sourceLabel: 'Комментарий расходника 1С', documentNumber: typeof row.number === 'string' ? row.number : undefined}];
  });
}

export async function getProcurementCnyRate(planComments: CnyCommentSource[], now = new Date()) {
  const env = readOneCRuntimeEnv();
  let expenseComments: CnyCommentSource[] = [];
  if (env.baseUrl && env.user && env.password) {
    const day = (date: Date) => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow'}).format(date);
    const query = new URLSearchParams({date_from: day(new Date(now.getTime()-120*86400000)), date_to: day(now), counterparty_search:'курс', limit:'1000'});
    try {
      const response = await fetch(`${env.baseUrl}/currency-exchange-diagnostics?${query}`, {
        headers:{Accept:'application/json', Authorization:`Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}`},
        cache:'no-store', signal:AbortSignal.timeout(15000),
      });
      if (response.ok) expenseComments = cnyExpenseCommentSources(await response.json());
    } catch { /* No guessed rate on source outage. A dated plan comment remains usable. */ }
  }
  return latestCnyCommentRate([...planComments, ...expenseComments], now);
}
