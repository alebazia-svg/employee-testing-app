import test from 'node:test';
import assert from 'node:assert/strict';
import {matchProcurementPaymentEvidence, type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';
import type {ExpenseRequestSourceRow} from '../lib/expense-request-source';
import {paymentFingerprint} from '../lib/procurement-manual-payment-links';

const plan: EvidencePlan = {id:'debt',planCode:'PAY-DEBT',supplierPartner:'Supplier',supplierCounterparty:'Supplier',
  orderRefs:[],plannedAmount:42500,paymentMethod:'ACCOUNTABLE_QR',status:'APPROVED',createdAt:'2026-09-25T00:00:00Z'};
const payment: SupplierCurrencyPaymentRow = {ref:'rko',number:'1800-test',date:'01.10.2026 14:26:05',
  posted:true,deleted:false,documentAmount:42500,documentCurrency:'РУБ',baseDocumentRef:'',supplier:'Supplier',contract:'Supplier contract'};
const match = (payments=[payment],plans=[plan],requests:ExpenseRequestSourceRow[]=[]) =>
  matchProcurementPaymentEvidence(plans,requests,payments,[]);

test('sole approved supplier-debt request accepts RUB payment regardless of settlement basis',()=>{
  for(const basis of [{},{baseDocumentRef:'order-303'},{requestOrderRef:'order-303'},
    {settlementOrderRefs:['order-303','order-347','order-379']},{contract:'Supplier contract'}]){
    const row=match([{...payment,...basis}]).get(plan.id)!;
    assert.equal(row.state,'ISSUED_BY_ONE_C');assert.equal(row.issuedAmount,42500);
    assert.equal(row.remainingAmount,0);assert.equal(row.cashOrders.length,1);
  }
});
test('several partial RKOs add up once, independent of their order links or input order',()=>{
  const first={...payment,ref:'first',date:'30.09.2026 12:00:00',documentAmount:12000,baseDocumentRef:'o379'};
  const second={...payment,documentAmount:30500,settlementOrderRefs:['o303','o347']};
  assert.equal(match([first]).get(plan.id)!.remainingAmount,30500);
  for(const rows of [[first,second],[second,first,second]]){
    const result=match(rows).get(plan.id)!;assert.equal(result.state,'ISSUED_BY_ONE_C');
    assert.equal(result.issuedAmount,42500);assert.equal(result.cashOrders.length,2);
  }
});
test('two supplier requests are not selected by amount, manager or array order',()=>{
  const other={...plan,id:'other',plannedAmount:10000,managerName:'Other manager'};
  for(const plans of [[plan,other],[other,plan]]){
    for(const row of match([payment],plans).values()){
      assert.equal(row.issuedAmount,0);assert.equal(row.state,'NEEDS_REVIEW');
    }
  }
});
test('an unmatched order request to the same supplier prevents supplier-only guessing',()=>{
  const other={...plan,id:'order-plan',orderRefs:['other-order']};
  for(const row of match([payment],[plan,other]).values()){
    assert.equal(row.issuedAmount,0);assert.equal(row.state,'NEEDS_REVIEW');
  }
});
test('exact order ownership takes precedence over supplier-debt fallback',()=>{
  const other={...plan,id:'order-plan',orderRefs:['o303']};
  const result=match([{...payment,baseDocumentRef:'o303'}],[plan,other]);
  assert.equal(result.get(other.id)!.issuedAmount,42500);assert.equal(result.get(plan.id)!.issuedAmount,0);
});
test('explicit native and manual links remain authoritative and never feed a second plan',()=>{
  const other={...plan,id:'other',planCode:'PAY-OTHER'};
  const requests=[{comment:other.planCode,counterparty:{name:'Supplier'},linked_cash_expense_orders:{rows:[{
    ref:payment.ref,posted:true,amount:42500,date:payment.date,
  }]}}] as ExpenseRequestSourceRow[];
  const native=match([payment],[plan,other],requests);
  assert.equal(native.get(plan.id)!.issuedAmount,0);assert.equal(native.get(other.id)!.issuedAmount,42500);
  const manual={...other,manualRubleLinks:[{ref:payment.ref,fingerprint:paymentFingerprint(payment)}]};
  assert.equal(match([payment],[plan,manual]).get(plan.id)!.issuedAmount,0);
  assert.equal(match([{...payment,documentAmount:40000}],[plan,manual]).get(plan.id)!.issuedAmount,0);
});
test('supplier-only fallback does not allocate overpayments or split a payment across requests',()=>{
  const result=match([{...payment,documentAmount:42500.01}]).get(plan.id)!;
  assert.equal(result.issuedAmount,0);assert.equal(result.state,'NEEDS_REVIEW');
});
test('shared supplier name does not override conflicting legal counterparties',()=>{
  const result=match([{...payment,counterparty:'Different legal entity'}]).get(plan.id)!;
  assert.equal(result.issuedAmount,0);assert.equal(result.state,'NEEDS_REVIEW');
});
test('no basis or an unknown header reference never proves supplier-debt payment',()=>{
  for(const basis of [{baseDocumentRef:''},{baseDocumentRef:'unverified-native-request'}]){
    const result=match([{...payment,contract:'',...basis}]).get(plan.id)!;
    assert.equal(result.issuedAmount,0);assert.equal(result.state,'NEEDS_REVIEW');
  }
  for(const basis of [{settlementOrderRef:'order'},{settlementOrderRefs:['o1','o2']}]){
    assert.equal(match([{...payment,contract:'',...basis}]).get(plan.id)!.issuedAmount,42500);
  }
});
test('portal plan code alone cannot replace a missing native contract/order basis',()=>{
  const requests=[{comment:plan.planCode,counterparty:{name:'Supplier'},linked_cash_expense_orders:{rows:[{
    ref:payment.ref,posted:true,amount:42500,date:payment.date,
  }]}}] as ExpenseRequestSourceRow[];
  assert.equal(match([{...payment,contract:''}],[plan],requests).get(plan.id)!.issuedAmount,0);
  assert.equal(match([payment],[plan],requests).get(plan.id)!.issuedAmount,42500);
});
test('old, missing-supplier, wrong-supplier, invalid or inactive documents do not close debt',()=>{
  for(const patch of [{date:'24.09.2026 12:00:00'},{date:'bad'},{supplier:undefined},{supplier:'Other'},
    {posted:false},{deleted:true},{documentCurrency:'USDT'},{documentAmount:NaN},{documentAmount:-1}]){
    assert.equal(match([{...payment,...patch}]).get(plan.id)!.issuedAmount,0);
  }
  for(const patch of [{createdAt:undefined},{status:'SUBMITTED'},{status:'CANCELLED'},{paymentMethod:'USDT'}]){
    assert.equal(match([payment],[{...plan,...patch}]).get(plan.id)!.issuedAmount,0);
  }
});
test('duplicates cannot multiply cash; conflicting copies and removal reopen derived closure',()=>{
  assert.equal(match([payment,payment]).get(plan.id)!.issuedAmount,42500);
  assert.equal(match([payment,{...payment,documentAmount:40000}]).get(plan.id)!.issuedAmount,0);
  assert.equal(match([]).get(plan.id)!.state,'NO_EVIDENCE');
});
test('an earlier paid supplier request releases the next request only with current proof',()=>{
  const first={...plan,id:'earlier',plannedAmount:10000,createdAt:'2026-09-01T00:00:00Z'};
  const deposit={...payment,ref:'deposit',date:'20.09.2026 12:00:00',documentAmount:10000};
  const result=match([payment,deposit],[plan,first]);
  assert.equal(result.get(first.id)!.issuedAmount,10000);assert.equal(result.get(plan.id)!.issuedAmount,42500);
  assert.equal(match([payment,{...deposit,posted:false}],[plan,first]).get(plan.id)!.issuedAmount,0);
});
test('already completed request does not swallow subsequent supplier payments',()=>{
  const later={...payment,ref:'later',date:'02.10.2026 12:00:00'};
  const result=match([later,payment]).get(plan.id)!;
  assert.equal(result.issuedAmount,42500);assert.deepEqual(result.cashOrders.map(row=>row.ref),['rko']);
});
