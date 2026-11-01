import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeMuhamedPayrollDays as merge, MUHAMED_DAY_NAME as name } from '../lib/payroll-muhamed-day-source';
import { buildPayrollEmployeeDirectory, buildFullPayrollRow, buildEmptyManagerSummary, getPayrollAttendanceConfig } from '../lib/payroll-calculation-engine';
import { prepareDailyPayrollInputs } from '../lib/payroll-daily-calculation';
import { createPayrollAttendanceSnapshotPayload, readPayrollAttendanceSnapshotPayload } from '../lib/payroll-attendance-snapshot';
import { payrollDraftComparisonFingerprint, payrollDraftDifferences } from '../lib/payroll-draft';
const user = { id: 13, name: 'Кумыков Мухамед', payrollName: name, role: 'EMPLOYEE', department: 'procurement', isActive: true, portalArea: 'WORKDAY', workDays: [] as ReturnType<typeof day>[] };
function day(date: string) { return { userId: 13, date, startedAt: new Date(date+'T09:00:00+03:00'), qrAcceptedAt: new Date(date+'T08:59:00+03:00'), status:'completed' }; }
const other = {employee:'Тохов Астемир',formRows:20,uniqueFormDates:20,workedDays:20,lateCount:0};
function source(days: ReturnType<typeof day>[] = [], periodKey='2026-11', throughDate='2026-11-30') {
 return merge({periodKey,throughDate,appUsers:[{...user,workDays:days}],formSummaries:[other],sources:[]});
}
function preview(result:ReturnType<typeof source>, periodKey='2026-11') {
 return { period:{periodKey,year:Number(periodKey.slice(0,4)),monthIndex:Number(periodKey.slice(5))-1},attendanceMode:'google-sheets+pwa' as const,attendanceSources:result.sources,
 attendanceMessage:'',scheduleMode:'google-sheets' as const,scheduleMessage:'',formSummaries:result.formSummaries,scheduleSummaries:[],
 snapshot:{servedFrom:'refreshed' as const,sourceCheckedAt:'2026-11-03T09:00:00Z',savedAt:'2026-11-03T09:00:00Z'} };
}
function calc(days:ReturnType<typeof day>[]=[],period='2026-11') {
 const directory=buildPayrollEmployeeDirectory([],period),attendance=preview(source(days,period),period);
 const manual=prepareDailyPayrollInputs({directory,attendance,periodKey:period,finboxAmount:null,manual:{[name]:{workedDays:'20',lateCount:'',advance:'500',comment:'keep',source:'manualCorrection'}}});
 return {directory,manual,row:buildFullPayrollRow(buildEmptyManagerSummary(directory[name]),manual[name],directory)};
}
test('November 1 owner confirmation pays 2000 without inventing a QR or changing Astemir',()=>{
 const input={periodKey:'2026-11',throughDate:'2026-11-01',appUsers:[user],formSummaries:[other],sources:[]};const before=structuredClone(input);
 const result=merge(input);assert.deepEqual(input,before);assert.deepEqual(result.formSummaries.find(r=>r.employee===other.employee),other);
 assert.deepEqual(result.sources[0].appDates,[]);assert.deepEqual(result.sources[0].ownerConfirmedDates,['2026-11-01']);
 assert.equal(calc().row.dayPay,2000);assert.equal(calc().row.netPay,1500);assert.equal(calc().row.comment,'keep');
 assert.equal(calc().directory[name].agreedDays,undefined);
 assert.deepEqual(calc().directory['Тохов Астемир'],buildPayrollEmployeeDirectory([],'2026-10')['Тохов Астемир']);
});
test('QR dates add real days; Nov 2 off adds no pay; overlaps and re-entry do not duplicate',()=>{
 assert.equal(calc([day('2026-11-03')]).row.dayPay,4000);
 assert.equal(calc([day('2026-11-01'),day('2026-11-03')]).row.dayPay,4000);
 assert.deepEqual(source([day('2026-11-03')]),source([day('2026-11-03')]));
 const cancelled={...day('2026-11-04'),status:'cancelled'};assert.equal(calc([cancelled]).row.dayPay,2000);
 const active={...day('2026-11-03'),status:'active'};assert.equal(calc([active]).row.dayPay,4000);
 const missing={...day('2026-11-03'),status:'missing_checkout'};assert.equal(calc([missing]).row.dayPay,4000);
});
test('scope, future dates and December do not carry the November exception forward',()=>{
 assert.deepEqual(source([day('2026-11-03')],'2026-11','2026-11-01').sources[0].appDates,[]);
 assert.equal(source([],'2026-12','2026-12-31').formSummaries.find(r=>r.employee===name)?.workedDays,0);
 assert.deepEqual(source([],'2026-12','2026-12-31').sources[0].ownerConfirmedDates,[]);
 const input={periodKey:'2026-10',throughDate:'2026-10-31',appUsers:[],formSummaries:[other],sources:[]};
 assert.deepEqual(merge(input),{formSummaries:input.formSummaries,sources:input.sources});
 const october=buildPayrollEmployeeDirectory([],'2026-10');const row=buildFullPayrollRow(buildEmptyManagerSummary(october[name]),{workedDays:'31',lateCount:'',advance:'7500',comment:''},october);
 assert.equal(row.dayRate,1500);assert.equal(row.workedDays,16);assert.equal(row.grossPay,24000);assert.equal(row.netPay,16500);
 assert.equal(getPayrollAttendanceConfig(name,'2026-10').sourceType,'manual_special');
 assert.equal(getPayrollAttendanceConfig(name,'2026-11').sourceType,'form');
});
test('corrupt QR and ambiguous/wrong account fail rather than replace a checked snapshot',()=>{
 for(const workDays of [[{...day('2026-11-03'),qrAcceptedAt:null}], [day('2026-11-03'),day('2026-11-03')], [{...day('2026-11-03'),userId:99}], [{...day('2026-11-03'),qrAcceptedAt:new Date('2026-11-02T20:00:00Z')}]] ) {
 assert.throws(()=>merge({periodKey:'2026-11',throughDate:'2026-11-30',appUsers:[{...user,workDays}],formSummaries:[],sources:[]}));
 }
 for(const appUsers of [[],[user,user],[{...user,portalArea:'PROCUREMENT'}],[{...user,payrollName:'Другой'}]])assert.throws(()=>merge({periodKey:'2026-11',throughDate:'2026-11-30',appUsers,formSummaries:[],sources:[]}));
});
test('missing/stale source never resurrects fixed 20 days; old manual corrections cannot override QR',()=>{
 const directory=buildPayrollEmployeeDirectory([],'2026-11');
 for(const attendance of [null,preview(source(), '2026-10'),{...preview(source()),attendanceSources:[]}]) {
  const manual=prepareDailyPayrollInputs({directory,attendance,periodKey:'2026-11',finboxAmount:null,manual:{[name]:{workedDays:'20',lateCount:'',advance:'',comment:'',source:'attendance'}}});
  const row=buildFullPayrollRow(buildEmptyManagerSummary(directory[name]),manual[name],directory);
  assert.equal(row.workedDays,null);assert.ok(row.payrollReasons.includes('Не заполнены отработанные дни'));
 }
 const raw=buildFullPayrollRow(buildEmptyManagerSummary(directory[name]),{workedDays:'20',lateCount:'',advance:'',comment:''},directory);assert.equal(raw.workedDays,null);
});
test('confirmed-day provenance survives snapshot read/write without changing older snapshots',()=>{
 const p=preview(source());const {snapshot,...payload}=p;
 const value=createPayrollAttendanceSnapshotPayload(payload);assert.deepEqual(readPayrollAttendanceSnapshotPayload(value,'2026-11'),value);
 const bad=structuredClone(value);bad.attendanceSources![0].ownerConfirmedDates=['2026-10-31'];assert.equal(readPayrollAttendanceSnapshotPayload(bad,'2026-11'),null);
});
test('November draft differences no longer hide real day changes; October comparison remains unchanged',()=>{
 const draft={manual:{[name]:{workedDays:'1',lateCount:'',advance:'',comment:''}},fixed:{},purchase:{advance:'',deduction:'',comment:''},bonuses:[]};const otherDraft=structuredClone(draft);otherDraft.manual[name].workedDays='20';
 assert.equal(payrollDraftComparisonFingerprint(draft,'2026-10'),payrollDraftComparisonFingerprint(otherDraft,'2026-10'));
 assert.notEqual(payrollDraftComparisonFingerprint(draft,'2026-11'),payrollDraftComparisonFingerprint(otherDraft,'2026-11'));
 assert.equal(payrollDraftDifferences(draft,otherDraft,'2026-11').length,1);
});
test('all other payroll employees and configured procurement rules keep their previous values',()=>{
 const users=[{...user,payrollSalaryType:'purchase_manager',payrollReportGroup:'Закупки',payrollFixedSalary:null,payrollRuleFrom:'2026-10',payrollRuleThrough:null}];
 const october=buildPayrollEmployeeDirectory(users,'2026-10'),november=buildPayrollEmployeeDirectory(users,'2026-11');
 assert.equal(november[name].salaryType,'purchase_daily');assert.equal(november[name].dayRate,2000);assert.equal(november[name].qrDaysRequired,true);
 delete october[name];delete november[name];assert.deepEqual(november,october);
});
