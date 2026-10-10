import test from 'node:test';
import assert from 'node:assert/strict';
import {plannedFxFromRubles} from '../lib/procurement-planned-fx';
import {paymentOrderExcess} from '../lib/procurement-single-payment';
import {matchesPaymentOrderSearch,isRecentPaymentOrder,isSmallPaymentSuggestion} from '../lib/procurement-payment-priority';

test('explicit switch converts the latest RUB amount rather than reviving a stale foreign draft',()=>{
  assert.deepEqual(plannedFxFromRubles('2720','13.6',2),{foreignAmount:'200',exchangeRate:'13.6',plannedAmount:'2720'});
  assert.deepEqual(plannedFxFromRubles('17900','89.5',4),{foreignAmount:'200',exchangeRate:'89.5',plannedAmount:'17900'});
  assert.equal(plannedFxFromRubles('1500','13.6',2).foreignAmount,'110.29');
  assert.equal(plannedFxFromRubles('1500','13.6',2).plannedAmount,'1499.94');
  for(const [amount,rate] of [['1000',''],['1000','0'],['','13.6'],['0','13.6'],['-1','13.6'],['invalid','13.6'],['1000','Infinity'],['1e30','13.6']]){
    const draft=plannedFxFromRubles(amount,rate,2);
    assert.equal(draft.foreignAmount,'');assert.equal(draft.plannedAmount,'');
  }
});

test('warning uses verified remaining order amount and does not block prepayments or uncertain balances',()=>{
  const order={ref:'order',planningState:'receipt_debt',unplannedAmount:4000,receiptSettlement:{debtRub:5000,requiresAdvanceReview:false}};
  assert.equal(paymentOrderExcess(order,'4500'),500);
  assert.equal(paymentOrderExcess(order,'4000'),0);
  assert.equal(paymentOrderExcess(order,'3999'),0);
  for(const patch of [{ref:'debt:supplier'},{planningState:'needs_review'},{receiptSettlement:undefined},{receiptSettlement:{debtRub:5000,requiresAdvanceReview:true}},{unplannedAmount:NaN}])assert.equal(paymentOrderExcess({...order,...patch},'6000'),0);
});

test('search matches old and small orders by number or supplier independently of suggestion filters',()=>{
  const order={ref:'old',number:'00OF-000123',date:'01.01.2025',supplierPartner:'Glass 111',unplannedAmount:100,receiptSettlement:{debtRub:100}};
  assert.equal(isRecentPaymentOrder(order,'2026-10-11'),false);
  assert.equal(isSmallPaymentSuggestion(order),true);
  assert.equal(matchesPaymentOrderSearch(order,'123'),true);
  assert.equal(matchesPaymentOrderSearch(order,'Glass'),true);
  assert.equal(matchesPaymentOrderSearch(order,' 00OF-000123 '),true);
  assert.equal(matchesPaymentOrderSearch(order,'999'),false);
});
