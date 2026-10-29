import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePortalReport } from '../lib/ausn-portal-view';
import { reviewIssues, reviewMonths } from '../lib/ausn-month-review';
import { buildTaxDocumentPlan } from '../lib/tax-document-plan';
import { parseFnsGaps } from '../lib/ausn-fns-gaps';
import { ownerFullReport } from '../app/taxes-development-preview/owner-scenario';

const report = parsePortalReport(ownerFullReport, 'ausn-executive-full-20261025T074847.md');
const plan = buildTaxDocumentPlan({ now: new Date('2026-10-25T12:00:00Z'), reports: [], documents: [] });
const months = reviewMonths({ report, plan, today: '2026-10-25' });
const august = report.monthDetails.find((month) => month.periodKey === '2026-08')!;

const raw = JSON.stringify({ lk_from: '2026-04-01', lk_to: '2026-10-15', months: {
  '2026-08': {
    missing_in_fns: [{ date: '2026-08-03', amount: 12_000, kind: 'Кредит/рассрочка', payer: 'Кредит/рассрочка', account: 'ВТБ КБР', purpose: 'Перевод по соглашению о номинальном счёте' }, { date: 'bad', amount: 1 }],
    missing_in_ours: [], cash_days: [{ date: '2026-08-10', ours: 5_000, fns: 2_000 }],
    missing_in_fns_total: 12_000, missing_in_ours_total: 0, cash_difference: 3_000,
  },
  'junk': {},
} });

test('runner comparison is parsed defensively', () => {
  const gaps = parseFnsGaps(raw, 'ausn-fns-gaps-20261025T074847.json')!;
  assert.deepEqual(Object.keys(gaps.months), ['2026-08']);
  assert.equal(gaps.months['2026-08'].missingInFns.length, 1);
  assert.equal(gaps.months['2026-08'].cashDays[0].fns, 2_000);
  assert.equal(parseFnsGaps('not json', 'x'), undefined);
});

test('an income difference is explained by operations and carries the list', () => {
  const gaps = parseFnsGaps(raw, 'ausn-fns-gaps-20261025T074847.json')!;
  const issues = reviewIssues({ report, months, gaps });
  const issue = issues.find((item) => item.kind === 'fns' && item.periodKey === '2026-08')!;
  assert.equal(august.fnsDifference, 15_000);
  assert.match(issue.text, /Налоговая не видит 1 поступление на 12\s000,00\s₽ \(кредит\/рассрочка\)/);
  assert.match(issue.text, /Касса: в 1 день/);
  assert.doesNotMatch(issue.text, /Не разобрано/); // 12 000 + 3 000 = 15 000
  assert.match(issue.action || '', /бухгалтеру/);
  assert.equal(issue.operations?.missingInFns[0].account, 'ВТБ КБР');
});

test('without a comparison the advice asks for a fresh export and no list is attached', () => {
  const issue = reviewIssues({ report, months }).find((item) => item.kind === 'fns' && item.periodKey === '2026-08')!;
  assert.equal(issue.operations, undefined);
  assert.match(issue.action || '', /сравнит её с нашим учётом по операциям/);
});

test('a tax difference that follows from the income difference of the same month is not a separate item', () => {
  const withTax = { ...report, monthDetails: report.monthDetails.map((month) => month.periodKey === '2026-08' ? { ...month, fnsAssessed: 400_000, fnsAssessedState: 'loaded' as const } : month) };
  const reviewed = reviewMonths({ report: withTax, plan, today: '2026-10-25' });
  const issues = reviewIssues({ report: withTax, months: reviewed });
  assert.ok(!issues.some((item) => item.kind === 'ens' && item.periodKey === '2026-08'));
  assert.match(issues.find((item) => item.kind === 'fns' && item.periodKey === '2026-08')!.text, /следствие той же разницы/);
});
