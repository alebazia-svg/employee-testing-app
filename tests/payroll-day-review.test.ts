import assert from 'node:assert/strict';
import test from 'node:test';
import {reviewDates,applyApprovedPayrollDays,validDaySources,validDayReviewPeriod} from '../lib/payroll-day-review';
import {payrollRequiredAction,pendingPayrollDayAction,openPayrollAfterDayReview} from '../lib/employee-payroll-access';
import {readEmployeePayroll} from '../lib/employee-payroll-read';
import {validEmployeePayrollView,rememberEmployeePayroll} from '../lib/employee-payroll-view';
const source={userId:6,employee:'Кумахова Диана',sourceEmployee:'Диана',kind:'schedule' as const,dates:['2026-10-20']};
const raw={version:1 as const,period:{periodKey:'2026-10',monthIndex:9,year:2026},attendanceMode:'google-sheets' as const,attendanceMessage:'',scheduleMode:'google-sheets' as const,scheduleMessage:'',formSummaries:[],scheduleSummaries:[{employee:'Диана',scheduleDays:1},{employee:'Другой',scheduleDays:10}],dayReviewSources:[source]};
test('date validation rejects current/future, duplicates, invalid days, wrong months and pre-policy dates',()=>{
 for(const d of [[],['2026-10-31'],['2026-11-01'],['2026-10-32'],['2026-09-30'],['2026-10-20','2026-10-20']])assert.throws(()=>reviewDates(d,'2026-10','2026-10-31','2026-10-01'));
 assert.throws(()=>reviewDates(['2026-10-30'],'2026-10','2026-11-01','2026-10-31'));
 assert.deepEqual(reviewDates(['2026-10-22','2026-10-20'],'2026-10','2026-10-31','2026-10-01'),['2026-10-20','2026-10-22']);
});
test('approval union is immutable, idempotent over raw sources and isolated to employee',()=>{
 const review={employeeId:6,payrollName:source.employee,periodKey:'2026-10',dates:['2026-10-20','2026-10-21']};
 const before=JSON.stringify(raw),next=applyApprovedPayrollDays(raw,[review,review]);assert.equal(next.scheduleSummaries[0].scheduleDays,2);assert.equal(next.scheduleSummaries[1].scheduleDays,10);assert.equal(JSON.stringify(raw),before);
 assert.throws(()=>applyApprovedPayrollDays({...raw,dayReviewSources:undefined},[review]));
 assert.throws(()=>applyApprovedPayrollDays(raw,[{...review,employeeId:7}]));
 assert.throws(()=>applyApprovedPayrollDays({...raw,scheduleSummaries:[{employee:'Диана',scheduleDays:2}]},[review]));
 assert.equal(validDaySources([{...source,dates:['2026-10-32']}],'2026-10'),false);
});
const input={today:'2026-11-01',tomorrow:'2026-11-02',planned:[{date:'2026-11-01',status:'off'},{date:'2026-11-02',status:'off'}],workDays:[] as {date:string;startedAt:Date;endedAt:Date|null;status:string}[],approvedDates:[] as string[],vacationDates:[] as string[],requireStart:true};
test('day off only grants access after obligations; older-than-cutover marks never block',()=>{
 assert.equal(payrollRequiredAction(input),null);
 assert.equal(payrollRequiredAction({...input,planned:[...input.planned,{date:'2026-10-30',status:'working'}]}),null);
 const withMissing={...input,planned:[...input.planned,{date:'2026-10-31',status:'working'}]};
 assert.equal(payrollRequiredAction(withMissing)?.kind,'days_review');
 assert.equal(payrollRequiredAction({...withMissing,approvedDates:['2026-10-31']}),null);
 assert.equal(payrollRequiredAction({...input,planned:[]})?.kind,'schedule');
 assert.equal(payrollRequiredAction({...input,planned:[],vacationDates:[input.today,input.tomorrow]}),null);
});
test('workday start gate is independent of time; current finish is not requested prematurely',()=>{
 const working={...input,planned:[{date:input.today,status:'working'},{date:input.tomorrow,status:'off'}]};
 assert.equal(payrollRequiredAction(working)?.kind,'start');
 for(const time of ['00:01','09:00','14:30','23:59']) assert.equal(payrollRequiredAction({...working,workDays:[{date:input.today,startedAt:new Date(input.today+'T'+time+':00+03:00'),endedAt:null,status:'active'}]}),null);
 const past={date:'2026-10-31',startedAt:new Date('2026-10-31T09:00:00+03:00'),endedAt:null,status:'active'};
 assert.equal(payrollRequiredAction({...input,workDays:[past]})?.kind,'finish');
 assert.equal(payrollRequiredAction({...input,workDays:[past],approvedDates:[past.date]}),null);
});
test('private API returns an action before salary calculation; historical FINAL bypasses access rule',async()=>{
 const action=payrollRequiredAction({...input,planned:[]})!;
 const viewer={id:6,role:'EMPLOYEE',isActive:true,portalArea:'WORKDAY'};
 const result=await readEmployeePayroll(viewer,new URLSearchParams(),{currentPeriod:()=> '2026-11',findFinal:async()=>null,findAccess:async()=>action,findCurrent:async()=>{throw Error('must not compute blocked salary');}});
 assert.deepEqual(result.body,{month:'2026-11',state:'requires_action',action});assert.equal(validEmployeePayrollView(result.body,'2026-11'),true);
 assert.equal(validEmployeePayrollView({...result.body,accrued:100},'2026-11'),false);
 assert.equal(validEmployeePayrollView({...result.body,action:{...action,href:'https://example.com'}},'2026-11'),false);
 const saved=rememberEmployeePayroll(new Map([['2026-11',{month:'2026-11',state:'current_estimate',estimatedAccrued:100,earnings:[{label:'Выходы',amount:100}]}]]),result.body as any,['2026-11','2026-10']);
 assert.equal(saved.get('2026-11')?.state,'requires_action');
 const confirmed=await readEmployeePayroll(viewer,new URLSearchParams('month=2026-10'),{currentPeriod:()=> '2026-11',findFinal:async()=>({status:'FINAL',period:{periodKey:'2026-10'},employeeResults:[{userId:6,grossPay:100,advance:0}]}),findAccess:async()=>{throw Error('history must remain available');},findSettlement:async()=>({accrued:100,paid:100,remaining:0})});
 assert.equal(confirmed.body.state,'confirmed');
});


test('tomorrow plan is mandatory even with today QR; off/working choices both satisfy planning',()=>{
 const today='2026-10-31',tomorrow='2026-11-01';
 const workDays=[{date:today,startedAt:new Date(today+'T09:15:00+03:00'),endedAt:null,status:'active'}];
 const base={...input,today,tomorrow,workDays,planned:[{date:today,status:'working'}]};
 const blocked=payrollRequiredAction(base);
 assert.equal(blocked?.kind,'schedule');assert.equal(blocked?.href,'/employee?tab=schedule&date=2026-11-01');
 for(const status of ['working','off'])assert.equal(payrollRequiredAction({...base,planned:[...base.planned,{date:tomorrow,status}]}),null);
 assert.equal(payrollRequiredAction({...base,workDays:[]})?.kind,'schedule','planning is requested before QR start');
 assert.equal(payrollRequiredAction({...base,planned:[{date:tomorrow,status:'off'}]})?.kind,'schedule','today must also be planned');
 assert.equal(payrollRequiredAction({...base,vacationDates:[tomorrow]}),null,'approved vacation already supplies the day status');
});


test('a refreshed explicit empty form source supports the first approved day without inventing raw marks',()=>{
 const person={userId:8,employee:'Хурзокова Лиана',sourceEmployee:'Лиана',kind:'form' as const,dates:[]};
 const input={...raw,scheduleSummaries:[],formSummaries:[],dayReviewSources:[person]};
 const review={employeeId:8,payrollName:person.employee,periodKey:'2026-10',dates:['2026-10-31']};
 assert.equal(applyApprovedPayrollDays(input,[review]).formSummaries[0].workedDays,1);
 assert.deepEqual(input.formSummaries,[]);
 assert.throws(()=>applyApprovedPayrollDays({...input,dayReviewSources:[]},[review]));
});


test('pending review replaces a repeated request prompt without unlocking salary',()=>{
 const action=payrollRequiredAction({...input,planned:[...input.planned,{date:'2026-10-31',status:'working'}]})!;
 const pending=pendingPayrollDayAction(action,['2026-10']);
 assert.equal(pending.kind,'days_review');assert.equal(pending.title,'Выходы на подтверждении');assert.equal(pending.label,'Посмотреть запрос');assert.equal(pending.href,action.href);
 assert.deepEqual(pendingPayrollDayAction(action,['2026-11']),action);
});


test('access-only approvals cannot affect payroll, including after reopening or with no financial source',()=>{
 const review={employeeId:6,payrollName:source.employee,periodKey:'2026-10',dates:['2026-10-21'],accessOnly:true};
 assert.equal(applyApprovedPayrollDays(raw,[review]),raw);
 const missing={...raw,dayReviewSources:undefined};
 assert.equal(applyApprovedPayrollDays(missing,[review]),missing);
 assert.equal(validDayReviewPeriod('2026-10','2027-02'),true);
 assert.equal(validDayReviewPeriod('2026-09','2027-02'),false);
 assert.equal(validDayReviewPeriod('2027-03','2027-02'),false);
});


test('approval opens salary automatically without looping over an older partial approval',()=>{
 assert.equal(openPayrollAfterDayReview({latestId:'approved',latestStatus:'approved',reviewRequired:false}),true);
 assert.equal(openPayrollAfterDayReview({latestId:'approved',latestStatus:'approved',pendingId:'approved',reviewRequired:true}),true,'decision received on waiting screen opens current calculation once');
 assert.equal(openPayrollAfterDayReview({latestId:'approved',latestStatus:'approved',reviewRequired:true}),false,'re-entering remaining days opens editor rather than redirecting in a loop');
 assert.equal(openPayrollAfterDayReview({latestId:'old',latestStatus:'approved',pendingId:'other',reviewRequired:true}),false);
 for(const latestStatus of ['pending','rejected','cancelled',undefined])assert.equal(openPayrollAfterDayReview({latestId:'request',latestStatus,pendingId:'request',reviewRequired:false}),false);
});


test('schedule message names only missing days and respects vacation across the month boundary',()=>{
 const today='2026-10-31',tomorrow='2026-11-01';
 const base={...input,today,tomorrow,planned:[] as {date:string;status:string}[]};
 const both=payrollRequiredAction(base)!;
 assert.equal(both.message,'Укажите рабочие и выходные дни на сегодня и завтра, чтобы посмотреть расчёт.');
 assert.equal(both.href,'/employee?tab=schedule&date='+today);
 for(const status of ['working','off']){
  const missingTomorrow=payrollRequiredAction({...base,planned:[{date:today,status}]})!;
  assert.equal(missingTomorrow.message,'Отметьте в графике завтрашний день: рабочий или выходной.');
  assert.equal(missingTomorrow.href,'/employee?tab=schedule&date='+tomorrow);
  const missingToday=payrollRequiredAction({...base,planned:[{date:tomorrow,status}]})!;
  assert.equal(missingToday.message,'Отметьте в графике сегодняшний день: рабочий или выходной.');
  assert.equal(missingToday.href,'/employee?tab=schedule&date='+today);
 }
 assert.equal(payrollRequiredAction({...base,vacationDates:[today]})?.message,'Отметьте в графике завтрашний день: рабочий или выходной.');
 assert.equal(payrollRequiredAction({...base,vacationDates:[tomorrow]})?.message,'Отметьте в графике сегодняшний день: рабочий или выходной.');
 assert.equal(payrollRequiredAction({...base,vacationDates:[today,tomorrow]}),null);
});
