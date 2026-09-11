import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shell = readFileSync(new URL('../components/AdminShell.tsx', import.meta.url), 'utf8');
const inbox = readFileSync(new URL('../components/AdminInboxBell.tsx', import.meta.url), 'utf8');
const breadcrumbs = readFileSync(new URL('../components/AdminBreadcrumbs.tsx', import.meta.url), 'utf8');
const attendance = readFileSync(new URL('../app/(dashboard)/admin/attendance/page.tsx', import.meta.url), 'utf8');
const payroll = readFileSync(new URL('../app/(dashboard)/admin/payroll/PayrollClient.tsx', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('admin neutral identity preserves navigation and interactive controls', () => {
  assert.match(shell, /portal-neutral-design admin-shell/);
  assert.match(shell, /PortalIdentityBlock/);
  assert.match(shell, /label='МОБО' subtitle='Центр управления'/);
  assert.match(shell, /AdminInboxBell/);
  assert.match(shell, /admin-sidebar-collapsed/);
  assert.match(shell, /md:w-\[240px\]/);
  assert.match(shell, /overflow-x-hidden overflow-y-auto/);
  assert.match(shell, /Свернуть меню/);
  assert.match(shell, /Развернуть меню/);
  assert.match(shell, /Контроль дня/);
  assert.match(shell, /Заявки/);
  assert.match(shell, /Закупки/);
  assert.match(shell, /График/);
  assert.match(shell, /Сотрудники/);
  assert.match(shell, /Зарплата/);
  assert.match(shell, /Служебное/);
  assert.match(inbox, /onClick=\{\(\) => \{ setOpen/);
  assert.match(inbox, /setInterval\(\(\) => void load\(\), 60_000\)/);
});

test('admin visual polish keeps operational meaning visible', () => {
  assert.match(shell, /МОБО · Центр управления/);
  assert.match(breadcrumbs, /text-\[#263b5c\]/);
  assert.match(attendance, /function summaryIconTone/);
  assert.match(attendance, /Опозданий/);
  assert.match(attendance, /bg-amber-50 text-amber-700/);
  assert.match(attendance, /bg-rose-50 text-rose-700/);
  assert.match(attendance, /bg-emerald-50 text-emerald-700/);
  assert.equal((payroll.match(/Список расчётов пока пуст/g) ?? []).length, 2);
  assert.equal((payroll.match(/После первого сохранения расчёт появится здесь\./g) ?? []).length, 2);
  assert.match(globals, /\.portal-neutral-design\.admin-shell \.admin-workspace table thead/);
  assert.match(globals, /\.portal-neutral-design\.admin-shell \.admin-dialog-panel/);
});
