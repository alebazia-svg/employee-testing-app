import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequestCatalogue } from '../lib/procurement-request-catalogue';

const row = { ref: 'order', date: '2026-09-24 12:00:00', number: '000F-000397', manager: 'Астемир', supplier_partner: 'Поставщик', current_state: 'Закрыт', order_payment_gap: 0 };
const payload = () => ({ ok: true, request_catalogue_contract: 'supplier-request-catalogue-v1', catalogue_complete: true,
  date_from: '2026-06-27', date_to: '2026-09-24', catalogue_total_count: 1, request_orders: [{ ...row }] });
test('catalogue accepts closed zero-balance orders; it is not a debt filter', () => {
  assert.equal(parseRequestCatalogue(payload(), '2026-09-24')[0].ref, 'order');
});
test('old API, partial responses, missing identities, duplicates and wrong dates cannot masquerade as complete', () => {
  for (const patch of [
    { request_catalogue_contract: undefined }, { catalogue_complete: false }, { catalogue_total_count: 2 },
    { date_to: '2026-09-23' }, { request_orders: [{ ...row, manager: '' }] },
    { request_orders: [{ ...row, date: '2026-06-26' }] },
    { catalogue_total_count: 2, request_orders: [row, row] },
  ]) assert.throws(() => parseRequestCatalogue({ ...payload(), ...patch }, '2026-09-24'));
});
