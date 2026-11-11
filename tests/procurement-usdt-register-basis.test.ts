import test from 'node:test';
import assert from 'node:assert/strict';
import {attachRegisterPaymentBasis} from '../lib/procurement-register-payment-basis';
import {hasConfirmedPaymentBasis} from '../lib/procurement-payment-basis';
import {fetchSupplierCurrencyPaymentSnapshot} from '../lib/procurement-currency-payment-source';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';
const id=(n:number)=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const now=new Date('2026-11-11T14:00:00Z');
const p:SupplierCurrencyPaymentRow={ref:id(1),number:'TEST',date:'11.11.2026 13:34:58',posted:true,deleted:false,
  documentAmount:8005.95,documentCurrency:'USDT',supplier:'Supplier',counterparty:'Company',contract:'',baseDocumentRef:'',
  settlementAmount:624464.1,settlementCurrency:'руб',settlementMovementsCount:1};
const dimensions={supplier_ref:id(2),counterparty_ref:id(3),organization_ref:id(4)};
const proof=()=>({ok:true,complete:true,write_operations:false,contract_version:'supplier-payment-basis-v1',as_of:now.toISOString(),
  payment:[{...dimensions,currency_ref:id(5),currency_name:'USDT',payment_ref:p.ref,payment_number:p.number,payment_date:p.date,
    amount:p.documentAmount,posted:true,deleted:false,supplier_payment:true,version_token:'v1',supplier_name:'Supplier',counterparty_name:'Company'}],
  movements:[{...dimensions,currency_ref:id(6),currency_name:'руб',payment_ref:p.ref,movement_date:p.date,line_number:1,
    amount:p.settlementAmount!,movement_type:'Приход',contract_ref:id(7),contract_name:'Contract'}]});
test('USDT header identity and whole independent RUB settlement confirm the exact contract',()=>{
  const result=attachRegisterPaymentBasis(p,proof(),now);
  assert.equal(hasConfirmedPaymentBasis(result),true);assert.equal(result.documentAmount,8005.95);
  assert.equal(result.contract,'');assert.equal(result.registerContractBasis?.contracts.length,1);
});
test('missing or mismatched settlement totals, counts and currencies never prove a USDT contract',()=>{
  for(const patch of [{settlementAmount:undefined},{settlementAmount:624464},{settlementMovementsCount:undefined},
    {settlementMovementsCount:2},{settlementCurrency:'USDT'}]){
    assert.equal(hasConfirmedPaymentBasis(attachRegisterPaymentBasis({...p,...patch},proof(),now)),false);
  }
  for(const change of [(v:ReturnType<typeof proof>)=>{v.movements[0].amount--;},
    (v:ReturnType<typeof proof>)=>{v.movements[0].currency_ref='';},
    (v:ReturnType<typeof proof>)=>{v.movements[0].supplier_ref=id(9);},
    (v:ReturnType<typeof proof>)=>{v.movements[0].contract_ref='';},
    (v:ReturnType<typeof proof>)=>{v.movements.push({...v.movements[0]});}]){
    const v=proof();change(v);assert.equal(hasConfirmedPaymentBasis(attachRegisterPaymentBasis(p,v,now)),false);
  }
});
test('foreign document identity is exact to eight decimals and reversal still revokes proof',()=>{
  const v=proof();v.payment[0].amount+=0.00000001;
  assert.throws(()=>attachRegisterPaymentBasis(p,v,now),/DOCUMENT_MISMATCH/);
  const tiny=proof();tiny.payment[0].amount=1e-10;
  assert.throws(()=>attachRegisterPaymentBasis({...p,documentAmount:1e-10},tiny,now),/DOCUMENT_MISMATCH/);
  for(const patch of [{posted:false},{deleted:true},{supplier_payment:false}]){
    const v=proof();Object.assign(v.payment[0],patch);assert.equal(attachRegisterPaymentBasis(p,v,now).posted,false);
  }
  assert.throws(()=>attachRegisterPaymentBasis(p,{...proof(),complete:false},now),/SOURCE_INCOMPLETE/);
});
test('USDT-denominated register movements preserve their own currency and precision',()=>{
  const v=proof();v.movements[0].currency_ref=id(5);v.movements[0].currency_name='USDT';v.movements[0].amount=8005.95000001;
  const row={...p,settlementCurrency:'USDT',settlementAmount:v.movements[0].amount};
  assert.equal(hasConfirmedPaymentBasis(attachRegisterPaymentBasis(row,v,now)),true);
  v.movements[0].currency_ref=id(6);assert.equal(hasConfirmedPaymentBasis(attachRegisterPaymentBasis(row,v,now)),false);
});
test('source fetches an exact missing USDT contract once and does not scan unrelated order history',async t=>{
  t.mock.timers.enable({apis:['Date'],now});
  const env={...process.env};t.after(()=>{process.env=env;});
  process.env['1C_BASE_URL']='https://one-c.invalid';process.env['1C_API_USER']='test';process.env['1C_API_PASSWORD']='test';
  let reads=0;
  t.mock.method(globalThis,'fetch',async(input:string)=>{
    const u=new URL(input);
    if(u.pathname.includes('supplier-currency'))return Response.json({ok:true,rows:[{ref:p.ref,number:p.number,date:p.date,posted:true,deleted:false,
      document_amount:p.documentAmount,document_currency:'USDT',supplier_partner:'Supplier',supplier_counterparty:'Company',
      settlement_amount:p.settlementAmount,settlement_currency:p.settlementCurrency,settlement_movements_count:1}]});
    if(u.pathname.includes('currency-cash-costing-plan'))return Response.json({ok:true,events:[]});
    if(u.pathname.includes('currency-exchange-diagnostics'))return Response.json({ok:true,cash_expense_orders:[]});
    if(u.pathname.includes('supplier-order-finance-control'))return Response.json({ok:true,request_orders:[]});
    assert.equal(u.pathname.split('/').pop(),'supplier-settlements');assert.equal(u.searchParams.get('detail'),'payment-basis');
    assert.equal(u.searchParams.get('payment_ref'),p.ref);reads++;return Response.json(proof());
  });
  const result=await fetchSupplierCurrencyPaymentSnapshot({from:new Date('2026-10-01'),to:now,plans:[{supplierPartner:'Supplier',orderRefs:[]}]});
  assert.equal(result.complete,true);assert.equal(reads,1);assert.equal(hasConfirmedPaymentBasis(result.payments[0]),true);
});
