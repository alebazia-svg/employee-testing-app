import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePersonalCurrentPayroll, getPrivatePayrollBinding, type CurrentPayrollEvidence } from '../lib/payroll-current-read';
import type { PayrollOneCControlSlice } from '../lib/payroll-one-c-control-snapshots';
import { prepareDailyPayrollInputs } from '../lib/payroll-daily-calculation';
import { buildDailyPayrollBase } from '../lib/payroll-daily-calculation';
import * as engine from '../lib/payroll-calculation-engine';

function evidence(): CurrentPayrollEvidence {
  const date = '2026-10-01';
  const slice: PayrollOneCControlSlice = {
    version: 2, dateFrom: date, dateTo: date,
    close: { date, ready: true, executionDate: date, finishedAt: `${date} 22:00:00`, costDocument: 'test', blockingIssues: [] },
    source: { contractVersion: 'payroll-sales-facts-v2', checkedAt: date, extractedAt: date, pages: 1 },
    sales: { rows: [], managerKeys: [], summary: { sourceRows: 0, normalizedRows: 0, managerCount: 0, revenue: 0, cost: 0, grossProfit: 0,
      missingManagerRows: 0, missingCustomerRows: 0, missingProductRows: 0, costReviewRows: 0, costCalculationPendingRows: 0 } },
    purchases: { contractVersion: 'payroll-purchase-attribution-v1', employeeRef: 'test', employeeName: 'Тохов Астемир', documentCount: 0,
      reviewDocumentCount: 0, ignoredOtherDocumentCount: 0, settlements: [] },
  };
  return {
    users: [{ id: 7, name: 'Зухра', role: 'EMPLOYEE', department: 'retail', isActive: true, payrollName: 'Абшаева Зухра',
      payrollSalaryType: 'retail_sales_bonus', payrollReportGroup: null, payrollFixedSalary: null, payrollRuleFrom: null, payrollRuleThrough: null }],
    slices: [{ dateFrom: date, dateTo: date, payload: slice }],
    draft: { revision: 1, payload: { manual: { 'Абшаева Зухра': { workedDays: '2', lateCount: '0', advance: '', comment: '', source: 'manualCorrection' } },
      fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] } },
    attendance: { sourceCheckedAt: new Date('2026-10-02T08:00:00Z'), updatedAt: new Date('2026-10-02T08:00:00Z'),
      payload: { version: 1, period: { monthIndex: 9, year: 2026, periodKey: '2026-10' }, attendanceMode: 'google-sheets', attendanceMessage: '',
        scheduleMode: 'not-configured', scheduleMessage: '', formSummaries: [], scheduleSummaries: [] } },
    finboxAmount: null, classificationRules: [], supplierRules: [],
  };
}
test('server uses persisted correction and exact binding; never mutates evidence', () => {
  const input = evidence(); const before = JSON.stringify(input);
  const result = calculatePersonalCurrentPayroll('2026-10', 7, input);
  assert.ok(result); assert.equal(result.userId, 7); assert.equal(result.verifiedThrough, '2026-10-01');
  assert.equal(result.grossPay, 4200); // 2 × 600 plus unchanged 3000 discipline formula, not exposed separately.
  assert.deepEqual(result.earnings?.filter(row => row.amount), [{ label: 'Выходы', amount: 1200 }]);
  assert.equal(JSON.stringify(input), before);
});
test('reused aliases, duplicate binding, missing binding, inactive or wrong viewer fail closed', () => {
  for (const mutate of [
    (input: CurrentPayrollEvidence) => { input.users[0].payrollName = null; },
    (input: CurrentPayrollEvidence) => { input.users[0].isActive = false; },
    (input: CurrentPayrollEvidence) => { input.users.push({ ...input.users[0], id: 8, isActive: false }); },
    (input: CurrentPayrollEvidence) => { input.users.push({ ...input.users[0], id: 8, payrollName: null, name: 'Абшаева Зухра' }); },
  ]) {
    const input = evidence(); mutate(input); assert.equal(getPrivatePayrollBinding(input.users, 7), null);
    assert.equal(calculatePersonalCurrentPayroll('2026-10', 7, input), null);
  }
  assert.equal(calculatePersonalCurrentPayroll('2026-10', 8, evidence()), null);
});
test('missing persistence or attendance, unverified source and date gaps never become zero', () => {
  for (const mutate of [
    (input: CurrentPayrollEvidence) => { input.draft = null; },
    (input: CurrentPayrollEvidence) => { input.attendance = null; },
    (input: CurrentPayrollEvidence) => { input.slices = []; },
    (input: CurrentPayrollEvidence) => { input.slices.push(input.slices[0]); },
    (input: CurrentPayrollEvidence) => { input.slices[0].dateFrom = input.slices[0].dateTo = '2026-10-02'; Object.assign(input.slices[0].payload as object, { dateFrom: '2026-10-02', dateTo: '2026-10-02' }); },
  ]) { const input = evidence(); mutate(input); assert.equal(calculatePersonalCurrentPayroll('2026-10', 7, input), null); }
});
test('non-payroll-impacting raw cost flags do not override shared ADMIN classification', () => {
  const input = evidence();
  const summary = (input.slices[0].payload as PayrollOneCControlSlice).sales.summary;
  summary.costReviewRows = 192; summary.costCalculationPendingRows = 16;
  assert.equal(calculatePersonalCurrentPayroll('2026-10', 7, input)?.grossPay, 4200);
});
test('cost-dependent credit remuneration remains blocked until cost is calculated', () => {
  const input = evidence();
  const sales = (input.slices[0].payload as PayrollOneCControlSlice).sales;
  sales.rows = [{ manager: 'Абшаева Зухра', managerRef: 'manager', client: 'Кредит/Рассрочка', clientRef: 'client',
    category: 'Смартфоны (хар-ки)', categoryRef: 'category', item: 'iPhone 17', productRef: 'product', article: '',
    quantity: 1, revenue: 120000, cost: 100000, grossProfit: 20000, sourceRows: 1, costReviewRows: 0, costCalculationPendingRows: 1 }];
  sales.summary.costCalculationPendingRows = 1;
  assert.equal(calculatePersonalCurrentPayroll('2026-10', 7, input), null);
});
test('automatic preparation does not mutate input even when attendance is missing', () => {
  const manual = { 'Кумыков Мухаммед': { workedDays: '', lateCount: '', advance: '', comment: '' } };
  const before = JSON.stringify(manual);
  const result = prepareDailyPayrollInputs({ periodKey: '2026-10', manual, attendance: null, finboxAmount: '100',
    directory: { 'Кумыков Мухаммед': { name: 'Кумыков Мухаммед', department: 'Закупки', position: 'Помощник', salaryType: 'purchase_daily', agreedDays: 16 } } });
  assert.equal(result['Кумыков Мухаммед'].workedDays, '16'); assert.equal(JSON.stringify(manual), before);
});
test('advances are separate from gross and require a recent complete source, not an assumed zero', () => {
  const now = new Date('2026-10-22T09:00:00Z');
  const input = evidence();
  const read = { version: 1, periodKey: '2026-10', dateFrom: '2026-10-01', dateTo: '2026-10-22', checkedAt: now.toISOString(), documents: [
    { key: 'doc:1', employeeRef: 'zukhra', employeeName: 'Абшаева Зухра', documentNumber: 'QA', documentDate: '2026-10-22', amount: 2000, periodKey: '2026-10' },
  ], issues: [] };
  input.advances = read;
  const result = calculatePersonalCurrentPayroll('2026-10', 7, input, now);
  assert.equal(result?.advance, 2000); assert.equal(result?.grossPay, 4200);
  for (const patch of [{ checkedAt: '2026-10-21T09:00:00Z' }, { dateTo: '2026-10-21' }, { issues: ['review'] },
    { documents: [...read.documents, ...read.documents] }, { periodKey: '2026-09' }]) {
    input.advances = { ...read, ...patch };
    const changed = calculatePersonalCurrentPayroll('2026-10', 7, input, now);
    assert.equal(changed?.advance, null); assert.equal(changed?.grossPay, 4200);
  }
  input.advances = { ...read, documents: [] };
  assert.equal(calculatePersonalCurrentPayroll('2026-10', 7, input, now)?.advance, 0, 'verified empty source is really zero');
  (input.draft!.payload as any).manual['Абшаева Зухра'].advance = '2000';
  assert.equal(calculatePersonalCurrentPayroll('2026-10', 7, input, now)?.advance, null, 'manual draft is not evidence of cash issued in 1C');
});
test('shared ADMIN/server assembly preserves the previous full component composition exactly', () => {
  const directory = engine.buildPayrollEmployeeDirectory([], '2026-10');
  const summaries = [{ ...engine.buildEmptyManagerSummary(directory['Абшаева Зухра']), techBonus: 1234.56, totalBonus: 1234.56 }];
  const manual = Object.fromEntries(Object.values(directory).map(employee => [employee.name, { workedDays: '12', lateCount: '0', advance: '2000', comment: '' }]));
  const fixed = { 'Улубиев Марат': { bonus: '500', advance: '100', deduction: '200', comment: '' } };
  const purchase = { advance: '800', deduction: '500', comment: '' };
  const sales = engine.buildSalesPayrollSummaries(summaries, directory)
    .map(summary => engine.buildFullPayrollRow(summary, engine.getPayrollManualInput(summary.manager, manual), directory));
  const expected = engine.applyBelaPercentRule([
    ...sales, ...engine.buildFixedPayrollRows(fixed, '2026-10', directory),
    engine.buildPurchasePayrollRow(purchase, { fileName: 'Автоматические данные 1С', base: 1234567, sourceRow: null }, directory),
    ...engine.buildUnconfiguredPayrollRows([], directory, '2026-10', new Set(sales.map(row => row.manager))),
  ], '2026-10');
  assert.deepEqual(buildDailyPayrollBase({ periodKey: '2026-10', directory, users: [], summaries, manual, fixed, purchase, purchaseBase: 1234567 }), expected);
});
