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

test('KKM close failure uses the approved real-employee sheet, not the legacy inline form', async () => {
  const source = await readFile(employeeSourcePath, 'utf8');

  assert.match(source, /closeResolutionOpen && showCloseResolution && kkmCloseIssue/);
  assert.match(source, /closeResolutionPath === null[\s\S]*?Чек распечатался[\s\S]*?Чек не распечатался/);
  assert.match(source, /Закрытие кассы не подтверждено/);
  assert.match(source, /Закройте смену на ККМ\. Если чек уже есть — приложите фото\./);
  assert.match(source, /Чек закрытия распечатался\?/);
  assert.match(source, /Фото отправлено\. Ждём решения администратора\./);
  assert.match(source, /Указать, что с чеком/);
  assert.match(source, /currentCloseExceptionStatus === 'pending'[\s\S]*?currentCloseExceptionStatus === 'approved'[\s\S]*?currentCloseExceptionStatus === 'rejected'/);
  assert.match(source, /showCloseResolution && !kkmCloseIssue/);
  assert.match(source, /showShiftControl && !kkmCloseIssue/);
});

test('other required issues keep the technical request in a sheet across re-entry', async () => {
  const source = await readFile(employeeSourcePath, 'utf8');

  assert.match(source, /requiredIssuesState\.length > 0 && \(closeBlocked \|\| Boolean\(kkmCloseIssue\) \|\| Boolean\(closeExceptionRequestState\)\)/);
  assert.match(source, /closeResolutionOpen && showCloseResolution && !kkmCloseIssue/);
  assert.match(source, /Откройте ошибку выше и исправьте её\./);
  assert.match(source, /Не получается исправить/);
  assert.match(source, /activeWorkDay && !showShiftControl && !showCloseResolution/);
});

test('employee sheets reserve room for mobile browser chrome', async () => {
  const [source, css] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ]);

  for (const label of ['Выбор смены', 'Исправление смены', 'Изменение графика', 'Проверка графика', 'Выход из заполнения графика']) {
    assert.match(source, new RegExp(`employee-workday-sheet-overlay[^\\n]*role='dialog'[^\\n]*aria-label='${label}'`));
  }
  assert.match(css, /--employee-sheet-browser-clearance: 5rem;/);
  assert.match(css, /@media \(display-mode: standalone\), \(display-mode: fullscreen\)/);
  assert.match(css, /--employee-sheet-browser-clearance: 0rem;/);
});
