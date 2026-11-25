import test from 'node:test';
import assert from 'node:assert/strict';
import { readPayrollApprovalTargets } from '../lib/payroll-approval-attention';
import { canCountFiscalTransfer } from '../lib/workday-review-attention';

test('receipt alert only counts reviews ready to send to an employee', () => {
  const reason = 'ONE_C_CANDIDATE_NOT_FOUND';
  const match = { status: 'mismatch', reasonCode: reason, oneCSourceRef: null, tbankComplete: true, oneCComplete: true };
  assert.equal(canCountFiscalTransfer(reason, match), true);
  assert.equal(canCountFiscalTransfer(reason, { ...match, status: 'confirmed' }), false);
  assert.equal(canCountFiscalTransfer(reason, { ...match, oneCSourceRef: 'check' }), false);
  assert.equal(canCountFiscalTransfer(reason, { ...match, oneCComplete: false }), false);
  for (const excluded of ['SOURCE_OFD_INCOMPLETE', 'ONE_C_POSSIBLE_SPLIT_SALE', 'ONE_C_COMBINED_PAYMENTS_REVIEW', 'OFD_CANDIDATE_REQUIRES_LINK']) {
    assert.equal(canCountFiscalTransfer(excluded, match), false);
    assert.equal(canCountFiscalTransfer(reason, { ...match, reasonCode: excluded }), false);
  }
});

test('payroll counts only checked, unfinalized past months with up-to-date verified inputs', async () => {
  const month = '2026-11';
  const automatic = (periodKey: string, verifiedThrough: string, approvedDayReviewIds: string[] = []) => ({
    kind: 'automatic-1c-v1', periodKey, verifiedThrough, approvalIssues: [], approvedDayReviewIds,
  });
  const db = {
    payrollPeriod: { async findMany(query: any) {
      assert.deepEqual(query.where, {
        status: { not: 'CLOSED' }, periodKey: { lt: month },
        runs: { some: { status: 'CHECKED' }, none: { status: 'FINAL' } },
      });
      assert.equal(query.select.runs.take, 1);
      return [
        { periodKey: '2026-10', runs: [{ id: 6, sourceSummary: automatic('2026-10', '2026-10-31', ['day-a']), reviewCount: 0 }] },
        { periodKey: '2026-09', runs: [{ id: 7, sourceSummary: automatic('2026-09', '2026-09-29'), reviewCount: 0 }] },
        { periodKey: '2026-08', runs: [{ id: 8, sourceSummary: automatic('2026-08', '2026-08-31'), reviewCount: 0 }] },
        { periodKey: '2026-07', runs: [{ id: 9, sourceSummary: null, reviewCount: 0 }] },
      ];
    } },
    payrollDayReview: { async findMany(query: any) {
      assert.equal(query.where.accessOnly, false);
      return [
        { periodKey: '2026-10', status: 'approved', id: 'day-a' },
        { periodKey: '2026-08', status: 'approved', id: 'newer-day' },
        { periodKey: '2026-07', status: 'pending', id: 'not-reviewed' },
      ];
    } },
  };
  assert.deepEqual(await readPayrollApprovalTargets(db as never, month, true), [{ periodKey: '2026-10', runId: 6 }]);
});
