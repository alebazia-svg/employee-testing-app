import type { OneCCheck, MatchingItem } from './terminal-fiscal-matching';
import { normalizeOneCDateTime } from './terminal-fiscal-one-c-adapter';

type Json = Record<string, unknown>;
const object = (v: unknown): Json => v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown) => typeof v === 'string' ? v.trim() : '';
const money = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : NaN;
export type AcquiringOrder = {
  ref: string; number: string; dateTime: string; totalKopecks: number;
  items: MatchingItem[];
};
type ReadJson = (path: string) => Promise<unknown>;

// Only explicit payment-basis references qualify. Same-amount candidates are
// deliberately ignored; an order does not establish employee/cashier identity.
export async function enrichAcquiringOrders(
  checks: OneCCheck[], input: { fromDate: string; toDate: string }, read: ReadJson,
): Promise<{ data: OneCCheck[]; complete: boolean }> {
  if (!checks.length) return { data: checks, complete: true };
  const data = checks.map(c => ({ ...c }));
  const orderCache = new Map<string, Promise<unknown>>();
  let complete = true;
  for (const terminal of new Set(checks.map(c => c.cardPayments[0]?.acquiringTerminalRef))) {
    const selected = data.filter(c => c.cardPayments[0]?.acquiringTerminalRef === terminal);
    try {
      const query = new URLSearchParams({
        date_from: input.fromDate, date_to: input.toDate, sources: 'card_operation',
        organization_ref: '1c2d6c5c-251f-11ec-ac9f-0025901e48ee', terminal_refs: terminal ?? '', limit: '100',
      });
      const events: Json[] = [];
      let cursor = '';
      const seen = new Set<string>();
      for (let page = 0; ; page++) {
        if (page >= 100 || seen.has(cursor)) throw new Error('INCOMPLETE_SETTLEMENT_PAGES');
        seen.add(cursor);
        if (cursor) query.set('cursor', cursor);
        const root = object(await read(`/sale-settlement-links?${query}`));
        if (root.ok !== true || object(root.completeness).complete !== true || !Array.isArray(root.events)) throw new Error('INCOMPLETE_SETTLEMENT');
        events.push(...root.events.map(object));
        if (root.has_more === false) break;
        cursor = text(root.next_cursor);
        if (!cursor) throw new Error('MISSING_SETTLEMENT_CURSOR');
      }
      for (const check of selected) {
        const number = check.sourceRef.match(/Эквайринговая операция\s+([^\s|]+)/u)?.[1];
        const matches = events.filter(e => e.number === number && normalizeOneCDateTime(text(e.date)) === check.dateTime
          && e.terminal_ref === terminal && money(e.amount) === check.electronicKopecks);
        if (matches.length !== 1) throw new Error('ACQUIRING_DOCUMENT_NOT_UNIQUE');
        const event = matches[0];
        if (event.posted !== true || event.deleted !== false || event.organization_ref !== '1c2d6c5c-251f-11ec-ac9f-0025901e48ee'
          || !text(event.document_ref)) throw new Error('INVALID_ACQUIRING_DOCUMENT');
        const evidence = object(event.settlement_evidence);
        if (evidence.complete !== true || evidence.payment_details_complete !== true || evidence.root_fields_complete !== true
          || array(evidence.errors).length) throw new Error('INCOMPLETE_PAYMENT_BASIS');
        check.acquiringOrderState = 'unlinked';
        const links = array(event.direct_links).map(object).filter(l => l.relation === 'payment_basis'
          && l.target_type === 'Заказ клиента' && l.match_type === 'direct' && l.evidence === 'explicit_1c_reference');
        if (!links.length) continue;
        const details = array(evidence.payment_details).map(object);
        if (links.length !== 1 || details.length !== 1 || money(details[0].amount) !== check.electronicKopecks
          || object(details[0].payment_basis).ref !== links[0].target_ref) {
          check.acquiringOrderState = 'ambiguous'; continue;
        }
        const ref = text(links[0].target_ref), partner = text(event.partner_ref);
        if (!ref || !partner) throw new Error('MISSING_ORDER_SCOPE');
        const key = `${partner}|${ref}`;
        if (!orderCache.has(key)) orderCache.set(key, read(`/portal/customer-order?${new URLSearchParams({ order_ref: ref, partner_ref: partner })}`));
        const root = object(await orderCache.get(key));
        const header = object(root.header), lines = array(root.lines).map(object);
        if (root.ok !== true || root.partner_ref !== partner || header.order_ref !== ref || header.posted !== true
          || header.currency !== 'руб'
          || root.lines_truncated !== false || root.line_count !== lines.length || !lines.length) throw new Error('INCOMPLETE_ORDER');
        const items = lines.map(l => ({
          name: [text(l.product_name), text(l.characteristic)].filter(Boolean).join(' '),
          quantity: typeof l.quantity === 'number' ? l.quantity : NaN,
          priceKopecks: money(l.price), sumKopecks: money(l.amount),
        }));
        const total = money(header.amount);
        if (!text(header.order_number) || !text(header.order_date) || !Number.isFinite(Date.parse(text(header.order_date)))
          || lines.some(l => l.cancelled !== false || !text(l.product_name) || !text(l.product_ref))
          || items.some(i => !Number.isFinite(i.quantity) || i.quantity <= 0 || !Number.isSafeInteger(i.priceKopecks)
            || i.priceKopecks <= 0 || !Number.isSafeInteger(i.sumKopecks) || i.sumKopecks <= 0
            || Math.round(i.quantity * i.priceKopecks) !== i.sumKopecks)
          || !Number.isSafeInteger(total) || items.reduce((n, i) => n + i.sumKopecks, 0) !== total) throw new Error('INVALID_ORDER_LINES');
        check.acquiringOrder = { ref, number: text(header.order_number), dateTime: text(header.order_date), totalKopecks: total, items };
        check.acquiringOrderState = 'complete';
      }
    } catch {
      complete = false;
      for (const check of selected) { delete check.acquiringOrder; check.acquiringOrderState = 'unavailable'; }
    }
  }
  return { data, complete };
}
