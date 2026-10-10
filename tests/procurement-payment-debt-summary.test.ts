import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementPaymentDebtSummary} from '../components/ProcurementPaymentDebtSummary';
type Props=React.ComponentProps<typeof ProcurementPaymentDebtSummary>;
const order={ref:'one',number:'445',amount:47000};
const balance={debt:20000,advance:0,closingBalance:20000,reviewRequired:false};
const render=(props:Partial<Props>={})=>renderToStaticMarkup(React.createElement(ProcurementPaymentDebtSummary,{balance,orders:[order],...props})).replace(/\s|&nbsp;/g,'');
test('supplier debt and order amount visible without disclosure and never summed',()=>{
  const html=render();
  assert.ok(html.includes('Общийдолгпоставщику'));
  assert.ok(html.includes('20000,00'));
  assert.ok(html.includes('Суммазаказа'));
  assert.ok(html.includes('47000,00'));
  assert.ok(!html.includes('<details'));
  assert.ok(!html.includes('67000'));
  assert.ok(!html.includes('нерассчитан'));
  assert.ok(!html.includes('Долгпоприобретениям'));
});
test('missing or unverified balances never become zero',()=>{
  for(const props of [{balance:undefined},{unavailable:true},{balance:{...balance,reviewRequired:true}}]){
    assert.ok(render(props).includes('Данныенедоступны'));
    assert.ok(!render(props).includes('20000,00'));
  }
  assert.ok(render({balance:{...balance,debt:0}}).includes('0,00'));
});
test('receipt debt is shown only with unambiguous evidence; prepayment is not debt',()=>{
  const receiptSettlement={checkedAt:'2026-10-10',debtRub:5000,requiresAdvanceReview:false,receipts:[],supplier:{ref:'s',grossDebtRub:20000,creditsRub:0,netOwedRub:20000}};
  assert.ok(render({orders:[{...order,receiptSettlement}]}).includes('Долгпоприобретениям'));
  for(const next of [{...order,receiptSettlement:{...receiptSettlement,requiresAdvanceReview:true}},{...order,planningState:'needs_review',receiptSettlement}]){
    assert.ok(!render({orders:[next]}).includes('5000,00'));
  }
  assert.ok(render({orders:[{...order,noAcquisitions:{checkedAt:'2026-10-10'}}]}).includes('предоплата'));
});
test('supplier debt appears once for multiple orders, debt-only request has no order amount',()=>{
  assert.equal(render({orders:[order,{...order,ref:'two',number:'440'}]}).split('20000,00').length-1,1);
  assert.ok(!render({orders:[{ref:'debt:s',number:''}]}).includes('Суммазаказа'));
});
test('missing historical order is not interpreted as zero or an accounting task',()=>{
  const html=render({orders:[{ref:'old',number:'306'},{ref:'older',number:'300'}]});
  assert.ok(!html.includes('Суммуоплатыукажите'));
  assert.ok(!html.includes('нерассчитаны'));
  assert.ok(!html.includes('Долгпоприобретениям'));
  assert.ok(html.includes('>—</span>'));
  assert.equal(html.split('306').length-1,1);
  assert.equal(html.split('300').length-1,1);
});
test('multiple orders have one visible number per row and an accessible removal action',()=>{
  const html=render({orders:[order,{...order,ref:'two',number:'440'}],onRemoveOrder:()=>{},disabled:true});
  const visible=html.replace(/<[^>]*>/g,'');
  assert.equal(visible.split('445').length-1,1);
  assert.equal(visible.split('440').length-1,1);
  assert.ok(!visible.includes('нерассчитаны'));
  assert.ok(html.includes('aria-label="Убратьзаказ445"'));
  assert.equal(html.split('disabled=""').length-1,2);
});
test('mixed evidence stays associated with each order without calling unknown debt zero',()=>{
  const receiptSettlement={checkedAt:'2026-10-10',debtRub:5000,requiresAdvanceReview:false,receipts:[],supplier:{ref:'s',grossDebtRub:20000,creditsRub:0,netOwedRub:20000}};
  const html=render({orders:[{...order,receiptSettlement},{ref:'two',number:'440',amount:30000}]});
  assert.ok(html.includes('5000,00'));
  assert.equal(html.split('Долгпоприобретениям').length-1,1);
  assert.ok(!html.includes('Остаткипозаказамнерассчитаны'));
});
