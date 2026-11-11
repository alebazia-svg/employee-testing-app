import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergePayrollAttendanceSources, PAYROLL_APP_ATTENDANCE_CUTOVERS} from '../lib/payroll-attendance-source';
import {buildPurchasePayrollRow, type PayrollAttendancePreviewResponse} from '../lib/payroll-calculation-engine';
import {purchasePayrollAttendance} from '../lib/payroll-purchase-attendance';
import {payrollDisplayName} from '../lib/payroll-display-name';
import {FILM_TRAINEE_NAME, isFilmTrainee, getPayrollServicePercent} from '../lib/payroll-trainee';
const rule=PAYROLL_APP_ATTENDANCE_CUTOVERS.filter(r=>r.userId===10);
const name='Тохов Астемир';
const day=(date:string,qr=true,status='completed')=>({userId:10,date,status,startedAt:new Date(date+'T06:00:00Z'),qrAcceptedAt:qr?new Date(date+'T06:00:00Z'):null});
const google=(date:string)=>({employee:'Астемир',date,timestamp:date+' 09:00:00',time:'09:00',action:'Начало рабочего дня',shift:'',comment:''});
function merged(){return mergePayrollAttendanceSources({periodKey:'2026-11',throughDate:'2026-11-11',cutovers:rule,appUsers:[{id:10,name,payrollName:name,workDays:[day('2026-11-01'),day('2026-11-02',true,'missing_checkout'),day('2026-11-03',false),day('2026-11-05',true,'cancelled')]}],googleRows:[google('2026-11-01'),google('2026-11-04')]});}
function attendance():PayrollAttendancePreviewResponse{const v=merged();return {period:{periodKey:'2026-11',monthIndex:10,year:2026},attendanceMode:'google-sheets',attendanceMessage:'',scheduleMode:'google-sheets',scheduleMessage:'',formSummaries:v.formSummaries,scheduleSummaries:[],attendanceSources:v.sources,snapshot:{servedFrom:'stored',sourceCheckedAt:'2026-11-11T12:00:00Z',savedAt:'2026-11-11T12:00:00Z'}};}
test('Astemir uses QR first, Google fallback, never plan/non-QR/cancelled starts or duplicate pay',()=>{
 const result=merged();assert.deepEqual(result.sources[0].appDates,['2026-11-01','2026-11-02']);assert.deepEqual(result.sources[0].googleFallbackDates,['2026-11-04']);assert.equal(result.formSummaries[0].workedDays,3);
 assert.equal(purchasePayrollAttendance('2026-11',attendance())?.workedDays,3);
});
test('actual day pay changes only day/minimum components; percent, guarantee and deductions remain',()=>{
 const report={fileName:'test',base:2_000_000,sourceRow:null}; const input={advance:'2000',deduction:'1000',comment:'test'};
 const old=buildPurchasePayrollRow(input,report);const actual=buildPurchasePayrollRow(input,report,undefined,purchasePayrollAttendance('2026-11',attendance()));
 assert.equal(actual.workedDays,3);assert.equal(actual.dayPay,1800);assert.equal(actual.purchasePercentAmount,old.purchasePercentAmount);assert.equal(actual.grossPay,100000);assert.equal(actual.netPay,97000);assert.equal(actual.purchaseTargetAdjustment,100000-1800-35000);
 const high=buildPurchasePayrollRow(input,{...report,base:10_000_000},undefined,{periodKey:'2026-11',workedDays:3});assert.ok(Math.abs(high.grossPay-176800)<0.005);
 assert.deepEqual(buildPurchasePayrollRow(input,report,undefined,purchasePayrollAttendance('2026-10',null)),old);
});
test('missing or mismatched evidence never returns fixed20 or an invented zero; confirmed zero is distinct',()=>{
 for(const value of [null,{...attendance(),period:{periodKey:'2026-10',monthIndex:9,year:2026}},{...attendance(),attendanceSources:[]}]){
 const row=buildPurchasePayrollRow(undefined,{fileName:'test',base:0,sourceRow:null},undefined,purchasePayrollAttendance('2026-11',value));assert.equal(row.workedDays,null);assert.equal(row.payrollStatus,'Проверить');}
 const zero=buildPurchasePayrollRow(undefined,{fileName:'test',base:0,sourceRow:null},undefined,{periodKey:'2026-11',workedDays:0});assert.equal(zero.workedDays,0);assert.equal(zero.payrollStatus,'OK');
});
test('Timur is a presentation alias only; canonical service rule, old Magomed and other names survive',()=>{
 assert.equal(payrollDisplayName(FILM_TRAINEE_NAME),'Тимур · поклейка');assert.equal(payrollDisplayName('Костеренко Магомед'),'Костеренко Магомед');assert.equal(getPayrollServicePercent(FILM_TRAINEE_NAME),70);assert.equal(isFilmTrainee('Тимур · поклейка'),false);assert.equal(payrollDisplayName('Кумыков Мухаммед'),'Кумыков Мухамед');
});
