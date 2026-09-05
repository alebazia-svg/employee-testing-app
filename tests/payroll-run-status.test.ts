import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canReplacePayrollFinal,
  isAllowedPayrollRunTransition,
  isPayrollRunStatus,
} from '../lib/payroll-run-status';

describe('payroll run final replacement policy', () => {
  it('allows a draft or checked run to become final', () => {
    assert.equal(isAllowedPayrollRunTransition('DRAFT', 'FINAL'), true);
    assert.equal(isAllowedPayrollRunTransition('CHECKED', 'FINAL'), true);
    assert.equal(canReplacePayrollFinal('DRAFT'), true);
    assert.equal(canReplacePayrollFinal('CHECKED'), true);
  });

  it('keeps superseded and final history immutable through the ordinary endpoint', () => {
    assert.equal(isAllowedPayrollRunTransition('FINAL', 'CHECKED'), false);
    assert.equal(isAllowedPayrollRunTransition('SUPERSEDED', 'FINAL'), false);
    assert.equal(canReplacePayrollFinal('FINAL'), false);
    assert.equal(canReplacePayrollFinal('SUPERSEDED'), false);
  });

  it('recognizes the audit-preserving superseded status', () => {
    assert.equal(isPayrollRunStatus('SUPERSEDED'), true);
    assert.equal(isPayrollRunStatus('DELETED'), false);
  });
});
