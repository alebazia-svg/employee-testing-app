import assert from 'node:assert/strict';
import { test } from 'node:test';
import { payrollFeatureState } from '../lib/payroll-features';

test('production is off by default; a leftover preview flag never enables salary access', () => {
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', PAYROLL_PWA_PREVIEW: '1' },
    { NODE_ENV: 'production', PAYROLL_EMPLOYEE_ENABLED: '1' }]) {
    assert.deepEqual(payrollFeatureState(env), { draftsEnabled: false, employeeEnabled: false });
  }
});
test('ADMIN drafts can be enabled before employee access; both explicit gates are required', () => {
  assert.deepEqual(payrollFeatureState({ NODE_ENV: 'production', PAYROLL_SERVER_DRAFTS_ENABLED: '1' }), { draftsEnabled: true, employeeEnabled: false });
  assert.deepEqual(payrollFeatureState({ NODE_ENV: 'production', PAYROLL_SERVER_DRAFTS_ENABLED: '1', PAYROLL_EMPLOYEE_ENABLED: '1' }), { draftsEnabled: true, employeeEnabled: true });
  assert.deepEqual(payrollFeatureState({ NODE_ENV: 'production', PAYROLL_SERVER_DRAFTS_ENABLED: 'true', PAYROLL_EMPLOYEE_ENABLED: '1' }), { draftsEnabled: false, employeeEnabled: false });
});
test('existing development preview remains local; missing environment grants no access', () => {
  assert.deepEqual(payrollFeatureState({ NODE_ENV: 'development', PAYROLL_PWA_PREVIEW: '1' }), { draftsEnabled: true, employeeEnabled: true });
  assert.deepEqual(payrollFeatureState({}), { draftsEnabled: false, employeeEnabled: false });
});
