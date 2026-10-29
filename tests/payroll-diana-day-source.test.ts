import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDianaPayrollDays } from '../lib/payroll-diana-day-source';
import { applyAutomaticAttendanceInputs } from '../lib/payroll-calculation-engine';
import type { ScheduleRow } from '../lib/google-sheets';
const name = 'Кумахова Диана';
const row = (date: string, plannedWork: boolean | null, employee = 'Диана'): ScheduleRow => ({ date, plannedWork, employee, dayOfWeek: '', scheduleNote: '' });
const day = (date: string, status = 'completed') => ({ userId: 9, date, status, startedAt: new Date(date+'T09:00:00+03:00') });
function merge(rows = [row('01.10.2026',true),row('02.10.2026',true),row('03.10.2026',false)], days = [day('2026-10-01'), day('2026-10-03','active')]) {
 return mergeDianaPayrollDays({googleRows:rows,appUsers:[{id:9,name,payrollName:name,workDays:days}],periodKey:'2026-10',throughDate:'2026-10-30'});
}
test('app starts win; Google working dates supply fallback; overlaps count once',()=>{
 const result = merge();assert.equal(result.summaries[0].scheduleDays,3);
 assert.match(result.message,/резерв из графика Google — 2026-10-02/);
 assert.deepEqual(merge(),result,'repeated refresh is idempotent');
 assert.equal(merge(undefined,[]).summaries[0].scheduleDays,2);
});
test('no app start and Google off/missing mark produce explicit zero; no future days',()=>{
 assert.equal(merge([row('01.10.2026',false),row('02.10.2026',null),row('31.10.2026',true)],[]).summaries[0].scheduleDays,0);
 assert.equal(merge([row('01.10.2026',false)],[day('2026-10-31')]).summaries[0].scheduleDays,0);
});
test('aliases and repeated cells deduplicate; other employees and input rows are preserved',()=>{
 const rows=[row('01.10.2026',true),row('01.10.2026',true,name),row('02.10.2026',true,'Зухра')];const before=JSON.stringify(rows);
 assert.deepEqual(merge(rows,[]).summaries,[{employee:'Зухра',scheduleDays:1},{employee:name,scheduleDays:1}]);assert.equal(JSON.stringify(rows),before);
});
test('historical months unchanged; ambiguous identity, invalid days and unavailable schedule fail closed',()=>{
 assert.deepEqual(mergeDianaPayrollDays({googleRows:[row('01.09.2026',true)],appUsers:[],periodKey:'2026-09',throughDate:'2026-09-30'}).summaries,[{employee:'Диана',scheduleDays:1}]);
 assert.throws(()=>merge([],[]));assert.throws(()=>merge([row('32.10.2026',true)],[]));
 assert.throws(()=>merge([row('01.10.2026',true),row('01.10.2026',false)],[]));
 assert.throws(()=>merge(undefined,[day('2026-10-01','cancelled')]));
 assert.throws(()=>merge(undefined,[{...day('2026-10-01'),userId:10}]));
 assert.throws(()=>merge(undefined,[day('2026-10-01'),day('2026-10-01')]));
 for(const appUsers of [[],[{id:9,name:'Другой',payrollName:null,workDays:[]}]])assert.throws(()=>mergeDianaPayrollDays({googleRows:[row('01.10.2026',true)],appUsers,periodKey:'2026-10',throughDate:'2026-10-30'}));
});
test('existing schedule-only application changes days only, preserving lateness, advance, manual correction and other employee inputs',()=>{
 const previous={workedDays:'12',lateCount:'2',advance:'7000',comment:'Оставить',source:'schedule' as const};
 const inputs={[name]:previous,'Абшаева Зухра':{...previous,workedDays:'21'}};
 const preview={snapshot:{servedFrom:'stored' as const,sourceCheckedAt:'2026-10-30T00:00:00Z',savedAt:'2026-10-30T00:00:00Z'},period:{periodKey:'2026-10',year:2026,monthIndex:9},attendanceMode:'google-sheets' as const,attendanceMessage:'',scheduleMode:'google-sheets' as const,scheduleMessage:'',formSummaries:[],scheduleSummaries:merge().summaries};
 const result=applyAutomaticAttendanceInputs([name],inputs,preview,'2026-10');assert.deepEqual(result[name],{...previous,workedDays:'3'});assert.deepEqual(result['Абшаева Зухра'],inputs['Абшаева Зухра']);
 const manual={[name]:{...previous,source:'manualCorrection' as const}};assert.deepEqual(applyAutomaticAttendanceInputs([name],manual,preview,'2026-10'),manual);
});
