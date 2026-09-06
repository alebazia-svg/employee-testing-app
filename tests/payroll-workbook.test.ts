import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPayrollWorkbookEmployeeComment,
  formatPayrollWorkbookNote,
  formatPayrollWorkbookBonusReason,
  getPayrollWorkbookAccessorySummary,
  getPayrollWorkbookComponentLabel,
  getPayrollWorkbookCalculationText,
  getPayrollWorkbookGroup,
  getPayrollWorkbookReviewCount,
  getPayrollWorkbookStatusLabel,
  isPayrollWorkbookPaidAdvanceCheck,
  isPayrollWorkbookSalaryTypeConfigured,
  normalizePayrollWorkbookReviewReason,
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
    assert.equal(getPayrollWorkbookComponentLabel('Аксессуары 7%'), 'Аксессуары: 7% выручки');
    assert.equal(getPayrollWorkbookComponentLabel('ВЛ 12%'), '12% от начислений команды');
    assert.equal(getPayrollWorkbookComponentLabel('Доведение закупщика до 100 000'), 'Доплата до минимальной зарплаты');
    assert.equal(getPayrollWorkbookComponentLabel('Доведение Бэлы до 100 000'), 'Доплата до минимальной зарплаты');
  });

  it('keeps only actionable review notes and avoids repeated prefixes', () => {
    assert.equal(normalizePayrollWorkbookReviewReason('Проверить: расчёт по закупкам выше целевой ЗП'), null);
    assert.equal(normalizePayrollWorkbookReviewReason('Не полностью проверена база расчёта 12%'), null);
    assert.equal(normalizePayrollWorkbookReviewReason('Посещаемость по форме не подтверждена'), 'Не указаны опоздания');
    assert.equal(formatPayrollWorkbookNote('Проверить', 'Проверить: Не указаны опоздания'), 'Проверить: Не указаны опоздания');
    assert.equal(formatPayrollWorkbookNote('Готово', 'Опоздания: 1'), 'Опоздания: 1');
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
    assert.match(getPayrollWorkbookCalculationText('Аксессуары: 7% выручки', 1_186_055, 'личная база × 7%', 83_023.85), /1.186.055,00 ₽ × 7% = 83.023,85 ₽/);
    assert.match(getPayrollWorkbookCalculationText('Разовая премия', null, '', 20_000), /^20.000,00 ₽$/);
  });

  it('keeps bonus reasons concise and shows the accessory threshold once at group level', () => {
    assert.equal(formatPayrollWorkbookBonusReason('Тохов Астемир', 'Рекордные результаты оптового отдела. Решение руководителя.'), 'Результат по закупкам свыше 100 000 ₽');
    assert.equal(formatPayrollWorkbookBonusReason('Ахобекова Залина', 'Рекордные результаты оптового отдела. Основной вклад в продажи; решение руководителя.'), 'Основной вклад в рекорд оптовых продаж');
    assert.equal(formatPayrollWorkbookBonusReason('Другой сотрудник', 'Доплата за проект'), 'Доплата за проект');
    assert.equal(getPayrollWorkbookAccessorySummary([
      ['Уровень аксессуаров', '1 186 055,00 ₽ / порог 1 000 000,00 ₽', 'Порог превышен'],
      ['Ставка аксессуаров', '7%', 'Применяется к рознице'],
    ]), 'Аксессуары 7%: 1 186 055 ₽ > 1 000 000 ₽');
    assert.equal(getPayrollWorkbookAccessorySummary([
      ['Ставка аксессуаров', '5%', 'Фиксированная ставка'],
    ]), 'Аксессуары: фиксированная ставка 5%');
    assert.equal(getPayrollWorkbookAccessorySummary([
      ['Уровень аксессуаров', '1 186 055,00 ₽ / порог 1 000 000,00 ₽', 'Порог превышен; ставка остаётся фиксированной'],
      ['Ставка аксессуаров', '5%', 'Фиксированная ставка'],
    ]), 'Аксессуары 5%: 1 186 055 ₽ > 1 000 000 ₽');
  });

  it('keeps only exceptional and actionable information in employee comments', () => {
    assert.equal(buildPayrollWorkbookEmployeeComment({
      employeeName: 'Тохов Астемир',
      lateCount: 0,
      deduction: 0,
      manualComment: 'Рекордные результаты оптового отдела. Решение руководителя.',
      reviewReasons: ['расчёт по закупкам выше целевой ЗП', 'Не полностью проверена база расчёта 12%'],
      bonuses: [{ amount: 20_000, reason: 'Рекордные результаты оптового отдела. Решение руководителя.' }],
    }), 'Премия 20\u00a0000,00 ₽ — Результат по закупкам свыше 100 000 ₽');

    assert.equal(buildPayrollWorkbookEmployeeComment({
      employeeName: 'Сотрудник',
      lateCount: 2,
      deduction: 1_500,
      manualComment: 'Возврат подотчётной суммы',
      reviewReasons: ['Проверить: Не настроено правило зарплаты'],
      bonuses: [],
    }), 'Удержание 1\u00a0500,00 ₽ — Возврат подотчётной суммы · Опоздания: 2 · Не настроено правило зарплаты');
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
