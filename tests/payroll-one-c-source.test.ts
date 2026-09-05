import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { getPayrollSalesFacts, getPayrollSalesReport } from '../lib/one-c';
import { buildPayrollOneCPreview } from '../lib/payroll-one-c';

const originalFetch = globalThis.fetch;
const envKeys = ['1C_BASE_URL', '1C_API_USER', '1C_API_PASSWORD'];
const previous = envKeys.map(key => process.env[key]);
before(() => envKeys.forEach((key, i) => { process.env[key] = ['http://one-c.invalid', 'test', 'test'][i]; }));
after(() => { globalThis.fetch = originalFetch; envKeys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; }); });
const params = { dateFrom: '2026-08-01', dateTo: '2026-08-31', maxPages: 3 };
const row = (overrides: Record<string, unknown> = {}) => ({ period: '2026-08-01T12:00:00', recorder_ref: 'document', line_number: 1, active: true, product_ref: 'product', product_name: 'Чехол', manager_ref: 'manager', manager_name: 'Сотрудник', customer_ref: 'customer', customer_name: 'Клиент', product_kind_ref: 'kind', product_kind_name: 'Аксессуары', product_category_name: 'Другая категория', quantity: 1, revenue: 1000, cost: 400, gross_profit: 600, report_cost: 450, report_gross_profit: 550, cost_calculation_pending: false, cost_review_required: false, ...overrides });
const page = (overrides: Record<string, unknown> = {}) => ({ ok: true, mode: 'read-only', contract_version: 'payroll-sales-facts-v2', date_from: params.dateFrom, date_to: params.dateTo, extracted_at: '2026-09-04T12:00:00+03:00', period_complete: true, page: { complete: true }, rows: [row()], ...overrides });
function responses(pages: unknown[]) {
  const calls: URL[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, 'GET');
    calls.push(new URL(String(url)));
    assert.equal(calls.at(-1)?.pathname, '/payroll-sales-facts');
    assert.ok(calls.length <= pages.length, 'unexpected extra request');
    return Response.json(pages[calls.length - 1]);
  }) as typeof fetch;
  return calls;
}
describe('payroll read-only v2 source', () => {
  it('uses full report cost, preserves warnings and the Excel product-kind dimension', async () => {
    responses([page({ rows: [row({ cost_calculation_pending: true, cost_review_required: true })] })]);
    const result = await getPayrollSalesReport(params);
    assert.equal(result.ok, true);
    assert.equal(result.rows[0].cost, 450);
    assert.equal(result.rows[0].grossProfit, 550);
    const preview = buildPayrollOneCPreview(result.rows);
    assert.equal(preview.rows[0].category, 'Аксессуары');
    assert.equal(preview.summary.costReviewRows, 1);
    assert.equal(preview.summary.costCalculationPendingRows, 1);
  });
  it('loads every page and retains signed returns', async () => {
    const calls = responses([page({ page: { complete: false, next_cursor: 'second' } }), page({ rows: [row({ line_number: 2, quantity: -1, revenue: -1000, cost: -400, gross_profit: -600, report_cost: -450, report_gross_profit: -550 })] })]);
    const result = await getPayrollSalesReport(params);
    assert.equal(result.ok, true);
    assert.equal(result.rows.length, 2);
    assert.equal(calls[1].searchParams.get('cursor'), 'second');
    assert.equal(buildPayrollOneCPreview(result.rows).summary.revenue, 0);
  });
  for (const [name, payload] of Object.entries({
    contract: page({ contract_version: 'payroll-sales-facts-v1' }),
    missingRows: page({ rows: null }),
    missingAmount: page({ rows: [row({ report_cost: null })] }),
    invalidAmount: page({ rows: [row({ revenue: 'nonsense' })] }),
    missingFlag: page({ rows: [row({ cost_calculation_pending: null })] }),
    wrongPeriod: page({ date_from: '2026-07-01' }),
    outsidePeriod: page({ rows: [row({ period: '2026-07-01T12:00:00' })] }),
    inactive: page({ rows: [row({ active: false })] }),
    duplicate: page({ rows: [row(), row()] }),
    missingCursor: page({ page: { complete: false } }),
  })) {
    it(`rejects ${name} without partial totals`, async () => {
      responses([payload]);
      const result = await getPayrollSalesFacts(params);
      assert.equal(result.ok, false);
      assert.deepEqual(result.rows, []);
    });
  }
  it('rejects cursor cycles', async () => {
    responses([page({ page: { complete: false, next_cursor: 'a' } }), page({ page: { complete: false, next_cursor: 'b' }, rows: [row({ line_number: 2 })] }), page({ page: { complete: false, next_cursor: 'a' }, rows: [row({ line_number: 3 })] })]);
    const result = await getPayrollSalesFacts(params);
    assert.equal(result.ok, false);
    assert.deepEqual(result.rows, []);
  });
  it('rejects a page cap without returning partial data', async () => {
    responses([page({ page: { complete: false, next_cursor: 'next' } })]);
    const result = await getPayrollSalesFacts({ ...params, maxPages: 1 });
    assert.equal(result.ok, false);
    assert.deepEqual(result.rows, []);
  });
  it('rejects invalid dates before any network access', async () => {
    const calls = responses([]);
    for (const p of [{ dateFrom: '2026-02-30' }, { dateFrom: '2026-09-01' }, { dateTo: '2099-01-01' }, { pageSize: NaN }]) {
      assert.equal((await getPayrollSalesFacts({ ...params, ...p })).ok, false);
    }
    assert.equal(calls.length, 0);
  });

  for (const [name, overrides] of Object.entries({
    baseProfit: { gross_profit: 9999 },
    reportProfit: { report_gross_profit: 9999 },
    oneKopeck: { report_gross_profit: 550.01 },
    negativeOneKopeck: { report_gross_profit: 549.99 },
  })) {
    it(`rejects inconsistent ${name}, including previously loaded rows`, async () => {
      responses([page({ page: { complete: false, next_cursor: 'second' } }), page({ rows: [row({ line_number: 2, ...overrides })] })]);
      const result = await getPayrollSalesReport(params);
      assert.equal(result.ok, false);
      assert.deepEqual(result.rows, []);
    });
  }
  it('accepts floating-point noise without changing monetary inputs', async () => {
    responses([page({ rows: [row({ revenue: 0.3, cost: 0.1, gross_profit: 0.2, report_cost: 0.1, report_gross_profit: 0.2 })] })]);
    const result = await getPayrollSalesReport(params);
    assert.equal(result.ok, true);
    assert.equal(result.rows[0].grossProfit, 0.2);
  });
  for (const firstComplete of [true, false]) {
    it(`rejects readiness changing from ${firstComplete} and stops pagination`, async () => {
      const calls = responses([
        page({ period_complete: firstComplete, page: { complete: false, next_cursor: 'second' } }),
        page({ period_complete: !firstComplete, rows: [row({ line_number: 2 })], page: { complete: false, next_cursor: 'third' } }),
      ]);
      const result = await getPayrollSalesFacts(params);
      assert.equal(result.ok, false);
      assert.equal(result.periodComplete, false);
      assert.deepEqual(result.rows, []);
      assert.match(result.error!, /разную готовность периода/);
      assert.equal(calls.length, 2);
    });
  }
  it('retains consistently incomplete periods as shadow data, never complete', async () => {
    responses([
      page({ period_complete: false, page: { complete: false, next_cursor: 'second' } }),
      page({ period_complete: false, rows: [row({ line_number: 2 })] }),
    ]);
    const result = await getPayrollSalesFacts(params);
    assert.equal(result.ok, true);
    assert.equal(result.periodComplete, false);
    assert.equal(result.rows.length, 2);
  });

  const revenueMovement = (overrides: Record<string, unknown> = {}) => row({ cost: 0, gross_profit: 1000, report_cost: 0, report_gross_profit: 1000, cost_review_required: true, ...overrides });
  const costMovement = (overrides: Record<string, unknown> = {}) => row({ line_number: 2, quantity: 0, revenue: 0, gross_profit: -400, report_gross_profit: -450, ...overrides });
  it('resolves split movements across pages without changing totals or source flags', async () => {
    responses([
      page({ rows: [revenueMovement()], page: { complete: false, next_cursor: 'second' } }),
      page({ rows: [costMovement()] }),
    ]);
    const result = await getPayrollSalesReport(params);
    assert.equal(result.ok, true);
    const before = JSON.stringify(result.rows);
    for (const rows of [result.rows, [...result.rows].reverse()]) {
      const preview = buildPayrollOneCPreview(rows);
      assert.equal(preview.summary.costReviewRows, 0);
      assert.equal(preview.rows[0].costReviewRows, 0);
      assert.equal(preview.summary.revenue, 1000);
      assert.equal(preview.summary.cost, 450);
      assert.equal(preview.summary.grossProfit, 550);
      assert.equal(preview.summary.sourceRows, 2);
    }
    assert.equal(JSON.stringify(result.rows), before);
    assert.equal(result.rows[0].costReviewRequired, true);
  });
  it('resolves signed split return movements', async () => {
    responses([page({ rows: [
      revenueMovement({ quantity: -1, revenue: -1000, gross_profit: -1000, report_gross_profit: -1000 }),
      costMovement({ cost: -400, gross_profit: 400, report_cost: -450, report_gross_profit: 450 }),
    ] })]);
    const result = await getPayrollSalesReport(params);
    assert.equal(result.ok, true);
    const preview = buildPayrollOneCPreview(result.rows);
    assert.equal(preview.summary.costReviewRows, 0);
    assert.equal(preview.summary.cost, -450);
    assert.equal(preview.summary.grossProfit, -550);
  });
  for (const [name, overrides] of Object.entries({
    document: { recorder_ref: 'different' },
    timestamp: { period: '2026-08-02T12:00:00' },
    organization: { organization_ref: 'different' },
    warehouse: { warehouse_ref: 'different' },
    manager: { manager_ref: 'different' },
    customer: { customer_ref: 'different' },
    product: { product_ref: 'different' },
    characteristic: { characteristic_ref: 'different' },
    direction: { cost: -400, gross_profit: 400, report_cost: -450, report_gross_profit: 450 },
  })) {
    it(`does not use another ${name} to hide missing cost`, async () => {
      responses([page({ rows: [revenueMovement(), costMovement(overrides)] })]);
      const result = await getPayrollSalesReport(params);
      assert.equal(result.ok, true);
      const preview = buildPayrollOneCPreview(result.rows);
      assert.equal(preview.summary.costReviewRows, 1);
      assert.equal(preview.rows.reduce((sum, r) => sum + r.costReviewRows, 0), 1);
    });
  }
  it('keeps pending-cost and unexplained explicit source warnings', async () => {
    responses([page({ rows: [revenueMovement(), costMovement({ cost_calculation_pending: true, cost_review_required: true })] })]);
    const result = await getPayrollSalesReport(params);
    assert.equal(result.ok, true);
    const preview = buildPayrollOneCPreview(result.rows);
    assert.equal(preview.summary.costReviewRows, 2);
    assert.equal(preview.summary.costCalculationPendingRows, 1);
  });
  it('keeps missing-cost warnings without a corresponding movement or document identity', async () => {
    responses([page({ rows: [revenueMovement(), costMovement()] })]);
    const result = await getPayrollSalesReport(params);
    assert.equal(result.ok, true);
    assert.equal(buildPayrollOneCPreview(result.rows.slice(0, 1)).summary.costReviewRows, 1);
    const compact = result.rows.map(({ recorderRef, period, ...rest }) => rest);
    assert.equal(buildPayrollOneCPreview(compact).summary.costReviewRows, 1);
  });
});
