import test from 'node:test';
import assert from 'node:assert/strict';
import {fundingEvidenceView,fundingSourcesComplete,retainDatedBankEvidence} from '../lib/procurement-funding-view';
import {fundingScenario} from '../lib/procurement-funding-scenario';
import type {AdminForecastInput,AdminForecastSources} from '../lib/procurement-admin-forecast';
import {OWNER_MONEY_ACCOUNTS} from '../lib/procurement-cash-forecast-source';
import {buildAdminProcurementForecast} from '../lib/procurement-admin-forecast';

const input=():AdminForecastInput=>({todayKey:'2026-10-11',plansComplete:true,ordersComplete:true,
 plansWithOrderContext:[{id:'p',status:'APPROVED',supplierPartner:'Supplier',plannedDate:'2026-10-12',plannedAmount:'10000',foreignAmount:null,paymentMethod:'CASH',evidence:{state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0}}],
 scopedOrders:[],managerOrders:[],usdtBalance:{balance:100},accountableBalance:{balance:0}});
const source=():AdminForecastSources=>({asOf:'2026-10-11',checkedAt:'2026-10-11T15:00:00Z',history:null,owner:null,payroll:null,tbank:null,debts:null});

test('deferral changes forecast timing, not outstanding obligation or approval reserve',()=>{
 const i=input(),p=i.plansWithOrderContext[0];
 p.evidence={state:'PARTIALLY_ISSUED',issuedAmount:2500,paidAmount:0,remainingAmount:7500};
 const stored={date:null as string|null,comment:'',changedAt:'2026-10-11T15:00:00Z',actorId:1};
 p.oneCCashEvidence={fundingDeferral:stored};
 const before=JSON.stringify(i);
 const v=fundingEvidenceView(i,source());
 assert.equal(v.plans[0].requestedRub,'7500.00');assert.equal(v.plans[0].plannedDate,'');
 assert.equal(fundingScenario(v,['p']).rows[0].unknown,true);
 const undated=buildAdminProcurementForecast(i,source());
 assert.equal(undated.debtReserveBreakdown.approvedPlansMinor,750000);
 assert.ok(!undated.forecast30Days.rows.some(r=>r.items.some(item=>item.id==='plan:p')));
 assert.equal(JSON.stringify(i),before);
 stored.date='2026-10-24';
 const dated=buildAdminProcurementForecast(i,source());
 assert.equal(dated.debtReserveBreakdown.approvedPlansMinor,750000);
 assert.equal(dated.forecast30Days.rows.find(r=>r.items.some(item=>item.id==='plan:p'))?.date,'2026-10-24');
 assert.equal(p.plannedDate,'2026-10-12');
});

test('production view omits all completed and inactive plans without rematching',()=>{
 const i=input();for(const state of ['PAID_BY_ONE_C','ISSUED_BY_ONE_C','SMALL_REMAINDER_COMPLETED']){
   i.plansWithOrderContext[0].evidence.state=state;assert.equal(fundingEvidenceView(i,source()).plans.length,0);
 }
 i.plansWithOrderContext[0].evidence.state='NO_EVIDENCE';
 for(const status of ['CANCELLED','RETURNED','COMPLETED_WITHOUT_TOPUP']){i.plansWithOrderContext[0].status=status;assert.equal(fundingEvidenceView(i,source()).plans.length,0);}
});
test('production uses reconciled RUB remainder, not full original amount',()=>{
 const i=input();i.plansWithOrderContext[0].evidence={state:'PARTIALLY_ISSUED',issuedAmount:2500,paidAmount:1000,remainingAmount:6500};
 const before=JSON.stringify(i);assert.equal(fundingEvidenceView(i,source()).plans[0].requestedRub,'6500.00');assert.equal(JSON.stringify(i),before);
});
test('foreign partial, mismatch, stale or invalid amount never become automatic funding',()=>{
 for(const scenario of ['partial','mismatch','stale','invalid']){
  const i=input(),p=i.plansWithOrderContext[0];
  if(scenario==='partial'){p.paymentMethod='USDT';p.foreignAmount='100';p.evidence.paidAmount=2000;}
  if(scenario==='mismatch')p.evidence.state='MISMATCH';
  if(scenario==='stale')p.evidence.verification='last-confirmed';
  if(scenario==='invalid')p.plannedAmount='';
  const v=fundingEvidenceView(i,source());assert.equal(v.plans[0].requestedRub,'');assert.equal(fundingScenario(v,['p']).rows[0].unknown,true);
 }
});
test('failed source remains unknown, not zero cash or confirmed reserve',()=>{
 const i=input(),s=source(),v=fundingEvidenceView(i,s),r=fundingScenario(v,['p']);
 assert.equal(v.managerAvailable,false);assert.equal(r.managersAllowed,false);assert.equal(r.sourcesKnown,false);assert.equal(r.salaryMinor,null);
 assert.equal(fundingSourcesComplete(i,s),false);
});
test('dated bank survives outage without being promoted to a current limit',()=>{
 const previous=source();previous.datedTbank={status:'verified',statementDate:'2026-10-10',current:true,freeRemainingMinor:15000000} as NonNullable<AdminForecastSources['datedTbank']>;
 const next=source(),retained=retainDatedBankEvidence(next,previous);
 assert.equal(retained.datedTbank?.statementDate,'2026-10-10');assert.equal(retained.datedTbank?.current,false);
 assert.equal(next.datedTbank,undefined);
 const newer={...next,datedTbank:{...previous.datedTbank,statementDate:'2026-10-11'}};
 assert.equal(retainDatedBankEvidence(newer,previous),newer);
});

test('confirmed snapshot requires every reconciled owner account and complete payroll',()=>{
 const i=input(),s=source();
 s.owner={money:{accountNames:OWNER_MONEY_ACCOUNTS.map(a=>a.name),positions:OWNER_MONEY_ACCOUNTS.map((_,n)=>({bucketId:String(n),currency:'RUB',balanceMinor:10000,observedOn:s.asOf,verified:true})),complete:false,warnings:['new_owner_account_needs_mapping'],currencyAssumedRubles:true}} as NonNullable<AdminForecastSources['owner']>;
 s.payroll={sourceComplete:true} as NonNullable<AdminForecastSources['payroll']>;
 s.manager={checkedAt:'now',cashboxes:[],extraCash:[],unassignedCount:0,unassignedAmount:0,reviewCount:0,excludedCount:0};
 assert.equal(fundingSourcesComplete(i,s),true);
 for(const fault of ['missing','duplicate','unverified','warning','payroll','stale','date']){
  const broken=structuredClone(s),changed=structuredClone(i);
  const money=broken.owner!.money!;
  if(fault==='missing')money.accountNames.pop();
  if(fault==='duplicate')money.accountNames.push(money.accountNames[0]);
  if(fault==='unverified')money.positions[0].verified=false;
  if(fault==='warning')money.warnings.push('statement_cash_incomplete');
  if(fault==='payroll')broken.payroll!.sourceComplete=false;
  if(fault==='stale')changed.plansWithOrderContext[0].evidence.verification='last-confirmed';
  if(fault==='date')broken.asOf='2026-10-10';
  assert.equal(fundingSourcesComplete(changed,broken),false,fault);
  if(['missing','duplicate','unverified','warning'].includes(fault))assert.equal(fundingScenario(fundingEvidenceView(changed,broken),['p']).sourcesKnown,false,fault);
 }
});
