import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyRateRows,dailyRateCommand,dailyRateBindingMatches,type DailyRatePlan} from '../lib/procurement-daily-rate';
const command={day:'2026-11-05',currency:'USDT' as const,rate:90};
const plan:DailyRatePlan={id:'a',planCode:'PAY-test',supplierPartner:'Test',status:'APPROVED',plannedDate:command.day,updatedAt:'2026-11-05T10:00:00Z',plannedAmount:8600,paymentMethod:'USDT',currency:'USDT',foreignAmount:100,exchangeRate:86,fundingSource:'CASH_EXCHANGE'};
const unpaid={state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0};
test('foreign-authoritative recalculation; RUB amount remains authoritative',()=>{
 assert.equal(dailyRateRows([plan],new Map([['a',unpaid]]),command).rows[0].after,9000);
 const row=dailyRateRows([{...plan,foreignAmount:null,fundingSource:null}],new Map([['a',unpaid]]),command).rows[0];assert.equal(row.after,8600);assert.equal(row.foreignAmount,null);
 const cny={...plan,currency:'CNY',paymentMethod:'CNY',foreignAmount:4255,exchangeRate:13.6,plannedAmount:57868,fundingSource:null};
 assert.equal(dailyRateRows([cny],new Map([['a',unpaid]]),{...command,currency:'CNY',rate:13.7}).rows[0].after,58293.5);
});
test('never reprice partial/paid/unknown/mismatched/collected/wallet/individual terms',()=>{
 for(const change of [{state:'PARTIALLY_ISSUED'},{state:'PARTIALLY_PAID_BY_ONE_C'},{state:'PAID_BY_ONE_C'},{state:'SMALL_REMAINDER_COMPLETED'},{state:'SOURCE_UNAVAILABLE'},{state:'MISMATCH'},{state:'NEEDS_REVIEW'},{paidAmount:1},{paidForeignAmount:1},{issuedAmount:1},{collection:{}},{cashOrders:[{}]},{currencyPayments:[{}]},{paymentAmountNeedsConfirmation:true},{rubleAllocationNeedsReview:true},{paidAmount:NaN}])assert.equal(dailyRateRows([plan],new Map([['a',{...unpaid,...change}]]),command).rows.length,0,JSON.stringify(change));
 for(const change of [{fundingSource:'WALLET'},{plannedAmount:8700},{oneCIssuedAmount:1},{exchangeRate:null}])assert.equal(dailyRateRows([{...plan,...change}],new Map([['a',unpaid]]),command).rows.length,0);
 assert.equal(dailyRateRows([plan],new Map(),command).rows.length,0);
});
test('effective deferred day, currency, completed and cancelled boundaries',()=>{
 for(const change of [{status:'CANCELLED'},{status:'COMPLETED_WITHOUT_TOPUP'},{currency:'CNY'},{paymentMethod:'BANK'},{plannedDate:'2026-11-06'},{oneCCashEvidence:{fundingDeferral:{date:null,comment:'',changedAt:'2026-11-05T10:00:00Z',actorId:1}}}])assert.equal(dailyRateRows([{...plan,...change}],new Map([['a',unpaid]]),command).rows.length,0);
 const deferred={...plan,plannedDate:'2026-11-04',oneCCashEvidence:{fundingDeferral:{date:command.day,comment:'',changedAt:'2026-11-05T10:00:00Z',actorId:1}}};assert.equal(dailyRateRows([deferred],new Map([['a',unpaid]]),command).rows.length,1);
});
test('confirmation binding invalidates after rate, amount, foreign total or date edit',()=>{
 const q={id:'quote',day:command.day,currency:command.currency,rate:90,revision:1,actor:'Test',createdAt:'2026-11-05T10:00:00Z'};
 const p={...plan,exchangeRate:90,plannedAmount:9000,oneCCashEvidence:{dailyRate:{quoteId:q.id,rate:90,rubles:9000,foreignAmount:100}}};assert.ok(dailyRateBindingMatches(p,q));
 for(const delta of [{exchangeRate:91},{plannedAmount:8999},{foreignAmount:99},{plannedDate:'2026-11-06'}])assert.equal(dailyRateBindingMatches({...p,...delta},q),false);
 assert.equal(dailyRateBindingMatches(p,{...q,id:'next'}),false);
});
test('strict rate precision and actual calendar dates',()=>{
 for(const b of [{rate:0},{rate:-1},{rate:Infinity},{rate:'90'},{rate:1.1234567},{day:'2026-02-30'},{currency:'RUB'}])assert.throws(()=>dailyRateCommand({...command,...b}));
 assert.equal(dailyRateCommand({...command,rate:13.123456}).rate,13.123456);
});
