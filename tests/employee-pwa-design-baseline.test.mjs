import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const employeeSourcePath = 'app/(dashboard)/employee/EmployeeTodayClient.tsx';
const notificationsSourcePath = 'app/(dashboard)/employee/WorkdayNotificationsClient.tsx';
const globalStylesPath = 'app/globals.css';
const brandStylesPath = 'app/mobo-brand.css';

test('QR start cue uses one scan line with a stationary code and reduced motion support', async () => {
  const css = await readFile('public/pwa-copper.css', 'utf8');
  assert.ok(css.indexOf('@keyframes pwa-qr-scan') < css.indexOf('body:has('));
  assert.match(css, /\.pwa-qr-scan-line \{\s*animation:pwa-qr-scan 2\.8s ease-in-out infinite;/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\) \{[^}]*animation:none;/);
  assert.doesNotMatch(css, /pwa-qr-start-sheen|pwa-qr-corner-breathe|pwa-qr-detail-emphasis/);
  const source = await readFile(employeeSourcePath, 'utf8');
  assert.match(source, /className='pwa-qr-scan-line'/);
  assert.match(source, /<QrCode x=\{6\} y=\{6\}/);
  assert.match(css, /svg\.pwa-start-qr-scanner \{ padding:3px !important; \}/);
});

test('prestart card exposes one native scan action without duplicated labels or a second button', async () => {
  const source = await readFile(employeeSourcePath, 'utf8');
  const card = source.slice(source.indexOf("<section className='pwa-composition-only pwa-composition-start'"), source.indexOf('</section>', source.indexOf("<section className='pwa-composition-only pwa-composition-start'")));
  assert.match(card, />Начать смену<\/h2>/);
  assert.match(card, /Отсканируйте <span className='whitespace-nowrap'>QR-код<\/span> в магазине\./);
  assert.match(card, /Открыть камеру/);
  assert.equal((card.match(/<button\b/g) ?? []).length, 1);
  assert.match(card, /aria-labelledby='pwa-composition-start-title' aria-describedby='pwa-start-qr-hint' onClick=\{openQrStart\}/);
  assert.doesNotMatch(card, /Рабочий день|Не начат|pwa-composition-start-button/);
  const css = await readFile('public/pwa-copper.css', 'utf8');
  assert.match(css, /\.pwa-composition-start \.pwa-composition-start-body \{ display:flex; flex-direction:row;[^}]*min-height:116px;/);
  assert.match(css, /\.pwa-composition-start \.pwa-composition-start-body > svg\.pwa-start-qr-scanner \{ order:1; width:88px; height:88px;/);
  assert.match(css, /\.pwa-start-card-footer \{[^}]*min-height:52px;[^}]*background:linear-gradient\(135deg,#303337,#191c20\); color:#fffdf6;[^}]*font-size:16px;/);
  assert.match(css, /\.pwa-start-card-footer > svg \{ width:26px; height:26px; flex-shrink:0; color:#d99a68; stroke-width:2\.4;/);
  assert.match(css, /\.pwa-composition-start \.pwa-composition-start-body h2 \{ font-size:26px;/);
  assert.match(css, /\.pwa-composition-start \.pwa-composition-start-body p \{ font-size:16px;/);
});

test('copper bottom navigation uses equal base sizes with a small optical clock adjustment', async () => {
  const css = await readFile('public/pwa-copper.css', 'utf8');
  assert.match(css, /\.employee-material-ui \.employee-material-nav \.employee-material-tab svg \{ width:26px !important; height:26px !important; transform:none !important; \}/);
  assert.match(css, /\.employee-material-ui \.employee-material-nav \.employee-material-nav-icon-day svg \{ transform:scale\(1\.04\) !important; \}/);
});

test('approved employee PWA palette remains the default', async () => {
  const [employeeSource, notificationsSource, globalStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(notificationsSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /\?\? 'portal-palette-mobo portal-typography-refined'/);
  // Notification UI was extracted in the already released shared inbox.
  assert.match(notificationsSource, /<EmployeeNotificationInbox/);
  const inbox = await readFile('components/workday/EmployeeNotificationInbox.tsx', 'utf8');
  assert.match(inbox, /employee-inbox portal-neutral-design employee-material-ui/);
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

  const navigation = await readFile('components/EmployeeNavigation.tsx', 'utf8');
  const sections = await readFile('lib/employee-navigation.ts', 'utf8');
  assert.match(employeeSource, /<EmployeeNavigation/);
  assert.match(sections, /id: 'day', label: 'Рабочий день'/);
  assert.match(sections, /id: 'schedule', label: 'График'/);
  assert.match(navigation, /day: PremiumClockIcon, schedule: PremiumCalendarIcon, payroll: PremiumCardIcon/);
  assert.match(navigation, /employee-material-tab-label/);
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

test('personal salary keeps readable earnings and uses spacing-only compact adaptation', async () => {
  const css = await readFile('app/(dashboard)/employee/payroll/payroll.css', 'utf8');
  const client = await readFile('app/(dashboard)/employee/payroll/PersonalPayrollClient.tsx', 'utf8');
  assert.match(css, /personal-payroll-content \.salary-breakdown > div \{[\s\S]*?font-size: 17px;/);
  assert.match(css, /personal-payroll-content \.salary-breakdown strong \{\s*font-size: 19px;/);
  const compact = css.slice(css.indexOf('@media (max-height: 820px)'));
  assert.ok(compact.length > 0);
  assert.doesNotMatch(compact, /font-size|transform|overflow:\s*hidden|display:\s*none/);
  assert.match(client, /salary\.earnings!\.map/);
  assert.doesNotMatch(client, /<details|<summary/);
});

test('semantic state icons keep the approved color system', async () => {
  const [employeeSource, notificationsSource, globalStyles] = await Promise.all([
    readFile(employeeSourcePath, 'utf8'),
    readFile(notificationsSourcePath, 'utf8'),
    readFile(globalStylesPath, 'utf8'),
  ]);

  assert.match(employeeSource, /employee-material-state-marker-success/);
  assert.match(notificationsSource, /<EmployeeNotificationInbox/);
  const inbox = await readFile('components/workday/EmployeeNotificationInbox.tsx', 'utf8');
  assert.match(inbox, /<EmployeeNoticeIcon kind=\{employeeInboxIconKind\(item\)\} \/>/);
  assert.match(inbox, /employee-inbox-row \$\{unread \? 'is-unread' : ''\}/);
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

  for (const source of [creditCardSource, paymentCardSource, issuePageSource, paymentPageSource]) {
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
  assert.match(source, /Ожидает согласования\./);
  assert.match(source, /Продолжить сдачу смены/);
  assert.match(source, /currentCloseExceptionStatus === 'pending'[\s\S]*?currentCloseExceptionStatus === 'approved'[\s\S]*?currentCloseExceptionStatus === 'rejected'/);
  assert.match(source, /showCloseResolution && !kkmCloseIssue/);
  assert.match(source, /showShiftControl && !kkmCloseIssue/);
});

test('other required issues keep the technical request in a sheet across re-entry', async () => {
  const source = await readFile(employeeSourcePath, 'utf8');

  assert.match(source, /requiredIssuesState\.length > 0 && \(closeBlocked \|\| handoverWasBlocked \|\| Boolean\(kkmCloseIssue\) \|\| Boolean\(closeExceptionRequestState\)\)/);
  assert.match(source, /closeResolutionOpen && showCloseResolution && !kkmCloseIssue/);
  assert.match(source, /Почему не получается\?/);
  assert.match(source, /Запрос на завершение смены с неисправленной ошибкой\./);
  assert.match(source, /activeWorkDay && !hasPreviousWorkday && !showShiftControl && !showCloseResolution/);
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
