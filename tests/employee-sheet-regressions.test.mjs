import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('app/(dashboard)/employee/EmployeeTodayClient.tsx', 'utf8');
const stale = readFileSync('app/(dashboard)/employee/StaleWorkdayCloseSheet.tsx', 'utf8');

test('drag targets the whole sheet and cancelled gestures do not dismiss', () => {
  assert.match(source, /closest<HTMLElement>\('\.employee-material-sheet'\)/);
  assert.doesNotMatch(source, /const sheet = event.currentTarget.parentElement/);
  assert.match(source, /onPointerCancel=\{\(\) => \{ startYRef.current = null; resetSheet\(\); \}\}/);
});

test('stale-day dialog is outside the material shell and uses shared viewport clearance', () => {
  assert.ok(source.indexOf('<StaleWorkdayCloseSheet') < source.indexOf("className='employee-material-shell"));
  assert.match(stale, /employee-workday-sheet-overlay fixed inset-0/);
  assert.match(source, /!staleCloseOpen && !deviationSheetKind/);
});

test('late-arrival display labels are concise without changing reason codes', () => {
  for (const text of ['Забыл отметить', 'Личная причина', 'Нет интернета', 'Сбой портала', 'Другое']) {
    assert.ok(source.includes(text));
  }
  assert.match(source, /isLate \? lateArrivalChoiceLabels\[value as keyof typeof lateArrivalReasons\] : label/);
  assert.doesNotMatch(source, /Начало смены уже зафиксировано/);
});
