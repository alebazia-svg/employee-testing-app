import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementUsdtFields} from '../components/ProcurementUsdtFields';
import {ProcurementCnyFields} from '../components/ProcurementCnyFields';
const base={amount:'8173',rate:'',source:'',available:450.99,reference:{rate:89.5,conversionAt:'2026-09-19'},onChange:()=>{}};
const render=(patch:Partial<React.ComponentProps<typeof ProcurementUsdtFields>>={})=>renderToStaticMarkup(React.createElement(ProcurementUsdtFields,{...base,...patch})).replace(/\s|&nbsp;/g,'');
test('opening legacy payment keeps one saved amount, not latest-rate recalculation',()=>{
  const html=render({legacyRubles:'731483'});
  assert.equal(html.split('731483₽').length-1,1);
  assert.ok(!html.includes('731483,5'));
  assert.ok(html.includes('Суммаиззаявки'));
  assert.ok(!html.includes('В сохранённой заявке'));
});
test('request always shows one ruble reference, without choosing or implying funding',()=>{
  for(const source of ['', 'CASH_EXCHANGE','WALLET']){
    const html=render({source});
    assert.equal(html.split('731483,5₽').length-1,1);
    assert.ok(html.includes('Ориентировочноврублях'));
    assert.ok(!html.includes('Предварительныйрасчёт'));
    for(const removed of ['Источникооплаты','Источник оплаты','Доступновкассе','Подготовитьналичными','ИзкассыUSDT','<select'])assert.ok(!html.includes(removed.replace(/\s/g,'')));
  }
});
test('multiple orders explicitly share one transfer amount in both currencies',()=>{
  assert.ok(render({multipleOrders:true}).includes('Общаясуммаперевода,USDT'));
  assert.ok(!render().includes('Общаясумма'));
  const html=renderToStaticMarkup(React.createElement(ProcurementCnyFields,{multipleOrders:true,amount:'100',rate:'13.6',onChange:()=>{}}));
  assert.ok(html.includes('Общая сумма перевода, CNY'));
  assert.ok(html.includes('Ориентировочно в рублях'));
  assert.ok(!html.includes('Предварительный расчёт'));
});
test('missing saved amount does not invent zero; missing rate requests input',()=>{
  assert.ok(render({legacyRubles:'',reference:{rate:null}}).includes('Укажитесуммуикурс'));
  assert.ok(render({legacyRubles:'invalid'}).includes('731483,5₽'));
});
test('both currencies put the dated source inside the rate label, never under the transfer amount',()=>{
  const usdt=renderToStaticMarkup(React.createElement(ProcurementUsdtFields,base));
  const cny=(sourceLabel:string)=>renderToStaticMarkup(React.createElement(ProcurementCnyFields,{amount:'100',rate:'13.6',reference:{rate:13.6,checkedAt:'2026-10-10',conversionAt:'2026-10-10',sourceLabel},onChange:()=>{}}));
  for(const html of [usdt,cny('Комментарий расходника'),cny('Комментарий заявки')]){
    const labels=html.match(/<label\b[^>]*>[\s\S]*?<\/label>/g)!;
    assert.ok(!labels[0].includes('Последний курс'));
    assert.ok(labels[1].includes('Последний курс из'));
    assert.ok(labels[1].includes('text-xs font-normal'));
  }
  assert.ok(usdt.includes('Последний курс из 1С'));
  assert.ok(cny('Комментарий заявки').includes('Последний курс из заявки'));
});
test('old RUB-only USDT request opens with its amount and no new required rate field',()=>{
  const html=render({amount:'',rate:'',legacyRubles:'10000',reference:{rate:null}});
  assert.ok(html.includes('Суммазаявки,₽'));
  assert.ok(html.includes('value="10000"'));
  assert.ok(!html.includes('Курс,₽/USDT'));
  assert.ok(html.includes('УказатьвUSDT'));
});
test('currency switch follows the amount input, before the rate field',()=>{
  for(const html of [render(),renderToStaticMarkup(React.createElement(ProcurementCnyFields,{amount:'100',rate:'13.6',onChange:()=>{}})).replace(/\s/g,'')]){
    assert.ok(html.includes('Указатьврублях'));
    assert.ok(html.indexOf('Указатьврублях')<html.indexOf('Курс,'));
    assert.ok(!html.includes('Известнатолькосумма'));
  }
});
test('CNY ruble-only request reopens without a mandatory currency amount or rate',()=>{
  const html=renderToStaticMarkup(React.createElement(ProcurementCnyFields,{amount:'',rate:'',legacyRubles:'10000',onChange:()=>{}}));
  assert.ok(html.includes('value="10000"'));
  assert.ok(html.includes('Указать в юанях'));
  assert.ok(!html.includes('Курс,'));
});
