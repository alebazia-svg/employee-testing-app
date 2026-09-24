import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOrderReceipts } from '../lib/procurement-receipt-summary';
const row = (ref: string, amount: number, review = false) => ({ref, supplierPartner:'Supplier', receiptSettlement: {
  checkedAt:'2026-09-24T09:00:00Z',debtRub:amount,requiresAdvanceReview:review,
  receipts:[{ref:`receipt-${ref}`,number:ref,amountRub:1000,remainingRub:amount}],
  supplier:{ref:'supplier',grossDebtRub:2000,creditsRub:100,netOwedRub:1900},
}});
test('sum actual receipt balances including advance-review and kopeck balances, never order amount or supplier total',()=>{
  const rows=[row('1',1000),row('2',800,true),row('3',0.01),row('4',0),{ref:'5',supplierPartner:'Supplier',amount:100000}];
  assert.deepEqual(summarizeOrderReceipts(rows),{debtRub:1800.01,measured:4,positive:3,advanceReview:1,withoutReceiptEvidence:1,bySupplier:{Supplier:1800.01}});
});
test('duplicate order or receipt ownership, invalid amounts and mismatched receipt totals suppress summary',()=>{
  assert.equal(summarizeOrderReceipts([row('1',1000),row('1',1000)]),null);
  const a=row('1',1000),b=row('2',1000);b.receiptSettlement.receipts[0].ref=a.receiptSettlement.receipts[0].ref;
  assert.equal(summarizeOrderReceipts([a,b]),null);
  for(const value of [-1,NaN,Infinity,0.001])assert.equal(summarizeOrderReceipts([row('1',value)]),null);
  a.receiptSettlement.debtRub=999;assert.equal(summarizeOrderReceipts([a]),null);
  const c=row('1',1000),d=row('2',1000);d.receiptSettlement.supplier.netOwedRub=999;
  assert.equal(summarizeOrderReceipts([c,d]),null,'conflicting supplier snapshots cannot produce a seemingly consistent bridge');
});
