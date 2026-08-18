import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCreditRealizationControlInput,
  creditFiscalKey,
  evaluateCreditRealization,
  type CreditRealizationControlInput,
} from '../lib/credit-realization-control';
import { normalizeSalesRealizationLinksPayload } from '../lib/one-c';

function operation(overrides: Partial<CreditRealizationControlInput['fiscalDocuments'][number]['operations'][number]> = {}) {
  return {
    datetime: '18.08.2026 12:05:00',
    amount: 100_000,
    cashPayment: 0,
    electronicPayment: 0,
    prepayment: 0,
    postpayment: 100_000,
    documentType: 'Кассовый чек',
    fiscalDriveNumber: '000123',
    fiscalDocumentNumber: '0000456',
    fiscalSign: '0000789',
    fiscalized: true,
    ...overrides,
  };
}

function input(overrides: Partial<CreditRealizationControlInput> = {}): CreditRealizationControlInput {
  const op = operation();
  return {
    now: new Date('2026-08-18T10:00:00.000Z'),
    graceMinutes: 15,
    realization: {
      ref: 'sale-1', number: 'R-1', date: '18.08.2026 12:00:00', posted: true, deletionMark: false,
      amount: 100_000, counterpartyRef: 'customer-1', managerRef: 'manager-1',
    },
    directPayments: [],
    fiscalDocuments: [{ sourceType: 'realization', documentRef: 'sale-1', operations: [op] }],
    directReturns: 0,
    directCorrections: 0,
    completeness: { linksComplete: true, fiscalOperationsComplete: true, complete: true, absenceIsHardErrorEligible: true },
    ofd: { complete: true, confirmedFiscalKeys: [creditFiscalKey(op)], unlinkedExactReceipts: [] },
    ...overrides,
  };
}

test('confirms a no-initial-payment realization only with full credit and OFD confirmation', () => {
  assert.deepEqual(evaluateCreditRealization(input()).reasonCodes, ['CONFIRMED_NO_INITIAL_PAYMENT']);
  assert.equal(evaluateCreditRealization(input()).status, 'confirmed');

  const productionFlagDrift = operation({ fiscalized: false });
  const driftResult = evaluateCreditRealization(input({
    fiscalDocuments: [{ sourceType: 'realization', documentRef: 'sale-1', operations: [productionFlagDrift] }],
    ofd: { complete: true, confirmedFiscalKeys: [creditFiscalKey(productionFlagDrift)], unlinkedExactReceipts: [] },
  }));
  assert.equal(driftResult.status, 'confirmed');
});

test('confirms historical cash and card initial-payment chains from the payment document', () => {
  for (const payment of [
    { kind: 'cash_receipt' as const, cash: 20_000, electronic: 0 },
    { kind: 'acquiring' as const, cash: 0, electronic: 20_000 },
  ]) {
    const op = operation({ cashPayment: payment.cash, electronicPayment: payment.electronic, postpayment: 80_000 });
    const result = evaluateCreditRealization(input({
      directPayments: [{ kind: payment.kind, ref: 'payment-1', number: 'P-1', date: '18.08.2026 12:02:00', posted: true, amount: 20_000, counterpartyRef: 'customer-1' }],
      fiscalDocuments: [{ sourceType: payment.kind, documentRef: 'payment-1', operations: [op] }],
      ofd: { complete: true, confirmedFiscalKeys: [creditFiscalKey(op)], unlinkedExactReceipts: [] },
    }));
    assert.equal(result.status, 'confirmed');
    assert.deepEqual(result.reasonCodes, ['CONFIRMED_WITH_INITIAL_PAYMENT']);
    assert.equal(result.expectedCreditRemainder, 80_000);
  }
});

test('uses a 15-minute grace period before a missing receipt becomes a hard mismatch', () => {
  const missing = input({ fiscalDocuments: [], ofd: { complete: true, confirmedFiscalKeys: [], unlinkedExactReceipts: [] } });
  assert.equal(evaluateCreditRealization({ ...missing, now: new Date('2026-08-18T09:14:59.000Z') }).status, 'pending');
  const hard = evaluateCreditRealization({ ...missing, now: new Date('2026-08-18T09:15:00.000Z') });
  assert.equal(hard.status, 'mismatch');
  assert.deepEqual(hard.reasonCodes, ['REQUIRED_FISCAL_RECEIPT_MISSING']);
  assert.equal(hard.employeeActionEligible, true);
});

test('keeps incomplete and legacy OFD-only absence away from employee errors', () => {
  const missing = input({ fiscalDocuments: [] });
  assert.equal(evaluateCreditRealization({ ...missing, completeness: { ...missing.completeness, complete: false } }).status, 'unavailable');
  assert.equal(evaluateCreditRealization({ ...missing, ofd: { complete: false, confirmedFiscalKeys: [], unlinkedExactReceipts: [] } }).status, 'needs_review');
  const sabyOnly = evaluateCreditRealization({
    ...missing,
    ofd: { complete: true, confirmedFiscalKeys: [], unlinkedExactReceipts: [{ datetime: '18.08.2026 12:10:00', total: 100_000, cash: 0, electronic: 0, credit: 100_000 }] },
  });
  assert.equal(sabyOnly.status, 'needs_review');
  assert.deepEqual(sabyOnly.reasonCodes, ['OFD_RECEIPT_WITHOUT_ONE_C_LINK']);
  assert.equal(sabyOnly.employeeActionEligible, false);
});

test('detects wrong source, extra receipt and initial-payment composition errors', () => {
  const payment = { kind: 'cash_receipt' as const, ref: 'payment-1', number: 'P-1', date: '18.08.2026 12:02:00', posted: true, amount: 20_000, counterpartyRef: 'customer-1' };
  const realizationOp = operation({ fiscalDocumentNumber: '999' });
  assert.deepEqual(evaluateCreditRealization(input({ directPayments: [payment] })).reasonCodes, ['FISCALIZED_FROM_WRONG_SOURCE']);

  const correct = operation({ cashPayment: 20_000, postpayment: 80_000 });
  assert.deepEqual(evaluateCreditRealization(input({
    directPayments: [payment],
    fiscalDocuments: [
      { sourceType: 'cash_receipt', documentRef: 'payment-1', operations: [correct] },
      { sourceType: 'realization', documentRef: 'sale-1', operations: [realizationOp] },
    ],
  })).reasonCodes, ['EXTRA_OR_DUPLICATE_FISCAL_RECEIPT']);

  const wrongRemainder = operation({ cashPayment: 20_000, postpayment: 100_000 });
  assert.deepEqual(evaluateCreditRealization(input({
    directPayments: [payment],
    fiscalDocuments: [{ sourceType: 'cash_receipt', documentRef: 'payment-1', operations: [wrongRemainder] }],
  })).reasonCodes, ['CREDIT_REMAINDER_MISMATCH']);
});

test('keeps returns, correction receipts, multiple payments and reversed chronology in ADMIN review', () => {
  assert.equal(evaluateCreditRealization(input({ directReturns: 1 })).status, 'needs_review');
  assert.equal(evaluateCreditRealization(input({ fiscalDocuments: [{ sourceType: 'realization', documentRef: 'sale-1', operations: [operation({ documentType: 'Кассовый чек коррекции' })] }] })).status, 'needs_review');
  assert.equal(evaluateCreditRealization(input({
    directPayments: [
      { kind: 'cash_receipt', ref: 'p1', number: 'P1', date: '18.08.2026 12:01:00', posted: true, amount: 10_000, counterpartyRef: 'customer-1' },
      { kind: 'cash_receipt', ref: 'p2', number: 'P2', date: '18.08.2026 12:02:00', posted: true, amount: 10_000, counterpartyRef: 'customer-1' },
    ],
  })).status, 'needs_review');
  assert.deepEqual(evaluateCreditRealization(input({
    fiscalDocuments: [{ sourceType: 'realization', documentRef: 'sale-1', operations: [operation({ datetime: '18.08.2026 11:20:00' })] }],
  })).reasonCodes, ['FISCAL_RECEIPT_BEFORE_SOURCE_DOCUMENT']);
});

test('treats a receipt created on the next Moscow day as a proven mismatch', () => {
  const late = operation({ datetime: '19.08.2026 00:03:00' });
  const result = evaluateCreditRealization(input({
    fiscalDocuments: [{ sourceType: 'realization', documentRef: 'sale-1', operations: [late] }],
    ofd: { complete: true, confirmedFiscalKeys: [creditFiscalKey(late)], unlinkedExactReceipts: [] },
  }));
  assert.equal(result.status, 'mismatch');
  assert.deepEqual(result.reasonCodes, ['FISCAL_RECEIPT_AFTER_SALE_DAY']);
  assert.equal(result.employeeActionEligible, false);
  assert.equal(result.receiptDelayMinutes, 723);
});

test('normalizes the production sales-realization-links fiscal-control contract', () => {
  const raw = {
    realization: {
      ref: 'sale-1', number: 'R-1', date: '18.08.2026 12:00:00', posted: true, deletion_mark: false, amount: 100_000,
      organization: { ref: 'org-1', name: 'Organization' }, partner: { ref: 'partner-1', name: 'Credit' },
      counterparty: { ref: 'customer-1', name: 'Customer' }, manager: { ref: 'manager-1', name: 'Manager' },
    },
    links: {
      cash_receipts: { direct: [{ ref: 'payment-1', number: 'P-1', date: '18.08.2026 12:02:00', posted: true, amount: 20_000, counterparty: { ref: 'customer-1', name: 'Customer' }, source_paths: ['ДокументОснование'] }], candidates: [] },
      acquiring: { direct: [], candidates: [] }, bank_receipts: { direct: [], candidates: [] },
      payment_documents: { direct: [], candidates: [] }, returns: { direct: [], candidates: [] }, corrections: { direct: [], candidates: [] },
    },
    fiscal_control: {
      source: 'ФискальныеОперации', complete: true, conflict_count: 0, errors: [], documents: [{
        source_type: 'cash_receipt', document_type: 'ПКО', document_ref: 'payment-1', link_path: 'links.cash_receipts.direct', data_state: 'confirmed',
        operations: [{ datetime: '18.08.2026 12:03:00', amount: 100_000, cash_payment: 20_000, electronic_payment: 0, prepayment: 0, postpayment: 80_000, document_type: 'Кассовый чек', fiscal_drive_number: '123', fiscal_document_number: '456', fiscal_sign: '789', fiscalized: true }],
      }],
    },
    completeness: { links_complete: true, fiscal_operations_complete: true, failed_sources: [], complete: true, absence_is_hard_error_eligible: true },
    hard_error_eligible: true,
    checked_sources: [], warnings: [],
  };
  const normalized = normalizeSalesRealizationLinksPayload(raw).links;
  assert.ok(normalized);
  assert.equal(normalized.realization?.managerRef, 'manager-1');
  assert.deepEqual(normalized.cashReceipts.direct[0].sourcePaths, ['ДокументОснование']);
  assert.equal(normalized.fiscalControl.documents[0].operations[0].fiscalDocumentNumber, '456');
  const built = buildCreditRealizationControlInput({
    links: normalized,
    now: new Date('2026-08-18T10:00:00.000Z'),
    ofd: { complete: true, confirmedFiscalKeys: ['123:456:789'], unlinkedExactReceipts: [] },
  });
  assert.equal(built && evaluateCreditRealization(built).status, 'confirmed');
});

test('replays anonymized production regressions from 2025 and 08-18 August 2026', () => {
  const cashPayment = { kind: 'cash_receipt' as const, ref: 'pko', number: 'P-1', date: '26.06.2025 10:55:23', posted: true, amount: 20_000, counterpartyRef: 'customer-1' };
  const correctCash = operation({ datetime: '26.06.2025 11:03:38', amount: 115_500, cashPayment: 20_000, postpayment: 95_500 });
  const correct2025 = evaluateCreditRealization(input({
    now: new Date('2025-06-26T09:00:00.000Z'),
    realization: { ...input().realization, number: '00OF-009183', date: '26.06.2025 10:54:24', amount: 115_500 },
    directPayments: [cashPayment],
    fiscalDocuments: [{ sourceType: 'cash_receipt', documentRef: 'pko', operations: [correctCash] }],
    ofd: { complete: true, confirmedFiscalKeys: [creditFiscalKey(correctCash)], unlinkedExactReceipts: [] },
  }));
  assert.equal(correct2025.status, 'confirmed');

  const cardCorrection = operation({ datetime: '19.06.2025 19:17:00', amount: 68_000, electronicPayment: 4_000, postpayment: 64_000, documentType: 'Кассовый чек коррекции' });
  assert.deepEqual(evaluateCreditRealization(input({
    now: new Date('2025-06-19T18:00:00.000Z'),
    realization: { ...input().realization, number: '00OF-003707', date: '07.03.2025 20:22:18', amount: 68_000 },
    directPayments: [{ kind: 'acquiring', ref: 'acquiring', number: 'A-1', date: '07.03.2025 20:25:55', posted: true, amount: 4_000, counterpartyRef: 'customer-1' }],
    fiscalDocuments: [{ sourceType: 'acquiring', documentRef: 'acquiring', operations: [cardCorrection] }],
    ofd: { complete: true, confirmedFiscalKeys: [creditFiscalKey(cardCorrection)], unlinkedExactReceipts: [] },
  })).reasonCodes, ['CORRECTION_RECEIPT_REQUIRES_ADMIN']);

  assert.deepEqual(evaluateCreditRealization(input({
    now: new Date('2025-06-07T12:00:00.000Z'),
    realization: { ...input().realization, number: '00OF-008507', date: '07.06.2025 13:25:54', amount: 59_450 },
    directPayments: [{ ...cashPayment, amount: 14_751 }],
    fiscalDocuments: [{ sourceType: 'realization', documentRef: 'sale-1', operations: [operation({ amount: 59_450, postpayment: 59_450 })] }],
  })).reasonCodes, ['FISCALIZED_FROM_WRONG_SOURCE']);

  assert.deepEqual(evaluateCreditRealization(input({
    now: new Date('2025-06-22T08:00:00.000Z'),
    realization: { ...input().realization, number: '00OF-007424', date: '13.05.2025 14:53:39', amount: 104_000 },
    directPayments: [{ ...cashPayment, amount: 39_000 }],
    fiscalDocuments: [
      { sourceType: 'realization', documentRef: 'sale-1', operations: [operation({ amount: 104_000, postpayment: 104_000, fiscalDocumentNumber: '1', documentType: 'Кассовый чек коррекции' })] },
      { sourceType: 'cash_receipt', documentRef: 'pko', operations: [operation({ amount: 39_000, cashPayment: 39_000, postpayment: 0, fiscalDocumentNumber: '2', documentType: 'Кассовый чек коррекции' })] },
    ],
  })).reasonCodes, ['CORRECTION_RECEIPT_REQUIRES_ADMIN']);

  const missingLegacy = input({
    now: new Date('2025-04-25T12:00:00.000Z'),
    realization: { ...input().realization, number: '00OF-006523', date: '24.04.2025 17:07:24', amount: 112_000 },
    directPayments: [{ ...cashPayment, date: '24.04.2025 17:09:59', amount: 12_000 }],
    fiscalDocuments: [],
    ofd: { complete: false, confirmedFiscalKeys: [], unlinkedExactReceipts: [] },
  });
  assert.equal(evaluateCreditRealization(missingLegacy).status, 'needs_review');

  const missingCurrent = input({
    now: new Date('2026-08-18T09:52:30.000Z'),
    realization: { ...input().realization, number: '00OF-009620', date: '18.08.2026 11:11:16', amount: 130_896 },
    fiscalDocuments: [],
    ofd: { complete: true, confirmedFiscalKeys: [], unlinkedExactReceipts: [] },
  });
  assert.deepEqual(evaluateCreditRealization(missingCurrent).reasonCodes, ['REQUIRED_FISCAL_RECEIPT_MISSING']);

  assert.deepEqual(evaluateCreditRealization(input({
    now: new Date('2026-08-12T12:00:00.000Z'),
    realization: { ...input().realization, number: '00OF-009216', date: '09.08.2026 16:21:43', amount: 89_470 },
    fiscalDocuments: [],
    ofd: { complete: true, confirmedFiscalKeys: [], unlinkedExactReceipts: [{ datetime: '11.08.2026 12:39:47', total: 89_470, cash: 0, electronic: 0, credit: 89_470 }] },
  })).reasonCodes, ['OFD_RECEIPT_WITHOUT_ONE_C_LINK']);

  assert.deepEqual(evaluateCreditRealization(input({
    realization: { ...input().realization, number: '00OF-009430', amount: 123_000 },
    directReturns: 1,
    fiscalDocuments: [],
  })).reasonCodes, ['DIRECT_RETURN_OR_CORRECTION']);
});
