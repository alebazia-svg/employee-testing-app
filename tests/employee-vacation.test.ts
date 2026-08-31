import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeVacationHasStarted, vacationIncludesDate, validateVacationRange } from '@/lib/employee-vacation';

test('vacation includes both range boundaries', () => {
  const vacation = { status: 'active', dateFrom: '2026-09-03', dateTo: '2026-09-08' };
  assert.equal(vacationIncludesDate(vacation, '2026-09-02'), false);
  assert.equal(vacationIncludesDate(vacation, '2026-09-03'), true);
  assert.equal(vacationIncludesDate(vacation, '2026-09-08'), true);
  assert.equal(vacationIncludesDate(vacation, '2026-09-09'), false);
});

test('cancelled vacation is never effective', () => {
  assert.equal(vacationIncludesDate({ status: 'cancelled', dateFrom: '2026-09-03', dateTo: '2026-09-08' }, '2026-09-05'), false);
});

test('employee vacation range rejects past and reversed dates', () => {
  assert.match(validateVacationRange('2026-08-31', '2026-09-03', '2026-09-01') ?? '', /Прошедший/);
  assert.match(validateVacationRange('2026-09-08', '2026-09-03', '2026-09-01') ?? '', /окончания/);
  assert.equal(validateVacationRange('2026-09-03', '2026-09-08', '2026-09-01'), null);
});

test('employee cannot edit a vacation once its first day has started', () => {
  assert.equal(employeeVacationHasStarted('2026-09-02', '2026-09-01'), false);
  assert.equal(employeeVacationHasStarted('2026-09-01', '2026-09-01'), true);
  assert.equal(employeeVacationHasStarted('2026-08-31', '2026-09-01'), true);
});
