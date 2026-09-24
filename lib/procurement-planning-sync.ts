import 'server-only';
import { createHash } from 'node:crypto';
import { readOneCRuntimeEnv } from './one-c-env';
import { moscowDateKey, parseOneCDateTime } from './one-c-date';
import { planningDiscovery } from './procurement-planning-evidence';
import { verifyPlanningOrder } from './procurement-planning-verification';
import { supplierTotalCheck } from './procurement-reconciliation-total-check';
import { fetchRawSupplierOrderFinance, normalizeSupplierOrder } from './procurement-payment-source';
import type { SupplierOrderFinanceRow, SupplierOrderFinanceSnapshot } from './procurement-payment-source';
import { fetchRawRequestOrderCatalogue } from './procurement-request-catalogue';
import { fetchSupplierCurrencyPaymentSnapshot, type SupplierCurrencyPaymentRow } from './procurement-currency-payment-source';
import { orderPaymentClosure } from './procurement-order-payment-closure';

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
    if (params.detail && (!params.date_to || params.date_to === date)) {
      const at = parseOneCDateTime(p.as_of);
      if (!at || moscowDateKey(at) !== date || Math.abs(now.getTime() - at.getTime()) > 15 * 60000) throw Error('STALE_PLANNING_SOURCE');
    }
    return p;
  };
  const suppliers = new Map<string, Promise<any>>();
  return {
    discovery: async () => planningDiscovery(await get({ detail: 'unpaid-receipts', date_to: date, limit: '1000' })),
    detail: async (ref: string, payments: SupplierCurrencyPaymentRow[] = []) => {
      const day = (n: number) => moscowDateKey(new Date(now.getTime() - n * 86400000));
      const p = await get({ detail: 'document-evidence', order_ref: ref, date_from: day(30), date_to: date, limit: '1000' });
      const receiptRefs = new Set((p.receipts || []).map((r: any) => r.receipt_ref));
      const paymentDates = new Map(payments.map(payment => [payment.ref, parseOneCDateTime(payment.date)?.getTime()]));
      const earliestEvidence = () => Math.min(
        ...(p.receipts || []).map((r: any) => parseOneCDateTime(r.receipt_date)?.getTime() ?? Infinity),
        ...(p.due_date_movements || []).filter((m: any) => receiptRefs.has(m.source_recorder_ref)
          && m.movement_type === 'Расход' && m.raw_prepayment > 0)
          .map((m: any) => paymentDates.get(m.settlement_document_ref) ?? Infinity),
      );
      // Bounded history only for the acquisitions of this order. Keep today's
      // authoritative balances; historical calls contribute movements only.
      // An advance can predate the acquisition: extend to the referenced cash
      // document, not only to the receipt date. The closure verifier still
      // refuses evidence outside this bounded payment-source window.
      for (let offset = 31; offset <= 186 && earliestEvidence() < Date.parse(`${day(offset - 1)}T00:00:00+03:00`); offset += 31) {
        const h = await get({ detail: 'document-evidence', order_ref: ref, date_from: day(offset + 30), date_to: day(offset), limit: '1000' });
        if (h.complete !== true || h.contract_version !== p.contract_version || h.order?.[0]?.order_ref !== ref
          || !Array.isArray(h.due_date_movements)) throw Error('INCOMPLETE_MOVEMENT_HISTORY');
        p.due_date_movements.push(...h.due_date_movements);
        p.movement_date_from = `${day(offset + 30)}T00:00:00+03:00`;
      }
      return p;
    },
    supplier: (ref: string, supplierRef: string) => {
      if (!suppliers.has(supplierRef)) suppliers.set(supplierRef, (async () => {
        const p = await get({ detail: 'reconciliation', order_ref: ref, date, limit: '1000' });
        const name = p.supplier?.[0]?.supplier_name;
        if (typeof name !== 'string' || p.supplier?.[0]?.supplier_ref !== supplierRef) throw Error('SUPPLIER_IDENTITY');
        const total = await get({ supplier_search: name, date_from: date, date_to: date, limit: '1000' });
        if (!supplierTotalCheck(p, total, name, date)) throw Error('SUPPLIER_TOTAL_MISMATCH');
        return p;
      })().catch(error => { suppliers.delete(supplierRef); throw error; }));
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
  const catalogue = await fetchRawRequestOrderCatalogue(now);
  const cash = await fetchSupplierCurrencyPaymentSnapshot({ from: new Date(now.getTime() - 216 * 86400000), to: now, timeoutMs: 30000 })
    .catch(() => ({ complete: false, payments: [] }));
  const discovery = await reader.discovery();
  const old = new Map(previous.rows.map(r => [r.ref, r as SyncRow]));
  const current = new Map([...raw.rows, ...catalogue.rows].map(r => [r.ref, r]));
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
      const fingerprint = createHash('sha256').update(JSON.stringify({ policy: 6, row: current.get(ref) || null,
        links: discovery.links.filter(l => l.order_ref === ref),
        supplier: discovery.balances.filter(b => b.supplier_ref === link?.order_supplier_ref),
      })).digest('hex');
      const prior = old.get(ref);
      const ttl = prior?.planningState === 'needs_review' ? 30 * 60000 : 4 * 60000;
      if (prior?.sourceFingerprint === fingerprint && now.getTime() - Date.parse(prior.verifiedAt || '') < ttl) {
        output.set(ref, prior); continue;
      }
      try {
        const detail = await reader.detail(ref, cash.payments);
        const o = detail.order?.[0];
        if (!o || o.order_ref !== ref) throw Error('ORDER_IDENTITY');
        if (!current.has(ref)) row = normalizeSupplierOrder({ ref, number: o.order_number, date: o.order_date,
          manager: o.manager_name, supplier_partner: o.supplier_name, current_state: o.status_name,
          amount: o.document_amount, order_payment_gap: 0 })!;
        if (!row) throw Error('ORDER_IDENTITY');
        const supplier = await reader.supplier(ref, o.supplier_ref);
        const verified = verifyPlanningOrder(row, discovery, detail, supplier, now.toISOString());
        const previousClosure = prior?.manager === row.manager && prior.supplierPartner === row.supplierPartner && prior.paymentClosure ? {...prior.paymentClosure, recheckPending: true} : undefined;
        const currentClosure = verified.receiptSettlement && orderPaymentClosure(detail, ref, cash, now.toISOString());
        output.set(ref, { ...verified, paymentClosure: currentClosure
          || (verified.planningState === 'needs_review' && !verified.receiptSettlement ? previousClosure : undefined), sourceFingerprint: fingerprint });
      } catch {
        if (row) output.set(ref, { ...row, receiptSettlement: undefined, noAcquisitions: undefined, paymentClosure: prior?.manager === row.manager && prior.supplierPartner === row.supplierPartner && prior.paymentClosure ? {...prior.paymentClosure, recheckPending: true} : undefined, planningState: 'needs_review',
          planningReason: 'Не удалось сверить документы с 1С; повторная оплата по заказу недоступна',
          verifiedAt: now.toISOString(), sourceFingerprint: fingerprint });
        // Missing identity must not invent ownership or silently lose coverage.
        else throw Error('DISCOVERED_ORDER_UNAVAILABLE');
      }
    }
  };
  await Promise.all([run(), run()]);
  return { rows: [...output.values()], outstandingOrderRefs: [...discovery.orders.keys()], checkedAt: now.toISOString(), complete: true, errors: [], planningVerified: true };
}

/** Recheck selection identity only. Reconciliation never blocks a request. */
export async function verifySelectedPlanningOrders(rows: SupplierOrderFinanceRow[]) {
  if (!rows.length) return rows;
  if (rows.length > 20) throw Error('SELECTION_LIMIT');
  const { fetchRequestOrderCatalogue } = await import('./procurement-request-catalogue');
  const catalogue = await fetchRequestOrderCatalogue();
  if (!catalogue.complete) throw Error('INCOMPLETE_REQUEST_CATALOGUE');
  const live = new Map(catalogue.rows.map(row => [row.ref, row]));
  const normalize = (value: string) => value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ');
  return rows.map(row => {
    const current = live.get(row.ref);
    if (!current || normalize(current.manager) !== normalize(row.manager)
      || normalize(current.supplierPartner) !== normalize(row.supplierPartner)) throw Error('ORDER_IDENTITY');
    return current;
  });
}
