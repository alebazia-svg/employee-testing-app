import 'server-only';
import { readOneCRuntimeEnv } from './one-c-env';
import { normalizeManagerName } from './procurement-payment-source';

/** Same ownership rule as order selection, across ALL historical orders.
 * Not a claim that 1C maintains an exclusive current supplier assignment. */
export function supplierNamesForManager(payload: any, manager: string): string[] {
  if (payload?.ok !== true || payload.complete !== true || payload.mode !== 'read-only' || payload.write_operations !== false
    || payload.contract_version !== 'supplier-manager-roster-v1' || payload.scope !== 'posted_nondeleted_orders_all_history'
    || !Array.isArray(payload.rows)) throw Error('SUPPLIER_ROSTER_UNAVAILABLE');
  const rows = payload.rows as Record<string, string>[];
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if (rows.some(r => !uuid.test(r.manager_ref || '') || !uuid.test(r.supplier_ref || '')
    || typeof r.manager !== 'string' || !r.manager.trim() || typeof r.supplier_partner !== 'string' || !r.supplier_partner.trim())) throw Error('SUPPLIER_ROSTER_IDENTITY');
  const own = rows.filter(r => normalizeManagerName(r.manager) === normalizeManagerName(manager));
  if (new Set(own.map(r => r.manager_ref)).size > 1) throw Error('AMBIGUOUS_MANAGER');
  const names = new Map<string, string>();
  for (const r of own) {
    const key = normalizeManagerName(r.supplier_partner);
    if (names.has(key) && names.get(key) !== r.supplier_ref) throw Error('AMBIGUOUS_SUPPLIER');
    names.set(key, r.supplier_ref);
  }
  return [...new Set(own.map(r => r.supplier_partner.trim()))];
}

export async function fetchManagerSupplierNames(manager: string) {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw Error('SUPPLIER_ROSTER_UNCONFIGURED');
  const response = await fetch(`${env.baseUrl}/supplier-order-finance-control?supplier_roster=all`, {
    headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}` },
    // Production all-history reads can exceed 30s. Never replace a failed read
    // with the recent-order subset: it would silently hide older suppliers.
    cache: 'no-store', signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw Error('SUPPLIER_ROSTER_UNAVAILABLE');
  return supplierNamesForManager(await response.json(), manager);
}
