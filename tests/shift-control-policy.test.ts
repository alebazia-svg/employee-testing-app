import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShiftHandoverSteps, employeeKkmReportPhotosRequired } from '../lib/shift-control-policy';

test('normal employee handover never asks for a KKM opening, closing or Z-report photo', () => {
  assert.equal(employeeKkmReportPhotosRequired, false);
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 40_000,
    cashCommentRequired: false,
    isRetail: true,
    isClosingShift: true,
  }), ['personalCashBalance', 'reserveCashBalance']);
});

test('cash discrepancy and encashment remain in the handover flow', () => {
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 50_001,
    cashCommentRequired: true,
    isRetail: true,
    isClosingShift: true,
  }), ['personalCashBalance', 'discrepancy', 'reserveCashBalance', 'encashment']);
});

test('legacy Z-report step can still be reconstructed for historical UI compatibility', () => {
  assert.deepEqual(buildShiftHandoverSteps({
    personalCashBalance: 0,
    cashCommentRequired: false,
    isRetail: true,
    isClosingShift: true,
    requireKkmReportPhoto: true,
  }), ['personalCashBalance', 'reserveCashBalance', 'zReportPhoto']);
});
