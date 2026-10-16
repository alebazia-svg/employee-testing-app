import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {supplierAdvanceChoices,SUPPLIER_ADVANCE,supplierOnlyPaymentLabel} from '../lib/procurement-supplier-advance';
import {singlePaymentRequest} from '../lib/procurement-single-payment';
import {validatePaymentPlan} from '../lib/procurement-payment-control';
import {approvedEditData} from '../lib/procurement-approved-edit';
import {ProcurementPaymentForm} from '../app/(dashboard)/procurement/ProcurementPaymentForm';
import {matchProcurementPaymentEvidence,type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import {hasConfirmedReceiptPayment,needsReceiptSinceRollout} from '../lib/procurement-receipt-policy';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';

const balances={Hoco:{debt:0,advance:58845.12,closingBalance:58845.12,reviewRequired:false},Other:{debt:0,advance:0,closingBalance:0,reviewRequired:false}};
const draft={plannedDate:'2026-10-17',plannedAmount:'20000',paymentMethod:'BANK',foreignAmount:'',exchangeRate:'',fundingSource:'',condition:'На следующую поставку'};
test('advance selection includes every own supplier even without orders/debt, but preserves duplicate and unavailable guards',()=>{
  assert.deepEqual(supplierAdvanceChoices(balances,[]).map(x=>x.supplierPartner),['Hoco','Other']);
  assert.deepEqual(supplierAdvanceChoices(balances,['Hoco']).map(x=>x.supplierPartner),['Other']);
  assert.deepEqual(supplierAdvanceChoices(balances,[],true),[]);
  const request=singlePaymentRequest([supplierAdvanceChoices(balances,[])[0]],draft);
  assert.equal(request.url,'/api/procurement/payment-plans/batch');
  const row=(request.body as any).rows[0];
  assert.equal(row.basis,'ADVANCE');assert.equal(row.paymentPurpose,SUPPLIER_ADVANCE);assert.equal(row.orderRef,'');
});
test('persisted intent is independent of user comment; old debt plans stay debt',()=>{
  const input={...draft,supplierPartner:'Hoco',orderRefs:[],orderNumbers:[],paymentPurpose:SUPPLIER_ADVANCE};
  assert.equal(validatePaymentPlan(input,true).ok,true);
  assert.equal(validatePaymentPlan({...input,orderRefs:['paid-order']},true).ok,false);
  assert.equal(validatePaymentPlan(input).ok,false,'cannot bypass the authorized supplier-only route');
  assert.equal(supplierOnlyPaymentLabel(input),'Аванс поставщику');
  assert.equal(supplierOnlyPaymentLabel({}),'В счёт долга поставщику');
  const plan={...validatePaymentPlan(input,true).data,updatedAt:'2026-10-16T10:00:00.000Z'};
  const edit=approvedEditData(plan,{version:plan.updatedAt,plannedAmount:25000,reason:'Уточнение суммы'},'2026-10-16');
  assert.equal(edit.data.paymentPurpose,SUPPLIER_ADVANCE);assert.deepEqual(edit.data.orderRefs,[]);
});
test('real form shows advance, existing credit and no fictional order or debt amount',()=>{
  const props={orders:[],supplierBalances:balances,initialSelectedRefs:['advance:Hoco'],onCreated:()=>{},onCancel:()=>{},basisPreview:true};
  const html=renderToStaticMarkup(React.createElement(ProcurementPaymentForm,props));
  assert.match(html,/Аванс поставщику/);assert.match(html,/У поставщика уже есть аванс/);
  assert.ok(html.replace(/\s|&nbsp;/g,'').includes('58845,12'));
  assert.ok(!html.includes('Сумма заказа'));assert.ok(!html.includes('Долг по приобретениям'));
  const empty=renderToStaticMarkup(React.createElement(ProcurementPaymentForm,{...props,initialSelectedRefs:[]}));
  assert.match(empty,/<option value="ADVANCE">Аванс поставщику/);
});
test('new advance uses the existing contract-backed RKO reconciliation and receipt policy, never an old payment',()=>{
  const plan:EvidencePlan={id:'advance-test',planCode:'TEST-ADVANCE',paymentPurpose:SUPPLIER_ADVANCE,supplierPartner:'Hoco',supplierCounterparty:'',orderRefs:[],plannedAmount:20000,paymentMethod:'BANK',status:'APPROVED',createdAt:'2026-10-16T09:00:00Z'};
  const payment:SupplierCurrencyPaymentRow={ref:'test-rko',number:'TEST',date:'16.10.2026 14:00:00',posted:true,deleted:false,documentAmount:20000,documentCurrency:'РУБ',baseDocumentRef:'',supplier:'Hoco',contract:'Hoco contract'};
  const match=(patch:Partial<SupplierCurrencyPaymentRow>={})=>matchProcurementPaymentEvidence([plan],[],[{...payment,...patch}],[]).get(plan.id)!;
  const evidence=match();assert.equal(evidence.state,'ISSUED_BY_ONE_C');
  assert.equal(hasConfirmedReceiptPayment({evidence}),true);assert.equal(needsReceiptSinceRollout({...plan,evidence},0),true);
  for(const patch of [{date:'15.10.2026 14:00:00'},{contract:''},{supplier:'Other'},{posted:false},{deleted:true}])assert.equal(match(patch).issuedAmount,0);
});
