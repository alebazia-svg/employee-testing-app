import assert from 'node:assert/strict';
import test from 'node:test';
import { employeePreviewUrl } from '../lib/employee-preview-request';

test('preview transport permits only explicitly mapped reads and drops extraneous identity parameters', () => {
  assert.equal(employeePreviewUrl('visit', '/api/employee/workday/schedule?month=2026-10&userId=999'), '/api/admin/employees/preview/visit?resource=schedule&month=2026-10');
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT']) assert.throws(() => employeePreviewUrl('visit', '/api/employee/workday/schedule', { method }));
  for (const path of ['/api/employee/workday/start', '/api/auth/logout', '/api/employee/push-subscription', '/api/admin/employees', 'https://other.example/api/employee/workday/today', '//other.example/api/employee/workday/today']) assert.throws(() => employeePreviewUrl('visit', path));
});


test('procurement preview maps only scoped receipt and delivery reads', () => {
  assert.equal(employeePreviewUrl('visit', '/api/procurement/receipts?plan=one&plan=two&userId=999'), '/api/admin/employees/preview/visit?resource=receipts&plan=one&plan=two');
  assert.equal(employeePreviewUrl('visit', '/api/procurement/payment-plans/one/receipts/file'), '/api/admin/employees/preview/visit?resource=receipt-file&plan=one&receipt=file');
  assert.equal(employeePreviewUrl('visit', '/api/procurement/delivery'), '/api/admin/employees/preview/visit?resource=delivery');
  for (const path of ['/api/procurement/payment-plans', '/api/procurement/payment-plans/one/receipts', '/api/procurement/delivery']) assert.throws(() => employeePreviewUrl('visit', path, { method: 'POST' }));
});
