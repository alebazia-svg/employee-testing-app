import test from 'node:test';
import assert from 'node:assert/strict';
import {captureCashRecountWithRetry} from '../lib/cash-recount-capture';
import {taskBusinessState} from '../app/(dashboard)/admin/workday/AdminShiftControlDetails';
const failed={personalCash:{status:'unavailable',error:'Request timed out'}};
test('one immediate retry can capture the balance; uses the same bounded deadline',async()=>{
 let calls=0,time=0;const deadlines:number[]=[];
 const result=await captureCashRecountWithRetry(async deadline=>{deadlines.push(deadline);calls++;time+=1000;return calls===1?failed:{personalCash:{status:'captured',error:null},balance:11750};},()=>time);
 assert.equal(calls,2);assert.deepEqual(deadlines,[4000,4000]);assert.equal(result.personalCash.status,'captured');
});
test('success, configuration errors and exhausted budget do not cause extra reads',async()=>{
 for(const scenario of ['captured','configuration','deadline']){
  let calls=0,time=0;
  await captureCashRecountWithRetry(async()=>{calls++;time=scenario==='deadline'?4000:0;return scenario==='captured'?{personalCash:{status:'captured',error:null}}:scenario==='configuration'?{personalCash:{status:'unavailable',error:'Касса сотрудника не привязана к 1С.'}}:failed;},()=>time);
  assert.equal(calls,1);
 }
});
test('repeated outage stops at two attempts and retains unavailable status',async()=>{
 let calls=0;const result=await captureCashRecountWithRetry(async()=>{calls++;return failed;});assert.equal(calls,2);assert.equal(result,failed);
});
const item=(checks:any[],category='cash',status='done')=>({task:{id:1,category,status,comment:'',handoverData:null},status,autoChecks:checks} as any);
const missing={status:'unavailable',historicalCashUnverified:true,summary:'Пересчёт сохранён. Сверить с 1С не удалось.'};
test('an absent historical balance stays unverified without becoming an error or a match',()=>{
 assert.equal(taskBusinessState(item([missing])).tone,'unverified');
 assert.match(taskBusinessState(item([missing])).result,/не сверено/);
 assert.equal(taskBusinessState(item([{status:'unavailable',summary:'Заявки недоступны'}])).tone,'attention');
 assert.equal(taskBusinessState(item([{status:'unavailable',summary:'Нет ОФД'}],'handover')).tone,'attention');
});
test('real discrepancy, manual confirmation and overdue work still take priority',()=>{
 assert.equal(taskBusinessState(item([missing,{status:'mismatch',summary:'Недостача 700 ₽'}])).tone,'error');
 assert.equal(taskBusinessState(item([{...missing,manualReview:{decision:'confirmed_issue'}}])).tone,'error');
 assert.equal(taskBusinessState(item([{...missing,manualReview:{decision:'confirmed_ok'}}])).tone,'normal');
 assert.equal(taskBusinessState(item([missing],'cash','missed')).tone,'attention');
 assert.equal(taskBusinessState(item([{status:'matched',summary:'Совпало'}])).tone,'normal');
});
