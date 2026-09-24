import assert from 'node:assert/strict';
import test from 'node:test';
import { isBuyerPaymentHistory, matchesPaymentOrderSearch, ordersForNewPayment, sortByUnplannedAmount, sortPaymentPickerOrders, paymentActionPriority, isRecentPaymentOrder, isSmallPaymentSuggestion } from '../lib/procurement-payment-priority';

const row = (ref: string, supplierPartner: string, orderPaymentGap: number, unplannedAmount = orderPaymentGap) =>
  ({ ref, supplierPartner, orderPaymentGap, unplannedAmount });

test('dated orders are newest first regardless of acquisition balance; display window never mutates source',()=>{
  const rows=[{...row('2025','A',9999999),date:'22.11.2025',planningState:'receipt_debt'},
    {...row('yesterday','A',100),date:'2026-09-24'}, {...row('today','A',0),date:'25.09.2026',planningState:'prepayment'},
    {...row('unknown','A',99999999),date:''}];
  const before=JSON.stringify(rows);
  assert.deepEqual(sortPaymentPickerOrders(rows).map(r=>r.ref),['today','yesterday','2025','unknown']);
  assert.deepEqual(rows.filter(r=>isRecentPaymentOrder(r,'2026-09-25')).map(r=>r.ref),['yesterday','today']);
  assert.equal(isRecentPaymentOrder({date:'2026-06-28'},'2026-09-25'),true);
  assert.equal(isRecentPaymentOrder({date:'2026-06-27'},'2026-09-25'),false);
  assert.equal(isRecentPaymentOrder({date:'2026-09-26'},'2026-09-25'),false);
  assert.equal(JSON.stringify(rows),before);
});
test('1000 display threshold uses measured remaining balance, never nominal value or unknown gap',()=>{
  for(const amount of [0,0.25,999.99,1000,1001]) {
    assert.equal(isSmallPaymentSuggestion({...row('order','A',999999),receiptSettlement:{debtRub:amount}}),amount<1000);
    assert.equal(isSmallPaymentSuggestion(row('debt:A','A',0,amount)),amount<1000);
  }
  assert.equal(isSmallPaymentSuggestion(row('unknown','A',0.25)),false);
  assert.equal(isSmallPaymentSuggestion({...row('prepayment','A',0),noAcquisitions:{}}),false);
  assert.equal(isSmallPaymentSuggestion({...row('bad','A',0),receiptSettlement:{debtRub:NaN}}),false);
});

test('verified zero stays in searchable history without becoming cash-paid; missing or inconsistent evidence stays visible', () => {
  const evidence = {checkedAt:new Date().toISOString(),debtRub:0,requiresAdvanceReview:false,
    receipts:[{ref:'receipt',number:'1',amountRub:100,remainingRub:0}],
    supplier:{ref:'supplier',grossDebtRub:200,creditsRub:0,netOwedRub:200}};
  const zero = {...row('zero','Supplier',0),number:'394',receiptSettlement:evidence};
  assert.equal(isBuyerPaymentHistory(zero),true);
  assert.equal(matchesPaymentOrderSearch(zero,'394'),true);
  assert.deepEqual(ordersForNewPayment([zero]),[]);
  assert.equal(isBuyerPaymentHistory({...zero,receiptSettlement:undefined}),false);
  assert.equal(isBuyerPaymentHistory({...zero,receiptSettlement:{...evidence,receipts:[]}}),false);
  assert.equal(isBuyerPaymentHistory({...zero,receiptSettlement:{...evidence,receipts:[{...evidence.receipts[0],remainingRub:1}]}}),false);
  assert.equal(isBuyerPaymentHistory({...zero,receiptSettlement:{...evidence,debtRub:0.01,receipts:[{...evidence.receipts[0],remainingRub:0.01}]}}),false);
  assert.equal(zero.receiptSettlement.supplier.netOwedRub,200,'supplier debt is independent');
});

test('employee corrections precede pending and approved requests', () => {
  assert.deepEqual(['APPROVED','SUBMITTED','NEEDS_CHANGES'].sort((a,b)=>paymentActionPriority({status:a})-paymentActionPriority({status:b})), ['NEEDS_CHANGES','SUBMITTED','APPROVED']);
});

test('unproven zero and small balances stay selectable; only confirmed receipt debt uses the 500-ruble threshold', () => {
  const rows = [0, .36, .4, 1, 10, 100, 499.99, 500, 500.01, 9000].map((value, i) => ({...row(String(i), 'A', value), planningState: i >= 8 ? 'receipt_debt' : 'needs_review'}));
  const before = JSON.stringify(rows);
  assert.deepEqual(ordersForNewPayment(rows).map(x => x.orderPaymentGap), [0, .36, .4, 1, 10, 100, 499.99, 500, 500.01, 9000]);
  assert.equal(JSON.stringify(rows), before);
});

test('confirmed debt with an active full reservation is excluded, but partial reservation remains', () => {
  assert.deepEqual(ordersForNewPayment([{...row('reserved', 'A', 10000, 0), planningState:'receipt_debt'}, {...row('part', 'A', 10000, 100), planningState:'receipt_debt'}]).map(x => x.ref), ['part']);
});

test('planning shows largest unplanned amounts first without removing small balances', () => {
  const rows = [row('kopecks', 'A', .4), row('large', 'B', 90000, 3000), row('small', 'C', 500), row('medium', 'D', 5000)];
  const before = [...rows];
  assert.deepEqual(sortByUnplannedAmount(rows).map(x => x.ref), ['medium', 'large', 'small', 'kopecks']);
  assert.deepEqual(rows, before);
});

test('picker ranks individual outstanding balances across suppliers', () => {
  const rows = [{...row('a-small', 'A', .4), planningState:'needs_review'}, {...row('b', 'B', 10000), planningState:'receipt_debt'}, {...row('a-large', 'A', 9000), planningState:'receipt_debt'}, {...row('a-medium', 'A', 5000), planningState:'receipt_debt'}, {...row('c', 'C', 500), planningState:'needs_review'}];
  assert.deepEqual(sortPaymentPickerOrders(rows).map(x => x.ref), ['b', 'a-large', 'a-medium', 'c', 'a-small']);
  assert.equal(rows[0].ref, 'a-small');
});

test('unverified balances remain selectable without being ranked as confirmed debt', () => {
  const rows = [{ ...row('review', 'A', 900000), planningState: 'needs_review' }, {...row('small', 'B', 10), planningState:'needs_review'}, {...row('large', 'C', 5000), planningState:'receipt_debt'}];
  assert.deepEqual(sortPaymentPickerOrders(rows).map(x => x.ref), ['large', 'review', 'small']);
});

test('known acquisition balances needing advance review precede raw unverified order gaps', () => {
  const rows=[{...row('unknown','A',900000),planningState:'needs_review'},
    {...row('advance','A',1000),planningState:'needs_review',receiptSettlement:{debtRub:1000}},
    {...row('confirmed','A',600),planningState:'receipt_debt'},
    {...row('zero','A',0),planningState:'settled',receiptSettlement:{debtRub:0}},
    {...row('small','A',0.01),planningState:'needs_review',receiptSettlement:{debtRub:0.01}}];
  assert.deepEqual(sortPaymentPickerOrders(rows).map(x=>x.ref),['confirmed','advance','small','unknown','zero']);
});

test('only a recorded strict payment closure removes an ambiguous order', () => {
  const now = new Date().toISOString();
  const receipt = {number:'1',amountRub:1,remainingRub:0,payments:[]};
  const rows = [{...row('open','A',0),planningState:'settled'},
    {...row('small','C',200),planningState:'needs_review',paymentClosure:{state:'small_balance' as const,remainingRub:200,checkedAt:now,receipts:[receipt]}},
    {...row('paid','B',0),planningState:'settled',paymentClosure:{state:'paid' as const,remainingRub:0,checkedAt:now,receipts:[receipt]}}];
  assert.deepEqual(ordersForNewPayment(rows).map(x=>x.ref), ['open','small']);
});

test('search accepts suffix, full number and supplier without numeric prefix false matches', () => {
  const order = { number: '000F-000397', supplierPartner: 'Поставщик 123' };
  for (const query of ['397', ' 397 ', '97', '000F-000397', 'поставщик']) assert.equal(matchesPaymentOrderSearch(order, query), true);
  for (const query of ['123', '000', '398']) assert.equal(matchesPaymentOrderSearch(order, query), false);
  assert.equal(matchesPaymentOrderSearch({ ...order, number: '' }, '123'), true);
});

test('debt-only picker uses supplier debt and equal amounts keep stable order', () => {
  assert.deepEqual(sortPaymentPickerOrders([row('debt:A', 'A', 0, 500), row('debt:B', 'B', 0, 9000)]).map(x => x.ref), ['debt:B', 'debt:A']);
  assert.deepEqual(sortPaymentPickerOrders([row('one', 'A', 500), row('two', 'A', 500)]).map(x => x.ref), ['one', 'two']);
  assert.deepEqual(sortPaymentPickerOrders([]), []);
});
