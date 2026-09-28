import type { DeliveryFunding } from './procurement-delivery-funding';
import { DELIVERY_MAX_AGE_MS } from './procurement-delivery-policy';

export function parseDeliveryFundingAmount(value: string): number | null {
  const normalized = value.trim().replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized), cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents / 100 : null;
}

type Cashbox = DeliveryFunding['cashboxes'][number];
export type DeliveryCashboxChoice = {
  state: 'ready' | 'invalid_amount' | 'stale' | 'existing_request' | 'no_cashboxes' | 'insufficient' | 'unknown';
  candidates: Cashbox[];
  selected: Cashbox | null;
  preliminary: boolean;
};

/** A read-only suggestion, never a reservation, approval or proof of spendable cash.
 * The caller supplies only explicitly mapped manager cashboxes. Known allocated
 * obligations (including unapproved ones) are conservatively protected. Unknown
 * obligations exclude that cashbox; unallocated organization plans remain a caveat.
 */
export function chooseDeliveryCashbox(data: DeliveryFunding, amount: number | null, now = Date.now()): DeliveryCashboxChoice {
  const empty = (state: DeliveryCashboxChoice['state']): DeliveryCashboxChoice => ({ state, candidates: [], selected: null, preliminary: false });
  const age = now - Date.parse(data.checkedAt);
  if (!Number.isFinite(age) || age < -60_000 || age > DELIVERY_MAX_AGE_MS) return empty('stale');
  if (data.topups.length) return empty('existing_request');
  if (amount === null || !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))
    || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001) return empty('invalid_amount');
  if (!data.cashboxes.length) return empty('no_cashboxes');
  const validMoney = (n: number) => Number.isFinite(n) && Number.isSafeInteger(Math.round(n * 100));
  const known = data.cashboxes.filter(b => validMoney(b.balance) && b.pending !== null && validMoney(b.pending) && b.pending >= 0);
  const candidates = known.filter(b => Math.round(b.balance * 100) - Math.round(b.pending! * 100) >= Math.round(amount * 100))
    .sort((a, b) => b.balance - a.balance || a.ref.localeCompare(b.ref));
  if (!candidates.length) return empty(known.length < data.cashboxes.length ? 'unknown' : 'insufficient');
  return { state: 'ready', candidates, selected: candidates[0],
    preliminary: data.unassignedCount > 0 || data.reviewCount > 0 || known.length < data.cashboxes.length };
}
