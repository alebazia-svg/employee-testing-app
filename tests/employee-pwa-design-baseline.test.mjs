import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const employeeSourcePath = 'app/(dashboard)/employee/EmployeeTodayClient.tsx';
const notificationsSourcePath = 'app/(dashboard)/employee/WorkdayNotificationsClient.tsx';
const globalStylesPath = 'app/globals.css';

test('approved employee PWA palette remains the default', async () => {
  const [employeeSource, notificationsSource, globalStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(notificationsSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /\?\? 'portal-palette-mobo portal-typography-refined'/);
  assert.match(notificationsSource, /palette === null \|\| palette\.startsWith\('mobo'\)/);
  assert.match(globalStyles, /--portal-canvas: #f3f5f7;/);
  assert.match(globalStyles, /--portal-action: #263b5c;/);
  assert.match(globalStyles, /--portal-brand-accent: #efbd37;/);
});

test('approved employee PWA navigation semantics remain intact', async () => {
  const [employeeSource, globalStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /label: 'Рабочий день', icon: PremiumClockIcon/);
  assert.match(employeeSource, /label: 'График', icon: PremiumCalendarIcon/);
  assert.match(employeeSource, /employee-material-tab-label/);
  assert.match(globalStyles, /employee-material-nav-icon-day svg[\s\S]*?transform: scale\(1\.12\)/);
  assert.match(globalStyles, /employee-material-tab\.is-active \.employee-material-tab-label::after[\s\S]*?width: 34px;[\s\S]*?height: 3px;/);
  assert.match(globalStyles, /--solar-secondary-color: #263b5c !important;/);
});

test('semantic state icons keep the approved color system', async () => {
  const [employeeSource, notificationsSource, globalStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(notificationsSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /employee-material-state-marker-warning/);
  assert.match(employeeSource, /employee-material-state-marker-success/);
  assert.match(notificationsSource, /employee-material-state-marker-info/);
  assert.match(globalStyles, /employee-material-state-marker-warning[\s\S]*?background: #fff7e3 !important;/);
  assert.match(globalStyles, /employee-material-state-marker-success[\s\S]*?background: #eef8f1 !important;/);
  assert.match(globalStyles, /employee-material-state-marker-info[\s\S]*?background: #eef4fb !important;/);
});
