import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccessProcurementReceipts,receiptFilename,receiptFormat,needsReceiptSinceRollout,receiptPlanFromFingerprint,receiptPaymentDate} from '../lib/procurement-receipt-policy';
import {isAdminInboxWebPushEligible,eligibleAdminInboxWebPushTypes,RECEIPT_PUSH_TYPE} from '../lib/admin-inbox-web-push-policy';
import {employeePushNotBefore} from '../lib/employee-push-policy';
test('receipt access is restricted to active admin or procurement owner',()=>{
  const owner={id:1,role:'EMPLOYEE',portalArea:'PROCUREMENT',isActive:true};
  assert.ok(canAccessProcurementReceipts(owner,1));
  assert.equal(canAccessProcurementReceipts(owner,2),false);
  assert.equal(canAccessProcurementReceipts({...owner,portalArea:'WORKDAY'},1),false);
  assert.equal(canAccessProcurementReceipts({...owner,role:'ADMIN',isActive:false},2),false);
  assert.ok(canAccessProcurementReceipts({...owner,role:'ADMIN'},2));
});
test('magic bytes and MIME must agree; paths and control characters are stripped',()=>{
  assert.equal(receiptFormat(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),'png');
  assert.equal(receiptFormat(Buffer.from('%PDF-1.7'),'application/pdf'),'pdf');
  assert.throws(()=>receiptFormat(Buffer.from('<html>'),'image/png'));
  assert.throws(()=>receiptFormat(new Uint8Array(),'application/pdf'));
  assert.throws(()=>receiptFormat(Buffer.from('%PDF-1.7'),'text/html'));
  assert.equal(receiptFilename('../../чек\r\n.pdf'),'чек.pdf');
});
test('rollout exempts old settled payments but includes today and future payments of old orders',()=>{
  const plan={paymentMethod:'BANK',createdAt:'2026-09-01T00:00:00Z',evidence:{cashOrders:[{date:'09.10.2026'}]}};
  assert.equal(needsReceiptSinceRollout(plan,0),false);
  assert.equal(needsReceiptSinceRollout({...plan,evidence:{cashOrders:[{date:'10.10.2026 12:00:00'}]}},0),true);
  assert.equal(needsReceiptSinceRollout({...plan,evidence:{cashOrders:[{date:'12.10.2026'}]}},0),true);
  assert.equal(needsReceiptSinceRollout({...plan,createdAt:'2026-10-10',paymentMethod:'CASH'},0),false);
  assert.equal(needsReceiptSinceRollout({...plan,createdAt:'2026-10-10'},1),false);
  assert.equal(needsReceiptSinceRollout({...plan,evidence:{}},0),false);
  assert.equal(receiptPaymentDate('2026-10-09T21:01:00Z'),'2026-10-10');
  assert.equal(needsReceiptSinceRollout({...plan,createdAt:'2026-10-10'},0),false);
});
test('night receipts remain eligible at 08:30 Moscow without changing other admin event windows',()=>{
  const created=new Date('2026-10-10T20:00:00Z');
  const morning=new Date('2026-10-11T05:30:00Z');
  assert.equal(isAdminInboxWebPushEligible({type:RECEIPT_PUSH_TYPE,eventCreatedAt:created,now:created}),false);
  assert.ok(isAdminInboxWebPushEligible({type:RECEIPT_PUSH_TYPE,eventCreatedAt:created,now:morning}));
  assert.deepEqual(eligibleAdminInboxWebPushTypes(morning),[RECEIPT_PUSH_TYPE]);
  assert.equal(employeePushNotBefore(created).toISOString(),morning.toISOString());
  assert.equal(isAdminInboxWebPushEligible({type:'expense_request.created',eventCreatedAt:created,now:morning}),false);
  assert.equal(receiptPlanFromFingerprint('procurement-receipt:plan1:receipt1'),'plan1');
});
