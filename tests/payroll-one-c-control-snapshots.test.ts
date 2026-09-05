import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregatePayrollOneCControlSlices,
  getPayrollOneCRefreshDates,
  isPayrollOneCControlSlice,
  type PayrollOneCControlSlice,
} from '../lib/payroll-one-c-control-snapshots';

function slice(date: string, options: { manager?: string; revenue?: number; supplier?: string; debt?: number } = {}): PayrollOneCControlSlice {
  return {
    version: 1,
    dateFrom: date,
    dateTo: date,
    close: { date, ready: true, executionDate: date, finishedAt: `${date} 22:00:00`, costDocument: 'Расчёт себестоимости', blockingIssues: [] },
    source: { contractVersion: 'payroll-sales-facts-v2', checkedAt: `${date}T19:00:00Z`, extractedAt: `${date}T18:59:00Z`, pages: 1 },
    sales: {
      managerKeys: [options.manager ?? 'manager-1'],
      summary: {
        sourceRows: 2, normalizedRows: 1, managerCount: 1,
        revenue: options.revenue ?? 1000, cost: 400, grossProfit: (options.revenue ?? 1000) - 400,
        missingManagerRows: 0, missingCustomerRows: 0, missingProductRows: 0,
        costReviewRows: 1, costCalculationPendingRows: 1,
      },
    },
    purchases: {
      contractVersion: 'payroll-purchase-attribution-v1', employeeRef: 'astemir', employeeName: 'Тохов Астемир',
      documentCount: 1, reviewDocumentCount: 0, ignoredOtherDocumentCount: 1,
      settlements: [{ supplierName: options.supplier ?? 'Luxo', organizationName: 'ОФФОНИКА', currency: 'руб.', debtIncrease: options.debt ?? 500, sourceRows: 1 }],
    },
  };
}

describe('daily 1C payroll control snapshots', () => {
  it('reads only missing dates and the rolling three-day correction window', () => {
    assert.deepEqual(
      getPayrollOneCRefreshDates('2026-09', '2026-09-05', ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']),
      ['2026-09-03', '2026-09-04', '2026-09-05'],
    );
  });

  it('repairs an older missing day without rereading other stable old days', () => {
    assert.deepEqual(
      getPayrollOneCRefreshDates('2026-09', '2026-09-05', ['2026-09-01', '2026-09-03', '2026-09-04']),
      ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    );
  });

  it('combines daily totals, distinct managers and the same supplier safely', () => {
    const combined = aggregatePayrollOneCControlSlices([
      slice('2026-09-01'),
      slice('2026-09-02', { manager: 'manager-2', revenue: 1250, debt: 325 }),
    ]);
    assert.equal(combined.period.verifiedThrough, '2026-09-02');
    assert.equal(combined.sales.summary.sourceRows, 4);
    assert.equal(combined.sales.summary.managerCount, 2);
    assert.equal(combined.sales.summary.revenue, 2250);
    assert.equal(combined.sales.summary.cost, 800);
    assert.equal(combined.sales.summary.grossProfit, 1450);
    assert.equal(combined.purchases.documentCount, 2);
    assert.equal(combined.purchases.ignoredOtherDocumentCount, 2);
    assert.equal(combined.purchases.settlements.length, 1);
    assert.equal(combined.purchases.settlements[0].debtIncrease, 825);
  });

  it('fails closed when stored source contracts differ', () => {
    const changed = slice('2026-09-02');
    changed.source.contractVersion = 'unexpected-v3';
    assert.throws(() => aggregatePayrollOneCControlSlices([slice('2026-09-01'), changed]), /Версии сохранённых источников/);
  });

  it('rejects malformed stored JSON instead of returning zeros', () => {
    assert.equal(isPayrollOneCControlSlice({ version: 1, dateFrom: '2026-09-01' }), false);
    const malformed = slice('2026-09-01') as unknown as { sales: { summary: { revenue: unknown } } };
    malformed.sales.summary.revenue = '1000';
    assert.equal(isPayrollOneCControlSlice(malformed), false);
  });
});
