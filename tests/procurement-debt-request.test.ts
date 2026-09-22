import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePaymentPlan } from '../lib/procurement-payment-control';
import { debtRequestConflict } from '../lib/procurement-debt-request';
import { matchProcurementPaymentEvidence, type EvidencePlan } from '../lib/procurement-currency-payment-evidence';
import { paymentFingerprint } from '../lib/procurement-manual-payment-links';

test('debt basis requires explicit server permission and has no synthetic orders', () => {
  const input = { supplierPartner: 'Курбан', orderRefs: [], plannedDate: '2026-09-22', plannedAmount: 100000, paymentMethod: 'CASH' };
  assert.equal(validatePaymentPlan(input).ok, false);
  const result = validatePaymentPlan(input, true);
  assert.equal(result.ok, true);
  assert.equal(result.data.condition, 'В счёт долга поставщику');
  assert.deepEqual(result.data.orderRefs, []);
  assert.equal(validatePaymentPlan({ ...input, orderNumbers: ['fake'] }, true).ok, false);
  assert.equal(validatePaymentPlan({ ...input, plannedAmount: '', paymentMethod: 'USDT', foreignAmount: 500 }, true).ok, true);
});
const plan: EvidencePlan = { id: 'debt', planCode: 'PAY-DEBT', supplierPartner: 'Курбан', supplierCounterparty: '', orderRefs: [], plannedAmount: 100000, paymentMethod: 'CASH', status: 'APPROVED', createdAt: '2026-09-20T10:00:00Z' };
const payment = { ref: 'rko', number: 'TEST', date: '21.09.2026 10:00:00', posted: true, deleted: false, documentAmount: 100000, documentCurrency: 'РУБ', baseDocumentRef: '', supplier: 'Курбан' };
test('same supplier alone never closes debt; confirmed RKO closes it and revocation reopens it', () => {
  const match = (p: EvidencePlan, rows = [payment]) => matchProcurementPaymentEvidence([p], [], rows, []).get(p.id)!;
  assert.equal(match(plan).state, 'NO_EVIDENCE');
  const confirmed = { ...plan, manualRubleLinks: [{ ref: payment.ref, fingerprint: paymentFingerprint(payment) }] };
  assert.equal(match(confirmed).state, 'ISSUED_BY_ONE_C');
  assert.equal(match(confirmed).remainingAmount, 0);
  assert.equal(match(confirmed, []).state, 'NO_EVIDENCE');
  assert.equal(match(confirmed, [{ ...payment, supplier: 'Другой' }]).state, 'NO_EVIDENCE');
});
test('partial confirmed payments leave only the unpaid amount', () => {
  const part = { ...payment, documentAmount: 40000 };
  const result = matchProcurementPaymentEvidence([{ ...plan, manualRubleLinks: [{ ref: part.ref, fingerprint: paymentFingerprint(part) }] }], [], [part], []).get(plan.id)!;
  assert.equal(result.state, 'PARTIALLY_ISSUED');
  assert.equal(result.remainingAmount, 60000);
});
test('unfinished debt requests block duplicates, paid/cancelled/order requests do not', () => {
  const row = { ...plan, status: 'APPROVED' };
  assert.equal(debtRequestConflict([row], 'Курбан', new Map()), true);
  assert.equal(debtRequestConflict([row], 'Курбан', new Map([[row.id, { state: 'ISSUED_BY_ONE_C' }]])), false);
  assert.equal(debtRequestConflict([{ ...row, status: 'CANCELLED' }], 'Курбан', new Map()), false);
  assert.equal(debtRequestConflict([{ ...row, orderRefs: ['order'] }], 'Курбан', new Map()), false);
});
