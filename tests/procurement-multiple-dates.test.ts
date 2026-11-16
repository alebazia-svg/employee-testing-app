import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {planningRequestOverlap} from '../lib/procurement-planning-overlap';
import {creationOrderChoices} from '../lib/procurement-create-view';
import {ProcurementPaymentForm} from '../app/(dashboard)/procurement/ProcurementPaymentForm';
import {matchProcurementPaymentEvidence,type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import {paymentFingerprint} from '../lib/procurement-manual-payment-links';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';

const future={id:'future',status:'APPROVED',supplierPartner:'Luxo',orderRefs:['order-484'],plannedDate:new Date('2026-11-20')};
test('future supplier payment does not block today; exact orders and same-day supplier-wide retries stay protected',()=>{
  const request={supplierPartner:'Luxo',orderRefs:[],plannedDate:'2026-11-16'};
  assert.equal(planningRequestOverlap([request],[future],new Map()),false);
  assert.equal(planningRequestOverlap([{...request,plannedDate:'2026-11-20'}],[future],new Map()),true);
  assert.equal(planningRequestOverlap([{...request,orderRefs:['order-484']}],[future],new Map()),true);
  assert.equal(planningRequestOverlap([request],[{...future,orderRefs:[]}],new Map()),false);
  assert.equal(planningRequestOverlap([{...request,plannedDate:undefined}],[future],new Map()),true);
  assert.equal(planningRequestOverlap([request],[{...future,plannedDate:undefined}],new Map()),true);
  assert.equal(planningRequestOverlap([request],[{...future,status:'CANCELLED'}],new Map()),false);
});
const order={ref:'order-497',number:'00OF-000497',date:'2026-11-14',supplierPartner:'Luxo',supplierCounterparty:'Luxo legal',manager:'Buyer',amount:10000,receiptAmount:0,paymentAmount:0,orderPaymentGap:10000,supplierDebt:10000,orderComment:'',currentState:'',controlGroup:'',controlReason:'',noAcquisitions:{checkedAt:'2026-11-16'}};
const balances={Luxo:{debt:10000,advance:0,closingBalance:-10000,reviewRequired:false}};
test('actual creation form offers an existing supplier for debt/advance and keeps another explicit order available',()=>{
  const choices=creationOrderChoices([order],[{...future,orderRefs:[],plannedAmount:5000,evidence:{state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0}}],'2026-11-16');
  assert.deepEqual(choices.activeOrderRefs,[]);
  for(const ref of ['advance:Luxo','debt:Luxo']){
    const html=renderToStaticMarkup(React.createElement(ProcurementPaymentForm,{...choices,supplierBalances:balances,initialSelectedRefs:[ref],onCreated:()=>{},onCancel:()=>{}}));
    assert.match(html,/Выбранная оплата/);assert.match(html,/Luxo/);
  }
  assert.deepEqual(creationOrderChoices([order],[{...future,orderRefs:[order.ref],plannedAmount:5000,evidence:{state:'PARTIALLY_ISSUED',issuedAmount:1000,paidAmount:0}}],'2026-11-16').activeOrderRefs,[order.ref]);
});
function plan(id:string,day:string,method='BANK'):EvidencePlan{return {id,planCode:'PAY-20261110-'+(id==='one'?'111111':'222222'),status:'APPROVED',supplierPartner:'Luxo',supplierCounterparty:'',orderRefs:[],plannedDate:day,createdAt:'2026-11-10T10:00:00Z',plannedAmount:10000,paymentMethod:method,...(method==='USDT'?{foreignAmount:100}:{} )};}
function payment(method='BANK'):SupplierCurrencyPaymentRow{return {ref:'rko-one',number:'TEST-1',date:'16.11.2026 14:00:00',posted:true,deleted:false,documentAmount:method==='USDT'?100:10000,documentCurrency:method==='USDT'?'USDT':'РУБ',baseDocumentRef:'native-order',supplier:'Luxo',contract:'Native contract'};}
test('two supplier-wide plans are never automatically closed by the same RKO or by a nearest-date guess',()=>{
  for(const method of ['BANK','CNY','ACCOUNTABLE_QR','CASH','USDT']){
    const plans=[plan('one','2026-11-16',method),plan('two','2026-11-20',method)],rko=payment(method);
    const ambiguous=matchProcurementPaymentEvidence(plans,[],[rko],[]);
    for(const p of plans){const e=ambiguous.get(p.id)!;assert.equal(e.issuedAmount,0);assert.equal(e.paidForeignAmount,0);assert.ok(!['PAID_BY_ONE_C','ISSUED_BY_ONE_C'].includes(e.state));}
    const confirmed=matchProcurementPaymentEvidence([{...plans[0],manualRubleLinks:[{ref:rko.ref,fingerprint:paymentFingerprint(rko)}]},plans[1]],[],[rko],[]);
    assert.ok(confirmed.get('one')!.issuedAmount>0 || confirmed.get('one')!.paidForeignAmount>0);
    assert.equal(confirmed.get('two')!.issuedAmount,0);assert.equal(confirmed.get('two')!.paidForeignAmount,0);
  }
});
test('partial and duplicate documents do not leak into another date; pre-creation documents remain excluded',()=>{
  const first=plan('one','2026-11-16'),second=plan('two','2026-11-20');
  const rko={...payment(),documentAmount:4000};first.manualRubleLinks=[{ref:rko.ref,fingerprint:paymentFingerprint(rko)}];
  const partial=matchProcurementPaymentEvidence([first,second],[],[rko,rko],[]);
  assert.equal(partial.get('one')!.issuedAmount,4000);assert.equal(partial.get('two')!.issuedAmount,0);
  assert.equal(partial.get('one')!.remainingAmount,6000);
  const old={...payment(),date:'09.11.2026 14:00:00'};
  const result=matchProcurementPaymentEvidence([plan('one','2026-11-16')],[],[old],[]);assert.equal(result.get('one')!.issuedAmount,0);
});
test('distinct real orders remain independently and automatically reconciled despite sharing one supplier',()=>{
  for(const method of ['BANK','USDT']){
    const first={...plan('one','2026-11-16',method),orderRefs:['order-one']},second={...plan('two','2026-11-20',method),orderRefs:['order-two']};
    const rko={...payment(method),baseDocumentRef:'order-one'};
    const result=matchProcurementPaymentEvidence([first,second],[],[rko],[]);
    assert.ok(result.get('one')!.issuedAmount>0 || result.get('one')!.paidForeignAmount>0);
    assert.equal(result.get('two')!.issuedAmount,0);assert.equal(result.get('two')!.paidForeignAmount,0);
  }
});
