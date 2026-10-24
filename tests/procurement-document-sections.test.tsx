import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProcurementDocumentSections} from '../components/ProcurementDocumentSections';
import type {Receipt,ReceiptPlan} from '../components/ProcurementReceipts';

const plan:ReceiptPlan={id:'test',supplierPartner:'Test',plannedAmount:100,orderNumbers:[],plannedDate:'2026-10-25',status:'APPROVED',paymentMethod:'USDT'};
const legacy:Receipt={id:'old',planId:'test',originalName:'saved.pdf',size:100,createdAt:'2026-10-20T10:00:00Z',author:{name:'Test'},purpose:'QR'};
const render=(method:string,files:Receipt[]=[],complete=false)=>renderToStaticMarkup(<ProcurementDocumentSections plan={{...plan,paymentMethod:method,...(complete?{evidence:{state:'ISSUED_BY_ONE_C',issuedAmount:100}}:{})}} files={files} today="2026-10-25" admin={true} disabled={false} onRequestQr={async()=>true} onAdd={async()=>true} onChange={async()=>true} onOpen={()=>{}}/>);
test('cash and QR cash-out have only receipt section; transfer methods retain requisites',()=>{
  for(const method of ['CASH','ACCOUNTABLE_QR']){
    const html=render(method);
    assert.doesNotMatch(html,/Реквизиты для оплаты|Добавить реквизиты|Требует проверки/);
    assert.match(html,/Чеки оплаты/);
  }
  for(const method of ['USDT','CNY','BANK']){
    assert.match(render(method),/Добавить реквизиты/);
    assert.doesNotMatch(render(method),/Не добавлены/);
  }
});
test('retained files survive method changes without irrelevant QR checks or new upload actions',()=>{
  for(const method of ['CASH','ACCOUNTABLE_QR']){
    const html=render(method,[legacy]);
    assert.match(html,/saved.pdf/);
    assert.doesNotMatch(html,/Добавить реквизиты|Требует проверки|Заменить/);
  }
  assert.doesNotMatch(render('BANK',[legacy]),/Требует проверки/);
  assert.match(render('USDT',[legacy]),/Требует проверки/);
  assert.match(render('CNY',[legacy]),/Требует проверки/);
});
test('completed payment hides an empty requisites section but preserves saved documents',()=>{
  assert.doesNotMatch(render('USDT',[],true),/Реквизиты для оплаты/);
  assert.match(render('USDT',[legacy],true),/saved.pdf/);
  assert.doesNotMatch(render('USDT',[legacy],true),/Требует проверки|Добавить реквизиты/);
});
test('admin has one context-specific request action, no unrelated-method or completed requests',()=>{
  assert.match(render('USDT'),/Запросить QR-код/);
  assert.match(render('CNY',[legacy]),/Проверить актуальность/);
  assert.doesNotMatch(render('USDT',[legacy]),/Запросить QR-код/);
  for(const method of ['BANK','CASH','ACCOUNTABLE_QR'])assert.doesNotMatch(render(method,[legacy]),/Запросить QR-код|Проверить актуальность/);
  assert.doesNotMatch(render('USDT',[legacy],true),/Проверить актуальность/);
});
test('both admin and buyer retain receipt upload after partial/full payment and the existing early QR exception',()=>{
  for(const admin of [true,false]){
    const view=(method:string,state:string,amount:number)=>renderToStaticMarkup(<ProcurementDocumentSections plan={{...plan,paymentMethod:method,evidence:{state,issuedAmount:amount,cashOrders:amount?[{ref:'rko',number:'RKO-1',amount,date:'2026-10-25'}]:[]}}} files={[]} today="2026-10-25" admin={admin} disabled={false} onAdd={async()=>true} onChange={async()=>true} onOpen={()=>{}}/>);
    for(const method of ['BANK','USDT','CNY','CASH']){
      assert.match(view(method,'ISSUED_BY_ONE_C',100),/Добавить чек/);
      assert.match(view(method,'PARTIALLY_ISSUED',50),/Добавить чек/);
      assert.doesNotMatch(view(method,'NO_EVIDENCE',0),/Добавить чек/);
    }
    assert.match(view('ACCOUNTABLE_QR','NO_EVIDENCE',0),/Добавить чек/);
  }
});
