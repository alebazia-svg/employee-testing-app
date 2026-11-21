import test from 'node:test';
import assert from 'node:assert/strict';
import {matchProcurementPaymentEvidence as match, type EvidencePlan} from '../lib/procurement-currency-payment-evidence';
import {type PaymentConfirmation} from '../lib/procurement-confirmed-payment';
import {paymentFingerprint} from '../lib/procurement-manual-payment-links';
import type {SupplierCurrencyPaymentRow as Rko} from '../lib/procurement-currency-payment-source';
import {paymentEvidenceView} from '../lib/procurement-evidence-continuity';

const advance: EvidencePlan = {id:'advance', planCode:'PAY-A', supplierPartner:'Luxo', supplierCounterparty:'Luxo',
  orderRefs:[], plannedAmount:369572.72, foreignAmount:4199.69, paymentMethod:'USDT', status:'APPROVED', createdAt:'2026-11-16T19:35:42Z'};
const second = {...advance,id:'goods',planCode:'PAY-B', orderRefs:['484'],foreignAmount:6595,createdAt:'2026-11-12T07:28:18Z'};
const original: Rko = {ref:'abc',number:'002114',date:'16.11.2026 22:40:34',posted:true,deleted:false,documentCurrency:'USDT',
  documentAmount:4199.69,baseDocumentRef:'',supplier:'Luxo',counterparty:'Luxo',registerContractBasis:{versionToken:'1',contracts:[{ref:'native',name:'Luxo Knit Kris'}]}};
for (const currency of ['USDT','РУБ']) {
  const owner=currency==='USDT'?advance:{...advance,paymentMethod:'CASH',plannedAmount:4199.69,foreignAmount:null};
  const rko={...original,documentCurrency:currency};
  const run=(plans:EvidencePlan[],rows:Rko[],confirmations:PaymentConfirmation[]=[])=>match(plans,[],rows,[],{allowSmallRemainder:true,confirmations});
  function confirm(row=rko) {
    const found:PaymentConfirmation[]=[];
    run([owner,{...second,status:'SUBMITTED'}],[row,row],found);
    assert.equal(found.length,1);
    return {...owner,oneCCashEvidence:{confirmedSupplierPayments:found.map(f=>f.payment)}};
  }
  function amount(row:ReturnType<typeof run> extends Map<string,infer V>? V:never) {return row.paidForeignAmount+row.issuedAmount;}
  test(currency+' confirmed before later approval; globally unique after reload, duplicate and reorder',()=>{
    const linked=confirm();
    for(const plans of [[second,linked],[linked,second]]){
      const fresh:PaymentConfirmation[]=[];
      const result=run(plans,[rko,rko],fresh);
      assert.equal(amount(result.get(owner.id)!),4199.69);
      assert.equal(amount(result.get(second.id)!),0);
      assert.deepEqual(fresh,[]);
      assert.equal(result.get(owner.id)!.manualPaymentCount,0);
    }
    const initial:PaymentConfirmation[]=[];
    assert.equal(amount(run([owner,second],[rko],initial).get(owner.id)!),0);
    assert.deepEqual(initial,[]);
  });
  test(currency+' partial payment keeps actual amount during a pending revision and explicit completion',()=>{
    const partial={...rko,documentAmount:2200};
    const linked=confirm(partial);
    for (const plan of [{...linked,hasPendingRevision:true},{...linked,status:'COMPLETED_WITHOUT_TOPUP',completedPaymentRefs:[rko.ref]}]) {
      const result=run([plan,second],[partial]);
      assert.equal(amount(result.get(plan.id)!),2200);
      assert.equal(amount(result.get(second.id)!),0);
    }
  });
  test(currency+' corrected, missing, unposted, conflicting or deleted payment goes to review, isolated from other suppliers',()=>{
    const linked=confirm(),other={...owner,id:'other',planCode:'OTHER',supplierPartner:'Other',supplierCounterparty:'Other'};
    const validOther={...rko,ref:'xyz',supplier:'Other',counterparty:'Other'};
    for(const rows of [[],[{...rko,posted:false}],[{...rko,deleted:true}],[{...rko,documentAmount:1}],
      [rko,{...rko,documentAmount:2}],[{...rko,settlementOrderRef:'484'}],[{...rko,supplier:'Other',counterparty:'Other'}]]) {
      const result=run([linked,second,other],[...rows,validOther]);
      const issue=result.get(owner.id)!;
      assert.equal(issue.state,'NEEDS_REVIEW');
      assert.ok(issue.paymentReviewReasons?.[0].message.includes(rko.number));
      assert.equal(amount(issue),0);
      assert.equal(amount(result.get(second.id)!),0);
      assert.equal(amount(result.get(other.id)!),4199.69);
      assert.equal(paymentEvidenceView({...linked,updatedAt:new Date()},issue,false,'').paymentReviewReasons,undefined);
    }
  });
  test(currency+' current manual assignment takes precedence; removed automatic identity cannot decide an ambiguity',()=>{
    const linked=confirm();
    const target={...second,paymentMethod:owner.paymentMethod,manualRubleLinks:[{ref:rko.ref,fingerprint:paymentFingerprint(rko)}]};
    const result=run([linked,target],[rko]);
    assert.equal(amount(result.get(target.id)!),4199.69);
    assert.equal(amount(result.get(owner.id)!),0);
    assert.equal(amount(run([owner,second],[rko]).get(owner.id)!),0);
  });
}

test('native order splits, excess amounts and unverified sources do not create new ownership',()=>{
  const plans=[{...advance,id:'one',orderRefs:['484'],foreignAmount:2000},{...advance,id:'two',orderRefs:['484'],foreignAmount:2199.69}];
  const confirmations:PaymentConfirmation[]=[];
  const rows=match(plans,[],[{...original,baseDocumentRef:'484'}],[],{allowSmallRemainder:true,confirmations});
  assert.equal(rows.get('one')!.paidForeignAmount+rows.get('two')!.paidForeignAmount,4199.69);
  assert.deepEqual(confirmations,[]);
  match([advance],[],[{...original,documentAmount:4200}],[],{allowSmallRemainder:true,confirmations});
  match([advance],[],[{...original,registerContractBasis:undefined}],[],{allowSmallRemainder:true,confirmations});
  assert.deepEqual(confirmations,[]);
});
