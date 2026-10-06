import test from 'node:test';
import assert from 'node:assert/strict';
import { attachRegisterPaymentBasis } from '../lib/procurement-register-payment-basis';
import { hasConfirmedPaymentBasis } from '../lib/procurement-payment-basis';
import { matchProcurementPaymentEvidence, type EvidencePlan } from '../lib/procurement-currency-payment-evidence';
import { paymentFingerprint } from '../lib/procurement-manual-payment-links';
import type { SupplierCurrencyPaymentRow } from '../lib/procurement-currency-payment-source';

const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const now = new Date('2026-10-05T16:00:00Z');
const payment: SupplierCurrencyPaymentRow = { ref: id(1), number: 'TEST', date: '05.10.2026 14:04:40',
  supplier: 'Supplier', counterparty: 'Company', documentAmount: 126000, documentCurrency: 'РУБ',
  baseDocumentRef: '', contract: '', posted: true, deleted: false };
const dimensions = { supplier_ref: id(2), counterparty_ref: id(3), organization_ref: id(4), currency_ref: id(5) };
const proof = () => ({ ok: true, complete: true, write_operations: false,
  contract_version: 'supplier-payment-basis-v1', as_of: now.toISOString(),
  payment: [{ ...dimensions, payment_ref: payment.ref, payment_number: payment.number,
    payment_date: payment.date, amount: 126000, supplier_name: 'Supplier', counterparty_name: 'Company',
    currency_name: 'руб', posted: true, deleted: false, supplier_payment: true, version_token: 'v1' }],
  movements: [{ ...dimensions, payment_ref: payment.ref, line_number: 1, movement_date: payment.date,
    amount: 126000, movement_type: 'Приход', currency_name: 'руб', contract_ref: id(6), contract_name: 'Contract' }],
});
const plan: EvidencePlan = { id: 'plan', planCode: 'PAY-TEST', supplierPartner: 'Supplier', supplierCounterparty: 'Company',
  orderRefs: [], plannedAmount: 126000, paymentMethod: 'CASH', status: 'APPROVED', createdAt: '2026-10-04T10:00:00Z' };
const match = (payments: SupplierCurrencyPaymentRow[], plans = [plan]) => matchProcurementPaymentEvidence(plans, [], payments, []);

test('missing header with full exact register contract closes sole debt request once', () => {
  const linked = attachRegisterPaymentBasis(payment, proof(), now);
  assert.equal(linked.contract, '', 'do not rewrite header or legacy manual links');
  assert.equal(hasConfirmedPaymentBasis(linked), true);
  for (const rows of [[linked], [linked, linked]]) {
    const result = match(rows).get(plan.id)!;
    assert.equal(result.state, 'ISSUED_BY_ONE_C');
    assert.equal(result.issuedAmount, 126000);
    assert.equal(result.cashOrders.length, 1);
  }
  assert.equal(match([payment]).get(plan.id)!.issuedAmount, 0);
});

test('multiple requests cannot share an inferred contract payment', () => {
  const linked = attachRegisterPaymentBasis(payment, proof(), now);
  for (const result of match([linked], [plan, { ...plan, id: 'other', planCode: 'OTHER' }]).values()) {
    assert.equal(result.issuedAmount, 0);
    assert.equal(result.state, 'NEEDS_REVIEW');
  }
});

test('partial, duplicated, foreign or unbased movements never prove the whole RKO', () => {
  const cases = [
    (p: ReturnType<typeof proof>) => { p.movements[0].amount--; },
    (p: ReturnType<typeof proof>) => { p.movements.push({ ...p.movements[0] }); },
    (p: ReturnType<typeof proof>) => { p.movements[0].contract_ref = ''; },
    (p: ReturnType<typeof proof>) => { p.movements[0].counterparty_ref = id(7); },
    (p: ReturnType<typeof proof>) => { p.movements[0].movement_type = 'Расход'; },
    (p: ReturnType<typeof proof>) => { p.movements[0].currency_name = 'USD'; },
    (p: ReturnType<typeof proof>) => { p.movements[0].movement_date = '06.10.2026 14:04:40'; },
    (p: ReturnType<typeof proof>) => { p.movements = []; },
  ];
  for (const change of cases) {
    const p = proof(); change(p);
    assert.equal(hasConfirmedPaymentBasis(attachRegisterPaymentBasis(payment, p, now)), false);
  }
});

test('all contract splits must cover the exact amount and match dimensions', () => {
  const p = proof(); p.movements[0].amount = 100000;
  p.movements.push({ ...p.movements[0], line_number: 2, amount: 26000, contract_ref: id(8), contract_name: 'Second contract' });
  assert.equal(attachRegisterPaymentBasis(payment, p, now).registerContractBasis?.contracts.length, 2);
  p.movements[1].contract_ref = '';
  assert.equal(hasConfirmedPaymentBasis(attachRegisterPaymentBasis(payment, p, now)), false);
});

test('cancelled payment and missing source revoke evidence without retaining paid state', () => {
  for (const state of [{ posted: false }, { deleted: true }, { supplier_payment: false }]) {
    const p = proof(); Object.assign(p.payment[0], state);
    const linked = attachRegisterPaymentBasis(payment, p, now);
    assert.equal(linked.posted, false);
    assert.equal(match([linked]).get(plan.id)!.issuedAmount, 0);
  }
  assert.equal(match([]).get(plan.id)!.issuedAmount, 0);
});

test('incomplete, stale or mismatched reads fail closed; old API is not proof', () => {
  for (const patch of [{ complete: false }, { as_of: '2026-10-04T16:00:00Z' }, { write_operations: true }]) {
    assert.throws(() => attachRegisterPaymentBasis(payment, { ...proof(), ...patch }, now), /SOURCE_INCOMPLETE/);
  }
  const p = proof(); p.payment[0].amount--;
  assert.throws(() => attachRegisterPaymentBasis(payment, p, now), /DOCUMENT_MISMATCH/);
  assert.equal(hasConfirmedPaymentBasis(attachRegisterPaymentBasis(payment, { ok: true, rows: [] }, now)), false);
});

test('manual fingerprint preserves old links and binds new register links to proof', () => {
  const original = paymentFingerprint(payment);
  assert.equal(original, JSON.stringify([payment.ref, payment.date, 126000, 'РУБ', '', 'Supplier', 'Company', '']));
  const linked = attachRegisterPaymentBasis(payment, proof(), now);
  assert.notEqual(paymentFingerprint(linked), original);
  const p = proof(); p.payment[0].version_token = 'v2';
  assert.notEqual(paymentFingerprint(attachRegisterPaymentBasis(payment, p, now)), paymentFingerprint(linked));
  assert.equal(match([linked, payment]).get(plan.id)!.issuedAmount, 0, 'conflicting duplicate proofs are not merged');
});
