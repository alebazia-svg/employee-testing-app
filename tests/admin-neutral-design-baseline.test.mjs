import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const shell = readFileSync(new URL('../components/AdminShell.tsx', import.meta.url), 'utf8');
const inbox = readFileSync(new URL('../components/AdminInboxBell.tsx', import.meta.url), 'utf8');

test('admin neutral identity preserves navigation and interactive controls', () => {
  assert.match(shell, /portal-neutral-design admin-shell/);
  assert.match(shell, /PortalIdentityBlock/);
  assert.match(shell, /AdminInboxBell/);
  assert.match(shell, /admin-sidebar-collapsed/);
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
