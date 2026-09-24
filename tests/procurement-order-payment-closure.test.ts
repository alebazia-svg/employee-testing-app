import test from 'node:test';
import assert from 'node:assert/strict';
import { orderPaymentClosure, hasCurrentPaymentClosure, hasRecordedPaymentClosure, hasRecordedPaidClosure } from '../lib/procurement-order-payment-closure';
const at = '2026-09-24T09:00:00Z';
function fixture(left = 0) {
  const dimensions = { analytics_ref:'analytics', currency_ref:'rub', settlement_object_ref:'order', settlement_document_ref:'receipt' };
  const detail: any = { ok:true, complete:true, mode:'read-only', write_operations:false, automatic_completion_allowed:false,
    contract_version:'supplier-document-evidence-v1', new_settlement_architecture:true,
    due_date_balance_scope:'exact_settlement_documents_all_history_through_as_of', receipt_source_movement_scope:'linked_receipt_registrars_all_history_through_as_of',
    due_date_movement_scope:'requested_window_exact_receipt_links_or_order_object', receipt_amount_scope:'whole_receipt_not_allocated_to_order',
    planning_links_contract:'supplier-planning-links-v1', order_links_complete:true,
    as_of:at, movement_date_from:'2026-09-01T00:00:00+03:00',
    order:[{order_ref:'order',supplier_ref:'supplier',posted:true,deleted:false}],
    order_links:[{order_ref:'order',receipt_ref:'receipt',order_supplier_ref:'supplier'}],
    receipts:[{receipt_ref:'receipt',receipt_number:'771',receipt_date:'2026-09-15T00:00:00+03:00',posted:true,currency_ref:'rub',currency_name:'руб',document_amount:5000}],
    balances:[],movements:[],receipt_source_movements:[{recorder_ref:'receipt',line_number:1,currency_ref:'rub',raw_amount:5000}],
    due_date_balances:left ? [{...dimensions,raw_debt_balance:left,raw_prepayment_balance:0}] : [],
    due_date_movements:[{...dimensions,recorder_ref:'register',line_number:1,source_recorder_ref:'receipt',movement_type:'Приход',movement_date:'2026-09-15T00:00:00+03:00',raw_debt:5000},
      {...dimensions,recorder_ref:'register',line_number:2,source_recorder_ref:'rko',movement_type:'Расход',movement_date:'2026-09-21T12:00:00+03:00',raw_debt:5000-left}],
  };
  const cash:any = {complete:true,payments:[{ref:'rko',number:'1731',date:'2026-09-21T11:00:00+03:00',posted:true,deleted:false,documentAmount:5000-left,documentCurrency:'РУБ',baseDocumentRef:'contract'}]};
  return {detail,cash};
}
test('receipt is closed only by its exact posted cash registrar; contract basis is allowed',()=>{
  const f=fixture(); const c=orderPaymentClosure(f.detail,'order',f.cash,at)!;
  assert.equal(c.state,'paid'); assert.equal(c.receipts[0].payments[0].number,'1731');
  assert.equal(c.receipts[0].payments[0].appliedRub,5000);
});
test('order basis or equal amount alone cannot close the receipt',()=>{
  const f=fixture(); f.cash.payments[0].ref='other'; f.cash.payments[0].baseDocumentRef='order';
  assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at),undefined);
});
test('small balance is not paid; threshold inclusive and partial debts remain visible',()=>{
  for(const left of [0.01,50,500]) {const f=fixture(left); const c=orderPaymentClosure(f.detail,'order',f.cash,at)!; assert.equal(c.state,'small_balance'); assert.equal(c.remainingRub,left); assert.equal(hasRecordedPaidClosure({paymentClosure:c},Date.parse(at)),false);}
  const f=fixture(500.01); assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at),undefined);
});
test('unposted, deleted, incomplete and conflicting cash data never hide orders',()=>{
  for(const mutate of [(f:any)=>f.cash.payments[0].posted=false,(f:any)=>f.cash.payments[0].deleted=true,
    (f:any)=>f.cash.complete=false,(f:any)=>f.cash.payments.push({...f.cash.payments[0],documentAmount:1})]) {
    const f=fixture();mutate(f);assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at),undefined);
  }
});
test('shared acquisition and corrections cannot be marked paid',()=>{
  const f=fixture();f.detail.order_links.push({...f.detail.order_links[0],order_ref:'other'});
  assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at),undefined);
  const g=fixture();g.detail.due_date_movements[1].raw_debt=-5000;
  assert.equal(orderPaymentClosure(g.detail,'order',g.cash,at),undefined);
});
test('stale proof stays historical without claiming freshness; new receipt invalidates closure',()=>{
  const f=fixture();const paymentClosure=orderPaymentClosure(f.detail,'order',f.cash,at)!;
  assert.equal(hasCurrentPaymentClosure({paymentClosure},Date.parse(at)),true);
  assert.equal(hasCurrentPaymentClosure({paymentClosure},Date.parse(at)+16*60000),false);
  assert.equal(hasRecordedPaymentClosure({paymentClosure},Date.parse(at)+16*60000),true);
  assert.equal(hasRecordedPaymentClosure({paymentClosure:{...paymentClosure,checkedAt:'invalid'}}),false);
  f.detail.receipts.push({...f.detail.receipts[0],receipt_ref:'new'});
  assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at),undefined);
});

function advanceFixture() {
  const f = fixture();
  f.cash.payments[0] = {...f.cash.payments[0], date:'2026-09-01T12:00:00+03:00', documentAmount:5500};
  const debtOffset = f.detail.due_date_movements[1];
  Object.assign(debtOffset, {source_recorder_ref:'receipt', movement_date:'2026-09-15T00:00:00+03:00'});
  f.detail.due_date_movements.push(
    {...debtOffset, line_number:3, settlement_document_ref:'rko', source_recorder_ref:'rko', movement_type:'Приход', movement_date:f.cash.payments[0].date, raw_debt:0, raw_prepayment:5500},
    {...debtOffset, line_number:4, settlement_document_ref:'rko', raw_debt:0, raw_prepayment:5000},
  );
  return f;
}
test('a posted cash advance closes its receipt through matching register legs and preserves excess advance',()=>{
  const f=advanceFixture(); const c=orderPaymentClosure(f.detail,'order',f.cash,at)!;
  assert.equal(c.state,'paid'); assert.equal(c.receipts[0].payments[0].method,'advance');
  assert.equal(c.receipts[0].payments[0].appliedRub,5000);
  assert.equal(c.receipts[0].payments[0].amount,5500);
  assert.equal(f.detail.due_date_movements[2].raw_prepayment,5500,'original advance is not reduced or reassigned');
  f.cash.payments[0].documentCurrency='USDT'; f.cash.payments[0].documentAmount=70;
  assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at)?.receipts[0].payments[0].appliedRub,5000,'RUB comes from the register, not an estimated FX rate');
});
test('unrelated, incomplete, duplicated or over-consumed advances cannot close a receipt',()=>{
  for(const mutate of [
    (f:any)=>f.detail.due_date_movements[3].settlement_object_ref='other-order',
    (f:any)=>f.detail.due_date_movements[3].analytics_ref='other-analytics',
    (f:any)=>f.detail.due_date_movements[3].raw_prepayment=4999,
    (f:any)=>f.detail.due_date_movements[2].raw_prepayment=4999,
    (f:any)=>f.detail.due_date_movements.splice(2,1),
    (f:any)=>f.detail.due_date_movements.push({...f.detail.due_date_movements[3]}),
    (f:any)=>f.cash.payments[0].documentAmount=4900,
    (f:any)=>f.cash.payments[0].posted=false,
    (f:any)=>f.cash.payments[0].deleted=true,
    (f:any)=>f.cash.payments[0].date='2026-09-20T00:00:00+03:00',
    (f:any)=>f.detail.due_date_movements.push({...f.detail.due_date_movements[3],line_number:5,source_recorder_ref:'another-receipt',raw_prepayment:1000}),
  ]) { const f=advanceFixture();mutate(f);assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at),undefined); }
});
test('a supplier balance or receipt self-offset alone is not proof of an advance payment',()=>{
  const f=fixture();f.detail.due_date_movements[1].source_recorder_ref='receipt';
  assert.equal(orderPaymentClosure(f.detail,'order',f.cash,at),undefined);
});
