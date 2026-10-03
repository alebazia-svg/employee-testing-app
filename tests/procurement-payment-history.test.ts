import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementPaymentHistory } from '../components/ProcurementPaymentHistory';

export const historyFixture = [
  { id: 'mems', supplierPartner: 'MEMS Technology', orderNumbers: ['00OF-000393'], plannedAmount: '280000', evidence: { issuedAmount: 280000, paidAmount: 0, paidForeignAmount: 0, actualExchangeRate: null, cashOrders: [{ ref: 'rko', number: '00OF-001692', date: '16.09.2026 18:47:57' }] } },
  { id: 'tural', supplierPartner: 'Tural', orderNumbers: ['00OF-000334'], plannedAmount: '700000', evidence: { issuedAmount: 0, paidAmount: 699997, paidForeignAmount: 7865.17, actualExchangeRate: 89, currencyPayments: [{ ref: 'usdt-rko', number: 'USDT', date: '' }] } },
];
test('small-remainder completion shows the actual payment and discrepancy in both histories',()=>{
  const plans=[{...historyFixture[0],plannedAmount:30025,evidence:{...historyFixture[0].evidence,state:'SMALL_REMAINDER_COMPLETED',issuedAmount:30000,remainingAmount:25}}];
  for(const options of [{compactBuyer:true},{showManager:true,splitView:true}]){
    const html=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans,...options}));
    assert.match(html,/Завершена без доплаты/);assert.match(html,/Недоплата: 25/);assert.match(html,/30 000/);
    assert.match(html,/не больше 500 ₽ и 1%/);assert.match(html,/Долг в 1С не изменён/);
    assert.doesNotMatch(html,/Оплачено полностью|Заявка оплачена полностью/);
  }
});
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
test('admin split history exposes the whole ordered list and complete selected comment',()=>{
 const plans=Array.from({length:5},(_,i)=>({...historyFixture[0],id:String(i),supplierPartner:'Supplier '+i,condition:'Полный комментарий\nРеквизиты без сокращений',evidence:{...historyFixture[0].evidence,cashOrders:[{number:String(i),date:(20+i)+'.09.2026 12:00:00'}]}}));
 const html=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans,splitView:true}));
 assert.ok(html.indexOf('Supplier 4')<html.indexOf('Supplier 0'));
 for(let i=0;i<5;i++) assert.ok(html.includes('Supplier '+i));
 assert.match(html,/Комментарий закупщика/);
 assert.match(html,/Реквизиты без сокращений/);
 assert.doesNotMatch(html,/Показать все|Копировать/);
 assert.doesNotMatch(html,/Запрошено:/);
});
test('completed-without-topup history retains actual paid amount and never says fully paid',()=>{
  const html=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans:[{...historyFixture[0],status:'COMPLETED_WITHOUT_TOPUP',oneCCashEvidence:{completion:{at:'2026-09-26T09:00:00Z',actorId:1,reason:'Окончательная сумма согласована',paidAmount:279999,paidForeignAmount:0,remainingAmount:1,remainingForeignAmount:null,paymentRefs:['rko']}}}]}));
  assert.match(html,/Завершена без доплаты/);assert.match(html,/279 999/);assert.match(html,/Без доплаты: 1/);
  assert.match(html,/Окончательная сумма согласована/);assert.doesNotMatch(html,/Оплачено полностью|Заявка оплачена полностью|Вернуть в активные/);
});

test('USDT history preserves the full RKO and unallocated difference in buyer and admin views',()=>{
  const plans=[{...historyFixture[1],evidence:{...historyFixture[1].evidence,paidAmount:0,actualExchangeRate:null,paidForeignAmount:2720.5,
    currencyPayments:[{ref:'rko',number:'TEST-1781',date:'29.09.2026 13:50:57',foreignAmount:2720.5,documentForeignAmount:2725.45,unallocatedForeignAmount:4.95}]}}];
  for(const splitView of [false,true]){
    const html=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans,splitView}));
    assert.match(html,/Оплачено полностью/);assert.match(html,/В заявку зачтено 2 720,5 USDT/);
    assert.match(html,/Ещё 4,95 USDT не распределено по заявкам/);assert.match(html,/Сумма расходника: 2 725,45 USDT/);
    assert.doesNotMatch(html,/Курс:|Рублёвый эквивалент:/);
  }
});

test('compact buyer history keeps discrepancy inside collapsed details without changing admin view',()=>{
  const plans=[{...historyFixture[1],evidence:{...historyFixture[1].evidence,paidForeignAmount:2720.5,
    currencyPayments:[{ref:'rko',number:'TEST-1781',date:'29.09.2026 13:50:57',foreignAmount:2720.5,documentForeignAmount:2725.45,unallocatedForeignAmount:4.95}]}}];
  const buyer=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans,splitView:true,compactBuyer:true}));
  assert.doesNotMatch(buyer,/<details open|Вне заявок:|Ещё 4,95/);
  assert.match(buyer,/<details[^>]*>[\s\S]*Сумма расходника: 2 725,45 USDT[\s\S]*Переплата по заявке: 4,95 USDT[\s\S]*<\/details>/);
  const admin=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans,splitView:true,compactBuyer:true,showManager:true}));
  assert.match(admin,/<details open/);
  assert.match(admin,/Вне заявок: 4,95 USDT/);
});

test('compact history initially shows ten payments, with access to the entire list',()=>{
  const plans=Array.from({length:15},(_,i)=>({...historyFixture[0],id:`paid-${i}`,supplierPartner:`Supplier ${i}`}));
  const html=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans,compactBuyer:true}));
  assert.equal((html.match(/<article/g)||[]).length,10);
  assert.match(html,/Показать все \(15\)/);
});

test('compact single-list history has one supplier card, search and explicit empty state',()=>{
  const html=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans:[historyFixture[0]],compactBuyer:true}));
  assert.equal((html.match(/MEMS Technology/g)||[]).length,1);
  assert.match(html,/Найти поставщика или заказ/);
  assert.doesNotMatch(html,/<details open|aria-label="Список оплат"/);
  const empty=renderToStaticMarkup(React.createElement(ProcurementPaymentHistory,{plans:[],compactBuyer:true}));
  assert.match(empty,/Подтверждённых оплат пока нет/);
});
