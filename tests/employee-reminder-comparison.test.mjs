import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const directory = 'app/(dashboard)/employee/reminder-comparison/';

test('animation comparison is private and isolated-demo only', async () => {
  const page = await readFile(directory + 'page.tsx', 'utf8');
  assert.match(page, /process\.env\.PORTAL_ISOLATED_DEMO !== '1'\) notFound\(\)/);
  assert.match(page, /if \(!user\) redirect\('\/login'\)/);
  assert.match(page, /!user\.isActive.*user\.portalArea !== 'WORKDAY'/);
});

test('comparison reuses the real notice and cannot execute or postpone work', async () => {
  const source = await readFile(directory + 'ReminderComparison.tsx', 'utf8');
  assert.match(source, /<ActionReminderNotice title='Проверьте чеки'/);
  assert.match(source, /<ReminderBell \/>/);
  assert.doesNotMatch(source, /fetch\(|requestRead|requestWrite|setInterval|setTimeout/);
  assert.equal((source.match(/id: '/g) ?? []).length, 4);
});

test('animation variations have no layout growth and respect reduced motion', async () => {
  const css = await readFile(directory + 'comparison.module.css', 'utf8');
  assert.match(css, /width:38px; height:34px; flex-shrink:0/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\).*\{\s*\.movement,\.copper svg \{ animation:none;/s);
  assert.doesNotMatch(css, /filter:|blur\(/);
});

test('normal reminder uses semantic icons without changing task navigation', async () => {
  const source = await readFile('components/workday/EmployeeActionReminder.tsx', 'utf8');
  assert.match(source, /icon=\{<EmployeeNoticeIcon kind=\{employeeReminderIconKind\(action\)\} animated \/>\}/);
  assert.match(source, /onOpen=\{onOpen \|\| action\.target === 'cash_issue' \? open : undefined\} href=\{href\} onDefer=\{state\.defer\}/);
});
