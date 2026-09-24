import 'server-only';
import { createHash } from 'node:crypto';
import { readOneCRuntimeEnv } from './one-c-env';
import { moscowDateKey, parseOneCDateTime } from './one-c-date';
import { planningDiscovery } from './procurement-planning-evidence';
import { verifyPlanningOrder } from './procurement-planning-verification';
import { supplierTotalCheck } from './procurement-reconciliation-total-check';
import { fetchRawSupplierOrderFinance, normalizeSupplierOrder } from './procurement-payment-source';
import type { SupplierOrderFinanceRow, SupplierOrderFinanceSnapshot } from './procurement-payment-source';

type SyncRow = SupplierOrderFinanceRow & { sourceFingerprint?: string };
export function planningReader(now = new Date(), deadlineMs = 8 * 60000) {
  const env = readOneCRuntimeEnv();
  const date = moscowDateKey(now);
  const deadline = AbortSignal.timeout(deadlineMs);
  const get = async (params: Record<string, string>) => {
    if (!env.baseUrl || !env.user || !env.password) throw Error('SOURCE_UNCONFIGURED');
    const response = await fetch(`${env.baseUrl}/supplier-settlements?${new URLSearchParams(params)}`, {
      headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}` },
      cache: 'no-store', signal: AbortSignal.any([deadline, AbortSignal.timeout(20000)]),
    });
    if (!response.ok) throw Error('PLANNING_READ_FAILED');
    const p = await response.json();
    if (params.detail) {
      const at = parseOneCDateTime(p.as_of);
      if (!at || moscowDateKey(at) !== date || Math.abs(now.getTime() - at.getTime()) > 15 * 60000) throw Error('STALE_PLANNING_SOURCE');
    }
    return p;
  };
  const suppliers = new Map<string, Promise<any>>();
  return {
    discovery: async () => planningDiscovery(await get({ detail: 'unpaid-receipts', date_to: date, limit: '1000' })),
    detail: (ref: string) => get({ detail: 'document-evidence', order_ref: ref,
      date_from: moscowDateKey(new Date(now.getTime() - 30 * 86400000)), date_to: date, limit: '1000' }),
    supplier: (ref: string, supplierRef: string) => {
      if (!suppliers.has(supplierRef)) suppliers.set(supplierRef, (async () => {
        const p = await get({ detail: 'reconciliation', order_ref: ref, date, limit: '1000' });
        const name = p.supplier?.[0]?.supplier_name;
        if (typeof name !== 'string' || p.supplier?.[0]?.supplier_ref !== supplierRef) throw Error('SUPPLIER_IDENTITY');
        const total = await get({ supplier_search: name, date_from: date, date_to: date, limit: '1000' });
        if (!supplierTotalCheck(p, total, name, date)) throw Error('SUPPLIER_TOTAL_MISMATCH');
        return p;
      })());
      return suppliers.get(supplierRef)!;
    },
  };
}

/** Background only. Pages never call this collector. Old settled records are
 * kept for history, not reloaded as the entire 1C order archive. */
export async function collectPlanningSnapshot(previous: SupplierOrderFinanceSnapshot, activeRefs: string[] = [], now = new Date()) {
  const reader = planningReader(now);
  const raw = await fetchRawSupplierOrderFinance();
  if (!raw.complete) throw Error('INCOMPLETE_FINANCE_SOURCE');
  const discovery = await reader.discovery();
  const old = new Map(previous.rows.map(r => [r.ref, r as SyncRow]));
  const current = new Map(raw.rows.map(r => [r.ref, r]));
  const refs = new Set([...current.keys(), ...discovery.orders.keys(), ...activeRefs,
    ...previous.rows.filter(r => r.planningState !== 'settled').map(r => r.ref)]);
  if (refs.size > 1000) throw Error('PLANNING_CANDIDATE_LIMIT');
  const output = new Map<string, SyncRow>(previous.rows.filter(r => r.planningState === 'settled').map(r => [r.ref, r]));
  const pending = [...refs];
  const run = async () => {
    while (pending.length) {
      const ref = pending.shift()!;
      const link = discovery.orders.get(ref);
      let row = current.get(ref) || old.get(ref);
      const fingerprint = createHash('sha256').update(JSON.stringify({ policy: 2, row: current.get(ref) || null,
        links: discovery.links.filter(l => l.order_ref === ref),
        supplier: discovery.balances.filter(b => b.supplier_ref === link?.order_supplier_ref),
      })).digest('hex');
      const prior = old.get(ref);
      const ttl = prior?.planningState === 'needs_review' ? 30 * 60000 : 4 * 60000;
      if (prior?.sourceFingerprint === fingerprint && now.getTime() - Date.parse(prior.verifiedAt || '') < ttl) {
        output.set(ref, prior); continue;
      }
      try {
        const detail = await reader.detail(ref);
        const o = detail.order?.[0];
        if (!o || o.order_ref !== ref) throw Error('ORDER_IDENTITY');
        if (!row) row = normalizeSupplierOrder({ ref, number: o.order_number, date: o.order_date,
          manager: o.manager_name, supplier_partner: o.supplier_name, current_state: o.status_name,
          amount: o.document_amount, order_payment_gap: 0 })!;
        const supplier = await reader.supplier(ref, o.supplier_ref);
        output.set(ref, { ...verifyPlanningOrder(row, discovery, detail, supplier, now.toISOString()), sourceFingerprint: fingerprint });
      } catch {
        if (row) output.set(ref, { ...row, planningState: 'needs_review',
          planningReason: 'Не удалось сверить документы с 1С; повторная оплата по заказу недоступна',
          verifiedAt: now.toISOString(), sourceFingerprint: fingerprint });
        // Missing identity must not invent ownership or silently lose coverage.
        else throw Error('DISCOVERED_ORDER_UNAVAILABLE');
      }
    }
  };
  await Promise.all([run(), run()]);
  return { rows: [...output.values()], checkedAt: now.toISOString(), complete: true, errors: [], planningVerified: true };
}

/** Called only after ownership has been checked from the snapshot. Fresh
 * selected-order verification never trusts submitted supplier names or sums. */
export async function verifySelectedPlanningOrders(rows: SupplierOrderFinanceRow[], now = new Date()) {
  if (process.env.PROCUREMENT_PLANNING_MODE !== 'snapshot' || !rows.length) return rows;
  if (rows.length > 20) throw Error('SELECTION_LIMIT');
  const reader = planningReader(now, 60000);
  const [discovery, live] = await Promise.all([reader.discovery(), fetchRawSupplierOrderFinance()]);
  if (!live.complete) throw Error('INCOMPLETE_FINANCE_SOURCE');
  const result = new Map<string, SupplierOrderFinanceRow>();
  const pending = [...rows];
  const verify = async () => { while (pending.length) {
    const row = pending.shift()!;
    const detail = await reader.detail(row.ref);
    const supplier = await reader.supplier(row.ref, detail.order?.[0]?.supplier_ref);
    const liveRow = live.rows.find(r => r.ref === row.ref);
    const checked = verifyPlanningOrder(liveRow || row, discovery, detail, supplier, now.toISOString());
    result.set(row.ref, !liveRow && checked.planningState === 'prepayment'
      ? { ...checked, planningState: 'needs_review', planningReason: 'Заказ больше не доступен для предоплаты' } : checked);
  } };
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, verify));
  return rows.map(row => result.get(row.ref)!);
}
