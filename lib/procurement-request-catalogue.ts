import 'server-only';
import { readOneCRuntimeEnv } from './one-c-env';
import { moscowDateKey } from './one-c-date';
import { normalizeSupplierOrder, type SupplierOrderFinanceSnapshot, type SupplierOrderFinanceRow } from './procurement-payment-source';
import { readPlanningSnapshot, PLANNING_MAX_AGE_MS } from './procurement-planning-cache';
import { ordersForRequest } from './procurement-order-selection';
import { hasRecordedPaymentClosure } from './procurement-order-payment-closure';

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
export async function fetchRawRequestOrderCatalogue(now = new Date()): Promise<SupplierOrderFinanceSnapshot> {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw Error('SUPPLIER_ORDER_SOURCE_UNCONFIGURED');
  const response = await fetch(`${env.baseUrl}/supplier-order-finance-control?catalogue_days=90&limit=1000`, {
    headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}` },
    cache: 'no-store', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`REQUEST_CATALOGUE_HTTP_${response.status}`);
  const rows = parseRequestCatalogue(await response.json(), moscowDateKey(now));
  return { rows, complete: true, checkedAt: now.toISOString(), errors: [] };
}

export async function fetchRequestOrderCatalogue(now = new Date()): Promise<SupplierOrderFinanceSnapshot> {
  const { rows } = await fetchRawRequestOrderCatalogue(now);
  return mergeRequestCatalogue(rows, await readPlanningSnapshot(now.getTime()), now);
}

/** Recent requests plus ALL discovered outstanding acquisitions, joined by UUID.
 * Never infer old debt from an order face amount, status, or stale cache row. */
export function mergeRequestCatalogue(rows: SupplierOrderFinanceRow[], finance: SupplierOrderFinanceSnapshot, now = new Date()): SupplierOrderFinanceSnapshot {
  const age = now.getTime() - Date.parse(finance.checkedAt);
  const oldRefs = finance.outstandingOrderRefs;
  const seen = new Set(rows.map(row => row.ref));
  const financialRefs = new Set(finance.rows.map(row => row.ref));
  const coverage = finance.complete && finance.errors.length === 0 && Number.isFinite(age) && age >= -60000 && age <= PLANNING_MAX_AGE_MS
    && Array.isArray(oldRefs) && new Set(oldRefs).size === oldRefs.length
    && financialRefs.size === finance.rows.length && seen.size === rows.length
    && oldRefs.every(ref => financialRefs.has(ref));
  if (!coverage) return { rows: rows.map(row => ({...row, outstandingAcquisitions: undefined, receiptSettlement: undefined, noAcquisitions: undefined,
    paymentClosure: undefined, planningState:'needs_review'})), checkedAt:finance.checkedAt,
    complete:false, planningVerified:true, errors:['OUTSTANDING_ORDER_COVERAGE_UNAVAILABLE'] };
  const outstanding = new Set(oldRefs);
  const extra = finance.rows.filter(row => outstanding.has(row.ref) && !seen.has(row.ref));
  if (extra.some(row => !row.manager || !row.supplierPartner || !row.number || !row.date
    || ordersForRequest([{...row,outstandingAcquisitions:{checkedAt:finance.checkedAt}}],moscowDateKey(now)).length !== 1)) {
    return {rows:[],checkedAt:finance.checkedAt,complete:false,planningVerified:true,errors:['OUTSTANDING_ORDER_IDENTITY_UNAVAILABLE']};
  }
  const verified = new Map(finance.complete ? finance.rows.map(row => [row.ref, row]) : []);
  const historical = new Map(finance.rows.map(row => [row.ref, row]));
  const combined = [...rows,...extra];
  // Fresh order ownership overrides a cached manager/name; never certify a mixed population.
  if (combined.some(row => outstanding.has(row.ref) && (verified.get(row.ref)?.manager !== row.manager
    || verified.get(row.ref)?.supplierPartner !== row.supplierPartner))) {
    return {rows:[],checkedAt:finance.checkedAt,complete:false,planningVerified:true,errors:['OUTSTANDING_ORDER_IDENTITY_CHANGED']};
  }
  return { complete: true, planningVerified: true, outstandingOrderRefs:oldRefs, checkedAt:finance.checkedAt, errors: [], rows: combined.map(row => {
    const evidence = verified.get(row.ref);
    const prior = historical.get(row.ref);
    const paymentClosure = prior?.manager === row.manager && prior.supplierPartner === row.supplierPartner && hasRecordedPaymentClosure(prior, now.getTime()) ? prior.paymentClosure : undefined;
    const sameIdentity = evidence?.manager === row.manager && evidence?.supplierPartner === row.supplierPartner;
    return sameIdentity && evidence ? { ...row, outstandingAcquisitions:outstanding.has(row.ref) ? {checkedAt:finance.checkedAt} : undefined,
      planningState: evidence.planningState, planningReason: evidence.planningReason,
      verifiedAt: evidence.verifiedAt, orderPaymentGap: evidence.orderPaymentGap,
      receiptSettlement: evidence.receiptSettlement,
      noAcquisitions: evidence.noAcquisitions,
      paymentClosure } : { ...row, outstandingAcquisitions:undefined, receiptSettlement:undefined, noAcquisitions:undefined, paymentClosure, planningState: 'needs_review',
      planningReason: 'Сумма заявки задаётся закупщиком; подтверждённый остаток по заказу отсутствует' };
  }) };
}
