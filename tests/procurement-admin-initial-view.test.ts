import test from 'node:test';
import assert from 'node:assert/strict';
import {adminInitialView} from '../lib/procurement-admin-initial-view';
import {paymentEvidenceIdentity} from '../lib/procurement-evidence-continuity';
import type {AdminPlans} from '../lib/procurement-admin-plans';
import {sameAdminPlanVersions} from '../lib/procurement-admin-plans';

const now=new Date('2026-10-11T08:00:00Z');
function plan(id='paid') {
  return {id,planCode:id,managerUserId:1,manager:{name:'Test',oneCManagerName:'Test'},
    supplierPartner:'Supplier',supplierCounterparty:'',orderRefs:['order'],orderNumbers:['425'],
    plannedAmount:'100000',foreignAmount:null,currency:'RUB',paymentMethod:'CASH',paymentPurpose:'ORDER',
    plannedDate:now,createdAt:now,updatedAt:now,status:'APPROVED',events:[],oneCCashEvidence:{} as any};
}
function cached(p=plan()) {
  p.oneCCashEvidence.lastCompletePaymentView={version:1,identity:paymentEvidenceIdentity(p),
    readStartedAt:now.toISOString(),verifiedAt:now.toISOString(),evidence:{
      state:'ISSUED_BY_ONE_C',issuedAmount:100000,paidAmount:0,paidForeignAmount:0,
      remainingAmount:0,remainingForeignAmount:null,actualExchangeRate:null,
      cashOrders:[{ref:'paid-rko',number:'RKO-1',date:'11.10.2026',amount:100000}],currencyPayments:[],
      collection:{state:'ready'},
    }};
  return p;
}
const view=(rows:ReturnType<typeof plan>[])=>adminInitialView(rows as unknown as AdminPlans,'2026-10-11');

test('initial display uses confirmed paid evidence without manufacturing fresh authority',()=>{
  const p=cached(),before=JSON.stringify(p),v=view([p]);
  assert.equal(v.initialPlans[0].evidence.state,'ISSUED_BY_ONE_C');
  assert.equal(v.initialPlans[0].evidence.issuedAmount,100000);
  assert.equal(v.initialPlans[0].evidence.verification,'last-confirmed');
  assert.equal(v.initialPlans[0].evidence.collection,undefined);
  assert.equal(v.refreshState,'loading');assert.equal(v.forecastInput,undefined);
  assert.equal(v.usdtBalance.balance,null);assert.equal(v.accountableBalance.balance,null);
  assert.equal(v.forecast30Days.coverageReady,false);
  assert.equal(v.paymentLinks,undefined);assert.equal(v.revisionReview,undefined);
  assert.equal(v.sourceCheckedAt,now.toISOString());assert.equal(JSON.stringify(p),before);
});
test('missing or invalid cached proof remains unknown, not unpaid or zero supplier debt',()=>{
  const changed=cached();changed.plannedAmount='200000';
  for(const p of [plan('new'),changed]) {
    const v=view([p]);assert.equal(v.initialPlans[0].evidence.state,'SOURCE_UNAVAILABLE');
    assert.equal(v.initialPlans[0].evidence.verification,'unavailable');
    assert.equal(v.supplierDebtTotal,null);assert.equal(v.sourceCheckedAt,'');
  }
});
test('submitted and manually completed requests keep their business status, IDs and events',()=>{
  const rows=[{...plan('pending'),status:'SUBMITTED'},{...plan('manual'),status:'COMPLETED_WITHOUT_TOPUP'}];
  const result=view(rows);assert.deepEqual(result.initialPlans.map(p=>[p.id,p.status]),rows.map(p=>[p.id,p.status]));
  assert.equal(result.initialPlans[0].plannedDate,now.toISOString());
});
test('late reconciliation rejects edited, added and deleted requests, but not a reordered list',()=>{
  const a=plan('a'),b=plan('b');
  assert.equal(sameAdminPlanVersions([a,b],[b,a]),true);
  assert.equal(sameAdminPlanVersions([a,b],[a,{...b,updatedAt:new Date(now.getTime()+1)}]),false);
  assert.equal(sameAdminPlanVersions([a,b],[a]),false);
  assert.equal(sameAdminPlanVersions([a],[a,b]),false);
});
