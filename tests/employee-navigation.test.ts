import assert from 'node:assert/strict';
import test from 'node:test';
import { employeeNavigation, employeePreviewHref, employeeSectionViews, initialEmployeeSection } from '../lib/employee-navigation';
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
test('all tabs share the existing native shell and retain feature gating', () => {
  assert.equal(initialEmployeeSection('payroll', true), 'payroll');
  assert.equal(initialEmployeeSection('payroll', false), 'day');
  assert.equal(initialEmployeeSection('schedule', true), 'schedule');
  assert.equal(initialEmployeeSection('unknown', true), 'day');
  assert.deepEqual(Object.values(employeeSectionViews), ['home', 'home', 'home']);
  assert.equal(employeePreviewUrl('visit', '/api/employee/payroll?month=2026-10&snapshot=stored'), '/api/admin/employees/preview/visit?resource=payroll&month=2026-10&snapshot=stored');
  assert.equal(employeePreviewUrl('visit', '/api/employee/payroll?snapshot=stored&snapshot=wrong'), '/api/admin/employees/preview/visit?resource=payroll&snapshot=stored&snapshot=wrong');
});

test('procurement inspection keeps all three tabs inside its actor-bound device frame', () => {
  for (const frame of ['phone', 'desktop'] as const) {
    for (const [href, tab] of [['/employee', 'day'], ['/employee?tab=schedule', 'schedule'], ['/procurement', 'procurement']]) {
      const url = new URL(employeePreviewHref('visit/encoded', href, { procurement: true, frame }), 'https://portal.example');
      assert.equal(url.pathname, '/admin/employees/preview/visit%2Fencoded');
      assert.equal(url.searchParams.get('tab'), tab);
      assert.equal(url.searchParams.get('frame'), frame);
    }
    for (const href of ['/admin', '/procurement?userId=9', 'https://other.example/procurement']) {
      assert.throws(() => employeePreviewHref('visit', href, { procurement: true, frame }));
    }
  }
  assert.throws(() => employeePreviewHref('visit', '/procurement'));
});
