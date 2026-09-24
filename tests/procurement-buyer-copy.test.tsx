import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementReceiptEvidence, ProcurementPaymentGuidance} from '../components/ProcurementReceiptEvidence';
import {ProcurementPaymentBatchForm} from '../app/(dashboard)/procurement/ProcurementPaymentBatchForm';
import type {OrderReceiptSettlement} from '../lib/procurement-planning-verification';
import type {OrderPaymentClosure} from '../lib/procurement-order-payment-closure';

const evidence:OrderReceiptSettlement={checkedAt:'2026-09-24T09:00:00Z',debtRub:720.9,requiresAdvanceReview:true,
  receipts:[{ref:'receipt',number:'123',amountRub:1000,remainingRub:720.9}],
  supplier:{ref:'supplier',grossDebtRub:9999,creditsRub:8888,netOwedRub:1111}};

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
  assert.match(html,/только если договорились/);
  assert.match(html,/<input[^>]+type="number"[^>]+value=""/);
});
test('buyer sees receipt facts, not supplier accounting formulas or inferred cash payments',()=>{
  const html=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={evidence}/>);
  assert.match(html,/Приобретения и оплаты/);assert.match(html,/Приобретение №123/);
  assert.doesNotMatch(html,/поступлен/i);
  assert.match(html,/720,90/);assert.match(html,/Полный список связанных оплат пока не подтверждён/);
  assert.doesNotMatch(html,/9\s?999|8\s?888|1\s?111|Расшифровка|зачёт|договор|Оплата по РКО/);
  assert.equal(evidence.supplier.creditsRub,8888,'underlying evidence is preserved');
});
test('only an exact receipt reference shows a documented allocated payment',()=>{
  const paymentClosure:OrderPaymentClosure={state:'small_balance',remainingRub:100,checkedAt:evidence.checkedAt,
    receipts:[{ref:'receipt',number:'123',amountRub:1000,remainingRub:100,payments:[{ref:'cash',number:'456',date:'21.09.2026 12:00:00',amount:15,currency:'USDT',appliedRub:900,method:'advance'}]}]};
  const e={...evidence,debtRub:100,receipts:[{...evidence.receipts[0],remainingRub:100}]};
  const html=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={e} paymentClosure={paymentClosure}/>);
  assert.match(html,/Оплата по РКО №456/);assert.match(html,/21.09.2026/);assert.match(html,/900,00/);
  assert.doesNotMatch(html,/Полный список/);
  paymentClosure.receipts[0].ref='other-receipt';
  assert.doesNotMatch(renderToStaticMarkup(<ProcurementReceiptEvidence evidence={e} paymentClosure={paymentClosure}/>),/Оплата по РКО/);
});
test('zero debt is not relabelled cash paid and unknown evidence is not displayed as zero',()=>{
  assert.equal(renderToStaticMarkup(<ProcurementReceiptEvidence/>),'');
  const e={...evidence,debtRub:0,receipts:[{...evidence.receipts[0],remainingRub:0}]};
  const html=renderToStaticMarkup(<ProcurementReceiptEvidence evidence={e}/>);
  assert.match(html,/долга в 1С нет/);assert.doesNotMatch(html,/Оплачено|Оплата по РКО/);
  assert.match(renderToStaticMarkup(<ProcurementPaymentGuidance evidence={e}/>),/По этим приобретениям долга в 1С нет/);
});
test('buyer gets an action, not an instruction to reconcile advances',()=>{
  assert.match(renderToStaticMarkup(<ProcurementPaymentGuidance evidence={evidence}/>),/Сумма новой оплаты требует сверки/);
  assert.match(renderToStaticMarkup(<ProcurementPaymentGuidance/>),/Не удалось подтвердить остаток/);
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
  assert.match(html,/Остаток в 1С: 720,90/);
  assert.match(html,/Долг поставщику по 1С: 1\s111,00/);
  assert.match(html,/Сумма заказа:/);
  assert.match(html,/Сумма новой оплаты требует сверки/);
  assert.doesNotMatch(html,/доплат|Остаток к оплате|Заказы за 90 дней|Заказы без долга по приобретениям/i);
  assert.match(html,/Передать на согласование/);
});

test('even a small balance with advances is marked for reconciliation, never a ready payment',()=>{
  const order={ref:'small',number:'386',supplierPartner:'Supplier',supplierCounterparty:'',orderPaymentGap:150,supplierDebt:1000,
    plannedActiveAmount:0,unplannedAmount:150,orderComment:'',planningState:'needs_review',
    receiptSettlement:{...evidence,debtRub:150,receipts:[{...evidence.receipts[0],remainingRub:150}]}};
  const html=renderToStaticMarkup(<ProcurementPaymentBatchForm orders={[order]} supplierBalances={{Supplier:{debt:1000,advance:0,closingBalance:-1000,reviewRequired:false}}}
    initialSelectedRefs={['small']} onCreated={()=>{}} onCancel={()=>{}} basisPreview/>);
  assert.match(html,/Сумма новой оплаты требует сверки/);
  assert.match(html,/Приобретения и оплаты/);
  assert.doesNotMatch(html,/доплат|Небольшой остаток/i);
});
