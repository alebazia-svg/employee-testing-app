import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementPaymentHistory } from '../components/ProcurementPaymentHistory';

export const historyFixture = [
  { id: 'mems', supplierPartner: 'MEMS Technology', orderNumbers: ['00OF-000393'], plannedAmount: '280000', evidence: { issuedAmount: 280000, paidAmount: 0, paidForeignAmount: 0, actualExchangeRate: null, cashOrders: [{ ref: 'rko', number: '00OF-001692', date: '16.09.2026 18:47:57' }] } },
  { id: 'tural', supplierPartner: 'Tural', orderNumbers: ['00OF-000334'], plannedAmount: '700000', evidence: { issuedAmount: 0, paidAmount: 699997, paidForeignAmount: 7865.17, actualExchangeRate: 89, currencyPayments: [{ ref: 'usdt-rko', number: 'USDT', date: '' }] } },
];
test('RUB and USDT history use the same visible cards; details do not hide either supplier', () => {
  const html = renderToStaticMarkup(React.createElement(ProcurementPaymentHistory, { plans: historyFixture }));
  assert.equal((html.match(/<article/g) || []).length, 2);
  assert.equal((html.match(/Оплачено полностью/g) || []).length, 2);
  assert.ok(html.includes('MEMS Technology') && html.includes('Tural'));
  assert.ok(html.includes('16 сентября'));
  assert.ok(html.includes('7 865,17 USDT'));
  assert.ok(html.includes('Подробности оплаты'));
  assert.ok(!html.includes('СОГЛАСОВАНО'));
});
test('empty history is absent; long history shows three newest initially', () => {
  assert.equal(renderToStaticMarkup(React.createElement(ProcurementPaymentHistory, { plans: [] })), '');
  const plans = Array.from({length: 4}, (_, i) => ({ ...historyFixture[0], id: String(i) }));
  const html = renderToStaticMarkup(React.createElement(ProcurementPaymentHistory, { plans }));
  assert.equal((html.match(/<article/g) || []).length, 3);
  assert.ok(html.includes('Показать все (4)'));
});
test('completed-without-topup history retains actual paid amount and never says fully paid',()=>{
  const html=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans:[{...historyFixture[0],status:'COMPLETED_WITHOUT_TOPUP',oneCCashEvidence:{completion:{at:'2026-09-26T09:00:00Z',actorId:1,reason:'Окончательная сумма согласована',paidAmount:279999,paidForeignAmount:0,remainingAmount:1,remainingForeignAmount:null,paymentRefs:['rko']}}}]}));
  assert.match(html,/Завершена без доплаты/);assert.match(html,/279 999/);assert.match(html,/Без доплаты: 1/);
  assert.match(html,/Окончательная сумма согласована/);assert.doesNotMatch(html,/Оплачено полностью|Заявка оплачена полностью|Вернуть в активные/);
});
