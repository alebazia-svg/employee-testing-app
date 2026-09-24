import { reconcileSupplier } from './procurement-settlement-reconciliation';

type Row = Record<string, any>;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const dimensions = ['analytics_ref', 'organization_ref', 'counterparty_ref', 'contract_ref', 'currency_ref'];
const norm = (s: string) => s.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
const minor = (v: unknown) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || !Number.isSafeInteger(Math.round(v * 100))
    || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) throw Error('INVALID_AMOUNT');
  return Math.round(v * 100);
};
export function planningDiscovery(p: Row) {
  if (!p || p.ok !== true || p.complete !== true || p.balances_complete !== true || p.links_complete !== true
    || p.contract_version !== 'supplier-unpaid-receipts-v3' || p.write_operations !== false
    || p.supplier_reconciliation_required !== true || p.automatic_payment_recommendation_allowed !== false
    || p.amount_scope !== 'receipt_balance_dimensions_not_allocated_to_orders'
    || !Array.isArray(p.balances) || !Array.isArray(p.order_links)) throw Error('PLANNING_SOURCE_INCOMPLETE');
  const receipts = new Set<string>();
  const seen = new Set<string>();
  for (const row of p.balances) {
    for (const key of [...dimensions, 'receipt_ref', 'supplier_ref', 'settlement_object_ref']) {
      if (typeof row[key] !== 'string' || !uuid.test(row[key])) throw Error('INVALID_BALANCE_IDENTITY');
    }
    if (typeof row.due_date !== 'string' || typeof row.arising_date !== 'string') throw Error('INVALID_BALANCE_GRAIN');
    const key = JSON.stringify([...dimensions, 'settlement_object_ref', 'receipt_ref', 'due_date', 'arising_date'].map(k => row[k]));
    if (seen.has(key)) throw Error('DUPLICATE_BALANCE');
    seen.add(key); receipts.add(row.receipt_ref);
    minor(row.raw_debt_balance); minor(row.raw_prepayment_balance);
  }
  const pairs = new Set<string>();
  const orders = new Map<string, Row>();
  const managerNames = new Map<string, Set<string>>();
  for (const row of p.order_links) {
    for (const key of ['order_ref', 'receipt_ref', 'manager_ref', 'order_supplier_ref', 'order_counterparty_ref']) {
      if (typeof row[key] !== 'string' || !uuid.test(row[key])) throw Error('INVALID_LINK_IDENTITY');
    }
    if (!receipts.has(row.receipt_ref) || typeof row.manager_name !== 'string'
      || !row.manager_name.trim() || typeof row.order_posted !== 'boolean' || typeof row.order_deleted !== 'boolean') throw Error('INVALID_LINK');
    const pair = `${row.receipt_ref}:${row.order_ref}`;
    if (pairs.has(pair)) throw Error('DUPLICATE_LINK');
    pairs.add(pair);
    const previous = orders.get(row.order_ref);
    if (previous && ['manager_ref', 'manager_name', 'order_supplier_ref', 'order_counterparty_ref', 'order_posted', 'order_deleted']
      .some(k => previous[k] !== row[k])) throw Error('CONFLICTING_ORDER_IDENTITY');
    orders.set(row.order_ref, row);
    const owners = managerNames.get(norm(row.manager_name)) ?? new Set<string>();
    owners.add(row.manager_ref); managerNames.set(norm(row.manager_name), owners);
  }
  return { balances: p.balances as Row[], links: p.order_links as Row[], orders,
    ambiguousManagers: new Set([...managerNames].filter(([, refs]) => refs.size !== 1).map(([name]) => name)) };
}

/** Strict payable candidate, never authority to close a request. No name-based netting. */
export function verifiedOrderDebt(discovery: ReturnType<typeof planningDiscovery>, orderRef: string, detail: Row, supplier: Row, minimumDebtMinor = 50000) {
  const link = discovery.orders.get(orderRef);
  if (!link || !link.order_posted || link.order_deleted || discovery.ambiguousManagers.has(norm(link.manager_name))) return null;
  if (detail?.ok !== true || detail.complete !== true || detail.write_operations !== false
    || detail.planning_links_contract !== 'supplier-planning-links-v1' || detail.order_links_complete !== true
    || detail.order_links_scope !== 'all_header_and_goods_order_links_for_returned_receipts'
    || !Array.isArray(detail.order) || detail.order.length !== 1 || !Array.isArray(detail.receipts)
    || !Array.isArray(detail.order_links)) return null;
  const order = detail.order[0];
  if (order.order_ref !== orderRef || order.manager_ref !== link.manager_ref || order.supplier_ref !== link.order_supplier_ref
    || order.posted !== true || order.deleted !== false || norm(order.manager_name || '') !== norm(link.manager_name)) return null;
  const reconciliation = reconcileSupplier(supplier, link.order_supplier_ref);
  // Any supplier advance can represent a historical payment not yet allocated.
  if (reconciliation.state !== 'available' || reconciliation.buckets.some(b => b.advanceMinor > 0)) return null;
  const receipts = new Set<string>();
  for (const receipt of detail.receipts) {
    if (receipts.has(receipt.receipt_ref) || receipt.posted !== true) return null;
    receipts.add(receipt.receipt_ref);
    const links = detail.order_links.filter((l: Row) => l.receipt_ref === receipt.receipt_ref);
    if (links.length !== 1 || links[0].order_ref !== orderRef || links[0].order_supplier_ref !== order.supplier_ref) return null;
  }
  const selected = discovery.balances.filter(r => receipts.has(r.receipt_ref));
  if (!selected.length) return null;
  const scopes = new Set<string>();
  let debtMinor = 0;
  for (const row of selected) {
    if (row.supplier_ref !== order.supplier_ref || row.counterparty_ref !== link.order_counterparty_ref
      || row.contract_ref === '00000000-0000-0000-0000-000000000000'
      || !['руб', 'rub', '₽', 'российский рубль'].includes(norm(row.currency_name || ''))
      || minor(row.raw_prepayment_balance) !== 0) return null;
    const otherLinks = discovery.links.filter(l => l.receipt_ref === row.receipt_ref);
    if (otherLinks.length !== 1 || otherLinks[0].order_ref !== orderRef) return null;
    const matches = supplier.document_balances.filter((r: Row) => dimensions.every(k => r[k] === row[k])
      && r.settlement_object_ref === row.settlement_object_ref && r.settlement_document_ref === row.receipt_ref
      && r.due_date === row.due_date && r.arising_date === row.arising_date);
    if (matches.length !== 1 || minor(matches[0].raw_debt_balance) !== minor(row.raw_debt_balance)
      || minor(matches[0].raw_prepayment_balance) !== 0) return null;
    scopes.add(JSON.stringify(dimensions.map(k => row[k])));
    debtMinor += minor(row.raw_debt_balance);
  }
  if (scopes.size !== 1 || !Number.isSafeInteger(debtMinor) || debtMinor <= minimumDebtMinor) return null;
  if (typeof order.supplier_name !== 'string' || !order.supplier_name.trim() || typeof order.order_number !== 'string') return null;
  return { debtMinor, order };
}
