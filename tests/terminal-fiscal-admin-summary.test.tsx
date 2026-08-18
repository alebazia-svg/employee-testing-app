import assert from 'node:assert/strict';
import test from 'node:test';
import { presentTerminalFiscalWorkdaySummary, type TerminalFiscalWorkdaySummary } from '../lib/terminal-fiscal-summary';

const base: TerminalFiscalWorkdaySummary = {
  runs: 1,
  attempts: 2,
  total: 4,
  statuses: { confirmed: 4, pending: 0, mismatch: 0, unavailable: 0, needs_review: 0 },
  reasonCodes: { MATCH_CONFIRMED: 4 },
  ambiguities: 0,
  completeness: { tbank: true, oneC: true, ofd: true },
  lastCompletedAt: new Date('2026-08-09T18:00:00.000Z'),
};

test('ADMIN Workday terminal summary shows only the aggregate confirmed result', () => {
  const result = presentTerminalFiscalWorkdaySummary(base);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.label, 'Всё подтверждено');
  assert.match(result.detail, /точно сопоставлено 4 из 4/);
  assert.doesNotMatch(result.detail, /matchingId|fiscalDrive|terminalKey|номер карты/i);
});

test('ADMIN Workday terminal summary prioritizes review and unavailable states safely', () => {
  const review = presentTerminalFiscalWorkdaySummary({
    ...base,
    statuses: { confirmed: 2, pending: 0, mismatch: 0, unavailable: 0, needs_review: 2 },
  });
  assert.equal(review.label, 'Требует проверки');
  assert.match(review.detail, /проверить 2/);

  const unavailable = presentTerminalFiscalWorkdaySummary({
    ...base,
    completeness: { tbank: true, oneC: false, ofd: true },
  });
  assert.equal(unavailable.label, 'Источник недоступен');
});

test('ADMIN sees item review separately while the financial match remains confirmed', () => {
  const result = presentTerminalFiscalWorkdaySummary({
    ...base,
    statuses: { confirmed: 4, pending: 0, mismatch: 0, unavailable: 0, needs_review: 0 },
    reasonCodes: { MATCH_CONFIRMED: 3, OFD_ITEM_PRESENTATION_DIFFERENCE: 1 },
  });
  assert.equal(result.status, 'needs_review');
  assert.equal(result.label, 'Проверить состав чека');
  assert.match(result.detail, /точно сопоставлено 4 из 4/);
  assert.match(result.detail, /состав проверить 1/);
  assert.doesNotMatch(result.detail, /оплат без чека/);
});

test('ADMIN Workday terminal summary has a neutral no-run state', () => {
  const result = presentTerminalFiscalWorkdaySummary(null);
  assert.match(result.detail, /сверка ещё не запускалась/);
  assert.equal(result.label, 'Нет данных');
});

test('ADMIN Workday treats a bank operation without a 1C check as an admin-only acquiring problem', () => {
  const result = presentTerminalFiscalWorkdaySummary({
    ...base,
    statuses: { confirmed: 3, pending: 0, mismatch: 0, unavailable: 0, needs_review: 1 },
    reasonCodes: { MATCH_CONFIRMED: 3, ONE_C_CANDIDATE_NOT_FOUND: 1 },
  });
  assert.equal(result.status, 'mismatch');
  assert.equal(result.label, 'Есть проблема эквайринга');
  assert.match(result.detail, /оплат без покрытия чеком 1С 1/);
});

test('ADMIN separates period-covered operations from genuinely uncovered payments', () => {
  const result = presentTerminalFiscalWorkdaySummary({
    ...base,
    total: 10,
    statuses: { confirmed: 5, pending: 0, mismatch: 0, unavailable: 0, needs_review: 5 },
    reasonCodes: { MATCH_CONFIRMED: 5, ONE_C_CANDIDATE_NOT_FOUND: 5 },
    attributionRecords: Array.from({ length: 5 }, () => ({
      status: 'needs_review' as const,
      reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND' as const,
      candidateCount: 0,
      bankOperationAt: new Date('2026-08-18T10:00:00.000Z'),
      oneCCashierRef: 'cashier-zukhra',
    })),
  });
  assert.equal(result.status, 'confirmed');
  assert.equal(result.label, 'Всё подтверждено');
  assert.match(result.detail, /точно сопоставлено 5 из 10/);
  assert.match(result.detail, /покрыто общей сверкой 5/);
  assert.doesNotMatch(result.detail, /без покрытия/);
  assert.doesNotMatch(result.detail, /проверить 5/);
});

test('today production shape shows coverage and content review without a missing-check claim', () => {
  const result = presentTerminalFiscalWorkdaySummary({
    ...base,
    total: 10,
    statuses: { confirmed: 5, pending: 0, mismatch: 0, unavailable: 0, needs_review: 5 },
    reasonCodes: {
      MATCH_CONFIRMED: 4,
      OFD_ITEM_PRESENTATION_DIFFERENCE: 1,
      ONE_C_CANDIDATE_NOT_FOUND: 5,
    },
    attributionRecords: Array.from({ length: 5 }, () => ({
      status: 'needs_review' as const,
      reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND' as const,
      candidateCount: 0,
      bankOperationAt: new Date('2026-08-18T10:00:00.000Z'),
      oneCCashierRef: 'cashier-zukhra',
    })),
  });
  assert.equal(result.status, 'needs_review');
  assert.equal(result.label, 'Проверить состав чека');
  assert.match(result.detail, /точно сопоставлено 5 из 10/);
  assert.match(result.detail, /покрыто общей сверкой 5/);
  assert.match(result.detail, /состав проверить 1/);
  assert.doesNotMatch(result.detail, /без покрытия/);
});
