import test from 'node:test';import assert from 'node:assert/strict';
import {procurementHistoryRate} from '../lib/procurement-history-rate';
test('historical actual rate wins only with independent current foreign payment evidence',()=>{
 const p={paymentMethod:'USDT',exchangeRate:'86',evidence:{state:'PAID_BY_ONE_C',verification:'current',paidForeignAmount:100,actualExchangeRate:85.5}};
 assert.equal(procurementHistoryRate(p),'Курс: 85,5 ₽ / USDT');
 for(const patch of [{verification:'unavailable'},{verification:'last-confirmed'},{state:'MISMATCH'},{paidForeignAmount:0},{paymentAmountNeedsConfirmation:true},{actualExchangeRate:null}])assert.equal(procurementHistoryRate({...p,evidence:{...p.evidence,...patch}}),'Курс: 86 ₽ / USDT');
 assert.equal(procurementHistoryRate({...p,paymentMethod:'CNY'}),'Курс: 86 ₽ / CNY');
 assert.equal(procurementHistoryRate({...p,paymentMethod:'CASH'}),undefined);
 assert.equal(procurementHistoryRate({paymentMethod:'CNY',exchangeRate:null}),undefined);
});
import {procurementHistoryListMoney} from '../lib/procurement-history-rate';
test('compact amounts preserve actual paid USDT, RUB evidence and request-only CNY rate',()=>{
 const usdt={paymentMethod:'USDT',plannedAmount:86000,foreignAmount:1000,exchangeRate:86,evidence:{verification:'current',state:'PAID_BY_ONE_C',paidForeignAmount:1000,paidAmount:85500,issuedAmount:0,actualExchangeRate:85.5}};
 assert.deepEqual(procurementHistoryListMoney(usdt),{amount:'1 000 USDT',secondary:'85 500 ₽ · Курс 85,5'});
 const cny={paymentMethod:'CNY',plannedAmount:59570,foreignAmount:4255,exchangeRate:14,evidence:{verification:'current',state:'ISSUED_BY_ONE_C',paidForeignAmount:0,paidAmount:0,issuedAmount:59570,actualExchangeRate:null}};
 assert.deepEqual(procurementHistoryListMoney(cny),{amount:'4 255 ¥',secondary:'59 570 ₽ · Курс 14'});
 const partial=procurementHistoryListMoney(cny,{paidAmount:10000,paidForeignAmount:0});assert.equal(partial.amount,'10 000 ₽');assert.match(partial.secondary!,/Курс/);assert.doesNotMatch(partial.amount,/4.?255/);
 assert.deepEqual(procurementHistoryListMoney({paymentMethod:'BANK',plannedAmount:4800,evidence:{paidForeignAmount:0,issuedAmount:4800,actualExchangeRate:null}}),{amount:'4 800 ₽',secondary:undefined});
});

test('USDT funded through a RUB cash order retains its actual ruble payment instead of zero',()=>{
 const plan={paymentMethod:'USDT',plannedAmount:189832,foreignAmount:2145,exchangeRate:88.5,evidence:{verification:'current',state:'ISSUED_BY_ONE_C',paidForeignAmount:0,paidAmount:0,issuedAmount:189832,actualExchangeRate:null}};
 assert.deepEqual(procurementHistoryListMoney(plan),{amount:'189 832 ₽',secondary:'Курс 88,5 ₽/USDT'});
});

import {procurementHistorySummary,procurementListRate} from '../lib/procurement-history-rate';
test('history distinguishes the requested foreign amount from the actual ruble cash order',()=>{
 const plan={paymentMethod:'USDT',plannedAmount:189832.5,foreignAmount:2145,exchangeRate:88.5,evidence:{verification:'current',state:'SMALL_REMAINDER_COMPLETED',paidForeignAmount:0,paidAmount:0,issuedAmount:189832,actualExchangeRate:null}};
 assert.deepEqual(procurementHistorySummary(plan),{foreign:'2 145 USDT',foreignNote:'По заявке',rubles:'189 832 ₽',rubleNote:undefined,rate:'Курс 88,5'});
 const paid={...plan,evidence:{...plan.evidence,state:'PAID_BY_ONE_C',paidForeignAmount:2145,paidAmount:189832.5,issuedAmount:0,actualExchangeRate:88.5}};
 assert.equal(procurementHistorySummary(paid).foreignNote,undefined);
 assert.equal(procurementHistorySummary(paid,{paidAmount:10000,paidForeignAmount:100}).foreign,'100 USDT');
 assert.equal(procurementHistorySummary({...plan,paymentMethod:'CASH',exchangeRate:null,foreignAmount:null}).foreign,undefined);
});
test('current list shows the saved request rate and does not fabricate a missing rate',()=>{
 assert.equal(procurementListRate({paymentMethod:'CNY',exchangeRate:13.6}),'Курс 13,6');
 assert.equal(procurementListRate({paymentMethod:'USDT',exchangeRate:88.5}),'Курс 88,5');
 for(const exchangeRate of [null,0,'',-1,'unknown'])assert.equal(procurementListRate({paymentMethod:'CNY',exchangeRate}),undefined);
 assert.equal(procurementListRate({paymentMethod:'CASH',exchangeRate:88.5}),undefined);
});
