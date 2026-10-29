import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditDianaPastSchedule, isDianaSchedulePilot } from '../lib/diana-october-schedule';
const user = { name: 'Кумахова Диана', role: 'EMPLOYEE', department: 'retail', isActive: true };
test('past edit is exactly the named Retail employee, October 2026, while October is open for the pilot',()=>{
 assert.ok(canEditDianaPastSchedule(user,'2026-10-01','2026-10-30'));
 for(const u of [{...user,name:'Абшаева Зухра'},{...user,department:'wholesale'},{...user,role:'ADMIN'},{...user,isActive:false}])assert.equal(canEditDianaPastSchedule(u,'2026-10-01','2026-10-30'),false);
 for(const [date,today] of [['2026-09-30','2026-10-30'],['2026-10-32','2026-10-30'],['2026-10-01','2026-11-01'],['2026-10-31','2026-10-30']])assert.equal(canEditDianaPastSchedule(user,date,today),false);
 assert.equal(isDianaSchedulePilot(user,'2026-11'),false);
});
