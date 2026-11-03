import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { payrollDraftForAutomaticEstimate, validatePayrollDraft } from '../lib/payroll-draft';
import { isPayrollSourceSyncEligible } from '../lib/payroll-source-sync-store';

const now=new Date('2026-11-03T12:00:00Z');
test('current-month preview uses blank transient inputs without creating an ADMIN revision',()=>{
 const result=payrollDraftForAutomaticEstimate('2026-11',null,now);
 assert.equal(result?.revision,0);
 assert.deepEqual(result?.payload,validatePayrollDraft({manual:{},fixed:{},purchase:{advance:'',deduction:'',comment:''},bonuses:[]}));
 assert.equal(payrollDraftForAutomaticEstimate('2026-10',null,now),null);
 assert.equal(payrollDraftForAutomaticEstimate('2026-12',null,now),null);
 const rollover=new Date('2026-12-31T21:01:00Z');
 assert.ok(payrollDraftForAutomaticEstimate('2027-01',null,rollover));
 assert.equal(payrollDraftForAutomaticEstimate('2026-12',null,rollover),null);
});
test('saved corrections, zero, deductions and bonuses always retain authority and identity',()=>{
 const saved={revision:8,payload:{manual:{'Абшаева Зухра':{workedDays:'0',lateCount:'1',advance:'1000',comment:'Правка',source:'manualCorrection'}},fixed:{},purchase:{advance:'',deduction:'50',comment:''},bonuses:[{id:'bonus',employeeName:'Абшаева Зухра',amount:'1000',reason:'Премия'}]}};
 const before=JSON.stringify(saved);
 for(const month of ['2026-10','2026-11','2026-12'])assert.equal(payrollDraftForAutomaticEstimate(month,saved,now),saved);
 assert.equal(JSON.stringify(saved),before);
});
function db(options:{period?:boolean;closed?:boolean;final?:boolean;draft?:boolean}={}) {
 const calls:string[]=[];
 const client={payrollPeriod:{findUnique:async()=>{calls.push('period-read');return options.period===false?null:{status:options.closed?'CLOSED':'OPEN'};}},payrollRun:{count:async()=>{calls.push('final-read');return options.final?1:0;}},payrollDraftRevision:{count:async()=>{calls.push('draft-read');return options.draft?1:0;}}};
 return {client:client as unknown as PrismaClient,calls};
}
test('hourly refresh includes current month without period/draft and still excludes FINAL/CLOSED',async()=>{
 for(const period of [false,true]) {
  const source=db({period});assert.equal(await isPayrollSourceSyncEligible('2026-11',source.client,now),true);
  assert.deepEqual(source.calls,['period-read','final-read']);
 }
 for(const options of [{closed:true},{final:true}])assert.equal(await isPayrollSourceSyncEligible('2026-11',db(options).client,now),false);
 assert.equal(await isPayrollSourceSyncEligible('2026-10',db().client,now),false);
 assert.equal(await isPayrollSourceSyncEligible('2026-10',db({draft:true}).client,now),true);
 assert.equal(await isPayrollSourceSyncEligible('2026-10',db({period:false,draft:true}).client,now),false);
});
