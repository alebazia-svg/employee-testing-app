import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementReceiptEvidence} from '../components/ProcurementReceiptEvidence';
import {ProcurementPaymentBatchForm} from '../app/(dashboard)/procurement/ProcurementPaymentBatchForm';
import type {OrderReceiptSettlement} from '../lib/procurement-planning-verification';
import type {OrderPaymentClosure} from '../lib/procurement-order-payment-closure';

const evidence:OrderReceiptSettlement={checkedAt:'2026-09-24T09:00:00Z',debtRub:720.9,requiresAdvanceReview:true,
  receipts:[{ref:'receipt',number:'123',amountRub:1000,remainingRub:720.9}],
  supplier:{ref:'supplier',grossDebtRub:9999,creditsRub:8888,netOwedRub:1111}};

test('picker starts collapsed without hiding a preselected payment or its acquisition evidence',()=>{
  const order={ref:'order',number:'334',supplierPartner:'Supplier',supplierCounterparty:'',orderPaymentGap:720.9,supplierDebt:1111,
    plannedActiveAmount:0,unplannedAmount:720.9,orderComment:'',receiptSettlement:evidence};
  const html=renderToStaticMarkup(<ProcurementPaymentBatchForm orders={[order]}
    supplierBalances={{Supplier:{debt:1111,advance:0,closingBalance:-1111,reviewRequired:false}}}
    initialSelectedRefs={['order']} onCreated={()=>{}} onCancel={()=>{}} basisPreview/>);
  assert.match(html,/aria-label="Показать список"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(html,/aria-label="Заказы для оплаты"|Выбрать заказ 334|Показать более ранние/);
  assert.match(html,/Выбрано: 1/);
  assert.match(html,/Приобретения по 1С/);
  assert.match(html,/Сколько перечислить сейчас/);
});

test('zero orders cannot be preselected and no-acquisition prepayment is not auto-filled',()=>{
  const base={ref:'zero',number:'394',supplierPartner:'Supplier',supplierCounterparty:'',orderPaymentGap:900000,supplierDebt:100,
    plannedActiveAmount:0,unplannedAmount:900000,orderComment:'',planningState:'prepayment'};
  const zero={...base,receiptSettlement:{...evidence,debtRub:0,receipts:[{...evidence.receipts[0],remainingRub:0}]}};
  const none={...base,ref:'none',number:'382',noAcquisitions:{checkedAt:evidence.checkedAt}};
  const html=renderToStaticMarkup(<ProcurementPaymentBatchForm orders={[zero,none]} supplierBalances={{}}
    initialSelectedRefs={['zero','none']} onCreated={()=>{}} onCancel={()=>{}} basisPreview/>);
  assert.doesNotMatch(html,/Выбрать заказ 394|Сумма пока неизвестна|900.?000/);
  assert.doesNotMatch(html,/Заказы без долга по приобретениям|Заказы за 90 дней|Скрыть историю/);
  assert.match(html,/Приобретений пока нет/);
  assert.match(html,/Укажите сумму, согласованную с поставщиком/);
  assert.match(html,/<input[^>]+type="number"[^>]+value=""/);
});
test('buyer sees receipt facts, not supplier accounting formulas or inferred cash payments',()=>{
  const html=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={evidence}/>);
  assert.match(html,/Приобретения по 1С/);assert.match(html,/Приобретение №123/);
  assert.doesNotMatch(html,/поступлен/i);
  assert.match(html,/720,90/);assert.doesNotMatch(html,/Список оплат может быть неполным|требует сверки/);
  assert.doesNotMatch(html,/9\s?999|8\s?888|1\s?111|Расшифровка|зачёт|договор|РКО №/);
  assert.equal(evidence.supplier.creditsRub,8888,'underlying evidence is preserved');
});
test('only an exact receipt reference shows a documented allocated payment',()=>{
  const paymentClosure:OrderPaymentClosure={state:'small_balance',remainingRub:100,checkedAt:evidence.checkedAt,
    receipts:[{ref:'receipt',number:'123',amountRub:1000,remainingRub:100,payments:[{ref:'cash',number:'456',date:'21.09.2026 12:00:00',amount:15,currency:'USDT',appliedRub:900,method:'advance'}]}]};
  const e={...evidence,debtRub:100,receipts:[{...evidence.receipts[0],remainingRub:100}]};
  const html=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={e} paymentClosure={paymentClosure}/>);
  assert.match(html,/РКО №456/);assert.match(html,/21.09.2026/);assert.match(html,/На это приобретение: 900,00/);
  assert.doesNotMatch(html,/Список оплат может быть неполным/);
  paymentClosure.receipts[0].ref='other-receipt';
  assert.doesNotMatch(renderToStaticMarkup(<ProcurementReceiptEvidence evidence={e} paymentClosure={paymentClosure}/>),/РКО №/);
});
test('zero debt is not relabelled cash paid and unknown evidence is not displayed as zero',()=>{
  const unknown=renderToStaticMarkup(<ProcurementReceiptEvidence/>);
  assert.equal(unknown,'');
  const e={...evidence,debtRub:0,receipts:[{...evidence.receipts[0],remainingRub:0}]};
  const html=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={e}/>);
  assert.match(html,/Остаток: 0,00/);assert.doesNotMatch(html,/Оплачено|РКО №/);
});
test('selected advance-review order keeps the amount blank, permits a request and hides raw planning reasons',()=>{
  const order={ref:'order',number:'334',supplierPartner:'Supplier',supplierCounterparty:'',orderPaymentGap:720.9,supplierDebt:1111,
    plannedActiveAmount:0,unplannedAmount:720.9,orderComment:'',receiptSettlement:evidence,
    planningState:'needs_review',planningReason:'Проверить зачёт авансов и возвратов'};
  const html=renderToStaticMarkup(<ProcurementPaymentBatchForm orders={[order]} supplierBalances={{Supplier:{debt:1111,advance:0,closingBalance:-1111,reviewRequired:false}}}
    initialSelectedRefs={['order']} onCreated={()=>{}} onCancel={()=>{}} basisPreview/>);
  assert.match(html,/Сколько перечислить сейчас/);assert.match(html,/Укажите сумму, согласованную с поставщиком/);
  assert.doesNotMatch(html,/руководител/i);
  assert.match(html,/<input[^>]+type="number"[^>]+value=""/);
  assert.doesNotMatch(html,/Почему\?|Проверить зачёт|Задолженность перед поставщиком/);
  assert.match(html,/Остаток: 720,90/);
  assert.match(html,/Долг поставщику по 1С: 1\s111,00/);
  assert.match(html,/Сумма заказа:/);
  assert.doesNotMatch(html,/Сумма новой оплаты требует сверки|не сумма новой оплаты|Не сумма к перечислению|По приобретениям осталось/);
  assert.doesNotMatch(html,/доплат|Остаток к оплате|Заказы за 90 дней|Заказы без долга по приобретениям/i);
  assert.match(html,/Передать на согласование/);
});

test('advance review stays in evidence without an accounting instruction or automatic payment amount',()=>{
  const order={ref:'small',number:'386',supplierPartner:'Supplier',supplierCounterparty:'',orderPaymentGap:150,supplierDebt:1000,
    plannedActiveAmount:0,unplannedAmount:150,orderComment:'',planningState:'needs_review',
    receiptSettlement:{...evidence,debtRub:150,receipts:[{...evidence.receipts[0],remainingRub:150}]}};
  const html=renderToStaticMarkup(<ProcurementPaymentBatchForm orders={[order]} supplierBalances={{Supplier:{debt:1000,advance:0,closingBalance:-1000,reviewRequired:false}}}
    initialSelectedRefs={['small']} onCreated={()=>{}} onCancel={()=>{}} basisPreview/>);
  assert.doesNotMatch(html,/Сумма новой оплаты требует сверки/);
  assert.match(html,/Приобретения по 1С/);
  assert.match(html,/<input[^>]+type="number"[^>]+value=""/);
  assert.equal(order.receiptSettlement.requiresAdvanceReview,true);
  assert.doesNotMatch(html,/доплат|Небольшой остаток/i);
});

test('acquisition amounts are inside optional details only, never another proposed payment above the form',()=>{
  const html=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={evidence}/>);
  assert.doesNotMatch(html,/По приобретениям осталось|Не сумма к перечислению/);
  assert.ok(html.indexOf('720,90') > html.indexOf('<details'));
  assert.equal((html.match(/<details/g)||[]).length,1);
  const inline=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={evidence} inline/>);
  assert.doesNotMatch(inline,/<details|<summary/);
  assert.match(inline,/Приобретение №123/);
  const zero=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={{...evidence,debtRub:0}}/>);
  assert.doesNotMatch(zero,/Оплачено полностью|Заказ закрыт/);
  const advance=renderToStaticMarkup(<ProcurementReceiptEvidence noAcquisitions={{checkedAt:evidence.checkedAt}}/>);
  assert.match(advance,/Приобретений пока нет/);
  assert.doesNotMatch(advance,/<details|долга нет|не подтверждён/);
});
