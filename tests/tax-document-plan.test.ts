import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaxDocumentPlan, dueAusnPeriods } from '../lib/tax-document-plan';
import type { AusnReportView } from '../lib/ausn-report-cache';

function report(periodKey: string, ens = 'загружен', fns = 'загружена агрегированная сверка'): AusnReportView {
  return { available: true, periodKey, sourceCompleteness: { ЕНС: ens, 'ЛК ФНС': fns }, attention: [], monthlyIncome: [] };
}

test('document calendar includes every due month without asking for the current month too early', () => {
  assert.deepEqual(dueAusnPeriods(new Date('2026-10-25T09:00:00+03:00')), ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
  assert.deepEqual(dueAusnPeriods(new Date('2026-10-10T09:00:00+03:00')).at(-1), '2026-08');
});

test('a global runner source label cannot close a month without a matching portal document', () => {
  const plan = buildTaxDocumentPlan({
    now: new Date('2026-05-20T09:00:00+03:00'),
    reports: [report('2026-04')],
    documents: [{ documentType: 'ENS_OPERATIONS', periodKey: '2026-04', originalName: 'ens.csv', source: 'portal' }],
  });
  assert.equal(plan[0].status, 'missing');
  assert.deepEqual(plan[0].present, ['ENS_OPERATIONS']);
  assert.deepEqual(plan[0].missing, ['AUSN_INCOME', 'AUSN_CALCULATION']);
});

test('ENS coverage from archived uploads closes only the months actually represented', () => {
  const plan = buildTaxDocumentPlan({
    now: new Date('2026-10-25T09:00:00+03:00'),
    reports: [report('2026-09')],
    documents: [
      { documentType: 'AUSN_INCOME', periodKey: '2026-09', coverageFrom: '2026-04', coverageTo: '2026-09', originalName: 'income.xlsx', source: 'portal' },
      { documentType: 'AUSN_CALCULATION', periodKey: '2026-09', coverageFrom: '2026-04', coverageTo: '2026-09', originalName: 'certificate.pdf', source: 'portal' },
      { documentType: 'ENS_OPERATIONS', periodKey: '2026-07', coverageFrom: '2026-04', coverageTo: '2026-07', originalName: 'old.zip', source: 'portal' },
      { documentType: 'ENS_OPERATIONS', periodKey: '2026-08', coverageFrom: '2026-06', coverageTo: '2026-08', originalName: 'new.zip', source: 'portal' },
    ],
  });
  assert.equal(plan.find((period) => period.periodKey === '2026-08')?.status, 'complete');
  assert.deepEqual(plan.find((period) => period.periodKey === '2026-09')?.missing, ['ENS_OPERATIONS']);
});

test('oldest incomplete period stays visible until all required documents exist', () => {
  const plan = buildTaxDocumentPlan({ now: new Date('2026-06-20T09:00:00+03:00'), reports: [], documents: [] });
  assert.equal(plan[0].periodKey, '2026-04');
  assert.equal(plan[0].missing.length, 3);
  assert.equal(plan[1].periodKey, '2026-05');
});

test('one cumulative FNS file can confirm several covered months without duplication', () => {
  const documents = [
    { documentType: 'AUSN_INCOME', periodKey: '2026-09', coverageFrom: '2026-04', coverageTo: '2026-09', originalName: 'income.xlsx', source: 'portal' as const },
    { documentType: 'ENS_OPERATIONS', periodKey: '2026-07', coverageFrom: '2026-04', coverageTo: '2026-07', originalName: 'ens.zip', source: 'portal' as const },
    { documentType: 'AUSN_CALCULATION', periodKey: '2026-06', coverageFrom: '2026-04', coverageTo: '2026-06', originalName: 'calculation.pdf', source: 'portal' as const },
  ];
  const plan = buildTaxDocumentPlan({ now: new Date('2026-10-25T09:00:00+03:00'), reports: [], documents });
  assert.equal(plan.find((period) => period.periodKey === '2026-04')?.status, 'complete');
  assert.deepEqual(plan.find((period) => period.periodKey === '2026-07')?.missing, ['AUSN_CALCULATION']);
  assert.deepEqual(plan.find((period) => period.periodKey === '2026-08')?.missing, ['ENS_OPERATIONS', 'AUSN_CALCULATION']);
});
