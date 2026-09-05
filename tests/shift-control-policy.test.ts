import assert from 'node:assert/strict';
import test from 'node:test';
import { activeEmployeeShiftTemplateTasks, buildShiftHandoverSteps, employeeKkmReportPhotosRequired } from '../lib/shift-control-policy';

test('retail templates cannot recreate manual acquiring tasks after automatic reconciliation', () => {
  const tasks = [
    { category: 'cash', title: 'Пересчитать наличные' },
    { category: 'acquiring', title: 'Проверка операций терминала' },
    { category: 'handover', title: 'Сдать смену' },
  ];

  assert.deepEqual(activeEmployeeShiftTemplateTasks('retail', tasks), [tasks[0], tasks[2]]);
  assert.deepEqual(activeEmployeeShiftTemplateTasks('wholesale', tasks), tasks);
});

test('retail store closer recounts reserve without a routine Z-report photo', () => {
  assert.equal(employeeKkmReportPhotosRequired, false);
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 40_000,
    cashCommentRequired: false,
    isRetail: true,
    isStoreClosingShift: true,
    requiresKkmClose: true,
  }), ['personalCashBalance', 'reserveCashBalance']);
});

test('only the retail closing shift recounts the shared reserve', () => {
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 40_000,
    cashCommentRequired: false,
    isRetail: true,
    isStoreClosingShift: false,
    requiresKkmClose: true,
  }), ['personalCashBalance']);
});

test('every retail employee can fall back to a Z-report photo when KKM verification fails', () => {
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 0,
    cashCommentRequired: false,
    isRetail: true,
    isStoreClosingShift: false,
    requiresKkmClose: true,
    requireKkmReportPhoto: true,
  }), ['personalCashBalance', 'zReportPhoto']);
});

test('cash discrepancy and encashment remain in the handover flow', () => {
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 50_001,
    cashCommentRequired: true,
    isRetail: true,
    isStoreClosingShift: true,
    requiresKkmClose: false,
  }), ['personalCashBalance', 'discrepancy', 'reserveCashBalance', 'encashment']);
});

test('legacy Z-report step can still be reconstructed for historical UI compatibility', () => {
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 0,
    cashCommentRequired: false,
    isRetail: true,
    isStoreClosingShift: true,
    requiresKkmClose: true,
    requireKkmReportPhoto: true,
  }), ['personalCashBalance', 'reserveCashBalance', 'zReportPhoto']);
});
