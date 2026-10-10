import test from 'node:test';
import assert from 'node:assert/strict';
import {PROCUREMENT_CARGO as cargo,cargoRequestError,cargoManagerAllowed} from '../lib/procurement-cargo';
import {DELIVERY_PERSON} from '../lib/procurement-delivery-policy';
import {matchProcurementPaymentEvidence,type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';
import {validatePaymentPlan} from '../lib/procurement-payment-control';
const plan:EvidencePlan={id:'cargo',planCode:'PAY-CARGO',supplierPartner:cargo.supplierPartner,supplierCounterparty:cargo.supplierCounterparty,paymentPurpose:'DELIVERY',orderRefs:[],plannedAmount:15000,paymentMethod:'CASH',status:'APPROVED',createdAt:'2026-10-01T00:00:00Z',plannedDate:'2026-10-10'};
const payment:SupplierCurrencyPaymentRow={ref:'rko',number:'test',date:'10.10.2026 12:00:00',posted:true,deleted:false,documentAmount:15000,documentCurrency:'РУБ',baseDocumentRef:'',supplier:cargo.supplierPartner,counterparty:cargo.supplierCounterparty,contract:'',registerContractBasis:{versionToken:'test',contracts:[{ref:cargo.contractRef,name:cargo.contractName}]}};
const match=(rows=[payment],plans=[plan])=>matchProcurementPaymentEvidence(plans,[],rows,[]);
test('only approved manager and carrier can create delivery without orders',()=>{
 const data={supplierPartner:cargo.supplierPartner,orderRefs:[],orderNumbers:[]};
 assert.equal(cargoRequestError(data,'Астемир Тохов'),null);
 assert.equal(cargoRequestError(data,DELIVERY_PERSON.name),null);
 assert.ok(cargoRequestError(data,'Другой сотрудник'));
 assert.ok(cargoRequestError({...data,supplierPartner:'Любой поставщик'},'Астемир Тохов'));
 assert.ok(cargoRequestError({...data,orderRefs:['fake']},'Астемир Тохов'));
});
test('cargo accepts the live 1C manager mapping and display alias, not other employees',()=>{
 for(const name of [DELIVERY_PERSON.name,'  ТОХОВ   АСТЕМИР  ','Астемир Тохов'])assert.equal(cargoManagerAllowed(name),true);
 for(const name of ['', 'Тохов', 'Астемир', 'Тохов Астемир другой', 'Другой сотрудник'])assert.equal(cargoManagerAllowed(name),false);
});
test('delivery closes only with verified carrier contract, not amount/name alone',()=>{
 assert.equal(match().get('cargo')?.state,'ISSUED_BY_ONE_C');
 for(const change of [{registerContractBasis:undefined},{registerContractBasis:{...payment.registerContractBasis!,contracts:[{ref:'wrong',name:cargo.contractName}]}},{deleted:true},{posted:false},{supplier:'Other',counterparty:'Other'}]){
   assert.equal(match([{...payment,...change}]).get('cargo')?.issuedAmount,0);
 }
});
test('delivery duplicates are not counted twice and two open requests are ambiguous',()=>{
 assert.equal(match([payment,payment]).get('cargo')?.issuedAmount,15000);
 for(const row of match([payment],[plan,{...plan,id:'second',planCode:'SECOND'}]).values())assert.equal(row.issuedAmount,0);
});
test('delivery CNY remains a ruble RKO without fictitious foreign payment',()=>{
 const row=match([payment],[{...plan,paymentMethod:'CNY',foreignAmount:1000}]).get('cargo')!;
 assert.equal(row.state,'ISSUED_BY_ONE_C');assert.equal(row.paidForeignAmount,0);assert.equal(row.actualExchangeRate,null);
});
test('unrecognized purpose cannot be persisted',()=>{
 const result=validatePaymentPlan({paymentPurpose:'OTHER',supplierPartner:'x',plannedAmount:1,plannedDate:'2026-10-10',paymentMethod:'CASH'},true);
 assert.equal(result.ok,false);
});
test('USDT delivery requires explicit contract and a sole outstanding request',()=>{
 const usdtPlan={...plan,paymentMethod:'USDT',foreignAmount:150};
 const usdtPayment={...payment,documentCurrency:'USDT',documentAmount:150,registerContractBasis:undefined,contract:cargo.contractName};
 assert.equal(match([usdtPayment],[usdtPlan]).get('cargo')?.state,'PAID_BY_ONE_C');
 assert.equal(match([{...usdtPayment,contract:''}],[usdtPlan]).get('cargo')?.paidForeignAmount,0);
 for(const row of match([usdtPayment],[usdtPlan,{...usdtPlan,id:'second'}]).values())assert.equal(row.paidForeignAmount,0);
});
