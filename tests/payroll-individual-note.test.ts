import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dianaAttendanceNote, payrollIndividualNote, withPayrollIndividualNote} from '../lib/payroll-individual-note';
import {buildEmptyManagerSummary, buildFullPayrollRow, payrollEmployees} from '../lib/payroll-calculation-engine';
import {buildPayrollWorkbookEmployeeComment} from '../lib/payroll-workbook';
const base=()=>buildFullPayrollRow(buildEmptyManagerSummary(payrollEmployees['Кумахова Диана']),undefined);
test('only Diana from November; amounts, unknown attendance and original object remain unchanged',()=>{
 const before=base(); const frozen=JSON.stringify(before); const after=withPayrollIndividualNote(before,'2026-11');
 assert.equal(after.workedDays,null); assert.equal(after.lateCount,null);
 assert.deepEqual(after,{...before,payrollReasons:[],payrollStatus:'OK',comment:dianaAttendanceNote});
 assert.equal(JSON.stringify(before),frozen);
 assert.equal(withPayrollIndividualNote(before,'2026-10'),before);
 assert.equal(withPayrollIndividualNote({...before,manager:'Абшаева Зухра'},'2026-11').payrollReasons.length,before.payrollReasons.length);
 assert.equal(payrollIndividualNote('Кумахова Диана','2027-01'),dianaAttendanceNote);
 assert.equal(payrollIndividualNote('Кумахова Диана','2026-99'),null);
});
test('other review reasons, Finbox and manual comments survive; notice persists once in saved/export comment',()=>{
 const before={...base(),comment:'Комментарий руководителя',payrollReasons:['Не заполнены отработанные дни','Не указаны опоздания','Агентские Finbox пока не внесены','Аванс больше начислений']};
 const after=withPayrollIndividualNote(before,'2026-11');
 assert.deepEqual(after.payrollReasons,['Агентские Finbox пока не внесены','Аванс больше начислений']); assert.equal(after.payrollStatus,'Проверить');
 assert.deepEqual(withPayrollIndividualNote(after,'2026-11'),after);
 const comment=buildPayrollWorkbookEmployeeComment({employeeName:after.manager,lateCount:after.lateCount,deduction:0,manualComment:after.comment,reviewReasons:after.payrollReasons,bonuses:[]});
 assert.ok(comment.includes(dianaAttendanceNote)); assert.ok(comment.includes('Комментарий руководителя')); assert.ok(comment.includes('Finbox'));
});
