import assert from 'node:assert/strict';
import test from 'node:test';
import { procurementMobileSection, procurementWorkdayEntry } from '../lib/procurement-mobile-navigation';
import { employeePreviewResources } from '../lib/employee-preview-request';

test('mobile entry restores supported workday/calendar tabs; invalid or salary entry stays in Procurement', () => {
  assert.equal(procurementMobileSection('day'), 'day');
  assert.equal(procurementMobileSection('schedule'), 'schedule');
  for (const value of [null, 'procurement', 'payroll', 'admin', '/employee']) assert.equal(procurementMobileSection(value), 'procurement');
});
test('Procurement inspection can read its own workday without gaining payroll or mutations', () => {
  const own = employeePreviewResources({portalArea:'PROCUREMENT',department:'procurement'});
  for (const resource of ['notifications','schedule','today','attention','receipts','delivery']) assert.ok(own.includes(resource));
  for (const resource of ['payroll','start','finish','cash-operation']) assert.ok(!own.includes(resource));
  const financeOnly = employeePreviewResources({portalArea:'PROCUREMENT',department:'retail'});
  assert.ok(financeOnly.includes('receipts')); assert.ok(!financeOnly.includes('today'));
  const manager = employeePreviewResources({portalArea:'WORKDAY',department:'retail'});
  assert.ok(manager.includes('schedule')); assert.ok(!manager.includes('receipts'));
});

test('legacy workday push entry retains target date, edit and attention without an external redirect or salary tab', () => {
  const date = new URL(procurementWorkdayEntry({tab:'schedule',date:'2026-10-30',edit:'1'}), 'https://portal.example');
  assert.equal(date.pathname,'/procurement');assert.equal(date.searchParams.get('tab'),'schedule');assert.equal(date.searchParams.get('date'),'2026-10-30');assert.equal(date.searchParams.get('edit'),'1');
  const attention = new URL(procurementWorkdayEntry({attention:'cash',item:'issue:123',tab:'payroll'}),'https://portal.example');
  assert.equal(attention.searchParams.get('tab'),'day');assert.equal(attention.searchParams.get('attention'),'cash');assert.equal(attention.searchParams.get('item'),'issue:123');
  assert.equal(new URL(procurementWorkdayEntry({tab:'https://other.example/'}),'https://portal.example').origin,'https://portal.example');
});
