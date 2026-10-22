import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleCommand,paymentDeferral,onlyPaymentDateChanged,activePaymentDeferral,paymentPreparationDate,paymentScheduleLabel} from '../lib/procurement-schedule';
const version='2026-10-22T08:00:00.000Z',today='2026-10-22';
test('strict commands reject financial injection, impossible dates and stale calendar dates',()=>{
 const valid={action:'RESCHEDULE',version,date:'2026-10-23'};
 assert.equal(scheduleCommand(valid,today).date,'2026-10-23');
 for(const patch of [{date:'2026-02-30'},{date:'2026-10-21'},{date:'2026-13-01'},{plannedAmount:1},{orderRefs:[]},{version:''},{comment:'a'.repeat(501)}])assert.throws(()=>scheduleCommand({...valid,...patch},today));
});
test('deferral may omit the date; resume requires an explicit current date',()=>{
 assert.equal(scheduleCommand({action:'DEFER',version},today).date,'');
 assert.throws(()=>scheduleCommand({action:'RESUME',version},today));
 assert.throws(()=>scheduleCommand({action:'RESUME',version,date:'2026-10-20'},today));
 assert.equal(scheduleCommand({action:'RESUME',version,date:today},today).date,today);
 assert.throws(()=>scheduleCommand({action:'RESUME',version,date:today,comment:'change'},today));
 assert.equal(paymentDeferral({fundingDeferral:{date:'2026-02-30',comment:'',changedAt:version,actorId:1}}),null);
 const stored={date:null,comment:'',changedAt:version,actorId:1};
 assert.deepEqual(paymentDeferral({fundingDeferral:stored}),stored);
});
test('date-only UI routing never accepts an amount, basis or comment edit',()=>{
 const before={plannedDate:today,plannedAmount:'100',orderRefs:['a'],condition:'old'};
 assert.ok(onlyPaymentDateChanged(before,{...before,plannedDate:'2026-10-23'}));
 for(const patch of [{plannedAmount:'101'},{orderRefs:['b']},{condition:'new'}])assert.equal(onlyPaymentDateChanged(before,{...before,plannedDate:'2026-10-23',...patch}),false);
 assert.equal(onlyPaymentDateChanged(before,before),false);
});
test('deferral has a separate effective date without overwriting original terms or partial payment',()=>{
 const plan={status:'APPROVED',plannedDate:'2026-10-10T00:00:00.000Z',evidence:{state:'PARTIALLY_ISSUED',issuedAmount:300},oneCCashEvidence:{fundingDeferral:{date:null,comment:'',changedAt:version,actorId:1}}};
 const before=JSON.stringify(plan);
 assert.equal(paymentPreparationDate(plan),null);
 assert.equal(paymentScheduleLabel(plan),'Оплата отложена');
 assert.equal(JSON.stringify(plan),before);
 const dated={...plan,oneCCashEvidence:{fundingDeferral:{...plan.oneCCashEvidence.fundingDeferral,date:'2026-10-25'}}};
 assert.equal(paymentPreparationDate(dated),'2026-10-25');
 assert.equal(paymentPreparationDate({...dated,plannedDate:'2026-10-27'}),'2026-10-27');
 assert.equal(paymentPreparationDate({...dated,plannedDate:'2026-10-23'}),'2026-10-25');
 assert.equal(paymentPreparationDate({...plan,plannedDate:'2026-10-27'}),null);
 for(const status of ['CANCELLED','COMPLETED_WITHOUT_TOPUP','SUBMITTED'])assert.equal(activePaymentDeferral({...plan,status}),null);
 for(const state of ['PAID_BY_ONE_C','ISSUED_BY_ONE_C','SMALL_REMAINDER_COMPLETED'])assert.equal(activePaymentDeferral({...plan,evidence:{state}}),null);
 for(const state of ['MISMATCH','SOURCE_UNAVAILABLE','NEEDS_REVIEW'])assert.equal(paymentScheduleLabel({...plan,evidence:{state}}),'');
 assert.equal(paymentPreparationDate({...plan,oneCCashEvidence:{fundingDeferral:null}}),'2026-10-10');
});
