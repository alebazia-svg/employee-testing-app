import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('desktop theme is scoped away from employee workflow and semantic statuses', () => {
  const css = read('app/desktop-copper.css');
  assert.match(css, /:is\(\.admin-shell, \.procurement-shell\)/);
  assert.doesNotMatch(css, /\.employee-material-ui|\.text-red-|\.bg-red-|\.bg-green-/);
  assert.match(css, /button\[aria-pressed="true"\]/);
  assert.match(css, /\.procurement-calendar button\.admin-material-primary/);
  assert.match(css, /:not\(:disabled\):hover/);
});
test('filters declare selection instead of masquerading as primary actions', () => {
  assert.match(read('app/(dashboard)/admin/employees/EmployeesClient.tsx'), /aria-pressed=\{filter === key\}/);
  assert.match(read('app/(dashboard)/admin/inbox/AdminInboxListClient.tsx'), /aria-pressed=\{filter === item.key\}/);
  const payroll = read('app/(dashboard)/admin/payroll/PayrollClient.tsx');
  assert.match(payroll, /aria-pressed=\{activePayrollTab === tab.id\}/);
  assert.match(payroll, /aria-pressed=\{activePayrollTab === tab\}/);
  assert.match(read('app/(dashboard)/admin/attestations/[id]/AttestationEditor.tsx'), /aria-pressed=\{activeTab === tab.id\}/);
});
test('PWA header changes independently of installed icon', () => {
  assert.match(read('app/(dashboard)/employee/EmployeePortalHeader.tsx'), /mobo-symbol-3d-light-ui.svg/);
  assert.match(read('app/layout.tsx'), /portal-app-copper-180.png/);
});
test('copper glyphs are limited to primary actions and exclude progress spinners', () => {
  const css = read('app/desktop-copper.css');
  assert.match(css, /:is\(button\.bg-primary, button\.admin-material-primary\) > svg:not\(\.animate-spin\)/);
  assert.match(css, /color: #d69a64 !important/);
  assert.match(css, /\[data-portal-secondary="true"\], \[aria-pressed="true"\]/);
});
