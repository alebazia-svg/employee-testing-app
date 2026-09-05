import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPayrollEmployeeRuleActive,
  parsePayrollEmployeeRuleInput,
  PayrollEmployeeRuleValidationError,
} from '../lib/payroll-employee-rules';

test('derives the approved report group from the salary rule', () => {
  assert.deepEqual(parsePayrollEmployeeRuleInput({
    payrollSalaryType: 'wholesale_percent',
    payrollReportGroup: 'Произвольная группа',
    payrollRuleFrom: '2026-08',
    payrollRuleThrough: '',
  }), {
    payrollSalaryType: 'wholesale_percent',
    payrollReportGroup: 'Оптовые продажи',
    payrollFixedSalary: null,
    payrollRuleFrom: '2026-08',
    payrollRuleThrough: null,
  });
});

test('requires a non-negative amount for fixed salary', () => {
  assert.throws(
    () => parsePayrollEmployeeRuleInput({ payrollSalaryType: 'fixed_salary', payrollFixedSalary: '-1' }),
    PayrollEmployeeRuleValidationError,
  );
});

test('rejects an invalid effective period range', () => {
  assert.throws(
    () => parsePayrollEmployeeRuleInput({ payrollSalaryType: 'retail_sales_bonus', payrollRuleFrom: '2026-09', payrollRuleThrough: '2026-08' }),
    PayrollEmployeeRuleValidationError,
  );
});

test('clears dependent fields when salary rule is removed', () => {
  assert.deepEqual(parsePayrollEmployeeRuleInput({
    payrollSalaryType: '',
    payrollReportGroup: 'Закупки',
    payrollFixedSalary: 50000,
    payrollRuleFrom: '2026-08',
  }), {
    payrollSalaryType: null,
    payrollReportGroup: null,
    payrollFixedSalary: null,
    payrollRuleFrom: null,
    payrollRuleThrough: null,
  });
});

test('checks whether a rule applies to the selected payroll period', () => {
  const rule = { payrollRuleFrom: '2026-08', payrollRuleThrough: '2026-10' };
  assert.equal(isPayrollEmployeeRuleActive(rule, '2026-07'), false);
  assert.equal(isPayrollEmployeeRuleActive(rule, '2026-08'), true);
  assert.equal(isPayrollEmployeeRuleActive(rule, '2026-10'), true);
  assert.equal(isPayrollEmployeeRuleActive(rule, '2026-11'), false);
});
