import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../app/(dashboard)/employee/EmployeeTodayClient.tsx', import.meta.url), 'utf8');

test('retry is available only for an online, failed, idle queued upload', () => {
  assert.match(source, /isOnline && cashOutboxCount > 0 && !cashOutboxSyncing && cashOutboxError \? \(/);
  assert.match(source, /onClick=\{\(\) => void flushCashOutbox\(\)\}>\s*Повторить отправку/);
  assert.doesNotMatch(source, /\(!isOnline \|\| \(cashOutboxCount > 0 && !cashOutboxSyncing\)\)/);
});

test('connection notice retains offline persistence and error details', () => {
  assert.match(source, /role='status' className=\{`pwa-connection-status/);
  assert.match(source, /Инкассация сохранена на телефоне и отправится после восстановления связи/);
  assert.match(source, /Сумма и фото сохранены на телефоне\. \$\{cashOutboxError\}/);
});

test('early finish stays guarded and appears once alongside active shift', () => {
  const label = source.indexOf('className=\'pwa-early-finish');
  assert.ok(label > source.indexOf("className='pwa-workday-summary-top'"));
  assert.ok(label < source.indexOf('{needsLateArrivalReason && (', label));
  assert.equal((source.match(/onClick=\{openEarlyFinishSheet\}/g) || []).length, 1);
  assert.match(source.slice(label - 250, label), /activeWorkDay && shiftControlState\.run && !earlyFinishDeviation && shiftEnd !== null && shiftEnd !== undefined && getMoscowMinutes\(displayNow\) < shiftEnd/);
});

test('compact summary retains times and lateness outside the action row', () => {
  const shell = source.indexOf("className='pwa-workday-summary-shell'");
  const action = source.indexOf("className='pwa-early-finish", shell);
  const late = source.indexOf("className='pwa-late-status'", shell);
  assert.ok(shell > 0 && action > shell && late > action);
  assert.match(source.slice(shell, action), /formatTime\(workDay!\.startedAt\)/);
  assert.match(source.slice(shell, action), /minutesToTime\(shiftEnd\)/);
  assert.match(source.slice(shell, action), /<span>Начало \{formatTime\(workDay!\.startedAt\)\} ·/);
  assert.doesNotMatch(source, /pwa-shift-summary-actions/);
  const css = readFileSync(new URL('../public/pwa-copper.css', import.meta.url), 'utf8');
  assert.match(css, /pwa-workday-summary-shell \{ display:grid; grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(source.slice(action, action + 250), /min-h-11/);
  assert.match(css, /pwa-workday-summary-facts \{ min-height:44px; flex-direction:row/);
});
