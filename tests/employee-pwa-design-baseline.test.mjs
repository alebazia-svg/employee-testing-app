import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const employeeSourcePath = 'app/(dashboard)/employee/EmployeeTodayClient.tsx';
const notificationsSourcePath = 'app/(dashboard)/employee/WorkdayNotificationsClient.tsx';
const globalStylesPath = 'app/globals.css';
const brandStylesPath = 'app/mobo-brand.css';

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

test('approved employee PWA navigation semantics remain intact without decorative underlines', async () => {
  const [employeeSource, globalStyles, brandStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
    readFile(brandStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /label: 'Рабочий день', icon: PremiumClockIcon/);
  assert.match(employeeSource, /label: 'График', icon: PremiumCalendarIcon/);
  assert.match(employeeSource, /employee-material-tab-label/);
  assert.match(globalStyles, /employee-material-nav-icon-day svg[\s\S]*?transform: scale\(1\.12\)/);
  assert.match(brandStyles, /employee-material-tab\.is-active \.employee-material-tab-label::after[\s\S]*?display: none !important;[\s\S]*?content: none !important;/);
  assert.match(globalStyles, /--solar-secondary-color: #263b5c !important;/);
});

test('approved schedule controls use the compact list and a line-free muted-blue segment', async () => {
  const [employeeSource, brandStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(brandStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /<ScheduleDayCard key=\{date\} date=\{date\} compact listView \/>/);
  assert.match(employeeSource, /flex flex-nowrap items-center justify-center gap-3 px-0\.5 text-\[10px\]/);
  assert.match(employeeSource, /bg-\[#e8f1fb\] ring-1 ring-\[#b8cee5\]' \/>Отпуск/);
  assert.match(brandStyles, /employee-material-segment-option\.is-active \{[\s\S]*?background: #dfe8f3 !important;[\s\S]*?box-shadow: none !important;/);
  assert.match(brandStyles, /employee-material-segment-option\.is-active::after[\s\S]*?display: none !important;[\s\S]*?content: none !important;/);
});

test('month calendar cells are square and show initials without ellipsis', async () => {
  const employeeSource = await readFile(employeeSourcePath, 'utf8');

  assert.match(employeeSource, /employee-material-calendar-day flex aspect-square/);
  assert.match(employeeSource, /workingInitials\.initials\.map/);
  assert.match(employeeSource, /vacationInitials\.initials\.map/);
  assert.doesNotMatch(employeeSource, /mt-auto max-w-full truncate text-\[10px\]/);
});

test('semantic state icons keep the approved color system', async () => {
  const [employeeSource, notificationsSource, globalStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(notificationsSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /employee-material-state-marker-success/);
  assert.match(notificationsSource, /employee-material-state-marker-warning/);
  assert.match(notificationsSource, /employee-material-state-marker-info/);
  assert.match(globalStyles, /employee-material-state-marker-warning[\s\S]*?background: #fff7e3 !important;/);
  assert.match(globalStyles, /employee-material-state-marker-success[\s\S]*?background: #eef8f1 !important;/);
  assert.match(globalStyles, /employee-material-state-marker-info[\s\S]*?background: #eef4fb !important;/);
});

test('PWA alert cards use standalone semantic symbols without nested tiles', async () => {
  const [employeeSource, creditCardSource, paymentCardSource, issuePageSource, paymentPageSource, brandStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile('components/EmployeeCreditIssueActionCard.tsx', 'utf8'),
    readFile('components/EmployeePaymentCheckActionCard.tsx', 'utf8'),
    readFile('app/(dashboard)/employee/issues/[id]/page.tsx', 'utf8'),
    readFile('app/(dashboard)/employee/payment-checks/[id]/page.tsx', 'utf8'),
    readFile(brandStylesPath, 'utf8'),
  ]);

  for (const source of [employeeSource, creditCardSource, paymentCardSource, issuePageSource, paymentPageSource]) {
    assert.match(source, /employee-material-alert-symbol/);
  }
  assert.doesNotMatch(employeeSource, /employee-material-state-marker employee-material-state-marker-warning flex h-11 w-11/);
  assert.match(issuePageSource, /PremiumChatIcon color='#263b5c' secondaryColor='#b9cbe0'/);
  assert.match(brandStyles, /employee-material-alert-symbol[\s\S]*?background: transparent !important;[\s\S]*?box-shadow: none !important;/);
});

test('employee attestation status pictograms use the shared Solar duotone family', async () => {
  const source = await readFile('app/(dashboard)/employee/attestations/[id]/page.tsx', 'utf8');

  assert.match(source, /CheckCircleIcon as PremiumCheckCircleIcon/);
  assert.match(source, /CloseCircleIcon as PremiumCloseCircleIcon/);
  assert.match(source, /ClockCircleIcon as PremiumClockIcon/);
  assert.doesNotMatch(source, /\b(CheckCircle|XCircle|Clock3)\b/);
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

  assert.match(source, /requiredIssuesState\.length > 0 && \(closeBlocked \|\| handoverHasSavedProgress \|\| Boolean\(kkmCloseIssue\) \|\| Boolean\(closeExceptionRequestState\)\)/);
  assert.match(source, /closeResolutionOpen && showCloseResolution && !kkmCloseIssue/);
  assert.match(source, /Сообщить о проблеме/);
  assert.match(source, /Смена останется открытой\./);
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
