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
  assert.match(result.detail, /подтверждено 4 из 4/);
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

test('ADMIN Workday terminal summary has a neutral no-run state', () => {
  const result = presentTerminalFiscalWorkdaySummary(null);
  assert.match(result.detail, /сверка ещё не запускалась/);
  assert.equal(result.label, 'Нет данных');
});
