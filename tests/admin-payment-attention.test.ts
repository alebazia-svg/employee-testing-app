import assert from 'node:assert/strict';
import test from 'node:test';
import { supplierPaymentAttention } from '../lib/admin-payment-attention';

type Plan = Parameters<typeof supplierPaymentAttention>[0][number];
const today = '2026-11-25';
const tomorrow = '2026-11-26';

function plan(id: string, date: string, patch: Partial<Plan> = {}): Plan {
  return { id, plannedDate: date, status: 'APPROVED', paymentMethod: 'CASH',
    evidence: { state: 'NO_EVIDENCE' }, hasPendingRevision: false, ...patch };
}

test('only decisions and unresolved preparation by tomorrow enter the sidebar', () => {
  const plans = [
    plan('new', today, { status: 'SUBMITTED' }),
    plan('amendment', today, { hasPendingRevision: true }),
    plan('late', '2026-11-24'),
    plan('today', today),
    plan('partial', tomorrow, { evidence: { state: 'PARTIALLY_ISSUED' } }),
    plan('later', '2026-11-27'),
    plan('removed', today, { status: 'CANCELLED' }),
    plan('receipt', today, { paymentMethod: 'ACCOUNTABLE_QR' }),
    plan('covered', today),
    plan('paid', today, { evidence: { state: 'PAID_BY_ONE_C' } }),
    plan('disputed', today, { evidence: { state: 'NO_EVIDENCE', paymentReviewReasons: [{ ref: 'ref', message: 'Проверить' }] } }),
    plan('missing', today),
    plan('paid-before-decision', today, { status: 'SUBMITTED', evidence: { state: 'PAID_BY_ONE_C' } }),
  ];
  const amounts = new Map(plans.map(row => [row.id, { amount: row.id === 'covered' ? 0 : row.id === 'missing' ? null : 10 }]));
  assert.deepEqual(supplierPaymentAttention(plans, today, amounts, new Set(['receipt']), true),
    { decisions: 2, preparation: 3 });
});

test('a deferral and a complete payment remove a reminder while missing evidence stays unknown', () => {
  const current = plan('scheduled', today);
  const deferral = { date: '2026-11-28', comment: '', changedAt: today, actorId: 1 };
  const deferred = { ...current, oneCCashEvidence: { fundingDeferral: deferral } };
  const amounts = new Map([[current.id, { amount: 100 }]]);
  assert.equal(supplierPaymentAttention([current], today, amounts, new Set(), true).preparation, 1);
  assert.equal(supplierPaymentAttention([deferred], today, amounts, new Set(), true).preparation, 0);
  assert.equal(supplierPaymentAttention([current], today, new Map(), new Set(), true).preparation, 0);
  assert.equal(supplierPaymentAttention([current], today, amounts, new Set(), false).preparation, null);
});
