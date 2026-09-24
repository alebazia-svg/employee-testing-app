import 'server-only';
import { readOneCRuntimeEnv } from './one-c-env';
import { moscowDateKey } from './one-c-date';
import { normalizeSupplierOrder, type SupplierOrderFinanceSnapshot, type SupplierOrderFinanceRow } from './procurement-payment-source';
import { readPlanningSnapshot } from './procurement-planning-cache';
import { ordersForRequest } from './procurement-order-selection';

export function parseRequestCatalogue(payload: any, today: string): SupplierOrderFinanceRow[] {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 89 * 86400000).toISOString().slice(0, 10);
  if (payload?.ok !== true || payload.request_catalogue_contract !== 'supplier-request-catalogue-v1'
    || payload.catalogue_complete !== true || payload.date_from !== from || payload.date_to !== today
    || !Array.isArray(payload.request_orders) || payload.catalogue_total_count !== payload.request_orders.length) {
    throw Error('REQUEST_CATALOGUE_INCOMPLETE_OR_NOT_INSTALLED');
  }
  const rows = payload.request_orders.map(normalizeSupplierOrder) as (SupplierOrderFinanceRow | null)[];
  if (rows.some(row => !row || !row.manager || !row.supplierPartner || !row.number)) throw Error('REQUEST_CATALOGUE_IDENTITY');
  const valid = rows as SupplierOrderFinanceRow[];
  if (new Set(valid.map(row => row.ref)).size !== valid.length || ordersForRequest(valid, today).length !== valid.length) throw Error('REQUEST_CATALOGUE_SCOPE');
  return valid;
}

/** Request selection is independent of debt reconciliation. Never used by the
 * administrator's forecasts, payment evidence or automatic recommendations. */
export async function fetchRequestOrderCatalogue(now = new Date()): Promise<SupplierOrderFinanceSnapshot> {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw Error('SUPPLIER_ORDER_SOURCE_UNCONFIGURED');
  const response = await fetch(`${env.baseUrl}/supplier-order-finance-control?catalogue_days=90&limit=1000`, {
    headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}` },
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`REQUEST_CATALOGUE_HTTP_${response.status}`);
  const rows = parseRequestCatalogue(await response.json(), moscowDateKey(now));
  const finance = await readPlanningSnapshot();
  const verified = new Map(finance.complete ? finance.rows.map(row => [row.ref, row]) : []);
  return { complete: true, planningVerified: true, checkedAt: now.toISOString(), errors: [], rows: rows.map(row => {
    const evidence = verified.get(row.ref);
    const sameIdentity = evidence?.manager === row.manager && evidence?.supplierPartner === row.supplierPartner;
    return sameIdentity && evidence ? { ...row, planningState: evidence.planningState, planningReason: evidence.planningReason,
      verifiedAt: evidence.verifiedAt, orderPaymentGap: evidence.orderPaymentGap } : { ...row, planningState: 'needs_review',
      planningReason: 'Сумма заявки задаётся закупщиком; подтверждённый остаток по заказу отсутствует' };
  }) };
}
