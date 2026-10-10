import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementPaymentForm} from '../app/(dashboard)/procurement/ProcurementPaymentForm';

type Props=React.ComponentProps<typeof ProcurementPaymentForm>;
const order:Props['orders'][number]={ref:'one',number:'445',amount:47000,date:'2026-10-08',supplierPartner:'П37',supplierCounterparty:'c',orderPaymentGap:0,supplierDebt:20000,plannedActiveAmount:0,unplannedAmount:20000,orderComment:'Мегапрайс - помощник закупок.'};
const render=(orders:Props['orders'])=>renderToStaticMarkup(React.createElement(ProcurementPaymentForm,{
  orders,initialSelectedRefs:orders.map(o=>o.ref),supplierBalances:{'П37':{debt:20000,advance:0,closingBalance:20000,reviewRequired:false}},
  onCreated:()=>{},onCancel:()=>{},todayKey:'2026-10-10',basisPreview:true,
}));

test('service-only comments do not create an empty documents disclosure',()=>{
  const html=render([order,{...order,ref:'two',number:'440'}]);
  assert.ok(!html.includes('Мегапрайс'));
  assert.ok(!html.includes('Документы и комментарии'));
  assert.ok(html.includes('Сумма, ₽'));
  assert.ok(!html.includes('Добавить заказ'));
  assert.ok(html.includes('08.10.2026'));
  assert.ok(!html.includes('не рассчитан'));
  const visible=html.replace(/<[^>]*>/g,'');
  assert.equal(visible.split('445').length-1,1);
  assert.equal(visible.split('440').length-1,0);
});
test('useful supplier comment is retained and single payment keeps simple amount label',()=>{
  const html=render([{...order,orderComment:'Мегапрайс — помощник закупок\nОтгрузка после оплаты'}]);
  assert.ok(html.includes('Отгрузка после оплаты'));
  assert.ok(html.includes('Документы и комментарии'));
  assert.ok(!html.includes('Мегапрайс'));
  assert.ok(!html.includes('Общая сумма оплаты'));
});
test('real acquisition remains available even without a useful comment',()=>{
  const receipt={ref:'receipt',number:'801',amountRub:47000,remainingRub:5000};
  const html=render([{...order,receiptSettlement:{checkedAt:'2026-10-10',debtRub:5000,requiresAdvanceReview:false,receipts:[receipt],supplier:{ref:'s',grossDebtRub:20000,creditsRub:0,netOwedRub:20000}}}]);
  assert.ok(html.includes('Документы и комментарии'));
  assert.ok(html.includes('Приобретение №801'));
  assert.ok(html.includes('Долг по приобретениям'));
});
test('verified acquisition and RKO proof is retained without settlement snapshot',()=>{
  const html=render([{...order,paymentClosure:{state:'small_balance',remainingRub:100,checkedAt:'2026-10-10',receipts:[{ref:'r1',number:'801',amountRub:47000,remainingRub:100,payments:[{ref:'p1',number:'902',date:'2026-10-09',amount:46900,currency:'RUB',appliedRub:46900}]}]}}]);
  assert.ok(html.includes('Приобретение №801'));
  assert.ok(html.includes('РКО №902'));
  assert.ok(html.includes('На это приобретение'));
});
test('active orders cannot be selected again',()=>{
  const html=renderToStaticMarkup(React.createElement(ProcurementPaymentForm,{orders:[order],initialSelectedRefs:['one'],activeOrderRefs:['one'],supplierBalances:{},onCreated:()=>{},onCancel:()=>{},basisPreview:true}));
  assert.ok(!html.includes('Выбранная оплата'));
  assert.ok(html.includes('disabled=""'));
});
test('1C formatted order date is not interpreted as a US month-first date',()=>{
  const html=render([{...order,date:'08.10.2026 00:00:00',plannedActiveAmount:1200}]);
  assert.ok(html.includes('08.10.2026'));
  assert.ok(!html.includes('10.08.2026'));
  assert.ok(html.includes('Уже в заявках:'));
});
