import assert from 'node:assert/strict';
import test from 'node:test';
import { departmentScheduleTarget, scheduleCoverage, scheduleCoverageCopy, schedulePersonLabel, schedulePersonName, scheduleWorkingCountAfterChange } from '../lib/work-schedule-coverage';

test('retail and wholesale target two employees without blocking reduced staffing', () => {
  assert.equal(departmentScheduleTarget('retail'), 2);
  assert.equal(departmentScheduleTarget('wholesale'), 2);
  assert.deepEqual(scheduleCoverage('retail', 2), { targetCount: 2, workingCount: 2, state: 'full', needsReplacement: false });
  assert.deepEqual(scheduleCoverage('retail', 1), { targetCount: 2, workingCount: 1, state: 'reduced', needsReplacement: true });
  assert.deepEqual(scheduleCoverage('retail', 0), { targetCount: 2, workingCount: 0, state: 'empty', needsReplacement: true });
});

test('coverage copy distinguishes reduced and empty department states', () => {
  assert.match(scheduleCoverageCopy(scheduleCoverage('retail', 1)).title, /один сотрудник/);
  assert.match(scheduleCoverageCopy(scheduleCoverage('retail', 0)).title, /никто не выходит/);
});

test('coverage transition counts only the changed employee once', () => {
  assert.equal(scheduleWorkingCountAfterChange({ workingBefore: 2, previousStatus: 'working', nextStatus: 'off' }), 1);
  assert.equal(scheduleWorkingCountAfterChange({ workingBefore: 1, previousStatus: 'off', nextStatus: 'working' }), 2);
  assert.equal(scheduleWorkingCountAfterChange({ workingBefore: 1, previousStatus: null, nextStatus: 'working' }), 2);
  assert.equal(scheduleWorkingCountAfterChange({ workingBefore: 0, previousStatus: null, nextStatus: 'off' }), 0);
});

test('employee schedule uses first names while preserving a safe fallback', () => {
  assert.equal(schedulePersonName('Абшаева Зухра'), 'Зухра');
  assert.equal(schedulePersonName('Стажёр / Чеченова Милана'), 'Милана');
  assert.equal(schedulePersonName('Магомед'), 'Магомед');
  assert.equal(schedulePersonLabel('Чеченова Милана', ['Чеченова Милана', 'Алиева Милана']), 'Милана Ч.');
  assert.equal(schedulePersonLabel('Абшаева Зухра', ['Абшаева Зухра', 'Костеренко Магомед']), 'Зухра');
});
