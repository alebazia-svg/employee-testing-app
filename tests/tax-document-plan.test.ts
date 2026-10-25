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

test('runner evidence and portal uploads close a period together', () => {
  const plan = buildTaxDocumentPlan({
    now: new Date('2026-05-20T09:00:00+03:00'),
    reports: [report('2026-04', 'Сверка ЕНС недоступна')],
    documents: [{ documentType: 'ENS_OPERATIONS', periodKey: '2026-04', originalName: 'ens.csv', source: 'portal' }],
  });
  assert.equal(plan[0].status, 'complete');
  assert.deepEqual(plan[0].missing, []);
});

test('oldest incomplete period stays visible until all required documents exist', () => {
  const plan = buildTaxDocumentPlan({ now: new Date('2026-06-20T09:00:00+03:00'), reports: [], documents: [] });
  assert.equal(plan[0].periodKey, '2026-04');
  assert.equal(plan[0].missing.length, 3);
  assert.equal(plan[1].periodKey, '2026-05');
});
