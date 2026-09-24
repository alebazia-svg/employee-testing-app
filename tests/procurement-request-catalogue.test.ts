import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequestCatalogue, mergeRequestCatalogue } from '../lib/procurement-request-catalogue';
import {normalizeSupplierOrder} from '../lib/procurement-payment-source';
import {ordersForRequest} from '../lib/procurement-order-selection';

const row = { ref: 'order', date: '2026-09-24 12:00:00', number: '000F-000397', manager: 'Астемир', supplier_partner: 'Поставщик', current_state: 'Закрыт', order_payment_gap: 0 };
const payload = () => ({ ok: true, request_catalogue_contract: 'supplier-request-catalogue-v1', catalogue_complete: true,
  date_from: '2026-06-27', date_to: '2026-09-24', catalogue_total_count: 1, request_orders: [{ ...row }] });
test('catalogue accepts closed zero-balance orders; it is not a debt filter', () => {
  assert.equal(parseRequestCatalogue(payload(), '2026-09-24')[0].ref, 'order');
});

const now=new Date('2026-09-25T09:00:00Z');
const financeRow=(ref:string,date:string)=>normalizeSupplierOrder({...row,ref,date})!;
function mergedFixture(){
  const recent=financeRow('recent','2026-09-25');
  const old={...financeRow('old','2023-10-28'),planningState:'needs_review' as const,planningReason:'Остаток требует сверки'};
  const paid={...financeRow('paid','2024-01-01'),planningState:'settled' as const};
  return {recent:[recent],finance:{rows:[recent,old,paid],checkedAt:now.toISOString(),complete:true,errors:[],outstandingOrderRefs:['recent','old']}};
}
test('all-history discovery adds old debt once, retains ambiguous debt without inventing money and excludes old paid/prepayment history',()=>{
  const f=mergedFixture(),before=JSON.stringify(f);
  const merged=mergeRequestCatalogue(f.recent,f.finance,now);
  assert.equal(merged.complete,true);
  assert.deepEqual(merged.rows.map(r=>r.ref),['recent','old']);
  assert.deepEqual(ordersForRequest(merged.rows,'2026-09-25').map(r=>r.ref),['recent','old']);
  assert.equal(merged.rows[1].receiptSettlement,undefined);
  assert.equal(merged.rows[1].planningState,'needs_review');
  assert.ok(merged.rows[1].outstandingAcquisitions);
  assert.equal(JSON.stringify(f),before);
  f.finance.outstandingOrderRefs=['recent'];
  assert.deepEqual(mergeRequestCatalogue(f.recent,f.finance,now).rows.map(r=>r.ref),['recent'],'settled/disappeared old balances leave new selection');
});
test('missing, stale, duplicate, truncated or incomplete old-debt coverage cannot silently become recent-only success',()=>{
  for(const mutate of [
    (f:any)=>delete f.finance.outstandingOrderRefs,
    (f:any)=>f.finance.outstandingOrderRefs.push('missing'),
    (f:any)=>f.finance.outstandingOrderRefs.push('old'),
    (f:any)=>f.finance.rows.push(f.finance.rows[0]),
    (f:any)=>f.recent.push(f.recent[0]),
    (f:any)=>f.finance.complete=false,
    (f:any)=>f.finance.checkedAt='2026-09-25T08:00:00Z',
    (f:any)=>f.finance.checkedAt='2026-09-25T10:00:00Z',
    (f:any)=>f.finance.errors=['PARTIAL'],
    (f:any)=>f.finance.rows[1].manager='',
    (f:any)=>f.finance.rows[1].date='2027-01-01',
    (f:any)=>f.finance.rows[1].date='invalid',
    (f:any)=>f.recent[0]={...f.recent[0],manager:'Другой'},
  ]) {const f=mergedFixture();mutate(f);assert.equal(mergeRequestCatalogue(f.recent,f.finance,now).complete,false);}
});
test('a fully covered empty discovery does not invent old debts',()=>{
  const f=mergedFixture();f.finance.outstandingOrderRefs=[];
  const result=mergeRequestCatalogue(f.recent,f.finance,now);
  assert.equal(result.complete,true);assert.deepEqual(result.rows.map(r=>r.ref),['recent']);
  assert.equal(result.rows[0].outstandingAcquisitions,undefined);
});
test('old API, partial responses, missing identities, duplicates and wrong dates cannot masquerade as complete', () => {
  for (const patch of [
    { request_catalogue_contract: undefined }, { catalogue_complete: false }, { catalogue_total_count: 2 },
    { date_to: '2026-09-23' }, { request_orders: [{ ...row, manager: '' }] },
    { request_orders: [{ ...row, date: '2026-06-26' }] },
    { catalogue_total_count: 2, request_orders: [row, row] },
  ]) assert.throws(() => parseRequestCatalogue({ ...payload(), ...patch }, '2026-09-24'));
});
