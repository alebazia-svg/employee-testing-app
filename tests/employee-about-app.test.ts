import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getReleaseInfo } from '../lib/release-info';

test('PWA and ADMIN share public version/date with a safe unknown-date fallback', () => {
  const keys = ['NEXT_PUBLIC_APP_VERSION', 'NEXT_PUBLIC_APP_BUILT_AT'] as const;
  const saved = keys.map(key => process.env[key]);
  try {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.1.0-rc.2';
    process.env.NEXT_PUBLIC_APP_BUILT_AT = '2026-10-04T12:00:00Z';
    const info = getReleaseInfo();
    assert.equal(info.version, '1.1.0-rc.2');
    assert.equal(info.preview, true);
    assert.match(info.date!, /15:00/);
    process.env.NEXT_PUBLIC_APP_BUILT_AT = 'invalid';
    assert.equal(getReleaseInfo().date, null);
    process.env.NEXT_PUBLIC_APP_VERSION = '1.1.0';
    assert.equal(getReleaseInfo().preview, false);
  } finally {
    keys.forEach((key, index) => saved[index] === undefined ? delete process.env[key] : process.env[key] = saved[index]);
  }
});

test('about popover is read-only, anchored, dismissible and non-modal', () => {
  const source = readFileSync(new URL('../components/EmployeeAboutApp.tsx', import.meta.url), 'utf8');
  assert.match(source, /getReleaseInfo\(\)/);
  assert.match(source, /role='region'/);
  assert.match(source, /rect.bottom \+ 8/);
  assert.match(source, /trigger.current!\.getBoundingClientRect\(\)/);
  assert.match(source, /Math.min\(280, viewportWidth - 32\)/);
  assert.match(source, /Math.min\(rect.left, viewportWidth - width - 16\)/);
  assert.doesNotMatch(source, /setTimeout|setInterval/);
  assert.match(source, /document.addEventListener\('pointerdown', outside\)/);
  assert.match(source, /setOpen\(value => !value\)/);
  assert.doesNotMatch(source, /showModal|backdrop:|body.style.overflow/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|\.revision|\.source/);
  const header = readFileSync(new URL('../app/(dashboard)/employee/EmployeePortalHeader.tsx', import.meta.url), 'utf8');
  assert.match(header, /<EmployeeAboutApp>\s*<img[^>]+alt='MOBO'/);
  assert.match(source, /aria-label='О приложении MOBO'/);
  assert.doesNotMatch(header, /<EmployeeAboutApp name=/);
  assert.match(header, /<WorkdayNotificationsClient \/>/);
  assert.match(header, /confirmBeforeLogout/);
});
