import assert from 'node:assert/strict';
import test from 'node:test';
import { matchProcurementPaymentEvidence, type EvidencePlan } from '../lib/procurement-currency-payment-evidence';
import { paymentEvidenceFrom } from '../lib/procurement-ruble-payment-evidence';
import type { SupplierCurrencyPaymentRow } from '../lib/procurement-currency-payment-source';
import type { ExpenseRequestSourceRow } from '../lib/expense-request-source';
import { paymentFingerprint, manualPaymentLinks } from '../lib/procurement-manual-payment-links';

const plan: EvidencePlan = { id: 'mems', planCode: 'PAY-MEMS', supplierPartner: 'MEMS', supplierCounterparty: 'MEMS',
  orderRefs: ['order-mems'], plannedAmount: 280000, paymentMethod: 'CASH',
  createdAt: '2026-09-15T14:33:29.075Z', plannedDate: '2026-09-16', status: 'APPROVED' };
const payment: SupplierCurrencyPaymentRow = { ref: 'rko-mems', number: '00OF-001692',
  date: '16.09.2026 18:47:57', posted: true, deleted: false, documentCurrency: 'РУБ',
  documentAmount: 280000, baseDocumentRef: 'order-mems', cashbox: 'Сейф' };
const match = (payments = [payment], plans = [plan], requests: ExpenseRequestSourceRow[] = []) =>
  matchProcurementPaymentEvidence(plans, requests, payments, []);

test('direct RUB expense closes the request, independent of the remaining order debt', () => {
  const result = match().get(plan.id)!;
  assert.equal(result.state, 'ISSUED_BY_ONE_C');
  assert.equal(result.paidAmount, 0, 'RUB is recorded only in issuedAmount, not twice in the forecast');
  assert.equal(result.issuedAmount, 280000);
  assert.equal(result.remainingAmount, 0);
  assert.equal(result.cashOrders[0].number, payment.number);
});
test('partial payments sum in kopecks; no USDT percentage tolerance for rubles', () => {
  assert.equal(match([{ ...payment, documentAmount: 279999 }]).get(plan.id)!.state, 'PARTIALLY_ISSUED');
  const payments = [{ ...payment, documentAmount: 100000.01 }, { ...payment, ref: 'second', documentAmount: 179999.99 }];
  assert.equal(match(payments).get(plan.id)!.remainingAmount, 0);
  assert.equal(match(payments).get(plan.id)!.state, 'ISSUED_BY_ONE_C');
});
test('duplicates from register joins never multiply the amount; conflicting duplicates are ignored', () => {
  assert.equal(match([payment, payment]).get(plan.id)!.issuedAmount, 280000);
  assert.equal(match([payment, { ...payment, documentAmount: 2 }]).get(plan.id)!.issuedAmount, 0);
  assert.equal(match([payment, { ...payment, supplier: 'Other' }]).get(plan.id)!.issuedAmount, 0);
});
test('unposted, deleted, old, unlinked, malformed and foreign payments cannot prove RUB payment', () => {
  for (const changes of [ { posted: false }, { deleted: true }, { date: '14.09.2026 18:00:00' },
    { date: 'bad-date' }, { date: '31.02.2026 18:00:00' }, { baseDocumentRef: 'another-order' },
    { baseDocumentRef: '' }, { documentCurrency: 'USDT' } ]) {
    assert.equal(match([{ ...payment, ...changes }]).get(plan.id)!.state, 'NO_EVIDENCE');
  }
  assert.equal(match([payment], [{ ...plan, createdAt: undefined }]).get(plan.id)!.state, 'NO_EVIDENCE');
});
test('two requests for the same order require review, including across managers', () => {
  const result = match([payment], [plan, { ...plan, id: 'other-manager', planCode: 'OTHER' }]);
  for (const row of result.values()) {
    assert.equal(row.state, 'NEEDS_REVIEW');
    assert.equal(row.paidAmount, 0);
  }
});

const firstStage = { ...plan, id: 'deposit', planCode: 'PAY-DEPOSIT', plannedAmount: 67500 };
const secondStage = { ...plan, id: 'balance', planCode: 'PAY-BALANCE', plannedAmount: 516800,
  createdAt: '2026-09-27T09:00:00Z' };
const deposit = { ...payment, ref: 'deposit-rko', documentAmount: 67500, date: '26.09.2026 12:27:12' };
const balance = { ...payment, ref: 'balance-rko', documentAmount: 516800, date: '27.09.2026 13:38:28' };

test('paid deposit no longer competes with a later request for the same order, regardless of input order', () => {
  for (const plans of [[firstStage, secondStage], [secondStage, firstStage]]) {
    for (const payments of [[deposit, balance], [balance, deposit], [balance, deposit, deposit]]) {
      const result = match(payments, plans);
      assert.equal(result.get(firstStage.id)!.issuedAmount, 67500);
      assert.equal(result.get(secondStage.id)!.issuedAmount, 516800);
      for (const row of result.values()) {
        assert.equal(row.state, 'ISSUED_BY_ONE_C');
        assert.equal(row.remainingAmount, 0);
        assert.equal(row.cashOrders.length, 1);
      }
    }
  }
});
test('settlement-linked and explicitly confirmed deposits also release the next request', () => {
  const linkedDeposit = { ...deposit, baseDocumentRef: '', settlementOrderRef: 'order-mems', supplier: 'MEMS' };
  assert.equal(match([balance, linkedDeposit], [firstStage, secondStage]).get(secondStage.id)!.issuedAmount, 516800);
  const contractDeposit = { ...deposit, baseDocumentRef: '', supplier: 'MEMS' };
  const confirmed = { ...firstStage, manualRubleLinks: [{ ref: deposit.ref, fingerprint: paymentFingerprint(contractDeposit) }] };
  assert.equal(match([balance, contractDeposit], [confirmed, secondStage]).get(secondStage.id)!.issuedAmount, 516800);
});
test('removed, unposted, deleted, partial or conflicting deposits cannot silently release a second request', () => {
  for (const prior of [[], [{ ...deposit, posted: false }], [{ ...deposit, deleted: true }],
    [{ ...deposit, documentAmount: 67499.99 }], [deposit, { ...deposit, documentAmount: 67000 }]]) {
    const result = match([...prior, balance], [firstStage, secondStage]);
    assert.equal(result.get(secondStage.id)!.state, 'NEEDS_REVIEW');
    assert.equal(result.get(secondStage.id)!.issuedAmount, 0);
    assert.ok(result.get(firstStage.id)!.issuedAmount < 67500);
  }
});
test('a future or undated request-linked receipt cannot resolve an earlier ambiguous payment', () => {
  for (const date of ['28.09.2026 12:00:00', '', balance.date]) {
    const requests = [{ comment: firstStage.planCode, counterparty: { name: 'MEMS' },
      linked_cash_expense_orders: { rows: [{ ref: 'explicit', posted: true, amount: 67500, date }] },
    }] as ExpenseRequestSourceRow[];
    assert.equal(match([balance], [firstStage, secondStage], requests).get(secondStage.id)!.issuedAmount, 0);
  }
  const requests = [{ comment: firstStage.planCode, counterparty: { name: 'MEMS' },
    linked_cash_expense_orders: { rows: [{ ref: deposit.ref, posted: true, amount: 67500, date: deposit.date }] },
  }] as ExpenseRequestSourceRow[];
  assert.equal(match([balance, deposit], [firstStage, secondStage], requests).get(secondStage.id)!.issuedAmount, 516800);
});
test('ambiguous shared claims cannot prove that the old request is already covered', () => {
  const third = { ...firstStage, id: 'third', planCode: 'PAY-THIRD', orderRefs: ['different-order'] };
  const requests = [{ comment: `${firstStage.planCode} ${third.planCode}`, counterparty: { name: 'MEMS' },
    linked_cash_expense_orders: { rows: [{ ref: deposit.ref, posted: true, amount: 67500, date: deposit.date }] },
  }] as ExpenseRequestSourceRow[];
  assert.equal(match([balance], [firstStage, secondStage, third], requests).get(secondStage.id)!.issuedAmount, 0);
});
test('later unassigned payments are not swallowed by an already paid request', () => {
  const result = match([balance, deposit], [firstStage]).get(firstStage.id)!;
  assert.equal(result.issuedAmount, 67500);
  assert.deepEqual(result.cashOrders.map(row => row.ref), [deposit.ref]);
});
test('cancelled and unapproved requests are not automatically fulfilled', () => {
  for (const status of ['CANCELLED', 'SUBMITTED', 'DRAFT']) {
    assert.equal(match([payment], [{ ...plan, status }]).get(plan.id)!.state, 'NO_EVIDENCE');
  }
});
test('a document already found via an expense request is not counted twice', () => {
  const requests = [{ comment: plan.planCode, counterparty: { name: 'MEMS' },
    linked_cash_expense_orders: { rows: [{ ref: payment.ref, number: payment.number, posted: true, amount: 280000 }] },
  }] as ExpenseRequestSourceRow[];
  const result = match([payment], [plan], requests).get(plan.id)!;
  assert.equal(result.cashOrders.length, 1);
  assert.equal(result.issuedAmount, 280000);
});
test('removal of a posted payment reopens the derived result; history does not age out at 31 days', () => {
  assert.equal(match([]).get(plan.id)!.state, 'NO_EVIDENCE');
  assert.equal(paymentEvidenceFrom([{ createdAt: plan.createdAt! }], new Date('2026-11-01')).toISOString(), '2026-09-14T14:33:29.075Z');
});

test('ambiguous legacy claims do not reduce the forecast twice', () => {
  const second = { ...plan, id: 'second', planCode: 'PAY-SECOND' };
  const requests = [{ comment: `${plan.planCode} ${second.planCode}`, counterparty: { name: 'MEMS' },
    linked_cash_expense_orders: { rows: [{ ref: payment.ref, posted: true, amount: 280000 }] },
  }] as ExpenseRequestSourceRow[];
  for (const row of match([payment], [plan, second], requests).values()) {
    assert.equal(row.state, 'NEEDS_REVIEW');
    assert.equal(row.issuedAmount, 0);
    assert.equal(row.remainingAmount, 280000);
  }
});

test('contract payment requires explicit confirmation and revalidates live supplier/amount', () => {
  const contractPayment = { ...payment, baseDocumentRef: '', supplier: 'MEMS', contract: 'Contract MEMS' };
  assert.equal(match([contractPayment]).get(plan.id)!.state, 'NO_EVIDENCE');
  const confirmed = { ...plan, manualRubleLinks: [{ ref: payment.ref, fingerprint: paymentFingerprint(contractPayment) }] };
  const result = match([contractPayment], [confirmed]).get(plan.id)!;
  assert.equal(result.state, 'ISSUED_BY_ONE_C');
  assert.equal(result.manualPaymentCount, 1);
  assert.equal(result.issuedAmount, 280000);
  for (const changes of [{ documentAmount: 270000 }, { supplier: 'Other' }, { contract: 'Other' }, { posted: false }]) {
    assert.equal(match([{ ...contractPayment, ...changes }], [confirmed]).get(plan.id)!.issuedAmount, 0);
  }
  assert.equal(match([], [confirmed]).get(plan.id)!.issuedAmount, 0);
});
test('revoke confirmation reopens contract payment and duplicate manual owners never auto-close', () => {
  const contractPayment = { ...payment, baseDocumentRef: '', supplier: 'MEMS' };
  const confirmed = { ...plan, manualRubleLinks: [{ ref: payment.ref, fingerprint: paymentFingerprint(contractPayment) }] };
  assert.equal(match([contractPayment], [{ ...confirmed, manualRubleLinks: [] }]).get(plan.id)!.issuedAmount, 0);
  for (const row of match([contractPayment], [confirmed, { ...confirmed, id: 'second' }]).values()) assert.equal(row.issuedAmount, 0);
  assert.deepEqual(manualPaymentLinks({ unrelated: true }), []);
  assert.deepEqual(manualPaymentLinks({ manualRubleLinks: [null, { ref: 'rko' }] }), []);
});
