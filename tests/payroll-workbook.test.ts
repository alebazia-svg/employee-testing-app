import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getPayrollWorkbookComponentLabel,
  getPayrollWorkbookCalculationText,
  getPayrollWorkbookGroup,
  getPayrollWorkbookReviewCount,
  getPayrollWorkbookStatusLabel,
  isPayrollWorkbookPaidAdvanceCheck,
  isPayrollWorkbookSalaryTypeConfigured,
  sortPayrollWorkbookEmployees,
} from '../lib/payroll-workbook';

describe('payroll workbook presentation', () => {
  it('orders purchasing first, keeps departments together and sorts salaries inside a group', () => {
    const rows = sortPayrollWorkbookEmployees([
      { employeeName: 'Розница 1', salaryType: 'retail_sales_bonus', grossPay: 80_000 },
      { employeeName: 'Опт 2', salaryType: 'wholesale_percent', grossPay: 90_000 },
      { employeeName: 'Фикс', salaryType: 'fixed_salary', grossPay: 150_000 },
      { employeeName: 'Закупщик', salaryType: 'purchase_manager', grossPay: 100_000 },
      { employeeName: 'Опт 1', salaryType: 'wholesale_percent', grossPay: 110_000 },
      { employeeName: 'Операции', salaryType: 'vl_percent', grossPay: 100_000 },
      { employeeName: 'Розница 2', salaryType: 'retail_sales_bonus', grossPay: 120_000 },
    ]);

    assert.deepEqual(rows.map((row) => row.employeeName), [
      'Закупщик',
      'Опт 1',
      'Опт 2',
      'Розница 2',
      'Розница 1',
      'Операции',
      'Фикс',
    ]);
  });

  it('uses clear management labels', () => {
    assert.equal(getPayrollWorkbookGroup('purchase_manager'), 'Закупки');
    assert.equal(getPayrollWorkbookGroup('wholesale_percent'), 'Оптовые продажи');
    assert.equal(getPayrollWorkbookGroup('retail_sales_bonus'), 'Розничные продажи');
    assert.equal(getPayrollWorkbookGroup('vl_percent'), 'Операционное управление');
    assert.equal(getPayrollWorkbookGroup('fixed_salary'), 'Фиксированный оклад');
    assert.equal(getPayrollWorkbookStatusLabel('OK'), 'Готово');
    assert.equal(getPayrollWorkbookStatusLabel('REVIEW'), 'Проверить');
    assert.equal(getPayrollWorkbookComponentLabel('Кредитный бонус'), 'Кредиты: 10% валовой прибыли после вычета 9% налогов и издержек');
  });

  it('counts review items shown on the control sheet without duplicating an employee', () => {
    const employees = [
      { employeeName: 'Асад', salaryType: 'retail_sales_bonus', grossPay: 20_000, status: 'Готово' },
      { employeeName: 'Новый сотрудник', salaryType: 'not_configured', grossPay: 0, status: 'Проверить' },
    ];
    const checks = [
      ['Асад', 'Выплаченный аванс', 1, 'Проверить'],
      ['Новый сотрудник', 'Не настроено правило', 1, 'Проверить'],
      ['Расчёт в целом', 'Сотрудники в расчёте', 2, 'Готово'],
    ];

    assert.equal(getPayrollWorkbookReviewCount(employees, checks), 1);
    assert.equal(isPayrollWorkbookPaidAdvanceCheck(checks[0]), true);
  });

  it('shows the actual base, rate and result in calculation explanations', () => {
    assert.match(getPayrollWorkbookCalculationText('Бонус опта 1,75%', 6_623_805, 'общая база опта × 1,75%', 115_916.58), /6.623.805,00 ₽ × 1,75% = 115.916,58 ₽/);
    assert.match(getPayrollWorkbookCalculationText('Кредиты: 10% валовой прибыли после вычета 9% налогов и издержек', 10_000, 'ВП × 0,91 × 10%', 910), /10.000,00 ₽ × 91% × 10% = 910,00 ₽/);
    assert.match(getPayrollWorkbookCalculationText('Разовая премия', null, 'По решению руководителя', 20_000), /По решению руководителя = 20.000,00 ₽/);
  });

  it('keeps a new employee visible when the salary rule is not configured', () => {
    const rows = sortPayrollWorkbookEmployees([
      { employeeName: 'Новый сотрудник', salaryType: 'not_configured', grossPay: 0 },
      { employeeName: 'Розница', salaryType: 'retail_sales_bonus', grossPay: 50_000 },
    ]);

    assert.equal(getPayrollWorkbookGroup(rows[1].salaryType), 'Требует настройки');
    assert.equal(isPayrollWorkbookSalaryTypeConfigured(rows[0].salaryType), true);
    assert.equal(isPayrollWorkbookSalaryTypeConfigured(rows[1].salaryType), false);
  });
});
