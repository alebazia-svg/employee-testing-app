import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePortalReport } from '../lib/ausn-portal-view';
import { reportChanges, reviewIssues, reviewMonths } from '../lib/ausn-month-review';
import { buildTaxDocumentPlan } from '../lib/tax-document-plan';
import { ownerFullReport, ownerFullReportAfterEns } from '../app/taxes-development-preview/owner-scenario';

const report = parsePortalReport(ownerFullReport, 'ausn-executive-full-20261025T074847.md');
const plan = buildTaxDocumentPlan({ now: new Date('2026-10-25T12:00:00Z'), reports: [], documents: [] });

test('runner per-month structure and FNS sections are parsed without inventing zeroes', () => {
  assert.equal(report.available, true, report.reason);
  assert.equal(report.monthDetails.length, 7);
  const may = report.monthDetails.find((month) => month.periodKey === '2026-05')!;
  assert.equal(may.base, 6_850_220.4);
  assert.equal(may.fnsAccepted, 6_840_105.3);
  assert.equal(may.fnsDifference, 10_115.1);
  const october = report.monthDetails.find((month) => month.periodKey === '2026-10')!;
  assert.equal(october.enpPaymentState, 'not_found');
  assert.equal(october.enpPayment, undefined);
  assert.equal(october.fnsAccepted, undefined);
  const august = report.monthDetails.find((month) => month.periodKey === '2026-08')!;
  assert.equal(august.fnsAssessedState, 'not_loaded');
  assert.equal(august.fnsAssessed, undefined);
  assert.deepEqual(report.fnsCoverage, { from: '2026-04', to: '2026-09' });
  // Full-period runner labels without the AQSI suffix still fill the structure.
  assert.equal(report.incomeStructure?.acquiring, 18_741_655.2);
  assert.equal(report.incomeStructure?.cash, 8_228_043.75);
});

test('month review flags differences, missing data and the open month', () => {
  const months = reviewMonths({ report, plan, today: '2026-10-25' });
  const state = Object.fromEntries(months.map((month) => [month.periodKey, month.state]));
  assert.equal(state['2026-04'], 'waiting'); // no FNS documents in the archive for this plan
  assert.equal(state['2026-05'], 'attention');
  assert.equal(state['2026-08'], 'attention'); // FNS difference and ENP underpayment
  assert.equal(state['2026-10'], 'open');
  const september = months.find((month) => month.periodKey === '2026-09')!;
  assert.equal(september.checks.find((check) => check.key === 'ens')?.state, 'missing');
  const october = months.find((month) => month.periodKey === '2026-10')!;
  assert.equal(october.checks.find((check) => check.key === 'payment')?.state, 'not_due');
});

test('issues put real differences first and never report an unpaid month before its due date', () => {
  const issues = reviewIssues({ report, months: reviewMonths({ report, plan, today: '2026-10-25' }) });
  assert.equal(issues[0].severity, 'high');
  assert.ok(issues.some((issue) => issue.kind === 'fns' && issue.periodKey === '2026-08' && issue.amount === 15_000));
  assert.ok(issues.some((issue) => issue.kind === 'payment' && issue.periodKey === '2026-08' && /недоплачено/.test(issue.title)));
  assert.ok(!issues.some((issue) => issue.kind === 'payment' && issue.periodKey === '2026-10'));
  assert.ok(issues.some((issue) => issue.kind === 'refunds'));
});

test('upload changes describe only what differs between two runs', () => {
  const after = parsePortalReport(ownerFullReportAfterEns, 'ausn-executive-full-20261025T080512.md');
  assert.deepEqual(reportChanges(report, after).map((line) => line.replace(/[\u00a0\u202f]/g, ' ')), ['Август 2026: налоговая начислила 617 693,57 ₽.']);
  assert.match(reportChanges(report, report)[0], /не изменились/);
});

import { taxHealth } from '../lib/tax-health';

test('health flags a stale report, failed processing and missing permanent documents in plain words', () => {
  const documents = [
    { id: 'a', documentType: 'ENS_OPERATIONS', status: 'PROCESSING_FAILED', originalName: 'ens.zip', createdAt: new Date('2026-10-28T10:00:00Z'), coverageFrom: '2026-06', coverageTo: '2026-09', periodKey: '2026-09' },
    { id: 'b', documentType: 'ENS_OPERATIONS', status: 'UPLOADED', originalName: 'old.zip', createdAt: new Date('2026-10-20T10:00:00Z'), coverageFrom: '2026-04', coverageTo: '2026-06', periodKey: '2026-06' },
    { id: 'c', documentType: 'ENS_OPERATIONS', status: 'PROCESSED', originalName: 'mid.zip', createdAt: new Date('2026-10-21T10:00:00Z'), coverageFrom: '2026-04', coverageTo: '2026-08', periodKey: '2026-08' },
  ];
  const health = taxHealth({ full: report, documents, now: new Date('2026-10-29T10:00:00Z') });
  const ids = health.map((item) => item.id);
  assert.ok(ids.includes('stale'));
  assert.ok(ids.includes('failed-a'));
  assert.ok(!ids.includes('stuck-b'), 'an old archive copy superseded by a processed file is not a problem');
  assert.ok(ids.includes('declaration') && ids.includes('transition'));
  assert.equal(health[0].level, 'error');
  assert.equal(taxHealth({ full: report, documents: [], now: new Date('2026-10-25T12:00:00Z') }).some((item) => item.id === 'stale'), false);
  const broken = parsePortalReport(ownerFullReport.replace('полнота: да', 'полнота: нет'), 'ausn-executive-full-20261025T074847.md');
  const blocked = taxHealth({ full: broken, documents: [], now: new Date('2026-10-25T12:00:00Z') });
  assert.equal(blocked[0].id, 'report-missing');
  assert.match(blocked[0].text, /чеки кассы/);
});

test('no false alarms from production data: open month, unsearched payments, one item per missing source', () => {
  const open = ownerFullReport.replace('| 2026-09 · Принято ФНС | 7 169 708,73 ₽ |', '| 2026-09 · Принято ФНС | 7 169 708,73 ₽ |\n| 2026-10 · Принято ФНС | 1 000 000,00 ₽ |\n| 2026-10 · Разница с ФНС | +3 817 602,12 ₽ |')
  const parsed = parsePortalReport(open, 'ausn-executive-full-20261025T074847.md');
  const months = reviewMonths({ report: parsed, plan, today: '2026-11-30' });
  const october = months.find((month) => month.periodKey === '2026-10')!;
  assert.equal(october.checks.find((check) => check.key === 'fns')?.state, 'not_due');
  assert.equal(october.checks.find((check) => check.key === 'payment')?.state, 'unknown');
  const issues = reviewIssues({ report: parsed, months });
  assert.ok(!issues.some((issue) => issue.kind === 'payment' && /не найдена/.test(issue.title)));
  assert.ok(!issues.some((issue) => issue.periodKey === '2026-10' && issue.kind === 'fns' && issue.severity === 'high'));
  assert.equal(issues.filter((issue) => issue.kind === 'ens' && issue.severity === 'medium').length, 1);
});
