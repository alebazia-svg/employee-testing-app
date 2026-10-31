import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewDaySources } from '../lib/payroll-day-review-sources';
const person={id:8,name:'Хурзокова Лиана',payrollName:'Хурзокова Лиана',role:'EMPLOYEE',isActive:true,portalArea:'WORKDAY'};
const row=(timestamp:string)=>({employee:'Лиана',timestamp,date:timestamp.slice(0,10),action:'Начало рабочего дня',time:'09:00',shift:'09:00–19:00',comment:''});
const fixture={periodKey:'2026-11',through:'2026-11-03',users:[person],googleRows:[row('01.11.2026 09:00:00'),row('01.11.2026 09:01:00'),row('2026-11-02T09:00:00'),row('2026-11-04T09:00:00')],formSummaries:[{employee:'Лиана',formRows:2,uniqueFormDates:3,workedDays:3,lateCount:0}],appSources:[{userId:8,employee:person.name,fromDate:'2026-10-25',googleDays:2,appDays:2,overlapDays:1,googleFallbackDates:['2026-11-01'],overlapDates:['2026-11-02'],appDates:['2026-11-02','2026-11-03']}],dianaDates:[]};
test('dated provenance unions aliases and overlapping Google/PWA dates within the source window',()=>{
 const before=JSON.stringify(fixture);
 assert.deepEqual(buildReviewDaySources(fixture),[{userId:8,employee:person.name,sourceEmployee:'Лиана',kind:'form',dates:['2026-11-01','2026-11-02','2026-11-03']}]);
 assert.equal(JSON.stringify(fixture),before);
});
test('provenance refuses a count mismatch and never binds ambiguous employee names',()=>{
 assert.throws(()=>buildReviewDaySources({...fixture,formSummaries:[{...fixture.formSummaries[0],uniqueFormDates:4}]}));
 assert.deepEqual(buildReviewDaySources({...fixture,users:[person,{...person,id:9}]}),[]);
});


test('complete refresh explicitly records a zero-date source before the first mark',()=>{
 const result=buildReviewDaySources({...fixture,googleRows:[],formSummaries:[],appSources:[]});
 assert.equal(result.length,1);assert.deepEqual(result[0].dates,[]);assert.equal(result[0].userId,8);
});
