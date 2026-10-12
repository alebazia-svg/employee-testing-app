import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buyerInitialView} from '../lib/procurement-buyer-initial-view';
import {paymentEvidenceIdentity} from '../lib/procurement-evidence-continuity';
import type {AdminPlans} from '../lib/procurement-admin-plans';
const now=new Date('2026-10-12T10:00:00Z');
const make=(id:string,managerUserId:number):any=>({id,planCode:id,managerUserId,manager:{name:'Test',oneCManagerName:'Test'},
  supplierPartner:'Supplier',supplierCounterparty:'',orderRefs:['order'],orderNumbers:['425'],condition:'',
  plannedAmount:'10000',foreignAmount:null,currency:'RUB',paymentMethod:'CASH',paymentPurpose:'GOODS',
  plannedDate:now,createdAt:now,updatedAt:now,status:'APPROVED',events:[],oneCCashEvidence:{}});
test('buyer first paint contains only own stored plans; unknown balances cannot become spendable',()=>{
  const own=make('own',1),other=make('private-other',2);
  const view=buyerInitialView([own,other] as AdminPlans,1,'2026-10-12',false);
  assert.deepEqual(view.initialPlans.map(p=>p.id),['own']);
  assert.equal(view.initialPlans[0].evidence?.verification,'unavailable');
  assert.equal(view.sourceRefreshing,true);assert.equal(view.evidenceSourceError,true);
  assert.equal(view.supplierDebtTotal,null);assert.equal(view.usdtBalance.balance,null);assert.equal(view.otherUsdtReserve,null);
  assert.equal(JSON.stringify(view).includes('private-other'),false);
});
test('previous confirmed paid state stays history-only, without stale cash collection permission',()=>{
  const own=make('paid',1);
  own.oneCCashEvidence.lastCompletePaymentView={version:1,identity:paymentEvidenceIdentity(own),readStartedAt:now.toISOString(),verifiedAt:now.toISOString(),
    evidence:{state:'ISSUED_BY_ONE_C',issuedAmount:10000,paidAmount:0,paidForeignAmount:0,cashOrders:[],currencyPayments:[],collection:{state:'ready'}}};
  const view=buyerInitialView([own] as AdminPlans,1,'2026-10-12',false);
  assert.equal(view.initialPlans[0].evidence?.state,'ISSUED_BY_ONE_C');
  assert.equal(view.initialPlans[0].evidence?.verification,'last-confirmed');
  assert.equal(view.initialPlans[0].evidence?.collection,undefined);
});
test('buyer streams live sources, preserves form instance and keeps captured edit version',()=>{
  const page=readFileSync('app/(dashboard)/procurement/page.tsx','utf8');
  const stream=readFileSync('app/(dashboard)/procurement/ProcurementCalendarStream.tsx','utf8');
  const client=readFileSync('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx','utf8');
  assert.ok(page.indexOf("user.role!=='EMPLOYEE'")<page.indexOf('await readAdminPlans()'));
  assert.ok(page.includes('<Suspense fallback={null}>'));
  assert.ok(page.includes('sameAdminPlanVersions(initialPlans,latest)'));
  assert.ok(stream.includes('value.generation===current.current'));
  assert.ok(!stream.includes('<Calendar key='));
  assert.ok(client.includes('setEditingVersion(plan.updatedAt)'));
  assert.ok(client.includes('version: editingVersion'));
  assert.ok(client.includes('pauseWhileDialogOpen'));
});
