import assert from 'node:assert/strict';
import test from 'node:test';
import { handoverCashResult as cash, handoverEncashmentResult as encash, missingHandoverPhotos } from '../lib/workday-handover-view';

test('cash keeps zero distinct from a missing amount and from an unavailable 1C snapshot', () => {
  assert.equal(cash(null).label, 'Сумма не введена');
  assert.equal(cash(0, { status: 'matched', expected: 0 }).label, 'Совпадает');
  assert.equal(cash(4915, { status: 'unavailable', expected: null }).tone, 'amber');
  assert.equal(cash(4915, { status: 'matched', expected: null }).label, 'Нет данных 1С');
});
test('cash shortage and surplus use signed differences and manual decisions remain explicit', () => {
  assert.deepEqual(cash(4500, { status: 'mismatch', expected: 4915 }), { label: 'Недостача', tone: 'error', difference: 415 });
  assert.equal(cash(5000, { status: 'mismatch', expected: 4915 }).label, 'Излишек');
  assert.equal(cash(4915, { status: 'waiting', expected: 4915 }).label, 'Ожидается сверка');
  assert.equal(cash(4915, { status: 'matched', expected: 4915, manualReview: { decision: 'confirmed_issue' } }).tone, 'error');
  assert.equal(cash(4915, { status: 'unavailable', manualReview: { decision: 'confirmed_ok' } }).label, 'Подтверждено вручную');
});
test('an employee denial does not conceal contradictory or missing 1C data', () => {
  assert.equal(encash({ requiresEncashment: false }, { status: 'matched' }).label, 'Не было');
  assert.equal(encash({ requiresEncashment: false }, { status: 'mismatch' }).tone, 'error');
  assert.equal(encash({ requiresEncashment: false }, { status: 'unavailable' }).label, 'Не было · нет сверки 1С');
  assert.equal(encash({}).label, 'Не указано');
});
test('approval without encashment is an exception, never a posted transaction', () => {
  const data = { requiresEncashment: true, encashmentExceptionRequestId: 'approved', encashmentAmount: null };
  assert.equal(encash(data, { status: 'matched' }).label, 'Без инкассации · разрешено');
  assert.equal(encash(data, { status: 'waiting' }).label, 'Сумма не указана');
  assert.equal(encash({ ...data, encashmentAmount: 5000 }, { status: 'matched' }).label, 'Подтверждено в 1С');
});
test('posting errors, retry and manual processing remain distinct from confirmation', () => {
  const data = { requiresEncashment: true, encashmentAmount: 5000 };
  for (const [status, label] of [['one_c_error', 'Ошибка проведения'], ['retrying_1c', 'Повторное проведение'], ['manual_in_progress', 'Проводит администратор']]) {
    assert.equal(encash(data, { status: 'unavailable', cashOperation: { status } }).label, label);
  }
  assert.equal(encash(data, { status: 'mismatch' }).label, 'Не подтверждено в 1С');
  assert.equal(encash(data, { status: 'matched' }).label, 'Подтверждено в 1С');
  assert.equal(encash(data, { status: 'matched', manualReview: { decision: 'confirmed_issue' } }).tone, 'error');
});
test('only required proofs are missing; optional statements and approved exceptions are not demands', () => {
  assert.deepEqual(missingHandoverPhotos({ personalCash: { requiresEncashment: false } }), []);
  assert.deepEqual(missingHandoverPhotos({ personalCash: { requiresEncashment: true, encashmentAmount: null, encashmentExceptionRequestId: 'approved' } }), []);
  assert.deepEqual(missingHandoverPhotos({ personalCash: { requiresEncashment: true, encashmentAmount: 5000 }, storeClosing: { zReportRequired: true } }), ['Фото инкассации', 'Чек закрытия']);
  assert.deepEqual(missingHandoverPhotos({ storeClosing: { zReportRequired: false }, photos: { encashmentDocument: { storagePath: 'uploads/test.png' } }, personalCash: { requiresEncashment: true, encashmentAmount: 5000 } }), []);
});

test('approved omission is neutral, including server-completed draft facts', () => {
  assert.deepEqual(encash({encashmentExceptionRequestId:'approved',encashmentAmount:null}, {status:'matched'}),{label:'Без инкассации · разрешено',tone:'neutral'});
});
