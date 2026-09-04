import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PayrollBonusesEditor } from '../app/(dashboard)/admin/payroll/PayrollBonusesEditor';
import { parseFinboxReport } from '../lib/payroll-finbox';
import { PAYROLL_COMPENSATION_VERSION, getInitialPayrollBonuses, validatePayrollBonuses, validatePayrollCompensationSnapshot, validatePayrollCompensationVersion, type PayrollBonus } from '../lib/payroll-compensation';

type SalesRow = {
  manager: string;
  client: string;
  category: string;
  item: string;
  registrar: string;
  registrars: string[];
  revenue: number;
  cost: number;
  grossProfit: number;
  profitability: number;
};

type PayrollModule = {
  classifySalesRows: (rows: SalesRow[]) => {
    rows: Array<SalesRow & { calculationType: string; base: number; bonus: number }>;
    wholesale: {
      totalRevenue: number;
      excludedTechRevenue: number;
      base: number;
      bonusEach: number;
    };
    managerSummaries: Array<{
      manager: string;
      department: string;
      revenue: number;
      grossProfit: number;
      creditBonus: number;
      filmBonus: number;
      plotterBonus: number;
      techBonus: number;
      accessoryBonus: number;
      wholesaleBonus: number;
      totalBonus: number;
    }>;
  };
  buildFullPayrollRow: (
    summary: {
      manager: string;
      department: string;
      revenue: number;
      grossProfit: number;
      creditBonus: number;
      filmBonus: number;
      plotterBonus: number;
      techBonus: number;
      accessoryBonus: number;
      wholesaleBonus: number;
      totalBonus: number;
    },
    manual:
      | {
          workedDays: string;
          lateCount: string;
          advance: string;
          comment: string;
          agentCreditCommission?: string;
        }
      | undefined,
  ) => {
    workedDays: number | null;
    lateCount: number | null;
    dayPay: number;
    salesBonus: number;
    agentCreditCommission: number;
    grossPay: number;
    netPay: number;
    manager: string;
    advance: number;
    fixedDeduction: number;
    salaryRule: string;
    payrollReasons: string[];
    belaBase?: number;
    belaPercentAmount?: number;
    minimumGuaranteeAdjustment?: number;
    oneTimeBonus?: number;
  };
  applyBelaPercentRule: (rows: ReturnType<PayrollModule['buildFullPayrollRow']>[], periodKey: string) => ReturnType<PayrollModule['buildFullPayrollRow']>[];
  applyPayrollBonuses: (rows: ReturnType<PayrollModule['buildFullPayrollRow']>[], bonuses: PayrollBonus[]) => ReturnType<PayrollModule['buildFullPayrollRow']>[];
  buildPurchasePayrollRow: (input: { advance: string; deduction: string; comment: string }, report: { fileName: string; base: number; sourceRow: number } | null) => ReturnType<PayrollModule['buildFullPayrollRow']>;
};

async function loadPayrollModule(): Promise<PayrollModule> {
  const sourcePath = resolve('app/(dashboard)/admin/payroll/PayrollClient.tsx');
  const generatedPath = resolve('tests/.generated/payroll-page-test-module.tsx');
  const source = readFileSync(sourcePath, 'utf8');
  // Exercise the real calculation functions without importing the dashboard UI
  // (its browser-only icon exports cannot be resolved by the Node test runner).
  const start = source.indexOf('type CellValue =');
  const end = source.indexOf('export default function AdminPayrollPage()');
  assert.ok(start > 0 && end > start, 'Payroll calculation boundaries must exist');
  const calculationSource = source.slice(start, end);

  mkdirSync(dirname(generatedPath), { recursive: true });
  writeFileSync(generatedPath, `import { getBelaMinimum, getPayrollBonusTotal, isBelaBaseEmployee, payrollMoney, type PayrollBonus } from '../../lib/payroll-compensation';\n${calculationSource}\nexport { classifySalesRows, buildFullPayrollRow, applyBelaPercentRule, applyPayrollBonuses, buildPurchasePayrollRow };\n`, 'utf8');

  return import(pathToFileURL(generatedPath).href) as Promise<PayrollModule>;
}

let buildFullPayrollRow: PayrollModule['buildFullPayrollRow'];
let classifySalesRows: PayrollModule['classifySalesRows'];
let applyBelaPercentRule: PayrollModule['applyBelaPercentRule'];
let applyPayrollBonuses: PayrollModule['applyPayrollBonuses'];
let buildPurchasePayrollRow: PayrollModule['buildPurchasePayrollRow'];

before(async () => {
  const payrollModule = await loadPayrollModule();
  buildFullPayrollRow = payrollModule.buildFullPayrollRow;
  classifySalesRows = payrollModule.classifySalesRows;
  applyBelaPercentRule = payrollModule.applyBelaPercentRule;
  applyPayrollBonuses = payrollModule.applyPayrollBonuses;
  buildPurchasePayrollRow = payrollModule.buildPurchasePayrollRow;
});

describe('August 2026 minimum and one-time premiums', () => {
  function payrollRow(manager: string, grossPay: number, advance = 0) {
    const row = buildFullPayrollRow({ manager, department: 'Розница', revenue: 0, grossProfit: 0, creditBonus: 0, filmBonus: 0, plotterBonus: 0, techBonus: 0, accessoryBonus: 0, wholesaleBonus: 0, totalBonus: 0 }, { workedDays: '20', lateCount: '0', advance: String(advance), comment: '' });
    return { ...row, grossPay, netPay: grossPay - advance, payrollReasons: [] };
  }
  function calculate(base: number, period = '2026-08', advance = 0, bonuses: PayrollBonus[] = []) {
    return applyPayrollBonuses(applyBelaPercentRule([payrollRow('Кештова Бэла', 0, advance), payrollRow('Тохов Астемир', base)], period), bonuses);
  }
  it('preserves the July rule and starts the guarantee in August', () => {
    assertMoney(calculate(700000, '2026-07')[0].grossPay, 84000);
    const bela = calculate(700000)[0];
    assertMoney(bela.belaPercentAmount!, 84000);
    assertMoney(bela.minimumGuaranteeAdjustment!, 16000);
    assertMoney(bela.grossPay, 100000);
    assertMoney(calculate(700000, '2026-09')[0].grossPay, 100000);
  });
  it('does not cap a calculation above 100000 and subtracts advances after the floor', () => {
    assertMoney(calculate(900000)[0].grossPay, 108000);
    assertMoney(calculate(900000)[0].minimumGuaranteeAdjustment!, 0);
    assertMoney(calculate(700000, '2026-08', 30000)[0].netPay, 70000);
    assertMoney(calculate(100000 / 0.12)[0].minimumGuaranteeAdjustment!, 0);
  });
  it('keeps premiums outside the 12% base and adds Bela premiums above her guarantee', () => {
    const bonuses = validatePayrollBonuses([
      { id: 'a', employeeName: 'Тохов Астемир', amount: '20000', reason: 'Рекорд' },
      { id: 'b', employeeName: 'Кештова Бэла', amount: '5000', reason: 'Премия' },
    ], ['Тохов Астемир', 'Кештова Бэла']);
    const rows = calculate(900000, '2026-08', 0, bonuses);
    assertMoney(rows[0].belaBase!, 900000);
    assertMoney(rows[0].grossPay, 113000);
    assertMoney(rows[1].grossPay, 920000);
    assertMoney(calculate(700000, '2026-08', 0, bonuses)[0].grossPay, 105000);
  });
  it('does not absorb Astemir premiums into his minimum or alter his existing formula', () => {
    const row = buildPurchasePayrollRow({ advance: '30000', deduction: '1000', comment: '' }, { fileName: 'demo.csv', base: 4000000, sourceRow: 2 });
    const bonuses = validatePayrollBonuses(getInitialPayrollBonuses('2026-08').slice(0, 1), ['Тохов Астемир']);
    const result = applyPayrollBonuses([row], bonuses)[0];
    assertMoney(row.grossPay, 100000);
    assertMoney(result.grossPay, 120000);
    assertMoney(result.netPay, 89000);
    assertMoney(buildPurchasePayrollRow({ advance: '', deduction: '', comment: '' }, { fileName: 'demo.csv', base: 6000000, sourceRow: 2 }).grossPay, 117000);
  });
  it('prefills only the approved August awards and returns independent drafts', () => {
    const drafts = getInitialPayrollBonuses('2026-08');
    assert.deepEqual(drafts.map((row) => row.amount), ['20000', '15000', '5000']);
    drafts[0].amount = '1';
    assert.equal(getInitialPayrollBonuses('2026-08')[0].amount, '20000');
    assert.deepEqual(getInitialPayrollBonuses('2026-07'), []);
    assert.deepEqual(getInitialPayrollBonuses('2026-09'), []);
  });
  it('rejects incomplete, negative, excessive precision, duplicate and unmapped awards', () => {
    const draft = { id: 'one', employeeName: 'Тохов Астемир', amount: '20 000,50', reason: 'Рекорд' };
    assert.equal(validatePayrollBonuses([draft], [draft.employeeName])[0].amount, 20000.5);
    for (const amount of ['', '0', '-1', 'NaN', '1.001', '1e3', 'Infinity']) assert.throws(() => validatePayrollBonuses([{ ...draft, amount }], [draft.employeeName]));
    assert.throws(() => validatePayrollBonuses([{ ...draft, reason: '  ' }], [draft.employeeName]));
    assert.throws(() => validatePayrollBonuses([draft, draft], [draft.employeeName]));
    assert.throws(() => validatePayrollBonuses([draft], []));
    assert.deepEqual(validatePayrollBonuses([], []), []);
  });
  it('validates persisted premium totals and rejects an altered guarantee', () => {
    const purchase = buildPurchasePayrollRow({ advance: '', deduction: '', comment: '' }, { fileName: 'demo', base: 4000000, sourceRow: 2 });
    const rows = applyPayrollBonuses(applyBelaPercentRule([payrollRow('Кештова Бэла', 0), purchase], '2026-08'), []).map((row) => ({ ...row, employeeName: row.manager, calculationDetails: row.salaryRule === 'belaPercent' ? [
      { component: 'ВЛ 12%', amount: 12000 }, { component: 'Доведение Бэлы до 100 000', amount: 88000 },
      { component: 'Аванс', amount: 0 }, { component: 'К выплате', amount: 100000 },
    ] : [
      { component: 'Оплата по дням', amount: 12000 }, { component: 'Закупки 1,75%', amount: 70000 },
      { component: 'Доведение закупщика до 100 000', amount: 18000 }, { component: 'Аванс', amount: 0 },
      { component: 'Удержание', amount: 0 }, { component: 'К выплате', amount: 100000 },
    ] }));
    const totals = { grossPay: 200000, netPay: 200000, advance: 0 };
    assert.doesNotThrow(() => validatePayrollCompensationSnapshot(rows, [], '2026-08', totals));
    assert.throws(() => validatePayrollCompensationSnapshot([{ ...rows[0], grossPay: 101000, netPay: 101000 }, rows[1]], [], '2026-08', totals));
    assert.throws(() => validatePayrollCompensationSnapshot(rows, [], '2026-08', { ...totals, grossPay: 1 }));
  });
  it('keeps incomplete source warnings visible rather than declaring the guaranteed result ready', () => {
    const rows = applyBelaPercentRule([payrollRow('Кештова Бэла', 0), { ...payrollRow('Тохов Астемир', 12000), payrollReasons: ['Отчёт закупок не загружен'] }], '2026-08');
    assert.ok(rows[0].payrollReasons.includes('Не полностью проверена база расчёта 12%'));
  });
});

describe('payroll save safety gates', () => {
  it('rejects stale clients from August onward without changing July compatibility', () => {
    assert.doesNotThrow(() => validatePayrollCompensationVersion(undefined, undefined, '2026-07'));
    for (const period of ['2026-08', '2026-09', '2027-01']) {
      assert.throws(() => validatePayrollCompensationVersion(undefined, undefined, period), /актуальная версия/);
      assert.doesNotThrow(() => validatePayrollCompensationVersion(PAYROLL_COMPENSATION_VERSION, [], period));
    }
    assert.throws(() => validatePayrollCompensationVersion('old', [], '2026-07'), /Неизвестная/);
    assert.throws(() => validatePayrollCompensationVersion(undefined, [], '2026-07'), /новая версия/);
  });
  function fixture() {
    const bonuses = validatePayrollBonuses([{ id: 'fixed', employeeName: 'Улубиев Марат', amount: '7000', reason: 'За результат' }], ['Улубиев Марат']);
    const row = { employeeName: 'Улубиев Марат', salaryType: 'fixed_salary', salaryRule: 'fixedSalary', fixedSalary: 10000, fixedBonus: 1000, fixedDeduction: 500, advance: 2000, oneTimeBonus: 7000, grossPay: 18000, netPay: 15500,
      calculationDetails: [
        { component: 'Фиксированный оклад', amount: 10000 }, { component: 'Премия', amount: 1000 },
        { component: 'Разовая премия', amount: 7000, comment: 'За результат' },
        { component: 'Аванс', amount: -2000 }, { component: 'Удержание', amount: -500 }, { component: 'К выплате', amount: 15500 },
      ],
    };
    return { row, bonuses, totals: { grossPay: 18000, netPay: 15500, advance: 2000 } };
  }
  it('accepts regular plus one-time fixed bonuses without double counting', () => {
    const { row, bonuses, totals } = fixture();
    assert.doesNotThrow(() => validatePayrollCompensationSnapshot([row], bonuses, '2026-08', totals));
  });
  it('rejects missing, duplicate, nonfinite and wrong payout details', () => {
    const { row, bonuses, totals } = fixture();
    for (const calculationDetails of [undefined, [], [null], [...row.calculationDetails, row.calculationDetails[0]], row.calculationDetails.map(item => item.component === 'К выплате' ? { ...item, amount: 1 } : item), row.calculationDetails.map(item => ({ ...item, amount: NaN }))]) {
      assert.throws(() => validatePayrollCompensationSnapshot([{ ...row, calculationDetails }], bonuses, '2026-08', totals));
    }
  });
  it('rejects compensating component errors even when their sum still matches', () => {
    const { row, bonuses, totals } = fixture();
    row.calculationDetails[0].amount += 100;
    row.calculationDetails[1].amount -= 100;
    assert.throws(() => validatePayrollCompensationSnapshot([row], bonuses, '2026-08', totals));
  });
  it('matches each premium and its reason rather than only the aggregate', () => {
    const { row, bonuses, totals } = fixture();
    row.calculationDetails[2].comment = 'Другая причина';
    assert.throws(() => validatePayrollCompensationSnapshot([row], bonuses, '2026-08', totals));
    row.calculationDetails[2].comment = 'За результат';
    row.calculationDetails[2].component = 'Премия';
    assert.throws(() => validatePayrollCompensationSnapshot([row], bonuses, '2026-08', totals));
  });
  it('preserves existing per-component Excel rounding, including fractional and negative amounts', () => {
    const row = { employeeName: 'Чеченова Милана', salaryType: 'retail_sales_bonus', salaryRule: 'standard', dayPay: 0, filmBonus: 1.004, plotterBonus: 0, techBonus: -0.006, accessoryBonus: 1.004, creditBonus: 0, disciplineBonus: 0, agentCreditCommission: 0, advance: 0, fixedDeduction: 0, oneTimeBonus: 0, grossPay: 2.002, netPay: 2.002,
      calculationDetails: [{ component: 'Услуги оказываемые 50%', amount: 1 }, { component: 'Техника 10% от ВП', amount: -0.01 }, { component: 'Аксессуары 5%', amount: 1 }, { component: 'Аванс', amount: 0 }, { component: 'К выплате', amount: 2 }],
    };
    assert.doesNotThrow(() => validatePayrollCompensationSnapshot([row], [], '2026-07', { grossPay: 2.002, netPay: 2.002, advance: 0 }));
  });
});

describe('payroll detail opening', () => {
  const source = readFileSync(resolve('app/(dashboard)/admin/payroll/PayrollClient.tsx'), 'utf8');
  const expression = source.match(/const selectedManagerStatus = ([\s\S]*?);\n/)?.[1];
  assert.ok(expression, 'The live detail status selector must exist');
  const selectStatus = new Function('selectedManagerPayroll', 'selectedManagerSummary', 'classification', 'getManagerStatus', `return (${expression});`);
  it('opens Bela without personal sales and preserves payroll warnings', () => {
    const row = { salaryType: 'vl_percent', payrollStatus: 'Проверить', payrollReasons: ['Не полностью проверена база расчёта 12%'] };
    assert.deepEqual(selectStatus(row, null, {}, () => { throw Error('Bela must not require sales'); }), { status: 'Проверить', reason: row.payrollReasons[0] });
  });
  it('opens Bela without warnings and preserves fixed and purchase detail behavior', () => {
    for (const salaryType of ['vl_percent', 'fixed_salary', 'purchase_manager']) {
      assert.deepEqual(selectStatus({ salaryType, payrollStatus: 'OK', payrollReasons: [] }, null, {}, () => null), { status: 'OK', reason: 'замечаний нет' });
    }
  });
  it('retains the sales audit status and closes when selection is cleared', () => {
    const audit = { status: 'Проверить', reason: 'Проверить продажи' };
    assert.equal(selectStatus({ salaryType: 'retail_sales_bonus' }, {}, { rows: [], accessoryExcludedRows: [] }, () => audit), audit);
    assert.equal(selectStatus(null, null, {}, () => audit), null);
  });
});

describe('employee-scoped premium editor', () => {
  // The Node runner uses classic JSX for the shared Input component; Next uses
  // automatic JSX. Supply React only for this suite, without changing shared UI.
  const testGlobal = globalThis as typeof globalThis & { React?: typeof React };
  const previousReact = testGlobal.React;
  before(() => { testGlobal.React = React; });
  after(() => { if (previousReact === undefined) Reflect.deleteProperty(testGlobal, 'React'); else testGlobal.React = previousReact; });
  const props = { employeeName: 'Тохов Астемир', employees: [], drafts: getInitialPayrollBonuses('2026-08').slice(0, 1), error: '', disabled: false, onChange: () => {} };
  it('keeps the employee fixed and renders the existing award without another employee picker', () => {
    const html = renderToStaticMarkup(createElement(PayrollBonusesEditor, props));
    assert.ok(html.includes('Премии: Тохов Астемир'));
    assert.ok(html.includes('value="20000"'));
    assert.ok(html.includes('Рекордные результаты'));
    assert.ok(!html.includes('<select'));
  });
  it('does not create a legacy fixed-pay field for a new award', () => {
    const html = renderToStaticMarkup(createElement(PayrollBonusesEditor, { ...props, drafts: [] }));
    assert.ok(html.includes('Премий в этом месяце нет'));
    assert.ok(!html.includes('Прежняя премия'));
  });
  it('preserves a legacy amount visibly in the same editor without converting it into a new award', () => {
    const html = renderToStaticMarkup(createElement(PayrollBonusesEditor, { ...props, drafts: [], legacyBonus: { amount: '1500', onChange: () => {} } }));
    assert.ok(html.includes('value="1500"'));
    assert.ok(html.includes('Не добавляйте ту же сумму повторно'));
    assert.ok(!html.includes('Сумма премии 1'));
  });
  it('allows incomplete old drafts to be assigned instead of silently hiding them', () => {
    const html = renderToStaticMarkup(createElement(PayrollBonusesEditor, { ...props, employeeName: undefined, employees: ['Тохов Астемир'] }));
    assert.ok(html.includes('<select'));
    assert.ok(html.includes('Премии без сопоставленного сотрудника'));
  });
  it('disables bonus changes while the period is closed or a save is in progress', () => {
    const html = renderToStaticMarkup(createElement(PayrollBonusesEditor, { ...props, disabled: true }));
    assert.match(html, /<fieldset[^>]*disabled/);
    assert.match(html, /<button[^>]*disabled[^>]*>Добавить премию/);
  });
});

const retailManager = 'Чеченова Милана';
const wholesaleManager = 'Ахобекова Залина';
const asadManager = 'Икаев Асад';
const traineeManager = 'СтажерРозница';
const traineeAliasVariants = ['Косторенко Магомед', 'Магомед Косторенко', 'Магомед Косторенко (стажёр)', 'Костеренко Магомед', 'Магомед Костеренко', 'Костенко Магомед', 'Магомед Костенко', 'Костанко Магомед', 'Магомед Костанко', 'Костаренко Магомед', 'Магомед Костаренко'];
const excludedPayrollManagers = ['Кештова Аслан', 'Кештова Амир', 'Кештов Аслан', 'Кештов Амир', 'Атабиева Муслим', 'Атабиев Муслим'];
const creditClient = 'Кредит/рассрочка';
const regularClient = 'Розничный покупатель';

function salesRow(overrides: Partial<SalesRow>): SalesRow {
  return {
    manager: retailManager,
    client: regularClient,
    category: 'Аксессуары',
    item: 'Тестовая позиция, TEST',
    registrar: 'Реализация товаров и услуг',
    registrars: ['Реализация товаров и услуг'],
    revenue: 0,
    cost: 0,
    grossProfit: 0,
    profitability: 0,
    ...overrides,
  };
}

function managerSummary(rows: SalesRow[], manager: string) {
  const summary = classifySalesRows(rows).managerSummaries.find((item) => item.manager === manager);
  assert.ok(summary, `Expected payroll summary for ${manager}`);
  return summary;
}

function assertMoney(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `Expected ${actual} to equal ${expected}`);
}

describe('payroll calculation regression rules', () => {
  it('applies confirmed Finbox kopecks through the existing Diana formula without accumulating or changing advances', () => {
    const preview = parseFinboxReport('Начальный остаток на 2026-08-01\t0\n01.08.2026\tНачисление агентского вознаграждения\t85373.06\nКонечный остаток на 2026-08-31\t85373.06', '2026-08');
    assert.deepEqual(preview.errors, []);
    const summary = managerSummary([salesRow({ manager: 'Кумахова Диана', revenue: 1000, cost: 400, grossProfit: 600 })], 'Кумахова Диана');
    const manual = { workedDays: '17', lateCount: '0', advance: '5000', comment: 'demo', agentCreditCommission: '85373' };
    const previous = buildFullPayrollRow(summary, manual);
    const updatedManual = { ...manual, agentCreditCommission: preview.amount };
    const updated = buildFullPayrollRow(summary, updatedManual);
    assertMoney(updated.agentCreditCommission, 85373.06);
    assertMoney(updated.grossPay - previous.grossPay, 0.06);
    assertMoney(updated.netPay - previous.netPay, 0.06);
    assert.equal(updated.advance, 5000);
    assert.equal(updated.dayPay, previous.dayPay);
    assert.equal(updated.salesBonus, previous.salesBonus);
    assert.deepEqual(buildFullPayrollRow(summary, { ...updatedManual, agentCreditCommission: preview.amount }), updated);
    assert.equal(manual.agentCreditCommission, '85373');
  });

  it('does not credit Diana agency earnings to another employee', () => {
    const summary = managerSummary([salesRow({ manager: retailManager, revenue: 1000, cost: 400, grossProfit: 600 })], retailManager);
    const manual = { workedDays: '20', lateCount: '0', advance: '1000', comment: '' };
    assert.deepEqual(buildFullPayrollRow(summary, { ...manual, agentCreditCommission: '85373.06' }), buildFullPayrollRow(summary, manual));
  });
  it('calculates services at 50% of revenue', () => {
    const summary = managerSummary(
      [
        salesRow({
          category: 'Услуги оказываемые',
          item: 'Наклейка защитной пленки',
          revenue: 1000,
          cost: 100,
          grossProfit: 900,
        }),
      ],
      retailManager,
    );

    assert.equal(summary.filmBonus, 500);
    assert.equal(summary.totalBonus, 500);
  });

  it('calculates accessories at 5% of revenue', () => {
    const summary = managerSummary(
      [
        salesRow({
          category: 'Защитные стекла и пленки',
          item: 'Защитное стекло iPhone',
          revenue: 2000,
          cost: 800,
          grossProfit: 1200,
        }),
      ],
      retailManager,
    );

    assert.equal(summary.accessoryBonus, 100);
    assert.equal(summary.totalBonus, 100);
  });

  it('calculates retail tech at 10% of gross profit', () => {
    const summary = managerSummary(
      [
        salesRow({
          category: 'Смартфоны (хар-ки)',
          item: 'Apple iPhone 15, IPH15',
          revenue: 100000,
          cost: 80000,
          grossProfit: 20000,
        }),
      ],
      retailManager,
    );

    assert.equal(summary.techBonus, 2000);
    assert.equal(summary.totalBonus, 2000);
  });

  it('calculates credit tech as gross profit x 0.91 x 10%', () => {
    const classification = classifySalesRows([
      salesRow({
        client: creditClient,
        category: 'Смартфоны (хар-ки)',
        item: 'Apple iPhone 15, IPH15',
        revenue: 90000,
        cost: 80000,
        grossProfit: 10000,
      }),
    ]);
    const row = classification.rows[0];
    const summary = classification.managerSummaries.find((item) => item.manager === retailManager);

    assert.equal(row.calculationType, 'CREDIT_GROSS_PROFIT');
    assert.equal(row.base, 9100);
    assert.equal(row.bonus, 910);
    assert.ok(summary);
    assert.equal(summary.creditBonus, 910);
    assert.equal(summary.totalBonus, 910);
  });

  it('merges Magomed spelling aliases without permanently merging the reusable trainee account', () => {
    const classification = classifySalesRows([
      salesRow({
        manager: traineeManager,
        revenue: 1000,
        cost: 400,
        grossProfit: 600,
      }),
      ...traineeAliasVariants.map((manager) =>
        salesRow({
          manager,
          revenue: 2000,
          cost: 800,
          grossProfit: 1200,
        }),
      ),
    ]);

    const traineeSummary = classification.managerSummaries.find((item) => item.manager === traineeManager);
    const magomedSummary = classification.managerSummaries.find((item) => item.manager === 'Костеренко Магомед');

    assert.ok(traineeSummary);
    assert.ok(magomedSummary);
    for (const alias of traineeAliasVariants) {
      if (alias !== 'Костеренко Магомед') {
        assert.equal(classification.managerSummaries.find((item) => item.manager === alias), undefined);
      }
    }
    assert.equal(traineeSummary.revenue, 1000);
    assert.equal(traineeSummary.grossProfit, 600);
    assert.equal(magomedSummary.revenue, 22000);
    assert.equal(magomedSummary.grossProfit, 13200);
  });

  it('excludes non-payroll people from payroll summaries', () => {
    const classification = classifySalesRows([
      salesRow({
        manager: retailManager,
        revenue: 1000,
        cost: 400,
        grossProfit: 600,
      }),
      ...excludedPayrollManagers.map((manager) =>
        salesRow({
          manager,
          revenue: 100000,
          cost: 1000,
          grossProfit: 99000,
        }),
      ),
    ]);

    assert.ok(classification.managerSummaries.find((item) => item.manager === retailManager));
    for (const manager of excludedPayrollManagers) {
      assert.equal(classification.managerSummaries.find((item) => item.manager === manager), undefined);
      assert.equal(classification.rows.find((item) => item.manager === manager), undefined);
    }
  });

  it('calculates wholesale bonus at 1.75% of included wholesale base', () => {
    const classification = classifySalesRows([
      salesRow({
        manager: wholesaleManager,
        category: 'Кабели',
        item: 'Кабель USB-C',
        revenue: 10000,
        cost: 6000,
        grossProfit: 4000,
      }),
      salesRow({
        manager: wholesaleManager,
        category: 'Смартфоны (хар-ки)',
        item: 'Apple iPhone 15, IPH15',
        revenue: 50000,
        cost: 45000,
        grossProfit: 5000,
      }),
    ]);
    const summary = classification.managerSummaries.find((item) => item.manager === wholesaleManager);

    assert.equal(classification.wholesale.totalRevenue, 60000);
    assert.equal(classification.wholesale.excludedTechRevenue, 50000);
    assert.equal(classification.wholesale.base, 10000);
    assertMoney(classification.wholesale.bonusEach, 175);
    assert.ok(summary);
    assertMoney(summary.wholesaleBonus, 175);
  });

  it('keeps negative return rows in payroll calculations', () => {
    const classification = classifySalesRows([
      salesRow({
        category: 'Защитные стекла и пленки',
        item: 'Возврат защитного стекла',
        registrar: 'Возврат товаров от клиента',
        registrars: ['Возврат товаров от клиента'],
        revenue: -1000,
        cost: -400,
        grossProfit: -600,
      }),
    ]);
    const row = classification.rows[0];
    const summary = classification.managerSummaries.find((item) => item.manager === retailManager);

    assert.equal(row.revenue, -1000);
    assert.equal(row.calculationType, 'RETAIL_ACCESSORY_5');
    assert.equal(row.bonus, -50);
    assert.ok(summary);
    assert.equal(summary.accessoryBonus, -50);
    assert.equal(summary.totalBonus, -50);
  });

  it('applies Asad plotter material rule at 50% of cost', () => {
    const classification = classifySalesRows([
      salesRow({
        manager: asadManager,
        category: 'Защитные стекла и пленки',
        item: 'Защитная пленка матовая для плоттера, SKIN',
        revenue: 1000,
        cost: 300,
        grossProfit: 700,
      }),
    ]);
    const row = classification.rows[0];
    const summary = classification.managerSummaries.find((item) => item.manager === asadManager);

    assert.equal(row.calculationType, 'RETAIL_PLOTTER_MATERIAL_COST_50');
    assert.equal(row.base, 300);
    assert.equal(row.bonus, 150);
    assert.ok(summary);
    assert.equal(summary.plotterBonus, 150);
    assert.equal(summary.accessoryBonus, 0);
    assert.equal(summary.totalBonus, 150);
  });

  it('applies Asad no-day-pay salary rule without changing sales bonus', () => {
    const payrollRow = buildFullPayrollRow(
      {
        manager: asadManager,
        department: 'Розница',
        revenue: 1000,
        grossProfit: 700,
        creditBonus: 0,
        filmBonus: 0,
        plotterBonus: 150,
        techBonus: 0,
        accessoryBonus: 0,
        wholesaleBonus: 0,
        totalBonus: 150,
      },
      {
        workedDays: '20',
        lateCount: '0',
        advance: '0',
        comment: '',
      },
    );

    assert.equal(payrollRow.workedDays, null);
    assert.equal(payrollRow.lateCount, null);
    assert.equal(payrollRow.dayPay, 0);
    assert.equal(payrollRow.salesBonus, 150);
    assert.equal(payrollRow.grossPay, 150);
    assert.equal(payrollRow.netPay, 150);
  });
});
