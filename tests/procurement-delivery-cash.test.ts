import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProcurementDeliveryCash, deliveryReserveWarning, type DeliveryCashSnapshot } from '../components/ProcurementDeliveryCash';

const example: DeliveryCashSnapshot = {balance:2259,checkedAt:'2026-09-27T11:09:11Z',lastIssue:{amount:5000,date:'2026-09-26T10:45:10Z'}};
const render = (snapshot:DeliveryCashSnapshot) => renderToStaticMarkup(React.createElement(ProcurementDeliveryCash,{snapshot}));
test('delivery cash is compact, dated, explicitly accounting-only, with no refill task',()=>{
  const html=render(example);
  assert.match(html,/Остаток по 1С/); assert.match(html,/Выдано 26 сентября/); assert.match(html,/2\s259/); assert.match(html,/5\s000/);
  assert.match(html,/26 сентября/); assert.match(html,/27 сентября.*14:09/);
  assert.doesNotMatch(html,/Доступно|Свободно|Сверьте|Пополнить|Запросить|<button|<input|Средн|Месяц/);
});
test('zero is valid, missing or invalid data never turns into zero',()=>{
  assert.match(render({...example,balance:0}),/>0\s₽</);
  for(const balance of [null,NaN,Infinity]) {
    const html=render({...example,balance});
    assert.match(html,/Остаток из 1С недоступен/); assert.doesNotMatch(html,/Выдано 26 сентября|>0\s₽</);
  }
  assert.match(render({...example,checkedAt:''}),/Остаток из 1С недоступен/);
});
test('negative accounting balance is not presented as money remaining',()=>{
  const html=render({...example,balance:-100});
  assert.match(html,/Перерасход по 1С/); assert.doesNotMatch(html,/Остаток по 1С|Доступно/);
});
test('missing issuance is omitted, not invented or shown as zero',()=>{
  for(const lastIssue of [null,{amount:0,date:example.checkedAt},{amount:5000,date:'bad'}])
    assert.doesNotMatch(render({...example,lastIssue}),/Выдано 26 сентября/);
});
test('reserve warning uses inclusive threshold, valid advice and fresh source only',()=>{
  const now=Date.parse(example.checkedAt);
  const s={...example,reserveAdvice:{target:35000,warnAt:20000}};
  for(const balance of [-10,0,2259,20000]) assert.equal(deliveryReserveWarning({...s,balance},now),true);
  for(const balance of [20000.01,35000,null,NaN]) assert.equal(deliveryReserveWarning({...s,balance},now),false);
  assert.equal(deliveryReserveWarning(example,now),false);
  assert.equal(deliveryReserveWarning(s,now+86_400_001),false);
  assert.equal(deliveryReserveWarning(s,now-300_001),false);
  for(const reserveAdvice of [{target:20000,warnAt:20000},{target:35000,warnAt:0},{target:Infinity,warnAt:20000}])
    assert.equal(deliveryReserveWarning({...s,reserveAdvice},now),false);
});
test('warning is advice, not a cash withdrawal approval or a claimed notification',()=>{
  const html=render({...example,checkedAt:new Date().toISOString(),reserveAdvice:{target:35000,warnAt:20000}});
  assert.match(html,/Низкий остаток/); assert.match(html,/Рекомендуемый запас: 35\s000/);
  assert.match(html,/только по согласованной заявке/);
  assert.doesNotMatch(html,/Уведомление отправлено|Ожидается пополнение|<button|<input|Осталось.*дн/);
});
