import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerOneCTerminalAmount, terminalFiscalOwnerMessage } from '../lib/terminal-fiscal-owner-report';

test('owner report explains open and late payments in money', () => {
  const text = terminalFiscalOwnerMessage({ day: '18.08.2026', openCount: 2, openAmountKopecks: 570100,
    resolvedLateCount: 1, resolvedLateAmountKopecks: 150000, linkedLateCount: 1, confirmed: 8, coveredByDayTotal: 0,
    itemReview: 0, pending: 0, unavailable: 0, mismatches: 0, total: 10,
    terminalCountExpected: 2, terminalCountReported: 2, sourcesComplete: true });
  assert.match(text, /без подтверждающего документа 1С: 2 на 5[\s ]701,00 ₽/);
  assert.match(text, /Автоматически закрыто напоминаний: 1 на 1[\s ]500,00 ₽/);
  assert.match(text, /Что делать:/);
});

test('owner report is calm when everything matches', () => {
  const text = terminalFiscalOwnerMessage({ day: '18.08.2026', openCount: 0, openAmountKopecks: 0,
    resolvedLateCount: 0, resolvedLateAmountKopecks: 0, linkedLateCount: 0, confirmed: 5, coveredByDayTotal: 5,
    itemReview: 1, pending: 0, unavailable: 0, mismatches: 0, total: 10,
    terminalCountExpected: 2, terminalCountReported: 2, sourcesComplete: true,
    terminals: [{ label: 'Рабочее место Миланы', aqsiKopecks: 100_000, oneCKopecks: 100_000, differenceKopecks: 0, complete: true }] });
  assert.match(text, /^✅/);
  assert.match(text, /денежного расхождения не найдено/);
  assert.match(text, /подтверждены общей суммой за день: 5/);
  assert.match(text, /состав товаров: 1/);
  assert.match(text, /Аппараты aQsi в отчёте: 2\/2/);
  assert.match(text, /Данные обоих аппаратов aQsi/);
  assert.match(text, /ничего, расхождений по чекам нет/);
  assert.match(text, /aQsi 1[\s ]000,00 ₽ · 1С 1[\s ]000,00 ₽ · разница 0,00 ₽/);
  assert.match(text, /Банковское возмещение проверяется отдельно/);
});

test('owner report stays preliminary when one active AQSI mapping is missing', () => {
  const text = terminalFiscalOwnerMessage({ day: '18.08.2026', openCount: 0, openAmountKopecks: 0,
    resolvedLateCount: 0, resolvedLateAmountKopecks: 0, linkedLateCount: 0, confirmed: 5, coveredByDayTotal: 0,
    itemReview: 0, pending: 0, unavailable: 0, mismatches: 0, total: 5,
    terminalCountExpected: 2, terminalCountReported: 1, sourcesComplete: false });
  assert.match(text, /^⚠️/);
  assert.match(text, /Аппараты aQsi в отчёте: 1\/2/);
  assert.match(text, /итог предварительный/);
  assert.match(text, /восстановить данные отсутствующего аппарата/);
  assert.doesNotMatch(text, /Что делать: ничего/);
});

test('owner report treats a per-terminal money difference as a financial problem', () => {
  const text = terminalFiscalOwnerMessage({ day: '14.10.2026', openCount: 0, openAmountKopecks: 0,
    resolvedLateCount: 0, resolvedLateAmountKopecks: 0, linkedLateCount: 0, confirmed: 10, coveredByDayTotal: 0,
    itemReview: 0, pending: 0, unavailable: 0, mismatches: 0, total: 10,
    terminalCountExpected: 2, terminalCountReported: 2, sourcesComplete: true,
    terminals: [{ label: 'Первый аппарат', aqsiKopecks: 475_000, oneCKopecks: 2_465_000, differenceKopecks: -1_990_000, complete: true }] });
  assert.match(text, /^⚠️/);
  assert.match(text, /расхождение сумм aQsi ↔ 1С: 1/);
  assert.doesNotMatch(text, /Что делать: ничего/);
});

test('shared 1C acquiring terminal attributes acquiring document only to its matched AQSI mapping', () => {
  const evidence = [{
    sourceType: 'acquiring_operation', sourceRef: 'acquiring-operation:81', cashRegisterRef: '', operationType: 'sale',
    dateTime: '2026-10-14T14:41:41.000Z',
    cardPayments: [{ amountKopecks: 1_990_000, acquiringTerminalRef: 'shared-terminal' }],
  }];
  const common = { evidence, cashRegisterRef: 'cash-register-1', acquiringTerminalRef: 'shared-terminal',
    periodFrom: new Date('2026-10-13T21:00:00.000Z'), periodTo: new Date('2026-10-14T21:00:00.000Z') };
  assert.equal(ownerOneCTerminalAmount({ ...common, matchedAcquiringSourceRefs: new Set() }), 0);
  assert.equal(ownerOneCTerminalAmount({ ...common, matchedAcquiringSourceRefs: new Set(['acquiring-operation:81']) }), 1_990_000);
});
