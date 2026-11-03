import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {approveWorkdayExtension,deriveExtensionProposal} from '../lib/workday-extension';
const url=process.env.DATABASE_URL??'';const parsed=new URL(url);
if(parsed.hostname!=='127.0.0.1'||parsed.pathname!=='/workday_extension_test')throw Error('Isolated DB required');
const db=new PrismaClient();const now=new Date('2026-11-01T10:00Z');const ids:number[]=[];
test.after(async()=>{await db.adminInboxEvent.deleteMany({where:{sourceType:'workday_shift_extension'}});await db.user.deleteMany({where:{id:{in:ids}}});await db.$disconnect();});
async function fixture(){
 const marker=randomUUID();const admin=await db.user.create({data:{login:`admin-${marker}`,name:'Демо администратор',role:'ADMIN',passwordHash:'unused'}});ids.push(admin.id);
 const employee=await db.user.create({data:{login:`employee-${marker}`,name:'Демо Зухра',role:'EMPLOYEE',department:'retail',passwordHash:'unused'}});ids.push(employee.id);
 const colleague=await db.user.create({data:{login:`colleague-${marker}`,name:'Демо Милана',role:'EMPLOYEE',department:'retail',passwordHash:'unused'}});ids.push(colleague.id);
 const day=await db.workDayEntry.create({data:{userId:employee.id,date:'2026-11-01',department:'retail',shiftCode:'09_18',shiftLabel:'09:00-18:00',shiftStartMinutes:540,shiftEndMinutes:1080,startedAt:new Date('2026-11-01T05:57Z'),qrAcceptedAt:new Date('2026-11-01T05:57Z'),lateMinutes:0,latenessShadowPointsX2:0,latenessPolicyVersion:'original',comment:'Original'}});
 const departed=await db.workDayEntry.create({data:{userId:colleague.id,date:day.date,department:'retail',shiftCode:'11_20',shiftLabel:'11:00-20:00',shiftStartMinutes:660,shiftEndMinutes:1200,startedAt:new Date('2026-11-01T07:21Z'),endedAt:new Date('2026-11-01T08:00Z'),status:'completed'}});
 const run=await db.shiftControlRun.create({data:{workDayEntryId:day.id,userId:employee.id,date:day.date,department:'retail',tasks:{create:[{title:'Открытие',category:'opening',sortOrder:1,status:'done',completedAt:new Date('2026-11-01T06:00Z'),numericValue:5500},{title:'Сдача',category:'handover',sortOrder:2,plannedTimeMinutes:1080,comment:'Черновик',handoverData:{draft:true,cash:500}}]}},include:{tasks:true}});
 const reminder=await db.workdayNotification.create({data:{userId:employee.id,taskId:run.tasks[1].id,fingerprint:`reminder-${marker}`,kind:'planned',title:'Сдать смену',body:'',scheduledAt:new Date('2026-11-01T15:00Z')}});
 const proposal=deriveExtensionProposal([day,departed],now)!;
 // Separate cases in the same test database must not interfere with the department snapshot.
 const approve=()=>approveWorkdayExtension(db,{adminId:admin.id,proposal,now});
 return {admin,employee,colleague,day,departed,run,reminder,proposal,approve};
}
async function clearDays(){await db.workDayEntry.deleteMany({where:{userId:{in:ids}}});}
test('approval preserves attendance and task facts, retimes reminders, records actor; concurrent/repeated click is idempotent',async()=>{
 const f=await fixture();const results=await Promise.all([f.approve(),f.approve()]);assert.equal(results.filter(r=>!r.alreadyApproved).length,1);
 const day=await db.workDayEntry.findUniqueOrThrow({where:{id:f.day.id}});assert.equal(day.shiftCode,'09_20');assert.equal(day.shiftEndMinutes,1200);
 for(const k of ['startedAt','qrAcceptedAt','endedAt','lateMinutes','latenessPolicyVersion','latenessShadowPointsX2','comment','shiftStartMinutes'] as const)assert.deepEqual(day[k],f.day[k]);
 const tasks=await db.shiftControlTask.findMany({where:{runId:f.run.id},orderBy:{sortOrder:'asc'}});assert.deepEqual(tasks[0],f.run.tasks[0]);assert.deepEqual(tasks[1].handoverData,{draft:true,cash:500});assert.equal(tasks[1].plannedTimeMinutes,1200);assert.equal(tasks[1].comment,'Черновик');
 assert.equal((await db.workdayNotification.findUniqueOrThrow({where:{id:f.reminder.id}})).scheduledAt.toISOString(),'2026-11-01T17:00:00.000Z');
 await f.approve();assert.equal(await db.workdayShiftChange.count({where:{workDayEntryId:day.id}}),1);assert.equal(await db.workdayNotification.count({where:{userId:f.employee.id,kind:'workday_shift_extension'}}),1);
 assert.equal((await db.workdayShiftChange.findFirstOrThrow({where:{workDayEntryId:day.id}})).fromShiftCode,'09_18');await clearDays();
});
test('replacement before click and completed handover reject stale approval with no changes',async()=>{
 const f=await fixture();const replacement=await db.user.create({data:{login:randomUUID(),name:'Замена',role:'EMPLOYEE',department:'retail',passwordHash:'unused'}});ids.push(replacement.id);
 await db.workDayEntry.create({data:{userId:replacement.id,date:f.day.date,department:'retail',shiftCode:'11_20',shiftLabel:'11–20',startedAt:new Date('2026-11-01T09:00Z')}});
 await assert.rejects(f.approve(),/Состав смены изменился/);assert.equal((await db.workDayEntry.findUniqueOrThrow({where:{id:f.day.id}})).shiftCode,'09_18');
 await db.workDayEntry.deleteMany({where:{userId:replacement.id}});await db.shiftControlTask.update({where:{id:f.run.tasks[1].id},data:{status:'done'}});
 await assert.rejects(f.approve(),/Сдача смены уже началась/);assert.equal(await db.workdayShiftChange.count({where:{workDayEntryId:f.day.id}}),0);await clearDays();
});
test('non-admin and stale day cannot approve',async()=>{const f=await fixture();await assert.rejects(approveWorkdayExtension(db,{adminId:f.employee.id,proposal:f.proposal,now}),/Нет доступа/);await assert.rejects(approveWorkdayExtension(db,{adminId:f.admin.id,proposal:f.proposal,now:new Date('2026-11-02T10:00Z')}),/Состав смены изменился/);await clearDays();});

test('proposal notification is idempotent and becomes inactive when replacement appears',async()=>{
 const {syncWorkdayExtensionProposal}=await import('../lib/workday-extension');const f=await fixture();
 const a=await syncWorkdayExtensionProposal(db,now),b=await syncWorkdayExtensionProposal(db,now);assert.deepEqual(a,b);assert.equal(a?.workDayId,f.day.id);
 const key=`workday-extension:${f.day.id}:09_20:proposal`;assert.equal(await db.adminInboxEvent.count({where:{eventKey:key}}),1);
 const event=await db.adminInboxEvent.findUniqueOrThrow({where:{eventKey:key}});assert.equal(await db.adminInboxReceipt.count({where:{eventId:event.id,userId:f.admin.id}}),1);
 await db.workDayEntry.update({where:{id:f.departed.id},data:{endedAt:null,status:'active'}});assert.equal(await syncWorkdayExtensionProposal(db,now),null);
 await db.adminInboxEvent.delete({where:{id:event.id}});await clearDays();
});
