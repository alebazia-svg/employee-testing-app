import test from 'node:test';import assert from 'node:assert/strict';
import {procurementRateReferences} from '../lib/procurement-rate-references';
const p=(rate:number,day='2026-11-05',extra={})=>({paymentMethod:'USDT',exchangeRate:rate,evidence:{verification:'current',state:'ISSUED_BY_ONE_C',issuedAmount:100,cashOrders:[{date:day}],...extra}});
test('reference uses one unambiguous paid-day rate, does not mutate requests or claim daily approval',()=>{
 const plans=[p(88.5),p(88.5),p(89,'2026-11-07'),p(95,'2026-11-06',{state:'NO_EVIDENCE'})];const before=JSON.stringify(plans);
 const result=procurementRateReferences(plans,'2026-11-06',{USDT:{rate:89.5,day:'2026-09-19',source:'1C'}});
 assert.deepEqual(result.USDT,{rate:88.5,day:'2026-11-05',source:'Сохранённый курс оплаченных заявок'});assert.equal(JSON.stringify(plans),before);
});
test('ambiguous paid rates and unavailable evidence retain the dated independent fallback',()=>{
 const fallback={USDT:{rate:86,day:'2026-11-01',source:'1C'}};
 assert.deepEqual(procurementRateReferences([p(88),p(89)],'2026-11-06',fallback),fallback);
 assert.deepEqual(procurementRateReferences([p(88,'2026-11-05',{verification:'unavailable'})],'2026-11-06',fallback),fallback);
 assert.deepEqual(procurementRateReferences([],'2026-11-06'),{});
});
test('independent actual USDT rate wins only on confirmed evidence; RUB CNY never invents an actual FX rate',()=>{
 assert.equal(procurementRateReferences([p(88,'05.11.2026 12:30:00',{state:'PAID_BY_ONE_C',paidForeignAmount:10,actualExchangeRate:85.5})],'2026-11-06').USDT?.rate,85.5);
 assert.equal(procurementRateReferences([p(88,'2026-11-05',{state:'PAID_BY_ONE_C',paidForeignAmount:10,actualExchangeRate:85.5,paymentAmountNeedsConfirmation:true})],'2026-11-06').USDT?.rate,88);
 assert.equal(procurementRateReferences([{...p(13.65),paymentMethod:'CNY'}],'2026-11-06').CNY?.rate,13.65);
});
