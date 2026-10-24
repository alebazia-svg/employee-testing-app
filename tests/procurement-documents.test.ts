import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {documentPurpose,documentPaymentRefs,documentPaymentSnapshots,receiptCoverageCount,qrConfirmationContext,qrIsConfirmed,isPaymentReceipt,receiptPlanContext,pendingQrCoversPayment,paymentRequisites} from '../lib/procurement-document-policy';
test('calendar badges use the same exact payment coverage as the document queue',()=>{
  const source=readFileSync(new URL('../components/ProcurementReceipts.tsx',import.meta.url),'utf8');
  assert.match(source,/onCounts\?\.\(Object\.fromEntries\(allPlans\.map\(plan=>\[plan\.id,receiptCoverageCount\(plan,receipts\.filter/);
  assert.match(source,/evidenceSignature=.*documentPaymentSnapshots/);
});
test('correcting the same expense amount or date requires rechecking its receipt',()=>{
  const before={evidence:{cashOrders:[{ref:'r',amount:100,date:'24.10.2026',number:'1'}]}};
  const file={id:'f',purpose:'RECEIPT',paymentRefs:['cash:r'],paymentSnapshots:documentPaymentSnapshots(before,['cash:r'])};
  assert.equal(receiptCoverageCount(before,[file]),1);
  for(const changed of [{amount:200},{date:'25.10.2026'},{number:'2'}])assert.equal(receiptCoverageCount({evidence:{cashOrders:[{...before.evidence.cashOrders[0],...changed}]}},[file]),0);
  assert.equal(receiptCoverageCount(before,[{...file,paymentSnapshots:{}}]),0);
  assert.equal(receiptCoverageCount(before,[{...file,paymentSnapshots:null}]),1,'legacy files are not silently reclassified');
});
test('requisites follow the payment method, never the funding source',()=>{
  assert.equal(paymentRequisites('CASH'),null);
  assert.equal(paymentRequisites('ACCOUNTABLE_QR'),null);
  assert.equal(paymentRequisites(undefined),null);
  assert.equal(paymentRequisites('new-unknown-method'),null);
  assert.equal(paymentRequisites('USDT')?.qr,true);
  assert.match(paymentRequisites('USDT')!.hint,/сеть/);
  assert.equal(paymentRequisites('CNY')?.qrLabel,'QR Alipay');
  assert.equal(paymentRequisites('BANK')?.qr,false);
  assert.match(paymentRequisites('BANK')!.hint,/банк и получатель/);
});
const plan={id:'p',status:'APPROVED',plannedDate:'2026-10-24',plannedAmount:100,paymentMethod:'USDT',supplierPartner:'Test',foreignAmount:1,orderRefs:[],oneCCashEvidence:{}};
test('QR and requisites never count as receipts, including old clients with no metadata',()=>{
  assert.equal(isPaymentReceipt({id:'a',purpose:'QR'}),false);
  assert.equal(isPaymentReceipt({id:'b',purpose:'REQUISITES'}),false);
  assert.equal(isPaymentReceipt({id:'legacy'}),true);
  assert.equal(isPaymentReceipt({id:'replaced',purpose:'RECEIPT',replacedById:'new'}),false);
  assert.equal(receiptCoverageCount({},[{id:'qr',purpose:'QR'}]),0);
  assert.throws(()=>documentPurpose('qr'));
});
test('exact payment coverage does not hide later or unrelated payments',()=>{
  const first={evidence:{cashOrders:[{ref:'first'}]}};
  const later={evidence:{cashOrders:[{ref:'first'},{ref:'second'}]}};
  const file={id:'r',purpose:'RECEIPT',paymentRefs:['cash:first']};
  assert.equal(receiptCoverageCount(first,[file]),1);
  assert.equal(receiptCoverageCount(later,[file]),0);
  assert.equal(receiptCoverageCount(later,[file,{id:'s',purpose:'RECEIPT',paymentRefs:['cash:second']}]),2);
  assert.deepEqual(documentPaymentRefs({evidence:{cashOrders:[{ref:'same'},{ref:'same'}],currencyPayments:[{ref:'same'}]}}),['cash:same','currency:same']);
  assert.equal(receiptCoverageCount(first,[{id:'pending',purpose:'RECEIPT',paymentRefs:['pending-qr']}]),0);
  assert.equal(receiptCoverageCount({},[{id:'pending',purpose:'RECEIPT',paymentRefs:['pending-qr']}]),1);
});
test('confirmation is exact-file exact-day and invalidated by material plan changes',()=>{
  const file={id:'qr',purpose:'QR',qrConfirmedAt:'2026-10-24T09:00:00Z',qrConfirmationContext:qrConfirmationContext(plan,'2026-10-24')};
  assert.equal(qrIsConfirmed(file,plan,'2026-10-24'),true);
  assert.equal(qrIsConfirmed(file,plan,'2026-10-25'),false);
  assert.equal(qrIsConfirmed({...file,replacedById:'new'},plan,'2026-10-24'),false);
  for(const changed of [{plannedDate:'2026-10-25'},{plannedAmount:200},{supplierPartner:'Other'},{oneCCashEvidence:{pendingRevision:{id:'rev'}}},{oneCCashEvidence:{fundingDeferral:{date:null}}}])assert.equal(qrIsConfirmed(file,{...plan,...changed},'2026-10-24'),false);
  assert.equal(qrIsConfirmed(file,{...plan,oneCCashEvidence:{lastCompletePaymentView:{verifiedAt:'later'}}},'2026-10-24'),true);
});
test('early QR proof follows only a single fully reconciled payment of the unchanged request',()=>{
  const qr={...plan,paymentMethod:'ACCOUNTABLE_QR',evidence:{state:'ISSUED_BY_ONE_C',cashOrders:[{ref:'rko',date:'24.10.2026 14:00:00'}]}};
  const proof={id:'r',purpose:'RECEIPT',createdAt:'2026-10-24T09:00:00Z',paymentRefs:['pending-qr'],receiptPlanContext:receiptPlanContext(qr)};
  assert.equal(pendingQrCoversPayment(qr,proof),true);
  assert.equal(receiptCoverageCount(qr,[proof]),1);
  assert.equal(pendingQrCoversPayment({...qr,plannedAmount:200},proof),false);
  assert.equal(pendingQrCoversPayment({...qr,paymentMethod:'USDT'},proof),false);
  assert.equal(pendingQrCoversPayment({...qr,evidence:{...qr.evidence,state:'PARTIALLY_ISSUED'}},proof),false);
  assert.equal(pendingQrCoversPayment({...qr,evidence:{...qr.evidence,verification:'unavailable'}},proof),false);
  assert.equal(pendingQrCoversPayment({...qr,evidence:{...qr.evidence,cashOrders:[...qr.evidence.cashOrders,{ref:'later',date:'25.10.2026'}]}},proof),false);
  assert.equal(pendingQrCoversPayment(qr,{...proof,purpose:'QR'}),false);
  assert.equal(pendingQrCoversPayment(qr,{...proof,createdAt:'2026-10-25T10:00:00Z'}),false);
});
