import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasConfirmedReceiptPayment, needsReceiptSinceRollout, receiptPaymentAmount} from '../lib/procurement-receipt-policy';
import {isFinishedPaymentState} from '../lib/procurement-small-remainder';
import {matchProcurementPaymentEvidence, type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';

// Synthetic regression of a materially underpaid transfer, not a live Luxo row.
const partial = {
  status:'APPROVED', paymentMethod:'ACCOUNTABLE_QR', plannedAmount:'100000', createdAt:'2026-10-12',
  evidence:{state:'PARTIALLY_ISSUED', verification:'current', issuedAmount:20000,
    paidAmount:0, paidForeignAmount:0, remainingAmount:80000,
    cashOrders:[{ref:'test-rko',number:'TEST-01',date:'16.10.2026 12:00:00'}]},
};
test('a large partial payment needs a receipt without completing or changing its request',()=>{
  const before=JSON.stringify(partial);
  assert.equal(hasConfirmedReceiptPayment(partial),true);
  assert.equal(needsReceiptSinceRollout(partial,0),true);
  assert.equal(isFinishedPaymentState(partial.evidence.state),false);
  assert.equal(receiptPaymentAmount(partial),'20 000 ₽');
  assert.equal(JSON.stringify(partial),before);
});
test('partial and full reconciled cash/foreign payments are eligible regardless of remainder size',()=>{
  for(const state of ['PARTIALLY_ISSUED','PARTIALLY_PAID_BY_ONE_C','ISSUED_BY_ONE_C','PAID_BY_ONE_C','SMALL_REMAINDER_COMPLETED']) {
    assert.equal(hasConfirmedReceiptPayment({...partial,evidence:{...partial.evidence,state}}),true,state);
  }
  const foreign={...partial,paymentMethod:'USDT',evidence:{...partial.evidence,state:'PARTIALLY_PAID_BY_ONE_C',issuedAmount:0,paidForeignAmount:100}};
  assert.equal(hasConfirmedReceiptPayment(foreign),true);
  assert.equal(receiptPaymentAmount(foreign),'100 USDT');
  assert.equal(receiptPaymentAmount({...partial,evidence:{...partial.evidence,paidAmount:5000}}),'25 000 ₽');
});
test('approval, unmatched documents, unavailable source and invalid amounts are not payment proof',()=>{
  assert.equal(hasConfirmedReceiptPayment({}),false);
  for(const state of ['NO_EVIDENCE','NEEDS_REVIEW','MISMATCH','SOURCE_UNAVAILABLE','']) {
    assert.equal(hasConfirmedReceiptPayment({...partial,evidence:{...partial.evidence,state}}),false,state);
  }
  for(const issuedAmount of [0,-1,NaN,Infinity])assert.equal(hasConfirmedReceiptPayment({...partial,evidence:{...partial.evidence,issuedAmount}}),false);
  assert.equal(hasConfirmedReceiptPayment({...partial,evidence:{...partial.evidence,verification:'unavailable'}}),false);
  assert.equal(hasConfirmedReceiptPayment({...partial,evidence:{...partial.evidence,verification:'last-confirmed'}}),true);
});
test('cash, historic payments and existing receipt exclusions stay unchanged',()=>{
  assert.equal(needsReceiptSinceRollout({...partial,paymentMethod:'CASH'},0),false);
  for(const paymentMethod of ['BANK','ACCOUNTABLE_QR','USDT','CNY'])assert.equal(needsReceiptSinceRollout({...partial,paymentMethod},0),true);
  assert.equal(needsReceiptSinceRollout(partial,1),false);
  assert.equal(needsReceiptSinceRollout({...partial,evidence:{...partial.evidence,cashOrders:[{date:'09.10.2026'}]}},0),false);
});
test('both real cabinets feed confirmed payments to the queue, leaving history on completion',()=>{
  for(const file of ['app/(dashboard)/admin/procurement/AdminProcurementClient.tsx','app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx']) {
    const source=readFileSync(file,'utf8');
    assert.match(source,/const receiptPlans = plans\.filter\(hasConfirmedReceiptPayment\)/);
    assert.match(source,/<ProcurementReceipts plans=\{receiptPlans\} allPlans=\{plans\}/);
    assert.match(source,/<ProcurementPaymentHistory plans=\{(?:completedPlans|paidPlans)\}/);
  }
});
test('real reconciliation: partial linked RKO enters receipt queue; unposted/cancelled/unlinked RKO does not',()=>{
  const plan:EvidencePlan={id:'luxo-test',planCode:'PAY-LUXO-TEST',supplierPartner:'Luxo',supplierCounterparty:'Luxo',
    orderRefs:['test-order'],plannedAmount:100000,paymentMethod:'ACCOUNTABLE_QR',createdAt:'2026-10-12T09:00:00Z',plannedDate:'2026-10-16',status:'APPROVED'};
  const payment:SupplierCurrencyPaymentRow={ref:'test-rko',number:'TEST-01',date:'16.10.2026 12:00:00',posted:true,deleted:false,
    documentCurrency:'РУБ',documentAmount:20000,baseDocumentRef:'test-order',cashbox:'Test cashbox'};
  const reconcile=(patch:Partial<SupplierCurrencyPaymentRow>={})=>({ ...plan,
    evidence:matchProcurementPaymentEvidence([plan],[],[{...payment,...patch}],[],{allowSmallRemainder:true}).get(plan.id)! });
  const result=reconcile();
  assert.equal(hasConfirmedReceiptPayment(result),true);
  assert.equal(needsReceiptSinceRollout(result,0),true);
  assert.equal(result.evidence.remainingAmount,80000);
  assert.equal(isFinishedPaymentState(result.evidence.state),false);
  for(const patch of [{posted:false},{deleted:true},{baseDocumentRef:''}])assert.equal(hasConfirmedReceiptPayment(reconcile(patch)),false);
});
