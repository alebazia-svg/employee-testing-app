import test from 'node:test';
import assert from 'node:assert/strict';
import {adminNotificationOpening as admin,employeeNotificationOpening as employee,safeNotificationHref} from '../lib/notification-opening';
test('focused records open in dialogs; batches and operational contexts stay on pages',()=>{
  assert.equal(admin({sourceType:'supplier_payment_plan',type:'procurement.payment_updated',href:'/admin/procurement'}),'payment');
  assert.equal(admin({sourceType:'supplier_payment_plan',type:'procurement.payment_submitted',body:'Астемир · 3 оплат · 50 000 ₽',href:'/admin/procurement'}),'page');
  assert.equal(admin({sourceType:'supplier_payment_receipt',type:'procurement.receipt_added',href:'/admin/procurement?receipts=one'}),'receipts');
  assert.equal(admin({sourceType:'expense_request',type:'expense_request.created',href:'/admin/expense-requests/case-1'}),'expense');
  for(const sourceType of ['procurement_delivery','workday_close_exception','cash_operation','dependency','infrastructure','workday_control_issue','terminal_fiscal_review','work_schedule','unknown'])assert.equal(admin({sourceType,type:'any',href:'/admin/workday'}),'page');
  for(const kind of ['procurement_payment_approved','procurement_payment_needs_changes','procurement_payment_cancelled'])assert.equal(employee({kind}),'payment');
  assert.equal(employee({kind:'procurement_receipt_added'}),'receipts');
  for(const kind of ['planned','overdue','overdue_repeat','issue_reminder','issue_detected','terminal_fiscal_review','workday_issue_reply','schedule_replacement_request','schedule_replacement_digest','procurement_delivery_ready','procurement_collection_ready','unknown'])assert.equal(employee({kind}),'page');
});
test('notification links cannot leave the portal or run a script',()=>{
  for(const href of ['https://evil.test','//evil.test','/\\evil.test','javascript:alert(1)','/\n/evil.test',''])assert.equal(safeNotificationHref(href,'/admin/inbox'),'/admin/inbox');
  assert.equal(safeNotificationHref('/admin/workday?date=2026-10-12#review','/admin'),'/admin/workday?date=2026-10-12#review');
});
