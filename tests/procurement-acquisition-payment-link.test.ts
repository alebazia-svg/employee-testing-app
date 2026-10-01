import test from 'node:test';
import assert from 'node:assert/strict';
import {attachSettlementOrderLinks} from '../lib/procurement-settlement-payment-link';
import {matchProcurementPaymentEvidence} from '../lib/procurement-currency-payment-evidence';
import {paymentFingerprint} from '../lib/procurement-manual-payment-links';

const now=new Date('2026-10-01T12:00:00Z');
const payment={ref:'rko',number:'1800-test',date:'01.10.2026 14:26:05',posted:true,deleted:false,
  documentAmount:42500,documentCurrency:'РУБ',baseDocumentRef:'',supplier:'Supplier'};
const detail=(order:string,amount:number)=>({ok:true,complete:true,write_operations:false,
  contract_version:'supplier-document-evidence-v1',as_of:now.toISOString(),
  order:[{order_ref:order,supplier_name:'Supplier',posted:true,deleted:false}],
  receipts:[{receipt_ref:`receipt-${order}`,posted:true}],due_date_movements:[{
    recorder_ref:`register-${order}`,line_number:2,source_recorder_ref:'rko',settlement_document_ref:`receipt-${order}`,
    settlement_object_ref:order,movement_date:payment.date,movement_type:'Расход',raw_debt:amount,raw_prepayment:0,currency_name:'руб',
  }]});
const details=[detail('o303',12500),detail('o347',18000),detail('o379',12000)];
const plan={id:'plan',planCode:'PAY-TEST',supplierPartner:'Supplier',supplierCounterparty:'',orderRefs:['o303','o347','o379'],
  plannedAmount:42500,paymentMethod:'ACCOUNTABLE_QR',status:'APPROVED',createdAt:'2026-09-25T00:00:00Z'};
const linked=(ds=details,p=payment)=>attachSettlementOrderLinks([p],ds,now);
const match=(ps=[plan],ds=details,p=payment)=>matchProcurementPaymentEvidence(ps,[],linked(ds,p),[]);

test('one RUB RKO pays acquisitions of three orders in one portal request exactly once',()=>{
  const p=linked()[0];assert.deepEqual(p.settlementOrderRefs,plan.orderRefs);assert.equal(paymentFingerprint(p),paymentFingerprint(payment));
  const e=matchProcurementPaymentEvidence([plan],[],[p,p],[]).get('plan')!;
  assert.equal(e.state,'ISSUED_BY_ONE_C');assert.equal(e.issuedAmount,42500);assert.equal(e.remainingAmount,0);assert.equal(e.cashOrders.length,1);
});
test('one acquisition order and several RKOs are supported without guessing',()=>{
  const p=linked([detail('o303',42500)])[0];
  assert.equal(matchProcurementPaymentEvidence([{...plan,orderRefs:['o303']}],[],[p],[]).get('plan')!.remainingAmount,0);
  const first={...p,ref:'first',date:'30.09.2026 12:00:00',documentAmount:10000};
  const second={...p,documentAmount:32500};
  assert.equal(matchProcurementPaymentEvidence([{...plan,orderRefs:['o303']}],[],[first,second],[]).get('plan')!.issuedAmount,42500);
});
test('partial payment leaves the actual residual and does not close the plan',()=>{
  const e=match([{...plan,plannedAmount:50000}]).get('plan')!;
  assert.equal(e.state,'PARTIALLY_ISSUED');assert.equal(e.remainingAmount,7500);
});
test('unread orders, duplicate movements, conflicting amounts and unknown receipts never prove the whole RKO',()=>{
  for(const ds of [details.slice(0,2),[...details,details[0]],
    [detail('o303',12499),...details.slice(1)],
    [{...details[0],receipts:[]},...details.slice(1)],
    [{...details[0],receipts:[{receipt_ref:'receipt-o303',posted:false}]},...details.slice(1)]]){
    assert.equal(linked(ds)[0].settlementOrderRefs,undefined);
    assert.equal(match([plan],ds).get('plan')!.issuedAmount,0);
  }
});
test('same-sum but wrong movement kind, time, currency, supplier or order is not evidence',()=>{
  for(const patch of [{movement_type:'Приход'},{raw_prepayment:1},{raw_debt:NaN},{currency_name:'USD'},
    {movement_date:'01.10.2026 14:26:06'},{settlement_object_ref:'other'},{line_number:undefined},{recorder_ref:''}]){
    const ds=[{...details[0],due_date_movements:[{...details[0].due_date_movements[0],...patch}]},...details.slice(1)];
    assert.equal(linked(ds as typeof details)[0].settlementOrderRefs,undefined);
  }
  assert.equal(linked([{...details[0],order:[{...details[0].order[0],supplier_name:'Other'}]},...details.slice(1)])[0].settlementOrderRefs,undefined);
});
test('unposted/deleted/changed documents and stale derived links cannot keep a request closed',()=>{
  for(const patch of [{posted:false},{deleted:true},{documentAmount:42501},{documentCurrency:'USDT'}]){
    assert.equal(linked(details,{...payment,...patch})[0].settlementOrderRefs,undefined);
  }
  assert.equal(attachSettlementOrderLinks(linked(),[],now)[0].settlementOrderRefs,undefined);
  assert.throws(()=>linked([{...details[0],complete:false},...details.slice(1)]),/INCOMPLETE/);
});
test('multiple plans or partial order coverage remain for review; never assign the whole RKO to each',()=>{
  for(const plans of [[plan,{...plan,id:'other'}],[plan,{...plan,id:'other',orderRefs:['o303']}],
    [{...plan,orderRefs:['o303']},{...plan,id:'other',orderRefs:['o347','o379']}],[{...plan,orderRefs:['o303']}]] ){
    const e=match(plans);for(const row of e.values()){assert.equal(row.issuedAmount,0);assert.equal(row.state,'NEEDS_REVIEW');}
  }
  for(const patch of [{supplierPartner:'Other'},{createdAt:'2026-10-02T00:00:00Z'},{status:'SUBMITTED'}]){
    assert.equal(match([{...plan,...patch}]).get('plan')!.issuedAmount,0);
  }
});
