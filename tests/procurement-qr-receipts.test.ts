import test from 'node:test';
import assert from 'node:assert/strict';
import {canCollectProcurementReceipt,canCollectQrReceiptBeforePayment,hasConfirmedReceiptPayment,
  needsProcurementReceipt,qrReceiptStatus,receiptPaymentDate} from '../lib/procurement-receipt-policy';

const qr={status:'APPROVED',paymentMethod:'ACCOUNTABLE_QR',createdAt:'2026-10-18',plannedDate:'2026-10-20',
  evidence:{state:'NO_EVIDENCE',verification:'current',issuedAmount:0,paidAmount:0,paidForeignAmount:0}};
test('approved QR allows early attachment; demand begins on the Moscow payment day',()=>{
  assert.equal(canCollectProcurementReceipt(qr),true);
  assert.equal(hasConfirmedReceiptPayment(qr),false);
  assert.equal(needsProcurementReceipt(qr,0,'2026-10-19'),false);
  assert.equal(needsProcurementReceipt(qr,0,receiptPaymentDate('2026-10-19T21:00:00Z')),true);
  assert.equal(needsProcurementReceipt(qr,0,'2026-10-21'),true);
  assert.equal(needsProcurementReceipt(qr,1,'2026-10-20'),false);
});
test('unapproved, cancelled, manually completed, undated and historical QR do not create tasks',()=>{
  for(const status of ['SUBMITTED','NEEDS_CHANGES','CANCELLED','COMPLETED_WITHOUT_TOPUP','']) {
    assert.equal(canCollectQrReceiptBeforePayment({...qr,status}),false,status);
    assert.equal(needsProcurementReceipt({...qr,status},0,'2026-10-20'),false,status);
  }
  for(const plannedDate of ['', 'unknown', '2026-10-09'])assert.equal(needsProcurementReceipt({...qr,plannedDate},0,'2026-10-20'),false);
});
test('other methods still require reconciled partial or full payment, cash remains exempt',()=>{
  for(const paymentMethod of ['BANK','USDT','CNY','CASH']) {
    const plan={...qr,paymentMethod};
    assert.equal(canCollectProcurementReceipt(plan),false,paymentMethod);
    assert.equal(needsProcurementReceipt(plan,0,'2026-10-20'),false,paymentMethod);
    const paid={...plan,evidence:{...qr.evidence,state:'PARTIALLY_ISSUED',issuedAmount:100,cashOrders:[{date:'2026-10-20'}]}};
    assert.equal(needsProcurementReceipt(paid,0,'2026-10-20'),paymentMethod!=='CASH',paymentMethod);
    assert.equal(needsProcurementReceipt(paid,1,'2026-10-20'),false,paymentMethod);
  }
});
test('receipt upload does not become accounting proof; ADMIN sees the next step',()=>{
  const before=JSON.stringify(qr);
  assert.equal(qrReceiptStatus(qr,1,false),'Чек добавлен');
  assert.equal(qrReceiptStatus(qr,1,true),'Чек добавлен · ожидает оформления в 1С');
  assert.equal(qrReceiptStatus(qr,0,true),'');
  assert.equal(hasConfirmedReceiptPayment(qr),false);
  assert.equal(JSON.stringify(qr),before);
  const paid={...qr,evidence:{...qr.evidence,state:'ISSUED_BY_ONE_C',issuedAmount:100}};
  assert.equal(qrReceiptStatus(paid,1,true),'Чек добавлен');
  assert.equal(canCollectQrReceiptBeforePayment(paid),false);
});
test('QR can collect proof while 1C is unavailable without claiming an absent expense',()=>{
  const unavailable={...qr,evidence:{...qr.evidence,verification:'unavailable',state:'SOURCE_UNAVAILABLE'}};
  assert.equal(needsProcurementReceipt(unavailable,0,'2026-10-20'),true);
  assert.equal(qrReceiptStatus(unavailable,1,true),'Чек добавлен · оформление в 1С не подтверждено');
  const finished={...unavailable,evidence:{...unavailable.evidence,state:'ISSUED_BY_ONE_C',issuedAmount:100}};
  assert.equal(canCollectQrReceiptBeforePayment(finished),false);
});
test('legacy paid QR and rollout cash exceptions remain unchanged',()=>{
  const paid={...qr,evidence:{...qr.evidence,state:'ISSUED_BY_ONE_C',issuedAmount:100,cashOrders:[{date:'2026-10-09'}]}};
  assert.equal(needsProcurementReceipt(paid,0,'2026-10-20'),false);
  const legacy={...paid,paymentMethod:'CASH',evidence:{...paid.evidence,cashOrders:[{number:'00OF-001871',date:'2026-10-10'}]}};
  assert.equal(needsProcurementReceipt(legacy,0,'2026-10-20'),true);
});
