import assert from 'node:assert/strict';
import test from 'node:test';
import {
  matchingActionPolicy,
  MATCHING_REASON_CODE_CONTRACT,
  reconcileTerminalFiscalMvp,
  canonicalFiscalKey,
  type BankOperation,
  type OneCCheck,
  type OfdReceipt,
  type TerminalFiscalMatchingInput,
} from '../lib/terminal-fiscal-matching';

const bank: BankOperation = {
  terminalKey: 'terminal-1', rrn: 'bank-rrn-only', transactionDate: '2026-08-10T07:00:00.000Z', amountKopecks: 140000, type: 'Debit',
};
const check: OneCCheck = {
  sourceRef: 'check-1', sourceType: 'sale_check', operationType: 'sale', dateTime: '2026-08-10T07:02:00.000Z',
  cashRegisterRef: 'cash-1', kktRegistrationNumber: 'kkt-1', totalKopecks: 140000, electronicKopecks: 140000,
  cashier: { ref: 'cashier-zukhra', name: 'Абшаева Зухра' },
  cardPayments: [{ lineNumber: '1', amountKopecks: 140000, acquiringTerminalRef: 'acq-1', referenceNumber: 'not-an-rrn', authorizationCode: 'auth', terminalReceiptNumber: 'receipt' }],
  items: [{ name: 'Чехол', quantity: 1, priceKopecks: 140000, sumKopecks: 140000 }],
  fiscalState: 'confirmed', fiscalStateMeaning: 'data_state_only', fiscalDriveNumber: 'fn', fiscalDocumentNumber: 'fd', fiscalSign: 'fp',
};
const receipt: OfdReceipt = {
  fiscalDriveNumber: 'fn', fiscalDocumentNumber: 'fd', fiscalSign: 'fp', operationType: 1, receiptAt: '2026-08-10T07:02:05.000Z', kktRegistrationNumber: 'kkt-1',
  totalKopecks: 140000, electronicKopecks: 140000,
  items: [{ name: ' чехол ', quantity: 1, priceKopecks: 140000, sumKopecks: 140000 }],
};

function input(overrides: Partial<TerminalFiscalMatchingInput> = {}): TerminalFiscalMatchingInput {
  return {
    now: '2026-08-10T09:30:01.000Z',
    sources: {
      tbank: { complete: true, checkedAt: '2026-08-10T09:30:00.000Z' },
      oneC: { complete: true, checkedAt: '2026-08-10T09:30:00.000Z' },
      ofd: { complete: true, checkedAt: '2026-08-10T09:30:00.000Z' },
    },
    mappings: [{ id: 'map-1', terminalKey: 'terminal-1', oneCAcquiringTerminalRef: 'acq-1', oneCCashRegisterRef: 'cash-1', kktRegistrationNumber: 'kkt-1', activeFrom: '2026-08-01T00:00:00.000Z' }],
    bankOperations: [bank], oneCChecks: [check], ofdReceipts: [receipt], ...overrides,
  };
}

function only(overrides: Partial<TerminalFiscalMatchingInput> = {}) {
  const result = reconcileTerminalFiscalMvp(input(overrides));
  assert.equal(result.records.length, 1);
  return result.records[0];
}

test('confirms a unique sale and does not treat referenceNumber as RRN', () => {
  const result = only();
  assert.equal(result.status, 'confirmed');
  assert.equal(result.reasonCode, 'MATCH_CONFIRMED');
  assert.equal(result.timeDifferenceSeconds, 120);
  assert.equal(result.bankOperationKey.includes('not-an-rrn'), false);
  assert.equal(result.oneCCashierRef, 'cashier-zukhra');
  assert.equal(result.oneCCashierName, 'Абшаева Зухра');
});

test('carries the 1C cashier and ignores an OFD operator identity', () => {
  const milanaCheck = { ...check, cashier: { ref: 'cashier-milana', name: 'Чеченова Милана' } };
  const receiptWithDifferentOperator = { ...receipt, operator: 'Абшаева Зухра' } as OfdReceipt & { operator: string };
  const result = only({ oneCChecks: [milanaCheck], ofdReceipts: [receiptWithDifferentOperator] });
  assert.equal(result.status, 'confirmed');
  assert.equal(result.oneCCashierRef, 'cashier-milana');
  assert.equal(result.oneCCashierName, 'Чеченова Милана');
  assert.equal('ofdOperator' in result, false);
});

test('confirms a refund only against refund documents and OFD operation type 2', () => {
  const refundBank = { ...bank, rrn: 'refund', type: 'Credit' as const };
  const refundCheck = { ...check, sourceRef: 'refund-1', sourceType: 'refund_check' as const, operationType: 'refund' as const };
  const result = only({ bankOperations: [refundBank], oneCChecks: [refundCheck], ofdReceipts: [{ ...receipt, operationType: 2 }] });
  assert.equal(result.status, 'confirmed');
  assert.equal(result.operationType, 'refund');
});

test('keeps a missing 1C candidate pending inside grace and review-only afterwards', () => {
  assert.deepEqual([only({ now: '2026-08-10T07:30:00.000Z', oneCChecks: [] }).status, only({ oneCChecks: [] }).status], ['pending', 'needs_review']);
});

test('does not call missing fiscal data a violation', () => {
  const unconfirmed = { ...check, fiscalState: 'unconfirmed' as const, fiscalDriveNumber: undefined, fiscalDocumentNumber: undefined, fiscalSign: undefined };
  const result = only({ oneCChecks: [unconfirmed] });
  assert.equal(result.status, 'needs_review');
  assert.equal(result.reasonCode, 'FISCAL_DATA_UNCONFIRMED');
});

test('keeps a missing OFD receipt pending then review-only', () => {
  assert.equal(only({ now: '2026-08-10T07:30:00.000Z', ofdReceipts: [] }).reasonCode, 'OFD_RECEIPT_PENDING');
  assert.equal(only({ ofdReceipts: [] }).reasonCode, 'OFD_RECEIPT_NOT_FOUND');
});

test('reports hard mismatches only after exact fiscal-key matching', () => {
  assert.equal(only({ ofdReceipts: [{ ...receipt, electronicKopecks: 139900 }] }).reasonCode, 'OFD_ELECTRONIC_AMOUNT_MISMATCH');
  assert.equal(only({ ofdReceipts: [{ ...receipt, totalKopecks: 139900 }] }).reasonCode, 'OFD_TOTAL_AMOUNT_MISMATCH');
  assert.equal(only({ ofdReceipts: [{ ...receipt, operationType: 2 }] }).reasonCode, 'OFD_OPERATION_TYPE_MISMATCH');
  assert.equal(only({ ofdReceipts: [{ ...receipt, kktRegistrationNumber: 'other' }] }).reasonCode, 'OFD_KKT_MISMATCH');
});

test('does not expose a hard mismatch before grace expires', () => {
  const result = only({ now: '2026-08-10T07:30:00.000Z', ofdReceipts: [{ ...receipt, electronicKopecks: 139900 }] });
  assert.equal(result.status, 'pending');
  assert.equal(result.reasonCode, 'OFD_ELECTRONIC_AMOUNT_MISMATCH');
});

test('uses items only as a review signal after exact fiscal matching', () => {
  const result = only({ ofdReceipts: [{ ...receipt, items: [{ ...receipt.items[0], name: 'Стекло' }] }] });
  assert.equal(result.status, 'needs_review');
  assert.equal(result.reasonCode, 'OFD_ITEMS_MISMATCH');
  assert.equal(result.ofdReceiptKey, canonicalFiscalKey(receipt));
});

test('does not choose between multiple 1C candidates', () => {
  const result = only({ oneCChecks: [check, { ...check, sourceRef: 'check-2', dateTime: '2026-08-10T07:03:00.000Z' }] });
  assert.equal(result.status, 'needs_review');
  assert.equal(result.reasonCode, 'ONE_C_MULTIPLE_CANDIDATES');
  assert.equal(result.candidateCount, 2);
});

test('prevents reuse of one 1C check by two bank operations', () => {
  const result = reconcileTerminalFiscalMvp(input({ bankOperations: [bank, { ...bank, rrn: 'second', transactionDate: '2026-08-10T07:01:00.000Z' }] }));
  assert.equal(result.records.length, 2);
  assert.ok(result.records.every((record) => record.reasonCode === 'ONE_C_CHECK_REUSED'));
});

test('detects duplicate bank operations without consuming a check', () => {
  const result = reconcileTerminalFiscalMvp(input({ bankOperations: [bank, { ...bank }] }));
  assert.ok(result.records.every((record) => record.reasonCode === 'BANK_OPERATION_DUPLICATE'));
});

test('excludes multiple card payments, credits and corrections from MVP', () => {
  const multi = { ...check, cardPayments: [...check.cardPayments, { ...check.cardPayments[0], lineNumber: '2' }] };
  const multiResult = only({ now: '2026-08-10T07:30:00.000Z', oneCChecks: [multi] });
  assert.equal(multiResult.status, 'needs_review');
  assert.equal(multiResult.reasonCode, 'ONE_C_MULTIPLE_CARD_PAYMENTS');
  assert.equal(only({ oneCChecks: [{ ...check, sourceType: 'credit_realization' }] }).reasonCode, 'ONE_C_UNSUPPORTED_DOCUMENT');
  assert.equal(only({ oneCChecks: [{ ...check, sourceType: 'correction', operationType: 'correction' }] }).reasonCode, 'ONE_C_UNSUPPORTED_DOCUMENT');
});

test('does not let an unrelated multi-card check affect another operation', () => {
  const unrelated = {
    ...check,
    sourceRef: 'unrelated',
    cashRegisterRef: 'other-cash',
    cardPayments: [...check.cardPayments, { ...check.cardPayments[0], lineNumber: '2' }],
  };
  assert.equal(only({ oneCChecks: [unrelated] }).reasonCode, 'ONE_C_CANDIDATE_NOT_FOUND');
});

test('marks incomplete sources and mapping failures unavailable', () => {
  const sourceResult = only({ sources: { ...input().sources, ofd: { complete: false, checkedAt: input().now, error: 'limit' } } });
  assert.equal(sourceResult.status, 'unavailable');
  assert.equal(sourceResult.reasonCode, 'SOURCE_OFD_INCOMPLETE');
  assert.equal(only({ mappings: [] }).reasonCode, 'TERMINAL_MAPPING_MISSING');
  assert.equal(only({ mappings: [...input().mappings, { ...input().mappings[0], id: 'map-2' }] }).reasonCode, 'TERMINAL_MAPPING_CONFLICT');
});

test('classifies every incomplete source independently', () => {
  assert.equal(only({ sources: { ...input().sources, tbank: { complete: false, checkedAt: input().now } } }).reasonCode, 'SOURCE_TBANK_INCOMPLETE');
  assert.equal(only({ sources: { ...input().sources, oneC: { complete: false, checkedAt: input().now } } }).reasonCode, 'SOURCE_ONE_C_INCOMPLETE');
  assert.equal(only({ sources: { ...input().sources, ofd: { complete: false, checkedAt: input().now } } }).reasonCode, 'SOURCE_OFD_INCOMPLETE');
});

test('supports the exact grace boundary and invalid bank inputs safely', () => {
  assert.equal(only({ now: '2026-08-10T09:00:00.000Z', oneCChecks: [] }).status, 'needs_review');
  assert.equal(only({ bankOperations: [{ ...bank, type: 'Other' }] }).reasonCode, 'BANK_OPERATION_UNSUPPORTED');
  assert.equal(only({ bankOperations: [{ ...bank, amountKopecks: 0 }] }).reasonCode, 'BANK_OPERATION_INVALID');
  assert.equal(only({ bankOperations: [{ ...bank, transactionDate: 'invalid' }] }).reasonCode, 'BANK_OPERATION_INVALID');
});

test('does not match outside five minutes or by amount alone', () => {
  const late = { ...check, dateTime: '2026-08-10T07:05:01.000Z' };
  assert.equal(only({ oneCChecks: [late] }).reasonCode, 'ONE_C_CANDIDATE_NOT_FOUND');
  const wrongTerminal = { ...check, cardPayments: [{ ...check.cardPayments[0], acquiringTerminalRef: 'other' }] };
  assert.equal(only({ oneCChecks: [wrongTerminal] }).reasonCode, 'ONE_C_CANDIDATE_NOT_FOUND');
});

test('requires an exact fiscal key and flags duplicate/conflicting fiscal evidence', () => {
  assert.equal(only({ oneCChecks: [{ ...check, fiscalConflict: true }] }).reasonCode, 'FISCAL_KEY_CONFLICT');
  assert.equal(only({ ofdReceipts: [receipt, { ...receipt }] }).reasonCode, 'OFD_RECEIPT_DUPLICATE');
});

test('builds fiscal identity from normalized components rather than provider keys', () => {
  const result = only({
    oneCChecks: [{ ...check, fiscalDriveNumber: ' fn ', fiscalDocumentNumber: 'fd', fiscalSign: 'fp' }],
    ofdReceipts: [{ ...receipt, fiscalDriveNumber: 'fn', fiscalDocumentNumber: ' fd ', fiscalSign: 'fp' }],
  });
  assert.equal(result.status, 'confirmed');
  assert.equal(canonicalFiscalKey({ fiscalDriveNumber: 'fn', fiscalDocumentNumber: '', fiscalSign: 'fp' }), null);
  assert.equal(
    canonicalFiscalKey({ fiscalDriveNumber: 'fn', fiscalDocumentNumber: 'fd', fiscalSign: '000123' }),
    canonicalFiscalKey({ fiscalDriveNumber: 'fn', fiscalDocumentNumber: 'fd', fiscalSign: '123' }),
  );
  assert.notEqual(
    canonicalFiscalKey({ fiscalDriveNumber: '001', fiscalDocumentNumber: 'fd', fiscalSign: '123' }),
    canonicalFiscalKey({ fiscalDriveNumber: '1', fiscalDocumentNumber: 'fd', fiscalSign: '123' }),
  );
  assert.notEqual(
    canonicalFiscalKey({ fiscalDriveNumber: 'fn', fiscalDocumentNumber: '001', fiscalSign: '123' }),
    canonicalFiscalKey({ fiscalDriveNumber: 'fn', fiscalDocumentNumber: '1', fiscalSign: '123' }),
  );
  assert.notEqual(
    canonicalFiscalKey({ fiscalDriveNumber: 'fn', fiscalDocumentNumber: 'fd', fiscalSign: '00ABC' }),
    canonicalFiscalKey({ fiscalDriveNumber: 'fn', fiscalDocumentNumber: 'fd', fiscalSign: 'ABC' }),
  );
});

test('normalizes only safe typography and yo/e in item names', () => {
  const typographic = {
    ...receipt,
    items: [{ ...receipt.items[0], name: ' ЧЁХОЛ — ТЕСТ ' }],
  };
  const oneCWithTypography = {
    ...check,
    items: [{ ...check.items[0], name: 'чехол - тест' }],
  };
  assert.equal(only({ oneCChecks: [oneCWithTypography], ofdReceipts: [typographic] }).status, 'confirmed');
});

test('accepts only deterministic nonnumeric OFD name extensions with exact line values', () => {
  const oneCItems = [
    { name: 'Модель 15 Pro', quantity: 1, priceKopecks: 100, sumKopecks: 100 },
    { name: 'Чехол синий', quantity: 2, priceKopecks: 50, sumKopecks: 100 },
  ];
  const safeOfdItems = [
    { name: 'Фирменный Модель 15 Pro новый', quantity: 1, priceKopecks: 100, sumKopecks: 100 },
    { name: 'Чехол защитный синий', quantity: 2, priceKopecks: 50, sumKopecks: 100 },
  ];
  assert.equal(only({ oneCChecks: [{ ...check, items: oneCItems }], ofdReceipts: [{ ...receipt, items: safeOfdItems }] }).status, 'confirmed');

  const unsafeNames = [
    [{ ...safeOfdItems[0], name: 'Фирменный Модель 16 Pro новый' }, safeOfdItems[1]],
    [{ ...safeOfdItems[0], name: 'Pro Модель 15 новый' }, safeOfdItems[1]],
    [{ ...safeOfdItems[0], name: 'Фирменный устройство 15 Pro' }, safeOfdItems[1]],
  ];
  for (const items of unsafeNames) {
    assert.equal(only({ oneCChecks: [{ ...check, items: oneCItems }], ofdReceipts: [{ ...receipt, items }] }).reasonCode, 'OFD_ITEMS_MISMATCH');
  }
  assert.equal(only({
    oneCChecks: [{ ...check, items: oneCItems }],
    ofdReceipts: [{ ...receipt, items: [{ ...safeOfdItems[0], sumKopecks: 101 }, safeOfdItems[1]] }],
  }).reasonCode, 'OFD_ITEMS_MISMATCH');
});

test('appends history only when status or reason changes', () => {
  const pending = reconcileTerminalFiscalMvp(input({ now: '2026-08-10T07:30:00.000Z', oneCChecks: [] })).records[0];
  const unchanged = reconcileTerminalFiscalMvp(input({ now: '2026-08-10T07:40:00.000Z', oneCChecks: [], previous: [pending] })).records[0];
  assert.equal(unchanged.history.length, 1);
  const confirmed = reconcileTerminalFiscalMvp(input({ previous: [unchanged] })).records[0];
  assert.deepEqual(confirmed.history.map((entry) => entry.status), ['pending', 'confirmed']);
});

test('never exposes uncertain or technical states to an employee', () => {
  for (const status of ['pending', 'unavailable', 'needs_review'] as const) {
    const policy = matchingActionPolicy({ status, reasonCode: 'ONE_C_CANDIDATE_PENDING' });
    assert.equal(policy.employeeVisible, false);
  }
  assert.equal(matchingActionPolicy({ status: 'mismatch', reasonCode: 'OFD_ELECTRONIC_AMOUNT_MISMATCH' }).employeeVisible, true);
  assert.equal(matchingActionPolicy({ status: 'confirmed', reasonCode: 'MATCH_CONFIRMED' }).automaticAction, 'close_incident');
});

test('reasonCode contract is exhaustive and permits every emitted status', () => {
  assert.equal(Object.keys(MATCHING_REASON_CODE_CONTRACT).length, 26);
  const scenarios = [
    only(),
    only({ oneCChecks: [] }),
    only({ sources: { ...input().sources, ofd: { complete: false, checkedAt: input().now } } }),
    only({ ofdReceipts: [{ ...receipt, electronicKopecks: 1 }] }),
    only({ ofdReceipts: [{ ...receipt, items: [{ ...receipt.items[0], name: 'другой товар' }] }] }),
  ];
  for (const record of scenarios) {
    assert.ok(MATCHING_REASON_CODE_CONTRACT[record.reasonCode].allowedStatuses.includes(record.status as never));
  }
  for (const contract of Object.values(MATCHING_REASON_CODE_CONTRACT)) {
    if (!contract.allowedStatuses.includes('mismatch' as never)) assert.equal(contract.employeeVisible, false);
  }
});
