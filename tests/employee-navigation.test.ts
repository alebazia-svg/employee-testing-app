import assert from 'node:assert/strict';
import test from 'node:test';
import { employeeNavigation, employeePreviewHref, employeeSectionViews } from '../lib/employee-navigation';
import { employeePreviewUrl } from '../lib/employee-preview-request';

test('every enabled employee tab has an inspection destination and renderer', () => {
  for (const enabled of [false, true]) {
    const sections = employeeNavigation(enabled);
    assert.deepEqual(sections.map(section => section.id), enabled ? ['day', 'schedule', 'payroll'] : ['day', 'schedule']);
    for (const section of sections) {
      const href = employeePreviewHref('actor-bound-visit', section.href);
      const url = new URL(href, 'https://portal.example');
      assert.equal(url.pathname, '/admin/employees/preview/actor-bound-visit');
      assert.equal(url.searchParams.get('tab') ?? 'day', section.id);
      assert.ok(employeeSectionViews[section.id]);
    }
  }
  for (const href of ['/admin/payroll', '/employee/payroll?userId=9', 'https://other.example/employee', '//other.example/employee']) {
    assert.throws(() => employeePreviewHref('visit', href));
  }
});
test('salary inspection uses the scoped reader, preserves month validation and forbids writes', () => {
  assert.equal(employeePreviewUrl('visit', '/api/employee/payroll?month=2026-10&userId=99'), '/api/admin/employees/preview/visit?resource=payroll&month=2026-10');
  assert.equal(employeePreviewUrl('visit', '/api/employee/payroll?month=2026-10&month=2026-09'), '/api/admin/employees/preview/visit?resource=payroll&month=2026-10&month=2026-09');
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.throws(() => employeePreviewUrl('visit', '/api/employee/payroll', { method }));
});
