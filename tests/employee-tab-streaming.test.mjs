import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('app/(dashboard)/employee/EmployeeTodayClient.tsx');
const loader = read('lib/employee-home.ts');
const client = read('app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx');
const preview = read('app/(dashboard)/admin/employees/preview/[visitId]/page.tsx');
test('server-complete calendar is visible before background refresh, not inferred from partial rows', () => {
  assert.ok(loader.includes('buildInitialScheduleRange(today)'));
  assert.ok(loader.includes('initialScheduleMonth,'));
  assert.ok(home.includes('new Set(initialScheduleMonth ? [initialScheduleMonth] : [])'));
  assert.ok(home.includes("startVisibleSync(syncScheduleState, scheduleSyncIntervalMs)"));
  assert.ok(!home.includes('setLoadedScheduleMonths(new Set())'));
});

test('active calendar and salary icons use copper bodies with white internal strokes', () => {
  const navigation = read('components/EmployeeNavigation.tsx');
  const css = read('public/pwa-copper.css');
  assert.ok(navigation.includes('<CreditCard className=\'pwa-composition-only pwa-composition-nav-icon\''));
  assert.ok(css.includes(':is(.employee-material-nav-icon-schedule,.employee-material-nav-icon-payroll) .pwa-composition-nav-icon :is(path,line) { stroke:#fff9eb; }'));
});
const panel = read('components/workday/EmployeeAttentionPanel.tsx');
const reminder = read('components/workday/EmployeeActionReminder.tsx');

test('salary is a native local tab, not a blocking server navigation', () => {
  assert.ok(home.includes("activeTab === 'payroll' && <PersonalPayrollClient"));
  assert.ok(home.includes('embedded onOpenReminder'));
  assert.ok(!home.includes("if (section === 'payroll') return false"));
  assert.ok(preview.includes('<EmployeeTodayClient'));
  assert.ok(!preview.includes('key={tab}'));
  assert.ok(!preview.includes('PersonalPayrollScreen'));
  assert.ok(read('app/(dashboard)/employee/payroll/page.tsx').includes("redirect('/employee?tab=payroll')"));
});
test('salary loads the private saved projection first and retains the account cache', () => {
  assert.ok(client.includes('useEmployeePayrollSnapshots()'));
  assert.ok(client.includes('store?.values.get(month)'));
  assert.ok(client.includes('month === activeMonth && !salary'));
  assert.ok(client.includes('&snapshot=stored'));
  assert.ok(client.includes('controller.abort()'));
});
test('calendar defaults to month and operational notice never becomes a technical warning', () => {
  assert.ok(home.includes("setScheduleMode('month')"));
  assert.ok(!home.includes("setScheduleMode(requestedDate ? 'month' : 'list')"));
  assert.ok(!panel.includes('Заявки: не удалось обновить данные 1С.'));
  assert.ok(!reminder.includes('Не удалось обновить задания'));
  assert.ok(panel.includes('employeeAttentionSummary(action.length, waiting.length, refreshing'));
  assert.ok(panel.includes('!refreshing && loadState'));
});

test('unfinished previous shift details stay on workday rather than displacing salary or calendar', () => {
  assert.ok(home.includes("activeTab === 'day' && previousWorkDay && ("));
  assert.ok(!home.includes('{previousWorkDay && ('));
});
