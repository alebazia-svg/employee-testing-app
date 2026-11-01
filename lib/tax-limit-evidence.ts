import type { PortalReport } from './ausn-portal-view';
import { incomeRecognition, type IncomeEvidenceReview } from './tax-income-evidence';
// Scenario arithmetic over an official FNS snapshot and the runner's existing
// pre-transition baseline. Never updates the canonical income/tax calculation.
export function taxLimitEvidence(report?: PortalReport, review?: IncomeEvidenceReview) {
  const snapshot = review?.fnsSnapshot;
  // The current runner's pre-transition field explicitly covers Jan–Mar2026.
  if (!report?.available || report.kind !== 'full' || report.year !== '2026' || report.usnBaseline === undefined || !Number.isFinite(report.usnBaseline) || report.usnBaseline < 0 || snapshot?.year !== report.year || snapshot.from !== '2026-04-01') return;
  const candidates = review!.cases.filter(c => /^\s*(?:Банк\s+)?ВТБ(?:\s|$)/i.test(c.bank) && c.date >= snapshot.from && c.date <= snapshot.through && c.bankBaseCents === 0 && (incomeRecognition(c) === 'omitted' || (incomeRecognition(c) === 'unconfirmed' && (c.fiscalBaseCents === null || c.fiscalBaseCents === 0))));
  const baselineCents = Math.round(report.usnBaseline * 100);
  const riskCents = candidates.reduce((n, c) => n + c.amountCents, 0);
  const knownCents = baselineCents + snapshot.incomeCents;
  const cautiousCents = knownCents + riskCents;
  if (![baselineCents, riskCents, knownCents, cautiousCents].every(Number.isSafeInteger)) return;
  const existingRemainingCents = report.remaining !== undefined && Number.isFinite(report.remaining) ? Math.round(report.remaining * 100) : undefined;
  const planningRemainingCents = existingRemainingCents !== undefined && Number.isSafeInteger(existingRemainingCents) ? Math.min(existingRemainingCents, 6_000_000_000 - cautiousCents) : undefined;
  return { planningRemainingCents, snapshot, baselineCents, riskCents, count: candidates.length, knownCents, cautiousCents, knownRemainingCents: 6_000_000_000 - knownCents, cautiousRemainingCents: 6_000_000_000 - cautiousCents };
}
