import test from 'node:test';
import assert from 'node:assert/strict';
import { taxLimitEvidence } from '../lib/tax-limit-evidence';
import { parseIncomeEvidence, type IncomeEvidenceReview, type IncomeEvidence } from '../lib/tax-income-evidence';
import type { PortalReport } from '../lib/ausn-portal-view';
const report = { available: true, kind: 'full', year: '2026', usnBaseline: 2_404_309 } as PortalReport;
const item: IncomeEvidence = { id: 'vtb', date: '2026-09-28', bank: 'ВТБ', amountCents: 11_800_000, bankBaseCents: 0, fiscalBaseCents: null, identityResolved: false, fnsSearchComplete: false, finding: 'Учёт оплаты не установлен', internalNotes: [], sourceDocumentIds: ['source'] };
const review: IncomeEvidenceReview = { schema: 1, reviewedAt: '2026-11-01T00:00:00Z', title: 'Разбор', fnsSnapshot: { year: '2026', from: '2026-04-01', through: '2026-10-31', exportedAt: '2026-11-01T09:51:00Z', incomeCents: 4_500_000_000, sourceDocumentId: 'source' }, cases: [item] };
test('scenario includes pre-transition income once, adds only unresolved VTB and preserves negative headroom', () => {
 const v = taxLimitEvidence(report, review)!;
 assert.equal(v.knownCents, 4_740_430_900);
 assert.equal(v.riskCents, 11_800_000);
 assert.equal(taxLimitEvidence({ ...report, remaining: 5_000_000 }, review)!.planningRemainingCents, 500_000_000);
 assert.equal(v.planningRemainingCents, undefined);
 assert.equal(v.cautiousRemainingCents, 6_000_000_000 - 4_752_230_900);
 assert.equal(taxLimitEvidence(report, { ...review, cases: [{ ...item, bank: 'Т-Банк' }] })!.riskCents, 0);
 assert.equal(taxLimitEvidence(report, { ...review, cases: [{ ...item, bankBaseCents: item.amountCents, fiscalBaseCents: 0, identityResolved: true, fnsSearchComplete: true }] })!.riskCents, 0);
 assert.ok(taxLimitEvidence(report, { ...review, fnsSnapshot: { ...review.fnsSnapshot!, incomeCents: 6_000_000_000 } })!.knownRemainingCents < 0);
});
test('missing, partial or different-year sources cannot produce a fictitious annual balance', () => {
 for (const r of [undefined, { ...report, available: false }, { ...report, kind: 'month' }, { ...report, usnBaseline: undefined }, { ...report, year: '2027' }] as Array<PortalReport | undefined>) assert.equal(taxLimitEvidence(r, review), undefined);
 assert.equal(taxLimitEvidence(report, { ...review, fnsSnapshot: undefined }), undefined);
 assert.equal(taxLimitEvidence(report, { ...review, fnsSnapshot: { ...review.fnsSnapshot!, from: '2026-05-01' } }), undefined);
 assert.equal(taxLimitEvidence(report, { ...review, cases: [{ ...item, date: '2026-11-01' }] })!.riskCents, 0);
});
test('snapshot schema rejects invalid dates, missing evidence, fractional money and mixed years', () => {
 assert.ok(parseIncomeEvidence(JSON.stringify(review)));
 for (const bad of [{ through: '2026-02-30' }, { from: '2025-04-01' }, { incomeCents: 1.5 }, { sourceDocumentId: '' }]) assert.equal(parseIncomeEvidence(JSON.stringify({ ...review, fnsSnapshot: { ...review.fnsSnapshot, ...bad } })), undefined);
});
