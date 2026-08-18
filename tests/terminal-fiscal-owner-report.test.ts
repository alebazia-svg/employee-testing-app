import assert from 'node:assert/strict';
import test from 'node:test';
import { terminalFiscalOwnerMessage } from '../lib/terminal-fiscal-owner-report';

test('owner report explains open and late payments in money', () => {
  const text = terminalFiscalOwnerMessage({ day: '18.08.2026', openCount: 2, openAmountKopecks: 570100,
    resolvedLateCount: 1, resolvedLateAmountKopecks: 150000, confirmed: 8, coveredByDayTotal: 0,
    itemReview: 0, pending: 0, unavailable: 0, mismatches: 0, total: 10, sourcesComplete: true });
  assert.match(text, /без подтверждённого чека 1С: 2 на 5[\s ]701,00 ₽/);
  assert.match(text, /Пробито с опозданием: 1 на 1[\s ]500,00 ₽/);
  assert.match(text, /Что делать:/);
});

test('owner report is calm when everything matches', () => {
  const text = terminalFiscalOwnerMessage({ day: '18.08.2026', openCount: 0, openAmountKopecks: 0,
    resolvedLateCount: 0, resolvedLateAmountKopecks: 0, confirmed: 5, coveredByDayTotal: 5,
    itemReview: 1, pending: 0, unavailable: 0, mismatches: 0, total: 10, sourcesComplete: true });
  assert.match(text, /^✅/);
  assert.match(text, /денежного расхождения не найдено/);
  assert.match(text, /подтверждены общей суммой за день: 5/);
  assert.match(text, /состав товаров: 1/);
  assert.match(text, /ничего, расхождений по чекам нет/);
});
