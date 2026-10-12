import test from 'node:test';
import assert from 'node:assert/strict';
import {matchProcurementPaymentEvidence,type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import type {SupplierCurrencyPaymentRow} from '../lib/procurement-currency-payment-source';
import {SMALL_REMAINDER_COMPLETED} from '../lib/procurement-small-remainder';
import {needsReceiptSinceRollout} from '../lib/procurement-receipt-policy';

const plan:EvidencePlan={id:'new',planCode:'NEW',supplierPartner:'Tural',supplierCounterparty:'',orderRefs:[],plannedAmount:500032.8,
  paymentMethod:'USDT',currency:'USDT',foreignAmount:5631,status:'APPROVED',createdAt:'2026-10-12T13:35:08Z',plannedDate:'2026-10-12'};
const rub:SupplierCurrencyPaymentRow={ref:'rub-new',number:'TEST',date:'12.10.2026 16:45:12',posted:true,deleted:false,
  documentAmount:500000,documentCurrency:'РУБ',baseDocumentRef:'different-order',supplier:'Tural',contract:'Contract'};
const match=(plans=[plan],payments=[rub],complete=true)=>matchProcurementPaymentEvidence(plans,[],payments,[],{allowSmallRemainder:complete});

test('Tural cash-to-exchanger funding closes the RUB budget without inventing USDT or rate',()=>{
  const row=match().get('new')!;
  assert.equal(row.state,SMALL_REMAINDER_COMPLETED);assert.equal(row.issuedAmount,500000);
  assert.equal(row.remainingAmount,32.8);assert.equal(row.paidForeignAmount,0);assert.equal(row.paidAmount,0);
  assert.equal(row.actualExchangeRate,null);assert.deepEqual(row.currencyPayments,[]);
  assert.deepEqual(row.cashOrders.map(p=>p.ref),['rub-new']);
  assert.equal(plan.paymentMethod,'USDT');assert.equal(plan.foreignAmount,5631);
  assert.equal(needsReceiptSinceRollout({...plan,evidence:row},0),true);
  assert.equal(needsReceiptSinceRollout({...plan,evidence:row},1),false);
  assert.equal(match([plan],[rub],false).get('new')!.state,'PARTIALLY_ISSUED');
});

test('older paid USDT request does not block new RUB funding or lose its payment history',()=>{
  const older={...plan,id:'older',planCode:'OLDER',orderRefs:['old-order'],plannedAmount:700000,foreignAmount:7865.17,createdAt:'2026-09-09T16:42:49Z',plannedDate:'2026-09-11'};
  const wallet={...rub,ref:'wallet-old',date:'11.09.2026 15:00:00',documentCurrency:'USDT',documentAmount:7865.17,baseDocumentRef:'old-order'};
  const before=match([older],[wallet]).get('older');
  const result=match([older,plan],[wallet,rub]);
  assert.deepEqual(result.get('older'),before);
  assert.equal(result.get('older')!.state,'PAID_BY_ONE_C');
  assert.equal(result.get('new')!.state,SMALL_REMAINDER_COMPLETED);
  assert.equal(result.get('new')!.cashOrders.length,1);
});

test('RUB-funded foreign requests keep the agreed limits and pending revision guard',()=>{
  for(const [total,paid,closed] of [[50000,49500,true],[49999,49499,false],[100000,99499.99,false],[1000,990,true],[1000,989,false]] as const){
    const result=match([{...plan,plannedAmount:total}],[{...rub,documentAmount:paid}]).get('new')!;
    assert.equal(result.state===SMALL_REMAINDER_COMPLETED,closed);
  }
  assert.equal(match([{...plan,hasPendingRevision:true}]).get('new')!.state,'PARTIALLY_ISSUED');
  assert.equal(match([plan],[{...rub,documentAmount:500032.8}]).get('new')!.state,'ISSUED_BY_ONE_C');
});

test('missing proof, cancellation, wrong supplier, old receipt or ambiguous requests never close',()=>{
  for(const payment of [{...rub,contract:'',baseDocumentRef:''},{...rub,posted:false},{...rub,deleted:true},
    {...rub,supplier:'Other'},{...rub,date:'12.10.2026 15:00:00'},{...rub,documentAmount:490000}]){
    assert.notEqual(match([plan],[payment]).get('new')!.state,SMALL_REMAINDER_COMPLETED);
  }
  const ambiguous=match([plan,{...plan,id:'other',planCode:'OTHER'}]);
  assert.equal(ambiguous.get('new')!.issuedAmount,0);
  assert.equal(ambiguous.get('new')!.state,'NEEDS_REVIEW');
  assert.equal(match([plan],[]).get('new')!.state,'NO_EVIDENCE');
});

test('mixed wallet transfer and RUB funding cannot silently double-count the same request',()=>{
  const orderPlan={...plan,orderRefs:['order'],foreignAmount:6000};
  const wallet={...rub,ref:'wallet',documentCurrency:'USDT',documentAmount:1000,baseDocumentRef:'order',date:'12.10.2026 16:40:00'};
  const row=match([orderPlan],[wallet,{...rub,baseDocumentRef:'order'}]).get('new')!;
  assert.equal(row.state,'NEEDS_REVIEW');assert.equal(row.rubleAllocationNeedsReview,true);
  assert.equal(row.paidForeignAmount,1000);assert.equal(row.issuedAmount,0);
});
