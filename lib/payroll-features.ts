type PayrollFeatureEnv = {
  NODE_ENV?: string;
  PAYROLL_PWA_PREVIEW?: string;
  PAYROLL_SERVER_DRAFTS_ENABLED?: string;
  PAYROLL_EMPLOYEE_ENABLED?: string;
};

/** Deploy/migrate first, verify ADMIN inputs, then enable personal salaries. */
export function payrollFeatureState(env: PayrollFeatureEnv = process.env) {
  const preview = env.NODE_ENV === 'development' && env.PAYROLL_PWA_PREVIEW === '1';
  const draftsEnabled = preview || env.PAYROLL_SERVER_DRAFTS_ENABLED === '1';
  return { draftsEnabled, employeeEnabled: draftsEnabled && (preview || env.PAYROLL_EMPLOYEE_ENABLED === '1') };
}
