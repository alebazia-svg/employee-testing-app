import test from 'node:test';
import assert from 'node:assert/strict';
import { cnyCommentDraftPatch, cnyRateFromComment, latestCnyCommentRate, plannedFxRubles } from '../lib/procurement-planned-fx';
import { cnyExpenseCommentSources } from '../lib/procurement-cny-rate';
import { validatePaymentPlan } from '../lib/procurement-payment-control';

test('CNY reads explicit comments, never an amount or an unspecified currency', () => {
  for (const text of ['11000 юаней по курсу 13,6', 'CNY курс: 13.60', 'курс юаня 13,6']) assert.equal(cnyRateFromComment(text),13.6);
  assert.equal(cnyRateFromComment('11000 по курсу 13,6',true),13.6);
  for (const text of ['11000 по курсу 13,6', '16800 юаней по курсу', 'CNY 11000 149600', 'USDT курс 89,5', 'юани курс 0', 'юани курс 13,6–14', 'юани курс 13,6 или 14', 'юани курс 13.6000001', 'юани курс -13.6', 'юани курс 13.6?', 'юани старый курс 13,6', 'CNY курс 13,6 и USDT курс 89', 'курс 0,07 юаня за рубль']) assert.equal(cnyRateFromComment(text),null,text);
  assert.equal(cnyRateFromComment('USDT курс 89,5',true),null);
  assert.equal(cnyRateFromComment('юани курс 1360 рублей за 100 юаней'),null);
  assert.equal(cnyRateFromComment('курс 13.6 '.padEnd(500,' '),true),null);
});

test('latest explicit rate is dated; conflicts and future values are not guessed', () => {
  const now=new Date('2026-10-10T18:00:00Z');
  const plan={comment:'курс 13.6',knownCny:true,date:'09.10.2026 12:00:00',sourceLabel:'Комментарий заявки'};
  const rko={comment:'юани курс 13.7',date:'10.10.2026 12:00:00',sourceLabel:'Комментарий расходника 1С',documentNumber:'123'};
  assert.equal(latestCnyCommentRate([plan,rko],now)?.rate,13.7);
  assert.equal(latestCnyCommentRate([rko,{...plan,date:'11.10.2026'}],now)?.documentNumber,'123');
  assert.equal(latestCnyCommentRate([rko,{...rko,comment:'юани курс 14'}],now),undefined);
});

test('only complete, posted RUB supplier RKO comments may seed a CNY hint', () => {
  const row={document_type:'cash_expense_order',posted:true,deleted:false,currency:'руб',operation:'Оплата поставщику',date:'10.10.2026',comment:'юани курс 13.6'};
  const payload={ok:true,source_errors:[],cash_expense_orders:[row]};
  assert.equal(cnyExpenseCommentSources(payload).length,1);
  for(const patch of [{posted:false},{deleted:true},{currency:'USDT'},{operation:'Конвертация валюты'},{document_type:'cash_income_order'}]) assert.deepEqual(cnyExpenseCommentSources({...payload,cash_expense_orders:[{...row,...patch}]}),[]);
  assert.deepEqual(cnyExpenseCommentSources({...payload,source_errors:[{}]}),[]);
  assert.deepEqual(cnyExpenseCommentSources({...payload,cash_expense_orders:Array(1000).fill(row)}),[]);
});

test('CNY is a planned RUB estimate; server recomputes it and requires a rate', () => {
  const input={supplierPartner:'Test',orderRefs:['order'],plannedDate:'2026-10-10',paymentMethod:'CNY',foreignAmount:11000,exchangeRate:13.6,plannedAmount:1};
  assert.equal(validatePaymentPlan(input).data.plannedAmount,149600);
  assert.equal(validatePaymentPlan(input).data.currency,'CNY');
  assert.equal(validatePaymentPlan({...input,exchangeRate:''}).ok,false);
  assert.equal(validatePaymentPlan({...input,exchangeRate:'',condition:'по курсу 13,8'}).data.plannedAmount,151800);
  assert.equal(validatePaymentPlan({...input,exchangeRate:14,condition:'по курсу 13,8'}).data.plannedAmount,154000);
  assert.equal(plannedFxRubles(1.23,13.6),16.73);
  assert.equal(plannedFxRubles(0,13.6),null);
  assert.equal(plannedFxRubles(1e30,13.6),null);
});

test('current CNY comment takes precedence over historical hint, manual input is preserved', () => {
  assert.deepEqual(cnyCommentDraftPatch('курс 13,8','','',13.6),{});
  assert.deepEqual(cnyCommentDraftPatch('курс 13,8','11000','13.6',13.6),{exchangeRate:'13.8',plannedAmount:'151800'});
  assert.deepEqual(cnyCommentDraftPatch('курс 13,8','11000','14',13.6),{});
  assert.deepEqual(cnyCommentDraftPatch('курс уточняется','11000','13.6',13.6),{});
  assert.deepEqual(cnyCommentDraftPatch('курс 13,9','11000','13.8',13.6,13.8),{exchangeRate:'13.9',plannedAmount:'152900'});
  assert.deepEqual(cnyCommentDraftPatch('курс 13,9','11000','14',13.6,13.8),{});
});
test('CNY RUB-only plan preserves rubles and never invents foreign amount',()=>{
  const input={supplierPartner:'Test',orderRefs:['order'],plannedDate:'2026-10-12',paymentMethod:'CNY',plannedAmount:10000,foreignAmount:'',exchangeRate:''};
  const result=validatePaymentPlan(input);
  assert.equal(result.ok,true);
  assert.equal(result.data.plannedAmount,10000);
  assert.equal(result.data.foreignAmount,null);
  assert.equal(result.data.currency,'CNY');
  assert.equal(validatePaymentPlan({...input,condition:'курс 13,6'}).data.plannedAmount,10000);
  for(const foreignAmount of [-1,'wrong',0])assert.equal(validatePaymentPlan({...input,foreignAmount}).ok,false);
  assert.equal(validatePaymentPlan({...input,plannedAmount:''}).ok,false);
});
