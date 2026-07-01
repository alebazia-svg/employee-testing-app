import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
        }
      | undefined,
  ) => {
    workedDays: number | null;
    lateCount: number | null;
    dayPay: number;
    salesBonus: number;
    grossPay: number;
    netPay: number;
  };
};

async function loadPayrollModule(): Promise<PayrollModule> {
  const sourcePath = resolve('app/(dashboard)/admin/payroll/page.tsx');
  const generatedPath = resolve('tests/.generated/payroll-page-test-module.tsx');
  const source = readFileSync(sourcePath, 'utf8');

  mkdirSync(dirname(generatedPath), { recursive: true });
  writeFileSync(generatedPath, `${source}\nexport { classifySalesRows, buildFullPayrollRow };\n`, 'utf8');

  return import(pathToFileURL(generatedPath).href) as Promise<PayrollModule>;
}

let buildFullPayrollRow: PayrollModule['buildFullPayrollRow'];
let classifySalesRows: PayrollModule['classifySalesRows'];

before(async () => {
  const payrollModule = await loadPayrollModule();
  buildFullPayrollRow = payrollModule.buildFullPayrollRow;
  classifySalesRows = payrollModule.classifySalesRows;
});

const retailManager = 'Чеченова Милана';
const wholesaleManager = 'Ахобекова Залина';
const asadManager = 'Икаев Асад';
const traineeManager = 'СтажерРозница';
const traineeAlias = 'Косторенко Магомед';
const traineeAliasVariants = ['Косторенко Магомед', 'Магомед Косторенко', 'Магомед Косторенко (стажёр)', 'Костанко Магомед', 'Магомед Костанко', 'Костаренко Магомед', 'Магомед Костаренко'];
const excludedPayrollManagers = ['Кештова Аслан', 'Кештова Амир', 'Атабиева Муслим'];
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

  it('merges retail trainee sales aliases into one payroll employee', () => {
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
    const aliasSummary = classification.managerSummaries.find((item) => item.manager === traineeAlias);

    assert.ok(traineeSummary);
    assert.equal(aliasSummary, undefined);
    for (const alias of traineeAliasVariants) {
      assert.equal(classification.managerSummaries.find((item) => item.manager === alias), undefined);
    }
    assert.equal(traineeSummary.revenue, 15000);
    assert.equal(traineeSummary.grossProfit, 9000);
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
